import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { kernel } from "./fixtures.ts";
import { taskState } from "../../src/forge/state.ts";

// Forge checks its own process artifacts with the boundary rule from FORGE-CORE-0001A §6:
// bytes are decoded with fatal UTF-8 and ignoreBOM, so a BOM stays visible to the kernel.

const decode = (path: string) => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(readFileSync(path));
const ROOT = new URL("../../", import.meta.url).pathname;

const forgeContracts = readdirSync(join(ROOT, "forge/contracts")).filter((name) => name.startsWith("FORGE-CORE-"));
const approvals = readdirSync(join(ROOT, "forge/approvals")).filter((name) => name.endsWith(".json"));

function parsed(name: string) {
  const result = kernel.parseContractDocument(decode(join(ROOT, "forge/contracts", name)));
  if (!result.ok) throw new Error(`${name}: ${JSON.stringify(result.issues)}`);
  return result.document;
}

describe("Forge contracts in this repository", () => {
  it("FORGE-CORE-0001A exists", () => {
    expect(forgeContracts).toContain("FORGE-CORE-0001A.md");
  });

  it.each(forgeContracts)("%s parses in its own format", (name) => {
    const document = parsed(name);
    expect(`${document.ref.taskId}.md`).toBe(name);
  });

  it.each(approvals)("approval record %s is bound to the exact contract text", (name) => {
    const record = JSON.parse(decode(join(ROOT, "forge/approvals", name)));
    const document = parsed(`${record.taskId}.md`);
    expect(name).toBe(`${record.taskId}.v${record.contractVersion}.${record.gate}.json`);
    expect(record.contractVersion).toBe(document.ref.contractVersion);
    expect(record.contentHash).toBe(document.ref.contentHash);
    expect(record.verdict).toBe("approved");
    expect(record.actor.actorType).toBe("human");
  });

  it("every file under src/forge and tests/forge is in the scope of a Forge contract", () => {
    const scope = new Set(forgeContracts.flatMap((name) => [...parsed(name).metadata.scope.create, ...parsed(name).metadata.scope.modify]));
    const files = ["src/forge", "tests/forge"].flatMap((dir) => readdirSync(join(ROOT, dir)).map((file) => `${dir}/${file}`));
    expect(files.filter((file) => !scope.has(file))).toEqual([]);
  });

  it("the pilot TASK-0004 contract (YAML with status fields) is not a valid Forge contract", () => {
    const result = kernel.parseContractDocument(decode(join(ROOT, "forge/contracts/TASK-0004.md")));
    expect(!result.ok && result.issues.map((issue) => issue.code)).toEqual(["FRONTMATTER_MISSING"]);
  });
});

// ---------- Phase 8: replay this night's real FORGE-CORE history through the kernel ----------
// Git facts below were witnessed with `git rev-list --parents` and `git diff --name-status`
// on 2026-10-02 and are recorded as observations, exactly as the design prescribes.

const C = {
  base0001A: "e9cb8e23c765deee5fab2d16bc0b793f53708714",
  contract0001A: "ce81ce831bc888ea2d4def02cff376450052f1fa",
  cp1: "fc65f76b8d6f939dcf7a8a7d03c0af1fdbd07e85",
  impl0001A: "8cae4ccaec11f4fe693a496987e3ab31bd05dad0",
  cp2: "ede729f7de592c7e2da7d64cd65f627d2461b492",
  contract0001B: "e1df55a13cfd75c0188f78f4ab79079c02e6666b",
  impl0001B: "8230f1d4312ce6f256a5547a34efa978fa8276d2",
  cp3: "8894476a95cdd2b8d63df2571ce8471b6f08de58",
  hardening: "4202e2bef6bef39beeaef28a8e5f48122792d6d0",
};
const PARENTS: Record<string, string[]> = {
  [C.contract0001A]: [C.base0001A],
  [C.cp1]: [C.contract0001A],
  [C.impl0001A]: [C.cp1],
  [C.cp2]: [C.impl0001A],
  [C.contract0001B]: [C.cp2],
  [C.impl0001B]: [C.contract0001B],
  [C.cp3]: [C.impl0001B],
  [C.hardening]: [C.cp3],
};
const BRANCH = "claude/forge-architecture-review-hjdq89";
const OWNER = { actorType: "human", provider: "human", model: null, label: "owner" };
const CLAUDE = { actorType: "ai_agent", provider: "anthropic", model: null, label: "night-run developer session" };
const ev = (actor: object, role: string, body: object) => ({ actor, role, recordedAt: "2026-10-02", body });
const added = (paths: string[]) => paths.map((path) => ({ path, change: "added" }));
const modified = (paths: string[]) => paths.map((path) => ({ path, change: "modified" }));
const detected = (names: string[]) =>
  names.map((name) => ({ name, description: `mutation smoke ${name}`, outcome: "detected", classification: "must_detect", equivalenceRationale: null }));
const CHECKS = [
  { name: "typecheck", command: "npm run typecheck", exitCode: 0 },
  { name: "test", command: "npm test", exitCode: 0 },
];

