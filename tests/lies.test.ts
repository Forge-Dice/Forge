import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkCaseFolder, type CaseCheck } from "../src/authoring/check-case.ts";
import { resolveCasePackage } from "../src/domain/case-package.ts";
import { checkCaseSolvability } from "../src/domain/case-solvability.ts";
import { parseInterrogationProfile, parseQuestionCatalogue, profileLies } from "../src/domain/interrogation-authoring.ts";
import { PLAY_CASES, loadPlayPackage, playPackageInput, refSource } from "../src/play/cases.ts";
import { command, newGame } from "../src/play/game.ts";
import { BRIEF, briefProofProfile, briefRaw, briefSolution, briefTruth, briefWitness, resolveBriefPackage } from "./brieffoeffner.fixture.ts";

// Lies (ruleset mystery-session-v2): authored as act "lie", invisible to the player, never a premise
// of the solvability proof, and LIE_ONLY_PATH when the solution would hinge on one.

const FIXTURE = new URL("./fixtures/brieffoeffner/", import.meta.url).pathname;
const scratch = mkdtempSync(join(tmpdir(), "lies-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

let n = 0;
function variant(edits: Record<string, (json: any) => void>): string {
  const dir = join(scratch, `v${n++}`);
  cpSync(FIXTURE, dir, { recursive: true });
  for (const [file, edit] of Object.entries(edits)) {
    const json = JSON.parse(readFileSync(join(dir, file), "utf8"));
    edit(json);
    writeFileSync(join(dir, file), JSON.stringify(json));
  }
  return dir;
}
const errorAt = (check: CaseCheck, file: string, field: string) =>
  check.problems.find((p) => p.severity === "error" && p.file === file && p.field === field);

const truth = briefTruth();
const catalogue = () => parseQuestionCatalogue(briefRaw("questions.json"), truth);

describe("authoring a lie", () => {
  it("Ben's two lies are the false literals he states", () => {
    const profile = parseInterrogationProfile(briefRaw("interrogation-ben.json"), truth, catalogue());
    expect(profileLies(profile, truth)).toEqual([
      { npcId: "person:ben", questionId: "question:q01", literal: { kind: "proposition", propositionId: "proposition:ben-at-murder", value: false } },
      { npcId: "person:ben", questionId: "question:q02", literal: { kind: "proposition", propositionId: "proposition:anna-at-murder", value: true } },
    ]);
  });

  it("a lie that is true, or about no proposition of the truth, is an author error with file and field", () => {
    const sincere = checkCaseFolder(variant({ "interrogation-ben.json": (p) => (p.rules[0].stance = "affirms") }));
    expect(errorAt(sincere, "interrogation-ben.json", "rules[0].stance")?.message).toMatch(/contradict the truth/);
    const vague = checkCaseFolder(variant({ "interrogation-ben.json": (p) => (p.rules[3] = { ...p.rules[3], act: "lie", stance: "denies", claim: { ...p.rules[3].claim, at: 1000 } }) }));
    expect(errorAt(vague, "interrogation-ben.json", "rules[3].claim")?.message).toMatch(/proposition of the truth/);
  });

  it("a lie needs an NPC who holds the truth; otherwise it is an honest mistake", () => {
    const check = checkCaseFolder(
      variant({ "npc-ben.json": (s) => (s.attitudes = s.attitudes.filter((a: any) => a.subject.id !== "proposition:ben-at-murder")) }),
    );
    expect(errorAt(check, "interrogation-ben.json", "rules[0].claim")?.message).toMatch(/keine Lüge/);
  });

  it("a v1 package with a lie is rejected; the same files resolve under v2", () => {
    const input = { ...playPackageInput(BRIEF), rulesetVersion: "mystery-session-v1" };
    const v1 = resolveCasePackage(input, refSource(briefRaw("truth.json"), BRIEF.salt));
    expect(v1.ok).toBe(false);
    if (!v1.ok) expect(v1.findings).toContainEqual({ code: "RULESET", path: ["npcs", 1, "profile", "rules", 0, "act"] });
    expect(loadPlayPackage("brieföffner").identity.rulesetVersion).toBe("mystery-session-v2");
  });
});

describe("existing cases stay valid unchanged", () => {
  it("the Vitrine is still v1 with exactly its previous package identity", () => {
    expect(PLAY_CASES.vitrine.rulesetVersion).toBe("mystery-session-v1");
    expect(loadPlayPackage("vitrine").identity).toEqual({
      schemaVersion: 1,
      packageHash: "b1dd6757491756b3cc3f1e2aa0519d900430be5317f8745d37f5457ee261c704",
      rulesetVersion: "mystery-session-v1",
    });
  });
});

describe("solvability never trusts a lie", () => {
  const pkg = resolveBriefPackage();
  const solution = briefSolution(truth);
  const lies = loadPlayPackage("brieföffner").npcs.flatMap(({ profile }) => profileLies(profile, truth));

  it("the witness releases Ben's denial; the proof passes on the evidence alone", () => {
    const replay = briefWitness(pkg)(briefProofProfile().witnessStepIds);
    expect(replay.success && replay.released.map((o) => o.id)).toContain("reported:ben-denies");
    expect(checkCaseSolvability(truth, solution, briefProofProfile(), briefWitness(pkg), { lies }).status).toBe("pass");
  });

  // Variant: the cuff button is unreachable and a published rule accuses whoever denies being there.
  const lieOnly = () =>
    variant({
      "evidence-access.json": (a) => (a.entries[0].access = { kind: "inaccessible" }),
      "proof-profile.json": (p) => {
        p.observations.find((o: any) => o.id === "public-rule:participation").rules[0].allOf = ["observation:ben-denies"];
        p.nodes.push({ id: "observation:ben-denies", kind: "observation", observationId: "reported:ben-denies" });
        p.edges.find((e: any) => e.id === "responsible:ben").allOf = ["observation:ben-denies", "license:participation"];
        p.witnessStepIds = p.witnessStepIds.filter((id: string) => id !== "confront-ben"); // no cuff, no confrontation
      },
      "release-manifest.json": (m) => {
        const rule = m.certificateData.observations.find((o: any) => o.id === "public-rule:participation");
        rule.rules[0].allOf = ["observation:ben-denies"];
        rule.afterObservations = ["reported:ben-denies"];
        m.certificateData.steps = m.certificateData.steps.filter((s: any) => s.stepId !== "confront-ben");
      },
    });

  it("reports LIE_ONLY_PATH when the solution hinges on a lie, and flags the ignored report", () => {
    const check = checkCaseFolder(lieOnly());
    expect(check.ok).toBe(false);
    expect(check.solvability?.status).toBe("fail");
    const codes = check.solvability!.findings.map((f) => `${f.code}:${f.severity}`);
    expect(codes).toContain("LIE_ONLY_PATH:error");
    expect(codes).toContain("LIED_REPORT_IGNORED:warning");
    expect(codes).not.toContain("REQUIRED_NOT_DERIVED:error");
    expect(check.solvability!.survivingAnswerCount).toBe(2);
    expect(errorAt(check, "proof-profile.json", "requiredConclusions[0]")?.message).toMatch(/LIE_ONLY_PATH \(conclusion:ben-responsible\)/);
  });
});

describe("the player never sees a lie marker", () => {
  it("in the CLI Ben's lie reads like any answer", () => {
    const game = newGame(loadPlayPackage("brieföffner"), BRIEF.clockOrigin);
    const listing = command(game, "f").text;
    const line = listing.split("\n").find((l) => l.includes("Ben") && l.includes("Waren Sie bei Claras Tod dabei?"))!;
    const step = command(game, `f ${line.trim().split(".")[0]}`);
    expect(step.text).toContain("„Nein.“");
    expect(step.text).not.toMatch(/lüg|lie\b|falsch/i);
  });
});
