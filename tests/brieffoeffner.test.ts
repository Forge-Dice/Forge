import { describe, expect, it } from "vitest";
import { validateCaseSemantics } from "../src/domain/case-semantics.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import { hashCaseSolution } from "../src/domain/case-solution.identity.ts";
import { parseEvidenceAccessMap } from "../src/domain/evidence-access.ts";
import { parseEvidencePresentation } from "../src/domain/evidence-presentation.ts";
import { parseInterrogationProfile, parseQuestionCatalogue } from "../src/domain/interrogation-authoring.ts";
import { parseNpcKnowledge } from "../src/domain/npc-knowledge.ts";
import { parseAccusationChallenge } from "../src/domain/accusation-challenge.ts";
import { checkCaseSolvability, type WitnessReplay } from "../src/domain/case-solvability.ts";
import { initialSession, reduceSession, replaySession, type SessionState } from "../src/domain/case-session.ts";
import { loadPlayPackage } from "../src/play/cases.ts";
import { fullCase } from "./case-truth.fixture.ts";
import {
  BRIEF,
  briefProofProfile,
  briefRaw,
  briefReleaseHash,
  briefReleaseManifest,
  briefSolution,
  briefTruth,
  briefWitness,
  resolveBriefPackage,
} from "./brieffoeffner.fixture.ts";

const truth = briefTruth();
const solution = briefSolution(truth);
const pkg = resolveBriefPackage();
const r = (kind: "person" | "location" | "item" | "event", id: string) => pkg.refs.refFor(kind, `${kind}:${id}`)!;

describe("Der Brieföffner: components with the real parsers", () => {
  it("truth is fullCase() revision 4 with exactly the roadmap changes, and semantically clean", () => {
    const original = fullCase();
    const input = briefRaw("truth.json") as ReturnType<typeof fullCase>;
    expect(input.revision).toBe(4);
    for (const key of ["persons", "locations", "items", "relationships", "events", "motives", "propositions", "secrets", "redHerrings"] as const) {
      expect(input[key], key).toEqual(original[key]);
    }
    const byId = (list: { id: string }[]) => Object.fromEntries(list.map((e) => [e.id, e]));
    const before = byId(original.evidence);
    const after = byId(input.evidence);
    expect(Object.keys(after).sort()).toEqual(["evidence:cuff-button", "evidence:fingerprint", "evidence:gloves-dirty", "evidence:muddy-path"]);
    expect(after["evidence:fingerprint"]).toEqual(before["evidence:fingerprint"]);
    expect(after["evidence:muddy-path"]).toEqual(before["evidence:muddy-path"]);
    expect(after["evidence:gloves-dirty"]).toEqual({ ...before["evidence:gloves-dirty"], source: { kind: "item", id: "item:gloves" } });
    expect(validateCaseSemantics(truth).findings).toEqual([]);
  });

  it("every component parses and is bound to this truth and solution", () => {
    const catalogue = parseQuestionCatalogue(briefRaw("questions.json"), truth);
    expect(parseEvidenceAccessMap(briefRaw("evidence-access.json"), truth).entries).toHaveLength(4);
    expect(parseEvidencePresentation(briefRaw("evidence-presentation.json"), truth).entries).toHaveLength(4);
    for (const npc of BRIEF.npcs) {
      expect(parseInterrogationProfile(briefRaw(`interrogation-${npc}.json`), truth, catalogue).npcId).toBe(`person:${npc}`);
      expect(parseNpcKnowledge(briefRaw(`npc-${npc}.json`), truth, solution).solutionHash).toBe(hashCaseSolution(solution));
    }
    expect(parseAccusationChallenge(briefRaw("challenge.json"), truth, solution).allowedClaims).toHaveLength(3);
    expect(pkg.refs.truthHash).toBe(hashCaseTruth(truth));
  });

  it("the play package is the same package without proof", () => {
    const play = loadPlayPackage("brieföffner");
    expect(play.proof).toBeNull();
    expect(pkg.proof!.releaseHash).toBe(briefReleaseHash());
    expect(play.identity.packageHash).not.toBe(pkg.identity.packageHash);
  });
});

