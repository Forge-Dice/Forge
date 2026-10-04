import { describe, expect, it } from "vitest";
import { world } from "./npc-knowledge.fixture.ts";
import { authoring, catalogueInput, profileInput } from "./interrogation-authoring.fixture.ts";
import { parseInterrogationProfile, parseQuestionCatalogue } from "../src/domain/interrogation-authoring.ts";

// Contract MYST-0005A §8 cases #29 and #30: immutability and isolation from the input.

function frozenEverywhere(value: unknown, path = "$"): string[] {
  if (typeof value !== "object" || value === null) return [];
  const own = Object.isFrozen(value) ? [] : [path];
  return own.concat(...Object.entries(value).map(([k, v]) => frozenEverywhere(v, `${path}.${k}`)));
}

describe("interrogation authoring immutability", () => {
  const { truth } = world();

  it("#30 both documents are frozen at every level", () => {
    const { catalogue, profile } = authoring();
    expect(frozenEverywhere(catalogue)).toEqual([]);
    expect(frozenEverywhere(profile)).toEqual([]);
    expect(Object.isFrozen((profile.rules[8] as any).claim)).toBe(true);
    expect(Object.isFrozen((profile.rules[8] as any).reveal[0])).toBe(true);
  });

  it("#29 mutating the input after parsing leaves the documents untouched", () => {
    const cIn = catalogueInput();
    const catalogue = parseQuestionCatalogue(cIn, truth);
    const pIn = profileInput();
    const profile = parseInterrogationProfile(pIn, truth, catalogue);
    cIn.questions[0].mentions[0].id = "person:anna";
    cIn.questions.pop();
    pIn.rules[8].reveal.push({ kind: "person", id: "person:ben" });
    pIn.rules[0].claim.personId = "person:anna";
    expect(catalogue.questions).toHaveLength(11);
    expect(catalogue.questions[0]!.mentions[0]!.id).toBe("person:ben");
    expect((profile.rules[8] as any).reveal).toHaveLength(1);
    expect((profile.rules[0] as any).claim.personId).toBe("person:ben");
  });

  it("#29 parsing does not mutate or freeze the input", () => {
    const cIn = catalogueInput();
    const pIn = profileInput();
    const cBefore = structuredClone(cIn);
    const pBefore = structuredClone(pIn);
    parseInterrogationProfile(pIn, truth, parseQuestionCatalogue(cIn, truth));
    expect(cIn).toEqual(cBefore);
    expect(pIn).toEqual(pBefore);
    expect(Object.isFrozen(cIn.questions[0])).toBe(false);
    expect(Object.isFrozen(pIn.rules[0].claim)).toBe(false);
  });

  it("parsed documents share no object with the input", () => {
    const cIn = catalogueInput();
    const catalogue = parseQuestionCatalogue(cIn, truth);
    expect(catalogue.questions).not.toBe(cIn.questions);
    expect(catalogue.questions[0]!.mentions[0]).not.toBe(cIn.questions[0].mentions[0]);
  });

  it("frozen documents reject writes", () => {
    const { profile } = authoring();
    expect(() => {
      (profile.rules as any).push({ questionId: "question:x", act: "decline" });
    }).toThrow(TypeError);
    expect(() => {
      (profile.rules[8] as any).reveal[0].id = "location:garden";
    }).toThrow(TypeError);
  });

  it("a parsed profile cannot be rebound to another truth's catalogue", () => {
    const { profile } = authoring();
    const other = world((t) => (t.persons[0].name = "Anna B.")).truth;
    const catalogue = parseQuestionCatalogue(catalogueInput(), truth);
    expect(() => parseInterrogationProfile(structuredClone(profile), other, catalogue)).toThrow();
  });
});
