---json
{
  "forgeContractFormat": 1,
  "taskId": "FORGE-CORE-0001A-PATCH-0001",
  "contractVersion": 1,
  "baseCommit": "f712e50a1562233f31564af8218cef9fd1097b7c",
  "dependencies": [],
  "scope": {
    "create": [
      "tests/forge/architecture-approval.test.ts"
    ],
    "modify": [
      "src/forge/state.ts",
      "tests/forge-red-team/findings.test.ts",
      "tests/forge-red-team/model.ts"
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
# FORGE-CORE-0001A-PATCH-0001 — Architecture approval consistency

## Basis, Autorisierung und Grenze

Basis ist der exakte baseCommit oben. 0001A v1 in forge/contracts/FORGE-CORE-0001A.md bleibt unverändert.
Der Nutzer hat die eng begrenzte Reparatur nach vollständigem widerspruchsfreiem Contract ausdrücklich autorisiert.
Dieser Text ist keine Behauptung eines unabhängigen Approvals. Externe Prüfung der Implementation bleibt erforderlich.

Unabhängig reproduziert: approval_recorded mit verdict approved und einem blocking Finding wird auf dieser Basis akzeptiert und ergibt ready.
Die Semantik stammt aus 0001A §9, nicht aus 0001B. Daher eigener Patch statt stiller 0001A-Änderung.

## Einzige normative Änderung

Im approval_recorded-Zweig, nach den bestehenden Existenz-/Versions-/Entscheidungs-/Reviewer-Prüfungen und der bestehenden changes_requested-Leerprüfung:
Wenn verdict === "approved" und mindestens ein Finding severity === "blocking" besitzt, ablehnen mit:

- code: VERDICT_INCONSISTENT (bereits vorhanden)
- path: ["body", "verdict"]
- subject: null
- issues: []

Prüfung vor den Dependency-Prüfungen, vor decisions.push und vor Log-Anhang.
Kein solches Approval darf in einem erfolgreich erzeugten/replayten ForgeState gespeichert werden.
Die Event-Shape-Union bleibt unverändert: Ein syntaktisch geformter Antrag ist kein semantisch gültiger Approval-Fakt.
Keine neue öffentliche API und kein neues Error-System.

Unverändert:
- approved mit leerer oder ausschließlich non_blocking Liste ist zulässig, sofern übrige Gates bestehen.
- changes_requested braucht mindestens ein Finding; blocking und non_blocking sind jeweils erlaubt.
- Leeres changes_requested bleibt FINDINGS_REQUIRED.
- Rollen, Reviewer-Unabhängigkeit, Dependency-Regeln, Fehlerpriorität der bisherigen früheren Prüfungen.
- Abgelehnte Events verändern weder Zustand noch Eventlog.

## Allowlist und Teständerungen

Nur die vier Dateien im Frontmatter. In state.ts ausschließlich oben genannter Guard.
findings.test.ts: RT-06 vom dokumentierten Akzeptanzfall in eine Ablehnungsregression umstellen.
model.ts: Im unabhängigen Approval-Übergang dieselbe normative Konsistenz implementieren, ohne Produktionshelper zu importieren.
Neue architecture-approval.test.ts: beide Verdicts × leere/non_blocking/blocking/gemischte Findings; apply/replay, Index, Unveränderlichkeit und Fehlerpriorität.

Keine 0001B-Scope-/Check-Reparatur in diesem Commit. Keine Änderungen an 0001A v1 Contract, Event-Schemas, Auth, Persistenz, Performance oder Mystery.

## Acceptance Criteria

- P-01: Implementierungsdiff ausschließlich Allowlist; Produktionsdiff nur Approval-Guard in state.ts.
- P-02: approved+blocking und approved+gemischt ergeben den exakten Rejection-Record.
- P-03: approved+leer/non_blocking bestehen auf ansonsten gültigem Fixture.
- P-04: changes_requested-Semantik bleibt in allen vier Listenfällen unverändert.
- P-05: applyEvent und replay lehnen denselben Antrag gleich ab; replay.index korrekt.
- P-06: Vorheriger State/Log unverändert; abgelehntes Approval wird nie gespeichert.
- P-07: Reviewer-/Existenzfehler behalten Vorrang; Blocking-Fehler hat Vorrang vor Dependency-Unresolved.
- P-08: Guard-entfernender, tatsächlich angewendeter Mutant wird durch Regression erkannt.
- P-09: Typecheck und vollständige Suite am abschließenden Reparaturstand grün, einschließlich Differential-Fuzzer.
  Bekannter Baseline-Windowsfehler in tests/forge/dogfood.test.ts wird separat test-only im 0001B-v2-Scope behandelt; niemals als bestanden ausgeben.

## Migration und Übergabe

Keine automatische Log-Migration. Historische Logs mit approved+blocking werden im neuen Kernel deterministisch abgelehnt.
Die frühere Kernel-Version bleibt in Git reproduzierbar; kein stilles Entfernen von Findings oder Umetikettieren von Verdicts.
0001B v2 bindet seinen baseCommit an den nachfolgenden Implementierungscommit dieses Patches.
dependencies bleibt leer: Es existiert kein als akzeptiert nachgewiesener Pilot-Task im Kernel-Log; kein acceptedCommit wird erfunden.
Die Quellcodeabhängigkeit wird über den exakten Basis-SHA gebunden, wie im bisherigen manuellen Core-Pilot.
