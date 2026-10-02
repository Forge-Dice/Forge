import { describe, expect, it } from "vitest";
import type { CaseTruthInput } from "../src/domain/case-truth.ts";
import { parseCaseTruth } from "../src/domain/case-truth.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import { validateCaseSemantics, type SemanticReport } from "../src/domain/case-semantics.ts";
import { fullCase } from "./case-truth.fixture.ts";

// ---------- builders for small synthetic cases ----------

const iv = (start: number, end: number) => ({ kind: "interval", start, end });
const at = (tick: number) => ({ kind: "instant", at: tick });

function ev(id: string, time: object, locationId: string, participantIds: string[] = [], itemIds: string[] = [], causedByEventIds: string[] = []) {
  return { id: `event:${id}`, description: id, time, locationId: `location:${locationId}`, participantIds, itemIds, causedByEventIds };
}

const personAt = (id: string, person: string, location: string, tick: number, truth: boolean) => ({
  id: `proposition:${id}`,
  claim: { kind: "personAt", personId: `person:${person}`, locationId: `location:${location}`, at: tick },
  truth,
});
const hasParticipant = (id: string, event: string, person: string, truth: boolean) => ({
  id: `proposition:${id}`,
  claim: { kind: "eventHasParticipant", eventId: `event:${event}`, personId: `person:${person}` },
  truth,
});
const hasItem = (id: string, event: string, item: string, truth: boolean) => ({
  id: `proposition:${id}`,
  claim: { kind: "eventHasItem", eventId: `event:${event}`, itemId: `item:${item}` },
  truth,
});

function smallCase(events: object[], propositions: object[] = []) {
  return parseCaseTruth({
    schemaVersion: 1,
    caseId: "case:semantics",
    revision: 1,
    title: "Semantik",
    timeline: { unit: "second", originLabel: "Beginn" },
    persons: [
      { id: "person:a", name: "A" },
      { id: "person:b", name: "B" },
    ],
    locations: [
      { id: "location:x", name: "X" },
      { id: "location:y", name: "Y" },
    ],
    items: [
      { id: "item:k", name: "K" },
      { id: "item:m", name: "M" },
    ],
    relationships: [],
    events,
    motives: [],
    propositions,
    evidence: [],
    secrets: [],
    redHerrings: [],
  });
}

function fromFull(mutate: (c: any) => void = () => {}) {
  const c = fullCase();
  mutate(c);
  return parseCaseTruth(c);
}

/** Compact view: [code, ...subjectIds] per finding, in report order. */
function summary(report: SemanticReport): string[][] {
  return report.findings.map((finding) => [finding.code, ...finding.subjectIds]);
}

const findingsOf = (truth: ReturnType<typeof parseCaseTruth>) => summary(validateCaseSemantics(truth));

// Rebuilds a JSON value with every array permuted and every object's keys reversed.
function permute(value: unknown, rotateBy: number): unknown {
  if (Array.isArray(value)) {
    const items = value.map((item) => permute(item, rotateBy));
    const shift = items.length === 0 ? 0 : rotateBy % items.length;
    return [...items.slice(shift), ...items.slice(0, shift)].reverse();
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, permute(child, rotateBy)]));
  }
  return value;
}

// A case that violates several independent rules at once.
function brokenCase() {
  const c: any = fullCase();
  c.events[1].participantIds.push("person:anna"); // Anna at the murder in the library
  c.events[0].causedByEventIds = ["event:murder"]; // argument <-> murder cycle
  return c;
}

const BROKEN_EXPECTED = [
  ["CAUSAL_CYCLE", "event:argument", "event:murder"],
  ["CAUSE_STARTS_AFTER_EFFECT", "event:murder", "event:argument"],
  ["PARTICIPANT_CLAIM_MISMATCH", "proposition:anna-at-murder", "event:murder"],
  ["PERSON_LOCATION_CONFLICT", "person:anna", "event:murder", "event:walk"],
  ["PERSON_LOCATION_CONFLICT", "person:anna", "event:murder", "proposition:anna-in-garden"],
  ["PERSON_PRESENCE_NEGATED", "proposition:anna-in-library", "event:murder"],
];

