---json
{
  "forgeContractFormat": 1,
  "taskId": "FORGE-BOOTSTRAP-0001C",
  "contractVersion": 1,
  "baseCommit": "3d7545d843883418348004e68717399a64da7a7d",
  "dependencies": [
    {
      "taskId": "FORGE-BOOTSTRAP-0001B",
      "acceptedCommit": null
    }
  ],
  "scope": {
    "create": [
      "tools/forge_v01/github.py",
      "tools/forge_v01/reviews.py",
      "tools/forge_v01/final.py",
      "tools/forge_v01/main.py",
      "tools/forge_v01/Dockerfile",
      ".github/workflows/forge-v01.yml",
      "forge/verifier/bootstrap-manifest.json",
      "forge/verifier/policy.json",
      "forge/verifier/task-plan.schema.json",
      "forge/verifier/image-inputs.json",
      "forge/verifier/clamp-plan.example.json",
      "src/forge-drill/clamp-at-zero.ts",
      "tests/forge-v01/reviews.test.ts",
      "tests/forge-v01/final.test.ts",
      "tests/forge-v01/workflow.test.ts",
      "tests/forge-v01/properties-c.test.ts",
      "tests/forge-v01/clamp-at-zero.test.ts"
    ],
    "modify": []
  },
  "requiredChecks": [
    {
      "name": "baseline",
      "command": "forge-v01:baseline"
    },
    {
      "name": "acceptance",
      "command": "forge-v01:acceptance-c"
    },
    {
      "name": "mutations",
      "command": "forge-v01:mutations-c"
    }
  ],
  "mutationSmoke": "required"
}
---

# FORGE-BOOTSTRAP-0001C — Implementation Contract Draft

## Status und bindende Auslegung

DRAFT, nicht registriert und nicht zur Ausführung dieses Auftrags freigegeben. Dieses Dokument verwendet exakt Forge Contract Format 1 des angegebenen aktuellen main. Kein neuer Frontmatter-Key. Normative Details stehen im mitgelieferten FORGE-MINIMUM-VERIFIER-IMPLEMENTATION-PACKAGE.html, Abschnitte 1–18, und im nachstehenden Task-Scope. Die Implementierung ist eine spätere gesonderte Aufgabe.

Die Task-Dateien enthalten keine Architekturwahl mehr: Python-Stdlib für IO, vorhandener TypeScript-Contractparser unverändert, Vitest-Reporter in JavaScript; keine neue Dependency. Keine Änderung bestehender src/forge- oder Domain-Module, package.json, package-lock.json, tsconfig.json oder bestehender Tests. Nur scope.create-Pfade anlegen. Keine GitHub-Settings, Registrierung, Pushes, Reviews oder Deployments durch diese Drafts autorisiert.

requiredChecks.command ist ein Registry-Schlüssel, kein Shellkommando. "forge-v01:baseline" bedeutet bestehende BASE-Typecheck-/Vitest-Suite in isolierter Umgebung; "forge-v01:acceptance-a/b/c" bedeutet vollständige ausgewiesene Acceptance-Suite mit exaktem Testinventar; "forge-v01:mutations-a/b/c" bedeutet die weiter unten festgelegten Verifier-Mutationen auf lokaler Arbeitskopie. Solange der Verifier nicht installiert ist, führt ein unabhängiger trusted Lab-Runner diese Prüfungen aus. Bootstrap muss offen als externer Initial-Trust-Schritt abgenommen werden; der neue Verifier darf seine eigene Entstehung nicht rückwirkend zertifizieren.

Produktionsfiles ideal <300 LOC; keine künstliche Kompression. Geschätzte Zeilen sind keine harte semantische Abbruchgrenze. Tests sind nicht Teil der Produktionsschätzung. Keine Historien-/Remote-API-Fakes als echte Verifikation ausgeben. Sämtliche Netzwerk-/GitHub- und Docker-Abnahmetests müssen mit Testoberflächen laufen, solange kein separater Owner-Auftrag zur Live-Aktivierung vorliegt.

Normative Bindung: SHA256 der UTF-8-JSON-Sequenz [sectionNumber,title,htmlBody] für Abschnitte 1–15, compact JSON ohne abschließenden LF, ist 0e6d89179623535ed431206b2352dfdb66d8edbfad3340d6f10b77ef63c4f0d4. Die Datei results/normative-sections.json im Evidence-Paket trägt genau diese Bytes.

