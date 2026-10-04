import { describe, expect, it } from "vitest";
import { PLAY_CASES, loadPlayPackage, type PlayCaseName } from "../src/play/cases.ts";
import { accusations, command, confrontations, investigations, loadText, newGame, questions, saveText, type Game } from "../src/play/game.ts";
import { playRun } from "../src/play/playtest.ts";
import { RANKS, SCORE_RULES, parOf, rankOf, scoreOf, scoreText } from "../src/play/score.ts";
import { reduceSession } from "../src/domain/case-session.ts";
import { createWebHandler } from "../src/play/web.ts";

// Score of a solved case: from the event log only (saves reproduce it), par from the playtest bot,
// three ranks; shown in the CLI, on the web closing card, best per case in localStorage.

const pkg = loadPlayPackage("lernfall");
const act = (game: Game, event: unknown): Game => {
  const result = reduceSession(game.pkg, game.state, event);
  if (!result.ok) throw new Error(result.code);
  return { ...game, state: result.state };
};
const pick = (actions: { label: string; event: unknown }[], label: string) => actions.find((a) => a.label === label)!.event;

/** Lernfall route; extra events are inserted before the accusation. */
function solve(extra: (g: Game) => Game = (g) => g): Game {
  let g = newGame(pkg, PLAY_CASES.lernfall.clockOrigin);
  g = act(g, pick(investigations(g), "Ort durchsuchen: Vereinsheim"));
  g = act(g, pick(investigations(g), "Ort durchsuchen: Sportplatz"));
  g = act(g, pick(questions(g), "Jonas: Waren Sie um 17:00 im Vereinsheim?"));
  g = act(g, confrontations(g).find((a) => a.label.includes("Stollenabdruck"))!.event);
  g = extra(g);
  return act(g, pick(accusations(g), "Jonas"));
}

describe("scoreOf", () => {
  it("null while open; the clean route is 100 points and the top rank", () => {
    expect(scoreOf(pkg, newGame(pkg).state)).toBeNull();
    const s = scoreOf(pkg, solve().state)!;
    expect(s).toEqual({ points: 100, rank: { stars: 3, title: "Meisterdetektiv" }, actions: 5, par: 10, hints: 0, wrongAccusations: 0 });
  });

  it("hints, wrong accusations and actions beyond par cost points", () => {
    const g = solve((g) => {
      g = act(g, { type: "hint" });
      g = act(g, pick(accusations(g), "Mila"));
      for (const a of investigations(g).filter((a) => a.label.startsWith("Person untersuchen"))) g = act(g, a.event);
      for (let i = 0; i < 4; i++) g = act(g, pick(investigations(g), "Ort durchsuchen: Vereinsheim"));
      return g;
    });
    const s = scoreOf(pkg, g.state)!;
    expect([s.actions, s.hints, s.wrongAccusations]).toEqual([13, 1, 1]);
    expect(s.points).toBe(100 - SCORE_RULES.perExtraAction * 3 - SCORE_RULES.perHint - SCORE_RULES.perWrongAccusation);
    expect(s.rank.title).toBe("Kommissar");
  });

  it("ranks and the floor at zero", () => {
    expect(RANKS.map((r) => rankOf(r.from).title)).toEqual(["Meisterdetektiv", "Kommissar", "Spürnase"]);
    expect(rankOf(84).stars).toBe(2);
    expect(rankOf(54).stars).toBe(1);
    const g = solve((g) => {
      g = act(g, pick(accusations(g), "Mila"));
      g = act(g, pick(accusations(g), "Kurt"));
      for (let i = 0; i < 2; i++) g = act(g, { type: "hint" });
      for (let i = 0; i < 20; i++) g = act(g, pick(investigations(g), "Ort durchsuchen: Vereinsheim"));
      return g;
    });
    expect(scoreOf(pkg, g.state)!.points).toBe(0);
  });

  it("a save reproduces the score exactly", () => {
    const g = solve((g) => act(g, { type: "hint" }));
    const saved = saveText(g);
    expect(saved.ok).toBe(true);
    const loaded = loadText(pkg, saved.text);
    expect(loaded.ok && scoreOf(pkg, loaded.game.state)).toEqual(scoreOf(pkg, g.state));
  });

  it("par is the systematic playtest player's action count (stored in PLAY_CASES)", { timeout: 60_000 }, () => {
    for (const name of Object.keys(PLAY_CASES) as PlayCaseName[]) {
      const p = loadPlayPackage(name);
      expect(PLAY_CASES[name].par, name).toBe(playRun(p, "systematisch", 1).actions);
      expect(parOf(p)).toBe(PLAY_CASES[name].par);
    }
  });

  it("a package without a measured par falls back to twice the witness plus the accusation", () => {
    const copy = { ...pkg };
    expect(parOf(copy)).toBe(2 * (pkg.proof!.profile.witnessStepIds.length + 1));
  });
});

describe("where the score shows", () => {
  it("CLI: the line after the solving accusation", () => {
    let g = solve();
    expect(scoreText(scoreOf(pkg, g.state)!)).toBe("Wertung: 100 Punkte, ★★★ Meisterdetektiv (5 Aktionen bei Ziel 10, kein Hinweis, keine Fehlanklage)");
    // The real CLI path: the accusation menu entry prints the verdict with the score.
    g = newGame(pkg, PLAY_CASES.lernfall.clockOrigin);
    for (const line of ["u 1", "u 2"]) g = command(g, line).game;
    const ask = command(g, "f").text.split("\n").find((l) => l.includes("Jonas: Waren Sie"))!.trim().split(".")[0]!;
    g = command(g, `f ${ask}`).game;
    const hold = command(g, "v").text.split("\n").find((l) => l.includes("Stollenabdruck"))!.trim().split(".")[0]!;
    g = command(g, `v ${hold}`).game;
    const jonas = command(g, "a").text.split("\n").find((l) => l.endsWith(". Jonas"))!.trim().split(".")[0]!;
    expect(command(g, `a ${jonas}`).text).toContain("Wertung: 100 Punkte, ★★★ Meisterdetektiv");
  });

  it("web: closing card carries the score; the case list has a best-score slot per case", async () => {
    const handle = createWebHandler({ lernfall: pkg });
    const saved = saveText(solve());
    if (!saved.ok) throw new Error("save");
    await handle("POST", "/fall/lernfall/load", async () => saved.text);
    const page = (await handle("GET", "/fall/lernfall", async () => null)).body;
    expect(page).toContain('<p class="score" data-score="100" data-stars="3" data-rank="Meisterdetektiv" data-slug="lernfall">');
    expect(page).toContain('localStorage.setItem(key, JSON.stringify(now))');
    const home = (await handle("GET", "/", async () => null)).body;
    expect(home).toContain('<span class="best" data-best="lernfall" hidden></span>');
    expect(home).toContain('"kriminalfaelle.best." + el.dataset.best');
  });
});
