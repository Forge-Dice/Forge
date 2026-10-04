import { checkCaseFolder, formatCaseCheck, writeFilledHashes } from "./check-case.ts";

// `npm run check-case -- [--fix] <ordner>`: exit code 0 when the case folder is valid and solvable.
// --fix writes computed hashes into fields that still hold the TO_BE_COMPUTED placeholder.

const args = process.argv.slice(2);
const fix = args.includes("--fix");
const dirs = args.filter((a) => a !== "--fix");
if (dirs.length === 0) {
  console.log("Aufruf: npm run check-case -- [--fix] <fall-ordner> [weitere Ordner]");
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
  }
}