Produktionsschätzung dieses Tasks: 1008 LOC ±30 %, plus eigenständige Tests.

## Ergebnis

Implementiere §§9–11, orchestriere A/B in genau forge-gate und forge-verify. Github.py macht ausschließlich feste GETs. Kein Check-Publisher, kein POST/PATCH/PUT/DELETE-Client. Reviews numeric und exakt gebunden; Edit-/Revocation-/Supersedes-Semantik und Re-run-all-Receipt verpflichtend. Final prüft beide stabilen Snapshot-Runden; policyAssurance bleibt owner_attested für GitHub-Einstellungen.

Baue die Image-Rezeptur mit den festgelegten Toolversionen und A-Kernel. Image-Basis fest Ubuntu 24.04 Linux/amd64. forge/verifier/image-inputs.json bindet den realen Base-Image-Digest, A-Kernel-Commit, Buildrezept-SHA256 und die exakten Toolarchive mit URL/SHA256 (Node: nodejs.org; Python: python.org; Git: kernel.org; Zod: BASE-lock resolved/integrity). Keine Installation ungepinnter latest-Pakete als Ersatz. Erzeuge realen Digest und Manifest; keine Platzhalter in aktivierbarem Workflow. Docker- und Paket-/Imageprüfungen laufen lokal oder auf separat autorisierter Testoberfläche. Der Workflow ist im Draft/Implementations-PR nicht produktiv zu aktivieren, bevor alle Deployment-Gates nachgewiesen sind. Ungetestete native Checkzuordnung ist NO-GO, kein automatischer Architektur-Fallback.

Initialisiere die Policy mit leerem taskIndex und inaktivem Deployment-Nachweis. Beispielplan ist ausdrücklich unregistriert. Für erste Developer-Übung seed clampAtZero(n) als if-Form und feste negative/zero/positive Tests; initial BASE ist grün. Ein späterer separat veröffentlichter Drill-Contract genehmigt ausschließlich Source-MODIFY zur gleichwertigen ternären Form; Mutant return n muss KILLED sein. Equivalent-Mutant ist nur negative Verifier-Fixture und darf nicht als required killable in produktiven Plan geraten.

## Acceptance

Review-/Final-/Workflow-Matrix und deterministische Review-Properties vollständig. Weitere Live-Drills auf separat autorisierter Testoberfläche: native PR-target-Checkzuordnung; ausschließlich Re-run all jobs erfüllt neues Receipt; falscher Trigger-Actor fail; gleicher HEAD bei neuer main-SHA fail; Fake-/Doublechecks fail; global unterbundener push/pull_request/dispatch-Workflow; Owner-OPS erlaubt nur exakten BASE-Scope. Plattformpolicy darf nicht mit Job-Rechten als live_verified ausgegeben werden.

Workflow only pull_request_target types [opened,reopened,synchronize,ready_for_review], base main; permissions: {}; keine anderen Trigger, kein actions/checkout, keine Caches, kein HEAD-Step. forge-verify hat always() und expliziten roten Fehlerpfad bei fehlendem Gate-Erfolg. Frische VM je Job und vollständiger Bootstrap in jedem Job. Keine Auth- oder Container-Fallbacks bei Verfügbarkeitsschwierigkeiten.

## Required Verifier Mutations

C1: review.user.login statt user.id — same-name/wrong-ID Assertion muss scheitern.
C2: neuesten Blocker überspringen — revoke/no-fallback Assertion muss scheitern.
C3: runAttempt aus Gate-Receipt nicht prüfen — rerun-failed-jobs Assertion muss scheitern.
C4: final main-Abgleich auslassen — stale-main Assertion muss scheitern.

## Dependency und Stop

B muss akzeptiert sein; B bindet A transitiv. Vor Ausführung echte Accepted-SHA für B sowie aktuellen Authoring-baseCommit einsetzen und Revision erhöhen. Bootstrap-Veröffentlichung, GitHub-Settings, Image-Push und produktive Aktivierung bleiben gesonderte Owner-Aktionen. Dieser Contract verlangt deren überprüfbare Abnahmebedingungen, autorisiert aber keine kanonischen Änderungen aus dem vorliegenden Spezifikationsauftrag.
