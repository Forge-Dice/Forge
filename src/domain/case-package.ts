import { z } from "zod";
import { parseCaseTruth, type CaseTruth, type DeepReadonly } from "./case-truth.ts";
import { hashCaseTruth } from "./case-truth.identity.ts";
import { validateCaseSemantics } from "./case-semantics.ts";
import { parseCaseSolution, type CaseSolution } from "./case-solution.ts";
import { hashCaseSolution } from "./case-solution.identity.ts";
import { parseEvidenceAccessMap, type EvidenceAccessMap } from "./evidence-access.ts";
import { hashEvidenceAccessMap } from "./evidence-access.identity.ts";
import { PlayerTextSchema, parseEvidencePresentation, type EvidencePresentation } from "./evidence-presentation.ts";
import { hashEvidencePresentation } from "./evidence-presentation.identity.ts";
import {
  QuestionIdSchema,
  parseInterrogationProfile,
  parseQuestionCatalogue,
  type InterrogationProfile,
  type QuestionCatalogue,
} from "./interrogation-authoring.ts";
import { hashInterrogationProfile, hashQuestionCatalogue } from "./interrogation-authoring.identity.ts";
import { parseNpcKnowledge, type NpcKnowledgeSnapshot } from "./npc-knowledge.ts";
import { parseAccusationChallenge, type AccusationChallenge } from "./accusation-challenge.ts";
import { PLAYER_REF_KINDS, PLAYER_REF_PROFILE, PlayerRefSchema, RefSaltSchema, buildPlayerRefIndex, type ResolvedEntity } from "./player-ref.ts";
import {
  hashChallengeComponent,
  hashInitialSetup,
  hashNpcBundle,
  hashNpcSnapshot,
  hashPackage,
  hashPublicContent,
  hashRefs,
  hashReleaseContext,
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

const RULESET_VERSION = "mystery-session-v1";
const KINDS = PLAYER_REF_KINDS;

export type EntityRef = { readonly kind: (typeof KINDS)[number]; readonly id: string };
export type CasePackageIdentity = {
  readonly schemaVersion: 1;
  readonly packageHash: string;
  readonly rulesetVersion: typeof RULESET_VERSION;
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
});
export type PublicContent = DeepReadonly<z.output<typeof PublicContentSchema>>;

const PackageInputSchema = z.strictObject({
  schemaVersion: z.literal(1),
  rulesetVersion: z.literal(RULESET_VERSION),
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
  readonly proof: null | { readonly profile: unknown; readonly releaseManifest: string; readonly releaseHash: string };
  readonly refs: {
    readonly caseId: string;
    readonly truthHash: string;
    readonly refFor: (kind: EntityRef["kind"], id: string) => string | null;
    readonly resolve: (ref: string) => ResolvedEntity | null;
  };
  readonly toJSON: () => never;
};

export type PackageFinding = {
  readonly code: "SHAPE" | "BINDING" | "REFERENCE" | "REF_MAPPING" | "LIMIT" | "PROOF_BINDING";
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
    rulesetVersion: RULESET_VERSION,
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

  const proof = bindProof(input.proof, releaseContextHash);
  const packageHash = hashPackage({
    rulesetVersion: RULESET_VERSION,
    releaseContextHash,
    releaseHash: proof?.releaseHash ?? null,
    proofHash: proof?.proofHash ?? null,
  });

  const forward = new Map(mapping.map((m) => [entityKey(m.kind, m.id), m.ref]));
  const backward = new Map(mapping.map((m) => [m.ref, Object.freeze({ kind: m.kind, id: m.id }) as ResolvedEntity]));
  const refs = {
    caseId: truth.caseId,
    truthHash,
    refFor: (kind: EntityRef["kind"], id: string) => forward.get(entityKey(kind, id)) ?? null,
    resolve: (ref: string) => backward.get(ref) ?? null,
  };
  return deepFreeze({
    identity: { schemaVersion: 1, packageHash, rulesetVersion: RULESET_VERSION },
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

type BoundProof = { profile: unknown; releaseManifest: string; releaseHash: string; proofHash: string };

/** Proof binding is completed with MYST-SOLVABILITY-0001; until then a non-null proof is refused. */
function bindProof(proof: { profile: unknown; releaseManifest: string } | null, releaseContextHash: string): BoundProof | null {
  if (proof === null) return null;
  void releaseContextHash;
  return reject("PROOF_BINDING", ["proof"]);
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
