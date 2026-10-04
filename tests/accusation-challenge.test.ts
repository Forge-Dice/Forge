import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import type { CaseTruth } from "../src/domain/case-truth.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import { validateCaseSemantics } from "../src/domain/case-semantics.ts";
import { claimKey, parseCaseSolution, type CaseSolution, type ConclusionClaim } from "../src/domain/case-solution.ts";
import { hashCaseSolution } from "../src/domain/case-solution.identity.ts";
import { evaluateAccusation, type Accusation } from "../src/domain/case-accusation.ts";
import * as challengeModule from "../src/domain/accusation-challenge.ts";
import {
  evaluateChallengeAccusation,
  parseAccusationChallenge,
  type AccusationChallenge,
} from "../src/domain/accusation-challenge.ts";
import {
  COMPLETE_A,
  EVENTS,
  INTENTS,
  MECHANISMS,
  PERSONS,
  ROLES,
  R_A,
  accuse,
  as,
  caused,
  challengeInput,
  eventClaims,
  intent,
  lcg,
  manorTruth,
  manorTruthInput,
  mech,
  nobody,
  resp,
  role,
  solutionInput,
  solve,
  type Claim,
  type DeathResolution,
  type Literal,
} from "./accusation-challenge.fixture.ts";

type Path = (string | number)[];
const truth = manorTruth();
const key = (claim: Claim) => claimKey(claim as ConclusionClaim);
const DEATH_SCOPE = eventClaims("death");

function challengeFor(solution: CaseSolution, scope: readonly Claim[] = DEATH_SCOPE, t: CaseTruth = truth): AccusationChallenge {
  return parseAccusationChallenge(challengeInput(t, solution, scope), t, solution);
}

function verdict(death: DeathResolution, required: readonly Literal[], literals: readonly Literal[], scope: readonly Claim[] = DEATH_SCOPE) {
  const solution = solve(truth, death, required);
  const result = evaluateChallengeAccusation(truth, solution, challengeFor(solution, scope), accuse(truth, literals));
  if (!result.success) throw new Error(result.code);
  return result.verdict;
}

function coreVerdict(death: DeathResolution, required: readonly Literal[], literals: readonly Literal[]) {
  const result = evaluateAccusation(truth, solve(truth, death, required), accuse(truth, literals));
  if (!result.success) throw new Error(result.code);
  return result.verdict;
}

function issuesOf(input: unknown, solution: CaseSolution, t: CaseTruth = truth) {
  try {
    parseAccusationChallenge(input, t, solution);
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
    return (error as ZodError).issues.map((issue) => ({ path: JSON.stringify(issue.path), message: issue.message }));
  }
  throw new Error("expected a ZodError");
}
const pathsOf = (input: unknown, solution: CaseSolution) => issuesOf(input, solution).map((i) => i.path);

const PARTIAL_A_ACTOR: DeathResolution = {
  completeness: "partial",
  assignments: [as("a", ["direct_actor"])],
  intent: "intended",
  mechanism: "ordinary",
  causesComplete: false,
};
const R_PARTIAL: readonly Literal[] = [[resp("a"), true]];

describe("fixture", () => {
  it("the manor case is semantically valid", () => {
    expect(validateCaseSemantics(truth).findings).toEqual([]);
  });

  it("exports exactly the two contract functions", () => {
    expect(Object.keys(challengeModule).sort()).toEqual(["evaluateChallengeAccusation", "parseAccusationChallenge"]);
  });
});

