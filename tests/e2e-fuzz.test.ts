import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { reduceSession } from "../src/domain/case-session.ts";
import { PLAY_CASES, loadPlayPackage, type PlayCaseName } from "../src/play/cases.ts";
import { accusations, command, investigations, loadText, newGame, questions, saveText, type Game } from "../src/play/game.ts";
import { createWebApp } from "../src/play/web.ts";
import { rng } from "./case-solvability.fixture.ts";

// End-to-end fuzz over every playable case: seeded random players through the game layer (the
// real session) and through the web server over HTTP. Invariants: no HOST_FAILURE from any player
// input, no internal ID or PlayerRef in anything shown, save/load identical at every step, bounded
// response times.

const CASES = Object.keys(PLAY_CASES) as PlayCaseName[];
const INTERNAL_ID = /\b(?:case|person|location|item|event|evidence|proposition|conclusion|question|secret|red-herring|rule):[a-z0-9]/;
const PLAYER_REF = /pr1_[0-9a-hjkmnp-tv-z]{16}/;
const SHOWN_LIMIT_MS = 250;

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

describe("HTTP fuzz over the web server", () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    const app = createWebApp(Object.fromEntries(CASES.map((n) => [n, loadPlayPackage(n)])));
    server = createServer((req, res) => void app(req, res));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const timed = async (path: string, init?: RequestInit) => {
    const start = performance.now();
    const res = await fetch(`${base}${path}`, { redirect: "manual", ...init });
    const body = await res.text();
    return { status: res.status, body, ms: performance.now() - start, location: res.headers.get("location") };
  };
  const form = (fields: Record<string, string>) => ({
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });

  it.each(CASES)("%s: random clicks and forged forms stay leak-free, fast and save/load-stable", async (name) => {
    const slug = `/fall/${PLAY_CASES[name].dir}`;
    const rand = rng(name.length * 104729);
    const problems: string[] = [];
    // The save download is the Session C event log (PlayerRefs and question IDs by design), not a page.
    const check = (label: string, r: { status: number; body: string; ms: number }, page = true) => {
      if (r.status >= 500) problems.push(`${label}: status ${r.status}`);
      if (r.ms > SHOWN_LIMIT_MS) problems.push(`${label}: ${Math.round(r.ms)} ms`);
      for (const leak of page ? leaks(r.body) : []) problems.push(`${label}: leak ${leak}`);
      if (r.body.includes("Technischer Fehler")) problems.push(`${label}: host failure shown`);
    };
    await timed(`${slug}/new`, { method: "POST" });
    for (let step = 0; step < 120; step++) {
      const page = await timed(slug);
      check(`GET ${step}`, page);
      const at = /name="at" value="(\d+)"/.exec(page.body)?.[1] ?? "0";
      const group = ["u", "f", "a", "h", "x", ""][Math.floor(rand() * 6)]!;
      const n = rand() < 0.85 ? String(1 + Math.floor(rand() * 12)) : ["0", "-1", "abc", "99999", "1e3", ""][Math.floor(rand() * 6)]!;
      const stale = rand() < 0.1 ? String(Number(at) + 1) : at;
      check(`POST act ${step}`, await timed(`${slug}/act`, form({ group, n, at: stale })));
      if (rand() < 0.15) {
        const saved = await timed(`${slug}/save`);
        check(`save ${step}`, saved, false);
        if (saved.status === 200) {
          check(`load ${step}`, await timed(`${slug}/load`, { method: "POST", body: saved.body }));
          const again = await timed(`${slug}/save`);
          if (again.body !== saved.body) problems.push(`save/load not identical at ${step}`);
        }
      }
      if (rand() < 0.03) check(`load garbage ${step}`, await timed(`${slug}/load`, { method: "POST", body: "{\"schemaVersion\":1}" }));
    }
    check("case list", await timed("/"));
    expect([...new Set(problems)].slice(0, 10)).toEqual([]);
  }, 120_000);
});
