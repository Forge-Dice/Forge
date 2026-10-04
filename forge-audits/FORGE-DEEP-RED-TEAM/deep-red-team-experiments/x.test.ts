import { it } from "vitest";
import { SHA, ai, contractText, decide, event, hashOf, human, kernel, metadata, observation, registerContract, registerTask, stateOf, system, linearGraph } from "../forge/fixtures.ts";
import { DEV, RESULT, LATER, FOREIGN, accept, approvedTask, contractFor, goodEvidence, observe, reportFor, review, runGraph, startRun, verify, verifiedRun, fail, abandon, CODE_REVIEWER } from "../forge/run-fixtures.ts";
import { runState, taskState, verificationOf } from "../../src/forge/state.ts";
import { evaluateVerification } from "../../src/forge/verification.ts";
import { createForgeKernel } from "../../src/forge/kernel.ts";
import { nodeSha256Utf8 } from "../../src/forge/node-sha256.ts";

const out: Record<string, unknown> = {};
const rep = (k: any, events: unknown[]) => { const r = k.replay(events); return r.ok ? { ok: true } : { ok: false, index: r.index, code: r.rejection.code, subject: r.rejection.subject }; };
const meta = (m: any) => ({ scope: { create: ["src/a.ts"], modify: ["src/b.ts"] }, requiredChecks: [{ name: "test", command: "npm test" }], mutationSmoke: "optional", ...m });

