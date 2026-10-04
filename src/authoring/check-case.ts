import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { parseCaseTruth, type CaseTruth } from "../domain/case-truth.ts";
import { hashCaseTruth } from "../domain/case-truth.identity.ts";
import { validateCaseSemantics } from "../domain/case-semantics.ts";
import { parseCaseSolution, type CaseSolution } from "../domain/case-solution.ts";
import { hashCaseSolution } from "../domain/case-solution.identity.ts";
import { parseEvidenceAccessMap } from "../domain/evidence-access.ts";
import { hashEvidenceAccessMap } from "../domain/evidence-access.identity.ts";
import { parseEvidencePresentation, type EvidenceObservation } from "../domain/evidence-presentation.ts";
import { hashEvidencePresentation } from "../domain/evidence-presentation.identity.ts";
import { parseInterrogationProfile, parseQuestionCatalogue, profileLies, type QuestionCatalogue } from "../domain/interrogation-authoring.ts";
import { hashInterrogationProfile, hashQuestionCatalogue } from "../domain/interrogation-authoring.identity.ts";
import { parseNpcKnowledge } from "../domain/npc-knowledge.ts";
import { parseAccusationChallenge } from "../domain/accusation-challenge.ts";
import { buildPlayerRefIndex, type PlayerRefIndex } from "../domain/player-ref.ts";
import {
  hashChallengeComponent,
  hashInitialSetup,
  hashNpcBundle,
  hashNpcSnapshot,
  hashPublicContent,
  hashRefs,
  hashReleaseContext,
  hashReleaseManifest,
  serializeSessionJson,
} from "../domain/case-package.identity.ts";
import { resolveCasePackage, WITNESS_ROUTE, type PackageFinding, type ResolvedCasePackage, type RulesetVersion } from "../domain/case-package.ts";
import { checkCaseRoutes, type RouteReport } from "../domain/case-routes.ts";
import { initialSession, reduceSession } from "../domain/case-session.ts";
import {
  parseCaseProofProfile,
  type ReleasedObservation,
  type SolvabilityReport,
  type WitnessReplay,
} from "../domain/case-solvability.ts";
import { refSource } from "../play/cases.ts";
import { accusations } from "../play/game.ts";

// Author tool behind `npm run check-case -- <ordner>`: loads a case folder, runs every real parser
// and binding check per file, resolves the package with its proof and runs the solvability check
// with a witness that replays the steps through the real session. Every problem names its file and
// field. Host/author tool: messages may contain private IDs and are never shown to players.

export type Problem = { readonly file: string; readonly field: string; readonly message: string; readonly severity: "error" | "warning" };
/** A hash the tool computed: for a TO_BE_COMPUTED placeholder, or (stale) to replace an outdated value. */
export type FilledHash = { readonly file: string; readonly field: string; readonly value: string; readonly stale?: true };
export type CaseCheck = {
  readonly dir: string;
  readonly problems: readonly Problem[];
  readonly filled: readonly FilledHash[];
  readonly checkedFiles: readonly string[];
  /** Report of the profile's witness route. */
  readonly solvability: SolvabilityReport | null;
  /** Every certified route, the witness first; each replayed and checked on its own. */
  readonly routes: readonly RouteReport[];
  readonly ok: boolean;
  /** NPC file names and ref salt of the folder, for loading it as a playable package (playtest). */
  readonly play?: { readonly npcs: readonly string[]; readonly salt: string };
};

/** Placeholder authors leave for hashes the tool computes ("TO_BE_COMPUTED_FROM_FINAL_ARTIFACT"). */
const PLACEHOLDER = /^TO_BE_COMPUTED/;
/** Salt used when the folder has no case.json; refs only need to be consistent within one check. */
const DEFAULT_CHECK_SALT = "c4ec4ec4ec4ec4ec4ec4ec4ec4ec4ec4";

const FILES = {
  truth: "truth.json",
  solution: "solution.json",
  access: "evidence-access.json",
  presentation: "evidence-presentation.json",
  catalogue: "questions.json",
  initial: "initial-setup.json",
  challenge: "challenge.json",
  publicContent: "public-content.json",
  proofProfile: "proof-profile.json",
  releaseManifest: "release-manifest.json",
} as const;

const fieldOf = (path: readonly PropertyKey[]): string =>
  path.reduce<string>((out, key) => (typeof key === "number" ? `${out}[${key}]` : out === "" ? String(key) : `${out}.${String(key)}`), "") || "(Datei)";

