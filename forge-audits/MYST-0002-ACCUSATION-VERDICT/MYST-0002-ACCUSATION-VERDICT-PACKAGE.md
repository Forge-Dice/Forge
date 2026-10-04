# MYST-0002 ACCUSATION & VERDICT PACKAGE

Stand: 2026-10-03, ca. 20:30Z. Read-only erstellt: keine Repository-Änderung, kein Commit, kein Branch, kein PR.
Basis: `Forge-Dice/Forge` `main` = `3d7545d843883418348004e68717399a64da7a7d` (selbst per `git fetch` geprüft). Auf dieser Basis: `npm run typecheck` grün, `npm test` 1087/1087 grün.

Begleitdatei (der eigentliche Vertrag): `MYST-0002-ACCUSATION-VERDICT-V1.contract.DRAFT.md`
- Format 1, 35 954 Bytes, Git-Blob `5c5edcd79504d4532ec242a029831162b1eef29d`
- `parseContractDocument` (Basis-Parser) → `ok: true`, `taskId MYST-0002`, `contractVersion 1`
- `contentHash` = `3758b20c5eef9ee9dbaa9b04660cc0d82de041da183326308e7d1f37868b027d` (= sha256(`forge-contract-v1\n` ‖ Text), mit Parser und `sha256sum` übereinstimmend)

Methodik-Hinweis: Um die Aussagen des Vertrags nicht zu raten, habe ich in einem Wegwerf-Verzeichnis außerhalb des Repos (Scratchpad, `git archive` der Basis) zwei Dinge geprüft: (a) ob die geplante Signatur typecheckt, (b) die 59 erwarteten Verdicts der Matrix gegen das echte private `resolveConclusion`. Das ist keine Implementierung und wurde nirgendwo abgelegt.

---

## 1. Current Code Reconciliation

| Gegenstand | Tatsächlicher Code auf `3d7545d` | Folge für MYST-0002 |
|---|---|---|
| `CaseTruth` | `case-truth.ts`: strikt geparst, `DeepReadonly`, rekursiv `Object.freeze` nach `structuredClone`, Brand `"CaseTruth"` | Accusation übernimmt exakt dieses Freeze-/Brand-Muster |
| `CaseSolution` | `case-solution.ts`: an Truth gebunden über `caseId` + `truthHash`; `resolutions.min(1)`, `conclusions.min(1)`, `requiredConclusions.min(1)`; Brand `"CaseSolution"` trägt **keine** Truth-Identität im Typ | Bindung muss zur Laufzeit geprüft werden (Hash-Vergleich); leere Anklage ist immer `not_solved` |
| `ConclusionClaim` | exportiertes `ConclusionClaimSchema`, 6 Varianten, alle `strictObject`; `eventCausedEvent` lehnt Selbstursache ab | Accusation verwendet exakt dieses Schema; keine eigene Claim-Definition |
| `ConclusionLiteral` | `{ conclusionId, value: boolean }`, exportiert | Accusation-Literal ist `{ claim, value }` (Namensparallele `value`), ohne `conclusionId` |
| `requiredConclusions` | jedes Pflichtliteral löst per Parser genau zu seinem `value` auf (nie `undetermined`) | Polaritätsprüfung der Abdeckung ist redundant zur Widerlegungsprüfung (kein brauchbarer Mutant, s. §9) |
| `resolveConclusion` | privat, Z. 126; Signatur `(claim: ConclusionClaim, resolution: EventResolution, event: TruthEvent)`; braucht **auch das Truth-Event** (`causedByEventIds`) | Öffentliche Funktion braucht Truth und Solution. Aufruf mit `solution.resolutions[i]` scheitert an `tsc` (TS2345, readonly Array) → Signatur auf `DeepReadonly<EventResolution>` erweitern (typ-only, geprüft) |
| `claimKey` | privat, Z. 154; sortierte `Object.entries` als JSON, property-order-unabhängig | wird exportiert (eine Zeile), damit D3 und die Abdeckung dieselbe Gleichheit verwenden wie die Katalog-Duplikatprüfung |
| `type Status` | privat, `true \| false \| "undetermined"` | `export type ConclusionStatus = Status` (Alias, keine zweite Definition) |
| `parseCaseSolution` | wirft `ZodError`; `createCaseSolutionSchema(truth)` für `safeParse` | gleiches Paar für Accusation |
| Hash-/ID-Konventionen | `hashCaseTruth` (`forge-case-c14n-v1`, Arrays als Mengen); IDs `prefix:slug` gebrandet | `truthHash` im Accusation-Dokument, Regex `^[0-9a-f]{64}$` |
| Ergebnis-Konvention | `npc-knowledge.projection.ts`: `{ success: true, … } \| { success: false, code: "CONTEXT_BINDING_MISMATCH" }`, eingefroren | `ConclusionEvaluation` und `AccusationResult` folgen dem (`success`, `…_BINDING_MISMATCH`) |
| Tests/Fixtures | `tests/case-solution.fixture.ts` (Gift-Fall, Factories); `tests/case-solution.test.ts` Z. 35 Black-Box-Prober `statusOf` über den Parser; AC-07 mit 30 Zeilen | `statusOf` ist das Differential-Orakel; Gift-Fall ist die Fixture-Basis |
| Contract-Parser | `src/forge/contract-document.ts`: nur `forgeContractFormat: 1`, Felder strikt (`baseCommit`, `dependencies`, `scope`, `requiredChecks`, `mutationSmoke`), kein End-Marker | Vertrag im Format 1; `reads`, `mutants`, `limits` als Prosa; Format 2 wird nicht vorgetäuscht |

