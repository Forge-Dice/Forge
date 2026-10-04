import { describe, expect, it } from "vitest";
import { belief, knowledge, uncertain } from "./npc-knowledge.fixture.ts";
import { QUESTIONS, allKnown, fakeRefs, pr, q, scene } from "./interrogation.fixture.ts";
import { ref } from "./interrogation-authoring.fixture.ts";
import { projectNpcKnowledgeWithBridge, type NpcVisibleContext } from "../src/domain/npc-knowledge.projection.ts";
import {
  RESPONSE_STANCES,
  createReleaseTranslator,
  decideResponse,
  type InterrogationObservation,
  type InterrogationResult,
} from "../src/domain/interrogation.ts";

// Contract MYST-0005B §8: B-01..B-34 and B-44..B-50. Case numbers appear in the test names.

const base = scene();
const DORA = pr("person", "dora");

function observed(result: InterrogationResult): InterrogationObservation {
  if (!result.success) throw new Error(`expected success, got ${result.code}`);
  return result.observation;
}

const answer = (questionId: string, stance: string, statement: object, mentions: [string, string][]) => ({
  schemaVersion: 1,
  npc: DORA,
  questionId,
  act: "answer",
  stance,
  statement,
  mentions: mentions
    .map(([kind, id]) => ({ kind, ref: pr(kind as any, id) }))
    .sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0)),
});
const unknown = (questionId: string) => ({ schemaVersion: 1, npc: DORA, questionId, act: "answer", stance: "does_not_know" });
const KILL = () => pr("event", "ben-kills-clara");

describe("Dora's expected observations (§3)", () => {
  const expected: Record<string, object> = {
    // B-01 true knowledge
    "ben-in-library": answer(q("ben-in-library"), "affirms", {
      kind: "personAt", person: pr("person", "ben"), location: pr("location", "library"), at: 300,
    }, [["person", "ben"], ["location", "library"]]),
    // B-02 false knowledge
    "anna-in-library": answer(q("anna-in-library"), "denies", {
      kind: "personAt", person: pr("person", "anna"), location: pr("location", "library"), at: 300,
    }, [["person", "anna"], ["location", "library"]]),
    // B-04 false belief (objectively false) is still affirmed
    "anna-in-killing": answer(q("anna-in-killing"), "affirms", {
      kind: "eventHasParticipant", event: KILL(), person: pr("person", "anna"),
    }, [["event", "ben-kills-clara"], ["person", "anna"]]),
    // B-06 uncertain leaning true
    "ben-in-killing": answer(q("ben-in-killing"), "leans_affirms", {
      kind: "eventHasParticipant", event: KILL(), person: pr("person", "ben"),
    }, [["event", "ben-kills-clara"], ["person", "ben"]]),
    // B-07 uncertain leaning false
    "knife-used": answer(q("knife-used"), "leans_denies", {
      kind: "eventHasItem", event: KILL(), item: pr("item", "knife"),
    }, [["event", "ben-kills-clara"], ["item", "knife"]]),
    // B-10 conclusion belief false
    "ben-responsible": answer(q("ben-responsible"), "denies", {
      kind: "personResponsibleForEvent", person: pr("person", "ben"), event: KILL(),
    }, [["person", "ben"], ["event", "ben-kills-clara"]]),
    // B-09 absent attitude
    "ben-planned": unknown(q("ben-planned")),
    // B-08 uncertain neutral on a conclusion
    "argument-caused-killing": answer(q("argument-caused-killing"), "uncertain", {
      kind: "eventCausedEvent", causeEvent: pr("event", "argument"), event: KILL(),
    }, [["event", "argument"], ["event", "ben-kills-clara"]]),
    "where-was-ben": answer(q("where-was-ben"), "affirms", {
      kind: "personAt", person: pr("person", "ben"), location: pr("location", "library"), at: 300,
    }, [["person", "ben"], ["location", "library"]]),
    // B-15 player-known, NPC-unknown
    "anna-in-garden": unknown(q("anna-in-garden")),
    // B-11 evidence awareness, declined
    "bloody-knife": { schemaVersion: 1, npc: DORA, questionId: q("bloody-knife"), act: "decline" },
  };

  it.each(Object.entries(expected))("%s", (slug, observation) => {
    const result = base.ask(q(slug));
    expect(result).toEqual({ success: true, observation });
    expect(JSON.stringify(result)).toBe(JSON.stringify({ success: true, observation }));
  });

  it("B-09 does_not_know carries neither statement nor mentions", () => {
    expect(Object.keys(observed(base.ask(q("ben-planned"))))).toEqual(["schemaVersion", "npc", "questionId", "act", "stance"]);
  });

  it("B-11 decline carries no evidence reference", () => {
    const json = JSON.stringify(base.ask(q("bloody-knife")));
    expect(json).not.toContain(pr("evidence", "bloody-knife"));
    expect(json).not.toContain("evidence");
  });
});

