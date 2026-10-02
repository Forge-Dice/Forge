import { describe, expect, it } from "vitest";
import { runState, taskState, type ForgeState } from "../../src/forge/state.ts";
import { ai, contractText, decide, hashOf, human, kernel, metadata, registerContract, registerTask, stateOf, unfrozenPaths } from "./fixtures.ts";
import {
  RESULT,
  SHA,
  abandon,
  accept,
  approvedTask,
  contractFor,
  fail,
  mutation,
  observe,
  reportFor,
  review,
  runGraph,
  startRun,
  verifiedRun,
  verify,
} from "./run-fixtures.ts";

const stepwise = (events: readonly unknown[]): ForgeState => {
  let state = kernel.emptyState();
  for (const [i, e] of events.entries()) {
    const result = kernel.applyEvent(state, e);
    if (!result.ok) throw new Error(`event ${i} rejected: ${result.rejection.code}`);
    state = result.state;
  }
  return state;
};

/** Full lifecycle of one task, used as building block for long logs. */
function lifecycle(taskId: string, seed: number): unknown[] {
  const { text, contentHash } = contractFor({ taskId });
  const runId = (n: number) => `run:${taskId.toLowerCase()}-${n}`;
  const start = (n: number) => startRun(runId(n), { taskId, contentHash, obs: { refs: { "b": SHA.head }, parents: runGraph(), contractAtCommit: { commit: SHA.contract, path: `forge/contracts/${taskId}.md`, contentHash } } });
  const events: unknown[] = [registerTask(taskId), registerContract(text, { taskId }), decide(contentHash, "approved", { taskId })];
  // run 1: push rejected, retried, then failed explicitly
  events.push(start(1), reportFor(runId(1)), observe(runId(1), { head: null }), fail(runId(1)));
  // run 2: verified, rework requested
  events.push(start(2), reportFor(runId(2)), observe(runId(2), { head: SHA.contract }), observe(runId(2)), verify(runId(2)));
  events.push(review(runId(2), "request_changes"));
  // run 3: verified and accepted (every other task leaves it at review_approved)
  events.push(start(3), reportFor(runId(3)), observe(runId(3)), verify(runId(3)), review(runId(3), "approve"));
  if (seed % 2 === 0) events.push(accept(runId(3), undefined, taskId));
  return events;
}

