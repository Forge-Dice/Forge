import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FixtureRepo, outcome, py, py1, removeTree, tempRoot } from "./helpers.ts";

// FORGE-BOOTSTRAP-0001A materialize.py: dir_fd/O_NOFOLLOW blob materialization (AV-036..038, A2).

let base: string;
let repo: FixtureRepo;
let counter = 0;

function freshDir(label: string): string {
  const dir = join(base, `${label}-${counter++}`);
  mkdirSync(dir, { mode: 0o700 });
  return dir;
}

const mode = (path: string): number => statSync(path).mode & 0o777;
const rootOf = (r: { ok?: unknown }): string => r.ok as string;

beforeAll(() => {
  base = tempRoot("materialize");
  repo = new FixtureRepo(join(base, "repo"));
});

afterAll(() => {
  if (base) removeTree(base);
});

describe("materialize", () => {
  it("AV-038 writes binary (NUL) and empty blobs byte-exactly with 0444 files and a 0700 root", () => {
    const binary = Buffer.from([0, 1, 2, 0, 255, 0, 10, 13, 0]);
    const tree = repo.tree({ "bin.dat": { mode: "100644", oid: repo.blob(binary) }, "empty.txt": "", src: { deep: { "a.ts": "x\n" } } });
    const dest = freshDir("bytes");
    const r = py1("materialize.materialize_tree", [repo.store(), tree, dest]);
    expect(outcome(r)).toBe("PASS");
    const root = rootOf(r);
    expect(readdirSync(dest)).toEqual([root.slice(dest.length + 1)]);
    expect(root.slice(dest.length + 1)).toMatch(/^[0-9a-f]{32}$/);
    expect(mode(root)).toBe(0o700);
    expect(readFileSync(join(root, "bin.dat")).equals(binary)).toBe(true);
    expect(readFileSync(join(root, "empty.txt")).length).toBe(0);
    expect(readFileSync(join(root, "src/deep/a.ts"), "utf8")).toBe("x\n");
    expect(mode(join(root, "bin.dat"))).toBe(0o444);
    expect(mode(join(root, "src/deep"))).toBe(0o700);
    expect(statSync(join(root, "bin.dat")).nlink).toBe(1);
  });

  it("writes 100755 as 0555 only when the caller lists it as executable", () => {
    const tree = repo.tree({ "run.sh": { mode: "100755", oid: repo.blob("#!/bin/sh\n") } });
    const dest = freshDir("exec");
    const [allowed, refused] = py([
      { fn: "materialize.materialize_tree", args: [repo.store(), tree, dest], kwargs: { executable: { $set: ["run.sh"] } } },
      { fn: "materialize.materialize_tree", args: [repo.store(), tree, dest] },
    ]);
    expect(outcome(allowed!)).toBe("PASS");
    expect(mode(join(rootOf(allowed!), "run.sh"))).toBe(0o555);
    expect(outcome(refused!)).toBe("EXECUTION_IO");
    expect(refused!.fail!.phase).toBe("materialize");
    expect(readdirSync(dest)).toHaveLength(1); // refused before any root was created
  });

  it("refuses symlink, gitlink and unknown leaf modes with EXECUTION_IO", () => {
    const target = repo.blob("../../outside");
    const trees = [
      repo.tree({ "a.txt": "a", link: { mode: "120000", oid: target } }),
      repo.tree({ "a.txt": "a", sub: { mode: "160000", oid: "1".repeat(40) } }),
      repo.tree({ "a.txt": "a", odd: { mode: "100664", oid: repo.blob("o") } }),
    ];
    const dest = freshDir("modes");
    const results = py(trees.map((t) => ({ fn: "materialize.materialize_tree", args: [repo.store(), t, dest] })));
    expect(results.map(outcome)).toEqual(["EXECUTION_IO", "EXECUTION_IO", "EXECUTION_IO"]);
    expect(readdirSync(dest)).toEqual([]);
  });

  it("AV-036 (mutant A2) rejects a parent directory swapped for a symlink and writes nothing outside", () => {
    const tree = repo.tree({ a: { b: { "payload.txt": "pwned" } } });
    const dest = freshDir("race");
    const outside = freshDir("outside");
    const results = py([
      { fn: "materialize._materialize_with_symlink_race", args: [repo.store(), tree, dest, "a", outside] },
      { fn: "materialize._materialize_with_symlink_race", args: [repo.store(), tree, dest, "a/b", outside] },
    ]);
    expect(results.map(outcome)).toEqual(["EXECUTION_IO", "EXECUTION_IO"]);
    // Following the symlink would have created b/payload.txt or payload.txt in `outside`.
    expect(readdirSync(outside)).toEqual([]);
    expect(readdirSync(dest)).toEqual([]);
  });

  it("AV-037 refuses a leaf that already exists (O_EXCL) and discards the root", () => {
    const tree = repo.tree({ "a.txt": "a", dir: { "b.txt": "b" } });
    const dest = freshDir("exists");
    const r = py1("materialize._materialize_with_existing_leaf", [repo.store(), tree, dest, "dir/b.txt"]);
    expect(outcome(r)).toBe("EXECUTION_IO");
    expect(readdirSync(dest)).toEqual([]);
  });

  it("a lowered byte budget fails with GIT_LIMIT and removes the partial root; raising it is refused", () => {
    const tree = repo.tree({ "a.txt": "12345", "b.txt": "67890" });
    const dest = freshDir("budget");
    const [low, exact, high] = py([
      { fn: "materialize.materialize_tree", args: [repo.store(), tree, dest], kwargs: { byte_budget: 7 } },
      { fn: "materialize.materialize_tree", args: [repo.store(), tree, dest], kwargs: { byte_budget: 10 } },
      { fn: "materialize.materialize_tree", args: [repo.store(), tree, dest], kwargs: { byte_budget: 128 * 1024 * 1024 + 1 } },
    ]);
    expect(outcome(low!)).toBe("GIT_LIMIT");
    expect(outcome(exact!)).toBe("PASS");
    expect(outcome(high!)).toBe("EXECUTION_INTERNAL");
    expect(readdirSync(dest)).toEqual([rootOf(exact!).slice(dest.length + 1)]);
  });

  it("destroy removes the whole root without following a planted symlink", () => {
    const tree = repo.tree({ "a.txt": "a", d: { e: { "f.txt": "f" } } });
    const dest = freshDir("destroy");
    const outside = freshDir("keep");
    writeFileSync(join(outside, "survivor.txt"), "keep");
    const made = py1("materialize.materialize_tree", [repo.store(), tree, dest]);
    expect(outcome(made)).toBe("PASS");
    const root = rootOf(made);
    symlinkSync(outside, join(root, "d", "escape"));
    symlinkSync(join(outside, "survivor.txt"), join(root, "file-link"));
    expect(lstatSync(join(root, "d", "escape")).isSymbolicLink()).toBe(true);
    const [gone, again] = py([
      { fn: "materialize.destroy", args: [root] },
      { fn: "materialize.destroy", args: [root] },
    ]);
    expect(outcome(gone!)).toBe("PASS");
    expect(existsSync(root)).toBe(false);
    expect(readFileSync(join(outside, "survivor.txt"), "utf8")).toBe("keep");
    expect(outcome(again!)).toBe("EXECUTION_IO");
  });

  it("destroy refuses a root that is itself a symlink", () => {
    const outside = freshDir("victim");
    writeFileSync(join(outside, "x.txt"), "x");
    const link = join(base, `rootlink-${counter++}`);
    symlinkSync(outside, link);
    expect(outcome(py1("materialize.destroy", [link]))).toBe("EXECUTION_IO");
    expect(readdirSync(outside)).toEqual(["x.txt"]);
  });
});
