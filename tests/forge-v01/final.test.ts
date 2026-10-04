import { beforeAll, describe, expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PYTHON, outcome, py, type Call, type Response } from "./helpers.ts";

// FORGE-BOOTSTRAP-0001C github.py (fixed GET adapter) and final.py (Gate receipt, Stage-2 start,
// attempt jobs, two-round final recheck), contract C r2 §4–§6, PKG §2/§10/§11. No network: every
// GitHub read goes through seams.FixedTransport, the same `get(path) -> bytes` shape as A's
// HttpsTransport. Mutant C3/C4/C5 tests are the isolated assertion tests of contract C §12.

const HERE = dirname(fileURLToPath(import.meta.url));
const TOOLS = join(HERE, "..", "..", "tools", "forge_v01");
const REPO_ID = 1401864629;
const REPO = "/repos/Forge-Dice/Forge";
const PR = 7;
const RUN = 4242;
const OWNER = 315180734;
const CODEX = 337272506;
const WORKFLOW = ".github/workflows/forge-v01.yml";

const sha1 = (s: string) => createHash("sha1").update(s).digest("hex");
const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
const B = sha1("base");
const H = sha1("head");
const X = sha1("moved");
const CONTRACT = sha256("contract");
const POLICY = sha256("policy");

// ------------------------------------------------------------------ API fixtures (raw REST)

type Obj = Record<string, unknown>;

function apiPr(o: Obj = {}): Obj {
  return {
    url: "ignored", number: PR, state: o["state"] ?? "open", draft: o["draft"] ?? false, user: { id: CODEX, login: "codex" },
    base: { ref: "main", sha: o["baseSha"] ?? B, repo: { id: REPO_ID, full_name: "Forge-Dice/Forge" } },
    head: { ref: "forge/run/codex/x-1", sha: o["headSha"] ?? H, repo: { id: REPO_ID } },
  };
}

function apiReview(id: number, userId: number | null, state: string, body: string, at: string | null, commit = H): Obj {
  return { id, node_id: "ignored", user: userId === null ? null : { id: userId, login: userId === OWNER ? "owner" : "x" },
    body, state, html_url: "ignored", commit_id: commit, submitted_at: at, author_association: "OWNER" };
}

const ATTESTATION = "FORGE-ATTESTATION-V1\n{\n  \"format\": 1\n}\n";
const REVIEWS: Obj[] = [
  apiReview(501, CODEX, "COMMENTED", "looks fine", "2026-10-04T09:00:00Z"),
  apiReview(502, OWNER, "COMMENTED", "owner note", "2026-10-04T09:30:00Z"),
  apiReview(503, OWNER, "COMMENTED", ATTESTATION, "2026-10-04T10:00:00Z"),
  apiReview(504, OWNER, "PENDING", "draft", null),
];
const edited = (reviews: Obj[], id: number, body: string) => reviews.map((r) => (r["id"] === id ? { ...r, body } : r));

function apiRun(attempt: number, o: Obj = {}): Obj {
  return {
    id: RUN, name: "Forge V0.1", run_attempt: attempt, event: "pull_request_target", path: WORKFLOW, workflow_id: 77,
    head_sha: B, repository: { id: REPO_ID }, actor: { id: CODEX, login: "codex" },
    triggering_actor: "triggering" in o ? o["triggering"] : { id: OWNER, login: "owner" },
  };
}

function apiJob(id: number, name: string, attempt: number, status: string, conclusion: string | null): Obj {
  return { id, run_id: RUN, run_attempt: attempt, name, status, conclusion, head_sha: B, workflow_name: "Forge V0.1" };
}
const freshJobs = (attempt = 2) => [apiJob(9001, "forge-gate", attempt, "completed", "success"), apiJob(9002, "forge-verify", attempt, "in_progress", null)];

type World = { pr?: Obj | Obj[]; main?: string | string[]; reviews?: Obj[][]; run?: Obj; jobs?: Obj[]; attempt?: number };

function answers(w: World = {}): Obj {
  const attempt = w.attempt ?? 2;
  const jobs = w.jobs ?? freshJobs(attempt);
  return {
    [`${REPO}/pulls/${PR}`]: w.pr ?? apiPr(),
    [`${REPO}/branches/main`]: (Array.isArray(w.main) ? w.main : [w.main ?? B]).map((sha) => ({ name: "main", commit: { sha }, protected: true })),
    [`${REPO}/pulls/${PR}/reviews?per_page=100&page=1`]: w.reviews ?? [REVIEWS],
    [`${REPO}/actions/runs/${RUN}/attempts/${attempt}`]: w.run ?? apiRun(attempt),
    [`${REPO}/actions/runs/${RUN}/attempts/${attempt}/jobs?per_page=100&page=1`]: { total_count: jobs.length, jobs },
  };
}

// ------------------------------------------------------------------ oracle digest (contract C §4)

/** Independent TS digest: Owner-id published reviews {id,state,commitId,submittedAt,bodySha256} by (submittedAt,id). */
function tsDigest(reviews: Obj[], owner = OWNER): string {
  const entries = reviews
    .filter((r) => (r["user"] as Obj | null)?.["id"] === owner && r["state"] !== "PENDING")
    .map((r) => ({ id: r["id"] as number, state: r["state"], commitId: r["commit_id"], submittedAt: r["submitted_at"] as string,
      bodySha256: sha256(Buffer.from((r["body"] as string | null) ?? "", "utf8")) }))
    .sort((a, b) => (a.submittedAt < b.submittedAt ? -1 : a.submittedAt > b.submittedAt ? 1 : a.id - b.id));
  return sha256(Buffer.concat([Buffer.from("forge-review-snapshot-v1\n"), Buffer.from(JSON.stringify(entries, null, 2) + "\n", "utf8")]));
}

