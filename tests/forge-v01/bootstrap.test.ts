import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FixtureRepo, b, outcome, py, py1, removeTree, tempRoot, type TreeSpec } from "./helpers.ts";

// FORGE-BOOTSTRAP-0001A bootstrap and stage-0 kernel. The fixed GitHub remote and API are
// replaced only through the test seams (local bare "remote", fixed API answers); a separate
// test pins the production defaults. No network.

const REPO_ID = 1401864629;
const REPO = "/repos/Forge-Dice/Forge";
const PR = 7;
const RUN = 4242;
const ATTEMPT = 1;

let root: string;
let remote: FixtureRepo;
let base: string;
let head: string;
let workspaceCounter = 0;

const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");

function workspace(): string {
  const dir = join(root, `ws-${workspaceCounter++}`);
  mkdirSync(dir, { mode: 0o700 });
  return dir;
}

function event(overrides: { base?: string; head?: string; number?: unknown; action?: string } = {}): string {
  return JSON.stringify({
    action: overrides.action ?? "synchronize",
    number: PR,
    repository: { id: REPO_ID, full_name: "Forge-Dice/Forge" },
    pull_request: {
      number: overrides.number ?? PR,
      base: { sha: overrides.base ?? base, ref: "main", repo: { id: REPO_ID } },
      head: { sha: overrides.head ?? head, ref: "forge/run/codex/x-1", repo: { id: REPO_ID, clone_url: "https://evil.invalid/x.git" } },
    },
  });
}

function facts(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { eventName: "pull_request_target", githubSha: base, runId: RUN, runAttempt: ATTEMPT, actorId: 99, triggeringActorLogin: "dev", ...overrides };
}

function answers(o: { main?: string | string[]; head?: string; headRepo?: number } = {}): Record<string, unknown> {
  const mains = Array.isArray(o.main) ? o.main : [o.main ?? base];
  return {
    [REPO]: { id: REPO_ID, full_name: "Forge-Dice/Forge", private: false },
    [`${REPO}/pulls/${PR}`]: {
      number: PR, state: "open", draft: false, user: { id: 99 },
      base: { sha: base, ref: "main", repo: { id: REPO_ID } },
      head: { sha: o.head ?? head, repo: { id: o.headRepo ?? REPO_ID } },
    },
    [`${REPO}/branches/main`]: mains.map((sha) => ({ commit: { sha } })),
    [`${REPO}/actions/runs/${RUN}/attempts/${ATTEMPT}`]: { id: RUN, run_attempt: ATTEMPT, triggering_actor: { id: 99 } },
  };
}

function boot(o: { event?: string; facts?: Record<string, unknown>; answers?: Record<string, unknown>; budgets?: Record<string, unknown>; head?: boolean; remote?: string } = {}) {
  return py1("bootstrap.bootstrap_for_test", [
    b(o.event ?? event()), o.facts ?? facts(), workspace(),
    { remote: o.remote ?? remote.odb, answers: o.answers ?? answers(), budgets: o.budgets ?? {} },
  ], { head: o.head ?? true });
}

// python -I never puts the script directory on sys.path; the BASE entry adds its own checked folder.
const STUB_MAIN = 'import os\nimport sys\nsys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))\nimport helper\nprint("stub ok", helper.VALUE, len(sys.argv) > 1)\n';
const STUB_HELPER = "VALUE = 42\n";

function baseSpec(files: Record<string, string>, manifestFiles?: { path: string; sha256: string }[]): TreeSpec {
  const manifest = JSON.stringify({ format: 1, files: manifestFiles ?? Object.entries(files).map(([path, text]) => ({ path, sha256: sha256(text) })) });
  const spec: TreeSpec = { forge: { verifier: { "bootstrap-manifest.json": manifest } } };
  for (const [path, text] of Object.entries(files)) {
    const parts = path.split("/");
    let node = spec;
    for (const dir of parts.slice(0, -1)) node = (node[dir] ??= {}) as TreeSpec;
    node[parts.at(-1)!] = text;
  }
  return spec;
}

/** New remote whose main is a BASE commit built from `spec`. */
function remoteWithBase(spec: TreeSpec): { repo: FixtureRepo; base: string } {
  const repo = new FixtureRepo(join(root, `remote-${workspaceCounter++}`));
  const commit = repo.commit(repo.tree(spec), [], "base");
  repo.setRef("refs/heads/main", commit);
  return { repo, base: commit };
}

