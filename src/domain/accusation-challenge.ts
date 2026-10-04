import { z } from "zod";
import { CaseIdSchema, type CaseTruth, type DeepReadonly } from "./case-truth.ts";
import { hashCaseTruth } from "./case-truth.identity.ts";
import { ConclusionClaimSchema, claimKey, evaluateConclusionClaim, type CaseSolution } from "./case-solution.ts";
import { hashCaseSolution } from "./case-solution.identity.ts";
import { evaluateAccusation, type Accusation } from "./case-accusation.ts";

// Accusation challenge, exactness wrapper V1 (MYST-CHALLENGE-0001).
// A trusted host picks a parsed challenge: a public, polarity-free scope of claims bound to one
// Truth and one Solution. Challenge solved iff the MYST-0002 core is solved and every submitted
// literal is in scope and asserts exactly its determined canonical boolean. Unknown is never false.
// Author errors (parse issues) are host-internal; players only ever see solved | not_solved.

const SCOPE_LIMIT = 256;
const HashSchema = z.string().regex(/^[0-9a-f]{64}$/, "Expected a lowercase SHA-256 hex digest");

const ChallengeShapeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  caseId: CaseIdSchema,
  truthHash: HashSchema,
  solutionHash: HashSchema,
  allowedClaims: z.array(ConclusionClaimSchema).min(1).max(SCOPE_LIMIT),
});

type ChallengeShape = z.output<typeof ChallengeShapeSchema>;

export type AccusationChallengeInput = z.input<typeof ChallengeShapeSchema>;
export type AccusationChallenge = DeepReadonly<ChallengeShape> & z.$brand<"AccusationChallenge">;
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

function checkChallenge(challenge: ChallengeShape, truth: CaseTruth, solution: CaseSolution, ctx: z.RefinementCtx<ChallengeShape>) {
  const issue = (message: string, path: (string | number)[]) => ctx.addIssue({ code: "custom", message, path });
  const truthHash = hashCaseTruth(truth);

  // 1. The answer key itself must belong to the given truth.
  if (solution.caseId !== truth.caseId || solution.truthHash !== truthHash) {
    issue("SOLUTION_BINDING_MISMATCH", []);
    return;
  }

  // 2. Challenge binding; no reference or coverage follow-ups against the wrong world.
  let bound = true;
  const bind = (ok: boolean, message: string, field: string) => {
    if (!ok) {
      issue(message, [field]);
      bound = false;
    }
  };
  bind(challenge.caseId === truth.caseId, `Challenge is for ${challenge.caseId}, not ${truth.caseId}`, "caseId");
  bind(challenge.truthHash === truthHash, "truthHash does not match the given CaseTruth snapshot", "truthHash");
  bind(challenge.solutionHash === hashCaseSolution(solution), "solutionHash does not match the given CaseSolution", "solutionHash");
  if (!bound) return;

  // 3. References against the truth (no catalogue or resolution membership required).
  const events = new Set<string>(truth.events.map((e) => e.id));
  const persons = new Set<string>(truth.persons.map((p) => p.id));
  challenge.allowedClaims.forEach((claim, i) => {
    const path = ["allowedClaims", i];
    if (!events.has(claim.eventId)) issue(`Unknown event "${claim.eventId}"`, [...path, "eventId"]);
    if ("personId" in claim && !persons.has(claim.personId)) issue(`Unknown person "${claim.personId}"`, [...path, "personId"]);
    if (claim.kind === "eventCausedEvent" && !events.has(claim.causeEventId)) {
      issue(`Unknown event "${claim.causeEventId}"`, [...path, "causeEventId"]);
    }
  });

  // 4. Structural uniqueness, independent of property order; no silent deduplication.
  const firstIndex = new Map<string, number>();
  challenge.allowedClaims.forEach((claim, j) => {
    const key = claimKey(claim);
    const first = firstIndex.get(key);
    if (first !== undefined) issue(`Same claim as allowedClaims[${first}]`, ["allowedClaims", j]);
    else firstIndex.set(key, j);
  });

  // 5. Every required conclusion must be answerable inside the scope (private author feedback).
  const claims = new Map(solution.conclusions.map((conclusion) => [conclusion.id as string, conclusion.claim]));
  for (const required of solution.requiredConclusions) {
    const key = claimKey(claims.get(required.conclusionId)!);
    if (!firstIndex.has(key)) issue(`Required "${required.conclusionId}" is outside the scope: ${key}`, ["allowedClaims"]);
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Parses an author challenge bound to one truth and one solution. Throws ZodError. */
export function parseAccusationChallenge(input: unknown, truth: CaseTruth, solution: CaseSolution): AccusationChallenge {
  return ChallengeShapeSchema.superRefine((challenge, ctx) => checkChallenge(challenge, truth, solution, ctx))
    .transform((challenge) => deepFreeze(structuredClone(challenge)) as DeepReadonly<ChallengeShape>)
    .brand<"AccusationChallenge">()
    .parse(input);
}

const SOLVED: ChallengeAccusationResult = Object.freeze({ success: true, verdict: "solved" });
const NOT_SOLVED: ChallengeAccusationResult = Object.freeze({ success: true, verdict: "not_solved" });
const failure = (code: Extract<ChallengeAccusationResult, { success: false }>["code"]): ChallengeAccusationResult =>
  Object.freeze({ success: false, code });

/**
 * Player-facing verdict for a bound challenge. Bindings are checked first, even for empty
 * accusations; technical failures are passed through and never turned into not_solved.
 */
export function evaluateChallengeAccusation(
  truth: CaseTruth,
  solution: CaseSolution,
  challenge: AccusationChallenge,
  accusation: Accusation,
): ChallengeAccusationResult {
  const truthHash = hashCaseTruth(truth);
  if (solution.caseId !== truth.caseId || solution.truthHash !== truthHash) return failure("SOLUTION_BINDING_MISMATCH");
  if (challenge.caseId !== truth.caseId || challenge.truthHash !== truthHash || challenge.solutionHash !== hashCaseSolution(solution)) {
    return failure("CHALLENGE_BINDING_MISMATCH");
  }
  if (accusation.caseId !== truth.caseId || accusation.truthHash !== truthHash) return failure("ACCUSATION_BINDING_MISMATCH");

  // Claim keys of a parsed accusation are unique, so a longer accusation leaves the scope.
  if (accusation.literals.length > challenge.allowedClaims.length) return NOT_SOLVED;
  const scope = new Set(challenge.allowedClaims.map((claim) => claimKey(claim)));
  if (!accusation.literals.every((literal) => scope.has(claimKey(literal.claim)))) return NOT_SOLVED;

  const core = evaluateAccusation(truth, solution, accusation);
  if (!core.success) return failure(core.code);
  if (core.verdict !== "solved") return NOT_SOLVED;

  for (const literal of accusation.literals) {
    const evaluation = evaluateConclusionClaim(truth, solution, literal.claim);
    if (!evaluation.success) return failure(evaluation.code);
    if (evaluation.status !== literal.value) return NOT_SOLVED;
  }
  return SOLVED;
}
