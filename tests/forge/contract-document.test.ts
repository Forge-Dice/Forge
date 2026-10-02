import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CONTRACT_HASH_PREFIX, contractPathFor, parseContractDocument } from "../../src/forge/contract-document.ts";
import { nodeSha256Utf8 } from "../../src/forge/node-sha256.ts";
import { contractText, metadata, unfrozenPaths } from "./fixtures.ts";

const parse = (text: string) => parseContractDocument(text, nodeSha256Utf8);
const codes = (text: string) => {
  const result = parse(text);
  return result.ok ? [] : result.issues.map((issue) => issue.code);
};

// Hashes computed independently with coreutils sha256sum (see FORGE-CORE-0001A A-03).
const GOLDEN_TEXT = contractText();
const GOLDEN_HASH = "6dbab4ccd221f53b15c3d58bc5899a4047e03dfbf34930805bd793bca4d5a7f6";
const GOLDEN_HASH_WITHOUT_PREFIX = "0b7d2429963edbe47a52dc8ef76666261c7aa91cb05e1a4f746d744dce3ea9ed";

describe("hash", () => {
  it("matches the independently computed golden vector", () => {
    const result = parse(GOLDEN_TEXT);
    expect(result.ok && result.document.ref).toEqual({ taskId: "TASK-0001", contractVersion: 1, contentHash: GOLDEN_HASH });
  });

  it("covers the domain prefix", () => {
    expect(CONTRACT_HASH_PREFIX).toBe("forge-contract-v1\n");
    expect(nodeSha256Utf8(GOLDEN_TEXT)).toBe(GOLDEN_HASH_WITHOUT_PREFIX);
    expect(GOLDEN_HASH).not.toBe(GOLDEN_HASH_WITHOUT_PREFIX);
  });

  it("encodes multi-byte UTF-8 including surrogate pairs like sha256sum does", () => {
    expect(nodeSha256Utf8("forge-contract-v1\nÄ€😀\n")).toBe("7ec513514224417953dea8e36b83a2085d85909d463fe31770f4cec00c290c88");
  });

  it.each([
    ["one body character", (t: string) => t.replace("Body.", "Body!")],
    ["a trailing newline removed", (t: string) => t.slice(0, -1)],
    ["a truncated body", (t: string) => t.slice(0, t.indexOf("Body."))],
    ["a space inside the body", (t: string) => t.replace("# Contract", "#  Contract")],
  ])("changes when %s changes", (_name, edit) => {
    const edited = parse(edit(GOLDEN_TEXT));
    expect(edited.ok).toBe(true);
    expect(edited.ok && edited.document.ref.contentHash).not.toBe(GOLDEN_HASH);
  });

  it("is computed from the exact text, so metadata and hash cannot disagree", () => {
    const result = parse(GOLDEN_TEXT);
    expect(result.ok && result.document.text).toBe(GOLDEN_TEXT);
    expect(result.ok && result.document.metadata).toEqual(metadata());
  });
});

describe("stage 1: encoding", () => {
  it.each<[string, string, string[]]>([
    ["BOM", `\uFEFF${GOLDEN_TEXT}`, ["BOM"]],
    ["CR in the body", GOLDEN_TEXT.replace("Body.", "Body.\r"), ["CARRIAGE_RETURN"]],
    ["CRLF line endings", GOLDEN_TEXT.replaceAll("\n", "\r\n"), ["CARRIAGE_RETURN"]],
    ["lone high surrogate", `${GOLDEN_TEXT}\uD800`, ["NOT_WELL_FORMED_UNICODE"]],
    ["lone low surrogate", `${GOLDEN_TEXT}\uDC00x`, ["NOT_WELL_FORMED_UNICODE"]],
    ["reversed surrogate pair", `${GOLDEN_TEXT}\uDE00\uD83D`, ["NOT_WELL_FORMED_UNICODE"]],
    ["all three at once", `\uFEFF${GOLDEN_TEXT}\r\uD800`, ["NOT_WELL_FORMED_UNICODE", "BOM", "CARRIAGE_RETURN"]],
  ])("rejects %s", (_name, text, expected) => {
    expect(codes(text)).toEqual(expected);
  });

  it.each([
    ["a valid surrogate pair", `${GOLDEN_TEXT}😀\n`],
    ["U+FEFF not at the start", `${GOLDEN_TEXT}\uFEFF`],
    ["a lone surrogate escaped as text", `${GOLDEN_TEXT}\\uD800\n`],
  ])("accepts %s", (_name, text) => {
    expect(parse(text).ok).toBe(true);
  });
});

