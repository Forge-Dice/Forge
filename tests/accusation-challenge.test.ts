import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { parseCaseTruth } from "../src/domain/case-truth.ts";
import { parseCaseSolution, claimKey, type ConclusionClaim } from "../src/domain/case-solution.ts";
import { evaluateAccusation, type Accusation } from "../src/domain/case-accusation.ts";
import {
  evaluateChallengeAccusation,
  parseAccusationChallenge,
  type AccusationChallenge,
} from "../src/domain/accusation-challenge.ts";
import { solutionTruthInput } from "./case-solution.fixture.ts";
import {
  T1,
  T2,
  X1,
  caused,
  claimUniverse,
  intent,
  mech,
  nobody,
  resp,
  role,
  type Claim,
  type Literal,
} from "./case-accusation.fixture.ts";
import {
  accuse,
  canonicalStatus,
  challengeInput,
  crowdTruth,
  lcg,
  makeChallenge,
  makeSolution,
  personIds,
  res,
  sameClaim,
  solutionInput,
  universeWithout,
  who,
  type Resolution,
  type SolutionSpec,
} from "./accusation-challenge.fixture.ts";

// Contract MYST-CHALLENGE-0001 v2 §7 (P, V, B; T lives in the typecheck file) and §8 properties.

type Path = (string | number)[];
const truth = T1();

// S1: death complete [a: direct_actor + planner], intended, ordinary, causes complete;
// poisoning partial [a: roles null]; storm and purchase without resolution. R = X1.
const S1_RES: Resolution[] = [
  res("death", "complete", [who("a", ["direct_actor", "planner"])], { intent: "intended", mechanism: "ordinary", causesComplete: true }),
  res("poisoning", "partial", [who("a", null)]),
];
const S1: SolutionSpec = { resolutions: S1_RES, required: X1 };
const s1 = makeSolution(truth, S1);
const full = makeChallenge(truth, s1, claimUniverse());

function issuesOf(fn: () => unknown): { path: Path; message: string }[] {
  try {
    fn();
  } catch (error) {
    if (error instanceof ZodError) return error.issues.map((i) => ({ path: i.path as Path, message: i.message }));
    throw error;
  }
  return [];
}
const pathsOf = (fn: () => unknown) => issuesOf(fn).map((i) => i.path);

/** Verdict of literals under a solution spec and scope; parses everything for real. */
function judge(spec: SolutionSpec, literals: readonly Literal[], scope: readonly Claim[] = claimUniverse(), t = truth) {
  const solution = makeSolution(t, spec);
  return evaluateChallengeAccusation(t, solution, makeChallenge(t, solution, scope), accuse(t, literals));
}
const SOLVED = { success: true, verdict: "solved" };
const NOT_SOLVED = { success: true, verdict: "not_solved" };

