import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import type { NpcVisibleContext } from "../src/domain/npc-knowledge.projection.ts";
import {
  createDialoguePolicyEngine,
  type DialoguePolicyEngine,
  type PolicyResult,
} from "../src/domain/npc-dialogue-policy.ts";
import {
  belief,
  conclusionAttitude,
  knowledge,
  projectContext,
  propositionAttitude,
  richContext,
  singleContext,
  uncertain,
  world,
} from "./npc-dialogue-policy.fixture.ts";

type Action = "answer" | "refuse" | "evade" | "invert" | "feign_ignorance";
type Default = "answer" | "refuse" | "evade";
type Attitude = NpcVisibleContext["attitudes"][number];
type Path = (string | number)[];

function attitude(context: NpcVisibleContext, kind: "proposition" | "conclusion", index: number): Attitude {
  const found = context.attitudes.find((a) => a.subject.kind === kind && a.subject.index === index);
  if (found === undefined) throw new Error(`no attitude ${kind} ${index}`);
  return found;
}

function ask(engine: DialoguePolicyEngine, claim: unknown) {
  return engine.querySchema.parse({ kind: "ask_about_claim", claim } as never);
}

function policy(engine: DialoguePolicyEngine, defaultAction: Default, rules: { subject: unknown; action: Action }[] = []) {
  return engine.policySchema.parse({ schemaVersion: 1, defaultAction, rules } as never);
}

/** Evaluates `claim` under a policy with `action` as rule for `subject` (or none) and the given default. */
function decide(
  context: NpcVisibleContext,
  claim: unknown,
  defaultAction: Default,
  rule?: { subject: unknown; action: Action },
): PolicyResult {
  const engine = createDialoguePolicyEngine(context);
  return engine.evaluate(ask(engine, claim), policy(engine, defaultAction, rule === undefined ? [] : [rule]));
}

function decision(result: PolicyResult) {
  if (!result.success) throw new Error(result.code);
  return result.decision;
}

function policyIssuePaths(engine: DialoguePolicyEngine, input: unknown): Path[] {
  const parsed = engine.policySchema.safeParse(input as never);
  expect(parsed.success).toBe(false);
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.path as Path);
}

function queryIssuePaths(engine: DialoguePolicyEngine, input: unknown): Path[] {
  const parsed = engine.querySchema.safeParse(input as never);
  expect(parsed.success).toBe(false);
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.path as Path);
}

const ref = (kind: string, index: number) => ({ kind, index });

