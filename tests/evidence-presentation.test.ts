import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { parseCaseTruth, type CaseTruth } from "../src/domain/case-truth.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import * as presentationModule from "../src/domain/evidence-presentation.ts";
import {
  PRESENTATION_LIMITS,
  PlayerTextSchema,
  createEvidencePresentationSchema,
  parseEvidencePresentation,
  releaseEvidence,
  type EvidencePresentation,
  type PlayerRefTranslator,
} from "../src/domain/evidence-presentation.ts";
import * as identityModule from "../src/domain/evidence-presentation.identity.ts";
import { fullCase } from "./case-truth.fixture.ts";
import { GOLDEN_RELEASES, GOLDEN_RELEASE_BYTES, fakeRef, fakeTranslator, presentationFixture } from "./evidence-presentation.fixture.ts";

type Path = (string | number)[];
const truth = parseCaseTruth(fullCase());
const schema = createEvidencePresentationSchema(truth);
const ch = (code: number) => String.fromCodePoint(code);

function variant(mutate: (p: any) => void) {
  const p: any = presentationFixture();
  mutate(p);
  return p;
}
const parsed = (input: unknown = presentationFixture(), t: CaseTruth = truth) => parseEvidencePresentation(input, t);

function issuesOf(input: unknown, s = schema) {
  const result = s.safeParse(input);
  expect(result.success).toBe(false);
  return result.error!.issues.map((issue) => ({ path: JSON.stringify(issue.path), message: issue.message }));
}
const pathsOf = (input: unknown) => issuesOf(input).map((issue) => issue.path);
const expectIssueAt = (input: unknown, path: Path) => expect(pathsOf(input)).toContain(JSON.stringify(path));

function release(p: EvidencePresentation, id: unknown, translator: PlayerRefTranslator = fakeTranslator(truth)) {
  const result = releaseEvidence(p, id, translator);
  if (!result.success) throw new Error(result.code);
  return result.observation;
}

/** Fixture with every collection reversed and every object's keys in reverse order. */
function permutedFixture() {
  const reverseKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(reverseKeys).reverse();
    if (typeof value === "object" && value !== null) {
      return Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reverseKeys(v)]));
    }
    return value;
  };
  return reverseKeys(presentationFixture());
}

const IDS = ["evidence:fingerprint", "evidence:anna-statement", "evidence:muddy-path", "evidence:gloves-dirty"];

describe("AC-01/02: public API", () => {
  it("exports exactly the contract's runtime values", () => {
    expect(Object.keys(presentationModule).sort()).toEqual(
      [
        "MentionSchema",
        "PLAYER_REF_PATTERN",
        "PRESENTATION_LIMITS",
        "PlayerTextSchema",
        "PresentationEntrySchema",
        "ReportSchema",
        "createEvidencePresentationSchema",
        "parseEvidencePresentation",
        "releaseEvidence",
      ].sort(),
    );
    expect(Object.keys(identityModule).sort()).toEqual(
      ["EVIDENCE_PRESENTATION_CANONICALIZATION_PROFILE", "hashEvidencePresentation", "serializeEvidencePresentation"].sort(),
    );
  });

  it("AC-02: limits", () => {
    expect(PRESENTATION_LIMITS).toEqual({ textMaxLength: 1000, maxMentions: 16, maxReports: 8 });
    expect(Object.isFrozen(PRESENTATION_LIMITS)).toBe(true);
  });
});

