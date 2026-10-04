import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { b, FixtureRepo, outcome, py, py1, removeTree, tempRoot, type Call } from "./helpers.ts";

// FORGE-BOOTSTRAP-0001B mutations.py: application, contract §6 classification table, aggregation
// (AV-126..142, AV-187), the isolated tests for verifier mutants B3/B4, the six real clampAtZero
// probes (PKG §8) with real Vitest through the TEST-ONLY worker.LocalRunner seam (no sandbox), and
// the Mutation-classification property family (>= 10,000 deterministic iterations).

const NODE_MODULES = resolve("node_modules");
const FILE = "tests/a.test.ts";
type Id = [string, string, string[], string, number];
const id = (title: string, ancestors: string[] = ["S"], file = FILE, occurrence = 0): Id => [file, "forge-v01", ancestors, title, occurrence];
const key = (v: unknown): Buffer => Buffer.from(JSON.stringify(v), "utf8");
const byKey = (x: unknown, y: unknown): number => Buffer.compare(key(x), key(y));

type Row = { id: Id; status: string; errorNames?: string[] };
/** A schema-valid report payload (sorted like the trusted reporter writes it). */
function report(rows: Row[], opts: { errors?: { kind: string; testIdentity: null }[]; reason?: string; files?: string[] } = {}) {
  const files = (opts.files ?? [...new Set(rows.map((r) => r.id[0]))]).sort().map((file) => ({ file, project: "forge-v01", collection: "ok" }));
  const tests = rows.map((r) => ({ id: r.id, status: r.status })).sort((x, y) => byKey(x.id, y.id));
  const failures = rows.filter((r) => r.status === "failed").map((r) => ({ id: r.id, errorNames: r.errorNames ?? ["AssertionError"] })).sort((x, y) => byKey(x.id, y.id));
  const reason = opts.reason ?? (failures.length ? "failed" : "passed");
  return { format: 1, inventory: { format: 1, files, tests, errors: opts.errors ?? [], reason }, failures };
}

function obs(over: Record<string, unknown>) {
  return { applied: true, timedOut: false, typecheckOk: true, exitCode: 1, selectedFiles: [FILE], namedTests: [id("named")], ...over };
}
const killedReport = () => report([{ id: id("named"), status: "failed" }, { id: id("other"), status: "passed" }]);
const classify = (o: unknown): string => py1("mutations.classify", [o]).ok as string;
const classifyAll = (os: unknown[]): unknown[] => py(os.map((o) => ({ fn: "mutations.classify", args: [o] }))).map((r) => r.ok);

describe("apply_mutant", () => {
  it("AV-132/133/128 overlapping anchors, identical replacement, missing or empty anchor → NOT_APPLIED", () => {
    const rs = py([
      { fn: "mutations.apply_mutant", args: [b("ababa"), b("aba"), b("x")] },
      { fn: "mutations.apply_mutant", args: [b("return n;"), b("n"), b("n")] },
      { fn: "mutations.apply_mutant", args: [b("return n;"), b("impossible"), b("x")] },
      { fn: "mutations.apply_mutant", args: [b("return n;"), b(""), b("x")] },
      { fn: "mutations.apply_mutant", args: [b("a<<b"), b("<<"), b(">>")] },
    ]);
    const ok = rs.map((r) => r.ok as { applied: boolean; count: number });
    expect(ok.map((r) => r.applied)).toEqual([false, false, false, false, true]);
    expect(ok[0]!.count).toBe(2);
    const applied = rs[4]!.ok as { result: { $b: string }; beforeSha256: string; afterSha256: string; position: number };
    expect(Buffer.from(applied.result.$b, "hex").toString()).toBe("a>>b");
    expect(applied.position).toBe(1);
    expect(applied.beforeSha256).not.toBe(applied.afterSha256);
  });

  it("AV-134 the post-patch manifest diff must be exactly one MODIFY of the mutant path", () => {
    const before = { "src/a.ts": ["file", 292, "h1"], "src/b.ts": ["file", 292, "h2"] };
    const rs = py([
      { fn: "mutations.single_modify", args: [before, { ...before, "src/a.ts": ["file", 292, "h9"] }, "src/a.ts"] },
      { fn: "mutations.single_modify", args: [before, { "src/a.ts": ["file", 292, "h9"], "src/b.ts": ["file", 292, "h8"] }, "src/a.ts"] },
      { fn: "mutations.single_modify", args: [before, { ...before, "src/a.ts": ["file", 365, "h9"] }, "src/a.ts"] },
      { fn: "mutations.single_modify", args: [before, { ...before, "src/a.ts": ["file", 292, "h9"], "src/c.ts": ["file", 292, "h3"] }, "src/a.ts"] },
      { fn: "mutations.single_modify", args: [before, before, "src/a.ts"] },
    ]);
    expect(rs.map((r) => r.ok)).toEqual([true, false, false, false, false]);
  });
});