/** Plain-data copy of a context claim, for expected values. */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe("TASK-0005 decision table: knowledge and belief (groups 1, 2)", () => {
  for (const [stanceName, stance, commitment] of [
    ["knowledge", knowledge, "unqualified"],
    ["belief", belief, "belief"],
  ] as const) {
    for (const value of [true, false]) {
      const context = singleContext(stance(value));
      const a = context.attitudes[0]!;
      const expectedAssert = (v: boolean) => ({
        kind: "assert",
        subject: plain(a.subject),
        claim: plain(a.claim),
        value: v,
        commitment,
      });

      it(`${stanceName}(${value}) answer -> sincere assert`, () => {
        expect(decision(decide(context, a.claim, "answer"))).toEqual({ intent: "sincere", act: expectedAssert(value) });
        expect(decision(decide(context, a.claim, "refuse", { subject: a.subject, action: "answer" }))).toEqual({
          intent: "sincere",
          act: expectedAssert(value),
        });
      });

      it(`${stanceName}(${value}) invert -> deceptive assert of the negation`, () => {
        expect(decision(decide(context, a.claim, "answer", { subject: a.subject, action: "invert" }))).toEqual({
          intent: "deceptive",
          act: expectedAssert(!value),
        });
      });

      it(`${stanceName}(${value}) refuse / evade -> withholding`, () => {
        for (const action of ["refuse", "evade"] as const) {
          expect(decision(decide(context, a.claim, action))).toEqual({ intent: "withholding", act: { kind: action } });
          expect(decision(decide(context, a.claim, "answer", { subject: a.subject, action }))).toEqual({
            intent: "withholding",
            act: { kind: action },
          });
        }
      });

      it(`${stanceName}(${value}) feign_ignorance under answer -> deceptive claim_ignorance`, () => {
        expect(decision(decide(context, a.claim, "answer", { subject: a.subject, action: "feign_ignorance" }))).toEqual({
          intent: "deceptive",
          act: { kind: "claim_ignorance" },
        });
      });

      it(`${stanceName}(${value}) feign_ignorance under refuse/evade fails at rules,0,action`, () => {
        const engine = createDialoguePolicyEngine(context);
        for (const defaultAction of ["refuse", "evade"]) {
          expect(
            policyIssuePaths(engine, {
              schemaVersion: 1,
              defaultAction,
              rules: [{ subject: a.subject, action: "feign_ignorance" }],
            }),
          ).toEqual([["rules", 0, "action"]]);
        }
      });
    }
  }

  it("an objectively false belief is answered sincerely, its inversion is deceptive", () => {
    // anna-in-killing is objectively false; Anna believes it (belief(true)).
    const context = projectContext([propositionAttitude("anna-in-killing", belief(true))]);
    const a = context.attitudes[0]!;
    expect(decision(decide(context, a.claim, "answer")).intent).toBe("sincere");
    // Inverting a false belief happens to be objectively true and is still deceptive.
    const inverted = decision(decide(context, a.claim, "answer", { subject: a.subject, action: "invert" }));
    expect(inverted).toEqual({
      intent: "deceptive",
      act: { kind: "assert", subject: plain(a.subject), claim: plain(a.claim), value: false, commitment: "belief" },
    });
  });
});

describe("TASK-0005 decision table: uncertainty (group 3)", () => {
  for (const leaning of [true, false, null]) {
    const context = singleContext(uncertain(leaning));
    const a = context.attitudes[0]!;

    it(`uncertain(${leaning}) answer -> express_uncertainty with the same leaning`, () => {
      const result = decision(decide(context, a.claim, "answer"));
      expect(result).toEqual({
        intent: "sincere",
        act: { kind: "express_uncertainty", subject: plain(a.subject), claim: plain(a.claim), leaning },
      });
      if (result.act.kind === "express_uncertainty") expect(Object.is(result.act.leaning, leaning)).toBe(true);
    });

    it(`uncertain(${leaning}) refuse/evade/feign`, () => {
      for (const action of ["refuse", "evade"] as const) {
        expect(decision(decide(context, a.claim, "answer", { subject: a.subject, action }))).toEqual({
          intent: "withholding",
          act: { kind: action },
        });
      }
      expect(decision(decide(context, a.claim, "answer", { subject: a.subject, action: "feign_ignorance" }))).toEqual({
        intent: "deceptive",
        act: { kind: "claim_ignorance" },
      });
    });

    it(`uncertain(${leaning}) invert fails at rules,0,action; feign under refuse/evade too`, () => {
      const engine = createDialoguePolicyEngine(context);
      for (const defaultAction of ["answer", "refuse", "evade"]) {
        expect(
          policyIssuePaths(engine, { schemaVersion: 1, defaultAction, rules: [{ subject: a.subject, action: "invert" }] }),
        ).toEqual([["rules", 0, "action"]]);
      }
      for (const defaultAction of ["refuse", "evade"]) {
        expect(
          policyIssuePaths(engine, {
            schemaVersion: 1,
            defaultAction,
            rules: [{ subject: a.subject, action: "feign_ignorance" }],
          }),
        ).toEqual([["rules", 0, "action"]]);
      }
    });
  }
});

