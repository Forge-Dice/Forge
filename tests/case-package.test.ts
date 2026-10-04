import { describe, expect, it } from "vitest";
import { resolveCasePackage, type PackageFinding, type PackageRefSource } from "../src/domain/case-package.ts";
import {
  OTHER_SALT,
  SALT,
  packageInput,
  proofPackageInput,
  refSource,
  resolved,
  truthOf,
  withProofContent,
  type ProofEdit,
} from "./case-package.fixture.ts";
import { hashPackage, hashReleaseManifest } from "../src/domain/case-package.identity.ts";
import { buildPlayerRefIndex } from "../src/domain/player-ref.ts";

// Contract MYST-SESSION-0001A acceptance matrix A01..A43 (package side). Proof cases that need
// the MYST-SOLVABILITY-0001 parser live in the proof describe block.

function findings(edit: (p: any) => void, source?: (input: any) => PackageRefSource): PackageFinding[] {
  const input = packageInput(edit);
  const result = resolveCasePackage(input, source ? source(input) : defaultSource(input));
  expect(result.ok).toBe(false);
  if (result.ok) return [];
  expect(Object.keys(result)).toEqual(["ok", "findings"]);
  return [...result.findings];
}
/** The correct source for the edited truth, or for the fixture truth when the edit breaks parsing. */
function defaultSource(input: any): PackageRefSource {
  try {
    return refSource(truthOf(input));
  } catch {
    return refSource(truthOf(packageInput()));
  }
}
const codes = (fs: PackageFinding[]) => [...new Set(fs.map((f) => f.code))];
const base = resolved();

describe("component parsing and binding", () => {
  it("resolves the fixture", () => {
    expect(base.identity.schemaVersion).toBe(1);
    expect(base.identity.rulesetVersion).toBe("mystery-session-v1");
    expect(base.identity.packageHash).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(base.identity)).toEqual(["schemaVersion", "packageHash", "rulesetVersion"]);
    expect(base.npcs).toHaveLength(2);
  });

  it("A01 unknown truth root field", () => {
    expect(codes(findings((p) => (p.truth.extra = 1)))).toEqual(["SHAPE"]);
  });

  it("A02 solution with a wrong truthHash: BINDING before anything else", () => {
    const fs = findings((p) => {
      p.solution.truthHash = "0".repeat(64);
      p.access.truthHash = "0".repeat(64);
    });
    expect(fs).toEqual([{ code: "BINDING", path: ["solution", "truthHash"] }]);
  });

  it("A03 access of a foreign case", () => {
    expect(codes(findings((p) => (p.access.caseId = "case:other")))).toEqual(["BINDING"]);
  });

  it("A04 presentation with a stale truthHash", () => {
    expect(codes(findings((p) => (p.presentation.truthHash = "1".repeat(64))))).toEqual(["BINDING"]);
  });

  it("A05 catalogue of another truth state", () => {
    expect(codes(findings((p) => (p.catalogue.truthHash = "2".repeat(64))))).toEqual(["BINDING"]);
  });

  it("A06 NPC profile with a wrong catalogueHash", () => {
    expect(findings((p) => (p.npcs[0].profile.catalogueHash = "3".repeat(64)))).toEqual([
      { code: "BINDING", path: ["npcs", 0, "profile", "catalogueHash"] },
    ]);
  });

  it("A07 snapshot bound to another solution", () => {
    expect(codes(findings((p) => (p.npcs[1].snapshot.solutionHash = "4".repeat(64))))).toEqual(["BINDING"]);
  });

  it("A08 snapshot and profile of different NPCs", () => {
    expect(findings((p) => ([p.npcs[0].snapshot, p.npcs[1].snapshot] = [p.npcs[1].snapshot, p.npcs[0].snapshot]))).toEqual([
      { code: "BINDING", path: ["npcs", 0, "profile", "npcId"] },
    ]);
  });

  it("A09 duplicate NPC pair", () => {
    expect(findings((p) => p.npcs.push(structuredClone(p.npcs[0])))).toEqual([{ code: "REFERENCE", path: ["npcs", 2] }]);
  });

  it("A10 NPC that is not a person of the truth", () => {
    expect(codes(findings((p) => (p.npcs[1].snapshot.npcId = "person:zoe")))).toContain("REFERENCE");
  });

  it("empty NPC set is valid for technical cases (questionTexts then empty)", () => {
    expect(() =>
      resolved((p) => {
        p.npcs = [];
        p.publicContent.questionTexts = [];
      }),
    ).not.toThrow();
  });

  it("other components keep their own parser errors as SHAPE", () => {
    expect(codes(findings((p) => (p.presentation.entries[0].text = "person:ben war hier"))) ).toEqual(["SHAPE"]);
    expect(codes(findings((p) => p.challenge.allowedClaims.splice(0, 1)))).toEqual(["SHAPE"]);
  });

  it("semantically invalid truth is refused", () => {
    const fs = findings((p) => (p.truth.events[1].time = { kind: "instant", at: 50 }));
    expect(fs.length).toBeGreaterThan(0);
  });
});

