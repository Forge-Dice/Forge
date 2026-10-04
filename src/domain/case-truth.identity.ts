import { createHash } from "node:crypto";
import { memoFrozen } from "./frozen-memo.ts";
import type { CaseTruth } from "./case-truth.ts";
import { byCodeUnits, canonicalJson } from "./shared.ts";

// Canonicalization profile "forge-case-c14n-v1":
// - object keys sorted recursively by UTF-16 code units (no localeCompare)
// - every array is a set: elements sorted by their own canonical JSON
// - primitives use JSON.stringify, no whitespace, no trailing newline
// - strings are neither trimmed nor Unicode-normalized
// This is a domain profile, not RFC 8785 (JCS preserves array order).

export const CANONICALIZATION_PROFILE = "forge-case-c14n-v1";

export function serializeCaseTruth(truth: CaseTruth): string {
  return canonicalJson(truth);
}

/** Memoized for deep-frozen (parsed) values, which the session hashes on every action. */
export const hashCaseTruth: (truth: CaseTruth) => string = memoFrozen((truth: CaseTruth): string => {
  return createHash("sha256")
    .update(`${CANONICALIZATION_PROFILE}\n${serializeCaseTruth(truth)}`, "utf8")
    .digest("hex");
});