describe("parse (P01..P24)", () => {
  const parse = (edit: (c: any) => void, scope: readonly Claim[] = claimUniverse()) => () => {
    const input = challengeInput(truth, s1, scope);
    edit(input);
    return parseAccusationChallenge(input, truth, s1);
  };

  it("P01 valid scope with required coverage parses to a frozen snapshot", () => {
    const challenge = parse(() => {})();
    expect(challenge.allowedClaims).toHaveLength(88);
    expect(Object.isFrozen(challenge)).toBe(true);
  });

  it("P02 empty scope", () => {
    expect(pathsOf(parse((c) => (c.allowedClaims = []))).map((p) => p.join("."))).toContain("allowedClaims");
  });

  it("P03/P04 256 claims parse, 257 do not", () => {
    const crowd = crowdTruth(25);
    const solution = makeSolution(crowd, S1);
    const required = X1.map(([claim]) => claim);
    const others: Claim[] = [];
    for (const person of personIds(crowd)) {
      for (const event of ["purchase", "poisoning", "death", "storm"]) {
        others.push(resp(person, event), role(person, "direct_actor", event), role(person, "planner", event));
      }
    }
    const distinct = [...required, ...others.filter((c) => !required.some((r) => sameClaim(r, c)))];
    expect(distinct.length).toBeGreaterThanOrEqual(257);
    expect(makeChallenge(crowd, solution, distinct.slice(0, 256)).allowedClaims).toHaveLength(256);
    const paths = pathsOf(() => makeChallenge(crowd, solution, distinct.slice(0, 257)));
    expect(paths).toEqual([["allowedClaims"]]);
  });

  it("P05 identical claim twice: issue at the later index naming the first", () => {
    const issues = issuesOf(parse((c) => c.allowedClaims.push({ ...c.allowedClaims[3] })));
    expect(issues).toEqual([{ path: ["allowedClaims", 88], message: "Claim duplicates allowedClaims[3]" }]);
  });

  it("P06 property-reordered duplicate is still a duplicate", () => {
    const reordered = Object.fromEntries(Object.entries(resp("a")).reverse());
    expect(pathsOf(parse((c) => c.allowedClaims.push(reordered)))).toEqual([["allowedClaims", 88]]);
  });

  it("P07/P08 literals or boolean values are not bare claims", () => {
    expect(pathsOf(parse((c) => (c.allowedClaims[0] = { claim: resp("a"), value: true })))).not.toEqual([]);
    const withValue = pathsOf(parse((c) => (c.allowedClaims[0] = { ...resp("a"), value: true })));
    expect(withValue.length).toBeGreaterThan(0);
    expect(withValue[0]!.slice(0, 2)).toEqual(["allowedClaims", 0]);
  });

  it("P09 enum values of intent and mechanism are claim fields", () => {
    expect(() => parse(() => {}, [...X1.map(([c]) => c), intent("unintended"), mech("ordinary")])()).not.toThrow();
  });

  it("P10/P11 unknown kind and wrong ID prefix are shape issues", () => {
    expect(pathsOf(parse((c) => (c.allowedClaims[0] = { kind: "personGuilty", eventId: "event:death" })))[0]!.slice(0, 2)).toEqual([
      "allowedClaims",
      0,
    ]);
    expect(pathsOf(parse((c) => (c.allowedClaims[0] = { ...resp("a"), personId: "item:k" })))).toContainEqual(["allowedClaims", 0, "personId"]);
  });

  it("P12/P13/P14 unknown references at the precise field", () => {
    const at = (claim: Claim) => pathsOf(parse(() => {}, [...claimUniverse(), claim]));
    expect(at(resp("zed"))).toEqual([["allowedClaims", 88, "personId"]]);
    expect(at(resp("a", "flood"))).toEqual([["allowedClaims", 88, "eventId"]]);
    expect(at(caused("flood"))).toEqual([["allowedClaims", 88, "causeEventId"]]);
  });

  it("P15 self-cause is a shape issue at causeEventId", () => {
    expect(pathsOf(parse((c) => (c.allowedClaims[0] = caused("death", "death"))))).toEqual([["allowedClaims", 0, "causeEventId"]]);
  });

  it.each([
    ["schemaVersion", (c: any) => (c.schemaVersion = 2)],
    ["extra", (c: any) => (c.extra = true)],
    ["truthHash", (c: any) => (c.truthHash = c.truthHash.toUpperCase())],
    ["solutionHash", (c: any) => (c.solutionHash = c.solutionHash.toUpperCase())],
  ])("P16 shape issue at %s", (field, edit) => {
    const paths = pathsOf(parse(edit));
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) expect(path).toEqual(field === "extra" ? [] : [field]);
  });

  it("P17 missing required claim names the internal conclusion ID", () => {
    const issues = issuesOf(parse(() => {}, universeWithout(resp("b"))));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.path).toEqual(["allowedClaims"]);
    expect(issues[0]!.message).toContain("conclusion:c1");
    expect(issues[0]!.message).toContain(claimKey(resp("b") as ConclusionClaim));
  });

  it("P18/P19/P20 undetermined, non-catalogue and unresolved-event claims are allowed in scope", () => {
    const scope = [...X1.map(([c]) => c), resp("b", "poisoning"), role("c", "planner"), resp("a", "storm")];
    expect(canonicalStatus(truth, S1_RES, resp("b", "poisoning"))).toBe("undetermined");
    expect(canonicalStatus(truth, S1_RES, resp("a", "storm"))).toBe("undetermined");
    expect(makeChallenge(truth, s1, scope).allowedClaims).toHaveLength(6);
  });

  it("P21 scope equal to the required claims of a public yes/no question", () => {
    expect(makeChallenge(truth, s1, X1.map(([c]) => c)).allowedClaims).toHaveLength(3);
  });

  it("P22 mutating the raw input after parse leaves the snapshot unchanged; input is not frozen", () => {
    const input = challengeInput(truth, s1, claimUniverse());
    const challenge = parseAccusationChallenge(input, truth, s1);
    input.truthHash = "0".repeat(64);
    input.allowedClaims.push(resp("a"));
    input.allowedClaims[0].personId = "person:c";
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(input.allowedClaims[1])).toBe(false);
    expect(challenge).toEqual(full);
  });

  it("P23 parsed root, array and claims are frozen", () => {
    expect(() => ((full as any).caseId = "case:x")).toThrow(TypeError);
    expect(() => (full.allowedClaims as any).push(resp("a"))).toThrow(TypeError);
    expect(() => ((full.allowedClaims[0] as any).eventId = "event:storm")).toThrow(TypeError);
  });

  it("P24 / B14 scope and property order are preserved and irrelevant", () => {
    const reversed = claimUniverse()
      .reverse()
      .map((c) => Object.fromEntries(Object.entries(c).reverse()));
    const challenge = makeChallenge(truth, s1, reversed);
    expect(challenge.allowedClaims.map((c) => claimKey(c as ConclusionClaim))).toEqual(reversed.map((c) => claimKey(c as ConclusionClaim)));
    const accusation = accuse(truth, X1);
    expect(evaluateChallengeAccusation(truth, s1, challenge, accusation)).toEqual(
      evaluateChallengeAccusation(truth, s1, full, accusation),
    );
  });
});

