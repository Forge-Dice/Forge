import { describe, expect, it } from "vitest";
import { ForgeEventSchema } from "../../src/forge/events.ts";
import { runState, taskState, type ForgeState } from "../../src/forge/state.ts";
import { contractText, event, kernel, unfrozenPaths } from "../forge/fixtures.ts";
import { emptyModel, refAcceptedCommit, refApply, refContractHash, refEffectiveMutations, refRunState, refTaskState, type ModelState } from "./model.ts";

// Red-team fuzzing of FORGE-CORE-0001A/B (test-only, no production change).
// A deterministic, state-guided generator produces long histories over several tasks with
// dependencies (including a dependency cycle), several contract versions, adversarial
// observations, evidence and identities. Every candidate event is decided by the kernel AND by
// an independent reference model (red-team.model.ts); both decisions and all derived states
// must agree. Metamorphic properties are checked on top.

function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex40 = (tag: string, n: number) => tag + n.toString(16).padStart(39, "0");

// T3 depends on T1; T4 depends on T2 and T3; T5 <-> T6 is a dependency cycle (never approvable).
const DEPS: Record<string, string[]> = {
  "TASK-0001": [],
  "TASK-0002": [],
  "TASK-0003": ["TASK-0001"],
  "TASK-0004": ["TASK-0002", "TASK-0003"],
  "TASK-0005": ["TASK-0006"],
  "TASK-0006": ["TASK-0005"],
};
const TASK_IDS = Object.keys(DEPS);
const taskIndex = (t: string) => TASK_IDS.indexOf(t) + 1;

const ID = {
  author: { actorType: "ai_agent", provider: "vendor-a", model: null, label: "spec-author" },
  authorRelabelled: { actorType: "ai_agent", provider: "vendor-a", model: null, label: "spec-author-2" },
  architect: { actorType: "ai_agent", provider: "vendor-b", model: "m1", label: "architect" },
  sameProviderArchitect: { actorType: "ai_agent", provider: "vendor-a", model: "m2", label: "architect" },
  alice: { actorType: "human", provider: "human", model: null, label: "alice" },
  sys: { actorType: "system", provider: "forge", model: null, label: "forge" },
  dev: { actorType: "ai_agent", provider: "vendor-a", model: null, label: "developer" },
  dev2: { actorType: "ai_agent", provider: "vendor-c", model: null, label: "developer" },
  codeReviewer: { actorType: "ai_agent", provider: "vendor-b", model: null, label: "code-reviewer" },
  sameProviderReviewer: { actorType: "ai_agent", provider: "vendor-a", model: null, label: "code-reviewer" },
  owner: { actorType: "human", provider: "human", model: null, label: "owner" },
  aiOwner: { actorType: "ai_agent", provider: "vendor-b", model: null, label: "owner" },
} as const;

const REFS = ["claude/branch", "constructor", "a/b.c", "x.lock", "-"];

type Gen = { rnd: () => number; runN: number };
const pick = <T>(g: Gen, xs: readonly T[]): T => xs[Math.floor(g.rnd() * xs.length)]!;
const chance = (g: Gen, p: number) => g.rnd() < p;

function contractCommitOf(taskId: string, version: number) {
  return hex40("c", taskIndex(taskId) * 1000 + version);
}
function baseCommitOf(taskId: string, version: number) {
  return hex40("b", taskIndex(taskId) * 1000 + version);
}

function newContract(g: Gen, m: ModelState, taskId: string, version: number) {
  const deps = DEPS[taskId]!.map((dep) => {
    const accepted = refAcceptedCommit(m, dep);
    const roll = g.rnd();
    const acceptedCommit = roll < 0.75 ? (accepted ?? (chance(g, 0.5) ? null : hex40("d", 4095))) : roll < 0.88 ? null : hex40("d", Math.floor(g.rnd() * 50));
    return { taskId: dep, acceptedCommit };
  });
  const meta = {
    forgeContractFormat: 1,
    taskId,
    contractVersion: version,
    baseCommit: baseCommitOf(taskId, version),
    dependencies: deps,
    scope: { create: ["src/a.ts"], modify: ["src/b.ts"] },
    requiredChecks: [{ name: "test", command: "npm test" }],
    mutationSmoke: pick(g, ["none", "optional", "required"] as const),
  };
  const text = contractText(meta, chance(g, 0.1) ? "" : "# body\n--- not a delimiter\n---\n");
  const hash = refContractHash(text);
  const declared = chance(g, 0.04) ? "0".repeat(64) : hash;
  const path = chance(g, 0.03) ? `forge/contracts/${taskId}.MD` : `forge/contracts/${taskId}.md`;
  return event(chance(g, 0.03) ? ID.dev : ID.author, chance(g, 0.02) ? "owner" : "spec_author", {
    type: "contract_registered",
    taskId,
    contractPath: path,
    contractCommit: contractCommitOf(taskId, version),
    contractText: text,
    declaredContentHash: declared,
  });
}

