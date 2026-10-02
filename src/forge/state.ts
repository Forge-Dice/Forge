import { parseContractDocument, contractPathFor, type ContractIssue, type ContractMetadata, type ContractRef, type Sha256Utf8 } from "./contract-document.ts";
import { ForgeEventSchema, ROLES_FOR_EVENT, type ForgeEvent, type RepoObservation } from "./events.ts";
import { deepFreeze } from "./freeze.ts";
import { isIndependentReviewer, sameIdentity, type AgentIdentity, type ReviewPolicy } from "./identity.ts";
import type { Finding, TaskId } from "./primitives.ts";
import type { AbandonReason, DeveloperReport, ExplicitFailureCode, VerificationEvidence } from "./runs.ts";
import type { StartDecision } from "./start-gate.ts";
import {
  effectiveMutations,
  equivalentMutationNames,
  evaluateVerification,
  remoteOutcome,
  verifierIndependence,
  type VerificationEvaluation,
  type VerifierIndependence,
} from "./verification.ts";

// Event application and derived projections (FORGE-CORE-0001A §8–§13, FORGE-CORE-0001B §6–§13).
// The state stores facts only (events, registrations, decisions, run records). Every status is
// derived on demand and never stored.

export const REQUIRED_GATES = Object.freeze(["architecture_review"] as const);

type Identity = Readonly<AgentIdentity>;

export type ApprovalDecision = {
  readonly gate: "architecture_review";
  readonly verdict: "approved" | "changes_requested";
  readonly reviewer: Identity;
  readonly findings: readonly Readonly<Finding>[];
};

export type ContractRevisionRecord = {
  readonly ref: ContractRef;
  readonly metadata: Readonly<ContractMetadata>;
  readonly contractPath: string;
  readonly contractCommit: string;
  readonly author: Identity;
  readonly decisions: readonly ApprovalDecision[];
};

export type TaskRecord = {
  readonly taskId: TaskId;
  readonly title: string;
  readonly registeredBy: Identity;
  readonly contracts: readonly ContractRevisionRecord[]; // ascending contractVersion
  readonly acceptance: { readonly runId: string; readonly owner: Identity } | null;
};

export type ReviewVerdict = {
  readonly reviewer: Identity;
  readonly reviewedCommit: string;
  readonly verdict: "approve" | "request_changes";
  readonly requires: "code_change" | "contract_change" | null;
  readonly findings: readonly Readonly<Finding>[];
  readonly acknowledgedEquivalentMutations: readonly string[];
};

export type RunRecord = {
  readonly runId: string;
  readonly taskId: TaskId;
  readonly contract: ContractRef;
  readonly developer: Identity;
  readonly startedFromCommit: string;
  readonly startObservation: Readonly<RepoObservation>;
  readonly report: Readonly<DeveloperReport> | null;
  readonly observations: readonly { readonly observer: Identity; readonly ref: string; readonly head: string | null; readonly parents: Readonly<Record<string, readonly string[]>> }[];
  readonly verification: { readonly verifier: Identity; readonly evidence: Readonly<VerificationEvidence> } | null;
  readonly failure: { readonly code: ExplicitFailureCode; readonly detail: string; readonly by: Identity } | null;
  readonly abandonment: { readonly reason: AbandonReason; readonly detail: string; readonly by: Identity } | null;
  readonly verdict: ReviewVerdict | null;
};

export type ForgeState = {
  readonly policy: Readonly<ReviewPolicy>;
  readonly log: readonly ForgeEvent[];
  readonly tasks: readonly TaskRecord[]; // registration order
  readonly runs: readonly RunRecord[]; // start order
};

