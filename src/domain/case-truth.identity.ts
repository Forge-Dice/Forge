import { createHash } from "node:crypto";
import type { CaseTruth } from "./case-truth.ts";

// Canonicalization profile "forge-case-c14n-v1":
// - object keys sorted recursively by UTF-16 code units (no localeCompare)
// - every array is a set: elements sorted by their own canonical JSON
// - primitives use JSON.stringify, no whitespace, no trailing newline
// - strings are neither trimmed nor Unicode-normalized
// This is a domain profile, not RFC 8785 (JCS preserves array order).

export const CANONICALIZATION_PROFILE = "forge-case-c14n-v1";

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

export function serializeCaseTruth(truth: CaseTruth): string {
  return canonicalize(truth);
}

export function hashCaseTruth(truth: CaseTruth): string {
  return createHash("sha256")
    .update(`${CANONICALIZATION_PROFILE}\n${serializeCaseTruth(truth)}`, "utf8")
    .digest("hex");
}