function startObservation(g: Gen, m: ModelState, taskId: string, version: number, hash: string, meta: { dependencies: { acceptedCommit: string | null }[] }) {
  const c = contractCommitOf(taskId, version);
  const b = baseCommitOf(taskId, version);
  const depCommits = meta.dependencies.map((d) => d.acceptedCommit).filter((x): x is string => x !== null);
  const parents: Record<string, string[]> = { [c]: [b], [b]: [hex40("a", 0), ...depCommits] };
  const ref = pick(g, REFS);
  let refs: Record<string, string> = { [ref]: c };
  let path = `forge/contracts/${taskId}.md`;
  let contentHash = hash;
  let commit = c;
  const roll = g.rnd();
  if (roll < 0.05) refs = {};
  else if (roll < 0.1) delete parents[c];
  else if (roll < 0.14) parents[b] = [hex40("a", 0)]; // dependency edges missing
  else if (roll < 0.18) contentHash = "0".repeat(64);
  else if (roll < 0.2) path = `forge/contracts/${taskId}.txt`;
  else if (roll < 0.22) commit = hex40("f", 1);
  else if (roll < 0.3) parents[hex40("a", 0)] = [c]; // cycle through witnessed edges
  else if (roll < 0.36) refs = { [hex40("e", 1).slice(0, 10)]: hex40("f", 2), [ref]: c }; // extra unrelated ref
  else if (roll < 0.4) {
    // contract commit only reachable through the second parent of a merge
    const merge = hex40("e", 9000 + g.runN);
    parents[merge] = [hex40("f", 3), c];
    refs = { [ref]: merge };
  }
  void m;
  return { refs, parents, contractAtCommit: { commit, path, contentHash } };
}

const mut = (name: string, outcome: string, classification = "must_detect", rationale: string | null = null) => ({
  name,
  description: `mutant ${name}`,
  outcome,
  classification,
  equivalenceRationale: rationale,
});

function mutationList(g: Gen) {
  if (chance(g, 0.5)) return pick(g, [[], [mut("m1", "detected"), mut("eq", "survived", "equivalent", "same behaviour")]]);
  return pick(g, [
    [],
    [mut("m1", "detected")],
    [mut("m1", "detected"), mut("eq", "survived", "equivalent", "same behaviour")],
    [mut("m1", "survived")],
    [mut("m1", "not_applied")],
    [mut("eq", "detected", "equivalent", "x")],
    [mut("eq", "survived", "equivalent", null)],
    [mut("m1", "detected"), mut("m1", "detected")],
    [mut("eq", "not_applied", "equivalent", "x")],
    [mut("m1", "detected", "must_detect", "why")],
  ]);
}

