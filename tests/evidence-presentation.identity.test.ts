import { describe, expect, it } from "vitest";
import { parseCaseTruth } from "../src/domain/case-truth.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import { parseEvidencePresentation, releaseEvidence } from "../src/domain/evidence-presentation.ts";
import {
  EVIDENCE_PRESENTATION_CANONICALIZATION_PROFILE,
  hashEvidencePresentation,
  serializeEvidencePresentation,
} from "../src/domain/evidence-presentation.identity.ts";
import { fullCase, goldenCase } from "./case-truth.fixture.ts";
import {
  CANON_E,
  CANON_P,
  HASH_P0,
  HASH_P1,
  HASH_P2,
  HASH_P3,
  HASH_P4,
  HASH_P5,
  HASH_P6,
  HASH_P7,
  HASH_PE,
  fakeTranslator,
  presentationFixture,
} from "./evidence-presentation.fixture.ts";

const truth = parseCaseTruth(fullCase());
const parsed = (input: unknown) => parseEvidencePresentation(input, truth);
const hashOf = (mutate: (p: any) => void) => {
  const p: any = presentationFixture();
  mutate(p);
  return hashEvidencePresentation(parsed(p));
};
const entry = (p: any, id: string) => p.entries.find((e: any) => e.evidenceId === `evidence:${id}`);

describe("AC-10: canonicalization profile and golden vectors", () => {
  it("profile name", () => {
    expect(EVIDENCE_PRESENTATION_CANONICALIZATION_PROFILE).toBe("forge-evidence-presentation-c14n-v1");
  });

  it("CANON_P and P0", () => {
    const p = parsed(presentationFixture());
    expect(serializeEvidencePresentation(p)).toBe(CANON_P);
    expect(Buffer.byteLength(CANON_P, "utf8")).toBe(1342);
    expect(hashEvidencePresentation(p)).toBe(HASH_P0);
  });

  it("A-44 / A-45: key order and collection order do not matter", () => {
    const p: any = presentationFixture();
    p.entries.reverse();
    for (const e of p.entries) {
      e.mentions.reverse();
      e.reports.reverse();
    }
    const reordered = {
      entries: p.entries.map((e: any) => ({
        reports: e.reports.map((r: any) => ({ source: r.source, stance: r.stance, claim: Object.fromEntries(Object.entries(r.claim).reverse()) })),
        mentions: e.mentions.map((m: any) => ({ id: m.id, kind: m.kind })),
        text: e.text,
        evidenceId: e.evidenceId,
      })),
      truthHash: p.truthHash,
      caseId: p.caseId,
      schemaVersion: p.schemaVersion,
    };
    const q = parsed(reordered);
    expect(serializeEvidencePresentation(q)).toBe(CANON_P);
    expect(hashEvidencePresentation(q)).toBe(HASH_P0);
    const original = parsed(presentationFixture());
    for (const e of original.entries) {
      expect(releaseEvidence(q, e.evidenceId, fakeTranslator(truth))).toEqual(releaseEvidence(original, e.evidenceId, fakeTranslator(truth)));
    }
  });

  it("A-70: empty case gives CANON_E and PE", () => {
    const golden = parseCaseTruth(goldenCase());
    const p = parseEvidencePresentation(
      { schemaVersion: 1, caseId: "case:golden", truthHash: hashCaseTruth(golden), entries: [] },
      golden,
    );
    expect(serializeEvidencePresentation(p)).toBe(CANON_E);
    expect(Buffer.byteLength(CANON_E, "utf8")).toBe(134);
    expect(hashEvidencePresentation(p)).toBe(HASH_PE);
  });

  it.each<[string, (p: any) => void, string]>([
    ["P1 muddy-path text ends with !", (p) => (entry(p, "muddy-path").text = "Im Gartenbeet sind frische Fußspuren!"), HASH_P1],
    ["P2 gloves-dirty mentions the garden", (p) => entry(p, "gloves-dirty").mentions.push({ kind: "location", id: "location:garden" }), HASH_P2],
    ["P3 personAt denied", (p) => (entry(p, "anna-statement").reports.find((r: any) => r.claim.kind === "personAt").stance = "denies"), HASH_P3],
    ["P4 participant as observation", (p) => (entry(p, "anna-statement").reports.find((r: any) => r.claim.kind === "eventHasParticipant").source = { kind: "observation" }), HASH_P4],
    ["P5 fingerprint text in NFD", (p) => (entry(p, "fingerprint").text = entry(p, "fingerprint").text.replace("ö", `o${String.fromCharCode(0x0308)}`)), HASH_P5],
    ["P6 personAt at 1501", (p) => (entry(p, "anna-statement").reports.find((r: any) => r.claim.kind === "personAt").claim.at = 1501), HASH_P6],
    ["P7 muddy-path text with trailing space", (p) => (entry(p, "muddy-path").text += " "), HASH_P7],
  ])("A-49: %s", (_name, mutate, expected) => {
    const hash = hashOf(mutate);
    expect(hash).toBe(expected);
    expect(hash).not.toBe(HASH_P0);
  });

  it("serialization does not touch the frozen document", () => {
    const p = parsed(presentationFixture());
    const before = JSON.stringify(p);
    serializeEvidencePresentation(p);
    expect(JSON.stringify(p)).toBe(before);
  });
});
