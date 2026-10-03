import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { parseCaseTruth } from "../src/domain/case-truth.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import { validateCaseSemantics } from "../src/domain/case-semantics.ts";
import { parseCaseSolution } from "../src/domain/case-solution.ts";
import { hashCaseSolution } from "../src/domain/case-solution.identity.ts";
import { createNpcKnowledgeSchema, parseNpcKnowledge } from "../src/domain/npc-knowledge.ts";
import {
  aware,
  belief,
  conclusionAttitude,
  inferred,
  knowledge,
  npcInput,
  prior,
  propositionAttitude,
  solutionInput,
  truthInput,
  uncertain,
  world,
} from "./npc-knowledge.fixture.ts";

type Edit = (n: any) => void;
type Path = (string | number)[];

const { truth, solution } = world();
const schema = createNpcKnowledgeSchema(truth, solution);
const noSolutionSchema = createNpcKnowledgeSchema(truth, null);

const input = (edit: Edit = () => {}) => npcInput(truth, solution, edit);
const accepts = (edit: Edit) => schema.safeParse(input(edit)).success;

function expectRejectedAt(candidate: unknown, path: Path, target = schema) {
  const result = target.safeParse(candidate);
  expect(result.success).toBe(false);
  expect(result.error!.issues.map((issue) => JSON.stringify(issue.path))).toContain(JSON.stringify(path));
}

const witnessed = (event: string) => ({ kind: "witnessed_event", eventId: `event:${event}` });