function evidenceFor(g: Gen, runId: string, claimed: string) {
  const changed = chance(g, 0.65) ? [{ path: "src/a.ts", change: "added" }] : pick(g, [
    [{ path: "src/a.ts", change: "added" }],
    [{ path: "src/b.ts", change: "modified" }, { path: "forge/coordination/CLAUDE.md", change: "modified" }],
    [],
    [{ path: "src/a.ts", change: "modified" }],
    [{ path: "src/b.ts", change: "deleted" }],
    [{ path: "forge/contracts/TASK-0001.md", change: "modified" }],
    [{ path: "forge/approvals/x.json", change: "added" }],
    [{ path: "forge/coordination/TASK-0001.md", change: "renamed" }],
    [{ path: "forge/coordinationX/a", change: "added" }],
  ]);
  const checks = chance(g, 0.65) ? [{ name: "test", command: "npm test", exitCode: 0 }] : pick(g, [
    [{ name: "test", command: "npm test", exitCode: 0 }],
    [{ name: "test", command: "npm test", exitCode: 1 }],
    [{ name: "test", command: "npm  test", exitCode: 0 }],
    [{ name: "tests", command: "npm test", exitCode: 0 }],
    [{ name: "test", command: "npm test", exitCode: 1 }, { name: "test", command: "npm test", exitCode: 0 }],
    [{ name: "test", command: "npm test", exitCode: -1 }, { name: "lint", command: "x", exitCode: 0 }],
  ]);
  return {
    runId,
    verifiedCommit: chance(g, 0.05) ? hex40("f", 5) : claimed,
    method: "fresh_clone",
    changedFiles: changed,
    checks,
    mutations: chance(g, 0.6) ? null : mutationList(g),
  };
}

