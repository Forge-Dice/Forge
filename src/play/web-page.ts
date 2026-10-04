import { rulesetAllows } from "../domain/case-package.ts";
import { scoreOf, starsText } from "./score.ts";
import { difficultyDots, type Difficulty } from "./difficulty.ts";
import { accusations, confrontations, hintsUsed, investigations, pageToken, known, msg, questions, recordText, type Action, type Game } from "./game.ts";
import { DEFAULT_LANG, MESSAGES, type Lang, type Messages } from "./messages.ts";

// HTML views of the local browser front end. Pure: (game, feedback) -> page. Every label comes from
// PublicContent or released observations through the CLI's own helpers; actions are addressed by
// their position in the current menu, so no ref or internal id reaches the page.

export type Feedback = {
  readonly tone: "info" | "ok" | "warn";
  readonly title: string;
  readonly lines: readonly string[];
};
export type CaseCard = { readonly slug: string; readonly title: string; readonly teaser: string; readonly progress: string | null; readonly difficulty?: Difficulty };

export const escape = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const GROUPS = ["person", "location", "item", "event", "evidence"] as const;

/** Link to the same page in the other language; the server remembers the choice in a cookie. */
export function langSwitch(m: Messages, back: string): string {
  const other = m.web.otherLang;
  return `<a class="lang-link" href="/sprache?l=${other.lang}&amp;zurueck=${encodeURIComponent(back)}" hreflang="${other.lang}" lang="${other.lang}" title="${escape(other.title)}">${escape(other.label)}</a>`;
}

const lastEvent = (game: Game) => game.state.events.length - 1;
const isNew = (game: Game, eventIndex: number) => eventIndex === lastEvent(game);

/** Splits a multi-line helper text into its head line and indented detail lines. */
function lines(text: string): { head: string; rest: string[] } {
  const [head = "", ...rest] = text.split("\n");
  return { head, rest: rest.map((l) => l.trim()).filter((l) => l !== "") };
}

const paragraphs = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => `<p>${escape(p.trim())}</p>`)
    .join("");

