import { describe, expect, it } from "vitest";
import { parseCaseSolution } from "../src/domain/case-solution.ts";
import { hashCaseSolution, serializeCaseSolution } from "../src/domain/case-solution.identity.ts";
import {
  baseSolution,
  GOLDEN_SOLUTION_CANONICAL,
  GOLDEN_SOLUTION_SHA256,
  goldenSolution,
  SOLUTION_TRUTH_HASH,
  solutionTruth,
} from "./case-solution.fixture.ts";

const truth = solutionTruth();
const parse = (input: unknown) => parseCaseSolution(input, truth);

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

describe("canonical serialization and hashing", () => {
  it("the fixture truth hash literal matches the TASK-0001 hash", () => {
    expect(baseSolution().truthHash).toBe(SOLUTION_TRUTH_HASH);
  });

  it("AC-13: golden answer key matches the hand-written canonical string and SHA-256", () => {
    const solution = parse(goldenSolution());
    expect(serializeCaseSolution(solution)).toBe(GOLDEN_SOLUTION_CANONICAL);
    expect(hashCaseSolution(solution)).toBe(GOLDEN_SOLUTION_SHA256);
  });

  it("AC-12: key order and permutations of every array produce identical serialization and hash", () => {
    const reference = parse(goldenSolution());
    const seen = new Set<string>();
    for (const rotateBy of [0, 1]) {
      const permuted = permute(goldenSolution(), rotateBy) as any;
      expect(Object.keys(permuted)[0]).toBe("resolutions");
      const resolution = permuted.resolutions[0];
      seen.add(JSON.stringify([permuted.conclusions, resolution.targets, resolution.responsibility.assignments]));
      const solution = parse(permuted);
      expect(serializeCaseSolution(solution)).toBe(serializeCaseSolution(reference));
      expect(hashCaseSolution(solution)).toBe(hashCaseSolution(reference));
    }
    expect(seen.size).toBe(2);
  });

  it.each([
    ["golden", goldenSolution],
    ["base", baseSolution],
  ])("AC-13: parse(JSON.parse(serialize(%s))) round-trips", (_name, fixture) => {
    const solution = parse(fixture());
    const reparsed = parse(JSON.parse(serializeCaseSolution(solution)));
    expect(serializeCaseSolution(reparsed)).toBe(serializeCaseSolution(solution));
    expect(hashCaseSolution(reparsed)).toBe(hashCaseSolution(solution));
  });

  it("hashing is stable and yields 64 lowercase hex characters", () => {
    const hash = hashCaseSolution(parse(goldenSolution()));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCaseSolution(parse(goldenSolution()))).toBe(hash);
  });

  it.each<[string, (s: any) => void]>([
    ["revision", (s) => (s.revision = 3)],
    ["mechanism", (s) => (s.resolutions[0].mechanism = "ordinary")],
    ["causesComplete", (s) => (s.resolutions[0].causesComplete = true)],
    ["roles", (s) => (s.resolutions[0].responsibility.assignments[0].roles = ["facilitator"])],
    ["a target", (s) => s.resolutions[0].targets.pop()],
    ["a non-required conclusion", (s) => s.conclusions.push({ id: "conclusion:extra", claim: { kind: "eventIntent", eventId: "event:death", value: "intended" } })],
  ])("changing %s changes the hash", (_name, mutate) => {
    const reference = hashCaseSolution(parse(goldenSolution()));
    const changed = goldenSolution();
    mutate(changed);
    expect(hashCaseSolution(parse(changed))).not.toBe(reference);
  });

  it("serialization does not reorder the snapshot's arrays", () => {
    const solution = parse(goldenSolution());
    const order = solution.resolutions[0]!.responsibility.assignments.map((a) => a.personId);
    serializeCaseSolution(solution);
    hashCaseSolution(solution);
    expect(solution.resolutions[0]!.responsibility.assignments.map((a) => a.personId)).toEqual(order);
    expect(order).toEqual(["person:b", "person:a"]);
  });
});
