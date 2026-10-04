import { describe, expect, it } from "vitest";
import { PLAY_CASES, caseListText, loadFolderPackage, loadPlayPackage, type PlayCaseName } from "../src/play/cases.ts";
import { DEFAULT_SEEDS, STYLES, deductionOracle, difficulty, formatPlaytest, playRun, playtestCase } from "../src/play/playtest.ts";
import { createWebHandler } from "../src/play/web.ts";
import { difficultyDots, difficultyText } from "../src/play/difficulty.ts";
import { memoFrozen } from "../src/domain/frozen-memo.ts";
import { checkCaseFolder } from "../src/authoring/check-case.ts";

// Playtest bot: simulated players over the real session, the difficulty derived from their runs,
// balance warnings, and where the rating shows (cases.ts, CLI list, web case picker, check-case).

const NAMES = Object.keys(PLAY_CASES) as PlayCaseName[];
const pkgs = new Map(NAMES.map((name) => [name, loadPlayPackage(name)]));
const pkg = (name: PlayCaseName) => pkgs.get(name)!;
const FIXTURES = new URL("./fixtures/", import.meta.url).pathname;

describe("deduction oracle", () => {
  it("proves nothing at the start and the answer after the certified witness", { timeout: 60_000 }, () => {
    for (const name of NAMES) {
      const p = pkg(name);
      const proves = deductionOracle(p);
      const manifest = JSON.parse(p.proof!.releaseManifest) as { certificateData: { steps: { stepId: string; event: unknown }[] } };
      const events = p.proof!.profile.witnessStepIds.map((id) => manifest.certificateData.steps.find((s) => s.stepId === id)!.event);
      expect(proves([]), name).toBe(false);
      expect(proves(events), name).toBe(true);
    }
  });

  it("is false for a package without a bound proof", () => {
    expect(deductionOracle({ ...pkg("geige"), proof: null })([])).toBe(false);
  });
});

describe("playRun", () => {
  it("is deterministic per seed and differs between seeds for the random styles", () => {
    const p = pkg("geige");
    expect(playRun(p, "neugierig", 3)).toEqual(playRun(p, "neugierig", 3));
    const runs = [1, 2, 3, 4, 5].map((seed) => playRun(p, "neugierig", seed).actions);
    expect(new Set(runs).size).toBeGreaterThan(1);
  });

  it("every style except the hasty one solves every case, and only after its knowledge proves the answer", { timeout: 60_000 }, () => {
    for (const name of NAMES) {
      const proves = deductionOracle(pkg(name));
      for (const style of STYLES.filter((s) => s !== "voreilig")) {
        const run = playRun(pkg(name), style, 1, proves);
        expect(run.solved, `${name} ${style}`).toBe(true);
        expect(run.readyAfter, `${name} ${style}`).not.toBeNull();
        expect(run.wrongAccusations).toBe(0);
        // The solving accusation is the action right after the proof became complete.
        expect(run.actions).toBe(run.readyAfter! + 1);
      }
    }
  });

  it("the hasty player accuses wrongly only persons who are not the answer, each at most once", { timeout: 60_000 }, () => {
    for (const name of NAMES) {
      const answers = new Set<string>(pkg(name).solution.resolutions.flatMap((r) => r.responsibility.assignments.map((a) => a.personId)));
      for (const seed of [1, 2, 3]) {
        const run = playRun(pkg(name), "voreilig", seed);
        expect(run.solved).toBe(true);
        expect(Object.values(run.accused).every((n) => n === 1)).toBe(true);
        expect(Object.keys(run.accused).some((id) => answers.has(id))).toBe(false);
        expect(Object.keys(run.accused)).toHaveLength(run.wrongAccusations);
      }
    }
  });

  it("the hint player takes hints and follows them to the solution", () => {
    const run = playRun(pkg("vitrine"), "hinweise", 1);
    expect(run.solved).toBe(true);
    expect(run.hints).toBeGreaterThan(0);
  });
});