describe("initial setup", () => {
  it("A11 unknown initial entity", () => {
    expect(findings((p) => p.initial.known.push({ kind: "person", id: "person:zoe" }))).toEqual([
      { code: "REFERENCE", path: ["initial", "known", 3] },
    ]);
  });

  it("A12 initial entity with the wrong kind", () => {
    expect(findings((p) => p.initial.known.push({ kind: "location", id: "person:ben" }))).toEqual([
      { code: "REFERENCE", path: ["initial", "known", 3] },
    ]);
  });

  it("A13 duplicate initial entity", () => {
    expect(findings((p) => p.initial.known.push({ kind: "person", id: "person:dora" }))).toEqual([
      { code: "REFERENCE", path: ["initial", "known", 3] },
    ]);
  });

  it("A15 empty initial known is valid", () => {
    expect(resolved((p) => (p.initial.known = [])).initial.known).toEqual([]);
  });

  it("unknown initial kind is SHAPE", () => {
    expect(codes(findings((p) => p.initial.known.push({ kind: "proposition", id: "proposition:x" })))).toEqual(["SHAPE"]);
  });
});

describe("PublicContent", () => {
  it("labels must name existing, distinct entities", () => {
    expect(findings((p) => (p.publicContent.labels[0].entity = { kind: "person", id: "person:zoe" }))).toEqual([
      { code: "REFERENCE", path: ["publicContent", "labels", 0] },
    ]);
    expect(findings((p) => p.publicContent.labels.push(structuredClone(p.publicContent.labels[0])))).toEqual([
      { code: "REFERENCE", path: ["publicContent", "labels", 3] },
    ]);
  });

  it("question texts are exactly the authored NPC rule pairs", () => {
    expect(findings((p) => p.publicContent.questionTexts.pop())).toEqual([{ code: "REFERENCE", path: ["publicContent", "questionTexts"] }]);
    expect(findings((p) => (p.publicContent.questionTexts[11].npc = "person:ben"))[0]!.code).toBe("REFERENCE");
    expect(findings((p) => p.publicContent.questionTexts.push(structuredClone(p.publicContent.questionTexts[0])))[0]).toEqual({
      code: "REFERENCE",
      path: ["publicContent", "questionTexts", 12],
    });
  });

  it("public rules: unique neutral IDs", () => {
    expect(findings((p) => p.publicContent.publicRules.push(structuredClone(p.publicContent.publicRules[0])))).toEqual([
      { code: "REFERENCE", path: ["publicContent", "publicRules", 1] },
    ]);
    expect(codes(findings((p) => (p.publicContent.publicRules[0].id = "Rule:X")))).toEqual(["SHAPE"]);
  });

  it("texts follow PlayerText rules; brief allows 4000 units, others 1000", () => {
    expect(() => resolved((p) => (p.publicContent.brief = "a".repeat(4000)))).not.toThrow();
    expect(codes(findings((p) => (p.publicContent.brief = "a".repeat(4001))))).toEqual(["SHAPE"]);
    expect(codes(findings((p) => (p.publicContent.title = "a".repeat(1001))))).toEqual(["SHAPE"]);
    expect(codes(findings((p) => (p.publicContent.brief = "Siehe person:ben")))).toEqual(["SHAPE"]);
    expect(codes(findings((p) => (p.publicContent.extra = 1)))).toEqual(["SHAPE"]);
  });
});

