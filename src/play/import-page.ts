import { escape, layout } from "./web-page.ts";

// "Eigenen Fall laden": pick a case file (exported by the editor); the browser posts its exact
// text to /laden, the handler checks it completely and answers with the playable slug or the
// reasons it was refused.

export type ImportedCard = { readonly slug: string; readonly title: string };

const STYLE = `
.drop { display: block; position: relative; border: 2px dashed var(--brass); border-radius: 6px; padding: 28px 20px; text-align: center; cursor: pointer; }
.drop:hover, .drop:focus-within { background: rgba(201,154,75,.08); }
.drop input[type=file] { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.result { margin-top: 18px; padding: 12px 16px; border-left: 6px solid var(--brass); border-radius: 3px; background: rgba(0,0,0,.04); }
.result.ok { border-left-color: var(--ok); }
.result.warn { border-left-color: var(--warn); }
.result.warn h3 { color: var(--warn); }
.result h3 { margin: 0; font: 700 17px var(--sans); }
.result ul { margin: 8px 0 0; padding-left: 20px; }
.result li { margin: 4px 0; overflow-wrap: anywhere; }
`;

const SCRIPT = `(() => {
const visit = (url) => (typeof window.kfVisit === "function" ? window.kfVisit(url) : (location.href = url));
const input = document.getElementById("case-file"), out = document.getElementById("result");
const show = (title, lines, tone) => {
  out.hidden = false;
  out.className = "result " + tone;
  out.replaceChildren();
  const h = document.createElement("h3");
  h.textContent = title;
  out.append(h);
  if (lines.length > 0) {
    const ul = document.createElement("ul");
    for (const line of lines) { const li = document.createElement("li"); li.textContent = line; ul.append(li); }
    out.append(ul);
  }
  out.focus();
};
input.addEventListener("change", async () => {
  const file = input.files[0];
  if (!file) return;
  show("Der Fall wird geprüft …", [], "info");
  try {
    const res = await fetch("/laden", { method: "POST", headers: { "content-type": "application/json;charset=utf-8" }, body: await file.text() });
    const data = JSON.parse(await res.text());
    if (data.ok) return visit("/fall/" + data.slug);
    show(data.title, data.problems, "warn");
  } catch (err) {
    show("Die Datei konnte nicht gelesen werden.", [String(err && err.message ? err.message : err)], "warn");
  }
  input.value = "";
});
})();`;

export function renderImport(mine: readonly ImportedCard[]): string {
  const list =
    mine.length === 0
      ? ""
      : `<section class="card"><h2>Geladene Fälle</h2><ul>${mine.map((c) => `<li><a href="/fall/${escape(c.slug)}">${escape(c.title)}</a></li>`).join("")}</ul></section>`;
  return layout(
    "Eigenen Fall laden",
    `<header class="topbar"><a class="home" href="/"><span aria-hidden="true">←</span> Alle Fälle</a><div class="case-title"><p class="kicker">Fall-Datei</p><h1>Eigenen Fall laden</h1></div></header>
<main id="laden" class="manual">
<section class="card"><h2>Fall-Datei wählen</h2><p class="lead-ink">Eine Datei aus dem Fall-Editor („Exportieren“). Sie wird vollständig geprüft: Prüfsummen, jede Datei mit dem echten Parser und ob jeder Lösungsweg aufgeht. Erst dann ist der Fall spielbar.</p>
<label class="drop" for="case-file"><strong>Datei auswählen</strong><br><span class="muted">.kriminalfall.json</span><input id="case-file" type="file" accept=".json,application/json"></label>
<div id="result" class="result" role="status" tabindex="-1" hidden></div></section>
${list}</main>
<script>${SCRIPT}</script>`,
    "page-import",
    STYLE,
  );
}
