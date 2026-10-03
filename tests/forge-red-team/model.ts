import { createHash } from "node:crypto";

// Red-team reference model for FORGE-CORE-0001A/B (test-only).
// Written from the contract text, deliberately slow and simple. It imports NO production
// helper: own ancestry, remote outcome, verification evaluation, run/task state, start gate
// and per-event acceptance. Only the event *schema* is taken from production (the caller
// filters schema-invalid events first), because re-specifying Zod schemas is not the target.

type Id = { actorType: string; provider: string; model: string | null; label: string };
type Meta = {
  taskId: string;
  contractVersion: number;
  baseCommit: string;
  dependencies: { taskId: string; acceptedCommit: string | null }[];
  scope: { create: string[]; modify: string[] };
  requiredChecks: { name: string; command: string }[];
  mutationSmoke: "none" | "optional" | "required";
};
type Mut = { name: string; outcome: string; classification: string; equivalenceRationale: string | null };
type Version = { hash: string; meta: Meta; path: string; commit: string; author: Id; decision: { verdict: string } | null };
type ModelTask = { taskId: string; versions: Version[]; acceptedRun: string | null };
type Obs = { ref: string; head: string | null; parents: Record<string, string[]> };
type ModelRun = {
  runId: string;
  taskId: string;
  hash: string;
  dev: Id;
  start: string;
  report: { claimedResultCommit: string; claimedRemoteRef: string; mutations: Mut[] } | null;
  observations: Obs[];
  verification: { verifiedCommit: string; changedFiles: { path: string; change: string }[]; checks: { name: string; command: string; exitCode: number }[]; mutations: Mut[] | null } | null;
  failed: boolean;
  abandoned: boolean;
  verdict: { verdict: string; requires: string | null } | null;
};

export type ModelState = { tasks: ModelTask[]; runs: ModelRun[] };
export const emptyModel = (): ModelState => ({ tasks: [], runs: [] });

// ---------- primitives ----------

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** Plain breadth-first search over parent edges; missing edges block. */
export function refAncestor(ancestor: string, descendant: string, parents: Record<string, string[]>): boolean {
  const queue = [descendant];
  const visited: string[] = [];
  while (queue.length > 0) {
    const c = queue.shift()!;
    if (c === ancestor) return true;
    if (visited.includes(c)) continue;
    visited.push(c);
    if (own(parents, c)) queue.push(...parents[c]!);
  }
  return false;
}

const sameId = (a: Id, b: Id) => JSON.stringify([a.actorType, a.provider, a.model, a.label]) === JSON.stringify([b.actorType, b.provider, b.model, b.label]);

function independent(author: Id, reviewer: Id): boolean {
  // policy is fixed to different_provider in the red-team runs
  if (reviewer.actorType === "system") return false;
  if (sameId(author, reviewer)) return false;
  if (author.actorType === "ai_agent" && reviewer.actorType === "ai_agent") return author.provider !== reviewer.provider;
  return true;
}

export function refContractHash(text: string): string {
  return createHash("sha256").update("forge-contract-v1\n" + text, "utf8").digest("hex");
}

/** Minimal contract reading for model purposes; returns null for anything the generator did not intend as valid. */
function readContract(text: string): Meta | null {
  if (!text.startsWith("---json\n")) return null;
  const end = text.indexOf("\n---\n", 7);
  if (end < 0) return null;
  const json = text.slice(8, end);
  try {
    const value = JSON.parse(json);
    if (JSON.stringify(value, null, 2) !== json) return null;
    return value as Meta;
  } catch {
    return null;
  }
}

// ---------- derived ----------

const task = (m: ModelState, id: string) => m.tasks.find((t) => t.taskId === id);
const run = (m: ModelState, id: string) => m.runs.find((r) => r.runId === id);

function contained(r: ModelRun, o: Obs): boolean {
  const rep = r.report!;
  return o.ref === rep.claimedRemoteRef && o.head !== null && refAncestor(rep.claimedResultCommit, o.head, o.parents) && refAncestor(r.start, rep.claimedResultCommit, o.parents);
}

export function refEffectiveMutations(meta: Meta, r: ModelRun): Mut[] {
  if (meta.mutationSmoke === "none") return [];
  return r.verification!.mutations ?? r.report!.mutations;
}

