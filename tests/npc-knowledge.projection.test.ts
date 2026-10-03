import { describe, expect, it } from "vitest";
import { parseCaseTruth, type CaseTruth } from "../src/domain/case-truth.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import { parseCaseSolution, type CaseSolution } from "../src/domain/case-solution.ts";
import { hashCaseSolution } from "../src/domain/case-solution.identity.ts";
import { parseNpcKnowledge } from "../src/domain/npc-knowledge.ts";
import { projectNpcKnowledge, type ProjectionResult } from "../src/domain/npc-knowledge.projection.ts";
import {
  aware,
  belief,
  conclusionAttitude,
  inferred,
  knowledge,
  MARKER,
  npcInput,
  propositionAttitude,
  solutionInput,
  truthInput,
  uncertain,
  world,
  type World,
} from "./npc-knowledge.fixture.ts";

type Edit = (n: any) => void;

const base = world();

function project(w: { truth: CaseTruth; solution: CaseSolution | null }, edit: Edit): ProjectionResult {
  const snapshot = parseNpcKnowledge(npcInput(w.truth, w.solution, edit), w.truth, w.solution);
  const result = projectNpcKnowledge(snapshot, w.truth, w.solution);
  expectNoLeaks(result, snapshot, w.truth, w.solution);
  return result;
}

const MISMATCH = { success: false, code: "CONTEXT_BINDING_MISMATCH" };

const p = (index: number) => ({ kind: "person", index });
const l = (index: number) => ({ kind: "location", index });
const i = (index: number) => ({ kind: "item", index });
const e = (index: number) => ({ kind: "event", index });
const ev = (index: number) => ({ kind: "evidence", index });
const prop = (index: number) => ({ kind: "proposition", index });
const concl = (index: number) => ({ kind: "conclusion", index });

// ---------- leak detection ----------

const ALLOWED_STRINGS = new Set([
  "person", "location", "item", "event", "evidence", "proposition", "conclusion",
  "personAt", "eventHasParticipant", "eventHasItem", "personResponsibleForEvent", "personRoleForEvent",
  "noPersonResponsibleForEvent", "eventCausedEvent", "eventIntent", "eventMechanism",
  "knowledge", "belief", "uncertain",
  "direct_actor", "planner", "facilitator",
  "intended", "unintended", "not_applicable",
  "ordinary", "supernatural", "mixed",
  "CONTEXT_BINDING_MISMATCH",
]);

function collectObjects(value: unknown, into = new Set<object>()): Set<object> {
  if (typeof value === "object" && value !== null && !into.has(value)) {
    into.add(value);
    for (const child of Object.values(value)) collectObjects(child, into);
  }
  return into;
}

/** Output must be plain, frozen JSON data with only allowlisted strings and no shared objects. */
function expectNoLeaks(result: ProjectionResult, ...sources: unknown[]) {
  const domainObjects = new Set<object>();
  for (const source of sources) collectObjects(source, domainObjects);
  const problems: string[] = [];
  const visit = (value: unknown, path: string) => {
    if (typeof value === "string") {
      if (!ALLOWED_STRINGS.has(value)) problems.push(`${path}: string ${JSON.stringify(value)}`);
      return;
    }
    if (value === null || typeof value === "boolean") return;
    if (typeof value === "number") {
      if (!Number.isSafeInteger(value)) problems.push(`${path}: number ${value}`);
      return;
    }
    if (typeof value !== "object") {
      problems.push(`${path}: ${typeof value}`);
      return;
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== Array.prototype) problems.push(`${path}: prototype`);
    if (!Object.isFrozen(value)) problems.push(`${path}: not frozen`);
    if (domainObjects.has(value)) problems.push(`${path}: shared domain object`);
    if (Object.getOwnPropertySymbols(value).length > 0) problems.push(`${path}: symbols`);
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (key === "length" && Array.isArray(value)) continue;
      if (!("value" in descriptor) || !descriptor.enumerable) problems.push(`${path}.${key}: accessor or hidden`);
      else visit(descriptor.value, `${path}.${key}`);
    }
  };
  visit(result, "$");
  expect(problems).toEqual([]);
  const serialized = JSON.stringify(result);
  expect(serialized).not.toContain(MARKER);
  expect(serialized).not.toMatch(/(person|location|item|event|evidence|proposition|conclusion|case|motive|secret|relationship|red-herring):/);
}

