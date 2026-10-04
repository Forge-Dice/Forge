# MYSTERY ACCUSATION & VERDICT DESIGN

Status: **Design Research**. Keine Task-ID, kein Contract, kein Approval, kein Code. Arbeitstitel: MYSTERY-NEXT.
Stand 2026-10-03. Geprüft gegen `src/domain/case-solution.ts`, `case-truth.ts`, `tests/case-solution.test.ts` und `tests/case-solution.fixture.ts` auf `codex/mystery-task-0005` @ `fab792a`. Der Domain-Produktionscode ist auf allen Arbeitsbranches identisch.

Kurzfassung der Entscheidungen:

- **E1** Die öffentliche Funktion `evaluateConclusionClaim(truth, solution, claim)` kommt in `case-solution.ts` und ruft die unverändert private `resolveConclusion` auf. Die Wahrheitstabelle wird nicht dupliziert.
- **E2** Das Verdict wertet jede Spieleraussage gegen die **Resolutions** aus, nicht gegen den Katalog. Der Katalog wird nur gebraucht, um die `requiredConclusions` strukturell zu finden.
- **E3** `solved` gilt genau dann, wenn jedes Pflicht-Literal mit gleicher Polarität enthalten ist **und** keine Spieleraussage widerlegt ist. `undetermined` ist neutral.
- **E4** Negative Pflicht-Literale müssen ausdrücklich genannt werden. Es gibt keine Closed-World-Ergänzung.
- **E5** Doppelte oder widersprüchliche Aussagen zum selben Claim sind Eingabefehler beim Parsen, kein Verdict.
- **E6** Eine Anklage wird an Truth gebunden (`caseId`, `truthHash`), nie an die Solution.

---

## 1. Domain Semantics

### 1.1 Was TASK-0003 tatsächlich festlegt

| Element | Tatsächlicher Code | Bedeutung für die Anklage |
|---|---|---|
| `ConclusionClaim` | 6 Arten, alle strikt, exportiert als `ConclusionClaimSchema` | Spieleraussagen verwenden genau diese Form. Es entsteht keine neue Claim-Art. |
| `resolveConclusion(claim, resolution, event)` | privat, Wahrheitstabelle TASK-0003 §6, liefert `true \| false \| "undetermined"` | Die einzige Quelle der Bewertung |
| Kausalität | nur direkte Kanten aus `truth.events[].causedByEventIds`; mit `causesComplete` sonst `false`, ohne `undetermined` | Eine transitive Ursache ist falsch bzw. offen, nie wahr |
| Rollen | `roles: null` heißt Rolle unbekannt, also `undetermined`. Eine bekannte Rollenliste ist **geschlossen**, auch bei `partial`. | `planner` ist bei `[direct_actor]` falsch |
| `requiredConclusions` | `min(1)`, eindeutig; jedes Literal muss exakt zu seinem Status auflösen | **Ein Pflicht-Literal kann nie `undetermined` sein.** Test: `tests/case-solution.test.ts:303` „rejects an undetermined conclusion required as %s“. |
| Katalog `conclusions` | `min(1)`, IDs eindeutig, **Claims strukturell eindeutig** (`claimKey`, „Same claim as …“); jede Conclusion braucht eine Resolution für ihr Event | Zwei Katalogeinträge können nie dieselbe Claim-Struktur haben. Eine ID-Mehrdeutigkeit ist damit ausgeschlossen. |
| Katalogeinträge außerhalb von required | dürfen `false` oder `undetermined` sein (Test Zeile 88) | Sie sind kein Wahrheitsspeicher. Die Bewertung stammt immer aus den Resolutions. |
| Event ohne Resolution | im Parser für Conclusions verboten; als Ursache erlaubt (Test Zeile 99) | Der Answer Key sagt zu solchen Events nichts aus. |

### 1.2 Begriffe

- **Literal**: `{ claim: ConclusionClaim, value: boolean }`, also eine behauptete Aussage mit Polarität. `value:false` ist die Verneinung („B ist nicht verantwortlich“).
- **Status** eines Claims: `true | false | "undetermined"`, ausschließlich aus `resolveConclusion`.
- **Bewertung eines Spieler-Literals**:
  - `matched`: Status ist bestimmt und gleich `value`.
  - `contradicted`: Status ist bestimmt und ungleich `value`.
  - `undetermined`: Status ist `"undetermined"`.
- **Pflicht-Literal**: ein Element von `requiredConclusions`, aufgelöst zu `(claim aus dem Katalog, value)`.

### 1.3 Invarianten (normativ für den späteren Contract)

1. Die Anklage ändert weder `CaseSolution` noch `CaseTruth` noch `requiredConclusions`. Alle drei sind tief eingefroren; die Evaluation liest nur.
2. Die Anklage erzeugt keine Wahrheit. Ihr `value` ist eine Behauptung und wird nie als `truth` gespeichert.
3. Resolution-Daten (Rollenlisten, Vollständigkeit, Intent, Mechanismus, `causesComplete`) erscheinen nie im spielerseitigen Ergebnis.
4. Für die Bewertung wird kein LLM, keine Zufallsquelle, keine Systemzeit und kein Text- oder Namensvergleich verwendet.

