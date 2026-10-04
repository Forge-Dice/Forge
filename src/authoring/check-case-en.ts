// English wording of check-case's problem messages, for the case editor's English frame. check-case
// itself reports in German; each message is matched against its German template here.

type Template = readonly [RegExp, (...groups: string[]) => string];

const TEMPLATES: readonly Template[] = [
  [/^Weg (.+?): (.*)$/s, (route, rest) => `Route ${route}: ${problemText(rest, "en")}`],
  [/^erwartet (.*)$/s, (v) => `expected ${v}`],
  [/^Datei fehlt$/, () => "file missing"],
  [/^Datei fehlt im Arbeitsordner$/, () => "file missing in the working folder"],
  [/^kein gültiges JSON: (.*)$/s, (e) => `not valid JSON: ${e}`],
  [/^(\S+\.json) fehlt$/, (f) => `${f} is missing`],
  [/^Ordner nicht gefunden$/, () => "folder not found"],
  [/^keine NPCs: Befragungen sind nicht möglich$/, () => "no NPCs: interrogations are not possible"],
  [/^Dateiname passt nicht zu (.*)$/s, (id) => `file name does not match ${id}`],
  [/^refSalt muss ein String sein$/, () => "refSalt must be a string"],
  [/^PlayerRef-Index: (.*)$/s, (code) => `PlayerRef index: ${code}`],
  [/^kein Epilog: nach der gelösten Anklage erscheint keine erzählte Auflösung$/, () => "no epilogue: no narrated resolution appears after the solving accusation"],
  [/^Status (\S+), (\d+) Antwortvektoren bleiben möglich$/, (status, n) => `status ${status}, ${n} answer vectors remain possible`],
  [/^Prüfung abgebrochen: (.*)$/s, (e) => `check aborted: ${e}`],
  [/^der Grundtext \((.+?)\) hat sich seit der Übersetzung geändert: Übersetzung nachziehen, dann --fix$/, (f) => `the German text (${f}) changed since the translation: update the translation, then --fix`],
  [/^Übersetzung hat (\d+) statt (\d+) Einträge$/, (t, b) => `the translation has ${t} instead of ${b} entries`],
  [/^Übersetzung ist leer$/, () => "the translation is empty"],
  [/^Übersetzung enthält eine interne ID$/, () => "the translation contains an internal id"],
  [/^weicht vom Grundfall ab: eine Übersetzung ändert nur Texte$/, () => "differs from the German case: a translation changes texts only"],
  [/^Release-Kontext nicht berechenbar: (.*)$/s, (e) => `release context cannot be computed: ${e}`],
  [/^muss ein Objekt sein$/, () => "must be an object"],
  [/^\$playerRefOf verweist auf unbekanntes (\S+) „(.*)“$/s, (kind, id) => `$playerRefOf points to an unknown ${kind} “${id}”`],
  [/^veraltet: das Paket hat (\S+) \(--fix trägt ihn ein\)$/, (h) => `outdated: the package has ${h} (--fix fills it in)`],
  [/^veraltet: das Release-Manifest hat (\S+) \(--fix trägt ihn ein\)$/, (h) => `outdated: the release manifest has ${h} (--fix fills it in)`],
  [/^fehlt$/, () => "missing"],
  [/^Form ungültig$/, () => "invalid shape"],
  [/^Bindung passt nicht \(caseId, Hash oder Revision\)$/, () => "binding does not match (caseId, hash or revision)"],
  [/^verweist auf etwas, das es nicht gibt$/, () => "refers to something that does not exist"],
  [/^PlayerRef-Zuordnung ungültig$/, () => "invalid PlayerRef mapping"],
  [/^Grenze überschritten$/, () => "limit exceeded"],
  [/^Beweis passt nicht zum Paket$/, () => "proof does not match the package"],
  [/^Lügen gibt es erst ab Regelwerk (\S+)$/, (v) => `lies need ruleset ${v} or later`],
  [/^keine Lüge: der NPC weiß oder glaubt die Wahrheit nicht \(das wäre ein Irrtum, keine Lüge\)$/, () => "not a lie: the NPC does not know or believe the truth (that would be an error, not a lie)"],
  [
    /^die stepIds der Schritte müssen genau die Schritte der Wege sein/,
    () => "the steps' stepIds must be exactly the steps of the routes (proof-profile.json › witnessStepIds, then certificateData.routes), in the order of their first occurrence",
  ],
  [/^jeder Weg braucht eine eigene routeId/, () => "every route needs its own routeId, and “witness” is taken by witnessStepIds"],
  [/^jede Beobachtung des Profils braucht genau einen Eintrag im Manifest und umgekehrt$/, () => "every observation of the profile needs exactly one manifest entry and vice versa"],
  [/^Lösungsweg bricht bei „(.*)“ ab$/s, (step) => `the solution route breaks off at “${step}”`],
  [/^nach dem Lösungsweg ist (.*) dem Spieler noch unbekannt und kann nicht angeklagt werden$/s, (who) => `after the solution route ${who} is still unknown to the player and cannot be accused`],
  [/^nach dem Lösungsweg bietet das Spiel keine Anklage an$/, () => "after the solution route the game offers no accusation"],
  [/^keine Anklage, die das Spiel nach dem Lösungsweg anbietet, löst den Fall$/, () => "no accusation the game offers after the solution route solves the case"],
  [/^Feld nicht bearbeitbar$/, () => "field not editable"],
  [/^Regel nicht bearbeitbar$/, () => "rule not editable"],
];

/** The message in the editor's language; unknown messages stay as check-case wrote them. */
export function problemText(message: string, lang: string): string {
  if (lang !== "en") return message;
  for (const [pattern, english] of TEMPLATES) {
    const m = pattern.exec(message);
    if (m !== null) return english(...m.slice(1));
  }
  return message;
}
