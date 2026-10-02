// Compile-time tests: checked by `npm run typecheck`, never executed.
// Each @ts-expect-error fails the typecheck if the line below it becomes valid.

import type { CaseTruth, EventId } from "../src/domain/case-truth.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import type { CaseSolution, CaseSolutionInput, ConclusionId } from "../src/domain/case-solution.ts";
import { parseCaseSolution } from "../src/domain/case-solution.ts";
import { serializeCaseSolution } from "../src/domain/case-solution.identity.ts";

declare const solution: CaseSolution;
declare const input: CaseSolutionInput;
declare const truth: CaseTruth;
declare const eventId: EventId;
declare const conclusionId: ConclusionId;

// Readonly snapshot
// @ts-expect-error root field is readonly
solution.revision = 2;
// @ts-expect-error nested resolution field is readonly
solution.resolutions[0]!.causesComplete = false;
// @ts-expect-error responsibility field is readonly
solution.resolutions[0]!.responsibility.completeness = "partial";
// @ts-expect-error role lists are readonly arrays
solution.resolutions[0]!.responsibility.assignments[0]!.roles!.push("planner");
// @ts-expect-error conclusion collections are readonly arrays
solution.conclusions.pop();
// @ts-expect-error literal value is readonly
solution.requiredConclusions[0]!.value = false;

// Nominal IDs
// @ts-expect-error EventId is not a ConclusionId
const wrongConclusion: ConclusionId = eventId;
// @ts-expect-error ConclusionId is not an EventId
const wrongEvent: EventId = conclusionId;
// @ts-expect-error plain strings are not ConclusionIds
const plainConclusion: ConclusionId = "conclusion:a";

// Only bound parsing produces a CaseSolution
// @ts-expect-error authoring input lacks the CaseSolution brand
const unparsed: CaseSolution = input;
// @ts-expect-error serialization only accepts parsed solutions
serializeCaseSolution(input);
// @ts-expect-error a CaseTruth is not a CaseSolution
serializeCaseSolution(truth);
// @ts-expect-error a CaseSolution cannot be hashed as a CaseTruth
hashCaseTruth(solution);

// Positive control
const parsed: CaseSolution = parseCaseSolution(input, truth);

export { wrongConclusion, wrongEvent, plainConclusion, unparsed, parsed };
