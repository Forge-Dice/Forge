import { describe, expect, it } from "vitest";
import { world } from "./npc-knowledge.fixture.ts";
import { authoring, catalogueInput, personAt, profileInput, ref } from "./interrogation-authoring.fixture.ts";
import {
  createInterrogationProfileSchema,
  createQuestionCatalogueSchema,
  parseQuestionCatalogue,
  statementClaimReferences,
  type QuestionCatalogue,
} from "../src/domain/interrogation-authoring.ts";
import type { CaseTruth } from "../src/domain/case-truth.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import { hashQuestionCatalogue } from "../src/domain/interrogation-authoring.identity.ts";

// Contract MYST-0005A §8, cases #1-#26 and #32-#34. Case numbers appear in the test names.

const { truth } = world();
const catalogue = authoring().catalogue;

type Paths = (string | number | symbol)[][];

function catalogueIssues(edit: (c: any) => void, t: CaseTruth = truth): Paths {
  const input = catalogueInput();
  edit(input);
  const result = createQuestionCatalogueSchema(t).safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path);
}

function profileIssues(edit: (p: any) => void, c: QuestionCatalogue = catalogue, t: CaseTruth = truth): Paths {
  const input = profileInput();
  input.catalogueHash = hashQuestionCatalogue(c);
  edit(input);
  const result = createInterrogationProfileSchema(t, c).safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path);
}

const ruleIndex = (questionId: string) => profileInput().rules.findIndex((r: any) => r.questionId === questionId);
const setRule = (questionId: string, rule: object) => (p: any) => {
  p.rules[ruleIndex(questionId)] = { questionId, ...rule };
};

describe("QuestionCatalogue", () => {
  it("#1 parses the fixture catalogue", () => {
    expect(catalogue.questions).toHaveLength(11);
    expect(Object.isFrozen(catalogue)).toBe(true);
  });

  it("#3 wrong caseId yields exactly one binding issue", () => {
    expect(catalogueIssues((c) => (c.caseId = "case:other"))).toEqual([["caseId"]]);
  });

  it("#4 wrong truthHash yields exactly one binding issue", () => {
    expect(catalogueIssues((c) => (c.truthHash = "0".repeat(64)))).toEqual([["truthHash"]]);
  });

  it("binding failure suppresses follow-up issues", () => {
    const paths = catalogueIssues((c) => {
      c.truthHash = "0".repeat(64);
      c.questions[0].mentions.push(ref.person("zoe"));
      c.questions[1].id = c.questions[0].id;
    });
    expect(paths).toEqual([["truthHash"]]);
  });

  it("#5 duplicate question id is reported at the later occurrence", () => {
    expect(catalogueIssues((c) => (c.questions[3].id = c.questions[1].id))).toEqual([["questions", 3, "id"]]);
  });

  it("#6 unknown mention", () => {
    expect(catalogueIssues((c) => (c.questions[2].mentions[0] = ref.person("zoe")))).toEqual([
      ["questions", 2, "mentions", 0, "id"],
    ]);
  });

  it("#7 duplicate mention is reported at the later occurrence", () => {
    expect(catalogueIssues((c) => c.questions[0].mentions.push(ref.location("library")))).toEqual([
      ["questions", 0, "mentions", 2],
    ]);
  });

  it("#8 empty mentions", () => {
    expect(catalogueIssues((c) => (c.questions[4].mentions = []))).toEqual([["questions", 4, "mentions"]]);
  });

  it("empty question list is rejected", () => {
    expect(catalogueIssues((c) => (c.questions = []))).toEqual([["questions"]]);
  });

  it("#9 proposition mentions are not entity refs", () => {
    const paths = catalogueIssues((c) => (c.questions[0].mentions[0] = { kind: "proposition", id: "proposition:ben-at-library" }));
    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0]!.slice(0, 3)).toEqual(["questions", 0, "mentions"]);
  });

  it.each(["Question:x", "question:", "q:x", "question:-x", `question:${"a".repeat(65)}`])(
    "#10 malformed question id %s",
    (id) => {
      expect(catalogueIssues((c) => (c.questions[0].id = id))).toEqual([["questions", 0, "id"]]);
    },
  );

  it("strict shape rejects unknown fields", () => {
    expect(catalogueIssues((c) => (c.questions[0].text = "Wo war Ben?"))).toHaveLength(1);
    expect(catalogueIssues((c) => (c.extra = 1))).toHaveLength(1);
  });
});

