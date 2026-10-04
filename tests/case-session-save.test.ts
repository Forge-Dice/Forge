import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { serializeSessionJson } from "../src/domain/case-package.identity.ts";
import type { ResolvedCasePackage } from "../src/domain/case-package.ts";
import { initialSession, replaySession, type SessionState } from "../src/domain/case-session.ts";
import * as saveModule from "../src/domain/case-session-save.ts";
import { decodeSessionSave, encodeSessionSave, loadSessionSaveForPlayer, SAVE_LIMITS } from "../src/domain/case-session-save.ts";
import { CLAIMS, events, play, refOf, sessionPackage } from "./case-session.fixture.ts";

// MYST-SESSION-0001C matrix C01-C42 on the library case of Session A/B (real modules throughout).

const pkg = sessionPackage();
const e = events(pkg);
const start = initialSession(pkg);
const LOG = [
  e.search("location:library"),
  e.ask("person:dora", "where-was-ben"),
  e.ask("person:dora", "anna-in-killing"),
  e.accuse([CLAIMS.benResponsible, false]),
  e.ask("person:dora", "where-was-ben"),
];
const SOLVED_LOG = [...LOG, e.accuse([CLAIMS.benResponsible, true], [CLAIMS.nobody, false])];
const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

function encoded(state: SessionState, p: ResolvedCasePackage = pkg): string {
  const result = encodeSessionSave(p, state);
  if (!result.ok) throw new Error(result.code);
  return result.text;
}
/** Envelope with a correct checksum over arbitrary (possibly invalid) events. */
function forge(evs: unknown[], identity: object = pkg.identity): string {
  const body = { schemaVersion: 1, packageIdentity: identity, events: evs };
  return serializeSessionJson({ ...body, checksum: sha(`forge-session-save-v1\n${serializeSessionJson(body)}`) });
}
const decodeCode = (text: unknown, p: ResolvedCasePackage = pkg) => {
  const result = decodeSessionSave(p, text);
  return result.ok ? "ok" : result.code;
};
const edit = (text: string, f: (o: any) => void) => {
  const o = JSON.parse(text);
  f(o);
  return serializeSessionJson(o);
};

describe("save: API and wire", () => {
  it("exports exactly the codec, the limits and the player facade", () => {
    expect(Object.keys(saveModule).sort()).toEqual(["SAVE_LIMITS", "decodeSessionSave", "encodeSessionSave", "loadSessionSaveForPlayer"]);
    expect(SAVE_LIMITS).toEqual({ maxSaveBytes: 1024 * 1024, maxEvents: 512, maxDepth: 32, maxNodes: 100_000 });
    expect(Object.isFrozen(SAVE_LIMITS)).toBe(true);
  });

  it("golden vectors: profile tag and C reproduce the contract hashes", () => {
    const zero = { schemaVersion: 1, packageHash: "0".repeat(64), rulesetVersion: "mystery-session-v1" };
    const empty = serializeSessionJson({ schemaVersion: 1, packageIdentity: zero, events: [] });
    expect(sha(`forge-session-save-v1\n${empty}`)).toBe("58a1857b0b76ba1f342237261c2d4c9877f7cc7bb2a78c116d8e1ecebdc6875f");
    const a = { type: "interrogate", npc: "pr1_0000000000000001", questionId: "question:q01" };
    const b = { type: "investigate", action: "search_location", target: "pr1_0000000000000002" };
    expect(sha(`forge-session-save-v1\n${serializeSessionJson({ events: [a, b] })}`)).toBe("34070a1340d5d69359930e4c7549045873aa4c370831e127afd10c91a62095af");
    expect(sha(`forge-session-save-v1\n${serializeSessionJson({ events: [b, a] })}`)).toBe("3004ef17c2a6cba8f8f67fd0fb1d51f11722e00ef36c5bca97a21a2bc5799dc1");
  });

  it("the envelope has exactly four root fields and a three-field identity, keys in C order", () => {
    const text = encoded(play(pkg, LOG));
    const o = JSON.parse(text);
    expect(Object.keys(o)).toEqual(["checksum", "events", "packageIdentity", "schemaVersion"]);
    expect(Object.keys(o.packageIdentity)).toEqual(["packageHash", "rulesetVersion", "schemaVersion"]);
    expect(o.events).toEqual(LOG);
    expect(text).not.toMatch(/knowledge|verdict|phase|solved|discover/);
  });
});