describe("verdict (V01..V43)", () => {
  const R = X1;
  const plus = (...extra: Literal[]) => [...R, ...extra];

  it("V01 exactly the required literals", () => expect(judge(S1, R)).toEqual(SOLVED));
  it("V02 empty accusation", () => expect(judge(S1, [])).toEqual(NOT_SOLVED));
  it("V03 one required literal missing", () => expect(judge(S1, R.slice(1))).toEqual(NOT_SOLVED));
  it("V04 required false flipped to true", () => expect(judge(S1, [R[0]!, [resp("b"), true], R[2]!])).toEqual(NOT_SOLVED));
  it("V05 required true flipped to false", () => expect(judge(S1, [[resp("a"), false], R[1]!, R[2]!])).toEqual(NOT_SOLVED));
  it("V06/V39 extra in-scope canonically true claim", () => expect(judge(S1, plus([role("a", "direct_actor"), true]))).toEqual(SOLVED));
  it("V07 extra in-scope canonically false claim asserted false", () => expect(judge(S1, plus([resp("c"), false]))).toEqual(SOLVED));

  it("V08 out-of-scope canonically true claim", () => {
    expect(canonicalStatus(truth, S1_RES, role("a", "planner"))).toBe(true);
    expect(judge(S1, plus([role("a", "planner"), true]), universeWithout(role("a", "planner")))).toEqual(NOT_SOLVED);
  });

  it("V09 out-of-scope canonically false claim", () => {
    expect(judge(S1, plus([resp("c"), false]), universeWithout(resp("c")))).toEqual(NOT_SOLVED);
  });

  it("V10/V35 in-scope false claim asserted true", () => expect(judge(S1, plus([resp("c"), true]))).toEqual(NOT_SOLVED));
  it("V11 in-scope true claim asserted false", () => expect(judge(S1, plus([role("a", "planner"), false]))).toEqual(NOT_SOLVED));

  it.each([true, false])("V12/V13 partial: unlisted person asserted %s is never accepted, though core may solve", (value) => {
    const literals = plus([resp("b", "poisoning"), value]);
    expect(evaluateAccusation(truth, s1, accuse(truth, literals))).toEqual(SOLVED);
    expect(judge(S1, literals)).toEqual(NOT_SOLVED);
  });

  it("V14 partial: listed required actor correct", () => {
    const spec: SolutionSpec = { resolutions: S1_RES, required: [...R, [resp("a", "poisoning"), true]] };
    expect(judge(spec, spec.required)).toEqual(SOLVED);
  });

  it.each([true, false])("V15/V16 roles null: role claim asserted %s", (value) => {
    expect(judge(S1, plus([role("a", "direct_actor", "poisoning"), value]))).toEqual(NOT_SOLVED);
  });

  const S6_RES = [res("death", "partial", [who("a", ["direct_actor"])], { intent: "intended", mechanism: "ordinary" })];
  const S6: SolutionSpec = { resolutions: S6_RES, required: [[role("a", "direct_actor"), true]] };

  it("V17 known role list is closed: planner=false", () => {
    expect(judge(S6, [...S6.required, [role("a", "planner"), false]])).toEqual(SOLVED);
  });

  it.each([true, false])("V18 unknown cause with causesComplete false, asserted %s", (value) => {
    expect(judge(S6, [...S6.required, [caused("storm"), value]])).toEqual(NOT_SOLVED);
  });

  it("V19 known direct cause with causesComplete false", () => {
    expect(judge(S6, [...S6.required, [caused("poisoning"), true]])).toEqual(SOLVED);
  });

  const S5: SolutionSpec = {
    resolutions: [res("death", "partial", [who("a", null)], { mechanism: "mixed" })],
    required: [
      [resp("a"), true],
      [mech("mixed"), true],
    ],
  };
  const S7: SolutionSpec = { resolutions: [res("death", "partial", [])], required: [[caused("poisoning"), true]] };

  it("V20 intent null: every option with both polarities", () => {
    for (const option of ["intended", "unintended", "not_applicable"]) {
      for (const value of [true, false]) expect(judge(S5, [...S5.required, [intent(option), value]])).toEqual(NOT_SOLVED);
    }
  });

  it("V21 mechanism null: every option with both polarities", () => {
    for (const option of ["ordinary", "supernatural", "mixed"]) {
      for (const value of [true, false]) expect(judge(S7, [...S7.required, [mech(option), value]])).toEqual(NOT_SOLVED);
    }
  });

  it.each([true, false])("V22 event without resolution stays undetermined (%s)", (value) => {
    expect(judge(S1, plus([resp("a", "storm"), value]))).toEqual(NOT_SOLVED);
  });

  it("V23 complete without persons: nobody=true", () => {
    const S4: SolutionSpec = { resolutions: [res("death", "complete", [])], required: [[nobody(), true]] };
    expect(judge(S4, S4.required)).toEqual(SOLVED);
  });

  it.each([true, false])("V24 partial without persons: nobody=%s", (value) => {
    expect(judge(S7, [...S7.required, [nobody(), value]])).toEqual(NOT_SOLVED);
  });

  it("V25 nobody=true next to a responsible person", () => {
    expect(judge(S1, plus([nobody(), true]))).toEqual(NOT_SOLVED);
  });

  it("V26 partial empty: nobody and every person asserted true, core solves, wrapper does not", () => {
    const literals: Literal[] = [...S7.required, [nobody(), true], [resp("a"), true], [resp("b"), true], [resp("c"), true]];
    const solution = makeSolution(truth, S7);
    expect(evaluateAccusation(truth, solution, accuse(truth, literals))).toEqual(SOLVED);
    expect(judge(S7, literals)).toEqual(NOT_SOLVED);
  });

  it("V27 two and three legitimate actors, all required", () => {
    const two: SolutionSpec = {
      resolutions: [res("death", "complete", [who("a", ["planner"]), who("b")])],
      required: [
        [resp("a"), true],
        [resp("b"), true],
        [role("b", "direct_actor"), true],
      ],
    };
    expect(judge(two, two.required)).toEqual(SOLVED);
    const three: SolutionSpec = {
      resolutions: [res("death", "complete", [who("a"), who("b"), who("c")])],
      required: [
        [resp("a"), true],
        [resp("b"), true],
        [resp("c"), true],
      ],
    };
    expect(judge(three, three.required)).toEqual(SOLVED);
    // V34 one of several required actors missing
    expect(judge(three, three.required.slice(0, 2))).toEqual(NOT_SOLVED);
  });

  it("V28/V29 planner or facilitator plus direct actor with correct extra roles", () => {
    for (const helper of ["planner", "facilitator"]) {
      const spec: SolutionSpec = {
        resolutions: [res("death", "complete", [who("a", [helper]), who("b")])],
        required: [
          [resp("a"), true],
          [resp("b"), true],
        ],
      };
      expect(judge(spec, [...spec.required, [role("a", helper), true], [role("b", "direct_actor"), true]])).toEqual(SOLVED);
    }
  });

  it("V30 a person with two and with three known roles", () => {
    expect(judge(S1, plus([role("a", "direct_actor"), true], [role("a", "planner"), true], [role("a", "facilitator"), false]))).toEqual(
      SOLVED,
    );
    const all3: SolutionSpec = {
      resolutions: [res("death", "complete", [who("a", ["direct_actor", "planner", "facilitator"])])],
      required: [[resp("a"), true]],
    };
    const roles: Literal[] = ["direct_actor", "planner", "facilitator"].map((r) => [role("a", r), true]);
    expect(judge(all3, [...all3.required, ...roles])).toEqual(SOLVED);
  });

  it("V31/V32 six persons: accusing all is wrong unless all are responsible", () => {
    const six = crowdTruth(6);
    const persons = personIds(six);
    const everyone: Literal[] = persons.map((p) => [resp(p), true]);
    const scope = persons.map((p) => resp(p));
    const one: SolutionSpec = { resolutions: [res("death", "complete", [who("a")])], required: [[resp("a"), true]] };
    expect(judge(one, everyone, scope, six)).toEqual(NOT_SOLVED);
    const all: SolutionSpec = { resolutions: [res("death", "complete", persons.map((p) => who(p)))], required: everyone };
    expect(judge(all, everyone, scope, six)).toEqual(SOLVED);
  });

  it("V33 all three roles for every candidate, at least one wrong or undetermined", () => {
    const literals: Literal[] = [...R];
    for (const p of ["a", "b", "c"]) for (const r of ["direct_actor", "planner", "facilitator"]) literals.push([role(p, r), p === "a"]);
    expect(judge(S1, literals)).toEqual(NOT_SOLVED);
  });

  it("V36/V37/V38 duplicates and guessed unknown IDs are rejected by the MYST-0002 parser", () => {
    expect(() => accuse(truth, [...R, [resp("a"), true]])).toThrow(ZodError);
    expect(() => accuse(truth, [...R, [resp("a"), false]])).toThrow(ZodError);
    expect(() => accuse(truth, [...R, [Object.fromEntries(Object.entries(resp("a")).reverse()), true]])).toThrow(ZodError);
    expect(() => accuse(truth, [...R, [resp("zed"), true]])).toThrow(ZodError);
  });

  it("V40 literal and property order do not change the verdict", () => {
    const literals: Literal[] = [...plus([role("a", "direct_actor"), true])].reverse();
    expect(judge(S1, literals.map(([c, v]) => [Object.fromEntries(Object.entries(c).reverse()), v]))).toEqual(SOLVED);
  });

  it("V41 more claims than the scope holds", () => {
    const scope = R.map(([c]) => c);
    expect(judge(S1, plus([resp("c"), false]), scope)).toEqual(NOT_SOLVED);
  });

  it("V42 every literal is checked, not only the first", () => {
    expect(judge(S1, plus([resp("c"), false], [resp("b", "poisoning"), true]))).toEqual(NOT_SOLVED);
    expect(judge(S1, plus([resp("c"), false], [role("a", "planner"), true]), universeWithout(role("a", "planner")))).toEqual(NOT_SOLVED);
  });

  it("V43 a verdict carries exactly success and verdict, frozen", () => {
    for (const result of [judge(S1, R), judge(S1, [])]) {
      expect(Object.keys(result)).toEqual(["success", "verdict"]);
      expect(Object.isFrozen(result)).toBe(true);
    }
  });
});

