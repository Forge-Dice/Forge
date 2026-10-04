import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { b, outcome, py, removeTree, tempRoot, type Call } from "./helpers.ts";

// FORGE-BOOTSTRAP-0001B test inventory (PKG §7, contract B §3/§4/§8): real nested Vitest runs
// under the trusted config + reporter on fixture files generated in a temp dir, the strict
// report parser, the PKG §7 HEAD comparison (AV-115a/b, AV-118/183 = mutant B2, AV-186) and an
// Inventory property family (10,000 iterations, xorshift32 seed 1042026, independent oracle).

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const VITEST = join(REPO, "node_modules", "vitest", "vitest.mjs");
const CONFIG = join(REPO, "tools", "forge_v01", "vitest.config.mjs");
const PROJECT = "forge-v01";
const MIB8 = 8 * 1024 * 1024;

type Id = [string, string, string[], string, number];
type Inv = {
  format: number;
  files: { file: string; project: string; collection: string }[];
  tests: { id: Id; status: string }[];
  errors: { kind: string; testIdentity: Id | null }[];
  reason: string;
};
type Payload = { format: number; inventory: Inv; failures: { id: Id; errorNames: string[] }[] };
type Spec = { file: string; anc: string[]; title: string; status?: string };

const keyOf = (value: unknown): Buffer => Buffer.from(JSON.stringify(value), "utf8");

/** Inventory from specs in declaration order: occurrences first, then canonical sort. */
function inv(specs: Spec[], extra: Partial<Inv> = {}): Inv {
  const counts = new Map<string, number>();
  const tests = specs.map((s) => {
    const group = JSON.stringify([s.file, PROJECT, s.anc, s.title]);
    const occurrence = counts.get(group) ?? 0;
    counts.set(group, occurrence + 1);
    return { id: [s.file, PROJECT, [...s.anc], s.title, occurrence] as Id, status: s.status ?? "passed" };
  });
  tests.sort((x, y) => Buffer.compare(keyOf(x.id), keyOf(y.id)));
  const files = [...new Set(specs.map((s) => s.file))].sort().map((file) => ({ file, project: PROJECT, collection: "ok" }));
  const reason = tests.some((t) => t.status === "failed") ? "failed" : "passed";
  return { format: 1, files, tests, errors: [], reason, ...extra };
}

function frame(payload: unknown): Buffer {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(JSON.stringify(payload), "utf8");
  return Buffer.concat([Buffer.from(`FORGE-REPORT-V1 ${body.length}\n`, "ascii"), body]);
}

const parse = (raw: Buffer, kwargs: Record<string, unknown> = {}): Call => ({ fn: "inventory.parse_report", args: [b(raw)], kwargs });
const compare = (base: unknown, head: unknown, added: string[], expected: string[]): Call => ({
  fn: "inventory.compare_inventory",
  args: [base, head, added, expected],
});

// ---------------------------------------------------------------- real nested Vitest runs

type Run = { status: number | null; raw: Buffer | null };

const ORDERED = `import { describe, expect, it } from "vitest";
const wait = (ms: number) => new Promise((r) => setTimeout(r, process.env["FIXTURE_ORDER"] === "reverse" ? 60 - ms : ms));
it.each([1, 1, 2])("value %i", async (n) => { await wait(n * 20); expect(n).toBeGreaterThan(0); });
describe("A", () => { it("same", async () => { await wait(5); }); });
describe("B", () => { it("same", async () => { await wait(40); }); it("same", () => {}); });
`;
const Q = (body: string) => `import { expect, it } from "vitest";\n${body}\nit("q2", () => { expect(2).toBe(2); });\n`;
const Q_OK = Q(`it("q1", () => { expect(1).toBe(1); });`);

const RUNS: Record<string, Record<string, string>> = {
  mixed: {
    "tests/ordered.test.ts": ORDERED,
    "tests/status.test.ts": `import { describe, expect, it } from "vitest";
it.skip("skipped", () => {});
it.todo("todo");
it("assertion", () => { expect(1).toBe(2); });
it("type error", () => { (null as unknown as { x: number }).x; });
describe("D", () => { it("ctrl \\n\\u0001 é \\u2028 \\"q\\"", () => {}); });
`,
    "tests/only.test.ts": `import { it } from "vitest";\nit.only("only", () => {});\nit("other", () => {});\n`,
    "tests/empty.test.ts": "",
    "tests/collect.test.ts": `throw new Error("collection");\n`,
    "tests/hook.test.ts": `import { beforeAll, describe, it } from "vitest";
describe("H", () => { beforeAll(() => { throw new Error("hook"); }); it("t", () => {}); });
`,
    "tests/unhandled.test.ts": `import { it } from "vitest";
it("u", () => { setTimeout(() => { throw new Error("late"); }, 1); });
it("w", async () => { await new Promise((r) => setTimeout(r, 50)); });
`,
  },
  base: { "tests/p.test.ts": ORDERED, "tests/q.test.ts": Q_OK },
  baseReverse: { "tests/p.test.ts": ORDERED, "tests/q.test.ts": Q_OK },
  headOk: {
    "tests/p.test.ts": ORDERED,
    "tests/q.test.ts": Q_OK,
    "tests/n.test.ts": `import { describe, it } from "vitest";\ndescribe("A", () => { it("same", () => {}); });\nit("q1", () => {});\n`,
  },
  headSkip: { "tests/p.test.ts": ORDERED, "tests/q.test.ts": Q(`it.skip("q1", () => {});`) },
  headTodo: { "tests/p.test.ts": ORDERED, "tests/q.test.ts": Q(`it.todo("q1");`) },
  headOnly: { "tests/p.test.ts": ORDERED, "tests/q.test.ts": Q(`it.only("q1", () => {});`) },
  headFail: { "tests/p.test.ts": ORDERED, "tests/q.test.ts": Q(`it("q1", () => { expect(1).toBe(0); });`) },
  headEmptyNew: { "tests/p.test.ts": ORDERED, "tests/q.test.ts": Q_OK, "tests/n.test.ts": "" },
  headHook: {
    "tests/p.test.ts": ORDERED,
    "tests/q.test.ts": Q_OK,
    "tests/n.test.ts": `import { afterAll, it } from "vitest";\nafterAll(() => { throw new Error("after"); });\nit("n", () => {});\n`,
  },
  headDeleted: { "tests/p.test.ts": ORDERED },
};