describe("save: roundtrip", () => {
  it("C01 empty history saves and loads as initialSession", () => {
    expect(decodeSessionSave(pkg, encoded(start))).toEqual({ ok: true, state: start });
  });

  it("C02 a full witness history roundtrips Known, discoveries and records", () => {
    const state = play(pkg, LOG);
    const loaded = decodeSessionSave(pkg, encoded(state));
    expect(loaded).toEqual({ ok: true, state });
    if (loaded.ok) expect(loaded.state.knowledge.observations.length).toBeGreaterThan(2);
  });

  it("C03 a solved history roundtrips with its terminal phase", () => {
    const state = play(pkg, SOLVED_LOG);
    expect(state.phase).toBe("solved");
    expect(decodeSessionSave(pkg, encoded(state))).toEqual({ ok: true, state });
  });

  it("C13 an old save loads against the archived exact package (fresh resolve, same ruleset)", () => {
    const archived = sessionPackage();
    expect(archived.identity).toEqual(pkg.identity);
    expect(decodeCode(encoded(play(pkg, LOG)), archived)).toBe("ok");
  });

  it("C38 loading the same save twice gives deeply equal, independent frozen states", () => {
    const text = encoded(play(pkg, LOG));
    const a = decodeSessionSave(pkg, text);
    const b = decodeSessionSave(pkg, text);
    expect(a).toEqual(b);
    if (a.ok && b.ok) {
      expect(a.state).not.toBe(b.state);
      expect(Object.isFrozen(a.state.knowledge)).toBe(true);
    }
  });

  it("encoding is a pure function of the history", () => {
    expect(encoded(play(pkg, LOG))).toBe(encoded(play(sessionPackage(), LOG), sessionPackage()));
  });
});

describe("save: encode refuses an inconsistent state", () => {
  const state = play(pkg, LOG);
  it("C04 manipulated derived knowledge", () => {
    const forged = { ...state, knowledge: { ...state.knowledge, known: state.knowledge.known.slice(1) } };
    expect(encodeSessionSave(pkg, forged)).toEqual({ ok: false, code: "INVALID_STATE" });
  });
  it("C05 manipulated verdict and phase", () => {
    expect(encodeSessionSave(pkg, { ...state, verdicts: [{ eventIndex: 3, verdict: "solved" }] })).toEqual({ ok: false, code: "INVALID_STATE" });
    expect(encodeSessionSave(pkg, { ...state, phase: "solved" })).toEqual({ ok: false, code: "INVALID_STATE" });
  });
  it("a state of another package, an invalid history or a non-JSON state", () => {
    const other = sessionPackage({ pkg: (p) => (p.presentation.entries[0].text = "Am Messer klebt Blut!") });
    expect(encodeSessionSave(other, state)).toEqual({ ok: false, code: "INVALID_STATE" });
    expect(encodeSessionSave(pkg, { ...state, events: [...state.events, e.ask("person:dora", "unknown")] as any })).toEqual({ ok: false, code: "INVALID_STATE" });
    expect(encodeSessionSave(pkg, { ...state, extra: () => 1 } as any)).toEqual({ ok: false, code: "INVALID_STATE" });
  });
  it("a throwing package port is HOST_FAILURE", () => {
    const broken = { ...pkg, refs: { ...pkg.refs, resolve: () => { throw new Error("port"); } } } as ResolvedCasePackage;
    expect(encodeSessionSave(broken, state)).toEqual({ ok: false, code: "HOST_FAILURE" });
  });
});

