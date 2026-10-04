import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CaseCheck, Problem } from "../authoring/check-case.ts";
import { fileDigest, type CaseSource } from "./editor.ts";
import type { CaseReport } from "./playtest.ts";
import { difficultyText } from "./difficulty.ts";
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
      return `<details class="raw"><summary>${escape(file)}${n > 0 ? ` <strong class="bad">${n} Fehler</strong>` : ""}</summary><input type="hidden" name="base:${escape(file)}" value="${fileDigest(text)}"><textarea name="raw:${escape(file)}" data-file="${escape(file)}" data-field="(JSON)" rows="18" spellcheck="false">${escape(text)}</textarea>${errorsFor(check, file, "(JSON)")}</details>`;
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

/**
 * A form section from files of possibly the wrong shape (valid JSON can be saved with check-case
 * errors): if it cannot be rendered, the page says so and the file stays editable as JSON below.
 */
function section(render: () => string): string {
  try {
    return render();
  } catch {
    return `<p class="muted">Die Dateien haben hier nicht die erwartete Form. Korrigiere sie unten unter „Dateien (JSON)“.</p>`;
  }
}

// ---------- Structure: add and remove ----------

const stepText = (event: Json, labels: Labels): string => {
  const l = (ref: Json) => labels.get(ref?.$playerRefOf?.id) ?? ref?.$playerRefOf?.id ?? "?";
  if (event?.type === "interrogate") return `${l(event.npc)} fragen (${String(event.questionId ?? "").replace(/^question:/, "")})`;
  if (event?.action === "search_location") return `Ort durchsuchen: ${l(event.target)}`;
  if (event?.action === "examine_item") return `Untersuchen: ${l(event.target)}`;
  if (event?.action === "examine_person") return `Person untersuchen: ${l(event.target)}`;
  return JSON.stringify(event);
};