// ---------- reference scenario (hand-computed handles) ----------

// Anna: aware of Dora, the argument, the bloody knife and the garden; believes Ben was in the
// library at 300; leans towards Ben being responsible; knows she did not take part in the killing.
const annaEdit: Edit = (n) => {
  n.awareness.push(aware("person", "dora"), aware("event", "argument"), aware("evidence", "bloody-knife"), aware("location", "garden"));
  n.attitudes.push(
    propositionAttitude("ben-at-library", belief(true)),
    conclusionAttitude("ben-responsible", uncertain(true)),
    propositionAttitude("anna-in-killing", knowledge(false)),
  );
};

// person: anna=1 (self), ben=2 (claims), dora=3 (awareness)
// location: garden=1 (awareness), library=2 (claim)
// event: argument=1 (awareness), ben-kills-clara=2 (claims); evidence: bloody-knife=1
// proposition: anna-in-killing=1, ben-at-library=2; conclusion: ben-responsible=1
const ANNA_EXPECTED = {
  success: true,
  context: {
    schemaVersion: 1,
    asOf: 500,
    self: p(1),
    awareness: [p(3), l(1), e(1), ev(1)],
    attitudes: [
      { subject: prop(1), claim: { kind: "eventHasParticipant", event: e(2), person: p(1) }, stance: { kind: "knowledge", value: false } },
      { subject: prop(2), claim: { kind: "personAt", person: p(2), location: l(2), at: 300 }, stance: { kind: "belief", value: true } },
      { subject: concl(1), claim: { kind: "personResponsibleForEvent", person: p(2), event: e(2) }, stance: { kind: "uncertain", leaning: true } },
    ],
  },
};

describe("projection output", () => {
  it("M1: a visible belief stance is not the source snapshot object", () => {
    const snapshot = parseNpcKnowledge(
      npcInput(base.truth, base.solution, (n) => n.attitudes.push(propositionAttitude("ben-at-library", belief(true)))),
      base.truth,
      base.solution,
    );
    const result = projectNpcKnowledge(snapshot, base.truth, base.solution);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected a successful projection");
    expect(result.context.attitudes[0]!.stance).toEqual(snapshot.attitudes[0]!.stance);
    expect(result.context.attitudes[0]!.stance).not.toBe(snapshot.attitudes[0]!.stance);
    expectNoLeaks(result, snapshot, base.truth, base.solution);
  });

  it("14.1: exact handles, co-reference and ordering", () => {
    const result = project(base, annaEdit);
    expect(result).toStrictEqual(ANNA_EXPECTED);
    expectNoLeaks(result, base.truth, base.solution);
  });

  it("14.12: all nine claim shapes match the allowlist exactly", () => {
    const result = project(base, (n) => {
      n.npcId = "person:dora";
      n.attitudes.push(
        propositionAttitude("ben-at-library", belief(true)),
        propositionAttitude("anna-in-killing", uncertain(null)),
        propositionAttitude("knife-used", knowledge(true)),
        conclusionAttitude("ben-responsible", belief(true)),
        conclusionAttitude("ben-role-planner", uncertain(false)),
        conclusionAttitude("nobody-responsible", belief(false)),
        conclusionAttitude("argument-caused-killing", belief(true)),
        conclusionAttitude("killing-intended", uncertain(true)),
        conclusionAttitude("killing-ordinary", belief(false)),
      );
    });
    // person: anna=1, ben=2, dora=3 (self); location: library=1; item: knife=1
    // event: argument=1, ben-kills-clara=2; proposition: anna-in-killing=1, ben-at-library=2, knife-used=3
    // conclusion: argument-caused-killing=1, ben-responsible=2, ben-role-planner=3,
    //             killing-intended=4, killing-ordinary=5, nobody-responsible=6
    expect(result).toStrictEqual({
      success: true,
      context: {
        schemaVersion: 1,
        asOf: 500,
        self: p(3),
        awareness: [],
        attitudes: [
          { subject: prop(1), claim: { kind: "eventHasParticipant", event: e(2), person: p(1) }, stance: { kind: "uncertain", leaning: null } },
          { subject: prop(2), claim: { kind: "personAt", person: p(2), location: l(1), at: 300 }, stance: { kind: "belief", value: true } },
          { subject: prop(3), claim: { kind: "eventHasItem", event: e(2), item: i(1) }, stance: { kind: "knowledge", value: true } },
          { subject: concl(1), claim: { kind: "eventCausedEvent", causeEvent: e(1), event: e(2) }, stance: { kind: "belief", value: true } },
          { subject: concl(2), claim: { kind: "personResponsibleForEvent", person: p(2), event: e(2) }, stance: { kind: "belief", value: true } },
          { subject: concl(3), claim: { kind: "personRoleForEvent", person: p(2), event: e(2), role: "planner" }, stance: { kind: "uncertain", leaning: false } },
          { subject: concl(4), claim: { kind: "eventIntent", event: e(2), value: "intended" }, stance: { kind: "uncertain", leaning: true } },
          { subject: concl(5), claim: { kind: "eventMechanism", event: e(2), value: "ordinary" }, stance: { kind: "belief", value: false } },
          { subject: concl(6), claim: { kind: "noPersonResponsibleForEvent", event: e(2) }, stance: { kind: "belief", value: false } },
        ],
      },
    });
    expectNoLeaks(result, base.truth, base.solution);
  });

  it("an empty snapshot yields only self", () => {
    const result = project(base, () => {});
    expect(result).toStrictEqual({ success: true, context: { schemaVersion: 1, asOf: 500, self: p(1), awareness: [], attitudes: [] } });
  });

  it("works without a solution for proposition-only snapshots", () => {
    const noSolution = { truth: base.truth, solution: null };
    const result = project(noSolution, (n) => n.attitudes.push(propositionAttitude("knife-used", belief(true))));
    expect(result).toStrictEqual({
      success: true,
      context: { schemaVersion: 1, asOf: 500, self: p(1), awareness: [], attitudes: [
        { subject: prop(1), claim: { kind: "eventHasItem", event: e(1), item: i(1) }, stance: { kind: "belief", value: true } },
      ] },
    });
  });
});

