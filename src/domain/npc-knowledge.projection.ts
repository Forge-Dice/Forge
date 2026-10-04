import type { CaseTruth, DeepReadonly } from "./case-truth.ts";
import { hashCaseTruth } from "./case-truth.identity.ts";
import type { CaseSolution, Intent, Mechanism, ResponsibilityRole } from "./case-solution.ts";
import { hashCaseSolution } from "./case-solution.identity.ts";
import type { EpistemicStance, NpcKnowledgeSnapshot } from "./npc-knowledge.ts";
import { deepFreeze } from "./shared.ts";

// Information barrier between an NPC's authored epistemic snapshot and anything downstream
// (TASK-0004 §10). Only explicitly released subjective content leaves: projection-local
// handles instead of raw IDs, an allowlist of nine claim shapes, and stances. Never: names,
// descriptions, objective truth values, resolutions, provenance, acquisition times or any
// entity that the NPC has not been explicitly given.
// The bridge (MYST-0005B) is a trusted-only capability that hands out canonical IDs; it never
// belongs in a context, a policy or any player-facing output.

export type VisibleKind = "person" | "location" | "item" | "event" | "evidence" | "proposition" | "conclusion";

type AwarenessKind = "person" | "location" | "item" | "event" | "evidence";

export type VisibleRef<K extends VisibleKind = VisibleKind> = {
  readonly kind: K;
  readonly index: number;
};

type P = VisibleRef<"person">;
type L = VisibleRef<"location">;
type I = VisibleRef<"item">;
type E = VisibleRef<"event">;

export type NpcVisibleClaim =
  | { readonly kind: "personAt"; readonly person: P; readonly location: L; readonly at: number }
  | { readonly kind: "eventHasParticipant"; readonly event: E; readonly person: P }
  | { readonly kind: "eventHasItem"; readonly event: E; readonly item: I }
  | { readonly kind: "personResponsibleForEvent"; readonly person: P; readonly event: E }
  | { readonly kind: "personRoleForEvent"; readonly person: P; readonly event: E; readonly role: ResponsibilityRole }
  | { readonly kind: "noPersonResponsibleForEvent"; readonly event: E }
  | { readonly kind: "eventCausedEvent"; readonly causeEvent: E; readonly event: E }
  | { readonly kind: "eventIntent"; readonly event: E; readonly value: Intent }
  | { readonly kind: "eventMechanism"; readonly event: E; readonly value: Mechanism };

export type NpcVisibleContext = {
  readonly schemaVersion: 1;
  readonly asOf: number;
  readonly self: P;
  readonly awareness: readonly VisibleRef<AwarenessKind>[];
  readonly attitudes: readonly {
    readonly subject: VisibleRef<"proposition" | "conclusion">;
    readonly claim: NpcVisibleClaim;
    readonly stance: DeepReadonly<EpistemicStance>;
  }[];
};

export type ProjectionResult =
  | { readonly success: true; readonly context: NpcVisibleContext }
  | { readonly success: false; readonly code: "CONTEXT_BINDING_MISMATCH" };

export type NpcSourceClaim = CaseTruth["propositions"][number]["claim"] | CaseSolution["conclusions"][number]["claim"];
export type NpcEntityRef = { readonly kind: AwarenessKind; readonly id: string };
export type NpcProjectionBridge = {
  readonly visibleClaimOf: (claim: NpcSourceClaim) => NpcVisibleClaim | null;
  readonly entityOf: (ref: VisibleRef) => NpcEntityRef | null;
  readonly toJSON: () => never;
};
export type BridgedProjectionResult =
  | { readonly success: true; readonly context: NpcVisibleContext; readonly bridge: NpcProjectionBridge }
  | { readonly success: false; readonly code: "CONTEXT_BINDING_MISMATCH" };
type SourceStance = NpcKnowledgeSnapshot["attitudes"][number]["stance"];

const KIND_ORDER: readonly VisibleKind[] = ["person", "location", "item", "event", "evidence", "proposition", "conclusion"];

function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function mismatch(): ProjectionResult {
  return Object.freeze({ success: false, code: "CONTEXT_BINDING_MISMATCH" });
}

