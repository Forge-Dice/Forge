import type { ResolvedCasePackage } from "../domain/case-package.ts";
import { initialSession, reduceSession, type SessionOutput, type SessionState } from "../domain/case-session.ts";
import { encodeSessionSave, loadSessionSaveForPlayer } from "../domain/case-session-save.ts";
import type { EvidenceObservation, PlayerClaim as EvidenceClaim } from "../domain/evidence-presentation.ts";
import type { InterrogationObservation, PlayerClaim } from "../domain/interrogation.ts";

// Text front end over the real session reducer. Pure: every command maps (game, line) to a new game
// and the text to print; file I/O lives in cli.ts. The player sees only PublicContent, released
// observations and labels of entities they already know. Every action goes through reduceSession.

/** clockOrigin: wall-clock seconds of timeline second 0 (display convention of the case). */
export type Game = { readonly pkg: ResolvedCasePackage; readonly state: SessionState; readonly clockOrigin: number };
export type Step = { readonly game: Game; readonly text: string; readonly quit?: true };
type Action = { readonly label: string; readonly event: unknown };


export const newGame = (pkg: ResolvedCasePackage, clockOrigin = 0): Game => ({ pkg, state: initialSession(pkg), clockOrigin });

const HELP = [
  "Befehle:",
  "  fall              Fallbeschreibung, Regeln und Auftrag",
  "  bekannt           alles, was du bisher kennst",
  "  untersuchen | u   mögliche Untersuchungen anzeigen; u <nr> ausführen",
  "  fragen | f        verfügbare Fragen anzeigen; f <nr> stellen",
  "  journal | j       alle bisherigen Funde und Aussagen",
  "  anklage | a       Verdächtige anzeigen; a <nr> anklagen",
  "  speichern [datei] Spielstand sichern; laden [datei] Spielstand laden",
  "  hilfe | ende",
].join("\n");

const ERRORS: Record<string, string> = {
  ACTION_UNAVAILABLE: "Das geht gerade nicht.",
  SESSION_CLOSED: "Der Fall ist bereits gelöst.",
  LIMIT_REACHED: "Das Aktionslimit dieses Falls ist erreicht.",
  HOST_FAILURE: "Technischer Fehler, die Aktion wurde nicht ausgeführt.",
};

export function intro(game: Game): string {
  const { publicContent } = game.pkg;
  return [`=== ${publicContent.title} ===`, "", publicContent.brief, "", `Auftrag: ${publicContent.challengeQuestion}`, "", "Tippe „hilfe“ für die Befehle."].join("\n");
}

export function command(game: Game, line: string): Step {
  const [word = "", arg] = line.trim().split(/\s+/, 2);
  const pick = arg === undefined ? null : Number.parseInt(arg, 10);
  const say = (text: string): Step => ({ game, text });
  switch (word.toLowerCase()) {
    case "":
      return say("");
    case "hilfe":
    case "?":
      return say(HELP);
    case "ende":
    case "quit":
      return { game, text: "Bis bald.", quit: true };
    case "fall":
      return say(caseText(game));
    case "bekannt":
      return say(knownText(game));
    case "journal":
    case "j":
      return say(journalText(game));
    case "untersuchen":
    case "u":
      return choose(game, investigations(game), pick, "Untersuchungen");
    case "fragen":
    case "f":
      return choose(game, questions(game), pick, "Fragen");
    case "anklage":
    case "a":
      return choose(game, accusations(game), pick, `Anklage. ${game.pkg.publicContent.challengeQuestion}`);
    default:
      return say(`Unbekannter Befehl „${word}“. Tippe „hilfe“.`);
  }
}

function choose(game: Game, actions: Action[], pick: number | null, title: string): Step {
  if (pick === null) {
    if (actions.length === 0) return { game, text: `${title}: gerade nichts verfügbar.` };
    return { game, text: [`${title}:`, ...actions.map((a, i) => `  ${i + 1}. ${a.label}`)].join("\n") };
  }
  const action = actions[pick - 1];
  if (action === undefined) return { game, text: `Keine Nummer ${pick}.` };
  const result = reduceSession(game.pkg, game.state, action.event);
  if (!result.ok) return { game, text: ERRORS[result.code]! };
  const next = { ...game, state: result.state };
  return { game: next, text: `> ${action.label}\n${outputText(next, result.output)}` };
}

