import type { ResolvedCasePackage } from "../domain/case-package.ts";
import { checkCaseSolvability } from "../domain/case-solvability.ts";
import { reduceSession, type SessionOutput } from "../domain/case-session.ts";
import { profileLies } from "../domain/interrogation-authoring.ts";
import { eventWitness, type Manifest } from "../authoring/check-case.ts";
import { accusations, confrontations, investigations, newGame, questions, type Action, type Game } from "./game.ts";
import { difficultyText } from "./difficulty.ts";

// Playtest bot: simulated players run a case over the real session reducer (the same action menus
// as the CLI) and the runs are condensed into a difficulty rating and balance warnings for authors.
// A bot "deduces" exactly when its own event log releases enough for the case's proof profile to
// pass (the solvability check over the player's actual knowledge) and it knows the culprit; then
// it accuses correctly. Everything is a pure function of package, style and seed.

export type Style = "systematisch" | "neugierig" | "voreilig" | "hinweise";
export const STYLES: readonly Style[] = ["systematisch", "neugierig", "voreilig", "hinweise"];

export type Run = {
  readonly style: Style;
  readonly seed: number;
  readonly solved: boolean;
  /** Player actions including accusations, without hints. */
  readonly actions: number;
  readonly hints: number;
  readonly wrongAccusations: number;
  /** Actions that brought nothing new: empty search, no answer, a statement that stands. */
  readonly deadEnds: number;
  /** Action count after which the bot's knowledge first proved the answer; null if never. */
  readonly readyAfter: number | null;
  /** Distinct finds (evidence) when the case was solved or the run ended. */
  readonly finds: number;
  /** Wrong accusations per wrongly accused person id. */
  readonly accused: Readonly<Record<string, number>>;
};

export type CaseReport = {
  readonly rating: 1 | 2 | 3 | 4 | 5;
  readonly runs: readonly Run[];
  readonly metrics: {
    /** Median actions to solve over the exploring styles (systematic and curious). */
    readonly actionsToSolve: number;
    /** Average wrong accusations of the hasty style. */
    readonly wrongAccusations: number;
    /** Share of exploring actions that were dead ends (0..1). */
    readonly deadEndRate: number;
    /** Median hints the hint-reliant style took. */
    readonly hints: number;
    /** Finds the case's proof chain cites (OBSERVED from an evidence card). */
    readonly findsNeeded: number;
    /** All finds the case offers (exhaustive exploration). */
    readonly findsAvailable: number;
    /** Share of hasty runs whose very first, unproven guess was right (0..1). */
    readonly firstGuessHits: number;
    /** Share of wrong accusations per red-herring person id (0..1). */
    readonly redHerringPull: Readonly<Record<string, number>>;
  };
  readonly warnings: readonly string[];
};

export const DEFAULT_SEEDS = 8;
const MAX_ACTIONS = 150;
const HASTY_EVERY = 3;

// ---------- Deterministic randomness ----------