// ---------- rules ----------

describe("PERSON_LOCATION_CONFLICT", () => {
  it.each<[string, object, object, string[][]]>([
    ["interval/interval overlap", iv(0, 10), iv(5, 15), [["PERSON_LOCATION_CONFLICT", "person:a", "event:e1", "event:e2"]]],
    ["interval/instant at interval start", iv(10, 20), at(10), [["PERSON_LOCATION_CONFLICT", "person:a", "event:e1", "event:e2"]]],
    ["instant/instant on the same tick", at(5), at(5), [["PERSON_LOCATION_CONFLICT", "person:a", "event:e1", "event:e2"]]],
    ["adjacent intervals", iv(10, 20), iv(20, 30), []],
    ["instant at interval end", iv(10, 20), at(20), []],
    ["instants on different ticks", at(5), at(6), []],
  ])("%s at different locations", (_name, timeA, timeB, expected) => {
    expect(findingsOf(smallCase([ev("e1", timeA, "x", ["person:a"]), ev("e2", timeB, "y", ["person:a"])]))).toEqual(expected);
  });

  it("overlap at the same location is no conflict", () => {
    expect(findingsOf(smallCase([ev("e1", iv(0, 10), "x", ["person:a"]), ev("e2", iv(5, 15), "x", ["person:a"])]))).toEqual([]);
  });

  it("different people may overlap at different locations", () => {
    expect(findingsOf(smallCase([ev("e1", iv(0, 10), "x", ["person:a"]), ev("e2", iv(5, 15), "y", ["person:b"])]))).toEqual([]);
  });

  it("positive personAt conflicts with an event elsewhere", () => {
    const truth = smallCase([ev("e1", iv(0, 10), "x", ["person:a"])], [personAt("p1", "a", "y", 5, true)]);
    expect(findingsOf(truth)).toEqual([["PERSON_LOCATION_CONFLICT", "person:a", "event:e1", "proposition:p1"]]);
  });

  it("two positive personAt claims at different locations on the same tick conflict", () => {
    const truth = smallCase([], [personAt("p1", "a", "x", 5, true), personAt("p2", "a", "y", 5, true)]);
    expect(findingsOf(truth)).toEqual([["PERSON_LOCATION_CONFLICT", "person:a", "proposition:p1", "proposition:p2"]]);
  });

  it("negative personAt is not a presence fact", () => {
    const truth = smallCase([ev("e1", iv(0, 10), "x", ["person:a"])], [personAt("p1", "a", "y", 5, false)]);
    expect(findingsOf(truth)).toEqual([]);
  });

  it("detects conflicts between facts that are not neighbours in array or time order", () => {
    const truth = smallCase([
      ev("e1", iv(0, 100), "x", ["person:a"]),
      ev("e2", iv(10, 20), "x", ["person:a"]),
      ev("e3", iv(50, 60), "y", ["person:a"]),
    ]);
    expect(findingsOf(truth)).toEqual([["PERSON_LOCATION_CONFLICT", "person:a", "event:e1", "event:e3"]]);
  });
});

describe("ITEM_LOCATION_CONFLICT", () => {
  it.each<[string, object, object, string, string[][]]>([
    ["overlap at different locations", iv(0, 10), iv(5, 15), "y", [["ITEM_LOCATION_CONFLICT", "item:k", "event:e1", "event:e2"]]],
    ["adjacent intervals at different locations", iv(0, 10), iv(10, 20), "y", []],
    ["overlap at the same location", iv(0, 10), iv(5, 15), "x", []],
  ])("%s", (_name, timeA, timeB, locationB, expected) => {
    const truth = smallCase([ev("e1", timeA, "x", [], ["item:k"]), ev("e2", timeB, locationB, [], ["item:k"])]);
    expect(findingsOf(truth)).toEqual(expected);
  });
});

