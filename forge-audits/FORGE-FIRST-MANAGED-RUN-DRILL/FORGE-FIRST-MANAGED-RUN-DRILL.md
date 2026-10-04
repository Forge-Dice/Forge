# FORGE FIRST MANAGED RUN DRILL

| | |
|---|---|
| Datum | 2026-10-03 |
| Rolle | Read-only Drill-Design (keine Implementierung, keine Commits, keine PRs, keine Einstellungen geändert) |
| Repo | `Forge-Dice/Forge`, `main` = `3d7545d843883418348004e68717399a64da7a7d` (per `git ls-remote` geprüft) |
| Gemessene Baseline | Node 22.22.0, `npm ci --ignore-scripts` ok, `npm run typecheck` Exit 0 (1,7 s), `vitest run`: 22 Dateien, **1087 Tests grün** (18,9 s), lokal im Wegwerf-Checkout |
| Grundlagen | `FORGE-V0.1-HARDENING-PLAN.md` (HP, v. a. §6 P-03..P-06, §8), `FORGE-ORGANIZATION-MIGRATION-DELTA.md` (OMD), `FORGE-INDEPENDENT-VERIFIER-DESIGN.md` (VD), `FORGE-IDENTITY-GITHUB-PROTECTION.md` (IGP, §8–§10 Adapter) |
| Noch nicht vorhanden | `FORGE-V0.1-VERIFIER-IMPLEMENTATION-PACKAGE.md`, `FORGE-CONTRACT-SYSTEM-V2.md` (entstehen parallel). Alles, was davon abhängt, ist unten als **ANNAHME A-n** markiert und muss beim Lesen dieser Dokumente abgeglichen werden. |

**Belegkennzeichen:** `CODE` = im Repo gelesen · `MESS` = lokal ausgeführt · `DOK` = aus den Audit-Berichten oben · `ANNAHME` = hängt an noch nicht festgelegter Spezifikation.

## Kurzantwort

**Gewählter Drill: `FORGE-DRILL-0001` „Parse-Report für die Domain-Parser“.** Ein neues Modul `src/domain/parse-report.ts` macht die drei vorhandenen Domain-Parser (`CaseTruth`, `CaseSolution`, `NpcKnowledge`) ohne Exception nutzbar und liefert eine deterministische, sortierte Fehlerliste mit RFC-6901-Pfaden und darstellungssicheren Meldungen. Der Bedarf ist real: jede der drei Testdateien baut dafür heute einen eigenen Helfer (`tests/case-truth.test.ts:13`, `tests/case-solution.test.ts:25`, `tests/npc-knowledge.test.ts:34`), und Zod schreibt **rohe Schlüssel aus der Eingabe** inklusive Zeilenumbruch, NUL und U+202E (Trojan-Source-Zeichen) in seine Meldungen (`MESS`, §4.1).

Diff: genau zwei neue Dateien (`src/domain/parse-report.ts` ~80–110 Zeilen, `tests/parse-report.test.ts` ~160–230 Zeilen), keine Dependencies, keine Änderung an bestehendem Code, keine Mystery-Semantik, kein geschützter Pfad. Drei Contract-Mutanten, die alle eine typische, echte Fehlerklasse treffen (Escape-Reihenfolge, Bidi-Lücke, fehlende Sortierung).

**Design: GO. Ausführung heute: NO-GO**, weil auf `main` noch keine einzige Pipeline-Komponente existiert (kein `.github/`, keine Policy, kein Verifier, kein Mutanten-Feld im Contract-Schema; `CODE`) und drei Spezifikationslücken offen sind (Contract-Registrierung per Merge Commit, einheitliche Check-Namen, Handoff für Run n > 1). Details in §12.

---

## Annahmen (bis die Parallel-Dokumente vorliegen)

| # | Annahme | Quelle | Was sich ändert, wenn falsch |
|---|---|---|---|
| A-1 | Check-Namen: `forge-contract` (Contract-PR), `forge-gate` (Run-PR, liest nur Daten), `forge-verify` (Required Check, `pull_request_target`, Docker), `forge-approval` (Review-/Attestations-Prüfung). HP nennt nur `forge`/`forge-approval`, IGP vier Checks, OMD verlangt `forge-verify` im Ruleset. | HP D-14, IGP §8–§9, OMD §5 | Nur die Namen in §7–§9; die Erwartungen bleiben. |
| A-2 | Run-Branch `forge/run/codex/<TASK>-<n>`, Spec-Branch `forge/spec/<TASK>`. | OMD §5/§7, Memory | Branchnamen in §7/§9. |
| A-3 | Contract-Registrierung per **Merge Commit**: Registrierungs-Commit `R` auf `main`, `R^1` = altes `main`, jeder Commit in `R^1..R^2` hat genau einen Parent und berührt nur `forge/contracts/<TASK>.md`. Handoff-`contract_commit` = `R` (= `merge_commit_sha` des Contract-PRs). | OMD §9 B3, IGP §8 „Merge“ | Startpunkt des Developers und FI-10. **VD §4.5 bestimmt `C` heute als „jüngsten first-parent-Commit auf `main`, der den Pfad ändert“; das wäre `R` mit zwei Parents und würde mit `CONTRACT_COMMIT_NOT_LINEAR` fälschlich scheitern.** Dieser Drill ist der erste Contract, der so registriert wird, und prüft genau das. |
| A-4 | Contract-Frontmatter nach K-04 trägt eine Mutantenliste. Arbeitsform: `"mutants": [{ "id", "file", "before", "after", "tests" }]` (VD §9.3). Heute kennt `ContractMetadataSchema` nur `mutationSmoke: "none" \| "optional" \| "required"` (`src/forge/contract-document.ts:33`). | VD §9.3, HP K-04, `CODE` | Form des Frontmatters in §4.6; Inhalt der Mutanten bleibt. |
| A-5 | Geschützte Pfade nach HP K-01 / VD §6.1 (u. a. `.github/**`, `forge/**`, `src/forge/**`, `tests/forge/**`, `package*.json`, `tsconfig*.json`, `vitest.config.*`). `src/domain/**` und `tests/*.test.ts` außerhalb `tests/forge*` sind frei. | HP K-01, VD §6.1 | Wäre `src/domain/` geschützt, müsste der Drill nach `src/<neu>/` umziehen. |
| A-6 | Externe Reviews laufen über den Adapter (IGP §10): Review-Paket mit `headSha` + `packetHash`, Modell-Review mit Kopf `FORGE-REVIEW v1`, Attestation durch Seb als GitHub-Review mit Zeile `FORGE-ATTEST …`. | IGP §10, OMD §7 | Form von FI-05/FI-06. |
| A-7 | `allowedChecks` in `forge/policy.json`: `typecheck` = `npm run typecheck`, `test` = `npm test`; der Verifier führt trusted Implementierungen aus (VD §7.2). | HP P-02, VD §7.2 | `requiredChecks` im Contract. |
| A-8 | Halt-Schalter = deaktiviertes Ruleset `forge-halt`, nicht die Variable `FORGE_HALT`. | OMD §5, §9 B5 | FI-24. |

---

## 1. Five Candidates

Gesucht wurde im tatsächlichen Code von `3d7545d` nach kleinen Lücken **außerhalb** der Pfade, die nach K-01 geschützt sind. Das ist die wichtigste Randbedingung: Ein Drill unter `src/forge/**` wäre nach K-01 schon vom Contract-Parser abzulehnen, und er würde die Bibliothek verändern, mit der der Verifier selbst prüft. Damit bleibt `src/domain/` (Mystery-Code) oder ein neuer Pfad; „keine Mystery-Semantik“ heißt dann: nichts, was ändert, welche Fälle, Lösungen oder NPC-Snapshots akzeptiert werden oder wie sie gehasht werden.

Bewertung 1–5, jeweils 5 = am besten (bei Sicherheitsrisiko: 5 = geringstes Risiko).

