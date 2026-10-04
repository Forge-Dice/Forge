import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { NpcVisibleContext } from "../src/domain/npc-knowledge.projection.ts";
import * as dialogue from "../src/domain/npc-dialogue-policy.ts";
import { createDialoguePolicyEngine, type DialoguePolicyEngine, type PolicyResult } from "../src/domain/npc-dialogue-policy.ts";
import { MARKER } from "./npc-knowledge.fixture.ts";
import { belief, knowledge, projectContext, propositionAttitude, richContext, singleContext } from "./npc-dialogue-policy.fixture.ts";

type Path = (string | number)[];
type Attitude = NpcVisibleContext["attitudes"][number];

const MISMATCH = { success: false, code: "DIALOGUE_CONTEXT_MISMATCH" };

function attitude(context: NpcVisibleContext, kind: "proposition" | "conclusion", index: number): Attitude {
  return context.attitudes.find((a) => a.subject.kind === kind && a.subject.index === index)!;
}

function ask(engine: DialoguePolicyEngine, claim: unknown) {
  return engine.querySchema.parse({ kind: "ask_about_claim", claim } as never);
}

function answerPolicy(engine: DialoguePolicyEngine, rules: unknown[] = []) {
  return engine.policySchema.parse({ schemaVersion: 1, defaultAction: "answer", rules } as never);
}

function queryPaths(engine: DialoguePolicyEngine, input: unknown): Path[] {
  const parsed = engine.querySchema.safeParse(input as never);
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.path as Path);
}

function policyPaths(engine: DialoguePolicyEngine, input: unknown): Path[] {
  const parsed = engine.policySchema.safeParse(input as never);
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.path as Path);
}

function objectsOf(value: unknown, into = new Set<object>()): Set<object> {
  if (typeof value === "object" && value !== null && !into.has(value)) {
    into.add(value);
    for (const child of Object.values(value)) objectsOf(child, into);
  }
  return into;
}

function expectDeepFrozen(value: unknown): void {
  for (const object of objectsOf(value)) expect(Object.isFrozen(object)).toBe(true);
}

function expectDisjoint(a: unknown, b: unknown): void {
  const left = objectsOf(a);
  for (const object of objectsOf(b)) expect(left.has(object)).toBe(false);
}

function personAt(context: NpcVisibleContext) {
  const claim = attitude(context, "proposition", 3).claim;
  if (claim.kind !== "personAt") throw new Error("fixture");
  return claim;
}

describe("TASK-0005 reference provenance (group 8, AC-07, AC-08)", () => {
  const context = richContext();
  const engine = createDialoguePolicyEngine(context);
  const at = personAt(context);

  it("every original ref occurrence of the own context is accepted, even when !==", () => {
    // Ben (person 2) occurs in several claims as different objects; all are valid.
    const bens = context.attitudes.flatMap((a) => Object.values(a.claim).filter((v) => typeof v === "object" && v.kind === "person" && v.index === 2));
    expect(bens.length).toBeGreaterThan(2);
    expect(new Set(bens).size).toBe(bens.length);
    const results = bens.map((ben) => JSON.stringify(engine.evaluate(ask(engine, { ...at, person: ben }), answerPolicy(engine))));
    expect(new Set(results).size).toBe(1);
    expect(JSON.parse(results[0]!).decision.act.kind).toBe("assert");
    // self and awareness refs are entity refs too.
    ask(engine, { ...at, person: context.self });
    ask(engine, { ...at, location: context.awareness.find((r) => r.kind === "location") });
  });

  it("the same original event ref in causeEvent and event is allowed sharing, not a cycle", () => {
    const caused = attitude(context, "conclusion", 2).claim;
    if (caused.kind !== "eventCausedEvent") throw new Error("fixture");
    const query = ask(engine, { kind: "eventCausedEvent", causeEvent: caused.event, event: caused.event });
    expect(engine.evaluate(query, answerPolicy(engine))).toEqual({ success: true, decision: { intent: "sincere", act: { kind: "claim_ignorance" } } });
  });

  it("copied and JSON-cloned refs with equal values are rejected at the ref path", () => {
    for (const copy of [{ kind: "person", index: 2 }, { ...at.person }, JSON.parse(JSON.stringify(at.person)), structuredClone(at.person)]) {
      expect(queryPaths(engine, { kind: "ask_about_claim", claim: { ...at, person: copy } })).toEqual([["claim", "person"]]);
    }
    expect(queryPaths(engine, { kind: "ask_about_claim", claim: JSON.parse(JSON.stringify(at)) })).toEqual([
      ["claim", "person"],
      ["claim", "location"],
    ]);
  });

  it("copied policy subjects are rejected at rules,i,subject", () => {
    const subject = attitude(context, "proposition", 3).subject;
    for (const copy of [{ kind: "proposition", index: 3 }, { ...subject }, JSON.parse(JSON.stringify(subject))]) {
      expect(policyPaths(engine, { schemaVersion: 1, defaultAction: "answer", rules: [{ subject: copy, action: "refuse" }] })).toEqual([
        ["rules", 0, "subject"],
      ]);
    }
  });

  it("an original ref in the wrong category field authorizes nothing", () => {
    // Statement subjects are not entity refs and vice versa, even when the shape would pass.
    const subject = attitude(context, "proposition", 3).subject;
    expect(queryPaths(engine, { kind: "ask_about_claim", claim: { ...at, person: subject } })).toEqual([["claim", "person", "kind"]]);
    expect(policyPaths(engine, { schemaVersion: 1, defaultAction: "answer", rules: [{ subject: at.person, action: "refuse" }] })).toEqual([
      ["rules", 0, "subject", "kind"],
    ]);
  });
});