// ---------- Actions offered from the prefix Known ----------

function known(game: Game, kind: string): { ref: string; label: string }[] {
  return game.state.knowledge.known.filter((k) => k.kind === kind).map((k) => ({ ref: k.ref, label: labelOf(game, k.ref) }));
}

function investigations(game: Game): Action[] {
  const offer = (kind: string, action: string, verb: string) =>
    known(game, kind).map(({ ref, label }) => ({ label: `${verb}: ${label}`, event: { type: "investigate", action, target: ref } }));
  return [
    ...offer("location", "search_location", "Ort durchsuchen"),
    ...offer("item", "examine_item", "Gegenstand untersuchen"),
    ...offer("person", "examine_person", "Person untersuchen"),
  ];
}

/** Questions of known NPCs that the session would accept now (a dry run changes nothing). */
function questions(game: Game): Action[] {
  const { pkg, state } = game;
  return known(game, "person").flatMap(({ ref, label }) => {
    const npcId = pkg.refs.resolve(ref)?.id;
    return pkg.publicContent.questionTexts
      .filter((q) => q.npc === npcId)
      .map((q) => ({ label: `${label}: ${q.text}`, event: { type: "interrogate", npc: ref, questionId: q.questionId } }))
      .filter((action) => state.phase === "active" && reduceSession(pkg, state, action.event).ok);
  });
}

/** D8 convention: one candidate true, every other candidate of the challenge false, all submitted together. */
function accusations(game: Game): Action[] {
  const { pkg } = game;
  const candidates = pkg.challenge.allowedClaims.filter((c) => c.kind === "personRoleForEvent" || c.kind === "personResponsibleForEvent");
  const ref = (kind: "person" | "event", id: string) => pkg.refs.refFor(kind, id)!;
  const claim = (c: (typeof candidates)[number]) => {
    const base = { kind: c.kind, person: ref("person", c.personId), event: ref("event", c.eventId) };
    return c.kind === "personRoleForEvent" ? { ...base, role: c.role } : base;
  };
  return candidates.map((chosen) => ({
    label: labelOf(game, ref("person", chosen.personId)),
    event: { type: "accuse", literals: candidates.map((c) => ({ claim: claim(c), value: c === chosen })) },
  }));
}

// ---------- Rendering ----------

function labelOf(game: Game, ref: string): string {
  const entity = game.pkg.refs.resolve(ref);
  const isKnown = game.state.knowledge.known.some((k) => k.ref === ref);
  const label = entity && game.pkg.publicContent.labels.find((l) => l.entity.kind === entity.kind && l.entity.id === entity.id);
  return isKnown && label ? label.label : "(unbekannt)";
}

const ROLES: Record<string, string> = { direct_actor: "eigenhändig handelnde Person", planner: "Planer", facilitator: "Helfer" };

function claimText(game: Game, claim: PlayerClaim | EvidenceClaim): string {
  const l = (ref: string) => labelOf(game, ref);
  const clock = (at: number) => {
    const s = game.clockOrigin + at;
    return [Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, "0")).join(":");
  };
  switch (claim.kind) {
    case "personAt":
      return `${l(claim.person)} war um ${clock(claim.at)} am Ort „${l(claim.location)}“`;
    case "eventHasParticipant":
      return `${l(claim.person)} war an „${l(claim.event)}“ beteiligt`;
    case "eventHasItem":
      return `„${l(claim.item)}“ spielte bei „${l(claim.event)}“ eine Rolle`;
    case "personResponsibleForEvent":
      return `${l(claim.person)} ist für „${l(claim.event)}“ verantwortlich`;
    case "personRoleForEvent":
      return `${l(claim.person)} war bei „${l(claim.event)}“ ${ROLES[claim.role]}`;
    case "noPersonResponsibleForEvent":
      return `niemand ist für „${l(claim.event)}“ verantwortlich`;
    case "eventCausedEvent":
      return `„${l(claim.causeEvent)}“ führte zu „${l(claim.event)}“`;
    case "eventIntent":
      return `„${l(claim.event)}“ war ${claim.value === "intended" ? "beabsichtigt" : claim.value === "unintended" ? "unbeabsichtigt" : "ohne Absicht zu bewerten"}`;
    case "eventMechanism":
      return `„${l(claim.event)}“ geschah ${claim.value === "ordinary" ? "auf natürliche Weise" : claim.value === "supernatural" ? "übernatürlich" : "teils übernatürlich"}`;
  }
}

