import type { EvidenceObservation } from "../domain/evidence-presentation.ts";
import type { InterrogationObservation } from "../domain/interrogation.ts";
import { accusations, answerText, evidenceText, investigations, known, questions, type Action, type Game } from "./game.ts";

// HTML views of the local browser front end. Pure: (game, feedback) -> page. Every label comes from
// PublicContent or released observations through the CLI's own helpers; actions are addressed by
// their position in the current menu, so no ref or internal id reaches the page.

export type Feedback = {
  readonly tone: "info" | "ok" | "warn";
  readonly title: string;
  readonly lines: readonly string[];
};
export type CaseCard = { readonly slug: string; readonly title: string; readonly teaser: string; readonly progress: string | null };

const escape = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const GROUPS: [string, string][] = [
  ["person", "Personen"],
  ["location", "Orte"],
  ["item", "Gegenstände"],
  ["event", "Ereignisse"],
  ["evidence", "Nachweise"],
];

const lastEvent = (game: Game) => game.state.events.length - 1;
const isNew = (game: Game, eventIndex: number) => eventIndex === lastEvent(game);

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>${STYLE}</style>
</head>
<body>
${body}
</body>
</html>
`;
}

// ---------- Case selection ----------

export function renderCaseList(cases: readonly CaseCard[]): string {
  const cards = cases
    .map(
      (c) => `<a class="case-card" href="/fall/${escape(c.slug)}"><h2>${escape(c.title)}</h2><p>${escape(c.teaser)}</p>${
        c.progress === null ? `<span class="badge">Neu</span>` : `<span class="badge">${escape(c.progress)}</span>`
      }</a>`,
    )
    .join("");
  return layout(
    "Fälle",
    `<header><h1>Kriminalfälle</h1></header><main class="single"><p class="lead">Wähle einen Fall. Jeder Fall merkt sich seinen eigenen Stand, solange der Server läuft.</p><div class="cases">${cards}</div></main>`,
  );
}

// ---------- Game page ----------

function actionForm(game: Game, slug: string, group: "u" | "f" | "a", index: number, label: string, cls = ""): string {
  const confirm = group === "a" ? ` onsubmit="return confirm('Wirklich ${escape(label).replace(/'/g, "")} anklagen? Eine falsche Anklage beendet den Fall nicht, wird aber im Journal vermerkt.')"` : "";
  return `<form method="post" action="/fall/${slug}/act"${confirm}><input type="hidden" name="group" value="${group}"><input type="hidden" name="n" value="${index + 1}"><input type="hidden" name="at" value="${game.state.events.length}"><button type="submit"${cls === "" ? "" : ` class="${cls}"`}>${escape(label)}</button></form>`;
}

function actionList(game: Game, slug: string, group: "u" | "a", actions: Action[], empty: string): string {
  if (actions.length === 0) return `<p class="muted">${escape(empty)}</p>`;
  return `<div class="actions">${actions.map((a, i) => actionForm(game, slug, group, i, a.label)).join("")}</div>`;
}

/** Interrogation questions grouped by NPC ("Name: Frage" labels from the CLI menu). */
function questionList(game: Game, slug: string): string {
  const actions = questions(game);
  if (actions.length === 0) return `<p class="muted">Gerade keine Fragen verfügbar.</p>`;
  const byNpc = new Map<string, string[]>();
  actions.forEach((a, i) => {
    const split = a.label.indexOf(": ");
    const npc = a.label.slice(0, split);
    byNpc.set(npc, [...(byNpc.get(npc) ?? []), actionForm(game, slug, "f", i, a.label.slice(split + 2), "question")]);
  });
  return [...byNpc].map(([npc, forms]) => `<h4>${escape(npc)}</h4><div class="actions grid">${forms.join("")}</div>`).join("");
}

function journal(game: Game): string {
  const records = game.state.knowledge.observations;
  if (records.length === 0) return `<p class="muted">Noch keine Funde oder Aussagen.</p>`;
  // Newest first: what just happened is on top.
  return `<ol class="journal" reversed>${[...records]
    .reverse()
    .map((r) => {
      const text =
        r.source.kind === "evidence" ? evidenceText(game, r.observation as EvidenceObservation) : answerText(game, r.observation as InterrogationObservation);
      const fresh = isNew(game, r.source.eventIndex);
      return `<li value="${r.source.eventIndex + 1}" class="${r.source.kind}${fresh ? " new" : ""}">${fresh ? `<span class="tag">neu</span>` : ""}${escape(text)}</li>`;
    })
    .join("")}</ol>`;
}

function knownList(game: Game): string {
  const fresh = new Set(
    game.state.knowledge.known.filter((k) => k.firstSeen.kind === "event" && isNew(game, k.firstSeen.eventIndex)).map((k) => k.ref),
  );
  return GROUPS.map(([kind, title]) => {
    const items = known(game, kind).map((k) => `<li${fresh.has(k.ref) ? ` class="new"` : ""}>${escape(k.label)}${fresh.has(k.ref) ? ` <span class="tag">neu</span>` : ""}</li>`);
    return `<h4>${title}</h4>${items.length === 0 ? `<p class="muted">–</p>` : `<ul>${items.join("")}</ul>`}`;
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

function closing(game: Game, slug: string): string {
  const { publicContent } = game.pkg;
  const name = accusedName(game);
  const evidence = known(game, "evidence").map((k) => k.label);
  const tries = game.state.verdicts.length;
  return `<section class="closing"><h2>Fall gelöst</h2>
