import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import { hashCaseSolution } from "../src/domain/case-solution.identity.ts";
import { validateCaseSemantics } from "../src/domain/case-semantics.ts";
import { evaluateConclusionClaim } from "../src/domain/case-solution.ts";
import { hashQuestionCatalogue } from "../src/domain/interrogation-authoring.identity.ts";
import { parseAccusation } from "../src/domain/case-accusation.ts";
import { evaluateChallengeAccusation } from "../src/domain/accusation-challenge.ts";
import { PLAYER_REF_PATTERN } from "../src/domain/interrogation.ts";
import { releaseEvidence } from "../src/domain/evidence-presentation.ts";
import {
  loadVitrine,
  readVitrineFile,
  VITRINE_NPCS,
  VITRINE_SOLUTION_HASH,
  VITRINE_TRUTH_HASH,
  vitrineHost,
  type VitrineHost,
  type VitrineNpc,
} from "./vitrine.fixture.ts";

const v = loadVitrine();
const CANDIDATES = ["max", "lina", "nora", "oskar"] as const;
const actor = (person: string) => ({ kind: "personRoleForEvent", personId: `person:${person}`, eventId: "event:e04", role: "direct_actor" });

const accuse = (values: Record<(typeof CANDIDATES)[number], boolean>) =>
  parseAccusation(
    {
      schemaVersion: 1,
      caseId: v.truth.caseId,
      truthHash: hashCaseTruth(v.truth),
      literals: CANDIDATES.map((person) => ({ claim: actor(person), value: values[person] })),
    },
    v.truth,
  );
const verdict = (values: Record<(typeof CANDIDATES)[number], boolean>) =>
  evaluateChallengeAccusation(v.truth, v.solution, v.challenge, accuse(values));
const oneHot = (person: string) => Object.fromEntries(CANDIDATES.map((p) => [p, p === person])) as Record<(typeof CANDIDATES)[number], boolean>;

const QUESTIONS: Record<VitrineNpc, string[]> = {
  max: ["q01", "q02", "q03", "q04", "q05"],
  nora: ["q06", "q07", "q08", "q09", "q10"],
  oskar: ["q11", "q12", "q13", "q14", "q15"],
  lina: ["q16", "q17", "q18", "q19", "q20"],
};
const q = (n: string) => `question:${n}`;

/** Exhaustive exploration: every authorized action until nothing new is released. */
function explore(host: VitrineHost) {
  for (let changed = true; changed; ) {
    const before = host.discovered().length + host.known().length;
    for (const entity of host.known()) {
      if (entity.kind === "location") host.search(entity.id);
      if (entity.kind === "item") host.examine(entity.id);
    }
    for (const npc of VITRINE_NPCS) for (const n of QUESTIONS[npc]) if (host.canAsk(npc, q(n))) host.ask(npc, q(n));
    changed = host.discovered().length + host.known().length !== before;
  }
}