describe("AC-03/04: strict shape", () => {
  it("AC-04: an empty snapshot is valid and nothing is added", () => {
    const snapshot = schema.parse(input());
    expect(snapshot.awareness).toEqual([]);
    expect(snapshot.attitudes).toEqual([]);
  });

  it("parsing never creates entries, even for event participation, secrets or evidence", () => {
    // Anna participates in event:walk; secrets and evidence exist in the truth.
    const snapshot = schema.parse(input((n) => (n.npcId = "person:ben")));
    expect([snapshot.awareness.length, snapshot.attitudes.length]).toEqual([0, 0]);
  });

  it.each<[string, unknown]>([
    ["null", null],
    ["an array", []],
    ["a string", "anna"],
    ["a number", 1],
    ["an empty object", {}],
  ])("rejects %s as root without throwing", (_name, candidate) => {
    expect(() => schema.safeParse(candidate)).not.toThrow();
    expect(schema.safeParse(candidate).success).toBe(false);
  });

  it.each<[string, Edit, Path]>([
    ["root", (n) => (n.isMistaken = false), []],
    ["awareness entry", (n) => n.awareness.push({ ...aware("person", "ben"), name: "x" }), ["awareness", 0]],
    ["awareness subject", (n) => n.awareness.push({ ...aware("person", "ben"), subject: { kind: "person", id: "person:ben", name: "x" } }), ["awareness", 0, "subject"]],
    ["provenance", (n) => n.awareness.push(aware("person", "ben", 0, { kind: "prior_knowledge", note: "x" })), ["awareness", 0, "provenance"]],
    ["attitude entry", (n) => n.attitudes.push({ ...propositionAttitude("ben-in-killing", belief(true)), utterance: "x" }), ["attitudes", 0]],
    ["stance", (n) => n.attitudes.push(propositionAttitude("ben-in-killing", { kind: "belief", value: true, isMistaken: false })), ["attitudes", 0, "stance"]],
    ["numeric confidence on uncertainty", (n) => n.attitudes.push(propositionAttitude("ben-in-killing", { kind: "uncertain", leaning: true, confidence: 0.7 })), ["attitudes", 0, "stance"]],
  ])("rejects an extra property on %s", (_name, edit, path) => {
    expectRejectedAt(input(edit), path);
  });

  it.each<[string, Edit, Path]>([
    ["solutionHash (null is required, not absence)", (n) => delete n.solutionHash, ["solutionHash"]],
    ["asOf", (n) => delete n.asOf, ["asOf"]],
    ["awareness", (n) => delete n.awareness, ["awareness"]],
    ["acquiredAt", (n) => n.awareness.push({ subject: { kind: "person", id: "person:ben" }, provenance: prior }), ["awareness", 0, "acquiredAt"]],
    ["provenance", (n) => n.awareness.push({ subject: { kind: "person", id: "person:ben" }, acquiredAt: 0 }), ["awareness", 0, "provenance"]],
    ["uncertain leaning (null is required)", (n) => n.attitudes.push(propositionAttitude("ben-in-killing", { kind: "uncertain" })), ["attitudes", 0]],
    ["provenance source", (n) => n.awareness.push(aware("person", "ben", 300, { kind: "witnessed_event" })), ["awareness", 0, "provenance", "eventId"]],
  ])("rejects a missing %s", (_name, edit, path) => {
    expectRejectedAt(input(edit), path);
  });

  it.each<[string, Edit, Path]>([
    ["awareness subject kind npc", (n) => n.awareness.push({ ...aware("person", "ben"), subject: { kind: "npc", id: "person:ben" } }), ["awareness", 0, "subject", "kind"]],
    ["awareness of a proposition", (n) => n.awareness.push({ ...aware("person", "ben"), subject: { kind: "proposition", id: "proposition:ben-in-killing" } }), ["awareness", 0, "subject", "kind"]],
    ["stance kind doubt", (n) => n.attitudes.push(propositionAttitude("ben-in-killing", { kind: "doubt", value: true })), ["attitudes", 0]],
    ["numeric leaning", (n) => n.attitudes.push(propositionAttitude("ben-in-killing", { kind: "uncertain", leaning: 0.7 })), ["attitudes", 0]],
    ["draft provenance authored_inference", (n) => n.awareness.push(aware("person", "ben", 0, { kind: "authored_inference" })), ["awareness", 0, "provenance", "kind"]],
    ["statement subject kind secret", (n) => n.attitudes.push({ ...propositionAttitude("ben-in-killing", belief(true)), subject: { kind: "secret", id: "secret:ben-did-it" } }), ["attitudes", 0]],
  ])("rejects a wrong discriminator: %s", (_name, edit, path) => {
    expectRejectedAt(input(edit), path);
  });

  it.each<[string, Edit, Path]>([
    ["schemaVersion 2", (n) => (n.schemaVersion = 2), ["schemaVersion"]],
    ["revision 0", (n) => (n.revision = 0), ["revision"]],
    ["unsafe revision", (n) => (n.revision = 2 ** 53), ["revision"]],
    ["negative asOf", (n) => (n.asOf = -1), ["asOf"]],
    ["fractional asOf", (n) => (n.asOf = 1.5), ["asOf"]],
    ["unsafe asOf", (n) => (n.asOf = 2 ** 53), ["asOf"]],
    ["infinite asOf", (n) => (n.asOf = Infinity), ["asOf"]],
    ["NaN asOf", (n) => (n.asOf = NaN), ["asOf"]],
    ["-0 asOf", (n) => (n.asOf = -0), ["asOf"]],
    ["negative acquiredAt", (n) => n.awareness.push(aware("person", "ben", -1, inferred)), ["awareness", 0, "acquiredAt"]],
    ["-0 acquiredAt", (n) => n.awareness.push(aware("person", "ben", -0, inferred)), ["awareness", 0, "acquiredAt"]],
    ["uppercase truthHash", (n) => (n.truthHash = n.truthHash.toUpperCase()), ["truthHash"]],
    ["truthHash with trailing newline", (n) => (n.truthHash = `${n.truthHash}\n`), ["truthHash"]],
    ["short solutionHash", (n) => (n.solutionHash = n.solutionHash.slice(1)), ["solutionHash"]],
    ["npcId with wrong prefix", (n) => (n.npcId = "location:library"), ["npcId"]],
  ])("rejects %s", (_name, edit, path) => {
    expectRejectedAt(input(edit), path);
  });

  it("accepts safe integer limits for revision, asOf and acquiredAt", () => {
    expect(accepts((n) => {
      n.revision = Number.MAX_SAFE_INTEGER;
      n.asOf = Number.MAX_SAFE_INTEGER;
      n.awareness.push(aware("person", "ben", Number.MAX_SAFE_INTEGER, inferred));
    })).toBe(true);
  });
});

