import { parseCaseTruth, type CaseTruth } from "../src/domain/case-truth.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import { parseCaseSolution } from "../src/domain/case-solution.ts";
import { hashCaseSolution } from "../src/domain/case-solution.identity.ts";
import { parseQuestionCatalogue } from "../src/domain/interrogation-authoring.ts";
import { hashQuestionCatalogue } from "../src/domain/interrogation-authoring.identity.ts";
import { buildPlayerRefIndex, playerRefFor, resolvePlayerRef } from "../src/domain/player-ref.ts";
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
