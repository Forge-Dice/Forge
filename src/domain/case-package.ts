import { z } from "zod";
import { ClaimSchema, parseCaseTruth, type CaseTruth, type DeepReadonly } from "./case-truth.ts";
import { hashCaseTruth } from "./case-truth.identity.ts";
import { validateCaseSemantics } from "./case-semantics.ts";
import { ConclusionClaimSchema, parseCaseSolution, type CaseSolution } from "./case-solution.ts";
import { hashCaseSolution } from "./case-solution.identity.ts";
import { parseEvidenceAccessMap, type EvidenceAccessMap } from "./evidence-access.ts";
import { hashEvidenceAccessMap } from "./evidence-access.identity.ts";
import { PlayerTextSchema, parseEvidencePresentation, type EvidencePresentation } from "./evidence-presentation.ts";
import { hashEvidencePresentation } from "./evidence-presentation.identity.ts";
import {
  QuestionIdSchema,
  StatementClaimSchema,
  lieProposition,
  parseInterrogationProfile,
  parseQuestionCatalogue,
  type InterrogationProfile,
  type QuestionCatalogue,
} from "./interrogation-authoring.ts";
import { hashInterrogationProfile, hashQuestionCatalogue } from "./interrogation-authoring.identity.ts";
import { parseNpcKnowledge, type NpcKnowledgeSnapshot } from "./npc-knowledge.ts";
import { parseAccusationChallenge, type AccusationChallenge } from "./accusation-challenge.ts";
import { parseCaseProofProfile, type CaseProofProfile } from "./case-solvability.ts";
import { PLAYER_REF_KINDS, PLAYER_REF_PROFILE, PlayerRefSchema, RefSaltSchema, buildPlayerRefIndex, type ResolvedEntity } from "./player-ref.ts";
import {
  hashChallengeComponent,
  hashInitialSetup,
  hashNpcBundle,
  hashNpcSnapshot,
  hashPackage,
  hashProofProfile,
  hashPublicContent,
  hashRefs,
  hashReleaseContext,
  hashReleaseManifest,
  serializeSessionJson,
  utf8Length,
  validateSessionJson,
} from "./case-package.identity.ts";

// Exact, immutable case package (MYST-SESSION-0001A §2). resolveCasePackage is the only identity
// boundary: it parses every component with its real parser, recomputes every binding and hash,
// copies a fully verified PlayerRef mapping and fails atomically with findings, never partially.
// ResolvedCasePackage is trusted-only: it refuses JSON serialization and never goes to a player.

export const PACKAGE_LIMITS = Object.freeze({
  rawBytes: 2 * 1024 * 1024,
  maxDepth: 32,
  maxNodes: 100_000,
  entities: 256,
  evidence: 64,
  npcs: 16,
  questions: 128,
  rulesPerNpc: 128,
  labels: 256,
  questionTexts: 2048,
  publicRules: 64,
  textMax: 1000,
  briefMax: 4000,
  releaseManifestBytes: 256 * 1024,
});

// v1: every NPC statement is sincere. v2 adds authored lies (interrogation rule act "lie"); a v1
// package with a lie rule is rejected, so v1 packages and their identities stay exactly as they were.
export const RULESET_VERSIONS = ["mystery-session-v1", "mystery-session-v2"] as const;
export type RulesetVersion = (typeof RULESET_VERSIONS)[number];
const KINDS = PLAYER_REF_KINDS;

export type EntityRef = { readonly kind: (typeof KINDS)[number]; readonly id: string };
export type CasePackageIdentity = {
  readonly schemaVersion: 1;
  readonly packageHash: string;
  readonly rulesetVersion: RulesetVersion;
};
export type InitialSetup = { readonly schemaVersion: 1; readonly known: readonly EntityRef[] };
export type PackageRefSource = {
  readonly caseId: string;
  readonly truthHash: string;
  readonly config: { readonly profile: string; readonly saltHex: string };
  readonly refFor: (kind: EntityRef["kind"], id: string) => string | null;
  readonly resolve: (ref: string) => ResolvedEntity | null;
};

const EntityRefSchema = z.strictObject({ kind: z.enum(KINDS), id: z.string() });
const ShortText = PlayerTextSchema;
const BriefText = z.string().superRefine((text, ctx) => {
  // PlayerText rules T2-T6 without its 1000-unit cap; the brief may hold 4000 UTF-16 units.
  if (text.length > PACKAGE_LIMITS.briefMax) ctx.addIssue({ code: "custom", message: "Brief is too long" });
  const checked = PlayerTextSchema.safeParse(text);
  for (const issue of checked.success ? [] : checked.error.issues) {
    if (issue.code !== "too_big") ctx.addIssue({ code: "custom", message: issue.message });
  }
});