describe("AC-03: fixture", () => {
  it("is bound to fullCase and parses deeply frozen", () => {
    expect(presentationFixture().truthHash).toBe(hashCaseTruth(truth));
    const p: any = parsed();
    const stack: unknown[] = [p];
    while (stack.length > 0) {
      const value = stack.pop();
      if (typeof value === "object" && value !== null) {
        expect(Object.isFrozen(value)).toBe(true);
        stack.push(...Object.values(value));
      }
    }
    expect(() => (p.entries[0].text = "x")).toThrow(TypeError);
    expect(() => p.entries[1].mentions.push({ kind: "item", id: "item:gloves" })).toThrow(TypeError);
  });

  it("A-47: mutating the input after parsing changes nothing", () => {
    const input = presentationFixture();
    const p = parsed(input);
    const before = JSON.stringify(p);
    input.entries[0]!.text = "Anders.";
    input.entries[1]!.mentions.pop();
    input.entries.pop();
    expect(JSON.stringify(p)).toBe(before);
    expect(Object.isFrozen(input)).toBe(false);
  });

  it("parseEvidencePresentation throws ZodError", () => {
    expect(() => parsed({})).toThrow(ZodError);
  });
});

describe("AC-04: binding and reference rules R1-R8", () => {
  it("A-31: changed truth is reported only at truthHash", () => {
    const changed = parseCaseTruth({ ...fullCase(), revision: 4 });
    expect(issuesOf(presentationFixture(), createEvidencePresentationSchema(changed)).map((i) => i.path)).toEqual([
      JSON.stringify(["truthHash"]),
    ]);
  });

  it("A-32: foreign case is reported at caseId without follow-up issues", () => {
    const input = variant((p) => {
      p.caseId = "case:other";
      p.entries[0].mentions.push({ kind: "person", id: "person:ghost" });
    });
    expect(pathsOf(input)).toEqual([JSON.stringify(["caseId"])]);
  });

  it("A-68 (R2): entry for unknown evidence", () => {
    expectIssueAt(variant((p) => p.entries.push({ ...p.entries[2], evidenceId: "evidence:ghost" })), ["entries", 4, "evidenceId"]);
  });

  it("A-69 (R3): duplicate entry", () => {
    expectIssueAt(variant((p) => p.entries.push({ ...p.entries[0] })), ["entries", 4, "evidenceId"]);
  });

  it("A-67 (R4): missing entry names the missing evidence", () => {
    const issues = issuesOf(variant((p) => p.entries.splice(2, 1)));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.path).toBe(JSON.stringify(["entries"]));
    expect(issues[0]!.message).toContain("evidence:muddy-path");
  });

  it("A-16 (R5): unknown mentioned entity", () => {
    expectIssueAt(variant((p) => p.entries[0].mentions.push({ kind: "person", id: "person:ghost" })), ["entries", 0, "mentions", 2, "id"]);
  });

  it("R5: an existing ID mentioned under the wrong kind is unknown", () => {
    expectIssueAt(variant((p) => p.entries[0].mentions.push({ kind: "event", id: "event:walk" }, { kind: "location", id: "location:nowhere" })), [
      "entries",
      0,
      "mentions",
      3,
      "id",
    ]);
  });

  it("A-27 (R6): duplicate mention", () => {
    expectIssueAt(variant((p) => p.entries[0].mentions.push({ kind: "person", id: "person:anna" })), ["entries", 0, "mentions", 2]);
  });

  it("A-19 (R7): report on an entity that is not mentioned", () => {
    const input = variant((p) =>
      p.entries[3].reports.push({
        claim: { kind: "eventHasItem", eventId: "event:walk", itemId: "item:gloves" },
        stance: "affirms",
        source: { kind: "observation" },
      }),
    );
    expect(pathsOf(input)).toEqual([JSON.stringify(["entries", 3, "reports", 0])]);
  });

  it("A-20 (R7): witness not mentioned", () => {
    const input = variant((p) => (p.entries[1].reports[0].source = { kind: "testimony", personId: "person:clara" }));
    expect(pathsOf(input)).toEqual([JSON.stringify(["entries", 1, "reports", 0])]);
  });

  it("A-24 (R7/R5): report on an unknown event", () => {
    const report = {
      claim: { kind: "eventHasParticipant", eventId: "event:nope", personId: "person:anna" },
      stance: "affirms",
      source: { kind: "observation" },
    };
    expect(pathsOf(variant((p) => p.entries[0].reports.push(report)))).toEqual([JSON.stringify(["entries", 0, "reports", 0])]);
    const mentioned = variant((p) => {
      p.entries[0].mentions.push({ kind: "event", id: "event:nope" });
      p.entries[0].reports.push(report);
    });
    expect(pathsOf(mentioned)).toEqual([JSON.stringify(["entries", 0, "mentions", 2, "id"])]);
  });

  it("A-25 (R8): same claim and source with both stances", () => {
    const input = variant((p) => p.entries[1].reports.push({ ...p.entries[1].reports[0], stance: "denies" }));
    expect(pathsOf(input)).toEqual([JSON.stringify(["entries", 1, "reports", 2])]);
  });

  it("R8 ignores property order", () => {
    const input = variant((p) =>
      p.entries[1].reports.push({
        source: { personId: "person:anna", kind: "testimony" },
        stance: "denies",
        claim: { personId: "person:ben", eventId: "event:argument", kind: "eventHasParticipant" },
      }),
    );
    expect(pathsOf(input)).toEqual([JSON.stringify(["entries", 1, "reports", 2])]);
  });

  it("A-26: two witnesses may contradict each other, both are released", () => {
    const p = parsed(
      variant((p) => {
        p.entries[1].reports.push({ ...p.entries[1].reports[0], stance: "denies", source: { kind: "testimony", personId: "person:ben" } });
      }),
    );
    expect(release(p, "evidence:anna-statement").reports).toHaveLength(3);
  });
});