describe("TASK-0005 foreign projections and engines (groups 9, 10, AC-13)", () => {
  it("a new projection with identical visible data: foreign refs and parsed inputs are rejected", () => {
    const own = richContext();
    const foreign = richContext();
    expect(foreign).toEqual(own);
    const engine = createDialoguePolicyEngine(own);
    const foreignEngine = createDialoguePolicyEngine(foreign);
    const foreignAt = personAt(foreign);
    expect(queryPaths(engine, { kind: "ask_about_claim", claim: foreignAt })).toEqual([
      ["claim", "person"],
      ["claim", "location"],
    ]);
    const foreignSubject = attitude(foreign, "proposition", 3).subject;
    expect(policyPaths(engine, { schemaVersion: 1, defaultAction: "answer", rules: [{ subject: foreignSubject, action: "evade" }] })).toEqual([
      ["rules", 0, "subject"],
    ]);
    expect(engine.evaluate(ask(foreignEngine, foreignAt), answerPolicy(engine))).toStrictEqual(MISMATCH);
    expect(engine.evaluate(ask(engine, personAt(own)), answerPolicy(foreignEngine))).toStrictEqual(MISMATCH);
  });

  it("a new projection that reuses the same indices for other referents is rejected", () => {
    const own = singleContext(knowledge(true)); // person 1 = Anna (self), person 2 = Ben
    const other = projectContext([propositionAttitude("anna-at-library", knowledge(false))]); // person 1 = Anna only
    const engine = createDialoguePolicyEngine(own);
    const otherClaim = other.attitudes[0]!.claim;
    if (otherClaim.kind !== "personAt") throw new Error("fixture");
    expect(otherClaim.location).toEqual({ kind: "location", index: 1 });
    expect(queryPaths(engine, { kind: "ask_about_claim", claim: otherClaim })).toEqual([
      ["claim", "person"],
      ["claim", "location"],
    ]);
    expect(queryPaths(engine, { kind: "ask_about_claim", claim: { ...personAt0(own), person: other.self } })).toEqual([["claim", "person"]]);
  });

  it("query from A + policy from B, both foreign, and two engines over the same context", () => {
    const context = richContext();
    const a = createDialoguePolicyEngine(context);
    const b = createDialoguePolicyEngine(context);
    const claim = personAt(context);
    const queryA = ask(a, claim);
    const queryB = ask(b, claim);
    const policyA = answerPolicy(a);
    const policyB = answerPolicy(b);
    expect(a.evaluate(queryA, policyA).success).toBe(true);
    for (const result of [a.evaluate(queryA, policyB), a.evaluate(queryB, policyA), a.evaluate(queryB, policyB), b.evaluate(queryA, policyA)]) {
      expect(result).toStrictEqual(MISMATCH);
      expect(Object.isFrozen(result)).toBe(true);
    }
    expect(Object.is(a.evaluate(queryB, policyA), b.evaluate(queryA, policyB))).toBe(true);
  });

  it("re-parsing a serialized or cloned parsed input is no rebind", () => {
    const context = richContext();
    const engine = createDialoguePolicyEngine(context);
    const query = ask(engine, personAt(context));
    expect(queryPaths(engine, JSON.parse(JSON.stringify(query)))).toEqual([
      ["claim", "person"],
      ["claim", "location"],
    ]);
    expect(engine.evaluate(structuredClone(query) as typeof query, answerPolicy(engine))).toStrictEqual(MISMATCH);
    expect(engine.evaluate({ ...query } as typeof query, answerPolicy(engine))).toStrictEqual(MISMATCH);
  });

  it("parsed inputs carry no owner token, symbol or hidden field", () => {
    const context = richContext();
    const engine = createDialoguePolicyEngine(context);
    const query = ask(engine, personAt(context));
    const policy = answerPolicy(engine, [{ subject: attitude(context, "proposition", 3).subject, action: "invert" }]);
    for (const parsed of [query, policy]) {
      for (const object of objectsOf(parsed)) {
        expect(Object.getOwnPropertySymbols(object)).toEqual([]);
        expect(Reflect.ownKeys(object)).toEqual(Array.isArray(object) ? [...Object.keys(object), "length"] : Object.keys(object));
      }
    }
    expect(Object.keys(query)).toEqual(["kind", "claim"]);
    expect(Object.keys(policy)).toEqual(["schemaVersion", "defaultAction", "rules"]);
  });
});