describe("pilot scenarios", () => {
  it("[observed O8] TASK-0001: 403 push, work only local, later pushed, verified, accepted", () => {
    const { events } = approvedTask();
    const log = [
      ...events,
      startRun("run:0001-1"),
      reportFor("run:0001-1", { claimedRemoteRef: "forge/task-0001-case-truth" }),
      observe("run:0001-1", { ref: "forge/task-0001-case-truth", head: null }), // 403 on the task branch
    ];
    expect(runState(stateOf(log), "run:0001-1")).toBe("reported");
    // The pilot then pushed to another branch: in V0.0 that is a new run with its own claimed ref.
    const switched = [...log, fail("run:0001-1", "PUSH_REJECTED"), startRun("run:0001-2"), reportFor("run:0001-2", { claimedRemoteRef: "claude/session" })];
    const final = [...switched, observe("run:0001-2", { ref: "claude/session" }), verify("run:0001-2"), review("run:0001-2", "approve"), accept("run:0001-2")];
    const state = stateOf(final);
    expect(taskState(state, "TASK-0001")).toBe("accepted");
    expect(runState(state, "run:0001-1")).toBe("failed");
  });

  it("[observed O7] TASK-0004: contradictory frontmatter cannot even be registered", () => {
    const bad = contractText({ ...metadata(), status: "approved", architecture_review: "pending_chatgpt_final_check" });
    const result = kernel.applyEvent(stateOf([registerTask()]), registerContract(bad, { declared: "0".repeat(64) }));
    expect(!result.ok && result.rejection.code).toBe("CONTRACT_DOCUMENT_INVALID");
  });

  it("[observed O10] TASK-0004 P2: a surviving must_detect mutant fails verification; a fixed rerun passes", () => {
    const { events, contentHash } = approvedTask({ mutationSmoke: "required" });
    const p2 = [...events, startRun("run:1", { contentHash }), reportFor("run:1", { mutations: [mutation("P2", "survived")] }), observe("run:1"), verify("run:1")];
    expect(runState(stateOf(p2), "run:1")).toBe("failed");
    const fixed = [...p2, startRun("run:2", { contentHash }), reportFor("run:2", { mutations: [mutation("P2", "detected")] }), observe("run:2"), verify("run:2")];
    expect(runState(stateOf(fixed), "run:2")).toBe("verified");
  });

  it("[observed O11] equivalent mutants (K9, M5) pass verification but must be acknowledged in review", () => {
    const { events, contentHash } = approvedTask({ mutationSmoke: "required" });
    const mutations = [mutation("K9", "survived", "equivalent", "same error path"), mutation("M5", "survived", "equivalent", "zod normalizes key order"), mutation("P1", "detected")];
    const log = [...events, startRun("run:1", { contentHash }), reportFor("run:1", { mutations }), observe("run:1"), verify("run:1")];
    expect(kernel.applyEvent(stateOf(log), review("run:1", "approve", { ack: ["K9"] })).ok).toBe(false);
    expect(kernel.applyEvent(stateOf(log), review("run:1", "approve", { ack: ["M5", "K9"] })).ok).toBe(true);
  });

  it("[observed problem 2] draft against an unaccepted dependency, then reconciled v2", () => {
    const done = [...verifiedRun().events, review("run:1", "approve"), accept("run:1")];
    const draft = contractText(metadata({ taskId: "TASK-0002", dependencies: [{ taskId: "TASK-0001", acceptedCommit: null }] }));
    const v2 = contractText(metadata({ taskId: "TASK-0002", contractVersion: 2, dependencies: [{ taskId: "TASK-0001", acceptedCommit: RESULT }] }));
    const log = [...done, registerTask("TASK-0002"), registerContract(draft, { taskId: "TASK-0002" })];
    expect(kernel.applyEvent(stateOf(log), decide(hashOf(draft), "approved", { taskId: "TASK-0002" })).ok).toBe(false);
    const reconciled = [...log, registerContract(v2, { taskId: "TASK-0002" }), decide(hashOf(v2), "approved", { taskId: "TASK-0002" })];
    expect(taskState(stateOf(reconciled), "TASK-0002")).toBe("ready");
  });

  it("[constructed] worker lost mid-run, then a clean rerun", () => {
    const { events } = approvedTask();
    const log = [...events, startRun("run:1"), abandon("run:1"), startRun("run:2"), reportFor("run:2"), observe("run:2"), verify("run:2")];
    expect(taskState(stateOf(log), "TASK-0001")).toBe("awaiting_review");
  });
});

describe("invalid event orders", () => {
  const { events } = approvedTask();
  it.each<[string, unknown[]]>([
    ["report before start", [...events, reportFor("run:1")]],
    ["observation before report", [...events, startRun("run:1"), observe("run:1")]],
    ["verification before observation", [...events, startRun("run:1"), reportFor("run:1"), verify("run:1")]],
    ["review before verification", [...events, startRun("run:1"), reportFor("run:1"), observe("run:1"), review("run:1", "approve")]],
    ["acceptance before review", [...verifiedRun().events, accept("run:1")]],
    ["run before approval", [...events.slice(0, 2), startRun("run:1")]],
    ["approval before contract", [events[0], events[2]]],
    ["contract before task", [events[1]]],
  ])("%s is rejected at the offending event", (_name, log) => {
    const result = kernel.replay(log);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.index).toBe(log.length - 1);
  });

  it("a tampered log whose run_started observation does not allow a start cannot be replayed", () => {
    const tampered = startRun("run:1", { obs: { refs: {}, parents: {}, contractAtCommit: { commit: SHA.contract, path: "forge/contracts/TASK-0001.md", contentHash: approvedTask().contentHash } } });
    const result = kernel.replay([...events, tampered]);
    expect(!result.ok && [result.index, result.rejection.code, result.rejection.subject]).toEqual([3, "START_NOT_ALLOWED", "BASE_COMMIT_NOT_PERSISTED"]);
  });
});

