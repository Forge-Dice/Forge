import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CaseCheck, Problem } from "../authoring/check-case.ts";
import { problemText } from "../authoring/check-case-en.ts";
import { fileDigest, getAt, type CaseSource } from "./editor.ts";
import type { CaseReport } from "./playtest.ts";
import { difficultyDots, difficultyText } from "./difficulty.ts";
import { EDITOR_MESSAGES, warningText, type EditorMessages } from "./editor-messages.ts";
import { DEFAULT_LANG, MESSAGES, type Lang } from "./messages.ts";
import { escape, langSwitch, layout, type Feedback } from "./web-page.ts";

// HTML views of the case editor. Every form control names its file and field in check-case notation
// (data-file, data-field), so a check-case problem lands next to the control it is about. The frame
// is German or English (EDITOR_MESSAGES); case content is shown exactly as the files hold it.

type Json = any; // the folder's JSON files as read from disk; check-case validates them
type Labels = Map<string, string>;
type T = EditorMessages;
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

function claimText(claim: Json, labels: Labels, origin: number, t: T): string {
  const l = (id: string) => labels.get(id) ?? id;
  switch (claim?.kind) {
    case "personAt":
      return t.claim.personAt(l(claim.personId), clock(origin + claim.at), l(claim.locationId));
    case "eventHasParticipant":
      return t.claim.participant(l(claim.personId), l(claim.eventId));
    case "eventHasItem":
      return t.claim.item(l(claim.itemId), l(claim.eventId));
    default:
      return JSON.stringify(claim ?? null);
  }
}

const matches = (p: Problem, file: string, field: string) =>
  p.file === file && (p.field === field || p.field.startsWith(`${field}.`) || p.field.startsWith(`${field}[`) || p.field.startsWith(`${field} `));

const fieldId = (file: string, field: string) => `fld-${(file + "-" + field).replace(/[^a-zA-Z0-9]+/g, "-")}`;

/** A problem's field for display: the file-level marker is a word, the rest are paths. */
const fieldText = (field: string, t: T) => (field === "(Datei)" ? t.check.fileField : field);

function errorsFor(check: CaseCheck, file: string, field: string, lang: Lang): string {
  const own = check.problems.filter((p) => p.severity === "error" && matches(p, file, field));
  const t = EDITOR_MESSAGES[lang];
  return `<p class="field-error"${own.length === 0 ? " hidden" : ""}>${own.map((p) => escape(`${fieldText(p.field, t)}: ${problemText(p.message, lang)}`)).join("<br>")}</p>`;
}

function control(check: CaseCheck, lang: Lang, file: string, field: string, label: string, value: string, multiline = false, hint = ""): string {
  const id = fieldId(file, field);
  const invalid = check.problems.some((p) => p.severity === "error" && matches(p, file, field));
  const attrs = `id="${id}" name="f:${escape(file)}:${escape(field)}" data-file="${escape(file)}" data-field="${escape(field)}"${invalid ? ` aria-invalid="true"` : ""}`;
  const input = multiline
    ? `<textarea ${attrs} rows="${Math.min(12, Math.max(3, Math.ceil(value.length / 90) + value.split("\n").length))}">${escape(value)}</textarea>`
    : `<input ${attrs} value="${escape(value)}">`;
  return `<div class="field"><label for="${id}">${escape(label)}</label>${hint === "" ? "" : `<span class="field-hint">${escape(hint)}</span>`}${input}${errorsFor(check, file, field, lang)}</div>`;
}

function select(name: string, attrs: string, options: [string, string][], value: string, label: string): string {
  return `<label class="inline">${escape(label)} <select name="${escape(name)}" ${attrs}>${options
    .map(([v, text]) => `<option value="${v}"${v === value ? " selected" : ""}>${escape(text)}</option>`)
    .join("")}</select></label>`;
}

// ---------- Sections ----------

