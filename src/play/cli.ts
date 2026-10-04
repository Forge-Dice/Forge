import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { command, intro, newGame, saveText, type Game } from "./game.ts";
import { PLAY_CASES, caseListText, loadPlayPackage, loadSaveInLang, playCaseName } from "./cases.ts";
import { DEFAULT_LANG, MESSAGES, parseLang, type Lang } from "./messages.ts";

// `npm run play [-- <fall>] [--lang en]`: a case in the terminal over the real session reducer.
// Cases: see PLAY_CASES in cases.ts (vitrine is the default); `npm run play -- liste` lists them.
// Languages: de (default), en.

/** `--lang en`, `--lang=en`; the rest are positional arguments. */
function parseArgs(argv: readonly string[]): { positional: string[]; lang: string | null } {
  const positional: string[] = [];
  let lang: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--lang") lang = argv[++i] ?? "";
    else if (arg.startsWith("--lang=")) lang = arg.slice("--lang=".length);
    else positional.push(arg);
  }
  return { positional, lang };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const lang: Lang | null = args.lang === null ? DEFAULT_LANG : parseLang(args.lang);
  if (lang === null) {
    console.log(MESSAGES[DEFAULT_LANG].cli.unknownLang(args.lang ?? ""));
    process.exitCode = 1;
    return;
  }
  const m = MESSAGES[lang];
  if (["liste", "fälle", "list", "cases"].includes(args.positional[0] ?? "")) {
    console.log(caseListText(lang));
    return;
  }
  const name = playCaseName(args.positional[0]);
  if (name === null) {
    console.log(`${m.cli.unknownCase(args.positional[0] ?? "")}\n${caseListText(lang)}`);
    process.exitCode = 1;
    return;
  }
  const { clockOrigin } = PLAY_CASES[name];
  const DEFAULT_SAVE = `${PLAY_CASES[name].dir}.save.json`;
  const pkg = loadPlayPackage(name, lang);
  let game: Game = newGame(pkg, clockOrigin, lang === DEFAULT_LANG ? undefined : lang);
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
  const prompt = () => process.stdout.write(game.state.phase === "solved" ? `\n${m.cli.solvedPrompt}` : "\n> ");
  console.log(intro(game));
  prompt();
  // Async iteration keeps every line of piped input (rl.question drops lines that arrive early).
  for await (const line of rl) {
    const [word, file = DEFAULT_SAVE] = line.trim().split(/\s+/, 2);
    if (word === "speichern" || word === "save") {
      const saved = saveText(game);
      if (saved.ok) writeFileSync(file, saved.text);
      console.log(saved.ok ? m.cli.saved(file, game.state.events.length) : saved.text);
    } else if (word === "laden" || word === "load") {
      const loaded = existsSync(file)
        ? loadSaveInLang(name, lang, readFileSync(file, "utf8"), (l) => (l === lang ? pkg : loadPlayPackage(name, l)))
        : { ok: false as const, text: m.cli.noFile(file) };
      if (loaded.ok) game = loaded.game;
      console.log(loaded.ok ? m.cli.loaded(game.state.events.length) : loaded.text);
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