/** Page frame shared by game, help and the case editor; extraStyle is appended to the base sheet. */
export function layout(title: string, body: string, bodyClass = "", extraStyle = "", lang: Lang = DEFAULT_LANG): string {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#1c1814">
<title>${escape(title)}</title>
<style>${STYLE}${extraStyle}</style>
</head>
<body${bodyClass === "" ? "" : ` class="${bodyClass}"`}>
${body}
</body>
</html>
`;
}

// ---------- Case selection ----------

/** Measured by the playtest bot; dots for the eye, the word for everyone. */
const difficultyTag = (d: Difficulty | undefined, m: Messages): string =>
  d === undefined ? "" : `<span class="difficulty" title="${escape(m.web.difficultyTitle(d))}"><span class="visually-hidden">${m.web.difficultyHidden}</span><span class="dots" aria-hidden="true">${difficultyDots(d)}</span> ${m.difficulty[d]}</span>`;

export type RecentCase = { readonly slug: string; readonly title: string; readonly progress: string | null };
export type CaseListExtras = { readonly recent?: readonly RecentCase[]; readonly feedback?: Feedback | null };

const DIE = `<svg class="die" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect x="6" y="6" width="36" height="36" rx="7" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="16" cy="16" r="3.2" fill="currentColor"/><circle cx="32" cy="16" r="3.2" fill="currentColor"/><circle cx="24" cy="24" r="3.2" fill="currentColor"/><circle cx="16" cy="32" r="3.2" fill="currentColor"/><circle cx="32" cy="32" r="3.2" fill="currentColor"/></svg>`;

export function renderCaseList(cases: readonly CaseCard[], editorLink = false, extras: CaseListExtras = {}, lang: Lang = DEFAULT_LANG): string {
  const m = MESSAGES[lang].web;
  const recent = extras.recent ?? [];
  const cards = cases
    .map((c, i) => {
      const solved = c.progress === m.solvedBadge;
      const badge = c.progress === null ? `<span class="badge">${c.slug === "lernfall" ? m.learnBadge : m.newBadge}</span>` : `<span class="badge${solved ? " solved" : ""}">${escape(c.progress)}</span>`;
      return `<li><a class="case-card${solved ? " is-solved" : ""}" href="/fall/${escape(c.slug)}"><span class="case-no">${m.fileNo(String(i + 1).padStart(3, "0"))}</span><h2>${escape(c.title)}</h2>${difficultyTag(c.difficulty, MESSAGES[lang])}<p>${escape(c.teaser)}</p><span class="best" data-best="${escape(c.slug)}" hidden></span><span class="case-foot">${badge}<span class="open-file" aria-hidden="true">${m.openFile}</span></span>${
        solved ? `<span class="stamp small" aria-hidden="true">${m.solvedBadge}</span>` : ""
      }</a></li>`;
    })
    .join("");
  return layout(
    m.casesTitle,
    `<a class="skip" href="#faelle">${m.skipCases}</a>
<header class="masthead"><p class="kicker">${m.office}</p><h1>${m.appTitle}</h1><p class="lead">${escape(m.lead)}</p><p class="lead">${m.newHere(`<a href="/fall/lernfall">${escape(m.learnTitle)}</a>`)}</p><p><a class="button ghost" href="/hilfe">${m.howTo} <span aria-hidden="true">→</span></a>${editorLink ? ` <a class="button ghost" href="/editor">${m.editor}</a>` : ""} ${langSwitch(MESSAGES[lang], "/")}</p></header>
<main id="faelle" class="shelf"><h2 class="visually-hidden">${m.openFiles}</h2><ul class="cases">${cards}</ul>
<div class="tools">
<section class="random-case dice-box" aria-labelledby="zufall"><div class="tool-head">${DIE}<div><p class="kicker">${m.randomKicker}</p><h2 id="zufall">${m.randomTitle}</h2></div></div><p>${escape(m.randomText)}</p><form method="post" action="/zufall" class="seed-form"><label for="seed">Seed</label><input id="seed" name="seed" inputmode="numeric" pattern="[0-9]{0,9}" maxlength="9" placeholder="${escape(m.seedPlaceholder)}" autocomplete="off"><label for="stufe">${m.levelLabel}</label><select id="stufe" name="stufe"><option value="">${m.anyLevel}</option>${[1, 2, 3, 4, 5].map((d) => `<option value="${d}">${d} ${MESSAGES[lang].difficulty[d]}</option>`).join("")}</select><button type="submit" class="primary">${m.openRandom}</button></form><p class="hint">${escape(m.levelHint)}</p>${
      recent.length === 0
        ? ""
        : `<h3>${m.recentTitle}</h3><ul class="recent">${recent.map((r) => `<li><a href="/fall/${escape(r.slug)}">${escape(r.title)}</a>${r.progress === null ? "" : ` <span class="badge${r.progress === m.solvedBadge ? " solved" : ""}">${escape(r.progress)}</span>`}</li>`).join("")}</ul>`
    }</section>
<section class="load-any" aria-labelledby="laden"><h2 id="laden">${m.loadAnyTitle}</h2><p>${escape(m.loadAnyText)}</p><label class="button" tabindex="0" role="button" id="load-any-label">${m.chooseFile}<input type="file" id="load-any" accept=".json,application/json" hidden></label></section>
<section class="load-any" aria-labelledby="eigen"><h2 id="eigen">${m.ownCaseTitle}</h2><p>${escape(m.ownCaseText)}</p><a class="button" href="/eigener-fall">${m.ownCaseButton}</a></section>
</div>
<p class="hint">${escape(m.casesHint)}</p></main>
${extras.feedback ? notice(extras.feedback, MESSAGES[lang]) : ""}
<script>${homeScript(MESSAGES[lang])}</script>`,
    "page-cases",
    "",
    lang,
  );
}

// ---------- Game page ----------

type FormOptions = { cls?: string; hidden?: string | undefined; confirm?: string };

// A short visible label gets its context (the verb) as hidden text, so the accessible name stays
// the full menu label while the visible label is wrapped and never ends a button bare.
function actionForm(game: Game, slug: string, group: "u" | "f" | "v" | "a" | "h", index: number, label: string, o: FormOptions = {}): string {
  const confirm = o.confirm === undefined ? "" : ` data-confirm="${escape(o.confirm)}"`;
  const hidden = o.hidden === undefined ? "" : `<span class="visually-hidden">${escape(o.hidden)}</span>`;
  return `<form method="post" action="/fall/${slug}/act"${confirm}><input type="hidden" name="group" value="${group}"><input type="hidden" name="n" value="${index + 1}"><input type="hidden" name="at" value="${pageToken(game)}"><button type="submit"${o.cls ? ` class="${o.cls}"` : ""}>${hidden === "" ? escape(label) : `${hidden}<span>${escape(label)}</span>`}</button></form>`;
}

/** Keys of what the player already did, to mark repeated actions (never rendered). */
function doneKeys(game: Game): Set<string> {
  return new Set(game.state.events.map((e) => JSON.stringify(e)));
}
const actionKey = (a: Action) => JSON.stringify(a.event);

/** Investigations grouped by their verb ("Ort durchsuchen: Innenhof" -> Orte / Innenhof). */
function investigationList(game: Game, slug: string, fresh: ReadonlySet<string>): string {
  const actions = investigations(game);
  const m = msg(game).web;
  if (actions.length === 0) return `<p class="muted">${m.nothingToInvestigate}</p>`;
  const done = doneKeys(game);
  const groups = new Map<string, string[]>();
  actions.forEach((a, i) => {
    const split = a.label.indexOf(": ");
    const verb = split < 0 ? "" : a.label.slice(0, split);
    const target = split < 0 ? a.label : a.label.slice(split + 2);
    const cls = ["act", done.has(actionKey(a)) ? "done" : "", fresh.has(a.label) ? "fresh" : ""].filter(Boolean).join(" ");
    groups.set(verb, [...(groups.get(verb) ?? []), actionForm(game, slug, "u", i, target, { cls, hidden: verb === "" ? undefined : `${verb}: ` })]);
  });
  return [...groups]
    .map(([verb, forms]) => `<div class="group"><h3>${escape(verb === "" ? m.investigate : verb)}</h3><div class="actions">${forms.join("")}</div></div>`)
    .join("");
}

/** V2: hold a found evidence against an earlier statement; shown only when something can be held up. */
function confrontationSection(game: Game, slug: string, actions: readonly Action[]): string {
  if (actions.length === 0) return "";
  const done = doneKeys(game);
  const forms = actions.map((a, i) => actionForm(game, slug, "v", i, a.label, { cls: ["act", done.has(actionKey(a)) ? "done" : ""].filter(Boolean).join(" ") }));
  return `\n<section id="vorhalten" class="card" tabindex="-1"><h2>${msg(game).web.confront}</h2><div class="actions">${forms.join("")}</div></section>`;
}

/** Interrogation questions grouped by NPC ("Name: Frage" labels from the CLI menu). */
function questionList(game: Game, slug: string, fresh: ReadonlySet<string>): string {
  const actions = questions(game);
  const m = msg(game).web;
  if (actions.length === 0) return `<p class="muted">${m.noQuestions}</p>`;
  const done = doneKeys(game);
  const byNpc = new Map<string, { forms: string[]; fresh: number; done: number }>();
  actions.forEach((a, i) => {
    const split = a.label.indexOf(": ");
    const npc = a.label.slice(0, split);
    const g = byNpc.get(npc) ?? { forms: [], fresh: 0, done: 0 };
    const isDone = done.has(actionKey(a));
    const isFresh = fresh.has(a.label);
    g.forms.push(actionForm(game, slug, "f", i, a.label.slice(split + 2), { cls: ["q", isDone ? "done" : "", isFresh ? "fresh" : ""].filter(Boolean).join(" ") }));
    g.fresh += isFresh ? 1 : 0;
    g.done += isDone ? 1 : 0;
    byNpc.set(npc, g);
  });
  return [...byNpc]
    .map(([npc, g]) => {
      const initials = npc
        .split(/\s+/)
        .map((w) => w[0] ?? "")
        .join("")
        .slice(0, 2);
      const meta = `${m.questionCount(g.forms.length)}${g.done > 0 ? ` · ${m.asked(g.done)}` : ""}`;
      return `<details class="witness" open><summary><span class="avatar" aria-hidden="true">${escape(initials)}</span><span class="npc-name">${escape(npc)}</span><span class="npc-meta">${meta}</span>${
        g.fresh > 0 ? `<span class="tag">${m.fresh(g.fresh)}</span>` : ""
      }</summary><div class="actions questions">${g.forms.join("")}</div></details>`;
    })
    .join("");
}

function journalEntry(game: Game, kind: string, text: string, eventIndex: number): string {
  const m = msg(game);
  const fresh = isNew(game, eventIndex);
  const { head, rest } = lines(text);
  const isEvidence = kind === "evidence";
  const title = isEvidence && head.startsWith(m.findPrefix) ? head.slice(m.findPrefix.length) : head;
  const details = rest.map((l) => `<p class="${m.factPattern.test(l) ? "fact" : /^\(/.test(l) ? "aside" : "text"}">${escape(l)}</p>`).join("");
  return `<li value="${eventIndex + 1}" class="${kind}${fresh ? " new" : ""}"><span class="entry-no" aria-hidden="true">${eventIndex + 1}</span><div class="entry"><p class="entry-kind">${
    isEvidence ? m.web.find : m.web.statement
  }${fresh ? ` <span class="tag">${m.web.newTag}</span>` : ""}</p><p class="entry-title">${escape(title)}</p>${details}</div></li>`;
}

function journal(game: Game): string {
  const records = game.state.knowledge.observations;
  const used = hintsUsed(game);
  const m = msg(game);
  const hints = used === 0 ? "" : `<p class="muted hints-used">${m.hintsUsed(used)}</p>`;
  if (records.length === 0) return `<p class="muted">${m.web.journalEmpty}</p>${hints}`;
  // Newest first: what just happened is on top.
  return `${hints}<ol class="journal" reversed>${[...records]
    .reverse()
    .map((r) =>
      journalEntry(
        game,
        r.source.kind,
        recordText(game, r),
        r.source.eventIndex,
      ),
    )
    .join("")}</ol>`;
}

/** Graded hint on demand; every hint is a session event and counted in the journal and the closing. */
function hintCard(game: Game, slug: string): string {
  const used = hintsUsed(game);
  const m = msg(game);
  return `<section id="hinweis" class="card hint"><h2>${m.web.hint}</h2><p class="muted">${m.web.hintIntro}</p><div class="actions">${actionForm(game, slug, "h", 0, m.web.getHint)}</div><p class="muted">${m.hintsUsed(used)}</p></section>`;
}

function knownList(game: Game): string {
  const fresh = new Set(
    game.state.knowledge.known.filter((k) => k.firstSeen.kind === "event" && isNew(game, k.firstSeen.eventIndex)).map((k) => k.ref),
  );
  const m = msg(game).web;
  return GROUPS.map((kind) => {
    const items = known(game, kind).map((k) => `<li${fresh.has(k.ref) ? ` class="new"` : ""}>${escape(k.label)}${fresh.has(k.ref) ? ` <span class="tag">${m.newTag}</span>` : ""}</li>`);
    return `<h3>${m.groups[kind]} <span class="count">${items.length}</span></h3>${items.length === 0 ? `<p class="muted">–</p>` : `<ul class="chips">${items.join("")}</ul>`}`;
  }).join("");
}

/** The person the last (solving) accusation named, from the player's own event and their Known. */
function accusedName(game: Game): string | null {
  const last = game.state.events.at(-1);
  if (last?.type !== "accuse") return null;
  const chosen = last.literals.find((l) => l.value && "person" in l.claim);
  const ref = chosen !== undefined && "person" in chosen.claim ? chosen.claim.person : null;
  return known(game, "person").find((k) => k.ref === ref)?.label ?? null;
}

/** Points and rank of the solved case; the page script keeps the best per case in localStorage. */
function scoreBlock(game: Game, slug: string): string {
  const score = scoreOf(game.pkg, game.state);
  if (score === null) return "";
  const m = msg(game).score;
  const rank = m.ranks[score.rank.stars]!;
  return `<p class="score" data-score="${score.points}" data-stars="${score.rank.stars}" data-rank="${escape(rank)}" data-slug="${escape(slug)}"><span class="score-stars" aria-hidden="true">${starsText(score.rank.stars)}</span> <strong>${m.points(score.points)}</strong>, ${escape(m.rank(rank))}<span class="best-note" hidden></span><br><small>${escape(m.details(score.actions, score.par, score.hints, score.wrongAccusations))}</small></p>`;
}

function closing(game: Game, slug: string): string {
  const { publicContent } = game.pkg;
  const name = accusedName(game);
  const evidence = known(game, "evidence").map((k) => k.label);
  const tries = game.state.verdicts.length;
  const steps = game.state.events.length;
  const m = msg(game).web;
  return `<div id="ende" class="closing-wrap" tabindex="-1"><section class="closing"><h2>${m.caseSolved}</h2>
<span class="stamp" aria-hidden="true">${m.solvedBadge}</span>
<p class="big">${escape(name === null ? m.yourAccusation : m.itWas(name))}</p>
${publicContent.epilogue === undefined ? "" : `<h3 class="epilogue-title">${m.resolution}</h3><div class="epilogue">${paragraphs(publicContent.epilogue)}</div>`}
${scoreBlock(game, slug)}
<dl class="stats"><div><dt>${m.statActions}</dt><dd>${steps}</dd></div><div><dt>${m.statHints}</dt><dd>${hintsUsed(game)}</dd></div><div><dt>${m.statAccusations(tries)}</dt><dd>${tries}</dd></div><div><dt>${m.statEvidence}</dt><dd>${evidence.length}</dd></div></dl>
<p><strong>${escape(publicContent.challengeQuestion)}</strong> – ${m.answerFulfils}</p>
<p>${m.took(steps, tries)}</p>
${evidence.length === 0 ? "" : `<h3>${m.yourEvidence}</h3><ul class="chips">${evidence.map((e) => `<li>${escape(e)}</li>`).join("")}</ul>`}
<details class="rules"><summary>${m.whatDecided}</summary><ul>${publicContent.publicRules.map((r) => `<li>${escape(r.text)}</li>`).join("")}</ul></details>
<div class="actions end-actions"><form method="post" action="/fall/${slug}/new"><button type="submit" class="primary">${m.playAgain}</button></form><a class="button" href="/">${m.otherCase}</a></div>
</section></div>`;
}

function notice(feedback: Feedback, m: Messages): string {
  const body = feedback.lines
    .map((l) => {
      const { head, rest } = lines(l);
      const isFind = head.startsWith(m.findPrefix);
      return `<div class="${isFind ? "find" : "line"}">${isFind ? `<p class="find-title"><span class="tag">${m.web.newTag}</span> ${escape(head.slice(m.findPrefix.length))}</p>` : `<p>${escape(head)}</p>`}${rest
        .map((r) => `<p class="${m.factPattern.test(r) ? "fact" : "text"}">${escape(r)}</p>`)
        .join("")}</div>`;
    })
    .join("");
  return `<section id="notice" class="notice ${feedback.tone}" role="status" aria-labelledby="notice-title" tabindex="-1"><div class="notice-head"><h2 id="notice-title">${escape(
    feedback.title,
  )}</h2><button type="button" class="close" data-close aria-label="${m.web.closeNotice}">×</button></div><div class="notice-body">${body}</div></section>`;
}

export function renderGame(game: Game, slug: string, feedback: Feedback | null, fresh: ReadonlySet<string> = new Set()): string {
  const { publicContent } = game.pkg;
  const solved = game.state.phase === "solved";
  const steps = game.state.events.length;
  const all = msg(game);
  const m = all.web;
  const confront = solved ? [] : confrontations(game);
  const nav: [string, string, string][] = solved
    ? [["ende", m.navResolution, "E"], ["akte", m.navFile, "F"], ["journal", m.navJournal, "J"]]
    : [
        ["akte", m.navFile, "F"],
        ["untersuchen", m.navInvestigate, "U"],
        ["verhoeren", m.navInterrogate, "V"],
        ...(confront.length > 0 ? [["vorhalten", m.confront, "H"] as [string, string, string]] : []),
        ["journal", m.navJournal, "J"],
        ["anklage", m.navAccuse, "A"],
        ["bekannt", m.navKnown, "B"],
      ];
  const accuse = accusations(game);
  const body = `<a class="skip" href="#spiel">${m.skipGame}</a>
<header class="topbar"><a class="home" href="/"><span aria-hidden="true">←</span> ${m.allCases}</a><div class="case-title"><p class="kicker">${m.caseFile}</p><h1>${escape(publicContent.title)}</h1></div>${langSwitch(all, `/fall/${slug}`)}<a class="help-link" href="/hilfe" aria-keyshortcuts="?"><span aria-hidden="true">?</span><span class="help-text"> ${m.help}</span></a><span class="badge${
    solved ? " solved" : ""
  }">${solved ? m.solvedBadge : `${m.actions(steps)}<span class="badge-more"> · ${m.evidenceCount(known(game, "evidence").length)}</span>`}</span></header>