const PublicContentSchema = z.strictObject({
  schemaVersion: z.literal(1),
  title: ShortText,
  brief: BriefText,
  challengeQuestion: ShortText,
  labels: z.array(z.strictObject({ entity: EntityRefSchema, label: ShortText, role: ShortText.nullable() })).max(PACKAGE_LIMITS.labels),
  questionTexts: z
    .array(z.strictObject({ npc: z.string(), questionId: QuestionIdSchema, text: ShortText }))
    .max(PACKAGE_LIMITS.questionTexts),
  publicRules: z.array(z.strictObject({ id: z.string().regex(/^[a-z][a-z0-9:_-]{0,63}$/), text: ShortText })).max(PACKAGE_LIMITS.publicRules),
  // Narrated resolution, shown to the player only after a solving accusation. Optional; part of
  // publicContentHash and therefore of the release context and the package identity.
  epilogue: BriefText.optional(),
});
export type PublicContent = DeepReadonly<z.output<typeof PublicContentSchema>>;

const PackageInputSchema = z.strictObject({
  schemaVersion: z.literal(1),
  rulesetVersion: z.enum(RULESET_VERSIONS),
  truth: z.unknown(),
  solution: z.unknown(),
  access: z.unknown(),
  presentation: z.unknown(),
  catalogue: z.unknown(),
  npcs: z.array(z.strictObject({ snapshot: z.unknown(), profile: z.unknown() })),
  initial: z.strictObject({ schemaVersion: z.literal(1), known: z.array(EntityRefSchema) }),
  challenge: z.unknown(),
  publicContent: z.unknown(),
  proof: z.strictObject({ profile: z.unknown(), releaseManifest: z.string() }).nullable(),
});

export type ResolvedCasePackage = {
  readonly identity: CasePackageIdentity;
  readonly truth: CaseTruth;
  readonly solution: CaseSolution;
  readonly access: EvidenceAccessMap;
  readonly presentation: EvidencePresentation;
  readonly catalogue: QuestionCatalogue;
  readonly npcs: readonly { readonly snapshot: NpcKnowledgeSnapshot; readonly profile: InterrogationProfile }[];
  readonly initial: InitialSetup;
  readonly challenge: AccusationChallenge;
  readonly publicContent: PublicContent;
  readonly proof: null | { readonly profile: CaseProofProfile; readonly releaseManifest: string; readonly releaseHash: string };
  readonly refs: {
    readonly caseId: string;
    readonly truthHash: string;
    readonly refFor: (kind: EntityRef["kind"], id: string) => string | null;
    readonly resolve: (ref: string) => ResolvedEntity | null;
  };
  readonly toJSON: () => never;
};

export type PackageFinding = {
  readonly code: "SHAPE" | "BINDING" | "REFERENCE" | "REF_MAPPING" | "LIMIT" | "PROOF_BINDING" | "RULESET" | "INSINCERE_LIE";
  readonly path: readonly (string | number)[];
};
export type PackageResolution =
  | { readonly ok: true; readonly package: ResolvedCasePackage }
  | { readonly ok: false; readonly findings: readonly PackageFinding[] };

/** Thrown inside resolve to abort atomically; never escapes it. */
class Rejected {
  constructor(readonly findings: PackageFinding[]) {}
}
const reject = (code: PackageFinding["code"], path: (string | number)[] = []): never => {
  throw new Rejected([{ code, path }]);
};

const BINDING_FIELDS = new Set(["caseId", "truthHash", "solutionHash", "catalogueHash"]);

/** Runs a real component parser; binding issues become BINDING, npcId issues REFERENCE, the rest SHAPE. */
function component<T>(name: string | (string | number)[], parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    if (!(error instanceof z.ZodError)) throw error;
    const prefix = Array.isArray(name) ? name : [name];
    throw new Rejected(
      error.issues.map((issue) => {
        const head = issue.path[0];
        const code = typeof head === "string" && BINDING_FIELDS.has(head) ? "BINDING" : head === "npcId" ? "REFERENCE" : "SHAPE";
        return { code, path: [...prefix, ...(issue.path as (string | number)[])] };
      }),
    );
  }
}

const rawLength = (value: unknown): number => (Array.isArray(value) ? value.length : 0);
const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>)[key] : undefined;

