import { z } from "zod";
import { CaseIdSchema, ClaimSchema, EventIdSchema, EvidenceIdSchema, ItemIdSchema, LocationIdSchema } from "./case-truth.ts";
import { PersonIdSchema, type CaseTruth, type DeepReadonly } from "./case-truth.ts";
import { hashCaseTruth } from "./case-truth.identity.ts";

// Evidence presentation and player release (MYST-0004). An author-side document, bound to one
// CaseTruth, fixes what a player sees when an evidence is released: authorised text, mentioned
// entities and reported statements. Release emits only PlayerRefs from a trusted port, never
// canonical IDs. Text rules are an accident guard against pasted IDs, not spoiler detection.

export const PRESENTATION_LIMITS = Object.freeze({ textMaxLength: 1000, maxMentions: 16, maxReports: 8 });

/** Reference format of MYST-0001 v1 D3. */
export const PLAYER_REF_PATTERN = /^pr1_[0-9a-hjkmnp-tv-z]{16}$/;

const FORBIDDEN_CHARACTERS =
  /[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u061C\u200B\u200E\u200F\u2028\u2029\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/;
const CANONICAL_ID_IN_TEXT =
  /(?:case|person|location|item|relationship|event|motive|proposition|evidence|secret|red-herring|conclusion):[a-z0-9]/;
const PLAYER_REF_IN_TEXT = /pr1_[0-9a-z]{16}/;

function isWellFormed(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit >= 0xdc00 && unit <= 0xdfff) return false;
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      i++;
    }
  }
  return true;
}

export const PlayerTextSchema = z.string().superRefine((text, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  // T1 counts UTF-16 code units; zod's string max counts code points.
  const max = PRESENTATION_LIMITS.textMaxLength;
  if (text.length > max) {
    ctx.addIssue({ code: "too_big", origin: "string", maximum: max, inclusive: true, message: `Too big: expected string to have <=${max} characters` });
  }
  if (!/\S/.test(text)) issue("Text must contain a non-whitespace character");
  if (!isWellFormed(text)) issue("Text must be well-formed Unicode");
  if (FORBIDDEN_CHARACTERS.test(text)) issue("Text contains a forbidden control, bidi or invisible character");
  if (CANONICAL_ID_IN_TEXT.test(text)) issue("Text must not contain a canonical ID");
  if (PLAYER_REF_IN_TEXT.test(text)) issue("Text must not contain a PlayerRef");
});

export const MentionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("person"), id: PersonIdSchema }),
  z.strictObject({ kind: z.literal("location"), id: LocationIdSchema }),
  z.strictObject({ kind: z.literal("item"), id: ItemIdSchema }),
  z.strictObject({ kind: z.literal("event"), id: EventIdSchema }),
]);

export const ReportSchema = z.strictObject({
  claim: ClaimSchema,
  stance: z.enum(["affirms", "denies"]),
  source: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("observation") }),
    z.strictObject({ kind: z.literal("testimony"), personId: PersonIdSchema }),
  ]),
});

export const PresentationEntrySchema = z.strictObject({
  evidenceId: EvidenceIdSchema,
  text: PlayerTextSchema,
  mentions: z.array(MentionSchema).max(PRESENTATION_LIMITS.maxMentions),
  reports: z.array(ReportSchema).max(PRESENTATION_LIMITS.maxReports),
});

const PresentationShapeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  caseId: CaseIdSchema,
  truthHash: z.string().regex(/^[0-9a-f]{64}$/, "Expected a lowercase SHA-256 hex digest"),
  entries: z.array(PresentationEntrySchema),
});

export type MentionKind = z.output<typeof MentionSchema>["kind"];
export type RefKind = MentionKind | "evidence";
type PresentationShape = z.output<typeof PresentationShapeSchema>;
type Report = z.output<typeof ReportSchema>;

const mentionKey = (kind: RefKind, id: string) => `${kind}|${id}`;
const byCodeUnits = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const flatKey = (value: object) => JSON.stringify(Object.entries(value).sort(([a], [b]) => byCodeUnits(a, b)));

