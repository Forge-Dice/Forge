import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { PLAY_CASES, loadFolderPackage, loadPlayPackage } from "../src/play/cases.ts";
import { MAX_ACTIONS, actionsToSolve, playtestCase, proofFindIds, type Run } from "../src/play/playtest.ts";
import { memoFrozen } from "../src/domain/frozen-memo.ts";

// Review fixes of the playtest bot: metrics, salt independence, finds the proof uses, CLI input.

const FIXTURES = new URL("./fixtures/", import.meta.url).pathname;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const run = (style: Run["style"], actions: number, solved = true): Run =>
  ({ style, seed: 1, solved, actions, hints: 0, wrongAccusations: 0, deadEnds: 0, readyAfter: null, finds: 0, accused: {} }) as Run;

describe("actions to solve", () => {
  it("is the median of the per-style medians: the deterministic style does not fill half the samples", () => {
    const report = playtestCase(loadPlayPackage("geige"), 3);
    const of = (style: Run["style"]) => report.runs.filter((r) => r.style === style).map((r) => r.actions);
    expect(report.metrics.actionsToSolve).toBe(median([median(of("systematisch")), median(of("neugierig"))]));
  });

  it("counts an unsolved run as MAX_ACTIONS instead of dropping it", () => {
    expect(actionsToSolve([run("systematisch", 10, false), run("neugierig", 20, false)])).toBe(MAX_ACTIONS);
    expect(actionsToSolve([run("systematisch", 10), run("neugierig", 20, false), run("neugierig", 30, false), run("neugierig", 4)])).toBe((10 + MAX_ACTIONS) / 2);
  });
});

describe("salt independence", () => {
  it("the same case plays and rates the same under another salt", { timeout: 60_000 }, () => {
    const c = PLAY_CASES.geige;
    const a = loadFolderPackage(`${FIXTURES}${c.dir}`, c.npcs, c.salt);
    const b = loadFolderPackage(`${FIXTURES}${c.dir}`, c.npcs, "0123456789abcdef0123456789abcdef");
    const ra = playtestCase(a, 2);
    const rb = playtestCase(b, 2);
    expect(rb.runs).toEqual(ra.runs);
    expect(rb.metrics).toEqual(ra.metrics);
  });

  it("check-case plays the default number of seeds", { timeout: 120_000 }, () => {
    const out = spawnSync(process.execPath, ["--experimental-transform-types", "--no-warnings", "src/authoring/check-case-cli.ts", `${FIXTURES}geige`], { encoding: "utf8" });
    expect(out.stdout).toContain("Spieltest (8 Läufe je Spielstil)");
  });
});

describe("finds the proof uses", () => {
  it("evidence held against someone in a witness confrontation counts", () => {
    const p = loadPlayPackage("brieföffner");
    // Without the profile's cited cards and nodes only the witness confrontation names the cuff button.
    const bare = { ...p, proof: { ...p.proof!, profile: { ...p.proof!.profile, nodes: [], observations: [] } } } as typeof p;
    expect([...proofFindIds(bare)]).toEqual(["evidence:cuff-button"]);
  });
});

describe("playtest CLI", () => {
  it("rejects a malformed --seeds value", () => {
    const out = spawnSync(process.execPath, ["--experimental-transform-types", "--no-warnings", "src/play/playtest-cli.ts", "geige", "--seeds", "1x"], { encoding: "utf8" });
    expect(out.status).toBe(2);
    expect(out.stdout).toContain("Aufruf:");
  });
});

describe("memoFrozen", () => {
  it("passes primitives through without caching", () => {
    const f = memoFrozen((v: object) => typeof v);
    expect(f("x" as unknown as object)).toBe("string");
    expect(f(Object.freeze({}))).toBe("object");
  });
});