describe("AC-05: binding", () => {
  it.each<[string, Edit, Path]>([
    ["another caseId", (n) => (n.caseId = "case:other"), ["caseId"]],
    ["another truthHash", (n) => (n.truthHash = "0".repeat(64)), ["truthHash"]],
    ["an unknown NPC", (n) => (n.npcId = "person:ghost"), ["npcId"]],
    ["a null solutionHash although a solution is bound", (n) => (n.solutionHash = null), ["solutionHash"]],
    ["a wrong solutionHash", (n) => (n.solutionHash = "0".repeat(64)), ["solutionHash"]],
  ])("rejects %s", (_name, edit, path) => {
    expectRejectedAt(input(edit), path);
  });

  it("rejects a non-null solutionHash when no solution is bound", () => {
    expectRejectedAt(npcInput(truth, solution), ["solutionHash"], noSolutionSchema);
  });

  it("rejects conclusion attitudes when no solution is bound, even with a valid ID", () => {
    const candidate = npcInput(truth, null, (n) => n.attitudes.push(conclusionAttitude("ben-responsible", belief(true))));
    expectRejectedAt(candidate, ["attitudes", 0, "subject", "id"], noSolutionSchema);
  });

  it("accepts a proposition-only snapshot without solution", () => {
    const candidate = npcInput(truth, null, (n) => n.attitudes.push(propositionAttitude("ben-in-killing", belief(true))));
    expect(noSolutionSchema.safeParse(candidate).success).toBe(true);
  });

  it("requires the solution binding also for snapshots without conclusion attitudes", () => {
    expectRejectedAt(npcInput(truth, null), ["solutionHash"]);
  });

  it("does not accept the same caseId and revision with changed truth content", () => {
    const edited = parseCaseTruth({ ...truthInput(), title: "SPOILER anders" });
    expect(edited.caseId).toBe(truth.caseId);
    expect(edited.revision).toBe(truth.revision);
    expectRejectedAt(input(), ["truthHash"], createNpcKnowledgeSchema(edited, null));
  });

  it("reports a solution bound to another truth at solutionHash, without the factory throwing", () => {
    const other = world((t) => (t.title = "SPOILER anders"));
    let foreignSchema!: ReturnType<typeof createNpcKnowledgeSchema>;
    expect(() => (foreignSchema = createNpcKnowledgeSchema(truth, other.solution))).not.toThrow();
    const candidate = npcInput(truth, other.solution);
    expectRejectedAt(candidate, ["solutionHash"], foreignSchema);
  });

  it("does not accept another solution with the same revision", () => {
    const other = world(undefined, (s) => (s.resolutions[0].intent = "unintended"));
    expect(other.solution.revision).toBe(solution.revision);
    expectRejectedAt(input(), ["solutionHash"], createNpcKnowledgeSchema(truth, other.solution));
  });
});