/** Error collector: a failed step records its problems and yields null, later steps skip. */
class Collector {
  readonly problems: Problem[] = [];
  readonly filled: FilledHash[] = [];
  /**
   * Binding hash fields (top level and `bindings`) of one raw file: a placeholder is replaced by the
   * computed value, a concrete wrong value gets a hint with the expected one (the parser reports it).
   */
  bindHash(file: string, raw: unknown, key: string, value: string): void {
    const holders: [Record<string, unknown>, string][] = [];
    if (typeof raw === "object" && raw !== null) {
      holders.push([raw as Record<string, unknown>, ""]);
      const bindings = (raw as { bindings?: unknown }).bindings;
      if (typeof bindings === "object" && bindings !== null) holders.push([bindings as Record<string, unknown>, "bindings."]);
    }
    for (const [holder, prefix] of holders) {
      const given = holder[key];
      if (typeof given !== "string") continue;
      if (PLACEHOLDER.test(given)) {
        holder[key] = value;
        this.filled.push({ file, field: `${prefix}${key}`, value });
      } else if (given !== value) {
        this.warning(file, `${prefix}${key}`, `erwartet ${value}`);
        this.filled.push({ file, field: `${prefix}${key}`, value, stale: true });
      }
    }
  }
  readonly checked: string[] = [];
  error(file: string, field: string, message: string) {
    this.problems.push({ file, field, message, severity: "error" });
  }
  warning(file: string, field: string, message: string) {
    this.problems.push({ file, field, message, severity: "warning" });
  }
  /** Runs a real parser; a ZodError becomes one problem per issue with its exact field. */
  parse<T>(file: string, run: () => T): T | null {
    try {
      const value = run();
      this.checked.push(file);
      return value;
    } catch (error) {
      if (error instanceof z.ZodError) {
        for (const issue of error.issues) this.error(file, fieldOf(issue.path), issue.message);
      } else {
        this.error(file, "(Datei)", error instanceof Error ? error.message : String(error));
      }
      return null;
    }
  }
}

function readJson(dir: string, file: string, c: Collector): unknown {
  const path = join(dir, file);
  if (!existsSync(path)) {
    c.error(file, "(Datei)", "Datei fehlt");
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    c.error(file, "(Datei)", `kein gültiges JSON: ${(error as Error).message}`);
    return undefined;
  }
}

/** NPC names from matching npc-<name>.json / interrogation-<name>.json pairs. */
function npcNames(dir: string, c: Collector): string[] {
  const names = (prefix: string) =>
    readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith(".json")).map((f) => f.slice(prefix.length, -".json".length));
  const snapshots = names("npc-");
  const profiles = names("interrogation-");
  for (const n of snapshots.filter((n) => !profiles.includes(n))) c.error(`npc-${n}.json`, "(Datei)", `interrogation-${n}.json fehlt`);
  for (const n of profiles.filter((n) => !snapshots.includes(n))) c.error(`interrogation-${n}.json`, "(Datei)", `npc-${n}.json fehlt`);
  return snapshots.filter((n) => profiles.includes(n)).sort();
}

/** Player text files a locale variant (<ordner>/<sprache>/) replaces; everything else is shared. */
const LOCALE_KEYS = ["publicContent", "presentation"] as const satisfies readonly (keyof typeof FILES)[];
const isLocaleKey = (key: string): key is (typeof LOCALE_KEYS)[number] => (LOCALE_KEYS as readonly string[]).includes(key);

/** Locale variants of a case folder: subfolders with their own public-content.json. */
export const caseLocales = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir).filter((f) => /^[a-z]{2}$/.test(f) && existsSync(join(dir, f, FILES.publicContent))).sort() : [];

/**
 * Checks a case folder; with `lang`, its locale variant: the player text files from <ordner>/<lang>/
 * and the shared rest. A variant must be a pure translation (same entities, questions, rules and
 * reports as the base, only texts differ) and is checked for solvability like the base. Its release
 * manifest and proof profile are the base's; their bound hashes cover the base text, so they are
 * recomputed for the variant and never written back.
 */
