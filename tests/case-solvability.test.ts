import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import {
  checkCaseSolvability,
  createCaseProofProfileSchema,
  parseCaseProofProfile,
  type SolvabilityReport,
  type WitnessReplay,
} from "../src/domain/case-solvability.ts";
import {
  buildProfile,
  concl,
  prop,
  RELEASE_HASH,
  stubPort,
  world,
  type ProfileSpec,
  type World,
} from "./case-solvability.fixture.ts";

type Path = (string | number)[];

const W = world();

function parse(input: unknown, w: World = W) {
  return parseCaseProofProfile(input, w.truth, w.solution);
}

function issuePaths(input: unknown, w: World = W): Path[] {
  const result = createCaseProofProfileSchema(w.truth, w.solution).safeParse(input);
  expect(result.success).toBe(false);
  return result.success ? [] : result.error.issues.map((issue) => issue.path as Path);
}

function check(input: any, port: WitnessReplay = stubPort(input), w: World = W): SolvabilityReport {
  return checkCaseSolvability(w.truth, w.solution, parse(input, w), port);
}

function codes(report: SolvabilityReport): string[] {
  return report.findings.map((f) => f.code);
}

/** Required literal not derived: fail, with REQUIRED_NOT_DERIVED among the errors. */
function expectUnderived(report: SolvabilityReport): void {
  expect(report.status).toBe("fail");
  expect(errorCodes(report)).toContain("REQUIRED_NOT_DERIVED");
}

function errorCodes(report: SolvabilityReport): string[] {
  return report.findings.filter((f) => f.severity === "error").map((f) => f.code);
}

const base = (spec: ProfileSpec = {}, w: World = W) => buildProfile(w, spec);
const benPath = { conclusion: "ben-responsible", value: true, premises: ["ben-in-killing", "knife-used"] };

/** Adds a released REPORTED_BY_NPC observation (step "step:obs:<id>") and its observation node. */
function withReport(input: any, id: string, literal: object, npc = "person:anna") {
  input.observations.push({ id: `obs:${id}`, kind: "REPORTED_BY_NPC", npcId: npc, literal });
  input.nodes.push({ id: `node:${id}`, kind: "observation", observationId: `obs:${id}` });
  input.witnessStepIds.unshift(`step:obs:${id}`);
  return input;
}

/** Adds a licensed edge (and its published rule descriptor) from `premises` to literal node `to`. */
function withEdge(input: any, id: string, premises: string[], to: string, literal?: object) {
  if (literal !== undefined && !input.nodes.some((n: any) => n.id === to)) input.nodes.push({ id: to, kind: "literal", literal });
  const target = input.nodes.find((n: any) => n.id === to);
  input.edges.push({ id, allOf: [...premises, "node:rules"], to, license: "node:rules" });
  input.observations.find((o: any) => o.id === "obs:rules").rules.push({ edgeId: id, allOf: premises, yields: target.literal });
  return input;
}

describe("MYST-SOLVABILITY-0001 positive control", () => {
  it("base profile passes with a single surviving answer", () => {
    const report = check(base());
    expect(report).toEqual({ status: "pass", findings: [], survivingAnswerCount: 1, competingAnswerSamples: [] });
  });

  it("the port is called exactly once with the ordered witness", () => {
    const input = base();
    const port = stubPort(input);
    check(input, port);
    expect(port.calls).toEqual([input.witnessStepIds]);
  });
});

