import { MAX_SEED, generateCase, generatedPackage, type CaseSchema, type GeneratedCase } from "./case-generator.ts";
import type { Difficulty } from "../play/difficulty.ts";
import { playtestRating } from "../play/playtest.ts";

// Generated case of a wished difficulty (`generate-case --difficulty 1..5`, web "Zufallsfall"):
// candidates derived from (seed, difficulty, k) are generated with a complexity suited to the
// level and rated by the playtest bot until one matches. Deterministic per seed and level.

/** Bot runs per style when rating a candidate (the playtest CLI default is 8; 4 keeps the search fast). */
export const SEARCH_BOT_SEEDS = 4;
export const MAX_CANDIDATES = 40;

// Ratings already measured in this process, keyed by candidate: a repeated search (another level
// of the same seed, a reloaded page, a test) rates each candidate once. Bounded, oldest out.
const RATED = new Map<string, Difficulty>();
const MAX_RATED = 2000;

/** Complexities tried per level, in turn (measured: higher complexity shifts the rating up). */
const COMPLEXITIES: Record<Difficulty, readonly number[]> = { 1: [0, 0, 1], 2: [0, 1, 2], 3: [2, 3, 4], 4: [3, 4, 5], 5: [5, 4, 5] };
/** Schemas a level draws from (measured: few suspects rate easy, the crowd hard). */
const SCHEMAS: Record<Difficulty, readonly CaseSchema[]> = {
  1: ["classic", "twopaths", "timewindow"],
  2: ["classic", "latecomer", "timewindow", "twopaths"],
  3: ["latecomer", "crowd", "timewindow", "classic"],
  4: ["latecomer", "crowd", "timewindow"],
  5: ["crowd", "latecomer"],
};

export type DifficultyCase = {
  readonly generated: GeneratedCase;
  readonly wished: Difficulty;
  /** The bot's rating of the chosen candidate. */
  readonly rating: Difficulty;
  /** Index of the chosen candidate (0 = the seed itself). */
  readonly candidate: number;
};

export const isDifficulty = (n: number): n is Difficulty => Number.isInteger(n) && n >= 1 && n <= 5;

/** Seed of candidate k: the seed itself first, then a hash of (seed, difficulty, k). */
function candidateSeed(seed: number, difficulty: Difficulty, k: number): number {
  if (k === 0) return seed;
  let h = 2166136261;
  for (const ch of `${seed}|${difficulty}|${k}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) % (MAX_SEED + 1);
}

/** The first candidate the bot rates at the wished level; if none within the budget, the closest one. */
export function generateCaseOfDifficulty(seed: number, difficulty: Difficulty, progress?: (candidate: number, max: number) => void): DifficultyCase {
  if (!isDifficulty(difficulty)) throw new RangeError("difficulty must be 1..5");
  const levels = COMPLEXITIES[difficulty];
  let best: DifficultyCase | null = null;
  for (let k = 0; k < MAX_CANDIDATES; k++) {
    const candidate = candidateSeed(seed, difficulty, k);
    const schemas = SCHEMAS[difficulty];
    progress?.(k, MAX_CANDIDATES);
    const schema = schemas[candidate % schemas.length]!;
    const complexity = levels[k % levels.length]!;
    const generated = generateCase(candidate, schema, { complexity });
    const key = `${candidate}|${schema}|${complexity}`;
    let rating = RATED.get(key);
    if (rating === undefined) {
      rating = playtestRating(generatedPackage(generated), SEARCH_BOT_SEEDS);
      RATED.set(key, rating);
      if (RATED.size > MAX_RATED) RATED.delete(RATED.keys().next().value!);
    }
    const found = { generated, wished: difficulty, rating, candidate: k };
    if (rating === difficulty) return found;
    if (best === null || Math.abs(rating - difficulty) < Math.abs(best.rating - difficulty)) best = found;
  }
  return best!;
}
