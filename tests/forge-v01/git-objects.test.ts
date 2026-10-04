import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { FixtureRepo, b, outcome, py, removeTree, tempRoot, type Call, type Response, type TreeSpec } from "./helpers.ts";

// FORGE-BOOTSTRAP-0001A: framed object reads, tree/commit parsing, snapshots, diffs and history.
// Each describe builds its fixtures once and runs all driver calls in one Python process.

type Leaf = { path: string; mode: string; oid: string };
type Change = { path: string; kinds: string[]; base: Leaf | null; head: Leaf | null };
type Snapshot = { tree: string; leaves: Leaf[] };
type History = { commits: { oid: string }[]; snapshots: Snapshot[]; base_snapshot: Snapshot; steps: Change[][]; net: Change[] };

const MISSING = "0123456789abcdef0123456789abcdef01234567";
const MiB = 1024 * 1024;

const root = tempRoot("git-objects");
afterAll(() => removeTree(root));

let repoCount = 0;
function newRepo(): FixtureRepo {
  repoCount += 1;
  return new FixtureRepo(`${root}/r${repoCount}`);
}

/** Runs named calls in one driver process. */
function batch(calls: Record<string, Call>): Record<string, Response> {
  const names = Object.keys(calls);
  const responses = py(names.map((n) => calls[n]!));
  return Object.fromEntries(names.map((n, i) => [n, responses[i]!]));
}

function get(results: Record<string, Response>, name: string): Response {
  const r = results[name];
  if (r === undefined) throw new Error(`no result ${name}`);
  return r;
}

const brief = (changes: Change[]): string[] => changes.map((c) => `${c.kinds.join("+")} ${c.path}`);

function rawCommit(repo: FixtureRepo, headerLines: string[], message = "m"): string {
  const lines = [...headerLines, "author fixture <fixture@example.invalid> 1700000000 +0000", "committer fixture <fixture@example.invalid> 1700000000 +0000"];
  return repo.writeRaw("commit", Buffer.from(`${lines.join("\n")}\n\n${message}\n`, "latin1"));
}

/** A valid, sorted raw tree of exactly `size` bytes (493446 entries of 34 bytes + one of 52). */
function exactTree(repo: FixtureRepo, size: number, blob: string): string {
  const oid = Buffer.from(blob, "hex");
  const full = Math.floor((size - 52) / 34);
  if (full * 34 + 52 !== size) throw new Error("size not reachable");
  const out = Buffer.alloc(size);
  let pos = 0;
  for (let i = 0; i < full; i++) {
    pos += out.write(`100644 ${String(i).padStart(6, "0")}\0`, pos, "latin1");
    pos += oid.copy(out, pos);
  }
  pos += out.write(`100644 ${"z".repeat(24)}\0`, pos, "latin1");
  pos += oid.copy(out, pos);
  if (pos !== size) throw new Error("tree size mismatch");
  return repo.writeRaw("tree", out);
}

