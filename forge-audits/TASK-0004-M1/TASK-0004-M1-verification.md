# TASK-0004 M1 — Regression-Fix und Remote-Verifikation

Status: verified. Kein Produktionscode geändert.

## Identität und Scope

- Repository: Wuerfelduell/Forge
- Ausgangscommit: e9cb8e23c765deee5fab2d16bc0b793f53708714
- M1-Commit: 1de7efeefccb8c0ab130b582d1389f7fc0f5ebf8
- Branch: codex/mystery-task-0005
- Änderung: ausschließlich tests/npc-knowledge.projection.test.ts
- Diff: 17 hinzugefügte, 1 entfernte Zeile.
- Produktionsdateien und Abhängigkeiten: unverändert.

Der gemeinsame project-Testhelfer übergibt jetzt den tatsächlich verwendeten NpcKnowledgeSnapshot, Truth und Solution an expectNoLeaks. Ein eigener Regressionstest prüft sowohl Wertgleichheit als auch fehlende Objektidentität der projizierten Belief-Stance.

Der Test verlangt ausdrücklich beides: Der Inhalt bleibt gleich, das Objekt ist eine neue Instanz. Ein JSON-Vergleich allein reicht nicht.

## Fresh Remote Verification

Aus GitHub frisch geklont, detached HEAD auf dem M1-Commit. Kein Wiederverwenden des Arbeitsverzeichnisses für den Nachweis.

Umgebung: Windows, Node 24.19.0, npm 12.2.0.

| Befehl | Exit | Ergebnis |
|---|---:|---|
| npm ci | 0 | 40 Pakete installiert |
| npm run typecheck | 0 | keine Diagnosen |
| npm test | 0 | 7 Dateien, 452 Tests bestanden |
| git status --porcelain | 0 | leer |
| git ls-remote --heads origin codex/mystery-task-0005 | 0 | zum M1-Push exakt 1de7efeefccb8c0ab130b582d1389f7fc0f5ebf8 |

npm wurde über die separat bereitgestellte npm-cli.js gestartet, da es im anfänglichen PATH nicht enthalten war. Optionales npm-Audit und Update-Notifier waren deaktiviert; fetch_retries=1, fetch_timeout=20000. Keine Tests oder Typechecks wurden deaktiviert. Kein Vulnerability-Audit-Ergebnis wird behauptet.

Der Branch enthält später zusätzliche reine Contract-/Audit-Commits. Der genaue reproduzierbare Prüfstand bleibt der oben genannte M1-SHA.

## Temporäre Mutation analog R4b

Datei: src/domain/npc-knowledge.projection.ts.

Original:

~~~ts
return { kind: "belief", value: stance.value };
~~~

Mutant:

~~~ts
return stance;
~~~

Mutation ausschließlich in einem Vitest/Vite-Transform-Hook im Speicher. Genau eine passende Fundstelle wurde verlangt und tatsächlich ersetzt. Keine Datei geändert.

- Original-Source SHA-256: e55d53130ebe3c8feffd7e7f4f94816461f2cbe0e0b73fcdb71ec4d890129acc
- Mutant-Source SHA-256: d28fdd62be0d6bddfefe065ffb0cebe4234a80e7fc3567856d2860c14816ab03
- Angewendet: 1
- Exit: 1
- TASK-0004-Tests: 155
- Bestanden: 141
- Fehlgeschlagen: 14
- Unhandled errors: 0
- Klassifikation: detected, nicht invalid.

Der neue Test "M1: a visible belief stance is not the source snapshot object" schlägt ausdrücklich fehl. Dasselbe Ergebnis wurde im Arbeitsworktree und im frischen Remote-Clone erzielt.

Vor dem Fix hatte exakt derselbe Belief-Mutant 154/154 TASK-0004-Tests bestanden. Die zusätzliche Identitätsprobe hatte baselineShared=false und mutantShared=true bei gleicher JSON-Ausgabe gezeigt. Der Fix schließt genau diese Lücke.

## Zusätzliche Security-Smokes auf dem frischen M1-Clone

