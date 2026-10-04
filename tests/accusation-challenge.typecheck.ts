// Compile-time tests T01..T07: checked by `npm run typecheck`, never executed.
// Each @ts-expect-error fails the typecheck if the line below it becomes valid.

import type { CaseTruth } from "../src/domain/case-truth.ts";
import type { CaseSolution } from "../src/domain/case-solution.ts";
import type { Accusation, AccusationInput } from "../src/domain/case-accusation.ts";
import type {
  AccusationChallenge,
  AccusationChallengeInput,
  ChallengeAccusationResult,
} from "../src/domain/accusation-challenge.ts";
import { evaluateChallengeAccusation } from "../src/domain/accusation-challenge.ts";

declare const truth: CaseTruth;
declare const solution: CaseSolution;
declare const challenge: AccusationChallenge;
declare const input: AccusationChallengeInput;
declare const accusation: Accusation;
declare const accusationInput: AccusationInput;
declare const result: ChallengeAccusationResult;

// T01 the authoring input is mutable
input.caseId = "case:x";
input.allowedClaims.push({ kind: "noPersonResponsibleForEvent", eventId: "event:x" });
input.allowedClaims[0]!.eventId = "event:y";

// T02 the parsed challenge is deeply readonly
// @ts-expect-error root field is readonly
challenge.caseId = challenge.caseId;
// @ts-expect-error scope array is readonly
challenge.allowedClaims.push(challenge.allowedClaims[0]!);
// @ts-expect-error claim fields are readonly
challenge.allowedClaims[0]!.eventId = challenge.allowedClaims[0]!.eventId;

// T03 only a parsed challenge is accepted
// @ts-expect-error authoring input lacks the brand
evaluateChallengeAccusation(truth, solution, input, accusation);
// @ts-expect-error a structurally similar, unbranded snapshot is not a challenge
evaluateChallengeAccusation(truth, solution, { ...input } as Readonly<AccusationChallengeInput>, accusation);

// T04 a CaseSolution is not a challenge
// @ts-expect-error brands differ
evaluateChallengeAccusation(truth, solution, solution, accusation);

// T05 only a parsed accusation is accepted
// @ts-expect-error unbranded accusation input
evaluateChallengeAccusation(truth, solution, challenge, accusationInput);

// T06 results are readonly and carry no diagnostics
if (result.success) {
  // @ts-expect-error verdict is readonly
  result.verdict = "solved";
  // @ts-expect-error there are no matched claims
  void result.matchedClaims;
}

// T07 a failure is not a verdict
if (!result.success) {
  // @ts-expect-error failures have no verdict
  void result.verdict;
}

export type { CaseTruth };
