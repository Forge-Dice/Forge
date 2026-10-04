import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { generateCase, generatedClockOrigin, generatedPackage, writeGeneratedCase } from "../src/authoring/case-generator.ts";
import * as EN from "../src/authoring/case-generator-en.ts";
import { checkCaseFolder } from "../src/authoring/check-case.ts";
import { answerText, newGame } from "../src/play/game.ts";
import { reduceSession, initialSession } from "../src/domain/case-session.ts";
import { createWebHandler } from "../src/play/web.ts";

// English generated cases: the same seed, the same case (all shared files identical), English
// player text in en/public-content.json and en/evidence-presentation.json.

const scratch = mkdtempSync(join(tmpdir(), "generated-en-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
const SEEDS = Array.from({ length: 50 }, (_, i) => i);

describe("English generated cases", () => {
  it.each(SEEDS)("seed %i: the English variant passes check-case like the German one", (seed) => {
    const dir = join(scratch, `fall-${seed}`);
    writeGeneratedCase(generateCase(seed, undefined, { complexity: seed % 6 }), dir);
    for (const lang of [undefined, "en"]) {
      const check = checkCaseFolder(dir, lang);
      expect(check.problems.filter((p) => p.severity === "error"), `${lang}`).toEqual([]);
      expect(check.solvability).toMatchObject({ status: "pass", survivingAnswerCount: 1 });
    }
  });

  it("is the same case in both languages: same refs and identity of the shared parts", () => {
    const g = generateCase(11);
    const [de, en] = [generatedPackage(g), generatedPackage(g, "en")];
    expect(en.truth).toEqual(de.truth);
    expect(en.refs.refFor("person", de.truth.persons[0]!.id)).toBe(de.refs.refFor("person", de.truth.persons[0]!.id));
    expect(en.publicContent.title).not.toBe(de.publicContent.title);
    expect(en.publicContent.brief).toMatch(/^(A|An) /);
  });

  it("English blocks stand index for index beside the German ones", () => {
    expect(EN.EN_SETTINGS.every((s) => s.places.length === 5)).toBe(true);
    expect([EN.EN_SETTINGS, EN.EN_WEAPONS, EN.EN_CLUES, EN.EN_MOTIVES, EN.EN_WEATHER, EN.EN_SIDE_ROLES, EN.EN_PERSONALITIES, EN.EN_DECOY_ROOMS, EN.EN_HERRINGS, EN.EN_ROLES, EN.EN_VICTIM_ROLES].map((a) => a.length)).toEqual([10, 10, 8, 8, 7, 6, 5, 6, 4, 13, 6]);
  });

  it("an English answer is spoken in the NPC's English voice", () => {
    const g = generateCase(2);
    const pkg = generatedPackage(g, "en");
    const game = newGame(pkg, generatedClockOrigin(g), "en");
    const q = pkg.publicContent.questionTexts.find((x) => /-alibi$/.test(x.questionId))!;
    const npc = pkg.refs.refFor("person", q.npc)!;
    // Search the place first is not needed for an alibi question of a known NPC.
    const r = reduceSession(pkg, initialSession(pkg), { type: "interrogate", npc, questionId: q.questionId });
    if (!r.ok || r.output.type !== "interrogate") throw new Error("ask failed");
    const voice = pkg.publicContent.voices!.find((v) => v.npc === q.npc)!.lines;
    const text = answerText({ ...game, state: r.state }, r.output.observation);
    expect(Object.values(voice).flat().some((line) => text.includes(line)), text).toBe(true);
    expect(text).toContain(q.text);
  });

  it("web: the language cookie shows a Zufallsfall in English and keeps the game when switching", async () => {
    const handle = createWebHandler();
    const none = async () => null;
    const g = generateCase(7);
    const enTitle = (g.files["en/public-content.json"] as { title: string }).title;
    const de = await handle("GET", "/fall/zufall-7", none);
    expect(de.body).toContain((g.files["public-content.json"] as { title: string }).title);
    await handle("POST", "/fall/zufall-7/act", async () => "group=u&n=1&at=0");
    const en = await handle("GET", "/fall/zufall-7", none, "sprache=en");
    expect(en.body).toContain(enTitle.replace(/'/g, "&#39;"));
    expect(en.body).toMatch(/name="at" value="1(-[0-9a-z]+)?"/);
  });
});
