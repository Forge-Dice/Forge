import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkCaseFolder } from "../src/authoring/check-case.ts";
import { PLAY_CASES, loadPlayPackage, playCaseName, type PlayCaseName } from "../src/play/cases.ts";
import { command, newGame, type Game } from "../src/play/game.ts";

// Cases 4 and 5, authored against check-case only.
// "Die Hüttenkasse": the thief is a late suspect; nobody saw him at dinner, only the hut book
// introduces him and proves he is in the house, and the roster rule needs that proof. "Der Nachtzug nach Triest": an alibi
// puzzle; two suspects are excluded by sightings before the theft plus the locked connecting door.

const FIXTURES = new URL("./fixtures/", import.meta.url).pathname;
const scratch = mkdtempSync(join(tmpdir(), "cases-4-5-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
const PLACEHOLDER = "TO_BE_COMPUTED_FROM_FINAL_ARTIFACT";

type Step = { stepId: string; event: unknown };
const ref = (kind: string, id: string) => ({ $playerRefOf: { kind, id } });
const search = (stepId: string, id: string): Step => ({ stepId, event: { type: "investigate", action: "search_location", target: ref("location", id) } });
const examine = (stepId: string, id: string): Step => ({ stepId, event: { type: "investigate", action: "examine_item", target: ref("item", id) } });
const examinePerson = (stepId: string, id: string): Step => ({ stepId, event: { type: "investigate", action: "examine_person", target: ref("person", id) } });
const ask = (stepId: string, npc: string, questionId: string): Step => ({ stepId, event: { type: "interrogate", npc: ref("person", npc), questionId } });

/** Copy of a case folder whose certified witness is exactly `steps`. */
function withWitness(dir: string, steps: Step[]): string {
  const out = join(scratch, `${dir}-${steps.map((s) => s.stepId).join("+") || "empty"}`);
  cpSync(join(FIXTURES, dir), out, { recursive: true });
  const edit = (file: string, change: (json: any) => void) => {
    const json = JSON.parse(readFileSync(join(out, file), "utf8"));
    change(json);
    writeFileSync(join(out, file), JSON.stringify(json));
  };
  edit("release-manifest.json", (m) => {
    m.releaseContextHash = PLACEHOLDER;
    m.certificateData.steps = steps;
    delete m.certificateData.routes;
  });
  edit("proof-profile.json", (p) => {
    p.bindings.releaseHash = PLACEHOLDER;
    p.witnessStepIds = steps.map((s) => s.stepId);
  });
  return out;
}

const errors = (check: ReturnType<typeof checkCaseFolder>) => check.problems.filter((p) => p.severity === "error");

function player(name: PlayCaseName) {
  let game: Game = newGame(loadPlayPackage(name), PLAY_CASES[name].clockOrigin);
  const say = (line: string) => {
    const step = command(game, line);
    game = step.game;
    return step.text;
  };
  /** Picks the numbered entry of menu `menu` that contains `needle`. */
  const pick = (menu: string, needle: string) => {
    const listing = say(menu);
    const line = listing.split("\n").find((l) => l.includes(needle));
    if (line === undefined) throw new Error(`"${needle}" not offered in:\n${listing}`);
    return say(`${menu} ${line.trim().split(".")[0]}`);
  };
  return { say, pick };
}

describe("Die Hüttenkasse", () => {
  const DIR = "huettenkasse";
  const stube = search("search-stube", "location:stube");
  const buch = examine("read-buch", "item:buch");
  const rosa = ask("ask-rosa-buch", "person:rosa", "question:q04");
  const funkraum = search("search-funkraum", "location:funkraum");
  const lukas = ask("ask-lukas-funk", "person:lukas", "question:q01");
  const funk = examine("read-funkgeraet", "item:funkgeraet");
  const terrasse = search("search-terrasse", "location:terrasse");
  const gerd = ask("ask-gerd-terrasse", "person:gerd", "question:q02");
  const kamera = examine("read-kamera", "item:kamera");

  it("is valid and solvable as committed, with every hash filled in", () => {
    const check = checkCaseFolder(join(FIXTURES, DIR));
    expect(check.problems).toEqual([]);
    expect(check.filled).toEqual([]);
    expect(check.solvability).toMatchObject({ status: "pass", survivingAnswerCount: 1 });
    expect(check.routes.map((r) => [r.routeId, r.report.status])).toEqual([["witness", "pass"], ["befragen", "pass"]]);
  });

  it("route A (searching the rooms) and route B (asking the people) each solve it", () => {
    for (const route of [
      [stube, buch, funkraum, funk, terrasse, kamera],
      [rosa, buch, lukas, funk, gerd, kamera],
    ]) {
      const check = checkCaseFolder(withWitness(DIR, route));
      expect(errors(check), route.map((s) => s.stepId).join(",")).toEqual([]);
      expect(check.solvability?.status).toBe("pass");
    }
  });

  it("without the hut book the four alibis do not convict Tobias", () => {
    const check = checkCaseFolder(withWitness(DIR, [lukas, funk, terrasse, kamera]));
    expect(check.ok).toBe(false);
    expect(check.solvability?.status).toBe("fail");
  });

  it("plays to the solution in the CLI; the boot print is a false lead", () => {
    const { say, pick } = player("hüttenkasse");
    expect(pick("u", "Gaststube")).toContain("Bergführerprofil");
    expect(say("a")).not.toContain("Tobias Wenger");
    expect(pick("a", "Lukas Brandl")).toContain("noch nicht");
    expect(pick("u", "Hüttenbuch")).toContain("Tobias Wenger war um 21:40:00 am Ort „Winterraum“");
    expect(pick("f", "Haben Sie um 23:10 im Funkraum gefunkt?")).toContain("„Ja.“");
    expect(pick("u", "Funkgerät")).toContain("Johanna Pichler war um 23:10:00 am Ort „Funkraum“");
    expect(pick("u", "Sonnenterrasse")).toContain("Intervallmodus");
    expect(pick("u", "Gerds Kamera")).toContain("Mira Hofer war um 23:10:00 am Ort „Sonnenterrasse“");
    expect(pick("f", "Tobias Wenger: Waren Sie um 23:10")).toContain("„Nein.“");
    const solved = pick("a", "Tobias Wenger");
    expect(solved).toContain("Fall gelöst");
    expect(solved).toContain("=== Auflösung ===");
  });

  it("Tobias lies about the parlour until the money band from his sleeping bag is held up to him", () => {
    const { pick } = player("hüttenkasse");
    pick("u", "Gaststube");
    pick("u", "Hüttenbuch");
    expect(pick("u", "Winterraum")).toContain("Geldbanderole");
    expect(pick("f", "Tobias Wenger: Waren Sie um 23:10")).toContain("„Nein.“");
    expect(pick("v", "vorhalten: Steigfelle")).not.toContain("gibt nach");
    expect(pick("v", "vorhalten: Banderole")).toContain("gibt nach: „Ja.“");
    expect(pick("f", "Tobias Wenger: Waren Sie um 23:10")).toContain("„Ja.“");
  });

  it("Tobias can only be questioned once the winter room is known", () => {
    const { say, pick } = player("hüttenkasse");
    expect(say("f")).not.toContain("Tobias Wenger:");
    pick("u", "Gaststube");
    pick("u", "Hüttenbuch");
    expect(say("f")).toContain("Tobias Wenger: Haben Sie sich um 21:40 im Winterraum eingerichtet?");
  });
});

describe("Der Nachtzug nach Triest", () => {
  const DIR = "nachtzug";
  const speisewagen = search("search-speisewagen", "location:speisewagen");
  const janek = ask("ask-janek-nacht", "person:janek", "question:q01");
  const dienstbuch = examine("read-dienstbuch", "item:dienstbuch");
  const liegewagen = search("search-liegewagen", "location:liegewagen");
  const janekPerson = examinePerson("examine-janek", "person:janek");
  const felix = examinePerson("examine-felix", "person:felix");
  const schlafwagen = search("search-schlafwagen", "location:schlafwagen");
  const dora = ask("ask-dora", "person:dora", "question:q04");
  const terminal = examine("read-terminal", "item:terminal");

  it("is valid and solvable as committed, with every hash filled in", () => {
    const check = checkCaseFolder(join(FIXTURES, DIR));
    expect(check.problems).toEqual([]);
    expect(check.filled).toEqual([]);
    expect(check.solvability).toMatchObject({ status: "pass", survivingAnswerCount: 1 });
    expect(check.routes.map((r) => [r.routeId, r.report.status])).toEqual([["witness", "pass"], ["tuerzettel", "pass"]]);
  });

  it("route A (Janek's service book) and route B (the door note and examining people) each solve it", () => {
    for (const route of [
      [speisewagen, janek, dienstbuch, felix, schlafwagen, terminal],
      [speisewagen, liegewagen, janekPerson, felix, dora, terminal],
    ]) {
      const check = checkCaseFolder(withWitness(DIR, route));
      expect(errors(check), route.map((s) => s.stepId).join(",")).toEqual([]);
      expect(check.solvability?.status).toBe("pass");
    }
  });

  it("the sightings alone are no alibi: without the locked door Bruno and Felix stay open", () => {
    const check = checkCaseFolder(withWitness(DIR, [speisewagen, janekPerson, felix, schlafwagen, terminal]));
    expect(check.ok).toBe(false);
    expect(check.solvability?.status).toBe("fail");
  });

  it("plays to the solution in the CLI; Clara's tea at 00:50 is no alibi", () => {
    const { say, pick } = player("nachtzug");
    expect(pick("u", "Abteil 7")).toContain("Korken");
    expect(pick("u", "Speisewagen")).toContain("Clara Mai war um 00:50:00 am Ort „Speisewagen“");
    expect(pick("f", "Felix Roth: War Clara Mai")).toContain("Ich glaube schon");
    expect(pick("u", "Liegewagen")).toContain("verriegelt 01:00 Uhr");
    expect(pick("u", "Person untersuchen: Janek")).toContain("Janek Novak war um 01:20:00 am Ort „Bahnsteig Villach Hbf“");
    expect(pick("u", "Person untersuchen: Felix")).toContain("Felix Roth war um 01:12:00 am Ort „Liegewagen“");
    expect(say("u")).not.toContain("Türterminal");
    expect(pick("f", "Dora Lenz: Waren Sie um 01:20")).toContain("„Ja.“");
    expect(pick("u", "Türterminal")).toContain("Dora Lenz war um 01:20:00 am Ort „Abteil 6“");
    expect(pick("a", "Bruno Kessler")).toContain("noch nicht");
    expect(pick("a", "Clara Mai")).toContain("Fall gelöst");
  });
});

describe("Der Nachtzug nach Triest: Clara's lie", () => {
  it("Clara claims the dining car; the cash journal breaks her story", () => {
    const { pick } = player("nachtzug");
    expect(pick("f", "Clara Mai: Waren Sie um 01:20 im Speisewagen?")).toContain("„Ja.“");
    pick("u", "Abteil 7");
    expect(pick("v", "vorhalten: Weinkorken")).not.toContain("gibt nach");
    pick("u", "Speisewagen");
    expect(pick("v", "vorhalten: Kassenjournal")).toContain("gibt nach: „Nein.“");
  });
});

describe("registry", () => {
  it("finds both cases by name, umlaut-free spelling and folder", () => {
    expect(playCaseName("hüttenkasse")).toBe("hüttenkasse");
    expect(playCaseName("huettenkasse")).toBe("hüttenkasse");
    expect(playCaseName("Nachtzug")).toBe("nachtzug");
  });
});
