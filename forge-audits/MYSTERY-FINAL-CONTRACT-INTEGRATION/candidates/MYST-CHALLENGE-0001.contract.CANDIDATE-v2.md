---json
{
  "forgeContractFormat": 1,
  "taskId": "MYST-CHALLENGE-0001",
  "contractVersion": 2,
  "baseCommit": "3d7545d843883418348004e68717399a64da7a7d",
  "dependencies": [
    {
      "taskId": "MYST-0002",
      "acceptedCommit": null
    }
  ],
  "scope": {
    "create": [
      "src/domain/accusation-challenge.ts",
      "tests/accusation-challenge.fixture.ts",
      "tests/accusation-challenge.test.ts",
      "tests/accusation-challenge.typecheck.ts"
    ],
    "modify": []
  },
  "requiredChecks": [
    {
      "name": "typecheck",
      "command": "npm run typecheck"
    },
    {
      "name": "test",
      "command": "npm test"
    }
  ],
  "mutationSmoke": "required"
}
---
# MYST-CHALLENGE-0001 v2 — Exactness Wrapper V1 · CANDIDATE

**REVISION 2 — Integration Candidate (MYSTERY-FINAL-CONTRACT-INTEGRATION, 2026-10-04).** Vorgänger: `MYST-CHALLENGE-0001.contract.DRAFT.md` (Branch `forge/owner/audits/MYST-ACCUSATION-CHALLENGE-EXACTNESS` @ `7514e7e6a31e`, Roh-SHA-256 `9888f9b55da5955eb161014c5f34a74ee9e4ce65483007f5adc9b397686f58f4`, forge-contract-v1 `020506fa0e8e0efee2c8d4d1d17f5a47729a355f8173b6e090371c252054c4d9`), unverändert archiviert. Owner-Entscheidungen D1–D10 (FORGE-MYSTERY-FINAL-OWNER-RECONCILIATION) sind angenommen. Integriert ausschließlich: F05 (§6 Rollenzeile, Release-Proof-Closure P10 = Master B.7) und F12-Pin (Design Dependency auf MYST-0002 v2, Master B.15 mit Pin auf die reparierte Fassung). Evaluation, Exactness-Formel, three-valued undetermined, allowedClaims mit false/undetermined (D10) und Required-only-Verbot geheimer Auswahl unverändert. Kein Evidence-possession-Runtime-Gate. Jede Änderung ist im MYSTERY-FINAL-CONTRACT-MANIFEST.json als exakter OLD→NEW-Eintrag mit Herkunft belegt. Nicht registriert, nicht freigegeben, keine Implementierungsfreigabe. Registrierung nach Forge BOOTSTRAPPED als Format 2 (Transkodierung ohne Versionssprung).

**Status: DRAFT, nicht implementiert, nicht akzeptiert, nicht registriert.** Dieses Dokument ist ein Entwurf außerhalb des Repositories und autorisiert keine Änderung. Kein ausführbarer Run-Contract, solange MYST-0002 fehlt. Stand: 2026-10-03.

## 1. Basis und Dependency-Gate

Gelesener `Forge-Dice/Forge/main`: `3d7545d843883418348004e68717399a64da7a7d`. Implementiert: CaseTruth, CaseSolution, deren Hashes und private dreifache Conclusion-Auflösung. Accusation/Verdict und `evaluateConclusionClaim` fehlen auf dieser Basis.

Design Dependency: `MYST-0002.contract.CANDIDATE-v2.md` (MYST-0002 contractVersion 2), Inhaltshash `sha256("forge-contract-v1\n" + exactText)` = `65b12f758d6eda6f23427e1bd897be27a3e8f01c8e9dea8853d7a41de21517ef` (Rohbytes-SHA-256 `8e66e86117aa50fc601faecb271f5616befef012185f0646424a946456d8ac51`). Gegenüber den Vorgängern `3758b20c…` und FINAL-CANDIDATE `e1eba9e1…` sind Wahrheitstabelle, API, Binding und Verdict-Formel unverändert; neu sind §7a/§15 (Core ≠ Challenge), die §15-Scope-Publikationsregel (F05) und der Plain-JSON-No-throw-Umfang (F08). Dort: Unknown neutral; zusätzliche korrekte Literale zulässig; alle Required-Literale notwendig; strukturelle Duplikate unabhängig von Polarität verboten; Event ohne Resolution ergibt undetermined (D5).

