import { beforeAll, describe, expect, it } from "vitest";
import { b, outcome, py, type Call, type Response } from "./helpers.ts";

// PKG §14 property families for Task A, each >= 10,000 deterministic iterations.
// Generator: xorshift32, fixed seed 1042026 (no Date.now, no network). Each family is driven
// through ONE py() batch and compared with an independent TypeScript oracle written from the
// spec text (PKG §3 mode/path table and collectChanges row), not ported from the Python code.
// On a mismatch the first counterexample is reported as compact JSON.

const SEED = 1042026;
const ITERATIONS = 10_000;
const SELF_EVERY = 5;

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
  shuffle<T>(items: T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }
}

// ---------------------------------------------------------------- path validation oracle

const PORTABLE = /^[A-Za-z0-9._-]+$/;
const DEVICE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/;

/** PKG §3: ASCII portable grammar, §2 limits; returns the path text or null for GIT_PATH. */
function oracleValidatePath(raw: Uint8Array): string | null {
  if (raw.length < 1 || raw.length > 255) return null;
  // Any byte outside the portable set (non-ASCII, C0, DEL, space, punctuation) rejects.
  for (const byte of raw) {
    const ok =
      (byte >= 0x30 && byte <= 0x39) ||
      (byte >= 0x41 && byte <= 0x5a) ||
      (byte >= 0x61 && byte <= 0x7a) ||
      byte === 0x2e || byte === 0x5f || byte === 0x2d || byte === 0x2f;
    if (!ok) return null;
  }
  const text = Buffer.from(raw).toString("latin1");
  const segments = text.split("/");
  if (segments.length > 16) return null;
  for (const s of segments) {
    if (s.length === 0 || s.length > 100 || !PORTABLE.test(s)) return null;
    if (s === "." || s === "..") return null;
    if (s.startsWith("-") || s.endsWith(".")) return null;
    const lower = s.toLowerCase();
    if (lower === ".git") return null;
    if (DEVICE.test(lower.split(".")[0]!)) return null;
  }
  return text;
}

const TOKENS = [
  "a", "b", "Z", "x", "0", "9", "_", "-", ".", "..", "ts", ".ts", ".d", "src",
  ".git", ".GiT", ".GIT", "git", "git~1", "con", "CON", "Aux", "nul", "NUL", "prn",
  "com1", "COM9", "com0", "com10", "lpt9", "LPT1", "lpt", "console", "auxiliary",
  "\xc3\xa9", "e\xcc\x81", "\xff", "\x80", "\x00", "\n", "\t", "\x7f", " ", ":", "\\", "~", "/",
];
const BYTE_POOL = [0x2e, 0x2d, 0x2f, 0x5f, 0x61, 0x41, 0x7a, 0x30, 0x00, 0x0a, 0x7f, 0x20, 0x3a, 0x5c, 0xc3, 0xa9, 0xff, 0x80];

function genSegmentFromTokens(r: XorShift32): string {
  let s = "";
  const parts = 1 + r.int(3);
  for (let i = 0; i < parts; i++) s += r.chance(0.55) ? r.pick(["a", "b", "Z", "x", "0", "src", "ts", "_", "-", "."]) : r.pick(TOKENS);
  return s;
}

function genPathBytes(r: XorShift32): Buffer {
  const mode = r.int(100);
  if (mode < 45) {
    const depth = r.chance(0.1) ? 15 + r.int(4) : 1 + r.int(4);
    const segs = Array.from({ length: depth }, () => genSegmentFromTokens(r));
    let path = segs.join(r.chance(0.03) ? "//" : "/");
    if (r.chance(0.03)) path = `/${path}`;
    if (r.chance(0.03)) path = `${path}/`;
    return Buffer.from(path, "latin1");
  }
  if (mode < 60) {
    // Segment and total length boundaries (100/101, 255/256).
    const count = 1 + r.int(3);
    const segs = Array.from({ length: count }, () => r.pick(["a", "B", "-", "."]) + "x".repeat(97 + r.int(5)));
    if (r.chance(0.5)) segs.push("y".repeat(1 + r.int(60)));
    return Buffer.from(segs.join("/"), "latin1");
  }
  if (mode < 75) {
    // Depth boundary 16/17 with short segments.
    const depth = 14 + r.int(5);
    return Buffer.from(Array.from({ length: depth }, () => r.pick(["a", "b", "1", "_", "a.b", "x-y"])).join("/"), "latin1");
  }
  const length = r.int(14);
  const out = Buffer.alloc(length);
  for (let i = 0; i < length; i++) out[i] = r.chance(0.2) ? r.int(256) : r.pick(BYTE_POOL);
  return out;
}