describe("14.14: releases only what was explicitly given", () => {
  it("event awareness plus one participant claim shows no other participants", () => {
    const result = project(base, (n) => {
      n.awareness.push(aware("event", "ben-kills-clara"));
      n.attitudes.push(propositionAttitude("ben-in-killing", belief(true)));
    });
    // Clara and the knife take part in the event but are not released.
    expect(result).toStrictEqual({ success: true, context: { schemaVersion: 1, asOf: 500, self: p(1), awareness: [e(1)], attitudes: [
      { subject: prop(1), claim: { kind: "eventHasParticipant", event: e(1), person: p(2) }, stance: { kind: "belief", value: true } },
    ] } });
  });

  it("person awareness releases no name, motive, relationship or role", () => {
    expect(project(base, (n) => n.awareness.push(aware("person", "ben")))).toStrictEqual(
      { success: true, context: { schemaVersion: 1, asOf: 500, self: p(1), awareness: [p(2)], attitudes: [] } },
    );
  });

  it("evidence awareness releases neither its source, its links nor its description", () => {
    const result = project(base, (n) => n.awareness.push(aware("evidence", "bloody-knife")));
    expect(result).toStrictEqual({ success: true, context: { schemaVersion: 1, asOf: 500, self: p(1), awareness: [ev(1)], attitudes: [] } });
    expectNoLeaks(result, base.truth, base.solution);
  });

  it.each(["person:ben", "person:clara"])("participation, secrets and evidence create nothing for %s", (npcId) => {
    expect(project(base, (n) => (n.npcId = npcId))).toStrictEqual(
      { success: true, context: { schemaVersion: 1, asOf: 500, self: p(1), awareness: [], attitudes: [] } },
    );
  });
});