---

## 2. Public Conclusion Evaluation API

### 2.1 Signatur, abgeleitet aus dem Code

`resolveConclusion` braucht `resolution` (aus der Solution) **und** `event` (aus der Truth, wegen `causedByEventIds`). Deshalb braucht die öffentliche Funktion beide Dokumente. Weil eine `CaseSolution` per Typ nicht an eine bestimmte Truth gebunden ist (Brand ohne Truth-Identität), muss die Bindung zur Laufzeit geprüft werden.

```ts
// in src/domain/case-solution.ts, zusätzlich exportiert
export type ConclusionStatus = boolean | "undetermined";

export type ConclusionEvaluation =
  | { readonly success: true; readonly status: ConclusionStatus }
  | { readonly success: false; readonly code: "SOLUTION_BINDING_MISMATCH" | "INVALID_CLAIM" | "UNKNOWN_REFERENCE" };

export function evaluateConclusionClaim(
  truth: CaseTruth,
  solution: CaseSolution,
  claim: unknown,
): ConclusionEvaluation;
```

Ablauf (normativ):

1. Bindung prüfen: `solution.caseId === truth.caseId` und `solution.truthHash === hashCaseTruth(truth)`. Sonst `SOLUTION_BINDING_MISMATCH`.
2. `claim` mit dem bereits exportierten `ConclusionClaimSchema.safeParse` prüfen. Sonst `INVALID_CLAIM`. Danach wird **nur die geparste Kopie** verwendet (kein erneutes Lesen des Originals, also kein Getter-TOCTOU).
3. Referenzen gegen die Truth prüfen: `eventId`, `personId`, `causeEventId`. Sonst `UNKNOWN_REFERENCE`.
4. Resolution für `claim.eventId` suchen. **Ohne Resolution ist der Status `"undetermined"`**, denn der Answer Key macht zu diesem Event keine Aussage.
5. Sonst `resolveConclusion(parsed, resolution, event)` aufrufen und das Ergebnis eingefroren zurückgeben.

### 2.2 Warum genau so

- **Keine Duplizierung**: Die Funktion ist nur ein Wrapper (Bindung, Parse, Lookup, Delegation). `resolveConclusion`, `claimKey` und `checkSolution` bleiben privat und unverändert.
- **TASK-0003 bleibt Source of Truth**: Der vorhandene Black-Box-Prober `statusOf` in `tests/case-solution.test.ts:35` leitet den Status über den Parser ab. Er ist ein fertiges Orakel für einen Differentialtest: Für jeden Claim mit vorhandener Resolution muss `evaluateConclusionClaim` dasselbe liefern wie `statusOf`.
- **`claim: unknown`** statt `ConclusionClaim`: So ist die öffentliche API auch für nicht vorgeprüfte Eingaben sicher. Die Kosten liegen bei einem `safeParse`.
- **Ergebnis-Union statt Exception**: Diese Form ist analog zu `ProjectionResult` aus TASK-0004. Ein Fehlerfall ist nie mit `false` oder `undetermined` verwechselbar.
- **Kein Factory-Objekt**: Ein Hash pro Aufruf ist bei Fallgrößen von wenigen Dutzend Entitäten unkritisch. Die Alternative steht in den offenen Entscheidungen.

### 2.3 Was die API bewusst nicht tut

Sie bietet keinen Katalog-Lookup, keine Conclusion-IDs, keine Ausgabe von Resolution-Daten, keine Begründung und keine transitive Kausalität.

---

## 3. Player Accusation Model

### 3.1 Eingabe

```ts
AccusationInput = {
  schemaVersion: 1;
  caseId: CaseId;
  truthHash: string;            // lowercase SHA-256 von hashCaseTruth
  literals: {
    claim: ConclusionClaimInput; // exakt ConclusionClaimSchema, strikt
    value: boolean;
  }[];                          // darf leer sein
};
```

- Es gibt **keine Conclusion-IDs** in der Eingabe; ein Feld `conclusionId` wird als `unrecognized_keys` abgelehnt.
- Es gibt **kein `solutionHash`**: Die Anklage ist eine Aussage über die Welt, nicht über den Answer Key. Eine Revision der Solution macht die Anklage nicht ungültig, und die Identität des Answer Keys gelangt nie in Spielerhand.
- Freitext, Namen, Begründungen oder Gewichtungen gibt es nicht.

### 3.2 Parsing (an Truth gebunden, ohne Solution)

```ts
createAccusationSchema(truth: CaseTruth)  // Zod-Schema, analog createCaseSolutionSchema
parseAccusation(input: unknown, truth: CaseTruth): Accusation
```

Prüfregeln in dieser Reihenfolge:

1. Striktes Shape, `schemaVersion` 1, Claim-Strukturen über `ConclusionClaimSchema`.
2. Bindung: `caseId` und `truthHash` gegen die übergebene Truth. Bei einem Fehler bricht die Prüfung ab, wie in TASK-0003.
3. Referenzen jedes Claims gegen die Truth, mit Pfad `["literals", i, "claim", "<feld>"]`.
4. Eindeutigkeit nach strukturellem Claim-Schlüssel. Das spätere Vorkommen wird gemeldet unter `["literals", j, "claim"]`, **unabhängig von `value`**. Das deckt Duplikate und Widersprüche ab.
5. Transform: Literale **kanonisch sortieren** (nach Claim-Schlüssel, dann `value`), klonen, tief einfrieren, Brand `"Accusation"`.

Das Parsing braucht keine Solution. Daraus folgt: **Ob eine Anklage gültig ist, verrät nie etwas über den Answer Key.**

### 3.3 Warum kanonische Sortierung

Permutationen der Eingabe ergeben dann bytegleiche geparste Anklagen und bytegleiche interne Reports. Das ist eine starke, billig testbare Eigenschaft und vermeidet indexbasierte Reports, die von der Eingabereihenfolge abhängen.

---

## 4. Verdict Algorithm

```ts
evaluateAccusation(accusation: Accusation, truth: CaseTruth, solution: CaseSolution): AccusationResult
```

1. **Bindung**: Anklage an Truth (`caseId`, `truthHash`) und Solution an Truth (`caseId`, `truthHash`). Bei einem Fehler: `{ success:false, code:"ACCUSATION_BINDING_MISMATCH" }`. Es gibt dann **kein** Verdict.
2. **Bewertung**: Jedes Spieler-Literal geht durch `evaluateConclusionClaim`. Daraus wird `matched`, `contradicted` oder `undetermined`. Nach erfolgreichem Parsing und erfolgreicher Bindung ist ein Fehlercode hier unerreichbar; tritt er dennoch auf, wird er als Binding-Mismatch behandelt (defensiv, ohne Verdict).
3. **Abdeckung**: Für jedes Pflicht-Literal `(katalog[id].claim, value)` wird der Claim-Schlüssel gebildet. Es ist `covered`, wenn die Anklage ein Literal mit gleichem Schlüssel **und** gleichem `value` enthält, sonst `missing`.
4. **Verdict**:

```
solved  ⇔  missing = ∅  ∧  contradicted = ∅
sonst not_solved
```

Folgerungen, die ohne Zusatzregel gelten:

- Ein abgedecktes Pflicht-Literal ist automatisch `matched`, weil TASK-0003 garantiert, dass es zu genau seinem `value` auflöst.
- Ein Pflicht-Literal mit falscher Polarität ist zugleich `contradicted` und `missing`.
- Eine leere Anklage ist immer `not_solved`, da `requiredConclusions` mindestens ein Element hat.

---

## 5. Treatment of Extra Claims

„Extra“ heißt: ein Literal, dessen Claim kein Pflicht-Literal ist. Es wird **wie jedes andere** gegen die Resolutions bewertet, unabhängig davon, ob der Claim im Katalog steht.

| Extra-Literal | Bewertung | Wirkung |
|---|---|---|
| korrekt (positiv oder negativ) | matched | neutral |
| falsch (Answer Key bestimmt das Gegenteil) | contradicted | **not_solved** |
| vom Answer Key offengelassen | undetermined | neutral |
| zu einem Event ohne Resolution | undetermined | neutral |

**Warum gegen die Resolutions und nicht gegen den Katalog?** Bei einer Katalog-Bewertung würde eine falsche Zusatzanklage, die zufällig nicht im Katalog steht, ignoriert. Beispiel: Die Verantwortung für `death` ist `complete` mit `{a}`, im Katalog steht nur `resp(a)`. Der Spieler klagt zusätzlich Clara an, und bei einer Katalog-Bewertung wäre der Fall gelöst. Das wäre ein echter False Positive. Die Resolution-Bewertung erkennt `resp(c)=false` und verhindert ihn.

### Sebs Beispiel „False Positive“, ausdrücklich entschieden

Required: `Max responsible = true`. Spieler: `Max = true`, `Anna = true`.

| Answer Key zu Anna | Status `resp(Anna)` | Verdict |
|---|---|---|
| Anna ist zugewiesen (Mitverantwortliche) | true, matched | **solved**, denn die Aussage ist richtig |
| `completeness: complete`, Anna nicht zugewiesen | false, contradicted | **not_solved** |
| `completeness: partial`, Anna nicht zugewiesen | undetermined | **solved** (Entscheidung 2, siehe Risiko in §6) |

### Sebs Beispiel „False Negative“, ausdrücklich entschieden

Required: `Max = true`, `Anna = false`. Spieler nennt nur Max.
**Verdict: not_solved.** `Anna=false` ist ein Pflicht-Literal und fehlt.

Begründung: Eine stillschweigende Ergänzung („wer nicht genannt wird, ist unschuldig“) wäre Inferenz außerhalb von TASK-0003 und hinge an der Frage, welche Personen der Spieler überhaupt kennt. Der Autor hat zwei Hebel: `Anna=false` nicht als Pflicht setzen, oder später eine Formular-Schicht bauen, die „genau diese Täter“ in explizite Literale über die dem Spieler bekannten Personen übersetzt. Diese Schicht ist ein Folge-Task, nicht Teil von V1.