describe("PERSON_PRESENCE_NEGATED", () => {
  it.each<[string, string, string, number, string[][]]>([
    ["inside the event", "a", "x", 15, [["PERSON_PRESENCE_NEGATED", "proposition:p1", "event:e1"]]],
    ["at the event start", "a", "x", 10, [["PERSON_PRESENCE_NEGATED", "proposition:p1", "event:e1"]]],
    ["at the event end (half-open)", "a", "x", 20, []],
    ["for a non-participant", "b", "x", 15, []],
    ["at another location", "a", "y", 15, []],
  ])("false personAt %s", (_name, person, location, tick, expected) => {
    const truth = smallCase([ev("e1", iv(10, 20), "x", ["person:a"])], [personAt("p1", person, location, tick, false)]);
    expect(findingsOf(truth)).toEqual(expected);
  });
});

describe("claim/event list consistency", () => {
  const events = [ev("e1", at(5), "x", ["person:a"], ["item:k"])];

  it.each<[string, object, string[][]]>([
    ["true but not a participant", hasParticipant("p1", "e1", "b", true), [["PARTICIPANT_CLAIM_MISMATCH", "proposition:p1", "event:e1"]]],
    ["false but a participant", hasParticipant("p1", "e1", "a", false), [["PARTICIPANT_CLAIM_MISMATCH", "proposition:p1", "event:e1"]]],
    ["true and a participant", hasParticipant("p1", "e1", "a", true), []],
    ["false and not a participant", hasParticipant("p1", "e1", "b", false), []],
  ])("eventHasParticipant %s", (_name, proposition, expected) => {
    expect(findingsOf(smallCase(events, [proposition]))).toEqual(expected);
  });

  it.each<[string, object, string[][]]>([
    ["true but not listed", hasItem("p1", "e1", "m", true), [["ITEM_CLAIM_MISMATCH", "proposition:p1", "event:e1"]]],
    ["false but listed", hasItem("p1", "e1", "k", false), [["ITEM_CLAIM_MISMATCH", "proposition:p1", "event:e1"]]],
    ["true and listed", hasItem("p1", "e1", "k", true), []],
    ["false and not listed", hasItem("p1", "e1", "m", false), []],
  ])("eventHasItem %s", (_name, proposition, expected) => {
    expect(findingsOf(smallCase(events, [proposition]))).toEqual(expected);
  });
});

describe("CLAIM_TRUTH_CONFLICT", () => {
  const events = [ev("e1", at(5), "x", ["person:a"], ["item:k"])];

  it("personAt with both truth values", () => {
    const truth = smallCase([], [personAt("p2", "a", "x", 5, false), personAt("p1", "a", "x", 5, true)]);
    expect(findingsOf(truth)).toEqual([["CLAIM_TRUTH_CONFLICT", "proposition:p1", "proposition:p2"]]);
  });

  it("eventHasParticipant with both truth values", () => {
    const truth = smallCase(events, [hasParticipant("p1", "e1", "a", true), hasParticipant("p2", "e1", "a", false)]);
    expect(findingsOf(truth)).toEqual([
      ["CLAIM_TRUTH_CONFLICT", "proposition:p1", "proposition:p2"],
      ["PARTICIPANT_CLAIM_MISMATCH", "proposition:p2", "event:e1"],
    ]);
  });

  it("eventHasItem with both truth values", () => {
    const truth = smallCase(events, [hasItem("p1", "e1", "k", true), hasItem("p2", "e1", "k", false)]);
    expect(findingsOf(truth)).toEqual([
      ["CLAIM_TRUTH_CONFLICT", "proposition:p1", "proposition:p2"],
      ["ITEM_CLAIM_MISMATCH", "proposition:p2", "event:e1"],
    ]);
  });

  it("the same claim with the same truth value is allowed", () => {
    const truth = smallCase(events, [personAt("p1", "a", "x", 5, true), personAt("p2", "a", "x", 5, true)]);
    expect(findingsOf(truth)).toEqual([]);
  });

  it.each<[string, object, object]>([
    ["personAt tick", personAt("p1", "a", "x", 5, true), personAt("p2", "a", "x", 6, false)],
    ["personAt location", personAt("p1", "a", "x", 5, true), personAt("p2", "a", "y", 5, false)],
    ["participant person", hasParticipant("p1", "e1", "a", true), hasParticipant("p2", "e1", "b", false)],
    ["item", hasItem("p1", "e1", "k", true), hasItem("p2", "e1", "m", false)],
  ])("claims differing in %s with different truth values are allowed", (_name, first, second) => {
    expect(findingsOf(smallCase(events, [first, second]))).toEqual([]);
  });
});

