import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { parseCaseTruth } from "../src/domain/case-truth.ts";
import { createAccusationSchema, evaluateAccusation, parseAccusation } from "../src/domain/case-accusation.ts";
import { claimKey, evaluateConclusionClaim, type ConclusionClaim } from "../src/domain/case-solution.ts";
import { solutionTruthInput } from "./case-solution.fixture.ts";
import {
  S1atT2,
  SOLUTION_NAMES,
  T1,
  T2,
  X1,
  accusationInput,
  caused,
  claimUniverse,
  intent,
  mech,
  nobody,
  requiredOf,
  resp,
  role,
  solution,
  type Literal,
  type SolutionName,
} from "./case-accusation.fixture.ts";

type Path = (string | number)[];

const truth = T1();
const schema = createAccusationSchema(truth);

function verdictOf(name: SolutionName, literals: readonly Literal[]) {
  const result = evaluateAccusation(truth, solution(name), parseAccusation(accusationInput(truth, literals), truth));
  if (!result.success) throw new Error(`unexpected ${result.code}`);
  return result.verdict;
}

function issuePaths(input: unknown): string[] {
  const result = schema.safeParse(input);
  expect(result.success).toBe(false);
  return result.error!.issues.map((issue) => JSON.stringify(issue.path));
}

const S5_BASE: readonly Literal[] = [
  [resp("a"), true],
  [mech("mixed"), true],
];
const S6_BASE: readonly Literal[] = [[role("a", "direct_actor"), true]];
const S3_BASE: readonly Literal[] = [
  [resp("a"), true],
  [resp("b"), true],
  [role("b", "direct_actor"), true],
];

