# V-01 CONTRACT PREFLIGHT

**Geprüftes `main`: `3d7545d843883418348004e68717399a64da7a7d`.** Der Remote-SHA wurde zu Beginn und abschließend geprüft; unverändert.

Der technische Decoder-Vertrag lässt sich konkret spezifizieren. **Eine abschließend schema-konforme Format-2-Hülle ist derzeit nicht belegbar:** Im verfügbaren Code existiert ausschließlich Format 1; die vollständige Contract-System-V2-Spezifikation liegt im verfügbaren Kontext nicht vor. Die fehlenden Details sind unten als **UNRESOLVED** markiert.

Keine Dateien verändert, keine Implementation, keine Commits, Branches, PRs oder Settings-Änderungen.

## 1. Actual-code reconciliation

Die folgenden Angaben stammen aus dem tatsächlichen Baseline-Code:

| Pfad | Vorhandene Exporte / Verhalten | Konsequenz für V-01 |
|---|---|---|
| `src/forge/runs.ts` | `ChangedFileSchema`, `ChangedFile` | Bestehende A/D/M/R-Zielstruktur wiederverwenden |
| `src/forge/runs.ts` | `VerificationEvidenceSchema`, `VerificationEvidence` | Globale Eindeutigkeit der Änderungsendpunkte; keine Mode-/OID-Felder |
| `src/forge/primitives.ts` | `RepoPathSchema`, `RepoPath` | Relative ASCII-Pfade, maximal 255 Zeichen, keine `.`-/`..`-Segmente |
| `src/forge/primitives.ts` | `compareCodeUnits` | Deterministische Sortierung wiederverwenden |
| `src/forge/freeze.ts` | `deepFreeze` | Neu konstruierte Ergebnisobjekte einfrieren; keine Eingabebuffer übergeben |
| `src/forge/verification.ts` | `evaluateVerification` | Scope-, Required-Check- und Mutationsregeln unverändert lassen |
| `src/forge/contract-document.ts` | `ContractMetadataSchema`, `parseContractDocument`, `contractPathFor`, `CONTRACT_HASH_PREFIX` | Aktuell ausschließlich Format 1 |
| `src/forge/start-gate.ts` | `canStartDeveloperRun` | Aktuell `startFromCommit = revision.contractCommit`; noch keine V2-`runBase`-Semantik |
| `tests/forge/dogfood.test.ts` | Inventarprüfung direkt unter `src/forge` und `tests/forge` | Das frühere Verzeichnis `src/forge/verifier/` würde als nicht abgedeckter Eintrag auffallen |
| `tsconfig.json` | `include: ["src", "tests"]` | Neue Geschwisterverzeichnisse werden ohne Konfigurationsänderung geprüft |

**Korrigierte Platzierung:** `src/forge-verifier/` und `tests/forge-verifier/`. Keine Anpassung historischer Contracts oder des Dogfood-Tests.

Wichtige bestehende Semantik:

- `ChangedFileSchema` ist strikt.
- Rename benötigt `fromPath` und `toPath`.
- `VerificationEvidenceSchema` verbietet mehrfach verwendete Endpunkte.
- `evaluateVerification` verbietet Deletes und erlaubt ausschließlich die bestehende Coordination→Coordination-Rename-Ausnahme.
- V-01 darf einen Delete korrekt **dekodieren**, obwohl der nachgeschaltete Scope-Evaluator ihn ablehnt.
- Ein erfolgreiches Decoder-Ergebnis ist keine bestandene Forge-Verifikation.

Die vorhandenen `ok`-basierten Result-Unions werden als Stil übernommen. Es entsteht kein neues Finding-/Severity-System.

## 2. Semantic decisions

Der endgültige Entwurf in Abschnitt 12 trifft diese Entscheidungen:

1. **Eine öffentliche Dekodierfunktion** mit vier Byte-Eingaben.
2. Private Raw-Diff- und Tree-Parser.
3. Keine Git-Ausführung und keine Commit-Auswahl.
4. Vollständige Prüfung beider Trees.
5. Dreifacher Konsistenzvergleich:

   ```text
   aus Trees berechnete Differenz
   = no-renames Diff
   = expandierter rename-aware Diff
   ```

6. Separates reichhaltiges Git-Modell; unveränderte Abbildung auf `ChangedFile`.
7. SHA-1-Objektformat als ausdrückliche V0.1-Beschränkung.
8. Erste deterministisch gefundene Verletzung als strukturierter Fehler.
9. Rekursiv readonly und eingefrorene Ergebnisse ohne Eingabereferenzen.

**Korrektur gegenüber dem Spike-Bericht:** Die zukünftige Auswahl der Basis richtet sich nach dem freigegebenen `runBase`. Der gegenwärtige Format-1-Start bei Contract-Commit C wird nicht als zukünftige Regel übernommen.

## 3. Portable-tree profile

Das Profil bleibt bewusst eng:

| Eigenschaft | Entscheidung |
|---|---|
| Reguläre Datei `100644` | Zulässig |
| Executable `100755` | Ablehnen |
| Symlink `120000` | Ablehnen |
| Gitlink `160000` | Ablehnen |
| Expliziter Directory-Record `040000` | Ablehnen; erwartet wird rekursive Leaf-Ausgabe ohne `-t` |
| Typwechsel `T` | Ablehnen |
| Unicode einschließlich NFC/NFD | Ablehnen, nicht normalisieren |
| Ungültiges UTF-8 | Ablehnen |
| Tabs, Newlines, Spaces in Pfaden | Ablehnen |
| `.git`-Segment, unabhängig von ASCII-Großschreibung | Ablehnen |
| Windows-Gerätenamen | Ablehnen |
| Abschließender Punkt/Space je Segment | Ablehnen |
| Casefold-Kollision im selben Tree | Ablehnen |
| Directory-Prefix-Kollision | Ablehnen |
| Case-only Rename zwischen zwei jeweils gültigen Trees | Dekodierbar |
| Leerer Diff | Zulässig, sofern beide Trees dazu passen |
| Verbotener unveränderter Eintrag | Ebenfalls ablehnen |

Das Profil prüft Git-Pfade anhand ihrer Bytes. Es hängt nicht von Windows-, Linux- oder macOS-Dateisystemverhalten ab.

## 4. Rename consistency

Rename wird als Git-Diff-Interpretation behandelt, nicht als Beweis einer historischen `git mv`-Operation.

Für einen Rename:

```text
R(score, fromPath, toPath, oldMode, newMode, oldOid, newOid)
```

muss die elementare Darstellung genau lauten:

```text
D(fromPath, oldMode, 000000, oldOid, ZERO_OID)
A(toPath,   000000, newMode, ZERO_OID, newOid)
```

Verglichen werden **Pfad, Status, beide Modi und beide OIDs**. Der Score ist kein Bestandteil der elementaren Änderung.

