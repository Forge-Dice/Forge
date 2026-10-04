import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveCasePackage } from "../src/domain/case-package.ts";
import { initialSession, reduceSession, replaySession, type SessionState } from "../src/domain/case-session.ts";
import type { Hint } from "../src/domain/case-hints.ts";
import { PLAY_CASES, loadPlayPackage, playPackageInput, refSource, type PlayCaseName } from "../src/play/cases.ts";
import { accusations, command, hintText, hintsUsed, investigations, loadText, newGame, saveText, type Game } from "../src/play/game.ts";
import { createWebApp } from "../src/play/web.ts";

// Graded hints (ruleset mystery-session-v3): derived from the bound witness and the prefix, never
// naming the culprit or an internal ID, counted in journal and closing, kept by save/load.

const CASES = Object.keys(PLAY_CASES) as PlayCaseName[];
const INTERNAL_ID = /\b(?:case|person|location|item|event|evidence|proposition|conclusion|question|secret|red-herring|rule):[a-z0-9]/;
const PLAYER_REF = /pr1_[0-9a-hjkmnp-tv-z]{16}/;

function hint(game: Game): { game: Game; hint: Hint } {
  const result = reduceSession(game.pkg, game.state, { type: "hint" });
  if (!result.ok || result.output.type !== "hint") throw new Error(`hint rejected: ${JSON.stringify(result)}`);
  return { game: { ...game, state: result.state }, hint: result.output.hint };
}

function apply(game: Game, event: unknown): Game {
  const result = reduceSession(game.pkg, game.state, event);
  if (!result.ok) throw new Error(`rejected ${JSON.stringify(event)}: ${result.code}`);
  return { ...game, state: result.state };
}

/** A player who only follows hints: asks until the hint is concrete, then does exactly that. */
function playByHints(name: PlayCaseName): { game: Game; hints: Hint[]; firstOfStep: Hint[] } {
  const pkg = loadPlayPackage(name);
  let game = newGame(pkg, PLAY_CASES[name].clockOrigin);
  const hints: Hint[] = [];
  const firstOfStep: Hint[] = [];
  let acted = true;
  for (let guard = 0; guard < 200 && game.state.phase === "active"; guard++) {
    const h = hint(game);
    game = h.game;
    hints.push(h.hint);
    if (acted) firstOfStep.push(h.hint);
    acted = false;
    if (h.hint.kind === "accuse") {
      for (const a of accusations(game)) {
        game = apply(game, a.event);
        if (game.state.phase === "solved") break;
      }
      break;
    }
    if (h.hint.kind === "confront" && h.hint.evidence !== null) {
      game = apply(game, { type: "confront", npc: h.hint.target, questionId: h.hint.questionId, evidence: h.hint.evidence });
      acted = true;
    } else if (h.hint.kind === "interrogate" && h.hint.questionId !== null) {
      game = apply(game, { type: "interrogate", npc: h.hint.target, questionId: h.hint.questionId });
      acted = true;
    } else if (h.hint.kind !== "interrogate" && h.hint.kind !== "confront" && h.hint.level >= 2) {
      game = apply(game, { type: "investigate", action: h.hint.kind, target: h.hint.target });
      acted = true;
    }
  }
  return { game, hints, firstOfStep };
}

