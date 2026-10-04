import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FixtureRepo, removeTree, tempRoot, type TreeSpec } from "./helpers.ts";

// End-to-end run of forge-gate and forge-verify INSIDE the locally built tool image
// (tools/forge_v01/Dockerfile), with the worker on the real DockerRunner (sibling containers
// started through the daemon socket). Skipped unless FORGE_DOCKER_HOST is set and the image tag
// (FORGE_E2E_IMAGE, default forge-v01-local:sandbox) exists on that daemon.
//
// GitHub is replaced by the test seams only: the BASE/HEAD objects come from a local bare remote and
// every API read from seams.FixedTransport. Because stage0.main hard-wires the production seams, the
// image ENTRYPOINT itself is not used: e2e_harness.py repeats stage0.main inside the image (image
// kernel load_base_verifier → execve of the BASE main.py process) with the seams as the only change.

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
const BRANCH = `forge/run/codex/${TASK}/clamp-1`;
const WORKFLOW = ".github/workflows/forge-v01.yml";
const CLAMP = "src/forge-drill/clamp-at-zero.ts";
const ADDED_TEST = "tests/forge-drill/clamp-at-zero-ternary.test.ts";
const BASE_TEST = "tests/forge-v01/clamp-at-zero.test.ts";

type Obj = Record<string, unknown>;
const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const canonical = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
const b64 = (text: string) => Buffer.from(text, "utf8").toString("base64");
const DEPLOYMENT_DIGEST = sha256("forge-v01 e2e deployment policy");

