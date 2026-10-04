import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { caseLocales, checkCaseFolder, writeFilledHashes, type CaseCheck } from "../authoring/check-case.ts";
import { generateCase, writeGeneratedCase } from "../authoring/case-generator.ts";
import type { ResolvedCasePackage } from "../domain/case-package.ts";
import { PLAY_CASES, loadFolderPackage } from "./cases.ts";
import { playtestCase, type CaseReport } from "./playtest.ts";
import { applyStructure, undoStructure, type StructureOp, type StructureResult } from "./editor-structure.ts";
import { EDITOR_MESSAGES } from "./editor-messages.ts";
import { DEFAULT_LANG, type Lang } from "./messages.ts";

// Case editor behind `/editor` of play:web. A case is edited in a local working folder (a copy of a
// fixture, a generated folder, or a fresh generated case); the sources are only ever read. Every
// change runs check-case on a scratch copy first, so the author sees errors at file and field before
// anything is written. Hash fields are recomputed automatically (check-case --fix).

export type CaseSource = { readonly key: string; readonly label: string; readonly dir: string };
export type Edit =
  | { readonly kind: "field"; readonly file: string; readonly field: string; readonly value: string }
  | { readonly kind: "act"; readonly file: string; readonly rule: number; readonly act: string; readonly stance: string | null }
  | { readonly kind: "raw"; readonly file: string; readonly text: string }
  /** Digest of the file as the page showed it; a save is refused for a file changed since. */
  | { readonly kind: "base"; readonly file: string; readonly digest: string };
export type ApplyResult = { readonly applied: number; readonly errors: readonly { file: string; field: string; message: string }[] };

const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
// A case file, or one of its locale variant (en/public-content.json …).
const FILE = /^(?:[a-z]{2}\/)?[a-z0-9-]{1,64}\.json$/;
const ACTS = new Set(["answer", "lie", "decline"]);
const ROOT = new URL("../../", import.meta.url).pathname;

export const isCaseName = (name: string): boolean => NAME.test(name);

/** Read-only sources: the repo's case fixtures and the generator's default output folder. */
export function caseSources(root = ROOT, lang: Lang = DEFAULT_LANG): CaseSource[] {
  const t = EDITOR_MESSAGES[lang].home;
  const list = (base: string, prefix: string, label: string) =>
    existsSync(join(root, base))
      ? readdirSync(join(root, base))
          .filter((d) => NAME.test(d) && existsSync(join(root, base, d, "truth.json")))
          .sort()
          .map((d) => ({ key: `${prefix}/${d}`, label: `${label}: ${titleOf(join(root, base, d)) ?? d}`, dir: join(root, base, d) }))
      : [];
  return [...list("tests/fixtures", "fixtures", t.sourceFixture), ...list("generated", "generated", t.sourceGenerated)];
}

function titleOf(dir: string): string | null {
  try {
    const title = (JSON.parse(readFileSync(join(dir, "public-content.json"), "utf8")) as { title?: unknown }).title;
    return typeof title === "string" ? title : null;
  } catch {
    return null;
  }
}

/** Display convention of a case folder: timeline second 0 as wall-clock seconds. */
export function clockOriginOf(dir: string): number {
  const name = dir.replace(/\/+$/, "").split("/").at(-1);
  const play = Object.values(PLAY_CASES).find((c) => c.dir === name);
  if (play !== undefined) return play.clockOrigin;
  try {
    const value = (JSON.parse(readFileSync(join(dir, "case.json"), "utf8")) as { clockOrigin?: unknown }).clockOrigin;
    return typeof value === "number" ? value : 0;
  } catch {
    return 0;
  }
}

// ---------- Field paths in check-case notation: a.b[3].c ----------

function parsePath(field: string): (string | number)[] | null {
  const keys: (string | number)[] = [];
  for (const part of field.split(".")) {
    const m = /^([A-Za-z][A-Za-z0-9]*)((\[\d{1,4}\])*)$/.exec(part);
    if (m === null) return null;
    keys.push(m[1]!, ...[...m[2]!.matchAll(/\[(\d+)\]/g)].map((x) => Number(x[1])));
  }
  return keys;
}

