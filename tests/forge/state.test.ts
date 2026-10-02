import { describe, expect, it } from "vitest";
import { contractRevisionState, currentContract, taskState, type ForgeState } from "../../src/forge/state.ts";
import {
  AUTHOR,
  OWNER,
  REVIEWER,
  ai,
  approvedWorld,
  contractText,
  decide,
  event,
  hashOf,
  human,
  kernel,
  metadata,
  registerContract,
  registerTask,
  stateOf,
  system,
} from "./fixtures.ts";

const v1 = contractText(metadata());
const v2 = contractText(metadata({ contractVersion: 2 }));
const h1 = hashOf(v1);
const h2 = hashOf(v2);

function rejectionOf(prefix: readonly unknown[], candidate: unknown) {
  const result = kernel.applyEvent(stateOf(prefix), candidate);
  expect(result.ok).toBe(false);
  return result.ok ? null : result.rejection;
}

const expectRejected = (prefix: readonly unknown[], candidate: unknown, code: string, path?: unknown[]) => {
  const rejection = rejectionOf(prefix, candidate)!;
  expect(rejection.code).toBe(code);
  if (path) expect(rejection.path).toEqual(path);
  return rejection;
};

describe("event schema and roles", () => {
  it.each<[string, unknown, unknown[]]>([
    ["null", null, []],
    ["missing body", { actor: OWNER, role: "owner", recordedAt: null }, ["body"]],
    ["unknown event type", event(OWNER, "owner", { type: "task_deleted", taskId: "TASK-0001" }), ["body", "type"]],
    ["extra event field", { ...registerTask(), seq: 1 }, []],
    ["extra body field", event(OWNER, "owner", { type: "task_registered", taskId: "TASK-0001", title: "x", status: "ready" }), ["body"]],
    ["unknown role", event(OWNER, "developer", { type: "task_registered", taskId: "TASK-0001", title: "x" }), ["role"]],
    ["invalid actor", event({ ...OWNER, provider: "Human" }, "owner", { type: "task_registered", taskId: "TASK-0001", title: "x" }), ["actor", "provider"]],
    ["blank title", event(OWNER, "owner", { type: "task_registered", taskId: "TASK-0001", title: " " }), ["body", "title"]],
  ])("rejects %s with EVENT_SCHEMA", (_name, candidate, path) => {
    expectRejected([], candidate, "EVENT_SCHEMA", path);
  });

  it.each<[string, unknown, unknown[]]>([
    ["task registered by a spec author", event(AUTHOR, "spec_author", { type: "task_registered", taskId: "TASK-0001", title: "x" }), []],
    ["contract registered by an owner", { ...registerContract(v1), role: "owner" }, [registerTask()]],
    ["approval recorded by a spec author", { ...decide(h1, "approved"), role: "spec_author" }, [registerTask(), registerContract(v1)]],
  ])("rejects %s with ROLE_NOT_ALLOWED", (_name, candidate, prefix) => {
    expectRejected(prefix, candidate, "ROLE_NOT_ALLOWED", ["role"]);
  });
});

describe("task_registered", () => {
  it("registers a task in state planned", () => {
    const state = stateOf([registerTask()]);
    expect(taskState(state, "TASK-0001")).toBe("planned");
    expect(taskState(state, "TASK-0002")).toBeNull();
  });

  it("rejects a duplicate task", () => {
    expectRejected([registerTask()], registerTask(), "TASK_ALREADY_REGISTERED", ["body", "taskId"]);
  });
});

