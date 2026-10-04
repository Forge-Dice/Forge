import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCaseTruth } from "../domain/case-truth.ts";
import { resolveCasePackage, type PackageRefSource, type ResolvedCasePackage, type RulesetVersion } from "../domain/case-package.ts";
import { buildPlayerRefIndex, playerRefFor, resolvePlayerRef } from "../domain/player-ref.ts";
import { bindCaseProof } from "../authoring/check-case.ts";
import { difficultyDots, type Difficulty } from "./difficulty.ts";
import { DEFAULT_LANG, MESSAGES, type Lang } from "./messages.ts";
import { loadText, switchLang, type Game } from "./game.ts";
import { registerPar } from "./score.ts";

// Trusted host side of the play CLI: loads a playable case from its fixture files and resolves it
// into one immutable case package. The package input is private (it holds the answer key); the
// player only ever sees what the session releases plus PublicContent.

export type PlayCase = {
  /** Fixture directory below tests/fixtures/. */
  readonly dir: string;
  readonly npcs: readonly string[];
  /** Authoring salt (MYST-0001 D2); fixed so that saves stay replayable. */
  readonly salt: string;
  /** Display convention: wall-clock seconds of timeline second 0. */
  readonly clockOrigin: number;
  /** Play runs every case under v3 (hints); see RULESET_VERSIONS in case-package.ts. */
  readonly rulesetVersion: RulesetVersion;
  /** Measured by `npm run playtest` (default seeds); a test keeps it in step with the bot. */
  readonly difficulty?: Difficulty;
  /** Actions of the playtest bot's systematic player; the score's target (score.ts), test-checked. */
  readonly par?: number;
};

export const PLAY_CASES = {
  lernfall: { dir: "lernfall", npcs: ["jonas", "mila"], salt: "1ea51ea51ea51ea51ea51ea51ea51ea5", clockOrigin: 16 * 3600, rulesetVersion: "mystery-session-v3", difficulty: 2, par: 10 },
  vitrine: { dir: "vitrine", npcs: ["lina", "max", "nora", "oskar"], salt: "5a175a175a175a175a175a175a175a17", clockOrigin: 18 * 3600, rulesetVersion: "mystery-session-v3", difficulty: 5, par: 28 },
  "brieföffner": { dir: "brieffoeffner", npcs: ["anna", "ben"], salt: "b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0", clockOrigin: 20 * 3600, rulesetVersion: "mystery-session-v3", difficulty: 4, par: 18 },
  geige: { dir: "geige", npcs: ["ida", "kurt", "paul", "vera"], salt: "6e16e16e16e16e16e16e16e16e16e16e", clockOrigin: 20 * 3600, rulesetVersion: "mystery-session-v3", difficulty: 3, par: 8 },
  "hüttenkasse": { dir: "huettenkasse", npcs: ["rosa", "lukas", "mira", "gerd", "tobias"], salt: "4a774a774a774a774a774a774a774a77", clockOrigin: 21 * 3600, rulesetVersion: "mystery-session-v3", difficulty: 4, par: 10 },
  nachtzug: { dir: "nachtzug", npcs: ["janek", "felix", "bruno", "dora", "clara"], salt: "7a147a147a147a147a147a147a147a14", clockOrigin: 0, rulesetVersion: "mystery-session-v3", difficulty: 4, par: 15 },
  leuchtfeuer: { dir: "leuchtfeuer", npcs: ["hinrich", "frauke", "ole", "marlene", "jasper", "knut"], salt: "1e0c1e0c1e0c1e0c1e0c1e0c1e0c1e0c", clockOrigin: 0, rulesetVersion: "mystery-session-v3", difficulty: 4, par: 9 },
  "preiskürbis": { dir: "preiskuerbis", npcs: ["alois", "hilde", "sepp", "lotte", "resi", "ferdl"], salt: "c4b1c4b1c4b1c4b1c4b1c4b1c4b1c4b1", clockOrigin: 14 * 3600, rulesetVersion: "mystery-session-v3", difficulty: 4, par: 10 },
} as const satisfies Record<string, PlayCase>;
export type PlayCaseName = keyof typeof PLAY_CASES;

/** Accepts the case name, its umlaut-free spelling ("briefoeffner") or its fixture directory. */
export function playCaseName(input: string | undefined): PlayCaseName | null {
  const name = (input ?? "vitrine").toLowerCase();
  const found = Object.entries(PLAY_CASES).find(([key, c]) => name === key || name === key.replace("ö", "oe").replace("ü", "ue") || name === c.dir);
  return found === undefined ? null : (found[0] as PlayCaseName);
}

const fixtureDir = (c: PlayCase) => new URL(`../../tests/fixtures/${c.dir}/`, import.meta.url);

/** The trusted ref adapter of MYST-SESSION-0001A §2 around the real PlayerRef index. */
export function refSource(truthInput: unknown, salt: string): PackageRefSource {
  const built = buildPlayerRefIndex(parseCaseTruth(truthInput), salt);
  if (!built.success) throw new Error(`PlayerRef index: ${built.code}`);
  const { index } = built;
  return {
    caseId: index.caseId,
    truthHash: index.truthHash,
    config: { profile: index.profile, saltHex: salt },
    refFor: (kind, id) => playerRefFor(index, kind, id),
    resolve: (ref) => {
      const resolved = resolvePlayerRef(index, ref);
      return resolved.success ? ({ kind: resolved.kind, id: resolved.id } as ReturnType<PackageRefSource["resolve"]>) : null;
    },
  };
}

