import { rulesetAllows, type PublicContent, type ResolvedCasePackage } from "../domain/case-package.ts";
import { initialSession, reduceSession, type SessionOutput, type SessionState } from "../domain/case-session.ts";
import { scoreOf, starsText, type Score } from "./score.ts";
import { hintCount, hintsExhausted, type Hint } from "../domain/case-hints.ts";
import { encodeSessionSave, loadSessionSaveForPlayer } from "../domain/case-session-save.ts";
import type { EvidenceObservation, PlayerClaim as EvidenceClaim } from "../domain/evidence-presentation.ts";
import type { ConfrontationObservation, InterrogationObservation, PlayerClaim } from "../domain/interrogation.ts";
import { MESSAGES, type Lang, type Messages } from "./messages.ts";

// Text front end over the real session reducer. Pure: every command maps (game, line) to a new game
// and the text to print; file I/O lives in cli.ts. The player sees only PublicContent, released
// observations and labels of entities they already know. Every action goes through reduceSession.

/**
 * clockOrigin: wall-clock seconds of timeline second 0 (display convention of the case).
 * lang: UI language (default de); the package carries the case text of the same language.
 */
export type Game = { readonly pkg: ResolvedCasePackage; readonly state: SessionState; readonly clockOrigin: number; readonly lang?: Lang };
export type Step = { readonly game: Game; readonly text: string; readonly quit?: true };
export type Action = { readonly label: string; readonly event: unknown };


/**
 * Identifies the history a page was rendered from, so a stale form is refused even when another
 * history (new game, loaded save) has the same number of events. "0" for a fresh game.
 */
export function pageToken(game: Game): string {
  const { events } = game.state;
  if (events.length === 0) return "0";
  let hash = 0x811c9dc5;
  for (const unit of JSON.stringify(events)) hash = Math.imul(hash ^ unit.charCodeAt(0), 0x01000193) >>> 0;
  return `${events.length}-${hash.toString(16).padStart(8, "0")}`;
}

export const newGame = (pkg: ResolvedCasePackage, clockOrigin = 0, lang?: Lang): Game => ({ pkg, state: initialSession(pkg), clockOrigin, ...(lang === undefined ? {} : { lang }) });

/** UI text table of the game's language. */
export const msg = (game: Pick<Game, "lang">): Messages => MESSAGES[game.lang ?? "de"];

/** Player text for each session error code (German); per language in msg(game).errors. */
export const SESSION_ERRORS: Record<string, string> = MESSAGES.de.errors;

export function intro(game: Game): string {
  const { publicContent } = game.pkg;
  const m = msg(game).cli;
  return [`=== ${publicContent.title} ===`, "", publicContent.brief, "", `${m.mission}: ${publicContent.challengeQuestion}`, "", m.typeHelp].join("\n");
}

export function command(game: Game, line: string): Step {
  const [word = "", arg] = line.trim().split(/\s+/, 2);
  const pick = arg === undefined ? null : Number.parseInt(arg, 10);
  const say = (text: string): Step => ({ game, text });
  const m = msg(game);
  // German and English commands work in either language.
  switch (word.toLowerCase()) {
    case "":
      return say("");
    case "hilfe":
    case "help":
    case "?":
      return say(m.cli.help);
    case "ende":
    case "quit":
    case "exit":
      return { game, text: m.cli.bye, quit: true };
    case "fall":
    case "case":
      return say(caseText(game));
    case "bekannt":
    case "known":
      return say(knownText(game));
    case "journal":
    case "j":
      return say(journalText(game));
    case "untersuchen":
    case "u":
    case "investigate":
    case "i":
      return choose(game, investigations(game), pick, m.cli.investigations);
    case "fragen":
    case "f":
    case "ask":
    case "q":
      return choose(game, questions(game), pick, m.cli.questions);
    case "vorhalten":
    case "v":
    case "confront":
    case "c":
      return choose(game, confrontations(game), pick, m.cli.confront);
    case "anklage":
    case "a":
    case "accuse":
      return choose(game, accusations(game), pick, m.cli.accusation(game.pkg.publicContent.challengeQuestion));
    case "hinweis":
    case "h":
    case "hint": {
      const result = reduceSession(game.pkg, game.state, { type: "hint" });
      if (!result.ok) return say(result.code === "ACTION_UNAVAILABLE" ? hintUnavailableText(game) : m.errors[result.code]!);
      const next = { ...game, state: result.state };
      return { game: next, text: outputText(next, result.output) };
    }
    default:
      return say(m.cli.unknownCommand(word));
  }
}

