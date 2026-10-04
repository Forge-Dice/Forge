import { readFileSync } from "node:fs";
import { parseCaseTruth, type CaseTruth } from "../src/domain/case-truth.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import { parseCaseSolution, type CaseSolution } from "../src/domain/case-solution.ts";
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