describe("binding (B01..B15)", () => {
  const accusation = accuse(truth, X1);
  const CHALLENGE = { success: false, code: "CHALLENGE_BINDING_MISMATCH" };

  it("B01 unchanged documents", () => {
    expect(evaluateChallengeAccusation(truth, s1, full, accusation)).toEqual(SOLVED);
  });

  it("B02/B03/B06/B07 any change of the answer key unbinds the challenge", () => {
    const variants: SolutionSpec[] = [
      { resolutions: [res("death", "complete", [who("b")])], required: [[resp("b"), true]] },
      { ...S1, revision: 2 },
      { ...S1, extra: [resp("c")] },
    ];
    for (const spec of variants) {
      expect(evaluateChallengeAccusation(truth, makeSolution(truth, spec), full, accusation)).toEqual(CHALLENGE);
    }
    const withExtra = makeSolution(truth, { ...S1, extra: [resp("c")] });
    const extraChallenge = makeChallenge(truth, withExtra, claimUniverse());
    expect(evaluateChallengeAccusation(truth, s1, extraChallenge, accusation)).toEqual(CHALLENGE);
  });

  it("B04/B08 changed or foreign truth with a matching new solution; old challenge", () => {
    for (const edit of [(t: any) => (t.title = "Anderer Titel"), (t: any) => (t.caseId = "case:other")]) {
      const input: any = solutionTruthInput();
      edit(input);
      const other = parseCaseTruth(input);
      const otherSolution = makeSolution(other, S1);
      expect(evaluateChallengeAccusation(other, otherSolution, full, accuse(other, X1))).toEqual(CHALLENGE);
    }
  });

  it("B05 permuted truth and solution arrays keep the binding", () => {
    const input: any = solutionTruthInput();
    input.persons.reverse();
    input.events.reverse();
    const permuted = parseCaseTruth(input);
    const sIn = solutionInput(permuted, S1);
    sIn.resolutions.reverse();
    sIn.conclusions.reverse();
    const permutedSolution = parseCaseSolution(sIn, permuted);
    expect(evaluateChallengeAccusation(permuted, permutedSolution, full, accusation)).toEqual(SOLVED);
  });

  it("B09 solution not bound to the truth comes first", () => {
    const s1t2 = makeSolution(T2(), S1);
    expect(evaluateChallengeAccusation(truth, s1t2, full, accusation)).toEqual({ success: false, code: "SOLUTION_BINDING_MISMATCH" });
    expect(issuesOf(() => parseAccusationChallenge(challengeInput(truth, s1, claimUniverse()), truth, s1t2))).toEqual([
      { path: [], message: "SOLUTION_BINDING_MISMATCH: the CaseSolution is not bound to the CaseTruth" },
    ]);
  });

  it.each([
    ["caseId", (c: any) => (c.caseId = "case:other")],
    ["truthHash", (c: any) => (c.truthHash = "0".repeat(64))],
    ["solutionHash", (c: any) => (c.solutionHash = "0".repeat(64))],
  ])("B10 wrong %s at parse: exactly that issue, no follow-ups", (field, edit) => {
    const input = challengeInput(truth, s1, [...claimUniverse(), resp("zed")]);
    edit(input);
    expect(pathsOf(() => parseAccusationChallenge(input, truth, s1))).toEqual([[field]]);
  });

  it("B11 accusation bound to another truth", () => {
    const stale = accuse(T2(), X1);
    expect(evaluateChallengeAccusation(truth, s1, full, stale)).toEqual({ success: false, code: "ACCUSATION_BINDING_MISMATCH" });
  });

  it("B12 empty accusation with a stale challenge is a host error, never not_solved", () => {
    const stale = makeChallenge(truth, makeSolution(truth, { ...S1, revision: 9 }), claimUniverse());
    expect(evaluateChallengeAccusation(truth, s1, stale, accuse(truth, []))).toEqual(CHALLENGE);
  });

  it("B13 priority: solution, then challenge, then accusation", () => {
    const s1t2 = makeSolution(T2(), S1);
    const staleChallenge = makeChallenge(truth, makeSolution(truth, { ...S1, revision: 9 }), claimUniverse());
    const staleAccusation = accuse(T2(), X1);
    expect(evaluateChallengeAccusation(truth, s1t2, staleChallenge, staleAccusation)).toEqual({
      success: false,
      code: "SOLUTION_BINDING_MISMATCH",
    });
    expect(evaluateChallengeAccusation(truth, s1, staleChallenge, staleAccusation)).toEqual(CHALLENGE);
    expect(evaluateChallengeAccusation(truth, s1, full, staleAccusation)).toEqual({ success: false, code: "ACCUSATION_BINDING_MISMATCH" });
  });

  it("B15 technical claim errors from the core pass through unchanged", () => {
    // Unreachable with parsed documents; forged snapshots exercise the pass-through.
    const forge = (claim: object) => {
      const challenge = { ...full, allowedClaims: [...full.allowedClaims, claim] } as unknown as AccusationChallenge;
      const forged = { ...accusation, literals: [...accusation.literals, { claim, value: true }] } as unknown as Accusation;
      return evaluateChallengeAccusation(truth, s1, challenge, forged);
    };
    expect(forge({ kind: "personGuilty", eventId: "event:death" })).toEqual({ success: false, code: "INVALID_CLAIM" });
    expect(forge(resp("zed"))).toEqual({ success: false, code: "UNKNOWN_REFERENCE" });
  });
});

