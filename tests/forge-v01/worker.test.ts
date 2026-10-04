import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { b, outcome, py, py1, removeTree, tempRoot } from "./helpers.ts";

// FORGE-BOOTSTRAP-0001B worker.py: exact PKG §6 docker argv, env allowlist, forbidden mounts,
// missing daemon (fail closed), report framing limits (AV-121, AV-186), probe validation (AV-184),
// npm/script injection fixtures, and real runs: Vitest/tsc through the TEST-ONLY LocalRunner, and
// measured isolation probes in real Docker (AV-123..125) when a daemon is reachable via
// FORGE_DOCKER_HOST (default unix:///var/run/docker.sock). Without a daemon the same tests assert
// the normative fail-closed result EXECUTION_SANDBOX; nothing is measured or faked then.

const NODE_MODULES = resolve("node_modules");
const DOCKER_HOST = process.env["FORGE_DOCKER_HOST"] ?? "unix:///var/run/docker.sock";
const IMAGE = process.env["FORGE_WORKER_IMAGE"] ?? "forge-v01-probe:test";
const DUMPABLE = "forge-v01-probe:dumpable"; // the same image with a readable node binary
const FLAGS = ["--network=none", "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges", "--pids-limit=128", "--cpus=2", "--memory=2g", "--memory-swap=2g", "--user=10001:10001"];
const WORKER_ENV = ["CI=true", "FORGE_REPORT_FD=3", "FORGE_VITEST_PLAN=/trusted/plan.json", "HOME=/tmp/home", "LANG=C.UTF-8", "LC_ALL=C.UTF-8", "NO_COLOR=1", "PATH=/opt/node/bin:/usr/bin:/bin", "TMPDIR=/tmp", "TZ=UTC"];
const VITEST = ["/opt/node/bin/node", "/case/node_modules/vitest/vitest.mjs", "run", "--config", "/trusted/vitest.config.mjs", "--configLoader", "native"];

type SpecJson = { role: string; argv: string[]; env: [string, string][]; mounts: [string, string, boolean][]; deadline: number };

let base: string;
let counter = 0;
let dockerUp = false;
let builtImage = false;
let builtDumpable = false;
const dockerEnv = (): NodeJS.ProcessEnv => ({ PATH: "/usr/bin:/bin", HOME: base, DOCKER_HOST, DOCKER_CONFIG: join(base, "docker-config") });
const docker = (...args: string[]) => spawnSync("/usr/bin/docker", args, { env: dockerEnv(), encoding: "utf8", timeout: 60_000 });

/**
 * A small harmless acceptance image: the host node binary plus its shared libraries (no shell, no npm). As in
 * the release image, node is root:root 0711 (execute-only, so every node process is non-dumpable); with
 * `readable` it is 0755, the layout worker-entry.mjs must refuse (exit 5 → EXECUTION_SANDBOX).
 */
function buildImage(tag: string, readable: boolean): void {
  const root = join(base, "image-root");
  const libs = new Set<string>();
  const binding = join(NODE_MODULES, "@rolldown/binding-linux-x64-gnu");
  const natives = existsSync(binding) ? readdirSync(binding).filter((f) => f.endsWith(".node")).map((f) => join(binding, f)) : [];
  for (const target of [process.execPath, ...natives]) {
    for (const m of execFileSync("/usr/bin/ldd", [target], { encoding: "utf8" }).matchAll(/(\/[^\s]+\.so[^\s]*)/g)) libs.add(m[1]!);
  }
  mkdirSync(join(root, "opt/node/bin"), { recursive: true });
  for (const d of ["tmp", "case", "trusted", "etc"]) mkdirSync(join(root, d), { recursive: true });
  copyFileSync(process.execPath, join(root, "opt/node/bin/node"));
  chmodSync(join(root, "opt/node/bin/node"), readable ? 0o755 : 0o711);
  for (const lib of libs) {
    mkdirSync(join(root, dirname(lib)), { recursive: true });
    copyFileSync(lib, join(root, lib));
  }
  writeFileSync(join(root, "etc/passwd"), "root:x:0:0::/:/bin/false\n");
  execFileSync("/bin/tar", ["-C", root, "--owner=0", "--group=0", "--numeric-owner", "-cf", join(base, "image.tar"), "."]);
  const r = docker("import", join(base, "image.tar"), tag);
  if (r.status !== 0) throw new Error("docker import failed");
  removeTree(root);
  removeTree(join(base, "image.tar"));
}

