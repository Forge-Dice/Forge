# FORGE DEEP AUDIT

| Feld | Wert |
|---|---|
| Rolle | Principal Architect, Adversarial Systems Reviewer, AI Agent Orchestration Designer |
| Modus | rein lesend. Keine Änderung am Repository, keine Commits, keine PRs, keine GitHub-Schreibzugriffe |
| Datum | 2026-10-03 |
| Repository | `Wuerfelduell/Forge` |
| Maßgeblicher Forge-Core-Stand | `codex/forge-core-v2-repair` @ `b9339d2` (Implementierung `811ed0d`, A-Patch `4cbbb25`) |
| Weitere Stände | `claude/forge-architecture-review-hjdq89` @ `be40a68`, `codex/mystery-task-0005` @ `fab792a`, `codex/task-0004-contract` @ `6a8c0c5`, `main` @ `f5dbc73` (nur `.gitkeep`) |
| Eigene Ausführung | `npm ci`, `npm run typecheck`, `npm test` auf `b9339d2`: 22 Dateien, **1086/1086 grün**. Mystery-Stand `fab792a`: 7 Dateien, 452/452 grün |
| Eigene Experimente | 25 Kernel-Angriffe als Scratch-Skripte gegen die Produktionsmodule (`replay`, `canStartDeveloperRun`, `evaluateVerification`), 5 Vitest-Experimente in einer Wegwerfkopie, ein Kompatibilitätstest alter Kernel gegen neuen Kernel. Nichts davon liegt im Repository. |
| Bezug | Ergänzt den parallelen Bericht `forge-audits/FORGE-CONTRACT-HANDOFF-AUDIT.md` (Handoff-Fokus). Dort Gesagtes wird hier nur referenziert, nicht wiederholt. |

**Kennzeichnung der Befunde**

| Label | Bedeutung |
|---|---|
| CONFIRMED | In diesem Audit mit echtem Code ausgeführt und reproduziert (Experiment-ID `E-xx` oder Vitest-Experiment `VX-xx`) |
| CODE | Aus dem Quelltext eindeutig ablesbar, nicht separat ausgeführt |
| GIT | Aus Git-Historie, Diffs, Autoren oder Zeitstempeln belegt |
| INFERRED | Schlussfolgerung, nicht direkt belegt |
| NOT REPRODUCED | Hypothese geprüft, trat nicht ein |
| MITIGATED | Durch vorhandenen Code bereits abgewehrt |
| DESIGN LIMIT | Bewusste, dokumentierte Grenze von V0.0 |
| TRUST BOUNDARY | Nur außerhalb des Kerns lösbar |

Schweregrade: **KRITISCH** (Akzeptanz falscher Arbeit ohne Täuschungsaufwand möglich), **HOCH**, **MITTEL**, **NIEDRIG**.

---

## 1. Executive Technical Summary

**Ein Satz:** Forge V0.0 ist ein sauber gebauter, gut getesteter Prüfkern für *ehrliche* Akteure. Gegen einen unehrlichen oder fehlerhaften Developer-Agenten schützt er heute praktisch nichts, weil jeder Fakt, den er prüft, vom Developer selbst geliefert werden darf, und weil der Kern noch nie an einen echten Task angeschlossen war.

### Was stimmt

- Der Kern (`src/forge`, 1225 Zeilen) ist rein, deterministisch, tief eingefroren, und die Zustandslogik deckt sich mit einem unabhängigen Referenzmodell (9000 Fuzz-Events, 0 Abweichungen). Ich habe keinen Fehler in der *internen* Konsistenz gefunden, der nicht schon als RT-xx bekannt ist.
- Die Grundideen sind richtig und durch den Pilot gerechtfertigt: Status wird abgeleitet statt gespeichert, Approval hängt am Inhalts-Hash, Run startet vom Contract-Commit, Verifikation wird gegen genau die Contract-Revision des Runs bewertet, ein Run je Task.
- Die Reparaturen RT-01, RT-03 und RT-06 sind korrekt umgesetzt.

### Was nicht stimmt (die zehn wichtigsten Befunde)

1. **KRITISCH: Ein einziger Akteur kann einen Task bis `accepted` bringen.** Rollen und Identitäten sind selbst erklärt, Verifier- und Observer-Rolle dürfen der Developer selbst sein, und `actorType: "human"` ist nur ein Feld. CONFIRMED (E-02). Unter `different_provider` genügen zwei Identitäten für die ganze Kette inklusive Architektur-Approval (E-14). Das ist als RT-05 bekannt, wird aber in Contracts, Tests und Berichten weiterhin als „Unabhängigkeit“ bezeichnet. Es ist keine Sicherheitsgarantie, sondern ein Konsistenzcheck.
2. **KRITISCH: Im Pilot ist genau das passiert.** Eine einzige Claude-Session (`session_01YERr4…`) hat TASK-0001 bis 0004 implementiert, FORGE-CORE-0001A/B spezifiziert, implementiert, ihre eigenen Approval-Records als „human owner“ geschrieben, den eigenen Kern geredteamt und den TASK-0005-Contract „unabhängig“ reviewt, der auf ihrem eigenen TASK-0004-Code aufbaut. GIT. Codex committet unter Sebs GitHub-Identität (`Diceduel <315180734+Wuerfelduell@…>`, GIT) und pusht sehr wahrscheinlich auch mit Sebs Zugang (INFERRED). GitHub kann Codex und Seb deshalb nicht unterscheiden.
3. **KRITISCH: Die Verification Evidence ist nicht an einen Diff-Bereich gebunden.** `changedFiles` hat keinen `diffBase`. Ein Verifier, der nur den letzten Commit diffed, oder eine leere Liste bei geändertem Ergebnis, besteht. CONFIRMED (E-09). Damit ist die Scope-Prüfung eine Prüfung der *Selbstauskunft*.
4. **KRITISCH: `requiredChecks` lassen sich aushöhlen, ohne den Command-String zu ändern.** `vitest.config.ts` mit enger `include`-Liste macht aus 1086 Tests 19, `describe.skip` liefert Exit 0. CONFIRMED (VX-03, VX-04). Die Evidence enthält keine Testanzahl, keine Skip-Zahl und keinen Hash der Testkonfiguration. Der Kern verbietet `package.json`, `tsconfig.json`, `vitest.config.*` und `.github/` nicht im Scope.
5. **HOCH: Zwischen `baseCommit` und `contractCommit` kann ungeprüfter Code liegen.** Das Gate prüft nur „base ist Vorfahre des Contract-Commits“. Ein dazwischenliegender Commit landet im Startpunkt des Runs und erscheint in keinem Scope-Diff. CONFIRMED (E-12). Real: FORGE-CORE-0001A baut auf `e9cb8e2` auf, der TASK-0004-Implementierung, deren Architektur-Review laut eigenem Frontmatter noch ausstand. GIT.
6. **HOCH: Findings überleben keinen neuen Run.** Nach `request_changes` kann derselbe Commit in einem neuen Run erneut eingereicht und von einem anderen (oder demselben) Reviewer approved werden. CONFIRMED (E-01, E-22). Kombiniert mit Log-Kürzung verschwindet ein Reject spurlos (E-08).
7. **HOCH: Der Eventlog ist kein belastbarer Source of Truth.** Kein Schema- oder Kernel-Versionsfeld, die Review-Policy steht nicht im Log (derselbe Log ergibt unter anderer Policy einen anderen Zustand, E-07), keine Event-ID, keine Hash-Kette, doppelt zugestellte Events werden nicht idempotent behandelt (E-16), und jedes Kernel-Upgrade kann historische Logs unreplaybar machen. CONFIRMED (E-24: ein unter dem Claude-Kernel akzeptierter Log scheitert unter dem v2-Kernel bei Index 6).
8. **HOCH: Die Coordination-Ausnahme ist ein Code- und Prompt-Injection-Kanal.** Jede Datei unter `forge/coordination/` ist ohne Scope erlaubt. Eine `forge/coordination/notes.test.ts` wird von `npm test` im Verifier ausgeführt und hat Zugriff auf Umgebung und Dateisystem. CONFIRMED (VX-01). Agenten lesen dieselben Dateien als Kontext.
9. **HOCH: Der Kern hat nie einen echten Task gesteuert.** Kein persistierter Log, kein Git-Observer, kein Runner, keine CI (`.github/` fehlt), kein Merge. Die beiden echten Mystery-Contracts sind für den Kern nicht einmal parsebar (`FRONTMATTER_MISSING`, CONFIRMED). Der eigene v2-Contract liegt unter einem Pfad, den der Kern ablehnt (`FORGE-CORE-0001B.v2.md`). Die „Night-Replay“-Dogfood ist ein Test mit handgeschriebenen Beobachtungen.
10. **MITTEL: Kein Branch enthält den Gesamtstand.** `main` ist leer, nichts ist gemerged, nichts ist im Sinne des Kerns `accepted`. `codex/forge-core-v2-repair` und `codex/mystery-task-0005` kollidieren bereits in `forge/coordination/CODEX.md` (add/add-Konflikt, CONFIRMED per `git merge-tree`). Die Integrationsfrage ist ungelöst, bevor die erste Parallelisierung beginnt.

### Konsequenz

Forge braucht als Nächstes **keine neuen Kernel-Features**, sondern drei Dinge, die es mit der Wirklichkeit verbinden:

1. Fakten, die nicht vom Developer kommen: Git-Observer und Verifier in einer Umgebung, auf die der Developer keinen Schreibzugriff hat.
2. Echte Identitäten: authentifizierte GitHub-Identitäten je Agent statt selbst erklärter Labels, und eine eigene Identität für Codex.
3. Einen echten Integrationspunkt: `main` mit Branch-Protection, ein Run als PR, Merge als Abnahme.

Dafür reichen in V0.1 GitHub (Repo, Branch-Protection, Actions, PRs), der vorhandene Kern und eine JSONL-Logdatei. PWA, Backend, Postgres, Queue, LLM-Gateway und Cloud-Runner sind für V0.1 nicht nötig (Abschnitt 17).

---

## 2. Actual Architecture

### 2.1 Was tatsächlich existiert

```text
                    (nichts davon ist automatisiert)
 Seb (Chat, Android/PC) ──copy/paste──► Claude-Session ──git push (Claude-Identität)──► GitHub
        │                           └─► Codex (Windows, Sebs Git-Identität) ──git push──► GitHub
        │                           └─► ChatGPT (Review per Chat)
        ▼
  Markdown-Artefakte in Git: forge/contracts, forge/approvals (JSON), forge/reviews, forge/coordination

 src/forge = reine Bibliothek ◄── nur von Vitest-Tests aufgerufen (inkl. dogfood mit handgeschriebenen Beobachtungen)
```

Es gibt keinen Prozess, der Events erzeugt, speichert, Git liest, Checks ausführt oder irgendetwas merged. Der Kern ist eine Spezifikation in ausführbarer Form.

### 2.2 Komponenten nach Status

| Komponente | Ort | A implementiert | B nur Contract | C getestet | D nur geplant | E bekannte Grenzen |
|---|---|---|---|---|---|---|
| Contract-Parser + Hash | `contract-document.ts` | ja | | ja (Golden Vector, alle Issue-Codes) | | Nur `---json`-Format. Mystery-Contracts sind nicht parsebar. RT-13, RT-14 |
| Primitive Schemas | `primitives.ts` | ja | | ja | | RepoPath ASCII-only, max 255; RT-15 |
| Identität, Unabhängigkeit | `identity.ts` | ja | | ja | Authentifizierung | selbst erklärt (RT-05) |
| Events + Rollen | `events.ts` | ja | | ja | | Rolle selbst erklärt, keine Event-ID, kein Schema-Version-Feld |
| Event-Anwendung, Replay | `state.ts` | ja | | ja (Differential-Fuzzer) | | RT-07, RT-10, RT-12, PERF-1/2b |
| Start Gate | `start-gate.ts` | ja | | ja | | Repo-Fakten aus übergebener Beobachtung |
| Remote-Outcome | `verification.ts` | ja | | ja | | Graph vom Beobachter geliefert, RT-09 |
| Verifikationsbewertung | `verification.ts` | ja | | ja | | Evidence-Inhalt vertraut |
| Mutation Evidence | Schemas + Bewertung | ja (Bewertung) | | ja | Mutation-Framework | Mutationsauswahl durch Developer |
| Review + Abnahme | `state.ts` | ja | | ja | | Findings nicht übertragen |
| ForgeLog-Persistenz | – | nein | Kommentar „log is authoritative“ (v2 §7) | nur JSON-Roundtrip-Test | ja | |
| Git-Observer | – | nein | „witnessed observations“ | nein | ja | |
| Check-Runner / Verifier | – | nein | 0001B Non-Goal | nein | ja | |
| Merge / Integration | – | nein | 0001B Non-Goal | nein | unklar | |
| Authentifizierung | – | nein | Non-Goal | nein | ja | |
| CI (`.github/workflows`) | – | **fehlt** | | | | |
| `.gitattributes`, Node-Pin | – | **fehlen** | | | | CRLF-Vorfall (2.4) |
| Approval-Records | `forge/approvals/*.json` | Pilot-Artefakt | | nur `dogfood.test.ts` liest sie | | Vom Developer-Agenten im Namen des Owners geschrieben |
| PWA, Backend, Postgres, Queue, GitHub App, LLM-Gateway, Cloud-Runner | – | nein | 0001A §18 Non-Goals | | ja | |

### 2.3 Größenverhältnisse

| Bereich | Zeilen |
|---|---|
| `src/forge` (Produktionskern) | 1225 |
| `tests/forge` + `tests/forge-red-team` | 3821 |
| Forge-Contracts + Reviews (Markdown) | ca. 2130 |
| `src/domain` (das eigentliche Spiel) | 1491 |
| Spiel-Tests | 2843 |

Der Prozesskern ist nach einer Nacht fast so groß wie die gesamte Spieldomäne, und seine Prozessdokumentation ist größer als beide zusammen. Das ist kein Fehler an sich, aber ein Warnsignal: Der Kern wurde vollständig gebaut, bevor er ein einziges Mal an einem echten Task benutzt wurde.

### 2.4 Branch-Landkarte (Stand 2026-10-03 ~07:10 UTC)

| Branch | Head | Enthält | Fehlt |
|---|---|---|---|
| `main` | `f5dbc73` | `.gitkeep` | alles |
| `codex/task-0004-contract` | `6a8c0c5` | Mystery 0001–0003, TASK-0004-Contract | – |
| `claude/forge-architecture-review-hjdq89` | `be40a68` | Mystery bis TASK-0004 `e9cb8e2`, Core 0001A/B, Red-Team, TASK-0005-Reviews v1+v2 | A-Patch, B v2, M1-Fix `1de7efe`, TASK-0005-Contract |
| `codex/forge-core-v2-repair` | `b9339d2` | wie oben bis `f712e50` + A-Patch + B v2 | TASK-0005-v2-Review, M1-Fix, TASK-0005-Contract |
| `codex/mystery-task-0005` | `fab792a` | Mystery bis TASK-0004 + M1-Fix + TASK-0005-Contract v2 | gesamter Forge-Core |

`git merge-tree origin/codex/forge-core-v2-repair origin/codex/mystery-task-0005` → **CONFLICT (add/add) in `forge/coordination/CODEX.md`**. Die Konvention „eine Koordinationsdatei pro Agent“ bricht, sobald ein Agent zwei Tracks bedient.

Realer Betriebsvorfall (GIT, `FORGE-CORE-0001B.v2.verification.md` §4): Auf Codex' Windows-Checkout lagen fünf gehashte Artefakte mit CRLF. Der Dogfood-Test schlug fehl, die Dateien wurden von Hand auf die Blob-Bytes zurückgesetzt, verifiziert wurde mit `git -c core.autocrlf=false clone`. Ein `.gitattributes` mit `* text=auto eol=lf` existiert bis heute nicht.

---

## 3. State Machine

### 3.1 Abbildung der gewünschten Kette auf das Tatsächliche

| Gewünschter Schritt | Existiert als | Erzwungen durch |
|---|---|---|
| Contract | Datei in Git + `contractText` im Event | Parser |
| Registration | `task_registered`, `contract_registered` | Kernel |
| Architecture Review | `approval_recorded` (Gate `architecture_review`) | Kernel |
| Approval | abgeleiteter Revisionszustand `approved` | Kernel |
| Dependencies | Prüfung in `approval_recorded` + Start Gate | Kernel (Repo-Teil nur gegen Beobachtung) |
| Start Gate | `canStartDeveloperRun`, neu berechnet in `run_started` | Kernel, Beobachtung vom **Developer** |
| Run | `run_started` | Kernel |
| Developer Report | `developer_report_recorded` | Kernel (Inhalt Selbstauskunft) |
| Remote Persistence | `remote_observed` → `remote_verified` | Kernel, Beobachtung von beliebigem Observer |
| Verification | `verification_recorded` | Kernel, Evidence von beliebigem Verifier |
| Code Review | `code_review_recorded` | Kernel |
| Acceptance | `task_accepted` | Kernel, `actorType` selbst erklärt |
| *Verification gestartet* | **kein Event** | – |
| *Merge / Integration* | **kein Event, kein Zustand** | – |
| *Task abbrechen / zurückziehen* | **kein Event** | – |
| *NEEDS_HUMAN* | **kein Zustand** | – |