// ---------------------------------------------------------------- collision oracle

/** PKG §3 Case-Collision: every directory and leaf prefix gets an ASCII-lowercase key; two nodes
 *  with the same key are only allowed when both are directories spelled with identical bytes. */
function oracleCollides(paths: string[]): boolean {
  type Node = { raw: string; leaf: boolean };
  const nodesOf = (p: string): Node[] => {
    const segs = p.split("/");
    return segs.map((_, i) => ({ raw: segs.slice(0, i + 1).join("/"), leaf: i === segs.length - 1 }));
  };
  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      for (const x of nodesOf(paths[i]!)) {
        for (const y of nodesOf(paths[j]!)) {
          if (x.raw.toLowerCase() !== y.raw.toLowerCase()) continue;
          if (!x.leaf && !y.leaf && x.raw === y.raw) continue;
          return true;
        }
      }
    }
  }
  return false;
}

const SET_UNIVERSE = [
  "a", "A", "a/b", "A/b", "a/B", "a/b/c", "b", "B", "b/c", "x/a", "x/b", "X/a", "x/A/1", "x/a/2",
  "a.ts", "A.ts", "ab", "ab/c", "d/e/f", "D/e/g", "d/E",
];

// ---------------------------------------------------------------- tree diff oracle

type Row = [path: string, mode: string, oid: string];
type LeafJson = { path: string; mode: string; oid: string };
type ChangeJson = { path: string; kinds: string[]; base: LeafJson | null; head: LeafJson | null };

const DIFF_UNIVERSE = ["a", "a.ts", "a-b", "a_b", "b", "d/a", "d/b", "d/e/f", "D/x", "z", "Z"];
const MODES = ["100644", "100644", "100644", "100755", "120000", "160000"];
const OIDS = ["1".repeat(40), "2".repeat(40), "3".repeat(40)];

function genLeaves(r: XorShift32): Row[] {
  const rows: Row[] = [];
  for (const path of DIFF_UNIVERSE) if (r.chance(0.5)) rows.push([path, r.pick(MODES), r.pick(OIDS)]);
  return r.shuffle(rows);
}

/** Merge walk over two byte-sorted entry lists (a second representation next to the maps). */
function oracleDiff(base: Row[], head: Row[]): ChangeJson[] {
  const byBytes = (x: Row, y: Row) => Buffer.compare(Buffer.from(x[0], "ascii"), Buffer.from(y[0], "ascii"));
  const a = [...base].sort(byBytes);
  const h = [...head].sort(byBytes);
  const leaf = (row: Row): LeafJson => ({ path: row[0], mode: row[1], oid: row[2] });
  const out: ChangeJson[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < h.length) {
    const cmp = i >= a.length ? 1 : j >= h.length ? -1 : byBytes(a[i]!, h[j]!);
    if (cmp < 0) {
      out.push({ path: a[i]![0], kinds: ["DELETE"], base: leaf(a[i]!), head: null });
      i++;
    } else if (cmp > 0) {
      out.push({ path: h[j]![0], kinds: ["ADD"], base: null, head: leaf(h[j]!) });
      j++;
    } else {
      const kinds: string[] = [];
      if (a[i]![2] !== h[j]![2]) kinds.push("MODIFY");
      if (a[i]![1] !== h[j]![1]) kinds.push("MODE_CHANGE");
      if (kinds.length > 0) out.push({ path: a[i]![0], kinds, base: leaf(a[i]!), head: leaf(h[j]!) });
      i++;
      j++;
    }
  }
  return out;
}

/** apply(diff(A,B), A) as a map. */
function applyDiff(base: Row[], changes: ChangeJson[]): Map<string, string> {
  const m = new Map(base.map((row) => [row[0], `${row[1]} ${row[2]}`]));
  for (const c of changes) {
    if (c.head === null) m.delete(c.path);
    else m.set(c.path, `${c.head.mode} ${c.head.oid}`);
  }
  return m;
}