---

## 6. Treatment of Undetermined

Entscheidung 2 lautet: nicht bestätigt, nicht widerlegt, keine Strafe. Adversariale Prüfung:

| Angriff / Frage | Ergebnis | Bewertung |
|---|---|---|
| Kann `undetermined` ein Pflicht-Literal erfüllen? | Nein. Pflicht-Literale sind per TASK-0003 immer bestimmt (Test Zeile 303). | sicher |
| Kann der Spieler doppelt wetten („X=true“ und „X=false“)? | Nein, das wird als doppelter Claim-Schlüssel abgelehnt (§3.2 Regel 4). | sicher |
| Kann ein undetermined-Literal ein Pflicht-Literal verdecken oder ersetzen? | Nein. Die Abdeckung verlangt gleichen Schlüssel und gleichen `value`, und ein Pflicht-Claim ist nie undetermined. | sicher |
| Widersprechen sich zwei undetermined-Literale logisch (z. B. `noPerson(e)=true` und `resp(a,e)=true` bei `partial []`)? | Wird nicht erkannt, da es keine Inferenz zwischen Claims gibt. | **harmlos**: undetermined-Literale tragen nie zu `solved` bei, und ein bestimmter Widerspruch würde als contradicted erkannt |
| **Schrotflinte**: Bei `partial` werden alle Personen zusätzlich angeklagt | Nicht zugewiesene Personen sind undetermined, also kann der Fall **solved** sein. | **echtes Designrisiko** |
| Falsche Kausaltheorie bei `causesComplete:false` | undetermined, keine Strafe | Konsequenz der Entscheidung, akzeptabel |
| Rollenbehauptung bei `roles:null` | undetermined | akzeptabel; eine solche Rolle kann nie Pflicht sein |

**Zum Schrotflinten-Risiko.** Es ist die direkte Folge von Entscheidung 2 zusammen mit `partial`. Ich empfehle, Entscheidung 2 beizubehalten und das Risiko beim Autor zu verankern:

- Für jedes Event, auf das sich Pflicht-Verantwortung bezieht, sollte die Verantwortung `complete` sein. Dann ist jede falsche Zusatzanklage `contradicted`.
- Das wird in V1 **nicht** erzwungen, denn es wäre eine neue Regel für TASK-0003. Es gehört als Lint in den späteren Solvability-Task. Die Alternative („unbelegte positive Personenanklage zählt als Fehler“) steht unter den offenen Entscheidungen.

**Darf der Spieler eine kanonisch undeterminierte Conclusion behaupten?** Ja, sie ist neutral.
**Wird sie ignoriert?** Für das Verdict ja; intern wird sie als `undetermined` gezählt.
**Kann sie Pflicht sein?** Nein, das schließt TASK-0003 bereits aus.

---

## 7. Equality and Identity

- **Claim-Gleichheit ist strukturell**: Diskriminator plus alle definierten Felder, Property-Reihenfolge egal. Das entspricht dem privaten `claimKey` in TASK-0003 (flache Claims, Einträge nach UTF-16-Codeeinheiten sortiert, `JSON.stringify`).
- **Problem**: `claimKey` ist privat. Das Accusation-Modul braucht dieselbe Gleichheit für die Abdeckung und die Duplikaterkennung.
  - Empfehlung: In `case-accusation.ts` lokal denselben Schlüssel bilden. Es sind etwa 4 Zeilen, und **Gleichheit ist keine Wahrheitstabelle**. Ein Differentialtest prüft, dass zwei Claims genau dann als gleich gelten, wenn TASK-0003 sie als „Same claim“ ablehnt (über den Parser beobachtbar).
  - Alternative: `claimKey` ebenfalls exportieren. Das öffnet TASK-0003 weiter, was Seb vermeiden will.
- Es gibt **keine Abhängigkeit von Conclusion-IDs**. Der Spieler kennt sie nie; sie erscheinen nur im internen Report.
- „Gleiche Claim-Struktur mit anderer Conclusion-ID“ ist im Katalog unmöglich, weil TASK-0003 sie ablehnt. In der Anklage gibt es keine IDs, deshalb ist der Fall dort gegenstandslos.
- Es gibt keine Namens- oder Textvergleiche. Zahlen kommen in Conclusion-Claims nicht vor.

### Unknown Claims

| Fall | Behandlung |
|---|---|
| Ungültige Form (falsches Literal, fehlendes Feld, Zusatzfeld, ID-Regex verletzt, Selbstursache) | Parse-Fehler (Zod-Pfad) |
| Gültige Form, aber eine Entität existiert nicht in der Truth | Parse-Fehler, `Unknown person/event` am Feldpfad |
| Gültige Entitäten, Claim nicht im Katalog | **gültig**; Bewertung über die Resolutions (matched, contradicted oder undetermined) |
| Bekannte Conclusion mit falscher Polarität | contradicted; ist sie Pflicht, zusätzlich missing |

---

## 8. Internal vs Player-visible Result

