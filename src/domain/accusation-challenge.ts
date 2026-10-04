import { z } from "zod";
import { CaseIdSchema, type CaseTruth, type DeepReadonly } from "./case-truth.ts";
import { hashCaseTruth } from "./case-truth.identity.ts";
import { ConclusionClaimSchema, claimKey, evaluateConclusionClaim, type CaseSolution } from "./case-solution.ts";
import { hashCaseSolution } from "./case-solution.identity.ts";
import { evaluateAccusation, type Accusation } from "./case-accusation.ts";

// Exactness wrapper around the neutral accusation core (MYST-CHALLENGE-0001).
// A trusted host picks a parsed challenge: a scope of bare claims bound to one CaseTruth and
// one CaseSolution. Solved iff the core says solved AND every asserted literal is an in-scope
// claim whose canonical status is exactly the asserted boolean. Undetermined never matches.
// Parse issues are private author feedback (they may name conclusion IDs), never player output.

const Sha256Schema = z.string().regex(/^[0-9a-f]{64}$/, "Expected a lowercase SHA-256 hex digest");

/** V1 resource budget for the wrapper evaluation, not a statement about guilt. */
const MAX_ALLOWED_CLAIMS = 256;

const ChallengeShapeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  caseId: CaseIdSchema,
  truthHash: Sha256Schema,
  solutionHash: Sha256Schema,
  allowedClaims: z.array(ConclusionClaimSchema).min(1).max(MAX_ALLOWED_CLAIMS),
});

type ChallengeShape = z.output<typeof ChallengeShapeSchema>;
type Path = (string | number)[];

type Binding = { readonly truthHash: string; readonly solutionHash: string; readonly solutionBound: boolean };