describe("classify (contract B §6 table)", () => {
  it("AV-187 timeout, −9, exit 2, AssertionError+TypeError, extra unnamed failure, wrong ancestor → INFRA ×6", () => {
    const cases = [
      obs({ timedOut: true, exitCode: null, report: killedReport() }),
      obs({ exitCode: -9, report: killedReport() }),
      obs({ exitCode: 2, report: killedReport() }),
      obs({ report: report([{ id: id("named"), status: "failed", errorNames: ["AssertionError", "TypeError"] }]) }),
      obs({ report: report([{ id: id("named"), status: "failed" }, { id: id("unnamed"), status: "failed" }]) }),
      obs({ report: report([{ id: id("named", ["Other"]), status: "failed" }]) }),
    ];
    expect(classifyAll(cases)).toEqual(Array(6).fill("INFRA_FAILURE"));
    expect(py1("mutations.apply_mutant", [b("ababa"), b("aba"), b("x")]).ok).toMatchObject({ applied: false });
    expect(classify(obs({ applied: false }))).toBe("NOT_APPLIED");
  });

  it("KILLED, SURVIVED and AV-136..140 infrastructure cases", () => {
    const rs = classifyAll([
      obs({ report: killedReport() }),
      obs({ exitCode: 0, report: report([{ id: id("named"), status: "passed" }, { id: id("other"), status: "passed" }]) }),
      obs({ report: report([{ id: id("other"), status: "failed" }]) }), // AV-136 named test missing
      obs({ report: report([{ id: id("named"), status: "passed" }], { errors: [{ kind: "hook", testIdentity: null }], reason: "failed" }) }), // AV-137
      obs({ timedOut: true, exitCode: 1, report: killedReport() }), // AV-138
      obs({ exitCode: 137, report: killedReport() }), // AV-139
      obs({ report: null }), // AV-140 exit 1 without report
      obs({ typecheckOk: false, report: killedReport() }),
      obs({ report: report([{ id: id("named"), status: "failed", errorNames: [] }]) }),
      obs({ exitCode: 0, report: report([{ id: id("named"), status: "skipped" }]) }),
      obs({ report: { ...killedReport(), failures: [] } }), // schema-invalid: failed test without failure row
      obs({ report: report([{ id: id("named"), status: "failed" }], { errors: [{ kind: "collection", testIdentity: null }] }) }),
      obs({ exitCode: 0, report: killedReport() }),
      obs({ report: report([{ id: id("named"), status: "failed" }], { files: [FILE, "tests/b.test.ts"] }) }),
    ]);
    expect(rs).toEqual(["KILLED", "SURVIVED", ...Array(12).fill("INFRA_FAILURE")]);
  });

  it("isolated mutant B3 test: complete report, AssertionError in the named test, exit 2 resp. signal −9 is INFRA_FAILURE, never KILLED", () => {
    // Masking: applied, no timeout, typecheck ok, complete schema-valid report, named test present,
    // only AssertionError, no unnamed failure: only the exit-code precedence can yield INFRA here.
    const rs = classifyAll([obs({ exitCode: 2, report: killedReport() }), obs({ exitCode: -9, report: killedReport() }), obs({ exitCode: 1, report: killedReport() })]);
    expect(rs).toEqual(["INFRA_FAILURE", "INFRA_FAILURE", "KILLED"]);
  });
});