/** Byte, depth, node and collection budgets before any zod parse or semantic validation. */
function checkRawLimits(input: unknown): void {
  const json = validateSessionJson(input, PACKAGE_LIMITS);
  if (!json.ok) reject(json.code, [...json.path]);
  if (utf8Length(serializeSessionJson(input)) > PACKAGE_LIMITS.rawBytes) reject("LIMIT");
  const truth = field(input, "truth");
  const entities = ["persons", "locations", "items", "events", "evidence"].reduce((n, key) => n + rawLength(field(truth, key)), 0);
  if (entities > PACKAGE_LIMITS.entities) reject("LIMIT", ["truth"]);
  if (rawLength(field(truth, "evidence")) > PACKAGE_LIMITS.evidence) reject("LIMIT", ["truth", "evidence"]);
  if (rawLength(field(input, "npcs")) > PACKAGE_LIMITS.npcs) reject("LIMIT", ["npcs"]);
  if (rawLength(field(field(input, "catalogue"), "questions")) > PACKAGE_LIMITS.questions) reject("LIMIT", ["catalogue", "questions"]);
  if (rawLength(field(field(input, "initial"), "known")) > PACKAGE_LIMITS.entities) reject("LIMIT", ["initial", "known"]);
  (rawLength(field(input, "npcs")) > 0 ? (field(input, "npcs") as unknown[]) : []).forEach((npc, i) => {
    if (rawLength(field(field(npc, "profile"), "rules")) > PACKAGE_LIMITS.rulesPerNpc) reject("LIMIT", ["npcs", i, "profile", "rules"]);
  });
  const manifest = field(field(input, "proof"), "releaseManifest");
  if (typeof manifest === "string" && utf8Length(manifest) > PACKAGE_LIMITS.releaseManifestBytes) reject("LIMIT", ["proof", "releaseManifest"]);
}

const entityKey = (kind: string, id: string) => `${kind}|${id}`;

function entityKeys(truth: CaseTruth): Set<string> {
  return new Set([
    ...truth.persons.map((e) => entityKey("person", e.id)),
    ...truth.locations.map((e) => entityKey("location", e.id)),
    ...truth.items.map((e) => entityKey("item", e.id)),
    ...truth.events.map((e) => entityKey("event", e.id)),
    ...truth.evidence.map((e) => entityKey("evidence", e.id)),
  ]);
}

function checkInitial(initial: InitialSetup, entities: ReadonlySet<string>): void {
  const seen = new Set<string>();
  initial.known.forEach((e, i) => {
    const key = entityKey(e.kind, e.id);
    if (!entities.has(key) || seen.has(key)) reject("REFERENCE", ["initial", "known", i]);
    seen.add(key);
  });
}

function checkPublicContent(content: PublicContent, entities: ReadonlySet<string>, pairs: ReadonlySet<string>): void {
  const labels = new Set<string>();
  content.labels.forEach(({ entity }, i) => {
    const key = entityKey(entity.kind, entity.id);
    if (!entities.has(key) || labels.has(key)) reject("REFERENCE", ["publicContent", "labels", i]);
    labels.add(key);
  });
  const texts = new Set<string>();
  content.questionTexts.forEach(({ npc, questionId }, i) => {
    const key = `${npc}|${questionId}`;
    if (!pairs.has(key) || texts.has(key)) reject("REFERENCE", ["publicContent", "questionTexts", i]);
    texts.add(key);
  });
  if (texts.size !== pairs.size) reject("REFERENCE", ["publicContent", "questionTexts"]);
  const rules = new Set<string>();
  content.publicRules.forEach(({ id }, i) => {
    if (rules.has(id)) reject("REFERENCE", ["publicContent", "publicRules", i]);
    rules.add(id);
  });
}

type Mapping = { readonly kind: EntityRef["kind"]; readonly id: string; readonly ref: string }[];

