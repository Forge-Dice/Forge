import { beforeAll, describe, expect, it } from "vitest";
import { b, outcome, py, type Call, type Response } from "./helpers.ts";

// FORGE-BOOTSTRAP-0001A path grammar and collision checks (PKG §3 mode/path table,
// adversarial matrix AV-030..035 and AV-039..060, ROQ "path" goldens).
// All Python calls of this file run in one driver process (beforeAll), each test reads its row.

const enc = (s: string) => Buffer.from(s, "latin1");
const utf8 = (s: string) => Buffer.from(s, "utf8");
const seg = (n: number, ch = "a") => ch.repeat(n);

type PathCase = { title: string; raw: Uint8Array; expect: "PASS" | "GIT_PATH" };
type SetCase = { title: string; paths: string[]; expect: "PASS" | "GIT_COLLISION" };

const reject = (title: string, raw: Uint8Array | string): PathCase =>
  ({ title, raw: typeof raw === "string" ? enc(raw) : raw, expect: "GIT_PATH" });
const accept = (title: string, raw: Uint8Array | string): PathCase =>
  ({ title, raw: typeof raw === "string" ? enc(raw) : raw, expect: "PASS" });

const NFC = utf8("é.ts");
const NFD = utf8("é.ts");

const PATH_CASES: PathCase[] = [
  // Adversarial matrix, exact inputs.
  reject("AV-039 invalid UTF-8 in name", Buffer.from([0x61, 0xc3, 0x28, 0x2e, 0x74, 0x73])),
  reject("AV-039 invalid UTF-8 lone continuation byte", Buffer.from([0x80])),
  reject("AV-040 newline in file name", "a\nb.ts"),
  reject("AV-041 tab in file name", "a\tb.ts"),
  reject("AV-041 DEL in file name", "a\x7fb.ts"),
  reject("AV-042 absolute path", "/etc/passwd"),
  reject("AV-043 empty segment a//b", "a//b"),
  reject("AV-044 traversal a/../b", "a/../b"),
  reject("AV-045 .git/config", ".git/config"),
  reject("AV-046 .GiT/config", ".GiT/config"),
  reject("AV-047 git~1/config (outside grammar)", "git~1/config"),
  reject("AV-048 CON.ts", "CON.ts"),
  reject("AV-049 LPT9.log", "LPT9.log"),
  reject("AV-050 trailing dot x.", "x."),
  reject("AV-051 backslash a\\b", "a\\b"),
  reject("AV-052 colon/ADS a:b", "a:b"),
  reject("AV-053 leading-dash segment -option", "-option"),
  reject("AV-054 NFC é.ts", NFC),
  reject("AV-055 NFD e + combining accent .ts", NFD),
  reject("AV-056 NFC form of a side-by-side pair", Buffer.concat([enc("dir/"), NFC])),
  reject("AV-056 NFD form of a side-by-side pair", Buffer.concat([enc("dir/"), NFD])),
  reject("AV-057 path depth 17", Array(17).fill("a").join("/")),
  reject("AV-058 segment length 101 bytes", seg(101)),
  // AV-059/060 at A level: plain portable paths pass (mode admission is Task B).
  accept("AV-059 normal file path src/a.ts", "src/a.ts"),
  accept("AV-060 existing BASE file path tools/run.sh", "tools/run.sh"),
  // Further grammar facts from PKG §3.
  reject("C0 NUL byte", "a\x00b"),
  reject("C0 0x01 byte", "\x01"),
  reject("C0 carriage return", "a\rb"),
  reject("DEL alone", "\x7f"),
  reject("byte 0xff", "a\xff"),
  reject("valid UTF-8 non-ASCII (CJK)", utf8("文.ts")),
  reject("UTF-8 BOM prefix", Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), enc("a.ts")])),
  reject("aux/x (device name as directory)", "aux/x"),
  reject("Aux.d.ts (device name with double extension)", "Aux.d.ts"),
  reject("nul (lowercase device)", "nul"),
  reject("com1.txt", "src/com1.txt"),
  reject("PRN", "PRN"),
  reject("a./b (directory ending with dot)", "a./b"),
  reject(".git/config nested", "src/.git/config"),
  reject(".GIT/x", ".GIT/x"),
  reject(".git as leaf", ".git"),
  reject("git~1 alone", "git~1"),
  reject("colon in drive form C:x", "C:x"),
  reject("trailing space", "a.ts "),
  reject("space inside", "a b"),
  reject("trailing slash", "a/"),
  reject("single dot segment", "./a"),
  reject("dotdot alone", ".."),
  reject("triple dot segment ends with dot", "..."),
  reject("empty path", ""),
  reject("slash only", "/"),
  reject("dash after slash", "src/-a.ts"),
  accept("dot-leading leaf .gitignore", ".gitignore"),
  accept(".github directory", ".github/workflows/x.yml"),
  accept("console.ts is not a device name", "console.ts"),
  accept("com0 is not reserved", "com0"),
  accept("lpt10 is not reserved", "lpt10"),
  accept("inner dash and underscore", "a-b_c/d-e"),
  accept("double dot inside a..ts", "a..ts"),
  accept("single letter", "a"),
  accept(".a leading dot", ".a"),
  // Length boundaries (§2): path 255, segment 100, depth 16.
  accept("path length 255 ok", `${seg(100)}/${seg(100)}/${seg(53)}`),
  reject("path length 256 rejected", `${seg(100)}/${seg(100)}/${seg(54)}`),
  accept("segment length 100 ok", seg(100)),
  reject("segment length 101 rejected (nested)", `x/${seg(101)}`),
  accept("depth 16 ok", Array(16).fill("a").join("/")),
  reject("depth 17 rejected (different segments)", Array.from({ length: 17 }, (_, i) => `d${i}`).join("/")),
];