describe.each(CASES)("hints in %s", (name) => {
  const pkg = loadPlayPackage(name);

  it("the play case runs under v3 with a bound proof", () => {
    expect(pkg.identity.rulesetVersion).toBe("mystery-session-v3");
    expect(pkg.proof).not.toBeNull();
  });

  it("levels rise on the same step (vague, then concrete) and stop at 3", () => {
    let game = newGame(pkg);
    const levels: Hint[] = [];
    for (let i = 0; i < 3; i++) {
      const h = hint(game);
      game = h.game;
      levels.push(h.hint);
    }
    expect(levels.map((h) => h.level)).toEqual([1, 2, 3]);
    expect(levels[0]!.target).toBeNull();
    expect(levels[1]!.target).not.toBeNull();
    expect(new Set(levels.map((h) => `${h.kind}|${h.target ?? levels[1]!.target}`)).size).toBe(1);
    expect(hintsUsed(game)).toBe(3);
    // A hint changes nothing but the event log: no knowledge, no observations.
    expect(game.state.knowledge).toEqual(initialSession(pkg).knowledge);
  });

  it("a player who only follows hints solves the case; every hint points at something already known", () => {
    const { game, hints, firstOfStep } = playByHints(name);
    expect(game.state.phase).toBe("solved");
    expect(hints.at(-1)!.kind).toBe("accuse");
    for (const h of hints) {
      if (h.target !== null) expect(game.state.knowledge.known.some((k) => k.ref === h.target)).toBe(true);
      if (h.level === 1) expect(h.target).toBeNull();
      if (h.questionId !== null) expect(["interrogate", "confront"]).toContain(h.kind);
      if (h.questionId !== null) expect(h.level).toBe(3);
    }
    // After a step is done, the next hint starts vague again.
    expect(firstOfStep.length).toBeGreaterThan(2);
    expect(firstOfStep.every((h) => h.level === 1)).toBe(true);
    expect(command(game, "journal").text).toContain(`Hinweise genutzt: ${hints.length}`);
  });

  it("hint texts never show an internal ID or PlayerRef, and the accusation hint names nobody", () => {
    const { game, hints } = playByHints(name);
    const people = PLAY_CASES[name].npcs.map((n) => pkg.publicContent.labels.find((l) => l.entity.id === `person:${n}`)?.label).filter((l) => l !== undefined);
    for (const h of hints) {
      const text = hintText(game, h);
      expect(text).not.toMatch(INTERNAL_ID);
      expect(text).not.toMatch(PLAYER_REF);
      expect(text).not.toContain("(unbekannt)");
      if (h.kind === "accuse") for (const p of people) expect(text).not.toContain(p);
    }
    for (const level of [1, 2, 3] as const) {
      const text = hintText(game, { level, kind: "accuse", target: null, questionId: null, evidence: null });
      for (const p of people) expect(text).not.toContain(p);
    }
  });

  it("save/load keeps hints: same count, same next hint, replay identical", () => {
    let game = newGame(pkg, PLAY_CASES[name].clockOrigin);
    game = hint(game).game;
    game = apply(game, investigations(game)[0]!.event);
    game = hint(game).game;
    game = hint(game).game;
    const saved = saveText(game);
    expect(saved.ok).toBe(true);
    const loaded = loadText(pkg, saved.text, PLAY_CASES[name].clockOrigin);
    if (!loaded.ok) throw new Error(loaded.text);
    expect(loaded.game.state).toEqual(game.state);
    expect(hintsUsed(loaded.game)).toBe(3);
    const next = (g: Game) => {
      const r = reduceSession(pkg, g.state, { type: "hint" });
      return r.ok ? r.output : r.code;
    };
    expect(next(loaded.game)).toEqual(next(game));
    const replay = replaySession(pkg, game.state.events);
    expect(replay.ok && (replay.state as SessionState)).toEqual(game.state);
  });
});

describe("rulesets without hints", () => {
  const vitrine = PLAY_CASES.vitrine;
  const source = () => refSource(playPackageInput(vitrine).truth, vitrine.salt);

  it.each(["mystery-session-v1", "mystery-session-v2"])("%s rejects the hint event as unavailable", (rulesetVersion) => {
    const resolved = resolveCasePackage({ ...playPackageInput(vitrine), rulesetVersion }, source());
    if (!resolved.ok) throw new Error(JSON.stringify(resolved.findings));
    const result = reduceSession(resolved.package, initialSession(resolved.package), { type: "hint" });
    expect(result.ok || result.code).toBe("ACTION_UNAVAILABLE");
  });

  it("v3 without a bound proof has nothing to derive hints from", () => {
    const resolved = resolveCasePackage(playPackageInput(vitrine), source());
    if (!resolved.ok) throw new Error(JSON.stringify(resolved.findings));
    const result = reduceSession(resolved.package, initialSession(resolved.package), { type: "hint" });
    expect(result.ok || result.code).toBe("ACTION_UNAVAILABLE");
    expect(command(newGame(resolved.package), "hinweis").text).toBe("Für diesen Fall gibt es keine Hinweise.");
  });

  it("extra fields on the hint event are rejected", () => {
    const pkg = loadPlayPackage("vitrine");
    const result = reduceSession(pkg, initialSession(pkg), { type: "hint", level: 3 });
    expect(result.ok).toBe(false);
  });
});

