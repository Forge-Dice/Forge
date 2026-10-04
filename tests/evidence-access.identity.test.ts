import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseCaseTruth } from "../src/domain/case-truth.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import { parseEvidenceAccessMap, type EvidenceAccessMap } from "../src/domain/evidence-access.ts";
import {
  EVIDENCE_ACCESS_CANONICALIZATION_PROFILE,
  hashEvidenceAccessMap,
  serializeEvidenceAccessMap,
} from "../src/domain/evidence-access.identity.ts";
import { fullCase, goldenCase } from "./case-truth.fixture.ts";
import {
  CANON_E,
  CANON_M,
  emptyEvidenceAccessFixture,
  evidenceAccessFixture,
  H0,
  H1,
  H2,
  H3,
  H5,
  H6,
  HE,
} from "./evidence-access.fixture.ts";

const T = parseCaseTruth(fullCase());
const M = parseEvidenceAccessMap(evidenceAccessFixture(), T);

type Fixture = ReturnType<typeof evidenceAccessFixture>;
type Entry = Fixture["entries"][number];

function hashOf(edit: (input: Fixture) => void): string {
  const input = evidenceAccessFixture();
  edit(input);
  return hashEvidenceAccessMap(parseEvidenceAccessMap(input, T));
}

function entry(input: Fixture, evidenceId: string): Entry {
  return input.entries.find((candidate) => candidate.evidenceId === evidenceId)!;
}

/** Recursively rebuilds objects with reversed key order and reversed arrays. */
function permuted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(permuted).reverse();
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.keys(value)
        .reverse()
        .map((key) => [key, permuted((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

describe("MYST-0003 identity", () => {
  it("uses its own canonicalization profile", () => {
    expect(EVIDENCE_ACCESS_CANONICALIZATION_PROFILE).toBe("forge-evidence-access-c14n-v1");
  });

  it("A-62 golden vector for the fixture", () => {
    expect(serializeEvidenceAccessMap(M)).toBe(CANON_M);
    expect(Buffer.byteLength(CANON_M, "utf8")).toBe(733);
    expect(hashEvidenceAccessMap(M)).toBe(H0);
  });

  it("A-63 golden vector for an empty map", () => {
    const map = parseEvidenceAccessMap(emptyEvidenceAccessFixture(), parseCaseTruth(goldenCase()));
    expect(serializeEvidenceAccessMap(map)).toBe(CANON_E);
    expect(hashEvidenceAccessMap(map)).toBe(HE);
  });

  it("A-64 changing a path changes the hash", () => {
    const hash = hashOf((input) => {
      entry(input, "evidence:muddy-path").access.paths![0] = { kind: "search_location", locationId: "location:library" };
    });
    expect(hash).toBe(H1);
    expect(hash).not.toBe(H0);
  });

  it("A-65 discoverable to inaccessible", () => {
    expect(hashOf((input) => void (entry(input, "evidence:muddy-path").access = { kind: "inaccessible" }))).toBe(H2);
  });

  it("A-66 inaccessible to discoverable", () => {
    const hash = hashOf((input) => {
      entry(input, "evidence:anna-statement").access = {
        kind: "discoverable",
        paths: [{ kind: "examine_person", personId: "person:anna" } as never],
      };
    });
    expect(hash).toBe(H3);
  });

  it("A-67 removing a path", () => {
    expect(hashOf((input) => void entry(input, "evidence:fingerprint").access.paths!.pop())).toBe(H5);
  });

  it("A-68 a different truth binding (serializer level only)", () => {
    const rebound = { ...structuredClone(M), truthHash: "0".repeat(64) } as unknown as EvidenceAccessMap;
    expect(hashEvidenceAccessMap(rebound)).toBe(H6);
  });

  it("A-69 entries, paths and object keys are order-independent", () => {
    const input = permuted(evidenceAccessFixture());
    const map = parseEvidenceAccessMap(input, T);
    expect(JSON.stringify(map)).not.toBe(JSON.stringify(M));
    expect(serializeEvidenceAccessMap(map)).toBe(CANON_M);
    expect(hashEvidenceAccessMap(map)).toBe(H0);
  });

  it("A-70 domain separation from case hashes", () => {
    const caseProfileHash = createHash("sha256").update(`forge-case-c14n-v1\n${CANON_M}`, "utf8").digest("hex");
    expect(hashEvidenceAccessMap(M)).not.toBe(caseProfileHash);
    expect(hashEvidenceAccessMap(M)).not.toBe(hashCaseTruth(T));
    const plain = createHash("sha256").update(CANON_M, "utf8").digest("hex");
    expect(hashEvidenceAccessMap(M)).not.toBe(plain);
  });

  it("A-71 every hash is lowercase SHA-256 hex", () => {
    for (const hash of [H0, HE, H1, H2, H3, H5, H6, hashEvidenceAccessMap(M)]) {
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