describe("contract_registered", () => {
  it("derives ref and metadata from the text only", () => {
    const state = stateOf([registerTask(), registerContract(v1)]);
    const current = currentContract(state, "TASK-0001")!;
    expect(current.ref).toEqual({ taskId: "TASK-0001", contractVersion: 1, contentHash: h1 });
    expect(current.metadata).toEqual(metadata());
    expect(taskState(state, "TASK-0001")).toBe("specifying");
    expect(contractRevisionState(state, "TASK-0001", h1)).toBe("draft");
  });

  it("rejects an unknown task", () => {
    expectRejected([], registerContract(v1), "TASK_UNKNOWN", ["body", "taskId"]);
  });

  it("rejects an invalid document and reports its issues", () => {
    const bad = `﻿${v1}`;
    const rejection = expectRejected([registerTask()], registerContract(bad, { declared: "0".repeat(64) }), "CONTRACT_DOCUMENT_INVALID", ["body", "contractText"]);
    expect(rejection.issues).toEqual([{ code: "BOM", path: [] }]);
  });

  it("rejects process status fields in the frontmatter (TASK-0004 contradiction)", () => {
    const contradictory = contractText({ ...metadata(), status: "approved", architecture_review: "pending_chatgpt_final_check" });
    const rejection = expectRejected([registerTask()], registerContract(contradictory, { declared: "0".repeat(64) }), "CONTRACT_DOCUMENT_INVALID");
    expect(rejection.issues.every((issue) => issue.code === "METADATA_SCHEMA")).toBe(true);
  });

  it.each([
    ["a truncated transport copy (TASK-0003)", v1.slice(0, -10)],
    ["a silently edited copy", v1.replace("Body.", "Body, changed.")],
  ])("rejects %s through the declared hash", (_name, transported) => {
    expectRejected([registerTask()], registerContract(transported, { declared: h1 }), "CONTRACT_HASH_MISMATCH", ["body", "declaredContentHash"]);
  });

  it("rejects metadata for another task", () => {
    const other = contractText(metadata({ taskId: "TASK-0002" }));
    expectRejected([registerTask()], registerContract(other), "CONTRACT_TASK_MISMATCH", ["body", "taskId"]);
  });

  it("rejects a wrong contract path", () => {
    expectRejected([registerTask()], registerContract(v1, { path: "docs/TASK-0001.md" }), "CONTRACT_PATH_MISMATCH", ["body", "contractPath"]);
  });

  it.each([
    ["first version 2", [registerTask()], v2],
    ["version 1 again", [registerTask(), registerContract(v1)], contractText(metadata(), "# other\n")],
    ["a skipped version", [registerTask(), registerContract(v1)], contractText(metadata({ contractVersion: 3 }))],
  ])("rejects %s with CONTRACT_VERSION_NOT_NEXT", (_name, prefix, text) => {
    expectRejected(prefix, registerContract(text), "CONTRACT_VERSION_NOT_NEXT");
  });

  it("a new version supersedes the old one and inherits no decision", () => {
    const state = stateOf([registerTask(), registerContract(v1), decide(h1, "approved"), registerContract(v2)]);
    expect(contractRevisionState(state, "TASK-0001", h1)).toBe("superseded");
    expect(contractRevisionState(state, "TASK-0001", h2)).toBe("draft");
    expect(taskState(state, "TASK-0001")).toBe("specifying");
  });
});

