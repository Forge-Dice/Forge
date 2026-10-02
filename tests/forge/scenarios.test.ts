import { describe, expect, it } from "vitest";
import { runState, taskState, type ForgeState } from "../../src/forge/state.ts";
import { contractText, decide, hashOf, kernel, metadata, registerContract, registerTask, stateOf, unfrozenPaths } from "./fixtures.ts";
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
