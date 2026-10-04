import { describe, expect, it } from "vitest";
import {
  aware,
  belief,
  conclusionAttitude,
  knowledge,
  npcInput,
  propositionAttitude,
  uncertain,
  world,
} from "./npc-knowledge.fixture.ts";
import { annaInput, doraInput } from "./interrogation.fixture.ts";
import { parseNpcKnowledge, type NpcKnowledgeSnapshot } from "../src/domain/npc-knowledge.ts";
import {
  projectNpcKnowledge,
  projectNpcKnowledgeWithBridge,
  type NpcProjectionBridge,
  type NpcVisibleContext,
} from "../src/domain/npc-knowledge.projection.ts";
import type { CaseSolution } from "../src/domain/case-solution.ts";
import type { CaseTruth } from "../src/domain/case-truth.ts";

// Contract MYST-0005B §4: projection bridge. B-25, B-26, B-27, B-43 and the semantics of §4.2.

const base = world();
type Case = [string, NpcKnowledgeSnapshot, CaseTruth, CaseSolution | null];

const parse = (input: any, solution: CaseSolution | null) => parseNpcKnowledge(input, base.truth, solution);
const CASES: Case[] = [
  ["dora", parse(doraInput(base.truth, base.solution), base.solution), base.truth, base.solution],
  ["dora without solution", parse(doraInput(base.truth, null), null), base.truth, null],
  ["anna", parse(annaInput(base.truth, base.solution), base.solution), base.truth, base.solution],
  ["empty anna", parse(npcInput(base.truth, base.solution), base.solution), base.truth, base.solution],
  [
    "crowded",
    parse(
      npcInput(base.truth, base.solution, (n) => {
        n.awareness = [aware("location", "garden"), aware("item", "knife"), aware("evidence", "muddy-boots")];
        n.attitudes = [
          propositionAttitude("ben-at-library", knowledge(true)),
          propositionAttitude("anna-in-killing", belief(false)),
          propositionAttitude("knife-used", uncertain(null)),
          conclusionAttitude("argument-caused-killing", belief(true)),
          conclusionAttitude("killing-intended", uncertain(false)),
          conclusionAttitude("killing-ordinary", belief(true)),
          conclusionAttitude("nobody-responsible", belief(false)),
          conclusionAttitude("ben-role-planner", belief(false)),
        ];
      }),
      base.solution,
    ),
    base.truth,
    base.solution,
  ],
];

function bridged(snapshot: NpcKnowledgeSnapshot, truth = base.truth, solution: CaseSolution | null = base.solution) {
  const result = projectNpcKnowledgeWithBridge(snapshot, truth, solution);
  if (!result.success) throw new Error("projection failed");
  return result;
}

const allRefs = (context: NpcVisibleContext) => [
  context.self,
  ...context.awareness,
  ...context.attitudes.flatMap((a) => Object.values(a.claim).filter((v) => typeof v === "object")),
];

describe("B-43 differential against projectNpcKnowledge", () => {
  it.each(CASES)("%s: deep-equal and JSON-equal context", (_name, snapshot, truth, solution) => {
    const plain = projectNpcKnowledge(snapshot, truth, solution);
    const withBridge = projectNpcKnowledgeWithBridge(snapshot, truth, solution);
    if (!plain.success || !withBridge.success) throw new Error("projection failed");
    expect(withBridge.context).toEqual(plain.context);
    expect(JSON.stringify(withBridge.context)).toBe(JSON.stringify(plain.context));
    expect(Object.keys(withBridge)).toEqual(["success", "context", "bridge"]);
  });

  it("failure is the same error object shape without a bridge", () => {
    const other = world((t) => (t.title = "anders"));
    const [, snapshot] = CASES[0]!;
    const plain = projectNpcKnowledge(snapshot, other.truth, other.solution);
    const withBridge = projectNpcKnowledgeWithBridge(snapshot, other.truth, other.solution);
    expect(withBridge).toEqual(plain);
    expect(withBridge).toEqual({ success: false, code: "CONTEXT_BINDING_MISMATCH" });
    expect(Object.isFrozen(withBridge)).toBe(true);
  });
});