describe("AC-09: verdict matrix", () => {
  it.each<[string, SolutionName, readonly Literal[], "solved" | "not_solved"]>([
    ["AV-01 empty accusation", "S1", [], "not_solved"],
    ["AV-02 exact solution", "S1", X1, "solved"],
    ["AV-03 reversed order", "S1", [...X1].reverse(), "solved"],
    ["AV-04 missing positive required literal", "S1", X1.slice(1), "not_solved"],
    ["AV-05 missing negative required literal", "S1", [X1[0]!, X1[2]!], "not_solved"],
    ["AV-06 missing intent", "S1", X1.slice(0, 2), "not_solved"],
    ["AV-07 required positive with opposite polarity", "S1", [[resp("a"), false], [resp("b"), false], [intent("intended"), true]], "not_solved"],
    ["AV-08 required negative with opposite polarity", "S1", [[resp("a"), true], [resp("b"), true], [intent("intended"), true]], "not_solved"],
    ["AV-09 extra true claim", "S1", [...X1, [role("a", "planner"), true]], "solved"],
    ["AV-10 extra true negative claim", "S1", [...X1, [resp("c"), false]], "solved"],
    ["AV-11 extra false claim, complete", "S1", [...X1, [resp("c"), true]], "not_solved"],
    ["AV-12 wrong role claim", "S1", [...X1, [role("a", "facilitator"), true]], "not_solved"],
    ["AV-13 wrong role correctly denied", "S1", [...X1, [role("a", "facilitator"), false]], "solved"],
    ["AV-14 false asserted, status true", "S1", [...X1, [role("a", "direct_actor"), false]], "not_solved"],
    ["AV-15 extra undetermined claim", "S1", [...X1, [intent("intended", "poisoning"), true]], "solved"],
    ["AV-16 event without resolution", "S1", [...X1, [resp("b", "purchase"), true]], "solved"],
    ["AV-17 no resolution, negative polarity", "S1", [...X1, [resp("a", "storm"), false]], "solved"],
    ["AV-18 direct cause", "S1", [...X1, [caused("poisoning"), true]], "solved"],
    ["AV-19 only transitive cause, causes complete", "S1", [...X1, [caused("purchase"), true]], "not_solved"],
    ["AV-20 missing edge correctly denied", "S1", [...X1, [caused("storm"), false]], "solved"],
    ["AV-21 causes incomplete", "S1", [...X1, [caused("storm", "poisoning"), true]], "solved"],
    ["AV-22 direct edge denied", "S1", [...X1, [caused("purchase", "poisoning"), false]], "not_solved"],
    ["AV-23 wrong intent", "S1", [...X1, [intent("unintended"), true]], "not_solved"],
    ["AV-24 wrong intent denied", "S1", [...X1, [intent("unintended"), false]], "solved"],
    ["AV-25 mechanism true", "S1", [...X1, [mech("ordinary"), true]], "solved"],
    ["AV-26 mechanism false", "S1", [...X1, [mech("mixed"), true]], "not_solved"],
    ["AV-27 nobody false", "S1", [...X1, [nobody(), true]], "not_solved"],
    ["AV-28 nobody denied", "S1", [...X1, [nobody(), false]], "solved"],
    ["AV-29 nobody under partial with assignment", "S1", [...X1, [nobody("poisoning"), true]], "not_solved"],
    ["AV-30 logically incompatible, both undetermined", "S1", [...X1, [intent("intended", "poisoning"), true], [intent("unintended", "poisoning"), true]], "solved"],
    ["AV-31 missing and refuted", "S1", [[resp("a"), true], [intent("intended"), true], [resp("c"), true]], "not_solved"],
    ["AV-32 all six variants", "S1", [...X1, [role("a", "direct_actor"), true], [nobody(), false], [caused("poisoning"), true], [mech("ordinary"), true]], "solved"],
    ["AV-33 partial, assigned", "S1", [...X1, [resp("a", "poisoning"), true]], "solved"],
    ["AV-34 roles null", "S1", [...X1, [role("a", "planner", "poisoning"), true]], "solved"],
    ["AV-35 partial, not assigned", "S1", [...X1, [resp("b", "poisoning"), true]], "solved"],
    ["AV-36 partial solution exact", "S5", S5_BASE, "solved"],
    ["AV-37 shotgun under partial", "S5", [...S5_BASE, [resp("b"), true], [resp("c"), true]], "solved"],
    ["AV-38 roles null", "S5", [...S5_BASE, [role("a", "planner"), true]], "solved"],
    ["AV-39 nobody, partial with assignment", "S5", [...S5_BASE, [nobody(), true]], "not_solved"],
    ["AV-40 intent null", "S5", [...S5_BASE, [intent("intended"), true]], "solved"],
    ["AV-41 mixed is not ordinary", "S5", [...S5_BASE, [mech("ordinary"), true]], "not_solved"],
    ["AV-42 causes incomplete", "S5", [...S5_BASE, [caused("storm"), true]], "solved"],
    ["AV-43 neutral negative claim", "S5", [...S5_BASE, [resp("b"), false]], "solved"],
    ["AV-44 transitive, causes incomplete", "S5", [...S5_BASE, [caused("purchase"), true]], "solved"],
    ["AV-45 known role list", "S6", S6_BASE, "solved"],
    ["AV-46 role list closed despite partial", "S6", [...S6_BASE, [role("a", "planner"), true]], "not_solved"],
    ["AV-47 partial, undetermined", "S6", [...S6_BASE, [resp("b"), true]], "solved"],
    ["AV-48 several responsible", "S3", S3_BASE, "solved"],
    ["AV-49 one of several missing", "S3", S3_BASE.slice(1), "not_solved"],
    ["AV-50 role true", "S3", [...S3_BASE, [role("a", "planner"), true]], "solved"],
    ["AV-51 role false", "S3", [...S3_BASE, [role("a", "direct_actor"), true]], "not_solved"],
    ["AV-52 shotgun under complete", "S3", [...S3_BASE, [resp("c"), true]], "not_solved"],
    ["AV-53 nobody responsible", "S4", [[nobody(), true]], "solved"],
    ["AV-54 responsibility against empty complete list", "S4", [[nobody(), true], [resp("a"), true]], "not_solved"],
    ["AV-55 empty", "S4", [], "not_solved"],
    ["AV-56 equivalent claims do not replace a required literal", "S4", [[resp("a"), false], [resp("b"), false], [resp("c"), false]], "not_solved"],
    ["AV-57 not_applicable", "S4", [[nobody(), true], [intent("not_applicable"), true]], "solved"],
    ["AV-58 same truth, other solution", "S2", X1, "not_solved"],
    ["AV-59 other solution exact", "S2", [[resp("b"), true], [resp("a"), false]], "solved"],
    ["AV-60 nobody under partial without assignment", "S7", [[caused("poisoning"), true], [nobody(), true]], "solved"],
    ["AV-61 shotgun all persons under partial", "S7", [[caused("poisoning"), true], [resp("a"), true], [resp("b"), true], [resp("c"), true]], "solved"],
    ["AV-62 shotgun all roles, roles null", "S5", [...S5_BASE, [role("a", "direct_actor"), true], [role("a", "planner"), true], [role("a", "facilitator"), true]], "solved"],
    ["AV-63 same person, several roles", "S1", [...X1, [role("a", "direct_actor"), true], [role("a", "planner"), true]], "solved"],
    ["AV-64 only irrelevant undetermined extras (core is not challenge)", "S1", [...X1, [resp("b", "purchase"), true], [resp("c", "storm"), true], [caused("storm", "poisoning"), true], [mech("supernatural", "poisoning"), true]], "solved"],
    ["AV-65 only irrelevant true claims, no required literal", "S1", [[role("a", "planner"), true], [caused("poisoning"), true], [resp("c"), false]], "not_solved"],
  ])("%s", (_name, name, literals, expected) => {
    expect(verdictOf(name, literals)).toBe(expected);
  });
});