```ts
AccusationResult =
  | { success: true; evaluation: AccusationEvaluation }
  | { success: false; code: "ACCUSATION_BINDING_MISMATCH" };

AccusationEvaluation = {
  verdict: "solved" | "not_solved";
  report: {
    matched: number;                     // Anzahl
    contradicted: number;
    undetermined: number;
    missingRequired: number;
  };
};

PlayerVerdict = { verdict: "solved" | "not_solved" };
toPlayerVerdict(evaluation): PlayerVerdict // baut ein neues, eingefrorenes Objekt
```

**Entscheidung: Der interne Report enthält nur Zähler.**

- Die Kategorien `matched`, `contradicted`, `undetermined` und `missing` sind nötig, weil sie das Verdict vollständig erklären. Diese Zahlen reichen für Tests, Telemetrie und spätere Hint-Systeme.
- `unknown` gibt es nicht, da unbekannte Referenzen Parse-Fehler sind und Claims außerhalb des Katalogs regulär bewertet werden.
- Keine Liste fehlender Conclusion-IDs, keine Claims pro Kategorie: Eine solche Liste wäre ein fertiger Spoiler, falls der Report versehentlich an die UI gelangt. Wer später Detail-Hinweise will, braucht einen eigenen Task mit eigener Informationsfreigabe.
- Die Trennung folgt TASK-0005 (`intent` versus `act`): `toPlayerVerdict` ist die **einzige** vorgesehene Übergabe an Spielerseite. Tests prüfen, dass `Object.keys(playerVerdict)` genau `["verdict"]` ist und dass `PlayerVerdict` für alle `not_solved`-Fälle bytegleich ist.
- Auch die Zähler sind in Spielerhand ein Orakel (zum Beispiel „1 widerlegt“). Sie bleiben deshalb intern.

Alle Ergebnisse sind tief eingefroren und haben eine feste Schlüsselreihenfolge, sodass `JSON.stringify` deterministisch ist.

---

## 9. Adversarial-Matrix (46 Fälle)

### Fixture (Erweiterung des bestehenden Gift-Falls aus `tests/case-solution.fixture.ts`)

Truth unverändert: Personen a, b, c; Events `purchase` → `poisoning` → `death`, dazu `storm` (keine Kanten).

Solution **S1**:

| Event | completeness | assignments | intent | mechanism | causesComplete |
|---|---|---|---|---|---|
| death | complete | a `[planner, direct_actor]`, b `[facilitator]` | intended | ordinary | true |
| poisoning | partial | a `null` | null | null | false |
| storm | complete | `[]` | not_applicable | ordinary | true |
| purchase | **keine Resolution** | | | | |

Pflicht R1: `resp(a,death)=T`, `resp(b,death)=T`, `resp(c,death)=F`, `intent(death,intended)=T`.
Varianten: **S2** = S1 mit Pflicht nur `resp(a,death)=T`; **S3** = S1, aber `storm` als `partial []`; **S4** = S1 mit Pflicht `resp(a,poisoning)=T`.
Schreibweise: `resp(p,e)`, `role(p,e,r)`, `none(e)`, `cause(x→e)`, `intent(e,v)`, `mech(e,v)`.

