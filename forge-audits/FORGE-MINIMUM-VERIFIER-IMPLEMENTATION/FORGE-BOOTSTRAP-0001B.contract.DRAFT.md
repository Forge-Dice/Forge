---json
{
  "forgeContractFormat": 1,
  "taskId": "FORGE-BOOTSTRAP-0001B",
  "contractVersion": 1,
  "baseCommit": "3d7545d843883418348004e68717399a64da7a7d",
  "dependencies": [
    {
      "taskId": "FORGE-BOOTSTRAP-0001A",
      "acceptedCommit": null
    }
  ],
  "scope": {
    "create": [
      "tools/forge_v01/contract-adapter.mjs",
      "tools/forge_v01/policy.py",
      "tools/forge_v01/scope.py",
      "tools/forge_v01/inventory-reporter.mjs",
      "tools/forge_v01/inventory.py",
      "tools/forge_v01/worker.py",
      "tools/forge_v01/mutations.py",
      "tools/forge_v01/vitest.config.mjs",
      "tests/forge-v01/policy-scope.test.ts",
      "tests/forge-v01/inventory.test.ts",
      "tests/forge-v01/worker.test.ts",
      "tests/forge-v01/mutations.test.ts",
      "tests/forge-v01/properties-b.test.ts"
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
      "command": "forge-v01:acceptance-b"
    },
    {
      "name": "mutations",
      "command": "forge-v01:mutations-b"
    }
  ],
  "mutationSmoke": "required"
}
---

# FORGE-BOOTSTRAP-0001B — Implementation Contract Draft

## Status und bindende Auslegung

DRAFT, nicht registriert und nicht zur Ausführung dieses Auftrags freigegeben. Dieses Dokument verwendet exakt Forge Contract Format 1 des angegebenen aktuellen main. Kein neuer Frontmatter-Key. Normative Details stehen im mitgelieferten FORGE-MINIMUM-VERIFIER-IMPLEMENTATION-PACKAGE.html, Abschnitte 1–18, und im nachstehenden Task-Scope. Die Implementierung ist eine spätere gesonderte Aufgabe.

Die Task-Dateien enthalten keine Architekturwahl mehr: Python-Stdlib für IO, vorhandener TypeScript-Contractparser unverändert, Vitest-Reporter in JavaScript; keine neue Dependency. Keine Änderung bestehender src/forge- oder Domain-Module, package.json, package-lock.json, tsconfig.json oder bestehender Tests. Nur scope.create-Pfade anlegen. Keine GitHub-Settings, Registrierung, Pushes, Reviews oder Deployments durch diese Drafts autorisiert.

requiredChecks.command ist ein Registry-Schlüssel, kein Shellkommando. "forge-v01:baseline" bedeutet bestehende BASE-Typecheck-/Vitest-Suite in isolierter Umgebung; "forge-v01:acceptance-a/b/c" bedeutet vollständige ausgewiesene Acceptance-Suite mit exaktem Testinventar; "forge-v01:mutations-a/b/c" bedeutet die weiter unten festgelegten Verifier-Mutationen auf lokaler Arbeitskopie. Solange der Verifier nicht installiert ist, führt ein unabhängiger trusted Lab-Runner diese Prüfungen aus. Bootstrap muss offen als externer Initial-Trust-Schritt abgenommen werden; der neue Verifier darf seine eigene Entstehung nicht rückwirkend zertifizieren.

Produktionsfiles ideal <300 LOC; keine künstliche Kompression. Geschätzte Zeilen sind keine harte semantische Abbruchgrenze. Tests sind nicht Teil der Produktionsschätzung. Keine Historien-/Remote-API-Fakes als echte Verifikation ausgeben. Sämtliche Netzwerk-/GitHub- und Docker-Abnahmetests müssen mit Testoberflächen laufen, solange kein separater Owner-Auftrag zur Live-Aktivierung vorliegt.

Normative Bindung: SHA256 der UTF-8-JSON-Sequenz [sectionNumber,title,htmlBody] für Abschnitte 1–15, compact JSON ohne abschließenden LF, ist 0e6d89179623535ed431206b2352dfdb66d8edbfad3340d6f10b77ef63c4f0d4. Die Datei results/normative-sections.json im Evidence-Paket trägt genau diese Bytes.

Produktionsschätzung dieses Tasks: 1190 LOC ±30 %, plus eigenständige Tests.

## Ergebnis

Implementiere §§4, 6–8 sowie zugehörige Fehler-/Typgrenzen auf den akzeptierten A-APIs. Der aktuelle parseContractDocument wird direkt aus BASE mit nodeSha256Utf8 importiert. Format 1 unverändert. Die Node-Zod-Auflösung kommt aus dem trusted Image, nicht HEAD. Strict Policy-/Plan-JSON, exact Scope, keine Coordination-Ausnahme, keine impliziten Commands.

Der Worker ist eine frische Docker-Sandbox, kein child_process direkt neben einem privilegierten GitHub-Supervisor. BASE npm ci --ignore-scripts; nur BASE-manifest/lock; direkt gepinnte tsc-/vitest-Entrypoints. Testinventar über Laufzeit-Graph, tuple+occurrence, complete errors/status. Mutationen nach §8, Infrastructure dominiert Assertion-Kill. Ohne verfügbaren Docker-/Quota-/seccomp-Nachweis schlägt Integration fehl; unsandboxed Fallback ist nicht erlaubt.

## Acceptance

Matrixgruppen Scope/Freeze, Testinventar, Worker und Mutation vollständig. Bestehende 1087-Tests-Baseline darf sich durch die neuen Tests vergrößern; Identitäten und Status statt feste Gesamtzahl prüfen. Bestehende Testdateien unverändert. Zusätzlich echte Node-Script-/npmrc-/Config-Injektionsfixtures und Image/Worker-Outputangriffe. Der Worker darf weder Netzwerk noch Docker-Socket/Actions-Commandfiles erreichen; kein stdout-Workflowcommand gelangt ungefiltert ins Hostlog.

Propertyfamilien Scope/Inventory/Mutation mit je 10.000 deterministischen Iterationen. Die sechs clamp-Mutanten aus §8 mit echtem Vitest wiederholen. BASE failure stoppt HEAD; fehlender Test/Report/Timeout zählt nicht als KILLED.

## Required Verifier Mutations

B1: exact Scope auf startsWith umstellen — scope escape Assertion muss scheitern.
B2: vollständiges Inventar auf bloße Gesamtzahl reduzieren — löschen+neue Tests Assertion muss scheitern.
B3: nonzero als KILLED klassifizieren — Compiler-/Timeout-Assertion muss scheitern.
B4: Developer-Mutationsfallback zulassen — fake detected Assertion muss scheitern.

## Dependency

A muss unabhängig akzeptiert sein. Vor Ausführung diese Draftrevision mit echtem acceptedCommit von A und neuem baseCommit versehen, kanonisch neu parsen und hashen. null ist im Domain-Schema legal, im zukünftigen Gate bewusst blockierend. Keine erfundene Accepted-SHA einsetzen.
