import { z } from "zod";
import { rulesetAllows, type CasePackageIdentity, type ResolvedCasePackage } from "./case-package.ts";
import { serializeSessionJson, utf8Length, validateSessionJson } from "./case-package.identity.ts";
import { parseAccusation, type Accusation } from "./case-accusation.ts";
import { evaluateChallengeAccusation } from "./accusation-challenge.ts";
import { claimKey, type ConclusionClaim } from "./case-solution.ts";
import { resolveInvestigation, type InvestigationAction } from "./evidence-access.ts";
import { PLAYER_REF_PATTERN, releaseEvidence, type EvidenceObservation } from "./evidence-presentation.ts";
import { QuestionIdSchema } from "./interrogation-authoring.ts";
import { confront, interrogate, type ConfrontationObservation, type InterrogationObservation } from "./interrogation.ts";
import type { ResolvedEntity } from "./player-ref.ts";
import { initialPlayerKnowledge, recordConfrontation, recordEvidence, recordInterrogation, type PlayerKnowledge } from "./player-knowledge.ts";
import { nextHint, type Hint } from "./case-hints.ts";
import { deepFreezeUnfrozen } from "./shared.ts";

// Session reducer V1 (MYST-SESSION-0001B). The only door from untrusted player events into the
// gameplay ports. Every incoming ref must already be in the prefix Known; every released ref must
// resolve to its kind in the package. Rejections return the very same state object.

export const SESSION_LIMITS = Object.freeze({
  maxEvents: 512,
  maxLiterals: 32,
  maxEventBytes: 16 * 1024,
  maxSaveBytes: 1024 * 1024,
  maxDepth: 32,
  maxNodes: 100_000,
});

const Ref = z.string().regex(PLAYER_REF_PATTERN);

const PlayerConclusionClaimSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("personResponsibleForEvent"), person: Ref, event: Ref }),
  z.strictObject({
    kind: z.literal("personRoleForEvent"),
    person: Ref,
    event: Ref,
    role: z.enum(["direct_actor", "planner", "facilitator"]),
  }),
  z.strictObject({ kind: z.literal("noPersonResponsibleForEvent"), event: Ref }),
  z.strictObject({ kind: z.literal("eventCausedEvent"), causeEvent: Ref, event: Ref }),
  z.strictObject({ kind: z.literal("eventIntent"), event: Ref, value: z.enum(["intended", "unintended", "not_applicable"]) }),
  z.strictObject({ kind: z.literal("eventMechanism"), event: Ref, value: z.enum(["ordinary", "supernatural", "mixed"]) }),
]);

/** Shape only. Ref existence, kind and prefix-Known are the reducer's job. */
export const SessionEventSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("investigate"),
    action: z.enum(["search_location", "examine_item", "examine_person"]),
    target: Ref,
  }),
  z.strictObject({ type: z.literal("interrogate"), npc: Ref, questionId: QuestionIdSchema }),
  // V2: hold a found evidence against an earlier statement of this NPC to this question.
  z.strictObject({ type: z.literal("confront"), npc: Ref, questionId: QuestionIdSchema, evidence: Ref }),
  z.strictObject({
    type: z.literal("accuse"),
    literals: z.array(z.strictObject({ claim: PlayerConclusionClaimSchema, value: z.boolean() })).max(SESSION_LIMITS.maxLiterals),
  }),
  // confront and hint are gated by ruleset version (rulesetAllows, case-package.ts).
  z.strictObject({ type: z.literal("hint") }),
]);

export type PlayerConclusionClaim = z.output<typeof PlayerConclusionClaimSchema>;
export type SessionEvent = z.output<typeof SessionEventSchema>;
export type VerdictRecord = { readonly eventIndex: number; readonly verdict: "solved" | "not_solved" };
export type SessionState = {
  readonly identity: CasePackageIdentity;
  readonly phase: "active" | "solved";
  readonly events: readonly SessionEvent[];
  readonly knowledge: PlayerKnowledge;
  readonly verdicts: readonly VerdictRecord[];
};
export type SessionOutput =
  | { readonly type: "investigate"; readonly observations: readonly EvidenceObservation[] }
  | { readonly type: "interrogate"; readonly observation: InterrogationObservation }
  | { readonly type: "confront"; readonly observation: ConfrontationObservation }
  | { readonly type: "accuse"; readonly verdict: "solved" | "not_solved" }
  | { readonly type: "hint"; readonly hint: Hint };