Ein zusätzlicher Tree-Abgleich verhindert, dass beide Diffs gemeinsam dieselbe Änderung unterschlagen.

## 5. Mapping

Nur folgende Abbildung ist zulässig:

| Git-Record | Bestehender `ChangedFile` |
|---|---|
| A | `{ path: after.path, change: "added" }` |
| D | `{ path: before.path, change: "deleted" }` |
| M | `{ path: before.path, change: "modified" }` |
| R | `{ fromPath: before.path, toPath: after.path, change: "renamed" }` |
| T | Kein Mapping; Fehler |

Modi, OIDs und Rename-Score bleiben ausschließlich im reichhaltigen Git-Ergebnis.

Es gibt keine Coordination-, Contract- oder Approval-Ausnahme im Decoder. Diese Entscheidungen bleiben beim vorhandenen Evaluator.

## 6. Error model

Vorgesehen sind 13 Codes:

```text
INVALID_INPUT
RESOURCE_LIMIT
TRUNCATED_INPUT
MALFORMED_RAW_DIFF
MALFORMED_TREE
UNSUPPORTED_STATUS
INVALID_MODE
INVALID_OID
INVALID_PATH
PATH_COLLISION
DUPLICATE_CHANGE
TREE_MISMATCH
RENAME_MISMATCH
```

Keine frei formulierten Fehlermeldungen als vertragliche Schnittstelle, keine Exceptions für fehlerhafte normale Byte-Eingaben.

Die genaue Fehlerpriorität steht im finalen Entwurf.

## 7. Resource limits

| Grenze | Vorschlag |
|---|---:|
| Je Diff-Stream | 4.194.304 Bytes |
| Je Tree-Stream | 8.388.608 Bytes |
| Je Tree | 20.000 Leaf-Einträge |
| Je Diff | 10.000 Records |
| Expandierter Rename-Diff | 10.000 elementare Änderungen |
| Pfadlänge | 255 ASCII-Bytes |

Der reale Spike mit **12.001 Änderungen und 1.332.107 Bytes** überschreitet damit die Record-Grenze, nicht die Byte-Grenze.

Alle Grenzen sind inklusive. Überschreitungen liefern `RESOURCE_LIMIT`, niemals ein teilweise erfolgreiches Ergebnis.

## 8. Test matrix

Die vollständige Matrix steht als normativer Bestandteil in Abschnitt 12/C9.

Sie umfasst 84 benannte Testgruppen mit zusätzlichen parametrisierten Varianten. Mehr als 40 davon prüfen ablehnungsrelevante oder sonstige adversariale Fälle.

Die realen Spike-Ausgaben werden in kleine, überprüfbare Byte-Fixtures übertragen. Tests dürfen weder das temporäre Laborverzeichnis voraussetzen noch Git aufrufen.

## 9. Mutation plan

Zwölf gezielte Smokes sind in Abschnitt 12/C10 definiert.

Sie prüfen unter anderem:

- Akzeptanz verbotener Modi;
- Verlust eines Rename-Endpunkts;
- falsche Behandlung von NUL/Zeilenumbrüchen;
- ausgelassene Tree-/Rename-Abgleiche;
- fehlende Casefold-Prüfung;
- ignorierte Ressourcenlimits;
- Eingabepuffer-Aliasing.

Das ist ausdrücklich **kein vollständiges Mutation Testing**.

## 10. Scope estimate

Die frühere Schätzung von 300–390 Produktionszeilen war für die vollständige Sicherheitssemantik zu optimistisch.

Mit:

- vier strikt geprüften Eingabeströmen,
- vollständiger Tree-Differenz,
- zwei Konsistenzvergleichen,
- Portabilitätsprüfung,
- stabiler Fehlerpriorität,
- readonly Ergebnistypen

sind **etwa 450–550 Produktionszeilen** plausibel. Testcode: ungefähr 1.000–1.500 Zeilen einschließlich Fixtures und Typtests.

Unter 400 Zeilen bleibt ein Ziel, keine Aufforderung zu komprimiertem Sicherheitscode. Oberhalb von 550 Produktionszeilen sollte der Developer die Aufteilung begründen, ohne eigenmächtig den Scope zu erweitern.

## 11. Contract loophole review

Diese möglichen Fehlinterpretationen wurden im folgenden Entwurf geschlossen:

| Nr. | Schlupfloch | Geschlossene Regel |
|---:|---|---|
| 1 | Beide Diffs unterschlagen dieselbe Datei | Vollständiger Tree-Delta-Abgleich |
| 2 | Nur veränderte Zielpfade werden geprüft | Vollständige Prüfung beider Trees |
| 3 | Verbotene Dateien im Basistree werden ignoriert | Kein Bestandsschutz im Profil |
| 4 | `A/x` und `a/y` gelten als verschieden | Casefold-Prüfung sämtlicher Directory-Prefixe |
| 5 | Datei `a` und Datei `a/b` werden akzeptiert | Datei-/Directory-Konfliktprüfung |
| 6 | Case-only Rename wird als globale Kollision verworfen | Trees getrennt prüfen; keine gemeinsame Casefold-Menge |
| 7 | Rename-Score wird als Inhaltsbeweis behandelt | Score ist Annotation; OIDs unabhängig prüfen |
| 8 | Modi/OIDs werden beim Rename-Abgleich ignoriert | Vollständige elementare Tupel vergleichen |
| 9 | Ein Rename-Endpunkt wird verworfen | Beide Endpunkte prüfen, erhalten und vergleichen |
| 10 | Unsupported Records werden übersprungen | Gesamtoperation schlägt fehl |
| 11 | Letzter unvollständiger Record wird ignoriert | Zwingende NUL-Terminierung und vollständige Arity |
| 12 | `trim()` repariert gefährliche Pfade | Keine Normalisierung |
| 13 | Ungültiges UTF-8 wird durch Ersatzzeichen repariert | ASCII-Byteprüfung vor Stringübernahme |
| 14 | Ein leerer Diff umgeht die Tree-Prüfung | Empty-Diff ist kein früher Success-Pfad |
| 15 | Limits werden erst nach großen Allokationen geprüft | Byte-Gates vor Tokenisierung; Record-Gates während Verarbeitung |
| 16 | Buffer-Subview wird als gesamter Backing-Buffer gelesen | `byteOffset` und `byteLength` beachten |
| 17 | `__proto__` wird als Dictionary-Sonderfall behandelt | Kollisionsverwaltung mit `Map`/`Set` |
| 18 | Ergebnis hält Eingabebuffer fest | Ausschließlich neue Plain-Data-Ergebnisse |
| 19 | Locale-Sortierung verändert Resultate | Vorhandenes `compareCodeUnits` |
| 20 | Decoder bestätigt Prozess-/Remote-Erfolg | Explizite externe Vorbedingungen |
| 21 | Neue Dateien brechen historische Dogfood-Regeln | Geschwisterverzeichnisse statt `src/forge/verifier/` |
| 22 | C, M und `runBase` werden gleichgesetzt | Commit-Auswahl vollständig außerhalb des Decoders |
| 23 | Format 2 wird durch Format-1-Felder erfunden | Unbekannte Wire-Details ausdrücklich UNRESOLVED |
| 24 | Fehlerhafte Smoke-Auswahl gilt als bestanden | Nachweis ausgeführter Zieltests erforderlich |