describe("MYST-SOLVABILITY-0001 parser (T01-T10, T21, T30, T31, T39, T44, T45)", () => {
  it("T01 schemaVersion 2", () => {
    expect(issuePaths({ ...base(), schemaVersion: 2 })).toEqual([["schemaVersion"]]);
  });

  it("T02 unknown root field hypotheses (no authored competitor list)", () => {
    expect(issuePaths({ ...base(), hypotheses: [[{ conclusionId: "conclusion:ben-responsible", value: true }]] })).toEqual([[]]);
  });

  it("T03 unknown executable rule field", () => {
    const input = base();
    input.observations.at(-1).rules[0].fn = "(premises) => true";
    expect(issuePaths(input)).toEqual([["observations", 2, "rules", 0]]);
    const edge = base();
    edge.edges[0].when = "true";
    expect(issuePaths(edge)).toEqual([["edges", 0]]);
  });

  it("T04 empty answerScope", () => {
    expect(issuePaths({ ...base(), answerScope: [] })).toEqual([["answerScope"]]);
  });

  it("T05 six scoped dimensions are valid", () => {
    const scope = ["anna-responsible", "ben-responsible", "clara-responsible", "dora-responsible", "nobody-responsible", "ben-actor"];
    const report = check(base({ scope, policy: "may_remain_ambiguous" }));
    expect(report.status).toBe("pass");
    expect(report.survivingAnswerCount).toBe(32); // 64 generated, ben-responsible=false eliminated
  });

  it("T06 seven scoped dimensions exceed the limit", () => {
    const scope = ["anna-responsible", "ben-responsible", "clara-responsible", "dora-responsible", "nobody-responsible", "ben-actor", "intended"];
    expect(issuePaths(base({ scope }))).toEqual([["answerScope"]]);
  });

  it("T07 unknown conclusion ID in scope", () => {
    const input = base();
    input.answerScope.push("conclusion:ghost");
    expect(issuePaths(input)).toEqual([["answerScope", 1]]);
  });

  it("T08 foreign case binding fails before references", () => {
    const input = base();
    input.bindings.caseId = "case:other";
    input.answerScope.push("conclusion:ghost");
    input.edges[0].to = "node:ghost";
    expect(issuePaths(input)).toEqual([["bindings", "caseId"]]);
  });

  it("T09 changed truth hash", () => {
    const changed = world({ editTruth: (t) => (t.title = "Anderer Titel") });
    expect(issuePaths(base(), changed)).toContainEqual(["bindings", "truthHash"]);
    const report = checkCaseSolvability(changed.truth, changed.solution, parse(base()), stubPort(base()));
    expect(report).toMatchObject({ status: "fail", findings: [{ code: "BINDING_MISMATCH" }] });
  });

  it("T10 changed solution hash", () => {
    const changed = world({ required: [{ conclusionId: "conclusion:ben-responsible", value: true }, { conclusionId: "conclusion:intended", value: true }] });
    expect(issuePaths(base(), changed)).toEqual([["bindings", "solutionHash"]]);
    const report = checkCaseSolvability(W.truth, changed.solution, parse(base()), stubPort(base()));
    expect(codes(report)).toEqual(["BINDING_MISMATCH"]);
  });

  it("T21 an observed conclusion is no root", () => {
    const input = base();
    input.observations[0].literal = concl("ben-responsible", true);
    expect(issuePaths(input)).toContainEqual(["observations", 0, "literal", "kind"]);
  });

  it("T30 missing license node", () => {
    const input = base();
    input.edges[0].license = "node:missing";
    expect(issuePaths(input)).toContainEqual(["edges", 0, "license"]);
  });

  it("T31 license not included in allOf", () => {
    const input = base();
    input.edges[0].allOf = ["node:ben-in-killing", "node:knife-used"];
    expect(issuePaths(input)).toEqual([["edges", 0, "allOf"]]);
  });

  it("T39 empty body or license only", () => {
    const empty = base();
    empty.edges[0].allOf = [];
    expect(issuePaths(empty)).toContainEqual(["edges", 0, "allOf"]);
    const licenseOnly = base();
    licenseOnly.edges[0].allOf = ["node:rules"];
    expect(issuePaths(licenseOnly)).toEqual([["edges", 0, "allOf"]]);
  });

  it("T44 duplicate edge with the same ID", () => {
    const input = base();
    input.edges.push({ ...input.edges[0], allOf: ["node:ben-in-killing", "node:rules"] });
    expect(issuePaths(input)).toEqual([["edges", 1]]);
  });

  it("T45 structural duplicate edge with another ID", () => {
    const input = base();
    input.edges.push({ ...input.edges[0], id: "edge:copy", allOf: [...input.edges[0].allOf].reverse() });
    expect(issuePaths(input)).toEqual([["edges", 1]]);
  });

  it("references, uniqueness and required-in-scope are checked", () => {
    const required = base({ scope: ["intended"] });
    expect(issuePaths(required)).toEqual([["answerScope"]]);
    const dupScope = base({ scope: ["ben-responsible", "ben-responsible"] });
    expect(issuePaths(dupScope)).toEqual([["answerScope", 1]]);
    const dupNode = base();
    dupNode.nodes.push({ ...dupNode.nodes[0] });
    expect(issuePaths(dupNode)).toEqual([["nodes", 4]]);
    const badEvidence = base();
    badEvidence.observations[0].source = { kind: "evidence", evidenceId: "evidence:ghost" };
    expect(issuePaths(badEvidence)).toEqual([["observations", 0, "source", "evidenceId"]]);
    const badRule = base();
    badRule.observations[2].rules[0].edgeId = "edge:ghost";
    expect(issuePaths(badRule)).toEqual([["observations", 2, "rules", 0, "edgeId"]]);
    const literalLicense = base();
    literalLicense.edges[0].license = "node:knife-used";
    expect(issuePaths(literalLicense)).toEqual([["edges", 0, "license"]]);
    const observationTarget = base();
    observationTarget.edges[0].to = "node:rules";
    expect(issuePaths(observationTarget)).toEqual([["edges", 0, "to"]]);
    const badQuestion = base({ question: { kind: "identify_all_responsible", eventId: "event:ghost" } });
    expect(issuePaths(badQuestion)).toEqual([["question", "eventId"]]);
    expect(() => parse({ ...base(), schemaVersion: 2 })).toThrow(ZodError);
  });
});

