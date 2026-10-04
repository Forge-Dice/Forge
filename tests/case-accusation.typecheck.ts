// Compile-time tests: checked by `npm run typecheck`, never executed.
// Each @ts-expect-error fails the typecheck if the line below it becomes valid.

import type { CaseTruth } from "../src/domain/case-truth.ts";
import type { CaseSolution } from "../src/domain/case-solution.ts";
import type { Accusation, AccusationInput, AccusationResult, Verdict } from "../src/domain/case-accusation.ts";
import { evaluateAccusation, parseAccusation } from "../src/domain/case-accusation.ts";

declare const accusation: Accusation;
declare const input: AccusationInput;
declare const truth: CaseTruth;
declare const solution: CaseSolution;
declare const result: AccusationResult;

// Readonly snapshot
// @ts-expect-error root field is readonly
accusation.caseId = truth.caseId;
// @ts-expect-error literals are a readonly array
accusation.literals.push(accusation.literals[0]!);
// @ts-expect-error literal value is readonly
accusation.literals[0]!.value = false;
// @ts-expect-error claim fields are readonly
accusation.literals[0]!.claim.eventId = accusation.literals[0]!.claim.eventId;

// Only bound parsing produces an Accusation
// @ts-expect-error authoring input lacks the Accusation brand
const unparsed: Accusation = input;
// @ts-expect-error a CaseSolution is not an Accusation
const fromSolution: Accusation = solution;
// @ts-expect-error a CaseTruth is not an Accusation
const fromTruth: Accusation = truth;
// @ts-expect-error evaluation only accepts parsed accusations
evaluateAccusation(truth, solution, input);
// @ts-expect-error evaluation does not accept arbitrary objects
evaluateAccusation(truth, solution, { schemaVersion: 1, caseId: truth.caseId, truthHash: "", literals: [] });

// The result union forces a success check before the verdict is read
// @ts-expect-error verdict only exists on success
const unchecked: Verdict = result.verdict;
if (result.success) {
  const checked: Verdict = result.verdict;
}

// Positive control
const parsed: Accusation = parseAccusation(input, truth);
const evaluated: AccusationResult = evaluateAccusation(truth, solution, parsed);