describe("AC-06: references", () => {
  it.each<[string, Edit]>([
    ["person", (n) => n.awareness.push(aware("person", "dora"))],
    ["location", (n) => n.awareness.push(aware("location", "library"))],
    ["item", (n) => n.awareness.push(aware("item", "knife"))],
    ["event", (n) => n.awareness.push(aware("event", "argument"))],
    ["evidence", (n) => n.awareness.push(aware("evidence", "bloody-knife"))],
    ["proposition attitude", (n) => n.attitudes.push(propositionAttitude("ben-in-killing", belief(true)))],
    ["conclusion attitude", (n) => n.attitudes.push(conclusionAttitude("ben-responsible", belief(true)))],
    ["witnessed_event source", (n) => n.awareness.push(aware("person", "ben", 150, witnessed("argument")))],
    ["observed_evidence source", (n) => n.awareness.push(aware("item", "knife", 450, { kind: "observed_evidence", evidenceId: "evidence:bloody-knife" }))],
    ["told_by_person source", (n) => n.awareness.push(aware("person", "ben", 450, { kind: "told_by_person", personId: "person:dora" }))],
  ])("accepts an existing %s", (_name, edit) => {
    expect(accepts(edit)).toBe(true);
  });

  it.each<[string, Edit, Path]>([
    ["person", (n) => n.awareness.push(aware("person", "ghost")), ["awareness", 0, "subject", "id"]],
    ["location", (n) => n.awareness.push(aware("location", "ghost")), ["awareness", 0, "subject", "id"]],
    ["item", (n) => n.awareness.push(aware("item", "ghost")), ["awareness", 0, "subject", "id"]],
    ["event", (n) => n.awareness.push(aware("event", "ghost")), ["awareness", 0, "subject", "id"]],
    ["evidence", (n) => n.awareness.push(aware("evidence", "ghost")), ["awareness", 0, "subject", "id"]],
    ["proposition", (n) => n.attitudes.push(propositionAttitude("ghost", belief(true))), ["attitudes", 0, "subject", "id"]],
    ["conclusion", (n) => n.attitudes.push(conclusionAttitude("ghost", belief(true))), ["attitudes", 0, "subject", "id"]],
    ["witnessed event", (n) => n.awareness.push(aware("person", "ben", 150, witnessed("ghost"))), ["awareness", 0, "provenance", "eventId"]],
    ["observed evidence", (n) => n.attitudes.push(propositionAttitude("ben-in-killing", belief(true), 450, { kind: "observed_evidence", evidenceId: "evidence:ghost" })), ["attitudes", 0, "provenance", "evidenceId"]],
    ["teller", (n) => n.attitudes.push(propositionAttitude("ben-in-killing", belief(true), 450, { kind: "told_by_person", personId: "person:ghost" })), ["attitudes", 0, "provenance", "personId"]],
  ])("rejects a missing %s", (_name, edit, path) => {
    expectRejectedAt(input(edit), path);
  });

  it.each<[string, Edit, Path]>([
    ["awareness subject", (n) => n.awareness.push({ ...aware("person", "ben"), subject: { kind: "person", id: "location:library" } }), ["awareness", 0, "subject", "id"]],
    ["proposition subject", (n) => n.attitudes.push({ ...propositionAttitude("x", belief(true)), subject: { kind: "proposition", id: "conclusion:ben-responsible" } }), ["attitudes", 0, "subject", "id"]],
    ["conclusion subject", (n) => n.attitudes.push({ ...conclusionAttitude("x", belief(true)), subject: { kind: "conclusion", id: "proposition:ben-in-killing" } }), ["attitudes", 0, "subject", "id"]],
    ["witnessed event", (n) => n.awareness.push(aware("person", "ben", 150, { kind: "witnessed_event", eventId: "evidence:bloody-knife" })), ["awareness", 0, "provenance", "eventId"]],
    ["observed evidence", (n) => n.awareness.push(aware("person", "ben", 150, { kind: "observed_evidence", evidenceId: "event:argument" })), ["awareness", 0, "provenance", "evidenceId"]],
    ["teller", (n) => n.awareness.push(aware("person", "ben", 150, { kind: "told_by_person", personId: "item:knife" })), ["awareness", 0, "provenance", "personId"]],
  ])("rejects a wrong ID prefix on %s", (_name, edit, path) => {
    expectRejectedAt(input(edit), path);
  });

  it("AC-12: dangling references everywhere yield Zod issues, not exceptions", () => {
    const candidate = input((n) => {
      n.awareness.push(aware("event", "ghost", 5, witnessed("ghost")));
      n.attitudes.push(propositionAttitude("ghost", knowledge(true), 5, { kind: "told_by_person", personId: "person:ghost" }));
      n.attitudes.push(conclusionAttitude("ghost", belief(true), 5, { kind: "observed_evidence", evidenceId: "evidence:ghost" }));
    });
    expect(() => schema.safeParse(candidate)).not.toThrow();
    expect(schema.safeParse(candidate).success).toBe(false);
    expect(() => parseNpcKnowledge(candidate, truth, solution)).toThrow(ZodError);
    expect(() => schema.parse(candidate)).toThrow(ZodError);
  });
});

