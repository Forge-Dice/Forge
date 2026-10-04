import { describe, expect, it } from "vitest";
import { checkCaseSolvability, type WitnessReplay } from "../src/domain/case-solvability.ts";
import { checkCaseRoutes } from "../src/domain/case-routes.ts";
import {
  loadVitrine,
  loadVitrineProofProfile,
  resolveVitrinePackage,
  vitrineReleaseContextHash,
  vitrineReleaseHash,
  vitrineReleaseManifest,
  vitrineWitness,
} from "./vitrine.fixture.ts";

// "Die leere Vitrine" against MYST-SOLVABILITY-0001 with a witness port that replays the steps on the
// real investigation, release and interrogation functions (no stub). releaseHash and releaseContextHash
// are the real forge-release-proof-v1 bindings computed by MYST-SESSION-0001A.

const v = loadVitrine();
const profile = loadVitrineProofProfile(v);
const ROUTE_A = ["search-hof", "ask-nora-photo", "read-camera", "ask-oskar-record", "read-terminal"];
const ROUTE_B = ["ask-oskar-record", "read-terminal", "search-hof", "ask-nora-photo", "read-camera"];
const check = (witnessStepIds: string[], port: WitnessReplay = vitrineWitness(v)) =>
  checkCaseSolvability(v.truth, v.solution, loadVitrineProofProfile(v, { witnessStepIds }), port);
const codes = (report: { findings: readonly { code: string }[] }) => [...new Set(report.findings.map((f) => f.code))].sort();

describe("Die leere Vitrine: solvability with the real witness", () => {
  it("the authored proof profile parses with the real parser and binds Route A", () => {
    expect(profile.bindings.releaseHash).toBe(vitrineReleaseHash(v));
    expect(profile.witnessStepIds).toEqual(ROUTE_A);
    expect(profile.answerScope).toHaveLength(4);
  });

  it("the proof binds to the real release manifest and release context of the resolved package", () => {
    expect(vitrineReleaseManifest(v).releaseContextHash).toBe(vitrineReleaseContextHash());
    const resolution = resolveVitrinePackage(v);
    if (!resolution.ok) throw new Error(JSON.stringify(resolution.findings));
    expect(resolution.package.proof!.releaseHash).toBe(vitrineReleaseHash(v));
    expect(resolution.package.proof!.profile.bindings.releaseHash).toBe(profile.bindings.releaseHash);
  });

  it("Route A replays d03, d04, d05 and releases exactly the eight authored records", () => {
    const replay = vitrineWitness(v)(ROUTE_A);
    expect(replay.success).toBe(true);
    if (!replay.success) return;
    expect(replay.released.map((o) => o.id).sort()).toEqual(profile.observations.map((o) => o.id).sort());
  });

  it("PASS: every required literal derived, exactly one answer vector survives, no findings", () => {
    const report = checkCaseSolvability(v.truth, v.solution, profile, vitrineWitness(v));
    expect(report).toEqual({ status: "pass", findings: [], survivingAnswerCount: 1, competingAnswerSamples: [] });
  });

  it("Route B (terminal first) passes as well", () => {
    expect(check(ROUTE_B).status).toBe("pass");
  });

  it("the release manifest certifies Route A and Route B; checkCaseRoutes replays each on its own", () => {
    const resolution = resolveVitrinePackage(v);
    if (!resolution.ok) throw new Error(JSON.stringify(resolution.findings));
    const routes = resolution.package.proof!.routes;
    expect(routes).toEqual([{ routeId: "witness", stepIds: ROUTE_A }, { routeId: "terminal-zuerst", stepIds: ROUTE_B }]);
    const result = checkCaseRoutes(v.truth, v.solution, profile, routes, vitrineWitness(v));
    expect(result.status).toBe("pass");
    expect(result.routes.map((r) => r.report.survivingAnswerCount)).toEqual([1, 1]);
    const broken = checkCaseRoutes(v.truth, v.solution, profile, [...routes, { routeId: "ohne-terminal", stepIds: ROUTE_A.slice(0, 3) }], vitrineWitness(v));
    expect(broken.status).toBe("fail");
    expect(broken.routes.map((r) => r.report.status)).toEqual(["pass", "pass", "fail"]);
  });

  it("without the terminal Oskar is not excluded: fail, Oskar and Lina stay open (4 vectors)", () => {
    const report = check(ROUTE_A.slice(0, 3));
    expect(report.status).toBe("fail");
    expect(report.survivingAnswerCount).toBe(4);
    expect(codes(report)).toEqual(["AMBIGUITY_POLICY_VIOLATION", "PREMISE_NOT_REACHED", "REQUIRED_AMBIGUOUS", "REQUIRED_NOT_DERIVED", "UNPUBLISHED_RULE"]);
  });

  it("without the camera neither Max nor Nora is excluded (8 vectors)", () => {
    const report = check(ROUTE_A.slice(3));
    expect(report.status).toBe("fail");
    expect(report.survivingAnswerCount).toBe(8);
  });

  it("an empty witness releases nothing and derives nothing", () => {
    const report = check([]);
    expect(report.status).toBe("fail");
    expect(report.survivingAnswerCount).toBe(16);
  });

  it("asking Nora for the film before the Hof is searched is an invalid witness", () => {
    const report = check(["ask-nora-photo", "search-hof", "read-camera", "ask-oskar-record", "read-terminal"]);
    expect(report.status).toBe("fail");
    expect(codes(report)).toEqual(["INVALID_WITNESS"]);
  });

  it("reading the camera before Nora reveals it is an invalid witness", () => {
    expect(codes(check(["search-hof", "read-camera", "ask-nora-photo", "ask-oskar-record", "read-terminal"]))).toEqual(["INVALID_WITNESS"]);
  });

  it("an unknown step id is an invalid witness", () => {
    expect(codes(check([...ROUTE_A, "read-medal"]))).toEqual(["INVALID_WITNESS"]);
  });

  it("repeating a step changes nothing", () => {
    expect(check([...ROUTE_A, "read-terminal", "search-hof"]).status).toBe("pass");
  });

  it("a throwing port is unknown, never pass", () => {
    const report = check(ROUTE_A, () => {
      throw new Error("adapter down");
    });
    expect(report.status).toBe("unknown");
    expect(codes(report)).toEqual(["REPLAY_UNAVAILABLE"]);
  });

  it("a port bound to another release fails on binding", () => {
    const port: WitnessReplay = (steps) => {
      const result = vitrineWitness(v)(steps);
      return result.success ? { ...result, bindings: { ...result.bindings, releaseHash: "0".repeat(64) } } : result;
    };
    expect(codes(check(ROUTE_A, port))).toEqual(["BINDING_MISMATCH"]);
  });

});
