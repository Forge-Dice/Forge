import { createHash } from "node:crypto";
import { z } from "zod";
import { checkCaseFiles, mapFiles, type Problem } from "../authoring/check-case.ts";
import type { ResolvedCasePackage } from "../domain/case-package.ts";
import { loadFilesPackage } from "./cases.ts";

// Sharing a case as one file: the editor exports every JSON file of a working copy with a SHA-256
// per file and one over all of them; the game ("Eigenen Fall laden", server and single-file build)
// accepts it only if those hashes match and the files pass check-case in full (real parsers,
// binding hashes, solvability of every route) and then load as a play package. The solution is
// in the file like in any case folder; the hashes are for integrity, not secrecy.

export const SHARE_FORMAT = "kriminalfall";
export const SHARE_VERSION = 1;
export const MAX_SHARE_BYTES = 1024 * 1024;
const MAX_FILES = 64;
const FILE_NAME = /^[a-z0-9][a-z0-9-]{0,63}\.json$/;
/** Deepest nesting a part may have; the cases have at most 10, the checkers recurse over it. */
export const MAX_DEPTH = 32;
const CASE_PARTS = new Set([
  "case.json", "truth.json", "solution.json", "evidence-access.json", "evidence-presentation.json", "questions.json",
  "initial-setup.json", "challenge.json", "public-content.json", "proof-profile.json", "release-manifest.json",
]);
const NPC_PART = /^(npc|interrogation)-[a-z0-9][a-z0-9-]{0,47}\.json$/;

/** Nesting depth of a JSON text, counted without parsing (strings skipped); stops past `limit`. */
function depthOf(text: string, limit: number): number {
  let depth = 0;
  let max = 0;
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    if (inString) {
      if (ch === 92) i++; // backslash: skip the escaped character
      else if (ch === 34) inString = false;
    } else if (ch === 34) inString = true;
    else if (ch === 91 || ch === 123) {
      if (++depth > max && (max = depth) > limit) return max;
    } else if (ch === 93 || ch === 125) depth--;
  }
  return max;
}
const HEX = /^[0-9a-f]{64}$/;

const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const overall = (hashes: Readonly<Record<string, string>>) => sha(Object.keys(hashes).sort().map((f) => `${f}\0${hashes[f]}\0`).join(""));

const ShareFile = z.strictObject({
  format: z.literal(SHARE_FORMAT),
  version: z.literal(SHARE_VERSION),
  title: z.string().max(200),
  files: z.record(z.string().regex(FILE_NAME), z.string()),
  sha256: z.record(z.string().regex(FILE_NAME), z.string().regex(HEX)),
  digest: z.string().regex(HEX),
});

/** The share file of a case's files (file name -> text). */
export function exportCaseFiles(files: Readonly<Record<string, string>>): string {
  const names = Object.keys(files).filter((f) => FILE_NAME.test(f)).sort();
  const sorted = Object.fromEntries(names.map((f) => [f, files[f]!]));
  const hashes = Object.fromEntries(names.map((f) => [f, sha(files[f]!)]));
  let title = "";
  try {
    title = String((JSON.parse(files["public-content.json"] ?? "{}") as { title?: unknown }).title ?? "");
  } catch {}
  return `${JSON.stringify({ format: SHARE_FORMAT, version: SHARE_VERSION, title, files: sorted, sha256: hashes, digest: overall(hashes) }, null, 1)}\n`;
}

export type ImportedCase = {
  readonly ok: true;
  readonly slug: string;
  readonly title: string;
  readonly pkg: ResolvedCasePackage;
  readonly clockOrigin: number;
  readonly digest: string;
};
export type ImportResult = ImportedCase | { readonly ok: false; readonly title: string; readonly problems: readonly string[] };

const fail = (title: string, problems: readonly string[]): ImportResult => ({ ok: false, title, problems });
const problemText = (p: Problem) => `${p.file} › ${p.field}: ${p.message}`;