describe("MYST-SOLVABILITY-0001 parser references", () => {
  it("reports, awareness and node references must exist", () => {
    const report = withReport(base(), "ghost-says", prop("knife-used", true), "person:ghost");
    expect(issuePaths(report)).toEqual([["observations", 3, "npcId"]]);
    const awareness = base();
    awareness.observations.push({ id: "obs:aware", kind: "ENTITY_AWARENESS", entity: { kind: "location", id: "location:attic" } });
    expect(issuePaths(awareness)).toEqual([["observations", 3, "entity", "id"]]);
    const node = base();
    node.nodes.push({ id: "node:orphan", kind: "observation", observationId: "obs:ghost" });
    expect(issuePaths(node)).toEqual([["nodes", 4, "observationId"]]);
  });

  it("local IDs and witness steps are bounded opaque strings", () => {
    const badId = base();
    badId.nodes[0].id = "Node With Spaces";
    expect(issuePaths(badId)).toContainEqual(["nodes", 0, "id"]);
    for (const step of ["", "step with space", "x".repeat(129), "schritt:ä"]) {
      expect(issuePaths({ ...base(), witnessStepIds: [step] })).toEqual([["witnessStepIds", 0]]);
    }
    expect(issuePaths({ ...base(), witnessStepIds: Array.from({ length: 257 }, (_, i) => `step:${i}`) })).toEqual([["witnessStepIds"]]);
  });
});

describe("MYST-SOLVABILITY-0001 replay port (T11-T19, T73-T75)", () => {
  it("T11 replay with a foreign releaseHash", () => {
    const input = base();
    const report = check(input, stubPort(input, {}, { ...input.bindings, releaseHash: "b".repeat(64) }));
    expect(report).toMatchObject({ status: "fail", findings: [{ code: "BINDING_MISMATCH" }] });
  });

  it("T12 replay with an old solution binding", () => {
    const input = base();
    const report = check(input, stubPort(input, {}, { ...input.bindings, solutionHash: "c".repeat(64) }));
    expect(codes(report)).toEqual(["BINDING_MISMATCH"]);
    expect(report.status).toBe("fail");
  });

  it("T13 port unavailable", () => {
    const report = check(base(), () => ({ success: false, code: "REPLAY_UNAVAILABLE" }));
    expect(report).toEqual({ status: "unknown", findings: [expect.objectContaining({ code: "REPLAY_UNAVAILABLE" })], survivingAnswerCount: 0, competingAnswerSamples: [] });
  });

  it("T14 port throws: unknown, no error echo", () => {
    const report = check(base(), () => {
      throw new Error("secret adapter failure");
    });
    expect(report.status).toBe("unknown");
    expect(codes(report)).toEqual(["REPLAY_UNAVAILABLE"]);
    expect(JSON.stringify(report)).not.toContain("secret");
  });

  it("T15 invalid ordered step", () => {
    const input = base();
    input.witnessStepIds.push("step:teleport");
    expect(check(input)).toMatchObject({ status: "fail", findings: [{ code: "INVALID_WITNESS" }] });
  });

  it("T16 corrupt replay result", () => {
    for (const raw of [{ success: true, released: "x" }, null, 42, { success: true, bindings: base().bindings, released: [{ id: "obs:x", kind: "MAGIC" }] }, { success: false, code: "OTHER" }]) {
      const report = check(base(), (() => raw) as unknown as WitnessReplay);
      expect(codes(report)).toEqual(["INVALID_REPLAY_RESULT"]);
      expect(report.status).toBe("fail");
    }
  });

  it("T17 released record not in the manifest", () => {
    const input = base();
    const extra = { id: "obs:extra", kind: "ENTITY_AWARENESS", entity: { kind: "person", id: "person:ben" } };
    const port: WitnessReplay = (steps) => {
      const result = stubPort(input)(steps);
      return result.success ? { ...result, released: [...result.released, extra as never] } : result;
    };
    expect(check(input, port)).toMatchObject({ status: "fail", findings: [{ code: "RELEASE_RECORD_MISMATCH", subjectIds: ["obs:extra"] }] });
  });

  it("T18 released payload modified", () => {
    const input = base();
    const port: WitnessReplay = (steps) => {
      const result = stubPort(input)(steps);
      if (!result.success) return result;
      const released = structuredClone(result.released) as any[];
      released[0].source = { kind: "evidence", evidenceId: "evidence:bloody-knife" };
      return { ...result, released };
    };
    expect(check(input, port)).toMatchObject({ status: "fail", findings: [{ code: "RELEASE_RECORD_MISMATCH" }] });
  });

  it("T19 repeated identical release is idempotent", () => {
    const input = base();
    input.witnessStepIds.push(input.witnessStepIds[0]);
    expect(check(input)).toEqual(check(base()));
  });

  it("T73 exclusive branches cannot be unioned in one witness", () => {
    const input = base();
    input.witnessStepIds = ["step:a", "step:b", "step:obs:rules"];
    const port = stubPort(input, {
      "step:a": { releases: ["obs:ben-in-killing"] },
      "step:b": { releases: ["obs:knife-used"], excludes: ["step:a"] },
    });
    expect(check(input, port)).toMatchObject({ status: "fail", findings: [{ code: "INVALID_WITNESS" }] });
  });

  it("T74 reordered release records give the same report", () => {
    const input = base();
    const reversed: WitnessReplay = (steps) => {
      const result = stubPort(input)(steps);
      return result.success ? { ...result, released: [...result.released].reverse() } : result;
    };
    expect(check(input, reversed)).toEqual(check(input));
  });

  it("T75 reversed witness order with prerequisites fails", () => {
    const input = base();
    const steps = { "step:obs:knife-used": { releases: ["obs:knife-used"], requires: ["step:obs:ben-in-killing"] } };
    expect(check(input, stubPort(input, steps)).status).toBe("pass");
    input.witnessStepIds = [...input.witnessStepIds].reverse();
    const port = stubPort(input, steps);
    expect(check(input, port)).toMatchObject({ status: "fail", findings: [{ code: "INVALID_WITNESS" }] });
    expect(port.calls).toEqual([["step:obs:rules", "step:obs:knife-used", "step:obs:ben-in-killing"]]);
  });
});

