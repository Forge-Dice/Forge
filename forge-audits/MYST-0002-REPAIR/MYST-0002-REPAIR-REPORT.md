# MYST-0002 REPAIR REPORT — Accusation & Verdict als Canonical-Consistency-Core

Stand 2026-10-03, ca. 22:00Z. Read-only: Forge-Dice/Forge unverändert (kein Commit, Branch, PR, Kommentar, Setting). Alle Experimente in einem Wegwerf-Verzeichnis aus `git archive` der Basis.

Artefakte (alle in `/mnt/project-files/forge-audits/`):

| Datei | Inhalt | Identität |
|---|---|---|
| `MYST-0002.contract.FINAL-CANDIDATE.md` | reparierter Vertrag, Format 1 | 42 994 Bytes, Blob `f8faf084c0b6f150ec3468acfbe008d30cf99ec0`, contentHash `e1eba9e1e248376f18774ee8899208c4a7a066e0cf5d5cc23973db4b3cf91e1c` (Parser und `sha256sum` gleich) |
| `MYST-0002-REPAIR-REPORT.md` | dieser Bericht | |
| `MYST-0002-REPAIR-EVIDENCE.zip` | Scratch-Umsetzung, Tests, Mutations-, Differential-, Challenge-Skripte, Rohausgaben | 11 Dateien |

Klassifikation: **[CODE]** = verifiziert am aktuellen Code, **[ART]** = verifiziert aus Artefakt, **[EXP]** = experimentell verifiziert (hier, reproduzierbar aus dem ZIP), **[INF]** = abgeleitet, **[UNK]** = unbekannt/nicht prüfbar.

---

## 1. Actual Code

- [CODE] `main` = `3d7545d843883418348004e68717399a64da7a7d` (frisch per `git fetch`, unverändert seit dem ersten Entwurf). `npm run typecheck` grün, `npm test` 1087/1087.
- [CODE] `src/domain/case-solution.ts`: `resolveConclusion` privat (Z. 126), Kommentar „Inputs are fully reference-checked before this is called“; `claimKey` privat (Z. 154); `type Status = true | false | "undetermined"` privat; `ConclusionClaimSchema` exportiert (6 Varianten, strikt); kein öffentlicher Evaluator.
- [CODE] `src/domain/case-solution.identity.ts`: `hashCaseSolution`, Profil `forge-solution-c14n-v1`; für MYST-0002 nicht nötig (die Anklage bindet keine Solution).
- [CODE] `roles: []` wird vom bestehenden Schema abgelehnt (`.min(1)`); im Differential bestätigt.
- [CODE] Contract-Parser `src/forge/contract-document.ts`: nur `forgeContractFormat: 1`, kanonisches JSON, strikte Felder, kein End-Marker, Hash-Präfix `forge-contract-v1\n`.
- [CODE] Keine Mystery-Contracts außer `forge/contracts/TASK-0004.md` (Legacy-Format) auf `main`; keine Reviews zu MYST-0002.

MYST-0002-Versionen:

| Version | Ort | Identität | Status |
|---|---|---|---|
| Design AVD | `MYSTERY-ACCUSATION-VERDICT-DESIGN.md` | – | Vorläufer (Design) |
| Draft v1 | `MYST-0002-ACCUSATION-VERDICT-V1.contract.DRAFT.md` | contentHash `3758b20c…`, Blob `5c5edcd7…` (unverändert auf Platte geprüft) | **jüngste Basis**, nie registriert |
| Final Candidate | `MYST-0002.contract.FINAL-CANDIDATE.md` | contentHash `e1eba9e1…` | dieser Bericht |

[ART] Es gibt keine weitere MYST-0002-Version in den Projektdateien; MYST-0003/0004/0005-Entwürfe referenzieren MYST-0002 nur als „Draft“. Entscheidung: Draft v1 ist die Basis, repariert minimal.

[UNK] Die Zahlen des Solvability Repair Lab (1 106 Anklagen, 509 durchgelassen, 0/1 043, 63/63) liegen in den Projektdateien nicht vor; sie sind von Seb berichtet, hier nicht nachprüfbar. Mein eigenes Experiment (§5) bestätigt die Richtung, nicht diese Zahlen.