## 12. FINAL DRAFT IMPLEMENTATION CONTRACT

### C0 — Format-2-Hülle und Verbindlichkeitsgrenze

**Der folgende Header ist ein Format-2-Schema-Kandidat, kein nachgewiesen schema-konformes registrierbares Dokument.** Die `UNRESOLVED`-Werte sind redaktionelle Platzhalter und dürfen nicht als ausführbare Metadaten verwendet werden.

Die konkrete Wire-Repräsentation von `reads`, Revisionen, Dependencies und weiteren Metadaten muss gegen die autoritative Format-2-Spezifikation reconciled werden. Die technische Semantik C1–C11 ist vollständig ausformuliert.

```text
---json
{
  "forgeContractFormat": 2,
  "taskId": "V-01",
  "title": "Canonical Git Diff and Tree Decoder",
  "specifiedAgainst": "3d7545d843883418348004e68717399a64da7a7d",
  "revision": "UNRESOLVED: authoritative Format-2 representation",
  "supersedes": "UNRESOLVED: representation for the first revision",
  "reads": [
    "src/forge/runs.ts",
    "src/forge/primitives.ts",
    "src/forge/freeze.ts",
    "src/forge/verification.ts",
    "src/forge/contract-document.ts",
    "src/forge/start-gate.ts",
    "src/forge/events.ts",
    "src/forge/state.ts",
    "src/forge/kernel.ts",
    "tests/forge/runs.test.ts",
    "tests/forge/verification.test.ts",
    "tests/forge/repair-v2.test.ts",
    "tests/forge/dogfood.test.ts",
    "forge/contracts/FORGE-CORE-0001A.md",
    "forge/contracts/FORGE-CORE-0001A-PATCH-0001.md",
    "forge/contracts/FORGE-CORE-0001B.md",
    "forge/contracts/FORGE-CORE-0001B.v2.md",
    "forge/BASELINE-STATUS.md",
    "package.json",
    "package-lock.json",
    "tsconfig.json"
  ],
  "scope": {
    "create": [
      "src/forge-verifier/git-change-set.ts",
      "tests/forge-verifier/git-change-set.fixture.ts",
      "tests/forge-verifier/git-change-set.test.ts",
      "tests/forge-verifier/git-change-set.typecheck.ts"
    ],
    "modify": []
  },
  "dependencies": "UNRESOLVED: Format-2 dependency representation and accepted references",
  "requiredChecks": [
    {
      "name": "typecheck",
      "command": "npm run typecheck"
    },
    {
      "name": "test",
      "command": "npm test"
    },
    {
      "name": "diff-check",
      "command": "git diff --check"
    }
  ],
  "mutationSmoke": "required"
}
---
```

Es gibt kein Statusfeld, kein Approval, keinen erfundenen Reviewer und keinen vorweggenommenen `runBase`.

Die Leseliste bezeichnet die tatsächlichen Codeabhängigkeiten. Ob Format 2 dafür zusätzlich Blob-IDs oder andere Bindungsdaten verlangt, bleibt UNRESOLVED.

### C1 — Ziel und Grenzen

V-01 implementiert einen synchronen, deterministischen Decoder für:

- zwei zusammengehörige Git-Raw-Diffs;
- den vollständigen Basis-Tree;
- den vollständigen Ziel-Tree.

Der Decoder prüft Syntax, Portabilität, Eindeutigkeit und gegenseitige Konsistenz. Er gibt reichhaltige Git-Records sowie bestehende Forge-`ChangedFile`-Records zurück.

Er bestätigt **nicht**:

- dass Git tatsächlich ausgeführt wurde;
- dass ein Prozess erfolgreich war;
- dass die Trees von GitHub stammen;
- dass die angegebenen OIDs zu existierenden oder korrekt gehashten Objekten gehören;
- dass Scope-Regeln erfüllt sind;
- dass ein Forge-Run erfolgreich verifiziert wurde.

Git-Erhebung und Authentizität bleiben außerhalb dieses Tasks.

### C2 — Dateiallowlist und Wiederverwendung

Nur die vier unter `scope.create` genannten Dateien dürfen angelegt werden.

**Keine bestehenden Dateien verändern.**

Insbesondere unverändert:

```text
src/domain/**
src/forge/**
tests/forge/**
tests/forge-red-team/**
forge/contracts/**
forge/approvals/**
forge/reviews/**
forge/coordination/**
.github/**
package.json
package-lock.json
tsconfig.json
```

Alle anderen nicht ausdrücklich erlaubten Pfade sind ebenfalls ausgeschlossen.

Der Produktionscode darf aus bestehenden Modulen ausschließlich importieren:

```text
../forge/runs.ts
  ChangedFileSchema
  type ChangedFile

../forge/primitives.ts
  RepoPathSchema
  compareCodeUnits

../forge/freeze.ts
  deepFreeze
```

Tests dürfen zusätzlich `VerificationEvidenceSchema` und `evaluateVerification` verwenden.

Keine neue Dependency. Keine Imports aus Mystery-Modulen. Keine Prozess-, Filesystem-, Netzwerk-, Zeit- oder Zufalls-APIs im neuen Produktionsmodul.

### C3 — Öffentliche API

Einziger öffentlicher Funktions-Export:

```ts
decodeGitChangeSet(
  input: GitChangeSetInput
): DecodeGitChangeSetResult
```

Öffentliche Typ-Exporte:

```text
GitChangeSetInput
GitEntry
GitChange
GitChangeSet
GitDecodeErrorCode
GitDecodeError
DecodeGitChangeSetResult
```

Keine weiteren öffentlichen Exporte, insbesondere keine getrennt öffentlich verwendbaren Parser oder Mapping-Helfer.

#### Eingabe

```ts
type GitChangeSetInput = {
  readonly baseTree: Uint8Array;
  readonly headTree: Uint8Array;
  readonly elementaryDiff: Uint8Array;
  readonly renameDiff: Uint8Array;
};
```

Die Funktion liest exakt den jeweiligen View-Bereich. Bytes außerhalb von `byteOffset`/`byteLength` gehören nicht zur Eingabe.

Node-`Buffer` als gewöhnlicher `Uint8Array`-View ist zulässig.

Geteilte `SharedArrayBuffer`-Eingaben sind unzulässig. Die API verlangt gewöhnliche, nicht abgetrennte Byte-Views und ein gewöhnliches Datenobjekt. Proxy-/Getter-Angriffe auf den JavaScript-Aufrufrahmen sind nicht Bestandteil dieses Byteformat-Vertrags.