describe("MYST-SOLVABILITY-0001 observations and reports (T20, T22-T29, T40-T43, T71, T72)", () => {
  it("T20 an observed false value fails", () => {
    const input = base({ paths: [{ conclusion: "ben-responsible", value: true, premises: ["anna-in-killing"] }] });
    input.observations[0].literal.value = true; // anna-in-killing is objectively false
    input.nodes[0].literal.value = true;
    const report = check(input);
    expect(report.status).toBe("fail");
    expect(codes(report)).toContain("FALSE_OBSERVATION");
    expect(codes(report)).toContain("REQUIRED_NOT_DERIVED");
  });

  it("T22 a false NPC belief report is allowed but never a fact", () => {
    const input = base({ unreleased: ["ben-in-killing", "knife-used"] });
    withReport(input, "anna-claims", prop("anna-in-killing", true));
    withEdge(input, "edge:false-fact", ["node:anna-in-killing"], "node:ben-responsible-true");
    input.nodes.push({ id: "node:anna-in-killing", kind: "literal", literal: prop("anna-in-killing", true) });
    const report = check(input);
    expect(codes(report)).not.toContain("FALSE_OBSERVATION");
    expectUnderived(report);
  });

  it("T23 NPC-internal knowledge is no released root", () => {
    // The checker has no NPC input at all; without releases nothing is derived.
    const report = check(base({ unreleased: ["ben-in-killing", "knife-used"] }));
    expect(errorCodes(report)).toContain("REQUIRED_NOT_DERIVED");
    expect(checkCaseSolvability.length).toBe(4);
  });

  it("T24 NPC assertions without an authored bridge leave the required literal underived", () => {
    const input = base({ unreleased: ["ben-in-killing", "knife-used"] });
    withReport(input, "anna-says-ben", prop("ben-in-killing", true));
    withReport(input, "anna-says-knife", prop("knife-used", true));
    expectUnderived(check(input));
  });

  it("T25 inaccessible evidence: premise warning and missing goal", () => {
    const report = check(base({ unreleased: ["knife-used"] }));
    expect(report.findings).toContainEqual({ code: "PREMISE_NOT_REACHED", subjectIds: ["node:knife-used"], path: ["nodes", "node:knife-used"], relatedIds: ["obs:knife-used"], severity: "warning" });
    expectUnderived(report);
  });

  it("T26 discovered evidence whose payload is not released is no premise", () => {
    const input = base({ unreleased: ["knife-used"] });
    input.observations.push({ id: "obs:knife-found", kind: "ENTITY_AWARENESS", entity: { kind: "evidence", id: "evidence:bloody-knife" } });
    input.witnessStepIds.unshift("step:obs:knife-found");
    expectUnderived(check(input));
  });

  it("T27-T29 evidence links, sources and speaking descriptions seed nothing", () => {
    const edits = [
      (t: any) => (t.evidence[0].links = [{ propositionId: "proposition:anna-in-killing", direction: "supports" }]),
      (t: any) => (t.evidence[0].source = { kind: "person", id: "person:ben" }),
      (t: any) => (t.evidence[0].description = "Ben ist der Mörder, ganz sicher"),
    ];
    for (const editTruth of edits) {
      const w = world({ editTruth });
      expect(check(base({ unreleased: ["ben-in-killing", "knife-used"] }, w), undefined, w).status).toBe("fail");
      expect(check(base({}, w), undefined, w).status).toBe("pass");
    }
  });

  it("T40 a reported required conclusion is no objective root", () => {
    const input = base({ unreleased: ["ben-in-killing", "knife-used"] });
    withReport(input, "dora-says", concl("ben-responsible", true), "person:dora");
    expectUnderived(check(input));
  });

  it("T41 an explicit licensed implication from a true report is allowed", () => {
    const input = base({ unreleased: ["ben-in-killing", "knife-used"] });
    withReport(input, "anna-heard", prop("ben-in-killing", true));
    withEdge(input, "edge:testimony", ["node:anna-heard"], "node:ben-responsible-true");
    const report = check(input);
    expect(report.status).toBe("pass");
    expect(errorCodes(report)).toEqual([]);
  });

  it("T42 promoting a false report to a false fact is noncanonical", () => {
    const input = base();
    withReport(input, "anna-lies", prop("anna-in-killing", true));
    withEdge(input, "edge:promote", ["node:anna-lies"], "node:anna-in-killing-true", prop("anna-in-killing", true));
    const report = check(input);
    expect(report.findings).toContainEqual(expect.objectContaining({ code: "NONCANONICAL_INFERENCE", subjectIds: ["edge:promote"] }));
    expect(report.status).toBe("fail");
  });

  it("T43 an undetermined conclusion cannot be inferred", () => {
    const partial = world({ completeness: "partial" });
    for (const value of [true, false]) {
      const input = base({}, partial);
      withEdge(input, "edge:anna", ["node:knife-used"], `node:anna-${value}`, concl("anna-responsible", value));
      expect(codes(check(input, undefined, partial))).toContain("NONCANONICAL_INFERENCE");
    }
  });

  it("T71 awareness of a person is no guilt premise", () => {
    const input = base({ unreleased: ["ben-in-killing", "knife-used"] });
    input.observations.push({ id: "obs:ben-known", kind: "ENTITY_AWARENESS", entity: { kind: "person", id: "person:ben" } });
    input.nodes.push({ id: "node:ben-known", kind: "observation", observationId: "obs:ben-known" });
    input.witnessStepIds.unshift("step:obs:ben-known");
    expectUnderived(check(input));
  });

  it("T72 a known entity without released evidence gives no observation", () => {
    const input = base({ unreleased: ["knife-used"] });
    input.observations.push({ id: "obs:knife-known", kind: "ENTITY_AWARENESS", entity: { kind: "item", id: "item:knife" } });
    input.witnessStepIds.unshift("step:obs:knife-known");
    expect(check(input).status).toBe("fail");
  });
});