describe("Die leere Vitrine: components load with the real parsers", () => {
  it("truth and solution are the unchanged originals and keep their pinned hashes", () => {
    const sha = (name: string) => createHash("sha256").update(readVitrineFile(name)).digest("hex");
    expect(sha("truth.json")).toBe("61ee45520d9673b04913e7d44caa3afa3270876f63dc59fc5e879273d749650d");
    expect(sha("solution.json")).toBe("27242715e0306931589ecd21e06acb381f1352cb89e7d8290bb1ecd6fe6f0b03");
    expect(hashCaseTruth(v.truth)).toBe(VITRINE_TRUTH_HASH);
    expect(hashCaseSolution(v.solution)).toBe(VITRINE_SOLUTION_HASH);
  });

  it("the truth has no semantic findings", () => {
    expect(validateCaseSemantics(v.truth).findings).toEqual([]);
  });

  it("every component is bound to this truth", () => {
    for (const doc of [v.solution, v.access, v.presentation, v.catalogue, v.challenge, ...Object.values(v.profiles)]) {
      expect(doc.caseId).toBe("case:leere-vitrine-v1");
      expect(doc.truthHash).toBe(VITRINE_TRUTH_HASH);
    }
    expect(v.challenge.solutionHash).toBe(VITRINE_SOLUTION_HASH);
  });

  it("all four interrogation profiles are bound to the catalogue and their NPC", () => {
    for (const npc of VITRINE_NPCS) {
      expect(v.profiles[npc].catalogueHash).toBe(hashQuestionCatalogue(v.catalogue));
      expect(v.profiles[npc].npcId).toBe(`person:${npc}`);
      expect(v.snapshots[npc].npcId).toBe(`person:${npc}`);
    }
  });

  it("size matches the authoring spec: 8 evidence, 20 questions (18 answer, 2 decline), 4 scope claims", () => {
    expect(v.truth.evidence).toHaveLength(8);
    expect(v.access.entries.every((entry) => entry.access.kind === "discoverable")).toBe(true);
    expect(v.presentation.entries).toHaveLength(8);
    expect(v.catalogue.questions).toHaveLength(20);
    const rules = Object.values(v.profiles).flatMap((profile) => profile.rules);
    expect(rules).toHaveLength(20);
    expect(rules.filter((rule) => rule.act === "decline").map((rule) => rule.questionId).sort()).toEqual([q("q16"), q("q20")]);
    expect(v.challenge.allowedClaims).toHaveLength(4);
  });

  it("the PlayerRef index covers every entity without collision", () => {
    const total = ["persons", "locations", "items", "events", "evidence"].reduce((n, key) => n + (v.truth as any)[key].length, 0);
    expect(v.refs.entries).toHaveLength(total);
    expect(v.refs.entries.every((entry) => PLAYER_REF_PATTERN.test(entry.ref))).toBe(true);
  });
});

describe("Die leere Vitrine: answer key and challenge", () => {
  it("every scope claim is determined; exactly Lina is the direct actor", () => {
    const statuses = CANDIDATES.map((person) => evaluateConclusionClaim(v.truth, v.solution, actor(person)));
    expect(statuses).toEqual(CANDIDATES.map((person) => ({ success: true, status: person === "lina" })));
  });

  it("exactly one of the 16 full vectors is solved", () => {
    const solved: string[] = [];
    for (let mask = 0; mask < 16; mask++) {
      const values = Object.fromEntries(CANDIDATES.map((p, i) => [p, (mask >> i) % 2 === 1])) as Record<(typeof CANDIDATES)[number], boolean>;
      const result = verdict(values);
      expect(result.success).toBe(true);
      if (result.success && result.verdict === "solved") solved.push(JSON.stringify(values));
    }
    expect(solved).toEqual([JSON.stringify(oneHot("lina"))]);
  });

  it("exactly one of the four one-hot picks is solved", () => {
    expect(CANDIDATES.map((person) => verdict(oneHot(person)))).toEqual(
      CANDIDATES.map((person) => ({ success: true, verdict: person === "lina" ? "solved" : "not_solved" })),
    );
  });

  it("an accusation outside the public scope is not solved", () => {
    const accusation = parseAccusation(
      {
        schemaVersion: 1,
        caseId: v.truth.caseId,
        truthHash: hashCaseTruth(v.truth),
        literals: [
          ...CANDIDATES.map((person) => ({ claim: actor(person), value: person === "lina" })),
          { claim: { kind: "personResponsibleForEvent", personId: "person:lina", eventId: "event:e04" }, value: true },
        ],
      },
      v.truth,
    );
    expect(evaluateChallengeAccusation(v.truth, v.solution, v.challenge, accusation)).toEqual({ success: true, verdict: "not_solved" });
  });
});

