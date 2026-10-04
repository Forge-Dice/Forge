# FORGE V0.1 HARDENING PLAN

| Feld | Wert |
|---|---|
| Rolle | Lead Technical Planner, Forge V0.1 |
| Modus | rein lesend. Keine Änderung am Repository, keine Commits, keine PRs, keine Contracts |
| Datum | 2026-10-03, ca. 08:00 UTC |
| Repository | `Wuerfelduell/Forge` |
| Maßgeblicher Forge-Core-Stand | `codex/forge-core-v2-repair` @ `b9339d2` (Produktionskern, 12 Dateien, 1225 Zeilen). Codex hat seitdem `0dfd903` gepusht (Baseline-Index `forge/BASELINE-STATUS.md`, ChatGPT-Review-Record, zwei Test-only-Änderungen). **Kein Produktionscode hat sich seit `b9339d2` geändert**; alle Zeilenangaben unten gelten für beide Stände |
| Stand der Integration | `main` = `f5dbc73` (nur `.gitkeep`). Kein PR offen. Codex' Baseline-Kandidat ist `0dfd903`, noch nicht nach `main` gebracht |
| Grundlage | `forge-audits/FORGE-DEEP-AUDIT.md`, `FORGE-DEEP-RED-TEAM.md`, `FORGE-RUN-RECOVERY.md`, `FORGE-V0.1-MINIMUM-PRODUCT.md`, `FORGE-CONTRACT-HANDOFF-AUDIT.md`, `MYSTERY-ACCUSATION-VERDICT-DESIGN.md`; `src/forge/*.ts`, `tests/forge*/`, `forge/**`, `package.json`, `tsconfig.json` |
| Ziel | Die Härtung vor dem ersten echten Forge-managed Task (Mystery „Accusation & Verdict“) in kleine, einzeln implementierbare Tasks schneiden und in eine Abhängigkeitsreihenfolge bringen |

Finding-IDs werden so zitiert wie in den Audits: `C-xx`, `E-xx`, `V-xx`, `NRT-xx`, `TD-xx`, `A-xx`, `SM-xx` (Deep Audit), `DRT-xx`, `F1`–`F10`, `RTN-xx` (Red Team), `F-xx`, `SD-xx`, `K-x`, `R-x`, `G-x`, `P-x` (Run Recovery), `N1`–`N10`, `K1`–`K10`, `A1`–`A8`, `M01`–`M18` (Minimum Product), `B1`–`B6`, `S1`–`S10` (Handoff-Audit).

Plan-IDs dieses Dokuments: **K-01..K-05** (Kern), **P-01..P-06** (Plattform-Code), **O-01..O-02** (Betrieb/Konfiguration) = MUST; **S-01..** = SHOULD; **D-01..** = DEFER. Das sind Planungs-IDs, keine Forge-Task-IDs; die späteren Contracts bekommen IDs im Kernformat (z. B. `FORGE-CORE-0002`, `FORGE-OPS-0001`).

---

## Kurzantwort

**Dreizehn MUST-Tasks, keiner über 360 Produktionszeilen, in drei parallelen Spuren.** Der Kern bekommt fünf kleine, reine Änderungen (geschützte Pfade, plattformsichere Primitive, Evidence mit echter Diff-Basis und Dateimodi, Mutationsliste im Contract, Owner-/Rollen-/Linearitätsregeln). Die Plattform bekommt sechs neue, kleine Module unter `src/forge-github/` plus zwei Workflows (Git-Snapshot, Policy und Identitäten, Contract-Check, Handoff und Rollenvorlagen, Run-Gate, Verifier). Der Betrieb bekommt zwei Konfigurationsaufgaben (Baseline-Hygiene und Rulesets, Verifier-Spike mit bösartigen Test-PRs).

Der kritische Pfad ist die Plattformspur: **O-01 → O-02 → P-03 → P-05 → P-06 → Trockenlauf → erster echter Run.** Die Kernspur ist kürzer und liegt neben dem kritischen Pfad, wenn sie heute beginnt. Alles, was ein persistiertes Log, Leases, einen Reconciler, einen Findings-Ledger im Kern oder Parallelität braucht, kommt nach dem ersten Run oder später.

---

## 1. Decision Summary

### 1.1 Was V0.1 ist

Forge V0.1 ist ein **Torwächter über GitHub**: ein Task besteht aus einem Contract-PR (Freigabe = GitHub-Review, Registrierung = Squash-Merge nach `main`) und einem Run-PR von `forge/run/<TASK>-<n>` (Abnahme = Squash-Merge durch den Owner). Drei Required Checks aus `main` entscheiden, was mergebar ist; der vorhandene Kern (`src/forge`) ist dabei die **Bibliothek der Prüffunktionen** (Parser und Hash, Start-Gate, `evaluateVerification`), gefüttert mit Fakten, die ein Workflow selbst aus Git und der GitHub-API holt. Es gibt in V0.1 keinen persistierten Forge-Log, keinen Reconciler, keine Leases, keinen Server, keinen Agentenstart durch Forge.

```text
 Spec-Autor (eigene GitHub-Identität)        Reviewer (Identität ≠ Autor)         Seb (Owner, Android)
   push forge/spec/<TASK> ─► [Contract-PR] ── check "forge": Parser, Hash, Policy, Base auf main, 1 Datei
                                            ── check "forge-approval": zugewiesener Reviewer, Head-SHA
                                            ◄── Review approve / request changes ─────────────── Approve (Owner
                                            ── Squash-Merge (Owner) ─► main: Contract-Commit = 1 Parent, 1 Datei   oder Reviewer)
                                                     │
                                                     └─ Workflow "forge-handoff" (push main): 6-Zeilen-Handoff als PR-Kommentar ─► Seb
                                                                                                                    kopiert in
 Developer (eigene Identität) ◄──────────────────────────────────────────────────────────────────────────────────── Claude-/Codex-App
   checkout <contract_commit>; liest Contract aus Git; Read-Quittung; push forge/run/<TASK>-<n>
   ─► [Run-PR] ── check "forge": Gate (Start-Gate auf echtem Git, Quittung, aktuell, HALT) + Verifier (Diff C..head
                  --no-renames --raw, Scope, Checks je Job, Testinventar, Mutanten aus dem Contract)
               ── check "forge-approval": Code-Reviewer ≠ Developer, Approval auf Head-SHA
               ── Squash-Merge (Owner, nur grün + aktuell + Approval auf letztem Push) = accepted
```

### 1.2 Entscheidungen

| # | Entscheidung | Begründung / Quelle | Status |
|---|---|---|---|
| D-1 | **Kein eigener Event-Log vor dem ersten Run.** Jeder Check berechnet seinen Zustand ephemer aus GitHub-Fakten (Commits auf `main`, PRs, Reviews, Head-SHAs). Der Kern wird dabei per `replay` über eine synthetisierte, kurze Eventliste benutzt, aber nichts wird gespeichert | Minimum Product A1/K9; Seb: kein komplexes Recovery. Ein zweiter Ort der Wahrheit neben GitHub wäre Infrastruktur ohne Vorfall | fest |
| D-2 | **`main` ist linear, nur Squash-Merges.** Ein PR = ein Commit. Ein Contract-Commit hat damit genau einen Parent und darf nur die Contract-Datei berühren; das Gate prüft beides nach (Defense in Depth zum Ruleset) | DRT-05/F4, C-08/E-12/NRT-02, Red Team §9 Punkt 3 | fest |
| D-3 | **Der Kern bleibt zeitlos und rein; keine neuen Zustände, keine neuen Event-Typen.** Änderungen nur dort, wo Gate und Verifier sie brauchen (K-01..K-05) | Minimum Product §6.3 Kernel-Freeze; Deep Audit §17.5 | fest |
| D-4 | **Identität = GitHub-Login, Rolle = `forge/policy.json`.** Owner = `Wuerfelduell`, einziger `human`. Agenten sind `ai_agent` mit eigener Identität. ChatGPT ohne Identität handelt nur über Seb; sein Urteil zählt als Owner-Urteil, nie als unabhängiges Review | KRITISCH 1/2 des Deep Audit (RT-05, E-02, E-14, NRT-26), K8 | fest; Codex-Login ist Owner-Entscheidung |
| D-5 | **Zugewiesener Reviewer statt Findings-Ledger.** Je Task und Gate zählt nur der Reviewer, der als Erster auf einem PR dieses Tasks reviewt hat (abgeleitet aus der GitHub-Historie); Wechsel nur per Owner-Kommentar. Ein `changes_requested` bleibt damit beim selben Reviewer, auch über einen neuen PR | DRT-02/F2, E-01, E-22, Deep Audit §8.3 („Reviewer-Zuweisung durch Forge, nicht durch Selbstauswahl“); ohne Kernänderung umsetzbar | fest für V0.1; Ledger mit Finding-IDs = S-03 |
| D-6 | **Beobachtung = Live-Fakt zur Prüfzeit, repo-gebunden, mit ehrlichem Git-Tooling.** `GIT_NO_REPLACE_OBJECTS=1`, kein Mirror-Klon, `fetch-depth: 0`, Refs nur per `ls-remote` des kanonischen Repos, Diff immer `--no-renames --raw`. Das Kernel-Observation-Modell (seq, observedAt, Widerruf) wird erst mit einem persistierten Log gebraucht | DRT-11/12 (F1), DRT-18 (F3), DRT-19, DRT-20, DRT-21 | fest; Kernmodell = S-02 |
| D-7 | **Mutanten stehen im Contract und werden vom Verifier ausgeführt.** Developer-Mutationen zählen nie. `optional` entfällt. Ein überlebender Mutant ist rot; „äquivalent“ heißt Contract-Revision, nicht Quittung | E-05/E-06, C-32/C-33, P-04 (M1), K7, Minimum Product A5 | fest |
| D-8 | **Eine Liste immer verbotener Pfade im Kern, keine Coordination-Ausnahme mehr.** Koordinationsdateien verlassen den Produktpfad | C-28, VX-01/03, RT-02, E-11, DRT-22/23, TD-08/09, M13 | fest |
| D-9 | **Run-Start bleibt manuell** (Handoff aus 6 Identifikatoren, Rollenvorlage), Run = PR, Abnahme = Owner-Merge des verifizierten Heads. GitHub-Regeln (up to date, Approval des letzten Push, Required Checks) ersetzen Kernel-Staleness und Head-Drift-Prüfung | Minimum Product A2/A3, K4/K5/K10 | fest |
| D-10 | **Bootstrap-Modus für die Härtungs-PRs selbst.** Forge kann sich noch nicht selbst verwalten. Jeder MUST-Task ist ein PR nach `main`, Autor ≠ Reviewer (andere Identität), Merge durch Seb; `policy.json` hat ein Flag `bootstrap: true`, mit dem der Check `forge` solche PRs (weder Contract- noch Run-PR) als „BOOTSTRAP, nicht Forge-managed“ grün meldet. Mit V0.1-Exit wird das Flag auf `false` gesetzt | TD-24 (Änderungen ohne Contract), Minimum Product M16 | fest |
| D-11 | **Erster Forge-managed Task = Mystery „Accusation & Verdict“**, davor ein Trockenlauf mit einem trivialen Drill-Task durch dieselbe Pipeline | Sebs Vorgabe; Exit-Kriterium 1 | fest; Task-ID (voraussichtlich TASK-0006) bestätigt Seb |
| D-12 | **`baseCommit` bleibt im Contract, Run startet vom Contract-Commit** (Kern unverändert). Neue Regel außerhalb des Kerns: `baseCommit` liegt auf der First-Parent-Kette von `main`. Die Trennung Contract-Base/Run-Base (Run Recovery §5.6 Punkt 5) kommt erst, wenn Reconcile-Fälle real auftreten | Run Recovery Anhang B.1; vor dem ersten Run gibt es keinen parallelen Run und damit keinen Reconcile | fest für V0.1; = S-04 |
| D-13 | **Legacy-Artefakte bleiben Geschichte.** `forge/contracts/TASK-0004.md` (YAML), `TASK-0005.md`, `forge/approvals/*.json`, `forge/reviews/*` werden weder migriert noch registriert; Tasks mit Legacy-Contract-Historie sind in V0.1 nicht Forge-managed. `forge/**` wird CODEOWNERS-geschützt | Handoff-Audit B1/B5/B6, Deep Audit C-14/C-15/C-22, BASELINE-STATUS.md | fest; Migration = S-09 |
| D-14 | **Required Checks heißen `forge` und `forge-approval`** (ein Name je Zweck, beide aus GitHub Actions). Da Rulesets nicht nach PR-Art unterscheiden, entscheidet der Workflow `forge` selbst, ob er die Contract- oder die Run-Pipeline fährt | Rulesets erlauben keine bedingten Required Checks; eindeutige Namen gegen gleichnamige API-Statuses (17.4 Punkt 3) | fest |
| D-15 | **`maxActiveRuns = 1` bis nach dem ersten Run.** Scope-Lease, serielle Spur und Reconcile-Policy sind SHOULD | Run Recovery PT-10, §5.5; kein paralleler Run vor dem ersten | fest |

### 1.3 Was der Plan bewusst nicht enthält

Keine Contracts (die Task-Karten sind Vorlagen für Contracts, keine Contracts), keine Implementierung, kein Zeitplan in Stunden (die Reihenfolge ist eine Abhängigkeitsordnung), keine Agentenzuordnung als Pflicht (nur Vorschläge in §7).

### 1.4 Offene Owner-Entscheidungen, die MUST-Tasks blockieren

| # | Frage | Blockiert | Empfehlung |
|---|---|---|---|
| OD-1 | Welche GitHub-Identität bekommt Codex (eigener Account als Collaborator oder Fine-grained-Token eines zweiten Accounts)? Heute committet Codex als `Diceduel <315180734+Wuerfelduell@…>`, also unter Sebs Konto, auch in `0dfd903` | O-01, P-02 | eigener Account, Collaborator mit Write, kein Admin |
| OD-2 | Unter welchem Login erscheinen Claude-PRs und -Reviews (GitHub-App-Login oder ein eigener Account)? | P-02 (Policy), O-02 ermittelt es | im Spike O-02 messen, dann in `policy.json` eintragen |
| OD-3 | Wer ist Architektur-Reviewer und wer Code-Reviewer des ersten Tasks? Beide müssen ≠ Spec-Autor bzw. ≠ Developer sein, und der Developer darf nicht der Architektur-Reviewer des eigenen Contracts sein (E-14) | Readiness-Checkliste | Spec: Codex, Architektur-Review: Seb (ggf. mit ChatGPT), Developer: Claude, Code-Review: Codex |
| OD-4 | Kommt die Baseline `0dfd903` so nach `main` (inkl. `forge/coordination/*`)? Die Koordinationsdateien sollten im selben Zug oder direkt danach aus dem Produktpfad verschwinden (O-01) | O-01 | Baseline unverändert mergen, O-01 löscht die Koordinationsdateien in einem Folge-PR |
| OD-5 | Task-ID des ersten Forge-Tasks (TASK-0006?) und Entscheidungen D1–D10 aus `MYSTERY-ACCUSATION-VERDICT-DESIGN.md` | Readiness-Checkliste, nicht die Härtung | vor dem Contract-PR entscheiden |