`acceptedCommit:null` behauptet keine akzeptierte Dependency. Vor einer späteren Implementierung: akzeptierten MYST-0002-Stand und dessen API belegen, Draft gegen diesen Stand neu prüfen, Basis und Dependency in einer neuen Contract-Version pinnen. Abweichende Core-Semantik blockiert diesen Entwurf. Keine Resolver-Kopie als Ersatz.

Reads: `src/domain/case-truth.ts`, `case-truth.identity.ts`, `case-solution.ts`, `case-solution.identity.ts`; nach Dependency-Erfüllung zusätzlich `case-accusation.ts` und MYST-0002-Tests. Format-1-Frontmatter folgt dem vorhandenen Contract-Parser. Seine syntaktische Gültigkeit ist keine fachliche Freigabe.

## 2. Ziel und Grenze

Vertrauenswürdiger Host wählt eine bereits geparste Challenge. Spieler liefert ausschließlich die durch MYST-0002 geparste Accusation. Keine frei vom Spieler wählbare Solution, Challenge oder Scope. TypeScript-Brands und unkeyed Hashes sind keine Authentisierung.

Solved genau dann, wenn der neutrale Core solved liefert und jedes eingereichte Literal einen erlaubten Claim mit exakt passendem bestimmten kanonischen Boolean enthält. Korrekte zusätzliche in-scope Literale bleiben zulässig. Partial-Solutions bleiben zulässig. Unknown wird niemals als false ausgewertet.

Keine Proof-, Solvability-, PlayerKnowledge-, Evidence-Access-, Session-, Save-, UI-, Score- oder Attempt-Limit-Logik. Keine Runtime-LLM-Nutzung. Kein neuer Frage-Typ, keine Package-Architektur, kein Challenge-Hash, kein neues Winning-Array, keine neue Dependency. Bestehende Domain-Dateien bleiben in diesem Task unverändert.

## 3. Vollständige öffentliche API

```ts
export type AccusationChallengeInput = z.input<typeof ChallengeShapeSchema>;
export type AccusationChallenge = DeepReadonly<z.output<typeof ChallengeShapeSchema>>
  & z.$brand<"AccusationChallenge">; // ChallengeShapeSchema bleibt privat
export type ChallengeAccusationResult =
  | { readonly success: true; readonly verdict: "solved" | "not_solved" }
  | { readonly success: false; readonly code:
      "SOLUTION_BINDING_MISMATCH" | "CHALLENGE_BINDING_MISMATCH" |
      "ACCUSATION_BINDING_MISMATCH" | "INVALID_CLAIM" | "UNKNOWN_REFERENCE" };

export function parseAccusationChallenge(
  input: unknown, truth: CaseTruth, solution: CaseSolution
): AccusationChallenge; // wirft ZodError

export function evaluateChallengeAccusation(
  truth: CaseTruth, solution: CaseSolution,
  challenge: AccusationChallenge, accusation: Accusation
): ChallengeAccusationResult;
```

Typ-Pseudocode bezeichnet die geforderte Oberfläche, keine bestehende Implementierung. Alle Ergebnisobjekte sind gefroren. Keine weitere Export-Funktion, kein öffentlicher ungebrandeter Output-Shape, keine Factory oder Klasse. `claimKey` und `evaluateConclusionClaim` aus MYST-0002 wiederverwenden; keine zweite Wahrheits- oder Gleichheitstabelle.

## 4. Challenge-Dokument und Parse-Vertrag