export type EventRejectCode =
  | "POLICY_MISMATCH"
  | "EVENT_SCHEMA"
  | "ROLE_NOT_ALLOWED"
  | "TASK_ALREADY_REGISTERED"
  | "TASK_UNKNOWN"
  | "TASK_ALREADY_ACCEPTED"
  | "TASK_STATE_INVALID"
  | "CONTRACT_DOCUMENT_INVALID"
  | "CONTRACT_HASH_MISMATCH"
  | "CONTRACT_TASK_MISMATCH"
  | "CONTRACT_PATH_MISMATCH"
  | "CONTRACT_VERSION_NOT_NEXT"
  | "CONTRACT_UNKNOWN"
  | "CONTRACT_SUPERSEDED"
  | "APPROVAL_ALREADY_DECIDED"
  | "REVIEWER_NOT_INDEPENDENT"
  | "FINDINGS_REQUIRED"
  | "DEPENDENCY_UNRESOLVED"
  | "DEPENDENCY_NOT_ACCEPTED"
  | "DEPENDENCY_MISMATCH"
  | "START_NOT_ALLOWED"
  | "RUN_ALREADY_EXISTS"
  | "RUN_UNKNOWN"
  | "RUN_STATE_INVALID"
  | "ACTOR_NOT_RUN_DEVELOPER"
  | "VERIFIED_COMMIT_MISMATCH"
  | "RUN_NOT_LATEST_VERIFIED"
  | "REVIEW_ALREADY_RECORDED"
  | "REVIEWED_COMMIT_MISMATCH"
  | "VERDICT_INCONSISTENT"
  | "EQUIVALENT_MUTATIONS_NOT_ACKNOWLEDGED"
  | "OWNER_NOT_HUMAN";

export type Rejection = {
  readonly code: EventRejectCode;
  readonly path: readonly (string | number)[];
  readonly subject: string | null;
  readonly issues: readonly ContractIssue[];
};

export type ApplyResult = { readonly ok: true; readonly state: ForgeState } | { readonly ok: false; readonly rejection: Rejection };
export type ReplayResult =
  | { readonly ok: true; readonly state: ForgeState }
  | { readonly ok: false; readonly index: number; readonly rejection: Rejection };

export type KernelDeps = {
  readonly sha256Utf8: Sha256Utf8;
  readonly policy: Readonly<ReviewPolicy>;
  /** The developer start gate, injected to avoid a module cycle (FORGE-CORE-0001B §11). */
  readonly startGate: (state: ForgeState, request: unknown) => StartDecision;
};

export type ContractRevisionState = "draft" | "approved" | "changes_requested" | "superseded";
export type TaskState =
  | "planned"
  | "specifying"
  | "ready"
  | "implementing"
  | "awaiting_review"
  | "review_approved"
  | "rework_required"
  | "contract_revision_required"
  | "accepted";
export type RunState = "running" | "reported" | "remote_verified" | "verified" | "failed" | "abandoned";

// ---------- Derived projections ----------

export function findTask(state: ForgeState, taskId: string): TaskRecord | null {
  return state.tasks.find((task) => task.taskId === taskId) ?? null;
}

export function currentContract(state: ForgeState, taskId: string): ContractRevisionRecord | null {
  const task = findTask(state, taskId);
  return task === null ? null : (task.contracts.at(-1) ?? null);
}

export function findRevision(state: ForgeState, taskId: string, contentHash: string): ContractRevisionRecord | null {
  return findTask(state, taskId)?.contracts.find((c) => c.ref.contentHash === contentHash) ?? null;
}

export function isApproved(revision: ContractRevisionRecord): boolean {
  return REQUIRED_GATES.every((gate) => revision.decisions.some((d) => d.gate === gate && d.verdict === "approved"));
}

export function contractRevisionState(state: ForgeState, taskId: string, contentHash: string): ContractRevisionState | null {
  const revision = findRevision(state, taskId, contentHash);
  if (revision === null) return null;
  if (currentContract(state, taskId) !== revision) return "superseded";
  if (revision.decisions.some((d) => d.verdict === "changes_requested")) return "changes_requested";
  return isApproved(revision) ? "approved" : "draft";
}