| # | Kandidat | Befund im Code | Prod / Test | Scope | Determ. | Sicherh. | Testbar | Review-Befunde | Pipeline-Eignung | Σ | Ausschluss |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **D1** | **Parse-Report: nicht-werfende Domain-Parser mit sortierter, darstellungssicherer Fehlerliste** (neu: `src/domain/parse-report.ts`) | Drei identische Test-Helfer bauen Fehlerpfade per `JSON.stringify(issue.path)` (`tests/case-truth.test.ts:13–18`, `tests/case-solution.test.ts:25–29`, `tests/npc-knowledge.test.ts:34–38`); Zod-Meldungen enthalten rohe Eingabe-Schlüssel mit `\n`, `\u0000`, U+202E (`MESS`) | 80–110 / 160–230 | 5 | 5 | 5 | 5 | 4 | 4 | **28** | – |
| D2 | Kanonisierer fail-closed (`canonicalize` lehnt `undefined`, `NaN`, `Infinity`, Nicht-Plain-Objekte, dünn besetzte Arrays ab) | `src/domain/case-truth.identity.ts:17–29` und `case-solution.identity.ts:56–68` geben für Nicht-JSON-Werte still ungültiges oder kollidierendes JSON aus | 30–50 / 80–120 | 3 | 5 | 2 | 3 | 3 | 4 | 20 | Bedarf nur theoretisch: Eingaben sind gebrandete, von Zod geprüfte Snapshots; Tests brauchen Casts. Ändert den Hash-Codepfad, an dem jede `truthHash`-Bindung hängt. Verführt zur Zusammenlegung der zwei Kopien (Refactoring). |
| D3 | Fall-Inventar `summarizeCaseTruth(truth)` (Anzahl je Entitätstyp + Hash + Profil, für Handy-Review und Logs) | Kein Code fasst einen Fall kurz zusammen | 40–60 / 60–100 | 5 | 5 | 5 | 4 | 1 | 3 | 23 | Bedarf erfunden; zu trivial, um einen Reviewer zu fordern (Review-Pfad wird nicht ernsthaft getestet). |
| D4 | Domain-Text-Hygiene: `TextSchema` in `case-truth.ts` lehnt Steuerzeichen, Bidi und einzelne Surrogate ab | `src/domain/case-truth.ts:45` akzeptiert `"‮"`-haltige Namen und Titel | 20–40 / 100–160 | 3 | 5 | 3 | 5 | 4 | 4 | 24 | **Mystery-Semantik**: ändert, welche Fälle gültig sind; berührt Fixtures und Hash-Erwartungen; überschneidet sich mit HP K-02. |
| D5 | Dubletten zusammenlegen (`TruthHashSchema` in `case-solution.ts:36`, `Sha256Schema` in `npc-knowledge.ts`, zwei `TextSchema`, zwei `canonicalize`) | Echte Dubletten | 40–70 netto / 40–80 | 3 | 5 | 3 | 2 | 2 | 4 | 19 | **Refactoring**; Verhaltensgleichheit lässt sich nur indirekt testen; vier `modify`-Dateien. |
| D6 | HP-§8.5-Platzhalter: `src/domain/drill.ts` mit einer beliebigen kleinen Funktion | – | 20–40 / 40–80 | 5 | 5 | 5 | 3 | 1 | 3 | 22 | Kein echter Bedarf; liefert dem Reviewer nichts zu finden. |

**Was kein Kandidat abdeckt:** einen positiven `scope.modify`-Pfad mit Mutant auf einer bestehenden Datei (`find` muss am `baseCommit` genau einmal vorkommen, HP P-03 (9)). Nur D2/D4/D5 hätten ihn, alle drei verletzen eine Vorgabe. Der `modify`-Pfad wird deshalb hier nur negativ getestet (FI-03b) und positiv erst im ersten echten Task (Accusation & Verdict ändert `src/domain/case-solution.ts`).

---

## 2. Selected Drill

| Feld | Wert |
|---|---|
| Task-ID | `FORGE-DRILL-0001` (erfüllt `TaskIdSchema`, `src/forge/primitives.ts:9–12`) |
| Titel | Parse-Report für die Domain-Parser |
| Contract-Pfad | `forge/contracts/FORGE-DRILL-0001.md` (`contractPathFor`, `src/forge/contract-document.ts:17`) |
| Scope | `create`: `src/domain/parse-report.ts`, `tests/parse-report.test.ts` · `modify`: keiner |
| Required Checks | `typecheck` = `npm run typecheck`, `test` = `npm test` (A-7) |
| Mutanten | 3 (M-PTR-ESCAPE-ORDER, M-BIDI-RANGE, M-SORT-REMOVED, §4.5) |
| Dependencies | keine |
| Spec-Autor | `forge-codex` |
| Architektur-Reviewer | ChatGPT über Adapter, attestiert von Seb (GitHub-Approval als `Wuerfelduell`) |
| Developer | `forge-codex` |
| Verifier | GitHub Actions, Workflow aus `main` (`forge-gate`, `forge-verify`) |
| Code-Reviewer | Claude in einer Session **ohne** Zugriff auf diese Projektdateien, ersatzweise Grok; über Adapter, attestiert von Seb |
| Merge | Seb, Merge Commit, vom Android-Handy |

Rollenbegründung: Seb kann einen eigenen PR auf GitHub nicht approven, und ein Approval durch `forge-codex` auf Sebs Contract-PR würde den Developer zum Architektur-Approver machen (E-14). Deshalb schreibt `forge-codex` den Contract-PR, und Sebs Code-Owner-Approval (nach attestiertem ChatGPT-Review) ist die unabhängige Freigabe. Spec-Autor = Developer ist nach HP P-05 ausdrücklich erlaubt. Die Mutanten wählt damit formal der Developer (E-05); entschärft dadurch, dass sie in diesem Plan festgelegt sind und der Architektur-Reviewer sie gegen die Spec prüft. Die Reviewer bekommen dieses Dokument **nicht**, damit §10.3 als Kalibrierung taugt.

---

## 3. Why

1. **Echter, kleiner Bedarf ohne Fachrisiko.** Der Code fügt nur eine Schicht über drei vorhandene Parser hinzu. Kein bestehender Byte ändert sich; was als gültiger Fall, gültige Lösung oder gültiger NPC-Snapshot gilt, bleibt exakt gleich (Paritätstests erzwingen das, AC-09/AC-10).
2. **Vollständig deterministisch.** Reine Funktionen, keine Zeit, kein Zufall, kein Netz, kein Dateisystem; Ergebnis hängt nur von der Eingabe und der per Lockfile fixierten Zod-Version (4.6.5) ab.
3. **Kein Sicherheitsrisiko, aber ein Sicherheitsthema.** Der Code hebt keine Grenze auf, er schließt eine kleine: Fehlermeldungen mit U+202E oder Zeilenumbrüchen aus Eingabeschlüsseln können eine Handy- oder Log-Ansicht verfälschen. Das gibt dem Reviewer echten Stoff, ohne dass ein Fehler im Drill etwas Gefährliches nach `main` bringt.
4. **Gute Mutanten.** Alle drei treffen Fehler, die in echten RFC-6901- und Sanitizer-Implementierungen vorkommen; jeder lässt sich nur mit einem gezielten Test töten. Ein Developer, der „Tests für die Abdeckung“ schreibt, lässt mindestens einen überleben (M1-Nachstellung, FI-07).
5. **Wahrscheinliche echte Review-Befunde** (Escape-Reihenfolge, Injektivität der Darstellung, lexikografische statt numerische Index-Sortierung, roher vs. bereinigter Pointer, verschachtelte Union-Fehler). Dadurch lässt sich auch der Rework-Zyklus (Request Changes → neuer Push → stale Review) natürlich üben.
6. **Ideal für Contract/Verifier/Review/Merge.** Zwei `create`-Dateien, 100644, unter freien Pfaden; jede Abweichung (dritte Datei, geschützter Pfad, Modus, Case-Kollision) ist eindeutig ein Verstoß. Der Testlauf bleibt kurz (die Suite braucht heute ~19 s; die neuen reinen Funktionstests kommen voraussichtlich mit weniger als einer Sekunde dazu, geschätzt), Mutanten-Jobs bleiben billig.
7. **Danach funktional prüfbar** mit einem Einzeiler auf `main` (§7.5), Ausgabe exakt vorhersagbar.

---

## 4. Functional Spec

Diese Spec ist die fachliche Eingabe für den Spec-Autor. Der verbindliche Text ist später ausschließlich der Contract in Git.

### 4.1 Problem (belegt)