describe("MYST-SOLVABILITY-0001 rules and cycles (T32-T38, T46, T47)", () => {
  it("T32 an unpublished rule does not fire", () => {
    const input = base();
    input.witnessStepIds = input.witnessStepIds.filter((s: string) => s !== "step:obs:rules");
    const report = check(input);
    expect(codes(report)).toContain("UNPUBLISHED_RULE");
    expectUnderived(report);
  });

  it("T33 a published rule with a different consequence does not license the edge", () => {
    const input = base();
    input.observations[2].rules[0].yields = concl("ben-actor", true);
    const report = check(input);
    expect(report.findings).toContainEqual(expect.objectContaining({ code: "UNPUBLISHED_RULE", subjectIds: ["edge:0"], severity: "warning" }));
    expect(report.status).toBe("fail");
    const body = base();
    body.observations[2].rules[0].allOf = ["node:ben-in-killing"];
    expect(codes(check(body))).toContain("UNPUBLISHED_RULE");
  });

  it("T34/T36 a two-node cycle without seed derives nothing", () => {
    const input = base({ unreleased: ["ben-in-killing", "knife-used"] });
    withEdge(input, "edge:a", ["node:ben-responsible-true"], "node:actor", concl("ben-actor", true));
    withEdge(input, "edge:b", ["node:actor"], "node:ben-responsible-true");
    const report = check(input);
    expect(report.findings).toContainEqual(expect.objectContaining({ code: "PROOF_CYCLE", subjectIds: ["node:actor", "node:ben-responsible-true"], severity: "warning" }));
    expectUnderived(report);
  });

  it("T35 a self-supporting conclusion derives nothing", () => {
    const input = base({ unreleased: ["ben-in-killing", "knife-used"] });
    withEdge(input, "edge:self", ["node:ben-responsible-true"], "node:ben-responsible-true");
    const report = check(input);
    expect(report.findings).toContainEqual(expect.objectContaining({ code: "PROOF_CYCLE", subjectIds: ["node:ben-responsible-true"] }));
    expectUnderived(report);
  });

  it("T37 an independent path next to an unseeded cycle passes with a warning", () => {
    const input = base();
    withEdge(input, "edge:a", ["node:intended"], "node:ordinary", concl("ordinary", true));
    withEdge(input, "edge:b", ["node:ordinary"], "node:intended", concl("intended", true));
    const report = check(input);
    expect(report.status).toBe("pass");
    expect(report.findings.map((f) => [f.code, f.severity])).toEqual([["PROOF_CYCLE", "warning"]]);
  });

  it("T38 a seeded productive cycle passes without an artificial root", () => {
    const input = base({ scope: ["ben-responsible", "ben-actor"] });
    withEdge(input, "edge:a", ["node:ben-responsible-true"], "node:actor", concl("ben-actor", true));
    withEdge(input, "edge:b", ["node:actor"], "node:ben-responsible-true");
    const report = check(input);
    expect(report).toEqual({ status: "pass", findings: [], survivingAnswerCount: 1, competingAnswerSamples: [] });
  });

  it("T46 an independent alternative path passes", () => {
    const paths = [benPath, { conclusion: "ben-responsible", value: true, premises: ["ben-at-library"] }];
    const report = check(base({ paths, unreleased: ["knife-used"] }));
    expect(report.status).toBe("pass");
    expect(codes(report)).toEqual(["PREMISE_NOT_REACHED"]);
  });

  it("T47 deleting the only reachable path", () => {
    const paths = [benPath, { conclusion: "ben-responsible", value: true, premises: ["ben-at-library"] }];
    const input = base({ paths, unreleased: ["knife-used"] });
    input.edges = input.edges.filter((e: any) => e.id !== "edge:1");
    input.observations.at(-1).rules = input.observations.at(-1).rules.filter((r: any) => r.edgeId !== "edge:1");
    expectUnderived(check(input));
  });
});

