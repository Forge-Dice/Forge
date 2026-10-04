import { parseCaseTruth, type CaseTruth } from "../src/domain/case-truth.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import { parseCaseSolution, type CaseSolution } from "../src/domain/case-solution.ts";
import { solutionTruth, solutionTruthInput } from "./case-solution.fixture.ts";

// Accusation fixtures on the TASK-0003 poisoning case (persons a, b, c; events
// purchase -> poisoning -> death, storm). Factories return fresh objects.

export type Claim = Record<string, string>;
export type Literal = readonly [Claim, boolean];

export const T1 = (): CaseTruth => solutionTruth();
/** Same caseId as T1, different revision and therefore a different truthHash. */
export const T2 = (): CaseTruth => parseCaseTruth({ ...solutionTruthInput(), revision: 2 });

// ---------- Claim builders (event defaults to event:death) ----------

const ev = (event: string) => `event:${event}`;
export const resp = (person: string, event = "death"): Claim => ({
  kind: "personResponsibleForEvent",
  personId: `person:${person}`,
  eventId: ev(event),
});
export const role = (person: string, r: string, event = "death"): Claim => ({
  kind: "personRoleForEvent",
  personId: `person:${person}`,
  eventId: ev(event),
  role: r,
});
export const nobody = (event = "death"): Claim => ({ kind: "noPersonResponsibleForEvent", eventId: ev(event) });
export const caused = (cause: string, event = "death"): Claim => ({
  kind: "eventCausedEvent",
  causeEventId: ev(cause),
  eventId: ev(event),
});
export const intent = (value: string, event = "death"): Claim => ({ kind: "eventIntent", eventId: ev(event), value });
export const mech = (value: string, event = "death"): Claim => ({ kind: "eventMechanism", eventId: ev(event), value });

/** All 88 structurally distinct valid claims of the poisoning case. */
export function claimUniverse(): Claim[] {
  const persons = ["a", "b", "c"];
  const events = ["purchase", "poisoning", "death", "storm"];
  const claims: Claim[] = [];
  for (const event of events) {
    for (const person of persons) {
      claims.push(resp(person, event));
      for (const r of ["direct_actor", "planner", "facilitator"]) claims.push(role(person, r, event));
    }
    claims.push(nobody(event));
    for (const cause of events) if (cause !== event) claims.push(caused(cause, event));
    for (const v of ["intended", "unintended", "not_applicable"]) claims.push(intent(v, event));
    for (const v of ["ordinary", "supernatural", "mixed"]) claims.push(mech(v, event));
  }
  return claims;
}

// ---------- Accusations ----------

export function accusationInput(truth: CaseTruth, literals: readonly Literal[]) {
  return {
    schemaVersion: 1,
    caseId: truth.caseId as string,
    truthHash: hashCaseTruth(truth),
    literals: literals.map(([claim, value]) => ({ claim: { ...claim }, value })),
  };
}

// ---------- Solutions S1..S7 ----------

type Assignment = { personId: string; roles: string[] | null };
const a = (person: string, roles: string[] | null): Assignment => ({ personId: `person:${person}`, roles });

function resolution(
  event: string,
  completeness: string,
  assignments: Assignment[],
  intentValue: string | null,
  mechanism: string | null,
  causesComplete: boolean,
) {
  return {
    eventId: ev(event),
    targets: [],
    responsibility: { completeness, assignments },
    intent: intentValue,
    mechanism,
    causesComplete,
  };
}

function solutionInput(truth: CaseTruth, revision: number, resolutions: object[], required: readonly Literal[]) {
  return {
    schemaVersion: 1,
    caseId: truth.caseId as string,
    revision,
    truthHash: hashCaseTruth(truth),
    resolutions,
    conclusions: required.map(([claim], i) => ({ id: `conclusion:r${i}`, claim: { ...claim } })),
    requiredConclusions: required.map(([, value], i) => ({ conclusionId: `conclusion:r${i}`, value })),
  };
}

/** X1: the required literals of S1. */
export const X1: readonly Literal[] = [
  [resp("a"), true],
  [resp("b"), false],
  [intent("intended"), true],
];

const S1_RESOLUTIONS = () => [
  resolution("death", "complete", [a("a", ["direct_actor", "planner"])], "intended", "ordinary", true),
  resolution("poisoning", "partial", [a("a", null)], null, null, false),
];

const SPECS: Record<string, { revision: number; resolutions: () => object[]; required: readonly Literal[] }> = {
  S1: { revision: 1, resolutions: S1_RESOLUTIONS, required: X1 },
  S2: {
    revision: 2,
    resolutions: () => [resolution("death", "complete", [a("b", ["direct_actor"])], "unintended", "ordinary", true)],
    required: [
      [resp("b"), true],
      [resp("a"), false],
    ],
  },
  S3: {
    revision: 3,
    resolutions: () => [
      resolution("death", "complete", [a("a", ["planner"]), a("b", ["direct_actor"])], "intended", "ordinary", true),
    ],
    required: [
      [resp("a"), true],
      [resp("b"), true],
      [role("b", "direct_actor"), true],
    ],
  },
  S4: {
    revision: 4,
    resolutions: () => [resolution("death", "complete", [], "not_applicable", "ordinary", true)],
    required: [[nobody(), true]],
  },
  S5: {
    revision: 5,
    resolutions: () => [resolution("death", "partial", [a("a", null)], null, "mixed", false)],
    required: [
      [resp("a"), true],
      [mech("mixed"), true],
    ],
  },
  S6: {
    revision: 6,
    resolutions: () => [resolution("death", "partial", [a("a", ["direct_actor"])], "intended", "ordinary", false)],
    required: [[role("a", "direct_actor"), true]],
  },
  S7: {
    revision: 7,
    resolutions: () => [resolution("death", "partial", [], null, null, false)],
    required: [[caused("poisoning"), true]],
  },
};

export type SolutionName = "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7";
export const SOLUTION_NAMES: SolutionName[] = ["S1", "S2", "S3", "S4", "S5", "S6", "S7"];

/** Required literals of a fixture solution, as claims. */
export const requiredOf = (name: SolutionName): readonly Literal[] => SPECS[name]!.required;

export function solution(name: SolutionName, truth: CaseTruth = T1()): CaseSolution {
  const spec = SPECS[name]!;
  return parseCaseSolution(solutionInput(truth, spec.revision, spec.resolutions(), spec.required), truth);
}

/** S1 bound to T2. */
export const S1atT2 = (): CaseSolution => solution("S1", T2());
