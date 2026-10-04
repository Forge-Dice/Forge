import { beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { outcome, py, type Call, type Response } from "./helpers.ts";

// PKG §14 / contract B §11 Scope property family for FORGE-BOOTSTRAP-0001B, >= 10,000
// deterministic iterations (xorshift32, seed 1042026). ONE py() batch drives scope.check_scope_rows;
// the TypeScript oracle below is written from the PKG §4 text (phases 6-8, exact path classes) and
// contract B §7, not ported from scope.py. Inventory and Mutation families live in their own files.

const SEED = 1042026;
const ITERATIONS = 10_000;

class XorShift32 {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    this.state = x;
    return x;
  }
  int(n: number): number {
    return this.next() % n;
  }
  chance(p: number): boolean {
    return this.next() / 0x1_0000_0000 < p;
  }
  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)]!;
  }
  subset<T>(items: readonly T[], p: number): T[] {
    return items.filter(() => this.chance(p));
  }
}

type Row = [path: string, mode: string, oid: string];
type Profile = "DEV" | "OWNER_OPS";
type Input = {
  base: Row[];
  snapshots: Row[][]; // oldest first
  plan: { addedTestFiles: string[]; approvedTcbPaths: string[] };
  scope: { create: string[]; modify: string[] };
  profile: Profile;
};

const CONTRACT = "forge/contracts/T-1.md";
// No path is a directory prefix of another, so every generated snapshot is collision free.
const UNIVERSE = [
  "src/a.ts", "src/a.ts-x.ts", "src/b.ts", "src/c.ts", "src/x.test.ts", "src/forge/k.ts", "src/vite.config.ts", "src/.env.x",
  "src/run.sh", "tests/a.test.ts", "tests/new.test.ts", "tests/n2.test.ts", "tests/fix.json", "package.json", "tsconfig.json",
  "package-lock.json", ".github/w.yml", "forge/coordination/CODEX.md", CONTRACT, "forge/contracts/OTHER.md", "tools/forge_v01/m.py",
  "tools/forge_v01/vitest.config.mjs", "docs/r.md",
] as const;
const OIDS = ["1", "2", "3", "4"].map((c) => c.repeat(40));
const MODES = ["100644", "100644", "100644", "100755", "120000", "160000", "100600"];

