import { z } from "zod";
import {
  CaseIdSchema,
  EventIdSchema,
  EvidenceIdSchema,
  ItemIdSchema,
  LocationIdSchema,
  PersonIdSchema,
  PropositionIdSchema,
  TickSchema,
  type CaseTruth,
  type DeepReadonly,
} from "./case-truth.ts";
import { hashCaseTruth } from "./case-truth.identity.ts";
import { ConclusionIdSchema, type CaseSolution } from "./case-solution.ts";
import { hashCaseSolution } from "./case-solution.identity.ts";
import { deepFreeze } from "./shared.ts";

// Epistemic snapshot of one NPC at one point in time (TASK-0004).
// Subjective awareness, knowledge, belief and uncertainty, bound to exact CaseTruth and
// (optionally) CaseSolution snapshots. A successful parse confirms binding, references and
// the epistemic rules below; it does not confirm a consistent world or a justified belief.
// Ignorance is the absence of an entry. Nothing is ever added automatically.

const Sha256Schema = z.string().regex(/^[0-9a-f]{64}$/, "Expected a lowercase SHA-256 hex digest");

// ---------- Subjects, provenance, stances ----------

export const AwarenessSubjectSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("person"), id: PersonIdSchema }),
  z.strictObject({ kind: z.literal("location"), id: LocationIdSchema }),
  z.strictObject({ kind: z.literal("item"), id: ItemIdSchema }),
  z.strictObject({ kind: z.literal("event"), id: EventIdSchema }),
  z.strictObject({ kind: z.literal("evidence"), id: EvidenceIdSchema }),
]);

const PropositionSubjectSchema = z.strictObject({ kind: z.literal("proposition"), id: PropositionIdSchema });
const ConclusionSubjectSchema = z.strictObject({ kind: z.literal("conclusion"), id: ConclusionIdSchema });

export const StatementSubjectSchema = z.discriminatedUnion("kind", [PropositionSubjectSchema, ConclusionSubjectSchema]);

/** Author annotation of how a state was acquired. Never projected, grants nothing. */
export const ProvenanceSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("prior_knowledge") }),
  z.strictObject({ kind: z.literal("witnessed_event"), eventId: EventIdSchema }),
  z.strictObject({ kind: z.literal("observed_evidence"), evidenceId: EvidenceIdSchema }),
  z.strictObject({ kind: z.literal("told_by_person"), personId: PersonIdSchema }),
  z.strictObject({ kind: z.literal("author_modeled_inference") }),
]);

const KnowledgeStanceSchema = z.strictObject({ kind: z.literal("knowledge"), value: z.boolean() });
const BeliefStanceSchema = z.strictObject({ kind: z.literal("belief"), value: z.boolean() });
const UncertainStanceSchema = z.strictObject({ kind: z.literal("uncertain"), leaning: z.boolean().nullable() });

export const EpistemicStanceSchema = z.discriminatedUnion("kind", [
  KnowledgeStanceSchema,
  BeliefStanceSchema,
  UncertainStanceSchema,
]);

export const AwarenessEntrySchema = z.strictObject({
  subject: AwarenessSubjectSchema,
  acquiredAt: TickSchema,
  provenance: ProvenanceSchema,
});

// Conclusions can never be known in V1: the restriction lives in the schema and the type.
export const AttitudeEntrySchema = z.union([
  z.strictObject({
    subject: PropositionSubjectSchema,
    stance: EpistemicStanceSchema,
    acquiredAt: TickSchema,
    provenance: ProvenanceSchema,
  }),
  z.strictObject({
    subject: ConclusionSubjectSchema,
    stance: z.discriminatedUnion("kind", [BeliefStanceSchema, UncertainStanceSchema]),
    acquiredAt: TickSchema,
    provenance: ProvenanceSchema,
  }),
]);

export type AwarenessSubject = z.output<typeof AwarenessSubjectSchema>;
export type StatementSubject = z.output<typeof StatementSubjectSchema>;
export type Provenance = z.output<typeof ProvenanceSchema>;
export type EpistemicStance = z.output<typeof EpistemicStanceSchema>;
export type AwarenessEntry = z.output<typeof AwarenessEntrySchema>;
export type AttitudeEntry = z.output<typeof AttitudeEntrySchema>;

// ---------- Root (unbound shape stays private) ----------

const NpcKnowledgeShapeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  caseId: CaseIdSchema,
  truthHash: Sha256Schema,
  solutionHash: Sha256Schema.nullable(),
  npcId: PersonIdSchema,
  revision: z.int().positive(),
  asOf: TickSchema,
  awareness: z.array(AwarenessEntrySchema),
  attitudes: z.array(AttitudeEntrySchema),
});

type NpcKnowledgeShape = z.output<typeof NpcKnowledgeShapeSchema>;
type Ctx = z.RefinementCtx<NpcKnowledgeShape>;
type Path = (string | number)[];
type TruthEvent = CaseTruth["events"][number];
type TruthProposition = CaseTruth["propositions"][number];
type SolutionConclusion = CaseSolution["conclusions"][number];

/** Hashes and solution/truth match, computed once per schema. */
type BindingContext = {
  readonly truthHash: string;
  readonly solutionHash: string | null;
  readonly solutionMatchesTruth: boolean;
};

function bindingContext(truth: CaseTruth, solution: CaseSolution | null): BindingContext {
  const truthHash = hashCaseTruth(truth);
  return {
    truthHash,
    solutionHash: solution === null ? null : hashCaseSolution(solution),
    solutionMatchesTruth: solution === null || (solution.caseId === truth.caseId && solution.truthHash === truthHash),
  };
}

/**
 * Structural statement key (§9): subject namespace plus the claim's fields sorted by
 * UTF-16 code units. Statement IDs and objective truth values are not part of it.
 */
function statementKey(kind: "proposition" | "conclusion", claim: object): string {
  const entries = Object.entries(claim).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify([kind, entries]);
}

function checkBinding(
  npc: NpcKnowledgeShape,
  truth: CaseTruth,
  solution: CaseSolution | null,
  binding: BindingContext,
  issue: (message: string, path: Path) => void,
): boolean {
  let bound = true;
  const fail = (message: string, path: Path) => {
    bound = false;
    issue(message, path);
  };

  if (npc.caseId !== truth.caseId) fail(`Snapshot is for ${npc.caseId}, not ${truth.caseId}`, ["caseId"]);
  if (npc.truthHash !== binding.truthHash) fail("truthHash does not match the given CaseTruth", ["truthHash"]);
  if (!truth.persons.some((person) => person.id === npc.npcId)) fail(`Unknown person "${npc.npcId}"`, ["npcId"]);

  if (solution === null) {
    if (npc.solutionHash !== null) fail("solutionHash is set but no CaseSolution is bound", ["solutionHash"]);
    npc.attitudes.forEach((attitude, i) => {
      if (attitude.subject.kind === "conclusion") {
        fail("Conclusion attitudes require a bound CaseSolution", ["attitudes", i, "subject", "id"]);
      }
    });
  } else if (!binding.solutionMatchesTruth) {
    fail("The given CaseSolution is not bound to the given CaseTruth", ["solutionHash"]);
  } else if (npc.solutionHash !== binding.solutionHash) {
    fail("solutionHash does not match the given CaseSolution", ["solutionHash"]);
  }
  return bound;
}

function checkAcquisition(
  entry: { acquiredAt: number; provenance: Provenance },
  asOf: number,
  path: Path,
  lookup: { events: ReadonlyMap<string, TruthEvent>; evidence: ReadonlySet<string>; persons: ReadonlySet<string> },
  issue: (message: string, path: Path) => void,
): void {
  const { acquiredAt, provenance } = entry;
  if (acquiredAt > asOf) issue("acquiredAt must not be after asOf", [...path, "acquiredAt"]);

  switch (provenance.kind) {
    case "prior_knowledge":
      if (acquiredAt !== 0) issue("prior_knowledge requires acquiredAt 0", [...path, "acquiredAt"]);
      break;
    case "witnessed_event": {
      const event = lookup.events.get(provenance.eventId);
      if (event === undefined) {
        issue(`Unknown event "${provenance.eventId}"`, [...path, "provenance", "eventId"]);
        break;
      }
      const { time } = event;
      const during = time.kind === "instant" ? acquiredAt === time.at : time.start <= acquiredAt && acquiredAt < time.end;
      if (!during) issue("A witnessed event must be acquired during the event", [...path, "acquiredAt"]);
      break;
    }
    case "observed_evidence":
      if (!lookup.evidence.has(provenance.evidenceId)) {
        issue(`Unknown evidence "${provenance.evidenceId}"`, [...path, "provenance", "evidenceId"]);
      }
      break;
    case "told_by_person":
      if (!lookup.persons.has(provenance.personId)) {
        issue(`Unknown person "${provenance.personId}"`, [...path, "provenance", "personId"]);
      }
      break;
    case "author_modeled_inference":
      break;
  }
}