it("experiments", () => {
  // X01 out-of-order observations: branch deleted (null) recorded, then stale positive push webhook
  {
    const { events } = approvedTask();
    const ev = [...events, startRun("run:1"), reportFor("run:1"), observe("run:1", { head: null }), observe("run:1")];
    const s = stateOf(ev);
    out.X01 = { runState: runState(s, "run:1") };
    // later fresh negative after positive
    out.X01b = rep(kernel, [...ev, observe("run:1", { head: null })]);
    // continue to accepted
    const s2 = stateOf([...ev, verify("run:1"), review("run:1", "approve"), accept("run:1")]);
    out.X01c = taskState(s2, "TASK-0001");
  }
  // X02 observation before report (push webhook arrives before developer report)
  {
    const { events } = approvedTask();
    out.X02 = rep(kernel, [...events, startRun("run:1"), observe("run:1")]);
  }
  // X03 AI/system actor in owner role: abandons another developer's run, fails it, registers task
  {
    const { events } = approvedTask();
    const rogue = ai("vendor-z", "rogue");
    const ev = [...events, startRun("run:1"), event(rogue, "owner", { type: "run_abandoned", runId: "run:1", reason: "OWNER_CANCELLED", detail: "x" })];
    const s = stateOf(ev);
    out.X03a = runState(s, "run:1");
    const ev2 = [...events, startRun("run:1"), event(system(), "owner", { type: "run_failed", runId: "run:1", code: "DEVELOPER_ABORTED", detail: "x" })];
    out.X03b = runState(stateOf(ev2), "run:1");
    out.X03c = rep(kernel, [event(rogue, "owner", { type: "task_registered", taskId: "TASK-0009", title: "x" })]);
    out.X03d = rep(kernel, [...events, startRun("run:1"), reportFor("run:1"), observe("run:1"), verify("run:1"), review("run:1", "approve"), event(rogue, "owner", { type: "task_accepted", taskId: "TASK-0001", runId: "run:1" })]);
  }
  // X04 architecture changes_requested (blocking) -> cosmetic v2 -> other reviewer / same reviewer approves
  {
    const t1 = contractText(metadata());
    const h1 = hashOf(t1);
    const t2 = contractText(metadata({ contractVersion: 2 }));
    const h2 = hashOf(t2);
    const base = [registerTask(), registerContract(t1), decide(h1, "changes_requested"), registerContract(t2)];
    out.X04a = taskState(stateOf([...base, decide(h2, "approved", { actor: ai("vendor-c", "architect-2") })]), "TASK-0001");
    out.X04b = taskState(stateOf([...base, decide(h2, "approved")]), "TASK-0001");
    out.X04_diff = { sameScope: true, onlyVersionChanged: true };
  }
  // X05 identity label whitespace variant under different_identity
  {
    const k = createForgeKernel({ sha256Utf8: nodeSha256Utf8, policy: { aiReviewIndependence: "different_identity" } });
    const { events } = approvedTask();
    const twin = { ...DEV, label: DEV.label + " " };
    out.X05 = rep(k, [...events, startRun("run:1"), reportFor("run:1"), observe("run:1"), verify("run:1"), review("run:1", "approve", { actor: twin }), accept("run:1")]);
  }
  // X06 ref ambiguity & option-like refs
  {
    const { events, contentHash } = approvedTask();
    const obs = observation(contentHash, { refs: { "main": SHA.head, "refs/heads/main": SHA.other, "-x": SHA.head, "--upload-pack": SHA.head } });
    out.X06a = rep(kernel, [...events, startRun("run:1", { contentHash, obs })]);
    out.X06b = rep(kernel, [...events, startRun("run:1"), reportFor("run:1", { claimedRemoteRef: "--upload-pack" }), observe("run:1", { ref: "--upload-pack" })]);
  }
  // X07 scope can name other task contract / case alias of own contract path / approvals
  {
    const r = kernel.parseContractDocument(contractText(metadata({ scope: { create: ["forge/Contracts/TASK-0001.md", "Forge/contracts/TASK-0001.md", "forge/contracts./TASK-0001.md", "forge/approvals/TASK-0001.json"], modify: ["forge/contracts/TASK-0002.md"] } })));
    out.X07a = r.ok;
    const m = { scope: { create: ["forge/Contracts/TASK-0001.md", "forge/contracts./TASK-0001.md"], modify: [] }, requiredChecks: [{ name: "test", command: "npm test" }], mutationSmoke: "none" } as any;
    out.X07b = evaluateVerification(m, { mutations: [] }, { changedFiles: [{ path: "forge/Contracts/TASK-0001.md", change: "added" }, { path: "forge/contracts./TASK-0001.md", change: "added" }], checks: [{ name: "test", command: "npm test", exitCode: 0 }], mutations: null });
  }
  // X08 case collision
  {
    const m = { scope: { create: ["src/Foo.ts"], modify: [] }, requiredChecks: [{ name: "test", command: "npm test" }], mutationSmoke: "none" } as any;
    out.X08 = evaluateVerification(m, { mutations: [] }, { changedFiles: [{ path: "src/Foo.ts", change: "added" }], checks: [{ name: "test", command: "npm test", exitCode: 0 }], mutations: null });
  }
  // X09 rename detection dependency
  {
    const m = { scope: { create: [], modify: [] }, requiredChecks: [{ name: "test", command: "npm test" }], mutationSmoke: "none" } as any;
    const c = [{ name: "test", command: "npm test", exitCode: 0 }];
    out.X09_renames = evaluateVerification(m, { mutations: [] }, { changedFiles: [{ fromPath: "forge/coordination/CODEX.md", toPath: "forge/coordination/archive/CODEX.md", change: "renamed" }], checks: c, mutations: null }).passed;
    out.X09_noRenames = evaluateVerification(m, { mutations: [] }, { changedFiles: [{ path: "forge/coordination/CODEX.md", change: "deleted" }, { path: "forge/coordination/archive/CODEX.md", change: "added" }], checks: c, mutations: null }).passed;
    // and a scope refactor: rename src/b.ts -> src/a.ts (both in scope)
    const m2 = { scope: { create: ["src/a.ts"], modify: ["src/b.ts"] }, requiredChecks: [{ name: "test", command: "npm test" }], mutationSmoke: "none" } as any;
    out.X09_scopeRename = evaluateVerification(m2, { mutations: [] }, { changedFiles: [{ fromPath: "src/b.ts", toPath: "src/a.ts", change: "renamed" }], checks: c, mutations: null });
  }
  // X10 symlink under coordination is just "added"
  {
    const m = { scope: { create: [], modify: [] }, requiredChecks: [{ name: "test", command: "npm test" }], mutationSmoke: "none" } as any;
    out.X10 = evaluateVerification(m, { mutations: [] }, { changedFiles: [{ path: "forge/coordination/context.md", change: "added" }], checks: [{ name: "test", command: "npm test", exitCode: 0 }], mutations: null }).passed;
  }
  // X12 U+FFFD collapse
  {
    const body = (b: number[]) => Buffer.concat([Buffer.from(contractText(metadata()), "utf8"), Buffer.from(b)]).toString("utf8");
    const a = kernel.parseContractDocument(body([0xff])); const b = kernel.parseContractDocument(body([0xfe])); const c = kernel.parseContractDocument(body([0xef, 0xbf, 0xbd]));
    out.X12 = { a: a.ok && a.document.ref.contentHash.slice(0, 12), b: b.ok && b.document.ref.contentHash.slice(0, 12), c: c.ok && c.document.ref.contentHash.slice(0, 12) };
  }
  // X13 lone surrogate labels survive JSON round trip
  {
    const k = createForgeKernel({ sha256Utf8: nodeSha256Utf8, policy: { aiReviewIndependence: "different_identity" } });
    const { events } = approvedTask();
    const d1 = { ...DEV, label: "dev\ud800" }; const r1 = { ...DEV, label: "dev\ud801" };
    const ev = [...events, startRun("run:1", { actor: d1 }), reportFor("run:1", {}, d1), observe("run:1"), verify("run:1"), review("run:1", "approve", { actor: r1 })];
    out.X13_live = rep(k, ev);
    const json = JSON.stringify(ev);
    out.X13_json = rep(k, JSON.parse(json));
    out.X13_lossy = rep(k, JSON.parse(Buffer.from(JSON.stringify(ev).replace(/\\ud80[01]/g, (m) => String.fromCharCode(parseInt(m.slice(2), 16))), "utf8").toString("utf8")));
  }
  // X14 raw input mutation after apply
  {
    const { events } = approvedTask();
    const ev = [...events, startRun("run:1"), reportFor("run:1")] as any[];
    const s = stateOf(ev);
    ev.at(-1).body.report.claimedResultCommit = FOREIGN;
    out.X14 = (s.runs[0]!.report as any).claimedResultCommit === RESULT;
  }
  // X15 number precision
  out.X15 = (kernel.parseContractDocument(contractText(metadata()).replace('"contractVersion": 1', '"contractVersion": 9007199254740993')) as any).issues?.[0]?.code;
  // X17 parallel run_started (serialized)
  { const { events } = approvedTask(); out.X17 = rep(kernel, [...events, startRun("run:1"), startRun("run:2")]); }
  // X18 late events for older run after newer run
  {
    const { events } = approvedTask();
    const ev = [...events, startRun("run:1"), fail("run:1", "DEVELOPER_ABORTED"), startRun("run:2"), reportFor("run:2"), observe("run:2"), verify("run:2")];
    out.X18a = rep(kernel, [...ev, reportFor("run:1")]);
    out.X18b = rep(kernel, [...ev, verify("run:1")]);
  }
  // X19 duplicate verification
  { const { events } = verifiedRun(); out.X19 = rep(kernel, [...events, verify("run:1")]); }
  // X23 merge commit as contract commit pulls in an unreviewed side branch
  {
    const { events, contentHash } = approvedTask();
    const EVIL = "e".repeat(40);
    const g = { [SHA.head]: [SHA.contract], [SHA.contract]: [SHA.base, EVIL], [SHA.base]: [SHA.dep], [EVIL]: [SHA.other] };
    out.X23 = rep(kernel, [...events, startRun("run:1", { contentHash, obs: observation(contentHash, { parents: g }) })]);
  }
  // X33 two contract versions with the same contractCommit
  {
    const t1 = contractText(metadata()); const t2 = contractText(metadata({ contractVersion: 2, scope: { create: ["src/a.ts", "src/evil.ts"], modify: [] } }));
    out.X33 = rep(kernel, [registerTask(), registerContract(t1), registerContract(t2)]);
  }
  // X35 NUL / bidi in contract prose
  out.X35 = kernel.parseContractDocument(contractText(metadata(), "# C\n\u0000‮evil\n")).ok;
  // X37 recordedAt garbage / backdated
  { const ev = { ...registerTask(), recordedAt: "1970-01-01 lol" }; out.X37 = rep(kernel, [ev]); }
  // X38 mutation name whitespace twins
  {
    const m = { scope: { create: ["src/a.ts"], modify: [] }, requiredChecks: [{ name: "test", command: "npm test" }], mutationSmoke: "required" } as any;
    const mu = (n: string, o: string) => ({ name: n, description: "d", outcome: o, classification: "must_detect", equivalenceRationale: null });
    out.X38 = evaluateVerification(m, { mutations: [] }, { changedFiles: [{ path: "src/a.ts", change: "added" }], checks: [{ name: "test", command: "npm test", exitCode: 0 }], mutations: [mu("m1", "detected"), mu("m1 ", "detected")] }).passed;
  }
  // X39 cyclic graph terminates
  {
    const { events, contentHash } = approvedTask();
    const g = { [SHA.head]: [SHA.contract], [SHA.contract]: [SHA.head] };
    out.X39 = rep(kernel, [...events, startRun("run:1", { contentHash, obs: observation(contentHash, { parents: g }) })]);
  }
  // X40 runId squatting across tasks
  {
    const a = approvedTask(); const b = approvedTask({ taskId: "TASK-0002" }, "TASK-0002");
    out.X40 = rep(kernel, [...a.events, ...b.events, startRun("run:task-0002-1"), startRun("run:task-0002-1", { taskId: "TASK-0002", contentHash: b.contentHash, obs: observation(b.contentHash, { contractAtCommit: { commit: SHA.contract, path: "forge/contracts/TASK-0002.md", contentHash: b.contentHash } }) })]);
  }
  // X41 request_changes with only non-blocking findings, then same commit new run approve (variant) -- skip known
  // X42 developer preempts failing verification
  {
    const { events } = approvedTask();
    const ev = [...events, startRun("run:1"), reportFor("run:1"), observe("run:1"), fail("run:1", "DEVELOPER_ABORTED")];
    out.X42 = { state: runState(stateOf(ev), "run:1"), thenRestart: rep(kernel, [...ev, startRun("run:2")]) };
  }
  // X43 contract base == root while dependency declared? and dependency check uses dev graph: fabricate dep edge
  {
    // Task A accepted at RESULT; Task B depends on A@RESULT, base = SHA.base which does NOT contain RESULT; developer fabricates edge base->RESULT
    const a = verifiedRun();
    const accA = [...a.events, review("run:1", "approve"), accept("run:1")];
    const tb = contractText(metadata({ taskId: "TASK-0002", dependencies: [{ taskId: "TASK-0001", acceptedCommit: RESULT }] }));
    const hb = hashOf(tb);
    const evB = [registerTask("TASK-0002"), registerContract(tb, { taskId: "TASK-0002" }), decide(hb, "approved", { taskId: "TASK-0002" })];
    const fake = { ...linearGraph(), [SHA.base]: [SHA.dep, RESULT] };
    const obs = observation(hb, { parents: fake, contractAtCommit: { commit: SHA.contract, path: "forge/contracts/TASK-0002.md", contentHash: hb } });
    out.X43_honest = rep(kernel, [...accA, ...evB, startRun("run:b1", { taskId: "TASK-0002", contentHash: hb, obs: observation(hb, { contractAtCommit: { commit: SHA.contract, path: "forge/contracts/TASK-0002.md", contentHash: hb } }) })]);
    out.X43_fabricated = rep(kernel, [...accA, ...evB, startRun("run:b1", { taskId: "TASK-0002", contentHash: hb, obs })]);
  }
  console.log("XRT " + JSON.stringify(out, null, 1));
});
