import { describe, expect, it } from "vitest";
import {
  createCaseSolutionSchema,
  evaluateConclusionClaim,
  parseCaseSolution,
  type ConclusionStatus,
} from "../src/domain/case-solution.ts";
import { baseSolution } from "./case-solution.fixture.ts";
import { S1atT2, T1, caused, intent, mech, nobody, resp, role, solution } from "./case-accusation.fixture.ts";

// evaluateConclusionClaim against the TASK-0003 parser as black-box oracle (O1).
// No status is ever computed from resolution fields here.

type Mutation = (s: any) => void;

const truth = T1();
const schema = createCaseSolutionSchema(truth);

function variant(mutate: Mutation) {
  const s: any = baseSolution();
  mutate(s);
  return s;
}

const accepts = (input: unknown) => schema.safeParse(input).success;

// Local copy of the statusOf probe in tests/case-solution.test.ts: a conclusion is true
// if only `value: true` can be required, false if only `value: false`, undetermined if neither.
function statusOf(resolution: Mutation, claim: object): ConclusionStatus {
  const probe = (value: boolean) =>
    accepts(
      variant((s) => {
        resolution(s.resolutions[0]);
        s.conclusions = [{ id: "conclusion:probe", claim }];
        s.requiredConclusions = [{ conclusionId: "conclusion:probe", value }];
      }),
    );
  const asTrue = probe(true);
  const asFalse = probe(false);
  if (asTrue && asFalse) throw new Error("a conclusion cannot be both true and false");
  return asTrue ? true : asFalse ? false : "undetermined";
}

/** A valid solution carrying the given death resolution, anchored by an always-true direct cause. */
function solutionWith(resolution: Mutation) {
  return parseCaseSolution(
    variant((s) => {
      resolution(s.resolutions[0]);
      s.conclusions = [{ id: "conclusion:anchor", claim: caused("poisoning") }];
      s.requiredConclusions = [{ conclusionId: "conclusion:anchor", value: true }];
    }),
    truth,
  );
}

function statusVia(resolution: Mutation, claim: object): ConclusionStatus {
  const result = evaluateConclusionClaim(truth, solutionWith(resolution), claim);
  if (!result.success) throw new Error(result.code);
  return result.status;
}

const responsibility = (completeness: string, assignments: object[]): Mutation => (r) => {
  r.responsibility = { completeness, assignments };
};
const A_ACTOR = { personId: "person:a", roles: ["direct_actor"] };
const A_UNKNOWN_ROLE = { personId: "person:a", roles: null };

// ---------- Grid ----------

const ROLES = ["direct_actor", "planner", "facilitator"];
const PERSONS = ["a", "b", "c"];
const ASSIGNMENTS: object[][] = [
  [],
  [A_ACTOR],
  [A_UNKNOWN_ROLE],
  [
    { personId: "person:a", roles: ["direct_actor", "planner"] },
    { personId: "person:b", roles: ["facilitator"] },
  ],
  [{ personId: "person:b", roles: null }],
];
const RESPONSIBILITY_CLAIMS = [
  ...PERSONS.map((p) => resp(p)),
  ...PERSONS.flatMap((p) => ROLES.map((r) => role(p, r))),
  nobody(),
];

type Pair = [string, Mutation, object];
const grid: Pair[] = [];
for (const completeness of ["complete", "partial"]) {
  ASSIGNMENTS.forEach((assignments, i) => {
    for (const claim of RESPONSIBILITY_CLAIMS) {
      grid.push([`${completeness}/assign${i}/${JSON.stringify(claim)}`, responsibility(completeness, assignments), claim]);
    }
  });
}
for (const causesComplete of [true, false]) {
  for (const cause of ["poisoning", "purchase", "storm"]) {
    grid.push([`causesComplete=${causesComplete}/${cause}`, (r) => (r.causesComplete = causesComplete), caused(cause)]);
  }
}
for (const value of [null, "intended", "unintended", "not_applicable"]) {
  for (const claimed of ["intended", "unintended", "not_applicable"]) {
    grid.push([`intent=${value}/${claimed}`, (r) => (r.intent = value), intent(claimed)]);
  }
}
for (const value of [null, "ordinary", "supernatural", "mixed"]) {
  for (const claimed of ["ordinary", "supernatural", "mixed"]) {
    grid.push([`mechanism=${value}/${claimed}`, (r) => (r.mechanism = value), mech(claimed)]);
  }
}

describe("AC-03 / AC-E6: differential against the parser oracle", () => {
  it("the grid is not trivial", () => {
    expect(grid.length).toBeGreaterThanOrEqual(160);
    const seen = new Set(grid.map(([, resolution, claim]) => statusOf(resolution, claim)));
    expect([...seen].sort()).toEqual([false, true, "undetermined"].sort());
  });

  it.each(grid)("%s", (_name, resolution, claim) => {
    expect(statusVia(resolution, claim)).toBe(statusOf(resolution, claim));
  });
});