function textsSection(check: CaseCheck, pc: Json, lang: Lang): string {
  const t = EDITOR_MESSAGES[lang];
  const F = "public-content.json";
  if (pc === null) return `<p class="muted">${t.missingOrNoJson("public-content.json")}</p>`;
  const labels = (pc.labels ?? [])
    .map((l: Json, i: number) =>
      `<div class="pair">${control(check, lang, F, `labels[${i}].label`, `${l.entity?.kind ?? ""} ${l.entity?.id ?? ""}`, String(l.label ?? ""))}${
        typeof l.role === "string" ? control(check, lang, F, `labels[${i}].role`, t.texts.role, l.role) : ""
      }</div>`,
    )
    .join("");
  const rules = (pc.publicRules ?? []).map((r: Json, i: number) => control(check, lang, F, `publicRules[${i}].text`, r.id ?? t.texts.rule(i + 1), String(r.text ?? ""), true)).join("");
  return `${control(check, lang, F, "title", t.texts.title, String(pc.title ?? ""))}
${control(check, lang, F, "challengeQuestion", t.texts.challenge, String(pc.challengeQuestion ?? ""))}
${control(check, lang, F, "brief", t.texts.brief, String(pc.brief ?? ""), true, t.texts.briefHint)}
${control(check, lang, F, "epilogue", t.texts.epilogue, String(pc.epilogue ?? ""), true, t.texts.epilogueHint)}
<h3>${t.texts.namesRoles}</h3>${labels}
<h3>${t.texts.rules}</h3>${rules}`;
}

function interrogationSection(check: CaseCheck, dir: string, pc: Json, labels: Labels, origin: number, lang: Lang): string {
  const t = EDITOR_MESSAGES[lang];
  const I = t.interrogation;
  const files = readdirSync(dir).filter((f) => /^interrogation-[a-z0-9-]+\.json$/.test(f)).sort();
  if (files.length === 0) return `<p class="muted">${I.none}</p>`;
  return files
    .map((file) => {
      const profile = read(dir, file);
      if (profile === null) return `<p class="muted">${escape(t.noJson(file))}</p>`;
      const npc = labels.get(profile.npcId) ?? profile.npcId;
      const fileErrors = check.problems.filter((p) => p.severity === "error" && p.file === file).length;
      const rules = (profile.rules ?? [])
        .map((rule: Json, i: number) => {
          const q = (pc?.questionTexts ?? []).findIndex((x: Json) => x.npc === profile.npcId && x.questionId === rule.questionId);
          const question = q < 0 ? `<p class="muted">${escape(I.noPlayerText(rule.questionId))}</p>` : control(check, lang, "public-content.json", `questionTexts[${q}].text`, I.question(String(rule.questionId).replace(/^question:/, "")), String(pc.questionTexts[q].text));
          const attrs = (extra: string) => `data-file="${escape(file)}" data-field="rules[${i}]"${extra}`;
          const what =
            rule.act === "decline"
              ? I.declines
              : rule.act === "lie"
                ? I.lies(rule.stance === "affirms" ? I.yes : I.no, claimText(rule.claim, labels, origin, t))
                : I.answers(claimText(rule.claim, labels, origin, t));
          return `<li class="rule">${question}<div class="rule-row">${select(`act:${file}:${i}`, attrs(" data-act"), [["answer", I.actAnswer], ["lie", I.actLie], ["decline", I.actDecline]], rule.act, I.behaviour)}${select(
            `stance:${file}:${i}`,
            attrs(` data-stance${rule.act === "lie" ? "" : " disabled"}`),
            [["affirms", I.stanceYes], ["denies", I.stanceNo]],
            rule.stance ?? "denies",
            I.lie,
          )}</div><p class="claim">${escape(what)}</p>${errorsFor(check, file, `rules[${i}]`, lang)}</li>`;
        })
        .join("");
      return `<details class="witness"${fileErrors > 0 ? " open" : ""}><summary><span class="avatar" aria-hidden="true">${escape(npc.slice(0, 2).toUpperCase())}</span><span><span class="npc-name">${escape(npc)}</span><br><span class="npc-meta">${escape(file)} · ${I.questions(profile.rules?.length ?? 0)}${
        fileErrors > 0 ? ` · <strong class="bad">${t.errors(fileErrors)}</strong>` : ""
      }</span></span></summary><ol class="rules">${rules}</ol></details>`;
    })
    .join("");
}