describe("long mixed logs", () => {
  const log = Array.from({ length: 30 }, (_, i) => lifecycle(`TASK-${String(i + 1).padStart(4, "0")}`, i)).flat();

  it("replay equals step-by-step application", () => {
    const replayed = kernel.replay(log);
    expect(replayed.ok).toBe(true);
    expect(replayed.ok && replayed.state).toEqual(stepwise(log));
  });

  it("derives the expected final states for every task and run", () => {
    const result = kernel.replay(log);
    const state = result.ok ? result.state : kernel.emptyState();
    expect(state.log).toHaveLength(log.length);
    for (let i = 0; i < 30; i++) {
      const taskId = `TASK-${String(i + 1).padStart(4, "0")}`;
      expect(taskState(state, taskId)).toBe(i % 2 === 0 ? "accepted" : "review_approved");
      expect(runState(state, `run:${taskId.toLowerCase()}-1`)).toBe("failed");
      expect(runState(state, `run:${taskId.toLowerCase()}-2`)).toBe("verified");
    }
    expect(unfrozenPaths(state)).toEqual([]);
  });

  it("interleaving independent tasks does not change their outcome", () => {
    const a = lifecycle("TASK-0100", 0);
    const b = lifecycle("TASK-0200", 1);
    const interleaved = a.flatMap((e, i) => (i < b.length ? [e, b[i]] : [e])).concat(b.slice(a.length));
    const sequential = stateOf([...a, ...b]);
    const mixed = stateOf(interleaved);
    for (const taskId of ["TASK-0100", "TASK-0200"]) expect(taskState(mixed, taskId)).toBe(taskState(sequential, taskId));
  });
});

// ---------- Phase 8: property-based random histories (seeded, no dependency) ----------

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

const TASKS = ["TASK-0001", "TASK-0002", "TASK-0003"];

/** Candidate next events for the current state: mostly plausible, some deliberately wrong. */
function candidates(state: ForgeState, runCounter: { n: number }, rnd: () => number): unknown[] {
  const out: unknown[] = [];
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  for (const taskId of TASKS) {
    const task = state.tasks.find((t) => t.taskId === taskId);
    if (task === undefined) {
      out.push(registerTask(taskId));
      continue;
    }
    const version = (task.contracts.at(-1)?.ref.contractVersion ?? 0) + 1;
    const next = contractFor({ taskId, contractVersion: version, mutationSmoke: pick(["none", "optional", "required"]) });
    out.push(registerContract(next.text, { taskId }));
    const current = task.contracts.at(-1);
    if (current === undefined) continue;
    const hash = current.ref.contentHash;
    out.push(decide(hash, pick(["approved", "changes_requested"] as const), { taskId, actor: pick([ai("vendor-b", "r"), ai("vendor-a", "r"), ai("vendor-a", "spec-author")]) }));
    const runId = `run:p${runCounter.n}`;
    const obs = { refs: { b: SHA.head }, parents: runGraph(), contractAtCommit: { commit: SHA.contract, path: `forge/contracts/${taskId}.md`, contentHash: hash } };
    out.push(startRun(runId, { taskId, contentHash: hash, obs: rnd() < 0.15 ? { ...obs, refs: {} } : obs }));
    for (const run of state.runs.filter((r) => r.taskId === taskId)) {
      const id = run.runId;
      const goodMutations = [mutation("m1", "detected"), mutation("eq", "survived", "equivalent", "same behaviour")];
      out.push(reportFor(id, { mutations: rnd() < 0.2 ? [mutation("m1", "survived")] : goodMutations }));
      out.push(observe(id, rnd() < 0.4 ? { head: pick([null, SHA.contract, FOREIGN_HEAD]) } : {}));
      out.push(verify(id, rnd() < 0.25 ? pick([{ checks: [] }, { changedFiles: [{ path: "src/zzz.ts", change: "added" }] }, { verifiedCommit: SHA.head }]) : {}));
      out.push(review(id, pick(["approve", "request_changes"] as const), { ack: rnd() < 0.8 ? ["eq"] : [], actor: pick([ai("vendor-b", "cr"), ai("vendor-a", "cr"), human("alice")]) }));
      out.push(review(id, "request_changes", { requires: "contract_change", ack: ["eq"] }));
      out.push(accept(id, pick([human("owner"), ai("vendor-b", "owner")]), taskId));
      out.push(fail(id, pick(["PUSH_REJECTED", "REMOTE_NOT_PERSISTED", "DEVELOPER_ABORTED"])));
      out.push(abandon(id));
    }
  }
  out.push(null, { garbage: true }, registerTask("bad id"));
  return out;
}