function checkNpcKnowledge(
  npc: NpcKnowledgeShape,
  truth: CaseTruth,
  solution: CaseSolution | null,
  binding: BindingContext,
  ctx: Ctx,
): void {
  const issue = (message: string, path: Path) => ctx.addIssue({ code: "custom", message, path });

  // Context-dependent references are only meaningful against the correctly bound documents.
  if (!checkBinding(npc, truth, solution, binding, issue)) return;

  const known: Record<AwarenessSubject["kind"], ReadonlySet<string>> = {
    person: new Set(truth.persons.map((p) => p.id)),
    location: new Set(truth.locations.map((l) => l.id)),
    item: new Set(truth.items.map((i) => i.id)),
    event: new Set(truth.events.map((e) => e.id)),
    evidence: new Set(truth.evidence.map((e) => e.id)),
  };
  const lookup = {
    events: new Map<string, TruthEvent>(truth.events.map((e) => [e.id, e])),
    evidence: known.evidence,
    persons: known.person,
  };
  const propositions = new Map<string, TruthProposition>(truth.propositions.map((p) => [p.id, p]));
  const conclusions = new Map<string, SolutionConclusion>((solution?.conclusions ?? []).map((c) => [c.id, c]));

  const seenAwareness = new Set<string>();
  npc.awareness.forEach((entry, i) => {
    const path = ["awareness", i];
    const { kind, id } = entry.subject;
    if (!known[kind].has(id)) issue(`Unknown ${kind} "${id}"`, [...path, "subject", "id"]);
    const key = `${kind}|${id}`;
    if (seenAwareness.has(key)) issue(`Duplicate awareness of "${id}"`, [...path, "subject"]);
    seenAwareness.add(key);
    checkAcquisition(entry, npc.asOf, path, lookup, issue);
  });

  const seenStatements = new Set<string>();
  npc.attitudes.forEach((entry, i) => {
    const path = ["attitudes", i];
    checkAcquisition(entry, npc.asOf, path, lookup, issue);

    let claim: object;
    if (entry.subject.kind === "proposition") {
      const proposition = propositions.get(entry.subject.id);
      if (proposition === undefined) {
        issue(`Unknown proposition "${entry.subject.id}"`, [...path, "subject", "id"]);
        return;
      }
      // knowledge is factive: it must match the objective truth value.
      if (entry.stance.kind === "knowledge" && entry.stance.value !== proposition.truth) {
        issue("knowledge must match the proposition's truth value", [...path, "stance", "value"]);
      }
      claim = proposition.claim;
    } else {
      const conclusion = conclusions.get(entry.subject.id);
      if (conclusion === undefined) {
        issue(`Unknown conclusion "${entry.subject.id}"`, [...path, "subject", "id"]);
        return;
      }
      claim = conclusion.claim;
    }

    const key = statementKey(entry.subject.kind, claim);
    if (seenStatements.has(key)) issue("Duplicate attitude towards the same claim", [...path, "subject"]);
    seenStatements.add(key);
  });
}

// ---------- Immutability ----------

/** Zod schema bound to one CaseTruth and an explicit CaseSolution or null. */
export function createNpcKnowledgeSchema(truth: CaseTruth, solution: CaseSolution | null) {
  const binding = bindingContext(truth, solution);
  return NpcKnowledgeShapeSchema.superRefine((npc, ctx) => checkNpcKnowledge(npc, truth, solution, binding, ctx))
    .transform((npc) => deepFreeze(structuredClone(npc)) as DeepReadonly<NpcKnowledgeShape>)
    .brand<"NpcKnowledgeSnapshot">();
}

/** Plain, mutable authoring input. */
export type NpcKnowledgeInput = z.input<ReturnType<typeof createNpcKnowledgeSchema>>;

/** Deeply frozen, nominally branded epistemic snapshot of one NPC. */
export type NpcKnowledgeSnapshot = z.output<ReturnType<typeof createNpcKnowledgeSchema>>;

export function parseNpcKnowledge(input: unknown, truth: CaseTruth, solution: CaseSolution | null): NpcKnowledgeSnapshot {
  return createNpcKnowledgeSchema(truth, solution).parse(input);
}