function nightLog() {
  const doc = (task: string) => parsed(`${task}.md`);
  const a = doc("FORGE-CORE-0001A");
  const b = doc("FORGE-CORE-0001B");
  const register = (task: string, commit: string, d: ReturnType<typeof doc>) => [
    ev(OWNER, "owner", { type: "task_registered", taskId: task, title: task }),
    ev(CLAUDE, "spec_author", { type: "contract_registered", taskId: task, contractPath: `forge/contracts/${task}.md`, contractCommit: commit, contractText: d.text, declaredContentHash: d.ref.contentHash }),
    ev(OWNER, "architecture_reviewer", { type: "approval_recorded", taskId: task, contentHash: d.ref.contentHash, gate: "architecture_review", verdict: "approved", findings: [] }),
  ];
  const run = (task: string, runId: string, d: ReturnType<typeof doc>, contractCommit: string, headAtStart: string, result: string, changedFiles: object[], mutations: object[]) => [
    ev(CLAUDE, "developer", {
      type: "run_started", runId, taskId: task, contentHash: d.ref.contentHash,
      repoObservation: { refs: { [BRANCH]: headAtStart }, parents: PARENTS, contractAtCommit: { commit: contractCommit, path: `forge/contracts/${task}.md`, contentHash: d.ref.contentHash } },
    }),
    ev(CLAUDE, "developer", { type: "developer_report_recorded", runId, report: { claimedResultCommit: result, claimedRemoteRef: BRANCH, commandsRun: CHECKS.map(({ command, exitCode }) => ({ command, exitCode })), mutations, deviations: [], knownLimitations: [], reviewHints: [] } }),
    ev({ actorType: "system", provider: "git", model: null, label: "ls-remote" }, "observer", { type: "remote_observed", runId, ref: BRANCH, head: C.hardening, parents: PARENTS }),
    ev(CLAUDE, "verifier", { type: "verification_recorded", evidence: { runId, verifiedCommit: result, method: "fresh_clone", changedFiles, checks: CHECKS, mutations: null } }),
  ];
  const mutationsA = detected([...Array.from({ length: 35 }, (_, i) => `M${String(i + 1).padStart(2, "0")}`)]);
  const mutationsB = [
    ...detected(Array.from({ length: 28 }, (_, i) => `B${String(i + 1).padStart(2, "0")}`).filter((n) => n !== "B22")),
    { name: "B22", description: "accepted commit via claimed instead of verified commit", outcome: "survived", classification: "equivalent", equivalenceRationale: "verification_recorded rejects verifiedCommit != claimedResultCommit, so both are equal for every acceptable run" },
  ];
  return [
    ...register("FORGE-CORE-0001A", C.contract0001A, a),
    // literal `git diff --name-status ce81ce8 8cae4cc`
    ...run("FORGE-CORE-0001A", "run:core-0001a-1", a, C.contract0001A, C.cp1, C.impl0001A, added([
      "forge/coordination/CLAUDE.md", "src/forge/ancestry.ts", "src/forge/contract-document.ts", "src/forge/events.ts",
      "src/forge/freeze.ts", "src/forge/identity.ts", "src/forge/kernel.ts", "src/forge/node-sha256.ts", "src/forge/primitives.ts",
      "src/forge/start-gate.ts", "src/forge/state.ts", "tests/forge/ancestry.test.ts", "tests/forge/contract-document.test.ts",
      "tests/forge/dogfood.test.ts", "tests/forge/fixtures.ts", "tests/forge/identity.test.ts", "tests/forge/kernel.test.ts",
      "tests/forge/start-gate.test.ts", "tests/forge/state.test.ts", "tests/forge/typecheck.ts",
    ]), mutationsA),
    ...register("FORGE-CORE-0001B", C.contract0001B, b),
    // literal `git diff --name-status e1df55a 8230f1d`
    ...run("FORGE-CORE-0001B", "run:core-0001b-1", b, C.contract0001B, C.contract0001B, C.impl0001B, [
      ...added([
        "src/forge/runs.ts", "src/forge/verification.ts", "tests/forge/review-acceptance.test.ts", "tests/forge/run-fixtures.ts",
        "tests/forge/runs.test.ts", "tests/forge/scenarios.test.ts", "tests/forge/verification.test.ts",
      ]),
      ...modified(["src/forge/events.ts", "src/forge/kernel.ts", "src/forge/start-gate.ts", "src/forge/state.ts", "tests/forge/start-gate.test.ts", "tests/forge/state.test.ts", "tests/forge/typecheck.ts"]),
    ], mutationsB),
  ];
}

describe("night replay of FORGE-CORE-0001A/B (dogfood)", () => {
  it("the kernel accepts this night's real history; both tasks wait for an independent code review", async () => {
    const { taskState, runState, verificationOf } = await import("../../src/forge/state.ts");
    const result = kernel.replay(nightLog());
    if (!result.ok) throw new Error(`rejected event ${result.index}: ${JSON.stringify(result.rejection)}`);
    const state = result.state;
    for (const [task, runId] of [["FORGE-CORE-0001A", "run:core-0001a-1"], ["FORGE-CORE-0001B", "run:core-0001b-1"]] as const) {
      expect(runState(state, runId)).toBe("verified");
      expect(verificationOf(state, runId)!.passed).toBe(true);
      expect(taskState(state, task)).toBe("awaiting_review");
    }
  });

  it("a hypothetical file outside the 0001A scope would have failed verification", () => {
    const log = nightLog();
    const verification = log[6] as { body: { evidence: { changedFiles: object[] } } };
    verification.body.evidence.changedFiles.push({ path: "src/domain/case-truth.ts", change: "modified" });
    const result = kernel.replay(log);
    expect(result.ok).toBe(true);
    if (result.ok) expect(taskState(result.state, "FORGE-CORE-0001A")).toBe("ready");
  });

  it("the developer cannot review its own work, so the night cannot end in accepted", async () => {
    const result = kernel.replay(nightLog());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const selfReview = ev(CLAUDE, "code_reviewer", {
      type: "code_review_recorded", runId: "run:core-0001b-1", reviewedCommit: C.impl0001B, verdict: "approve", requires: null, findings: [], acknowledgedEquivalentMutations: ["B22"],
    });
    const rejected = kernel.applyEvent(result.state, selfReview);
    expect(!rejected.ok && rejected.rejection.code).toBe("REVIEWER_NOT_INDEPENDENT");
  });
});