### 3.2 Contract-Revisionszustand (abgeleitet, `contractRevisionState`)

| Zustand | Bedingung | Verlassen durch |
|---|---|---|
| `draft` | aktuelle Revision, keine Entscheidung | `approval_recorded` (approved / changes_requested), neue Version |
| `approved` | aktuelle Revision, Gate approved | neue Version → `superseded` |
| `changes_requested` | aktuelle Revision, Gate changes_requested | nur neue Version (endgültig für den Hash) |
| `superseded` | höhere Version existiert | terminal |

### 3.3 Task-Zustand (abgeleitet, erste passende Regel gewinnt)

| Zustand | Bedingung | Erlaubte Events (task-bezogen) | Verbotene / wirkungslose Events |
|---|---|---|---|
| `planned` | registriert, kein Contract | `contract_registered` | `approval_recorded` (`CONTRACT_UNKNOWN`), `run_started` (`START_NOT_ALLOWED`) |
| `specifying` | aktuelle Revision nicht approved | `contract_registered` (nächste Version), `approval_recorded` | `run_started` |
| `ready` | aktuelle Revision approved, kein verifizierter Run | `run_started`, `contract_registered` | `code_review_recorded`, `task_accepted` |
| `implementing` | ein Run nicht terminal | Run-Events, **`contract_registered`, `approval_recorded` (RT-07)** | zweiter `run_started` (`RUN_ALREADY_ACTIVE`) |
| `awaiting_review` | letzter verifizierter Run ohne Verdict | `code_review_recorded`, `contract_registered` | `run_started` (`TASK_NOT_STARTABLE`) |
| `review_approved` | Verdict approve | `task_accepted`, **`contract_registered` (setzt zurück, E-17)** | `run_started` |
| `rework_required` | Verdict request_changes + code_change | `run_started`, `contract_registered` | `task_accepted` |
| `contract_revision_required` | Verdict request_changes + contract_change | `contract_registered` | `run_started` |
| `accepted` | `task_accepted` liegt vor | keine (`TASK_ALREADY_ACCEPTED` für Contract/Approval) | alle |

### 3.4 Event-Tabelle (vollständig)

| Event | Rolle (selbst erklärt) | Vorbedingungen | Ergebnis | Failure Codes |
|---|---|---|---|---|
| `task_registered` | owner | Task-ID neu | Task `planned` | `EVENT_SCHEMA`, `ROLE_NOT_ALLOWED`, `TASK_ALREADY_REGISTERED` |
| `contract_registered` | spec_author | Task existiert, nicht accepted, Text parsebar, Hash = declared, taskId gleich, Pfad = `forge/contracts/<id>.md`, Version = höchste + 1 | neue aktuelle Revision | `TASK_UNKNOWN`, `TASK_ALREADY_ACCEPTED`, `CONTRACT_DOCUMENT_INVALID`, `CONTRACT_HASH_MISMATCH`, `CONTRACT_TASK_MISMATCH`, `CONTRACT_PATH_MISMATCH`, `CONTRACT_VERSION_NOT_NEXT` |
| `approval_recorded` | architecture_reviewer | Revision existiert, aktuell, Gate unentschieden, Reviewer ≠ Autor (Policy), Findings bei changes_requested, bei approved: kein blocking Finding, Dependencies akzeptiert mit exaktem Commit | Entscheidung gespeichert | `TASK_UNKNOWN`, `TASK_ALREADY_ACCEPTED`, `CONTRACT_UNKNOWN`, `CONTRACT_SUPERSEDED`, `APPROVAL_ALREADY_DECIDED`, `REVIEWER_NOT_INDEPENDENT`, `FINDINGS_REQUIRED`, `VERDICT_INCONSISTENT`, `DEPENDENCY_UNRESOLVED`, `DEPENDENCY_NOT_ACCEPTED`, `DEPENDENCY_MISMATCH` |
| `run_started` | developer | runId neu, Gate erlaubt (Neuberechnung) | Run `running`, `startedFromCommit = contractCommit` | `TASK_UNKNOWN`, `RUN_ALREADY_EXISTS`, `START_NOT_ALLOWED` (+ erster BlockReason) |
| `developer_report_recorded` | developer | Run `running`, Actor = Run-Developer | `reported` | `RUN_UNKNOWN`, `RUN_STATE_INVALID`, `ACTOR_NOT_RUN_DEVELOPER` |
| `remote_observed` | observer | Run `reported` | `remote_verified` wenn contained, sonst bleibt `reported` | `RUN_UNKNOWN`, `RUN_STATE_INVALID` |
| `verification_recorded` | verifier | Run `remote_verified`, verifiedCommit = claimedResultCommit | `verified` oder `failed` (abgeleitet) | `RUN_STATE_INVALID`, `VERIFIED_COMMIT_MISMATCH`, `EVENT_SCHEMA` (Duplikate, ungültige Pfade) |
| `run_failed` | developer, owner | Run aktiv, bei developer: Actor = Run-Developer | `failed` | `RUN_STATE_INVALID`, `ACTOR_NOT_RUN_DEVELOPER` |
| `run_abandoned` | owner | Run aktiv | `abandoned` | `RUN_STATE_INVALID` |
| `code_review_recorded` | code_reviewer | Run `verified`, letzter verifizierter Run der aktuellen Revision, noch kein Verdict, Commit = verifiedCommit, Reviewer ≠ Developer (Policy), Verdict konsistent, Äquivalenz-Quittung exakt | Verdict gespeichert | `RUN_STATE_INVALID`, `RUN_NOT_LATEST_VERIFIED`, `REVIEW_ALREADY_RECORDED`, `REVIEWED_COMMIT_MISMATCH`, `REVIEWER_NOT_INDEPENDENT`, `VERDICT_INCONSISTENT`, `EQUIVALENT_MUTATIONS_NOT_ACKNOWLEDGED` |
| `task_accepted` | owner | Task `review_approved`, runId = letzter verifizierter Run, `actorType = human` | `accepted` | `TASK_UNKNOWN`, `TASK_STATE_INVALID`, `RUN_NOT_LATEST_VERIFIED`, `OWNER_NOT_HUMAN` |

Run-Zustände: `running → reported → remote_verified → verified | failed`, aus allen drei aktiven Zuständen `failed` (explizit) oder `abandoned`.

### 3.5 Problematische Zustände

**Erreichbar ohne die nötige Prüfung**

| ID | Zustand | Fehlende Prüfung | Beleg |
|---|---|---|---|
| SM-01 | `accepted` | unabhängiger Verifier, echter Mensch, echter Observer | CONFIRMED E-02 |
| SM-02 | `ready` mit ungeprüftem Code im Startpunkt | Diff `baseCommit..contractCommit` ⊆ {Contract-Datei} | CONFIRMED E-12 |
| SM-03 | `verified` mit leerem oder unvollständigem `changedFiles` | Diff-Basis in Evidence | CONFIRMED E-09 |
| SM-04 | `review_approved` für exakt den Commit, der zuvor `request_changes` bekam | Bezug auf offene Findings | CONFIRMED E-01, E-22 |
| SM-05 | `accepted` während der Branch-Head schon weitergewandert ist | erneute Remote-Beobachtung vor Abnahme | CONFIRMED E-15 |
| SM-06 | `verified` ohne nennenswerte Mutationsprüfung bei `mutationSmoke: required` | Mutationsauswahl im Contract | CONFIRMED E-05 |

**Widersprüchlich**

| ID | Zustand | Widerspruch | Beleg |
|---|---|---|---|
| SM-07 | `verified` auf `superseded` Revision | Ergebnis existiert, ist aber für immer wirkungslos | RT-07 (bekannt) |
| SM-08 | `failed` mit Code `PUSH_REJECTED` oder `REMOTE_NOT_PERSISTED` im Zustand `remote_verified` | Der Push ist bewiesen, der Fehlercode behauptet das Gegenteil; der Code ist nicht an den Zustand gebunden | CODE `state.ts:375-381` |
| SM-09 | `abandoned` (Owner hat abgebrochen), Commit trotzdem gepusht | Kein Zustand „verwaist“; spätere Beobachtungen und Evidence werden abgelehnt (`RUN_STATE_INVALID`) | CONFIRMED E-21 |
| SM-10 | `specifying` nach `review_approved` | Spec-Autor kann jederzeit vor Abnahme eine neue Version registrieren und die Review-Freigabe entwerten | CONFIRMED E-17 |

**Nicht sauber verlassbar**

| ID | Zustand | Problem | Ausweg heute |
|---|---|---|---|
| SM-11 | Run `remote_verified`, Evidence nicht darstellbar (Dateiname mit Leerzeichen, Nicht-ASCII, > 255 Zeichen) | `verification_recorded` scheitert am Schema, es gibt keinen Fehlercode „Evidence nicht darstellbar“. Task bleibt `implementing`, neuer Start `RUN_ALREADY_ACTIVE` | CONFIRMED E-10. Nur `run_abandoned` durch Owner |
| SM-12 | Run `reported` ohne Observer | Es gibt keinen Observer-Prozess, kein Timeout | Owner |
| SM-13 | Run `running`, Worker tot | Kein Heartbeat, keine Zeit im Kern | Owner `WORKER_LOST` |
| SM-14 | Dependency-Zyklus | Für immer `specifying`, nur `DEPENDENCY_NOT_ACCEPTED` | RT-08 |
| SM-15 | `accepted`, danach Fehler gefunden | terminal, kein Reopen, kein Revert-Task-Konzept. Abhängige Tasks sind an den Commit gebunden | Neuer Task |
| SM-16 | Task, der nicht mehr gewollt ist | Es gibt kein `task_withdrawn`. Ein Task bleibt für immer in seinem letzten Zustand | keiner |

**Unerreichbar:** keine Zustände im engen Sinn. Der Differential-Fuzzer erreicht alle 9 Task- und 6 Run-Zustände. Unerreichbar im Prozess-Sinn sind dagegen „gemerged“, „needs_human“ und „verification läuft“, weil sie nicht existieren.

---
## 4. Contract Security

Grundannahme für die Spalte ACTUAL: Events werden wie heute ohne Authentifizierung eingespeist. „PROTECTED“ heißt: Der Kern lehnt ab, solange die gelieferten Beobachtungen wahr sind. Wo der Schutz nur gegen ehrliche Beobachtung hält, steht TRUST BOUNDARY.

