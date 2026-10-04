import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { caseLocales, checkCaseFolder } from "../src/authoring/check-case.ts";
import { PLAY_CASES, caseLangs, loadPlayPackage, loadSaveInLang, playPackageInput, type PlayCaseName } from "../src/play/cases.ts";
import { command, intro, newGame, saveText, switchLang, type Game } from "../src/play/game.ts";
import { MESSAGES, parseLang } from "../src/play/messages.ts";
import { renderGame } from "../src/play/web-page.ts";
import { createWebApp } from "../src/play/web.ts";

// English: UI text from the message table, case text from each case's en/ locale variant. Truth,
// solution, NPCs and proof are shared, so the English case is the same case.

const CASES = Object.keys(PLAY_CASES) as PlayCaseName[];
const INTERNAL_ID = /\b(?:case|person|location|item|event|evidence|proposition|conclusion|question|secret|red-herring|rule):[a-z0-9]/;
const PLAYER_REF = /pr1_[0-9a-hjkmnp-tv-z]{16}/;
const GERMAN = /„|\b(?:und|nicht|der|die|das|Fund|Aussage|Hinweis|Anklage|Nein)\b/; // place names may keep umlauts
const fixture = (name: PlayCaseName) => join("tests/fixtures", PLAY_CASES[name].dir);

/** A player who only follows the English hints, typed into the English CLI commands. */
function playByHintsInEnglish(name: PlayCaseName): { game: Game; transcript: string[] } {
  let game = newGame(loadPlayPackage(name, "en"), PLAY_CASES[name].clockOrigin, "en");
  const transcript = [intro(game)];
  const run = (line: string) => {
    const step = command(game, line);
    game = step.game;
    transcript.push(step.text);
    return step.text;
  };
  const pick = (menu: string, entry: string) => {
    const line = run(menu).split("\n").find((l) => l.replace(/^\s*\d+\.\s/, "") === entry);
    if (line === undefined) throw new Error(`no menu entry “${entry}” in ${menu}`);
    run(`${menu} ${line.trim().split(".")[0]}`);
  };
  for (let guard = 0; guard < 300 && game.state.phase === "active"; guard++) {
    const hint = run("hint");
    const menu = /In the “investigate” menu: “(.+)”\.$/.exec(hint);
    const ask = /Ask (.+?): “(.+)”$/.exec(hint);
    const confront = /\): (Confront .+ on “.+” with: .+)\.$/.exec(hint);
    if (menu !== null) pick("i", menu[1]!);
    else if (confront !== null) pick("c", confront[1]!);
    else if (ask !== null) pick("q", `${ask[1]}: ${ask[2]}`);
    else if (/make your accusation|and accuse\./.test(hint) && /level 3/.test(hint)) {
      const suspects = run("accuse").split("\n").slice(1).length;
      for (let n = 1; n <= suspects && game.state.phase === "active"; n++) run(`a ${n}`);
    }
  }
  return { game, transcript };
}

