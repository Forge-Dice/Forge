import { describe, expect, it } from "vitest";
import { isAncestorOrSelf } from "../../src/forge/ancestry.ts";
import { ForgeEventSchema } from "../../src/forge/events.ts";
import { isIndependentReviewer, type AgentIdentity } from "../../src/forge/identity.ts";
import { runState, taskState, type ForgeState } from "../../src/forge/state.ts";
import { evaluateVerification, remoteOutcome } from "../../src/forge/verification.ts";
import { contractText, decide, hashOf, kernel, metadata, registerContract, registerTask, stateOf } from "../forge/fixtures.ts";
import {
  CONTENT_HASH,
  DEV,
  RESULT,
  SHA,
  accept,
  approvedTask,
  mutation,
  observe,
  reportFor,
  review,
  runGraph,
  startRun,
  verifiedRun,
  verify,
} from "../forge/run-fixtures.ts";

// Red-team characterisation tests (FORGE-CORE-0001AB red team, see forge/reviews/FORGE-CORE-0001AB.red-team.md; outside the contracted tests/forge scope on purpose).
// Tests named "RT-xx documents" pin CURRENT behaviour that the red-team report classifies as a
// finding or a deliberate limit. They are expected to flip when a later contract changes the rule.

const META = { scope: { create: ["src/a.ts"], modify: ["src/b.ts"] }, requiredChecks: [{ name: "test", command: "npm test" }], mutationSmoke: "optional" as const };
const evaluate = (changedFiles: import("../../src/forge/runs.ts").ChangedFile[], checks = [{ name: "test", command: "npm test", exitCode: 0 }]) =>
  evaluateVerification(META, { mutations: [] }, { changedFiles, checks, mutations: null });

describe("RT verification scope", () => {
  it("RT-01 regression: both rename endpoints determine the coordination exception", () => {
    expect(evaluate([{ fromPath: "forge/contracts/TASK-0001.md", toPath: "forge/coordination/TASK-0001.md", change: "renamed" }]).passed).toBe(false);
    expect(evaluate([{ fromPath: "forge/coordination/TASK-0001.md", toPath: "src/evil.ts", change: "renamed" }]).passed).toBe(false);
    expect(evaluate([{ fromPath: "forge/coordination/old.md", toPath: "forge/coordination/new.md", change: "renamed" }]).passed).toBe(true);
  });

  it("RT-02 documents: the coordination exemption covers every agent's coordination file", () => {
    expect(evaluate([{ path: "forge/coordination/CODEX.md", change: "modified" }]).passed).toBe(true);
    expect(evaluate([{ path: "forge/coordination/CODEX.md", change: "deleted" }]).passed).toBe(false); // v2: deletion is never exempt
  });

  it("prefix tricks around the coordination exemption do not bypass the scope", () => {
    expect(evaluate([{ path: "forge/coordinationX/a", change: "added" }]).passed).toBe(false);
    expect(evaluate([{ path: "forge/coordination", change: "added" }]).passed).toBe(false);
    expect(evaluate([{ path: "Forge/contracts/X.md", change: "added" }]).passed).toBe(false);
    for (const path of ["forge/coordination/../contracts/x", "forge//coordination/a", "./forge/coordination/a", "forge\\coordination\\a", "forge/coordinаtion/a"]) {
      const evidence = { runId: "run:1", verifiedCommit: RESULT, method: "fresh_clone", changedFiles: [{ path, change: "added" }], checks: [], mutations: null };
      expect(kernel.applyEvent(kernel.emptyState(), { actor: DEV, role: "verifier", recordedAt: null, body: { type: "verification_recorded", evidence } }).ok).toBe(false);
      expect(ForgeEventSchema.safeParse({ actor: DEV, role: "verifier", recordedAt: null, body: { type: "verification_recorded", evidence } }).success).toBe(false);
    }
  });

  it("RT-03 regression: contradictory duplicate checks cannot mask a failure", () => {
    const contradictory = [
      { name: "test", command: "npm test", exitCode: 1 },
      { name: "test", command: "npm test", exitCode: 0 },
    ];
    expect(evaluate([{ path: "src/a.ts", change: "added" }], contradictory).passed).toBe(false);
    // name and command are both required; extra checks never matter
    expect(evaluate([], [{ name: "tests", command: "npm test", exitCode: 0 }]).passed).toBe(false);
    expect(evaluate([], [{ name: "test", command: "npm  test", exitCode: 0 }]).passed).toBe(false);
    expect(evaluate([], [{ name: "test", command: "npm test", exitCode: -0 }, { name: "x", command: "y", exitCode: 2 ** 31 }]).passed).toBe(true);
  });

  it("empty diff with result == start commit is verifiable (R11, contract silent)", () => {
    const run = { startedFromCommit: SHA.contract, report: { claimedResultCommit: SHA.contract, claimedRemoteRef: "b" } };
    expect(remoteOutcome(run, { ref: "b", head: SHA.contract, parents: {} })).toBe("contained");
    expect(evaluate([]).passed).toBe(true);
  });
});