function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join("|")) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function random(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Deduction oracle ----------

/** Whether the player's event log already proves the answer: the proof profile passes on it. */
export function deductionOracle(pkg: ResolvedCasePackage): (events: readonly unknown[]) => boolean {
  const proof = pkg.proof;
  if (proof === null) return () => false;
  const replay = eventWitness(pkg, JSON.parse(proof.releaseManifest) as Manifest, proof.releaseHash);
  const lies = pkg.npcs.flatMap((npc) => profileLies(npc.profile, pkg.truth));
  const cache = new Map<string, boolean>();
  return (events) => {
    const key = JSON.stringify(events.filter((e) => (e as { type?: string }).type !== "hint" && (e as { type?: string }).type !== "accuse"));
    let result = cache.get(key);
    if (result === undefined) {
      result = checkCaseSolvability(pkg.truth, pkg.solution, proof.profile, () => replay(events), { lies }).status === "pass";
      cache.set(key, result);
    }
    return result;
  };
}

// ---------- One run ----------

const solves = (game: Game, action: Action): boolean => {
  const result = reduceSession(game.pkg, game.state, action.event);
  return result.ok && result.output.type === "accuse" && result.output.verdict === "solved";
};

const personIdOf = (game: Game, action: Action): string => {
  const literals = (action.event as { literals: { claim: { person: string }; value: boolean }[] }).literals;
  return game.pkg.refs.resolve(literals.find((l) => l.value)!.claim.person)!.id;
};

function isDeadEnd(before: Game, output: SessionOutput): boolean {
  switch (output.type) {
    case "investigate": {
      const had = new Set(before.state.knowledge.discoveries.map((d) => d.evidence));
      return output.observations.every((o) => had.has(o.evidence));
    }
    case "interrogate":
      return output.observation.act === "decline" || output.observation.stance === "does_not_know";
    case "confront":
      return output.observation.act === "stands_by";
    default:
      return false;
  }
}

/** Persons mentioned by the claims the player has read so far, counted per player ref. */
function mentions(game: Game): Map<string, number> {
  const count = new Map<string, number>();
  const add = (claim: unknown) => {
    const person = (claim as { person?: unknown }).person;
    if (typeof person === "string") count.set(person, (count.get(person) ?? 0) + 1);
  };
  for (const r of game.state.knowledge.observations) {
    const o = r.observation as { reports?: { claim: unknown }[]; statement?: unknown };
    for (const report of o.reports ?? []) add(report.claim);
    if (o.statement !== undefined) add(o.statement);
  }
  return count;
}

export function playRun(pkg: ResolvedCasePackage, style: Style, seed: number, proves = deductionOracle(pkg)): Run {
  const rand = random(hashSeed(pkg.truth.caseId, style, seed));
  let game = newGame(pkg);
  const done = new Set<string>();
  const accused: Record<string, number> = {};
  let actions = 0;
  let hints = 0;
  let wrong = 0;
  let deadEnds = 0;
  let readyAfter: number | null = null;
  let sinceGuess = 0;

  const apply = (event: unknown): SessionOutput | null => {
    const result = reduceSession(pkg, game.state, event);
    if (!result.ok) return null;
    const before = game;
    game = { ...game, state: result.state };
    if (result.output.type !== "hint") actions++;
    if (isDeadEnd(before, result.output)) deadEnds++;
    return result.output;
  };
  const explore = (action: Action) => {
    done.add(JSON.stringify(action.event));
    sinceGuess++;
    apply(action.event);
  };
  const fresh = (actions: Action[]) => actions.filter((a) => !done.has(JSON.stringify(a.event)));
  // Menus in the order the CLI shows them; a random player first picks a menu, then an entry.
  const menus = (): Action[][] => [fresh(investigations(game)), fresh(questions(game)), fresh(confrontations(game))].filter((m) => m.length > 0);
  const accuseRight = (): boolean => {
    const right = accusations(game).find((a) => solves(game, a));
    if (right === undefined) return false;
    apply(right.event);
    return true;
  };

  // Knowledge only grows, so the proof can only change when the journal or the finds grew.
  let checked = "";
  let proven = false;
  const ready = (): boolean => {
    const { observations, discoveries, known } = game.state.knowledge;
    const size = `${observations.length}|${discoveries.length}|${known.length}`;
    if (size !== checked) [checked, proven] = [size, proves(game.state.events)];
    return proven;
  };

  while (game.state.phase === "active" && actions < MAX_ACTIONS) {
    if (ready()) {
      readyAfter ??= actions;
      if (accuseRight()) break;
    }
    if (style === "voreilig" && sinceGuess >= HASTY_EVERY) {
      // Guess the person the read claims mention most, never the same wrong person twice.
      const seen = mentions(game);
      const guesses = accusations(game)
        .filter((a) => accused[personIdOf(game, a)] === undefined)
        .map((a) => ({ a, score: (seen.get(pkg.refs.refFor("person", personIdOf(game, a))!) ?? 0) + rand() * 0.5 }))
        .sort((x, y) => y.score - x.score);
      const guess = guesses[0];
      sinceGuess = 0;
      if (guess !== undefined) {
        const output = apply(guess.a.event);
        if (output?.type === "accuse" && output.verdict === "solved") break;
        wrong++;
        const id = personIdOf(game, guess.a);
        accused[id] = (accused[id] ?? 0) + 1;
        continue;
      }
    }
    if (style === "hinweise") {
      const result = reduceSession(pkg, game.state, { type: "hint" });
      if (result.ok && result.output.type === "hint") {
        game = { ...game, state: result.state };
        hints++;
        const hint = result.output.hint;
        if (hint.kind === "accuse") {
          if (accuseRight()) break;
        } else if (hint.target !== null && (hint.kind !== "interrogate" || hint.questionId !== null)) {
          const event = hint.kind === "interrogate" ? { type: "interrogate", npc: hint.target, questionId: hint.questionId } : { type: "investigate", action: hint.kind, target: hint.target };
          explore({ label: "", event });
          continue;
        } else if (hint.level < 3 && hint.target !== null) {
          continue; // ask again: the next hint on this step is more concrete
        }
      }
    }
    const open = menus();
    if (open.length === 0) break;
    const menu = style === "systematisch" || style === "hinweise" ? open[0]! : open[Math.floor(rand() * open.length)]!;
    explore(style === "systematisch" || style === "hinweise" ? menu[0]! : menu[Math.floor(rand() * menu.length)]!);
  }
  if (game.state.phase === "active" && ready()) readyAfter ??= actions;
  return Object.freeze({
    style,
    seed,
    solved: game.state.phase === "solved",
    actions,
    hints,
    wrongAccusations: wrong,
    deadEnds,
    readyAfter,
    finds: game.state.knowledge.discoveries.length,
    accused: Object.freeze(accused),
  });
}

// ---------- Exhaustive exploration: what the case offers ----------

type Coverage = { finds: Set<string>; mentioned: Set<string>; actions: number };

function exhaust(pkg: ResolvedCasePackage): Coverage {
  let game = newGame(pkg);
  const done = new Set<string>();
  for (;;) {
    const next = [...investigations(game), ...questions(game), ...confrontations(game)].find((a) => !done.has(JSON.stringify(a.event)));
    if (next === undefined || done.size >= MAX_ACTIONS * 2) break;
    done.add(JSON.stringify(next.event));
    const result = reduceSession(pkg, game.state, next.event);
    if (result.ok) game = { ...game, state: result.state };
  }
  const mentioned = new Set([...mentions(game).keys()].map((ref) => pkg.refs.resolve(ref)?.id ?? ref));
  return { finds: new Set(game.state.knowledge.discoveries.map((d) => pkg.refs.resolve(d.evidence)!.id)), mentioned, actions: done.size };
}

// ---------- Rating and warnings ----------

const median = (xs: readonly number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Difficulty 1..5 from effort (actions to solve), traps (wrong guesses of the hasty player),
 * friction (dead ends) and how much help the hint player needed. Fixed thresholds, so ratings
 * stay comparable between cases and do not shift when a case is added.
 */
export function difficulty(m: Pick<CaseReport["metrics"], "actionsToSolve" | "wrongAccusations" | "deadEndRate" | "hints">): 1 | 2 | 3 | 4 | 5 {
  const score = m.actionsToSolve / 10 + m.wrongAccusations / 2 + m.deadEndRate + m.hints / 10;
  return score < 1.5 ? 1 : score < 2.75 ? 2 : score < 4 ? 3 : score < 5 ? 4 : 5;
}

function labelOf(pkg: ResolvedCasePackage, kind: "person" | "evidence", id: string): string {
  return pkg.publicContent.labels.find((l) => l.entity.kind === kind && l.entity.id === id)?.label ?? id;
}

export function playtestCase(pkg: ResolvedCasePackage, seeds = DEFAULT_SEEDS): CaseReport {
  const proves = deductionOracle(pkg);
  const runs = STYLES.flatMap((style) => Array.from({ length: seeds }, (_, i) => playRun(pkg, style, i + 1, proves)));
  const of = (style: Style) => runs.filter((r) => r.style === style);
  const exploring = [...of("systematisch"), ...of("neugierig")];
  const coverage = exhaust(pkg);

  const answerIds = new Set(pkg.solution.resolutions.flatMap((r) => (r.responsibility.completeness === "complete" ? r.responsibility.assignments.map((a) => a.personId) : [])));
  const suspects = [...new Set(pkg.challenge.allowedClaims.flatMap((c) => ("personId" in c ? [c.personId] : [])))];
  const herrings = suspects.filter((id) => !answerIds.has(id));
  const wrongTotal = of("voreilig").reduce((sum, r) => sum + r.wrongAccusations, 0);
  const pull = Object.fromEntries(herrings.map((id) => [id, wrongTotal === 0 ? 0 : round2(of("voreilig").reduce((s, r) => s + (r.accused[id] ?? 0), 0) / wrongTotal)]));
  const proofFinds = new Set<string>(
    (pkg.proof?.profile.observations ?? []).flatMap((o) => ("source" in o && o.source.kind === "evidence" ? [o.source.evidenceId] : [])),
  );
  const hasty = of("voreilig");

  const metrics = {
    actionsToSolve: median(exploring.filter((r) => r.solved).map((r) => r.actions)),
    wrongAccusations: round2(hasty.reduce((s, r) => s + r.wrongAccusations, 0) / Math.max(1, hasty.length)),
    deadEndRate: round2(exploring.reduce((s, r) => s + r.deadEnds, 0) / Math.max(1, exploring.reduce((s, r) => s + r.actions, 0))),
    hints: median(of("hinweise").map((r) => r.hints)),
    findsNeeded: [...coverage.finds].filter((id) => proofFinds.has(id)).length,
    findsAvailable: coverage.finds.size,
    firstGuessHits: round2(hasty.filter((r) => r.solved && r.wrongAccusations === 0 && r.readyAfter === null).length / Math.max(1, hasty.length)),
    redHerringPull: pull,
  };

  const warnings: string[] = [];
  const unsolved = STYLES.filter((s) => s !== "voreilig" && of(s).some((r) => !r.solved));
  if (unsolved.length > 0) warnings.push(`nicht jeder Spielstil löst den Fall (${unsolved.join(", ")}): Sackgasse ohne Lösung`);
  const earliest = Math.min(...runs.map((r) => r.readyAfter ?? Infinity));
  if (earliest <= 2) warnings.push(`schon nach ${earliest} Aktion${earliest === 1 ? "" : "en"} lösbar: zu früh`);
  if (metrics.deadEndRate > 0.5) warnings.push(`${Math.round(metrics.deadEndRate * 100)} % der Aktionen bringen nichts Neues`);
  for (const id of herrings) {
    if (!coverage.mentioned.has(id) && (pull[id] ?? 0) === 0) warnings.push(`falsche Fährte ${labelOf(pkg, "person", id)} wird nie berührt: kein Fund und keine Aussage nennt die Person`);
  }
  if (herrings.length > 0 && wrongTotal === 0) warnings.push("keine falsche Fährte zieht: der voreilige Spieler klagt nie falsch an");
  if (metrics.firstGuessHits >= 0.5) warnings.push(`Raten trifft zu oft: der erste Verdacht ohne Beweis stimmt in ${Math.round(metrics.firstGuessHits * 100)} % der Läufe`);
  const idle = [...coverage.finds].filter((id) => !proofFinds.has(id)).map((id) => labelOf(pkg, "evidence", id)).sort();
  if (idle.length > 0) warnings.push(`${idle.length} von ${coverage.finds.size} Funden trägt die Beweiskette nie: ${idle.join(", ")}`);

  const rating = difficulty(metrics);
  return Object.freeze({ rating, runs, metrics: Object.freeze(metrics), warnings: Object.freeze(warnings) });
}

// ---------- Text report (playtest CLI and check-case) ----------

const percent = (x: number) => `${Math.round(x * 100)} %`;

export function formatPlaytest(pkg: ResolvedCasePackage, report: CaseReport): string {
  const m = report.metrics;
  const of = (style: Style) => report.runs.filter((r) => r.style === style);
  const span = (xs: number[]) => (Math.min(...xs) === Math.max(...xs) ? `${xs[0]}` : `${median(xs)} (${Math.min(...xs)}–${Math.max(...xs)})`);
  const solvedShare = (style: Style) => {
    const runs = of(style);
    const solved = runs.filter((r) => r.solved).length;
    return solved === runs.length ? "" : `, ${solved}/${runs.length} gelöst`;
  };
  const pull = Object.entries(m.redHerringPull)
    .sort((a, b) => b[1] - a[1])
    .map(([id, share]) => `${labelOf(pkg, "person", id)} ${percent(share)}`)
    .join(", ");
  return [
    `  Schwierigkeit: ${difficultyText(report.rating)} (${report.rating}/5)`,
    `  Aktionen bis zur Lösung (Median): ${m.actionsToSolve} · Sackgassen: ${percent(m.deadEndRate)} · Hinweise nötig: ${m.hints}`,
    `  Funde: ${m.findsNeeded} für die Beweiskette von ${m.findsAvailable} · Fehlanklagen (voreilig): ${m.wrongAccusations} · erster Verdacht trifft: ${percent(m.firstGuessHits)}`,
    ...(pull === "" ? [] : [`  Falsche Fährten (Anteil der Fehlanklagen): ${pull}`]),
    `  Spielstile: systematisch ${span(of("systematisch").map((r) => r.actions))}${solvedShare("systematisch")} · neugierig ${span(of("neugierig").map((r) => r.actions))}${solvedShare("neugierig")} · voreilig ${span(of("voreilig").map((r) => r.actions))} · hinweise ${span(of("hinweise").map((r) => r.actions))}${solvedShare("hinweise")} Aktionen`,
    ...report.warnings.map((w) => `  Hinweis Spieltest: ${w}`),
  ].join("\n");
}