<p class="big">${escape(name === null ? "Deine Anklage trifft zu." : `${name} war es.`)}</p>
${publicContent.epilogue === undefined ? "" : `<div class="epilogue">${publicContent.epilogue.split(/\n{2,}/).map((p) => `<p>${escape(p)}</p>`).join("")}</div>`}
<p><strong>${escape(publicContent.challengeQuestion)}</strong> – deine Antwort erfüllt den Fallauftrag.</p>
<p>Du hast ${game.state.events.length} Aktionen gebraucht${tries > 1 ? ` und ${tries} Anklagen erhoben` : " und gleich die erste Anklage richtig gestellt"}.</p>
${evidence.length === 0 ? "" : `<h4>Deine Nachweise</h4><ul>${evidence.map((e) => `<li>${escape(e)}</li>`).join("")}</ul>`}
<h4>Was den Fall entschied</h4><ul>${publicContent.publicRules.map((r) => `<li>${escape(r.text)}</li>`).join("")}</ul>
<div class="actions"><form method="post" action="/fall/${slug}/new"><button type="submit">Noch einmal spielen</button></form><a class="button" href="/">Anderer Fall</a></div>
</section>`;
}

export function renderGame(game: Game, slug: string, feedback: Feedback | null): string {
  const { publicContent } = game.pkg;
  const solved = game.state.phase === "solved";
  const closed = `<p class="muted">Der Fall ist gelöst.</p>`;
  const body = `<header><a class="home" href="/">← Fälle</a><h1>${escape(publicContent.title)}</h1><span class="badge${solved ? " solved" : ""}">${
    solved ? "Gelöst" : `${game.state.events.length} Aktionen · ${known(game, "evidence").length} Nachweise`
  }</span></header>