| # | Setup | Anklage (Kurzform) | Literal-Bewertung | Ergebnis | Prüft |
|---|---|---|---|---|---|
| 1 | S1 | genau R1 | 4 matched | **solved** | perfekte Lösung |
| 2 | S1 | leer | missing 4 | **not_solved** | leere Anklage |
| 3 | S1 | `resp(a)=T`, `resp(b)=T` | 2 matched, missing 2 | **not_solved** | halbe Lösung |
| 4 | S1 | R1 ohne `resp(c)=F` | missing 1 | **not_solved** | fehlende negative Pflicht |
| 5 | S1 | R1 mit `resp(c)=T` statt F | contradicted 1, missing 1 | **not_solved** | falscher Zusatztäter bei Pflicht |
| 6 | S2 | `resp(a)=T`, `resp(c,death)=T` | c contradicted (complete) | **not_solved** | False Positive, complete |
| 7 | S2 | `resp(a)=T`, `resp(b,death)=T` | b matched (facilitator) | **solved** | Mitverantwortlicher korrekt |
| 8 | S4 | `resp(a,poison)=T`, `resp(b,poison)=T` | b undetermined | **solved** | False Positive bei partial (Risiko §6) |
| 9 | S4 | `resp(a,poison)=T`, `resp(b,poison)=T`, `resp(c,poison)=T` | 2 undetermined | **solved** | Schrotflinte bei partial |
| 10 | S2 | `resp(a)`, `resp(b)`, `resp(c)` alle T zu death | c contradicted | **not_solved** | Schrotflinte bei complete |
| 11 | S1 | R1 + ein zweites `resp(c,death)=F` | Duplikat | **Parse-Fehler** `["literals",j,"claim"]` | Duplikat gleicher Polarität |
| 12 | S1 | R1 + `resp(a,death)=F` | Duplikat | **Parse-Fehler** | Widerspruch desselben Spielers |
| 13 | S1 | `resp(a)=T` doppelt mit vertauschter Property-Reihenfolge | Duplikat | **Parse-Fehler** | Schlüssel unabhängig von Reihenfolge |
| 14 | S1 | R1 mit permutierter Property-Reihenfolge in jedem Claim | wie #1 | **solved**, bytegleich zu #1 | Property-Reihenfolge |
| 15 | S1 | R1, alle 24 Literal-Permutationen | wie #1 | **solved**, geparste Anklage und Report bytegleich | Reihenfolgepermutationen |
| 16 | S1 | R1 + `none(death)=F` | matched | **solved** | korrekte negative Zusatzaussage |
| 17 | S1 | R1 + `mech(death,supernatural)=T` | contradicted | **not_solved** | korrekt + falscher Extra-Claim |
| 18 | S1 | R1 + `resp(b,poisoning)=T` | undetermined | **solved** | korrekt + undetermined Extra |
| 19 | S1 | R1 + `intent(poisoning,intended)=F` | undetermined (intent null) | **solved** | negative undetermined Extra; intent null |
| 20 | S1 | R1 + `mech(poisoning,ordinary)=T` | undetermined | **solved** | mechanism null |
| 21 | S1 | R1 + `resp(a,purchase)=T` | undetermined (keine Resolution) | **solved** | Event ohne Resolution |
| 22 | S1 | R1 mit `resp(b)=F` | contradicted, missing | **not_solved** | bekannte Conclusion, falsche Polarität |
| 23 | S1 | Literal mit Feld `conclusionId` | | **Parse-Fehler** `unrecognized_keys` | keine IDs vom Spieler |
| 24 | S1 | `resp("person:zed",death)=T` | | **Parse-Fehler** `["literals",i,"claim","personId"]` | fremde ID |
| 25 | S1 | `resp("max",death)` | | **Parse-Fehler** (Regex) | ungültige ID-Form |
| 26 | S1 | `cause(event:ghost→death)=T` | | **Parse-Fehler** `…"causeEventId"` | unbekannte Ursache |
| 27 | S1 | `cause(death→death)=T` | | **Parse-Fehler** (Schema-Refine) | Selbstursache |
| 28 | S1 | R1 + `resp(c,storm)=T` (nicht im Katalog) | contradicted (storm complete []) | **not_solved** | Claim außerhalb des Katalogs, bestimmt |
| 29 | S1 | R1 + `resp(c,poisoning)=F` (nicht im Katalog) | undetermined | **solved** | Claim außerhalb des Katalogs, offen |
| 30 | S1 | R1 + `none(storm)=T` | matched | **solved** | complete [] |
| 31 | S1 | R1 + `resp(a,storm)=T` | contradicted | **not_solved** | complete [] gegen Personenanklage |
| 32 | S3 | R1 + `none(storm)=T` | undetermined | **solved** | partial [] |
| 33 | S3 | R1 + `none(storm)=T` + `resp(a,storm)=T` | 2 undetermined | **solved** | logischer Widerspruch unter undetermined (dokumentierte Grenze) |
| 34 | S1 | R1 + `role(a,death,planner)=T` | matched | **solved** | Rolle |
| 35 | S1 | R1 + `role(a,death,planner)=T` + `role(a,death,direct_actor)=T` | 2 matched | **solved** | mehrere Rollen, verschiedene Schlüssel |
| 36 | S1 | R1 + `role(a,death,facilitator)=T` | contradicted (geschlossene Liste) | **not_solved** | falsche Rolle |
| 37 | S1 | R1 + `role(a,poisoning,direct_actor)=T` | undetermined (roles null) | **solved** | Rolle unbekannt |
| 38 | S1 | R1 + `role(c,death,planner)=F` | matched (complete, nicht zugewiesen) | **solved** | negative Rolle |
| 39 | S1 | R1 + `cause(poisoning→death)=T` | matched | **solved** | direkte Ursache |
| 40 | S1 | R1 + `cause(purchase→death)=T` | contradicted (nur transitiv, complete) | **not_solved** | direkt vs. transitiv |
| 41 | S1 | R1 + `cause(storm→poisoning)=T` | undetermined (`causesComplete:false`) | **solved** | causesComplete false |
| 42 | S1 | R1 + `cause(purchase→poisoning)=T` | matched (Kante existiert) | **solved** | Kante bei incomplete |
| 43 | S1 | R1 + `intent(storm,not_applicable)=T` + `intent(storm,intended)=F` | 2 matched | **solved** | not_applicable als Wert |
| 44 | S1 | R1 geparst; danach das Input-Objekt mutiert (`value` kippen, Literal anhängen) | wie #1 | **solved**, geparste Anklage unverändert und eingefroren | manipuliertes ungeparstes Input |
| 45 | S1 | ungeparstes Objekt an `evaluateAccusation` | | **Compile-Fehler** (`@ts-expect-error`, Brand) | Typgrenze |
| 46 | S1 | Anklage gegen Truth T geparst, mit Truth T′ (andere Revision) und passender Solution ausgewertet | | `ACCUSATION_BINDING_MISMATCH` | fremde Bindung |
| 47 | S1 | Solution an T′ gebunden, Truth T | | `ACCUSATION_BINDING_MISMATCH` bzw. `SOLUTION_BINDING_MISMATCH` in der Domain-API | Solution-Bindung |
| 48 | S1 | beliebige Fälle oben | | Truth und Solution danach tief gleich und eingefroren; `hashCaseSolution` unverändert | keine Mutation |
| 49 | alle | `toPlayerVerdict` für alle not_solved-Fälle | | bytegleich `{"verdict":"not_solved"}`; Schlüssel nur `verdict` | Informationsgrenze |
| 50 | alle | Evaluation zweimal | | bytegleiches JSON, alle Teile eingefroren | Determinismus |