export type SessionErrorCode = "ACTION_UNAVAILABLE" | "SESSION_CLOSED" | "LIMIT_REACHED" | "HOST_FAILURE";
export type SessionResult =
  | { readonly ok: true; readonly state: SessionState; readonly output: SessionOutput }
  | { readonly ok: false; readonly state: SessionState; readonly code: SessionErrorCode };
export type ReplayResult =
  | { readonly ok: true; readonly state: SessionState }
  | { readonly ok: false; readonly code: "INVALID_HISTORY" | "LIMIT_REACHED" | "HOST_FAILURE"; readonly eventIndex: number | null };

type Kind = ResolvedEntity["kind"];
type Step = { knowledge: PlayerKnowledge; output: SessionOutput; verdict: VerdictRecord["verdict"] | null };

// Control flow inside one reduction; never escapes reduceSession.
class Reject {
  constructor(readonly code: SessionErrorCode) {}
}
const unavailable = () => new Reject("ACTION_UNAVAILABLE");
const hostFailure = () => new Reject("HOST_FAILURE");

/** Exact UTF-8 length of C(value), or null when the value is not plain session JSON within limits. */
function jsonBytes(value: unknown): number | null {
  try {
    const limits = { maxDepth: SESSION_LIMITS.maxDepth, maxNodes: SESSION_LIMITS.maxNodes };
    if (!validateSessionJson(value, limits).ok) return null;
    return utf8Length(serializeSessionJson(value));
  } catch {
    return null;
  }
}

/** B0: the empty save envelope for this package (contract SA "B/C-Abhängigkeit"). */
function envelopeBytes(identity: CasePackageIdentity): number {
  const empty = { schemaVersion: 1, packageIdentity: identity, events: [], checksum: "0".repeat(64) };
  return utf8Length(serializeSessionJson(empty));
}

// Σ len(C(event_i)) per accepted event log, so a reduction never re-serializes the history.
// A pure memo keyed by the frozen events array; never persisted, never part of the state.
const eventBytes = new WeakMap<readonly SessionEvent[], number>();
function historyBytes(events: readonly SessionEvent[]): number {
  let total = eventBytes.get(events);
  if (total === undefined) {
    total = events.reduce((sum, event) => sum + utf8Length(serializeSessionJson(event)), 0);
    eventBytes.set(events, total);
  }
  return total;
}

const sameIdentity = (a: CasePackageIdentity, b: CasePackageIdentity) =>
  a.schemaVersion === b.schemaVersion && a.packageHash === b.packageHash && a.rulesetVersion === b.rulesetVersion;

export function initialSession(pkg: ResolvedCasePackage): SessionState {
  const { schemaVersion, packageHash, rulesetVersion } = pkg.identity;
  return deepFreezeUnfrozen({
    identity: { schemaVersion, packageHash, rulesetVersion },
    phase: "active",
    events: [],
    knowledge: initialPlayerKnowledge(pkg),
    verdicts: [],
  });
}