/** Recomputes the real MYST-0001 index from the claimed salt and verifies the source against it. */
function verifyRefs(source: PackageRefSource, truth: CaseTruth, truthHash: string): Mapping {
  if (source.caseId !== truth.caseId || source.truthHash !== truthHash) reject("REF_MAPPING", ["refs"]);
  if (source.config.profile !== PLAYER_REF_PROFILE || !RefSaltSchema.safeParse(source.config.saltHex).success) {
    reject("SHAPE", ["refs", "config"]);
  }
  const built = buildPlayerRefIndex(truth, source.config.saltHex);
  if (!built.success) return reject(built.code === "REF_SALT_INVALID" ? "SHAPE" : "REF_MAPPING", ["refs"]);
  const used = new Set<string>();
  const mapping: Mapping = [];
  for (const entry of built.index.entries) {
    const ref = source.refFor(entry.kind, entry.id);
    if (typeof ref !== "string" || !PlayerRefSchema.safeParse(ref).success || ref !== entry.ref || used.has(ref)) {
      reject("REF_MAPPING", ["refs", entry.kind, entry.id]);
    }
    const back = source.resolve(ref as string);
    if (back === null || back.kind !== entry.kind || back.id !== entry.id) reject("REF_MAPPING", ["refs", entry.kind, entry.id]);
    used.add(ref as string);
    mapping.push(Object.freeze({ kind: entry.kind, id: entry.id, ref: ref as string }));
  }
  return mapping;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

const notSerializable = (): never => {
  throw new TypeError("ResolvedCasePackage is trusted-only and not serializable");
};

function resolve(rawInput: unknown, source: PackageRefSource): ResolvedCasePackage {
  checkRawLimits(rawInput);
  const shaped = PackageInputSchema.safeParse(rawInput);
  if (!shaped.success) {
    throw new Rejected(shaped.error.issues.map((issue) => ({ code: "SHAPE", path: issue.path as (string | number)[] })));
  }
  const input = structuredClone(shaped.data);

  const truth = component("truth", () => parseCaseTruth(input.truth));
  if (validateCaseSemantics(truth).findings.length > 0) reject("SHAPE", ["truth"]);
  const truthHash = hashCaseTruth(truth);
  const solution = component("solution", () => parseCaseSolution(input.solution, truth));
  const access = component("access", () => parseEvidenceAccessMap(input.access, truth));
  const presentation = component("presentation", () => parseEvidencePresentation(input.presentation, truth));
  const catalogue = component("catalogue", () => parseQuestionCatalogue(input.catalogue, truth));
  const challenge = component("challenge", () => parseAccusationChallenge(input.challenge, truth, solution));

  const npcIds = new Set<string>();
  const npcs = input.npcs.map(({ snapshot: rawSnapshot, profile: rawProfile }, i) => {
    const boundSolution = field(rawSnapshot, "solutionHash") === null ? null : solution;
    const snapshot = component(["npcs", i, "snapshot"], () => parseNpcKnowledge(rawSnapshot, truth, boundSolution));
    const profile = component(["npcs", i, "profile"], () => parseInterrogationProfile(rawProfile, truth, catalogue));
    if (profile.npcId !== snapshot.npcId) reject("BINDING", ["npcs", i, "profile", "npcId"]);
    profile.rules.forEach((rule, j) => {
      if (rule.act !== "lie") return;
      const path = ["npcs", i, "profile", "rules", j];
      if (input.rulesetVersion === "mystery-session-v1") reject("RULESET", [...path, "act"]);
      // A lie is knowingly false: the NPC must hold the true stance as knowledge or belief.
      const proposition = lieProposition(truth, rule.claim)!;
      const own = snapshot.attitudes.find((a) => a.subject.kind === "proposition" && a.subject.id === proposition.id);
      const held = own !== undefined && own.stance.kind !== "uncertain" && own.stance.value === proposition.truth;
      if (!held) reject("INSINCERE_LIE", [...path, "claim"]);
    });
    if (npcIds.has(snapshot.npcId)) reject("REFERENCE", ["npcs", i]);
    npcIds.add(snapshot.npcId);
    return { snapshot, profile };
  });

  const entities = entityKeys(truth);
  const initial: InitialSetup = input.initial;
  checkInitial(initial, entities);
  const publicContent = component("publicContent", () => PublicContentSchema.parse(input.publicContent)) as PublicContent;
  const pairs = new Set(npcs.flatMap(({ profile }) => profile.rules.map((rule) => `${profile.npcId}|${rule.questionId}`)));
  checkPublicContent(publicContent, entities, pairs);

  const mapping = verifyRefs(source, truth, truthHash);
  const config = { profile: source.config.profile, saltHex: source.config.saltHex };

  const releaseContextHash = hashReleaseContext({
    rulesetVersion: input.rulesetVersion,
    truthHash,
    solutionHash: hashCaseSolution(solution),
    accessHash: hashEvidenceAccessMap(access),
    presentationHash: hashEvidencePresentation(presentation),
    catalogueHash: hashQuestionCatalogue(catalogue),
    npcBundleHash: hashNpcBundle(
      npcs.map(({ snapshot, profile }) => ({
        npcId: snapshot.npcId,
        snapshotHash: hashNpcSnapshot(snapshot),
        profileHash: hashInterrogationProfile(profile),
      })),
    ),
    initialHash: hashInitialSetup(initial),
    refsHash: hashRefs({ config, caseId: truth.caseId, truthHash, mapping }),
    challengeHash: hashChallengeComponent(challenge),
    publicContentHash: hashPublicContent(publicContent),
  });

  const forward = new Map(mapping.map((m) => [entityKey(m.kind, m.id), m.ref]));
  const backward = new Map(mapping.map((m) => [m.ref, Object.freeze({ kind: m.kind, id: m.id }) as ResolvedEntity]));
  const refs = {
    caseId: truth.caseId,
    truthHash,
    refFor: (kind: EntityRef["kind"], id: string) => forward.get(entityKey(kind, id)) ?? null,
    resolve: (ref: string) => backward.get(ref) ?? null,
  };
  const context = { truth, solution, presentation, catalogue, npcs, initial, publicContent, resolve: refs.resolve, releaseContextHash };
  const proof = input.proof === null ? null : bindProof(input.proof, context);
  const packageHash = hashPackage({
    rulesetVersion: input.rulesetVersion,
    releaseContextHash,
    releaseHash: proof?.releaseHash ?? null,
    proofHash: proof?.proofHash ?? null,
  });

  return deepFreeze({
    identity: { schemaVersion: 1, packageHash, rulesetVersion: input.rulesetVersion },
    truth,
    solution,
    access,
    presentation,
    catalogue,
    npcs,
    initial,
    challenge,
    publicContent,
    proof: proof === null ? null : { profile: proof.profile, releaseManifest: proof.releaseManifest, releaseHash: proof.releaseHash },
    refs,
    toJSON: notSerializable,
  });
}

// ---------- Proof binding (§2 "Proof-Bindung", annex forge-release-proof-v1) ----------
// Binding only: the resolver parses the ProofProfile with the real SOL parser, validates the
// release manifest and its certificateData as private authoring data and binds the hashes. It
// never executes a witness or the checker and never claims "solvable".

const ADAPTER_VERSION = "forge-release-proof-v1";
const MAX_EVENT_BYTES = 16 * 1024;
const LocalId = z.string().regex(/^[a-z][a-z0-9:_-]{0,63}$/);
const Ref = PlayerRefSchema;
const Affirmation = z.enum(["affirms", "denies"]);
const PropositionLiteral = z.strictObject({ kind: z.literal("proposition"), propositionId: z.string(), value: z.boolean() });
const ProofLiteral = z.discriminatedUnion("kind", [
  PropositionLiteral,
  z.strictObject({ kind: z.literal("conclusion"), conclusionId: z.string(), value: z.boolean() }),
]);
// Claims stay unknown here and are translated field by field in claimOf (exact inverse ref mapping).
const PlayerReportSchema = z.strictObject({
  claim: z.unknown(),
  stance: Affirmation,
  source: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("observation") }),
    z.strictObject({ kind: z.literal("testimony"), person: Ref }),
  ]),
});
const ReportSelectorSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("npc"), questionId: QuestionIdSchema, claim: z.unknown(), stance: Affirmation }),
  // V2: what the NPC admits when confronted with this evidence over this question.
  z.strictObject({ kind: z.literal("admission"), questionId: QuestionIdSchema, evidenceId: z.string(), claim: z.unknown(), stance: Affirmation }),
  z.strictObject({ kind: z.literal("testimony"), evidenceId: z.string(), report: PlayerReportSchema }),
]);
const Alternatives = <T extends z.ZodType>(item: T) => z.array(item).min(1).max(16);
const PremiseMapSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    id: LocalId,
    kind: z.literal("OBSERVED"),
    literal: PropositionLiteral,
    source: z.strictObject({ kind: z.literal("evidence"), evidenceId: z.string() }),
    alternatives: Alternatives(z.strictObject({ report: PlayerReportSchema, licenseRuleId: z.string() })),
  }),
  z.strictObject({ id: LocalId, kind: z.literal("REPORTED_BY_NPC"), npcId: z.string(), literal: ProofLiteral, alternatives: Alternatives(ReportSelectorSchema) }),
  z.strictObject({ id: LocalId, kind: z.literal("ENTITY_AWARENESS"), entity: EntityRefSchema }),
  z.strictObject({
    id: LocalId,
    kind: z.literal("PUBLIC_RULE"),
    ruleId: z.string(),
    afterObservations: z.array(LocalId).max(64),
    rules: z.array(z.strictObject({ edgeId: LocalId, allOf: z.array(LocalId).min(1), yields: ProofLiteral })).min(1).max(128),
  }),
]);
// SessionEvent exactly as Session B §4: refs only, no seq, no receipts, no canonical aliases.
const SessionEventSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("investigate"), action: z.enum(["search_location", "examine_item", "examine_person"]), target: Ref }),
  z.strictObject({ type: z.literal("interrogate"), npc: Ref, questionId: QuestionIdSchema }),
  z.strictObject({ type: z.literal("confront"), npc: Ref, questionId: QuestionIdSchema, evidence: Ref }),
  z.strictObject({ type: z.literal("accuse"), literals: z.array(z.strictObject({ claim: z.unknown(), value: z.boolean() })).max(32) }),
]);
const ManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  releaseContextHash: z.string().regex(/^[0-9a-f]{64}$/),
  adapterVersion: z.literal(ADAPTER_VERSION),
  certificateData: z.strictObject({
    schemaVersion: z.literal(1),
    steps: z.array(z.strictObject({ stepId: z.string().regex(/^[\x21-\x7e]{1,128}$/), event: SessionEventSchema })).max(256),
    observations: z.array(PremiseMapSchema).max(64),
  }),
});
type Certificate = z.output<typeof ManifestSchema>["certificateData"];
type PremiseMap = Certificate["observations"][number];
type PlayerReportInput = z.output<typeof PlayerReportSchema>;
type Literal = z.output<typeof ProofLiteral>;

