import { describe, expect, it } from "vitest";
import { acceptedCommitOf, contractRevisionState, latestVerifiedRun, taskState } from "../../src/forge/state.ts";
import { ai, contractText, decide, hashOf, human, kernel, metadata, registerContract, registerTask, stateOf, system } from "./fixtures.ts";
import {
  CODE_REVIEWER,
  DEV,
  OWNER_HUMAN,
  RESULT,
  SHA,
  accept,
  contractFor,
  mutation,
  observe,
  reportFor,
  review,
  startRun,
  verifiedRun,
  verify,
} from "./run-fixtures.ts";

function rejected(prefix: readonly unknown[], candidate: unknown, code: string) {
  const result = kernel.applyEvent(stateOf(prefix), candidate);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.rejection.code).toBe(code);
}

const verified = verifiedRun().events;
const rerun = (runId: string, prior: readonly unknown[]) => [...prior, startRun(runId), reportFor(runId), observe(runId), verify(runId)];

describe("code review", () => {
  it("approve → review_approved", () => {
    expect(taskState(stateOf([...verified, review("run:1", "approve")]), "TASK-0001")).toBe("review_approved");
  });

  it("code_change → rework_required → new run with the same contract → awaiting_review", () => {
    const rework = [...verified, review("run:1", "request_changes", { requires: "code_change" })];
    expect(taskState(stateOf(rework), "TASK-0001")).toBe("rework_required");
    const second = rerun("run:2", rework);
    expect(taskState(stateOf(second), "TASK-0001")).toBe("awaiting_review");
    expect(latestVerifiedRun(stateOf(second), "TASK-0001")!.runId).toBe("run:2");
  });

  it("a failed rework run keeps the task in rework_required", () => {
    const rework = [...verified, review("run:1", "request_changes"), startRun("run:2"), reportFor("run:2")];
    const state = stateOf([...rework, { ...reportFor("run:2"), body: { type: "run_failed", runId: "run:2", code: "DEVELOPER_ABORTED", detail: "gave up" } }]);
    expect(taskState(state, "TASK-0001")).toBe("rework_required");
  });

  it("contract_change → contract_revision_required → blocked until a new approved version", () => {
    const blocked = [...verified, review("run:1", "request_changes", { requires: "contract_change" })];
    const state = stateOf(blocked);
    expect(taskState(state, "TASK-0001")).toBe("contract_revision_required");
    // the old revision itself stays approved: the decision was correct for that text
    expect(contractRevisionState(state, "TASK-0001", contractFor().contentHash)).toBe("approved");
    rejected(blocked, startRun("run:2"), "START_NOT_ALLOWED");
    const v2 = contractFor({ contractVersion: 2 });
    const withV2 = [...blocked, registerContract(v2.text)];
    expect(taskState(stateOf(withV2), "TASK-0001")).toBe("specifying");
    const approvedV2 = [...withV2, decide(v2.contentHash, "approved")];
    expect(taskState(stateOf(approvedV2), "TASK-0001")).toBe("ready");
    expect(kernel.applyEvent(stateOf(approvedV2), startRun("run:2", { contentHash: v2.contentHash })).ok).toBe(true);
  });

  it.each<[string, unknown[], unknown, string]>([
    ["review on a running run", [...verifiedRun().events.slice(0, 4)], review("run:1", "approve"), "RUN_STATE_INVALID"],
    ["review on a reported run", [...verifiedRun().events.slice(0, 5)], review("run:1", "approve"), "RUN_STATE_INVALID"],
    ["second review", [...verified, review("run:1", "approve")], review("run:1", "approve"), "REVIEW_ALREADY_RECORDED"],
    ["review of another commit", verified, review("run:1", "approve", { commit: SHA.contract }), "REVIEWED_COMMIT_MISMATCH"],
    ["approve with blocking finding", verified, review("run:1", "approve", { findings: [{ severity: "blocking", summary: "x", location: null }] }), "VERDICT_INCONSISTENT"],
    ["approve with requires", verified, review("run:1", "approve", { requires: "code_change" }), "VERDICT_INCONSISTENT"],
    ["request_changes without requires", verified, review("run:1", "request_changes", { requires: null }), "VERDICT_INCONSISTENT"],
    ["request_changes without findings", verified, review("run:1", "request_changes", { findings: [] }), "VERDICT_INCONSISTENT"],
    ["unknown run", verified, review("run:9", "approve"), "RUN_UNKNOWN"],
    ["duplicate acknowledgement", verified, review("run:1", "approve", { ack: ["x", "x"] }), "EVENT_SCHEMA"],
  ])("rejects %s", (_name, prefix, candidate, code) => {
    rejected(prefix, candidate, code);
  });

  it("approve with only non-blocking findings is fine", () => {
    expect(kernel.applyEvent(stateOf(verified), review("run:1", "approve", { findings: [{ severity: "non_blocking", summary: "nit", location: null }] })).ok).toBe(true);
  });

  it("only the latest verified run of the current revision can be reviewed", () => {
    // A second run can only start after run:1 got a verdict (awaiting_review is not startable),
    // so an older run is always both reviewed and not latest; §9 checks "latest" first.
    const twoRuns = rerun("run:2", [...verified, review("run:1", "request_changes")]);
    rejected(twoRuns, review("run:1", "approve"), "RUN_NOT_LATEST_VERIFIED");
    rejected(verified, startRun("run:2"), "START_NOT_ALLOWED");
    const twoUnreviewed = rerun("run:2", [...verified, review("run:1", "request_changes")]);
    expect(kernel.applyEvent(stateOf(twoUnreviewed), review("run:2", "approve")).ok).toBe(true);
  });

  it("a verified run on a superseded revision can no longer be reviewed", () => {
    const v2 = contractFor({ contractVersion: 2 });
    rejected([...verified, registerContract(v2.text)], review("run:1", "approve"), "RUN_NOT_LATEST_VERIFIED");
  });

  describe("reviewer independence", () => {
    it.each<[string, object, boolean]>([
      ["the developer", DEV, false],
      ["same provider AI", ai("vendor-a", "reviewer"), false],
      ["other provider AI", CODE_REVIEWER, true],
      ["human", human("alice"), true],
      ["human with the developer's provider string", { actorType: "human", provider: "vendor-a", model: null, label: "alice" }, true],
      ["system", system(), false],
    ])("%s", (_name, reviewer, allowed) => {
      const result = kernel.applyEvent(stateOf(verified), review("run:1", "approve", { actor: reviewer }));
      expect(result.ok).toBe(allowed);
      if (!result.ok) expect(result.rejection.code).toBe("REVIEWER_NOT_INDEPENDENT");
    });
  });

  describe("equivalent mutations must be acknowledged (O11)", () => {
    const withEquivalent = (() => {
      const { events } = verifiedRun("run:1", { mutationSmoke: "required" });
      const report = reportFor("run:1", { mutations: [mutation("K9", "survived", "equivalent", "same error path"), mutation("P1", "detected")] });
      return [...events.slice(0, 4), report, observe("run:1"), verify("run:1")];
    })();

    it("rejects a review that does not acknowledge them", () => {
      rejected(withEquivalent, review("run:1", "approve"), "EQUIVALENT_MUTATIONS_NOT_ACKNOWLEDGED");
    });

    it("rejects acknowledging a mutation that was not declared equivalent", () => {
      rejected(withEquivalent, review("run:1", "approve", { ack: ["K9", "P1"] }), "EQUIVALENT_MUTATIONS_NOT_ACKNOWLEDGED");
    });

    it("accepts an exact acknowledgement, also on request_changes", () => {
      expect(kernel.applyEvent(stateOf(withEquivalent), review("run:1", "approve", { ack: ["K9"] })).ok).toBe(true);
      expect(kernel.applyEvent(stateOf(withEquivalent), review("run:1", "request_changes", { ack: ["K9"] })).ok).toBe(true);
    });
  });
});

