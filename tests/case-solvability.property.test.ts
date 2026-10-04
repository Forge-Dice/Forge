import { describe, expect, it } from "vitest";
import { evaluateConclusionClaim } from "../src/domain/case-solution.ts";
import { checkCaseSolvability, parseCaseProofProfile, type SolvabilityReport, type WitnessReplay } from "../src/domain/case-solvability.ts";
import { buildProfile, concl, prop, rng, stubPort, world, type PathSpec } from "./case-solvability.fixture.ts";

// Seeded metamorphic properties (contract §11): 768 configurations, eight properties each.
// Seed base documented here; the generator lives only in tests.
const SEED = 20261004;
const CONFIGURATIONS = 768;

const W = world();
const CONCLUSIONS = W.solution.conclusions.map((c) => c.id.slice("conclusion:".length));
// "ben-seen-in-library" is kept out of the generator pool and used only for added paths.
const PREMISES = ["ben-at-library", "anna-at-library", "ben-in-killing", "anna-in-killing", "knife-used"];
const FRESH = "ben-seen-in-library";
const RANK = { fail: 0, unknown: 1, pass: 2 } as const;

const canonicalOf = (id: string) => {
  const evaluation = evaluateConclusionClaim(W.truth, W.solution, W.solution.conclusions.find((c) => c.id === `conclusion:${id}`)!.claim);
  return evaluation.success && evaluation.status === true;
};

type Config = { scope: string[]; policy: "must_disambiguate" | "may_remain_ambiguous"; paths: PathSpec[]; unreleased: string[] };

function generate(seed: number): Config {
  const random = rng(seed);
  const pick = <T>(values: readonly T[]) => values[Math.floor(random() * values.length)]!;
  const others = CONCLUSIONS.filter((c) => c !== "ben-responsible").sort(() => random() - 0.5);
  const scope = ["ben-responsible", ...others.slice(0, Math.floor(random() * 6))];
  const paths: PathSpec[] = [];
  const count = Math.floor(random() * 6);
  for (let i = 0; i < count; i++) {
    const conclusion = random() < 0.4 ? "ben-responsible" : pick(scope);
    const premises = [...new Set([pick(PREMISES), ...(random() < 0.5 ? [pick(PREMISES)] : [])])];
    const key = JSON.stringify([conclusion, [...premises].sort()]);
    if (!paths.some((p) => JSON.stringify([p.conclusion, [...p.premises].sort()]) === key)) {
      paths.push({ conclusion, value: canonicalOf(conclusion), premises }); // structural duplicates are parse errors
    }
  }
  if (paths.length === 0) paths.push({ conclusion: "ben-responsible", value: true, premises: [pick(PREMISES)] });
  const unreleased = PREMISES.filter(() => random() < 0.25);
  return { scope, policy: random() < 0.5 ? "must_disambiguate" : "may_remain_ambiguous", paths, unreleased };
}

function run(input: any, port: WitnessReplay = stubPort(input)): SolvabilityReport {
  return checkCaseSolvability(W.truth, W.solution, parseCaseProofProfile(input, W.truth, W.solution), port);
}

