import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";

// Shared helpers for the FORGE-BOOTSTRAP-0001A tests: the Python driver and real git fixtures.
// Everything stays under one private temp dir per test file, no network, small budgets.

const HERE = dirname(fileURLToPath(import.meta.url));
export const DRIVER = join(HERE, "driver.py");
export const PYTHON = process.env["FORGE_PYTHON"] ?? "python3";
export const GIT = "/usr/bin/git";

export type Call = { fn: string; args?: unknown[]; kwargs?: Record<string, unknown> };
export type Response = { ok?: unknown; fail?: { code: string; phase: string }; error?: string };

/** Runs all calls in one driver process and returns one response per call. */
export function py(calls: Call[], env?: NodeJS.ProcessEnv): Response[] {
  const input = calls.map((c) => JSON.stringify(c)).join("\n") + "\n";
  const result = spawnSync(PYTHON, ["-I", DRIVER], { input, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...(env ? { env } : {}) });
  if (result.status !== 0) throw new Error(`driver exited ${result.status}: ${result.stderr}`);
  const lines = result.stdout.trim().split("\n").filter((l) => l.length > 0);
  if (lines.length !== calls.length) throw new Error(`driver answered ${lines.length}/${calls.length}: ${result.stderr}`);
  return lines.map((l) => JSON.parse(l) as Response);
}

export function py1(fn: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}): Response {
  return py([{ fn, args, kwargs }])[0]!;
}

/** Outcome as a short string: "PASS" or the failure code (or "ERROR:<type>"). */
export function outcome(r: Response): string {
  if (r.fail) return r.fail.code;
  if (r.error) return `ERROR:${r.error}`;
  return "PASS";
}

export const b = (data: Uint8Array | string): { $b: string } =>
  ({ $b: Buffer.from(typeof data === "string" ? Buffer.from(data, "latin1") : data).toString("hex") });

export function tempRoot(prefix: string): string {
  return mkdtempSync(join(tmpdir(), `forge-v01-${prefix}-`));
}

export function removeTree(path: string): void {
  rmSync(path, { recursive: true, force: true });
}

/** Env for fixture-building git calls: no user/system config, fixed identity and dates. */
export function fixtureEnv(home: string): NodeJS.ProcessEnv {
  return {
    PATH: "/usr/bin:/bin",
    HOME: home,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_AUTHOR_NAME: "fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.invalid",
    GIT_COMMITTER_NAME: "fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.invalid",
    GIT_AUTHOR_DATE: "1700000000 +0000",
    GIT_COMMITTER_DATE: "1700000000 +0000",
    LANG: "C",
    LC_ALL: "C",
  };
}

/** A real bare repository used as fixture ODB; objects are written raw so malformed ones are possible. */
export class FixtureRepo {
  readonly odb: string;
  readonly private: string;
  private readonly env: NodeJS.ProcessEnv;

  constructor(readonly root: string) {
    this.odb = join(root, "odb.git");
    this.private = join(root, "private");
    mkdirSync(join(this.private, "empty-template"), { recursive: true });
    this.env = fixtureEnv(this.private);
    // Empty template: no sample hooks or other files a fresh verifier ODB would not have either.
    execFileSync(GIT, ["init", "--bare", "--quiet", "--object-format=sha1", `--template=${join(this.private, "empty-template")}`, this.odb], { env: this.env });
  }

  git(...args: string[]): string {
    return execFileSync(GIT, ["-C", this.odb, ...args], { env: this.env, encoding: "latin1", maxBuffer: 256 * 1024 * 1024 });
  }

  /** Writes a loose object with exactly these raw bytes (no validation) and returns its OID. */
  writeRaw(type: string, body: Uint8Array): string {
    const header = Buffer.from(`${type} ${body.length}\0`, "latin1");
    const full = Buffer.concat([header, Buffer.from(body)]);
    const oid = createHash("sha1").update(full).digest("hex");
    const dir = join(this.odb, "objects", oid.slice(0, 2));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, oid.slice(2)), deflateSync(full));
    return oid;
  }

  blob(content: string | Uint8Array): string {
    return this.writeRaw("blob", typeof content === "string" ? Buffer.from(content, "utf8") : content);
  }

  /** Raw tree from entries in the given order (callers sort; tests may deliberately not). */
  rawTree(entries: { mode: string; name: string | Uint8Array; oid: string }[]): string {
    const parts = entries.map((e) =>
      Buffer.concat([
        Buffer.from(`${e.mode} `, "latin1"),
        typeof e.name === "string" ? Buffer.from(e.name, "latin1") : Buffer.from(e.name),
        Buffer.from([0]),
        Buffer.from(e.oid, "hex"),
      ]),
    );
    return this.writeRaw("tree", Buffer.concat(parts));
  }

  /** Tree in git order from a nested description: string leaves are 100644 blobs. */
  tree(spec: TreeSpec): string {
    const entries = Object.entries(spec).map(([name, value]) => {
      if (typeof value === "string") return { mode: "100644", name, oid: this.blob(value) };
      if ("mode" in value && "oid" in value) return { mode: value.mode as string, name, oid: value.oid as string };
      return { mode: "40000", name, oid: this.tree(value as TreeSpec) };
    });
    entries.sort((x, y) => Buffer.compare(sortKey(x.name, x.mode), sortKey(y.name, y.mode)));
    return this.rawTree(entries);
  }

  commit(tree: string, parents: string[], message = "fixture"): string {
    const lines = [`tree ${tree}`, ...parents.map((p) => `parent ${p}`)];
    lines.push("author fixture <fixture@example.invalid> 1700000000 +0000");
    lines.push("committer fixture <fixture@example.invalid> 1700000000 +0000");
    return this.writeRaw("commit", Buffer.from(`${lines.join("\n")}\n\n${message}\n`, "latin1"));
  }

  /** Linear chain of `count` commits on top of `parent`, each changing file `f<i>`. */
  chain(parent: string, baseSpec: TreeSpec, count: number): string[] {
    const out: string[] = [];
    let current = parent;
    for (let i = 0; i < count; i++) {
      current = this.commit(this.tree({ ...baseSpec, [`c${i}.txt`]: `${i}` }), [current], `c${i}`);
      out.push(current);
    }
    return out;
  }

  setRef(ref: string, oid: string): void {
    this.git("update-ref", ref, oid);
  }

  store(extra: Record<string, unknown> = {}): { $store: Record<string, unknown> } {
    return { $store: { odb: this.odb, private: this.private, ...extra } };
  }
}

export type TreeSpec = { [name: string]: string | TreeSpec | { mode: string; oid: string } };

function sortKey(name: string, mode: string): Buffer {
  return Buffer.from(mode === "40000" ? `${name}/` : name, "latin1");
}

export function runOk(argv: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): string {
  return execFileSync(argv[0]!, argv.slice(1), { encoding: "utf8", ...opts });
}
