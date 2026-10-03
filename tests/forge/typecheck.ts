// Compile-time tests for FORGE-CORE-0001A: checked by `npm run typecheck`, never executed.

import type { ContractDocument } from "../../src/forge/contract-document.ts";
import type { ForgeKernel } from "../../src/forge/kernel.ts";
import type { StartDecision } from "../../src/forge/start-gate.ts";
import type { ForgeState } from "../../src/forge/state.ts";

declare const state: ForgeState;
declare const document: ContractDocument;
declare const decision: StartDecision;
declare const kernel: ForgeKernel;

// @ts-expect-error the log is readonly
state.log.push(state.log[0]!);
// @ts-expect-error tasks are readonly
state.tasks[0]!.contracts[0]!.decisions = [];
// @ts-expect-error the policy is readonly
state.policy.aiReviewIndependence = "different_identity";
// @ts-expect-error there is no stored status anywhere in a task record
state.tasks[0]!.status;
// @ts-expect-error the content hash is derived, never assignable
document.ref.contentHash = "x";
// @ts-expect-error metadata is readonly
document.metadata.contractVersion = 2;
// @ts-expect-error a blocked decision has no start commit
if (!decision.allowed) decision.startFromCommit;
// @ts-expect-error reasons are readonly
if (!decision.allowed) decision.reasons.pop();
// @ts-expect-error the kernel cannot be rebound to another policy
kernel.policy = { aiReviewIndependence: "different_identity" };

export {};

// FORGE-CORE-0001B
import type { RunRecord, RunState, TaskState } from "../../src/forge/state.ts";
import type { VerificationEvaluation } from "../../src/forge/verification.ts";

declare const run: RunRecord;
declare const evaluation: VerificationEvaluation;

// @ts-expect-error run records are readonly facts
run.report = null;
// @ts-expect-error observations are append-only only inside the reducer
run.observations.push(run.observations[0]!);
// @ts-expect-error there is no stored run status
run.state;
// @ts-expect-error a passed evaluation has no failures
if (evaluation.passed) evaluation.failures;
// @ts-expect-error "merged" is not a V0.0 task state
const merged: TaskState = "merged";
// @ts-expect-error "created" was removed from the run lifecycle
const created: RunState = "created";

export { merged, created };

import type { ChangedFile } from "../../src/forge/runs.ts";
const move: ChangedFile = { change: "renamed", fromPath: "a", toPath: "b" };
const edit: ChangedFile = { change: "modified", path: "a" };
// @ts-expect-error a rename cannot omit either endpoint
const oldRename: ChangedFile = { change: "renamed", path: "a" };
// @ts-expect-error no target endpoint
const missingTarget: ChangedFile = { change: "renamed", fromPath: "a" };
// @ts-expect-error non-rename cannot carry rename fields
const mixed: ChangedFile = { change: "added", path: "a", toPath: "b" };
export { move, edit, oldRename, missingTarget, mixed };