export function getAt(json: unknown, field: string): unknown {
  const keys = parsePath(field);
  return keys === null ? undefined : keys.reduce<unknown>((o, k) => (typeof o === "object" && o !== null ? (o as Record<string | number, unknown>)[k] : undefined), json);
}

/** Optional texts: an empty value removes them, a value on a missing one creates it. */
const OPTIONAL_TEXT = /^(epilogue|questionTexts\[\d{1,4}\]\.(answer|admission))$/;

/** Sets a string value; an empty value removes an optional text (epilogue, answer, admission). */
function setAt(json: unknown, field: string, value: string): boolean {
  const keys = parsePath(field);
  if (keys === null) return false;
  const holder = keys.slice(0, -1).reduce<unknown>((o, k) => (typeof o === "object" && o !== null ? (o as Record<string | number, unknown>)[k] : undefined), json);
  const last = keys.at(-1)!;
  const optional = OPTIONAL_TEXT.test(field) && typeof holder === "object" && holder !== null && !Array.isArray(holder);
  if (typeof holder !== "object" || holder === null || typeof (holder as Record<string | number, unknown>)[last] !== "string") {
    if (optional && value.trim() !== "") return void ((holder as Record<string, unknown>)[last as string] = value), true;
    return false;
  }
  if (optional && value.trim() === "") delete (holder as Record<string, unknown>)[last as string];
  else (holder as Record<string | number, unknown>)[last] = value;
  return true;
}

// ---------- Applying edits ----------

/** Digest of a file's text, rendered into the page so a save can tell that the file changed since. */
export const fileDigest = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);

/** Edits from the editor form: f:<file>:<field>, act:<file>:<rule>, stance:<file>:<rule>, raw:<file>, base:<file>. */
export function editsFromForm(form: URLSearchParams): Edit[] {
  const edits: Edit[] = [];
  for (const [key, value] of form) {
    const m = /^(f|raw|act|base):([^:]+)(?::(.*))?$/s.exec(key);
    if (m === null || !FILE.test(m[2]!)) continue;
    const [, kind, file, rest] = m as unknown as [string, string, string, string | undefined];
    if (kind === "f" && rest !== undefined) edits.push({ kind: "field", file, field: rest, value: value.replace(/\r\n/g, "\n") });
    if (kind === "raw") edits.push({ kind: "raw", file, text: value });
    if (kind === "base" && rest === undefined) edits.push({ kind: "base", file, digest: value });
    if (kind === "act" && rest !== undefined && /^\d{1,4}$/.test(rest)) {
      edits.push({ kind: "act", file, rule: Number(rest), act: value, stance: form.get(`stance:${file}:${rest}`) });
    }
  }
  // Base digests first, then whole-file replacements, then fields (skipped for a replaced file).
  const order = (e: Edit) => (e.kind === "base" ? 0 : e.kind === "raw" ? 1 : 2);
  return [...edits].sort((a, b) => order(a) - order(b));
}