describe("save: decode wire and envelope", () => {
  const text = encoded(play(pkg, LOG));
  it("C06/C07/C22 derived or extra fields are never authority", () => {
    expect(decodeCode(edit(text, (o) => (o.knowledge = { known: [] })))).toBe("INVALID_SAVE");
    expect(decodeCode(edit(text, (o) => (o.phase = "solved")))).toBe("INVALID_SAVE");
    expect(decodeCode(edit(text, (o) => (o.snapshot = {})))).toBe("INVALID_SAVE");
    expect(decodeCode(edit(text, (o) => (o.packageIdentity.extra = 1)))).toBe("INVALID_SAVE");
    expect(decodeCode(forge(LOG.map((ev, i) => (i === 0 ? { ...ev, accepted: true } : ev))))).toBe("INVALID_HISTORY");
  });
  it("C08 schemaVersion 2 (root or identity)", () => {
    expect(decodeCode(edit(text, (o) => (o.schemaVersion = 2)))).toBe("INVALID_SAVE");
    expect(decodeCode(edit(text, (o) => (o.packageIdentity.schemaVersion = 2)))).toBe("INVALID_SAVE");
  });
  it("C15 checksum uppercase or wrong length", () => {
    expect(decodeCode(edit(text, (o) => (o.checksum = o.checksum.toUpperCase())))).toBe("INVALID_SAVE");
    expect(decodeCode(edit(text, (o) => (o.checksum = o.checksum.slice(1))))).toBe("INVALID_SAVE");
  });
  it("C23/C24 duplicate root or nested keys", () => {
    expect(decodeCode(text.replace('{"checksum"', '{"schemaVersion":1,"checksum"'))).toBe("INVALID_SAVE");
    expect(decodeCode(text.replace('"packageIdentity":{', '"packageIdentity":{"schemaVersion":1,'))).toBe("INVALID_SAVE");
  });
  it("C25 whitespace around or inside the JSON; the codec accepts its own canonical form", () => {
    expect(decodeCode(` ${text}`)).toBe("INVALID_SAVE");
    expect(decodeCode(`${text}\n`)).toBe("INVALID_SAVE");
    expect(decodeCode(JSON.stringify(JSON.parse(text), null, 2))).toBe("INVALID_SAVE");
    expect(decodeCode(text)).toBe("ok");
  });
  it("C26 BOM, invalid JSON and non-strings", () => {
    expect(decodeCode(`﻿${text}`)).toBe("INVALID_SAVE");
    expect(decodeCode(text.slice(0, -1))).toBe("INVALID_SAVE");
    for (const input of [null, 42, undefined, JSON.parse(text), new String(text)]) expect(decodeCode(input)).toBe("INVALID_SAVE");
  });
  it("C27 a lone surrogate, raw or escaped, is invalid", () => {
    const lone = String.fromCharCode(0xd800);
    expect(decodeCode(text.replace('"events":[', `"events":["${lone}",`))).toBe("INVALID_SAVE");
    expect(decodeCode(text.replace('"events":[', '"events":["\\ud800",'))).toBe("INVALID_SAVE");
  });
  it("C28 NFC and NFD are different bytes; no normalization", () => {
    const nfc = "question:café";
    const nfd = "question:café";
    const a = forge([{ type: "interrogate", npc: refOf(pkg, "person:dora"), questionId: nfc }]);
    const b = forge([{ type: "interrogate", npc: refOf(pkg, "person:dora"), questionId: nfd }]);
    expect(a).not.toBe(b);
    expect(JSON.parse(b).events[0].questionId).toBe(nfd);
  });
  it("C29 -0 and escape variants are not canonical", () => {
    expect(decodeCode(text.replace('"schemaVersion":1}', '"schemaVersion":1.0}'))).toBe("INVALID_SAVE");
    expect(decodeCode(text.replace(/"schemaVersion":1}$/, '"schemaVersion":-0}'))).toBe("INVALID_SAVE");
    expect(decodeCode(text.replace('"type":"investigate"', '"type":"investig\\u0061te"'))).toBe("INVALID_SAVE");
  });
  it("C30 non-canonical property order", () => {
    const o = JSON.parse(text);
    expect(decodeCode(JSON.stringify({ schemaVersion: 1, packageIdentity: o.packageIdentity, events: o.events, checksum: o.checksum }))).toBe("INVALID_SAVE");
  });
});