<nav class="tabs" aria-label="${m.caseAreas}"><ul>${nav.map(([id, label, key]) => `<li><a href="#${id}" data-key="${key}" aria-keyshortcuts="${key}">${label}<kbd aria-hidden="true">${key}</kbd></a></li>`).join("")}</ul></nav>
${feedback === null ? "" : notice(feedback, all)}
<main id="spiel" class="desk${solved ? " is-solved" : ""}">
<aside class="dossier" aria-label="${m.caseFile}">
<details id="akte" class="folder" tabindex="-1"${steps === 0 ? " open" : ""}><summary><h2>${m.caseFile}</h2><span class="summary-hint">${m.caseFileSummary}</span></summary>
<div class="folder-body"><p class="mission"><span class="label">${m.mission}</span>${escape(publicContent.challengeQuestion)}</p>
<div class="brief">${paragraphs(publicContent.brief)}</div>
<h3>${m.rules}</h3><ul class="rules-list">${publicContent.publicRules.map((r) => `<li>${escape(r.text)}</li>`).join("")}</ul></div></details>
</aside>
<div class="play">
${solved ? closing(game, slug) : ""}
${
  solved
    ? ""
    : `<section id="untersuchen" class="card" tabindex="-1"><h2>${m.investigate}</h2>${investigationList(game, slug, fresh)}</section>
<section id="verhoeren" class="card" tabindex="-1"><h2>${m.interrogate}</h2>${questionList(game, slug, fresh)}</section>${confrontationSection(game, slug, confront)}`
}
<section id="journal" class="card" tabindex="-1"><h2>${solved ? m.yourPath : m.journal}</h2>${journal(game)}</section>
${
  solved
    ? ""
    : `<section id="anklage" class="card accuse" tabindex="-1"><h2>${m.accusation}</h2><p class="mission">${escape(publicContent.challengeQuestion)}</p><p class="muted">${m.wrongAccusationNote}</p>${
        accuse.length === 0
          ? `<p class="muted">${m.noAccusation}</p>`
          : `<div class="actions suspects">${accuse.map((a, i) => actionForm(game, slug, "a", i, a.label, { cls: "suspect", confirm: a.label })).join("")}</div>`
      }</section>`
}
</div>
<aside class="dossier side" aria-label="${m.knownAndState}">
<section id="bekannt" class="card" tabindex="-1"><h2>${m.known}</h2>${knownList(game)}</section>
${solved || !rulesetAllows(game.pkg.identity.rulesetVersion, "hints") ? "" : hintCard(game, slug)}
<section class="card save"><h2>${m.saveState}</h2>
<div class="actions"><a class="button" href="/fall/${slug}/save" download="${slug}.save.json">${m.save}</a>
<label class="button" tabindex="0" role="button" id="load-label">${m.load}<input type="file" id="load" accept=".json,application/json" hidden></label>
<form method="post" action="/fall/${slug}/new" data-confirm-new><button type="submit">${m.restart}</button></form></div></section>
</aside>
</main>
<footer class="keys"><p class="key-list"><span class="visually-hidden">${m.shortcuts}</span>${nav.map(([, label, key]) => `<kbd>${key}</kbd> ${label}`).join(" · ")} · <kbd>Esc</kbd> ${m.closeShort} · <kbd>?</kbd> ${m.help}</p><p><button type="button" class="ghost" data-intro>${m.showIntro}</button> <a class="button ghost" href="/hilfe">${m.help}</a></p></footer>
${intro(all)}
<dialog id="confirm" aria-labelledby="confirm-title"><form method="dialog"><h2 id="confirm-title"></h2><p id="confirm-text"></p><div class="actions"><button value="cancel" class="secondary">${m.cancel}</button><button value="ok" class="danger" id="confirm-ok">${m.accuse}</button></div></form></dialog>
<script>${script(slug, solved, feedback !== null, all)}</script>`;
  return layout(publicContent.title, body, "", "", game.lang ?? DEFAULT_LANG);
}

// The case list: a chosen save file is posted as text and the server opens the matching case.
const homeScript = (all: Messages): string => {
  const js = (text: unknown) => JSON.stringify(text).replace(/</g, "\\u003c");
  return `(() => {
// Best score per case, written by the closing page of that case.
document.querySelectorAll("[data-best]").forEach((el) => {
  let best = null;
  try { best = JSON.parse(localStorage.getItem("kriminalfaelle.best." + el.dataset.best) || "null"); } catch {}
  if (!best || typeof best.points !== "number") return;
  el.textContent = ${js(all.score.best)} + best.points + ${js(all.score.pointsWord)} + " · " + "★".repeat(best.stars) + "☆".repeat(3 - best.stars) + " " + (${js(all.score.ranks)}[best.stars] || best.rank);
  el.hidden = false;
});
const visit = (url) => (typeof window.kfVisit === "function" ? window.kfVisit(url) : (location.href = url));
const input = document.getElementById("load-any"), label = document.getElementById("load-any-label");
input.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const res = await fetch("/laden", { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, body: await file.text() });
  const to = res.ok ? await res.text() : "/";
  visit(to.startsWith("/") ? to : "/");
});
label.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
const sheet = document.getElementById("notice");
const close = () => { if (sheet) sheet.hidden = true; };
if (sheet) { sheet.querySelector("[data-close]").addEventListener("click", close); sheet.focus(); }
document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
})();`;
};

// ---------- Introduction and help ----------

const ICON = (paths: string) =>
  `<svg class="icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