describe("schema errors", () => {
  it.each<[string, (p: any) => void]>([
    ["A-17 evidence as mention", (p) => p.entries[0].mentions.push({ kind: "evidence", id: "evidence:fingerprint" })],
    ["A-18 proposition", (p) => p.entries[0].mentions.push({ kind: "proposition", id: "proposition:ben-at-murder" })],
    ["A-18 secret", (p) => p.entries[0].mentions.push({ kind: "secret", id: "secret:debt" })],
    ["A-18 red-herring", (p) => p.entries[0].mentions.push({ kind: "red-herring", id: "red-herring:fingerprint" })],
    ["A-18 conclusion", (p) => p.entries[0].mentions.push({ kind: "conclusion", id: "conclusion:x" })],
    ["A-18 motive", (p) => p.entries[0].mentions.push({ kind: "motive", id: "motive:debt" })],
    ["A-18 relationship", (p) => p.entries[0].mentions.push({ kind: "relationship", id: "relationship:ben-owes-clara" })],
    ["A-18 case", (p) => p.entries[0].mentions.push({ kind: "case", id: "case:letter-opener" })],
    ["A-22 propositionId in report", (p) => (p.entries[1].reports[0].propositionId = "proposition:ben-at-argument")],
    ["A-23 truth value in report", (p) => (p.entries[1].reports[0].truth = true)],
    ["A-30 description on entry", (p) => (p.entries[0].description = "x")],
    ["A-30 source on entry", (p) => (p.entries[0].source = { kind: "item", id: "item:gloves" })],
    ["A-30 links on entry", (p) => (p.entries[0].links = [])],
    ["A-30 label on entry", (p) => (p.entries[0].label = "x")],
    ["A-65 text is a number", (p) => (p.entries[0].text = 1)],
    ["A-65 text is null", (p) => (p.entries[0].text = null)],
    ["A-65 text is an array", (p) => (p.entries[0].text = ["a"])],
    ["A-66 schemaVersion 2", (p) => (p.schemaVersion = 2)],
    ["A-66 entries not an array", (p) => (p.entries = {})],
    ["A-66 foreign root key", (p) => (p.label = "x")],
    ["unknown stance", (p) => (p.entries[1].reports[0].stance = "maybe")],
  ])("%s", (_name, mutate) => {
    expect(schema.safeParse(variant(mutate)).success).toBe(false);
  });

  it("A-30 foreign keys are reported as unrecognized_keys", () => {
    const result = schema.safeParse(variant((p) => (p.entries[0].description = "x")));
    expect(result.error!.issues.map((issue) => issue.code)).toContain("unrecognized_keys");
  });

  it("A-28: 16 mentions are valid, 17 are not", () => {
    const extra = Array.from({ length: 17 }, (_, i) => ({ id: `person:p${i}`, name: `P${i}` }));
    const many = parseCaseTruth({ ...fullCase(), persons: [...fullCase().persons, ...extra] });
    const s = createEvidencePresentationSchema(many);
    const fill = (n: number) =>
      variant((p) => {
        p.truthHash = hashCaseTruth(many);
        p.entries[0].mentions = extra.slice(0, n).map((person) => ({ kind: "person", id: person.id }));
      });
    expect(s.safeParse(fill(16)).success).toBe(true);
    expect(s.safeParse(fill(17)).success).toBe(false);
  });

  it("A-29: 8 reports are valid, 9 are not", () => {
    const fill = (n: number) =>
      variant((p) => {
        p.entries[1].reports = Array.from({ length: n }, (_, at) => ({
          claim: { kind: "personAt", personId: "person:anna", locationId: "location:garden", at },
          stance: "affirms",
          source: { kind: "observation" },
        }));
      });
    expect(schema.safeParse(fill(8)).success).toBe(true);
    expect(schema.safeParse(fill(9)).success).toBe(false);
  });
});

