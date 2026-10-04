import { z } from "zod";
import { CaseIdSchema, type CaseTruth, type DeepReadonly } from "./case-truth.ts";
import { hashCaseTruth } from "./case-truth.identity.ts";
import {
  ConclusionClaimSchema,
  claimKey,
  evaluateConclusionClaim,
  type CaseSolution,
  type ConclusionEvaluation,
} from "./case-solution.ts";
import { deepFreeze } from "./shared.ts";

// Player accusation and verdict core (MYST-0002).
// An Accusation is a set of structured claims with asserted polarity, bound to one exact
// CaseTruth snapshot (caseId + truthHash). The host supplies the CaseSolution to judge it by.
// Core solved is canonical consistency plus required coverage; it is NOT a player challenge completion check.
// Parse error messages may contain IDs from the input; they are host signals, not for players.

const AccusationShapeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  caseId: CaseIdSchema,
  truthHash: z.string().regex(/^[0-9a-f]{64}$/, "Expected a lowercase SHA-256 hex digest"),
  literals: z.array(z.strictObject({ claim: ConclusionClaimSchema, value: z.boolean() })),
});

type AccusationShape = z.output<typeof AccusationShapeSchema>;
type Ctx = z.RefinementCtx<AccusationShape>;

function checkAccusation(accusation: AccusationShape, truth: CaseTruth, truthHash: string, ctx: Ctx): void {
  const issue = (message: string, path: (string | number)[]) => ctx.addIssue({ code: "custom", message, path });

  // ---- Binding first: references are meaningless against the wrong world.
  let bound = true;
  if (accusation.caseId !== truth.caseId) {
    issue(`Accusation is for ${accusation.caseId}, not ${truth.caseId}`, ["caseId"]);
    bound = false;
  }
  if (accusation.truthHash !== truthHash) {
    issue("truthHash does not match the given CaseTruth snapshot", ["truthHash"]);
    bound = false;
  }
  if (!bound) return;

  const events = new Set<string>(truth.events.map((e) => e.id));
  const persons = new Set<string>(truth.persons.map((p) => p.id));
  accusation.literals.forEach((literal, i) => {
    const { claim } = literal;
    const path = ["literals", i, "claim"];
    if (!events.has(claim.eventId)) issue(`Unknown event "${claim.eventId}"`, [...path, "eventId"]);
    if ("personId" in claim && !persons.has(claim.personId)) issue(`Unknown person "${claim.personId}"`, [...path, "personId"]);
    if (claim.kind === "eventCausedEvent" && !events.has(claim.causeEventId)) {
      issue(`Unknown event "${claim.causeEventId}"`, [...path, "causeEventId"]);
    }
  });

  // ---- One literal per structural claim, whatever its value: a repeat is a duplicate,
  // a repeat with the opposite value a structural contradiction (D3).
  const seen = new Set<string>();
  accusation.literals.forEach((literal, j) => {
    const key = claimKey(literal.claim);
    if (seen.has(key)) issue("Claim is asserted more than once", ["literals", j, "claim"]);
    seen.add(key);
  });
}

/** Zod schema bound to one CaseTruth snapshot. The only way to obtain an Accusation. */
export function createAccusationSchema(truth: CaseTruth) {
  const truthHash = hashCaseTruth(truth);
  return AccusationShapeSchema.superRefine((accusation, ctx) => checkAccusation(accusation, truth, truthHash, ctx))
    .transform((accusation) => deepFreeze(structuredClone(accusation)) as DeepReadonly<AccusationShape>)
    .brand<"Accusation">();
}

/** Plain, mutable player-side input. */
export type AccusationInput = z.input<ReturnType<typeof createAccusationSchema>>;

/** Deeply frozen, nominally branded accusation, bound to the CaseTruth it was parsed against. */
export type Accusation = z.output<ReturnType<typeof createAccusationSchema>>;

export function parseAccusation(input: unknown, truth: CaseTruth): Accusation {
  return createAccusationSchema(truth).parse(input);
}

export type Verdict = "solved" | "not_solved";

export type AccusationResult =
  | { readonly success: true; readonly verdict: Verdict }
  | {
      readonly success: false;
      readonly code: "ACCUSATION_BINDING_MISMATCH" | Extract<ConclusionEvaluation, { success: false }>["code"];
    };

const failure = (code: Extract<AccusationResult, { success: false }>["code"]): AccusationResult =>
  Object.freeze({ success: false, code });

/**
 * Verdict of a bound accusation against the given answer key: solved iff every required literal is
 * asserted with its polarity and no asserted literal is canonically refuted. Undetermined is neutral.
 * Core solved is canonical consistency plus required coverage; it is NOT a player challenge completion check.
 * The result carries only the verdict, never reasons, claims, IDs or counts.
 */
export function evaluateAccusation(truth: CaseTruth, solution: CaseSolution, accusation: Accusation): AccusationResult {
  const truthHash = hashCaseTruth(truth);
  if (accusation.caseId !== truth.caseId || accusation.truthHash !== truthHash) return failure("ACCUSATION_BINDING_MISMATCH");
  if (solution.caseId !== truth.caseId || solution.truthHash !== truthHash) return failure("SOLUTION_BINDING_MISMATCH");

  let contradicted = false;
  for (const literal of accusation.literals) {
    const evaluation = evaluateConclusionClaim(truth, solution, literal.claim);
    if (!evaluation.success) return failure(evaluation.code);
    if (evaluation.status !== "undetermined" && evaluation.status !== literal.value) contradicted = true;
  }

  const claims = new Map(solution.conclusions.map((conclusion) => [conclusion.id, conclusion.claim]));
  const asserted = accusation.literals.map((literal) => ({ key: claimKey(literal.claim), value: literal.value }));
  const covered = solution.requiredConclusions.every((required) => {
    const key = claimKey(claims.get(required.conclusionId)!);
    return asserted.some((literal) => literal.key === key && literal.value === required.value);
  });

  return Object.freeze({ success: true, verdict: covered && !contradicted ? "solved" : "not_solved" });
}