/**
 * Player text files a locale variant replaces (in tests/fixtures/<case>/<lang>/). Truth, solution,
 * access, NPCs and proof stay shared, so every language plays the same case with the same refs.
 */
export const LOCALE_FILES = ["public-content.json", "evidence-presentation.json"] as const;

const readFixture = (c: PlayCase, name: string, lang: Lang = DEFAULT_LANG): unknown => {
  const localized = new URL(`${lang}/${name}`, fixtureDir(c));
  const url = lang !== DEFAULT_LANG && (LOCALE_FILES as readonly string[]).includes(name) && existsSync(localized) ? localized : new URL(name, fixtureDir(c));
  return JSON.parse(readFileSync(url, "utf8"));
};

/** Languages a case has player text for: the default plus every locale folder. */
export const caseLangs = (c: PlayCase): Lang[] => [DEFAULT_LANG, ...(["en"] as const).filter((l) => existsSync(new URL(`${l}/public-content.json`, fixtureDir(c))))];

/** The case list of the CLI: name, title and measured difficulty, one case per line. */
export function caseListText(lang: Lang = DEFAULT_LANG): string {
  const m = MESSAGES[lang];
  const rows = (Object.entries(PLAY_CASES) as [PlayCaseName, PlayCase][]).map(([name, c]) => {
    const title = (readFixture(c, "public-content.json", lang) as { title: string }).title;
    const difficulty = c.difficulty === undefined ? m.cli.notMeasured : `${difficultyDots(c.difficulty)} ${m.difficulty[c.difficulty]}`;
    return `  ${name.padEnd(12)} ${difficulty.padEnd(17)} ${title}`;
  });
  return [m.cli.caseListHead, ...rows].join("\n");
}

export function playPackageInput(c: PlayCase, lang: Lang = DEFAULT_LANG): Record<string, unknown> {
  return packageInputFrom((name) => readFixture(c, name, lang), c.npcs, c.rulesetVersion);
}

function packageInputFrom(read: (name: string) => unknown, npcs: readonly string[], rulesetVersion: RulesetVersion): Record<string, unknown> {
  return {
    schemaVersion: 1,
    rulesetVersion,
    truth: read("truth.json"),
    solution: read("solution.json"),
    access: read("evidence-access.json"),
    presentation: read("evidence-presentation.json"),
    catalogue: read("questions.json"),
    npcs: npcs.map((npc) => ({ snapshot: read(`npc-${npc}.json`), profile: read(`interrogation-${npc}.json`) })),
    initial: read("initial-setup.json"),
    challenge: read("challenge.json"),
    publicContent: read("public-content.json"),
    // Bound in loadPlayPackage: hints (ruleset v3) are derived from the release manifest's witness.
    proof: null,
  };
}

function bindAndResolve(read: (name: string) => unknown, input: Record<string, unknown>, salt: string, what: string): ResolvedCasePackage {
  input.proof = bindCaseProof(input as Parameters<typeof bindCaseProof>[0], read("release-manifest.json"), read("proof-profile.json"), salt);
  const result = resolveCasePackage(input, refSource(input.truth, salt));
  if (!result.ok) throw new Error(`Case package "${what}" rejected: ${JSON.stringify(result.findings)}`);
  return result.package;
}

export function loadPlayPackage(name: PlayCaseName, lang: Lang = DEFAULT_LANG): ResolvedCasePackage {
  const c = PLAY_CASES[name];
  const pkg = bindAndResolve((file) => readFixture(c, file), playPackageInput(c, lang), c.salt, name);
  if (c.par !== undefined) registerPar(pkg, c.par);
  return pkg;
}

/**
 * Loads a save in the player's language. A save names its package, and each language is its own
 * package, so a save made in another language is loaded there and replayed in this one.
 */
export function loadSaveInLang(
  name: PlayCaseName,
  lang: Lang,
  text: string,
  packages: (lang: Lang) => ResolvedCasePackage = (l) => loadPlayPackage(name, l),
): { ok: true; game: Game } | { ok: false; text: string } {
  const { clockOrigin } = PLAY_CASES[name];
  const pkg = packages(lang);
  const direct = loadText(pkg, text, clockOrigin, lang === DEFAULT_LANG ? undefined : lang);
  if (direct.ok) return direct;
  for (const other of caseLangs(PLAY_CASES[name]).filter((l) => l !== lang)) {
    const loaded = loadText(packages(other), text, clockOrigin);
    const moved = loaded.ok ? switchLang(loaded.game, pkg, lang) : null;
    if (moved !== null) return { ok: true, game: moved };
  }
  return direct;
}

/** Any case folder (already passed check-case) as a package under the play ruleset (hints on). */
export function loadFolderPackage(dir: string, npcs: readonly string[], salt: string): ResolvedCasePackage {
  const read = (name: string): unknown => JSON.parse(readFileSync(join(dir, name), "utf8"));
  return bindAndResolve(read, packageInputFrom(read, npcs, "mystery-session-v3"), salt, dir);
}

/** An imported case (file name -> text, already passed check-case) as a package under the play ruleset. */
export function loadFilesPackage(files: Readonly<Record<string, string>>, npcs: readonly string[], salt: string, what: string): ResolvedCasePackage {
  const read = (name: string): unknown => {
    if (!Object.hasOwn(files, name)) throw new Error(`${name} fehlt`);
    return JSON.parse(files[name]!);
  };
  return bindAndResolve(read, packageInputFrom(read, npcs, "mystery-session-v3"), salt, what);
}