export function checkCaseFolder(dir: string, lang?: string): CaseCheck {
  const c = new Collector();
  const localeFile = (file: string) => (lang !== undefined && Object.entries(FILES).some(([k, f]) => f === file && isLocaleKey(k)) ? `${lang}/${file}` : file);
  let play: CaseCheck["play"];
  const finish = (routes: readonly RouteReport[] = []): CaseCheck => ({
    ...(play === undefined ? {} : { play }),
    dir,
    problems: c.problems.map((p) => ({ ...p, file: localeFile(p.file) })),
    filled: c.filled
      .filter((f) => lang === undefined || (f.file !== FILES.releaseManifest && f.file !== FILES.proofProfile))
      .map((f) => ({ ...f, file: localeFile(f.file) })),
    checkedFiles: c.checked.map(localeFile),
    solvability: routes[0]?.report ?? null,
    routes,
    ok: c.problems.every((p) => p.severity !== "error") && routes.length > 0 && routes.every((r) => r.report.status === "pass"),
  });
  if (!existsSync(dir)) {
    c.error(dir, "(Ordner)", "Ordner nicht gefunden");
    return finish();
  }
  const raw = Object.fromEntries(
    Object.entries(FILES).map(([key, file]) => [key, readJson(lang !== undefined && isLocaleKey(key) ? join(dir, lang) : dir, file, c)]),
  ) as Record<keyof typeof FILES, unknown>;
  if (lang !== undefined) {
    const source = readJson(join(dir, lang), SOURCE_FILE, c);
    for (const key of LOCALE_KEYS) {
      const base = readJson(dir, FILES[key], new Collector());
      checkTranslation(base, raw[key], FILES[key], c);
      // The variant records which German text it translates: an edit of the base text shows up here.
      if (base !== undefined && source !== undefined) checkSource(`${lang}/${SOURCE_FILE}`, source, key, textDigest(base), c);
    }
    raw.releaseManifest = unbind(raw.releaseManifest, []);
    raw.proofProfile = unbind(raw.proofProfile, ["bindings"]);
  }
  const npcs = npcNames(dir, c).map((name) => ({ name, snapshot: readJson(dir, `npc-${name}.json`, c), profile: readJson(dir, `interrogation-${name}.json`, c) }));
  const caseConfig = existsSync(join(dir, "case.json")) ? readJson(dir, "case.json", c) : {};
  const salt = (caseConfig as { refSalt?: unknown }).refSalt ?? DEFAULT_CHECK_SALT;
  if (typeof salt === "string") play = { npcs: npcs.map((n) => n.name), salt };

  // ---- 1. Components, each with its real parser, in dependency order.
  const truth = raw.truth === undefined ? null : c.parse(FILES.truth, () => parseCaseTruth(raw.truth));
  if (truth === null) return finish();
  for (const finding of validateCaseSemantics(truth).findings) {
    c.error(FILES.truth, finding.subjectIds.join(", ") || "(Fall)", `${finding.code}: ${finding.message}`);
  }
  // Binding hashes are computed, never typed: fill placeholders in dependency order.
  const bindAll = (key: string, value: string, keys: (keyof typeof FILES)[], npcPart: ("snapshot" | "profile")[]) => {
    for (const k of keys) c.bindHash(FILES[k], raw[k], key, value);
    for (const npc of npcs) for (const part of npcPart) c.bindHash(`${part === "snapshot" ? "npc" : "interrogation"}-${npc.name}.json`, npc[part], key, value);
  };
  bindAll("truthHash", hashCaseTruth(truth), ["solution", "access", "presentation", "catalogue", "challenge", "proofProfile"], ["snapshot", "profile"]);
  const solution = raw.solution === undefined ? null : c.parse(FILES.solution, () => parseCaseSolution(raw.solution, truth));
  const parseWith = <T>(key: keyof typeof FILES, parse: () => T) => (raw[key] === undefined ? null : c.parse(FILES[key], parse));
  const access = parseWith("access", () => parseEvidenceAccessMap(raw.access, truth));
  const presentation = parseWith("presentation", () => parseEvidencePresentation(raw.presentation, truth));
  if (solution !== null) bindAll("solutionHash", hashCaseSolution(solution), ["challenge", "proofProfile"], ["snapshot"]);
  const catalogue = parseWith("catalogue", () => parseQuestionCatalogue(raw.catalogue, truth));
  if (catalogue !== null) bindAll("catalogueHash", hashQuestionCatalogue(catalogue), [], ["profile"]);
  const challenge = solution === null ? null : parseWith("challenge", () => parseAccusationChallenge(raw.challenge, truth, solution));
  const parsedNpcs = npcs.map((npc) => ({
    name: npc.name,
    snapshot:
      npc.snapshot === undefined || solution === null
        ? null
        : c.parse(`npc-${npc.name}.json`, () => parseNpcKnowledge(npc.snapshot, truth, (npc.snapshot as { solutionHash?: unknown }).solutionHash === null ? null : solution)),
    profile: npc.profile === undefined || catalogue === null ? null : c.parse(`interrogation-${npc.name}.json`, () => parseInterrogationProfile(npc.profile, truth, catalogue)),
  }));
  if (npcs.length === 0) c.warning("npc-*.json", "(Ordner)", "keine NPCs: Befragungen sind nicht möglich");
  for (const npc of parsedNpcs) {
    if (npc.snapshot !== null && npc.snapshot.npcId !== `person:${npc.name}`) {
      c.warning(`npc-${npc.name}.json`, "npcId", `Dateiname passt nicht zu ${npc.snapshot.npcId}`);
    }
  }

  const index = typeof salt === "string" ? buildPlayerRefIndex(truth, salt) : null;
  if (index === null || !index.success) {
    c.error("case.json", "refSalt", index === null ? "refSalt muss ein String sein" : `PlayerRef-Index: ${index.code}`);
    return finish();
  }
  if (c.problems.some((p) => p.severity === "error")) return finish();

  // ---- 2. Proof: compute the release context and hashes, fill placeholders, check given values.
  // A case with lies runs under ruleset v2; one without stays v1 with unchanged hashes.
  const lies = parsedNpcs.flatMap((npc) => (npc.profile === null ? [] : profileLies(npc.profile, truth)));
  const rulesetVersion: RulesetVersion = lies.length > 0 ? "mystery-session-v2" : "mystery-session-v1"; // see RULESET_VERSIONS
  const packageInput = {
    schemaVersion: 1,
    rulesetVersion,
    truth: raw.truth,
    solution: raw.solution,
    access: raw.access,
    presentation: raw.presentation,
    catalogue: raw.catalogue,
    npcs: npcs.map(({ snapshot, profile }) => ({ snapshot, profile })),
    initial: raw.initial,
    challenge: raw.challenge,
    publicContent: raw.publicContent,
    proof: null as null | { profile: unknown; releaseManifest: string },
  };
  const contextHash = releaseContextHash(packageInput, truth, solution!, catalogue!, index.index, salt as string, c);
  const manifest = contextHash === null ? null : bindManifest(raw.releaseManifest, contextHash, index.index, c);
  if (manifest === null) return finish();
  const releaseHash = hashReleaseManifest(serializeSessionJson(manifest));
  const profileInput = bindProfile(raw.proofProfile, releaseHash, c);
  if (profileInput === null) return finish();
  const profile = c.parse(FILES.proofProfile, () => parseCaseProofProfile(profileInput, truth, solution!));
  if (profile === null) return finish();

  // ---- 3. The whole package through resolveCasePackage: cross-component bindings.
  packageInput.proof = { profile: profileInput, releaseManifest: serializeSessionJson(manifest) };
  const resolved = resolveCasePackage(packageInput, refSource(raw.truth, salt as string));
  if (!resolved.ok) {
    for (const finding of resolved.findings) reportPackageFinding(finding, npcs.map((n) => n.name), c);
    return finish();
  }
  // The epilogue is optional; without it a solved case ends without a narrated resolution.
  if (resolved.package.publicContent.epilogue === undefined) {
    c.warning(FILES.publicContent, "epilogue", "kein Epilog: nach der gelösten Anklage erscheint keine erzählte Auflösung");
  }

  // ---- 4. Solvability of every certified route, each with its own witness replay on the real session.
  try {
    const { routes } = checkCaseRoutes(truth, solution!, profile, resolved.package.proof!.routes, sessionWitness(resolved.package, manifest, releaseHash), { lies });
    routes.forEach(({ routeId, report }, i) => {
      // The witness route is the profile's; further routes are the manifest's certificateData.routes.
      const [file, at, prefix] = routeId === WITNESS_ROUTE
        ? [FILES.proofProfile, "", ""]
        : [FILES.releaseManifest, `certificateData.routes[${i - 1}] `, `Weg ${routeId}: `];
      for (const f of report.findings) {
        const message = `${prefix}${f.code}${f.subjectIds.length > 0 ? ` (${f.subjectIds.join(", ")})` : ""}`;
        (f.severity === "error" ? c.error : c.warning).call(c, file, `${at}${fieldOf(f.path)}`.trim(), message);
      }
      if (report.status !== "pass") {
        c.error(file, `${at}(Lösbarkeit)`.trim(), `${prefix}Status ${report.status}, ${report.survivingAnswerCount} Antwortvektoren bleiben möglich`);
      } else {
        // LATE-SUSPECT: the solving accusation must be possible at the end of this route too.
        const accusation = witnessAccusation(resolved.package, manifest, resolved.package.proof!.routes[i]!.stepIds);
        if (accusation !== null) c.error(file, routeId === WITNESS_ROUTE ? "witnessStepIds" : `${at}stepIds`.trim(), `${prefix}${accusation}`);
      }
    });
    return finish(routes);
  } catch (error) {
    c.error(FILES.proofProfile, "(Lösbarkeit)", `Prüfung abgebrochen: ${(error as Error).message}`);
    return finish();
  }
}

