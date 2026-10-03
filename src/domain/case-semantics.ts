import type { CaseTruth } from "./case-truth.ts";

// Semantic Case Validator V1 (TASK-0002).
// Checks a structurally valid CaseTruth for spatial, claim and causal contradictions.
// An empty finding list only means "no contradiction under case-semantics-v1".
// It is not a playability or solvability verdict: red herrings, motives, secrets,
// relationships, evidence direction and culpability are deliberately not checked.
//
// Ticks are guaranteed safe integers by CaseTruthSchema; they are only compared, never
// combined arithmetically, and not re-validated here.

export type FindingCode =
  | "PERSON_LOCATION_CONFLICT"
  | "ITEM_LOCATION_CONFLICT"
  | "PERSON_PRESENCE_NEGATED"
  | "PARTICIPANT_CLAIM_MISMATCH"
  | "ITEM_CLAIM_MISMATCH"
  | "CLAIM_TRUTH_CONFLICT"
  | "CAUSE_STARTS_AFTER_EFFECT"
  | "CAUSAL_CYCLE";

export type SemanticFinding = {
  readonly code: FindingCode;
  readonly subjectIds: readonly string[];
  readonly message: string;
};

export type SemanticReport = {
  readonly rulesetVersion: "case-semantics-v1";
  readonly findings: readonly SemanticFinding[];
};

// Snapshot element types come from CaseTruth itself: the separately exported
// entity types are mutable and not assignable from the frozen snapshot.
type CaseEventSnapshot = CaseTruth["events"][number];
type TimeSpanSnapshot = CaseEventSnapshot["time"];
type PropositionSnapshot = CaseTruth["propositions"][number];

type PresenceFact = {
  readonly entityId: string;
  readonly locationId: string;
  readonly time: TimeSpanSnapshot;
  readonly sourceId: string;
};

// ---------- Time (comparisons only, half-open intervals) ----------

function overlaps(a: TimeSpanSnapshot, b: TimeSpanSnapshot): boolean {
  if (a.kind === "instant" && b.kind === "instant") return a.at === b.at;
  if (a.kind === "instant" && b.kind === "interval") return b.start <= a.at && a.at < b.end;
  if (a.kind === "interval" && b.kind === "instant") return a.start <= b.at && b.at < a.end;
  if (a.kind === "interval" && b.kind === "interval") return a.start < b.end && b.start < a.end;
  return false;
}

function startOf(span: TimeSpanSnapshot): number {
  return span.kind === "instant" ? span.at : span.start;
}

function formatSpan(span: TimeSpanSnapshot): string {
  return span.kind === "instant" ? `@${span.at}` : `[${span.start}, ${span.end})`;
}

// ---------- Ordering (UTF-16 code units, no localeCompare) ----------

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareSubjects(a: readonly string[], b: readonly string[]): number {
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const order = compareStrings(a[i]!, b[i]!);
    if (order !== 0) return order;
  }
  return a.length - b.length;
}

function sortedPair(a: string, b: string): [string, string] {
  return compareStrings(a, b) <= 0 ? [a, b] : [b, a];
}

// ---------- Rules ----------

type Emit = (code: FindingCode, subjectIds: string[], message: string) => void;

function checkLocationConflicts(facts: readonly PresenceFact[], code: FindingCode, emit: Emit): void {
  const byEntity = new Map<string, PresenceFact[]>();
  for (const fact of facts) {
    const list = byEntity.get(fact.entityId) ?? [];
    list.push(fact);
    byEntity.set(fact.entityId, list);
  }
  for (const [entityId, list] of byEntity) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        if (a.locationId === b.locationId || !overlaps(a.time, b.time)) continue;
        const [first, second] = compareStrings(a.sourceId, b.sourceId) <= 0 ? [a, b] : [b, a];
        emit(
          code,
          [entityId, first.sourceId, second.sourceId],
          `${entityId} is at ${first.locationId} ${formatSpan(first.time)} (${first.sourceId}) ` +
            `and at ${second.locationId} ${formatSpan(second.time)} (${second.sourceId}) at the same time`,
        );
      }
    }
  }
}