Abweichungen gegenüber früheren Dokumenten (Code gewinnt):

- AVD §2.1 nannte `success`/Codes korrekt, aber übersah den Readonly-Typkonflikt beim Aufruf von `resolveConclusion` und den nötigen `claimKey`-Export.
- FREEZE §15.2 nennt als Dependency `TASK-0004`. Falsch: MYST-0002 braucht nur TASK-0001 und TASK-0003; NPC Knowledge wird nicht berührt.
- FREEZE §15.2 und OVERNIGHT-Plan verlangen Format 2. Format 2 ist auf `main` nicht implementiert; der Vertrag ist daher Format 1 (siehe §10, Bedingung B-1).
- AVD §3.2 sah eine kanonische Sortierung der Literale vor; entfällt in V1 (kein Nutzen ohne Accusation-Hash, spart Code).
- AVD §8 sah einen internen Report vor; ersetzt durch reines Verdict (D8, siehe §2 N-2).

## 2. Final Domain Semantics

Normativ in Vertrag §6–§8. Kurzform:

`solved ⇔ (jedes requiredConclusion-Literal ist mit gleichem claimKey und gleicher Polarität in der Anklage) ∧ (kein Anklage-Literal hat einen booleschen Status ≠ behaupteter Polarität)`

- D1 `undetermined` neutral, unabhängig von der behaupteten Polarität.
- D2 Negative Pflichtliterale müssen explizit behauptet werden; semantisch gleichwertige andere Claims zählen nicht (AV-56: drei `resp(x)=false` ersetzen nicht `nobody=true`).
- D3 Gleicher `claimKey` zweimal (egal welche Polarität) = Parse-Fehler.
- D4 Leere Anklage gültig → `not_solved` (weil `requiredConclusions.min(1)`).
- D5 Claim an Event ohne Resolution → `undetermined`.
- Partial Responsibility: Zusatzbehauptung gegen partial = `undetermined` = neutral (AV-37). Authoring-Regel nicht in VS-1.
- Behauptung `false` bei Status `true` ist widerlegt (AV-14).
- Bewertung gegen Resolutions über `resolveConclusion`, nicht gegen den Katalog.

Drei Präzisierungen, die ich treffen musste (innerhalb von D1–D10, aber vom Owner zu bestätigen):

