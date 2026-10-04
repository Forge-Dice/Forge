import type { ResolvedCasePackage } from "./case-package.ts";
import { resolveInvestigation, type InvestigationAction } from "./evidence-access.ts";
import type { PlayerKnowledge } from "./player-knowledge.ts";

// Graded hints (ruleset mystery-session-v3). A hint points at the first step of the case's bound
// witness (release manifest, forge-release-proof-v1) that the player has not completed yet. It is
// derived from the package and the prefix only, so replay gives the same hint. The level rises with
// each hint on the same step: 1 names only the kind of action, 2 the known target, 3 the exact
// question. A hint never names the accused and never an entity the player does not know yet.

export type HintKind = "search_location" | "examine_item" | "examine_person" | "interrogate" | "accuse";
export type Hint = {
  readonly level: 1 | 2 | 3;
  readonly kind: HintKind;
  /** PlayerRef of the location, item or person; only from level 2 and only if already known. */
  readonly target: string | null;
  /** Only at level 3 of an interrogation hint. */
  readonly questionId: string | null;
};

type WitnessStep =
  | { readonly type: "investigate"; readonly action: "search_location" | "examine_item" | "examine_person"; readonly target: string }
  | { readonly type: "interrogate"; readonly npc: string; readonly questionId: string };

/** The non-accusation witness events of the bound manifest, in witness order. */
function witnessSteps(pkg: ResolvedCasePackage): readonly WitnessStep[] {
  if (pkg.proof === null) return [];
  const manifest = JSON.parse(pkg.proof.releaseManifest) as { certificateData: { steps: { event: { type: string } }[] } };
  return manifest.certificateData.steps.map((s) => s.event).filter((e): e is WitnessStep => e.type === "investigate" || e.type === "interrogate");
}

/**
 * Whether a step was completed before event index `before`: an investigation once everything it
 * finds was discovered (or, if it finds nothing, once it was performed), an interrogation once
 * that NPC answered that question. Discoveries and records carry their event index, so any
 * earlier prefix can be judged from the current knowledge.
 */
function doneBefore(pkg: ResolvedCasePackage, k: PlayerKnowledge, events: readonly unknown[], step: WitnessStep, before: number): boolean {
  if (step.type === "interrogate") {
    return k.observations.some((r) => r.source.kind === "npc" && r.source.eventIndex < before && r.source.npc === step.npc && r.source.questionId === step.questionId);
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
  return steps.findIndex((step) => !doneBefore(pkg, k, events, step, before));
}

/** The hint for the next event index (events.length); null when the package has no bound witness. */
export function nextHint(pkg: ResolvedCasePackage, knowledge: PlayerKnowledge, events: readonly unknown[]): Hint | null {
  if (pkg.proof === null) return null;
  const steps = witnessSteps(pkg);
  const now = events.length;
  const open = openStep(pkg, knowledge, events, steps, now);
  // Earlier hints on the same open step raise the level.
  const earlier = events.filter((e, j) => (e as { type?: unknown }).type === "hint" && openStep(pkg, knowledge, events, steps, j) === open).length;
  const wanted = Math.min(3, earlier + 1) as 1 | 2 | 3;
  if (open === -1) return Object.freeze({ level: wanted, kind: "accuse", target: null, questionId: null });

  const step = steps[open]!;
  const subject = step.type === "interrogate" ? step.npc : step.target;
  const known = knowledge.known.some((e) => e.ref === subject);
  // Never point at an entity the player does not know yet: stay vague instead.
  const level = known ? wanted : 1;
  return Object.freeze({
    level,
    kind: step.type === "interrogate" ? "interrogate" : step.action,
    target: level >= 2 ? subject : null,
    questionId: level === 3 && step.type === "interrogate" ? step.questionId : null,
  });
}

/** Number of hints taken in an event log. */
export const hintCount = (events: readonly unknown[]): number => events.filter((e) => (e as { type?: unknown }).type === "hint").length;