const runs: Record<string, Run> = {};
let root = "";

function runVitest(name: string, files: Record<string, string>): Promise<Run> {
  const dir = join(root, name);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  symlinkSync(join(REPO, "node_modules"), join(dir, "node_modules"));
  writeFileSync(join(root, `${name}.plan.json`), JSON.stringify({ root: dir, include: Object.keys(files) }));
  mkdirSync(join(root, `${name}.home`));
  const report = join(root, `${name}.report`);
  const env: NodeJS.ProcessEnv = {
    PATH: process.env["PATH"] ?? "/usr/bin:/bin",
    HOME: join(root, `${name}.home`),
    CI: "true",
    NO_COLOR: "1",
    TZ: "UTC",
    LANG: "C.UTF-8",
    FORGE_VITEST_PLAN: join(root, `${name}.plan.json`),
    FORGE_REPORT_PATH: report,
    ...(name === "baseReverse" ? { FIXTURE_ORDER: "reverse" } : {}),
  };
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [VITEST, "run", "--config", CONFIG], { cwd: dir, env, stdio: "ignore" });
    const timer = setTimeout(() => child.kill("SIGKILL"), 20_000);
    child.on("close", (status) => {
      clearTimeout(timer);
      let raw: Buffer | null = null;
      try {
        raw = readFileSync(report);
      } catch {
        raw = null;
      }
      resolve({ status, raw });
    });
  });
}

function runOf(name: string): Buffer {
  const raw = runs[name]?.raw;
  if (!raw) throw new Error(`run ${name} wrote no report`);
  return raw;
}

function payloadOf(name: string): Payload {
  const raw = runOf(name);
  const newline = raw.indexOf(0x0a);
  return JSON.parse(raw.subarray(newline + 1).toString("utf8")) as Payload;
}