describe("task acceptance", () => {
  const approved = [...verified, review("run:1", "approve")];

  it("a human owner accepts; the task is terminal", () => {
    const state = stateOf([...approved, accept("run:1")]);
    expect(taskState(state, "TASK-0001")).toBe("accepted");
    expect(acceptedCommitOf(state, "TASK-0001")).toBe(RESULT);
  });

  it.each<[string, unknown[], unknown, string]>([
    ["by an AI owner", approved, accept("run:1", ai("vendor-b", "owner")), "OWNER_NOT_HUMAN"],
    ["before review", verified, accept("run:1"), "TASK_STATE_INVALID"],
    ["after request_changes", [...verified, review("run:1", "request_changes")], accept("run:1"), "TASK_STATE_INVALID"],
    ["of another run", approved, accept("run:2"), "RUN_NOT_LATEST_VERIFIED"],
    ["of an unknown task", approved, accept("run:1", OWNER_HUMAN, "TASK-0009"), "TASK_UNKNOWN"],
    ["twice", [...approved, accept("run:1")], accept("run:1"), "TASK_STATE_INVALID"],
    ["by a non-owner role", approved, { ...accept("run:1"), role: "code_reviewer" }, "ROLE_NOT_ALLOWED"],
  ])("rejects acceptance %s", (_name, prefix, candidate, code) => {
    rejected(prefix, candidate, code);
  });

  it("accepted is terminal: no new contract, approval or run", () => {
    const done = [...approved, accept("run:1")];
    const v2 = contractFor({ contractVersion: 2 });
    rejected(done, registerContract(v2.text), "TASK_ALREADY_ACCEPTED");
    rejected(done, decide(contractFor().contentHash, "approved"), "TASK_ALREADY_ACCEPTED");
    rejected(done, startRun("run:2"), "START_NOT_ALLOWED");
  });

  describe("dependencies become approvable once the dependency is accepted", () => {
    const done = [...approved, accept("run:1")];
    const dependent = (acceptedCommit: string | null) => {
      const text = contractText(metadata({ taskId: "TASK-0002", dependencies: [{ taskId: "TASK-0001", acceptedCommit }] }));
      return { text, hash: hashOf(text), prefix: [...done, registerTask("TASK-0002"), registerContract(text, { taskId: "TASK-0002" })] };
    };

    it("matching accepted commit → approved", () => {
      const d = dependent(RESULT);
      const state = stateOf([...d.prefix, decide(d.hash, "approved", { taskId: "TASK-0002" })]);
      expect(taskState(state, "TASK-0002")).toBe("ready");
    });

    it("other commit → DEPENDENCY_MISMATCH", () => {
      const d = dependent(SHA.contract);
      rejected(d.prefix, decide(d.hash, "approved", { taskId: "TASK-0002" }), "DEPENDENCY_MISMATCH");
    });

    it("not yet accepted → DEPENDENCY_NOT_ACCEPTED", () => {
      const text = contractText(metadata({ taskId: "TASK-0002", dependencies: [{ taskId: "TASK-0001", acceptedCommit: RESULT }] }));
      rejected([...approved, registerTask("TASK-0002"), registerContract(text, { taskId: "TASK-0002" })], decide(hashOf(text), "approved", { taskId: "TASK-0002" }), "DEPENDENCY_NOT_ACCEPTED");
    });
  });
});