const removeButton = (name: string, fields: Record<string, string>, what: string) =>
  `<form method="post" action="/editor/${escape(name)}/struct" class="inline-form" data-struct>${Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${escape(k)}" value="${escape(v)}">`)
    .join("")}<button type="submit" class="small danger-ghost" data-confirm="${escape(`${what} entfernen? Alles, was darauf verweist, wird mit entfernt.`)}" aria-label="${escape(`${what} entfernen`)}">Entfernen</button></form>`;

const options = (items: readonly [string, string][], selected = "") => items.map(([v, t]) => `<option value="${escape(v)}"${v === selected ? " selected" : ""}>${escape(t)}</option>`).join("");

function structureSection(name: string, dir: string, labels: Labels, origin: number): string {
  const truth = read(dir, "truth.json") ?? {};
  const pc = read(dir, "public-content.json") ?? {};
  const manifest = read(dir, "release-manifest.json");
  const profile = read(dir, "proof-profile.json");
  const config = read(dir, "case.json") ?? {};
  const initial = new Set((read(dir, "initial-setup.json")?.known ?? []).map((k: Json) => k.id));
  const npcs = readdirSync(dir).filter((f) => /^interrogation-.*\.json$/.test(f)).map((f) => read(dir, f)?.npcId).filter(Boolean);
  const l = (id: string) => labels.get(id) ?? id;
  const entities = (key: string, kind: string, title: string) =>
    `<h3>${title} <span class="count">${(truth[key] ?? []).length}</span></h3><ul class="struct-list">${(truth[key] ?? [])
      .map((e: Json) => `<li><span><strong>${escape(l(e.id))}</strong> <code>${escape(e.id)}</code>${initial.has(e.id) ? ` <span class="tag-soft">bekannt</span>` : ""}${npcs.includes(e.id) ? ` <span class="tag-soft">verhörbar</span>` : ""}</span>${removeButton(name, { op: "remove", id: e.id }, l(e.id))}</li>`)
      .join("")}</ul>`;
  const places = [...(truth.locations ?? []).map((e: Json) => [e.id, `Ort: ${l(e.id)}`]), ...(truth.items ?? []).map((e: Json) => [e.id, `Gegenstand: ${l(e.id)}`])] as [string, string][];
  const propositions = (truth.propositions ?? []).map((p: Json) => [p.id, `${p.truth ? "wahr" : "falsch"}: ${claimText(p.claim, labels, origin)}`]) as [string, string][];
  const mentionable = [...(truth.persons ?? []), ...(truth.locations ?? []), ...(truth.items ?? []), ...(truth.events ?? [])].map((e: Json) => [e.id, l(e.id)]) as [string, string][];
  const questions = (read(dir, "questions.json")?.questions ?? []) as Json[];
  const qText = (npc: string, q: string) => (pc.questionTexts ?? []).find((t: Json) => t.npc === npc && t.questionId === q)?.text;
  const steps: Json[] = [...(manifest?.certificateData?.steps ?? []), ...(config.editorSteps ?? [])];
  const stepLabel = (id: string) => {
    const step = steps.find((x) => x.stepId === id);
    return step === undefined ? `${id} (fehlt)` : stepText(step.event, labels);
  };
  const route = (id: string, stepIds: readonly string[], removable: boolean) =>
    `<li class="route"><div class="route-head"><strong>${id === "witness" ? "Hauptweg" : `Weg ${escape(id)}`}</strong>${removable ? removeButton(name, { op: "remove-route", routeId: id }, `Weg ${id}`) : `<span class="muted small-text">im Beweisprofil</span>`}</div><ol>${stepIds
      .map((s) => `<li><code>${escape(s)}</code> ${escape(stepLabel(s))}</li>`)
      .join("")}</ol></li>`;
  const form = (op: string, body: string, button: string) =>
    `<form method="post" action="/editor/${escape(name)}/struct" class="struct-form" data-struct><input type="hidden" name="op" value="${op}">${body}<button type="submit">${button}</button></form>`;
  return `<p class="muted">Hinzufügen und Entfernen ändert den gespeicherten Stand sofort; neue IDs entstehen aus dem Namen. „Rückgängig“ nimmt den letzten Schritt zurück.</p>
<details class="raw" open><summary>Personen, Orte, Gegenstände</summary>
${entities("persons", "person", "Personen")}${entities("locations", "location", "Orte")}${entities("items", "item", "Gegenstände")}
${form("add-entity", `<label>Art <select name="kind">${options([["person", "Person"], ["location", "Ort"], ["item", "Gegenstand"]])}</select></label><label>Name <input name="name" required></label><label>Rolle <input name="role" placeholder="nur Personen"></label><label class="check"><input type="checkbox" name="known" value="1" checked> von Anfang an bekannt</label><label class="check"><input type="checkbox" name="npc" value="1"> verhörbar</label>`, "Hinzufügen")}
</details>
<details class="raw"><summary>Spuren <span class="count">${(truth.evidence ?? []).length}</span></summary><ul class="struct-list">${(truth.evidence ?? [])
    .map((e: Json) => `<li><span><strong>${escape(l(e.id))}</strong> <code>${escape(e.id)}</code> <span class="muted">bei ${escape(l(e.source?.id))}</span></span>${removeButton(name, { op: "remove", id: e.id }, l(e.id))}</li>`)
    .join("")}</ul>
${form("add-clue", `<label>Name <input name="name" required></label><label>Fundort <select name="at">${options(places)}</select></label><label class="wide">Stützt <select name="supports">${options(propositions)}</select></label><label class="wide">Text für die Spieler <textarea name="text" rows="2" required></textarea></label>`, "Spur hinzufügen")}
</details>
<details class="raw"><summary>Fragen <span class="count">${questions.length}</span></summary><ul class="struct-list">${questions
    .map((q) => {
      const askedBy = (pc.questionTexts ?? []).filter((t: Json) => t.questionId === q.id).map((t: Json) => `${l(t.npc)}: „${t.text}“`);
      return `<li><span><code>${escape(q.id)}</code> ${escape(askedBy.join(" · ") || "ohne Spielertext")}</span>${removeButton(name, { op: "remove", id: q.id }, `Frage ${q.id}`)}</li>`;
    })
    .join("")}</ul>