/** The four steps of the introduction; the help page reuses them as its overview. */
/** Icons of the four introduction steps (text in the message table); the help page reuses them. */
const INTRO_ICONS: readonly string[] = [
  ICON(`<path d="M10 6h20l8 8v28H10z"/><path d="M30 6v8h8"/><path d="M16 22h16M16 28h16M16 34h10"/>`),
  ICON(`<circle cx="20" cy="20" r="11"/><path d="M28 28l12 12"/>`),
  ICON(`<path d="M12 8h22a4 4 0 0 1 4 4v28H16a4 4 0 0 1-4-4z"/><path d="M12 36a4 4 0 0 1 4-4h22"/><path d="M19 15h12M19 21h8"/>`),
  ICON(`<path d="M8 40h20"/><path d="M14 34h8"/><path d="M22 10l12 12"/><path d="M17 15l12 12"/><path d="M20 12l-6 6 6 6 6-6z"/><path d="M28 20l12 12"/>`),
];
const introSteps = (m: Messages) => m.web.introSteps.map((st, i) => ({ ...st, icon: INTRO_ICONS[i]! }));

function intro(all: Messages): string {
  const m = all.web;
  const INTRO_STEPS = introSteps(all);
  const steps = INTRO_STEPS.map(
    (st, i) => `<section data-step${i === 0 ? "" : " hidden"}>${st.icon}<h3>${escape(st.title)}</h3><p>${escape(st.text)}</p></section>`,
  ).join("");
  return `<dialog id="intro" class="intro" aria-labelledby="intro-title"><form method="dialog"><div class="intro-head"><h2 id="intro-title" class="kicker">${m.introTitle}</h2><span class="intro-count">${m.step} <span data-count>1</span> ${m.of} ${INTRO_STEPS.length}</span><button value="skip" class="ghost skip-intro">${m.skip}</button></div>
<div class="intro-steps" aria-live="polite">${steps}</div>
<div class="intro-foot"><div class="dots" aria-hidden="true">${INTRO_STEPS.map((_, i) => `<span${i === 0 ? ` class="on"` : ""}></span>`).join("")}</div><button type="button" data-prev disabled>${m.back}</button><button type="button" data-next class="primary">${m.next}</button></div></form></dialog>`;
}

/** The manual: same look as the cases, no case content, so nothing of any case can leak here. */
export function renderHelp(lang: Lang = DEFAULT_LANG): string {
  const all = MESSAGES[lang];
  const m = all.web;
  const overview = introSteps(all).map((st, i) => `<li><span class="step-no" aria-hidden="true">${i + 1}</span>${st.icon}<div><h3>${escape(st.title)}</h3><p>${escape(st.text)}</p></div></li>`).join("");
  const signs = [`<span class="tag">${m.newTag}</span>`, `<span class="legend-dot"></span>`, `<span class="legend-done">✓</span>`, `<span class="legend-marker">${m.legendMarker}</span>`];
  const legend: [string, string][] = signs.map((sign, i) => [sign, m.legend[i]!]);
  const keys = m.keys;
  return layout(
    m.help,
    `<a class="skip" href="#hilfe">${m.skipHelp}</a>
<header class="topbar"><a class="home" href="/"><span aria-hidden="true">←</span> ${m.allCases}</a><div class="case-title"><p class="kicker">${m.manual}</p><h1>${m.howTo}</h1></div>${langSwitch(all, "/hilfe")}</header>
<main id="hilfe" class="manual">
<section class="card"><h2>${m.aboutTitle}</h2><p class="lead-ink">${escape(m.about)}</p></section>
<section class="card"><h2>${m.fourSteps}</h2><ol class="overview">${overview}</ol></section>
<section class="card"><h2>${m.readingTitle}</h2><p>${escape(m.reading)}</p><p>${escape(m.readingRules)}</p></section>
<section class="card"><h2>${m.signsTitle}</h2><dl class="legend">${legend.map(([sign, text]) => `<div><dt>${sign}</dt><dd>${escape(text)}</dd></div>`).join("")}</dl></section>
<section class="card"><h2>${m.saveState}</h2><p>${escape(m.saveText)}</p></section>
<section class="card"><h2>${m.keyboard}</h2><dl class="keymap">${keys.map(([k, t]) => `<div><dt><kbd>${escape(k)}</kbd></dt><dd>${escape(t)}</dd></div>`).join("")}</dl><p class="muted">${m.keyboardNote}</p></section>
<p class="manual-foot"><a class="button primary-link" href="/">${m.toCases}</a></p>
</main>`,
    "",
    "",
    lang,
  );
}

