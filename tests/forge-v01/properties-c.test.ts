import { beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { outcome, py, type Call, type Response } from "./helpers.ts";

// PKG §14 Review property family for Task C: >= 10,000 deterministic iterations (xorshift32,
// fixed seed 1042026) driven through ONE py() batch and compared with an independent
// TypeScript oracle written from PKG §9 / contract C §3-§4. The oracle decides from the
// generator's abstract review model (owner?, state, body kind, supersedes), never from parsing
// the bodies, so it shares no code path with reviews.py.

const SEED = 1042026;
const ITERATIONS = 10_000;
const OWNER_ID = 315180734;
const H = "1".repeat(40);
const OLD_H = "2".repeat(40);
const B = "3".repeat(40);
const BINDING = { repoId: 1401864629, pr: 7, base: B, head: H, contractHash: "c".repeat(64), verifierSha: B, policyHash: "d".repeat(64), runId: 123, runAttempt: 2 };
const ENUM = ["REVIEW_MISSING", "REVIEW_FORMAT", "REVIEW_BINDING", "REVIEW_BLOCKED"] as const;

class XorShift32 {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    this.state = x;
    return x;
  }
  int(n: number): number {
    return this.next() % n;
  }
  chance(p: number): boolean {
    return this.next() / 0x1_0000_0000 < p;
  }
  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)]!;
  }
  shuffle<T>(items: T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }
}

const sha256 = (data: string | Buffer): string => createHash("sha256").update(data).digest("hex");
const canonical = (value: unknown): string => JSON.stringify(value, null, 2) + "\n";
const HEADER = "FORGE-ATTESTATION-V1\n";

// ---------------------------------------------------------------------- abstract review model

/** Body kinds of an Owner COMMENTED review (approve kinds carry a supersedes list). */
const KINDS = ["ok", "minor", "major", "critical", "requestChanges", "wrongContract", "badHash", "revoke", "malformed", "plain"] as const;
type Kind = (typeof KINDS)[number];
const APPROVE_KINDS: readonly Kind[] = ["ok", "minor", "major", "critical", "requestChanges", "wrongContract", "badHash"];
const STATES = ["COMMENTED", "COMMENTED", "COMMENTED", "COMMENTED", "CHANGES_REQUESTED", "DISMISSED", "APPROVED", "PENDING"] as const;

type Entry = { reviewId: number; bodyHash: string; state: string };
type Model = { id: number; owner: boolean; state: string; kind: Kind; stale: boolean; minute: number; supersedes: Entry[]; body: string };

function reportText(kind: Kind): string {
  const binding = { ...BINDING, contractHash: kind === "wrongContract" ? "f".repeat(64) : BINDING.contractHash };
  const findings = kind === "minor" ? [{ id: "n1", severity: "minor", summary: "nit" }]
    : kind === "major" || kind === "critical" ? [{ id: "b1", severity: kind, summary: "bug" }, { id: "n1", severity: "info", summary: "fyi" }]
    : [];
  return canonical({
    format: 1,
    binding: { repoId: binding.repoId, pr: binding.pr, base: binding.base, head: binding.head, contractHash: binding.contractHash, verifierSha: binding.verifierSha, policyHash: binding.policyHash },
    reviewer: { provider: "anthropic", model: "claude-opus-5-5" },
    result: kind === "requestChanges" ? "request_changes" : "approve",
    findings,
  });
}

function body(kind: Kind, supersedes: Entry[]): string {
  if (kind === "plain") return "Looks fine to me.";
  if (kind === "revoke") return HEADER + canonical({ format: 1, ...BINDING, action: "revoke", supersedes: [] });
  if (kind === "malformed") return HEADER + canonical({ format: 1, ...BINDING, action: "approve" });
  const text = reportText(kind);
  return HEADER + canonical({
    format: 1,
    ...BINDING,
    contractHash: kind === "wrongContract" ? "f".repeat(64) : BINDING.contractHash,
    action: "approve",
    externalReviewer: { provider: "anthropic", model: "claude-opus-5-5" },
    externalReviewHash: kind === "badHash" ? "0".repeat(64) : sha256(Buffer.from("forge-external-review-v1\n" + text, "utf8")),
    externalReviewResult: kind === "requestChanges" ? "request_changes" : "approve",
    externalReviewBase64: Buffer.from(text, "utf8").toString("base64"),
    supersedes,
    deployment: { policyDigest: "e".repeat(64), checkedAt: "2026-10-04T12:00:00Z" },
  });
}