export function findRun(state: ForgeState, runId: string): RunRecord | null {
  return state.runs.find((run) => run.runId === runId) ?? null;
}

/** Verification outcome recomputed from the recorded evidence; null if no evidence yet. */
export function verificationOf(state: ForgeState, runId: string): VerificationEvaluation | null {
  const run = findRun(state, runId);
  if (run === null || run.verification === null || run.report === null) return null;
  const revision = findRevision(state, run.taskId, run.contract.contentHash)!;
  return evaluateVerification(revision.metadata, run.report, run.verification.evidence);
}

export function verifierIndependenceOf(state: ForgeState, runId: string): VerifierIndependence | null {
  const run = findRun(state, runId);
  return run?.verification ? verifierIndependence(run.developer, run.verification.verifier) : null;
}

export function runState(state: ForgeState, runId: string): RunState | null {
  const run = findRun(state, runId);
  if (run === null) return null;
  if (run.abandonment !== null) return "abandoned";
  if (run.failure !== null) return "failed";
  if (run.verification !== null) return verificationOf(state, runId)!.passed ? "verified" : "failed";
  if (run.report === null) return "running";
  const report = run.report;
  const persisted = run.observations.some((o) => remoteOutcome({ startedFromCommit: run.startedFromCommit, report }, o) === "contained");
  return persisted ? "remote_verified" : "reported";
}

const TERMINAL_RUN_STATES: readonly RunState[] = ["verified", "failed", "abandoned"];

export function isRunTerminal(state: ForgeState, runId: string): boolean {
  return TERMINAL_RUN_STATES.includes(runState(state, runId)!);
}

/** R from FORGE-CORE-0001B §10: the last verified run of the task on its current revision. */
export function latestVerifiedRun(state: ForgeState, taskId: string): RunRecord | null {
  const current = currentContract(state, taskId);
  if (current === null) return null;
  const candidates = state.runs.filter(
    (run) => run.taskId === taskId && run.contract.contentHash === current.ref.contentHash && runState(state, run.runId) === "verified",
  );
  return candidates.at(-1) ?? null;
}

export function taskState(state: ForgeState, taskId: string): TaskState | null {
  const task = findTask(state, taskId);
  if (task === null) return null;
  if (task.acceptance !== null) return "accepted";
  if (state.runs.some((run) => run.taskId === taskId && !isRunTerminal(state, run.runId))) return "implementing";
  const current = currentContract(state, taskId);
  if (current === null) return "planned";
  const latest = latestVerifiedRun(state, taskId);
  if (latest !== null) {
    if (latest.verdict === null) return "awaiting_review";
    if (latest.verdict.verdict === "approve") return "review_approved";
    return latest.verdict.requires === "code_change" ? "rework_required" : "contract_revision_required";
  }
  return isApproved(current) ? "ready" : "specifying";
}

/** Accepted result commit of a task: the verified commit of its accepted run, else null. */
export function acceptedCommitOf(state: ForgeState, taskId: string): string | null {
  const acceptance = findTask(state, taskId)?.acceptance ?? null;
  if (acceptance === null) return null;
  return findRun(state, acceptance.runId)?.verification?.evidence.verifiedCommit ?? null;
}

// ---------- Event application ----------

type Mutable<T> = { -readonly [K in keyof T]: T[K] extends readonly (infer U)[] ? U[] : T[K] };
type WorkTask = Mutable<Omit<TaskRecord, "contracts">> & { contracts: Mutable<ContractRevisionRecord>[] };
type Work = { policy: ReviewPolicy; log: ForgeEvent[]; tasks: WorkTask[]; runs: Mutable<RunRecord>[] };

function reject(code: EventRejectCode, path: (string | number)[], subject: string | null = null, issues: readonly ContractIssue[] = []): Rejection {
  return { code, path, subject, issues };
}

