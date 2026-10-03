---json
{
  "forgeContractFormat": 1,
  "taskId": "FORGE-CORE-0001B",
  "contractVersion": 2,
  "baseCommit": "4cbbb25955bf73da0273309e4857de067bc0fb2e",
  "dependencies": [],
  "scope": {
    "create": [
      "tests/forge/repair-v2.test.ts"
    ],
    "modify": [
      "src/forge/runs.ts",
      "src/forge/verification.ts",
      "src/forge/state.ts",
      "tests/forge/verification.test.ts",
      "tests/forge/typecheck.ts",
      "tests/forge/dogfood.test.ts",
      "tests/forge/kernel.test.ts",
      "tests/forge-red-team/findings.test.ts",
      "tests/forge-red-team/model.ts",
      "tests/forge-red-team/differential.test.ts"
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
# FORGE-CORE-0001B v2 — Rename evidence and unambiguous checks

## 1. Verbindlichkeit, Versionierung und Herkunft

Neue, additive Reparaturversion; forge/contracts/FORGE-CORE-0001B.md (v1) bleibt bytegleich.
Die unberührte v1 beschreibt weiterhin Lifecycle, Remote-Outcome, Reviews, Abnahmen, Mutationen und Fehlerprioritäten.
Diese v2 ersetzt ausschließlich ChangedFile/changedFiles-Regeln, Required-Check-Semantik und die hier explizit genannten Grenzen.
Bei Widerspruch gehen die ausdrücklichen v2-Regeln vor. Keine weitere v1-Semantik ändern.

Basis: 4cbbb25955bf73da0273309e4857de067bc0fb2e enthält den separat spezifizierten/implementierten FORGE-CORE-0001A-PATCH-0001.
Ursprünglicher Red-Team-Stand: f712e50a1562233f31564af8218cef9fd1097b7c; Tests dcd08db0113a196e078aee36f9b0bc79b9eed7cc;
Produktion vor Red-Team bd3becb7dfbefc58089d69118f568bf32cab3b7d.
RT-01/03/06 wurden direkt reproduziert; keine Übernahme ausschließlich aus dem Bericht.
RT-06 bleibt im separaten A-Patch. Keine zweite Approval-Reparatur in B v2.

Autorisierung: Nutzer erlaubt diese eng begrenzte Implementation nach vollständigem widerspruchsfreiem Contract und adversarialem Self-Review.
Dies behauptet kein unabhängiges APPROVE. Der finale Code benötigt weiter unabhängigen Review.
dependencies ist leer, weil keine akzeptierten Pilot-Tasks im ForgeLog belegt sind; kein acceptedCommit wird erfunden.
Codeabhängigkeit ist durch baseCommit an den tatsächlichen Patch-Commit gebunden.

## 2. Artefaktpfad und bestehender Kernel

Diese Version liegt zusätzlich unter forge/contracts/FORGE-CORE-0001B.v2.md.
Der bestehende contractPathFor("FORGE-CORE-0001B") verlangt weiterhin forge/contracts/FORGE-CORE-0001B.md.
Der Parser kann v2-Metadaten lesen, aber eine Sidecar-Datei ist kein automatisch registrierbarer canonical contractPath.
Diese Reparatur wird im manuellen Pilot ausgeführt, NICHT als vorgetäuschter Kernel-Run mit falscher contractAtCommit-Beobachtung.
Keine Änderung am 0001A-Pfadresolver, keine stille Überschreibung des v1-Vertrags, keine Migration bestehender Approvals.
Eine spätere Core-Registrierung dieser Sidecar-Version braucht eine gesonderte explizite Artefaktmigration.

## 3. Exakte Dateien

Nur scope.create/modify im Frontmatter für Implementation. Production:
- runs.ts: neue ChangedFile-Union und Eindeutigkeit; Check-Namen-Eindeutigkeit.
- verification.ts: Scope-Regeln, genau ein required Check.
- state.ts: ausschließlich normative Dokumentationskommentare zur State-/Log-Grenze, keine zusätzliche Logik.

Tests:
- repair-v2.test.ts: Regressionen, Schemas, Integration, Unveränderlichkeit, Grenzen.
- verification.test.ts: v1-Erwartungen für Rename/Duplicate/Coordination-Delete umstellen.
- typecheck.ts: neue ChangedFile-Union positive/negative Fälle.
- dogfood.test.ts: fileURLToPath statt URL.pathname (Windows-Baseline-Fehler);
  Dateinamenprüfung erkennt explizite .v2.md-Sidecar bei contractVersion 2, v1-Approvals bleiben an v1 gebunden.
- kernel.test.ts: Eventlog-JSON-Roundtrip statt autoritativer State-Persistenz; "persistent" im Sinne unveränderlicher Datenstrukturen klar benennen.
- findings.test.ts: RT-01/03 zu Regressionen; RT-02 deletion nach neuer Regel; RT-10/12 bleiben Grenztests.
- model.ts: unabhängige v2-Bewertung ohne Produktionshelper.
- differential.test.ts: Generator erzeugt neue Rename-Formen und prüft Duplikat-/Pfad-Grenzen mit unabhängigem Orakel.

Keine Dependencies, Scripts, Mystery-Dateien, CLAUDE.md oder Performance-Änderungen.
Contracts, Koordinations- und Review-Nachweise werden in separaten Dokumentationscommits versioniert, nicht im Implementierungsdiff.

## 4. ChangedFile — strikt diskriminierte Union

ChangedFileSchema bleibt öffentlicher Export unter src/forge/runs.ts; ChangedFile bleibt aus dem Schema abgeleitet.

~~~ts
type ChangedFile =
  | { path: RepoPath; change: "added" | "modified" | "deleted" }
  | { fromPath: RepoPath; toPath: RepoPath; change: "renamed" };
~~~

Zod discriminatedUnion("change", ...) mit strikt geprüften Objektvarianten.
Alle Felder Pflicht; kein Default, Alias oder Fallback. Rename mit path, ohne fromPath/toPath oder mit zusätzlichen Feldern ablehnen.
Auch normale Varianten mit fromPath/toPath ablehnen. Beide Rename-Pfade werden mit vorhandenem RepoPathSchema geprüft.

changedFiles enthält keine mehrfach erwähnten Pfade:
- normale Änderung belegt path;
- Rename belegt fromPath UND toPath;
- alle belegten Pfade müssen global eindeutig sein, einschließlich fromPath != toPath;
- keine Rename-Ketten, überlappenden Normal-/Rename-Einträge oder Doppelmeldungen in einem Net-Diff.
- Issue am späteren Feld ["changedFiles", i, "path"|"fromPath"|"toPath"].
- Im ForgeEvent entsprechend mit ["body","evidence", ...] präfigiert; EVENT_SCHEMA, unveränderter Zustand.
Diese flache Net-Diff-Evidence beschreibt keine chronologische Git-Operationsfolge.

## 5. Scope-Regeln und exakte Diagnostik

Paths sind validierte relative POSIX-RepoPaths. Keine Normalisierung, kein case folding, keine Unicode-Konvertierung.
Coordination bedeutet startsWith("forge/coordination/") auf einem gültigen Pfad.
Der Root "forge/coordination" und "forge/coordinationX/..." zählen nicht dazu.
Nested "forge/coordination/notes/x.md" zählt dazu.
"forge/contracts" bzw. "forge/approvals" selbst sowie ihre Nachfahren sind immer geschützt.

Für normale Änderungen in dieser Reihenfolge:
1. geschützter Pfad → SCOPE_VIOLATION;
2. deleted → immer SCOPE_VIOLATION, AUCH unter coordination;
3. added/modified unter coordination → ausgenommen;
4. added nur exakte Mitgliedschaft scope.create;
5. modified nur exakte Mitgliedschaft scope.modify;
6. sonst SCOPE_VIOLATION.

Rename:
- nur wenn BEIDE Pfade strikt unter coordination liegen, zulässig;
- jeder andere Rename ist violation, selbst wenn beide Pfade in scope stehen;
- geschützte Pfade dürfen durch keine Ausnahme freigegeben werden;
- bei unerlaubtem Rename zwei SCOPE_VIOLATION-Findings, subjects jeweils fromPath und toPath.
  Auch ein einzelner Coordination-Endpunkt wird als beteiligter Pfad genannt.
- Keine zusammengesetzten "a -> b"-Subject-Strings; Failure-Sortierung bleibt Code, dann Subject nach UTF-16 wie v1.

Kein Zugriff auf Git/Filesystem im Evaluator. Ob die Evidence den echten Diff vollständig beschreibt, bleibt Verifier-Vertrauensgrenze.

## 6. Required Checks

VerificationEvidenceSchema erzwingt global eindeutige checks[].name, auch bei gleichen Commands/Exitcodes oder nicht erforderlichen Checks.
Duplikat-Issue am späteren ["checks", j, "name"]; im Event body/evidence-Präfix.
Duplikate sind EVENT_SCHEMA und dürfen keinen Run-State/Log-Eintrag erzeugen.

evaluateVerification bleibt öffentlich und prüft für JEDEN requiredCheck:
- exakt ein Evidence-Eintrag mit gleichem Name;
- dessen command exakt gleich required.command, ohne Whitespace-/Case-Normalisierung;
- dessen exitCode === 0.

Sonst genau ein CHECK_FAILED mit subject = required.name. Dies gilt beim direkten Evaluator-Aufruf auch für mehrfach vorhandene Required-Namen.
Die Count-Prüfung ersetzt some(...); ein fehlgeschlagener oder falscher Command darf nicht durch einen zweiten grünen Eintrag maskiert werden.
Nicht erforderliche Checks sind erlaubt und haben keinen Einfluss auf passed, auch bei Exit ungleich 0, sofern schema-gültig/eindeutig.
Der reine Evaluator ist kein allgemeiner Schema-Importer; Duplikate ausschließlich nicht erforderlicher Namen werden am Evidence-Schema abgewiesen.
Keine zusätzlichen Failure-Codes. Bestehende Sortierung und MutationSource bleiben unverändert.

## 7. Autoritative Persistenz und Vertrauensgrenzen

Normativ: "ForgeLog is authoritative; ForgeState is disposable derived projection produced by replay."
ForgeLog bezeichnet hier das bestehende readonly ForgeEvent[]/state.log, keinen neuen Typ/Exporter.
Persistiert/transportiert werden ausschließlich Events, nicht tasks/runs/acceptance oder der gesamte ForgeState als autoritative Quelle.
Wiederherstellung erfolgt über kernel.replay(deserialisiertes Eventlog) mit derselben explizit konfigurierten ReviewPolicy und Hashfunktion.
Kernel-Konfiguration ist eine Voraussetzung, kein aus manipuliertem State importierter Fakt.

applyEvent/projection/startGate erhalten ausschließlich State aus emptyState, erfolgreichem replay oder erfolgreichem applyEvent unter derselben Policy.
Ein strukturkompatibler, gefälschter oder deserialisierter ForgeState ist nicht unterstützt und wird NICHT durch neue Runtime-Guards authentifiziert.
RT-10 bleibt als Demonstration dieser Trust-Grenze erhalten; kein State-Importer, WeakSet-Brand, DB, Persistenzadapter oder Re-Validation pro Event.

RT-12: Proxies und werfende Getter liegen außerhalb JSON-/validierter Logdaten. Keine Totalitätsgarantie gegen ausführbare JS-Objekte,
kein try/catch-Produktionsfix, keine neue Security-Sandbox.

B22 (acceptedCommitOf nutzt claimedResultCommit statt verifiedCommit) bleibt equivalent NUR für gültige kernel-produced/replayed states.
Begründung: accepted → review_approved → verified und Verifikation erzwingt verifiedCommit == claimedResultCommit.
Keine Äquivalenzbehauptung für manipulierte ForgeState-Objekte oder beliebiges JSON-State.

R11: Leerer Diff und Ergebniscommit == Startcommit bleiben ausdrücklich zulässig bei ansonsten gültiger Evidence.
PERF-1/PERF-2b: Replay-/Projection-Aufwand und vollständiger State-Clone pro applyEvent bleiben bekannte V0.0-Grenzen.
Keine Optimierung. Differential-/Timing-Vergleich gleicher Workload als grober Regressionsindikator, keine plattformabhängige harte Zeitgrenze.

## 8. Kompatibilität/Migration

Öffentliche Funktionsnamen/-Parameter bleiben unverändert. Breaking Datenänderung ausschließlich ChangedFile-Rename-Variante;
Check-Duplikate und gelöschte Coordination-Dateien werden nun abgewiesen.
Alte einpfadige Rename-Logs sind unter v2 schema-ungültig. Aus einem Pfad wird KEIN zweiter Pfad geraten.
Kein automatischer Upgrader; historische Logs mit dem historischen Kernel reproduzierbar lassen.
Auch alte Duplicate-Check-Logs sind nicht still umschreibbar.
Keine Zeitreise-/Legacy-Regel nach eingetragenem ContractVersion: Dieser reparierte Kernel verwendet v2-Regeln für seine Evidence.

## 9. Acceptance Criteria / harte Testmatrix

- B2-01: Implementierungsdiff exakt innerhalb Allowlist, keine v1-Datei/Approval geändert, kein Mystery-/Core-0002-Code.
- B2-02: Zod und TypeScript erzwingen zwei Rename-Pfade; unknown Properties/fehlende Felder/ungültige Pfade abgelehnt.
- B2-03: Rename contract→coordination, coordination→contract, approval→coordination, coordination→approval jeweils violation mit beiden Subjects.
- B2-04: Coordination→coordination einschließlich nested Pfaden zulässig; coordinationX/Root/normal↔coordination abgelehnt.
- B2-05: ../, Backslash, doppelte Slashes, Unicode-Lookalikes in beiden Endpunkten scheitern bereits am RepoPath-Schema.
- B2-06: deleted immer violation; added/modified nur wie Abschnitt 5; protected paths auch bei ausdrücklicher Whitelist verboten.
- B2-07: ChangedFiles-Overlap und from==to: definierte Issuepfade; keine versehentliche Löschung von Evidence.
- B2-08: Duplicate gleiche/konfligierende Ergebnisse in beiden Reihenfolgen abgewiesen; Missing/Wrong-Command/Nonzero CHECK_FAILED.
- B2-09: Extra eindeutiger nicht erforderlicher Check erlaubt; sein Ergebnis ersetzt keinen Required-Check.
- B2-10: Schema-Fehler hängen kein Event an; gültige, aber negativ bewertete Evidence führt wie v1 zum abgeleiteten failed.
- B2-11: Failure-Reihenfolge deterministisch, Results deep-frozen, Inputs unverändert.
- B2-12: Gültiger Log-JSON-Roundtrip + replay entspricht Originalzustand; gefälschte State-Cache-Felder sind nicht die Persistenzquelle.
- B2-13: Alle bestehenden Tests/Typecheck und fresh clone npm ci/typecheck/test grün; Baseline-Fehler und Umgebung dokumentiert.
- B2-14: Red-Team-Fuzzer mindestens 30 Seeds × 300 Schritte, alle bisherigen Coverage-Gates, null Modellabweichungen.
- B2-15: Pflichtmutanten tatsächlich angewendet und detected oder konkret equivalent, kein not_applied als Erfolg.
- B2-16: 0001A-Patch bleibt grün; changes_requested unverändert. RT-12 bleibt ohne Produktionsfix.

## 10. Mutationen und unabhängiges Orakel

Mindestens einzeln:
1. Rename-Ausnahme nur anhand toPath;
2. nur anhand fromPath;
3. ein Coordination-Endpunkt genügt;
4. geschützte Contract-Renames gezielt erlauben;
5. geschützte Approval-Renames gezielt erlauben;
6. Duplicate failed+passed via some akzeptieren;
7. Wrong-Command akzeptieren;
8. Missing Required-Check ignorieren;
9. A-Patch Blocking-Guard entfernen;
10. Eventlog-Wiederherstellungs-Testhelper mutieren: gefälschten State-Cache statt replay(log) verwenden.
   Da keine Persistenz-Produktionsfunktion existiert, ist 10 ein Test-oracle-Smoke, kein angeblich reparierter State-Importer.
   Diesen Unterschied im Bericht offenlegen; keine nicht angewendete Produktionsmutation als Erfolg zählen.
Zusätzlich Schema-Duplicate-Guard sowie deleted-Coordination-Ausnahme mutieren.

Jede Anwendung mit Fundstellenzahl, Before/After, Source-Hash, Mutant-Hash, Testnamen, Exitcode und errors dokumentieren.
Das unabhängige Referenzmodell importiert keine Scope-/Check-/State-Produktionshelper. Schema-Filter bleibt ausdrücklich geteilte Grenze;
neue strukturelle Schema-Regeln werden deshalb separat mit handgeschriebenen Rejection-Tests abgesichert.
Generator um beide Rename-Endpunkte, positive Coordination-Moves und negative protected/near-prefix Moves erweitern.
Keine statistische Verbesserung durch Entfernen schwieriger Cases oder Herabsetzen bestehender Coverage-Grenzen.

## 11. Adversarialer Vertragscheck und Umsetzungsgate

Geprüfte Entscheidungen:
- Kein einpfadiger Rename, keine from/to-Konvention.
- Ein Coordination-Endpunkt schützt den anderen niemals.
- Prefix-Slash plus vorhandenes RepoPath verhindern ../ und Unicode-Lookalikes.
- Check-Duplikate werden unabhängig von Reihenfolge/Ergebnis nicht akzeptiert.
- Extra Checks bleiben informativ; Required-Namen/-Commands sind exakt.
- Approval-Finding-Lücke liegt ausschließlich im separaten A-Patch.
- Keine erfundene Runtime-Validierung von ForgeState; Eventlog ist Wiederherstellungsquelle.
- Alte Contracts/Approvals unverändert; Sidecar-v2 wird nicht als canonical registrierter Kernel-Contract ausgegeben.

Damit ist die begrenzte Semantik festgelegt. Die ausdrückliche konditionale Nutzerfreigabe erlaubt Implementation dieses Contracts;
keine offene Architekturfrage wird durch erfundene Fakten ersetzt. Unabhängiger Code-Review bleibt ausstehend.
Empfohlen weniger als 120 geänderte Produktionszeilen; Tests nicht eingerechnet.