describe("MYST-SOLVABILITY-0001 hypotheses and ambiguity (T48-T60, T65, T66)", () => {
  const twoDims = ["ben-responsible", "dora-responsible"];

  it("T48 all scoped truth hidden, no releases", () => {
    const input = base();
    input.witnessStepIds = [];
    const report = check(input);
    expect(report.status).toBe("fail");
    expect(errorCodes(report)).toEqual(["AMBIGUITY_POLICY_VIOLATION", "REQUIRED_AMBIGUOUS", "REQUIRED_NOT_DERIVED"]);
    expect(report.survivingAnswerCount).toBe(2);
  });

  it("T49/T50 must_disambiguate with an equally supported competing answer", () => {
    const report = check(base({ scope: twoDims }));
    expect(report.status).toBe("fail");
    expect(errorCodes(report)).toEqual(["AMBIGUITY_POLICY_VIOLATION"]);
    expect(report.survivingAnswerCount).toBe(2);
    expect(report.competingAnswerSamples).toEqual([
      [{ conclusionId: "conclusion:ben-responsible", value: true }, { conclusionId: "conclusion:dora-responsible", value: false }],
      [{ conclusionId: "conclusion:ben-responsible", value: true }, { conclusionId: "conclusion:dora-responsible", value: true }],
    ]);
  });

  it("T51 may_remain_ambiguous on a non-required dimension passes", () => {
    const report = check(base({ scope: twoDims, policy: "may_remain_ambiguous" }));
    expect(report.status).toBe("pass");
    expect(report.survivingAnswerCount).toBe(2);
  });

  it("T52 may_remain_ambiguous on a required dimension fails", () => {
    const report = check(base({ policy: "may_remain_ambiguous", unreleased: ["knife-used"] }));
    expect(errorCodes(report)).toEqual(["REQUIRED_AMBIGUOUS", "REQUIRED_NOT_DERIVED"]);
  });

  it("T53 switching must to may is never stricter", () => {
    const specs: ProfileSpec[] = [{}, { scope: twoDims }, { unreleased: ["knife-used"] }, { scope: twoDims, unreleased: ["ben-in-killing"] }];
    const rank = { fail: 0, unknown: 1, pass: 2 };
    for (const spec of specs) {
      const must = check(base({ ...spec, policy: "must_disambiguate" }));
      const may = check(base({ ...spec, policy: "may_remain_ambiguous" }));
      expect(rank[may.status]).toBeGreaterThanOrEqual(rank[must.status]);
    }
  });

  it("T54 the private canonical answer never eliminates a competitor", () => {
    // dora-responsible is canonically false, but nothing released proves it.
    expect(check(base({ scope: twoDims })).survivingAnswerCount).toBe(2);
    const proven = base({ scope: twoDims, paths: [benPath, { conclusion: "dora-responsible", value: false, premises: ["anna-at-library"] }] });
    expect(check(proven)).toEqual({ status: "pass", findings: [], survivingAnswerCount: 1, competingAnswerSamples: [] });
  });

  it("T55 missing positive required proof", () => {
    expect(codes(check(base({ unreleased: ["ben-in-killing"] })))).toContain("REQUIRED_NOT_DERIVED");
  });

  it("T56/T57 a negative required literal needs an explicit proof, absence is not negation", () => {
    const required = [
      { conclusionId: "conclusion:ben-responsible", value: true },
      { conclusionId: "conclusion:dora-responsible", value: false },
    ];
    const w = world({ required });
    const report = check(base({ scope: twoDims }, w), undefined, w);
    expect(report.findings).toContainEqual(expect.objectContaining({ code: "REQUIRED_NOT_DERIVED", subjectIds: ["conclusion:dora-responsible"] }));
    const proven = base({ scope: twoDims, paths: [benPath, { conclusion: "dora-responsible", value: false, premises: ["anna-at-library"] }] }, w);
    expect(check(proven, undefined, w).status).toBe("pass");
  });

  it("T58 deriving the wrong polarity is noncanonical", () => {
    const report = check(base({ paths: [{ conclusion: "ben-responsible", value: false, premises: ["knife-used"] }, benPath] }));
    expect(report.findings).toContainEqual(expect.objectContaining({ code: "NONCANONICAL_INFERENCE", subjectIds: ["edge:0"] }));
    expect(report.status).toBe("fail");
  });

  it("T59 extra true irrelevant evidence does not worsen solvability", () => {
    const report = check(base({ paths: [benPath, { conclusion: "intended", value: true, premises: ["ben-at-library"] }] }));
    expect(report.status).toBe("pass");
  });

  it("T60 extra unreachable evidence does not create a pass", () => {
    const report = check(base({ paths: [benPath, { conclusion: "ben-responsible", value: true, premises: ["ben-at-library"] }], unreleased: ["knife-used", "ben-at-library"] }));
    expect(report.status).toBe("fail");
  });

  it("T65 all 2^n vectors are generated", () => {
    const scope = ["anna-responsible", "ben-responsible", "clara-responsible", "dora-responsible", "nobody-responsible", "ben-actor"];
    const input = base({ scope, policy: "may_remain_ambiguous" });
    input.witnessStepIds = [];
    const report = check(input);
    expect(report.survivingAnswerCount).toBe(64);
    expect(report.competingAnswerSamples).toHaveLength(4);
    expect(report.competingAnswerSamples[0]!.map((d) => d.value)).toEqual([false, false, false, false, false, false]);
    expect(report.competingAnswerSamples[1]!.map((d) => d.value)).toEqual([false, false, false, false, false, true]);
    expect(report.competingAnswerSamples[0]!.map((d) => d.conclusionId)).toEqual([...input.answerScope].sort());
  });

  it("T66 hypothesis order is deterministic and scope-order independent", () => {
    const scope = ["nobody-responsible", "ben-responsible", "anna-responsible"];
    const forward = check(base({ scope, policy: "may_remain_ambiguous" }));
    const backward = check(base({ scope: [...scope].reverse(), policy: "may_remain_ambiguous" }));
    expect(backward).toEqual(forward);
    expect(forward.survivingAnswerCount).toBe(4);
  });
});

