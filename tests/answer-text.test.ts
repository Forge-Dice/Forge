import { describe, expect, it } from "vitest";
import { resolveCasePackage, type ResolvedCasePackage } from "../src/domain/case-package.ts";
import { PLAY_CASES, playPackageInput, refSource } from "../src/play/cases.ts";
import { command, newGame, type Game } from "../src/play/game.ts";

// Optional answer sentences per interrogation rule (publicContent.questionTexts[].answer and
// .admission): own wording first, then the NPC's voice, then the plain stance.

const BRIEF = PLAY_CASES["brieföffner"];
const VITRINE = PLAY_CASES.vitrine;

type Content = { questionTexts: { npc: string; questionId: string; answer?: string; admission?: string }[]; voices?: unknown };
function resolveWith(c: typeof BRIEF | typeof VITRINE, rulesetVersion: string, edit: (content: Content) => void) {
  const input = playPackageInput(c) as Record<string, unknown> & { publicContent: Content };
  const content = structuredClone(input.publicContent);
  edit(content);
  return resolveCasePackage({ ...input, rulesetVersion, publicContent: content }, refSource(input.truth, c.salt));
}
const strip = (content: Content) => content.questionTexts.forEach((q) => (delete q.answer, delete q.admission));
function pkgOf(result: ReturnType<typeof resolveCasePackage>): ResolvedCasePackage {
  if (!result.ok) throw new Error(JSON.stringify(result.findings));
  return result.package;
}
const pick = (game: Game, cmd: string, text: string) => {
  const line = command(game, cmd).text.split("\n").find((l) => l.includes(text));
  if (line === undefined) throw new Error(`no "${text}" under ${cmd}`);
  return command(game, `${cmd} ${line.trim().split(".")[0]}`);
};
function benBreaks(pkg: ResolvedCasePackage) {
  let game = newGame(pkg, BRIEF.clockOrigin);
  game = pick(game, "u", "Bibliothek").game;
  const lie = pick(game, "f", "Ben: Waren Sie bei Claras Tod dabei?");
  const admit = pick(lie.game, "v", "Manschettenknopf");
  return { lie: lie.text, admit: admit.text, journal: command(admit.game, "j").text };
}

describe("answer sentences", () => {
  it("leave the package identity alone where a case has none (the v1 Vitrine hash before ANSWER-TEXT)", () => {
    const v1 = pkgOf(resolveWith(VITRINE, "mystery-session-v1", strip));
    expect(v1.identity.packageHash).toBe("561afd4a19199b77957bf049c3e508036390b439d38f1887dcf8c56db921dfc2");
  });

  it("are part of the package identity", () => {
    const a = pkgOf(resolveWith(VITRINE, "mystery-session-v1", () => {}));
    const b = pkgOf(resolveWith(VITRINE, "mystery-session-v1", (c) => (c.questionTexts[0]!.answer = "Anders gesagt.")));
    expect(a.identity.packageHash).not.toBe(b.identity.packageHash);
  });

  it("fall back to the plain stance when absent: Ben lies „Nein.“ and gives in „Ja.“", () => {
    const { lie, admit } = benBreaks(pkgOf(resolveWith(BRIEF, "mystery-session-v2", strip)));
    expect(lie).toContain("„Nein.“");
    expect(admit).toContain("gibt nach: „Ja.“");
  });

  it("voice the lie like an answer and the giving-in with the admission; the journal keeps both in order", () => {
    const { lie, admit, journal } = benBreaks(pkgOf(resolveWith(BRIEF, "mystery-session-v2", () => {})));
    expect(lie).toContain("„Nein. Ich war nicht dabei, das schwöre ich Ihnen.“");
    expect(admit).toContain("gibt nach: „Also gut. Ja, ich war dabei, als Clara starb.“");
    const lines = journal.split("\n");
    expect(lines.findIndex((l) => l.includes("das schwöre ich Ihnen"))).toBeLessThan(lines.findIndex((l) => l.includes("Also gut.")));
  });

  it("win over the NPC's voice; without one the voice speaks", () => {
    const voices = [{ npc: "person:ben", lines: { denies: ["Bestimmt nicht."], affirms: ["Freilich."], gives_in: ["Schon gut."] } }];
    const own = benBreaks(pkgOf(resolveWith(BRIEF, "mystery-session-v2", (c) => (c.voices = voices))));
    expect(own.lie).toContain("das schwöre ich Ihnen");
    expect(own.admit).toContain("„Also gut. Ja, ich war dabei, als Clara starb.“");
    const voiced = benBreaks(pkgOf(resolveWith(BRIEF, "mystery-session-v2", (c) => (strip(c), (c.voices = voices)))));
    expect(voiced.lie).toContain("„Bestimmt nicht.“");
    expect(voiced.admit).toContain("gibt nach: „Schon gut. Freilich.“");
  });

  it("follow the player-text rules, and an admission only where a lie can be broken", () => {
    const bad = resolveWith(BRIEF, "mystery-session-v2", (c) => (c.questionTexts[0]!.answer = "   "));
    expect(bad.ok).toBe(false);
    const anna = resolveWith(BRIEF, "mystery-session-v2", (c) => (c.questionTexts.find((q) => q.npc === "person:anna")!.admission = "Gut, ja."));
    expect(anna.ok).toBe(false);
    if (!anna.ok) expect(anna.findings.some((f) => f.code === "REFERENCE" && f.path.includes("admission"))).toBe(true);
  });
});
