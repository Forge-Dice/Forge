import { describe, expect, it } from "vitest";
import { checkCaseFolder } from "../src/authoring/check-case.ts";
import { PLAY_CASES, loadPlayPackage, playCaseName } from "../src/play/cases.ts";
import { command, newGame, type Game } from "../src/play/game.ts";
import { createWebHandler } from "../src/play/web.ts";

// "Die Vereinskasse": the short learning case. Three suspects, one route (search, ask, confront the
// lie, accuse), first in the case list and recommended on the start page and in the introduction.

const pkg = loadPlayPackage("lernfall");
const FIXTURES = new URL("./fixtures/", import.meta.url).pathname;

/** Runs CLI commands, picking menu entries by label. */
function run(steps: [string, string][]): { game: Game; out: string[] } {
  let game = newGame(pkg, PLAY_CASES.lernfall.clockOrigin);
  const out: string[] = [];
  for (const [menu, label] of steps) {
    const list = command(game, menu).text.split("\n");
    const line = list.find((l) => l.endsWith(`. ${label}`) || l.includes(`. ${label}`));
    if (line === undefined) throw new Error(`"${label}" not in ${menu}: ${list.join(" | ")}`);
    const step = command(game, `${menu} ${line.trim().split(".")[0]}`);
    game = step.game;
    out.push(step.text);
  }
  return { game, out };
}

describe("Die Vereinskasse (lernfall)", () => {
  it("is a valid, solvable case folder and the first playable case", () => {
    expect(checkCaseFolder(`${FIXTURES}lernfall`).ok).toBe(true);
    expect(Object.keys(PLAY_CASES)[0]).toBe("lernfall");
    expect(playCaseName("lernfall")).toBe("lernfall");
  });

  it("the route: search both places, catch Jonas' lie with the shoeprint, accuse him", () => {
    const { game, out } = run([
      ["u", "Ort durchsuchen: Vereinsheim"],
      ["u", "Ort durchsuchen: Sportplatz"],
      ["f", "Jonas: Waren Sie um 17:00 im Vereinsheim?"],
      ["v", "Jonas zu „Waren Sie um 17:00 im Vereinsheim?“ vorhalten: Stollenabdruck"],
      ["a", "Jonas"],
    ]);
    expect(out[2]).toContain("Jonas auf „Waren Sie um 17:00 im Vereinsheim?“");
    expect(out[3]).toContain("gibt nach");
    expect(out[4]).toContain("Fall gelöst");
    expect(game.state.phase).toBe("solved");
  });

  it("without the confrontation Jonas' denial stands; Mila and Kurt are not the answer", () => {
    for (const who of ["Mila", "Kurt"]) {
      expect(run([["a", who]]).out[0]).toContain("noch nicht");
    }
  });

  it("start page: first card, marked for beginners and recommended", async () => {
    const page = (await createWebHandler({ lernfall: pkg })("GET", "/", async () => null)).body;
    expect(page.indexOf("Die Vereinskasse")).toBeLessThan(page.indexOf("Die leere Vitrine"));
    expect(page).toContain('<a href="/fall/lernfall">Die Vereinskasse</a>');
    expect(page).toContain(">Zum Einstieg</span>");
  });
});