describe("PlayerRef source", () => {
  const withSource = (change: (s: any, input: any) => void) => (input: any) => {
    const source: any = { ...refSource(truthOf(input)) };
    change(source, input);
    return source;
  };

  it("A16/A17 source bound to another case or truth", () => {
    expect(findings(() => {}, withSource((s) => (s.caseId = "case:other")))).toEqual([{ code: "REF_MAPPING", path: ["refs"] }]);
    expect(findings(() => {}, withSource((s) => (s.truthHash = "5".repeat(64))))).toEqual([{ code: "REF_MAPPING", path: ["refs"] }]);
  });

  it.each([31, 33])("A18 salt with %i hex digits", (n) => {
    expect(findings(() => {}, withSource((s) => (s.config = { ...s.config, saltHex: "a".repeat(n) })))).toEqual([
      { code: "SHAPE", path: ["refs", "config"] },
    ]);
  });

  it("A19 a hidden entity has no ref", () => {
    const fs = findings(() => {}, withSource((s) => {
      const inner = s.refFor;
      s.refFor = (k: any, id: string) => (id === "event:ben-kills-clara" ? null : inner(k, id));
    }));
    expect(fs).toEqual([{ code: "REF_MAPPING", path: ["refs", "event", "event:ben-kills-clara"] }]);
  });

  it("A20 two entities share a token", () => {
    const fs = findings(() => {}, withSource((s) => {
      const inner = s.refFor;
      s.refFor = (k: any, id: string) => (id === "person:ben" ? inner("person", "person:anna") : inner(k, id));
    }));
    expect(codes(fs)).toEqual(["REF_MAPPING"]);
  });

  it("A21 inverse resolves to another kind or id", () => {
    const fs = findings(() => {}, withSource((s) => {
      const inner = s.resolve;
      s.resolve = (r: string) => {
        const e = inner(r);
        return e?.id === "location:garden" ? { kind: "location", id: "location:library" } : e;
      };
    }));
    expect(fs).toEqual([{ code: "REF_MAPPING", path: ["refs", "location", "location:garden"] }]);
  });

  it("A22 syntactically invalid ref", () => {
    const fs = findings(() => {}, withSource((s) => {
      const inner = s.refFor;
      s.refFor = (k: any, id: string) => (id === "item:knife" ? "pr1_UPPERCASE00000" : inner(k, id));
    }));
    expect(fs).toEqual([{ code: "REF_MAPPING", path: ["refs", "item", "item:knife"] }]);
  });

  it("A42 claimed salt with the mapping of another salt", () => {
    const fs = findings(() => {}, withSource((s, input) => {
      s.refFor = refSource(truthOf(input), OTHER_SALT).refFor;
      s.resolve = refSource(truthOf(input), OTHER_SALT).resolve;
    }));
    expect(codes(fs)).toEqual(["REF_MAPPING"]);
  });

  it("A23 changing the source after resolve does not affect the package", () => {
    const input = packageInput();
    const source: any = { ...refSource(truthOf(input)) };
    const result = resolveCasePackage(input, source);
    if (!result.ok) throw new Error("resolve failed");
    const before = result.package.refs.refFor("person", "person:ben");
    source.refFor = () => "pr1_0000000000000000";
    source.resolve = () => null;
    expect(result.package.refs.refFor("person", "person:ben")).toBe(before);
    expect(result.package.refs.resolve(before!)).toEqual({ kind: "person", id: "person:ben" });
    // The input objects are not shared either.
    input.publicContent.title = "Geändert";
    expect(result.package.publicContent.title).toBe("Der Bibliotheksfall");
  });

  it("refs match the real MYST-0001 index; unknown tokens resolve to null", () => {
    const built = buildPlayerRefIndex(base.truth, SALT);
    if (!built.success) throw new Error("index");
    for (const entry of built.index.entries) {
      expect(base.refs.refFor(entry.kind, entry.id)).toBe(entry.ref);
      expect(base.refs.resolve(entry.ref)).toEqual({ kind: entry.kind, id: entry.id });
    }
    expect(base.refs.resolve("pr1_0000000000000000")).toBeNull();
    expect(base.refs.refFor("person", "person:zoe")).toBeNull();
  });
});

describe("package identity", () => {
  const hash = (edit: (p: any) => void, salt = SALT) => resolved(edit, refSource(truthOf(packageInput(edit)), salt)).identity.packageHash;
  const h0 = base.identity.packageHash;

  it("is deterministic", () => {
    expect(hash(() => {})).toBe(h0);
  });

  it("A24 private snapshot provenance changes the hash", () => {
    expect(hash((p) => (p.npcs[0].snapshot.attitudes[0].provenance = { kind: "author_modeled_inference" }))).not.toBe(h0);
  });

  it("A25 snapshot asOf or revision changes the hash", () => {
    expect(hash((p) => (p.npcs[0].snapshot.asOf = 501))).not.toBe(h0);
    expect(hash((p) => (p.npcs[0].snapshot.revision = 2))).not.toBe(h0);
  });

  it("A26 a scope claim added changes the hash; A27 scope order does not", () => {
    expect(hash((p) => p.challenge.allowedClaims.push({ kind: "personResponsibleForEvent", personId: "person:dora", eventId: "event:ben-kills-clara" }))).not.toBe(h0);
    expect(hash((p) => p.challenge.allowedClaims.reverse())).toBe(h0);
  });

  it("A28 known order does not change the hash", () => {
    expect(hash((p) => p.initial.known.reverse())).toBe(h0);
  });

  it("set-like orders inside components and of NPC pairs do not change the hash", () => {
    expect(hash((p) => p.npcs.reverse())).toBe(h0);
    expect(hash((p) => p.npcs[0].snapshot.awareness.reverse())).toBe(h0);
    expect(hash((p) => p.npcs[0].snapshot.attitudes.reverse())).toBe(h0);
    expect(hash((p) => p.publicContent.labels.reverse())).toBe(h0);
    expect(hash((p) => p.publicContent.questionTexts.reverse())).toBe(h0);
    expect(hash((p) => p.presentation.entries.reverse())).toBe(h0);
  });

  it("A35 one space in a presentation text changes the hash", () => {
    expect(hash((p) => (p.presentation.entries[0].text += " "))).not.toBe(h0);
  });

  it("A36 another salt changes the hash", () => {
    expect(hash(() => {}, OTHER_SALT)).not.toBe(h0);
  });

  it("A41 one character of a question text changes the hash", () => {
    expect(hash((p) => (p.publicContent.questionTexts[0].text = p.publicContent.questionTexts[0].text.replace("?", "!")))).not.toBe(h0);
  });

  it("A14 initially known evidence is in the package; release is a matter of the reducer", () => {
    const pkg = resolved((p) => p.initial.known.push({ kind: "evidence", id: "evidence:bloody-knife" }));
    expect(pkg.initial.known).toContainEqual({ kind: "evidence", id: "evidence:bloody-knife" });
    expect(pkg.identity.packageHash).not.toBe(h0);
  });
});