describe("stances", () => {
  it("B-03 true belief (Anna) is byte-identical to B-01 except for npc", () => {
    const anna = observed(scene({ npc: "anna" }).ask(q("ben-in-library")));
    const dora = observed(base.ask(q("ben-in-library")));
    expect(anna.npc).toBe(pr("person", "anna"));
    expect(JSON.stringify({ ...anna, npc: DORA })).toBe(JSON.stringify(dora));
  });

  it("B-05 belief false", () => {
    const s = scene({ snapshot: (n) => (n.attitudes[3].stance = belief(false)) });
    expect(observed(s.ask(q("ben-in-killing")))).toMatchObject({ stance: "denies" });
  });

  it("B-29 changed snapshot: knowledge -> uncertain(true)", () => {
    const s = scene({ snapshot: (n) => (n.attitudes[0].stance = uncertain(true)) });
    expect(observed(s.ask(q("ben-in-library")))).toMatchObject({ stance: "leans_affirms" });
  });

  it("AC-05 decideResponse covers all stance values and the missing attitude", () => {
    const projection = projectNpcKnowledgeWithBridge(base.snapshot, base.truth, base.solution);
    if (!projection.success) throw new Error("projection");
    const attitude = projection.context.attitudes[0]!;
    const contextWith = (stance: object): NpcVisibleContext => ({ ...projection.context, attitudes: [{ ...attitude, stance: stance as any }] });
    const cases: [object, string][] = [
      [knowledge(true), "affirms"],
      [belief(true), "affirms"],
      [knowledge(false), "denies"],
      [belief(false), "denies"],
      [uncertain(true), "leans_affirms"],
      [uncertain(false), "leans_denies"],
      [uncertain(null), "uncertain"],
    ];
    for (const [stance, expected] of cases) {
      const decision = decideResponse(contextWith(stance), attitude.claim);
      expect(decision.stance).toBe(expected);
      expect(decision.claim).toBe(attitude.claim);
    }
    expect(decideResponse(projection.context, null)).toEqual({ stance: "does_not_know", claim: null });
    expect(decideResponse({ ...projection.context, attitudes: [] }, attitude.claim)).toEqual({ stance: "does_not_know", claim: null });
    expect(RESPONSE_STANCES).toHaveLength(6);
  });

  it("decideResponse returns the context's own claim, not the target", () => {
    const projection = projectNpcKnowledgeWithBridge(base.snapshot, base.truth, base.solution);
    if (!projection.success) throw new Error("projection");
    const target = projection.bridge.visibleClaimOf(base.truth.propositions[0]!.claim)!;
    const decision = decideResponse(projection.context, target);
    expect(decision.claim).not.toBe(target);
    expect(projection.context.attitudes.some((a) => a.claim === decision.claim)).toBe(true);
  });

  it("B-44 alias claim (other proposition ID, other property order) matches the same attitude", () => {
    const projection = projectNpcKnowledgeWithBridge(base.snapshot, base.truth, base.solution);
    if (!projection.success) throw new Error("projection");
    const byId = (id: string) => base.truth.propositions.find((p) => p.id === id)!.claim;
    const main = decideResponse(projection.context, projection.bridge.visibleClaimOf(byId("proposition:ben-at-library")));
    const alias = decideResponse(projection.context, projection.bridge.visibleClaimOf(byId("proposition:ben-seen-in-library")));
    expect(alias.stance).toBe("affirms");
    expect(alias.claim).toBe(main.claim);
  });

  it("B-45 without a solution, conclusion questions are does_not_know", () => {
    const s = scene({ withSolution: false });
    expect(observed(s.ask(q("ben-responsible")))).toEqual(unknown(q("ben-responsible")));
    expect(observed(s.ask(q("ben-in-library")))).toMatchObject({ stance: "affirms" });
  });
});