## 2. Old vs New

| Punkt | Draft v1 | Final Candidate |
|---|---|---|
| Wahrheitstabelle | unverändert | unverändert |
| API | `evaluateConclusionClaim`, `parseAccusation`, `evaluateAccusation`, `claimKey`-Export, Typ-Erweiterung | identisch |
| Verdict-Formel | Abdeckung ∧ nichts widerlegt | identisch |
| Rolle des Verdicts | implizit spielerseitig | **explizit Core**: „CORE SOLVED ≠ PLAYER CHALLENGE COMPLETION“ (§2, §7a), Host darf Core-Verdict nicht als Spielerabschluss nutzen |
| Challenge | nicht erwähnt (Shotgun nur als K-1) | §15 normiert die Grenze für den Folgetask; nicht implementiert; AC-18 verbietet Challenge-Symbole |
| API-Begründung | knapp | §5.1: warum Wrapper statt Export, warum Union statt nacktem Status |
| Matrix | AV-01…59 | + AV-60…65 (S7, Shotgun alle Personen/Rollen, mehrere Rollen, irrelevante Claims) |
| Mutanten | m1–m8 | + m9 (Binding-Abbruch im Parse), m10 (Personen-Referenz im Evaluator) |
| Limit | 300 | 220 (Scratch-Umsetzung: 133) |
| ACs | AC-01…16 | + AC-17 (Doc-Text Core ≠ Challenge), AC-18 (keine Challenge-Symbole), AC-19 (Exporte reichen für Wrapper) |

Kein Rewrite: Abschnitte 1, 3, 4, 6, 7, 10 sind bis auf Querverweise unverändert.

## 3. API Decision

```ts
evaluateConclusionClaim(truth: CaseTruth, solution: CaseSolution, claim: unknown): ConclusionEvaluation
// { success: true, status: true | false | "undetermined" } | { success: false, code: "SOLUTION_BINDING_MISMATCH" | "INVALID_CLAIM" | "UNKNOWN_REFERENCE" }
```

- **Kein direkter Export von `resolveConclusion`** [CODE]: Die Funktion verlangt vorab geprüfte Referenzen sowie Resolution und Truth-Event als Argumente. Jeder Aufrufer müsste Lookup, Binding und D5 nachbauen, also eine zweite Logikschicht. Der Wrapper hält diese drei Dinge an einer Stelle; die Statuslogik bleibt ausschließlich in `resolveConclusion`.
- **Union statt nacktem `ConclusionStatus`** [CODE/ART]: Fail closed ohne Exception, im Stil von `ProjectionResult`. Der Solvability-Entwurf liest bereits `.status` [ART].
- **Zwei Einzeilen-Änderungen** [EXP]: `export function claimKey` und `resolution: DeepReadonly<EventResolution>` (ohne Letzteres TS2345). Scratch-Diff: genau diese zwei Zeilen geändert, 27 hinzugefügt.
- Keine Normalisierung, keine Mutation, kein Zustand, deterministisch, keine Abhängigkeit zu PlayerRef/PlayerKnowledge/Proof/Solvability [EXP: Scratch-Importe].

## 4. Differential Results [EXP]

Scratch-Prober: privates `resolveConclusion` (per Scratch-only-Export) gegen `evaluateConclusionClaim` gegen das Black-Box-Parser-Orakel `statusOf`.

Variiert: `complete/partial` × 7 Zuordnungsmengen (0, 1, 2, 3 Personen; `roles` null, eine, zwei, drei Rollen; gemischt) × `causesComplete` true/false × `intent` null + 3 × `mechanism` null + 3 × drei Varianten einer zweiten Resolution (keine, complete, partial) = **1 344 gültige Solutions**, jeweils gegen alle **88** strukturell verschiedenen Claims des Gift-Falls.

