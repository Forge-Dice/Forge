// Compile-time tests: checked by `npm run typecheck`, never executed.
// Each @ts-expect-error fails the typecheck if the line below it becomes valid.

import type { CaseTruth } from "../src/domain/case-truth.ts";
import type { CaseSolution } from "../src/domain/case-solution.ts";
import type { Accusation, AccusationInput } from "../src/domain/case-accusation.ts";
import type {
  AccusationChallenge,
  AccusationChallengeInput,
  ChallengeAccusationResult,
} from "../src/domain/accusation-challenge.ts";
import { evaluateChallengeAccusation, parseAccusationChallenge } from "../src/domain/accusation-challenge.ts";

declare const truth: CaseTruth;
declare const solution: CaseSolution;
declare const challenge: AccusationChallenge;
declare const accusation: Accusation;
declare const input: AccusationChallengeInput;
declare const accusationInput: AccusationInput;
declare const result: ChallengeAccusationResult;
// Same fields as a parsed challenge, without the brand (symbol keys dropped).
declare const unbranded: { readonly [K in keyof AccusationChallenge as K extends string ? K : never]: AccusationChallenge[K] };

// T01: the authoring input is mutable
input.truthHash = "0".repeat(64);
input.allowedClaims.push({ kind: "noPersonResponsibleForEvent", eventId: "event:x" });
input.allowedClaims[0]!.eventId = "event:y";

// T02: the parsed snapshot is readonly
// @ts-expect-error root field is readonly
challenge.truthHash = "x";
// @ts-expect-error scope is a readonly array
challenge.allowedClaims.push(challenge.allowedClaims[0]!);
// @ts-expect-error nested claim fields are readonly
challenge.allowedClaims[0]!.eventId = challenge.allowedClaims[0]!.eventId;

// T03/T04: only a parsed challenge is accepted
// @ts-expect-error raw input is not a challenge
evaluateChallengeAccusation(truth, solution, input, accusation);
// @ts-expect-error a structurally equal unbranded snapshot is not a challenge
evaluateChallengeAccusation(truth, solution, unbranded, accusation);
// @ts-expect-error a CaseSolution is not a challenge
evaluateChallengeAccusation(truth, solution, solution, accusation);

// T05: only a parsed accusation is accepted
// @ts-expect-error raw accusation input
evaluateChallengeAccusation(truth, solution, challenge, accusationInput);

// T06/T07: result is readonly, minimal and must be checked before use
if (result.success) {
  // @ts-expect-error verdict is readonly
  result.verdict = "solved";
  // @ts-expect-error no per-literal diagnostics
  result.matchedClaims;
}
// @ts-expect-error the failure branch has no verdict
const unchecked: "solved" | "not_solved" = result.verdict;

// Positive control
const parsed: AccusationChallenge = parseAccusationChallenge(input, truth, solution);
const evaluated: ChallengeAccusationResult = evaluateChallengeAccusation(truth, solution, parsed, accusation);
