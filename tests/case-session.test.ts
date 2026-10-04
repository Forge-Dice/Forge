import { describe, expect, it } from "vitest";
import {
  SESSION_LIMITS,
  SessionEventSchema,
  initialSession,
  reduceSession,
  replaySession,
  type SessionState,
} from "../src/domain/case-session.ts";
import { interrogate } from "../src/domain/interrogation.ts";
import { releaseEvidence } from "../src/domain/evidence-presentation.ts";
import { CLAIMS, accepted, events, knownRefs, play, refOf, sessionPackage } from "./case-session.fixture.ts";

const pkg = sessionPackage();
const e = events(pkg);
const r = (id: string) => refOf(pkg, id);
const start = initialSession(pkg);
/** After searching the library: Ben, the knife, the garden and both evidence are known. */
const explored = play(pkg, [e.search("location:library")]);

function rejected(state: SessionState, input: unknown, code: string) {
  const result = reduceSession(pkg, state, input);
  expect(result).toEqual({ ok: false, state, code });
  expect(result.state).toBe(state);
}

const canonicalKnown = (state: SessionState) =>
  state.knowledge.known.map((k) => ({ kind: k.kind, id: pkg.refs.resolve(k.ref)!.id }));

describe("initialSession", () => {
  it("binds the package identity and knows exactly the initial set, nothing discovered", () => {
    expect(start.identity).toEqual(pkg.identity);
    expect(start.phase).toBe("active");
    expect(start.events).toEqual([]);
    expect(start.verdicts).toEqual([]);
    expect(start.knowledge.discoveries).toEqual([]);
    expect(start.knowledge.known.map((k) => k.firstSeen)).toEqual(start.knowledge.known.map(() => ({ kind: "initial" })));
    expect(new Set(canonicalKnown(start).map((k) => k.id))).toEqual(new Set(pkg.initial.known.map((k) => k.id)));
    expect(Object.isFrozen(start) && Object.isFrozen(start.knowledge)).toBe(true);
  });
});