type ProofContext = {
  readonly truth: CaseTruth;
  readonly solution: CaseSolution;
  readonly presentation: EvidencePresentation;
  readonly catalogue: QuestionCatalogue;
  readonly npcs: readonly { readonly profile: InterrogationProfile }[];
  readonly initial: InitialSetup;
  readonly publicContent: PublicContent;
  readonly resolve: (ref: string) => ResolvedEntity | null;
  readonly releaseContextHash: string;
};
type BoundProof = { profile: CaseProofProfile; releaseManifest: string; releaseHash: string; proofHash: string };
type Path = (string | number)[];

const C = serializeSessionJson;
const PROFILE: Path = ["proof", "profile"];
const MANIFEST: Path = ["proof", "releaseManifest"];
const CERT: Path = [...MANIFEST, "certificateData"];

function parseProfile(raw: unknown, truth: CaseTruth, solution: CaseSolution): CaseProofProfile {
  try {
    return parseCaseProofProfile(raw, truth, solution);
  } catch (error) {
    if (!(error instanceof z.ZodError)) throw error;
    throw new Rejected(
      error.issues.map((issue) => ({
        code: issue.path[0] === "bindings" ? "PROOF_BINDING" : "SHAPE",
        path: [...PROFILE, ...(issue.path as Path)],
      })),
    );
  }
}

