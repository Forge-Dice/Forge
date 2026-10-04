import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { command, intro, loadText, newGame, saveText, type Game } from "./game.ts";
import { loadVitrinePackage } from "./vitrine.ts";

// `npm run play`: "Die leere Vitrine" in the terminal over the real session reducer.

const DEFAULT_SAVE = "vitrine.save.json";

async function main(): Promise<void> {
  const pkg = loadVitrinePackage();
  let game: Game = newGame(pkg);
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
  const prompt = () => process.stdout.write(game.state.phase === "solved" ? "\n(gelöst) > " : "\n> ");
  console.log(intro(game));
  prompt();
  // Async iteration keeps every line of piped input (rl.question drops lines that arrive early).
  for await (const line of rl) {
    const [word, file = DEFAULT_SAVE] = line.trim().split(/\s+/, 2);
    if (word === "speichern") {
      writeFileSync(file, saveText(game));
      console.log(`Gespeichert in ${file} (${game.state.events.length} Aktionen).`);
    } else if (word === "laden") {
      const loaded = existsSync(file) ? loadText(pkg, readFileSync(file, "utf8")) : { ok: false as const, text: `Keine Datei ${file}.` };
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