describe("CLI", () => {
  it("hinweis / h give graded hints, help lists them, the solved text counts them", () => {
    const pkg = loadPlayPackage("vitrine");
    let game = newGame(pkg);
    expect(command(game, "hilfe").text).toContain("hinweis | h");
    const first = command(game, "hinweis");
    expect(first.text).toMatch(/^Hinweis \(Stufe 1\): /);
    game = first.game;
    const second = command(game, "h");
    expect(second.text).toMatch(/^Hinweis \(Stufe 2\): /);
    game = second.game;
    expect(command(game, "journal").text).toBe("Das Journal ist noch leer.\nHinweise genutzt: 2");
    const solved = playByHints("vitrine").game;
    expect(solved.state.phase).toBe("solved");
    const last = solved.state.events.at(-1);
    // Re-run the final accusation on the prefix to see the closing text.
    const prefix = replaySession(pkg, solved.state.events.slice(0, -1));
    if (!prefix.ok) throw new Error(prefix.code);
    const before = { ...solved, state: prefix.state };
    const pick = accusations(before).findIndex((a) => JSON.stringify(a.event) === JSON.stringify(last));
    expect(command(before, `a ${pick + 1}`).text).toContain(`Hinweise genutzt: ${hintsUsed(solved)}.`);
  });
});

describe("web", () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    const app = createWebApp({ vitrine: loadPlayPackage("vitrine") });
    server = createServer((req, res) => void app(req, res));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const page = async () => (await fetch(`${base}/fall/vitrine`)).text();
  const post = (fields: Record<string, string>) =>
    fetch(`${base}/fall/vitrine/act`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields).toString() });

  it("the hint button shows a graded hint and counts it; save/load keeps the count", async () => {
    const start = await page();
    expect(start).toContain('<input type="hidden" name="group" value="h">');
    expect(start).toContain("Hinweise genutzt: 0");
    await post({ group: "h", n: "1", at: "0" });
    const after = await page();
    expect(after).toContain("Hinweis (Stufe 1):");
    expect(after).toContain("Hinweise genutzt: 1");
    expect(after).not.toMatch(PLAYER_REF);
    const saved = await (await fetch(`${base}/fall/vitrine/save`)).text();
    await fetch(`${base}/fall/vitrine/new`, { method: "POST", redirect: "manual" });
    expect(await page()).toContain("Hinweise genutzt: 0");
    await fetch(`${base}/fall/vitrine/load`, { method: "POST", redirect: "manual", body: saved });
    expect(await page()).toContain("Hinweise genutzt: 1");
  });
});

describe("review fixes", () => {
  it("a confrontation step of the witness is hinted and must be done before the accusation hint", () => {
    const { hints } = playByHints("brieföffner");
    const kinds = hints.map((h) => h.kind);
    expect(kinds).toContain("confront");
    expect(kinds.indexOf("confront")).toBeLessThan(kinds.indexOf("accuse"));
    const confront = hints.find((h) => h.kind === "confront" && h.level === 3)!;
    expect(confront.evidence).not.toBeNull();
  });

  it.each(CASES)("%s: after three hints on one step the next is refused, so hints cannot use up the action limit", (name) => {
    const pkg = loadPlayPackage(name);
    let game = newGame(pkg);
    for (let i = 0; i < 3; i++) game = hint(game).game;
    const fourth = reduceSession(pkg, game.state, { type: "hint" });
    expect(fourth.ok || fourth.code).toBe("ACTION_UNAVAILABLE");
    expect(command(game, "h").text).toBe("Genauer geht der Hinweis nicht. Folge dem letzten Hinweis.");
  });
});

describe("hints with several certified routes", () => {
  it.each(CASES)("%s: hints follow the witness route only", (name) => {
    const pkg = loadPlayPackage(name);
    const witness = pkg.proof!.profile.witnessStepIds;
    const manifest = JSON.parse(pkg.proof!.releaseManifest) as { certificateData: { steps: { stepId: string; event: { type: string } }[] } };
    const route = witness.map((id) => manifest.certificateData.steps.find((s) => s.stepId === id)?.event).filter((e) => e !== undefined && e.type !== "accuse");
    const { game } = playByHints(name);
    const done = game.state.events.filter((e) => e.type !== "hint" && e.type !== "accuse");
    expect(done).toEqual(route);
  });
});