describe("save: compatibility", () => {
  const text = encoded(play(pkg, LOG));
  const variant = (f: (p: any) => void) => decodeCode(text, sessionPackage({ pkg: f }));
  it("C09 unknown rulesetVersion", () => {
    expect(decodeCode(edit(text, (o) => (o.packageIdentity.rulesetVersion = "mystery-session-v2")))).toBe("INCOMPATIBLE_PACKAGE");
  });
  it("C10 changed packageHash", () => {
    expect(decodeCode(edit(text, (o) => (o.packageIdentity.packageHash = "f".repeat(64))))).toBe("INCOMPATIBLE_PACKAGE");
  });
  it("C11 only a presentation text changed", () => {
    expect(variant((p) => (p.presentation.entries[1].text = "Die Stiefel sind voller Gartenerde!"))).toBe("INCOMPATIBLE_PACKAGE");
  });
  it("C12 only an NPC's private provenance changed", () => {
    expect(variant((p) => (p.npcs[0].snapshot.attitudes[0].provenance = { kind: "told_by_person", personId: "person:anna" }))).toBe("INCOMPATIBLE_PACKAGE");
  });
  it("C41 only a public rule text changed", () => {
    expect(variant((p) => (p.publicContent.publicRules[0].text += " Wirklich."))).toBe("INCOMPATIBLE_PACKAGE");
  });
  it("C37 no automatic upgrade: the save never loads against a newer package", () => {
    const newer = sessionPackage({ pkg: (p) => (p.publicContent.title = "Der Bibliotheksfall II") });
    expect(newer.identity.packageHash).not.toBe(pkg.identity.packageHash);
    expect(decodeCode(text, newer)).toBe("INCOMPATIBLE_PACKAGE");
    expect(decodeCode(text, pkg)).toBe("ok");
  });
  it("package mismatch is reported before the checksum", () => {
    expect(decodeCode(edit(text, (o) => ((o.packageIdentity.packageHash = "f".repeat(64)), (o.checksum = "0".repeat(64)))))).toBe("INCOMPATIBLE_PACKAGE");
  });
});

describe("save: checksum and history", () => {
  const text = encoded(play(pkg, LOG));
  it("C14 a changed event without checksum update", () => {
    expect(decodeCode(edit(text, (o) => (o.events[1].questionId = "question:anna-in-killing")))).toBe("CHECKSUM_MISMATCH");
  });
  it("C16 a new valid history with a new checksum is accepted (no anti-cheat)", () => {
    const other = [e.search("location:library"), e.ask("person:dora", "anna-in-killing")];
    expect(decodeSessionSave(pkg, forge(other))).toEqual({ ok: true, state: play(pkg, other) });
  });
  it("C17 a shorter valid prefix with a new checksum is accepted (no rollback protection)", () => {
    expect(decodeSessionSave(pkg, forge(LOG.slice(0, 2)))).toEqual({ ok: true, state: play(pkg, LOG.slice(0, 2)) });
  });
  it("C18 a reordered history: replay decides", () => {
    expect(decodeCode(forge([LOG[1], LOG[0]]))).toBe("INVALID_HISTORY");
    expect(decodeCode(forge([LOG[0], LOG[2], LOG[1]]))).toBe("ok");
  });
  it("C19 events after solved are rejected, never truncated", () => {
    expect(decodeCode(forge([...SOLVED_LOG, e.search("location:library")]))).toBe("INVALID_HISTORY");
  });
  it("C20 a rejected event between valid ones is not skipped", () => {
    expect(decodeCode(forge([LOG[0], e.ask("person:dora", "unknown"), LOG[1]]))).toBe("INVALID_HISTORY");
  });
  it("C21 unknown or stale refs", () => {
    const stale = sessionPackage({ pkg: (p) => (p.publicContent.title = "Anders") });
    expect(decodeCode(forge([{ ...LOG[0], target: "pr1_0000000000000000" }]))).toBe("INVALID_HISTORY");
    const foreignRef = { type: "investigate", action: "search_location", target: refOf(stale, "location:garden") };
    expect(decodeCode(forge([foreignRef]))).toBe("INVALID_HISTORY");
  });
  it("C31 swapping events changes the checksum preimage", () => {
    const a = JSON.parse(forge([LOG[0], LOG[2], LOG[1]])).checksum;
    const b = JSON.parse(forge([LOG[0], LOG[1], LOG[2]])).checksum;
    expect(a).not.toBe(b);
    expect(decodeCode(edit(forge([LOG[0], LOG[1], LOG[2]]), (o) => (o.checksum = a)))).toBe("CHECKSUM_MISMATCH");
  });
  it("C32 swapping literals inside an accuse changes the bytes, not the verdict", () => {
    const head = LOG.slice(0, 1);
    const ab = [...head, e.accuse([CLAIMS.benResponsible, true], [CLAIMS.nobody, false])];
    const ba = [...head, e.accuse([CLAIMS.nobody, false], [CLAIMS.benResponsible, true])];
    expect(encoded(play(pkg, ab))).not.toBe(encoded(play(pkg, ba)));
    expect(play(pkg, ab).verdicts).toEqual(play(pkg, ba).verdicts);
  });
});