function personAt0(context: NpcVisibleContext) {
  const claim = context.attitudes[0]!.claim;
  if (claim.kind !== "personAt") throw new Error("fixture");
  return claim;
}

describe("TASK-0005 data form (group 16, AC-06)", () => {
  const context = richContext();
  const engine = createDialoguePolicyEngine(context);
  const at = personAt(context);
  const subject = attitude(context, "proposition", 3).subject;

  it("getters are reported without being called", () => {
    let calls = 0;
    const claim = { ...at };
    Object.defineProperty(claim, "at", { enumerable: true, get: () => (calls++, 300) });
    expect(queryPaths(engine, { kind: "ask_about_claim", claim })).toEqual([["claim", "at"]]);
    const input = { kind: "ask_about_claim" };
    Object.defineProperty(input, "claim", { enumerable: true, get: () => (calls++, at) });
    expect(queryPaths(engine, input)).toEqual([["claim"]]);
    const policy = { schemaVersion: 1, rules: [] };
    Object.defineProperty(policy, "defaultAction", { enumerable: true, get: () => (calls++, "answer") });
    expect(policyPaths(engine, policy)).toEqual([["defaultAction"]]);
    expect(calls).toBe(0);
  });

  it("symbols, hidden fields, extra array fields, sparse arrays, custom prototypes and cycles", () => {
    const withSymbol = { kind: "ask_about_claim", claim: at, [Symbol("owner")]: 1 };
    expect(queryPaths(engine, withSymbol)).toEqual([[]]);
    const hidden = { kind: "ask_about_claim", claim: at };
    Object.defineProperty(hidden, "note", { enumerable: false, value: "x" });
    expect(queryPaths(engine, hidden)).toEqual([["note"]]);
    const rules: unknown[] = [{ subject, action: "refuse" }];
    (rules as unknown as Record<string, unknown>).extra = 1;
    expect(policyPaths(engine, { schemaVersion: 1, defaultAction: "answer", rules })).toEqual([["rules", "extra"]]);
    const sparse: unknown[] = [];
    sparse[1] = { subject, action: "refuse" };
    expect(policyPaths(engine, { schemaVersion: 1, defaultAction: "answer", rules: sparse })).toEqual([["rules", 0]]);
    class Query {
      kind = "ask_about_claim";
      claim = at;
    }
    expect(queryPaths(engine, new Query())).toEqual([[]]);
    expect(queryPaths(engine, { kind: "ask_about_claim", claim: Object.assign(Object.create({ inherited: true }), at) })).toEqual([["claim"]]);
    const cyclic: Record<string, unknown> = { schemaVersion: 1, defaultAction: "answer", rules: [] };
    (cyclic.rules as unknown[]).push({ subject, action: "refuse", self: cyclic });
    expect(policyPaths(engine, cyclic)).toEqual([["rules", 0, "self"]]);
    class FakeArray extends Array {}
    expect(policyPaths(engine, { schemaVersion: 1, defaultAction: "answer", rules: FakeArray.from([]) })).toEqual([["rules"]]);
  });

  it("null-prototype containers are plain data", () => {
    const input = Object.assign(Object.create(null), { kind: "ask_about_claim", claim: Object.assign(Object.create(null), at) });
    expect(engine.querySchema.safeParse(input).success).toBe(true);
  });
});

