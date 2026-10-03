import { describe, expect, it } from "vitest";
import { CaseTruthSchema, parseCaseTruth } from "../src/domain/case-truth.ts";
import { fullCase } from "./case-truth.fixture.ts";

type Mutation = (c: any) => void;

function variant(mutate: Mutation) {
  const c = fullCase();
  mutate(c);
  return c;
}

function expectRejectedAt(input: unknown, path: (string | number)[]) {
  const result = CaseTruthSchema.safeParse(input);
  expect(result.success).toBe(false);
  const paths = result.error!.issues.map((issue) => JSON.stringify(issue.path));
  expect(paths).toContain(JSON.stringify(path));
}

const ROOT_KEYS = [
  "schemaVersion",
  "caseId",
  "revision",
  "title",
  "timeline",
  "persons",
  "locations",
  "items",
  "relationships",
  "events",
  "motives",
  "propositions",
  "evidence",
  "secrets",
  "redHerrings",
];

describe("accepted structure", () => {
  it("AC-02/03: accepts a case with every entity type, all claim kinds, both time kinds and both truth values", () => {
    const truth = parseCaseTruth(fullCase());
    for (const key of ROOT_KEYS.slice(5)) {
      expect((truth as any)[key].length, key).toBeGreaterThan(0);
    }
    expect(new Set(truth.propositions.map((p) => p.claim.kind))).toEqual(
      new Set(["personAt", "eventHasParticipant", "eventHasItem"]),
    );
    expect(new Set(truth.events.map((e) => e.time.kind))).toEqual(new Set(["instant", "interval"]));
    expect(new Set(truth.propositions.map((p) => p.truth))).toEqual(new Set([true, false]));
  });

  it("AC-04: one evidence can support and refute propositions about different events", () => {
    const truth = parseCaseTruth(fullCase());
    const statement = truth.evidence.find((e) => e.id === "evidence:anna-statement")!;
    const propositions = statement.links.map((link) => truth.propositions.find((p) => p.id === link.propositionId)!);
    const eventIds = propositions.map((p) => (p.claim.kind === "personAt" ? null : p.claim.eventId));
    expect(new Set(eventIds)).toEqual(new Set(["event:argument", "event:murder"]));
    expect(new Set(statement.links.map((l) => l.direction))).toEqual(new Set(["supports", "refutes"]));
  });

  it("AC-05: real evidence may support a false proposition as part of a red herring", () => {
    const truth = parseCaseTruth(fullCase());
    const herring = truth.redHerrings[0]!;
    const target = truth.propositions.find((p) => p.id === herring.misleadingPropositionId)!;
    const fingerprint = truth.evidence.find((e) => e.id === herring.evidenceIds[0])!;
    expect(target.truth).toBe(false);
    expect(fingerprint.links).toContainEqual({ propositionId: target.id, direction: "supports" });
    // supporting evidence never rewrites the objective truth value
    expect(target.truth).toBe(false);
  });

  it("accepts a structurally empty case", () => {
    const empty = variant((c) => {
      for (const key of ROOT_KEYS.slice(5)) c[key] = [];
    });
    expect(CaseTruthSchema.safeParse(empty).success).toBe(true);
  });

  it("AC-09: accepts instant times, including tick 0", () => {
    expect(CaseTruthSchema.safeParse(variant((c) => (c.events[1].time = { kind: "instant", at: 0 }))).success).toBe(true);
  });
});