/** Exact canonical C text with the strict envelope; never evaluated, only JSON-parsed. */
function parseManifest(text: string): z.output<typeof ManifestSchema> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return reject("SHAPE", MANIFEST);
  }
  const json = validateSessionJson(raw, PACKAGE_LIMITS);
  if (!json.ok) reject(json.code, [...MANIFEST, ...json.path]);
  if (C(raw) !== text) reject("SHAPE", MANIFEST); // registry: the manifest is canonical C bytes
  const parsed = ManifestSchema.safeParse(raw);
  if (!parsed.success) throw new Rejected(parsed.error.issues.map((i) => ({ code: "SHAPE", path: [...MANIFEST, ...(i.path as Path)] })));
  return parsed.data;
}

// PlayerClaim field ↔ canonical field and entity kind (annex §2: person↔personId, ...).
const PLAYER_FIELDS: Readonly<Record<string, readonly [string, EntityRef["kind"]]>> = Object.assign(Object.create(null), {
  person: ["personId", "person"],
  location: ["locationId", "location"],
  item: ["itemId", "item"],
  event: ["eventId", "event"],
  causeEvent: ["causeEventId", "event"],
});

/** Translates a ref-based player claim into its canonical claim; wrong kinds or unknown refs fail. */
function claimOf(raw: unknown, schema: z.ZodType, resolveRef: ProofContext["resolve"], path: Path): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return reject("SHAPE", path);
  const canonical: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const target = PLAYER_FIELDS[key];
    if (target === undefined) {
      if (key.endsWith("Id")) reject("SHAPE", [...path, key]); // canonical-ID alias
      canonical[key] = value;
      continue;
    }
    const entity = typeof value === "string" ? resolveRef(value) : null;
    if (entity === null || entity.kind !== target[1]) reject("REFERENCE", [...path, key]);
    canonical[target[0]] = entity!.id;
  }
  const parsed = schema.safeParse(canonical);
  return parsed.success ? parsed.data : reject("SHAPE", path);
}

/** The literal's own catalog claim must be exactly this claim, and no alias may share it. */
function bindLiteral(literal: Literal, claim: unknown, { truth, solution }: ProofContext, path: Path): void {
  const pool: readonly { readonly id: string; readonly claim: unknown }[] = literal.kind === "proposition" ? truth.propositions : solution.conclusions;
  const id = literal.kind === "proposition" ? literal.propositionId : literal.conclusionId;
  const own = pool.find((entry) => entry.id === id);
  if (own === undefined) reject("REFERENCE", [...path, "literal"]);
  const key = C(claim);
  if (C(own!.claim) !== key || pool.filter((entry) => C(entry.claim) === key).length !== 1) reject("PROOF_BINDING", path);
}

/** A report selector must name one exact authored report of exactly that evidence. */
function reportOf(report: PlayerReportInput, evidenceId: string, ctx: ProofContext, path: Path): unknown {
  const claim = claimOf(report.claim, ClaimSchema, ctx.resolve, [...path, "claim"]);
  let source: object = report.source;
  if (report.source.kind === "testimony") {
    const person = ctx.resolve(report.source.person);
    if (person === null || person.kind !== "person") reject("REFERENCE", [...path, "source", "person"]);
    source = { kind: "testimony", personId: person!.id };
  }
  const entry = ctx.presentation.entries.find((e) => e.evidenceId === evidenceId);
  const wanted = C({ claim, stance: report.stance, source });
  if (entry === undefined || !entry.reports.some((r) => C(r) === wanted)) reject("PROOF_BINDING", path);
  return claim;
}

function checkUnique(values: readonly string[], path: Path): void {
  const seen = new Set<string>();
  values.forEach((value, i) => (seen.has(value) ? reject("PROOF_BINDING", [...path, i]) : seen.add(value)));
}