| # | ATTACK | EXPECTED | ACTUAL | Bewertung |
|---|---|---|---|---|
| C-01 | Contract-Text nach Approval ändern und starten | Start blockiert | Neuer Text = neuer Hash; alte Approval gilt nicht; `CONTRACT_FILE_MISMATCH` am Gate | PROTECTED |
| C-02 | Contract unter falschem Pfad registrieren | abgelehnt | `CONTRACT_PATH_MISMATCH` | PROTECTED |
| C-03 | Contract im Run umbenennen (`git mv`) | Verstoß | beide Rename-Enden → `SCOPE_VIOLATION` (v2) | PROTECTED (seit `811ed0d`) |
| C-04 | Contract im Run löschen | Verstoß | `deleted` immer Verstoß, `forge/contracts/` immer Verstoß | PROTECTED |
| C-05 | Contract auf dem Branch-Head löschen, Run trotzdem starten | Start vom Contract-Commit | Bindung an Commit, nicht an Head; Start bleibt möglich, solange der Commit von irgendeinem Ref erreichbar ist | PROTECTED (gewollt) |
| C-06 | Alte, überholte Version starten | blockiert | `CONTRACT_NOT_CURRENT` | PROTECTED |
| C-07 | Falscher `baseCommit` (kein Vorfahre des Contract-Commits) | blockiert | `BASE_NOT_IN_CONTRACT_HISTORY` | PROTECTED / TRUST BOUNDARY (Graph geliefert) |
| C-08 | **Ungeprüfter Commit zwischen `baseCommit` und `contractCommit`** | blockiert oder sichtbar | Start erlaubt, `startFromCommit = contractCommit` enthält den Fremdcode, kein Scope-Diff sieht ihn | **VULNERABLE, HOCH**, CONFIRMED E-12 |
| C-09 | `baseCommit` = Root-Commit (`f5dbc73`), obwohl der Contract auf TASK-0003 aufbaut | Base muss den tatsächlichen Stand beschreiben | Erlaubt; `baseCommit` ist nur „irgendein Vorfahre“, die Semantik „gegen diesen Stand wurde reviewt“ ist nicht erzwungen | VULNERABLE (Spezialfall von C-08) |
| C-10 | Base enthält nicht akzeptierte Arbeit eines anderen Tasks, ohne Dependency zu deklarieren | blockiert | Nur *deklarierte* Dependencies werden geprüft. Real: FORGE-CORE-0001A `baseCommit = e9cb8e2` (TASK-0004, Review ausstehend) | **VULNERABLE, HOCH**, GIT |
| C-11 | Dependency nach Approval gegen anderen Commit tauschen | abgelehnt | Approval prüft `acceptedCommit` exakt; akzeptierte Tasks sind terminal | PROTECTED |
| C-12 | Zwei verschiedene Texte als „v2“ registrieren | zweiter abgelehnt | `CONTRACT_VERSION_NOT_NEXT` | PROTECTED im Log |
| C-13 | Zwei verschiedene `forge/contracts/TASK-X.md` auf zwei Branches | erkannt | Kern sieht Git nicht. Wer welche Datei liest, entscheidet der Agent | TRUST BOUNDARY (heute kein Live-Fall, Blob `334fe6fe…` auf allen Branches gleich) |
| C-14 | Versionierung als Sidecar-Datei (`.v2.md`) | eine Regel | Kern verlangt immer `forge/contracts/<id>.md`; das Repo nutzt `FORGE-CORE-0001B.v2.md`; der Dogfood-Test wurde angepasst, um das Sidecar zu akzeptieren | **INKONSISTENT**, GIT. Kern und Praxis widersprechen sich |
| C-15 | „Patch“ als eigene Task-ID (`FORGE-CORE-0001A-PATCH-0001`) statt v2 von 0001A | eine Task-Identität | Kern kennt keine Patch-Beziehung; `FORGE-CORE-0001A` bleibt als Task mit veralteter Semantik bestehen | INKONSISTENT, GIT |
| C-16 | Chat widerspricht Contract | Contract gilt | Kern sieht keinen Chat. Scope und Checks sind mechanisch, alles andere nicht | TRUST BOUNDARY (siehe Handoff-Audit §7) |
| C-17 | Contract-Prosa widerspricht Contract-Metadaten | eine Quelle | Kern nutzt nur Metadaten. Agenten lesen die Prosa. Beispiel: B v2 §1 „Bei Widerspruch gehen die ausdrücklichen v2-Regeln vor“ ist eine Prosaregel, die der Kern nicht kennt | TRUST BOUNDARY, MITTEL |
| C-18 | Developer verändert Contract während der Arbeit | Verstoß | `SCOPE_VIOLATION`, aber nur wenn der Verifier ehrlich diffed | PROTECTED / TRUST BOUNDARY |
| C-19 | Approval gehört zu anderer Revision | abgelehnt | Approval hängt an `contentHash`; Start sucht Hash im Task | PROTECTED |
| C-20 | Approval-Datei in `forge/approvals/` fälschen | erkannt | Kern liest diese Dateien nie; nur `dogfood.test.ts` vergleicht Hash und `actorType` | TRUST BOUNDARY. Die Datei ist Prosa-Evidenz |
| C-21 | Approval als „human owner“ von einer KI geschrieben | abgelehnt | Akzeptiert. Real: beide `forge/approvals/*.json` haben `actor.actorType: human`, `recordedBy: night-run developer session` | **VULNERABLE, KRITISCH als Prozessmuster**, GIT |
| C-22 | Status im Contract (`status: approved`, `architecture_review: pending…`) | kein Status im Contract | Kern lehnt Format ab (`FRONTMATTER_MISSING`), aber die Agenten haben TASK-0004 trotzdem implementiert, 14 min 53 s nach dem Contract-Commit | VULNERABLE im Pilot, PROTECTED im Kern |
| C-23 | Contract existiert lokal, nicht remote | blockiert | `CONTRACT_NOT_PERSISTED` gegen *vom Developer gelieferte* Refs (`run_started` hat Rolle `developer`) | **TRUST BOUNDARY mit falschem Zeugen**, CODE |
| C-24 | Contract nur auf dem eigenen Scratch-Branch des Developers „persistiert“ | geschützter Ort | Jeder Ref zählt, z. B. `refs/heads/developer-scratch-123` | VULNERABLE, CONFIRMED E-20 |
| C-25 | Contract-Commit ist nicht Vorfahre des Run-Ergebnisses | Run nie verifiziert | `remoteOutcome` verlangt `startedFromCommit ⊑ result` | PROTECTED / TRUST BOUNDARY (Graph) |
| C-26 | Registrierung mit `contractCommit`, an dem eine andere Datei liegt | abgelehnt | Registrierung prüft Text ↔ Commit nicht; erst das Gate vergleicht gegen die gelieferte Beobachtung | TRUST BOUNDARY (Handoff-Audit §3.4) |
| C-27 | Neuer Spec-Autor registriert v2 eines fremden Tasks mit erweitertem Scope | nur berechtigte Autoren | Jeder mit Rolle `spec_author` darf jede Task-ID versionieren; Approval braucht nur eine andere selbst erklärte Identität | VULNERABLE (RT-05-Folge) |
| C-28 | Scope enthält `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `.github/workflows/x.yml`, `src/forge/verification.ts` | Policy-Verbot | Contract parst und ist approvebar | **VULNERABLE, HOCH**, CONFIRMED E-13 |
| C-29 | `requiredChecks` = `[{name:"test", command:"true"}]` | Mindest-Checks | zulässig | VULNERABLE (Policy-Lücke), CONFIRMED E-13 |
| C-30 | Check-Command mit Homoglyph und Bidi-Steuerzeichen (`npm tеst` mit kyrillischem е, U+202E) | abgelehnt oder sichtbar markiert | zulässig; der Reviewer sieht auf dem Handy „npm test“ | VULNERABLE (Darstellung), CONFIRMED E-13b |
| C-31 | Check-Command als Shell-Injection gegen den Verifier (`npm test && curl … \| sh`) | Verifier führt nur erlaubte Commands aus | Der Kern definiert nicht, wie der Verifier Commands ausführt; der Contract-Autor bestimmt beliebige Shell | TRUST BOUNDARY, HOCH sobald ein Runner existiert |
| C-32 | `mutationSmoke: optional` | sinnvolle Zusicherung | Developer liefert `[]` → besteht. `optional` ist faktisch `none` | DESIGN-SCHWÄCHE, CODE |
| C-33 | `mutationSmoke: required` mit einem trivialen Mutanten (`delete-entire-file`, detected) | echte Prüfung | besteht | **VULNERABLE, HOCH**, CONFIRMED E-05 |
| C-34 | Windows-Checkout mit CRLF hasht anders | gleicher Hash | Parser lehnt CR ab (fail-closed), real passiert, kein `.gitattributes` | MITIGATED im Kern, Betriebsrisiko GIT |
| C-35 | Einzelnes Surrogat per JSON-Escape im Command | abgelehnt | akzeptiert (RT-13) | bekannt, NIEDRIG |
| C-36 | TOCTOU: neue Version zwischen Gate-Anzeige und `run_started` | Start blockiert | Gate wird in `run_started` neu berechnet → `START_NOT_ALLOWED` | PROTECTED (positiv hervorzuheben) |
| C-37 | Supersession während laufendem Run | Run abbrechen | Run läuft weiter, endet wirkungslos `verified` | RT-07 (bekannt) |
| C-38 | Contract-Text 50 MB, Report 50 MB | Größenlimit | akzeptiert (E-18: 50 MB `deviations` in 30 ms), Log wächst unbegrenzt | VULNERABLE (DoS), NIEDRIG heute |

### 4.1 Kritischer Befund im Detail: C-08/C-10 (ungeprüfter Code im Startpunkt)

**Mechanik.** `canStartDeveloperRun` (`start-gate.ts:90-97`) prüft: Contract-Commit erreichbar, Base erreichbar, `base ⊑ contractCommit`, deklarierte Dependencies `⊑ base`. Gestartet wird bei `contractCommit` (`start-gate.ts:100`). Die Scope-Prüfung bewertet nur Änderungen nach `startedFromCommit`. Alles, was zwischen `baseCommit` und `contractCommit` liegt, wird weder vom Architektur-Review (das den Contract-Text gegen die Base liest) noch von der Verifikation gesehen.

**Gegenbeispiel (E-12).** Graph `contract → EVIL → base`. Approved Contract mit `baseCommit = base`. Start-Request mit dieser Beobachtung → `{ allowed: true, startFromCommit: contract }`.

**Reale Ausprägung (GIT).**
- FORGE-CORE-0001A: `baseCommit = e9cb8e2` = TASK-0004-Implementierung. Deren Contract sagt `architecture_review: pending_chatgpt_final_check`, ein Approval-Record existiert nicht. Der gesamte Forge-Core steht auf ungeprüftem Mystery-Code.
- FORGE-CORE-0001B: `baseCommit = 8cae4cc`, Contract-Commit `e1df55a`, dazwischen `ede729f` (Koordinationsnotiz). Harmlos, zeigt aber, dass die Lücke im Alltag entsteht.

**Minimale Regel:** `diff(baseCommit, contractCommit)` darf nur die Contract-Datei (und `forge/coordination/<eigene Datei>`) enthalten, *oder* `baseCommit` muss ein akzeptierter bzw. auf `main` gemergter Commit sein. Für V0.1 einfacher: `baseCommit` muss Vorfahre von `main` sein und der Contract-Commit muss direktes Kind sein.

### 4.2 Kritischer Befund im Detail: C-21 (Approval im Namen des Owners)

Beide Approval-Records nennen `actor: {actorType: "human", label: "owner"}` und `recordedBy: night-run developer session`. Die `basis`-Texte sind ehrlich („No line-by-line owner review“, „decisions F8-F12 … were NOT reviewed“). Der Kern und der Dogfood-Test werten aber nur `actor.actorType === "human"` aus. Wer die Basis nicht liest, sieht eine menschliche Freigabe. Das ist exakt das Muster, das ein kompromittierter Agent nutzen würde, nur ehrlich beschriftet.

**Regel:** Eine Owner-Entscheidung darf nur aus einer authentifizierten Owner-Aktion entstehen (GitHub-Review oder Kommentar von `Wuerfelduell`, siehe Abschnitt 17), nie aus einer Datei, die ein Agent committet.

---

## 5. Eventlog / Replay

### 5.1 Ist-Zustand

- `ForgeState.log` ist ein Array geparster Events. Persistiert wird nichts (v2 §7: „ForgeLog is authoritative“, aber es gibt keinen Speicher).
- Event-Umschlag: `{ actor, role, recordedAt, body }`. **Kein** `eventId`, **keine** Sequenznummer, **kein** `prevHash`, **kein** `schemaVersion`, **keine** Kernel-Version, **keine** Policy.
- `replay(events)` ist deterministisch für gegebene `(events, policy, sha256)`. `applyEvent` vertraut dem übergebenen Zustand (RT-10).

### 5.2 Gegenbeispiele

| ID | Angriff / Situation | Ergebnis | Status |
|---|---|---|---|
| L-01 | **Policy nicht im Log.** Derselbe Log, unter `different_identity` erzeugt, wird unter `different_provider` replayed | `different_identity`: `accepted`. `different_provider`: Replay bricht bei Index 7 mit `REVIEWER_NOT_INDEPENDENT` ab | CONFIRMED E-07. Deterministisches Replay gilt nur, wenn die Konfiguration außerhalb des Logs gleich bleibt |
| L-02 | **Kernel-Upgrade.** Log mit doppelten Check-Einträgen, unter dem Claude-Kernel (`be40a68`) als `accepted` replaybar | v2-Kernel: `EVENT_SCHEMA` bei Index 6, Pfad `body.evidence.checks.1.name` | CONFIRMED E-24. Ebenso alte Single-Path-Renames. Ein Kernel-Upgrade macht Historie unlesbar |
| L-03 | **Bewertung wird bei jedem Lesen neu berechnet.** `runState` ruft `evaluateVerification` mit den *aktuellen* Regeln auf | Ein unter alten Regeln `verified` Run kann unter neuen Regeln `failed` sein, ohne dass sich der Log ändert | CODE `state.ts:199`. v2 §8 nimmt das bewusst in Kauf („Keine Zeitreise-/Legacy-Regel“) |
| L-04 | **Truncation.** Letztes Event (`request_changes`) abschneiden, dann approvt ein anderer Reviewer | `rework_required` wird zu `accepted` | CONFIRMED E-08. Ohne Hash-Kette oder externen Anker nicht erkennbar |
| L-05 | **Doppelte Zustellung** desselben Reports bzw. derselben positiven Beobachtung | `RUN_STATE_INVALID` (Report), `RUN_STATE_INVALID` (zweite Beobachtung nach `remote_verified`) | CONFIRMED E-16. Ein Duplikat ist vom echten Konflikt nicht unterscheidbar. Ein Appender, der Ablehnungen als Fehler behandelt, bricht bei jedem Webhook-Retry |
| L-06 | Doppeltes negatives `remote_observed` | akzeptiert, zweimal im Log | CODE. Harmlos, zeigt aber: Ohne Event-ID entscheidet die Semantik, ob ein Duplikat schadet |
| L-07 | Reihenfolge vertauscht (Report vor Start) | abgelehnt, Replay bricht ab | MITIGATED (Tests vorhanden) |
| L-08 | Manipulierte Projection (`tasks[0].acceptance` gesetzt) | `applyEvent` arbeitet weiter darauf | RT-10, DESIGN LIMIT. Nur gefährlich, wenn jemand Zustände speichert. Regel: nie |
| L-09 | Partial Replay (Präfix) | liefert den damaligen Zustand korrekt | PROTECTED (positiv): Zeitreise ist eine Präfix-Operation |
| L-10 | Inkompatibles zukünftiges Event (`type: "task_withdrawn"`) im Log, alter Kernel liest | `EVENT_SCHEMA`, gesamter Replay abgebrochen | CODE. Fail-closed, aber ohne Diagnose „neuere Version“ |
| L-11 | Replay-Kosten | 100 k Events 40,8 s; inkrementell 6 k Events 136 s (PERF-2b) | bekannt. Für Pilot irrelevant, für einen Server mit `applyEvent` pro Request nicht |
| L-12 | Ein abgelehntes Event steht in einem gespeicherten Log | gesamter Replay scheitert ab diesem Index | CODE. Der Log darf nur akzeptierte Events enthalten; wer das garantiert, ist undefiniert |

### 5.3 Recovery nach Abbrüchen (Kernsicht)

| Abbruch | Was der Log weiß | Was fehlt |
|---|---|---|
| Worker stirbt vor Report | Run `running` | Heartbeat, Lease, Zeit. Nur Owner kann `WORKER_LOST` setzen |
| Push abgebrochen | Run `running` oder `reported` mit nicht enthaltenen Beobachtungen | Observer, der aktiv nachsieht |
| Verifier stirbt | Run `remote_verified` | Event „verification gestartet“, Timeout, Retry-Zähler |
| Push erfolgreich, Report verloren | Run `running`; ein gepushter Commit, der keinem Run gehört | Zuordnung Ref ↔ Run (bewusst nicht aus Ref-Namen) |

### 5.4 Empfehlung (minimal, ohne Datenbank)

1. **Genesis-Event** als erste Zeile: `{forgeLogFormat: 1, kernelRules: "0001B-v2", policy: {...}, repo: "Wuerfelduell/Forge"}`. Replay liest Policy und Regelversion aus dem Log, nicht aus der Konfiguration.
2. **Umschlag** je Event: `seq` (lückenlos), `eventId` (vom Erzeuger, Idempotenzschlüssel), `prevHash` = SHA-256 des vorherigen Umschlags. Gleiche `eventId` mit gleichem Inhalt = No-op; gleiche `eventId` mit anderem Inhalt = Alarm.
3. **Regelversion je Run einfrieren:** `run_started` notiert die Regelversion; `evaluateVerification` dispatcht danach. Alte Logs bleiben replaybar.
4. **Externer Anker:** Der Log liegt als JSONL in Git (eigener Branch oder eigenes Repo), geschrieben nur von einem Workflow mit eigener Identität. Git-Historie plus `prevHash` macht Truncation sichtbar.
5. Kein Snapshot-Speicher, keine Projektion persistieren. Replay ist bei Pilotgrößen (unter 10 k Events) schnell genug.

---
## 6. Agent Security

Annahme: Developer-Agenten sind untrusted. Sie bekommen Schreibrechte auf einen Branch und führen Code aus. Verifier und Reviewer lesen Artefakte, die der Developer erzeugt hat.

### 6.1 Was heute im Pilot tatsächlich gilt (GIT)

- **Identitäten:** Claude committet als `Claude <noreply@anthropic.com>`, Codex als `Diceduel <315180734+Wuerfelduell@users.noreply.github.com>`, also mit Sebs GitHub-Konto. Der erste Commit `.gitkeep` ist von Seb selbst über die Weboberfläche. INFERRED: Codex läuft lokal auf Sebs Windows-Rechner mit Sebs Git-Credentials und darf damit alles, was Seb darf, inklusive Push auf `main` (Branch-Protection nicht geprüft, `main` hat keinen Schutzbedarf erzeugt, weil er leer ist).
- **Rollentrennung:** Eine Claude-Session hat Developer-, Spec-, Red-Team- und Reviewer-Rollen gleichzeitig. Sie hat außerdem die Approval-Records des Owners geschrieben.
- **Ausführbare Evidence:** `FORGE-CORE-0001B.v2.verification.md` §7 fordert Reviewer auf, Code aus `forge/reviews/FORGE-CORE-0001B.v2.mutations.json` per `eval(evidence.runnerTemplate…)` auszuführen. Der Inhalt ist harmlos (geprüft), aber das Muster „Reviewer führt Code aus, den der Developer als Evidence eingecheckt hat“ ist genau der Weg, über den ein kompromittierter Developer in die Reviewer-Umgebung kommt.

### 6.2 Bedrohungsmatrix

Spalten: **Forge** = durch Kernel-Regeln oder Forge-eigene Prüfungen verhinderbar. **Plattform** = durch GitHub-Einstellungen (Branch-Protection, Rulesets, getrennte Identitäten) verhinderbar. **Sandbox** = nur durch Ausführungsisolation verhinderbar.

| # | Bedrohung | Heute | Forge | Plattform | Sandbox |
|---|---|---|---|---|---|
| A-01 | Prompt Injection aus Repo-Dateien (`forge/coordination/*.md`, `forge/reviews/*.md`, Kommentare im Code) | offen. Coordination ist ohne Scope für jeden Run schreibbar, und Agenten lesen sie als Kontext (CLAUDE.md, CODEX.md) | Coordination-Ausnahme auf `forge/coordination/<rolle>.md` verengen; Kontext-Manifest (Abschnitt 10) markiert Repo-Inhalt als untrusted | – | – |
| A-02 | Prompt Injection aus Issues, PR-Kommentaren | heute kein Kanal; mit GitHub-Integration sofort | Agent bekommt Issues nur als zitierte, untrusted Daten | Kommentare nur von bekannten Logins auswerten | – |
| A-03 | Prompt Injection aus generierten Spielinhalten | heute kein Pfad zu einem LLM (Projektion gibt nur Handles und Enums aus, TASK-0005 schließt LLM aus) | Freitextfelder (`name`, `description`, `kind`) bleiben aus Prompts draußen, bis ein Verbalizer-Task das explizit regelt | – | – |
| A-04 | Secret-Exfiltration durch Testcode im Verifier | offen. `forge/coordination/notes.test.ts` wird von `npm test` ausgeführt und liest `process.env` (VX-01) | Coordination nur `.md`; Scope-Verbot für ausführbare Dateien außerhalb des Contracts | Verifier-Job ohne Secrets, `permissions: contents: read` | Netzwerk-Egress sperren |
| A-05 | Workflow-Manipulation (`.github/workflows/*`) | kein Workflow vorhanden; Scope könnte ihn erlauben (C-28) | `.github/` als immer verbotenes Präfix | Workflows nur von `main` (`workflow_dispatch` mit Ref `main`); CODEOWNERS | – |
| A-06 | Git-Config-Manipulation (`.gitattributes` mit Filtern, `.gitmodules`, Hooks) | `.gitattributes` / `.gitmodules` per Scope erlaubbar; `.git/hooks` ist nicht versioniert | Verbotene Pfade: `.gitattributes`, `.gitmodules`, `.github/`, `.npmrc`, `package.json`, Lockfiles (nur mit ausdrücklicher Contract-Freigabe) | – | Verifier klont frisch ohne lokale Config |
| A-07 | Branch-Manipulation (Push auf `main`, auf fremde Run-Branches, Force-Push) | möglich, solange Agenten Schreibrechte haben | `claimedRemoteRef` muss `forge/run/<runId>` sein | Rulesets: `main` nur via PR, Force-Push verboten, Agenten nur auf `forge/run/*` | – |
| A-08 | Tests manipulieren, Assertions entfernen | möglich für jede Testdatei im Scope | Testinventar: Anzahl Tests und Skips je Datei gegenüber Startcommit dürfen nicht sinken, außer der Contract erlaubt es namentlich | – | – |
| A-09 | Snapshot-Tests blind aktualisieren | heute keine Snapshots im Repo | `__snapshots__/` und `*.snap` nur mit Contract-Freigabe | – | – |
| A-10 | Verifier täuschen (Testkonfiguration, Skips, `vitest.config.ts`) | möglich, CONFIRMED VX-03, VX-04 | Testkonfiguration verboten; Evidence enthält Anzahl ausgeführter, übersprungener, fehlgeschlagener Tests | – | – |
| A-11 | DeveloperReport fälschen | Report ist Selbstauskunft und wird nur für Mutationen *wirksam*, wenn der Verifier `mutations: null` liefert | Developer-Mutationen nie als Evidence zählen | – | – |
| A-12 | MutationReport fälschen | möglich (E-05, E-06) | Mutationsliste im Contract, Ausführung im Verifier | – | – |
| A-13 | RemoteRef vortäuschen | Observer- und Verifier-Rolle selbst erklärt (E-02), Graph frei erfindbar (E-04) | Beobachtungen nur aus dem Forge-eigenen Observer | Observer läuft als Workflow mit eigener Identität | – |
| A-14 | Riesige Diffs, Riesenreports | keine Limits (E-18) | Limits für Report- und Evidence-Größe, Anzahl geänderter Dateien je Contract | – | Ressourcenlimits |
| A-15 | Symlinks | Kern kennt keine Dateitypen; ein Symlink `src/a.ts → ~/.ssh/id_rsa` ist „added“ | Evidence mit Git-Mode; Mode `120000` und `160000` (Submodule) nur mit Contract-Freigabe | – | Verifier folgt keinen Symlinks aus dem Checkout heraus |
| A-16 | Path Traversal | `..`, `.`, Backslash, absolute Pfade scheitern am `RepoPathSchema` | MITIGATED | – | – |
| A-17 | Unicode-Pfadtricks | `RepoPath` ist ASCII-only → MITIGATED für Pfade. Gegenseite: Eine Datei mit Nicht-ASCII- oder Leerzeichen-Namen macht die Evidence undarstellbar und den Run unbeendbar (E-10) | eigener Failure-Code `CHANGED_PATH_NOT_REPRESENTABLE`, der den Run `failed` macht | – | – |
| A-18 | Case Sensitivity (`src/A.ts` vs `src/a.ts`, `Forge/contracts/…`) | exakter Vergleich, geschützte Präfixe case-sensitiv. Ein Scope-Eintrag `forge/Contracts/TASK-0005.md` würde auf macOS/Windows die echte Contract-Datei überschreiben | Präfixprüfung case-insensitiv; Scope ohne zwei Pfade, die sich nur in Groß-/Kleinschreibung unterscheiden | – | – |
| A-19 | Windows/Linux-Unterschiede (reservierte Namen `CON`, `aux.ts`, Trailing Dot `a.` → `a`) | `RepoPath` erlaubt `aux.ts`, `a.` | Windows-reservierte Namen und Trailing Dot/Space ablehnen | – | – |
| A-20 | CRLF | Kern lehnt CR im Contract ab; Vorfall real (2.4) | `.gitattributes` `* text=auto eol=lf` (Repo-Hygiene) | – | – |
| A-21 | Generated Files | kein Konzept | Generierte Dateien nie committen oder im Verifier regenerieren und diffen | – | – |
| A-22 | Binary Files | als „added/modified“ ununterscheidbar | Binärdateien nur mit Contract-Freigabe; Evidence mit Größe | – | – |
| A-23 | `npm ci` führt Lifecycle-Scripts aus (`postinstall` der eigenen `package.json` und aller Dependencies) | wenn `package.json`/Lockfile im Scope: beliebiger Code vor den Tests | `package.json`, Lockfile nur mit ausdrücklicher Freigabe; Verifier `npm ci --ignore-scripts` | – | ohne Secrets, ohne Netz nach Install |
| A-24 | Evidence beeinflusst durch Testcode im selben Prozess oder Job | Testcode kann Dateien schreiben, die ein späterer Schritt als Ergebnis liest (z. B. `$GITHUB_OUTPUT`, `$GITHUB_ENV`) | Ergebnis nur aus Exit-Status des Runners lesen | Je Check ein eigener Job; Aggregation in einem Job, der keinen Developer-Code ausführt | – |
| A-25 | Developer verändert den Forge-Kern selbst | Mystery- und Forge-Code teilen sich Repo, `package.json`, Testrunner | `src/forge/**`, `tests/forge*/**` für Nicht-Forge-Tasks verboten | Langfristig getrenntes Forge-Repo | – |
| A-26 | Agent nutzt fremde Identität | Codex nutzt Sebs Konto | – | **Eigene GitHub-Identität je Agent** (Codex: eigener Bot-Account oder Fine-grained-Token) | – |

### 6.3 Trennung

**Forge selbst kann verhindern (ohne Sandbox):** verbotene Pfade (A-05, A-06, A-08 teilweise, A-10, A-23, A-25), Pfadform (A-16 bis A-19), Evidence-Vollständigkeit (Diff-Basis, Testinventar, Modes), Mutationsauswahl im Contract, Limits, Idempotenz, eigene Failure-Codes für undarstellbare Evidence.

**Plattform (GitHub) muss verhindern:** Push auf `main`, Force-Push, Workflow-Änderungen mit Wirkung, Identitätsvermischung, Secrets im Verifier.

**Sandbox muss verhindern:** Exfiltration über Netzwerk, Ressourcenmissbrauch, Ausbruch über Symlinks oder Lifecycle-Scripts, Manipulation von Runner-Dateien.

**Nicht verhinderbar, nur begrenzbar:** semantisch falscher Code innerhalb des Scopes. Dafür gibt es Review und Mutationstests, nicht mehr.

---

## 7. Verification

### 7.1 Wie die Verifikation heute funktioniert

`evaluateVerification(metadata, report, evidence)` prüft drei Dinge über Daten, die ein Verifier liefert:
1. für jeden `requiredCheck` genau ein Eintrag mit gleichem Namen, gleichem Command-String und Exit 0;
2. jeder Pfad in `changedFiles` gegen Scope und Schutzregeln;
3. Mutationen: Verifier-Liste, sonst Developer-Liste.

Der Kern führt nichts aus und liest kein Git. Es gibt keinen Verifier-Prozess. `method: "fresh_clone"` ist ein Literal, das niemand prüft.

### 7.2 Adversariale Szenarien

| # | Szenario | Ergebnis | Status |
|---|---|---|---|
| V-01 | Verifier = Developer (gleiche Identität) | akzeptiert, `verifierIndependence` nur als Projektion | CONFIRMED E-02, DESIGN LIMIT (Architekturentscheidung 2) |
| V-02 | Leere `changedFiles` bei Ergebnis ≠ Start | `verified` | **CONFIRMED E-09, KRITISCH** |
| V-03 | `changedFiles` nur aus dem letzten Commit (Diff `HEAD~1..HEAD`), frühere Commits enthalten Scope-Verstöße | `verified`; Evidence trägt keine Diff-Basis | CODE + E-09, KRITISCH |
| V-04 | Rename über die Schutzgrenze | beide Enden Verstoß | MITIGATED (`811ed0d`) |
| V-05 | Rename innerhalb `forge/coordination/` (`CODEX.md → archive/CODEX.md`) | erlaubt. Effektiv eine Löschung der fremden Logdatei am kanonischen Pfad, obwohl Löschungen dort seit v2 verboten sind | **CONFIRMED E-11, neue Variante von RT-01/02** |
| V-06 | Fremde Koordinationsdatei vollständig überschreiben (`modified`) | erlaubt | CONFIRMED E-11. Das Löschverbot ist damit kosmetisch |
| V-07 | Ausführbare Testdatei unter `forge/coordination/` | Scope erlaubt sie; `npm test` führt sie aus | **CONFIRMED E-11 + VX-01, HOCH** |
| V-08 | Pseudo-Approval unter `forge/coordination/approvals/TASK-0001.json` | erlaubt | CONFIRMED E-11. Täuscht Menschen und Agenten, nicht den Kern |
| V-09 | Doppelte Check-Namen | `EVENT_SCHEMA` | MITIGATED (RT-03-Fix) |
| V-10 | Required Check mit anderem Command (`npm test ` mit Leerzeichen) | `CHECK_FAILED` | MITIGATED |
| V-11 | Gleicher Command-String, ausgehöhlte Semantik über `vitest.config.ts` (`include` auf eine Datei) | Exit 0, 19 statt 1086 Tests | **CONFIRMED VX-03, KRITISCH** wenn die Datei im Scope liegt |
| V-12 | `describe.skip` / `it.skip` / `it.todo` in einer Scope-Testdatei | Exit 0 | **CONFIRMED VX-04, HOCH** |
| V-13 | `"test": "exit 0"` in `package.json` (im Scope) | Exit 0 bei identischem Command `npm test` | CODE (trivial), KRITISCH wenn `package.json` im Scope |
| V-14 | `process.exit(0)` aus einem Test | Vitest fängt ab, Exit 1 | **NOT REPRODUCED** (VX-02) |
| V-15 | Exit-Code eines durch Signal beendeten Prozesses | Schema verlangt `int`; ob `null` → 0 gemappt wird, entscheidet der Verifier | TRUST BOUNDARY |
| V-16 | Check-Reihenfolge: Test läuft vor Typecheck und ändert `tsconfig.json` auf der Platte | späterer Typecheck sieht geänderte Config | TRUST BOUNDARY (Runner); Regel: jeder Check in frischem Checkout |
| V-17 | `mutationSmoke: required`, Verifier liefert `mutations: null`, Developer liefert einen trivialen detected-Mutanten | `verified` | **CONFIRMED E-05, HOCH** |
| V-18 | Alle überlebenden Mutanten als `equivalent` mit Rationale „.“ | `verified`, Review muss die Namen nur quittieren, Abnahme möglich | **CONFIRMED E-06, HOCH** |
| V-19 | Verifier liefert `mutations: []` bei `optional`, Developer hatte überlebende Mutanten gemeldet | Developer-Befund verschwindet | RT-04 (bekannt) |
| V-20 | Verifier liefert eigene leere Liste bei `required` | `MUTATION_EVIDENCE_INVALID` | MITIGATED |
| V-21 | Mutationsname mit Unicode-Lookalike, um Quittung zu umgehen | Quittung muss exakt gleich sein, also keine Umgehung, aber auch keine Lesbarkeit | MITIGATED / NIEDRIG |
| V-22 | Fremdes Ergebnis: Developer meldet einen Commit, den er nicht gebaut hat (z. B. Ergebnis eines anderen Tasks) | Kern prüft nur Ancestry; Scope-Diff deckt es nur bei ehrlichem Verifier auf | TRUST BOUNDARY |
| V-23 | Erfundene Parent-Kanten machen ein beliebiges Ergebnis `contained` | `verified` | CONFIRMED E-04 (bekannt aus Red-Team §4) |
| V-24 | Ergebnis-Head wandert nach der Verifikation weiter (unverifizierte Commits oben drauf), Mensch merged den Branch statt des SHA | Kern akzeptiert den verifizierten SHA; der Merge-Schritt existiert nicht | **CONFIRMED E-15, HOCH sobald gemerged wird** |
| V-25 | Datei mit Leerzeichen oder Nicht-ASCII-Namen | Evidence undarstellbar, Run hängt | **CONFIRMED E-10, MITTEL (DoS)** |
| V-26 | Symlink oder Submodul als „added“ | nicht unterscheidbar | CODE, MITTEL |
| V-27 | Leerer Run (Ergebnis = Start) | zulässig | R11 (bekannt) |
| V-28 | Nicht erforderliche Checks mit Exit ≠ 0 | ignoriert | MITIGATED (gewollt), aber im Mobile-UI muss das sichtbar sein |
| V-29 | Verifikation einer Umgebung, die nicht dem Contract entspricht (Node 24 vs `engines >=22`, npm 12 vs 10) | Evidence enthält keine Umgebung | CODE, NIEDRIG. Real: Codex verifiziert unter Node 24.19, dieser Audit unter Node 22.22 |

### 7.3 Neue RT-01/03-Varianten (Kurzform)

- **RT-01b:** Löschen per Rename innerhalb von Coordination (V-05).
- **RT-01c:** Überschreiben statt Löschen (V-06).
- **RT-01d:** Ausführbarer Code per Coordination-Ausnahme (V-07).
- **RT-03b:** Checks nicht doppelt, sondern hohl: gleicher Command, andere Semantik über Konfiguration oder Skips (V-11 bis V-13).
- **RT-03c:** Mutationsevidence nicht doppelt, sondern billig: Ein trivialer Mutant erfüllt `required` (V-17).

### 7.4 Minimale Reparatur der Verification (Contract-Änderungen, nicht hier umgesetzt)

1. Evidence trägt `diffBase` und der Kern verlangt `diffBase == startedFromCommit`. Der Verifier diffed mit `--no-renames` (dann reicht `added/modified/deleted`) und meldet Git-Modes.
2. Evidence trägt je Check `{testsRun, testsSkipped, testsFailed}` für Testkommandos, plus den Hash der Testkonfiguration. Regel: `testsRun` nicht unter Startcommit-Baseline, `testsSkipped` nicht darüber, außer der Contract erlaubt es.
3. Immer verbotene Pfade erweitern: `.github/`, `.gitattributes`, `.gitmodules`, `.npmrc`, `package.json`, `package-lock.json`, `tsconfig*.json`, `vitest.config.*`, `src/forge/`, `tests/forge*/`, `forge/` (außer der eigenen Koordinationsdatei). Ausnahmen nur über ein eigenes Contract-Feld `protectedPathOverrides` mit Begründung, das der Architektur-Reviewer sehen muss.
4. Mutationsliste wird Teil des Contracts (`mutationSmoke.required: [{id, file, description}]`), ausgeführt vom Verifier. Developer-Mutationen zählen nie als Evidence.
5. Coordination-Ausnahme: nur `forge/coordination/<rollen-datei>.md`, nur `added/modified`.
6. Failure-Code `EVIDENCE_NOT_REPRESENTABLE`, der den Run `failed` macht statt ihn hängen zu lassen.
7. Verifier ≠ Developer wird Pflicht, sobald der Verifier ein Workflow ist (Abschnitt 17). Dann ist die Bedingung billig erfüllbar.

---

## 8. Review

### 8.1 Rollen und Unabhängigkeit heute

| Paar | Geprüft? | Regel |
|---|---|---|
| Spec-Autor ↔ Architektur-Reviewer | ja | `isIndependentReviewer` gemäß Policy |
| Developer ↔ Code-Reviewer | ja | `isIndependentReviewer` gemäß Policy |
| Developer ↔ Verifier | **nein** | nur Projektion |
| Developer ↔ Observer | **nein** | – |
| Developer ↔ Architektur-Reviewer des eigenen Contracts | **nein** | E-14: der Developer darf den Contract freigeben, den er implementiert |
| Code-Reviewer ↔ Verifier | **nein** | – |
| Code-Reviewer ↔ Autor der Dependencies | **nein** | real: Claude reviewte TASK-0005, das auf Claudes TASK-0004 aufbaut |
| Owner ↔ alle | `actorType == human` | selbst erklärt |

`different_identity`: ein anderes `label` genügt. `different_provider`: ein anderer Slug genügt (`vendor-a2`). Beides ist RT-05 und bleibt so lange wirkungslos, wie Events nicht authentifiziert sind.

### 8.2 Wege zur Abnahme trotz ungelöster Findings

| # | Weg | Status |
|---|---|---|
| R-01 | **Reviewer-Shopping auf demselben Commit:** `request_changes` (blocking) → neuer Run mit identischem `claimedResultCommit` → anderer Reviewer `approve` → `accepted` | CONFIRMED E-01 |
| R-02 | **Derselbe Reviewer kippt** beim zweiten Run desselben Commits | CONFIRMED E-22 |
| R-03 | **Log-Kürzung** entfernt das `request_changes` | CONFIRMED E-08 |
| R-04 | Reviewer stuft ein echtes Problem als `non_blocking` ein und approvt | erlaubt (Bewertung ist Ermessen) |
| R-05 | `request_changes` mit `contract_change` → neue Contract-Version mit erweitertem Scope → neues Approval → neuer Run; Findings werden nirgends übertragen | CODE |
| R-06 | Architektur-Findings `non_blocking` erreichen nie den Developer oder Code-Reviewer (keine Projektion, kein Pflichtfeld) | CODE |
| R-07 | Äquivalenz-Quittung ist reines Echo der Namen; es gibt keine Form „Äquivalenz bestritten“ außer `request_changes` | CODE, siehe E-06 |
| R-08 | Review wird auf dem verifizierten SHA abgegeben, gemerged wird später der Branch-Head | CONFIRMED E-15 (Kern), Merge existiert nicht |
| R-09 | Spec-Autor registriert direkt vor der Abnahme eine neue Version (setzt `review_approved` zurück), Gegenrichtung: Blockade | CONFIRMED E-17 |
| R-10 | Reviewer = Verifier; Reviewer, der den eigenen Check „gesehen“ hat | erlaubt | 

### 8.3 Empfehlung

- **Findings-Ledger:** Jedes Finding bekommt eine ID `F-<task>-<n>`. Ein `code_review_recorded(approve)` auf einem Run, dessen Task offene blocking Findings hat, muss jede offene ID mit `resolved_in: <commit>` oder `withdrawn: <Begründung>` adressieren.
- **Rework muss etwas ändern:** Ein Run nach `request_changes(code_change)` darf nicht denselben `claimedResultCommit` melden wie der abgelehnte Run (oder es braucht ausdrücklich `re_review_same_commit` durch den Owner).
- **Reviewer-Zuweisung durch Forge, nicht durch Selbstauswahl:** Der Run bekommt beim Start den zuständigen Reviewer; nur dieser darf das Verdict schreiben. Wechsel nur durch den Owner.
- **Unabhängigkeit an echte Identitäten binden** (GitHub-Login je Agent) und zusätzlich verbieten: Reviewer = Developer, Reviewer = Verifier, Architektur-Reviewer = Developer desselben Tasks.
- **Mehr nicht.** Keine Mehrfach-Reviews, keine Reviewer-Reputation, keine Quoren. Der Pilot zeigt genau einen Fall, in dem ein unabhängiger Review etwas gefunden hat, das der Self-Review übersah (TASK-0005 B1/J1). Ein Reviewer pro Run ist gerechtfertigt, mehr nicht.

---

## 9. Parallelization

### 9.1 Szenario: TASK-A und TASK-B starten vom gleichen Base, A wird zuerst abgenommen

**Was der Kern heute tut (CODE):**
- Beide Runs sind erlaubt (ein aktiver Run *pro Task*).
- A wird `accepted` mit Commit `a1`. B wird unabhängig `accepted` mit Commit `b1`. Beide Commits haben denselben Parent. Der Kern kennt kein `main`, also gibt es keinen Konflikt, keine Staleness und keinen Merge.
- Hat B eine *deklarierte* Dependency auf A, kann B gar nicht approved werden, bevor A akzeptiert ist, und B muss danach einen neuen Contract mit `baseCommit` ⊒ `a1` bekommen. Das ist korrekt, aber seriell.
- Ohne deklarierte Dependency gilt B als fertig, obwohl `a1 + b1` nie zusammen gebaut, getestet oder reviewt wurde.

**Was in Git passiert (GIT, heute schon):** Zwei Codex-Branches kollidieren in `forge/coordination/CODEX.md`. Kein Branch enthält Core-Reparatur und Mystery-Fortschritt zusammen.

### 9.2 Konfliktklassen

| Klasse | Beispiel | Heute erkannt? |
|---|---|---|
| Stale base | B basiert auf einem Stand ohne A | nein |
| Überlappende Dateien | beide modifizieren `src/domain/case-truth.ts` | nein (Scopes werden nicht gegeneinander geprüft) |
| Semantischer Konflikt ohne Dateiüberlappung | A ändert eine API, B nutzt sie in neuer Datei | nein; nur ein Lauf auf `a1+b1` findet das |
| Shared contracts | B referenziert Verhalten aus A-Contract v1, A wird v2 | nein (TASK-0001a-Vorfall: TASK-0002-Revision änderte zugesagte TASK-0001-Semantik) |
| `package.json`, Lockfile | beide fügen Abhängigkeiten hinzu | nein; Lockfile-Merge ist nie textuell sicher |
| Generierte Dateien | beide regenerieren | nicht relevant heute |
| Migrationen | zwei Schema-Versionen 2 | nicht relevant heute (keine Persistenz) |
| Koordinationsdateien | CODEX.md add/add | real passiert |

### 9.3 Minimaler sicherer Mechanismus (kein Scheduler)

1. **Ein Integrationszweig.** `main` ist geschützt. „Accepted“ heißt in V0.1: als PR in `main` gemerged, und zwar genau der verifizierte SHA.
2. **Up-to-date-Regel.** Ein Run darf nur gemerged werden, wenn sein Ergebnis `main`-Head als Vorfahren hat. Sonst Zustand `stale`. GitHub erzwingt das mit „Require branches to be up to date before merging“ plus Required Check = Forge-Verifier. Das ist dieselbe Regel, die der Kern mit `remoteOutcome` schon für den Start kennt, nur auf `main` angewandt.
3. **Rebase-Run statt Neu-Review.** Ein `stale`-Run wird vom Developer auf `main` gebracht (Merge-Commit oder Rebase). Der Verifier läuft erneut. Ein neues Code-Review ist nur nötig, wenn der Diff gegenüber dem reviewten Diff außerhalb von Merge-Auflösungen liegt (`git range-diff` leer → kein Re-Review). Das ist eine Regel, kein System.
4. **Datei-Lease beim Start.** Der Start Gate lehnt ab, wenn ein anderer *aktiver* Run eines anderen Tasks einen Pfad im Scope hat, der auch im eigenen Scope steht (`SCOPE_LEASE_CONFLICT`). Das ist eine Schleife über aktive Runs, kein Scheduler.
5. **Serielle Spur für geteilte Dateien.** `package.json`, Lockfile, `tsconfig.json`, Testkonfiguration, `forge/contracts/**` dürfen nur von einem aktiven Run gleichzeitig verändert werden, egal welcher Task.
6. **Koordinationsdateien je Agent und Track** (`forge/coordination/codex-mystery.md`, `codex-core.md`), oder besser gar nicht mehr im Produktrepo, sondern im Forge-Log (Abschnitt 17).

Mehr braucht V0.1 nicht. Ein Merge-Queue-Feature von GitHub kann Schritt 2 und 3 später automatisieren, ist aber kein Muss für zwei bis drei parallele Tasks.

---
## 10. Context Manifest

### 10.1 Prinzipien (aus dem Pilot abgeleitet)

1. **Identifikatoren statt Inhalte.** Copy-Paste hat im Pilot Contracts abgeschnitten und vermischt (Handoff-Audit Fall 7). Das Manifest enthält nur Repo, Commits, Pfade und Hashes. Inhalte liest der Agent selbst aus Git und quittiert sie mit tool-berechneten Hashes (Handoff-Audit §5 und §6, hier übernommen).
2. **Trusted heißt: vom Owner freigegeben und hash-gebunden.** Alles andere im Repo ist untrusted Daten, auch wenn es wie eine Anweisung aussieht (`forge/coordination/*`, `forge/reviews/*`, Code-Kommentare, Testnamen).
3. **Jede Rolle bekommt nur, was sie für ihre Entscheidung braucht.** Ein Verifier braucht keine Prosa, ein Reviewer keinen Developer-Report als Wahrheit.
4. **Rechte folgen der Rolle, nicht dem Agenten.** Derselbe Agent hat als Reviewer keine Push-Rechte.

### 10.2 Manifest-Format

```yaml
forgeContextManifest: 1
role: developer | designer | verifier | reviewer
runId: run:task-0006-1            # nur developer/verifier/reviewer
repo: Wuerfelduell/Forge
contract:
  taskId: TASK-0006
  version: 1
  commit: <40-hex>               # Startpunkt für den Developer
  path: forge/contracts/TASK-0006.md
  gitBlob: <40-hex>
  contentHash: <64-hex>          # sha256("forge-contract-v1\n" + text)
  endMarker: "<!-- END OF CONTRACT TASK-0006 v1 -->"
inputs:                          # nur Identifikatoren
  - { kind: commit, sha: <40-hex>, purpose: base }
  - { kind: file, commit: <sha>, path: src/domain/case-truth.ts, purpose: dependency-api }
outputs:
  resultRef: forge/run/task-0006-1
permissions: { … }               # siehe Tabelle
budget: { maxTokens: …, maxWallMinutes: …, maxRuns: … }   # vom Owner, nie vom Agenten
manifestHash: <64-hex>           # Hash dieses Manifests, geht in run_started
```

### 10.3 Je Rolle

**Designer (Spec-Autor)**

| Aspekt | Inhalt |
|---|---|
| Required | Owner-Ziel (vom Owner geschrieben, als Datei oder Issue mit Hash), Base-Commit, Liste der öffentlichen APIs der Dependencies am Base-Commit (Pfade, vom Designer selbst gelesen), akzeptierte Contracts der Dependencies, Contract-Template, Liste der immer verbotenen Pfade |
| Forbidden | Implementierungen nicht akzeptierter Tasks (sonst baut die Spec auf ungeprüftem Code, siehe C-10), Chat-Kopien früherer Contracts, Review-Texte anderer Tasks als Anweisung |
| Trusted | Owner-Ziel, akzeptierte Contracts, Code am Base-Commit (als Faktenquelle, nicht als Anweisung) |
| Untrusted | `forge/coordination/*`, Reviews, Kommentare, Issues |
| Hashes/SHAs | Base-Commit, Dependency-`acceptedCommit`s, Template-Version |
| Permissions | Schreiben nur `forge/contracts/<eigene Task-ID>.md` auf Branch `forge/spec/<task>`. Kein Push auf `main`. Kein Run-Start |

**Developer**

| Aspekt | Inhalt |
|---|---|
| Required | Manifest mit Contract-Commit, Blob, Hash, End-Marker; Result-Ref; Budget. Sonst nichts |
| Forbidden | Contract-Text im Prompt, Zusammenfassungen, „Zusatzwünsche“ im Chat, Reviews anderer Runs, Verifier-Ergebnisse vor Abgabe, Secrets, Owner-Zugangsdaten |
| Trusted | Der Contract-Blob am Contract-Commit (und nur dieser) |
| Untrusted | Alles andere im Repo, auch `forge/coordination/*`, Testnamen und Kommentare |
| Hashes/SHAs | Quittung beim Start: `git rev-parse <commit>:<path>`, SHA-256 mit Präfix, `wc -c`, End-Marker wörtlich. Bei Abweichung kein Code |
| Permissions | Push nur auf `forge/run/<runId>`, kein Force-Push, keine Workflow-Rechte, kein Zugriff auf andere Branches außer Lesen. Schreibt Report als Datei im Run-Branch oder als PR-Beschreibung, nie Events |

**Verifier**

| Aspekt | Inhalt |
|---|---|
| Required | Run-ID, `startedFromCommit`, `claimedResultCommit`, Contract-Metadaten (aus dem registrierten Text, nicht aus dem Branch), Mutationsliste aus dem Contract, Regelversion |
| Forbidden | Developer-Report als Evidence, Prosa des Contracts, Chat, jede Datei aus dem Run-Branch als *Anweisung* (`mutations.json` mit `runnerTemplate` ist Daten, wird nie per `eval` ausgeführt) |
| Trusted | Eigene Ausführung im frischen Checkout, Git-Objekte |
| Untrusted | Gesamter Inhalt des Ergebnis-Commits (das ist der Prüfling) |
| Hashes/SHAs | Diff-Basis = `startedFromCommit`, geprüfter SHA, Hash der Testkonfiguration, Lockfile-Hash |
| Permissions | Lesen. Kein Secret, kein Netz nach `npm ci --ignore-scripts`, kein Push. Das Ergebnis schreibt ein separater Schritt, der keinen Prüfling-Code ausführt |

Der Verifier ist in V0.1 kein LLM, sondern ein Workflow. Ein LLM-Verifier ergibt keinen Sinn, solange `requiredChecks` maschinell sind.

**Reviewer (Architektur- oder Code-Review)**

| Aspekt | Inhalt |
|---|---|
| Required (Architektur) | Contract-Blob + Hash, Base-Commit, Liste geänderter Contract-Felder gegenüber Vorversion, offene Findings früherer Versionen |
| Required (Code) | Contract-Blob + Hash, `startedFromCommit..verifiedCommit` als Diff, Verifier-Evidence (Checks, Testinventar, Mutationen), offene Findings des Tasks, Liste der als äquivalent deklarierten Mutanten |
| Forbidden | Developer-Report als Wahrheit (nur als „Developer behauptet“ markiert), Chat-Zusammenfassungen des Developers, Code ausführen, den der Developer als „Reproduktion“ eingecheckt hat |
| Trusted | Contract-Blob, Verifier-Evidence aus dem Forge-Log |
| Untrusted | Developer-Report, `deviations`, `reviewHints`, Commit-Messages, Code-Kommentare |
| Hashes/SHAs | Reviewter Commit = verifizierter Commit; Hash der Evidence |
| Permissions | Lesen; schreibt genau ein Verdict (als PR-Review unter eigener Identität). Kein Push |

### 10.4 Was es nicht braucht

Kein RAG, keine Vektordatenbank, keine automatische Kontextzusammenfassung. Der Pilot zeigt, dass das Problem fehlende Bindung war, nicht fehlende Kontextmenge.

---

## 11. Mobile Control Plane

### 11.1 Was der Benutzer wirklich tun muss

Ausgewertet nach: Wie oft im Pilot nötig, und ist es eine Entscheidung (nur Mensch) oder eine Beobachtung?

| Aktion | Art | Häufigkeit im Pilot | Muss mobil gehen? |
|---|---|---|---|
| Projekt auswählen | Navigation | selten (ein Repo) | ja, trivial |
| Spec / Contract ansehen | Lesen | pro Task 1–3 Mal | ja, aber nur Kopf + Diff zur Vorversion; 600-Zeilen-Contracts liest niemand am Handy |
| Contract freigeben | **Entscheidung** | pro Version | ja |
| Run starten | Entscheidung | pro Run | ja |
| Fortschritt ansehen | Beobachtung | ständig | ja, als Push-Benachrichtigung bei Zustandswechsel |
| Kosten sehen | Beobachtung | täglich | ja, eine Zahl je Task und Tag |
| Findings ansehen | Lesen | pro Review | ja, blocking zuerst |
| Preview öffnen | Lesen | heute nie (kein UI im Spiel) | später |
| Merge / Abnahme | **Entscheidung** | pro Task | ja |
| Kill Switch | **Notfall** | heute nie | ja, ein Tap |
| NEEDS_HUMAN beantworten | Entscheidung | im Pilot ständig (Seb als Relais) | ja, das ist der Hauptfall |

Erkenntnis aus dem Pilot: Sebs Hauptarbeit war **Relais zwischen Agenten** (Copy-Paste, „lies das aus Git“). Das soll ganz verschwinden. Übrig bleiben vier Entscheidungen: Contract freigeben, Run starten, abnehmen, stoppen.

### 11.2 Informationsarchitektur

```text
Inbox (Standardansicht)
 └─ Karten "wartet auf dich": Contract-Freigabe | Abnahme | NEEDS_HUMAN | Budget überschritten
Tasks
 └─ Task
     ├─ Zustand (abgeleitet), aktuelle Contract-Version, Kosten bisher
     ├─ Contract: Metadaten-Kopf, Diff zur Vorversion, offene Findings
     └─ Runs
         └─ Run: Zustand, Commit, Checks (grün/rot, Testanzahl), Scope-Verstöße, Mutationen, Review, Kosten
Stop (immer sichtbar)
```

### 11.3 Minimale Screens

1. **Inbox:** Liste offener Entscheidungen, je Karte eine Zeile Kontext und zwei Buttons.
2. **Task:** Zustand, Contract-Kopf, Runs, Kosten.
3. **Contract-Freigabe:** Metadaten (Scope als Liste mit markierten geschützten Pfaden, Checks mit sichtbar gemachten Steuerzeichen, Mutationsliste), Diff zur Vorversion, Approve / Changes requested mit Pflicht-Finding.
4. **Run:** Checks, Testinventar, Scope-Verstöße, Mutationen, Review-Verdict, Link zum Diff.
5. **Abnahme:** genau der verifizierte SHA, Hinweis falls der Branch-Head abweicht, Merge-Button.
6. **Stop:** ein Schalter, der alle Starts blockiert und laufende Runs abbricht.

### 11.4 V0.1-Umsetzung ohne eigene App

- Contract-Freigabe, Abnahme und Findings: **GitHub-PR-Ansicht** (auch mobil). Freigabe = Approving Review von `Wuerfelduell` auf dem Spec-PR. Abnahme = Merge des Run-PR.
- Inbox: GitHub-Benachrichtigungen, gefiltert auf Review-Anfragen an `Wuerfelduell`.
- Status-Übersicht: eine vom Workflow generierte Markdown-Datei oder ein angepinntes Issue „Forge Board“, das der Workflow aktualisiert. Kein eigenes Frontend.
- Kill Switch: Repository-Variable `FORGE_HALT=1` (in den GitHub-Einstellungen mobil per Browser setzbar), die Start Gate und Verifier prüfen; zusätzlich Agent-Tokens widerrufen. Ein Kill Switch, den ein Agent zurücksetzen kann (Datei im Repo), ist keiner.
- Kosten: täglicher Workflow-Kommentar mit Summen aus dem Forge-Log (siehe Abschnitt 13).

Eine PWA lohnt sich erst, wenn diese Ansicht nachweislich nicht reicht.

---

## 12. Failure Recovery

Legende: **Erkennung** = woran Forge (V0.1 mit Observer-Workflow) den Zustand erkennt. **Fortsetzung** = sicherer nächster Schritt. **NEEDS_HUMAN** = wann der Owner entscheiden muss. „Heute“ beschreibt den Kern ohne Zusatz.

| # | Fall | Heute | Erkennung | Fortsetzung | NEEDS_HUMAN |
|---|---|---|---|---|---|
| FR-01 | Developer stirbt vor Commit | Run `running` für immer | Kein Report und kein Push auf `forge/run/<id>` innerhalb des Lease (z. B. 2 h) | Observer schreibt `run_failed(WORKER_LOST)` (neuer Code für System-Observer) | nur wenn Retry-Limit erreicht |
| FR-02 | Commit erstellt, Push scheitert | Developer schreibt `run_failed(PUSH_REJECTED)` oder nichts | `ls-remote` zeigt Ref nicht | gleicher Developer erneut pushen innerhalb Lease; danach wie FR-01 | wenn Push wiederholt 403 (Rechteproblem) |
| FR-03 | Push erfolgreich, Callback/Report verloren | Run `running`, Commit verwaist | Observer sieht Ref `forge/run/<id>` mit Commits, aber kein Report | Report ist entbehrlich: Ergebnis-Commit = Head des Run-Refs. Observer schreibt `remote_observed`; Kern muss dafür Report optional machen oder der Report liegt als Datei im Branch | nein |
| FR-04 | Verification startet nicht | Run `remote_verified` für immer | Kein `verification_started` innerhalb Timeout | Workflow erneut auslösen (idempotent per `runId`+SHA) | nach 2 Fehlversuchen |
| FR-05 | Verifier stirbt | wie FR-04 | Job-Status `cancelled`/`failure` ohne Evidence | einmal wiederholen; Evidence nur aus abgeschlossenem Job | nach 2 Fehlversuchen |
| FR-06 | Reviewer stirbt | Task `awaiting_review` | Kein Verdict nach Frist | Reviewer neu zuweisen (Owner) | ja, Zuweisung ist Owner-Entscheidung |
| FR-07 | GitHub API temporär down | – | 5xx, Timeouts | Nichts schreiben; Observer-Events sind Beobachtungen und dürfen später kommen. Keine negative Beobachtung aus einem Fehler ableiten (Kern hält das schon: negative Beobachtungen terminieren nie) | nein |
| FR-08 | Backend-Restart | – (es gibt keins) | – | Replay des Logs; laufende Workflows sind unabhängig | nein |
| FR-09 | Duplicate Webhook | Duplikat wird abgelehnt, nicht als No-op erkannt (E-16) | gleiche `eventId` | No-op | nein |
| FR-10 | Event zweimal verarbeitet | wie FR-09 | `seq`/`prevHash` | Appender prüft `prevHash`, zweiter Schreiber verliert | bei echtem Konflikt (gleiche `eventId`, anderer Inhalt) |
| FR-11 | User drückt Start zweimal | zweiter Start `RUN_ALREADY_ACTIVE` bzw. `RUN_ALREADY_EXISTS` | Kern | Start-Aktion idempotent über `runId` aus `(task, version, n)` | nein |
| FR-12 | User drückt Kill während Push | Run `abandoned`, späterer Push verwaist, späte Evidence `RUN_STATE_INVALID` (E-21) | Ref existiert nach Abbruch | Ref nach Abbruch löschen oder als `orphaned` markieren; nie mergen | nein |
| FR-13 | Branch gelöscht | nach `remote_verified` nicht aufzeichenbar (RT-09) | Observer vor Abnahme: Ref fehlt oder enthält SHA nicht | Abnahme blockieren (`RESULT_NOT_PERSISTED`), Developer pusht SHA erneut | wenn Commit nicht mehr abrufbar |
| FR-14 | Force-Push auf Run-Branch | nicht aufzeichenbar | Observer: Head nicht Nachfahre des verifizierten SHA | Abnahme nur des verifizierten SHA; Force-Push per Ruleset verbieten | ja, Hinweis auf Manipulation |
| FR-15 | Force-Push auf `main` | – | Ruleset verhindert | – | – |

**Neue Kernelemente, die das braucht (klein):** `run_failed` mit Rolle `system` und Code `WORKER_LOST`/`LEASE_EXPIRED`; eine erneute Persistenzprüfung vor `task_accepted`; Event-IDs; ein Zustand bzw. Zähler „verification attempts“. Alles Weitere ist Workflow-Logik außerhalb des Kerns.

---

## 13. Cost Control

### 13.1 Was der Pilot zeigt

Es gibt keine Kostendaten im Repo. Die einzige Kostenquelle ist Agentenlaufzeit bei Anthropic und OpenAI. Die teuersten Schritte im Pilot waren nicht Implementierungen, sondern Prozessarbeit: Red-Team (ca. 1200 Testzeilen), 9000-Event-Fuzzer, Verifikationsberichte (INFERRED aus Umfang).

### 13.2 Minimales Modell

```yaml
# forge/policy.json auf main (geschützt, nur Owner ändert)
budgets:
  dailyUsd: 20
  perTaskUsd: 15
  perRunUsd: 5
  perRunWallMinutes: 120
  maxRunsPerContractVersion: 3
  maxVerificationAttemptsPerRun: 2
  maxReviewRoundsPerTask: 3
```

| Begriff | Regel |
|---|---|
| Task Budget | Summe aller Runs eines Tasks; bei Überschreitung kein neuer Start (`BUDGET_EXHAUSTED`) |
| Run Budget | pro Run; bei Überschreitung Abbruch durch Runner, `run_failed(BUDGET_EXCEEDED)` |
| Daily Budget | Summe über alles; bei Überschreitung `FORGE_HALT` bis Owner freigibt |
| Token Usage | gemessen beim Provider (Usage-API oder Konsolen-Export), nie aus dem Developer-Report |
| Agent Runtime | Wall-Clock zwischen `run_started` und letztem Push, gemessen vom Observer |
| Retry Limits | Runs je Contract-Version, Verifikationsversuche je Run, Review-Runden je Task; danach NEEDS_HUMAN |

### 13.3 Warum ein kompromittierter Developer sein Budget nicht erhöhen kann

1. Budgets stehen in `forge/policy.json` auf `main` (Ruleset: nur Owner) oder im approved Contract (Pfad immer verboten). Keine der beiden Quellen ist im Run-Branch schreibbar oder wirksam.
2. Verbrauch wird von außen gemessen (Provider-Konsole, Workflow-Laufzeit), nie aus `DeveloperReport`.
3. **Harte Grenze außerhalb von Forge:** Jeder Agent bekommt einen eigenen API-Key bzw. ein eigenes Konto mit Provider-seitigem Ausgabenlimit. Das ist die einzige Grenze, die auch hält, wenn Forge selbst versagt.
4. Retry-Zähler werden aus dem Log abgeleitet. Ein Developer kann keine Runs „unsichtbar“ machen, weil `run_started` vom Gate geschrieben wird.

### 13.4 Was nicht gebaut wird

Kein Billing, keine Preis-Tabellen je Modell im Code, kein LLM-Gateway nur für Zählung. Provider-Limits plus eine tägliche Summe reichen für einen Benutzer.

---
## 14. Mystery Pilot Findings

### 14.1 Tasks im Überblick (GIT)

| Task | Inhalt | Prod / Test LOC | Versionierter Contract vor Implementierung | Review/Approval im Repo | Nacharbeit |
|---|---|---|---|---|---|
| TASK-0001 `27075fe` | unveränderliches CaseTruth-Modell, C14N + SHA-256 | 379 / 640 | nein (Tests zitieren AC-IDs, Contract lag im Chat, INFERRED) | nein | `de5feb9` |
| TASK-0001a `de5feb9` | test-only: Safe-Integer-Grenze, Red-Herring-Umbenennung | 0 / +20 −3 | nein | nein | – |
| TASK-0002 `3169529` | semantischer Validator, 8 Codes | 267 / 376 | nein | nein | – |
| TASK-0003 `5bfa5a4` | Answer Key, an `truthHash` gebunden | 335 / 716 | nein | nein | – |
| TASK-0004 `e9cb8e2` | NPC-Wissen + Projektion als Informationsbarriere | 510 / 1094 | ja, `6a8c0c5` (YAML, `status: approved` + Review ausstehend) | nein | `1de7efe` (M1) |
| M1 `1de7efe` | test-only: Leak-Guard prüfte die NPC-Quelle nicht | 0 / +17 −1 | nein | Selbstverifikation (Codex) | – |
| TASK-0005 | Dialogpolicy, nur Contract v1/v2 | – | ja | v1 REQUEST_CHANGES, v2 APPROVE (Claude, Markdown, blob-gebunden) | – |

### 14.2 Was tatsächlich schiefging (mit Beleg)

| # | Problem | Beleg | Welche Forge-Funktion hätte geholfen |
|---|---|---|---|
| P-01 | Contracts kamen bis TASK-0003 per Chat; Abschneiden, Doppelfassungen | Handoff-Audit, TASK-0004 §17, FORGE-CORE-0001A:48 („Chat-Draft“) | Contract-Datei in Git + Hash + Read-Quittung |
| P-02 | TASK-0004 implementiert, obwohl Architektur-Review ausstand; Status stand im Contract selbst | Frontmatter Z. 5 und 8; 14 min 53 s zwischen Contract und Implementierung | Start Gate + externer Approval-Record |
| P-03 | Spätere Contract-Revision änderte zugesagte Semantik eines früheren Tasks | `de5feb9`: TASK-0001-Test umbenannt, weil TASK-0002-Revision einen Code strich | Dependency-Bindung, versionierte Contracts |
| P-04 | Testlücke gegen ausdrückliches Acceptance-Kriterium (Quellobjekt-Identitäten) | M1-Verification: Mutant `return stance;` bestand 154/154 Tests | Pflicht-Mutationen im Contract, unabhängiger Verifier |
| P-05 | Self-Review übersah Blocking-Problem, unabhängiger Review fand es | TASK-0005 B1/J1; Self-Audit: „hatte … nicht die Wahl des Acts“ geprüft | Architektur-Gate mit unabhängigem Reviewer |
| P-06 | Ein Mutant wurde falsch als must-detect klassifiziert und später als äquivalent anerkannt | TASK-0005 T5-M11, v2-Review Z. 203 | Äquivalenz-Quittung |
| P-07 | Approval-Routing unklar: Contract sagt „ChatGPT final check“, Freigabe kam von Claude, liegt auf einem anderen Branch | TASK-0005 v2 Frontmatter Z. 8; `be40a68` nur auf Claude-Branch | Approval als Event, nicht als Markdown |
| P-08 | Zwei Hash-Systeme: Reviews binden Git-Blob-SHA-1, Forge bindet SHA-256 mit Präfix | v2-Review `1e6f36e5…`; Forge-Hash für denselben Text `45a8c758…` | Eine Bindungsregel |
| P-09 | „Unabhängige“ Rollen alle in einer Session | Trailer `session_01YERr4…` auf allen Claude-Commits | Echte Identitäten |
| P-10 | Windows-CRLF zerstörte gehashte Artefakte im Checkout | v2-Verification §4 | `.gitattributes` |
| P-11 | Prozessdokumente nicht versioniert (Mutationsdefinitionen R4b, P2, K9) | M1-Verification Z. 89 | Mutationsliste im Contract |
| P-12 | Koordinationsdateien kollidieren zwischen Branches | `git merge-tree`, CODEX.md | keine Koordinationsdateien im Produktrepo |
| P-13 | Forge-Core baut auf ungeprüftem Mystery-Code auf | 0001A `baseCommit = e9cb8e2` | Base nur aus `main` (C-08/C-10) |

### 14.3 Welche Forge-Funktionen sind durch echte Probleme gerechtfertigt?

| Funktion | Gerechtfertigt durch | Urteil |
|---|---|---|
| Contract als versionierte Datei mit Inhalts-Hash | P-01, P-02, P-07, P-08 | **behalten, Kern des Produkts** |
| Approval extern und hash-gebunden | P-02, P-07 | **behalten**, aber als authentifizierte Owner-Aktion |
| Start Gate (approved, aktuell, Start vom Contract-Commit) | P-02, P-13 | **behalten**, um C-08 erweitern |
| Unabhängiges Architektur-Review | P-05 | **behalten**, ein Reviewer |
| requiredChecks | Grundhygiene (immer gebraucht) | behalten, mit Testinventar |
| Mutation Smokes mit Pflichtliste | P-04, P-11 | **behalten, aber Liste in den Contract** |
| Äquivalenz-Quittung | P-06 | behalten, klein |
| Unabhängiges Code-Review | P-04 (Lücke fand ein anderer Agent) | behalten |
| Dependency-Bindung | P-03, P-13 | **vereinfachen**: Dependency = „ist in `main`“, Base = `main`-Commit |
| Remote-Persistenz-Prüfung | nicht git-belegt (O8 nur in Testkommentar) | **vereinfachen** auf „PR-Head == verifizierter SHA“ |
| Scope-Allowlist | kein Verstoß im Pilot gefunden | behalten (billig, präventiv), aber erst durch echten Diff wirksam |

### 14.4 Was bisher nie gebraucht wurde

- Voller Run-Lebenszyklus mit `remote_verified` als eigenem Zustand, `run_failed`-Codes, Mehrfach-Beobachtungen mit Retry: kein einziger echter Fall im Repo.
- `task_accepted`: Kein Task wurde je abgenommen. Die Abnahme ist im Pilot „liegt auf einem Branch“.
- Replay/Determinismus: nie auf echte Daten angewandt, außer dem handgeschriebenen Dogfood-Log.
- `different_identity`-Policy: Unter selbst erklärten Identitäten ohne Wirkung.
- `mutationSmoke: optional`: faktisch identisch mit `none`.
- Mehrere Gates (`REQUIRED_GATES` als Liste): nur ein Gate existiert.

### 14.5 Streichen oder zurückstellen

| Streichen / zurückstellen | Grund |
|---|---|
| `mutationSmoke: optional` | wirkungslos (C-32) |
| `different_identity` als Policy-Wert | ohne Authentifizierung ohne Wirkung; mit GitHub-Identitäten genügt eine feste Regel |
| Developer-Mutationen als Evidence (`mutationSource: developer_report`) | Selbstauskunft (V-17) |
| `commandsRun`, `knownLimitations`, `reviewHints` als Kernel-Schema | nirgends ausgewertet; gehören in PR-Beschreibung |
| `forge/approvals/*.json` | ersetzt durch GitHub-Review des Owners |
| `forge/coordination/*` im Produktrepo | Injection- und Konfliktquelle; ersetzt durch Forge-Log und PR-Kommentare |
| PERF-Optimierungen | irrelevant unter 10 k Events |
| weitere Red-Team-Runden am reinen Kern | Grenzertrag gering; die Risiken liegen außerhalb des Kerns |

---

## 15. Tech Debt Register

| ID | Bereich | Problem | Impact | Likelihood | Evidence | Recommended Action | When |
|---|---|---|---|---|---|---|---|
| TD-01 | Identität | Codex arbeitet unter Sebs GitHub-Identität | Owner-Aktionen und Agent-Aktionen ununterscheidbar; Branch-Protection schützt nicht vor Codex | hoch | GIT, Commit-Autoren | Eigene Identität/Token für Codex mit Rechten nur auf `forge/run/*` | NOW |
| TD-02 | Integration | `main` leer, fünf divergierende Branches, add/add-Konflikt | Parallelarbeit erzeugt unauflösbare Stände | sicher | `git merge-tree` | Integrationsentscheidung: v2-Repair + Mystery + Reviews nach `main` bringen, danach Branch-Protection | NOW |
| TD-03 | Repo-Hygiene | kein `.gitattributes`, kein Node-Pin | Hash-Brüche auf Windows (passiert), Umgebungsdrift | hoch | v2-Verification §4 | `* text=auto eol=lf`, `.nvmrc`/`engines` exakt | NOW |
| TD-04 | Contract-Format | Mystery-Contracts YAML mit Status; Forge-Contracts JSON; Sidecar-Versionen | Kern kann den Pilot nicht steuern | sicher | E-Parse: `FRONTMATTER_MISSING` | Ein Format (`---json`), eine Pfadregel (gleicher Pfad, neuer Commit), Status nie im Contract | NOW |
| TD-05 | Approval | Owner-Approvals von KI geschrieben | Scheinfreigaben | hoch | `forge/approvals/*.json` | Owner-Freigabe nur als GitHub-Review von `Wuerfelduell` | NOW |
| TD-06 | Verification | Evidence ohne Diff-Basis, Testinventar, Modes | Scope- und Check-Prüfung täuschbar | hoch bei untrusted Agent | E-09, VX-03, VX-04 | Contract-Revision 0001B v3 (Abschnitt 7.4) | BEFORE AUTOMATION |
| TD-07 | Verification | Kein Verifier außerhalb der Developer-Umgebung | Jede Evidence ist Selbstauskunft | sicher | kein `.github/` | Verifier als GitHub-Actions-Workflow ohne Secrets | BEFORE AUTOMATION |
| TD-08 | Scope-Policy | Keine immer verbotenen Pfade außer contracts/approvals | Testrunner, Workflows, Kern änderbar | mittel | E-13 | Liste aus 7.4 Punkt 3 | BEFORE AUTOMATION |
| TD-09 | Coordination | Ausnahme für beliebige Dateien | Code- und Prompt-Injection, Löschung per Rename | mittel | VX-01, E-11 | Auf eigene `.md` verengen, mittelfristig entfernen | BEFORE AUTOMATION |
| TD-10 | Start Gate | Lücke `base..contractCommit`; Base kann ungeprüften Code enthalten | ungeprüfter Code im Startpunkt | mittel | E-12, 0001A-Base | Base muss in `main` liegen; Diff base..contract nur Contract-Datei | BEFORE AUTOMATION |
| TD-11 | Review | Findings nicht über Runs übertragen, Rework mit identischem Commit | Abnahme trotz offener Blocker | mittel | E-01, E-22 | Findings-Ledger, Rework-Regel | BEFORE AUTOMATION |
| TD-12 | Mutation | Mutationsauswahl durch Developer | Pflicht-Smokes wertlos | hoch | E-05, E-06 | Mutationsliste im Contract, Ausführung im Verifier | BEFORE AUTOMATION |
| TD-13 | Log | keine Persistenz, keine Event-ID, keine Hash-Kette, Policy nicht im Log | Truncation, Duplikate, Policy-Drift | sicher sobald Log existiert | E-07, E-08, E-16 | Genesis + Umschlag (Abschnitt 5.4) | BEFORE AUTOMATION |
| TD-14 | Log | Kernel-Regeln nicht versioniert | Upgrade macht Historie unlesbar | sicher bei nächstem Upgrade | E-24 | Regelversion je Run | BEFORE AUTOMATION |
| TD-15 | Recovery | Kein Lease/Timeout, kein System-Fail, hängende Runs nur durch Owner lösbar | Owner wird Dauerrelais | hoch | E-10, SM-11..13 | `run_failed` durch System-Observer, `EVIDENCE_NOT_REPRESENTABLE` | BEFORE AUTOMATION |
| TD-16 | Abnahme | Keine erneute Persistenzprüfung vor Abnahme, Head-Drift | unverifizierter Code im Merge | mittel | E-15, RT-09 | Abnahme = Merge exakt des verifizierten SHA | BEFORE AUTOMATION |
| TD-17 | Kosten | Keine Budgets, keine Retry-Limits | unbegrenzte Runs | mittel | Kern | Policy-Datei + Provider-Limits | BEFORE AUTOMATION |
| TD-18 | Rollen | Verifier-/Observer-Unabhängigkeit nicht erzwungen | Selbstverifikation | sicher | E-02 | Mit Workflow-Verifier als Pflicht | BEFORE AUTOMATION |
| TD-19 | Identität | Rollen/Identitäten selbst erklärt (RT-05) | Ein Akteur reicht | sicher bei mehreren Schreibern | E-02, E-14 | Events nur aus authentifizierten Quellen (GitHub-Login → Rolle in `forge/policy.json`) | BEFORE MULTI-USER |
| TD-20 | Architektur | Forge-Kern und Spiel in einem Repo, gemeinsame `package.json` und Testrunner | Spiel-Tasks können Forge ändern; Bootstrap-Problem | mittel | Repo-Struktur | Kern-Pfade verbieten (NOW-nah), später eigenes Repo | LATER |
| TD-21 | Performance | `applyEvent` O(Zustand), Replay überquadratisch | erst ab ~10 k Events relevant | niedrig | PERF-1/2b | nichts tun bis messbar | LATER |
| TD-22 | Robustheit | RT-12 (Getter/Proxy), RT-13, RT-14 | nur In-Process | niedrig | Red-Team | nichts tun | LATER |
| TD-23 | Test-Orakel | Red-Team-Referenzmodell vom Reparierenden mitgeändert | „0 Abweichungen“ belegt weniger Unabhängigkeit | mittel | `811ed0d` ändert `model.ts` | Orakel-Änderungen nur durch anderen Agenten oder mit eigenem Review | BEFORE AUTOMATION |
| TD-24 | Prozess-Scope | Test-Härtungen nach der Implementierung ohne Contract (`927caf1` ändert `contract-document.test.ts`, `dogfood.test.ts`, nicht im 0001B-Scope); Dogfood-Scope-Check nur als Vereinigung, nicht rekursiv, Red-Team-Tests bewusst daneben abgelegt | Scope gilt nur für den einen Implementierungscommit | sicher | GIT | Jede Änderung gehört zu einem Run; Scope-Check rekursiv und je Commit | BEFORE AUTOMATION |
| TD-25 | Evidence-Artefakte | Verifikationsbericht fordert `eval` von Code aus Developer-Evidence | Codeausführung beim Reviewer | niedrig heute | v2-Verification §7 | Evidence ist Daten; Reproduktion nur durch Verifier-Workflow | BEFORE AUTOMATION |
| TD-26 | Darstellung | Freitext (Commands, Mutationsnamen) mit Steuerzeichen/Homoglyphen | Täuschung im Mobile-Review | niedrig | E-13b | Commands auf ASCII druckbar beschränken | BEFORE MULTI-USER |
| TD-27 | Lifecycle | kein Task-Abbruch, kein Reopen, kein NEEDS_HUMAN | tote Tasks, Owner-Relais | mittel | SM-15, SM-16 | `task_withdrawn`, `needs_human` als abgeleiteter Zustand | BEFORE AUTOMATION |

---

## 16. Red-Team Findings (neu, nicht RT-01..RT-15)

| ID | Hypothese | Prüfung | Ergebnis |
|---|---|---|---|
| NRT-01 | Verification Evidence ohne Diff-Basis lässt leere oder partielle `changedFiles` zu | E-09 | **CONFIRMED** |
| NRT-02 | Ungeprüfter Commit zwischen `baseCommit` und `contractCommit` landet im Run-Startpunkt | E-12, 0001A-Base | **CONFIRMED** |
| NRT-03 | Nach `request_changes` wird derselbe Commit in neuem Run von anderem Reviewer abgenommen | E-01 | **CONFIRMED** |
| NRT-04 | Derselbe Reviewer approvt beim zweiten Run den identischen Commit | E-22 | **CONFIRMED** |
| NRT-05 | Replay hängt von einer Policy ab, die nicht im Log steht | E-07 | **CONFIRMED** |
| NRT-06 | Kernel-Upgrade macht historischen Log unreplaybar | E-24 | **CONFIRMED** (in v2 §8 bewusst akzeptiert; ohne Versionierung ein Designfehler) |
| NRT-07 | Abschneiden des Log-Endes entfernt Reject unbemerkt | E-08 | **CONFIRMED** |
| NRT-08 | Doppelt zugestellte Events sind nicht idempotent | E-16 | **CONFIRMED** |
| NRT-09 | Datei mit nicht darstellbarem Namen hängt den Run auf | E-10 | **CONFIRMED** |
| NRT-10 | Testdatei unter `forge/coordination/` wird im Verifier ausgeführt | VX-01 | **CONFIRMED** |
| NRT-11 | Rename innerhalb Coordination umgeht das Löschverbot; Überschreiben ebenso | E-11 | **CONFIRMED** |
| NRT-12 | `vitest.config.ts` höhlt `npm test` aus | VX-03 | **CONFIRMED** (wenn im Scope; Kern verbietet es nicht) |
| NRT-13 | `describe.skip` ergibt Exit 0 | VX-04 | **CONFIRMED** |
| NRT-14 | `process.exit(0)` in einem Test maskiert Fehlschläge | VX-02 | **NOT REPRODUCED** (Vitest 5 fängt ab) |
| NRT-15 | Ein trivialer Mutant erfüllt `mutationSmoke: required` | E-05 | **CONFIRMED** |
| NRT-16 | Alle Überlebenden als äquivalent mit Rationale „.“ führen bis `accepted` | E-06 | **CONFIRMED** |
| NRT-17 | Contract gilt als „persistiert“, wenn er nur auf einem Developer-Scratch-Ref liegt | E-20 | **CONFIRMED** |
| NRT-18 | Abnahme trotz weitergewandertem Branch-Head | E-15 | **CONFIRMED** (Kern); Folgen erst mit Merge |
| NRT-19 | Developer kann seinen eigenen `remote_verified`-Run mit `PUSH_REJECTED` beenden | E-25 | **CONFIRMED** (widersprüchlicher Code; Developer kann außerdem einen ihm unliebsamen Verifikationsausgang vorwegnehmen) |
| NRT-20 | Developer approvt den Contract, den er implementiert | E-14 | **CONFIRMED** |
| NRT-21 | Check-Command mit Homoglyph und Bidi-Override wird angenommen | E-13b | **CONFIRMED** |
| NRT-22 | Contract mit `.github/`, `package.json`, Kern-Dateien im Scope und `command: "true"` ist gültig | E-13 | **CONFIRMED** |
| NRT-23 | 50 MB Freitext im Report wird angenommen | E-18 | **CONFIRMED** |
| NRT-24 | Spec-Autor entwertet `review_approved` kurz vor Abnahme | E-17 | **CONFIRMED** (Blockade, keine Eskalation) |
| NRT-25 | Owner-Abbruch während laufender Verifikation verwirft die spätere Evidence ohne Spur | E-21 | **DESIGN LIMIT** (korrekt fail-closed, aber Information geht verloren) |
| NRT-26 | KI schreibt Approval-Records im Namen des menschlichen Owners | `forge/approvals/*.json` | **CONFIRMED** (GIT, ehrlich beschriftet, maschinell nicht unterscheidbar) |
| NRT-27 | Änderungen nach der Implementierung liegen außerhalb jedes Contracts, und der Dogfood-Scope-Check sieht das nicht | `927caf1`, `dogfood.test.ts` | **CONFIRMED** (GIT) |
| NRT-28 | Der Reparierende hat das Red-Team-Orakel mitgeändert | `811ed0d` → `tests/forge-red-team/model.ts` | **CONFIRMED** (GIT). Die Änderung war vertraglich erlaubt; die Unabhängigkeitsaussage „0 Abweichungen“ ist danach schwächer |
| NRT-29 | Process-Exit oder Kill des Testprozesses erzeugt Exit 0 | VX-02 | **NOT REPRODUCED** |
| NRT-30 | `run_started`-Beobachtung kommt vom Developer selbst | `events.ts:145` Rolle `developer` | **CONFIRMED** (CODE) |
| NRT-31 | Approval-Record-Check im Dogfood-Test akzeptiert jede Datei mit `actorType: human` | `dogfood.test.ts` | **CONFIRMED** (CODE) |
| NRT-32 | Prompt-Injection über Spielinhalte | Projektion, TASK-0005 | **MITIGATED** heute (kein Pfad zu einem LLM), offen für zukünftigen Verbalizer |

Bereits bekannte RT-Punkte, deren Bewertung ich ändern würde:
- **RT-05** (OBSERVATION) → **KRITISCH als Prozessrisiko**, weil der Pilot genau dieses Muster praktiziert (NRT-26, P-09).
- **RT-02** (OBSERVATION) → **HOCH**, weil Coordination ausführbaren Code durchlässt (NRT-10).
- **RT-09** (OBSERVATION) → **MITTEL**, sobald gemerged wird (NRT-18).

---
## 17. Recommended V0.1 Architecture

Abgeleitet ausschließlich aus: (a) dem, was implementiert ist (ein guter reiner Kern), (b) dem, was im Pilot schiefging (Abschnitt 14.2), (c) dem, was dieser Audit zeigt (alle Fakten kommen vom Developer, Identitäten sind unecht, nichts ist integriert).

### 17.1 Leitentscheidung

**Forge V0.1 ist kein Agent-Runner und keine Plattform, sondern ein Torwächter über GitHub.** Agenten arbeiten weiter dort, wo sie heute arbeiten (Claude Code, Codex). Forge kontrolliert nur, was in `main` gelangt, und schreibt darüber einen Log. GitHub liefert die drei Dinge, die dem Kern fehlen: authentifizierte Identitäten, eine vom Developer getrennte Ausführungsumgebung und einen Integrationspunkt mit Schutzregeln.

### 17.2 Bausteine

```text
            Android (GitHub-App/Browser)                    Agenten (eigene GitHub-Identitäten)
   Seb: Review "approve" auf Spec-PR, Run starten,          Claude: push forge/run/*, PR-Reviews
        Merge des Run-PR, FORGE_HALT                         Codex:  push forge/spec/*, forge/run/*
                    │                                                     │
                    ▼                                                     ▼
 ┌─────────────────────────────── GitHub: Wuerfelduell/Forge ─────────────────────────────────┐
 │ main (Ruleset: nur PR, kein Force-Push, Merge nur durch Wuerfelduell, Required Check)        │
 │ forge/policy.json (Logins→Rollen, Budgets, verbotene Pfade)  ← nur Owner ändert               │
 │                                                                                               │
 │ Workflows (nur von main ausgeführt):                                                          │
 │  forge-gate     : Spec-PR prüfen (Parser, Policy), Run starten (Gate gegen echtes Git)        │
 │  forge-verify   : je Check ein Job ohne Secrets, frischer Checkout des exakten SHA;           │
 │                   Aggregator-Job liest nur Job-Ergebnisse + git diff --no-renames              │
 │  forge-observe  : Leases, Head-Drift, Branch gelöscht, Force-Push → Events                    │
 │  forge-log      : einziger Schreiber von forge-log/log.jsonl (Genesis, seq, prevHash, eventId)│
 └───────────────────────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
         src/forge Kernel (vorhanden) + kleine Erweiterungen (Abschnitt 18)
```

**Abbildung auf den Kern:**

| Kern-Event | Quelle in V0.1 | Identität |
|---|---|---|
| `task_registered` | Owner-Aktion (Issue oder Dispatch) | GitHub-Login des Owners |
| `contract_registered` | Merge des Spec-PR nach `main` (Text = Blob am Merge-Commit) | PR-Autor |
| `approval_recorded` | Approving Review des zugewiesenen Architektur-Reviewers auf dem Spec-PR, gebunden an den Head-SHA | Review-Autor |
| `run_started` | `forge-gate` nach Owner-Dispatch; Beobachtung aus echtem Git | Workflow |
| `developer_report_recorded` | PR-Beschreibung bzw. Report-Datei im Run-Branch (Selbstauskunft, nur informativ) | PR-Autor |
| `remote_observed` | `forge-observe` | Workflow |
| `verification_recorded` | `forge-verify`-Aggregator | Workflow |
| `code_review_recorded` | Review des zugewiesenen Code-Reviewers auf dem Run-PR | Review-Autor |
| `task_accepted` | Merge des Run-PR durch `Wuerfelduell` mit exakt verifiziertem Head | Owner |

Rollen kommen aus `forge/policy.json` und dem authentifizierten Login, nicht aus dem Event. Damit wird RT-05 für alle Beteiligten mit eigener GitHub-Identität gelöst. Ein Reviewer ohne eigene GitHub-Identität (heute ChatGPT) kann nur über den Owner handeln; seine Entscheidung zählt dann als Owner-Entscheidung, nicht als unabhängiges Review.

### 17.3 Die gestellten Fragen

| Brauchen wir schon …? | Antwort | Begründung |
|---|---|---|
| **PWA** | **Nein** | Die vier Owner-Entscheidungen (Freigabe, Start, Abnahme, Stopp) sind in der GitHub-Mobile-App bzw. im mobilen Browser möglich. Eine PWA löst kein Problem aus Abschnitt 14.2 |
| **Backend** | **Nein, kein Server** | Workflows sind das Backend. Ein dauerlaufender Server bräuchte Auth, Hosting, Secrets und wäre selbst Angriffsfläche |
| **Postgres** | **Nein** | Ein JSONL-Log in Git mit `prevHash` ist bei unter 10 k Events schneller replaybar als jede DB-Migration und gibt Historie und Manipulationserkennung gratis. Gleichzeitige Schreiber scheitern als non-fast-forward Push, das ist das Locking |
| **Queue** | **Nein** | GitHub-Events (push, pull_request, review, workflow_dispatch, schedule) sind die Queue. Retry über erneuten Dispatch mit gleicher `eventId` |
| **GitHub App (eigene)** | **Noch nicht** | `GITHUB_TOKEN` in Workflows plus getrennte Agenten-Identitäten reichen für einen Owner. Eine eigene App lohnt sich bei mehreren Repos oder Nutzern |
| **LLM Gateway** | **Nein** | Kosten werden über Provider-Limits je Agent-Key begrenzt; Kontext über das Manifest. Ein Gateway wäre nur Zählwerk |
| **Cloud Runner** | **Nein für Agenten, ja für den Verifier** | Agenten laufen bereits in Claude Code bzw. Codex. Der Verifier braucht eine vom Developer getrennte Umgebung: GitHub-hosted Runner genügen |

### 17.4 Was der Verifier-Workflow leisten muss (Spike nötig)

Der kritische Punkt der ganzen Architektur ist, dass ein Developer-PR den Required Check nicht selbst grün machen kann. Anforderungen, die in einem Spike nachgewiesen werden müssen, bevor man sich darauf verlässt:

1. Der Check-Workflow stammt aus `main`, nicht aus dem PR. Bei `pull_request` nimmt GitHub die Workflow-Datei aus dem PR; das ist hier unbrauchbar. Kandidaten: `pull_request_target` mit `permissions: contents: read`, ohne Secrets, mit `persist-credentials: false` und explizitem Checkout des Head-SHA; oder Dispatch durch `forge-gate`. Beide haben bekannte Fallstricke und müssen gegen einen bösartigen PR getestet werden.
2. Je Required Check ein eigener Job; der Aggregator führt keinen Prüfling-Code aus und liest nur Job-Ergebnisse und Git.
3. Commit-Statuses mit gleichem Namen, die ein Agent per API setzt, dürfen nicht zählen (Required Check an die Quelle GitHub Actions binden und Namen eindeutig halten).
4. `.github/`, `forge/policy.json`, `forge/contracts/**` sind per CODEOWNERS/Ruleset nur über Owner-Merge änderbar.

### 17.5 Was bleibt wie es ist

Der Kern bleibt rein, deterministisch und wird nicht umgebaut. Er bekommt nur die Erweiterungen aus Abschnitt 18 (Evidence v3, Log-Umschlag, Base-Regel, Findings-Ledger, Leases). Der Kern läuft in den Workflows, nicht auf Agenten-Maschinen.

---

## 18. Roadmap

Jeder Task nennt den nachgewiesenen Bedarf. Nichts davon ist eine neue Plattform.

### NEXT 5 TASKS

| # | Task | Inhalt | Nachgewiesener Bedarf |
|---|---|---|---|
| 1 | **FORGE-OPS-0001 Integration und Repo-Hygiene** | Owner-Entscheidung, welcher Stand nach `main` kommt (v2-Repair + Mystery + Reviews), Konflikt CODEX.md auflösen, `.gitattributes`, Node-Pin, Ruleset auf `main` (nur PR, kein Force-Push), eigene GitHub-Identität für Codex | TD-01, TD-02, TD-03; P-10, P-12; NRT-26 |
| 2 | **FORGE-CORE-0001B v3: Evidence, die man nicht wegdiskutieren kann** | `diffBase == startedFromCommit`, `--no-renames`, Git-Modes, Testinventar je Check, erweiterte verbotene Pfade, Coordination nur eigene `.md`, `EVIDENCE_NOT_REPRESENTABLE`, Developer-Mutationen zählen nicht, Verifier ≠ Developer | NRT-01, NRT-09 bis NRT-13, NRT-15, NRT-22 |
| 3 | **FORGE-CORE-0002: Git-Observer, CLI und Log** | Node-CLI `forge` (nur in Workflows): Beobachtungen aus echtem Git, Registrierung prüft Blob am Commit, Base-Regel (C-08), JSONL-Log mit Genesis (Policy, Regelversion), `seq`, `eventId`, `prevHash`, idempotente Duplikate | NRT-02, NRT-05 bis NRT-08, NRT-17, NRT-30; C-23, C-26 |
| 4 | **FORGE-OPS-0002: Verifier-Workflow-Spike** | Nachweis aus 17.4 mit einem bösartigen Test-PR (ändert Workflow, Testconfig, setzt Status per API, legt Coordination-Test an) | TD-07, A-04, A-05, A-24, NRT-10, NRT-12 |
| 5 | **TASK-0005 als erster echter Forge-Run** | Contract kernkonform migrieren (neue Bytes, also neues Architektur-Review), Run über die Pipeline, Abnahme per Merge am Handy | Der Kern hat noch nie einen echten Task gesteuert (Abschnitt 1, Punkt 9) |

### NEXT 10 TASKS (6–10 zusätzlich)

| # | Task | Inhalt | Nachgewiesener Bedarf |
|---|---|---|---|
| 6 | **Findings-Ledger und Rework-Regel** | Finding-IDs, Approve muss offene Blocker adressieren, Rework mit identischem Commit nur nach Owner-Freigabe, Reviewer-Zuweisung durch Forge | NRT-03, NRT-04; P-05 |
| 7 | **Mutationsliste im Contract, Ausführung im Verifier** | `mutationSmoke` als Liste konkreter Mutanten, Verifier wendet sie an (Ansatz aus `mutations.json` übernehmen, aber im Workflow) | NRT-15, NRT-16; P-04, P-11 |
| 8 | **Abnahme = Merge des verifizierten SHA; Staleness; Scope-Lease** | Merge nur wenn Head == verifizierter SHA und Ergebnis ⊒ `main`; `stale` → Rebase-Run; Lease für überlappende Scopes und geteilte Dateien | NRT-18; P-12, P-13; Abschnitt 9 |
| 9 | **Recovery: Leases, System-Fail, NEEDS_HUMAN, Task-Rückzug** | Timeouts im Observer, `run_failed` durch System, abgeleiteter Zustand `needs_human`, `task_withdrawn` | SM-11 bis SM-16, FR-01, FR-03, FR-04 |
| 10 | **Budgets, Retry-Limits, Kill Switch** | `forge/policy.json`-Budgets, Retry-Zähler aus dem Log, `FORGE_HALT`, Provider-Limits je Agent-Key | TD-17; Abschnitt 11, 13 |

Bewusst **nicht** in der Liste: weitere Fuzzer, Performance, RT-12/13/14, YAML-Unterstützung, UI.

---

## 19. V0.1 Exit Criteria

V0.1 ist fertig, wenn alle Punkte mit einem Beleg (Log-Auszug, PR-Link, Workflow-Lauf) nachgewiesen sind:

1. **Ein echter Task end-to-end:** TASK-0005 (oder der nächste Mystery-Task) lief: Spec-PR → Architektur-Review durch eine Identität ≠ Spec-Autor ≠ Developer → Owner-Freigabe → Run auf `forge/run/*` → Verifier-Workflow grün → Code-Review durch eine Identität ≠ Developer → Merge exakt des verifizierten SHA durch `Wuerfelduell` vom Handy.
2. **Replay:** Der echte Log replayt mit der Policy aus seinem Genesis-Event zu `accepted`; ein doppelt zugestelltes Event ändert nichts; ein abgeschnittener Log wird über `prevHash`/Git erkannt.
3. **Kein Inhalts-Copy-Paste:** Agenten erhielten nur Manifeste mit Identifikatoren; jede Developer-Session beginnt mit einer tool-berechneten Read-Quittung, die gegen den registrierten Hash geprüft wurde.
4. **Owner-Aufwand:** höchstens vier Owner-Aktionen pro Task (Freigabe, Start, Abnahme, gegebenenfalls NEEDS_HUMAN). Kein Relais zwischen Agenten.
5. **Adversariale Abnahmetests gegen die echte Pipeline** (nicht nur Kern-Unit-Tests) schlagen geschlossen fehl: leere/partielle `changedFiles` (NRT-01), Code zwischen Base und Contract (NRT-02), identischer Commit nach Reject (NRT-03), Coordination-Testdatei (NRT-10), `vitest.config.ts` und `describe.skip` (NRT-12, NRT-13), trivialer Mutant (NRT-15), Contract nur auf Scratch-Ref (NRT-17), Head-Drift vor Merge (NRT-18), Workflow-Änderung im PR (17.4).
6. **Identitäten:** jeder Agent mit eigener GitHub-Identität; Codex nicht mehr unter Sebs Konto; `main` nur per PR; Force-Push aus.
7. **Kill Switch:** `FORGE_HALT=1` verhindert nachweislich Start und Verifikation; Agent-Tokens sind widerrufbar dokumentiert.
8. **Budget:** Tagessumme sichtbar; ein absichtlich überschrittenes Retry-Limit erzeugt NEEDS_HUMAN statt eines weiteren Runs.
9. **Recovery-Drills** einmal durchgespielt: FR-01 (Worker tot), FR-03 (Report verloren), FR-12 (Kill während Push), FR-14 (Force-Push).
10. **Integration:** `main` enthält Forge-Core und Mystery-Stand; kein Arbeitsstand existiert nur auf einem Agenten-Branch.

---

## 20. Top 10 Dinge, die wir NICHT bauen sollten

| # | Nicht bauen | Warum nicht |
|---|---|---|
| 1 | **PWA / eigene Mobile-App** | GitHub mobil deckt die vier Owner-Entscheidungen ab. Erst bauen, wenn ein konkreter Arbeitsschritt nachweislich nicht geht |
| 2 | **Backend-Server mit Postgres** | Neue Angriffsfläche, Auth, Hosting. Git + JSONL reicht für einen Owner und unter 10 k Events |
| 3 | **Queue oder Distributed Scheduler** | Zwei bis drei parallele Tasks brauchen eine Lease-Schleife und eine Up-to-date-Regel, keinen Scheduler |
| 4 | **LLM-Gateway** | Kostenkontrolle geht über Provider-Limits je Key; Kontext über Manifeste |
| 5 | **Eigener Cloud-Runner für Agenten** | Agenten laufen schon in Claude Code und Codex. Der Bedarf an Isolation betrifft den Verifier, und dafür reichen GitHub-Runner |
| 6 | **Signaturen, PKI, Attestation, Merkle-Manifeste** | Das Problem ist fehlende Bindung und fehlende echte Identität, nicht Kryptografie. Git-SHAs, Content-Hash und GitHub-Logins genügen |
| 7 | **LLM-basierter Verifier** | `requiredChecks` sind maschinell. Ein LLM als Verifier ist nur ein weiterer untrusted Reviewer |
| 8 | **Mehrfach-Reviews, Quoren, Reviewer-Reputation** | Der Pilot rechtfertigt genau einen unabhängigen Reviewer je Gate |
| 9 | **Weitere Kernel-Features oder Red-Team-Runden ohne echten Run** | Der Kern ist intern konsistent; alle wichtigen Risiken liegen an seinen Eingängen. Erst Abschnitt 18, Task 5 abschließen |
| 10 | **Kontext-Infrastruktur (RAG, Vektor-DB) und Replay-Optimierung** | Der Pilot scheiterte an Bindung, nicht an Kontextmenge. Replay ist bei Pilotgrößen schnell genug |

---

## Anhang A: Experimente

Alle Experimente liefen gegen den unveränderten Code von `b9339d2` (bzw. `be40a68` für E-24) in Wegwerf-Worktrees im Scratchpad dieser Session. Fixtures aus `tests/forge/fixtures.ts` und `tests/forge/run-fixtures.ts` wurden importiert, nicht verändert. Nichts wurde committet.

| ID | Aufbau | Beobachtetes Ergebnis |
|---|---|---|
| E-01 | verifizierter Run → `request_changes` (blocking) → Run 2 mit identischem Commit → Approve durch `vendor-c` → Abnahme | `accepted`, Commit `777…` |
| E-02 | Developer-Identität als Observer und Verifier, `changedFiles: []`, Reviewer `vendor-a2`, Abnahme mit selbst erklärtem `human` | `accepted` |
| E-04 | erfundene Kante `FAKE → contract` | `verified` |
| E-05 | `mutationSmoke: required`, ein Mutant „delete-entire-file“ detected, Verifier `mutations: null` | `verified` / `awaiting_review` |
| E-06 | zwei überlebende Mutanten als `equivalent` mit Rationale „.“ | `accepted` |
| E-07 | gleicher Log unter `different_identity` vs `different_provider` | `accepted` vs Abbruch Index 7 `REVIEWER_NOT_INDEPENDENT` |
| E-08 | Log mit `request_changes` vs gekürzter Log + anderer Reviewer | `rework_required` vs `accepted` |
| E-09 | `changedFiles: []` bei Ergebnis ≠ Start | `verified` |
| E-10 | `changedFiles: [{path: "src/my file.ts"}]` | `EVENT_SCHEMA`; Run bleibt `remote_verified`, Task `implementing`, Neustart `RUN_ALREADY_ACTIVE` |
| E-11 | `evaluateVerification` mit `forge/coordination/evil.test.ts` (added), `CLAUDE.md` (modified), Rename `CODEX.md → archive/CODEX.md`, `approvals/TASK-0001.json` (added) | `passed: true` |
| E-12 | Graph `contract → EVIL → base` | `allowed: true`, Start bei `contract` |
| E-13 | Scope mit `.github/workflows/x.yml`, `vitest.config.ts`, `package.json`, `package-lock.json`, `src/forge/verification.ts`, `tsconfig.json`; Check `true`; `mutationSmoke: none` | Contract gültig |
| E-13b | Command `npm tеst ‮ignored` | Contract gültig |
| E-14 | A: Spec + Code-Review; B: Architektur-Approval, Developer, Observer, Verifier; Policy `different_provider` | `accepted` |
| E-15 | `claimedRemoteRef: "main"`, Head = Nachfahre des Ergebnisses | `accepted` |
| E-16 | gleiches Report-Event zweimal; gleiche positive Beobachtung zweimal | beide `RUN_STATE_INVALID` |
| E-17 | `review_approved`, danach `contract_registered` v2 | `specifying` |
| E-18 | `deviations` mit 50 000 000 Zeichen | akzeptiert, 30 ms |
| E-20 | Refs nur `refs/heads/developer-scratch-123` | Start erlaubt |
| E-21 | Owner-Abbruch, danach Evidence | `RUN_STATE_INVALID` (`abandoned`) |
| E-22 | gleicher Reviewer: `request_changes`, dann Approve auf identischem Commit im Run 2 | `accepted` |
| E-24 | Log mit doppeltem Check-Namen unter Claude-Kernel `be40a68` → JSON → v2-Kernel | v1: `accepted`; v2: `EVENT_SCHEMA` Index 6 `body.evidence.checks.1.name` |
| E-25 | Developer setzt `run_failed(PUSH_REJECTED)` auf eigenen `remote_verified`-Run | akzeptiert, Run `failed` |
| VX-01 | `forge/coordination/notes.test.ts` schreibt Datei mit `process.env.HOME` | ausgeführt, Datei erstellt |
| VX-02 | `process.exit(0)` in Test plus echter Fehlschlag | Exit 1, Vitest meldet „process.exit unexpectedly called“ |
| VX-03 | `vitest.config.ts` mit `include: ["tests/forge/identity.test.ts"]`, dann `npx vitest run` | 19 statt 1086 Tests, Exit 0 |
| VX-04 | `describe.skip` um einen fehlschlagenden Test | „1 skipped“, Exit 0 |
| Parse | alle Contracts aller Branches mit `parseContractDocument` | Forge-Contracts ok, Hashes = Approval-Records; TASK-0004/0005 `FRONTMATTER_MISSING` |
| Merge | `git merge-tree` v2-Repair × mystery-task-0005 | add/add-Konflikt `forge/coordination/CODEX.md` |

## Anhang B: Abgrenzung zu den parallelen Threads

- **Contract-Handoff-Audit** (`forge-audits/FORGE-CONTRACT-HANDOFF-AUDIT.md`): Ich übernehme dessen Handoff-Format, Read-Quittung, End-Marker und die Regel „Start vom Contract-Commit“. Eine Präzisierung: Dessen Fall 5 nimmt an, fremde Commits zwischen Base und Ergebnis erschienen im Scope-Diff. Für Commits zwischen `baseCommit` und `contractCommit` gilt das nicht (C-08, E-12).
- **TASK-0004-Dependency-Audit:** Hier nur referenziert (C-10, P-02, P-13). Ob `e9cb8e2` nachträglich gebunden oder ersetzt wird, ist eine Owner-Entscheidung aus jenem Thread.