| Vergleich | Anzahl | Unterschiede |
|---|---|---|
| intern vs. öffentlich (Resolution vorhanden) | 49 280 | **0** |
| D5: keine Resolution ⇒ `undetermined` | 68 992 | **0** |
| öffentlich vs. Parser-Orakel (Teilmenge, 2 Parses je Fall) | 2 464 | **0** |
| `roles: []` vom Schema abgelehnt | – | bestätigt |

Statusverteilung: 9 984 true, 20 480 false, 87 808 undetermined (alle drei Werte stark vertreten). Positive und negative Behauptungen werden zusätzlich über die metamorphe Kette geprüft (S1–S7 × 88 Claims × 2 Polaritäten, > 1 000 Fälle, 0 Abweichungen).

Scratch-Umsetzung des Vertrags: 83 Matrix-Tests grün, Gesamtsuite 1 170/1 170 (1 087 bestehende + 83).

Mutanten am Scratch-Code [EXP]:

| Mutant | Ergebnis | tötende Tests |
|---|---|---|
| m1 D5 → false | killed | AV-16, AV-64, AC-E4 |
| m2 Hash-Binding im Evaluator weg | killed | AC-E3 |
| m3 undetermined zählt als Widerspruch | killed | AV-15/16/17/21 |
| m4 nur „true behauptet, false kanonisch“ zählt | killed | AV-14, AV-22, Kette |
| m5 `every` → `some` | killed | AV-04/05/06/49 |
| m6 D3-Schlüssel mit Polarität | killed | AP-20 |
| m7 Accusation-Hash-Binding weg | killed | AB-01 |
| m8 Solution-Binding weg | killed | AB-03 |
| m9 Binding-Abbruch im Parse weg | killed | AP-08 |
| m10 Personen-Referenz im Evaluator weg | killed | AC-E2 |
| Polarität der Abdeckung → `has` | **survived** | erwartet äquivalent (Pflichtliterale lösen per TASK-0003 genau zu ihrem Wert auf); deshalb kein Vertragsmutant |

## 5. Accusation Semantics und Challenge-Experiment

Core (unverändert): `solved ⇔ alle requiredConclusions mit gleichem claimKey und gleicher Polarität behauptet ∧ kein Literal kanonisch boolesch ≠ behauptete Polarität`. `undetermined` neutral (D1). Technische Fehler sind nie ein Verdict.

Experiment [EXP], Scratch-Challenge-Wrapper ausschließlich aus MYST-0002-Exporten gebaut; Beispiel-Scope `allowedClaims` = alle Verantwortungs-, Rollen-, nobody-, Intent- und Mechanism-Claims zu `event:death` (+ Pflicht-Claims); Anklagen = Pflichtliterale plus 0, 1 oder 2 Zusatzliterale aus dem 88er-Universum, beide Polaritäten, über S1–S7:

| Größe | Wert |
|---|---|
| Anklagen | 4 247 |
| Core solved | 3 698 |
| Challenge solved | 104 |
| Core solved, Challenge nicht | 3 594 (127 nur wegen undetermined, 25 nur wegen außerhalb Scope, 3 442 beides) |
| Challenge solved, Core nicht | **0** |

Lesart: Der Core lässt sehr viele unbelegte oder irrelevante Zusätze durch. Das ist Absicht (D1) und genau der Grund für den Satz „CORE SOLVED ≠ PLAYER CHALLENGE COMPLETION“. Der Wrapper ist streng stärker (Challenge ⊆ Core) und braucht keine weitere Änderung an MYST-0002 [EXP]. Damit ist bewiesen, dass keine additive Challenge-Definition in MYST-0002 nötig ist.

## 6. Challenge Boundary (Vertrag §15, Folgetask)

Challenge solved ⇔ Core solved ∧ jedes Literal `(c, v)`: `claimKey(c) ∈ allowedClaims` ∧ Status ≠ `undetermined` ∧ `v` = kanonischer Boolean.