describe("AC-06/07: parse rules", () => {
  const valid = () => accusationInput(truth, X1) as any;

  it("AP-01: non-objects are rejected without throwing", () => {
    for (const input of [null, [], "accusation", {}, 1, true]) {
      expect(() => schema.safeParse(input)).not.toThrow();
      expect(schema.safeParse(input).success).toBe(false);
    }
  });

  it.each<[string, (a: any) => void, Path]>([
    ["AP-02 schemaVersion 2", (a) => (a.schemaVersion = 2), ["schemaVersion"]],
    ["AP-03 solutionHash at root", (a) => (a.solutionHash = a.truthHash), []],
    ["AP-04 conclusionId on literal", (a) => (a.literals[0].conclusionId = "conclusion:x"), ["literals", 0]],
    ["AP-05 personId on nobody claim", (a) => (a.literals[0] = { claim: { ...nobody(), personId: "person:a" }, value: true }), ["literals", 0, "claim"]],
    ["AP-06 literals missing", (a) => delete a.literals, ["literals"]],
    ["AP-06 literals not an array", (a) => (a.literals = {}), ["literals"]],
    ["AP-07 value as string", (a) => (a.literals[0].value = "true"), ["literals", 0, "value"]],
    ["AP-07 value null", (a) => (a.literals[0].value = null), ["literals", 0, "value"]],
  ])("%s", (_name, mutate, path) => {
    const input = valid();
    mutate(input);
    expect(issuePaths(input)).toContain(JSON.stringify(path));
  });

  it("AP-08: foreign caseId is reported only at caseId, without follow-up errors", () => {
    const input = valid();
    input.caseId = "case:other";
    input.literals.push({ claim: resp("z"), value: true });
    expect(issuePaths(input)).toEqual([JSON.stringify(["caseId"])]);
  });

  it("AP-09: truthHash of T2 parsed against T1 is reported only at truthHash", () => {
    const input = accusationInput(T2(), X1);
    expect(issuePaths(input)).toEqual([JSON.stringify(["truthHash"])]);
  });

  it("AP-10: truth with changed title, same caseId and revision", () => {
    const changed = parseCaseTruth({ ...solutionTruthInput(), title: "Anderer Titel" });
    expect(issuePaths(accusationInput(changed, X1))).toEqual([JSON.stringify(["truthHash"])]);
  });

  it.each<[string, Literal, Path]>([
    ["AP-11 unknown person", [resp("z"), true], ["literals", 0, "claim", "personId"]],
    ["AP-12 unknown event", [resp("a", "ghost"), true], ["literals", 0, "claim", "eventId"]],
    ["AP-13 unknown cause event", [caused("ghost"), true], ["literals", 0, "claim", "causeEventId"]],
  ])("%s", (_name, literal, path) => {
    expect(issuePaths(accusationInput(truth, [literal]))).toEqual([JSON.stringify(path)]);
  });

  it.each<[string, Record<string, string>]>([
    ["AP-14 personId of wrong type", { ...resp("a"), personId: "item:k" }],
    ["AP-15 eventId of wrong type", { ...resp("a"), eventId: "person:a" }],
    ["AP-16 self-causation", caused("death")],
    ["AP-17 unknown kind", { kind: "personGuilty", personId: "person:a", eventId: "event:death" }],
    ["AP-18 unknown role", role("a", "accomplice")],
    ["AP-18 unknown intent", intent("accidental")],
    ["AP-18 unknown mechanism", mech("magic")],
  ])("%s", (_name, claim) => {
    expect(schema.safeParse(accusationInput(truth, [[claim, true]])).success).toBe(false);
  });

  it("AP-19: same claim and value twice", () => {
    expect(issuePaths(accusationInput(truth, [[resp("a"), true], [resp("a"), true]]))).toEqual([
      JSON.stringify(["literals", 1, "claim"]),
    ]);
  });

  it("AP-20: same claim with opposite polarity", () => {
    expect(issuePaths(accusationInput(truth, [[resp("a"), true], [resp("a"), false]]))).toEqual([
      JSON.stringify(["literals", 1, "claim"]),
    ]);
  });

  it("AP-21: duplicate with swapped property order", () => {
    const swapped = { eventId: "event:death", role: "planner", personId: "person:a", kind: "personRoleForEvent" };
    expect(issuePaths(accusationInput(truth, [[role("a", "planner"), true], [swapped, false]]))).toEqual([
      JSON.stringify(["literals", 1, "claim"]),
    ]);
  });

  it("AP-22: a single claim with swapped property order gives the same verdict", () => {
    const swapped = { eventId: "event:death", personId: "person:a", kind: "personResponsibleForEvent" };
    expect(verdictOf("S1", [[swapped, true], X1[1]!, X1[2]!])).toBe("solved");
  });

  it("AP-23: the parsed accusation is decoupled from its input", () => {
    const input = valid();
    const accusation = parseAccusation(input, truth);
    const before = JSON.stringify(accusation);
    input.literals[0].value = false;
    input.literals[1].claim.personId = "person:c";
    input.literals.push({ claim: nobody(), value: true });
    expect(JSON.stringify(accusation)).toBe(before);
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(input.literals[0])).toBe(false);
  });

  it("AP-24: the parsed accusation is recursively frozen", () => {
    const accusation: any = parseAccusation(valid(), truth);
    const before = JSON.stringify(accusation);
    for (const value of [accusation, accusation.literals, accusation.literals[0], accusation.literals[0].claim]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
    expect(() => (accusation.caseId = "case:x")).toThrow(TypeError);
    expect(() => accusation.literals.push({ claim: nobody(), value: true })).toThrow(TypeError);
    expect(() => (accusation.literals[0].value = false)).toThrow(TypeError);
    expect(() => (accusation.literals[0].claim.personId = "person:c")).toThrow(TypeError);
    expect(JSON.stringify(accusation)).toBe(before);
  });

  it("AP-25 / AC-13: all 88 valid claims parse and get a verdict (no upper bound)", () => {
    const universe = claimUniverse();
    expect(universe).toHaveLength(88);
    expect(new Set(universe.map((claim) => claimKey(claim as ConclusionClaim))).size).toBe(88);
    const accusation = parseAccusation(accusationInput(truth, universe.map((claim) => [claim, true] as const)), truth);
    const result = evaluateAccusation(truth, solution("S1"), accusation);
    expect(result.success).toBe(true);
  });

  it("AP-26: parseAccusation throws ZodError", () => {
    expect(() => parseAccusation({}, truth)).toThrow(ZodError);
    expect(() => parseAccusation(accusationInput(T2(), X1), truth)).toThrow(ZodError);
  });
});

