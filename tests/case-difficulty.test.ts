import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { SEARCH_BOT_SEEDS, generateCaseOfDifficulty } from "../src/authoring/case-difficulty.ts";
import { MAX_COMPLEXITY, generateCase, generatedPackage, writeGeneratedCase } from "../src/authoring/case-generator.ts";
import { checkCaseFolder } from "../src/authoring/check-case.ts";
import { playtestCase } from "../src/play/playtest.ts";
import { createWebApp } from "../src/play/web.ts";

const scratch = mkdtempSync(join(tmpdir(), "difficulty-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
let n = 0;
const passes = (seed: number, complexity: number) => {
  const dir = join(scratch, `c${n++}`);
  writeGeneratedCase(generateCase(seed, undefined, { complexity }), dir);
  return checkCaseFolder(dir);
};

describe("complexity", () => {
  it.each([1, 2, 3, 4, 5])("complexity %i: ten seeds pass check-case with exactly one answer", (complexity) => {
    for (let seed = 0; seed < 10; seed++) {
      const check = passes(seed, complexity);
      expect(check.ok, `seed ${seed}`).toBe(true);
      expect(check.solvability?.survivingAnswerCount).toBe(1);
    }
  });

  it("adds decoy rooms, red herrings and from 3 a hidden clue; out of range is rejected", () => {
    const truth = (c: number) => generateCase(8, "classic", { complexity: c }).files["truth.json"] as { locations: unknown[]; redHerrings: unknown[]; items: { id: string }[] };
    expect(truth(2).locations.length).toBe(truth(0).locations.length + 2);
    expect(truth(4).redHerrings.length).toBe(4);
    expect(truth(3).items.map((i) => i.id)).toContain("item:waste-basket");
    expect(truth(2).items.map((i) => i.id)).not.toContain("item:waste-basket");
    expect(() => generateCase(1, undefined, { complexity: MAX_COMPLEXITY + 1 })).toThrow(RangeError);
  });
});

describe("wished difficulty", () => {
  it.each([1, 2, 3, 4, 5] as const)("level %i: the bot rates the chosen case at that level", (level) => {
    const found = generateCaseOfDifficulty(0, level);
    expect(found.rating).toBe(level);
    expect(playtestCase(generatedPackage(found.generated), SEARCH_BOT_SEEDS).rating).toBe(level);
    const dir = join(scratch, `level-${level}`);
    writeGeneratedCase(found.generated, dir);
    expect(checkCaseFolder(dir).ok).toBe(true);
  }, 60_000);

  it("is deterministic per seed and level", () => {
    expect(generateCaseOfDifficulty(4, 3)).toEqual(generateCaseOfDifficulty(4, 3));
    expect(generateCaseOfDifficulty(4, 2).generated.seed).not.toBe(generateCaseOfDifficulty(5, 2).generated.seed);
  }, 60_000);

  it("web: the Zufallsfall form takes a level and the case page names the measured one", async () => {
    const app = createWebApp();
    const server = createServer((req, res) => void app(req, res));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      expect(await (await fetch(`${base}/`)).text()).toContain('name="stufe"');
      const post = (body: Record<string, string>) => fetch(`${base}/zufall`, { method: "POST", body: new URLSearchParams(body), redirect: "manual" });
      expect((await post({ seed: "4", stufe: "2" })).headers.get("location")).toBe("/fall/zufall-4-stufe-2");
      expect((await post({ seed: "4", stufe: "" })).headers.get("location")).toBe("/fall/zufall-4");
      expect((await post({ seed: "4", stufe: "9" })).status).toBe(400);
      const page = await (await fetch(`${base}/fall/zufall-4-stufe-2`)).text();
      expect(page).toContain(generateCaseOfDifficulty(4, 2).generated.title);
      expect(page).toContain("Gemessen vom Spieltest: ●●○○○ leicht");
      expect((await fetch(`${base}/fall/zufall-4-stufe-6`)).status).toBe(404);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 60_000);
});