// ---------- Helpers ----------

/** A copy of a raw file with its release hash back to the placeholder (locale variants). */
function unbind(raw: unknown, path: string[]): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const copy = structuredClone(raw) as Record<string, unknown>;
  const holder = path.reduce<Record<string, unknown> | undefined>((o, k) => (typeof o?.[k] === "object" ? (o[k] as Record<string, unknown>) : undefined), copy);
  for (const key of ["releaseContextHash", "releaseHash"]) if (holder !== undefined && typeof holder[key] === "string") holder[key] = "TO_BE_COMPUTED_FROM_LOCALE";
  return copy;
}

/** <ordner>/<lang>/source.json: digests of the base texts the variant was translated from. */
const SOURCE_FILE = "source.json";

/** Digest of a file's player texts only (TEXT_FIELDS, in document order). */
function textDigest(raw: unknown): string {
  const texts: string[] = [];
  const walk = (v: unknown, key: string): void => {
    if (Array.isArray(v)) v.forEach((x) => walk(x, ""));
    else if (typeof v === "object" && v !== null) for (const [k, x] of Object.entries(v)) walk(x, k);
    else if (typeof v === "string" && TEXT_FIELDS.has(key)) texts.push(v);
  };
  walk(raw, "");
  return createHash("sha256").update(JSON.stringify(texts)).digest("hex");
}

function checkSource(file: string, source: unknown, key: string, digest: string, c: Collector): void {
  const given = typeof source === "object" && source !== null ? (source as Record<string, unknown>)[key] : undefined;
  if (typeof given === "string" && PLACEHOLDER.test(given)) {
    c.filled.push({ file, field: key, value: digest });
  } else if (given !== digest) {
    c.warning(file, key, `der Grundtext (${FILES[key as keyof typeof FILES]}) hat sich seit der Übersetzung geändert: Übersetzung nachziehen, dann --fix`);
    c.filled.push({ file, field: key, value: digest, stale: true });
  }
}