describe("AC-E6: TASK-0003 AC-07 examples", () => {
  it.each<[string, Mutation, object, ConclusionStatus]>([
    ["responsible: assigned", responsibility("complete", [A_ACTOR]), resp("a"), true],
    ["responsible: assigned with unknown role", responsibility("partial", [A_UNKNOWN_ROLE]), resp("a"), true],
    ["responsible: missing, complete", responsibility("complete", [A_ACTOR]), resp("b"), false],
    ["responsible: missing, partial", responsibility("partial", [A_ACTOR]), resp("b"), "undetermined"],
    ["role: known list contains role", responsibility("complete", [A_ACTOR]), role("a", "direct_actor"), true],
    ["role: known list lacks role", responsibility("complete", [A_ACTOR]), role("a", "planner"), false],
    ["role: known list lacks role, responsibility partial", responsibility("partial", [A_ACTOR]), role("a", "planner"), false],
    ["role: roles null", responsibility("complete", [A_UNKNOWN_ROLE]), role("a", "planner"), "undetermined"],
    ["role: person missing, complete", responsibility("complete", [A_ACTOR]), role("b", "direct_actor"), false],
    ["role: person missing, partial", responsibility("partial", [A_ACTOR]), role("b", "direct_actor"), "undetermined"],
    ["nobody: complete, no assignments", responsibility("complete", []), nobody(), true],
    ["nobody: complete, one assignment", responsibility("complete", [A_ACTOR]), nobody(), false],
    ["nobody: partial, one assignment", responsibility("partial", [A_UNKNOWN_ROLE]), nobody(), false],
    ["nobody: partial, no assignments", responsibility("partial", []), nobody(), "undetermined"],
    ["caused: direct edge, causes complete", (r) => (r.causesComplete = true), caused("poisoning"), true],
    ["caused: direct edge, causes incomplete", (r) => (r.causesComplete = false), caused("poisoning"), true],
    ["caused: missing edge, causes complete", (r) => (r.causesComplete = true), caused("storm"), false],
    ["caused: missing edge, causes incomplete", (r) => (r.causesComplete = false), caused("storm"), "undetermined"],
    ["caused: only transitive, causes complete", (r) => (r.causesComplete = true), caused("purchase"), false],
    ["caused: only transitive, causes incomplete", (r) => (r.causesComplete = false), caused("purchase"), "undetermined"],
    ["intent: matches", (r) => (r.intent = "intended"), intent("intended"), true],
    ["intent: not_applicable matches", (r) => (r.intent = "not_applicable"), intent("not_applicable"), true],
    ["intent: differs", (r) => (r.intent = "intended"), intent("unintended"), false],
    ["intent: null", (r) => (r.intent = null), intent("intended"), "undetermined"],
    ["mechanism: matches", (r) => (r.mechanism = "ordinary"), mech("ordinary"), true],
    ["mechanism: mixed matches mixed", (r) => (r.mechanism = "mixed"), mech("mixed"), true],
    ["mechanism: mixed is not ordinary", (r) => (r.mechanism = "mixed"), mech("ordinary"), false],
    ["mechanism: mixed is not supernatural", (r) => (r.mechanism = "mixed"), mech("supernatural"), false],
    ["mechanism: ordinary is not mixed", (r) => (r.mechanism = "ordinary"), mech("mixed"), false],
    ["mechanism: null", (r) => (r.mechanism = null), mech("ordinary"), "undetermined"],
  ])("%s", (_name, resolution, claim, expected) => {
    expect(statusVia(resolution, claim)).toBe(expected);
  });
});

describe("AC-04 / AC-05: no resolution, errors and their order", () => {
  const s1 = solution("S1");

  it("AC-E4: all six variants on an event without resolution are undetermined", () => {
    const claims = [
      resp("a", "purchase"),
      role("a", "planner", "purchase"),
      nobody("purchase"),
      caused("storm", "purchase"),
      intent("intended", "purchase"),
      mech("ordinary", "purchase"),
    ];
    expect(new Set(claims.map((c) => c.kind)).size).toBe(6);
    for (const claim of claims) {
      expect(evaluateConclusionClaim(truth, s1, claim)).toEqual({ success: true, status: "undetermined" });
    }
  });

  it("AC-E1: invalid claims give INVALID_CLAIM without throwing", () => {
    const invalid: unknown[] = [
      { kind: "x" },
      null,
      "claim",
      [],
      42,
      undefined,
      { ...resp("a"), extra: 1 },
      { ...resp("z"), extra: 1 }, // claim shape is checked before references
    ];
    for (const claim of invalid) {
      const result = evaluateConclusionClaim(truth, s1, claim);
      expect(result).toEqual({ success: false, code: "INVALID_CLAIM" });
      expect(Object.isFrozen(result)).toBe(true);
    }
  });

  it("AC-E2: unknown person, event or cause event give UNKNOWN_REFERENCE", () => {
    for (const claim of [resp("z"), role("z", "planner"), caused("ghost"), nobody("ghost")]) {
      expect(evaluateConclusionClaim(truth, s1, claim)).toEqual({ success: false, code: "UNKNOWN_REFERENCE" });
    }
  });

  it("AC-E3: binding is checked before the claim", () => {
    const foreign = S1atT2();
    for (const claim of [resp("a"), { kind: "x" }, resp("z")]) {
      expect(evaluateConclusionClaim(truth, foreign, claim)).toEqual({ success: false, code: "SOLUTION_BINDING_MISMATCH" });
    }
  });

  it("AC-E5: a getter that changes between reads is read once, through the parsed copy", () => {
    let reads = 0;
    const claim = { kind: "personResponsibleForEvent", eventId: "event:death" } as Record<string, unknown>;
    Object.defineProperty(claim, "personId", {
      enumerable: true,
      get: () => (reads++ === 0 ? "person:a" : "person:b"),
    });
    const result = evaluateConclusionClaim(truth, s1, claim);
    expect(result).toEqual({ success: true, status: true });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("successful results are frozen", () => {
    expect(Object.isFrozen(evaluateConclusionClaim(truth, s1, resp("a")))).toBe(true);
  });
});
