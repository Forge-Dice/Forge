import { parseCaseTruth, type CaseTruth } from "../src/domain/case-truth.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import { parseCaseSolution } from "../src/domain/case-solution.ts";
import { hashCaseSolution } from "../src/domain/case-solution.identity.ts";
import { parseQuestionCatalogue } from "../src/domain/interrogation-authoring.ts";
import { hashQuestionCatalogue } from "../src/domain/interrogation-authoring.identity.ts";
import { buildPlayerRefIndex, playerRefFor, resolvePlayerRef, type PlayerRefKind } from "../src/domain/player-ref.ts";
import { parseEvidenceAccessMap } from "../src/domain/evidence-access.ts";
import { hashEvidenceAccessMap } from "../src/domain/evidence-access.identity.ts";
import { parseEvidencePresentation } from "../src/domain/evidence-presentation.ts";
import { hashEvidencePresentation } from "../src/domain/evidence-presentation.identity.ts";
import { parseInterrogationProfile } from "../src/domain/interrogation-authoring.ts";
import { hashInterrogationProfile } from "../src/domain/interrogation-authoring.identity.ts";
import { parseNpcKnowledge } from "../src/domain/npc-knowledge.ts";
import { parseAccusationChallenge } from "../src/domain/accusation-challenge.ts";
import {
  hashChallengeComponent,
  hashInitialSetup,
  hashNpcBundle,
  hashNpcSnapshot,
  hashPublicContent,
  hashRefs,
  hashReleaseContext,
  hashReleaseManifest,
  serializeSessionJson,
} from "../src/domain/case-package.identity.ts";
import { resolveCasePackage, type PackageRefSource, type ResolvedCasePackage } from "../src/domain/case-package.ts";
import { solutionInput, truthInput } from "./npc-knowledge.fixture.ts";
import { catalogueInput, profileInput } from "./interrogation-authoring.fixture.ts";
import { annaInput, doraInput } from "./interrogation.fixture.ts";

// MYST-SESSION-0001A package fixture on the library case (npc-knowledge fixture): Dora and Anna
// as NPCs, the MYST-0005A catalogue, a small access map and presentation, a challenge on
// responsibility for the killing and authored PublicContent. Factories return fresh inputs.

export const SALT = "5a17c0ffee5a17c0ffee5a17c0ffee01";
export const OTHER_SALT = "0123456789abcdef0123456789abcdef";

const QUESTION_TEXTS: Record<string, string> = {
  "question:ben-in-library": "War Ben zur Tatzeit in der Bibliothek?",
  "question:anna-in-library": "War Anna zur Tatzeit in der Bibliothek?",
  "question:anna-in-killing": "War Anna an der Tat beteiligt?",
  "question:ben-in-killing": "War Ben an der Tat beteiligt?",
  "question:knife-used": "Wurde das Messer benutzt?",
  "question:ben-responsible": "Ist Ben verantwortlich?",
  "question:ben-planned": "Hat Ben die Tat geplant?",
  "question:argument-caused-killing": "Führte der Streit zur Tat?",
  "question:where-was-ben": "Wo war Ben?",
  "question:anna-in-garden": "War Anna im Garten?",
  "question:bloody-knife": "Was ist mit dem blutigen Messer?",
};