describe("NpcInterrogationProfile", () => {
  it("#2 parses the fixture profile", () => {
    const { profile } = authoring();
    expect(profile.rules).toHaveLength(11);
    expect(Object.isFrozen(profile.rules[0])).toBe(true);
  });

  it("#11 wrong catalogueHash yields exactly one binding issue", () => {
    expect(profileIssues((p) => (p.catalogueHash = "0".repeat(64)))).toEqual([["catalogueHash"]]);
  });

  it("binding issues on caseId and truthHash, no follow-ups", () => {
    const paths = profileIssues((p) => {
      p.caseId = "case:other";
      p.truthHash = "0".repeat(64);
      p.npcId = "person:zoe";
      p.rules.push({ questionId: "question:nope", act: "decline" });
    });
    expect(paths).toEqual([["caseId"], ["truthHash"]]);
  });

  it("#12 unknown NPC", () => {
    expect(profileIssues((p) => (p.npcId = "person:zoe"))).toEqual([["npcId"]]);
  });

  it("#13 rule for an unknown question, no further checks for that rule", () => {
    const i = ruleIndex("question:ben-in-library");
    const paths = profileIssues((p) => {
      p.rules[i].questionId = "question:nope";
      p.rules[i].claim.personId = "person:zoe";
    });
    expect(paths).toEqual([["rules", i, "questionId"]]);
  });

  it("#14 duplicate rule is reported at the later occurrence", () => {
    const paths = profileIssues((p) => p.rules.push({ questionId: "question:ben-in-library", act: "decline" }));
    expect(paths).toEqual([["rules", 11, "questionId"]]);
  });

  it.each([
    ["question:knife-used", { kind: "eventHasItem", eventId: "event:nope", itemId: "item:knife" }, "eventId"],
    ["question:knife-used", { kind: "eventHasItem", eventId: "event:ben-kills-clara", itemId: "item:fork" }, "itemId"],
    ["question:ben-in-library", personAt("zoe", "library"), "personId"],
    ["question:ben-in-library", personAt("ben", "attic"), "locationId"],
    [
      "question:argument-caused-killing",
      { kind: "eventCausedEvent", causeEventId: "event:nope", eventId: "event:ben-kills-clara" },
      "causeEventId",
    ],
  ])("#15 unknown claim reference in %s (%#)", (questionId, claim, field) => {
    const i = ruleIndex(questionId);
    expect(profileIssues(setRule(questionId, { act: "answer", claim, reveal: [] }))).toEqual([["rules", i, "claim", field]]);
  });

  it("unknown reveal reference suppresses release checks", () => {
    const i = ruleIndex("question:where-was-ben");
    const paths = profileIssues((p) => (p.rules[i].reveal = [ref.location("attic")]));
    expect(paths).toEqual([["rules", i, "reveal", 0, "id"]]);
  });

  it("#16 eventCausedEvent with cause = target is a shape issue", () => {
    const claim = { kind: "eventCausedEvent", causeEventId: "event:argument", eventId: "event:argument" };
    const paths = profileIssues(setRule("question:argument-caused-killing", { act: "answer", claim, reveal: [] }));
    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0]!.slice(0, 3)).toEqual(["rules", ruleIndex("question:argument-caused-killing"), "claim"]);
  });

  it("#24 decline with an extra claim field is a shape issue", () => {
    const claim = personAt("ben", "library");
    expect(profileIssues(setRule("question:bloody-knife", { act: "decline", claim }))).toHaveLength(1);
  });

  it.each([["invert"], ["feign_ignorance"], [undefined]])("#33 act %s is a shape issue", (act) => {
    const i = ruleIndex("question:ben-in-library");
    const paths = profileIssues((p) => {
      if (act === undefined) delete p.rules[i].act;
      else p.rules[i].act = act;
    });
    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0]!.slice(0, 2)).toEqual(["rules", i]);
  });

  it("#25 claim without a matching proposition is accepted", () => {
    const { truth: t } = world();
    expect(t.propositions.some((p) => p.claim.kind === "personAt" && p.claim.locationId === "location:garden")).toBe(false);
    expect(profileIssues(() => {})).toEqual([]);
  });

  it("#26 empty rules are accepted", () => {
    expect(profileIssues((p) => (p.rules = []))).toEqual([]);
  });

  it("#32 catalogue of another truth: binding issue only, no follow-ups", () => {
    const other = world((t) => (t.persons[0].name = "Anna B.")).truth;
    const otherCatalogue = parseQuestionCatalogue({ ...catalogueInput(), truthHash: hashCaseTruth(other) }, other);
    // Profile bound to the other catalogue, parsed against the original truth.
    const paths = profileIssues((p) => p.rules.push({ questionId: "question:nope", act: "decline" }), otherCatalogue);
    expect(paths).toEqual([["catalogueHash"]]);
    // Profile and catalogue both from the other truth, parsed against the original truth.
    const paths2 = profileIssues((p) => (p.truthHash = otherCatalogue.truthHash), otherCatalogue);
    expect(paths2).toEqual([["truthHash"], ["catalogueHash"]]);
  });
});