function freshDir(label: string): string {
  const dir = join(base, `${label}-${counter++}`);
  mkdirSync(dir, { mode: 0o700 });
  return dir;
}

const TSCONFIG = JSON.stringify({ compilerOptions: { strict: true, noEmit: true, module: "NodeNext", moduleResolution: "NodeNext", target: "ES2022", allowImportingTsExtensions: true, skipLibCheck: true, types: [] }, include: ["src", "tests"] });
const TEST = (body: string) => `import { describe, expect, it } from 'vitest';\nimport { one } from '../src/one.ts';\ndescribe('S', () => {\n  it('one', ${body});\n  it('two', () => expect(one() + 1).toBe(2));\n});\n`;

/** A case tree on disk (as a materialization would leave it), prepared for the worker. */
function caseTree(files: Record<string, string>): string {
  const root = freshDir("case");
  const all = { "package.json": '{"type":"module"}\n', "tsconfig.json": TSCONFIG, "src/one.ts": "export function one(): number { return 1; }\n", ...files };
  for (const [path, text] of Object.entries(all)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text, { mode: 0o444 });
  }
  expect(outcome(py1("worker.prepare_case", [root]))).toBe("PASS");
  return root;
}

beforeAll(() => {
  base = tempRoot("worker");
  dockerUp = docker("version", "--format", "{{.Server.Version}}").status === 0;
  if (dockerUp && docker("image", "inspect", IMAGE).status !== 0) {
    buildImage(IMAGE, false);
    builtImage = true;
  }
  if (dockerUp) {
    buildImage(DUMPABLE, true);
    builtDumpable = true;
  }
}, 80_000);

afterAll(() => {
  if (builtImage) docker("image", "rm", "-f", IMAGE);
  if (builtDumpable) docker("image", "rm", "-f", DUMPABLE);
  if (base) removeTree(base);
});