function docker(args: string[], timeout = 60_000) {
  const env = { PATH: "/usr/bin:/bin", HOME: "/tmp", DOCKER_HOST: DOCKER_HOST ?? "" };
  return spawnSync("/usr/bin/docker", args, { env, encoding: "utf8", timeout, maxBuffer: 64 * 1024 * 1024 });
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

type Fixture = { remote: string; seed: string; base: string; head: string; contractHash: string; policyHash: string; contract: string };

function fixture(root: string, name: string, headFiles: Record<string, string>): Fixture {
  const repo = new FixtureRepo(join(root, name));
  const seed = repo.commit(repo.tree({ "README.md": "seed\n" }), [], "seed");
  const meta = {
    forgeContractFormat: 1,
    taskId: TASK,
    contractVersion: 1,
    baseCommit: seed,
    dependencies: [],
    scope: { create: [ADDED_TEST], modify: [CLAMP] },
    requiredChecks: [
      { name: "typecheck", command: "forge-v01:typecheck" },
      { name: "test", command: "forge-v01:test" },
      { name: "mutations", command: "forge-v01:mutations" },
    ],
    mutationSmoke: "required",
  };
  const contract = `---json\n${JSON.stringify(meta, null, 2)}\n---\n\n# ${TASK}\n\nRewrite clampAtZero as the equivalent ternary and pin the negative case.\n`;
  const contractHash = sha256("forge-contract-v1\n" + contract);
  const plan = canonical({
    format: 1, taskId: TASK, contractHash, profile: "DEV", approvedTcbPaths: [], addedTestFiles: [ADDED_TEST],
    checks: meta.requiredChecks,
    mutants: [{
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
  };
  const base = repo.commit(repo.tree(nest(baseFiles)), [seed], "base");
  const head = repo.commit(repo.tree(nest({ ...baseFiles, ...headFiles })), [base], "head");
  repo.setRef("refs/heads/main", base);
  repo.setRef(`refs/pull/${PR}/head`, head);
  return { remote: repo.odb, seed, base, head, contractHash, policyHash: sha256("forge-policy-v1\n" + policy), contract };
}

// ------------------------------------------------------------------ GitHub answers (FixedTransport)

function attestation(f: Fixture): string {
  const binding = { repoId: REPO_ID, pr: PR, base: f.base, head: f.head, contractHash: f.contractHash, verifierSha: f.base, policyHash: f.policyHash };
  const reviewer = { provider: "anthropic", model: "claude-e2e" };
  const report = Buffer.from(JSON.stringify({ format: 1, binding, reviewer, result: "approve", findings: [] }), "utf8");
  const checkedAt = new Date(Date.now() - 60_000).toISOString().replace(/\.\d{3}Z$/, "Z");
  return "FORGE-ATTESTATION-V1\n" + canonical({
    format: 1, ...binding, runId: RUN, runAttempt: ATTEMPT, action: "approve", externalReviewer: reviewer,
    externalReviewHash: sha256(Buffer.concat([Buffer.from("forge-external-review-v1\n"), report])),
    externalReviewResult: "approve", externalReviewBase64: report.toString("base64"), supersedes: [],
    deployment: { policyDigest: DEPLOYMENT_DIGEST, checkedAt },
  });
}

// One fixed answer map per fixture: gate and verify of an attempt must see the same review bytes
// (a fresh checkedAt would be an edited attestation, i.e. REVIEW_CHANGED at the Stage-2 start).
const answerCache = new Map<Fixture, Obj>();
function answers(f: Fixture): Obj {
  if (!answerCache.has(f)) answerCache.set(f, buildAnswers(f));
  return answerCache.get(f)!;
}

function buildAnswers(f: Fixture): Obj {
  const job = (id: number, name: string, status: string, conclusion: string | null) =>
    ({ id, run_id: RUN, run_attempt: ATTEMPT, name, status, conclusion, head_sha: f.base, workflow_name: "Forge V0.1" });
  const jobs = [job(9001, "forge-gate", "completed", "success"), job(9002, "forge-verify", "in_progress", null)];
  return {
    [REPO]: { id: REPO_ID, full_name: "Forge-Dice/Forge", private: false },
    [`${REPO}/pulls/${PR}`]: {
      number: PR, state: "open", draft: false, user: { id: DEV, login: "codex" },
      base: { ref: "main", sha: f.base, repo: { id: REPO_ID, full_name: "Forge-Dice/Forge" } },
      head: { ref: BRANCH, sha: f.head, repo: { id: REPO_ID } },
    },
    [`${REPO}/branches/main`]: { name: "main", commit: { sha: f.base }, protected: true },
    [`${REPO}/actions/runs/${RUN}/attempts/${ATTEMPT}`]: {
      id: RUN, name: "Forge V0.1", run_attempt: ATTEMPT, event: "pull_request_target", path: WORKFLOW, workflow_id: 77,
      head_sha: f.base, repository: { id: REPO_ID }, actor: { id: DEV, login: "codex" }, triggering_actor: { id: OWNER, login: "owner" },
    },
    // FixedTransport treats a list as successive bodies: one body, itself the review list.
    [`${REPO}/pulls/${PR}/reviews?per_page=100&page=1`]: [[{
      id: 901, node_id: "x", user: { id: OWNER, login: "owner" }, body: attestation(f), state: "COMMENTED", html_url: "x",
      commit_id: f.head, submitted_at: "2026-10-04T10:00:00Z", author_association: "OWNER",
    }]],
    [`${REPO}/actions/runs/${RUN}/attempts/${ATTEMPT}/jobs?per_page=100&page=1`]: { total_count: jobs.length, jobs },
  };
}

// ------------------------------------------------------------------ one run inside the image

let root = "";
let runs = 0;

type Run = { status: number | null; record: Obj | null; stdout: string; stderr: string };

function inImage(mode: "stage0" | "adapter", f: Fixture, job: string, extra: Obj = {}, mounts: string[] = []): Run {
  const dir = join(root, `run-${++runs}`);
  const ws = join(dir, "ws");
  mkdirSync(ws, { recursive: true, mode: 0o700 });
  const event = {
    action: "synchronize", number: PR, repository: { id: REPO_ID, full_name: "Forge-Dice/Forge" },
    pull_request: { number: PR, base: { sha: f.base, ref: "main", repo: { id: REPO_ID } }, head: { sha: f.head, ref: BRANCH, repo: { id: REPO_ID } } },
  };
  const facts = { eventName: "pull_request_target", githubSha: f.base, runId: RUN, runAttempt: ATTEMPT, actorId: OWNER, job, image: IMAGE, ...extra };
  writeFileSync(join(dir, "event.json"), JSON.stringify(event));
  writeFileSync(join(dir, "facts.json"), JSON.stringify(facts));
  writeFileSync(join(dir, "answers.json"), JSON.stringify(answers(f)));
  writeFileSync(join(dir, "contract.md"), f.contract);
  const sock = DOCKER_HOST!.replace(/^unix:\/\//, "");
  const argv = [
    "run", "--rm", "--network=none", `--volume=${sock}:/var/run/docker.sock`, `--volume=${HERE}:${HERE}:ro`, `--volume=${root}:${root}`,
    ...mounts, "--entrypoint", PY, IMAGE!, "-I", "-B", join(HERE, "e2e_harness.py"), mode, join(dir, "answers.json"), f.remote,
    ...(mode === "adapter" ? [join(dir, "contract.md")] : []), "--event", join(dir, "event.json"), "--facts", join(dir, "facts.json"), "--workspace", ws,
  ];
  const r = docker(argv, 15 * 60_000);
  const lines = (r.stdout ?? "").trim().split("\n").filter((l) => l.length > 0);
  let record: Obj | null = null;
  try {
    record = lines.length === 1 ? (JSON.parse(lines[0]!) as Obj) : null;
  } catch {
    record = null;
  }
  return { status: r.status, record, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

const gate = (f: Fixture) => inImage("stage0", f, "forge-gate");
const verify = (f: Fixture, receipt: unknown) => inImage("stage0", f, "forge-verify", { receipt });
const summary = (r: Run) => (r.record ? { outcome: r.record["outcome"], code: r.record["code"] ?? null } : { status: r.status, stdout: r.stdout, stderr: r.stderr.slice(-4000) });

const enabled = Boolean(DOCKER_HOST) && IMAGE !== null;

describe.skipIf(!enabled)("tool image end to end (real image, real DockerRunner, seams for GitHub only)", () => {
  let good: Fixture, weak: Fixture, outOfScope: Fixture;

  beforeAll(() => {
    root = tempRoot("e2e-image");
    good = fixture(root, "good", { [CLAMP]: TERNARY, [ADDED_TEST]: GOOD_TEST });
    weak = fixture(root, "weak", { [CLAMP]: TERNARY, [ADDED_TEST]: WEAK_TEST });
    outOfScope = fixture(root, "scope", { [CLAMP]: TERNARY, [ADDED_TEST]: GOOD_TEST, "src/forge-drill/extra.ts": "export const extra = 1;\n" });
  });
  afterAll(() => {
    if (root) removeTree(root);
  });

  test("image contract parser resolves Zod from /trusted/node_modules over the materialized BASE root", () => {
    const ok = inImage("adapter", good, "forge-gate");
    const parsed = ok.record as { ok?: Obj; fail?: Obj; root: string; rootEntries: string[]; node: string; slashNodeModules: string | null } | null;
    expect(parsed, ok.stderr).not.toBeNull();
    expect(parsed!.fail).toBeUndefined();
    expect(parsed!.ok!["taskId"]).toBe(TASK);
    expect(parsed!.ok!["contentHash"]).toBe(good.contractHash);
    expect(parsed!.node).toBe("/opt/node/bin/node");
    expect(parsed!.root).toMatch(/\/ws\/trusted-source\/[0-9a-f]+$/);
    expect(parsed!.rootEntries).toEqual(["src", "tools"]); // manifest files only, no node_modules
    expect(parsed!.slashNodeModules).toBe("/trusted/node_modules");
    // The same run with the image Zod hidden: the parser cannot resolve "zod" from anywhere else.
    const hidden = inImage("adapter", good, "forge-gate", {}, ["--tmpfs=/trusted/node_modules:ro"]);
    expect((hidden.record as { fail?: { code: string } } | null)?.fail?.code).toBe("EXECUTION_INTERNAL");
  }, 120_000);

  test("(a) good PR: ternary + planned test + valid Owner attestation → GATE_PASS, then verify PASS", () => {
    const g = gate(good);
    expect(summary(g)).toEqual({ outcome: "GATE_PASS", code: null });
    expect(g.record!["reviewPending"]).toBe(false);
    const v = verify(good, g.record!["receipt"]);
    expect(summary(v)).toEqual({ outcome: "PASS", code: null });
    expect(v.record).toMatchObject({ taskId: TASK, profile: "DEV", B: good.base, H: good.head, attestationId: 901, executionIsolation: "not_established" });
    expect(v.status).toBe(0);
  }, 900_000);

  test("(b) manipulated PR: weakened named test → GATE_PASS, verify FAIL MUTANT_SURVIVED", () => {
    const g = gate(weak);
    expect(summary(g)).toEqual({ outcome: "GATE_PASS", code: null });
    const v = verify(weak, g.record!["receipt"]);
    expect(summary(v)).toEqual({ outcome: "FAIL", code: "MUTANT_SURVIVED" });
    expect(v.record).toMatchObject({ phase: "mutations", ordinal: 0 });
    expect(v.status).toBe(1);
  }, 900_000);

  test("(b') manipulated PR: out-of-scope source file → gate FAIL SCOPE_PATH", () => {
    const g = gate(outOfScope);
    expect(summary(g)).toEqual({ outcome: "FAIL", code: "SCOPE_PATH" });
    expect(g.record!["phase"]).toBe("scope");
  }, 300_000);
});
