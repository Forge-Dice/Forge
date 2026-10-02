import { parseCaseTruth, type CaseTruth } from "../src/domain/case-truth.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import { parseCaseSolution, type CaseSolution } from "../src/domain/case-solution.ts";
import { hashCaseSolution } from "../src/domain/case-solution.identity.ts";

// Synthetic case for NPC knowledge tests. IDs deliberately "speak" (event:ben-kills-clara) and
// every name and description carries the marker SPOILER, so leaks are detectable in projections.
// Factories return fresh mutable inputs.

export const MARKER = "SPOILER";

export function truthInput(): any {
  return {
    schemaVersion: 1,
    caseId: "case:library",
    revision: 1,
    title: `${MARKER} Der Bibliotheksfall`,
    timeline: { unit: "second", originLabel: `${MARKER} Abendessen` },
    persons: [
      { id: "person:anna", name: `${MARKER} Anna` },
      { id: "person:ben", name: `${MARKER} Ben der Mörder` },
      { id: "person:clara", name: `${MARKER} Clara` },
      { id: "person:dora", name: `${MARKER} Dora` },
    ],
    locations: [
      { id: "location:library", name: `${MARKER} Bibliothek` },
      { id: "location:garden", name: `${MARKER} Garten` },
    ],
    items: [{ id: "item:knife", name: `${MARKER} Tatwaffe` }],
    relationships: [
      {
        id: "relationship:ben-owes-clara",
        fromPersonId: "person:ben",
        toPersonId: "person:clara",
        kind: `${MARKER} schuldet Geld`,
        time: { kind: "interval", start: 0, end: 1000 },
      },
    ],
    events: [
      {
        id: "event:argument",
        description: `${MARKER} Streit ums Geld`,
        time: { kind: "interval", start: 100, end: 200 },
        locationId: "location:library",
        participantIds: ["person:ben", "person:clara"],
        itemIds: [],
        causedByEventIds: [],
      },
      {
        id: "event:ben-kills-clara",
        description: `${MARKER} Ben ersticht Clara`,
        time: { kind: "instant", at: 300 },
        locationId: "location:library",
        participantIds: ["person:ben", "person:clara"],
        itemIds: ["item:knife"],
        causedByEventIds: ["event:argument"],
      },
      {
        id: "event:walk",
        description: `${MARKER} Anna im Garten`,
        time: { kind: "interval", start: 250, end: 400 },
        locationId: "location:garden",
        participantIds: ["person:anna"],
        itemIds: [],
        causedByEventIds: [],
      },
    ],
    motives: [
      { id: "motive:ben-debt", personId: "person:ben", eventIds: ["event:ben-kills-clara"], description: `${MARKER} Schulden` },
    ],
    propositions: [
      {
        id: "proposition:ben-at-library",
        claim: { kind: "personAt", personId: "person:ben", locationId: "location:library", at: 300 },
        truth: true,
      },
      {
        // Same structural claim as ben-at-library under another ID, properties reordered.
        id: "proposition:ben-seen-in-library",
        claim: { at: 300, locationId: "location:library", personId: "person:ben", kind: "personAt" },
        truth: true,
      },
      {
        id: "proposition:anna-at-library",
        claim: { kind: "personAt", personId: "person:anna", locationId: "location:library", at: 300 },
        truth: false,
      },
      {
        id: "proposition:ben-in-killing",
        claim: { kind: "eventHasParticipant", eventId: "event:ben-kills-clara", personId: "person:ben" },
        truth: true,
      },
      {
        id: "proposition:anna-in-killing",
        claim: { kind: "eventHasParticipant", eventId: "event:ben-kills-clara", personId: "person:anna" },
        truth: false,
      },
      {
        id: "proposition:knife-used",
        claim: { kind: "eventHasItem", eventId: "event:ben-kills-clara", itemId: "item:knife" },
        truth: true,
      },
    ],
    evidence: [
      {
        id: "evidence:bloody-knife",
        description: `${MARKER} Bens Fingerabdrücke am Messer`,
        source: { kind: "item", id: "item:knife" },
        links: [{ propositionId: "proposition:ben-in-killing", direction: "supports" }],
      },
      {
        id: "evidence:muddy-boots",
        description: `${MARKER} Annas Stiefel voller Erde`,
        source: { kind: "location", id: "location:garden" },
        links: [{ propositionId: "proposition:anna-at-library", direction: "refutes" }],
      },
    ],
    secrets: [{ id: "secret:ben-did-it", propositionIds: ["proposition:ben-in-killing"] }],
    redHerrings: [
      {
        id: "red-herring:muddy-boots",
        evidenceIds: ["evidence:muddy-boots"],
        misleadingPropositionId: "proposition:anna-at-library",
      },
    ],
  };
}