describe("RT mutation evidence matrix (FORGE-CORE-0001B §8)", () => {
  const evalMut = (smoke: "none" | "optional" | "required", report: object[], verifier: object[] | null) =>
    evaluateVerification({ ...META, mutationSmoke: smoke }, { mutations: report as never }, { changedFiles: [], checks: META.requiredChecks.map((c) => ({ ...c, exitCode: 0 })), mutations: verifier as never });
  const cases: [string, object, boolean][] = [
    ["must_detect detected", mutation("a", "detected"), true],
    ["must_detect survived", mutation("a", "survived"), false],
    ["must_detect not_applied", mutation("a", "not_applied"), false],
    ["must_detect with rationale", mutation("a", "detected", "must_detect", "why"), false],
    ["equivalent survived with rationale", mutation("a", "survived", "equivalent", "same"), true],
    ["equivalent survived without rationale", mutation("a", "survived", "equivalent", null), false],
    ["equivalent detected", mutation("a", "detected", "equivalent", "same"), false],
    ["equivalent not_applied", mutation("a", "not_applied", "equivalent", "same"), false],
  ];
  it.each(cases)("%s", (_, m, passed) => {
    expect(evalMut("required", [m], null).passed).toBe(passed);
    expect(evalMut("optional", [m], null).passed).toBe(passed);
    expect(evalMut("none", [m], null).passed).toBe(true);
  });

  it("duplicate names, empty lists and the verifier list replacing the developer list", () => {
    expect(evalMut("required", [mutation("a", "detected"), mutation("a", "detected")], null).passed).toBe(false);
    expect(evalMut("required", [], null).passed).toBe(false);
    expect(evalMut("optional", [], null).passed).toBe(true);
    // RT-04 documents: the verifier's list replaces the developer's; a developer-reported survivor disappears
    const verdict = evalMut("required", [mutation("a", "survived")], [mutation("b", "detected")]);
    expect(verdict).toEqual({ passed: true, mutationSource: "verifier" });
    expect(evalMut("required", [mutation("a", "detected")], []).passed).toBe(false);
  });

  it("acknowledgements are a set: order irrelevant, subset and superset rejected", () => {
    const eq = [mutation("x", "survived", "equivalent", "same"), mutation("y", "survived", "equivalent", "same")];
    const { events } = verifiedRun("run:1", { mutationSmoke: "required" });
    const withMutations = events.map((e) => ((e as { body: { type: string } }).body.type === "developer_report_recorded" ? reportFor("run:1", { mutations: eq }) : e));
    const state = stateOf(withMutations);
    expect(kernel.applyEvent(state, review("run:1", "approve", { ack: ["y", "x"] })).ok).toBe(true);
    expect(kernel.applyEvent(state, review("run:1", "approve", { ack: ["x"] })).ok).toBe(false);
    expect(kernel.applyEvent(state, review("run:1", "approve", { ack: ["x", "y", "z"] })).ok).toBe(false);
    expect(kernel.applyEvent(state, review("run:1", "approve", { ack: ["x", "x", "y"] })).ok).toBe(false);
  });
});

