import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CaseCheck, Problem } from "../authoring/check-case.ts";
import type { CaseSource } from "./editor.ts";
import { escape, layout, type Feedback } from "./web-page.ts";

// HTML views of the case editor. Every form control names its file and field in check-case notation
// (data-file, data-field), so a check-case problem lands next to the control it is about.

type Json = any; // the folder's JSON files as read from disk; check-case validates them
type Labels = Map<string, string>;
export type WorkspaceCard = { readonly name: string; readonly title: string; readonly ok: boolean; readonly errors: number };

const read = (dir: string, file: string): Json => {
  try {
    return JSON.parse(readFileSync(join(dir, file), "utf8"));
  } catch {
    return null;
  }
};

const clock = (seconds: number) => {
  const s = ((seconds % 86400) + 86400) % 86400;
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
};

function claimText(claim: Json, labels: Labels, origin: number): string {
  const l = (id: string) => labels.get(id) ?? id;
  switch (claim?.kind) {
    case "personAt":
      return `${l(claim.personId)} war um ${clock(origin + claim.at)} am Ort „${l(claim.locationId)}“`;
    case "eventHasParticipant":
      return `${l(claim.personId)} war an „${l(claim.eventId)}“ beteiligt`;
    case "eventHasItem":
      return `„${l(claim.itemId)}“ gehörte zu „${l(claim.eventId)}“`;
    default:
      return JSON.stringify(claim ?? null);
  }
}

const matches = (p: Problem, file: string, field: string) =>
  p.file === file && (p.field === field || p.field.startsWith(`${field}.`) || p.field.startsWith(`${field}[`) || p.field.startsWith(`${field} `));

const fieldId = (file: string, field: string) => `fld-${(file + "-" + field).replace(/[^a-zA-Z0-9]+/g, "-")}`;

function errorsFor(check: CaseCheck, file: string, field: string): string {
  const own = check.problems.filter((p) => p.severity === "error" && matches(p, file, field));
  return `<p class="field-error"${own.length === 0 ? " hidden" : ""}>${own.map((p) => escape(`${p.field}: ${p.message}`)).join("<br>")}</p>`;
}

function control(check: CaseCheck, file: string, field: string, label: string, value: string, multiline = false, hint = ""): string {
  const id = fieldId(file, field);
  const invalid = check.problems.some((p) => p.severity === "error" && matches(p, file, field));
  const attrs = `id="${id}" name="f:${escape(file)}:${escape(field)}" data-file="${escape(file)}" data-field="${escape(field)}"${invalid ? ` aria-invalid="true"` : ""}`;
  const input = multiline
    ? `<textarea ${attrs} rows="${Math.min(12, Math.max(3, Math.ceil(value.length / 90) + value.split("\n").length))}">${escape(value)}</textarea>`
    : `<input ${attrs} value="${escape(value)}">`;
  return `<div class="field"><label for="${id}">${escape(label)}</label>${hint === "" ? "" : `<span class="field-hint">${escape(hint)}</span>`}${input}${errorsFor(check, file, field)}</div>`;
}

function select(name: string, attrs: string, options: [string, string][], value: string, label: string): string {
  return `<label class="inline">${escape(label)} <select name="${escape(name)}" ${attrs}>${options
    .map(([v, text]) => `<option value="${v}"${v === value ? " selected" : ""}>${escape(text)}</option>`)
    .join("")}</select></label>`;
}

// ---------- Sections ----------

function textsSection(check: CaseCheck, pc: Json): string {
  const F = "public-content.json";
  if (pc === null) return `<p class="muted">public-content.json fehlt oder ist kein JSON.</p>`;
  const labels = (pc.labels ?? [])
    .map((l: Json, i: number) =>
      `<div class="pair">${control(check, F, `labels[${i}].label`, `${l.entity?.kind ?? ""} ${l.entity?.id ?? ""}`, String(l.label ?? ""))}${
        typeof l.role === "string" ? control(check, F, `labels[${i}].role`, "Rolle", l.role) : ""
      }</div>`,
    )
    .join("");
  const rules = (pc.publicRules ?? []).map((r: Json, i: number) => control(check, F, `publicRules[${i}].text`, r.id ?? `Regel ${i + 1}`, String(r.text ?? ""), true)).join("");
  return `${control(check, F, "title", "Titel", String(pc.title ?? ""))}
${control(check, F, "challengeQuestion", "Auftrag (Anklagefrage)", String(pc.challengeQuestion ?? ""))}
${control(check, F, "brief", "Fallakte", String(pc.brief ?? ""), true, "Absätze mit Leerzeile trennen")}
${control(check, F, "epilogue", "Epilog", String(pc.epilogue ?? ""), true, "erscheint erst nach der lösenden Anklage; leer lassen für keinen")}
<h3>Namen und Rollen</h3>${labels}
<h3>Regeln</h3>${rules}`;
}