describe("locale variants in check-case", () => {
  it.each(CASES)("%s has an English variant that is a valid, solvable translation", (name) => {
    expect(caseLocales(fixture(name))).toEqual(["en"]);
    const check = checkCaseFolder(fixture(name), "en");
    expect(check.problems.filter((p) => p.severity === "error")).toEqual([]);
    expect(check.solvability?.status).toBe("pass");
    expect(check.checkedFiles).toContain("en/evidence-presentation.json");
    // The base proof binds the German text; the variant never writes into shared files.
    expect(check.filled.every((f) => f.file.startsWith("en/"))).toBe(true);
    // en/source.json matches the current German text: the translation is up to date.
    expect(check.problems.filter((p) => p.file === "en/source.json")).toEqual([]);
    expect(check.filled).toEqual([]);
  });

  it("notices when the German text changed after the translation", () => {
    const dir = mkdtempSync(join(tmpdir(), "i18n-"));
    cpSync(fixture("geige"), dir, { recursive: true });
    const file = join(dir, "evidence-presentation.json");
    const content = JSON.parse(readFileSync(file, "utf8"));
    content.entries[0].text += " Neuer Satz.";
    writeFileSync(file, JSON.stringify(content));
    const check = checkCaseFolder(dir, "en");
    expect(check.problems).toEqual([expect.objectContaining({ file: "en/source.json", field: "presentation", severity: "warning" })]);
    expect(check.filled).toEqual([expect.objectContaining({ file: "en/source.json", field: "presentation", stale: true })]);
  });

  it("lets a translation reword NPC voices and answer sentences, but not drop a reply kind", () => {
    const dir = mkdtempSync(join(tmpdir(), "i18n-"));
    cpSync(fixture("geige"), dir, { recursive: true });
    const edit = (path: string, change: (c: { questionTexts: { npc: string; answer?: string }[]; voices?: unknown }) => void) => {
      const content = JSON.parse(readFileSync(join(dir, path), "utf8"));
      change(content);
      writeFileSync(join(dir, path), JSON.stringify(content));
    };
    const npc = (c: { questionTexts: { npc: string }[] }) => c.questionTexts[0]!.npc;
    edit("public-content.json", (c) => (c.voices = [{ npc: npc(c), lines: { affirms: ["Freilich."], decline: ["Nix da."] } }]));
    edit("en/public-content.json", (c) => {
      c.voices = [{ npc: npc(c), lines: { affirms: ["Sure.", "Of course."], decline: ["No way."] } }];
      c.questionTexts[0]!.answer = "Yes, he was, holding court as always.";
    });
    const ok = checkCaseFolder(dir, "en");
    expect(ok.problems.filter((p) => p.severity === "error")).toEqual([]);
    edit("en/public-content.json", (c) => (c.voices = [{ npc: npc(c), lines: { affirms: ["Sure."] } }]));
    expect(checkCaseFolder(dir, "en").problems).toEqual(expect.arrayContaining([expect.objectContaining({ file: "en/public-content.json", field: "voices[0].lines", severity: "error" })]));
  });

  it("rejects a translation that changes more than text, naming the locale file", () => {
    const dir = mkdtempSync(join(tmpdir(), "i18n-"));
    cpSync(fixture("vitrine"), dir, { recursive: true });
    const file = join(dir, "en", "public-content.json");
    const content = JSON.parse(readFileSync(file, "utf8"));
    content.questionTexts[0].questionId = content.questionTexts[1].questionId;
    content.labels[0].label = "Closing (event:e01)";
    content.publicRules[1].text = " ";
    writeFileSync(file, JSON.stringify(content));
    const check = checkCaseFolder(dir, "en");
    expect(check.ok).toBe(false);
    const fields = check.problems.filter((p) => p.file === "en/public-content.json").map((p) => `${p.field}: ${p.message}`);
    expect(fields).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^questionTexts\[0\]\.questionId: weicht vom Grundfall ab/),
        "labels[0].label: Übersetzung enthält eine interne ID",
        "publicRules[1].text: Übersetzung ist leer",
      ]),
    );
  });
});

describe("English play", () => {
  it.each(CASES)("%s is solvable in English by following the hints in the CLI", (name) => {
    const { game, transcript } = playByHintsInEnglish(name);
    expect(game.state.phase).toBe("solved");
    const text = transcript.join("\n");
    expect(text).toContain("The accusation holds. Case solved!");
    expect(text).toContain("=== Resolution ===");
    expect(text).toContain(loadPlayPackage(name, "en").publicContent.epilogue!);
    expect(text).not.toMatch(INTERNAL_ID);
    expect(text).not.toMatch(PLAYER_REF);
    expect(text).not.toMatch(GERMAN);
  });

  it("accepts German and English commands in either language and parses --lang values", () => {
    const game = newGame(loadPlayPackage("vitrine", "en"), PLAY_CASES.vitrine.clockOrigin, "en");
    expect(command(game, "help").text).toBe(MESSAGES.en.cli.help);
    expect(command(game, "hilfe").text).toBe(MESSAGES.en.cli.help);
    expect(command(game, "u").text).toBe(command(game, "investigate").text);
    expect(command(game, "xyz").text).toBe("Unknown command “xyz”. Type “help”.");
    expect([parseLang("en"), parseLang("EN-us"), parseLang("de"), parseLang("fr"), parseLang(undefined)]).toEqual(["en", "en", "de", null, null]);
  });

  it("switching language keeps the game: same events, same phase, other text", () => {
    let game = newGame(loadPlayPackage("geige"), PLAY_CASES.geige.clockOrigin);
    for (const line of ["u 1", "u 2", "f 1"]) game = command(game, line).game;
    const english = switchLang(game, loadPlayPackage("geige", "en"), "en")!;
    expect(english.state.events).toEqual(game.state.events);
    expect(english.state.knowledge.known).toEqual(game.state.knowledge.known);
    expect(command(english, "journal").text).not.toMatch(GERMAN);
    expect(switchLang(english, loadPlayPackage("geige"), "de")!.state).toEqual(game.state);
  });

  it("a save made in one language loads in the other", () => {
    let game = newGame(loadPlayPackage("nachtzug"), PLAY_CASES.nachtzug.clockOrigin);
    for (const line of ["u 1", "f 1"]) game = command(game, line).game;
    const saved = saveText(game);
    if (!saved.ok) throw new Error(saved.text);
    const loaded = loadSaveInLang("nachtzug", "en", saved.text);
    if (!loaded.ok) throw new Error(loaded.text);
    expect(loaded.game.lang).toBe("en");
    expect(loaded.game.state.events).toEqual(game.state.events);
    expect(loadSaveInLang("nachtzug", "en", "{}")).toEqual({ ok: false, text: MESSAGES.en.loadFailed });
  });

  it("the English page is in English and carries no internal ids", () => {
    const game = newGame(loadPlayPackage("vitrine", "en"), PLAY_CASES.vitrine.clockOrigin, "en");
    const page = renderGame(command(game, "u 1").game, "vitrine", null);
    expect(page).toContain('<html lang="en">');
    expect(page).toContain(">Investigate</h2>");
    expect(page).toContain('hreflang="de"');
    expect(page.replace(/<style>[\s\S]*?<\/style>/, "")).not.toMatch(INTERNAL_ID);
    expect(page.replace(/<style>[\s\S]*?<\/style>|<script>[\s\S]*?<\/script>/g, "")).not.toMatch(/[äöü]/);
  });
});

