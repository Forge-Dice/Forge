import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FixtureRepo, b, outcome, py, removeTree, tempRoot, type Call, type Response, type TreeSpec } from "./helpers.ts";

// FORGE-BOOTSTRAP-0001B: policy / taskplan / contract binding and identity (policy.py with the
// real BASE parser through contract-adapter.mjs), exact scope, protection and modes (scope.py)
// over real Git objects and A's history. AV IDs refer to the PKG §15 acceptance matrix.

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const NODE = process.execPath;
const DEV_ID = 337272506;
const OWNER_ID = 315180734;
const REPO_ID = 1401864629;
const TASK = "TASK-0101";
const DEP = "TASK-0100";

const root = tempRoot("policy-scope");
afterAll(() => removeTree(root));
let repoCount = 0;
const newRepo = (): FixtureRepo => new FixtureRepo(join(root, `r${++repoCount}`));

function batch(calls: Record<string, Call>): Record<string, string> {
  const names = Object.keys(calls);
  const responses = py(names.map((n) => calls[n]!));
  return Object.fromEntries(names.map((n, i) => [n, outcome(responses[i]!)]));
}

const sha256 = (data: string | Buffer): string => createHash("sha256").update(data).digest("hex");
const canonical = (value: unknown): string => JSON.stringify(value, null, 2) + "\n";
const b64 = (text: string): string => Buffer.from(text, "utf8").toString("base64");

// ------------------------------------------------------------------------- policy / contract

type Json = Record<string, unknown>;
type Variant = {
  meta?: (m: Json) => void;
  plan?: (p: Json) => void;
  policy?: (p: Json) => void;
  contractText?: (t: string) => string;
  planText?: (t: string) => string;
  policyText?: (t: string) => string;
  files?: TreeSpec;
};