- **N-1 „Strukturell widersprüchlich“ (D3) = gleicher `claimKey`, entgegengesetzte Polarität.** Logische Unverträglichkeiten zwischen verschiedenen Claims (zwei verschiedene Intents beide `true`; `nobody=true` und `resp(a)=true`) sind keine Parse-Fehler. Sie werden einzeln bewertet; sind beide `undetermined`, bleibt die Anklage lösbar (AV-30). Das kann kein Pflichtliteral umgehen, weil Pflichtliterale nie `undetermined` sind. Alternative wäre, Einwertigkeit von Intent/Mechanism und `nobody` gegen Verantwortung im Parser zu kodieren; das wäre eine zweite Domain-Logik neben `resolveConclusion` (Konflikt mit D7-Geist) und kostet ca. 20–30 Zeilen.
- **N-2 Ergebnis = nur Verdict.** `AccusationResult` bei Erfolg: genau `{ success: true, verdict }`. Keine Zähler (auch „2 fehlen“ ist ein Hinweis), keine Indizes. Testbarkeit entsteht über Fälle mit genau einer verletzten Bedingung plus die öffentliche Claim-Evaluation.
- **N-3 Zwei minimale Änderungen an bestehenden Zeilen in `case-solution.ts`:** `export` vor `claimKey`, und `resolution: DeepReadonly<EventResolution>` in der Signatur von `resolveConclusion`. Rümpfe bytegleich.

## 3. Public API

```ts
// src/domain/case-solution.ts (additiv)
export type ConclusionStatus = Status;
export type ConclusionEvaluation =
  | { readonly success: true; readonly status: ConclusionStatus }
  | { readonly success: false; readonly code: "SOLUTION_BINDING_MISMATCH" | "INVALID_CLAIM" | "UNKNOWN_REFERENCE" };
export function evaluateConclusionClaim(truth: CaseTruth, solution: CaseSolution, claim: unknown): ConclusionEvaluation;
export function claimKey(claim: ConclusionClaim): string; // bisher privat

// src/domain/case-accusation.ts (neu)
export function createAccusationSchema(truth: CaseTruth);
export type AccusationInput, Accusation;
export function parseAccusation(input: unknown, truth: CaseTruth): Accusation;
export type Verdict = "solved" | "not_solved";
export type AccusationResult =
  | { readonly success: true; readonly verdict: Verdict }
  | { readonly success: false; readonly code: "ACCUSATION_BINDING_MISMATCH" | <Fehlercodes von ConclusionEvaluation> };
export function evaluateAccusation(truth: CaseTruth, solution: CaseSolution, accusation: Accusation): AccusationResult;
```

Warum diese Form:

- `evaluateConclusionClaim(truth, solution, claim)` ist die von D6 bevorzugte Einzelfunktion. Die Truth ist zwingend, weil `resolveConclusion` das Truth-Event für `eventCausedEvent` braucht. `claim: unknown` macht die Funktion auch für ungeprüfte Eingaben sicher.
- Keine Factory: Der Code liefert keinen zwingenden Grund. Der einzige Preis ist ein Truth-Hash pro Aufruf (gemessen ~40 µs Gift-Fall, ~0,4 ms bei 34 Personen/64 Events), dokumentiert als K-3.
- `createAccusationSchema` + `parseAccusation` spiegeln das bestehende Paar aus TASK-0003/0004 und liefern `safeParse` mit Pfaden; das ist Parse-Muster, keine Evaluations-Factory.
- Das Parsing braucht keine Solution. Ob eine Anklage gültig ist, verrät damit nie etwas über den Answer Key.

## 4. Binding/Error Model

- Accusation ist an **eine Truth** gebunden: `caseId` + `truthHash` im Dokument, geprüft beim Parsen und erneut bei der Evaluation (`ACCUSATION_BINDING_MISMATCH`).
- **Kein** Solution-Hash. Die Solution wird bei der Evaluation gegen dieselbe Truth geprüft (`SOLUTION_BINDING_MISMATCH`), explizit, auch bei leerer Anklage (sonst würde eine leere Anklage mit fremder Solution `not_solved` statt technischem Fehler liefern; Mutant m8).
- Zulässige Claims: genau `ConclusionClaimSchema`; jede `eventId`/`causeEventId` muss in `truth.events`, jede `personId` in `truth.persons` existieren. Eine Resolution muss **nicht** existieren (D5).
- Fremder Case: Parse-Fehler an `caseId`, ohne Folgefehler; bei der Evaluation `ACCUSATION_BINDING_MISMATCH`.
- Technischer Fehler (Parse-Fehler, Binding-Codes) ist nie ein Verdict; Fehlerobjekte haben keinen Schlüssel `verdict`. Fachlich `not_solved` ist ausschließlich das Ergebnis von §7 des Vertrags.
- Versuchskosten bei Parse-Fehlern: Host-Policy (D10).
- Vollständige Tabelle: Vertrag §6.1.

## 5. Differential Strategy