#### Erfolgreiche Einträge

```ts
type GitEntry = {
  readonly path: string;
  readonly mode: "100644";
  readonly oid: string;
};
```

`oid` enthält exakt 40 kleine Hex-Zeichen und ist nicht die Null-OID.

#### Erfolgreiche Änderungen

`GitChange` ist eine readonly diskriminierte Union:

| `status` | `before` | `after` | `score` |
|---|---|---|---|
| `"A"` | `null` | `GitEntry` | `null` |
| `"D"` | `GitEntry` | `null` | `null` |
| `"M"` | `GitEntry` | `GitEntry` | `null` |
| `"R"` | `GitEntry` | `GitEntry` | Integer 50–100 |

Zusätzlich gilt:

- M: gleicher Pfad, unterschiedliche OIDs.
- R: verschiedene Pfade.
- R: gleiche oder unterschiedliche OIDs zulässig.
- Der Score wird nicht aus Inhalten berechnet.
- Aus `R100` wird kein zusätzlicher Inhaltsbeweis abgeleitet.

#### Ergebnis

```ts
type GitChangeSet = {
  readonly profile: "forge-git-change-set-v1";
  readonly baseTree: readonly GitEntry[];
  readonly headTree: readonly GitEntry[];
  readonly elementaryChanges: readonly Exclude<
    GitChange,
    { readonly status: "R" }
  >[];
  readonly changes: readonly GitChange[];
  readonly changedFiles: readonly Readonly<ChangedFile>[];
};
```

```ts
type DecodeGitChangeSetResult =
  | {
      readonly ok: true;
      readonly value: GitChangeSet;
    }
  | {
      readonly ok: false;
      readonly error: GitDecodeError;
    };
```

Alle Ergebnisobjekte und Arrays, einschließlich Fehlerobjekten, sind rekursiv eingefroren. Keine Eingabereferenz wird übernommen oder eingefroren.

### C4 — Externe Vorbedingungen und Bytegrammatik

#### Externe Vorbedingungen

Der spätere Aufrufer muss garantieren:

- erfolgreiche, vollständig abgeschlossene Git-Prozesse;
- nicht abgeschnittene stdout-Bytes;
- stderr nicht mit stdout vermischt;
- zwei feste, zusammengehörige Trees;
- Diff-Basis = freigegebener Run-Start `runBase`;
- Diff-Ziel = zu prüfender Ergebniscommit;
- korrekt gehärtete Git-Objektansicht.

Diese Bedingungen kann V-01 aus Bytes allein nicht beweisen. Es gibt deshalb keinen frei setzbaren `processSucceeded`-Boolean im Decoder.

`specifiedAgainst`, Contract-Inhaltscommit C, Registrierungsmerge M und `runBase` sind unterschiedliche Begriffe. V-01 wählt keinen dieser Commits aus und verändert den bestehenden Kernel nicht.

#### Erwartete Produzentenformate

Elementarer Diff:

```text
git diff --raw --no-abbrev --no-renames -z
         --no-ext-diff --no-textconv
         --ignore-submodules=none --no-color
         START RESULT --
```

Sekundärer Diff:

```text
git -c diff.renameLimit=0 diff
    --raw --no-abbrev --find-renames=50% -l0 -z
    --no-ext-diff --no-textconv
    --ignore-submodules=none --no-color
    START RESULT --
```

Trees:

```text
git ls-tree --full-tree -r -z TREE
```

Keine Pathspec-Einschränkung, kein `--abbrev`, kein `-t`, kein Combined-Diff.

Diese Befehle dokumentieren das Eingabeformat. **V-01 führt sie nicht aus.**

#### Raw-Diff

Notation:

```text
SP  = Byte 0x20
TAB = Byte 0x09
NUL = Byte 0x00
```

Ein Record:

```text
":" oldMode SP newMode SP oldOid SP newOid SP status NUL path NUL
```

Ein Rename:

```text
":" oldMode SP newMode SP oldOid SP newOid SP "R" score NUL fromPath NUL toPath NUL
```

Regeln:

- Genau ein SP zwischen Headerfeldern.
- Kein zusätzlicher Headertext.
- Keine führenden oder abschließenden Header-Leerzeichen.
- Jeder nichtleere Stream endet mit NUL.
- Jeder Record besitzt exakt die durch seinen Status bestimmte Zahl von Pfaden.
- Leere Pfade sind unzulässig.
- Keine Zeilenverarbeitung, kein Trimmen, kein Quoting-/Unquoting-Verfahren.

Zulässige Status-Tokens:

- `elementaryDiff`: exakt `A`, `D`, `M`.
- `renameDiff`: exakt `A`, `D`, `M` oder `R` plus drei Dezimalstellen mit Wert 50–100.

Damit sind beispielsweise `R050`, `R097`, `R100` zulässig; `R50`, `R049`, `R101` nicht.

`T`, `C`, `U`, `X`, `B`, score-behaftete M-Records und alle weiteren Statusformen werden nicht übersprungen.

#### Modi und OIDs

Erfolgreich verwendbare Modi:

```text
000000 = fehlende Seite eines A-/D-Records
100644 = vorhandene reguläre Datei
```

OIDs:

```text
OID      = exakt 40 Bytes aus [0-9a-f]
ZERO_OID = 40-mal "0"
```

Für jede Seite gilt:

```text
mode == 000000  genau dann, wenn  oid == ZERO_OID
```

Zusätzlich:

- A: alte Seite fehlt, neue Seite existiert.
- D: alte Seite existiert, neue Seite fehlt.
- M/R: beide Seiten existieren.
- M mit identischem Modus und identischer OID ist kein gültiger Änderungsrecord.
- SHA-256-OIDs mit 64 Zeichen gehören nicht zu diesem Profil.

#### Tree-Records

```text
mode SP type SP oid TAB path NUL
```

Im erfolgreichen Profil:

```text
mode = "100644"
type = "blob"
oid  = nicht-null SHA-1-OID
```

TAB trennt Header und Pfad. Weitere Tabs sind Pfadbytes und werden als ungültiger Pfad abgelehnt.

Leere Tree-Streams sind zulässig. Directory-Records gehören nicht zum erwarteten Leaf-Format.

### C5 — Portable Pfade und vollständige Trees

Jeder Pfad muss:

1. zwischen 1 und 255 Bytes lang sein;
2. ausschließlich ASCII-Bytes enthalten;
3. `RepoPathSchema` erfüllen;
4. zusätzliche folgende Profilregeln erfüllen.

Für jedes Segment:

- weder `.` noch `..`;
- nicht `.git`, unabhängig von ASCII-Groß-/Kleinschreibung;
- kein abschließender Punkt;
- kein abschließender Space;
- kein reservierter Windows-Gerätename.

