// Small synthetic cases for tests. Not a playable mystery.
// Fixtures are factories so every test gets a fresh, mutable input object.

export function fullCase() {
  return {
    schemaVersion: 1,
    caseId: "case:letter-opener",
    revision: 3,
    title: "Der Fall „Brieföffner“",
    timeline: { unit: "second", originLabel: "20:00 Uhr am Abend des Dinners" },
    persons: [
      { id: "person:anna", name: "Anna" },
      { id: "person:ben", name: "Ben" },
      { id: "person:clara", name: "Clara" },
    ],
    locations: [
      { id: "location:library", name: "Bibliothek" },
      { id: "location:garden", name: "Garten" },
    ],
    items: [
      { id: "item:letter-opener", name: "Brieföffner" },
      { id: "item:gloves", name: "Gartenhandschuhe" },
    ],
    relationships: [
      {
        id: "relationship:ben-owes-clara",
        fromPersonId: "person:ben",
        toPersonId: "person:clara",
        kind: "schuldet Geld",
        time: { kind: "interval", start: 0, end: 3600 },
      },
    ],
    events: [
      {
        id: "event:argument",
        description: "Streit über das Testament",
        time: { kind: "interval", start: 600, end: 1200 },
        locationId: "location:library",
        participantIds: ["person:ben", "person:clara"],
        itemIds: [],
        causedByEventIds: [],
      },
      {
        id: "event:murder",
        description: "Clara wird mit dem Brieföffner getötet",
        time: { kind: "instant", at: 1500 },
        locationId: "location:library",
        participantIds: ["person:ben", "person:clara"],
        itemIds: ["item:letter-opener"],
        causedByEventIds: ["event:argument"],
      },
      {
        id: "event:walk",
        description: "Anna arbeitet im Garten",
        time: { kind: "interval", start: 1000, end: 2000 },
        locationId: "location:garden",
        participantIds: ["person:anna"],
        itemIds: ["item:gloves"],
        causedByEventIds: [],
      },
    ],
    motives: [
      {
        id: "motive:debt",
        personId: "person:ben",
        eventIds: ["event:murder"],
        description: "Ben kann seine Schulden bei Clara nicht zurückzahlen",
      },
    ],
    propositions: [
      {
        id: "proposition:ben-at-murder",
        claim: { kind: "eventHasParticipant", eventId: "event:murder", personId: "person:ben" },
        truth: true,
      },
      {
        id: "proposition:anna-at-murder",
        claim: { kind: "eventHasParticipant", eventId: "event:murder", personId: "person:anna" },
        truth: false,
      },
      {
        id: "proposition:opener-used",
        claim: { kind: "eventHasItem", eventId: "event:murder", itemId: "item:letter-opener" },
        truth: true,
      },
      {
        id: "proposition:ben-at-argument",
        claim: { kind: "eventHasParticipant", eventId: "event:argument", personId: "person:ben" },
        truth: true,
      },
      {
        id: "proposition:anna-in-library",
        claim: { kind: "personAt", personId: "person:anna", locationId: "location:library", at: 1500 },
        truth: false,
      },
      {
        id: "proposition:anna-in-garden",
        claim: { kind: "personAt", personId: "person:anna", locationId: "location:garden", at: 1500 },
        truth: true,
      },
    ],
    evidence: [
      {
        id: "evidence:fingerprint",
        description: "Annas Fingerabdruck auf dem Brieföffner (vom Vortag)",
        source: { kind: "item", id: "item:letter-opener" },
        links: [
          { propositionId: "proposition:anna-at-murder", direction: "supports" },
          { propositionId: "proposition:opener-used", direction: "supports" },
        ],
      },
      {
        id: "evidence:anna-statement",
        description: "Anna hörte Ben streiten und war danach durchgehend im Garten",
        source: { kind: "person", id: "person:anna" },
        links: [
          { propositionId: "proposition:ben-at-argument", direction: "supports" },
          { propositionId: "proposition:anna-at-murder", direction: "refutes" },
        ],
      },
      {
        id: "evidence:muddy-path",
        description: "Frische Fußspuren im Gartenbeet",
        source: { kind: "location", id: "location:garden" },
        links: [{ propositionId: "proposition:anna-in-garden", direction: "supports" }],
      },
      {
        id: "evidence:gloves-dirty",
        description: "Erde an den Gartenhandschuhen",
        source: { kind: "event", id: "event:walk" },
        links: [{ propositionId: "proposition:anna-in-library", direction: "refutes" }],
      },
    ],
    secrets: [{ id: "secret:debt", propositionIds: ["proposition:ben-at-argument"] }],
    redHerrings: [
      {
        id: "red-herring:fingerprint",
        evidenceIds: ["evidence:fingerprint"],
        misleadingPropositionId: "proposition:anna-at-murder",
      },
    ],
  };
}

/** Minimal case whose canonical form is hand-written in GOLDEN_CANONICAL. */
export function goldenCase() {
  return {
    title: "Café \"☕\"\t\\ Zeile\nzwei",
    revision: 1,
    schemaVersion: 1,
    caseId: "case:golden",
    timeline: { unit: "second", originLabel: "Mitternacht" },
    persons: [
      { name: "Bea", id: "person:b" },
      { id: "person:a", name: "Åsa" },
    ],
    locations: [{ id: "location:hall", name: "Halle" }],
    items: [],
    relationships: [],
    events: [
      {
        id: "event:e1",
        description: "Treffen",
        time: { kind: "instant", at: 5 },
        locationId: "location:hall",
        participantIds: ["person:b", "person:a"],
        itemIds: [],
        causedByEventIds: [],
      },
    ],
    motives: [],
    propositions: [
      {
        id: "proposition:p1",
        claim: { kind: "eventHasParticipant", eventId: "event:e1", personId: "person:a" },
        truth: true,
      },
    ],
    evidence: [],
    secrets: [{ id: "secret:s1", propositionIds: ["proposition:p1"] }],
    redHerrings: [],
  };
}

// Written by hand from the forge-case-c14n-v1 rules, not produced by the implementation.
export const GOLDEN_CANONICAL = String.raw`{"caseId":"case:golden","events":[{"causedByEventIds":[],"description":"Treffen","id":"event:e1","itemIds":[],"locationId":"location:hall","participantIds":["person:a","person:b"],"time":{"at":5,"kind":"instant"}}],"evidence":[],"items":[],"locations":[{"id":"location:hall","name":"Halle"}],"motives":[],"persons":[{"id":"person:a","name":"Åsa"},{"id":"person:b","name":"Bea"}],"propositions":[{"claim":{"eventId":"event:e1","kind":"eventHasParticipant","personId":"person:a"},"id":"proposition:p1","truth":true}],"redHerrings":[],"relationships":[],"revision":1,"schemaVersion":1,"secrets":[{"id":"secret:s1","propositionIds":["proposition:p1"]}],"timeline":{"originLabel":"Mitternacht","unit":"second"},"title":"Café \"☕\"\t\\ Zeile\nzwei"}`;

// Computed with coreutils `sha256sum` over "forge-case-c14n-v1\n" + GOLDEN_CANONICAL.
export const GOLDEN_SHA256 = "bd95eb9a8569f4f3f62eab50aac94e75cd601b54e3432776cc6663a204647501";