function accessText(entry: Json, labels: Labels, t: T): string {
  const A = t.access;
  const access = entry?.access;
  if (access?.kind !== "discoverable") return access?.kind === undefined ? A.missing : A.kind(access.kind);
  const how = (p: Json) =>
    p.kind === "search_location" ? A.searchLocation(labels.get(p.locationId) ?? p.locationId) : p.kind === "examine_item" ? A.examineItem(labels.get(p.itemId) ?? p.itemId) : p.kind === "examine_person" ? A.examinePerson(labels.get(p.personId) ?? p.personId) : JSON.stringify(p);
  return A.foundBy(access.paths.map(how).join(A.or));
}

function evidenceSection(check: CaseCheck, dir: string, labels: Labels, lang: Lang): string {
  const t = EDITOR_MESSAGES[lang];
  const F = "evidence-presentation.json";
  const presentation = read(dir, F);
  const access = read(dir, "evidence-access.json");
  if (presentation === null) return `<p class="muted">${t.missingOrNoJson(F)}</p>`;
  return `<ol class="clues">${(presentation.entries ?? [])
    .map((e: Json, i: number) => {
      const way = (access?.entries ?? []).find((a: Json) => a.evidenceId === e.evidenceId);
      return `<li>${control(check, lang, F, `entries[${i}].text`, labels.get(e.evidenceId) ?? e.evidenceId, String(e.text ?? ""), true, accessText(way, labels, t))}</li>`;
    })
    .join("")}</ol>`;
}

/**
 * A locale variant (en/ …) beside the German case: per player text the German original and the
 * translation's field. Only texts are offered here; check-case verifies the rest stays shared.
 */
function localeSection(check: CaseCheck, dir: string, locale: string, labels: Labels, lang: Lang): string {
  const L = EDITOR_MESSAGES[lang].locale;
  const rows: string[] = [];
  const row = (file: string, field: string, label: string, de: unknown, multiline = false) => {
    const value = getAt(read(dir, `${locale}/${file}`), field);
    if (typeof value !== "string") return;
    rows.push(`<div class="pair"><div class="field"><span class="field-hint">${escape(L.german(label))}</span><p class="de-text">${escape(typeof de === "string" ? de : "–")}</p></div>${control(check, lang, `${locale}/${file}`, field, `${label} (${locale})`, value, multiline)}</div>`);
  };
  const P = "public-content.json";
  const pc = read(dir, P);
  if (pc === null) return "";
  for (const [field, label, multi] of [["title", L.title, false], ["challengeQuestion", L.challenge, false], ["brief", L.brief, true], ["epilogue", L.epilogue, true]] as const) row(P, field, label, pc[field], multi);
  (pc.labels ?? []).forEach((l: Json, i: number) => {
    row(P, `labels[${i}].label`, `${l.entity?.kind ?? ""} ${l.entity?.id ?? ""}`, l.label);
    if (typeof l.role === "string") row(P, `labels[${i}].role`, L.role(l.label), l.role);
  });
  (pc.publicRules ?? []).forEach((r: Json, i: number) => row(P, `publicRules[${i}].text`, r.id ?? L.rule(i + 1), r.text, true));
  (pc.questionTexts ?? []).forEach((q: Json, i: number) => {
    const who = labels.get(q.npc) ?? q.npc;
    row(P, `questionTexts[${i}].text`, L.question(who), q.text);
    if (typeof q.answer === "string") row(P, `questionTexts[${i}].answer`, L.answer(who), q.answer, true);
    if (typeof q.admission === "string") row(P, `questionTexts[${i}].admission`, L.admission(who), q.admission, true);
  });
  const E = "evidence-presentation.json";
  (read(dir, E)?.entries ?? []).forEach((e: Json, i: number) => row(E, `entries[${i}].text`, labels.get(e.evidenceId) ?? e.evidenceId, e.text, true));
  return rows.join("");
}

/** Locale variants of a working copy (subfolders with their own public-content.json). */
const localesOf = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^[a-z]{2}$/.test(d.name) && read(dir, `${d.name}/public-content.json`) !== null)
    .map((d) => d.name)
    .sort();