const SET_CASES: SetCase[] = [
  { title: "AV-030 raw duplicate name", paths: ["x", "x"], expect: "GIT_COLLISION" },
  { title: "AV-031 A.ts and a.ts", paths: ["A.ts", "a.ts"], expect: "GIT_COLLISION" },
  { title: "AV-032 Dir/a and dir/b", paths: ["Dir/a", "dir/b"], expect: "GIT_COLLISION" },
  { title: "AV-033 a file and a/b", paths: ["a", "a/b"], expect: "GIT_COLLISION" },
  { title: "AV-033 a/b then a file (order reversed)", paths: ["a/b", "a"], expect: "GIT_COLLISION" },
  { title: "AV-034 A file and a/b", paths: ["A", "a/b"], expect: "GIT_COLLISION" },
  { title: "AV-034 a/b then A file (order reversed)", paths: ["a/b", "A"], expect: "GIT_COLLISION" },
  { title: "AV-035 x/a and x/b no collision", paths: ["x/a", "x/b"], expect: "PASS" },
  { title: "deep directory case collision x/A/1 vs x/a/2", paths: ["x/A/1", "x/a/2"], expect: "GIT_COLLISION" },
  { title: "leaf case collision under same dir", paths: ["d/README", "d/readme"], expect: "GIT_COLLISION" },
  { title: "leaf vs deep directory a/b vs A/B/c", paths: ["a/b", "A/B/c"], expect: "GIT_COLLISION" },
  { title: "same directory spelled identically", paths: ["Src/a", "Src/b", "Src/c/d"], expect: "PASS" },
  { title: "prefix-like names are not prefixes", paths: ["a", "ab/c", "a.ts"], expect: "PASS" },
  { title: "empty set", paths: [], expect: "PASS" },
];

// ROQ "path" goldens (normative outcome true = accept, false = reject), copied verbatim.
type Golden = { id: string; rows: { b64: string; mode: string }[]; accept: boolean };
const ROQ_PATH: Golden[] = [
  { id: "path-c3JjL2EudHM=", rows: [{ b64: "c3JjL2EudHM=", mode: "100644" }], accept: true },
  { id: "path-c3JjLy1hLnRz", rows: [{ b64: "c3JjLy1hLnRz", mode: "100644" }], accept: false },
  { id: "path-c3JjL2EgYi50cw==", rows: [{ b64: "c3JjL2EgYi50cw==", mode: "100644" }], accept: false },
  { id: "path-c3JjL2FAYi50cw==", rows: [{ b64: "c3JjL2FAYi50cw==", mode: "100644" }], accept: false },
  { id: "path-c3JjL8OpLnRz", rows: [{ b64: "c3JjL8OpLnRz", mode: "100644" }], accept: false },
  { id: "path-c3JjLy5naXQvYQ==", rows: [{ b64: "c3JjLy5naXQvYQ==", mode: "100644" }], accept: false },
  { id: "path-QVVYLnR4dA==", rows: [{ b64: "QVVYLnR4dA==", mode: "100644" }], accept: false },
  { id: "path-YS4udHM=", rows: [{ b64: "YS4udHM=", mode: "100644" }], accept: true },
  { id: "path-YS4veA==", rows: [{ b64: "YS4veA==", mode: "100644" }], accept: false },
  { id: "path-Li4veA==", rows: [{ b64: "Li4veA==", mode: "100644" }], accept: false },
  { id: "path-c3JjL2EudHMvLi4vYi50cw==", rows: [{ b64: "c3JjL2EudHMvLi4vYi50cw==", mode: "100644" }], accept: false },
  { id: "path-YVxi", rows: [{ b64: "YVxi", mode: "100644" }], accept: false },
  { id: "path-YTpi", rows: [{ b64: "YTpi", mode: "100644" }], accept: false },
  { id: "path-YX8=", rows: [{ b64: "YX8=", mode: "100644" }], accept: false },
  { id: "path-Yf8=", rows: [{ b64: "Yf8=", mode: "100644" }], accept: false },
  { id: "mode-100644", rows: [{ b64: "YS50cw==", mode: "100644" }], accept: true },
  { id: "mode-100755", rows: [{ b64: "YS50cw==", mode: "100755" }], accept: true },
  { id: "mode-120000", rows: [{ b64: "YS50cw==", mode: "120000" }], accept: false },
  { id: "mode-160000", rows: [{ b64: "YS50cw==", mode: "160000" }], accept: false },
  { id: "mode-100600", rows: [{ b64: "YS50cw==", mode: "100600" }], accept: false },
  { id: "collision-(b'A/x', b'a/y')", rows: [{ b64: "QS94", mode: "100644" }, { b64: "YS95", mode: "100644" }], accept: false },
  { id: "collision-(b'a', b'a/b')", rows: [{ b64: "YQ==", mode: "100644" }, { b64: "YS9i", mode: "100644" }], accept: false },
  { id: "collision-(b'A', b'a/b')", rows: [{ b64: "QQ==", mode: "100644" }, { b64: "YS9i", mode: "100644" }], accept: false },
  { id: "collision-(b'x', b'x')", rows: [{ b64: "eA==", mode: "100644" }, { b64: "eA==", mode: "100644" }], accept: false },
];
const MODE_GOLDEN = /^mode-/;