function evidenceText(game: Game, o: EvidenceObservation): string {
  const lines = [`Fund: ${labelOf(game, o.evidence)}`, `  ${o.text}`];
  for (const report of o.reports) {
    const who = report.source.kind === "observation" ? "Beobachtung" : `Aussage von ${labelOf(game, report.source.person)}`;
    lines.push(`  ${who}: ${claimText(game, report.claim)} – ${report.stance === "affirms" ? "trifft zu" : "trifft nicht zu"}.`);
  }
  return lines.join("\n");
}

const STANCES: Record<string, string> = {
  affirms: "Ja.",
  denies: "Nein.",
  leans_affirms: "Ich glaube schon.",
  leans_denies: "Ich glaube eher nicht.",
  uncertain: "Da bin ich mir nicht sicher.",
  does_not_know: "Das weiß ich nicht.",
};

function answerText(game: Game, o: InterrogationObservation): string {
  const npcId = game.pkg.refs.resolve(o.npc)?.id;
  const question = game.pkg.publicContent.questionTexts.find((q) => q.npc === npcId && q.questionId === o.questionId);
  const head = `${labelOf(game, o.npc)} auf „${question?.text ?? o.questionId}“`;
  if (o.act === "decline") return `${head}: „Dazu sage ich nichts.“`;
  const said = `${head}: „${STANCES[o.stance]}“`;
  return "statement" in o ? `${said}\n  (zur Behauptung: ${claimText(game, o.statement)})` : said;
}

function outputText(game: Game, output: SessionOutput): string {
  switch (output.type) {
    case "investigate":
      return output.observations.length === 0 ? "Nichts Neues gefunden." : output.observations.map((o) => evidenceText(game, o)).join("\n");
    case "interrogate":
      return answerText(game, output.observation);
    case "accuse":
      return output.verdict === "solved"
        ? "Die Anklage sitzt. Fall gelöst!"
        : "Die Antwort erfüllt den Fallauftrag noch nicht. Ermittle weiter.";
  }
}

function caseText(game: Game): string {
  const { publicContent } = game.pkg;
  return [intro(game).replace("\n\nTippe „hilfe“ für die Befehle.", ""), "", "Regeln:", ...publicContent.publicRules.map((r) => `  - ${r.text}`)].join("\n");
}

function knownText(game: Game): string {
  const groups: [string, string][] = [["person", "Personen"], ["location", "Orte"], ["item", "Gegenstände"], ["event", "Ereignisse"], ["evidence", "Nachweise"]];
  return groups
    .map(([kind, title]) => `${title}: ${known(game, kind).map((k) => k.label).join(", ") || "–"}`)
    .join("\n");
}

function journalText(game: Game): string {
  const records = game.state.knowledge.observations;
  if (records.length === 0) return "Das Journal ist noch leer.";
  return records
    .map((r) => `[${r.source.eventIndex + 1}] ${r.source.kind === "evidence" ? evidenceText(game, r.observation as EvidenceObservation) : answerText(game, r.observation as InterrogationObservation)}`)
    .join("\n");
}

// ---------- Save / load: the Session C save format (MYST-SESSION-0001C) ----------

export function saveText(game: Game): { ok: true; text: string } | { ok: false; text: string } {
  const saved = encodeSessionSave(game.pkg, game.state);
  return saved.ok ? saved : { ok: false, text: "Der Spielstand konnte nicht gespeichert werden." };
}

/** Player facade: every failure reads the same; the save must be the exact canonical text. */
export function loadText(pkg: ResolvedCasePackage, text: string, clockOrigin = 0): { ok: true; game: Game } | { ok: false; text: string } {
  const loaded = loadSessionSaveForPlayer(pkg, text);
  return loaded.ok ? { ok: true, game: { pkg, state: loaded.state, clockOrigin } } : { ok: false, text: "Der Spielstand kann nicht geladen werden." };
}
