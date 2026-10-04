import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EDITOR_MESSAGES, type EditorMessages } from "./editor-messages.ts";
import { DEFAULT_LANG, type Lang } from "./messages.ts";

// Structural edits of a case folder for the editor: add and remove persons, places, items, clues,
// questions, witness steps and solution routes. New IDs are derived from the display name and made
// unique; every file that has to know about the new object gets its entry (truth, labels, initial
// knowledge, clue access and presentation, catalogue, NPC files). Removal deletes the object and
// everything that refers to it. Hashes are left to check-case --fix, open gaps to check-case.

type Json = any;
export type EntityKind = "person" | "location" | "item";
export type StructureOp =
  | { readonly op: "add-entity"; readonly kind: EntityKind; readonly name: string; readonly role?: string; readonly known: boolean; readonly npc?: boolean }
  | { readonly op: "add-clue"; readonly name: string; readonly text: string; readonly at: string; readonly supports: string }
  | { readonly op: "add-question"; readonly npc: string; readonly about: readonly string[]; readonly text: string }
  | { readonly op: "add-step"; readonly action: "search_location" | "examine_item" | "ask"; readonly target: string; readonly question?: string }
  | { readonly op: "add-route"; readonly stepIds: readonly string[] }
  | { readonly op: "remove"; readonly id: string }
  | { readonly op: "remove-route"; readonly routeId: string }
  | { readonly op: "remove-step"; readonly stepId: string };
export type StructureResult = { readonly ok: true; readonly message: string; readonly id?: string } | { readonly ok: false; readonly message: string };

type Msg = EditorMessages["struct"];

const SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const ENTITY_ID = /^(person|location|item|event|evidence|proposition|question):[a-z0-9][a-z0-9_-]{0,63}$/;

/** "Fräulein Öhm-Weiß" -> "fraeulein-oehm-weiss" */
export function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 40).replace(/-+$/, "");
  return s === "" ? "neu" : s;
}

class Folder {
  private readonly cache = new Map<string, Json>();
  private readonly dirty = new Set<string>();
  private readonly deleted = new Set<string>();
  constructor(readonly dir: string) {}
  files(): string[] {
    return readdirSync(this.dir).filter((f) => f.endsWith(".json") && !this.deleted.has(f)).sort();
  }
  has(file: string): boolean {
    return !this.deleted.has(file) && (this.cache.has(file) || existsSync(join(this.dir, file)));
  }
  get(file: string): Json {
    if (!this.cache.has(file)) this.cache.set(file, JSON.parse(readFileSync(join(this.dir, file), "utf8")));
    return this.cache.get(file);
  }
  set(file: string, value: Json): void {
    this.cache.set(file, value);
    this.deleted.delete(file);
    this.dirty.add(file);
  }
  touch(file: string): Json {
    this.dirty.add(file);
    return this.get(file);
  }
  remove(file: string): void {
    this.deleted.add(file);
    this.dirty.delete(file);
  }
  commit(): void {
    for (const file of this.dirty) writeFileSync(join(this.dir, file), `${JSON.stringify(this.cache.get(file), null, 2)}\n`);
    for (const file of this.deleted) if (existsSync(join(this.dir, file))) unlinkSync(join(this.dir, file));
  }
}

/** Every ID of a kind in the case (truth, catalogue, manifest steps), for uniqueness. */
function takenIds(f: Folder): Set<string> {
  const ids = new Set<string>();
  const walk = (v: Json) => {
    if (typeof v === "string" && ENTITY_ID.test(v)) ids.add(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === "object" && v !== null) Object.values(v).forEach(walk);
  };
  for (const file of f.files()) walk(f.get(file));
  return ids;
}

function freshId(f: Folder, prefix: string, name: string): string {
  const taken = takenIds(f);
  const base = slugify(name);
  for (let n = 1; ; n++) {
    const id = `${prefix}:${n === 1 ? base : `${base}-${n}`}`;
    if (!taken.has(id) && !f.has(`npc-${id.slice(prefix.length + 1)}.json`)) return id;
  }
}

const label = (f: Folder, id: string): string =>
  (f.get("public-content.json").labels ?? []).find((l: Json) => l.entity?.id === id)?.label ?? id;
const kindOf = (id: string) => id.slice(0, id.indexOf(":"));
const refOf = (id: string) => ({ $playerRefOf: { kind: kindOf(id), id } });

// ---------- Add ----------