describe("aggregate", () => {
  const plan = [{ id: "m1" }, { id: "m2" }, { id: "m3" }];
  it("PASS iff every required mutant is KILLED; primary failure is the smallest plan index (AV-142)", () => {
    const rs = py([
      { fn: "mutations.aggregate", args: [plan, { m1: { class: "KILLED" }, m2: { class: "KILLED" }, m3: { class: "KILLED" } }] },
      { fn: "mutations.aggregate", args: [plan, { m1: { class: "KILLED" }, m2: { class: "SURVIVED", equivalent: "same semantics" }, m3: { class: "INFRA_FAILURE" } }] },
      { fn: "mutations.aggregate", args: [plan, { m1: { class: "INFRA_FAILURE" }, m2: { class: "SURVIVED" }, m3: { class: "KILLED" } }] },
      { fn: "mutations.aggregate", args: [plan, { m1: { class: "KILLED" }, m2: { class: "KILLED" }, m3: { class: "WHATEVER" } }] },
    ]);
    expect(rs.map(outcome)).toEqual(["PASS", "MUTANT_SURVIVED", "MUTANT_INFRA", "EXECUTION_INTERNAL"]);
    expect(rs[1]!.fail!.phase).toBe("mutations");
  });

  it("isolated mutant B4 test (AV-141): a Developer 'detected' without an independent KILLED run is MUTANT_NOT_APPLIED", () => {
    // Masking: m1 is independently KILLED, so only m2's missing independent kill can decide.
    const rs = py([
      { fn: "mutations.aggregate", args: [plan.slice(0, 2), { m1: { class: "KILLED" }, m2: { class: "NOT_APPLIED", detected: true } }] },
      { fn: "mutations.aggregate", args: [plan.slice(0, 2), { m1: { class: "KILLED" }, m2: { detected: true } }] },
      { fn: "mutations.aggregate", args: [plan.slice(0, 2), { m1: { class: "KILLED" } }] },
    ]);
    expect(rs.map(outcome)).toEqual(["MUTANT_NOT_APPLIED", "MUTANT_NOT_APPLIED", "MUTANT_NOT_APPLIED"]);
  });
});

// ---------------------------------------------------------------- six real clampAtZero probes (PKG §8)

