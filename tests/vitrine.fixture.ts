import { readFileSync } from "node:fs";
import { parseCaseTruth, type CaseTruth } from "../src/domain/case-truth.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import { parseCaseSolution, type CaseSolution } from "../src/domain/case-solution.ts";
import { hashCaseSolution } from "../src/domain/case-solution.identity.ts";
import { parseEvidenceAccessMap, resolveInvestigation, type EvidenceAccessMap, type InvestigationAction } from "../src/domain/evidence-access.ts";
import { parseEvidencePresentation, releaseEvidence, type EvidenceObservation, type EvidencePresentation } from "../src/domain/evidence-presentation.ts";
import {
  parseInterrogationProfile,
  parseQuestionCatalogue,
  type EntityRef,
  type InterrogationProfile,
  type QuestionCatalogue,
} from "../src/domain/interrogation-authoring.ts";
import { parseNpcKnowledge, type NpcKnowledgeSnapshot } from "../src/domain/npc-knowledge.ts";
import { interrogate, type InterrogationObservation, type PlayerRefTranslator } from "../src/domain/interrogation.ts";
import { parseAccusationChallenge, type AccusationChallenge } from "../src/domain/accusation-challenge.ts";
import { buildPlayerRefIndex, playerRefFor, resolvePlayerRef, type PlayerRefIndex } from "../src/domain/player-ref.ts";
import {
  parseCaseProofProfile,
  type CaseProofProfile,
  type ReleasedObservation,
  type WitnessReplay,
  type WitnessReplayResult,
} from "../src/domain/case-solvability.ts";
import { resolveCasePackage, type PackageResolution } from "../src/domain/case-package.ts";
import { hashReleaseManifest, serializeSessionJson } from "../src/domain/case-package.identity.ts";
import { refSource, releaseContextOf } from "./case-package.fixture.ts";

// "Die leere Vitrine" (case:leere-vitrine-v1), loaded from tests/fixtures/vitrine with the real parsers.
// truth.json and solution.json are byte-identical to the case pack originals; challenge, presentation
// and initial setup are the payloads of DIE-LEERE-VITRINE-FINAL-PACK. PRIVATE: contains the answer key.

export const VITRINE_NPCS = ["lina", "max", "nora", "oskar"] as const;
export type VitrineNpc = (typeof VITRINE_NPCS)[number];

/** Pinned hashes of the unchanged originals (DIE-LEERE-VITRINE-PACKAGE-MANIFEST). */
export const VITRINE_TRUTH_HASH = "77b2ec917f721522e2d623fe74cd7158bc9311216d2e42c865f5879cdf71bbef";
export const VITRINE_SOLUTION_HASH = "52b7912e999d19866fbdf7c6cb4b3cd76c50c74af8f11d39f0e89c4e3c10adcf";
export const VITRINE_TEST_SALT = "5a175a175a175a175a175a175a175a17";

export const vitrineRaw = (name: string): unknown => JSON.parse(readVitrineFile(name));
export const readVitrineFile = (name: string): string => readFileSync(new URL(`./fixtures/vitrine/${name}`, import.meta.url), "utf8");

export type Vitrine = {
  truth: CaseTruth;
  solution: CaseSolution;
  access: EvidenceAccessMap;
  presentation: EvidencePresentation;
  catalogue: QuestionCatalogue;
  profiles: Record<VitrineNpc, InterrogationProfile>;
  snapshots: Record<VitrineNpc, NpcKnowledgeSnapshot>;
  challenge: AccusationChallenge;
  initialKnown: EntityRef[];
  refs: PlayerRefIndex;
  translator: PlayerRefTranslator;
};

export function loadVitrine(): Vitrine {
  const truth = parseCaseTruth(vitrineRaw("truth.json"));
  const solution = parseCaseSolution(vitrineRaw("solution.json"), truth);
  const catalogue = parseQuestionCatalogue(vitrineRaw("questions.json"), truth);
  const perNpc = <T>(parse: (npc: VitrineNpc) => T) =>
    Object.fromEntries(VITRINE_NPCS.map((npc) => [npc, parse(npc)])) as Record<VitrineNpc, T>;
  const built = buildPlayerRefIndex(truth, VITRINE_TEST_SALT);
  if (!built.success) throw new Error(`PlayerRef index: ${built.code}`);
  const refs = built.index;
  const setup = vitrineRaw("initial-setup.json") as { known: EntityRef[] };
  return {
    truth,
    solution,
    access: parseEvidenceAccessMap(vitrineRaw("evidence-access.json"), truth),
    presentation: parseEvidencePresentation(vitrineRaw("evidence-presentation.json"), truth),
    catalogue,
    profiles: perNpc((npc) => parseInterrogationProfile(vitrineRaw(`interrogation-${npc}.json`), truth, catalogue)),
    snapshots: perNpc((npc) => parseNpcKnowledge(vitrineRaw(`npc-${npc}.json`), truth, solution)),
    challenge: parseAccusationChallenge(vitrineRaw("challenge.json"), truth, solution),
    initialKnown: setup.known,
    refs,
    translator: { caseId: truth.caseId, truthHash: hashCaseTruth(truth), refFor: (kind, id) => playerRefFor(refs, kind, id) },
  };
}