describe("TASK-0005 missing attitude and cross-default comparison (group 4, AC-16, AC-23)", () => {
  const context = singleContext(knowledge(true));
  const a = context.attitudes[0]!;
  const unknownClaim = { kind: "personAt", person: a.claim.kind === "personAt" ? a.claim.person : null, location: a.claim.kind === "personAt" ? a.claim.location : null, at: 301 };

  it("no attitude: answer -> sincere claim_ignorance, refuse/evade -> withholding", () => {
    expect(decision(decide(context, unknownClaim, "answer"))).toEqual({ intent: "sincere", act: { kind: "claim_ignorance" } });
    for (const action of ["refuse", "evade"] as const) {
      expect(decision(decide(context, unknownClaim, action))).toEqual({ intent: "withholding", act: { kind: action } });
    }
  });

  it("rule action equal to the default is indistinguishable from a missing attitude", () => {
    const engine = createDialoguePolicyEngine(context);
    for (const action of ["refuse", "evade"] as const) {
      const sameAsDefault = policy(engine, action, [{ subject: a.subject, action }]);
      expect(engine.evaluate(ask(engine, a.claim), sameAsDefault)).toEqual(engine.evaluate(ask(engine, unknownClaim), sameAsDefault));
    }
  });

  it("feign_ignorance under answer has exactly the act of a missing attitude", () => {
    const engine = createDialoguePolicyEngine(context);
    const feign = policy(engine, "answer", [{ subject: a.subject, action: "feign_ignorance" }]);
    const known = decision(engine.evaluate(ask(engine, a.claim), feign));
    const missing = decision(engine.evaluate(ask(engine, unknownClaim), feign));
    expect(known.act).toEqual(missing.act);
    expect(JSON.stringify(known.act)).toBe(JSON.stringify(missing.act));
    expect([known.intent, missing.intent]).toEqual(["deceptive", "sincere"]);
  });

  it("a deviating refuse/evade rule is distinguishable (authorized existence hint)", () => {
    const engine = createDialoguePolicyEngine(context);
    for (const [defaultAction, action] of [
      ["answer", "refuse"],
      ["answer", "evade"],
      ["refuse", "evade"],
      ["evade", "refuse"],
    ] as const) {
      const deviating = policy(engine, defaultAction, [{ subject: a.subject, action }]);
      const known = decision(engine.evaluate(ask(engine, a.claim), deviating));
      const missing = decision(engine.evaluate(ask(engine, unknownClaim), deviating));
      expect(known.act).toEqual({ kind: action });
      expect(missing.act).not.toEqual(known.act);
    }
  });
});

describe("TASK-0005 all nine claim forms (group 5)", () => {
  const context = richContext();
  const engine = createDialoguePolicyEngine(context);
  const answer = policy(engine, "answer");
  const P = (i: number) => ref("person", i);
  const E = (i: number) => ref("event", i);
  const cases: [string, number, object, object][] = [
    ["proposition", 1, { kind: "personAt", person: P(1), location: ref("location", 2), at: 300 }, { value: false, commitment: "unqualified" }],
    ["proposition", 2, { kind: "eventHasParticipant", event: E(2), person: P(1) }, { value: false, commitment: "belief" }],
    ["proposition", 5, { kind: "eventHasItem", event: E(2), item: ref("item", 1) }, { leaning: null }],
    ["conclusion", 3, { kind: "personResponsibleForEvent", person: P(2), event: E(2) }, { leaning: true }],
    ["conclusion", 4, { kind: "personRoleForEvent", person: P(2), event: E(2), role: "direct_actor" }, { value: true, commitment: "belief" }],
    ["conclusion", 7, { kind: "noPersonResponsibleForEvent", event: E(2) }, { value: false, commitment: "belief" }],
    ["conclusion", 2, { kind: "eventCausedEvent", causeEvent: E(1), event: E(2) }, { value: true, commitment: "belief" }],
    ["conclusion", 5, { kind: "eventIntent", event: E(2), value: "intended" }, { value: true, commitment: "belief" }],
    ["conclusion", 6, { kind: "eventMechanism", event: E(2), value: "ordinary" }, { value: false, commitment: "belief" }],
  ];

  for (const [kind, index, claim, rest] of cases) {
    it(`${(claim as { kind: string }).kind} -> handwritten act`, () => {
      const a = attitude(context, kind as "proposition" | "conclusion", index);
      const act = decision(engine.evaluate(ask(engine, a.claim), answer)).act;
      const head = "leaning" in rest ? "express_uncertainty" : "assert";
      expect(JSON.stringify(act)).toBe(JSON.stringify({ kind: head, subject: { kind, index }, claim, ...rest }));
    });
  }

  it("every role, intent and mechanism literal is accepted as a question", () => {
    const killing = attitude(context, "conclusion", 4).claim;
    if (killing.kind !== "personRoleForEvent") throw new Error("fixture");
    for (const role of ["direct_actor", "planner", "facilitator"]) {
      ask(engine, { kind: "personRoleForEvent", person: killing.person, event: killing.event, role });
    }
    for (const value of ["intended", "unintended", "not_applicable"]) ask(engine, { kind: "eventIntent", event: killing.event, value });
    for (const value of ["ordinary", "supernatural", "mixed"]) ask(engine, { kind: "eventMechanism", event: killing.event, value });
    expect(queryIssuePaths(engine, { kind: "ask_about_claim", claim: { kind: "eventIntent", event: killing.event, value: "accidental" } })).toEqual([["claim", "value"]]);
    expect(queryIssuePaths(engine, { kind: "ask_about_claim", claim: { kind: "personRoleForEvent", person: killing.person, event: killing.event, role: "accomplice" } })).toEqual([["claim", "role"]]);
    expect(queryIssuePaths(engine, { kind: "ask_about_claim", claim: { kind: "eventMechanism", event: killing.event, value: "magic" } })).toEqual([["claim", "value"]]);
  });
});

