import { describe, expect, it } from "vitest";
import { parseCaseTruth, type CaseId } from "../src/domain/case-truth.ts";
import * as playerRefModule from "../src/domain/player-ref.ts";
import {
  PLAYER_REF_KINDS,
  RefSaltSchema,
  buildPlayerRefIndex,
  derivePlayerRef,
  nodePlayerRefDigest,
  playerRefFor,
  resolvePlayerRef,
  type PlayerRefDigest,
  type PlayerRefIndex,
  type PlayerRefKind,
} from "../src/domain/player-ref.ts";
import { GOLDEN_SHA256, fullCase, goldenCase } from "./case-truth.fixture.ts";

const SALT_A = "000102030405060708090a0b0c0d0e0f";
const SALT_B = "ffeeddccbbaa99887766554433221100";
const saltA = RefSaltSchema.parse(SALT_A);

function indexOf(input: object, salt: unknown = SALT_A, digest?: PlayerRefDigest): PlayerRefIndex {
  const result = buildPlayerRefIndex(parseCaseTruth(input), salt, digest);
  if (!result.success) throw new Error(result.code);
  return result.index;
}

const VECTORS: [string, PlayerRefKind, string, string][] = [
  ["V-01", "person", "person:a", "pr1_xfs3rzypnyradx49"],
  ["V-02", "person", "person:b", "pr1_zmkgz9c35yhk1qa3"],
  ["V-03", "location", "location:hall", "pr1_znh7e2dfbmaffz8n"],
  ["V-04", "event", "event:e1", "pr1_yyqw0dn6dan7mbdt"],
];

const V10: [string, PlayerRefKind, string][] = [
  ["pr1_4f7xab53w32bm1nq", "evidence", "evidence:muddy-path"],
  ["pr1_5s8wthkphwmbqdc6", "item", "item:gloves"],
  ["pr1_6285tzxc83e3g5q1", "event", "event:argument"],
  ["pr1_6yp173ecv3kyxw7a", "person", "person:clara"],
  ["pr1_8ygr2bxhpn23v044", "location", "location:garden"],
  ["pr1_91c38h84td51armq", "person", "person:ben"],
  ["pr1_a03gmjhxm43jy18s", "event", "event:murder"],
  ["pr1_an69m26v8wh36rry", "person", "person:anna"],
  ["pr1_e74ex610g3y06nkv", "item", "item:letter-opener"],
  ["pr1_ev3pwyaqzgwkdj6b", "location", "location:library"],
  ["pr1_exgtx0h021znk18z", "event", "event:walk"],
  ["pr1_ppefvgdapyzmbdwy", "evidence", "evidence:fingerprint"],
  ["pr1_ptkpjfzwyt1j4hxq", "evidence", "evidence:gloves-dirty"],
  ["pr1_zmsb75vykvcrjr04", "evidence", "evidence:anna-statement"],
];

const golden = (kind: PlayerRefKind, id: string, refSalt = saltA) =>
  derivePlayerRef({ refSalt, caseId: "case:golden" as CaseId, truthHash: GOLDEN_SHA256, kind, id });

describe("AC-01: public API", () => {
  it("exports exactly the contract's runtime values", () => {
    expect(Object.keys(playerRefModule).sort()).toEqual(
      [
        "PLAYER_REF_KINDS",
        "PLAYER_REF_PROFILE",
        "PlayerRefSchema",
        "RefSaltSchema",
        "buildPlayerRefIndex",
        "derivePlayerRef",
        "nodePlayerRefDigest",
        "playerRefFor",
        "resolvePlayerRef",
      ].sort(),
    );
    expect(playerRefModule.PLAYER_REF_PROFILE).toBe("forge-mystery-playerref-v1");
    expect(PLAYER_REF_KINDS).toEqual(["person", "location", "item", "event", "evidence"]);
  });
});