function checkChallenge(
  challenge: ChallengeShape,
  truth: CaseTruth,
  solution: CaseSolution,
  binding: Binding,
  ctx: z.RefinementCtx<ChallengeShape>,
): void {
  const issue = (message: string, path: Path) => ctx.addIssue({ code: "custom", message, path });

  // 1. The answer key must belong to the world, otherwise nothing else is meaningful.
  if (!binding.solutionBound) return issue("SOLUTION_BINDING_MISMATCH: the CaseSolution is not bound to the CaseTruth", []);

  // 2. Challenge binding, each at its own field; no follow-up issues.
  let bound = true;
  if (challenge.caseId !== truth.caseId) {
    issue(`Challenge is for ${challenge.caseId}, not ${truth.caseId}`, ["caseId"]);
    bound = false;
  }
  if (challenge.truthHash !== binding.truthHash) {
    issue("truthHash does not match the given CaseTruth", ["truthHash"]);
    bound = false;
  }
  if (challenge.solutionHash !== binding.solutionHash) {
    issue("solutionHash does not match the given CaseSolution", ["solutionHash"]);
    bound = false;
  }
  if (!bound) return;

  // 3. References exist in the truth; catalogue or resolution membership is not required.
  const events = new Set<string>(truth.events.map((e) => e.id));
  const persons = new Set<string>(truth.persons.map((p) => p.id));
  challenge.allowedClaims.forEach((claim, i) => {
    if (!events.has(claim.eventId)) issue(`Unknown event "${claim.eventId}"`, ["allowedClaims", i, "eventId"]);
    if ("personId" in claim && !persons.has(claim.personId)) {
      issue(`Unknown person "${claim.personId}"`, ["allowedClaims", i, "personId"]);
    }
    if (claim.kind === "eventCausedEvent" && !events.has(claim.causeEventId)) {
      issue(`Unknown event "${claim.causeEventId}"`, ["allowedClaims", i, "causeEventId"]);
    }
  });

  // 4. Structural uniqueness, independent of property order. No silent deduplication.
  const firstIndex = new Map<string, number>();
  challenge.allowedClaims.forEach((claim, j) => {
    const key = claimKey(claim);
    const first = firstIndex.get(key);
    if (first !== undefined) issue(`Claim duplicates allowedClaims[${first}]`, ["allowedClaims", j]);
    else firstIndex.set(key, j);
  });

  // 5. Every required conclusion must be in scope, or the challenge could never be solved.
  const claims = new Map(solution.conclusions.map((conclusion) => [conclusion.id, conclusion.claim]));
  for (const required of solution.requiredConclusions) {
    const key = claimKey(claims.get(required.conclusionId)!);
    if (!firstIndex.has(key)) issue(`Required ${required.conclusionId} is not in scope: ${key}`, ["allowedClaims"]);
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function isSolutionBound(truth: CaseTruth, solution: CaseSolution, truthHash: string): boolean {
  return solution.caseId === truth.caseId && solution.truthHash === truthHash;
}

function challengeSchema(truth: CaseTruth, solution: CaseSolution) {
  const truthHash = hashCaseTruth(truth);
  const binding: Binding = {
    truthHash,
    solutionHash: hashCaseSolution(solution),
    solutionBound: isSolutionBound(truth, solution, truthHash),
  };
  return ChallengeShapeSchema.superRefine((challenge, ctx) => checkChallenge(challenge, truth, solution, binding, ctx))
    .transform((challenge) => deepFreeze(structuredClone(challenge)) as DeepReadonly<ChallengeShape>)
    .brand<"AccusationChallenge">();
}

/** Plain, mutable host-side authoring input. */
export type AccusationChallengeInput = z.input<typeof ChallengeShapeSchema>;

/** Deeply frozen, nominally branded challenge, bound to one CaseTruth and one CaseSolution. */
export type AccusationChallenge = z.output<ReturnType<typeof challengeSchema>>;

export type ChallengeAccusationResult =
  | { readonly success: true; readonly verdict: "solved" | "not_solved" }
  | {
      readonly success: false;
      readonly code:
        | "SOLUTION_BINDING_MISMATCH"
        | "CHALLENGE_BINDING_MISMATCH"
        | "ACCUSATION_BINDING_MISMATCH"
        | "INVALID_CLAIM"
        | "UNKNOWN_REFERENCE";
    };

/** Throws a ZodError; issues are host-internal author feedback. */
export function parseAccusationChallenge(input: unknown, truth: CaseTruth, solution: CaseSolution): AccusationChallenge {
  return challengeSchema(truth, solution).parse(input);
}

type FailureCode = Extract<ChallengeAccusationResult, { success: false }>["code"];
const failure = (code: FailureCode): ChallengeAccusationResult => Object.freeze({ success: false, code });
const verdict = (v: "solved" | "not_solved"): ChallengeAccusationResult => Object.freeze({ success: true, verdict: v });

/**
 * Player verdict for a parsed accusation under a host-chosen challenge. Technical failures are host
 * errors and never become not_solved. The result carries only the verdict: no claims, counts or IDs.
 */
export function evaluateChallengeAccusation(
  truth: CaseTruth,
  solution: CaseSolution,
  challenge: AccusationChallenge,
  accusation: Accusation,
): ChallengeAccusationResult {
  // Binding before any result, in this order: solution, challenge, accusation.
  const truthHash = hashCaseTruth(truth);
  if (!isSolutionBound(truth, solution, truthHash)) return failure("SOLUTION_BINDING_MISMATCH");
  if (
    challenge.caseId !== truth.caseId ||
    challenge.truthHash !== truthHash ||
    challenge.solutionHash !== hashCaseSolution(solution)
  ) {
    return failure("CHALLENGE_BINDING_MISMATCH");
  }
  if (accusation.caseId !== truth.caseId || accusation.truthHash !== truthHash) return failure("ACCUSATION_BINDING_MISMATCH");

  // Accusation claims are unique (MYST-0002), so more literals than scope claims means one is outside.
  if (accusation.literals.length > challenge.allowedClaims.length) return verdict("not_solved");
  const scope = new Set(challenge.allowedClaims.map(claimKey));
  if (!accusation.literals.every((literal) => scope.has(claimKey(literal.claim)))) return verdict("not_solved");

  const core = evaluateAccusation(truth, solution, accusation);
  if (!core.success) return failure(core.code);
  if (core.verdict !== "solved") return verdict("not_solved");

  for (const literal of accusation.literals) {
    const evaluation = evaluateConclusionClaim(truth, solution, literal.claim);
    if (!evaluation.success) return failure(evaluation.code);
    // "undetermined" equals neither true nor false: unknown is never accepted, never coerced.
    if (evaluation.status !== literal.value) return verdict("not_solved");
  }
  return verdict("solved");
}