/** Validates the event completely and mutates `work` only if it is accepted. */
function step(work: Work, raw: unknown, deps: KernelDeps): Rejection | null {
  const parsed = ForgeEventSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]!;
    return reject("EVENT_SCHEMA", first.path.map((p) => (typeof p === "symbol" ? String(p) : p)));
  }
  const event = parsed.data;
  const { body } = event;
  if (!ROLES_FOR_EVENT[body.type].includes(event.role)) return reject("ROLE_NOT_ALLOWED", ["role"]);

  const view = work as unknown as ForgeState;
  const rejection = applyBody(work, view, event, deps);
  if (rejection !== null) return rejection;
  work.log.push(event);
  return null;
}

function applyBody(work: Work, view: ForgeState, event: ForgeEvent, deps: KernelDeps): Rejection | null {
  const { body, actor } = event;
  const taskOf = (taskId: string) => work.tasks.find((t) => t.taskId === taskId);
  const runOf = (runId: string) => work.runs.find((r) => r.runId === runId);
  const requireRun = (runId: string, allowed: readonly RunState[]): Rejection | Mutable<RunRecord> => {
    const run = runOf(runId);
    if (run === undefined) return reject("RUN_UNKNOWN", ["body", "runId"]);
    if (!allowed.includes(runState(view, runId)!)) return reject("RUN_STATE_INVALID", ["body", "runId"], runState(view, runId));
    return run;
  };
  const isRejection = (value: unknown): value is Rejection => typeof value === "object" && value !== null && "code" in value && "issues" in value;
  const ACTIVE: readonly RunState[] = ["running", "reported", "remote_verified"];

  switch (body.type) {
    case "task_registered": {
      if (taskOf(body.taskId) !== undefined) return reject("TASK_ALREADY_REGISTERED", ["body", "taskId"]);
      work.tasks.push({ taskId: body.taskId, title: body.title, registeredBy: actor, contracts: [], acceptance: null });
      return null;
    }
    case "contract_registered": {
      const task = taskOf(body.taskId);
      if (task === undefined) return reject("TASK_UNKNOWN", ["body", "taskId"]);
      if (task.acceptance !== null) return reject("TASK_ALREADY_ACCEPTED", ["body", "taskId"]);
      const result = parseContractDocument(body.contractText, deps.sha256Utf8);
      if (!result.ok) return reject("CONTRACT_DOCUMENT_INVALID", ["body", "contractText"], null, result.issues);
      const { ref, metadata } = result.document;
      if (ref.contentHash !== body.declaredContentHash) return reject("CONTRACT_HASH_MISMATCH", ["body", "declaredContentHash"]);
      if (metadata.taskId !== body.taskId) return reject("CONTRACT_TASK_MISMATCH", ["body", "taskId"]);
      if (body.contractPath !== contractPathFor(body.taskId)) return reject("CONTRACT_PATH_MISMATCH", ["body", "contractPath"]);
      const next = (task.contracts.at(-1)?.ref.contractVersion ?? 0) + 1;
      if (metadata.contractVersion !== next) return reject("CONTRACT_VERSION_NOT_NEXT", ["body", "contractText"]);
      task.contracts.push({ ref, metadata, contractPath: body.contractPath, contractCommit: body.contractCommit, author: actor, decisions: [] });
      return null;
    }
    case "approval_recorded": {
      const task = taskOf(body.taskId);
      if (task === undefined) return reject("TASK_UNKNOWN", ["body", "taskId"]);
      if (task.acceptance !== null) return reject("TASK_ALREADY_ACCEPTED", ["body", "taskId"]);
      const revision = task.contracts.find((c) => c.ref.contentHash === body.contentHash);
      if (revision === undefined) return reject("CONTRACT_UNKNOWN", ["body", "contentHash"]);
      if (task.contracts.at(-1) !== revision) return reject("CONTRACT_SUPERSEDED", ["body", "contentHash"]);
      if (revision.decisions.some((d) => d.gate === body.gate)) return reject("APPROVAL_ALREADY_DECIDED", ["body", "gate"]);
      if (!isIndependentReviewer(revision.author, actor, work.policy)) return reject("REVIEWER_NOT_INDEPENDENT", ["actor"]);
      if (body.verdict === "changes_requested" && body.findings.length === 0) return reject("FINDINGS_REQUIRED", ["body", "findings"]);
      if (body.verdict === "approved") {
        for (const dep of revision.metadata.dependencies) {
          if (dep.acceptedCommit === null) return reject("DEPENDENCY_UNRESOLVED", ["body", "contentHash"], dep.taskId);
          const accepted = acceptedCommitOf(view, dep.taskId);
          if (accepted === null) return reject("DEPENDENCY_NOT_ACCEPTED", ["body", "contentHash"], dep.taskId);
          if (accepted !== dep.acceptedCommit) return reject("DEPENDENCY_MISMATCH", ["body", "contentHash"], dep.taskId);
        }
      }
      revision.decisions.push({ gate: body.gate, verdict: body.verdict, reviewer: actor, findings: body.findings });
      return null;
    }
    case "run_started": {
      if (taskOf(body.taskId) === undefined) return reject("TASK_UNKNOWN", ["body", "taskId"]);
      if (runOf(body.runId) !== undefined) return reject("RUN_ALREADY_EXISTS", ["body", "runId"]);
      const decision = deps.startGate(view, { taskId: body.taskId, contentHash: body.contentHash, repoObservation: body.repoObservation });
      if (!decision.allowed) return reject("START_NOT_ALLOWED", ["body"], decision.reasons[0]!.code);
      const revision = findRevision(view, body.taskId, body.contentHash)!;
      work.runs.push({
        runId: body.runId,
        taskId: body.taskId,
        contract: revision.ref,
        developer: actor,
        startedFromCommit: decision.startFromCommit,
        startObservation: body.repoObservation,
        report: null,
        observations: [],
        verification: null,
        failure: null,
        abandonment: null,
        verdict: null,
      });
      return null;
    }
    case "developer_report_recorded": {
      const run = requireRun(body.runId, ["running"]);
      if (isRejection(run)) return run;
      if (!sameIdentity(run.developer, actor)) return reject("ACTOR_NOT_RUN_DEVELOPER", ["actor"]);
      run.report = body.report;
      return null;
    }
    case "remote_observed": {
      // Negative observations are recorded and never terminate the run (FORGE-CORE-0001B §6).
      const run = requireRun(body.runId, ["reported"]);
      if (isRejection(run)) return run;
      run.observations.push({ observer: actor, ref: body.ref, head: body.head, parents: body.parents });
      return null;
    }
    case "verification_recorded": {
      const run = requireRun(body.evidence.runId, ["remote_verified"]);
      if (isRejection(run)) return { ...run, path: ["body", "evidence", "runId"] };
      if (body.evidence.verifiedCommit !== run.report!.claimedResultCommit) {
        return reject("VERIFIED_COMMIT_MISMATCH", ["body", "evidence", "verifiedCommit"]);
      }
      run.verification = { verifier: actor, evidence: body.evidence };
      return null;
    }
    case "run_failed": {
      const run = requireRun(body.runId, ACTIVE);
      if (isRejection(run)) return run;
      if (event.role === "developer" && !sameIdentity(run.developer, actor)) return reject("ACTOR_NOT_RUN_DEVELOPER", ["actor"]);
      run.failure = { code: body.code, detail: body.detail, by: actor };
      return null;
    }
    case "run_abandoned": {
      const run = requireRun(body.runId, ACTIVE);
      if (isRejection(run)) return run;
      run.abandonment = { reason: body.reason, detail: body.detail, by: actor };
      return null;
    }
    case "code_review_recorded": {
      const run = requireRun(body.runId, ["verified"]);
      if (isRejection(run)) return run;
      if (latestVerifiedRun(view, run.taskId) !== run) return reject("RUN_NOT_LATEST_VERIFIED", ["body", "runId"]);
      if (run.verdict !== null) return reject("REVIEW_ALREADY_RECORDED", ["body", "runId"]);
      if (body.reviewedCommit !== run.verification!.evidence.verifiedCommit) return reject("REVIEWED_COMMIT_MISMATCH", ["body", "reviewedCommit"]);
      if (!isIndependentReviewer(run.developer, actor, work.policy)) return reject("REVIEWER_NOT_INDEPENDENT", ["actor"]);
      const blocking = body.findings.some((f) => f.severity === "blocking");
      const consistent =
        body.verdict === "approve" ? body.requires === null && !blocking : body.requires !== null && body.findings.length > 0;
      if (!consistent) return reject("VERDICT_INCONSISTENT", ["body", "verdict"]);
      const revision = findRevision(view, run.taskId, run.contract.contentHash)!;
      const { mutations } = effectiveMutations(revision.metadata, run.report!, run.verification!.evidence);
      const expected = new Set(equivalentMutationNames(mutations));
      const acknowledged = new Set(body.acknowledgedEquivalentMutations);
      if (expected.size !== acknowledged.size || [...expected].some((name) => !acknowledged.has(name))) {
        return reject("EQUIVALENT_MUTATIONS_NOT_ACKNOWLEDGED", ["body", "acknowledgedEquivalentMutations"]);
      }
      run.verdict = {
        reviewer: actor,
        reviewedCommit: body.reviewedCommit,
        verdict: body.verdict,
        requires: body.requires,
        findings: body.findings,
        acknowledgedEquivalentMutations: body.acknowledgedEquivalentMutations,
      };
      return null;
    }
    case "task_accepted": {
      const task = taskOf(body.taskId);
      if (task === undefined) return reject("TASK_UNKNOWN", ["body", "taskId"]);
      const current = taskState(view, body.taskId);
      if (current !== "review_approved") return reject("TASK_STATE_INVALID", ["body", "taskId"], current);
      if (latestVerifiedRun(view, body.taskId)?.runId !== body.runId) return reject("RUN_NOT_LATEST_VERIFIED", ["body", "runId"]);
      if (actor.actorType !== "human") return reject("OWNER_NOT_HUMAN", ["actor"]);
      task.acceptance = { runId: body.runId, owner: actor };
      return null;
    }
  }
}

