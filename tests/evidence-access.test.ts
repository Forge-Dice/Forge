import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { parseCaseTruth, type CaseTruth } from "../src/domain/case-truth.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import {
  createEvidenceAccessMapSchema,
  INVESTIGATION_ACTION_KINDS,
  parseEvidenceAccessMap,
  resolveInvestigation,
} from "../src/domain/evidence-access.ts";
import { hashEvidenceAccessMap } from "../src/domain/evidence-access.identity.ts";
import { fullCase, goldenCase } from "./case-truth.fixture.ts";
import {
  allActions,
  allKnownRefs,
  emptyEvidenceAccessFixture,
  evidenceAccessFixture,
  H0,
} from "./evidence-access.fixture.ts";

type Path = (string | number)[];

const T = parseCaseTruth(fullCase());
const M = parseEvidenceAccessMap(evidenceAccessFixture(), T);
const K = allKnownRefs();

const garden = { kind: "search_location", locationId: "location:garden" };
const library = { kind: "search_location", locationId: "location:library" };
const opener = { kind: "examine_item", itemId: "item:letter-opener" };

function issuesOf(input: unknown, truth: CaseTruth = T): { path: Path; message: string }[] {
  try {
    parseEvidenceAccessMap(input, truth);
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
    return (error as ZodError).issues.map((issue) => ({ path: issue.path as Path, message: issue.message }));
  }
  throw new Error("expected parse to fail");
}

function pathsOf(input: unknown, truth: CaseTruth = T): Path[] {
  return issuesOf(input, truth).map((issue) => issue.path);
}

/** Map for a truth variant, bound to that variant's hash. */
function boundTo(truth: CaseTruth, input = evidenceAccessFixture()) {
  return parseEvidenceAccessMap({ ...input, truthHash: hashCaseTruth(truth) }, truth);
}

function found(result: ReturnType<typeof resolveInvestigation>): readonly string[] {
  if (!result.success) throw new Error(`expected success, got ${result.code}`);
  return result.found;
}

function code(result: ReturnType<typeof resolveInvestigation>): string {
  if (result.success) throw new Error("expected failure");
  return result.code;
}

describe("MYST-0003 fixture", () => {
  it("fixture truthHash is hashCaseTruth(fullCase())", () => {
    expect(evidenceAccessFixture().truthHash).toBe(hashCaseTruth(T));
    expect(emptyEvidenceAccessFixture().truthHash).toBe(hashCaseTruth(parseCaseTruth(goldenCase())));
  });

  it("exposes the closed V1 action vocabulary", () => {
    expect(INVESTIGATION_ACTION_KINDS).toEqual(["search_location", "examine_item", "examine_person"]);
  });
});