describe("stage 2-3: frontmatter", () => {
  const json = JSON.stringify(metadata(), null, 2);

  it.each<[string, string, string]>([
    ["no frontmatter", "# Contract\n", "FRONTMATTER_MISSING"],
    ["YAML frontmatter (pilot format)", `---\ntask: TASK-0004\n---\n`, "FRONTMATTER_MISSING"],
    ["opener without newline", `---json${json}\n---\n`, "FRONTMATTER_MISSING"],
    ["leading blank line", `\n${GOLDEN_TEXT}`, "FRONTMATTER_MISSING"],
    ["missing closer", `---json\n${json}\n`, "FRONTMATTER_UNTERMINATED"],
    ["closer without trailing newline", `---json\n${json}\n---`, "FRONTMATTER_UNTERMINATED"],
    ["truncated inside the frontmatter", GOLDEN_TEXT.slice(0, 60), "FRONTMATTER_UNTERMINATED"],
    ["empty frontmatter", "---json\n---\nbody", "FRONTMATTER_JSON"],
    ["invalid JSON", `---json\n{ "a": }\n---\n`, "FRONTMATTER_JSON"],
    ["compact JSON", `---json\n${JSON.stringify(metadata())}\n---\n`, "FRONTMATTER_NOT_CANONICAL"],
    ["four-space indentation", `---json\n${JSON.stringify(metadata(), null, 4)}\n---\n`, "FRONTMATTER_NOT_CANONICAL"],
    ["trailing space", `---json\n${json} \n---\n`, "FRONTMATTER_NOT_CANONICAL"],
    ["duplicate key (later value would win silently)", `---json\n${json.replace('"contractVersion": 1,', '"contractVersion": 1,\n  "contractVersion": 2,')}\n---\n`, "FRONTMATTER_NOT_CANONICAL"],
    ["unicode escape instead of the character", `---json\n${json.replace('"TASK-0001"', '"\\u0054ASK-0001"')}\n---\n`, "FRONTMATTER_NOT_CANONICAL"],
  ])("rejects %s", (_name, text, expected) => {
    expect(codes(text)).toEqual([expected]);
  });

  it.each([10_000, 200_000])("never throws on frontmatter nested %i levels deep", (depth) => {
    const text = `---json\n${"[".repeat(depth)}${"]".repeat(depth)}\n---\n`;
    expect(() => parse(text)).not.toThrow();
    expect(codes(text)).toEqual(["FRONTMATTER_JSON"]);
  });

  it("accepts canonical JSON with a different key order", () => {
    const reordered = Object.fromEntries(Object.entries(metadata()).reverse());
    expect(parse(contractText(reordered)).ok).toBe(true);
  });

  it.each([
    ["an empty body", contractText(metadata(), "")],
    ["a body that contains another --- line", contractText(metadata(), "a\n---\nb\n")],
  ])("accepts %s", (_name, text) => {
    expect(parse(text).ok).toBe(true);
  });
});

