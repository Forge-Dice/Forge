import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { resolveCasePackage } from "../src/domain/case-package.ts";
import { decodeSessionSave, encodeSessionSave } from "../src/domain/case-session-save.ts";
import { initialSession } from "../src/domain/case-session.ts";
import { PLAY_CASES, loadPlayPackage, playPackageInput, refSource, type PlayCaseName } from "../src/play/cases.ts";
import { command, intro, newGame } from "../src/play/game.ts";
import { createWebApp } from "../src/play/web.ts";

// Optional PublicContent.epilogue: player text rules, bound into the package identity, shown in CLI
// and web only after a solving accusation.

// Die Hüttenkasse is left out: its culprit can only be accused after the hut book introduces him
// (late suspect), so "accuse the solver on a fresh game" does not apply; tests/cases-4-5.test.ts
// plays it to the epilogue.
const CASES: PlayCaseName[] = ["vitrine", "brieföffner", "geige", "nachtzug"];
const SOLVER: Record<PlayCaseName, string> = { vitrine: "Lina Kern", "brieföffner": "Ben", geige: "Ida Reiner", "hüttenkasse": "Tobias Wenger", nachtzug: "Clara Mai" };
const WRONG: Record<PlayCaseName, string> = { vitrine: "Max Brandt", "brieföffner": "Anna", geige: "Paul Adler", "hüttenkasse": "Lukas Brandl", nachtzug: "Bruno Kessler" };

function resolveWith(name: PlayCaseName, edit: (content: any) => void) {
  const c = PLAY_CASES[name];
  const input = playPackageInput(c) as { publicContent: any; truth: unknown };
  edit(input.publicContent);
  return resolveCasePackage(input, refSource(input.truth, c.salt));
}

const accuse = (name: PlayCaseName, who: string) => {
  const game = newGame(loadPlayPackage(name), PLAY_CASES[name].clockOrigin);
  const line = command(game, "a").text.split("\n").find((l) => l.includes(who))!;
  return { before: game, step: command(game, `a ${line.trim().split(".")[0]}`) };
};

describe("epilogue in the package", () => {
  it.each(CASES)("%s ships an epilogue that obeys the player text rules", (name) => {
    const epilogue = loadPlayPackage(name).publicContent.epilogue;
    expect(epilogue).toBeTypeOf("string");
    expect(epilogue!.length).toBeGreaterThan(100);
    expect(epilogue).not.toMatch(/\b(person|location|item|event|evidence|proposition|conclusion):[a-z0-9]/);
  });

  it("is optional and is part of the package identity", () => {
    const withIt = resolveWith("vitrine", () => {});
    const without = resolveWith("vitrine", (p) => delete p.epilogue);
    const changed = resolveWith("vitrine", (p) => (p.epilogue += " Ende."));
    if (!withIt.ok || !without.ok || !changed.ok) throw new Error("not resolved");
    const hashes = new Set([withIt, without, changed].map((r) => r.package.identity.packageHash));
    expect(hashes.size).toBe(3);
  });

  it("a save of the old package does not load after the epilogue changed", () => {
    const old = resolveWith("vitrine", (p) => delete p.epilogue);
    if (!old.ok) throw new Error("not resolved");
    const saved = encodeSessionSave(old.package, initialSession(old.package));
    if (!saved.ok) throw new Error(saved.code);
    expect(decodeSessionSave(loadPlayPackage("vitrine"), saved.text)).toEqual({ ok: false, code: "INCOMPATIBLE_PACKAGE" });
  });

  it("rejects a canonical id, a blank text and an over-long text", () => {
    for (const bad of ["Lina (person:lina) war es.", " \n ", "x".repeat(4001), 42]) {
      const result = resolveWith("vitrine", (p) => (p.epilogue = bad));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.findings.some((f) => f.path.join(".").startsWith("publicContent.epilogue"))).toBe(true);
    }
  });
});

describe("epilogue in the CLI", () => {
  it.each(CASES)("%s: only the solving accusation shows it", (name) => {
    const pkg = loadPlayPackage(name);
    const epilogue = pkg.publicContent.epilogue!;
    const { before, step } = accuse(name, SOLVER[name]);
    expect(intro(before) + command(before, "fall").text + command(before, "hilfe").text).not.toContain(epilogue);
    expect(step.text).toContain("=== Auflösung ===");
    expect(step.text).toContain(epilogue);
    const wrong = accuse(name, WRONG[name]).step;
    expect(wrong.text).not.toContain(epilogue);
  });
});

describe("epilogue in the web front end", () => {
  it.each(CASES)("%s: not on any page before the solution, in the closing card after it", async (name) => {
    const app = createWebApp();
    const server = createServer((req, res) => void app(req, res));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/fall/${PLAY_CASES[name].dir}`;
    try {
      const first = loadPlayPackage(name).publicContent.epilogue!.split("\n")[0]!.slice(0, 60);
      const page = async () => (await fetch(base)).text();
      const html = await page();
      expect(html).not.toContain(first);
      expect(await (await fetch(base.replace(/\/fall\/.*/, "/"))).text()).not.toContain(first);
      const form = [...html.matchAll(/<form method="post" action="\/fall\/[a-z]+\/act"[^>]*>(.*?)<\/form>/g)]
        .map(([, inner]) => inner!)
        .find((inner) => new RegExp(`>${SOLVER[name]}</button>`).test(inner))!;
      const fields = Object.fromEntries([...form.matchAll(/name="(\w+)" value="([^"]*)"/g)].map(([, k, v]) => [k!, v!]));
      await fetch(`${base}/act`, { method: "POST", body: new URLSearchParams(fields), redirect: "manual" });
      const solved = await page();
      expect(solved).toContain('<div class="epilogue"><p>');
      expect(solved).toContain(first);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