describe("trusted reporter on real Vitest runs", { timeout: 10_000 }, () => {
  beforeAll(async () => {
    root = tempRoot("inventory");
    const results = await Promise.all(Object.entries(RUNS).map(async ([name, files]) => [name, await runVitest(name, files)] as const));
    for (const [name, run] of results) runs[name] = run;
  }, 25_000);

  afterAll(() => {
    if (root) removeTree(root);
  });

  it("every run wrote exactly one strictly parseable report", () => {
    const names = Object.keys(RUNS);
    const responses = py(names.map((n) => parse(runOf(n))));
    names.forEach((n, i) => expect(`${n}:${outcome(responses[i]!)}`).toBe(`${n}:PASS`));
    expect(runs["base"]?.status).toBe(0);
    expect(runs["mixed"]?.status).toBe(1);
  });

  it("AV-103/AV-104: parameterized duplicates get occurrences 0/1; same title under other ancestors stays distinct", () => {
    const ids = payloadOf("mixed").inventory.tests.filter((t) => t.id[0] === "tests/ordered.test.ts").map((t) => JSON.stringify(t.id));
    expect(ids).toEqual([
      `["tests/ordered.test.ts","forge-v01",["A"],"same",0]`,
      `["tests/ordered.test.ts","forge-v01",["B"],"same",0]`,
      `["tests/ordered.test.ts","forge-v01",["B"],"same",1]`,
      `["tests/ordered.test.ts","forge-v01",[],"value 1",0]`,
      `["tests/ordered.test.ts","forge-v01",[],"value 1",1]`,
      `["tests/ordered.test.ts","forge-v01",[],"value 2",0]`,
    ]);
  });

  it("skip, todo, assertion and TypeError failures and a control-character title are visible", () => {
    const p = payloadOf("mixed");
    const rows = Object.fromEntries(p.inventory.tests.filter((t) => t.id[0] === "tests/status.test.ts").map((t) => [t.id[3], t.status]));
    expect(rows).toEqual({ skipped: "skipped", todo: "todo", assertion: "failed", "type error": "failed", 'ctrl \n\u0001 é   "q"': "passed" });
    const failures = Object.fromEntries(p.failures.map((f) => [`${f.id[0]}:${f.id[3]}`, f.errorNames]));
    expect(failures["tests/status.test.ts:assertion"]).toEqual(["AssertionError"]);
    expect(failures["tests/status.test.ts:type error"]).toEqual(["TypeError"]);
  });

  it("it.only under allowOnly=false fails the only-test and skips the rest", () => {
    const rows = payloadOf("mixed").inventory.tests.filter((t) => t.id[0] === "tests/only.test.ts").map((t) => `${t.id[3]}:${t.status}`);
    expect(rows).toEqual(["only:failed", "other:skipped"]);
  });

  it("empty file, collection error, hook error and unhandled error are visible errors", () => {
    const p = payloadOf("mixed").inventory;
    const collection = Object.fromEntries(p.files.map((f) => [f.file, f.collection]));
    expect(collection["tests/empty.test.ts"]).toBe("error");
    expect(collection["tests/collect.test.ts"]).toBe("error");
    expect(collection["tests/hook.test.ts"]).toBe("ok");
    expect(p.errors.map((e) => e.kind)).toEqual(["collection", "collection", "hook", "unhandled"]);
    expect(p.tests.filter((t) => t.id[0] === "tests/hook.test.ts").map((t) => t.status)).toEqual(["skipped"]);
    expect(p.reason).toBe("failed");
    expect(p.files.every((f) => f.project === PROJECT)).toBe(true);
  });

  it("AV-116: completion order changed, identical identities and identical report bytes", () => {
    expect(runs["baseReverse"]?.status).toBe(0);
    expect(runOf("baseReverse").equals(runOf("base"))).toBe(true);
  });

  it("AV-112/105/106/109/110/107/117/113: HEAD runs compared against the real BASE run", () => {
    const base = payloadOf("base").inventory;
    const expected = ["tests/p.test.ts", "tests/q.test.ts"];
    const withNew = [...expected, "tests/n.test.ts"];
    const cases: [string, string[], string[], string][] = [
      ["base", [], expected, "PASS"],
      ["headOk", ["tests/n.test.ts"], withNew, "PASS"],
      ["headSkip", [], expected, "TEST_STATUS"],
      ["headTodo", [], expected, "TEST_STATUS"],
      ["headOnly", [], expected, "TEST_STATUS"],
      ["headFail", [], expected, "TEST_STATUS"],
      ["headEmptyNew", ["tests/n.test.ts"], withNew, "TEST_INVENTORY"],
      ["headHook", ["tests/n.test.ts"], withNew, "TEST_INVENTORY"],
      ["headDeleted", [], expected, "TEST_INVENTORY"],
      ["headDeleted", [], ["tests/p.test.ts"], "TEST_INVENTORY"],
    ];
    const responses = py(cases.map(([name, added, exp]) => compare(base, payloadOf(name).inventory, added, exp)));
    expect(cases.map(([name, , , want], i) => `${name}:${outcome(responses[i]!)}`)).toEqual(cases.map(([name, , , want]) => `${name}:${want}`));
    // A BASE that is itself not green is TEST_BASELINE, never something HEAD only has to keep.
    const bad = py([compare(payloadOf("headSkip").inventory, base, [], expected), compare(payloadOf("mixed").inventory, base, [], expected)]);
    expect(bad.map(outcome)).toEqual(["TEST_BASELINE", "TEST_BASELINE"]);
  });
});

// ---------------------------------------------------------------- trusted config

describe("trusted vitest config", { timeout: 10_000 }, () => {
  it("makeConfig pins the PKG §6 settings and rejects globs and unapproved paths", async () => {
    const mod = (await import(CONFIG)) as { makeConfig: (root: string, files: unknown) => { test: Record<string, unknown> } };
    const t = mod.makeConfig("/case", ["tests/a.test.ts"]).test;
    expect(t["name"]).toBe(PROJECT);
    expect(t["include"]).toEqual(["tests/a.test.ts"]);
    expect([t["allowOnly"], t["passWithNoTests"], t["retry"], t["pool"], t["maxWorkers"], t["fileParallelism"]]).toEqual([false, false, 0, "forks", 2, true]);
    expect([t["testTimeout"], t["hookTimeout"], t["update"], t["watch"], t["ui"]]).toEqual([5000, 10000, false, false, false]);
    expect(t["sequence"]).toEqual({ shuffle: false, concurrent: false });
    expect(t["reporters"]).toEqual([join(REPO, "tools", "forge_v01", "inventory-reporter.mjs")]);
    for (const files of [["tests/*.test.ts"], ["tests/{a,b}.test.ts"], ["../a.test.ts"], ["/case/a.test.ts"], ["tests/a.ts"], ["a.test.ts", "a.test.ts"], [], "tests/a.test.ts"]) {
      expect(() => mod.makeConfig("/case", files)).toThrow();
    }
    expect(() => mod.makeConfig("case", ["tests/a.test.ts"])).toThrow();
  });
});

