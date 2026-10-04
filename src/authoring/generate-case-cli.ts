import { createInterface } from "node:readline/promises";
import { checkCaseFolder, formatCaseCheck } from "./check-case.ts";
import { generateCase, generatedPackage, writeGeneratedCase } from "./case-generator.ts";
import { command, intro, newGame, type Game } from "../play/game.ts";

// `npm run generate-case -- --seed N [--out <ordner>] [--play]`: writes a generated case folder,
// checks it with check-case and, with --play, starts it in the terminal.

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const seed = Number(option("--seed"));
if (!Number.isSafeInteger(seed) || seed < 0) {
  console.log("Aufruf: npm run generate-case -- --seed <zahl> [--out <ordner>] [--play]");
  process.exitCode = 2;
} else {
  const generated = generateCase(seed);
  const dir = option("--out") ?? `generated/fall-${seed}`;
  const files = writeGeneratedCase(generated, dir);
  console.log(`„${generated.title}“ (Seed ${seed}${generated.withLie ? ", mit Lüge" : ""}): ${files.length} Dateien in ${dir}`);
  const check = checkCaseFolder(dir);
  console.log(formatCaseCheck(check));
  if (!check.ok) process.exitCode = 1;
  else if (args.includes("--play")) await play(newGame(generatedPackage(generated), (generated.files["case.json"] as { clockOrigin: number }).clockOrigin));
}

async function play(start: Game): Promise<void> {
  let game = start;
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
  const prompt = () => process.stdout.write(game.state.phase === "solved" ? "\n(gelöst) > " : "\n> ");
  console.log(`\n${intro(game)}`);
  prompt();
  for await (const line of rl) {
    const step = command(game, line);
    game = step.game;
    if (step.text !== "") console.log(step.text);
    if (step.quit) break;
    prompt();
  }
  rl.close();
}