describe("Der Brieföffner: solvability with the real witness", () => {
  const profile = briefProofProfile();
  const check = (witnessStepIds: string[], port: WitnessReplay = briefWitness(pkg)) =>
    checkCaseSolvability(truth, solution, briefProofProfile({ witnessStepIds }), port);
  const codes = (report: { findings: readonly { code: string }[] }) => [...new Set(report.findings.map((f) => f.code))].sort();

  it("the manifest binds to the real release context; the profile to the real release hash", () => {
    expect(profile.bindings.releaseHash).toBe(briefReleaseHash());
    expect(pkg.proof!.profile.bindings.releaseHash).toBe(profile.bindings.releaseHash);
    expect(briefReleaseManifest().releaseContextHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("PASS: both required literals derived from released cards, one answer vector, no findings", () => {
    expect(checkCaseSolvability(truth, solution, profile, briefWitness(pkg))).toEqual({
      status: "pass",
      findings: [],
      survivingAnswerCount: 1,
      competingAnswerSamples: [],
    });
  });

  it("the garden first passes as well", () => {
    expect(check(["search-garden", "search-library"]).status).toBe("pass");
  });

  it("without the library Ben stays open; without the garden Anna stays open", () => {
    for (const [steps, open] of [[["search-garden"], 2], [["search-library"], 2], [[], 4]] as const) {
      const report = check([...steps]);
      expect(report.status).toBe("fail");
      expect(report.survivingAnswerCount).toBe(open);
      expect(codes(report)).toContain("REQUIRED_NOT_DERIVED");
    }
  });

  it("an unknown step or a step the session rejects is an invalid witness", () => {
    expect(codes(check(["search-library", "search-cellar"]))).toEqual(["INVALID_WITNESS"]);
    const manifest = briefReleaseManifest();
    manifest.certificateData.steps.push({ stepId: "read-gloves", event: { type: "investigate", action: "examine_item", target: r("item", "gloves") } });
    expect(codes(check(["read-gloves", "search-library", "search-garden"], briefWitness(pkg, manifest)))).toEqual(["INVALID_WITNESS"]);
  });
});

describe("Der Brieföffner: played through the real session", () => {
  const event = {
    search: (id: string) => ({ type: "investigate", action: "search_location", target: r("location", id) }),
    examine: (id: string) => ({ type: "investigate", action: "examine_item", target: r("item", id) }),
    ask: (npc: string, q: string) => ({ type: "interrogate", npc: r("person", npc), questionId: `question:${q}` }),
    accuse: (who: string) => ({
      type: "accuse",
      literals: ["anna", "ben", "clara"].map((p) => ({
        claim: { kind: "personResponsibleForEvent", person: r("person", p), event: r("event", "murder") },
        value: p === who,
      })),
    }),
  };
  const play = (inputs: unknown[]): SessionState =>
    inputs.reduce<SessionState>((state, input, i) => {
      const result = reduceSession(pkg, state, input);
      if (!result.ok) throw new Error(`event ${i}: ${result.code}`);
      return result.state;
    }, initialSession(pkg));
  const verdict = (state: SessionState) => state.verdicts.at(-1)?.verdict;

  it("the gloves are unknown until the garden is searched; the fingerprint is a red herring", () => {
    expect(reduceSession(pkg, initialSession(pkg), event.examine("gloves"))).toMatchObject({ ok: false, code: "ACTION_UNAVAILABLE" });
    const state = play([event.search("garden"), event.examine("gloves"), event.examine("letter-opener")]);
    expect(state.knowledge.discoveries).toHaveLength(3);
    expect(verdict(play([event.examine("letter-opener"), event.accuse("anna")]))).toBe("not_solved");
  });

  it("exactly Ben solves; Anna and Clara do not", () => {
    expect(["anna", "ben", "clara"].map((p) => verdict(play([event.accuse(p)])))).toEqual(["not_solved", "solved", "not_solved"]);
  });

  it("Ben does not lie: every stated answer of his agrees with the truth", () => {
    const state = play([event.search("library"), event.search("garden"), ...["q01", "q02", "q03", "q04"].map((q) => event.ask("ben", q))]);
    const answers = state.knowledge.observations.filter((o) => o.source.kind === "npc").map((o) => o.observation as any);
    expect(answers.map((a) => a.act === "decline" ? "decline" : a.stance)).toEqual(["decline", "denies", "decline", "affirms"]);
    const truthOf = (q: string) => truth.propositions.find((p) => JSON.stringify(Object.entries(p.claim).sort()) === JSON.stringify(Object.entries(claimOf(q)).sort()))?.truth;
    const claimOf = (q: string) => (briefRaw("interrogation-ben.json") as any).rules.find((x: any) => x.questionId === `question:${q}`).claim;
    expect(truthOf("q02")).toBe(false);
    expect(truthOf("q04")).toBe(true);
  });

  it("the full walkthrough replays to the same state", () => {
    const log = [
      event.search("library"), event.examine("letter-opener"), event.search("garden"), event.examine("gloves"),
      event.ask("ben", "q01"), event.ask("ben", "q02"), event.ask("anna", "q04"), event.ask("anna", "q01"), event.ask("ben", "q04"),
      event.accuse("ben"),
    ];
    const state = play(log);
    expect(state.phase).toBe("solved");
    expect(replaySession(pkg, log)).toEqual({ ok: true, state });
  });
});
