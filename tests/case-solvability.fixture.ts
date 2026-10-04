// Fixtures for MYST-SOLVABILITY-0001 on the library case of tests/npc-knowledge.fixture.ts
// (Ben kills Clara in the library; Anna is in the garden). Factories return fresh objects.
// The witness port here is a STUB of the future release/replay adapter: a PASS with it is
// no evidence for a real playthrough (contract §0, AC-10).

import { parseCaseTruth, type CaseTruth } from "../src/domain/case-truth.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import { parseCaseSolution, type CaseSolution } from "../src/domain/case-solution.ts";
import { hashCaseSolution } from "../src/domain/case-solution.identity.ts";
import type { WitnessReplay, WitnessReplayResult } from "../src/domain/case-solvability.ts";
import { truthInput } from "./npc-knowledge.fixture.ts";

export const RELEASE_HASH = "a".repeat(64);
const KILLS = "event:ben-kills-clara";

export const resp = (person: string) => ({ kind: "personResponsibleForEvent", personId: `person:${person}`, eventId: KILLS });

/** Answer key: Ben is the only (complete) direct actor; intended, ordinary, caused by the argument. */
export function solutionInput(truthHash: string, completeness: "complete" | "partial" = "complete", required?: object[]): any {
  return {
    schemaVersion: 1,
    caseId: "case:library",
    revision: 1,
    truthHash,
    resolutions: [
      {
        eventId: KILLS,
        targets: [{ kind: "person", id: "person:clara" }],
        responsibility: { completeness, assignments: [{ personId: "person:ben", roles: ["direct_actor"] }] },
        intent: "intended",
        mechanism: "ordinary",
        causesComplete: true,
      },
    ],
    conclusions: [
      { id: "conclusion:anna-responsible", claim: resp("anna") },
      { id: "conclusion:ben-responsible", claim: resp("ben") },
      { id: "conclusion:clara-responsible", claim: resp("clara") },
      { id: "conclusion:dora-responsible", claim: resp("dora") },
      { id: "conclusion:nobody-responsible", claim: { kind: "noPersonResponsibleForEvent", eventId: KILLS } },
      { id: "conclusion:ben-actor", claim: { kind: "personRoleForEvent", personId: "person:ben", eventId: KILLS, role: "direct_actor" } },
      { id: "conclusion:ben-planner", claim: { kind: "personRoleForEvent", personId: "person:ben", eventId: KILLS, role: "planner" } },
      { id: "conclusion:intended", claim: { kind: "eventIntent", eventId: KILLS, value: "intended" } },
      { id: "conclusion:ordinary", claim: { kind: "eventMechanism", eventId: KILLS, value: "ordinary" } },
      { id: "conclusion:argument-caused", claim: { kind: "eventCausedEvent", causeEventId: "event:argument", eventId: KILLS } },
    ],
    requiredConclusions: required ?? [{ conclusionId: "conclusion:ben-responsible", value: true }],
  };
}

export type World = { truth: CaseTruth; solution: CaseSolution };

export function world(
  options: {
    completeness?: "complete" | "partial";
    required?: object[];
    editTruth?: (t: any) => void;
    editSolution?: (s: any) => void;
  } = {},
): World {
  const input = truthInput();
  options.editTruth?.(input);
  const truth = parseCaseTruth(input);
  const solution = solutionInput(hashCaseTruth(truth), options.completeness, options.required);
  options.editSolution?.(solution);
  return { truth, solution: parseCaseSolution(solution, truth) };
}

export function bindings(w: World) {
  return { caseId: "case:library", truthHash: hashCaseTruth(w.truth), solutionHash: hashCaseSolution(w.solution), releaseHash: RELEASE_HASH };
}

export const prop = (id: string, value: boolean) => ({ kind: "proposition", propositionId: `proposition:${id}`, value });
export const concl = (id: string, value: boolean) => ({ kind: "conclusion", conclusionId: `conclusion:${id}`, value });

/** One licensed implication: observed premises (proposition short IDs) yield a conclusion literal. */
export type PathSpec = { conclusion: string; value: boolean; premises: string[] };