describe("TASK-0005 no inference (groups 6, 12, 13)", () => {
  const context = richContext();
  const engine = createDialoguePolicyEngine(context);
  const answer = policy(engine, "answer");
  const ignorance = { intent: "sincere", act: { kind: "claim_ignorance" } };

  it("invert changes only the polarity", () => {
    const a = attitude(context, "conclusion", 4);
    const inverted = decision(engine.evaluate(ask(engine, a.claim), policy(engine, "answer", [{ subject: a.subject, action: "invert" }])));
    const answered = decision(engine.evaluate(ask(engine, a.claim), answer));
    if (inverted.act.kind !== "assert" || answered.act.kind !== "assert") throw new Error("expected asserts");
    expect(inverted.act.claim).toEqual(answered.act.claim);
    expect(inverted.act.subject).toEqual(answered.act.subject);
    expect(inverted.act.commitment).toBe(answered.act.commitment);
    expect(inverted.act.value).toBe(!answered.act.value);
  });

  it("same referents with another tick, role or mechanism stay unknown", () => {
    const at = attitude(context, "proposition", 3).claim;
    const role = attitude(context, "conclusion", 4).claim;
    const mechanism = attitude(context, "conclusion", 6).claim;
    if (at.kind !== "personAt" || role.kind !== "personRoleForEvent" || mechanism.kind !== "eventMechanism") throw new Error("fixture");
    for (const claim of [
      { ...at, at: 299 },
      { ...at, at: 0 },
      { ...role, role: "planner" },
      { ...mechanism, value: "mixed" },
    ]) {
      expect(decision(engine.evaluate(ask(engine, claim), answer))).toEqual(ignorance);
    }
  });

  it("no negation, swap or equivalence inference", () => {
    const caused = attitude(context, "conclusion", 2).claim;
    if (caused.kind !== "eventCausedEvent") throw new Error("fixture");
    // Swapped cause/effect and the reflexive question (allowed, no world validation) are unknown.
    for (const claim of [
      { kind: "eventCausedEvent", causeEvent: caused.event, event: caused.causeEvent },
      { kind: "eventCausedEvent", causeEvent: caused.event, event: caused.event },
    ]) {
      expect(decision(engine.evaluate(ask(engine, claim), answer))).toEqual(ignorance);
    }
  });

  it("event and evidence awareness create no attitude", () => {
    const walk = context.awareness.find((r) => r.kind === "event")!;
    const dora = context.awareness.find((r) => r.kind === "person")!;
    expect(walk).toEqual({ kind: "event", index: 3 });
    const query = ask(engine, { kind: "eventHasParticipant", event: walk, person: context.self });
    expect(decision(engine.evaluate(query, answer))).toEqual(ignorance);
    expect(decision(engine.evaluate(ask(engine, { kind: "eventHasParticipant", event: walk, person: dora }), answer))).toEqual(ignorance);
  });

  it("conclusion beliefs communicate the same whatever the answer key says", () => {
    const attitudes = [conclusionAttitude("ben-responsible", belief(true)), conclusionAttitude("nobody-responsible", belief(true))];
    const baseline = projectContext(attitudes);
    const keyed = (responsibility: object) => (s: { resolutions: { responsibility: object }[]; requiredConclusions: object[] }) => {
      s.resolutions[0]!.responsibility = responsibility;
      s.requiredConclusions = [{ conclusionId: "conclusion:killing-intended", value: true }];
    };
    const actor = (personId: string) => [{ personId, roles: ["direct_actor"] }];
    // Answer keys where ben-responsible / nobody-responsible are false, undetermined or true.
    const variants = [
      world(undefined, keyed({ completeness: "complete", assignments: actor("person:dora") })),
      world(undefined, keyed({ completeness: "partial", assignments: [] })),
      world(undefined, keyed({ completeness: "complete", assignments: [] })),
      world(undefined, keyed({ completeness: "complete", assignments: actor("person:ben") })),
    ];
    const run = (context: NpcVisibleContext) => {
      const e = createDialoguePolicyEngine(context);
      return context.attitudes.map((a) => JSON.stringify(e.evaluate(ask(e, a.claim), policy(e, "answer"))));
    };
    for (const w of variants) expect(run(projectContext(attitudes, [], w))).toEqual(run(baseline));
  });
});