describe("AC-02/03/04: derivation vectors", () => {
  it.each(VECTORS)("%s via derivePlayerRef", (_id, kind, id, ref) => {
    expect(golden(kind, id)).toBe(ref);
  });

  it("V-01..V-04 via buildPlayerRefIndex(goldenCase)", () => {
    const index = indexOf(goldenCase());
    for (const [, kind, id, ref] of VECTORS) expect(playerRefFor(index, kind, id)).toBe(ref);
    expect(index.entries).toHaveLength(4);
  });

  it("V-05: SALT_B", () => {
    expect(golden("person", "person:a", RefSaltSchema.parse(SALT_B))).toBe("pr1_44rh5ek8sxdz4w97");
  });

  it("V-10: fullCase index has exactly these 14 entries in this order", () => {
    const index = indexOf(fullCase());
    expect(index.caseId).toBe("case:letter-opener");
    expect(index.truthHash).toBe("f8794eba02ff4cb846158a9d5d145ade93e24fd109d88f7a4b5244f175453a73");
    expect(index.entries.map((e) => [e.ref, e.kind, e.id])).toEqual(V10);
  });

  it("AC-04: every ref has the fixed ASCII form", () => {
    for (const entry of [...indexOf(fullCase()).entries, ...indexOf(goldenCase()).entries]) {
      expect(entry.ref).toMatch(/^pr1_[0-9a-hjkmnp-tv-z]{16}$/);
      expect(entry.ref).toHaveLength(20);
      expect(/^[\x20-\x7e]+$/.test(entry.ref)).toBe(true);
    }
  });
});

describe("AC-05..08: binding", () => {
  it("AC-05: only the five entity kinds are indexed", () => {
    const input = fullCase();
    const index = indexOf(input);
    const expected = [
      ...input.persons.map((p) => p.id),
      ...input.locations.map((l) => l.id),
      ...input.items.map((i) => i.id),
      ...input.events.map((e) => e.id),
      ...input.evidence.map((e) => e.id),
    ].sort();
    expect(index.entries.map((e) => e.id).sort()).toEqual(expected);
    expect(input.propositions.length + input.secrets.length + input.redHerrings.length).toBeGreaterThan(0);
    expect(input.motives.length + input.relationships.length).toBeGreaterThan(0);
  });

  it("AC-06: another salt changes every ref", () => {
    const a = indexOf(fullCase(), SALT_A);
    const b = indexOf(fullCase(), SALT_B);
    for (const entry of a.entries) expect(playerRefFor(b, entry.kind, entry.id)).not.toBe(entry.ref);
  });

  it("AC-07: another truth revision changes every ref", () => {
    const a = indexOf(fullCase());
    const b = indexOf({ ...fullCase(), revision: 4 });
    expect(b.truthHash).not.toBe(a.truthHash);
    for (const entry of a.entries) expect(playerRefFor(b, entry.kind, entry.id)).not.toBe(entry.ref);
  });

  it("AC-08: the kind is part of the derivation", () => {
    expect(golden("location", "person:a")).not.toBe(golden("person", "person:a"));
  });
});

describe("AC-09: salt validation", () => {
  it.each<[string, unknown]>([
    ["length 31", SALT_A.slice(1)],
    ["length 33", `${SALT_A}0`],
    ["upper case", SALT_A.toUpperCase()],
    ["0x prefix", `0x${SALT_A.slice(2)}`],
    ["whitespace", ` ${SALT_A.slice(1)}`],
    ["non-hex", `${SALT_A.slice(0, 31)}g`],
    ["all zero", "0".repeat(32)],
    ["undefined", undefined],
    ["number", 1],
    ["object", { salt: SALT_A }],
  ])("%s", (_name, salt) => {
    const result = buildPlayerRefIndex(parseCaseTruth(goldenCase()), salt);
    expect(result).toEqual({ success: false, code: "REF_SALT_INVALID" });
    expect(Object.isFrozen(result)).toBe(true);
  });
});

describe("AC-10: collisions abort the build", () => {
  it("two specific entities with the same first 80 bits", () => {
    const digest: PlayerRefDigest = (preimage) =>
      nodePlayerRefDigest(preimage.replace(/\nperson\nperson:b$/, "\nperson\nperson:a"));
    const result = buildPlayerRefIndex(parseCaseTruth(goldenCase()), SALT_A, digest);
    expect(result).toEqual({
      success: false,
      code: "REF_COLLISION",
      collisions: [{ ref: "pr1_xfs3rzypnyradx49", first: { kind: "person", id: "person:a" }, second: { kind: "person", id: "person:b" } }],
    });
    expect(result).not.toHaveProperty("index");
  });

  it("a constant digest gives every collision, deterministically sorted", () => {
    const digest: PlayerRefDigest = () => new Uint8Array(32);
    const build = () => buildPlayerRefIndex(parseCaseTruth(fullCase()), SALT_A, digest);
    const result = build();
    if (result.success || result.code !== "REF_COLLISION") throw new Error("expected REF_COLLISION");
    expect(result.collisions).toHaveLength(13);
    const order = (e: { kind: PlayerRefKind; id: string }) => `${PLAYER_REF_KINDS.indexOf(e.kind)}|${e.id}`;
    for (const collision of result.collisions) {
      expect(collision.ref).toBe("pr1_0000000000000000");
      expect(order(collision.first) < order(collision.second)).toBe(true);
    }
    const firsts = result.collisions.map((c) => order(c.first));
    expect(firsts).toEqual([...firsts].sort());
    expect(JSON.stringify(build())).toBe(JSON.stringify(result));
  });
});