Reservierte Gerätenamen, case-insensitive:

```text
CON PRN AUX NUL
COM1 COM2 COM3 COM4 COM5 COM6 COM7 COM8 COM9
LPT1 LPT2 LPT3 LPT4 LPT5 LPT6 LPT7 LPT8 LPT9
```

Die Prüfung erfolgt gegen den Segmentteil vor dem ersten Punkt. Dadurch wird auch `NUL.txt` abgelehnt.

`COM0`, `COM10` und `CONSOLE` werden durch diese Gerätenamenregel nicht verboten.

Weitere Konsequenzen der ASCII-/`RepoPath`-Regeln:

- Keine Unicode-Normalisierung.
- Keine ungültigen UTF-8-Sequenzen.
- Keine Tabs, Newlines, CR, Spaces, Backslashes oder Doppelpunkte.
- Keine absoluten Pfade, doppelten Slashes oder abschließenden Slashes.
- Keine Behandlung von Backslash als alternativem Separator.

`.gitignore`, `.github` und `.gitmodules` sind nicht das Segment `.git` und werden von dieser Regel nicht pauschal verboten. Ob ihre Änderung erlaubt ist, entscheidet eine externe Policy.

#### Kollisionen je Tree

Für Basis und Ziel **jeweils getrennt** prüfen:

- keine identischen vollständigen Pfade;
- keine ASCII-casefold-gleichen verschiedenen Pfade;
- keine unterschiedlich geschriebenen casefold-gleichen Directory-Prefixe;
- kein Pfad zugleich Datei und Directory-Prefix.

Beispiele:

```text
a.txt + A.txt          → PATH_COLLISION
Dir/a + dir/b          → PATH_COLLISION
a + a/b               → PATH_COLLISION
A + a/b               → PATH_COLLISION
Dir/a + Dir/b         → zulässig
```

Casefold bedeutet ausschließlich `A`–`Z` → `a`–`z`. Kein localeabhängiges Verfahren.

Zwischen Basis- und Zieltree wird keine gemeinsame Kollisionsmenge gebildet. Deshalb kann `old.txt` → `OLD.txt` dekodiert werden, wenn beide Trees einzeln gültig sind.

Verbotene Modi und Pfade werden auch bei unveränderten Einträgen abgelehnt.

### C6 — Vollständigkeit und Rename-Abgleich

#### Eindeutigkeit der Diffs

In jedem Diff dürfen Pfade nicht mehrfach verwendet werden:

- A/D/M reservieren einen Pfad.
- R reserviert beide Endpunkte.
- Beide Endpunkte eines R müssen verschieden sein.
- Eine Wiederverwendung als Quelle oder Ziel eines anderen Records ist ebenfalls unzulässig.

Das entspricht der bestehenden Endpoint-Eindeutigkeit der Forge-Evidence.

#### Tree-Differenz

Aus vollständigen Basis-/Zielmaps wird eine erwartete elementare Menge berechnet:

- nur im Ziel: A;
- nur in der Basis: D;
- gleicher Pfad, andere OID: M;
- gleicher Pfad, gleiche OID: kein Record.

Alle vorhandenen Einträge haben nach C5 Mode `100644`.

Die erwartete Menge muss exakt dem dekodierten `elementaryDiff` entsprechen.

Keine fehlenden, zusätzlichen oder abweichenden Records. Andernfalls:

```text
TREE_MISMATCH
```

Damit wird beispielsweise auch erkannt:

- beide Diffs verschweigen dieselbe Änderung;
- ein Diff verwendet eine falsche OID;
- ein leerer Diff behauptet Gleichheit unterschiedlicher Trees.

#### Rename-Differenz

A/D/M aus dem sekundären Diff bleiben unverändert.

Jeder R wird exakt in D+A expandiert:

```text
before → D mit ursprünglichem Pfad, Modus und OID
after  → A mit ursprünglichem Pfad, Modus und OID
```

Die expandierte Menge muss exakt dem `elementaryDiff` entsprechen. Andernfalls:

```text
RENAME_MISMATCH
```

Vergleich unabhängig von Eingabereihenfolge; vollständig über Status, Pfade, Modi und OIDs.

Ein Score wird nicht neu berechnet. Unterschiedliche gültige Rename-Paarungen können zu unterschiedlichen reichhaltigen Resultaten führen. V-01 garantiert Gleichheit für identische Bytes und Record-Permutationen, nicht für unterschiedliche Git-Heuristikentscheidungen.

### C7 — Mapping, Determinismus und Fehler

#### Mapping

`changedFiles` wird ausschließlich aus den validierten sekundären Records konstruiert:

```text
A → { path: after.path, change: "added" }
D → { path: before.path, change: "deleted" }
M → { path: before.path, change: "modified" }
R → { fromPath: before.path, toPath: after.path, change: "renamed" }
```

Jeder Record muss `ChangedFileSchema` erfüllen.

Keine zusätzlichen Felder, keine Mode-/OID-Übertragung, keine Scope-Ausnahmen.

#### Sortierung

- Tree-Arrays: nach `path`.
- Änderungsarrays: nach `before.path`, wenn vorhanden, sonst `after.path`.
- `changedFiles`: gleiche Reihenfolge wie `changes`.
- Vergleiche mit `compareCodeUnits`.
- Keine `localeCompare`-Verwendung.
- Keine In-place-Sortierung fremder Arrays.
- Bei gültigen Records sind Sortierschlüssel durch Endpoint-Eindeutigkeit eindeutig.

Identische Inputs erzeugen strukturell identische und identisch JSON-serialisierbare Ergebnisse auf Windows, Linux und macOS.

Eine Permutation gültiger Records innerhalb der vier Streams verändert das erfolgreiche Ergebnis nicht.

#### Fehlerstruktur

```ts
type GitDecodeError = {
  readonly code: GitDecodeErrorCode;
  readonly source:
    | "input"
    | "baseTree"
    | "headTree"
    | "elementaryDiff"
    | "renameDiff"
    | "comparison";
};
```

Keine zusätzlichen Nachrichten, Stacktraces oder Rohbytes.

| Code | Bedeutung |
|---|---|
| `INVALID_INPUT` | Fehlender/falscher Byte-View oder unzulässiger geteilter Buffer |
| `RESOURCE_LIMIT` | Byte-, Record-, Tree- oder Expansionsgrenze überschritten |
| `TRUNCATED_INPUT` | Fehlende Terminierung oder fehlender erforderlicher Pfad |
| `MALFORMED_RAW_DIFF` | Fehlerhafter Header, Combined-Diff, ungültige Score-Syntax/-Range oder unmögliche Record-Form |
| `MALFORMED_TREE` | Fehlerhafte Tree-Grammatik oder falscher Objekttyp |
| `UNSUPPORTED_STATUS` | Nicht unterstützter Status; R im elementaren Stream |
| `INVALID_MODE` | Ungültiger oder vom Profil verbotener Modus |
| `INVALID_OID` | OID-Format, Null-OID oder Nullmodus/OID-Zuordnung ungültig |
| `INVALID_PATH` | Pfad verletzt C5 |
| `PATH_COLLISION` | Kollision innerhalb eines Trees |
| `DUPLICATE_CHANGE` | Wiederverwendung eines Diff-Endpunkts |
| `TREE_MISMATCH` | Tree-Differenz und elementarer Diff widersprechen sich |
| `RENAME_MISMATCH` | Expandierter sekundärer Diff widerspricht elementarem Diff |