/** One state-guided candidate (85%) or noise (15%). The model provides guidance only. */
function nextEvent(g: Gen, m: ModelState): unknown {
  const taskId = pick(g, TASK_IDS);
  const t = m.tasks.find((x) => x.taskId === taskId);
  if (t === undefined) return event(chance(g, 0.05) ? ID.dev : ID.owner, chance(g, 0.05) ? "developer" : "owner", { type: "task_registered", taskId, title: `Task ${taskId}` });
  const ts = refTaskState(m, taskId);
  const cur = t.versions.at(-1);
  const nextVersion = (cur?.meta.contractVersion ?? 0) + (chance(g, 0.03) ? 2 : 1);
  const noise = chance(g, 0.1);
  if (ts === "planned" || ts === "contract_revision_required" || (noise && chance(g, 0.3))) return newContract(g, m, taskId, nextVersion);
  const hash = cur!.hash;
  if (ts === "specifying" || (noise && chance(g, 0.2))) {
    if (chance(g, 0.05) && ts === "specifying") return newContract(g, m, taskId, nextVersion);
    const verdict = chance(g, 0.75) ? "approved" : "changes_requested";
    const reviewer = pick(g, [ID.architect, ID.architect, ID.alice, ID.sameProviderArchitect, ID.sys, ID.author, ID.authorRelabelled]);
    const findings = verdict === "changes_requested" && chance(g, 0.9) ? [{ severity: "blocking", summary: "fix", location: null }] : chance(g, 0.1) ? [{ severity: "blocking", summary: "odd", location: "x" }] : [];
    const target = chance(g, 0.08) && t.versions.length > 1 ? t.versions[0]!.hash : hash;
    return event(reviewer, "architecture_reviewer", { type: "approval_recorded", taskId, contentHash: target, gate: "architecture_review", verdict, findings });
  }
  if (ts === "ready" || ts === "rework_required" || (noise && chance(g, 0.3))) {
    const version = chance(g, 0.06) && t.versions.length > 1 ? t.versions[0]! : cur!;
    const runId = chance(g, 0.03) && m.runs.length > 0 ? m.runs[0]!.runId : `run:g${g.runN}`;
    const otherTask = chance(g, 0.03) ? pick(g, TASK_IDS) : taskId;
    return event(pick(g, [ID.dev, ID.dev, ID.dev2]), "developer", {
      type: "run_started",
      runId,
      taskId: otherTask,
      contentHash: version.hash,
      repoObservation: startObservation(g, m, taskId, version.meta.contractVersion, version.hash, version.meta),
    });
  }
  const runsOfTask = m.runs.filter((r) => r.taskId === taskId);
  const r = chance(g, 0.9) ? runsOfTask.at(-1) : pick(g, m.runs);
  if (r === undefined) return newContract(g, m, taskId, nextVersion);
  const rs = refRunState(m, r.runId);
  const claimed = r.report?.claimedResultCommit ?? hex40("d", 1);
  const resultOf = (id: string) => hex40("d", Number.parseInt(id.slice(5), 10) + 1);
  if (ts === "implementing" || noise) {
    if (chance(g, 0.07)) {
      return chance(g, 0.5)
        ? event(pick(g, [ID.dev, ID.dev2, ID.owner]), chance(g, 0.8) ? "developer" : "owner", { type: "run_failed", runId: r.runId, code: "PUSH_REJECTED", detail: "403" })
        : event(ID.owner, "owner", { type: "run_abandoned", runId: r.runId, reason: "WORKER_LOST", detail: "lost" });
    }
    if (rs === "running") {
      const result = chance(g, 0.92) ? resultOf(r.runId) : hex40("f", 4);
      return event(chance(g, 0.92) ? r.dev : ID.dev2, "developer", {
        type: "developer_report_recorded",
        runId: r.runId,
        report: { claimedResultCommit: result, claimedRemoteRef: pick(g, REFS), commandsRun: [], mutations: mutationList(g), deviations: [], knownLimitations: [], reviewHints: [] },
      });
    }
    if (rs === "reported" || (noise && chance(g, 0.3))) {
      const later = hex40("e", Number.parseInt(r.runId.slice(5), 10) + 1);
      const parents: Record<string, string[]> = { [later]: [claimed], [claimed]: [r.start] };
      let ref = r.report?.claimedRemoteRef ?? "claude/branch";
      let head: string | null = chance(g, 0.5) ? claimed : later;
      const roll = g.rnd();
      if (roll < 0.15) head = null;
      else if (roll < 0.22) head = hex40("f", 6);
      else if (roll < 0.3) ref = pick(g, REFS);
      else if (roll < 0.36) delete parents[claimed];
      else if (roll < 0.4) parents[r.start] = [later]; // cycle
      else if (roll < 0.45) head = r.start; // remote head went backwards
      return event(pick(g, [ID.sys, ID.dev]), "observer", { type: "remote_observed", runId: r.runId, ref, head, parents });
    }
    return event(pick(g, [ID.dev, ID.sys, ID.alice]), "verifier", { type: "verification_recorded", evidence: evidenceFor(g, r.runId, claimed) });
  }
  if (ts === "awaiting_review" || chance(g, 0.3)) {
    const verifiedRuns = runsOfTask.filter((x) => refRunState(m, x.runId) === "verified");
    const lr = (chance(g, 0.15) ? verifiedRuns[0] : verifiedRuns.at(-1)) ?? r; // sometimes an older run
    const verdict = chance(g, 0.45) ? "approve" : "request_changes";
    const requires = verdict === "approve" ? (chance(g, 0.05) ? "code_change" : null) : chance(g, 0.05) ? null : pick(g, ["code_change", "contract_change"]);
    const findings = verdict === "approve" ? (chance(g, 0.1) ? [{ severity: "blocking", summary: "b", location: null }] : chance(g, 0.2) ? [{ severity: "non_blocking", summary: "nit", location: null }] : []) : chance(g, 0.05) ? [] : [{ severity: "blocking", summary: "fix", location: null }];
    let ack: string[] = [];
    if (lr.verification !== null) {
      const v = m.tasks.find((x) => x.taskId === lr.taskId)!.versions.find((x) => x.hash === lr.hash)!;
      ack = refEffectiveMutations(v.meta, lr).filter((x) => x.classification === "equivalent").map((x) => x.name);
    }
    const ackRoll = g.rnd();
    if (ackRoll < 0.05) ack = [...ack, "ghost"];
    else if (ackRoll < 0.1) ack = ack.slice(1);
    else if (ackRoll < 0.15) ack = [...ack].reverse();
    return event(pick(g, [ID.codeReviewer, ID.codeReviewer, ID.alice, ID.sameProviderReviewer, ID.sys, ID.dev]), "code_reviewer", {
      type: "code_review_recorded",
      runId: lr.runId,
      reviewedCommit: chance(g, 0.05) ? hex40("f", 7) : (lr.verification?.verifiedCommit ?? claimed),
      verdict,
      requires,
      findings,
      acknowledgedEquivalentMutations: ack,
    });
  }
  const verifiedRuns = runsOfTask.filter((x) => refRunState(m, x.runId) === "verified");
  const lr = (chance(g, 0.15) ? verifiedRuns[0] : verifiedRuns.at(-1)) ?? r;
  return event(chance(g, 0.85) ? ID.owner : ID.aiOwner, "owner", { type: "task_accepted", taskId, runId: lr.runId });
}

const typeOf = (e: unknown) => (e as { body: { type: string } }).body.type;