function stage0(repo: FixtureRepo, baseSha: string) {
  const ans = answers({ main: baseSha });
  (ans[`${REPO}/pulls/${PR}`] as { base: { sha: string } }).base.sha = baseSha;
  return py1("stage0.run_for_test", [b(event({ base: baseSha })), facts({ githubSha: baseSha }), workspace(), { remote: repo.odb, answers: ans }]);
}

beforeAll(() => {
  root = tempRoot("bootstrap");
  remote = new FixtureRepo(join(root, "remote"));
  const files = { "tools/forge_v01/main.py": STUB_MAIN, "tools/forge_v01/helper.py": STUB_HELPER, "src/a.ts": "export {};\n" };
  base = remote.commit(remote.tree(baseSpec(files)), [], "base");
  head = remote.commit(remote.tree({ ...baseSpec(files), src: { "a.ts": "export {};\n", "b.ts": "export const b = 1;\n" } }), [base], "head");
  remote.setRef("refs/heads/main", base);
  remote.setRef(`refs/pull/${PR}/head`, head);
});

afterAll(() => removeTree(root));

describe("event and runner facts", () => {
  test("AV-001 valid input, exact BASE and HEAD refs → PASS with only refs/forge/main and refs/forge/head", () => {
    const r = boot();
    expect(outcome(r)).toBe("PASS");
    const ok = r.ok as { base: string; head: string; refs: Record<string, string>; requests: string[] };
    expect(ok.refs).toEqual({ "refs/forge/head": head, "refs/forge/main": base });
    expect(ok.requests).toEqual([REPO, `${REPO}/pulls/${PR}`, `${REPO}/branches/main`, `${REPO}/actions/runs/${RUN}/attempts/${ATTEMPT}`,
      REPO, `${REPO}/pulls/${PR}`, `${REPO}/branches/main`, `${REPO}/actions/runs/${RUN}/attempts/${ATTEMPT}`]);
  });

  test("AV-002 GITHUB_SHA with 39 hex characters → PR_INPUT", () => {
    expect(outcome(boot({ facts: facts({ githubSha: base.slice(1) }) }))).toBe("PR_INPUT");
  });

  test("AV-003 SHA with upper case or :path suffix → PR_INPUT", () => {
    expect(outcome(boot({ facts: facts({ githubSha: base.toUpperCase() }) }))).toBe("PR_INPUT");
    expect(outcome(boot({ event: event({ head: `${head}:src` }) }))).toBe("PR_INPUT");
  });

  test.each(["1e0", "1.0", "01", "0", "-1", "7.5", "9007199254740992"])("AV-004 PR number token %s → PR_INPUT", (token) => {
    const raw = event().replace(`"number":${PR},"base"`, `"number":${token},"base"`);
    expect(raw).not.toBe(event());
    expect(outcome(boot({ event: raw }))).toBe("PR_INPUT");
  });

  test("AV-004 run and actor IDs follow the same token grammar", () => {
    expect(outcome(boot({ facts: facts({ runId: 0 }) }))).toBe("PR_INPUT");
    expect(outcome(boot({ facts: facts({ actorId: 1.5 }) }))).toBe("PR_INPUT");
    expect(outcome(boot({ facts: facts({ runAttempt: true }) }))).toBe("PR_INPUT");
  });

  test("AV-005 event larger than 1 MiB → PR_INPUT", () => {
    const big = event().replace('"action"', `"padding":"${"x".repeat(1024 * 1024)}","action"`);
    expect(outcome(boot({ event: big }))).toBe("PR_INPUT");
  });

  test("AV-006 duplicate repository.id key → PR_INPUT", () => {
    const dup = event().replace(`"repository":{"id":${REPO_ID}`, `"repository":{"id":1,"id":${REPO_ID}`);
    expect(outcome(boot({ event: dup }))).toBe("PR_INPUT");
  });

  test("strict JSON: invalid UTF-8, NaN and over-deep nesting → PR_INPUT", () => {
    expect(outcome(boot({ event: event().replace('"synchronize"', '"syncÿhronize"') }))).toBe("PR_INPUT");
    expect(outcome(boot({ event: event().replace('"action"', '"x":NaN,"action"') }))).toBe("PR_INPUT");
    expect(outcome(boot({ event: event().replace('"action"', `"x":${"[".repeat(40)}${"]".repeat(40)},"action"`) }))).toBe("PR_INPUT");
  });

  test("AV-007 push event instead of pull_request_target → PR_INPUT", () => {
    expect(outcome(boot({ facts: facts({ eventName: "push" }) }))).toBe("PR_INPUT");
  });

  test("AV-008 action edited → PR_INPUT", () => {
    expect(outcome(boot({ event: event({ action: "edited" }) }))).toBe("PR_INPUT");
  });

  test("AV-009 head.repo.clone_url in the PR record is ignored; fetch uses the fixed remote only → PASS", () => {
    expect(event()).toContain("evil.invalid");
    expect(outcome(boot())).toBe("PASS");
  });

  test("AV-009 production defaults: fixed remote, HTTPS transport, no redirects, no file protocol", () => {
    const r = py1("bootstrap.default_seams_report");
    const report = r.ok as { remote: string; transport: string; fetch_deadline: number; extra_config: unknown[]; fetch_argv: string[] };
    expect(report.remote).toBe("https://github.com/Forge-Dice/Forge.git");
    expect(report.transport).toBe("HttpsTransport");
    expect(report.fetch_deadline).toBe(90);
    expect(report.extra_config).toEqual([]);
    for (const c of ["http.followRedirects=false", "protocol.allow=never", "protocol.https.allow=always", "credential.helper=", "core.hooksPath=/dev/null"]) {
      expect(report.fetch_argv).toContain(c);
    }
  });

  test("seams may only lower budgets", () => {
    expect(outcome(boot({ budgets: { fetch_deadline: 91 } }))).toBe("EXECUTION_INTERNAL");
    expect(outcome(boot({ budgets: { budget_count: 150001 } }))).toBe("EXECUTION_INTERNAL");
  });
});

