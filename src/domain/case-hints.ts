import type { ResolvedCasePackage } from "./case-package.ts";
import { resolveInvestigation, type InvestigationAction } from "./evidence-access.ts";
import type { PlayerKnowledge } from "./player-knowledge.ts";

// Graded hints (ruleset mystery-session-v3). A hint points at the first step of the case's bound
// witness (release manifest, forge-release-proof-v1) that the player has not completed yet. It is
// derived from the package and the prefix only, so replay gives the same hint. The level rises with
// each hint on the same step: 1 names only the kind of action, 2 the known target, 3 the exact
// question. A hint never names the accused and never an entity the player does not know yet.

export type HintKind = "search_location" | "examine_item" | "examine_person" | "interrogate" | "confront" | "accuse";
export type Hint = {
  readonly level: 1 | 2 | 3;
  readonly kind: HintKind;
  /** PlayerRef of the location, item or person; only from level 2 and only if already known. */
  readonly target: string | null;
  /** Only at level 3 of an interrogation or confrontation hint. */
  readonly questionId: string | null;
  /** Evidence PlayerRef, only at level 3 of a confrontation hint. */
  readonly evidence: string | null;
};

/** At most this many hints per open step: more could not say more, and would only use up the action limit. */
export const HINTS_PER_STEP = 3;

type WitnessStep =
  | { readonly type: "investigate"; readonly action: "search_location" | "examine_item" | "examine_person"; readonly target: string }
  | { readonly type: "interrogate"; readonly npc: string; readonly questionId: string }
  | { readonly type: "confront"; readonly npc: string; readonly questionId: string; readonly evidence: string };

/**
 * The non-accusation events of the witness route (the profile's witnessStepIds), in its order. The
 * manifest's step list also holds the steps of further certified routes; hints follow one route.
 */
function witnessSteps(pkg: ResolvedCasePackage): readonly WitnessStep[] {
  if (pkg.proof === null) return [];
  const manifest = JSON.parse(pkg.proof.releaseManifest) as { certificateData: { steps: { stepId: string; event: { type: string } }[] } };
  const byId = new Map(manifest.certificateData.steps.map((s) => [s.stepId, s.event]));
  return pkg.proof.profile.witnessStepIds.flatMap((id) => byId.get(id) ?? []).filter((e): e is WitnessStep => e.type === "investigate" || e.type === "interrogate" || e.type === "confront");
}

/** Event index of the first confrontation of that NPC on that question with that evidence, or null. */
function confronted(k: PlayerKnowledge, npc: string, questionId: string, evidence: string, before: number): number | null {
  const r = k.observations.find(
    (r) => r.source.kind === "confrontation" && r.source.eventIndex < before && r.source.npc === npc && r.source.questionId === questionId && r.source.evidence === evidence,
  );
  return r === undefined ? null : r.source.eventIndex;
}

/**
 * Whether witness step i was completed before event index `before`: an investigation once
 * everything it finds was discovered (or, if it finds nothing, once it was performed), a
 * confrontation once it happened (whatever the NPC did), an interrogation once that NPC answered
 * that question, after the confrontation the witness puts before it on the same question (the
 * answer after an admission is a different one). Discoveries and records carry their event index,
 * so any earlier prefix can be judged from the current knowledge.
 */
function doneBefore(pkg: ResolvedCasePackage, k: PlayerKnowledge, events: readonly unknown[], steps: readonly WitnessStep[], i: number, before: number): boolean {
  const step = steps[i]!;
  if (step.type === "confront") return confronted(k, step.npc, step.questionId, step.evidence, before) !== null;
  if (step.type === "interrogate") {
    const prior = [...steps.slice(0, i)].reverse().find((s) => s.type === "confront" && s.npc === step.npc && s.questionId === step.questionId);
    const after = prior?.type === "confront" ? confronted(k, prior.npc, prior.questionId, prior.evidence, before) : -1;
    if (after === null) return false;
    return k.observations.some(
      (r) => r.source.kind === "npc" && r.source.eventIndex > after && r.source.eventIndex < before && r.source.npc === step.npc && r.source.questionId === step.questionId,
    );
  }
  const target = pkg.refs.resolve(step.target);
  if (target === null) return false;
  const field = step.action === "search_location" ? "locationId" : step.action === "examine_item" ? "itemId" : "personId";
  const found = resolveInvestigation(pkg.access, [target], { kind: step.action, [field]: target.id } as InvestigationAction);
  const ids = found.success ? found.found : [];
  if (ids.length === 0) {
    return events.slice(0, before).some((e) => {
      const ev = e as Partial<Extract<WitnessStep, { type: "investigate" }>>;
      return ev.type === "investigate" && ev.action === step.action && ev.target === step.target;
    });
  }
  return ids.every((id) => k.discoveries.some((d) => d.evidence === pkg.refs.refFor("evidence", id) && d.firstDiscoveryEvent < before));
}

/** Index of the first witness step not completed before `before`, or -1 when all are done. */
function openStep(pkg: ResolvedCasePackage, k: PlayerKnowledge, events: readonly unknown[], steps: readonly WitnessStep[], before: number): number {
  return steps.findIndex((_, i) => !doneBefore(pkg, k, events, steps, i, before));
}

/**
 * The hint for the next event index (events.length); null when the package has no bound witness
 * or HINTS_PER_STEP hints were already given on the open step (hintsExhausted).
 */
export function nextHint(pkg: ResolvedCasePackage, knowledge: PlayerKnowledge, events: readonly unknown[]): Hint | null {
  if (pkg.proof === null) return null;
  const steps = witnessSteps(pkg);
  const now = events.length;
  const open = openStep(pkg, knowledge, events, steps, now);
  // Earlier hints on the same open step raise the level.
  const earlier = events.filter((e, j) => (e as { type?: unknown }).type === "hint" && openStep(pkg, knowledge, events, steps, j) === open).length;
  if (earlier >= HINTS_PER_STEP) return null;
  const wanted = (earlier + 1) as 1 | 2 | 3;
  if (open === -1) return Object.freeze({ level: wanted, kind: "accuse", target: null, questionId: null, evidence: null });

  const step = steps[open]!;
  const subject = step.type === "investigate" ? step.target : step.npc;
  const isKnown = (ref: string) => knowledge.known.some((e) => e.ref === ref);
  // Never point at an entity the player does not know yet: stay vague instead.
  const level = !isKnown(subject) ? 1 : step.type === "confront" && wanted === 3 && !isKnown(step.evidence) ? 2 : wanted;
  return Object.freeze({
    level,
    kind: step.type === "investigate" ? step.action : step.type,
    target: level >= 2 ? subject : null,
    questionId: level === 3 && step.type !== "investigate" ? step.questionId : null,
    evidence: level === 3 && step.type === "confront" ? step.evidence : null,
  });
}

/** Whether the next hint is refused because the open step already had HINTS_PER_STEP hints. */
export function hintsExhausted(pkg: ResolvedCasePackage, knowledge: PlayerKnowledge, events: readonly unknown[]): boolean {
  return pkg.proof !== null && nextHint(pkg, knowledge, events) === null;
}

/** Number of hints taken in an event log. */
export const hintCount = (events: readonly unknown[]): number => events.filter((e) => (e as { type?: unknown }).type === "hint").length;
