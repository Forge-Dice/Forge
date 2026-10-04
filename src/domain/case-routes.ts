import type { CaseTruth } from "./case-truth.ts";
import type { CaseSolution } from "./case-solution.ts";
import type { SolutionRoute } from "./case-package.ts";
import { checkCaseSolvability, type CaseProofProfile, type SolvabilityReport, type WitnessReplay } from "./case-solvability.ts";

// Several certified solution routes: each route is replayed on its own through the witness port and
// checked by the unchanged single-witness checker, as if it were the profile's only witness.

export type RouteReport = { readonly routeId: string; readonly report: SolvabilityReport };
export type RoutesReport = {
  /** "pass" only if every route passes; "unknown" if none fails but one could not be replayed. */
  readonly status: SolvabilityReport["status"];
  readonly routes: readonly RouteReport[];
};

export function checkCaseRoutes(
  truth: CaseTruth,
  solution: CaseSolution,
  profile: CaseProofProfile,
  routes: readonly SolutionRoute[],
  replayWitness: WitnessReplay,
): RoutesReport {
  const reports = routes.map((route) => ({
    routeId: route.routeId,
    report: checkCaseSolvability(truth, solution, { ...profile, witnessStepIds: [...route.stepIds] }, replayWitness),
  }));
  const statuses = new Set(reports.map((r) => r.report.status));
  const status = reports.length === 0 || statuses.has("fail") ? "fail" : statuses.has("unknown") ? "unknown" : "pass";
  return Object.freeze({ status, routes: Object.freeze(reports) });
}
