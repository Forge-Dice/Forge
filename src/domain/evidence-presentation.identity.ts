import { createHash } from "node:crypto";
import type { EvidencePresentation } from "./evidence-presentation.ts";

// Canonicalization profile "forge-evidence-presentation-c14n-v1":
// - object keys sorted recursively by UTF-16 code units
// - every array is a set: elements sorted by their own canonical JSON
// - primitives use JSON.stringify, no whitespace, no trailing newline
// - strings are neither trimmed nor Unicode-normalized

export const EVIDENCE_PRESENTATION_CANONICALIZATION_PROFILE = "forge-evidence-presentation-c14n-v1";

const byCodeUnits = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    // Copy before sorting: the parsed document's arrays are frozen.
    return `[${value.map(canonicalize).sort(byCodeUnits).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const fields = Object.keys(value)
      .sort(byCodeUnits)
      .map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`);
    return `{${fields.join(",")}}`;
  }
  return JSON.stringify(value);
}

export function serializeEvidencePresentation(presentation: EvidencePresentation): string {
  return canonicalize(presentation);
}

export function hashEvidencePresentation(presentation: EvidencePresentation): string {
  return createHash("sha256")
    .update(`${EVIDENCE_PRESENTATION_CANONICALIZATION_PROFILE}\n${serializeEvidencePresentation(presentation)}`, "utf8")
    .digest("hex");
}
