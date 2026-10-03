import { describe, expect, it } from "vitest";
import { evaluateVerification, verifierIndependence, PROCESS_NOTE_PREFIX } from "../../src/forge/verification.ts";
import { runState, verificationOf, verifierIndependenceOf } from "../../src/forge/state.ts";
import { ai, human, stateOf, unfrozenPaths } from "./fixtures.ts";
import { DEV, approvedTask, mutation, observe, reportFor, startRun, verify } from "./run-fixtures.ts";

const meta = (overrides: Record<string, unknown> = {}) => ({
  scope: { create: ["src/a.ts"], modify: ["src/b.ts"] },
  requiredChecks: [
    { name: "typecheck", command: "npm run typecheck" },
    { name: "test", command: "npm test" },
  ],
  mutationSmoke: "optional" as "none" | "optional" | "required",
  ...overrides,
});
const okChecks = [
  { name: "typecheck", command: "npm run typecheck", exitCode: 0 },
  { name: "test", command: "npm test", exitCode: 0 },
];
const evidence = (overrides: Record<string, unknown> = {}) => ({
  changedFiles: [{ path: "src/a.ts", change: "added" as const }],
  checks: okChecks,
  mutations: null,
  ...overrides,
});
const failuresOf = (m: ReturnType<typeof meta>, e: ReturnType<typeof evidence>, reportMutations: unknown[] = []) => {
  const result = evaluateVerification(m as never, { mutations: reportMutations } as never, e as never);
  return result.passed ? [] : result.failures.map((f) => (f.subject === null ? f.code : `${f.code}:${f.subject}`));
};

describe("required checks", () => {
  it("passes when every required check ran with exit code 0", () => {
    expect(failuresOf(meta(), evidence())).toEqual([]);
  });

  it.each<[string, object[], string[]]>([
    ["a failing check", [okChecks[0]!, { ...okChecks[1]!, exitCode: 1 }], ["CHECK_FAILED:test"]],
    ["a missing check", [okChecks[0]!], ["CHECK_FAILED:test"]],
    ["same name, different command", [okChecks[0]!, { name: "test", command: "npm test -- --bail", exitCode: 0 }], ["CHECK_FAILED:test"]],
    ["negative exit code", [okChecks[0]!, { ...okChecks[1]!, exitCode: -1 }], ["CHECK_FAILED:test"]],
    ["no checks at all", [], ["CHECK_FAILED:test", "CHECK_FAILED:typecheck"]],
  ])("%s", (_name, checks, expected) => {
    expect(failuresOf(meta(), evidence({ checks }))).toEqual(expected);
  });

  it("extra checks do not hurt, but a passing duplicate cannot mask failure", () => {
    const checks = [...okChecks, { name: "lint", command: "npm run lint", exitCode: 1 }, { ...okChecks[1]!, exitCode: 1 }];
    expect(failuresOf(meta(), evidence({ checks: checks.slice(0, -1) }))).toEqual([]);
    expect(failuresOf(meta(), evidence({ checks }))).toEqual(["CHECK_FAILED:test"]);
  });
});

describe("scope", () => {
  it.each<[string, object[], string[]]>([
    ["added in create", [{ path: "src/a.ts", change: "added" }], []],
    ["modified in modify", [{ path: "src/b.ts", change: "modified" }], []],
    ["added outside create", [{ path: "src/c.ts", change: "added" }], ["SCOPE_VIOLATION:src/c.ts"]],
    ["modified a create-only path", [{ path: "src/a.ts", change: "modified" }], ["SCOPE_VIOLATION:src/a.ts"]],
    ["added a modify-only path", [{ path: "src/b.ts", change: "added" }], ["SCOPE_VIOLATION:src/b.ts"]],
    ["deleted a scoped path", [{ path: "src/b.ts", change: "deleted" }], ["SCOPE_VIOLATION:src/b.ts"]],
    ["renamed a scoped path", [{ fromPath: "src/a.ts", toPath: "src/b.ts", change: "renamed" }], ["SCOPE_VIOLATION:src/a.ts", "SCOPE_VIOLATION:src/b.ts"]],
    ["coordination note (F8)", [{ path: `${PROCESS_NOTE_PREFIX}CLAUDE.md`, change: "modified" }], []],
    ["deleted coordination note", [{ path: "forge/coordination/old.md", change: "deleted" }], ["SCOPE_VIOLATION:forge/coordination/old.md"]],
    ["contract file changed", [{ path: "forge/contracts/TASK-0001.md", change: "modified" }], ["SCOPE_VIOLATION:forge/contracts/TASK-0001.md"]],
    ["approval forged", [{ path: "forge/approvals/TASK-0001.v1.architecture_review.json", change: "added" }], ["SCOPE_VIOLATION:forge/approvals/TASK-0001.v1.architecture_review.json"]],
    ["other forge/ paths are not exempt", [{ path: "forge/notes.md", change: "added" }], ["SCOPE_VIOLATION:forge/notes.md"]],
    ["coordination prefix needs the slash", [{ path: "forge/coordination.md", change: "added" }], ["SCOPE_VIOLATION:forge/coordination.md"]],
  ])("%s", (_name, changedFiles, expected) => {
    expect(failuresOf(meta(), evidence({ changedFiles }))).toEqual(expected);
  });

  it("a contract cannot whitelist a forbidden path", () => {
    const m = meta({ scope: { create: ["forge/approvals/x.json"], modify: [] } });
    expect(failuresOf(m, evidence({ changedFiles: [{ path: "forge/approvals/x.json", change: "added" }] }))).toEqual(["SCOPE_VIOLATION:forge/approvals/x.json"]);
  });

  it("an empty diff is in scope", () => {
    expect(failuresOf(meta(), evidence({ changedFiles: [] }))).toEqual([]);
  });
});