describe("RT identity and independence (FORGE-CORE-0001A §5)", () => {
  const id = (actorType: string, provider: string, label: string, model: string | null = null) => ({ actorType, provider, model, label }) as AgentIdentity;
  const author = id("ai_agent", "vendor-a", "author", "m1");
  const rows: [string, AgentIdentity, boolean, boolean][] = [
    // [case, reviewer, different_identity, different_provider]
    ["exactly the author", author, false, false],
    ["same AI, other label (Sybil)", id("ai_agent", "vendor-a", "author-2", "m1"), true, false],
    ["same AI, other model", id("ai_agent", "vendor-a", "author", "m2"), true, false],
    ["same provider, other identity", id("ai_agent", "vendor-a", "reviewer"), true, false],
    ["provider spelled differently (Sybil)", id("ai_agent", "vendor-a2", "author", "m1"), true, true],
    ["other provider", id("ai_agent", "vendor-b", "reviewer"), true, true],
    ["human, same provider string", id("human", "vendor-a", "author", "m1"), true, true],
    ["system reviewer", id("system", "vendor-b", "forge"), false, false],
  ];
  it.each(rows)("%s", (_, reviewer, differentIdentity, differentProvider) => {
    expect(isIndependentReviewer(author, reviewer, { aiReviewIndependence: "different_identity" })).toBe(differentIdentity);
    expect(isIndependentReviewer(author, reviewer, { aiReviewIndependence: "different_provider" })).toBe(differentProvider);
  });

  it("human vs human needs only another identity; provider slugs are case-checked by the schema", () => {
    expect(isIndependentReviewer(id("human", "human", "a"), id("human", "human", "b"), { aiReviewIndependence: "different_provider" })).toBe(true);
    expect(isIndependentReviewer(id("human", "human", "a"), id("human", "human", "a"), { aiReviewIndependence: "different_provider" })).toBe(false);
    const parse = (provider: string) => ForgeEventSchema.safeParse(registerTask("TASK-0001", { actorType: "human", provider, model: null, label: "x" })).success;
    expect([parse("Vendor-A"), parse(" vendor-a"), parse(""), parse("-a"), parse("vendor_a"), parse("a".repeat(64)), parse("a".repeat(65))]).toEqual([false, false, false, false, true, true, false]);
  });

  it("RT-05 documents: actor type and role are self-declared; one identity may develop, observe and verify its own run", () => {
    const { events, contentHash } = approvedTask();
    const self = DEV;
    const log = [
      ...events,
      startRun("run:1", { contentHash }),
      reportFor("run:1"),
      { actor: self, role: "observer", recordedAt: null, body: { type: "remote_observed", runId: "run:1", ref: "claude/branch", head: RESULT, parents: runGraph() } },
      verify("run:1", {}, self),
    ];
    const state = stateOf(log);
    expect(runState(state, "run:1")).toBe("verified");
    // an AI that declares itself human can accept
    const declaredHuman = { actorType: "human", provider: "vendor-a", model: null, label: "developer" };
    const accepted = stateOf([...log, review("run:1", "approve"), accept("run:1", declaredHuman)]);
    expect(taskState(accepted, "TASK-0001")).toBe("accepted");
  });
});

