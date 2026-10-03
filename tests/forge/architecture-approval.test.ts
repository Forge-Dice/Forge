import { describe, expect, it } from "vitest";
import { contractText, decide, hashOf, kernel, metadata, registerContract, registerTask, stateOf, AUTHOR } from "./fixtures.ts";

const nonblocking = { severity: "non_blocking", summary: "nit", location: null };
const blocking = { severity: "blocking", summary: "unresolved", location: null };
const text = contractText();
const prefix = [registerTask(), registerContract(text)];
const lists = [[], [nonblocking], [blocking], [nonblocking, blocking]];

describe("0001A-PATCH-0001 architecture findings", () => {
  it.each([
    ["approved", 0, null], ["approved", 1, null],
    ["approved", 2, "VERDICT_INCONSISTENT"], ["approved", 3, "VERDICT_INCONSISTENT"],
    ["changes_requested", 0, "FINDINGS_REQUIRED"], ["changes_requested", 1, null],
    ["changes_requested", 2, null], ["changes_requested", 3, null],
  ] as const)("%s with findings list %i", (verdict, index, code) => {
    const state = stateOf(prefix);
    const before = structuredClone(state);
    const e = decide(hashOf(text), verdict, { findings: lists[index]! });
    const applied = kernel.applyEvent(state, e);
    const replayed = kernel.replay([...prefix, e]);
    expect(state).toEqual(before);
    expect(applied.ok).toBe(code === null);
    if (code === null) {
      expect(replayed.ok && replayed.state).toEqual(applied.ok && applied.state);
    } else {
      const rejection = { code, path: ["body", code === "FINDINGS_REQUIRED" ? "findings" : "verdict"], subject: null, issues: [] };
      expect(applied).toEqual({ ok: false, rejection });
      expect(replayed).toEqual({ ok: false, index: prefix.length, rejection });
      expect(state.log).toHaveLength(prefix.length);
      expect(state.tasks[0]!.contracts[0]!.decisions).toEqual([]);
    }
  });

  it("retains prior validation precedence and checks findings before dependencies", () => {
    const e = decide(hashOf(text), "approved", { actor: AUTHOR, findings: [blocking] });
    const sameAuthor = kernel.applyEvent(stateOf(prefix), e);
    expect(!sameAuthor.ok && sameAuthor.rejection.code).toBe("REVIEWER_NOT_INDEPENDENT");
    const unknown = kernel.applyEvent(kernel.emptyState(), e);
    expect(!unknown.ok && unknown.rejection.code).toBe("TASK_UNKNOWN");
    const dependent = contractText(metadata({ dependencies: [{ taskId: "TASK-0002", acceptedCommit: null }] }));
    const state = stateOf([registerTask(), registerContract(dependent)]);
    const result = kernel.applyEvent(state, decide(hashOf(dependent), "approved", { findings: [blocking] }));
    expect(!result.ok && result.rejection.code).toBe("VERDICT_INCONSISTENT");
  });
});
