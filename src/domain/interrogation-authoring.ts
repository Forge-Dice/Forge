import { z } from "zod";
import { CaseIdSchema, ClaimSchema, PersonIdSchema, type CaseTruth, type DeepReadonly } from "./case-truth.ts";
import { hashCaseTruth } from "./case-truth.identity.ts";
import { ConclusionClaimSchema } from "./case-solution.ts";
import { AwarenessSubjectSchema } from "./npc-knowledge.ts";
import { hashQuestionCatalogue } from "./interrogation-authoring.identity.ts";

// Author-side half of NPC interrogation V1 (MYST-0005A): a QuestionCatalogue (questions = mentioned
// entities) and per-NPC profiles with one answer/decline rule per question, both bound to one CaseTruth.
// Release rules R1-R4: an answer never shows an entity the author did not release. No runtime answering.
// Lies (ruleset mystery-session-v2): a "lie" rule states a fixed stance on a proposition that
// contradicts the truth. The player sees it exactly like an answer; only the author file marks it.

const Sha256Schema = z.string().regex(/^[0-9a-f]{64}$/, "Expected a lowercase SHA-256 hex digest");

export const QuestionIdSchema = z.string().regex(/^question:[a-z0-9][a-z0-9_-]{0,63}$/).brand<"QuestionId">();
export type QuestionId = z.output<typeof QuestionIdSchema>;

export type EntityRef = z.output<typeof AwarenessSubjectSchema>;

export const StatementClaimSchema = z.union([ClaimSchema, ConclusionClaimSchema]);
export type StatementClaim = z.output<typeof StatementClaimSchema>;

type Path = (string | number)[];
type Issue = (message: string, path: Path) => void;
/** Reports an issue and returns false, so callers can track whether a group of checks passed. */
const failed = (issue: Issue, message: string, path: Path): false => (issue(message, path), false);
const issuer = (ctx: z.RefinementCtx<unknown>): Issue => (message, path) => ctx.addIssue({ code: "custom", message, path });
type ClaimField = readonly [field: string, kind: EntityRef["kind"], id: string];

// Exhaustive without default: a new claim kind fails to compile here.
function claimFields(claim: DeepReadonly<StatementClaim>): readonly ClaimField[] {
  switch (claim.kind) {
    case "personAt":
      return [["personId", "person", claim.personId], ["locationId", "location", claim.locationId]];
    case "eventHasParticipant":
      return [["eventId", "event", claim.eventId], ["personId", "person", claim.personId]];
    case "eventHasItem":
      return [["eventId", "event", claim.eventId], ["itemId", "item", claim.itemId]];
    case "personResponsibleForEvent":
    case "personRoleForEvent":
      return [["personId", "person", claim.personId], ["eventId", "event", claim.eventId]];
    case "noPersonResponsibleForEvent":
    case "eventIntent":
    case "eventMechanism":
      return [["eventId", "event", claim.eventId]];
    case "eventCausedEvent":
      return [["causeEventId", "event", claim.causeEventId], ["eventId", "event", claim.eventId]];
  }
}

const refKey = (ref: { kind: string; id: string }): string => `${ref.kind}|${ref.id}`;

/** Entity references of a claim in field order, deduplicated by kind|id, frozen. */
export function statementClaimReferences(claim: DeepReadonly<StatementClaim>): readonly EntityRef[] {
  const keys = new Set<string>();
  const refs = claimFields(claim).map(([, kind, id]) => Object.freeze({ kind, id }) as EntityRef);
  return Object.freeze(refs.filter((ref) => !keys.has(refKey(ref)) && keys.add(refKey(ref))));
}

function knownEntities(truth: CaseTruth): Record<EntityRef["kind"], ReadonlySet<string>> {
  return {
    person: new Set(truth.persons.map((p) => p.id)),
    location: new Set(truth.locations.map((l) => l.id)),
    item: new Set(truth.items.map((i) => i.id)),
    event: new Set(truth.events.map((e) => e.id)),
    evidence: new Set(truth.evidence.map((e) => e.id)),
  };
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const sameJson = (a: unknown, b: unknown): boolean =>
  typeof a !== "object" || a === null || typeof b !== "object" || b === null
    ? a === b
    : Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => sameJson(v, (b as Record<string, unknown>)[k]));

/** The truth proposition whose claim structurally equals claim, if any. */
export function lieProposition(truth: CaseTruth, claim: DeepReadonly<StatementClaim>) {
  return truth.propositions.find((p) => sameJson(p.claim, claim));
}

