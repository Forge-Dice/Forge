import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkCaseFolder } from "../src/authoring/check-case.ts";
import { PLAY_CASES, loadPlayPackage } from "../src/play/cases.ts";
import { command, newGame, type Game } from "../src/play/game.ts";

// "Die verstummte Geige" (case:verstummte-geige): third case, written from scratch against
// check-case only. Five suspects; Ida took the violin. Kurt's alibi card (the switch cabinet) is
// reachable two ways: Kurt reveals the cabinet when asked, or the maintenance plan in the cellar
// mentions it.

const DIR = new URL("./fixtures/geige/", import.meta.url).pathname;
const scratch = mkdtempSync(join(tmpdir(), "geige-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
const PLACEHOLDER = "TO_BE_COMPUTED_FROM_FINAL_ARTIFACT";

/** Copy of the case whose certified witness is exactly `steps` (manifest steps and profile). */
function withWitness(steps: string[]): string {
  const dir = join(scratch, steps.join("+") || "empty");
  cpSync(DIR, dir, { recursive: true });
  const edit = (file: string, change: (json: any) => void) => {
    const json = JSON.parse(readFileSync(join(dir, file), "utf8"));
    change(json);
    writeFileSync(join(dir, file), JSON.stringify(json));
  };
  edit("release-manifest.json", (m) => {
    m.releaseContextHash = PLACEHOLDER;
    m.certificateData.steps = steps.map((id) => m.certificateData.steps.find((s: any) => s.stepId === id));
  });
  edit("proof-profile.json", (p) => {
    p.bindings.releaseHash = PLACEHOLDER;
    p.witnessStepIds = steps;
  });
  return dir;
}

describe("Die verstummte Geige: authored against check-case", () => {
  it("is valid and solvable as committed, with every hash filled in", () => {
    const check = checkCaseFolder(DIR);
    expect(check.problems).toEqual([]);
    expect(check.filled).toEqual([]);
    expect(check.solvability).toMatchObject({ status: "pass", survivingAnswerCount: 1 });
  });

  it("route A (Kurt reveals the cabinet) and route B (cellar plan) each solve it alone", () => {
    for (const route of [
      ["search-foyer", "ask-kurt-keller", "read-schaltschrank", "search-loge"],
      ["search-keller", "read-schaltschrank", "search-loge", "search-foyer"],
    ]) {
      const check = checkCaseFolder(withWitness(route));
      expect(check.problems.filter((p) => p.severity === "error"), route.join(",")).toEqual([]);
      expect(check.solvability?.status).toBe("pass");
    }
  });

  it("without the cabinet Kurt is not excluded: Ida and Kurt stay open (4 vectors over their two literals)", () => {
    const check = checkCaseFolder(withWitness(["search-foyer", "search-loge"]));
    expect(check.ok).toBe(false);
    expect(check.solvability).toMatchObject({ status: "fail", survivingAnswerCount: 4 });
  });

  it("reading the cabinet before anyone mentions it is rejected", () => {
    const check = checkCaseFolder(withWitness(["read-schaltschrank", "search-keller", "search-foyer", "search-loge"]));
    expect(check.ok).toBe(false);
  });
});

describe("npm run play -- geige", () => {
  const pkg = loadPlayPackage("geige");
  const numberOf = (listing: string, needle: string) => {
    const line = listing.split("\n").find((l) => l.includes(needle));
    if (line === undefined) throw new Error(`"${needle}" not offered in:\n${listing}`);
    return line.trim().split(".")[0]!;
  };
  function player() {
    let game: Game = newGame(pkg, PLAY_CASES.geige.clockOrigin);
    return (line: string) => {
      const step = command(game, line);
      game = step.game;
      return step.text;
    };
  }

  it("plays route B to the solution; the grey hair points at the wrong person", () => {
    const say = player();
    const u = say("u");
    expect(u).not.toContain("Schaltschrank");
    expect(say(`u ${numberOf(u, "Solistengarderobe")}`)).toContain("graues Haar");
    expect(say(`u ${numberOf(u, "Heizungskeller")}`)).toContain("Fund: Wartungsplan");
    expect(say(`u ${numberOf(say("u"), "Schaltschrank")}`)).toContain("Kurt Mohn war um 20:40:00 am Ort „Heizungskeller“");
    expect(say(`u ${numberOf(u, "Foyer")}`)).toContain("Paul Adler war um 20:40:00 am Ort „Foyer“");
    expect(say(`u ${numberOf(u, "Ehrenloge")}`)).toContain("Henrik Sand war um 20:40:00 am Ort „Ehrenloge“");
    const a = say("a");
    expect(a.split("\n").filter((l) => /^\s+\d+\./.test(l))).toHaveLength(5);
    expect(say(`a ${numberOf(a, "Paul Adler")}`)).toContain("noch nicht");
    const solved = say(`a ${numberOf(a, "Ida Reiner")}`);
    expect(solved).toContain("Fall gelöst");
    expect(solved).toContain("=== Auflösung ===\nIda Reiner gesteht.");
  });

  it("route A: Kurt's answer makes the cabinet examinable", () => {
    const say = player();
    expect(say(`f ${numberOf(say("f"), "Was haben Sie im Heizungskeller gemacht?")}`)).toContain("„Ja.“");
    expect(say("u")).toContain("Gegenstand untersuchen: Schaltschrank");
  });
});