describe("RT state machine corners", () => {
  it("RT-06 regression: an architecture approval cannot carry a blocking finding", () => {
    const text = contractText(metadata());
    const state = stateOf([registerTask(), registerContract(text)]);
    const result = kernel.applyEvent(state, decide(hashOf(text), "approved", { findings: [{ severity: "blocking", summary: "unresolved", location: null }] }));
    expect(result).toEqual({ ok: false, rejection: { code: "VERDICT_INCONSISTENT", path: ["body", "verdict"], subject: null, issues: [] } });
    expect(taskState(state, "TASK-0001")).toBe("specifying");
  });

  it("RT-07 documents: a new contract version may be registered while a run is active; the run finishes on a superseded revision", () => {
    const { events, contentHash } = approvedTask();
    const v2 = contractText(metadata({ contractVersion: 2, scope: { create: ["src/a.ts"], modify: ["src/b.ts"] } }));
    const log = [...events, startRun("run:1", { contentHash }), registerContract(v2), decide(hashOf(v2), "approved"), reportFor("run:1"), observe("run:1"), verify("run:1")];
    const state = stateOf(log);
    expect(runState(state, "run:1")).toBe("verified");
    expect(taskState(state, "TASK-0001")).toBe("ready"); // verified work on v1 is silently discarded
    expect(kernel.applyEvent(state, review("run:1", "approve")).ok).toBe(false);
  });

  it("RT-08 documents: a dependency cycle can never be approved and has no own diagnostic", () => {
    const a = contractText(metadata({ taskId: "TASK-000A", dependencies: [{ taskId: "TASK-000B", acceptedCommit: SHA.dep }] }));
    const b = contractText(metadata({ taskId: "TASK-000B", dependencies: [{ taskId: "TASK-000A", acceptedCommit: SHA.dep }] }));
    const state = stateOf([registerTask("TASK-000A"), registerTask("TASK-000B"), registerContract(a, { taskId: "TASK-000A" }), registerContract(b, { taskId: "TASK-000B" })]);
    for (const [taskId, text] of [["TASK-000A", a], ["TASK-000B", b]] as const) {
      const result = kernel.applyEvent(state, decide(hashOf(text), "approved", { taskId }));
      expect(!result.ok && result.rejection.code).toBe("DEPENDENCY_NOT_ACCEPTED");
    }
  });

  it("RT-09 documents: after remote_verified no further observation can be recorded (a later force-push is invisible)", () => {
    const { events, contentHash } = approvedTask();
    const state = stateOf([...events, startRun("run:1", { contentHash }), reportFor("run:1"), observe("run:1")]);
    const gone = kernel.applyEvent(state, observe("run:1", { head: SHA.contract }));
    expect(!gone.ok && gone.rejection.code).toBe("RUN_STATE_INVALID");
  });

  it("RT-10 documents: applyEvent trusts the supplied state; a forged state diverges from its own log", () => {
    const { events } = verifiedRun();
    const real = stateOf(events);
    const forged = structuredClone(real) as unknown as { tasks: { acceptance: unknown }[] };
    forged.tasks[0]!.acceptance = { runId: "run:1", owner: { actorType: "human", provider: "human", model: null, label: "nobody" } };
    const next = kernel.applyEvent(forged as unknown as ForgeState, registerTask("TASK-0002"));
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(taskState(next.state, "TASK-0001")).toBe("accepted");
    const replayed = kernel.replay(next.state.log);
    expect(replayed.ok && taskState(replayed.state, "TASK-0001")).toBe("awaiting_review");
  });
});

describe("RT JavaScript object attacks", () => {
  const actor = { actorType: "human", provider: "human", model: null, label: "o" };
  const body = () => ({ type: "task_registered", taskId: "TASK-0001", title: "t" });

  it("own __proto__, constructor and prototype keys are rejected by strict schemas; the input is never mutated", () => {
    const cases = [
      JSON.parse(`{"actor":${JSON.stringify(actor)},"role":"owner","recordedAt":null,"body":{"type":"task_registered","taskId":"TASK-0001","title":"t"},"__proto__":{"x":1}}`),
      JSON.parse(`{"actor":${JSON.stringify(actor)},"role":"owner","recordedAt":null,"body":{"type":"task_registered","taskId":"TASK-0001","title":"t","__proto__":{"x":1}}}`),
      { actor, role: "owner", recordedAt: null, body: { ...body(), constructor: "x" } },
      { actor, role: "owner", recordedAt: null, body: body(), prototype: {} },
    ];
    for (const raw of cases) {
      const snapshot = JSON.stringify(raw);
      const result = kernel.applyEvent(kernel.emptyState(), raw);
      expect(!result.ok && result.rejection.code).toBe("EVENT_SCHEMA");
      expect(JSON.stringify(raw)).toBe(snapshot);
    }
  });

  it("frozen and null-prototype inputs are accepted; the log stores own plain copies", () => {
    const frozen = Object.freeze({ actor: Object.freeze({ ...actor }), role: "owner", recordedAt: null, body: Object.freeze(body()) });
    const nullProto = Object.assign(Object.create(null), { actor, role: "owner", recordedAt: null, body: body() });
    for (const raw of [frozen, nullProto]) {
      const result = kernel.applyEvent(kernel.emptyState(), raw);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.state.log[0]).not.toBe(raw);
        expect(Object.getPrototypeOf(result.state.log[0])).toBe(Object.prototype);
      }
    }
  });

  it("RT-11 documents: inherited properties are read, symbol and non-enumerable extras are silently dropped", () => {
    const inherited = Object.create({ actor, role: "owner", recordedAt: null, body: body() });
    const withSymbol = { actor, role: "owner", recordedAt: null, body: body(), [Symbol("s")]: 1 };
    const hidden = { actor, role: "owner", recordedAt: null, body: body() };
    Object.defineProperty(hidden, "secret", { value: 1, enumerable: false });
    for (const raw of [inherited, withSymbol, hidden]) {
      const result = kernel.applyEvent(kernel.emptyState(), raw);
      expect(result.ok).toBe(true);
      if (result.ok) expect(Object.keys(result.state.log[0]!)).toEqual(["actor", "role", "recordedAt", "body"]);
    }
  });

  it("RT-12 documents: a throwing getter or proxy trap escapes applyEvent as an exception (state untouched)", () => {
    const state = kernel.emptyState();
    const getter = { actor, role: "owner", recordedAt: null, get body() { throw new Error("getter"); } };
    const proxy = new Proxy({ actor, role: "owner", recordedAt: null, body: body() }, { ownKeys() { throw new Error("trap"); } });
    expect(() => kernel.applyEvent(state, getter)).toThrow("getter");
    expect(() => kernel.applyEvent(state, proxy)).toThrow("trap");
    expect(() => kernel.replay([getter])).toThrow("getter");
    expect(state.log).toEqual([]);
  });

  it("a getter is evaluated once: the log holds the parsed value, not a later one", () => {
    let reads = 0;
    const raw = { actor, role: "owner", recordedAt: null, get body() { reads++; return { type: "task_registered", taskId: reads === 1 ? "TASK-0001" : "TASK-9999", title: "t" }; } };
    const result = kernel.applyEvent(kernel.emptyState(), raw);
    expect(result.ok && result.state.tasks.map((t) => t.taskId)).toEqual(["TASK-0001"]);
    expect(reads).toBe(1);
  });
});