describe("CAUSE_STARTS_AFTER_EFFECT", () => {
  it.each<[string, object, object, string[][]]>([
    ["cause starts after effect", at(10), at(5), [["CAUSE_STARTS_AFTER_EFFECT", "event:cause", "event:effect"]]],
    ["cause interval starts after effect interval", iv(6, 20), iv(5, 30), [["CAUSE_STARTS_AFTER_EFFECT", "event:cause", "event:effect"]]],
    ["equal start", at(5), iv(5, 10), []],
    ["cause lasting beyond the effect start", iv(0, 100), at(50), []],
  ])("%s", (_name, causeTime, effectTime, expected) => {
    const truth = smallCase([ev("cause", causeTime, "x"), ev("effect", effectTime, "x", [], [], ["event:cause"])]);
    expect(findingsOf(truth)).toEqual(expected);
  });
});

describe("CAUSAL_CYCLE", () => {
  it("two-event cycle with equal start times", () => {
    const truth = smallCase([ev("e1", at(5), "x", [], [], ["event:e2"]), ev("e2", at(5), "x", [], [], ["event:e1"])]);
    expect(findingsOf(truth)).toEqual([["CAUSAL_CYCLE", "event:e1", "event:e2"]]);
  });

  it("three-event cycle yields exactly one finding", () => {
    const truth = smallCase([
      ev("e1", iv(0, 10), "x", [], [], ["event:e3"]),
      ev("e2", iv(0, 10), "x", [], [], ["event:e1"]),
      ev("e3", iv(0, 10), "x", [], [], ["event:e2"]),
    ]);
    expect(findingsOf(truth)).toEqual([["CAUSAL_CYCLE", "event:e1", "event:e2", "event:e3"]]);
  });

  it("a cycle with different start times is reported together with the timing violation", () => {
    const truth = smallCase([ev("e1", at(1), "x", [], [], ["event:e2"]), ev("e2", at(2), "x", [], [], ["event:e1"])]);
    expect(findingsOf(truth)).toEqual([
      ["CAUSAL_CYCLE", "event:e1", "event:e2"],
      ["CAUSE_STARTS_AFTER_EFFECT", "event:e2", "event:e1"],
    ]);
  });

  it("two separate cycles yield one finding each", () => {
    const truth = smallCase([
      ev("a1", at(5), "x", [], [], ["event:a2"]),
      ev("a2", at(5), "x", [], [], ["event:a1"]),
      ev("b1", at(5), "x", [], [], ["event:b2"]),
      ev("b2", at(5), "x", [], [], ["event:b1"]),
    ]);
    expect(findingsOf(truth)).toEqual([
      ["CAUSAL_CYCLE", "event:a1", "event:a2"],
      ["CAUSAL_CYCLE", "event:b1", "event:b2"],
    ]);
  });

  it("a diamond-shaped DAG is no cycle", () => {
    const truth = smallCase([
      ev("a", at(0), "x"),
      ev("b", at(1), "x", [], [], ["event:a"]),
      ev("c", at(1), "x", [], [], ["event:a"]),
      ev("d", at(2), "x", [], [], ["event:b", "event:c"]),
    ]);
    expect(findingsOf(truth)).toEqual([]);
  });
});