// ---------- QuestionCatalogue ----------

const QuestionCatalogueShapeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  caseId: CaseIdSchema,
  truthHash: Sha256Schema,
  revision: z.int().positive(),
  questions: z.array(z.strictObject({ id: QuestionIdSchema, mentions: z.array(AwarenessSubjectSchema).min(1) })).min(1),
});
type QuestionCatalogueShape = z.output<typeof QuestionCatalogueShapeSchema>;

function checkCatalogue(catalogue: QuestionCatalogueShape, truth: CaseTruth, truthHash: string, issue: Issue): void {
  let bound = true;
  if (catalogue.caseId !== truth.caseId) bound = failed(issue, `Catalogue is for ${catalogue.caseId}`, ["caseId"]);
  if (catalogue.truthHash !== truthHash) bound = failed(issue, "truthHash does not match the given CaseTruth", ["truthHash"]);
  if (!bound) return;
  const ids = new Set<string>();
  catalogue.questions.forEach((question, j) => {
    if (ids.has(question.id)) issue(`Duplicate question "${question.id}"`, ["questions", j, "id"]);
    ids.add(question.id);
  });
  const known = knownEntities(truth);
  catalogue.questions.forEach((question, i) =>
    question.mentions.forEach(({ kind, id }, k) => {
      if (!known[kind].has(id)) issue(`Unknown ${kind} "${id}"`, ["questions", i, "mentions", k, "id"]);
    }),
  );
  catalogue.questions.forEach((question, i) => {
    const seen = new Set<string>();
    question.mentions.forEach((mention, k) => {
      if (seen.has(refKey(mention))) issue(`Duplicate mention "${mention.id}"`, ["questions", i, "mentions", k]);
      seen.add(refKey(mention));
    });
  });
}

/** Zod schema bound to one CaseTruth. */
export function createQuestionCatalogueSchema(truth: CaseTruth) {
  const truthHash = hashCaseTruth(truth);
  return QuestionCatalogueShapeSchema.superRefine((c, ctx) => checkCatalogue(c, truth, truthHash, issuer(ctx)))
    .transform((c) => deepFreeze(structuredClone(c)) as DeepReadonly<QuestionCatalogueShape>)
    .brand<"QuestionCatalogue">();
}

export type QuestionCatalogueInput = z.input<ReturnType<typeof createQuestionCatalogueSchema>>;
export type QuestionCatalogue = z.output<ReturnType<typeof createQuestionCatalogueSchema>>;

export function parseQuestionCatalogue(input: unknown, truth: CaseTruth): QuestionCatalogue {
  return createQuestionCatalogueSchema(truth).parse(input);
}

// ---------- NpcInterrogationProfile ----------

const RuleSchema = z.discriminatedUnion("act", [
  z.strictObject({
    questionId: QuestionIdSchema,
    act: z.literal("answer"),
    claim: StatementClaimSchema,
    reveal: z.array(AwarenessSubjectSchema),
  }),
  z.strictObject({
    questionId: QuestionIdSchema,
    act: z.literal("lie"),
    claim: ClaimSchema,
    stance: z.enum(["affirms", "denies"]),
    reveal: z.array(AwarenessSubjectSchema),
  }),
  z.strictObject({ questionId: QuestionIdSchema, act: z.literal("decline") }),
]);

const InterrogationProfileShapeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  caseId: CaseIdSchema,
  truthHash: Sha256Schema,
  catalogueHash: Sha256Schema,
  npcId: PersonIdSchema,
  revision: z.int().positive(),
  rules: z.array(RuleSchema),
});
type InterrogationProfileShape = z.output<typeof InterrogationProfileShapeSchema>;
type Binding = { readonly truthHash: string; readonly catalogueHash: string; readonly catalogueBound: boolean };