Hinweis zu #11: R1 enthält bereits `resp(c,death)=F`; ein zweites identisches Literal ist das Duplikat.

### Parametrische Tests (zusätzlich zur Matrix)

- **P1 Differential Domain-API gegen TASK-0003**: Für alle Claims über `{a,b,c} × {Events mit Resolution} × alle Rollen/Werte` und alle Resolution-Varianten aus der bestehenden Tabelle (`tests/case-solution.test.ts:261–292`) gilt: `evaluateConclusionClaim(...).status === statusOf(...)`.
- **P2 Verdict-Orakel**: Für zufällig erzeugte (seeded, deterministisch) Teilmengen aller gültigen Literale gilt: `solved ⇔ (R ⊆ A) ∧ (∀ l∈A: status(l) ∈ {l.value, undetermined})`. Das Orakel wird im Test unabhängig formuliert.
- **P3 Monotonie**: Ein neutrales Literal (matched oder undetermined) hinzuzufügen ändert ein Verdict nie. Ein contradicted-Literal hinzuzufügen macht jedes Verdict zu `not_solved`.
- **P4 Permutation**: Literal- und Property-Reihenfolge ändern nichts (bytegleich).

---

## 10. Edge Cases from TASK-0003

| TASK-0003-Eigenschaft | Konsequenz |
|---|---|
| required ist nie undetermined (`test:303`) | Abdeckung verlangt nur Schlüssel und `value`; bei Undetermined braucht es keine Sonderbehandlung |
| `requiredConclusions.min(1)` | leere Anklage ist nie solved |
| Katalog-Claims strukturell eindeutig | Abbildung Pflicht-Literal → Claim-Schlüssel ist eindeutig |
| Katalogeinträge außerhalb der Pflicht dürfen false oder undetermined sein | Der Katalog ist kein Wahrheitsspeicher; die Bewertung kommt aus den Resolutions (E2) |
| Rollenliste geschlossen trotz partial | `role(a,death,facilitator)` ist **false**, nicht undetermined (#36) |
| `roles:null` → Rolle undetermined, aber `resp` true | #37 |
| Kausalität nur direkt | #40; transitive Spielertheorien werden bei complete bestraft. Das ist korrekt laut TASK-0003, sollte aber in der späteren Spieler-Formulierung („direkte Ursache“) klar sein |
| Ursachenevent braucht keine Resolution | `cause(purchase→poisoning)` ist auswertbar (#42) |
| Conclusion auf Event ohne Resolution verboten | Spieler-Claims dazu sind undetermined (#21); im Katalog kommen sie nie vor |
| `targets` werden nie ausgewertet | Opfer/Ziele sind kein Anklagegegenstand in V1 |
| `responsibility` impliziert keine Anwesenheit | Die Anklage prüft keine `personAt`-Fakten; kein Bezug zu Evidence |

---

## 11. Proposed File Boundaries

| Datei | Art | Inhalt |
|---|---|---|
| `src/domain/case-solution.ts` | **modify (additiv)** | `ConclusionStatus`, `ConclusionEvaluation`, `evaluateConclusionClaim`. Kein bestehender Export und keine private Funktion ändert sich; `resolveConclusion` und `claimKey` bleiben privat. |
| `src/domain/case-accusation.ts` | create | Accusation-Schema-Factory, `parseAccusation`, `evaluateAccusation`, `toPlayerVerdict`, Typen, lokaler Claim-Schlüssel, deepFreeze |
| `tests/conclusion-evaluation.test.ts` | create | Domain-API und Differential P1 |
| `tests/case-accusation.fixture.ts` | create | S1 bis S4 als Factories |
| `tests/case-accusation.test.ts` | create | Matrix #1–#50, P2–P4 |
| `tests/case-accusation.typecheck.ts` | create | Brand, readonly, `@ts-expect-error` |

Bestehende Tests, `package.json`, Lockfile und `tsconfig.json` bleiben unverändert. Es gibt keine neue Dependency und keine Abhängigkeit von TASK-0002, 0004 oder 0005.

Erlaubte Imports in `case-accusation.ts`: `zod`; aus `case-truth.ts` `CaseIdSchema`, die Typen `CaseTruth` und `DeepReadonly`; `hashCaseTruth`; aus `case-solution.ts` `ConclusionClaimSchema`, `evaluateConclusionClaim` sowie die Typen `CaseSolution` und `ConclusionClaim`. **Kein** `hashCaseSolution`, denn die Anklage ist nicht an die Solution gebunden.

## 12. Estimated Production/Test Size

| Teil | Zeilen (inkl. Kommentare) |
|---|---|
| Zusatz in `case-solution.ts` | 35–50 |
| `case-accusation.ts` | 170–230 |
| **Produktion gesamt** | **≈ 205–280**, also im Ziel 250–350 |
| Tests und Fixtures | ≈ 600–900 |

Falls das Ziel überschritten wird, kann so reduziert werden: `toPlayerVerdict` entfällt und die Regel „nur `verdict` geht an Spieler“ wird reine Contract-Regel (spart etwa 10 Zeilen); oder der Report entfällt ganz (spart etwa 15 Zeilen). Schrumpfen dürfen **nicht** die Bindungsprüfung, die Duplikaterkennung und die Referenzprüfung.

## 13. Open Decisions

| # | Frage | Empfehlung |
|---|---|---|
| D1 | Schrotflinte bei `partial`: neutral lassen (Entscheidung 2) oder unbelegte positive Personenanklagen (`resp`/`role` mit `true`, Status undetermined) als Fehler werten? | Neutral lassen und `complete` als Autorenregel festschreiben; der Lint gehört in Solvability |
| D2 | Negative Pflicht-Literale ausdrücklich verlangen oder Closed-World-Ergänzung? | Ausdrücklich verlangen (E4); eine Formular-Schicht kommt später |
| D3 | Duplikate gleicher Polarität: Fehler oder still deduplizieren? | Fehler, aus Konsistenz mit TASK-0003 und weil es eindeutiger ist |
| D4 | Leere Anklage: gültig (→ not_solved) oder Parse-Fehler? | gültig |
| D5 | Event ohne Resolution in der Domain-API: `undetermined` oder eigener Fehlercode? | `undetermined` |
| D6 | `evaluateConclusionClaim` als Einzelfunktion (ein Hash pro Aufruf) oder als Factory, die einmal bindet? | Einzelfunktion |
| D7 | Claim-Schlüssel lokal nachbauen (mit Differentialtest) oder `claimKey` exportieren? | lokal nachbauen |
| D8 | Report: nur Zähler oder Listen? | nur Zähler |
| D9 | Obergrenze für die Zahl der Literale? | keine; der Claim-Raum ist endlich und Duplikate sind verboten |
| D10 | Zählt eine Anklage mit Parse-Fehler spielerseitig als Versuch? | Host-Sache, nicht V1 |

## 14. Recommended Contract Shape

Ein späterer Contract sollte im Forge-Core-Format (`---json`) etwa so aussehen. Das ist **kein** Contract, nur eine Formvorgabe:

```json
{
  "forgeContractFormat": 1,
  "taskId": "<offen>",
  "contractVersion": 1,
  "baseCommit": "<Baseline, die gerade parallel festgelegt wird>",
  "dependencies": [],
  "scope": {
    "create": [
      "src/domain/case-accusation.ts",
      "tests/conclusion-evaluation.test.ts",
      "tests/case-accusation.fixture.ts",
      "tests/case-accusation.test.ts",
      "tests/case-accusation.typecheck.ts"
    ],
    "modify": ["src/domain/case-solution.ts"]
  },
  "requiredChecks": [
    { "name": "typecheck", "command": "npm run typecheck" },
    { "name": "test", "command": "npm test" }
  ],
  "mutationSmoke": "required"
}
```

Gliederung des Contract-Textes:

1. Basis und Dependency-Fakten (exakte Exporte von `case-solution.ts`, privater Status von `resolveConclusion` und `claimKey`)
2. Diff-Grenze für `case-solution.ts`: nur additive Exporte, bestehende Zeilen bytegleich
3. Domain-API (§2) mit Fehlercodes und Ablaufreihenfolge
4. Accusation-Input und Parsing (§3)
5. Verdict-Regel als eine Formel (§4)
6. Tabellen für Extra-Claims und Undetermined (§5, §6) inkl. Sebs zwei Beispiele als normative Fälle
7. Informationsgrenze (§8)
8. Acceptance Criteria: Matrix #1–#50 plus P1–P4
9. Mutationsplan, mindestens: Verdict ignoriert contradicted; Abdeckung ignoriert `value`; undetermined zählt als matched; undetermined zählt als contradicted; Duplikatprüfung vergleicht `value` mit; fehlende Bindungsprüfung; Bewertung gegen den Katalog statt gegen die Resolutions; `toPlayerVerdict` reicht den Report durch
10. Non-Goals: keine UI, kein Formular- oder Closed-World-Adapter, keine Hints, keine Versuchslimits, keine Evidence-, Solvability- oder Player-Knowledge-Logik, kein LLM, keine neuen Claim-Arten, keine Änderung an TASK-0003-Semantik
11. Größenobergrenze: 300 Produktionszeilen

STOP. Keine weiteren Schritte ohne Auswahl der offenen Entscheidungen.
