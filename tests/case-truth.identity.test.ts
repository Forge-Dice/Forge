import { describe, expect, it } from "vitest";
import { parseCaseTruth } from "../src/domain/case-truth.ts";
import { hashCaseTruth, serializeCaseTruth } from "../src/domain/case-truth.identity.ts";
import { fullCase, GOLDEN_CANONICAL, GOLDEN_SHA256, goldenCase } from "./case-truth.fixture.ts";

// Rebuilds a JSON value with every array permuted and every object's keys in a different order.
function permute(value: unknown, rotateBy: number): unknown {
  if (Array.isArray(value)) {
    const items = value.map((item) => permute(item, rotateBy));
    const shift = items.length === 0 ? 0 : rotateBy % items.length;
    return [...items.slice(shift), ...items.slice(0, shift)].reverse();
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .reverse()
        .map(([key, child]) => [key, permute(child, rotateBy)]),
    );
  }
  return value;
}

function variant(mutate: (c: any) => void) {
  const c = fullCase();
  mutate(c);
  return parseCaseTruth(c);
}

describe("canonical serialization and hashing", () => {
  it("AC-17: key order and permutations of every collection kind do not change serialization or hash", () => {
    const reference = parseCaseTruth(fullCase());
    const seenOrders = new Set<string>();
    for (const rotateBy of [0, 1, 2]) {
      const permuted = permute(fullCase(), rotateBy) as any;
      expect(Object.keys(permuted)[0]).toBe("redHerrings");
      const murder = permuted.events.find((e: any) => e.id === "event:murder");
      expect(Object.keys(murder)[0]).toBe("causedByEventIds");
      seenOrders.add(JSON.stringify([permuted.persons, murder.participantIds, permuted.evidence[0].links]));

      const truth = parseCaseTruth(permuted);
      expect(serializeCaseTruth(truth)).toBe(serializeCaseTruth(reference));
      expect(hashCaseTruth(truth)).toBe(hashCaseTruth(reference));
    }
    // sanity check that the permutations really produced different collection orders
    expect(seenOrders.size).toBe(3);
  });

  it("AC-18/20: a fixed fixture with Unicode and escapes matches the hand-written canonical string and SHA-256", () => {
    const truth = parseCaseTruth(goldenCase());
    expect(serializeCaseTruth(truth)).toBe(GOLDEN_CANONICAL);
    expect(hashCaseTruth(truth)).toBe(GOLDEN_SHA256);
  });

  it("AC-19: repeated hashing is stable and the hash is 64 lowercase hex characters", () => {
    const truth = parseCaseTruth(fullCase());
    const hash = hashCaseTruth(truth);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCaseTruth(truth)).toBe(hash);
    expect(hashCaseTruth(parseCaseTruth(fullCase()))).toBe(hash);
  });

  it.each<[string, (c: any) => void]>([
    ["truth value", (c) => (c.propositions[1].truth = true)],
    ["time", (c) => (c.events[1].time.at = 1501)],
    ["text", (c) => (c.persons[0].name = "Anna ")],
    [
      "ID",
      (c) => {
        c.items[1].id = "item:garden-gloves";
        c.events[2].itemIds = ["item:garden-gloves"];
      },
    ],
    ["revision", (c) => (c.revision = 4)],
  ])("AC-19: changing the %s changes the hash", (_name, mutate) => {
    const reference = hashCaseTruth(parseCaseTruth(fullCase()));
    expect(hashCaseTruth(variant(mutate))).not.toBe(reference);
  });

  it.each([
    ["full fixture", fullCase],
    ["golden fixture", goldenCase],
  ])("AC-21: parse(JSON.parse(serialize(snapshot))) round-trips the %s", (_name, fixture) => {
    const truth = parseCaseTruth(fixture());
    const reparsed = parseCaseTruth(JSON.parse(serializeCaseTruth(truth)));
    expect(serializeCaseTruth(reparsed)).toBe(serializeCaseTruth(truth));
    expect(hashCaseTruth(reparsed)).toBe(hashCaseTruth(truth));
  });

  it("serialization does not reorder the snapshot's arrays", () => {
    const truth = parseCaseTruth(goldenCase());
    const personIds = truth.persons.map((p) => p.id);
    serializeCaseTruth(truth);
    hashCaseTruth(truth);
    expect(truth.persons.map((p) => p.id)).toEqual(personIds);
    expect(personIds).toEqual(["person:b", "person:a"]);
  });

  it("text is neither trimmed nor Unicode-normalized", () => {
    const composed = variant((c) => (c.persons[0].name = "René"));
    const decomposed = variant((c) => (c.persons[0].name = "René"));
    expect(hashCaseTruth(composed)).not.toBe(hashCaseTruth(decomposed));
  });
});