/** Answer key: Ben responsible (true), Anna open (partial), Ben as planner false, nobody false. */
export function solutionInput(truthHash: string): any {
  const kills = "event:ben-kills-clara";
  return {
    schemaVersion: 1,
    caseId: "case:library",
    revision: 1,
    truthHash,
    resolutions: [
      {
        eventId: kills,
        targets: [{ kind: "person", id: "person:clara" }],
        responsibility: { completeness: "partial", assignments: [{ personId: "person:ben", roles: ["direct_actor"] }] },
        intent: "intended",
        mechanism: "ordinary",
        causesComplete: true,
      },
    ],
    conclusions: [
      { id: "conclusion:ben-responsible", claim: { kind: "personResponsibleForEvent", personId: "person:ben", eventId: kills } },
      { id: "conclusion:anna-responsible", claim: { kind: "personResponsibleForEvent", personId: "person:anna", eventId: kills } },
      { id: "conclusion:ben-role-actor", claim: { kind: "personRoleForEvent", personId: "person:ben", eventId: kills, role: "direct_actor" } },
      { id: "conclusion:ben-role-planner", claim: { kind: "personRoleForEvent", personId: "person:ben", eventId: kills, role: "planner" } },
      { id: "conclusion:nobody-responsible", claim: { kind: "noPersonResponsibleForEvent", eventId: kills } },
      { id: "conclusion:argument-caused-killing", claim: { kind: "eventCausedEvent", causeEventId: "event:argument", eventId: kills } },
      { id: "conclusion:killing-intended", claim: { kind: "eventIntent", eventId: kills, value: "intended" } },
      { id: "conclusion:killing-ordinary", claim: { kind: "eventMechanism", eventId: kills, value: "ordinary" } },
    ],
    requiredConclusions: [{ conclusionId: "conclusion:ben-responsible", value: true }],
  };
}

export type World = { truth: CaseTruth; solution: CaseSolution };

/** Parses truth and a solution correctly bound to it, after optional author edits. */
export function world(editTruth: (t: any) => void = () => {}, editSolution: (s: any) => void = () => {}): World {
  const tIn = truthInput();
  editTruth(tIn);
  const truth = parseCaseTruth(tIn);
  const sIn = solutionInput(hashCaseTruth(truth));
  editSolution(sIn);
  return { truth, solution: parseCaseSolution(sIn, truth) };
}

/** NPC input correctly bound to the given documents. */
export function npcInput(truth: CaseTruth, solution: CaseSolution | null, edit: (n: any) => void = () => {}): any {
  const input: any = {
    schemaVersion: 1,
    caseId: truth.caseId,
    truthHash: hashCaseTruth(truth),
    solutionHash: solution === null ? null : hashCaseSolution(solution),
    npcId: "person:anna",
    revision: 1,
    asOf: 500,
    awareness: [],
    attitudes: [],
  };
  edit(input);
  return input;
}

export const prior = { kind: "prior_knowledge" };
export const inferred = { kind: "author_modeled_inference" };

export const propositionAttitude = (id: string, stance: object, acquiredAt = 0, provenance: object = prior) => ({
  subject: { kind: "proposition", id: `proposition:${id}` },
  stance,
  acquiredAt,
  provenance,
});

export const conclusionAttitude = (id: string, stance: object, acquiredAt = 450, provenance: object = inferred) => ({
  subject: { kind: "conclusion", id: `conclusion:${id}` },
  stance,
  acquiredAt,
  provenance,
});

export const aware = (kind: string, id: string, acquiredAt = 0, provenance: object = prior) => ({
  subject: { kind, id: `${kind}:${id}` },
  acquiredAt,
  provenance,
});

export const knowledge = (value: boolean) => ({ kind: "knowledge", value });
export const belief = (value: boolean) => ({ kind: "belief", value });
export const uncertain = (leaning: boolean | null) => ({ kind: "uncertain", leaning });