/** Same binding rules as the parser (§5), re-checked before anything is released. */
function isBound(snapshot: NpcKnowledgeSnapshot, truth: CaseTruth, solution: CaseSolution | null): boolean {
  const truthHash = hashCaseTruth(truth);
  if (snapshot.caseId !== truth.caseId || snapshot.truthHash !== truthHash) return false;
  if (!truth.persons.some((person) => person.id === snapshot.npcId)) return false;
  if (solution === null) return snapshot.solutionHash === null;
  return (
    solution.caseId === truth.caseId &&
    solution.truthHash === truthHash &&
    snapshot.solutionHash === hashCaseSolution(solution)
  );
}

/** Entity references inside a released claim, as [kind, rawId] pairs. */
function claimReferences(claim: NpcSourceClaim): [VisibleKind, string][] {
  switch (claim.kind) {
    case "personAt":
      return [["person", claim.personId], ["location", claim.locationId]];
    case "eventHasParticipant":
      return [["event", claim.eventId], ["person", claim.personId]];
    case "eventHasItem":
      return [["event", claim.eventId], ["item", claim.itemId]];
    case "personResponsibleForEvent":
    case "personRoleForEvent":
      return [["person", claim.personId], ["event", claim.eventId]];
    case "noPersonResponsibleForEvent":
    case "eventIntent":
    case "eventMechanism":
      return [["event", claim.eventId]];
    case "eventCausedEvent":
      return [["event", claim.causeEventId], ["event", claim.eventId]];
  }
}

type RefOf = <K extends VisibleKind>(kind: K, id: string) => VisibleRef<K>;

// Explicit per-variant construction: no spreading of domain objects, no deny-listing.
// Exhaustive over today's claim kinds; a new kind fails to compile instead of leaking.
function visibleClaim(claim: NpcSourceClaim, ref: RefOf): NpcVisibleClaim {
  switch (claim.kind) {
    case "personAt":
      return { kind: "personAt", person: ref("person", claim.personId), location: ref("location", claim.locationId), at: claim.at };
    case "eventHasParticipant":
      return { kind: "eventHasParticipant", event: ref("event", claim.eventId), person: ref("person", claim.personId) };
    case "eventHasItem":
      return { kind: "eventHasItem", event: ref("event", claim.eventId), item: ref("item", claim.itemId) };
    case "personResponsibleForEvent":
      return { kind: "personResponsibleForEvent", person: ref("person", claim.personId), event: ref("event", claim.eventId) };
    case "personRoleForEvent":
      return {
        kind: "personRoleForEvent",
        person: ref("person", claim.personId),
        event: ref("event", claim.eventId),
        role: claim.role,
      };
    case "noPersonResponsibleForEvent":
      return { kind: "noPersonResponsibleForEvent", event: ref("event", claim.eventId) };
    case "eventCausedEvent":
      return { kind: "eventCausedEvent", causeEvent: ref("event", claim.causeEventId), event: ref("event", claim.eventId) };
    case "eventIntent":
      return { kind: "eventIntent", event: ref("event", claim.eventId), value: claim.value };
    case "eventMechanism":
      return { kind: "eventMechanism", event: ref("event", claim.eventId), value: claim.value };
  }
}

function visibleStance(stance: SourceStance): DeepReadonly<EpistemicStance> {
  switch (stance.kind) {
    case "knowledge":
      return { kind: "knowledge", value: stance.value };
    case "belief":
      return { kind: "belief", value: stance.value };
    case "uncertain":
      return { kind: "uncertain", leaning: stance.leaning };
  }
}