describe("approval_recorded", () => {
  const prefix = [registerTask(), registerContract(v1)];

  it("approves the exact hash", () => {
    const state = stateOf([...prefix, decide(h1, "approved")]);
    expect(contractRevisionState(state, "TASK-0001", h1)).toBe("approved");
    expect(taskState(state, "TASK-0001")).toBe("ready");
  });

  it("changes_requested is final for the hash; only a new version can be approved", () => {
    const requested = [...prefix, decide(h1, "changes_requested")];
    expect(contractRevisionState(stateOf(requested), "TASK-0001", h1)).toBe("changes_requested");
    expect(taskState(stateOf(requested), "TASK-0001")).toBe("specifying");
    expectRejected(requested, decide(h1, "approved"), "APPROVAL_ALREADY_DECIDED", ["body", "gate"]);
    const fixed = stateOf([...requested, registerContract(v2), decide(h2, "approved")]);
    expect(taskState(fixed, "TASK-0001")).toBe("ready");
  });

  it("an approval cannot be revised either", () => {
    expectRejected([...prefix, decide(h1, "approved")], decide(h1, "changes_requested"), "APPROVAL_ALREADY_DECIDED");
  });

  it.each<[string, unknown[], unknown, string, unknown[]]>([
    ["unknown task", prefix, decide(h1, "approved", { taskId: "TASK-0009" }), "TASK_UNKNOWN", ["body", "taskId"]],
    ["unknown hash", prefix, decide("0".repeat(64), "approved"), "CONTRACT_UNKNOWN", ["body", "contentHash"]],
    ["hash of another task", [...prefix, registerTask("TASK-0002")], decide(h1, "approved", { taskId: "TASK-0002" }), "CONTRACT_UNKNOWN", ["body", "contentHash"]],
    ["superseded version", [...prefix, registerContract(v2)], decide(h1, "approved"), "CONTRACT_SUPERSEDED", ["body", "contentHash"]],
    ["changes requested without findings", prefix, decide(h1, "changes_requested", { findings: [] }), "FINDINGS_REQUIRED", ["body", "findings"]],
  ])("rejects %s", (_name, before, candidate, code, path) => {
    expectRejected(before, candidate, code, path);
  });

  it("allows non-blocking findings on an approval", () => {
    expect(stateOf([...prefix, decide(h1, "approved", { findings: [{ severity: "non_blocking", summary: "nit", location: "§3" }] })])).toBeTruthy();
  });

  describe("reviewer independence (policy different_provider)", () => {
    it.each<[string, object, boolean]>([
      ["the author itself", AUTHOR, false],
      ["another agent of the author's provider", ai("vendor-a", "second"), false],
      ["an agent of another provider", REVIEWER, true],
      ["a human", human("alice"), true],
      ["a human whose provider string equals the author's", { actorType: "human", provider: "vendor-a", model: null, label: "alice" }, true],
      ["a system actor", system(), false],
    ])("%s", (_name, reviewer, allowed) => {
      const candidate = decide(h1, "approved", { actor: reviewer });
      if (allowed) expect(kernel.applyEvent(stateOf(prefix), candidate).ok).toBe(true);
      else expectRejected(prefix, candidate, "REVIEWER_NOT_INDEPENDENT", ["actor"]);
    });

    it("a human author cannot approve their own contract", () => {
      const alice = human("alice");
      const own = [registerTask(), registerContract(v1, { actor: alice })];
      expectRejected(own, decide(h1, "approved", { actor: alice }), "REVIEWER_NOT_INDEPENDENT");
      expect(kernel.applyEvent(stateOf(own), decide(h1, "approved", { actor: human("bob") })).ok).toBe(true);
    });
  });

  describe("dependencies (no task acceptance exists in 0001A)", () => {
    const withDeps = (deps: object[]) => contractText(metadata({ dependencies: deps }));

    it("an unresolved dependency blocks approval", () => {
      const text = withDeps([{ taskId: "TASK-0002", acceptedCommit: null }]);
      const rejection = expectRejected([registerTask(), registerContract(text)], decide(hashOf(text), "approved"), "DEPENDENCY_UNRESOLVED");
      expect(rejection.subject).toBe("TASK-0002");
    });

    it("a resolved dependency is still not accepted in 0001A", () => {
      const text = withDeps([{ taskId: "TASK-0002", acceptedCommit: "4".repeat(40) }]);
      const prior = [registerTask(), registerTask("TASK-0002"), registerContract(text)];
      const rejection = expectRejected(prior, decide(hashOf(text), "approved"), "DEPENDENCY_NOT_ACCEPTED");
      expect(rejection.subject).toBe("TASK-0002");
    });

    it("reports the first failing dependency in declaration order", () => {
      const text = withDeps([
        { taskId: "TASK-0003", acceptedCommit: "4".repeat(40) },
        { taskId: "TASK-0002", acceptedCommit: null },
      ]);
      expect(rejectionOf([registerTask(), registerContract(text)], decide(hashOf(text), "approved"))!.subject).toBe("TASK-0003");
    });

    it("dependencies do not block changes_requested", () => {
      const text = withDeps([{ taskId: "TASK-0002", acceptedCommit: null }]);
      const state = stateOf([registerTask(), registerContract(text), decide(hashOf(text), "changes_requested")]);
      expect(contractRevisionState(state, "TASK-0001", hashOf(text))).toBe("changes_requested");
    });
  });
});

describe("projections", () => {
  it("unknown inputs project to null", () => {
    const { state } = approvedWorld();
    expect(contractRevisionState(state, "TASK-0001", "0".repeat(64))).toBeNull();
    expect(contractRevisionState(state, "TASK-0009", h1)).toBeNull();
    expect(currentContract(state, "TASK-0009")).toBeNull();
  });

  it("stores facts, not statuses", () => {
    const { state } = approvedWorld();
    const serialized = JSON.stringify(state);
    for (const word of ['"draft"', '"ready"', '"specifying"', '"superseded"', '"planned"']) {
      expect(serialized).not.toContain(word);
    }
  });

  it("tasks are independent", () => {
    const text2 = contractText(metadata({ taskId: "TASK-0002" }));
    const state: ForgeState = stateOf([
      registerTask(),
      registerTask("TASK-0002"),
      registerContract(v1),
      registerContract(text2, { taskId: "TASK-0002" }),
      decide(hashOf(text2), "approved", { taskId: "TASK-0002" }),
    ]);
    expect([taskState(state, "TASK-0001"), taskState(state, "TASK-0002")]).toEqual(["specifying", "ready"]);
    expect(OWNER).toBeTruthy();
  });
});
