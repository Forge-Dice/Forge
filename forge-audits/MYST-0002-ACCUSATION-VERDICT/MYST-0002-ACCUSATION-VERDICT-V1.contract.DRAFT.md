---json
{
  "forgeContractFormat": 1,
  "taskId": "MYST-0002",
  "contractVersion": 1,
  "baseCommit": "3d7545d843883418348004e68717399a64da7a7d",
  "dependencies": [],
  "scope": {
    "create": [
      "src/domain/case-accusation.ts",
      "tests/case-accusation.fixture.ts",
      "tests/case-accusation.test.ts",
      "tests/case-accusation.typecheck.ts",
      "tests/conclusion-evaluation.test.ts"
    ],
    "modify": [
      "src/domain/case-solution.ts"
    ]
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
# MYST-0002 v1 — Accusation & Verdict V1 (DRAFT IMPLEMENTATION CONTRACT)

Status: **DRAFT**. Nicht reviewt, nicht attestiert, nicht registriert. Dieser Text behauptet keine Freigabe.
Spec-Entwurf: Claude (Projekt-Thread, read-only). Owner: Wuerfelduell (Seb).

## 0. Format und Herkunft

- Geschrieben im Format 1 (`---json`, `forgeContractFormat: 1`), weil `src/forge/contract-document.ts` auf der Basis nur `z.literal(1)` akzeptiert. Format 2 (`specifiedAgainst`, `reads`, `mutants`, `limits`, End-Marker) existiert auf `main` nicht und wird hier nicht vorgetäuscht. Felder, die Format 2 maschinenlesbar trägt, stehen in diesem Body als Prosa (§3 Reads, §12 Limits, §11 Mutanten).
- Der Frontmatter wurde mit dem Parser der Basis geprüft: `parseContractDocument` liefert `ok: true`.
- `dependencies` ist leer: Kein Task ist im ForgeLog akzeptiert, und es wird kein `acceptedCommit` erfunden (Präzedenz FORGE-CORE-0001B v2). Die tatsächliche Code-Abhängigkeit ist TASK-0001 (`case-truth.ts`, `case-truth.identity.ts`) und TASK-0003 (`case-solution.ts`), beide auf der Basis enthalten (Legacy, nicht Forge-managed). **Keine** Abhängigkeit zu TASK-0004 (NPC Knowledge).
- Task-ID MYST-0002. MYST-0001 ist PlayerRef V1. Historische TASK-0006-Referenzen werden weder verwendet noch umbenannt.
- Die geschlossenen Designentscheidungen D1–D10 (Owner, 2026-10-03) sind bindend und werden hier nur präzisiert, nicht neu verhandelt.

## 1. Basis

Repository `Forge-Dice/Forge`, Basis `3d7545d843883418348004e68717399a64da7a7d` (Merge PR #1). Auf dieser Basis: `npm run typecheck` grün, `npm test` 1087/1087 grün (22 Dateien).

Liegt beim Run-Start ein neuerer `main` vor, prüft der Developer zuerst, ob sich eine Datei aus §3 geändert hat (`git diff --stat 3d7545d..origin/main -- <reads>`). Jede Änderung dort ist ein Blocker: Run anhalten, Contract-Revision anfordern. Kein stilles Nachziehen.

## 2. Ziel

Eine Spieleranklage (Accusation) ist eine Menge strukturierter `ConclusionClaim`s mit behaupteter Polarität, gebunden an genau einen `CaseTruth`-Snapshot. Der Host stellt die konkrete `CaseSolution` bereit. Die Domain liefert für eine gültige Anklage genau ein Verdict `solved` oder `not_solved`; technische Fehler sind nie ein Verdict.

Dazu wird die bestehende private TASK-0003-Wahrheitstabelle `resolveConclusion` über **eine** öffentliche Funktion `evaluateConclusionClaim(truth, solution, claim)` erreichbar gemacht, ohne sie zu kopieren oder zu ändern.

## 3. Reads (vom Spec-Autor gelesen; Blob-SHAs auf der Basis)

| Datei | Blob | Relevanz |
|---|---|---|
| `src/domain/case-solution.ts` | `f06adf21fdd3d2b55d23d87cb9ad4b7f10e7c281` | `ConclusionClaimSchema`, privates `resolveConclusion` (Z. 126), privates `claimKey` (Z. 154), privates `type Status` (Z. 123), `CaseSolution`, `parseCaseSolution` |
| `src/domain/case-truth.ts` | `ecc698e23a59a603ffe8211baf2fc1209126e699` | `CaseTruth`, `CaseIdSchema`, `DeepReadonly`, Freeze-Muster |
| `src/domain/case-truth.identity.ts` | `c8ee8f78faa0cf4e158ec4c9a48a1bbb4fd6be98` | `hashCaseTruth` |
| `src/domain/npc-knowledge.projection.ts` | `6cd2da5b08b958838dd7544f8861f2fd6d7c03e2` | nur Konvention: Ergebnis-Union `{ success, code }`, `…_BINDING_MISMATCH` |
| `tests/case-solution.fixture.ts` | `a0c6c65eadfc4a739a7f3fc0085e697042360521` | `solutionTruth()`, `solutionTruthInput()` (Gift-Fall) |
| `tests/case-solution.test.ts` | `b42f0219c53514d0ad5eefb73c1735d9b9798aed` | Black-Box-Prober `statusOf` (Z. 35), AC-07-Tabelle |
| `tests/case-solution.typecheck.ts` | `691dd9f75f61f5e0e3560fd85e13545ff664e52f` | Muster für Compile-Zeit-Tests |

## 4. Scope

Neu: `src/domain/case-accusation.ts`, `tests/case-accusation.fixture.ts`, `tests/case-accusation.test.ts`, `tests/case-accusation.typecheck.ts`, `tests/conclusion-evaluation.test.ts`.

Geändert: `src/domain/case-solution.ts`, ausschließlich wie in §5.1 beschrieben.

Keine weiteren Dateien. Insbesondere unverändert: `package.json`, `package-lock.json`, `tsconfig.json`, `case-truth*.ts`, `case-solution.identity.ts`, `case-semantics.ts`, `npc-knowledge*.ts`, alle bestehenden Tests und Fixtures, alles unter `src/forge/`, `tests/forge*/`, `forge/`. Keine neue Dependency.

## 5. Öffentliche API (vollständig; nichts darüber hinaus exportieren)

### 5.1 `src/domain/case-solution.ts` (additiv, plus zwei begründete Einzeilen-Änderungen)

```ts
export type ConclusionStatus = Status; // Alias auf den bestehenden privaten Typ, keine zweite Definition

export type ConclusionEvaluation =
  | { readonly success: true; readonly status: ConclusionStatus }
  | { readonly success: false; readonly code: "SOLUTION_BINDING_MISMATCH" | "INVALID_CLAIM" | "UNKNOWN_REFERENCE" };

export function evaluateConclusionClaim(truth: CaseTruth, solution: CaseSolution, claim: unknown): ConclusionEvaluation;
```

Zulässige Änderungen an bestehenden Zeilen, genau diese zwei:

1. `function claimKey(claim: ConclusionClaim): string {` → `export function claimKey(claim: ConclusionClaim): string {`
   Begründung: D3 (Duplikat/Widerspruch) und die Abdeckung der `requiredConclusions` müssen exakt dieselbe strukturelle Gleichheit verwenden wie die bestehende Duplikatprüfung des Katalogs. Eine Kopie wäre eine zweite Gleichheitsdefinition.
2. Signatur von `resolveConclusion`: Parameter `resolution: EventResolution` → `resolution: DeepReadonly<EventResolution>`.
   Begründung: `CaseSolution.resolutions` ist `DeepReadonly`; ohne die Erweiterung lehnt `tsc` den Aufruf ab (geprüft: TS2345, `readonly` Array nicht zuweisbar). Reine Typ-Erweiterung, keine Laufzeitänderung, der bestehende Aufruf in `checkSolution` bleibt gültig. Kein `as`-Cast als Alternative.

Der **Rumpf** von `resolveConclusion`, `claimKey`, `checkSolution`, `deepFreeze`, `createCaseSolutionSchema`, `parseCaseSolution` sowie alle Schemas bleiben bytegleich. Es entsteht kein zweites `switch (claim.kind)` in Produktionscode.

`evaluateConclusionClaim`, normativer Ablauf:

1. Bindung: `solution.caseId !== truth.caseId || solution.truthHash !== hashCaseTruth(truth)` → `SOLUTION_BINDING_MISMATCH`. Wird vor der Claim-Prüfung geprüft.
2. `ConclusionClaimSchema.safeParse(claim)`; Fehler → `INVALID_CLAIM`. Danach nur noch die geparste Kopie verwenden (kein zweites Lesen von `claim`).
3. Referenzen gegen `truth`: `eventId` ∈ `truth.events`, `personId` (falls vorhanden) ∈ `truth.persons`, `causeEventId` (bei `eventCausedEvent`) ∈ `truth.events`; sonst `UNKNOWN_REFERENCE`.
4. Resolution mit `eventId === claim.eventId` in `solution.resolutions` suchen. Keine vorhanden → `{ success: true, status: "undetermined" }` (D5).
5. Sonst `{ success: true, status: resolveConclusion(parsedClaim, resolution, event) }`.

Jedes Ergebnisobjekt ist `Object.freeze`d. Die Funktion wirft für keine Eingabe vom Typ `unknown` als `claim` (bei korrekt geparster Truth und Solution).

### 5.2 `src/domain/case-accusation.ts` (neu)

```ts
export function createAccusationSchema(truth: CaseTruth); // Zod-Schema, Brand "Accusation", analog createCaseSolutionSchema
export type AccusationInput = z.input<ReturnType<typeof createAccusationSchema>>;
export type Accusation = z.output<ReturnType<typeof createAccusationSchema>>;
export function parseAccusation(input: unknown, truth: CaseTruth): Accusation; // wirft ZodError

export type Verdict = "solved" | "not_solved";
export type AccusationResult =
  | { readonly success: true; readonly verdict: Verdict }
  | { readonly success: false; readonly code: "ACCUSATION_BINDING_MISMATCH" | Extract<ConclusionEvaluation, { success: false }>["code"] };
export function evaluateAccusation(truth: CaseTruth, solution: CaseSolution, accusation: Accusation): AccusationResult;
```

Keine Klassen, keine Factory für die Evaluation, keine weiteren Exporte. `createAccusationSchema` ist kein Evaluations-Factory im Sinne von D6, sondern das bestehende Parse-Muster (`createCaseSolutionSchema`, `createNpcKnowledgeSchema`).

## 6. Accusation-Dokument und Binding

```ts
AccusationInput = {
  schemaVersion: 1,
  caseId: CaseId,          // CaseIdSchema
  truthHash: string,       // /^[0-9a-f]{64}$/, = hashCaseTruth(truth)
  literals: { claim: ConclusionClaimInput, value: boolean }[]   // darf leer sein (D4), keine Obergrenze (D9)
}
```

Alle Objekte strikt (`z.strictObject`), `claim` ist exakt das exportierte `ConclusionClaimSchema`. Kein `solutionHash`, keine `conclusionId`, kein Freitext. Unbekannte Schlüssel sind Parse-Fehler.

Parse-Prüfungen in `createAccusationSchema(truth)` (superRefine), in dieser Reihenfolge:

1. Bindung: `caseId === truth.caseId` (Pfad `["caseId"]`), `truthHash === hashCaseTruth(truth)` (Pfad `["truthHash"]`). Schlägt eines fehl, werden **keine** weiteren Prüfungen ausgeführt (wie `checkSolution`).
2. Referenzen je Literal gegen `truth`: Pfade `["literals", i, "claim", "eventId" | "personId" | "causeEventId"]`.
3. Eindeutigkeit nach `claimKey(literal.claim)`, **unabhängig von `value`** (D3): das spätere Vorkommen wird unter `["literals", j, "claim"]` gemeldet. Gleicher Schlüssel + gleicher Wert = Duplikat, gleicher Schlüssel + anderer Wert = struktureller Widerspruch; beides Parse-Fehler.

Transform: `structuredClone`, rekursiv `Object.freeze`, Brand `"Accusation"`. Reihenfolge der Literale bleibt die der Eingabe (keine kanonische Sortierung, kein Hash der Anklage in V1).

„Strukturell widersprüchlich“ heißt in V1 genau: gleicher `claimKey`, entgegengesetzte Polarität. Logische Unverträglichkeiten zwischen **verschiedenen** Claims (z. B. `eventIntent intended = true` und `eventIntent unintended = true`, `noPersonResponsibleForEvent = true` und `personResponsibleForEvent = true`) sind keine Parse-Fehler; sie werden einzeln gegen die Solution bewertet (siehe §13 K-2).

`evaluateAccusation(truth, solution, accusation)`, Binding:

1. `truthHash := hashCaseTruth(truth)` genau einmal.
2. Accusation an Truth: `caseId` und `truthHash` gleich, sonst `ACCUSATION_BINDING_MISMATCH`.
3. Solution an Truth: `caseId` und `truthHash` gleich, sonst `SOLUTION_BINDING_MISMATCH`. Diese Prüfung ist explizit und hängt **nicht** davon ab, dass mindestens ein Literal existiert.
4. Die Accusation ist **nicht** an eine Solution gebunden. Gleiche Truth mit anderer Solution-Revision ergibt ein gültiges Verdict gegen die übergebene Solution.

### 6.1 Fehler gegen fachliches Ergebnis

| Situation | Ergebnis |
|---|---|
| Eingabe kein Objekt, falsches Shape, Zusatzschlüssel, `schemaVersion ≠ 1` | Parse-Fehler (ZodError) |
| `caseId`/`truthHash` passen nicht zur Truth beim Parsen (fremder Case, andere Truth-Revision, geänderter Truth-Inhalt) | Parse-Fehler an `caseId`/`truthHash` |
| Claim-Struktur ungültig: unbekanntes `kind`, falscher ID-Präfix (z. B. `personId: "item:k"`), ungültige Rolle/Intent/Mechanism, Selbstursache, `value` nicht boolean | Parse-Fehler |
| Person/Event/Ursache-Event existiert nicht in der Truth | Parse-Fehler mit Feldpfad |
| Doppelter oder entgegengesetzter Claim (D3) | Parse-Fehler unter `["literals", j, "claim"]` |
| Accusation geparst gegen andere Truth als bei der Evaluation | `ACCUSATION_BINDING_MISMATCH` |
| Solution gehört zu anderer Truth | `SOLUTION_BINDING_MISMATCH` |
| Claim an Event ohne Resolution | gültig, Status `undetermined` (D5) |
| Leere Anklage | gültig, Verdict nach §7 (bei `requiredConclusions.min(1)` immer `not_solved`) |
| Anklage deckt nicht alle Pflichtliterale ab / ein Literal ist widerlegt | `not_solved` |

Ob ein Parse-Fehler einen Spielversuch kostet, ist Host-Policy (D10) und nicht Teil dieses Tasks.

## 7. Verdict-Semantik (normativ)

Für eine gebundene Anklage A, Truth T, Solution S:

- Für jedes Literal `(c, v)` in A: `e := evaluateConclusionClaim(T, S, c)`. `widerlegt(c, v) :⇔ e.status ∈ {true, false} ∧ e.status ≠ v`.
- Ein Pflichtliteral `(id, w)` aus `S.requiredConclusions` ist abgedeckt, wenn A ein Literal `(c, v)` enthält mit `claimKey(c) = claimKey(S.conclusions[id].claim)` und `v = w`.
- `solved ⇔ (alle Pflichtliterale abgedeckt) ∧ (kein Literal widerlegt)`, sonst `not_solved`.

Folgerungen, die Tests belegen müssen:

- D1: `undetermined` ist neutral, gleich welche Polarität behauptet wird.
- D2: Ein negatives Pflichtliteral (`w = false`) ist nur abgedeckt, wenn der Spieler genau diesen Claim mit `false` behauptet. Fehlt er, `not_solved`. Semantisch „gleichwertige“ andere Claims ersetzen kein Pflichtliteral (z. B. drei `personResponsibleForEvent = false` ersetzen nicht `noPersonResponsibleForEvent = true`).
- Zusätzliche kanonisch wahre Literale (auch negativ behauptete, deren Status `false` ist) sind erlaubt.
- Ein Literal mit Behauptung `false`, dessen Status `true` ist, ist widerlegt.
- Ein Pflichtliteral mit falscher Polarität ist zugleich nicht abgedeckt und widerlegt.
- Bewertet wird gegen die Resolutions (über `resolveConclusion`), nicht gegen den Conclusion-Katalog; nicht geforderte Katalogeinträge haben keine Sonderrolle.
- Reihenfolge der Literale und Property-Reihenfolge innerhalb eines Claims beeinflussen das Verdict nicht.
- Partial Responsibility: Bei `completeness: "partial"` ist eine zusätzliche, nicht widerlegbare Verantwortungsbehauptung `undetermined` und damit neutral. Sie wird **nicht** künstlich als `false` behandelt. Eine Authoring-Regel („vollständige Verantwortungsidentifikation verlangt complete“) ist ausdrücklich **nicht** Teil von MYST-0002.

## 8. Informationsgrenze (D8)

- Spieler-facing ist ausschließlich `verdict`. `AccusationResult` hat bei Erfolg genau die Schlüssel `success` und `verdict`; es enthält keine Claims, IDs, Zähler, Indizes, Gründe oder Hashes.
- Interne Gründe (welches Literal widerlegt, welches Pflichtliteral fehlt) werden **nicht** als Struktur ausgegeben. Tests rekonstruieren sie bei Bedarf über `evaluateConclusionClaim` und über Fälle, in denen genau eine Bedingung verletzt ist.
- `evaluateConclusionClaim` ist ein Answer-Key-Orakel. Es ist Domain-/Host-API und darf nicht an Spieler durchgereicht werden (Hinweis im Doc-Kommentar der Funktion, keine Laufzeitmaßnahme).
- Parse-Fehlermeldungen können IDs aus der Eingabe enthalten; sie sind technische Host-Signale und nicht für Spieler bestimmt (Doc-Kommentar).

## 9. Acceptance Criteria

- AC-01 `npm run typecheck` und `npm test` grün; alle 1087 bestehenden Tests unverändert grün.
- AC-02 Diff von `src/domain/case-solution.ts` gegen die Basis: nur hinzugefügte Zeilen, plus genau die zwei Zeilenänderungen aus §5.1. Kein zweites `switch (claim.kind)` im Produktionscode; `resolveConclusion` existiert genau einmal.
- AC-03 `evaluateConclusionClaim` liefert für jeden Claim mit vorhandener Resolution denselben Status wie das Black-Box-Orakel über `parseCaseSolution` (§10), über das ganze Grid.
- AC-04 Claim an Event ohne Resolution → `undetermined`, für alle sechs Claim-Varianten.
- AC-05 Fehlerreihenfolge `evaluateConclusionClaim`: Binding vor Claim-Parse vor Referenzen; jedes Ergebnis eingefroren; kein Throw für beliebige `unknown`-Claims (inkl. `null`, Array, String, Objekt mit Getter, Objekt mit Zusatzschlüssel).
- AC-06 Parse-Regeln §6 inklusive Pfaden; Binding-Fehler unterdrücken Folgeprüfungen; `safeParse` wirft für keine Eingabe; `parseAccusation` wirft `ZodError`.
- AC-07 D3 über `claimKey`: Duplikat, entgegengesetzte Polarität und Duplikat mit vertauschter Property-Reihenfolge sind Parse-Fehler.
- AC-08 Geparste Accusation ist von der Eingabe entkoppelt (Mutation der Eingabe nach dem Parse ändert nichts; Eingabe bleibt unfrozen) und rekursiv eingefroren (Mutationsversuche werfen `TypeError`, Inhalt unverändert).
- AC-09 Verdict-Semantik §7: alle Fälle der Matrix §11a mit exakt dem angegebenen Ergebnis.
- AC-10 Binding §6: accusation-, solution-Mismatch und leere Anklage mit fremder Solution liefern den Code, nie ein Verdict; Fehlerobjekt hat keinen Schlüssel `verdict`.
- AC-11 Gleiche Truth, gleiche Anklage, zwei verschiedene gültige Solutions → zwei Verdicts, beide `success: true`.
- AC-12 `evaluateAccusation` mutiert keine Eingabe; Ergebnis eingefroren; wiederholte Aufrufe liefern tief gleiche Ergebnisse; `JSON.stringify(result)` enthält weder `person:`, `event:`, `conclusion:` noch einen 64-stelligen Hex-String.
- AC-13 Keine Obergrenze: die Anklage mit allen 88 strukturell verschiedenen gültigen Claims des Gift-Falls parst und liefert ein Verdict.
- AC-14 Compile-Zeit-Tests (`tests/case-accusation.typecheck.ts`): `Accusation` readonly (Wurzel, `literals`, Literal, Claim); `AccusationInput` ist keine `Accusation`; `CaseSolution` und `CaseTruth` sind keine `Accusation`; `evaluateAccusation` akzeptiert keine ungeparste Eingabe; Ergebnis-Union erzwingt `success`-Prüfung vor Zugriff auf `verdict`; Positivkontrolle.
- AC-15 Alle Mutanten §11c werden von den genannten Tests getötet (Reviewer-repliziert).
- AC-16 Größe: höchstens 300 hinzugefügte Produktionszeilen (Dateien außerhalb `tests/`), höchstens 6 geänderte/neue Dateien.

## 10. Differentialstrategie (keine zweite Wahrheitstabelle)

`resolveConclusion` ist Autorität. Kein Test und kein Produktionscode darf eine Funktion enthalten, die aus Resolution-Feldern einen Status berechnet.

1. **Orakel O1 (Black-Box über den Parser):** `tests/conclusion-evaluation.test.ts` enthält eine lokale Kopie des Probers `statusOf` aus `tests/case-solution.test.ts` (Z. 35–47). Er leitet den Status nur aus `parseCaseSolution` ab: Ein Claim ist `true`, wenn nur `requiredConclusions: [{ value: true }]` akzeptiert wird, `false`, wenn nur `value: false`, sonst `undetermined`. Das ist der TASK-0003-Parser, kein Nachbau der Tabelle. (`case-solution.test.ts` wird nicht geändert.)
2. **Grid:** Truth = `solutionTruth()`, Resolution für `event:death` variiert über
   - `completeness ∈ {complete, partial}` × `assignments ∈ {[], [a:[direct_actor]], [a:null], [a:[direct_actor,planner], b:[facilitator]], [b:null]}` für alle 3×(1+3) Personen-/Rollen-Claims plus `noPersonResponsibleForEvent` (2×5×13 = 130 Paare),
   - `causesComplete ∈ {true, false}` × Ursache `∈ {poisoning (direkt), purchase (transitiv), storm (keine)}` (6),
   - `intent ∈ {null, intended, unintended, not_applicable}` × Claim-Wert (12),
   - `mechanism ∈ {null, ordinary, supernatural, mixed}` × Claim-Wert (12).
   Für jedes Paar: Solution mit dieser Resolution parsen, dann `evaluateConclusionClaim(truth, solution, claim).status === statusOf(...)`. Mindestens 160 Paare; alle drei Statuswerte müssen im Grid vorkommen (Selbstprüfung, damit das Grid nicht trivial ist).
3. **Bestehende AC-07-Fälle** (30 Zeilen) werden zusätzlich mit ihren literalen Erwartungen gegen `evaluateConclusionClaim` geprüft (Beispiele, keine Funktion).
4. **D5 außerhalb von O1:** O1 kann Events ohne Resolution nicht abbilden (der Katalog verlangt eine Resolution). Dafür explizite Fälle für alle sechs Varianten an `event:purchase`.
5. **Verdict-Kette (metamorph):** Für jede Solution S1–S6 aus der Fixture gilt: Anklage = exakt die Pflichtliterale → `solved`. Für jeden Claim `c` des 88er-Universums und `v ∈ {true,false}` gilt: Anklage = Pflichtliterale ∪ {(c, v)} (wenn `c` nicht schon Pflicht-Claim ist) ist `not_solved` genau dann, wenn `evaluateConclusionClaim(c).status` boolean und `≠ v` ist. Damit hängt das Verdict nur an der öffentlichen Evaluation, die ihrerseits an O1 hängt.
6. **Konsistenz Parse ↔ Evaluation:** Jeder Claim, den `parseAccusation` akzeptiert, liefert bei `evaluateConclusionClaim` `success: true`; jeder Claim mit unbekannter Referenz wird von beiden abgelehnt (Parse-Fehler bzw. `UNKNOWN_REFERENCE`).

## 11. Testmatrix

### Fixture `tests/case-accusation.fixture.ts`

Truth `T1 = solutionTruth()` (Gift-Fall: Personen a, b, c; Events purchase → poisoning → death, storm). `T2` = gleiche Eingabe mit `revision: 2` (gleiche `caseId`, anderer Hash). Factories liefern frische Objekte.

| Solution | Resolutions | requiredConclusions |
|---|---|---|
| S1 rev 1 | death: complete, [a:[direct_actor,planner]], intent intended, mechanism ordinary, causesComplete true; poisoning: partial, [a:null], intent null, mechanism null, causesComplete false | resp(a,death)=T, resp(b,death)=F, intent(death,intended)=T |
| S2 rev 2 | death: complete, [b:[direct_actor]], unintended, ordinary, true | resp(b)=T, resp(a)=F |
| S3 rev 3 | death: complete, [a:[planner], b:[direct_actor]], intended, ordinary, true | resp(a)=T, resp(b)=T, role(b,direct_actor)=T |
| S4 rev 4 | death: complete, [], not_applicable, ordinary, true | nobody(death)=T |
| S5 rev 5 | death: partial, [a:null], null, mixed, false | resp(a)=T, mechanism(mixed)=T |
| S6 rev 6 | death: partial, [a:[direct_actor]], intended, ordinary, false | role(a,direct_actor)=T |
| S1@T2 | wie S1, gebunden an T2 | wie S1 |

Alle sieben sind gültige Answer Keys für `parseCaseSolution` (vom Spec-Autor geprüft). Kurzschreibweise: Claims ohne Event-Angabe beziehen sich auf `event:death`. X1 := {resp(a)=T, resp(b)=F, intent(intended)=T}.

### 11a. Verdict-Fälle (Truth T1; alle Erwartungen vom Spec-Autor gegen das echte `resolveConclusion` nachgerechnet)

| ID | Solution | Anklage | Erwartung | Deckt ab |
|---|---|---|---|---|
| AV-01 | S1 | [] | not_solved | leere Anklage (D4) |
| AV-02 | S1 | X1 | solved | exakte Lösung, explizites negatives Pflichtliteral |
| AV-03 | S1 | X1 umgekehrt | solved | Reihenfolge |
| AV-04 | S1 | X1 ohne resp(a)=T | not_solved | fehlendes positives Pflichtliteral |
| AV-05 | S1 | X1 ohne resp(b)=F | not_solved | fehlendes negatives Pflichtliteral (D2) |
| AV-06 | S1 | X1 ohne intent | not_solved | mehrere Pflichtliterale |
| AV-07 | S1 | resp(a)=F, resp(b)=F, intent=T | not_solved | entgegengesetzte Polarität positiv |
| AV-08 | S1 | resp(a)=T, resp(b)=T, intent=T | not_solved | entgegengesetzte Polarität negativ |
| AV-09 | S1 | X1 + role(a,planner)=T | solved | zusätzlicher wahrer Claim |
| AV-10 | S1 | X1 + resp(c)=F | solved | zusätzlicher wahrer negativer Claim |
| AV-11 | S1 | X1 + resp(c)=T | not_solved | zusätzlicher falscher Claim (complete) |
| AV-12 | S1 | X1 + role(a,facilitator)=T | not_solved | falscher Rollen-Claim |
| AV-13 | S1 | X1 + role(a,facilitator)=F | solved | korrekt verneinter falscher Claim |
| AV-14 | S1 | X1 + role(a,direct_actor)=F | not_solved | `false` behauptet, Status `true` |
| AV-15 | S1 | X1 + intent(intended, poisoning)=T | solved | zusätzlicher undetermined Claim (intent null) |
| AV-16 | S1 | X1 + resp(b, purchase)=T | solved | Event ohne Resolution (D5) |
| AV-17 | S1 | X1 + resp(a, storm)=F | solved | D5 mit negativer Polarität |
| AV-18 | S1 | X1 + caused(poisoning)=T | solved | direkte Ursache |
| AV-19 | S1 | X1 + caused(purchase)=T | not_solved | nur transitiv, causesComplete true |
| AV-20 | S1 | X1 + caused(storm)=F | solved | fehlende Kante korrekt verneint |
| AV-21 | S1 | X1 + caused(storm → poisoning)=T | solved | causesComplete false → undetermined |
| AV-22 | S1 | X1 + caused(purchase → poisoning)=F | not_solved | direkte Kante verneint |
| AV-23 | S1 | X1 + intent(unintended)=T | not_solved | falscher Intent |
| AV-24 | S1 | X1 + intent(unintended)=F | solved | falscher Intent korrekt verneint |
| AV-25 | S1 | X1 + mechanism(ordinary)=T | solved | Mechanism wahr |
| AV-26 | S1 | X1 + mechanism(mixed)=T | not_solved | Mechanism falsch |
| AV-27 | S1 | X1 + nobody=T | not_solved | nobody falsch |
| AV-28 | S1 | X1 + nobody=F | solved | nobody korrekt verneint |
| AV-29 | S1 | X1 + nobody(poisoning)=T | not_solved | partial mit Zuordnung → false |
| AV-30 | S1 | X1 + intent(intended, poisoning)=T + intent(unintended, poisoning)=T | solved | logisch unverträglich, beide undetermined (K-2) |
| AV-31 | S1 | resp(a)=T, intent=T, resp(c)=T | not_solved | fehlend und widerlegt zugleich |
| AV-32 | S1 | X1 + role(a,direct_actor)=T + nobody=F + caused(poisoning)=T + mechanism(ordinary)=T | solved | alle sechs Varianten |
| AV-33 | S1 | X1 + resp(a, poisoning)=T | solved | partial, zugeordnet → true |
| AV-34 | S1 | X1 + role(a,planner, poisoning)=T | solved | roles null → undetermined |
| AV-35 | S1 | X1 + resp(b, poisoning)=T | solved | partial, nicht zugeordnet → undetermined |
| AV-36 | S5 | resp(a)=T, mechanism(mixed)=T | solved | Partial-Lösung exakt |
| AV-37 | S5 | + resp(b)=T + resp(c)=T | solved | Shotgun-Grenze bei partial (dokumentiert) |
| AV-38 | S5 | + role(a,planner)=T | solved | roles null |
| AV-39 | S5 | + nobody=T | not_solved | partial mit Zuordnung |
| AV-40 | S5 | + intent(intended)=T | solved | intent null |
| AV-41 | S5 | + mechanism(ordinary)=T | not_solved | mixed ≠ ordinary |
| AV-42 | S5 | + caused(storm)=T | solved | causesComplete false |
| AV-43 | S5 | + resp(b)=F | solved | neutrale negative Behauptung |
| AV-44 | S5 | + caused(purchase)=T | solved | transitiv bei causesComplete false |
| AV-45 | S6 | role(a,direct_actor)=T | solved | Rollenliste bekannt |
| AV-46 | S6 | + role(a,planner)=T | not_solved | Rollenliste geschlossen trotz partial |
| AV-47 | S6 | + resp(b)=T | solved | partial, undetermined |
| AV-48 | S3 | resp(a)=T, resp(b)=T, role(b,direct_actor)=T | solved | mehrere Verantwortliche |
| AV-49 | S3 | ohne resp(a)=T | not_solved | einer von mehreren fehlt |
| AV-50 | S3 | + role(a,planner)=T | solved | Rolle wahr |
| AV-51 | S3 | + role(a,direct_actor)=T | not_solved | Rolle falsch |
| AV-52 | S3 | + resp(c)=T | not_solved | Shotgun bei complete |
| AV-53 | S4 | nobody=T | solved | keine Verantwortlichen |
| AV-54 | S4 | nobody=T, resp(a)=T | not_solved | Verantwortung bei leerer complete-Liste |
| AV-55 | S4 | [] | not_solved | leer |
| AV-56 | S4 | resp(a)=F, resp(b)=F, resp(c)=F | not_solved | gleichwertige Claims ersetzen kein Pflichtliteral (D2) |
| AV-57 | S4 | nobody=T, intent(not_applicable)=T | solved | not_applicable |
| AV-58 | S2 | X1 | not_solved | gleiche Truth, andere Solution |
| AV-59 | S2 | resp(b)=T, resp(a)=F | solved | andere Solution exakt |

### 11b. Parse-, Binding-, Immutabilitäts- und Evaluationsfälle

| ID | Fall | Erwartung |
|---|---|---|
| AP-01 | `null`, Array, String, `{}` als Eingabe | `safeParse` wirft nicht, `success: false` |
| AP-02 | `schemaVersion: 2` | Parse-Fehler `["schemaVersion"]` |
| AP-03 | Zusatzschlüssel `solutionHash` an der Wurzel | Parse-Fehler (unrecognized keys) |
| AP-04 | Literal mit Zusatzschlüssel `conclusionId` | Parse-Fehler |
| AP-05 | Claim mit Zusatzschlüssel (`personId` an `noPersonResponsibleForEvent`) | Parse-Fehler |
| AP-06 | `literals` fehlt / kein Array | Parse-Fehler |
| AP-07 | `value: "true"` bzw. `null` | Parse-Fehler |
| AP-08 | `caseId: "case:other"` | Fehler nur an `["caseId"]`, keine Folgefehler trotz unbekannter Person im Literal |
| AP-09 | `truthHash` von T2 beim Parsen gegen T1 | Fehler nur an `["truthHash"]` |
| AP-10 | Truth mit geändertem `title`, gleiche `caseId`/`revision` | Fehler an `["truthHash"]` |
| AP-11 | unbekannte Person `person:z` | Fehler `["literals",0,"claim","personId"]` |
| AP-12 | unbekanntes Event `event:ghost` | Fehler `["literals",0,"claim","eventId"]` |
| AP-13 | unbekanntes Ursache-Event | Fehler `["literals",0,"claim","causeEventId"]` |
| AP-14 | falscher ID-Typ `personId: "item:k"` | Parse-Fehler |
| AP-15 | falscher ID-Typ `eventId: "person:a"` | Parse-Fehler |
| AP-16 | Selbstursache `caused(death → death)` | Parse-Fehler |
| AP-17 | unbekanntes `kind: "personGuilty"` | Parse-Fehler |
| AP-18 | Rolle `"accomplice"`, Intent `"accidental"`, Mechanism `"magic"` | Parse-Fehler |
| AP-19 | gleicher Claim, gleicher Wert zweimal | Fehler `["literals",1,"claim"]` |
| AP-20 | gleicher Claim, entgegengesetzte Polarität | Fehler `["literals",1,"claim"]` |
| AP-21 | Duplikat mit vertauschter Property-Reihenfolge | Fehler `["literals",1,"claim"]` |
| AP-22 | einzelner Claim mit vertauschter Property-Reihenfolge | parst; Verdict gleich wie Original (AV-02) |
| AP-23 | Eingabe nach dem Parse mutiert (Wert, Claim-Feld, Literal angehängt) | Accusation unverändert; Eingabe nicht frozen |
| AP-24 | rekursiver Freeze; Mutationsversuche (Wurzel, `literals.push`, Literal-`value`, Claim-Feld) | alle frozen, `TypeError`, Inhalt unverändert |
| AP-25 | alle 88 gültigen Claims des Gift-Falls (je einmal, `value: true`) | parst; `evaluateAccusation` liefert `success: true` (D9) |
| AP-26 | `parseAccusation` mit ungültiger Eingabe | wirft `ZodError` |
| AB-01 | Accusation gegen T1 geparst, Evaluation mit T2 und S1@T2 | `ACCUSATION_BINDING_MISMATCH` |
| AB-02 | Accusation gegen T1, Evaluation mit T1 und S1@T2 | `SOLUTION_BINDING_MISMATCH` |
| AB-03 | leere Accusation gegen T1, Evaluation mit T1 und S1@T2 | `SOLUTION_BINDING_MISMATCH` (nicht `not_solved`) |
| AB-04 | Fehlerobjekte | keine Schlüssel `verdict`; eingefroren |
| AB-05 | gleiche Accusation, S1 und S2 auf T1 | `solved` bzw. `not_solved`, beide `success: true` |
| AE-01 | `evaluateAccusation` auf AV-02 dreimal | tief gleiche, eingefrorene Ergebnisse; Eingaben unverändert (JSON vorher = nachher) |
| AE-02 | Ergebnis-Schlüssel | genau `["success","verdict"]`; keine IDs/Hashes in `JSON.stringify` |
| AC-E1 | `evaluateConclusionClaim` mit `{ kind: "x" }`, `null`, String, Array | `INVALID_CLAIM`, kein Throw |
| AC-E2 | Claim mit unbekannter Person / unbekanntem Ursache-Event | `UNKNOWN_REFERENCE` |
| AC-E3 | S1@T2 mit T1, gültiger **und** ungültiger Claim | beide `SOLUTION_BINDING_MISMATCH` (Binding zuerst) |
| AC-E4 | alle sechs Varianten an `event:purchase` mit S1 | `undetermined` |
| AC-E5 | Claim mit Getter-Property, der beim zweiten Lesen einen anderen Wert liefert | Status entspricht dem ersten Lesen bzw. der geparsten Kopie; kein Throw |
| AC-E6 | Differential-Grid §10 (≥ 160 Paare) und AC-07-Beispiele | Gleichheit mit O1 |
| AC-E7 | Metamorphe Verdict-Kette §10.5 über S1–S6 × 88 Claims × 2 Polaritäten | Gleichheit |

### 11c. Mutanten (Pflicht; Reviewer wendet jeden einzeln am Head an)

Damit die Mutanten anwendbar sind, muss jede `before`-Zeichenkette wörtlich und genau einmal in der genannten Datei stehen (Mutationsanker). Abweichende Formatierung ist ein Contract-Verstoß, kein Stilthema.

| ID | Datei | before | after | tötende Tests |
|---|---|---|---|---|
| m1 | `src/domain/case-solution.ts` | `if (resolution === undefined) return Object.freeze({ success: true, status: "undetermined" });` | `if (resolution === undefined) return Object.freeze({ success: true, status: false });` | `tests/conclusion-evaluation.test.ts` (AC-E4), `tests/case-accusation.test.ts` (AV-16) |
| m2 | `src/domain/case-solution.ts` | `solution.caseId !== truth.caseId \|\| solution.truthHash !== hashCaseTruth(truth)` | `solution.caseId !== truth.caseId` | `tests/conclusion-evaluation.test.ts` (AC-E3) |
| m3 | `src/domain/case-accusation.ts` | `if (evaluation.status !== "undetermined" && evaluation.status !== literal.value) contradicted = true;` | `if (evaluation.status !== literal.value) contradicted = true;` | `tests/case-accusation.test.ts` (AV-15, AV-16, AV-37) |
| m4 | `src/domain/case-accusation.ts` | `if (evaluation.status !== "undetermined" && evaluation.status !== literal.value) contradicted = true;` | `if (evaluation.status === false && literal.value) contradicted = true;` | `tests/case-accusation.test.ts` (AV-14, AV-22) |
| m5 | `src/domain/case-accusation.ts` | `const covered = solution.requiredConclusions.every(` | `const covered = solution.requiredConclusions.some(` | `tests/case-accusation.test.ts` (AV-04, AV-05, AV-06) |
| m6 | `src/domain/case-accusation.ts` | `const key = claimKey(literal.claim);` | ``const key = `${claimKey(literal.claim)}\|${String(literal.value)}`;`` | `tests/case-accusation.test.ts` (AP-20) |
| m7 | `src/domain/case-accusation.ts` | `if (accusation.caseId !== truth.caseId \|\| accusation.truthHash !== truthHash) return failure("ACCUSATION_BINDING_MISMATCH");` | `if (accusation.caseId !== truth.caseId) return failure("ACCUSATION_BINDING_MISMATCH");` | `tests/case-accusation.test.ts` (AB-01) |
| m8 | `src/domain/case-accusation.ts` | `if (solution.caseId !== truth.caseId \|\| solution.truthHash !== truthHash) return failure("SOLUTION_BINDING_MISMATCH");` | (Zeile entfernt) | `tests/case-accusation.test.ts` (AB-03) |

(`\|` in der Tabelle steht für `|`.) m3 und m4 teilen den Anker und werden einzeln angewendet. Jeder Mutant muss `npm run typecheck` bestehen und in mindestens einem genannten Test scheitern; „killed by typecheck“ zählt nicht.

Bewusst **kein** Mutant auf die Polaritätsprüfung der Abdeckung (`=== literal.value` in der Abdeckung): Sie ist bei gültigen Solutions äquivalent redundant, weil jedes Pflichtliteral per TASK-0003 genau zu seinem Wert auflöst und eine falsche Polarität deshalb immer auch widerlegt ist. Sie bleibt als Verteidigung im Code.

## 12. Limits

- Höchstens **300** hinzugefügte Zeilen in Produktionsdateien (alles außerhalb `tests/`), gezählt mit `git diff --numstat --no-renames 3d7545d..HEAD`. Erwartung: 170–230.
- Höchstens **6** geänderte oder neue Dateien (genau die aus §4).
- Keine neue Runtime- oder Dev-Dependency.

## 13. Bekannte Grenzen (bewusst nicht gelöst)

- K-1 Shotgun bei partial: Zusätzliche Verantwortungsbehauptungen gegen partial Responsibility sind `undetermined` und neutral (AV-37). Die spätere Authoring-/Solvability-Regel („vollständige Verantwortungsidentifikation verlangt einen ausreichend completen Answer Key“) ist nicht Teil von MYST-0002.
- K-2 Logisch unverträgliche, aber strukturell verschiedene Claims werden nicht beim Parsen erkannt; sind beide `undetermined`, bleibt die Anklage lösbar (AV-30). Ein Pflichtliteral kann so nicht umgangen werden, weil Pflichtliterale nie `undetermined` sind.
- K-3 Laufzeit: `evaluateConclusionClaim` hasht die Truth pro Aufruf; `evaluateAccusation` ist damit O(n · |Truth|). Gemessen auf der Basis: ~40 µs pro Hash (Gift-Fall), ~0,4 ms (34 Personen, 64 Events). D3 begrenzt n auf die Zahl strukturell verschiedener Claims; bei sehr großen, absichtlich maximalen Anklagen sind Sekunden möglich. Keine Obergrenze (D9), kein Memo in V1.
- K-4 Die Accusation enthält rohe Domain-IDs. Die Übersetzung von Spielereingaben (PlayerRef, MYST-0001) in Domain-IDs ist nicht Teil dieses Tasks.
- K-5 Kein Hash, keine Serialisierung, keine kanonische Sortierung der Accusation; Save/Replay-Identität kommt später.

## 14. Non-Goals

Keine Änderung der Semantik von `CaseTruth`, `CaseSolution` (Schema und Wahrheitstabelle), Evidence, NPC Knowledge, PlayerRef, Session, Save/Replay, Solvability. Kein Versuchszähler, keine Versuchs-Policy (D10). Keine Begründungen, Teilpunkte, Hinweise oder Fortschrittsanzeigen. Keine transitive Kausalität. Kein Katalog-Lookup nach `conclusionId` für Spieler. Keine Spieler-UI, keine Lokalisierung. Kein Export von `resolveConclusion`, `checkSolution`, `deepFreeze` oder des privaten Solution-Shapes. Keine Factory/Engine/Klasse für die Evaluation.

## 15. Abgabe

Ein Run-PR mit genau dem Scope aus §4, Testergebnis (Anzahl Tests vorher/nachher), Zeilenzählung nach §12 und Liste der Mutationsanker. Der Code-Reviewer repliziert m1–m8 und meldet je `killed`/`survived`; ein `survived` ist blockierend.
