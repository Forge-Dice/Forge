import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCaseTruth, type CaseTruth } from "../src/domain/case-truth.ts";
import {
  PLAYER_REF_PATTERN,
  PlayerTextSchema,
  parseEvidencePresentation,
  releaseEvidence,
  type EvidencePresentation,
  type PlayerRefTranslator,
  type RefKind,
} from "../src/domain/evidence-presentation.ts";
import { fullCase } from "./case-truth.fixture.ts";
import {
  SPOILER_FORBIDDEN,
  fakeRef,
  fakeTranslator,
  presentationFixture,
  spoilerCase,
  spoilerPresentation,
} from "./evidence-presentation.fixture.ts";

const truth = parseCaseTruth(fullCase());
const presentation = parseEvidencePresentation(presentationFixture(), truth);
const IDS = presentation.entries.map((e) => e.evidenceId as string);
const source = (file: string) => readFileSync(new URL(`../src/domain/${file}`, import.meta.url), "utf8");
const PRODUCTION = ["evidence-presentation.ts", "evidence-presentation.identity.ts"];

function spy(base: PlayerRefTranslator = fakeTranslator(truth)) {
  const calls: [RefKind, string][] = [];
  const translator: PlayerRefTranslator = {
    caseId: base.caseId,
    truthHash: base.truthHash,
    refFor: (kind, id) => {
      calls.push([kind, id]);
      return base.refFor(kind, id);
    },
  };
  return { translator, calls };
}

const releaseAll = (p: EvidencePresentation, t: CaseTruth) =>
  p.entries.map((e) => releaseEvidence(p, e.evidenceId, fakeTranslator(t)));

describe("AC-11: spoiler scan", () => {
  const spoiler = spoilerCase();
  const p = parseEvidencePresentation(spoilerPresentation(spoiler), spoiler);
  const results = releaseAll(p, spoiler);
  const json = JSON.stringify(results);

  it("every release succeeds", () => {
    expect(results.every((r) => r.success)).toBe(true);
  });

  it.each(SPOILER_FORBIDDEN)("A-01/A-02/A-13/A-15: observations never contain %s", (needle) => {
    expect(json).not.toContain(needle);
  });

  it("A-01/A-02: evidence and mentions are PlayerRefs", () => {
    for (const result of results) {
      if (!result.success) throw new Error(result.code);
      expect(result.observation.evidence).toMatch(PLAYER_REF_PATTERN);
      for (const mention of result.observation.mentions) {
        expect(Object.keys(mention)).toEqual(["kind", "ref"]);
        expect(mention.ref).toMatch(PLAYER_REF_PATTERN);
      }
    }
  });

  it("A-08: no boolean anywhere in an observation", () => {
    const booleans = (value: unknown): boolean =>
      typeof value === "boolean" || (typeof value === "object" && value !== null && Object.values(value).some(booleans));
    for (const result of [...results, ...releaseAll(presentation, truth)]) {
      if (!result.success) throw new Error(result.code);
      expect(booleans(result.observation)).toBe(false);
    }
  });
});

describe("A-05/A-06/A-07/AC-09: port calls", () => {
  it("refFor is called once for the evidence and once per mention, for nothing else", () => {
    for (const entry of presentation.entries) {
      const { translator, calls } = spy();
      expect(releaseEvidence(presentation, entry.evidenceId, translator).success).toBe(true);
      const expected = [["evidence", entry.evidenceId], ...entry.mentions.map((m) => [m.kind, m.id])];
      expect(calls).toEqual(expected);
      expect(calls.some(([kind]) => (kind as string) === "proposition")).toBe(false);
    }
  });

  it("A-05: the hidden source of gloves-dirty (event:walk) is never translated", () => {
    const { translator, calls } = spy();
    const result = releaseEvidence(presentation, "evidence:gloves-dirty", translator);
    expect(calls.some(([, id]) => id === "event:walk")).toBe(false);
    expect(JSON.stringify(result)).not.toContain(fakeRef("event", "event:walk"));
  });

  it("A-07: no links or proposition IDs in any release", () => {
    const json = JSON.stringify(releaseAll(presentation, truth));
    for (const needle of ["links", "propositionId", "proposition:", "supports", "refutes"]) expect(json).not.toContain(needle);
  });
});