const asMap = (rows: Row[]) => new Map(rows.map((row) => [row[0], `${row[1]} ${row[2]}`]));
const sortedEntries = (m: Map<string, string>) => [...m.entries()].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));

function reverseOf(changes: ChangeJson[]): ChangeJson[] {
  const flip: Record<string, string> = { ADD: "DELETE", DELETE: "ADD" };
  return changes.map((c) => ({ path: c.path, kinds: c.kinds.map((k) => flip[k] ?? k), base: c.head, head: c.base }));
}

// ---------------------------------------------------------------- families

function firstMismatch<T>(items: T[], check: (item: T, index: number) => string | null): string | null {
  for (let i = 0; i < items.length; i++) {
    const problem = check(items[i]!, i);
    if (problem !== null) return `seed=${SEED} iteration=${i}: ${problem}`;
  }
  return null;
}

describe("PKG §14 path validation property (seed 1042026)", () => {
  const r = new XorShift32(SEED);
  const inputs = Array.from({ length: ITERATIONS }, () => genPathBytes(r));
  let results: Response[] = [];

  beforeAll(() => {
    results = py(inputs.map((raw): Call => ({ fn: "paths.validate_path", args: [b(raw)] })));
  });

  it(`${ITERATIONS} random byte strings: accept/reject and returned text match the oracle`, () => {
    const mismatch = firstMismatch(inputs, (raw, i) => {
      const want = oracleValidatePath(raw);
      const got = results[i]!;
      const gotText = outcome(got) === "PASS" ? (got.ok as string) : null;
      if (want === null && outcome(got) === "GIT_PATH") return null;
      if (want !== null && gotText === want) return null;
      return JSON.stringify({ hex: raw.toString("hex"), oracle: want === null ? "GIT_PATH" : want, python: gotText ?? outcome(got) });
    });
    expect(mismatch).toBeNull();
  });

  it("generator covers both outcomes and the interesting classes", () => {
    const accepted = inputs.filter((raw) => oracleValidatePath(raw) !== null).length;
    expect(accepted).toBeGreaterThan(ITERATIONS * 0.15);
    expect(accepted).toBeLessThan(ITERATIONS * 0.85);
    const has = (pred: (raw: Buffer) => boolean) => inputs.some(pred);
    expect(has((raw) => raw.length === 255 && oracleValidatePath(raw) !== null)).toBe(true);
    expect(has((raw) => raw.length === 256)).toBe(true);
    expect(has((raw) => raw.toString("latin1").split("/").length === 16 && oracleValidatePath(raw) !== null)).toBe(true);
    expect(has((raw) => raw.toString("latin1").split("/").length === 17)).toBe(true);
    expect(has((raw) => raw.some((x) => x >= 0x80))).toBe(true);
    expect(has((raw) => raw.includes(0))).toBe(true);
    expect(has((raw) => /(^|\/)(con|aux|nul|prn|com[1-9]|lpt[1-9])(\.|\/|$)/i.test(raw.toString("latin1")))).toBe(true);
  });
});

describe("PKG §3 path-set collision property (seed 1042026)", () => {
  const r = new XorShift32(SEED ^ 0x5eed);
  const inputs = Array.from({ length: ITERATIONS }, () => Array.from({ length: r.int(6) }, () => r.pick(SET_UNIVERSE)));
  let results: Response[] = [];

  beforeAll(() => {
    results = py(inputs.map((paths): Call => ({ fn: "paths.validate_path_set", args: [paths] })));
  });

  it(`${ITERATIONS} random small sets: GIT_COLLISION exactly when the pairwise oracle says so`, () => {
    let collisions = 0;
    const mismatch = firstMismatch(inputs, (paths, i) => {
      const want = oracleCollides(paths) ? "GIT_COLLISION" : "PASS";
      if (want === "GIT_COLLISION") collisions++;
      const got = outcome(results[i]!);
      return got === want ? null : JSON.stringify({ paths, oracle: want, python: got });
    });
    expect(mismatch).toBeNull();
    expect(collisions).toBeGreaterThan(ITERATIONS * 0.2);
    expect(collisions).toBeLessThan(ITERATIONS * 0.9);
  });
});

