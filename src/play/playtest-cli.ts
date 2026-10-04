import { PLAY_CASES, loadPlayPackage, playCaseName, type PlayCaseName } from "./cases.ts";
import { DEFAULT_SEEDS, formatPlaytest, playtestCase } from "./playtest.ts";

// `npm run playtest -- <fall|all> [--seeds N]`: simulated players (systematic, curious, hasty,
// hint-reliant) play the case over the real session; prints difficulty, metrics and balance
// warnings. Exit code 1 when a case's stored difficulty in cases.ts differs from the measured one.

const args = process.argv.slice(2);
const seedsAt = args.indexOf("--seeds");
const rawSeeds = args[seedsAt + 1] ?? "";
const seeds = seedsAt === -1 ? DEFAULT_SEEDS : /^[1-9][0-9]*$/.test(rawSeeds) ? Number(rawSeeds) : Number.NaN;
const names = args.filter((_, i) => seedsAt === -1 || (i !== seedsAt && i !== seedsAt + 1));
const wanted = names.length === 0 || names.includes("all") ? (Object.keys(PLAY_CASES) as PlayCaseName[]) : names.map(playCaseName);

if (!Number.isInteger(seeds) || seeds < 1) {
  console.log("Aufruf: npm run playtest -- <fall|all> [--seeds N]");
  process.exitCode = 2;
} else if (wanted.includes(null)) {
  console.log(`Unbekannter Fall. Verfügbar: ${Object.keys(PLAY_CASES).join(", ")}, all.`);
  process.exitCode = 2;
} else {
  for (const name of wanted as PlayCaseName[]) {
    const pkg = loadPlayPackage(name);
    const report = playtestCase(pkg, seeds);
    console.log(`${pkg.publicContent.title} (${name}), ${seeds} Läufe je Spielstil`);
    console.log(formatPlaytest(pkg, report));
    const stored = PLAY_CASES[name].difficulty;
    if (seeds === DEFAULT_SEEDS && stored !== report.rating) {
      console.log(`  ACHTUNG: in src/play/cases.ts steht difficulty: ${stored ?? "–"}, gemessen ${report.rating}. Bitte eintragen.`);
      process.exitCode = 1;
    }
    console.log("");
  }
}