// ---------------------------------------------------------------- comparison (synthetic inventories)

const F = "tests/a.test.ts";
const G = "tests/b.test.ts";
const NEW = "tests/new.test.ts";
const BASE_SPECS: Spec[] = [
  { file: F, anc: ["A", "B"], title: "c" },
  { file: F, anc: [], title: "x" },
  { file: F, anc: [], title: "x" },
  { file: G, anc: ["S"], title: "y" },
];

describe("compare_inventory", { timeout: 10_000 }, () => {
  it("mutant B2: one BASE identity lost, new identities compensate the count (AV-118, AV-183) → TEST_INVENTORY", () => {
    // Masking: the lost identity's file keeps another BASE test (file list unchanged), the new
    // identities live in an approved new file and pass, both inventories are complete; only
    // the BASE ⊆ HEAD multiset check can reject.
    const base = inv([...BASE_SPECS, { file: G, anc: [], title: "z" }]);
    const kept = [...BASE_SPECS.slice(0, 3), { file: G, anc: [], title: "z" }];
    const head183 = inv([...kept, { file: NEW, anc: [], title: "n0" }]);
    const head118 = inv([...kept, ...Array.from({ length: 10 }, (_, i) => ({ file: NEW, anc: [], title: `n${i}` }))]);
    expect(head183.tests.length).toBe(base.tests.length);
    const r = py([compare(base, head183, [NEW], [F, G, NEW]), compare(base, head118, [NEW], [F, G, NEW])]);
    expect(r.map(outcome)).toEqual(["TEST_INVENTORY", "TEST_INVENTORY"]);
  });

  it("AV-115a: BASE identity replaced by the same printed full name under another ancestor tuple → TEST_INVENTORY", () => {
    // Printed full name "A > B > c" both times: ["A","B"]/"c" versus ["A"]/"B > c".
    const head = inv([{ file: F, anc: ["A"], title: "B > c" }, ...BASE_SPECS.slice(1)]);
    const headNew = inv([...BASE_SPECS.slice(1), { file: NEW, anc: ["A"], title: "B > c" }]);
    const r = py([compare(inv(BASE_SPECS), head, [], [F, G]), compare(inv(BASE_SPECS), headNew, [NEW], [F, G, NEW])]);
    expect(r.map(outcome)).toEqual(["TEST_INVENTORY", "TEST_INVENTORY"]);
  });

  it("AV-115b: extra same-full-name identity in an approved new file, all BASE present and passed → PASS", () => {
    const head = inv([...BASE_SPECS, { file: NEW, anc: ["A"], title: "B > c" }, { file: NEW, anc: ["A", "B"], title: "c" }]);
    expect(outcome(py([compare(inv(BASE_SPECS), head, [NEW], [F, G, NEW])])[0]!)).toBe("PASS");
  });

  it("PKG §7 HEAD rule table", () => {
    const base = inv(BASE_SPECS);
    const all = [F, G];
    const status = (i: number, s: string) => BASE_SPECS.map((x, j) => (j === i ? { ...x, status: s } : x));
    const cases: [string, Inv, string[], string[], string][] = [
      ["identical", inv(BASE_SPECS), [], all, "PASS"],
      ["AV-112 new approved file", inv([...BASE_SPECS, { file: NEW, anc: [], title: "x" }]), [NEW], [...all, NEW], "PASS"],
      ["AV-111 title changed, same count", inv([...BASE_SPECS.slice(0, 3), { file: G, anc: ["S"], title: "y!" }]), [], all, "TEST_INVENTORY"],
      ["occurrence lost", inv([BASE_SPECS[0]!, BASE_SPECS[1]!, BASE_SPECS[3]!]), [], all, "TEST_INVENTORY"],
      ["extra test in existing file", inv([...BASE_SPECS, { file: F, anc: [], title: "x" }]), [], all, "TEST_INVENTORY"],
      ["AV-113 file deleted", inv(BASE_SPECS.slice(0, 3)), [], all, "TEST_INVENTORY"],
      ["unexpected extra file", inv([...BASE_SPECS, { file: NEW, anc: [], title: "n" }]), [], all, "TEST_INVENTORY"],
      ["approved file missing", inv(BASE_SPECS), [NEW], [...all, NEW], "TEST_INVENTORY"],
      ["AV-105 skipped", inv(status(1, "skipped")), [], all, "TEST_STATUS"],
      ["AV-106 todo", inv(status(2, "todo")), [], all, "TEST_STATUS"],
      ["AV-110 failed", inv(status(0, "failed")), [], all, "TEST_STATUS"],
      ["new test failed", inv([...BASE_SPECS, { file: NEW, anc: [], title: "n", status: "failed" }]), [NEW], [...all, NEW], "TEST_STATUS"],
      ["AV-117 hook error beside passing tests", inv(BASE_SPECS, { errors: [{ kind: "hook", testIdentity: null }] }), [], all, "TEST_INVENTORY"],
      ["unhandled error", inv(BASE_SPECS, { errors: [{ kind: "unhandled", testIdentity: null }] }), [], all, "TEST_INVENTORY"],
      ["AV-119 interrupted (partial)", inv(BASE_SPECS, { reason: "interrupted" }), [], all, "TEST_INVENTORY"],
      ["reason passed with a failed test", inv(status(0, "failed"), { reason: "passed" }), [], all, "TEST_INVENTORY"],
      ["collection error flag", inv(BASE_SPECS, { files: inv(BASE_SPECS).files.map((f) => ({ ...f, collection: "error" })) }), [], all, "TEST_INVENTORY"],
      ["AV-114 unknown project", inv(BASE_SPECS, { files: inv(BASE_SPECS).files.map((f) => ({ ...f, project: "other" })) }), [], all, "TEST_INVENTORY"],
      ["status pending", inv(status(3, "pending")), [], all, "TEST_INVENTORY"],
    ];
    const r = py(cases.map(([, head, added, expected]) => compare(base, head, added, expected)));
    expect(cases.map(([name], i) => `${name}:${outcome(r[i]!)}`)).toEqual(cases.map(([name, , , , want]) => `${name}:${want}`));
  });

  it("BASE that is incomplete, not green or schema-invalid → TEST_BASELINE", () => {
    const head = inv(BASE_SPECS);
    const bases: Inv[] = [
      inv(BASE_SPECS.map((s, i) => (i === 0 ? { ...s, status: "skipped" } : s))),
      inv(BASE_SPECS.map((s, i) => (i === 0 ? { ...s, status: "todo" } : s))),
      inv(BASE_SPECS.map((s, i) => (i === 0 ? { ...s, status: "failed" } : s))),
      inv(BASE_SPECS, { errors: [{ kind: "collection", testIdentity: null }] }),
      inv(BASE_SPECS, { reason: "interrupted" }),
      inv([]),
      { ...inv(BASE_SPECS), tests: [...inv(BASE_SPECS).tests, inv(BASE_SPECS).tests[3]!] },
    ];
    expect(py(bases.map((base) => compare(base, head, [], [F, G]))).map(outcome)).toEqual(bases.map(() => "TEST_BASELINE"));
  });
});

