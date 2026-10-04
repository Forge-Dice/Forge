// Compile-time tests: checked by `npm run typecheck`, never executed.
// Each @ts-expect-error fails the typecheck if the line below it becomes valid.

import type { z } from "zod";
import type { ClaimSchema } from "../src/domain/case-truth.ts";
import type { ConclusionClaim } from "../src/domain/case-solution.ts";
import type {
  InterrogationProfile,
  InterrogationProfileInput,
  QuestionCatalogue,
  QuestionCatalogueInput,
  QuestionId,
  StatementClaim,
} from "../src/domain/interrogation-authoring.ts";

declare const catalogueInput: QuestionCatalogueInput;
declare const profileInput: InterrogationProfileInput;
declare const catalogue: QuestionCatalogue;
declare const profile: InterrogationProfile;

// Brands: parsed documents are not obtainable from raw objects.
// @ts-expect-error raw input is not a QuestionCatalogue
const rawCatalogue: QuestionCatalogue = catalogueInput;
// @ts-expect-error raw input is not an InterrogationProfile
const rawProfile: InterrogationProfile = profileInput;
// @ts-expect-error a plain string is not a QuestionId
const rawQuestionId: QuestionId = "question:x";

// Deep readonly
// @ts-expect-error catalogue questions are readonly
catalogue.questions.push(catalogue.questions[0]!);
// @ts-expect-error profile fields are readonly
profile.npcId = profile.npcId;

// act is exactly "answer" | "decline"; decline carries no claim.
type Rule = InterrogationProfile["rules"][number];
type Act = Rule["act"];
const acts: [Act, Act] = ["answer", "decline"];
// @ts-expect-error invert is not an act
const invert: Act = "invert";
type Decline = Extract<Rule, { act: "decline" }>;
// @ts-expect-error decline rules have no claim
type DeclineClaim = Decline["claim"];

// StatementClaim is mutually assignable with Claim | ConclusionClaim.
type Expected = z.output<typeof ClaimSchema> | ConclusionClaim;
declare const statement: StatementClaim;
declare const expected: Expected;
const toExpected: Expected = statement;
const toStatement: StatementClaim = expected;

export { rawCatalogue, rawProfile, rawQuestionId, acts, invert, toExpected, toStatement };
export type { DeclineClaim };