describe("AC-05: player text rules T1-T6", () => {
  const ok = (text: string) => PlayerTextSchema.safeParse(text).success;
  const messages = (text: string) => PlayerTextSchema.safeParse(text).error?.issues.map((i) => i.message) ?? [];

  it("A-52 (T1): length in UTF-16 code units", () => {
    expect(ok("a".repeat(1000))).toBe(true);
    expect(ok("a".repeat(1001))).toBe(false);
    const emoji = ch(0x1f50d);
    expect(ok(emoji.repeat(500))).toBe(true);
    expect(ok(emoji.repeat(501))).toBe(false);
  });

  it("A-50/A-51 (T2): whitespace-only and empty text", () => {
    expect(messages("  \n ")).toContain("Text must contain a non-whitespace character");
    expect(messages("")).toContain("Text must contain a non-whitespace character");
  });

  it("A-56 (T3): lone surrogates", () => {
    for (const text of [`a${ch(0xd800)}b`, `a${ch(0xdc00)}b`, `ab${ch(0xd800)}`, `${ch(0xdc00)}${ch(0xd800)}x`]) {
      expect(messages(text)).toContain("Text must be well-formed Unicode");
    }
  });

  const forbidden = [
    0x0000, 0x0009, 0x000b, 0x000d, 0x001f, 0x007f, 0x0085, 0x009f, 0x061c, 0x200b, 0x200e, 0x200f, 0x2028, 0x2029, 0x202a,
    0x202b, 0x202c, 0x202d, 0x202e, 0x2060, 0x2066, 0x2067, 0x2068, 0x2069, 0xfeff,
  ];
  it.each(forbidden.map((code) => [code.toString(16).padStart(4, "0")]))("A-53/54/55 (T4): U+%s is forbidden", (hex) => {
    expect(messages(`ab${ch(parseInt(hex, 16))}cd`)).toContain("Text contains a forbidden control, bidi or invisible character");
  });

  it("A-57: legitimate characters", () => {
    const zwjFamily = [0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467].map(ch).join("");
    for (const text of ["Zeile eins\nZeile zwei", `Familie ${zwjFamily}`, `Auf${ch(0x200c)}lage`, "„Zitat“", "Straße", "<script>", "**fett**"]) {
      expect(ok(text), JSON.stringify(text)).toBe(true);
    }
    expect(ok(`a${ch(0x000a)}b`)).toBe(true);
    expect(ok(`a${ch(0x00a0)}b`)).toBe(true);
  });

  it("A-58: homoglyph IDs are accepted (accident guard only)", () => {
    expect(ok(`${ch(0x0440)}${ch(0x0435)}rson:ben`)).toBe(true);
  });

  it("T5: canonical IDs are rejected", () => {
    expect(messages("Siehe person:ben")).toContain("Text must not contain a canonical ID");
  });

  it("A-61: text without ID form is accepted", () => {
    for (const text of ["Person:Ben", "person: ben", "die person:"]) expect(ok(text), text).toBe(true);
  });

  it("A-62: deliberately conservative false positive", () => {
    expect(messages("Kontaktperson:anna")).toContain("Text must not contain a canonical ID");
  });

  it("T6: PlayerRefs are rejected", () => {
    expect(messages("siehe pr1_0123456789abcdef")).toContain("Text must not contain a PlayerRef");
  });

  it("several rules report together, at the field path", () => {
    const text = `${ch(0x202e)}person:ben pr1_0123456789abcdef`;
    expect(messages(text)).toHaveLength(3);
    const issues = issuesOf(variant((p) => (p.entries[2].text = text)));
    expect(issues.every((issue) => issue.path === JSON.stringify(["entries", 2, "text"]))).toBe(true);
  });

  it("A-14: description copied into text is accepted", () => {
    expect(schema.safeParse(variant((p) => (p.entries[2].text = "Frische Fußspuren im Gartenbeet"))).success).toBe(true);
  });
});