Striktes Root-Objekt: `schemaVersion:1`, `caseId:CaseIdSchema`, `truthHash` und `solutionHash` jeweils 64 lowercase Hex-Zeichen, `allowedClaims: ConclusionClaimSchema[]`. **1..256** Elemente. 256 ist ein konservatives V1-Ressourcenbudget, keine fachliche Schuldgrenze. Es begrenzt die Wrapper-Evaluation, nicht die Größe der bestehenden Truth oder die Kosten beliebiger Raw-JSON-Verarbeitung.

Scope enthält nackte Claims ohne Boolean-Polarität. `eventIntent.value` und `eventMechanism.value` sind notwendige String-Enum-Felder; sie dürfen nicht entfernt werden. Keine `conclusionId`, Labels oder versteckten Answer-Metadaten im Challenge-Shape.

Nach Shape-Prüfung in dieser Reihenfolge:

1. Solution an Truth prüfen (`caseId`, `truthHash`). Fehler: Root-Zod-Issue `SOLUTION_BINDING_MISMATCH`; keine weiteren Cross-Checks.
2. Challenge an Truth und Solution prüfen: `caseId`, `truthHash === hashCaseTruth(truth)`, `solutionHash === hashCaseSolution(solution)`. Fehler jeweils am betreffenden Root-Feld; dann keine Referenz-/Coverage-Folgefehler.
3. Scope-Claims referenzprüfen: eventId, optional personId und causeEventId müssen in Truth existieren. Präzise Feldpfade `allowedClaims[i].<field>`. Keine Katalog- oder Resolution-Mitgliedschaft fordern.
4. Eindeutigkeit mit dem bestehenden `claimKey`, unabhängig von Property-Reihenfolge. Fehler am späteren `allowedClaims[j]`, mit Index des ersten Auftretens. Keine stille Deduplikation.
5. Jeder `solution.requiredConclusions`-Claim muss im Scope liegen. Bei Fehlen Issue an `allowedClaims` mit interner Conclusion-ID und Claim-Key. Das ist privates Autorenfeedback, niemals Player-Feedback.
6. Input klonen und rekursiv einfrieren; nominal brand. Eingabe weder verändern noch einfrieren. Array-Reihenfolge bewahren; sie ist für Membership und Verdict bedeutungslos.

Kanonisch false und undetermined Scope-Mitglieder sind zulässig und für eine antwortunabhängige Kandidatenmenge oft notwendig. Required-Coverage prüft nur die formale Gewinnbarkeit dieses Vertrags, keine Beweisbarkeit oder öffentliche Kandidaten-Vollständigkeit.

## 5. Evaluation und Fehlerpriorität

Vor jedem Ergebnis, auch bei leerer oder zu langer Anklage: Solution→Truth, Challenge→Truth+Solution, Accusation→Truth prüfen, in genau dieser Reihenfolge. Bei Fehler entsprechenden `…_BINDING_MISMATCH` zurückgeben. Keinen technischen Fehler in ein fachliches `not_solved` umdeuten.

Danach:

1. `accusation.literals.length > challenge.allowedClaims.length` → `not_solved` ohne Core-/Conclusion-Evaluation. MYST-0002 garantiert eindeutige Claim-Keys, somit ist mindestens ein Claim außerhalb des Scopes.
2. Scope als Set aus `claimKey` bilden. Jeder Claim muss enthalten sein; sonst `not_solved` ohne per-Literal-Hinweis.
3. `evaluateAccusation(truth, solution, accusation)` aufrufen. Technischen Fehler durchreichen. Core `not_solved` → `not_solved`.
4. Für jedes Literal `evaluateConclusionClaim(...)` aufrufen. Technischen Fehler durchreichen. Nur `status === literal.value` ist zulässig; jede Abweichung → `not_solved`. Sind alle exakt passend → `solved`.

`"undetermined" === true` und `"undetermined" === false` sind beide false. Das ist eine Annahmebedingung für einen eingereichten Satz, keine Umdeutung seines Wahrheitswerts. Ein zusätzlicher `status !== "undetermined"`-Guard wäre logisch redundant. Alternativ ist Core + Scope + Reject-Unknown gleichwertig, weil der Core bestimmte falsche Polaritäten bereits ausschließt. Keine Null-/Truthiness-Coercion.

