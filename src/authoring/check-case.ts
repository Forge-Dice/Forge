import { existsSync, readdirSync, readFileSync } from "node:fs";
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
import { resolveCasePackage, type PackageFinding, type ResolvedCasePackage, type RulesetVersion } from "../domain/case-package.ts";
import { initialSession, reduceSession } from "../domain/case-session.ts";
import {
  checkCaseSolvability,
  parseCaseProofProfile,
  type ReleasedObservation,
  type SolvabilityReport,
  type WitnessReplay,
} from "../domain/case-solvability.ts";
import { refSource } from "../play/cases.ts";

// Author tool behind `npm run check-case -- <ordner>`: loads a case folder, runs every real parser
// and binding check per file, resolves the package with its proof and runs the solvability check
// with a witness that replays the steps through the real session. Every problem names its file and
// field. Host/author tool: messages may contain private IDs and are never shown to players.

export type Problem = { readonly file: string; readonly field: string; readonly message: string; readonly severity: "error" | "warning" };
export type CaseCheck = {
  readonly dir: string;
  readonly problems: readonly Problem[];
  readonly checkedFiles: readonly string[];
  readonly solvability: SolvabilityReport | null;
  readonly ok: boolean;
};

/** Placeholder authors leave for hashes the tool computes ("TO_BE_COMPUTED_FROM_FINAL_ARTIFACT"). */
const PLACEHOLDER = /^TO_BE_COMPUTED/;
/** Salt used when the folder has no case.json; refs only need to be consistent within one check. */
export const DEFAULT_CHECK_SALT = "c4ec4ec4ec4ec4ec4ec4ec4ec4ec4ec4";

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

export function checkCaseFolder(dir: string): CaseCheck {
  const c = new Collector();
  const finish = (solvability: SolvabilityReport | null = null): CaseCheck => ({
    dir,
    problems: c.problems,
    checkedFiles: c.checked,
    solvability,
    ok: c.problems.every((p) => p.severity !== "error") && solvability?.status === "pass",
  });
  if (!existsSync(dir)) {
    c.error(dir, "(Ordner)", "Ordner nicht gefunden");
    return finish();
  }
  const raw = Object.fromEntries(Object.entries(FILES).map(([key, file]) => [key, readJson(dir, file, c)])) as Record<keyof typeof FILES, unknown>;
  const npcs = npcNames(dir, c).map((name) => ({ name, snapshot: readJson(dir, `npc-${name}.json`, c), profile: readJson(dir, `interrogation-${name}.json`, c) }));
  const caseConfig = existsSync(join(dir, "case.json")) ? readJson(dir, "case.json", c) : {};
  const salt = (caseConfig as { refSalt?: unknown }).refSalt ?? DEFAULT_CHECK_SALT;

  // ---- 1. Components, each with its real parser, in dependency order.
  const truth = raw.truth === undefined ? null : c.parse(FILES.truth, () => parseCaseTruth(raw.truth));
  if (truth === null) return finish();
  for (const finding of validateCaseSemantics(truth).findings) {
    c.error(FILES.truth, finding.subjectIds.join(", ") || "(Fall)", `${finding.code}: ${finding.message}`);
  }
  const solution = raw.solution === undefined ? null : c.parse(FILES.solution, () => parseCaseSolution(raw.solution, truth));
  const parseWith = <T>(key: keyof typeof FILES, parse: () => T) => (raw[key] === undefined ? null : c.parse(FILES[key], parse));
  const access = parseWith("access", () => parseEvidenceAccessMap(raw.access, truth));
  const presentation = parseWith("presentation", () => parseEvidencePresentation(raw.presentation, truth));
  const catalogue = parseWith("catalogue", () => parseQuestionCatalogue(raw.catalogue, truth));
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
  const rulesetVersion: RulesetVersion = lies.length > 0 ? "mystery-session-v2" : "mystery-session-v1";
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

  // ---- 4. Solvability with a witness on the real session.
  try {
    const report = checkCaseSolvability(truth, solution!, profile, sessionWitness(resolved.package, manifest, releaseHash), { lies });
    for (const f of report.findings) {
      const message = `${f.code}${f.subjectIds.length > 0 ? ` (${f.subjectIds.join(", ")})` : ""}`;
      (f.severity === "error" ? c.error : c.warning).call(c, FILES.proofProfile, fieldOf(f.path), message);
    }
    if (report.status !== "pass") {
      c.error(FILES.proofProfile, "(Lösbarkeit)", `Status ${report.status}, ${report.survivingAnswerCount} Antwortvektoren bleiben möglich`);
    }
    return finish(report);
  } catch (error) {
    c.error(FILES.proofProfile, "(Lösbarkeit)", `Prüfung abgebrochen: ${(error as Error).message}`);
    return finish();
  }
}