describe("objects: framing, commits, trees", () => {
  let r: Record<string, Response> = {};

  beforeAll(() => {
    const repo = newRepo();
    const s = repo.store();
    const blobA = repo.blob("a\n");
    const blobB = repo.blob("b\n");
    const okTree = repo.tree({ a: "a\n", b: "b\n" });
    const okCommit = repo.commit(okTree, []);

    const dupTree = repo.rawTree([
      { mode: "100644", name: "a", oid: blobA },
      { mode: "100644", name: "a", oid: blobB },
    ]);
    const unsorted = repo.rawTree([
      { mode: "100644", name: "b", oid: blobB },
      { mode: "100644", name: "a", oid: blobA },
    ]);
    const sub = repo.tree({ x: "x\n" });
    // Git order compares a directory as "a/": "a.b" (0x2e) sorts before "a/" (0x2f).
    const dirOrderOk = repo.rawTree([
      { mode: "100644", name: "a.b", oid: blobA },
      { mode: "40000", name: "a", oid: sub },
    ]);
    const dirOrderBad = repo.rawTree([
      { mode: "40000", name: "a", oid: sub },
      { mode: "100644", name: "a.b", oid: blobA },
    ]);
    const leadingZeroMode = repo.rawTree([{ mode: "0100644", name: "a", oid: blobA }]);
    const nonOctalMode = repo.rawTree([{ mode: "100648", name: "a", oid: blobA }]);
    const trailingGarbage = repo.writeRaw("tree", Buffer.concat([
      Buffer.from("100644 a\0", "latin1"), Buffer.from(blobA, "hex"), Buffer.from("100644 b\0", "latin1"), Buffer.from("abc"),
    ]));

    const twoTrees = rawCommit(repo, [`tree ${okTree}`, `tree ${okTree}`]);
    const contTree = rawCommit(repo, [`tree ${okTree}`, " continued"]);
    const contParent = rawCommit(repo, [`tree ${okTree}`, `parent ${okCommit}`, " continued"]);
    const gpgsig = rawCommit(repo, [`tree ${okTree}`, `parent ${okCommit}`, "author x <x@example.invalid> 1 +0000", "gpgsig -----BEGIN-----", " line", " -----END-----"]);
    const lateParent = repo.writeRaw("commit", Buffer.from(`tree ${okTree}\nauthor x <x@example.invalid> 1 +0000\nparent ${okCommit}\n\nm\n`, "latin1"));
    const badTreeHex = rawCommit(repo, [`tree ${okTree.toUpperCase()}`]);
    const noTree = repo.writeRaw("commit", Buffer.from("author x <x@example.invalid> 1 +0000\n\nm\n", "latin1"));
    const noBlank = repo.writeRaw("commit", Buffer.from(`tree ${okTree}\n`, "latin1"));

    // AV-179: exact-limit objects (highly compressible, small on disk).
    const blob8 = repo.blob(Buffer.alloc(8 * MiB, 0x61));
    const blob8p1 = repo.blob(Buffer.alloc(8 * MiB + 1, 0x61));
    const tree16 = exactTree(repo, 16 * MiB, blobA);
    const ten = [0, 1, 2, 3].map((i) => repo.blob(`012345678${i}`));

    // collect_tree fixtures.
    const caseFile = repo.tree({ "A.ts": "1", "a.ts": "2" });
    const caseDir = repo.tree({ Dir: { a: "1" }, dir: { b: "2" } });
    const fileAndDir = repo.rawTree([
      { mode: "100644", name: "a", oid: blobA },
      { mode: "40000", name: "a", oid: repo.tree({ b: "1" }) },
    ]);
    const upperFileLowerDir = repo.tree({ A: "1", a: { b: "2" } });
    const disjoint = repo.tree({ x: { a: "1", b: "2" } });
    const modes = repo.tree({
      exe: { mode: "100755", oid: blobA },
      gitlink: { mode: "160000", oid: MISSING },
      link: { mode: "120000", oid: repo.blob("target") },
      odd: { mode: "100600", oid: blobB },
    });
    const blobAsTree = repo.tree({ d: { mode: "40000", oid: blobA } });
    const missingBlob = repo.tree({ f: { mode: "100644", oid: MISSING } });
    const treeAsBlob = repo.tree({ f: { mode: "100644", oid: sub } });
    const badMode = repo.tree({ f: { mode: "100648", oid: blobA } });
    const badPath = repo.tree({ "a b": "1" });

    r = batch({
      dup: { fn: "objects.read_tree", args: [s, dupTree] },
      unsorted: { fn: "objects.read_tree", args: [s, unsorted] },
      dirOrderOk: { fn: "objects.read_tree", args: [s, dirOrderOk] },
      dirOrderBad: { fn: "objects.read_tree", args: [s, dirOrderBad] },
      leadingZeroMode: { fn: "objects.read_tree", args: [s, leadingZeroMode] },
      nonOctalMode: { fn: "objects.read_tree", args: [s, nonOctalMode] },
      trailingGarbage: { fn: "objects.read_tree", args: [s, trailingGarbage] },
      okTree: { fn: "objects.read_tree", args: [s, okTree] },
      okCommit: { fn: "objects.read_commit", args: [s, okCommit] },
      twoTrees: { fn: "objects.read_commit", args: [s, twoTrees] },
      contTree: { fn: "objects.read_commit", args: [s, contTree] },
      contParent: { fn: "objects.read_commit", args: [s, contParent] },
      gpgsig: { fn: "objects.read_commit", args: [s, gpgsig] },
      lateParent: { fn: "objects.read_commit", args: [s, lateParent] },
      badTreeHex: { fn: "objects.read_commit", args: [s, badTreeHex] },
      noTree: { fn: "objects.read_commit", args: [s, noTree] },
      noBlank: { fn: "objects.read_commit", args: [s, noBlank] },
      commitOnTree: { fn: "objects.read_commit", args: [s, okTree] },
      treeOnCommit: { fn: "objects.read_tree", args: [s, okCommit] },
      missingCommit: { fn: "objects.read_commit", args: [s, MISSING] },
      nonHex: { fn: "objects.read_commit", args: [s, okCommit.toUpperCase()] },
      av179: { fn: "objects.read_sizes", args: [s, [[blob8, "blob"], [tree16, "tree"]]] },
      av179Tree: { fn: "objects.read_sizes", args: [s, [[tree16, "tree"]]] },
      av179b: { fn: "objects.read_sizes", args: [s, [[blob8p1, "blob"]]] },
      av179bType: { fn: "objects.read_sizes", args: [s, [[blob8p1, "tree"]]] },
      av179bLowered: { fn: "objects.read_sizes", args: [repo.store({ type_limits: { blob: 9 } }), [[ten[0], "blob"]]] },
      av179bLoweredOk: { fn: "objects.read_sizes", args: [repo.store({ type_limits: { blob: 10 } }), [[ten[0], "blob"]]] },
      av179c: { fn: "objects.read_sizes", args: [repo.store({ budget_bytes: 30 }), ten.slice(0, 3).map((o) => [o, "blob"])] },
      av179cOver: { fn: "objects.read_sizes", args: [repo.store({ budget_bytes: 30 }), ten.map((o) => [o, "blob"])] },
      av179cCount: { fn: "objects.read_sizes", args: [repo.store({ budget_count: 3 }), ten.map((o) => [o, "blob"])] },
      raiseBudget: { fn: "objects.read_sizes", args: [repo.store({ budget_bytes: 513 * MiB }), [[ten[0], "blob"]]] },
      raiseTypeLimit: { fn: "objects.read_sizes", args: [repo.store({ type_limits: { blob: 8 * MiB + 1 } }), [[ten[0], "blob"]]] },
      av031: { fn: "objects.collect_tree", args: [s, caseFile] },
      av032: { fn: "objects.collect_tree", args: [s, caseDir] },
      av033: { fn: "objects.collect_tree", args: [s, fileAndDir] },
      av034: { fn: "objects.collect_tree", args: [s, upperFileLowerDir] },
      av035: { fn: "objects.collect_tree", args: [s, disjoint] },
      modes: { fn: "objects.collect_tree", args: [s, modes] },
      blobAsTree: { fn: "objects.collect_tree", args: [s, blobAsTree] },
      missingBlob: { fn: "objects.collect_tree", args: [s, missingBlob] },
      treeAsBlob: { fn: "objects.collect_tree", args: [s, treeAsBlob] },
      badMode: { fn: "objects.collect_tree", args: [s, badMode] },
      badPath: { fn: "objects.collect_tree", args: [s, badPath] },
    });
  }, 20_000);

  test("AV-030 duplicate raw name in one tree → GIT_COLLISION (isolated assertion for mutant A4)", () => {
    expect(outcome(get(r, "dup"))).toBe("GIT_COLLISION");
  });

  test("unsorted tree → GIT_OBJECT; directory terminator order is enforced", () => {
    expect(outcome(get(r, "unsorted"))).toBe("GIT_OBJECT");
    expect(outcome(get(r, "dirOrderOk"))).toBe("PASS");
    expect(outcome(get(r, "dirOrderBad"))).toBe("GIT_OBJECT");
  });

  test("malformed tree mode or trailing garbage → GIT_OBJECT", () => {
    expect(outcome(get(r, "leadingZeroMode"))).toBe("GIT_OBJECT");
    expect(outcome(get(r, "nonOctalMode"))).toBe("GIT_OBJECT");
    expect(outcome(get(r, "trailingGarbage"))).toBe("GIT_OBJECT");
  });

  test("valid tree and commit parse with raw names, modes and parents", () => {
    const entries = get(r, "okTree").ok as { mode: string; name: { $b: string } }[];
    expect(entries.map((e) => [e.mode, Buffer.from(e.name.$b, "hex").toString("latin1")])).toEqual([["100644", "a"], ["100644", "b"]]);
    expect((get(r, "okCommit").ok as { parents: string[] }).parents).toEqual([]);
  });

  test("AV-073 commit with two tree headers → GIT_OBJECT", () => {
    expect(outcome(get(r, "twoTrees"))).toBe("GIT_OBJECT");
  });

  test("continuation line after tree or parent → GIT_OBJECT; after gpgsig it is allowed", () => {
    expect(outcome(get(r, "contTree"))).toBe("GIT_OBJECT");
    expect(outcome(get(r, "contParent"))).toBe("GIT_OBJECT");
    expect(outcome(get(r, "gpgsig"))).toBe("PASS");
  });

  test("misplaced parent, uppercase tree OID, missing tree header or missing blank line → GIT_OBJECT", () => {
    for (const name of ["lateParent", "badTreeHex", "noTree", "noBlank"]) expect(outcome(get(r, name)), name).toBe("GIT_OBJECT");
  });

  test("wrong type (read_commit on a tree, read_tree on a commit), missing object, non-lowercase OID → GIT_OBJECT", () => {
    for (const name of ["commitOnTree", "treeOnCommit", "missingCommit", "nonHex"]) expect(outcome(get(r, name)), name).toBe("GIT_OBJECT");
  });

  test("AV-179 one batch process reads an exactly 8 MiB blob and an exactly 16 MiB raw tree", () => {
    expect(get(r, "av179").ok).toEqual([8 * MiB, 16 * MiB]);
    expect(get(r, "av179Tree").ok).toEqual([16 * MiB]);
  });

  test("AV-179b blob of 8 MiB + 1 → GIT_LIMIT; wrong type token is GIT_OBJECT before the limit", () => {
    expect(outcome(get(r, "av179b"))).toBe("GIT_LIMIT");
    expect(outcome(get(r, "av179bType"))).toBe("GIT_OBJECT");
    expect(outcome(get(r, "av179bLowered"))).toBe("GIT_LIMIT");
    expect(get(r, "av179bLoweredOk").ok).toEqual([10]);
  });

  test("AV-179c admissible objects up to the cumulative budget PASS, one more → GIT_LIMIT", () => {
    expect(get(r, "av179c").ok).toEqual([10, 10, 10]);
    expect(outcome(get(r, "av179cOver"))).toBe("GIT_LIMIT");
    expect(outcome(get(r, "av179cCount"))).toBe("GIT_LIMIT");
  });

  test("budgets and type limits can only be lowered → EXECUTION_INTERNAL when raised", () => {
    expect(outcome(get(r, "raiseBudget"))).toBe("EXECUTION_INTERNAL");
    expect(outcome(get(r, "raiseTypeLimit"))).toBe("EXECUTION_INTERNAL");
  });

  test("AV-031 A.ts and a.ts in one snapshot → GIT_COLLISION", () => {
    expect(outcome(get(r, "av031"))).toBe("GIT_COLLISION");
  });

  test("AV-032 Dir/a and dir/b → GIT_COLLISION", () => {
    expect(outcome(get(r, "av032"))).toBe("GIT_COLLISION");
  });

  test("AV-033 a as file and a/b as path → GIT_COLLISION", () => {
    expect(outcome(get(r, "av033"))).toBe("GIT_COLLISION");
  });

  test("AV-034 A as file and a/b as path → GIT_COLLISION", () => {
    expect(outcome(get(r, "av034"))).toBe("GIT_COLLISION");
  });

  test("AV-035 x/a and x/b without collision → PASS", () => {
    const snap = get(r, "av035").ok as Snapshot;
    expect(snap.leaves.map((l) => l.path)).toEqual(["x/a", "x/b"]);
  });

  test("AV-062/AV-063/AV-064 symlink, gitlink and unknown well-formed mode 100600 are reported as facts, not rejected by A", () => {
    const snap = get(r, "modes").ok as Snapshot;
    expect(snap.leaves.map((l) => [l.path, l.mode])).toEqual([["exe", "100755"], ["gitlink", "160000"], ["link", "120000"], ["odd", "100600"]]);
  });

  test("collect_tree: malformed mode, tree entry naming a blob, missing or non-blob leaf → GIT_OBJECT; bad path → GIT_PATH", () => {
    for (const name of ["badMode", "blobAsTree", "missingBlob", "treeAsBlob"]) expect(outcome(get(r, name)), name).toBe("GIT_OBJECT");
    expect(outcome(get(r, "badPath"))).toBe("GIT_PATH");
  });
});