describe("P: parsing", () => {
  const s = solve(truth, COMPLETE_A, R_A);
  const valid = () => challengeInput(truth, s, DEATH_SCOPE) as any;
  const bigTruth = manorTruth({
    persons: [...manorTruthInput().persons, ...Array.from({ length: 12 }, (_, i) => ({ id: `person:p${i}`, name: `P${i}` }))],
  });
  const bigClaims = EVENTS.flatMap((e) => [
    ...Array.from({ length: 12 }, (_, i) => ({ kind: "personResponsibleForEvent", personId: `person:p${i}`, eventId: `event:${e}` })),
    ...Array.from({ length: 12 }, (_, i) =>
      ROLES.map((r) => ({ kind: "personRoleForEvent", personId: `person:p${i}`, eventId: `event:${e}`, role: r })),
    ).flat(),
    nobody(e),
    ...INTENTS.map((v) => intent(v, e)),
    ...MECHANISMS.map((v) => mech(v, e)),
  ]);
  const bigSolution = solve(
    bigTruth,
    { ...COMPLETE_A, assignments: [as("p0", ["planner"])] },
    [[{ kind: "personResponsibleForEvent", personId: "person:p0", eventId: "event:death" }, true]],
  );

  it("P01: valid scope parses to a branded, frozen snapshot", () => {
    const c = challengeFor(s);
    expect(c.allowedClaims).toHaveLength(DEATH_SCOPE.length);
    expect(Object.isFrozen(c)).toBe(true);
  });

  it("P02: empty scope", () => {
    expect(pathsOf({ ...valid(), allowedClaims: [] }, s)).toContain(JSON.stringify(["allowedClaims"]));
  });

  it("P03/P04: 256 claims parse, 257 do not", () => {
    expect(bigClaims.length).toBeGreaterThanOrEqual(257);
    const scope = (n: number) => challengeInput(bigTruth, bigSolution, bigClaims.slice(0, n));
    expect(parseAccusationChallenge(scope(256), bigTruth, bigSolution).allowedClaims).toHaveLength(256);
    expect(issuesOf(scope(257), bigSolution, bigTruth).map((i) => i.path)).toContain(JSON.stringify(["allowedClaims"]));
  });

  it("P05: identical claim twice, reported at the later index with the first one", () => {
    const issues = issuesOf({ ...valid(), allowedClaims: [...DEATH_SCOPE, resp("a")] }, s);
    expect(issues).toEqual([{ path: JSON.stringify(["allowedClaims", DEATH_SCOPE.length]), message: "Same claim as allowedClaims[0]" }]);
  });

  it("P06: property-reordered duplicate", () => {
    const alias = { eventId: "event:death", personId: "person:a", kind: "personResponsibleForEvent" };
    expect(pathsOf({ ...valid(), allowedClaims: [...DEATH_SCOPE, alias] }, s)).toEqual([JSON.stringify(["allowedClaims", DEATH_SCOPE.length])]);
  });

  it.each<[string, (c: any) => void, Path]>([
    ["P07 literal instead of bare claim", (c) => (c.allowedClaims[0] = { claim: resp("a"), value: true }), ["allowedClaims", 0, "kind"]],
    ["P08 boolean value on a responsibility claim", (c) => (c.allowedClaims[0] = { ...resp("a"), value: true }), ["allowedClaims", 0]],
    ["P10 unknown kind", (c) => (c.allowedClaims[0] = { kind: "personGuilty", personId: "person:a", eventId: "event:death" }), ["allowedClaims", 0, "kind"]],
    ["P11 person prefix item:", (c) => (c.allowedClaims[0] = { ...resp("a"), personId: "item:vial" }), ["allowedClaims", 0, "personId"]],
    ["P15 self-causation", (c) => c.allowedClaims.push(caused("death")), ["allowedClaims", DEATH_SCOPE.length, "causeEventId"]],
    ["P16 schemaVersion 2", (c) => (c.schemaVersion = 2), ["schemaVersion"]],
    ["P16 extra root field", (c) => (c.label = "x"), []],
    ["P16 upper-case hash", (c) => (c.solutionHash = c.solutionHash.toUpperCase()), ["solutionHash"]],
  ])("%s", (_name, mutate, path) => {
    const input = valid();
    mutate(input);
    expect(pathsOf(input, s)).toContain(JSON.stringify(path));
  });

  it("P09: intent and mechanism values are claim fields", () => {
    const c = parseAccusationChallenge({ ...valid(), allowedClaims: [...R_A.map(([claim]) => claim), intent("intended"), mech("ordinary")] }, truth, s);
    expect(c.allowedClaims[2]).toEqual(intent("intended"));
    expect(c.allowedClaims[3]).toEqual(mech("ordinary"));
  });

  it.each<[string, Claim, Path]>([
    ["P12 unknown person", resp("z"), ["allowedClaims", DEATH_SCOPE.length, "personId"]],
    ["P13 unknown event", resp("a", "ghost"), ["allowedClaims", DEATH_SCOPE.length, "eventId"]],
    ["P14 unknown cause event", caused("ghost"), ["allowedClaims", DEATH_SCOPE.length, "causeEventId"]],
  ])("%s", (_name, claim, path) => {
    expect(pathsOf({ ...valid(), allowedClaims: [...DEATH_SCOPE, claim] }, s)).toEqual([JSON.stringify(path)]);
  });

  it("P17: a required claim outside the scope names the internal conclusion", () => {
    const issues = issuesOf({ ...valid(), allowedClaims: DEATH_SCOPE.filter((c) => key(c) !== key(resp("b"))) }, s);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.path).toBe(JSON.stringify(["allowedClaims"]));
    expect(issues[0]!.message).toContain("conclusion:c1");
    expect(issues[0]!.message).toContain(key(resp("b")));
  });

  it("P18/P19/P20: undetermined, non-catalogue and unresolved-event claims are allowed", () => {
    const scope = [...R_A.map(([c]) => c), resp("a", "poisoning"), role("c", "planner"), resp("a", "fire")];
    expect(parseAccusationChallenge({ ...valid(), allowedClaims: scope }, truth, s).allowedClaims).toHaveLength(5);
  });

  it("P21: scope equal to the required claim keys parses", () => {
    expect(parseAccusationChallenge({ ...valid(), allowedClaims: R_A.map(([c]) => c) }, truth, s).allowedClaims).toHaveLength(2);
  });

  it("P22: the snapshot is decoupled from the raw input", () => {
    const input = valid();
    const c = parseAccusationChallenge(input, truth, s);
    const before = JSON.stringify(c);
    input.truthHash = "0".repeat(64);
    input.allowedClaims.push(nobody("fire"));
    input.allowedClaims[0].personId = "person:f";
    expect(JSON.stringify(c)).toBe(before);
    expect(Object.isFrozen(input)).toBe(false);
  });

  it("P23: the snapshot is recursively frozen", () => {
    const c: any = challengeFor(s);
    expect(() => (c.caseId = "case:x")).toThrow(TypeError);
    expect(() => c.allowedClaims.push(nobody())).toThrow(TypeError);
    expect(() => (c.allowedClaims[0].personId = "person:f")).toThrow(TypeError);
  });

  it("P24: scope and property order are preserved and do not change the verdict", () => {
    const reordered = [...DEATH_SCOPE].reverse().map((claim) => Object.fromEntries(Object.entries(claim).reverse()));
    const c = parseAccusationChallenge(challengeInput(truth, s, reordered), truth, s);
    // Scope order is kept; zod rebuilds each claim in schema key order, which carries no meaning.
    expect(c.allowedClaims).toEqual(reordered);
    expect(evaluateChallengeAccusation(truth, s, c, accuse(truth, R_A))).toEqual({ success: true, verdict: "solved" });
  });
});