function choose(game: Game, actions: Action[], pick: number | null, title: string): Step {
  const m = msg(game);
  if (pick === null) {
    if (actions.length === 0) return { game, text: m.cli.nothingAvailable(title) };
    return { game, text: [`${title}:`, ...actions.map((a, i) => `  ${i + 1}. ${a.label}`)].join("\n") };
  }
  const action = actions[pick - 1];
  if (action === undefined) return { game, text: m.cli.noNumber(pick) };
  const result = reduceSession(game.pkg, game.state, action.event);
  if (!result.ok) return { game, text: m.errors[result.code]! };
  const next = { ...game, state: result.state };
  return { game: next, text: `> ${action.label}\n${outputText(next, result.output)}` };
}

// ---------- Actions offered from the prefix Known ----------

export function known(game: Game, kind: string): { ref: string; label: string }[] {
  return game.state.knowledge.known.filter((k) => k.kind === kind).map((k) => ({ ref: k.ref, label: labelOf(game, k.ref) }));
}

export function investigations(game: Game): Action[] {
  const { verbs } = msg(game);
  const offer = (kind: string, action: string) =>
    known(game, kind).map(({ ref, label }) => ({ label: `${verbs[action]}: ${label}`, event: { type: "investigate", action, target: ref } }));
  return [...offer("location", "search_location"), ...offer("item", "examine_item"), ...offer("person", "examine_person")];
}

/** Whether the session would accept the action now (a dry run changes nothing). */
export const acceptedNow = (game: Game, action: Action): boolean => game.state.phase === "active" && reduceSession(game.pkg, game.state, action.event).ok;

/** Every question of a known NPC, before the dry run (questions() keeps the accepted ones). */
export function questionCandidates(game: Game): Action[] {
  const { pkg } = game;
  return known(game, "person").flatMap(({ ref, label }) => {
    const npcId = pkg.refs.resolve(ref)?.id;
    return pkg.publicContent.questionTexts
      .filter((q) => q.npc === npcId)
      .map((q) => ({ label: `${label}: ${q.text}`, event: { type: "interrogate", npc: ref, questionId: q.questionId } }));
  });
}

/** Questions of known NPCs that the session would accept now (a dry run changes nothing). */
export function questions(game: Game): Action[] {
  return questionCandidates(game).filter((action) => acceptedNow(game, action));
}

/**
 * Confrontations the session would accept now: every earlier statement of an NPC (one per
 * question) against every found evidence. Offered alike for true statements and lies.
 */
export function confrontations(game: Game): Action[] {
  return confrontationCandidates(game).filter((action) => acceptedNow(game, action));
}

/** Every earlier statement against every found evidence, before the dry run. */
export function confrontationCandidates(game: Game): Action[] {
  const { pkg, state } = game;
  if (state.phase !== "active") return [];
  const statements = new Map<string, { npc: string; questionId: string }>();
  for (const r of state.knowledge.observations) {
    if (r.source.kind === "npc" && "statement" in r.observation) statements.set(`${r.source.npc}|${r.source.questionId}`, r.source);
  }
  return [...statements.values()].flatMap(({ npc, questionId }) => {
    const npcId = pkg.refs.resolve(npc)?.id;
    const text = pkg.publicContent.questionTexts.find((q) => q.npc === npcId && q.questionId === questionId)?.text ?? questionId;
    return state.knowledge.discoveries
      .map((d) => ({
        label: msg(game).confrontLabel(labelOf(game, npc), text, labelOf(game, d.evidence)),
        event: { type: "confront", npc, questionId, evidence: d.evidence },
      }));
  });
}

/**
 * D8 convention: one candidate true, every other known candidate of the challenge false, all
 * submitted together. Only persons the player knows are offered; the session counts the rest as
 * not accused.
 */
export function accusations(game: Game): Action[] {
  const { pkg } = game;
  const ref = (kind: "person" | "event", id: string) => pkg.refs.refFor(kind, id)!;
  const isKnown = (kind: "person" | "event", id: string) => game.state.knowledge.known.some((k) => k.kind === kind && k.ref === ref(kind, id));
  // The player can only name what they know: the person and the crime event.
  const candidates = pkg.challenge.allowedClaims
    .filter((c) => c.kind === "personRoleForEvent" || c.kind === "personResponsibleForEvent")
    .filter((c) => isKnown("person", c.personId) && isKnown("event", c.eventId));
  const claim = (c: (typeof candidates)[number]) => {
    const base = { kind: c.kind, person: ref("person", c.personId), event: ref("event", c.eventId) };
    return c.kind === "personRoleForEvent" ? { ...base, role: c.role } : base;
  };
  return candidates.map((chosen) => ({
    label: labelOf(game, ref("person", chosen.personId)),
    event: { type: "accuse", literals: candidates.map((c) => ({ claim: claim(c), value: c === chosen })) },
  }));
}