describe("TASK-0005 policy parsing (groups 7, 11)", () => {
  const context = richContext();
  const engine = createDialoguePolicyEngine(context);
  const p3 = attitude(context, "proposition", 3);
  const p1 = attitude(context, "proposition", 1);
  const c1 = attitude(context, "conclusion", 1);

  it("empty rules are valid; default is mandatory", () => {
    expect(policy(engine, "evade").rules).toEqual([]);
    expect(policyIssuePaths(engine, { schemaVersion: 1, rules: [] })).toEqual([["defaultAction"]]);
    expect(policyIssuePaths(engine, { schemaVersion: 1, defaultAction: "answer" })).toEqual([["rules"]]);
  });

  it("invert and feign_ignorance are never a default", () => {
    for (const defaultAction of ["invert", "feign_ignorance", "conceal", "Answer"]) {
      expect(policyIssuePaths(engine, { schemaVersion: 1, defaultAction, rules: [] })).toEqual([["defaultAction"]]);
    }
  });

  it("identical and contradicting duplicate rules fail at the later subject", () => {
    for (const second of ["refuse", "answer"]) {
      expect(
        policyIssuePaths(engine, {
          schemaVersion: 1,
          defaultAction: "answer",
          rules: [
            { subject: p3.subject, action: "refuse" },
            { subject: c1.subject, action: "evade" },
            { subject: p3.subject, action: second },
          ],
        }),
      ).toEqual([["rules", 2, "subject"]]);
    }
  });

  it("proposition 1 and conclusion 1 are different subjects", () => {
    const parsed = policy(engine, "answer", [
      { subject: p1.subject, action: "refuse" },
      { subject: c1.subject, action: "evade" },
    ]);
    expect(decision(engine.evaluate(ask(engine, p1.claim), parsed)).act).toEqual({ kind: "refuse" });
    expect(decision(engine.evaluate(ask(engine, c1.claim), parsed)).act).toEqual({ kind: "evade" });
  });

  it("a specific rule overrides the default; without a match the default applies", () => {
    const parsed = policy(engine, "evade", [{ subject: p3.subject, action: "answer" }]);
    expect(decision(engine.evaluate(ask(engine, p3.claim), parsed)).act.kind).toBe("assert");
    expect(decision(engine.evaluate(ask(engine, p1.claim), parsed)).act).toEqual({ kind: "evade" });
  });

  it("rule order does not change any result", () => {
    const rules = [
      { subject: p3.subject, action: "invert" as const },
      { subject: c1.subject, action: "refuse" as const },
      { subject: p1.subject, action: "evade" as const },
    ];
    const forward = policy(engine, "answer", rules);
    const backward = policy(engine, "answer", [...rules].reverse());
    for (const a of context.attitudes) {
      expect(JSON.stringify(engine.evaluate(ask(engine, a.claim), backward))).toBe(JSON.stringify(engine.evaluate(ask(engine, a.claim), forward)));
    }
  });

  it("rules cannot carry claims, text or alternative persons", () => {
    for (const extra of [{ claim: p3.claim }, { text: "Ich war im Garten" }, { person: context.self }]) {
      expect(
        policyIssuePaths(engine, { schemaVersion: 1, defaultAction: "answer", rules: [{ subject: p3.subject, action: "answer", ...extra }] }),
      ).toEqual([["rules", 0]]);
    }
    expect(policyIssuePaths(engine, { schemaVersion: 1, defaultAction: "answer", rules: [], caseId: "case:library" })).toEqual([[]]);
  });

  it("schemaVersion must be 1", () => {
    for (const schemaVersion of [2, "1", 0, undefined]) {
      expect(policyIssuePaths(engine, { schemaVersion, defaultAction: "answer", rules: [] })).toEqual([["schemaVersion"]]);
    }
  });

  it("entity refs and unknown statement refs are no rule subject", () => {
    expect(policyIssuePaths(engine, { schemaVersion: 1, defaultAction: "answer", rules: [{ subject: context.self, action: "answer" }] })).toEqual([
      ["rules", 0, "subject", "kind"],
    ]);
    expect(policyIssuePaths(engine, { schemaVersion: 1, defaultAction: "answer", rules: [{ subject: ref("proposition", 99), action: "answer" }] })).toEqual([
      ["rules", 0, "subject"],
    ]);
  });
});