Vertrag §10. Kernidee: Es gibt schon ein unabhängiges Orakel, nämlich den TASK-0003-Parser. Der Prober `statusOf` (bestehender Test, Z. 35) leitet den Status eines Claims nur daraus ab, welche Polarität `parseCaseSolution` als Pflichtliteral akzeptiert. Er wird in den neuen Test kopiert (Testhelfer, kein Nachbau der Tabelle).

1. Grid ≥ 160 Paare (Responsibility 130, Ursachen 6, Intent 12, Mechanism 12), Gleichheit `evaluateConclusionClaim` = `statusOf`; Selbstprüfung, dass alle drei Statuswerte vorkommen.
2. Die 30 AC-07-Zeilen zusätzlich als Beispiele.
3. D5 explizit (O1 kann Events ohne Resolution nicht abbilden).
4. Metamorphe Verdict-Kette: exakte Pflichtliterale → `solved`; Pflichtliterale + ein Zusatz-Claim `(c, v)` → `not_solved` genau dann, wenn `evaluateConclusionClaim(c)` boolesch und ≠ `v`. Über S1–S6 × 88 Claims × 2 Polaritäten.
5. Parse ↔ Evaluation konsistent bei Referenzen.

Verbot: Weder Tests noch Produktionscode enthalten eine Funktion, die aus Resolution-Feldern einen Status berechnet. Produktionscode enthält genau ein `switch (claim.kind)`.

## 6. 50+ Adversarial Cases

Vollständig im Vertrag §11: **59 Verdict-Fälle (AV-01…AV-59)**, **26 Parse-Fälle (AP)**, **5 Binding-Fälle (AB)**, **2 Determinismus-/Leak-Fälle (AE)**, **7 Evaluationsfälle (AC-E)**, zusammen 99, plus Grid und metamorphe Kette.

Alle 59 AV-Erwartungen und die Gültigkeit der sieben Fixture-Solutions habe ich gegen das echte `resolveConclusion` nachgerechnet: 59/59 übereinstimmend.

Abdeckung der Pflichtliste: leere Anklage (AV-01, AV-55, AB-03), exakte Lösung (AV-02), fehlend positiv/negativ (AV-04/05), explizit negativ (AV-02, AV-10), extra wahr/falsch/undetermined (AV-09/11/15), complete/partial Responsibility (AV-11, AV-35, AV-37), roles null (AV-34, AV-38), causesComplete true/false (AV-19/21/44), intent null (AV-15, AV-40), mechanism null (Differential-Grid §10, `mechanism: null`), direkt vs. indirekt (AV-18/19), Duplikate (AP-19), entgegengesetzte Polarität (AP-20, AV-07/08), fremde Person/Event (AP-11–13), falscher ID-Typ (AP-14/15), Property-Reorder (AP-21/22), Input-Mutation nach Parse (AP-23), Deep Freeze (AP-24), geänderte Truth (AP-09/10, AB-01), geänderte Solution (AB-02), gleiche Truth andere Solution (AV-58/59, AB-05), mehrere Verantwortliche (AV-48–52), keine Verantwortlichen (AV-53–57), mehrere Pflichtliterale (S1, S3, S5), alle sechs Varianten (AV-32, AC-E4).

## 7. Scope and Estimates

| Datei | Art | Schätzung |
|---|---|---|
| `src/domain/case-solution.ts` | ändern (additiv + 2 Zeilen) | +30 bis +40 |
| `src/domain/case-accusation.ts` | neu | 140 bis 190 |
| `tests/case-accusation.fixture.ts` | neu | 100 bis 140 |
| `tests/case-accusation.test.ts` | neu | 400 bis 550 |
| `tests/conclusion-evaluation.test.ts` | neu | 150 bis 220 |
| `tests/case-accusation.typecheck.ts` | neu | 40 bis 60 |

Produktion gesamt 170–230 hinzugefügte Zeilen, harte Grenze 300; 6 Dateien, harte Grenze 6. Keine neue Dependency. Unberührt: CaseTruth, CaseSolution-Semantik, Evidence, NPC Knowledge, PlayerRef, Session, Save/Replay, Solvability.

## 8. DRAFT IMPLEMENTATION CONTRACT