const GATE_DIGEST = tsDigest(REVIEWS);

function receiptFields(o: Obj = {}): Obj {
  return { runId: RUN, runAttempt: 2, B, H, contractHash: CONTRACT, policyHash: POLICY, verifierSha: B, reviewSnapshotDigest: GATE_DIGEST, ...o };
}
const CURRENT = { runId: RUN, runAttempt: 2, B, H, contractHash: CONTRACT, policyHash: POLICY, verifierSha: B };
const EXPECTED = { repoId: REPO_ID, pr: PR, B, H, runId: RUN, runAttempt: 2, ownerId: OWNER, recheckRequired: true,
  attestation: { reviewId: 503, bodySha256: sha256(ATTESTATION) } };

// ------------------------------------------------------------------ transport runner

type Step = { fn: string; args: unknown[] };
type Item = { answers: Obj; steps: Step[] };
type ItemResult = { results: Response[]; requests: string[] };

// Builds one seams.FixedTransport per item ("$t"); "$r<i>[.key...]" refers to an earlier raw result.
const RUNNER = `
import importlib, json, sys
sys.dont_write_bytecode = True
sys.path.insert(0, sys.argv[1])
import driver, seams
from errors import ForgeFail
def resolve(v, t, raw):
    if isinstance(v, str) and v == "$t":
        return t
    if isinstance(v, str) and v.startswith("$r"):
        idx, *keys = v[2:].split(".")
        value = raw[int(idx)]
        for k in keys:
            value = value[int(k)] if isinstance(value, list) else value[k]
        return value
    if isinstance(v, list):
        return [resolve(x, t, raw) for x in v]
    if isinstance(v, dict):
        return {k: resolve(x, t, raw) for k, x in v.items()}
    return v
out = []
for item in json.loads(sys.stdin.read()):
    t, raw, results = seams.FixedTransport(item["answers"]), [], []
    for step in item["steps"]:
        mod, _, name = step["fn"].partition(".")
        value = None
        try:
            value = getattr(importlib.import_module(mod), name)(*resolve(step["args"], t, raw))
            results.append({"ok": driver.encode(value)})
        except ForgeFail as f:
            results.append({"fail": f.record()})
        except Exception as e:
            results.append({"error": type(e).__name__})
        raw.append(value)
    out.append({"results": results, "requests": t.requests})
sys.stdout.write(json.dumps(out))
`;

