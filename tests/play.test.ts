import { describe, expect, it } from "vitest";
import { command, intro, loadText, newGame, saveText, type Game } from "../src/play/game.ts";
import { PLAY_CASES, loadPlayPackage, playCaseName } from "../src/play/cases.ts";
import { createHash } from "node:crypto";
import { serializeSessionJson } from "../src/domain/case-package.identity.ts";
import { decodeSessionSave } from "../src/domain/case-session-save.ts";

const pkg = loadPlayPackage("vitrine");
const start = () => newGame(pkg, PLAY_CASES.vitrine.clockOrigin);
const INTERNAL_ID = /\b(person|location|item|event|evidence|proposition|conclusion):[a-z0-9]/;

/** Runs commands in order and returns the final game and all printed text. */
function run(lines: string[], from: Game = start()) {
  let game = from;
  const texts: string[] = [];
  for (const line of lines) {
    const step = command(game, line);
    game = step.game;
    texts.push(step.text);
  }
  return { game, texts, all: texts.join("\n") };
}

const numberOf = (listing: string, needle: string) => {
  const line = listing.split("\n").find((l) => l.includes(needle));
  if (line === undefined) throw new Error(`"${needle}" not offered in:\n${listing}`);
  return line.trim().split(".")[0]!;
};

describe("npm run play: Die leere Vitrine", () => {
  it("loads the real package and shows only public content", () => {
    expect(pkg.publicContent.title).toBe("Die leere Vitrine");
    const text = intro(start()) + run(["fall", "bekannt", "u", "f", "a", "journal"]).all;
    expect(text).toContain("Wer hat die Medaille um 18:04 eigenhändig aus der Vitrine genommen?");
    expect(text).not.toMatch(INTERNAL_ID);
    expect(text).not.toMatch(/pr1_/);
  });

  it("offers only actions on known entities and grows them from releases", () => {
    const start = run(["u", "f"]);
    expect(start.texts[0]).not.toContain("Noras Kamera");
    expect(start.texts[1]).not.toContain("vollständigen Film");
    const hof = numberOf(start.texts[0]!, "Ort durchsuchen: Innenhof");
    const after = run([`u ${hof}`, "f"]);
    expect(after.texts[0]).toContain("Fund: Kontaktbogen");
    expect(after.texts[1]).toContain("Nora Weiss: Lief Ihre Kamera beim Fototermin im Hof die ganze Zeit?");
  });

  it("plays to the solution through the real session: Hof, Kamera, Archivterminal, then Lina", () => {
    let { game, texts } = run(["u"]);
    ({ game } = run([`u ${numberOf(texts[0]!, "Innenhof")}`], game));
    let listing = command(game, "f").text;
    ({ game } = run([`f ${numberOf(listing, "Lief Ihre Kamera")}`], game));
    listing = command(game, "u").text;
    let step = command(game, `u ${numberOf(listing, "Noras Kamera")}`);
    expect(step.text).toContain("Fund: Vollständiger Hoffilm");
    game = step.game;
    listing = command(game, "f").text;
    ({ game } = run([`f ${numberOf(listing, "Zeichnet im Archiv ein Gerät auf")}`], game));
    listing = command(game, "u").text;
    step = command(game, `u ${numberOf(listing, "Archivterminal")}`);
    expect(step.text).toContain("Fund: Archivaufnahme");
    game = step.game;

    const wrong = command(game, `a ${numberOf(command(game, "a").text, "Max Brandt")}`);
    expect(wrong.text).toContain("noch nicht");
    expect(wrong.game.state.phase).toBe("active");

    const right = command(wrong.game, `a ${numberOf(command(game, "a").text, "Lina Kern")}`);
    expect(right.text).toContain("Fall gelöst");
    expect(right.game.state.phase).toBe("solved");
    expect(right.game.state.verdicts.map((v) => v.verdict)).toEqual(["not_solved", "solved"]);
    expect(command(right.game, "u 1").text).toBe("Der Fall ist bereits gelöst.");
    expect(command(right.game, "f").text).toContain("nichts verfügbar");
  });

  it("the correct answer also solves from the start (D8: no evidence gate)", () => {
    const { game, texts } = run(["a 2"]);
    expect(texts[0]).toContain("Lina Kern");
    expect(game.state.phase).toBe("solved");
  });

  it("rejected or unknown commands change nothing", () => {
    const base = start();
    for (const line of ["u 99", "f 0", "a x", "quatsch", ""]) {
      const step = command(base, line);
      expect(step.game).toBe(base);
    }
    expect(command(base, "ende").quit).toBe(true);
  });

  const saved = (game: Game) => {
    const result = saveText(game);
    if (!result.ok) throw new Error(result.text);
    return result.text;
  };

  it("save and load replay the exact state in the Session C format", () => {
    const { game } = run(["u 1", "u 3", "f 1", "a 1"]);
    const text = saved(game);
    expect(decodeSessionSave(pkg, text)).toEqual({ ok: true, state: game.state });
    const loaded = loadText(pkg, text, PLAY_CASES.vitrine.clockOrigin);
    expect(loaded).toEqual({ ok: true, game: { pkg, state: game.state, clockOrigin: PLAY_CASES.vitrine.clockOrigin } });
    expect(run(["journal"], (loaded as { game: Game }).game).all).toBe(run(["journal"], game).all);
  });

  it("broken, foreign, reformatted or tampered saves are refused with one message", () => {
    const { game } = run(["u 1", "f 1"]);
    const text = saved(game);
    const save = JSON.parse(text);
    const refused = { ok: false, text: "Der Spielstand kann nicht geladen werden." };
    expect(loadText(pkg, "{")).toEqual(refused);
    expect(loadText(pkg, JSON.stringify(save, null, 2))).toEqual(refused);
    expect(loadText(pkg, text.replace(save.packageIdentity.packageHash, "0".repeat(64)))).toEqual(refused);
    expect(loadText(pkg, text.replace(save.checksum, "f".repeat(64)))).toEqual(refused);
    // An event the player never could have done at that point fails the replay, even re-checksummed.
    const events = [{ ...save.events[0], target: pkg.refs.refFor("item", "item:terminal") }];
    const body = { schemaVersion: 1, packageIdentity: save.packageIdentity, events };
    const checksum = createHash("sha256").update(`forge-session-save-v1\n${serializeSessionJson(body)}`).digest("hex");
    expect(decodeSessionSave(pkg, serializeSessionJson({ ...body, checksum }))).toEqual({ ok: false, code: "INVALID_HISTORY" });
    expect(loadText(pkg, serializeSessionJson({ ...body, checksum }))).toEqual(refused);
  });
});