${npcs.length === 0 ? `<p class="muted">Keine verhörbare Person.</p>` : form("add-question", `<label>An <select name="npc">${options(npcs.map((n: string) => [n, l(n)]))}</select></label><label class="wide">Frage <input name="text" required placeholder="Waren Sie um 20:40 im Foyer?"></label><fieldset class="wide"><legend>Worum geht es</legend><div class="checks">${mentionable.map(([id, t]) => `<label class="check"><input type="checkbox" name="about" value="${escape(id)}"> ${escape(t)}</label>`).join("")}</div></fieldset>`, "Frage hinzufügen")}
</details>
<details class="raw"><summary>Lösungswege <span class="count">${1 + (manifest?.certificateData?.routes?.length ?? 0)}</span></summary>
<ul class="routes-list">${route("witness", profile?.witnessStepIds ?? [], false)}${(manifest?.certificateData?.routes ?? []).map((r: Json) => route(r.routeId, r.stepIds ?? [], true)).join("")}</ul>
<h3>Schritte</h3><ul class="struct-list">${steps
    .map((x) => `<li><span><code>${escape(x.stepId)}</code> ${escape(stepText(x.event, labels))}${(config.editorSteps ?? []).some((p: Json) => p.stepId === x.stepId) ? ` <span class="tag-soft">noch in keinem Weg</span>` : ""}</span>${removeButton(name, { op: "remove-step", stepId: x.stepId }, `Schritt ${x.stepId}`)}</li>`)
    .join("")}</ul>
${form("add-step", `<label>Aktion <select name="action">${options([["search_location", "Ort durchsuchen"], ["examine_item", "Gegenstand untersuchen"], ["ask", "Person fragen"]])}</select></label><label>Ziel <select name="target">${options([
    ...(truth.locations ?? []).map((e: Json) => [e.id, `Ort: ${l(e.id)}`]),
    ...(truth.items ?? []).map((e: Json) => [e.id, `Gegenstand: ${l(e.id)}`]),
    ...npcs.map((n: string) => [n, `Person: ${l(n)}`]),
  ] as [string, string][])}</select></label><label class="wide">Frage (nur beim Fragen) <select name="question"><option value="">–</option>${options(
    questions.flatMap((q) => (pc.questionTexts ?? []).filter((t: Json) => t.questionId === q.id).map((t: Json) => [q.id, `${l(t.npc)}: ${t.text}`])) as [string, string][],
  )}</select></label>`, "Schritt anlegen")}
${form("add-route", `<label class="wide">Neuer Weg: Schritte in Reihenfolge <input name="steps" required placeholder="${escape(steps.slice(0, 3).map((x) => x.stepId).join(", "))}"></label>`, "Weg hinzufügen")}
</details>`;
}

/** Live difficulty and balance warnings of the playtest bot. */
export function playtestPanel(report: CaseReport | null, reason = ""): string {
  if (report === null) return `<p class="muted">${escape(reason || "Erst wenn der Fall gültig ist, spielt der Bot ihn.")}</p>`;
  const m = report.metrics;
  const unsolved = report.runs.filter((r) => r.style !== "voreilig" && !r.solved).length;
  return `<p class="difficulty-big" title="Schwierigkeit ${report.rating} von 5">${escape(difficultyText(report.rating))}</p>