Die Wrapper-Funktion akzeptiert bereits geparste Snapshots. Keine zweite Raw-Accusation-Parsing-Schicht; keine Antwort-Hinweise für defekte Raw-Eingaben. Shape-/Autorenfehler sind host-intern. Spielerfachliche Oberfläche: ausschließlich `solved | not_solved`. Technische Fehler bleiben getrennte Host-Fehler, nicht Spieler-Fehlschläge.

## 6. Public-Question-Vertrag (Publication-Voraussetzung)

Diese Regeln sind verpflichtende Autoren-/Publication-Prüfungen. Sie sind **nicht** durch das generische Zwei-Funktionen-API automatisch beweisbar und führen zu keinem neuen Domain-Feld oder Validator-Export dieses Tasks.

| Öffentliche Frage | Pflichtregel |
|---|---|
| `identify_all_responsible(event)` | Responsibility muss complete sein. Kandidaten sind alle öffentlich zugelassenen Personen, nicht die geheimen Assignments; keine tatsächliche verantwortliche Person darf fehlen. nobody-Claim immer anbieten, nicht nur bei leerer Antwort. Alle tatsächlichen Verantwortlichen als positive Required-Literale, bei keiner Person nobody=true. Keine unerklärten weiteren globalen Required-Ziele. |
| `required_literals` / enge Teilfrage | Frage und ausgewählte Claim-Dimensionen müssen öffentlich begründet und unabhängig von geheimen Polaritäten sein. Scope=Required-Claim-Keys kann bei einer vorab gewählten Ja/Nein-Frage korrekt sein. Core-R ist weiterhin global: eine Teilfrage darf nicht übrige Required-Literale ignorieren. Bei Bedarf später eine eigene Solution authoren und neu binden, kein per-Challenge Winning-Set ergänzen. |
| Rollenfrage (offen: „welche Rolle hatte wer?“) | Für jeden öffentlich gewählten Kandidaten alle drei Rollen-Claims anbieten. Nicht nur bekannte/wahre Rollen oder Personen aus geheimen Assignments auswählen. Bekannte Rollenliste ist geschlossen; roles:null bleibt U. „Alle Rollen“ ist bei null nicht als bestimmte Abschlussantwort veröffentlichbar. Eine vorab öffentlich festgelegte einzelne Rolle (z. B. nur `direct_actor`) ist eine `required_literals`-Frage: genau diese Rolle für alle öffentlichen Kandidaten anbieten. |
| Ursachenfrage | Kandidaten aus öffentlichem Ereignisraum, unabhängig von tatsächlichen causedByEventIds; Selbstursache ausschließen. Direkte Ursachen, keine transitive Erreichbarkeit. „Alle Ursachen“ erfordert causesComplete:true und vollständige Required-Ursachen; kein Ursachenfreiheits-Claim existiert, diesen nicht erfinden. |
| Intent-/Mechanism-Frage | Alle drei Varianten der jeweiligen vorhandenen Enum für das öffentlich gewählte Event anbieten. Bei null keine bestimmte Abschlussantwort versprechen. Vorab bestimmte Ja/Nein-Teilfrage ist möglich, wenn ihr Literal kanonisch bestimmt ist. |

Ein geschlossenes „alle“-Versprechen mit partial, fehlenden Required-Akteuren, unvollständigen öffentlichen Kandidaten oder Scope aus nur wahren Claims ist ein Authoringfehler. Generischer Parser kann Unterauthoring nicht erkennen. Gegenwelten-Test: gleiche öffentliche Frage/Daten bei geänderter privater Antwort → gleiche veröffentlichte Kandidaten-Claims. Absichtlich schmale öffentliche Frage kann Person oder Event nennen; nicht jede solche Nennung ist ein Leak.

