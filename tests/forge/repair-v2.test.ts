import { describe, expect, it } from "vitest";
import { ChangedFileSchema, VerificationEvidenceSchema, type ChangedFile } from "../../src/forge/runs.ts";
import { evaluateVerification } from "../../src/forge/verification.ts";
import { runState } from "../../src/forge/state.ts";
import { kernel, stateOf, unfrozenPaths } from "./fixtures.ts";
import { approvedTask, goodEvidence, observe, reportFor, startRun, verify } from "./run-fixtures.ts";

const meta = { scope: { create: ["src/a.ts"], modify: ["src/b.ts"] }, requiredChecks: [{ name: "test", command: "npm test" }], mutationSmoke: "none" as const };
const pass = { name: "test", command: "npm test", exitCode: 0 };
const fail = { ...pass, exitCode: 1 };
const rename = (fromPath: string, toPath: string): ChangedFile => ({ fromPath, toPath, change: "renamed" });
const evaluate = (changedFiles: ChangedFile[], checks = [pass]) => evaluateVerification(meta, { mutations: [] }, { changedFiles, checks, mutations: null });
const paths = ["forge/contracts/TASK-0001.md", "forge/approvals/a.json", "src/a.ts", "forge/coordinationX/a", "forge/coordination"];

describe("0001B v2 rename and scope", () => {
  it.each(paths)("neither rename direction exempts %s", (path) => {
    for (const [from, to] of [[path, "forge/coordination/a.md"], ["forge/coordination/a.md", path]] as const) {
      const files = [rename(from, to)];
      const before = structuredClone(files);
      const result = evaluate(files);
      expect(result).toEqual({ passed: false, mutationSource: "none", failures: [from, to].sort().map(subject => ({ code: "SCOPE_VIOLATION", subject })) });
      expect(files).toEqual(before);
      expect(unfrozenPaths(result)).toEqual([]);
    }
  });

  it("allows only coordination-to-coordination moves, including nested paths", () => {
    expect(evaluate([rename("forge/coordination/a.md", "forge/coordination/notes/b.md")]).passed).toBe(true);
    expect(evaluate([rename("src/a.ts", "src/b.ts")]).passed).toBe(false);
  });

  it.each(["forge/coordination/a.md", "src/b.ts"])("deleted is never exempt: %s", (path) => {
    expect(evaluate([{ path, change: "deleted" }]).passed).toBe(false);
  });

  it.each(["forge/contracts", "forge/approvals", "forge/contracts/a.md", "forge/approvals/a.json"])("protected paths cannot be whitelisted: %s", (path) => {
    const m = { ...meta, scope: { create: [path], modify: [path] } };
    for (const change of ["added", "modified"] as const) {
      const result = evaluateVerification(m, { mutations: [] }, { changedFiles: [{ path, change }], checks: [pass], mutations: null });
      expect(result.passed).toBe(false);
    }
  });

  it.each(["added", "modified"] as const)("coordination %s remains exempt", change => {
    expect(evaluate([{ path: "forge/coordination/notes/a.md", change }]).passed).toBe(true);
  });
});