/** Every entity a report refers to, as (kind, id). */
function reportRefs(report: DeepReadonly<Report>): [RefKind, string][] {
  const { claim, source } = report;
  const refs: [RefKind, string][] =
    claim.kind === "personAt"
      ? [["person", claim.personId], ["location", claim.locationId]]
      : claim.kind === "eventHasParticipant"
        ? [["event", claim.eventId], ["person", claim.personId]]
        : [["event", claim.eventId], ["item", claim.itemId]];
  if (source.kind === "testimony") refs.push(["person", source.personId]);
  return refs;
}

function checkPresentation(doc: PresentationShape, truth: CaseTruth, truthHash: string, ctx: z.RefinementCtx<PresentationShape>) {
  const issue = (message: string, path: (string | number)[]) => ctx.addIssue({ code: "custom", message, path });

  // R1 binding first: references are meaningless against the wrong world.
  let bound = true;
  if (doc.caseId !== truth.caseId) {
    issue(`Presentation is for ${doc.caseId}, not ${truth.caseId}`, ["caseId"]);
    bound = false;
  }
  if (doc.truthHash !== truthHash) {
    issue("truthHash does not match the given CaseTruth snapshot", ["truthHash"]);
    bound = false;
  }
  if (!bound) return;

  const known = new Set<string>([
    ...truth.persons.map((p) => mentionKey("person", p.id)),
    ...truth.locations.map((l) => mentionKey("location", l.id)),
    ...truth.items.map((i) => mentionKey("item", i.id)),
    ...truth.events.map((e) => mentionKey("event", e.id)),
  ]);
  const evidenceIds = new Set<string>(truth.evidence.map((e) => e.id));
  const seen = new Set<string>();

  doc.entries.forEach((entry, i) => {
    // R2, R3
    if (!evidenceIds.has(entry.evidenceId)) issue(`Unknown evidence "${entry.evidenceId}"`, ["entries", i, "evidenceId"]);
    else if (seen.has(entry.evidenceId)) issue(`Duplicate entry for "${entry.evidenceId}"`, ["entries", i, "evidenceId"]);
    seen.add(entry.evidenceId);

    // R5, R6
    const mentioned = new Set<string>();
    entry.mentions.forEach((mention, j) => {
      const key = mentionKey(mention.kind, mention.id);
      if (!known.has(key)) issue(`Unknown ${mention.kind} "${mention.id}"`, ["entries", i, "mentions", j, "id"]);
      if (mentioned.has(key)) issue(`Duplicate mention of "${mention.id}"`, ["entries", i, "mentions", j]);
      mentioned.add(key);
    });

    // R7 closure, R8 one stance per (claim, source)
    const reportKeys = new Set<string>();
    entry.reports.forEach((report, j) => {
      for (const [kind, id] of reportRefs(report)) {
        if (!mentioned.has(mentionKey(kind, id))) {
          issue(`Report refers to "${id}", which is not mentioned`, ["entries", i, "reports", j]);
          break;
        }
      }
      const key = `${flatKey(report.claim)}|${flatKey(report.source)}`;
      if (reportKeys.has(key)) issue("Same claim reported twice by the same source", ["entries", i, "reports", j]);
      reportKeys.add(key);
    });
  });

  // R4 completeness
  for (const id of evidenceIds) if (!seen.has(id)) issue(`Missing entry for "${id}"`, ["entries"]);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Zod schema bound to one CaseTruth snapshot. The only way to obtain an EvidencePresentation. */
export function createEvidencePresentationSchema(truth: CaseTruth) {
  const truthHash = hashCaseTruth(truth);
  return PresentationShapeSchema.superRefine((doc, ctx) => checkPresentation(doc, truth, truthHash, ctx))
    .transform((doc) => deepFreeze(structuredClone(doc)) as DeepReadonly<PresentationShape>)
    .brand<"EvidencePresentation">();
}

export type EvidencePresentationInput = z.input<ReturnType<typeof createEvidencePresentationSchema>>;
export type EvidencePresentation = z.output<ReturnType<typeof createEvidencePresentationSchema>>;

export function parseEvidencePresentation(input: unknown, truth: CaseTruth): EvidencePresentation {
  return createEvidencePresentationSchema(truth).parse(input);
}

// ---------- Release ----------

/** Trusted host port; its return values are still checked because they cross the player boundary. */
export type PlayerRefTranslator = {
  readonly caseId: string;
  readonly truthHash: string;
  readonly refFor: (kind: RefKind, id: string) => string | null;
};

export type PlayerClaim =
  | { readonly kind: "personAt"; readonly person: string; readonly location: string; readonly at: number }
  | { readonly kind: "eventHasParticipant"; readonly event: string; readonly person: string }
  | { readonly kind: "eventHasItem"; readonly event: string; readonly item: string };
export type PlayerReport = {
  readonly claim: PlayerClaim;
  readonly stance: "affirms" | "denies";
  readonly source: { readonly kind: "observation" } | { readonly kind: "testimony"; readonly person: string };
};
export type EvidenceObservation = {
  readonly schemaVersion: 1;
  readonly evidence: string;
  readonly text: string;
  readonly mentions: readonly { readonly kind: MentionKind; readonly ref: string }[];
  readonly reports: readonly PlayerReport[];
};
export type ReleaseErrorCode = "BINDING_MISMATCH" | "UNKNOWN_EVIDENCE" | "REF_UNAVAILABLE";
export type ReleaseResult =
  | { readonly success: true; readonly observation: EvidenceObservation }
  | { readonly success: false; readonly code: ReleaseErrorCode };

const failure = (code: ReleaseErrorCode): ReleaseResult => Object.freeze({ success: false, code });
const BINDING_MISMATCH = failure("BINDING_MISMATCH");
const UNKNOWN_EVIDENCE = failure("UNKNOWN_EVIDENCE");
const REF_UNAVAILABLE = failure("REF_UNAVAILABLE");

/** Player-safe observation of one evidence. Does not check discovery: that is the caller's precondition. */
export function releaseEvidence(presentation: EvidencePresentation, evidenceId: unknown, translator: PlayerRefTranslator): ReleaseResult {
  if (translator.caseId !== presentation.caseId || translator.truthHash !== presentation.truthHash) return BINDING_MISMATCH;
  const entry = presentation.entries.find((candidate) => candidate.evidenceId === evidenceId);
  if (entry === undefined) return UNKNOWN_EVIDENCE;

  const refs = new Map<string, string>();
  const used = new Set<string>();
  const wanted: [RefKind, string][] = [["evidence", entry.evidenceId], ...entry.mentions.map((m): [RefKind, string] => [m.kind, m.id])];
  for (const [kind, id] of wanted) {
    const ref = translator.refFor(kind, id);
    if (typeof ref !== "string" || !PLAYER_REF_PATTERN.test(ref) || used.has(ref)) return REF_UNAVAILABLE;
    used.add(ref);
    refs.set(mentionKey(kind, id), ref);
  }
  const r = (kind: RefKind, id: string) => refs.get(mentionKey(kind, id))!;

  const mentions = entry.mentions.map((m) => ({ kind: m.kind, ref: r(m.kind, m.id) })).sort((a, b) => byCodeUnits(a.ref, b.ref));
  const reports = entry.reports
    .map((report): PlayerReport => {
      const { claim, stance, source } = report;
      const playerClaim: PlayerClaim =
        claim.kind === "personAt"
          ? { kind: claim.kind, person: r("person", claim.personId), location: r("location", claim.locationId), at: claim.at }
          : claim.kind === "eventHasParticipant"
            ? { kind: claim.kind, event: r("event", claim.eventId), person: r("person", claim.personId) }
            : { kind: claim.kind, event: r("event", claim.eventId), item: r("item", claim.itemId) };
      const playerSource: PlayerReport["source"] =
        source.kind === "observation" ? { kind: "observation" } : { kind: "testimony", person: r("person", source.personId) };
      return { claim: playerClaim, stance, source: playerSource };
    })
    .map((report) => ({ report, key: JSON.stringify(report) }))
    .sort((a, b) => byCodeUnits(a.key, b.key))
    .map(({ report }) => report);

  const observation: EvidenceObservation = { schemaVersion: 1, evidence: r("evidence", entry.evidenceId), text: entry.text, mentions, reports };
  return deepFreeze({ success: true, observation });
}
