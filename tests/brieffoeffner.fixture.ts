import { readFileSync } from "node:fs";
import { parseCaseTruth, type CaseTruth } from "../src/domain/case-truth.ts";
import { parseCaseSolution, type CaseSolution } from "../src/domain/case-solution.ts";
import { hashCaseSolution } from "../src/domain/case-solution.identity.ts";
import { resolveCasePackage, type ResolvedCasePackage } from "../src/domain/case-package.ts";
import { hashReleaseManifest, serializeSessionJson } from "../src/domain/case-package.identity.ts";
import { initialSession, reduceSession } from "../src/domain/case-session.ts";
import type { EvidenceObservation } from "../src/domain/evidence-presentation.ts";
import {
  parseCaseProofProfile,
  type CaseProofProfile,
  type ReleasedObservation,
  type WitnessReplay,
  type WitnessReplayResult,
} from "../src/domain/case-solvability.ts";
import { PLAY_CASES, playPackageInput, refSource } from "../src/play/cases.ts";
import { releaseContextOf } from "./case-package.fixture.ts";

// "Der Brieföffner" (case:letter-opener, revision 4): MYSTERY-VERTICAL-SLICE-ROADMAP §7, derived from
// fullCase() in case-truth.fixture.ts. V1 has no lies, so Ben declines where the roadmap let him lie.
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

function sortedJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(sortedJson).join(",")}]`;
  if (typeof value !== "object" || value === null) return JSON.stringify(value);
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${sortedJson((value as Record<string, unknown>)[k])}`).join(",")}}`;
}

const payloadOf = ({ alternatives, ruleId, afterObservations, ...payload }: ManifestObservation) => payload as ReleasedObservation;

/**
 * Witness port on the real session reducer: replays each step's event with reduceSession from
 * initialSession. An OBSERVED record is released only if its evidence card was actually released
 * with one of the manifest's alternative reports; a PUBLIC_RULE once all its afterObservations are.
 */
export function briefWitness(pkg: ResolvedCasePackage = resolveBriefPackage(), manifest = briefReleaseManifest()): WitnessReplay {
  return (stepIds): WitnessReplayResult => {
    let state = initialSession(pkg);
    const cards = new Map<string, EvidenceObservation>();
    for (const stepId of stepIds) {
      const step = manifest.certificateData.steps.find((s) => s.stepId === stepId);
      if (step === undefined) return { success: false, code: "INVALID_WITNESS" };
      const result = reduceSession(pkg, state, step.event);
      if (!result.ok) return { success: false, code: "INVALID_WITNESS" };
      state = result.state;
      if (result.output.type === "investigate") {
        for (const card of result.output.observations) cards.set(pkg.refs.resolve(card.evidence)!.id, card);
      }
    }
    const released = new Set<string>();
    const records: ReleasedObservation[] = [];
    for (const o of manifest.certificateData.observations) {
      if (o.kind !== "OBSERVED" || o.source.kind !== "evidence") continue;
      const reports = new Set(cards.get(o.source.evidenceId)?.reports.map(sortedJson) ?? []);
      if (o.alternatives?.some((alt) => reports.has(sortedJson(alt.report)))) {
        released.add(o.id);
        records.push(payloadOf(o));
      }
    }
    for (const o of manifest.certificateData.observations) {
      if (o.kind === "PUBLIC_RULE" && (o.afterObservations ?? []).every((id) => released.has(id))) records.push(payloadOf(o));
    }
    const bindings = {
      caseId: pkg.truth.caseId,
      truthHash: pkg.refs.truthHash,
      solutionHash: hashCaseSolution(pkg.solution),
      releaseHash: briefReleaseHash(),
    };
    return { success: true, bindings, released: records };
  };
}