#### Fehlerpriorität

Es wird genau ein Fehler zurückgegeben:

1. Eingabearten prüfen.
2. Alle vier Byte-Grenzen prüfen.
3. `baseTree` dekodieren und validieren.
4. `headTree` dekodieren und validieren.
5. `elementaryDiff` dekodieren und validieren.
6. `renameDiff` dekodieren und validieren.
7. Tree-Abgleich.
8. Rename-Abgleich.
9. Ergebnis konstruieren.

Bei Schritten 1/2 gilt die Quellenreihenfolge:

```text
baseTree, headTree, elementaryDiff, renameDiff
```

Innerhalb eines Streams:

- fehlendes finales NUL vor Record-Verarbeitung;
- Records in Eingabereihenfolge;
- Headerstruktur;
- Status/Score;
- Modi;
- OIDs;
- erforderliche Pfadfelder;
- Pfadregeln;
- Record-Form;
- Eindeutigkeit.

Bei einem unterstützten `R` mit fehlendem zweiten Pfad gilt `TRUNCATED_INPUT`. Ein vorhandener, aber leerer Pfad gilt `INVALID_PATH`.

Bei `T` gilt `UNSUPPORTED_STATUS`, bevor dessen Modi bewertet werden.

Gültige Datenstrukturen mit fehlerhaften Bytes werfen keine Parsing-Exceptions. Nicht abfangbare Prozessprobleme wie Speichermangel sind keine erfolgreich behandelten Validierungsfälle.

### C8 — Ressourcen und unveränderliche Daten

Feste, nicht durch Aufrufer überschreibbare Grenzen:

```text
maxDiffBytes        = 4_194_304 je Diff
maxTreeBytes        = 8_388_608 je Tree
maxDiffRecords     = 10_000 je Diff
maxExpandedChanges = 10_000
maxTreeEntries     = 20_000 je Tree
maxPathBytes       = 255
```

- Byte-Grenzen vor Kopieren/Dekodieren großer Daten prüfen.
- Record-Grenzen während des Lesens prüfen.
- Rename-Expansion vor beziehungsweise während ihrer Konstruktion begrenzen.
- Keine stillschweigende Kürzung.
- Keine Teilresultate auf Failure.
- Keine konfigurierbaren „unsafe“-Optionen.
- Keine Rekursion über vom Input gesteuerte Pfadtiefe.
- Keine paarweisen Vollvergleiche aller Tree-Einträge; Maps/Sets beziehungsweise sortierte Vergleiche verwenden.

Ausgabedaten bestehen ausschließlich aus eigenen Plain Objects, Arrays, Strings, Zahlen und `null`.

Eingabebuffer bleiben veränderbar, soweit sie zuvor veränderbar waren. Eine nachträgliche Eingabemutation darf das Ergebnis nicht verändern.

### C9 — Verpflichtende Tests und Acceptance Criteria

Fixtures dürfen echte Spike-Bytes und handgeschriebene Negativvarianten enthalten. Erwartete Ergebnisse müssen von Hand festgelegt werden; sie dürfen nicht durch den Produktionsdecoder selbst erzeugt werden.

Alle nachfolgenden Testgruppen sind verpflichtend. Parametrisierung ist zulässig.