describe("form and local rules", () => {
  it.each<[string, Mutation, (string | number)[]]>([
    ["root", (c) => (c.npcBelief = "x"), []],
    ["timeline", (c) => (c.timeline.zone = "UTC"), ["timeline"]],
    ["entity", (c) => (c.persons[0].discovered = true), ["persons", 0]],
    ["time span", (c) => (c.events[0].time.label = "x"), ["events", 0, "time"]],
    ["claim", (c) => (c.propositions[0].claim.confidence = 0.5), ["propositions", 0, "claim"]],
    ["evidence link", (c) => (c.evidence[0].links[0].weight = 1), ["evidence", 0, "links", 0]],
    ["source ref", (c) => (c.evidence[0].source.personId = "person:anna"), ["evidence", 0, "source"]],
  ])("AC-06: rejects unknown property on %s", (_name, mutate, path) => {
    expectRejectedAt(variant(mutate), path);
  });

  it.each<[string, Mutation, (string | number)[]]>([
    ["missing root field", (c) => delete c.title, ["title"]],
    ["missing nested field", (c) => delete c.events[0].time, ["events", 0, "time"]],
    ["null text", (c) => (c.persons[0].name = null), ["persons", 0, "name"]],
    ["null collection", (c) => (c.items = null), ["items"]],
    ["unknown time kind", (c) => (c.events[0].time.kind = "moment"), ["events", 0, "time", "kind"]],
    ["unknown claim kind", (c) => (c.propositions[0].claim.kind = "personIn"), ["propositions", 0, "claim", "kind"]],
    ["unknown source kind", (c) => (c.evidence[0].source.kind = "room"), ["evidence", 0, "source", "kind"]],
    ["unknown direction", (c) => (c.evidence[0].links[0].direction = "maybe"), ["evidence", 0, "links", 0, "direction"]],
    ["truth as string", (c) => (c.propositions[0].truth = "unknown"), ["propositions", 0, "truth"]],
    ["wrong ID prefix", (c) => (c.persons[0].id = "location:anna"), ["persons", 0, "id"]],
    ["wrong reference prefix", (c) => (c.events[0].locationId = "person:anna"), ["events", 0, "locationId"]],
    ["source kind/id mismatch", (c) => (c.evidence[0].source = { kind: "person", id: "location:library" }), ["evidence", 0, "source", "id"]],
    ["malformed slug", (c) => (c.caseId = "case:Letter Opener"), ["caseId"]],
    ["whitespace-only text", (c) => (c.title = " \n\t "), ["title"]],
    ["revision 0", (c) => (c.revision = 0), ["revision"]],
    ["unknown time unit", (c) => (c.timeline.unit = "minute"), ["timeline", "unit"]],
    ["empty motive events", (c) => (c.motives[0].eventIds = []), ["motives", 0, "eventIds"]],
    ["empty evidence links", (c) => (c.evidence[0].links = []), ["evidence", 0, "links"]],
    ["empty secret", (c) => (c.secrets[0].propositionIds = []), ["secrets", 0, "propositionIds"]],
    ["empty red herring", (c) => (c.redHerrings[0].evidenceIds = []), ["redHerrings", 0, "evidenceIds"]],
  ])("AC-07: rejects %s", (_name, mutate, path) => {
    expectRejectedAt(variant(mutate), path);
  });

  it.each<[string, unknown]>([
    ["negative", -1],
    ["fractional", 1.5],
    ["unsafe", 2 ** 53],
    ["infinite", Infinity],
    ["NaN", NaN],
    ["negative zero", -0],
    ["numeric string", "5"],
  ])("AC-08: rejects %s ticks everywhere ticks occur", (_name, tick) => {
    expectRejectedAt(variant((c) => (c.events[1].time.at = tick)), ["events", 1, "time", "at"]);
    expectRejectedAt(variant((c) => (c.events[0].time.start = tick)), ["events", 0, "time", "start"]);
    expectRejectedAt(variant((c) => (c.propositions[4].claim.at = tick)), ["propositions", 4, "claim", "at"]);
  });

  // Later timeline logic relies on every tick and revision being a JS safe integer.
  it.each<[string, Mutation, (string | number)[]]>([
    ["interval end", (c) => (c.events[0].time.end = 2 ** 53), ["events", 0, "time", "end"]],
    ["relationship time end", (c) => (c.relationships[0].time.end = 2 ** 53), ["relationships", 0, "time", "end"]],
    ["revision", (c) => (c.revision = 2 ** 53), ["revision"]],
  ])("AC-08: rejects an unsafe integer (2**53) as %s", (_name, mutate, path) => {
    expectRejectedAt(variant(mutate), path);
  });

  it.each<[string, Mutation]>([
    ["instant at", (c) => (c.events[1].time.at = Number.MAX_SAFE_INTEGER)],
    ["interval end", (c) => (c.events[0].time.end = Number.MAX_SAFE_INTEGER)],
    ["revision", (c) => (c.revision = Number.MAX_SAFE_INTEGER)],
  ])("AC-08: accepts Number.MAX_SAFE_INTEGER as %s", (_name, mutate) => {
    expect(CaseTruthSchema.safeParse(variant(mutate)).success).toBe(true);
  });

  it.each([
    [1200, 1200],
    [1200, 600],
  ])("AC-09: rejects interval [%i, %i)", (start, end) => {
    expectRejectedAt(variant((c) => (c.events[0].time = { kind: "interval", start, end })), ["events", 0, "time", "end"]);
  });

  it.each<[string, Mutation, (string | number)[]]>([
    ["duplicate entity ID", (c) => c.persons.push({ id: "person:anna", name: "Anna II" }), ["persons", 3, "id"]],
    ["duplicate participant", (c) => c.events[0].participantIds.push("person:ben"), ["events", 0, "participantIds", 2]],
    ["duplicate item", (c) => c.events[1].itemIds.push("item:letter-opener"), ["events", 1, "itemIds", 1]],
    ["duplicate cause", (c) => c.events[1].causedByEventIds.push("event:argument"), ["events", 1, "causedByEventIds", 1]],
    ["duplicate motive event", (c) => c.motives[0].eventIds.push("event:murder"), ["motives", 0, "eventIds", 1]],
    ["duplicate secret proposition", (c) => c.secrets[0].propositionIds.push("proposition:ben-at-argument"), ["secrets", 0, "propositionIds", 1]],
    ["duplicate herring evidence", (c) => c.redHerrings[0].evidenceIds.push("evidence:fingerprint"), ["redHerrings", 0, "evidenceIds", 1]],
    [
      "evidence addressing a proposition twice with opposite directions",
      (c) => c.evidence[0].links.push({ propositionId: "proposition:anna-at-murder", direction: "refutes" }),
      ["evidence", 0, "links", 2, "propositionId"],
    ],
  ])("AC-10: rejects %s", (_name, mutate, path) => {
    expectRejectedAt(variant(mutate), path);
  });

  it("AC-12: rejects a relationship from a person to themselves", () => {
    expectRejectedAt(variant((c) => (c.relationships[0].toPersonId = "person:ben")), ["relationships", 0, "toPersonId"]);
  });

  it("AC-12: rejects an event listing itself as its cause", () => {
    expectRejectedAt(variant((c) => c.events[1].causedByEventIds.push("event:murder")), ["events", 1, "causedByEventIds", 1]);
  });

  it("AC-22: rejects an unknown schemaVersion", () => {
    expectRejectedAt(variant((c) => (c.schemaVersion = 2)), ["schemaVersion"]);
  });
});