/** Checks a share file completely; only a valid, solvable case comes back playable. */
export function importCaseText(text: string): ImportResult {
  // Length first: a string longer than the limit in UTF-16 units is too long in bytes too.
  if (text.length > MAX_SHARE_BYTES || new TextEncoder().encode(text).length > MAX_SHARE_BYTES) return fail("Die Datei ist zu groß.", [`Höchstens ${MAX_SHARE_BYTES / 1024} KB.`]);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return fail("Das ist keine Fall-Datei.", ["Die Datei ist kein JSON."]);
  }
  const parsed = ShareFile.safeParse(json);
  if (!parsed.success) {
    return fail("Das ist keine Fall-Datei.", parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(Datei)"}: ${i.message}`));
  }
  const share = parsed.data;
  const names = Object.keys(share.files).sort();
  if (names.length > MAX_FILES) return fail("Die Fall-Datei ist beschädigt.", [`Mehr als ${MAX_FILES} Teile.`]);
  if (names.join("\0") !== Object.keys(share.sha256).sort().join("\0")) return fail("Die Fall-Datei ist beschädigt.", ["Teile und Prüfsummen passen nicht zusammen."]);
  const changed = names.filter((f) => sha(share.files[f]!) !== share.sha256[f]);
  if (changed.length > 0) return fail("Die Fall-Datei wurde verändert.", changed.map((f) => `${f}: Prüfsumme stimmt nicht`));
  if (overall(share.sha256) !== share.digest) return fail("Die Fall-Datei wurde verändert.", ["Gesamtprüfsumme stimmt nicht."]);
  // Only the parts a case has: no free payload, and no cheap parts to grind the digest with.
  const foreign = names.filter((f) => !CASE_PARTS.has(f) && !NPC_PART.test(f));
  if (foreign.length > 0) return fail("Der Fall ist nicht gültig.", foreign.slice(0, 8).map((f) => `${f}: kein Teil eines Falls`));
  // The checkers walk parsed parts recursively; bound the depth before anything parses them.
  const deep = names.filter((f) => depthOf(share.files[f]!, MAX_DEPTH) > MAX_DEPTH);
  if (deep.length > 0) return fail("Der Fall ist nicht gültig.", deep.map((f) => `${f} › (Datei): zu tief verschachtelt`));
  try {
    return checkedImport(share);
  } catch (error) {
    // Whatever slips past the checkers' own reporting is still a refusal, never a crash.
    return fail("Der Fall ließ sich nicht prüfen.", [error instanceof Error ? error.message.slice(0, 300) : "unbekannter Fehler"]);
  }
}

function checkedImport(share: z.infer<typeof ShareFile>): ImportResult {

  const check = checkCaseFiles(mapFiles(share.files), share.title || "Fall-Datei");
  const errors = check.problems.filter((p) => p.severity === "error");
  // Placeholders are computed like check-case does; a binding hash that disagrees means a part was
  // changed after the case was bound, which the importer refuses even where check-case only warns.
  const stale = check.filled.filter((f) => f.stale === true);
  if (errors.length > 0 || stale.length > 0) {
    return fail("Der Fall ist nicht gültig.", [
      ...errors.slice(0, 8).map(problemText),
      ...(errors.length > 8 ? [`… und ${errors.length - 8} weitere Fehler`] : []),
      ...stale.slice(0, 4).map((f) => `${f.file} › ${f.field}: veraltete Prüfsumme`),
    ]);
  }
  if (!check.ok || check.play === undefined) {
    return fail("Der Fall ist nicht lösbar.", check.routes.filter((r) => r.report.status !== "pass").map((r) => `Weg ${r.routeId}: nicht lösbar`));
  }
  let pkg: ResolvedCasePackage;
  try {
    pkg = loadFilesPackage(share.files, check.play.npcs, check.play.salt, share.title);
  } catch (error) {
    return fail("Der Fall lässt sich nicht spielen.", [(error as Error).message.slice(0, 300)]);
  }
  let clockOrigin = 0;
  try {
    const value = (JSON.parse(share.files["case.json"] ?? "{}") as { clockOrigin?: unknown }).clockOrigin;
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) clockOrigin = value;
  } catch {}
  return { ok: true, slug: `eigen-${share.digest.slice(0, 32)}`, title: pkg.publicContent.title, pkg, clockOrigin, digest: share.digest };
}