function checkProfile(p: InterrogationProfileShape, truth: CaseTruth, catalogue: QuestionCatalogue, b: Binding, issue: Issue): void {
  let bound = true;
  if (p.caseId !== truth.caseId) bound = failed(issue, `Profile is for ${p.caseId}`, ["caseId"]);
  if (p.truthHash !== b.truthHash) bound = failed(issue, "truthHash does not match the given CaseTruth", ["truthHash"]);
  if (p.catalogueHash !== b.catalogueHash) bound = failed(issue, "catalogueHash does not match the catalogue", ["catalogueHash"]);
  else if (!b.catalogueBound) bound = failed(issue, "The catalogue is not bound to the given CaseTruth", ["catalogueHash"]);
  if (!bound) return;
  const known = knownEntities(truth);
  if (!known.person.has(p.npcId)) issue(`Unknown person "${p.npcId}"`, ["npcId"]);
  const npcKey = refKey({ kind: "person", id: p.npcId });
  const questions = new Map(catalogue.questions.map((q) => [q.id as string, q]));

  const seen = new Set<string>();
  p.rules.forEach((rule, j) => {
    if (seen.has(rule.questionId)) issue(`Duplicate rule for "${rule.questionId}"`, ["rules", j, "questionId"]);
    seen.add(rule.questionId);
  });
  p.rules.forEach((rule, i) => {
    const question = questions.get(rule.questionId);
    if (question === undefined) return issue(`Unknown question "${rule.questionId}"`, ["rules", i, "questionId"]);
    if (rule.act === "decline") return;
    let referencesOk = true;
    for (const [field, kind, id] of claimFields(rule.claim)) {
      if (!known[kind].has(id)) referencesOk = failed(issue, `Unknown ${kind} "${id}"`, ["rules", i, "claim", field]);
    }
    rule.reveal.forEach(({ kind, id }, j) => {
      if (!known[kind].has(id)) referencesOk = failed(issue, `Unknown ${kind} "${id}"`, ["rules", i, "reveal", j, "id"]);
    });
    if (!referencesOk) return;
    if (rule.act === "lie") {
      const proposition = lieProposition(truth, rule.claim);
      if (proposition === undefined) issue("A lie must state a proposition of the truth", ["rules", i, "claim"]);
      else if ((rule.stance === "affirms") === proposition.truth) issue("A lie must contradict the truth", ["rules", i, "stance"]);
    }

    const mentionKeys = new Set(question.mentions.map(refKey));
    const revealKeys = rule.reveal.map(refKey);
    const claimKeys = new Set(statementClaimReferences(rule.claim).map(refKey));
    const allowed = new Set([...mentionKeys, npcKey, ...revealKeys]);
    if ([...claimKeys].some((key) => !allowed.has(key))) issue("R1: claim shows an unreleased entity", ["rules", i, "claim"]);
    const revealed = new Set<string>();
    revealKeys.forEach((key, j) => {
      if (!claimKeys.has(key)) issue("R2: a revealed entity must occur in the claim", ["rules", i, "reveal", j]);
      if (mentionKeys.has(key) || key === npcKey) issue("R3: a revealed entity must be new", ["rules", i, "reveal", j]);
      if (revealed.has(key)) issue("R4: duplicate reveal", ["rules", i, "reveal", j]);
      revealed.add(key);
    });
  });
}

/** Zod schema bound to one CaseTruth and one QuestionCatalogue. */
export function createInterrogationProfileSchema(truth: CaseTruth, catalogue: QuestionCatalogue) {
  const truthHash = hashCaseTruth(truth);
  const catalogueBound = catalogue.caseId === truth.caseId && catalogue.truthHash === truthHash;
  const binding: Binding = { truthHash, catalogueHash: hashQuestionCatalogue(catalogue), catalogueBound };
  return InterrogationProfileShapeSchema.superRefine((p, ctx) => checkProfile(p, truth, catalogue, binding, issuer(ctx)))
    .transform((p) => deepFreeze(structuredClone(p)) as DeepReadonly<InterrogationProfileShape>)
    .brand<"NpcInterrogationProfile">();
}

export type InterrogationProfileInput = z.input<ReturnType<typeof createInterrogationProfileSchema>>;
export type InterrogationProfile = z.output<ReturnType<typeof createInterrogationProfileSchema>>;

export function parseInterrogationProfile(input: unknown, truth: CaseTruth, catalogue: QuestionCatalogue): InterrogationProfile {
  return createInterrogationProfileSchema(truth, catalogue).parse(input);
}

export type LiedLiteral = {
  readonly npcId: string;
  readonly questionId: string;
  readonly literal: { readonly kind: "proposition"; readonly propositionId: string; readonly value: boolean };
};

/** Trusted author side: every lie of a parsed profile as the proof literal it falsely states. */
export function profileLies(profile: InterrogationProfile, truth: CaseTruth): readonly LiedLiteral[] {
  return profile.rules.flatMap((rule) => {
    const proposition = rule.act === "lie" ? lieProposition(truth, rule.claim) : undefined;
    if (rule.act !== "lie" || proposition === undefined) return [];
    const literal = { kind: "proposition", propositionId: proposition.id, value: rule.stance === "affirms" } as const;
    return [{ npcId: profile.npcId, questionId: rule.questionId, literal }];
  });
}