function pyT(items: Item[]): ItemResult[] {
  const r = spawnSync(PYTHON, ["-I", "-c", RUNNER, HERE], { input: JSON.stringify(items), encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`runner exited ${r.status}: ${r.stderr}`);
  return JSON.parse(r.stdout) as ItemResult[];
}
const pyT1 = (w: World, steps: Step[]): ItemResult => pyT([{ answers: answers(w), steps }])[0]!;
const snap = (attempt = 2): Step => ({ fn: "final.take_snapshot", args: ["$t", PR, RUN, attempt] });
const ok = <T = Obj>(r: Response): T => {
  expect(outcome(r)).toBe("PASS");
  return r.ok as T;
};

// ================================================================== github.py

describe("github.py fixed GET-only adapter", () => {
  test("reads PR, main, reviews, run and jobs as strictly selected dicts over fixed paths only", () => {
    const { results, requests } = pyT1({}, [snap()]);
    const s = ok<Obj>(results[0]!);
    expect(s["pr"]).toEqual({ number: PR, state: "open", draft: false, repoId: REPO_ID, baseRef: "main", baseSha: B, headSha: H, headRepoId: REPO_ID, authorId: CODEX });
    expect(s["main"]).toEqual({ sha: B });
    expect(s["run"]).toEqual({ id: RUN, runAttempt: 2, event: "pull_request_target", path: WORKFLOW, workflowId: 77, headSha: B, triggeringActorId: OWNER, actorId: CODEX });
    expect(s["jobs"]).toEqual([
      { id: 9001, name: "forge-gate", runAttempt: 2, status: "completed", conclusion: "success" },
      { id: 9002, name: "forge-verify", runAttempt: 2, status: "in_progress", conclusion: null },
    ]);
    expect((s["reviews"] as Obj[])[0]).toEqual({ id: 501, user: { id: CODEX }, state: "COMMENTED", commit_id: H, submitted_at: "2026-10-04T09:00:00Z", body: "looks fine" });
    expect(requests).toEqual([
      `${REPO}/pulls/${PR}`, `${REPO}/branches/main`, `${REPO}/pulls/${PR}/reviews?per_page=100&page=1`,
      `${REPO}/actions/runs/${RUN}/attempts/2`, `${REPO}/actions/runs/${RUN}/attempts/2/jobs?per_page=100&page=1`,
    ]);
  });

  test("paginates reviews and jobs with an internal page counter (105 reviews, 101 jobs)", () => {
    const many = Array.from({ length: 105 }, (_, i) => apiReview(1000 + i, CODEX, "COMMENTED", `r${i}`, "2026-10-04T08:00:00Z"));
    const jobs = Array.from({ length: 101 }, (_, i) => apiJob(5000 + i, `j${i}`, 2, "completed", "success"));
    const jobPath = `${REPO}/actions/runs/${RUN}/attempts/2/jobs?per_page=100&page=`;
    const { results, requests } = pyT([{
      answers: {
        [`${REPO}/pulls/${PR}/reviews?per_page=100&page=1`]: [many.slice(0, 100)],
        [`${REPO}/pulls/${PR}/reviews?per_page=100&page=2`]: [many.slice(100)],
        [`${jobPath}1`]: { total_count: 101, jobs: jobs.slice(0, 100) },
        [`${jobPath}2`]: { total_count: 101, jobs: jobs.slice(100) },
      },
      steps: [{ fn: "github.read_reviews", args: ["$t", PR] }, { fn: "github.read_jobs", args: ["$t", RUN, 2] }],
    }])[0]!;
    expect((ok<Obj[]>(results[0]!)).length).toBe(105);
    expect((ok<Obj[]>(results[1]!)).length).toBe(101);
    expect(requests).toEqual([`${REPO}/pulls/${PR}/reviews?per_page=100&page=1`, `${REPO}/pulls/${PR}/reviews?per_page=100&page=2`, `${jobPath}1`, `${jobPath}2`]);
  });

  test("AV-176 API read error or incomplete pagination is EXECUTION_API", () => {
    const fullPage = (p: number) => Array.from({ length: 100 }, (_, i) => apiReview(p * 1000 + i + 1, CODEX, "COMMENTED", "x", "2026-10-04T08:00:00Z"));
    const twentyPages: Obj = {};
    for (let p = 1; p <= 21; p++) twentyPages[`${REPO}/pulls/${PR}/reviews?per_page=100&page=${p}`] = [fullPage(p)];
    const jobs = (total: number, list: Obj[]) => ({ [`${REPO}/actions/runs/${RUN}/attempts/2/jobs?per_page=100&page=1`]: { total_count: total, jobs: list } });
    const cases: Item[] = [
      { answers: {}, steps: [snap()] }, // transport read error on the first GET
      { answers: { ...answers(), [`${REPO}/branches/main`]: "{\"commit\": {\"sha\": \"x\"}, \"commit\": {}}" }, steps: [snap()] },
      { answers: jobs(3, freshJobs()), steps: [{ fn: "github.read_jobs", args: ["$t", RUN, 2] }] }, // short page before total
      { answers: jobs(2001, []), steps: [{ fn: "github.read_jobs", args: ["$t", RUN, 2] }] }, // over 2,000 jobs
      { answers: twentyPages, steps: [{ fn: "github.read_reviews", args: ["$t", PR] }] }, // > 20 pages
      { answers: { [`${REPO}/pulls/${PR}/reviews?per_page=100&page=1`]: [[REVIEWS[0], REVIEWS[0]]] }, steps: [{ fn: "github.read_reviews", args: ["$t", PR] }] },
      { answers: answers({ run: { ...apiRun(2), id: 1 } }), steps: [snap()] }, // run record for another run
      { answers: answers({ pr: { ...apiPr(), draft: "no" } }), steps: [snap()] }, // mistyped control field
      { answers: { [`${REPO}/branches/main`]: "{\"commit\": {\"sha\": 1.5}}" }, steps: [{ fn: "github.read_main", args: ["$t"] }] },
    ];
    const out = pyT(cases);
    for (const r of out) {
      expect(outcome(r.results[0]!)).toBe("EXECUTION_API");
      expect(r.results[0]!.fail!.phase).toBe("final");
    }
    expect(out[4]!.requests.length).toBe(20); // the internal page counter never asks for page 21
  });

  test("static: GET-only, no Authorization header, wraps A's bootstrap.HttpsTransport", () => {
    const src = readFileSync(join(TOOLS, "github.py"), "utf8");
    expect(src).toMatch(/^from bootstrap import .*HttpsTransport/m);
    expect(src).toMatch(/return HttpsTransport\(\)/);
    expect(src).not.toMatch(/["'](POST|PATCH|PUT|DELETE)["']/);
    expect(src).not.toMatch(/\.request\(|headers\s*=|^import (http|urllib|ssl|socket)/m);
    expect(src).not.toMatch(/["']Authorization["']|[Ll]ink["']\]/);
  });
});

// ================================================================== receipt

describe("Gate receipt", () => {
  test("make_receipt writes fixed canonical JSON with trailing LF and parse_receipt round-trips it", () => {
    const [made, parsed] = py([{ fn: "final.make_receipt", args: [receiptFields({ extra: 1 })] }, { fn: "final.parse_receipt", args: [JSON.stringify(receiptFields(), null, 2) + "\n"] }]);
    expect(made!.ok).toBe(JSON.stringify(receiptFields(), null, 2) + "\n");
    expect(parsed!.ok).toEqual(receiptFields());
  });

  test("parse_receipt is strict: order, keys, bytes, numbers and hex → IDENTITY_RECHECK", () => {
    const good = JSON.stringify(receiptFields(), null, 2) + "\n";
    const { runId, ...noRun } = receiptFields();
    void runId;
    const bad = [
      JSON.stringify({ runAttempt: 2, ...receiptFields() }, null, 2) + "\n",
      JSON.stringify({ ...receiptFields(), extra: 1 }, null, 2) + "\n",
      JSON.stringify(noRun, null, 2) + "\n",
      good.replace(/\n/g, "\r\n"),
      good.slice(0, -1),
      JSON.stringify(receiptFields()),
      good.replace(`"runId": ${RUN}`, `"runId": ${RUN}, "runId": ${RUN}`),
      good.replace(`"runAttempt": 2`, `"runAttempt": 2.0`),
      good.replace(`"runAttempt": 2`, `"runAttempt": 0`),
      good.replace(B, B.toUpperCase()),
      good.replace(POLICY, POLICY.slice(1)),
      "﻿" + good,
    ];
    const results = py([...bad.map((t) => ({ fn: "final.parse_receipt", args: [t] })), { fn: "final.parse_receipt", args: [7] }]);
    for (const r of results) expect(outcome(r)).toBe("IDENTITY_RECHECK");
    expect(outcome(py([{ fn: "final.make_receipt", args: [receiptFields({ B: "zz" })] }])[0]!)).toBe("EXECUTION_INTERNAL");
  });
});

// ================================================================== Stage-2 start (§4)

function stage2(w: World, gate: Obj, current: Obj = CURRENT): ItemResult {
  return pyT1(w, [
    snap(),
    { fn: "final.make_receipt", args: [gate] },
    { fn: "final.parse_receipt", args: ["$r1"] },
    { fn: "final.check_attempt_jobs", args: ["$r0.jobs", "$r0.run", "$r2", OWNER, true] },
    { fn: "reviews.review_snapshot_digest", args: ["$r0.reviews", OWNER] },
    { fn: "final.check_stage2_start", args: ["$r2", current, "$r4"] },
  ]);
}

describe("Stage-2 start binding", () => {
  test("TS oracle digest equals reviews.review_snapshot_digest on the Gate review list", () => {
    const r = pyT1({}, [snap(), { fn: "reviews.review_snapshot_digest", args: ["$r0.reviews", OWNER] }]);
    expect(r.results[1]!.ok).toBe(GATE_DIGEST);
  });

  test("AV-155 review edited before the Gate observation of the same attempt and now bound → PASS", () => {
    const bound = edited(REVIEWS, 502, "owner note, edited before the Gate");
    const gate = receiptFields({ reviewSnapshotDigest: tsDigest(bound) });
    const r = stage2({ reviews: [bound] }, gate);
    expect(r.results.map(outcome)).toEqual(["PASS", "PASS", "PASS", "PASS", "PASS", "PASS"]);
    const fin = pyT1({ reviews: [bound] }, [snap(), snap(), { fn: "final.final_recheck", args: [["$r0", "$r1"], gate, EXPECTED] }]);
    expect(outcome(fin.results[2]!)).toBe("PASS");
  });

  test("AV-154 / AV-180 review R0 at Gate, R1 before Stage 2 → different digest, REVIEW_CHANGED", () => {
    const r = stage2({ reviews: [edited(REVIEWS, 503, ATTESTATION + " ")] }, receiptFields());
    expect(r.results[4]!.ok).not.toBe(GATE_DIGEST);
    expect(outcome(r.results[5]!)).toBe("REVIEW_CHANGED");
  });

  test("AV-167 policy hash moves in the checked snapshot → POLICY_CHANGED; contract hash too", () => {
    expect(outcome(stage2({}, receiptFields(), { ...CURRENT, policyHash: sha256("other") }).results[5]!)).toBe("POLICY_CHANGED");
    expect(outcome(stage2({}, receiptFields(), { ...CURRENT, contractHash: sha256("other") }).results[5]!)).toBe("POLICY_CHANGED");
  });

  test("receipt B/H/verifier mismatch → PR_STALE; runId mismatch → IDENTITY_RECHECK; PKG §11 precedence", () => {
    const out = [
      stage2({}, receiptFields({ H: X })),
      stage2({}, receiptFields({ verifierSha: X })),
      stage2({}, receiptFields(), { ...CURRENT, runId: RUN + 1 }),
      stage2({}, receiptFields({ runAttempt: 1, B: X, policyHash: sha256("p2") })),
      stage2({ reviews: [edited(REVIEWS, 502, "x")] }, receiptFields({ policyHash: sha256("p2") })),
    ].map((r) => outcome(r.results[5]!));
    expect(out).toEqual(["PR_STALE", "PR_STALE", "IDENTITY_RECHECK", "PR_STALE", "REVIEW_CHANGED"]);
  });

  test("mutant C3: attempt job list correct, receipt carries previous attempt's runAttempt → IDENTITY_RECHECK", () => {
    // Masking statement: the job set of attempt 2 is complete and fresh (check_attempt_jobs PASS), B/H/main,
    // hashes and review digest are equal, and the final layer does not compare receipt.runAttempt.
    const gate = receiptFields({ runAttempt: 1 });
    const r = stage2({}, gate);
    expect(r.results.slice(0, 5).map(outcome)).toEqual(["PASS", "PASS", "PASS", "PASS", "PASS"]);
    expect(r.results[4]!.ok).toBe(GATE_DIGEST);
    const fin = pyT1({}, [snap(), snap(), { fn: "final.final_recheck", args: [["$r0", "$r1"], gate, EXPECTED] }]);
    expect(outcome(fin.results[2]!)).toBe("PASS");
    expect(outcome(r.results[5]!)).toBe("IDENTITY_RECHECK");
  });

  test("mutant C5: review body edited between Gate and Stage 2, same H/main/attempt, complete jobs → REVIEW_CHANGED", () => {
    const r = stage2({ reviews: [edited(REVIEWS, 502, "owner note, edited after the Gate")] }, receiptFields());
    const s = r.results[0]!.ok as { pr: Obj; main: Obj; run: Obj };
    expect([s.pr["headSha"], s.main["sha"], s.run["runAttempt"]]).toEqual([H, B, 2]);
    expect(r.results.slice(1, 4).map(outcome)).toEqual(["PASS", "PASS", "PASS"]);
    expect(r.results[4]!.ok).not.toBe(GATE_DIGEST);
    expect(outcome(r.results[5]!)).toBe("REVIEW_CHANGED");
  });
});

// ================================================================== attempt jobs (§6)

function jobsOutcome(w: World, recheck = true, attempt = w.attempt ?? 2): string {
  const r = pyT1(w, [snap(attempt), { fn: "final.check_attempt_jobs", args: ["$r0.jobs", "$r0.run", receiptFields({ runAttempt: attempt }), OWNER, recheck] }]);
  expect(outcome(r.results[0]!)).toBe("PASS");
  return outcome(r.results[1]!);
}

describe("run attempt and jobs", () => {
  test("AV-168 original actor Codex, triggering_actor numerically Owner, attempt 2 complete → PASS", () => {
    expect(jobsOutcome({})).toBe("PASS");
    expect(jobsOutcome({ jobs: [...freshJobs()].reverse() })).toBe("PASS");
  });

  test("AV-169 triggering_actor Codex at attempt 2 → IDENTITY_RECHECK; missing id never falls back to login", () => {
    expect(jobsOutcome({ run: apiRun(2, { triggering: { id: CODEX, login: "owner" } }) })).toBe("IDENTITY_RECHECK");
    expect(jobsOutcome({ run: apiRun(2, { triggering: { login: "owner" } }) })).toBe("IDENTITY_RECHECK");
    expect(jobsOutcome({ run: apiRun(2, { triggering: null }) })).toBe("IDENTITY_RECHECK");
    expect(jobsOutcome({ attempt: 1 })).toBe("IDENTITY_RECHECK"); // Owner recheck needs attempt >= 2
    expect(jobsOutcome({ attempt: 1 }, false)).toBe("PASS");
  });

  test("AV-170 re-run failed jobs keeps the attempt-1 Gate job and receipt → IDENTITY_RECHECK", () => {
    const rerunFailed = [apiJob(9001, "forge-gate", 1, "completed", "success"), apiJob(9003, "forge-verify", 2, "in_progress", null)];
    expect(jobsOutcome({ jobs: rerunFailed })).toBe("IDENTITY_RECHECK");
    expect(jobsOutcome({ jobs: [rerunFailed[1]!] })).toBe("IDENTITY_RECHECK");
    expect(jobsOutcome({ jobs: [apiJob(9001, "forge-gate", 2, "completed", "failure"), rerunFailed[1]!] })).toBe("IDENTITY_RECHECK");
    const r = stage2({ jobs: rerunFailed }, receiptFields({ runAttempt: 1 }));
    expect([outcome(r.results[3]!), outcome(r.results[5]!)]).toEqual(["IDENTITY_RECHECK", "IDENTITY_RECHECK"]);
  });

  test("AV-171 duplicate forge-verify, matrix or foreign job names, wrong workflow → POLICY_CHECKS", () => {
    const [gate, verify] = freshJobs();
    expect(jobsOutcome({ jobs: [gate!, verify!, apiJob(9004, "forge-verify", 2, "in_progress", null)] })).toBe("POLICY_CHECKS");
    expect(jobsOutcome({ jobs: [gate!, apiJob(9002, "forge-verify (1)", 2, "in_progress", null)] })).toBe("POLICY_CHECKS");
    expect(jobsOutcome({ jobs: [gate!, verify!, apiJob(9005, "other", 2, "completed", "success")] })).toBe("POLICY_CHECKS");
    expect(jobsOutcome({ jobs: [gate!, apiJob(9002, "forge-verify", 2, "completed", "success")] })).toBe("POLICY_CHECKS");
    expect(jobsOutcome({ run: { ...apiRun(2), path: ".github/workflows/other.yml" } })).toBe("POLICY_CHECKS");
    expect(jobsOutcome({ run: { ...apiRun(2), event: "pull_request" } })).toBe("POLICY_CHECKS");
  });
});

// ================================================================== final two-round recheck (§5)

function finalOutcome(w: World, receipt: Obj = receiptFields(), expected: Obj = EXPECTED): string {
  const r = pyT1(w, [
    { fn: "final.take_final_snapshots", args: ["$t", PR, RUN, 2] },
    { fn: "final.final_recheck", args: ["$r0", receipt, expected] },
  ]);
  expect(outcome(r.results[0]!)).toBe("PASS");
  return outcome(r.results[1]!);
}

describe("final recheck", () => {
  test("AV-168 two equal complete rounds bound to the Gate values → PASS", () => {
    const r = pyT1({}, [{ fn: "final.take_final_snapshots", args: ["$t", PR, RUN, 2] }, { fn: "final.final_recheck", args: ["$r0", receiptFields(), EXPECTED] }]);
    expect(r.results[1]!.ok).toEqual({ reviewSnapshotDigest: GATE_DIGEST, attestationId: 503 });
    expect(r.requests.length).toBe(10);
  });

  test("AV-164 PR closed (or draft, or retargeted) during tests → PR_STATE", () => {
    expect(finalOutcome({ pr: [apiPr(), apiPr({ state: "closed" })] })).toBe("PR_STATE");
    expect(finalOutcome({ pr: apiPr({ state: "closed", headSha: X }) })).toBe("PR_STATE");
    expect(finalOutcome({ pr: apiPr({ draft: true }) })).toBe("PR_STATE");
    expect(finalOutcome({ pr: { ...apiPr(), base: { ref: "dev", sha: B, repo: { id: REPO_ID } } } })).toBe("PR_STATE");
  });

  test("AV-165 head moves during tests → PR_STALE", () => {
    expect(finalOutcome({ pr: apiPr({ headSha: X }) })).toBe("PR_STALE");
    expect(finalOutcome({ pr: [apiPr(), apiPr({ headSha: X })] })).toBe("PR_STALE");
  });

  test("AV-166 main moves during tests with unchanged PR fields → PR_STALE", () => {
    expect(finalOutcome({ main: X })).toBe("PR_STALE");
    expect(finalOutcome({ main: [B, X] })).toBe("PR_STALE");
  });

  test("AV-154 / AV-156 review edited or deleted between Stage 2 and final → REVIEW_CHANGED", () => {
    expect(finalOutcome({ reviews: [edited(REVIEWS, 503, ATTESTATION + "\n")] })).toBe("REVIEW_CHANGED");
    expect(finalOutcome({ reviews: [REVIEWS, edited(REVIEWS, 502, "x")] })).toBe("REVIEW_CHANGED");
    expect(finalOutcome({ reviews: [REVIEWS.filter((r) => r["id"] !== 503)] })).toBe("REVIEW_CHANGED");
    expect(finalOutcome({ reviews: [[...REVIEWS, apiReview(505, OWNER, "COMMENTED", "new", "2026-10-04T11:00:00Z")]] })).toBe("REVIEW_CHANGED");
    // Non-Owner records between the rounds are not authority and change nothing.
    expect(finalOutcome({ reviews: [REVIEWS, [...edited(REVIEWS, 501, "spam"), apiReview(506, null, "COMMENTED", "ghost", "2026-10-04T11:00:00Z")]] })).toBe("PASS");
  });

  test("AV-169 / AV-170 / AV-171 attempt facts are rechecked in both final rounds", () => {
    expect(finalOutcome({ run: apiRun(2, { triggering: { id: CODEX } }) })).toBe("IDENTITY_RECHECK");
    expect(finalOutcome({ jobs: [apiJob(9001, "forge-gate", 1, "completed", "success"), apiJob(9003, "forge-verify", 2, "in_progress", null)] })).toBe("IDENTITY_RECHECK");
    expect(finalOutcome({ jobs: [...freshJobs(), apiJob(9004, "forge-verify", 2, "in_progress", null)] })).toBe("POLICY_CHECKS");
    expect(finalOutcome({ run: { ...apiRun(2), workflow_id: 78 } })).toBe("PASS");
  });

  test("rounds that differ only in an unbound field fail; exactly two snapshots, never a third", () => {
    const r = pyT1({}, [snap(), snap(),
      { fn: "final.final_recheck", args: [["$r0", "$r1"], receiptFields(), EXPECTED] },
      { fn: "final.final_recheck", args: [["$r0", "$r1", "$r1"], receiptFields(), EXPECTED] },
      { fn: "final.final_recheck", args: [["$r0"], receiptFields(), EXPECTED] },
    ]);
    expect(r.results.slice(2).map(outcome)).toEqual(["PASS", "EXECUTION_INTERNAL", "EXECUTION_INTERNAL"]);
    const s0 = r.results[0]!.ok as Obj;
    const s1 = r.results[1]!.ok as Obj;
    const out = py([
      { fn: "final.final_recheck", args: [[s0, { ...s1, run: { ...(s1["run"] as Obj), workflowId: 78 } }], receiptFields(), EXPECTED] },
      { fn: "final.final_recheck", args: [[s0, { ...s1, pr: { ...(s1["pr"] as Obj), authorId: 1 } }], receiptFields(), EXPECTED] },
      { fn: "final.final_recheck", args: [[s0, { ...s1, jobs: [...(s1["jobs"] as Obj[])].reverse() }], receiptFields(), EXPECTED] },
    ]);
    expect(out.map(outcome)).toEqual(["POLICY_CHECKS", "PR_STALE", "PASS"]);
  });

  test("mutant C4: PR.base.sha = B, GITHUB_SHA = B, /branches/main ≠ B → PR_STALE", () => {
    // Masking statement: base.sha, the run's head_sha (GITHUB_SHA), receipt B/verifierSha, H and both
    // rounds are held equal; only the current main differs, and it is checked at exactly one site.
    const r = pyT1({ main: X }, [snap(), snap(), { fn: "final.final_recheck", args: [["$r0", "$r1"], receiptFields(), EXPECTED] }]);
    const s0 = r.results[0]!.ok as { pr: Obj; run: Obj; main: Obj };
    expect([s0.pr["baseSha"], s0.run["headSha"], s0.main["sha"]]).toEqual([B, B, X]);
    expect(r.results[1]!.ok).toEqual(r.results[0]!.ok);
    expect(outcome(r.results[2]!)).toBe("PR_STALE");
  });
});

// ================================================================== property family (PKG §14)

// Final-recheck property family: >= 10,000 deterministic iterations, xorshift32 seed 1042026,
// one py() batch, compared with an independent TS oracle written from contract C §5/§6 and the
// PKG §11 enum order. The base snapshot comes once from take_snapshot over the fixed transport.

const SEED = 1042026;
const ITERATIONS = 10_000;
const ENUM = ["PR_STATE", "PR_STALE", "IDENTITY_ACTOR", "IDENTITY_RECHECK", "REVIEW_CHANGED", "POLICY_CHECKS"];

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
  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)]!;
  }
}