const FOREIGN_HEAD = "9".repeat(40);

function checkInvariants(state: ForgeState) {
  for (const taskId of TASKS) {
    const ts = taskState(state, taskId);
    const runs = state.runs.filter((r) => r.taskId === taskId);
    const active = runs.filter((r) => !["verified", "failed", "abandoned"].includes(runState(state, r.runId)!));
    expect(active.length).toBeLessThanOrEqual(1);
    // implementing <=> exactly one active run (both directions)
    expect(ts === "implementing").toBe(active.length === 1);
    const task = state.tasks.find((t) => t.taskId === taskId);
    for (const revision of task?.contracts ?? []) {
      expect(revision.decisions.filter((d) => d.gate === "architecture_review").length).toBeLessThanOrEqual(1);
    }
    if (ts === "accepted") {
      const run = state.runs.find((r) => r.runId === task!.acceptance!.runId)!;
      expect(runState(state, run.runId)).toBe("verified");
      expect(run.verdict?.verdict).toBe("approve");
      expect(task!.acceptance!.owner.actorType).toBe("human");
      expect(run.contract.contentHash).toBe(task!.contracts.at(-1)!.ref.contentHash);
    }
    for (const run of runs) {
      if (runState(state, run.runId) === "verified") {
        expect(run.report).not.toBeNull();
        expect(run.verification!.evidence.verifiedCommit).toBe(run.report!.claimedResultCommit);
      }
      if (run.verdict !== null) expect(runState(state, run.runId)).toBe("verified");
    }
    const current = task?.contracts.at(-1);
    if (current !== undefined && ts !== null && ts !== "accepted") {
      const decision = kernel.canStartDeveloperRun(state, {
        taskId,
        contentHash: current.ref.contentHash,
        repoObservation: { refs: { b: SHA.head }, parents: runGraph(), contractAtCommit: { commit: SHA.contract, path: `forge/contracts/${taskId}.md`, contentHash: current.ref.contentHash } },
      });
      expect(decision.allowed).toBe(ts === "ready" || ts === "rework_required");
    }
  }
}