| ID | Fall | Erwartung |
|---|---|---|
| T01 | Gewöhnliches A | Exakter Git-Record und `added` |
| T02 | Gewöhnliches D | Exakter Git-Record und `deleted` |
| T03 | Gewöhnliches M | Exakter Git-Record und `modified` |
| T04 | Reales R100 | Zwei korrekte Endpunkte; `renamed` |
| T05 | Reales R097 mit geänderter OID | Akzeptiert |
| T06 | Unabhängiges D+A | Als D+A erhalten |
| T07 | Case-only Rename | Akzeptiert bei jeweils gültigen Trees |
| T08 | Identische nichtleere Trees, leere Diffs | Erfolg mit leeren Änderungsarrays |
| T09 | Vier leere Streams | Erfolg mit leeren Arrays |
| T10 | Gemeinsame korrekt geschriebene Directory-Prefixe | Akzeptiert |
| T11 | Mode-only `100644→100755` | `INVALID_MODE` |
| T12 | Neue ausführbare Datei | `INVALID_MODE` |
| T13 | Neuer Symlink | `INVALID_MODE` |
| T14 | Neuer Gitlink | `INVALID_MODE` |
| T15 | T-Record | `UNSUPPORTED_STATUS` |
| T16 | Unveränderter Symlink im Tree | `INVALID_MODE` |
| T17 | Verbotener Mode nur im Basistree | `INVALID_MODE` |
| T18 | Expliziter `040000 tree`-Record | `INVALID_MODE` |
| T19 | Regulärer Mode mit `commit`-Typ | `MALFORMED_TREE` |
| T20 | Unbekannter Mode | `INVALID_MODE` |
| T21 | Unicode-Pfad | `INVALID_PATH` |
| T22 | NFC-Pfad | `INVALID_PATH` |
| T23 | NFD-Pfad | `INVALID_PATH` |
| T24 | Ungültige UTF-8-Bytes | `INVALID_PATH` |
| T25 | Newline im Pfad | `INVALID_PATH` |
| T26 | Tab im Pfad | `INVALID_PATH` |
| T27 | CR im Pfad | `INVALID_PATH` |
| T28 | Abschließender Space | `INVALID_PATH` |
| T29 | Abschließender Punkt, auch Directory-Segment | `INVALID_PATH` |
| T30 | `.git` und `.GiT` als Segment | `INVALID_PATH` |
| T31 | `.gitignore`, `.github/x`, `.gitmodules` | Kein pauschales `.git`-Verbot |
| T32 | Alle reservierten Gerätenamen; case-/extension-Varianten | `INVALID_PATH` |
| T33 | `COM0`, `COM10`, `CONSOLE` | Kein falscher Gerätenamen-Treffer |
| T34 | `.` und `..`, auch innerhalb eines Pfads | `INVALID_PATH` |
| T35 | Absolute Pfade, `//`, trailing Slash | `INVALID_PATH` |
| T36 | Backslash-/Drive-/ADS-artige Pfade | `INVALID_PATH` |
| T37 | Pfad mit 255 Bytes | Akzeptiert, falls sonst gültig |
| T38 | Pfad mit 256 Bytes | `INVALID_PATH` |
| T39 | Doppelte Tree-Pfade, gleiche OID | `PATH_COLLISION` |
| T40 | Doppelte Tree-Pfade, verschiedene OIDs | `PATH_COLLISION` |
| T41 | Neue Datei kollidiert mit unveränderter Case-Variante | `PATH_COLLISION` |
| T42 | `Dir/a` plus `dir/b` | `PATH_COLLISION` |
| T43 | `a` plus `a/b` | `PATH_COLLISION` |
| T44 | `A` plus `a/b` | `PATH_COLLISION` |
| T45 | `__proto__`, `constructor`, `toString` als normale Dateinamen | Korrekte, unverfälschte Verarbeitung |
| T46 | Missing final NUL, parametrisiert für alle Streams | `TRUNCATED_INPUT` |
| T47 | Header ohne erforderlichen Pfad | `TRUNCATED_INPUT` |
| T48 | Rename ohne Zielpfad | `TRUNCATED_INPUT` |
| T49 | Vorhandener leerer Pfad | `INVALID_PATH` |
| T50 | Zusätzliches NUL nach abgeschlossenem Record | Malformed-Fehler des Streams |
| T51 | Combined-Diff `::…` | `MALFORMED_RAW_DIFF` |
| T52 | Unbekannte Statusform, C/U/X/B | `UNSUPPORTED_STATUS` |
| T53 | R im elementaren Diff | `UNSUPPORTED_STATUS` |
| T54 | Fehlender/falscher Rename-Score | `MALFORMED_RAW_DIFF` |
| T55 | R049/R101; gültige Grenzwerte R050/R100 | Ablehnung beziehungsweise Erfolg |
| T56 | Zusätzliche Headerfelder, doppelte Spaces, CRLF-Header | `MALFORMED_RAW_DIFF` |
| T57 | Kurze/lange/großgeschriebene/nicht-hex OID | `INVALID_OID` |
| T58 | Nullmodus mit nicht-null OID | `INVALID_OID` |
| T59 | Vorhandener Modus mit Null-OID | `INVALID_OID` |
| T60 | Null-OID im Tree | `INVALID_OID` |
| T61 | A/D/M mit falscher Vorhanden-/Fehlend-Form | `MALFORMED_RAW_DIFF` |
| T62 | M ohne tatsächliche Änderung | `MALFORMED_RAW_DIFF` |
| T63 | Doppelte Diff-Pfade | `DUPLICATE_CHANGE` |
| T64 | Rename mit identischen Endpunkten | `DUPLICATE_CHANGE` |
| T65 | Rename-Endpunkt in anderem Record wiederverwendet | `DUPLICATE_CHANGE` |
| T66 | Beide Diffs lassen dieselbe Tree-Änderung aus | `TREE_MISMATCH` |
| T67 | Zusätzlich erfundene elementare Änderung | `TREE_MISMATCH` |
| T68 | Falsche OID gegenüber Tree | `TREE_MISMATCH` |
| T69 | Leere Diffs trotz verschiedener Trees | `TREE_MISMATCH` |
| T70 | Rename-Quelle, -Ziel oder OID weicht vom elementaren Diff ab | `RENAME_MISMATCH`, parametrisiert |
| T71 | Sekundärer Diff lässt Record aus oder fügt einen hinzu | `RENAME_MISMATCH` |
| T72 | R100 mit unterschiedlichen gültigen OIDs und passender Expansion | Kein erfundener Score/Inhaltsbeweis |
| T73 | Byte-Limit exakt erreicht und um ein Byte überschritten | Kein Byte-Limitfehler beziehungsweise `RESOURCE_LIMIT` |
| T74 | Record-/Tree-Grenzen exakt und +1 | Erfolg bei sonst gültigen Daten beziehungsweise `RESOURCE_LIMIT` |
| T75 | Mehr als 10.000 Änderungen erst nach Rename-Expansion | `RESOURCE_LIMIT` |
| T76 | Reales 12.001-Changes-Fixture | `RESOURCE_LIMIT`, kein Teilresultat |
| T77 | Gültige Record-Permutationen | Identisches Ergebnis und JSON |
| T78 | Namen `A`, `Z`, `_`, `a` | Sortierung nach Codeeinheiten |
| T79 | Uint8Array-Subview mit fremden Präfix-/Suffixbytes im Backing-Buffer | Nur View-Bereich gelesen |
| T80 | Fehlender/falscher View; SharedArrayBuffer | `INVALID_INPUT` |
| T81 | Eingabemutation nach Rückgabe | Ergebnis unverändert; Input nicht eingefroren |
| T82 | Verschachtelte Ausgabe-/Fehlerobjekte | Rekursiv readonly und frozen |
| T83 | Fehlerpriorität bei mehreren Verletzungen | Exakter Code und exakte Quelle gemäß C7 |
| T84 | Integration mit vorhandenen Forge-Schemas/-Evaluator | Keine Semantikduplikation oder -änderung |

T84 enthält mindestens:

- alle ausgegebenen Records bestehen `ChangedFileSchema`;
- vollständige Beispiel-Evidence besteht `VerificationEvidenceSchema`;
- korrekt dekodierter Delete wird vom bestehenden Evaluator als Scope-Verstoß erkannt;
- Coordination→Coordination-Rename bleibt durch bestehenden Evaluator zulässig;
- Rename über die Coordination-Grenze wird von ihm abgelehnt;
- zusätzliche Mode-/OID-Felder erscheinen niemals in `changedFiles`.

Compile-Time-Tests prüfen:

- genau die beschriebene öffentliche API;
- unmögliche `GitChange`-Kombinationen;
- readonly Arrays und verschachtelte Felder;
- Eingabeparameter als Byte-Views;
- Verwendung des bestehenden `ChangedFile`-Typs.

#### Acceptance Criteria

- **AC-01:** Diff ausschließlich aus den vier erlaubten neuen Dateien.
- **AC-02:** Keine neue Runtime-Dependency; keine bestehenden Dateien verändert.
- **AC-03:** Öffentliche Exporte exakt C3.
- **AC-04:** Bytegrammatik und Profil exakt C4/C5.
- **AC-05:** Vollständiger Tree-Abgleich und Rename-Abgleich nach C6.
- **AC-06:** Exaktes `ChangedFile`-Mapping ohne zusätzliche Felder.
- **AC-07:** Fehlercodes/-priorität nach C7; keine normalen Parsing-Exceptions.
- **AC-08:** Grenzen nach C8; kein partieller Success.
- **AC-09:** T01–T84 einschließlich benannter Parameterfälle implementiert und grün.
- **AC-10:** Typtests und Freeze-/Isolationsprüfungen grün.
- **AC-11:** Zwölf gültig angewendete Smokes gemäß C10 werden erkannt.
- **AC-12:** `npm run typecheck`, `npm test`, `git diff --check` erfolgreich.
- **AC-13:** Neue Produktionsdatei enthält keine Git-/Filesystem-/Netzwerk-/Zeit-/Zufalls-Ausführung.
- **AC-14:** Neue Tests benötigen weder Git noch Laborpfade, externe Dienste oder Shell-Subprozesse.