<dl class="metrics"><div><dt>Aktionen bis zur Lösung</dt><dd>${m.actionsToSolve}</dd></div><div><dt>Sackgassen</dt><dd>${Math.round(m.deadEndRate * 100)} %</dd></div><div><dt>Fehlanklagen (voreilig)</dt><dd>${m.wrongAccusations}</dd></div><div><dt>Funde für den Beweis</dt><dd>${m.findsNeeded} von ${m.findsAvailable}</dd></div><div><dt>Hinweise nötig</dt><dd>${m.hints}</dd></div><div><dt>Bot-Läufe ungelöst</dt><dd>${unsolved}</dd></div></dl>
${report.warnings.length === 0 ? `<p class="ok-text">Keine Balance-Warnungen.</p>` : `<ul class="problems warn">${report.warnings.map((w) => `<li>${escape(w)}</li>`).join("")}</ul>`}`;
}

export function renderEditor(name: string, dir: string, check: CaseCheck, origin: number, feedback: Feedback | null, extra: { readonly playtest: string; readonly canUndo: boolean } = { playtest: playtestPanel(null), canUndo: false }): string {
  const pc = read(dir, "public-content.json");
  const title = typeof pc?.title === "string" ? pc.title : name;
  const labels: Labels = new Map(Array.isArray(pc?.labels) ? pc.labels.map((l: Json) => [l?.entity?.id, l?.label]) : []);
  return layout(
    `Editor: ${title}`,
    `<header class="topbar"><a class="home" href="/editor"><span aria-hidden="true">←</span> Werkstatt</a><div class="case-title"><p class="kicker">Fall-Editor · ${escape(name)}</p><h1>${escape(title)}</h1></div><span class="badge" id="status-badge">${check.ok ? "gültig" : "ungültig"}</span></header>
<div class="desk editor">
<aside class="dossier side-check"><section class="card check" aria-live="polite"><h2>check-case</h2><div id="check">${checkPanel(check)}</div>
<div class="actions"><button type="submit" form="editor" class="primary">Speichern</button><a class="button" href="/editor/${escape(name)}">Verwerfen</a>${
      extra.canUndo ? `<form method="post" action="/editor/${escape(name)}/undo" class="inline-form" data-struct><button type="submit">Rückgängig</button></form>` : ""
    }</div>
