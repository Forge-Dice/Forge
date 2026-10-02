import { parseCaseTruth } from "../src/domain/case-truth.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";

// Small synthetic poisoning case for answer-key tests. Not a playable mystery.
// Anna buys poison, poisons the drink, Clara dies later. Anna is never at Clara's death:
// responsibility must not imply presence. Fixtures are factories returning fresh objects.

export function solutionTruthInput() {
  return {
    schemaVersion: 1,
    caseId: "case:poison",
    revision: 1,
    title: "Gift im Tee",
    timeline: { unit: "second", originLabel: "Teestunde" },
    persons: [
      { id: "person:a", name: "Anna" },
      { id: "person:b", name: "Bruno" },
      { id: "person:c", name: "Clara" },
    ],
    locations: [
      { id: "location:x", name: "Salon" },
      { id: "location:y", name: "Apotheke" },
    ],
    items: [{ id: "item:k", name: "Giftfläschchen" }],
    relationships: [],
    events: [
      {
        id: "event:purchase",
        description: "Anna kauft Gift",
        time: { kind: "instant", at: 2 },
        locationId: "location:y",
        participantIds: ["person:a"],
        itemIds: ["item:k"],
        causedByEventIds: [],
      },
      {
        id: "event:poisoning",
        description: "Gift gelangt in den Tee",
        time: { kind: "instant", at: 10 },
        locationId: "location:x",
        participantIds: ["person:a"],
        itemIds: ["item:k"],
        causedByEventIds: ["event:purchase"],
      },
      {
        id: "event:death",
        description: "Clara stirbt",
        time: { kind: "instant", at: 20 },
        locationId: "location:x",
        participantIds: ["person:c"],
        itemIds: [],
        causedByEventIds: ["event:poisoning"],
      },
      {
        id: "event:storm",
        description: "Gewitter über der Apotheke",
        time: { kind: "interval", start: 0, end: 5 },
        locationId: "location:y",
        participantIds: [],
        itemIds: [],
        causedByEventIds: [],
      },
    ],
    motives: [],
    propositions: [],
    evidence: [],
    secrets: [],
    redHerrings: [],
  };
}

export function solutionTruth() {
  return parseCaseTruth(solutionTruthInput());
}

/** One event, one responsible person, one matching required conclusion. */
export function baseSolution() {
  return {
    schemaVersion: 1,
    caseId: "case:poison",
    revision: 1,
    truthHash: hashCaseTruth(solutionTruth()),
    resolutions: [
      {
        eventId: "event:death",
        targets: [{ kind: "person", id: "person:c" }],
        responsibility: {
          completeness: "complete",
          assignments: [{ personId: "person:a", roles: ["direct_actor"] as string[] | null }],
        },
        intent: "intended" as string | null,
        mechanism: "ordinary" as string | null,
        causesComplete: true,
      },
    ],
    conclusions: [
      {
        id: "conclusion:a-responsible",
        claim: { kind: "personResponsibleForEvent", personId: "person:a", eventId: "event:death" } as Record<string, unknown>,
      },
    ],
    requiredConclusions: [{ conclusionId: "conclusion:a-responsible", value: true }],
  };
}

// Literal SHA-256 of solutionTruth() under forge-case-c14n-v1 (produced by the TASK-0001
// hashCaseTruth, whose own golden test pins it independently).
export const SOLUTION_TRUTH_HASH = "bb645f8f03beccc09b847afed606aacace2dbc0957e341ba86c7d1d043d4ae36";

/** Fixed answer key whose canonical form is hand-written in GOLDEN_SOLUTION_CANONICAL. */
export function goldenSolution() {
  return {
    truthHash: SOLUTION_TRUTH_HASH,
    revision: 2,
    schemaVersion: 1,
    caseId: "case:poison",
    requiredConclusions: [
      { value: true, conclusionId: "conclusion:b-responsible" },
      { conclusionId: "conclusion:a-acted", value: true },
    ],
    conclusions: [
      {
        id: "conclusion:a-acted",
        claim: { role: "direct_actor", kind: "personRoleForEvent", eventId: "event:death", personId: "person:a" },
      },
      {
        id: "conclusion:b-responsible",
        claim: { kind: "personResponsibleForEvent", personId: "person:b", eventId: "event:death" },
      },
    ],
    resolutions: [
      {
        eventId: "event:death",
        targets: [
          { kind: "person", id: "person:c" },
          { kind: "item", id: "item:k" },
        ],
        responsibility: {
          completeness: "partial",
          assignments: [
            { personId: "person:b", roles: null },
            { personId: "person:a", roles: ["planner", "direct_actor"] },
          ],
        },
        intent: null,
        mechanism: "mixed",
        causesComplete: false,
      },
    ],
  };
}

// Written by hand from the forge-solution-c14n-v1 rules, not produced by the implementation.
export const GOLDEN_SOLUTION_CANONICAL =
  '{"caseId":"case:poison","conclusions":[{"claim":{"eventId":"event:death","kind":"personResponsibleForEvent","personId":"person:b"},"id":"conclusion:b-responsible"},{"claim":{"eventId":"event:death","kind":"personRoleForEvent","personId":"person:a","role":"direct_actor"},"id":"conclusion:a-acted"}],"requiredConclusions":[{"conclusionId":"conclusion:a-acted","value":true},{"conclusionId":"conclusion:b-responsible","value":true}],"resolutions":[{"causesComplete":false,"eventId":"event:death","intent":null,"mechanism":"mixed","responsibility":{"assignments":[{"personId":"person:a","roles":["direct_actor","planner"]},{"personId":"person:b","roles":null}],"completeness":"partial"},"targets":[{"id":"item:k","kind":"item"},{"id":"person:c","kind":"person"}]}],"revision":2,"schemaVersion":1,"truthHash":"bb645f8f03beccc09b847afed606aacace2dbc0957e341ba86c7d1d043d4ae36"}';

// Computed with coreutils `sha256sum` over "forge-solution-c14n-v1\n" + GOLDEN_SOLUTION_CANONICAL.
export const GOLDEN_SOLUTION_SHA256 = "0d0fa7732a9cdf953c7a6d74207c2cfde75a6a9902143a11db4e117b483ca1f7";