/** Applies edits to the JSON files of dir (in place). Only values that differ are written. */
export function applyEdits(dir: string, edits: readonly Edit[], lang: Lang = DEFAULT_LANG): ApplyResult {
  const t = EDITOR_MESSAGES[lang].apply;
  const errors: { file: string; field: string; message: string }[] = [];
  const files = new Map<string, unknown>();
  const changed = new Set<string>();
  const json = (file: string): unknown => {
    if (!files.has(file)) files.set(file, existsSync(join(dir, file)) ? JSON.parse(readFileSync(join(dir, file), "utf8")) : undefined);
    return files.get(file);
  };
  let applied = 0;
  // Files changed on disk since the page was rendered (another tab): their edits would undo that change.
  const stale = new Set<string>();
  // Files replaced by a whole-file edit: the page still sends their old field values, which must not win.
  const replaced = new Set<string>();
  for (const edit of edits) {
    if (!existsSync(join(dir, edit.file))) {
      errors.push({ file: edit.file, field: "(Datei)", message: t.fileMissing });
      continue;
    }
    if (stale.has(edit.file)) continue;
    if (edit.kind === "base") {
      if (fileDigest(readFileSync(join(dir, edit.file), "utf8")) !== edit.digest) {
        stale.add(edit.file);
        errors.push({ file: edit.file, field: "(Datei)", message: t.stale });
      }
      continue;
    }
    if (edit.kind !== "raw" && replaced.has(edit.file)) continue;
    if (edit.kind === "raw") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(edit.text);
      } catch (error) {
        errors.push({ file: edit.file, field: "(JSON)", message: t.badJson((error as Error).message) });
        continue;
      }
      if (JSON.stringify(parsed) === JSON.stringify(json(edit.file))) continue;
      files.set(edit.file, parsed);
      replaced.add(edit.file);
    } else if (edit.kind === "field") {
      const before = getAt(json(edit.file), edit.field);
      if (before === edit.value || (before === undefined && OPTIONAL_TEXT.test(edit.field) && edit.value.trim() === "")) continue;
      if (!setAt(json(edit.file), edit.field, edit.value)) {
        errors.push({ file: edit.file, field: edit.field, message: t.fieldNotEditable });
        continue;
      }
    } else {
      const rule = getAt(json(edit.file), `rules[${edit.rule}]`) as Record<string, unknown> | undefined;
      if (typeof rule !== "object" || rule === null || !ACTS.has(edit.act)) {
        errors.push({ file: edit.file, field: `rules[${edit.rule}]`, message: t.ruleNotEditable });
        continue;
      }
      const stance = edit.act === "lie" ? (edit.stance === "affirms" ? "affirms" : "denies") : undefined;
      if (rule.act === edit.act && rule.stance === stance) continue;
      rule.act = edit.act;
      if (edit.act === "decline") for (const k of ["claim", "reveal", "stance"]) delete rule[k];
      else {
        rule.reveal ??= [];
        if (stance === undefined) delete rule.stance;
        else rule.stance = stance;
      }
      // A decline has no claim; turning it into an answer leaves the claim to the author (check-case names it).
    }
    changed.add(edit.file);
    applied++;
  }
  for (const file of changed) writeFileSync(join(dir, file), `${JSON.stringify(files.get(file), null, 2)}\n`);
  return { applied, errors };
}

/** check-case with automatic hash maintenance: placeholders and stale hashes are rewritten, then rechecked. */
export function checkAndFix(dir: string, translated = false): CaseCheck {
  // Hashes chain (truth -> solution and catalogue -> profiles -> release): one pass per link.
  let check = checkCaseFolder(dir);
  for (let pass = 0; pass < 6 && check.filled.length > 0; pass++) {
    writeFilledHashes(check);
    check = checkCaseFolder(dir);
  }
  // Locale variants (en/): their problems join the base's. A German text edit leaves the
  // translation marked stale until the translation itself is edited (`translated`).
  for (const lang of caseLocales(dir)) {
    let variant = checkCaseFolder(dir, lang);
    const fills = () => ({ ...variant, filled: variant.filled.filter((f) => translated || f.stale !== true || !f.file.endsWith("/source.json")) });
    for (let pass = 0; pass < 3 && fills().filled.length > 0; pass++) {
      writeFilledHashes(fills());
      variant = checkCaseFolder(dir, lang);
    }
    check = { ...check, problems: [...check.problems, ...variant.problems], ok: check.ok && variant.ok };
  }
  return check;
}

/**
 * After a structural edit: each locale variant takes the base's new structure and keeps its
 * translations by id (labels by entity, questions by NPC and question, rules, voices, evidence).
 * New entries start with the German text until they are translated.
 */