describe("MYST-SOLVABILITY-0001 responsibility questions (T61-T64, T67-T70)", () => {
  const all = ["anna-responsible", "ben-responsible", "clara-responsible", "dora-responsible", "nobody-responsible"];
  const full = { kind: "identify_all_responsible", eventId: "event:ben-kills-clara" };
  const negatives = ["anna", "clara", "dora", "nobody"].map((p) => ({ conclusion: `${p}-responsible`, value: false, premises: ["anna-at-library"] }));

  it("full answer with every dimension proven passes", () => {
    expect(check(base({ scope: all, question: full, paths: [benPath, ...negatives] }))).toEqual({
      status: "pass",
      findings: [],
      survivingAnswerCount: 1,
      competingAnswerSamples: [],
    });
  });

  it("T61 multiple responsible persons must both be proven", () => {
    const w = world({
      editSolution: (s) => s.resolutions[0].responsibility.assignments.push({ personId: "person:dora", roles: ["planner"] }),
      required: [{ conclusionId: "conclusion:ben-responsible", value: true }, { conclusionId: "conclusion:dora-responsible", value: true }],
    });
    const scope = ["ben-responsible", "dora-responsible"];
    expect(codes(check(base({ scope }, w), undefined, w))).toContain("REQUIRED_NOT_DERIVED");
    const both = base({ scope, paths: [benPath, { conclusion: "dora-responsible", value: true, premises: ["knife-used"] }] }, w);
    expect(check(both, undefined, w).status).toBe("pass");
  });

  it("T62 planner and actor are not interchangeable", () => {
    const w = world({ required: [{ conclusionId: "conclusion:ben-planner", value: false }] });
    const actorOnly = base({ scope: ["ben-planner", "ben-actor"], paths: [{ conclusion: "ben-actor", value: true, premises: ["knife-used"] }] }, w);
    expect(codes(check(actorOnly, undefined, w))).toContain("REQUIRED_NOT_DERIVED");
    const swapped = base({ scope: ["ben-planner"], paths: [{ conclusion: "ben-planner", value: true, premises: ["knife-used"] }] }, w);
    expect(codes(check(swapped, undefined, w))).toContain("NONCANONICAL_INFERENCE");
  });

  it("T63 complete 'nobody' responsibility is derivable", () => {
    const w = world({
      editSolution: (s) => (s.resolutions[0].responsibility.assignments = []),
      required: [{ conclusionId: "conclusion:nobody-responsible", value: true }],
    });
    const input = base({ scope: ["nobody-responsible"], paths: [{ conclusion: "nobody-responsible", value: true, premises: ["anna-at-library"] }] }, w);
    expect(check(input, undefined, w).status).toBe("pass");
  });

  it("T64 partial 'nobody' stays unresolved in both polarities", () => {
    const w = world({ completeness: "partial", editSolution: (s) => (s.resolutions[0].responsibility.assignments = []), required: [{ conclusionId: "conclusion:intended", value: true }] });
    for (const value of [true, false]) {
      const input = base({ scope: ["intended", "nobody-responsible"], paths: [{ conclusion: "intended", value: true, premises: ["knife-used"] }, { conclusion: "nobody-responsible", value, premises: ["anna-at-library"] }] }, w);
      expect(codes(check(input, undefined, w))).toContain("NONCANONICAL_INFERENCE");
    }
  });

  it("T67 full responsibility question with a partial key", () => {
    const partial = world({ completeness: "partial" });
    const report = check(base({ scope: all, question: full, paths: [benPath] }, partial), undefined, partial);
    expect(codes(report)).toContain("FULL_ANSWER_INCOMPLETE");
  });

  it("T68 a positive actor that is not required", () => {
    const w = world({ required: [{ conclusionId: "conclusion:anna-responsible", value: false }] });
    const report = check(base({ scope: all, question: full, paths: [benPath, ...negatives] }, w), undefined, w);
    expect(report.findings).toContainEqual(expect.objectContaining({ code: "POSITIVE_ANSWER_NOT_REQUIRED", subjectIds: ["conclusion:ben-responsible"] }));
  });

  it("T69/T70 a missing person candidate or missing nobody claim", () => {
    for (const missing of ["dora-responsible", "nobody-responsible"]) {
      const report = check(base({ scope: all.filter((id) => id !== missing), question: full, paths: [benPath, ...negatives] }));
      expect(report.findings).toContainEqual(expect.objectContaining({ code: "ANSWER_SCOPE_INVALID_FOR_QUESTION", subjectIds: [`conclusion:${missing}`] }));
    }
    const noCatalog = world({ editSolution: (s) => (s.conclusions = s.conclusions.filter((c: any) => c.id !== "conclusion:clara-responsible")) });
    const report = check(base({ scope: all.filter((id) => id !== "clara-responsible"), question: full, paths: [benPath, ...negatives.filter((n) => n.conclusion !== "clara-responsible")] }, noCatalog), undefined, noCatalog);
    expect(report.findings).toContainEqual(expect.objectContaining({ code: "ANSWER_SCOPE_INVALID_FOR_QUESTION", subjectIds: ["person:clara"] }));
  });
});