// ---------------------------------------------------------------- strict report parser

function report(inventory: Inv, failures: Payload["failures"] = []): Payload {
  return { format: 1, inventory, failures };
}

describe("parse_report", { timeout: 10_000 }, () => {
  const good = report(inv(BASE_SPECS));
  const goodBody = Buffer.from(JSON.stringify(good), "utf8");
  const failing = report(inv(BASE_SPECS.map((s, i) => (i === 3 ? { ...s, status: "failed" } : s))), [
    { id: [G, PROJECT, ["S"], "y", 0], errorNames: ["AssertionError"] },
  ]);
  const text = JSON.stringify(good);
  const swap = (from: string, to: string) => frame(Buffer.from(text.replace(from, to), "utf8"));
  const tests = inv(BASE_SPECS).tests;
  const mutateTests = (fn: (t: Inv["tests"]) => Inv["tests"]) => frame(report({ ...inv(BASE_SPECS), tests: fn(tests.map((t) => ({ ...t }))) }));

  it("well-formed frames parse; malformed frames and payloads → TEST_INVENTORY", () => {
    const longTitle = (n: number) => frame(report(inv([{ file: F, anc: [], title: "é".repeat(n / 2) }])));
    const deep = (n: number) => frame(report(inv([{ file: F, anc: Array.from({ length: n }, () => "a"), title: "t" }])));
    const cases: [string, Buffer, string][] = [
      ["valid", frame(good), "PASS"],
      ["valid with failure row", frame(failing), "PASS"],
      ["title 4096 bytes", longTitle(4096), "PASS"],
      ["ancestors depth 32", deep(32), "PASS"],
      ["empty", Buffer.alloc(0), "TEST_INVENTORY"],
      ["no header", goodBody, "TEST_INVENTORY"],
      ["lowercase magic", Buffer.concat([Buffer.from(`forge-report-v1 ${goodBody.length}\n`), goodBody]), "TEST_INVENTORY"],
      ["two spaces", Buffer.concat([Buffer.from(`FORGE-REPORT-V1  ${goodBody.length}\n`), goodBody]), "TEST_INVENTORY"],
      ["CRLF", Buffer.concat([Buffer.from(`FORGE-REPORT-V1 ${goodBody.length}\r\n`), goodBody]), "TEST_INVENTORY"],
      ["leading zero", Buffer.concat([Buffer.from(`FORGE-REPORT-V1 0${goodBody.length}\n`), goodBody]), "TEST_INVENTORY"],
      ["plus sign", Buffer.concat([Buffer.from(`FORGE-REPORT-V1 +${goodBody.length}\n`), goodBody]), "TEST_INVENTORY"],
      ["length too short", Buffer.concat([Buffer.from(`FORGE-REPORT-V1 ${goodBody.length - 1}\n`), goodBody]), "TEST_INVENTORY"],
      ["length too long", Buffer.concat([Buffer.from(`FORGE-REPORT-V1 ${goodBody.length + 1}\n`), goodBody]), "TEST_INVENTORY"],
      ["trailing byte", Buffer.concat([frame(good), Buffer.from(" ")]), "TEST_INVENTORY"],
      ["header over 64 bytes", Buffer.concat([Buffer.from(`FORGE-REPORT-V1 ${" ".repeat(50)}${goodBody.length}\n`), goodBody]), "TEST_INVENTORY"],
      ["two reports", Buffer.concat([frame(good), frame(good)]), "TEST_INVENTORY"],
      ["BOM", frame(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), goodBody])), "TEST_INVENTORY"],
      ["invalid UTF-8", frame(Buffer.from(text.replace('"x"', '"ÿ"'), "latin1")), "TEST_INVENTORY"],
      ["lone surrogate escape", swap('"x"', '"\\ud800"'), "TEST_INVENTORY"],
      ["duplicate key", swap('{"format":1,', '{"format":1,"format":1,'), "TEST_INVENTORY"],
      ["NaN", swap('"format":1,"files"', '"format":NaN,"files"'), "TEST_INVENTORY"],
      ["float occurrence", swap('"x",1]', '"x",1.0]'), "TEST_INVENTORY"],
      ["bool occurrence", swap('"x",1]', '"x",true]'), "TEST_INVENTORY"],
      ["negative occurrence", swap('"x",1]', '"x",-1]'), "TEST_INVENTORY"],
      ["unknown status pending", swap('"passed"', '"pending"'), "TEST_INVENTORY"],
      ["unknown project in id", swap('"forge-v01",["A"', '"other",["A"'), "TEST_INVENTORY"],
      ["unknown reason", swap('"reason":"passed"', '"reason":"done"'), "TEST_INVENTORY"],
      ["unknown error kind", frame(report(inv(BASE_SPECS, { errors: [{ kind: "warning", testIdentity: null }] }))), "TEST_INVENTORY"],
      ["extra key", swap('{"format":1,"inventory"', '{"format":1,"x":0,"inventory"'), "TEST_INVENTORY"],
      ["missing key", swap(',"reason":"passed"', ""), "TEST_INVENTORY"],
      ["format 2", swap('{"format":1,"inventory"', '{"format":2,"inventory"'), "TEST_INVENTORY"],
      ["absolute file", frame(report(inv(BASE_SPECS.map((s) => ({ ...s, file: `/case/${s.file}` }))))), "TEST_INVENTORY"],
      ["dot-dot file", frame(report(inv(BASE_SPECS.map((s) => ({ ...s, file: `../${s.file}` }))))), "TEST_INVENTORY"],
      ["non-ASCII file", frame(report(inv(BASE_SPECS.map((s) => ({ ...s, file: s.file.replace("a", "ä") }))))), "TEST_INVENTORY"],
      ["test file not listed", frame(report({ ...inv(BASE_SPECS), files: inv(BASE_SPECS).files.slice(0, 1) })), "TEST_INVENTORY"],
      ["duplicate identity", mutateTests((t) => [t[0]!, t[0]!, ...t.slice(1)]), "TEST_INVENTORY"],
      ["occurrence gap 0,2", mutateTests((t) => t.map((x) => (x.id[3] === "x" && x.id[4] === 1 ? { ...x, id: [x.id[0], x.id[1], x.id[2], x.id[3], 2] as Id } : x))), "TEST_INVENTORY"],
      ["occurrence starts at 1", mutateTests((t) => t.map((x) => (x.id[3] === "c" ? { ...x, id: [x.id[0], x.id[1], x.id[2], x.id[3], 1] as Id } : x))), "TEST_INVENTORY"],
      ["unsorted tests", mutateTests((t) => [t[1]!, t[0]!, ...t.slice(2)]), "TEST_INVENTORY"],
      ["failed test without failure row", frame(report(failing.inventory)), "TEST_INVENTORY"],
      ["failure row for passed test", frame(report(good.inventory, failing.failures)), "TEST_INVENTORY"],
      ["title 4098 bytes", longTitle(4098), "TEST_INVENTORY"],
      ["ancestors depth 33", deep(33), "TEST_INVENTORY"],
      ["payload not an object", frame(Buffer.from("[]")), "TEST_INVENTORY"],
    ];
    const r = py([...cases.map(([, raw]) => parse(raw)), parse(frame(good), { payload_limit: goodBody.length - 1 }), parse(frame(good), { payload_limit: goodBody.length })]);
    expect(cases.map(([name], i) => `${name}:${outcome(r[i]!)}`)).toEqual(cases.map(([name, , want]) => `${name}:${want}`));
    expect(r.slice(cases.length).map(outcome)).toEqual(["TEST_INVENTORY", "PASS"]);
  });

  it("AV-186: exactly 8 MiB payload accepted, 8 MiB + 1 byte → TEST_INVENTORY", () => {
    // Synthetic payload, not produced by Vitest: ~2,060 tests with 4,000-byte titles, the last
    // two titles sized so that the compact JSON payload is exactly 8,388,608 bytes.
    const file = "tests/big.test.ts";
    const row = (i: number, pad: number) => ({ id: [file, PROJECT, [], `t${String(i).padStart(6, "0")}${"x".repeat(pad)}`, 0] as Id, status: "passed" });
    const wrap = (rows: Inv["tests"]) => report({ format: 1, files: [{ file, project: PROJECT, collection: "ok" }], tests: rows, errors: [], reason: "passed" });
    const rows: Inv["tests"] = [];
    let size = Buffer.byteLength(JSON.stringify(wrap([])));
    const cost = (i: number, pad: number) => Buffer.byteLength(JSON.stringify(row(i, pad))) + (i > 0 ? 1 : 0);
    while (size < MIB8) {
      const rem = MIB8 - size;
      if (rem > 2 * cost(rows.length, 4000)) {
        size += cost(rows.length, 4000);
        rows.push(row(rows.length, 4000));
        continue;
      }
      const first = Math.floor(rem / 2);
      const p1 = first - cost(rows.length, 0);
      rows.push(row(rows.length, p1));
      const p2 = rem - first - cost(rows.length, 0);
      rows.push(row(rows.length, p2));
      size = MIB8;
    }
    const exact = Buffer.from(JSON.stringify(wrap(rows)), "utf8");
    expect(exact.length).toBe(MIB8);
    const last = rows[rows.length - 1]!;
    rows[rows.length - 1] = { ...last, id: [file, PROJECT, [], `${last.id[3]}x`, 0] };
    const over = Buffer.from(JSON.stringify(wrap(rows)), "utf8");
    expect(over.length).toBe(MIB8 + 1);
    const r = py([parse(frame(exact)), parse(frame(over)), parse(frame(over), { payload_limit: MIB8 + 1 })]);
    expect(r.map(outcome)).toEqual(["PASS", "TEST_INVENTORY", "PASS"]);
  }, 20_000);
});