describe("policy, identity and contract binding (BASE parser via contract-adapter.mjs)", () => {
  const repo = newRepo();
  const parserFiles = Object.fromEntries(
    ["contract-document", "primitives", "freeze", "node-sha256"].map((n) => [`${n}.ts`, readFileSync(join(ROOT_DIR, "src/forge", `${n}.ts`), "utf8")]),
  );
  const root0 = repo.commit(repo.tree({ "README.md": "seed\n" }), []);
  const stranger = repo.commit(repo.tree({ "README.md": "other\n" }), []);
  const checks = [
    { name: "typecheck", command: "forge-v01:typecheck" },
    { name: "test", command: "forge-v01:test" },
    { name: "mutations", command: "forge-v01:mutations" },
  ];

  function base(v: Variant = {}): string {
    const meta: Json = {
      forgeContractFormat: 1,
      taskId: TASK,
      contractVersion: 1,
      baseCommit: root0,
      dependencies: [{ taskId: DEP, acceptedCommit: root0 }],
      scope: { create: ["tests/clamp.test.ts"], modify: ["src/clamp.ts"] },
      requiredChecks: checks,
      mutationSmoke: "required",
    };
    v.meta?.(meta);
    let contract = `---json\n${JSON.stringify(meta, null, 2)}\n---\n\n# ${TASK}\n\nClamp negative numbers to zero.\n`;
    if (v.contractText) contract = v.contractText(contract);
    const contractHash = sha256("forge-contract-v1\n" + contract);
    const plan: Json = {
      format: 1,
      taskId: TASK,
      contractHash,
      profile: "DEV",
      approvedTcbPaths: [],
      addedTestFiles: ["tests/clamp.test.ts"],
      checks: (meta["requiredChecks"] as unknown[]).map((c) => ({ ...(c as Json) })),
      mutants: [
        {
          id: "return-n",
          path: "src/clamp.ts",
          anchorBase64: b64("Math.max(0, n)"),
          replacementBase64: b64("n"),
          testFiles: ["tests/clamp.test.ts"],
          namedTests: [["tests/clamp.test.ts", "forge-v01", ["clampAtZero"], "negative", 0]],
        },
      ],
    };
    v.plan?.(plan);
    let planText = canonical(plan);
    if (v.planText) planText = v.planText(planText);
    const entry = (taskId: string, contractHash: string, planHash: string) => ({
      taskId,
      contractPath: `forge/contracts/${taskId}.md`,
      contractHash,
      planPath: `forge/verifier/plans/${taskId}.json`,
      planHash,
    });
    const policy: Json = {
      format: 1,
      repoId: REPO_ID,
      ownerId: OWNER_ID,
      developers: [{ id: DEV_ID, provider: "codex", namespacePrefix: "forge/run/codex/" }],
      imageDigest: `sha256:${"a".repeat(64)}`,
      bootstrapVersion: 1,
      deploymentPolicyDigest: "b".repeat(64),
      limitsProfile: "v01",
      taskIndex: [entry(DEP, "0".repeat(64), "0".repeat(64)), entry(TASK, contractHash, sha256("forge-plan-v1\n" + planText))],
    };
    v.policy?.(policy);
    let policyText = canonical(policy);
    if (v.policyText) policyText = v.policyText(policyText);
    const spec: TreeSpec = {
      forge: {
        contracts: { [`${TASK}.md`]: contract },
        verifier: { "policy.json": policyText, plans: { [`${TASK}.json`]: planText } },
      },
      src: { "clamp.ts": "export const clampAtZero = (n: number) => Math.max(0, n);\n", forge: { ...parserFiles } },
      tests: { "existing.test.ts": "// existing\n" },
      ...v.files,
    };
    return repo.commit(repo.tree(spec), [root0]);
  }

  const devBranch = `forge/run/codex/${TASK}/clamp-1`;
  const call = (commit: string, actor = DEV_ID, branch = devBranch, extra: Json = {}): Call => ({
    fn: "policy.gate_task",
    args: [repo.store(), commit, actor, REPO_ID, branch],
    kwargs: { parser_root: ROOT_DIR, node: NODE, private: repo.private, ...extra },
  });

  const tamperedRoot = join(root, "tampered");
  let r: Record<string, string> = {};
  let passResult: Response | undefined;
  let calls: Record<string, Call> = {};
  // Two batches in two hooks keep each hook well under 5 s (most calls start the Node adapter once).
  const run = (names: string[]): void => {
    const responses = py(names.map((n) => calls[n]!));
    names.forEach((n, i) => (r[n] = outcome(responses[i]!)));
    if (names[0] === "pass") passResult = responses[0];
  };

  beforeAll(() => {
    mkdirSync(join(tamperedRoot, "src/forge"), { recursive: true });
    for (const [name, text] of Object.entries(parserFiles)) writeFileSync(join(tamperedRoot, "src/forge", name), text, "utf8");
    writeFileSync(join(tamperedRoot, "src/forge/freeze.ts"), parserFiles["freeze.ts"] + "// tampered\n", "utf8");
    const good = base();
    const owner = base({ plan: (p) => void (p["profile"] = "OWNER_OPS") });
    calls = {
      pass: call(good),
      ownerPass: call(owner, OWNER_ID, `forge/owner/${TASK}/fix-1`),
      av093: call(good, DEV_ID + 1),
      av094: { ...call(good), args: [repo.store(), good, DEV_ID, REPO_ID + 1, devBranch] },
      av095: call(good, DEV_ID, `forge/run/claude/${TASK}/clamp-1`),
      av095suffix: call(good, DEV_ID, `forge/run/codex/${TASK}/Clamp`),
      av095ownerNs: call(good, OWNER_ID, devBranch),
      av096branch: call(good, DEV_ID, `forge/run/codex/TASK-0999/clamp-1`),
      av096contract: call(base({ meta: (m) => void (m["taskId"] = "TASK-0102") })),
      av097: call(base({ contractText: (t) => t.replace('"forgeContractFormat": 1', '"forgeContractFormat":  1') })),
      av098: call(base({ meta: (m) => void (m["dependencies"] = [{ taskId: DEP, acceptedCommit: null }]) })),
      av099: call(base({ meta: (m) => void (m["dependencies"] = [{ taskId: DEP, acceptedCommit: stranger }]) })),
      depUnknown: call(base({ meta: (m) => void (m["dependencies"] = [{ taskId: "TASK-0777", acceptedCommit: root0 }]) })),
      av100: call(base({ meta: (m) => void (m["requiredChecks"] = [...checks, { name: "test", command: "forge-v01:test" }]) })),
      av101: call(
        base({ meta: (m) => void (m["requiredChecks"] = [checks[0], { name: "test", command: "npm test" }, checks[2]]) }),
      ),
      baseCommitForeign: call(base({ meta: (m) => void (m["baseCommit"] = stranger) })),
      contractHashIndex: call(base({ policy: (p) => void ((p["taskIndex"] as Json[])[1]!["contractHash"] = "c".repeat(64)) })),
      planHashIndex: call(base({ policy: (p) => void ((p["taskIndex"] as Json[])[1]!["planHash"] = "c".repeat(64)) })),
      planContractHash: call(base({ plan: (p) => void (p["contractHash"] = "c".repeat(64)) })),
      planChecks: call(base({ plan: (p) => void (p["checks"] = (p["checks"] as unknown[]).slice().reverse()) })),
      planTask: call(base({ plan: (p) => void (p["taskId"] = "TASK-0102") })),
      profileMismatch: call(owner),
      smokeNoMutants: call(base({ plan: (p) => void (p["mutants"] = []) })),
      av135: call(base({ plan: (p) => void ((p["mutants"] as Json[])[0]!["path"] = "tests/clamp.test.ts") })),
      addedNotInScope: call(base({ plan: (p) => void (p["addedTestFiles"] = ["tests/clamp.test.ts", "tests/other.test.ts"]) })),
      devTcb: call(base({ plan: (p) => void (p["approvedTcbPaths"] = ["src/clamp.ts"]) })),
      parserTampered: call(good, DEV_ID, devBranch, { parser_root: tamperedRoot }),
      parserImport: call(base({ files: { src: { "clamp.ts": "x\n", forge: { ...parserFiles, "freeze.ts": 'import "./evil.ts";\n' } } } })),
      policyMissing: call(repo.commit(repo.tree({ "README.md": "x\n" }), [root0])),
      policyCrlf: call(base({ policyText: (t) => t.replace("\n", "\r\n") })),
      policyNoFinalLf: call(base({ policyText: (t) => t.slice(0, -1) })),
      policyDupKey: call(base({ policyText: (t) => t.replace('"format": 1,', '"format": 1,\n  "format": 1,') })),
      policyUnknownKey: call(base({ policy: (p) => void (p["extra"] = 1) })),
      policyKeyOrder: call(base({ policy: (p) => void (delete p["format"], (p["format"] = 1)) })),
      policyLimits: call(base({ policy: (p) => void (p["limitsProfile"] = "v02") })),
      planBom: call(base({ planText: (t) => "\ufeff" + t })),
      planFloat: call(base({ planText: (t) => t.replace('"format": 1', '"format": 1.0') })),
    };
    const names = Object.keys(calls);
    run(names.slice(0, names.indexOf("planContractHash")));
  });
  beforeAll(() => {
    const names = Object.keys(calls);
    run(names.slice(names.indexOf("planContractHash")));
  });

  it("valid DEV task: real BASE parser, hashes, plan, ancestry and dependency all bind", () => {
    expect(r["pass"]).toBe("PASS");
    const ok = passResult!.ok as Json;
    expect(ok["profile"]).toBe("DEV");
    expect(ok["taskId"]).toBe(TASK);
    expect((ok["metadata"] as Json)["mutationSmoke"]).toBe("required");
    expect(ok["policyHash"]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("valid OWNER_OPS task on the owner namespace", () => expect(r["ownerPass"]).toBe("PASS"));
  it("AV-093 wrong numeric actor id → IDENTITY_ACTOR", () => expect(r["av093"]).toBe("IDENTITY_ACTOR"));
  it("AV-094 fork (other head repository id) with identical branch → IDENTITY_ACTOR", () => expect(r["av094"]).toBe("IDENTITY_ACTOR"));
  it("AV-095 wrong codex namespace, bad suffix or owner on DEV namespace → IDENTITY_NAMESPACE", () => {
    expect([r["av095"], r["av095suffix"], r["av095ownerNs"]]).toEqual(["IDENTITY_NAMESPACE", "IDENTITY_NAMESPACE", "IDENTITY_NAMESPACE"]);
  });
  it("AV-096 precedence: unregistered branch TASK → IDENTITY_NAMESPACE; contract task ≠ registered task → CONTRACT_BINDING", () => {
    expect(r["av096branch"]).toBe("IDENTITY_NAMESPACE");
    expect(r["av096contract"]).toBe("CONTRACT_BINDING");
  });
  it("AV-097 contract frontmatter not canonical JSON → CONTRACT_PARSE", () => expect(r["av097"]).toBe("CONTRACT_PARSE"));
  it("AV-098 dependency acceptedCommit null → CONTRACT_DEPENDENCY", () => expect(r["av098"]).toBe("CONTRACT_DEPENDENCY"));
  it("AV-099 dependency commit not in BASE ancestry (or unknown task) → CONTRACT_DEPENDENCY", () => {
    expect(r["av099"]).toBe("CONTRACT_DEPENDENCY");
    expect(r["depUnknown"]).toBe("CONTRACT_DEPENDENCY");
  });
  it("AV-100 duplicate requiredCheck name → CONTRACT_PARSE", () => expect(r["av100"]).toBe("CONTRACT_PARSE"));
  it("AV-101 unregistered shell command in the contract → POLICY_INVALID", () => expect(r["av101"]).toBe("POLICY_INVALID"));
  it("contract baseCommit outside BASE ancestry → CONTRACT_BINDING", () => expect(r["baseCommitForeign"]).toBe("CONTRACT_BINDING"));
  it("contract hash, plan hash, plan contractHash, checks order and plan task must bind → CONTRACT_BINDING", () => {
    expect([r["contractHashIndex"], r["planHashIndex"], r["planContractHash"], r["planChecks"], r["planTask"], r["addedNotInScope"]]).toEqual(
      Array(6).fill("CONTRACT_BINDING"),
    );
  });
  it("plan profile must match the actor profile → IDENTITY_NAMESPACE", () => expect(r["profileMismatch"]).toBe("IDENTITY_NAMESPACE"));
  it("mutationSmoke required without mutants, AV-135 mutant on a test file, DEV with TCB paths → POLICY_INVALID", () => {
    expect([r["smokeNoMutants"], r["av135"], r["devTcb"]]).toEqual(["POLICY_INVALID", "POLICY_INVALID", "POLICY_INVALID"]);
  });
  it("parser root differing from BASE bytes or a BASE parser with a foreign import → POLICY_INVALID", () => {
    expect(r["parserTampered"]).toBe("POLICY_INVALID");
    expect(r["parserImport"]).toBe("POLICY_INVALID");
  });
  it("policy and plan JSON must be strict canonical (missing, CRLF, no final LF, dup key, extra key, key order, BOM, float) → POLICY_INVALID", () => {
    const names = ["policyMissing", "policyCrlf", "policyNoFinalLf", "policyDupKey", "policyUnknownKey", "policyKeyOrder", "policyLimits", "planBom", "planFloat"];
    expect(names.map((n) => r[n])).toEqual(Array(names.length).fill("POLICY_INVALID"));
  });
});

describe("contract-adapter.mjs: strict UTF-8 and issue codes only", () => {
  const meta = {
    forgeContractFormat: 1,
    taskId: "FORGE-FIXTURE-0001",
    contractVersion: 3,
    baseCommit: "a".repeat(40),
    dependencies: [],
    scope: { create: ["src/free.ts"], modify: [] },
    requiredChecks: [{ name: "typecheck", command: "forge-v01:typecheck" }],
    mutationSmoke: "none",
  };
  const contract = Buffer.from(`---json\n${JSON.stringify(meta, null, 2)}\n---\n\n# Fixture — non-ASCII body ✓\n`, "utf8");
  let r: Record<string, string> = {};
  let ok: Response | undefined;
  beforeAll(() => {
    const priv = join(root, "adapter-private");
    const parse = (raw: Buffer): Call => ({ fn: "policy.parse_contract", args: [b(raw), ROOT_DIR], kwargs: { node: NODE, private: priv } });
    const calls = {
      ok: parse(contract),
      invalidUtf8: parse(Buffer.concat([contract, Buffer.from([0xff])])),
      bom: parse(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), contract])),
      cr: parse(Buffer.from(contract.toString("latin1").replace("\n", "\r\n"), "latin1")),
      tooLarge: parse(Buffer.alloc(256 * 1024 + 1, 0x61)),
    };
    const names = Object.keys(calls);
    const responses = py(names.map((n) => calls[n as keyof typeof calls]));
    r = Object.fromEntries(names.map((n, i) => [n, outcome(responses[i]!)]));
    ok = responses[0];
  });
  it("parses a real BASE contract and reports the parser's content hash", () => {
    expect(r["ok"]).toBe("PASS");
    const value = ok!.ok as Json;
    expect(value["taskId"]).toBe("FORGE-FIXTURE-0001");
    expect(value["contractVersion"]).toBe(3);
    expect(value["contentHash"]).toBe(sha256(Buffer.concat([Buffer.from("forge-contract-v1\n"), contract])));
  });
  it("invalid UTF-8, BOM, CR and over-limit input → CONTRACT_PARSE", () => {
    expect([r["invalidUtf8"], r["bom"], r["cr"], r["tooLarge"]]).toEqual(Array(4).fill("CONTRACT_PARSE"));
  });
});