Alle Mutationen betreffen ausschließlich die Projektion. Alle wurden jeweils einzeln genau einmal im Speicher angewendet. Jeder Lauf: 155 TASK-0004-Tests; keine unhandled errors.

| Mutation | Pass | Fail | Exit | Ergebnis |
|---|---:|---:|---:|---|
| Knowledge-Stance direkt zurückgeben | 145 | 10 | 1 | detected |
| Uncertain-Stance direkt zurückgeben | 144 | 11 | 1 | detected |
| Snapshot als nicht-enumerierbares Context-Feld anhängen | 136 | 19 | 1 | detected |
| Snapshot als Symbol-Property anhängen | 136 | 19 | 1 | detected |
| Snapshot als Context-Prototyp verwenden | 136 | 19 | 1 | detected |

Transformierte Source-Hashes:

- Knowledge: a2d3c0e68470b8d3d49248359e84881492142029990c55855d212dc8ecbd686c
- Uncertain: ed08a1cbf238a75fc8640ece60252f3ac307a223574c197c34edbb6a2a67b84f
- Hidden: 3597686e03bddd8548e50f6e529f8763095ecfee8d822902569a826e05d7545a
- Symbol: fd4f757e135495d05e1664d35b16b00fd9ea515707a8532b63d4eb24eaa736d7
- Prototype: af0cc8b11197a27d286bc1d3b2a7b5977492b210835bc3d5eb765458f5c2a182

Diese Nachweise betreffen keine erfundene historische P2-/K9-Zuordnung. Deren ursprüngliche Definitionen lagen nicht versioniert vor.

## Reproduzierbarer In-Memory-Lauf

Im frischen Checkout nach npm ci den folgenden JavaScript-Block per node-stdin ausführen. Nicht als Produktionsdatei speichern. Er verwendet die tatsächlich installierte Vitest-5-API. Der Prozess liefert für den erwarteten erkannten Mutanten Exit 1.

~~~js
(async () => {
  const { startVitest } = await import("vitest/node");
  const { createHash } = await import("node:crypto");
  const target = "/src/domain/npc-knowledge.projection.ts";
  const before = 'return { kind: "belief", value: stance.value };';
  const after = "return stance;";
  let applied = 0;
  let summary;
  const ctx = await startVitest(
    ["tests/npc-knowledge.test.ts", "tests/npc-knowledge.projection.test.ts"],
    {
      run: true,
      maxWorkers: 1,
      reporters: [{
        onTestRunEnd(modules, errors, reason) {
          const tests = modules.flatMap(m => [...m.children.allTests()]);
          summary = {
            reason,
            total: tests.length,
            passed: tests.filter(t => t.result().state === "passed").length,
            failed: tests.filter(t => t.result().state === "failed").map(t => t.fullName),
            errors: errors.map(e => e.message),
          };
        },
      }],
    },
    {
      plugins: [{
        name: "m1-review-in-memory-mutation",
        enforce: "pre",
        transform(code, id) {
          if (!id.replaceAll("\\", "/").endsWith(target)) return;
          const count = code.split(before).length - 1;
          if (count !== 1) throw Error("MUTATION_NOT_APPLIED: " + count);
          const changed = code.replace(before, after);
          applied++;
          console.log(JSON.stringify({
            applied,
            sourceHash: createHash("sha256").update(code).digest("hex"),
            mutantHash: createHash("sha256").update(changed).digest("hex"),
          }));
          return { code: changed, map: null };
        },
      }],
    },
  );
  await ctx.close();
  console.log(JSON.stringify({ applied, ...summary }));
  if (applied !== 1 || !summary || summary.errors.length) process.exitCode = 2;
})().catch(error => {
  console.error(error);
  process.exitCode = 2;
});
~~~

Für die weiteren Mutanten before/after gezielt austauschen. Ein nicht angewendeter Mutant, ein Buildfehler oder ein abgebrochener Lauf zählt niemals als detected.

## Übergabe

M1 ist abgeschlossen und remote verifiziert. Der M1-Commit ist die Implementierungsbasis des separaten TASK-0005-FINAL-CANDIDATE-Contracts. Für TASK-0005 liegt hierdurch keine Architekturfreigabe vor.