Das vollständige interne Challenge-Dokument wird nicht automatisch veröffentlicht. Insbesondere kein solutionHash, keine Required-Polaritäten, keine internen technischen Fehler, keine kanonischen IDs verborgener Entities. Lösungshash ist Bindung, kein Geheimnis-Schutz; ein kleiner bekannter Lösungsraum erlaubt Wörterbuchtests. Diese Grenze definiert keine Transport-, PlayerRef- oder UI-Architektur.

## 7. Konkrete Acceptance Tests

Fixture-Konvention: `R` ist die vollständige Menge korrekt signierter Required-Claims. „plus R“ ergänzt Claim-eindeutig. Positive und negative Required-Literale verwenden. Alle Solutions mit echtem `parseCaseSolution`, Truth zusätzlich mit echtem Semantic Validator prüfen. P/V/B/T sind zukünftige Implementierungs-Akzeptanztests; L sind Publication-Review-Fixtures. Sie sind nicht als heute ausgeführte Tests einer existierenden Wrapper-Implementierung zu bezeichnen.

| ID | Eingabe / Eingriff | Erwartung |
|---|---|---|
| P01 | Gültiger Scope mit Required-Abdeckung, 1..256 Claims | Parse erfolgreich; gebrandeter Snapshot |
| P02 | allowedClaims = [] | ZodError an allowedClaims |
| P03 | 256 unterschiedliche, referenzgültige Claims mit Required-Abdeckung | Parse erfolgreich |
| P04 | 257 unterschiedliche, referenzgültige Claims | ZodError an allowedClaims |
| P05 | Identischer Scope-Claim zweimal | ZodError am späteren allowedClaims[j] |
| P06 | Derselbe Claim mit anderer Property-Reihenfolge zweimal | Wie P05, keine Alias-Flucht |
| P07 | Ein allowedClaims-Element ist {claim, value:true} | Shape-Fehler; erwartet nackten Claim |
| P08 | Boolean value an personResponsibleForEvent | Shape-Fehler; Zusatzfeld |
| P09 | eventIntent.value = intended und eventMechanism.value = ordinary | String-Werte bleiben gültige Claim-Felder |
| P10 | Unbekanntes kind | Shape-Fehler am Diskriminator |
| P11 | personId hat Präfix item: | Shape-Fehler am personId |
| P12 | Referenzgültiges Präfix, aber Person fehlt | ZodError am allowedClaims[i].personId |
| P13 | eventId fehlt in Truth | ZodError am allowedClaims[i].eventId |
| P14 | causeEventId fehlt in Truth | ZodError am allowedClaims[i].causeEventId |
| P15 | Selbstursache causeEventId = eventId | Shape-Fehler am causeEventId |
| P16 | schemaVersion = 2, Zusatzfeld oder uppercase Hash | Jeweils Shape-Fehler am Feld |
| P17 | Ein Required-Claim fehlt im Scope | ZodError an allowedClaims; benennt internes Conclusion-ID |
| P18 | Scope enthält kanonisch undetermined Claim | Parse erfolgreich; Unknown nicht herausfiltern |
| P19 | Scope-Claim fehlt im Solution-Katalog, hat gültige Truth-Referenzen | Parse erfolgreich; Katalogmitgliedschaft ist keine Scope-Regel |
| P20 | Scope-Claim referenziert Event ohne Resolution | Parse erfolgreich; später undetermined nach MYST-0002 D5 |
| P21 | Scope genau Required-Claim-Menge einer öffentlich gewählten Ja/Nein-Frage | Parse erfolgreich; Gleichheit allein kein Leak-Nachweis |
| P22 | Raw-Input nach Parse an Hash, Array und verschachteltem Claim verändern | Snapshot unverändert; Raw-Input nicht gefroren |
| P23 | Parsed Root, Array oder Claim verändern | Alle rekursiv gefroren; Mutation in Strict Mode wirft |
| P24 | Scope-Array und Claim-Properties umordnen | Reihenfolge bleibt im Snapshot; gleiche Evaluation |
| V01 | Exakt alle Required-Literale mit kanonischer Polarität | solved |
| V02 | Leere gültige Accusation | not_solved |
| V03 | Ein Required-Literal fehlt | not_solved |
| V04 | Required false durch true ersetzen | not_solved |
| V05 | Required true durch false ersetzen | not_solved |
| V06 | R plus zusätzlicher in-scope kanonisch true Claim, asserted true | solved |
| V07 | R plus zusätzlicher in-scope kanonisch false Claim, asserted false | solved |
| V08 | R plus out-of-scope kanonisch true Claim, asserted true | not_solved |
| V09 | R plus out-of-scope kanonisch false Claim, asserted false | not_solved |
| V10 | R plus in-scope kanonisch false Claim, asserted true | not_solved |
| V11 | R plus in-scope kanonisch true Claim, asserted false | not_solved |
| V12 | partial: nicht gelistete Person, asserted true, plus R | not_solved; Core darf neutral solved liefern |
| V13 | partial: nicht gelistete Person, asserted false, plus R | not_solved; U wird nicht false |
| V14 | partial: alle gelisteten Required-Akteure korrekt, keine Unknown-Extras | solved; kein pauschales Partial-Verbot |
| V15 | roles:null: Rollenclaim true plus R | not_solved |
| V16 | roles:null: Rollenclaim false plus R | not_solved |
| V17 | partial, gelistete Person mit roles:[direct_actor]; planner=false plus R | solved; bekannte Rollenliste ist geschlossen |
| V18 | Nicht bekannte Ursache bei causesComplete:false; beide Polaritäten separat | Jeweils not_solved |
| V19 | Bekannte direkte Ursache bei causesComplete:false; true plus R | solved |
| V20 | intent:null; jede Enum-Option mit beiden Polaritäten separat plus R | Jeweils not_solved |
| V21 | mechanism:null; jede Enum-Option mit beiden Polaritäten separat plus R | Jeweils not_solved |
| V22 | Event ohne Resolution, beide Polaritäten separat plus R im Scope | Jeweils not_solved; D5 bleibt U |
| V23 | complete, keine Personen: nobody=true Required erfüllt | solved |
| V24 | partial, keine Personen: nobody=true/false plus bekanntem Ursache-Required | Jeweils not_solved |
| V25 | nobody=true und bekannte verantwortliche Person=true | not_solved; verschiedene Claims sind kein Parse-Duplikat |
| V26 | partial leer: nobody=true und alle Personen=true plus R | not_solved; neutraler Core kann solved liefern |
| V27 | 2 sowie 3 legitime Akteure, alle jeweils Required | Jeweils solved |
| V28 | planner + direct_actor; verantwortliche Personen und Required-Rollen | solved; keine physische Präsenz ableiten |
| V29 | facilitator + direct_actor, korrekte zusätzliche Rollen | solved |
| V30 | Eine Person hat zwei und danach drei bekannte Rollen | Beide gültigen Antworten solved |
| V31 | Alle sechs Personen angeklagt, aber nur eine complete verantwortlich | not_solved |
| V32 | Alle sechs Personen sind tatsächlich verantwortlich und Required | solved; Länge ist kein Schuld-Kriterium |
| V33 | Alle drei Rollen für jeden Kandidaten, mindestens eine falsch oder U | not_solved |
| V34 | Ein legitimer Required-Akteur bei mehreren fehlt | not_solved |
| V35 | Zusätzlicher complete unschuldiger Kandidat=true | not_solved |
| V36 | Gleicher Claim doppelt, beide gleiche oder entgegengesetzte Polaritäten | MYST-0002-Parser weist zurück; Wrapper kein zweiter Parser |
| V37 | Alias nur durch Property-Reihenfolge | MYST-0002-Parser weist Duplikat zurück |
| V38 | Erratene kanonische ID existiert nicht | MYST-0002-Parse-Fehler am Referenzfeld |
| V39 | Erratene bekannte ID mit korrektem in-scope Claim und vollständigem R | solved; keine Knowledge-/Authentisierungsregel erfinden |
| V40 | Literale umordnen oder Claim-Properties umordnen | Identisches Verdict |
| V41 | Mehr eindeutige Accusation-Claims als Scope-Claims | not_solved nach Bindung, ohne Core-/Claim-Oracle-Aufruf |
| V42 | Erster Literal korrekt, späterer out-of-scope oder U | not_solved; alle prüfen |
| V43 | Gültiges Verdict | Exakt Schlüssel success/verdict; keine Counts, IDs, Hashes, Hinweise |
| B01 | Challenge + Accusation + Solution an unveränderter Truth | Normales Verdict |
| B02 | Gleiche Truth, andere Responsibility-Solution | CHALLENGE_BINDING_MISMATCH |
| B03 | Gleiche Truth, nur Solution.revision erhöht | CHALLENGE_BINDING_MISMATCH |
| B04 | Truth-Präsentation geändert, neue passende Solution; alte Challenge | CHALLENGE_BINDING_MISMATCH |
| B05 | Truth-/Solution-Arrays und Properties nur permutiert | Binding bleibt gültig |
| B06 | Nicht-Required-Conclusion hinzugefügt | CHALLENGE_BINDING_MISMATCH |
| B07 | Nicht-Required-Conclusion gelöscht | CHALLENGE_BINDING_MISMATCH |
| B08 | Gültiger fremder Case mit eigener Solution, alte Challenge | CHALLENGE_BINDING_MISMATCH |
| B09 | Solution nicht an übergebene Truth gebunden | SOLUTION_BINDING_MISMATCH vor jeder Scope-/Verdict-Prüfung |
| B10 | Challenge caseId/truthHash/solutionHash falsch beim Parsen | Jeweils ZodError am betreffenden Feld; keine Referenz-Folgefehler |
| B11 | Accusation nicht an aktuelle Truth gebunden; sonst passend | ACCUSATION_BINDING_MISMATCH |
| B12 | Leere Accusation und stale Challenge | CHALLENGE_BINDING_MISMATCH; niemals not_solved |
| B13 | Solution, Challenge und Accusation gleichzeitig falsch gebunden | Priorität Solution, dann Challenge, dann Accusation |
| B14 | Nur Scope umgeordnet; Truth und Solution gleich | Keine neue Hashbindung nötig; Verdict unverändert |
| B15 | Core/ConclusionEvaluation liefert technischen Fehler | Unverändert als technischer Fehler; nicht in not_solved umdeuten |
| T01 | Mutable Input beschreiben, Array push und verschachteltes Feld ändern | Kompiliert |
| T02 | Root/Array/verschachteltes Claim im Challenge-Output verändern | Jeweils @ts-expect-error |
| T03 | Input oder strukturgleichen ungebrandeten Snapshot an Evaluator geben | @ts-expect-error |
| T04 | CaseSolution statt AccusationChallenge geben | @ts-expect-error; Brands verschieden |
| T05 | Ungebrandeten Input statt Accusation geben | @ts-expect-error |
| T06 | Result.verdict verändern oder matchedClaims lesen | Jeweils @ts-expect-error |
| T07 | success:false branch als Verdict behandeln | @ts-expect-error |
| L01 | Sechs Gegenwelten mit anderem Täter, gleiche öffentliche Frage | Identische Kandidaten-Claim-Menge; keine Required-abgeleitete Auswahl |
| L02 | identify_all: tatsächliche Täter A+B, Required/Scope nur A | API allein kann solved liefern; Publication Review MUSS ablehnen |
| L03 | identify_all mit partial Responsibility | Publication Review MUSS Vollständigkeitsversprechen ablehnen |
| L04 | Öffentliche Einzelpersonen-Ja/Nein-Frage, true- und false-Gegenwelt | Gleicher Scope zulässig; geheime Required-Polarität verschieden |
| L05 | Öffentliche Ausgabe des ganzen Challenge-Objekts inklusive solutionHash | Publication Review MUSS ablehnen; nur öffentlicher Frageinhalt freigeben |

