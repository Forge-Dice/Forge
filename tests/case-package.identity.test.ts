import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  SESSION_JSON_LIMITS,
  hashProofProfile,
  hashChallengeComponent,
  hashInitialSetup,
  hashNpcBundle,
  hashNpcSnapshot,
  hashPackage,
  hashPublicContent,
  hashRefs,
  hashReleaseManifest,
  hashSessionJson,
  serializeSessionJson,
  validateSessionJson,
} from "../src/domain/case-package.identity.ts";

// Contract MYST-SESSION-0001A §2 (profile C, H, component hashes) and §11 JSON safety.

const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

describe("profile C", () => {
  it("sorts keys by UTF-16 code units and keeps array order", () => {
    expect(serializeSessionJson({ b: [3, 1, 2], a: { d: null, c: "x" }, "é": true, Z: 1 })).toBe(
      '{"Z":1,"a":{"c":"x","d":null},"b":[3,1,2],"é":true}',
    );
  });

  it("save golden vectors (§11): empty, order-a, order-b", () => {
    const empty = { schemaVersion: 1, packageIdentity: { schemaVersion: 1, packageHash: "0".repeat(64), rulesetVersion: "mystery-session-v1" }, events: [] };
    const interrogate = { type: "interrogate", npc: "pr1_0000000000000001", questionId: "question:q01" };
    const investigate = { type: "investigate", action: "search_location", target: "pr1_0000000000000002" };
    const vectors: [unknown, string, string][] = [
      [
        empty,
        '{"events":[],"packageIdentity":{"packageHash":"0000000000000000000000000000000000000000000000000000000000000000","rulesetVersion":"mystery-session-v1","schemaVersion":1},"schemaVersion":1}',
        "58a1857b0b76ba1f342237261c2d4c9877f7cc7bb2a78c116d8e1ecebdc6875f",
      ],
      [
        { events: [interrogate, investigate] },
        '{"events":[{"npc":"pr1_0000000000000001","questionId":"question:q01","type":"interrogate"},{"action":"search_location","target":"pr1_0000000000000002","type":"investigate"}]}',
        "34070a1340d5d69359930e4c7549045873aa4c370831e127afd10c91a62095af",
      ],
      [
        { events: [investigate, interrogate] },
        '{"events":[{"action":"search_location","target":"pr1_0000000000000002","type":"investigate"},{"npc":"pr1_0000000000000001","questionId":"question:q01","type":"interrogate"}]}',
        "3004ef17c2a6cba8f8f67fd0fb1d51f11722e00ef36c5bca97a21a2bc5799dc1",
      ],
    ];
    for (const [value, bytes, digest] of vectors) {
      expect(serializeSessionJson(value)).toBe(bytes);
      expect(hashSessionJson("forge-session-save-v1", value)).toBe(digest);
    }
  });

  it("H is SHA-256 over tag, LF and C", () => {
    expect(hashSessionJson("tag", { b: 1, a: 2 })).toBe(sha('tag\n{"a":2,"b":1}'));
  });

  it("the release manifest is hashed as given, without a second JSON quoting", () => {
    const manifest = '{"adapterVersion":"forge-release-proof-v1"}';
    expect(hashReleaseManifest(manifest)).toBe(sha(`forge-session-release-v1\n${manifest}`));
  });
});

describe("component hashes sort exactly their set boundaries", () => {
  const e = (kind: string, id: string) => ({ kind, id });

  it("snapshot: awareness and attitudes are sets, everything else counts", () => {
    const s = { npcId: "person:a", asOf: 1, awareness: [{ x: 2 }, { x: 1 }], attitudes: [{ y: 2 }, { y: 1 }] };
    const h = hashNpcSnapshot(s);
    expect(hashNpcSnapshot({ ...s, awareness: [...s.awareness].reverse(), attitudes: [...s.attitudes].reverse() })).toBe(h);
    expect(hashNpcSnapshot({ ...s, asOf: 2 })).not.toBe(h);
  });

  it("bundle by npcId, initial by kind/id, challenge by C(claim), refs by kind/id", () => {
    const bundle = [
      { npcId: "person:b", snapshotHash: "1", profileHash: "2" },
      { npcId: "person:a", snapshotHash: "3", profileHash: "4" },
    ];
    expect(hashNpcBundle([...bundle].reverse())).toBe(hashNpcBundle(bundle));
    const known = [e("person", "person:b"), e("location", "location:a")];
    expect(hashInitialSetup({ schemaVersion: 1, known: [...known].reverse() })).toBe(hashInitialSetup({ schemaVersion: 1, known }));
    const claims = [{ kind: "x", eventId: "event:b" }, { eventId: "event:a", kind: "x" }];
    expect(hashChallengeComponent({ allowedClaims: [...claims].reverse() })).toBe(hashChallengeComponent({ allowedClaims: claims }));
    const refs = { config: { profile: "p", saltHex: "s" }, caseId: "case:c", truthHash: "t", mapping: [{ kind: "person", id: "person:b", ref: "r1" }, { kind: "item", id: "item:a", ref: "r2" }] };
    expect(hashRefs({ ...refs, mapping: [...refs.mapping].reverse() })).toBe(hashRefs(refs));
    expect(hashRefs({ ...refs, config: { profile: "p", saltHex: "t" } })).not.toBe(hashRefs(refs));
  });

  it("public content by explicit keys", () => {
    const content = {
      title: "t",
      labels: [{ entity: e("person", "person:b") }, { entity: e("item", "item:a") }],
      questionTexts: [{ npc: "person:b", questionId: "question:a" }, { npc: "person:a", questionId: "question:b" }],
      publicRules: [{ id: "rule:b" }, { id: "rule:a" }],
    };
    const reversed = {
      ...content,
      labels: [...content.labels].reverse(),
      questionTexts: [...content.questionTexts].reverse(),
      publicRules: [...content.publicRules].reverse(),
    };
    expect(hashPublicContent(reversed)).toBe(hashPublicContent(content));
  });

  it("package hash: proof null pairs both hashes with null", () => {
    const base = { rulesetVersion: "mystery-session-v1", releaseContextHash: "a".repeat(64), releaseHash: null, proofHash: null };
    expect(hashPackage(base)).toBe(hashSessionJson("forge-case-package-v1", { schemaVersion: 1, ...base }));
    expect(hashPackage({ ...base, releaseHash: "b".repeat(64), proofHash: "c".repeat(64) })).not.toBe(hashPackage(base));
  });
});

