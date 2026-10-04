import { createHash } from "node:crypto";
import type { CaseSolution } from "./case-solution.ts";
import { byCodeUnits, canonicalJson } from "./shared.ts";

// Canonicalization profile "forge-solution-c14n-v1" (same rules as forge-case-c14n-v1,
// separate profile so case and solution hashes can never be confused):
// - object keys sorted recursively by UTF-16 code units (no localeCompare)
// - every array is a set: elements sorted by their own canonical JSON
// - primitives use JSON.stringify, no whitespace, no trailing newline
// - strings are neither trimmed nor Unicode-normalized

export const SOLUTION_CANONICALIZATION_PROFILE = "forge-solution-c14n-v1";

export function serializeCaseSolution(solution: CaseSolution): string {
  return canonicalJson(solution);
}

export function hashCaseSolution(solution: CaseSolution): string {
  return createHash("sha256")
    .update(`${SOLUTION_CANONICALIZATION_PROFILE}\n${serializeCaseSolution(solution)}`, "utf8")
    .digest("hex");
}
