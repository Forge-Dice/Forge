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