describe("A-09/A-10/A-11: hidden truth data does not change releases", () => {
  const baseline = releaseAll(presentation, truth);
  const rebound = (input: any) => {
    const t = parseCaseTruth(input);
    const p = parseEvidencePresentation({ ...presentationFixture(), truthHash: fakeTranslator(t).truthHash }, t);
    return releaseAll(p, t);
  };

  it("A-09: without secret:debt", () => {
    expect(rebound({ ...fullCase(), secrets: [] })).toEqual(baseline);
  });

  it("A-10: without red-herring:fingerprint", () => {
    expect(rebound({ ...fullCase(), redHerrings: [] })).toEqual(baseline);
  });

  it("A-11: every proposition truth inverted", () => {
    const input = fullCase();
    input.propositions = input.propositions.map((p) => ({ ...p, truth: !p.truth }));
    expect(rebound(input)).toEqual(baseline);
  });
});

describe("A-33..A-42/A-48: port and error boundary", () => {
  const base = fakeTranslator(truth);
  const withRef = (refFor: (kind: RefKind, id: string) => unknown): PlayerRefTranslator => ({ ...base, refFor: refFor as never });
  const valid = fakeRef("person", "person:anna");

  it("A-33: stale truthHash", () => {
    expect(releaseEvidence(presentation, IDS[0], { ...base, truthHash: "0".repeat(64) })).toEqual({ success: false, code: "BINDING_MISMATCH" });
  });

  it("A-34: other case", () => {
    expect(releaseEvidence(presentation, IDS[0], { ...base, caseId: "case:golden" })).toEqual({ success: false, code: "BINDING_MISMATCH" });
  });

  it.each<[string, (kind: RefKind, id: string) => unknown]>([
    ["A-35 null for one mention", (kind, id) => (id === "person:anna" ? null : fakeRef(kind, id))],
    ["A-36 canonical ID", (_kind, id) => id],
    ["A-37 slug", () => "ben"],
    ["A-38 constant ref", () => valid],
    ["A-38 mention collides with evidence", (kind, id) => (kind === "item" ? fakeRef("evidence", "evidence:fingerprint") : fakeRef(kind, id))],
    ["A-39 upper case", (kind, id) => fakeRef(kind, id).toUpperCase()],
    ["A-39 leading space", (kind, id) => ` ${fakeRef(kind, id)}`],
    ["A-39 trailing space", (kind, id) => `${fakeRef(kind, id)} `],
    ["A-39 15 characters", (kind, id) => fakeRef(kind, id).slice(0, 19)],
    ["A-39 17 characters", (kind, id) => `${fakeRef(kind, id)}0`],
    ["A-39 contains i", () => "pr1_000000000000000i"],
    ["A-39 contains l", () => "pr1_000000000000000l"],
    ["A-39 contains o", () => "pr1_000000000000000o"],
    ["A-39 contains u", () => "pr1_000000000000000u"],
    ["A-40 number", () => 42],
    ["A-40 object", (kind, id) => ({ ref: fakeRef(kind, id) })],
    ["A-40 undefined", () => undefined],
  ])("%s gives REF_UNAVAILABLE without partial result", (_name, refFor) => {
    const result = releaseEvidence(presentation, "evidence:fingerprint", withRef(refFor));
    expect(result).toEqual({ success: false, code: "REF_UNAVAILABLE" });
  });

  it("A-42: no failure echoes anything", () => {
    const failures = [
      releaseEvidence(presentation, IDS[0], { ...base, caseId: "case:golden" }),
      releaseEvidence(presentation, "evidence:killer-fingerprint", base),
      releaseEvidence(presentation, IDS[0], withRef((_k, id) => id)),
    ];
    for (const failure of failures) {
      expect(Object.keys(failure).sort()).toEqual(["code", "success"]);
      expect(Object.isFrozen(failure)).toBe(true);
      expect(JSON.stringify(failure)).not.toMatch(/evidence:|person:|item:|pr1_/);
    }
  });

  it("A-48: a port holding on to the result cannot change it", () => {
    let held: any;
    const result: any = releaseEvidence(presentation, "evidence:anna-statement", base);
    held = result.observation;
    expect(() => (held.text = "manipuliert")).toThrow(TypeError);
    expect(() => held.mentions.push({ kind: "person", ref: valid })).toThrow(TypeError);
    expect(() => (held.reports[0].claim.person = valid)).toThrow(TypeError);
    expect(releaseEvidence(presentation, "evidence:anna-statement", base)).toEqual(result);
  });
});

