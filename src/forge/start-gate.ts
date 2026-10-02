import { z } from "zod";
import { isAncestorOrSelf, isReachableFromRefs } from "./ancestry.ts";
import { deepFreeze } from "./freeze.ts";
import { RepoObservationSchema, type RepoObservation } from "./events.ts";
import { Sha256HexSchema, TaskIdSchema, compareCodeUnits } from "./primitives.ts";
import { findRevision, findTask, isApproved, currentContract, taskState, type ForgeState } from "./state.ts";

// Developer Start Gate (FORGE-CORE-0001A §12).
// Log facts are proven from the state. Repo facts come from a witnessed observation and are
// only as true as that observation; missing edges can only block (fail-closed).

export { RepoObservationSchema };

export const StartRequestSchema = z.strictObject({
  taskId: TaskIdSchema,
  contentHash: Sha256HexSchema,
  repoObservation: RepoObservationSchema,
});

export type { RepoObservation };
export type StartRequest = z.output<typeof StartRequestSchema>;

export type BlockReasonCode =
  | "REQUEST_INVALID"
  | "TASK_UNKNOWN"
  | "TASK_NOT_STARTABLE"
  | "RUN_ALREADY_ACTIVE"
  | "CONTRACT_UNKNOWN"
  | "CONTRACT_NOT_CURRENT"
  | "CONTRACT_NOT_APPROVED"
  | "CONTRACT_FILE_MISMATCH"
  | "CONTRACT_NOT_PERSISTED"
  | "BASE_COMMIT_NOT_PERSISTED"
  | "BASE_NOT_IN_CONTRACT_HISTORY"
  | "DEPENDENCY_NOT_IN_BASE";

export type BlockReason = { readonly code: BlockReasonCode; readonly subject: string | null };

export type StartDecision =
  | { readonly allowed: true; readonly startFromCommit: string }
  | { readonly allowed: false; readonly reasons: readonly BlockReason[] };

function compareReasons(a: BlockReason, b: BlockReason): number {
  if (a.code !== b.code) return compareCodeUnits(a.code, b.code);
  if (a.subject === b.subject) return 0;
  if (a.subject === null) return -1;
  if (b.subject === null) return 1;
  return compareCodeUnits(a.subject, b.subject);
}

function blocked(reasons: BlockReason[]): StartDecision {
  return deepFreeze({ allowed: false, reasons: reasons.sort(compareReasons) });
}

export function canStartDeveloperRun(state: ForgeState, request: unknown): StartDecision {
  const parsed = StartRequestSchema.safeParse(request);
  if (!parsed.success) return blocked([{ code: "REQUEST_INVALID", subject: null }]);
  const { taskId, contentHash, repoObservation: observation } = parsed.data;

  if (findTask(state, taskId) === null) return blocked([{ code: "TASK_UNKNOWN", subject: null }]);

  const reasons: BlockReason[] = [];
  const add = (code: BlockReasonCode, subject: string | null = null) => reasons.push({ code, subject });

  const currentTaskState = taskState(state, taskId)!;
  // Startable: ready and rework_required (FORGE-CORE-0001B §11). An active run is its own reason.
  if (currentTaskState === "implementing") add("RUN_ALREADY_ACTIVE");
  else if (currentTaskState !== "ready" && currentTaskState !== "rework_required") add("TASK_NOT_STARTABLE", currentTaskState);

  const revision = findRevision(state, taskId, contentHash);
  if (revision === null) {
    add("CONTRACT_UNKNOWN");
    return blocked(reasons);
  }

  // Log facts of the requested revision.
  if (currentContract(state, taskId) !== revision) add("CONTRACT_NOT_CURRENT");
  if (!isApproved(revision)) add("CONTRACT_NOT_APPROVED");

  // Witnessed repo facts.
  const { refs, parents, contractAtCommit } = observation;
  const { baseCommit, dependencies } = revision.metadata;
  if (
    contractAtCommit.commit !== revision.contractCommit ||
    contractAtCommit.path !== revision.contractPath ||
    contractAtCommit.contentHash !== revision.ref.contentHash
  ) {
    add("CONTRACT_FILE_MISMATCH");
  }
  if (!isReachableFromRefs(revision.contractCommit, refs, parents)) add("CONTRACT_NOT_PERSISTED");
  if (!isReachableFromRefs(baseCommit, refs, parents)) add("BASE_COMMIT_NOT_PERSISTED");
  if (!isAncestorOrSelf(baseCommit, revision.contractCommit, parents)) add("BASE_NOT_IN_CONTRACT_HISTORY");
  for (const dep of dependencies) {
    if (dep.acceptedCommit !== null && !isAncestorOrSelf(dep.acceptedCommit, baseCommit, parents)) {
      add("DEPENDENCY_NOT_IN_BASE", dep.taskId);
    }
  }

  if (reasons.length > 0) return blocked(reasons);
  return deepFreeze({ allowed: true, startFromCommit: revision.contractCommit });
}