describe("reference integrity", () => {
  // Each mutation points one reference at a well-formed ID that does not exist in the case.
  it.each<[string, Mutation, (string | number)[]]>([
    ["relationship.fromPersonId", (c) => (c.relationships[0].fromPersonId = "person:ghost"), ["relationships", 0, "fromPersonId"]],
    ["relationship.toPersonId", (c) => (c.relationships[0].toPersonId = "person:ghost"), ["relationships", 0, "toPersonId"]],
    ["event.locationId", (c) => (c.events[0].locationId = "location:ghost"), ["events", 0, "locationId"]],
    ["event.participantIds", (c) => (c.events[0].participantIds[1] = "person:ghost"), ["events", 0, "participantIds", 1]],
    ["event.itemIds", (c) => (c.events[1].itemIds[0] = "item:ghost"), ["events", 1, "itemIds", 0]],
    ["event.causedByEventIds", (c) => (c.events[1].causedByEventIds[0] = "event:ghost"), ["events", 1, "causedByEventIds", 0]],
    ["motive.personId", (c) => (c.motives[0].personId = "person:ghost"), ["motives", 0, "personId"]],
    ["motive.eventIds", (c) => (c.motives[0].eventIds[0] = "event:ghost"), ["motives", 0, "eventIds", 0]],
    ["personAt.personId", (c) => (c.propositions[4].claim.personId = "person:ghost"), ["propositions", 4, "claim", "personId"]],
    ["personAt.locationId", (c) => (c.propositions[4].claim.locationId = "location:ghost"), ["propositions", 4, "claim", "locationId"]],
    ["eventHasParticipant.eventId", (c) => (c.propositions[0].claim.eventId = "event:ghost"), ["propositions", 0, "claim", "eventId"]],
    ["eventHasParticipant.personId", (c) => (c.propositions[0].claim.personId = "person:ghost"), ["propositions", 0, "claim", "personId"]],
    ["eventHasItem.eventId", (c) => (c.propositions[2].claim.eventId = "event:ghost"), ["propositions", 2, "claim", "eventId"]],
    ["eventHasItem.itemId", (c) => (c.propositions[2].claim.itemId = "item:ghost"), ["propositions", 2, "claim", "itemId"]],
    ["source person", (c) => (c.evidence[1].source = { kind: "person", id: "person:ghost" }), ["evidence", 1, "source", "id"]],
    ["source location", (c) => (c.evidence[2].source = { kind: "location", id: "location:ghost" }), ["evidence", 2, "source", "id"]],
    ["source item", (c) => (c.evidence[0].source = { kind: "item", id: "item:ghost" }), ["evidence", 0, "source", "id"]],
    ["source event", (c) => (c.evidence[3].source = { kind: "event", id: "event:ghost" }), ["evidence", 3, "source", "id"]],
    ["evidence link", (c) => (c.evidence[0].links[1].propositionId = "proposition:ghost"), ["evidence", 0, "links", 1, "propositionId"]],
    ["secret.propositionIds", (c) => (c.secrets[0].propositionIds[0] = "proposition:ghost"), ["secrets", 0, "propositionIds", 0]],
    ["redHerring.evidenceIds", (c) => (c.redHerrings[0].evidenceIds[0] = "evidence:ghost"), ["redHerrings", 0, "evidenceIds", 0]],
    ["redHerring.misleadingPropositionId", (c) => (c.redHerrings[0].misleadingPropositionId = "proposition:ghost"), ["redHerrings", 0, "misleadingPropositionId"]],
  ])("AC-11: rejects unresolved %s", (_name, mutate, path) => {
    expectRejectedAt(variant(mutate), path);
  });

  it("accepts forward references regardless of array order", () => {
    const reordered = variant((c) => {
      for (const key of ROOT_KEYS.slice(5)) c[key].reverse();
    });
    expect(CaseTruthSchema.safeParse(reordered).success).toBe(true);
  });
});