describe("AC-07/08: knowledge, belief, uncertainty", () => {
  it.each<[string, string, object, boolean]>([
    ["knowledge:true of a true proposition", "ben-in-killing", knowledge(true), true],
    ["knowledge:false of a false proposition", "anna-in-killing", knowledge(false), true],
    ["knowledge:false of a true proposition", "ben-in-killing", knowledge(false), false],
    ["knowledge:true of a false proposition", "anna-in-killing", knowledge(true), false],
    ["belief:true of a false proposition", "anna-in-killing", belief(true), true],
    ["belief:false of a true proposition", "ben-in-killing", belief(false), true],
    ["uncertain leaning true", "ben-in-killing", uncertain(true), true],
    ["uncertain leaning false", "ben-in-killing", uncertain(false), true],
    ["uncertain without leaning", "ben-in-killing", uncertain(null), true],
  ])("%s", (_name, proposition, stance, ok) => {
    const candidate = input((n) => n.attitudes.push(propositionAttitude(proposition, stance)));
    if (ok) expect(schema.safeParse(candidate).success).toBe(true);
    else expectRejectedAt(candidate, ["attitudes", 0, "stance", "value"]);
  });

  it("keeps subjective values as authored (no normalization towards the truth)", () => {
    const snapshot = schema.parse(input((n) => {
      n.attitudes.push(propositionAttitude("anna-in-killing", belief(true)));
      n.attitudes.push(propositionAttitude("ben-in-killing", belief(false)));
    }));
    expect(snapshot.attitudes.map((a) => a.stance)).toEqual([belief(true), belief(false)]);
  });

  // Canonically: ben-responsible true, ben-role-planner false, anna-responsible undetermined.
  it.each(["ben-responsible", "ben-role-planner", "anna-responsible"])(
    "belief and uncertainty about conclusion %s are allowed whatever its canonical status",
    (id) => {
      for (const stance of [belief(true), belief(false), uncertain(true), uncertain(false), uncertain(null)]) {
        expect(accepts((n) => n.attitudes.push(conclusionAttitude(id, stance)))).toBe(true);
      }
    },
  );

  it.each([true, false])("rejects knowledge:%s about a conclusion", (value) => {
    expectRejectedAt(input((n) => n.attitudes.push(conclusionAttitude("ben-responsible", knowledge(value)))), ["attitudes", 0]);
  });

  it("a missing statement stays missing: no negation, no uncertainty is added", () => {
    const snapshot = schema.parse(input((n) => n.attitudes.push(propositionAttitude("ben-in-killing", belief(true)))));
    expect(snapshot.attitudes).toHaveLength(1);
  });
});