describe("question availability", () => {
  const QNA = { success: false, code: "QUESTION_NOT_AVAILABLE" };

  it("B-13 unknown question", () => {
    expect(base.ask("question:nobody")).toEqual(QNA);
  });

  it.each([[42], [{ id: "question:ben-in-library" }], [null], [undefined], [["question:ben-in-library"]]])(
    "B-14 non-string questionId %j",
    (questionId) => {
      expect(base.ask(questionId)).toEqual(QNA);
    },
  );

  it("B-16 NPC-known, player-unknown: library not known", () => {
    const known = allKnown(base.truth).filter((e) => e.id !== "location:library");
    expect(base.ask(q("ben-in-library"), { known })).toEqual(QNA);
  });

  it("B-17 explicit reveal: library unknown to the player, released by the rule", () => {
    const known = allKnown(base.truth).filter((e) => e.id !== "location:library");
    const observation = observed(base.ask(q("where-was-ben"), { known }));
    expect(observation).toMatchObject({ stance: "affirms" });
    const mentions = [
      { kind: "person", ref: pr("person", "ben") },
      { kind: "location", ref: pr("location", "library") },
    ].sort((a, b) => (a.ref < b.ref ? -1 : 1));
    expect((observation as any).mentions).toEqual(mentions);
  });

  it("B-46 NPC itself not known", () => {
    const known = allKnown(base.truth).filter((e) => e.id !== "person:dora");
    expect(base.ask(q("ben-in-library"), { known })).toEqual(QNA);
    expect(base.ask(q("bloody-knife"), { known })).toEqual(QNA);
  });

  it("B-47 all player errors are the same frozen object without extra fields", () => {
    const known = allKnown(base.truth).filter((e) => e.id !== "location:library" && e.id !== "person:dora");
    const errors = [base.ask("question:nobody"), base.ask(7), base.ask(q("ben-in-library"), { known }), base.ask(q("where-was-ben"), { known })];
    for (const error of errors) {
      expect(error).toEqual(QNA);
      expect(Object.keys(error)).toEqual(["success", "code"]);
      expect(Object.isFrozen(error)).toBe(true);
      expect(error).toBe(errors[0]);
    }
  });

  it("B-18 reveal on does_not_know releases nothing", () => {
    const s = scene({
      catalogue: (c) => c.questions.push({ id: "question:anna-where", mentions: [ref.person("anna")] }),
      profile: (p) =>
        p.rules.push({
          questionId: "question:anna-where",
          act: "answer",
          claim: { kind: "personAt", personId: "person:anna", locationId: "location:garden", at: 300 },
          reveal: [ref.location("garden")],
        }),
    });
    expect(observed(s.ask("question:anna-where"))).toEqual(unknown("question:anna-where"));
  });

  it("B-19 decline releases nothing even where an answer rule would reveal", () => {
    const s = scene({ profile: (p) => (p.rules[8] = { questionId: q("where-was-ben"), act: "decline" }) });
    const known = allKnown(base.truth).filter((e) => e.id !== "location:library");
    const observation = observed(s.ask(q("where-was-ben"), { known }));
    expect(observation).toEqual({ schemaVersion: 1, npc: DORA, questionId: q("where-was-ben"), act: "decline" });
    expect(JSON.stringify(observation)).not.toContain(pr("location", "library"));
  });
});

describe("release translator", () => {
  const projection = projectNpcKnowledgeWithBridge(base.snapshot, base.truth, base.solution);
  if (!projection.success) throw new Error("projection");
  const { context, bridge } = projection;
  const benAtLibrary = context.attitudes.find((a) => a.claim.kind === "personAt" && a.stance.kind === "knowledge" && a.stance.value)!;
  const libraryRef = (benAtLibrary.claim as any).location;
  const refs = fakeRefs(base.truth);

  it("B-20 forbidden reveal: unauthorized entity translates to null", () => {
    const without = createReleaseTranslator(bridge, refs, [ref.person("ben") as any]);
    expect(without.translate(libraryRef)).toBeNull();
    const withLibrary = createReleaseTranslator(bridge, refs, [ref.location("library") as any]);
    expect(withLibrary.translate(libraryRef)).toBe(pr("location", "library"));
  });

  it("B-24 a ref object from another NPC's projection is not translated", () => {
    const anna = scene({ npc: "anna" });
    const annaProjection = projectNpcKnowledgeWithBridge(anna.snapshot, anna.truth, anna.solution);
    if (!annaProjection.success) throw new Error("projection");
    const annaBen = (annaProjection.context.attitudes[0]!.claim as any).person;
    const doraBen = (benAtLibrary.claim as any).person;
    expect(annaBen).toEqual(doraBen);
    const translator = createReleaseTranslator(bridge, refs, [ref.person("ben") as any]);
    expect(translator.translate(doraBen)).toBe(pr("person", "ben"));
    expect(translator.translate(annaBen)).toBeNull();
  });

  it("B-48 leaking port answers are refused", () => {
    const leaks: ((k: string, id: string) => string | null)[] = [
      (_k, id) => id,
      () => "ben",
      (k, id) => refs.refFor(k as any, id)!.toUpperCase(),
      (k, id) => refs.refFor(k as any, id)! + "0",
      (k, id) => refs.refFor(k as any, id)!.slice(0, -1),
    ];
    for (const refFor of leaks) {
      expect(base.ask(q("ben-in-library"), { refs: { ...refs, refFor } })).toEqual({ success: false, code: "REF_UNAVAILABLE" });
    }
    // Only the statement entity leaks: still no partial answer.
    const partial = { ...refs, refFor: (k: any, id: string) => (k === "location" ? id : refs.refFor(k, id)) };
    expect(base.ask(q("ben-in-library"), { refs: partial })).toEqual({ success: false, code: "REF_UNAVAILABLE" });
  });

  it("B-49 non-injective port", () => {
    const constant = { ...refs, refFor: () => pr("person", "dora") };
    expect(base.ask(q("ben-in-library"), { refs: constant })).toEqual({ success: false, code: "REF_UNAVAILABLE" });
    expect(base.ask(q("ben-planned"), { refs: constant })).toMatchObject({ success: true });
  });

  it("B-50 port returns null for library", () => {
    const missing = { ...refs, refFor: (k: any, id: string) => (id === "location:library" ? null : refs.refFor(k, id)) };
    expect(base.ask(q("ben-in-library"), { refs: missing })).toEqual({ success: false, code: "REF_UNAVAILABLE" });
    expect(base.ask(q("ben-in-killing"), { refs: missing })).toMatchObject({ success: true });
  });

  it("the NPC ref is checked for every observation kind", () => {
    const noNpc = { ...refs, refFor: (k: any, id: string) => (id === "person:dora" ? null : refs.refFor(k, id)) };
    for (const slug of ["bloody-knife", "ben-planned", "ben-in-library"]) {
      expect(base.ask(q(slug), { refs: noNpc })).toEqual({ success: false, code: "REF_UNAVAILABLE" });
    }
  });
});

