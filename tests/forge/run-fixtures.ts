import { SHA, ai, contractText, decide, event, hashOf, human, linearGraph, metadata, observation, registerContract, registerTask, system } from "./fixtures.ts";

// Builders for FORGE-CORE-0001B run, evidence, review and acceptance events.

export const RESULT = "7".repeat(40); // child of SHA.contract
export const LATER = "8".repeat(40); // child of RESULT
export const FOREIGN = "9".repeat(40); // unrelated commit

export const DEV = ai("vendor-a", "developer");
export const VERIFIER = ai("vendor-a", "verifier");
export const CODE_REVIEWER = ai("vendor-b", "code-reviewer");
export const OBSERVER = system();
export const OWNER_HUMAN = human("owner");

export function runGraph(): Record<string, string[]> {
  return { ...linearGraph(), [RESULT]: [SHA.contract], [LATER]: [RESULT] };
}

export function contractFor(meta: Record<string, unknown> = {}) {
  const text = contractText(metadata({ scope: { create: ["src/a.ts"], modify: ["src/b.ts"] }, ...meta }));
  return { text, contentHash: hashOf(text) };
}

const C = contractFor();
export const CONTENT_HASH = C.contentHash;

/** Task registered, contract registered at SHA.contract and approved. */
export function approvedTask(meta: Record<string, unknown> = {}, taskId = "TASK-0001") {
  const { text, contentHash } = contractFor(meta);
  return { contentHash, events: [registerTask(taskId), registerContract(text, { taskId }), decide(contentHash, "approved", { taskId })] };
}

export const startRun = (runId: string, opts: { contentHash?: string; actor?: object; obs?: object; taskId?: string } = {}) =>
  event(opts.actor ?? DEV, "developer", {
    type: "run_started",
    runId,
    taskId: opts.taskId ?? "TASK-0001",
    contentHash: opts.contentHash ?? CONTENT_HASH,
    repoObservation: opts.obs ?? observation(opts.contentHash ?? CONTENT_HASH),
  });

export const reportFor = (runId: string, overrides: Record<string, unknown> = {}, actor: object = DEV) =>
  event(actor, "developer", {
    type: "developer_report_recorded",
    runId,
    report: {
      claimedResultCommit: RESULT,
      claimedRemoteRef: "claude/branch",
      commandsRun: [{ command: "npm test", exitCode: 0 }],
      mutations: [],
      deviations: [],
      knownLimitations: [],
      reviewHints: [],
      ...overrides,
    },
  });

export const observe = (runId: string, opts: { ref?: string; head?: string | null; parents?: Record<string, string[]> } = {}) =>
  event(OBSERVER, "observer", {
    type: "remote_observed",
    runId,
    ref: opts.ref ?? "claude/branch",
    head: opts.head === undefined ? RESULT : opts.head,
    parents: opts.parents ?? runGraph(),
  });

export const goodEvidence = (runId: string, overrides: Record<string, unknown> = {}) => ({
  runId,
  verifiedCommit: RESULT,
  method: "fresh_clone",
  changedFiles: [{ path: "src/a.ts", change: "added" }],
  checks: [{ name: "test", command: "npm test", exitCode: 0 }],
  mutations: null,
  ...overrides,
});

export const verify = (runId: string, overrides: Record<string, unknown> = {}, actor: object = VERIFIER) =>
  event(actor, "verifier", { type: "verification_recorded", evidence: goodEvidence(runId, overrides) });

export const review = (
  runId: string,
  verdict: "approve" | "request_changes",
  opts: { requires?: string | null; findings?: object[]; ack?: string[]; actor?: object; commit?: string } = {},
) =>
  event(opts.actor ?? CODE_REVIEWER, "code_reviewer", {
    type: "code_review_recorded",
    runId,
    reviewedCommit: opts.commit ?? RESULT,
    verdict,
    requires: opts.requires === undefined ? (verdict === "approve" ? null : "code_change") : opts.requires,
    findings: opts.findings ?? (verdict === "approve" ? [] : [{ severity: "blocking", summary: "fix", location: null }]),
    acknowledgedEquivalentMutations: opts.ack ?? [],
  });

export const accept = (runId: string, actor: object = OWNER_HUMAN, taskId = "TASK-0001") =>
  event(actor, "owner", { type: "task_accepted", taskId, runId });

export const fail = (runId: string, code = "PUSH_REJECTED", opts: { actor?: object; role?: string } = {}) =>
  event(opts.actor ?? DEV, opts.role ?? "developer", { type: "run_failed", runId, code, detail: "push returned 403" });

export const abandon = (runId: string, reason = "WORKER_LOST") =>
  event(OWNER_HUMAN, "owner", { type: "run_abandoned", runId, reason, detail: "container reclaimed" });

/** Approved task plus one run that is verified (start, report, contained observation, passing evidence). */
export function verifiedRun(runId = "run:1", meta: Record<string, unknown> = {}) {
  const { events, contentHash } = approvedTask(meta);
  return { contentHash, events: [...events, startRun(runId, { contentHash }), reportFor(runId), observe(runId), verify(runId)] };
}

export const mutation = (name: string, outcome: string, classification = "must_detect", rationale: string | null = null) => ({
  name,
  description: `mutant ${name}`,
  outcome,
  classification,
  equivalenceRationale: rationale,
});

export { SHA };
