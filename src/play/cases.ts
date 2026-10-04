import { readFileSync } from "node:fs";
import { parseCaseTruth } from "../domain/case-truth.ts";
import { resolveCasePackage, type PackageRefSource, type ResolvedCasePackage, type RulesetVersion } from "../domain/case-package.ts";
import { buildPlayerRefIndex, playerRefFor, resolvePlayerRef } from "../domain/player-ref.ts";
import { bindCaseProof } from "../authoring/check-case.ts";

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
  /** v3: the session accepts hint events (v2 lies included); the proof is bound on load. */
  readonly rulesetVersion: RulesetVersion;
};

export const PLAY_CASES = {
  vitrine: { dir: "vitrine", npcs: ["lina", "max", "nora", "oskar"], salt: "5a175a175a175a175a175a175a175a17", clockOrigin: 18 * 3600, rulesetVersion: "mystery-session-v3" },
  "brieföffner": { dir: "brieffoeffner", npcs: ["anna", "ben"], salt: "b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0", clockOrigin: 20 * 3600, rulesetVersion: "mystery-session-v3" },
} as const satisfies Record<string, PlayCase>;
export type PlayCaseName = keyof typeof PLAY_CASES;

/** Accepts the case name, its umlaut-free spelling ("briefoeffner") or its fixture directory. */
export function playCaseName(input: string | undefined): PlayCaseName | null {
  const name = (input ?? "vitrine").toLowerCase();
  const found = Object.entries(PLAY_CASES).find(([key, c]) => name === key || name === key.replace("ö", "oe") || name === c.dir);
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

export function playPackageInput(c: PlayCase): Record<string, unknown> {
  const read = (name: string): unknown => readFixture(c, name);
  return {
    schemaVersion: 1,
    rulesetVersion: c.rulesetVersion,
    truth: read("truth.json"),
    solution: read("solution.json"),
    access: read("evidence-access.json"),
    presentation: read("evidence-presentation.json"),
    catalogue: read("questions.json"),
    npcs: c.npcs.map((npc) => ({ snapshot: read(`npc-${npc}.json`), profile: read(`interrogation-${npc}.json`) })),
    initial: read("initial-setup.json"),
    challenge: read("challenge.json"),
    publicContent: read("public-content.json"),
    // Bound in loadPlayPackage: hints (ruleset v3) are derived from the release manifest's witness.
    proof: null,
  };
}

export function loadPlayPackage(name: PlayCaseName): ResolvedCasePackage {
  const c = PLAY_CASES[name];
  const input = playPackageInput(c);
  input.proof = bindCaseProof(input as Parameters<typeof bindCaseProof>[0], readFixture(c, "release-manifest.json"), readFixture(c, "proof-profile.json"), c.salt);
  const result = resolveCasePackage(input, refSource(input.truth, c.salt));
  if (!result.ok) throw new Error(`Case package "${name}" rejected: ${JSON.stringify(result.findings)}`);
  return result.package;
}