describe("stage 4: metadata schema", () => {
  const pathsOf = (meta: Record<string, unknown>) => {
    const result = parse(contractText(meta));
    return result.ok ? [] : result.issues.map((issue) => [issue.code, JSON.stringify(issue.path)]);
  };

  it.each<[string, Record<string, unknown>, unknown[]]>([
    ["status field (TASK-0004 contradiction)", metadata({ status: "approved", architecture_review: "pending" }), ["metadata"]],
    ["approved field", metadata({ approved: true }), ["metadata"]],
    ["__proto__ key", JSON.parse(JSON.stringify(metadata()).replace("{", '{"__proto__":{"status":"approved"},')), ["metadata"]],
    ["format 2", metadata({ forgeContractFormat: 2 }), ["metadata", "forgeContractFormat"]],
    ["version 0", metadata({ contractVersion: 0 }), ["metadata", "contractVersion"]],
    ["unsafe version", metadata({ contractVersion: 2 ** 53 }), ["metadata", "contractVersion"]],
    ["short base commit", metadata({ baseCommit: "e9cb8e2" }), ["metadata", "baseCommit"]],
    ["uppercase base commit", metadata({ baseCommit: "A".repeat(40) }), ["metadata", "baseCommit"]],
    ["bad task id", metadata({ taskId: "task-1" }), ["metadata", "taskId"]],
    ["self dependency", metadata({ dependencies: [{ taskId: "TASK-0001", acceptedCommit: null }] }), ["metadata", "dependencies", 0, "taskId"]],
    ["duplicate dependency", metadata({ dependencies: [{ taskId: "TASK-0002", acceptedCommit: null }, { taskId: "TASK-0002", acceptedCommit: null }] }), ["metadata", "dependencies", 1, "taskId"]],
    ["extra field on dependency", metadata({ dependencies: [{ taskId: "TASK-0002", acceptedCommit: null, note: "x" }] }), ["metadata", "dependencies", 0]],
    ["contract file in scope", metadata({ scope: { create: ["forge/contracts/TASK-0001.md"], modify: [] } }), ["metadata", "scope", "create", 0]],
    ["overlapping scope", metadata({ scope: { create: ["src/a.ts"], modify: ["src/a.ts"] } }), ["metadata", "scope", "modify", 0]],
    ["duplicate scope path", metadata({ scope: { create: ["src/a.ts", "src/a.ts"], modify: [] } }), ["metadata", "scope", "create", 1]],
    ["absolute path", metadata({ scope: { create: ["/etc/passwd"], modify: [] } }), ["metadata", "scope", "create", 0]],
    ["parent segment", metadata({ scope: { create: ["src/../x.ts"], modify: [] } }), ["metadata", "scope", "create", 0]],
    ["empty segment", metadata({ scope: { create: ["src//x.ts"], modify: [] } }), ["metadata", "scope", "create", 0]],
    ["trailing slash", metadata({ scope: { create: ["src/"], modify: [] } }), ["metadata", "scope", "create", 0]],
    ["no checks", metadata({ requiredChecks: [] }), ["metadata", "requiredChecks"]],
    ["duplicate check name", metadata({ requiredChecks: [{ name: "test", command: "a" }, { name: "test", command: "b" }] }), ["metadata", "requiredChecks", 1, "name"]],
    ["blank check command", metadata({ requiredChecks: [{ name: "test", command: " " }] }), ["metadata", "requiredChecks", 0, "command"]],
    ["unknown mutation mode", metadata({ mutationSmoke: "always" }), ["metadata", "mutationSmoke"]],
    ["JSON array instead of object", null as never, ["metadata"]],
  ])("rejects %s", (_name, meta, path) => {
    const actual = meta === null ? (() => {
      const result = parse("---json\n[]\n---\n");
      return result.ok ? [] : result.issues.map((issue) => [issue.code, JSON.stringify(issue.path)]);
    })() : pathsOf(meta);
    expect(actual).toContainEqual(["METADATA_SCHEMA", JSON.stringify(path)]);
  });

  it.each<[string, Record<string, unknown>]>([
    ["a resolved dependency", metadata({ dependencies: [{ taskId: "TASK-0002", acceptedCommit: "4".repeat(40) }] })],
    ["an unresolved dependency (draft)", metadata({ dependencies: [{ taskId: "TASK-0002", acceptedCommit: null }] })],
    ["another task's contract path in scope", metadata({ scope: { create: ["forge/contracts/TASK-0002.md"], modify: [] } })],
    ["dotted file names", metadata({ scope: { create: [".github/x.yml", "a/.b/c.d.ts"], modify: [] } })],
  ])("accepts %s", (_name, meta) => {
    expect(parse(contractText(meta)).ok).toBe(true);
  });
});

