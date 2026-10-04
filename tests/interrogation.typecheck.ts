// Compile-time tests: checked by `npm run typecheck`, never executed.
// Each @ts-expect-error fails the typecheck if the line below it becomes valid.

import type { NpcKnowledgeInput } from "../src/domain/npc-knowledge.ts";
import type { VisibleRef } from "../src/domain/npc-knowledge.projection.ts";
import type { InterrogationProfileInput, QuestionCatalogueInput } from "../src/domain/interrogation-authoring.ts";
import type {
  InterrogationInput,
  InterrogationObservation,
  PlayerClaim,
  ResponseStance,
} from "../src/domain/interrogation.ts";

// No field of an observation is (or contains) a VisibleRef.
type Values<T> = T extends object ? { [K in keyof T]: T[K] extends readonly (infer U)[] ? U | Values<U> : T[K] | Values<T[K]> }[keyof T] : never;
type ContainsVisibleRef = Extract<Values<InterrogationObservation>, VisibleRef> extends never ? false : true;
const noVisibleRef: ContainsVisibleRef = false;
// @ts-expect-error the check above really detects VisibleRefs
const detects: Extract<Values<{ ref: VisibleRef }>, VisibleRef> extends never ? false : true = false;

// decline has no stance.
type Decline = Extract<InterrogationObservation, { act: "decline" }>;
// @ts-expect-error decline observations carry no stance
type DeclineStance = Decline["stance"];

// Exactly six response stances.
type Six = ["affirms", "denies", "leans_affirms", "leans_denies", "uncertain", "does_not_know"][number];
const toSix = (s: ResponseStance): Six => s;
const fromSix = (s: Six): ResponseStance => s;
// @ts-expect-error not a response stance
const lies: ResponseStance = "lies";

// Inputs require branded, parsed documents.
declare const input: InterrogationInput;
declare const catalogueInput: QuestionCatalogueInput;
declare const profileInput: InterrogationProfileInput;
declare const snapshotInput: NpcKnowledgeInput;
// @ts-expect-error raw input is not a QuestionCatalogue
const rawCatalogue: InterrogationInput = { ...input, catalogue: catalogueInput };
// @ts-expect-error raw input is not an InterrogationProfile
const rawProfile: InterrogationInput = { ...input, profile: profileInput };
// @ts-expect-error raw input is not an NpcKnowledgeSnapshot
const rawSnapshot: InterrogationInput = { ...input, snapshot: snapshotInput };

// Statements carry PlayerRef strings only.
declare const ref: VisibleRef<"person">;
// @ts-expect-error a VisibleRef is not a PlayerRef
const visibleInStatement: PlayerClaim = { kind: "noPersonResponsibleForEvent", event: ref };

// Note: structural identity of the shared PlayerClaim variants with MYST-0004 is not checked
// here; MYST-0004 is not implemented on this base.

export { noVisibleRef, detects, toSix, fromSix, lies, rawCatalogue, rawProfile, rawSnapshot, visibleInStatement };
export type { DeclineStance };
