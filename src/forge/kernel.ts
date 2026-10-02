import { parseContractDocument, type ContractDocumentResult, type Sha256Utf8 } from "./contract-document.ts";
import { deepFreeze } from "./freeze.ts";
import { ReviewPolicySchema, type ReviewPolicy } from "./identity.ts";
import { canStartDeveloperRun, type StartDecision } from "./start-gate.ts";
import { applyEvent, emptyForgeState, replay, type ApplyResult, type ForgeState, type KernelDeps, type ReplayResult } from "./state.ts";

// Kernel factory (FORGE-CORE-0001A §13): binds the SHA-256 port and the review policy.
// The kernel holds no mutable state; the log is always an explicit input.

export type ForgeKernel = {
  readonly policy: Readonly<ReviewPolicy>;
  emptyState(): ForgeState;
  parseContractDocument(text: string): ContractDocumentResult;
  applyEvent(state: ForgeState, event: unknown): ApplyResult;
  replay(events: readonly unknown[]): ReplayResult;
  canStartDeveloperRun(state: ForgeState, request: unknown): StartDecision;
};

export function createForgeKernel(config: { sha256Utf8: Sha256Utf8; policy: ReviewPolicy }): ForgeKernel {
  const policy = deepFreeze(ReviewPolicySchema.parse(config.policy));
  const deps: KernelDeps = Object.freeze({ sha256Utf8: config.sha256Utf8, policy });
  return Object.freeze({
    policy,
    emptyState: () => emptyForgeState(policy),
    parseContractDocument: (text: string) => parseContractDocument(text, deps.sha256Utf8),
    applyEvent: (state: ForgeState, event: unknown) => applyEvent(state, event, deps),
    replay: (events: readonly unknown[]) => replay(events, deps),
    canStartDeveloperRun: (state: ForgeState, request: unknown) => canStartDeveloperRun(state, request),
  });
}