## 8. Deterministische Properties und Mutanten

Keine neue Dependency: vorhandene Vitest-/TypeScript-Werkzeuge, eigener fester LCG-Seed `0x03175a99`, bounded Fixtures. Nicht nur den Produktionsalgorithmus in Tests spiegeln. Kanonische Statuswerte für auflösbare Claims über beide Required-Polaritäten im echten `parseCaseSolution` gewinnen; keine kopierte Resolver-Switch-Tabelle. D5 gesondert über akzeptiertes MYST-0002 testen.

Unabhängiges Mengen-Oracle: R = signierte Required-Menge; M = alle bestimmten, kanonisch korrekt signierten Scope-Claims; A = eingereichte signierte Menge. Erwartung `R ⊆ A ⊆ M`. Je mindestens 30 Configs mit complete/partial, 0/1/mehreren Assignments, null/mehreren Rollen, null/bekannter Ursache/Intent/Mechanism, positiven und negativen Requirements. Mindestens 2.000 Versuche.

Properties: (1) Scope-/Literal-/Property-Permutation invariant; (2) E = Mengen-Oracle = F; (3) solved impliziert Core solved; (4) solved enthält weder U noch Fehlpolarität noch Fremd-Claim; (5) jedes fehlende R führt not_solved; (6) korrektes extra in-scope Literal erhält solved; (7) beliebige Required-Boolean-Flips scheitern; (8) Reparse/Freeze schützt Snapshot; (9) gleiche semantische Reihenfolgevariation ändert die gebundenen Hashes nicht, Inhaltsänderung schon. Mindestens ein positiver Zeuge je Property, kein ausschließlich vacuous random set.

