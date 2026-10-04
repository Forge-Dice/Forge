import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { parseCaseTruth } from "../src/domain/case-truth.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import { parseEvidenceAccessMap, resolveInvestigation } from "../src/domain/evidence-access.ts";
import { fullCase, goldenCase } from "./case-truth.fixture.ts";
import {
  allActions,
  allKnownRefs,
  emptyEvidenceAccessFixture,
  evidenceAccessFixture,
} from "./evidence-access.fixture.ts";

const T = parseCaseTruth(fullCase());
const M = parseEvidenceAccessMap(evidenceAccessFixture(), T);
const K = allKnownRefs();
const garden = { kind: "search_location", locationId: "location:garden" };

function rejects(input: unknown): void {
  expect(() => parseEvidenceAccessMap(input, T)).toThrow(ZodError);
}

function expectDeepFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Every error result reachable through public inputs. */
function errorResults() {
  return [
    resolveInvestigation(M, [], garden),
    resolveInvestigation(M, K, { kind: "search_location", locationId: "location:cellar" }),
    resolveInvestigation(M, K, { kind: "examine_item", itemId: "location:garden" }),
    resolveInvestigation(M, null, garden),
  ];
}

describe("MYST-0003 parser hardening", () => {
  it("A-20 __proto__ at the root is rejected without pollution", () => {
    const input = JSON.parse(`{"__proto__":{"polluted":true},${JSON.stringify(evidenceAccessFixture()).slice(1)}`);
    rejects(input);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("A-21 constructor and prototype keys are rejected", () => {
    for (const key of ["constructor", "prototype"]) {
      const inPath = evidenceAccessFixture();
      (inPath.entries[2]!.access.paths![0] as Record<string, unknown>)[key] = {};
      rejects(inPath);
      const inEntry = evidenceAccessFixture();
      (inEntry.entries[0] as Record<string, unknown>)[key] = {};
      rejects(inEntry);
    }
  });

  it("A-24 parse never mutates or shares the input", () => {
    const input = evidenceAccessFixture();
    const before = structuredClone(input);
    const map = parseEvidenceAccessMap(input, T);
    expect(input).toEqual(before);
    input.entries[0]!.access.paths![0] = { kind: "search_location", locationId: "location:garden" };
    input.caseId = "case:other";
    expect(map).toEqual(parseEvidenceAccessMap(evidenceAccessFixture(), T));
  });

  it("A-25 parse result is deeply frozen", () => {
    expectDeepFrozen(M);
    expect(() => {
      (M as { caseId: string }).caseId = "case:other";
    }).toThrow(TypeError);
    expect(() => {
      (M.entries as unknown[]).push({});
    }).toThrow(TypeError);
  });
});

describe("MYST-0003 resolve hardening", () => {
  it("A-38 a foreign target gives the same constant as an unknown one", () => {
    const foreign = resolveInvestigation(M, K, { kind: "search_location", locationId: "location:cellar" });
    expect(foreign).toEqual({ success: false, code: "TARGET_NOT_KNOWN" });
    expect(Object.is(foreign, resolveInvestigation(M, [], garden))).toBe(true);
  });

  it("A-42 unknown action field", () => {
    expect(resolveInvestigation(M, K, { ...garden, depth: 2 })).toEqual({ success: false, code: "INVALID_ACTION" });
  });

  it("A-43 __proto__ in an action is rejected without pollution", () => {
    const action = JSON.parse('{"kind":"search_location","locationId":"location:garden","__proto__":{"x":1}}');
    expect(resolveInvestigation(M, K, action)).toEqual({ success: false, code: "INVALID_ACTION" });
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  it("A-44 non-object actions", () => {
    for (const action of [null, undefined, "location:garden", [], 42, true]) {
      expect(resolveInvestigation(M, K, action)).toEqual({ success: false, code: "INVALID_ACTION" });
    }
  });

  it("A-45 invalid known refs", () => {
    const invalid: unknown[] = [
      "location:garden",
      { kind: "location", id: "location:garden" },
      [null],
      [{ kind: "location", id: "location:garden", name: "Garten" }],
      [{ kind: "proposition", id: "proposition:anna-in-garden" }],
      [{ kind: "conclusion", id: "conclusion:x" }],
      [{ kind: "item", id: "location:garden" }],
    ];
    for (const known of invalid) {
      expect(resolveInvestigation(M, known, garden)).toEqual({ success: false, code: "INVALID_KNOWN_REFS" });
    }
  });

  it("A-50 resolve never mutates its inputs and accepts frozen ones", () => {
    const known = allKnownRefs();
    const action = { ...garden };
    const before = structuredClone([known, action]);
    const result = resolveInvestigation(M, known, action);
    expect([known, action]).toEqual(before);
    expect(resolveInvestigation(M, deepFreeze(allKnownRefs()), deepFreeze({ ...garden }))).toEqual(result);
  });

  it("A-51 results are deeply frozen and never share map arrays", () => {
    for (const action of allActions()) {
      const result = resolveInvestigation(M, K, action);
      expectDeepFrozen(result);
      if (result.success) for (const entry of M.entries) expect(result.found).not.toBe(entry.access);
    }
    for (const result of errorResults()) expectDeepFrozen(result);
  });

  it("A-52 a getter that throws on the second read is read once", () => {
    let reads = 0;
    const action = {
      kind: "search_location",
      get locationId() {
        reads += 1;
        if (reads > 1) throw new Error("second read");
        return "location:garden";
      },
    };
    expect(resolveInvestigation(M, K, action)).toEqual(resolveInvestigation(M, K, garden));
  });

  it("A-53 inherited fields behave like own fields (recorded zod behavior)", () => {
    const action = Object.create({ kind: "search_location", locationId: "location:garden" });
    expect(resolveInvestigation(M, K, action)).toEqual(resolveInvestigation(M, K, garden));
  });

  it("A-54 errors carry no echo", () => {
    const codes = ["TARGET_NOT_KNOWN", "TARGET_NOT_KNOWN", "INVALID_ACTION", "INVALID_KNOWN_REFS"];
    errorResults().forEach((result, i) => {
      expect(JSON.stringify(result)).toBe(`{"success":false,"code":"${codes[i]}"}`);
    });
  });

  it("A-55 successes carry evidence IDs only", () => {
    for (const action of allActions()) {
      const result = resolveInvestigation(M, K, action);
      expect(Object.keys(result)).toEqual(["success", "found"]);
      const json = JSON.stringify(result).replace('"success":true', "");
      for (const leak of ["description", "Anna", "Garten", "proposition:", "location:", "item:", "person:", "event:"]) {
        expect(json).not.toContain(leak);
      }
      expect(json).not.toMatch(/true|false/);
    }
  });

  it("A-56 truth values do not change what is found", () => {
    const inverted = fullCase();
    for (const proposition of inverted.propositions) proposition.truth = !proposition.truth;
    const truth = parseCaseTruth(inverted);
    const map = parseEvidenceAccessMap({ ...evidenceAccessFixture(), truthHash: hashCaseTruth(truth) }, truth);
    for (const action of allActions()) {
      expect(resolveInvestigation(map, K, action)).toEqual(resolveInvestigation(M, K, action));
    }
  });

  it("A-59 error results are one frozen constant per code", () => {
    const [unknown, foreign, invalid] = errorResults();
    expect(Object.is(unknown, foreign)).toBe(true);
    expect(Object.is(invalid, resolveInvestigation(M, K, { kind: "search" }))).toBe(true);
    expect(Object.is(resolveInvestigation(M, 1, garden), resolveInvestigation(M, [null], garden))).toBe(true);
    for (const result of errorResults()) expect(Object.isFrozen(result)).toBe(true);
  });

  it("A-60 telling evidence IDs only appear in found", () => {
    const telling = fullCase();
    telling.evidence[0]!.id = "evidence:ben-is-the-murderer";
    telling.redHerrings[0]!.evidenceIds = ["evidence:ben-is-the-murderer"];
    const truth = parseCaseTruth(telling);
    const input = evidenceAccessFixture();
    input.entries[0]!.evidenceId = "evidence:ben-is-the-murderer";
    const map = parseEvidenceAccessMap({ ...input, truthHash: hashCaseTruth(truth) }, truth);
    expect(resolveInvestigation(map, K, { kind: "examine_item", itemId: "item:letter-opener" })).toEqual({
      success: true,
      found: ["evidence:ben-is-the-murderer"],
    });
    for (const result of [resolveInvestigation(map, [], garden), resolveInvestigation(map, K, { kind: "x" })]) {
      expect(JSON.stringify(result)).not.toContain("murderer");
    }
  });

  it("A-61 unicode look-alikes and escapes are rejected", () => {
    const variants = [
      "location:gärten",
      "location:gаrden",
      "location:ｇarden",
      "location:garden\n",
      "location:garden\u0000",
      " location:garden",
    ];
    for (const locationId of variants) {
      expect(resolveInvestigation(M, K, { kind: "search_location", locationId })).toEqual({
        success: false,
        code: "INVALID_ACTION",
      });
      const input = evidenceAccessFixture();
      input.entries[2]!.access.paths![0] = { kind: "search_location", locationId };
      rejects(input);
    }
  });

  it("A-76 a map for another case yields nothing (binding is the caller's job)", () => {
    const other = parseEvidenceAccessMap(emptyEvidenceAccessFixture(), parseCaseTruth(goldenCase()));
    for (const action of allActions()) expect(resolveInvestigation(other, K, action)).toEqual({ success: true, found: [] });
  });
});

describe("MYST-0003 source boundaries", () => {
  const sources = ["src/domain/evidence-access.ts", "src/domain/evidence-access.identity.ts"].map((path) => ({
    path,
    text: readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
  }));

  it("A-58 the module never imports NPC knowledge", () => {
    for (const { text } of sources) expect(text).not.toContain("npc-knowledge");
  });

  it("A-77 production source stays within its boundaries", () => {
    const forbidden = ["Math.random", "Date", "localeCompare", "WeakMap", "WeakSet", "WeakRef", "npc-knowledge", "case-solution", "case-semantics", "description", "links", "src/forge", "../forge"];
    for (const { path, text } of sources) {
      for (const word of forbidden) expect(text.includes(word), `${path} contains ${word}`).toBe(false);
    }
  });

  it("imports only zod, node:crypto and the case truth modules", () => {
    for (const { text } of sources) {
      const imports = [...text.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
      for (const source of imports) {
        expect(["zod", "node:crypto", "./case-truth.ts", "./case-truth.identity.ts", "./evidence-access.ts"]).toContain(source);
      }
    }
    expect(sources[1]!.text).toContain('import type { EvidenceAccessMap } from "./evidence-access.ts"');
  });

  it("every mutation anchor occurs exactly once (§12)", () => {
    const anchors: [number, string][] = [
      [0, "if (map.truthHash !== truthHash)"],
      [0, "if (!evidenceIds.has(entry.evidenceId))"],
      [0, "if (!covered.has(evidence.id))"],
      [0, "if (seenPaths.has(key))"],
      [0, "if (!knownKeys.has(targetKey(target))) return TARGET_NOT_KNOWN;"],
      [0, "if (!targets[target.kind].has(target.id))"],
      [0, "found.sort(byCodeUnits)"],
      [1, "value.map(canonicalize).sort(byCodeUnits)"],
      [1, "`${EVIDENCE_ACCESS_CANONICALIZATION_PROFILE}\\n${serializeEvidenceAccessMap(map)}`"],
    ];
    for (const [file, anchor] of anchors) expect(sources[file]!.text.split(anchor)).toHaveLength(2);
  });

  it("production stays within the line budget (§2)", () => {
    const lines = sources.map(({ text }) => text.split("\n").length - (text.endsWith("\n") ? 1 : 0));
    expect(lines[0]).toBeLessThanOrEqual(210);
    expect(lines[1]).toBeLessThanOrEqual(50);
    expect(lines[0]! + lines[1]!).toBeLessThanOrEqual(260);
  });
});