describe("AC-11/14: resolution and lookup", () => {
  const index = indexOf(fullCase());

  it("AC-11: every entry resolves, with and without matching expectedKind", () => {
    for (const entry of index.entries) {
      const expected = { success: true, kind: entry.kind, id: entry.id };
      expect(resolvePlayerRef(index, entry.ref)).toEqual(expected);
      expect(resolvePlayerRef(index, entry.ref, entry.kind)).toEqual(expected);
    }
  });

  it("AC-14: playerRefFor finds entries and returns null otherwise", () => {
    for (const entry of index.entries) expect(playerRefFor(index, entry.kind, entry.id)).toBe(entry.ref);
    expect(playerRefFor(index, "person", "person:zoe")).toBeNull();
    expect(playerRefFor(index, "item", "person:anna")).toBeNull();
    expect(playerRefFor(index, "event", "evidence:fingerprint")).toBeNull();
  });
});

describe("AC-15..17: immutability and determinism", () => {
  function objectsOf(value: unknown, into = new Set<object>()): Set<object> {
    if (typeof value === "object" && value !== null && !into.has(value)) {
      into.add(value);
      for (const child of Object.values(value)) objectsOf(child, into);
    }
    return into;
  }

  it("AC-15: results are deeply frozen and share nothing with the truth", () => {
    const truth = parseCaseTruth(fullCase());
    const before = JSON.stringify(truth);
    const built = buildPlayerRefIndex(truth, SALT_A);
    if (!built.success) throw new Error(built.code);
    const index: any = built.index;
    const resolved: any = resolvePlayerRef(built.index, index.entries[0].ref);
    const collision: any = buildPlayerRefIndex(truth, SALT_A, () => new Uint8Array(32));
    for (const value of [built, collision, resolved]) {
      for (const object of objectsOf(value)) expect(Object.isFrozen(object)).toBe(true);
    }
    expect(() => (index.caseId = "case:x")).toThrow(TypeError);
    expect(() => index.entries.push(index.entries[0])).toThrow(TypeError);
    expect(() => (index.entries[0].id = "person:x")).toThrow(TypeError);
    expect(() => (collision.collisions[0].first.id = "person:x")).toThrow(TypeError);
    expect(() => (resolved.id = "person:x")).toThrow(TypeError);
    const truthObjects = objectsOf(truth);
    for (const object of [...objectsOf(built), ...objectsOf(collision), ...objectsOf(resolved)]) {
      expect(truthObjects.has(object)).toBe(false);
    }
    expect(JSON.stringify(truth)).toBe(before);
  });

  it("AC-16: the index never contains the salt", () => {
    expect(JSON.stringify(indexOf(fullCase()))).not.toContain(SALT_A);
  });

  it("AC-17: deterministic and independent of authoring order", () => {
    expect(JSON.stringify(indexOf(fullCase()))).toBe(JSON.stringify(indexOf(fullCase())));
    const permuted = fullCase();
    for (const key of ["persons", "locations", "items", "events", "evidence"] as const) {
      (permuted[key] as unknown[]).reverse();
    }
    expect(JSON.stringify(indexOf(permuted))).toBe(JSON.stringify(indexOf(fullCase())));
  });
});

describe("AC-20: mutation anchors", () => {
  it("each anchor occurs exactly once", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("../src/domain/player-ref.ts", import.meta.url), "utf8");
    for (const anchor of [
      '[PLAYER_REF_PROFILE, refSalt, caseId, truthHash, kind, id].join("\\n")',
      "digest(preimage).subarray(0, 10)",
      '"0123456789abcdefghjkmnpqrstvwxyz"',
      "/^[0-9a-f]{32}$/",
      'const ZERO_SALT = "0".repeat(32);',
      "if (collisions.length > 0)",
      ".sort(byRef)",
      "entry.kind !== expectedKind",
    ]) {
      expect(source.split(anchor).length - 1, anchor).toBe(1);
    }
  });
});