// ---------- Rendering ----------

// Menus label every candidate action, so both lookups are indexed once per package and per
// knowledge state (both immutable) instead of scanned per label.
const labelIndex = new WeakMap<object, Map<string, string>>();
const knownIndex = new WeakMap<object, Set<string>>();

function labelOf(game: Game, ref: string): string {
  const known = game.state.knowledge.known;
  let refs = knownIndex.get(known);
  if (refs === undefined) knownIndex.set(known, (refs = new Set(known.map((k) => k.ref))));
  if (!refs.has(ref)) return "(unbekannt)";
  const { labels } = game.pkg.publicContent;
  let index = labelIndex.get(labels);
  if (index === undefined) {
    index = new Map();
    // First label per entity wins, as with find().
    for (const l of labels) if (!index.has(`${l.entity.kind}\0${l.entity.id}`)) index.set(`${l.entity.kind}\0${l.entity.id}`, l.label);
    labelIndex.set(labels, index);
  }
  const entity = game.pkg.refs.resolve(ref);
  return (entity && index.get(`${entity.kind}\0${entity.id}`)) || msg(game).unknownLabel;
}

function claimText(game: Game, claim: PlayerClaim | EvidenceClaim): string {
  const m = msg(game);
  const l = (ref: string) => labelOf(game, ref);
  const ql = (ref: string) => m.q(labelOf(game, ref));
  const clock = (at: number) => {
    const s = game.clockOrigin + at;
    return [Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, "0")).join(":");
  };
  const c = m.claim;
  switch (claim.kind) {
    case "personAt":
      return c.personAt(l(claim.person), clock(claim.at), ql(claim.location));
    case "eventHasParticipant":
      return c.eventHasParticipant(l(claim.person), ql(claim.event));
    case "eventHasItem":
      return c.eventHasItem(ql(claim.item), ql(claim.event));
    case "personResponsibleForEvent":
      return c.personResponsibleForEvent(l(claim.person), ql(claim.event));
    case "personRoleForEvent":
      return c.personRoleForEvent(l(claim.person), ql(claim.event), m.roles[claim.role]!);
    case "noPersonResponsibleForEvent":
      return c.noPersonResponsibleForEvent(ql(claim.event));
    case "eventCausedEvent":
      return c.eventCausedEvent(ql(claim.causeEvent), ql(claim.event));
    case "eventIntent":
      return c.eventIntent(ql(claim.event), claim.value === "intended" ? c.intent.intended : claim.value === "unintended" ? c.intent.unintended : c.intent.other);
    case "eventMechanism":
      return c.eventMechanism(ql(claim.event), claim.value === "ordinary" ? c.mechanism.ordinary : claim.value === "supernatural" ? c.mechanism.supernatural : c.mechanism.other);
  }
}

export function evidenceText(game: Game, o: EvidenceObservation): string {
  const m = msg(game);
  const lines = [`${m.findPrefix}${labelOf(game, o.evidence)}`, `  ${o.text}`];
  for (const report of o.reports) {
    const who = report.source.kind === "observation" ? m.observation : m.statementBy(labelOf(game, report.source.person));
    lines.push(`  ${who}: ${claimText(game, report.claim)} – ${report.stance === "affirms" ? m.affirms : m.denies}.`);
  }
  return lines.join("\n");
}

/**
 * The NPC's wording of one reply kind: their authored voice if the case has one (picked per
 * question, so repeated questions read the same), otherwise the neutral default of the language.
 */