/** Maps every ref name through a bijection (task identity must never come from ref names). */
function renameRefs(e: unknown): unknown {
  const f = (name: string) => `zz/${name}`.replace("//", "/x/");
  const copy = structuredClone(e) as { body: Record<string, any> };
  const b = copy.body;
  if (b.type === "run_started") b.repoObservation.refs = Object.fromEntries(Object.entries(b.repoObservation.refs).reverse().map(([k, v]) => [f(k), v]));
  if (b.type === "developer_report_recorded") b.report.claimedRemoteRef = f(b.report.claimedRemoteRef);
  if (b.type === "remote_observed") b.ref = f(b.ref);
  // permute parent key order as well (key order must never matter)
  for (const holder of [b.repoObservation, b]) {
    if (holder?.parents) holder.parents = Object.fromEntries(Object.entries(holder.parents).reverse());
  }
  return copy;
}

type Coverage = { taskStates: Map<string, number>; runStates: Map<string, number>; rejections: Map<string, number>; accepted: Map<string, number> };
const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);

function runHistory(seed: number, steps: number, cov: Coverage) {
  const g: Gen = { rnd: prng(seed), runN: 0 };
  const model = emptyModel();
  let state: ForgeState = kernel.emptyState();
  let renamed: ForgeState = kernel.emptyState();
  const log: unknown[] = [];
  const disagreements: string[] = [];
  for (let i = 0; i < steps; i++) {
    const candidate = nextEvent(g, model);
    if (typeOf(candidate) === "run_started") g.runN++;
    const result = kernel.applyEvent(state, candidate);
    const schemaOk = ForgeEventSchema.safeParse(candidate).success;
    const modelOk = schemaOk && refApply(model, candidate as never);
    if (result.ok !== modelOk) {
      disagreements.push(`seed ${seed} step ${i} ${typeOf(candidate)}: kernel=${result.ok ? "accept" : result.rejection.code} model=${modelOk}`);
      break;
    }
    // metamorphic: renaming refs and permuting key order changes no decision
    const renamedResult = kernel.applyEvent(renamed, renameRefs(candidate));
    expect(renamedResult.ok).toBe(result.ok);
    if (!result.ok) {
      bump(cov.rejections, result.rejection.code);
      // apply and replay reject identically
      const replayed = kernel.replay([...log, candidate]);
      expect(replayed.ok).toBe(false);
      expect(!replayed.ok && replayed.index).toBe(log.length);
      expect(!replayed.ok && replayed.rejection).toEqual(result.rejection);
      continue;
    }
    if (!renamedResult.ok) throw new Error("unreachable");
    const before = state;
    state = result.state;
    renamed = renamedResult.state;
    log.push(candidate);
    bump(cov.accepted, typeOf(candidate));
    // accepted is terminal: an accepted task's record and its runs never change again
    for (const task of before.tasks) {
      if (task.acceptance === null) continue;
      const after = state.tasks.find((x) => x.taskId === task.taskId)!;
      expect(after).toEqual(task);
      expect(state.runs.filter((r) => r.taskId === task.taskId)).toEqual(before.runs.filter((r) => r.taskId === task.taskId));
    }
    for (const task of state.tasks) {
      const ts = taskState(state, task.taskId)!;
      bump(cov.taskStates, ts);
      expect(ts).toBe(refTaskState(model, task.taskId));
      expect(taskState(renamed, task.taskId)).toBe(ts);
      const runs = state.runs.filter((r) => r.taskId === task.taskId);
      expect(runs.filter((r) => !["verified", "failed", "abandoned"].includes(runState(state, r.runId)!)).length).toBeLessThanOrEqual(1);
      if (ts === "review_approved" || ts === "accepted") {
        const r = ts === "accepted" ? state.runs.find((x) => x.runId === task.acceptance!.runId)! : runs.filter((x) => runState(state, x.runId) === "verified").at(-1)!;
        expect(runState(state, r.runId)).toBe("verified");
        expect(r.verdict?.verdict).toBe("approve");
        expect(r.verdict!.reviewedCommit).toBe(r.verification!.evidence.verifiedCommit);
        expect(r.verification!.evidence.verifiedCommit).toBe(r.report!.claimedResultCommit);
      }
      if (ts === "accepted") expect(task.acceptance!.owner.actorType).toBe("human");
      if (ts === "ready") {
        const cur = task.contracts.at(-1)!;
        expect(cur.decisions.some((d) => d.verdict === "approved")).toBe(true);
        for (const dep of cur.metadata.dependencies) expect(refAcceptedCommit(model, dep.taskId)).toBe(dep.acceptedCommit);
      }
    }
    for (const r of state.runs) {
      const rs = runState(state, r.runId)!;
      bump(cov.runStates, rs);
      expect(rs).toBe(refRunState(model, r.runId));
      expect(runState(renamed, r.runId)).toBe(rs);
      // every run references a registered, approved revision of its own task
      const revision = state.tasks.find((t) => t.taskId === r.taskId)!.contracts.find((c) => c.ref.contentHash === r.contract.contentHash)!;
      expect(revision.decisions.some((d) => d.verdict === "approved")).toBe(true);
      if (r.verification !== null) expect(r.observations.length).toBeGreaterThan(0);
    }
  }
  expect(disagreements).toEqual([]);
  const replayed = kernel.replay(log);
  expect(replayed.ok && replayed.state).toEqual(state);
  expect(unfrozenPaths(state)).toEqual([]);
  return log.length;
}