const keyOf = (ref: { readonly kind: string; readonly id: string }) => `${ref.kind}|${ref.id}`;

/**
 * Minimal headless host for tests: tracks known entities and discovered evidence, runs the real
 * investigation, release and interrogation functions, and learns only from released mentions.
 * Not the Session A reducer.
 */
export function vitrineHost(v: Vitrine = loadVitrine()) {
  const known = new Map<string, EntityRef>();
  const discovered: string[] = [];
  const learn = (entity: EntityRef) => known.set(keyOf(entity), entity);
  v.initialKnown.forEach(learn);

  const learnRefs = (mentions: readonly { readonly ref: string }[]) => {
    for (const { ref } of mentions) {
      const resolved = resolvePlayerRef(v.refs, ref);
      if (!resolved.success) throw new Error(`Released ref does not resolve: ${ref}`);
      if (resolved.kind !== "evidence") learn({ kind: resolved.kind, id: resolved.id } as EntityRef);
    }
  };

  const investigate = (action: InvestigationAction): EvidenceObservation[] => {
    const result = resolveInvestigation(v.access, [...known.values()], action);
    if (!result.success) throw new Error(`Investigation failed: ${result.code}`);
    const fresh = result.found.filter((id) => !discovered.includes(id));
    return fresh.map((id) => {
      const release = releaseEvidence(v.presentation, id, v.translator);
      if (!release.success) throw new Error(`Release failed: ${release.code}`);
      discovered.push(id);
      learnRefs(release.observation.mentions);
      return release.observation;
    });
  };

  const interrogation = (npc: VitrineNpc, questionId: string) =>
    interrogate({
      truth: v.truth,
      solution: v.solution,
      snapshot: v.snapshots[npc],
      catalogue: v.catalogue,
      profile: v.profiles[npc],
      refs: v.translator,
      known: [...known.values()],
      questionId,
    });

  const ask = (npc: VitrineNpc, questionId: string): InterrogationObservation => {
    const result = interrogation(npc, questionId);
    if (!result.success) throw new Error(`Interrogation failed: ${result.code}`);
    if ("mentions" in result.observation) learnRefs(result.observation.mentions);
    return result.observation;
  };

  return {
    knows: (kind: EntityRef["kind"], id: string) => known.has(`${kind}|${id}`),
    known: () => [...known.values()],
    discovered: () => [...discovered],
    canInvestigate: (action: InvestigationAction) => resolveInvestigation(v.access, [...known.values()], action).success,
    canAsk: (npc: VitrineNpc, questionId: string) => interrogation(npc, questionId).success,
    investigate,
    search: (locationId: string) => investigate({ kind: "search_location", locationId } as InvestigationAction),
    examine: (itemId: string) => investigate({ kind: "examine_item", itemId } as InvestigationAction),
    ask,
  };
}

export type VitrineHost = ReturnType<typeof vitrineHost>;

// ---------- Solvability: release manifest, proof profile and a witness port on the real host ----------

type RefOf = { $playerRefOf: { kind: "person" | "location" | "item" | "event" | "evidence"; id: string } };
type ManifestStep =
  | { stepId: string; event: { type: "investigate"; action: "search_location" | "examine_item"; target: string } }
  | { stepId: string; event: { type: "interrogate"; npc: string; questionId: string } };
type ManifestObservation = ReleasedObservation & {
  alternatives?: { report: unknown }[];
  ruleId?: string;
  afterObservations?: string[];
};
/** After PlayerRef substitution: every ref is a PlayerRef string. */
export type ReleaseManifest = {
  schemaVersion: 1;
  releaseContextHash: string;
  adapterVersion: string;
  certificateData: { schemaVersion: 1; steps: ManifestStep[]; observations: ManifestObservation[] };
};

/** Replaces every {$playerRefOf} with the PlayerRef of this fixture's index. */
function substituteRefs(value: unknown, v: Vitrine): unknown {
  if (Array.isArray(value)) return value.map((x) => substituteRefs(x, v));
  if (typeof value !== "object" || value === null) return value;
  if ("$playerRefOf" in value) {
    const { kind, id } = (value as RefOf).$playerRefOf;
    const ref = v.translator.refFor(kind, id);
    if (ref === null) throw new Error(`No PlayerRef for ${kind} ${id}`);
    return ref;
  }
  return Object.fromEntries(Object.entries(value).map(([k, x]) => [k, substituteRefs(x, v)]));
}

function sortedJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(sortedJson).join(",")}]`;
  if (typeof value !== "object" || value === null) return JSON.stringify(value);
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${sortedJson((value as Record<string, unknown>)[k])}`).join(",")}}`;
}

/** Session A package input (MYST-SESSION-0001A §2) from the fixture files; proof as given. */
export function vitrinePackageInput(proof: { profile: unknown; releaseManifest: string } | null = null): any {
  const setup = vitrineRaw("initial-setup.json");
  return {
    schemaVersion: 1,
    rulesetVersion: "mystery-session-v1",
    truth: vitrineRaw("truth.json"),
    solution: vitrineRaw("solution.json"),
    access: vitrineRaw("evidence-access.json"),
    presentation: vitrineRaw("evidence-presentation.json"),
    catalogue: vitrineRaw("questions.json"),
    npcs: VITRINE_NPCS.map((npc) => ({ snapshot: vitrineRaw(`npc-${npc}.json`), profile: vitrineRaw(`interrogation-${npc}.json`) })),
    initial: setup,
    challenge: vitrineRaw("challenge.json"),
    publicContent: vitrineRaw("public-content.json"),
    proof,
  };
}

/** Real releaseContextHash of the Vitrine package (Session A component hashes, test salt refs). */
export const vitrineReleaseContextHash = (): string => releaseContextOf(vitrinePackageInput(), VITRINE_TEST_SALT);

/** The release manifest with real PlayerRefs, bound to the real releaseContextHash. */
export const vitrineReleaseManifest = (v: Vitrine): ReleaseManifest => ({
  ...(substituteRefs(vitrineRaw("release-manifest.json"), v) as ReleaseManifest),
  releaseContextHash: vitrineReleaseContextHash(),
});

/** The manifest as canonical C text: exactly the bytes forge-release-proof-v1 hashes. */
export const vitrineReleaseManifestText = (v: Vitrine): string => serializeSessionJson(vitrineReleaseManifest(v));

/** releaseHash = SHA-256("forge-session-release-v1\n" + manifest bytes), via Session A. */
export const vitrineReleaseHash = (v: Vitrine): string => hashReleaseManifest(vitrineReleaseManifestText(v));

/** Resolves the complete Vitrine package with its bound proof through resolveCasePackage. */
export function resolveVitrinePackage(v: Vitrine): PackageResolution {
  const profile = vitrineRaw("proof-profile.json") as { bindings: Record<string, string> };
  const input = vitrinePackageInput({
    profile: { ...profile, bindings: { ...profile.bindings, releaseHash: vitrineReleaseHash(v) } },
    releaseManifest: vitrineReleaseManifestText(v),
  });
  return resolveCasePackage(input, refSource(v.truth, VITRINE_TEST_SALT));
}

export function loadVitrineProofProfile(v: Vitrine, overrides: object = {}): CaseProofProfile {
  const input = vitrineRaw("proof-profile.json") as { bindings: Record<string, string> };
  return parseCaseProofProfile(
    { ...input, bindings: { ...input.bindings, releaseHash: vitrineReleaseHash(v) }, ...overrides },
    v.truth,
    v.solution,
  );
}

const payloadOf = ({ alternatives, ruleId, afterObservations, ...payload }: ManifestObservation) => payload as ReleasedObservation;

/**
 * Witness port on the real headless host: replays each step through investigate/release/interrogate
 * on a fresh host. An OBSERVED record is released only if its evidence card was actually released
 * with one of the manifest's alternative reports; a PUBLIC_RULE once all its afterObservations are.
 */
export function vitrineWitness(v: Vitrine, manifest: ReleaseManifest = vitrineReleaseManifest(v)): WitnessReplay {
  const resolveRef = (ref: string) => {
    const resolved = resolvePlayerRef(v.refs, ref);
    if (!resolved.success) throw new Error("unresolved");
    return resolved;
  };
  return (stepIds): WitnessReplayResult => {
    const host = vitrineHost(v);
    const cards = new Map<string, EvidenceObservation>();
    try {
      for (const stepId of stepIds) {
        const step = manifest.certificateData.steps.find((s) => s.stepId === stepId);
        if (step === undefined) return { success: false, code: "INVALID_WITNESS" };
        const { event } = step;
        if (event.type === "interrogate") {
          const npc = VITRINE_NPCS.find((n) => `person:${n}` === resolveRef(event.npc).id);
          if (npc === undefined) return { success: false, code: "INVALID_WITNESS" };
          host.ask(npc, event.questionId);
          continue;
        }
        const target = resolveRef(event.target).id;
        const found = event.action === "search_location" ? host.search(target) : host.examine(target);
        for (const card of found) cards.set(resolveRef(card.evidence).id, card);
      }
    } catch {
      return { success: false, code: "INVALID_WITNESS" };
    }
    const released = new Set<string>();
    const records: ReleasedObservation[] = [];
    for (const o of manifest.certificateData.observations) {
      if (o.kind !== "OBSERVED" || o.source.kind !== "evidence") continue;
      const card = cards.get(o.source.evidenceId);
      const reports = new Set(card?.reports.map(sortedJson) ?? []);
      if (o.alternatives?.some((alt) => reports.has(sortedJson(alt.report)))) {
        released.add(o.id);
        records.push(payloadOf(o));
      }
    }
    for (const o of manifest.certificateData.observations) {
      if (o.kind === "PUBLIC_RULE" && (o.afterObservations ?? []).every((id) => released.has(id))) records.push(payloadOf(o));
    }
    const bindings = { caseId: v.truth.caseId, truthHash: hashCaseTruth(v.truth), solutionHash: hashCaseSolution(v.solution), releaseHash: vitrineReleaseHash(v) };
    return { success: true, bindings, released: records };
  };
}