function interrogationSection(check: CaseCheck, dir: string, pc: Json, labels: Labels, origin: number): string {
  const files = readdirSync(dir).filter((f) => /^interrogation-[a-z0-9-]+\.json$/.test(f)).sort();
  if (files.length === 0) return `<p class="muted">Keine Verhöre.</p>`;
  return files
    .map((file) => {
      const profile = read(dir, file);
      if (profile === null) return `<p class="muted">${escape(file)} ist kein JSON.</p>`;
      const npc = labels.get(profile.npcId) ?? profile.npcId;
      const fileErrors = check.problems.filter((p) => p.severity === "error" && p.file === file).length;
      const rules = (profile.rules ?? [])
        .map((rule: Json, i: number) => {
          const q = (pc?.questionTexts ?? []).findIndex((t: Json) => t.npc === profile.npcId && t.questionId === rule.questionId);
          const question = q < 0 ? `<p class="muted">Frage ${escape(rule.questionId)} hat keinen Spielertext.</p>` : control(check, "public-content.json", `questionTexts[${q}].text`, `Frage ${String(rule.questionId).replace(/^question:/, "")}`, String(pc.questionTexts[q].text));
          const attrs = (extra: string) => `data-file="${escape(file)}" data-field="rules[${i}]"${extra}`;
          const what =
            rule.act === "decline"
              ? "verweigert die Antwort"
              : rule.act === "lie"
                ? `lügt: „${rule.stance === "affirms" ? "Ja" : "Nein"}“ zu ${claimText(rule.claim, labels, origin)}`
                : `antwortet nach eigenem Wissen zu ${claimText(rule.claim, labels, origin)}`;
          return `<li class="rule">${question}<div class="rule-row">${select(`act:${file}:${i}`, attrs(" data-act"), [["answer", "antwortet"], ["lie", "lügt"], ["decline", "verweigert"]], rule.act, "Verhalten")}${select(
            `stance:${file}:${i}`,
            attrs(` data-stance${rule.act === "lie" ? "" : " disabled"}`),
            [["affirms", "„Ja“"], ["denies", "„Nein“"]],
            rule.stance ?? "denies",
            "Lüge",
          )}</div><p class="claim">${escape(what)}</p>${errorsFor(check, file, `rules[${i}]`)}</li>`;
        })
        .join("");
      return `<details class="witness"${fileErrors > 0 ? " open" : ""}><summary><span class="avatar" aria-hidden="true">${escape(npc.slice(0, 2).toUpperCase())}</span><span><span class="npc-name">${escape(npc)}</span><br><span class="npc-meta">${escape(file)} · ${profile.rules?.length ?? 0} Fragen${
        fileErrors > 0 ? ` · <strong class="bad">${fileErrors} Fehler</strong>` : ""
      }</span></span></summary><ol class="rules">${rules}</ol></details>`;
    })
    .join("");
}

function accessText(entry: Json, labels: Labels): string {
  const access = entry?.access;
  if (access?.kind !== "discoverable") return access?.kind === undefined ? "Zugang fehlt" : `Zugang: ${access.kind}`;
  const how = (p: Json) =>
    p.kind === "search_location" ? `Ort durchsuchen: ${labels.get(p.locationId) ?? p.locationId}` : p.kind === "examine_item" ? `Gegenstand untersuchen: ${labels.get(p.itemId) ?? p.itemId}` : p.kind === "examine_person" ? `Person untersuchen: ${labels.get(p.personId) ?? p.personId}` : JSON.stringify(p);
  return `Zu finden über ${access.paths.map(how).join(" oder ")}`;
}