describe("Die leere Vitrine: headless investigation", () => {
  it("S0 matches the initial setup: 11 entities, nothing discovered", () => {
    const host = vitrineHost(v);
    expect(host.known()).toHaveLength(11);
    expect(host.discovered()).toEqual([]);
    expect(host.knows("item", "item:kamera")).toBe(false);
    expect(host.knows("item", "item:terminal")).toBe(false);
  });

  it("Route A (Hof first) releases d03, camera, d04, terminal, d05 in order", () => {
    const host = vitrineHost(v);
    const ids = (observations: { evidence: string }[]) => observations.map((o) => o.evidence);

    expect(host.canAsk("nora", q("q08"))).toBe(false);
    expect(ids(host.search("location:hof"))).toEqual([v.translator.refFor("evidence", "evidence:d03")]);
    expect(host.knows("event", "event:e05")).toBe(true);

    expect(host.canInvestigate({ kind: "examine_item", itemId: "item:kamera" } as any)).toBe(false);
    const q08 = host.ask("nora", q("q08"));
    expect(q08).toMatchObject({ act: "answer", stance: "affirms" });
    expect(host.knows("item", "item:kamera")).toBe(true);
    expect(ids(host.examine("item:kamera"))).toEqual([v.translator.refFor("evidence", "evidence:d04")]);

    expect(host.ask("oskar", q("q14"))).toMatchObject({ act: "answer", stance: "affirms" });
    expect(host.knows("item", "item:terminal")).toBe(true);
    expect(ids(host.examine("item:terminal"))).toEqual([v.translator.refFor("evidence", "evidence:d05")]);
    expect(host.discovered()).toEqual(["evidence:d03", "evidence:d04", "evidence:d05"]);
  });

  it("Route B (terminal first) reaches the same three cards", () => {
    const host = vitrineHost(v);
    host.ask("oskar", q("q14"));
    host.examine("item:terminal");
    host.search("location:hof");
    host.ask("nora", q("q08"));
    host.examine("item:kamera");
    expect(host.discovered().sort()).toEqual(["evidence:d03", "evidence:d04", "evidence:d05"]);
  });

  it("exhaustive exploration from S0 releases all eight cards", () => {
    const host = vitrineHost(v);
    explore(host);
    expect(host.discovered().sort()).toEqual(v.truth.evidence.map((e) => e.id).sort());
  });

  it("q05 is a negative control: Max does not know and reveals nothing", () => {
    const host = vitrineHost(v);
    const before = host.known().length;
    expect(host.ask("max", q("q05"))).toMatchObject({ act: "answer", stance: "does_not_know" });
    expect(host.known()).toHaveLength(before);
  });

  it("q12: Oskar affirms a claim that is objectively false (belief, not knowledge)", () => {
    const host = vitrineHost(v);
    const answer = host.ask("oskar", q("q12"));
    expect(answer).toMatchObject({ act: "answer", stance: "affirms", statement: { kind: "personAt", at: 240 } });
  });

  it("Lina declines q16 and q20 without stance", () => {
    const host = vitrineHost(v);
    for (const n of ["q16", "q20"]) expect(host.ask("lina", q(n))).toEqual({ schemaVersion: 1, npc: v.translator.refFor("person", "person:lina"), questionId: q(n), act: "decline" });
  });

  it("answers are deterministic and leak no internal id", () => {
    const run = () => {
      const host = vitrineHost(v);
      explore(host);
      return VITRINE_NPCS.flatMap((npc) => QUESTIONS[npc].map((n) => host.ask(npc, q(n))));
    };
    const first = JSON.stringify(run());
    expect(JSON.stringify(run())).toBe(first);
    expect(first).not.toMatch(/(person|location|item|event|evidence|proposition):[a-z]/);
  });

  it("released evidence cards carry PlayerRefs only and keep the authored text", () => {
    for (const entry of v.presentation.entries) {
      const release = releaseEvidence(v.presentation, entry.evidenceId, v.translator);
      expect(release.success).toBe(true);
      if (!release.success) continue;
      expect(release.observation.text).toBe(entry.text);
      expect(JSON.stringify(release.observation)).not.toMatch(/"(person|location|item|event|evidence):[a-z]/);
    }
  });
});