// Progressive enhancement only: every action is a plain form post without it. Loading reads the
// chosen file in the browser and posts its exact text; the server decodes it.
const script = (slug: string, solved: boolean, hasNotice: boolean, all: Messages) => {
  const m = all.web;
  const js = (text: string) => JSON.stringify(text).replace(/</g, "\\u003c");
  return `(() => {
// A solved case stores its best score (the case list shows it).
const scoreEl = document.querySelector(".score[data-score]");
if (scoreEl) {
  const key = "kriminalfaelle.best." + scoreEl.dataset.slug, now = { points: Number(scoreEl.dataset.score), stars: Number(scoreEl.dataset.stars), rank: scoreEl.dataset.rank };
  try {
    const old = JSON.parse(localStorage.getItem(key) || "null");
    const note = scoreEl.querySelector(".best-note");
    if (!old || now.points > old.points) { localStorage.setItem(key, JSON.stringify(now)); if (old) { note.textContent = ${js(all.score.newBest)}; note.hidden = false; } }
    else { note.textContent = " · " + ${js(all.score.best)} + old.points + ${js(all.score.pointsWord)}; note.hidden = false; }
  } catch {}
}
// The single-file build hosts pages in a frame and provides its own navigation as kfVisit.
const visit = (url) => (typeof window.kfVisit === "function" ? window.kfVisit(url) : (location.href = url));
const path = "/fall/${slug}", store = { get(k) { try { return sessionStorage.getItem(path + k); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(path + k, v); } catch {} }, del(k) { try { sessionStorage.removeItem(path + k); } catch {} } };
const load = document.getElementById("load"), loadLabel = document.getElementById("load-label");
load.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  // Not following the redirect: its GET would consume the load result before the page reloads.
  try { await fetch(path + "/load", { method: "POST", redirect: "manual", headers: { "content-type": "text/plain;charset=utf-8" }, body: await file.text() }); } catch {}
  visit(path);
});
loadLabel.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); load.click(); } });

// Keep the reading position across the post/redirect round trip; the result shows as a sheet.
const y = store.get(":y"), from = store.get(":from");
store.del(":y");
if (${solved}) { const end = document.getElementById("ende"); end.scrollIntoView({ block: "start", behavior: "instant" }); end.focus({ preventScroll: true }); }
else if (y !== null && ${hasNotice}) window.scrollTo({ top: Number(y), behavior: "instant" });
const sheet = document.getElementById("notice");
const closeSheet = () => {
  if (!sheet || sheet.hidden) return;
  sheet.hidden = true;
  const back = from && document.querySelector("#" + from + " button:not(.close), #" + from);
  if (back) back.focus({ preventScroll: true });
};
if (sheet) {
  sheet.querySelector("[data-close]").addEventListener("click", closeSheet);
  if (!${solved}) sheet.focus({ preventScroll: true });
}

// Accusations and a new game ask first, in the page's own dialog (embedding frames may block confirm()).
const dialog = document.getElementById("confirm");
const question = (f) =>
  f.dataset.confirmNew !== undefined
    ? { title: ${js(m.confirmNewTitle)}, text: ${js(m.confirmNewText)}, ok: ${js(m.restart)} }
    : f.dataset.confirm !== undefined
      ? { title: f.dataset.confirm + ${js(m.confirmAccuse)}, text: ${js(m.commit)} + f.dataset.confirm + ${js(m.commitTail)}, ok: ${js(m.accuse)} }
      : null;
document.querySelectorAll("form:not([method=dialog])").forEach((f) => f.addEventListener("submit", (e) => {
  const section = f.closest("section[id]");
  const ask = question(f);
  if (ask !== null && !f.dataset.ok) {
    e.preventDefault();
    const go = () => { f.dataset.ok = "1"; f.requestSubmit(); };
    if (typeof dialog.showModal !== "function") { if (confirm(ask.title)) go(); return; }
    document.getElementById("confirm-title").textContent = ask.title;
    document.getElementById("confirm-text").textContent = ask.text;
    document.getElementById("confirm-ok").textContent = ask.ok;
    dialog.returnValue = "";
    dialog.showModal();
    document.getElementById("confirm-ok").focus();
    dialog.addEventListener("close", () => { if (dialog.returnValue === "ok") go(); }, { once: true });
    return;
  }
  store.set(":y", String(window.scrollY));
  if (section) store.set(":from", section.id);
}));

// Interrogation folders: closed on small screens unless the player opened them.
const npcs = [...document.querySelectorAll("details.witness")];
let open = null;
try { open = JSON.parse(store.get(":npc") ?? "null"); } catch {}
npcs.forEach((d, i) => {
  if (open !== null) d.open = open.includes(i);
  else if (matchMedia("(max-width: 760px)").matches) d.open = false;
  d.addEventListener("toggle", () => store.set(":npc", JSON.stringify(npcs.flatMap((x, j) => (x.open ? [j] : [])))));
});
if (matchMedia("(min-width: 1000px)").matches && !${solved}) document.getElementById("akte").open = true;

// Keyboard: letters jump to the areas, Esc closes the result sheet.
const keys = Object.fromEntries([...document.querySelectorAll("[data-key]")].map((a) => [a.dataset.key.toLowerCase(), a.getAttribute("href").slice(1)]));
const go = (id) => {
  const target = document.getElementById(id);
  if (!target) return;
  if (target.tagName === "DETAILS") target.open = true;
  target.scrollIntoView({ block: "start" });
  target.focus({ preventScroll: true });
};
document.querySelectorAll("[data-key]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); go(a.getAttribute("href").slice(1)); try { history.replaceState(null, "", a.getAttribute("href")); } catch {} }));
// First visit: a short, skippable introduction; it remembers that it was seen.
const intro = document.getElementById("intro"), steps = [...intro.querySelectorAll("[data-step]")];
const prev = intro.querySelector("[data-prev]"), next = intro.querySelector("[data-next]"), dots = [...intro.querySelectorAll(".dots span")];
let step = 0;
const show = (i) => {
  step = Math.max(0, Math.min(steps.length - 1, i));
  steps.forEach((el, j) => (el.hidden = j !== step));
  dots.forEach((d, j) => d.classList.toggle("on", j === step));
  intro.querySelector("[data-count]").textContent = step + 1;
  prev.disabled = step === 0;
  next.textContent = step === steps.length - 1 ? ${js(m.letsGo)} : ${js(m.next)};
};
const openIntro = () => { if (typeof intro.showModal !== "function") return; show(0); intro.showModal(); next.focus(); };
prev.addEventListener("click", () => show(step - 1));
next.addEventListener("click", () => (step === steps.length - 1 ? intro.close() : show(step + 1)));
intro.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") show(step + 1); if (e.key === "ArrowLeft") show(step - 1); });
intro.addEventListener("close", () => { try { localStorage.setItem("kriminalfaelle.intro", "gesehen"); } catch {} });
document.querySelectorAll("[data-intro]").forEach((b) => b.addEventListener("click", openIntro));
let seen = true;
try { seen = localStorage.getItem("kriminalfaelle.intro") !== null; } catch {}
if (!seen && !${solved}) { if (sheet) sheet.hidden = true; openIntro(); }

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") return closeSheet();
  if (e.ctrlKey || e.metaKey || e.altKey || dialog.open || intro.open || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (e.key === "?") { e.preventDefault(); visit("/hilfe"); return; }
  const id = keys[e.key.toLowerCase()];
  if (id) { e.preventDefault(); go(id); }
});
})();`;
};