describe("red team: differential fuzzing against an independent reference model", () => {
  const cov: Coverage = { taskStates: new Map(), runStates: new Map(), rejections: new Map(), accepted: new Map() };
  let acceptedEvents = 0;

  it.each(Array.from({ length: 30 }, (_, i) => i + 1))("seed %i: kernel and reference model agree on every decision and state", (seed) => {
    acceptedEvents += runHistory(seed, 300, cov);
  });

  it("the generator reaches every task state, run state, event type and the main rejection codes", () => {
    expect(acceptedEvents).toBeGreaterThan(2000);
    if (process.env.RED_TEAM_COVERAGE) console.log(JSON.stringify({ acceptedEvents, ...Object.fromEntries(Object.entries(cov).map(([k, v]) => [k, Object.fromEntries(v)])) }));
    for (const s of ["planned", "specifying", "ready", "implementing", "awaiting_review", "review_approved", "rework_required", "contract_revision_required", "accepted"]) {
      expect(cov.taskStates.get(s) ?? 0, `task state ${s}`).toBeGreaterThan(0);
    }
    for (const s of ["running", "reported", "remote_verified", "verified", "failed", "abandoned"]) expect(cov.runStates.get(s) ?? 0, `run state ${s}`).toBeGreaterThan(0);
    for (const t of ["task_registered", "contract_registered", "approval_recorded", "run_started", "developer_report_recorded", "remote_observed", "verification_recorded", "run_failed", "run_abandoned", "code_review_recorded", "task_accepted"]) {
      expect(cov.accepted.get(t) ?? 0, `accepted ${t}`).toBeGreaterThan(0);
    }
    for (const code of [
      "ROLE_NOT_ALLOWED", "TASK_ALREADY_ACCEPTED", "TASK_STATE_INVALID", "CONTRACT_HASH_MISMATCH", "CONTRACT_PATH_MISMATCH", "CONTRACT_VERSION_NOT_NEXT",
      "CONTRACT_SUPERSEDED", "APPROVAL_ALREADY_DECIDED", "REVIEWER_NOT_INDEPENDENT", "FINDINGS_REQUIRED", "DEPENDENCY_UNRESOLVED", "DEPENDENCY_NOT_ACCEPTED",
      "DEPENDENCY_MISMATCH", "START_NOT_ALLOWED", "RUN_ALREADY_EXISTS", "RUN_STATE_INVALID", "ACTOR_NOT_RUN_DEVELOPER", "VERIFIED_COMMIT_MISMATCH",
      "RUN_NOT_LATEST_VERIFIED", "REVIEW_ALREADY_RECORDED", "REVIEWED_COMMIT_MISMATCH", "VERDICT_INCONSISTENT", "EQUIVALENT_MUTATIONS_NOT_ACKNOWLEDGED", "OWNER_NOT_HUMAN",
    ]) {
      expect(cov.rejections.get(code) ?? 0, `rejection ${code}`).toBeGreaterThan(0);
    }
  });
});