describe("MYST-SOLVABILITY-0001 immutability and determinism (T76, T77, T80)", () => {
  it("T76 mutating the input after parsing leaves the profile unchanged", () => {
    const input = base();
    const profile = parse(input);
    const before = JSON.stringify(profile);
    input.edges[0].to = "node:rules";
    input.witnessStepIds.reverse();
    input.observations[0].literal.value = false;
    expect(JSON.stringify(profile)).toBe(before);
    expect(Object.isFrozen(profile.edges[0])).toBe(true);
  });

  it("T77 output mutation attempts throw", () => {
    const report = check(base({ scope: ["ben-responsible", "dora-responsible"] }));
    expect(() => {
      (report as { status: string }).status = "pass";
    }).toThrow(TypeError);
    expect(() => {
      (report.findings as unknown[]).push({});
    }).toThrow(TypeError);
    expect(() => {
      (report.competingAnswerSamples[0] as unknown as { value: boolean }[])[0]!.value = false;
    }).toThrow(TypeError);
  });

  it("T80 repeated inputs give deeply equal reports", () => {
    for (const spec of [{}, { scope: ["ben-responsible", "dora-responsible"] }, { unreleased: ["knife-used"] }] as ProfileSpec[]) {
      expect(check(base(spec))).toEqual(check(base(spec)));
    }
  });

  it("findings are sorted by code, path, subjects, related IDs", () => {
    const input = base({ unreleased: ["ben-in-killing", "knife-used"] });
    withEdge(input, "edge:self", ["node:ben-responsible-true"], "node:ben-responsible-true");
    const keys = check(input).findings.map((f) => JSON.stringify([f.code, f.path, f.subjectIds, f.relatedIds]));
    expect(keys).toEqual([...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
    expect(keys.length).toBeGreaterThan(2);
  });

  it("parse never mutates its input and inputs are not frozen", () => {
    const input = base();
    const snapshot = structuredClone(input);
    parse(input);
    expect(input).toEqual(snapshot);
    expect(Object.isFrozen(input.edges)).toBe(false);
    expect(RELEASE_HASH).toMatch(/^[0-9a-f]{64}$/);
  });
});