/** State-guided next step for one task (85%), falling back to broad noise (15%). */
function nextEvent(state: ForgeState, counter: { n: number }, rnd: () => number): unknown {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  if (rnd() < 0.15) return pick(candidates(state, counter, rnd));
  const taskId = pick(TASKS);
  const task = state.tasks.find((t) => t.taskId === taskId);
  if (task === undefined) return registerTask(taskId);
  const ts = taskState(state, taskId)!;
  const current = task.contracts.at(-1);
  const newVersion = () =>
    registerContract(contractFor({ taskId, contractVersion: (current?.ref.contractVersion ?? 0) + 1, mutationSmoke: pick(["none", "optional", "required"]) }).text, { taskId });
  if (ts === "planned" || ts === "contract_revision_required") return newVersion();
  const hash = current!.ref.contentHash;
  if (ts === "specifying") return rnd() < 0.8 ? decide(hash, "approved", { taskId }) : rnd() < 0.5 ? decide(hash, "changes_requested", { taskId }) : newVersion();
  if (ts === "ready" || ts === "rework_required") {
    const obs = { refs: { b: SHA.head }, parents: runGraph(), contractAtCommit: { commit: SHA.contract, path: `forge/contracts/${taskId}.md`, contentHash: hash } };
    return startRun(`run:p${counter.n}`, { taskId, contentHash: hash, obs: rnd() < 0.1 ? { ...obs, refs: {} } : obs });
  }
  const run = [...state.runs].reverse().find((r) => r.taskId === taskId)!;
  const id = run.runId;
  const rs = runState(state, id);
  if (ts === "implementing") {
    if (rnd() < 0.06) return rnd() < 0.5 ? fail(id, "DEVELOPER_ABORTED") : abandon(id);
    if (rs === "running") return reportFor(id, { mutations: rnd() < 0.15 ? [mutation("m1", "survived")] : [mutation("m1", "detected"), mutation("eq", "survived", "equivalent", "same behaviour")] });
    if (rs === "reported") return rnd() < 0.6 ? observe(id) : rnd() < 0.8 ? observe(id, { head: pick([null, SHA.contract, FOREIGN_HEAD]) }) : fail(id, "PUSH_REJECTED");
    return verify(id, rnd() < 0.2 ? { checks: [] } : {});
  }
  if (ts === "awaiting_review") {
    const roll = rnd();
    const actor = pick([ai("vendor-b", "cr"), human("alice"), ai("vendor-a", "cr")]);
    if (roll < 0.5) return review(id, "approve", { ack: ["eq"], actor });
    return review(id, "request_changes", { requires: roll < 0.8 ? "code_change" : "contract_change", ack: ["eq"], actor });
  }
  if (ts === "review_approved") return accept(id, rnd() < 0.85 ? human("owner") : ai("vendor-b", "owner"), taskId);
  return pick(candidates(state, counter, rnd)); // accepted: anything, should be rejected
}

describe("property: random histories keep all invariants", () => {
  it.each(Array.from({ length: 40 }, (_, i) => i + 1))("seed %i", (seed) => {
    const rnd = prng(seed);
    const counter = { n: 0 };
    let state = kernel.emptyState();
    const accepted: unknown[] = [];
    for (let i = 0; i < 200; i++) {
      const candidate = nextEvent(state, counter, rnd);
      const before = JSON.stringify(state);
      let result: ReturnType<typeof kernel.applyEvent>;
      expect(() => (result = kernel.applyEvent(state, candidate))).not.toThrow();
      if (result!.ok) {
        state = result!.state;
        accepted.push(candidate);
        if ((candidate as { body?: { type?: string } })?.body?.type === "run_started") counter.n++;
        checkInvariants(state);
      } else {
        expect(JSON.stringify(state)).toBe(before);
      }
    }
    const replayed = kernel.replay(accepted);
    expect(replayed.ok && replayed.state).toEqual(state);
    expect(unfrozenPaths(state)).toEqual([]);
  });
});

// ---------- Phase 8: adversarial structural fuzzing of real events ----------