describe("TASK-0005 immutability and copies (groups 14, 15, AC-17, AC-18)", () => {
  it("the context stays identical, deep-equal and frozen; author containers stay mutable", () => {
    const context = richContext();
    const snapshot = structuredClone(context);
    const objects = [...objectsOf(context)];
    const engine = createDialoguePolicyEngine(context);
    const queryInput = { kind: "ask_about_claim" as const, claim: { ...personAt(context) } };
    const policyInput = { schemaVersion: 1 as const, defaultAction: "answer" as const, rules: [{ subject: attitude(context, "proposition", 3).subject, action: "invert" as const }] };
    const result = engine.evaluate(engine.querySchema.parse(queryInput), engine.policySchema.parse(policyInput));
    expect(result.success).toBe(true);
    expect(context).toEqual(snapshot);
    expect([...objectsOf(context)]).toEqual(objects);
    expectDeepFrozen(context);
    expect(Object.isFrozen(queryInput)).toBe(false);
    expect(Object.isFrozen(queryInput.claim)).toBe(false);
    expect(Object.isFrozen(policyInput.rules)).toBe(false);
    expect(Object.isFrozen(policyInput.rules[0])).toBe(false);
  });

  it("mutating author containers after parsing changes neither query nor policy", () => {
    const context = richContext();
    const engine = createDialoguePolicyEngine(context);
    const at = personAt(context);
    const queryInput = { kind: "ask_about_claim", claim: { ...at } };
    const policyInput = { schemaVersion: 1, defaultAction: "answer", rules: [{ subject: attitude(context, "proposition", 3).subject, action: "invert" }] };
    const query = engine.querySchema.parse(queryInput as never);
    const policy = engine.policySchema.parse(policyInput as never);
    const before = JSON.stringify(engine.evaluate(query, policy));
    queryInput.claim.at = 1;
    queryInput.claim.person = context.self as never;
    policyInput.defaultAction = "evade";
    policyInput.rules[0]!.action = "refuse";
    policyInput.rules.push({ subject: attitude(context, "proposition", 1).subject, action: "evade" });
    expect(JSON.stringify(engine.evaluate(query, policy))).toBe(before);
    expect(query.claim).toEqual(at);
    expect(policy.rules).toHaveLength(1);
  });

  it("parsed inputs and results are frozen and share no objects with context, inputs or each other", () => {
    const context = richContext();
    const engine = createDialoguePolicyEngine(context);
    for (const a of context.attitudes) {
      const queryInput = { kind: "ask_about_claim", claim: a.claim };
      const policyInput = { schemaVersion: 1, defaultAction: "answer", rules: [{ subject: a.subject, action: "answer" }] };
      const query = engine.querySchema.parse(queryInput as never);
      const policy = engine.policySchema.parse(policyInput as never);
      const result = engine.evaluate(query, policy);
      for (const value of [query, policy, result]) {
        expectDeepFrozen(value);
        expectDisjoint(value, context);
        expectDisjoint(value, queryInput);
        expectDisjoint(value, policyInput);
      }
      expectDisjoint(result, query);
      expectDisjoint(result, policy);
      expect(() => {
        (result as { success: boolean }).success = false;
      }).toThrow(TypeError);
      expect(() => {
        (query.claim as { kind: string }).kind = "x";
      }).toThrow(TypeError);
      expect(() => {
        (policy.rules as unknown[]).push({});
      }).toThrow(TypeError);
    }
    const repeated = engine.evaluate(ask(engine, personAt(context)), answerPolicy(engine));
    expect(repeated).not.toBe(engine.evaluate(ask(engine, personAt(context)), answerPolicy(engine)));
  });

  it("the engine object is frozen and has exactly three members", () => {
    const engine = createDialoguePolicyEngine(richContext());
    expect(Object.isFrozen(engine)).toBe(true);
    expect(Object.keys(engine).sort()).toEqual(["evaluate", "policySchema", "querySchema"]);
  });
});

