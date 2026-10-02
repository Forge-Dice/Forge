import { describe, expect, it } from "vitest";
import { runState, taskState, findRun } from "../../src/forge/state.ts";
import { kernel, stateOf, ai, human, event } from "./fixtures.ts";
import {
  DEV,
  FOREIGN,
  LATER,
  OWNER_HUMAN,
  RESULT,
  SHA,
  abandon,
  approvedTask,
  fail,
  observe,
  reportFor,
  runGraph,
  startRun,
  verify,
  verifiedRun,
} from "./run-fixtures.ts";

const base = approvedTask().events;

function rejected(prefix: readonly unknown[], candidate: unknown, code: string) {
  const result = kernel.applyEvent(stateOf(prefix), candidate);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.rejection.code).toBe(code);
  return result.ok ? null : result.rejection;
}

describe("run_started", () => {
  it("starts from the contract commit and puts the task into implementing", () => {
    const state = stateOf([...base, startRun("run:1")]);
    expect(runState(state, "run:1")).toBe("running");
    expect(findRun(state, "run:1")!.startedFromCommit).toBe(SHA.contract);
    expect(taskState(state, "TASK-0001")).toBe("implementing");
  });

  it("recomputes the gate from the recorded observation (contract only local → rejected)", () => {
    const localOnly = { refs: { "claude/branch": SHA.base }, parents: runGraph(), contractAtCommit: { commit: SHA.contract, path: "forge/contracts/TASK-0001.md", contentHash: approvedTask().contentHash } };
    const rejection = rejected(base, startRun("run:1", { obs: localOnly }), "START_NOT_ALLOWED");
    expect(rejection!.subject).toBe("CONTRACT_NOT_PERSISTED");
  });

  it("allows only one active run per task", () => {
    const rejection = rejected([...base, startRun("run:1")], startRun("run:2"), "START_NOT_ALLOWED");
    expect(rejection!.subject).toBe("RUN_ALREADY_ACTIVE");
  });

  it("rejects a duplicate run id even after the first run ended", () => {
    rejected([...base, startRun("run:1"), fail("run:1", "DEVELOPER_ABORTED")], startRun("run:1"), "RUN_ALREADY_EXISTS");
  });

  it.each([
    ["unknown task", startRun("run:1", { taskId: "TASK-0009" }), "TASK_UNKNOWN"],
    ["bad run id", startRun("RUN-1"), "EVENT_SCHEMA"],
    ["owner role", { ...startRun("run:1"), role: "owner" }, "ROLE_NOT_ALLOWED"],
  ])("rejects %s", (_name, candidate, code) => {
    rejected(base, candidate, code);
  });

  it("is not allowed on a draft contract", () => {
    expect(rejected(base.slice(0, 2), startRun("run:1"), "START_NOT_ALLOWED")!.subject).toBe("CONTRACT_NOT_APPROVED");
  });
});

describe("developer report", () => {
  it("moves running to reported; a local commit is not persisted", () => {
    const state = stateOf([...base, startRun("run:1"), reportFor("run:1")]);
    expect(runState(state, "run:1")).toBe("reported");
    expect(taskState(state, "TASK-0001")).toBe("implementing");
  });

  it("only the run developer may report", () => {
    rejected([...base, startRun("run:1")], reportFor("run:1", {}, ai("vendor-a", "someone-else")), "ACTOR_NOT_RUN_DEVELOPER");
  });

  it.each([
    ["before the run started", base, "RUN_UNKNOWN"],
    ["twice", [...base, startRun("run:1"), reportFor("run:1")], "RUN_STATE_INVALID"],
  ])("rejects a report %s", (_name, prefix, code) => {
    rejected(prefix, reportFor("run:1"), code);
  });
});

describe("remote observation (O8: push 403, retry)", () => {
  const reported = [...base, startRun("run:1"), reportFor("run:1")];

  it("not_contained → retry → contained", () => {
    const afterFailedPush = stateOf([...reported, observe("run:1", { head: SHA.contract })]);
    expect(runState(afterFailedPush, "run:1")).toBe("reported");
    const afterRetry = stateOf([...reported, observe("run:1", { head: SHA.contract }), observe("run:1")]);
    expect(runState(afterRetry, "run:1")).toBe("remote_verified");
  });

  it("many negative observations never terminate; only an explicit run_failed does", () => {
    const negatives = [observe("run:1", { head: null }), observe("run:1", { head: SHA.contract }), observe("run:1", { head: FOREIGN })];
    const state = stateOf([...reported, ...negatives]);
    expect(runState(state, "run:1")).toBe("reported");
    expect(taskState(state, "TASK-0001")).toBe("implementing");
    const failed = stateOf([...reported, ...negatives, fail("run:1", "PUSH_REJECTED")]);
    expect(runState(failed, "run:1")).toBe("failed");
    expect(taskState(failed, "TASK-0001")).toBe("ready");
    expect(kernel.applyEvent(failed, startRun("run:2")).ok).toBe(true);
  });

  it.each<[string, object, string]>([
    ["head equals the result", { head: RESULT }, "remote_verified"],
    ["result is an ancestor of a later head", { head: LATER }, "remote_verified"],
    ["head is the start commit only", { head: SHA.contract }, "reported"],
    ["ref missing (head null)", { head: null }, "reported"],
    ["other ref than claimed", { ref: "other/branch" }, "reported"],
    ["unrelated head", { head: FOREIGN }, "reported"],
    ["edge result→start missing (fail-closed)", { parents: { [LATER]: [RESULT] }, head: LATER }, "reported"],
    ["edge head→result missing (fail-closed)", { parents: { [RESULT]: [SHA.contract] }, head: LATER }, "reported"],
  ])("%s → %s", (_name, opts, expected) => {
    expect(runState(stateOf([...reported, observe("run:1", opts)]), "run:1")).toBe(expected);
  });

  it("a result that does not descend from the start commit is never persisted for this run", () => {
    const state = stateOf([...base, startRun("run:1"), reportFor("run:1", { claimedResultCommit: FOREIGN }), observe("run:1", { head: FOREIGN })]);
    expect(runState(state, "run:1")).toBe("reported");
  });

  it("another remote ref is fine if it is the claimed one (O9: task identity not from branch names)", () => {
    const state = stateOf([
      ...base,
      startRun("run:1"),
      reportFor("run:1", { claimedRemoteRef: "claude/forge-architecture-review-hjdq89" }),
      observe("run:1", { ref: "claude/forge-architecture-review-hjdq89" }),
    ]);
    expect(runState(state, "run:1")).toBe("remote_verified");
    expect(findRun(state, "run:1")!.taskId).toBe("TASK-0001");
  });

  it.each([
    ["before the report", [...base, startRun("run:1")]],
    ["after remote verification", [...reported, observe("run:1")]],
    ["after failure", [...reported, fail("run:1")]],
  ])("rejects an observation %s", (_name, prefix) => {
    rejected(prefix, observe("run:1"), "RUN_STATE_INVALID");
  });
});