describe("deterministic properties against an independent set oracle (§8)", () => {
  const rng = lcg();
  const PERSONS = ["a", "b", "c"];
  const ROLES = ["direct_actor", "planner", "facilitator"];
  const INTENTS = ["intended", "unintended", "not_applicable"];
  const MECHANISMS = ["ordinary", "supernatural", "mixed"];
  const universe = claimUniverse();

  function randomResolution(event: string): Resolution {
    const persons = rng.shuffle(PERSONS).slice(0, rng.int(4));
    const assignments = persons.map((p) => who(p, rng.chance(0.3) ? null : rng.shuffle(ROLES).slice(0, 1 + rng.int(3))));
    return res(event, rng.chance(0.5) ? "complete" : "partial", assignments, {
      intent: rng.chance(0.3) ? null : rng.pick(INTENTS),
      mechanism: rng.chance(0.3) ? null : rng.pick(MECHANISMS),
      causesComplete: rng.chance(0.5),
    });
  }

  const witnesses = { solved: 0, extraKept: 0, missingFails: 0, flipFails: 0, coreSolvedWrapperNot: 0, completeConfigs: 0, partialConfigs: 0 };
  let attempts = 0;

  it("E = oracle over 30 configs and at least 2000 attempts", () => {
    for (let config = 0; config < 30; config++) {
      const resolutions = [randomResolution("death"), ...(rng.chance(0.5) ? [randomResolution("poisoning")] : [])];
      if (resolutions[0]!.responsibility.completeness === "complete") witnesses.completeConfigs++;
      else witnesses.partialConfigs++;
      const status = new Map(universe.map((c) => [claimKey(c as ConclusionClaim), canonicalStatus(truth, resolutions, c)]));
      const determined = universe.filter((c) => status.get(claimKey(c as ConclusionClaim)) !== "undetermined");
      const signed = (c: Claim): Literal => [c, status.get(claimKey(c as ConclusionClaim)) as boolean];
      const required = rng.shuffle(determined).slice(0, 1 + rng.int(3)).map(signed);
      const spec: SolutionSpec = { resolutions, required };
      const solution = makeSolution(truth, spec);
      const requiredKeys = new Set(required.map(([c]) => claimKey(c as ConclusionClaim)));
      const scope = rng.shuffle([
        ...required.map(([c]) => c),
        ...universe.filter((c) => !requiredKeys.has(claimKey(c as ConclusionClaim)) && rng.chance(0.6)),
      ]);
      const challenge = makeChallenge(truth, solution, scope);
      const M = new Set(scope.filter((c) => status.get(claimKey(c as ConclusionClaim)) !== "undetermined").map((c) => claimKey(c as ConclusionClaim) + "=" + String(status.get(claimKey(c as ConclusionClaim)))));
      const R = new Set(required.map(([c, v]) => claimKey(c as ConclusionClaim) + "=" + String(v)));

      for (let k = 0; k < 70; k++) {
        attempts++;
        // Mix: correct sets around R, random noise, and targeted perturbations.
        let literals: Literal[];
        const correctExtras = scope.filter((c) => !requiredKeys.has(claimKey(c as ConclusionClaim)) && M.has(claimKey(c as ConclusionClaim) + "=" + String(status.get(claimKey(c as ConclusionClaim))))).map(signed);
        const mode = k % 5;
        if (mode === 0) literals = [...required, ...rng.shuffle(correctExtras).slice(0, rng.int(4))];
        else if (mode === 1) literals = rng.shuffle(universe).slice(0, rng.int(6)).map((c) => [c, rng.chance(0.5)] as Literal);
        else if (mode === 2) literals = [...required, ...rng.shuffle(universe).slice(0, 1 + rng.int(2)).map((c) => [c, rng.chance(0.5)] as Literal)];
        else if (mode === 3) literals = required.filter(() => rng.chance(0.5));
        else literals = required.map(([c, v]) => [c, rng.chance(0.3) ? !v : v] as Literal);
        // Unique claims only: the MYST-0002 parser would reject duplicates.
        const seen = new Set<string>();
        literals = literals.filter(([c]) => !seen.has(claimKey(c as ConclusionClaim)) && !!seen.add(claimKey(c as ConclusionClaim)));
        const accusation = accuse(truth, literals);

        const A = literals.map(([c, v]) => claimKey(c as ConclusionClaim) + "=" + String(v));
        const oracle = [...R].every((r) => A.includes(r)) && A.every((a) => M.has(a));
        const result = evaluateChallengeAccusation(truth, solution, challenge, accusation);
        expect(result).toEqual(oracle ? SOLVED : NOT_SOLVED); // (2), (4)

        // (1) permutation of literals, properties and scope.
        const permuted = accuse(truth, rng.shuffle(literals).map(([c, v]) => [Object.fromEntries(Object.entries(c).reverse()), v]));
        const permutedChallenge = makeChallenge(truth, solution, rng.shuffle(scope));
        expect(evaluateChallengeAccusation(truth, solution, permutedChallenge, permuted)).toEqual(result);

        const core = evaluateAccusation(truth, solution, accusation);
        if (oracle) {
          witnesses.solved++;
          expect(core).toEqual(SOLVED); // (3)
        } else if (core.success && core.verdict === "solved") witnesses.coreSolvedWrapperNot++;
        if (mode === 0 && literals.length > required.length && oracle) witnesses.extraKept++; // (6)
        if (mode === 3 && literals.length < required.length) {
          witnesses.missingFails++;
          expect(result).toEqual(NOT_SOLVED); // (5)
        }
        if (mode === 4 && literals.some(([c, v], i) => v !== required[i]![1])) {
          witnesses.flipFails++;
          expect(result).toEqual(NOT_SOLVED); // (7)
        }
      }
    }
    expect(attempts).toBeGreaterThanOrEqual(2000);
    for (const [name, count] of Object.entries(witnesses)) expect(count, name).toBeGreaterThan(0);
  }, 300_000);

  it("(8)/(9) reparse keeps the snapshot; reordering keeps hashes, content changes do not", () => {
    const again = parseAccusationChallenge(JSON.parse(JSON.stringify(full)), truth, s1);
    expect(again).toEqual(full);
    const input: any = solutionInput(truth, S1);
    input.conclusions.reverse();
    const reordered = parseCaseSolution(input, truth);
    expect(evaluateChallengeAccusation(truth, reordered, full, accuse(truth, X1))).toEqual(SOLVED);
    const changed = makeSolution(truth, { ...S1, revision: 3 });
    expect(evaluateChallengeAccusation(truth, changed, full, accuse(truth, X1))).toEqual({
      success: false,
      code: "CHALLENGE_BINDING_MISMATCH",
    });
  });
});

