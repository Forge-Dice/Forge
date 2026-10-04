import { createHash } from "node:crypto";
import { memoFrozen } from "./frozen-memo.ts";
import type { InterrogationProfile, QuestionCatalogue } from "./interrogation-authoring.ts";
import { byCodeUnits, canonicalJson } from "./shared.ts";

// Same canonicalization as "forge-case-c14n-v1" (keys and every array sorted by UTF-16 code
// units, scalars via JSON.stringify), under its own profile names. Private copy on purpose:
// the case-truth implementation is not exported.

export const QUESTION_CATALOGUE_PROFILE = "forge-interrogation-catalogue-c14n-v1";
export const INTERROGATION_PROFILE_PROFILE = "forge-interrogation-profile-c14n-v1";

function sha256(profile: string, serialized: string): string {
  return createHash("sha256").update(`${profile}\n${serialized}`, "utf8").digest("hex");
}

export function serializeQuestionCatalogue(c: QuestionCatalogue): string {
  return canonicalJson(c);
}

/** Memoized for deep-frozen (parsed) values, which the session hashes on every action. */
export const hashQuestionCatalogue: (c: QuestionCatalogue) => string = memoFrozen((c: QuestionCatalogue): string => {
  return sha256(QUESTION_CATALOGUE_PROFILE, serializeQuestionCatalogue(c));
});

export function serializeInterrogationProfile(p: InterrogationProfile): string {
  return canonicalJson(p);
}

export function hashInterrogationProfile(p: InterrogationProfile): string {
  return sha256(INTERROGATION_PROFILE_PROFILE, serializeInterrogationProfile(p));
}