/** Fields that hold player text; a translation may change only these. */
const TEXT_FIELDS = new Set(["title", "brief", "challengeQuestion", "label", "role", "text", "epilogue"]);
const INTERNAL_ID = /\b(person|event|item|location|question|evidence|rule|case):[a-z0-9]/;

/** A locale file is the base file with other texts: same structure, same ids, same claims. */
function checkTranslation(base: unknown, translated: unknown, file: string, c: Collector): void {
  if (base === undefined || translated === undefined) return;
  const walk = (b: unknown, t: unknown, path: string): void => {
    if (Array.isArray(b) && Array.isArray(t)) {
      if (b.length !== t.length) return c.error(file, path || "(Datei)", `Übersetzung hat ${t.length} statt ${b.length} Einträge`);
      b.forEach((x, i) => walk(x, t[i], `${path}[${i}]`));
    } else if (typeof b === "object" && b !== null && typeof t === "object" && t !== null && !Array.isArray(b) && !Array.isArray(t)) {
      const keys = new Set([...Object.keys(b), ...Object.keys(t)]);
      for (const k of keys) {
        const at = path === "" ? k : `${path}.${k}`;
        const [bv, tv] = [(b as Record<string, unknown>)[k], (t as Record<string, unknown>)[k]];
        if (TEXT_FIELDS.has(k) && typeof bv === "string" && typeof tv === "string") {
          if (tv.trim() === "") c.error(file, at, "Übersetzung ist leer");
          else if (INTERNAL_ID.test(tv)) c.error(file, at, "Übersetzung enthält eine interne ID");
        } else walk(bv, tv, at);
      }
    } else if (JSON.stringify(b) !== JSON.stringify(t)) {
      c.error(file, path || "(Datei)", "weicht vom Grundfall ab: eine Übersetzung ändert nur Texte");
    }
  };
  walk(base, translated, "");
}

const PACKAGE_FILES: Record<string, string> = {
  truth: FILES.truth,
  solution: FILES.solution,
  access: FILES.access,
  presentation: FILES.presentation,
  catalogue: FILES.catalogue,
  initial: FILES.initial,
  challenge: FILES.challenge,
  publicContent: FILES.publicContent,
};

const PACKAGE_CODES: Record<PackageFinding["code"], string> = {
  SHAPE: "Form ungültig",
  BINDING: "Bindung passt nicht (caseId, Hash oder Revision)",
  REFERENCE: "verweist auf etwas, das es nicht gibt",
  REF_MAPPING: "PlayerRef-Zuordnung ungültig",
  LIMIT: "Grenze überschritten",
  PROOF_BINDING: "Beweis passt nicht zum Paket",
  RULESET: "Lügen gibt es erst ab Regelwerk mystery-session-v2",
  INSINCERE_LIE: "keine Lüge: der NPC weiß oder glaubt die Wahrheit nicht (das wäre ein Irrtum, keine Lüge)",
};

/** Sharper messages for findings whose bare code says too little to an author. */
const PACKAGE_HINTS: Record<string, string> = {
  "PROOF_BINDING certificateData.steps":
    "die stepIds der Schritte müssen genau die Schritte der Wege sein (proof-profile.json › witnessStepIds, dann certificateData.routes), in der Reihenfolge ihres ersten Vorkommens",
  "PROOF_BINDING certificateData.routes": "jeder Weg braucht eine eigene routeId, und „witness“ ist für witnessStepIds vergeben",
  "PROOF_BINDING certificateData.observations": "jede Beobachtung des Profils braucht genau einen Eintrag im Manifest und umgekehrt",
};

function reportPackageFinding(finding: PackageFinding, npcNames: string[], c: Collector): void {
  const [root, index, part, ...rest] = finding.path;
  let file = PACKAGE_FILES[String(root)];
  let field = finding.path.slice(1);
  if (root === "npcs" && typeof index === "number") {
    file = `${part === "profile" ? "interrogation" : "npc"}-${npcNames[index] ?? index}.json`;
    field = rest;
  } else if (root === "proof") {
    file = index === "profile" ? FILES.proofProfile : FILES.releaseManifest;
    field = finding.path.slice(2);
  }
  c.error(file ?? "(Paket)", fieldOf(field), PACKAGE_HINTS[`${finding.code} ${fieldOf(field)}`] ?? PACKAGE_CODES[finding.code]);
}

