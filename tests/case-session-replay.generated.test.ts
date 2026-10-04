import { describe, expect, it } from "vitest";
import { initialSession, reduceSession, replaySession, type SessionState } from "../src/domain/case-session.ts";
import { decodeSessionSave, encodeSessionSave } from "../src/domain/case-session-save.ts";
import { serializeSessionJson } from "../src/domain/case-package.identity.ts";
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

/**
 * `actual` equals `{ ok: true, state }`, given `stateC = C(state)`. C is injective on plain session
 * JSON and stricter than toEqual (an undefined-valued key differs from an absent one), so one string
 * comparison replaces a deep walk; toEqual runs only on a mismatch, for its diff.
 */
function expectOkState(actual: unknown, state: SessionState, stateC: string, context: () => string) {
  if (serializeSessionJson(actual) !== `{"ok":true,"state":${stateC}}`) expect(actual, context()).toEqual({ ok: true, state });
}

/** A verified session state: incremental = replay = save/load. Edges cache the reduction per input. */
type Node = { readonly state: SessionState; readonly edges: Map<string, Edge> };
type Edge =
  | { readonly ok: false; readonly code: string }
  | { readonly ok: true; readonly next: Node; readonly verdict: "solved" | "notSolved" | null };

describe("C39 generated histories", () => {
  it("640 histories: incremental = replay = save/load on every prefix; rejections change nothing", () => {
    const rand = lcg(SEED);
    const seen = { solved: 0, notSolved: 0, rejected: 0, terminal: 0, histories: 0, prefixes: 0 };
    // reduceSession, replaySession, encodeSessionSave and decodeSessionSave are deterministic
    // functions of (pkg, state[, input]). The 640 histories share most of their prefixes (~600
    // distinct states among ~2300 prefixes), so they are walked through a trie of verified states
    // keyed by C: each distinct state is checked against replay and save/load once, each distinct
    // (state, input) is reduced once, and every prefix of every history still lands on a verified
    // state. Repeating an identical pure computation would verify nothing new.
    const nodes = new Map<string, Node>();
    const nodeOf = (state: SessionState, context: () => string): Node => {
      const stateC = serializeSessionJson(state);
      const known = nodes.get(stateC);
      if (known !== undefined) return known;
      expectOkState(replaySession(pkg, state.events), state, stateC, context);
      expectOkState(roundtrip(state), state, stateC, context);
      const node: Node = { state, edges: new Map() };
      nodes.set(stateC, node);
      return node;
    };
    const step = (node: Node, input: unknown, context: () => string): Edge => {
      const result = reduceSession(pkg, node.state, input);
      if (!result.ok) {
        if (result.state !== node.state) expect(result.state, context()).toBe(node.state);
        return { ok: false, code: result.code };
      }
      const verdict = result.output.type === "accuse" ? (result.output.verdict === "solved" ? "solved" : "notSolved") : null;
      return { ok: true, next: nodeOf(result.state, context), verdict };
    };
    for (const [category, generate] of CATEGORIES) {
      for (let n = 0; n < 64; n++) {
        const history = generate(rand);
        const context = () => `seed=${SEED.toString(16)} category="${category}" #${n} history=${JSON.stringify(history)}`;
        let node = nodeOf(initialSession(pkg), context);
        seen.prefixes++;
        for (const input of history) {
          const inputC = serializeSessionJson(input);
          let edge = node.edges.get(inputC);
          if (edge === undefined) node.edges.set(inputC, (edge = step(node, input, context)));
          if (!edge.ok) {
            seen.rejected++;
            if (edge.code === "SESSION_CLOSED") seen.terminal++;
            continue;
          }
          if (edge.verdict !== null) seen[edge.verdict]++;
          node = edge.next;
          seen.prefixes++;
        }
        seen.histories++;
      }
    }
    expect(seen.histories).toBe(640);
    expect(seen.prefixes).toBe(640 + 1647);
    expect(nodes.size).toBeGreaterThan(500);
    expect(seen.solved).toBeGreaterThan(0);
    expect(seen.notSolved).toBeGreaterThan(0);
    expect(seen.rejected).toBeGreaterThan(0);
    expect(seen.terminal).toBeGreaterThan(0);
  });
});
