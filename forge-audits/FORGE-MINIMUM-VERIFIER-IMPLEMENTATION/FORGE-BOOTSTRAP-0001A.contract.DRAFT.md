---json
{
  "forgeContractFormat": 1,
  "taskId": "FORGE-BOOTSTRAP-0001A",
  "contractVersion": 1,
  "baseCommit": "3d7545d843883418348004e68717399a64da7a7d",
  "dependencies": [],
  "scope": {
    "create": [
      "tools/forge_v01/errors.py",
      "tools/forge_v01/process.py",
      "tools/forge_v01/paths.py",
      "tools/forge_v01/objects.py",
      "tools/forge_v01/history.py",
      "tools/forge_v01/materialize.py",
      "tools/forge_v01/bootstrap.py",
      "tools/forge_v01/stage0.py",
      "tests/forge-v01/git-objects.test.ts",
      "tests/forge-v01/paths.test.ts",
      "tests/forge-v01/materialize.test.ts",
      "tests/forge-v01/bootstrap.test.ts",
      "tests/forge-v01/properties-a.test.ts"
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
      "command": "forge-v01:acceptance-a"
    },
    {
      "name": "mutations",
      "command": "forge-v01:mutations-a"
    }
  ],
  "mutationSmoke": "required"
}
---

# FORGE-BOOTSTRAP-0001A — Implementation Contract Draft

## Status und bindende Auslegung

DRAFT, nicht registriert und nicht zur Ausführung dieses Auftrags freigegeben. Dieses Dokument verwendet exakt Forge Contract Format 1 des angegebenen aktuellen main. Kein neuer Frontmatter-Key. Normative Details stehen im mitgelieferten FORGE-MINIMUM-VERIFIER-IMPLEMENTATION-PACKAGE.html, Abschnitte 1–18, und im nachstehenden Task-Scope. Die Implementierung ist eine spätere gesonderte Aufgabe.

Die Task-Dateien enthalten keine Architekturwahl mehr: Python-Stdlib für IO, vorhandener TypeScript-Contractparser unverändert, Vitest-Reporter in JavaScript; keine neue Dependency. Keine Änderung bestehender src/forge- oder Domain-Module, package.json, package-lock.json, tsconfig.json oder bestehender Tests. Nur scope.create-Pfade anlegen. Keine GitHub-Settings, Registrierung, Pushes, Reviews oder Deployments durch diese Drafts autorisiert.

requiredChecks.command ist ein Registry-Schlüssel, kein Shellkommando. "forge-v01:baseline" bedeutet bestehende BASE-Typecheck-/Vitest-Suite in isolierter Umgebung; "forge-v01:acceptance-a/b/c" bedeutet vollständige ausgewiesene Acceptance-Suite mit exaktem Testinventar; "forge-v01:mutations-a/b/c" bedeutet die weiter unten festgelegten Verifier-Mutationen auf lokaler Arbeitskopie. Solange der Verifier nicht installiert ist, führt ein unabhängiger trusted Lab-Runner diese Prüfungen aus. Bootstrap muss offen als externer Initial-Trust-Schritt abgenommen werden; der neue Verifier darf seine eigene Entstehung nicht rückwirkend zertifizieren.

Produktionsfiles ideal <300 LOC; keine künstliche Kompression. Geschätzte Zeilen sind keine harte semantische Abbruchgrenze. Tests sind nicht Teil der Produktionsschätzung. Keine Historien-/Remote-API-Fakes als echte Verifikation ausgeben. Sämtliche Netzwerk-/GitHub- und Docker-Abnahmetests müssen mit Testoberflächen laufen, solange kein separater Owner-Auftrag zur Live-Aktivierung vorliegt.

Normative Bindung: SHA256 der UTF-8-JSON-Sequenz [sectionNumber,title,htmlBody] für Abschnitte 1–15, compact JSON ohne abschließenden LF, ist 0e6d89179623535ed431206b2352dfdb66d8edbfad3340d6f10b77ef63c4f0d4. Die Datei results/normative-sections.json im Evidence-Paket trägt genau diese Bytes.

Produktionsschätzung dieses Tasks: 1320 LOC ±30 %, plus eigenständige Tests.

## Ergebnis

Implementiere ausschließlich die vertrauenswürdigen Bootstrap-/Objekt-/Pfad-/Prozess- und Materialisierungsgrenzen aus §§2–5, 11–12. APIs: runBounded, cleanEnv, readCommit, readTree, collectTree, collectChanges, validateHistory, validatePath(Set), materialize, destroy, bootstrapTrustedObjects, loadBaseVerifier. Die Namen und Frozen-Datentypen dürfen intern idiomatisch in Python gespiegelt werden, ihre Bedeutung nicht.

stage0.py und seine Primitiven bilden den später digest-gepinnten Image-Kernel. Er lädt nur BASE-Code, HEAD nie. BASE main.py darf zu diesem Zwischenstand fehlen: A wird mit einem harmlosen generierten BASE-Stub außerhalb des Repos geprüft; ein fehlender realer Entry ist FAIL und kein Produktionspass. Git-Kommandos/Umgebung/Refspecs aus §2 exakt; null Git-Checkout, merge-tree, Rename-Heuristik, Shell-eval, untrusted Hook oder PR-Ausführung.

## Acceptance

Alle Matrixfälle Bootstrap, echte Git-/Filesystem-Proben, Pfad/Modes, History und Materialisierung mit den erwarteten Codes umsetzen. Echte adversariale bare Repositories; Replace-/Alternate-/Graft-/Shallow-Fakten auch bei sauberer Env nachweisen. Mode+Content doppelt sichtbar; 2. Parent verboten nur oberhalb BASE. dir_fd/O_NOFOLLOW auf jedem Parent, O_EXCL am Leaf. Prozessgruppen tatsächlich terminieren. Rawobjekt-/Packgrößen während Verarbeitung begrenzen.

Propertyfamilien Tree/Path mindestens 10.000 deterministische Iterationen je Familie; independent oracle; 100/1000/10000 Files und 1k/10k/100k Objects unter gesetzten Budgets messen. Kein Performance-Gate auf absolute Millisekunden.

## Required Verifier Mutations

A1: GIT_NO_REPLACE_OBJECTS entfernen und Layout-Prüfung für refs/replace entfernen — dedizierter Original-Blob-Assertiontest muss scheitern.
A2: O_NOFOLLOW bei Parent-Open entfernen — Parent-Symlink-Assertiontest muss scheitern.
A3: MODE_CHANGE aus Diff entfernen — eigenständiger Mode+Content-Assertiontest muss scheitern.
A4: duplicate Rawtree-Entry vor Prüfung in dict überschreiben — Duplicate-Assertiontest muss scheitern.

Mutanten sind lokale Testinstrumente, keine HEAD-Dateien. Jede Veränderung muss exakt lokalisierbar, einmal angewandt, nicht äquivalent und durch echte Testassertion erkannt sein. Anchorbytes werden nach finaler Implementierung für den Acceptance-Runner eingefroren und vom Reviewer kontrolliert; keine zur Implementierung passende neue Semantik wählen.
