import { describe, expect, test } from "vitest";
import { clampAtZero } from "../../src/forge-drill/clamp-at-zero.ts";

// Fixed negative/zero/positive assertions of the clampAtZero drill seed. The negative case is the
// named test that must kill the mutant `return n` (forge/verifier/clamp-plan.example.json).
describe("clampAtZero", () => {
  test("negative input clamps to zero", () => {
    expect(clampAtZero(-5)).toBe(0);
    expect(clampAtZero(-1)).toBe(0);
  });

  test("zero stays zero", () => {
    expect(clampAtZero(0)).toBe(0);
  });

  test("positive input is unchanged", () => {
    expect(clampAtZero(1)).toBe(1);
    expect(clampAtZero(42)).toBe(42);
  });
});
