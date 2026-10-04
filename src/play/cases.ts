import { readFileSync } from "node:fs";
import { parseCaseTruth } from "../domain/case-truth.ts";
import { resolveCasePackage, type PackageRefSource, type ResolvedCasePackage } from "../domain/case-package.ts";
import { buildPlayerRefIndex, playerRefFor, resolvePlayerRef } from "../domain/player-ref.ts";

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
};

export const PLAY_CASES = {
  vitrine: { dir: "vitrine", npcs: ["lina", "max", "nora", "oskar"], salt: "5a175a175a175a175a175a175a175a17", clockOrigin: 18 * 3600 },
  "brieföffner": { dir: "brieffoeffner", npcs: ["anna", "ben"], salt: "b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0", clockOrigin: 20 * 3600 },
  geige: { dir: "geige", npcs: ["ida", "kurt", "paul", "vera"], salt: "6e16e16e16e16e16e16e16e16e16e16e", clockOrigin: 20 * 3600 },
  "hüttenkasse": { dir: "huettenkasse", npcs: ["rosa", "lukas", "mira", "gerd", "tobias"], salt: "4a774a774a774a774a774a774a774a77", clockOrigin: 21 * 3600 },
  nachtzug: { dir: "nachtzug", npcs: ["janek", "felix", "bruno", "dora", "clara"], salt: "7a147a147a147a147a147a147a147a14", clockOrigin: 0 },
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

export function playPackageInput(c: PlayCase): Record<string, unknown> {
  const read = (name: string): unknown => JSON.parse(readFileSync(new URL(name, fixtureDir(c)), "utf8"));
  return {
    schemaVersion: 1,
    rulesetVersion: "mystery-session-v1",
    truth: read("truth.json"),
    solution: read("solution.json"),
    access: read("evidence-access.json"),
    presentation: read("evidence-presentation.json"),
    catalogue: read("questions.json"),
    npcs: c.npcs.map((npc) => ({ snapshot: read(`npc-${npc}.json`), profile: read(`interrogation-${npc}.json`) })),
    initial: read("initial-setup.json"),
    challenge: read("challenge.json"),
    publicContent: read("public-content.json"),
    // Play needs no certification; proof binding is the case-acceptance runner's business.
    proof: null,
  };
}

export function loadPlayPackage(name: PlayCaseName): ResolvedCasePackage {
  const c = PLAY_CASES[name];
  const input = playPackageInput(c);
  const result = resolveCasePackage(input, refSource(input.truth, c.salt));
  if (!result.ok) throw new Error(`Case package "${name}" rejected: ${JSON.stringify(result.findings)}`);
  return result.package;
}
