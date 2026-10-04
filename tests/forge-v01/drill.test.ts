import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FixtureRepo, removeTree, tempRoot, type TreeSpec } from "./helpers.ts";

// Local drill: the whole forge-gate / forge-verify path INSIDE the locally built tool image, entered
// through the image kernel's stage0.main itself (argv, event/facts reads, bootstrap, BASE manifest load,
// materialization, exec of the BASE main.py), with the worker on the real DockerRunner (sibling
// containers through the daemon socket). Run it with `npm run forge:drill` (tests/forge-v01/drill/drill.sh);
// skipped unless FORGE_DOCKER_HOST is set and the image tag (FORGE_E2E_IMAGE, default
// forge-v01-local:sandbox) exists on that daemon.
//
// GitHub is the only thing replaced: BASE/HEAD objects come from a local bare remote and every API read
// from seams.FixedTransport, handed to stage0.main(_seams=, _exec=) and main.main(_seams=) by
// e2e_harness.py (test-only keyword arguments; the image ENTRYPOINT passes neither).

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const DOCKER_HOST = process.env["FORGE_DOCKER_HOST"];
const IMAGE_TAG = process.env["FORGE_E2E_IMAGE"] ?? "forge-v01-local:sandbox";
const PY = "/opt/python/bin/python3.12";

const REPO_ID = 1401864629;
const REPO = "/repos/Forge-Dice/Forge";
const PR = 7;
const RUN = 4242;
const ATTEMPT = 2;
const OWNER = 315180734;
const DEV = 337272506;
const TASK = "FORGE-DRILL-0001";
const BRANCH = { DEV: `forge/run/codex/${TASK}/clamp-1`, OWNER_OPS: `forge/owner/${TASK}/ops-1` };
const WORKFLOW = ".github/workflows/forge-v01.yml";
const CLAMP = "src/forge-drill/clamp-at-zero.ts";
const ADDED_TEST = "tests/forge-drill/clamp-at-zero-ternary.test.ts";
const BASE_TEST = "tests/forge-v01/clamp-at-zero.test.ts";
const APPROVAL = `forge/approvals/${TASK}.md`; // a TCB path only an OWNER_OPS plan can approve

type Obj = Record<string, unknown>;
const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const canonical = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
const b64 = (text: string) => Buffer.from(text, "utf8").toString("base64");
const DEPLOYMENT_DIGEST = sha256("forge-v01 e2e deployment policy");
const CHECKED_AT = new Date(Date.now() - 60_000).toISOString().replace(/\.\d{3}Z$/, "Z");

function docker(args: string[], timeout = 60_000) {
  const env = { PATH: "/usr/bin:/bin:/usr/local/bin", HOME: "/tmp", DOCKER_HOST: DOCKER_HOST ?? "" };
  return spawnSync("docker", args, { env, encoding: "utf8", timeout, maxBuffer: 64 * 1024 * 1024 });
}

function imageRef(): string | null {
  if (!DOCKER_HOST) return null;
  const r = docker(["image", "inspect", "--format", "{{json .RepoDigests}}", IMAGE_TAG]);
  if (r.status !== 0) return null;
  const digests = JSON.parse(r.stdout) as string[];
  const name = IMAGE_TAG.split(":")[0]!;
  return digests.find((d) => d.startsWith(`${name}@sha256:`)) ?? null;
}

const IMAGE = imageRef();
const IMAGE_DIGEST = IMAGE ? IMAGE.slice(IMAGE.indexOf("@") + 1) : "";

// ------------------------------------------------------------------ fixture repository

const read = (path: string) => readFileSync(join(REPO_ROOT, path), "utf8");
const manifestPaths = (JSON.parse(read("forge/verifier/bootstrap-manifest.json")) as { files: { path: string }[] }).files.map((f) => f.path);

function nest(files: Record<string, string>): TreeSpec {
  const spec: TreeSpec = {};
  for (const [path, text] of Object.entries(files)) {
    const parts = path.split("/");
    let node = spec;
    for (const dir of parts.slice(0, -1)) node = (node[dir] ??= {}) as TreeSpec;
    node[parts.at(-1)!] = text;
  }
  return spec;
}

const TERNARY = "export function clampAtZero(n: number): number {\n  return n < 0 ? 0 : n;\n}\n";
const GOOD_TEST = `import { describe, expect, test } from "vitest";
import { clampAtZero } from "../../src/forge-drill/clamp-at-zero.ts";

describe("clampAtZero", () => {
  test("negative input clamps to zero", () => {
    expect(clampAtZero(-5)).toBe(0);
    expect(clampAtZero(-1)).toBe(0);
  });

  test("non-negative input is unchanged", () => {
    expect(clampAtZero(0)).toBe(0);
    expect(clampAtZero(7)).toBe(7);
  });
});
`;
// Manipulated: the named test no longer pins the value, so the `return n` mutant survives.
const WEAK_TEST = GOOD_TEST.replace("expect(clampAtZero(-5)).toBe(0);\n    expect(clampAtZero(-1)).toBe(0);", "expect(clampAtZero(-5)).toBeLessThanOrEqual(0);");
// HEAD content a Codex PR could contain, appended inside the describe block of GOOD_TEST.
const withTest = (extra: string) => GOOD_TEST.replace(/\n\}\);\n$/, `\n${extra}\n});\n`);
// Crash: the Vitest fork running this file SIGKILLs itself mid-run.
const CRASH_TEST = withTest(`  test("worker dies", () => {\n    process.kill(process.pid, "SIGKILL");\n  });`);
// Hang: a synchronous endless loop; Vitest's testTimeout cannot interrupt it, only the supervisor deadline.
const HANG_TEST = withTest(`  test("never returns", () => {\n    for (;;) {}\n  });`);