describe("live GETs and fetch", () => {
  test("AV-011 fetch delivers another head than the live PR → PR_STALE", () => {
    const other = remote.commit(remote.tree({ x: "1" }), [base], "other");
    const ev = event({ head: other });
    expect(outcome(boot({ event: ev, answers: answers({ head: other }) }))).toBe("PR_STALE");
  });

  test("AV-012 main moves between GET and fetch → PR_STALE", () => {
    const moved = remote.commit(remote.tree({ y: "1" }), [base], "moved");
    expect(outcome(boot({ answers: answers({ main: moved }) }))).toBe("PR_STALE");
  });

  test("main moves between the first and the second live read → PR_STALE", () => {
    expect(outcome(boot({ answers: answers({ main: [base, head] }) }))).toBe("PR_STALE");
  });

  test("head repository with another numeric id → IDENTITY_ACTOR", () => {
    expect(outcome(boot({ answers: answers({ headRepo: 1 }) }))).toBe("IDENTITY_ACTOR");
  });

  test("missing or malformed API answer → EXECUTION_API", () => {
    const a = answers();
    delete a[`${REPO}/branches/main`];
    expect(outcome(boot({ answers: a }))).toBe("EXECUTION_API");
    const c = answers();
    c[REPO] = { id: REPO_ID, full_name: "Forge-Dice/Forge", private: true };
    expect(outcome(boot({ answers: c }))).toBe("EXECUTION_API");
  });

  test("unreachable remote → GIT_FETCH", () => {
    expect(outcome(boot({ remote: join(root, "does-not-exist.git") }))).toBe("GIT_FETCH");
  });

  test("AV-015 object count over budget (lowered to 3) → GIT_LIMIT", () => {
    expect(outcome(boot({ budgets: { budget_count: 3 } }))).toBe("GIT_LIMIT");
  });

  test("AV-014 ODB disk over budget (lowered to 1 KiB) → GIT_LIMIT", () => {
    expect(outcome(boot({ budgets: { disk_budget: 1024 } }))).toBe("GIT_LIMIT");
  });

  test("AV-017 summed declared object sizes over budget (lowered to 100 bytes) → GIT_LIMIT", () => {
    expect(outcome(boot({ budgets: { budget_bytes: 100 } }))).toBe("GIT_LIMIT");
  });

  test("AV-018..021 hostile parent environment is not inherited → PASS, credential helper never runs", () => {
    const marker = join(root, "pwned");
    const env = {
      PATH: "/usr/bin:/bin",
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "core.fsmonitor",
      GIT_CONFIG_VALUE_0: `touch ${marker}`,
      GIT_DIR: "/nonexistent",
      NODE_OPTIONS: "--require /nonexistent.js",
      npm_config_userconfig: "/nonexistent",
      HTTPS_PROXY: "http://127.0.0.1:9",
      SSH_ASKPASS: `/bin/sh -c 'touch ${marker}'`,
    };
    const [r] = py([{ fn: "bootstrap.bootstrap_for_test", args: [b(event()), facts(), workspace(), { remote: remote.odb, answers: answers() }] }], env);
    expect(outcome(r!)).toBe("PASS");
    expect(existsSync(marker)).toBe(false);
    const clean = py1("process.clean_env", ["git", "/private"]).ok as Record<string, string>;
    expect(Object.keys(clean).sort()).toEqual(["GIT_ASKPASS", "GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM", "GIT_CONFIG_SYSTEM", "GIT_NO_LAZY_FETCH",
      "GIT_NO_REPLACE_OBJECTS", "GIT_OPTIONAL_LOCKS", "GIT_TERMINAL_PROMPT", "HOME", "LANG", "LC_ALL", "PATH", "TMPDIR", "TZ", "XDG_CONFIG_HOME"]);
  });
});