---

## 2. MUST Before First Run

Kriterium für MUST: Ohne den Task ist mindestens eines wahr: (a) ein einzelner Akteur kann falsche Arbeit nach `main` bringen, ohne zu täuschen (KRITISCH-Befunde), (b) der erste Run würde eine Infrastruktur aufbauen, die nachweislich an der falschen Semantik hängt (Red Team §9), oder (c) ein Exit-Kriterium aus Minimum Product §10 ist ohne ihn nicht erfüllbar. Alles andere ist SHOULD oder DEFER, auch wenn es im Audit „HOCH“ heißt.

| ID | Arbeitstitel | Deckt ab (Auswahl) | Spur | Prod-Zeilen | Test-Zeilen |
|---|---|---|---|---|---|
| K-01 | Geschützte Pfade und Ende der Coordination-Ausnahme | C-28, E-13, NRT-10/12/22, VX-01/03, RT-02, E-11, DRT-22/23, A-04/05/06/23/25, TD-08/09 | Kern | 60–90 | 150–220 |
| K-02 | Pfad-, Ref- und Textprimitive plattformsicher | DRT-25, DRT-17, DRT-15, DRT-28, C-30/E-13b, TD-26, A-19 | Kern | 50–70 | 120–180 |
| K-03 | Evidence v3: echte Diff-Basis, Dateimodi, deterministische Diff-Optionen, Darstellbarkeit | KRITISCH 3 (E-09/NRT-01), DRT-21, DRT-22, DRT-24, V-26, E-10/NRT-09, A-15/A-18, TD-06, TD-15 | Kern | 90–130 | 200–280 |
| K-04 | Mutationsliste im Contract, Developer-Mutationen zählen nicht | E-05/NRT-15, E-06/NRT-16, C-32/C-33, V-17..V-19, DRT-32, P-04/P-06/P-11, TD-12, A-11/A-12 | Kern | 80–120 (netto, inkl. Löschungen) | 150–220 |
| K-05 | Owner-, Rollen- und Linearitätsregeln im Kern | DRT-34/F9, E-02/V-01/TD-18 (Verifier ≠ Developer), E-25/NRT-19/DRT-40, RT-07/F-17/K-3, E-17/NRT-24, DRT-05/F4, DRT-03, DRT-42 | Kern | 60–90 | 180–250 |
| P-01 | Git-Snapshot: die einzige Stelle, die Git liest (Observation-Grenzen) | DRT-18/F3, DRT-19, DRT-20, DRT-17, DRT-27/F7, DRT-21, NRT-30/DRT-06, C-23/C-24/E-20, A-06 | Plattform | 180–240 | 200–300 |
| P-02 | Policy und authentifizierte Identitäten | KRITISCH 1/2 (RT-05, E-02, E-14, NRT-20, NRT-26), C-21, C-27, DRT-33, TD-01/05/19, A-26 | Plattform | 130–180 | 120–180 |
| P-03 | Contract-Check und Approval-Check (`forge`, `forge-approval` auf Contract-PRs) | N1/N2/N4, K2/K3, C-08/C-10 (Base auf `main`), C-22/P-02, C-14/B5, C-26/S3, C-29/C-31, DRT-02 (D-5), RT-07/E-17, DRT-03, P-07/P-08 | Plattform | 250–330 (+40 YAML) | 200–300 |
| P-04 | Handoff und Rollenvorlagen | N1/N4, M01/M02/M04, B3/B4, K4, Exit-Kriterien 2/3 | Plattform | 70–110 (+30 YAML, +Markdown) | 60–100 |
| P-05 | Run-Gate und Approval-Check auf Run-PRs | K5, N2/N9, NRT-30/DRT-06, C-23/C-24, SD-04/P-C (Quittung), E-14/NRT-20, DRT-38, F-23 (WRONG_BASE), Exit-Kriterien 2/5 | Plattform | 280–360 (+40 YAML) | 250–350 |
| P-06 | Verifier: Preflight, Check-Jobs, Testinventar, Mutanten, Aggregator | N5/N6, KRITISCH 3/4, TD-06/07, A-04/08/10/23/24, V-11..V-18, NRT-01/10/12/13/15, K6/K7, Exit-Kriterien 5/6 | Plattform | 280–360 (+120 YAML) | 220–320 |
| O-01 | Baseline-Hygiene, CODEOWNERS, Rulesets, Identitäten, `FORGE_HALT` (FORGE-OPS-0001) | N3, N5/P-10/C-34, N8, TD-01/02/03, P-09/P-12, A-07, K1/K3/K10, G-1/G-2/G-3, Exit-Kriterien 4/6/7/8/9/10 | Betrieb | ~20 (Konfigurationsdateien) | Drills |
| O-02 | Verifier-Spike und bösartige Test-PRs (FORGE-OPS-0002) | TD-07, Deep Audit 17.4, A-05, A-24, Exit-Kriterium 5 | Betrieb | 60–80 YAML, 0 Code | Drills |

Summen (Schätzung): Kern 340–500 Produktionszeilen, Plattform 1190–1580, YAML ~290; Tests 1850–2600. Jeder Task einzeln unter 400 Produktionszeilen.

---

## 3. SHOULD After First Run

Auslöser-gebunden: jeder SHOULD-Task nennt, welcher Vorfall oder welche Messung ihn rechtfertigt. Vor dem Auslöser nicht bauen.

| ID | Arbeitstitel | Inhalt | Auslöser / Begründung | Quelle |
|---|---|---|---|---|
| S-01 | Status-Projektion (`forge status`, angeheftetes Status-Issue) | Zustand je Task aus GitHub-Fakten ableiten, Replay des Kerns über abgeleitete Events, Status-Issue und Check-Summaries mit „wartet auf“ | Sobald mehr als ein Task gleichzeitig offen ist; für den ersten Run genügen PR-Liste und Check-Summaries | K9, N8, Minimum Product OPS-0003 |
| S-02 | Observation-Modell im Kern | `remote_observed` mit `repo`, `seq`, `observedAt` eines einzigen Observers; jüngste Beobachtung je Ref zählt; Beobachtung auch in `running`; Pflicht-Neubeobachtung vor Review und Acceptance | Sobald ein persistierter Observer Events schreibt (D-1 aufgehoben) oder ein Webhook-getriebener Observer gebaut wird. In V0.1 ist jede Beobachtung ein Live-Fakt | DRT-11/12 (F1), RT-09, RTN-01..03, K-4 |
| S-03 | Findings-Ledger mit IDs | Finding-IDs `F-<task>-<n>`; Approve einer Folgeversion oder eines Folge-Runs muss jede offene blocking ID als `resolved_in`/`withdrawn` adressieren; Rework-Run darf nicht denselben Commit melden | Erster Fall, in dem der zugewiesene Reviewer wechselt oder ein Finding über eine Revision hinweg verloren geht | DRT-02, E-01/E-22, R-01..R-06, RTN-04 |
| S-04 | Contract-Base von Run-Base trennen, Stale-Base-Policy | Contract nennt Dependencies und `specifiedAgainst`; Run startet vom aktuellen `main`; RECONCILE per Merge-Commit, Re-Review nur bei nicht-mechanischer Auflösung (`merge-tree`-Regel) | Erster Run, der nach Verifikation durch einen Merge auf `main` stale wird (Ruleset „up to date“ blockiert ihn dann; die Nacharbeit ist heute manuell) | Run Recovery §5.3, §5.6 Punkt 5, SD-01, Anhang B.1 |
| S-05 | Scope-Lease und serielle Spur | `SCOPE_LEASE_CONFLICT` über alle aktiven Run-PRs; Pfadklassen `shared`/`protected`; `maxActiveRuns > 1` | Zweiter paralleler Run gewünscht | PT-10, PT-12, Deep Audit §9.3, P-2 |
| S-06 | Testinventar je Datei gegen Baseline | Statt Gesamtsummen: je Testdatei Anzahl und Skips gegenüber Start-Commit; Senkung nur bei namentlicher Contract-Freigabe | Erster Run, der bestehende Testdateien modifiziert (`scope.modify` enthält `tests/**`) | A-08, 7.4 Punkt 2 |
| S-07 | Patch-Tasks und Dependency-Staleness nach Revert | Patches als neue Version derselben Task-ID oder Event `task_superseded_by`; Dependency-Revert → Merge des Abhängigen blockiert | Erster Patch-Task oder Revert auf `main` | DRT-07, PT-13, SD-03 |
| S-08 | Contract-Hash über Bytes im Kern-Port | `parseContractDocument` bekommt Bytes oder dekodiert fatal; Approval zusätzlich an Blob-SHA gebunden (im Check-Summary heute schon als Kontrollwert) | Nach dem ersten Run; P-01 dekodiert in V0.1 bereits fatal, der Kern-Port bleibt textbasiert | DRT-27/F7, RTN-11 |
| S-09 | Migration der Legacy-Contracts (TASK-0004, TASK-0005) | Kernkonformes `---json`, Statusfelder raus, End-Marker; neue Bytes = neues Architektur-Review | Nur wenn TASK-0005 (oder ein Folge-Task von 0004) Forge-managed laufen soll | B1/B5/B6, Deep Audit Roadmap 5, Run Recovery Anhang B.4 |
| S-10 | Minimale Lease: `run_expired` durch Schedule-Workflow | Rolle `system`, `run_expired` nach TTL ohne Push; nur aus erfolgreicher Beobachtung; kein Reconciler | Erster verwaister Run-PR, der länger als einen Tag ohne Push steht | Run Recovery §7, F-01..F-03, K-1 |
| S-11 | Rework-Regel im Kern | Nach `request_changes(code_change)` darf der Folge-Run nicht denselben `claimedResultCommit` melden, außer Owner-Freigabe | Zusammen mit S-03 | E-01, Deep Audit §8.3 |
| S-12 | `protectedPathOverrides` im Contract | Begründete Ausnahmen für Forge-Core-Tasks (`src/forge/**`, `package.json`), sichtbar für den Architektur-Reviewer | Erster Forge-Core-Task, der nach V0.1-Exit über Forge laufen soll (Bootstrap-Flag aus) | 7.4 Punkt 3, TD-20 |
| S-13 | Größenlimits für Contract, Report, Evidence, Diff | Zeichen- und Dateizahl-Limits | Erster Run mit auffällig großem Diff oder Report | E-18/NRT-23, A-14, C-38 |
| S-14 | Binärdateien und generierte Dateien | Evidence mit Größe/Binärkennung; Policy-Klasse `generated` | Erster Task mit Binär- oder generierten Dateien | A-21/A-22, PT-09 |
| S-15 | Owner-Kommandos als PR-Kommentar (`/forge reviewer`, `/forge halt`) | Nur vom Owner-Login, idempotent | D-5 nutzt nur `/forge reviewer`; der Rest, wenn das Handy-Journey es braucht | Run Recovery §8.3, Minimum Product §7 |

---

## 4. Deferred

| ID | Nicht jetzt | Warum nicht | Wann neu prüfen |
|---|---|---|---|
| D-01 | Persistierter JSONL-Log mit Genesis, `seq`, `eventId`, `prevHash`, externem Anker | Kein Fakt, den GitHub nicht hält (D-1). Truncation/Duplikate (E-07/E-08/E-16, L-01..L-12, DRT-10/14) betreffen nur einen Log, den es nicht gibt | Erster Fakt außerhalb von GitHub (Kosten, Leases) |
| D-02 | Kernel-Regelversionierung je Run (E-24/NRT-06) | Ohne persistierten Log keine Historie, die unlesbar werden könnte | mit D-01 |
| D-03 | Reconciler, NEEDS_HUMAN-Katalog, Retry-Budgets, Idempotenzschlüssel, `late_result_observed`, Salvage | Sebs Vorgabe „kein komplexes Recovery-System“; Run Recovery §10 nennt die Auslöser | wiederholte verwaiste Runs; mehr als 3 parallele Runs |
| D-04 | Budgets, Kostenzählung, LLM-Gateway | Keine Kostendaten, kein Vorfall (A4). Nur Ausgabelimits beim Anbieter je Agent-Schlüssel (O-01) | erste überraschende Rechnung |
| D-05 | PWA, Backend, Postgres, Queue, SSE, eigener Cloud-Runner, eigener Agent-Runner, Agentenstart per Dispatch | Sebs Entscheidung; Minimum Product §9/§12 | nach V0.1-Exit anhand der Messung „größter verbleibender Handgriff“ |
| D-06 | Eigenes Forge-Repository (TD-20) | Geschützte Pfade (K-01) decken den Bootstrap-Konflikt ab | mehrere Spiele/Repos |
| D-07 | Merge Queue, Priorisierung, Scheduler | ≤ 3 Runs; „wer zuerst merged, gewinnt“ | > 3 gleichzeitig approved Runs |
| D-08 | Fork-Netzwerk-Behandlung über „keine PRs aus Forks“ hinaus | V0.1 lehnt Fork-PRs ab (P-05) | externe Beiträge |
| D-09 | Performance (PERF-1/2b, TD-21), RT-12/13/14-Robustheit (TD-22) | erst ab ~10 k Events bzw. nur In-Process relevant | messbar |
| D-10 | Mehrfach-Reviews, Quoren, Reviewer-Reputation, LLM als Verifier, automatische Konfliktlösung | Deep Audit §20 Punkte 7–8, Run Recovery §10 Punkt 6 | nie ohne nachgewiesenen Bedarf |
| D-11 | Netzwerk-Egress-Sperre im Verifier (Sandbox-Spalte in Deep Audit §6.2) | GitHub-hosted Runner bieten keine einfache Egress-Policy; Verifier hat keine Secrets und `contents: read` | sobald der Verifier Secrets braucht oder ein Exfiltrationsvorfall auftritt |
| D-12 | DB-Migrationen, Generator-Pipeline (PT-08/PT-09) | Es gibt weder Migrationen noch generierte Dateien | erster Task mit Persistenz/Codegen |
| D-13 | Automatisches Contract-Rebase | Contract-Änderung ist Spezifikationsentscheidung | nie; stattdessen S-04 |

