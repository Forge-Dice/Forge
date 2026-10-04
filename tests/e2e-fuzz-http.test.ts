import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PLAY_CASES, loadPlayPackage, type PlayCaseName } from "../src/play/cases.ts";
import { createWebApp } from "../src/play/web.ts";
import { rng } from "./case-solvability.fixture.ts";

// End-to-end fuzz over every playable case: seeded random players through the game layer (the
// real session) and through the web server over HTTP. Invariants: no HOST_FAILURE from any player
// input, no internal ID or PlayerRef in anything shown, save/load identical at every step, bounded
// response times.
// Split in two files (HTTP here, game layer in e2e-fuzz.test.ts) so they run in parallel.

const CASES = Object.keys(PLAY_CASES) as PlayCaseName[];
const INTERNAL_ID = /\b(?:case|person|location|item|event|evidence|proposition|conclusion|question|secret|red-herring|rule):[a-z0-9]/;
const PLAYER_REF = /pr1_[0-9a-hjkmnp-tv-z]{16}/;
const SHOWN_LIMIT_MS = 250;

const leaks = (text: string) => [INTERNAL_ID.exec(text)?.[0], PLAYER_REF.exec(text)?.[0]].filter((x) => x !== undefined);

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
      const at = /name="at" value="([^"]+)"/.exec(page.body)?.[1] ?? "0";
      const group = ["u", "f", "a", "h", "x", ""][Math.floor(rand() * 6)]!;
      const n = rand() < 0.85 ? String(1 + Math.floor(rand() * 12)) : ["0", "-1", "abc", "99999", "1e3", ""][Math.floor(rand() * 6)]!;
      const stale = rand() < 0.1 ? `${at}x` : at;
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