describe("AC-10/11: binding", () => {
  it("AB-01: accusation parsed against T1, evaluated with T2", () => {
    const accusation = parseAccusation(accusationInput(truth, X1), truth);
    expect(evaluateAccusation(T2(), S1atT2(), accusation)).toEqual({ success: false, code: "ACCUSATION_BINDING_MISMATCH" });
  });

  it("AB-02: solution bound to another truth", () => {
    const accusation = parseAccusation(accusationInput(truth, X1), truth);
    expect(evaluateAccusation(truth, S1atT2(), accusation)).toEqual({ success: false, code: "SOLUTION_BINDING_MISMATCH" });
  });

  it("AB-03: empty accusation with a foreign solution is a binding error, not a verdict", () => {
    const accusation = parseAccusation(accusationInput(truth, []), truth);
    expect(evaluateAccusation(truth, S1atT2(), accusation)).toEqual({ success: false, code: "SOLUTION_BINDING_MISMATCH" });
  });

  it("AB-04: failures carry no verdict and are frozen", () => {
    const accusation = parseAccusation(accusationInput(truth, X1), truth);
    for (const result of [evaluateAccusation(T2(), S1atT2(), accusation), evaluateAccusation(truth, S1atT2(), accusation)]) {
      expect(result.success).toBe(false);
      expect(Object.keys(result).sort()).toEqual(["code", "success"]);
      expect(Object.isFrozen(result)).toBe(true);
    }
  });

  it("AB-05: one accusation, two solutions of the same truth", () => {
    const accusation = parseAccusation(accusationInput(truth, X1), truth);
    expect(evaluateAccusation(truth, solution("S1"), accusation)).toEqual({ success: true, verdict: "solved" });
    expect(evaluateAccusation(truth, solution("S2"), accusation)).toEqual({ success: true, verdict: "not_solved" });
  });
});