const REJECT_CODES = new Set([
  "POLICY_MISMATCH", "EVENT_SCHEMA", "ROLE_NOT_ALLOWED", "TASK_ALREADY_REGISTERED", "TASK_UNKNOWN", "TASK_ALREADY_ACCEPTED",
  "TASK_STATE_INVALID", "CONTRACT_DOCUMENT_INVALID", "CONTRACT_HASH_MISMATCH", "CONTRACT_TASK_MISMATCH", "CONTRACT_PATH_MISMATCH",
  "CONTRACT_VERSION_NOT_NEXT", "CONTRACT_UNKNOWN", "CONTRACT_SUPERSEDED", "APPROVAL_ALREADY_DECIDED", "REVIEWER_NOT_INDEPENDENT",
  "FINDINGS_REQUIRED", "DEPENDENCY_UNRESOLVED", "DEPENDENCY_NOT_ACCEPTED", "DEPENDENCY_MISMATCH", "START_NOT_ALLOWED",
  "RUN_ALREADY_EXISTS", "RUN_UNKNOWN", "RUN_STATE_INVALID", "ACTOR_NOT_RUN_DEVELOPER", "VERIFIED_COMMIT_MISMATCH",
  "RUN_NOT_LATEST_VERIFIED", "REVIEW_ALREADY_RECORDED", "REVIEWED_COMMIT_MISMATCH", "VERDICT_INCONSISTENT",
  "EQUIVALENT_MUTATIONS_NOT_ACKNOWLEDGED", "OWNER_NOT_HUMAN",
]);

const NASTY: unknown[] = [null, undefined, 0, -0, NaN, Infinity, -1, 2 ** 53, 1.5, "", " ", "x".repeat(100_000), "\uD800", true, [], {}, [[[[]]]], { __proto__: null }, "run:x", SHA.head, "TASK-0001"];

function mutateStructurally(value: unknown, rnd: () => number): unknown {
  if (typeof value !== "object" || value === null) return NASTY[Math.floor(rnd() * NASTY.length)];
  const copy = structuredClone(value) as Record<string, unknown>;
  const containers: Record<string, unknown>[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "object" && v !== null) {
      containers.push(v as Record<string, unknown>);
      for (const child of Object.values(v)) walk(child);
    }
  };
  walk(copy);
  const target = containers[Math.floor(rnd() * containers.length)]!;
  const keys = Object.keys(target);
  const key = keys[Math.floor(rnd() * keys.length)];
  const roll = rnd();
  if (key !== undefined && roll < 0.3) delete target[key];
  else if (key !== undefined && roll < 0.75) target[key] = NASTY[Math.floor(rnd() * NASTY.length)];
  else if (roll < 0.85) Object.defineProperty(target, "__proto__", { value: { injected: true }, enumerable: true, configurable: true, writable: true });
  else if (roll < 0.95) target[`extra${Math.floor(rnd() * 3)}`] = "x";
  else if (Array.isArray(target)) target.push(...target);
  return copy;
}

describe("adversarial: structurally broken events never throw and never corrupt state", () => {
  it.each(Array.from({ length: 25 }, (_, i) => i + 101))("seed %i", (seed) => {
    const rnd = prng(seed);
    const counter = { n: 0 };
    let state = kernel.emptyState();
    let acceptedBroken = 0;
    for (let i = 0; i < 160; i++) {
      const valid = nextEvent(state, counter, rnd);
      const broken = rnd() < 0.5 ? mutateStructurally(valid, rnd) : valid;
      const before = JSON.stringify(state);
      let result!: ReturnType<typeof kernel.applyEvent>;
      expect(() => (result = kernel.applyEvent(state, broken))).not.toThrow();
      if (result.ok) {
        if (broken !== valid) acceptedBroken++;
        state = result.state;
        if ((broken as { body?: { type?: string } })?.body?.type === "run_started") counter.n++;
        checkInvariants(state);
      } else {
        expect(REJECT_CODES.has(result.rejection.code)).toBe(true);
        expect(JSON.stringify(state)).toBe(before);
      }
    }
    // Some mutations are harmless (e.g. another label); invariants were checked for each of them above.
    void acceptedBroken;
    expect(unfrozenPaths(state)).toEqual([]);
  });

  it("the start gate never throws on hostile requests", () => {
    const rnd = prng(7);
    const { state } = (() => ({ state: stateOf(approvedTask().events) }))();
    const valid = { taskId: "TASK-0001", contentHash: approvedTask().contentHash, repoObservation: { refs: { b: SHA.head }, parents: runGraph(), contractAtCommit: { commit: SHA.contract, path: "forge/contracts/TASK-0001.md", contentHash: approvedTask().contentHash } } };
    for (let i = 0; i < 500; i++) {
      const hostile = mutateStructurally(valid, rnd);
      expect(() => kernel.canStartDeveloperRun(state, hostile)).not.toThrow();
    }
  });
});

