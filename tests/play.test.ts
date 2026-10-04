import { describe, expect, it } from "vitest";
import { command, intro, loadText, newGame, saveText, type Game } from "../src/play/game.ts";
import { loadVitrinePackage } from "../src/play/vitrine.ts";

const pkg = loadVitrinePackage();
const INTERNAL_ID = /\b(person|location|item|event|evidence|proposition|conclusion):[a-z0-9]/;

/** Runs commands in order and returns the final game and all printed text. */
function run(lines: string[], from: Game = newGame(pkg)) {
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
    const text = intro(newGame(pkg)) + run(["fall", "bekannt", "u", "f", "a", "journal"]).all;
    expect(text).toContain("Wer entnahm die Medaille eigenhändig?");
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
    expect(after.texts[1]).toContain("Nora Weiss: Kann ich den vollständigen Film dieses Hoffototermins sehen?");
  });

  it("plays to the solution through the real session: Hof, Kamera, Archivterminal, then Lina", () => {
    let { game, texts } = run(["u"]);
    ({ game } = run([`u ${numberOf(texts[0]!, "Innenhof")}`], game));
    let listing = command(game, "f").text;
    ({ game } = run([`f ${numberOf(listing, "vollständigen Film")}`], game));
    listing = command(game, "u").text;
    let step = command(game, `u ${numberOf(listing, "Noras Kamera")}`);
    expect(step.text).toContain("Fund: Vollständiger Hoffilm");
    game = step.game;
    listing = command(game, "f").text;
    ({ game } = run([`f ${numberOf(listing, "unabhängige Archivnachweis")}`], game));
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
    const base = newGame(pkg);
    for (const line of ["u 99", "f 0", "a x", "quatsch", ""]) {
      const step = command(base, line);
      expect(step.game).toBe(base);
    }
    expect(command(base, "ende").quit).toBe(true);
  });

  it("save and load replay the exact state", () => {
    const { game } = run(["u 1", "u 3", "f 1", "a 1"]);
    const loaded = loadText(pkg, saveText(game));
    expect(loaded).toEqual({ ok: true, game: { pkg, state: game.state } });
    expect(run(["journal"], (loaded as { game: Game }).game).all).toBe(run(["journal"], game).all);
  });

  it("broken, foreign or tampered saves are refused", () => {
    const { game } = run(["u 1", "f 1"]);
    const save = JSON.parse(saveText(game));
    expect(loadText(pkg, "{").ok).toBe(false);
    expect(loadText(pkg, JSON.stringify({ ...save, format: "x" })).ok).toBe(false);
    expect(loadText(pkg, JSON.stringify({ ...save, packageHash: "0".repeat(64) })).ok).toBe(false);
    // An event the player never could have done at that point fails the replay.
    const forged = { ...save, events: [{ ...save.events[0], target: pkg.refs.refFor("item", "item:terminal") }] };
    expect(loadText(pkg, JSON.stringify(forged))).toEqual({ ok: false, text: "Der Spielstand ist ungültig." });
  });
});
