import { describe, expect, it } from "vitest";
import { checkCaseFolder } from "../src/authoring/check-case.ts";
import { PLAY_CASES, loadPlayPackage, playCaseName } from "../src/play/cases.ts";
import { accusations, command, newGame, type Game } from "../src/play/game.ts";

// "Der verschwundene Preiskürbis" (case:preiskuerbis), case 7, a light comedy: six suspects, the
// culprit Ferdl is a late suspect (the drag trail to the car park, or Resi's answer); three certified
// routes; Sepp and Ferdl lie and give in when confronted; Lotte honestly suspects the mayor; Hilde's
// gloves in the weighing tent are the false lead; every NPC answers in their own words.

const DIR = new URL("./fixtures/preiskuerbis/", import.meta.url).pathname;

function player() {
  let game: Game = newGame(loadPlayPackage("preiskürbis"), PLAY_CASES["preiskürbis"].clockOrigin);
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

describe("Der verschwundene Preiskürbis", () => {
  it("is valid and solvable on all three certified routes, every hash filled in", () => {
    const check = checkCaseFolder(DIR);
    expect(check.problems).toEqual([]);
    expect(check.filled).toEqual([]);
    expect(check.routes.map((r) => [r.routeId, r.report.status, r.report.survivingAnswerCount])).toEqual([
      ["witness", "pass", 1],
      ["befragen", "pass", 1],
      ["vorhalten", "pass", 1],
    ]);
    expect(playCaseName("preiskuerbis")).toBe("preiskürbis");
  });

  it("Ferdl is unknown at first; Resi's answer introduces him in her own words", () => {
    const p = player();
    expect(accusations(p.game()).some((a) => a.label.includes("Ferdinand Kranz"))).toBe(false);
    expect(p.pick("f", "Ist Ihnen heute ein Fremder aufgefallen?")).toContain("Der kommt sonst nie zu uns");
    expect(accusations(p.game()).some((a) => a.label.includes("Ferdinand Kranz"))).toBe(true);
  });

  it("plays to the solution through both lies; the gloves are a false lead", () => {
    const p = player();
    expect(p.pick("u", "Ort durchsuchen: Wiegezelt")).toContain("Gartenhandschuhe");
    p.pick("u", "Ort durchsuchen: Parkwiese");
    expect(p.pick("f", "Ferdinand Kranz: Waren Sie um 14:40 auf der Parkwiese?")).toContain("meine Bertha gegossen");
    expect(p.pick("v", "Ferdinand Kranz zu „Waren Sie um 14:40 auf der Parkwiese?“ vorhalten: Parkschein")).toContain("gibt nach: „Ja, mei. Ich war da, um 14:40, mit dem Wagen.");
    p.pick("u", "Ort durchsuchen: Festbühne");
    p.pick("u", "Gegenstand untersuchen: Kamera der Lokalzeitung");
    p.pick("u", "Ort durchsuchen: Kuchenstand");
    p.pick("u", "Ort durchsuchen: Tombolastand");
    expect(p.pick("f", "Sepp Gruber: Waren Sie um 15:00 am Feuerwehrstand?")).toContain("Ein Kommandant verlässt seinen Posten nicht");
    expect(p.pick("v", "Sepp Gruber zu „Waren Sie um 15:00 am Feuerwehrstand?“ vorhalten: Tombolafoto")).toContain("Der Rasenmäher, verstehen Sie?");
    expect(p.pick("f", "Lotte Brandl: War der Bürgermeister")).toContain("Ich glaub schon!");
    p.pick("u", "Ort durchsuchen: Bierzelt");
    const verdict = p.pick("a", "Ferdinand Kranz");
    expect(verdict).toContain("Fall gelöst");
    expect(verdict).toContain("Otto gewinnt den ersten Preis");
  });
});
