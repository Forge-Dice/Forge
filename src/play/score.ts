import type { ResolvedCasePackage } from "../domain/case-package.ts";
import type { SessionState } from "../domain/case-session.ts";

// Score of a solved case, derived from the event log alone (so a save reproduces it): actions
// beyond the case's par, hints and wrong accusations cost points; the rank has three steps.
// Par is the action count of the playtest bot's systematic player (stored per case in
// PLAY_CASES and kept in step by a test); packages without one fall back to twice the witness.

export type Rank = { readonly stars: 1 | 2 | 3; readonly title: string };
export type Score = {
  readonly points: number;
  readonly rank: Rank;
  /** Player actions including accusations, hints excluded. */
  readonly actions: number;
  readonly par: number;
  readonly hints: number;
  readonly wrongAccusations: number;
};

export const SCORE_RULES = Object.freeze({ perExtraAction: 4, perHint: 10, perWrongAccusation: 20 });
export const RANKS: readonly (Rank & { readonly from: number })[] = [
  { stars: 3, title: "Meisterdetektiv", from: 85 },
  { stars: 2, title: "Kommissar", from: 55 },
  { stars: 1, title: "Spürnase", from: 0 },
];

const pars = new WeakMap<ResolvedCasePackage, number>();
/** Registers a case's measured par (the play host does this when it loads a case). */
export const registerPar = (pkg: ResolvedCasePackage, par: number): void => void pars.set(pkg, par);

/** Measured par, else twice the certified witness plus the accusation. */
export function parOf(pkg: ResolvedCasePackage): number {
  return pars.get(pkg) ?? 2 * ((pkg.proof?.profile.witnessStepIds.length ?? 5) + 1);
}

export const rankOf = (points: number): Rank => {
  const { stars, title } = RANKS.find((r) => points >= r.from)!;
  return { stars, title };
};

/** The score of a solved session; null while the case is open. */
export function scoreOf(pkg: ResolvedCasePackage, state: SessionState): Score | null {
  if (state.phase !== "solved") return null;
  const hints = state.events.filter((e) => e.type === "hint").length;
  const actions = state.events.length - hints;
  const wrongAccusations = state.verdicts.filter((v) => v.verdict === "not_solved").length;
  const par = parOf(pkg);
  const lost = SCORE_RULES.perExtraAction * Math.max(0, actions - par) + SCORE_RULES.perHint * hints + SCORE_RULES.perWrongAccusation * wrongAccusations;
  const points = Math.max(0, 100 - lost);
  return Object.freeze({ points, rank: rankOf(points), actions, par, hints, wrongAccusations });
}

export const starsText = (stars: number): string => "★".repeat(stars) + "☆".repeat(3 - stars);

/** "12 Aktionen bei Ziel 10, 1 Hinweis, keine Fehlanklage" */
export function scoreDetails(s: Score): string {
  const hints = s.hints === 0 ? "kein Hinweis" : s.hints === 1 ? "1 Hinweis" : `${s.hints} Hinweise`;
  const wrong = s.wrongAccusations === 0 ? "keine Fehlanklage" : s.wrongAccusations === 1 ? "1 Fehlanklage" : `${s.wrongAccusations} Fehlanklagen`;
  return `${s.actions} Aktionen bei Ziel ${s.par}, ${hints}, ${wrong}`;
}

/** One line for the CLI: "Wertung: 84 Punkte, ★★☆ Kommissar (12 Aktionen bei Ziel 10, 1 Hinweis, keine Fehlanklage)". */
export const scoreText = (s: Score): string => `Wertung: ${s.points} Punkte, ${starsText(s.rank.stars)} ${s.rank.title} (${scoreDetails(s)})`;