- `MESS`: `CaseTruthSchema.safeParse({ "a/b~c‮": 1 })` liefert 16 Issues, darunter `unrecognized_keys` mit Pfad `[]` und Meldung `Unrecognized key: "a/b~c‮"` (rohes U+202E). Ein Schlüssel `"evil‮\nkey"` landet roh mit Zeilenumbruch in der Meldung; `"x\u0000y"` mit NUL.
- `MESS`: Record-Schlüssel wie `"a/b~c"` und `""` erscheinen roh im Pfad; `JSON.stringify(path)` ist zwar eindeutig, aber kein Standardformat und für Menschen schwer zu lesen.
- `MESS`: Zod meldet Issues in Schema-Reihenfolge (`/schemaVersion` vor `/caseId`), nicht in einer stabilen, vom Schema unabhängigen Reihenfolge.
- `MESS`: Ein Getter, der wirft, wird von `safeParse` nicht abgefangen (`threw boom`); das Verhalten bei Nicht-Zod-Fehlern muss also festgelegt werden.
- `CODE`: Die Domain-Parser werfen (`parseCaseTruth`, `parseCaseSolution`, `parseNpcKnowledge`); der Forge-Kern benutzt dagegen Ergebnisobjekte (`{ ok: true … } | { ok: false, issues }`, `src/forge/contract-document.ts:79–81`).

### 4.2 Modul und Exporte

Neue Datei `src/domain/parse-report.ts`. Importe nur aus `./case-truth.ts`, `./case-solution.ts`, `./npc-knowledge.ts` und `import type` aus `zod`. **Keine** Importe aus `src/forge/**`, keine `node:*`-Module, keine neuen Dependencies, keine Änderung an bestehenden Dateien.

```ts
export type ParseIssue = {
  readonly pointer: string;   // exakter RFC-6901-Pointer, roh
  readonly code: string;      // Zod-Issue-Code, unverändert
  readonly message: string;   // Zod-Meldung, darstellungssicher (escapeForDisplay)
};

export type ParseReport<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ParseIssue[] };

export function issuePointer(path: readonly PropertyKey[]): string;
export function escapeForDisplay(text: string): string;
export function compareParseIssues(a: ParseIssue, b: ParseIssue): number;
export function toParseIssues(
  issues: readonly { readonly path: readonly PropertyKey[]; readonly code: string; readonly message: string }[],
): readonly ParseIssue[];
export function reportCaseTruth(input: unknown): ParseReport<CaseTruth>;
export function reportCaseSolution(input: unknown, truth: CaseTruth): ParseReport<CaseSolution>;
export function reportNpcKnowledge(input: unknown, truth: CaseTruth, solution: CaseSolution | null): ParseReport<NpcKnowledgeSnapshot>;
export function formatParseIssues(issues: readonly ParseIssue[]): string;
```

### 4.3 Regeln

**R1 `issuePointer`** (RFC 6901, Abschnitt 3 und 4):
- Leerer Pfad → `""` (Wurzel).
- Jedes Segment wird als `"/" + token` angehängt.
- String-Segment: zuerst jedes `~` → `~0`, **danach** jedes `/` → `~1`. Sonst unverändert (keine Bereinigung, keine Normalisierung).
- Zahl-Segment: nur nicht-negative sichere Ganzzahlen (`Number.isSafeInteger(n) && n >= 0`; `-0` ergibt `"0"`), dezimal ohne führende Nullen.
- Symbol-Segment oder ungültige Zahl (`-1`, `1.5`, `NaN`, `2**53`) → `TypeError`. (Die drei Domain-Schemas erzeugen keine solchen Segmente; die Regel betrifft nur direkte Aufrufe.)
- Bekannte, gewollte Mehrdeutigkeit von RFC 6901: Index `0` und Schlüssel `"0"` ergeben beide `/0`. Dokumentieren, nicht „reparieren“.