describe("AC-12: evaluation is pure and reveals only the verdict", () => {
  it("AE-01: repeated evaluation is stable and leaves inputs untouched", () => {
    const s1 = solution("S1");
    const accusation = parseAccusation(accusationInput(truth, X1), truth);
    const before = JSON.stringify([truth, s1, accusation]);
    const results = [1, 2, 3].map(() => evaluateAccusation(truth, s1, accusation));
    for (const result of results) {
      expect(result).toEqual(results[0]);
      expect(Object.isFrozen(result)).toBe(true);
    }
    expect(JSON.stringify([truth, s1, accusation])).toBe(before);
  });

  it("AE-02: result keys are exactly success and verdict, without IDs or hashes", () => {
    for (const literals of [X1, [], [[resp("c"), true]] as Literal[]]) {
      const result = evaluateAccusation(truth, solution("S1"), parseAccusation(accusationInput(truth, literals), truth));
      expect(Object.keys(result)).toEqual(["success", "verdict"]);
      const json = JSON.stringify(result);
      for (const leak of ["person:", "event:", "conclusion:"]) expect(json).not.toContain(leak);
      expect(json).not.toMatch(/[0-9a-f]{64}/);
    }
  });
});

describe("AC-E7: metamorphic verdict chain over the public evaluation", () => {
  const universe = claimUniverse();

  it.each(SOLUTION_NAMES)("%s", (name) => {
    const s = solution(name);
    const required = requiredOf(name);
    expect(verdictOf(name, required)).toBe("solved");
    const requiredKeys = new Set(required.map(([claim]) => claimKey(claim as ConclusionClaim)));
    let checked = 0;
    for (const claim of universe) {
      if (requiredKeys.has(claimKey(claim as ConclusionClaim))) continue;
      const evaluation = evaluateConclusionClaim(truth, s, claim);
      if (!evaluation.success) throw new Error(evaluation.code);
      for (const value of [true, false]) {
        const refuted = evaluation.status !== "undetermined" && evaluation.status !== value;
        const accusation = parseAccusation(accusationInput(truth, [...required, [claim, value]]), truth);
        expect(evaluateAccusation(truth, s, accusation)).toEqual({ success: true, verdict: refuted ? "not_solved" : "solved" });
        checked++;
      }
    }
    expect(checked).toBe(2 * (88 - required.length));
  });
});