describe("npm run play -- brieföffner", () => {
  it("resolves the case name with or without umlauts", () => {
    expect(playCaseName(undefined)).toBe("vitrine");
    expect(playCaseName("brieföffner")).toBe("brieföffner");
    expect(playCaseName("Briefoeffner")).toBe("brieföffner");
    expect(playCaseName("brieffoeffner")).toBe("brieföffner");
    expect(playCaseName("keller")).toBeNull();
  });

  it("plays Der Brieföffner to the solution with its own clock and accusation list", () => {
    const brief = loadPlayPackage("brieföffner");
    let game = newGame(brief, PLAY_CASES["brieföffner"].clockOrigin);
    const step = (line: string) => {
      const result = command(game, line);
      game = result.game;
      return result.text;
    };
    const u = step("u");
    expect(step(`u ${numberOf(u, "Bibliothek")}`)).toContain("Fund: Manschettenknopf");
    expect(step(`u ${numberOf(u, "Garten")}`)).toContain("Anna war um 20:25:00 am Ort „Garten“");
    const accuse = step("a");
    expect(accuse).toContain("Wer ist für Claras Tod verantwortlich?");
    expect(step(`a ${numberOf(accuse, "Anna")}`)).toContain("noch nicht");
    expect(step(`a ${numberOf(accuse, "Ben")}`)).toContain("Fall gelöst");
    expect(run(["journal"], game).all).not.toMatch(INTERNAL_ID);
  });
});