/** Entities that can ever enter Known: initial, released evidence, presentation and answer mentions. */
function awarenessReach(ctx: ProofContext): Set<string> {
  const reach = new Set(ctx.initial.known.map((e) => entityKey(e.kind, e.id)));
  ctx.truth.evidence.forEach((e) => reach.add(entityKey("evidence", e.id)));
  ctx.presentation.entries.forEach((entry) => entry.mentions.forEach((m) => reach.add(entityKey(m.kind, m.id))));
  for (const { profile } of ctx.npcs) {
    for (const rule of profile.rules) {
      if (rule.act === "decline") continue;
      const question = ctx.catalogue.questions.find((q) => q.id === rule.questionId);
      [...(question?.mentions ?? []), ...rule.reveal, { kind: "person" as const, id: profile.npcId }].forEach((e) => reach.add(entityKey(e.kind, e.id)));
    }
    for (const c of profile.confrontations ?? []) c.reveal.forEach((e) => reach.add(entityKey(e.kind, e.id)));
  }
  return reach;
}

function checkPremise(o: PremiseMap, i: number, ctx: ProofContext, kinds: ReadonlyMap<string, string>, entities: ReadonlySet<string>): void {
  const path = [...CERT, "observations", i];
  const evidenceExists = (id: string) => ctx.truth.evidence.some((e) => e.id === id);
  const ruleExists = (id: string) => ctx.publicContent.publicRules.some((r) => r.id === id);
  if (o.kind === "OBSERVED") {
    if (!evidenceExists(o.source.evidenceId)) reject("REFERENCE", [...path, "source", "evidenceId"]);
    checkUnique(o.alternatives.map(C), [...path, "alternatives"]);
    o.alternatives.forEach((alt, j) => {
      const at = [...path, "alternatives", j];
      if (alt.report.source.kind !== "observation") reject("PROOF_BINDING", [...at, "report", "source"]);
      if ((alt.report.stance === "affirms") !== o.literal.value) reject("PROOF_BINDING", [...at, "report", "stance"]);
      if (!ruleExists(alt.licenseRuleId)) reject("REFERENCE", [...at, "licenseRuleId"]);
      bindLiteral(o.literal, reportOf(alt.report, o.source.evidenceId, ctx, [...at, "report"]), ctx, at);
    });
  } else if (o.kind === "REPORTED_BY_NPC") {
    if (!ctx.truth.persons.some((p) => p.id === o.npcId)) reject("REFERENCE", [...path, "npcId"]);
    checkUnique(o.alternatives.map(C), [...path, "alternatives"]);
    o.alternatives.forEach((alt, j) => {
      const at = [...path, "alternatives", j];
      if (alt.kind === "npc") {
        const rule = ctx.npcs.find((n) => n.profile.npcId === o.npcId)?.profile.rules.find((r) => r.questionId === alt.questionId);
        if (rule === undefined || rule.act === "decline") return reject("REFERENCE", [...at, "questionId"]);
        const claim = claimOf(alt.claim, StatementClaimSchema, ctx.resolve, [...at, "claim"]);
        if (C(claim) !== C(rule.claim)) reject("PROOF_BINDING", [...at, "claim"]);
        if (rule.act === "lie" && alt.stance !== rule.stance) reject("PROOF_BINDING", [...at, "stance"]);
        if ((alt.stance === "affirms") !== o.literal.value) reject("PROOF_BINDING", [...at, "stance"]);
        return bindLiteral(o.literal, claim, ctx, at);
      }
      if (alt.kind === "admission") {
        const profile = ctx.npcs.find((n) => n.profile.npcId === o.npcId)?.profile;
        const rule = profile?.confrontations?.find((c) => c.questionId === alt.questionId && c.evidenceId === alt.evidenceId);
        if (rule === undefined) return reject("REFERENCE", [...at, "evidenceId"]);
        const claim = claimOf(alt.claim, StatementClaimSchema, ctx.resolve, [...at, "claim"]);
        if (C(claim) !== C(rule.claim)) reject("PROOF_BINDING", [...at, "claim"]);
        if ((alt.stance === "affirms") !== o.literal.value) reject("PROOF_BINDING", [...at, "stance"]);
        return bindLiteral(o.literal, claim, ctx, at);
      }
      if (!evidenceExists(alt.evidenceId)) reject("REFERENCE", [...at, "evidenceId"]);
      const source = alt.report.source;
      if (source.kind !== "testimony" || C(ctx.resolve(source.person)) !== C({ kind: "person", id: o.npcId })) {
        reject("PROOF_BINDING", [...at, "report", "source"]);
      }
      if ((alt.report.stance === "affirms") !== o.literal.value) reject("PROOF_BINDING", [...at, "report", "stance"]);
      bindLiteral(o.literal, reportOf(alt.report, alt.evidenceId, ctx, [...at, "report"]), ctx, at);
    });
  } else if (o.kind === "ENTITY_AWARENESS") {
    const key = entityKey(o.entity.kind, o.entity.id);
    if (!entityKeys(ctx.truth).has(key)) reject("REFERENCE", [...path, "entity"]);
    if (!entities.has(key)) reject("PROOF_BINDING", [...path, "entity"]);
  } else {
    if (!ruleExists(o.ruleId)) reject("REFERENCE", [...path, "ruleId"]);
    checkUnique(o.afterObservations, [...path, "afterObservations"]);
    o.afterObservations.forEach((id, j) => {
      const kind = kinds.get(id);
      if (kind === undefined || kind === "PUBLIC_RULE") reject("PROOF_BINDING", [...path, "afterObservations", j]);
    });
  }
}