// ---------- scope boundaries ----------

describe("deliberately unchecked semantics", () => {
  it("the full fixture has no findings", () => {
    expect(validateCaseSemantics(fromFull()).findings).toEqual([]);
  });

  it.each<[string, (c: any) => void]>([
    ["red herring with a true target", (c) => (c.redHerrings[0].misleadingPropositionId = "proposition:ben-at-murder")],
    ["red herring with a false target", () => {}],
    ["red herring whose evidence does not address its target", (c) => (c.redHerrings[0].evidenceIds = ["evidence:muddy-path"])],
    [
      "evidence supporting a false proposition outside any red herring",
      (c) => c.evidence[2].links.push({ propositionId: "proposition:anna-in-library", direction: "supports" }),
    ],
    [
      "additional motives and secrets",
      (c) => {
        c.motives.push({ id: "motive:inheritance", personId: "person:anna", eventIds: ["event:murder"], description: "Erbe" });
        c.secrets.push({ id: "secret:alibi", propositionIds: ["proposition:anna-at-murder", "proposition:anna-in-library"] });
      },
    ],
  ])("%s yields no findings", (_name, mutate) => {
    expect(validateCaseSemantics(fromFull(mutate)).findings).toEqual([]);
  });
});

// ---------- report properties ----------

describe("report", () => {
  it("collects every independent violation, sorted by code then subjectIds", () => {
    const report = validateCaseSemantics(parseCaseTruth(brokenCase()));
    expect(report.rulesetVersion).toBe("case-semantics-v1");
    expect(summary(report)).toEqual(BROKEN_EXPECTED);
    for (const finding of report.findings) {
      expect(finding.message.length).toBeGreaterThan(0);
      // subjects are entity IDs, never array indices
      for (const id of finding.subjectIds) expect(id).toMatch(/^[a-z-]+:[a-z0-9][a-z0-9_-]*$/);
    }
  });

  it("is identical for every permutation of the input", () => {
    const reference = validateCaseSemantics(parseCaseTruth(brokenCase()));
    for (const rotateBy of [0, 1, 2]) {
      const permuted = parseCaseTruth(permute(brokenCase(), rotateBy));
      expect(validateCaseSemantics(permuted)).toEqual(reference);
    }
  });

  it("is identical on repeated validation and leaves the snapshot untouched", () => {
    const truth = parseCaseTruth(brokenCase());
    const hashBefore = hashCaseTruth(truth);
    const first = validateCaseSemantics(truth);
    const second = validateCaseSemantics(truth);
    expect(second).toEqual(first);
    expect(hashCaseTruth(truth)).toBe(hashBefore);
  });

  it("is recursively frozen", () => {
    const report = validateCaseSemantics(parseCaseTruth(brokenCase()));
    const unfrozen: string[] = [];
    const visit = (value: unknown, path: string) => {
      if (typeof value !== "object" || value === null) return;
      if (!Object.isFrozen(value)) unfrozen.push(path);
      for (const [key, child] of Object.entries(value)) visit(child, `${path}.${key}`);
    };
    visit(report, "$");
    expect(unfrozen).toEqual([]);
    expect(report.findings.length).toBeGreaterThan(0);
  });

  it("carries no validity or playability marker", () => {
    expect(Object.keys(validateCaseSemantics(fromFull())).sort()).toEqual(["findings", "rulesetVersion"]);
  });
});

// Compile-time only: checked by `npm run typecheck`, never called.
export function typeOnlyChecks(input: CaseTruthInput) {
  // @ts-expect-error unparsed authoring input is not a CaseTruth snapshot
  validateCaseSemantics(input);
}