export function refPassed(meta: Meta, r: ModelRun): boolean {
  const ev = r.verification!;
  for (const req of meta.requiredChecks) {
    if (!ev.checks.some((c) => c.name === req.name && c.command === req.command && c.exitCode === 0)) return false;
  }
  for (const f of ev.changedFiles) {
    if (f.path.startsWith("forge/coordination/")) continue;
    if (f.path.startsWith("forge/contracts/") || f.path.startsWith("forge/approvals/")) return false;
    const ok = (f.change === "added" && meta.scope.create.includes(f.path)) || (f.change === "modified" && meta.scope.modify.includes(f.path));
    if (!ok) return false;
  }
  if (meta.mutationSmoke !== "none") {
    const muts = refEffectiveMutations(meta, r);
    if (meta.mutationSmoke === "required" && muts.length === 0) return false;
    const names: string[] = [];
    for (const mu of muts) {
      if (names.includes(mu.name)) return false;
      names.push(mu.name);
      if (mu.outcome === "not_applied") return false;
      const eq = mu.classification === "equivalent";
      if (eq && mu.outcome === "detected") return false;
      if (eq !== (mu.equivalenceRationale !== null)) return false;
      if (!eq && mu.outcome === "survived") return false;
    }
  }
  return true;
}

const metaOf = (m: ModelState, r: ModelRun) => task(m, r.taskId)!.versions.find((v) => v.hash === r.hash)!.meta;

export function refRunState(m: ModelState, runId: string): string {
  const r = run(m, runId)!;
  if (r.abandoned) return "abandoned";
  if (r.failed) return "failed";
  if (r.verification !== null) return refPassed(metaOf(m, r), r) ? "verified" : "failed";
  if (r.report === null) return "running";
  return r.observations.some((o) => contained(r, o)) ? "remote_verified" : "reported";
}

const terminal = (s: string) => s === "verified" || s === "failed" || s === "abandoned";

function latestVerified(m: ModelState, taskId: string): ModelRun | null {
  const cur = task(m, taskId)!.versions.at(-1);
  if (cur === undefined) return null;
  let last: ModelRun | null = null;
  for (const r of m.runs) if (r.taskId === taskId && r.hash === cur.hash && refRunState(m, r.runId) === "verified") last = r;
  return last;
}

export function refTaskState(m: ModelState, taskId: string): string {
  const t = task(m, taskId)!;
  if (t.acceptedRun !== null) return "accepted";
  if (m.runs.some((r) => r.taskId === taskId && !terminal(refRunState(m, r.runId)))) return "implementing";
  const cur = t.versions.at(-1);
  if (cur === undefined) return "planned";
  const lv = latestVerified(m, taskId);
  if (lv !== null) {
    if (lv.verdict === null) return "awaiting_review";
    if (lv.verdict.verdict === "approve") return "review_approved";
    return lv.verdict.requires === "code_change" ? "rework_required" : "contract_revision_required";
  }
  return cur.decision?.verdict === "approved" ? "ready" : "specifying";
}

export function refAcceptedCommit(m: ModelState, taskId: string): string | null {
  const t = task(m, taskId);
  if (t === undefined || t.acceptedRun === null) return null;
  return run(m, t.acceptedRun)!.verification!.verifiedCommit;
}

export function refGate(m: ModelState, taskId: string, hash: string, obs: { refs: Record<string, string>; parents: Record<string, string[]>; contractAtCommit: { commit: string; path: string; contentHash: string } }): boolean {
  const t = task(m, taskId);
  if (t === undefined) return false;
  const ts = refTaskState(m, taskId);
  if (ts !== "ready" && ts !== "rework_required") return false;
  const v = t.versions.find((x) => x.hash === hash);
  if (v === undefined || v !== t.versions.at(-1) || v.decision?.verdict !== "approved") return false;
  const c = obs.contractAtCommit;
  if (c.commit !== v.commit || c.path !== v.path || c.contentHash !== v.hash) return false;
  const reach = (x: string) => Object.keys(obs.refs).some((k) => refAncestor(x, obs.refs[k]!, obs.parents));
  if (!reach(v.commit) || !reach(v.meta.baseCommit)) return false;
  if (!refAncestor(v.meta.baseCommit, v.commit, obs.parents)) return false;
  return v.meta.dependencies.every((d) => d.acceptedCommit === null || refAncestor(d.acceptedCommit, v.meta.baseCommit, obs.parents));
}

const ROLES: Record<string, string[]> = {
  task_registered: ["owner"],
  contract_registered: ["spec_author"],
  approval_recorded: ["architecture_reviewer"],
  run_started: ["developer"],
  developer_report_recorded: ["developer"],
  remote_observed: ["observer"],
  verification_recorded: ["verifier"],
  run_failed: ["developer", "owner"],
  run_abandoned: ["owner"],
  code_review_recorded: ["code_reviewer"],
  task_accepted: ["owner"],
};

