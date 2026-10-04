import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkCaseFolder } from "../src/authoring/check-case.ts";
import { reduceSession } from "../src/domain/case-session.ts";
import { PLAY_CASES, loadPlayPackage } from "../src/play/cases.ts";
import { accusations, command, newGame, type Game } from "../src/play/game.ts";

// Late suspects: an accusation names only persons the player knows; in-scope persons they do not
// know yet count as "not accused". check-case requires the witness to introduce every accused person.

const FIXTURES = new URL("./fixtures/", import.meta.url).pathname;
const scratch = mkdtempSync(join(tmpdir(), "late-suspect-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const pkg = loadPlayPackage("hüttenkasse");
const start = () => newGame(pkg, PLAY_CASES["hüttenkasse"].clockOrigin);
const run = (game: Game, ...lines: string[]) => lines.reduce((g, line) => command(g, line).game, game);
const pickLine = (game: Game, menu: string, needle: string) => {
  const line = command(game, menu).text.split("\n").find((l) => l.includes(needle))!;
  return `${menu} ${line.trim().split(".")[0]}`;
};
const accuse = (game: Game, label: string) => {
  const action = accusations(game).find((a) => a.label === label)!;
  return reduceSession(game.pkg, game.state, action.event);
};
const tobias = pkg.refs.refFor("person", "person:tobias")!;
const event = pkg.refs.refFor("event", "event:diebstahl")!;

/** Game after searching the parlour and reading the hut book. */
function afterHutBook(): Game {
  let game = start();
  game = run(game, pickLine(game, "u", "Gaststube"));
  return run(game, pickLine(game, "u", "Hüttenbuch"));
}

describe("accusation with a suspect the player does not know yet", () => {
  it("offers only the four known suspects, without a placeholder that would betray a fifth", () => {
    const labels = accusations(start()).map((a) => a.label);
    expect(labels).toEqual(["Lukas Brandl", "Mira Hofer", "Gerd Sailer", "Johanna Pichler"]);
    expect(command(start(), "a").text).not.toContain("unbekannt");
  });

  it("an accusation of a known person is judged (not blocked) and stays not solved", () => {
    const result = accuse(start(), "Lukas Brandl");
    expect(result.ok && result.output).toEqual({ type: "accuse", verdict: "not_solved" });
  });

  it("acquitting every known suspect does not solve it: the unknown culprit counts as not accused", () => {
    const game = start();
    const offered = (accusations(game)[0]!.event as { literals: { claim: unknown; value: boolean }[] }).literals;
    const all = offered.map((l) => ({ claim: l.claim, value: false }));
    expect(all).toHaveLength(4);
    const result = reduceSession(pkg, game.state, { type: "accuse", literals: all });
    expect(result.ok && result.output).toEqual({ type: "accuse", verdict: "not_solved" });
  });

  it("naming the unknown person by ref is still unavailable", () => {
    const literals = [{ claim: { kind: "personRoleForEvent", person: tobias, event, role: "direct_actor" }, value: true }];
    const result = reduceSession(pkg, start().state, { type: "accuse", literals });
    expect(result).toMatchObject({ ok: false, code: "ACTION_UNAVAILABLE" });
  });

  it("after the hut book Tobias is offered and accusing him solves the case", () => {
    const game = afterHutBook();
    expect(accusations(game).map((a) => a.label)).toContain("Tobias Wenger");
    const result = accuse(game, "Tobias Wenger");
    expect(result.ok && result.output).toEqual({ type: "accuse", verdict: "solved" });
  });

  it("cases where every suspect is known from the start behave as before", () => {
    const vitrine = newGame(loadPlayPackage("vitrine"), PLAY_CASES.vitrine.clockOrigin);
    expect(accusations(vitrine)).toHaveLength(vitrine.pkg.challenge.allowedClaims.length);
  });
});

describe("check-case: the witness must introduce the culprit", () => {
  it("rejects a case whose culprit is never introduced on the solution path", () => {
    const dir = join(scratch, "geige-ida-unknown");
    cpSync(join(FIXTURES, "geige"), dir, { recursive: true });
    const setup = JSON.parse(readFileSync(join(dir, "initial-setup.json"), "utf8"));
    setup.known = setup.known.filter((k: { id: string }) => k.id !== "person:ida");
    writeFileSync(join(dir, "initial-setup.json"), JSON.stringify(setup));
    const check = checkCaseFolder(dir);
    expect(check.ok).toBe(false);
    expect(check.problems).toContainEqual(
      expect.objectContaining({ severity: "error", file: "proof-profile.json", field: "witnessStepIds", message: expect.stringContaining("person:ida") }),
    );
  });

  it("accepts Die Hüttenkasse, where the hut book introduces Tobias", () => {
    expect(checkCaseFolder(join(FIXTURES, "huettenkasse")).ok).toBe(true);
  });
});