function genInput(r: XorShift32): Input {
  const scoped = r.subset(UNIVERSE.filter((p) => p !== CONTRACT), 0.3);
  const create: string[] = [];
  const modify: string[] = [];
  for (const p of scoped) (r.chance(0.5) ? create : modify).push(p);
  const profile: Profile = r.chance(0.3) ? "OWNER_OPS" : "DEV";
  const addedTestFiles = create.filter((p) => p.startsWith("tests/") && r.chance(0.7));
  const approvedTcbPaths =
    profile === "OWNER_OPS" ? scoped.filter((p) => /^(src\/forge|tools\/forge_v01|\.github|forge\/contracts)\//.test(p) && r.chance(0.7)) : [];
  // A third of the inputs only touch scoped paths with plain content edits (mostly PASS cases).
  const tame = r.chance(0.35) && scoped.length > 0;
  const base: Row[] = r.subset(UNIVERSE, 0.45).map((p) => [p, r.chance(0.12) ? "100755" : "100644", r.pick(OIDS)]);
  // Paths a tame input edits: scoped, kind matching BASE presence, plausible class for the profile.
  const inBase = new Set(base.map((row) => row[0]));
  const editable = scoped.filter(
    (p) =>
      (create.includes(p) ? !inBase.has(p) : inBase.has(p)) &&
      (addedTestFiles.includes(p) || approvedTcbPaths.includes(p) || (profile === "DEV" && /^src\/[a-z]+\.ts$/.test(p))),
  );
  const snapshots: Row[][] = [];
  let current = new Map(base.map((row) => [row[0], row] as const));
  const steps = 1 + r.int(3);
  for (let s = 0; s < steps; s++) {
    const next = new Map(current);
    const edits = 1 + r.int(3);
    for (let e = 0; e < edits; e++) {
      const path = tame && editable.length > 0 ? r.pick(editable) : r.pick(UNIVERSE);
      const old = next.get(path);
      const kind = tame ? 9 : r.int(10);
      if (old && kind === 0) next.delete(path);
      else if (old && kind === 1) next.set(path, [path, old[1] === "100644" ? "100755" : "100644", old[2]]);
      else if (old && kind === 2) next.set(path, [path, r.pick(MODES), r.pick(OIDS)]);
      else if (old) next.set(path, [path, old[1], OIDS[(OIDS.indexOf(old[2]) + 1) % OIDS.length]!]);
      else next.set(path, [path, tame || r.chance(0.85) ? "100644" : r.pick(MODES), r.pick(OIDS)]);
    }
    if (r.chance(0.1) && snapshots.length > 0) next.clear(), base.forEach((row) => next.set(row[0], row)); // revert to BASE
    snapshots.push([...next.values()]);
    current = next;
  }
  if (r.chance(0.03)) addedTestFiles.push("tests/outside.test.ts");
  return { base, snapshots, plan: { addedTestFiles, approvedTcbPaths }, scope: { create, modify }, profile };
}

// ------------------------------------------------------------------------------- oracle

type Leaf = { mode: string; oid: string };
type Change = { path: string; kinds: string[]; head: Leaf | null };
const CODE_ORDER = ["SCOPE_PATH", "SCOPE_PROTECTED", "SCOPE_MODE"]; // §11 enum order

function diff(a: Map<string, Leaf>, b: Map<string, Leaf>): Change[] {
  const out: Change[] = [];
  for (const path of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(path);
    const y = b.get(path);
    if (!x) out.push({ path, kinds: ["ADD"], head: y! });
    else if (!y) out.push({ path, kinds: ["DELETE"], head: null });
    else {
      const kinds = [...(x.oid !== y.oid ? ["MODIFY"] : []), ...(x.mode !== y.mode ? ["MODE_CHANGE"] : [])];
      if (kinds.length) out.push({ path, kinds, head: y });
    }
  }
  return out;
}

const asMap = (rows: Row[]): Map<string, Leaf> => new Map(rows.map(([p, mode, oid]) => [p, { mode, oid }]));

/** PKG §4: frozen/protected classes for the profile (case-insensitive class names). */
function isProtected(path: string, inBase: boolean, input: Input): boolean {
  const p = path.toLowerCase();
  const name = p.split("/").at(-1)!;
  if (p === CONTRACT.toLowerCase()) return true; // the active contract, any profile
  if (p.startsWith("tests/") && inBase) return true; // existing tests and fixtures are frozen
  if (["package.json", "package-lock.json", "tsconfig.json"].includes(p)) return true;
  if ([".npmrc", ".gitattributes", ".gitmodules", ".env"].includes(name) || name.startsWith(".env.")) return true;
  const tcb = ["src/forge/", "tools/forge_v01/", ".github/", "forge/contracts/", "forge/approvals/", "forge/verifier/"].some((t) => p.startsWith(t));
  if (tcb) return !(input.profile === "OWNER_OPS" && input.plan.approvedTcbPaths.includes(path));
  return /^(vite|vitest)\.config\.|^tsconfig.*\.json$/.test(name); // tool configs
}

/** Rule rank and code for one change; null if allowed. `inBase` = present in BASE. */
function judge(c: Change, baseLeaf: Leaf | undefined, input: Input): [number, string] | null {
  if (c.kinds.includes("MODE_CHANGE")) return [0, "SCOPE_MODE"];
  if (c.head) {
    const okMode = c.head.mode === "100644" || (c.head.mode === "100755" && baseLeaf?.mode === "100755");
    if (!okMode) return [0, "SCOPE_MODE"];
  }
  if (c.kinds.includes("DELETE")) return [1, "SCOPE_PATH"];
  const inBase = baseLeaf !== undefined;
  if (isProtected(c.path, inBase, input)) return [2, "SCOPE_PROTECTED"];
  let classOk: boolean;
  if (c.path.startsWith("tests/")) classOk = !inBase && c.path.endsWith(".test.ts") && input.plan.addedTestFiles.includes(c.path);
  else if (input.profile === "OWNER_OPS") classOk = input.plan.approvedTcbPaths.includes(c.path);
  else classOk = /^src\/(?!forge\/).*\.ts$/.test(c.path) && !c.path.endsWith(".test.ts");
  if (!classOk) return [3, "SCOPE_PATH"];
  // Exact membership with the right kind: create only for BASE-absent, modify only for BASE-present.
  const allowed = inBase ? input.scope.modify : input.scope.create;
  if (!allowed.includes(c.path)) return [3, "SCOPE_PATH"];
  return null;
}

type Expected = { code: string; ordinal: number | null; subject: string | null };

function compareKeys(a: [number, number, Buffer, number], b: [number, number, Buffer, number]): number {
  return a[0] - b[0] || a[1] - b[1] || Buffer.compare(a[2], b[2]) || a[3] - b[3];
}

function oracle(input: Input): Expected {
  const created = new Set(input.scope.create);
  const all = new Set([...input.scope.create, ...input.scope.modify]);
  if (!input.plan.addedTestFiles.every((p) => created.has(p)) || !input.plan.approvedTcbPaths.every((p) => all.has(p))) {
    return { code: "CONTRACT_BINDING", ordinal: null, subject: null };
  }
  const base = asMap(input.base);
  const chain = [base, ...input.snapshots.map(asMap)];
  const diffs = chain.slice(1).map((snap, i) => diff(chain[i]!, snap));
  diffs.push(diff(base, chain.at(-1)!));
  let best: { key: [number, number, Buffer, number]; code: string } | null = null;
  diffs.forEach((changes, ordinal) => {
    for (const c of changes) {
      const v = judge(c, base.get(c.path), input);
      if (!v) continue;
      const key: [number, number, Buffer, number] = [v[0], CODE_ORDER.indexOf(v[1]), Buffer.from(c.path, "ascii"), ordinal];
      if (best === null || compareKeys(key, best.key) < 0) best = { key, code: v[1] };
    }
  });
  if (best === null) return { code: "PASS", ordinal: null, subject: null };
  const found = best as { key: [number, number, Buffer, number]; code: string };
  return { code: found.code, ordinal: found.key[3], subject: createHash("sha256").update(found.key[2]).digest("hex") };
}

// ------------------------------------------------------------------------------- property

describe("PKG §14 Scope property (seed 1042026)", () => {
  const r = new XorShift32(SEED ^ 0xb5c0);
  const inputs = Array.from({ length: ITERATIONS }, () => genInput(r));
  let results: Response[] = [];

  beforeAll(() => {
    results = py(
      inputs.map((x): Call => ({ fn: "scope.check_scope_rows", args: [x.base, x.snapshots, x.plan, x.scope, x.profile, CONTRACT] })),
    );
  });

  it(`${ITERATIONS} random histories: primary code, step ordinal and subject equal the spec oracle`, () => {
    let mismatch: string | null = null;
    for (let i = 0; i < inputs.length && mismatch === null; i++) {
      const want = oracle(inputs[i]!);
      const res = results[i]!;
      const got: Expected = { code: outcome(res), ordinal: res.fail?.["ordinal" as never] ?? null, subject: res.fail?.["subjectHash" as never] ?? null };
      if (JSON.stringify(got) !== JSON.stringify(want)) mismatch = JSON.stringify({ input: inputs[i], oracle: want, python: got });
    }
    expect(mismatch).toBeNull();
  });

  it("corpus covers PASS, every scope code, reverted intermediate violations and prefix-of-scope paths", () => {
    const codes = new Set(results.map(outcome));
    expect([...codes].sort()).toEqual(["CONTRACT_BINDING", "PASS", "SCOPE_MODE", "SCOPE_PATH", "SCOPE_PROTECTED"]);
    const counts = Object.fromEntries([...codes].map((c) => [c, results.filter((x) => outcome(x) === c).length]));
    for (const c of ["PASS", "SCOPE_MODE", "SCOPE_PATH", "SCOPE_PROTECTED"]) expect(counts[c]).toBeGreaterThan(200);
    // Some failures are decided on an intermediate step although the net diff alone is clean.
    const netLast = inputs.map((x) => x.snapshots.length);
    expect(results.some((x, i) => x.fail && (x.fail as { ordinal?: number }).ordinal! < netLast[i]!)).toBe(true);
    // B1 surface: an ADD of src/a.ts-x.ts while only src/a.ts is scoped occurs and is rejected.
    const prefixCases = inputs.filter(
      (x) => x.scope.modify.includes("src/a.ts") && !x.scope.create.includes("src/a.ts-x.ts") && x.snapshots.at(-1)!.some(([p]) => p === "src/a.ts-x.ts") && !x.base.some(([p]) => p === "src/a.ts-x.ts"),
    );
    expect(prefixCases.length).toBeGreaterThan(10);
  });
});
