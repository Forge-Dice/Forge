import type { CaseTruth, DeepReadonly } from "./case-truth.ts";
import { hashCaseTruth } from "./case-truth.identity.ts";
import type { CaseSolution, Intent, Mechanism, ResponsibilityRole } from "./case-solution.ts";
import type { EpistemicStance, NpcKnowledgeSnapshot } from "./npc-knowledge.ts";
import {
  projectNpcKnowledgeWithBridge,
  type NpcProjectionBridge,
  type NpcVisibleClaim,
  type NpcVisibleContext,
  type VisibleRef,
} from "./npc-knowledge.projection.ts";
import type { EntityRef, InterrogationProfile, QuestionCatalogue, QuestionId } from "./interrogation-authoring.ts";
import { hashQuestionCatalogue } from "./interrogation-authoring.identity.ts";

// Runtime half of NPC interrogation V1 (MYST-0005B). One question in, one observation out:
// the NPC's stance comes from exactly one structurally matching attitude of its projection;
// every entity leaves only as a PlayerRef, and only if the question, the NPC itself or the
// rule's explicit reveal authorized it. No conversation state, no free text. A lie rule (V2) keeps
// the claim object of the NPC's own attitude but states the authored stance; its observation is
// indistinguishable from an answer.

export const RESPONSE_STANCES = ["affirms", "denies", "leans_affirms", "leans_denies", "uncertain", "does_not_know"] as const;
export type ResponseStance = (typeof RESPONSE_STANCES)[number];
type Stated = Exclude<ResponseStance, "does_not_know">;

type R = string; // PlayerRef, checked against PLAYER_REF_PATTERN
export type PlayerClaim =
  | { readonly kind: "personAt"; readonly person: R; readonly location: R; readonly at: number }
  | { readonly kind: "eventHasParticipant"; readonly event: R; readonly person: R }
  | { readonly kind: "eventHasItem"; readonly event: R; readonly item: R }
  | { readonly kind: "personResponsibleForEvent"; readonly person: R; readonly event: R }
  | { readonly kind: "personRoleForEvent"; readonly person: R; readonly event: R; readonly role: ResponsibilityRole }
  | { readonly kind: "noPersonResponsibleForEvent"; readonly event: R }
  | { readonly kind: "eventCausedEvent"; readonly causeEvent: R; readonly event: R }
  | { readonly kind: "eventIntent"; readonly event: R; readonly value: Intent }
  | { readonly kind: "eventMechanism"; readonly event: R; readonly value: Mechanism };

type Head = { readonly schemaVersion: 1; readonly npc: R; readonly questionId: QuestionId };
export type InterrogationObservation =
  | (Head & { readonly act: "decline" })
  | (Head & { readonly act: "answer"; readonly stance: "does_not_know" })
  | (Head & {
      readonly act: "answer";
      readonly stance: Stated;
      readonly statement: PlayerClaim;
      readonly mentions: readonly { readonly kind: "person" | "location" | "item" | "event"; readonly ref: R }[];
    });

type ErrorCode = "BINDING_MISMATCH" | "QUESTION_NOT_AVAILABLE" | "REF_UNAVAILABLE";
export type InterrogationResult =
  | { readonly success: true; readonly observation: InterrogationObservation }
  | { readonly success: false; readonly code: ErrorCode };

export type ResponseDecision =
  | { readonly stance: "does_not_know"; readonly claim: null }
  | { readonly stance: Stated; readonly claim: NpcVisibleClaim };

// Verbatim MYST-0001 v1 D3, identical to MYST-0004.
export const PLAYER_REF_PATTERN = /^pr1_[0-9a-hjkmnp-tv-z]{16}$/;
export type PlayerRefTranslator = {
  readonly caseId: string;
  readonly truthHash: string;
  readonly refFor: (kind: "person" | "location" | "item" | "event" | "evidence", id: string) => string | null;
};
export type ReleaseTranslator = { readonly translate: (ref: VisibleRef) => string | null; readonly toJSON: () => never };