describe("AC-06/07: release", () => {
  const p = parsed();

  it.each(IDS)("golden release %s", (id) => {
    const json = JSON.stringify(releaseEvidence(p, id, fakeTranslator(truth)));
    expect(json).toBe(GOLDEN_RELEASES[id]);
    expect(Buffer.byteLength(json, "utf8")).toBe(GOLDEN_RELEASE_BYTES[id]);
  });

  it("AC-07 / A-03: a permuted document releases identically", () => {
    const q = parsed(permutedFixture());
    for (const id of IDS) expect(release(q, id)).toEqual(release(p, id));
  });

  it("A-03: mentions are ordered by ref, not by canonical ID or author order", () => {
    const observation = release(p, "evidence:anna-statement");
    const refs = observation.mentions.map((m) => m.ref);
    expect(refs).toEqual([...refs].sort());
    expect(observation.mentions.map((m) => m.kind)).toEqual(["person", "event", "person", "location"]);
  });

  it("A-04 / A-21 / A-74: mentioned kinds are visible, a mention needs no report", () => {
    const observation = release(p, "evidence:gloves-dirty");
    expect(observation.mentions).toEqual([{ kind: "item", ref: fakeRef("item", "item:gloves") }]);
    expect(observation.reports).toEqual([]);
  });

  it("A-43: repeated release is deeply equal", () => {
    for (const id of IDS) expect(release(p, id)).toEqual(release(p, id));
  });

  it("A-46: the observation is frozen and shares no object with the presentation", () => {
    const result: any = releaseEvidence(p, "evidence:anna-statement", fakeTranslator(truth));
    const objects = (value: unknown, into = new Set<object>()) => {
      if (typeof value === "object" && value !== null && !into.has(value)) {
        into.add(value);
        for (const child of Object.values(value)) objects(child, into);
      }
      return into;
    };
    const presentationObjects = objects(p);
    for (const object of objects(result)) {
      expect(Object.isFrozen(object)).toBe(true);
      expect(presentationObjects.has(object)).toBe(false);
    }
    expect(() => (result.observation.reports[0].stance = "denies")).toThrow(TypeError);
  });

  it("A-73: release does not check discovery", () => {
    for (const id of IDS) expect(releaseEvidence(p, id, fakeTranslator(truth)).success).toBe(true);
  });

  it("A-71 / A-75: reports are released as authored, against the truth and more precise than the text", () => {
    const q = parsed(
      variant((p) => {
        p.entries[1].reports[1].claim.locationId = "location:library";
        p.entries[1].mentions.push({ kind: "location", id: "location:library" });
      }),
    );
    const observation = release(q, "evidence:anna-statement");
    const personAt = observation.reports.find((r) => r.claim.kind === "personAt")!;
    expect(personAt.claim).toEqual({
      kind: "personAt",
      person: fakeRef("person", "person:anna"),
      location: fakeRef("location", "location:library"),
      at: 1500,
    });
  });

  it("A-72: a solution-relevant observation report is released", () => {
    const q = parsed(
      variant((p) => {
        p.entries[0].mentions.push({ kind: "event", id: "event:murder" }, { kind: "person", id: "person:ben" });
        p.entries[0].reports.push({
          claim: { kind: "eventHasParticipant", eventId: "event:murder", personId: "person:ben" },
          stance: "affirms",
          source: { kind: "observation" },
        });
      }),
    );
    expect(release(q, "evidence:fingerprint").reports).toEqual([
      {
        claim: { kind: "eventHasParticipant", event: fakeRef("event", "event:murder"), person: fakeRef("person", "person:ben") },
        stance: "affirms",
        source: { kind: "observation" },
      },
    ]);
  });

  it("eventHasItem and denies are translated", () => {
    const q = parsed(
      variant((p) => {
        p.entries[3].mentions.push({ kind: "event", id: "event:walk" });
        p.entries[3].reports.push({
          claim: { kind: "eventHasItem", eventId: "event:walk", itemId: "item:gloves" },
          stance: "denies",
          source: { kind: "observation" },
        });
      }),
    );
    expect(release(q, "evidence:gloves-dirty").reports).toEqual([
      {
        claim: { kind: "eventHasItem", event: fakeRef("event", "event:walk"), item: fakeRef("item", "item:gloves") },
        stance: "denies",
        source: { kind: "observation" },
      },
    ]);
  });
});