describe("V: verdicts", () => {
  const RA_SCOPE = R_A.map(([c]) => c);

  it.each<[string, DeathResolution, readonly Literal[], readonly Literal[], "solved" | "not_solved", (readonly Claim[])?]>([
    ["V01 exactly the required literals", COMPLETE_A, R_A, R_A, "solved"],
    ["V02 empty accusation", COMPLETE_A, R_A, [], "not_solved"],
    ["V03 one required literal missing", COMPLETE_A, R_A, R_A.slice(0, 1), "not_solved"],
    ["V04 required false flipped to true", COMPLETE_A, R_A, [[resp("a"), true], [resp("b"), true]], "not_solved"],
    ["V05 required true flipped to false", COMPLETE_A, R_A, [[resp("a"), false], [resp("b"), false]], "not_solved"],
    ["V06 extra in-scope true claim", COMPLETE_A, R_A, [...R_A, [role("a", "planner"), true]], "solved"],
    ["V07 extra in-scope false claim, asserted false", COMPLETE_A, R_A, [...R_A, [resp("c"), false]], "solved"],
    ["V08 out-of-scope true claim", COMPLETE_A, R_A, [...R_A, [role("a", "planner"), true]], "not_solved", RA_SCOPE],
    ["V09 out-of-scope false claim, asserted false", COMPLETE_A, R_A, [...R_A, [resp("c"), false]], "not_solved", RA_SCOPE],
    ["V10 in-scope false claim asserted true", COMPLETE_A, R_A, [...R_A, [resp("c"), true]], "not_solved"],
    ["V11 in-scope true claim asserted false", COMPLETE_A, R_A, [...R_A, [role("a", "direct_actor"), false]], "not_solved"],
    ["V12 partial: unlisted person asserted true", PARTIAL_A_ACTOR, R_PARTIAL, [...R_PARTIAL, [resp("c"), true]], "not_solved"],
    ["V13 partial: unlisted person asserted false", PARTIAL_A_ACTOR, R_PARTIAL, [...R_PARTIAL, [resp("c"), false]], "not_solved"],
    ["V14 partial: listed actors only", PARTIAL_A_ACTOR, R_PARTIAL, R_PARTIAL, "solved"],
    ["V15 roles null: role asserted true", { ...COMPLETE_A, assignments: [as("a")] }, [[resp("a"), true]], [[resp("a"), true], [role("a", "planner"), true]], "not_solved"],
    ["V16 roles null: role asserted false", { ...COMPLETE_A, assignments: [as("a")] }, [[resp("a"), true]], [[resp("a"), true], [role("a", "planner"), false]], "not_solved"],
    ["V17 partial, known role list is closed", PARTIAL_A_ACTOR, R_PARTIAL, [...R_PARTIAL, [role("a", "planner"), false]], "solved"],
    ["V19 known direct cause, causes incomplete", PARTIAL_A_ACTOR, R_PARTIAL, [...R_PARTIAL, [caused("poisoning"), true]], "solved"],
    ["V23 complete, nobody responsible", { ...COMPLETE_A, assignments: [] }, [[nobody(), true]], [[nobody(), true]], "solved"],
    ["V25 nobody and a responsible person", COMPLETE_A, R_A, [...R_A, [nobody(), true]], "not_solved"],
    ["V34 one of several required actors missing", { ...COMPLETE_A, assignments: [as("a"), as("b")] }, [[resp("a"), true], [resp("b"), true]], [[resp("a"), true]], "not_solved"],
    ["V35 extra innocent candidate under complete", COMPLETE_A, R_A, [...R_A, [resp("d"), true]], "not_solved"],
    ["V39 guessed known ID with a correct in-scope claim", COMPLETE_A, R_A, [...R_A, [resp("f"), false]], "solved"],
    ["V42 first literal correct, later one out of scope", COMPLETE_A, R_A, [...R_A, [resp("a", "fire"), true]], "not_solved"],
    ["V42 first literal correct, later one undetermined", PARTIAL_A_ACTOR, R_PARTIAL, [...R_PARTIAL, [caused("poisoning"), true], [intent("unintended", "death"), false], [resp("e"), true]], "not_solved"],
  ])("%s", (_name, death, required, literals, expected, scope) => {
    expect(verdict(death, required, literals, scope)).toBe(expected);
  });

  it("V12/V26: the neutral core alone would accept unknown extras", () => {
    expect(coreVerdict(PARTIAL_A_ACTOR, R_PARTIAL, [...R_PARTIAL, [resp("c"), true]])).toBe("solved");
    const empty: DeathResolution = { ...PARTIAL_A_ACTOR, assignments: [] };
    const req: Literal[] = [[caused("poisoning"), true]];
    const shotgun: Literal[] = [...req, [nobody(), true], ...PERSONS.map((p): Literal => [resp(p), true])];
    expect(coreVerdict(empty, req, shotgun)).toBe("solved");
    expect(verdict(empty, req, shotgun)).toBe("not_solved");
  });

  it("V18: unknown cause under causes incomplete, both polarities", () => {
    for (const value of [true, false]) expect(verdict(PARTIAL_A_ACTOR, R_PARTIAL, [...R_PARTIAL, [caused("storm"), value]])).toBe("not_solved");
  });

  it("V20/V21: intent and mechanism null, every option and polarity", () => {
    const open: DeathResolution = { ...PARTIAL_A_ACTOR, intent: null, mechanism: null };
    for (const claim of [...INTENTS.map((v) => intent(v)), ...MECHANISMS.map((v) => mech(v))]) {
      for (const value of [true, false]) expect(verdict(open, R_PARTIAL, [...R_PARTIAL, [claim, value]])).toBe("not_solved");
    }
  });

  it("V22: event without resolution stays undetermined, both polarities", () => {
    const scope = [...DEATH_SCOPE, ...eventClaims("fire")];
    for (const value of [true, false]) expect(verdict(COMPLETE_A, R_A, [...R_A, [resp("a", "fire"), value]], scope)).toBe("not_solved");
  });

  it("V24: partial without persons, nobody either way", () => {
    const empty: DeathResolution = { ...PARTIAL_A_ACTOR, assignments: [] };
    for (const value of [true, false]) {
      expect(verdict(empty, [[caused("poisoning"), true]], [[caused("poisoning"), true], [nobody(), value]])).toBe("not_solved");
    }
  });

  it("V27: two and three legitimate actors", () => {
    for (const actors of [["a", "b"], ["a", "b", "c"]]) {
      const req = actors.map((p): Literal => [resp(p), true]);
      expect(verdict({ ...COMPLETE_A, assignments: actors.map((p) => as(p)) }, req, req)).toBe("solved");
    }
  });

  it("V28/V29: several roles across persons", () => {
    const planner: DeathResolution = { ...COMPLETE_A, assignments: [as("a", ["planner"]), as("b", ["direct_actor"])] };
    const r28: Literal[] = [[resp("a"), true], [resp("b"), true], [role("a", "planner"), true], [role("b", "direct_actor"), true]];
    expect(verdict(planner, r28, r28)).toBe("solved");
    const facilitator: DeathResolution = { ...COMPLETE_A, assignments: [as("a", ["facilitator"]), as("b", ["direct_actor"])] };
    const r29: Literal[] = [[resp("a"), true], [resp("b"), true]];
    expect(verdict(facilitator, r29, [...r29, [role("a", "facilitator"), true], [role("a", "direct_actor"), false], [role("b", "direct_actor"), true]])).toBe("solved");
  });

  it("V30: one person with two and with three known roles", () => {
    for (const roles of [["direct_actor", "planner"], ROLES]) {
      const req = [[resp("a"), true] as Literal, ...roles.map((r): Literal => [role("a", r), true])];
      expect(verdict({ ...COMPLETE_A, assignments: [as("a", roles)] }, req, req)).toBe("solved");
    }
  });

  it("V31/V32: accusing all six persons", () => {
    const all = PERSONS.map((p): Literal => [resp(p), true]);
    expect(verdict(COMPLETE_A, [[resp("a"), true]], all)).toBe("not_solved");
    expect(verdict({ ...COMPLETE_A, assignments: PERSONS.map((p) => as(p)) }, all, all)).toBe("solved");
  });

  it("V33: all three roles for every candidate, one of them unknown", () => {
    const death: DeathResolution = { ...COMPLETE_A, assignments: [as("a", ["planner"]), as("b")] };
    const req: Literal[] = [[resp("a"), true], [resp("b"), true]];
    const guesses = ["a", "b"].flatMap((p) => ROLES.map((r): Literal => [role(p, r), p === "a" && r === "planner"]));
    expect(verdict(death, req, [...req, ...guesses])).toBe("not_solved");
  });

  it("V36/V37/V38: duplicates, aliases and unknown IDs never reach the wrapper", () => {
    expect(() => accuse(truth, [[resp("a"), true], [resp("a"), true]])).toThrow(ZodError);
    expect(() => accuse(truth, [[resp("a"), true], [resp("a"), false]])).toThrow(ZodError);
    expect(() => accuse(truth, [[resp("a"), true], [{ eventId: "event:death", personId: "person:a", kind: "personResponsibleForEvent" }, true]])).toThrow(ZodError);
    expect(() => accuse(truth, [[resp("z"), true]])).toThrow(ZodError);
  });

  it("V40: literal and property order do not matter", () => {
    const literals: Literal[] = [...R_A, [role("a", "planner"), true]];
    const permuted = [...literals].reverse().map(([c, v]): Literal => [Object.fromEntries(Object.entries(c).reverse()), v]);
    expect(verdict(COMPLETE_A, R_A, permuted)).toBe(verdict(COMPLETE_A, R_A, literals));
  });

  it("V41: more literals than scope claims", () => {
    expect(verdict(COMPLETE_A, R_A, [...R_A, [resp("c"), false]], RA_SCOPE)).toBe("not_solved");
  });

  it("V43: result keys are exactly success and verdict", () => {
    const s = solve(truth, COMPLETE_A, R_A);
    for (const literals of [R_A, [], [...R_A, [resp("c"), true]]] as Literal[][]) {
      const result = evaluateChallengeAccusation(truth, s, challengeFor(s), accuse(truth, literals));
      expect(Object.keys(result)).toEqual(["success", "verdict"]);
      expect(Object.isFrozen(result)).toBe(true);
      expect(JSON.stringify(result)).not.toMatch(/person:|event:|conclusion:|[0-9a-f]{64}/);
    }
  });
});