describe("limits before any parse", () => {
  it("A38 257 entities or 65 evidence", () => {
    expect(findings((p) => {
      for (let i = 0; i < 250; i++) p.truth.items.push({ id: `item:x${i}`, name: "x" });
    })).toEqual([{ code: "LIMIT", path: ["truth"] }]);
    expect(findings((p) => {
      for (let i = 0; i < 63; i++) p.truth.evidence.push({ id: `evidence:x${i}`, description: "x", source: { kind: "item", id: "item:knife" }, links: [] });
    })).toEqual([{ code: "LIMIT", path: ["truth", "evidence"] }]);
  });

  it("A38 NPCs and questions above their budgets", () => {
    expect(findings((p) => {
      while (p.npcs.length < 17) p.npcs.push(p.npcs[0]);
    })).toEqual([{ code: "LIMIT", path: ["npcs"] }]);
    expect(findings((p) => {
      for (let i = 0; i < 118; i++) p.catalogue.questions.push({ id: `question:x${i}`, mentions: [{ kind: "person", id: "person:ben" }] });
    })).toEqual([{ code: "LIMIT", path: ["catalogue", "questions"] }]);
  });

  it("A39 raw bytes, depth and nodes", () => {
    expect(findings((p) => (p.publicContent.brief = "a".repeat(2 * 1024 * 1024)))).toEqual([{ code: "LIMIT", path: [] }]);
    expect(findings((p) => {
      let deep: any = {};
      p.publicContent.deep = deep;
      for (let i = 0; i < 40; i++) deep = deep.next = {};
    })[0]!.code).toBe("LIMIT");
    expect(findings((p) => (p.publicContent.many = Array.from({ length: 100_001 }, () => 0)))[0]!.code).toBe("LIMIT");
  });

  it("non-JSON values are SHAPE before any parse", () => {
    expect(findings((p) => (p.truth.title = () => 1))[0]!.code).toBe("SHAPE");
    expect(findings((p) => (p.truth.revision = Number.NaN))[0]!.code).toBe("SHAPE");
    expect(findings((p) => (p.truth.title = "\ud800"))[0]!.code).toBe("SHAPE");
  });
});

describe("trusted-only package", () => {
  it("A40 the resolved package refuses JSON; its parts stay frozen", () => {
    expect(() => JSON.stringify(base)).toThrow(TypeError);
    expect(() => structuredClone(base)).toThrow();
    expect(Object.isFrozen(base)).toBe(true);
    expect(Object.isFrozen(base.refs)).toBe(true);
    expect(Object.isFrozen(base.publicContent.labels[0])).toBe(true);
    expect(JSON.stringify(base.identity)).toContain(base.identity.packageHash);
  });

  it("findings are frozen and carry only code and path", () => {
    const result = resolveCasePackage(packageInput((p) => (p.truth.extra = 1)), refSource(truthOf(packageInput())));
    if (result.ok) throw new Error("expected findings");
    expect(Object.isFrozen(result.findings)).toBe(true);
    for (const f of result.findings) expect(Object.keys(f)).toEqual(["code", "path"]);
  });

  it("the input is not mutated or frozen", () => {
    const input = packageInput();
    const before = structuredClone(input);
    resolveCasePackage(input, refSource(truthOf(input)));
    expect(input).toEqual(before);
    expect(Object.isFrozen(input.truth)).toBe(false);
  });
});

// ---------- Proof binding (A29-A34, A43; annex forge-release-proof-v1) ----------

function bindWith(edit: ProofEdit = {}, after: (p: any) => void = () => {}) {
  const input = proofPackageInput(edit);
  after(input);
  return resolveCasePackage(input, refSource(truthOf(input)));
}
function proofFindings(edit: ProofEdit, after?: (p: any) => void): PackageFinding[] {
  const result = bindWith(edit, after);
  expect(result.ok).toBe(false);
  return result.ok ? [] : [...result.findings];
}
const CERT = ["proof", "releaseManifest", "certificateData"];
const OBS = (i: number, ...rest: (string | number)[]) => [...CERT, "observations", i, ...rest];
const one = (fs: PackageFinding[]) => {
  expect(fs).toHaveLength(1);
  return fs[0]!;
};
const FAKE_REF = "pr1_0000000000000000";