describe("AC-08: release errors", () => {
  const p = parsed();
  const translator = fakeTranslator(truth);

  it("binding is checked before the evidence, the evidence before refs", () => {
    const stale = { ...translator, truthHash: "0".repeat(64), refFor: () => null };
    expect(releaseEvidence(p, "evidence:nope", stale)).toEqual({ success: false, code: "BINDING_MISMATCH" });
    expect(releaseEvidence(p, "evidence:nope", { ...translator, refFor: () => null })).toEqual({ success: false, code: "UNKNOWN_EVIDENCE" });
    expect(releaseEvidence(p, "evidence:fingerprint", { ...translator, refFor: () => null })).toEqual({ success: false, code: "REF_UNAVAILABLE" });
  });

  it("A-41: unknown evidence, one shared frozen result", () => {
    const results = ["evidence:nope", "evidence:killer-fingerprint", 42, null, undefined, fakeRef("evidence", "evidence:fingerprint"), " evidence:fingerprint", "evidence:fingerprint "].map(
      (id) => releaseEvidence(p, id, translator),
    );
    for (const result of results) {
      expect(result).toBe(results[0]);
      expect(result).toEqual({ success: false, code: "UNKNOWN_EVIDENCE" });
      expect(Object.isFrozen(result)).toBe(true);
    }
  });

  it("each code is one shared constant with exactly two keys", () => {
    const failures = [
      releaseEvidence(p, "evidence:fingerprint", { ...translator, caseId: "case:other" }),
      releaseEvidence(p, "evidence:fingerprint", { ...translator, truthHash: "f".repeat(64) }),
      releaseEvidence(p, "evidence:fingerprint", { ...translator, refFor: () => "nope" }),
      releaseEvidence(p, "evidence:muddy-path", { ...translator, refFor: () => null }),
    ];
    expect(failures[0]).toBe(failures[1]);
    expect(failures[2]).toBe(failures[3]);
    for (const failure of failures) expect(Object.keys(failure).sort()).toEqual(["code", "success"]);
  });
});