describe("AV-179d frame header validation (objects.parse_header)", () => {
  const oid = "0123456789abcdef0123456789abcdef01234567";
  let r: Record<string, Response> = {};
  const h = (text: string): Call => ({ fn: "objects.parse_header", args: [b(text), oid, "blob"] });

  beforeAll(() => {
    r = batch({
      ok: h(`${oid} blob 12\n`),
      len65: h(`${oid} blob 1${" ".repeat(65 - 48)}\n`),
      len64: h(`${oid} blob 1${" ".repeat(64 - 48)}\n`),
      upperOid: h(`${oid.toUpperCase()} blob 12\n`),
      otherOid: h(`${"f".repeat(40)} blob 12\n`),
      wrongType: h(`${oid} tree 12\n`),
      tagType: h(`${oid} tag 12\n`),
      leadingZero: h(`${oid} blob 012\n`),
      negative: h(`${oid} blob -1\n`),
      noLf: h(`${oid} blob 12`),
      crlf: h(`${oid} blob 12\r\n`),
      missing: h(`${oid} missing\n`),
      doubleSpace: h(`${oid}  blob 12\n`),
      elevenDigits: h(`${oid} blob 12345678901\n`),
    });
  });

  test("AV-179d well-formed header parses to type and size", () => {
    expect(get(r, "ok").ok).toEqual(["blob", 12]);
  });

  test("AV-179d 65-byte header line → GIT_OBJECT (64 bytes still checked by shape)", () => {
    expect(outcome(get(r, "len65"))).toBe("GIT_OBJECT");
    expect(outcome(get(r, "len64"))).toBe("GIT_OBJECT");
  });

  test("AV-179d malformed header shapes, wrong OID or type token → GIT_OBJECT", () => {
    for (const name of ["upperOid", "otherOid", "wrongType", "tagType", "leadingZero", "negative", "noLf", "crlf", "missing", "doubleSpace", "elevenDigits"]) {
      expect(outcome(get(r, name)), name).toBe("GIT_OBJECT");
    }
  });
});

