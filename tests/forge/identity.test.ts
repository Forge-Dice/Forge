import { describe, expect, it } from "vitest";
import { AgentIdentitySchema, isIndependentReviewer, sameIdentity, type AgentIdentity, type ReviewPolicy } from "../../src/forge/identity.ts";
import { ai, human, system } from "./fixtures.ts";

const id = (value: object) => AgentIdentitySchema.parse(value);
const strict: ReviewPolicy = { aiReviewIndependence: "different_provider" };
const lenient: ReviewPolicy = { aiReviewIndependence: "different_identity" };

describe("isIndependentReviewer", () => {
  it.each<[string, AgentIdentity, AgentIdentity, boolean, boolean]>([
    // name, author, reviewer, strict result, lenient result
    ["AI vs AI, different providers", id(ai("vendor-a")), id(ai("vendor-b")), true, true],
    ["AI vs AI, same provider, different agent", id(ai("vendor-a", "x")), id(ai("vendor-a", "y")), false, true],
    ["AI vs itself", id(ai("vendor-a")), id(ai("vendor-a")), false, false],
    ["human reviews AI of any provider", id(ai("human")), id(human("alice")), true, true],
    ["human reviews human", id(human("alice")), id(human("bob")), true, true],
    ["human reviews own contract", id(human("alice")), id(human("alice")), false, false],
    ["AI reviews human author", id(human("alice")), id(ai("vendor-a")), true, true],
    ["system reviewer", id(ai("vendor-a")), id(system()), false, false],
    ["system reviews human", id(human("alice")), id(system()), false, false],
  ])("%s", (_name, author, reviewer, expectedStrict, expectedLenient) => {
    expect(isIndependentReviewer(author, reviewer, strict)).toBe(expectedStrict);
    expect(isIndependentReviewer(author, reviewer, lenient)).toBe(expectedLenient);
  });

  it("a human reviewer is never blocked by the provider rule, even with the same provider string", () => {
    const author = id({ actorType: "ai_agent", provider: "vendor-a", model: null, label: "agent" });
    const reviewer = id({ actorType: "human", provider: "vendor-a", model: null, label: "employee" });
    expect(isIndependentReviewer(author, reviewer, strict)).toBe(true);
  });

  it("different models of one provider are the same provider for the strict AI rule", () => {
    const a = id({ actorType: "ai_agent", provider: "vendor-a", model: "m1", label: "agent" });
    const b = id({ actorType: "ai_agent", provider: "vendor-a", model: "m2", label: "agent" });
    expect(sameIdentity(a, b)).toBe(false);
    expect(isIndependentReviewer(a, b, strict)).toBe(false);
    expect(isIndependentReviewer(a, b, lenient)).toBe(true);
  });
});

describe("AgentIdentitySchema", () => {
  it.each([
    ["uppercase provider (would fake independence)", { actorType: "ai_agent", provider: "Vendor-A", model: null, label: "x" }],
    ["provider with whitespace", { actorType: "ai_agent", provider: " vendor-a", model: null, label: "x" }],
    ["empty provider", { actorType: "ai_agent", provider: "", model: null, label: "x" }],
    ["blank label", { actorType: "human", provider: "human", model: null, label: "  " }],
    ["empty model string", { actorType: "ai_agent", provider: "vendor-a", model: "", label: "x" }],
    ["unknown actor type", { actorType: "robot", provider: "vendor-a", model: null, label: "x" }],
    ["role inside identity", { actorType: "human", provider: "human", model: null, label: "x", role: "owner" }],
  ])("rejects %s", (_name, value) => {
    expect(AgentIdentitySchema.safeParse(value).success).toBe(false);
  });

  it("sameIdentity compares all four fields", () => {
    const base = id(ai("vendor-a"));
    expect(sameIdentity(base, id(ai("vendor-a")))).toBe(true);
    expect(sameIdentity(base, { ...base, label: "other" })).toBe(false);
    expect(sameIdentity(base, { ...base, model: "m" })).toBe(false);
    expect(sameIdentity(base, { ...base, provider: "vendor-b" })).toBe(false);
    expect(sameIdentity(base, { ...base, actorType: "human" })).toBe(false);
  });
});