type Npc = { snapshot: unknown; profile: unknown };
function releaseContextHash(
  input: { rulesetVersion: RulesetVersion; initial: unknown; npcs: Npc[]; access: unknown; presentation: unknown; challenge: unknown; publicContent: unknown },
  truth: CaseTruth,
  solution: CaseSolution,
  catalogue: QuestionCatalogue,
  index: PlayerRefIndex,
  salt: string,
  c: Collector,
): string | null {
  try {
    const truthHash = hashCaseTruth(truth);
    return hashReleaseContext({
      rulesetVersion: input.rulesetVersion,
      truthHash,
      solutionHash: hashCaseSolution(solution),
      accessHash: hashEvidenceAccessMap(parseEvidenceAccessMap(input.access, truth)),
      presentationHash: hashEvidencePresentation(parseEvidencePresentation(input.presentation, truth)),
      catalogueHash: hashQuestionCatalogue(catalogue),
      npcBundleHash: hashNpcBundle(
        input.npcs.map((n) => {
          const raw = n.snapshot as { solutionHash?: unknown };
          const snapshot = parseNpcKnowledge(n.snapshot, truth, raw.solutionHash === null ? null : solution);
          const profile = parseInterrogationProfile(n.profile, truth, catalogue);
          return { npcId: snapshot.npcId, snapshotHash: hashNpcSnapshot(snapshot), profileHash: hashInterrogationProfile(profile) };
        }),
      ),
      initialHash: hashInitialSetup(input.initial as Parameters<typeof hashInitialSetup>[0]),
      refsHash: hashRefs({
        config: { profile: index.profile, saltHex: salt },
        caseId: truth.caseId,
        truthHash,
        mapping: index.entries.map((e) => ({ kind: e.kind, id: e.id, ref: e.ref })),
      }),
      challengeHash: hashChallengeComponent(parseAccusationChallenge(input.challenge, truth, solution)),
      publicContentHash: hashPublicContent(input.publicContent as Parameters<typeof hashPublicContent>[0]),
    });
  } catch (error) {
    c.error(FILES.initial, "(Datei)", `Release-Kontext nicht berechenbar: ${(error as Error).message}`);
    return null;
  }
}

type ManifestStep = { stepId: string; event: unknown };
type ManifestAlternative = { report?: unknown; kind?: string; questionId?: string; evidenceId?: string; claim?: unknown; stance?: string };
type ManifestObservation = ReleasedObservation & { alternatives?: ManifestAlternative[]; ruleId?: string; afterObservations?: string[] };
export type Manifest = {
  schemaVersion: 1;
  releaseContextHash: string;
  adapterVersion: string;
  certificateData: { schemaVersion: 1; steps: ManifestStep[]; observations: ManifestObservation[] };
};

/** Replaces {$playerRefOf:{kind,id}} by real PlayerRefs and binds the release context hash. */
function bindManifest(raw: unknown, contextHash: string, index: PlayerRefIndex, c: Collector): Manifest | null {
  if (typeof raw !== "object" || raw === null) {
    if (raw !== undefined) c.error(FILES.releaseManifest, "(Datei)", "muss ein Objekt sein");
    return null;
  }
  const refs = new Map(index.entries.map((e) => [`${e.kind}|${e.id}`, e.ref as string]));
  let ok = true;
  const substitute = (value: unknown, path: (string | number)[]): unknown => {
    if (Array.isArray(value)) return value.map((x, i) => substitute(x, [...path, i]));
    if (typeof value !== "object" || value === null) return value;
    if ("$playerRefOf" in value) {
      const { kind, id } = (value as { $playerRefOf: { kind: string; id: string } }).$playerRefOf ?? {};
      const ref = refs.get(`${kind}|${id}`);
      if (ref === undefined) {
        c.error(FILES.releaseManifest, fieldOf(path), `$playerRefOf verweist auf unbekanntes ${kind} „${id}“`);
        ok = false;
      }
      return ref;
    }
    return Object.fromEntries(Object.entries(value).map(([k, x]) => [k, substitute(x, [...path, k])]));
  };
  const manifest = substitute(raw, []) as Manifest;
  const given = manifest.releaseContextHash;
  if (typeof given === "string" && !PLACEHOLDER.test(given) && given !== contextHash) {
    // Stale after an edit of a component: an error, but checking goes on with the current value so
    // that --fix can rewrite this and the dependent profile releaseHash in one pass.
    c.error(FILES.releaseManifest, "releaseContextHash", `veraltet: das Paket hat ${contextHash} (--fix trägt ihn ein)`);
    c.filled.push({ file: FILES.releaseManifest, field: "releaseContextHash", value: contextHash, stale: true });
  }
  if (ok && typeof given === "string" && PLACEHOLDER.test(given)) c.filled.push({ file: FILES.releaseManifest, field: "releaseContextHash", value: contextHash });
  return ok ? { ...manifest, releaseContextHash: contextHash } : null;
}

function bindProfile(raw: unknown, releaseHash: string, c: Collector): unknown {
  const bindings = (raw as { bindings?: { releaseHash?: unknown } } | undefined)?.bindings;
  if (typeof raw !== "object" || raw === null || typeof bindings !== "object" || bindings === null) {
    if (raw !== undefined) c.error(FILES.proofProfile, "bindings", "fehlt");
    return null;
  }
  const given = bindings.releaseHash;
  if (typeof given === "string" && !PLACEHOLDER.test(given) && given !== releaseHash) {
    c.error(FILES.proofProfile, "bindings.releaseHash", `veraltet: das Release-Manifest hat ${releaseHash} (--fix trägt ihn ein)`);
    c.filled.push({ file: FILES.proofProfile, field: "bindings.releaseHash", value: releaseHash, stale: true });
  }
  if (typeof given === "string" && PLACEHOLDER.test(given)) c.filled.push({ file: FILES.proofProfile, field: "bindings.releaseHash", value: releaseHash });
  return { ...raw, bindings: { ...bindings, releaseHash } };
}

function sortedJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(sortedJson).join(",")}]`;
  if (typeof value !== "object" || value === null) return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${sortedJson((value as Record<string, unknown>)[k])}`).join(",")}}`;
}

/**
 * Witness port on the real session: replays the steps with reduceSession. An OBSERVED record is
 * released only if its evidence card was released with one of its alternative reports; a
 * REPORTED_BY_NPC once that NPC gave one of its "npc" alternatives (question, stance, statement)
 * or, confronted, one of its "admission" alternatives;
 * a PUBLIC_RULE once all of its afterObservations are released.
 */
export function sessionWitness(pkg: ResolvedCasePackage, manifest: Manifest, releaseHash: string): WitnessReplay {
  return (stepIds) => {
    const events: unknown[] = [];
    for (const stepId of stepIds) {
      const step = manifest.certificateData.steps.find((s) => s.stepId === stepId);
      if (step === undefined) return { success: false, code: "INVALID_WITNESS" };
      events.push(step.event);
    }
    return eventWitness(pkg, manifest, releaseHash)(events);
  };
}

/**
 * The same release rules over any player event log instead of the manifest's steps (used by the
 * playtest bot to ask whether a player's knowledge already proves the answer).
 */
export function eventWitness(pkg: ResolvedCasePackage, manifest: Manifest, releaseHash: string): (events: readonly unknown[]) => ReturnType<WitnessReplay> {
  return (events) => {
    let state = initialSession(pkg);
    const cards = new Map<string, EvidenceObservation>();
    const said = new Set<string>();
    for (const event of events) {
      const result = reduceSession(pkg, state, event);
      if (!result.ok) return { success: false, code: "INVALID_WITNESS" };
      state = result.state;
      if (result.output.type === "investigate") {
        for (const card of result.output.observations) cards.set(pkg.refs.resolve(card.evidence)!.id, card);
      }
      const answer = result.output.type === "interrogate" ? result.output.observation : null;
      if (answer !== null && answer.act === "answer" && answer.stance !== "does_not_know") {
        said.add(sortedJson([pkg.refs.resolve(answer.npc)!.id, answer.questionId, answer.stance, answer.statement]));
      }
      const admission = result.output.type === "confront" ? result.output.observation : null;
      if (admission !== null && admission.act === "admit") {
        const evidenceId = pkg.refs.resolve(admission.evidence)!.id;
        said.add(sortedJson([pkg.refs.resolve(admission.npc)!.id, "admission", admission.questionId, evidenceId, admission.stance, admission.statement]));
      }
    }
    const released = new Set<string>();
    const records: ReleasedObservation[] = [];
    const payload = ({ alternatives, ruleId, afterObservations, ...rest }: ManifestObservation) => rest as ReleasedObservation;
    for (const o of manifest.certificateData.observations) {
      if (o.kind === "REPORTED_BY_NPC") {
        const heard = (alt: ManifestAlternative) =>
          alt.kind === "npc"
            ? said.has(sortedJson([o.npcId, alt.questionId, alt.stance, alt.claim]))
            : alt.kind === "admission" && said.has(sortedJson([o.npcId, "admission", alt.questionId, alt.evidenceId, alt.stance, alt.claim]));
        if (o.alternatives?.some(heard)) {
          released.add(o.id);
          records.push(payload(o));
        }
        continue;
      }
      if (o.kind !== "OBSERVED" || o.source.kind !== "evidence") continue;
      const reports = new Set(cards.get(o.source.evidenceId)?.reports.map(sortedJson) ?? []);
      if (o.alternatives?.some((alt) => reports.has(sortedJson(alt.report)))) {
        released.add(o.id);
        records.push(payload(o));
      }
    }
    for (const o of manifest.certificateData.observations) {
      if (o.kind === "PUBLIC_RULE" && (o.afterObservations ?? []).every((id) => released.has(id))) records.push(payload(o));
    }
    const bindings = { caseId: pkg.truth.caseId, truthHash: pkg.refs.truthHash, solutionHash: hashCaseSolution(pkg.solution), releaseHash };
    return { success: true, bindings, released: records };
  };
}

/**
 * Late suspects: after the witness, the player must know every person the answer accuses, and the
 * D8 accusation over the persons they know (unknown ones count as not accused) must be solved.
 * Returns null when it is, otherwise a German message for the author.
 */
export function witnessAccusation(pkg: ResolvedCasePackage, manifest: Manifest, stepIds: readonly string[]): string | null {
  let state = initialSession(pkg);
  for (const stepId of stepIds) {
    const step = manifest.certificateData.steps.find((s) => s.stepId === stepId);
    const result = step === undefined ? null : reduceSession(pkg, state, step.event);
    if (result === null || !result.ok) return `Lösungsweg bricht bei „${stepId}“ ab`;
    state = result.state;
  }
  const claims = new Map(pkg.solution.conclusions.map((c) => [c.id, c.claim]));
  const accused = new Set(
    pkg.solution.requiredConclusions.flatMap((r) => {
      const claim = claims.get(r.conclusionId)!;
      return r.value && "personId" in claim ? [claim.personId as string] : [];
    }),
  );
  const knownRef = new Set(state.knowledge.known.filter((k) => k.kind === "person").map((k) => k.ref));
  const isKnown = (id: string) => knownRef.has(pkg.refs.refFor("person", id)!);
  const unknown = [...accused].filter((id) => !isKnown(id));
  if (unknown.length > 0) return `nach dem Lösungsweg ist ${unknown.join(", ")} dem Spieler noch unbekannt und kann nicht angeklagt werden`;
  // Accuse exactly the way the game offers it (one chosen claim true, the other known ones false):
  // a case that only an accusation the game cannot build would solve is not solvable in play.
  const offered = accusations({ pkg, state, clockOrigin: 0 });
  if (offered.length === 0) return "nach dem Lösungsweg bietet das Spiel keine Anklage an";
  const solves = offered.some((a) => {
    const result = reduceSession(pkg, state, a.event);
    return result.ok && result.output.type === "accuse" && result.output.verdict === "solved";
  });
  return solves ? null : "keine Anklage, die das Spiel nach dem Lösungsweg anbietet, löst den Fall";
}

/** Human-readable report; one line per problem with file and field. */
export function formatCaseCheck(check: CaseCheck, lang?: string): string {
  const lines = [lang === undefined ? `Prüfe Fall-Ordner ${check.dir}` : `Prüfe Sprachfassung ${lang} von ${check.dir}`];
  const errors = check.problems.filter((p) => p.severity === "error");
  const warnings = check.problems.filter((p) => p.severity === "warning");
  for (const p of errors) lines.push(`  FEHLER  ${p.file} › ${p.field}: ${p.message}`);
  for (const p of warnings) lines.push(`  Hinweis ${p.file} › ${p.field}: ${p.message}`);
  for (const f of check.filled.filter((f) => f.stale !== true)) lines.push(`  berechnet ${f.file} › ${f.field} = ${f.value}`);
  for (const { routeId, report: s } of check.routes) {
    const name = check.routes.length === 1 ? "" : ` Weg ${routeId}`;
    lines.push(`  Lösbarkeit${name}: ${s.status.toUpperCase()} (${s.survivingAnswerCount} mögliche Antwort${s.survivingAnswerCount === 1 ? "" : "en"})`);
  }
  lines.push(check.ok ? `OK: ${check.checkedFiles.length} Dateien geprüft, Fall lösbar.` : `NICHT OK: ${errors.length} Fehler.`);
  return lines.join("\n");
}

/** `--fix`: writes the computed hashes into placeholder and stale fields; returns the files changed. */
export function writeFilledHashes(check: CaseCheck): string[] {
  const byFile = new Map<string, FilledHash[]>();
  for (const f of check.filled) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);
  for (const [file, fills] of byFile) {
    const path = join(check.dir, file);
    const json = JSON.parse(readFileSync(path, "utf8"));
    for (const { field, value } of fills) {
      const keys = field.split(".");
      const holder = keys.slice(0, -1).reduce((o, k) => o[k], json);
      holder[keys.at(-1)!] = value;
    }
    writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
  }
  return [...byFile.keys()];
}

/**
 * Binds a case's authored proof (release manifest and proof profile with TO_BE_COMPUTED
 * placeholders) to a package input, as the case check does. Used by the play host so that
 * packages under ruleset mystery-session-v3 carry the witness that hints are derived from.
 * Hashes already filled in (certified under v1/v2) are recomputed for the input's ruleset:
 * stale values are the case check's finding, not the play host's.
 */
export function bindCaseProof(
  input: { rulesetVersion: RulesetVersion; truth: unknown; solution: unknown; catalogue: unknown; initial: unknown; npcs: Npc[]; access: unknown; presentation: unknown; challenge: unknown; publicContent: unknown },
  rawManifest: unknown,
  rawProfile: unknown,
  salt: string,
): { profile: unknown; releaseManifest: string } {
  const c = new Collector();
  const truth = parseCaseTruth(input.truth);
  const solution = parseCaseSolution(input.solution, truth);
  const catalogue = parseQuestionCatalogue(input.catalogue, truth);
  const index = buildPlayerRefIndex(truth, salt);
  if (!index.success) throw new Error(`PlayerRef index: ${index.code}`);
  const unbound = "TO_BE_COMPUTED_FOR_PLAY";
  const manifestInput = typeof rawManifest === "object" && rawManifest !== null ? { ...rawManifest, releaseContextHash: unbound } : rawManifest;
  const bindings = (rawProfile as { bindings?: object } | null)?.bindings;
  const profileInput = typeof bindings === "object" && bindings !== null ? { ...(rawProfile as object), bindings: { ...bindings, releaseHash: unbound } } : rawProfile;
  const contextHash = releaseContextHash(input, truth, solution, catalogue, index.index, salt, c);
  const manifest = contextHash === null ? null : bindManifest(manifestInput, contextHash, index.index, c);
  const releaseManifest = manifest === null ? null : serializeSessionJson(manifest);
  const profile = releaseManifest === null ? null : bindProfile(profileInput, hashReleaseManifest(releaseManifest), c);
  if (profile === null || releaseManifest === null || c.problems.length > 0) throw new Error(`Proof not bindable: ${JSON.stringify(c.problems)}`);
  return { profile, releaseManifest };
}