describe("proof binding", () => {
  const bound = bindWith();
  if (!bound.ok) throw new Error(JSON.stringify(bound.findings));
  const pkg = bound.package;

  it("binds a complete profile and manifest, without any solvability claim", () => {
    expect(pkg.proof!.releaseHash).toBe(hashReleaseManifest(pkg.proof!.releaseManifest));
    expect(pkg.proof!.profile.bindings.releaseHash).toBe(pkg.proof!.releaseHash);
    expect(Object.keys(pkg.proof!).sort()).toEqual(["profile", "releaseHash", "releaseManifest", "routes"]);
    expect(pkg.proof!.routes).toEqual([{ routeId: "witness", stepIds: pkg.proof!.profile.witnessStepIds }]);
    expect(Object.isFrozen(pkg.proof!.profile)).toBe(true);
    expect(JSON.stringify(Object.keys(pkg))).not.toMatch(/solvable|pass|verdict/i);
  });

  it("A33 proof null is a technical package with both proof hashes null", () => {
    const plain = resolved((p) => withProofContent(p));
    expect(plain.proof).toBeNull();
    expect(plain.identity.packageHash).not.toBe(pkg.identity.packageHash);
    const other = resolved();
    expect(other.identity.packageHash).not.toBe(plain.identity.packageHash);
    expect(hashPackage({ rulesetVersion: "mystery-session-v1", releaseContextHash: "a".repeat(64), releaseHash: null, proofHash: null })).not.toBe(
      hashPackage({ rulesetVersion: "mystery-session-v1", releaseContextHash: "a".repeat(64), releaseHash: "", proofHash: "" }),
    );
  });

  it("A29 swapped witness steps change the package; SET permutations do not", () => {
    const swapped = bindWith({ cert: (c) => c.steps.reverse() });
    expect(swapped.ok && swapped.package.identity.packageHash).not.toBe(pkg.identity.packageHash);
    const permuted = bindWith({ profile: (p) => (p.nodes.reverse(), p.answerScope.reverse(), p.edges[0].allOf.reverse()) });
    expect(permuted.ok && permuted.package.identity.packageHash).toBe(pkg.identity.packageHash);
    const witnessOnly = proofFindings({ profile: (p) => p.witnessStepIds.reverse() });
    expect(one(witnessOnly)).toEqual({ code: "PROOF_BINDING", path: [...CERT, "steps"] });
  });

  it("further routes walk the certified steps; each is bound into the release hash", () => {
    const witness = [...pkg.proof!.profile.witnessStepIds];
    expect(witness.length).toBeGreaterThan(1);
    const routed = bindWith({ cert: (c) => (c.routes = [{ routeId: "umweg", stepIds: [...witness].reverse() }]) });
    if (!routed.ok) throw new Error(JSON.stringify(routed.findings));
    expect(routed.package.proof!.routes).toEqual([
      { routeId: "witness", stepIds: witness },
      { routeId: "umweg", stepIds: [...witness].reverse() },
    ]);
    expect(routed.package.proof!.releaseHash).not.toBe(pkg.proof!.releaseHash);
    const shorter = bindWith({ cert: (c) => (c.routes = [{ routeId: "kurz", stepIds: witness.slice(1) }]) });
    expect(shorter.ok).toBe(true);
  });

  it("a route step that is not certified, or a certified step no route uses, is a binding error", () => {
    const steps = [...CERT, "steps"];
    expect(one(proofFindings({ cert: (c) => (c.routes = [{ routeId: "fremd", stepIds: ["nicht-zertifiziert"] }]) }))).toEqual({ code: "PROOF_BINDING", path: steps });
    expect(one(proofFindings({ profile: (p) => p.witnessStepIds.pop() }))).toEqual({ code: "PROOF_BINDING", path: steps });
    // The same step used only by a further route is certified again.
    const last = pkg.proof!.profile.witnessStepIds.at(-1)!;
    expect(bindWith({ profile: (p) => p.witnessStepIds.pop(), cert: (c) => (c.routes = [{ routeId: "mit-ende", stepIds: [last] }]) }).ok).toBe(true);
  });

  it("route IDs are unique and not \"witness\"; a route repeats no step and is not empty", () => {
    const w = pkg.proof!.profile.witnessStepIds;
    expect(one(proofFindings({ cert: (c) => (c.routes = [{ routeId: "witness", stepIds: [w[0]] }]) }))).toEqual({ code: "PROOF_BINDING", path: [...CERT, "routes", 1] });
    expect(one(proofFindings({ cert: (c) => (c.routes = [{ routeId: "a", stepIds: [w[0]] }, { routeId: "a", stepIds: [w[1]] }]) }))).toEqual({
      code: "PROOF_BINDING",
      path: [...CERT, "routes", 2],
    });
    expect(one(proofFindings({ cert: (c) => (c.routes = [{ routeId: "a", stepIds: [w[0], w[0]] }]) }))).toEqual({
      code: "PROOF_BINDING",
      path: [...CERT, "routes", 0, "stepIds", 1],
    });
    expect(codes(proofFindings({ cert: (c) => (c.routes = [{ routeId: "a", stepIds: [] }]) }))).toEqual(["SHAPE"]);
  });

  it("certificate arrays stay ORDERED: permuting alternatives changes releaseHash", () => {
    const permuted = bindWith({ cert: (c) => c.observations[1].alternatives.reverse() });
    expect(permuted.ok && permuted.package.proof!.releaseHash).not.toBe(pkg.proof!.releaseHash);
  });

  it("A30 wrong profile releaseHash and T/S bindings", () => {
    expect(one(proofFindings({ profile: (p) => (p.bindings.releaseHash = "0".repeat(64)) }))).toEqual({
      code: "PROOF_BINDING",
      path: ["proof", "profile", "bindings", "releaseHash"],
    });
    expect(codes(proofFindings({ profile: (p) => (p.bindings.truthHash = "0".repeat(64)) }))).toEqual(["PROOF_BINDING"]);
    expect(codes(proofFindings({ profile: (p) => (p.bindings.solutionHash = "0".repeat(64)) }))).toEqual(["PROOF_BINDING"]);
  });

  it("A31 wrong manifest releaseContextHash", () => {
    expect(one(proofFindings({ envelope: (e) => (e.releaseContextHash = "0".repeat(64)) }))).toEqual({
      code: "PROOF_BINDING",
      path: ["proof", "releaseManifest", "releaseContextHash"],
    });
  });

  it("A32 executable JS in the manifest is never run, only rejected as data", () => {
    const g = globalThis as { __forgePwned?: boolean };
    const js = "(() => { globalThis.__forgePwned = true; return 1 })()";
    expect(codes(proofFindings({ manifest: () => js }))).toEqual(["SHAPE"]);
    expect(codes(proofFindings({ envelope: (e) => (e.certificateData = js) }))).toEqual(["SHAPE"]);
    expect(codes(proofFindings({ cert: (c) => (c.observations[0].alternatives[0].licenseRuleId = js) }))).toEqual(["REFERENCE"]);
    expect(g.__forgePwned).toBeUndefined();
  });

  it("A34 pass-like extra flags are schema errors", () => {
    expect(codes(proofFindings({}, (p) => (p.proof.passed = true)))).toEqual(["SHAPE"]);
    expect(codes(proofFindings({ profile: (p) => (p.solvable = true) }))).toEqual(["SHAPE"]);
    expect(codes(proofFindings({ envelope: (e) => (e.certified = true) }))).toEqual(["SHAPE"]);
    expect(codes(proofFindings({ cert: (c) => (c.verdict = "PASS") }))).toEqual(["SHAPE"]);
    expect(codes(proofFindings({ cert: (c) => (c.observations[2].approved = true) }))).toEqual(["SHAPE"]);
  });

  it("manifest must be canonical C with the exact adapter version", () => {
    expect(one(proofFindings({ manifest: (t) => JSON.stringify(JSON.parse(t), null, 1) }))).toEqual({ code: "SHAPE", path: ["proof", "releaseManifest"] });
    expect(codes(proofFindings({ envelope: (e) => (e.adapterVersion = "forge-release-proof-v2") }))).toEqual(["SHAPE"]);
    expect(codes(proofFindings({ envelope: (e) => (e.schemaVersion = 2) }))).toEqual(["SHAPE"]);
    expect(codes(proofFindings({ manifest: () => "{\"a\":1e999}" }))).toEqual(["SHAPE"]);
  });
});