describe("language switch in the web app", () => {
  const request = async (app: ReturnType<typeof createWebApp>, method: string, path: string, cookie = "", body = "") => {
    const headers: Record<string, string> = {};
    let status = 0;
    let text = "";
    const req = Object.assign(new (await import("node:stream")).Readable({ read() {} }), { method, url: path, headers: { cookie, host: "localhost" } });
    req.push(body);
    req.push(null);
    const res = {
      writeHead(code: number, h: Record<string, string> = {}) {
        status = code;
        Object.assign(headers, h);
        return res;
      },
      end(chunk = "") {
        text = String(chunk);
      },
    };
    await app(req as never, res as never);
    return { status, headers, text };
  };

  it("remembers the choice in a cookie, keeps the game and redirects only locally", async () => {
    const app = createWebApp();
    const chosen = await request(app, "GET", "/sprache?l=en&zurueck=%2Ffall%2Fvitrine");
    expect(chosen.status).toBe(303);
    expect(chosen.headers.location).toBe("/fall/vitrine");
    expect(chosen.headers["set-cookie"]).toMatch(/^sprache=en; Path=\/; Max-Age=\d+/);
    expect((await request(app, "GET", "/sprache?l=en&zurueck=%2F%2Fevil.example")).headers.location).toBe("/");
    // Review: control characters crashed writeHead; a tab after "/" made "//evil.example".
    for (const back of ["%2F%0Ax", "%2F%E2%82%AC", "%2F%09%2Fevil.example", "%2Ffall%2Fvitrine%3Fx%3D1"]) {
      expect((await request(app, "GET", `/sprache?l=en&zurueck=${back}`)).headers.location).toBe("/");
    }
    expect((await request(app, "GET", "/sprache?l=en&zurueck=%2Fhilfe")).headers.location).toBe("/hilfe");

    expect((await request(app, "GET", "/fall/vitrine")).text).toContain("<h1>Die leere Vitrine</h1>");
    await request(app, "POST", "/fall/vitrine/act", "", "group=u&n=1&at=0");
    const english = await request(app, "GET", "/fall/vitrine", "sprache=en");
    expect(english.text).toContain('<html lang="en">');
    expect(english.text).toContain("<h1>The Empty Display Case</h1>");
    expect(english.text).toContain("1 action<");
    const list = await request(app, "GET", "/", "sprache=en");
    expect(list.text).toContain("<h1>Detective Cases</h1>");
    expect((await request(app, "GET", "/hilfe", "sprache=en")).text).toContain("<h1>How to investigate</h1>");
    expect((await request(app, "GET", "/fall/vitrine", "sprache=de")).text).toContain("1 Aktionen");
  });
});

describe("generated cases in English", () => {
  it("keep their German case text but get the English frame", async () => {
    const { createWebHandler } = await import("../src/play/web.ts");
    const handle = createWebHandler();
    const none = async () => null;
    const page = (await handle("GET", "/fall/zufall-42", none, "sprache=en")).body;
    expect(page).toContain('<html lang="en">');
    expect(page).toContain(">Investigate</h2>");
    expect(page).toContain("Random case 42");
    expect((await handle("GET", "/fall/zufall-42", none, "sprache=de")).body).toContain(">Untersuchen</h2>");
  });
});

describe("review fixes", () => {
  it("parseLang accepts only de/en and their regional forms", () => {
    expect(["de", "EN", "en-US", "de_AT"].map(parseLang)).toEqual(["de", "en", "en", "de"]);
    expect(["denglish", "enx", "e", "", "fr"].map(parseLang)).toEqual([null, null, null, null, null]);
  });

  it("an English variant with a missing file is refused instead of mixing in German text", () => {
    const fixtures = new URL("./fixtures/", import.meta.url).pathname;
    const copy = mkdtempSync(join(fixtures, "..", "..", "i18n-review-"));
    try {
      cpSync(join(fixtures, PLAY_CASES.geige.dir), copy, { recursive: true });
      rmSync(join(copy, "en", "evidence-presentation.json"));
      const c = { ...PLAY_CASES.geige, dir: relative(fixtures, copy) };
      expect(caseLangs(c)).toEqual(["de"]);
      expect(() => playPackageInput(c, "en")).toThrow(/evidence-presentation\.json/);
    } finally {
      rmSync(copy, { recursive: true, force: true });
    }
  });
});