function rawSection(dir: string, check: CaseCheck, lang: Lang): string {
  const t = EDITOR_MESSAGES[lang];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => {
      const text = readFileSync(join(dir, file), "utf8");
      const n = check.problems.filter((p) => p.severity === "error" && p.file === file).length;
      return `<details class="raw"><summary>${escape(file)}${n > 0 ? ` <strong class="bad">${t.errors(n)}</strong>` : ""}</summary><input type="hidden" name="base:${escape(file)}" value="${fileDigest(text)}"><textarea name="raw:${escape(file)}" data-file="${escape(file)}" data-field="(JSON)" rows="18" spellcheck="false">${escape(text)}</textarea>${errorsFor(check, file, "(JSON)", lang)}</details>`;
    })
    .join("");
}

/** The check panel; the same markup is rebuilt by the page script from /check. */
export function checkPanel(check: CaseCheck, lang: Lang = DEFAULT_LANG): string {
  const t = EDITOR_MESSAGES[lang];
  const C = t.check;
  const errors = check.problems.filter((p) => p.severity === "error");
  const warnings = check.problems.filter((p) => p.severity === "warning");
  const routes = check.routes.map((r) => `<li class="${r.report.status === "pass" ? "pass" : "fail"}">${escape(C.route(r.routeId))}: ${r.report.status === "pass" ? C.solvable : escape(C.unsolved(r.report.status, r.report.survivingAnswerCount))}</li>`).join("");
  const item = (p: Problem) => `<li><a href="#${fieldId(p.file, p.field)}" data-file="${escape(p.file)}" data-field="${escape(p.field)}"><code>${escape(p.file)} › ${escape(fieldText(p.field, t))}</code></a> ${escape(problemText(p.message, lang))}</li>`;
  return `<p class="verdict ${check.ok ? "ok" : "bad"}">${check.ok ? C.ok : t.errors(errors.length)}</p>
${routes === "" ? "" : `<ul class="routes">${routes}</ul>`}
${errors.length === 0 ? "" : `<h3>${C.errorsHeading}</h3><ul class="problems">${errors.map(item).join("")}</ul>`}
${warnings.length === 0 ? "" : `<h3>${C.warningsHeading}</h3><ul class="problems warn">${warnings.map(item).join("")}</ul>`}`;
}

function noticeHtml(feedback: Feedback | null): string {
  if (feedback === null) return "";
  return `<div class="ed-notice ${feedback.tone}" role="status"><strong>${escape(feedback.title)}</strong>${feedback.lines.map((l) => `<span>${escape(l)}</span>`).join("")}</div>`;
}

// ---------- Pages ----------

export function renderEditorHome(cards: readonly WorkspaceCard[], sources: readonly CaseSource[], workspace: string, feedback: Feedback | null, lang: Lang = DEFAULT_LANG): string {
  const t = EDITOR_MESSAGES[lang];
  const H = t.home;
  const open = sources
    .map((s) => `<li><form method="post" action="/editor/open"><input type="hidden" name="source" value="${escape(s.key)}"><button type="submit">${escape(s.label)}</button></form></li>`)
    .join("");
  const mine = cards
    .map(
      (c) =>
        `<li><a class="case-card" href="/editor/${escape(c.name)}"><span class="case-no">${escape(H.copy(c.name))}</span><h2>${escape(c.title)}</h2><span class="case-foot"><span class="badge${c.ok ? " solved" : ""}">${c.ok ? t.valid : t.errors(c.errors)}</span><span class="open-file" aria-hidden="true">${H.edit}</span></span></a></li>`,
    )
    .join("");
  return layout(
    H.pageTitle,
    `<header class="masthead"><p class="kicker">${H.kicker}</p><h1>${H.heading}</h1><p class="lead">${escape(H.lead)}</p><p><a class="button ghost" href="/">${escape(H.back)}</a> ${langSwitch(MESSAGES[lang], "/editor")}</p></header>
<main class="shelf">${noticeHtml(feedback)}
<h2 class="shelf-title">${H.copies}</h2>${mine === "" ? `<p class="hint">${H.noCopies}</p>` : `<ul class="cases">${mine}</ul>`}
<h2 class="shelf-title">${H.openCase}</h2><ul class="sources">${open}</ul>
<form class="generate" method="post" action="/editor/generate"><label>${H.generate} <input name="seed" inputmode="numeric" pattern="[0-9]{1,9}" value="${Math.floor(Math.random() * 1000)}" required></label> <button type="submit">${H.generateButton}</button></form>
<p class="hint">${H.folder(`<code>${escape(workspace)}</code>`)}</p></main>`,
    "page-cases",
    EDITOR_STYLE,
    lang,
  );
}

