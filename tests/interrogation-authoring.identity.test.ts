import { describe, expect, it } from "vitest";
import { world } from "./npc-knowledge.fixture.ts";
import {
  CATALOGUE_HASH,
  DORA_PROFILE_HASH,
  TRUTH_HASH,
  authoring,
  catalogueInput,
  profileInput,
} from "./interrogation-authoring.fixture.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import { parseInterrogationProfile, parseQuestionCatalogue } from "../src/domain/interrogation-authoring.ts";
import {
  INTERROGATION_PROFILE_PROFILE,
  QUESTION_CATALOGUE_PROFILE,
  hashInterrogationProfile,
  hashQuestionCatalogue,
  serializeInterrogationProfile,
  serializeQuestionCatalogue,
} from "../src/domain/interrogation-authoring.identity.ts";

// Contract MYST-0005A §5 and §8 cases #27, #28, #31.

function reverseArrays(value: any): any {
  if (Array.isArray(value)) return value.map(reverseArrays).reverse();
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, reverseArrays(v)]));
  }
  return value;
}

function reverseKeys(value: any): any {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reverseKeys(v)]));
  }
  return value;
}

describe("interrogation authoring identity", () => {
  const { truth } = world();

  it("#31 golden vectors", () => {
    const { catalogue, profile } = authoring();
    expect(hashCaseTruth(truth)).toBe(TRUTH_HASH);
    expect(hashQuestionCatalogue(catalogue)).toBe(CATALOGUE_HASH);
    expect(hashInterrogationProfile(profile)).toBe(DORA_PROFILE_HASH);
    expect(serializeQuestionCatalogue(catalogue)).toHaveLength(1477);
    expect(serializeInterrogationProfile(profile)).toHaveLength(2006);
  });

  it("profile names are fixed", () => {
    expect(QUESTION_CATALOGUE_PROFILE).toBe("forge-interrogation-catalogue-c14n-v1");
    expect(INTERROGATION_PROFILE_PROFILE).toBe("forge-interrogation-profile-c14n-v1");
  });

  it.each([
    ["#27 every array permuted", reverseArrays],
    ["#28 property order reversed at every level", reverseKeys],
  ])("%s yields identical hashes", (_name, permute) => {
    const catalogue = parseQuestionCatalogue(permute(catalogueInput()), truth);
    const permutedProfile = permute(profileInput());
    const profile = parseInterrogationProfile(permutedProfile, truth, catalogue);
    expect(hashQuestionCatalogue(catalogue)).toBe(CATALOGUE_HASH);
    expect(hashInterrogationProfile(profile)).toBe(DORA_PROFILE_HASH);
  });

  it("serialization is canonical: sorted keys, no whitespace", () => {
    const { catalogue } = authoring();
    const text = serializeQuestionCatalogue(catalogue);
    expect(text.startsWith('{"caseId":"case:library","questions":[')).toBe(true);
    expect(text).not.toMatch(/\s/);
  });

  it("any semantic change changes the hash", () => {
    const base = authoring();
    const revised = authoring((c) => (c.revision = 2));
    expect(hashQuestionCatalogue(revised.catalogue)).not.toBe(hashQuestionCatalogue(base.catalogue));
    const declined = authoring(
      () => {},
      (p) => (p.rules[0] = { questionId: p.rules[0].questionId, act: "decline" }),
    );
    expect(hashInterrogationProfile(declined.profile)).not.toBe(hashInterrogationProfile(base.profile));
  });

  it("hashing does not reorder the frozen document", () => {
    const { catalogue } = authoring();
    const before = catalogue.questions.map((q) => q.id);
    hashQuestionCatalogue(catalogue);
    expect(catalogue.questions.map((q) => q.id)).toEqual(before);
  });
});