- `allowedClaims`: endlich, öffentlich, an die Truth gebunden, **ohne** Gewinnpolarität; nie Required-only (sonst ist die Frage die Lösung). Pflicht-Claims ⊆ `allowedClaims` (Authoring-Invariante).
- `undetermined` wird nicht umdefiniert; nur die Einreichung wird abgelehnt.
- Spielerseitig `solved | not_solved`, keine Fehler pro Literal; interne QA-Gründe erlaubt.
- [INF] Offen für den Folgetask/Solvability: ob jeder `allowedClaim` determiniert sein muss (sonst ist er eine Falle), und wie `allowedClaims` mit PlayerRef präsentiert wird.

## 7. Adversarial Matrix (30 Pflichtfälle)

Challenge-Spalte unter dem Beispiel-Scope aus §5. „=“ heißt: gleiches Ergebnis wie der Core.

| # | Fall | Vertrag | Core | Warum | Challenge später |
|---|---|---|---|---|---|
| 1 | exakte Pflichtantwort | AV-02 | solved | alles abgedeckt, nichts widerlegt | = |
| 2 | Pflichtliteral fehlt | AV-04/05/06 | not_solved | Abdeckung fehlt | = |
| 3 | Pflichtliteral falsch | AV-07/08 | not_solved | fehlt und widerlegt | = |
| 4 | zusätzlich kanonisch falsch | AV-11/12 | not_solved | widerlegt | = |
| 5 | zusätzlich wahr, irrelevant | AV-18 (caused) | solved | wahr, also nicht widerlegt | not_solved, wenn außerhalb `allowedClaims` |
| 6 | zusätzlich undetermined | AV-15, AV-16 | solved | D1 neutral | not_solved (undetermined eingereicht) |
| 7 | partial Responsibility | AV-35, AV-37 | solved | unbekannte Personen undetermined | not_solved bei jeder Zusatzperson |
| 8 | complete Responsibility | AV-11, AV-52 | not_solved bei falscher Person | complete schließt die Liste | = |
| 9 | roles null | AV-34, AV-38 | solved | Rolle undetermined | not_solved, sobald eine Rolle eingereicht wird |
| 10 | causesComplete false | AV-21, AV-42, AV-44 | solved | fehlende/transitive Kante undetermined | not_solved |
| 11 | intent unbekannt | AV-40 | solved | `intent: null` | not_solved |
| 12 | mechanism unbekannt | AV-64 (an poisoning), Grid | solved | `mechanism: null` | not_solved |
| 13 | nobody, complete | AV-53 | solved | keine Zuordnung, complete | = |
| 14 | nobody, partial | AV-60 | solved | `nobody` undetermined, neutral | not_solved (nobody eingereicht, undetermined) |
| 15 | mehrere Verantwortliche | AV-48/49 | solved / not_solved | jede Person ist eigenes Pflichtliteral | = |
| 16 | planner + direct_actor | AV-63 | solved | beide Rollen in der Liste | = |
| 17 | gleiche Person, mehrere Rollen | AV-63, AV-51 | solved / not_solved | Rollenliste geschlossen | = |
| 18 | doppeltes Literal | AP-19 | Parse-Fehler | D3 | = (Wrapper sieht keine geparste Anklage) |
| 19 | strukturelles Duplikat über andere ID | AP-21 (Property-Reorder); Katalog: TASK-0003 lehnt „Same claim as“ ab | Parse-Fehler | Anklage hat keine IDs; `claimKey` ist reihenfolgeunabhängig | = |
| 20 | fremde Truth | AP-09, AB-01 | Parse-Fehler / `ACCUSATION_BINDING_MISMATCH` | Hash-Bindung | = |
| 21 | fremde Solution | AB-02, AB-03 | `SOLUTION_BINDING_MISMATCH` | explizite Bindung, auch bei leerer Anklage | = |
| 22 | veralteter Hash | AP-09/10 | Parse-Fehler an `truthHash` | Truth-Revision/-Inhalt geändert | = |
| 23 | kaputter Claim | AP-14…18 | Parse-Fehler | `ConclusionClaimSchema` | = |
| 24 | unbekannte Conclusion | AP-04 | Parse-Fehler | Anklage kennt keine `conclusionId` (Zusatzschlüssel) | = |
| 25 | Duplikat mit entgegengesetzter Polarität | AP-20 | Parse-Fehler | D3 | = |
| 26 | negatives Pflichtliteral | AV-02 vs. AV-05, AV-56 | solved nur explizit | D2; gleichwertige Claims zählen nicht | = |
| 27 | positives Pflichtliteral | AV-02 vs. AV-04 | solved nur explizit | Abdeckung | = |
| 28 | nur irrelevante wahre Claims | AV-65 | not_solved | Pflichtliterale fehlen | = |
| 29 | Shotgun alle Personen bei partial | AV-61, AV-37 | solved | alle Zusatzpersonen undetermined | not_solved |
| 30 | Shotgun alle Rollen bei roles null | AV-62 | solved | alle Rollen undetermined | not_solved |