function addEntity(f: Folder, op: Extract<StructureOp, { op: "add-entity" }>, t: Msg): StructureResult {
  const name = op.name.trim();
  if (name === "") return { ok: false, message: t.nameMissing };
  const id = freshId(f, op.kind, name);
  const key = { person: "persons", location: "locations", item: "items" }[op.kind];
  f.touch("truth.json")[key].push({ id, name });
  const role = op.kind === "person" && op.role !== undefined && op.role.trim() !== "" ? op.role.trim() : null;
  f.touch("public-content.json").labels.push({ entity: { kind: op.kind, id }, label: name, role });
  if (op.known) f.touch("initial-setup.json").known.push({ kind: op.kind, id });
  if (op.kind === "person" && op.npc === true) {
    // Copy the header of an existing NPC (case, hashes, revision, time) and start with no knowledge.
    const slug = id.slice("person:".length);
    const sibling = f.files().find((file) => /^npc-.*\.json$/.test(file));
    const profileSibling = f.files().find((file) => /^interrogation-.*\.json$/.test(file));
    if (sibling === undefined || profileSibling === undefined) return { ok: false, message: t.noTemplate };
    const { awareness: _a, attitudes: _t, ...head } = f.get(sibling);
    f.set(`npc-${slug}.json`, { ...head, npcId: id, awareness: [{ subject: { kind: "person", id }, acquiredAt: 0, provenance: { kind: "prior_knowledge" } }], attitudes: [] });
    const { rules: _r, ...profileHead } = f.get(profileSibling);
    f.set(`interrogation-${slug}.json`, { ...profileHead, npcId: id, rules: [] });
  }
  return { ok: true, message: t.added(name, id), id };
}

function addClue(f: Folder, op: Extract<StructureOp, { op: "add-clue" }>, t: Msg): StructureResult {
  const name = op.name.trim();
  if (name === "" || op.text.trim() === "") return { ok: false, message: t.clueMissing };
  const sourceKind = kindOf(op.at);
  if (sourceKind !== "location" && sourceKind !== "item") return { ok: false, message: t.clueSource };
  if (!/^proposition:/.test(op.supports)) return { ok: false, message: t.clueSupports };
  const known = takenIds(f);
  for (const ref of [op.at, op.supports]) if (!known.has(ref)) return { ok: false, message: t.unknown(ref) };
  const id = freshId(f, "evidence", name);
  f.touch("truth.json").evidence.push({ id, description: name, source: { kind: sourceKind, id: op.at }, links: [{ propositionId: op.supports, direction: "supports" }] });
  f.touch("evidence-presentation.json").entries.push({ evidenceId: id, text: op.text.trim(), mentions: [{ kind: sourceKind, id: op.at }], reports: [] });
  const path = sourceKind === "location" ? { kind: "search_location", locationId: op.at } : { kind: "examine_item", itemId: op.at };
  f.touch("evidence-access.json").entries.push({ evidenceId: id, access: { kind: "discoverable", paths: [path] } });
  f.touch("public-content.json").labels.push({ entity: { kind: "evidence", id }, label: name, role: null });
  return { ok: true, message: t.clueAdded(name, id, label(f, op.at)), id };
}

function addQuestion(f: Folder, op: Extract<StructureOp, { op: "add-question" }>, t: Msg): StructureResult {
  const slug = op.npc.slice("person:".length);
  if (!f.has(`interrogation-${slug}.json`) || !f.has(`npc-${slug}.json`)) return { ok: false, message: t.notInterrogable(label(f, op.npc)) };
  if (op.text.trim() === "") return { ok: false, message: t.questionTextMissing };
  const about = [...new Set([op.npc, ...op.about])].filter((id) => /^(person|location|item|event):/.test(id));
  const known = takenIds(f);
  const unknown = about.find((id) => !known.has(id));
  if (unknown !== undefined) return { ok: false, message: t.unknown(unknown) };
  const catalogue = f.touch("questions.json");
  let n = catalogue.questions.length + 1;
  const taken = new Set(catalogue.questions.map((q: Json) => q.id));
  while (taken.has(`question:q${String(n).padStart(2, "0")}`)) n++;
  const id = `question:q${String(n).padStart(2, "0")}`;
  catalogue.questions.push({ id, mentions: about.map((e) => ({ kind: kindOf(e), id: e })) });
  f.touch(`interrogation-${slug}.json`).rules.push({ questionId: id, act: "decline" });
  f.touch("public-content.json").questionTexts.push({ npc: op.npc, questionId: id, text: op.text.trim() });
  // The NPC must know what the question mentions to be asked about it.
  const snapshot = f.touch(`npc-${slug}.json`);
  for (const e of about) {
    if (!snapshot.awareness.some((a: Json) => a.subject?.id === e)) snapshot.awareness.push({ subject: { kind: kindOf(e), id: e }, acquiredAt: 0, provenance: { kind: "prior_knowledge" } });
  }
  return { ok: true, message: t.questionAdded(id, label(f, op.npc)), id };
}