export function reduceSession(pkg: ResolvedCasePackage, state: SessionState, input: unknown): SessionResult {
  const reject = (code: SessionErrorCode): SessionResult => Object.freeze({ ok: false, state, code });
  try {
    if (!sameIdentity(state.identity, pkg.identity)) return reject("HOST_FAILURE");
    if (state.phase === "solved") return reject("SESSION_CLOSED");
    if (state.events.length >= SESSION_LIMITS.maxEvents) return reject("LIMIT_REACHED");

    const rawBytes = jsonBytes(input);
    if (rawBytes === null || rawBytes > SESSION_LIMITS.maxEventBytes) return reject("ACTION_UNAVAILABLE");
    const literals = typeof input === "object" && input !== null ? (input as { literals?: unknown }).literals : undefined;
    if (Array.isArray(literals) && literals.length > SESSION_LIMITS.maxLiterals) return reject("ACTION_UNAVAILABLE");
    const parsed = SessionEventSchema.safeParse(input);
    if (!parsed.success) return reject("ACTION_UNAVAILABLE");
    const event = deepFreezeUnfrozen(parsed.data);

    const eventIndex = state.events.length;
    const step = evaluate(pkg, state.knowledge, event, eventIndex, state.events);

    const ownBytes = utf8Length(serializeSessionJson(event));
    const saveBytes = envelopeBytes(pkg.identity) + historyBytes(state.events) + ownBytes + eventIndex;
    if (saveBytes > SESSION_LIMITS.maxSaveBytes) return reject("LIMIT_REACHED");

    const events = Object.freeze([...state.events, event]);
    eventBytes.set(events, historyBytes(state.events) + ownBytes);
    const verdicts = step.verdict === null ? state.verdicts : [...state.verdicts, { eventIndex, verdict: step.verdict }];
    const next: SessionState = deepFreezeUnfrozen({
      identity: state.identity,
      phase: step.verdict === "solved" ? "solved" : "active",
      events,
      knowledge: step.knowledge,
      verdicts,
    });
    return deepFreezeUnfrozen({ ok: true, state: next, output: step.output });
  } catch (error) {
    // Trusted ports may throw; that is a host failure, never a player verdict.
    return reject(error instanceof Reject ? error.code : "HOST_FAILURE");
  }
}

export function replaySession(pkg: ResolvedCasePackage, events: unknown): ReplayResult {
  const fail = (code: Extract<ReplayResult, { ok: false }>["code"], eventIndex: number | null): ReplayResult =>
    Object.freeze({ ok: false, code, eventIndex });
  if (!Array.isArray(events)) return fail("INVALID_HISTORY", null);
  if (events.length > SESSION_LIMITS.maxEvents) return fail("LIMIT_REACHED", null);
  let state: SessionState;
  try {
    const bytes = jsonBytes(events);
    if (bytes === null) return fail("INVALID_HISTORY", null);
    // C(events) = "[" + join(",", C(e_i)) + "]", so the save size is B0 + bytes - 2.
    if (envelopeBytes(pkg.identity) + bytes - 2 > SESSION_LIMITS.maxSaveBytes) return fail("LIMIT_REACHED", null);
    state = initialSession(pkg);
  } catch {
    return fail("HOST_FAILURE", null);
  }
  for (const [index, event] of events.entries()) {
    const result = reduceSession(pkg, state, event);
    if (!result.ok) {
      if (result.code === "LIMIT_REACHED" || result.code === "HOST_FAILURE") return fail(result.code, index);
      return fail("INVALID_HISTORY", index);
    }
    state = result.state;
  }
  return Object.freeze({ ok: true, state });
}

// ---------- Ports, all on a temporary state ----------