function samePolicy(a: Readonly<ReviewPolicy>, b: Readonly<ReviewPolicy>): boolean {
  return a.aiReviewIndependence === b.aiReviewIndependence;
}

export function emptyForgeState(policy: Readonly<ReviewPolicy>): ForgeState {
  return deepFreeze({ policy: { aiReviewIndependence: policy.aiReviewIndependence }, log: [], tasks: [], runs: [] });
}

export function applyEvent(state: ForgeState, event: unknown, deps: KernelDeps): ApplyResult {
  if (!samePolicy(state.policy, deps.policy)) return deepFreeze({ ok: false, rejection: reject("POLICY_MISMATCH", []) });
  const work = structuredClone(state) as unknown as Work;
  const rejection = step(work, event, deps);
  if (rejection !== null) return deepFreeze({ ok: false, rejection });
  return deepFreeze({ ok: true, state: work as unknown as ForgeState });
}

export function replay(events: readonly unknown[], deps: KernelDeps): ReplayResult {
  const work = structuredClone(emptyForgeState(deps.policy)) as unknown as Work;
  for (let index = 0; index < events.length; index++) {
    const rejection = step(work, events[index], deps);
    if (rejection !== null) return deepFreeze({ ok: false, index, rejection });
  }
  return deepFreeze({ ok: true, state: work as unknown as ForgeState });
}