describe.each([
  ["parseCaseTruth", parseCaseTruth],
  ["CaseTruthSchema.parse", (input: unknown) => CaseTruthSchema.parse(input)],
])("immutability via %s", (_name, parse) => {
  it("AC-13: later changes to the input do not reach the snapshot; the input stays mutable", () => {
    const input = fullCase();
    const truth = parse(input);
    input.title = "geändert";
    input.persons[0]!.name = "Mallory";
    input.events[1]!.participantIds.push("person:anna");
    input.propositions[1]!.truth = true;

    expect(truth.title).toBe("Der Fall „Brieföffner“");
    expect(truth.persons[0]!.name).toBe("Anna");
    expect(truth.events[1]!.participantIds).toEqual(["person:ben", "person:clara"]);
    expect(truth.propositions[1]!.truth).toBe(false);
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(input.persons)).toBe(false);
  });

  it("AC-14: every object and array in the snapshot is frozen", () => {
    const truth = parse(fullCase());
    const unfrozen: string[] = [];
    const visit = (value: unknown, path: string) => {
      if (typeof value !== "object" || value === null) return;
      if (!Object.isFrozen(value)) unfrozen.push(path);
      for (const [key, child] of Object.entries(value)) visit(child, `${path}.${key}`);
    };
    visit(truth, "$");
    expect(unfrozen).toEqual([]);
  });

  it("AC-14: mutation attempts throw and change nothing", () => {
    const truth: any = parse(fullCase());
    const attempts: (() => unknown)[] = [
      () => (truth.title = "x"),
      () => (truth.timeline.originLabel = "x"),
      () => (truth.persons[0].name = "x"),
      () => truth.persons.push({ id: "person:x", name: "x" }),
      () => (truth.events[0].time.start = 0),
      () => truth.events[1].participantIds.pop(),
      () => (truth.propositions[1].truth = true),
      () => (truth.propositions[0].claim.personId = "person:anna"),
      () => (truth.evidence[0].links[0].direction = "refutes"),
      () => truth.evidence[0].links.sort(),
      () => delete truth.redHerrings[0].misleadingPropositionId,
    ];
    const before = JSON.stringify(truth);
    for (const attempt of attempts) {
      expect(attempt).toThrow(TypeError);
    }
    expect(JSON.stringify(truth)).toBe(before);
  });
});

describe("AC-23: structural success is not semantic validity", () => {
  it("accepts a person in two places at once (spatial conflict is checked later)", () => {
    const conflict = variant((c) =>
      c.events.push({
        id: "event:anna-reads",
        description: "Anna liest in der Bibliothek",
        time: { kind: "interval", start: 1400, end: 1600 },
        locationId: "location:library",
        participantIds: ["person:anna"],
        itemIds: [],
        causedByEventIds: [],
      }),
    );
    expect(CaseTruthSchema.safeParse(conflict).success).toBe(true);
  });

  it("accepts an indirect causal cycle (acyclicity is checked later)", () => {
    const cycle = variant((c) => (c.events[0].causedByEventIds = ["event:murder"]));
    expect(CaseTruthSchema.safeParse(cycle).success).toBe(true);
  });

  it("accepts a red herring whose target is true (no red-herring truth rule exists; see TASK-0002 revision)", () => {
    const trueTargetHerring = variant((c) => (c.redHerrings[0].misleadingPropositionId = "proposition:ben-at-murder"));
    expect(CaseTruthSchema.safeParse(trueTargetHerring).success).toBe(true);
  });

  it("the snapshot carries no validity or playability marker", () => {
    const truth = parseCaseTruth(fullCase());
    expect(Object.keys(truth).sort()).toEqual([...ROOT_KEYS].sort());
    expect(Object.getOwnPropertySymbols(truth)).toEqual([]);
  });
});