function shuffled<T>(values: T[], random: () => number): T[] {
  return values.map((v) => [random(), v] as const).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

function withPath(input: any, id: string, premise: string, literal: object, released: boolean) {
  if (!input.observations.some((o: any) => o.id === `obs:${premise}`)) {
    const value = W.truth.propositions.find((p) => p.id === `proposition:${premise}`)!.truth;
    input.observations.unshift({ id: `obs:${premise}`, kind: "OBSERVED", literal: prop(premise, value), source: { kind: "initial" } });
    input.nodes.unshift({ id: `node:${premise}`, kind: "literal", literal: prop(premise, value) });
  }
  if (released && !input.witnessStepIds.includes(`step:obs:${premise}`)) input.witnessStepIds.unshift(`step:obs:${premise}`);
  input.nodes.push({ id: `node:${id}`, kind: "literal", literal });
  input.edges.push({ id: `edge:${id}`, allOf: [`node:${premise}`, "node:rules"], to: `node:${id}`, license: "node:rules" });
  input.observations.find((o: any) => o.id === "obs:rules").rules.push({ edgeId: `edge:${id}`, allOf: [`node:${premise}`], yields: literal });
  return input;
}

describe("MYST-SOLVABILITY-0001 metamorphic properties", () => {
  it(`holds for ${CONFIGURATIONS} seeded configurations (seed ${SEED})`, () => {
    const statuses = { pass: 0, fail: 0, unknown: 0 };
    let checks = 0;
    for (let n = 0; n < CONFIGURATIONS; n++) {
      const config = generate(SEED + n);
      const random = rng(SEED * 7 + n);
      const input = buildProfile(W, config);
      const baseline = run(input);
      statuses[baseline.status]++;
      const context = `seed ${SEED + n}: ${JSON.stringify(config)}`;

      // P1 adding unreached evidence cannot turn fail into pass.
      const unreached = run(withPath(structuredClone(input), "p1", FRESH, concl("ben-responsible", true), false));
      if (baseline.status === "fail") expect(unreached.status, context).toBe("fail");

      // P2 removing a proof path cannot improve solvability.
      if (config.paths.length > 1) {
        const removed = run(buildProfile(W, { ...config, paths: config.paths.slice(1) }));
        expect(RANK[removed.status], context).toBeLessThanOrEqual(RANK[baseline.status]);
      }

      // P3 reordering set-like collections changes nothing.
      const reordered = structuredClone(input);
      reordered.observations = shuffled(reordered.observations, random);
      reordered.nodes = shuffled(reordered.nodes, random);
      reordered.edges = shuffled(reordered.edges, random).map((e: any) => ({ ...e, allOf: shuffled(e.allOf, random) }));
      reordered.answerScope = shuffled(reordered.answerScope, random);
      for (const o of reordered.observations) if (o.kind === "PUBLIC_RULE") o.rules = shuffled(o.rules, random);
      expect(run(reordered, stubPort(input)), context).toEqual(baseline);

      // P4 adding a canonically valid, independent licensed path cannot break a PASS.
      const extra = CONCLUSIONS[n % CONCLUSIONS.length]!;
      const added = run(withPath(structuredClone(input), "p4", FRESH, concl(extra, canonicalOf(extra)), true));
      if (baseline.status === "pass") expect(added.status, context).toBe("pass");

      // P5 circular edges alone never establish a required literal.
      const cyclic = structuredClone(input);
      cyclic.nodes.push({ id: "node:cyc-a", kind: "literal", literal: concl("ben-responsible", true) });
      cyclic.nodes.push({ id: "node:cyc-b", kind: "literal", literal: concl("ben-actor", true) });
      for (const [id, from, to] of [["edge:cyc-1", "node:cyc-a", "node:cyc-b"], ["edge:cyc-2", "node:cyc-b", "node:cyc-a"]] as const) {
        cyclic.edges.push({ id, allOf: [from, "node:rules"], to, license: "node:rules" });
        cyclic.observations.find((o: any) => o.id === "obs:rules").rules.push({ edgeId: id, allOf: [from], yields: cyclic.nodes.find((x: any) => x.id === to).literal });
      }
      const withCycle = run(cyclic);
      const underived = (r: SolvabilityReport) => r.findings.some((f) => f.code === "REQUIRED_NOT_DERIVED");
      expect(underived(withCycle), context).toBe(underived(baseline));
      expect(withCycle.findings.some((f) => f.code === "PROOF_CYCLE" && f.subjectIds.includes("node:cyc-a")), context).toBe(true);

      // P6 a false NPC belief never becomes an objective premise.
      const reported = structuredClone(input);
      reported.observations.push({ id: "obs:false-report", kind: "REPORTED_BY_NPC", npcId: "person:anna", literal: prop("anna-in-killing", true) });
      reported.nodes.push({ id: "node:false-report", kind: "observation", observationId: "obs:false-report" });
      reported.witnessStepIds.unshift("step:obs:false-report");
      expect(run(reported), context).toEqual(baseline);

      // P7 may_remain_ambiguous is never stricter than must_disambiguate.
      const must = run(buildProfile(W, { ...config, policy: "must_disambiguate" }));
      const may = run(buildProfile(W, { ...config, policy: "may_remain_ambiguous" }));
      expect(RANK[may.status], context).toBeGreaterThanOrEqual(RANK[must.status]);

      // P8 reordering released records changes nothing; the witness order itself is kept.
      const port = stubPort(input);
      const shuffledPort: WitnessReplay = (steps) => {
        const result = port(steps);
        return result.success ? { ...result, released: shuffled([...result.released], random) } : result;
      };
      expect(run(input, shuffledPort), context).toEqual(baseline);
      expect(port.calls, context).toEqual([input.witnessStepIds]);

      checks += 8;
    }
    expect(checks).toBeGreaterThanOrEqual(CONFIGURATIONS * 8);
    // Both outcomes really occur.
    expect(statuses.pass).toBeGreaterThan(50);
    expect(statuses.fail).toBeGreaterThan(50);
  }, 120_000);
});
