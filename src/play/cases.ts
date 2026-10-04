import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCaseTruth } from "../domain/case-truth.ts";
import { resolveCasePackage, type PackageRefSource, type ResolvedCasePackage, type RulesetVersion } from "../domain/case-package.ts";
import { buildPlayerRefIndex, playerRefFor, resolvePlayerRef } from "../domain/player-ref.ts";
import { bindCaseProof } from "../authoring/check-case.ts";
import { difficultyText, type Difficulty } from "./difficulty.ts";

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
};

export const PLAY_CASES = {
  vitrine: { dir: "vitrine", npcs: ["lina", "max", "nora", "oskar"], salt: "5a175a175a175a175a175a175a175a17", clockOrigin: 18 * 3600, rulesetVersion: "mystery-session-v3", difficulty: 5 },
  "brieföffner": { dir: "brieffoeffner", npcs: ["anna", "ben"], salt: "b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0", clockOrigin: 20 * 3600, rulesetVersion: "mystery-session-v3", difficulty: 1 },
  geige: { dir: "geige", npcs: ["ida", "kurt", "paul", "vera"], salt: "6e16e16e16e16e16e16e16e16e16e16e", clockOrigin: 20 * 3600, rulesetVersion: "mystery-session-v3", difficulty: 3 },
  "hüttenkasse": { dir: "huettenkasse", npcs: ["rosa", "lukas", "mira", "gerd", "tobias"], salt: "4a774a774a774a774a774a774a774a77", clockOrigin: 21 * 3600, rulesetVersion: "mystery-session-v3", difficulty: 4 },
  nachtzug: { dir: "nachtzug", npcs: ["janek", "felix", "bruno", "dora", "clara"], salt: "7a147a147a147a147a147a147a147a14", clockOrigin: 0, rulesetVersion: "mystery-session-v3", difficulty: 4 },
  leuchtfeuer: { dir: "leuchtfeuer", npcs: ["hinrich", "frauke", "ole", "marlene", "jasper", "knut"], salt: "1e0c1e0c1e0c1e0c1e0c1e0c1e0c1e0c", clockOrigin: 0, rulesetVersion: "mystery-session-v3", difficulty: 4 },
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

const readFixture = (c: PlayCase, name: string): unknown => JSON.parse(readFileSync(new URL(name, fixtureDir(c)), "utf8"));

/** The case list of the CLI: name, title and measured difficulty, one case per line. */
export function caseListText(): string {
  const rows = (Object.entries(PLAY_CASES) as [PlayCaseName, PlayCase][]).map(([name, c]) => {
    const title = (readFixture(c, "public-content.json") as { title: string }).title;
    return `  ${name.padEnd(12)} ${c.difficulty === undefined ? "(nicht gemessen)".padEnd(17) : difficultyText(c.difficulty).padEnd(17)} ${title}`;
  });
  return ["Fälle (Schwierigkeit gemessen mit npm run playtest):", ...rows].join("\n");
}

export function playPackageInput(c: PlayCase): Record<string, unknown> {
  return packageInputFrom((name) => readFixture(c, name), c.npcs, c.rulesetVersion);
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

export function loadPlayPackage(name: PlayCaseName): ResolvedCasePackage {
  const c = PLAY_CASES[name];
  return bindAndResolve((file) => readFixture(c, file), playPackageInput(c), c.salt, name);
}

/** Any case folder (already passed check-case) as a package under the play ruleset (hints on). */
export function loadFolderPackage(dir: string, npcs: readonly string[], salt: string): ResolvedCasePackage {
  const read = (name: string): unknown => JSON.parse(readFileSync(join(dir, name), "utf8"));
  return bindAndResolve(read, packageInputFrom(read, npcs, "mystery-session-v3"), salt, dir);
}