describe("docker argv (PKG §6)", () => {
  it("a test worker gets exactly the PKG §6 flags, bounded tmpfs, read-only binds and the fixed entry argv", () => {
    const spec = py1("worker._spec", ["head", VITEST, "/w/case", "/w/nm", 120]).ok as SpecJson;
    const r = py1("worker.docker_argv", [spec.role, [...spec.mounts, ["/trusted", "/w/trusted", true]], "img@sha256:" + "a".repeat(64), "forge-v01-x", spec.argv, spec.env]);
    expect(r.ok).toEqual([
      "/usr/bin/docker", "run", "--rm", "--pull=never", "--log-driver=none", "--name=forge-v01-x", ...FLAGS,
      "--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=64m,uid=10001,gid=10001,mode=0700",
      "--mount=type=bind,source=/w/case,target=/case,readonly",
      "--mount=type=bind,source=/w/nm,target=/case/node_modules,readonly",
      "--mount=type=bind,source=/w/trusted,target=/trusted,readonly",
      "--workdir=/case", ...WORKER_ENV.map((e) => `--env=${e}`), "--entrypoint=/opt/node/bin/node", "img@sha256:" + "a".repeat(64),
      "/trusted/entry.mjs", ...VITEST,
    ]);
  });

  it("typecheck and probe argv are fixed; never npm test, never a contract command", () => {
    const tc = py1("worker._spec", ["head", ["/opt/node/bin/node", "/case/node_modules/typescript/bin/tsc", "--project", "/case/tsconfig.json", "--noEmit"], "/c", "/n", 60]).ok as SpecJson;
    expect(tc.argv).toEqual(["/opt/node/bin/node", "/trusted/entry.mjs", "/opt/node/bin/node", "/case/node_modules/typescript/bin/tsc", "--project", "/case/tsconfig.json", "--noEmit"]);
    const src = readFileSync(resolve("tools/forge_v01/worker.py"), "utf8");
    expect(src).not.toMatch(/npm test|"test"|\.command\b/);
  });

  it("env is the allowlist only; host secrets and DOCKER_HOST never reach the worker", () => {
    const hostile = { ...process.env, GITHUB_TOKEN: "ghs_secret", ACTIONS_RUNTIME_TOKEN: "x", GITHUB_OUTPUT: "/runner/out", NODE_OPTIONS: "--require /evil.js", npm_config_registry: "http://evil.invalid" };
    const [spec] = py([{ fn: "worker._spec", args: ["mutant", VITEST, "/c", "/n", 30] }], hostile);
    const s = spec!.ok as SpecJson;
    expect(s.env.map(([k, v]) => `${k}=${v}`)).toEqual(WORKER_ENV);
    const argv = py1("worker.docker_argv", [s.role, s.mounts, "img:1", "n", s.argv, s.env]).ok as string[];
    expect(argv.join("\n")).not.toMatch(/GITHUB|ACTIONS|NODE_OPTIONS|DOCKER_HOST|npm_config|secret/);
    expect(outcome(py1("worker.docker_argv", ["head", s.mounts, "img:1", "n", s.argv, [...s.env, ["GITHUB_TOKEN", "x"]]]))).toBe("EXECUTION_INTERNAL");
    expect(outcome(py1("worker.docker_argv", ["head", s.mounts, "img:1", "n", s.argv, [["NODE_OPTIONS", "--require=/x"]]]))).toBe("EXECUTION_INTERNAL");
  });

  it("no Docker socket, workspace, event, ODB or token mount: only /case, /case/node_modules, /trusted with safe sources", () => {
    const argv = ["/opt/node/bin/node"];
    const bad: [string, string, boolean][][] = [
      [["/var/run/docker.sock", "/var/run/docker.sock", true]],
      [["/github/workspace", "/home/runner/work", true]],
      [["/case", "/w/case,target=/x", true]],
      [["/case", "relative/case", true]],
      [["/case", "/w/../etc", true]],
      [["/case", "/w/case\n--privileged", true]],
    ];
    const rs = py(bad.map((m) => ({ fn: "worker.docker_argv", args: ["head", m, "img:1", "n", argv, []] })));
    expect(rs.map(outcome)).toEqual(Array(bad.length).fill("EXECUTION_INTERNAL"));
    expect(outcome(py1("worker.docker_argv", ["head", [], "img:1;rm", "n", argv, []]))).toBe("EXECUTION_INTERNAL");
    const ok = py1("worker.docker_argv", ["probe", [["/case", "/w/c", true]], "img:1", "n", argv, []]).ok as string[];
    expect(ok.filter((a) => /sock|privileged|^-v$|--volume|--network=host|seccomp=unconfined|apparmor=unconfined|--cap-add/.test(a))).toEqual([]);
  });

  it("the install container: same hardening, network only for install, BASE manifest/lock only, env from an empty mapping", () => {
    const dir = freshDir("install-spec");
    const head = freshDir("head");
    writeFileSync(join(head, ".npmrc"), "registry=http://evil.invalid/\nignore-scripts=false\n");
    const spec = py1("worker.install_spec", [b('{"name":"x","scripts":{"preinstall":"touch pwned"}}'), b("{}"), dir]).ok as SpecJson;
    expect(readdirSync(dir).sort()).toEqual(["package-lock.json", "package.json"]);
    expect(spec.argv).toEqual(["/opt/node/bin/npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund"]);
    expect(spec.env.map(([k, v]) => `${k}=${v}`)).toEqual([
      "CI=true", "HOME=/tmp/install-home", "LANG=C.UTF-8", "LC_ALL=C.UTF-8", "NO_COLOR=1", "PATH=/opt/node/bin:/usr/bin:/bin", "TMPDIR=/tmp", "TZ=UTC",
      "npm_config_cache=/tmp/npm-cache", "npm_config_globalconfig=/dev/null/npmrc", "npm_config_registry=https://registry.npmjs.org/", "npm_config_userconfig=/dev/null",
    ]);
    const argv = py1("worker.docker_argv", [spec.role, spec.mounts, "img:1", "n", spec.argv, spec.env]).ok as string[];
    expect(argv).toContain("--network=bridge");
    expect(argv).toEqual(expect.arrayContaining(FLAGS.slice(1)));
    expect(argv).toContain(`--mount=type=bind,source=${dir},target=/case`);
    expect(argv.join(" ")).not.toMatch(/\.npmrc|preinstall|evil/);
  });
});

describe("missing sandbox prerequisites fail closed (no unsandboxed fallback)", () => {
  it("unreachable daemon → EXECUTION_SANDBOX before any worker start; no image → EXECUTION_SANDBOX", () => {
    const ws = freshDir("nodaemon");
    const root = caseTree({ "tests/a.test.ts": TEST("() => expect(one()).toBe(1)") });
    const host = "unix:///nonexistent/forge-v01.sock";
    const rs = py([
      { fn: "probes.run_probes", args: [root, NODE_MODULES, ws], kwargs: { image: IMAGE, docker_host: host } },
      { fn: "worker.run_tests", args: [root, NODE_MODULES, ws, ["tests/a.test.ts"]], kwargs: { image: IMAGE, docker_host: host } },
      { fn: "worker.run_typecheck", args: [root, NODE_MODULES, ws], kwargs: { image: IMAGE, docker_host: host, mutant: true } },
      { fn: "worker.install_base_toolchain", args: [b("{}"), b("{}"), ws], kwargs: { image: IMAGE, docker_host: host } },
      { fn: "worker.run_tests", args: [root, NODE_MODULES, ws, ["tests/a.test.ts"]] },
    ]);
    expect(rs.map(outcome)).toEqual(Array(5).fill("EXECUTION_SANDBOX"));
    expect(readdirSync(ws)).toEqual([]);
  });
});