describe("rating", () => {
  it("fixed thresholds from effort, traps, friction and help", () => {
    expect(difficulty({ actionsToSolve: 3, wrongAccusations: 0, deadEndRate: 0.2, hints: 2 })).toBe(1);
    expect(difficulty({ actionsToSolve: 10, wrongAccusations: 1, deadEndRate: 0.3, hints: 4 })).toBe(2);
    expect(difficulty({ actionsToSolve: 14, wrongAccusations: 1, deadEndRate: 0.4, hints: 7 })).toBe(3);
    expect(difficulty({ actionsToSolve: 20, wrongAccusations: 1, deadEndRate: 0.5, hints: 12 })).toBe(4);
    expect(difficulty({ actionsToSolve: 40, wrongAccusations: 2, deadEndRate: 0.5, hints: 12 })).toBe(5);
  });

  it("playtestCase is deterministic", () => {
    expect(playtestCase(pkg("brieföffner"), 2)).toEqual(playtestCase(pkg("brieföffner"), 2));
  });

  it("the difficulty stored in cases.ts is the measured one (npm run playtest prints the value to enter)", { timeout: 120_000 }, () => {
    for (const name of NAMES) {
      expect(PLAY_CASES[name].difficulty, name).toBe(playtestCase(pkg(name), DEFAULT_SEEDS).rating);
    }
  });

  it("finds: needed ones are cited by the proof, never more than available", { timeout: 60_000 }, () => {
    for (const name of NAMES) {
      const { metrics } = playtestCase(pkg(name), 1);
      expect(metrics.findsNeeded).toBeGreaterThan(0);
      expect(metrics.findsNeeded).toBeLessThanOrEqual(metrics.findsAvailable);
    }
  });
});

describe("balance warnings", () => {
  const brief = playtestCase(pkg("brieföffner"), 2);

  it("Der Brieföffner (revision 5): the butler pulls wrong accusations, the proof needs the confrontation", () => {
    expect(brief.warnings.some((w) => w.includes("zu früh"))).toBe(false);
    expect(brief.warnings.some((w) => w.includes("nie berührt"))).toBe(false);
    expect(brief.metrics.redHerringPull["person:dorian"]).toBeGreaterThan(0);
    // The cuff button counts: the admission it forces is on the proof.
    expect(brief.warnings).toContain("2 von 5 Funden trägt die Beweiskette nie: Fingerabdruck, Teetablett");
    expect(Math.min(...brief.runs.flatMap((r) => (r.readyAfter === null ? [] : [r.readyAfter])))).toBeGreaterThanOrEqual(5);
  });

  it("the red-herring pull shares add up to one when anyone was wrongly accused", { timeout: 60_000 }, () => {
    for (const name of NAMES) {
      const { metrics } = playtestCase(pkg(name), 2);
      const total = Object.values(metrics.redHerringPull).reduce((a, b) => a + b, 0);
      if (metrics.wrongAccusations > 0) expect(Math.abs(total - 1)).toBeLessThan(0.05);
    }
  });

  it("the text report names the rating and prints every warning as a hint", () => {
    const text = formatPlaytest(pkg("brieföffner"), brief);
    expect(text).toContain(`Schwierigkeit: ${difficultyText(brief.rating)} (${brief.rating}/5)`);
    for (const w of brief.warnings) expect(text).toContain(`Hinweis Spieltest: ${w}`);
    expect(text).not.toMatch(/(person|evidence|event|item|location):[a-z]/);
  });
});

describe("where the rating shows", () => {
  it("dots and names", () => {
    expect(difficultyDots(3)).toBe("●●●○○");
    expect(difficultyText(1)).toBe("●○○○○ sehr leicht");
  });

  it("CLI case list", () => {
    const text = caseListText();
    for (const [name, c] of Object.entries(PLAY_CASES)) expect(text).toContain(`${name.padEnd(12)} ${difficultyText(c.difficulty!)}`);
  });

  it("web case picker shows every case's difficulty", async () => {
    const out = await createWebHandler(Object.fromEntries(pkgs))("GET", "/", async () => null);
    for (const c of Object.values(PLAY_CASES)) {
      expect(out.body).toContain(`title="Schwierigkeit ${c.difficulty} von 5"`);
    }
    expect(out.body).toContain('<span class="visually-hidden">Schwierigkeit: </span><span class="dots" aria-hidden="true">●●●●○</span> schwer');
  });

  it("check-case: a valid folder loads as a playable package for the playtest", () => {
    const check = checkCaseFolder(`${FIXTURES}geige`);
    expect(check.ok).toBe(true);
    const p = loadFolderPackage(`${FIXTURES}geige`, check.play!.npcs, check.play!.salt);
    expect(p.identity.rulesetVersion).toBe("mystery-session-v3");
    expect(playtestCase(p, 1).rating).toBeGreaterThanOrEqual(1);
  });
});

describe("memoFrozen", () => {
  it("caches deep-frozen values only", () => {
    let calls = 0;
    const size = memoFrozen((o: { xs: number[] }) => (calls++, o.xs.length));
    const frozen = Object.freeze({ xs: Object.freeze([1, 2]) as number[] });
    expect([size(frozen), size(frozen)]).toEqual([2, 2]);
    expect(calls).toBe(1);
    const open = { xs: [1] };
    expect(size(open)).toBe(1);
    open.xs.push(2);
    expect(size(open)).toBe(2);
    const shallow = Object.freeze({ xs: [1] });
    size(shallow);
    shallow.xs.push(2);
    expect(size(shallow)).toBe(2);
  });
});