| Mutant | Erforderlicher Zeuge |
|---|---|
| M1 Scope-Prüfung entfernt | R + korrekte Aussage zu fremdem Event würde solved |
| M2 Unknown-/Exactness-Guard entfernt | R + partial unlisted person=true würde solved |
| M3 U zu false coerced | R + partial unlisted person=false würde solved |
| M4 Core-/Required-Coverage entfernt | Leere Anklage würde solved |
| M5 Required every durch some ersetzt | Einer von mehreren erforderlichen Akteuren fehlt |
| M6 Nur erstes Literal geprüft | Späteres U oder out-of-scope Literal |
| M7 solutionHash-Bindung entfernt | Gleiche Truth + erhöhte Solution-Revision |
| M8 Scope-Duplikatprüfung entfernt | Property-umgeordnetes Duplikat |
| M9 Scope-Cap entfernt | 257 unterschiedliche referenzgültige Claims |
| M10 Per-Literal-Diagnose im Result ergänzt | Exakte Result-Key-Allowlist bricht |

Äquivalente Mutanten NICHT als fehlende Testgüte werten: explizite determined-Prüfung entfernen bei verbleibendem striktem Matching; Matching entfernen bei unverändertem Core + determined-Prüfung. Beide erhalten die Policy. Type-level Tests müssen wirklich per tsc laufen; Laufzeit-Object.freeze ersetzt keine Brand-/Readonly-Prüfung.

## 9. Abnahme und Nichtziele

Abnahme erst auf belegter MYST-0002-Implementierung: beide Required Checks grün, konkrete Tests und deterministisches Oracle grün, mindestens sechs nichtäquivalente Mutanten getötet, keine neue Dependency, nur die vier neuen Scope-Dateien. Produktionsdatei bleibt ein dünner Adapter, ohne Resolution-Switch, Wissensmodell oder zusätzliche Winning-Regeln. Präzise Autorenpfade und strikt minimales Spielergebnis gehören zum Vertrag.

Die vorliegende Lab-Evidenz prüft reale heutige Parser/Hashes sowie ausdrücklich simulierte MYST-0002-/Wrapper-Policies. Sie ersetzt diese spätere Abnahme nicht. Keine Freigabe, Push-, Registry- oder GitHub-Aktion folgt aus diesem Draft.