describe("A43 certificateData selectors", () => {
  const observedReport = (c: any) => c.observations[0].alternatives[0].report;
  const npcSelector = (c: any) => c.observations[1].alternatives[0];
  const testimony = (c: any) => c.observations[1].alternatives[1];
  const at = (fs: PackageFinding[]) => one(fs);

  it("OBSERVED: source, stance, evidence and license attacks", () => {
    expect(at(proofFindings({ cert: (c, r) => (observedReport(c).source = { kind: "testimony", person: r("person", "person:dora") }) }))).toEqual({
      code: "PROOF_BINDING",
      path: OBS(0, "alternatives", 0, "report", "source"),
    });
    expect(at(proofFindings({ cert: (c) => (observedReport(c).stance = "denies") }))).toEqual({
      code: "PROOF_BINDING",
      path: OBS(0, "alternatives", 0, "report", "stance"),
    });
    expect(at(proofFindings({ cert: (c) => (c.observations[0].source.evidenceId = "evidence:muddy-boots") }))).toEqual({
      code: "PROOF_BINDING",
      path: OBS(0, "alternatives", 0, "report"),
    });
    expect(at(proofFindings({ cert: (c) => (c.observations[0].alternatives[0].licenseRuleId = "rule:unknown") })).code).toBe("REFERENCE");
    expect(codes(proofFindings({ cert: (c) => (c.observations[0].source = { kind: "initial" }) }))).toEqual(["SHAPE"]);
    expect(at(proofFindings({ cert: (c) => c.observations[0].alternatives.push(structuredClone(c.observations[0].alternatives[0])) }))).toEqual({
      code: "PROOF_BINDING",
      path: OBS(0, "alternatives", 1),
    });
  });

  it("OBSERVED: literal binding, ambiguous alias and ref attacks", () => {
    expect(at(proofFindings({ cert: (c) => (c.observations[0].literal.propositionId = "proposition:ben-in-killing") }))).toEqual({
      code: "PROOF_BINDING",
      path: OBS(0, "alternatives", 0),
    });
    const aliasCase: ProofEdit = {
      pkg: (p) => {
        const knife = p.presentation.entries[0];
        knife.mentions.push({ kind: "location", id: "location:library" });
        knife.reports.push({ claim: { kind: "personAt", personId: "person:ben", locationId: "location:library", at: 300 }, stance: "affirms", source: { kind: "observation" } });
      },
      cert: (c, r) => {
        c.observations[0].literal.propositionId = "proposition:ben-at-library";
        observedReport(c).claim = { kind: "personAt", person: r("person", "person:ben"), location: r("location", "location:library"), at: 300 };
      },
    };
    expect(at(proofFindings(aliasCase))).toEqual({ code: "PROOF_BINDING", path: OBS(0, "alternatives", 0) });
    expect(at(proofFindings({ cert: (c) => (observedReport(c).claim.itemId = "item:knife", delete observedReport(c).claim.item) }))).toEqual({
      code: "SHAPE",
      path: OBS(0, "alternatives", 0, "report", "claim", "itemId"),
    });
    expect(at(proofFindings({ cert: (c, r) => (observedReport(c).claim.item = r("person", "person:ben")) }))).toEqual({
      code: "REFERENCE",
      path: OBS(0, "alternatives", 0, "report", "claim", "item"),
    });
    expect(at(proofFindings({ cert: (c) => (observedReport(c).claim.item = FAKE_REF) })).code).toBe("REFERENCE");
  });

  it("REPORTED_BY_NPC npc selector: question, stance and claim attacks", () => {
    expect(at(proofFindings({ cert: (c) => (npcSelector(c).questionId = "question:bloody-knife") }))).toEqual({
      code: "REFERENCE",
      path: OBS(1, "alternatives", 0, "questionId"),
    });
    expect(at(proofFindings({ cert: (c) => (c.observations[1].npcId = "person:anna") }))).toEqual({
      code: "REFERENCE",
      path: OBS(1, "alternatives", 0, "questionId"),
    });
    expect(codes(proofFindings({ cert: (c) => (npcSelector(c).stance = "leans_affirms") }))).toEqual(["SHAPE"]);
    expect(codes(proofFindings({ cert: (c) => (npcSelector(c).stance = "uncertain") }))).toEqual(["SHAPE"]);
    expect(at(proofFindings({ cert: (c) => (npcSelector(c).stance = "denies") }))).toEqual({ code: "PROOF_BINDING", path: OBS(1, "alternatives", 0, "stance") });
    expect(at(proofFindings({ cert: (c, r) => (npcSelector(c).claim.person = r("person", "person:anna")) }))).toEqual({
      code: "PROOF_BINDING",
      path: OBS(1, "alternatives", 0, "claim"),
    });
  });

  it("REPORTED_BY_NPC testimony selector: person, source and evidence attacks", () => {
    expect(at(proofFindings({ cert: (c, r) => (testimony(c).report.source.person = r("person", "person:anna")) }))).toEqual({
      code: "PROOF_BINDING",
      path: OBS(1, "alternatives", 1, "report", "source"),
    });
    expect(at(proofFindings({ cert: (c) => (testimony(c).report.source = { kind: "observation" }) }))).toEqual({
      code: "PROOF_BINDING",
      path: OBS(1, "alternatives", 1, "report", "source"),
    });
    expect(at(proofFindings({ cert: (c) => (testimony(c).evidenceId = "evidence:muddy-boots") }))).toEqual({
      code: "PROOF_BINDING",
      path: OBS(1, "alternatives", 1, "report"),
    });
    expect(at(proofFindings({ cert: (c) => (testimony(c).evidenceId = "evidence:nothing") })).code).toBe("REFERENCE");
    expect(at(proofFindings({ cert: (c) => (testimony(c).report.stance = "denies") }))).toEqual({
      code: "PROOF_BINDING",
      path: OBS(1, "alternatives", 1, "report", "stance"),
    });
  });

  it("ENTITY_AWARENESS: existing and reachable entity only", () => {
    expect(at(proofFindings({ cert: (c) => (c.observations[2].entity = { kind: "person", id: "person:clara" }) }))).toEqual({
      code: "PROOF_BINDING",
      path: OBS(2, "entity"),
    });
    // An unknown entity is already refused by the real SOL parser of the mirrored profile.
    const unknown = at(proofFindings({ cert: (c) => (c.observations[2].entity = { kind: "person", id: "person:nobody" }) }));
    expect(unknown.code).toBe("SHAPE");
    expect(unknown.path.slice(0, 4)).toEqual(["proof", "profile", "observations", 2]);
  });

  it("PUBLIC_RULE: self-license, duplicates and unknown laws", () => {
    expect(at(proofFindings({ cert: (c) => c.observations[3].afterObservations.push("obs:law") }))).toEqual({
      code: "PROOF_BINDING",
      path: OBS(3, "afterObservations", 2),
    });
    expect(at(proofFindings({ cert: (c) => c.observations[3].afterObservations.push("obs:knife") }))).toEqual({
      code: "PROOF_BINDING",
      path: OBS(3, "afterObservations", 2),
    });
    expect(at(proofFindings({ cert: (c) => c.observations[3].afterObservations.push("obs:ghost") })).code).toBe("PROOF_BINDING");
    expect(at(proofFindings({ cert: (c) => (c.observations[3].ruleId = "rule:secret") }))).toEqual({ code: "REFERENCE", path: OBS(3, "ruleId") });
    expect(bindWith({ cert: (c) => (c.observations[3].afterObservations = []) }).ok).toBe(true);
  });

  it("profile coverage and payload must match exactly", () => {
    expect(at(proofFindings({ profile: (p) => p.observations.push({ id: "obs:extra", kind: "ENTITY_AWARENESS", entity: { kind: "person", id: "person:anna" } }) }))).toEqual({
      code: "PROOF_BINDING",
      path: [...CERT, "observations"],
    });
    expect(at(proofFindings({ profile: (p) => (p.observations[2].entity = { kind: "person", id: "person:anna" }) }))).toEqual({
      code: "PROOF_BINDING",
      path: OBS(2),
    });
    expect(at(proofFindings({ cert: (c) => c.observations.push(structuredClone(c.observations[2])), profile: (p) => p.observations.pop() }))).toEqual({
      code: "PROOF_BINDING",
      path: OBS(4),
    });
  });

  it("steps: exact Session B events with real refs", () => {
    expect(at(proofFindings({ cert: (c) => c.steps.push(structuredClone(c.steps[0])) }, (p) => p.proof.profile.witnessStepIds.push("step:examine-knife")))).toEqual({
      code: "PROOF_BINDING",
      path: [...CERT, "steps", 2],
    });
    expect(codes(proofFindings({ cert: (c) => (c.steps[0].event.target = "item:knife") }))).toEqual(["SHAPE"]);
    expect(codes(proofFindings({ cert: (c) => (c.steps[0].event.seq = 1) }))).toEqual(["SHAPE"]);
    expect(codes(proofFindings({ cert: (c) => (c.steps[1].event.type = "ask") }))).toEqual(["SHAPE"]);
    expect(at(proofFindings({ cert: (c, r) => (c.steps[0].event.target = r("person", "person:ben")) }))).toEqual({
      code: "REFERENCE",
      path: [...CERT, "steps", 0, "event", "target"],
    });
    expect(at(proofFindings({ cert: (c, r) => (c.steps[1].event.npc = r("item", "item:knife")) })).code).toBe("REFERENCE");
    const accuse = (claim: object): ProofEdit => ({ cert: (c) => c.steps.push({ stepId: "step:accuse", event: { type: "accuse", literals: [{ claim, value: true }] } }) });
    const withAccuse = (claim: (r: any) => object) => ({ cert: (c: any, r: any) => accuse(claim(r)).cert!(c, r) });
    expect(bindWith(withAccuse((r) => ({ kind: "personResponsibleForEvent", person: r("person", "person:ben"), event: r("event", "event:ben-kills-clara") }))).ok).toBe(true);
    expect(codes(proofFindings(withAccuse((r) => ({ kind: "personAt", person: r("person", "person:ben"), location: r("location", "location:library"), at: 300 }))))).toEqual(["SHAPE"]);
  });

  it("every attack fails atomically without a package", () => {
    const result = bindWith({ cert: (c) => (npcSelector(c).stance = "denies") });
    expect(result).toEqual({ ok: false, findings: [{ code: "PROOF_BINDING", path: OBS(1, "alternatives", 0, "stance") }] });
    expect(Object.isFrozen(result)).toBe(true);
  });
});