describe("validateSessionJson", () => {
  const ok = { ok: true };

  it("accepts plain JSON, including shared acyclic subtrees and null-prototype objects", () => {
    const shared = { a: 1 };
    expect(validateSessionJson({ x: shared, y: [shared, shared], z: Object.assign(Object.create(null), { k: "v" }) })).toEqual(ok);
  });

  it.each([
    ["undefined", { a: undefined }],
    ["function", { a: () => 1 }],
    ["symbol", { a: Symbol("s") }],
    ["bigint", { a: 1n }],
    ["NaN", [Number.NaN]],
    ["Infinity", [Infinity]],
    ["unsafe integer", [2 ** 53]],
    ["lone surrogate", ["\udc00"]],
    ["lone surrogate key", { "\ud800": 1 }],
    ["Date", [new Date(0)]],
    ["Map", [new Map()]],
    ["class instance", [new (class X {})()]],
    ["sparse array", [, 1]], // eslint-disable-line no-sparse-arrays
    ["symbol key", { [Symbol("k")]: 1 }],
    ["accessor", Object.defineProperty({}, "a", { get: () => 1, enumerable: true })],
  ])("rejects %s as SHAPE", (_name, value) => {
    expect(validateSessionJson(value)).toMatchObject({ ok: false, code: "SHAPE" });
  });

  it("rejects cycles without recursing", () => {
    const a: any = { b: {} };
    a.b.a = a;
    expect(validateSessionJson(a)).toEqual({ ok: false, code: "SHAPE", path: ["b", "a"] });
  });

  it("enforces depth and node limits iteratively", () => {
    let deep: any = 0;
    for (let i = 0; i < SESSION_JSON_LIMITS.maxDepth; i++) deep = [deep];
    expect(validateSessionJson(deep)).toEqual(ok);
    expect(validateSessionJson([deep])).toMatchObject({ ok: false, code: "LIMIT" });
    let veryDeep: any = 0;
    for (let i = 0; i < 100_000; i++) veryDeep = [veryDeep];
    expect(validateSessionJson(veryDeep)).toMatchObject({ ok: false, code: "LIMIT" });
    expect(validateSessionJson(Array.from({ length: SESSION_JSON_LIMITS.maxNodes - 1 }, () => 0))).toEqual(ok);
    expect(validateSessionJson(Array.from({ length: SESSION_JSON_LIMITS.maxNodes }, () => 0))).toMatchObject({ ok: false, code: "LIMIT" });
  });
});

describe("proof profile hash", () => {
  const profile = {
    answerScope: ["conclusion:b", "conclusion:a"],
    observations: [
      { id: "obs:r", kind: "PUBLIC_RULE", rules: [{ edgeId: "e2", allOf: ["n2", "n1"] }, { edgeId: "e1", allOf: ["n1"] }] },
      { id: "obs:a", kind: "ENTITY_AWARENESS" },
    ],
    nodes: [{ id: "n2" }, { id: "n1" }],
    edges: [{ id: "e2", allOf: ["n2", "n1"] }, { id: "e1", allOf: ["n1"] }],
    witnessStepIds: ["s1", "s2"],
  };
  const h = hashProofProfile(profile);

  it("SET paths are order-free, including nested allOf", () => {
    const rule = profile.observations[0] as { rules: { edgeId: string; allOf: string[] }[] };
    const permuted = {
      ...profile,
      answerScope: [...profile.answerScope].reverse(),
      observations: [
        profile.observations[1]!,
        { ...profile.observations[0]!, rules: [...rule.rules].reverse().map((r) => ({ ...r, allOf: [...r.allOf].reverse() })) },
      ],
      nodes: [...profile.nodes].reverse(),
      edges: [...profile.edges].reverse().map((e) => ({ ...e, allOf: [...e.allOf].reverse() })),
    };
    expect(hashProofProfile(permuted)).toBe(h);
  });

  it("M6 witnessStepIds stay ORDERED", () => {
    expect(hashProofProfile({ ...profile, witnessStepIds: ["s2", "s1"] })).not.toBe(h);
  });
});