// ---------- Helpers ----------

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
  c.error(file ?? "(Paket)", fieldOf(field), PACKAGE_CODES[finding.code]);
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
type ManifestAlternative = { report?: unknown; kind?: string; questionId?: string; claim?: unknown; stance?: string };
type ManifestObservation = ReleasedObservation & { alternatives?: ManifestAlternative[]; ruleId?: string; afterObservations?: string[] };
type Manifest = {
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
    c.error(FILES.releaseManifest, "releaseContextHash", `veraltet: das Paket hat ${contextHash}`);
    ok = false;
  }
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
    c.error(FILES.proofProfile, "bindings.releaseHash", `veraltet: das Release-Manifest hat ${releaseHash}`);
    return null;
  }
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
 * REPORTED_BY_NPC once that NPC gave one of its "npc" alternatives (question, stance, statement);
 * a PUBLIC_RULE once all of its afterObservations are released.
 */
export function sessionWitness(pkg: ResolvedCasePackage, manifest: Manifest, releaseHash: string): WitnessReplay {
  return (stepIds) => {
    let state = initialSession(pkg);
    const cards = new Map<string, EvidenceObservation>();
    const said = new Set<string>();
    for (const stepId of stepIds) {
      const step = manifest.certificateData.steps.find((s) => s.stepId === stepId);
      if (step === undefined) return { success: false, code: "INVALID_WITNESS" };
      const result = reduceSession(pkg, state, step.event);
      if (!result.ok) return { success: false, code: "INVALID_WITNESS" };
      state = result.state;
      if (result.output.type === "investigate") {
        for (const card of result.output.observations) cards.set(pkg.refs.resolve(card.evidence)!.id, card);
      }
      const answer = result.output.type === "interrogate" ? result.output.observation : null;
      if (answer !== null && answer.act === "answer" && answer.stance !== "does_not_know") {
        said.add(sortedJson([pkg.refs.resolve(answer.npc)!.id, answer.questionId, answer.stance, answer.statement]));
      }
    }
    const released = new Set<string>();
    const records: ReleasedObservation[] = [];
    const payload = ({ alternatives, ruleId, afterObservations, ...rest }: ManifestObservation) => rest as ReleasedObservation;
    for (const o of manifest.certificateData.observations) {
      if (o.kind === "REPORTED_BY_NPC") {
        if (o.alternatives?.some((alt) => alt.kind === "npc" && said.has(sortedJson([o.npcId, alt.questionId, alt.stance, alt.claim])))) {
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

/** Human-readable report; one line per problem with file and field. */
export function formatCaseCheck(check: CaseCheck): string {
  const lines = [`Prüfe Fall-Ordner ${check.dir}`];
  const errors = check.problems.filter((p) => p.severity === "error");
  const warnings = check.problems.filter((p) => p.severity === "warning");
  for (const p of errors) lines.push(`  FEHLER  ${p.file} › ${p.field}: ${p.message}`);
  for (const p of warnings) lines.push(`  Hinweis ${p.file} › ${p.field}: ${p.message}`);
  if (check.solvability !== null) {
    const s = check.solvability;
    lines.push(`  Lösbarkeit: ${s.status.toUpperCase()} (${s.survivingAnswerCount} mögliche Antwort${s.survivingAnswerCount === 1 ? "" : "en"})`);
  }
  lines.push(check.ok ? `OK: ${check.checkedFiles.length} Dateien geprüft, Fall lösbar.` : `NICHT OK: ${errors.length} Fehler.`);
  return lines.join("\n");
}