describe("B: binding", () => {
  const s1 = solve(truth, COMPLETE_A, R_A);
  const c1 = challengeFor(s1);
  const a1 = accuse(truth, R_A);
  const code = (result: ReturnType<typeof evaluateChallengeAccusation>) => (result.success ? result.verdict : result.code);

  it("B01: everything bound to the unchanged truth", () => {
    expect(code(evaluateChallengeAccusation(truth, s1, c1, a1))).toBe("solved");
  });

  it.each<[string, () => CaseSolution]>([
    ["B02 other responsibility", () => solve(truth, { ...COMPLETE_A, assignments: [as("b")] }, [[resp("b"), true]])],
    ["B03 only the solution revision increased", () => solve(truth, COMPLETE_A, R_A, { revision: 2 })],
    ["B06 non-required conclusion added", () => solve(truth, COMPLETE_A, R_A, { extraConclusions: [resp("c")] })],
  ])("%s", (_name, other) => {
    expect(code(evaluateChallengeAccusation(truth, other(), c1, a1))).toBe("CHALLENGE_BINDING_MISMATCH");
  });

  it("B07: non-required conclusion removed", () => {
    const withExtra = solve(truth, COMPLETE_A, R_A, { extraConclusions: [resp("c")] });
    const challenge = challengeFor(withExtra);
    expect(code(evaluateChallengeAccusation(truth, s1, challenge, a1))).toBe("CHALLENGE_BINDING_MISMATCH");
  });

  it("B04: truth presentation changed, new matching solution, old challenge", () => {
    const t2 = manorTruth({ title: "Das andere Herrenhaus" });
    const s2 = solve(t2, COMPLETE_A, R_A);
    expect(code(evaluateChallengeAccusation(t2, s2, c1, accuse(t2, R_A)))).toBe("CHALLENGE_BINDING_MISMATCH");
  });

  it("B05: permuted truth and solution input keep the binding", () => {
    const input = manorTruthInput();
    input.persons.reverse();
    input.events.reverse();
    const t = manorTruth({ persons: input.persons, events: input.events });
    expect(hashCaseTruth(t)).toBe(hashCaseTruth(truth));
    const sInput = solutionInput(truth, COMPLETE_A, R_A);
    sInput.conclusions.reverse();
    const s = parseCaseSolution(sInput, t);
    expect(hashCaseSolution(s)).toBe(hashCaseSolution(s1));
    expect(code(evaluateChallengeAccusation(t, s, c1, a1))).toBe("solved");
  });

  it("B08: foreign case with its own solution", () => {
    const other = manorTruth({ caseId: "case:other" });
    const s = solve(other, COMPLETE_A, R_A);
    expect(code(evaluateChallengeAccusation(other, s, c1, accuse(other, R_A)))).toBe("CHALLENGE_BINDING_MISMATCH");
  });

  it("B09: solution not bound to the given truth", () => {
    const t2 = manorTruth({ revision: 2 });
    expect(code(evaluateChallengeAccusation(t2, s1, c1, accuse(t2, R_A)))).toBe("SOLUTION_BINDING_MISMATCH");
  });

  it.each<[string, string, string]>([
    ["caseId", "caseId", "case:other"],
    ["truthHash", "truthHash", "0".repeat(64)],
    ["solutionHash", "solutionHash", "0".repeat(64)],
  ])("B10: wrong %s when parsing, no follow-up issues", (_name, field, value) => {
    const input: any = challengeInput(truth, s1, [...DEATH_SCOPE, resp("z")]);
    input[field] = value;
    expect(pathsOf(input, s1)).toEqual([JSON.stringify([field])]);
  });

  it("B10: solution bound to another truth fails parsing at the root", () => {
    const t2 = manorTruth({ revision: 2 });
    expect(issuesOf(challengeInput(t2, s1, DEATH_SCOPE), s1, t2)).toEqual([{ path: "[]", message: "SOLUTION_BINDING_MISMATCH" }]);
  });

  it("B11: accusation bound to another truth", () => {
    const t2 = manorTruth({ title: "Anders" });
    expect(code(evaluateChallengeAccusation(truth, s1, c1, accuse(t2, R_A)))).toBe("ACCUSATION_BINDING_MISMATCH");
  });

  it("B12: empty accusation with a stale challenge is a binding error, never not_solved", () => {
    const s2 = solve(truth, COMPLETE_A, R_A, { revision: 2 });
    expect(code(evaluateChallengeAccusation(truth, s2, c1, accuse(truth, [])))).toBe("CHALLENGE_BINDING_MISMATCH");
  });

  it("B13: priority solution, then challenge, then accusation", () => {
    const t2 = manorTruth({ title: "Anders" });
    const staleAccusation = accuse(t2, R_A);
    expect(code(evaluateChallengeAccusation(manorTruth({ revision: 3 }), s1, c1, staleAccusation))).toBe("SOLUTION_BINDING_MISMATCH");
    const s2 = solve(truth, COMPLETE_A, R_A, { revision: 2 });
    expect(code(evaluateChallengeAccusation(truth, s2, c1, staleAccusation))).toBe("CHALLENGE_BINDING_MISMATCH");
  });

  it("B14: reordered scope, same truth and solution", () => {
    const reordered = challengeFor(s1, [...DEATH_SCOPE].reverse());
    for (const literals of [R_A, [...R_A, [resp("c"), true]]] as Literal[][]) {
      const a = accuse(truth, literals);
      expect(evaluateChallengeAccusation(truth, s1, reordered, a)).toEqual(evaluateChallengeAccusation(truth, s1, c1, a));
    }
  });

  it("B15: technical errors of the core are passed through", () => {
    const forgedClaim = { kind: "personResponsibleForEvent", personId: "person:ghost", eventId: "event:death" };
    const forgedChallenge = { ...c1, allowedClaims: [...c1.allowedClaims, forgedClaim] } as unknown as AccusationChallenge;
    const forgedAccusation = { ...a1, literals: [...a1.literals, { claim: forgedClaim, value: true }] } as unknown as Accusation;
    expect(code(evaluateChallengeAccusation(truth, s1, forgedChallenge, forgedAccusation))).toBe("UNKNOWN_REFERENCE");
  });
});