/**
 * A form section from files of possibly the wrong shape (valid JSON can be saved with check-case
 * errors): if it cannot be rendered, the page says so and the file stays editable as JSON below.
 */
function section(render: () => string, t: T): string {
  try {
    return render();
  } catch {
    return `<p class="muted">${t.wrongShape}</p>`;
  }
}

// ---------- Structure: add and remove ----------

const stepText = (event: Json, labels: Labels, t: T): string => {
  const S = t.structure;
  const l = (ref: Json) => labels.get(ref?.$playerRefOf?.id) ?? ref?.$playerRefOf?.id ?? "?";
  if (event?.type === "interrogate") return S.ask(l(event.npc), String(event.questionId ?? "").replace(/^question:/, ""));
  if (event?.action === "search_location") return S.searchLocation(l(event.target));
  if (event?.action === "examine_item") return S.examine(l(event.target));
  if (event?.action === "examine_person") return S.examinePerson(l(event.target));
  return JSON.stringify(event);
};

const removeButton = (name: string, fields: Record<string, string>, what: string, t: T) =>
  `<form method="post" action="/editor/${escape(name)}/struct" class="inline-form" data-struct>${Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${escape(k)}" value="${escape(v)}">`)
    .join("")}<button type="submit" class="small danger-ghost" data-confirm="${escape(t.structure.removeConfirm(what))}" aria-label="${escape(t.structure.removeLabel(what))}">${t.structure.remove}</button></form>`;

const options = (items: readonly [string, string][], selected = "") => items.map(([v, t]) => `<option value="${escape(v)}"${v === selected ? " selected" : ""}>${escape(t)}</option>`).join("");

function structureSection(name: string, dir: string, labels: Labels, origin: number, t: T): string {
  const S = t.structure;
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
      .map((e: Json) => `<li><span><strong>${escape(l(e.id))}</strong> <code>${escape(e.id)}</code>${initial.has(e.id) ? ` <span class="tag-soft">${S.known}</span>` : ""}${npcs.includes(e.id) ? ` <span class="tag-soft">${S.interrogable}</span>` : ""}</span>${removeButton(name, { op: "remove", id: e.id }, l(e.id), t)}</li>`)
      .join("")}</ul>`;
  const places = [...(truth.locations ?? []).map((e: Json) => [e.id, S.location(l(e.id))]), ...(truth.items ?? []).map((e: Json) => [e.id, S.item(l(e.id))])] as [string, string][];
  const propositions = (truth.propositions ?? []).map((p: Json) => [p.id, S.proposition(Boolean(p.truth), claimText(p.claim, labels, origin, t))]) as [string, string][];
  const mentionable = [...(truth.persons ?? []), ...(truth.locations ?? []), ...(truth.items ?? []), ...(truth.events ?? [])].map((e: Json) => [e.id, l(e.id)]) as [string, string][];
  const questions = (read(dir, "questions.json")?.questions ?? []) as Json[];
  const steps: Json[] = [...(manifest?.certificateData?.steps ?? []), ...(config.editorSteps ?? [])];
  const stepLabel = (id: string) => {
    const step = steps.find((x) => x.stepId === id);
    return step === undefined ? S.missingStep(id) : stepText(step.event, labels, t);
  };
  const route = (id: string, stepIds: readonly string[], removable: boolean) =>
    `<li class="route"><div class="route-head"><strong>${id === "witness" ? S.mainRoute : escape(S.route(id))}</strong>${removable ? removeButton(name, { op: "remove-route", routeId: id }, S.route(id), t) : `<span class="muted small-text">${S.inProofProfile}</span>`}</div><ol>${stepIds
      .map((s) => `<li><code>${escape(s)}</code> ${escape(stepLabel(s))}</li>`)
      .join("")}</ol></li>`;
  const form = (op: string, body: string, button: string) =>
    `<form method="post" action="/editor/${escape(name)}/struct" class="struct-form" data-struct><input type="hidden" name="op" value="${op}">${body}<button type="submit">${button}</button></form>`;
  return `<p class="muted">${S.intro}</p>
<details class="raw" open><summary>${S.entitiesSummary}</summary>
${entities("persons", "person", S.persons)}${entities("locations", "location", S.locations)}${entities("items", "item", S.items)}
${form("add-entity", `<label>${S.kind} <select name="kind">${options([["person", S.kindPerson], ["location", S.kindLocation], ["item", S.kindItem]])}</select></label><label>${S.name} <input name="name" required></label><label>${S.role} <input name="role" placeholder="${escape(S.rolePlaceholder)}"></label><label class="check"><input type="checkbox" name="known" value="1" checked> ${S.knownFromStart}</label><label class="check"><input type="checkbox" name="npc" value="1"> ${S.interrogable}</label>`, S.add)}
</details>
<details class="raw"><summary>${S.clues} <span class="count">${(truth.evidence ?? []).length}</span></summary><ul class="struct-list">${(truth.evidence ?? [])
    .map((e: Json) => `<li><span><strong>${escape(l(e.id))}</strong> <code>${escape(e.id)}</code> <span class="muted">${escape(S.at(l(e.source?.id)))}</span></span>${removeButton(name, { op: "remove", id: e.id }, l(e.id), t)}</li>`)
    .join("")}</ul>
${form("add-clue", `<label>${S.name} <input name="name" required></label><label>${S.foundAt} <select name="at">${options(places)}</select></label><label class="wide">${S.supports} <select name="supports">${options(propositions)}</select></label><label class="wide">${S.playerText} <textarea name="text" rows="2" required></textarea></label>`, S.addClue)}
</details>
<details class="raw"><summary>${S.questions} <span class="count">${questions.length}</span></summary><ul class="struct-list">${questions
    .map((q) => {
      const askedBy = (pc.questionTexts ?? []).filter((x: Json) => x.questionId === q.id).map((x: Json) => `${l(x.npc)}: ${t.q(x.text)}`);
      return `<li><span><code>${escape(q.id)}</code> ${escape(askedBy.join(" · ") || S.noPlayerText)}</span>${removeButton(name, { op: "remove", id: q.id }, S.question(q.id), t)}</li>`;
    })
    .join("")}</ul>
${npcs.length === 0 ? `<p class="muted">${S.noNpc}</p>` : form("add-question", `<label>${S.to} <select name="npc">${options(npcs.map((n: string) => [n, l(n)]))}</select></label><label class="wide">${S.questionLabel} <input name="text" required placeholder="${escape(S.questionPlaceholder)}"></label><fieldset class="wide"><legend>${S.about}</legend><div class="checks">${mentionable.map(([id, x]) => `<label class="check"><input type="checkbox" name="about" value="${escape(id)}"> ${escape(x)}</label>`).join("")}</div></fieldset>`, S.addQuestion)}
</details>
<details class="raw"><summary>${S.routes} <span class="count">${1 + (manifest?.certificateData?.routes?.length ?? 0)}</span></summary>
<ul class="routes-list">${route("witness", profile?.witnessStepIds ?? [], false)}${(manifest?.certificateData?.routes ?? []).map((r: Json) => route(r.routeId, r.stepIds ?? [], true)).join("")}</ul>
<h3>${S.steps}</h3><ul class="struct-list">${steps
    .map((x) => `<li><span><code>${escape(x.stepId)}</code> ${escape(stepText(x.event, labels, t))}${(config.editorSteps ?? []).some((p: Json) => p.stepId === x.stepId) ? ` <span class="tag-soft">${S.notInRoute}</span>` : ""}</span>${removeButton(name, { op: "remove-step", stepId: x.stepId }, S.step(x.stepId), t)}</li>`)
    .join("")}</ul>
${form("add-step", `<label>${S.action} <select name="action">${options([["search_location", S.actionSearch], ["examine_item", S.actionExamine], ["ask", S.actionAsk]])}</select></label><label>${S.target} <select name="target">${options([
    ...(truth.locations ?? []).map((e: Json) => [e.id, S.location(l(e.id))]),
    ...(truth.items ?? []).map((e: Json) => [e.id, S.item(l(e.id))]),
    ...npcs.map((n: string) => [n, S.person(l(n))]),
  ] as [string, string][])}</select></label><label class="wide">${S.questionWhenAsking} <select name="question"><option value="">–</option>${options(
    questions.flatMap((q) => (pc.questionTexts ?? []).filter((x: Json) => x.questionId === q.id).map((x: Json) => [q.id, `${l(x.npc)}: ${x.text}`])) as [string, string][],
  )}</select></label>`, S.addStep)}
${form("add-route", `<label class="wide">${S.newRoute} <input name="steps" required placeholder="${escape(steps.slice(0, 3).map((x) => x.stepId).join(", "))}"></label>`, S.addRoute)}
</details>`;
}

