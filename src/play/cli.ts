import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { command, intro, loadText, newGame, saveText, type Game } from "./game.ts";
import { PLAY_CASES, loadPlayPackage, playCaseName } from "./cases.ts";

// `npm run play [-- <fall>]`: a case in the terminal over the real session reducer.
// Cases: vitrine (default), brieföffner, geige.

async function main(): Promise<void> {
  const name = playCaseName(process.argv[2]);
  if (name === null) {
    console.log(`Unbekannter Fall „${process.argv[2]}“. Verfügbar: ${Object.keys(PLAY_CASES).join(", ")}.`);
    process.exitCode = 1;
    return;
  }
  const { clockOrigin } = PLAY_CASES[name];
  const DEFAULT_SAVE = `${PLAY_CASES[name].dir}.save.json`;
  const pkg = loadPlayPackage(name);
  let game: Game = newGame(pkg, clockOrigin);
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
  const prompt = () => process.stdout.write(game.state.phase === "solved" ? "\n(gelöst) > " : "\n> ");
  console.log(intro(game));
  prompt();
  // Async iteration keeps every line of piped input (rl.question drops lines that arrive early).
  for await (const line of rl) {
    const [word, file = DEFAULT_SAVE] = line.trim().split(/\s+/, 2);
    if (word === "speichern") {
      const saved = saveText(game);
      if (saved.ok) writeFileSync(file, saved.text);
      console.log(saved.ok ? `Gespeichert in ${file} (${game.state.events.length} Aktionen).` : saved.text);
    } else if (word === "laden") {
      const loaded = existsSync(file) ? loadText(pkg, readFileSync(file, "utf8"), clockOrigin) : { ok: false as const, text: `Keine Datei ${file}.` };
      if (loaded.ok) game = loaded.game;
      console.log(loaded.ok ? `Geladen: ${game.state.events.length} Aktionen.` : loaded.text);
    } else {
      const step = command(game, line);
      game = step.game;
      if (step.text !== "") console.log(step.text);
      if (step.quit) break;
    }
    prompt();
  }
  rl.close();
}

await main();
