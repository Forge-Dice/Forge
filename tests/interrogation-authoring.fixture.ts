import type { CaseTruth } from "../src/domain/case-truth.ts";
import { world } from "./npc-knowledge.fixture.ts";
import {
  parseInterrogationProfile,
  parseQuestionCatalogue,
  type InterrogationProfile,
  type QuestionCatalogue,
} from "../src/domain/interrogation-authoring.ts";
import { hashQuestionCatalogue } from "../src/domain/interrogation-authoring.identity.ts";

// MYST-0005A fixture (contract §3.4, verbatim). Truth is world().truth from the NPC knowledge
// fixture. Factories return fresh mutable inputs.

export const TRUTH_HASH = "f445f3b4ea632409542d6db96438f06db81b823990a2402ca9387fbcf60a6657";
export const CATALOGUE_HASH = "8a72ee2d9ebacb0806d53fd2d064653c6da9bbdb51e1f7a19c8ab6bdf6fb9e0e";
export const DORA_PROFILE_HASH = "358a5f3945030d485778219aa1f1ec258507ed9034496743c050bd9e8b17b0e5";

const person = (id: string) => ({ kind: "person", id: `person:${id}` });
const location = (id: string) => ({ kind: "location", id: `location:${id}` });
const event = (id: string) => ({ kind: "event", id: `event:${id}` });
const item = (id: string) => ({ kind: "item", id: `item:${id}` });
const evidence = (id: string) => ({ kind: "evidence", id: `evidence:${id}` });
export const ref = { person, location, event, item, evidence };

const KILLING = "event:ben-kills-clara";

export function catalogueInput(): any {
  return {
    schemaVersion: 1,
    caseId: "case:library",
    truthHash: TRUTH_HASH,
    revision: 1,
    questions: [
      { id: "question:ben-in-library", mentions: [person("ben"), location("library")] },
      { id: "question:anna-in-library", mentions: [person("anna"), location("library")] },
      { id: "question:anna-in-killing", mentions: [person("anna"), event("ben-kills-clara")] },
      { id: "question:ben-in-killing", mentions: [person("ben"), event("ben-kills-clara")] },
      { id: "question:knife-used", mentions: [event("ben-kills-clara"), item("knife")] },
      { id: "question:ben-responsible", mentions: [person("ben"), event("ben-kills-clara")] },
      { id: "question:ben-planned", mentions: [person("ben"), event("ben-kills-clara")] },
      { id: "question:argument-caused-killing", mentions: [event("argument"), event("ben-kills-clara")] },
      { id: "question:where-was-ben", mentions: [person("ben")] },
      { id: "question:anna-in-garden", mentions: [person("anna"), location("garden")] },
      { id: "question:bloody-knife", mentions: [evidence("bloody-knife")] },
    ],
  };
}

const answer = (questionId: string, claim: object, reveal: object[] = []) => ({ questionId, act: "answer", claim, reveal });
const personAt = (who: string, where: string) => ({
  kind: "personAt",
  personId: `person:${who}`,
  locationId: `location:${where}`,
  at: 300,
});

export function profileInput(): any {
  return {
    schemaVersion: 1,
    caseId: "case:library",
    truthHash: TRUTH_HASH,
    catalogueHash: CATALOGUE_HASH,
    npcId: "person:dora",
    revision: 1,
    rules: [
      answer("question:ben-in-library", personAt("ben", "library")),
      answer("question:anna-in-library", personAt("anna", "library")),
      answer("question:anna-in-killing", { kind: "eventHasParticipant", eventId: KILLING, personId: "person:anna" }),
      answer("question:ben-in-killing", { kind: "eventHasParticipant", eventId: KILLING, personId: "person:ben" }),
      answer("question:knife-used", { kind: "eventHasItem", eventId: KILLING, itemId: "item:knife" }),
      answer("question:ben-responsible", { kind: "personResponsibleForEvent", personId: "person:ben", eventId: KILLING }),
      answer("question:ben-planned", {
        kind: "personRoleForEvent",
        personId: "person:ben",
        eventId: KILLING,
        role: "planner",
      }),
      answer("question:argument-caused-killing", {
        kind: "eventCausedEvent",
        causeEventId: "event:argument",
        eventId: KILLING,
      }),
      answer("question:where-was-ben", personAt("ben", "library"), [location("library")]),
      answer("question:anna-in-garden", personAt("anna", "garden")),
      { questionId: "question:bloody-knife", act: "decline" },
    ],
  };
}

export { personAt };

export type Authoring = { truth: CaseTruth; catalogue: QuestionCatalogue; profile: InterrogationProfile };

/** Parsed fixture documents; edits apply to fresh inputs before parsing. The profile is rebound to the parsed catalogue. */
export function authoring(
  editCatalogue: (c: any) => void = () => {},
  editProfile: (p: any) => void = () => {},
): Authoring {
  const { truth } = world();
  const cIn = catalogueInput();
  editCatalogue(cIn);
  const catalogue = parseQuestionCatalogue(cIn, truth);
  const pIn = profileInput();
  pIn.catalogueHash = hashQuestionCatalogue(catalogue);
  editProfile(pIn);
  return { truth, catalogue, profile: parseInterrogationProfile(pIn, truth, catalogue) };
}
