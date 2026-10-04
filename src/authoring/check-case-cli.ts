import { checkCaseFolder, formatCaseCheck } from "./check-case.ts";

// `npm run check-case -- <ordner>`: exit code 0 when the case folder is valid and solvable.

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
  console.log("Aufruf: npm run check-case -- <fall-ordner> [weitere Ordner]");
  process.exitCode = 2;
} else {
  for (const dir of dirs) {
    const check = checkCaseFolder(dir);
    console.log(formatCaseCheck(check));
    if (!check.ok) process.exitCode = 1;
  }
}