// Manipulated output: the trusted reporter's frame, forged for this fixture's exact identities.
const PROJECT = "forge-v01";
const id = (file: string, title: string) => [file, PROJECT, ["clampAtZero"], title, 0];
const NAMED = id(ADDED_TEST, "negative input clamps to zero");
function forgedFrame(files: string[], tests: { id: unknown[]; status: string }[]): string {
  const key = (v: unknown) => Buffer.from(JSON.stringify(v), "utf8");
  const failed = tests.filter((t) => t.status === "failed");
  const payload = {
    format: 1,
    inventory: {
      format: 1, files: files.map((file) => ({ file, project: PROJECT, collection: "ok" })),
      tests: [...tests].sort((a, b) => Buffer.compare(key(a.id), key(b.id))), errors: [], reason: failed.length ? "failed" : "passed",
    },
    failures: failed.map((t) => ({ id: t.id, errorNames: ["AssertionError"] })),
  };
  const body = JSON.stringify(payload);
  return `FORGE-REPORT-V1 ${Buffer.byteLength(body)}\n${body}`;
}
// HEAD run: everything passed. Mutant run (only ADDED_TEST): exactly the named test failed with an assertion.
const FORGED_HEAD = forgedFrame([ADDED_TEST, BASE_TEST], [
  ...["negative input clamps to zero", "non-negative input is unchanged"].map((t) => ({ id: id(ADDED_TEST, t), status: "passed" })),
  ...["negative input clamps to zero", "zero stays zero", "positive input is unchanged"].map((t) => ({ id: id(BASE_TEST, t), status: "passed" })),
]);
const FORGED_MUTANT = forgedFrame([ADDED_TEST], [
  { id: NAMED, status: "failed" }, { id: id(ADDED_TEST, "non-negative input is unchanged"), status: "passed" },
]);
// The test really fails (7 -> 8), so the honest verdict is a failure. Before any test runs, the file writes
// a success frame and a fake PASS record to stdout and tries to pre-create the report file of the former
// file channel (/out/report), choosing the HEAD or the mutant forgery from the source under test.
const FORGED_TEST = `import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { clampAtZero } from "../../src/forge-drill/clamp-at-zero.ts";

const source = readFileSync(new URL("../../src/forge-drill/clamp-at-zero.ts", import.meta.url), "utf8");
const forged = source.includes("? 0 : n") ? ${JSON.stringify(FORGED_HEAD)} : ${JSON.stringify(FORGED_MUTANT)};
process.stdout.write(forged + "\\n");
console.log(JSON.stringify({ format: 1, outcome: "PASS", policyAssurance: "owner_attested" }));
try {
  writeFileSync("/out/report", forged, { flag: "wx" });
} catch {
  // no report file exists any more (the report is the entry's fd 3): keep running the tests
}

describe("clampAtZero", () => {
  test("negative input clamps to zero", () => {
    expect(clampAtZero(-5)).toBe(0);
  });

  test("non-negative input is unchanged", () => {
    expect(clampAtZero(7)).toBe(8);
  });
});
`;