describe("real clampAtZero probes with real Vitest (LocalRunner test seam, no sandbox)", () => {
  let base: string;
  let repo: FixtureRepo;
  let tree: string;
  let workspace: string;
  const CLAMP = "export function clampAtZero(n: number): number { return n < 0 ? 0 : n; }\n";
  const ANCHOR = "return n < 0 ? 0 : n;";
  const named: Id[] = [id("negative", ["clampAtZero"], "tests/clamp.test.ts")];

  beforeAll(() => {
    base = tempRoot("mutations");
    repo = new FixtureRepo(join(base, "repo"));
    workspace = join(base, "ws");
    mkdirSync(workspace, { mode: 0o700 });
    const tsconfig = { compilerOptions: { strict: true, noEmit: true, module: "NodeNext", moduleResolution: "NodeNext", target: "ES2022", allowImportingTsExtensions: true, skipLibCheck: true, types: [] }, include: ["src", "tests"] };
    tree = repo.tree({
      "package.json": '{"type":"module"}\n',
      "tsconfig.json": JSON.stringify(tsconfig),
      src: { "clamp.ts": CLAMP },
      tests: {
        "clamp.test.ts":
          "import { describe, expect, it } from 'vitest';\nimport { clampAtZero } from '../src/clamp.ts';\n" +
          "describe('clampAtZero', () => {\n  it('negative', () => expect(clampAtZero(-1)).toBe(0));\n" +
          "  it('zero', () => expect(clampAtZero(0)).toBe(0));\n  it('positive', () => expect(clampAtZero(2)).toBe(2));\n});\n",
      },
    });
  });
  afterAll(() => {
    if (base) removeTree(base);
  });

  function probe(anchor: string, replacement: string, deadline = 30) {
    const plan = [{ id: "clamp", path: "src/clamp.ts", anchorBase64: Buffer.from(anchor).toString("base64"), replacementBase64: Buffer.from(replacement).toString("base64"), testFiles: ["tests/clamp.test.ts"], namedTests: named }];
    const r = py1("mutations.run_mutants_for_test", [repo.store(), tree, plan, workspace, NODE_MODULES, process.execPath, deadline]);
    expect(outcome(r)).toBe("PASS");
    const ok = r.ok as { records: { class: string; beforeSha256: string }[]; verdict: string };
    return { cls: ok.records[0]!.class, verdict: ok.verdict };
  }

  it("AV-126 return n → KILLED (suite PASS)", () => {
    expect(probe(ANCHOR, "return n;")).toEqual({ cls: "KILLED", verdict: "PASS" });
  }, 15_000);
  it("AV-127 equivalent if form → SURVIVED", () => {
    expect(probe(ANCHOR, "if (n < 0) return 0; return n;")).toEqual({ cls: "SURVIVED", verdict: "MUTANT_SURVIVED" });
  }, 15_000);
  it("AV-128 missing anchor → NOT_APPLIED without a worker start", () => {
    expect(probe("return impossible;", "return n;")).toEqual({ cls: "NOT_APPLIED", verdict: "MUTANT_NOT_APPLIED" });
  }, 15_000);
  it("AV-129 return ??? → INFRA_FAILURE", () => {
    expect(probe(ANCHOR, "return ???;")).toEqual({ cls: "INFRA_FAILURE", verdict: "MUTANT_INFRA" });
  }, 15_000);
  it("AV-130 throw at module import → INFRA_FAILURE", () => {
    expect(probe("export function", 'throw new Error("import fixture"); export function')).toEqual({ cls: "INFRA_FAILURE", verdict: "MUTANT_INFRA" });
  }, 15_000);
  it("AV-131 busy loop past a lowered deadline → INFRA_FAILURE", () => {
    expect(probe(ANCHOR, "const end = Date.now() + 20000; while (Date.now() < end) {} return n;", 3)).toEqual({ cls: "INFRA_FAILURE", verdict: "MUTANT_INFRA" });
  }, 15_000);
  it("AV-135 a mutant on a test file is POLICY_INVALID; the workspace is left empty", () => {
    const plan = [{ id: "bad", path: "tests/clamp.test.ts", anchorBase64: "eA==", replacementBase64: "eQ==", testFiles: ["tests/clamp.test.ts"], namedTests: named }];
    const r = py1("mutations.run_mutants_for_test", [repo.store(), tree, plan, workspace, NODE_MODULES, process.execPath, 30]);
    expect(outcome(r)).toBe("POLICY_INVALID");
    expect(py1("os.listdir", [workspace]).ok).toEqual([]);
  });
});

// ---------------------------------------------------------------- property family (PKG §14)

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
}

type Gen = { obs: Record<string, unknown>; model: Model };
type Model = {
  applied: boolean; timedOut: boolean; typecheckOk: boolean; exitCode: number | null; reportValid: boolean;
  errors: number; reason: string; files: string[]; selected: string[];
  tests: { id: Id; status: string; names: string[] }[]; named: Id[];
};

/** Independent oracle written from the contract §6 table (not from mutations.py). */
function oracle(m: Model): string {
  if (!m.applied) return "NOT_APPLIED";
  if (m.timedOut || !m.typecheckOk || m.exitCode === null) return "INFRA_FAILURE"; // row 2
  if (m.exitCode !== 0 && m.exitCode !== 1) return "INFRA_FAILURE"; // row 4 (also signals)
  if (!m.reportValid || m.errors > 0 || m.reason === "interrupted") return "INFRA_FAILURE"; // rows 2/3
  const sel = [...new Set(m.selected)].sort();
  if (JSON.stringify([...m.files].sort()) !== JSON.stringify(sel)) return "INFRA_FAILURE";
  if (JSON.stringify([...new Set(m.tests.map((t) => t.id[0]))].sort()) !== JSON.stringify(sel)) return "INFRA_FAILURE";
  const k = (i: Id) => JSON.stringify(i);
  const byId = new Map(m.tests.map((t) => [k(t.id), t]));
  if (m.named.length === 0 || m.named.some((n) => !byId.has(k(n)))) return "INFRA_FAILURE";
  if (m.tests.some((t) => t.status !== "passed" && t.status !== "failed")) return "INFRA_FAILURE";
  const namedKeys = new Set(m.named.map(k));
  const failed = m.tests.filter((t) => t.status === "failed");
  if (failed.some((t) => !namedKeys.has(k(t.id)))) return "INFRA_FAILURE"; // row 5
  if (m.exitCode === 0 && failed.length === 0 && m.reason === "passed") return "SURVIVED"; // row 6
  if (m.exitCode === 1 && failed.length > 0 && m.reason === "failed" && failed.every((t) => t.names.length > 0 && t.names.every((n) => n === "AssertionError"))) return "KILLED";
  return "INFRA_FAILURE";
}