describe("report transport limits (contract B §4)", () => {
  const LIMIT = 8 * 1024 * 1024;
  const payload = (size: number): Buffer => {
    const json = Buffer.from(JSON.stringify({ format: 1, inventory: { format: 1, files: [], tests: [], errors: [], reason: "passed" }, failures: [] }));
    return Buffer.concat([json, Buffer.alloc(size - json.length, 0x20)]); // JSON whitespace padding
  };
  const frame = (body: Buffer, header = `FORGE-REPORT-V1 ${body.length}\n`) => b(Buffer.concat([Buffer.from(header), body]));

  it("AV-186 exactly 8 MiB payload accepted; 8 MiB + 1 → TEST_INVENTORY (MUTANT_INFRA in a mutant run)", () => {
    const rs = py([
      { fn: "worker.read_report", args: [frame(payload(LIMIT))] },
      { fn: "worker.read_report", args: [frame(payload(LIMIT + 1))] },
      { fn: "worker.read_report", args: [frame(payload(LIMIT + 1))], kwargs: { mutant: true } },
    ]);
    expect(rs.map(outcome)).toEqual(["PASS", "TEST_INVENTORY", "MUTANT_INFRA"]);
  }, 15_000);

  it("AV-121 forged, truncated, padded-header or missing reports → TEST_INVENTORY", () => {
    const body = payload(200);
    const rs = py([
      { fn: "worker.read_report", args: [b("")] },
      { fn: "worker.read_report", args: [frame(body, `FORGE-REPORT-V1 ${body.length + 1}\n`)] },
      { fn: "worker.read_report", args: [frame(body, `FORGE-REPORT-V1 ${"0".repeat(60)}${body.length}\n`)] },
      { fn: "worker.read_report", args: [frame(body, `FORGE-REPORT-V2 ${body.length}\n`)] },
      { fn: "worker.read_report", args: [b(Buffer.concat([Buffer.from(`FORGE-REPORT-V1 ${body.length}\n`), body, Buffer.from("x")]))] },
      { fn: "worker.read_report", args: [frame(Buffer.from('{"format":1,"inventory":{},"failures":[]}'))] },
    ]);
    expect(rs.map(outcome)).toEqual(Array(6).fill("TEST_INVENTORY"));
  });
});

describe("isolation probe validation (AV-184)", () => {
  const RULES: Record<string, [string, string]> = {
    network: ["network", "ENETUNREACH"], "docker-socket": ["errno", "ENOENT"], "actions-command-file": ["errno", "ENOENT"],
    "readonly-case": ["errno", "EROFS"], "readonly-test-file": ["errno", "EACCES"], "readonly-node-modules": ["errno", "EROFS"],
    "readonly-trusted": ["errno", "EACCES"], "readonly-rootfs": ["errno", "EROFS"],
    "proc-parent-mem": ["errno", "EACCES"], "proc-parent-fd": ["errno", "EPERM"],
  };
  const good = () => Object.entries(RULES).map(([probeId, [kind, code]]) => ({ probeId, attempted: true, denied: true, observationKind: kind, observationCode: code }));
  const mutate = (i: number, patch: Record<string, unknown>) => good().map((r, j) => (j === i ? { ...r, ...patch } : r));

  it("passes only with attempted=true, denied=true and an allowed kind/code for every required probe", () => {
    const variants: unknown[] = [
      good(),
      mutate(0, { attempted: false }),
      mutate(1, { denied: false }),
      mutate(2, { attempted: "true" }),
      mutate(3, { observationKind: "file" }),
      mutate(4, { observationCode: "ALLOWED" }),
      mutate(0, { observationCode: "ECONNREFUSED" }),
      mutate(5, { observationKind: "network" }),
      good().slice(1),
      [...good(), good()[0]],
      [...good(), { ...good()[0], probeId: "extra" }],
      good().map((r) => ({ ...r, note: "x" })),
      [],
      { probes: good() },
    ];
    const rs = py(variants.map((v) => ({ fn: "probes.validate_probes", args: [v] })));
    expect(rs.map(outcome)).toEqual(["PASS", ...Array(variants.length - 1).fill("EXECUTION_SANDBOX")]);
  });
});

