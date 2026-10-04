import { readFileSync } from "node:fs";
import { parseCaseTruth } from "../domain/case-truth.ts";
import { resolveCasePackage, type PackageRefSource, type ResolvedCasePackage } from "../domain/case-package.ts";
import { buildPlayerRefIndex, playerRefFor, resolvePlayerRef } from "../domain/player-ref.ts";

// Trusted host side of the play CLI: loads "Die leere Vitrine" from its fixture files and resolves
// it into one immutable case package. The package input is private (it holds the answer key); the
// player only ever sees what the session releases plus PublicContent.

export const VITRINE_DIR = new URL("../../tests/fixtures/vitrine/", import.meta.url);
/** Authoring salt of the play package (MYST-0001 D2); fixed so that saves stay replayable. */
export const VITRINE_PLAY_SALT = "5a175a175a175a175a175a175a175a17";
const NPCS = ["lina", "max", "nora", "oskar"] as const;

const read = (name: string): unknown => JSON.parse(readFileSync(new URL(name, VITRINE_DIR), "utf8"));

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

export function vitrinePackageInput(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    rulesetVersion: "mystery-session-v1",
    truth: read("truth.json"),
    solution: read("solution.json"),
    access: read("evidence-access.json"),
    presentation: read("evidence-presentation.json"),
    catalogue: read("questions.json"),
    npcs: NPCS.map((npc) => ({ snapshot: read(`npc-${npc}.json`), profile: read(`interrogation-${npc}.json`) })),
    initial: read("initial-setup.json"),
    challenge: read("challenge.json"),
    publicContent: read("public-content.json"),
    // Play needs no certification; proof binding is the case-acceptance runner's business.
    proof: null,
  };
}

export function loadVitrinePackage(): ResolvedCasePackage {
  const input = vitrinePackageInput();
  const result = resolveCasePackage(input, refSource(input.truth, VITRINE_PLAY_SALT));
  if (!result.ok) throw new Error(`Vitrine package rejected: ${JSON.stringify(result.findings)}`);
  return result.package;
}
