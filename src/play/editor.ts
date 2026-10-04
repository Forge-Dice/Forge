import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { checkCaseFolder, writeFilledHashes, type CaseCheck } from "../authoring/check-case.ts";
import { generateCase, writeGeneratedCase } from "../authoring/case-generator.ts";
import { PLAY_CASES } from "./cases.ts";

// Case editor behind `/editor` of play:web. A case is edited in a local working folder (a copy of a
// fixture, a generated folder, or a fresh generated case); the sources are only ever read. Every
// change runs check-case on a scratch copy first, so the author sees errors at file and field before
// anything is written. Hash fields are recomputed automatically (check-case --fix).

export type CaseSource = { readonly key: string; readonly label: string; readonly dir: string };
export type Edit =
  | { readonly kind: "field"; readonly file: string; readonly field: string; readonly value: string }
  | { readonly kind: "act"; readonly file: string; readonly rule: number; readonly act: string; readonly stance: string | null }
  | { readonly kind: "raw"; readonly file: string; readonly text: string };
export type ApplyResult = { readonly applied: number; readonly errors: readonly { file: string; field: string; message: string }[] };

const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const FILE = /^[a-z0-9-]{1,64}\.json$/;
const ACTS = new Set(["answer", "lie", "decline"]);
const ROOT = new URL("../../", import.meta.url).pathname;

export const isCaseName = (name: string): boolean => NAME.test(name);

/** Read-only sources: the repo's case fixtures and the generator's default output folder. */
export function caseSources(root = ROOT): CaseSource[] {
  const list = (base: string, prefix: string, label: string) =>
    existsSync(join(root, base))
      ? readdirSync(join(root, base))
          .filter((d) => NAME.test(d) && existsSync(join(root, base, d, "truth.json")))
          .sort()
          .map((d) => ({ key: `${prefix}/${d}`, label: `${label}: ${titleOf(join(root, base, d)) ?? d}`, dir: join(root, base, d) }))
      : [];
  return [...list("tests/fixtures", "fixtures", "Fall"), ...list("generated", "generated", "Generiert")];
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

/** Sets a string value; an empty value removes an optional top-level text (the epilogue). */
function setAt(json: unknown, field: string, value: string): boolean {
  const keys = parsePath(field);
  if (keys === null) return false;
  const holder = keys.slice(0, -1).reduce<unknown>((o, k) => (typeof o === "object" && o !== null ? (o as Record<string | number, unknown>)[k] : undefined), json);
  const last = keys.at(-1)!;
  if (typeof holder !== "object" || holder === null || typeof (holder as Record<string | number, unknown>)[last] !== "string") {
    if (field === "epilogue" && typeof holder === "object" && holder !== null && value.trim() !== "") return void ((holder as Record<string, unknown>).epilogue = value), true;
    return false;
  }
  if (field === "epilogue" && value.trim() === "") delete (holder as Record<string, unknown>).epilogue;
  else (holder as Record<string | number, unknown>)[last] = value;
  return true;
}

// ---------- Applying edits ----------

/** Edits from the editor form: f:<file>:<field>, act:<file>:<rule>, stance:<file>:<rule>, raw:<file>. */
export function editsFromForm(form: URLSearchParams): Edit[] {
  const edits: Edit[] = [];
  for (const [key, value] of form) {
    const m = /^(f|raw|act):([^:]+)(?::(.*))?$/s.exec(key);
    if (m === null || !FILE.test(m[2]!)) continue;
    const [, kind, file, rest] = m as unknown as [string, string, string, string | undefined];
    if (kind === "f" && rest !== undefined) edits.push({ kind: "field", file, field: rest, value: value.replace(/\r\n/g, "\n") });
    if (kind === "raw") edits.push({ kind: "raw", file, text: value });
    if (kind === "act" && rest !== undefined && /^\d{1,4}$/.test(rest)) {
      edits.push({ kind: "act", file, rule: Number(rest), act: value, stance: form.get(`stance:${file}:${rest}`) });
    }
  }
  // Whole-file replacements first; field edits that equal the file's value are then no-ops.
  return [...edits.filter((e) => e.kind === "raw"), ...edits.filter((e) => e.kind !== "raw")];
}

/** Applies edits to the JSON files of dir (in place). Only values that differ are written. */
export function applyEdits(dir: string, edits: readonly Edit[]): ApplyResult {
  const errors: { file: string; field: string; message: string }[] = [];
  const files = new Map<string, unknown>();
  const changed = new Set<string>();
  const json = (file: string): unknown => {
    if (!files.has(file)) files.set(file, existsSync(join(dir, file)) ? JSON.parse(readFileSync(join(dir, file), "utf8")) : undefined);
    return files.get(file);
  };
  let applied = 0;
  for (const edit of edits) {
    if (!existsSync(join(dir, edit.file))) {
      errors.push({ file: edit.file, field: "(Datei)", message: "Datei fehlt im Arbeitsordner" });
      continue;
    }
    if (edit.kind === "raw") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(edit.text);
      } catch (error) {
        errors.push({ file: edit.file, field: "(JSON)", message: `kein gültiges JSON: ${(error as Error).message}` });
        continue;
      }
      if (JSON.stringify(parsed) === JSON.stringify(json(edit.file))) continue;
      files.set(edit.file, parsed);
    } else if (edit.kind === "field") {
      const before = getAt(json(edit.file), edit.field);
      if (before === edit.value || (before === undefined && edit.field === "epilogue" && edit.value.trim() === "")) continue;
      if (!setAt(json(edit.file), edit.field, edit.value)) {
        errors.push({ file: edit.file, field: edit.field, message: "Feld nicht bearbeitbar" });
        continue;
      }
    } else {
      const rule = getAt(json(edit.file), `rules[${edit.rule}]`) as Record<string, unknown> | undefined;
      if (typeof rule !== "object" || rule === null || !ACTS.has(edit.act)) {
        errors.push({ file: edit.file, field: `rules[${edit.rule}]`, message: "Regel nicht bearbeitbar" });
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
export function checkAndFix(dir: string): CaseCheck {
  const first = checkCaseFolder(dir);
  if (first.filled.length === 0) return first;
  writeFilledHashes(first);
  return checkCaseFolder(dir);
}

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
      cpSync(source.dir, target, { recursive: true });
    }
    return name;
  }
  /** A freshly generated case, written straight into the working folder. */
  generate(seed: number): string {
    const name = `fall-${seed}`;
    writeGeneratedCase(generateCase(seed), join(this.root, name));
    return name;
  }
  /** Live check: the edits on a scratch copy; the working folder is untouched. */
  preview(name: string, edits: readonly Edit[]): { check: CaseCheck; apply: ApplyResult } | null {
    const dir = this.dirOf(name);
    if (dir === null) return null;
    const scratch = mkdtempSync(join(tmpdir(), "case-editor-"));
    try {
      const copy = join(scratch, name);
      cpSync(dir, copy, { recursive: true });
      const apply = applyEdits(copy, edits);
      return { check: { ...checkAndFix(copy), dir }, apply };
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }
  save(name: string, edits: readonly Edit[]): { check: CaseCheck; apply: ApplyResult } | null {
    const dir = this.dirOf(name);
    if (dir === null) return null;
    const apply = applyEdits(dir, edits);
    return { check: checkAndFix(dir), apply };
  }
}

export const defaultWorkspaceDir = (): string => process.env.FORGE_CASE_WORKSPACE ?? join(ROOT, ".case-workspace");