function addStep(f: Folder, op: Extract<StructureOp, { op: "add-step" }>, t: Msg): StructureResult {
  const manifest = f.touch("release-manifest.json");
  const steps: Json[] = manifest.certificateData.steps;
  let event: Json;
  let stepId: string;
  const known = takenIds(f);
  if (!known.has(op.target) || (op.question !== undefined && !known.has(op.question))) return { ok: false, message: t.unknown(`${known.has(op.target) ? op.question : op.target}`) };
  if (op.action === "ask") {
    if (op.question === undefined || !/^question:/.test(op.question)) return { ok: false, message: t.questionMissing };
    event = { type: "interrogate", npc: refOf(op.target), questionId: op.question };
    stepId = `ask-${slugify(op.target.split(":")[1]!)}-${op.question.split(":")[1]}`;
  } else {
    const kind = op.action === "search_location" ? "location" : "item";
    if (kindOf(op.target) !== kind) return { ok: false, message: t.targetMismatch };
    event = { type: "investigate", action: op.action, target: refOf(op.target) };
    stepId = `${op.action === "search_location" ? "search" : "read"}-${slugify(op.target.split(":")[1]!)}`;
  }
  const base = stepId;
  // A step belongs to a route; it is appended to the manifest when a route first uses it.
  f.touch("case.json");
  const pending = (f.get("case.json").editorSteps ??= []);
  for (let n = 2; [...steps, ...pending].some((s) => s.stepId === stepId); n++) stepId = `${base}-${n}`;
  pending.push({ stepId, event });
  return { ok: true, message: t.stepAdded(stepId), id: stepId };
}

/** Steps a route may use: the manifest's plus the editor's pending ones from case.json. */
function availableSteps(f: Folder): Json[] {
  const pending = f.has("case.json") ? (f.get("case.json").editorSteps ?? []) : [];
  return [...f.get("release-manifest.json").certificateData.steps, ...pending];
}

/** Rewrites manifest steps as the routes' steps in order of first use; unused steps go back to pending. */
function syncSteps(f: Folder): void {
  const manifest = f.touch("release-manifest.json");
  const profile = f.get("proof-profile.json");
  const all = availableSteps(f);
  const used = [...new Set([...profile.witnessStepIds, ...(manifest.certificateData.routes ?? []).flatMap((r: Json) => r.stepIds)])];
  manifest.certificateData.steps = used.map((id) => all.find((s) => s.stepId === id)).filter((s) => s !== undefined);
  const rest = all.filter((s) => !used.includes(s.stepId));
  if (f.has("case.json")) {
    const config = f.touch("case.json");
    if (rest.length === 0) delete config.editorSteps;
    else config.editorSteps = rest;
  }
}

function addRoute(f: Folder, op: Extract<StructureOp, { op: "add-route" }>, t: Msg): StructureResult {
  const all = new Set(availableSteps(f).map((s) => s.stepId));
  const stepIds = op.stepIds.filter((s) => s !== "");
  if (stepIds.length === 0) return { ok: false, message: t.routeNeedsStep };
  const unknown = stepIds.filter((s) => !all.has(s));
  if (unknown.length > 0) return { ok: false, message: t.unknownSteps(unknown.join(", ")) };
  const manifest = f.touch("release-manifest.json");
  const routes: Json[] = (manifest.certificateData.routes ??= []);
  let n = routes.length + 2;
  while (routes.some((r) => r.routeId === `weg-${n}`)) n++;
  const routeId = `weg-${n}`;
  routes.push({ routeId, stepIds });
  syncSteps(f);
  return { ok: true, message: t.routeAdded(routeId, stepIds.length), id: routeId };
}

// ---------- Remove ----------

const REMOVE = Symbol("remove");

/** Drops `id` from string arrays and every array element that refers to it; REMOVE for the root itself. */
function prune(node: Json, ids: ReadonlySet<string>): Json | typeof REMOVE {
  if (Array.isArray(node)) {
    for (let i = node.length - 1; i >= 0; i--) {
      const el = node[i];
      if ((typeof el === "string" && ids.has(el)) || (typeof el === "object" && el !== null && prune(el, ids) === REMOVE)) node.splice(i, 1);
    }
    return node;
  }
  if (typeof node !== "object" || node === null) return node;
  let tainted = false;
  for (const value of Object.values(node)) {
    if (typeof value === "string" && ids.has(value)) tainted = true;
    else if (typeof value === "object" && value !== null && !Array.isArray(value) && prune(value, ids) === REMOVE) tainted = true;
    else if (Array.isArray(value)) prune(value, ids);
  }
  return tainted ? REMOVE : node;
}

