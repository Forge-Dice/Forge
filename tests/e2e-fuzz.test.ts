import { describe, expect, it } from "vitest";
import { reduceSession } from "../src/domain/case-session.ts";
import { PLAY_CASES, loadPlayPackage, type PlayCaseName } from "../src/play/cases.ts";
import { accusations, command, investigations, loadText, newGame, questions, saveText, type Game } from "../src/play/game.ts";
import { rng } from "./case-solvability.fixture.ts";

// End-to-end fuzz over every playable case: seeded random players through the game layer (the
// real session) and through the web server over HTTP. Invariants: no HOST_FAILURE from any player
// input, no internal ID or PlayerRef in anything shown, save/load identical at every step, bounded
// response times.

// Split in two files (game layer here, HTTP in e2e-fuzz-http.test.ts) so they run in parallel.
const CASES = Object.keys(PLAY_CASES) as PlayCaseName[];
const INTERNAL_ID = /\b(?:case|person|location|item|event|evidence|proposition|conclusion|question|secret|red-herring|rule):[a-z0-9]/;
const PLAYER_REF = /pr1_[0-9a-hjkmnp-tv-z]{16}/;

const leaks = (text: string) => [INTERNAL_ID.exec(text)?.[0], PLAYER_REF.exec(text)?.[0]].filter((x) => x !== undefined);

describe.each(CASES)("game layer fuzz: %s", (name) => {
  const pkg = loadPlayPackage(name);
  const origin = PLAY_CASES[name].clockOrigin;

  it("random players: no HOST_FAILURE, no internal ids, save/load identical at every step", () => {
    const rand = rng(name.length * 7919);
    const pick = <T,>(xs: readonly T[]): T | undefined => xs[Math.floor(rand() * xs.length)];
    const problems: string[] = [];
    for (let run = 0; run < 12; run++) {
      let game: Game = newGame(pkg, origin);
      for (let step = 0; step < 30 && game.state.phase === "active"; step++) {
        // Mostly menu actions a player can click, sometimes raw forged events.
        const roll = rand();
        const menu = roll < 0.45 ? investigations(game) : roll < 0.85 ? questions(game) : accusations(game);
        const raw = rand() < 0.1 ? { type: "interrogate", npc: pick(game.state.knowledge.known)?.ref, questionId: pick(pkg.catalogue.questions)?.id } : undefined;
        const event = rand() < 0.05 ? { type: "hint" } : (raw ?? pick(menu)?.event);
        if (event === undefined) continue;
        const result = reduceSession(pkg, game.state, event);
        if (!result.ok) {
          if (result.code === "HOST_FAILURE") problems.push(`HOST_FAILURE on ${JSON.stringify(event)}`);
          continue;
        }
        game = { ...game, state: result.state };
        for (const text of ["bekannt", "journal", "fall", "u", "f", "a"].map((c) => command(game, c).text)) {
          for (const leak of leaks(text)) problems.push(`leak ${leak} after ${JSON.stringify(event)}`);
        }
        const saved = saveText(game);
        if (!saved.ok) {
          problems.push(`save failed at step ${step}`);
          continue;
        }
        const loaded = loadText(pkg, saved.text, origin);
        if (!loaded.ok) problems.push(`load failed at step ${step}`);
        else {
          if (JSON.stringify(loaded.game.state) !== JSON.stringify(game.state)) problems.push(`state differs after load at step ${step}`);
          const again = saveText(loaded.game);
          if (!again.ok || again.text !== saved.text) problems.push(`save not stable after load at step ${step}`);
        }
      }
    }
    expect([...new Set(problems)].slice(0, 10)).toEqual([]);
  }, 300_000);
});