// ---------------------------------------------------------------- Inventory property family

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

const EXISTING = ["tests/a.test.ts", "tests/b.test.ts", "tests/c.test.ts"];
const ADDED = ["tests/new1.test.ts", "tests/new2.test.ts"];
const TITLES = ["x", "y", "x y", "B > x", "é", "é", "\"q\"", "t\n"];
const ANCESTORS: string[][] = [[], [], ["A"], ["A", "B"], ["B"], ["A > B"]];
const STATUSES = ["passed", "failed", "skipped", "todo"];

/** Oracle written from PKG §7 / contract B §3, independent of inventory.py. */
function oracleSchema(v: Inv): boolean {
  const fileNames = v.files.map((f) => f.file);
  if (v.files.some((f) => f.project !== PROJECT || (f.collection !== "ok" && f.collection !== "error"))) return false;
  for (let i = 1; i < fileNames.length; i++) if (!(fileNames[i - 1]! < fileNames[i]!)) return false;
  const groups = new Map<string, number[]>();
  for (let i = 0; i < v.tests.length; i++) {
    const t = v.tests[i]!;
    if (!STATUSES.includes(t.status) || t.id[1] !== PROJECT || !fileNames.includes(t.id[0])) return false;
    if (i > 0 && Buffer.compare(keyOf(v.tests[i - 1]!.id), keyOf(t.id)) >= 0) return false;
    const g = JSON.stringify(t.id.slice(0, 4));
    groups.set(g, [...(groups.get(g) ?? []), t.id[4]]);
  }
  for (const occ of groups.values()) {
    const sorted = [...occ].sort((p, q) => p - q);
    if (sorted.some((o, i) => o !== i)) return false;
  }
  return ["passed", "failed", "interrupted"].includes(v.reason) && v.errors.every((e) => ["collection", "suite", "hook", "unhandled"].includes(e.kind));
}

