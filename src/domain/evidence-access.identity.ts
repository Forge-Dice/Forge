import { createHash } from "node:crypto";
import type { EvidenceAccessMap } from "./evidence-access.ts";

// Canonicalization profile "forge-evidence-access-c14n-v1" (same rules as forge-case-c14n-v1,
// separate profile so truth, solution and access hashes can never be confused):
// - object keys sorted recursively by UTF-16 code units
// - every array is a set: elements sorted by their own canonical JSON
//   (the map has two arrays, entries and paths; both are sets and duplicate-free after parsing)
// - primitives use JSON.stringify, no whitespace, no trailing newline
// - strings are neither trimmed nor Unicode-normalized

export const EVIDENCE_ACCESS_CANONICALIZATION_PROFILE = "forge-evidence-access-c14n-v1";

function byCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    // map() copies before sorting: the map's arrays are frozen and must never be reordered.
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

export function serializeEvidenceAccessMap(map: EvidenceAccessMap): string {
  return canonicalize(map);
}

export function hashEvidenceAccessMap(map: EvidenceAccessMap): string {
  return createHash("sha256")
    .update(`${EVIDENCE_ACCESS_CANONICALIZATION_PROFILE}\n${serializeEvidenceAccessMap(map)}`, "utf8")
    .digest("hex");
}