export type ProfileSpec = {
  scope?: string[];
  policy?: "must_disambiguate" | "may_remain_ambiguous";
  question?: object;
  paths?: PathSpec[];
  /** Premise short IDs that are authored but never released by the witness. */
  unreleased?: string[];
};

/**
 * Builds a profile from proof paths. Each premise p becomes OBSERVED obs:p (canonical truth
 * value, released by witness step "step:obs:p") and literal node node:p. Each path i becomes
 * edge:i to node:<conclusion>-<value>, licensed by the single PUBLIC_RULE catalog obs:rules.
 */
export function buildProfile(w: World, spec: ProfileSpec = {}): any {
  const paths = spec.paths ?? [{ conclusion: "ben-responsible", value: true, premises: ["ben-in-killing", "knife-used"] }];
  const premises = [...new Set(paths.flatMap((p) => p.premises))];
  const truthOf = (id: string) => w.truth.propositions.find((p) => p.id === `proposition:${id}`)!.truth;
  const targetId = (p: PathSpec) => `node:${p.conclusion}-${p.value}`;
  const targets = [...new Set(paths.map(targetId))];
  return {
    schemaVersion: 1,
    bindings: bindings(w),
    answerScope: (spec.scope ?? ["ben-responsible"]).map((id) => `conclusion:${id}`),
    ambiguityPolicy: spec.policy ?? "must_disambiguate",
    question: spec.question ?? { kind: "required_literals" },
    observations: [
      ...premises.map((p) => ({ id: `obs:${p}`, kind: "OBSERVED", literal: prop(p, truthOf(p)), source: { kind: "initial" } })),
      {
        id: "obs:rules",
        kind: "PUBLIC_RULE",
        rules: paths.map((p, i) => ({ edgeId: `edge:${i}`, allOf: p.premises.map((q) => `node:${q}`), yields: concl(p.conclusion, p.value) })),
      },
    ],
    nodes: [
      ...premises.map((p) => ({ id: `node:${p}`, kind: "literal", literal: prop(p, truthOf(p)) })),
      { id: "node:rules", kind: "observation", observationId: "obs:rules" },
      ...targets.map((id) => {
        const p = paths.find((q) => targetId(q) === id)!;
        return { id, kind: "literal", literal: concl(p.conclusion, p.value) };
      }),
    ],
    edges: paths.map((p, i) => ({ id: `edge:${i}`, allOf: [...p.premises.map((q) => `node:${q}`), "node:rules"], to: targetId(p), license: "node:rules" })),
    witnessStepIds: [...premises.filter((p) => !(spec.unreleased ?? []).includes(p)).map((p) => `step:obs:${p}`), "step:obs:rules"],
  };
}

export type StepSpec = { releases: string[]; requires?: string[]; excludes?: string[] };

/**
 * Stub witness port over a step catalog. Default catalog: "step:<observationId>" releases that
 * observation. Unknown steps, missing prerequisites (order matters) and excluded combinations
 * are INVALID_WITNESS. Records are copied from the authorized profile catalog.
 */
export function stubPort(profile: any, extraSteps: Record<string, StepSpec> = {}, overrideBindings?: object): WitnessReplay & { calls: string[][] } {
  const steps: Record<string, StepSpec> = Object.fromEntries(profile.observations.map((o: any) => [`step:${o.id}`, { releases: [o.id] }]));
  Object.assign(steps, extraSteps);
  const calls: string[][] = [];
  const port = (ordered: readonly string[]): WitnessReplayResult => {
    calls.push([...ordered]);
    const done: string[] = [];
    const released: any[] = [];
    for (const step of ordered) {
      const spec = steps[step];
      if (spec === undefined) return { success: false, code: "INVALID_WITNESS" };
      if ((spec.requires ?? []).some((r) => !done.includes(r))) return { success: false, code: "INVALID_WITNESS" };
      if ((spec.excludes ?? []).some((x) => done.includes(x))) return { success: false, code: "INVALID_WITNESS" };
      done.push(step);
      for (const id of spec.releases) released.push(structuredClone(profile.observations.find((o: any) => o.id === id)));
    }
    return { success: true, bindings: (overrideBindings ?? profile.bindings) as never, released };
  };
  return Object.assign(port, { calls });
}

/** Seeded PRNG for property tests only (mulberry32). Never used in production code. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