/** Live difficulty and balance warnings of the playtest bot. */
export function playtestPanel(report: CaseReport | null, reason = "", lang: Lang = DEFAULT_LANG): string {
  const P = EDITOR_MESSAGES[lang].playtest;
  if (report === null) return `<p class="muted">${escape(reason || P.notYet)}</p>`;
  const m = report.metrics;
  const unsolved = report.runs.filter((r) => r.style !== "voreilig" && !r.solved).length;
  const difficulty = lang === DEFAULT_LANG ? difficultyText(report.rating) : `${difficultyDots(report.rating)} ${MESSAGES[lang].difficulty[report.rating]}`;
  return `<p class="difficulty-big" title="${escape(P.difficultyTitle(report.rating))}">${escape(difficulty)}</p>
<dl class="metrics"><div><dt>${P.actionsToSolve}</dt><dd>${m.actionsToSolve}</dd></div><div><dt>${P.deadEnds}</dt><dd>${P.percent(Math.round(m.deadEndRate * 100))}</dd></div><div><dt>${P.wrongAccusations}</dt><dd>${m.wrongAccusations}</dd></div><div><dt>${P.findsNeeded}</dt><dd>${P.of(m.findsNeeded, m.findsAvailable)}</dd></div><div><dt>${P.hints}</dt><dd>${m.hints}</dd></div><div><dt>${P.unsolvedRuns}</dt><dd>${unsolved}</dd></div></dl>
${report.warnings.length === 0 ? `<p class="ok-text">${P.noWarnings}</p>` : `<ul class="problems warn">${report.warnings.map((w) => `<li>${escape(warningText(w, lang))}</li>`).join("")}</ul>`}`;
}

