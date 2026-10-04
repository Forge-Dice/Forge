import { parseCaseTruth, type CaseTruth } from "../src/domain/case-truth.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import { parseCaseSolution, type CaseSolution } from "../src/domain/case-solution.ts";
import { hashCaseSolution } from "../src/domain/case-solution.identity.ts";
import { parseAccusation, type Accusation } from "../src/domain/case-accusation.ts";
import { parseAccusationChallenge, type AccusationChallenge } from "../src/domain/accusation-challenge.ts";
import { solutionTruthInput } from "./case-solution.fixture.ts";
import { accusationInput, claimUniverse, type Claim, type Literal } from "./case-accusation.fixture.ts";

// MYST-CHALLENGE-0001 fixtures on the TASK-0003 poisoning case (persons a, b, c; events
// purchase -> poisoning -> death, storm), reusing the MYST-0002 claim builders.
// Factories return fresh objects.

export type Assignment = { personId: string; roles: string[] | null };
export type Resolution = {
  eventId: string;
  targets: never[];
  responsibility: { completeness: "complete" | "partial"; assignments: Assignment[] };
  intent: string | null;
  mechanism: string | null;
  causesComplete: boolean;
};

export const who = (person: string, roles: string[] | null = ["direct_actor"]): Assignment => ({
  personId: `person:${person}`,
  roles,
});

export function res(
  event: string,
  completeness: "complete" | "partial",
  assignments: Assignment[],
  { intent = null, mechanism = null, causesComplete = false }: { intent?: string | null; mechanism?: string | null; causesComplete?: boolean } = {},
): Resolution {
  return { eventId: `event:${event}`, targets: [], responsibility: { completeness, assignments }, intent, mechanism, causesComplete };
}

export type SolutionSpec = {
  resolutions: Resolution[];
  required: readonly Literal[];
  /** Additional non-required catalogue conclusions. */
  extra?: readonly Claim[];
  revision?: number;
};

export function solutionInput(truth: CaseTruth, spec: SolutionSpec): any {
  const catalogue = [...spec.required.map(([claim]) => claim), ...(spec.extra ?? [])];
  return {
    schemaVersion: 1,
    caseId: truth.caseId,
    revision: spec.revision ?? 1,
    truthHash: hashCaseTruth(truth),
    resolutions: structuredClone(spec.resolutions),
    conclusions: catalogue.map((claim, i) => ({ id: `conclusion:c${i}`, claim: { ...claim } })),
    requiredConclusions: spec.required.map(([, value], i) => ({ conclusionId: `conclusion:c${i}`, value })),
  };
}

export const makeSolution = (truth: CaseTruth, spec: SolutionSpec): CaseSolution =>
  parseCaseSolution(solutionInput(truth, spec), truth);

/**
 * Canonical status of a claim, obtained from the real CaseSolution parser: a required literal is
 * accepted only with its determined polarity. No copied resolver table.
 */
export function canonicalStatus(truth: CaseTruth, resolutions: Resolution[], claim: Claim): true | false | "undetermined" {
  const accepts = (value: boolean) => {
    try {
      makeSolution(truth, { resolutions, required: [[claim, value]] });
      return true;
    } catch {
      return false;
    }
  };
  return accepts(true) ? true : accepts(false) ? false : "undetermined";
}

export function challengeInput(truth: CaseTruth, solution: CaseSolution, allowedClaims: readonly Claim[]): any {
  return {
    schemaVersion: 1,
    caseId: truth.caseId,
    truthHash: hashCaseTruth(truth),
    solutionHash: hashCaseSolution(solution),
    allowedClaims: allowedClaims.map((claim) => ({ ...claim })),
  };
}

export const makeChallenge = (truth: CaseTruth, solution: CaseSolution, scope: readonly Claim[]): AccusationChallenge =>
  parseAccusationChallenge(challengeInput(truth, solution, scope), truth, solution);

export const accuse = (truth: CaseTruth, literals: readonly Literal[]): Accusation =>
  parseAccusation(accusationInput(truth, literals), truth);

export const sameClaim = (a: Claim, b: Claim) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);

export const universeWithout = (...excluded: Claim[]) =>
  claimUniverse().filter((claim) => !excluded.some((x) => sameClaim(x, claim)));

/** Poisoning case with `count` persons (a, b, c, then p04, p05, ...), for scope caps and crowds. */
export function crowdTruth(count: number, edit: (t: any) => void = () => {}): CaseTruth {
  const input: any = solutionTruthInput();
  for (let i = 4; i <= count; i++) {
    input.persons.push({ id: `person:p${String(i).padStart(2, "0")}`, name: `Person ${i}` });
  }
  edit(input);
  return parseCaseTruth(input);
}

export const personIds = (truth: CaseTruth) => truth.persons.map((p) => p.id.slice("person:".length));

/** Deterministic LCG (Numerical Recipes constants), seeded per contract §8. */
export function lcg(seed = 0x03175a99) {
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  return {
    next,
    int: (n: number) => Math.floor(next() * n),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
    chance: (p: number) => next() < p,
    shuffle: <T>(items: readonly T[]): T[] => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      }
      return copy;
    },
  };
}