describe("save: limits and host failures", () => {
  const filler = (n: number) => Array.from({ length: n }, () => e.examinePerson("person:dora"));
  it("C33 exactly 1 MiB is inside the limit, one byte more is LIMIT_REACHED before parsing", () => {
    const base = forge([]);
    const pad = SAVE_LIMITS.maxSaveBytes - base.length;
    const exact = base.replace('"events":[]', `"events":["${"x".repeat(pad - 2)}"]`);
    expect(exact.length).toBe(SAVE_LIMITS.maxSaveBytes);
    expect(decodeCode(exact)).toBe("CHECKSUM_MISMATCH"); // passed the size gate
    expect(decodeCode(`${exact} `)).toBe("LIMIT_REACHED");
    expect(decodeCode("é".repeat(SAVE_LIMITS.maxSaveBytes / 2 + 1))).toBe("LIMIT_REACHED"); // UTF-8 bytes, not units
  });
  it("C34 more than 512 events before replay", () => {
    expect(decodeCode(forge(filler(512)))).toBe("ok");
    expect(decodeCode(forge(filler(513)))).toBe("LIMIT_REACHED");
    expect(decodeCode(edit(forge(filler(513)), (o) => (o.checksum = "0".repeat(64))))).toBe("LIMIT_REACHED");
  });
  it("C35 depth 33 and more than 100000 nodes are LIMIT_REACHED", () => {
    let deep: unknown = 0;
    for (let i = 0; i < 31; i++) deep = [deep];
    expect(decodeCode(forge([deep]))).toBe("LIMIT_REACHED");
    expect(decodeCode(forge([Array.from({ length: 100_001 }, () => 0)]))).toBe("LIMIT_REACHED");
  });
  it("C36 a throwing replay port is HOST_FAILURE without partial state", () => {
    const broken = { ...pkg, refs: { ...pkg.refs, resolve: () => { throw new Error("port"); } } } as ResolvedCasePackage;
    expect(decodeSessionSave(broken, encoded(play(pkg, LOG)))).toEqual({ ok: false, code: "HOST_FAILURE" });
  });
  it("C40 a technical binding failure behind a correct checksum is never not_solved", () => {
    const unbound = { ...pkg, challenge: { ...pkg.challenge, solutionHash: "0".repeat(64) } } as ResolvedCasePackage;
    const result = decodeSessionSave(unbound, encoded(play(pkg, SOLVED_LOG)));
    expect(result).toEqual({ ok: false, code: "HOST_FAILURE" });
  });
  it("C42 every failure is the same constant through the player facade", () => {
    const text = encoded(play(pkg, LOG));
    const broken = { ...pkg, refs: { ...pkg.refs, resolve: () => { throw new Error("port"); } } } as ResolvedCasePackage;
    const failures: [unknown, ResolvedCasePackage, string][] = [
      [`${text} `, pkg, "INVALID_SAVE"],
      [edit(text, (o) => (o.packageIdentity.packageHash = "f".repeat(64))), pkg, "INCOMPATIBLE_PACKAGE"],
      [forge(filler(513)), pkg, "LIMIT_REACHED"],
      [edit(text, (o) => (o.checksum = "0".repeat(64))), pkg, "CHECKSUM_MISMATCH"],
      [forge([LOG[1]]), pkg, "INVALID_HISTORY"],
      [text, broken, "HOST_FAILURE"],
    ];
    const outputs = failures.map(([input, p, code]) => {
      expect(decodeCode(input, p)).toBe(code);
      return loadSessionSaveForPlayer(p, input);
    });
    expect(new Set(outputs).size).toBe(1);
    expect(outputs[0]).toEqual({ ok: false, code: "SAVE_UNAVAILABLE" });
    expect(Object.isFrozen(outputs[0])).toBe(true);
    expect(loadSessionSaveForPlayer(pkg, text)).toEqual({ ok: true, state: play(pkg, LOG) });
  });
  it("decode never echoes an event index", () => {
    expect(decodeSessionSave(pkg, forge([LOG[0], LOG[0], LOG[1], e.ask("person:dora", "unknown")]))).toEqual({ ok: false, code: "INVALID_HISTORY" });
  });
  it("decode agrees with replaySession on the reconstructed state", () => {
    const result = decodeSessionSave(pkg, encoded(play(pkg, SOLVED_LOG)));
    expect(result).toEqual(replaySession(pkg, SOLVED_LOG));
  });
});