describe("mutation results", () => {
  const required = meta({ mutationSmoke: "required" });

  it.each<[string, object[], string[]]>([
    ["all detected", [mutation("m1", "detected"), mutation("m2", "detected")], []],
    ["must_detect survived (P2)", [mutation("P2", "survived")], ["MUTATION_SURVIVED:P2"]],
    ["equivalent survived with rationale (K9)", [mutation("K9", "survived", "equivalent", "same error path")], []],
    ["equivalent without rationale", [mutation("K9", "survived", "equivalent", null)], ["MUTATION_EVIDENCE_INVALID:K9"]],
    ["rationale on must_detect", [mutation("m1", "detected", "must_detect", "why")], ["MUTATION_EVIDENCE_INVALID:m1"]],
    ["equivalent but detected", [mutation("m1", "detected", "equivalent", "x")], ["MUTATION_EVIDENCE_INVALID:m1"]],
    ["not_applied (O12)", [mutation("m1", "not_applied")], ["MUTATION_EVIDENCE_INVALID:m1"]],
    ["not_applied equivalent", [mutation("m1", "not_applied", "equivalent", "x")], ["MUTATION_EVIDENCE_INVALID:m1"]],
    ["duplicate names", [mutation("m1", "detected"), mutation("m1", "detected")], ["MUTATION_EVIDENCE_INVALID:m1"]],
    ["required but empty", [], ["MUTATION_EVIDENCE_INVALID"]],
  ])("required: %s", (_name, mutations, expected) => {
    expect(failuresOf(required, evidence({ mutations }))).toEqual(expected);
  });

  it("optional: an empty list is fine, a present list is checked", () => {
    expect(failuresOf(meta(), evidence({ mutations: [] }))).toEqual([]);
    expect(failuresOf(meta(), evidence({ mutations: [mutation("P2", "survived")] }))).toEqual(["MUTATION_SURVIVED:P2"]);
  });

  it("none: mutations are ignored", () => {
    const result = evaluateVerification(meta({ mutationSmoke: "none" }) as never, { mutations: [] } as never, evidence({ mutations: [mutation("x", "not_applied")] }) as never);
    expect(result).toEqual({ passed: true, mutationSource: "none" });
  });

  it("the verifier's results win over the developer's self-report", () => {
    const survivedInReport = [mutation("P2", "survived")];
    const r1 = evaluateVerification(required as never, { mutations: survivedInReport } as never, evidence({ mutations: [mutation("P2", "detected")] }) as never);
    expect(r1).toEqual({ passed: true, mutationSource: "verifier" });
    const r2 = evaluateVerification(required as never, { mutations: survivedInReport } as never, evidence({ mutations: null }) as never);
    expect(r2.passed).toBe(false);
    expect(r2.mutationSource).toBe("developer_report");
  });
});

describe("combined failures are sorted deterministically", () => {
  it("by code, then subject, null first", () => {
    const e = evidence({
      checks: [],
      changedFiles: [{ path: "z.ts", change: "added" }, { path: "a.ts", change: "deleted" }],
      mutations: [mutation("b", "survived"), mutation("a", "not_applied")],
    });
    expect(failuresOf(meta({ mutationSmoke: "required" }), e)).toEqual([
      "CHECK_FAILED:test",
      "CHECK_FAILED:typecheck",
      "MUTATION_EVIDENCE_INVALID:a",
      "MUTATION_SURVIVED:b",
      "SCOPE_VIOLATION:a.ts",
      "SCOPE_VIOLATION:z.ts",
    ]);
  });

  it("evaluations are frozen and inputs untouched", () => {
    const e = evidence({ checks: [] });
    const copy = structuredClone(e);
    const result = evaluateVerification(meta() as never, { mutations: [] } as never, e as never);
    expect(unfrozenPaths(result)).toEqual([]);
    expect(e).toEqual(copy);
  });
});

describe("verifier independence is recorded, not required (decision 2)", () => {
  it.each<[string, object, string]>([
    ["the developer itself", DEV, "same_identity"],
    ["another agent of the same provider", ai("vendor-a", "verifier"), "same_provider"],
    ["CI of another provider", ai("ci-runner", "ci"), "different_provider"],
    ["a human", human("alice"), "different_provider"],
  ])("%s verifies → %s, and the run is verified", (_name, verifier, expected) => {
    const { events } = approvedTask();
    const state = stateOf([...events, startRun("run:1"), reportFor("run:1"), observe("run:1"), verify("run:1", {}, verifier)]);
    expect(verifierIndependenceOf(state, "run:1")).toBe(expected);
    expect(runState(state, "run:1")).toBe("verified");
    expect(verificationOf(state, "run:1")!.passed).toBe(true);
  });

  it("pure helper agrees", () => {
    expect(verifierIndependence(DEV as never, DEV as never)).toBe("same_identity");
  });
});