describe("AC-09: statement uniqueness", () => {
  it.each<[string, Edit, Path]>([
    ["the same awareness twice", (n) => n.awareness.push(aware("person", "ben"), aware("person", "ben", 450, inferred)), ["awareness", 1, "subject"]],
    ["the same proposition twice with different stances", (n) => n.attitudes.push(propositionAttitude("ben-in-killing", belief(true)), propositionAttitude("ben-in-killing", uncertain(null))), ["attitudes", 1, "subject"]],
    [
      "the same claim under another proposition ID with the same stance (property order differs in the truth)",
      (n) => n.attitudes.push(propositionAttitude("ben-at-library", belief(true)), propositionAttitude("ben-seen-in-library", belief(true))),
      ["attitudes", 1, "subject"],
    ],
    ["the same conclusion twice", (n) => n.attitudes.push(conclusionAttitude("ben-responsible", belief(true)), conclusionAttitude("ben-responsible", belief(false))), ["attitudes", 1, "subject"]],
  ])("rejects %s", (_name, edit, path) => {
    expectRejectedAt(input(edit), path);
  });

  it("claims differing in any field and across namespaces are distinct statements", () => {
    expect(accepts((n) => n.attitudes.push(
      propositionAttitude("ben-at-library", belief(true)),
      propositionAttitude("anna-at-library", belief(true)), // other person
      propositionAttitude("ben-in-killing", belief(true)), // eventHasParticipant ben
      conclusionAttitude("ben-responsible", belief(true)), // other namespace, related meaning
      conclusionAttitude("ben-role-actor", belief(true)),
      conclusionAttitude("ben-role-planner", belief(false)), // other role
    ))).toBe(true);
  });

  it("different NPCs may hold opposite attitudes towards the same claim", () => {
    const anna = schema.parse(input((n) => n.attitudes.push(propositionAttitude("ben-in-killing", belief(true)))));
    const ben = schema.parse(input((n) => {
      n.npcId = "person:ben";
      n.attitudes.push(propositionAttitude("ben-in-killing", belief(false)));
    }));
    expect([anna.attitudes[0]!.stance, ben.attitudes[0]!.stance]).toEqual([belief(true), belief(false)]);
  });

  it("two observers of the same event may interpret it differently", () => {
    const observe = (npcId: string, value: boolean) =>
      schema.safeParse(input((n) => {
        n.npcId = npcId;
        n.attitudes.push(propositionAttitude("ben-in-killing", belief(value), 150, witnessed("argument")));
      })).success;
    expect([observe("person:anna", true), observe("person:dora", false)]).toEqual([true, true]);
  });
});

describe("AC-10: provenance and time", () => {
  it.each<[string, number, object, number, boolean, Path?]>([
    ["acquiredAt equal to asOf", 500, inferred, 500, true],
    ["acquiredAt after asOf", 501, inferred, 500, false, ["awareness", 0, "acquiredAt"]],
    ["prior_knowledge at 0", 0, prior, 500, true],
    ["prior_knowledge after 0", 1, prior, 500, false, ["awareness", 0, "acquiredAt"]],
    ["witnessed instant at its tick", 300, witnessed("ben-kills-clara"), 500, true],
    ["witnessed instant off its tick", 301, witnessed("ben-kills-clara"), 500, false, ["awareness", 0, "acquiredAt"]],
    ["witnessed interval at its start", 100, witnessed("argument"), 500, true],
    ["witnessed interval inside", 199, witnessed("argument"), 500, true],
    ["witnessed interval before its start", 99, witnessed("argument"), 500, false, ["awareness", 0, "acquiredAt"]],
    ["witnessed interval at its exclusive end", 200, witnessed("argument"), 500, false, ["awareness", 0, "acquiredAt"]],
    ["observed evidence at any time", 7, { kind: "observed_evidence", evidenceId: "evidence:muddy-boots" }, 500, true],
    ["told by a person at any time", 3, { kind: "told_by_person", personId: "person:ben" }, 500, true],
    ["author-modeled inference without a proof chain", 42, inferred, 500, true],
  ])("%s", (_name, acquiredAt, provenance, asOf, ok, path) => {
    const candidate = input((n) => {
      n.asOf = asOf;
      n.awareness.push(aware("event", "argument", acquiredAt, provenance));
    });
    if (ok) expect(schema.safeParse(candidate).success).toBe(true);
    else expectRejectedAt(candidate, path!);
  });

  it("applies the same time rules to attitudes", () => {
    expectRejectedAt(input((n) => n.attitudes.push(propositionAttitude("ben-in-killing", belief(true), 200, witnessed("argument")))), ["attitudes", 0, "acquiredAt"]);
  });

  it("witnessing does not require participation (Anna witnesses the argument she is not part of)", () => {
    expect(accepts((n) => n.attitudes.push(propositionAttitude("ben-in-killing", knowledge(true), 300, witnessed("ben-kills-clara"))))).toBe(true);
  });

  it("a teller with unknown or contradicting knowledge is no reason to reject", () => {
    // Clara never knew anything modelled; Ben would contradict; neither is checked.
    expect(accepts((n) => {
      n.attitudes.push(propositionAttitude("anna-in-killing", belief(true), 450, { kind: "told_by_person", personId: "person:clara" }));
      n.attitudes.push(propositionAttitude("ben-in-killing", knowledge(true), 450, { kind: "told_by_person", personId: "person:ben" }));
    })).toBe(true);
  });

  it("evidence provenance for a belief in a false conclusion is allowed", () => {
    expect(accepts((n) => n.attitudes.push(conclusionAttitude("ben-role-planner", belief(true), 450, { kind: "observed_evidence", evidenceId: "evidence:bloody-knife" })))).toBe(true);
  });

  it("same asOf with different revisions and values are independent snapshots", () => {
    const first = schema.parse(input((n) => n.attitudes.push(propositionAttitude("ben-in-killing", belief(true)))));
    const second = schema.parse(input((n) => {
      n.revision = 2;
      n.attitudes.push(propositionAttitude("ben-in-killing", belief(false)));
    }));
    expect([first.asOf, second.asOf]).toEqual([500, 500]);
    expect([first.attitudes[0]!.stance, second.attitudes[0]!.stance]).toEqual([belief(true), belief(false)]);
  });
});