Datei: `MYST-0002-ACCUSATION-VERDICT-V1.contract.DRAFT.md` (Daten oben). Inhalt: 0 Format/Herkunft, 1 Basis, 2 Ziel, 3 Reads mit Blob-SHAs, 4 Scope, 5 API, 6 Binding, 7 Semantik, 8 Informationsgrenze, 9 Acceptance Criteria AC-01…AC-16, 10 Differentialstrategie, 11 Testmatrix + 8 Mutanten mit wörtlichen Ankern, 12 Limits, 13 bekannte Grenzen K-1…K-5, 14 Non-Goals, 15 Abgabe.

Format 1 verlangt keinen End-Marker; der Vertrag hat keinen. Bei einer Umstellung auf Format 2 kommen hinzu: `title`, `specifiedAgainst` (= `baseCommit`), `reads` (§3), `mutants` (§11c, 8 Einträge), `limits {300, 6}`, `supersedes: null`, `findings: []`, End-Marker `<!-- END OF CONTRACT MYST-0002 v1 -->`, Hash-Domäne `forge-contract-v2\n`. Der Body bleibt unverändert.

## 9. Review Hotspots

1. **`evaluateConclusionClaim` ist ein Answer-Key-Orakel.** Wer es an Spieler durchreicht, verrät die Lösung Claim für Claim. Nur Doc-Kommentar, keine Laufzeitsperre. Session (MYST-0006) muss das respektieren.
2. **N-1 Definition „strukturell widersprüchlich“** (AV-30). Owner bestätigen.
3. **Typ-Erweiterung von `resolveConclusion`** statt Cast: Reviewer prüft, dass der Rumpf bytegleich bleibt (AC-02).
4. **Explizite Solution-Bindung in `evaluateAccusation`** (m8): ohne sie liefert eine leere Anklage mit fremder Solution `not_solved` statt Fehler.
5. **Polarität der Abdeckung** ist bei gültigen Solutions redundant; Reviewer soll keinen Mutanten darauf erwarten (äquivalenter Mutant), Code bleibt defensiv.
6. **Namenskollision `value`:** Literal-`value` (Polarität) und `claim.value` (Intent/Mechanism) bei `eventIntent`/`eventMechanism`. Strukturell eindeutig; Tests sollten beide Ebenen in einem Fall verwenden (AV-24).
7. **Laufzeit K-3:** n Hashes pro Evaluation. Für Spielgrößen unkritisch; falls ein Host später Massenanklagen aus unvertrauten Quellen annimmt, ist ein `WeakMap`-Memo auf die eingefrorene Truth der naheliegende Folgeschritt.
8. **Parse-Fehlermeldungen** enthalten Eingabe-IDs; technische Host-Signale, nicht für Spieler.
9. **Mutationsanker** schreiben dem Developer einzelne Zeilen wörtlich vor; das ist gewollt (Mutanten müssen anwendbar sein), Reviewer prüft „genau einmal vorhanden“.

## 10. GO / NO-GO

**GO für Contract-Review** des Drafts. Der Vertrag ist gegen den tatsächlichen Code auf `3d7545d` abgeglichen, parst mit dem aktuellen Forge-Parser, hält D1–D10 ein, die erwarteten Verdicts sind gegen die echte Wahrheitstabelle nachgerechnet, und es gibt keinen technischen Blocker im Domain-Code.

**Keine Freigabe.** Es gibt kein Review, keine Attestierung, keine Registrierung. Vor einem Run gelten diese Bedingungen:

- **B-1 Format:** Nach FREEZE §5.10 ist Format 1 nur für drei Bootstrap-Tasks erlaubt, MYST-0002 gehört nicht dazu. Wenn bei der Registrierung ein Format-2-Parser auf `main` liegt, muss der Frontmatter wie in §8 beschrieben umgestellt werden (nur Metadaten, Body unverändert, neuer Hash). Liegt keiner vor, ist Format 1 die einzige maschinell prüfbare Form.
- **B-2 Owner bestätigt N-1, N-2, N-3** (§2).
- **B-3 Architekturreview** durch einen Reviewer, dessen Provider nicht Anthropic ist (Spec-Entwurf von Claude), laut Plan ChatGPT.
- **B-4 Basis-Drift:** Hat sich bis zum Run eine Datei aus Vertrag §3 auf `main` geändert, braucht es eine Revision.

STOP.
