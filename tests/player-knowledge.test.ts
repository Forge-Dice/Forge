import { describe, expect, it } from "vitest";
import { initialPlayerKnowledge, recordEvidence, recordInterrogation, type PlayerKnowledge } from "../src/domain/player-knowledge.ts";
import { releaseEvidence } from "../src/domain/evidence-presentation.ts";
import { interrogate, type InterrogationObservation } from "../src/domain/interrogation.ts";
import type { EvidenceObservation } from "../src/domain/evidence-presentation.ts";
import type { ResolvedCasePackage } from "../src/domain/case-package.ts";
import { resolved } from "./case-package.fixture.ts";

// Contract MYST-SESSION-0001A §3: PlayerKnowledge journal helpers, driven by the real release modules.

const pkg = resolved((p) => p.initial.known.push({ kind: "evidence", id: "evidence:bloody-knife" }));
const ref = (kind: any, id: string) => pkg.refs.refFor(kind, id)!;

function evidence(id: string, p: ResolvedCasePackage = pkg): EvidenceObservation {
  const result = releaseEvidence(p.presentation, id, p.refs);
  if (!result.success) throw new Error(result.code);
  return result.observation;
}

function ask(npcId: string, questionId: string, p: ResolvedCasePackage = pkg): InterrogationObservation {
  const npc = p.npcs.find((n) => n.snapshot.npcId === npcId)!;
  const result = interrogate({
    truth: p.truth,
    solution: p.solution,
    snapshot: npc.snapshot,
    catalogue: p.catalogue,
    profile: npc.profile,
    refs: p.refs,
    known: [
      ...p.truth.persons.map((e) => ({ kind: "person" as const, id: e.id })),
      ...p.truth.locations.map((e) => ({ kind: "location" as const, id: e.id })),
      ...p.truth.items.map((e) => ({ kind: "item" as const, id: e.id })),
      ...p.truth.events.map((e) => ({ kind: "event" as const, id: e.id })),
      ...p.truth.evidence.map((e) => ({ kind: "evidence" as const, id: e.id })),
    ],
    questionId,
  });
  if (!result.success) throw new Error(result.code);
  return result.observation;
}

const refsOf = (k: PlayerKnowledge) => k.known.map((e) => e.ref);

describe("initialPlayerKnowledge", () => {
  const k0 = initialPlayerKnowledge(pkg);

  it("contains exactly initial.known, sorted by ref, first seen initially", () => {
    const expected = pkg.initial.known.map((e) => ref(e.kind, e.id)).sort();
    expect(refsOf(k0)).toEqual(expected);
    for (const entity of k0.known) expect(entity.firstSeen).toEqual({ kind: "initial" });
    expect(k0.known.find((e) => e.ref === ref("person", "person:dora"))!.kind).toBe("person");
  });

  it("A14 initially known evidence is Known but neither discovered nor observed", () => {
    expect(refsOf(k0)).toContain(ref("evidence", "evidence:bloody-knife"));
    expect(k0.discoveries).toEqual([]);
    expect(k0.observations).toEqual([]);
  });

  it("A15 empty initial known releases nothing", () => {
    const empty = initialPlayerKnowledge(resolved((p) => (p.initial.known = [])));
    expect(empty).toEqual({ schemaVersion: 1, known: [], discoveries: [], observations: [] });
  });

  it("is deeply frozen and carries no canonical IDs", () => {
    expect(Object.isFrozen(k0)).toBe(true);
    expect(Object.isFrozen(k0.known)).toBe(true);
    expect(Object.isFrozen(k0.known[0])).toBe(true);
    expect(JSON.stringify(k0)).not.toMatch(/(person|location|item|event|evidence):/);
  });
});

describe("recordEvidence", () => {
  const k0 = initialPlayerKnowledge(pkg);
  const boots = evidence("evidence:muddy-boots");

  it("adds the evidence itself and its mentions, one discovery and one observation", () => {
    const k1 = recordEvidence(k0, boots, 3);
    expect(refsOf(k1)).toEqual([...refsOf(k0), ref("evidence", "evidence:muddy-boots"), ref("location", "location:garden")].sort());
    expect(k1.known.find((e) => e.ref === ref("location", "location:garden"))!.firstSeen).toEqual({ kind: "event", eventIndex: 3 });
    expect(k1.discoveries).toEqual([{ evidence: boots.evidence, firstDiscoveryEvent: 3 }]);
    expect(k1.observations).toEqual([{ source: { kind: "evidence", eventIndex: 3, evidence: boots.evidence }, observation: boots }]);
  });

  it("a repeated find records nothing new; first origin stays", () => {
    const k1 = recordEvidence(k0, boots, 3);
    expect(recordEvidence(k1, evidence("evidence:muddy-boots"), 7)).toBe(k1);
  });

  it("known entities keep their first origin when mentioned again", () => {
    const k1 = recordEvidence(k0, evidence("evidence:bloody-knife"), 2);
    const knife = k1.known.find((e) => e.ref === ref("evidence", "evidence:bloody-knife"))!;
    expect(knife.firstSeen).toEqual({ kind: "initial" });
    expect(k1.known.find((e) => e.ref === ref("item", "item:knife"))!.firstSeen).toEqual({ kind: "event", eventIndex: 2 });
  });

  it("discoveries are sorted by evidence ref, observations stay chronological", () => {
    const k2 = recordEvidence(recordEvidence(k0, boots, 1), evidence("evidence:bloody-knife"), 2);
    const refs = k2.discoveries.map((d) => d.evidence);
    expect(refs).toEqual([...refs].sort());
    expect(k2.observations.map((o) => o.source.eventIndex)).toEqual([1, 2]);
  });

  it("never mutates its input", () => {
    const before = JSON.stringify(k0);
    recordEvidence(k0, boots, 1);
    expect(JSON.stringify(k0)).toBe(before);
  });
});

describe("recordInterrogation", () => {
  const k0 = initialPlayerKnowledge(pkg);

  it("adds exactly the answer's mentions and journals every answer", () => {
    const answer = ask("person:dora", "question:where-was-ben");
    const k1 = recordInterrogation(k0, answer, 0);
    expect(refsOf(k1)).toEqual([...refsOf(k0), ref("person", "person:ben")].sort());
    expect(k1.observations).toEqual([
      { source: { kind: "npc", eventIndex: 0, npc: answer.npc, questionId: "question:where-was-ben" }, observation: answer },
    ]);
    expect(k1.discoveries).toBe(k0.discoveries);
  });

  it("repeated questions are two records; does_not_know and decline add no Known", () => {
    const repeat = ask("person:dora", "question:ben-in-library");
    const k2 = recordInterrogation(recordInterrogation(k0, repeat, 0), repeat, 1);
    expect(k2.observations).toHaveLength(2);
    for (const q of ["question:ben-planned", "question:bloody-knife"]) {
      const k = recordInterrogation(k0, ask("person:dora", q), 4);
      expect(k.known).toBe(k0.known);
      expect(k.observations).toHaveLength(1);
    }
  });

  it("contradictory reports coexist", () => {
    const fromDora = ask("person:dora", "question:anna-in-library");
    const fromAnna = ask("person:anna", "question:ben-in-library");
    const k = recordInterrogation(recordInterrogation(k0, fromDora, 0), fromAnna, 1);
    expect(k.observations.map((o) => o.observation)).toEqual([fromDora, fromAnna]);
  });
});