export function syncLocales(dir: string): void {
  const readJson = (file: string): any => (existsSync(join(dir, file)) ? JSON.parse(readFileSync(join(dir, file), "utf8")) : null);
  const keyed = (list: unknown, key: (x: any) => string): Map<string, any> => new Map(Array.isArray(list) ? list.map((x) => [key(x), x]) : []);
  const carry = (base: any, old: any, fields: readonly string[]) => {
    if (old === undefined) return base;
    const out = { ...base };
    for (const f of fields) if (typeof base[f] === "string" && typeof old[f] === "string") out[f] = old[f];
    if (base.lines !== undefined && old.lines !== undefined) out.lines = Object.fromEntries(Object.keys(base.lines).map((k) => [k, old.lines[k] ?? base.lines[k]]));
    return out;
  };
  for (const lang of caseLocales(dir)) {
    const pc = readJson("public-content.json");
    const oldPc = readJson(`${lang}/public-content.json`);
    if (pc !== null && oldPc !== null) {
      const labels = keyed(oldPc.labels, (l) => `${l.entity?.kind}|${l.entity?.id}`);
      const questions = keyed(oldPc.questionTexts, (q) => `${q.npc}|${q.questionId}`);
      const rules = keyed(oldPc.publicRules, (r) => r.id);
      const voices = keyed(oldPc.voices, (v) => v.npc);
      const next = carry(pc, oldPc, ["title", "brief", "challengeQuestion", "epilogue"]);
      next.labels = (pc.labels ?? []).map((l: any) => carry(l, labels.get(`${l.entity?.kind}|${l.entity?.id}`), ["label", "role"]));
      next.questionTexts = (pc.questionTexts ?? []).map((q: any) => carry(q, questions.get(`${q.npc}|${q.questionId}`), ["text", "answer", "admission"]));
      next.publicRules = (pc.publicRules ?? []).map((r: any) => carry(r, rules.get(r.id), ["text"]));
      if (pc.voices !== undefined) next.voices = pc.voices.map((v: any) => carry(v, voices.get(v.npc), []));
      writeFileSync(join(dir, lang, "public-content.json"), `${JSON.stringify(next, null, 2)}\n`);
    }
    const ep = readJson("evidence-presentation.json");
    const oldEp = readJson(`${lang}/evidence-presentation.json`);
    if (ep !== null && oldEp !== null) {
      const entries = keyed(oldEp.entries, (e) => e.evidenceId);
      writeFileSync(join(dir, lang, "evidence-presentation.json"), `${JSON.stringify({ ...ep, entries: (ep.entries ?? []).map((e: any) => carry(e, entries.get(e.evidenceId), ["text"])) }, null, 2)}\n`);
    }
  }
}

/**
 * An optional base text (answer, admission, epilogue) emptied in the German case cannot stay in a
 * translation: it is removed there too. Changed texts stay in the translation (check-case flags them).
 */
function dropRemovedTranslations(dir: string, edits: readonly Edit[]): void {
  const removed = edits.filter((e): e is Extract<Edit, { kind: "field" }> => e.kind === "field" && e.file === "public-content.json" && OPTIONAL_TEXT.test(e.field) && e.value.trim() === "");
  if (removed.length === 0) return;
  for (const lang of caseLocales(dir)) {
    const file = join(dir, lang, "public-content.json");
    if (!existsSync(file)) continue;
    const pc = JSON.parse(readFileSync(file, "utf8"));
    let changed = false;
    for (const e of removed) if (typeof getAt(pc, e.field) === "string") changed = setAt(pc, e.field, "") || changed;
    if (changed) writeFileSync(file, `${JSON.stringify(pc, null, 2)}\n`);
  }
}