function evaluate(pkg: ResolvedCasePackage, knowledge: PlayerKnowledge, event: SessionEvent, eventIndex: number, events: readonly SessionEvent[]): Step {
  const known = new Map(knowledge.known.map((k) => [k.ref, k.kind]));

  /** Canonical id of a player ref the prefix already knows, with the expected kind. */
  const own = (ref: string, kind: Kind): string => {
    if (known.get(ref) !== kind) throw unavailable();
    const entity = pkg.refs.resolve(ref);
    if (entity === null || entity.kind !== kind) throw hostFailure();
    return entity.id;
  };
  const canonicalKnown = () => knowledge.known.map((k) => ({ kind: k.kind, id: own(k.ref, k.kind) }) as ResolvedEntity);

  /** Every released ref resolves to its stated kind; nothing outside `allowed` may be referenced. */
  const checkReleased = (mentions: readonly { kind: Kind; ref: string }[], refs: readonly string[], allowed: Set<string>) => {
    for (const m of mentions) {
      const entity = pkg.refs.resolve(m.ref);
      if (entity === null || entity.kind !== m.kind || pkg.refs.refFor(m.kind, entity.id) !== m.ref) throw hostFailure();
      allowed.add(m.ref);
    }
    if (!refs.every((ref) => allowed.has(ref))) throw hostFailure();
  };

  switch (event.type) {
    case "investigate": {
      const kind = ({ search_location: "location", examine_item: "item", examine_person: "person" } as const)[event.action];
      const id = own(event.target, kind);
      const action = (
        kind === "location" ? { kind: event.action, locationId: id } : kind === "item" ? { kind: event.action, itemId: id } : { kind: event.action, personId: id }
      ) as InvestigationAction;
      const result = resolveInvestigation(pkg.access, canonicalKnown(), action);
      if (!result.success) throw hostFailure();
      const discovered = new Set(knowledge.discoveries.map((d) => d.evidence));
      const fresh = result.found
        .map((evidenceId) => ({ evidenceId, ref: pkg.refs.refFor("evidence", evidenceId) }))
        .filter(({ ref }) => {
          if (typeof ref !== "string" || !PLAYER_REF_PATTERN.test(ref)) throw hostFailure();
          return !discovered.has(ref);
        })
        .sort((a, b) => (a.ref! < b.ref! ? -1 : a.ref! > b.ref! ? 1 : 0));
      const observations = fresh.map(({ evidenceId, ref }) => {
        const released = releaseEvidence(pkg.presentation, evidenceId, pkg.refs);
        if (!released.success || released.observation.evidence !== ref) throw hostFailure();
        const { observation } = released;
        const reportRefs = observation.reports.flatMap((r) => [...claimRefs(r.claim), ...(r.source.kind === "testimony" ? [r.source.person] : [])]);
        checkReleased(observation.mentions, reportRefs, new Set([...known.keys(), observation.evidence]));
        return observation;
      });
      const next = observations.reduce((k, observation) => recordEvidence(k, observation, eventIndex), knowledge);
      return { knowledge: next, output: { type: "investigate", observations }, verdict: null };
    }
    case "interrogate":
    case "confront": {
      const npcId = own(event.npc, "person");
      const npc = pkg.npcs.find((entry) => entry.snapshot.npcId === npcId);
      if (npc === undefined) throw unavailable();
      // Questions whose lie this player already broke: the NPC answers them sincerely from then on.
      const admitted = knowledge.observations.flatMap((r) =>
        r.source.kind === "confrontation" && r.source.npc === event.npc && "act" in r.observation && r.observation.act === "admit" ? [r.source.questionId] : [],
      );
      const port = {
        truth: pkg.truth,
        // The projection re-checks the snapshot binding: a snapshot bound without a solution gets none.
        solution: npc.snapshot.solutionHash === null ? null : pkg.solution,
        snapshot: npc.snapshot,
        catalogue: pkg.catalogue,
        profile: npc.profile,
        refs: pkg.refs,
        known: canonicalKnown(),
        questionId: event.questionId,
      };
      if (event.type === "confront") {
        // The evidence must be found and the NPC must have stated something to it.
        if (!rulesetAllows(pkg.identity.rulesetVersion, "confront")) throw unavailable();
        if (!knowledge.discoveries.some((d) => d.evidence === event.evidence)) throw unavailable();
        const stated = knowledge.observations.some(
          (r) => r.source.kind === "npc" && r.source.npc === event.npc && r.source.questionId === event.questionId && "statement" in r.observation,
        );
        if (!stated) throw unavailable();
        // The same confrontation again would say nothing new (and admit a second time).
        const repeated = knowledge.observations.some(
          (r) => r.source.kind === "confrontation" && r.source.npc === event.npc && r.source.questionId === event.questionId && r.source.evidence === event.evidence,
        );
        if (repeated) throw unavailable();
        const result = confront({ ...port, evidenceId: own(event.evidence, "evidence") });
        if (!result.success) throw result.code === "QUESTION_NOT_AVAILABLE" ? unavailable() : hostFailure();
        const { observation } = result;
        if (observation.npc !== event.npc || observation.questionId !== event.questionId || observation.evidence !== event.evidence) throw hostFailure();
        if (observation.act === "admit") checkReleased(observation.mentions, claimRefs(observation.statement), new Set([event.npc]));
        return { knowledge: recordConfrontation(knowledge, observation, eventIndex), output: { type: "confront", observation }, verdict: null };
      }
      const result = interrogate({ ...port, admitted });
      if (!result.success) throw result.code === "QUESTION_NOT_AVAILABLE" ? unavailable() : hostFailure();
      const { observation } = result;
      if (observation.npc !== event.npc || observation.questionId !== event.questionId) throw hostFailure();
      if ("statement" in observation) checkReleased(observation.mentions, claimRefs(observation.statement), new Set([event.npc]));
      return { knowledge: recordInterrogation(knowledge, observation, eventIndex), output: { type: "interrogate", observation }, verdict: null };
    }
    case "hint": {
      // Without a bound witness there is nothing to derive hints from.
      if (!rulesetAllows(pkg.identity.rulesetVersion, "hints")) throw unavailable();
      const hint = nextHint(pkg, knowledge, events);
      if (hint === null) throw unavailable();
      return { knowledge, output: { type: "hint", hint }, verdict: null };
    }
    case "accuse": {
      const asserted = event.literals.map(({ claim, value }) => ({ claim: canonicalClaim(claim, own), value }));
      const literals = [...asserted, ...unknownSuspects(pkg, canonicalKnown(), asserted)];
      let accusation: Accusation;
      try {
        accusation = parseAccusation(
          { schemaVersion: 1, caseId: pkg.truth.caseId, truthHash: pkg.refs.truthHash, literals },
          pkg.truth,
        );
      } catch (error) {
        // Duplicates, contradictions and self-causes are player input faults; anything else is the host's.
        throw error instanceof z.ZodError ? unavailable() : hostFailure();
      }
      const result = evaluateChallengeAccusation(pkg.truth, pkg.solution, pkg.challenge, accusation);
      if (!result.success) throw hostFailure();
      return { knowledge, output: { type: "accuse", verdict: result.verdict }, verdict: result.verdict };
    }
  }
}

