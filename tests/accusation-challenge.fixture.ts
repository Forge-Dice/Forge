import { parseCaseTruth, type CaseTruth } from "../src/domain/case-truth.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import { parseCaseSolution, type CaseSolution } from "../src/domain/case-solution.ts";
import { hashCaseSolution } from "../src/domain/case-solution.identity.ts";
import { parseAccusation, type Accusation } from "../src/domain/case-accusation.ts";

// Challenge fixtures: a six-person manor case. plan -> poisoning -> death; storm and fire are
// unrelated. Not a playable mystery. Factories return fresh objects.

export type Claim = Record<string, string>;
export type Literal = readonly [Claim, boolean];

export const PERSONS = ["a", "b", "c", "d", "e", "f"];
export const EVENTS = ["plan", "poisoning", "death", "storm", "fire"];

export function manorTruthInput() {
  const event = (id: string, at: number, causedBy: string[], participants: string[]) => ({
    id: `event:${id}`,
    description: `Ereignis ${id}`,
    time: { kind: "instant", at },
    locationId: "location:hall",
    participantIds: participants.map((p) => `person:${p}`),
    itemIds: [],
    causedByEventIds: causedBy.map((c) => `event:${c}`),
  });
  return {
    schemaVersion: 1,
    caseId: "case:manor",
    revision: 1,
    title: "Das Herrenhaus",
    timeline: { unit: "second", originLabel: "Mitternacht" },
    persons: PERSONS.map((p) => ({ id: `person:${p}`, name: `Person ${p.toUpperCase()}` })),
    locations: [{ id: "location:hall", name: "Halle" }],
    items: [{ id: "item:vial", name: "Fläschchen" }],
    relationships: [],
    events: [
      event("plan", 1, [], ["a"]),
      event("poisoning", 2, ["plan"], ["a"]),
      event("death", 3, ["poisoning"], ["f"]),
      event("storm", 4, [], []),
      event("fire", 5, [], []),
    ],
    motives: [],
    propositions: [],
    evidence: [],
    secrets: [],
    redHerrings: [],
  };
}

export const manorTruth = (overrides: object = {}): CaseTruth => parseCaseTruth({ ...manorTruthInput(), ...overrides });

// ---------- Claim builders (event defaults to event:death) ----------

const ev = (e: string) => `event:${e}`;
export const resp = (p: string, e = "death"): Claim => ({ kind: "personResponsibleForEvent", personId: `person:${p}`, eventId: ev(e) });
export const role = (p: string, r: string, e = "death"): Claim => ({
  kind: "personRoleForEvent",
  personId: `person:${p}`,
  eventId: ev(e),
  role: r,
});
export const nobody = (e = "death"): Claim => ({ kind: "noPersonResponsibleForEvent", eventId: ev(e) });
export const caused = (cause: string, e = "death"): Claim => ({ kind: "eventCausedEvent", causeEventId: ev(cause), eventId: ev(e) });
export const intent = (v: string, e = "death"): Claim => ({ kind: "eventIntent", eventId: ev(e), value: v });
export const mech = (v: string, e = "death"): Claim => ({ kind: "eventMechanism", eventId: ev(e), value: v });

export const ROLES = ["direct_actor", "planner", "facilitator"];
export const INTENTS = ["intended", "unintended", "not_applicable"];
export const MECHANISMS = ["ordinary", "supernatural", "mixed"];

/** All structurally distinct claims about one event. */
export function eventClaims(e = "death"): Claim[] {
  return [
    ...PERSONS.map((p) => resp(p, e)),
    ...PERSONS.flatMap((p) => ROLES.map((r) => role(p, r, e))),
    nobody(e),
    ...EVENTS.filter((c) => c !== e).map((c) => caused(c, e)),
    ...INTENTS.map((v) => intent(v, e)),
    ...MECHANISMS.map((v) => mech(v, e)),
  ];
}

// ---------- Solutions ----------

export type Assignment = { personId: string; roles: string[] | null };
export const as = (p: string, roles: string[] | null = null): Assignment => ({ personId: `person:${p}`, roles });

export type DeathResolution = {
  completeness: "complete" | "partial";
  assignments: Assignment[];
  intent: string | null;
  mechanism: string | null;
  causesComplete: boolean;
};

export function resolution(e: string, r: DeathResolution) {
  return {
    eventId: ev(e),
    targets: [],
    responsibility: { completeness: r.completeness, assignments: r.assignments },
    intent: r.intent,
    mechanism: r.mechanism,
    causesComplete: r.causesComplete,
  };
}

export function solutionInput(
  truth: CaseTruth,
  death: DeathResolution,
  required: readonly Literal[],
  options: { revision?: number; extraConclusions?: Claim[] } = {},
) {
  const conclusions = [...required.map(([claim]) => claim), ...(options.extraConclusions ?? [])];
  return {
    schemaVersion: 1,
    caseId: truth.caseId as string,
    revision: options.revision ?? 1,
    truthHash: hashCaseTruth(truth),
    resolutions: [resolution("death", death)],
    conclusions: conclusions.map((claim, i) => ({ id: `conclusion:c${i}`, claim: { ...claim } })),
    requiredConclusions: required.map(([, value], i) => ({ conclusionId: `conclusion:c${i}`, value })),
  };
}

export function solve(truth: CaseTruth, death: DeathResolution, required: readonly Literal[], options = {}): CaseSolution {
  return parseCaseSolution(solutionInput(truth, death, required, options), truth);
}

export function challengeInput(truth: CaseTruth, solution: CaseSolution, allowedClaims: readonly Claim[]) {
  return {
    schemaVersion: 1,
    caseId: truth.caseId as string,
    truthHash: hashCaseTruth(truth),
    solutionHash: hashCaseSolution(solution),
    allowedClaims: allowedClaims.map((claim) => ({ ...claim })),
  };
}

export function accuse(truth: CaseTruth, literals: readonly Literal[]): Accusation {
  return parseAccusation(
    {
      schemaVersion: 1,
      caseId: truth.caseId as string,
      truthHash: hashCaseTruth(truth),
      literals: literals.map(([claim, value]) => ({ claim: { ...claim }, value })),
    },
    truth,
  );
}

/** complete, a is the direct actor and planner, intended, ordinary, causes complete. */
export const COMPLETE_A: DeathResolution = {
  completeness: "complete",
  assignments: [as("a", ["direct_actor", "planner"])],
  intent: "intended",
  mechanism: "ordinary",
  causesComplete: true,
};

/** Required for COMPLETE_A: a responsible, b not responsible (negative literal). */
export const R_A: readonly Literal[] = [
  [resp("a"), true],
  [resp("b"), false],
];

/** Deterministic LCG (Numerical Recipes constants), seeded per contract. Uses the high bits: the low bits of a power-of-two LCG have tiny periods. */
export function lcg(seed = 0x03175a99) {
  let state = seed >>> 0;
  return (n: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state >>> 16) % n;
  };
}