const STYLE = `
:root {
  --desk: #1c1814; --desk-2: #2a231c; --paper: #f5eedf; --paper-2: #ebe1cc; --ink: #2a2119; --ink-soft: #5c4e3f;
  --line: #d6c8ad; --brass: #c99a4b; --blood: #8f2d1f; --ok: #2f6b3a; --warn: #a3401f; --marker: #ffe58a; --focus: #ffbf47;
  --serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Charter, "Bitstream Charter", Georgia, serif;
  --type: "Courier Prime", "Courier New", ui-monospace, "Cascadia Mono", Menlo, monospace;
  --sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --radius: 4px; --shadow: 0 1px 0 rgba(255,255,255,.35) inset, 0 10px 24px -12px rgba(0,0,0,.65), 0 2px 4px rgba(0,0,0,.25);
}
@media (prefers-color-scheme: light) { :root { --desk: #3a3026; --desk-2: #4a3d30; } }
* { box-sizing: border-box; }
html { scroll-padding-top: 76px; }
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
body { margin: 0; min-height: 100vh; color: var(--ink); font: 17px/1.6 var(--serif); background: radial-gradient(ellipse at 20% -10%, #3b3026 0%, transparent 55%), radial-gradient(ellipse at 110% 30%, #2d241c 0%, transparent 50%), repeating-linear-gradient(92deg, transparent 0 22px, rgba(255,255,255,.012) 22px 23px), var(--desk); background-attachment: fixed; }
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; box-shadow: 0 0 0 5px var(--ink); }
[tabindex="-1"]:focus { outline: none; }
.visually-hidden { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.skip { position: absolute; left: 12px; top: -60px; z-index: 50; background: var(--focus); color: #000; padding: 10px 14px; font: 600 15px var(--sans); border-radius: var(--radius); }
.skip:focus { top: 12px; }
h1, h2, h3 { line-height: 1.2; }
p { margin: 0 0 .6em; }
kbd { font: 600 11px var(--type); border: 1px solid currentColor; border-bottom-width: 2px; border-radius: 3px; padding: 0 4px; opacity: .75; }

/* Top bar and section tabs */
.topbar { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 20px; padding: 10px 28px; background: rgba(22,18,14,.94); color: var(--paper); border-bottom: 1px solid #000; box-shadow: 0 6px 18px -10px #000; backdrop-filter: blur(6px); }
.home { font: 500 14px var(--sans); color: #d9cbb0; text-decoration: none; padding: 6px 0; white-space: nowrap; }
.home:hover { color: #fff; }
.case-title { flex: 1; min-width: 0; }
.kicker { margin: 0; font: 700 11px var(--type); letter-spacing: .25em; text-transform: uppercase; color: var(--brass); }
.topbar h1 { margin: 0; font-size: 24px; font-weight: 600; letter-spacing: .01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.badge { font: 600 13px var(--sans); padding: 4px 12px; border-radius: 999px; background: #3b3127; color: #f1e6d0; border: 1px solid #5a4a39; white-space: nowrap; }
.badge.solved { background: var(--ok); border-color: #4f9a5c; color: #fff; }
.tabs { max-width: 1320px; margin: 0 auto; padding: 14px 28px 0; }
.tabs ul { display: flex; gap: 6px; list-style: none; margin: 0; padding: 0; overflow-x: auto; scrollbar-width: none; }
.tabs a { display: flex; align-items: center; gap: 8px; padding: 8px 14px; font: 600 13px var(--type); letter-spacing: .12em; text-transform: uppercase; color: #e9dcc3; text-decoration: none; background: var(--desk-2); border: 1px solid #4a3d30; border-radius: 6px; white-space: nowrap; }
.tabs a:hover { background: #3a2f25; color: #fff; }

/* Desk layout */
.desk { display: grid; grid-template-columns: minmax(280px, 380px) minmax(0, 1fr); grid-template-rows: auto 1fr; gap: 22px; padding: 16px 28px 40px; max-width: 1320px; margin: 0 auto; align-items: start; }
.play { grid-column: 2; grid-row: 1 / span 2; }
.side { grid-column: 1; grid-row: 2; }
.dossier, .play { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.card, .folder { position: relative; background: var(--paper); border-radius: var(--radius); box-shadow: var(--shadow); padding: 22px 24px 20px; }
.card > h2, .folder summary h2, .closing h2 { margin: 0 0 14px; font: 700 15px var(--type); letter-spacing: .2em; text-transform: uppercase; color: var(--blood); }
.card > h2::after { content: ""; display: block; margin-top: 8px; border-bottom: 2px solid var(--ink); width: 42px; }
h3 { margin: 18px 0 8px; font: 700 12px var(--sans); letter-spacing: .12em; text-transform: uppercase; color: var(--ink-soft); }
.count { font-weight: 500; color: #8a7a66; letter-spacing: 0; }
.muted { color: var(--ink-soft); font-style: italic; }

/* Case file folder */
.folder { background: linear-gradient(#e8d6ab, #e2cd9c); padding-top: 16px; }
.folder::before { content: ""; position: absolute; left: 18px; top: -12px; width: 128px; height: 14px; background: #e8d6ab; border-radius: 6px 6px 0 0; }
.folder summary { cursor: pointer; list-style: none; display: flex; align-items: baseline; gap: 12px; }
.folder summary::-webkit-details-marker { display: none; }
.folder summary h2 { margin: 0; }
.folder summary::after { content: "▾"; margin-left: auto; flex: none; color: var(--blood); transition: transform .2s; }
.folder:not([open]) summary::after { transform: rotate(-90deg); }
.summary-hint { font: 13px var(--sans); color: #6d5a3d; flex: 1; min-width: 0; }
.folder-body { margin-top: 14px; background: var(--paper); padding: 18px 20px; border-radius: 2px; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
.mission { font-size: 18px; font-weight: 600; }
.mission .label, .entry-kind { display: block; font: 700 11px var(--type); letter-spacing: .2em; text-transform: uppercase; color: var(--blood); margin-bottom: 2px; }
.brief { font-size: 16px; }
.rules-list, .rules ul { padding-left: 20px; margin: 0; font-size: 15px; }
.rules-list li, .rules li { margin-bottom: 6px; }

/* Known: chips */
.chips { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.chips li { font: 14px var(--sans); background: #fffaf0; border: 1px solid var(--line); border-radius: 3px; padding: 3px 9px; }
.chips li.new { background: var(--marker); border-color: #d9b938; }
.tag { display: inline-block; font: 700 10px var(--sans); text-transform: uppercase; letter-spacing: .08em; background: var(--blood); color: #fff; border-radius: 3px; padding: 2px 6px; vertical-align: 2px; }

/* Buttons */
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.actions form { margin: 0; }
button, .button { font: 500 15px/1.3 var(--sans); padding: 9px 14px; min-height: 40px; border: 1px solid #b9a789; border-radius: var(--radius); background: #fffaf0; color: var(--ink); cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: transform .08s, box-shadow .15s, background .15s; box-shadow: 0 1px 0 #cbbb9c; }
button:hover, .button:hover { background: #fff; border-color: var(--ink); box-shadow: 0 3px 0 #b9a789; transform: translateY(-1px); }
button:active { transform: translateY(1px); box-shadow: none; }
button.primary { background: var(--ink); color: var(--paper); border-color: var(--ink); }
button.danger { background: var(--blood); color: #fff; border-color: var(--blood); }
button.act.fresh::before, button.q.fresh::before { content: "" / ""; width: 8px; height: 8px; border-radius: 50%; background: var(--blood); box-shadow: 0 0 0 3px rgba(143,45,31,.18); flex: none; }
button.done { color: var(--ink-soft); background: #f3ead8; }
button.done::after { content: "✓" / ""; margin-left: auto; color: var(--ok); font-weight: 700; }
.group h3 { margin-top: 4px; }
.group + .group { margin-top: 14px; }

/* Interrogation folders */
.witness { border-top: 1px dashed var(--line); padding: 4px 0; }
.witness:first-of-type { border-top: 0; }
.witness summary { display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 8px 0; list-style: none; }
.witness summary::-webkit-details-marker { display: none; }
.witness summary::after { content: "▾"; margin-left: auto; color: var(--ink-soft); transition: transform .2s; }
.witness:not([open]) summary::after { transform: rotate(-90deg); }
.avatar { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; font: 700 13px var(--type); background: var(--ink); color: var(--paper); flex: none; }
.npc-name { font-weight: 700; font-size: 18px; }
.npc-meta { font: 13px var(--sans); color: var(--ink-soft); }
.questions { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); padding: 4px 0 12px 48px; }
.questions button { width: 100%; text-align: left; justify-content: flex-start; font-family: var(--serif); font-size: 16px; }

/* Journal */
.journal { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.journal li { display: grid; grid-template-columns: 34px 1fr; gap: 12px; padding: 12px 14px; background: #fffaf0; border: 1px solid var(--line); border-left: 4px solid #8a7a66; border-radius: 2px; }
.journal li.evidence { border-left-color: var(--brass); }
.journal li.npc { border-left-color: #4a5a7a; }
.journal li.new { background: linear-gradient(transparent 0, #fff6c9 0); border-color: #d9b938; border-left-color: var(--blood); }
.entry-no { font: 700 14px var(--type); color: var(--ink-soft); padding-top: 2px; }
.entry p { margin: 0 0 4px; }
.entry-title { font-weight: 700; font-size: 17px; }
.journal li.npc .entry-title { font-weight: 500; font-style: italic; }
.fact { font: 14px/1.5 var(--sans); padding-left: 12px; border-left: 2px solid var(--line); color: #3b3127; }
.aside { font-size: 14px; color: var(--ink-soft); }
@media (prefers-reduced-motion: no-preference) { .journal li.new, .chips li.new { animation: flash 1.6s ease-out 1; } }
@keyframes flash { 0% { box-shadow: 0 0 0 6px rgba(255,214,77,.85); } 100% { box-shadow: 0 0 0 0 rgba(255,214,77,0); } }

/* Accusation */
.accuse { border-top: 4px solid var(--blood); }
.suspects { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
button.suspect { width: 100%; justify-content: center; padding: 14px; font: 600 17px var(--serif); border-color: var(--blood); color: var(--blood); }
button.suspect:hover { background: var(--blood); color: #fff; }

/* Result sheet */
.notice { position: fixed; z-index: 30; right: 24px; bottom: 24px; width: min(460px, calc(100vw - 32px)); max-height: min(60vh, 560px); display: flex; flex-direction: column; background: var(--paper); border-radius: 6px; box-shadow: 0 24px 60px -12px rgba(0,0,0,.8), 0 0 0 1px rgba(0,0,0,.3); border-top: 6px solid var(--brass); }
.notice.ok { border-top-color: var(--ok); }
.notice.warn { border-top-color: var(--warn); }
.notice[hidden] { display: none; }
.notice-head { display: flex; align-items: flex-start; gap: 12px; padding: 16px 18px 8px; }
.notice h2 { flex: 1; margin: 0; font: 700 17px var(--sans); }
.notice.warn h2 { color: var(--warn); }
.notice .close { min-height: 0; padding: 2px 10px; font-size: 22px; line-height: 1; }
.notice-body { overflow: auto; padding: 0 18px 16px; }
.notice-body .find { padding: 10px 12px; margin-bottom: 8px; background: #fff6c9; border: 1px solid #e1c650; border-radius: 3px; }
.find-title { font-weight: 700; }
@media (prefers-reduced-motion: no-preference) { .notice { animation: rise .35s cubic-bezier(.2,.8,.2,1); } }
@keyframes rise { from { transform: translateY(24px); opacity: 0; } }

/* Closing */
.closing-wrap { scroll-margin-top: 90px; }
.closing { position: relative; overflow: hidden; background: var(--paper); border-radius: var(--radius); box-shadow: var(--shadow); padding: 28px 32px; border-top: 6px solid var(--ok); }
.closing h2 { color: var(--ok); }
.closing .score { font-size: 18px; margin: 0 0 14px; }
.closing .score-stars, .case-card .best { color: var(--brass); }
.closing .score small { color: var(--ink-soft); font-size: 14px; }
.case-card .best { display: block; font: 600 13px var(--sans); margin: 0 0 8px; color: var(--ok); }
.closing .big { font-size: clamp(28px, 4vw, 40px); font-weight: 700; line-height: 1.15; margin: 4px 0 18px; max-width: 80%; }
.stamp { position: absolute; top: 26px; right: 24px; transform: rotate(-12deg); font: 800 26px var(--type); letter-spacing: .2em; text-transform: uppercase; color: rgba(143,45,31,.82); border: 4px double rgba(143,45,31,.82); padding: 6px 14px; border-radius: 6px; mix-blend-mode: multiply; }
.stamp.small { font-size: 15px; top: 16px; right: 16px; border-width: 3px; padding: 3px 9px; }
@media (prefers-reduced-motion: no-preference) { .closing .stamp { animation: stamp .5s cubic-bezier(.3,1.6,.5,1) .15s both; } }
@keyframes stamp { from { transform: rotate(-12deg) scale(2.2); opacity: 0; } }
.epilogue { font-size: 18px; line-height: 1.7; border-left: 3px solid var(--brass); padding-left: 18px; margin: 0 0 20px; }
.epilogue-title { margin-top: 0; }
.epilogue p:first-of-type::first-letter { float: left; font-size: 3.2em; line-height: .9; padding: 4px 8px 0 0; color: var(--blood); font-weight: 700; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 0 0 18px; }
.stats div { background: #fffaf0; border: 1px solid var(--line); border-radius: 3px; padding: 10px 12px; text-align: center; }
.stats dt { font: 700 11px var(--sans); letter-spacing: .12em; text-transform: uppercase; color: var(--ink-soft); }
.stats dd { margin: 0; font: 700 30px var(--type); }
.rules { margin-top: 16px; }
.rules summary { cursor: pointer; font: 700 12px var(--sans); letter-spacing: .12em; text-transform: uppercase; color: var(--ink-soft); padding: 6px 0; }
.end-actions { margin-top: 18px; }

/* Footer */
.keys { max-width: 1320px; margin: 0 auto; padding: 0 28px 36px; color: #bfae90; font: 13px var(--sans); }
.keys kbd { color: #f1e6d0; }

/* Case selection */
.masthead { max-width: 1000px; margin: 0 auto; padding: 64px 28px 24px; color: var(--paper); }
.masthead h1 { margin: 6px 0 12px; font-size: clamp(38px, 6vw, 60px); letter-spacing: .01em; }
.masthead .lead { font-size: 19px; max-width: 640px; color: #e2d5bd; }
.shelf { max-width: 1000px; margin: 0 auto; padding: 8px 28px 60px; }
.cases { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 24px; }
.case-card { position: relative; display: flex; flex-direction: column; height: 100%; padding: 26px 24px 20px; color: var(--ink); text-decoration: none; background: linear-gradient(#e8d6ab, #dfc995); border-radius: 3px 3px 4px 4px; box-shadow: var(--shadow); transition: transform .15s, box-shadow .15s; }
.case-card::before { content: ""; position: absolute; left: 16px; top: -11px; width: 110px; height: 13px; background: #e8d6ab; border-radius: 6px 6px 0 0; }
.case-card:hover { transform: translateY(-3px) rotate(-.4deg); box-shadow: 0 18px 30px -12px rgba(0,0,0,.8); }
.case-no { font: 700 12px var(--type); letter-spacing: .2em; text-transform: uppercase; color: var(--blood); }
.case-card h2 { margin: 6px 0 10px; font-size: 26px; }
.case-card p { color: #4a3d2e; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.case-card .difficulty { display: block; font: 600 13px var(--sans); margin: -4px 0 8px; color: var(--ink-soft); }
.case-card .difficulty .dots { letter-spacing: 2px; color: var(--blood); }
.case-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: auto; padding-top: 8px; }
.case-card .badge { background: rgba(42,33,25,.12); color: var(--ink); border-color: rgba(42,33,25,.25); }
.case-card .badge.solved { background: var(--ok); color: #fff; }
.open-file { font: 600 14px var(--sans); }
.hint { color: #bfae90; font: 14px var(--sans); margin-top: 28px; }

/* Case list tools: random case and loading a save */
.tools { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 24px; margin-top: 36px; align-items: start; }
.random-case, .load-any { position: relative; padding: 24px; border-radius: 4px; color: var(--paper); }
.random-case { background: repeating-linear-gradient(-45deg, rgba(255,255,255,.025) 0 10px, transparent 10px 20px), var(--desk-2); border: 2px dashed #6a5845; }
.load-any { border: 1px solid #4a3d30; background: rgba(0,0,0,.18); }
.tool-head { display: flex; align-items: center; gap: 14px; margin-bottom: 10px; }
.tool-head .kicker { margin: 0; }
.die { width: 46px; height: 46px; color: var(--brass); flex: none; transform: rotate(-8deg); }
@media (prefers-reduced-motion: no-preference) { .dice-box:hover .die { transform: rotate(14deg); transition: transform .3s cubic-bezier(.3,1.6,.5,1); } }
.random-case h2, .load-any h2 { margin: 0; font-size: 26px; }
.load-any h2 { font: 700 13px var(--type); letter-spacing: .2em; text-transform: uppercase; color: var(--brass); margin-bottom: 8px; }
.random-case p, .load-any p { color: #e2d5bd; max-width: 60ch; }
.seed-form { display: flex; flex-wrap: wrap; align-items: stretch; gap: 10px; margin-top: 14px; }
.seed-form label { align-self: center; font: 700 12px var(--type); letter-spacing: .2em; text-transform: uppercase; color: var(--brass); }
.seed-form input { width: 9.5em; min-height: 44px; padding: 8px 12px; font: 700 20px var(--type); letter-spacing: .08em; color: var(--ink); background: var(--paper); border: 2px solid #b9a789; border-radius: var(--radius); }
.seed-form input::placeholder { color: #9c8c75; font-weight: 400; letter-spacing: 0; }
.seed-form input:invalid { border-color: var(--warn); }
.seed-form button.primary { background: var(--brass); color: var(--desk); border-color: var(--brass); font-weight: 700; }
.random-case h3 { color: #bfae90; margin-top: 20px; }
.recent { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.recent li { display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,.2); border: 1px solid #5a4a39; border-radius: 4px; padding: 6px 10px; }
.recent a { color: var(--paper); font-weight: 600; text-decoration: none; }
.recent a:hover { text-decoration: underline; }
.load-any .button { background: transparent; color: var(--paper); border-color: #6a5845; box-shadow: none; }
.load-any .button:hover { border-color: var(--brass); color: #fff; }
.page-cases .notice { color: var(--ink); }

dialog { border: 0; border-radius: 6px; padding: 24px 26px; max-width: min(440px, calc(100vw - 32px)); background: var(--paper); color: var(--ink); box-shadow: 0 30px 80px rgba(0,0,0,.6); border-top: 6px solid var(--blood); }
dialog::backdrop { background: rgba(10,8,6,.7); }
dialog h2 { margin: 0 0 8px; font-size: 22px; }
dialog .actions { justify-content: flex-end; margin-top: 18px; }

/* Help link, ghost buttons */
.help-link { display: inline-flex; align-items: center; gap: 4px; font: 600 14px var(--sans); color: #e9dcc3; text-decoration: none; padding: 5px 12px; border: 1px solid #5a4a39; border-radius: 999px; white-space: nowrap; }
.help-link:hover { color: #fff; border-color: var(--brass); }
.lang-link { font: 600 13px var(--sans); color: #e9dcc3; text-decoration: none; padding: 5px 10px; border: 1px solid #5a4a39; border-radius: 999px; white-space: nowrap; }
.lang-link:hover { color: #fff; border-color: var(--brass); }
.masthead .lang-link { margin-left: 8px; }
.help-link > span[aria-hidden] { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: var(--brass); color: var(--desk); font-weight: 800; font-size: 12px; }
.ghost, a.ghost { background: transparent; color: #e9dcc3; border-color: #5a4a39; box-shadow: none; }
.ghost:hover, a.ghost:hover { background: rgba(255,255,255,.06); color: #fff; border-color: var(--brass); box-shadow: none; }
.keys p { margin: 0 0 10px; }

/* Introduction */
.intro { width: min(560px, calc(100vw - 24px)); max-width: none; padding: 0; border-top: 6px solid var(--brass); }
.intro form { display: flex; flex-direction: column; }
.intro-head { display: flex; align-items: center; gap: 12px; padding: 16px 20px 0; }
.intro-head .kicker { margin: 0; font-size: 12px; color: var(--blood); }
.intro-count { flex: 1; font: 13px var(--sans); color: var(--ink-soft); white-space: nowrap; }
.intro .ghost { color: var(--ink-soft); border-color: transparent; padding: 6px 10px; min-height: 0; }
.intro .ghost:hover { color: var(--ink); background: rgba(0,0,0,.05); }
.intro-steps { padding: 10px 28px 6px; min-height: 250px; }
.intro-steps section { text-align: center; }
.intro-steps .icon { width: 64px; height: 64px; color: var(--blood); margin: 6px auto 4px; display: block; }
.intro-steps h3 { margin: 6px 0 10px; font: 700 26px var(--serif); letter-spacing: 0; text-transform: none; color: var(--ink); }
.intro-steps p { font-size: 18px; line-height: 1.6; margin: 0 auto; max-width: 440px; }
@media (prefers-reduced-motion: no-preference) { .intro-steps section:not([hidden]) { animation: rise .3s ease-out; } }
.intro-foot { display: flex; align-items: center; gap: 10px; padding: 14px 20px 18px; border-top: 1px solid var(--line); margin-top: 12px; }
.dots { flex: 1; display: flex; gap: 6px; }
.dots span { width: 8px; height: 8px; border-radius: 50%; background: var(--line); transition: background .2s, width .2s; }
.dots span.on { background: var(--blood); width: 22px; border-radius: 4px; }
button:disabled { opacity: .45; cursor: default; transform: none; box-shadow: none; }

/* Manual */
.manual { max-width: 860px; margin: 0 auto; padding: 24px 28px 48px; display: flex; flex-direction: column; gap: 20px; }
.lead-ink { font-size: 19px; }
.overview { list-style: none; margin: 0; padding: 0; display: grid; gap: 18px; }
.overview li { display: grid; grid-template-columns: 28px 52px 1fr; gap: 12px; align-items: start; }
.overview .icon { width: 48px; height: 48px; color: var(--blood); }
.overview h3 { margin: 4px 0 4px; font: 700 20px var(--serif); text-transform: none; letter-spacing: 0; color: var(--ink); }
.step-no { font: 700 22px var(--type); color: var(--ink-soft); padding-top: 10px; }
.legend, .keymap { margin: 0; display: grid; gap: 10px; }
.legend div, .keymap div { display: grid; grid-template-columns: 90px 1fr; gap: 12px; align-items: baseline; }
.legend dd, .keymap dd { margin: 0; }
.keymap { grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); }
.keymap div { grid-template-columns: 48px 1fr; }
.keymap kbd { font-size: 13px; padding: 2px 7px; opacity: 1; }
.legend-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--blood); box-shadow: 0 0 0 3px rgba(143,45,31,.18); }
.legend-done { color: var(--ok); font-weight: 700; }
.legend-marker { background: var(--marker); padding: 1px 8px; border-radius: 3px; font: 14px var(--sans); }
.manual-foot { text-align: center; }
a.primary-link { background: var(--paper); font-weight: 600; }

@media (max-width: 1000px) {
  .desk { grid-template-columns: 1fr; }
  .desk { grid-template-rows: none; }
  .play, .side { grid-column: 1; grid-row: auto; }
}
@media (max-width: 760px) {
  body { font-size: 16px; }
  .topbar { padding: 8px 16px; gap: 12px; flex-wrap: wrap; }
  .topbar h1 { font-size: 20px; }
  .topbar .badge { font-size: 12px; padding: 3px 9px; }
  .badge-more { display: none; }
  .home { font-size: 0; } .home span { font-size: 20px; }
  .tabs { padding: 10px 12px 0; position: sticky; top: 58px; z-index: 15; background: linear-gradient(var(--desk) 70%, transparent); }
  .tabs a { padding: 8px 11px; font-size: 12px; letter-spacing: .08em; } .tabs kbd { display: none; }
  html { scroll-padding-top: 118px; }
  .desk { padding: 12px 12px 32px; gap: 16px; }
  .card, .folder { padding: 18px 16px; }
  .folder-body { padding: 14px; }
  .questions { padding-left: 0; grid-template-columns: 1fr; }
  button, .button { min-height: 44px; }
  .closing { padding: 22px 18px; }
  .closing .big { max-width: none; margin-top: 44px; }
  .stamp { font-size: 20px; top: 18px; }
  .notice { left: 8px; right: 8px; bottom: 8px; width: auto; max-height: 55vh; }
  .keys { padding: 0 16px 28px; } .key-list { display: none; }
  .help-text { display: none; } .help-link { padding: 5px 7px; }
  .intro-steps { padding: 8px 18px 4px; min-height: 300px; } .intro-steps h3 { font-size: 22px; } .intro-steps p { font-size: 17px; }
  .manual { padding: 16px 12px 36px; } .overview li { grid-template-columns: 40px 1fr; } .overview .step-no { display: none; }
  .tools { grid-template-columns: 1fr; }
  .masthead { padding: 40px 16px 16px; } .shelf { padding: 8px 16px 40px; }
}
@media (forced-colors: active) { .tag, .badge, .stamp { border: 1px solid; } }
`;