it("results are deeply frozen and paths are stable", () => {
  expect(unfrozenPaths(parse(GOLDEN_TEXT))).toEqual([]);
  expect(unfrozenPaths(parse("x"))).toEqual([]);
  expect(contractPathFor("FORGE-CORE-0001A")).toBe("forge/contracts/FORGE-CORE-0001A.md");
});

// ---------- Phase 8: fuzz-like edits without a fuzzing dependency ----------


function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PIECES = ["\r", "﻿", "\uD800", "\uDC00", "😀", "\n---\n", "---json\n", "{", "}", '"', ",", " ", "\n", "\u0000", "\\u0041", "status", "ä", "1e3", "-0"];
const KNOWN_CODES = new Set([
  "NOT_WELL_FORMED_UNICODE", "BOM", "CARRIAGE_RETURN", "FRONTMATTER_MISSING", "FRONTMATTER_UNTERMINATED",
  "FRONTMATTER_JSON", "FRONTMATTER_NOT_CANONICAL", "METADATA_SCHEMA",
]);

function edit(text: string, rnd: () => number): string {
  const at = Math.floor(rnd() * (text.length + 1));
  const roll = rnd();
  if (roll < 0.35) return text.slice(0, at) + PIECES[Math.floor(rnd() * PIECES.length)] + text.slice(at);
  if (roll < 0.65) return text.slice(0, at) + text.slice(at + 1 + Math.floor(rnd() * 5));
  if (roll < 0.85) return text.slice(0, at);
  return text.slice(0, at) + String.fromCharCode(Math.floor(rnd() * 0x10000)) + text.slice(at + 1);
}

describe("fuzz: random edits of a valid contract", () => {
  it.each(Array.from({ length: 20 }, (_, i) => i + 1))("seed %i: never throws; ok results hash the exact text", (seed) => {
    const rnd = prng(seed);
    let text = GOLDEN_TEXT;
    let okCount = 0;
    for (let i = 0; i < 150; i++) {
      text = rnd() < 0.2 ? GOLDEN_TEXT : edit(text, rnd);
      let result!: ReturnType<typeof parse>;
      expect(() => (result = parse(text))).not.toThrow();
      expect(parse(text)).toEqual(result); // deterministic
      if (result.ok) {
        okCount++;
        expect(result.document.text).toBe(text);
        const independent = createHash("sha256").update(Buffer.from(CONTRACT_HASH_PREFIX + text, "utf8")).digest("hex");
        expect(result.document.ref.contentHash).toBe(independent);
        const json = text.slice(8, text.indexOf("\n---\n", 7));
        expect(JSON.stringify(JSON.parse(json), null, 2)).toBe(json);
      } else {
        expect(result.issues.length).toBeGreaterThan(0);
        for (const issue of result.issues) expect(KNOWN_CODES.has(issue.code)).toBe(true);
      }
    }
    expect(okCount).toBeGreaterThan(0); // the fuzzer does reach the success path
  });

  it("every single-character deletion of the golden contract is either rejected or hashes differently", () => {
    for (let at = 0; at < GOLDEN_TEXT.length; at++) {
      const text = GOLDEN_TEXT.slice(0, at) + GOLDEN_TEXT.slice(at + 1);
      const result = parse(text);
      if (result.ok) expect(result.document.ref.contentHash).not.toBe(GOLDEN_HASH);
    }
  });

  it("body-only edits keep metadata identical but always change the hash", () => {
    const bodyStart = GOLDEN_TEXT.indexOf("\n---\n") + 5;
    const rnd = prng(99);
    for (let i = 0; i < 200; i++) {
      const at = bodyStart + Math.floor(rnd() * (GOLDEN_TEXT.length - bodyStart));
      const text = GOLDEN_TEXT.slice(0, at) + "x" + GOLDEN_TEXT.slice(at);
      const result = parse(text);
      expect(result.ok && result.document.metadata).toEqual(metadata());
      expect(result.ok && result.document.ref.contentHash).not.toBe(GOLDEN_HASH);
    }
  });
});
