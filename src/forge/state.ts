import { parseContractDocument, contractPathFor, type ContractIssue, type ContractMetadata, type ContractRef, type Sha256Utf8 } from "./contract-document.ts";
import { ForgeEventSchema, ROLE_FOR_EVENT, type ForgeEvent } from "./events.ts";
import { deepFreeze } from "./freeze.ts";
import { isIndependentReviewer, type AgentIdentity, type ReviewPolicy } from "./identity.ts";
import type { Finding, TaskId } from "./primitives.ts";

// Event application and derived projections (FORGE-CORE-0001A §8–§10, §13).
// The state stores facts only (events, registrations, decisions). Every status is derived
// on demand and never stored.

export const REQUIRED_GATES = Object.freeze(["architecture_review"] as const);

export type ApprovalDecision = {
  readonly gate: "architecture_review";
  readonly verdict: "approved" | "changes_requested";
  readonly reviewer: Readonly<AgentIdentity>;
  readonly findings: readonly Readonly<Finding>[];
};

export type ContractRevisionRecord = {
  readonly ref: ContractRef;
  readonly metadata: Readonly<ContractMetadata>;
  readonly contractPath: string;
  readonly contractCommit: string;
  readonly author: Readonly<AgentIdentity>;
  readonly decisions: readonly ApprovalDecision[];
};

export type TaskRecord = {
  readonly taskId: TaskId;
  readonly title: string;
  readonly registeredBy: Readonly<AgentIdentity>;
  readonly contracts: readonly ContractRevisionRecord[]; // ascending contractVersion
};

export type ForgeState = {
  readonly policy: Readonly<ReviewPolicy>;
  readonly log: readonly ForgeEvent[];
  readonly tasks: readonly TaskRecord[]; // registration order
};

export type EventRejectCode =
  | "POLICY_MISMATCH"
  | "EVENT_SCHEMA"
  | "ROLE_NOT_ALLOWED"
  | "TASK_ALREADY_REGISTERED"
  | "TASK_UNKNOWN"
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
  | "DEPENDENCY_NOT_ACCEPTED";

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

export type KernelDeps = { readonly sha256Utf8: Sha256Utf8; readonly policy: Readonly<ReviewPolicy> };

export type ContractRevisionState = "draft" | "approved" | "changes_requested" | "superseded";
export type TaskState = "planned" | "specifying" | "ready";

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

export function taskState(state: ForgeState, taskId: string): TaskState | null {
  if (findTask(state, taskId) === null) return null;
  const current = currentContract(state, taskId);
  if (current === null) return "planned";
  return isApproved(current) ? "ready" : "specifying";
}

/** Accepted result commit of a task. FORGE-CORE-0001A has no task acceptance, so always null. */
export function acceptedCommitOf(_state: ForgeState, _taskId: string): string | null {
  return null;
}

// ---------- Event application ----------

type Work = {
  policy: ReviewPolicy;
  log: ForgeEvent[];
  tasks: { taskId: TaskId; title: string; registeredBy: AgentIdentity; contracts: (ContractRevisionRecord & { decisions: ApprovalDecision[] })[] }[];
};

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
  const { body, actor } = event;
  if (ROLE_FOR_EVENT[body.type] !== event.role) return reject("ROLE_NOT_ALLOWED", ["role"]);

  const view = work as unknown as ForgeState;
  const task = work.tasks.find((t) => t.taskId === body.taskId);

  switch (body.type) {
    case "task_registered": {
      if (task !== undefined) return reject("TASK_ALREADY_REGISTERED", ["body", "taskId"]);
      work.tasks.push({ taskId: body.taskId, title: body.title, registeredBy: actor, contracts: [] });
      break;
    }
    case "contract_registered": {
      if (task === undefined) return reject("TASK_UNKNOWN", ["body", "taskId"]);
      const result = parseContractDocument(body.contractText, deps.sha256Utf8);
      if (!result.ok) return reject("CONTRACT_DOCUMENT_INVALID", ["body", "contractText"], null, result.issues);
      const { ref, metadata } = result.document;
      if (ref.contentHash !== body.declaredContentHash) return reject("CONTRACT_HASH_MISMATCH", ["body", "declaredContentHash"]);
      if (metadata.taskId !== body.taskId) return reject("CONTRACT_TASK_MISMATCH", ["body", "taskId"]);
      if (body.contractPath !== contractPathFor(body.taskId)) return reject("CONTRACT_PATH_MISMATCH", ["body", "contractPath"]);
      const next = (task.contracts.at(-1)?.ref.contractVersion ?? 0) + 1;
      if (metadata.contractVersion !== next) return reject("CONTRACT_VERSION_NOT_NEXT", ["body", "contractText"]);
      task.contracts.push({
        ref,
        metadata,
        contractPath: body.contractPath,
        contractCommit: body.contractCommit,
        author: actor,
        decisions: [],
      });
      break;
    }
    case "approval_recorded": {
      if (task === undefined) return reject("TASK_UNKNOWN", ["body", "taskId"]);
      const revision = task.contracts.find((c) => c.ref.contentHash === body.contentHash);
      if (revision === undefined) return reject("CONTRACT_UNKNOWN", ["body", "contentHash"]);
      if (task.contracts.at(-1) !== revision) return reject("CONTRACT_SUPERSEDED", ["body", "contentHash"]);
      if (revision.decisions.some((d) => d.gate === body.gate)) return reject("APPROVAL_ALREADY_DECIDED", ["body", "gate"]);
      if (!isIndependentReviewer(revision.author, actor, work.policy)) return reject("REVIEWER_NOT_INDEPENDENT", ["actor"]);
      if (body.verdict === "changes_requested" && body.findings.length === 0) return reject("FINDINGS_REQUIRED", ["body", "findings"]);
      if (body.verdict === "approved") {
        for (const dep of revision.metadata.dependencies) {
          if (dep.acceptedCommit === null) return reject("DEPENDENCY_UNRESOLVED", ["body", "contentHash"], dep.taskId);
          if (acceptedCommitOf(view, dep.taskId) !== dep.acceptedCommit) {
            return reject("DEPENDENCY_NOT_ACCEPTED", ["body", "contentHash"], dep.taskId);
          }
        }
      }
      revision.decisions.push({ gate: body.gate, verdict: body.verdict, reviewer: actor, findings: body.findings });
      break;
    }
  }
  work.log.push(event);
  return null;
}

function samePolicy(a: Readonly<ReviewPolicy>, b: Readonly<ReviewPolicy>): boolean {
  return a.aiReviewIndependence === b.aiReviewIndependence;
}

export function emptyForgeState(policy: Readonly<ReviewPolicy>): ForgeState {
  return deepFreeze({ policy: { aiReviewIndependence: policy.aiReviewIndependence }, log: [], tasks: [] });
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
