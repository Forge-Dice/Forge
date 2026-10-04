import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

type Fixture = { remote: string; seed: string; base: string; head: string; contractHash: string; policyHash: string; contract: string };

/** BASE = registered clampAtZero task (contract, plan, policy, verifier files); HEAD = BASE + headFiles. */
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

// ------------------------------------------------------------------ fake GitHub (FixedTransport answers)

type Attest = { result?: "approve" | "request_changes"; head?: string; checkedAt?: string };

/** The Owner's FORGE-ATTESTATION-V1 review body; `opts` bends one field for the negative cases. */
function attestation(f: Fixture, opts: Attest = {}): string {
  const result = opts.result ?? "approve";
  const binding = { repoId: REPO_ID, pr: PR, base: f.base, head: opts.head ?? f.head, contractHash: f.contractHash, verifierSha: f.base, policyHash: f.policyHash };
  const reviewer = { provider: "anthropic", model: "claude-drill" };
  const findings = result === "approve" ? [] : [{ id: "weak-test", severity: "major", summary: "negative case is not pinned" }];
  const report = Buffer.from(JSON.stringify({ format: 1, binding, reviewer, result, findings }), "utf8");
  return "FORGE-ATTESTATION-V1\n" + canonical({
    format: 1, ...binding, runId: RUN, runAttempt: ATTEMPT, action: "approve", externalReviewer: reviewer,
    externalReviewHash: sha256(Buffer.concat([Buffer.from("forge-external-review-v1\n"), report])),
    externalReviewResult: result, externalReviewBase64: report.toString("base64"), supersedes: [],
    deployment: { policyDigest: DEPLOYMENT_DIGEST, checkedAt: opts.checkedAt ?? CHECKED_AT },
  });
}

const ownerReview = (f: Fixture, body: string) => ({
  id: 901, node_id: "x", user: { id: OWNER, login: "owner" }, body, state: "COMMENTED", html_url: "x",
  commit_id: f.head, submitted_at: "2026-10-04T10:00:00Z", author_association: "OWNER",
});

/** Every API read of gate and verify; `reviews` is the PR review list GitHub returns. */
function answers(f: Fixture, reviews: Obj[]): Obj {
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
    [`${REPO}/pulls/${PR}/reviews?per_page=100&page=1`]: [reviews],
    [`${REPO}/actions/runs/${RUN}/attempts/${ATTEMPT}/jobs?per_page=100&page=1`]: { total_count: jobs.length, jobs },
  };
}

// ------------------------------------------------------------------ one stage0 run inside the image

let root = "";
let runs = 0;

type Run = { status: number | null; record: Obj | null; stdout: string; stderr: string; seconds: number };

function inImage(mode: "stage0" | "adapter", f: Fixture, api: Obj, job: string, extra: Obj = {}, mounts: string[] = []): Run {
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
  writeFileSync(join(dir, "answers.json"), JSON.stringify(api));
  writeFileSync(join(dir, "contract.md"), f.contract);
  const sock = DOCKER_HOST!.replace(/^unix:\/\//, "");
  const argv = [
    "run", "--rm", "--network=none", `--volume=${sock}:/var/run/docker.sock`, `--volume=${HERE}:${HERE}:ro`, `--volume=${root}:${root}`,
    ...mounts, "--entrypoint", PY, IMAGE!, "-I", "-B", join(HERE, "e2e_harness.py"), mode, join(dir, "answers.json"), f.remote,
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
  return { status: r.status, record, stdout: r.stdout ?? "", stderr: r.stderr ?? "", seconds: (Date.now() - started) / 1000 };
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
  let good: Fixture, weak: Fixture, outOfScope: Fixture;
  const gate = (f: Fixture, api: Obj) => () => inImage("stage0", f, api, "forge-gate");
  const verify = (f: Fixture, api: Obj, g: Run) => () => inImage("stage0", f, api, "forge-verify", { receipt: g.record?.["receipt"] ?? null });
  const approved = (f: Fixture) => answers(f, [ownerReview(f, attestation(f))]);

  beforeAll(() => {
    root = tempRoot("forge-drill");
    good = fixture(root, "good", { [CLAMP]: TERNARY, [ADDED_TEST]: GOOD_TEST });
    weak = fixture(root, "weak", { [CLAMP]: TERNARY, [ADDED_TEST]: WEAK_TEST });
    outOfScope = fixture(root, "scope", { [CLAMP]: TERNARY, [ADDED_TEST]: GOOD_TEST, "src/forge-drill/extra.ts": "export const extra = 1;\n" });
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
      () => inImage("adapter", good, approved(good), "forge-gate", {}, ["--tmpfs=/trusted/node_modules:ro"]), rows);
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
  }, 300_000);
});