/** Whether edits touch a locale variant (a translation was edited). */
const translates = (edits: readonly Edit[]) => edits.some((e) => /^[a-z]{2}\//.test(e.file));

// ---------- Working folder ----------

export class CaseWorkspace {
  readonly root: string;
  constructor(root: string) {
    this.root = resolve(root);
  }
  dirOf(name: string): string | null {
    return isCaseName(name) && existsSync(join(this.root, name, "truth.json")) ? join(this.root, name) : null;
  }
  /** The case title from its public content, or the folder name. */
  title(name: string): string {
    return titleOf(join(this.root, name)) ?? name;
  }
  list(): string[] {
    if (!existsSync(this.root)) return [];
    return readdirSync(this.root).filter((d) => isCaseName(d) && statSync(join(this.root, d)).isDirectory() && existsSync(join(this.root, d, "truth.json"))).sort();
  }
  /** Copies a source into the working folder; an existing copy is kept unless reset. */
  open(source: CaseSource, reset = false): string {
    const name = source.key.split("/").at(-1)!;
    const target = join(this.root, name);
    if (reset) rmSync(target, { recursive: true, force: true });
    if (!existsSync(target)) {
      mkdirSync(this.root, { recursive: true });
      // Dereferenced: a symlink in the source must not let a save write outside the working folder.
      cpSync(source.dir, target, { recursive: true, dereference: true });
    }
    return name;
  }
  /** A freshly generated case, written straight into the working folder. */
  generate(seed: number): string {
    const name = `fall-${seed}`;
    // An existing working copy of this seed is opened, not overwritten (it may hold edits).
    if (this.dirOf(name) !== null) return name;
    writeGeneratedCase(generateCase(seed), join(this.root, name));
    return name;
  }
  /** Live check: the edits on a scratch copy; the working folder is untouched. */
  preview<T = undefined>(name: string, edits: readonly Edit[], inspect?: (dir: string, check: CaseCheck) => T, lang: Lang = DEFAULT_LANG): { check: CaseCheck; apply: ApplyResult; inspected?: T } | null {
    const dir = this.dirOf(name);
    if (dir === null) return null;
    const scratch = mkdtempSync(join(tmpdir(), "case-editor-"));
    try {
      const copy = join(scratch, name);
      cpSync(dir, copy, { recursive: true });
      const apply = applyEdits(copy, edits, lang);
      dropRemovedTranslations(copy, edits);
      const check = checkAndFix(copy, translates(edits));
      return { check: { ...check, dir }, apply, ...(inspect === undefined ? {} : { inspected: inspect(copy, check) }) };
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }
  private history(name: string): string {
    return join(this.root, ".history", name);
  }
  /** A structural edit on the saved working copy (one undo level), then hash maintenance. */
  structure(name: string, op: StructureOp, lang: Lang = DEFAULT_LANG): StructureResult | null {
    const dir = this.dirOf(name);
    if (dir === null) return null;
    const result = applyStructure(dir, op, this.history(name), lang);
    if (result.ok) {
      syncLocales(dir);
      checkAndFix(dir);
    }
    return result;
  }
  undo(name: string): boolean {
    const dir = this.dirOf(name);
    if (dir === null || !undoStructure(dir, this.history(name))) return false;
    syncLocales(dir);
    return true;
  }
  canUndo(name: string): boolean {
    return existsSync(join(this.history(name), "truth.json"));
  }
  /** The saved working copy as a playable package, cached by content; null while it is invalid. */
  probe(name: string): Probe | null {
    const dir = this.dirOf(name);
    if (dir === null) return null;
    const version = folderDigest(dir);
    const cached = probes.get(dir);
    if (cached?.version === version) return cached.value;
    const pkg = folderPackage(dir, checkCaseFolder(dir));
    const value = pkg === null ? null : { pkg, clockOrigin: clockOriginOf(dir), version };
    probes.set(dir, { version, value });
    return value;
  }
  save(name: string, edits: readonly Edit[], lang: Lang = DEFAULT_LANG): { check: CaseCheck; apply: ApplyResult } | null {
    const dir = this.dirOf(name);
    if (dir === null) return null;
    const apply = applyEdits(dir, edits, lang);
    dropRemovedTranslations(dir, edits);
    return { check: checkAndFix(dir, translates(edits)), apply };
  }
}

// ---------- Playtest and trial play of a working copy ----------

const probes = new Map<string, { version: string; value: Probe | null }>();
export type Probe = { readonly pkg: ResolvedCasePackage; readonly clockOrigin: number; readonly version: string };

export function folderDigest(dir: string): string {
  const h = createHash("sha256");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) h.update(`${f}\0${readFileSync(join(dir, f), "utf8")}\0`);
  return h.digest("hex");
}

/** The playable package of a valid folder (the playtest and trial play run on it), else null. */
export function folderPackage(dir: string, check: CaseCheck): ResolvedCasePackage | null {
  if (!check.ok || check.play === undefined) return null;
  try {
    return loadFolderPackage(dir, check.play.npcs, check.play.salt);
  } catch {
    return null;
  }
}

export const EDITOR_PLAYTEST_SEEDS = 4;

/** The playtest bot on a folder: difficulty and balance warnings, or why it cannot run. */
export function playtestFolder(dir: string, check: CaseCheck, lang: Lang = DEFAULT_LANG): { report: CaseReport | null; reason: string } {
  const t = EDITOR_MESSAGES[lang].playtest;
  const pkg = folderPackage(dir, check);
  if (pkg === null) return { report: null, reason: check.ok ? t.notLoadable : t.notYet };
  try {
    return { report: playtestCase(pkg, EDITOR_PLAYTEST_SEEDS), reason: "" };
  } catch (error) {
    return { report: null, reason: t.failed((error as Error).message) };
  }
}

export const defaultWorkspaceDir = (): string => process.env.FORGE_CASE_WORKSPACE ?? join(ROOT, ".case-workspace");
