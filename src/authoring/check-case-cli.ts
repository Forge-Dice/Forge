import { checkCaseFolder, formatCaseCheck, writeFilledHashes } from "./check-case.ts";
import { loadFolderPackage } from "../play/cases.ts";
import { formatPlaytest, playtestCase } from "../play/playtest.ts";

// `npm run check-case -- [--fix] [--ohne-spieltest] <ordner>`: exit code 0 when the case folder is
// valid and solvable. --fix writes computed hashes into TO_BE_COMPUTED placeholders and over
// outdated hash values. A valid case is then played by the playtest bot; its balance warnings are
// printed as hints and never change the exit code.

const PLAYTEST_SEEDS = 4;
const args = process.argv.slice(2);
const fix = args.includes("--fix");
const playtest = !args.includes("--ohne-spieltest");
const dirs = args.filter((a) => a !== "--fix" && a !== "--ohne-spieltest");
if (dirs.length === 0) {
  console.log("Aufruf: npm run check-case -- [--fix] [--ohne-spieltest] <fall-ordner> [weitere Ordner]");
  process.exitCode = 2;
} else {
  for (const dir of dirs) {
    let check = checkCaseFolder(dir);
    if (fix && check.filled.length > 0) {
      console.log(`--fix: Hashes eingetragen in ${writeFilledHashes(check).join(", ")}`);
      check = checkCaseFolder(dir);
    }
    console.log(formatCaseCheck(check));
    if (!check.ok) process.exitCode = 1;
    else if (playtest && check.play !== undefined) {
      try {
        const pkg = loadFolderPackage(dir, check.play.npcs, check.play.salt);
        console.log(`Spieltest (${PLAYTEST_SEEDS} Läufe je Spielstil):\n${formatPlaytest(pkg, playtestCase(pkg, PLAYTEST_SEEDS))}`);
      } catch (error) {
        console.log(`  Hinweis Spieltest: nicht möglich (${(error as Error).message})`);
      }
    }
  }
}
