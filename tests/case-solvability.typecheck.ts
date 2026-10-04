// Compile-time tests: checked by `npm run typecheck`, never executed.
// Each @ts-expect-error fails the typecheck if the line below it becomes valid.

import type { CaseTruth } from "../src/domain/case-truth.ts";
import type { CaseSolution } from "../src/domain/case-solution.ts";
import type {
  CaseProofProfile,
  CaseProofProfileInput,
  HypothesisVector,
  ProofFinding,
  ReleasedObservation,
  SolvabilityReport,
  WitnessReplay,
} from "../src/domain/case-solvability.ts";
import { checkCaseSolvability, parseCaseProofProfile } from "../src/domain/case-solvability.ts";

declare const truth: CaseTruth;
declare const solution: CaseSolution;
declare const profile: CaseProofProfile;
declare const input: CaseProofProfileInput;
declare const port: WitnessReplay;
declare const report: SolvabilityReport;
declare const released: ReleasedObservation;
declare const unknownValue: unknown;

// T78 an unparsed or unknown profile is not a branded profile.
// @ts-expect-error authoring input is not a CaseProofProfile
checkCaseSolvability(truth, solution, input, port);
// @ts-expect-error unknown is not a CaseProofProfile
checkCaseSolvability(truth, solution, unknownValue, port);
// @ts-expect-error a plain object is not a CaseProofProfile
const plainProfile: CaseProofProfile = structuredClone(input);
const parsed: CaseProofProfile = parseCaseProofProfile(unknownValue, truth, solution);
const checked: SolvabilityReport = checkCaseSolvability(truth, solution, parsed, port);

// No hypotheses field in the authoring input (AC-08).
// @ts-expect-error hypotheses are generated internally, never authored
const withHypotheses: CaseProofProfileInput = { ...input, hypotheses: [] };

// T79 nested readonly arrays and objects.
// @ts-expect-error profile edges are readonly
profile.edges.push(profile.edges[0]!);
// @ts-expect-error nested allOf is readonly
profile.edges[0]!.allOf.push("node:x");
// @ts-expect-error witness steps are readonly
profile.witnessStepIds[0] = "step:x";
// @ts-expect-error findings are readonly
report.findings.push(report.findings[0]!);
// @ts-expect-error finding paths are readonly
(report.findings[0] as ProofFinding).path.push(1);
// @ts-expect-error hypothesis vectors are readonly
(report.competingAnswerSamples[0] as HypothesisVector)[0]!.value = true;
// @ts-expect-error status is readonly
report.status = "pass";
// @ts-expect-error released observations are readonly
released.id = "obs:x";

// The port receives a readonly ordered list and cannot reorder it.
const orderPreserving: WitnessReplay = (steps) => {
  // @ts-expect-error the ordered step list is readonly
  steps.reverse();
  return { success: false, code: "REPLAY_UNAVAILABLE" };
};
// @ts-expect-error a port cannot return a custom failure code
const badPort: WitnessReplay = () => ({ success: false, code: "TIMEOUT" });

// Authoring input stays mutable.
input.witnessStepIds.push("step:x");
input.edges.push({ id: "edge:x", allOf: ["node:a", "node:l"], to: "node:b", license: "node:l" });

void [plainProfile, checked, withHypotheses, orderPreserving, badPort];