function evidenceSection(check: CaseCheck, dir: string, labels: Labels): string {
  const F = "evidence-presentation.json";
  const presentation = read(dir, F);
  const access = read(dir, "evidence-access.json");
  if (presentation === null) return `<p class="muted">${F} fehlt oder ist kein JSON.</p>`;
  return `<ol class="clues">${(presentation.entries ?? [])
    .map((e: Json, i: number) => {
      const way = (access?.entries ?? []).find((a: Json) => a.evidenceId === e.evidenceId);
      return `<li>${control(check, F, `entries[${i}].text`, labels.get(e.evidenceId) ?? e.evidenceId, String(e.text ?? ""), true, accessText(way, labels))}</li>`;
    })
    .join("")}</ol>`;
}

function rawSection(dir: string, check: CaseCheck): string {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => {
      const text = readFileSync(join(dir, file), "utf8");
      const n = check.problems.filter((p) => p.severity === "error" && p.file === file).length;
      return `<details class="raw"><summary>${escape(file)}${n > 0 ? ` <strong class="bad">${n} Fehler</strong>` : ""}</summary><textarea name="raw:${escape(file)}" data-file="${escape(file)}" data-field="(JSON)" rows="18" spellcheck="false">${escape(text)}</textarea>${errorsFor(check, file, "(JSON)")}</details>`;
    })
    .join("");
}

/** The check panel; the same markup is rebuilt by the page script from /check. */
export function checkPanel(check: CaseCheck): string {
  const errors = check.problems.filter((p) => p.severity === "error");
  const warnings = check.problems.filter((p) => p.severity === "warning");
  const routes = check.routes.map((r) => `<li class="${r.report.status === "pass" ? "pass" : "fail"}">Weg ${escape(r.routeId)}: ${r.report.status === "pass" ? "lösbar" : `${escape(r.report.status)}, ${r.report.survivingAnswerCount} Antworten möglich`}</li>`).join("");
  const item = (p: Problem) => `<li><a href="#${fieldId(p.file, p.field)}" data-file="${escape(p.file)}" data-field="${escape(p.field)}"><code>${escape(p.file)} › ${escape(p.field)}</code></a> ${escape(p.message)}</li>`;
  return `<p class="verdict ${check.ok ? "ok" : "bad"}">${check.ok ? "Gültig und lösbar" : `${errors.length} Fehler`}</p>
${routes === "" ? "" : `<ul class="routes">${routes}</ul>`}
${errors.length === 0 ? "" : `<h3>Fehler</h3><ul class="problems">${errors.map(item).join("")}</ul>`}
${warnings.length === 0 ? "" : `<h3>Hinweise</h3><ul class="problems warn">${warnings.map(item).join("")}</ul>`}`;
}

function noticeHtml(feedback: Feedback | null): string {
  if (feedback === null) return "";
  return `<div class="ed-notice ${feedback.tone}" role="status"><strong>${escape(feedback.title)}</strong>${feedback.lines.map((l) => `<span>${escape(l)}</span>`).join("")}</div>`;
}

// ---------- Pages ----------

export function renderEditorHome(cards: readonly WorkspaceCard[], sources: readonly CaseSource[], workspace: string, feedback: Feedback | null): string {
  const open = sources
    .map((s) => `<li><form method="post" action="/editor/open"><input type="hidden" name="source" value="${escape(s.key)}"><button type="submit">${escape(s.label)}</button></form></li>`)
    .join("");
  const mine = cards
    .map(
      (c) =>
        `<li><a class="case-card" href="/editor/${escape(c.name)}"><span class="case-no">Arbeitskopie ${escape(c.name)}</span><h2>${escape(c.title)}</h2><span class="case-foot"><span class="badge${c.ok ? " solved" : ""}">${c.ok ? "gültig" : `${c.errors} Fehler`}</span><span class="open-file" aria-hidden="true">Bearbeiten →</span></span></a></li>`,
    )
    .join("");
  return layout(
    "Fall-Editor",
    `<header class="masthead"><p class="kicker">Werkstatt</p><h1>Fall-Editor</h1><p class="lead">Öffne einen Fall als Arbeitskopie, bearbeite Texte, Verhöre und Spuren. check-case prüft jede Änderung sofort.</p><p><a class="button ghost" href="/">← Zu den Fällen</a></p></header>
<main class="shelf">${noticeHtml(feedback)}
<h2 class="shelf-title">Arbeitskopien</h2>${mine === "" ? `<p class="hint">Noch keine. Öffne unten einen Fall.</p>` : `<ul class="cases">${mine}</ul>`}
<h2 class="shelf-title">Fall öffnen</h2><ul class="sources">${open}</ul>
<form class="generate" method="post" action="/editor/generate"><label>Neuer generierter Fall, Seed <input name="seed" inputmode="numeric" pattern="[0-9]{1,9}" value="${Math.floor(Math.random() * 1000)}" required></label> <button type="submit">Erzeugen</button></form>
<p class="hint">Arbeitsordner: <code>${escape(workspace)}</code>. Die Fälle im Repository werden nur gelesen.</p></main>`,
    "page-cases",
    EDITOR_STYLE,
  );
}