describe.each([
  ["parseNpcKnowledge", (candidate: unknown) => parseNpcKnowledge(candidate, truth, solution)],
  ["createNpcKnowledgeSchema(...).parse", (candidate: unknown) => createNpcKnowledgeSchema(truth, solution).parse(candidate)],
])("AC-11: immutability via %s", (_name, parse) => {
  const full = () => input((n) => {
    n.awareness.push(aware("person", "ben", 150, witnessed("argument")));
    n.attitudes.push(propositionAttitude("ben-in-killing", belief(true)));
    n.attitudes.push(conclusionAttitude("ben-responsible", uncertain(null)));
  });

  it("is decoupled from the input, which stays mutable", () => {
    const candidate = full();
    const snapshot = parse(candidate);
    candidate.asOf = 1;
    candidate.awareness[0].provenance.eventId = "event:walk";
    candidate.attitudes[0].stance.value = false;
    candidate.attitudes.pop();
    expect(snapshot.asOf).toBe(500);
    expect(snapshot.awareness[0]!.provenance).toEqual(witnessed("argument"));
    expect(snapshot.attitudes[0]!.stance).toEqual(belief(true));
    expect(snapshot.attitudes).toHaveLength(2);
    expect(Object.isFrozen(candidate)).toBe(false);
    expect(Object.isFrozen(candidate.attitudes)).toBe(false);
  });

  it("is recursively frozen, rejects mutation and embeds no truth or solution", () => {
    const snapshot: any = parse(full());
    const unfrozen: string[] = [];
    const visit = (value: unknown, path: string) => {
      if (typeof value !== "object" || value === null) return;
      if (!Object.isFrozen(value)) unfrozen.push(path);
      for (const [key, child] of Object.entries(value)) visit(child, `${path}.${key}`);
    };
    visit(snapshot, "$");
    expect(unfrozen).toEqual([]);
    for (const attempt of [
      () => (snapshot.asOf = 1),
      () => snapshot.awareness.push(aware("person", "dora")),
      () => (snapshot.attitudes[0].stance.value = false),
      () => (snapshot.attitudes[1].subject.id = "conclusion:nobody-responsible"),
    ]) {
      expect(attempt).toThrow(TypeError);
    }
    expect(Object.keys(snapshot).sort()).toEqual(
      ["asOf", "attitudes", "awareness", "caseId", "npcId", "revision", "schemaVersion", "solutionHash", "truthHash"],
    );
  });
});

it("truth and solution hashes and the TASK-0002 report are unchanged by NPC parsing", () => {
  const before = [hashCaseTruth(truth), hashCaseSolution(solution), validateCaseSemantics(truth)] as const;
  parseNpcKnowledge(input((n) => n.attitudes.push(propositionAttitude("ben-in-killing", belief(true)))), truth, solution);
  expect([hashCaseTruth(truth), hashCaseSolution(solution), validateCaseSemantics(truth)]).toEqual(before);
  expect(parseCaseSolution(solutionInput(hashCaseTruth(truth)), truth)).toEqual(solution);
});