describe("SessionEventSchema", () => {
  it("accepts exactly the three strict shapes", () => {
    expect(SessionEventSchema.safeParse(e.search("location:library")).success).toBe(true);
    expect(SessionEventSchema.safeParse(e.ask("person:dora", "where-was-ben")).success).toBe(true);
    expect(SessionEventSchema.safeParse({ type: "accuse", literals: [] }).success).toBe(true);
    for (const bad of [
      { ...e.search("location:library"), seq: 1 },
      { ...e.ask("person:dora", "where-was-ben"), questionId: "where-was-ben" },
      { type: "accuse", literals: [], truthHash: "0".repeat(64) },
      { type: "investigate", action: "search_location", target: "location:library" },
      { type: "wait" },
    ]) {
      expect(SessionEventSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("caps literals at the session limit", () => {
    const literal = { claim: { kind: "noPersonResponsibleForEvent", event: r("event:ben-kills-clara") }, value: false };
    expect(SessionEventSchema.safeParse({ type: "accuse", literals: Array(32).fill(literal) }).success).toBe(true);
    expect(SessionEventSchema.safeParse({ type: "accuse", literals: Array(33).fill(literal) }).success).toBe(false);
  });
});

describe("investigate", () => {
  it("B01/B07 releases every evidence of a known place, sorted by public ref, atomically", () => {
    const result = accepted(reduceSession(pkg, start, e.search("location:library")));
    const expected = ["evidence:bloody-knife", "evidence:muddy-boots"]
      .map((id) => (releaseEvidence(pkg.presentation, id, pkg.refs) as any).observation)
      .sort((a, b) => (a.evidence < b.evidence ? -1 : 1));
    expect(result.output).toEqual({ type: "investigate", observations: expected });
    expect(result.state.events).toEqual([e.search("location:library")]);
    expect(result.state.knowledge.discoveries.map((d) => d.evidence)).toEqual(expected.map((o) => o.evidence));
    expect(result.state.knowledge.observations.map((o) => o.source)).toEqual(
      expected.map((o) => ({ kind: "evidence", eventIndex: 0, evidence: o.evidence })),
    );
  });

  it("B02 a valid but unknown place is unavailable", () => {
    rejected(start, e.search("location:garden"), "ACTION_UNAVAILABLE");
  });

  it("B03 a nonexistent or malformed ref gets the same error", () => {
    rejected(start, { ...e.search("location:library"), target: "pr1_0000000000000000" }, "ACTION_UNAVAILABLE");
    rejected(start, { ...e.search("location:library"), target: "location:library" }, "ACTION_UNAVAILABLE");
    rejected(start, { ...e.search("location:library"), target: 7 }, "ACTION_UNAVAILABLE");
  });

  it("B04 a known ref of the wrong kind is unavailable", () => {
    rejected(explored, { ...e.search("location:library"), target: r("item:knife") }, "ACTION_UNAVAILABLE");
    rejected(start, { ...e.examineItem("item:knife"), target: r("location:library") }, "ACTION_UNAVAILABLE");
    rejected(start, { ...e.examinePerson("person:dora"), target: r("event:argument") }, "ACTION_UNAVAILABLE");
  });

  it("B05 examining a known person without evidence is accepted and empty", () => {
    const result = accepted(reduceSession(pkg, start, e.examinePerson("person:dora")));
    expect(result.output).toEqual({ type: "investigate", observations: [] });
    expect(result.state.events).toHaveLength(1);
    expect(result.state.knowledge).toEqual(start.knowledge);
  });

  it("B06 searching twice logs two events but only the first discovery and observation", () => {
    const second = accepted(reduceSession(pkg, explored, e.search("location:library")));
    expect(second.output).toEqual({ type: "investigate", observations: [] });
    expect(second.state.events).toHaveLength(2);
    expect(second.state.knowledge.discoveries).toEqual(explored.knowledge.discoveries);
    expect(second.state.knowledge.observations).toEqual(explored.knowledge.observations);
    expect(second.state.knowledge.discoveries.map((d) => d.firstDiscoveryEvent)).toEqual([0, 0]);
  });

  it("B09 the evidence source item without an access path finds nothing", () => {
    const result = accepted(reduceSession(pkg, explored, e.examineItem("item:knife")));
    expect(result.output).toEqual({ type: "investigate", observations: [] });
    expect(result.state.knowledge.discoveries).toEqual(explored.knowledge.discoveries);
  });

  it("B10 a mentioned item becomes known by that event and is examinable only in the next one", () => {
    rejected(start, e.examineItem("item:knife"), "ACTION_UNAVAILABLE");
    const knife = explored.knowledge.known.find((k) => k.ref === r("item:knife"));
    expect(knife?.firstSeen).toEqual({ kind: "event", eventIndex: 0 });
    expect(reduceSession(pkg, explored, e.examineItem("item:knife")).ok).toBe(true);
  });

  it("B12 evidence known only by name is not discovered until found", () => {
    expect(knownRefs(start)).toContain(r("evidence:muddy-boots"));
    expect(start.knowledge.discoveries).toEqual([]);
    const found = accepted(reduceSession(pkg, start, e.examinePerson("person:anna")));
    expect(found.output).toEqual({
      type: "investigate",
      observations: [(releaseEvidence(pkg.presentation, "evidence:muddy-boots", pkg.refs) as any).observation],
    });
    expect(found.state.knowledge.discoveries).toEqual([{ evidence: r("evidence:muddy-boots"), firstDiscoveryEvent: 0 }]);
    // Awareness keeps its initial origin.
    expect(found.state.knowledge.known.find((k) => k.ref === r("evidence:muddy-boots"))?.firstSeen).toEqual({ kind: "initial" });
  });
});

describe("interrogate", () => {
  const dora = pkg.npcs.find((n) => n.snapshot.npcId === "person:dora")!;
  const direct = (state: SessionState, questionId: string) =>
    interrogate({
      truth: pkg.truth,
      solution: pkg.solution,
      snapshot: dora.snapshot,
      catalogue: pkg.catalogue,
      profile: dora.profile,
      refs: pkg.refs,
      known: canonicalKnown(state) as any,
      questionId,
    });
  const ask = (state: SessionState, slug: string, npc = "person:dora") => accepted(reduceSession(pkg, state, e.ask(npc, slug)));

  it("B13 an available question returns the exact 5B output plus receipt provenance", () => {
    const result = ask(explored, "where-was-ben");
    expect(result.output).toEqual({ type: "interrogate", observation: (direct(explored, "question:where-was-ben") as any).observation });
    expect(result.state.knowledge.observations.at(-1)).toEqual({
      source: { kind: "npc", eventIndex: 1, npc: r("person:dora"), questionId: "question:where-was-ben" },
      observation: (result.output as any).observation,
    });
  });

  it("B14 a question about a person the player does not know is unavailable", () => {
    rejected(start, e.ask("person:dora", "where-was-ben"), "ACTION_UNAVAILABLE");
    expect(ask(explored, "where-was-ben").state.events).toHaveLength(2);
    // An unknown NPC, existing or not, is the same error.
    rejected(start, e.ask("person:clara", "where-was-ben"), "ACTION_UNAVAILABLE");
  });

  it("B15 an unknown questionId gets the same public error", () => {
    rejected(explored, e.ask("person:dora", "who-did-it"), "ACTION_UNAVAILABLE");
    rejected(explored, e.ask("person:anna", "where-was-ben"), "ACTION_UNAVAILABLE");
    rejected(explored, { ...e.ask("person:dora", "where-was-ben"), questionId: 3 }, "ACTION_UNAVAILABLE");
  });

  it("B16 a known person without an NPC profile is unavailable", () => {
    expect(knownRefs(explored)).toContain(r("person:ben"));
    rejected(explored, e.ask("person:ben", "where-was-ben"), "ACTION_UNAVAILABLE");
  });

  it("B17 a decline is an accepted event without an invented statement", () => {
    const result = ask(explored, "bloody-knife");
    expect(result.output).toEqual({
      type: "interrogate",
      observation: { schemaVersion: 1, npc: r("person:dora"), questionId: "question:bloody-knife", act: "decline" },
    });
    expect(result.state.knowledge.known).toEqual(explored.knowledge.known);
  });

  it("B18 does_not_know is accepted without invented mentions", () => {
    const result = ask(explored, "ben-planned");
    expect(result.output).toEqual({
      type: "interrogate",
      observation: { schemaVersion: 1, npc: r("person:dora"), questionId: "question:ben-planned", act: "answer", stance: "does_not_know" },
    });
    expect(result.state.knowledge.known).toEqual(explored.knowledge.known);
  });

  it("B19 a false belief stays a report, never an objective fact", () => {
    const result = ask(explored, "anna-in-killing");
    const observation = (result.output as any).observation;
    expect(observation.stance).toBe("affirms");
    expect(observation.statement).toEqual({ kind: "eventHasParticipant", event: r("event:ben-kills-clara"), person: r("person:anna") });
    expect(result.state.knowledge.discoveries).toEqual(explored.knowledge.discoveries);
    // The false report does not decide the case: Anna is still not proven responsible.
    const accused = accepted(reduceSession(pkg, result.state, e.accuse([CLAIMS.annaResponsible, true])));
    expect(accused.output).toEqual({ type: "accuse", verdict: "not_solved" });
  });

  it("B20 uncertain keeps its exact stance", () => {
    expect((ask(explored, "argument-caused-killing").output as any).observation.stance).toBe("uncertain");
    expect((ask(explored, "ben-in-killing").output as any).observation.stance).toBe("leans_affirms");
  });

  it("B21 a repeated question gives the same payload and two records", () => {
    const first = ask(explored, "where-was-ben");
    const second = ask(first.state, "where-was-ben");
    expect(second.output).toEqual(first.output);
    const records = second.state.knowledge.observations.filter((o) => o.source.kind === "npc");
    expect(records.map((o) => o.source.eventIndex)).toEqual([1, 2]);
    expect(records[0]!.observation).toEqual(records[1]!.observation);
  });

  it("B22 contradicting NPC reports coexist", () => {
    const doubt = sessionPackage({ pkg: (p) => (p.npcs[1].snapshot.attitudes[0].stance = { kind: "belief", value: false }) });
    const d = events(doubt);
    const state = play(doubt, [d.search("location:library"), d.ask("person:dora", "ben-in-library"), d.ask("person:anna", "ben-in-library")]);
    const reports = state.knowledge.observations.filter((o) => o.source.kind === "npc").map((o) => o.observation as any);
    expect(reports.map((o) => o.stance)).toEqual(["affirms", "denies"]);
    expect(reports[0].statement).toEqual(reports[1].statement);
  });

  it("B23 the NPC's wider knowledge leaks only through explicit reveal mentions", () => {
    const sparse = sessionPackage({ pkg: (p) => (p.initial.known = [{ kind: "person", id: "person:dora" }, { kind: "person", id: "person:ben" }]) });
    const s = events(sparse);
    const state = play(sparse, [s.ask("person:dora", "where-was-ben")]);
    const known = state.knowledge.known.map((k) => sparse.refs.resolve(k.ref)!.id).sort();
    expect(known).toEqual(["location:library", "person:ben", "person:dora"]);
    expect(state.knowledge.known.find((k) => k.ref === refOf(sparse, "location:library"))?.firstSeen).toEqual({ kind: "event", eventIndex: 0 });
  });

  it("B24 the player knowing more leaves the NPC snapshot unchanged", () => {
    const before = structuredClone(dora.snapshot);
    const garden = ask(explored, "anna-in-garden");
    expect((garden.output as any).observation.stance).toBe("does_not_know");
    expect(dora.snapshot).toEqual(before);
  });
});

describe("accuse", () => {
  const solved = play(pkg, [e.search("location:library"), e.accuse([CLAIMS.benResponsible, true])]);
  const verdictOf = (pkgUsed = pkg, state = explored, ...literals: [Record<string, string>, boolean][]) => {
    const result = accepted(reduceSession(pkgUsed, state, events(pkgUsed).accuse(...literals)));
    return (result.output as { verdict: string }).verdict;
  };

  it("B25 the correct complete answer solves and closes the session", () => {
    expect(solved.phase).toBe("solved");
    expect(solved.verdicts).toEqual([{ eventIndex: 1, verdict: "solved" }]);
  });

  it("B26 a wrong determined accusation is logged as not_solved and play goes on", () => {
    const result = accepted(reduceSession(pkg, explored, e.accuse([CLAIMS.benResponsible, false])));
    expect(result.output).toEqual({ type: "accuse", verdict: "not_solved" });
    expect(result.state.phase).toBe("active");
    expect(result.state.verdicts).toEqual([{ eventIndex: 1, verdict: "not_solved" }]);
    expect(reduceSession(pkg, result.state, e.search("location:library")).ok).toBe(true);
  });

  it("B27 an undetermined extra in scope is not_solved, never rewritten", () => {
    expect(verdictOf(pkg, explored, [CLAIMS.benResponsible, true], [CLAIMS.annaResponsible, false])).toBe("not_solved");
  });

  it("B28 a true extra outside the challenge scope is not_solved", () => {
    const narrow = sessionPackage({ pkg: (p) => (p.challenge.allowedClaims = [CLAIMS.benResponsible, CLAIMS.nobody]) });
    const state = play(narrow, [events(narrow).search("location:library")]);
    expect(verdictOf(narrow, state, [CLAIMS.benResponsible, true], [CLAIMS.argumentCaused, true])).toBe("not_solved");
    expect(verdictOf(narrow, state, [CLAIMS.benResponsible, true], [CLAIMS.nobody, false])).toBe("solved");
  });

  it("B29 a true extra inside scope solves when the required part is complete", () => {
    expect(verdictOf(pkg, explored, [CLAIMS.benResponsible, true], [CLAIMS.nobody, false])).toBe("solved");
  });

  it("B30 a missing negative required literal is not_solved", () => {
    const strict = sessionPackage({
      solution: (s) => s.requiredConclusions.push({ conclusionId: "conclusion:nobody-responsible", value: false }),
    });
    const state = play(strict, [events(strict).search("location:library")]);
    expect(verdictOf(strict, state, [CLAIMS.benResponsible, true])).toBe("not_solved");
    expect(verdictOf(strict, state, [CLAIMS.benResponsible, true], [CLAIMS.nobody, false])).toBe("solved");
  });

  it("B31 a repeated claim with the same or the opposite value is unavailable and not logged", () => {
    rejected(explored, e.accuse([CLAIMS.benResponsible, true], [CLAIMS.benResponsible, true]), "ACTION_UNAVAILABLE");
    rejected(explored, e.accuse([CLAIMS.benResponsible, true], [CLAIMS.benResponsible, false]), "ACTION_UNAVAILABLE");
  });

  it("B32 all six claim kinds translate field by field", () => {
    const six = [CLAIMS.benResponsible, CLAIMS.benActor, CLAIMS.nobody, CLAIMS.argumentCaused, CLAIMS.intended, CLAIMS.ordinary];
    expect(new Set(six.map((c) => c.kind)).size).toBe(6);
    const truths = [true, true, false, true, true, true];
    six.forEach((claim, i) => {
      const extra = claim === CLAIMS.benResponsible ? [] : [[claim, truths[i]!] as [Record<string, string>, boolean]];
      expect(verdictOf(pkg, explored, [CLAIMS.benResponsible, true], ...extra), claim.kind).toBe("solved");
      const wrong = claim === CLAIMS.benResponsible ? [[claim, false]] : [[CLAIMS.benResponsible, true], [claim, !truths[i]]];
      expect(verdictOf(pkg, explored, ...(wrong as [Record<string, string>, boolean][])), claim.kind).toBe("not_solved");
    });
    // A different role or value is a different claim (not silently mapped onto the true one).
    expect(verdictOf(pkg, explored, [CLAIMS.benResponsible, true], [{ ...CLAIMS.ordinary, value: "supernatural" }, true])).toBe("not_solved");
  });

  it("B33 eventCausedEvent with a wrong-kind or unknown causeEvent is unavailable", () => {
    const literal = (causeEvent: string) => ({
      type: "accuse",
      literals: [{ claim: { kind: "eventCausedEvent", causeEvent, event: r("event:ben-kills-clara") }, value: true }],
    });
    rejected(explored, literal(r("person:ben")), "ACTION_UNAVAILABLE");
    rejected(explored, literal(r("event:walk")), "ACTION_UNAVAILABLE");
    rejected(explored, literal(r("event:ben-kills-clara")), "ACTION_UNAVAILABLE");
    expect(reduceSession(pkg, explored, literal(r("event:argument"))).ok).toBe(true);
  });

  it("accusing an entity the prefix does not know is unavailable", () => {
    rejected(start, e.accuse([CLAIMS.benResponsible, true]), "ACTION_UNAVAILABLE");
  });

  it("an empty accusation is a valid event with the real challenge verdict", () => {
    expect(verdictOf(pkg, explored)).toBe("not_solved");
  });
});

describe("log and terminal state", () => {
  it("B34 an event without new information is still logged", () => {
    const state = play(pkg, [e.examinePerson("person:dora"), e.examinePerson("person:dora")]);
    expect(state.events).toEqual([e.examinePerson("person:dora"), e.examinePerson("person:dora")]);
  });

  it("B35 after solved every input, malformed or not, is SESSION_CLOSED", () => {
    const solved = play(pkg, [e.search("location:library"), e.accuse([CLAIMS.benResponsible, true])]);
    for (const input of [e.search("location:library"), e.accuse([CLAIMS.benResponsible, true]), { type: "nonsense" }, null]) {
      rejected(solved, input, "SESSION_CLOSED");
    }
  });

  it("B36 a foreign package identity in the state is HOST_FAILURE, before the terminal check", () => {
    const solved = play(pkg, [e.search("location:library"), e.accuse([CLAIMS.benResponsible, true])]);
    for (const state of [start, solved]) {
      const foreign = { ...state, identity: { ...state.identity, packageHash: "0".repeat(64) } };
      rejected(foreign, e.search("location:library"), "HOST_FAILURE");
    }
    const other = sessionPackage({ pkg: (p) => (p.publicContent.title = "Ein anderer Fall") });
    const result = reduceSession(other, start, events(other).search("location:library"));
    expect(result).toEqual({ ok: false, state: start, code: "HOST_FAILURE" });
  });

  it("B37 33 literals or more than 16 KiB are unavailable and change nothing", () => {
    const literal = { claim: { kind: "noPersonResponsibleForEvent", event: r("event:ben-kills-clara") }, value: false };
    rejected(explored, { type: "accuse", literals: Array.from({ length: 33 }, () => literal) }, "ACTION_UNAVAILABLE");
    rejected(explored, { ...e.search("location:library"), padding: "x".repeat(SESSION_LIMITS.maxEventBytes) }, "ACTION_UNAVAILABLE");
    rejected(explored, { ...e.search("location:library"), target: "x".repeat(SESSION_LIMITS.maxEventBytes) }, "ACTION_UNAVAILABLE");
  });

  it("B38 the 513th valid event is LIMIT_REACHED", () => {
    const full = play(pkg, Array.from({ length: SESSION_LIMITS.maxEvents }, () => e.examinePerson("person:dora")));
    expect(full.events).toHaveLength(512);
    rejected(full, e.examinePerson("person:dora"), "LIMIT_REACHED");
    rejected(full, { type: "nonsense" }, "LIMIT_REACHED");
  });

  it("B40 mutating the raw event or the output afterwards leaves the state untouched", () => {
    const input: any = e.search("location:library");
    const result = accepted(reduceSession(pkg, start, input));
    const snapshot = structuredClone(result.state);
    input.target = r("location:garden");
    input.extra = true;
    expect(result.state).toEqual(snapshot);
    expect(Object.isFrozen(result.output) && Object.isFrozen((result.output as any).observations[0])).toBe(true);
    expect(() => ((result.output as any).observations[0].text = "x")).toThrow(TypeError);
    expect(() => (result.state.events as any[]).push(input)).toThrow(TypeError);
    expect(Object.isFrozen(result.state.events[0])).toBe(true);
  });
});

describe("replaySession", () => {
  const log = [
    e.search("location:library"),
    e.ask("person:dora", "where-was-ben"),
    e.ask("person:dora", "anna-in-killing"),
    e.accuse([CLAIMS.benResponsible, false]),
    e.ask("person:dora", "where-was-ben"),
    e.accuse([CLAIMS.benResponsible, true], [CLAIMS.nobody, false]),
  ];

  it("reproduces the incremental state exactly", () => {
    const replayed = replaySession(pkg, log);
    expect(replayed).toEqual({ ok: true, state: play(pkg, log) });
    expect(replaySession(pkg, [])).toEqual({ ok: true, state: start });
  });

  it("is deterministic across a fresh resolve of the same package", () => {
    const again = sessionPackage();
    expect(again.identity).toEqual(pkg.identity);
    expect(replaySession(again, log)).toEqual(replaySession(pkg, log));
  });

  it("stops at the first rejected event; nothing is swallowed or truncated", () => {
    expect(replaySession(pkg, [e.ask("person:dora", "where-was-ben"), log[0]])).toEqual({ ok: false, code: "INVALID_HISTORY", eventIndex: 0 });
    expect(replaySession(pkg, [...log, e.search("location:library")])).toEqual({ ok: false, code: "INVALID_HISTORY", eventIndex: 6 });
    expect(replaySession(pkg, [log[0], { type: "accuse" }])).toEqual({ ok: false, code: "INVALID_HISTORY", eventIndex: 1 });
  });

  it("rejects non-arrays and over-long logs before evaluating", () => {
    expect(replaySession(pkg, { 0: log[0], length: 1 })).toEqual({ ok: false, code: "INVALID_HISTORY", eventIndex: null });
    const tooLong = Array.from({ length: 513 }, () => e.examinePerson("person:dora"));
    expect(replaySession(pkg, tooLong)).toEqual({ ok: false, code: "LIMIT_REACHED", eventIndex: null });
  });
});
