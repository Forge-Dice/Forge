import type { EvidenceObservation } from "../domain/evidence-presentation.ts";
import type { InterrogationObservation } from "../domain/interrogation.ts";
import { accusations, answerText, evidenceText, investigations, known, questions, type Action, type Game } from "./game.ts";

// HTML view of one game for the local browser front end. Pure: (game, last result) -> page. Every
// label comes from PublicContent or released observations through the CLI's own helpers, actions are
// addressed by their position in the current menu, so no ref or internal id reaches the page.

export type Notice = { readonly text: string; readonly tone: "info" | "ok" | "warn" };

const escape = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const GROUPS: [string, string][] = [
  ["person", "Personen"],
  ["location", "Orte"],
  ["item", "Gegenstände"],
  ["event", "Ereignisse"],
  ["evidence", "Nachweise"],
];

function actionList(game: Game, group: "u" | "f" | "a", actions: Action[], empty: string): string {
  if (actions.length === 0) return `<p class="muted">${escape(empty)}</p>`;
  const at = game.state.events.length;
  const confirm = group === "a" ? ` onsubmit="return confirm('Wirklich diese Person anklagen?')"` : "";
  const buttons = actions
    .map(
      (a, i) =>
        `<form method="post" action="/act"${confirm}><input type="hidden" name="group" value="${group}"><input type="hidden" name="n" value="${i + 1}"><input type="hidden" name="at" value="${at}"><button type="submit">${escape(a.label)}</button></form>`,
    )
    .join("");
  return `<div class="actions">${buttons}</div>`;
}

/** Interrogation questions grouped by NPC ("Name: Frage" labels from the CLI menu). */
function questionList(game: Game): string {
  const actions = questions(game);
  if (actions.length === 0) return `<p class="muted">Gerade keine Fragen verfügbar.</p>`;
  const at = game.state.events.length;
  const byNpc = new Map<string, string[]>();
  actions.forEach((a, i) => {
    const split = a.label.indexOf(": ");
    const npc = a.label.slice(0, split);
    const form = `<form method="post" action="/act"><input type="hidden" name="group" value="f"><input type="hidden" name="n" value="${i + 1}"><input type="hidden" name="at" value="${at}"><button type="submit" class="question">${escape(a.label.slice(split + 2))}</button></form>`;
    byNpc.set(npc, [...(byNpc.get(npc) ?? []), form]);
  });
  return [...byNpc].map(([npc, forms]) => `<h4>${escape(npc)}</h4><div class="actions column">${forms.join("")}</div>`).join("");
}

function journal(game: Game): string {
  const records = game.state.knowledge.observations;
  if (records.length === 0) return `<p class="muted">Noch keine Funde oder Aussagen.</p>`;
  return `<ol class="journal">${records
    .map((r) => {
      const text =
        r.source.kind === "evidence"
          ? evidenceText(game, r.observation as EvidenceObservation)
          : answerText(game, r.observation as InterrogationObservation);
      return `<li value="${r.source.eventIndex + 1}" class="${r.source.kind}">${escape(text)}</li>`;
    })
    .join("")}</ol>`;
}

