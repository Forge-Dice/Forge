import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkCaseFolder } from "../src/authoring/check-case.ts";
import { PLAY_CASES, loadPlayPackage } from "../src/play/cases.ts";
import { accusations, command, newGame, type Game } from "../src/play/game.ts";

// "Das dunkle Leuchtfeuer" (case:leuchtfeuer), showcase case 6: six suspects, the culprit Knut is a
// late suspect introduced only by the boat on the west beach (or Ole's answer); three certified
// routes; Ole and Jasper lie and give in when confronted; Marlene honestly mistakes Knut's light for
// Hinrich's; Hinrich's pipe and key in the lantern room are the false lead; two alibis hold only
// with the 25-minute dyke rule.

const DIR = new URL("./fixtures/leuchtfeuer/", import.meta.url).pathname;
const scratch = mkdtempSync(join(tmpdir(), "leuchtfeuer-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
const PLACEHOLDER = "TO_BE_COMPUTED_FROM_FINAL_ARTIFACT";

/** Copy of the case whose only certified route is `steps` (taken from the manifest's steps). */
function withWitness(steps: string[]): string {
  const dir = join(scratch, steps.join("+"));
  cpSync(DIR, dir, { recursive: true });
  const edit = (file: string, change: (json: any) => void) => {
    const json = JSON.parse(readFileSync(join(dir, file), "utf8"));
    change(json);
    writeFileSync(join(dir, file), JSON.stringify(json));
  };
  edit("release-manifest.json", (m) => {
    m.releaseContextHash = PLACEHOLDER;
    m.certificateData.steps = steps.map((id) => m.certificateData.steps.find((s: any) => s.stepId === id));
    delete m.certificateData.routes;
  });
  edit("proof-profile.json", (p) => {
    p.bindings.releaseHash = PLACEHOLDER;
    p.witnessStepIds = steps;
  });
  return dir;
}

function player() {
  let game: Game = newGame(loadPlayPackage("leuchtfeuer"), PLAY_CASES.leuchtfeuer.clockOrigin);
  const say = (line: string) => {
    const step = command(game, line);
    game = step.game;
    return step.text;
  };
  const pick = (menu: string, needle: string) => {
    const listing = say(menu);
    const line = listing.split("\n").find((l) => l.includes(needle));
    if (line === undefined) throw new Error(`"${needle}" not offered in:\n${listing}`);
    return say(`${menu} ${line.trim().split(".")[0]}`);
  };
  return { say, pick, game: () => game };
}

describe("Das dunkle Leuchtfeuer: check-case", () => {
  it("is valid and solvable on all three certified routes, every hash filled in", () => {
    const check = checkCaseFolder(DIR);
    expect(check.problems).toEqual([]);
    expect(check.filled).toEqual([]);
    expect(check.routes.map((r) => [r.routeId, r.report.status, r.report.survivingAnswerCount])).toEqual([
      ["witness", "pass", 1],
      ["befragen", "pass", 1],
      ["vorhalten", "pass", 1],
    ]);
  });

  it("without the boat on the west beach the five alibis do not convict anyone", () => {
    const check = checkCaseFolder(withWitness(["search-faehrhaus", "read-telefon", "search-hafen", "read-pegel", "search-vogelwarte"]));
    expect(check.ok).toBe(false);
    expect(check.solvability?.status).toBe("fail");
  });

  it("without the village records (cash book, call log) Hinrich, Jasper and Frauke stay open", () => {
    const check = checkCaseFolder(withWitness(["search-laterne", "search-strand", "search-hafen", "read-pegel", "search-vogelwarte"]));
    expect(check.ok).toBe(false);
  });
});

describe("npm run play -- leuchtfeuer", () => {
  it("Knut is not offered for accusation until a find introduces him", () => {
    const { pick, game } = player();
    expect(accusations(game()).map((a) => a.label)).toEqual(["Hinrich Paulsen", "Frauke Jensen", "Ole Brodersen", "Marlene Voss", "Jasper Kühl"]);
    pick("u", "Laternenraum");
    expect(pick("u", "Weststrand")).toContain("Knut Sievers war um 00:40:00 am Ort „Weststrand“");
    expect(accusations(game()).map((a) => a.label)).toContain("Knut Sievers");
  });

  it("Ole's answer is a second way to learn of Knut and the west beach", () => {
    const { pick, say } = player();
    expect(pick("f", "Lag heute Nacht ein fremdes Boot")).toContain("Keins von hier.");
    expect(say("u")).toContain("Weststrand");
    expect(say("a")).toContain("Knut Sievers");
  });

  it("plays to the solution: false lead, honest mistake, two broken lies", () => {
    const { pick } = player();
    expect(pick("u", "Laternenraum")).toContain("Meerschaumpfeife");
    expect(pick("f", "Marlene Voss: War Hinrich Paulsen")).toContain("Ich glaube schon");
    expect(pick("a", "Hinrich Paulsen")).toContain("noch nicht");
    expect(pick("f", "Ole Brodersen: Waren Sie um 02:00 zu Hause?")).toContain("Klar war ich zu Hause.");
    pick("u", "Weststrand");
    expect(pick("f", "Jasper Kühl: Waren Sie um 01:00 am Weststrand?")).toContain("Um eins habe ich geschlafen.");
    expect(pick("v", "vorhalten: Schlauchboot")).not.toContain("gibt nach");
    expect(pick("v", "Jasper Kühl zu „Waren Sie um 01:00 am Weststrand?“ vorhalten: Visitenkarte")).toContain("gibt nach: „Also schön. Ja, um eins war ich am Weststrand.“");
    expect(pick("u", "Fährhaus")).toContain("Hinrich Paulsen war um 01:45:00 am Ort „Fährhaus“");
    expect(pick("u", "Telefon")).toContain("Jasper Kühl war um 02:03:00 am Ort „Fährhaus“");
    pick("u", "Hafen");
    expect(pick("u", "Pegelkamera")).toContain("Ole Brodersen war um 02:00:00 am Ort „Hafen“");
    expect(pick("v", "Ole Brodersen zu „Waren Sie um 02:00 zu Hause?“ vorhalten: Pegelfoto")).toContain("gibt nach: „Na gut. Nee, um zwei war ich nicht zu Hause.“");
    expect(pick("u", "Vogelwarte")).toContain("Marlene Voss war um 02:00:00 am Ort „Vogelwarte“");
    expect(pick("f", "Knut Sievers: Waren Sie")).toContain("Dazu sag ich nichts. Gar nichts.");
    const solved = pick("a", "Knut Sievers");
    expect(solved).toContain("Fall gelöst");
    expect(solved).toContain("=== Auflösung ===");
  });
});