function generate(rng: XorShift32): Gen {
  const all = ["tests/a.test.ts", "tests/b.test.ts", "tests/c.test.ts"];
  const selected = rng.chance(0.5) ? [all[0]!] : [all[0]!, all[1]!];
  let files = [...selected];
  if (rng.chance(0.05)) files = files.slice(1);
  if (rng.chance(0.05)) files = [...files, all[2]!];
  const tests: Model["tests"] = [];
  for (const file of files) {
    if (rng.chance(0.03)) continue; // a collected file without tests
    const count = 1 + rng.int(3);
    for (let i = 0; i < count; i++) {
      const status = rng.chance(0.75) ? "passed" : rng.chance(0.85) ? "failed" : rng.pick(["skipped", "todo"]);
      const names = rng.pick([["AssertionError"], ["AssertionError"], ["AssertionError", "AssertionError"], ["TypeError"], ["AssertionError", "TypeError"], []]);
      tests.push({ id: [file, "forge-v01", rng.chance(0.5) ? ["S"] : [], `t${i}`, 0], status, names });
    }
  }
  const named: Id[] = [];
  for (const t of tests) if ((t.status === "failed" ? rng.chance(0.8) : rng.chance(0.3))) named.push(t.id);
  if (rng.chance(0.08)) named.push([files[0] ?? all[0]!, "forge-v01", ["Elsewhere"], "t0", 0]); // same title wrong ancestor
  const failed = tests.some((t) => t.status === "failed");
  let reason = failed ? "failed" : "passed";
  if (rng.chance(0.05)) reason = rng.pick(["passed", "failed", "interrupted"]);
  const errors = rng.chance(0.05) ? 1 : 0;
  const model: Model = {
    applied: !rng.chance(0.03), timedOut: rng.chance(0.05), typecheckOk: !rng.chance(0.04),
    exitCode: rng.pick([0, 1, 1, 1, 0, 1, 2, -9, 137, null]), reportValid: true, errors, reason, files, selected, tests, named,
  };
  let rep: unknown = null;
  if (rng.chance(0.06)) model.reportValid = false;
  else {
    const built = report(tests.map((t) => ({ id: t.id, status: t.status, errorNames: t.names })), { files, reason, errors: errors ? [{ kind: rng.pick(["collection", "suite", "hook", "unhandled"]), testIdentity: null }] : [] });
    if (rng.chance(0.04)) {
      model.reportValid = false; // schema defect: an unknown status
      rep = { ...built, inventory: { ...built.inventory, tests: [...built.inventory.tests, { id: [files[0] ?? FILE, "forge-v01", ["Z"], "z", 0], status: "pending" }] } };
    } else rep = built;
  }
  const obsValue = { applied: model.applied, timedOut: model.timedOut, typecheckOk: model.typecheckOk, exitCode: model.exitCode, report: rep, selectedFiles: selected, namedTests: named };
  return { obs: obsValue, model };
}

describe("property: mutation classification", () => {
  it(`${ITERATIONS} deterministic observations agree with the independent §6 oracle (seed ${SEED})`, () => {
    const rng = new XorShift32(SEED);
    const gens = Array.from({ length: ITERATIONS }, () => generate(rng));
    const calls: Call[] = gens.map((g) => ({ fn: "mutations.classify", args: [g.obs] }));
    const results = py(calls);
    const seen = new Set<string>();
    for (let i = 0; i < gens.length; i++) {
      const expected = oracle(gens[i]!.model);
      seen.add(expected);
      if (results[i]!.ok !== expected) {
        throw new Error(`counterexample #${i}: ${JSON.stringify({ obs: gens[i]!.obs, expected, actual: results[i] })}`);
      }
    }
    expect([...seen].sort()).toEqual(["INFRA_FAILURE", "KILLED", "NOT_APPLIED", "SURVIVED"]);
  }, 30_000);
});