const ACTION_TARGET = { search_location: "location", examine_item: "item", examine_person: "person" } as const;

function checkEvent(event: Certificate["steps"][number]["event"], ctx: ProofContext, path: Path): void {
  if (utf8Length(C(event)) > MAX_EVENT_BYTES) reject("LIMIT", path);
  const expect = (ref: string, kind: EntityRef["kind"], at: Path) => ctx.resolve(ref)?.kind === kind || reject("REFERENCE", at);
  if (event.type === "investigate") expect(event.target, ACTION_TARGET[event.action], [...path, "target"]);
  else if (event.type === "interrogate" || event.type === "confront") {
    expect(event.npc, "person", [...path, "npc"]);
    if (event.type === "confront") expect(event.evidence, "evidence", [...path, "evidence"]);
    if (!ctx.catalogue.questions.some((q) => q.id === event.questionId)) reject("REFERENCE", [...path, "questionId"]);
  } else event.literals.forEach((l, k) => claimOf(l.claim, ConclusionClaimSchema, ctx.resolve, [...path, "literals", k, "claim"]));
}

/** Payload a premise map must share with its same-ID profile observation (no selector data). */
function expected(o: PremiseMap): unknown {
  if (o.kind === "OBSERVED") return { id: o.id, kind: o.kind, literal: o.literal, source: o.source };
  if (o.kind === "REPORTED_BY_NPC") return { id: o.id, kind: o.kind, npcId: o.npcId, literal: o.literal };
  if (o.kind === "ENTITY_AWARENESS") return { id: o.id, kind: o.kind, entity: o.entity };
  return { id: o.id, kind: o.kind, rules: o.rules };
}

function checkCertificate(cert: Certificate, profile: CaseProofProfile, ctx: ProofContext): void {
  checkUnique(cert.steps.map((s) => s.stepId), [...CERT, "steps"]);
  if (C(cert.steps.map((s) => s.stepId)) !== C(profile.witnessStepIds)) reject("PROOF_BINDING", [...CERT, "steps"]);
  cert.steps.forEach((step, i) => checkEvent(step.event, ctx, [...CERT, "steps", i, "event"]));

  checkUnique(cert.observations.map((o) => o.id), [...CERT, "observations"]);
  const authored = new Map(profile.observations.map((o) => [o.id, C(o)]));
  if (authored.size !== cert.observations.length) reject("PROOF_BINDING", [...CERT, "observations"]);
  cert.observations.forEach((o, i) => {
    if (authored.get(o.id) !== C(expected(o))) reject("PROOF_BINDING", [...CERT, "observations", i]);
  });
  const kinds = new Map(cert.observations.map((o) => [o.id, o.kind]));
  const entities = awarenessReach(ctx);
  cert.observations.forEach((o, i) => checkPremise(o, i, ctx, kinds, entities));
}

function bindProof(proof: { profile: unknown; releaseManifest: string }, ctx: ProofContext): BoundProof {
  const profile = parseProfile(proof.profile, ctx.truth, ctx.solution);
  const manifest = parseManifest(proof.releaseManifest);
  if (manifest.releaseContextHash !== ctx.releaseContextHash) reject("PROOF_BINDING", [...MANIFEST, "releaseContextHash"]);
  const releaseHash = hashReleaseManifest(proof.releaseManifest);
  if (profile.bindings.releaseHash !== releaseHash) reject("PROOF_BINDING", [...PROFILE, "bindings", "releaseHash"]);
  checkCertificate(manifest.certificateData, profile, ctx);
  return { profile, releaseManifest: proof.releaseManifest, releaseHash, proofHash: hashProofProfile(profile) };
}

/** Verifies and binds one exact package. Atomic: findings and no package, or the package. */
export function resolveCasePackage(input: unknown, source: PackageRefSource): PackageResolution {
  try {
    return Object.freeze({ ok: true, package: resolve(input, source) });
  } catch (error) {
    if (!(error instanceof Rejected)) throw error;
    return deepFreeze({ ok: false, findings: error.findings });
  }
}