describe("ODB layout", () => {
  let odb: string;
  let priv: string;

  beforeAll(() => {
    const fx = new FixtureRepo(join(root, "layout"));
    odb = fx.odb;
    priv = fx.private;
    fx.setRef("refs/forge/main", fx.commit(fx.tree({ a: "1" }), []));
  });

  const layout = () => outcome(py1("bootstrap.check_layout", [odb, priv, { $set: ["refs/forge/main"] }]));
  const withFile = (rel: string, content: string, check: () => void) => {
    const path = join(odb, rel);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, content);
    try {
      check();
    } finally {
      removeTree(path);
    }
  };

  test("clean fixture ODB → PASS", () => {
    expect(layout()).toBe("PASS");
  });

  test("AV-022 hidden config include → GIT_LAYOUT", () => {
    const config = join(odb, "config");
    const original = readFileSync(config, "utf8");
    writeFileSync(config, `${original}[include]\n\tpath = /tmp/evil\n`);
    try {
      expect(layout()).toBe("GIT_LAYOUT");
    } finally {
      writeFileSync(config, original);
    }
  });

  test("AV-023 hook file in the ODB → GIT_LAYOUT", () => {
    withFile("hooks/pre-receive", "#!/bin/sh\n", () => expect(layout()).toBe("GIT_LAYOUT"));
  });

  test("AV-024 promisor marker → GIT_LAYOUT", () => {
    withFile("objects/pack/pack-1.promisor", "", () => expect(layout()).toBe("GIT_LAYOUT"));
  });

  test("AV-025 replace ref → GIT_LAYOUT (isolated assertion for mutant A1); object reads still see the original", () => {
    const fx = new FixtureRepo(join(root, "replace"));
    const original = fx.blob("original\n");
    const replacement = fx.blob("replacement\n");
    const tree = fx.tree({ f: { mode: "100644", oid: original } });
    fx.setRef("refs/forge/main", fx.commit(tree, []));
    fx.git("replace", original, replacement);
    expect(fx.git("cat-file", "-p", original)).toBe("replacement\n");
    const [layoutResult, read] = py([
      { fn: "bootstrap.check_layout", args: [fx.odb, fx.private, { $set: ["refs/forge/main"] }] },
      { fn: "objects.read_blob", args: [fx.store(), original] },
    ]);
    expect(outcome(layoutResult!)).toBe("GIT_LAYOUT");
    expect(read!.ok).toEqual(b("original\n"));
  });

  test("packed replace ref → GIT_LAYOUT", () => {
    withFile("packed-refs", `# pack-refs with: peeled fully-peeled sorted\n${"1".repeat(40)} refs/replace/${"2".repeat(40)}\n`, () =>
      expect(layout()).toBe("GIT_LAYOUT"),
    );
  });

  test("AV-026 objects/info/alternates → GIT_LAYOUT", () => {
    withFile("objects/info/alternates", "/tmp\n", () => expect(layout()).toBe("GIT_LAYOUT"));
  });

  test("AV-027 info/grafts → GIT_LAYOUT", () => {
    withFile("info/grafts", `${"1".repeat(40)}\n`, () => expect(layout()).toBe("GIT_LAYOUT"));
  });

  test("AV-028 shallow file → GIT_LAYOUT", () => {
    withFile("shallow", `${"1".repeat(40)}\n`, () => expect(layout()).toBe("GIT_LAYOUT"));
  });

  test("unexpected ref outside the allowlist → GIT_LAYOUT", () => {
    withFile("refs/heads/other", `${"1".repeat(40)}\n`, () => expect(layout()).toBe("GIT_LAYOUT"));
  });
});