describe("determinism and independence", () => {
  it("B-21 repeated question is byte-identical", () => {
    const runs = [1, 2, 3].map(() => JSON.stringify(base.ask(q("ben-in-library"))));
    expect(new Set(runs).size).toBe(1);
  });

  it("B-22 permuted question order yields the same observations", () => {
    const forward = QUESTIONS.map((id) => JSON.stringify(base.ask(id)));
    const backward = [...QUESTIONS].reverse().map((id) => JSON.stringify(base.ask(id)));
    expect(new Set(backward)).toEqual(new Set(forward));
  });

  it("B-23 multiple NPCs answer independently", () => {
    const anna = scene({ npc: "anna" });
    const fromAnna = observed(anna.ask(q("ben-in-library")));
    const fromDora = observed(base.ask(q("ben-in-library")));
    expect(fromAnna).toMatchObject({ npc: pr("person", "anna"), stance: "affirms" });
    expect(fromDora).toMatchObject({ npc: DORA, stance: "affirms" });
    expect(anna.ask(q("anna-in-library"))).toEqual({ success: false, code: "QUESTION_NOT_AVAILABLE" });
  });
});

describe("binding", () => {
  const BM = { success: false, code: "BINDING_MISMATCH" };

  it("B-30 snapshot of another NPC than the profile", () => {
    expect(base.ask(q("ben-in-library"), { snapshot: scene({ npc: "anna" }).snapshot })).toEqual(BM);
  });

  it("B-31 changed truth with the old catalogue", () => {
    const changed = scene({ truth: (t) => (t.persons[0].name = "Anna B.") });
    expect(changed.ask(q("ben-in-library"), { catalogue: base.input("").catalogue })).toEqual(BM);
  });

  it("B-32 snapshot bound to the old solution", () => {
    const changed = scene({ solution: (s) => (s.resolutions[0].mechanism = "mixed") });
    expect(changed.ask(q("ben-in-library"), { snapshot: base.snapshot })).toEqual(BM);
  });

  it("B-34 port bound to another truth", () => {
    const other = scene({ truth: (t) => (t.title = "anders") });
    expect(base.ask(q("ben-in-library"), { refs: fakeRefs(other.truth) })).toEqual(BM);
  });

  it("profile bound to another catalogue", () => {
    const other = scene({ catalogue: (c) => (c.revision = 2) });
    expect(base.ask(q("ben-in-library"), { catalogue: other.input("").catalogue })).toEqual(BM);
  });

  it("binding is checked before the question", () => {
    expect(base.ask("question:nobody", { refs: fakeRefs(scene({ truth: (t) => (t.title = "x") }).truth) })).toEqual(BM);
  });

  it("B-33 changed truth with all documents rebound: same observations", () => {
    const changed = scene({ truth: (t) => (t.persons[0].name = "Anna B.") });
    for (const id of QUESTIONS) expect(JSON.stringify(changed.ask(id))).toBe(JSON.stringify(base.ask(id)));
  });
});