/** Plain, mutable package input; `edit` runs before return. */
export function packageInput(edit: (p: any) => void = () => {}): any {
  const truth = truthInput();
  const parsedTruth = parseCaseTruth(truth);
  const truthHash = hashCaseTruth(parsedTruth);
  const solution = solutionInput(truthHash);
  const parsedSolution = parseCaseSolution(solution, parsedTruth);
  const catalogue = catalogueInput();
  const catalogueHash = hashQuestionCatalogue(parseQuestionCatalogue(catalogue, parsedTruth));
  const doraProfile = profileInput();
  doraProfile.catalogueHash = catalogueHash;
  const annaProfile = profileInput();
  annaProfile.npcId = "person:anna";
  annaProfile.catalogueHash = catalogueHash;
  annaProfile.rules = annaProfile.rules.filter((r: any) => r.questionId === "question:ben-in-library");
  const caseId = "case:library";

  const input = {
    schemaVersion: 1,
    rulesetVersion: "mystery-session-v1",
    truth,
    solution,
    access: {
      schemaVersion: 1,
      caseId,
      truthHash,
      entries: [
        { evidenceId: "evidence:bloody-knife", access: { kind: "discoverable", paths: [{ kind: "examine_item", itemId: "item:knife" }] } },
        { evidenceId: "evidence:muddy-boots", access: { kind: "discoverable", paths: [{ kind: "search_location", locationId: "location:garden" }] } },
      ],
    },
    presentation: {
      schemaVersion: 1,
      caseId,
      truthHash,
      entries: [
        { evidenceId: "evidence:bloody-knife", text: "Am Messer klebt Blut.", mentions: [{ kind: "item", id: "item:knife" }], reports: [] },
        {
          evidenceId: "evidence:muddy-boots",
          text: "Die Stiefel sind voller Gartenerde.",
          mentions: [{ kind: "location", id: "location:garden" }],
          reports: [],
        },
      ],
    },
    catalogue,
    npcs: [
      { snapshot: doraInput(parsedTruth, parsedSolution), profile: doraProfile },
      { snapshot: annaInput(parsedTruth, parsedSolution), profile: annaProfile },
    ],
    initial: {
      schemaVersion: 1,
      known: [
        { kind: "person", id: "person:dora" },
        { kind: "person", id: "person:anna" },
        { kind: "location", id: "location:library" },
      ],
    },
    challenge: {
      schemaVersion: 1,
      caseId,
      truthHash,
      solutionHash: hashCaseSolution(parsedSolution),
      allowedClaims: [
        { kind: "personResponsibleForEvent", personId: "person:ben", eventId: "event:ben-kills-clara" },
        { kind: "personResponsibleForEvent", personId: "person:anna", eventId: "event:ben-kills-clara" },
        { kind: "noPersonResponsibleForEvent", eventId: "event:ben-kills-clara" },
      ],
    },
    publicContent: {
      schemaVersion: 1,
      title: "Der Bibliotheksfall",
      brief: "In der Bibliothek ist etwas Schreckliches geschehen. Finde heraus, wer verantwortlich ist.",
      challengeQuestion: "Wer ist für die Tat verantwortlich?",
      labels: [
        { entity: { kind: "person", id: "person:dora" }, label: "Dora", role: "Bibliothekarin" },
        { entity: { kind: "person", id: "person:anna" }, label: "Anna", role: null },
        { entity: { kind: "location", id: "location:library" }, label: "Bibliothek", role: null },
      ],
      questionTexts: [
        ...doraProfile.rules.map((r: any) => ({ npc: "person:dora", questionId: r.questionId, text: QUESTION_TEXTS[r.questionId] })),
        { npc: "person:anna", questionId: "question:ben-in-library", text: QUESTION_TEXTS["question:ben-in-library"] },
      ],
      publicRules: [{ id: "rule:closed-roster", text: "Nur die vorgestellten Personen kommen als Täter in Frage." }],
    },
    proof: null,
  };
  edit(input);
  return input;
}

/** The trusted MYST-0001 adapter of contract §2, built from the real index. */
export function refSource(truth: CaseTruth, salt: string = SALT): PackageRefSource {
  const built = buildPlayerRefIndex(truth, salt);
  if (!built.success) throw new Error(built.code);
  const index = built.index;
  return {
    caseId: index.caseId,
    truthHash: index.truthHash,
    config: { profile: index.profile, saltHex: salt },
    refFor: (k, id) => playerRefFor(index, k, id),
    resolve: (r) => {
      const x = resolvePlayerRef(index, r);
      return x.success ? { kind: x.kind, id: x.id } as any : null;
    },
  };
}

export const truthOf = (input: any): CaseTruth => parseCaseTruth(input.truth);

/** Resolves the (edited) fixture with a correct source unless one is given; throws on findings. */
export function resolved(edit: (p: any) => void = () => {}, source?: PackageRefSource): ResolvedCasePackage {
  const input = packageInput(edit);
  const result = resolveCasePackage(input, source ?? refSource(truthOf(input)));
  if (!result.ok) throw new Error(JSON.stringify(result.findings));
  return result.package;
}

