import { createForgeKernel, type ForgeKernel } from "../../src/forge/kernel.ts";
import { nodeSha256Utf8 } from "../../src/forge/node-sha256.ts";
import type { ForgeState } from "../../src/forge/state.ts";

// Shared builders for FORGE-CORE-0001A tests. Commits are synthetic 40-hex strings.

export const SHA = {
  dep: "4".repeat(40),
  base: "1".repeat(40),
  contract: "2".repeat(40),
  head: "5".repeat(40),
  other: "3".repeat(40),
  side: "6".repeat(40),
} as const;

/** dep <- base <- contract <- head (parent edges point from child to parent). */
export function linearGraph(): Record<string, string[]> {
  return { [SHA.head]: [SHA.contract], [SHA.contract]: [SHA.base], [SHA.base]: [SHA.dep] };
}

export const human = (label = "owner") => ({ actorType: "human", provider: "human", model: null, label });
export const ai = (provider: string, label = `${provider}-agent`) => ({ actorType: "ai_agent", provider, model: null, label });
export const system = () => ({ actorType: "system", provider: "forge", model: null, label: "forge" });

export const AUTHOR = ai("vendor-a", "spec-author");
export const REVIEWER = ai("vendor-b", "architect");
export const OWNER = human("owner");

export function metadata(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    forgeContractFormat: 1,
    taskId: "TASK-0001",
    contractVersion: 1,
    baseCommit: SHA.base,
    dependencies: [],
    scope: { create: ["src/a.ts"], modify: [] },
    requiredChecks: [{ name: "test", command: "npm test" }],
    mutationSmoke: "optional",
    ...overrides,
  };
}

export function contractText(meta: Record<string, unknown> = metadata(), body = "# Contract\n\nBody.\n"): string {
  return `---json\n${JSON.stringify(meta, null, 2)}\n---\n${body}`;
}

export const kernel: ForgeKernel = createForgeKernel({
  sha256Utf8: nodeSha256Utf8,
  policy: { aiReviewIndependence: "different_provider" },
});

export const hashOf = (text: string): string => {
  const result = kernel.parseContractDocument(text);
  if (!result.ok) throw new Error(`fixture contract invalid: ${JSON.stringify(result.issues)}`);
  return result.document.ref.contentHash;
};

export const event = (actor: object, role: string, body: object) => ({ actor, role, recordedAt: null, body });

export const registerTask = (taskId = "TASK-0001", actor: object = OWNER) =>
  event(actor, "owner", { type: "task_registered", taskId, title: `Task ${taskId}` });

export const registerContract = (text: string, opts: { taskId?: string; commit?: string; actor?: object; declared?: string; path?: string } = {}) => {
  const taskId = opts.taskId ?? "TASK-0001";
  return event(opts.actor ?? AUTHOR, "spec_author", {
    type: "contract_registered",
    taskId,
    contractPath: opts.path ?? `forge/contracts/${taskId}.md`,
    contractCommit: opts.commit ?? SHA.contract,
    contractText: text,
    declaredContentHash: opts.declared ?? hashOf(text),
  });
};

export const decide = (
  contentHash: string,
  verdict: "approved" | "changes_requested",
  opts: { taskId?: string; actor?: object; findings?: object[] } = {},
) =>
  event(opts.actor ?? REVIEWER, "architecture_reviewer", {
    type: "approval_recorded",
    taskId: opts.taskId ?? "TASK-0001",
    contentHash,
    gate: "architecture_review",
    verdict,
    findings: opts.findings ?? (verdict === "changes_requested" ? [{ severity: "blocking", summary: "fix it", location: null }] : []),
  });

/** Replays events and fails loudly if any is rejected. */
export function stateOf(events: readonly unknown[], k: ForgeKernel = kernel): ForgeState {
  const result = k.replay(events);
  if (!result.ok) throw new Error(`replay rejected event ${result.index}: ${JSON.stringify(result.rejection)}`);
  return result.state;
}

/** A task with one approved contract registered at SHA.contract. */
export function approvedWorld(meta: Record<string, unknown> = metadata()) {
  const text = contractText(meta);
  const contentHash = hashOf(text);
  const state = stateOf([registerTask(), registerContract(text), decide(contentHash, "approved")]);
  return { text, contentHash, state };
}

export function observation(contentHash: string, overrides: Record<string, unknown> = {}) {
  return {
    refs: { "claude/branch": SHA.head },
    parents: linearGraph(),
    contractAtCommit: { commit: SHA.contract, path: "forge/contracts/TASK-0001.md", contentHash },
    ...overrides,
  };
}

/** Visits every object/array and reports the paths of unfrozen ones. */
export function unfrozenPaths(value: unknown, path = "$", out: string[] = []): string[] {
  if (typeof value === "object" && value !== null) {
    if (!Object.isFrozen(value)) out.push(path);
    for (const [key, child] of Object.entries(value)) unfrozenPaths(child, `${path}.${key}`, out);
  }
  return out;
}