let pathResults: Response[] = [];
let setResults: Response[] = [];
let goldenPathResults: Response[][] = [];
let goldenSetResults: Response[] = [];
let unchangedDiff: Response[] = [];

beforeAll(() => {
  const calls: Call[] = [];
  for (const c of PATH_CASES) calls.push({ fn: "paths.validate_path", args: [b(c.raw)] });
  for (const c of SET_CASES) calls.push({ fn: "paths.validate_path_set", args: [c.paths] });
  for (const g of ROQ_PATH) for (const r of g.rows) calls.push({ fn: "paths.validate_path", args: [b(Buffer.from(r.b64, "base64"))] });
  for (const g of ROQ_PATH) {
    calls.push({ fn: "paths.validate_path_set", args: [g.rows.map((r) => Buffer.from(r.b64, "base64").toString("latin1"))] });
  }
  const oid = "1".repeat(40);
  calls.push({ fn: "objects.changes_from_leaves", args: [[["src/a.ts", "100644", oid]], [["src/a.ts", "100644", oid]]] });
  calls.push({ fn: "objects.changes_from_leaves", args: [[["tools/run.sh", "100755", oid]], [["tools/run.sh", "100755", oid]]] });

  const out = py(calls);
  let i = 0;
  pathResults = PATH_CASES.map(() => out[i++]!);
  setResults = SET_CASES.map(() => out[i++]!);
  goldenPathResults = ROQ_PATH.map((g) => g.rows.map(() => out[i++]!));
  goldenSetResults = ROQ_PATH.map(() => out[i++]!);
  unchangedDiff = [out[i++]!, out[i++]!];
});

describe("validate_path", () => {
  PATH_CASES.forEach((c, n) => {
    it(`${c.title} -> ${c.expect}`, () => {
      const r = pathResults[n]!;
      expect(outcome(r)).toBe(c.expect);
      if (c.expect === "PASS") {
        // Accepted paths round-trip byte-identically, no normalisation.
        expect(r.ok).toBe(Buffer.from(c.raw).toString("latin1"));
      } else {
        expect(r.fail).toMatchObject({ phase: "paths", reason: 0 });
      }
    });
  });

  it("AV-056 NFC and NFD side by side: neither reaches the collision layer", () => {
    // Both spellings fail validate_path before any normalisation could make them equal.
    const nfc = PATH_CASES.findIndex((c) => c.title.startsWith("AV-056 NFC"));
    const nfd = PATH_CASES.findIndex((c) => c.title.startsWith("AV-056 NFD"));
    expect([outcome(pathResults[nfc]!), outcome(pathResults[nfd]!)]).toEqual(["GIT_PATH", "GIT_PATH"]);
  });

  it("AV-059/AV-060 unchanged 100644 and 100755 leaves produce no change", () => {
    expect(unchangedDiff.map((r) => r.ok)).toEqual([[], []]);
  });
});

describe("validate_path_set", () => {
  SET_CASES.forEach((c, n) => {
    it(`${c.title} -> ${c.expect}`, () => {
      expect(outcome(setResults[n]!)).toBe(c.expect);
    });
  });
});

describe("ROQ path goldens", () => {
  ROQ_PATH.forEach((g, n) => {
    if (MODE_GOLDEN.test(g.id)) {
      // Mode admission (120000/160000/unknown -> SCOPE_MODE) is Task B; A only owns the path fact.
      it(`${g.id} [A-level: path a.ts accepted; mode outcome ${g.accept} belongs to Task B]`, () => {
        expect(goldenPathResults[n]!.map(outcome)).toEqual(["PASS"]);
        expect(goldenPathResults[n]![0]!.ok).toBe("a.ts");
      });
      return;
    }
    it(`${g.id} -> ${g.accept ? "accept" : "reject"}`, () => {
      const each = goldenPathResults[n]!.map(outcome);
      const accepted = each.every((o) => o === "PASS") && outcome(goldenSetResults[n]!) === "PASS";
      expect(accepted).toBe(g.accept);
      for (const o of each) expect(["PASS", "GIT_PATH"]).toContain(o);
      if (each.every((o) => o === "PASS") && !g.accept) expect(outcome(goldenSetResults[n]!)).toBe("GIT_COLLISION");
    });
  });
});