/**
 * Late suspects: a player can only name persons they know, so every in-scope person claim about a
 * person they do not know yet counts as "not accused" (value false). Accusing before the culprit is
 * known therefore stays not_solved, and the accusation never reveals how many suspects exist.
 */
function unknownSuspects(
  pkg: ResolvedCasePackage,
  known: readonly ResolvedEntity[],
  asserted: readonly { readonly claim: ConclusionClaim }[],
): { claim: ConclusionClaim; value: false }[] {
  const knownPersons = new Set(known.filter((k) => k.kind === "person").map((k) => k.id));
  const keys = new Set(asserted.map((l) => claimKey(l.claim)));
  return pkg.challenge.allowedClaims
    .filter((claim) => (claim.kind === "personRoleForEvent" || claim.kind === "personResponsibleForEvent") && !knownPersons.has(claim.personId))
    .filter((claim) => !keys.has(claimKey(claim as ConclusionClaim)))
    .map((claim) => ({ claim: structuredClone(claim) as ConclusionClaim, value: false as const }));
}

/** Field-wise transport conversion into the canonical claim; no status resolution. */
function canonicalClaim(claim: PlayerConclusionClaim, own: (ref: string, kind: Kind) => string): ConclusionClaim {
  const event = (ref: string) => own(ref, "event");
  const person = (ref: string) => own(ref, "person");
  switch (claim.kind) {
    case "personResponsibleForEvent":
      return { kind: claim.kind, personId: person(claim.person), eventId: event(claim.event) } as ConclusionClaim;
    case "personRoleForEvent":
      return { kind: claim.kind, personId: person(claim.person), eventId: event(claim.event), role: claim.role } as ConclusionClaim;
    case "noPersonResponsibleForEvent":
      return { kind: claim.kind, eventId: event(claim.event) } as ConclusionClaim;
    case "eventCausedEvent":
      return { kind: claim.kind, causeEventId: event(claim.causeEvent), eventId: event(claim.event) } as ConclusionClaim;
    case "eventIntent":
    case "eventMechanism":
      return { kind: claim.kind, eventId: event(claim.event), value: claim.value } as ConclusionClaim;
  }
}

/** Every player ref inside a released claim (string fields except kind, role and value). */
function claimRefs(claim: object): string[] {
  return Object.entries(claim)
    .filter(([field, value]) => typeof value === "string" && !["kind", "role", "value"].includes(field))
    .map(([, value]) => value as string);
}
