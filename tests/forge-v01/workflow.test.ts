import { describe, expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PYTHON, b, outcome, py } from "./helpers.ts";

// FORGE-BOOTSTRAP-0001C workflow shape (contract C §7, PKG §2 "Workflowkonfiguration fest"),
// verifier data files, main.py import graph and argv handling. No network, no Docker.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TOOLS = join(ROOT, "tools", "forge_v01");
const WORKFLOW_TEXT = readFileSync(join(ROOT, ".github", "workflows", "forge-v01.yml"), "utf8");
const IMAGE_MARKER = "forge-v01-image@sha256:UNRESOLVED-IMAGE-DIGEST-NOT-ESTABLISHED";

// ---------------------------------------------------------------- fixed-shape YAML subset parser
// Handles exactly what the workflow uses: block mappings, block lists of mappings, `|` block
// scalars, flow lists `[a, b]`, `{}` and plain or single-quoted scalars. Anything else throws.

type Y = string | number | Y[] | { [key: string]: Y };

function scalar(text: string): Y {
  if (text === "{}") return {};
  if (text.startsWith("[") && text.endsWith("]")) return text.slice(1, -1).split(",").map((s) => s.trim());
  if (/^\d+$/.test(text)) return Number(text);
  if (text.startsWith("'") && text.endsWith("'")) return text.slice(1, -1);
  if (/^[{["&*!|>%@`]/.test(text)) throw new Error(`unsupported scalar: ${text}`);
  return text;
}

function parseYaml(text: string): Y {
  const raw = text.split("\n");
  const indentOf = (line: string) => line.length - line.trimStart().length;
  let i = 0;
  const skip = () => { while (i < raw.length && (raw[i]!.trim() === "" || raw[i]!.trim().startsWith("#"))) i++; };
  function block(indent: number): Y {
    skip();
    if (raw[i]!.trim().startsWith("- ")) {
      const list: Y[] = [];
      while (i < raw.length && indentOf(raw[i]!) === indent && raw[i]!.trim().startsWith("- ")) {
        raw[i] = " ".repeat(indent + 2) + raw[i]!.trim().slice(2); // "- key: v" opens a mapping at indent + 2
        list.push(block(indent + 2));
        skip();
      }
      return list;
    }
    const map: { [key: string]: Y } = {};
    while (i < raw.length && indentOf(raw[i]!) === indent) {
      const m = /^([A-Za-z0-9_-]+):(?: (.*))?$/.exec(raw[i]!.trim());
      if (!m) throw new Error(`bad line: ${raw[i]}`);
      if (m[1]! in map) throw new Error(`duplicate key ${m[1]}`);
      i++;
      if (m[2] === "|") {
        const body: string[] = [];
        while (i < raw.length && (raw[i]!.trim() === "" || indentOf(raw[i]!) > indent)) body.push(raw[i++]!);
        const own = Math.min(...body.filter((l) => l.trim() !== "").map(indentOf));
        map[m[1]!] = body.map((l) => l.slice(own)).join("\n").trimEnd() + "\n";
      } else {
        map[m[1]!] = m[2] === undefined ? (skip(), block(indentOf(raw[i]!))) : scalar(m[2]);
      }
      skip();
    }
    if (i < raw.length && indentOf(raw[i]!) > indent) throw new Error(`bad indentation: ${raw[i]}`);
    return map;
  }
  const out = block(0);
  if (i !== raw.length) throw new Error("trailing content");
  return out;
}

const asMap = (v: Y | undefined): { [key: string]: Y } => {
  if (v === undefined || typeof v !== "object" || Array.isArray(v)) throw new Error("not a mapping");
  return v;
};
const asList = (v: Y | undefined): Y[] => {
  if (!Array.isArray(v)) throw new Error("not a list");
  return v;
};

const WF = asMap(parseYaml(WORKFLOW_TEXT));
const JOBS = asMap(WF["jobs"]);
const steps = (job: string) => asList(asMap(JOBS[job])["steps"]).map(asMap);
const runs = () => Object.keys(JOBS).flatMap((job) => steps(job).map((s) => s["run"]).filter((r): r is string => typeof r === "string"));

describe("workflow shape (contract C §7)", () => {
  test("name, trigger, branches and permissions are exactly fixed", () => {
    expect(Object.keys(WF)).toEqual(["name", "on", "permissions", "jobs"]);
    expect(WF["name"]).toBe("Forge V0.1");
    expect(WF["on"]).toEqual({ pull_request_target: { types: ["opened", "reopened", "synchronize", "ready_for_review"], branches: ["main"] } });
    expect(WF["permissions"]).toEqual({});
  });

  test("exactly two jobs, no matrix, no concurrency, timeout 20, ubuntu-24.04", () => {
    expect(Object.keys(JOBS)).toEqual(["forge-gate", "forge-verify"]);
    for (const id of ["forge-gate", "forge-verify"]) {
      const job = asMap(JOBS[id]);
      expect(job["name"]).toBe(id);
      expect(job["runs-on"]).toBe("ubuntu-24.04");
      expect(job["timeout-minutes"]).toBe(20);
      expect(job).not.toHaveProperty("strategy");
      expect(job).not.toHaveProperty("concurrency");
      expect(job).not.toHaveProperty("permissions");
      expect(job).not.toHaveProperty("container");
    }
    expect(WORKFLOW_TEXT).not.toMatch(/^\s*(concurrency|strategy|matrix|cancel-in-progress)\s*:/m);
  });

  test("no checkout, cache, artifact, action or HEAD step", () => {
    for (const id of Object.keys(JOBS)) for (const step of steps(id)) {
      expect(Object.keys(step).every((k) => ["name", "id", "if", "env", "run"].includes(k))).toBe(true);
      expect(step).not.toHaveProperty("uses");
    }
    expect(WORKFLOW_TEXT).not.toMatch(/uses:|actions\/checkout|actions\/cache|download-artifact|upload-artifact/);
    expect(WORKFLOW_TEXT).not.toMatch(/head_ref|head\.sha|head\.ref|refs\/pull|github\.event\b/);
  });

  test("no expressions in shell code; only the fixed job-output expressions exist", () => {
    for (const script of runs()) expect(script).not.toContain("${{");
    const expressions = WORKFLOW_TEXT.match(/\$\{\{[^}]*\}\}/g) ?? [];
    expect(expressions).toEqual(["${{ steps.stage.outputs.receipt }}", "${{ needs.forge-gate.outputs.receipt }}"]);
  });

  test("first step of each job fails closed: image digest and deployment gates not established", () => {
    for (const id of Object.keys(JOBS)) {
      const first = steps(id)[0]!;
      expect(first["name"]).toBe("Deployment gates not established");
      expect(first).not.toHaveProperty("if");
      expect(first["run"]).toMatch(/image digest and deployment gates are not established/);
      expect(String(first["run"]).trimEnd().endsWith("exit 1")).toBe(true);
    }
  });

  test("image is a non-pullable marker, never a mutable tag or invented digest", () => {
    for (const id of Object.keys(JOBS)) expect(asMap(asMap(JOBS[id])["env"])["FORGE_IMAGE"]).toBe(IMAGE_MARKER);
    expect(IMAGE_MARKER).not.toMatch(/@sha256:[0-9a-f]{64}$/);
    expect(WORKFLOW_TEXT).not.toMatch(/:latest|sha256:[0-9a-f]{64}/);
  });

  test("forge-verify: always() with an explicit red path before the trusted host step", () => {
    const verify = asMap(JOBS["forge-verify"]);
    expect(verify["needs"]).toBe("forge-gate");
    expect(verify["if"]).toBe("always()");
    const s = steps("forge-verify");
    expect(s.map((x) => x["name"])).toEqual(["Deployment gates not established", "Gate did not succeed", "Stage 0, gate and Stage 2 (trusted host)"]);
    expect(s[1]!["if"]).toBe("needs.forge-gate.result != 'success'");
    expect(String(s[1]!["run"]).trimEnd().endsWith("exit 1")).toBe(true);
    expect(s[2]).not.toHaveProperty("if");
    expect(String(s[2]!["run"])).toMatch(/record\.get\("outcome"\) == "PASS" and record\.get\("policyAssurance"\) == "owner_attested"/);
  });

  test("only the forge-gate trusted host writes the bounded receipt to GITHUB_OUTPUT", () => {
    const gate = asMap(JOBS["forge-gate"]);
    expect(gate["outputs"]).toEqual({ receipt: "${{ steps.stage.outputs.receipt }}" });
    const writers = Object.keys(JOBS).flatMap((id) => steps(id).filter((s) => String(s["run"] ?? "").includes("GITHUB_OUTPUT")).map((s) => [id, s["id"]]));
    expect(writers).toEqual([["forge-gate", "stage"]]);
    const script = String(steps("forge-gate")[1]!["run"]);
    expect(script).toMatch(/raw = handle\.read\(4097\)/);
    expect(script).toMatch(/len\(receipt\) > 1024/);
    expect(script).toMatch(/record\.get\("outcome"\) == "GATE_PASS"/);
  });

  test("host passes only runner facts and the event file; docker socket only in forge-verify", () => {
    const [gate, verify] = [String(steps("forge-gate")[1]!["run"]), String(steps("forge-verify")[2]!["run"])];
    for (const script of [gate, verify]) {
      expect(script).toMatch(/cp "\$GITHUB_EVENT_PATH" "\$ws\/event\.json"/);
      expect(script).toMatch(/mktemp -d "\$RUNNER_TEMP\/forge\.XXXXXXXX"/);
      expect(script).not.toMatch(/GITHUB_TOKEN|ACTIONS_RUNTIME_TOKEN|\.netrc|ssh/i);
    }
    expect(gate).not.toContain("docker.sock");
    expect(verify).toContain("type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock");
  });

  test("the subset parser rejects shapes it does not know", () => {
    expect(() => parseYaml("a: &x 1\n")).toThrow();
    expect(() => parseYaml("a: 1\na: 2\n")).toThrow();
  });
});

// ---------------------------------------------------------------- data files and main.py

const read = (path: string) => b(readFileSync(join(ROOT, path)));

describe("verifier data files and main.py", () => {
  test("policy.json and the example plan parse with policy.py; taskIndex empty, deployment inactive", () => {
    const [pol, plan] = py([
      { fn: "policy.parse_policy", args: [read("forge/verifier/policy.json")] },
      { fn: "policy.parse_plan", args: [read("forge/verifier/clamp-plan.example.json")] },
    ]);
    expect(outcome(pol!)).toBe("PASS");
    const p = pol!.ok as Record<string, unknown>;
    expect(p["taskIndex"]).toEqual([]);
    expect(p["imageDigest"]).toBe(`sha256:${"0".repeat(64)}`);
    expect(p["deploymentPolicyDigest"]).toBe("0".repeat(64));
    expect(outcome(plan!)).toBe("PASS");
    const q = plan!.ok as { profile: string; mutants: { id: string; namedTests: unknown[][] }[] };
    expect(q.profile).toBe("DEV");
    expect(q.mutants.map((m) => m.id)).toEqual(["return-n"]);
    expect(q.mutants[0]!.namedTests[0]![0]).toBe("tests/forge-v01/clamp-at-zero.test.ts");
  });

  test("the example plan is unregistered and its mutant anchor is the ternary drill form", () => {
    const plan = JSON.parse(readFileSync(join(ROOT, "forge/verifier/clamp-plan.example.json"), "utf8"));
    expect(Buffer.from(plan.mutants[0].anchorBase64, "base64").toString()).toBe("return n < 0 ? 0 : n;");
    expect(Buffer.from(plan.mutants[0].replacementBase64, "base64").toString()).toBe("return n;");
    const seed = readFileSync(join(ROOT, "src/forge-drill/clamp-at-zero.ts"), "utf8");
    expect(seed).toContain("if (n < 0) {");
    expect(seed).not.toContain("?");
  });

  test("image-inputs.json marks every unknown value null and contains no invented hash", () => {
    const text = readFileSync(join(ROOT, "forge/verifier/image-inputs.json"), "utf8");
    const inputs = JSON.parse(text);
    expect(inputs.status).toBe("unresolved");
    expect(inputs.kernel.commit).toBeNull();
    expect(inputs.output.ociDigest).toBeNull();
    // Only pins checked against the vendor's own published value are filled: the Docker Hub index digest of
    // ubuntu:24.04, nodejs.org SHASUMS256.txt, and npm tarballs whose registry sha512 integrity matched.
    // python.org / kernel.org were not reachable and download.docker.com publishes no checksum: still null.
    const verified = {
      ubuntu: "sha256:534baea6a22c03a63003dbc8dbe78fe34bc0d7e595d9a9dc9834884ff530eb55",
      node: "14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647",
      npm: "5a172e3228e59d44cb9f44d5e83977178323bba3cc506016cae8e40b92ad418f",
      zod: "a78c0c533de30dc1c4afc259ac43ac06e390cb0da8d2e32eae355301b50b36fc",
    };
    expect(inputs.baseImage.digest).toBe(verified.ubuntu);
    expect(inputs.aptSnapshot.id).toBe("20261001T000000Z");
    for (const name of ["node", "npm", "zod"] as const) expect(inputs.tools[name].sha256).toBe(verified[name]);
    for (const name of ["python", "git", "dockerCli"]) expect(inputs.tools[name].sha256).toBeNull();
    expect(inputs.tools.dockerCli.version).toBeNull();
    expect(inputs.recipe.sha256).toBeNull();
    const known = new Set(Object.values(verified).map((v) => v.replace("sha256:", "")));
    expect((text.match(/[0-9a-f]{64}/g) ?? []).filter((h) => !known.has(h))).toEqual([]);
    expect(Object.fromEntries(["python", "git", "node", "npm", "zod"].map((n) => [n, inputs.tools[n].version])))
      .toEqual({ python: "3.12.14", git: "2.51.1", node: "24.19.0", npm: "11.9.0", zod: "4.6.5" });
    const lock = JSON.parse(readFileSync(join(ROOT, "package-lock.json"), "utf8"));
    expect(inputs.tools.zod.lockIntegrity).toBe(lock.packages["node_modules/zod"].integrity);
  });

  test("Dockerfile: no defaulted ARG, digest-pinned base, checksum-verified archives, A kernel entry", () => {
    const text = readFileSync(join(TOOLS, "Dockerfile"), "utf8");
    expect(text).not.toMatch(/^ARG \w+=/m);
    expect(text).toMatch(/^FROM docker\.io\/library\/ubuntu@\$\{UBUNTU_DIGEST\} AS build$/m);
    expect(text).not.toMatch(/apt-get install(?![^\n]*--snapshot)/);
    expect((text.match(/sha256sum -c --strict/g) ?? []).length).toBe(1);
    expect((text.match(/^ && fetch /gm) ?? []).length).toBe(6);
    expect(text).toMatch(/COPY stage0\.py errors\.py process\.py paths\.py objects\.py materialize\.py odb_layout\.py bootstrap\.py \/opt\/forge\/bootstrap\//);
    expect(text).toMatch(/^RUN ln -s \/trusted\/node_modules \/node_modules$/m); // parser "zod" → image Zod only
    expect(text).toMatch(/^ENTRYPOINT \["\/opt\/python\/bin\/python3\.12", "-I", "-B", "\/opt\/forge\/bootstrap\/stage0\.py"\]$/m);
  });

  test("stage0.py imports its siblings under python -I -B from a foreign cwd (image entrypoint)", () => {
    const dir = mkdtempSync(join(tmpdir(), "forge-stage0-"));
    try {
      // exactly the files the Dockerfile copies into /opt/forge/bootstrap, so a missing module fails here
      const copy = /^COPY ((?:\S+\.py )+)\/opt\/forge\/bootstrap\/$/m.exec(readFileSync(join(TOOLS, "Dockerfile"), "utf8"));
      expect(copy).not.toBeNull();
      for (const name of copy![1]!.trim().split(" ")) writeFileSync(join(dir, name), readFileSync(join(TOOLS, name)));
      const run = spawnSync(PYTHON, ["-I", "-B", join(dir, "stage0.py")], { cwd: tmpdir(), encoding: "utf8" });
      expect(run.stderr).toBe("");
      expect(run.status).toBe(1); // bad argv, but no ModuleNotFoundError
      expect(readdirSync(dir).filter((n) => n === "__pycache__")).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("bootstrap-manifest.json lists every verifier file with its current SHA-256 and passes stage0", () => {
    const raw = readFileSync(join(ROOT, "forge", "verifier", "bootstrap-manifest.json"));
    const manifest = JSON.parse(raw.toString("utf8")) as { files: { path: string; sha256: string }[] };
    const listed = manifest.files.map((f) => f.path);
    const verifier = readdirSync(TOOLS).filter((n) => /\.(py|mjs)$/.test(n)).map((n) => `tools/forge_v01/${n}`);
    expect([...listed].filter((p) => p.startsWith("tools/")).sort()).toEqual([...verifier].sort());
    for (const f of manifest.files) expect(createHash("sha256").update(readFileSync(join(ROOT, f.path))).digest("hex"), f.path).toBe(f.sha256);
    expect(outcome(py([{ fn: "stage0.parse_manifest", args: [b(raw)] }])[0]!)).toBe("PASS");
  });

  test("main.py and all verifier modules pass stage0.check_imports", () => {
    const sources: Record<string, { $b: string }> = {};
    for (const name of readdirSync(TOOLS).filter((n) => n.endsWith(".py"))) sources[`tools/forge_v01/${name}`] = b(readFileSync(join(TOOLS, name)));
    expect(Object.keys(sources)).toContain("tools/forge_v01/main.py");
    const [ok, bad] = py([
      { fn: "stage0.check_imports", args: [sources] },
      { fn: "stage0.check_imports", args: [{ ...sources, "tools/forge_v01/main.py": b("import yaml\n") }] },
    ]);
    expect(outcome(ok!)).toBe("PASS");
    expect(outcome(bad!)).toBe("POLICY_INVALID");
  });

  test("main.py: bad argv or bad facts exit 1 with one fixed record and leave no files", () => {
    const tmp = mkdtempSync(join(tmpdir(), "forge-v01-main-"));
    try {
      writeFileSync(join(tmp, "event.json"), "{}");
      writeFileSync(join(tmp, "facts.json"), JSON.stringify({ job: "forge-deploy" }));
      const good = ["--bootstrap-version=1", `--base=${"a".repeat(40)}`, `--manifest-sha256=${"b".repeat(64)}`,
        "--event", join(tmp, "event.json"), "--facts", join(tmp, "facts.json"), "--workspace", tmp];
      const run = (argv: string[]) => spawnSync(PYTHON, ["-I", join(TOOLS, "main.py"), ...argv], { encoding: "utf8", cwd: tmp, env: { PATH: "/usr/bin:/bin" } });
      const fixed = (code: string) => `{"code":"${code}","format":1,"ordinal":null,"outcome":"FAIL","phase":"gate","reason":0,"subjectHash":null}\n`;
      for (const argv of [[], ["gate"], good.slice(0, 8), [...good.slice(0, 1), "--base=HEAD", ...good.slice(2)], ["--bootstrap-version=2", ...good.slice(1)]]) {
        const r = run(argv);
        expect([r.status, r.stdout, r.stderr]).toEqual([1, fixed("EXECUTION_INTERNAL"), ""]);
      }
      const r = run(good);
      expect([r.status, r.stdout, r.stderr]).toEqual([1, fixed("PR_INPUT"), ""]);
      expect(readdirSync(tmp).sort()).toEqual(["event.json", "facts.json"]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
    expect(readdirSync(TOOLS).filter((n) => n === "__pycache__")).toEqual([]);
  });
});

// ---------------------------------------------------------------- property family: main.parse_argv

function xorshift32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s;
  };
}

/** Independent oracle for the fixed stage0 → main argv. */
function argvValid(argv: string[]): boolean {
  if (argv.length !== 9) return false;
  if (argv[0] !== "--bootstrap-version=1") return false;
  if (!/^--base=[0-9a-f]{40}$/.test(argv[1]!) || !/^--manifest-sha256=[0-9a-f]{64}$/.test(argv[2]!)) return false;
  if (argv[3] !== "--event" || argv[5] !== "--facts" || argv[7] !== "--workspace") return false;
  return [argv[4]!, argv[6]!, argv[8]!].every((p) => p.startsWith("/") && !p.includes("\0"));
}

describe("property: main.parse_argv agrees with the argv oracle", () => {
  test("10,000 deterministic cases (xorshift32 seed 1042026) in one batch", () => {
    const next = xorshift32(1042026);
    const pick = <T,>(xs: T[]): T => xs[next() % xs.length]!;
    const hex = (n: number) => Array.from({ length: n }, () => "0123456789abcdef"[next() % 16]).join("");
    const base = () => ["--bootstrap-version=1", `--base=${hex(40)}`, `--manifest-sha256=${hex(64)}`,
      "--event", "/w/event.json", "--facts", "/w/facts.json", "--workspace", "/w/ws"];
    const tokens = ["--event", "--facts", "--workspace", "gate", "verify", "", "relative/path", "/abs", "--base=", `--base=${"A".repeat(40)}`,
      "--bootstrap-version=01", "--bootstrap-version= 1", "/x\0y", "--manifest-sha256=", "-", "/w/ws/"];
    const cases: string[][] = [];
    for (let k = 0; k < 10_000; k++) {
      const argv = base();
      const edits = next() % 4; // 0 edits keeps a valid case (about a quarter of the family)
      for (let e = 0; e < edits; e++) {
        const at = next() % argv.length;
        switch (next() % 7) {
          case 0: argv[at] = pick(tokens); break;
          case 1: argv.splice(at, 1); break;
          case 2: argv.splice(at, 0, pick(tokens)); break;
          case 3: argv[1] = `--base=${hex(pick([39, 40, 41, 64]))}`; break;
          case 4: argv[2] = `--manifest-sha256=${hex(pick([40, 63, 64, 65]))}`; break;
          case 5: { const j = next() % argv.length; [argv[at], argv[j]] = [argv[j]!, argv[at]!]; break; }
          default: argv[at] = argv[at]!.toUpperCase();
        }
      }
      cases.push(argv);
    }
    const answers = py(cases.map((argv) => ({ fn: "main.parse_argv", args: [argv] })));
    let valid = 0;
    answers.forEach((r, k) => {
      const expected = argvValid(cases[k]!);
      valid += expected ? 1 : 0;
      expect(outcome(r)).toBe(expected ? "PASS" : "EXECUTION_INTERNAL");
      if (expected) expect(r.ok).toEqual({ base: cases[k]![1]!.slice(7), manifest: cases[k]![2]!.slice(18), event: cases[k]![4], facts: cases[k]![6], workspace: cases[k]![8] });
    });
    expect(valid).toBeGreaterThan(1500);
    expect(valid).toBeLessThan(10_000);
  });
});