export function renderPage(game: Game, notice: Notice | null): string {
  const { publicContent } = game.pkg;
  const solved = game.state.phase === "solved";
  const knownList = GROUPS.map(([kind, title]) => {
    const items = known(game, kind).map((k) => `<li>${escape(k.label)}</li>`);
    return `<h4>${title}</h4>${items.length === 0 ? `<p class="muted">–</p>` : `<ul>${items.join("")}</ul>`}`;
  }).join("");

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(publicContent.title)}</title>
<style>${STYLE}</style>
</head>
<body>
<header><h1>${escape(publicContent.title)}</h1><span class="badge ${solved ? "solved" : ""}">${solved ? "Gelöst" : `${game.state.events.length} Aktionen`}</span></header>
${notice === null ? "" : `<section class="notice ${notice.tone}">${escape(notice.text)}</section>`}
<main>
<aside>
<section><h2>Fallakte</h2><p class="brief">${escape(publicContent.brief)}</p><p><strong>Auftrag:</strong> ${escape(publicContent.challengeQuestion)}</p>
<h4>Regeln</h4><ul>${publicContent.publicRules.map((r) => `<li>${escape(r.text)}</li>`).join("")}</ul></section>
<section><h2>Bekannt</h2>${knownList}</section>
<section><h2>Spielstand</h2>
<div class="actions"><a class="button" href="/save" download="vitrine.save.json">Speichern</a>
<label class="button">Laden<input type="file" id="load" accept=".json,application/json" hidden></label>
<form method="post" action="/new" onsubmit="return confirm('Neues Spiel beginnen? Der aktuelle Stand geht verloren, wenn er nicht gespeichert ist.')"><button type="submit">Neu</button></form></div></section>
</aside>
<div class="play">
<section><h2>Untersuchen</h2>${solved ? `<p class="muted">Der Fall ist gelöst.</p>` : actionList(game, "u", investigations(game), "Gerade nichts zu untersuchen.")}</section>
<section><h2>Verhören</h2>${solved ? `<p class="muted">Der Fall ist gelöst.</p>` : questionList(game)}</section>
<section><h2>Anklage</h2><p>${escape(publicContent.challengeQuestion)}</p>${solved ? `<p class="muted">Der Fall ist gelöst.</p>` : actionList(game, "a", accusations(game), "Keine Anklage möglich.")}</section>
<section><h2>Journal</h2>${journal(game)}</section>
</div>
</main>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

// Loading reads the chosen file in the browser and posts its exact text; the server decodes it.
const SCRIPT = `document.getElementById("load").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const res = await fetch("/load", { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, body: await file.text() });
  if (res.redirected) location.href = res.url; else location.reload();
});`;

const STYLE = `
:root { --bg: #f6f3ee; --card: #fffdf9; --ink: #2b2620; --muted: #8a8177; --line: #e3dccf; --accent: #7a4b1f; --ok: #2f6b3a; --warn: #9a3b1d; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.5 Georgia, "Times New Roman", serif; }
header { display: flex; align-items: center; justify-content: space-between; padding: 18px 28px; border-bottom: 1px solid var(--line); background: var(--card); }
h1 { margin: 0; font-size: 26px; letter-spacing: .5px; }
h2 { margin: 0 0 10px; font-size: 18px; color: var(--accent); text-transform: uppercase; letter-spacing: 1px; font-family: system-ui, sans-serif; }
h4 { margin: 14px 0 4px; font-size: 14px; font-family: system-ui, sans-serif; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; }
main { display: grid; grid-template-columns: minmax(260px, 340px) 1fr; gap: 20px; padding: 20px 28px; max-width: 1280px; margin: 0 auto; }
@media (max-width: 800px) { main { grid-template-columns: 1fr; padding: 16px; } header { padding: 14px 16px; } }
section { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; margin-bottom: 16px; }
aside ul { margin: 0; padding-left: 18px; }
.brief { white-space: pre-wrap; }
.muted { color: var(--muted); margin: 4px 0; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.actions.column { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
.actions form { margin: 0; }
button, .button { font: 15px/1.3 system-ui, sans-serif; padding: 8px 12px; border: 1px solid var(--line); border-radius: 7px; background: #fff; color: var(--ink); cursor: pointer; text-decoration: none; display: inline-block; }
button:hover, .button:hover { border-color: var(--accent); color: var(--accent); }
button.question { text-align: left; width: 100%; }
.badge { font: 13px system-ui, sans-serif; padding: 4px 10px; border-radius: 999px; background: var(--line); }
.badge.solved { background: var(--ok); color: #fff; }
.notice { margin: 16px auto 0; max-width: 1224px; white-space: pre-wrap; border-left: 5px solid var(--accent); }
.notice.ok { border-left-color: var(--ok); }
.notice.warn { border-left-color: var(--warn); }
.journal { margin: 0; padding-left: 28px; }
.journal li { white-space: pre-wrap; margin-bottom: 10px; }
.journal li.npc { color: #3d3a5c; }
`;