**R2 `escapeForDisplay`**: Ersetzt jeden Codepunkt aus der Menge **S** durch `\u{XXXX}` (Großbuchstaben-Hex, mindestens 4 Stellen); alles andere bleibt unverändert, gültige Surrogatpaare (z. B. 😀) und Nicht-ASCII-Buchstaben (äöü) inklusive.
S = U+0000–U+001F, U+005C (`\`), U+007F–U+009F, U+200E–U+200F, U+2028–U+202E, U+2066–U+2069, U+FEFF, einzelne Surrogate U+D800–U+DFFF.
Der Backslash ist in S, damit die Abbildung **injektiv** bleibt: Ein echter Zeilenumbruch und der Text `\u{000A}` dürfen nicht gleich aussehen.

**R3 `toParseIssues`**: Bildet jedes Zod-Issue auf `{ pointer: issuePointer(path), code, message: escapeForDisplay(message) }` ab und sortiert mit `compareParseIssues`. Keine Deduplizierung (Anzahl = Anzahl Zod-Issues), kein Aufklappen verschachtelter `invalid_union`-Fehler (nur die oberste Ebene). Das Eingabe-Array und seine Objekte werden nicht verändert (eingefrorene Eingabe muss funktionieren).

**R4 `compareParseIssues`**: Ordnung nach `pointer`, dann `code`, dann `message`, jeweils nach UTF-16-Code-Units (wie `compareCodeUnits` im Kern, aber ohne Import aus `src/forge`); niemals `localeCompare`. Gewollte Folge: `/B` < `/a` und `/persons/10` < `/persons/2`.

**R5 `report*`**: Rufen `safeParse` des jeweiligen Schemas auf (`CaseTruthSchema`, `createCaseSolutionSchema(truth)`, `createNpcKnowledgeSchema(truth, solution)`).
- Erfolg → `{ ok: true, value }` mit dem unveränderten Schema-Ergebnis (bereits tief eingefroren und gebrandet).
- Zod-Fehler → `{ ok: false, issues: toParseIssues(error.issues) }`, `issues.length ≥ 1`.
- Jede andere Exception (z. B. aus einem Getter der Eingabe) wird **nicht** abgefangen und kommt als dasselbe Objekt beim Aufrufer an.
- Ergebnisobjekt, `issues`-Array und jedes Issue sind eingefroren.

**R6 `formatParseIssues`**: Eine Zeile je Issue, getrennt durch `\n`, ohne abschließenden Zeilenumbruch; leere Liste → `""`. Zeile = `<anzeigePointer> <code>: <message>`, wobei `anzeigePointer` = `(root)` für `""`, sonst `escapeForDisplay(pointer)`. Kollisionsfrei, weil jeder Nicht-Wurzel-Pointer mit `/` beginnt.

### 4.4 Nicht-Ziele (gehören ausdrücklich nicht in den Diff)

Bestehende Test-Helfer umstellen (Refactoring, zudem `modify` außerhalb des Scopes); Zod-Meldungen umformulieren oder übersetzen; verschachtelte Union-Fehler aufklappen; JSON-Pointer parsen oder auflösen; numerische Index-Sortierung; Index-Datei oder CLI; Änderungen an `parseCaseTruth`/`parseCaseSolution`/`parseNpcKnowledge`; weitere Zeichen in S (z. B. U+200B–U+200D; sichtbar als bekannte Grenze dokumentieren).

### 4.5 Mutationsanker und Contract-Mutanten

Weil `parse-report.ts` neu entsteht, müssen die Mutanten auf festen Ankertext zeigen. Der Contract schreibt deshalb vor, dass die Datei jeden Anker **genau einmal** enthält (HP P-06 (4): `find` genau einmal, sonst `not_applied`):

| ID | Anker (`before`) | Ersatz (`after`) | Was er nachstellt | Muss gefangen werden von |
|---|---|---|---|---|
| M-PTR-ESCAPE-ORDER | `.replaceAll("~", "~0").replaceAll("/", "~1")` | `.replaceAll("/", "~1").replaceAll("~", "~0")` | klassischer RFC-6901-Fehler: `a/b` → `/a~01b` statt `/a~1b` | `tests/parse-report.test.ts` (AT-01, Fall `a/b`) |
| M-BIDI-RANGE | ` -‮` (im Regex-Literal von S) | ` -‭` | Lücke genau beim Right-to-Left-Override | `tests/parse-report.test.ts` (AT-03/AT-04) |
| M-SORT-REMOVED | `.sort(compareParseIssues)` | `` (leer) | Ausgabe in Zod-Reihenfolge statt stabil | `tests/parse-report.test.ts` (AT-05/AT-11) |

`MESS`: Für die Eingabe `"~1"` liefern Original und M-PTR-ESCAPE-ORDER **beide** `~01`. Ein Test nur mit `~`-Fällen tötet den Mutanten nicht; der Fall `a/b` ist Pflicht.

### 4.6 Contract-Skizze (Form nach A-4, Inhalt verbindlich)

```text
---json
{
  "forgeContractFormat": 1,
  "taskId": "FORGE-DRILL-0001",
  "contractVersion": 1,
  "baseCommit": "<main-Head zum Zeitpunkt des Contract-PR>",
  "dependencies": [],
  "scope": {
    "create": [
      "src/domain/parse-report.ts",
      "tests/parse-report.test.ts"
    ],
    "modify": []
  },
  "requiredChecks": [
    { … "name": "typecheck", "command": "npm run typecheck" … },
    { … "name": "test", "command": "npm test" … }
  ],
  "mutants": [ … drei Einträge aus §4.5, "tests": ["tests/parse-report.test.ts"] … ]
}
---
# FORGE-DRILL-0001 Parse-Report für die Domain-Parser
… Ziel, §4.2–§4.5, Acceptance Criteria §5, Adversarial Tests, Nicht-Ziele …
<!-- END OF CONTRACT FORGE-DRILL-0001 v1 -->
```

Formvorgaben, die der Parser heute schon erzwingt (`CODE`, `src/forge/contract-document.ts:104–145`): LF only, kein BOM, Frontmatter beginnt mit `---json\n`, JSON exakt gleich `JSON.stringify(parsed, null, 2)` (die Skizze oben ist wegen `…` absichtlich nicht kanonisch), Hash = SHA-256 über `forge-contract-v1\n` + Text. End-Marker als letzte Zeile nach HP P-03 (4).

---

## 5. Acceptance Criteria

| AC | Kriterium | Prüfung |
|---|---|---|
| AC-01 | Diff gegen die Merge-Base enthält genau `A src/domain/parse-report.ts` und `A tests/parse-report.test.ts`, beide Modus `100644`. | Verifier-Diff (§6) |
| AC-02 | `npm run typecheck` und `npm test` grün unter Konfiguration aus `main`; Testinventar `total ≥ baselineTotal + 16`, `failed = skipped = todo = 0`. | `forge-verify` |
| AC-03 | `issuePointer` erfüllt R1 inklusive aller Fälle aus AT-01/AT-02. | Unit-Tests |
| AC-04 | `escapeForDisplay` erfüllt R2: jeder Codepunkt aus S wird ersetzt, nichts außerhalb von S; injektiv auf den Testfällen. | AT-03 |
| AC-05 | Kein Rohzeichen aus S erscheint in `message` eines `ParseIssue` oder in der Ausgabe von `formatParseIssues`. | AT-04, AT-13 |
| AC-06 | Sortierung nach R4, unabhängig von der Eingangsreihenfolge. | AT-05, AT-06 |
| AC-07 | Eingabe von `toParseIssues` bleibt unverändert, eingefrorene Eingabe funktioniert; Ausgabe ist eingefroren (Report, Array, jedes Issue). | AT-07, AT-08 |
| AC-08 | Keine Deduplizierung, kein Aufklappen von Unions: `issues.length === error.issues.length`. | AT-09, AT-15 |
| AC-09 | Parität `CaseTruth`: für die gültige Fixture und mindestens 10 Ablehnungsvarianten gilt `report.ok === safeParse.success`, und die Pointer-Multimenge entspricht `error.issues.map(i => issuePointer(i.path))`. | AT-09 |
| AC-10 | Parität für `CaseSolution` und `NpcKnowledge` mit gebundenen Schemas, inklusive `truthHash`-Fehlbindung. | AT-10 |
| AC-11 | `reportCaseTruth({})` liefert exakt 15 Issues in der Reihenfolge aus §7.5. | AT-11 |
| AC-12 | Nicht-Zod-Exceptions werden als dasselbe Objekt durchgereicht. | AT-12 |
| AC-13 | Erfolgsfall: `value` ist eingefroren, `toEqual(parseCaseTruth(x))`, gleicher `hashCaseTruth`. | AT-14 |
| AC-14 | Deterministisch: zwei Aufrufe liefern tief gleiche Reports und identisches `JSON.stringify`. | AT-16 |
| AC-15 | Jeder Mutationsanker aus §4.5 kommt in `src/domain/parse-report.ts` genau einmal vor; alle drei Contract-Mutanten werden von `tests/parse-report.test.ts` getötet. | `forge-verify` (Contract Mutants 3/3) |
| AC-16 | Keine Importe aus `src/forge/**`, keine `node:*`-Importe, `zod` nur als `import type`. | Review + `grep` |
| AC-17 | Bestehende 1087 Tests (oder die Zahl am `baseCommit`) bleiben unverändert grün; keine bestehende Datei geändert. | Inventar + Diff |

### Adversarial Tests (Pflicht im Contract)

| AT | Eingabe | Erwartung |
|---|---|---|
| AT-01 | `issuePointer([])`, `["a/b"]`, `["~"]`, `["~1"]`, `["a~/b"]`, `[""]`, `["", ""]`, `[0, "x"]`, `["0"]`, `[-0]` | `""`, `/a~1b`, `/~0`, `/~01`, `/a~0~1b`, `/`, `//`, `/0/x`, `/0`, `/0` |
| AT-02 | `issuePointer([Symbol("s")])`, `[-1]`, `[1.5]`, `[NaN]`, `[2**53]` | jeweils `TypeError` |
| AT-03 | `escapeForDisplay` für je einen Vertreter jeder Teilmenge von S (`\n`, `\u0000`, `\\`, `\u007F`, `\u0085`, `‎`, ` `, `‮`, `⁦`, `﻿`, `"\uD800"`, `"\uDC00"`); dazu `"😀"`, `"äöü"`, `"\\u{000A}"` | `\u{000A}`, `\u{0000}`, `\u{005C}`, …, `\u{202E}`, …, `\u{D800}`, `\u{DC00}`; 😀 und äöü unverändert; `escapeForDisplay("\n") !== escapeForDisplay("\\u{000A}")` |
| AT-04 | `reportCaseTruth({ "evil‮\nkey": 1, "x\u0000y": 2 })` | kein Rohzeichen aus S in irgendeinem `message` |
| AT-05 | `toParseIssues` mit synthetischen Pfaden `["a"]`, `["B"]`, `["persons", 10]`, `["persons", 2]`, `[]` | Reihenfolge `""`, `/B`, `/a`, `/persons/10`, `/persons/2`; Gleichstand nach `code`, dann `message` |
| AT-06 | dieselbe Liste umgekehrt | identisches Ergebnis |
| AT-07 | `Object.freeze`-Array mit eingefrorenen Issues | kein Wurf, Eingabe danach unverändert |
| AT-08 | `push`/Zuweisung auf Report, Array, Issue | `TypeError` (Strict Mode) |
| AT-09 | Paritätsliste aus `tests/case-truth.fixture.ts` (gültig + ≥ 10 Varianten) | AC-09 |
| AT-10 | Paritätslisten aus den Solution- und NPC-Fixtures, inkl. falschem `truthHash` | AC-10 |
| AT-11 | `reportCaseTruth({})` | 15 Issues exakt wie §7.5 (Pointer, Code, Meldung) |
| AT-12 | Eingabe mit Getter `get caseId() { throw err }` | `reportCaseTruth` wirft genau `err` |
| AT-13 | `formatParseIssues` mit Wurzel-Issue, Pointer `/a‮b`, leerer Liste | `(root) …`, Anzeige `/a\u{202E}b` bei rohem `issue.pointer`, `""`; kein abschließendes `\n` |
| AT-14 | gültige Fixture | `ok: true`, `Object.isFrozen(value)`, `toEqual(parseCaseTruth(x))`, Hash gleich |
| AT-15 | zwei identische synthetische Issues | zwei Einträge |
| AT-16 | zweimal derselbe ungültige Input | `toEqual` und identisches `JSON.stringify` |

---

## 6. Expected Diff

**Erwarteter Verifier-Diff** (`git diff --raw --no-renames -z --abbrev=40 <B> <H>`, `B` = Merge-Base mit `main`):

```text
:000000 100644 0000000000000000000000000000000000000000 <blob-a> A	src/domain/parse-report.ts
:000000 100644 0000000000000000000000000000000000000000 <blob-b> A	tests/parse-report.test.ts
```

| Datei | Status | Zeilen (Schätzung) | Inhalt |
|---|---|---|---|
| `src/domain/parse-report.ts` | A | 80–110 | Typen ~10, `escapeForDisplay` + Regex ~8, `issuePointer` ~15, `compareParseIssues` ~8, `toParseIssues` ~10, drei `report*` + gemeinsamer Helfer ~20, `formatParseIssues` ~8, Kopfkommentar |
| `tests/parse-report.test.ts` | A | 160–230 | AT-01..AT-16 in ~6 `describe`-Blöcken, ~16–25 `it` |

**Nicht erwartet (jede Zeile wäre ein Befund):** jede dritte Datei; jede Änderung an bestehenden Dateien (auch Test-Helfer); `package.json`/Lockfile; `vitest.config.*`; `.github/**`; `forge/**`; Modus ≠ 100644; Umbenennungen; Löschungen; Importe aus `src/forge`.

**Erwartete Evidence-Kernwerte** (VD §8): `diff.entryCount = 2`; `tree.forbiddenModes = []`, `caseCollisions = []`; `checks[typecheck].exitCode = 0`, `checks[test].exitCode = 0`; `inventory.total = baselineTotal + Anzahl neuer Tests`, `files = baselineFiles + 1`; `mutations`: 3 Einträge, je `applied: 1`, `outcome: "detected"`, `killedBy` aus `tests/parse-report.test.ts`, `loadErrors: 0`; `result.passed = true`; Summary „Contract Mutants: 3/3 killed“.

**Nach dem Owner-Merge** (Merge Commit `A`): `A^1` = `main` vor dem Merge, `A^2` = verifizierter Head `H`, `tree(A) == tree(H)`, `git diff --raw --no-renames A^1 A` zeigt genau die zwei Zeilen oben.

---

## 7. Verification Commands

### 7.1 Developer (`forge-codex`, nur aus Handoff + Rollenvorlage)

```bash
git fetch origin
git checkout --detach <contract_commit>             # = R, aus dem Handoff kopiert (A-3)
git switch -c forge/run/codex/FORGE-DRILL-0001-<n>
git cat-file -p <R>:forge/contracts/FORGE-DRILL-0001.md          # Contract nur aus Git lesen

# Read-Quittung (HP P-04 (3)/(4))
git rev-parse <R>:forge/contracts/FORGE-DRILL-0001.md           # contract_blob
{ printf 'forge-contract-v1\n'; git cat-file -p <R>:forge/contracts/FORGE-DRILL-0001.md; } | sha256sum   # content_hash
git cat-file -p <R>:forge/contracts/FORGE-DRILL-0001.md | wc -c  # byte_count
git cat-file -p <R>:forge/contracts/FORGE-DRILL-0001.md | tail -n 1   # end_marker

npm ci --ignore-scripts
npm run typecheck
npx vitest run tests/parse-report.test.ts
npm test
grep -c -F '.replaceAll("~", "~0").replaceAll("/", "~1")' src/domain/parse-report.ts   # 1
grep -c -F ' -‮' src/domain/parse-report.ts                                 # 1
grep -c -F '.sort(compareParseIssues)' src/domain/parse-report.ts                     # 1
git diff --raw --no-renames <R> HEAD                 # genau zwei A-Zeilen, 100644
git push -u origin forge/run/codex/FORGE-DRILL-0001-<n>   # nie --force
# Draft-PR gegen main, Body = FORGE READ RECEIPT v1 + Developer-Report (Behauptungen)
```

### 7.2 Verifier (Workflow aus `main`; Referenz, nicht vom Developer ausgeführt)

Ablauf nach VD §4–§9 bzw. dem Implementation Package (A-1): trusted Checkout von `main`, PR-Head nur über `refs/pull/<N>/head`, `GIT_NO_REPLACE_OBJECTS=1`, Merge-Base `B`, Contract an `B` lesen und parsen, Diff wie §6, Pfad-/Modusregeln, `git archive` in den Container, `npm ci --ignore-scripts`, `tsc --noEmit`, `vitest run --config /trusted/… --reporter=json`, je Mutant ein Container-Lauf, Aggregation über `evaluateVerification`.

### 7.3 Contract-Registrierung prüfen (Seb oder Reviewer, nach Merge des Contract-PRs)

```bash
R=<merge_commit_sha des Contract-PRs>
git rev-list --parents -n1 "$R"                         # 3 Wörter: R, R^1, R^2
git diff --raw --no-renames "$R^1" "$R"                 # nur: A forge/contracts/FORGE-DRILL-0001.md
for c in $(git rev-list "$R^1..$R^2"); do
  test "$(git rev-list --parents -n1 "$c" | wc -w)" = 2 || echo "NICHT LINEAR $c"
  git diff --raw --no-renames "$c^" "$c" | grep -v 'forge/contracts/FORGE-DRILL-0001.md$' && echo "FREMDE DATEI in $c"
done
```

### 7.4 Externer Reviewer (nur lesen)

```bash
git fetch origin refs/pull/<N>/head && git rev-parse FETCH_HEAD     # muss headSha aus dem Paket sein
git diff --raw --no-renames <mergeBaseSha> <headSha>
# oder ohne Git: https://github.com/Forge-Dice/Forge/compare/<mergeBaseSha>...<headSha>.diff
#                https://raw.githubusercontent.com/Forge-Dice/Forge/<headSha>/src/domain/parse-report.ts
```

### 7.5 Funktionsprüfung nach dem Merge (Seb, jede Maschine mit Node ≥ 22)

```bash
git clone https://github.com/Forge-Dice/Forge && cd Forge && git checkout <A>
npm ci --ignore-scripts && npm test
node --input-type=module -e '
import { reportCaseTruth, formatParseIssues } from "./src/domain/parse-report.ts";
const r = reportCaseTruth({ "a/b~c‮": 1 });
console.log(r.ok, r.issues.length);
console.log(formatParseIssues(r.issues));'
```

`MESS` (Mechanik mit Node 22.22.0 geprüft: `.ts`-Import per `-e` funktioniert; Zod-Ausgabe für diese Eingabe gemessen). Erwartete Ausgabe:

```text
false 16
(root) unrecognized_keys: Unrecognized key: "a/b~c\u{202E}"
/caseId invalid_type: Invalid input: expected string, received undefined
/events invalid_type: Invalid input: expected array, received undefined
/evidence invalid_type: Invalid input: expected array, received undefined
/items invalid_type: Invalid input: expected array, received undefined
/locations invalid_type: Invalid input: expected array, received undefined
/motives invalid_type: Invalid input: expected array, received undefined
/persons invalid_type: Invalid input: expected array, received undefined
/propositions invalid_type: Invalid input: expected array, received undefined
/redHerrings invalid_type: Invalid input: expected array, received undefined
/relationships invalid_type: Invalid input: expected array, received undefined
/revision invalid_type: Invalid input: expected number, received undefined
/schemaVersion invalid_value: Invalid input: expected 1
/secrets invalid_type: Invalid input: expected array, received undefined
/timeline invalid_type: Invalid input: expected object, received undefined
/title invalid_type: Invalid input: expected string, received undefined
```

Ohne die erste Zeile ist das genau die Erwartung von AT-11 für `reportCaseTruth({})` (15 Issues). Zod liefert dieselben Issues in Schema-Reihenfolge (`/schemaVersion` zuerst); die sortierte Ausgabe beweist R4 am echten Objekt.

### 7.6 Merge-Invarianten (nach dem Run-Merge)

```bash
A=$(git rev-parse origin/main)
test "$(git rev-parse "$A^1")" = <main vor dem Merge>
test "$(git rev-parse "$A^2")" = <H aus der Evidence>
test "$(git rev-parse "$A^{tree}")" = "$(git rev-parse "<H>^{tree}")"
git diff --raw --no-renames "$A^1" "$A"
```

---

## 8. Failure Injection Plan

Grundsatz: Jede Injektion hat eine vorab festgelegte Erwartung. **Reagiert Forge anders als erwartet (vor allem: grün, wo rot erwartet wird), stoppt der Drill**, der Befund bekommt eine ID `DRILL-F-nn`, und der erste echte Task startet erst nach der Korrektur. Keine Injektion wird mit echten Secrets, gegen `main` direkt oder gegen fremde Repos ausgeführt. Codes sind die aus HP/VD; endgültige Namen kommen aus dem Implementation Package (A-1).

**Ort der Injektionen:** Contract-Injektionen auf eigenen Wegwerf-Task-IDs `FORGE-DRILL-0901` ff. (nie gemergt). Run-Injektionen im **Störlauf** `forge/run/codex/FORGE-DRILL-0001-1` (wird geschlossen, nie gemergt), damit die Merge-Commit-Historie von `main` keine Injektions-Commits erbt. Review-Injektionen im **Abnahmelauf** `…-2`, weil sie einen echten Review-Zyklus brauchen.

### 8.1 P0 (Pflicht im Drill)

| ID | Phase | Injektion (wer, was genau) | Erwartete Reaktion | Beleg |
|---|---|---|---|---|
| FI-01 | Störlauf | **Developer ändert geschützten Pfad.** Je ein Push + Revert-Push: (a) Kommentarzeile in `.github/workflows/forge-verify.yml`; (b) `"left-pad"` in `package.json` `devDependencies`; (c) eine Zeile in `forge/contracts/FORGE-DRILL-0001.md`; (d) Kommentar in `src/forge/verification.ts` | `forge-gate`/`forge-verify` rot: `PROTECTED_PATH_CHANGED` (a–d), zusätzlich `SCOPE_VIOLATION`; bei (a) zeigt die Evidence `workflow.ref …@refs/heads/main` und den unveränderten `workflow.sha`; kein Prüflingscode lief (Preflight endet vor `npm ci`) | Check-Summary, Evidence `workflow.sha`, Job-Log ohne Container-Schritte |
| FI-02 | Störlauf | **Falscher Contract-Hash.** READ RECEIPT im PR-Body mit einem geänderten Hex-Zeichen in `content_hash`; Variante (b): Quittung erst **nach** grünem Check verfälschen | (a) `RECEIPT_MISMATCH`; (b) Check läuft auf `edited` neu und wird rot. **Erwarteter Befund:** HP P-05 nennt als Trigger nur `opened`, `synchronize`, `reopened`, Review; ohne `edited` bleibt (b) grün | Check-Läufe mit Event `edited` |
| FI-03 | Störlauf | **Zusätzlicher unzulässiger File-Diff.** (a) neue Datei `src/domain/parse-report.helpers.ts`; (b) bestehenden Helfer in `tests/case-truth.test.ts` auf die neue API umstellen („gut gemeintes Refactoring“) | (a) `SCOPE_VIOLATION src/domain/parse-report.helpers.ts`; (b) `SCOPE_VIOLATION tests/case-truth.test.ts` (modified, nicht in `modify`) | Summary mit Pfad |
| FI-04 | Störlauf | **Absichtlich fehlschlagender Test.** `it("drill", () => expect(1).toBe(2))` in `tests/parse-report.test.ts` | `CHECK_FAILED test`, `typecheck` bleibt grün; Inventar `failed = 1`; Mutanten-Jobs laufen nicht oder zählen nicht (Baseline rot) | Evidence `checks[]` getrennt |
| FI-05 | Abnahmelauf | **Stale Review nach neuem Push.** Nach attestiertem APPROVE auf `H_k` pusht Codex eine Kommentarzeile (`H_k+1`) | GitHub verwirft das Approval (Stale-Dismissal), Merge-Button gesperrt; `forge-approval` rot; neues Review-Paket mit neuem `packetHash`; erst neues attestiertes Review auf `H_k+1` macht grün | PR-Timeline `review_dismissed`, Paket-Hashes alt/neu |
| FI-06 | Abnahmelauf | **Falscher Review-SHA.** Code-Reviewer liefert `FORGE-REVIEW v1` mit `headSha` = `H_k` (vorheriger Head) bzw. Variante (b) richtiger `headSha`, falscher `packetHash`. Seb attestiert **absichtlich trotzdem** | Sebs Zwei-String-Vergleich schlägt fehl; nach Attestation: `forge-approval` rot, weil `headSha` im Body ≠ `commit_id`/aktueller Head bzw. `packetHash` ≠ berechnet. Danach Seb dismisst das eigene Review (nur Seb darf, OMD §5) | Check-Summary nennt die Abweichung |
| FI-07 | Störlauf | **Überlebender Mutant (M1-Nachstellung).** Den `a/b`-Fall aus AT-01 entfernen, nur `~`-Fälle behalten | Tests grün, `MUTATION_SURVIVED M-PTR-ESCAPE-ORDER`, `forge-verify` rot | Evidence `mutations[0].outcome = survived` |
| FI-08 | Störlauf | **Mutationsanker fehlt.** Developer schreibt `.replace(/~/g, "~0").replace(/\//g, "~1")` (fachlich korrekt) | `not_applied` → `MUTATION_EVIDENCE_INVALID`, rot trotz grüner Tests. Bewusst so; der Drill entscheidet, ob Anker in `create`-Dateien das gewünschte Verfahren sind (Befund oder Bestätigung) | Evidence `applied: 0` |
| FI-09 | Contract | **Contract-PR-Injektionen** (je ein PR auf `forge/spec/FORGE-DRILL-09xx`, geschlossen): (a) Contract + `src/x.ts` im selben PR; (b) JSON mit 4 Leerzeichen; (c) CRLF; (d) Scope mit `src/forge/x.ts`, `.github/x.yml`, `Forge/contracts/x.md`; (e) Check `{"name":"test","command":"true"}`; (f) End-Marker fehlt; (g) `taskId` ≠ Dateiname; (h) Mutant mit `file` außerhalb des Scopes | (a) `CONTRACT_PR_NOT_ISOLATED`; (b) `FRONTMATTER_NOT_CANONICAL`; (c) `CARRIAGE_RETURN`; (d) `CONTRACT_SCOPE_PROTECTED`/`METADATA_SCHEMA` für alle drei inkl. Case-Alias; (e) nicht in `allowedChecks`; (f) `END_MARKER_MISSING`; (g) Pfad/Task-Mismatch; (h) Mutant ungültig | je ein roter Check-Lauf |
| FI-10 | Contract | **Registrierung per Merge Commit (B3).** (a) Positiv: der echte Contract-PR wird per Merge Commit gemergt; Gate und Handoff müssen `R` akzeptieren; (b) negativ: Spec-Branch mit `git merge origin/main` (Merge-Commit im PR); (c) negativ: zweiter Commit im PR ändert `src/x.ts` und dritter nimmt es zurück | (a) Handoff-Kommentar erscheint, Run-Gate grün (prüft A-3, nicht VD §4.5 wörtlich); (b) `CONTRACT_COMMIT_NOT_LINEAR`; (c) rot, obwohl der Netto-Diff nur die Contract-Datei zeigt (jeder Commit in `R^1..R^2` zählt) | §7.3-Ausgabe, Check-Läufe |

### 8.2 P1 (sollte im Drill laufen)

| ID | Phase | Injektion | Erwartete Reaktion |
|---|---|---|---|
| FI-11 | Störlauf | Run-Branch von `3d7545d` (vor `R`) statt von `R` | `WRONG_BASE` bzw. `CONTRACT_NOT_IN_BASE` |
| FI-12 | vor Störlauf | Branch `forge/run/codex/FORGE-DRILL-0001` (ohne `-n`) und `forge/run/claude/FORGE-DRILL-0001-1` | `NOT_A_RUN_BRANCH`; Push nach `forge/run/claude/**` vom Ruleset abgelehnt |
| FI-13 | Störlauf | Zweiter PR `forge/run/codex/FORGE-DRILL-0001-2` bei offenem `-1` | `RUN_LIMIT` (maxActiveRuns = 1) |
| FI-14 | Störlauf | Spec-Autor öffnet Contract-PR v2 während des Laufs | Run-PR rot `CONTRACT_PR_OPEN`; nach Schließen wieder grün |
| FI-15 | Abnahmelauf, vor dem Review | Seb merged einen unabhängigen Bootstrap-PR, `main` bewegt sich; Codex merged `main` in den Run-Branch (kein Force-Push). Variante „evil merge“: im Merge-Commit eine Zeile in `src/domain/case-truth.ts` ändern | Merge gesperrt bis „up to date“; neuer Head, neuer Verify; Variante: `SCOPE_VIOLATION src/domain/case-truth.ts` (im Diff `B..H` sichtbar, VD §4.4) |
| FI-16 | Störlauf | `it.skip` bzw. `it.only` in `tests/parse-report.test.ts` | Inventar `skipped > 0` rot; `.only` rot wegen `allowOnly: false` |
| FI-17 | Störlauf | (a) `chmod +x src/domain/parse-report.ts`; (b) zusätzlich `src/domain/Parse-Report.ts`; (c) Symlink `tests/link.ts` | (a) `MODE_FORBIDDEN`; (b) `CASE_COLLISION` + `SCOPE_VIOLATION`; (c) `MODE_FORBIDDEN` |
| FI-18 | vor Störlauf | Owner-Run (OMD B4): Seb versucht Push nach `forge/run/codex/…` bzw. öffnet den Run-PR selbst | Push vom Ruleset abgelehnt (Bypass nur Team `forge-dev-codex`); PR mit Autor `Wuerfelduell` rot |
| FI-19 | Störlauf | Test schreibt `process.env` ins Log und nach `$GITHUB_OUTPUT` | Keine Variablen im Container, Datei existiert nicht; Job-Output bleibt allein der Exit-Code |
| FI-20 | vor Störlauf | Developer bekommt den Handoff, pusht aber nichts (MP Exit-Kriterium 10) | Kein PR, nichts angenommen, Handoff bleibt gültig |

### 8.3 P2 (bereits Gegenstand von O-02/OMD-Setup; im Drill nur wiederholen, wenn dort nicht belegt)

| ID | Injektion | Erwartete Reaktion |
|---|---|---|
| FI-21 | Force-Push und Löschen von `forge/run/codex/FORGE-DRILL-0001-1` durch `forge-codex` | vom Ruleset abgelehnt |
| FI-22 | `git push origin HEAD:main` durch `forge-codex` | abgelehnt |
| FI-23 | Neuer Workflow im Run-Branch, `on: push`, Job `forge-verify` | Actions-Policy (S1) verhindert den Lauf; kein zweiter Check gleichen Namens; zusätzlich `PROTECTED_PATH_CHANGED` |
| FI-24 | Seb stellt Ruleset `forge-halt` auf `active` | Merge auf `main` gesperrt; nach `disabled` wieder möglich (A-8) |
| FI-25 | PR aus einem Fork | `forge-verify` rot (Fork-Ausschluss, VD §4.2) |

---

## 9. Full Run Walkthrough

Legende: **[S]** = Owner-Handgriff von Seb (wird gezählt), Ziel nach HP §8.5 ≤ 5; realistisch mit zwei externen, attestierten Reviews eher 8–10 (Messgröße, kein Pass/Fail).

### Phase 0: Vorbedingungen (alle mit Beleg, siehe §12)

Readiness-Checkliste HP §8.1–§8.4, angepasst an Merge Commit und OMD-Setup: Identity-Spike PASS, Actions-Policy S1 wirksam, Rulesets (`forge-main`, `forge-run-codex`, `forge-spec`, `forge-halt` disabled), CODEOWNERS, `forge/policy.json` mit Rollen (`forge-codex`: `spec_author`, `developer`; `Wuerfelduell`: `owner`), Workflows für Contract-Check, Gate, Verify, Approval, Handoff auf `main`, Mutanten-Feld im Contract-Schema (K-04), A-1..A-8 entschieden.

### Phase 1: Contract schreiben

1. **[S1]** Seb gibt `forge-codex` (Rolle Spec-Autor) §4 und §5 dieses Dokuments als Spec-Eingabe. Das ist die einzige erlaubte Text-Übergabe per Chat; sie ist Eingabe, nicht Contract.
2. Codex: `git switch -c forge/spec/FORGE-DRILL-0001 origin/main`, schreibt `forge/contracts/FORGE-DRILL-0001.md` (kanonisches `---json`, `baseCommit` = aktueller `main`-Head, End-Marker), **ein** Commit, Push, Draft-PR gegen `main`.
3. `forge-contract` läuft (`pull_request_target`), grün; Summary zeigt Task, Version 1, Content-Hash, Blob, Base, Scope, Checks, 3 Mutanten. Codex markiert „Ready for review“.

### Phase 2: Architektur-Review

4. **[S2]** Seb gibt ChatGPT die Rollenvorlage Architektur-Reviewer + PR-Nummer + Head-SHA + Content-Hash aus der Summary (kopiert, nicht getippt). ChatGPT liest den Contract am SHA aus dem öffentlichen Repo, nicht aus dem Chat.
5. ChatGPT liefert `FORGE-REVIEW v1` (APPROVE oder REQUEST_CHANGES). Erwartbar ist ein erster REQUEST_CHANGES (z. B. Anker-Pflicht für `create`-Dateien, Injektivität, Index-Sortierung).
6. Bei Änderungen: Codex pusht einen weiteren Ein-Datei-Commit, `contractVersion` bleibt 1 (noch nicht registriert), neues Review auf neuem Head.
7. **[S3]** Seb vergleicht `headSha` und Content-Hash (zwei Strings) und reicht sein GitHub-Review mit `FORGE-ATTEST owner=Wuerfelduell model=chatgpt headSha=… packetHash=…` ein. `forge-approval` grün.

### Phase 3: Registrierung

8. **[S4]** Seb merged den Contract-PR per **Merge Commit** → `R` auf `main`.
9. Workflow `forge-handoff` (push auf `main`, Pfadfilter `forge/contracts/**`) postet den Handoff auf den gemergten PR: `FORGE DEVELOPER HANDOFF v1`, `repository: Forge-Dice/Forge`, `task: FORGE-DRILL-0001`, `contract_version: 1`, `contract_commit: R`, `contract_blob`, `content_hash`, `result_ref: refs/heads/forge/run/codex/FORGE-DRILL-0001-1`, `role_template: forge/roles/developer.md@<main-sha>`.
10. Kontrolle nach §7.3 (optional Seb, sonst Gate).

### Phase 4: Störlauf (Run 1, wird nie gemergt)

11. **[S5]** Seb kopiert den Handoff in Codex.
12. Codex arbeitet nach §7.1, pusht, öffnet Draft-PR mit Read-Quittung. `forge-gate` + `forge-verify` müssen **zuerst grün** sein (Referenz-Head `H0`).
13. Injektionen der Reihe nach, je Push → erwartetes Rot → Revert-Push → wieder Grün: FI-04, FI-03, FI-01, FI-07, FI-08, FI-16, FI-17, FI-19; dann FI-02 (PR-Body), FI-11/FI-13/FI-14 (Nebenbranches bzw. Nebenpr). Jede Beobachtung mit Link in die Drill-Tabelle.
14. **[S6]** Seb schließt den Run-1-PR ungemergt (`abandoned`).

### Phase 5: Abnahmelauf (Run 2)

15. Neuer Run `forge/run/codex/FORGE-DRILL-0001-2`. **Offene Spezifikationsfrage:** HP P-04 erzeugt den Handoff nur beim Contract-Merge; wer den Handoff mit `n = 2` erzeugt, ist nicht festgelegt (Befund-Kandidat DRILL-F-01). Arbeitsweise bis zur Klärung: Codex leitet `n` nach der Regel der Rollenvorlage ab (bisherige Run-PRs + 1), das Gate prüft `RUN_NUMBER_NOT_NEXT`.
16. Codex startet frisch von `R` (oder aktuellem `main`), übernimmt die saubere Implementierung, pusht, Draft-PR mit Quittung. `forge-gate` + `forge-verify` grün, Contract Mutants 3/3.
17. Optional FI-15 (`main` bewegt sich) **vor** dem Review.
18. `forge-review-packet` schreibt Paket (`headSha`, `mergeBaseSha`, Contract-Blob/Hash, `changedFiles`, Diff-URL, `packetHash`). Codex markiert „Ready for review“.

### Phase 6: Externes Code-Review

19. **[S7]** Seb gibt dem Code-Reviewer (Claude ohne Projektdateien oder Grok) Rollenvorlage + `packetHash` + Paket-URL.
20. FI-06: erste Antwort absichtlich gegen den falschen SHA prüfen lassen (oder echte Abweichung nutzen) → Attestation scheitert erwartungsgemäß.
21. Echtes Review. Bei REQUEST_CHANGES: Codex fixt, Push, neuer Verify, neues Paket, neues Review.
22. **[S8]** Seb attestiert APPROVE auf `H_k`. FI-05: Codex pusht danach eine Kommentarzeile → Approval verworfen, `forge-approval` rot → **[S9]** neues Paket, neues Review, neue Attestation auf `H_k+1`.

### Phase 7: Merge und Nachweis

23. Alle Checks grün, Branch aktuell, Approval auf dem letzten Push. **[S10]** Seb merged vom Android-Handy per **Merge Commit** → `A`.
24. Merge-Invarianten nach §7.6, Funktionsprüfung nach §7.5.
25. Evidence-Artefakte (Contract-PR, Run 1, Run 2) in die Projektdateien sichern (Artefakte verfallen), Zählwerte notieren: Owner-Handgriffe, Contract-Textzeilen in Chats (Ziel 0 außer Spec-Eingabe in Schritt 1), von Hand getippte SHAs (Ziel 0), Befunde `DRILL-F-nn`.

```text
Seb ─S1─► Codex (Spec-Autor) ─push forge/spec/FORGE-DRILL-0001─► Contract-PR ── forge-contract ✓
                                                                     │
Seb ─S2─► ChatGPT (liest am SHA) ─FORGE-REVIEW─► Seb ─S3 attest─► forge-approval ✓ ─S4 Merge Commit─► R auf main
                                                                                                        │
                                                         forge-handoff ◄────────────────────────────────┘
                                                               │ 6 Zeilen
Seb ─S5─► Codex (Developer) ─► Run 1 (Störlauf: FI-xx rot/grün) ─S6 schließen
                            └► Run 2 ─► forge-gate ✓ forge-verify ✓ (3/3 Mutanten) ─► Review-Paket
Seb ─S7─► Code-Reviewer (liest am SHA) ─► Seb ─S8 attest─► (FI-05 Push ─► stale ─S9 re-attest) ─► S10 Merge Commit ─► A
```

---

## 10. Success Criteria

### 10.1 Der Drill ist bestanden, wenn

1. Jede P0-Injektion (FI-01..FI-10) die erwartete Reaktion zeigt, mit Link. Eine einzige grüne statt rote Injektion ist **nicht bestanden**.
2. Run 2 per Merge Commit auf `main` ist, mit `A^2 = H` (verifizierter Head), `tree(A) == tree(H)` und genau den zwei Dateien aus §6.
3. Die Evidence von Run 2 bindet Repo-ID `1401864629`, `head.sha`, `base.sha`, `main.sha`, Contract-Blob/Hash, `workflow.sha` aus `main`, `diff.rawSha256`, 2 Checks mit Exit 0, 3/3 Mutanten `detected`.
4. Die Funktionsprüfung §7.5 liefert byte-genau die erwartete Ausgabe.
5. Kein Contract-Text ging per Chat an Developer oder Reviewer (Ausnahme: Spec-Eingabe Schritt 1); kein SHA wurde von Hand getippt; jeder Review-Kopf ist an `headSha` und `packetHash` gebunden.
6. Die Contract-Registrierung erfüllt A-3 am realen `R` (§7.3).
7. Die drei offenen Fragen (A-1 Check-Namen, A-3 Contract-Commit unter Merge Commit, Handoff für Run n > 1) sind am Ende mit einer Entscheidung oder einem Befund belegt.

### 10.2 Messwerte (berichten, kein Pass/Fail)

Owner-Handgriffe (Ziel HP ≤ 5, hier erwartet 8–10), Durchlaufzeit Push → `forge-verify` fertig, Anzahl Review-Runden, Anzahl Befunde `DRILL-F-nn` nach Schwere.

### 10.3 Review-Kalibrierung (nicht an Reviewer geben)

Ein ernsthaftes Review sollte mindestens zwei dieser Punkte ansprechen oder begründet akzeptieren: Escape-Reihenfolge in `issuePointer`; Injektivität von `escapeForDisplay` (Backslash); Lücken in S (U+200B–U+200D); lexikografische Index-Sortierung (`/10` < `/2`); roher `pointer` vs. bereinigte `message`; verschachtelte Union-Fehler nicht aufgeklappt; Anker-Pflicht diktiert Codeform; Getter-Exceptions werden nicht gefangen. Findet ein Reviewer keinen davon und approved sofort, ist das ein Befund über den Review-Prozess, nicht über den Code.

### 10.4 Abbruchkriterien

Sofortiger Stopp und Befund, wenn: Prüflingscode im Runner-Prozess statt im Container läuft; ein Check grün wird, obwohl ein geschützter Pfad geändert ist; ein Approval auf einem älteren SHA zählt; ein Merge ohne grünen `forge-verify` auf dem aktuellen Head möglich ist; `forge-codex` auf `main` pushen kann; der Handoff aus PR-Text statt aus Git berechnet wird.

---

## 11. Cleanup

| Was | Aktion | Wer |
|---|---|---|
| Run-1-PR (Störlauf) | geschlossen, nie gemergt; im Drill-Bericht verlinkt | Seb (in Phase 4 erledigt) |
| Branches `forge/run/codex/FORGE-DRILL-0001-1`, `…-2`, Neben-Branches aus FI-11..FI-13 | **behalten** (Provenienz; Löschen verbietet das Ruleset ohnehin). Löschen nur bewusst durch Seb als Admin, dokumentiert | – |
| Contract-Injektions-PRs `FORGE-DRILL-09xx` | geschlossen; keine dieser Task-IDs hat eine Datei auf `main` | Seb |
| `forge-halt` | zurück auf `disabled`, Beleg | Seb |
| Eigenes Review nach FI-06 | von Seb dismisst (Timeline belegt) | Seb |
| Drill-Code auf `main` | **bleibt** als nützliche API und Beispiel-Task. Entfernen wäre selbst ein Forge-Task mit eigenem Contract und lohnt nicht | – |
| Evidence und Review-Pakete | als JSON in die Projektdateien sichern (Actions-Artefakte verfallen) | wer den Bericht schreibt |
| Drill-Bericht | `forge-audits/FORGE-DRILL-0001-REPORT.md` in den Projektdateien: Tabelle FI-xx (erwartet / beobachtet / Link), Messwerte, Befunde `DRILL-F-nn`, Entscheidungen zu A-1/A-3/Handoff n > 1 | Claude-Thread, read-only gegen GitHub |
| Policy | `bootstrap` bleibt, wie es Phase 0 verlangt; Umschalten auf `false` ist eine eigene Owner-Entscheidung nach dem ersten echten Task | Seb |
| Kontrolle | `git ls-remote origin` zeigt nur erwartete Refs; offene PRs = 0; keine Repo-Variable oder Secret neu angelegt | Seb oder Claude (read-only) |

---

## 12. GO/NO-GO

### Drill-Design: **GO**

Kandidat, Spec, Acceptance Criteria, Mutanten, Injektionsplan und Ablauf sind festgelegt; die Fakten, auf die sie bauen, sind am realen Code und an Zod 4.6.5 gemessen (§4.1, §4.5, §7.5). Der Spec-Autor kann den Contract-Text vorbereiten, sobald A-4 (Mutanten-Format) entschieden ist.

### Drill-Ausführung heute: **NO-GO**

| # | Blocker | Beleg | Löst |
|---|---|---|---|
| N-1 | Auf `main` gibt es kein `.github/`, keine Workflows, kein CODEOWNERS, keine `forge/policy.json`: Contract-Check, Gate, Verifier, Approval-Check, Handoff existieren nicht | `CODE` (`3d7545d`), OMD F7 | P-02..P-06, O-01-Rest |
| N-2 | Contract-Schema kennt keine Mutantenliste (`mutationSmoke` ist nur ein Enum) | `CODE` `src/forge/contract-document.ts:33` | K-04 bzw. Contract System V2 |
| N-3 | Identity-Spike `forge-codex` nicht PASS | OMD B1 | Codex + Seb |
| N-4 | Actions-Policy S1 im Free-Org-Plan nicht nachgewiesen (einzige Abwehr gegen gleichnamige Checks) | OMD B2 | Seb (Spike) |
| N-5 | Contract-Registrierung per Merge Commit nicht spezifiziert; VD §4.5 würde `R` als nicht-linear ablehnen | OMD B3, A-3 | Contract System V2 |
| N-6 | Check-Namen uneinheitlich (HP vs. IGP vs. OMD) | A-1 | Implementation Package |
| N-7 | Handoff für Run n > 1 nicht spezifiziert (betrifft den geplanten Abnahmelauf) | HP P-04 | Implementation Package; notfalls Drill mit nur einem Run und Injektionen als Push/Revert im selben PR (dann erben Merge-Commits die Injektions-Historie) |
| N-8 | Re-Evaluierung bei PR-Body-Änderung (`edited`) für die Read-Quittung nicht vorgesehen | HP P-05 | Implementation Package (sonst bleibt FI-02b ein erwarteter Befund) |

**GO-Bedingung für die Ausführung:** N-1..N-6 erledigt und belegt, N-7/N-8 entschieden (Lösung oder dokumentierte Drill-Variante), HP §8.1–§8.4 an Merge Commit und OMD angepasst und abgehakt, A-1..A-8 gegen die beiden Parallel-Dokumente abgeglichen. Danach ist `FORGE-DRILL-0001` der letzte Schritt vor dem ersten echten Task (Accusation & Verdict).

<!-- END OF FORGE-FIRST-MANAGED-RUN-DRILL -->