describe("TASK-0005 query parsing (groups 7, AC-05, AC-11)", () => {
  const context = richContext();
  const engine = createDialoguePolicyEngine(context);
  const at = attitude(context, "proposition", 3).claim;
  if (at.kind !== "personAt") throw new Error("fixture");

  it("an unknown claim over visible referents is a valid question", () => {
    const query = ask(engine, { kind: "personAt", person: context.self, location: at.location, at: 12345 });
    expect(decision(engine.evaluate(query, policy(engine, "answer")))).toEqual({ intent: "sincere", act: { kind: "claim_ignorance" } });
  });

  it("invalid index and tick values", () => {
    for (const index of [0, -1, 1.5, Infinity, NaN, 2 ** 53, "1"]) {
      const paths = queryIssuePaths(engine, { kind: "ask_about_claim", claim: { ...at, person: { kind: "person", index } } });
      expect(paths).toContainEqual(["claim", "person", "index"]);
    }
    for (const tick of [-0, -1, 1.5, Infinity, NaN, 2 ** 53, "300"]) {
      expect(queryIssuePaths(engine, { kind: "ask_about_claim", claim: { ...at, at: tick } })).toEqual([["claim", "at"]]);
    }
  });

  it("missing fields, extra fields, wrong literals and unknown claim kinds", () => {
    const { at: _omitted, ...missing } = at;
    expect(queryIssuePaths(engine, { kind: "ask_about_claim", claim: missing })).toEqual([["claim", "at"]]);
    expect(queryIssuePaths(engine, { kind: "ask_about_claim", claim: { ...at, truth: true } })).toEqual([["claim"]]);
    expect(queryIssuePaths(engine, { kind: "ask_about_claim", claim: at, text: "Wo warst du?" })).toEqual([[]]);
    expect(queryIssuePaths(engine, { kind: "ask_about_entity", claim: at })).toEqual([["kind"]]);
    expect(queryIssuePaths(engine, { kind: "ask_about_claim", claim: { ...at, kind: "personNear" } })).toEqual([["claim", "kind"]]);
    expect(queryIssuePaths(engine, { kind: "ask_about_claim" })).toEqual([["claim"]]);
    for (const input of [null, undefined, "ask", 42, []]) expect(queryIssuePaths(engine, input).length).toBeGreaterThan(0);
  });

  it("wrong category in a field is rejected even with a visible index", () => {
    // location 1 is visible, but not as a person; person 2 is visible, but not as an event.
    expect(queryIssuePaths(engine, { kind: "ask_about_claim", claim: { ...at, person: context.awareness[1] } })).toEqual([["claim", "person", "kind"]]);
    const killing = attitude(context, "conclusion", 7).claim;
    expect(queryIssuePaths(engine, { kind: "ask_about_claim", claim: { kind: "eventIntent", event: at.person, value: "intended" } })).toEqual([
      ["claim", "event", "kind"],
    ]);
    expect(killing.kind).toBe("noPersonResponsibleForEvent");
  });

  it("statement refs are not entity refs", () => {
    const p3 = attitude(context, "proposition", 3).subject;
    expect(queryIssuePaths(engine, { kind: "ask_about_claim", claim: { ...at, person: p3 } })).toEqual([["claim", "person", "kind"]]);
  });
});