${feedback === null ? "" : `<section class="notice ${feedback.tone}"><h3>${escape(feedback.title)}</h3>${feedback.lines.map((l) => `<p>${escape(l)}</p>`).join("")}</section>`}
<main>
<aside>
<section><h2>Fallakte</h2><p class="brief">${escape(publicContent.brief)}</p><p><strong>Auftrag:</strong> ${escape(publicContent.challengeQuestion)}</p>
<h4>Regeln</h4><ul>${publicContent.publicRules.map((r) => `<li>${escape(r.text)}</li>`).join("")}</ul></section>
<section><h2>Bekannt</h2>${knownList(game)}</section>
<section><h2>Spielstand</h2>
<div class="actions"><a class="button" href="/fall/${slug}/save" download="${slug}.save.json">Speichern</a>
<label class="button">Laden<input type="file" id="load" accept=".json,application/json" hidden></label>
<form method="post" action="/fall/${slug}/new" onsubmit="return confirm('Neues Spiel beginnen? Ein nicht gespeicherter Stand geht verloren.')"><button type="submit">Neu</button></form></div></section>
</aside>
<div class="play">
${solved ? closing(game, slug) : ""}
<section><h2>Untersuchen</h2>${solved ? closed : actionList(game, slug, "u", investigations(game), "Gerade nichts zu untersuchen.")}</section>
<section><h2>Verhören</h2>${solved ? closed : questionList(game, slug)}</section>
<section><h2>Journal</h2>${journal(game)}</section>
<section><h2>Anklage</h2><p>${escape(publicContent.challengeQuestion)}</p>${solved ? closed : actionList(game, slug, "a", accusations(game), "Keine Anklage möglich.")}</section>
</div>
</main>
<script>${script(slug)}</script>`;
  return layout(publicContent.title, body);
}

// Loading reads the chosen file in the browser and posts its exact text; the server decodes it.
const script = (slug: string) => `document.getElementById("load").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  await fetch("/fall/${slug}/load", { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, body: await file.text() });
  location.href = "/fall/${slug}";
});`;

const STYLE = `
:root { --bg: #f6f3ee; --card: #fffdf9; --ink: #2b2620; --muted: #8a8177; --line: #e3dccf; --accent: #7a4b1f; --ok: #2f6b3a; --warn: #9a3b1d; --new: #fff3c4; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.5 Georgia, "Times New Roman", serif; }
header { display: flex; align-items: center; gap: 18px; padding: 18px 28px; border-bottom: 1px solid var(--line); background: var(--card); }
header h1 { flex: 1; }
.home { font: 14px system-ui, sans-serif; color: var(--muted); text-decoration: none; }
h1 { margin: 0; font-size: 26px; letter-spacing: .5px; }
h2 { margin: 0 0 10px; font-size: 18px; color: var(--accent); text-transform: uppercase; letter-spacing: 1px; font-family: system-ui, sans-serif; }
h3 { margin: 0 0 6px; font: 600 17px system-ui, sans-serif; }
h4 { margin: 14px 0 4px; font-size: 14px; font-family: system-ui, sans-serif; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; }
main { display: grid; grid-template-columns: minmax(260px, 340px) 1fr; gap: 20px; padding: 20px 28px; max-width: 1280px; margin: 0 auto; }
main.single { display: block; max-width: 900px; }
@media (max-width: 800px) { main { grid-template-columns: 1fr; padding: 16px; } header { padding: 14px 16px; } }
section { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; margin-bottom: 16px; }
aside ul, .closing ul { margin: 0; padding-left: 18px; }
.brief { white-space: pre-wrap; }
.lead { font-size: 18px; }
.muted { color: var(--muted); margin: 4px 0; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.actions.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
.actions form { margin: 0; }
button, .button { font: 15px/1.3 system-ui, sans-serif; padding: 8px 12px; border: 1px solid var(--line); border-radius: 7px; background: #fff; color: var(--ink); cursor: pointer; text-decoration: none; display: inline-block; }
button:hover, .button:hover { border-color: var(--accent); color: var(--accent); }
button.question { text-align: left; width: 100%; }
.badge { font: 13px system-ui, sans-serif; padding: 4px 10px; border-radius: 999px; background: var(--line); white-space: nowrap; }
.badge.solved { background: var(--ok); color: #fff; }
.tag { font: 600 11px system-ui, sans-serif; text-transform: uppercase; letter-spacing: .5px; background: var(--accent); color: #fff; border-radius: 4px; padding: 1px 5px; margin-right: 6px; vertical-align: 2px; }
li.new { background: var(--new); border-radius: 4px; }
.notice { margin: 16px auto 0; max-width: 1224px; border-left: 5px solid var(--accent); }
.notice p { margin: 2px 0; white-space: pre-wrap; }
.notice.ok { border-left-color: var(--ok); }
.notice.warn { border-left-color: var(--warn); }
.closing { border: 2px solid var(--ok); }
.closing h2 { color: var(--ok); }
.closing .actions { margin-top: 14px; }
.epilogue { border-left: 3px solid var(--line); padding-left: 14px; margin: 6px 0 14px; font-size: 17px; }
.epilogue p { margin: 0 0 10px; }
.closing .big { font-size: 24px; margin: 4px 0 10px; }
.journal { margin: 0; padding-left: 28px; }
.journal li { white-space: pre-wrap; margin-bottom: 10px; padding: 4px 6px; }
.journal li.npc { color: #3d3a5c; }
.cases { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
.case-card { display: block; background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 18px 20px; color: var(--ink); text-decoration: none; }
.case-card:hover { border-color: var(--accent); }
.case-card p { margin: 0 0 12px; }
`;