export function renderEditor(name: string, dir: string, check: CaseCheck, origin: number, feedback: Feedback | null): string {
  const pc = read(dir, "public-content.json");
  const labels: Labels = new Map((pc?.labels ?? []).map((l: Json) => [l.entity?.id, l.label]));
  return layout(
    `Editor: ${pc?.title ?? name}`,
    `<header class="topbar"><a class="home" href="/editor"><span aria-hidden="true">←</span> Werkstatt</a><div class="case-title"><p class="kicker">Fall-Editor · ${escape(name)}</p><h1>${escape(pc?.title ?? name)}</h1></div><span class="badge" id="status-badge">${check.ok ? "gültig" : "ungültig"}</span></header>
<form id="editor" method="post" action="/editor/${escape(name)}/save" class="desk editor">
<aside class="dossier side-check"><section class="card check" aria-live="polite"><h2>check-case</h2><div id="check">${checkPanel(check)}</div>
<div class="actions"><button type="submit" class="primary">Speichern</button><a class="button" href="/editor/${escape(name)}">Verwerfen</a></div>${noticeHtml(feedback)}</section></aside>
<div class="play">
<section class="card" id="texte"><h2>Spielertexte</h2>${textsSection(check, pc)}</section>
<section class="card" id="verhoere"><h2>Verhöre</h2>${interrogationSection(check, dir, pc, labels, origin)}</section>
<section class="card" id="spuren"><h2>Spuren</h2>${evidenceSection(check, dir, labels)}</section>
<section class="card" id="dateien"><h2>Dateien (JSON)</h2><p class="muted">Für alles, was die Formulare nicht abdecken. Hashes rechnet der Editor selbst nach.</p>${rawSection(dir, check)}</section>
</div></form>
<script>${SCRIPT(name)}</script>`,
    "page-editor",
    EDITOR_STYLE,
  );
}

const SCRIPT = (name: string) => `(() => {
const form = document.getElementById("editor"), panel = document.getElementById("check"), badge = document.getElementById("status-badge");
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const id = (file, field) => "fld-" + (file + "-" + field).replace(/[^a-zA-Z0-9]+/g, "-");
const hit = (p, file, field) => p.file === file && (p.field === field || p.field.startsWith(field + ".") || p.field.startsWith(field + "[") || p.field.startsWith(field + " "));
for (const sel of form.querySelectorAll("select[data-act]")) sel.addEventListener("change", () => {
  const stance = form.querySelector('select[data-stance][name="' + sel.name.replace(/^act:/, "stance:") + '"]');
  if (stance) stance.disabled = sel.value !== "lie";
});
let timer = 0, seq = 0;
async function check() {
  const mine = ++seq;
  badge.textContent = "prüft …";
  let data;
  try {
    const res = await fetch("/editor/${name}/check", { method: "POST", body: new URLSearchParams(new FormData(form)) });
    data = await res.json();
  } catch { badge.textContent = "Prüfung nicht erreichbar"; return; }
  if (mine !== seq) return;
  panel.innerHTML = data.html;
  badge.textContent = data.ok ? "gültig" : "ungültig";
  for (const el of form.querySelectorAll("[data-field]")) {
    const own = data.problems.filter((p) => p.severity === "error" && hit(p, el.dataset.file, el.dataset.field));
    if (el.matches("input, textarea, select")) { if (own.length > 0) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid"); }
    const box = el.closest(".field, .rule, details.raw")?.querySelector(":scope > .field-error");
    if (box && (el.matches("input, textarea") || el.matches("select[data-act]"))) { box.hidden = own.length === 0; box.innerHTML = own.map((p) => esc(p.field + ": " + p.message)).join("<br>"); }
  }
}
form.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(check, 400); });
form.addEventListener("change", () => { clearTimeout(timer); timer = setTimeout(check, 50); });
panel.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-file]"); if (!a) return;
  const target = [...form.querySelectorAll("[data-field]")].find((el) => el.matches("input, textarea, select") && hit({ file: a.dataset.file, field: a.dataset.field }, el.dataset.file, el.dataset.field));
  if (!target) return;
  e.preventDefault(); target.closest("details")?.setAttribute("open", ""); target.focus(); target.scrollIntoView({ block: "center" });
});
})();`;