describe("bounded processes", () => {
  test("AV-013 deadline → EXECUTION_TIMEOUT and the whole process group is gone", () => {
    const pidFile = join(root, "child.pid");
    const r = py1("process.run_bounded", [["/bin/sh", "-c", `sleep 30 & echo $! > ${pidFile}; wait`], { PATH: "/usr/bin:/bin" }], { deadline_seconds: 0.5 });
    expect(outcome(r)).toBe("EXECUTION_TIMEOUT");
    const pid = readFileSync(pidFile, "utf8").trim();
    const stat = existsSync(`/proc/${pid}/stat`) ? readFileSync(`/proc/${pid}/stat`, "utf8") : "";
    expect(stat === "" || stat.split(" ")[2] === "Z").toBe(true);
  });

  test("diagnostic output over budget → EXECUTION_IO", () => {
    const r = py1("process.run_bounded", [["/bin/sh", "-c", "head -c 5000 /dev/zero"], { PATH: "/usr/bin:/bin" }], { deadline_seconds: 5, output_limit: 1000 });
    expect(outcome(r)).toBe("EXECUTION_IO");
  });

  test("normal run returns exit code and bytes", () => {
    const r = py1("process.run_bounded", [["/bin/sh", "-c", "printf ok; exit 3"], { PATH: "/usr/bin:/bin" }], { deadline_seconds: 5 });
    expect(r.ok).toEqual({ returncode: 3, stdout: b("ok"), stderr: b("") });
  });
});

describe("stage 0 kernel", () => {
  const files = { "tools/forge_v01/main.py": STUB_MAIN, "tools/forge_v01/helper.py": STUB_HELPER };

  test("loads and runs only the manifest-listed BASE verifier → PASS", () => {
    const { repo, base: b0 } = remoteWithBase({ ...baseSpec(files), other: "not listed\n" });
    const r = stage0(repo, b0);
    expect(outcome(r)).toBe("PASS");
    const ok = r.ok as { returncode: number; stdout: string; loaded: { files: string[][]; root: string } };
    expect(ok.returncode).toBe(0);
    expect(ok.stdout).toBe("stub ok 42 True\n");
    expect(ok.loaded.files.map((f) => f[0])).toEqual(["tools/forge_v01/main.py", "tools/forge_v01/helper.py"]);
    expect(existsSync(join(ok.loaded.root, "other"))).toBe(false);
  });

  test("AV-185 main.py only in HEAD, not in BASE → POLICY_INVALID", () => {
    const listed = [{ path: "tools/forge_v01/main.py", sha256: sha256(STUB_MAIN) }];
    const { repo, base: b0 } = remoteWithBase(baseSpec({ "tools/forge_v01/helper.py": STUB_HELPER }, listed));
    expect(outcome(stage0(repo, b0))).toBe("POLICY_INVALID");
  });

  test("AV-185 import of a module not listed in the manifest → POLICY_INVALID", () => {
    const listed = [{ path: "tools/forge_v01/main.py", sha256: sha256(STUB_MAIN) }];
    const { repo, base: b0 } = remoteWithBase(baseSpec(files, listed));
    expect(outcome(stage0(repo, b0))).toBe("POLICY_INVALID");
  });

  test("AV-185 manifest without main.py, missing manifest, hash mismatch, disallowed path → POLICY_INVALID", () => {
    const noMain = remoteWithBase(baseSpec(files, [{ path: "tools/forge_v01/helper.py", sha256: sha256(STUB_HELPER) }]));
    expect(outcome(stage0(noMain.repo, noMain.base))).toBe("POLICY_INVALID");
    const noManifest = remoteWithBase({ tools: { forge_v01: { "main.py": STUB_MAIN } } });
    expect(outcome(stage0(noManifest.repo, noManifest.base))).toBe("POLICY_INVALID");
    const wrongHash = remoteWithBase(baseSpec(files, [{ path: "tools/forge_v01/main.py", sha256: sha256("x") }, { path: "tools/forge_v01/helper.py", sha256: sha256(STUB_HELPER) }]));
    expect(outcome(stage0(wrongHash.repo, wrongHash.base))).toBe("POLICY_INVALID");
    const badPath = remoteWithBase(baseSpec({ ...files, "src/a.ts": "x\n" }));
    expect(outcome(stage0(badPath.repo, badPath.base))).toBe("POLICY_INVALID");
  });

  test("relative import in a listed module → POLICY_INVALID", () => {
    const main = "from . import helper\n";
    const { repo, base: b0 } = remoteWithBase(baseSpec({ ...files, "tools/forge_v01/main.py": main }));
    expect(outcome(stage0(repo, b0))).toBe("POLICY_INVALID");
  });
});
