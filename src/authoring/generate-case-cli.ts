import { createInterface } from "node:readline/promises";
import { checkCaseFolder, formatCaseCheck } from "./check-case.ts";
import { CASE_SCHEMAS, MAX_SEED, generateCase, generatedClockOrigin, generatedPackage, writeGeneratedCase, type CaseSchema } from "./case-generator.ts";
import { command, intro, newGame, type Game } from "../play/game.ts";
import { generateCaseOfDifficulty, isDifficulty } from "./case-difficulty.ts";
import { difficultyText } from "../play/difficulty.ts";

// `npm run generate-case -- --seed N [--schema <schema> | --difficulty 1..5] [--out <ordner>] [--force] [--play]`: writes a
// generated case folder, checks it with check-case and, with --play, starts it in the terminal. A
// non-empty folder is only overwritten with --force.

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const raw = option("--seed");
// Digits only: Number("") is 0 and Number("0x10") is 16.
const seed = raw !== undefined && /^[0-9]{1,10}$/.test(raw) ? Number(raw) : Number.NaN;
const schema = option("--schema");
const level = option("--difficulty");
const difficulty = level === undefined ? undefined : /^[1-5]$/.test(level) ? Number(level) : Number.NaN;
if (!(seed <= MAX_SEED) || (schema !== undefined && !(CASE_SCHEMAS as readonly string[]).includes(schema)) || (difficulty !== undefined && (!isDifficulty(difficulty) || schema !== undefined))) {
  console.log(`Aufruf: npm run generate-case -- --seed <0..${MAX_SEED}> [--schema ${CASE_SCHEMAS.join("|")} | --difficulty 1..5] [--out <ordner>] [--force] [--play]`);
  process.exitCode = 2;
} else {
  // A wished difficulty: the playtest bot rates candidates until one matches (see case-difficulty.ts).
  const wished = difficulty !== undefined && isDifficulty(difficulty) ? generateCaseOfDifficulty(seed, difficulty) : null;
  const generated = wished?.generated ?? generateCase(seed, schema as CaseSchema | undefined);
  if (wished !== null) {
    const hit = wished.rating === wished.wished ? "getroffen" : `nicht getroffen, nächster Kandidat`;
    console.log(`Stufe ${wished.wished} ${hit}: ${difficultyText(wished.rating)} (Kandidat ${wished.candidate}, Komplexität ${generated.complexity})`);
  }
  const dir = option("--out") ?? `generated/fall-${seed}${wished === null ? "" : `-stufe-${wished.wished}`}`;
  let files: string[];
  try {
    files = writeGeneratedCase(generated, dir, { force: args.includes("--force") });
  } catch (error) {
    console.log((error as Error).message);
    process.exit(2);
  }
  console.log(`„${generated.title}“ (Seed ${seed}${generated.seed === seed ? "" : `, Fallseed ${generated.seed}`}, Schema ${generated.schema}${generated.withLie ? ", mit Lüge" : ""}): ${files.length} Dateien in ${dir}`);
  const check = checkCaseFolder(dir);
  console.log(formatCaseCheck(check));
  if (!check.ok) process.exitCode = 1;
  else if (args.includes("--play")) await play(newGame(generatedPackage(generated), generatedClockOrigin(generated)));
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