describe("TASK-0005 act boundaries (AC-14, AC-15, AC-21)", () => {
  const context = richContext();
  const engine = createDialoguePolicyEngine(context);

  function allResults(): PolicyResult[] {
    const results: PolicyResult[] = [];
    for (const a of context.attitudes) {
      for (const action of ["answer", "refuse", "evade", "invert", "feign_ignorance"]) {
        if (action === "invert" && a.stance.kind === "uncertain") continue;
        const policy = answerPolicy(engine, [{ subject: a.subject, action }]);
        results.push(engine.evaluate(ask(engine, a.claim), policy));
      }
    }
    return results;
  }

  it("acts carry no intent, no stance and no back references, also after structuredClone", () => {
    for (const result of allResults()) {
      if (!result.success) throw new Error("unexpected failure");
      const { act } = result.decision;
      const keys = Object.keys(act);
      expect(keys).not.toContain("intent");
      expect(keys).not.toContain("stance");
      const clone = structuredClone(act);
      expect(JSON.stringify(clone)).not.toMatch(/intent|stance|sincere|deceptive|withholding|knowledge|unqualified.*belief/);
      expect(Object.keys(result)).toEqual(["success", "decision"]);
      expect(Object.keys(result.decision)).toEqual(["intent", "act"]);
      if (act.kind === "refuse" || act.kind === "evade" || act.kind === "claim_ignorance") expect(keys).toEqual(["kind"]);
      if (act.kind === "assert") expect(keys).toEqual(["kind", "subject", "claim", "value", "commitment"]);
      if (act.kind === "express_uncertainty") expect(keys).toEqual(["kind", "subject", "claim", "leaning"]);
    }
  });

  it("content acts take subject and claim from the matching attitude, never from the query object", () => {
    for (const a of context.attitudes) {
      const reordered = Object.fromEntries(Object.entries(a.claim).reverse());
      const result = engine.evaluate(ask(engine, reordered), answerPolicy(engine));
      if (!result.success || (result.decision.act.kind !== "assert" && result.decision.act.kind !== "express_uncertainty")) {
        throw new Error("expected a content act");
      }
      expect(JSON.stringify(result.decision.act.claim)).toBe(JSON.stringify(a.claim));
      expect(result.decision.act.subject).toEqual(a.subject);
    }
  });

  it("no names, raw IDs, markers or answer-key data leave the engine", () => {
    const json = JSON.stringify(allResults());
    for (const leak of [MARKER, "person:", "event:", "proposition:", "conclusion:", "evidence:", "case:", "truth", "provenance", "resolution", "required", "Hash"]) {
      expect(json).not.toContain(leak);
    }
    expect(json).not.toMatch(/[0-9a-f]{64}/);
  });

  it("uncertainty is never truthiness-converted", () => {
    const leanings = allResults().flatMap((r) => (r.success && r.decision.act.kind === "express_uncertainty" ? [r.decision.act.leaning] : []));
    expect(leanings).toContain(null);
    expect(leanings).toContain(true);
    expect(leanings).toContain(false);
  });

  it("a question never adds knowledge: asking first does not change later answers", () => {
    const fresh = createDialoguePolicyEngine(context);
    const at = personAt(context);
    const unknownQuery = ask(fresh, { ...at, at: 999 });
    fresh.evaluate(unknownQuery, answerPolicy(fresh));
    expect(fresh.evaluate(ask(fresh, { ...at, at: 999 }), answerPolicy(fresh))).toEqual({
      success: true,
      decision: { intent: "sincere", act: { kind: "claim_ignorance" } },
    });
    expect(context.attitudes).toHaveLength(12);
  });

  it("an objectively false belief keeps the NPC's polarity", () => {
    const local = projectContext([propositionAttitude("anna-in-killing", belief(true))]);
    const e = createDialoguePolicyEngine(local);
    const result = e.evaluate(ask(e, local.attitudes[0]!.claim), answerPolicy(e));
    expect(result.success && result.decision.act.kind === "assert" && result.decision.act.value).toBe(true);
  });
});

describe("TASK-0005 module boundaries (AC-03)", () => {
  const source = readFileSync(new URL("../src/domain/npc-dialogue-policy.ts", import.meta.url), "utf8");

  it("exports exactly createDialoguePolicyEngine at runtime", () => {
    expect(Object.keys(dialogue)).toEqual(["createDialoguePolicyEngine"]);
  });

  it("imports only zod at runtime and only projection types", () => {
    const imports = [...source.matchAll(/^import .*$/gm)].map((match) => match[0]);
    expect(imports).toEqual([
      'import { z } from "zod";',
      'import type { NpcVisibleClaim, NpcVisibleContext, VisibleRef } from "./npc-knowledge.projection.ts";',
    ]);
    for (const forbidden of ["require(", "import(", "node:", "process.", "Math.random", "Date", "localeCompare", "case-truth", "case-solution", "case-semantics", "npc-knowledge.ts", "Symbol("]) {
      expect(source.includes(forbidden), forbidden).toBe(false);
    }
  });

  it("type exports match §12", () => {
    const exported = [...source.matchAll(/^export (?:type|function|const) (\w+)/gm)].map((match) => match[1]).sort();
    expect(exported).toEqual(
      [
        "CommunicativeAct",
        "DialoguePolicyEngine",
        "DialogueQuery",
        "DialogueQueryInput",
        "PolicyDecision",
        "PolicyResult",
        "RuntimeDialoguePolicy",
        "RuntimeDialoguePolicyInput",
        "createDialoguePolicyEngine",
      ].sort(),
    );
  });

  it("production stays within the recommended size (§17)", () => {
    expect(source.split("\n").length).toBeLessThanOrEqual(550);
  });
});
