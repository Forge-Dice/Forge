import { isAncestorOrSelf, type CommitGraph } from "./ancestry.ts";
import type { ContractMetadata } from "./contract-document.ts";
import { deepFreeze } from "./freeze.ts";
import { sameIdentity, type AgentIdentity } from "./identity.ts";
import { compareCodeUnits } from "./primitives.ts";
import type { DeveloperReport, MutationResult, VerificationEvidence } from "./runs.ts";

// Pure evaluations over witnessed data (FORGE-CORE-0001B §7–§8). Nothing here is stored;
// results are recomputed from the recorded facts on demand.

export const PROCESS_NOTE_PREFIX = "forge/coordination/";
const ALWAYS_FORBIDDEN_PREFIXES = ["forge/contracts/", "forge/approvals/"] as const;

export type RemoteOutcome = "contained" | "not_contained";

export function remoteOutcome(
  run: { readonly startedFromCommit: string; readonly report: Readonly<Pick<DeveloperReport, "claimedResultCommit" | "claimedRemoteRef">> },
  observation: { readonly ref: string; readonly head: string | null; readonly parents: CommitGraph },
): RemoteOutcome {
  const { claimedResultCommit, claimedRemoteRef } = run.report;
  const contained =
    observation.ref === claimedRemoteRef &&
    observation.head !== null &&
    isAncestorOrSelf(claimedResultCommit, observation.head, observation.parents) &&
    isAncestorOrSelf(run.startedFromCommit, claimedResultCommit, observation.parents);
  return contained ? "contained" : "not_contained";
}

export type VerificationFailureCode = "CHECK_FAILED" | "SCOPE_VIOLATION" | "MUTATION_SURVIVED" | "MUTATION_EVIDENCE_INVALID";
export type VerificationFailure = { readonly code: VerificationFailureCode; readonly subject: string | null };
export type MutationSource = "verifier" | "developer_report" | "none";
export type VerificationEvaluation =
  | { readonly passed: true; readonly mutationSource: MutationSource }
  | { readonly passed: false; readonly failures: readonly VerificationFailure[]; readonly mutationSource: MutationSource };

type MetadataLike = Readonly<Pick<ContractMetadata, "scope" | "requiredChecks" | "mutationSmoke">>;

/** The mutation results that count: the verifier's if present, else the developer's. */
export function effectiveMutations(
  metadata: MetadataLike,
  report: Readonly<Pick<DeveloperReport, "mutations">>,
  evidence: Readonly<Pick<VerificationEvidence, "mutations">>,
): { readonly source: MutationSource; readonly mutations: readonly Readonly<MutationResult>[] } {
  if (metadata.mutationSmoke === "none") return { source: "none", mutations: [] };
  if (evidence.mutations !== null) return { source: "verifier", mutations: evidence.mutations };
  return { source: "developer_report", mutations: report.mutations };
}

function scopeViolations(metadata: MetadataLike, evidence: Readonly<Pick<VerificationEvidence, "changedFiles">>): string[] {
  const violations: string[] = [];
  for (const file of evidence.changedFiles) {
    if (file.change === "renamed") {
      // Both endpoints are required: neither side may hide a move across the boundary.
      const allowed = file.fromPath.startsWith(PROCESS_NOTE_PREFIX) && file.toPath.startsWith(PROCESS_NOTE_PREFIX);
      if (!allowed) violations.push(file.fromPath, file.toPath);
      continue;
    }
    const { path, change } = file;
    const forbidden = ALWAYS_FORBIDDEN_PREFIXES.some((prefix) => path === prefix.slice(0, -1) || path.startsWith(prefix));
    if (forbidden || change === "deleted") {
      violations.push(path);
      continue;
    }
    if (path.startsWith(PROCESS_NOTE_PREFIX)) continue;
    const allowed =
      (change === "added" && metadata.scope.create.includes(path)) || (change === "modified" && metadata.scope.modify.includes(path));
    if (!allowed) violations.push(path);
  }
  return violations;
}

function mutationFailures(metadata: MetadataLike, mutations: readonly Readonly<MutationResult>[]): VerificationFailure[] {
  const failures: VerificationFailure[] = [];
  if (metadata.mutationSmoke === "none") return failures;
  if (metadata.mutationSmoke === "required" && mutations.length === 0) {
    failures.push({ code: "MUTATION_EVIDENCE_INVALID", subject: null });
  }
  const seen = new Set<string>();
  for (const m of mutations) {
    const equivalent = m.classification === "equivalent";
    const invalid =
      seen.has(m.name) ||
      m.outcome === "not_applied" ||
      (equivalent && m.outcome === "detected") ||
      equivalent !== (m.equivalenceRationale !== null);
    seen.add(m.name);
    if (invalid) failures.push({ code: "MUTATION_EVIDENCE_INVALID", subject: m.name });
    else if (!equivalent && m.outcome === "survived") failures.push({ code: "MUTATION_SURVIVED", subject: m.name });
  }
  return failures;
}

function compareFailures(a: VerificationFailure, b: VerificationFailure): number {
  if (a.code !== b.code) return compareCodeUnits(a.code, b.code);
  if (a.subject === b.subject) return 0;
  if (a.subject === null) return -1;
  if (b.subject === null) return 1;
  return compareCodeUnits(a.subject, b.subject);
}

export function evaluateVerification(
  metadata: MetadataLike,
  report: Readonly<Pick<DeveloperReport, "mutations">>,
  evidence: Readonly<Pick<VerificationEvidence, "changedFiles" | "checks" | "mutations">>,
): VerificationEvaluation {
  const failures: VerificationFailure[] = [];
  for (const required of metadata.requiredChecks) {
    const matches = evidence.checks.filter((c) => c.name === required.name);
    const ok = matches.length === 1 && matches[0]!.command === required.command && matches[0]!.exitCode === 0;
    if (!ok) failures.push({ code: "CHECK_FAILED", subject: required.name });
  }
  for (const path of scopeViolations(metadata, evidence)) failures.push({ code: "SCOPE_VIOLATION", subject: path });
  const { source, mutations } = effectiveMutations(metadata, report, evidence);
  failures.push(...mutationFailures(metadata, mutations));
  if (failures.length === 0) return deepFreeze({ passed: true, mutationSource: source });
  return deepFreeze({ passed: false, failures: failures.sort(compareFailures), mutationSource: source });
}

/** Names of mutations the developer or verifier declared equivalent; review must acknowledge them. */
export function equivalentMutationNames(mutations: readonly Readonly<MutationResult>[]): string[] {
  return mutations.filter((m) => m.classification === "equivalent").map((m) => m.name);
}

export type VerifierIndependence = "same_identity" | "same_provider" | "different_provider";

export function verifierIndependence(developer: Readonly<AgentIdentity>, verifier: Readonly<AgentIdentity>): VerifierIndependence {
  if (sameIdentity(developer, verifier)) return "same_identity";
  return developer.provider === verifier.provider ? "same_provider" : "different_provider";
}