// Beautify an exit-0 run: the honest run has one skipped test (exit 0, reason "passed", TEST_STATUS). The file
// tries to turn it into "passed" through every report-channel vector a same-uid test can reach: a detached
// process that keeps overwriting the former report file and every listable /proc/<pid>/fd entry for 20 s (so it
// outlives the reporter's write), and, in the test body, every socket descriptor of the fork except its IPC.
const SKIP_TITLE = "pinned later";
const FORGED_SKIP = forgedFrame([ADDED_TEST, BASE_TEST], [
  ...["negative input clamps to zero", "non-negative input is unchanged", SKIP_TITLE].map((t) => ({ id: id(ADDED_TEST, t), status: "passed" })),
  ...["negative input clamps to zero", "zero stays zero", "positive input is unchanged"].map((t) => ({ id: id(BASE_TEST, t), status: "passed" })),
]);
const OVERWRITER = `const fs = require("node:fs");
const forged = ${JSON.stringify(FORGED_SKIP)};
const end = Date.now() + 20000;
const tick = () => {
  try { fs.writeFileSync("/out/report", forged); } catch {}
  for (const pid of fs.readdirSync("/proc").filter((p) => /^[0-9]+$/.test(p) && Number(p) !== process.pid)) {
    let fds = [];
    try { fds = fs.readdirSync("/proc/" + pid + "/fd"); } catch { continue; }
    for (const n of fds) { try { const fd = fs.openSync("/proc/" + pid + "/fd/" + n, "w"); fs.writeSync(fd, forged); fs.closeSync(fd); } catch {} }
  }
  if (Date.now() < end) setTimeout(tick, 25);
};
tick();`;
const BEAUTIFY_TEST = `import { spawn } from "node:child_process";
import { readdirSync, readlinkSync, writeSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { clampAtZero } from "../../src/forge-drill/clamp-at-zero.ts";

const forged = ${JSON.stringify(FORGED_SKIP)};
spawn(process.execPath, ["-e", ${JSON.stringify(OVERWRITER)}], { detached: true, stdio: "ignore" }).unref();

describe("clampAtZero", () => {
  test("negative input clamps to zero", () => {
    const ipc = (process as unknown as { channel?: { fd?: number } }).channel?.fd;
    for (const n of readdirSync("/proc/self/fd")) {
      let target = "";
      try { target = readlinkSync("/proc/self/fd/" + n); } catch {}
      if (Number(n) > 2 && Number(n) !== ipc && target.startsWith("socket:")) { try { writeSync(Number(n), forged); } catch {} }
    }
    expect(clampAtZero(-5)).toBe(0);
    expect(clampAtZero(-1)).toBe(0);
  });

  test("non-negative input is unchanged", () => {
    expect(clampAtZero(7)).toBe(7);
  });

  test.skip("${SKIP_TITLE}", () => {});
});
`;
// BASE whose suite is broken: the BASE test SIGKILLs the Vitest main process, so the BASE run has no report
// and a signal exit (worker.run_tests, PKG §11: TEST_BASELINE, not TEST_INVENTORY).
const BASE_KILLER = `import { test } from "vitest";

test("kills the Vitest main process", () => {
  process.kill(process.ppid, "SIGKILL");
});
`;
// Report-channel vectors, measured from a HEAD test inside a Vitest fork of the real worker: each observation is
// an errno (or ALLOWED); ptrace / pidfd_getfd / process_vm_readv go through Python ctypes in the image. The test
// fails on purpose with the observations as its error name, the one field the report carries back.
const VECTOR_PY = `import ctypes, errno, sys
libc = ctypes.CDLL(None, use_errno=True)
libc.syscall.restype = ctypes.c_long
def res(r):
    return "ALLOWED" if r >= 0 else errno.errorcode.get(ctypes.get_errno(), "E?")
class Iov(ctypes.Structure):
    _fields_ = [("base", ctypes.c_void_p), ("len", ctypes.c_size_t)]
L = ctypes.c_long  # every syscall argument as a full register: variadic calls do not widen ints
out = {}
for arg in sys.argv[1:]:
    label, pid = arg.split(":")
    pid = int(pid)
    r = libc.syscall(L(101), L(16), L(pid), L(0), L(0))  # ptrace(PTRACE_ATTACH)
    out[label + "Ptrace"] = res(r)
    if r >= 0:  # attached (tracee stopped): wait for the stop, then detach so the run can go on
        libc.waitpid(ctypes.c_int(pid), None, ctypes.c_int(0x40000000))
        libc.syscall(L(101), L(17), L(pid), L(0), L(0))
    pfd = libc.syscall(L(434), L(pid), L(0))  # pidfd_open
    out[label + "PidfdGetfd"] = res(libc.syscall(L(438), L(pfd), L(3), L(0))) if pfd >= 0 else "open-" + res(pfd)
    buf = ctypes.create_string_buffer(8)
    local, remote = Iov(ctypes.cast(buf, ctypes.c_void_p), 8), Iov(4096, 8)
    # process_vm_readv of an unmapped address: EPERM when access is denied, EFAULT when it would be allowed
    out[label + "VmRead"] = res(libc.syscall(L(310), L(pid), ctypes.byref(local), L(1), ctypes.byref(remote), L(1), L(0)))
print(" ".join(k + "=" + v for k, v in out.items()))
`;
const VECTORS_TEST = `import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { test } from "vitest";

const errno = (f: () => unknown): string => {
  try { f(); return "ALLOWED"; } catch (e) { return (e as { code?: string }).code ?? "ERR"; }
};

test("vectors", () => {
  const main = process.ppid;
  const o: Record<string, string> = {};
  o["reportEnv"] = Object.keys(process.env).filter((k) => k.startsWith("FORGE_REPORT")).map((k) => k + "=" + process.env[k]).join(",");
  o["outFile"] = errno(() => fs.writeFileSync("/out/report", "x", { flag: "wx" }));
  for (const [name, pid] of [["main", main], ["entry", 1]] as const) {
    o[name + "Mem"] = errno(() => fs.closeSync(fs.openSync("/proc/" + pid + "/mem", "r+")));
    o[name + "FdDir"] = errno(() => fs.readdirSync("/proc/" + pid + "/fd"));
    o[name + "Fd3"] = errno(() => fs.closeSync(fs.openSync("/proc/" + pid + "/fd/3", "w")));
    o[name + "Stdout"] = errno(() => fs.closeSync(fs.openSync("/proc/" + pid + "/fd/1", "w")));
    o[name + "Signal"] = errno(() => process.kill(pid, 0));
  }
  const others = fs.readdirSync("/proc").filter((p) => /^[0-9]+$/.test(p) && Number(p) !== process.pid);
  o["listableFdDirs"] = others.filter((p) => errno(() => fs.readdirSync("/proc/" + p + "/fd")) === "ALLOWED").join("+") || "none";
  const ipc = (process as unknown as { channel?: { fd?: number } }).channel?.fd;
  o["ipcFd"] = String(ipc);
  o["otherSockets"] = String(fs.readdirSync("/proc/self/fd").filter((n) => {
    let target = "";
    try { target = fs.readlinkSync("/proc/self/fd/" + n); } catch {}
    return Number(n) > 2 && Number(n) !== ipc && target.startsWith("socket:");
  }).length);
  o["syscalls"] = execFileSync("/opt/python/bin/python3.12", ["-I", "-c", ${JSON.stringify(VECTOR_PY)}, "main:" + main, "entry:1"], { encoding: "utf8" }).trim();
  const e = new Error("observed");
  e.name = "V " + JSON.stringify(o);
  throw e;
});
`;

type Profile = "DEV" | "OWNER_OPS";
type Fixture = {
  remote: string; seed: string; base: string; head: string; contractHash: string; policyHash: string; contract: string;
  profile: Profile; branch: string; author: number;
};

/**
 * BASE = registered clampAtZero task (contract, plan, policy, verifier files); HEAD = BASE + headFiles.
 * DEV (default): scope create ADDED_TEST, modify CLAMP, mutant `return n`. OWNER_OPS: the Owner's own PR on
 * forge/owner/; scope additionally creates APPROVAL (the plan's only approvedTcbPaths entry), no mutants.
 */