// ---------- Phase 8: differential test of the task-state rules (FORGE-CORE-0001B §10) ----------
// An independent reference model written from the contract text. It tracks only facts from
// accepted events and asks the kernel nothing except runState (tested separately).

type ModelTask = { versions: { hash: string; approved: boolean }[]; acceptedRun: string | null };
type ModelRun = { taskId: string; hash: string; verdict: { verdict: string; requires: string | null } | null };

function referenceTaskState(model: { tasks: Map<string, ModelTask>; runs: Map<string, ModelRun> }, state: ForgeState, taskId: string): string {
  const task = model.tasks.get(taskId)!;
  if (task.acceptedRun !== null) return "accepted";
  const runsOfTask = [...model.runs.entries()].filter(([, r]) => r.taskId === taskId);
  if (runsOfTask.some(([id]) => !["verified", "failed", "abandoned"].includes(runState(state, id)!))) return "implementing";
  const current = task.versions.at(-1);
  if (current === undefined) return "planned";
  const verifiedOnCurrent = runsOfTask.filter(([id, r]) => r.hash === current.hash && runState(state, id) === "verified");
  const latest = verifiedOnCurrent.at(-1);
  if (latest !== undefined) {
    const verdict = latest[1].verdict;
    if (verdict === null) return "awaiting_review";
    if (verdict.verdict === "approve") return "review_approved";
    return verdict.requires === "code_change" ? "rework_required" : "contract_revision_required";
  }
  return current.approved ? "ready" : "specifying";
}

function updateModel(model: { tasks: Map<string, ModelTask>; runs: Map<string, ModelRun> }, event: { body: Record<string, any> }, hashOf: (text: string) => string) {
  const b = event.body;
  switch (b.type) {
    case "task_registered":
      model.tasks.set(b.taskId, { versions: [], acceptedRun: null });
      break;
    case "contract_registered":
      model.tasks.get(b.taskId)!.versions.push({ hash: hashOf(b.contractText), approved: false });
      break;
    case "approval_recorded":
      if (b.verdict === "approved") model.tasks.get(b.taskId)!.versions.find((v) => v.hash === b.contentHash)!.approved = true;
      break;
    case "run_started":
      model.runs.set(b.runId, { taskId: b.taskId, hash: b.contentHash, verdict: null });
      break;
    case "code_review_recorded":
      model.runs.get(b.runId)!.verdict = { verdict: b.verdict, requires: b.requires };
      break;
    case "task_accepted":
      model.tasks.get(b.taskId)!.acceptedRun = b.runId;
      break;
  }
}

describe("differential: kernel task states equal an independent reference model", () => {
  it.each(Array.from({ length: 30 }, (_, i) => i + 501))("seed %i", (seed) => {
    const rnd = prng(seed);
    const counter = { n: 0 };
    const model = { tasks: new Map<string, ModelTask>(), runs: new Map<string, ModelRun>() };
    let state = kernel.emptyState();
    let compared = 0;
    for (let i = 0; i < 200; i++) {
      const candidate = nextEvent(state, counter, rnd);
      const result = kernel.applyEvent(state, candidate);
      if (!result.ok) continue;
      state = result.state;
      updateModel(model, candidate as { body: Record<string, any> }, hashOf);
      if ((candidate as { body: { type: string } }).body.type === "run_started") counter.n++;
      for (const taskId of model.tasks.keys()) {
        expect(taskState(state, taskId)).toBe(referenceTaskState(model, state, taskId));
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(50);
  });
});
