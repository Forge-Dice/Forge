import { readFileSync } from "node:fs";
import { parseCaseTruth, type CaseTruth } from "../src/domain/case-truth.ts";
import { parseCaseSolution, type CaseSolution } from "../src/domain/case-solution.ts";
import { resolveCasePackage, type ResolvedCasePackage } from "../src/domain/case-package.ts";
import { hashReleaseManifest, serializeSessionJson } from "../src/domain/case-package.identity.ts";
import {
  parseCaseProofProfile,
  type CaseProofProfile,
  type ReleasedObservation,
  type WitnessReplay,
} from "../src/domain/case-solvability.ts";
import { PLAY_CASES, playPackageInput, refSource } from "../src/play/cases.ts";
import { sessionWitness } from "../src/authoring/check-case.ts";
import { releaseContextOf } from "./case-package.fixture.ts";

// "Der Brieföffner" (case:letter-opener, revision 4): MYSTERY-VERTICAL-SLICE-ROADMAP §7, derived from
// fullCase() in case-truth.fixture.ts. Ruleset v2: Ben lies as the roadmap planned (q01 "not there",
// q02 "Anna was there"); the cuff button and the garden trail refute him.
// PRIVATE: contains the answer key. The witness port replays the steps through the real session.

export const BRIEF = PLAY_CASES["brieföffner"];
export const briefRaw = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/${BRIEF.dir}/${name}`, import.meta.url), "utf8"));

export const briefTruth = (): CaseTruth => parseCaseTruth(briefRaw("truth.json"));
export const briefSolution = (truth: CaseTruth = briefTruth()): CaseSolution => parseCaseSolution(briefRaw("solution.json"), truth);

type RefOf = { $playerRefOf: { kind: "person" | "location" | "item" | "event" | "evidence"; id: string } };
type ManifestObservation = ReleasedObservation & { alternatives?: { report: unknown }[]; ruleId?: string; afterObservations?: string[] };
export type ReleaseManifest = {
  schemaVersion: 1;
  releaseContextHash: string;
  adapterVersion: string;
  certificateData: { schemaVersion: 1; steps: { stepId: string; event: unknown }[]; observations: ManifestObservation[] };
};

const source = () => refSource(briefRaw("truth.json"), BRIEF.salt);

function substituteRefs(value: unknown, refFor: (kind: RefOf["$playerRefOf"]["kind"], id: string) => string | null): unknown {
  if (Array.isArray(value)) return value.map((x) => substituteRefs(x, refFor));
  if (typeof value !== "object" || value === null) return value;
  if ("$playerRefOf" in value) {
    const { kind, id } = (value as RefOf).$playerRefOf;
    const ref = refFor(kind, id);
    if (ref === null) throw new Error(`No PlayerRef for ${kind} ${id}`);
    return ref;
  }
  return Object.fromEntries(Object.entries(value).map(([k, x]) => [k, substituteRefs(x, refFor)]));
}

/** The release manifest with real PlayerRefs, bound to the real releaseContextHash of the package. */
export function briefReleaseManifest(): ReleaseManifest {
  const manifest = substituteRefs(briefRaw("release-manifest.json"), source().refFor) as ReleaseManifest;
  return { ...manifest, releaseContextHash: releaseContextOf(playPackageInput(BRIEF), BRIEF.salt) };
}
export const briefReleaseHash = (): string => hashReleaseManifest(serializeSessionJson(briefReleaseManifest()));

export function briefProofProfile(overrides: object = {}): CaseProofProfile {
  const input = briefRaw("proof-profile.json") as { bindings: Record<string, string> };
  const truth = briefTruth();
  return parseCaseProofProfile(
    { ...input, bindings: { ...input.bindings, releaseHash: briefReleaseHash() }, ...overrides },
    truth,
    briefSolution(truth),
  );
}

/** The complete package with its bound proof, through resolveCasePackage. */
export function resolveBriefPackage(): ResolvedCasePackage {
  const profile = briefRaw("proof-profile.json") as { bindings: Record<string, string> };
  const input = {
    ...playPackageInput(BRIEF),
    proof: {
      profile: { ...profile, bindings: { ...profile.bindings, releaseHash: briefReleaseHash() } },
      releaseManifest: serializeSessionJson(briefReleaseManifest()),
    },
  };
  const result = resolveCasePackage(input, source());
  if (!result.ok) throw new Error(JSON.stringify(result.findings));
  return result.package;
}

/**
 * Witness port on the real session reducer: check-case's own port (OBSERVED by released evidence
 * card, REPORTED_BY_NPC by the NPC's actual answer, PUBLIC_RULE after its observations).
 */
export function briefWitness(pkg: ResolvedCasePackage = resolveBriefPackage(), manifest = briefReleaseManifest()): WitnessReplay {
  return sessionWitness(pkg, manifest, briefReleaseHash());
}