// Shared core. `emitted` (call-local, bridge only) records the entity behind each emitted ref object.
function project(
  snapshot: NpcKnowledgeSnapshot,
  truth: CaseTruth,
  solution: CaseSolution | null,
  emitted: Map<object, NpcEntityRef> | null,
): { readonly context: NpcVisibleContext; readonly indexOf: ReadonlyMap<string, number> } | null {
  // 1. Binding before any release.
  if (!isBound(snapshot, truth, solution)) return null;

  const propositionClaims = new Map<string, NpcSourceClaim>(truth.propositions.map((p) => [p.id, p.claim]));
  const conclusionClaims = new Map<string, NpcSourceClaim>((solution?.conclusions ?? []).map((c) => [c.id, c.claim]));
  const attitudes: { kind: "proposition" | "conclusion"; id: string; claim: NpcSourceClaim; stance: SourceStance }[] = [];
  for (const { subject, stance } of snapshot.attitudes) {
    const claim = (subject.kind === "proposition" ? propositionClaims : conclusionClaims).get(subject.id);
    if (claim === undefined) return null; // unreachable for correctly bound inputs
    attitudes.push({ kind: subject.kind, id: subject.id, claim, stance });
  }

  // 2.-3. Visible reference set: self, awareness, attitude subjects, references in those claims.
  // Provenance is deliberately never read.
  const visible = new Map<VisibleKind, Set<string>>(KIND_ORDER.map((kind) => [kind, new Set<string>()]));
  const add = (kind: VisibleKind, id: string) => visible.get(kind)!.add(id);
  add("person", snapshot.npcId);
  for (const { subject } of snapshot.awareness) add(subject.kind, subject.id);
  for (const attitude of attitudes) {
    add(attitude.kind, attitude.id);
    for (const [kind, id] of claimReferences(attitude.claim)) add(kind, id);
  }

  // 4.-5. Per kind: sort visible IDs by UTF-16 code units, assign 1..N. Local to this call.
  const indexOf = new Map<string, number>();
  for (const [kind, ids] of visible) {
    [...ids].sort(compareCodeUnits).forEach((id, i) => indexOf.set(`${kind}|${id}`, i + 1));
  }
  const ref: RefOf = (kind, id) => {
    const visibleRef = { kind, index: indexOf.get(`${kind}|${id}`)! };
    if (kind !== "proposition" && kind !== "conclusion") emitted?.set(visibleRef, { kind: kind as AwarenessKind, id });
    return visibleRef;
  };
  const byKindThenIndex = (a: VisibleRef, b: VisibleRef) =>
    KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.index - b.index;

  // 6.-7. Output in fixed kind order, then numeric index.
  const awareness = snapshot.awareness.map(({ subject }) => ref(subject.kind, subject.id)).sort(byKindThenIndex);
  const visibleAttitudes = attitudes
    .map((attitude) => ({
      subject: ref(attitude.kind, attitude.id),
      claim: visibleClaim(attitude.claim, ref),
      stance: visibleStance(attitude.stance),
    }))
    .sort((a, b) => byKindThenIndex(a.subject, b.subject));

  const context: NpcVisibleContext = {
    schemaVersion: 1,
    asOf: snapshot.asOf,
    self: ref("person", snapshot.npcId),
    awareness,
    attitudes: visibleAttitudes,
  };
  return { context, indexOf };
}

export function projectNpcKnowledge(
  snapshot: NpcKnowledgeSnapshot,
  truth: CaseTruth,
  solution: CaseSolution | null,
): ProjectionResult {
  const core = project(snapshot, truth, solution, null);
  return core === null ? mismatch() : deepFreeze({ success: true, context: core.context });
}

/** projectNpcKnowledge plus a trusted bridge back to canonical entities of this one projection. */
export function projectNpcKnowledgeWithBridge(
  snapshot: NpcKnowledgeSnapshot,
  truth: CaseTruth,
  solution: CaseSolution | null,
): BridgedProjectionResult {
  const emitted = new Map<object, NpcEntityRef>();
  const core = project(snapshot, truth, solution, emitted);
  if (core === null) return mismatch() as BridgedProjectionResult;
  const indexOf = core.indexOf;
  const plainRef: RefOf = (kind, id) => ({ kind, index: indexOf.get(`${kind}|${id}`)! });
  const bridge: NpcProjectionBridge = Object.freeze({
    visibleClaimOf: (claim: NpcSourceClaim) =>
      claimReferences(claim).every(([k, id]) => indexOf.has(`${k}|${id}`)) ? deepFreeze(visibleClaim(claim, plainRef)) : null,
    entityOf: (ref: VisibleRef) => {
      const entity = emitted.get(ref);
      return entity === undefined ? null : Object.freeze({ kind: entity.kind, id: entity.id });
    },
    toJSON: (): never => { throw new TypeError("NpcProjectionBridge is not serializable"); },
  });
  return deepFreeze({ success: true, context: core.context, bridge });
}