type Snap = { pr: Obj; main: Obj; reviews: Obj[]; run: Obj; jobs: Obj[] };

function oracleFinal(rounds: Snap[], receipt: Obj, exp: typeof EXPECTED): string {
  const codes = new Set<string>();
  for (const s of rounds) {
    const pr = s.pr;
    if (pr["state"] !== "open" || pr["draft"] !== false || pr["repoId"] !== exp.repoId || pr["number"] !== exp.pr || pr["baseRef"] !== "main") codes.add("PR_STATE");
    if (pr["headRepoId"] !== exp.repoId) codes.add("IDENTITY_ACTOR");
    const fresh = [pr["headSha"] === exp.H, pr["baseSha"] === exp.B, s.run["headSha"] === exp.B, s.main["sha"] === exp.B,
      receipt["B"] === exp.B, receipt["H"] === exp.H, receipt["verifierSha"] === exp.B];
    if (fresh.includes(false)) codes.add("PR_STALE");
    const attempt = s.run["runAttempt"] as number;
    if (s.run["id"] !== exp.runId || attempt !== exp.runAttempt || s.run["id"] !== receipt["runId"]) codes.add("IDENTITY_RECHECK");
    if (attempt < 2 || s.run["triggeringActorId"] !== exp.ownerId) codes.add("IDENTITY_RECHECK");
    if (s.run["event"] !== "pull_request_target" || s.run["path"] !== WORKFLOW) codes.add("POLICY_CHECKS");
    const names = s.jobs.map((j) => j["name"] as string).sort();
    if (names.length !== 2 || names[0] !== "forge-gate" || names[1] !== "forge-verify") codes.add("POLICY_CHECKS");
    const gates = s.jobs.filter((j) => j["name"] === "forge-gate" && j["runAttempt"] === attempt && j["status"] === "completed" && j["conclusion"] === "success");
    if (gates.length !== 1) codes.add("IDENTITY_RECHECK");
    if (s.jobs.filter((j) => j["name"] === "forge-verify" && j["runAttempt"] === attempt && j["status"] === "in_progress").length !== 1) codes.add("POLICY_CHECKS");
    if (tsDigest(s.reviews) !== receipt["reviewSnapshotDigest"]) codes.add("REVIEW_CHANGED");
    const att = s.reviews.filter((r) => r["id"] === exp.attestation.reviewId && (r["user"] as Obj | null)?.["id"] === exp.ownerId);
    if (att.length !== 1 || att[0]!["state"] !== "COMMENTED" || att[0]!["commit_id"] !== exp.H || sha256(Buffer.from(att[0]!["body"] as string, "utf8")) !== exp.attestation.bodySha256) codes.add("REVIEW_CHANGED");
  }
  const [a, b] = rounds as [Snap, Snap];
  const byId = (jobs: Obj[]) => JSON.stringify([...jobs].sort((x, y) => (x["id"] as number) - (y["id"] as number)));
  if (JSON.stringify(a.pr) !== JSON.stringify(b.pr) || a.main["sha"] !== b.main["sha"]) codes.add("PR_STALE");
  if (JSON.stringify(a.run) !== JSON.stringify(b.run) || byId(a.jobs) !== byId(b.jobs)) codes.add("POLICY_CHECKS");
  return ENUM.find((c) => codes.has(c)) ?? "PASS";
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

type Mutation = (s: Snap, rng: XorShift32) => void;
const set = (o: Obj | undefined, key: string, value: unknown) => { if (o) o[key] = value; };
const SNAP_MUTATIONS: Mutation[] = [
  (s) => { s.pr["state"] = "closed"; },
  (s) => { s.pr["draft"] = true; },
  (s) => { s.pr["baseRef"] = "release"; },
  (s) => { s.pr["repoId"] = 1; },
  (s) => { s.pr["number"] = PR + 1; },
  (s, r) => { s.pr["headRepoId"] = r.pick([null, 999]); },
  (s) => { s.pr["headSha"] = X; },
  (s) => { s.pr["baseSha"] = X; },
  (s) => { s.pr["authorId"] = OWNER; },
  (s) => { s.main["sha"] = X; },
  (s, r) => { s.run["runAttempt"] = r.pick([1, 3]); },
  (s) => { s.run["id"] = RUN + 1; },
  (s, r) => { s.run["triggeringActorId"] = r.pick([CODEX, null]); },
  (s) => { s.run["event"] = "pull_request"; },
  (s) => { s.run["path"] = ".github/workflows/x.yml"; },
  (s) => { s.run["headSha"] = X; },
  (s) => { s.run["workflowId"] = 78; },
  (s) => { s.run["actorId"] = OWNER; },
  (s) => { if (!s.jobs.some((j) => j["id"] === 9010)) s.jobs.push({ id: 9010, name: "forge-verify", runAttempt: 2, status: "in_progress", conclusion: null }); },
  (s) => { set(s.jobs.find((j) => j["name"] === "forge-gate"), "runAttempt", 1); },
  (s) => { set(s.jobs.find((j) => j["name"] === "forge-gate"), "conclusion", "failure"); },
  (s) => { set(s.jobs.find((j) => j["name"] === "forge-verify"), "status", "completed"); },
  (s) => { if (!s.jobs.some((j) => j["id"] === 9011)) s.jobs.push({ id: 9011, name: "forge-verify (2)", runAttempt: 2, status: "in_progress", conclusion: null }); },
  (s) => { s.jobs = s.jobs.filter((j) => j["name"] !== "forge-gate"); },
  (s) => { s.jobs.reverse(); },
  (s, r) => { const t = r.pick(s.reviews.filter((x) => x["state"] !== "PENDING")); t["body"] = `${t["body"] as string}~`; },
  (s) => { s.reviews = s.reviews.filter((x) => x["id"] !== 503); },
  (s) => { s.reviews = s.reviews.filter((x) => x["id"] !== 501); },
  (s) => { if (!s.reviews.some((x) => x["id"] === 505)) s.reviews.push({ id: 505, user: { id: OWNER }, state: "COMMENTED", commit_id: H, submitted_at: "2026-10-04T11:00:00Z", body: "late" }); },
  (s) => { if (!s.reviews.some((x) => x["id"] === 507)) s.reviews.push({ id: 507, user: { id: CODEX }, state: "CHANGES_REQUESTED", commit_id: H, submitted_at: "2026-10-04T11:00:00Z", body: "spam" }); },
  (s, r) => { set(s.reviews.find((x) => x["id"] === r.pick([502, 503])), "state", "DISMISSED"); },
  (s) => { set(s.reviews.find((x) => x["id"] === 503), "commit_id", X); },
  (s) => { set(s.reviews.find((x) => x["id"] === 504), "body", "pending edit"); },
  (s) => { s.reviews.reverse(); },
];
const RECEIPT_MUTATIONS: ((r: Obj) => void)[] = [
  (r) => { r["B"] = X; },
  (r) => { r["H"] = X; },
  (r) => { r["verifierSha"] = X; },
  (r) => { r["reviewSnapshotDigest"] = sha256("other"); },
  (r) => { r["runAttempt"] = 1; }, // checked once, at the Stage-2 start only
  (r) => { r["contractHash"] = sha256("other"); }, // Stage-2 start only
  (r) => { r["runId"] = RUN + 1; },
];

describe("final recheck property family", () => {
  let base: Snap;
  beforeAll(() => {
    base = pyT1({}, [snap()]).results[0]!.ok as Snap;
  });

  test(`final_recheck matches the TS oracle on ${ITERATIONS} deterministic two-round variations (seed ${SEED})`, () => {
    const rng = new XorShift32(SEED);
    const calls: Call[] = [];
    const expected: string[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const rounds = [clone(base), clone(base)];
      const receipt = receiptFields();
      const count = rng.int(4) === 0 ? 0 : 1 + rng.int(2);
      for (let m = 0; m < count; m++) {
        if (rng.int(6) === 0) {
          rng.pick(RECEIPT_MUTATIONS)(receipt);
          continue;
        }
        const mutation = rng.pick(SNAP_MUTATIONS);
        const where = rng.int(3);
        if (where !== 1) mutation(rounds[0]!, new XorShift32(i + 1));
        if (where !== 0) mutation(rounds[1]!, new XorShift32(i + 1));
      }
      calls.push({ fn: "final.final_recheck", args: [rounds, receipt, EXPECTED] });
      expected.push(oracleFinal(rounds, receipt, EXPECTED));
    }
    const actual = py(calls).map(outcome);
    const mismatch = actual.findIndex((a, i) => a !== expected[i]);
    if (mismatch >= 0) {
      throw new Error(`counterexample #${mismatch}: python=${actual[mismatch]} oracle=${expected[mismatch]} ${JSON.stringify(calls[mismatch]!.args)}`);
    }
    const seen = new Map<string, number>();
    for (const a of actual) seen.set(a, (seen.get(a) ?? 0) + 1);
    for (const code of ["PASS", ...ENUM]) expect(seen.get(code) ?? 0).toBeGreaterThan(50);
    expect(actual.length).toBe(ITERATIONS);
  });
});

describe("deployment check (PKG §10 platform policy)", () => {
  const DIGEST = "d".repeat(64);
  const AT = "2026-10-04T19:00:00Z";
  const T = Date.parse(AT) / 1000;
  const run = (deployment: unknown, now: number, digest = DIGEST) =>
    outcome(py([{ fn: "final.check_deployment", args: [deployment, digest, now] }])[0]!);

  test("matching digest, checkedAt 0 s and exactly 30 min old → PASS", () => {
    expect(run({ policyDigest: DIGEST, checkedAt: AT }, T)).toBe("PASS");
    expect(run({ policyDigest: DIGEST, checkedAt: AT }, T + 1800)).toBe("PASS");
  });

  test("older than 30 min, in the future, other digest or malformed checkedAt → POLICY_DEPLOYMENT", () => {
    expect(run({ policyDigest: DIGEST, checkedAt: AT }, T + 1801)).toBe("POLICY_DEPLOYMENT");
    expect(run({ policyDigest: DIGEST, checkedAt: AT }, T - 1)).toBe("POLICY_DEPLOYMENT");
    expect(run({ policyDigest: "e".repeat(64), checkedAt: AT }, T)).toBe("POLICY_DEPLOYMENT");
    expect(run({ policyDigest: DIGEST, checkedAt: "2026-10-04 19:00:00" }, T)).toBe("POLICY_DEPLOYMENT");
    expect(run({ policyDigest: DIGEST }, T)).toBe("POLICY_DEPLOYMENT");
  });
});