export type InterrogationInput = {
  readonly truth: CaseTruth;
  readonly solution: CaseSolution | null;
  readonly snapshot: NpcKnowledgeSnapshot;
  readonly catalogue: QuestionCatalogue;
  readonly profile: InterrogationProfile;
  readonly refs: PlayerRefTranslator; // trusted port, its answers are still checked
  readonly known: readonly EntityRef[]; // derived by the trusted host (session)
  readonly questionId: unknown; // player input
};

const failure = (code: ErrorCode) => Object.freeze({ success: false, code }) as InterrogationResult;
const BINDING_MISMATCH = failure("BINDING_MISMATCH");
const QUESTION_NOT_AVAILABLE = failure("QUESTION_NOT_AVAILABLE");
const REF_UNAVAILABLE = failure("REF_UNAVAILABLE");

const keyOf = (ref: { readonly kind: string; readonly id: string }) => `${ref.kind}|${ref.id}`;

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

// Structural equality: same kind, every field equal; refs by kind and index. No inference.
function sameClaim(a: NpcVisibleClaim, b: NpcVisibleClaim): boolean {
  const fieldsA = Object.entries(a);
  if (fieldsA.length !== Object.keys(b).length) return false;
  return fieldsA.every(([field, value]) => {
    const other: unknown = (b as Record<string, unknown>)[field];
    if (typeof value !== "object") return value === other;
    const ref = other as VisibleRef | undefined;
    return ref !== undefined && ref.kind === value.kind && ref.index === value.index;
  });
}

// knowledge and belief map identically: telling them apart would be a truth oracle (knowledge is factive).
function stanceOf(stance: DeepReadonly<EpistemicStance>): Stated {
  switch (stance.kind) {
    case "knowledge":
    case "belief":
      return stance.value ? "affirms" : "denies";
    case "uncertain":
      return stance.leaning === null ? "uncertain" : stance.leaning ? "leans_affirms" : "leans_denies";
  }
}

/** Stance of the one attitude whose claim structurally equals target; the claim object is the context's own. */
export function decideResponse(context: NpcVisibleContext, target: NpcVisibleClaim | null): ResponseDecision {
  const attitude = target === null ? undefined : context.attitudes.find((a) => sameClaim(a.claim, target));
  if (attitude === undefined) return { stance: "does_not_know", claim: null };
  return { stance: stanceOf(attitude.stance), claim: attitude.claim };
}

/** Trusted only: VisibleRef → PlayerRef for authorized entities of exactly this projection. */
export function createReleaseTranslator(
  bridge: NpcProjectionBridge,
  refs: PlayerRefTranslator,
  authorized: readonly EntityRef[],
): ReleaseTranslator {
  const authorizedKeys = new Set(authorized.map(keyOf));
  const translate = (ref: VisibleRef): string | null => {
    const entity = bridge.entityOf(ref);
    if (entity === null) return null;
    const key = keyOf(entity);
    if (!authorizedKeys.has(key)) return null;
    const r = refs.refFor(entity.kind, entity.id);
    if (typeof r !== "string" || !PLAYER_REF_PATTERN.test(r)) return null;
    return r;
  };
  const toJSON = (): never => {
    throw new TypeError("ReleaseTranslator is not serializable");
  };
  return Object.freeze({ translate, toJSON });
}

type Rt = <T extends VisibleRef>(ref: T) => R;

// Rebuilt field by field from the context's claim; exhaustive, a new kind fails to compile.
function playerClaim(claim: NpcVisibleClaim, t: Rt): PlayerClaim {
  switch (claim.kind) {
    case "personAt":
      return { kind: "personAt", person: t(claim.person), location: t(claim.location), at: claim.at };
    case "eventHasParticipant":
      return { kind: "eventHasParticipant", event: t(claim.event), person: t(claim.person) };
    case "eventHasItem":
      return { kind: "eventHasItem", event: t(claim.event), item: t(claim.item) };
    case "personResponsibleForEvent":
      return { kind: "personResponsibleForEvent", person: t(claim.person), event: t(claim.event) };
    case "personRoleForEvent":
      return { kind: "personRoleForEvent", person: t(claim.person), event: t(claim.event), role: claim.role };
    case "noPersonResponsibleForEvent":
      return { kind: "noPersonResponsibleForEvent", event: t(claim.event) };
    case "eventCausedEvent":
      return { kind: "eventCausedEvent", causeEvent: t(claim.causeEvent), event: t(claim.event) };
    case "eventIntent":
      return { kind: "eventIntent", event: t(claim.event), value: claim.value };
    case "eventMechanism":
      return { kind: "eventMechanism", event: t(claim.event), value: claim.value };
  }
}

