import { describe, expect, it } from "vitest";
import { initialSession, reduceSession, replaySession, type SessionState } from "../src/domain/case-session.ts";
import { decodeSessionSave, encodeSessionSave } from "../src/domain/case-session-save.ts";
import { CLAIMS, events, sessionPackage } from "./case-session.fixture.ts";

// C39 / AC-7: 640 deterministic histories in ten categories over the real reducer, replay and save
// codec. Every prefix: incremental = replay = save/load; every rejection returns the same state.

const pkg = sessionPackage();
const e = events(pkg);
const SEED = 0x5e55c0de;
const QUESTIONS = [
  "ben-in-library", "anna-in-library", "anna-in-killing", "ben-in-killing", "knife-used", "ben-responsible",
  "ben-planned", "argument-caused-killing", "where-was-ben", "anna-in-garden", "bloody-knife", "no-such-question",
];
const CLAIM_LIST = Object.values(CLAIMS);

function lcg(seed: number) {
  let state = seed >>> 0;
  return (n: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state >>> 16) % n;
  };
}

type Gen = (rand: (n: number) => number) => unknown;
const pick = <T,>(rand: (n: number) => number, xs: readonly T[]) => xs[rand(xs.length)]!;
const investigate: Gen = (rand) =>
  pick(rand, [
    () => e.search("location:library"),
    () => e.search("location:garden"),
    () => e.examineItem("item:knife"),
    () => e.examinePerson("person:anna"),
    () => e.examinePerson("person:dora"),
  ])();
const interrogate: Gen = (rand) => e.ask(pick(rand, ["person:dora", "person:anna"]), pick(rand, QUESTIONS));
const accuse: Gen = (rand) => {
  const claims = [...CLAIM_LIST].sort(() => rand(3) - 1).slice(0, 1 + rand(3));
  return e.accuse(...claims.map((claim): [Record<string, string>, boolean] => [claim, rand(2) === 0]));
};
const solving: Gen = () => e.accuse([CLAIMS.benResponsible, true]);
const malformed: Gen = (rand) =>
  pick(rand, [null, 7, { type: "investigate" }, { type: "dance" }, { ...(e.search("location:library") as object), extra: 1 }, { type: "accuse", literals: "x" }]);
const unknownRef: Gen = (rand) => ({ type: "investigate", action: "search_location", target: `pr1_${"0123456789abcdef".slice(rand(4), rand(4) + 12)}zzzz` });

/** Ten categories, 64 histories each. */
const CATEGORIES: [string, (rand: (n: number) => number) => unknown[]][] = [
  ["investigation only", (r) => Array.from({ length: 2 + r(8) }, () => investigate(r))],
  ["interrogation only", (r) => Array.from({ length: 2 + r(8) }, () => interrogate(r))],
  ["mixed exploration", (r) => Array.from({ length: 3 + r(10) }, () => (r(2) ? investigate(r) : interrogate(r)))],
  ["explore then wrong accusations", (r) => [e.search("location:library"), ...Array.from({ length: 1 + r(5) }, () => (r(3) ? accuse(r) : interrogate(r)))]],
  ["solved terminal", (r) => [...Array.from({ length: r(5) }, () => investigate(r)), e.search("location:library"), solving(r)]],
  ["events after terminal", (r) => [e.search("location:library"), solving(r), ...Array.from({ length: 1 + r(4) }, () => (r(2) ? investigate(r) : accuse(r)))]],
  ["invalid order", (r) => [e.ask("person:dora", "bloody-knife"), e.examineItem("item:knife"), ...Array.from({ length: r(6) }, () => investigate(r)), accuse(r)]],
  ["unknown refs", (r) => Array.from({ length: 2 + r(6) }, () => (r(3) ? unknownRef(r) : investigate(r)))],
  ["malformed events", (r) => Array.from({ length: 2 + r(6) }, () => (r(2) ? malformed(r) : investigate(r)))],
  ["repeated events", (r) => {
    const once = [investigate(r), interrogate(r)];
    return Array.from({ length: 4 + r(8) }, () => pick(r, once));
  }],
];

function roundtrip(state: SessionState): unknown {
  const saved = encodeSessionSave(pkg, state);
  if (!saved.ok) return saved;
  return decodeSessionSave(pkg, saved.text);
}

describe("C39 generated histories", () => {
  it("640 histories: incremental = replay = save/load on every prefix; rejections change nothing", () => {
    const rand = lcg(SEED);
    const seen = { solved: 0, notSolved: 0, rejected: 0, terminal: 0, histories: 0 };
    for (const [category, generate] of CATEGORIES) {
      for (let n = 0; n < 64; n++) {
        const history = generate(rand);
        const context = () => `seed=${SEED.toString(16)} category="${category}" #${n} history=${JSON.stringify(history)}`;
        let state = initialSession(pkg);
        expect(roundtrip(state), context()).toEqual({ ok: true, state });
        for (const input of history) {
          const result = reduceSession(pkg, state, input);
          if (!result.ok) {
            seen.rejected++;
            if (result.code === "SESSION_CLOSED") seen.terminal++;
            expect(result.state, context()).toBe(state);
            continue;
          }
          state = result.state;
          if (result.output.type === "accuse") seen[result.output.verdict === "solved" ? "solved" : "notSolved"]++;
          expect(replaySession(pkg, state.events), context()).toEqual({ ok: true, state });
          expect(roundtrip(state), context()).toEqual({ ok: true, state });
        }
        seen.histories++;
      }
    }
    expect(seen.histories).toBe(640);
    expect(seen.solved).toBeGreaterThan(0);
    expect(seen.notSolved).toBeGreaterThan(0);
    expect(seen.rejected).toBeGreaterThan(0);
    expect(seen.terminal).toBeGreaterThan(0);
  });
});