describe("PKG §14 tree diff property (seed 1042026)", () => {
  const r = new XorShift32(SEED ^ 0xd1ff);
  const pairs = Array.from({ length: ITERATIONS }, () => ({ base: genLeaves(r), head: genLeaves(r) }));
  let forward: Response[] = [];
  let backward: Response[] = [];
  let self: Response[] = [];

  beforeAll(() => {
    // Forward and reversed diff for every pair; diff(A, shuffled A) for every fifth pair
    // (keeps the single batch well under the 5 s per-test budget).
    const calls: Call[] = [];
    for (const { base, head } of pairs) {
      calls.push({ fn: "objects.changes_from_leaves", args: [base, head] });
      calls.push({ fn: "objects.changes_from_leaves", args: [head, base] });
    }
    pairs.forEach(({ base }, i) => {
      if (i % SELF_EVERY === 0) calls.push({ fn: "objects.changes_from_leaves", args: [base, r.shuffle(base)] });
    });
    const out = py(calls);
    forward = pairs.map((_, i) => out[2 * i]!);
    backward = pairs.map((_, i) => out[2 * i + 1]!);
    self = out.slice(2 * pairs.length);
  });

  it(`${ITERATIONS} map pairs: changes equal the merge-walk oracle (order, kinds, base/head)`, () => {
    const mismatch = firstMismatch(pairs, ({ base, head }, i) => {
      const want = oracleDiff(base, head);
      const got = forward[i]!.ok;
      return JSON.stringify(got) === JSON.stringify(want) ? null : JSON.stringify({ base, head, oracle: want, python: got ?? outcome(forward[i]!) });
    });
    expect(mismatch).toBeNull();
  });

  it("metamorphic: diff(A,A) is empty, apply(diff(A,B),A) = B, reversal swaps ADD/DELETE and sides", () => {
    const mismatch = firstMismatch(pairs, ({ base, head }, i) => {
      if (i % SELF_EVERY === 0 && JSON.stringify(self[i / SELF_EVERY]!.ok) !== "[]") {
        return JSON.stringify({ base, selfDiff: self[i / SELF_EVERY]!.ok });
      }
      const changes = forward[i]!.ok as ChangeJson[];
      const applied = sortedEntries(applyDiff(base, changes));
      if (JSON.stringify(applied) !== JSON.stringify(sortedEntries(asMap(head)))) return JSON.stringify({ base, head, applied });
      if (JSON.stringify(backward[i]!.ok) !== JSON.stringify(reverseOf(changes))) return JSON.stringify({ base, head, backward: backward[i]!.ok });
      return null;
    });
    expect(mismatch).toBeNull();
  });

  it("corpus exercises every change kind, the double flag and DELETE+ADD of identical blobs", () => {
    const all = forward.flatMap((res) => res.ok as ChangeJson[]);
    const kinds = new Set(all.map((c) => c.kinds.join("+")));
    expect([...kinds].sort()).toEqual(["ADD", "DELETE", "MODE_CHANGE", "MODIFY", "MODIFY+MODE_CHANGE"]);
    const sameBlobMove = forward.some((res) => {
      const cs = res.ok as ChangeJson[];
      return cs.some((d) => d.kinds[0] === "DELETE" && cs.some((a) => a.kinds[0] === "ADD" && a.head!.oid === d.base!.oid && a.head!.mode === d.base!.mode));
    });
    expect(sameBlobMove).toBe(true);
  });

  it("ROQ golden diff-delete-add-and-content-mode", () => {
    const [res] = py([
      {
        fn: "objects.changes_from_leaves",
        args: [
          [["a", "100644", OIDS[0]], ["b", "100644", OIDS[1]]],
          [["a", "100755", OIDS[2]], ["c", "100644", OIDS[1]]],
        ],
      },
    ]);
    expect(res!.ok).toEqual([
      { path: "a", kinds: ["MODIFY", "MODE_CHANGE"], base: { path: "a", mode: "100644", oid: OIDS[0] }, head: { path: "a", mode: "100755", oid: OIDS[2] } },
      { path: "b", kinds: ["DELETE"], base: { path: "b", mode: "100644", oid: OIDS[1] }, head: null },
      { path: "c", kinds: ["ADD"], base: null, head: { path: "c", mode: "100644", oid: OIDS[1] } },
    ]);
  });
});