<p class="probe"><a class="button${check.ok ? "" : " disabled"}" id="probe" href="/fall/probe-${escape(name)}" target="_blank" rel="noopener"${check.ok ? "" : ` aria-disabled="true"`}>Probespielen ↗</a> <span class="muted small-text">gespeicherter Stand</span></p>${noticeHtml(feedback)}</section>
<section class="card" aria-live="polite"><h2>Spieltest</h2><div id="playtest">${extra.playtest}</div></section></aside>
<div class="play">
<form id="editor" method="post" action="/editor/${escape(name)}/save" class="stack">
<section class="card" id="texte"><h2>Spielertexte</h2>${section(() => textsSection(check, pc))}</section>
<section class="card" id="verhoere"><h2>Verhöre</h2>${section(() => interrogationSection(check, dir, pc, labels, origin))}</section>
<section class="card" id="spuren"><h2>Spuren</h2>${section(() => evidenceSection(check, dir, labels))}</section>
<section class="card" id="dateien"><h2>Dateien (JSON)</h2><p class="muted">Für alles, was die Formulare nicht abdecken. Hashes rechnet der Editor selbst nach.</p>${rawSection(dir, check)}</section>
</form>
<section class="card" id="aufbau"><h2>Aufbau</h2>${structureSection(name, dir, labels, origin)}</section>
</div></div>
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
  if (typeof data.playtest === "string") document.getElementById("playtest").innerHTML = data.playtest;
  badge.textContent = data.ok ? "gültig" : "ungültig";
  for (const el of form.querySelectorAll("[data-field]")) {
    const own = data.problems.filter((p) => p.severity === "error" && hit(p, el.dataset.file, el.dataset.field));
    if (el.matches("input, textarea, select")) { if (own.length > 0) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid"); }
    const box = el.closest(".field, .rule, details.raw")?.querySelector(":scope > .field-error");
    if (box && (el.matches("input, textarea") || el.matches("select[data-act]"))) { box.hidden = own.length === 0; box.innerHTML = own.map((p) => esc(p.field + ": " + p.message)).join("<br>"); }
  }
}
let dirty = false;
form.addEventListener("input", () => { dirty = true; clearTimeout(timer); timer = setTimeout(check, 400); });
form.addEventListener("submit", () => { dirty = false; });
for (const f of document.querySelectorAll("form[data-struct]")) f.addEventListener("submit", (e) => {
  const ask = e.submitter?.dataset.confirm;
  if ((ask && !confirm(ask)) || (dirty && !confirm("Ungespeicherte Änderungen in den Formularen gehen dabei verloren. Fortfahren?"))) e.preventDefault();
});
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
.stack { display: flex; flex-direction: column; gap: 20px; }
.side-check .card + .card { margin-top: 20px; }
.side-check { max-height: calc(100vh - 90px); overflow: auto; }
.probe { margin: 12px 0 0; }
a.button.disabled { opacity: .45; pointer-events: none; }
.small-text { font-size: 13px; }
.difficulty-big { font: 700 22px var(--sans); margin: 0 0 10px; letter-spacing: .02em; }
.metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 0 0 10px; }
.metrics div { background: #fffaf0; border: 1px solid var(--line); border-radius: 3px; padding: 6px 8px; }
.metrics dt { font: 600 11px var(--sans); color: var(--ink-soft); text-transform: uppercase; letter-spacing: .06em; }
.metrics dd { margin: 0; font: 700 18px var(--type); }
.ok-text { color: var(--ok); font: 600 14px var(--sans); }
.struct-list { list-style: none; margin: 0 0 10px; padding: 0; }
.struct-list li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 0; border-top: 1px dashed var(--line); font: 15px var(--sans); }
.struct-list code, .routes-list code { font: 12px var(--type); color: var(--ink-soft); }
.tag-soft { font: 600 11px var(--sans); background: var(--paper-2); border: 1px solid var(--line); border-radius: 3px; padding: 1px 6px; color: var(--ink-soft); }
.inline-form { display: inline; margin: 0; }
button.small { min-height: 30px; padding: 4px 10px; font-size: 13px; }
button.danger-ghost { color: var(--blood); border-color: rgba(143,45,31,.4); background: transparent; box-shadow: none; }
button.danger-ghost:hover { background: var(--blood); color: #fff; }
.struct-form { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: flex-end; margin: 12px 0 6px; padding: 12px; background: var(--paper-2); border-radius: 3px; }
.struct-form label { display: flex; flex-direction: column; gap: 3px; font: 600 12px var(--sans); color: var(--ink-soft); }
.struct-form label.check { flex-direction: row; align-items: center; gap: 6px; font-weight: 500; }
.struct-form .wide { flex: 1 1 100%; }
.struct-form input:not([type=checkbox]), .struct-form textarea { font: 15px var(--sans); padding: 7px 9px; border: 1px solid #b9a789; border-radius: var(--radius); background: #fffaf0; }
.struct-form fieldset { border: 1px solid var(--line); border-radius: 3px; margin: 0; padding: 6px 10px; }
.struct-form legend { font: 600 12px var(--sans); color: var(--ink-soft); }
.checks { display: flex; flex-wrap: wrap; gap: 4px 14px; max-height: 140px; overflow: auto; }
.routes-list { list-style: none; padding: 0; margin: 0 0 10px; display: grid; gap: 10px; }
.route { background: #fffaf0; border: 1px solid var(--line); border-left: 4px solid var(--brass); border-radius: 3px; padding: 8px 12px; }
.route-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.route ol { margin: 6px 0 0; padding-left: 20px; font: 14px var(--sans); }
@media (max-width: 1000px) { .side-check { position: static; } .editor .side-check, .editor .play { grid-column: 1; grid-row: auto; } .pair { grid-template-columns: 1fr; } }
`;