function checkClaims(truth: CaseTruth, eventsById: ReadonlyMap<string, CaseEventSnapshot>, emit: Emit): void {
  const byClaim = new Map<string, PropositionSnapshot[]>();

  for (const proposition of truth.propositions) {
    const { claim } = proposition;
    let key: string;

    switch (claim.kind) {
      case "personAt": {
        key = JSON.stringify([claim.kind, claim.personId, claim.locationId, claim.at]);
        if (!proposition.truth) {
          const instant = { kind: "instant", at: claim.at } as const;
          for (const event of truth.events) {
            if (
              event.locationId === claim.locationId &&
              event.participantIds.includes(claim.personId) &&
              overlaps(event.time, instant)
            ) {
              emit(
                "PERSON_PRESENCE_NEGATED",
                [proposition.id, event.id],
                `${proposition.id} denies ${claim.personId} at ${claim.locationId} @${claim.at}, ` +
                  `but ${event.id} places them there ${formatSpan(event.time)}`,
              );
            }
          }
        }
        break;
      }
      case "eventHasParticipant": {
        key = JSON.stringify([claim.kind, claim.eventId, claim.personId]);
        const actual = eventsById.get(claim.eventId)!.participantIds.includes(claim.personId);
        if (proposition.truth !== actual) {
          emit(
            "PARTICIPANT_CLAIM_MISMATCH",
            [proposition.id, claim.eventId],
            `${proposition.id} states truth=${proposition.truth} for ${claim.personId} participating in ` +
              `${claim.eventId}, but the participant list says ${actual}`,
          );
        }
        break;
      }
      case "eventHasItem": {
        key = JSON.stringify([claim.kind, claim.eventId, claim.itemId]);
        const actual = eventsById.get(claim.eventId)!.itemIds.includes(claim.itemId);
        if (proposition.truth !== actual) {
          emit(
            "ITEM_CLAIM_MISMATCH",
            [proposition.id, claim.eventId],
            `${proposition.id} states truth=${proposition.truth} for ${claim.itemId} in ${claim.eventId}, ` +
              `but the item list says ${actual}`,
          );
        }
        break;
      }
    }

    const group = byClaim.get(key) ?? [];
    group.push(proposition);
    byClaim.set(key, group);
  }

  for (const group of byClaim.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (group[i]!.truth === group[j]!.truth) continue;
        const [a, b] = sortedPair(group[i]!.id, group[j]!.id);
        emit("CLAIM_TRUTH_CONFLICT", [a, b], `${a} and ${b} state the same claim with different truth values`);
      }
    }
  }
}

function checkCausality(truth: CaseTruth, eventsById: ReadonlyMap<string, CaseEventSnapshot>, emit: Emit): void {
  const effectsOf = new Map<string, string[]>();
  for (const event of truth.events) effectsOf.set(event.id, []);

  for (const effect of truth.events) {
    for (const causeId of effect.causedByEventIds) {
      effectsOf.get(causeId)!.push(effect.id);
      const cause = eventsById.get(causeId)!;
      if (startOf(cause.time) > startOf(effect.time)) {
        emit(
          "CAUSE_STARTS_AFTER_EFFECT",
          [causeId, effect.id],
          `${causeId} starts at ${startOf(cause.time)}, after its effect ${effect.id} starts at ${startOf(effect.time)}`,
        );
      }
    }
  }

  // Iterative reachability; adequate for hand-authored case sizes.
  const reachable = new Map<string, Set<string>>();
  for (const start of effectsOf.keys()) {
    const seen = new Set<string>();
    const stack = [...effectsOf.get(start)!];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...effectsOf.get(id)!);
    }
    reachable.set(start, seen);
  }

  // A strongly connected component with >= 2 events: all events that reach v and are reached from v.
  const reported = new Set<string>();
  for (const [id, reach] of reachable) {
    if (!reach.has(id)) continue;
    const component = [...reach].filter((other) => reachable.get(other)!.has(id)).sort(compareStrings);
    const key = component.join(",");
    if (reported.has(key)) continue;
    reported.add(key);
    emit("CAUSAL_CYCLE", component, `Causal cycle between ${component.join(", ")}`);
  }
}

// ---------- Entry point ----------

export function validateCaseSemantics(truth: CaseTruth): SemanticReport {
  const findings: SemanticFinding[] = [];
  const emit: Emit = (code, subjectIds, message) => {
    findings.push(Object.freeze({ code, subjectIds: Object.freeze(subjectIds), message }));
  };

  const eventsById = new Map<string, CaseEventSnapshot>(truth.events.map((event) => [event.id, event]));

  const personFacts: PresenceFact[] = [];
  const itemFacts: PresenceFact[] = [];
  for (const event of truth.events) {
    for (const personId of event.participantIds) {
      personFacts.push({ entityId: personId, locationId: event.locationId, time: event.time, sourceId: event.id });
    }
    for (const itemId of event.itemIds) {
      itemFacts.push({ entityId: itemId, locationId: event.locationId, time: event.time, sourceId: event.id });
    }
  }
  for (const { id, claim, truth: isTrue } of truth.propositions) {
    if (claim.kind === "personAt" && isTrue) {
      personFacts.push({
        entityId: claim.personId,
        locationId: claim.locationId,
        time: { kind: "instant", at: claim.at },
        sourceId: id,
      });
    }
  }

  checkLocationConflicts(personFacts, "PERSON_LOCATION_CONFLICT", emit);
  checkLocationConflicts(itemFacts, "ITEM_LOCATION_CONFLICT", emit);
  checkClaims(truth, eventsById, emit);
  checkCausality(truth, eventsById, emit);

  findings.sort((a, b) => compareStrings(a.code, b.code) || compareSubjects(a.subjectIds, b.subjectIds));
  return Object.freeze({ rulesetVersion: "case-semantics-v1", findings: Object.freeze(findings) });
}