describe("Release rules R1-R4", () => {
  const where = "question:where-was-ben";
  const wi = ruleIndex(where);
  const benLibrary = personAt("ben", "library");

  it("#17 forbidden reveal: claim shows an unmentioned, unrevealed entity (R1)", () => {
    expect(profileIssues(setRule(where, { act: "answer", claim: benLibrary, reveal: [] }))).toEqual([["rules", wi, "claim"]]);
  });

  it("#18 explicit reveal is accepted", () => {
    expect(profileIssues(setRule(where, { act: "answer", claim: benLibrary, reveal: [ref.location("library")] }))).toEqual([]);
  });

  it("R1 reports a single issue even with several uncovered entities", () => {
    const claim = { kind: "eventHasItem", eventId: "event:ben-kills-clara", itemId: "item:knife" };
    expect(profileIssues(setRule(where, { act: "answer", claim, reveal: [] }))).toEqual([["rules", wi, "claim"]]);
  });

  it("#19 reveal must come from the claim (R2)", () => {
    const reveal = [ref.location("library"), ref.location("garden")];
    expect(profileIssues(setRule(where, { act: "answer", claim: benLibrary, reveal: reveal.slice(1) }))).toContainEqual([
      "rules",
      wi,
      "reveal",
      0,
    ]);
    expect(profileIssues(setRule(where, { act: "answer", claim: benLibrary, reveal }))).toEqual([["rules", wi, "reveal", 1]]);
  });

  it("#20 reveal of a mentioned entity is not new (R3)", () => {
    const q = "question:ben-in-library";
    expect(profileIssues(setRule(q, { act: "answer", claim: benLibrary, reveal: [ref.person("ben")] }))).toEqual([
      ["rules", ruleIndex(q), "reveal", 0],
    ]);
  });

  it("#21 reveal of the NPC itself is not new (R3)", () => {
    const q = "question:anna-in-killing";
    const claim = { kind: "eventHasParticipant", eventId: "event:ben-kills-clara", personId: "person:dora" };
    expect(profileIssues(setRule(q, { act: "answer", claim, reveal: [ref.person("dora")] }))).toEqual([
      ["rules", ruleIndex(q), "reveal", 0],
    ]);
  });

  it("#22 duplicate reveal (R4)", () => {
    const reveal = [ref.location("library"), ref.location("library")];
    expect(profileIssues(setRule(where, { act: "answer", claim: benLibrary, reveal }))).toEqual([["rules", wi, "reveal", 1]]);
  });

  it("#23 the NPC is implicitly released", () => {
    const edited = authoring((c) => c.questions.push({ id: "question:dora-where", mentions: [ref.location("garden")] }));
    const paths = profileIssues(
      (p) => p.rules.push({ questionId: "question:dora-where", act: "answer", claim: personAt("dora", "garden"), reveal: [] }),
      edited.catalogue,
    );
    expect(paths).toEqual([]);
  });

  it("another person is not implicitly released", () => {
    const edited = authoring((c) => c.questions.push({ id: "question:dora-where", mentions: [ref.location("garden")] }));
    const paths = profileIssues(
      (p) => p.rules.push({ questionId: "question:dora-where", act: "answer", claim: personAt("anna", "garden"), reveal: [] }),
      edited.catalogue,
    );
    expect(paths).toEqual([["rules", 11, "claim"]]);
  });

  it("decline rules are exempt from release checks", () => {
    expect(profileIssues(setRule("question:where-was-ben", { act: "decline" }))).toEqual([]);
  });
});

describe("#34 statementClaimReferences", () => {
  const E = "event:ben-kills-clara";
  it.each([
    [personAt("ben", "library"), [ref.person("ben"), ref.location("library")]],
    [{ kind: "eventHasParticipant", eventId: E, personId: "person:ben" }, [ref.event("ben-kills-clara"), ref.person("ben")]],
    [{ kind: "eventHasItem", eventId: E, itemId: "item:knife" }, [ref.event("ben-kills-clara"), ref.item("knife")]],
    [{ kind: "personResponsibleForEvent", personId: "person:ben", eventId: E }, [ref.person("ben"), ref.event("ben-kills-clara")]],
    [
      { kind: "personRoleForEvent", personId: "person:ben", eventId: E, role: "planner" },
      [ref.person("ben"), ref.event("ben-kills-clara")],
    ],
    [{ kind: "noPersonResponsibleForEvent", eventId: E }, [ref.event("ben-kills-clara")]],
    [{ kind: "eventCausedEvent", causeEventId: "event:argument", eventId: E }, [ref.event("argument"), ref.event("ben-kills-clara")]],
    [{ kind: "eventIntent", eventId: E, value: "intended" }, [ref.event("ben-kills-clara")]],
    [{ kind: "eventMechanism", eventId: E, value: "ordinary" }, [ref.event("ben-kills-clara")]],
  ])("%o", (claim: any, expected) => {
    const refs = statementClaimReferences(claim);
    expect(refs).toEqual(expected);
    expect(Object.isFrozen(refs)).toBe(true);
    refs.forEach((r) => expect(Object.isFrozen(r)).toBe(true));
  });

  it("deduplicates by kind|id and returns a new array per call", () => {
    const claim: any = { kind: "eventCausedEvent", causeEventId: "event:argument", eventId: "event:argument" };
    expect(statementClaimReferences(claim)).toEqual([ref.event("argument")]);
    const a: any = personAt("ben", "library");
    expect(statementClaimReferences(a)).not.toBe(statementClaimReferences(a));
  });
});