function fixture(root: string, name: string, headFiles: Record<string, string>, profile: Profile = "DEV",
  baseOverrides: Record<string, string> = {}): Fixture {
  const ops = profile === "OWNER_OPS";
  const repo = new FixtureRepo(join(root, name));
  const seed = repo.commit(repo.tree({ "README.md": "seed\n" }), [], "seed");
  const meta = {
    forgeContractFormat: 1,
    taskId: TASK,
    contractVersion: 1,
    baseCommit: seed,
    dependencies: [],
    scope: { create: ops ? [APPROVAL, ADDED_TEST] : [ADDED_TEST], modify: [CLAMP] },
    requiredChecks: [
      { name: "typecheck", command: "forge-v01:typecheck" },
      { name: "test", command: "forge-v01:test" },
      ...(ops ? [] : [{ name: "mutations", command: "forge-v01:mutations" }]),
    ],
    mutationSmoke: ops ? "none" : "required",
  };
  const contract = `---json\n${JSON.stringify(meta, null, 2)}\n---\n\n# ${TASK}\n\nRewrite clampAtZero as the equivalent ternary and pin the negative case.\n`;
  const contractHash = sha256("forge-contract-v1\n" + contract);
  const plan = canonical({
    format: 1, taskId: TASK, contractHash, profile, approvedTcbPaths: ops ? [APPROVAL] : [], addedTestFiles: [ADDED_TEST],
    checks: meta.requiredChecks,
    mutants: ops ? [] : [{
      id: "return-n", path: CLAMP, anchorBase64: b64("return n < 0 ? 0 : n;"), replacementBase64: b64("return n;"),
      testFiles: [ADDED_TEST], namedTests: [[ADDED_TEST, "forge-v01", ["clampAtZero"], "negative input clamps to zero", 0]],
    }],
  });
  const policy = canonical({
    format: 1, repoId: REPO_ID, ownerId: OWNER,
    developers: [{ id: DEV, provider: "codex", namespacePrefix: "forge/run/codex/" }],
    imageDigest: IMAGE_DIGEST, bootstrapVersion: 1, deploymentPolicyDigest: DEPLOYMENT_DIGEST, limitsProfile: "v01",
    taskIndex: [{ taskId: TASK, contractPath: `forge/contracts/${TASK}.md`, contractHash,
      planPath: `forge/verifier/plans/${TASK}.json`, planHash: sha256("forge-plan-v1\n" + plan) }],
  });
  const baseFiles: Record<string, string> = {
    ...Object.fromEntries(manifestPaths.map((p) => [p, read(p)])),
    "forge/verifier/bootstrap-manifest.json": read("forge/verifier/bootstrap-manifest.json"),
    "forge/verifier/policy.json": policy,
    [`forge/verifier/plans/${TASK}.json`]: plan,
    [`forge/contracts/${TASK}.md`]: contract,
    "package.json": read("package.json"),
    "package-lock.json": read("package-lock.json"),
    "tsconfig.json": read("tsconfig.json"),
    [CLAMP]: read(CLAMP),
    [BASE_TEST]: read(BASE_TEST),
    ...baseOverrides,
  };
  const base = repo.commit(repo.tree(nest(baseFiles)), [seed], "base");
  const head = repo.commit(repo.tree(nest({ ...baseFiles, ...headFiles })), [base], "head");
  repo.setRef("refs/heads/main", base);
  repo.setRef(`refs/pull/${PR}/head`, head);
  return { remote: repo.odb, seed, base, head, contractHash, policyHash: sha256("forge-policy-v1\n" + policy), contract,
    profile, branch: BRANCH[profile], author: ops ? OWNER : DEV };
}

// ------------------------------------------------------------------ fake GitHub (FixedTransport answers)

type Attest = { result?: "approve" | "request_changes"; head?: string; checkedAt?: string; provider?: "anthropic" | "openai" };

const bindingOf = (f: Fixture, head = f.head) =>
  ({ repoId: REPO_ID, pr: PR, base: f.base, head, contractHash: f.contractHash, verifierSha: f.base, policyHash: f.policyHash });

/** The Owner's FORGE-ATTESTATION-V1 approve body; `opts` bends one field for the negative cases. */
function attestation(f: Fixture, opts: Attest = {}): string {
  const result = opts.result ?? "approve";
  const binding = bindingOf(f, opts.head);
  const reviewer = { provider: opts.provider ?? "anthropic", model: "claude-drill" };
  const findings = result === "approve" ? [] : [{ id: "weak-test", severity: "major", summary: "negative case is not pinned" }];
  const report = Buffer.from(JSON.stringify({ format: 1, binding, reviewer, result, findings }), "utf8");
  return "FORGE-ATTESTATION-V1\n" + canonical({
    format: 1, ...binding, runId: RUN, runAttempt: ATTEMPT, action: "approve", externalReviewer: reviewer,
    externalReviewHash: sha256(Buffer.concat([Buffer.from("forge-external-review-v1\n"), report])),
    externalReviewResult: result, externalReviewBase64: report.toString("base64"), supersedes: [],
    deployment: { policyDigest: DEPLOYMENT_DIGEST, checkedAt: opts.checkedAt ?? CHECKED_AT },
  });
}

/** The revoke variant (reviews.py REVOKE_KEYS): same binding, no report, empty supersedes. */
const revocation = (f: Fixture) =>
  "FORGE-ATTESTATION-V1\n" + canonical({ format: 1, ...bindingOf(f), runId: RUN, runAttempt: ATTEMPT, action: "revoke", supersedes: [] });

type By = { id?: number; user?: number; at?: string };

/** One published COMMENTED review on H; by default the Owner's review 901. */
const review = (f: Fixture, body: string, by: By = {}) => ({
  id: by.id ?? 901, node_id: "x", user: { id: by.user ?? OWNER, login: by.user === DEV ? "forge-codex" : "owner" }, body,
  state: "COMMENTED", html_url: "x", commit_id: f.head, submitted_at: by.at ?? "2026-10-04T10:00:00Z",
  author_association: by.user === DEV ? "CONTRIBUTOR" : "OWNER",
});
const ownerReview = (f: Fixture, body: string) => review(f, body);

const REVIEWS = `${REPO}/pulls/${PR}/reviews?per_page=100&page=1`;

/**
 * Every API read of gate and verify; `reviews` is the PR review list GitHub returns. With `later`, the
 * first review read of a process sees `reviews` and every further one `later` (an edit during the run).
 */
function answers(f: Fixture, reviews: Obj[], later?: Obj[]): Obj {
  const job = (id: number, name: string, status: string, conclusion: string | null) =>
    ({ id, run_id: RUN, run_attempt: ATTEMPT, name, status, conclusion, head_sha: f.base, workflow_name: "Forge V0.1" });
  const jobs = [job(9001, "forge-gate", "completed", "success"), job(9002, "forge-verify", "in_progress", null)];
  const author = { id: f.author, login: f.author === OWNER ? "owner" : "codex" };
  return {
    [REPO]: { id: REPO_ID, full_name: "Forge-Dice/Forge", private: false },
    [`${REPO}/pulls/${PR}`]: {
      number: PR, state: "open", draft: false, user: author,
      base: { ref: "main", sha: f.base, repo: { id: REPO_ID, full_name: "Forge-Dice/Forge" } },
      head: { ref: f.branch, sha: f.head, repo: { id: REPO_ID } },
    },
    [`${REPO}/branches/main`]: { name: "main", commit: { sha: f.base }, protected: true },
    [`${REPO}/actions/runs/${RUN}/attempts/${ATTEMPT}`]: {
      id: RUN, name: "Forge V0.1", run_attempt: ATTEMPT, event: "pull_request_target", path: WORKFLOW, workflow_id: 77,
      head_sha: f.base, repository: { id: REPO_ID }, actor: author, triggering_actor: { id: OWNER, login: "owner" },
    },
    // FixedTransport treats a list as successive bodies (the last one repeats): each body is a review list.
    [REVIEWS]: later ? [reviews, later] : [reviews],
    [`${REPO}/actions/runs/${RUN}/attempts/${ATTEMPT}/jobs?per_page=100&page=1`]: { total_count: jobs.length, jobs },
  };
}
// ------------------------------------------------------------------ one stage0 run inside the image

