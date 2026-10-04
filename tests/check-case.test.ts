import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkCaseFolder, formatCaseCheck, type CaseCheck } from "../src/authoring/check-case.ts";

const FIXTURES = new URL("./fixtures/", import.meta.url).pathname;
const VITRINE = join(FIXTURES, "vitrine");
const BRIEF = join(FIXTURES, "brieffoeffner");
const scratch = mkdtempSync(join(tmpdir(), "check-case-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

let n = 0;
/** Copy of a fixture folder with JSON edits applied (file name → mutate parsed JSON). */
function variant(base: string, edits: Record<string, (json: any) => void> = {}, raw: Record<string, string | null> = {}): string {
  const dir = join(scratch, `v${n++}`);
  cpSync(base, dir, { recursive: true });
  for (const [file, edit] of Object.entries(edits)) {
    const json = JSON.parse(readFileSync(join(dir, file), "utf8"));
    edit(json);
    writeFileSync(join(dir, file), JSON.stringify(json));
  }
  for (const [file, text] of Object.entries(raw)) {
    if (text === null) unlinkSync(join(dir, file));
    else writeFileSync(join(dir, file), text);
  }
  return dir;
}

const errors = (check: CaseCheck) => check.problems.filter((p) => p.severity === "error").map((p) => `${p.file} › ${p.field}`);
function expectError(check: CaseCheck, file: string, field: string, message?: RegExp) {
  expect(check.ok).toBe(false);
  const match = check.problems.find((p) => p.severity === "error" && p.file === file && p.field === field);
  expect(match, `${file} › ${field} in ${JSON.stringify(errors(check))}`).toBeDefined();
  if (message) expect(match!.message).toMatch(message);
}

describe("check-case on the real fixtures", () => {
  it.each([["vitrine", VITRINE], ["brieföffner", BRIEF], ["geige", join(FIXTURES, "geige")], ["hüttenkasse", join(FIXTURES, "huettenkasse")], ["nachtzug", join(FIXTURES, "nachtzug")]])("%s is valid and solvable", (_name, dir) => {
    const check = checkCaseFolder(dir);
    expect(check.problems.filter((p) => p.severity === "error")).toEqual([]);
    expect(check.solvability).toMatchObject({ status: "pass", survivingAnswerCount: 1 });
    expect(check.ok).toBe(true);
    expect(check.problems.some((p) => p.field === "epilogue")).toBe(false);
    expect(formatCaseCheck(check)).toMatch(/OK: \d+ Dateien geprüft, Fall lösbar\./);
  });
});

describe("check-case names file and field for broken cases", () => {
  it("a missing folder or file", () => {
    expectError(checkCaseFolder(join(scratch, "nope")), join(scratch, "nope"), "(Ordner)");
    expectError(checkCaseFolder(variant(BRIEF, {}, { "challenge.json": null })), "challenge.json", "(Datei)", /fehlt/);
  });

  it("invalid JSON", () => {
    expectError(checkCaseFolder(variant(BRIEF, {}, { "solution.json": "{ kaputt" })), "solution.json", "(Datei)", /kein gültiges JSON/);
  });

  it("a truth schema error points at the field", () => {
    expectError(checkCaseFolder(variant(BRIEF, { "truth.json": (t) => (t.persons[1].id = "ben") })), "truth.json", "persons[1].id");
  });

  it("a semantic finding of the truth", () => {
    const check = checkCaseFolder(variant(BRIEF, { "truth.json": (t) => (t.propositions[0].truth = false) }));
    expect(check.ok).toBe(false);
    expect(check.problems.some((p) => p.file === "truth.json" && p.field.includes("proposition:ben-at-murder"))).toBe(true);
  });

  it("solution: unknown required conclusion", () => {
    const check = checkCaseFolder(variant(BRIEF, { "solution.json": (s) => (s.requiredConclusions[0].conclusionId = "conclusion:ghost") }));
    expect(check.ok).toBe(false);
    expect(errors(check).some((e) => e.startsWith("solution.json › requiredConclusions[0]"))).toBe(true);
  });

  it("presentation: text over the limit", () => {
    expectError(
      checkCaseFolder(variant(BRIEF, { "evidence-presentation.json": (p) => (p.entries[0].text = "x".repeat(1001)) })),
      "evidence-presentation.json",
      "entries[0].text",
    );
  });

  it("profile: question not in the catalogue", () => {
    const check = checkCaseFolder(variant(BRIEF, { "interrogation-ben.json": (p) => (p.rules[1].questionId = "question:q99") }));
    expect(check.ok).toBe(false);
    expect(errors(check).some((e) => e.startsWith("interrogation-ben.json › rules[1]"))).toBe(true);
  });

  it("NPC snapshot bound to another truth", () => {
    expectError(checkCaseFolder(variant(BRIEF, { "npc-anna.json": (s) => (s.truthHash = "0".repeat(64)) })), "npc-anna.json", "truthHash");
  });

  it("an NPC without profile", () => {
    expectError(checkCaseFolder(variant(BRIEF, {}, { "interrogation-anna.json": null })), "npc-anna.json", "(Datei)", /interrogation-anna\.json fehlt/);
  });

  it("initial setup: unknown entity (package binding)", () => {
    const check = checkCaseFolder(variant(BRIEF, { "initial-setup.json": (i) => i.known.push({ kind: "person", id: "person:dora" }) }));
    expect(check.ok).toBe(false);
    expect(errors(check).some((e) => e.startsWith("initial-setup.json"))).toBe(true);
  });

  it("public content: question text for a question the NPC does not have", () => {
    const check = checkCaseFolder(variant(BRIEF, { "public-content.json": (p) => (p.questionTexts[4].questionId = "question:q05") }));
    expect(check.ok).toBe(false);
    expect(errors(check).some((e) => e.startsWith("public-content.json › questionTexts"))).toBe(true);
  });

  it("public content: an epilogue that breaks the player text rules", () => {
    const id = checkCaseFolder(variant(BRIEF, { "public-content.json": (p) => (p.epilogue = "Ben (person:ben) war es.") }));
    expectError(id, "public-content.json", "epilogue");
    const long = checkCaseFolder(variant(BRIEF, { "public-content.json": (p) => (p.epilogue = "x".repeat(4001)) }));
    expectError(long, "public-content.json", "epilogue");
    const blank = checkCaseFolder(variant(BRIEF, { "public-content.json": (p) => (p.epilogue = "  ") }));
    expectError(blank, "public-content.json", "epilogue");
  });

  it("public content: a missing epilogue is only a warning", () => {
    const check = checkCaseFolder(variant(BRIEF, { "public-content.json": (p) => delete p.epilogue }));
    expect(check.ok).toBe(true);
    expect(check.problems).toContainEqual(expect.objectContaining({ file: "public-content.json", field: "epilogue", severity: "warning" }));
  });

  it("release manifest: $playerRefOf on an unknown entity", () => {
    expectError(
      checkCaseFolder(variant(BRIEF, { "release-manifest.json": (m) => (m.certificateData.steps[0].event.target.$playerRefOf.id = "location:cellar") })),
      "release-manifest.json",
      "certificateData.steps[0].event.target",
      /location:cellar/,
    );
  });

  it("proof profile: a stale release hash", () => {
    expectError(
      checkCaseFolder(variant(BRIEF, { "proof-profile.json": (p) => (p.bindings.releaseHash = "a".repeat(64)) })),
      "proof-profile.json",
      "bindings.releaseHash",
      /veraltet/,
    );
  });

  it("solvability fails when the decisive evidence is unreachable", () => {
    const check = checkCaseFolder(variant(BRIEF, { "evidence-access.json": (a) => (a.entries[0].access = { kind: "inaccessible" }) }));
    expect(check.solvability?.status).toBe("fail");
    expect(check.solvability?.survivingAnswerCount).toBe(2);
    expectError(check, "proof-profile.json", "(Lösbarkeit)", /fail/);
    expect(formatCaseCheck(check)).toContain("Lösbarkeit: FAIL");
  });

  it("a witness step of the wrong kind or out of order is rejected at the manifest", () => {
    expectError(
      checkCaseFolder(variant(BRIEF, { "release-manifest.json": (m) => (m.certificateData.steps[0].event.target.$playerRefOf = { kind: "item", id: "item:gloves" }) })),
      "release-manifest.json",
      "certificateData.steps[0].event.target",
    );
    const early = variant(BRIEF, {
      "release-manifest.json": (m) =>
        m.certificateData.steps.push({ stepId: "read-gloves", event: { type: "investigate", action: "examine_item", target: { $playerRefOf: { kind: "item", id: "item:gloves" } } } }),
      "proof-profile.json": (p) => (p.witnessStepIds = ["read-gloves", "search-library", "search-garden"]),
    });
    expectError(checkCaseFolder(early), "release-manifest.json", "certificateData.steps", /witnessStepIds/);
  });
});

describe("npm run check-case", () => {
  const cli = (...dirs: string[]) =>
    spawnSync(process.execPath, ["--experimental-transform-types", "--no-warnings", "src/authoring/check-case-cli.ts", ...dirs], { encoding: "utf8" });

  it("exits 0 for both fixtures and 1 with file and field for a broken one", () => {
    expect(cli(VITRINE, BRIEF).status).toBe(0);
    const broken = cli(variant(BRIEF, { "truth.json": (t) => (t.persons[1].id = "ben") }));
    expect(broken.status).toBe(1);
    expect(broken.stdout).toContain("FEHLER  truth.json › persons[1].id");
    expect(cli().status).toBe(2);
  }, 30_000);
});