function voiced(game: Game, npc: string, key: string, questionId: string): string | null {
  const npcId = game.pkg.refs.resolve(npc)?.id;
  const lines = game.pkg.publicContent.voices?.find((v) => v.npc === npcId)?.lines[key as keyof NonNullable<PublicContent["voices"]>[number]["lines"]];
  if (lines === undefined || lines.length === 0) {
    const m = msg(game);
    return key === "decline" ? m.declines : key === "stands_by" ? m.standsBy : (m.stances[key] ?? null);
  }
  let h = 0;
  for (const ch of questionId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return lines[h % lines.length]!;
}

function questionOf(game: Game, npc: string, questionId: string) {
  const npcId = game.pkg.refs.resolve(npc)?.id;
  return game.pkg.publicContent.questionTexts.find((q) => q.npc === npcId && q.questionId === questionId);
}

/** Whether the player broke this NPC's lie on the question before event index `before`. */
function admittedBefore(game: Game, npc: string, questionId: string, before: number): boolean {
  return game.state.knowledge.observations.some(
    (r) =>
      r.source.kind === "confrontation" &&
      r.source.eventIndex < before &&
      r.source.npc === npc &&
      r.source.questionId === questionId &&
      (r.observation as ConfrontationObservation).act === "admit",
  );
}

/**
 * The NPC's reply. Wording, first match wins: the question's own answer sentence (its admission
 * once the lie is broken), the NPC's voice, the plain stance. `at` is the record's event index.
 */
export function answerText(game: Game, o: InterrogationObservation, at = Infinity): string {
  const question = questionOf(game, o.npc, o.questionId);
  const m = msg(game);
  const head = m.answerHead(labelOf(game, o.npc), question?.text ?? o.questionId);
  const authored = question?.admission !== undefined && admittedBefore(game, o.npc, o.questionId, at) ? question.admission : question?.answer;
  const said = `${head}: ${m.q(authored ?? voiced(game, o.npc, o.act === "decline" ? "decline" : o.stance, o.questionId) ?? "")}`;
  return "statement" in o ? `${said}\n  ${m.aboutClaim(claimText(game, o.statement))}` : said;
}

/** Why a hint was refused: none for this case, or the last one was already as concrete as it gets. */
export function hintUnavailableText(game: Game): string {
  const offered = rulesetAllows(game.pkg.identity.rulesetVersion, "hints") && game.pkg.proof !== null;
  return offered && hintsExhausted(game.pkg, game.state.knowledge, game.state.events)
    ? msg(game).hint.exhausted
    : msg(game).cli.noHints;
}

/** Hints taken so far (they are session events, so saves keep the count). */
export const hintsUsed = (game: Game): number => hintCount(game.state.events);

/**
 * Player text of a hint: level 1 names only the kind of step, level 2 the (known) target, level 3
 * the exact menu entry. The accusation hint never names a person.
 */
export function hintText(game: Game, hint: Hint): string {
  const m = msg(game).hint;
  const head = m.head(hint.level);
  const label = hint.target === null ? null : labelOf(game, hint.target);
  if (hint.kind === "accuse") return `${head} ${m.accuse[hint.level]}`;
  if (hint.kind === "interrogate") {
    if (label === null) return `${head} ${m.someoneKnows}`;
    const npcId = hint.target === null ? undefined : game.pkg.refs.resolve(hint.target)?.id;
    const question = game.pkg.publicContent.questionTexts.find((q) => q.npc === npcId && q.questionId === hint.questionId);
    return question === undefined ? `${head} ${m.askWho(label)}` : `${head} ${m.ask(label, question.text)}`;
  }
  if (hint.kind === "confront") {
    if (label === null) return `${head} ${m.confrontVague}`;
    const npcId = hint.target === null ? undefined : game.pkg.refs.resolve(hint.target)?.id;
    const question = game.pkg.publicContent.questionTexts.find((q) => q.npc === npcId && q.questionId === hint.questionId);
    if (question === undefined || hint.evidence === null) return `${head} ${m.confrontWho(label)}`;
    return `${head} ${m.confront(label, question.text, labelOf(game, hint.evidence))}`;
  }
  if (label === null) return `${head} ${m.vague[hint.kind]}`;
  const concrete = m.concrete[hint.kind]!(label);
  return hint.level === 2 ? `${head} ${concrete}` : `${head} ${concrete} ${m.menu(`${msg(game).verbs[hint.kind]}: ${label}`)}`;
}

export function confrontationText(game: Game, o: ConfrontationObservation): string {
  const m = msg(game);
  const head = m.confrontHead(labelOf(game, o.npc), labelOf(game, o.evidence));
  if (o.act === "stands_by") return `${head}: ${m.q(voiced(game, o.npc, "stands_by", o.questionId) ?? "")}`;
  const admission = questionOf(game, o.npc, o.questionId)?.admission;
  const givesIn = voiced(game, o.npc, "gives_in", o.questionId);
  const said = admission ?? `${givesIn === null ? "" : `${givesIn} `}${voiced(game, o.npc, o.stance, o.questionId) ?? ""}`;
  return `${head}, ${m.givesIn}: ${m.q(said)}\n  ${m.aboutClaim(claimText(game, o.statement))}`;
}

function outputText(game: Game, output: SessionOutput): string {
  const m = msg(game);
  switch (output.type) {
    case "investigate":
      return output.observations.length === 0 ? m.nothingNew : output.observations.map((o) => evidenceText(game, o)).join("\n");
    case "interrogate":
      return answerText(game, output.observation);
    case "hint":
      return hintText(game, output.hint);
    case "confront":
      return confrontationText(game, output.observation);
    case "accuse": {
      if (output.verdict !== "solved") return m.notSolved;
      const solved = m.solved(hintsUsed(game));
      const score = scoreOf(game.pkg, game.state);
      const scored = score === null ? solved : `${solved}\n${scoreLine(game, score)}`;
      // The epilogue is shown only here, after a solving accusation.
      return game.pkg.publicContent.epilogue === undefined ? scored : `${scored}\n\n${m.resolutionHeading}\n${game.pkg.publicContent.epilogue}`;
    }
  }
}

function caseText(game: Game): string {
  const { publicContent } = game.pkg;
  const m = msg(game).cli;
  return [intro(game).replace(`\n\n${m.typeHelp}`, ""), "", m.rules, ...publicContent.publicRules.map((r) => `  - ${r.text}`)].join("\n");
}

function knownText(game: Game): string {
  const { groups } = msg(game).cli;
  return ["person", "location", "item", "event", "evidence"]
    .map((kind) => `${groups[kind]}: ${known(game, kind).map((k) => k.label).join(", ") || "–"}`)
    .join("\n");
}

function journalText(game: Game): string {
  const records = game.state.knowledge.observations;
  const used = hintsUsed(game);
  const m = msg(game);
  const footer = used === 0 ? [] : [m.hintsUsed(used)];
  if (records.length === 0) return [m.cli.journalEmpty, ...footer].join("\n");
  return [...records.map((r) => `[${r.source.eventIndex + 1}] ${recordText(game, r)}`), ...footer].join("\n");
}

export function recordText(game: Game, r: SessionState["knowledge"]["observations"][number]): string {
  switch (r.source.kind) {
    case "evidence":
      return evidenceText(game, r.observation as EvidenceObservation);
    case "npc":
      return answerText(game, r.observation as InterrogationObservation, r.source.eventIndex);
    case "confrontation":
      return confrontationText(game, r.observation as ConfrontationObservation);
  }
}

// ---------- Save / load: the Session C save format (MYST-SESSION-0001C) ----------

export function saveText(game: Game): { ok: true; text: string } | { ok: false; text: string } {
  const saved = encodeSessionSave(game.pkg, game.state);
  return saved.ok ? saved : { ok: false, text: msg(game).saveFailed };
}

/** Player facade: every failure reads the same; the save must be the exact canonical text. */
export function loadText(pkg: ResolvedCasePackage, text: string, clockOrigin = 0, lang?: Lang): { ok: true; game: Game } | { ok: false; text: string } {
  const loaded = loadSessionSaveForPlayer(pkg, text);
  return loaded.ok
    ? { ok: true, game: { pkg, state: loaded.state, clockOrigin, ...(lang === undefined ? {} : { lang }) } }
    : { ok: false, text: MESSAGES[lang ?? "de"].loadFailed };
}

/**
 * The same game in another language: replays the player's events on the package of that language
 * (same truth and refs, other player text). Null if the package does not accept the events.
 */
export function switchLang(game: Game, pkg: ResolvedCasePackage, lang: Lang): Game | null {
  let state = initialSession(pkg);
  for (const event of game.state.events) {
    const result = reduceSession(pkg, state, event);
    if (!result.ok) return null;
    state = result.state;
  }
  return { pkg, state, clockOrigin: game.clockOrigin, ...(lang === "de" ? {} : { lang }) };
}

/** The score in the game's language; German reads exactly like score.ts's scoreText. */
export function scoreLine(game: Pick<Game, "lang">, s: Score): string {
  const m = msg(game).score;
  return m.line(s.points, starsText(s.rank.stars), m.ranks[s.rank.stars]!, m.details(s.actions, s.par, s.hints, s.wrongAccusations));
}