// ------------------------------------------------------------------------------------ scope

type Plan = { addedTestFiles: string[]; approvedTcbPaths: string[] };
type Scope = { create: string[]; modify: string[] };
const CONTRACT = "forge/contracts/T-1.md";
const DEFAULT_SCOPE: Scope = { create: ["src/new.ts", "tests/new.test.ts"], modify: ["src/a.ts"] };

describe("scope, protection and modes over real commits (every step and the net diff)", () => {
  const repo = newRepo();
  const baseSpec = (): TreeSpec => ({
    "package.json": "{}\n",
    "package-lock.json": "{}\n",
    "tsconfig.json": "{}\n",
    ".github": { workflows: { "ci.yml": "on: push\n" } },
    forge: { contracts: { "T-1.md": "contract\n" }, verifier: { "policy.json": "{}\n" } },
    src: { "a.ts": "a\n", "b.ts": "b\n", "run.ts": { mode: "100755", oid: repo.blob("run\n") }, forge: { "kernel.ts": "k\n" } },
    tests: { "a.test.ts": "t\n", fixtures: { "f.json": "{}\n" } },
    tools: { forge_v01: { "main.py": "m\n" } },
  });
  const baseCommit = repo.commit(repo.tree(baseSpec()), []);
  type Edit = (spec: TreeSpec) => void;
  const srcOf = (s: TreeSpec) => s["src"] as TreeSpec;
  const modifyA: Edit = (s) => void (srcOf(s)["a.ts"] = "a2\n");

  /** Linear chain above BASE; each element edits a fresh copy of the previous snapshot spec. */
  function chain(...edits: Edit[][]): string {
    let spec = baseSpec();
    let parent = baseCommit;
    for (const group of edits) {
      spec = structuredClone(spec);
      for (const edit of group) edit(spec);
      parent = repo.commit(repo.tree(spec), [parent]);
    }
    return parent;
  }
  const head = (...edits: Edit[]): string => chain(edits);

  type Case = { head: string; scope?: Scope; plan?: Plan; profile?: "DEV" | "OWNER_OPS" };
  const cases: Record<string, Case> = {};
  let r: Record<string, string> = {};

  beforeAll(() => {
    const add = (path: string, value: string | { mode: string; oid: string } = "new\n"): Edit => (s) => {
      const parts = path.split("/");
      let node = s;
      for (const part of parts.slice(0, -1)) node = (node[part] ??= {}) as TreeSpec;
      node[parts.at(-1)!] = value;
    };
    const del = (path: string): Edit => (s) => {
      const parts = path.split("/");
      let node = s;
      for (const part of parts.slice(0, -1)) node = node[part] as TreeSpec;
      delete node[parts.at(-1)!];
    };
    const blobA = repo.blob("a\n");
    const blobA2 = repo.blob("a2\n");
    Object.assign(cases, {
      av059: { head: head(modifyA) },
      av060: { head: head(modifyA) },
      av060content: { head: head(add("src/run.ts", { mode: "100755", oid: repo.blob("run2\n") })), scope: { create: [], modify: ["src/run.ts"] } },
      av061: { head: head(add("src/new.ts", { mode: "100755", oid: repo.blob("x\n") })) },
      av062: { head: head(add("src/new.ts", { mode: "120000", oid: repo.blob("a.ts") })) },
      av063: { head: head(add("src/new.ts", { mode: "160000", oid: baseCommit })) },
      av064: { head: head(add("src/new.ts", { mode: "100600", oid: repo.blob("x\n") })) },
      av065: { head: head(add("src/a.ts", { mode: "100755", oid: blobA })) },
      av066: { head: head(add("src/a.ts", { mode: "100755", oid: blobA2 })) },
      av074: { head: chain([modifyA, add(".github/workflows/ci.yml", "on: pull_request_target\n")], [del(".github/workflows/ci.yml"), add(".github/workflows/ci.yml", "on: push\n")]) },
      revertedScope: { head: chain([modifyA, add("src/extra.ts")], [del("src/extra.ts")]) },
      revertedNetOnly: { head: head(modifyA) },
      av075: { head: head(add("src/missing.ts")), scope: { create: [], modify: ["src/missing.ts"] } },
      av076: { head: head(add("src/b.ts", "b2\n")), scope: { create: ["src/b.ts"], modify: [] } },
      av077: { head: head(del("src/a.ts"), add("src/a2.ts", "a\n")), scope: { create: ["src/a2.ts"], modify: ["src/a.ts"] } },
      av078: { head: head(modifyA, add("src/extra.ts")) },
      av079: { head: head(del("src/a.ts"), add("src/a.ts/escape.ts")), scope: { create: ["src/a.ts/escape.ts"], modify: ["src/a.ts"] } },
      av080: { head: head(modifyA, add("forge/coordination/CODEX.md")) },
      av081: { head: head(modifyA, add(CONTRACT, "changed\n")) },
      av081owner: { head: head(add(CONTRACT, "changed\n")), profile: "OWNER_OPS", scope: { create: [], modify: [CONTRACT] }, plan: { addedTestFiles: [], approvedTcbPaths: [CONTRACT] } },
      av082: { head: head(add("package.json", '{"scripts":{"test":"curl x"}}\n')), scope: { create: [], modify: ["package.json"] } },
      av083: { head: head(add("package-lock.json", "{ }\n")), scope: { create: [], modify: ["package-lock.json"] } },
      av084: { head: head(add("vitest.config.ts", "export default {}\n")), scope: { create: ["vitest.config.ts"], modify: [] } },
      av084src: { head: head(add("src/vitest.config.ts", "export default {}\n")), scope: { create: ["src/vitest.config.ts"], modify: [] } },
      av085: { head: head(add("tsconfig.json", '{"include":[]}\n')), scope: { create: [], modify: ["tsconfig.json"] } },
      av086: { head: head(add("tests/a.test.ts", "t2\n")), scope: { create: [], modify: ["tests/a.test.ts"] } },
      av086fixture: { head: head(add("tests/fixtures/f.json", "[]\n")), scope: { create: [], modify: ["tests/fixtures/f.json"] } },
      av087: { head: head(del("tests/a.test.ts")) },
      av088: { head: head(del("tests/a.test.ts"), add("tests/b.test.ts", "t\n")), scope: { create: ["tests/b.test.ts"], modify: [] }, plan: { addedTestFiles: ["tests/b.test.ts"], approvedTcbPaths: [] } },
      av089: { head: head(modifyA, add("tests/new.test.ts", "it\n")) },
      unapprovedTest: { head: head(add("tests/new.test.ts", "it\n")), plan: { addedTestFiles: [], approvedTcbPaths: [] } },
      av090: { head: head(add("tools/forge_v01/main.py", "evil\n")), scope: { create: [], modify: ["tools/forge_v01/main.py"] } },
      av090workflow: { head: head(add(".github/workflows/ci.yml", "x\n")), scope: { create: [], modify: [".github/workflows/ci.yml"] } },
      av090kernel: { head: head(add("src/forge/kernel.ts", "k2\n")), scope: { create: [], modify: ["src/forge/kernel.ts"] } },
      av091: {
        head: head(add("tools/forge_v01/main.py", "m2\n"), add("tools/forge_v01/vitest.config.mjs", "export default {}\n")),
        profile: "OWNER_OPS",
        scope: { create: ["tools/forge_v01/vitest.config.mjs"], modify: ["tools/forge_v01/main.py"] },
        plan: { addedTestFiles: [], approvedTcbPaths: ["tools/forge_v01/main.py", "tools/forge_v01/vitest.config.mjs"] },
      },
      av091unapproved: {
        head: head(add("tools/forge_v01/main.py", "m2\n")),
        profile: "OWNER_OPS",
        scope: { create: [], modify: ["tools/forge_v01/main.py"] },
        plan: { addedTestFiles: [], approvedTcbPaths: [] },
      },
      av092tests: { head: head(add("tests/a.test.ts", "t2\n")), profile: "OWNER_OPS", scope: { create: [], modify: ["tests/a.test.ts"] }, plan: { addedTestFiles: [], approvedTcbPaths: [] } },
      av092lock: { head: head(add("package-lock.json", "{ }\n")), profile: "OWNER_OPS", scope: { create: [], modify: ["package-lock.json"] }, plan: { addedTestFiles: [], approvedTcbPaths: [] } },
      npmrc: { head: head(add("src/.npmrc", "registry=x\n")), scope: { create: ["src/.npmrc"], modify: [] } },
      env: { head: head(add("src/.env.local", "K=v\n")), scope: { create: ["src/.env.local"], modify: [] } },
      modeBeatsProtected: { head: head(add(".github/x.yml", { mode: "120000", oid: repo.blob("y") })) },
      b1: { head: head(modifyA, add("src/a.ts-extra.ts", "export const x = 1;\n")), scope: { create: [], modify: ["src/a.ts"] } },
      b5: { head: head(add("src/new.ts"), add("forge/coordination/CODEX.md", "note\n")) },
      b5control: { head: head(add("src/new.ts")) },
      planOutsideScope: { head: head(modifyA), plan: { addedTestFiles: ["tests/zzz.test.ts"], approvedTcbPaths: [] } },
    } satisfies Record<string, Case>);
    const names = Object.keys(cases);
    const responses = py(
      names.map((n): Call => {
        const c = cases[n]!;
        const scope = c.scope ?? DEFAULT_SCOPE;
        const plan = c.plan ?? { addedTestFiles: scope.create.filter((p) => p.startsWith("tests/")), approvedTcbPaths: [] };
        return { fn: "scope.check_scope_for", args: [repo.store(), baseCommit, c.head, plan, scope, c.profile ?? "DEV", CONTRACT] };
      }),
    );
    r = Object.fromEntries(names.map((n, i) => [n, outcome(responses[i]!)]));
  });

  it("AV-059 regular 100644 change → PASS", () => expect(r["av059"]).toBe("PASS"));
  it("AV-060 BASE 100755 file kept unchanged (and content change keeping 100755) → PASS", () => {
    expect([r["av060"], r["av060content"]]).toEqual(["PASS", "PASS"]);
  });
  it("AV-061 new file with 100755 → SCOPE_MODE", () => expect(r["av061"]).toBe("SCOPE_MODE"));
  it("AV-062 symlink 120000 → SCOPE_MODE", () => expect(r["av062"]).toBe("SCOPE_MODE"));
  it("AV-063 gitlink 160000 → SCOPE_MODE", () => expect(r["av063"]).toBe("SCOPE_MODE"));
  it("AV-064 unknown mode 100600 → SCOPE_MODE", () => expect(r["av064"]).toBe("SCOPE_MODE"));
  it("AV-065 100644 → 100755 with the same blob → SCOPE_MODE", () => expect(r["av065"]).toBe("SCOPE_MODE"));
  it("AV-066 content and mode changed together → SCOPE_MODE", () => expect(r["av066"]).toBe("SCOPE_MODE"));
  it("AV-074 workflow edit in an intermediate commit, reverted later → SCOPE_PROTECTED", () => expect(r["av074"]).toBe("SCOPE_PROTECTED"));
  it("intermediate-commit scope violation reverted later → SCOPE_PATH (the net diff alone passes)", () => {
    expect(r["revertedScope"]).toBe("SCOPE_PATH");
    expect(r["revertedNetOnly"]).toBe("PASS");
  });
  it("AV-075 allowed MODIFY path absent in BASE → SCOPE_PATH", () => expect(r["av075"]).toBe("SCOPE_PATH"));
  it("AV-076 allowed ADD path already in BASE → SCOPE_PATH", () => expect(r["av076"]).toBe("SCOPE_PATH"));
  it("AV-077 rename of an allowed file → SCOPE_PATH", () => expect(r["av077"]).toBe("SCOPE_PATH"));
  it("AV-078 extra file outside the exact scope → SCOPE_PATH", () => expect(r["av078"]).toBe("SCOPE_PATH"));
  it("AV-079 scope src/a.ts abused as prefix for src/a.ts/escape.ts → SCOPE_PATH", () => expect(r["av079"]).toBe("SCOPE_PATH"));
  it("AV-080 forge/coordination/CODEX.md without scope → SCOPE_PATH", () => expect(r["av080"]).toBe("SCOPE_PATH"));
  it("AV-081 change of the active contract (DEV, and OWNER_OPS even if listed) → SCOPE_PROTECTED", () => {
    expect([r["av081"], r["av081owner"]]).toEqual(["SCOPE_PROTECTED", "SCOPE_PROTECTED"]);
  });
  it("AV-082 package.json script change → SCOPE_PROTECTED", () => expect(r["av082"]).toBe("SCOPE_PROTECTED"));
  it("AV-083 package-lock.json change → SCOPE_PROTECTED", () => expect(r["av083"]).toBe("SCOPE_PROTECTED"));
  it("AV-084 Vitest config added in HEAD (root or under src/) → SCOPE_PROTECTED", () => {
    expect([r["av084"], r["av084src"]]).toEqual(["SCOPE_PROTECTED", "SCOPE_PROTECTED"]);
  });
  it("AV-085 tsconfig include shrunk → SCOPE_PROTECTED", () => expect(r["av085"]).toBe("SCOPE_PROTECTED"));
  it("AV-086 existing test or fixture changed → SCOPE_PROTECTED", () => {
    expect([r["av086"], r["av086fixture"]]).toEqual(["SCOPE_PROTECTED", "SCOPE_PROTECTED"]);
  });
  it("AV-087 test file deleted → SCOPE_PATH", () => expect(r["av087"]).toBe("SCOPE_PATH"));
  it("AV-088 test file renamed → SCOPE_PATH", () => expect(r["av088"]).toBe("SCOPE_PATH"));
  it("AV-089 approved new test file in scope → PASS; unapproved new test → SCOPE_PATH", () => {
    expect([r["av089"], r["unapprovedTest"]]).toEqual(["PASS", "SCOPE_PATH"]);
  });
  it("AV-090 DEV changes verifier, workflow or src/forge → SCOPE_PROTECTED", () => {
    expect([r["av090"], r["av090workflow"], r["av090kernel"]]).toEqual(Array(3).fill("SCOPE_PROTECTED"));
  });
  it("AV-091 OWNER_OPS changes exactly approved TCB files → PASS; unapproved TCB file → SCOPE_PROTECTED", () => {
    expect([r["av091"], r["av091unapproved"]]).toEqual(["PASS", "SCOPE_PROTECTED"]);
  });
  it("AV-092 OWNER_OPS changes existing tests or the lockfile → SCOPE_PROTECTED", () => {
    expect([r["av092tests"], r["av092lock"]]).toEqual(["SCOPE_PROTECTED", "SCOPE_PROTECTED"]);
  });
  it(".npmrc and .env.* anywhere are protected; mode rule outranks protection", () => {
    expect([r["npmrc"], r["env"], r["modeBeatsProtected"]]).toEqual(["SCOPE_PROTECTED", "SCOPE_PROTECTED", "SCOPE_MODE"]);
  });
  it("addedTestFiles outside contract scope → CONTRACT_BINDING", () => expect(r["planOutsideScope"]).toBe("CONTRACT_BINDING"));

  it("mutant B1: modify scope src/a.ts plus unapproved ADD src/a.ts-extra.ts → SCOPE_PATH (exact membership, no startsWith)", () => {
    expect(r["b1"]).toBe("SCOPE_PATH");
  });
  it("mutant B5: ADD forge/coordination/CODEX.md without scope → SCOPE_PATH (no coordination exception)", () => {
    expect(r["b5control"]).toBe("PASS");
    expect(r["b5"]).toBe("SCOPE_PATH");
  });
});