describe("diff: collect_changes / changes_from_leaves", () => {
  const O1 = "1".repeat(40);
  const O2 = "2".repeat(40);
  const O3 = "3".repeat(40);
  let r: Record<string, Response> = {};
  const d = (base: string[][], head: string[][]): Call => ({ fn: "objects.changes_from_leaves", args: [base, head] });

  beforeAll(() => {
    const repo = newRepo();
    const s = repo.store();
    const x = repo.blob("x\n");
    const fileTree = repo.tree({ a: "x\n", keep: "k\n" });
    const dirTree = repo.tree({ a: { b: "1\n", c: "2\n" }, keep: "k\n" });
    const modeTree = repo.tree({ a: { mode: "100755", oid: x }, keep: "k\n" });
    r = batch({
      identical: d([["src/a.ts", "100644", O1]], [["src/a.ts", "100644", O1]]),
      add: d([], [["src/a.ts", "100644", O1]]),
      del: d([["src/a.ts", "100644", O1]], []),
      modify: d([["src/a.ts", "100644", O1]], [["src/a.ts", "100644", O2]]),
      mode: d([["src/a.ts", "100644", O1]], [["src/a.ts", "100755", O1]]),
      both: d([["src/a.ts", "100644", O1]], [["src/a.ts", "100755", O2]]),
      rename: d([["src/a.ts", "100644", O1]], [["src/b.ts", "100644", O1]]),
      invariant: d([["k", "100644", O3], ["src/a.ts", "100644", O1]], [["k", "100644", O3], ["src/a.ts", "100644", O2]]),
      golden: d([["a", "100644", O1], ["b", "100644", O2]], [["a", "100755", O3], ["c", "100644", O2]]),
      fileToDir: { fn: "objects.collect_changes_for", args: [s, fileTree, dirTree] },
      realMode: { fn: "objects.collect_changes_for", args: [s, fileTree, modeTree] },
      realSame: { fn: "objects.collect_changes_for", args: [s, fileTree, fileTree] },
    });
  });

  const changes = (name: string): Change[] => get(r, name).ok as Change[];

  test("HC-DIFF-01 identical trees → no changes", () => {
    expect(changes("identical")).toEqual([]);
    expect(changes("realSame")).toEqual([]);
  });

  test("HC-DIFF-02 only in HEAD → ADD", () => {
    expect(changes("add")).toEqual([{ path: "src/a.ts", kinds: ["ADD"], base: null, head: { path: "src/a.ts", mode: "100644", oid: O1 } }]);
  });

  test("HC-DIFF-03 only in BASE → DELETE", () => {
    expect(changes("del")).toEqual([{ path: "src/a.ts", kinds: ["DELETE"], base: { path: "src/a.ts", mode: "100644", oid: O1 }, head: null }]);
  });

  test("HC-DIFF-04 same path, other OID → MODIFY", () => {
    expect(brief(changes("modify"))).toEqual(["MODIFY src/a.ts"]);
  });

  test("HC-DIFF-05 same OID, mode 100644→100755 → MODE_CHANGE only (isolated assertion for mutant A3)", () => {
    expect(changes("mode").map((c) => c.kinds)).toEqual([["MODE_CHANGE"]]);
    expect(changes("realMode").map((c) => [c.path, c.kinds])).toEqual([["a", ["MODE_CHANGE"]]]);
  });

  test("HC-DIFF-06 content and mode change → MODIFY+MODE_CHANGE in that order (isolated assertion for mutant A3)", () => {
    expect(changes("both").map((c) => c.kinds)).toEqual([["MODIFY", "MODE_CHANGE"]]);
  });

  test("HC-DIFF-07 move with identical blob → DELETE + ADD, no rename", () => {
    expect(brief(changes("rename"))).toEqual(["DELETE src/a.ts", "ADD src/b.ts"]);
  });

  test("HC-DIFF-08 unchanged leaf in both trees produces no change", () => {
    expect(brief(changes("invariant"))).toEqual(["MODIFY src/a.ts"]);
  });

  test("roq diff-delete-add-and-content-mode golden", () => {
    expect(brief(changes("golden"))).toEqual(["MODIFY+MODE_CHANGE a", "DELETE b", "ADD c"]);
  });

  test("file → directory → DELETE + ADDs", () => {
    expect(brief(changes("fileToDir"))).toEqual(["DELETE a", "ADD a/b", "ADD a/c"]);
  });
});