Jede Core-Erwartung ist als Test in der Scratch-Suite gelaufen [EXP]; die Challenge-Spalte folgt aus der Wrapper-Definition und ist für die Fälle 5, 6, 7, 9, 10, 29 im Challenge-Experiment enthalten [EXP], für die übrigen abgeleitet [INF].

## 8. Compatibility

- [ART] `MYSTERY-SOLVABILITY-V1-RESEARCH.md` nutzt `evaluateConclusionClaim(truth, solution, claim).status` (passt), plant einen „lokal nachgebauten“ Claim-Schlüssel (MYST-0002 exportiert stattdessen `claimKey`; besser, da eine Definition) und schreibt an einer Stelle `evaluateAccusation(acc, truth, solution)`. Der Vertrag bleibt bei `(truth, solution, accusation)` (gleiche Reihenfolge wie `evaluateConclusionClaim`, D6); Solvability muss die Reihenfolge übernehmen.
- [ART] MYST-0003/0004/0005-Entwürfe hängen nicht von MYST-0002-Symbolen ab.
- [CODE] Keine bestehende API ändert sich; der neue Export `claimKey` und der Typalias sind additiv; alle 1 087 Tests bleiben grün [EXP].

## 9. Risks

1. Ein Host zeigt das Core-Verdict trotz §7a als Spielerabschluss. Gegenmaßnahme nur Dokumentation (AC-17); echte Absicherung erst mit dem Challenge-Folgetask.
2. `evaluateConclusionClaim` ist ein Answer-Key-Orakel; Weitergabe an Spieler verrät die Lösung.
3. Laufzeit O(n · |Truth|) durch Hash pro Aufruf (K-3); für Spielgrößen unkritisch.
4. Mutationsanker legen einzelne Zeilen wörtlich fest; Abweichung macht Mutanten unanwendbar (Contract-Verstoß).
5. Format 1 für einen Nicht-Bootstrap-Task widerspricht FREEZE §5.10, solange kein Format-2-Parser existiert.

## 10. Exact Blockers

| ID | Blocker | Wer |
|---|---|---|
| B-1 | Format: Liegt bei Registrierung ein Format-2-Parser auf `main`, Frontmatter umstellen (Body bleibt). Sonst ist Format 1 die einzige prüfbare Form. | Owner/Spec-Autor |
| B-2 | Owner bestätigt N-1 (D3 = gleicher `claimKey`), N-2 (nur Verdict), N-3 (zwei Einzeilen-Änderungen), dazu neu N-4 (Core ≠ Challenge, Challenge als Folgetask mit eigener ID). | Seb |
| B-3 | Architekturreview durch Nicht-Anthropic-Reviewer. | Owner |
| B-4 | Basis-Drift: Änderung an einer §3-Datei bis zum Run erzwingt Revision. | Developer |

Kein technischer Blocker im Domain-Code.

## 11. GO / NO-GO

**GO für Owner-Review von MYST-0002** (Final Candidate). Der Vertrag ist gegen `3d7545d` abgeglichen, parst mit dem aktuellen Parser, ändert die Wahrheitstabelle nicht, trennt Core und Challenge ausdrücklich, und seine Kernbehauptungen sind experimentell belegt: 0 Differential-Unterschiede, 10/10 Vertragsmutanten getötet, Challenge ⊆ Core.

**Keine Freigabe, keine Registrierung, keine Implementierung.** B-1…B-4 gelten vor einem Run.

STOP.