describe("metamorphic barrier tests (always rebound correctly)", () => {
  it("14.2: permuting all source collections, NPC collections and property orders changes nothing", () => {
    const permute = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(permute).reverse();
      if (typeof value === "object" && value !== null) {
        return Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, permute(v)]));
      }
      return value;
    };
    const truth = parseCaseTruth(permute(truthInput()));
    const solution = parseCaseSolution(permute(solutionInput(hashCaseTruth(truth))), truth);
    const snapshot = parseNpcKnowledge(permute(npcInput(truth, solution, annaEdit)), truth, solution);
    expect(projectNpcKnowledge(snapshot, truth, solution)).toStrictEqual(ANNA_EXPECTED);
  });

  it("14.3: unreleased entities with earlier IDs do not shift any handle", () => {
    const crowded = world((t) => {
      t.persons.push({ id: "person:aaron", name: `${MARKER} Aaron` });
      t.locations.push({ id: "location:attic", name: `${MARKER} Dachboden` });
      t.items.push({ id: "item:axe", name: `${MARKER} Axt` });
      t.evidence.push({ id: "evidence:aaa", description: MARKER, source: { kind: "person", id: "person:aaron" }, links: [{ propositionId: "proposition:knife-used", direction: "supports" }] });
      t.events.push({ id: "event:aaa-early", description: MARKER, time: { kind: "instant", at: 1 }, locationId: "location:attic", participantIds: ["person:aaron"], itemIds: ["item:axe"], causedByEventIds: [] });
      t.propositions.push({ id: "proposition:aaa", claim: { kind: "personAt", personId: "person:aaron", locationId: "location:attic", at: 1 }, truth: true });
    }, (s) => s.conclusions.push({ id: "conclusion:aaa", claim: { kind: "eventIntent", eventId: "event:ben-kills-clara", value: "unintended" } }));
    expect(project(crowded, annaEdit)).toStrictEqual(ANNA_EXPECTED);
  });

  it("14.4/14.5: speaking IDs and free-text spoilers never leave", () => {
    // The fixture uses IDs like event:ben-kills-clara and SPOILER in every name and description.
    expectNoLeaks(project(base, annaEdit), base.truth, base.solution);
  });

  it("14.6: hidden author data can change without changing the context", () => {
    const edited = world((t) => {
      t.motives[0].description = `${MARKER} Eifersucht`;
      t.secrets.push({ id: "secret:anna-saw-it", propositionIds: ["proposition:ben-at-library"] });
      t.relationships[0].kind = `${MARKER} liebt`;
      t.evidence[0].links = [{ propositionId: "proposition:anna-in-killing", direction: "supports" }];
      t.redHerrings = [];
      t.events[1].causedByEventIds = [];
      t.events[1].description = `${MARKER} ganz anders`;
    }, (s) => {
      s.resolutions[0].intent = "unintended";
      s.resolutions[0].mechanism = "mixed";
      s.resolutions[0].causesComplete = false;
      s.resolutions[0].targets = [];
      s.resolutions[0].responsibility.assignments.push({ personId: "person:dora", roles: ["planner"] });
      s.requiredConclusions.push({ conclusionId: "conclusion:killing-intended", value: false });
    });
    expect(hashCaseTruth(edited.truth)).not.toBe(hashCaseTruth(base.truth));
    expect(project(edited, annaEdit)).toStrictEqual(ANNA_EXPECTED);
  });

  it("14.7: a changed objective truth value behind an identical belief is invisible", () => {
    const flipped = world((t) => (t.propositions.find((x: any) => x.id === "proposition:ben-at-library").truth = false));
    expect(project(flipped, annaEdit)).toStrictEqual(ANNA_EXPECTED);
  });

  it.each<[string, (s: any) => void]>([
    ["true", () => {}],
    ["false", (s) => (s.resolutions[0].responsibility = { completeness: "complete", assignments: [{ personId: "person:dora", roles: null }] })],
    ["undetermined", (s) => (s.resolutions[0].responsibility = { completeness: "partial", assignments: [] })],
  ])("14.8: the canonical conclusion status (%s) is invisible", (_status, edit) => {
    const w = world(undefined, (s) => {
      s.requiredConclusions = [{ conclusionId: "conclusion:killing-ordinary", value: true }];
      edit(s);
    });
    expect(project(w, annaEdit)).toStrictEqual(ANNA_EXPECTED);
  });

  it("14.9: provenance, sources and acquisition times stay private", () => {
    const result = project(base, (n) => {
      n.awareness.push(
        aware("person", "dora", 450, { kind: "told_by_person", personId: "person:clara" }),
        aware("event", "argument", 150, { kind: "witnessed_event", eventId: "event:argument" }),
        aware("evidence", "bloody-knife", 400, { kind: "observed_evidence", evidenceId: "evidence:muddy-boots" }),
        aware("location", "garden", 260, { kind: "witnessed_event", eventId: "event:walk" }),
      );
      n.attitudes.push(
        propositionAttitude("ben-at-library", belief(true), 300, { kind: "witnessed_event", eventId: "event:ben-kills-clara" }),
        conclusionAttitude("ben-responsible", uncertain(true), 499, { kind: "observed_evidence", evidenceId: "evidence:muddy-boots" }),
        propositionAttitude("anna-in-killing", knowledge(false), 77, inferred),
      );
    });
    // Clara, event:walk and evidence:muddy-boots are only provenance sources: no extra handles.
    expect(result).toStrictEqual(ANNA_EXPECTED);
  });

  it("14.15: snapshots are not history; each projects only its own entries", () => {
    const before = project(base, (n) => n.attitudes.push(propositionAttitude("ben-at-library", belief(true))));
    const after = project(base, (n) => {
      n.revision = 2;
      n.attitudes.push(propositionAttitude("knife-used", uncertain(null), 480, inferred));
    });
    const claims = (r: ProjectionResult) => (r.success ? r.context.attitudes.map((a) => a.claim.kind) : []);
    expect([claims(before), claims(after)]).toEqual([["personAt"], ["eventHasItem"]]);
    expect(projectNpcKnowledge.length).toBe(3); // no query-time parameter
  });
});