describe("text guard", () => {
  const messages = (text: string) => PlayerTextSchema.safeParse(text).error?.issues.map((i) => i.message) ?? [];

  it("A-59: injected canonical ID", () => {
    expect(messages("Täter: person:killer")).toContain("Text must not contain a canonical ID");
  });

  it.each(["evidence:x", "red-herring:x", "conclusion:x", "case:x", "secret:x", "proposition:x", "relationship:x", "motive:x"])(
    "A-60: %s",
    (text) => {
      expect(messages(`Siehe ${text}`)).toContain("Text must not contain a canonical ID");
    },
  );

  it("A-63: PlayerRef in text", () => {
    expect(messages("siehe pr1_53trdamn1z833nc7")).toContain("Text must not contain a PlayerRef");
  });

  it("A-76: the canonical-ID prefixes are exactly the ID prefixes of case-truth.ts plus conclusion", () => {
    const truthPrefixes = [...source("case-truth.ts").matchAll(/idSchema<"\w+">\("([a-z-]+)"\)/g)].map((m) => m[1]!);
    expect(truthPrefixes.length).toBeGreaterThanOrEqual(11);
    expect(source("case-solution.ts")).toContain("^conclusion:");
    const guard = source("evidence-presentation.ts").match(/CANONICAL_ID_IN_TEXT =\s*\/\(\?:([a-z|-]+)\):/)!;
    expect(guard[1]!.split("|").sort()).toEqual([...truthPrefixes, "conclusion"].sort());
  });
});

describe("AC-12/AC-13: source rules", () => {
  it.each(PRODUCTION)("A-12 / §6: %s avoids forbidden reads, imports and nondeterminism", (file) => {
    const text = source(file);
    for (const token of [
      "description",
      "links",
      "propositions",
      "secrets",
      "redHerrings",
      "case-solution",
      "npc-knowledge",
      "truth.evidence[",
      "Math.random",
      "Date",
      "localeCompare",
      "normalize(",
      "WeakMap",
      "WeakSet",
      "WeakRef",
      "src/forge",
      "../forge",
    ]) {
      expect(text, token).not.toContain(token);
    }
    const imports = [...text.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
    const allowed = file.endsWith(".identity.ts")
      ? ["node:crypto", "./evidence-presentation.ts"]
      : ["zod", "./case-truth.ts", "./case-truth.identity.ts"];
    for (const from of imports) expect(allowed, from).toContain(from);
  });

  it("the identity file imports only types from the presentation module", () => {
    expect(source("evidence-presentation.identity.ts")).toMatch(/^import type \{ EvidencePresentation \} from "\.\/evidence-presentation\.ts";$/m);
  });

  it("forbidden characters are written only as escapes", () => {
    for (const file of PRODUCTION) expect(/^[\x0a\x20-\x7e]*$/.test(source(file)), file).toBe(true);
  });

  it("AC-13: line limits", () => {
    const lines = (file: string) => source(file).replace(/\n$/, "").split("\n").length;
    expect(lines("evidence-presentation.ts")).toBeLessThanOrEqual(255);
    expect(lines("evidence-presentation.identity.ts")).toBeLessThanOrEqual(40);
    expect(lines("evidence-presentation.ts") + lines("evidence-presentation.identity.ts")).toBeLessThanOrEqual(290);
  });

  it("AC-16 support: each mutation anchor occurs exactly once", () => {
    const anchors: [string, string][] = [
      ["evidence-presentation.ts", "if (CANONICAL_ID_IN_TEXT.test(text))"],
      ["evidence-presentation.ts", "if (FORBIDDEN_CHARACTERS.test(text))"],
      ["evidence-presentation.ts", "translator.truthHash !== presentation.truthHash"],
      ["evidence-presentation.ts", "!PLAYER_REF_PATTERN.test(ref)"],
      ["evidence-presentation.ts", "|| used.has(ref)"],
      ["evidence-presentation.ts", "if (!mentioned.has(mentionKey(kind, id)))"],
      ["evidence-presentation.ts", "if (!seen.has(id))"],
      ["evidence-presentation.ts", ".sort((a, b) => byCodeUnits(a.ref, b.ref))"],
      ["evidence-presentation.identity.ts", '.sort(byCodeUnits).join(",")'],
    ];
    for (const [file, anchor] of anchors) expect(source(file).split(anchor).length - 1, anchor).toBe(1);
  });
});