// ---------- Proof fixture (annex forge-release-proof-v1) ----------
// Witness: examine the knife (its observation report says the knife was used, Dora's written
// testimony says Ben took part), then ask Dora whether Ben took part. A public law turns both
// premises into "Ben is responsible". The resolver only binds this data; nothing here runs it.

const KILLS = "event:ben-kills-clara";
const prop = (id: string, value: boolean) => ({ kind: "proposition", propositionId: `proposition:${id}`, value });
const KNIFE_CLAIM = { kind: "eventHasItem", eventId: KILLS, itemId: "item:knife" };
const BEN_CLAIM = { kind: "eventHasParticipant", eventId: KILLS, personId: "person:ben" };

/** Adds the authored reports and public laws the proof refers to. */
export function withProofContent(p: any): void {
  const knife = p.presentation.entries.find((e: any) => e.evidenceId === "evidence:bloody-knife");
  knife.mentions.push({ kind: "event", id: KILLS }, { kind: "person", id: "person:ben" }, { kind: "person", id: "person:dora" });
  knife.reports.push(
    { claim: KNIFE_CLAIM, stance: "affirms", source: { kind: "observation" } },
    { claim: BEN_CLAIM, stance: "affirms", source: { kind: "testimony", personId: "person:dora" } },
  );
  p.publicContent.publicRules.push(
    { id: "rule:certified-sources", text: "Was ein Beweisstück selbst zeigt, gilt als Tatsache." },
    { id: "rule:manual-presence", text: "Wer an der Tat beteiligt war und die Tatwaffe benutzt wurde, ist verantwortlich." },
  );
}

export type RefOf = (kind: PlayerRefKind, id: string) => string;

/** Release context recomputed from the components, independently of the resolver. */
export function releaseContextOf(input: any, salt: string = SALT): string {
  const truth = parseCaseTruth(input.truth);
  const truthHash = hashCaseTruth(truth);
  const solution = parseCaseSolution(input.solution, truth);
  const catalogue = parseQuestionCatalogue(input.catalogue, truth);
  const index = buildPlayerRefIndex(truth, salt);
  if (!index.success) throw new Error(index.code);
  return hashReleaseContext({
    rulesetVersion: input.rulesetVersion ?? "mystery-session-v1",
    truthHash,
    solutionHash: hashCaseSolution(solution),
    accessHash: hashEvidenceAccessMap(parseEvidenceAccessMap(input.access, truth)),
    presentationHash: hashEvidencePresentation(parseEvidencePresentation(input.presentation, truth)),
    catalogueHash: hashQuestionCatalogue(catalogue),
    npcBundleHash: hashNpcBundle(
      input.npcs.map((n: any) => {
        const snapshot = parseNpcKnowledge(n.snapshot, truth, n.snapshot.solutionHash === null ? null : solution);
        const profile = parseInterrogationProfile(n.profile, truth, catalogue);
        return { npcId: snapshot.npcId, snapshotHash: hashNpcSnapshot(snapshot), profileHash: hashInterrogationProfile(profile) };
      }),
    ),
    initialHash: hashInitialSetup(input.initial),
    refsHash: hashRefs({
      config: { profile: index.index.profile, saltHex: salt },
      caseId: truth.caseId,
      truthHash,
      mapping: index.index.entries.map((e) => ({ kind: e.kind, id: e.id, ref: e.ref })),
    }),
    challengeHash: hashChallengeComponent(parseAccusationChallenge(input.challenge, truth, solution)),
    publicContentHash: hashPublicContent(input.publicContent),
  });
}