/** Contract C §3 blocker definition over the abstract model. */
function isBlocker(m: Model): boolean {
  if (m.state === "CHANGES_REQUESTED" || m.state === "DISMISSED") return true;
  if (m.state !== "COMMENTED") return false;
  return m.kind === "revoke" || m.kind === "malformed" || m.kind === "requestChanges" || m.kind === "major" || m.kind === "critical";
}

const order = (x: Model, y: Model): number => x.minute - y.minute || x.id - y.id;

/** Expected outcome: PKG §9 selection and contract C §3 supersedes, from the model only. */
function oracle(models: Model[]): { outcome: string; reviewId?: number } {
  const published = models.filter((m) => m.owner && m.state !== "PENDING").sort(order);
  const last = published[published.length - 1];
  if (!last) return { outcome: "REVIEW_MISSING" };
  if (last.state !== "COMMENTED") return { outcome: "REVIEW_BLOCKED" };
  if (last.kind === "malformed" || last.kind === "plain") return { outcome: "REVIEW_FORMAT" };
  if (last.kind === "revoke") return { outcome: "REVIEW_BLOCKED" };
  const found = new Set<string>();
  if (last.stale || last.kind === "wrongContract" || last.kind === "badHash") found.add("REVIEW_BINDING");
  if (last.kind === "requestChanges" || last.kind === "major" || last.kind === "critical") found.add("REVIEW_BLOCKED");
  const blockers = new Map(published.slice(0, -1).filter(isBlocker).map((m) => [m.id, m] as const));
  const seen = new Set<number>();
  for (const e of last.supersedes) {
    const target = blockers.get(e.reviewId);
    if (seen.has(e.reviewId) || !target || e.bodyHash !== sha256(Buffer.from(target.body, "utf8")) || e.state !== target.state) found.add("REVIEW_BINDING");
    seen.add(e.reviewId);
  }
  if ([...blockers.keys()].some((id) => !seen.has(id))) found.add("REVIEW_BLOCKED");
  const first = ENUM.find((code) => found.has(code));
  return first ? { outcome: first } : { outcome: "PASS", reviewId: last.id };
}

function snapshotOracle(models: Model[]): string {
  const entries = models
    .filter((m) => m.owner && m.state !== "PENDING")
    .sort(order)
    .map((m) => ({ id: m.id, state: m.state, commitId: m.stale ? OLD_H : H, submittedAt: minuteTime(m.minute), bodySha256: sha256(Buffer.from(m.body, "utf8")) }));
  return sha256(Buffer.from("forge-review-snapshot-v1\n" + canonical(entries), "utf8"));
}

const minuteTime = (minute: number): string => `2026-10-04T${String(10 + Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}:00Z`;

/** Supersedes generator: mostly the exact blocker set, sometimes perturbed in one way. */
function genSupersedes(r: XorShift32, older: Model[]): Entry[] {
  const entry = (m: Model): Entry => ({ reviewId: m.id, bodyHash: sha256(Buffer.from(m.body, "utf8")), state: m.state });
  const ownerOlder = older.filter((m) => m.owner && m.state !== "PENDING");
  let list = ownerOlder.filter(isBlocker).map(entry);
  switch (r.int(8)) {
    case 0: if (list.length > 0) list.splice(r.int(list.length), 1); break; // missing blocker
    case 1: if (older.length > 0) list.push(entry(r.pick(older))); break; // any older review (maybe non-blocker / non-owner)
    case 2: if (list.length > 0) list.push({ ...r.pick(list) }); break; // duplicate
    case 3: if (list.length > 0) { const i = r.int(list.length); list[i] = { ...list[i]!, bodyHash: sha256(`stale ${i}`) }; } break;
    case 4: if (list.length > 0) { const i = r.int(list.length); list[i] = { ...list[i]!, state: list[i]!.state === "DISMISSED" ? "CHANGES_REQUESTED" : "DISMISSED" }; } break;
    case 5: list = []; break;
    default: break; // exact
  }
  return r.shuffle(list);
}

