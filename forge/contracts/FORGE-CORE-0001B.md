---json
{
  "forgeContractFormat": 1,
  "taskId": "FORGE-CORE-0001B",
  "contractVersion": 1,
  "baseCommit": "8cae4ccaec11f4fe693a496987e3ab31bd05dad0",
  "dependencies": [],
  "scope": {
    "create": [
      "src/forge/runs.ts",
      "src/forge/verification.ts",
      "tests/forge/run-fixtures.ts",
      "tests/forge/runs.test.ts",
      "tests/forge/verification.test.ts",
      "tests/forge/review-acceptance.test.ts",
      "tests/forge/scenarios.test.ts"
    ],
    "modify": [
      "src/forge/events.ts",
      "src/forge/state.ts",
      "src/forge/start-gate.ts",
      "src/forge/kernel.ts",
      "tests/forge/fixtures.ts",
      "tests/forge/typecheck.ts",
      "tests/forge/start-gate.test.ts",
      "tests/forge/state.test.ts",
      "tests/forge/kernel.test.ts"
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
# FORGE-CORE-0001B – Run Lifecycle, Remote Verification, Evidence, Review, Task Acceptance

Autor: Claude (spec_author und developer dieser Nacht).
Grundlage: FORGE-CORE-0001 Revision 2, die acht Architekturentscheidungen des Night-Run-Auftrags und der **tatsächliche** 0001A-Code am Commit `8cae4cc` (= `baseCommit`).
Freigabe: kein Status in dieser Datei; externer, hash-gebundener Record (siehe §20).

## 1. Ziel

Erweitere den 0001A-Kern um:

- Developer-Runs mit Selbstbericht,
- Remote-Persistenz-Beobachtungen mit Retry,
- maschinelle Verification Evidence einschließlich Mutation Results,
- Code Review,
- Task-Abnahme durch einen menschlichen Owner,
- den vollständigen abgeleiteten Task-Lifecycle.

Alles bleibt reine Domainlogik über einem nicht persistierten Event-Log.

## 2. Reconciliation gegen 0001A (`8cae4cc`)

Verifiziert am Code:

- `applyEvent(state, event, deps)` und `replay(events, deps)` in `state.ts`; `step` validiert vollständig, bevor es mutiert.
- `taskState` liefert in 0001A nur `planned | specifying | ready`.
- `acceptedCommitOf` liefert immer `null`.
- `ROLE_FOR_EVENT` bildet jedes Event auf genau eine Rolle ab.
- Das Gate blockiert jeden Zustand außer `ready` mit `TASK_NOT_STARTABLE`.
- `startFromCommit = contractCommit`.

Befunde und Entscheidungen:

- **F8:** Commits mit Notizen unter `forge/coordination/` liegen zwischen Contract-Commit und Ergebnis. Die Scope-Prüfung ignoriert ausschließlich Pfade mit dem Präfix `forge/coordination/`. Änderungen unter `forge/contracts/` oder `forge/approvals/` sind **immer** Verstöße.
- **F9:** `ROLE_FOR_EVENT` wird zu einer Menge erlaubter Rollen je Event (`run_failed`: developer oder owner).
- **F10:** Neuer Rejection-Code `DEPENDENCY_MISMATCH`, wenn eine Abhängigkeit mit einem anderen Commit akzeptiert wurde.
- **F11:** Startbar sind `ready` und `rework_required`. `implementing` ergibt `RUN_ALREADY_ACTIVE` statt `TASK_NOT_STARTABLE`.
- **F12:** Verifikationsbewertung, Run-Zustand und Task-Zustand werden abgeleitet, nie gespeichert.

## 3. Dateien

Siehe `scope` im Frontmatter. Neue Dateien:

- `src/forge/runs.ts`: Schemas für Report, Evidence, Mutationen, Verdict, Failure
- `src/forge/verification.ts`: reine Bewertungen

0001A-Dateien, die erweitert werden dürfen: `events.ts`, `state.ts`, `start-gate.ts`, `kernel.ts` sowie die Testdateien aus `scope.modify`. Keine neue Dependency.

## 4. Neue Rollen und Events

```text
Role += "developer" | "observer" | "verifier" | "code_reviewer"
EventBody +=
  | { type: "run_started", runId, taskId, contentHash, repoObservation: RepoObservation }
  | { type: "developer_report_recorded", runId, report: DeveloperReport }
  | { type: "remote_observed", runId, ref: RefName, head: CommitSha | null, parents: Record<CommitSha, CommitSha[]> }
  | { type: "verification_recorded", evidence: VerificationEvidence }
  | { type: "run_failed", runId, code: "PUSH_REJECTED" | "REMOTE_NOT_PERSISTED" | "DEVELOPER_ABORTED", detail: Text }
  | { type: "run_abandoned", runId, reason: "WORKER_LOST" | "OWNER_CANCELLED", detail: Text }
  | { type: "code_review_recorded", runId, reviewedCommit, verdict: "approve" | "request_changes",
      requires: "code_change" | "contract_change" | null, findings: Finding[], acknowledgedEquivalentMutations: string[] }
  | { type: "task_accepted", taskId, runId }
RunId = ^run:[a-z0-9][a-z0-9_-]{0,63}$
```

Erlaubte Rollen je Event:

| Event | Rollen | Zusatzregel |
|---|---|---|
| run_started | developer | – |
| developer_report_recorded | developer | Actor == Run-Developer (`sameIdentity`) |
| remote_observed | observer | – |
| verification_recorded | verifier | – |
| run_failed | developer, owner | bei developer: Actor == Run-Developer |
| run_abandoned | owner | – |
| code_review_recorded | code_reviewer | unabhängig vom Run-Developer gemäß ReviewPolicy |
| task_accepted | owner | `actor.actorType === "human"` |

Die `remote_observed`-Kanten unterliegen derselben `__proto__`-Ablehnung wie die RepoObservation in 0001A.

## 5. Schemas (`src/forge/runs.ts`)

```text
MutationResult (strict) = {
  name: Text, description: Text,
  outcome: "detected" | "survived" | "not_applied",
  classification: "must_detect" | "equivalent",
  equivalenceRationale: Text | null
}
DeveloperReport (strict) = {
  claimedResultCommit: CommitSha, claimedRemoteRef: RefName,
  commandsRun: { command: Text, exitCode: int }[],
  mutations: MutationResult[],
  deviations: Text[], knownLimitations: Text[], reviewHints: Text[]
}
VerificationEvidence (strict) = {
  runId, verifiedCommit: CommitSha, method: "fresh_clone",
  changedFiles: { path: RepoPath, change: "added" | "modified" | "deleted" | "renamed" }[],   // Pfade eindeutig
  checks: { name: CheckName, command: Text, exitCode: int }[],
  mutations: MutationResult[] | null
}
```

Exit-Codes sind sichere Ganzzahlen.

## 6. Run-Zustand (abgeleitet)

```text
RunState = "running" | "reported" | "remote_verified" | "verified" | "failed" | "abandoned"
```

| Event | erlaubt in | Ergebnis |
|---|---|---|
| run_started | – (Gate) | running |
| developer_report_recorded | running | reported |
| remote_observed, contained | reported | remote_verified |
| remote_observed, not_contained | reported | bleibt reported |
| verification_recorded, bestanden | remote_verified | verified |
| verification_recorded, nicht bestanden | remote_verified | failed (source: verification) |
| run_failed | running, reported, remote_verified | failed (source: explicit) |
| run_abandoned | running, reported, remote_verified | abandoned |

Rejection bei falschem Zustand: `RUN_STATE_INVALID` (Pfad `["body", "runId"]`). Unbekannter Run: `RUN_UNKNOWN`. Doppelte runId: `RUN_ALREADY_EXISTS`.

Weitere Regeln:

- **Negative Beobachtungen terminieren nie.** Nur `run_failed` oder `run_abandoned` beenden einen Run in `reported`.
- Pro Run genau ein Report.
- `verification_recorded` mit `verifiedCommit ≠ claimedResultCommit` wird abgelehnt (`VERIFIED_COMMIT_MISMATCH`); ebenso doppelte changedFiles-Pfade (`EVENT_SCHEMA`).

## 7. Remote-Outcome (`src/forge/verification.ts`)

```text
remoteOutcome(run, observation) = "contained" genau dann, wenn
  observation.ref == report.claimedRemoteRef
  ∧ observation.head != null
  ∧ isAncestorOrSelf(report.claimedResultCommit, observation.head, observation.parents)
  ∧ isAncestorOrSelf(run.startedFromCommit, report.claimedResultCommit, observation.parents)
sonst "not_contained"
```

Containment statt Gleichheit. Fehlende Kanten führen zu not_contained (fail-closed). Der Ref-Name trägt keine Task-Identität.

## 8. Verifikationsbewertung

```text
evaluateVerification(contractMetadata, report, evidence) ->
  { passed: true, mutationSource } | { passed: false, failures: { code, subject }[], mutationSource }
```

**Checks:** Für jede `requiredCheck` muss ein Check mit gleichem Namen und gleichem Command und `exitCode === 0` vorliegen. Sonst `CHECK_FAILED` (subject = Check-Name).

**Scope:** Pfade mit dem Präfix `forge/coordination/` werden ignoriert. Für alle anderen gilt:

- `added` nur, wenn in `scope.create`,
- `modified` nur, wenn in `scope.modify`,
- `deleted` und `renamed` immer Verstoß,
- jeder Pfad unter `forge/contracts/` oder `forge/approvals/` immer Verstoß.

Verstoß: `SCOPE_VIOLATION` (subject = Pfad).

**Mutationen:** Wirksam sind `evidence.mutations`, falls nicht null (`mutationSource = "verifier"`), sonst `report.mutations` (`"developer_report"`). Bei `mutationSmoke = "none"` werden Mutationen ignoriert (`mutationSource = "none"`).

- `MUTATION_EVIDENCE_INVALID` (subject = Name oder null):
  - `not_applied`,
  - `equivalent` mit `detected`,
  - doppelte Namen,
  - `equivalenceRationale` gesetzt genau dann, wenn `equivalent` ist verletzt,
  - `required` mit leerer Liste (subject null).
- `MUTATION_SURVIVED` (subject = Name): `must_detect` mit `survived`.
- Bei `optional` gelten dieselben Regeln, wenn die Liste nicht leer ist.

Failures sind nach `code`, dann `subject` sortiert (UTF-16, `null` zuerst).

Unabhängigkeit des Verifiers: wird abgeleitet (`same_identity | same_provider | different_provider` gegenüber dem Run-Developer) und als Fakt-Projektion abgefragt, ist aber nie ein Bewertungskriterium (Architekturentscheidung 2).

## 9. Code Review

`code_review_recorded` ist nur zulässig, wenn:

1. der Run `verified` ist (`RUN_STATE_INVALID`),
2. er der letzte verifizierte Run seines Tasks auf der aktuellen Revision ist (`RUN_NOT_LATEST_VERIFIED`),
3. er noch kein Verdict hat (`REVIEW_ALREADY_RECORDED`),
4. `reviewedCommit == verifiedCommit` gilt (`REVIEWED_COMMIT_MISMATCH`),
5. der Reviewer gemäß `isIndependentReviewer(runDeveloper, reviewer, policy)` unabhängig ist (`REVIEWER_NOT_INDEPENDENT`),
6. `approve` ⇒ `requires === null` und kein blocking Finding (`VERDICT_INCONSISTENT`),
7. `request_changes` ⇒ `requires !== null` und ≥ 1 Finding (`VERDICT_INCONSISTENT`),
8. `acknowledgedEquivalentMutations` als Menge exakt den wirksamen `equivalent`-Mutationsnamen entspricht (`EQUIVALENT_MUTATIONS_NOT_ACKNOWLEDGED`); Duplikate sind `EVENT_SCHEMA`.

## 10. Task-Zustand (vollständig, abgeleitet)

```text
TaskState = "planned" | "specifying" | "ready" | "implementing" | "awaiting_review"
          | "review_approved" | "rework_required" | "contract_revision_required" | "accepted"
```

Erste zutreffende Regel gewinnt:

1. `task_accepted` vorhanden → `accepted`
2. ein Run des Tasks nicht terminal → `implementing`
3. kein Contract → `planned`
4. C = aktuelle Revision; R = letzter `verified` Run mit `contract.contentHash == C.contentHash`. Wenn R existiert:
   - kein Verdict → `awaiting_review`
   - `approve` → `review_approved`
   - `request_changes` mit `code_change` → `rework_required`
   - `request_changes` mit `contract_change` → `contract_revision_required`
5. C approved → `ready`
6. sonst → `specifying`

## 11. Gate-Erweiterung

- `TASK_NOT_STARTABLE` (subject = Zustand) für alle Zustände außer `ready`, `rework_required` und `implementing`.
- `RUN_ALREADY_ACTIVE` für `implementing`.
- `run_started` wird nur angewendet, wenn `canStartDeveloperRun(stateVorher, {taskId, contentHash, repoObservation})` `allowed` ergibt (sonst `START_NOT_ALLOWED`, `subject` = erster Grund). `startedFromCommit` = `startFromCommit` der Entscheidung. Beim Replay wird das Gate mit der aufgezeichneten Beobachtung neu berechnet.

## 12. Task-Abnahme und Abhängigkeiten

`task_accepted` ist nur zulässig, wenn:

- der Task `review_approved` ist (`TASK_STATE_INVALID`),
- `runId` dem R aus §10 entspricht (`RUN_NOT_LATEST_VERIFIED`),
- der Actor ein Mensch ist (`OWNER_NOT_HUMAN`).

`acceptedCommitOf(state, taskId)` = `verifiedCommit` des akzeptierten Runs, sonst `null`.

Approval-Abhängigkeitsprüfung:

- Ist die Abhängigkeit nicht akzeptiert → `DEPENDENCY_NOT_ACCEPTED`.
- Ist sie mit einem anderen Commit akzeptiert → `DEPENDENCY_MISMATCH`.

Nach `accepted` werden `contract_registered` und `approval_recorded` für den Task abgelehnt (`TASK_ALREADY_ACCEPTED`). `accepted` ist terminal.

## 13. Projektionen und API

Fakten werden gespeichert:

- Run-Records mit Startbeobachtung, Report, allen Beobachtungen, Evidence, Failure/Abandon, Verdict,
- Abnahme pro Task.

Abgeleitet werden:

- `runState(state, runId)`,
- `taskState` (§10),
- `latestVerifiedRun(state, taskId)`,
- `verificationOf(state, runId)` (Bewertung aus §8),
- `verifierIndependence(state, runId)`.

Der Kernel exportiert zusätzlich `evaluateVerification` und `remoteOutcome` nicht als Methoden; sie bleiben Modulfunktionen.

## 14. Invarianten

Alle Invarianten aus 0001A gelten weiter. Zusätzlich:

- Höchstens ein nicht-terminaler Run pro Task.
- `run_started` nur mit positivem Gate.
- Negative Beobachtungen terminieren nie.
- `verified` nur über `remote_verified` und eine bestandene Bewertung.
- Review nur auf dem letzten verifizierten Run der aktuellen Revision, höchstens eines pro Run.
- Abnahme nur durch einen menschlichen Owner im Zustand `review_approved`.
- `accepted` ist terminal.
- Task-Identität kommt nie aus Ref-Namen.

## 15. Acceptance Criteria

| ID | Kriterium |
|---|---|
| B-01 | Implementierungsdiff nur Dateien aus `scope`. |
| B-02 | typecheck und alle Tests grün, inkl. 0001A und Mystery. |
| B-03 | 403/not_contained → retry → contained; mehrfach not_contained → explizites `run_failed`. |
| B-04 | Anderer Remote-Ref zulässig; Task-Identität unabhängig vom Ref-Namen. |
| B-05 | Verifikation vor `remote_verified` abgelehnt. |
| B-06 | Required checks; Scope create/modify/delete/rename, coordination-Ausnahme, contracts/approvals immer Verstoß. |
| B-07 | Mutationen: must_detect survived, equivalent + Quittung, not_applied ungültig, Quelle. |
| B-08 | code_change → rework_required → neuer Run; contract_change → contract_revision_required → neue Version. |
| B-09 | Review nur auf letztem verified Run der aktuellen Revision; AI- und Human-Unabhängigkeit. |
| B-10 | task_accepted nur durch einen menschlichen Owner; `accepted` terminal; Abhängigkeit danach freigebbar, Mismatch erkannt. |
| B-11 | Replay == schrittweises applyEvent für lange gemischte Logs; Gate wird beim Replay neu berechnet. |
| B-12 | Alle Rejection-Codes mit positivem und negativem Fall. |
| B-13 | Mutation-Smokes: jeder detected oder begründet equivalent. |
| B-14 | Keine Provider-Namen, kein `node:*` außer Adapter, keine Status-Speicherung, Ausgaben eingefroren. |

## 16. Testmatrix (Mindestumfang)

Alle Fälle aus B-03 bis B-12, zusätzlich:

- Pilot-Szenarien mit Herkunftsangabe (beobachtet: O8 403/Retry, O9 anderer Ref, O10 P2, O11 equivalent, O7 widersprüchlicher Contract; konstruiert: der Rest),
- ungültige Event-Reihenfolgen (Report vor Start, Beobachtung vor Report, Review vor Verifikation, Abnahme vor Review),
- Unabhängigkeitsmatrix für Review (AI/AI gleicher und anderer Provider, Mensch, system),
- Determinismus der Failure-Sortierung,
- Immutability.

## 17. Pflicht-Mutation-Smokes

1. negative Beobachtung terminiert
2. Containment ohne Startcommit-Prüfung
3. Verifikation in `reported` erlaubt
4. Check ohne Command-Vergleich
5. deleted erlaubt
6. coordination-Ausnahme auf `forge/` ausgeweitet
7. not_applied gültig
8. must_detect survived erlaubt
9. Quittungsprüfung entfernt
10. Review auf nicht-letztem Run erlaubt
11. Reviewer-Unabhängigkeit entfernt
12. Abnahme durch AI-Owner erlaubt
13. `rework_required` nicht startbar
14. `contract_change` wie `code_change`
15. `run_started` ohne Gate-Neuberechnung
16. Dependency-Mismatch ignoriert

## 18. Non-Goals

Merge, Persistenz, echte Remote-Abfragen, Ausführung von Befehlen, Mutation-Framework, Authentifizierung, mehrere Gates, Rework nach `accepted`, Policy-Wechsel, UI/Backend.

## 19. Größe

Empfohlen ≤ 750 zusätzliche Produktionszeilen (inkl. Kommentare und Leerzeilen). Tests sind ausgenommen.

## 20. Freigabe

Externer Record: `forge/approvals/FORGE-CORE-0001B.v1.architecture_review.json`, Format wie in 0001A §21, gleiche Vorautorisierung durch den Owner im Night-Run-Auftrag. Er ersetzt kein unabhängiges Review dieses Textes.