function removeIds(f: Folder, ids: ReadonlySet<string>): string[] {
  const touched: string[] = [];
  for (const file of f.files()) {
    const before = JSON.stringify(f.get(file));
    if (prune(f.get(file), ids) === REMOVE) {
      f.remove(file);
      touched.push(`${file} gelöscht`);
    } else if (JSON.stringify(f.get(file)) !== before) {
      f.touch(file);
      touched.push(file);
    }
  }
  return touched;
}

function remove(f: Folder, id: string, t: Msg): StructureResult {
  if (!ENTITY_ID.test(id) || !takenIds(f).has(id)) return { ok: false, message: t.unknown(id) };
  const stepsBefore = availableSteps(f).map((s) => s.stepId);
  const touched = removeIds(f, new Set([id]));
  // Witness steps that pointed at the object are gone; drop them from every route as well.
  const stepsAfter = new Set(availableSteps(f).map((s) => s.stepId));
  const lostSteps = stepsBefore.filter((s) => !stepsAfter.has(s));
  if (lostSteps.length > 0) removeIds(f, new Set(lostSteps));
  syncSteps(f);
  return { ok: true, message: t.removed(id, touched.length, lostSteps.join(", ")) };
}

function removeRoute(f: Folder, routeId: string, t: Msg): StructureResult {
  const manifest = f.touch("release-manifest.json");
  const routes: Json[] = manifest.certificateData.routes ?? [];
  if (!routes.some((r) => r.routeId === routeId)) return { ok: false, message: routeId === "witness" ? t.mainRouteFixed : t.unknownRoute(routeId) };
  manifest.certificateData.routes = routes.filter((r) => r.routeId !== routeId);
  if (manifest.certificateData.routes.length === 0) delete manifest.certificateData.routes;
  syncSteps(f);
  return { ok: true, message: t.routeRemoved(routeId) };
}

function removeStep(f: Folder, stepId: string, t: Msg): StructureResult {
  if (!availableSteps(f).some((s) => s.stepId === stepId)) return { ok: false, message: t.unknownStep(stepId) };
  removeIds(f, new Set([stepId]));
  if (f.has("case.json")) {
    const config = f.touch("case.json");
    config.editorSteps = (config.editorSteps ?? []).filter((s: Json) => s.stepId !== stepId);
    if (config.editorSteps.length === 0) delete config.editorSteps;
  }
  syncSteps(f);
  return { ok: true, message: t.stepRemoved(stepId) };
}

// ---------- Apply, with one undo level per operation ----------

/** Applies one structural operation to the folder; a snapshot goes to `history` first (undo). */
export function applyStructure(dir: string, op: StructureOp, history: string, lang: Lang = DEFAULT_LANG): StructureResult {
  const t = EDITOR_MESSAGES[lang].struct;
  const f = new Folder(dir);
  for (const file of ["truth.json", "public-content.json", "initial-setup.json"]) if (!f.has(file)) return { ok: false, message: t.fileMissing(file) };
  if (!f.has("case.json")) f.set("case.json", {});
  let result: StructureResult;
  try {
    result =
      op.op === "add-entity" ? addEntity(f, op, t)
      : op.op === "add-clue" ? addClue(f, op, t)
      : op.op === "add-question" ? addQuestion(f, op, t)
      : op.op === "add-step" ? addStep(f, op, t)
      : op.op === "add-route" ? addRoute(f, op, t)
      : op.op === "remove" ? remove(f, op.id, t)
      : op.op === "remove-route" ? removeRoute(f, op.routeId, t)
      : removeStep(f, op.stepId, t);
  } catch (error) {
    return { ok: false, message: t.impossible((error as Error).message) };
  }
  if (!result.ok) return result;
  rmSync(history, { recursive: true, force: true });
  mkdirSync(history, { recursive: true });
  cpSync(dir, history, { recursive: true });
  f.commit();
  return result;
}

/** Restores the snapshot taken before the last structural operation. */
export function undoStructure(dir: string, history: string): boolean {
  if (!existsSync(join(history, "truth.json"))) return false;
  rmSync(dir, { recursive: true, force: true });
  cpSync(history, dir, { recursive: true });
  rmSync(history, { recursive: true, force: true });
  return true;
}

export const isStructureId = (id: string): boolean => ENTITY_ID.test(id) || SLUG.test(id);