describe("14.11/AC-13: context swap", () => {
  const snapshot = parseNpcKnowledge(npcInput(base.truth, base.solution, annaEdit), base.truth, base.solution);
  const otherTruth = world((t) => (t.title = `${MARKER} anders`));
  const otherSolution = world(undefined, (s) => (s.resolutions[0].mechanism = "mixed")).solution;

  it.each<[string, CaseTruth, CaseSolution | null]>([
    ["another truth with its own solution", otherTruth.truth, otherTruth.solution],
    ["another truth with the original solution", otherTruth.truth, base.solution],
    ["the same truth with another solution of the same revision", base.truth, otherSolution],
    ["the same truth without the bound solution", base.truth, null],
  ])("%s yields exactly the mismatch result", (_name, truth, solution) => {
    const result = projectNpcKnowledge(snapshot, truth, solution);
    expect(result).toStrictEqual(MISMATCH);
    expectNoLeaks(result);
  });

  it("a solution-bound snapshot without conclusion attitudes cannot be projected without its solution", () => {
    const propositionsOnly = parseNpcKnowledge(
      npcInput(base.truth, base.solution, (n) => n.attitudes.push(propositionAttitude("knife-used", belief(true)))),
      base.truth,
      base.solution,
    );
    expect(propositionsOnly.solutionHash).not.toBeNull();
    expect(projectNpcKnowledge(propositionsOnly, base.truth, null)).toStrictEqual(MISMATCH);
  });

  it("a snapshot parsed without solution cannot be projected with one", () => {
    const solo = parseNpcKnowledge(npcInput(base.truth, null), base.truth, null);
    expect(projectNpcKnowledge(solo, base.truth, base.solution)).toStrictEqual(MISMATCH);
  });
});

it("AC-11: projection mutates neither snapshot, truth nor solution", () => {
  const snapshot = parseNpcKnowledge(npcInput(base.truth, base.solution, annaEdit), base.truth, base.solution);
  const before = [JSON.stringify(snapshot), hashCaseTruth(base.truth), hashCaseSolution(base.solution)];
  projectNpcKnowledge(snapshot, base.truth, base.solution);
  expect([JSON.stringify(snapshot), hashCaseTruth(base.truth), hashCaseSolution(base.solution)]).toEqual(before);
});

// Keeps the World import meaningful for type-only fixture use.
export type { World };