---

## 5. Task Dependency Graph

```text
  extern: Codex-Baseline (Kandidat 0dfd903) ──► main
                 │
                 ▼
  O-01 Baseline-Hygiene, CODEOWNERS, Rulesets, Identitäten, FORGE_HALT
                 │
                 ▼
  O-02 Verifier-Spike + bösartige Test-PRs ─────────────────────────────────────────┐
                                                                                     │
  Kernspur (unabhängig von O-01/O-02, kann sofort gegen 0dfd903 beginnen):           │
     K-01 Geschützte Pfade ──► K-03 Evidence v3 ──► K-04 Mutationsliste              │
     K-02 Primitive                                                                  │
     K-05 Owner/Rollen/Linearität                                                    │
        (K-03 und K-05 berühren beide state.ts: nacheinander mergen)                 │
                                                                                     │
  Plattformspur:                                                                     ▼
     P-02 Policy/Identitäten (braucht O-01 für die Logins, O-02 für den Claude-Login)
     P-01 Git-Snapshot (Form der changedFiles aus K-03)
         │                 │
         └───────┬─────────┘
                 ▼
     P-03 Contract-Check + Approval-Check   (braucht K-01, K-02, K-04, P-01, P-02, O-02)
                 │
                 ├──► P-04 Handoff + Rollenvorlagen (braucht P-02, P-03)
                 │
                 ▼
     P-05 Run-Gate + Approval-Check         (braucht K-05, P-01, P-02, P-03, O-02)
                 │
                 ▼
     P-06 Verifier                          (braucht K-01, K-03, K-04, P-01, P-02, P-05, O-01, O-02)
                 │
                 ▼
     Trockenlauf FORGE-DRILL (trivialer Task durch die ganze Pipeline, vom Handy)
                 │
                 ▼
     Erster echter Forge-managed Run: Mystery „Accusation & Verdict“
```

**Kritischer Pfad:** O-01 → O-02 → P-03 → P-05 → P-06 → Trockenlauf → erster Run. Sechs Schritte, davon zwei Betrieb, drei Plattform-Code, ein Drill.

**Parallelität:** Die fünf Kern-Tasks brauchen weder Baseline-Merge noch Spike; sie können heute auf einem Branch gegen `0dfd903` beginnen und müssen nur vor P-03 (K-01, K-02, K-04), P-05 (K-05) und P-06 (K-03, K-04) auf `main` sein. P-01 und P-02 laufen parallel zu O-02; P-01 wartet nur auf die Evidence-Form aus K-03.

**Merge-Reihenfolge auf `main` (Vorschlag, konfliktarm):** Baseline → O-01 → K-01 → K-02 → K-03 → K-05 → K-04 → P-02 → P-01 → O-02-Skelett → P-03 → P-04 → P-05 → P-06.

**Was nicht auf dem Pfad liegt:** S-01 Status-Issue (die ersten Runs werden über PR-Liste und Check-Summaries beobachtet), S-02 Observation-Modell, S-03 Ledger, S-04 Reconcile.

---

## 6. Implementable Task Cards

Jede Karte ist als Vorlage für einen späteren Contract gedacht (Scope = `scope.create`/`scope.modify`, Acceptance-Idee = Acceptance-Kriterien, Adversarial Tests = Pflichttests, Nicht dazugehörig = Non-Goals). Im Bootstrap-Modus (D-10) ist jede Karte ein PR mit Autor ≠ Reviewer, Merge durch Seb. Pfadangaben beziehen sich auf `b9339d2`/`0dfd903`.

### K-01 Geschützte Pfade und Ende der Coordination-Ausnahme

| Feld | Inhalt |
|---|---|
| **Ziel** | Der Kern kennt genau eine Liste immer verbotener Pfadpräfixe und -muster, vergleicht sie **case-insensitiv und segmentweise**, und hat keine Ausnahme mehr für `forge/coordination/`. Der Contract-Parser lehnt Scope-Einträge ab, die diese Liste treffen (auch als Alias). |
| **Warum notwendig** | Ein Contract darf heute `.github/workflows/x.yml`, `package.json`, `vitest.config.ts`, `src/forge/verification.ts` im Scope führen (C-28, E-13, NRT-22) und damit Verifier und Testlauf aushöhlen (VX-03, NRT-12, V-11/V-13). Unter `forge/coordination/` ist ohne Scope alles erlaubt, auch `.test.ts`, das `npm test` im Verifier ausführt (VX-01, NRT-10, V-07), Symlinks (DRT-22) und Überschreiben/Umbenennen fremder Dateien (E-11). Geschützte Präfixe sind exakte, case-sensitive Strings; `forge/Contracts/…` und `forge/approvals/…` passieren Parser und Verifikation (DRT-23/F5). Ohne diesen Task ist jede Verifier-Umgebung (P-06) vom Prüfling steuerbar. |
| **Dependencies** | keine. |
| **Erlaubter Scope** | create: `src/forge/protected-paths.ts`. modify: `src/forge/verification.ts` (`ALWAYS_FORBIDDEN_PREFIXES`, `PROCESS_NOTE_PREFIX`, `scopeViolations`), `src/forge/contract-document.ts` (`ContractMetadataSchema.superRefine`), `tests/forge/verification.test.ts`, `tests/forge/contract-document.test.ts`, `tests/forge/repair-v2.test.ts`, `tests/forge/dogfood.test.ts`, `tests/forge/fixtures.ts`, `tests/forge/run-fixtures.ts`, `tests/forge-red-team/model.ts`, `tests/forge-red-team/findings.test.ts`. |
| **Erwartete Produktionszeilen** | 60–90 (neues Modul ~35; `verification.ts` −15/+10; `contract-document.ts` +10). |
| **Erwartete Testzeilen** | 150–220. |
| **Acceptance-Idee** | (1) `isProtectedPath(path)` in `protected-paths.ts`; Liste (Präfixe, segmentweise, case-insensitiv): `.github/`, `.gitattributes`, `.gitmodules`, `.npmrc`, `.nvmrc`, `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.*.json`, `vitest.config.*`, `vitest.workspace.*`, `vite.config.*`, `forge/` (ganz), `src/forge/`, `src/forge-github/`, `tests/forge/`, `tests/forge-red-team/`, `tests/forge-github/`, `scripts/`, `node_modules/`, `dist/`; Muster: jedes Segment `__snapshots__`, jede Datei `*.snap`. (2) Parser: Scope-Eintrag, der die Liste trifft → `METADATA_SCHEMA` mit Pfad `["metadata","scope",<liste>,<i>]`. (3) Verifikation: `changedFiles`-Eintrag auf geschütztem Pfad → `SCOPE_VIOLATION`, unabhängig von `change`; `deleted` bleibt immer Verstoß; keine Ausnahme für irgendein Präfix. (4) `tests/forge-red-team/model.ts` spiegelt die neue Regel, Differentialtest weiter 0 Abweichungen. (5) Der Dogfood-Test, der heute Coordination-Dateien als erlaubt annimmt, wird umgekehrt. |
| **Adversarial Tests** | Scope mit `forge/Contracts/TASK-0001.md`, `Forge/contracts/TASK-0001.md`, `forge/contracts./TASK-0001.md` (durch K-02 ohnehin ungültig), `forge/approvals/x.json`, `FORGE/COORDINATION/x.md`, `.GitHub/workflows/x.yml`, `Package.json`, `tsconfig.build.json`, `vitest.config.mts`, `src/Forge/state.ts`, `tests/forge-red-team/model.ts`, `a/__snapshots__/b.snap`, `x.SNAP` → alle `METADATA_SCHEMA`. Positivfälle, die **erlaubt** bleiben müssen: `forgery/contracts/x.md`, `src/forge-domain/x.ts` ist **verboten**? Nein: nur exakte Segmente zählen, `src/forge-domain/` ist erlaubt; `tests/forge-red-team2/x.ts` erlaubt; `packages/package.json` erlaubt (Liste gilt für Repo-Wurzel-Pfade, außer `__snapshots__`/`*.snap`/`node_modules/`, die überall gelten). Evidence `added forge/coordination/notes.test.ts` → Verstoß (E-11/VX-01 umgekehrt). Rename-Fälle entfallen (K-03), bis dahin: `renamed forge/coordination/a.md → forge/coordination/b.md` → Verstoß. |
| **Nicht dazugehörig** | `protectedPathOverrides` (S-12), CODEOWNERS und Löschung der Koordinationsdateien im Repo (O-01), Policy-Datei (P-02), Pfadform-Regeln (K-02), Dateimodi (K-03). |

### K-02 Pfad-, Ref- und Textprimitive plattformsicher