describe("entityOf", () => {
  const [, dora] = CASES[0]!;
  const { context, bridge } = bridged(dora);

  it("maps every emitted entity ref object to a fresh frozen canonical entity", () => {
    expect(bridge.entityOf(context.self)).toEqual({ kind: "person", id: "person:dora" });
    for (const ref of allRefs(context) as any[]) {
      const entity = bridge.entityOf(ref)!;
      expect(entity.kind).toBe(ref.kind);
      expect(entity.id.startsWith(`${ref.kind}:`)).toBe(true);
      expect(Object.isFrozen(entity)).toBe(true);
      expect(bridge.entityOf(ref)).not.toBe(entity);
    }
  });

  it("B-25 a JSON copy of an own ref is not recognized", () => {
    const copy = JSON.parse(JSON.stringify(context.self));
    expect(copy).toEqual(context.self);
    expect(bridge.entityOf(copy)).toBeNull();
    expect(bridge.entityOf({ ...context.self })).toBeNull();
  });

  it("B-26 statement refs and non-objects are not recognized", () => {
    for (const attitude of context.attitudes) expect(bridge.entityOf(attitude.subject)).toBeNull();
    for (const junk of [null, undefined, 1, "person|1", { kind: "person", index: 1 }]) {
      expect(bridge.entityOf(junk as any)).toBeNull();
    }
  });

  it("B-27 a ref from a newer projection is not recognized by a stale bridge", () => {
    const rev2 = parseNpcKnowledge({ ...doraInput(base.truth, base.solution), revision: 2 }, base.truth, base.solution);
    const fresh = bridged(rev2).context;
    expect(fresh.self).toEqual(context.self);
    expect(bridge.entityOf(fresh.self)).toBeNull();
  });

  it("refs from projectNpcKnowledge are never recognized", () => {
    const plain = projectNpcKnowledge(dora, base.truth, base.solution);
    if (!plain.success) throw new Error("projection failed");
    expect(bridge.entityOf(plain.context.self)).toBeNull();
  });
});

describe("visibleClaimOf", () => {
  const [, dora] = CASES[0]!;
  const { context, bridge } = bridged(dora);
  const claimOf = (id: string) => base.truth.propositions.find((p) => p.id === id)!.claim;

  it("returns a frozen visible claim when every reference is visible, without registering its refs", () => {
    const claim = bridge.visibleClaimOf(claimOf("proposition:ben-at-library"))!;
    expect(claim).toEqual(context.attitudes.find((a) => a.claim.kind === "personAt" && a.stance.kind === "knowledge" && a.stance.value)!.claim);
    expect(Object.isFrozen(claim)).toBe(true);
    expect(Object.isFrozen((claim as any).person)).toBe(true);
    expect(bridge.entityOf((claim as any).person)).toBeNull();
  });

  it("returns null when any reference is not visible to the NPC", () => {
    expect(bridge.visibleClaimOf({ kind: "personAt", personId: "person:anna", locationId: "location:garden", at: 300 } as any)).toBeNull();
    expect(bridge.visibleClaimOf({ kind: "eventHasParticipant", eventId: "event:walk", personId: "person:anna" } as any)).toBeNull();
  });
});

describe("bridge capability", () => {
  const bridge: NpcProjectionBridge = bridged(CASES[0]![1]).bridge;

  it("is frozen and refuses serialization", () => {
    expect(Object.isFrozen(bridge)).toBe(true);
    expect(() => bridge.toJSON()).toThrow(TypeError);
    expect(() => JSON.stringify(bridge)).toThrow(TypeError);
    expect(() => structuredClone(bridge)).toThrow();
  });

  it("two projections of the same snapshot have independent bridges", () => {
    const a = bridged(CASES[0]![1]);
    const b = bridged(CASES[0]![1]);
    expect(a.context).toEqual(b.context);
    expect(a.bridge.entityOf(b.context.self)).toBeNull();
    expect(b.bridge.entityOf(b.context.self)).toEqual({ kind: "person", id: "person:dora" });
  });
});