function oracleComplete(v: Inv): boolean {
  if (v.errors.length > 0 || v.files.some((f) => f.collection !== "ok")) return false;
  const withTests = new Set(v.tests.map((t) => t.id[0]));
  if (v.files.length !== withTests.size || v.files.some((f) => !withTests.has(f.file))) return false;
  return v.reason === (v.tests.some((t) => t.status === "failed") ? "failed" : "passed");
}

function oracle(base: Inv, head: Inv, added: string[], expected: string[]): string {
  if (!oracleSchema(base) || !oracleComplete(base) || base.tests.length === 0 || base.tests.some((t) => t.status !== "passed")) return "TEST_BASELINE";
  if (!oracleSchema(head) || !oracleComplete(head)) return "TEST_INVENTORY";
  if (JSON.stringify([...new Set(expected)].sort()) !== JSON.stringify(head.files.map((f) => f.file))) return "TEST_INVENTORY";
  const headCount = new Map<string, number>();
  for (const t of head.tests) headCount.set(JSON.stringify(t.id), (headCount.get(JSON.stringify(t.id)) ?? 0) + 1);
  const baseKeys = new Set<string>();
  for (const t of base.tests) {
    const k = JSON.stringify(t.id);
    baseKeys.add(k);
    const left = headCount.get(k) ?? 0;
    if (left === 0) return "TEST_INVENTORY";
    headCount.set(k, left - 1);
  }
  if (head.tests.some((t) => !baseKeys.has(JSON.stringify(t.id)) && !added.includes(t.id[0]))) return "TEST_INVENTORY";
  return head.tests.some((t) => t.status !== "passed") ? "TEST_STATUS" : "PASS";
}