describe("verification gate", () => {
  it("verification before remote persistence is rejected", () => {
    rejected([...base, startRun("run:1"), reportFor("run:1")], verify("run:1"), "RUN_STATE_INVALID");
    rejected([...base, startRun("run:1"), reportFor("run:1"), observe("run:1", { head: null })], verify("run:1"), "RUN_STATE_INVALID");
  });

  it("evidence must be for the claimed commit", () => {
    const prefix = [...base, startRun("run:1"), reportFor("run:1"), observe("run:1", { head: LATER })];
    rejected(prefix, verify("run:1", { verifiedCommit: LATER }), "VERIFIED_COMMIT_MISMATCH");
  });

  it("a passing verification makes the run verified and the task awaiting review", () => {
    const state = stateOf(verifiedRun().events);
    expect(runState(state, "run:1")).toBe("verified");
    expect(taskState(state, "TASK-0001")).toBe("awaiting_review");
  });

  it("a failing verification is terminal and the task becomes startable again", () => {
    const { events } = approvedTask();
    const state = stateOf([...events, startRun("run:1"), reportFor("run:1"), observe("run:1"), verify("run:1", { checks: [{ name: "test", command: "npm test", exitCode: 1 }] })]);
    expect(runState(state, "run:1")).toBe("failed");
    expect(taskState(state, "TASK-0001")).toBe("ready");
    rejected([...events, startRun("run:1"), reportFor("run:1"), observe("run:1"), verify("run:1", { checks: [] })], verify("run:1"), "RUN_STATE_INVALID");
  });

  it("verification twice is rejected", () => {
    rejected(verifiedRun().events, verify("run:1"), "RUN_STATE_INVALID");
  });

  it("evidence with duplicate changed paths is malformed", () => {
    const prefix = [...base, startRun("run:1"), reportFor("run:1"), observe("run:1")];
    rejected(prefix, verify("run:1", { changedFiles: [{ path: "src/a.ts", change: "added" }, { path: "src/a.ts", change: "modified" }] }), "EVENT_SCHEMA");
  });
});

describe("explicit failure and abandonment", () => {
  const states = {
    running: [...base, startRun("run:1")],
    reported: [...base, startRun("run:1"), reportFor("run:1")],
    remote_verified: [...base, startRun("run:1"), reportFor("run:1"), observe("run:1")],
  };

  it.each(Object.entries(states))("run_failed and run_abandoned are allowed in %s", (_name, prefix) => {
    expect(runState(stateOf([...prefix, fail("run:1")]), "run:1")).toBe("failed");
    expect(runState(stateOf([...prefix, abandon("run:1")]), "run:1")).toBe("abandoned");
  });

  it("terminal runs cannot fail or be abandoned again", () => {
    rejected([...states.running, fail("run:1")], abandon("run:1"), "RUN_STATE_INVALID");
    rejected(verifiedRun().events, fail("run:1"), "RUN_STATE_INVALID");
  });

  it("the owner may fail a run, another developer may not", () => {
    expect(runState(stateOf([...states.reported, fail("run:1", "REMOTE_NOT_PERSISTED", { actor: OWNER_HUMAN, role: "owner" })]), "run:1")).toBe("failed");
    rejected(states.reported, fail("run:1", "PUSH_REJECTED", { actor: ai("vendor-c", "intruder") }), "ACTOR_NOT_RUN_DEVELOPER");
  });

  it.each([
    ["observer failing a run", { ...fail("run:1"), role: "observer" }, "ROLE_NOT_ALLOWED"],
    ["developer abandoning a run", { ...abandon("run:1"), role: "developer" }, "ROLE_NOT_ALLOWED"],
    ["unknown failure code", event(DEV, "developer", { type: "run_failed", runId: "run:1", code: "FLAKY", detail: "x" }), "EVENT_SCHEMA"],
  ])("rejects %s", (_name, candidate, code) => {
    rejected(states.running, candidate, code);
  });

  it("an abandoned worker frees the task (WORKER_LOST)", () => {
    const state = stateOf([...states.reported, abandon("run:1")]);
    expect(taskState(state, "TASK-0001")).toBe("ready");
    expect(human("x")).toBeTruthy();
  });
});
