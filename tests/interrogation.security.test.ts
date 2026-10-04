import { describe, expect, it } from "vitest";
import { MARKER, belief, conclusionAttitude, inferred, knowledge } from "./npc-knowledge.fixture.ts";
import { QUESTIONS, fakeRefs, q, scene, type Scene } from "./interrogation.fixture.ts";
import { projectNpcKnowledgeWithBridge } from "../src/domain/npc-knowledge.projection.ts";
import { createReleaseTranslator, interrogate } from "../src/domain/interrogation.ts";

// Contract MYST-0005B §8: information barrier, metamorphic invariants and immutability
// (B-12, B-28, B-35..B-42).

const base = scene();
const all = (s: Scene) => QUESTIONS.map((id) => JSON.stringify(s.ask(id)));
const BASELINE = all(base);

function objectsIn(value: unknown, into = new Set<object>()): Set<object> {
  if (typeof value === "object" && value !== null && !into.has(value)) {
    into.add(value);
    for (const child of Object.values(value)) objectsIn(child, into);
  }
  return into;
}

describe("information barrier", () => {
  it("B-35 observations never carry canonical IDs, indices, stance kinds, provenance, time or names", () => {
    const json = BASELINE.join("\n");
    for (const forbidden of [
      "person:", "location:", "item:", "event:", "evidence:", "proposition:", "conclusion:", "case:",
      MARKER, '"index"', "knowledge", "belief", "provenance", "acquiredAt", "asOf", "leaning", "truth",
    ]) {
      expect(json).not.toContain(forbidden);
    }
  });
});

describe("metamorphic invariants (always rebound correctly)", () => {
  it("B-12 removing evidence awareness changes nothing", () => {
    const s = scene({ snapshot: (n) => (n.awareness = n.awareness.filter((a: any) => a.subject.kind !== "evidence")) });
    expect(all(s)).toEqual(BASELINE);
  });

  it("B-28 permuted awareness and attitudes change nothing", () => {
    const s = scene({
      snapshot: (n) => {
        n.awareness.reverse();
        n.attitudes.reverse();
      },
    });
    expect(all(s)).toEqual(BASELINE);
  });

  it("B-36 knowledge <-> belief with the same polarity changes nothing", () => {
    const s = scene({
      snapshot: (n) => {
        n.attitudes[0].stance = belief(true);
        n.attitudes[1].stance = belief(false);
      },
    });
    expect(all(s)).toEqual(BASELINE);
    const back = scene({ snapshot: (n) => (n.attitudes[2].stance = belief(true)) });
    expect(all(back)).toEqual(BASELINE);
    expect(knowledge(true)).not.toEqual(belief(true));
  });

  it("B-37 provenance and acquiredAt change nothing", () => {
    const s = scene({
      snapshot: (n) => {
        for (const entry of [...n.awareness, ...n.attitudes]) {
          entry.provenance = inferred;
          entry.acquiredAt = 480;
        }
      },
    });
    expect(all(s)).toEqual(BASELINE);
  });

  it("B-38 an attitude no question asks about changes nothing", () => {
    const s = scene({ snapshot: (n) => n.attitudes.push(conclusionAttitude("killing-intended", belief(true))) });
    expect(all(s)).toEqual(BASELINE);
  });

  it("B-39 flipped proposition truth value (no knowledge on it) changes nothing", () => {
    const s = scene({
      truth: (t) => (t.propositions.find((p: any) => p.id === "proposition:anna-in-killing").truth = true),
    });
    expect(all(s)).toEqual(BASELINE);
  });

  it("B-40 two separate, value-equal input sets are byte-identical with the exact key order", () => {
    expect(all(scene())).toEqual(BASELINE);
    const result = base.ask(q("ben-in-library"));
    expect(Object.keys(result)).toEqual(["success", "observation"]);
    const observation = (result as any).observation;
    expect(Object.keys(observation)).toEqual(["schemaVersion", "npc", "questionId", "act", "stance", "statement", "mentions"]);
    expect(Object.keys(observation.statement)).toEqual(["kind", "person", "location", "at"]);
    expect(Object.keys(observation.mentions[0])).toEqual(["kind", "ref"]);
    const causal = (base.ask(q("argument-caused-killing")) as any).observation.statement;
    expect(Object.keys(causal)).toEqual(["kind", "causeEvent", "event"]);
  });
});

describe("immutability and isolation", () => {
  it("B-41 inputs stay unchanged and share no object with the result", () => {
    const input = base.input(q("where-was-ben"));
    const { refs, ...documents } = input;
    const before = structuredClone(documents);
    const result = interrogate(input);
    expect(documents).toEqual(before);
    const inputObjects = objectsIn(input);
    for (const object of objectsIn(result)) expect(inputObjects.has(object)).toBe(false);
    expect(refs.caseId).toBe(base.truth.caseId);
  });

  it("B-42 observations, errors, bridge and translator are frozen; bridge and translator are not serializable", () => {
    const frozenEverywhere = (value: unknown): boolean =>
      typeof value !== "object" || value === null || (Object.isFrozen(value) && Object.values(value).every(frozenEverywhere));
    for (const id of [...QUESTIONS, "question:nobody"]) expect(frozenEverywhere(base.ask(id))).toBe(true);
    expect(frozenEverywhere(base.ask(q("ben-in-library"), { refs: { ...fakeRefs(base.truth), refFor: () => null } }))).toBe(true);

    const projection = projectNpcKnowledgeWithBridge(base.snapshot, base.truth, base.solution);
    if (!projection.success) throw new Error("projection");
    const translator = createReleaseTranslator(projection.bridge, fakeRefs(base.truth), []);
    for (const capability of [projection.bridge, translator]) {
      expect(Object.isFrozen(capability)).toBe(true);
      expect(() => JSON.stringify(capability)).toThrow(TypeError);
      expect(() => JSON.stringify({ nested: capability })).toThrow(TypeError);
      expect(() => structuredClone(capability)).toThrow();
    }
    expect(Object.isFrozen(projection)).toBe(true);
    expect(() => JSON.stringify(projection)).toThrow(TypeError);
  });
});
