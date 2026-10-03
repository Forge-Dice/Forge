import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { parseCaseTruth } from "../src/domain/case-truth.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import { validateCaseSemantics } from "../src/domain/case-semantics.ts";
import { createCaseSolutionSchema, parseCaseSolution } from "../src/domain/case-solution.ts";
import { hashCaseSolution, serializeCaseSolution } from "../src/domain/case-solution.identity.ts";
import { baseSolution, solutionTruth, solutionTruthInput } from "./case-solution.fixture.ts";

type Mutation = (s: any) => void;
type Path = (string | number)[];
type Status = true | false | "undetermined";

const truth = solutionTruth();
const schema = createCaseSolutionSchema(truth);

function variant(mutate: Mutation) {
  const s: any = baseSolution();
  mutate(s);
  return s;
}

const accepts = (input: unknown) => schema.safeParse(input).success;

function expectRejectedAt(input: unknown, path: Path) {
  const result = schema.safeParse(input);
  expect(result.success).toBe(false);
  expect(result.error!.issues.map((issue) => JSON.stringify(issue.path))).toContain(JSON.stringify(path));
}

const ROOT_KEYS = ["caseId", "conclusions", "requiredConclusions", "resolutions", "revision", "schemaVersion", "truthHash"];

// Black-box probe of the private resolver through the public parser: a conclusion is true
// if only `value: true` can be required, false if only `value: false`, undetermined if neither.
function statusOf(resolution: Mutation, claim: object): Status {
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

const responsible = (person: string) => ({ kind: "personResponsibleForEvent", personId: `person:${person}`, eventId: "event:death" });
const role = (person: string, r: string) => ({ kind: "personRoleForEvent", personId: `person:${person}`, eventId: "event:death", role: r });
const nobody = { kind: "noPersonResponsibleForEvent", eventId: "event:death" };
const caused = (cause: string) => ({ kind: "eventCausedEvent", causeEventId: `event:${cause}`, eventId: "event:death" });
const intent = (value: string) => ({ kind: "eventIntent", eventId: "event:death", value });
const mechanism = (value: string) => ({ kind: "eventMechanism", eventId: "event:death", value });

const responsibility = (completeness: string, assignments: object[]): Mutation => (r) => {
  r.responsibility = { completeness, assignments };
};
const A_ACTOR = { personId: "person:a", roles: ["direct_actor"] };
const A_UNKNOWN_ROLE = { personId: "person:a", roles: null };

describe("accepted answer keys", () => {
  it("base: one event, one responsible person, one matching required conclusion", () => {
    expect(accepts(baseSolution())).toBe(true);
  });

  it("AC-09: several responsible people, several roles and several required conclusions", () => {
    const solution = variant((s) => {
      s.resolutions[0].responsibility.assignments = [
        { personId: "person:a", roles: ["direct_actor", "planner"] },
        { personId: "person:b", roles: ["facilitator"] },
      ];
      s.conclusions.push(
        { id: "conclusion:b-responsible", claim: responsible("b") },
        { id: "conclusion:a-planned", claim: role("a", "planner") },
        { id: "conclusion:b-not-actor", claim: role("b", "direct_actor") },
      );
      s.requiredConclusions.push(
        { conclusionId: "conclusion:b-responsible", value: true },
        { conclusionId: "conclusion:a-planned", value: true },
        { conclusionId: "conclusion:b-not-actor", value: false },
      );
    });
    expect(accepts(solution)).toBe(true);
  });

  it("conclusions that are not required may be false or undetermined", () => {
    const solution = variant((s) => {
      s.resolutions[0].intent = null;
      s.conclusions.push(
        { id: "conclusion:false-one", claim: responsible("b") },
        { id: "conclusion:open-one", claim: intent("intended") },
      );
    });
    expect(accepts(solution)).toBe(true);
  });

  it("targets may be empty and a cause event needs no resolution of its own", () => {
    const solution = variant((s) => {
      s.resolutions[0].targets = [];
      s.conclusions.push({ id: "conclusion:poison-caused", claim: caused("poisoning") });
      s.requiredConclusions.push({ conclusionId: "conclusion:poison-caused", value: true });
    });
    expect(accepts(solution)).toBe(true);
  });

  it("accepts Number.MAX_SAFE_INTEGER as revision", () => {
    expect(accepts(variant((s) => (s.revision = Number.MAX_SAFE_INTEGER)))).toBe(true);
  });
});

describe("AC-03/04/10: strict shape and formats", () => {
  it.each<[string, Mutation, Path]>([
    ["root", (s) => (s.truth = {}), []],
    ["resolution", (s) => (s.resolutions[0].note = "x"), ["resolutions", 0]],
    ["responsibility", (s) => (s.resolutions[0].responsibility.guilty = true), ["resolutions", 0, "responsibility"]],
    ["assignment", (s) => (s.resolutions[0].responsibility.assignments[0].confidence = 1), ["resolutions", 0, "responsibility", "assignments", 0]],
    ["target", (s) => (s.resolutions[0].targets[0].name = "Clara"), ["resolutions", 0, "targets", 0]],
    ["conclusion", (s) => (s.conclusions[0].label = "x"), ["conclusions", 0]],
    ["claim", (s) => (s.conclusions[0].claim.role = "planner"), ["conclusions", 0, "claim"]],
    ["required literal", (s) => (s.requiredConclusions[0].weight = 1), ["requiredConclusions", 0]],
    ["AC-10: truth field on a conclusion", (s) => (s.conclusions[0].truth = true), ["conclusions", 0]],
  ])("rejects an unknown property on %s", (_name, mutate, path) => {
    expectRejectedAt(variant(mutate), path);
  });

  it.each<[string, Mutation, Path]>([
    ["truthHash", (s) => delete s.truthHash, ["truthHash"]],
    ["resolutions", (s) => delete s.resolutions, ["resolutions"]],
    ["resolution intent (null is required, not absence)", (s) => delete s.resolutions[0].intent, ["resolutions", 0, "intent"]],
    ["causesComplete", (s) => delete s.resolutions[0].causesComplete, ["resolutions", 0, "causesComplete"]],
    ["completeness", (s) => delete s.resolutions[0].responsibility.completeness, ["resolutions", 0, "responsibility", "completeness"]],
    ["assignment roles", (s) => delete s.resolutions[0].responsibility.assignments[0].roles, ["resolutions", 0, "responsibility", "assignments", 0, "roles"]],
    ["role of a role claim", (s) => (s.conclusions[0].claim = { kind: "personRoleForEvent", personId: "person:a", eventId: "event:death" }), ["conclusions", 0, "claim", "role"]],
    ["required value", (s) => delete s.requiredConclusions[0].value, ["requiredConclusions", 0, "value"]],
  ])("rejects a missing %s", (_name, mutate, path) => {
    expectRejectedAt(variant(mutate), path);
  });

  it.each<[string, Mutation, Path]>([
    ["schemaVersion 2", (s) => (s.schemaVersion = 2), ["schemaVersion"]],
    ["revision 0", (s) => (s.revision = 0), ["revision"]],
    ["fractional revision", (s) => (s.revision = 1.5), ["revision"]],
    ["unsafe revision", (s) => (s.revision = 2 ** 53), ["revision"]],
    ["string revision", (s) => (s.revision = "1"), ["revision"]],
    ["uppercase truthHash", (s) => (s.truthHash = s.truthHash.toUpperCase()), ["truthHash"]],
    ["short truthHash", (s) => (s.truthHash = s.truthHash.slice(1)), ["truthHash"]],
    ["truthHash with trailing newline", (s) => (s.truthHash = `${s.truthHash}\n`), ["truthHash"]],
    ["conclusion ID with wrong prefix", (s) => (s.conclusions[0].id = "event:a-responsible"), ["conclusions", 0, "id"]],
    ["conclusion ID with uppercase", (s) => (s.conclusions[0].id = "conclusion:A"), ["conclusions", 0, "id"]],
    ["conclusion ID with trailing newline", (s) => (s.conclusions[0].id = "conclusion:a-responsible\n"), ["conclusions", 0, "id"]],
    ["conclusion ID slug longer than 64", (s) => (s.conclusions[0].id = `conclusion:${"a".repeat(65)}`), ["conclusions", 0, "id"]],
    ["literal conclusion ID format", (s) => (s.requiredConclusions[0].conclusionId = "conclusion:"), ["requiredConclusions", 0, "conclusionId"]],
    ["unknown role", (s) => (s.resolutions[0].responsibility.assignments[0].roles = ["witness"]), ["resolutions", 0, "responsibility", "assignments", 0, "roles", 0]],
    ["unknown intent", (s) => (s.resolutions[0].intent = "maybe"), ["resolutions", 0, "intent"]],
    ["unknown mechanism", (s) => (s.resolutions[0].mechanism = "magic"), ["resolutions", 0, "mechanism"]],
    ["unknown completeness", (s) => (s.resolutions[0].responsibility.completeness = "total"), ["resolutions", 0, "responsibility", "completeness"]],
    ["unknown claim kind", (s) => (s.conclusions[0].claim.kind = "personGuilty"), ["conclusions", 0, "claim", "kind"]],
    ["target kind/id mismatch", (s) => (s.resolutions[0].targets[0] = { kind: "item", id: "person:c" }), ["resolutions", 0, "targets", 0, "id"]],
    ["empty resolutions", (s) => (s.resolutions = []), ["resolutions"]],
    ["empty conclusions", (s) => (s.conclusions = []), ["conclusions"]],
    ["empty requiredConclusions", (s) => (s.requiredConclusions = []), ["requiredConclusions"]],
  ])("rejects %s", (_name, mutate, path) => {
    expectRejectedAt(variant(mutate), path);
  });

  it("accepts the slug length limit of 64", () => {
    const id = `conclusion:${"a".repeat(64)}`;
    expect(accepts(variant((s) => {
      s.conclusions[0].id = id;
      s.requiredConclusions[0].conclusionId = id;
    }))).toBe(true);
  });
});

describe("AC-05: binding to the CaseTruth snapshot", () => {
  it("rejects a different caseId", () => {
    expectRejectedAt(variant((s) => (s.caseId = "case:other")), ["caseId"]);
  });

  it("rejects a well-formed but different truthHash", () => {
    expectRejectedAt(variant((s) => (s.truthHash = "0".repeat(64))), ["truthHash"]);
  });

  it("rejects a solution for another revision of the same case", () => {
    const nextTruth = parseCaseTruth({ ...solutionTruthInput(), revision: 2 });
    expectRejectedAt(variant((s) => (s.truthHash = hashCaseTruth(nextTruth))), ["truthHash"]);
  });

  it("rejects a matching hash when parsed against a different truth with the same caseId and revision", () => {
    const edited = parseCaseTruth({ ...solutionTruthInput(), title: "Gift im Kaffee" });
    expect(createCaseSolutionSchema(edited).safeParse(baseSolution()).success).toBe(false);
  });

  it("does not depend on the truth revision for its own revision", () => {
    expect(accepts(variant((s) => (s.revision = 7)))).toBe(true);
  });
});

describe("AC-06: references", () => {
  it.each<[string, Mutation, Path]>([
    ["resolution event", (s) => (s.resolutions[0].eventId = "event:ghost"), ["resolutions", 0, "eventId"]],
    ["person target", (s) => (s.resolutions[0].targets[0].id = "person:ghost"), ["resolutions", 0, "targets", 0, "id"]],
    ["item target", (s) => s.resolutions[0].targets.push({ kind: "item", id: "item:ghost" }), ["resolutions", 0, "targets", 1, "id"]],
    ["location target", (s) => s.resolutions[0].targets.push({ kind: "location", id: "location:ghost" }), ["resolutions", 0, "targets", 1, "id"]],
    ["responsible person", (s) => (s.resolutions[0].responsibility.assignments[0].personId = "person:ghost"), ["resolutions", 0, "responsibility", "assignments", 0, "personId"]],
    ["conclusion event", (s) => (s.conclusions[0].claim.eventId = "event:ghost"), ["conclusions", 0, "claim", "eventId"]],
    ["conclusion event without resolution", (s) => (s.conclusions[0].claim.eventId = "event:poisoning"), ["conclusions", 0, "claim", "eventId"]],
    ["conclusion person", (s) => (s.conclusions[0].claim.personId = "person:ghost"), ["conclusions", 0, "claim", "personId"]],
    ["role conclusion person", (s) => (s.conclusions[0].claim = role("ghost", "planner")), ["conclusions", 0, "claim", "personId"]],
    ["cause event", (s) => (s.conclusions[0].claim = caused("ghost")), ["conclusions", 0, "claim", "causeEventId"]],
    ["caused event", (s) => (s.conclusions[0].claim = { ...caused("poisoning"), eventId: "event:ghost" }), ["conclusions", 0, "claim", "eventId"]],
    ["intent event", (s) => (s.conclusions[0].claim = { ...intent("intended"), eventId: "event:storm" }), ["conclusions", 0, "claim", "eventId"]],
    ["mechanism event", (s) => (s.conclusions[0].claim = { ...mechanism("ordinary"), eventId: "event:ghost" }), ["conclusions", 0, "claim", "eventId"]],
    ["no-person event", (s) => (s.conclusions[0].claim = { ...nobody, eventId: "event:purchase" }), ["conclusions", 0, "claim", "eventId"]],
    ["required conclusion", (s) => (s.requiredConclusions[0].conclusionId = "conclusion:ghost"), ["requiredConclusions", 0, "conclusionId"]],
  ])("rejects an unresolved %s", (_name, mutate, path) => {
    expectRejectedAt(variant(mutate), path);
  });
});

describe("AC-06: uniqueness and local rules", () => {
  it.each<[string, Mutation, Path]>([
    ["duplicate conclusion ID", (s) => s.conclusions.push({ id: "conclusion:a-responsible", claim: nobody }), ["conclusions", 1, "id"]],
    ["two resolutions of one event", (s) => s.resolutions.push(structuredClone(s.resolutions[0])), ["resolutions", 1, "eventId"]],
    ["two assignments of one person", (s) => s.resolutions[0].responsibility.assignments.push(A_UNKNOWN_ROLE), ["resolutions", 0, "responsibility", "assignments", 1]],
    ["duplicate role", (s) => (s.resolutions[0].responsibility.assignments[0].roles = ["planner", "planner"]), ["resolutions", 0, "responsibility", "assignments", 0, "roles", 1]],
    ["duplicate target", (s) => s.resolutions[0].targets.push({ id: "person:c", kind: "person" }), ["resolutions", 0, "targets", 1]],
    ["empty role list (null is the explicit alternative)", (s) => (s.resolutions[0].responsibility.assignments[0].roles = []), ["resolutions", 0, "responsibility", "assignments", 0, "roles"]],
    ["the same required conclusion twice", (s) => s.requiredConclusions.push({ conclusionId: "conclusion:a-responsible", value: true }), ["requiredConclusions", 1, "conclusionId"]],
    ["the same required conclusion with opposite values", (s) => s.requiredConclusions.push({ conclusionId: "conclusion:a-responsible", value: false }), ["requiredConclusions", 1, "conclusionId"]],
    [
      "an identical claim under another ID (property order ignored)",
      (s) => s.conclusions.push({ id: "conclusion:copy", claim: { eventId: "event:death", personId: "person:a", kind: "personResponsibleForEvent" } }),
      ["conclusions", 1, "claim"],
    ],
    ["an event claimed as its own cause", (s) => (s.conclusions[0].claim = { ...caused("death") }), ["conclusions", 0, "claim", "causeEventId"]],
  ])("rejects %s", (_name, mutate, path) => {
    expectRejectedAt(variant(mutate), path);
  });

  it("claims that differ in any field are not duplicates", () => {
    const solution = variant((s) => {
      s.conclusions.push(
        { id: "conclusion:b", claim: responsible("b") },
        { id: "conclusion:a-actor", claim: role("a", "direct_actor") },
        { id: "conclusion:a-planner", claim: role("a", "planner") },
      );
    });
    expect(accepts(solution)).toBe(true);
  });
});

describe("AC-07: conclusion truth table", () => {
  it.each<[string, Mutation, object, Status]>([
    // personResponsibleForEvent
    ["responsible: assigned", responsibility("complete", [A_ACTOR]), responsible("a"), true],
    ["responsible: assigned with unknown role", responsibility("partial", [A_UNKNOWN_ROLE]), responsible("a"), true],
    ["responsible: missing, complete", responsibility("complete", [A_ACTOR]), responsible("b"), false],
    ["responsible: missing, partial", responsibility("partial", [A_ACTOR]), responsible("b"), "undetermined"],
    // personRoleForEvent
    ["role: known list contains role", responsibility("complete", [A_ACTOR]), role("a", "direct_actor"), true],
    ["role: known list lacks role", responsibility("complete", [A_ACTOR]), role("a", "planner"), false],
    ["role: known list lacks role, responsibility partial", responsibility("partial", [A_ACTOR]), role("a", "planner"), false],
    ["role: roles null", responsibility("complete", [A_UNKNOWN_ROLE]), role("a", "planner"), "undetermined"],
    ["role: person missing, complete", responsibility("complete", [A_ACTOR]), role("b", "direct_actor"), false],
    ["role: person missing, partial", responsibility("partial", [A_ACTOR]), role("b", "direct_actor"), "undetermined"],
    // noPersonResponsibleForEvent
    ["nobody: complete, no assignments", responsibility("complete", []), nobody, true],
    ["nobody: complete, one assignment", responsibility("complete", [A_ACTOR]), nobody, false],
    ["nobody: partial, one assignment", responsibility("partial", [A_UNKNOWN_ROLE]), nobody, false],
    ["nobody: partial, no assignments", responsibility("partial", []), nobody, "undetermined"],
    // eventCausedEvent (death is directly caused by poisoning, poisoning by purchase)
    ["caused: direct edge, causes complete", (r) => (r.causesComplete = true), caused("poisoning"), true],
    ["caused: direct edge, causes incomplete", (r) => (r.causesComplete = false), caused("poisoning"), true],
    ["caused: missing edge, causes complete", (r) => (r.causesComplete = true), caused("storm"), false],
    ["caused: missing edge, causes incomplete", (r) => (r.causesComplete = false), caused("storm"), "undetermined"],
    ["caused: only transitive, causes complete", (r) => (r.causesComplete = true), caused("purchase"), false],
    ["caused: only transitive, causes incomplete", (r) => (r.causesComplete = false), caused("purchase"), "undetermined"],
    // eventIntent
    ["intent: matches", (r) => (r.intent = "intended"), intent("intended"), true],
    ["intent: not_applicable matches", (r) => (r.intent = "not_applicable"), intent("not_applicable"), true],
    ["intent: differs", (r) => (r.intent = "intended"), intent("unintended"), false],
    ["intent: null", (r) => (r.intent = null), intent("intended"), "undetermined"],
    // eventMechanism
    ["mechanism: matches", (r) => (r.mechanism = "ordinary"), mechanism("ordinary"), true],
    ["mechanism: mixed matches mixed", (r) => (r.mechanism = "mixed"), mechanism("mixed"), true],
    ["mechanism: mixed is not ordinary", (r) => (r.mechanism = "mixed"), mechanism("ordinary"), false],
    ["mechanism: mixed is not supernatural", (r) => (r.mechanism = "mixed"), mechanism("supernatural"), false],
    ["mechanism: ordinary is not mixed", (r) => (r.mechanism = "ordinary"), mechanism("mixed"), false],
    ["mechanism: null", (r) => (r.mechanism = null), mechanism("ordinary"), "undetermined"],
  ])("%s", (_name, resolution, claim, expected) => {
    expect(statusOf(resolution, claim)).toBe(expected);
  });
});

describe("AC-08: required answers", () => {
  it("rejects a required answer whose conclusion is true but required false", () => {
    expectRejectedAt(variant((s) => (s.requiredConclusions[0].value = false)), ["requiredConclusions", 0, "value"]);
  });

  it.each([true, false])("rejects an undetermined conclusion required as %s", (value) => {
    const solution = variant((s) => {
      s.resolutions[0].responsibility.completeness = "partial";
      s.conclusions = [{ id: "conclusion:b", claim: responsible("b") }];
      s.requiredConclusions = [{ conclusionId: "conclusion:b", value }];
    });
    expectRejectedAt(solution, ["requiredConclusions", 0, "value"]);
  });

  it("accepts a matching negative requirement", () => {
    const solution = variant((s) => {
      s.conclusions.push({ id: "conclusion:b", claim: responsible("b") });
      s.requiredConclusions.push({ conclusionId: "conclusion:b", value: false });
    });
    expect(accepts(solution)).toBe(true);
  });

  it("checks every required literal, not just the first", () => {
    const solution = variant((s) => {
      s.conclusions.push({ id: "conclusion:b", claim: responsible("b") });
      s.requiredConclusions.push({ conclusionId: "conclusion:b", value: true });
    });
    expectRejectedAt(solution, ["requiredConclusions", 1, "value"]);
  });
});

describe("error behaviour", () => {
  it.each<[string, unknown]>([
    ["null", null],
    ["an array", []],
    ["a string", "solution"],
    ["an empty object", {}],
    ["non-array collections", { ...baseSolution(), resolutions: {}, conclusions: "x" }],
    ["a dangling reference everywhere", variant((s) => {
      s.resolutions[0].eventId = "event:ghost";
      s.conclusions[0].claim.personId = "person:ghost";
      s.requiredConclusions[0].conclusionId = "conclusion:ghost";
    })],
  ])("safeParse reports failure without throwing for %s", (_name, input) => {
    expect(() => schema.safeParse(input)).not.toThrow();
    expect(schema.safeParse(input).success).toBe(false);
  });

  it("parse and parseCaseSolution throw a ZodError", () => {
    const bad = variant((s) => (s.truthHash = "0".repeat(64)));
    expect(() => schema.parse(bad)).toThrow(ZodError);
    expect(() => parseCaseSolution(bad, truth)).toThrow(ZodError);
  });
});

describe.each([
  ["parseCaseSolution", (input: unknown) => parseCaseSolution(input, truth)],
  ["createCaseSolutionSchema(truth).parse", (input: unknown) => createCaseSolutionSchema(truth).parse(input)],
])("AC-11: immutability via %s", (_name, parse) => {
  it("is decoupled from the input, which stays mutable", () => {
    const input = baseSolution();
    const solution = parse(input);
    input.revision = 9;
    input.resolutions[0]!.responsibility.assignments[0]!.roles!.push("planner");
    input.conclusions[0]!.claim.personId = "person:b";
    expect(solution.revision).toBe(1);
    expect(solution.resolutions[0]!.responsibility.assignments[0]!.roles).toEqual(["direct_actor"]);
    expect((solution.conclusions[0]!.claim as { personId: string }).personId).toBe("person:a");
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(input.resolutions[0]!.targets)).toBe(false);
  });

  it("is recursively frozen and rejects mutation attempts", () => {
    const solution: any = parse(baseSolution());
    const unfrozen: string[] = [];
    const visit = (value: unknown, path: string) => {
      if (typeof value !== "object" || value === null) return;
      if (!Object.isFrozen(value)) unfrozen.push(path);
      for (const [key, child] of Object.entries(value)) visit(child, `${path}.${key}`);
    };
    visit(solution, "$");
    expect(unfrozen).toEqual([]);

    const before = JSON.stringify(solution);
    const attempts: (() => unknown)[] = [
      () => (solution.revision = 2),
      () => (solution.resolutions[0].intent = null),
      () => solution.resolutions[0].responsibility.assignments[0].roles.push("planner"),
      () => (solution.resolutions[0].targets[0].id = "person:b"),
      () => (solution.conclusions[0].claim.personId = "person:b"),
      () => (solution.requiredConclusions[0].value = false),
      () => solution.conclusions.pop(),
    ];
    for (const attempt of attempts) expect(attempt).toThrow(TypeError);
    expect(JSON.stringify(solution)).toBe(before);
  });

  it("embeds no copy of the CaseTruth", () => {
    expect(Object.keys(parse(baseSolution())).sort()).toEqual(ROOT_KEYS);
  });
});

describe("AC-14: CaseTruth and TASK-0002 are unaffected", () => {
  it("leaves the truth hash and semantic report unchanged; responsibility creates no presence", () => {
    const hashBefore = hashCaseTruth(truth);
    const reportBefore = validateCaseSemantics(truth);
    // Anna is responsible for Clara's death without being at it; still no presence conflict.
    expect(reportBefore.findings).toEqual([]);

    const solution = parseCaseSolution(baseSolution(), truth);
    serializeCaseSolution(solution);
    hashCaseSolution(solution);

    expect(hashCaseTruth(truth)).toBe(hashBefore);
    expect(validateCaseSemantics(truth)).toEqual(reportBefore);
  });
});