const EDITOR_STYLE = `
.editor .play { gap: 20px; }
.side-check { grid-row: 1 / span 2; position: sticky; top: 76px; }
.editor .side-check { grid-column: 1; }
.editor .play { grid-column: 2; grid-row: 1 / span 2; }
.check .actions { margin-top: 14px; }
.verdict { font: 700 18px var(--sans); margin: 0 0 8px; }
.verdict.ok { color: var(--ok); } .verdict.bad, .bad { color: var(--warn); }
.routes, .problems { list-style: none; padding: 0; margin: 0 0 8px; font: 14px/1.45 var(--sans); }
.routes li::before { content: "● "; } .routes .pass::before { color: var(--ok); } .routes .fail::before { color: var(--warn); }
.problems li { padding: 6px 0; border-top: 1px dashed var(--line); }
.problems code { font: 12px var(--type); color: var(--blood); }
.problems.warn code { color: var(--ink-soft); }
.problems a { text-decoration: none; }
.field { margin: 0 0 14px; }
.field label { display: block; font: 700 12px var(--sans); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 4px; }
.field-hint { display: block; font: 13px var(--sans); color: #8a7a66; margin: -2px 0 4px; }
.field input, .field textarea, .raw textarea, select { width: 100%; font: 16px/1.5 var(--serif); color: var(--ink); background: #fffaf0; border: 1px solid #b9a789; border-radius: var(--radius); padding: 8px 10px; }
select { width: auto; font: 15px var(--sans); padding: 6px 8px; }
.raw textarea { font: 13px/1.45 var(--type); margin-top: 8px; }
[aria-invalid="true"] { border-color: var(--warn) !important; box-shadow: 0 0 0 2px rgba(163,64,31,.25); }
.field-error { margin: 4px 0 0; font: 13px/1.4 var(--sans); color: var(--warn); }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.rules { list-style: none; margin: 0; padding: 0 0 8px; }
.rule { padding: 12px 0; border-top: 1px dashed var(--line); }
.rule .field { margin-bottom: 6px; }
.rule-row { display: flex; flex-wrap: wrap; gap: 14px; }
label.inline { font: 600 13px var(--sans); color: var(--ink-soft); display: inline-flex; align-items: center; gap: 6px; }
.claim { font: 14px var(--sans); color: #3b3127; margin: 6px 0 0; padding-left: 10px; border-left: 2px solid var(--line); }
.clues { margin: 0; padding-left: 20px; }
.raw { border-top: 1px dashed var(--line); padding: 8px 0; }
.raw summary { cursor: pointer; font: 600 14px var(--type); }
.ed-notice { margin: 14px 0 0; padding: 10px 12px; border-radius: 3px; background: #fffaf0; border-left: 4px solid var(--brass); font: 14px var(--sans); display: flex; flex-direction: column; gap: 2px; }
.ed-notice.ok { border-left-color: var(--ok); } .ed-notice.warn { border-left-color: var(--warn); }
.shelf .ed-notice { margin: 0 0 20px; }
.shelf-title { color: var(--paper); font: 700 14px var(--type); letter-spacing: .2em; text-transform: uppercase; margin: 32px 0 14px; }
.sources { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.sources form { margin: 0; }
.generate { margin-top: 18px; color: var(--paper); font: 15px var(--sans); }
.generate input { width: 110px; font: 15px var(--sans); padding: 8px; border-radius: var(--radius); border: 1px solid #b9a789; }
.hint code { color: #e9dcc3; }
@media (max-width: 1000px) { .side-check { position: static; } .editor .side-check, .editor .play { grid-column: 1; grid-row: auto; } .pair { grid-template-columns: 1fr; } }
`;