export function renderEditor(
  name: string,
  dir: string,
  check: CaseCheck,
  origin: number,
  feedback: Feedback | null,
  extra: { readonly playtest: string; readonly canUndo: boolean } = { playtest: playtestPanel(null), canUndo: false },
  lang: Lang = DEFAULT_LANG,
): string {
  const t = EDITOR_MESSAGES[lang];
  const E = t.editor;
  const pc = read(dir, "public-content.json");
  const title = typeof pc?.title === "string" ? pc.title : name;
  const labels: Labels = new Map(Array.isArray(pc?.labels) ? pc.labels.map((l: Json) => [l?.entity?.id, l?.label]) : []);
  return layout(
    E.pageTitle(title),
    `<header class="topbar"><a class="home" href="/editor"><span aria-hidden="true">←</span> ${E.workshop}</a><div class="case-title"><p class="kicker">${escape(E.kicker(name))}</p><h1>${escape(title)}</h1></div>${langSwitch(MESSAGES[lang], `/editor/${name}`)}<span class="badge" id="status-badge">${check.ok ? t.valid : t.invalid}</span></header>
<div class="desk editor">
<aside class="dossier side-check"><section class="card check" aria-live="polite"><h2>check-case</h2><div id="check">${checkPanel(check, lang)}</div>
<div class="actions"><button type="submit" form="editor" class="primary">${E.save}</button><a class="button" href="/editor/${escape(name)}">${E.discard}</a>${
      extra.canUndo ? `<form method="post" action="/editor/${escape(name)}/undo" class="inline-form" data-struct><button type="submit">${E.undo}</button></form>` : ""
    }</div>
<p class="probe"><a class="button${check.ok ? "" : " disabled"}" id="probe" href="/fall/probe-${escape(name)}" target="_blank" rel="noopener"${check.ok ? "" : ` aria-disabled="true"`}>${E.probe}</a> <a class="button${check.ok ? "" : " disabled"}" id="export" href="/editor/${escape(name)}/export" download${check.ok ? "" : ` aria-disabled="true" title="${escape(E.exportNeedsValid)}"`}>${E.export}</a> <span class="muted small-text">${E.savedState}</span></p>${noticeHtml(feedback)}</section>
<section class="card" aria-live="polite"><h2>${E.playtest}</h2><div id="playtest">${extra.playtest}</div></section></aside>
<div class="play">
<form id="editor" method="post" action="/editor/${escape(name)}/save" class="stack">
<section class="card" id="texte"><h2>${E.playerTexts}</h2>${section(() => textsSection(check, pc, lang), t)}</section>
<section class="card" id="verhoere"><h2>${E.interrogations}</h2>${section(() => interrogationSection(check, dir, pc, labels, origin, lang), t)}</section>
<section class="card" id="spuren"><h2>${E.clues}</h2>${section(() => evidenceSection(check, dir, labels, lang), t)}</section>
${localesOf(dir)
  .map((locale) => `<section class="card" id="sprache-${locale}"><h2>${escape(t.locale.heading(locale))}</h2><p class="muted">${t.locale.hint}</p>${section(() => localeSection(check, dir, locale, labels, lang), t)}</section>`)
  .join("")}
<section class="card" id="dateien"><h2>${E.files}</h2><p class="muted">${E.filesHint}</p>${rawSection(dir, check, lang)}</section>
</form>
<section class="card" id="aufbau"><h2>${E.structure}</h2>${structureSection(name, dir, labels, origin, t)}</section>
</div></div>
<script>${SCRIPT(name, t)}</script>`,
    "page-editor",
    EDITOR_STYLE,
    lang,
  );
}