/** Applies a schema-valid event to the model. Returns false (model unchanged) if the contract rules reject it. */
export function refApply(m: ModelState, e: { actor: Id; role: string; body: any }): boolean {
  const b = e.body;
  const a = e.actor;
  if (!ROLES[b.type]!.includes(e.role)) return false;
  const active = (r: ModelRun) => ["running", "reported", "remote_verified"].includes(refRunState(m, r.runId));
  switch (b.type) {
    case "task_registered":
      if (task(m, b.taskId)) return false;
      m.tasks.push({ taskId: b.taskId, versions: [], acceptedRun: null });
      return true;
    case "contract_registered": {
      const t = task(m, b.taskId);
      if (!t || t.acceptedRun !== null) return false;
      const meta = readContract(b.contractText);
      if (meta === null) return false;
      const hash = refContractHash(b.contractText);
      if (hash !== b.declaredContentHash || meta.taskId !== b.taskId || b.contractPath !== `forge/contracts/${b.taskId}.md`) return false;
      if (meta.contractVersion !== (t.versions.at(-1)?.meta.contractVersion ?? 0) + 1) return false;
      t.versions.push({ hash, meta, path: b.contractPath, commit: b.contractCommit, author: a, decision: null });
      return true;
    }
    case "approval_recorded": {
      const t = task(m, b.taskId);
      if (!t || t.acceptedRun !== null) return false;
      const v = t.versions.find((x) => x.hash === b.contentHash);
      if (!v || v !== t.versions.at(-1) || v.decision !== null || !independent(v.author, a)) return false;
      if (b.verdict === "changes_requested" && b.findings.length === 0) return false;
      if (b.verdict === "approved") {
        for (const d of v.meta.dependencies) {
          if (d.acceptedCommit === null || refAcceptedCommit(m, d.taskId) !== d.acceptedCommit) return false;
        }
      }
      v.decision = { verdict: b.verdict };
      return true;
    }
    case "run_started": {
      if (!task(m, b.taskId) || run(m, b.runId)) return false;
      if (!refGate(m, b.taskId, b.contentHash, b.repoObservation)) return false;
      const v = task(m, b.taskId)!.versions.find((x) => x.hash === b.contentHash)!;
      m.runs.push({ runId: b.runId, taskId: b.taskId, hash: b.contentHash, dev: a, start: v.commit, report: null, observations: [], verification: null, failed: false, abandoned: false, verdict: null });
      return true;
    }
    case "developer_report_recorded": {
      const r = run(m, b.runId);
      if (!r || refRunState(m, r.runId) !== "running" || !sameId(r.dev, a)) return false;
      r.report = b.report;
      return true;
    }
    case "remote_observed": {
      const r = run(m, b.runId);
      if (!r || refRunState(m, r.runId) !== "reported") return false;
      r.observations.push({ ref: b.ref, head: b.head, parents: b.parents });
      return true;
    }
    case "verification_recorded": {
      const r = run(m, b.evidence.runId);
      if (!r || refRunState(m, r.runId) !== "remote_verified" || b.evidence.verifiedCommit !== r.report!.claimedResultCommit) return false;
      r.verification = b.evidence;
      return true;
    }
    case "run_failed": {
      const r = run(m, b.runId);
      if (!r || !active(r)) return false;
      if (e.role === "developer" && !sameId(r.dev, a)) return false;
      r.failed = true;
      return true;
    }
    case "run_abandoned": {
      const r = run(m, b.runId);
      if (!r || !active(r)) return false;
      r.abandoned = true;
      return true;
    }
    case "code_review_recorded": {
      const r = run(m, b.runId);
      if (!r || refRunState(m, r.runId) !== "verified" || latestVerified(m, r.taskId) !== r || r.verdict !== null) return false;
      if (b.reviewedCommit !== r.verification!.verifiedCommit || !independent(r.dev, a)) return false;
      const blocking = b.findings.some((f: { severity: string }) => f.severity === "blocking");
      if (b.verdict === "approve" ? b.requires !== null || blocking : b.requires === null || b.findings.length === 0) return false;
      const expected = refEffectiveMutations(metaOf(m, r), r).filter((x) => x.classification === "equivalent").map((x) => x.name);
      const ack: string[] = b.acknowledgedEquivalentMutations;
      if (new Set(expected).size !== new Set(ack).size || expected.some((n) => !ack.includes(n))) return false;
      r.verdict = { verdict: b.verdict, requires: b.requires };
      return true;
    }
    case "task_accepted": {
      const t = task(m, b.taskId);
      if (!t || refTaskState(m, b.taskId) !== "review_approved" || latestVerified(m, b.taskId)?.runId !== b.runId || a.actorType !== "human") return false;
      t.acceptedRun = b.runId;
      return true;
    }
  }
  return false;
}

export const modelTasks = (m: ModelState) => m.tasks.map((t) => t.taskId);
export const modelRuns = (m: ModelState) => m.runs.map((r) => r.runId);