describe("RT trust boundary: witnessed graphs", () => {
  const C = SHA.contract;
  it("ancestry follows every parent, terminates on cycles, and missing or false edges are taken at face value", () => {
    expect(isAncestorOrSelf(C, RESULT, { [RESULT]: ["f".repeat(40), C] })).toBe(true); // second parent of a merge
    expect(isAncestorOrSelf(C, RESULT, { [RESULT]: [C], [C]: [RESULT] })).toBe(true); // cycle
    expect(isAncestorOrSelf("a".repeat(40), RESULT, { [RESULT]: [C], [C]: [RESULT] })).toBe(false); // cycle terminates
    expect(isAncestorOrSelf(C, RESULT, {})).toBe(false); // incomplete graph blocks
    expect(isAncestorOrSelf(C, RESULT, { [RESULT]: [C] })).toBe(true); // a false edge cannot be detected
  });

  it("the start gate with several refs, a contract commit only behind a merge, and a ref to an unknown commit", () => {
    const { events, contentHash } = approvedTask();
    const state = stateOf(events);
    const merge = "e".repeat(40);
    const decision = kernel.canStartDeveloperRun(state, {
      taskId: "TASK-0001",
      contentHash,
      repoObservation: {
        refs: { "unknown": "f".repeat(40), "main": merge },
        parents: { [merge]: ["f".repeat(40), SHA.contract], [SHA.contract]: [SHA.base] },
        contractAtCommit: { commit: SHA.contract, path: "forge/contracts/TASK-0001.md", contentHash },
      },
    });
    expect(decision).toEqual({ allowed: true, startFromCommit: SHA.contract });
    void CONTENT_HASH;
  });

  it("a remote head that moved backwards or lost the result is not contained", () => {
    const run = { startedFromCommit: SHA.contract, report: { claimedResultCommit: RESULT, claimedRemoteRef: "b" } };
    expect(remoteOutcome(run, { ref: "b", head: SHA.contract, parents: runGraph() })).toBe("not_contained");
    expect(remoteOutcome(run, { ref: "c", head: RESULT, parents: runGraph() })).toBe("not_contained");
    expect(remoteOutcome(run, { ref: "b", head: RESULT, parents: {} })).toBe("not_contained"); // head == result needs no edge, start ancestry does
  });
});