function genCase(r: XorShift32): Model[] {
  const count = 1 + r.int(5);
  const used = new Set<number>();
  const models: Model[] = [];
  for (let i = 0; i < count; i++) {
    let id = 1 + r.int(5000);
    while (used.has(id)) id = 1 + r.int(5000);
    used.add(id);
    const state = r.pick(STATES);
    const kind = r.chance(0.5) ? "ok" : r.pick(KINDS);
    models.push({ id, owner: !r.chance(0.15), state, kind, stale: r.chance(0.1), minute: r.int(6), supersedes: [], body: "" });
  }
  // Bodies are built oldest first so supersedes can name exact older body hashes.
  const sorted = [...models].sort(order);
  sorted.forEach((m, i) => {
    if (APPROVE_KINDS.includes(m.kind)) m.supersedes = genSupersedes(r, sorted.slice(0, i));
    m.body = body(m.kind, m.supersedes);
  });
  return r.shuffle(models);
}

function toRecord(m: Model): Record<string, unknown> {
  return {
    id: m.id,
    user: { id: m.owner ? OWNER_ID : OWNER_ID + 1, login: "forge-owner" },
    state: m.state,
    commit_id: m.stale ? OLD_H : H,
    submitted_at: m.state === "PENDING" ? null : minuteTime(m.minute),
    body: m.body,
  };
}

describe("PKG §14 Review property family (seed 1042026)", () => {
  const r = new XorShift32(SEED ^ 0x0c0c);
  const cases = Array.from({ length: ITERATIONS }, () => genCase(r));
  let selected: Response[] = [];
  let digests: Response[] = [];

  beforeAll(() => {
    const calls: Call[] = [];
    for (const models of cases) {
      const records = models.map(toRecord);
      calls.push({ fn: "reviews.select_attestation", args: [records], kwargs: { owner_id: OWNER_ID, binding: BINDING, profile: "DEV", developer_provider: "openai" } });
      calls.push({ fn: "reviews.review_snapshot_digest", args: [records, OWNER_ID] });
    }
    const out = py(calls);
    selected = cases.map((_, i) => out[2 * i]!);
    digests = cases.map((_, i) => out[2 * i + 1]!);
  }, 20_000);

  it(`${ITERATIONS} review sets: selection and supersedes outcome equal the oracle`, () => {
    let mismatch: string | null = null;
    cases.forEach((models, i) => {
      if (mismatch) return;
      const want = oracle(models);
      const got = selected[i]!;
      const gotId = (got.ok as { reviewId?: number } | undefined)?.reviewId;
      if (outcome(got) !== want.outcome || gotId !== want.reviewId) {
        mismatch = JSON.stringify({ models: models.map(({ body: _b, ...m }) => m), oracle: want, python: got });
      }
    });
    expect(mismatch).toBeNull();
  });

  it(`${ITERATIONS} review sets: snapshot digest equals the contract C §4 oracle`, () => {
    const bad = cases.findIndex((models, i) => digests[i]!.ok !== snapshotOracle(models));
    expect(bad === -1 ? null : JSON.stringify({ models: cases[bad], python: digests[bad] })).toBeNull();
  });

  it("corpus covers every outcome and every supersedes perturbation class", () => {
    const outcomes = new Set(cases.map((m) => oracle(m).outcome));
    expect([...outcomes].sort()).toEqual(["PASS", ...ENUM].sort());
    const passWithSupersedes = cases.filter((m) => oracle(m).outcome === "PASS" && m.some((x) => x.supersedes.length > 0)).length;
    expect(passWithSupersedes).toBeGreaterThan(50);
  });
});