describe("MYST-0003 bound parser", () => {
  it("A-01 valid map parses, deep frozen, four entries", () => {
    expect(M.entries).toHaveLength(4);
    expect(Object.isFrozen(M)).toBe(true);
    expect(Object.isFrozen(M.entries[0]?.access)).toBe(true);
    expect(createEvidenceAccessMapSchema(T).safeParse(evidenceAccessFixture()).success).toBe(true);
  });

  it("A-02 wrong case: exactly one issue at caseId, binding first", () => {
    const input = evidenceAccessFixture();
    input.caseId = "case:other";
    input.entries.push({ evidenceId: "evidence:other", access: { kind: "inaccessible" } });
    expect(pathsOf(input)).toEqual([["caseId"]]);
  });

  it("A-03 changed truth (event text) breaks the binding", () => {
    const changed = fullCase();
    changed.events[0]!.description = "Streit über etwas anderes";
    expect(pathsOf(evidenceAccessFixture(), parseCaseTruth(changed))).toEqual([["truthHash"]]);
  });

  it("A-04 same revision, different truth breaks the binding", () => {
    const inverted = fullCase();
    const proposition = inverted.propositions.find((p) => p.id === "proposition:anna-in-garden")!;
    proposition.truth = !proposition.truth;
    expect(inverted.revision).toBe(3);
    expect(pathsOf(evidenceAccessFixture(), parseCaseTruth(inverted))).toEqual([["truthHash"]]);
  });

  it("A-05 malformed truthHash is a schema issue", () => {
    for (const truthHash of [evidenceAccessFixture().truthHash.toUpperCase(), evidenceAccessFixture().truthHash.slice(1)]) {
      expect(pathsOf({ ...evidenceAccessFixture(), truthHash })).toEqual([["truthHash"]]);
    }
  });

  it("A-06 foreign evidence", () => {
    const input = evidenceAccessFixture();
    input.entries.push({ evidenceId: "evidence:other", access: { kind: "inaccessible" } });
    expect(pathsOf(input)).toEqual([["entries", 4, "evidenceId"]]);
  });

  it("A-07 missing entry names the missing evidence", () => {
    const input = evidenceAccessFixture();
    input.entries = input.entries.filter((entry) => entry.evidenceId !== "evidence:gloves-dirty");
    const issues = issuesOf(input);
    expect(issues.map((issue) => issue.path)).toEqual([["entries"]]);
    expect(issues[0]?.message).toContain("evidence:gloves-dirty");
  });

  it("A-08 duplicate entry with equal content", () => {
    const input = evidenceAccessFixture();
    input.entries.push(evidenceAccessFixture().entries[0]!);
    expect(pathsOf(input)).toEqual([["entries", 4, "evidenceId"]]);
  });

  it("A-09 duplicate entry with contradicting content", () => {
    const input = evidenceAccessFixture();
    input.entries.push({ evidenceId: "evidence:muddy-path", access: { kind: "inaccessible" } });
    expect(pathsOf(input)).toEqual([["entries", 4, "evidenceId"]]);
  });

  it("A-10 path target not in the truth", () => {
    const input = evidenceAccessFixture();
    input.entries[2]!.access.paths!.push({ kind: "search_location", locationId: "location:cellar" });
    expect(pathsOf(input)).toEqual([["entries", 2, "access", "paths", 1, "locationId"]]);
  });

  it("A-11 wrong target kind in a path", () => {
    const input = evidenceAccessFixture();
    input.entries[2]!.access.paths![0] = { kind: "search_location", locationId: "item:gloves" };
    expect(pathsOf(input)).toEqual([["entries", 2, "access", "paths", 0, "locationId"]]);
  });

  it("A-12 wrong field for the action kind", () => {
    const input = evidenceAccessFixture();
    (input.entries[2]!.access.paths as unknown[])[0] = { kind: "search_location", itemId: "item:gloves" };
    const paths = pathsOf(input);
    expect(paths).toContainEqual(["entries", 2, "access", "paths", 0, "locationId"]);
    expect(paths).toContainEqual(["entries", 2, "access", "paths", 0]);
  });

  it("A-13 duplicate path with swapped key order", () => {
    const input = evidenceAccessFixture();
    (input.entries[2]!.access.paths as unknown[]).push({ locationId: "location:garden", kind: "search_location" });
    expect(pathsOf(input)).toEqual([["entries", 2, "access", "paths", 1]]);
  });

  it("A-14 empty path list", () => {
    const input = evidenceAccessFixture();
    input.entries[2]!.access.paths = [];
    expect(pathsOf(input)).toEqual([["entries", 2, "access", "paths"]]);
  });

  it("A-15 inaccessible with paths", () => {
    const input = evidenceAccessFixture();
    (input.entries[1]!.access as Record<string, unknown>).paths = [garden];
    expect(pathsOf(input)).toEqual([["entries", 1, "access"]]);
  });

  it("A-16 unknown access status", () => {
    const input = evidenceAccessFixture();
    (input.entries[1] as Record<string, unknown>).access = { kind: "hidden" };
    expect(pathsOf(input)).toEqual([["entries", 1, "access", "kind"]]);
  });

  it("A-17 events are no V1 target", () => {
    const input = evidenceAccessFixture();
    (input.entries[2]!.access.paths as unknown[])[0] = { kind: "inspect_event", eventId: "event:walk" };
    expect(pathsOf(input)).toEqual([["entries", 2, "access", "paths", 0, "kind"]]);
  });

  it("A-18 unknown root field", () => {
    expect(pathsOf({ ...evidenceAccessFixture(), revision: 1 })).toEqual([[]]);
  });

  it("A-19 unknown entry field", () => {
    const input = evidenceAccessFixture();
    (input.entries[0] as Record<string, unknown>).label = "Fingerabdruck";
    expect(pathsOf(input)).toEqual([["entries", 0]]);
  });

  it("A-22 schemaVersion must be exactly 1", () => {
    for (const schemaVersion of [2, "1", 0, -0, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
      expect(pathsOf({ ...evidenceAccessFixture(), schemaVersion })).toEqual([["schemaVersion"]]);
    }
    expect(parseEvidenceAccessMap({ ...evidenceAccessFixture(), schemaVersion: 1.0 }, T).schemaVersion).toBe(1);
  });

  it("A-23 case without evidence and no entries", () => {
    const map = parseEvidenceAccessMap(emptyEvidenceAccessFixture(), parseCaseTruth(goldenCase()));
    expect(map.entries).toEqual([]);
  });

  it("A-26 source is not the location of discovery", () => {
    const gloves = T.evidence.find((evidence) => evidence.id === "evidence:gloves-dirty")!;
    expect(gloves.source).toEqual({ kind: "event", id: "event:walk" });
    expect(found(resolveInvestigation(M, K, { kind: "examine_item", itemId: "item:gloves" }))).toEqual([
      "evidence:gloves-dirty",
    ]);
  });

  it("A-27 evidence supporting a false proposition is discoverable", () => {
    expect(found(resolveInvestigation(M, K, opener))).toEqual(["evidence:fingerprint"]);
  });

  it("A-28 evidence refuting a true proposition is accepted", () => {
    const variant = fullCase();
    variant.evidence.find((evidence) => evidence.id === "evidence:muddy-path")!.links[0]!.direction = "refutes";
    const truth = parseCaseTruth(variant);
    const map = boundTo(truth);
    expect(found(resolveInvestigation(map, K, garden))).toEqual(found(resolveInvestigation(M, K, garden)));
  });

  it("A-29 a map without any discovery path is valid", () => {
    const input = evidenceAccessFixture();
    for (const entry of input.entries) (entry as Record<string, unknown>).access = { kind: "inaccessible" };
    const map = parseEvidenceAccessMap(input, T);
    for (const action of allActions()) expect(found(resolveInvestigation(map, K, action))).toEqual([]);
  });
});

describe("MYST-0003 resolveInvestigation", () => {
  it("A-30 several evidence at one target, sorted", () => {
    expect(found(resolveInvestigation(M, K, garden))).toEqual(["evidence:gloves-dirty", "evidence:muddy-path"]);
  });

  it("A-31 two paths to one evidence", () => {
    expect(found(resolveInvestigation(M, K, opener))).toEqual(["evidence:fingerprint"]);
    expect(found(resolveInvestigation(M, K, library))).toEqual(["evidence:fingerprint"]);
  });

  it("A-32 repeated search", () => {
    const first = resolveInvestigation(M, K, garden);
    const second = resolveInvestigation(M, K, garden);
    expect(second).toEqual(first);
    expect(first.success).toBe(true);
  });

  it("A-33 no evidence at the target", () => {
    expect(found(resolveInvestigation(M, K, { kind: "examine_person", personId: "person:ben" }))).toEqual([]);
  });

  it("A-34 inaccessible evidence is never found", () => {
    for (const action of allActions()) {
      expect(found(resolveInvestigation(M, K, action))).not.toContain("evidence:anna-statement");
    }
  });

  it("A-35 source person is not a discovery site", () => {
    expect(found(resolveInvestigation(M, K, { kind: "examine_person", personId: "person:anna" }))).toEqual([]);
  });

  it("A-36 target unknown to the player", () => {
    expect(code(resolveInvestigation(M, [], garden))).toBe("TARGET_NOT_KNOWN");
  });

  it("A-37 partial knowledge", () => {
    const known = [{ kind: "location", id: "location:library" }];
    expect(code(resolveInvestigation(M, known, garden))).toBe("TARGET_NOT_KNOWN");
    expect(found(resolveInvestigation(M, known, library))).toEqual(["evidence:fingerprint"]);
  });

  it("A-39 foreign target listed in known (caller error) yields nothing", () => {
    const known = [...K, { kind: "location", id: "location:cellar" }];
    expect(found(resolveInvestigation(M, known, { kind: "search_location", locationId: "location:cellar" }))).toEqual(
      [],
    );
  });

  it("A-40 wrong target kind in the action", () => {
    expect(code(resolveInvestigation(M, K, { kind: "examine_item", itemId: "location:garden" }))).toBe(
      "INVALID_ACTION",
    );
  });

  it("A-41 unknown action kinds", () => {
    for (const kind of ["search", "inspect_event", "interrogate"]) {
      expect(code(resolveInvestigation(M, K, { kind, locationId: "location:garden" }))).toBe("INVALID_ACTION");
    }
    expect(code(resolveInvestigation(M, K, { kind: "inspect_event", eventId: "event:walk" }))).toBe("INVALID_ACTION");
  });

  it("A-46 invalid action is reported before invalid known refs", () => {
    expect(code(resolveInvestigation(M, "nope", { kind: "search" }))).toBe("INVALID_ACTION");
  });

  it("A-47 known refs are a set", () => {
    const known = [...K].reverse().flatMap((ref) => [ref, { ...ref }]);
    expect(resolveInvestigation(M, known, garden)).toEqual(resolveInvestigation(M, K, garden));
  });

  it("A-48 property order is irrelevant", () => {
    const known = K.map((ref) => ({ id: ref.id, kind: ref.kind }));
    const action = { locationId: "location:garden", kind: "search_location" };
    expect(resolveInvestigation(M, known, action)).toEqual(resolveInvestigation(M, K, garden));
  });

  it("A-49 entry and path order is irrelevant", () => {
    const input = evidenceAccessFixture();
    input.entries.reverse();
    for (const entry of input.entries) entry.access.paths?.reverse();
    const reordered = parseEvidenceAccessMap(input, T);
    for (const action of allActions()) {
      expect(resolveInvestigation(reordered, K, action)).toEqual(resolveInvestigation(M, K, action));
    }
    expect(hashEvidenceAccessMap(reordered)).toBe(H0);
  });

  it("A-72 discovery is monotone and idempotent", () => {
    const actions = allActions();
    const union = (sequence: number[]) => {
      const discovered = new Set<string>();
      for (const index of sequence) for (const id of found(resolveInvestigation(M, K, actions[index]))) discovered.add(id);
      return [...discovered].sort();
    };
    const byActionSet = new Map<string, string[]>();
    const sequences: number[][] = [[]];
    for (let length = 1; length <= 3; length++) {
      for (const prefix of sequences.filter((sequence) => sequence.length === length - 1)) {
        for (let index = 0; index < actions.length; index++) sequences.push([...prefix, index]);
      }
    }
    expect(sequences).toHaveLength(1 + 7 + 49 + 343);
    for (const sequence of sequences) {
      const key = JSON.stringify([...new Set(sequence)].sort());
      const result = union(sequence);
      const previous = byActionSet.get(key);
      if (previous === undefined) byActionSet.set(key, result);
      else expect(result).toEqual(previous);
    }
  });

  it("A-73 discovery never unlocks new targets", () => {
    const known = K.filter((ref) => ref.id !== "person:anna");
    const before = structuredClone(known);
    found(resolveInvestigation(M, known, garden));
    expect(known).toEqual(before);
    expect(code(resolveInvestigation(M, known, { kind: "examine_person", personId: "person:anna" }))).toBe(
      "TARGET_NOT_KNOWN",
    );
  });
});