describe("0001B v2 strict rename evidence", () => {
  it.each([
    { path: "forge/coordination/TASK-0001.md", change: "renamed" },
    { fromPath: "a", change: "renamed" }, { toPath: "b", change: "renamed" },
    { fromPath: "a", toPath: "b", path: "a", change: "renamed" },
    { path: "a", fromPath: "b", change: "added" },
    { path: "a", change: "copied" },
  ])("rejects malformed ChangedFile %#", raw => {
    expect(ChangedFileSchema.safeParse(raw).success).toBe(false);
  });

  it.each(["forge/coordination/../contracts/a", "../a", "forge//coordination/a", "forge\\coordination\\a", "forge/coordinаtion/a", "forge/coordination／a"])("rejects invalid endpoint %s", path => {
    for (const f of [rename(path, "b"), rename("a", path)]) {
      expect(ChangedFileSchema.safeParse(f).success).toBe(false);
    }
  });

  it.each([
    [[rename("a", "a")], [0, "toPath"]],
    [[rename("a", "b"), rename("b", "c")], [1, "fromPath"]],
    [[rename("a", "b"), { path: "b", change: "modified" }], [1, "path"]],
    [[{ path: "b", change: "added" }, rename("a", "b")], [1, "toPath"]],
  ])("rejects duplicate endpoints with exact path %#", (changedFiles, suffix) => {
    const parsed = VerificationEvidenceSchema.safeParse(goodEvidence("run:1", { changedFiles }));
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]!.path).toEqual(["changedFiles", ...suffix as (string | number)[]]);
  });

  it("preserves distinct rename endpoints after strict parsing", () => {
    const input = goodEvidence("run:1", { changedFiles: [rename("a", "b")] });
    const parsed = VerificationEvidenceSchema.parse(input);
    expect(parsed.changedFiles).toEqual([rename("a", "b")]);
    expect(parsed.changedFiles[0]).not.toBe(input.changedFiles[0]);
  });
});

describe("0001B v2 required check cardinality", () => {
  it.each([[pass, pass], [fail, pass], [pass, fail], [{ ...pass, command: "wrong" }, pass]].map(checks => ({ checks })))("rejects duplicate required checks %#", ({ checks }) => {
    expect(evaluate([], checks)).toEqual({ passed: false, mutationSource: "none", failures: [{ code: "CHECK_FAILED", subject: "test" }] });
    const parsed = VerificationEvidenceSchema.safeParse(goodEvidence("run:1", { checks }));
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]!.path).toEqual(["checks", 1, "name"]);
  });

  it.each([[], [{ ...pass, command: "npm  test" }], [fail], [{ ...pass, exitCode: -1 }], [{ ...pass, name: "Test" }]].map(checks => ({ checks })))("cannot satisfy a required check %#", ({ checks }) => {
    expect(evaluate([], checks).passed).toBe(false);
  });

  it("extra non-required checks cannot mask missing checks; unique failures are informational", () => {
    const extra = { name: "lint", command: "npm run lint", exitCode: 1 };
    expect(evaluate([], [pass, extra]).passed).toBe(true);
    expect(evaluate([], [extra]).passed).toBe(false);
    expect(VerificationEvidenceSchema.safeParse(goodEvidence("run:1", { checks: [pass, extra, extra] })).success).toBe(false);
  });
});

describe("0001B v2 kernel boundary", () => {
  const { events, contentHash } = approvedTask();
  const prefix = [...events, startRun("run:1", { contentHash }), reportFor("run:1"), observe("run:1")];

  it.each([
    { changedFiles: [{ path: "forge/coordination/TASK-0001.md", change: "renamed" }] },
    { checks: [fail, pass] },
  ])("schema-invalid evidence never enters the log %#", override => {
    const state = stateOf(prefix);
    const before = structuredClone(state);
    const e = verify("run:1", override);
    const result = kernel.applyEvent(state, e);
    expect(!result.ok && result.rejection.code).toBe("EVENT_SCHEMA");
    const replay = kernel.replay([...prefix, e]);
    expect(!replay.ok && replay.index).toBe(prefix.length);
    expect(state).toEqual(before);
    expect(runState(state, "run:1")).toBe("remote_verified");
  });

  it("valid but forbidden rename evidence produces failed, not a schema rejection", () => {
    const state = stateOf([...prefix, verify("run:1", { changedFiles: [rename("forge/contracts/a.md", "forge/coordination/a.md")] })]);
    expect(runState(state, "run:1")).toBe("failed");
  });

  it("valid coordination move and empty diff remain verifiable", () => {
    for (const changedFiles of [[], [rename("forge/coordination/a", "forge/coordination/b")]]) {
      const state = stateOf([...prefix, verify("run:1", { changedFiles })]);
      expect(runState(state, "run:1")).toBe("verified");
    }
  });
});
