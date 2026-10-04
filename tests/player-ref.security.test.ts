import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCaseTruth } from "../src/domain/case-truth.ts";
import { PLAYER_REF_KINDS, buildPlayerRefIndex, resolvePlayerRef, type PlayerRefIndex } from "../src/domain/player-ref.ts";
import { fullCase, goldenCase } from "./case-truth.fixture.ts";

const SALT_A = "000102030405060708090a0b0c0d0e0f";
const SALT_B = "ffeeddccbbaa99887766554433221100";

function indexOf(input: object, salt = SALT_A): PlayerRefIndex {
  const result = buildPlayerRefIndex(parseCaseTruth(input), salt);
  if (!result.success) throw new Error(result.code);
  return result.index;
}

const index = indexOf(fullCase());
const known = index.entries.find((e) => e.kind === "person")!.ref;
const body = known.slice(4);

describe("AC-12/13: every unresolved input looks the same", () => {
  const inputs: [string, unknown, (typeof PLAYER_REF_KINDS)[number]?][] = [
    ["undefined", undefined],
    ["null", null],
    ["number", 42],
    ["object", { ref: known }],
    ["empty string", ""],
    ["upper case", known.toUpperCase()],
    ["leading space", ` ${known}`],
    ["trailing space", `${known} `],
    ["contains i", `pr1_${body.slice(0, 15)}i`],
    ["contains l", `pr1_${body.slice(0, 15)}l`],
    ["contains o", `pr1_${body.slice(0, 15)}o`],
    ["contains u", `pr1_${body.slice(0, 15)}u`],
    ["15 characters", `pr1_${body.slice(0, 15)}`],
    ["17 characters", `pr1_${body}0`],
    ["valid form, unknown", "pr1_0000000000000000"],
    ["same case under SALT_B", indexOf(fullCase(), SALT_B).entries[0]!.ref],
    ["other truth", indexOf(goldenCase()).entries[0]!.ref],
    ["known ref, wrong expectedKind", known, "item"],
    ["canonical ID", "person:anna"],
  ];

  it.each(inputs)("%s", (_name, input, expectedKind) => {
    const result = resolvePlayerRef(index, input, expectedKind);
    expect(result).toEqual({ success: false, code: "REF_UNRESOLVED" });
    expect(Object.keys(result).sort()).toEqual(["code", "success"]);
    expect(Object.isFrozen(result)).toBe(true);

    const json = JSON.stringify(result);
    for (const kind of PLAYER_REF_KINDS) expect(json).not.toContain(kind);
    expect(json).not.toMatch(/[a-z-]+:[a-z0-9]/);
    expect(json).not.toContain(SALT_A);
    if (typeof input === "string" && input !== "") expect(json).not.toContain(input);
  });

  it("all failures are the same object", () => {
    const failures = inputs.map(([, input, kind]) => resolvePlayerRef(index, input, kind));
    for (const failure of failures) expect(failure).toBe(failures[0]);
  });
});

describe("AC-05/16: leak checks on the index", () => {
  it("contains no non-entity IDs and no salt", () => {
    const input = fullCase();
    const json = JSON.stringify(index);
    const hidden = [
      input.caseId,
      ...input.propositions.map((p) => p.id),
      ...input.secrets.map((s) => s.id),
      ...input.redHerrings.map((r) => r.id),
      ...input.motives.map((m) => m.id),
      ...input.relationships.map((r) => r.id),
    ];
    expect(hidden.length).toBeGreaterThan(1);
    for (const id of hidden.slice(1)) expect(json).not.toContain(`"${id}"`);
    expect(index.entries.some((e) => e.id === input.caseId)).toBe(false);
    expect(json).not.toContain(SALT_A);
  });
});

describe("AC-18: no hidden state or nondeterminism", () => {
  it("source contains none of the forbidden tokens", () => {
    const source = readFileSync(new URL("../src/domain/player-ref.ts", import.meta.url), "utf8");
    for (const token of ["WeakMap", "WeakSet", "WeakRef", "Symbol(", "Math.random", "Date.now", "new Date", "localeCompare"]) {
      expect(source, token).not.toContain(token);
    }
  });
});
