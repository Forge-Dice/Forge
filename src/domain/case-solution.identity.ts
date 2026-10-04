import { createHash } from "node:crypto";
import { memoFrozen } from "./frozen-memo.ts";
import type { CaseSolution } from "./case-solution.ts";

// Canonicalization profile "forge-solution-c14n-v1" (same rules as forge-case-c14n-v1,
// separate profile so case and solution hashes can never be confused):
// - object keys sorted recursively by UTF-16 code units (no localeCompare)
// - every array is a set: elements sorted by their own canonical JSON
// - primitives use JSON.stringify, no whitespace, no trailing newline
// - strings are neither trimmed nor Unicode-normalized

export const SOLUTION_CANONICALIZATION_PROFILE = "forge-solution-c14n-v1";

function byCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    // Copy before sorting: the snapshot's arrays are frozen and must never be reordered.
    return `[${value.map(canonicalize).sort(byCodeUnits).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.keys(value)
      .sort(byCodeUnits)
      .map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export function serializeCaseSolution(solution: CaseSolution): string {
  return canonicalize(solution);
}

/** Memoized for deep-frozen (parsed) values, which the session hashes on every action. */
export const hashCaseSolution: (solution: CaseSolution) => string = memoFrozen((solution: CaseSolution): string => {
  return createHash("sha256")
    .update(`${SOLUTION_CANONICALIZATION_PROFILE}\n${serializeCaseSolution(solution)}`, "utf8")
    .digest("hex");
});