describe("properties: independent set oracle", () => {
  const universe = DEATH_SCOPE;
  const outside = eventClaims("fire").slice(0, 8);

  // Canonical status of a claim through the real TASK-0003 parser (both required polarities).
  function statusOf(death: DeathResolution, claim: Claim): boolean | "undetermined" {
    const accepts = (value: boolean) => {
      try {
        solve(truth, death, [[claim, value]]);
        return true;
      } catch {
        return false;
      }
    };
    if (accepts(true)) return true;
    if (accepts(false)) return false;
    return "undetermined";
  }

  it("R ⊆ A ⊆ M decides exactly like the wrapper (≥ 30 configs, ≥ 2000 trials)", () => {
    const rand = lcg();
    const pick = <T>(xs: readonly T[]) => xs[rand(xs.length)]!;
    let trials = 0;
    let solved = 0;
    let configs = 0;
    const seen = new Set<string>();

    while (configs < 32) {
      const persons = [...PERSONS].sort(() => rand(3) - 1).slice(0, rand(4));
      const death: DeathResolution = {
        completeness: rand(2) === 0 ? "complete" : "partial",
        assignments: persons.map((p) => as(p, rand(3) === 0 ? null : ROLES.filter(() => rand(2) === 0).concat(rand(2) ? [] : []).filter((r, i, xs) => xs.indexOf(r) === i))).map((a) =>
          a.roles !== null && a.roles.length === 0 ? { ...a, roles: [pick(ROLES)] } : a,
        ),
        intent: pick([null, ...INTENTS]),
        mechanism: pick([null, ...MECHANISMS]),
        causesComplete: rand(2) === 0,
      };
      const statuses = new Map(universe.map((claim) => [key(claim), statusOf(death, claim)]));
      const determined = universe.filter((claim) => statuses.get(key(claim)) !== "undetermined");
      if (determined.length === 0) continue;
      const required: Literal[] = [];
      for (const claim of determined) if (required.length === 0 || rand(6) === 0) required.push([claim, statuses.get(key(claim)) as boolean]);
      const scope = [...required.map(([c]) => c), ...universe.filter((c) => !required.some(([r]) => key(r) === key(c)) && rand(3) !== 0)];
      const scopeKeys = new Set(scope.map(key));
      const solution = solve(truth, death, required);
      const challenge = challengeFor(solution, scope);
      configs++;
      seen.add(`${death.completeness}|${death.assignments.length}|${death.intent === null}|${death.causesComplete}`);

      for (let attempt = 0; attempt < 70; attempt++) {
        const literals: Literal[] = required.filter(() => rand(8) !== 0);
        const used = new Set(literals.map(([c]) => key(c)));
        const extras = rand(4);
        for (let i = 0; i < extras; i++) {
          const claim = rand(6) === 0 ? pick(outside) : pick(universe);
          if (used.has(key(claim))) continue;
          used.add(key(claim));
          const status = statuses.get(key(claim));
          const value = typeof status === "boolean" && rand(3) !== 0 ? status : rand(2) === 0;
          literals.push([claim, value]);
        }
        const inM = ([claim, value]: Literal) => scopeKeys.has(key(claim)) && statuses.get(key(claim)) === value;
        const expected = required.every(([c, v]) => literals.some(([d, w]) => key(c) === key(d) && v === w)) && literals.every(inM);
        const accusation = accuse(truth, literals);
        const result = evaluateChallengeAccusation(truth, solution, challenge, accusation);
        expect(result).toEqual({ success: true, verdict: expected ? "solved" : "not_solved" });
        if (expected) {
          solved++;
          expect(evaluateAccusation(truth, solution, accusation)).toEqual({ success: true, verdict: "solved" });
          const shuffled = [...literals].reverse();
          expect(evaluateChallengeAccusation(truth, solution, challenge, accuse(truth, shuffled))).toEqual(result);
        }
        trials++;
      }
    }
    expect(trials).toBeGreaterThanOrEqual(2000);
    expect(solved).toBeGreaterThan(200);
    expect(seen.size).toBeGreaterThan(8);
  });
});