export function interrogate(input: InterrogationInput): InterrogationResult {
  const { truth, solution, snapshot, catalogue, profile, refs, known, questionId } = input;
  // 1. Binding.
  const truthHash = hashCaseTruth(truth);
  const boundTo = (doc: { readonly caseId: string; readonly truthHash: string }) =>
    doc.caseId === truth.caseId && doc.truthHash === truthHash;
  if (!boundTo(catalogue) || !boundTo(profile) || !boundTo(refs)) return BINDING_MISMATCH;
  if (profile.catalogueHash !== hashQuestionCatalogue(catalogue) || profile.npcId !== snapshot.npcId) return BINDING_MISMATCH;
  const projection = projectNpcKnowledgeWithBridge(snapshot, truth, solution);
  if (!projection.success) return BINDING_MISMATCH;
  const { context, bridge } = projection;

  // 2.-3. Question and askability share one player error (no existence oracle over guessable slugs).
  const rule = typeof questionId === "string" ? profile.rules.find((r) => r.questionId === questionId) : undefined;
  const question = catalogue.questions.find((q) => q.id === rule?.questionId);
  if (rule === undefined || question === undefined) return QUESTION_NOT_AVAILABLE;
  const npcEntity: EntityRef = { kind: "person", id: profile.npcId };
  const knownKeys = new Set(known.map(keyOf));
  if (![...question.mentions, npcEntity].every((e) => knownKeys.has(keyOf(e)))) return QUESTION_NOT_AVAILABLE;

  // 4. NPC ref.
  const npc = refs.refFor("person", profile.npcId);
  if (typeof npc !== "string" || !PLAYER_REF_PATTERN.test(npc)) return REF_UNAVAILABLE;
  const head = { schemaVersion: 1, npc, questionId: rule.questionId } as const;

  // 5. Decline never reads the epistemic state.
  if (rule.act === "decline") return deepFreeze({ success: true, observation: { ...head, act: "decline" } });

  // 6.-7.
  const sincere = decideResponse(context, bridge.visibleClaimOf(rule.claim));
  const decision: ResponseDecision = rule.act === "lie" && sincere.claim !== null ? { stance: rule.stance, claim: sincere.claim } : sincere;
  if (decision.stance === "does_not_know") {
    return deepFreeze({ success: true, observation: { ...head, act: "answer", stance: "does_not_know" } });
  }

  // 8. Release: every ref through the translator, injective over statement entities and the NPC.
  const translator = createReleaseTranslator(bridge, refs, [...question.mentions, npcEntity, ...rule.reveal]);
  const entityByRef = new Map<R, string>([[npc, `person|${context.self.index}`]]);
  const mentions = new Map<string, { kind: "person" | "location" | "item" | "event"; ref: R }>();
  let released = true;
  const t: Rt = (ref) => {
    const r = translator.translate(ref);
    const visibleKey = `${ref.kind}|${ref.index}`;
    if (r === null || (entityByRef.get(r) ?? visibleKey) !== visibleKey) {
      released = false;
      return "";
    }
    entityByRef.set(r, visibleKey);
    mentions.set(visibleKey, { kind: ref.kind as "person" | "location" | "item" | "event", ref: r });
    return r;
  };
  const statement = playerClaim(decision.claim, t);
  if (!released) return REF_UNAVAILABLE;
  const sorted = [...mentions.values()].sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
  const observation = { ...head, act: "answer", stance: decision.stance, statement, mentions: sorted } as const;
  return deepFreeze({ success: true, observation });
}