const js = (text: string) => JSON.stringify(text).replace(/</g, "\\u003c");

// The German page keeps its field paths as they are; another language words the file-level marker.
const SCRIPT = (name: string, t: T) => {
  const fieldExpr = t.check.fileField === "(Datei)" ? "p.field" : `(p.field === "(Datei)" ? ${js(t.check.fileField)} : p.field)`;
  return `(() => {
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
  badge.textContent = ${js(t.script.checking)};
  let data;
  try {
    const res = await fetch("/editor/${name}/check", { method: "POST", body: new URLSearchParams(new FormData(form)) });
    data = await res.json();
  } catch { badge.textContent = ${js(t.script.unreachable)}; return; }
  if (mine !== seq) return;
  panel.innerHTML = data.html;
  if (typeof data.playtest === "string") document.getElementById("playtest").innerHTML = data.playtest;
  badge.textContent = data.ok ? ${js(t.valid)} : ${js(t.invalid)};
  for (const el of form.querySelectorAll("[data-field]")) {
    const own = data.problems.filter((p) => p.severity === "error" && hit(p, el.dataset.file, el.dataset.field));
    if (el.matches("input, textarea, select")) { if (own.length > 0) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid"); }
    const box = el.closest(".field, .rule, details.raw")?.querySelector(":scope > .field-error");
    if (box && (el.matches("input, textarea") || el.matches("select[data-act]"))) { box.hidden = own.length === 0; box.innerHTML = own.map((p) => esc(${fieldExpr} + ": " + p.message)).join("<br>"); }
  }
}
let dirty = false;
form.addEventListener("input", () => { dirty = true; clearTimeout(timer); timer = setTimeout(check, 400); });
form.addEventListener("submit", () => { dirty = false; });
for (const f of document.querySelectorAll("form[data-struct]")) f.addEventListener("submit", (e) => {
  const ask = e.submitter?.dataset.confirm;
  if ((ask && !confirm(ask)) || (dirty && !confirm(${js(t.script.confirmDirty)}))) e.preventDefault();
});
form.addEventListener("change", () => { clearTimeout(timer); timer = setTimeout(check, 50); });
panel.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-file]"); if (!a) return;
  const target = [...form.querySelectorAll("[data-field]")].find((el) => el.matches("input, textarea, select") && hit({ file: a.dataset.file, field: a.dataset.field }, el.dataset.file, el.dataset.field));
  if (!target) return;
  e.preventDefault(); target.closest("details")?.setAttribute("open", ""); target.focus(); target.scrollIntoView({ block: "center" });
});
})();`;
};

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
.de-text { margin: 4px 0 0; white-space: pre-wrap; color: var(--ink-soft); }
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