describe("TASK-0005 determinism (AC-19)", () => {
  it("repetition and property order give byte-identical results", () => {
    const context = richContext();
    const engine = createDialoguePolicyEngine(context);
    const a = attitude(context, "conclusion", 4);
    if (a.claim.kind !== "personRoleForEvent") throw new Error("fixture");
    const reordered = { role: a.claim.role, event: a.claim.event, person: a.claim.person, kind: a.claim.kind };
    const answer = policy(engine, "answer");
    const reorderedPolicy = engine.policySchema.parse({ rules: [], defaultAction: "answer", schemaVersion: 1 });
    const first = JSON.stringify(engine.evaluate(ask(engine, a.claim), answer));
    expect(JSON.stringify(engine.evaluate(ask(engine, a.claim), answer))).toBe(first);
    expect(JSON.stringify(engine.evaluate(ask(engine, reordered), reorderedPolicy))).toBe(first);
    expect(JSON.stringify(engine.evaluate(engine.querySchema.parse({ claim: reordered, kind: "ask_about_claim" }), answer))).toBe(first);
  });

  it("two separate equal projections, each with its own refs, give identical results", () => {
    const run = (context: NpcVisibleContext) => {
      const engine = createDialoguePolicyEngine(context);
      const rules = [{ subject: attitude(context, "proposition", 3).subject, action: "invert" as const }];
      const parsed = policy(engine, "answer", rules);
      return context.attitudes.map((a) => JSON.stringify(engine.evaluate(ask(engine, a.claim), parsed)));
    };
    const first = richContext();
    const second = richContext();
    expect(first).not.toBe(second);
    expect(run(second)).toEqual(run(first));
  });

  it("changed hidden truth/solution data with the same visible state gives identical results (AC-20)", () => {
    const hidden = world(
      (t) => {
        t.title = "Ganz anderer Titel";
        t.motives = [];
        t.secrets = [];
        t.propositions.find((p: { id: string }) => p.id === "proposition:anna-in-killing").truth = true;
      },
      (s) => (s.resolutions[0].responsibility.completeness = "complete"),
    );
    const run = (context: NpcVisibleContext) => {
      const engine = createDialoguePolicyEngine(context);
      const parsed = policy(engine, "answer");
      return context.attitudes.map((a) => JSON.stringify(engine.evaluate(ask(engine, a.claim), parsed)));
    };
    const base = richContext();
    const changed = richContext(hidden);
    expect(changed).toEqual(base);
    expect(run(changed)).toEqual(run(base));
  });
});

describe("TASK-0005 parse errors are ZodErrors", () => {
  it(".parse throws ZodError, .safeParse returns success:false", () => {
    const engine = createDialoguePolicyEngine(singleContext(knowledge(true)));
    expect(() => engine.querySchema.parse({ kind: "ask_about_claim" } as never)).toThrow(ZodError);
    expect(() => engine.policySchema.parse({ schemaVersion: 1 } as never)).toThrow(ZodError);
    expect(engine.policySchema.safeParse({} as never).success).toBe(false);
  });
});