export function certificateData(r: RefOf): any {
  return {
    schemaVersion: 1,
    steps: [
      { stepId: "step:examine-knife", event: { type: "investigate", action: "examine_item", target: r("item", "item:knife") } },
      { stepId: "step:ask-dora", event: { type: "interrogate", npc: r("person", "person:dora"), questionId: "question:ben-in-killing" } },
    ],
    observations: [
      {
        id: "obs:knife",
        kind: "OBSERVED",
        literal: prop("knife-used", true),
        source: { kind: "evidence", evidenceId: "evidence:bloody-knife" },
        alternatives: [
          {
            report: { claim: { kind: "eventHasItem", event: r("event", KILLS), item: r("item", "item:knife") }, stance: "affirms", source: { kind: "observation" } },
            licenseRuleId: "rule:certified-sources",
          },
        ],
      },
      {
        id: "obs:ben-said",
        kind: "REPORTED_BY_NPC",
        npcId: "person:dora",
        literal: prop("ben-in-killing", true),
        alternatives: [
          { kind: "npc", questionId: "question:ben-in-killing", claim: { kind: "eventHasParticipant", event: r("event", KILLS), person: r("person", "person:ben") }, stance: "affirms" },
          {
            kind: "testimony",
            evidenceId: "evidence:bloody-knife",
            report: {
              claim: { kind: "eventHasParticipant", event: r("event", KILLS), person: r("person", "person:ben") },
              stance: "affirms",
              source: { kind: "testimony", person: r("person", "person:dora") },
            },
          },
        ],
      },
      { id: "obs:aware-ben", kind: "ENTITY_AWARENESS", entity: { kind: "person", id: "person:ben" } },
      {
        id: "obs:law",
        kind: "PUBLIC_RULE",
        ruleId: "rule:manual-presence",
        afterObservations: ["obs:knife", "obs:ben-said"],
        rules: [{ edgeId: "edge:ben", allOf: ["node:knife", "node:ben-said"], yields: { kind: "conclusion", conclusionId: "conclusion:ben-responsible", value: true } }],
      },
    ],
  };
}

/** The profile mirrors the certificate catalog; observations drop the selector data. */
export function proofProfile(input: any, cert: any): any {
  const truth = parseCaseTruth(input.truth);
  const solution = parseCaseSolution(input.solution, truth);
  const strip = ({ alternatives, ruleId, afterObservations, ...rest }: any) => rest;
  return {
    schemaVersion: 1,
    bindings: { caseId: truth.caseId, truthHash: hashCaseTruth(truth), solutionHash: hashCaseSolution(solution), releaseHash: "" },
    answerScope: ["conclusion:ben-responsible", "conclusion:anna-responsible"],
    ambiguityPolicy: "must_disambiguate",
    question: { kind: "required_literals" },
    observations: cert.observations.map(strip),
    nodes: [
      { id: "node:knife", kind: "literal", literal: prop("knife-used", true) },
      { id: "node:ben-said", kind: "observation", observationId: "obs:ben-said" },
      { id: "node:law", kind: "observation", observationId: "obs:law" },
      { id: "node:ben-resp", kind: "literal", literal: { kind: "conclusion", conclusionId: "conclusion:ben-responsible", value: true } },
    ],
    edges: [{ id: "edge:ben", allOf: ["node:knife", "node:ben-said", "node:law"], to: "node:ben-resp", license: "node:law" }],
    witnessStepIds: cert.steps.map((s: any) => s.stepId),
  };
}

export type ProofEdit = {
  /** Edits the package input (after the proof content is added). */
  pkg?: (p: any) => void;
  cert?: (c: any, r: RefOf) => void;
  /** Runs after releaseHash is bound, so it can also break the binding. */
  profile?: (p: any) => void;
  envelope?: (e: any) => void;
  manifest?: (text: string) => string;
};

/** Package input with a fully bound proof: profile.bindings.releaseHash = H(manifest). */
export function proofPackageInput(edit: ProofEdit = {}): any {
  return packageInput((p) => {
    withProofContent(p);
    edit.pkg?.(p);
    const index = buildPlayerRefIndex(parseCaseTruth(p.truth), SALT);
    if (!index.success) throw new Error(index.code);
    const r: RefOf = (kind, id) => playerRefFor(index.index, kind, id)!;
    const cert = certificateData(r);
    edit.cert?.(cert, r);
    const envelope = { schemaVersion: 1, releaseContextHash: releaseContextOf(p), adapterVersion: "forge-release-proof-v1", certificateData: cert };
    edit.envelope?.(envelope);
    const text = serializeSessionJson(envelope);
    const releaseManifest = edit.manifest?.(text) ?? text;
    const profile = proofProfile(p, cert);
    profile.bindings.releaseHash = hashReleaseManifest(releaseManifest);
    edit.profile?.(profile);
    p.proof = { profile, releaseManifest };
  });
}