### C10 — Gezielte Mutation-Smokes

Alle zwölf Mutationen sind `must_detect`.

| ID | Mutation | Erforderliche Detektoren |
|---|---|---|
| M01 | Mode-Gate lässt `100755`, `120000` oder `160000` durch | T11–T18 |
| M02 | Fehlenden zweiten Rename-Endpunkt akzeptieren | T48, T64 |
| M03 | Pfad an Newline auftrennen und Rest ignorieren | T25 plus Fixture, das ohne Newline-Kontrolle scheinbar gültig würde |
| M04 | `compareCodeUnits` durch `localeCompare` ersetzen | T78; zusätzlich Unit-Test mit temporär werfendem `localeCompare` |
| M05 | ASCII-casefold-Kollisionsprüfung deaktivieren | T41 |
| M06 | Directory-Prefix-/Datei-Directory-Prüfung deaktivieren | T42–T44 |
| M07 | Fehlendes finales NUL akzeptieren | T46 |
| M08 | Rename-Abgleich überspringen | T70–T71 |
| M09 | T-Record als M behandeln oder still ignorieren | T15 |
| M10 | Tree-Delta-Abgleich überspringen | T66–T69 |
| M11 | Ressourcenlimit abschneiden statt Fehler liefern | T74–T76 |
| M12 | Eingabebuffer referenzieren oder View-Grenzen ignorieren | T79–T81 |

Für M01 und M09 können syntaktisch absichtlich inkonsistente Header verwendet werden, um das jeweilige Gate unabhängig von einer anderen Schutzschicht zu prüfen. Der erwartete Fehlercode gehört zum Testoracle.

Pro Smoke dokumentieren:

- exakte Mutation;
- Quellhash vorher/nachher;
- tatsächlich ausgeführte Zieltests;
- erwarteten und tatsächlichen Fehler;
- Wiederherstellung.

Ein fehlender Pattern-Treffer, null ausgeführte Tests oder ein Infrastrukturfehler ist kein erfolgreicher Smoke.

Wird eine Mutation durch eine andere Schutzschicht abgefangen, muss der Test weiterhin die **vertraglich richtige Fehlerklassifikation** prüfen. Eine nur zufällig rote Suite ist kein ausreichender Nachweis.

### C11 — Format-2-Prozessgrenze, Non-Goals und Abschluss

#### Prozessgrenze

- `specifiedAgainst` bleibt der oben verifizierte Main-SHA.
- `runBase` wird später als Run-Fakt festgelegt und gehört nicht in diesen Contract.
- Contract-Inhaltscommit C und Registrierungsmerge M werden nicht gleichgesetzt.
- Ein Developer startet gemäß den neuen Prozessvorgaben vom aktuellen freigegebenen `runBase`, nicht automatisch von C.
- V-01 implementiert diese Startregel nicht im Kernel.
- `SPEC_STALE`, Findings-Carry-forward und `revision/supersedes` müssen durch das autoritative Contract-System-V2-Verfahren behandelt werden.
- Solange deren formale Repräsentation oder Anwendung für diesen Contract ungeklärt ist, darf kein vermeintlich vollständig registrierter Format-2-Run behauptet werden.
- Review-Findings werden nicht durch Umbenennen oder Entfernen einer Draft-Version als erledigt behandelt.

#### Non-Goals

Keine:

- Git-Ausführung oder Remote-Erhebung;
- GitHub-Anbindung;
- Workflow-Dateien;
- Authentifizierung oder Rollenbindung;
- Kernel-/Start-Gate-/Contract-Parser-Änderung;
- Merge-/Ancestry-Policy-Implementation;
- Verifier-Testausführung oder Testintegritätsmanifest;
- V-02-/V-03-Implementation;
- Mystery-Änderungen;
- Unicode-Pfadunterstützung;
- SHA-256-Git-Repositories;
- Submodule, Symlinks oder Executable-Unterstützung;
- vollständiges Mutation Testing;
- historische Contract-/Approval-/Review-Migration.

Die aktuelle Format-1-Semantik darf nicht stillschweigend in Format 2 umgedeutet werden.

**Explizites redaktionelles Ende des Drafts:**

```text
<!-- END V-01 DRAFT -->
```

Der **autoritative Format-2-Endmarker bleibt UNRESOLVED**. Dieser redaktionelle Marker behauptet keine Kompatibilität mit einem noch nicht vorliegenden Format-2-Parser.

## 13. Unresolved dependencies

| ID | Fehlende Information | Auswirkung |
|---|---|---|
| U1 | Autoritatives vollständiges Format-2-Metadatenschema | Header kann noch nicht als schema-konform bestätigt werden |
| U2 | Exakte `reads`-Repräsentation und `SPEC_STALE`-Regeln | Keine erfundene Blob-/Hash-/Staleness-Bindung |
| U3 | Wire-Form und Regeln für `revision`/`supersedes` | Keine erfundene Erstversions- oder Revisionsidentität |
| U4 | Findings-Carry-forward-Datenmodell | Keine vorgetäuschte Übernahme/Erledigung historischer Findings |
| U5 | Format-2-Dependency-Referenzen und akzeptierte Task-Identitäten | Keine erfundenen `acceptedCommit`-Nachweise |
| U6 | Exakter Endmarker sowie Format-2-Hash-/Textkanonisierung | Noch kein registrierbares Contract-Artefakt |
| U7 | Freigegebener Format-2-Registrierungs-/Run-Startmechanismus | Aktueller Kernel startet noch bei C; V-01 darf das nicht nebenbei reparieren |

**Nicht unresolved ist die Decoder-Semantik:** Grammatik, Pfadprofil, Mapping, Konsistenz, Fehler, Ressourcen und Tests sind im Draft festgelegt.

Das vorhandene Spike-Evidenzpaket wurde erneut geprüft; sein SHA-256 stimmt weiterhin mit dem vorherigen Bericht überein. Es wurde nicht verändert.

## 14. GO / NO-GO for independent contract review

**GO für unabhängigen technischen Contract-Review** der Decoder-Semantik und der geänderten Dateiallowlist.

**NO-GO für Freigabe, Registrierung oder Implementierungsbeginn dieses Contracts**, bis die Format-2-Hülle und die genannten Prozessabhängigkeiten gegen die autoritative Spezifikation reconciled sind.

Insbesondere darf die fehlende Format-2-Spezifikation weder durch Format-1-Metadaten noch durch erfundene V2-Felder ersetzt werden.

**Read-only eingehalten. Beide geprüften lokalen Working Trees sind sauber; Remote-main ist unverändert.**