| Feld | Inhalt |
|---|---|
| **Ziel** | `RepoPathSchema`, `RefNameSchema`, `TextSchema`, `AgentIdentity.label` und der Contract-Text lehnen alles ab, was auf Windows/macOS/Linux oder in Git unterschiedlich interpretiert wird oder im Mobile-Review täuscht. |
| **Warum notwendig** | `RepoPath` erlaubt `aux.md`, `con`, `x.`, `x ` (DRT-25; Git for Windows verweigert den Checkout, Seb und Codex arbeiten auf Windows). `RefName` erlaubt `main` und `refs/heads/main` nebeneinander und optionsartige Namen wie `--upload-pack` (DRT-17, G6). Einzelne Surrogate in Labels überleben nur bei `JSON.stringify`-Persistenz (DRT-15). NUL und Bidi-Override in der Contract-Prosa werden angenommen, Agenten lesen die Prosa als Anweisung (DRT-28); Check-Commands mit Homoglyph/Bidi sehen am Handy wie `npm test` aus (C-30/E-13b, NRT-21, TD-26). Klein, aber jede dieser Lücken liegt an einem Eingang, den P-01/P-03 ab sofort mit echten Daten füttern. |
| **Dependencies** | keine. Parallel zu K-01 (berührt `contract-document.ts` an anderer Stelle: Stage 1 statt `superRefine`). |
| **Erlaubter Scope** | modify: `src/forge/primitives.ts`, `src/forge/contract-document.ts` (Stage 1, neuer Issue-Code `CONTROL_CHARACTER`; `CheckSpecSchema.command`), `src/forge/identity.ts` (`label`), `tests/forge/contract-document.test.ts`, `tests/forge/identity.test.ts`, `tests/forge/runs.test.ts`, `tests/forge/start-gate.test.ts`, `tests/forge/fixtures.ts`, `tests/forge/run-fixtures.ts` (Refs auf `refs/heads/…` umstellen), `tests/forge-red-team/*.ts` (Fixtures). |
| **Erwartete Produktionszeilen** | 50–70. |
| **Erwartete Testzeilen** | 120–180. |
| **Acceptance-Idee** | (1) `RepoPath`: je Segment verboten: Windows-reservierte Namen (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9`, case-insensitiv, mit oder ohne Erweiterung), End-Punkt, End-Leerzeichen (durch Regex ohnehin), `.git` (case-insensitiv), Länge je Segment ≤ 100. (2) `RefName`: muss mit `refs/heads/` oder `refs/tags/` oder `refs/pull/` beginnen; kein Segment beginnt mit `-` oder `.`; kein Segment endet auf `.lock`; kein `@{`, kein `..`, kein `//`, kein Leerzeichen. (3) `TextSchema` und `label`: keine einzelnen Surrogate, keine C0/C1-Steuerzeichen außer `\n` und `\t`. (4) Contract-Text (Stage 1): U+0000, andere C0 außer `\n`/`\t`, C1, U+202A–U+202E, U+2066–U+2069 → `CONTROL_CHARACTER` (zusammen mit den anderen Stage-1-Codes gemeldet). (5) `requiredChecks[].command`: nur druckbares ASCII (0x20–0x7E), Länge ≤ 200. |
| **Adversarial Tests** | Pfade `aux.md`, `src/con`, `COM1.ts`, `x.`, `src/.git/config`, `a/.GIT/b`; Refs `main`, `--upload-pack`, `refs/heads/-x`, `refs/heads/a.lock`, `refs/heads/a..b`, `refs/heads/refs/heads/main` (erlaubt, denn syntaktisch gültig; die Mehrdeutigkeit löst P-01, indem es nur voll qualifizierte Refs liefert); Label `dev\ud800`, `dev\u0007`; Contract-Prosa mit U+202E und U+0000 (X35 umgekehrt); Command `npm tеst` (kyrillisch), `npm test‮`, `npm test\n`; Golden-Vector-Test für `contentHash` unverändert für gültige Texte (Hash-Stabilität). |
| **Nicht dazugehörig** | Unicode-Normalisierung, Nicht-ASCII-Pfade (bleiben ungültig; Darstellbarkeit ist K-03), Ref-Mehrdeutigkeit auf Remote-Seite (P-01), Längenlimits für Prosa (S-13). |

### K-03 Evidence v3: echte Diff-Basis, Dateimodi, deterministische Diff-Optionen, Darstellbarkeit

| Feld | Inhalt |
|---|---|
| **Ziel** | `VerificationEvidence` ist an eine Diff-Basis gebunden, nennt die Diff-Optionen, trägt je geänderter Datei den Git-Modus, meldet Case-Kollisionen und nicht darstellbare Pfade, und der Kern verlangt `diffBase == startedFromCommit`. Renames gibt es nicht mehr. |
| **Warum notwendig** | `changedFiles` hat keine Diff-Basis: leere Liste oder Diff nur des letzten Commits besteht (E-09/NRT-01, KRITISCH 3, V-02/V-03). Rename-Erkennung ändert das Urteil (DRT-21/F8, X09, G1). Symlinks und Submodule sind „added“ (DRT-22/F6, V-26, A-15). Case-Kollisionen `src/A.ts` neben `src/a.ts` sind legitime Adds (DRT-24). Eine Datei mit Leerzeichen im Namen macht die Evidence undarstellbar und den Run unbeendbar (E-10/NRT-09, SM-11, TD-15). P-06 muss genau diese Form liefern; wird sie erst später eingeführt, ist der Verifier an der falschen Evidence-Form gebaut. |
| **Dependencies** | K-01 (Form von `scopeViolations`). |
| **Erlaubter Scope** | modify: `src/forge/runs.ts` (`ChangedFileSchema`, `VerificationEvidenceSchema`), `src/forge/verification.ts` (`scopeViolations`, `evaluateVerification`, `VerificationFailureCode`), `src/forge/state.ts` (`verification_recorded`: Diff-Basis-Prüfung; `EventRejectCode` + `DIFF_BASE_MISMATCH`), `tests/forge/runs.test.ts`, `tests/forge/verification.test.ts`, `tests/forge/state.test.ts`, `tests/forge/review-acceptance.test.ts`, `tests/forge/scenarios.test.ts`, `tests/forge/dogfood.test.ts`, `tests/forge/repair-v2.test.ts`, `tests/forge/run-fixtures.ts`, `tests/forge-red-team/model.ts`, `tests/forge-red-team/findings.test.ts`, `tests/forge-red-team/differential.test.ts`. |
| **Erwartete Produktionszeilen** | 90–130. |
| **Erwartete Testzeilen** | 200–280. |
| **Acceptance-Idee** | (1) Evidence-Felder neu: `diffBase: CommitSha`, `diffOptions: { renames: false }` (Literal), `changedFiles[]: { path, change: "added" \| "modified" \| "deleted" \| "mode_changed", mode: "100644" \| "100755" \| "120000" \| "160000" }` (kein `renamed` mehr; ein Eintrag mit `change: "renamed"` → `EVENT_SCHEMA`), `pathCollisions: [RepoPath, RepoPath][]`, `unrepresentablePaths: int ≥ 0`. (2) `state.ts`: `evidence.diffBase !== run.startedFromCommit` → `DIFF_BASE_MISMATCH`. (3) `scopeViolations`: Modus ≠ `100644` → Verstoß (Symlink, Submodul, ausführbar); `mode_changed` → Verstoß; jede Kollision → Verstoß (beide Pfade); geschützte Pfade und `deleted` wie K-01. (4) `unrepresentablePaths > 0` → Failure-Code `EVIDENCE_NOT_REPRESENTABLE`, Run wird regulär `failed` (terminal), Task wieder startbar (SM-11 geschlossen). (5) Der leere Diff bleibt zulässig (R11), weil der Verifier ihn berechnet. (6) Referenzmodell und Differentialtest aktualisiert, 0 Abweichungen. |
| **Adversarial Tests** | `diffBase` = Parent des Ergebnisses statt Start-Commit → abgelehnt; `diffBase` = Start, aber `changedFiles: []` bei realem Diff → im Kern nicht erkennbar, dokumentierter Trust-Boundary-Test mit Kommentar „nur P-06 garantiert Vollständigkeit“; `renamed` → `EVENT_SCHEMA`; `120000` unter einem Scope-Pfad → Verstoß; `160000` → Verstoß; `100755` auf Scope-Datei → Verstoß; `mode_changed` auf Scope-Datei → Verstoß; Kollision `src/A.ts`/`src/a.ts` → beide Pfade Verstoß, auch wenn nur `src/A.ts` geändert wurde; `unrepresentablePaths: 1` → `failed` mit `EVIDENCE_NOT_REPRESENTABLE`, danach `run_started` für neuen Run erlaubt; Golden-Fixtures (`run-fixtures.ts`) auf v3 migriert, alte v2-Evidence → `EVENT_SCHEMA` (kein Legacy-Pfad). |
| **Nicht dazugehörig** | Observer-/Ancestry-Änderungen (S-02), Rename-Unterstützung (entfällt bewusst), Binärerkennung (S-14), Größenlimits (S-13), Testinventar-Felder (kommen in P-06 als eigener Evidence-Block `inventory`, Schema dort ergänzt, um K-03 klein zu halten). |

### K-04 Mutationsliste im Contract, Developer-Mutationen zählen nicht

| Feld | Inhalt |
|---|---|
| **Ziel** | Der Contract listet die Pflicht-Mutanten als exaktes Suchen/Ersetzen; die Evidence meldet je gelistetem Mutanten genau ein Ergebnis; Developer-Mutationen und der Wert `optional` verschwinden; `equivalent` wird zur Contract-Frage statt zur Quittung. |
| **Warum notwendig** | Ein trivialer Mutant erfüllt `required` (E-05/NRT-15, C-33); alle Überlebenden als `equivalent` mit Rationale „.“ führen bis `accepted` (E-06/NRT-16); `optional` ≡ `none` (C-32); Namenszwillinge `m1`/`m1 ` (DRT-32). Im Pilot bestand der Mutant `return stance;` 154/154 Tests trotz Acceptance-Kriterium (P-04), Mutationsdefinitionen waren nicht versioniert (P-11), jede Kampagne wurde von Hand gebaut (M11). Für den ersten Mystery-Task (reine Domänenlogik mit Tests) ist die Mutationsliste der billigste harte Qualitätsanker. |
| **Dependencies** | K-03 (dieselben Dateien `runs.ts`, `verification.ts`, `state.ts`; nach K-03 mergen). |
| **Erlaubter Scope** | modify: `src/forge/contract-document.ts` (`mutationSmoke`-Schema), `src/forge/runs.ts` (`MutationResultSchema`, `DeveloperReportSchema`, `VerificationEvidenceSchema.mutations`, `AcknowledgedMutationsSchema` entfällt), `src/forge/verification.ts` (`effectiveMutations` entfällt, `mutationFailures` neu, `equivalentMutationNames` entfällt, `evaluateVerification` ohne `report`), `src/forge/state.ts` (`code_review_recorded` ohne Äquivalenz-Quittung, `verificationOf`), `src/forge/events.ts` (`CodeReviewRecordedSchema` ohne `acknowledgedEquivalentMutations`), alle betroffenen Tests unter `tests/forge/` und `tests/forge-red-team/`. |
| **Erwartete Produktionszeilen** | 80–120 netto (ca. +90 / −70). |
| **Erwartete Testzeilen** | 150–220. |
| **Acceptance-Idee** | (1) Contract: `mutationSmoke: "none" \| { "mutants": [ { "name": "^[a-z][a-z0-9-]{0,31}$", "file": RepoPath, "find": string (1–400 Zeichen, druckbar, nicht nur Whitespace), "replace": string (0–400), "note": TextSchema } ] }`, `mutants` nicht leer, Namen eindeutig, `find !== replace`, `file` ∈ `scope.create ∪ scope.modify` (sonst `METADATA_SCHEMA`). (2) Evidence: `mutations: { name, outcome: "detected" \| "survived" \| "not_applied" }[]`; Namensmenge muss exakt der Contract-Liste entsprechen (fehlend/zusätzlich → `MUTATION_EVIDENCE_INVALID`); `not_applied` → `MUTATION_EVIDENCE_INVALID`; `survived` → `MUTATION_SURVIVED`; bei `"none"` muss `mutations` leer sein. (3) `DeveloperReport` reduziert auf `{ claimedResultCommit, claimedRemoteRef, contractCommit, contentHash, deviations }` (S4 des Handoff-Audits: Report nennt den Contract; Kern vergleicht gegen `run.contract`, sonst `REPORT_CONTRACT_MISMATCH`). (4) `code_review_recorded` hat kein Quittungsfeld mehr; `EQUIVALENT_MUTATIONS_NOT_ACKNOWLEDGED` entfällt. (5) `evaluateVerification(metadata, evidence)`; Referenzmodell nachgezogen. |
| **Adversarial Tests** | Mutant auf Datei außerhalb des Scopes → `METADATA_SCHEMA`; `m1` und `m1 ` → `METADATA_SCHEMA` (Slug) ; Evidence mit zusätzlichem Mutanten `delete-entire-file` → invalid (E-05 umgekehrt); Evidence ohne einen gelisteten Mutanten → invalid; `survived` → rot, kein Weg zu `accepted` (E-06 umgekehrt: es gibt keine Äquivalenz-Quittung mehr); Report mit `contentHash` einer anderen Revision → `REPORT_CONTRACT_MISMATCH`; alte Evidence mit `classification`/`equivalenceRationale` → `EVENT_SCHEMA`; `find` mit Steuerzeichen → Schema. |
| **Nicht dazugehörig** | Ausführung der Mutanten (P-06), Regex-/AST-Mutanten, Äquivalenz-Workflow (= Contract-Revision), Kampagnen, `mutations.json`-Runner aus `forge/reviews/` (bleibt Historie, TD-25). |

### K-05 Owner-, Rollen- und Linearitätsregeln im Kern

| Feld | Inhalt |
|---|---|
| **Ziel** | Jede Owner-Aktion verlangt `actorType: human`; Verifier und Observer sind nie der Developer; der Developer kann einen Run nach dem Report nicht mehr selbst beenden; Contract-Revisionen sind während eines Runs und nach Review-Freigabe gesperrt; der Contract-Commit ist linear und isoliert; Contract-Commits und Run-IDs sind eindeutig bzw. abgeleitet. |
| **Warum notwendig** | Nur `task_accepted` prüft `human`; eine KI mit Rolle `owner` bricht fremde Runs ab (DRT-34/F9, X03a-c). Developer darf Observer und Verifier sein (E-02, V-01, TD-18). Developer kann einem drohenden roten Verifier mit `run_failed(DEVELOPER_ABORTED)` zuvorkommen (E-25/NRT-19/DRT-40). Neue Contract-Version während eines Runs entwertet ihn still (RT-07, F-17, K-3), kurz vor der Abnahme setzt sie `review_approved` zurück (E-17/NRT-24, SM-10). Ein Merge-Commit als Contract-Commit schmuggelt einen ungeprüften Zweig in den Startpunkt (DRT-05/F4, X23); die Regel muss „genau ein Parent“ und „nur die Contract-Datei“ lauten. Zwei Revisionen am selben Commit (DRT-03/X33), RunId-Squatting (DRT-42). Alles kleine Regeln, aber P-05 baut sein Gate auf `canStartDeveloperRun` und muss sich auf sie verlassen. |
| **Dependencies** | keine; berührt `state.ts` wie K-03 (nacheinander mergen). |
| **Erlaubter Scope** | modify: `src/forge/state.ts`, `src/forge/events.ts` (`RepoObservationSchema` + `contractCommitPaths: RepoPath[]`; `run_failed`-Rollen), `src/forge/start-gate.ts` (neue `BlockReasonCode`s), `src/forge/identity.ts` (ggf. `sameIdentity`-Helfer), `tests/forge/state.test.ts`, `tests/forge/start-gate.test.ts`, `tests/forge/kernel.test.ts`, `tests/forge/review-acceptance.test.ts`, `tests/forge/runs.test.ts`, `tests/forge/scenarios.test.ts`, `tests/forge/fixtures.ts`, `tests/forge/run-fixtures.ts`, `tests/forge-red-team/*.ts`. |
| **Erwartete Produktionszeilen** | 60–90. |
| **Erwartete Testzeilen** | 180–250. |
| **Acceptance-Idee** | (1) `OWNER_NOT_HUMAN` für jedes Event mit `role: owner` (`task_registered`, `run_failed` als Owner, `run_abandoned`, `task_accepted`). (2) `remote_observed`: `sameIdentity(run.developer, actor)` → `OBSERVER_NOT_INDEPENDENT`; `verification_recorded`: → `VERIFIER_NOT_INDEPENDENT`. (3) `run_failed` mit Rolle `developer` nur im Zustand `running`; danach nur Owner (`RUN_STATE_INVALID`). (4) `contract_registered` nur in Task-Zuständen `planned`, `specifying`, `ready`, `rework_required`, `contract_revision_required`; in `implementing` → `RUN_ACTIVE`, in `awaiting_review`/`review_approved` → `TASK_STATE_INVALID`. (5) Start-Gate: `parents[contractCommit]` fehlt oder Länge ≠ 1 → `CONTRACT_COMMIT_NOT_LINEAR`; `observation.contractCommitPaths` ≠ `[contractPath]` → `CONTRACT_COMMIT_NOT_ISOLATED`; `baseCommit` muss der eine Parent sein **oder** Vorfahr davon (bleibt `BASE_NOT_IN_CONTRACT_HISTORY`). (6) `contract_registered` mit `contractCommit`, der schon einer anderen Revision desselben Tasks gehört → `CONTRACT_COMMIT_REUSED`. (7) `run_started.runId` muss `run:<taskId in Kleinbuchstaben>-<n>` sein mit `n` = Zahl bisheriger Runs des Tasks + 1 → sonst `RUN_ID_NOT_DERIVED`. (8) Regressionstests RTN-05, RTN-12, RTN-18 aus dem Red Team. |
| **Adversarial Tests** | X03a-c nachgestellt → jetzt `OWNER_NOT_HUMAN`; Developer als Observer/Verifier → abgelehnt; Developer `run_failed` in `reported`/`remote_verified` → abgelehnt, Owner weiterhin erlaubt; v2 während `implementing` → `RUN_ACTIVE`; v2 in `review_approved` → `TASK_STATE_INVALID`; v2 in `rework_required` → ok; Contract-Commit mit Parents `[base, EVIL]` → `CONTRACT_COMMIT_NOT_LINEAR`; Contract-Commit mit Paths `[contract, src/x.ts]` → `CONTRACT_COMMIT_NOT_ISOLATED`; v1 und v2 mit identischem `contractCommit` → `CONTRACT_COMMIT_REUSED`; `run:task-0002-1` für TASK-0001 → `RUN_ID_NOT_DERIVED`; `run:task-0001-3` als zweiter Run → abgelehnt; Fuzzer/Differentialtest erreicht weiterhin alle 9 Task- und 6 Run-Zustände. |
| **Nicht dazugehörig** | Authentifizierung (P-02 an der Grenze), Findings-Ledger (S-03), Base-auf-`main` (ist eine `main`-Eigenschaft, prüft P-03/P-05 außerhalb des Kerns), Leases, `task_withdrawn`, neue Zustände. |

### P-01 Git-Snapshot: die einzige Stelle, die Git liest (Observation-Grenzen)

| Feld | Inhalt |
|---|---|
| **Ziel** | Ein Modul `src/forge-github/git-snapshot.ts`, durch das jeder Git-Fakt von Gate, Verifier und Handoff geht. Es ruft `git` nur mit einer festen, sauberen Umgebung und festen Optionen auf und liefert typisierte Beobachtungen (Refs, Parent-Kanten, Blob mit Blob-SHA und fatal dekodiertem Text, Pfade eines Commits, geänderte Dateien mit Modi, Case-Kollisionen, nicht darstellbare Pfade). |
| **Warum notwendig** | Ehrliches Tooling lässt sich täuschen: `refs/replace/*` fälscht Ancestry für einen Mirror-Klon (DRT-18/F3, G4), ein Shallow-Klon kennt keine Parents und hängt den Run still (DRT-19, G5), Rename-Schwellen ändern das Urteil (DRT-21), `Buffer.toString("utf8")` kollabiert drei verschiedene Blobs auf einen Hash (DRT-27/F7, X12), Beobachtung und Evidence nennen kein Repository (DRT-20), optionsartige Ref-Namen (DRT-17), Start-Beobachtung kommt vom Developer (NRT-30/DRT-06), Scratch-Refs gelten als persistiert (C-24/E-20), lokale Git-Konfiguration (Filter, Hooks) beeinflusst den Verifier (A-06). Wenn diese Regeln nicht an einer Stelle gebündelt sind, hat jeder Check seine eigene Lücke. |
| **Dependencies** | K-03 (Form der `changedFiles`), K-02 (`RepoPath`/`RefName`-Form). |
| **Erlaubter Scope** | create: `src/forge-github/git-snapshot.ts`, `tests/forge-github/git-snapshot.test.ts` (baut Wegwerf-Repos mit dem `git`-Binary im Temp-Verzeichnis). Keine neue Dependency (`node:child_process`, `node:fs`). |
| **Erwartete Produktionszeilen** | 180–240. |
| **Erwartete Testzeilen** | 200–300. |
| **Acceptance-Idee** | (1) Jeder Aufruf: `execFile("git", [...])` ohne Shell, Umgebung nur `GIT_NO_REPLACE_OBJECTS=1`, `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null` (bzw. leere Datei), `GIT_TERMINAL_PROMPT=0`, `LC_ALL=C`; Pfade und Refs stets hinter `--`. (2) `assertSound(repoDir, policy)`: nicht shallow (`rev-parse --is-shallow-repository`), kein Mirror (`config remote.origin.mirror`), `remote.origin.url` entspricht `policy.repo`, `ls-remote origin` enthält kein `refs/replace/` (sonst Fehler `REPLACE_REFS_PRESENT`, der den Check rot macht). (3) `refHeads(refs[])` aus `ls-remote`, nur voll qualifizierte Namen. (4) `parentsBetween(from, to)` aus `rev-list --parents`, als `CommitGraph`. (5) `isAncestor(a, b)`, `isOnFirstParentChain(commit, tip)` aus `rev-list --first-parent`. (6) `blobAt(commit, path)` → `{ blobSha, bytes, text }`, Text per `TextDecoder("utf-8", { fatal: true })`; ungültige Bytes → Fehler `BLOB_NOT_UTF8`, nie U+FFFD. (7) `commitPaths(commit)` aus `diff-tree --no-commit-id --name-only -r --no-renames -z`. (8) `changedFiles(base, head)` aus `diff --raw --no-renames --no-color -z base head`: Status A/M/D/T → `added/modified/deleted/mode_changed`, Modus aus der Raw-Zeile (`120000`, `160000` erkannt); Pfade, die `RepoPathSchema` nicht passieren, werden gezählt (`unrepresentablePaths`) und nicht gelistet. (9) `pathCollisions(commit)` aus `ls-tree -r --name-only -z`, case-gefaltet. (10) Alle Funktionen werfen bei Nicht-Null-Exit; nie ein „leeres“ Ergebnis bei Fehler (fail-closed). |
| **Adversarial Tests** | Wegwerf-Remote mit `git replace --graft EVIL CONTRACT` + Push `refs/replace/*`: `parentsBetween` liefert die echten Kanten **und** `assertSound` schlägt an (RTN-14); Shallow-Klon → `OBSERVATION_INCOMPLETE` (RTN-15); Mirror-Klon → Fehler; Blob mit `0xFF` → `BLOB_NOT_UTF8`, drei verschiedene Blobs ergeben nie denselben Text; `git mv a b` → `deleted a` + `added b`; Symlink → `120000`; Submodul → `160000`; `chmod +x` → `mode_changed`; `src/a.ts` + `src/A.ts` → Kollisionspaar; Datei `src/my file.ts` → `unrepresentablePaths: 1`; Ref `--upload-pack` als Argument → sicher hinter `--`; lokale `.git/config` mit `filter.*` und `core.hooksPath` → ohne Wirkung; `remote.origin.url` auf Fork → Fehler. |
| **Nicht dazugehörig** | GitHub-API (P-02), Kernel-Events bauen (P-05), Schreibzugriffe, Observer-Workflow mit Zeit/Sequenz (S-02), Egress-Sperre (D-11). |

### P-02 Policy und authentifizierte Identitäten

| Feld | Inhalt |
|---|---|
| **Ziel** | `forge/policy.json` ordnet GitHub-Logins Rollen zu und hält die wenigen Betriebsregeln; ein Modul löst Logins in Kern-Identitäten auf; ein dünner, nur lesender GitHub-API-Client liefert PRs, Reviews, Dateien, Kommentare und die PRs eines Commits. Jede Prüfung in P-03/P-05/P-06 bezieht Identität und Rolle ausschließlich hieraus. |
| **Warum notwendig** | Identitäten und Rollen sind selbst erklärt; ein Akteur bringt einen Task bis `accepted` (KRITISCH 1, RT-05, E-02, E-14, DRT-33). Im Pilot hat eine Session alle Rollen gespielt und Owner-Approvals geschrieben (KRITISCH 2, NRT-26, C-21), Codex committet unter Sebs Konto, auch in `0dfd903` (TD-01, A-26). Ohne echte Logins ist jede Unabhängigkeitsregel ein Feldvergleich. |
| **Dependencies** | O-01 (Logins existieren), O-02 (Claude-Login ermittelt). Code selbst ist unabhängig. |
| **Erlaubter Scope** | create: `forge/policy.json`, `src/forge-github/policy.ts`, `src/forge-github/github-api.ts`, `tests/forge-github/policy.test.ts`, `tests/forge-github/github-api.test.ts` (Fetch-Stub). |
| **Erwartete Produktionszeilen** | 130–180 (Policy-Schema+Loader ~60, Identitätsauflösung ~30, API-Client ~70). |
| **Erwartete Testzeilen** | 120–180. |
| **Acceptance-Idee** | (1) Schema (zod, strict): `forgePolicyFormat: 1`, `repo: "Wuerfelduell/Forge"`, `integrationRef: "refs/heads/main"`, `ownerLogin`, `identities: { [loginLowercase]: { actorType: "human" \| "ai_agent", provider: slug, roles: Role[] } }` (nur `ownerLogin` darf `human` sein), `aiReviewIndependence`, `allowedChecks: [{name, command}]` (eindeutig; V0.1: `typecheck` = `npm run typecheck`, `test` = `npm test`), `runBranchPattern: "forge/run/<TASK>-<n>"`, `maxActiveRuns: 1`, `bootstrap: boolean`. (2) `resolveIdentity(login) → AgentIdentity` (`label` = Login kleingeschrieben, `model: null`); unbekannter Login → `IDENTITY_UNKNOWN`. (3) `hasRole(login, role)`. (4) `halted()` liest `FORGE_HALT` aus der Umgebung (Workflow übergibt `vars.FORGE_HALT`). (5) API-Client: `getPullRequest`, `listPullRequestFiles`, `listReviews`, `listIssueComments`, `listPullRequestsForCommit`, `listPullRequests({head, state})`, nur `GET`, Token aus `GITHUB_TOKEN`, jeder Fehler → Exception (fail-closed, niemals „unbekannt = ok“). (6) Policy-Datei liegt unter `forge/` und ist damit durch K-01 und CODEOWNERS geschützt. |
| **Adversarial Tests** | Login in anderer Schreibweise (`wuerfelduell` vs `Wuerfelduell`) → gleich (GitHub-Logins sind case-insensitiv); zwei Logins mit gleichem `provider` unter `different_provider` → nicht unabhängig; `actorType: human` für Nicht-Owner → Schema-Fehler; doppelte Check-Namen → Schema-Fehler; fehlende Policy-Datei → Fehler, kein Default; `FORGE_HALT=1`/`true`/`yes` → halted; API 403/500 → Exception; Token fehlt → Exception; Policy-Datei im Run-PR-Diff → `SCOPE_VIOLATION` (K-01-Test, hier referenziert). |
| **Nicht dazugehörig** | Budgets, Lease-Werte, Pfadklassen (`shared`/`generated`), GitHub-App, Schreibzugriffe (nur P-04 schreibt genau einen Kommentar), Reviewer-Zuweisung (P-03). |

### P-03 Contract-Check und Approval-Check auf Contract-PRs

| Feld | Inhalt |
|---|---|
| **Ziel** | Der Required Check `forge` prüft einen Contract-PR mechanisch; der Required Check `forge-approval` ist genau dann grün, wenn der **zugewiesene** Reviewer (Identität ≠ Autor, Rolle `architecture_reviewer`) den aktuellen Head-SHA approved hat. Die Check-Summary ist der Contract-Kopf für das Handy. |
| **Warum notwendig** | Contracts kamen per Chat (N1, P-01), Status stand im Contract (N2, C-22, P-02), SHAs wurden von Hand abgeglichen (N4, P-08), Approvals wurden vom Developer-Agenten geschrieben (C-21, NRT-26), Base enthielt ungeprüften Code (C-08/C-10, P-13), Check-Commands sind frei wählbar (C-29/C-31), Reviewer-Shopping über eine Versionsnummer (DRT-02/F2), Contract-Revision während eines Runs (RT-07/P-B), Sidecar-Versionen (C-14/B5). Das ist K2 und K3 des Minimum Product und Exit-Kriterium 1/2. |
| **Dependencies** | K-01, K-02, K-04 (Schema), P-01, P-02, O-02 (Ausführungsmuster), O-01 (Rulesets, damit `forge-approval` als Required Check wirkt). |
| **Erlaubter Scope** | create: `src/forge-github/revisions.ts` (Contract-Historie eines Tasks auf `main`), `src/forge-github/approval.ts` (zugewiesener Reviewer, Approval auf Head), `src/forge-github/contract-check.ts`, `src/forge-github/summary.ts` (Markdown-Summary, „blockierend zuerst“), `scripts/forge-contract-check.ts`, `scripts/forge-approval-check.ts`, `.github/workflows/forge.yml` (Dispatcher: PR-Art bestimmen; Contract-Pipeline), `tests/forge-github/{revisions,approval,contract-check,summary}.test.ts`. |
| **Erwartete Produktionszeilen** | 250–330 (+ ~40 YAML). |
| **Erwartete Testzeilen** | 200–300 (API-Stubs, Wegwerf-Repos). |
| **Acceptance-Idee** | `forge` (Contract-Pipeline) ist grün genau dann, wenn: (1) PR-Base = `main`, Head im selben Repo (kein Fork). (2) Autor-Login hat Rolle `spec_author`. (3) Der PR ändert **genau eine** Datei `forge/contracts/<TASK>.md` (added oder modified), sonst nichts (`CONTRACT_PR_NOT_ISOLATED`). (4) Blob am Head dekodiert fatal, `parseContractDocument` ok, `metadata.taskId` = Dateiname, letzte Zeile = `<!-- END OF CONTRACT <TASK> v<N> -->` (`END_MARKER_MISSING`). (5) `contractVersion` = Anzahl bisheriger Revisionen dieses Pfads auf der First-Parent-Kette von `main` + 1; bisherige Revisionen müssen alle kernkonform parsen; sonst `LEGACY_CONTRACT_HISTORY` (Task ist nicht Forge-managed, D-13). (6) `baseCommit` liegt auf der First-Parent-Kette von `main` (`BASE_NOT_ON_MAIN`); Merge-Base(Head, `main`) ⊒ `baseCommit`. (7) Jede Dependency: `acceptedCommit` ist der Merge-Commit eines gemergten Run-PRs dieses Tasks und liegt auf `main` (`DEPENDENCY_NOT_MERGED`). (8) `requiredChecks` ⊆ `policy.allowedChecks` (Name und Command exakt). (9) Für Mutanten auf `scope.modify`-Dateien: `find` kommt am `baseCommit` genau einmal vor (`MUTANT_NOT_APPLICABLE`); für `scope.create` erst in P-06. (10) Kein offener Run-PR dieses Tasks (`RUN_ACTIVE`), kein zweiter offener Contract-PR dieses Tasks (`CONTRACT_PR_DUPLICATE`). (11) `FORGE_HALT` nicht gesetzt. — `forge-approval`: zugewiesener Reviewer = Autor des ersten Reviews mit Rolle `architecture_reviewer` auf irgendeinem PR, der diesen Contract-Pfad änderte (ältester PR zuerst), oder der Login aus dem jüngsten Owner-Kommentar `/forge reviewer architecture <login>` auf diesem PR; grün nur, wenn dessen jüngstes Review `APPROVED` mit `commit_id` = aktuellem Head-SHA ist und Reviewer ≠ Autor (nach Policy-Unabhängigkeit). — Summary: Task, Version, Content-Hash, Blob-SHA, Base, Scope (create/modify), Checks, Mutanten, Dependencies, zugewiesener Reviewer, „wartet auf“. Beide Checks laufen auf `pull_request_target` (opened, synchronize, reopened) und `pull_request_review`. |
| **Adversarial Tests** | Contract + `src/x.ts` im selben PR → rot; Contract umbenannt oder als `TASK-0006.v2.md` → rot; PR aus Fork → rot; Autor ohne Rolle → rot; v2 ohne v1 / v1 bei vorhandener v1 → rot; `baseCommit` auf Seitenzweig → rot; `baseCommit` = Root-Commit `f5dbc73` → **grün** (C-09 bleibt erlaubt; dokumentiert; Dependencies sichern die Semantik); Checks `[{"name":"test","command":"true"}]` → rot; Mutant-`find` nicht vorhanden → rot; offener Run-PR → rot; zweiter Contract-PR → rot; Reviewer = Autor → `forge-approval` rot; Approval auf altem SHA nach Push → rot (Ruleset verwirft zusätzlich); Approval durch Login ohne Rolle → rot; zweiter Reviewer approved nach `changes_requested` des ersten → rot (D-5), nach Owner-Kommentar `/forge reviewer architecture <login>` → grün; Kommentar von Nicht-Owner → ignoriert; `FORGE_HALT=1` → rot; CRLF im Blob → rot (`CARRIAGE_RETURN`); PR auf `forge/contracts/TASK-0004.md` → `LEGACY_CONTRACT_HISTORY`; Bootstrap-PR (weder Contract noch Run) mit `bootstrap: true` → `forge` grün mit Hinweis, mit `bootstrap: false` → rot. |
| **Nicht dazugehörig** | Handoff (P-04), Status-Issue (S-01), Legacy-Migration (S-09), Kernel-Replay (hier nur Parser), Schreiben von Reviews oder Kommentaren. |

### P-04 Handoff und Rollenvorlagen

| Feld | Inhalt |
|---|---|
| **Ziel** | Nach dem Merge eines Contract-PR erzeugt ein Workflow aus `main` den Handoff aus Identifikatoren und postet ihn als Kommentar auf den gemergten PR; feste Rollenvorlagen im Repo nehmen den Handoff als einzige Variable. Kein Mensch tippt einen SHA, kein Contract-Text wandert durch einen Chat. |
| **Warum notwendig** | N1, N4, M01/M02/M04 (Rollen-Prompts von 50–150 Zeilen, Copy-Paste, 45 SHA-Nennungen), Handoff-Audit B3/B4 (Start vom Contract-Commit, Read-Quittung), Exit-Kriterien 2/3 (null Contract-Text, null getippte SHAs, höchstens fünf Owner-Handgriffe). |
| **Dependencies** | P-02, P-03 (`revisions.ts`), O-01. |
| **Erlaubter Scope** | create: `src/forge-github/handoff.ts`, `src/forge-github/receipt.ts` (Format der Read-Quittung, geteilt mit P-05), `scripts/forge-handoff.ts`, `.github/workflows/forge-handoff.yml` (`push` auf `main`, Pfadfilter `forge/contracts/**`, `permissions: pull-requests: write`, führt nur Code aus `main` aus), `forge/roles/spec-author.md`, `forge/roles/architecture-reviewer.md`, `forge/roles/developer.md`, `forge/roles/code-reviewer.md`, `tests/forge-github/{handoff,receipt}.test.ts`. |
| **Erwartete Produktionszeilen** | 70–110 (+ ~30 YAML; Rollenvorlagen ~150 Zeilen Markdown, nicht gezählt). |
| **Erwartete Testzeilen** | 60–100. |
| **Acceptance-Idee** | (1) Handoff-Block (genau diese Felder, Werte aus P-01/P-03 berechnet): `FORGE DEVELOPER HANDOFF v1`, `repository`, `task`, `contract_version`, `contract_commit`, `contract_blob`, `content_hash`, `result_ref: refs/heads/forge/run/<TASK>-<n>` (n = Anzahl bisheriger Run-PRs des Tasks + 1), `role_template: forge/roles/developer.md@<main-sha>`. Kein Contract-Text, keine Zusammenfassung, kein `base_commit` als Startanweisung. (2) Der Workflow verweigert den Handoff, wenn der Contract-Commit zwei Parents hat oder der Task Legacy-Historie hat. (3) Rollenvorlage Developer enthält exakt: `git fetch`, `git checkout --detach <contract_commit>`, `git switch -c forge/run/<TASK>-<n>`, Contract per `git cat-file -p <contract_commit>:forge/contracts/<TASK>.md` lesen, Quittung erzeugen (`git rev-parse <commit>:<path>`, SHA-256 über `forge-contract-v1\n` + Text, `wc -c`, letzte Zeile wörtlich), bei Abweichung stoppen, nur `scope`-Dateien ändern, mindestens stündlich pushen, nie `--force`, PR-Body = Quittung + Abweichungen, Prompt widerspricht Contract → Contract gilt und Abweichung melden. (4) Read-Quittung-Format `FORGE READ RECEIPT v1` mit `contract_commit`, `contract_blob`, `content_hash`, `byte_count`, `end_marker`; `parseReceipt(prBody)` in `receipt.ts`. (5) Vorlagen Reviewer: nur Handoff (Commit + Blob) und Verdict als GitHub-Review unter eigener Identität; Developer-Report nur als „behauptet“. |
| **Adversarial Tests** | Handoff-Werte werden nie aus dem PR-Body übernommen (Test: PR-Body mit falschem Hash, Handoff zeigt den berechneten); Contract-Commit mit zwei Parents → kein Handoff, Workflow rot; Lint-Test: Rollenvorlagen enthalten keinen Task-Text, keine SHAs, nur Platzhalter `<…>`; Quittungs-Roundtrip (erzeugen → parsen → gleich); Quittung mit zusätzlichen Feldern → `RECEIPT_INVALID`; Kommentar-Post schlägt fehl → Workflow rot, kein stiller Erfolg. |
| **Nicht dazugehörig** | Agentenstart (A3), Dispatch, Status-Issue, Benachrichtigungen außer dem Kommentar, Lease-Regeln über das Agenten-Protokoll in der Vorlage hinaus. |

### P-05 Run-Gate und Approval-Check auf Run-PRs

| Feld | Inhalt |
|---|---|
| **Ziel** | Der Check `forge` fährt auf einem Run-PR das Start-Gate des Kerns gegen echte Git-Fakten und prüft Quittung, Aktualität, Identitäten und Grenzen; `forge-approval` verlangt das Approval des zugewiesenen Code-Reviewers auf dem Head-SHA. |
| **Warum notwendig** | Die Start-Beobachtung kommt heute vom Developer selbst (NRT-30, DRT-06), jeder Ref gilt als persistiert (C-24/E-20), nichts bindet den Text, den der Developer gelesen hat, an den Hash (SD-04, P-C, B4), der Developer kann den eigenen Contract freigeben (E-14/NRT-20), ein Run auf überholter Revision ist still wertlos (RT-07), ein zweiter aktiver Run ist nur im seriellen Log ausgeschlossen (DRT-38), ein Run vom falschen Stand wird erst spät erkannt (F-23 `WRONG_BASE`). Das ist K5 und Exit-Kriterium 2/5. |
| **Dependencies** | K-05, P-01, P-02, P-03 (`revisions.ts`, `approval.ts`, `summary.ts`), P-04 (`receipt.ts`), O-02, O-01. |
| **Erlaubter Scope** | create: `src/forge-github/projection.ts` (GitHub-Fakten → kurze Kernel-Eventliste), `src/forge-github/run-gate.ts`, `scripts/forge-gate.ts`, `tests/forge-github/{projection,run-gate}.test.ts`. modify: `.github/workflows/forge.yml` (Run-Pipeline: Gate-Job), `scripts/forge-approval-check.ts` (Gate-Parameter `code`). |
| **Erwartete Produktionszeilen** | 280–360 (+ ~40 YAML). |
| **Erwartete Testzeilen** | 250–350 (Projektion wird gegen den echten Kern getestet: jede synthetisierte Eventliste muss `replay` bestehen). |
| **Acceptance-Idee** | Gate grün genau dann, wenn: (1) Head-Ref = `refs/heads/forge/run/<TASK>-<n>` (Regex aus Policy), PR-Base `main`, Head im selben Repo. (2) Autor-Login hat Rolle `developer`; Autor ≠ Login des Architektur-Approvals dieses Contracts (`DEVELOPER_APPROVED_OWN_CONTRACT`). (3) Aktuelle Revision des Tasks aus `main` (P-03), Contract-Commit `C`, Hash `H`. (4) Projektion: `task_registered` (Owner, human), `contract_registered` v1..k (Actor = Autor-Login des jeweiligen Contract-PR), `approval_recorded` (zugewiesener Reviewer, `approved`, `findings: []`) → `kernel.replay` muss `ok` sein; dann `canStartDeveloperRun(state, { taskId, contentHash: H, repoObservation })` mit `repoObservation` = `{ refs: { "refs/heads/main": …, "refs/pull/<N>/head": head }, parents: parentsBetween(baseCommit..head) ∪ parent(C), contractAtCommit: { C, path, H }, contractCommitPaths: commitPaths(C) }` → `allowed` und `startFromCommit === C` (sonst der erste `BlockReason` als Fehler). (5) `C` ⊑ Head und `merge-base(head, main)` liegt auf der First-Parent-Kette von `main` und ⊒ `C` (`WRONG_BASE`). (6) Quittung im PR-Body vorhanden und gleich den berechneten Werten (`RECEIPT_MISSING`/`RECEIPT_MISMATCH`). (7) Keine neuere Revision auf `main` als `C`; kein offener Contract-PR dieses Tasks (`CONTRACT_PR_OPEN`). (8) Alle `acceptedCommit`s der Dependencies weiterhin auf `main` (`DEPENDENCY_REVERTED`). (9) Kein anderer offener Run-PR (Policy `maxActiveRuns: 1`, `RUN_LIMIT`) und kein zweiter offener Run-PR dieses Tasks. (10) Vorherige Run-PRs dieses Tasks sind geschlossen oder gemergt; `n` = Anzahl bisheriger Run-PRs + 1 (`RUN_NUMBER_NOT_NEXT`). (11) `FORGE_HALT` nicht gesetzt. (12) Diff `C..head` berührt `forge/contracts/` nicht (Frühprüfung; Vollprüfung in P-06). — `forge-approval` (Run): zugewiesener Code-Reviewer (erstes Review mit Rolle `code_reviewer` auf einem Run-PR dieses Tasks, oder Owner-Kommentar `/forge reviewer code <login>`), ≠ Developer, jüngstes Review `APPROVED` auf Head-SHA. — Summary: Task, Run n, `C`/`H`, Start-Commit, Head-SHA, Quittung ok, Reviewer, „wartet auf“. |
| **Adversarial Tests** | Branch von `main` statt von `C` (C kein Vorfahr) → `WRONG_BASE`; Branch von einem älteren `main`-Commit vor `C` → rot; Branch von einem neueren `main`-Commit nach `C` → **grün** (Reconcile-Fall, erlaubt, weil `C` ⊑ Head); Branch `forge/run/TASK-0006-1` für Contract von TASK-0007 → rot; Quittung aus anderem Contract → `RECEIPT_MISMATCH`; Quittung ohne End-Marker → rot; Quittung mit einem Zeichen Abweichung im Hash → rot; Developer = Architektur-Approver → rot; Developer = Spec-Autor → **grün** (erlaubt, der Contract wurde unabhängig reviewt; dokumentiert); zweiter Run-PR bei offenem ersten → rot; `forge/run/TASK-0006-3` als zweiter Run → rot; Contract-PR v2 offen → rot; v2 gemergt nach Branch-Erstellung → `CONTRACT_NOT_CURRENT`; Dependency revertiert auf `main` → rot; PR aus Fork → rot; API 5xx → rot (nie grün bei Unsicherheit); `FORGE_HALT=1` → rot; Approval auf früherem SHA → `forge-approval` rot; Reviewer = Developer → rot; zweiter Reviewer nach `changes_requested` → rot ohne Owner-Kommentar; Projektion: jede erzeugte Eventliste besteht `kernel.replay` (sonst Testfehler, nicht stilles „blocked“); Commit zwischen `C` und Head, der `forge/contracts/` ändert → rot. |
| **Nicht dazugehörig** | Verifier (P-06), Leases/Ablauf (S-10), Status-Issue (S-01), Salvage, paralleler Betrieb (S-05), Reconcile-Automatik (S-04), Kernel-Observation-Events (S-02). |

### P-06 Verifier: Preflight, Check-Jobs, Testinventar, Mutanten, Aggregator

| Feld | Inhalt |
|---|---|
| **Ziel** | Ein Verifier, den der Developer nicht steuern kann: Workflow aus `main`, frischer Checkout des exakten Head-SHA, kein Prüflingscode vor der Pfadprüfung, je Pflicht-Check ein Job ohne Secrets, Testinventar gegen die Baseline, Mutanten aus dem Contract, Aggregator ohne Prüflingscode, Evidence v3 → `evaluateVerification`. |
| **Warum notwendig** | Jede Verifikation lief auf dem Rechner des Developers (N5, TD-07, M08/M09), Testkonfiguration und Skips höhlen Checks aus (KRITISCH 4, VX-03/04, V-11..V-13), Mutanten wählte der Developer (KRITISCH, E-05/E-06, N6, M11), Testcode kann Runner-Dateien und Umgebung lesen oder schreiben (A-04, A-24, VX-01), `npm ci` führt Lifecycle-Skripte aus (A-23), Workflow-Dateien sind per Scope änderbar (A-05). Das ist K6/K7, Exit-Kriterien 5/6. |
| **Dependencies** | K-01, K-03, K-04, P-01, P-02, P-05 (Revision/Projektion/Summary), O-01 (Rulesets: Required Check nur aus Actions), O-02 (bewiesenes Ausführungsmuster, Output-Härtung). |
| **Erlaubter Scope** | create: `src/forge-github/verify-preflight.ts`, `src/forge-github/inventory.ts`, `src/forge-github/mutate.ts`, `src/forge-github/verify-aggregate.ts`, `scripts/forge-verify-preflight.ts`, `scripts/forge-verify-inventory.ts`, `scripts/forge-verify-mutate.ts`, `scripts/forge-verify-aggregate.ts`, `tests/forge-github/{inventory,mutate,verify-aggregate,verify-preflight}.test.ts`. modify: `.github/workflows/forge.yml` (Run-Pipeline: Jobs `preflight`, `check-<name>`, `mutant-<i>`, `aggregate`), `src/forge/runs.ts` (Evidence-Block `inventory: { total, passed, failed, skipped, todo, baselineTotal }`, ~10 Zeilen, einziger Kern-Eingriff). |
| **Erwartete Produktionszeilen** | 280–360 (+ ~120 YAML). |
| **Erwartete Testzeilen** | 220–320. |
| **Acceptance-Idee** | (1) `preflight` (nur Code aus `main`, kein `npm ci`): P-01-Snapshot, `changedFiles(C..head)` mit Modi, Kollisionen, Darstellbarkeit; vorläufige Evidence durch `scopeViolations` → bei irgendeinem Verstoß endet der Verifier hier rot, **ohne** je Prüflingscode auszuführen. (2) Je Check aus `policy.allowedChecks` ein Job: `actions/checkout` mit `ref: head-sha`, `fetch-depth: 0`, `persist-credentials: false`; Node aus `.nvmrc`; `npm ci --ignore-scripts`; Command als `argv` aus der Policy (kein Shell-String); der Prüfschritt läuft mit `GITHUB_OUTPUT`, `GITHUB_ENV`, `GITHUB_PATH`, `GITHUB_STEP_SUMMARY` auf `/dev/null` umgebogen; ein **nachfolgender** Schritt setzt den Job-Output allein aus dem Exit-Code. (3) Check `test`: `vitest run --reporter=json --outputFile=…` → Inventar; Baseline-Inventar aus einem Checkout von `C` im selben Job; Regeln: `failed = 0`, `skipped = 0`, `todo = 0`, `total ≥ baselineTotal`. (4) Je Mutant ein Job: frischer Checkout von Head, `find` muss in `file` genau einmal vorkommen (sonst `not_applied`), ersetzen, Test-Command ausführen, Exit ≠ 0 → `detected`, sonst `survived`. (5) `aggregate` (nur Code aus `main`, `needs:` alle Jobs, läuft auch bei roten Jobs): baut Evidence v3 aus Job-Outputs (nur ganze Zahlen und Enum-Strings, alles andere → `EVIDENCE_INVALID`), `runId` = `run:<task>-<n>`, `verifiedCommit` = Head, `diffBase` = `C`; `evaluateVerification(metadata, evidence)`; Summary „blockierend zuerst“ (Scope-Verstöße mit Datei, rote Checks, Inventar-Abweichung, überlebende Mutanten, Kollisionen, Modi); Job-Conclusion = `passed`. Required Check ist der Job `forge` (Dispatcher), der Gate und Aggregator zusammenfasst. (6) `permissions: contents: read` für alle Jobs; kein Secret im Repo; `GITHUB_TOKEN` wird keinem Check-Job als Umgebungsvariable gegeben. (7) Zeitlimit je Job (z. B. 20 min). |
| **Adversarial Tests** | (Set aus Exit-Kriterium 5, jeder als eigener Drill-PR gegen die echte Pipeline, zusätzlich Unit-Tests der Module): PR ändert `.github/workflows/forge.yml` → Preflight rot, keine Check-Jobs; `vitest.config.ts` hinzugefügt → Preflight rot; `describe.skip` in einer Scope-Testdatei → Inventar `skipped > 0` → rot (VX-04 umgekehrt); Tests in einer `modify`-Datei gelöscht → `total < baselineTotal` → rot; `package.json` mit `"test": "exit 0"` → Preflight rot; `.test.ts` außerhalb des Scopes → rot; Test schreibt in `$GITHUB_OUTPUT`/`$GITHUB_ENV` → wirkungslos, Job-Output bleibt Exit-Code (A-24); Test liest `process.env` → keine Secrets vorhanden, `GITHUB_TOKEN` nicht gesetzt (A-04); Commit-Status `forge` per API mit PAT → vom Ruleset ignoriert (O-02 beweist); gelisteter Mutant überlebt → `MUTATION_SURVIVED` rot (M1-Nachstellung, Exit-Kriterium 6); `find` kommt zweimal vor → `not_applied` → rot; Symlink in Scope-Datei → rot; `src/A.ts` neben `src/a.ts` → rot; `postinstall` in `package.json` → Preflight rot (geschützter Pfad); leerer Diff → grün (R11, dokumentiert); Aggregator mit manipuliertem Job-Output `"0; echo"` → `EVIDENCE_INVALID`. |
| **Nicht dazugehörig** | Status-Issue, Kernel-Observation-Events, Mutationskampagnen, Kosten, Egress-Sperre (D-11, als Grenze dokumentiert), parallele Runs, Inventar je Datei (S-06), Binärdateien (S-14). |

### O-01 Baseline-Hygiene, CODEOWNERS, Rulesets, Identitäten, `FORGE_HALT` (FORGE-OPS-0001)

| Feld | Inhalt |
|---|---|
| **Ziel** | Nach dem Merge der Codex-Baseline ist `main` der einzige Integrationsstand, geschützt durch Rulesets, mit sauberer Zeilenende- und Node-Konfiguration, ohne Koordinationsdateien im Produktpfad, und jeder Agent hat eine eigene GitHub-Identität. |
| **Warum notwendig** | `main` ist leer, vier Branches divergieren (N3, TD-02, P-12); CRLF zerstörte gehashte Artefakte (N5, P-10, C-34, A-20, TD-03); Codex pusht als Seb (TD-01, A-26, KRITISCH 2); ohne Rulesets kann jeder Agent auf `main` pushen, force-pushen und Run-Branches löschen (A-07, F-06/F-07/F-07b, G-1/G-2); Required Checks und „Approval des letzten Push“ sind das, was in V0.1 Kernel-Staleness und Head-Drift ersetzt (A2, K10, NRT-18); `FORGE_HALT` ist der einzige Notfallschalter (Exit-Kriterium 9). |
| **Dependencies** | Codex-Baseline auf `main` (extern, OD-4). Für `policy.json`-Inhalte: P-02 definiert das Schema, O-01 liefert die Logins. |
| **Erlaubter Scope** | create: `.gitattributes`, `.nvmrc`, `.github/CODEOWNERS`. delete: `forge/coordination/CLAUDE.md`, `forge/coordination/CODEX.md` (Historie bleibt). GitHub-Einstellungen: Rulesets, Merge-Methoden, Repository-Variable, Collaborators. Außerhalb des Repos: Ausgabelimits je Agent-Schlüssel. |
| **Erwartete Produktionszeilen** | ~20 (Konfigurationsdateien), 0 Code. |
| **Erwartete Testzeilen** | 0; Nachweis durch Drills (unten) und einen Export der Ruleset-Konfiguration als Datei `forge/ops/RULESETS.md` (Owner-Dokumentation). |
| **Acceptance-Idee** | (1) `.gitattributes`: `* text=auto eol=lf`, `*.md text eol=lf`, `*.json text eol=lf`; `.nvmrc`: `22` (passend zu `engines`). (2) CODEOWNERS (`@Wuerfelduell`): `/.github/`, `/forge/`, `/src/forge/`, `/src/forge-github/`, `/tests/forge/`, `/tests/forge-red-team/`, `/tests/forge-github/`, `/scripts/`, `/package.json`, `/package-lock.json`, `/tsconfig*.json`, `/vitest.config.*`, `/.gitattributes`, `/.nvmrc`. (3) Ruleset `main`: Restrict deletions, Block force pushes, Require linear history, Require a pull request before merging (1 Approval, Dismiss stale approvals on push, Require approval of the most recent reviewable push, Require review from Code Owners), Require status checks to pass (`forge`, `forge-approval`, Quelle GitHub Actions, „Require branches to be up to date“), keine Bypass-Akteure (Notfall = Ruleset sichtbar deaktivieren). (4) Repo-Einstellung: nur Squash-Merge erlaubt; Squash-Commit-Message = PR-Titel + Nummer. (5) Ruleset `refs/heads/forge/run/**` und `refs/heads/forge/spec/**`: Block force pushes, Restrict deletions. (6) Repository-Variable `FORGE_HALT = 0`. (7) Codex: eigener GitHub-Account als Collaborator (Write), Git-Author/Committer dieses Accounts; Claude-Login laut O-02. (8) Ausgabelimits beim Anbieter je Agent-Schlüssel gesetzt (Dokumentation in `forge/ops/RULESETS.md`, keine Beträge im Repo). (9) Koordinationsdateien entfernt; `forge/BASELINE-STATUS.md`, `forge/reviews/**`, `forge/approvals/**`, Legacy-Contracts bleiben, nur Owner-änderbar. |
| **Adversarial Tests (Drills, dokumentiert mit Link)** | Agent-Identität: `git push origin main` → abgelehnt; Owner: direkter Push auf `main` → abgelehnt (kein Bypass); Agent: Force-Push auf `forge/run/x` → abgelehnt; Agent: Branch `forge/run/x` löschen → abgelehnt; PR mit stale Approval nach Push → Merge-Button gesperrt; Merge-Commit-/Rebase-Option im Merge-Dialog nicht vorhanden; Datei mit CRLF committen → beim Commit normalisiert (Agentenseite), Parser lehnt CR ohnehin ab; Commit-Status `forge` per API → Required Check nicht erfüllt (zusammen mit O-02); `FORGE_HALT=1` → alle Forge-Checks rot (sobald P-03 existiert; vorher nur Variable angelegt). |
| **Nicht dazugehörig** | Workflows und Code (O-02, P-xx), Inhalt von `policy.json` jenseits der Logins (P-02), Migration der Legacy-Contracts (S-09), eigene GitHub-App (D-05). |

### O-02 Verifier-Spike und bösartige Test-PRs (FORGE-OPS-0002)

| Feld | Inhalt |
|---|---|
| **Ziel** | Vor dem Bau von P-03..P-06 ist mit echten PRs gegen das echte Repository bewiesen, dass ein Required Check aus `main` stammt und vom PR weder verändert noch ersetzt werden kann, und es ist geklärt, wie TypeScript in Actions läuft und unter welchen Logins die Agenten erscheinen. |
| **Warum notwendig** | Deep Audit 17.4 nennt diesen Punkt den kritischen der ganzen Architektur; beide Kandidaten (`pull_request_target`, Dispatch) haben bekannte Fallstricke (TD-07, A-05, A-24). Ohne den Spike würden P-03..P-06 auf einer Annahme gebaut. |
| **Dependencies** | O-01 (Inhalt auf `main`, Actions aktiv, Ruleset zum Testen der Required-Check-Quelle). |
| **Erlaubter Scope** | create: `.github/workflows/forge.yml` (Skelett: Dispatcher-Job `forge`, Job `forge-approval`, Trennung trusted/untrusted, noch ohne Fachlogik), `forge/ops/VERIFIER-SPIKE.md` (Ergebnisse). Drill-PRs werden geschlossen, nicht gemergt, und im Spike-Dokument verlinkt. |
| **Erwartete Produktionszeilen** | 60–80 YAML, 0 Code. |
| **Erwartete Testzeilen** | 0; die Drills sind der Test. |
| **Acceptance-Idee** | Das Spike-Dokument beantwortet mit Beleg (PR-Link, Workflow-Lauf): (1) `pull_request_target` führt die Workflow-Datei aus `main` aus, auch wenn der PR sie ändert. (2) `actions/checkout` mit `ref: ${{ github.event.pull_request.head.sha }}`, `fetch-depth: 0`, `persist-credentials: false`, Job-`permissions: contents: read`: ein Schritt im PR-Code kann weder pushen noch kommentieren (403). (3) Required Check `forge` mit Quelle „GitHub Actions“: ein per API gesetzter Commit-Status `forge` erfüllt ihn nicht. (4) Logins: unter welchem Login erscheinen PRs, Kommentare und Reviews, die Claude bzw. Codex erzeugen (OD-1/OD-2), inkl. Kennzeichnung als App/Bot. (5) `node --experimental-strip-types scripts/x.ts` mit `.ts`-Imports läuft auf dem Runner mit Node 22 (sonst Entscheidung für `tsx` als devDependency per Owner-PR). (6) Ein Test, der in `$GITHUB_OUTPUT`/`$GITHUB_ENV` schreibt, verändert mit der Umleitung auf `/dev/null` keine späteren Schritte. (7) `vars.FORGE_HALT` ist in `pull_request_target` lesbar. (8) Checks laufen bei `opened`, `synchronize`, `reopened`, `pull_request_review` erneut; Check-Namen stabil. (9) Kann eine Agent-Identität `refs/replace/*` pushen? (Ergebnis bestimmt, ob P-01 (2) Pflicht oder Zusatz ist.) (10) Holt `actions/checkout` mit `fetch-depth: 0` `refs/replace/*`? (Erwartung: nein; dokumentieren.) (11) Shallow-Checkout-Standard (`fetch-depth: 1`) führt zu nicht beweisbarer Ancestry (G5 nachgestellt). |
| **Adversarial Tests (Drill-PRs)** | (a) PR ändert `.github/workflows/forge.yml` zu „immer grün“; (b) PR fügt `.npmrc` und `postinstall`-Skript hinzu; (c) PR setzt Commit-Status `forge` per API; (d) PR mit Test, der `process.env` ausgibt und `$GITHUB_OUTPUT` beschreibt; (e) PR aus Fork; (f) Force-Push auf einen Run-Branch; (g) Push von `refs/replace/<sha>` durch Agent-Identität; (h) PR mit Datei `aux.md` (Windows-Checkout-Probe, INFERRED im Red Team). Jeder Drill endet mit „abgelehnt/wirkungslos“ oder einem benannten Befund, der in P-03..P-06 als Anforderung landet. |
| **Nicht dazugehörig** | Gate-/Verifier-Logik (P-05/P-06), Policy-Inhalte (P-02), Entscheidung für `tsx` ohne Not. |

---

## 7. Recommended First 5 Implementation Tasks

Sofort beginnen, in dieser Reihenfolge der Freigabe, bewusst auf drei Spuren verteilt, damit die Kernspur den kritischen Pfad nicht blockiert:

| # | Task | Warum zuerst | Spur / Vorschlag | Wartet auf |
|---|---|---|---|---|
| 1 | **O-01 Baseline-Hygiene, CODEOWNERS, Rulesets, Identitäten, `FORGE_HALT`** | Jede weitere Plattformarbeit braucht `main` mit Inhalt, Schutzregeln und echte Logins. Codex' `0dfd903` ist der Kandidat; der einzige offene Punkt ist OD-4 (Koordinationsdateien). Codex committet in `0dfd903` weiterhin unter Sebs Konto, OD-1 ist also noch offen | Betrieb: Seb (Rulesets, Identitäten), Codex (Dateien, Löschung) | Baseline-Merge |
| 2 | **O-02 Verifier-Spike** | Größte Unsicherheit der Architektur; sein Ergebnis bestimmt die Form von P-03, P-05, P-06 und liefert die Logins für P-02 | Betrieb/Plattform: ein Agent mit eigener Identität, Seb legt Drill-PRs mit an | O-01 |
| 3 | **K-01 Geschützte Pfade** (direkt gefolgt von **K-03 Evidence v3** auf demselben Branch) | Längste Kern-Kette (K-01 → K-03 → K-04); K-03 legt die Evidence-Form fest, die P-01 und P-06 brauchen. Kann heute gegen `0dfd903` beginnen | Kern: Claude implementiert, Codex reviewt (oder umgekehrt), Seb merged | nichts |
| 4 | **K-05 Owner-, Rollen- und Linearitätsregeln** | Unabhängig von K-01/K-03, Voraussetzung für P-05; kleine Regeln mit hoher Testlast, gut parallelisierbar | Kern: zweiter Kern-Implementierer oder derselbe nach K-03 | nichts (Merge nach K-03) |
| 5 | **P-02 Policy und Identitäten** (parallel dazu **P-01 Git-Snapshot**, sobald K-03 die Form festlegt) | Alle Plattform-Checks hängen daran; der Code braucht den Spike nur für zwei Werte (Claude-Login, Node-Startweise) und kann vorher beginnen | Plattform: Codex implementiert, Claude reviewt | O-01 für die Logins |

Danach: K-02 und K-04 (Kern, klein), P-03 → P-04 → P-05 → P-06 (Plattform, sequenziell, weil sie Module teilen), dann der Trockenlauf.

**Bootstrap-Regel für alle Härtungs-PRs (D-10):** PR-Titel trägt die Karten-ID, PR-Body trägt die Adversarial-Liste der Karte als Checkliste, Autor-Login ≠ Reviewer-Login, Merge durch Seb (Squash). Damit ist jede Härtung selbst ein Vorgriff auf das Verfahren, das sie absichert.

---

## 8. First Forge-Managed Run Readiness Checklist

Jeder Punkt braucht einen Beleg (Link auf PR, Workflow-Lauf, Check-Summary oder Datei). Ohne alle Punkte kein Start des echten Tasks.

### 8.1 Baseline und Repository

- [ ] Codex-Baseline (Kandidat `0dfd903`) ist per PR auf `main`; Link.
- [ ] Kein Arbeitsstand existiert nur auf einem Agenten-Branch (Liste `commits(ref) \ commits(main)` für alle Refs ist leer oder jede Differenz ist als Historie akzeptiert); Beleg: Ausgabe.
- [ ] `forge/coordination/*` ist nicht mehr auf `main` (O-01).
- [ ] `.gitattributes`, `.nvmrc`, `.github/CODEOWNERS` auf `main`; Fresh Clone unter Windows mit Standardkonfiguration lässt die Suite grün (Codex-Nachweis).
- [ ] Ruleset `main` aktiv mit allen Punkten aus O-01 (3); Export in `forge/ops/RULESETS.md`.
- [ ] Nur Squash-Merge möglich (Drill: Merge-Dialog).
- [ ] Ruleset `forge/run/**` aktiv; Drills Force-Push und Löschung abgelehnt (Links).
- [ ] Direkter Push auf `main` durch Agent und durch Owner abgelehnt (Drill-Links).

### 8.2 Identitäten und Rollen

- [ ] Codex arbeitet unter eigenem Login (Commit-Author ≠ `Diceduel`/`Wuerfelduell`); Beleg: ein Commit auf einem Spike-Branch.
- [ ] Claude-Login bekannt und in `policy.json` eingetragen (O-02 Punkt 4).
- [ ] `forge/policy.json` auf `main`, `bootstrap: true`, alle Logins mit Rollen, `maxActiveRuns: 1`, `allowedChecks` = `typecheck`, `test`.
- [ ] Für den ersten Task sind benannt: Spec-Autor, Architektur-Reviewer (≠ Spec-Autor), Developer (≠ Architektur-Reviewer), Code-Reviewer (≠ Developer); alle vier als Logins mit passender Rolle (OD-3).
- [ ] ChatGPT-Beteiligung ist als „über Seb, zählt als Owner-Urteil“ dokumentiert (D-4).
- [ ] Ausgabelimits beim Anbieter je Agent-Schlüssel gesetzt (Bestätigung, keine Beträge im Repo).

### 8.3 Kern

- [ ] K-01..K-05 auf `main`; `npm ci && npm run typecheck && npm test` grün im Fresh Clone (Link auf Workflow-Lauf, nicht nur lokale Tabelle).
- [ ] Red-Team-Referenzmodell nachgezogen; Differentialtest 0 Abweichungen.
- [ ] Regressionstests aus Red Team §6 vorhanden und grün: RTN-05, RTN-06, RTN-07, RTN-08, RTN-09, RTN-10, RTN-12, RTN-16, RTN-17, RTN-18, RTN-19 (RTN-01..04 = S-02/S-03, RTN-11 = S-08, RTN-13 teilweise durch K-02, RTN-14/15 durch P-01).
- [ ] Die `documents`-Tests für RT-05, RT-09, RT-02 aus `tests/forge-red-team/findings.test.ts` sind auf den neuen Stand gebracht (RT-02 geschlossen; RT-05 an der Grenze gelöst, im Kern dokumentiert offen; RT-09 = S-02 offen).

### 8.4 Plattform

- [ ] `forge/ops/VERIFIER-SPIKE.md` beantwortet alle elf Punkte aus O-02 mit Links.
- [ ] P-01..P-06 auf `main`; Workflows `forge.yml` und `forge-handoff.yml` nur auf `main` gültig.
- [ ] Required Checks `forge` und `forge-approval` mit Quelle GitHub Actions im Ruleset; ein per API gesetzter Status gleichen Namens erfüllt sie nicht (Drill-Link).
- [ ] Bösartiges PR-Set (Exit-Kriterium 5) ausgeführt, jeder PR rot, Links: Workflow-Änderung, `vitest.config.*`, `describe.skip`, `.test.ts` außerhalb des Scopes, Commit-Status per API, leerer Diff-Anspruch (irrelevant, Verifier rechnet selbst; dokumentiert), Code zwischen Base und Contract-Commit (Contract-PR mit zweiter Datei), Symlink, Case-Kollision, `package.json`-Änderung, Test mit `$GITHUB_OUTPUT`-Schreibzugriff.
- [ ] M1-Nachstellung: ein im Contract gelisteter Mutant, den die Tests nicht erkennen, macht `forge` rot (Link).
- [ ] Staleness-Drill: `main` bewegt sich nach grünem Verifier → Merge-Button gesperrt bis Re-Verify auf aktuellem `main`; neuer Push verwirft das Code-Review (Link).
- [ ] `FORGE_HALT=1` macht `forge` auf einem offenen PR rot; Rücksetzen macht ihn wieder grün (Links).
- [ ] Notfallschritte dokumentiert in `forge/ops/RULESETS.md`: `FORGE_HALT`, PR schließen, Agent-Session in der App beenden, Collaborator entfernen.

### 8.5 Trockenlauf (Drill-Task, vor dem echten Task)

- [ ] Ein trivialer Task (z. B. `FORGE-DRILL-0001`: eine neue Datei `src/domain/drill.ts` mit einer Funktion und einem Test, ein Mutant) ist vollständig über die Pipeline gelaufen: Contract-PR → `forge` grün → unabhängiges Approval → Squash-Merge → Handoff-Kommentar → Developer startet **nur** aus Handoff + Rollenvorlage → Read-Quittung im PR-Body → Run-PR → `forge` (Gate + Verifier) grün → `forge-approval` grün durch Code-Reviewer ≠ Developer → Squash-Merge durch `Wuerfelduell` **vom Android-Handy**.
- [ ] Gezählt und notiert: Owner-Handgriffe (Ziel ≤ 5), Contract-Textzeilen in Chats (Ziel 0), von Hand getippte SHAs (Ziel 0).
- [ ] Der Drill-Task darf danach per Folge-PR wieder entfernt werden (Bootstrap-PR); alternativ bleibt er als Beispiel.
- [ ] Zwei Störfälle nachgestellt (Minimum Product Exit-Kriterium 10): Developer pusht nicht → kein PR, nichts wird angenommen, Handoff bleibt gültig; Force-Push auf den Run-Branch → vom Ruleset abgewiesen.

### 8.6 Der erste echte Task: Mystery „Accusation & Verdict“

- [ ] Seb hat die offenen Entscheidungen D1–D10 aus `MYSTERY-ACCUSATION-VERDICT-DESIGN.md` getroffen und die Task-ID festgelegt (OD-5; voraussichtlich TASK-0006; die TASK-0005-v2-Review-Vormerkung „TASK-0006“ für Verbalisierung/ConversationState wird umnummeriert).
- [ ] Der Contract (von einem Spec-Autor mit eigener Identität, in einem eigenen Thread, nicht Teil dieses Plans) ist kernkonform: `---json`-Frontmatter nach `ContractMetadataSchema` (Stand nach K-04), `baseCommit` = aktueller `main`-Head, `dependencies: []` (TASK-0001..0004 sind dem Kern unbekannt; Bindung über `baseCommit`, Handoff-Audit §3 Punkt 9), `scope.create`/`scope.modify` genau die Dateien aus dem Design (`src/domain/case-solution.ts` in `modify`, neue Accusation-Dateien und Tests in `create`), `requiredChecks` = `typecheck` + `test`, `mutationSmoke.mutants` ≥ 3 (z. B. Polaritätsvertauschung bei `contradicted`, `missing`-Prüfung entfernen, Bindungsprüfung `truthHash` entfernen), End-Marker als letzte Zeile.
- [ ] Contract-PR ist grün (`forge`) und vom Architektur-Reviewer freigegeben (`forge-approval`), Squash-Merge durch Seb, Handoff-Kommentar vorhanden.
- [ ] Developer-Identität ist nicht der Login des Architektur-Approvals (P-05 Punkt 2).
- [ ] Erst jetzt: Handoff in die Developer-App kopieren. Alles danach ist der Run selbst.

---

## Anhang A: Abdeckung der von Seb genannten Schwerpunkte

| Schwerpunkt | MUST-Task(s) | Rest |
|---|---|---|
| authentifizierte Identitäten | P-02, O-01, P-03/P-05 (Prüfung an der Grenze), K-05 (Kern-Konsistenz) | S-03 Ledger |
| Contract-Commit linear / kein ungeprüfter Code | K-05 (Kern: ein Parent, nur Contract-Datei), P-03 (Base auf `main`, PR nur eine Datei), O-01 (lineare Historie, Squash) | S-04 Base-Trennung |
| echte Git-Diff-Basis | K-03 (`diffBase == startedFromCommit`), P-01 (Diff `C..head`), P-06 (Verifier berechnet) | – |
| Verifier unabhängig vom Developer | O-02 (Beweis), P-06 (Workflow aus `main`, Jobs ohne Secrets), K-05 (`VERIFIER_NOT_INDEPENDENT`), O-01 (Required Check nur aus Actions) | D-11 Egress |
| Testkonfiguration geschützt | K-01 (Pfadliste), O-01 (CODEOWNERS), P-06 (Preflight, Inventar) | S-06 Inventar je Datei, S-12 Overrides |
| refs/replace | P-01 (`GIT_NO_REPLACE_OBJECTS=1`, Erkennung auf dem Remote), O-02 (Push-Drill) | – |
| fetch-depth | P-01 (Shallow-Erkennung), P-06 (`fetch-depth: 0`), O-02 (Nachweis) | – |
| deterministische Diff-Optionen | K-03 (`diffOptions` Literal, kein `renamed`), P-01 (`--no-renames --raw`) | – |
| Git-Dateimodi | K-03 (`mode` je Datei, nur `100644`), P-01 (Raw-Diff) | – |
| Symlinks/Submodule | K-03 (`120000`/`160000` = Verstoß), K-01 (`.gitmodules` geschützt), P-06 (Preflight vor jeder Ausführung) | – |
| case-insensitive/Windows-sichere Pfade | K-01 (case-gefaltete Präfixe), K-02 (reservierte Namen, End-Punkt), K-03 + P-01 (Kollisionen), O-01 (`.gitattributes`) | – |
| Blocking-Findings über Revisionen/Runs | P-03/P-05 (zugewiesener Reviewer, D-5), O-01 (Approval des letzten Push, Dismiss stale) | S-03 Ledger, S-11 Rework-Regel |
| Owner-Aktionen | K-05 (`OWNER_NOT_HUMAN` überall), P-02 (nur Owner-Login ist `human`), O-01 (Merge nur über Ruleset, `FORGE_HALT`), P-03/P-05 (`/forge reviewer` nur vom Owner) | S-15 weitere Kommandos |
| Observation-Grenzen | P-01 (sound, repo-gebunden, fail-closed), P-05 (Beobachtung vom Gate, nie vom Developer), K-05 (Observer ≠ Developer), D-6 | S-02 Kernmodell, S-10 Lease |

## Anhang B: Zuordnung der Audit-Blocker

| Audit-Aussage | Einordnung |
|---|---|
| Deep Audit KRITISCH 1–4 (ein Akteur bis `accepted`; Pilot-Praxis; Evidence ohne Diff-Basis; aushöhlbare Checks) | MUST: P-02/O-01, K-03, K-01/P-06 |
| Deep Audit HOCH 5–9 (ungeprüfter Code im Startpunkt; Findings überleben keinen Run; Log ohne Integrität; Coordination-Injektion; Kern nie an echtem Task) | MUST: K-05/P-03; D-5 (Ledger = S-03); DEFER D-01 (kein Log); MUST K-01; der Trockenlauf |
| Red Team BLOCKING 1 (Observation ohne Zeit/Reihenfolge/Widerruf/Repo) | V0.1 ohne persistierte Observationen: D-6, P-01, P-05; Kernmodell = S-02 |
| Red Team BLOCKING 2 (Blocking Findings in keinem Gate) | D-5 in P-03/P-05; Ledger = S-03 |
| Red Team BLOCKING 3 (refs/replace, Merge-Commit als Contract-Commit) | MUST: P-01, K-05, O-01 |
| Red Team IMPORTANT 4–10 | MUST: K-01, K-02, K-03, K-05, P-01; DRT-07 = S-07 |
| Red Team HARDENING 11–15 | MUST, soweit billig: K-02 (DRT-17, DRT-25, DRT-28, DRT-15), K-04 (DRT-32), K-05 (DRT-42, DRT-03); DRT-43 entfällt (Zeit setzt die Projektion) |
| Run Recovery K-1..K-7, R-1..R-9 | K-3 = MUST (K-05); K-4 teilweise (P-05 beobachtet live); Rest DEFER D-03 / S-02 / S-10 |
| Minimum Product NEXT 5 | OPS-0001 = O-01; OPS-0002 = O-02; CORE-0002 = P-03 + P-04 + P-05; CORE-0003 = P-06 (+ K-01..K-05 als Kernvoraussetzung); OPS-0003 = Trockenlauf + erster Run, Status-Issue = S-01 |
| Handoff-Audit B1–B6 | B1 (Format) = P-03, B2 (externe Freigabe) = P-03 `forge-approval`, B3 (Start vom Contract-Commit) = P-04/P-05, B4 (Quittung) = P-04/P-05, B5 (Versionierungsregel) = P-03, B6 (TASK-0004) = D-13 |
