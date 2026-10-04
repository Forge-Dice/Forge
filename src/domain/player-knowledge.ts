import type { EvidenceObservation } from "./evidence-presentation.ts";
import type { InterrogationObservation } from "./interrogation.ts";
import type { EntityRef, ResolvedCasePackage } from "./case-package.ts";

// PlayerKnowledge V1 (MYST-SESSION-0001A §3): a source-bound journal of what the player received,
// not a set of true propositions. Only initial known entities, released evidence itself and
// explicit observation mentions grow Known; nothing is pulled from reports, links or the Truth.
// Trusted-only helpers: the session reducer validates refs before it calls them.

export type KnownEntity = {
  readonly kind: EntityRef["kind"];
  readonly ref: string;
  readonly firstSeen: { readonly kind: "initial" } | { readonly kind: "event"; readonly eventIndex: number };
};

export type ObservationRecord =
  | {
      readonly source: { readonly kind: "evidence"; readonly eventIndex: number; readonly evidence: string };
      readonly observation: EvidenceObservation;
    }
  | {
      readonly source: { readonly kind: "npc"; readonly eventIndex: number; readonly npc: string; readonly questionId: string };
      readonly observation: InterrogationObservation;
    };

export type PlayerKnowledge = {
  readonly schemaVersion: 1;
  readonly known: readonly KnownEntity[];
  readonly discoveries: readonly { readonly evidence: string; readonly firstDiscoveryEvent: number }[];
  readonly observations: readonly ObservationRecord[];
};

const byCodeUnits = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function withKnown(
  knowledge: PlayerKnowledge,
  entities: readonly { readonly kind: EntityRef["kind"]; readonly ref: string }[],
  firstSeen: KnownEntity["firstSeen"],
): readonly KnownEntity[] {
  const seen = new Set(knowledge.known.map((k) => k.ref));
  const added: KnownEntity[] = [];
  for (const { kind, ref } of entities) {
    if (seen.has(ref)) continue; // first origin wins
    seen.add(ref);
    added.push(Object.freeze({ kind, ref, firstSeen }));
  }
  if (added.length === 0) return knowledge.known;
  return Object.freeze([...knowledge.known, ...added].sort((a, b) => byCodeUnits(a.ref, b.ref)));
}

/** Known at prefix zero: exactly pkg.initial.known, translated with the package refs. */
export function initialPlayerKnowledge(pkg: ResolvedCasePackage): PlayerKnowledge {
  const empty: PlayerKnowledge = Object.freeze({ schemaVersion: 1, known: [], discoveries: [], observations: [] });
  const initial = pkg.initial.known.map((e) => ({ kind: e.kind, ref: pkg.refs.refFor(e.kind, e.id)! }));
  return Object.freeze({ ...empty, known: withKnown(empty, initial, Object.freeze({ kind: "initial" as const })) });
}

/**
 * Records one released evidence: the evidence itself and its mentions become Known, and the
 * discovery plus its observation are recorded exactly once. A repeated find changes nothing.
 */
export function recordEvidence(knowledge: PlayerKnowledge, observation: EvidenceObservation, eventIndex: number): PlayerKnowledge {
  if (knowledge.discoveries.some((d) => d.evidence === observation.evidence)) return knowledge;
  const firstSeen = Object.freeze({ kind: "event" as const, eventIndex });
  const entities = [{ kind: "evidence" as const, ref: observation.evidence }, ...observation.mentions];
  const discovery = Object.freeze({ evidence: observation.evidence, firstDiscoveryEvent: eventIndex });
  const record: ObservationRecord = Object.freeze({
    source: Object.freeze({ kind: "evidence" as const, eventIndex, evidence: observation.evidence }),
    observation,
  });
  return Object.freeze({
    schemaVersion: 1,
    known: withKnown(knowledge, entities, firstSeen),
    discoveries: Object.freeze([...knowledge.discoveries, discovery].sort((a, b) => byCodeUnits(a.evidence, b.evidence))),
    observations: Object.freeze([...knowledge.observations, record]),
  });
}

/** Records one NPC answer: only its explicit mentions grow Known; every answer is journaled. */
export function recordInterrogation(knowledge: PlayerKnowledge, observation: InterrogationObservation, eventIndex: number): PlayerKnowledge {
  const mentions = "mentions" in observation ? observation.mentions : [];
  const record: ObservationRecord = Object.freeze({
    source: Object.freeze({ kind: "npc" as const, eventIndex, npc: observation.npc, questionId: observation.questionId }),
    observation,
  });
  return Object.freeze({
    schemaVersion: 1,
    known: withKnown(knowledge, mentions, Object.freeze({ kind: "event" as const, eventIndex })),
    discoveries: knowledge.discoveries,
    observations: Object.freeze([...knowledge.observations, record]),
  });
}