let root = "";
let runs = 0;

type Run = { status: number | null; record: Obj | null; stdout: string; stderr: string; seconds: number; requests: string[] };
/** facts: extra runner facts; mounts: extra docker run flags; suiteDeadline: lowered BASE/HEAD suite deadline (s). */
type RunOpts = { facts?: Obj; mounts?: string[]; suiteDeadline?: number };

function inImage(mode: "stage0" | "adapter", f: Fixture, api: Obj, job: string, opts: RunOpts = {}): Run {
  const dir = join(root, `run-${++runs}`);
  const ws = join(dir, "ws");
  mkdirSync(ws, { recursive: true, mode: 0o700 });
  const event = {
    action: "synchronize", number: PR, repository: { id: REPO_ID, full_name: "Forge-Dice/Forge" },
    pull_request: { number: PR, base: { sha: f.base, ref: "main", repo: { id: REPO_ID } }, head: { sha: f.head, ref: f.branch, repo: { id: REPO_ID } } },
  };
  const facts = { eventName: "pull_request_target", githubSha: f.base, runId: RUN, runAttempt: ATTEMPT, actorId: OWNER, job, image: IMAGE, ...opts.facts };
  writeFileSync(join(dir, "event.json"), JSON.stringify(event));
  writeFileSync(join(dir, "facts.json"), JSON.stringify(facts));
  writeFileSync(join(dir, "answers.json"), JSON.stringify(api));
  writeFileSync(join(dir, "contract.md"), f.contract);
  if (opts.suiteDeadline !== undefined) writeFileSync(join(dir, "budgets.json"), JSON.stringify({ suiteDeadline: opts.suiteDeadline }));
  const sock = DOCKER_HOST!.replace(/^unix:\/\//, "");
  const argv = [
    "run", "--rm", "--network=none", `--volume=${sock}:/var/run/docker.sock`, `--volume=${HERE}:${HERE}:ro`, `--volume=${root}:${root}`,
    ...(opts.mounts ?? []), "--entrypoint", PY, IMAGE!, "-I", "-B", join(HERE, "e2e_harness.py"), mode, join(dir, "answers.json"), f.remote,
    ...(mode === "adapter" ? [join(dir, "contract.md")] : []), "--event", join(dir, "event.json"), "--facts", join(dir, "facts.json"), "--workspace", ws,
  ];
  const started = Date.now();
  const r = docker(argv, 15 * 60_000);
  const lines = (r.stdout ?? "").trim().split("\n").filter((l) => l.length > 0);
  let record: Obj | null = null;
  try {
    record = lines.length === 1 ? (JSON.parse(lines[0]!) as Obj) : null;
  } catch {
    record = null;
  }
  let requests: string[] = [];
  try {
    requests = JSON.parse(readFileSync(join(dir, "requests.json"), "utf8")) as string[];
  } catch {
    requests = []; // the verifier was never reached
  }
  return { status: r.status, record, stdout: r.stdout ?? "", stderr: r.stderr ?? "", seconds: (Date.now() - started) / 1000, requests };
}

/** e2e_harness.py vectors: the working-tree verifier's worker.run_tests on one HEAD test file, real DockerRunner. */
function vectorsInImage(testText: string): Run {
  const dir = join(root, `run-${++runs}`);
  mkdirSync(join(dir, "case", "tests"), { recursive: true, mode: 0o700 });
  cpSync(join(REPO_ROOT, "tools", "forge_v01"), join(dir, "tools", "forge_v01"), { recursive: true });
  for (const f of ["package.json", "package-lock.json", "tsconfig.json"]) writeFileSync(join(dir, f === "tsconfig.json" ? "case/tsconfig.json" : f), read(f));
  writeFileSync(join(dir, "case", "package.json"), read("package.json"));
  writeFileSync(join(dir, "case", "tests", "vectors.test.ts"), testText);
  const sock = DOCKER_HOST!.replace(/^unix:\/\//, "");
  const argv = ["run", "--rm", "--network=none", `--volume=${sock}:/var/run/docker.sock`, `--volume=${HERE}:${HERE}:ro`, `--volume=${root}:${root}`,
    "--entrypoint", PY, IMAGE!, "-I", "-B", join(HERE, "e2e_harness.py"), "vectors", dir, IMAGE!];
  const started = Date.now();
  const r = docker(argv, 10 * 60_000);
  let record: Obj | null = null;
  try {
    record = JSON.parse((r.stdout ?? "").trim()) as Obj;
  } catch {
    record = null;
  }
  return { status: r.status, record, stdout: r.stdout ?? "", stderr: r.stderr ?? "", seconds: (Date.now() - started) / 1000, requests: [] };
}

// ------------------------------------------------------------------ drill table

type Row = { case: string; step: string; expected: string; actual: string; seconds: string };
const table: Row[] = [];

/** "GATE_PASS reviewPending=false", "FAIL REVIEW_MISSING (review)", or the raw failure tail. */
function shown(r: Run): string {
  if (!r.record) return `no record (exit ${r.status}): ${(r.stderr || r.stdout).trim().split("\n").slice(-3).join(" | ").slice(0, 300)}`;
  const { outcome, code, phase, reviewPending } = r.record as Record<string, string | boolean | undefined>;
  if (outcome === "GATE_PASS") return `GATE_PASS reviewPending=${String(reviewPending)}`;
  return code ? `${String(outcome)} ${String(code)} (${String(phase)})` : String(outcome);
}

function render(rows: Row[]): string {
  const head: Row = { case: "case", step: "step", expected: "expected", actual: "actual", seconds: "s" };
  const keys = Object.keys(head) as (keyof Row)[];
  const width = Object.fromEntries(keys.map((k) => [k, Math.max(...[head, ...rows].map((r) => r[k].length))])) as Record<keyof Row, number>;
  const line = (r: Row) => "| " + keys.map((k) => r[k].padEnd(width[k])).join(" | ") + " |";
  const rule = "|-" + keys.map((k) => "-".repeat(width[k])).join("-|-") + "-|";
  return [line(head), rule, ...rows.map(line)].join("\n");
}

/** Runs one step, records expected vs actual (before asserting, so a failure still shows its row). */
function step(name: string, label: string, expected: string, run: () => Run, rows: Row[]): Run {
  const r = run();
  const row = { case: name, step: label, expected, actual: shown(r), seconds: r.seconds.toFixed(0) };
  rows.push(row);
  table.push(row);
  return r;
}

function drill(name: string, body: (rows: Row[]) => void, timeout: number) {
  test(name, () => {
    const rows: Row[] = [];
    try {
      body(rows);
    } finally {
      console.log(`\n${name}\n${render(rows)}\n`);
    }
  }, timeout);
}

const enabled = Boolean(DOCKER_HOST) && IMAGE !== null;

describe.skipIf(!enabled)("forge drill: stage0.main in the real image, real DockerRunner, fake GitHub", () => {
  let good: Fixture, weak: Fixture, outOfScope: Fixture, crash: Fixture, hang: Fixture, forged: Fixture, ops: Fixture, opsSrc: Fixture;
  let beautify: Fixture, brokenBase: Fixture;
  const gate = (f: Fixture, api: Obj) => () => inImage("stage0", f, api, "forge-gate");
  const verify = (f: Fixture, api: Obj, g: Run, opts: RunOpts = {}) => () =>
    inImage("stage0", f, api, "forge-verify", { ...opts, facts: { receipt: g.record?.["receipt"] ?? null } });
  const approved = (f: Fixture, opts: Attest = {}) => answers(f, [ownerReview(f, attestation(f, opts))]);
  const reviewReads = (r: Run) => r.requests.filter((p) => p === REVIEWS).length;
  /** Gate must pass with the review present; returns the gate run for its receipt. */
  const gatePasses = (name: string, f: Fixture, api: Obj, rows: Row[]) => {
    const g = step(name, "gate", "GATE_PASS reviewPending=false", gate(f, api), rows);
    expect(shown(g)).toBe("GATE_PASS reviewPending=false");
    return g;
  };

  beforeAll(() => {
    root = tempRoot("forge-drill");
    good = fixture(root, "good", { [CLAMP]: TERNARY, [ADDED_TEST]: GOOD_TEST });
    weak = fixture(root, "weak", { [CLAMP]: TERNARY, [ADDED_TEST]: WEAK_TEST });
    outOfScope = fixture(root, "scope", { [CLAMP]: TERNARY, [ADDED_TEST]: GOOD_TEST, "src/forge-drill/extra.ts": "export const extra = 1;\n" });
    crash = fixture(root, "crash", { [CLAMP]: TERNARY, [ADDED_TEST]: CRASH_TEST });
    hang = fixture(root, "hang", { [CLAMP]: TERNARY, [ADDED_TEST]: HANG_TEST });
    forged = fixture(root, "forged", { [CLAMP]: TERNARY, [ADDED_TEST]: FORGED_TEST });
    beautify = fixture(root, "beautify", { [CLAMP]: TERNARY, [ADDED_TEST]: BEAUTIFY_TEST });
    brokenBase = fixture(root, "broken-base", { [CLAMP]: TERNARY, [ADDED_TEST]: GOOD_TEST }, "DEV", { [BASE_TEST]: BASE_KILLER });
    const record = `# ${TASK} Owner record\n\nDrill approval note (OWNER_OPS).\n`;
    ops = fixture(root, "ops", { [APPROVAL]: record, [ADDED_TEST]: GOOD_TEST }, "OWNER_OPS");
    opsSrc = fixture(root, "ops-src", { [APPROVAL]: record, [ADDED_TEST]: GOOD_TEST, [CLAMP]: TERNARY }, "OWNER_OPS");
  });
  afterAll(() => {
    if (table.length) console.log(`\nFORGE DRILL SUMMARY (image ${IMAGE})\n${render(table)}\n`);
    if (root) removeTree(root);
  });

  drill("0 image parser: Zod only from /trusted/node_modules", (rows) => {
    const ok = step("0 image parser", "parse contract", "ok taskId", () => inImage("adapter", good, approved(good), "forge-gate"), rows);
    const parsed = ok.record as { ok?: Obj; fail?: Obj; root: string; rootEntries: string[]; node: string; slashNodeModules: string | null } | null;
    rows.at(-1)!.actual = parsed?.ok ? `ok ${String(parsed.ok["taskId"])}` : shown(ok);
    expect(parsed, ok.stderr).not.toBeNull();
    expect(parsed!.fail).toBeUndefined();
    expect(parsed!.ok!["taskId"]).toBe(TASK);
    expect(parsed!.ok!["contentHash"]).toBe(good.contractHash);
    expect(parsed!.node).toBe("/opt/node/bin/node");
    expect(parsed!.root).toMatch(/\/ws\/trusted-source\/[0-9a-f]+$/);
    expect(parsed!.rootEntries).toEqual(["src", "tools"]); // manifest files only, no node_modules
    expect(parsed!.slashNodeModules).toBe("/trusted/node_modules");
    // The same run with the image Zod hidden: the parser cannot resolve "zod" from anywhere else.
    const hidden = step("0 image parser", "parse, Zod hidden", "fail EXECUTION_INTERNAL",
      () => inImage("adapter", good, approved(good), "forge-gate", { mounts: ["--tmpfs=/trusted/node_modules:ro"] }), rows);
    const code = (hidden.record as { fail?: { code: string } } | null)?.fail?.code;
    rows.at(-1)!.actual = code ? `fail ${code}` : shown(hidden);
    expect(code).toBe("EXECUTION_INTERNAL");
  }, 120_000);

  drill("1 good Codex PR + valid Owner attestation", (rows) => {
    const api = approved(good);
    const g = step("1 good PR", "gate", "GATE_PASS reviewPending=false", gate(good, api), rows);
    expect(shown(g)).toBe("GATE_PASS reviewPending=false");
    const v = step("1 good PR", "verify", "PASS", verify(good, api, g), rows);
    expect(shown(v)).toBe("PASS");
    expect(v.record).toMatchObject({ taskId: TASK, profile: "DEV", B: good.base, H: good.head, attestationId: 901, executionIsolation: "not_established" });
    expect(v.status).toBe(0);
  }, 900_000);

  drill("2 good PR, no Owner review yet", (rows) => {
    const api = answers(good, []);
    const g = step("2 no review", "gate", "GATE_PASS reviewPending=true", gate(good, api), rows);
    expect(shown(g)).toBe("GATE_PASS reviewPending=true");
    const v = step("2 no review", "verify", "FAIL REVIEW_MISSING (review)", verify(good, api, g), rows);
    expect(shown(v)).toBe("FAIL REVIEW_MISSING (review)");
    expect(v.status).toBe(1);
  }, 900_000);

  drill("3 Owner attestation with result request_changes", (rows) => {
    const api = answers(good, [ownerReview(good, attestation(good, { result: "request_changes" }))]);
    const g = step("3 review blocks", "gate", "FAIL REVIEW_BLOCKED (review)", gate(good, api), rows);
    expect(shown(g)).toBe("FAIL REVIEW_BLOCKED (review)");
  }, 300_000);

  drill("4 Owner attestation bound to a different head", (rows) => {
    const api = answers(good, [ownerReview(good, attestation(good, { head: good.seed }))]);
    const g = step("4 wrong binding", "gate", "FAIL REVIEW_BINDING (review)", gate(good, api), rows);
    expect(shown(g)).toBe("FAIL REVIEW_BINDING (review)");
  }, 300_000);

  drill("5 manipulated PR: weakened named test", (rows) => {
    const api = approved(weak);
    const g = step("5 weak test", "gate", "GATE_PASS reviewPending=false", gate(weak, api), rows);
    expect(shown(g)).toBe("GATE_PASS reviewPending=false");
    const v = step("5 weak test", "verify", "FAIL MUTANT_SURVIVED (mutations)", verify(weak, api, g), rows);
    expect(shown(v)).toBe("FAIL MUTANT_SURVIVED (mutations)");
    expect(v.record).toMatchObject({ ordinal: 0 });
    expect(v.status).toBe(1);
  }, 900_000);

  drill("6 scope violation: extra source file", (rows) => {
    const g = step("6 extra file", "gate", "FAIL SCOPE_PATH (scope)", gate(outOfScope, approved(outOfScope)), rows);
    expect(shown(g)).toBe("FAIL SCOPE_PATH (scope)");
  }, 300_000);

  drill("7 Owner review edited between gate and verify", (rows) => {
    const g = step("7 review edited", "gate", "GATE_PASS reviewPending=false", gate(good, approved(good)), rows);
    expect(shown(g)).toBe("GATE_PASS reviewPending=false");
    // Same review id, same approve, only checkedAt re-stamped: a different body, a different snapshot digest.
    const edited = answers(good, [ownerReview(good, attestation(good, { checkedAt: new Date(Date.now() - 30_000).toISOString().replace(/\.\d{3}Z$/, "Z") }))]);
    const v = step("7 review edited", "verify", "FAIL REVIEW_CHANGED (final)", verify(good, edited, g), rows);
    expect(shown(v)).toBe("FAIL REVIEW_CHANGED (final)");
    expect(reviewReads(v)).toBe(1); // decided at the Stage-2 start, before any worker
  }, 300_000);
  drill("8 Owner approve, then a valid revoke", (rows) => {
    // reviews.py select_attestation: the latest published Owner review decides; a revoke is never an approve.
    const api = answers(good, [ownerReview(good, attestation(good)), review(good, revocation(good), { id: 902, at: "2026-10-04T10:05:00Z" })]);
    const g = step("8 revoked", "gate", "FAIL REVIEW_BLOCKED (review)", gate(good, api), rows);
    expect(shown(g)).toBe("FAIL REVIEW_BLOCKED (review)");
  }, 300_000);

  drill("9a HEAD test kills its own Vitest worker", (rows) => {
    const api = approved(crash);
    const g = gatePasses("9a crash", crash, api, rows);
    // Vitest still exits 1 with a frame, but the killed file's tests are "pending", a status the strict report
    // parser rejects (worker.read_report): TEST_INVENTORY before any inventory comparison.
    const v = step("9a crash", "verify", "FAIL TEST_INVENTORY (worker)", verify(crash, api, g), rows);
    expect(shown(v)).toBe("FAIL TEST_INVENTORY (worker)");
  }, 900_000);

  drill("9b HEAD test never finishes", (rows) => {
    const api = approved(hang);
    const g = gatePasses("9b hang", hang, api, rows);
    // Lowered suite deadline (test-only, lower-only main.main(_suite_deadline=)); production stays 120 s.
    const v = step("9b hang", "verify (suite 10 s)", "FAIL EXECUTION_TIMEOUT (worker)", verify(hang, api, g, { suiteDeadline: 10 }), rows);
    expect(shown(v)).toBe("FAIL EXECUTION_TIMEOUT (worker)");
  }, 900_000);

  drill("9c HEAD test forges the report channel and stdout", (rows) => {
    const api = approved(forged);
    const g = gatePasses("9c forged report", forged, api, rows);
    // stdout never reaches the supervisor (worker-entry.mjs discards it) and no report file exists any more (the
    // report is the entry's fd 3): the forgery has no effect at all and the honest verdict stands, the failed
    // test. (With the former /out/report file this case was a full PASS, then TEST_INVENTORY.)
    const v = step("9c forged report", "verify", "FAIL TEST_STATUS (inventory)", verify(forged, api, g), rows);
    expect(v.record?.["outcome"]).not.toBe("PASS");
    expect(shown(v)).toBe("FAIL TEST_STATUS (inventory)");
    expect(v.stdout.trim().split("\n")).toHaveLength(1); // the verifier's one record; nothing from the test
  }, 900_000);

  drill("9e HEAD test beautifies an exit-0 run (skipped → passed) after the reporter", (rows) => {
    const api = approved(beautify);
    const g = gatePasses("9e beautify", beautify, api, rows);
    // Exit 0, reason "passed", one skipped test. Neither the overwriter (former report file, every listable
    // /proc/<pid>/fd) nor the socket spray reaches the entry's fd-3 channel: the honest skipped status decides.
    const v = step("9e beautify", "verify", "FAIL TEST_STATUS (inventory)", verify(beautify, api, g), rows);
    expect(v.record?.["outcome"]).not.toBe("PASS");
    expect(shown(v)).toBe("FAIL TEST_STATUS (inventory)");
  }, 900_000);

  drill("9f report-channel vectors measured from a HEAD test in the real worker", (rows) => {
    const r = step("9f vectors", "run_tests (head)", "exit 1, observations", () => vectorsInImage(VECTORS_TEST), rows);
    const names = (r.record?.["errorNames"] as string[] | undefined) ?? [];
    const observed = names.length === 1 && names[0]!.startsWith("V ") ? (JSON.parse(names[0]!.slice(2)) as Record<string, string>) : null;
    rows.at(-1)!.actual = observed ? `exit ${String(r.record?.["exitCode"])}, observations` : `no observations: ${(r.stderr || r.stdout).trim().slice(-300)}`;
    console.log(`\n9f observations\n${JSON.stringify(observed, null, 2)}\n`);
    expect(observed, r.stderr).not.toBeNull();
    const syscalls = Object.fromEntries(observed!["syscalls"]!.split(" ").map((kv) => kv.split("=") as [string, string]));
    expect({ ...observed, syscalls }).toEqual({
      reportEnv: "FORGE_REPORT_FD=3", outFile: "ENOENT",
      mainMem: "EACCES", mainFdDir: "EACCES", mainFd3: "EACCES", mainStdout: "EACCES", mainSignal: "ALLOWED",
      entryMem: "EACCES", entryFdDir: "EACCES", entryFd3: "EACCES", entryStdout: "EACCES", entrySignal: "ALLOWED",
      listableFdDirs: "none", ipcFd: "3", otherSockets: "0",
      syscalls: {
        mainPtrace: "EPERM", mainPidfdGetfd: "EPERM", mainVmRead: "EPERM",
        entryPtrace: "EPERM", entryPidfdGetfd: "EPERM", entryVmRead: "EPERM",
      },
    });
  }, 900_000);

  drill("9g BASE suite broken: a BASE test kills the Vitest main process", (rows) => {
    const api = approved(brokenBase);
    const g = gatePasses("9g broken BASE", brokenBase, api, rows);
    // No report and a signal exit in the BASE run: PKG §11 (before a green BASE every test cause is
    // TEST_BASELINE); this was TEST_INVENTORY before.
    const v = step("9g broken BASE", "verify", "FAIL TEST_BASELINE (worker)", verify(brokenBase, api, g), rows);
    expect(shown(v)).toBe("FAIL TEST_BASELINE (worker)");
  }, 900_000);

  drill("9d Owner review edited while the worker runs", (rows) => {
    // Gate and Stage-2 start see the original review; both final rounds see the edited body.
    const original = [ownerReview(good, attestation(good))];
    const edited = [ownerReview(good, attestation(good, { checkedAt: new Date(Date.now() - 30_000).toISOString().replace(/\.\d{3}Z$/, "Z") }))];
    const api = answers(good, original, edited);
    const g = gatePasses("9d edit during run", good, api, rows);
    const v = step("9d edit during run", "verify", "FAIL REVIEW_CHANGED (final)", verify(good, api, g), rows);
    expect(shown(v)).toBe("FAIL REVIEW_CHANGED (final)");
    expect(reviewReads(v)).toBe(3); // start read + both final rounds: decided by the final recheck
  }, 900_000);

  drill("10a OWNER_OPS: approved TCB path, openai external reviewer", (rows) => {
    // DEV-only provider rule (reviews.py): an openai reviewer is fine when the Owner's own PR is reviewed.
    const api = approved(ops, { provider: "openai" });
    const g = gatePasses("10a OWNER_OPS", ops, api, rows);
    const v = step("10a OWNER_OPS", "verify", "PASS", verify(ops, api, g), rows);
    expect(shown(v)).toBe("PASS");
    expect(v.record).toMatchObject({ taskId: TASK, profile: "OWNER_OPS", H: ops.head });
  }, 900_000);

  drill("10b OWNER_OPS: non-TCB source change in contract scope", (rows) => {
    // scope.py _in_class: an OWNER_OPS change outside tests/ must be an approvedTcbPaths entry; CLAMP is in
    // the contract's modify scope (allowed for DEV) but not a TCB path.
    const g = step("10b OWNER_OPS src", "gate", "FAIL SCOPE_PATH (scope)", gate(opsSrc, approved(opsSrc)), rows);
    expect(shown(g)).toBe("FAIL SCOPE_PATH (scope)");
  }, 300_000);

  drill("11 attestation posted by forge-codex instead of the Owner", (rows) => {
    // reviews.py _owner_reviews: only the numeric policy ownerId is authority; other users are skipped.
    const api = answers(good, [review(good, attestation(good), { user: DEV })]);
    const g = step("11 wrong reviewer", "gate", "GATE_PASS reviewPending=true", gate(good, api), rows);
    expect(shown(g)).toBe("GATE_PASS reviewPending=true");
    const v = step("11 wrong reviewer", "verify", "FAIL REVIEW_MISSING (review)", verify(good, api, g), rows);
    expect(shown(v)).toBe("FAIL REVIEW_MISSING (review)");
  }, 900_000);
});
