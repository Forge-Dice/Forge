import { createHash } from "node:crypto";
import type { InterrogationProfile, QuestionCatalogue } from "./interrogation-authoring.ts";

// Same canonicalization as "forge-case-c14n-v1" (keys and every array sorted by UTF-16 code
// units, scalars via JSON.stringify), under its own profile names. Private copy on purpose:
// the case-truth implementation is not exported.

export const QUESTION_CATALOGUE_PROFILE = "forge-interrogation-catalogue-c14n-v1";
export const INTERROGATION_PROFILE_PROFILE = "forge-interrogation-profile-c14n-v1";

function byCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).sort(byCodeUnits).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.keys(value)
      .sort(byCodeUnits)
      .map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(profile: string, serialized: string): string {
  return createHash("sha256").update(`${profile}\n${serialized}`, "utf8").digest("hex");
}

export function serializeQuestionCatalogue(c: QuestionCatalogue): string {
  return canonicalize(c);
}

export function hashQuestionCatalogue(c: QuestionCatalogue): string {
  return sha256(QUESTION_CATALOGUE_PROFILE, serializeQuestionCatalogue(c));
}

export function serializeInterrogationProfile(p: InterrogationProfile): string {
  return canonicalize(p);
}

export function hashInterrogationProfile(p: InterrogationProfile): string {
  return sha256(INTERROGATION_PROFILE_PROFILE, serializeInterrogationProfile(p));
}