describe("history: validate_history and is_in_base_ancestry", () => {
  let r: Record<string, Response> = {};
  const baseSpec: TreeSpec = { src: { "clamp.ts": "v0\n" }, ".github": { workflows: { "ci.yml": "ci\n" } } };
  const changed: TreeSpec = { ...baseSpec, src: { "clamp.ts": "v1\n" } };

  beforeAll(() => {
    const repo = newRepo();
    const s = repo.store();
    const t0 = repo.tree(baseSpec);
    const t1 = repo.tree(changed);
    const root0 = repo.commit(t0, [], "root");
    const base = repo.commit(t0, [root0], "base");
    const side = repo.commit(repo.tree({ ...baseSpec, side: "s\n" }), [base], "side");
    const side2 = repo.commit(repo.tree({ ...baseSpec, side2: "s\n" }), [base], "side2");
    const unrelated = repo.commit(repo.tree({ other: "o\n" }), [], "unrelated");

    const linear = repo.commit(t1, [base]);
    const baseMergeSide = repo.commit(repo.tree({ ...baseSpec, old: "o\n" }), [root0], "old side");
    const baseMerge = repo.commit(t0, [root0, baseMergeSide], "base merge");
    const onBaseMerge = repo.commit(t1, [baseMerge]);
    const noBase = repo.commit(t1, [unrelated]);
    const throughRoot = repo.commit(t1, [root0]);
    const rootAbove = repo.commit(t1, []);
    const firstStep = repo.commit(t1, [base]);
    const emptyEnd = repo.commit(t0, [firstStep], "revert all");
    const chain129 = repo.chain(base, baseSpec, 129);
    const chain128 = repo.chain(base, baseSpec, 128);
    const chain128Unrelated = repo.chain(unrelated, baseSpec, 128);
    const missingParent = repo.commit(t1, [MISSING]);
    const secondParent = repo.commit(t1, [base, side]);
    const secondUnrelated = repo.commit(t1, [base, unrelated]);
    const secondMissing = repo.commit(t1, [base, MISSING]);
    const octopus = repo.commit(t1, [base, side, side2]);
    const nestedMerge = repo.commit(repo.tree({ ...changed, n: "n\n" }), [repo.commit(t1, [base, side])]);
    const wfEdit = repo.commit(repo.tree({ ...changed, ".github": { workflows: { "ci.yml": "evil\n" } } }), [base], "wf edit");
    const wfRevert = repo.commit(t1, [wfEdit], "wf revert");
    const badMid = repo.commit(repo.tree({ ...changed, "A.ts": "1", "a.ts": "2" }), [base], "collision");
    const afterBadMid = repo.commit(t1, [badMid], "collision removed");

    // Ancestry: contract base reachable from BASE only through the second parent of a BASE merge.
    const contractBase = repo.commit(repo.tree({ ...baseSpec, cb: "c\n" }), [root0], "contract base");
    const featureTip = repo.commit(repo.tree({ ...baseSpec, cb: "d\n" }), [contractBase], "feature tip");
    const mainMerge = repo.commit(t0, [base, featureTip], "main merge");
    const brokenBase = repo.commit(t0, [MISSING], "broken");

    const vh = (head: string, baseOid = base, kwargs: Record<string, unknown> = {}): Call =>
      ({ fn: "history.validate_history", args: [s, baseOid, head], kwargs });
    const anc = (baseOid: string, target: string, kwargs: Record<string, unknown> = {}): Call =>
      ({ fn: "history.is_in_base_ancestry", args: [s, baseOid, target], kwargs });

    r = batch({
      av067: vh(linear),
      av068: vh(onBaseMerge, baseMerge),
      av069: vh(noBase),
      av069Root: vh(throughRoot),
      rootAbove: vh(rootAbove),
      av070: vh(base),
      av070Missing: vh(MISSING, MISSING),
      av070b: vh(emptyEnd),
      av071: vh(chain129[128]!),
      av071Pass: vh(chain128[127]!),
      av071Unrelated: vh(chain128Unrelated[127]!),
      lowered: vh(chain128[2]!, base, { max_commits: 2 }),
      loweredOk: vh(chain128[2]!, base, { max_commits: 3 }),
      raised: vh(linear, base, { max_commits: 129 }),
      av072: vh(missingParent),
      missingBase: vh(linear, MISSING),
      baseIsTree: vh(linear, t0),
      headIsTree: vh(t1),
      badOid: vh(linear.toUpperCase()),
      av178: vh(secondParent),
      hist04: vh(secondUnrelated),
      secondMissing: vh(secondMissing),
      octopus: vh(octopus),
      nested: vh(nestedMerge),
      revert: vh(wfRevert),
      badMid: vh(afterBadMid),
      av178b: anc(mainMerge, contractBase),
      av178bTip: anc(mainMerge, featureTip),
      self: anc(base, base),
      firstParentAncestor: anc(base, root0),
      unrelatedAnc: anc(mainMerge, unrelated),
      childNotAncestor: anc(base, linear),
      ancMissing: anc(brokenBase, unrelated),
      ancMissingBase: anc(MISSING, base),
      ancLowered: anc(chain128[10]!, unrelated, { max_commits: 5 }),
      ancLoweredOk: anc(chain128[10]!, root0, { max_commits: 13 }),
      ancRaised: anc(base, root0, { max_commits: 150001 }),
    });
  }, 20_000);

  const hist = (name: string): History => get(r, name).ok as History;

  test("AV-067 HC-HIST-01 roq history-linear: one linear commit above BASE → PASS", () => {
    const h = hist("av067");
    expect(h.commits.length).toBe(1);
    expect(h.snapshots.length).toBe(1);
    expect(brief(h.net)).toEqual(["MODIFY src/clamp.ts"]);
    expect(h.steps.map(brief)).toEqual([["MODIFY src/clamp.ts"]]);
  });

  test("AV-068 HC-HIST-07 roq history-historical-base-merge: BASE with two parents, one linear HEAD commit → PASS", () => {
    expect(hist("av068").commits.length).toBe(1);
  });

  test("AV-069 HC-HIST-06 HEAD never reaches BASE → GIT_HISTORY", () => {
    expect(outcome(get(r, "av069"))).toBe("GIT_HISTORY");
    expect(outcome(get(r, "av069Root"))).toBe("GIT_HISTORY");
  });

  test("root commit above BASE → GIT_HISTORY", () => {
    expect(outcome(get(r, "rootAbove"))).toBe("GIT_HISTORY");
  });

  test("AV-070 HC-HIST-12 roq history-base-equals-head: HEAD = BASE → GIT_HISTORY (missing BASE stays GIT_OBJECT)", () => {
    expect(outcome(get(r, "av070"))).toBe("GIT_HISTORY");
    expect(outcome(get(r, "av070Missing"))).toBe("GIT_OBJECT");
  });

  test("AV-070b HC-HIST-11 roq history-empty-diff: non-empty chain with empty end diff → GIT_HISTORY", () => {
    expect(outcome(get(r, "av070b"))).toBe("GIT_HISTORY");
  });

  test("AV-071 HC-HIST-09 roq history-129-commits: 129 new linear commits → GIT_LIMIT, limit before shape", () => {
    expect(outcome(get(r, "av071"))).toBe("GIT_LIMIT");
    expect(outcome(get(r, "av071Unrelated"))).toBe("GIT_LIMIT");
  });

  test("HC-HIST-08 128 new linear commits with non-empty end diff → PASS", () => {
    const h = hist("av071Pass");
    expect(h.commits.length).toBe(128);
    expect(h.steps.length).toBe(128);
    expect(brief(h.net)).toEqual(["ADD c127.txt"]);
  });

  test("max_commits can be lowered (→ GIT_LIMIT) but not raised (→ EXECUTION_INTERNAL)", () => {
    expect(outcome(get(r, "lowered"))).toBe("GIT_LIMIT");
    expect(hist("loweredOk").commits.length).toBe(3);
    expect(outcome(get(r, "raised"))).toBe("EXECUTION_INTERNAL");
  });

  test("AV-072 HEAD parent points to a missing object → GIT_OBJECT, never 'not an ancestor'", () => {
    expect(outcome(get(r, "av072"))).toBe("GIT_OBJECT");
  });

  test("missing or non-commit BASE/HEAD, non-lowercase OID → GIT_OBJECT", () => {
    for (const name of ["missingBase", "baseIsTree", "headIsTree", "badOid"]) expect(outcome(get(r, name)), name).toBe("GIT_OBJECT");
  });

  test("AV-029 AV-178 HC-HIST-02 roq history-second-parent: valid first parent to BASE plus a second parent → GIT_HISTORY (isolated assertion for mutant A5)", () => {
    expect(outcome(get(r, "av178"))).toBe("GIT_HISTORY");
  });

  test("HC-HIST-04 unrelated or missing second parent on HEAD → GIT_HISTORY", () => {
    expect(outcome(get(r, "hist04"))).toBe("GIT_HISTORY");
    expect(outcome(get(r, "secondMissing"))).toBe("GIT_HISTORY");
  });

  test("HC-HIST-05 octopus HEAD with three parents → GIT_HISTORY", () => {
    expect(outcome(get(r, "octopus"))).toBe("GIT_HISTORY");
  });

  test("HC-HIST-03 nested merge ancestry above BASE → GIT_HISTORY", () => {
    expect(outcome(get(r, "nested"))).toBe("GIT_HISTORY");
  });

  test("AV-074 HC-HIST-10 roq history-reverted-config: reverted intermediate change → PASS at A, step keeps it, net does not", () => {
    const h = hist("revert");
    expect(h.commits.length).toBe(2);
    expect(h.steps.map(brief)).toEqual([["MODIFY .github/workflows/ci.yml"], ["MODIFY .github/workflows/ci.yml", "MODIFY src/clamp.ts"]]);
    expect(brief(h.net)).toEqual(["MODIFY src/clamp.ts"]);
    expect(h.snapshots[1]!.leaves.find((l) => l.path === ".github/workflows/ci.yml")).toBeDefined();
  });

  test("intermediate snapshot with a path collision is rejected even if a later commit removes it → GIT_COLLISION", () => {
    expect(outcome(get(r, "badMid"))).toBe("GIT_COLLISION");
  });

  test("AV-178b contract base reachable from BASE only through the second parent of a BASE merge → true", () => {
    expect(get(r, "av178b").ok).toBe(true);
    expect(get(r, "av178bTip").ok).toBe(true);
    expect(get(r, "self").ok).toBe(true);
    expect(get(r, "firstParentAncestor").ok).toBe(true);
  });

  test("ancestry: unrelated commit or descendant → false", () => {
    expect(get(r, "unrelatedAnc").ok).toBe(false);
    expect(get(r, "childNotAncestor").ok).toBe(false);
  });

  test("ancestry: missing object → GIT_OBJECT; lowered max → GIT_LIMIT; raised max → EXECUTION_INTERNAL", () => {
    expect(outcome(get(r, "ancMissing"))).toBe("GIT_OBJECT");
    expect(outcome(get(r, "ancMissingBase"))).toBe("GIT_OBJECT");
    expect(outcome(get(r, "ancLowered"))).toBe("GIT_LIMIT");
    expect(get(r, "ancLoweredOk").ok).toBe(true);
    expect(outcome(get(r, "ancRaised"))).toBe("EXECUTION_INTERNAL");
  });
});