describe("real worker runs through the TEST-ONLY LocalRunner (no sandbox)", () => {
  it("a passing suite yields one strictly parsed report; staging is removed afterwards", () => {
    const ws = freshDir("local-ok");
    const root = caseTree({ "tests/a.test.ts": TEST("() => expect(one()).toBe(1)") });
    const [tc, run] = py([
      { fn: "worker.run_typecheck", args: [root, NODE_MODULES, ws], kwargs: { _runner: process.execPath } },
      { fn: "worker.run_tests", args: [root, NODE_MODULES, ws, ["tests/a.test.ts"]], kwargs: { _runner: process.execPath } },
    ]);
    expect(outcome(tc!)).toBe("PASS");
    const r = run!.ok as { exitCode: number; report: { inventory: { reason: string; tests: { id: unknown[]; status: string }[] } } };
    expect(r.exitCode).toBe(0);
    expect(r.report.inventory.reason).toBe("passed");
    expect(r.report.inventory.tests.map((t) => [t.id[3], t.status])).toEqual([["one", "passed"], ["two", "passed"]]);
    expect(readdirSync(ws)).toEqual([]);
  }, 15_000);

  it("AV-120 compiler failure → TEST_COMPILE; AV-119 deadline with partial inventory → EXECUTION_TIMEOUT", () => {
    const ws = freshDir("local-bad");
    const broken = caseTree({ "src/one.ts": "export function one(): number { return ???; }\n", "tests/a.test.ts": TEST("() => expect(one()).toBe(1)") });
    const slow = caseTree({ "tests/a.test.ts": TEST("() => { const end = Date.now() + 20000; while (Date.now() < end) {} }") });
    const rs = py([
      { fn: "worker.run_typecheck", args: [broken, NODE_MODULES, ws], kwargs: { _runner: process.execPath } },
      { fn: "worker.run_tests", args: [slow, NODE_MODULES, ws, ["tests/a.test.ts"]], kwargs: { _runner: process.execPath, deadline: 3 } },
      { fn: "worker.run_tests", args: [slow, NODE_MODULES, ws, ["tests/a.test.ts"]], kwargs: { _runner: process.execPath, deadline: 121 } },
    ]);
    expect(rs.map(outcome)).toEqual(["TEST_COMPILE", "EXECUTION_TIMEOUT", "EXECUTION_INTERNAL"]);
    expect(readdirSync(ws)).toEqual([]);
  }, 15_000);

  it("no report file: forged frames on the old report path or on every socket a test holds (but its IPC) change nothing", () => {
    const ws = freshDir("forged");
    const id = (title: string) => ["tests/a.test.ts", "forge-v01", ["S"], title, 0];
    const body = JSON.stringify({ format: 1, failures: [], inventory: { format: 1, files: [{ file: "tests/a.test.ts", project: "forge-v01", collection: "ok" }],
      tests: [{ id: id("one"), status: "passed" }, { id: id("two"), status: "passed" }], errors: [], reason: "passed" } });
    const frame = `FORGE-REPORT-V1 ${body.length}\n${body}`;
    // Old file channel plus a spray of every socket descriptor of the Vitest fork except its own IPC channel.
    const forge = (assertion: string) => `async () => {\n    const fs = await import('node:fs');\n    const f = ${JSON.stringify(frame)};\n` +
      `    try { fs.writeFileSync('/out/report', f, { flag: 'wx' }); } catch {}\n` +
      `    const ipc = (process as unknown as { channel?: { fd?: number } }).channel?.fd;\n` +
      `    for (const n of fs.readdirSync('/proc/self/fd')) {\n` +
      `      const fd = Number(n);\n      let target = '';\n      try { target = fs.readlinkSync('/proc/self/fd/' + n); } catch {}\n` +
      `      if (fd > 2 && fd !== ipc && target.startsWith('socket:')) { try { fs.writeSync(fd, f); } catch {} }\n    }\n    ${assertion};\n  }`;
    const failing = caseTree({ "tests/a.test.ts": TEST(forge("expect(one()).toBe(2)")) });
    const passing = caseTree({ "tests/a.test.ts": TEST(forge("expect(one()).toBe(1)")) });
    for (const role of ["head", "base"]) {
      const rs = py([failing, passing].map((root) => ({ fn: "worker.run_tests", args: [root, NODE_MODULES, ws, ["tests/a.test.ts"]], kwargs: { role, _runner: process.execPath } })));
      const [f, p] = rs.map((r) => r.ok as { exitCode: number; report: { inventory: { reason: string; tests: { id: unknown[]; status: string }[] } } });
      expect([f!.exitCode, f!.report.inventory.reason, p!.exitCode, p!.report.inventory.reason], role).toEqual([1, "failed", 0, "passed"]);
      expect(f!.report.inventory.tests.map((t) => [t.id[3], t.status])).toEqual([["one", "failed"], ["two", "passed"]]);
    }
    expect(readdirSync(ws)).toEqual([]);
  }, 20_000);

  it("PKG §11: an unreadable or exit-contradicting BASE report is TEST_BASELINE (TEST_INVENTORY for HEAD)", () => {
    const ws = freshDir("baseline");
    // The test SIGKILLs the Vitest main process: no report at all, exit 137.
    const killed = caseTree({ "tests/a.test.ts": TEST("() => { process.kill(process.ppid, 'SIGKILL'); }") });
    const rs = py(["base", "head"].map((role) => ({ fn: "worker.run_tests", args: [killed, NODE_MODULES, ws, ["tests/a.test.ts"]], kwargs: { role, _runner: process.execPath } })));
    expect(rs.map(outcome)).toEqual(["TEST_BASELINE", "TEST_INVENTORY"]);
    expect(readdirSync(ws)).toEqual([]);
  }, 20_000);

  it("collect-only listing: runtime identities, no test body and no hook runs; equal to the run's; collection error → TEST_INVENTORY", () => {
    const ws = freshDir("list");
    const marker = join(base, "list-ran");
    const dynamic = `import { beforeAll, describe, it } from 'vitest';\nimport { writeFileSync } from 'node:fs';\n` +
      `beforeAll(() => { writeFileSync(${JSON.stringify(marker)}, 'hook'); });\n` +
      `describe('D', () => {\n  for (const n of [1, 2]) it(\`n\${n}\`, () => {});\n  it.each([1, 1])('e %i', () => {});\n` +
      `  it.skip('s', () => {});\n  it.todo('t');\n  it('w', () => { writeFileSync(${JSON.stringify(marker)}, 'body'); });\n});\n`;
    const root = caseTree({ "tests/a.test.ts": TEST("() => expect(one()).toBe(1)"), "tests/d.test.ts": dynamic });
    const broken = caseTree({ "tests/a.test.ts": "import { it } from 'vitest';\nthrow new Error('collect');\nit('x', () => {});\n" });
    const files = ["tests/a.test.ts", "tests/d.test.ts"];
    const [listed, bad] = py([
      { fn: "worker.list_tests", args: [root, NODE_MODULES, ws, files], kwargs: { _runner: process.execPath } },
      { fn: "worker.list_tests", args: [broken, NODE_MODULES, ws, ["tests/a.test.ts"]], kwargs: { _runner: process.execPath } },
    ]);
    expect(existsSync(marker)).toBe(false); // neither the hook nor a body ran
    expect(outcome(bad!)).toBe("TEST_INVENTORY");
    const tests = (listed!.ok as { tests: { id: unknown[]; status: string }[] }).tests;
    expect(tests.map((t) => `${String(t.id[0])}:${String(t.id[3])}:${String(t.id[4])}:${t.status}`)).toEqual([
      "tests/a.test.ts:one:0:skipped", "tests/a.test.ts:two:0:skipped", "tests/d.test.ts:e 1:0:skipped", "tests/d.test.ts:e 1:1:skipped",
      "tests/d.test.ts:n1:0:skipped", "tests/d.test.ts:n2:0:skipped", "tests/d.test.ts:s:0:skipped", "tests/d.test.ts:t:0:skipped", "tests/d.test.ts:w:0:skipped",
    ]);
    const run = py1("worker.run_tests", [root, NODE_MODULES, ws, files], { _runner: process.execPath }).ok as { report: { inventory: { tests: { id: unknown[]; status: string }[] } } };
    const head = run.report.inventory;
    expect(head.tests.map((t) => t.id)).toEqual(tests.map((t) => t.id));
    const green = { ...head, tests: head.tests.filter((t) => t.status === "passed") };
    expect(outcome(py1("inventory.compare_inventory", [green, head, ["tests/d.test.ts"], files, listed!.ok]))).toBe("TEST_STATUS"); // skip and todo
    expect(readdirSync(ws)).toEqual([]);
    removeTree(marker);
  }, 30_000);

  it("residual (PKG §6): code in a test body can flip its own status in-process; no channel is involved", () => {
    // The report is faithful to Vitest's main-process state, and that state comes from the fork that runs the
    // body: a body that throws but marks its own task as an expected failure is reported "passed".
    const ws = freshDir("residual");
    const root = caseTree({ "tests/a.test.ts": TEST("(ctx) => { (ctx.task as { fails?: boolean }).fails = true; throw new Error('real failure'); }") });
    const r = py1("worker.run_tests", [root, NODE_MODULES, ws, ["tests/a.test.ts"]], { _runner: process.execPath }).ok as { exitCode: number; report: { inventory: { tests: { id: unknown[]; status: string }[] } } };
    expect([r.exitCode, ...r.report.inventory.tests.map((t) => `${String(t.id[3])}:${t.status}`)]).toEqual([0, "one:passed", "two:passed"]);
    expect(readdirSync(ws)).toEqual([]);
  }, 15_000);

  it("AV-122 injection fixture: real offline npm ci never runs root or dependency lifecycle scripts; HEAD .npmrc never used", () => {
    const ws = freshDir("install");
    const dep = freshDir("dep");
    writeFileSync(join(dep, "package.json"), JSON.stringify({ name: "forge-dep", version: "1.0.0", scripts: { install: "node -e \"require('fs').writeFileSync('/tmp/forge-v01-dep-pwned','x')\"" } }));
    const npm = join(dirname(process.execPath), "npm");
    const npmEnv = { PATH: `${dirname(process.execPath)}:/usr/bin:/bin`, HOME: dep, npm_config_userconfig: "/dev/null", npm_config_cache: join(dep, ".cache"), npm_config_audit: "false", npm_config_fund: "false" };
    const tgz = join(dep, execFileSync(npm, ["pack", "--silent"], { cwd: dep, env: npmEnv, encoding: "utf8" }).trim());
    const gen = freshDir("gen");
    writeFileSync(join(gen, "package.json"), JSON.stringify({ name: "x", version: "1.0.0", scripts: { preinstall: "node -e \"require('fs').writeFileSync('PWNED','x')\"" } }));
    execFileSync(npm, ["install", "--ignore-scripts", "--offline", tgz], { cwd: gen, env: npmEnv, stdio: "ignore" });
    // npm records the tarball relative to gen/; make it absolute so the staged BASE lock resolves offline anywhere.
    const absolute = (file: string) => readFileSync(join(gen, file), "utf8").replace(/file:[^"]*forge-dep-1\.0\.0\.tgz/g, `file:${tgz}`);
    const head = freshDir("head-npmrc");
    writeFileSync(join(head, ".npmrc"), "ignore-scripts=false\n");
    const r = py1("worker.install_base_toolchain", [b(absolute("package.json")), b(absolute("package-lock.json")), ws], { _runner: process.execPath });
    expect(outcome(r)).toBe("PASS");
    const modules = r.ok as string;
    expect(readdirSync(modules)).toContain("forge-dep");
    expect(readdirSync(dirname(modules)).sort()).toEqual(["node_modules", "package-lock.json", "package.json"]);
    expect(existsSync("/tmp/forge-v01-dep-pwned")).toBe(false);
    const failed = py1("worker.install_base_toolchain", [b('{"name":"x","version":"1.0.0"}'), b("{ not a lockfile"), ws], { _runner: process.execPath });
    expect(outcome(failed)).toBe("EXECUTION_SANDBOX");
  }, 15_000);
});

describe("measured isolation in real Docker (AV-123..125)", () => {
  it("probe worker with exactly the PKG §6 flags reports measured denials (or EXECUTION_SANDBOX without a daemon)", () => {
    const ws = freshDir("probe");
    const root = caseTree({ "tests/a.test.ts": TEST("() => expect(one()).toBe(1)") });
    const r = py1("probes.run_probes", [root, NODE_MODULES, ws], { image: IMAGE, docker_host: DOCKER_HOST });
    if (!dockerUp) {
      expect(outcome(r)).toBe("EXECUTION_SANDBOX");
      return;
    }
    expect(outcome(r)).toBe("PASS");
    const records = r.ok as { probeId: string; attempted: boolean; denied: boolean; observationCode: string }[];
    expect(records.map((x) => x.probeId).sort()).toEqual(["actions-command-file", "docker-socket", "network", "proc-parent-fd", "proc-parent-mem", "readonly-case", "readonly-node-modules", "readonly-rootfs", "readonly-test-file", "readonly-trusted"]);
    expect(records.find((x) => x.probeId === "proc-parent-mem")!.observationCode).toBe("EACCES");
    expect(records.every((x) => x.attempted && x.denied)).toBe(true);
    expect(records.find((x) => x.probeId === "network")!.observationCode).toBe("ENETUNREACH");
    expect(records.find((x) => x.probeId === "docker-socket")!.observationCode).toBe("ENOENT");
    expect(readdirSync(ws)).toEqual([]);
  }, 15_000);

  it("a readable (dumpable) node binary: the entry refuses before any test code runs → EXECUTION_SANDBOX", () => {
    const ws = freshDir("dumpable");
    const root = caseTree({ "tests/a.test.ts": TEST("() => expect(one()).toBe(1)") });
    const kw = { image: DUMPABLE, docker_host: DOCKER_HOST };
    const rs = py([
      { fn: "worker.run_tests", args: [root, NODE_MODULES, ws, ["tests/a.test.ts"]], kwargs: kw },
      { fn: "worker.run_tests", args: [root, NODE_MODULES, ws, ["tests/a.test.ts"]], kwargs: { ...kw, role: "base" } },
      { fn: "worker.list_tests", args: [root, NODE_MODULES, ws, ["tests/a.test.ts"]], kwargs: kw },
      { fn: "worker.run_typecheck", args: [root, NODE_MODULES, ws], kwargs: kw },
      { fn: "probes.run_probes", args: [root, NODE_MODULES, ws], kwargs: kw },
    ]);
    expect(rs.map(outcome)).toEqual(Array(5).fill("EXECUTION_SANDBOX"));
    expect(readdirSync(ws)).toEqual([]);
  }, 30_000);

  it("a test that attempts socket, network, Actions file and read-only writes: denial observed, decision unchanged", () => {
    const ws = freshDir("decision");
    const attack =
      "async () => {\n    const fs = await import('node:fs');\n    const net = await import('node:net');\n" +
      "    expect(() => fs.writeFileSync('/case/tests/a.test.ts', 'pwned')).toThrow();\n" +
      "    expect(() => fs.writeFileSync('/trusted/vitest.config.mjs', 'pwned')).toThrow();\n" +
      "    expect(() => fs.openSync('/var/run/docker.sock', 'r')).toThrow();\n" +
      "    expect(() => fs.writeFileSync('/home/runner/work/_temp/_runner_file_commands/x', '::stop-commands::')).toThrow();\n" +
      "    const code = await new Promise((r) => { const s = net.connect({ host: '1.1.1.1', port: 443 }); s.on('connect', () => { s.destroy(); r('CONNECTED'); }); s.on('error', (e) => r(e.code)); });\n" +
      "    expect(code).toBe('ENETUNREACH');\n    expect(one()).toBe(1);\n  }";
    const clean = caseTree({ "tests/a.test.ts": TEST("() => expect(one()).toBe(1)") });
    const hostile = caseTree({ "tests/a.test.ts": TEST(attack) });
    const kw = { image: IMAGE, docker_host: DOCKER_HOST };
    const [a, h] = py([
      { fn: "worker.run_tests", args: [clean, NODE_MODULES, ws, ["tests/a.test.ts"]], kwargs: kw },
      { fn: "worker.run_tests", args: [hostile, NODE_MODULES, ws, ["tests/a.test.ts"]], kwargs: kw },
    ]);
    if (!dockerUp) {
      expect([outcome(a!), outcome(h!)]).toEqual(["EXECUTION_SANDBOX", "EXECUTION_SANDBOX"]);
      return;
    }
    const ra = a!.ok as { exitCode: number; report: { inventory: unknown } };
    const rh = h!.ok as { exitCode: number; report: { inventory: unknown } };
    expect([ra.exitCode, rh.exitCode]).toEqual([0, 0]);
    expect(rh.report.inventory).toEqual(ra.report.inventory);
    expect(outcome(py1("inventory.compare_inventory", [ra.report.inventory, rh.report.inventory, [], ["tests/a.test.ts"]]))).toBe("PASS");
    expect(readFileSync(join(hostile, "tests/a.test.ts"), "utf8")).not.toBe("pwned");
  }, 20_000);
});