function corrupt(rng: XorShift32, v: Inv): Inv {
  const tests = v.tests.map((t) => ({ ...t, id: [...t.id] as Id }));
  switch (rng.int(5)) {
    case 0:
      if (tests.length > 0) tests.splice(rng.int(tests.length), 0, { ...tests[rng.int(tests.length)]! });
      break;
    case 1:
      if (tests.length > 0) tests[rng.int(tests.length)]!.id[4] += 1 + rng.int(2);
      break;
    case 2:
      if (tests.length > 0) tests[rng.int(tests.length)]!.status = rng.pick(["pending", "Passed", "aborted"]);
      break;
    case 3:
      if (tests.length > 1) tests.reverse();
      break;
    default:
      return { ...v, files: v.files.map((f, i) => (i === 0 ? { ...f, project: "forge-v02" } : f)) };
  }
  return { ...v, tests };
}

function genCase(rng: XorShift32): { base: Inv; head: Inv; added: string[]; expected: string[] } {
  const spec = (file: string, status = "passed"): Spec => ({ file, anc: [...rng.pick(ANCESTORS)], title: rng.pick(TITLES), status });
  const baseFiles = EXISTING.slice(0, 1 + rng.int(3));
  const baseSpecs: Spec[] = baseFiles.flatMap((f) => Array.from({ length: 1 + rng.int(4) }, () => spec(f)));
  let headSpecs = baseSpecs.map((s) => ({ ...s, anc: [...s.anc] }));
  const added = ADDED.slice(0, rng.int(3));
  for (const f of added) if (rng.chance(0.85)) headSpecs.push(...Array.from({ length: 1 + rng.int(3) }, () => spec(f)));
  let expected = [...new Set([...baseFiles, ...added])];
  let headExtra: Partial<Inv> = {};
  for (let ops = rng.int(4) - 1; ops > 0; ops--) {
    const i = rng.int(headSpecs.length);
    switch (rng.int(10)) {
      case 0: headSpecs.splice(i, 1); break;
      case 1: headSpecs.push(spec(rng.pick(baseFiles))); break;
      case 2: headSpecs[i] = { ...headSpecs[i]!, title: rng.pick(TITLES) }; break;
      case 3: headSpecs[i] = { ...headSpecs[i]!, anc: [...rng.pick(ANCESTORS)] }; break;
      case 4: headSpecs[i] = { ...headSpecs[i]!, status: rng.pick(STATUSES) }; break;
      case 5: headExtra = { ...headExtra, errors: [{ kind: rng.pick(["collection", "suite", "hook", "unhandled"]), testIdentity: null }] }; break;
      case 6: headExtra = { ...headExtra, reason: rng.pick(["interrupted", "passed", "failed"]) }; break;
      case 7: { const f = rng.pick(expected); headSpecs = headSpecs.filter((s) => s.file !== f); break; }
      case 8: expected = rng.chance(0.5) ? [...expected, rng.pick([...EXISTING, ...ADDED])] : expected.slice(1); break;
      default: headSpecs.push(spec(rng.pick(added.length > 0 ? added : ADDED), rng.chance(0.7) ? "passed" : rng.pick(STATUSES)));
    }
  }
  if (headSpecs.length > 0 && rng.chance(0.1)) headSpecs[rng.int(headSpecs.length)]!.status = rng.pick(STATUSES.slice(1));
  let base = inv(baseSpecs);
  if (rng.chance(0.06)) base = inv(baseSpecs.map((s, k) => (k === 0 ? { ...s, status: rng.pick(STATUSES.slice(1)) } : s)));
  if (rng.chance(0.03)) base = { ...base, errors: [{ kind: "hook", testIdentity: null }] };
  if (rng.chance(0.03)) base = corrupt(rng, base);
  let head = inv(headSpecs, headExtra);
  if (rng.chance(0.06)) head = corrupt(rng, head);
  return { base, head, added, expected };
}

describe("Inventory property family", { timeout: 10_000 }, () => {
  it("compare_inventory agrees with the independent oracle on 10,000 generated cases", () => {
    const rng = new XorShift32(SEED);
    const cases = Array.from({ length: ITERATIONS }, () => genCase(rng));
    const responses = py(cases.map((c) => compare(c.base, c.head, c.added, c.expected)));
    const tally = new Map<string, number>();
    cases.forEach((c, i) => {
      const got = outcome(responses[i]!);
      const want = oracle(c.base, c.head, c.added, c.expected);
      if (got !== want) throw new Error(`counterexample #${i}: got ${got}, oracle ${want}: ${JSON.stringify(c)}`);
      tally.set(got, (tally.get(got) ?? 0) + 1);
    });
    for (const code of ["PASS", "TEST_BASELINE", "TEST_INVENTORY", "TEST_STATUS"]) expect(tally.get(code) ?? 0, code).toBeGreaterThan(400);
  }, 20_000);
});
