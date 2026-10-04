---json
{
  "forgeContractFormat": 1,
  "taskId": "FORGE-VERIFIER-0001",
  "contractVersion": 1,
  "baseCommit": "3d7545d843883418348004e68717399a64da7a7d",
  "dependencies": [],
  "scope": {
    "create": [
      "src/forge-verifier/diff-authority.ts",
      "src/forge-verifier/failures.ts",
      "src/forge-verifier/node-sha256.ts",
      "src/forge-verifier/path-rules.ts",
      "src/forge-verifier/protected-paths.ts",
      "src/forge-verifier/tree-listing.ts",
      "src/forge-verifier/tree-rules.ts",
      "tests/forge-verifier/diff-authority.test.ts",
      "tests/forge-verifier/fixtures.ts",
      "tests/forge-verifier/path-rules.test.ts",
      "tests/forge-verifier/protected-paths.test.ts",
      "tests/forge-verifier/tree-listing.test.ts",
      "tests/forge-verifier/tree-rules.test.ts",
      "tests/forge-verifier/typecheck.ts"
    ],
    "modify": []
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
# FORGE-VERIFIER-0001 — Canonical Diff and Path Authority

## 1. Ziel und Verbindlichkeit

Dieser Contract spezifiziert den ersten Baustein des unabhängigen Verifiers: eine reine, deterministische
Diff- und Pfad-Autorität. Sie bestimmt aus zwei Tree-Listings (Basis `B` und Prüfling `H`, beide vom
vertrauenswürdigen Workflow erzeugt) die kanonische Liste geänderter Dateien, prüft Pfadform, Modi,
Kollisionen, geschützte Pfade und Größenlimits und übergibt das Ergebnis dem bestehenden Kern
(`evaluateVerification` aus `src/forge/verification.ts`) für die Scope-Entscheidung.

Kein Wert dieses Moduls stammt vom Developer. Eingaben sind ausschließlich Bytes, die der Verifier selbst
mit `git ls-tree` erzeugt hat, sowie die Metadaten des Contracts, den der Verifier selbst aus `main` gelesen hat.
PR-Text, Developer-Report, Kommentare und Container-Ausgaben kommen in diesem Modul nicht vor.

Das Modul ruft kein `git`, liest keine Dateien, kein Netz, keine Umgebung. Es wirft nie auf Daten; jede
Abweichung ist ein benannter Fehlercode. Alle Ergebnisse sind tief eingefroren; Eingaben bleiben unverändert.

## 2. Herkunft und Reconciliation gegen `main` (3d7545d843883418348004e68717399a64da7a7d)

Alle Namen des Kerns, die dieser Contract verwendet, wurden am genannten Commit im Code geprüft.
Erfunden wird nichts; neue Namen sind ausschließlich die in §4 bis §11 definierten.

| Fakt | Beleg am Basis-Commit |
|---|---|
| Frontmatter ist `---json\n` + `JSON.stringify(raw, null, 2)` + `\n---\n`; andere Formatierung ist `FRONTMATTER_NOT_CANONICAL` | `src/forge/contract-document.ts` (`FRONTMATTER_OPEN`, `FRONTMATTER_CLOSE`, Stufe 3) |
| Schema v1 kennt genau `forgeContractFormat: 1`, `taskId`, `contractVersion`, `baseCommit`, `dependencies`, `scope.create`, `scope.modify`, `requiredChecks` (min. 1), `mutationSmoke: none/optional/required`; kein `mutants`, `reads`, `limits`, kein Statusfeld | `ContractMetadataSchema` (strictObject) |
| Der Hash ist `sha256("forge-contract-v1\n" + text)` und steht nie im Dokument | `CONTRACT_HASH_PREFIX`, `parseContractDocument` |
| `RepoPathSchema`: `^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$`, max. 255, keine Segmente `.`/`..`; `TaskIdSchema`: `^[A-Z][A-Z0-9]*(-[A-Z0-9]+)+$` | `src/forge/primitives.ts` |
| `ChangedFileSchema`: `{path, change: added/modified/deleted}` oder `{fromPath, toPath, change: renamed}` | `src/forge/runs.ts` |
| `evaluateVerification(metadata, report, evidence)`: `added` muss in `scope.create`, `modified` in `scope.modify`; Löschung immer Verletzung; Präfixe `forge/contracts/`, `forge/approvals/` immer verboten; Präfix `forge/coordination/` ist **vom Scope ausgenommen** (`PROCESS_NOTE_PREFIX`) | `src/forge/verification.ts` (`scopeViolations`) |
| `VerificationFailure = { code, subject }`, Codes `CHECK_FAILED`, `SCOPE_VIOLATION`, `MUTATION_SURVIVED`, `MUTATION_EVIDENCE_INVALID`; Sortierung mit `compareCodeUnits` | `src/forge/verification.ts`, `src/forge/primitives.ts` |
| `deepFreeze` friert Ergebnisse tief ein | `src/forge/freeze.ts` |
| Adaptermuster für Node-Abhängigkeiten: `nodeSha256Utf8` ist die einzige Datei unter `src/forge` mit `node:`-Import | `src/forge/node-sha256.ts` |
| Dogfood-Test verlangt, dass jede Datei direkt unter `src/forge` und `tests/forge` im Scope eines `FORGE-CORE-*`-Contracts steht; er liest nur diese beiden Verzeichnisse | `tests/forge/dogfood.test.ts` (`readdirSync`) |
| `tsconfig.json` `include: ["src", "tests"]`; `npm test` = `vitest run` ohne Konfigurationsdatei, Standard-Include erfasst `tests/**/*.test.ts` | `tsconfig.json`, `package.json` |
| Tree von `main`: 71 Einträge, alle Modus `100644`, nur ASCII-Pfade, keine Casefold-Kollisionen; `git ls-tree -r -l -z --full-tree 3d7545d…` hat 6519 Bytes, SHA-256 `7087aa36585e2fdce38b84215d53f04cde20e9fb42ce652866b11b767601c1f2`; Tree-Objekt `67103229baccaefd68ce5047d8503eca9883f1d3` | lokale Beobachtung mit Git 2.43 |

Folgerungen: Neuer Code liegt unter `src/forge-verifier/` und `tests/forge-verifier/` (nicht unter `src/forge/`,
sonst bricht der Dogfood-Test). Beide Verzeichnisse werden von `tsc` und `vitest` ohne Konfigurationsänderung erfasst.
Der Kern wird nicht verändert; dieser Contract hat `scope.modify: []`.

## 3. Basis, Startpunkt, Contract-Commit

`baseCommit` ist der `main`-Commit, gegen den diese Spezifikation gelesen wurde (3d7545d…). Er ist keine
Startanweisung. Der Run startet vom `main`-Head zum Startzeitpunkt (Run-Basis `R`), nachdem der
Contract-PR per Merge Commit `M` auf `main` liegt; der Contract-Commit ist `C = M^2`, und `R` enthält `M`.
Hat sich zwischen `baseCommit` und `R` eine der in §2 belegten Dateien geändert
(`src/forge/contract-document.ts`, `src/forge/primitives.ts`, `src/forge/runs.ts`, `src/forge/verification.ts`,
`src/forge/freeze.ts`, `tests/forge/dogfood.test.ts`, `tsconfig.json`, `package.json`, `package-lock.json`),
stoppt der Developer vor der ersten Codezeile und meldet die Dateien; dann ist eine neue Contract-Version nötig.

`dependencies` ist leer: dieser Contract setzt keinen abgenommenen Forge-Task voraus, nur den Code an `baseCommit`.

## 4. Dateien (exakt)

`scope.create` (14 Dateien), `scope.modify` leer. Keine weitere Datei darf entstehen oder sich ändern.

| Datei | Rolle |
|---|---|
| `src/forge-verifier/failures.ts` | Fehlercodes, Vergleich, Normalisierung (dedupliziert, sortiert, eingefroren) |
| `src/forge-verifier/tree-listing.ts` | Parser für `git ls-tree -r -l -z --full-tree <commit>`; Limits |
| `src/forge-verifier/path-rules.ts` | Pfad-Darstellbarkeit (ASCII `RepoPath`), Portabilität, Git-reservierte Segmente, `node_modules` |
| `src/forge-verifier/protected-paths.ts` | Regeltabelle geschützter und Forge-reservierter Pfade; `protectedPathHit` |
| `src/forge-verifier/tree-rules.ts` | Modusregel, Casefold-Kollisionen (Datei/Datei und Datei/Verzeichnis) über den ganzen Tree |
| `src/forge-verifier/diff-authority.ts` | `collectChangedFiles`: feste Reihenfolge aller Regeln, Kern-Aufruf, Ergebnisform |
| `src/forge-verifier/node-sha256.ts` | Node-Adapter `nodeSha256Bytes`; einzige Datei unter `src/forge-verifier` mit `node:`-Import |
| `tests/forge-verifier/fixtures.ts` | Listing-Builder (Bytes), Scope-Builder, Golden-Listing von `main`, Hilfs-SHA |
| `tests/forge-verifier/tree-listing.test.ts` | Parser-Tests |
| `tests/forge-verifier/path-rules.test.ts` | Pfadregel-Tests |
| `tests/forge-verifier/protected-paths.test.ts` | Regeltabellen-Tests |
| `tests/forge-verifier/tree-rules.test.ts` | Modus- und Kollisionstests |
| `tests/forge-verifier/diff-authority.test.ts` | Ende-zu-Ende, Reihenfolge, Determinismus, Kern-Integration, adversariale Fälle |
| `tests/forge-verifier/typecheck.ts` | Kompilierzeit-Tests (`@ts-expect-error`), nie ausgeführt |

Erlaubte Importe aus dem Kern: `src/forge/primitives.ts` (`RepoPathSchema`, `compareCodeUnits`),
`src/forge/freeze.ts` (`deepFreeze`), `src/forge/verification.ts` (`evaluateVerification`, Typen),
`src/forge/runs.ts` (Typ `ChangedFile`), `src/forge/contract-document.ts` (Typ `ContractMetadata`).
Keine neue Dependency in `package.json`. Kein Import aus `tests/`.

## 5. Fehlercodes (`src/forge-verifier/failures.ts`)

```ts
export type DiffAuthorityOwnCode =
  | "TREE_LISTING_MALFORMED" | "TREE_TOO_LARGE" | "TREE_DUPLICATE_PATH"
  | "PATH_NOT_REPRESENTABLE" | "PATH_NOT_PORTABLE" | "PATH_GIT_RESERVED" | "TREE_PATH_FORBIDDEN"
  | "TREE_MODE_FORBIDDEN" | "CASE_COLLISION"
  | "TOO_MANY_CHANGES" | "BLOB_TOO_LARGE"
  | "PROTECTED_PATH_CHANGED" | "FORGE_PATH_RESERVED" | "SCOPE_PATH_PROTECTED";
export type DiffAuthorityFailureCode = DiffAuthorityOwnCode | VerificationFailureCode;
export type DiffAuthorityFailure = { readonly code: DiffAuthorityFailureCode; readonly subject: string | null };
export function compareFailures(a: DiffAuthorityFailure, b: DiffAuthorityFailure): number;
export function normalizeFailures(failures: readonly DiffAuthorityFailure[]): readonly DiffAuthorityFailure[];
```

`VerificationFailureCode` ist der Kern-Typ aus `src/forge/verification.ts`; davon tritt hier konstruktiv nur
`SCOPE_VIOLATION` auf (§10 Schritt S10). `compareFailures` ordnet nach `code`, dann `subject`
(`null` zuerst), jeweils mit `compareCodeUnits`. `normalizeFailures` entfernt exakte Duplikate
(`code` und `subject` gleich), sortiert und friert ein. Subjekte sind Pfade als Text; nicht darstellbare
Pfadbytes erscheinen als `hex:<kleingeschriebenes Hex der ersten 256 Bytes>` (§7).

## 6. Tree-Listing-Parser (`src/forge-verifier/tree-listing.ts`)

Eingabe sind die unveränderten Bytes von

```text
git ls-tree -r -l -z --full-tree <commit>
```

Je Eintrag: `<mode> SP <type> SP <sha> SP* <size> TAB <pathBytes> NUL`; `<size>` ist rechtsbündig mit Leerzeichen
aufgefüllt (Dezimalzahl für Blobs, `-` für Gitlinks). `-z` liefert Pfade roh, ohne Quoting. Ein leeres Listing
(0 Bytes) ist gültig und hat 0 Einträge.

```ts
export const TREE_LIMITS: { readonly maxListingBytes: 4194304; readonly maxTreeEntries: 20000 };
export type TreeEntry = {
  readonly mode: string; readonly type: "blob" | "commit"; readonly sha: string;
  readonly size: number | null; readonly pathBytes: Uint8Array;
};
export type TreeListingResult =
  | { readonly ok: true; readonly entries: readonly TreeEntry[] }
  | { readonly ok: false; readonly failure: DiffAuthorityFailure };
export function parseTreeListing(bytes: Uint8Array): TreeListingResult;
```

Regeln, in dieser Reihenfolge:

1. `bytes.length > maxListingBytes` → `TREE_TOO_LARGE` (`subject: null`).
2. Nicht leer und letztes Byte ≠ NUL → `TREE_LISTING_MALFORMED` (`subject: null`). Zerlegung an NUL; kein Zeilenparser.
3. Je Datensatz: erstes TAB trennt Kopf und Pfad. Kopf muss `^(\d{6}) (blob|commit) ([0-9a-f]{40}) +(-|\d+)$`
   erfüllen; Pfad nicht leer; `-` nur bei `commit`, Zahl nur bei `blob`. Sonst `TREE_LISTING_MALFORMED`,
   `subject` = Index des Datensatzes als Dezimaltext. Der Typ `tree` (nur mit `-t`) ist hier fehlerhaft.
4. Anzahl > `maxTreeEntries` → `TREE_TOO_LARGE`.
5. Gleiche `pathBytes` zweimal → `TREE_DUPLICATE_PATH`, `subject` = `pathSubject(pathBytes)`.

Der Parser interpretiert Pfade nicht; `pathBytes` ist eine Kopie, nie eine View auf die Eingabe.

## 7. Pfadregeln (`src/forge-verifier/path-rules.ts`)

```ts
export type PathClassification =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly failure: DiffAuthorityFailure };
export function classifyPath(pathBytes: Uint8Array): PathClassification;
export function pathSubject(pathBytes: Uint8Array): string;
export const RESERVED_DEVICE_STEMS: readonly string[];
```

`pathSubject`: sind alle Bytes im Bereich 0x21–0x7E, der Pfad als Text; sonst `hex:` plus Hex der ersten 256 Bytes.

`classifyPath`, erste zutreffende Regel entscheidet, `subject` = `pathSubject(pathBytes)`:

1. Ein Byte außerhalb 0x21–0x7E, oder der Text erfüllt `RepoPathSchema` nicht (Zeichenmenge, Segmente `.`/`..`,
   Länge > 255) → `PATH_NOT_REPRESENTABLE`. Damit sind Leerzeichen, Steuerzeichen, Backslash, `<>:"|?*`
   und jedes Nicht-ASCII-Zeichen (also auch NFC/NFD-Varianten und Unicode-Kollisionen) ausgeschlossen.
2. Ein Segment ist casefold `.git` oder erfüllt `^git~[0-9]+$` → `PATH_GIT_RESERVED`.
3. Ein Segment ist casefold `node_modules` → `TREE_PATH_FORBIDDEN`.
4. Ein Segment endet mit `.`, oder der Teil eines Segments vor dem ersten `.` ist casefold in
   `RESERVED_DEVICE_STEMS` = `con prn aux nul com1…com9 lpt1…lpt9` → `PATH_NOT_PORTABLE`.
   (Ein Segment, das mit `.` beginnt, hat den leeren Stamm und ist nicht reserviert.)

Casefold bedeutet hier ASCII-`toLowerCase`, weil nach Regel 1 nur ASCII vorkommt.

## 8. Geschützte und reservierte Pfade (`src/forge-verifier/protected-paths.ts`)

```ts
export const FORGE_TASK_PREFIX = "FORGE-";
export type ProtectedTier = "always" | "forge";
export type ProtectedRuleKind = "root" | "prefix" | "basename" | "basenameRegex" | "segment";
export type ProtectedRule = { readonly tier: ProtectedTier; readonly kind: ProtectedRuleKind; readonly pattern: string };
export const PROTECTED_RULES: readonly ProtectedRule[];
export type ProtectedHit = { readonly tier: ProtectedTier; readonly rule: ProtectedRule };
export function protectedPathHit(path: string, taskId: string): ProtectedHit | null;
```

Vergleich stets auf dem kleingeschriebenen Pfad. `root` = ganzer Pfad gleich; `prefix` = Pfad beginnt mit
Muster (Muster endet auf `/`); `basename` = letztes Segment gleich; `basenameRegex` = letztes Segment erfüllt
den verankerten regulären Ausdruck; `segment` = irgendein Segment gleich.

Stufe `always` (für jeden Task verboten; ein Treffer ist `PROTECTED_PATH_CHANGED`):

| Art | Muster |
|---|---|
| root | `.gitattributes`, `.gitmodules`, `.npmrc`, `.nvmrc`, `.node-version`, `package.json`, `package-lock.json`, `npm-shrinkwrap.json`, `yarn.lock`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.json` |
| prefix | `forge/contracts/`, `forge/approvals/` |
| basename | `package.json`, `.npmrc`, `.gitattributes`, `tsconfig.json` |
| basenameRegex | `^tsconfig\..+\.json$`, `^jsconfig(\..+)?\.json$`, `^vitest\.(config\|workspace\|projects)\..+$`, `^vite\.config\..+$`, `\.snap$` |
| segment | `__snapshots__` |

Stufe `forge` (nur erlaubt, wenn `taskId` mit `FORGE-` beginnt; sonst `FORGE_PATH_RESERVED`; auch dann gilt der exakte Scope):

| Art | Muster |
|---|---|
| prefix | `.github/`, `forge/`, `src/forge/`, `src/forge-verifier/`, `tests/forge/`, `tests/forge-red-team/`, `tests/forge-verifier/`, `scripts/` |
| root | `codeowners`, `.gitignore` |

`protectedPathHit` prüft zuerst alle `always`-Regeln (erster Treffer in Tabellenreihenfolge), dann die
`forge`-Regeln; ein `forge`-Treffer wird für Tasks mit Präfix `FORGE-` zu `null`. Begründung der Stufen:
`always`-Dateien bestimmen, womit der Verifier selbst installiert, typprüft und testet, oder sind Kern-Tabu;
sie ändern sich ausschließlich per Owner-PR. `forge`-Pfade sind Prozessmaschinerie; Produkt-Tasks (`TASK-…`)
dürfen sie nie berühren. Die Tabelle ist Code, keine Konfiguration; eine spätere Policy-Datei muss sie
enthalten (Test „Policy ⊇ `PROTECTED_RULES`“ ist Aufgabe des Tasks, der die Policy einführt).

## 9. Tree-Regeln (`src/forge-verifier/tree-rules.ts`)

```ts
export type ClassifiedEntry = {
  readonly path: string; readonly mode: string; readonly type: "blob" | "commit";
  readonly sha: string; readonly size: number | null;
};
export function checkTree(entries: readonly ClassifiedEntry[]): readonly DiffAuthorityFailure[];
```

Über den **gesamten** Prüfling-Tree, nicht nur über den Diff:

1. `mode !== "100644"` oder `type !== "blob"` → `TREE_MODE_FORBIDDEN` (`subject` = Pfad). Damit sind `100755`,
   `120000` (Symlink) und `160000` (Submodul) ausgeschlossen, auch wenn sie bereits auf `main` lägen.
2. Zwei Pfade mit gleichem casefold → `CASE_COLLISION` für jeden beteiligten Pfad.
3. Casefold eines Pfads gleich dem casefold eines Verzeichnispräfixes eines anderen Pfads
   (z. B. Datei `src/a` und Datei `src/A/x.ts`) → `CASE_COLLISION` (`subject` = der Dateipfad).

Rückgabe normalisiert (§5). Ein Contract kann in dieser Version keine Ausnahme erteilen.

## 10. Diff Authority (`src/forge-verifier/diff-authority.ts`)

```ts
export type Sha256Bytes = (bytes: Uint8Array) => string;
export const DIFF_LIMITS: { readonly maxChangedFiles: 200; readonly maxBlobBytes: 2097152 };
export type DiffAuthorityInput = { readonly baseListing: Uint8Array; readonly headListing: Uint8Array };
export type DiffAuthorityContract = Readonly<Pick<ContractMetadata, "taskId" | "scope">>;
export type DiffAuthorityDeps = { readonly sha256Hex: Sha256Bytes };
export type ListingDigests = { readonly base: string; readonly head: string };
export type DiffAuthorityResult =
  | { readonly passed: true; readonly changedFiles: readonly ChangedFile[];
      readonly listingSha256: ListingDigests; readonly headEntryCount: number }
  | { readonly passed: false; readonly failures: readonly DiffAuthorityFailure[];
      readonly changedFiles: readonly ChangedFile[] | null;
      readonly listingSha256: ListingDigests; readonly headEntryCount: number | null };
export function collectChangedFiles(
  input: DiffAuthorityInput, contract: DiffAuthorityContract, deps: DiffAuthorityDeps,
): DiffAuthorityResult;
```

Der kanonische Diff ist die Mengendifferenz zweier Tree-Listings. Es gibt keine Rename-Erkennung und keine
Schwellenwerte: eine Verschiebung ist `deleted` plus `added`, eine Löschung ist nach Kernregel immer eine
Verletzung. `changedFiles` enthält nie `change: "renamed"`.

Reihenfolge (fest; „stop“ beendet mit `passed: false` und den bis dahin gesammelten, normalisierten Fehlern):

| Schritt | Regel |
|---|---|
| S1 | `listingSha256 = { base: sha256Hex(baseListing), head: sha256Hex(headListing) }`; steht in jedem Ergebnis. |
| S2 | `parseTreeListing(headListing)`; Fehler → stop (`changedFiles: null`, `headEntryCount: null`). |
| S3 | `parseTreeListing(baseListing)`; Fehler → stop. |
| S4 | `classifyPath` für jeden Prüfling-Eintrag (Fehler sammeln) und jeden Basis-Eintrag (Fehler sammeln, `subject` mit Präfix `base:`). |
| S5 | `checkTree` über alle klassifizierten Prüfling-Einträge (sammeln). Liegt nach S4/S5 ein Fehler vor → stop (`changedFiles: null`). Nichts aus diesem Tree darf danach materialisiert werden. |
| S6 | Änderungsmenge: Pfad nur in `H` → `added`; nur in `B` → `deleted`; in beiden mit ungleichem `sha` **oder** ungleichem `mode` → `modified`. Sortierung nach Pfad mit `compareCodeUnits`. Mehr als `maxChangedFiles` Einträge → `TOO_MANY_CHANGES` (`subject` = Anzahl als Text), stop (`changedFiles: null`). |
| S7 | Für `added`/`modified`: `size > maxBlobBytes` → `BLOB_TOO_LARGE` (`subject` = Pfad). |
| S8 | Für jeden geänderten Pfad: `protectedPathHit(path, taskId)`; Stufe `always` → `PROTECTED_PATH_CHANGED`, Stufe `forge` → `FORGE_PATH_RESERVED`. Für jeden Pfad in `scope.create ∪ scope.modify`: Treffer → `SCOPE_PATH_PROTECTED` (unabhängig davon, ob er geändert wurde). |
| S9 | Koordinationsausnahme des Kerns aufheben: geänderter Pfad mit Präfix `forge/coordination/`, der nicht exakt (`added` in `scope.create`, `modified` in `scope.modify`) im Scope steht → `SCOPE_VIOLATION` (`subject` = Pfad). |
| S10 | `evaluateVerification({ scope, requiredChecks: [], mutationSmoke: "none" }, { mutations: [] }, { changedFiles, checks: [], mutations: null })`; bei `passed: false` werden dessen `failures` unverändert übernommen. Die Argumente werden nach dem Aufruf nicht weiterverwendet. |
| S11 | `normalizeFailures`; `passed` genau dann, wenn keine Fehler. `changedFiles` ist in diesem Fall auch bei `passed: false` gefüllt (für die Evidence). Ergebnis tief eingefroren. |

Stoppen in S2 bis S6 ist Absicht: Pfad- und Modusfehler werden entschieden, bevor irgendein Schritt des
Verifiers den Prüfling in ein Arbeitsverzeichnis schreibt. Die Schritte S7 bis S10 sammeln vollständig.

## 11. SHA-256-Port (`src/forge-verifier/node-sha256.ts`)

```ts
export const nodeSha256Bytes: Sha256Bytes; // createHash("sha256").update(bytes).digest("hex")
```

Einzige Datei unter `src/forge-verifier/` mit `node:`-Import. `diff-authority.ts` erhält den Port per `deps`
und ist dadurch in Tests mit jeder SHA-256-Implementierung prüfbar.

## 12. Invarianten

1. Rein: gleiche Bytes und gleicher Contract ergeben byte-gleiche Ergebnisse (nach `JSON.stringify`), unabhängig von der Reihenfolge der Einträge in den Listings.
2. Der Developer kann die Änderungsmenge nicht beeinflussen: sie folgt allein aus `B`, `H` und der Regeltabelle.
3. Jeder Pfad in `changedFiles` erfüllt `RepoPathSchema` und besteht aus ASCII 0x21–0x7E; `changedFiles` ist duplikatfrei und sortiert.
4. `passed: true` impliziert: alle Prüfling-Einträge haben Modus `100644`, keine Kollision, keine geschützte oder reservierte Änderung, Scope nach Kernregel eingehalten, kein `forge/coordination/`-Pfad außerhalb des exakten Scopes, kein Blob über dem Limit, höchstens 200 Änderungen.
5. Kein Wurf auf Daten: Jede Eingabe-Bytefolge endet in einem `DiffAuthorityResult`.
6. Keine Seiteneffekte: keine Imports aus `node:` außer in `node-sha256.ts`; keine Mutation der Eingaben.
7. Die Regeltabelle `PROTECTED_RULES` ist eingefroren und exportiert; Tests referenzieren sie, statt sie zu kopieren.

## 13. Acceptance Criteria

| ID | Kriterium |
|---|---|
| A-01 | Der Implementierungs-Diff gegen `R` enthält genau die 14 Dateien aus `scope.create`, nur `added`, alle Modus `100644`. |
| A-02 | `npm run typecheck` und `npm test` grün; alle 1087 am Basis-Commit vorhandenen Tests bleiben unverändert grün; Dogfood-Test grün. |
| A-03 | Golden-Listing: `tests/forge-verifier/fixtures.ts` enthält die Bytes von `git ls-tree -r -l -z --full-tree 3d7545d843883418348004e68717399a64da7a7d`; ein Test prüft SHA-256 `7087aa36585e2fdce38b84215d53f04cde20e9fb42ce652866b11b767601c1f2`, 71 Einträge, und dass `collectChangedFiles` mit diesem Listing als `B` und `H` für `TASK-0006` mit leerem Scope `passed: true` und `changedFiles: []` liefert. |
| A-04 | Jeder Fehlercode aus §5 (einschließlich `SCOPE_VIOLATION`) hat mindestens einen auslösenden und einen knapp nicht auslösenden Test. |
| A-05 | Reihenfolge §10 nachgewiesen: ein Listing mit Symlink **und** Scope-Verletzung liefert nur `TREE_MODE_FORBIDDEN` und `changedFiles: null`; ein Listing mit geschütztem Pfad **und** Scope-Verletzung liefert beide Codes und gefüllte `changedFiles`. |
| A-06 | Determinismus: Permutation der Einträge beider Listings ändert `JSON.stringify(result)` nicht. |
| A-07 | Immutabilität: Ergebnisse sind tief eingefroren (Freeze-Scan); Eingabe-`Uint8Array`s sind nach dem Aufruf byte-gleich. |
| A-08 | Limits an der Grenze: 20000 Einträge ok, 20001 `TREE_TOO_LARGE`; 200 Änderungen ok, 201 `TOO_MANY_CHANGES`; Blob 2097152 Bytes ok, 2097153 `BLOB_TOO_LARGE`; Listing 4194304 Bytes ok, 4194305 `TREE_TOO_LARGE`. |
| A-09 | `grep` über `src/forge-verifier/`: `node:` nur in `node-sha256.ts`; kein `child_process`, `fs`, `process.env`, `fetch`; keine Provider-Namen (anthropic, openai, claude, codex, gpt). Tests rufen kein `git` auf. |
| A-10 | Pflicht-Mutation-Smokes §16: jeder Mutant `detected`; `not_applied` gilt nicht als Erfolg; keine Äquivalenz ohne konkrete Begründung. |
| A-11 | `tests/forge-verifier/typecheck.ts`: `changedFiles.push` ist Typfehler; `collectChangedFiles` ohne `scope` ist Typfehler; eine `switch`-Vollständigkeitsprüfung über `DiffAuthorityFailureCode` kompiliert; `renamed` ist für `changedFiles`-Elemente nicht zuweisbar. |
| A-12 | Kern-Integration: ein nicht im Scope liegender `added`-Pfad erzeugt `SCOPE_VIOLATION` **durch den Kern** (Nachweis: der Test kommt ohne eigene Scope-Logik aus und vergleicht mit einem direkten `evaluateVerification`-Aufruf). |
| A-13 | Produktionscode ≤ 400 Zeilen (§18). |

## 14. Testmatrix (Mindestumfang)

- Parser: leeres Listing; ein Eintrag; fehlendes End-NUL; Kopf mit 5-stelligem Modus, ungültigem Typ, `tree`, kurzem SHA, Großbuchstaben im SHA, Größe `-` bei `blob`, Zahl bei `commit`; leerer Pfad; Pfad mit TAB und mit Zeilenumbruch (roh, gültig für den Parser, dann §7); Größenfeld mit mehr als sieben Zeichen; Duplikat; Limits (A-08); Kopie statt View.
- Pfadregeln: jede Regel aus §7 mit auslösendem und knapp gültigem Fall (`src/a b.ts`, `src/a\tb.ts`, `src/café.ts` NFC und NFD, Backslash, `..`, `.`, 255 vs. 256 Zeichen, `.git`, `.GIT`, `GIT~1`, `git~12`, `node_modules`, `NODE_MODULES`, `con`, `CON.txt`, `aux.test.ts`, `lpt1.ts`, `com0.ts` (gültig), `.con` (gültig), `notes.`, `.gitkeep` (gültig)); `pathSubject` Text vs. Hex.
- Regeltabelle: jeder Eintrag von `PROTECTED_RULES` durch mindestens einen Pfad getroffen; Casefold (`Package.json`, `.GitHub/x`, `FORGE/contracts/x.md`); Stufenlogik mit `TASK-0006`, `FORGE-VERIFIER-0002`, `FORGEX-1` (kein Präfix-Treffer, also reserviert); `always` schlägt `forge` (`forge/contracts/x.md` für `FORGE-…` bleibt verboten).
- Tree-Regeln: `100755`, `120000`, `160000`, `040000`-artiger Eintrag, Typ `commit` mit Modus `100644`; Kollisionen Datei/Datei, Datei/Verzeichnis, drei Beteiligte, keine Kollision bei unterschiedlichen Verzeichnissen.
- Diff Authority: `added`/`modified`/`deleted`; Modus-only-Änderung ist `modified`; Rename als `deleted`+`added`; Reihenfolge und Stop-Verhalten (A-05); Scope-Pfad geschützt; `forge/coordination/` mit und ohne Scope-Eintrag für `FORGE-…`-Task; Kern-Übernahme (A-12); Golden-Listing (A-03); Permutation (A-06); Immutabilität (A-07); `listingSha256` mit injiziertem Fake-Hash und mit `nodeSha256Bytes`.

## 15. Adversariale Pflichttests (`tests/forge-verifier/diff-authority.test.ts`)

Jeder Fall nennt Eingabe und erwartete Codes; die Nummern verweisen auf die Matrix des Verifier-Pakets.

| ID | Eingabe | Erwartung |
|---|---|---|
| X-01 | `H` enthält `src/x.ts` als `120000` | `TREE_MODE_FORBIDDEN`, `changedFiles: null` |
| X-02 | `H` enthält `vendor/sub` als `160000 commit` | `TREE_MODE_FORBIDDEN` |
| X-03 | `src/a.ts` wechselt `100644` → `100755` | `TREE_MODE_FORBIDDEN` |
| X-04 | `git mv src/a.ts src/b.ts` (Scope erlaubt `src/b.ts`) | `SCOPE_VIOLATION` für `src/a.ts` (Löschung) |
| X-05 | `src/Accusation.ts` neben `src/accusation.ts` | `CASE_COLLISION` für beide |
| X-06 | Datei `src/a` neben `src/A/x.ts` | `CASE_COLLISION` |
| X-07 | `src/café.ts` (NFC) und (NFD) | `PATH_NOT_REPRESENTABLE` mit `hex:`-Subjekt |
| X-08 | `tests/aux.test.ts`, `tests/notes.`, `src/CON.ts` | `PATH_NOT_PORTABLE` |
| X-09 | `.GIT/config`, `src/GIT~1/x` | `PATH_GIT_RESERVED` |
| X-10 | `src/node_modules/zod/index.js` | `TREE_PATH_FORBIDDEN` |
| X-11 | `Package.json`, `src/package.json`, `tests/tsconfig.spec.json`, `src/vitest.config.mts`, `tests/__snapshots__/a.snap`, `tests/a.test.ts.snap` | `PROTECTED_PATH_CHANGED` je Pfad |
| X-12 | `TASK-0006` ändert `.github/workflows/forge-verify.yml` | `FORGE_PATH_RESERVED` plus `SCOPE_VIOLATION` |
| X-13 | `FORGE-VERIFIER-0002` ändert `.github/workflows/forge-verify.yml` mit Scope-Eintrag | kein `FORGE_PATH_RESERVED`; `passed: true` |
| X-14 | `FORGE-VERIFIER-0002` ändert `forge/contracts/TASK-0006.md` mit Scope-Eintrag | `PROTECTED_PATH_CHANGED`, `SCOPE_PATH_PROTECTED`, `SCOPE_VIOLATION` |
| X-15 | `FORGE-VERIFIER-0002` fügt `forge/coordination/CODEX.md` ohne Scope-Eintrag hinzu | `SCOPE_VIOLATION` (vom Verifier, obwohl der Kern allein es durchließe) |
| X-16 | Scope enthält `forge/Contracts/TASK-0006.md`; keine Änderung daran | `SCOPE_PATH_PROTECTED` |
| X-17 | 201 geänderte Dateien, alle im Scope | `TOO_MANY_CHANGES`, `changedFiles: null` |
| X-18 | Blob mit 2097153 Bytes im Scope | `BLOB_TOO_LARGE` |
| X-19 | Listing ohne End-NUL; Listing mit `tree`-Typ; Basis-Listing mit `src/a b.ts` | `TREE_LISTING_MALFORMED`; `TREE_LISTING_MALFORMED`; `PATH_NOT_REPRESENTABLE` mit `base:`-Präfix |
| X-20 | Pfad `src/new\nline.ts` (Zeilenumbruch im Pfad) | Parser ok, `PATH_NOT_REPRESENTABLE` |
| X-21 | Identische Listings, aber `scope.create` nennt eine Datei, die nicht entstand | `passed: true`, `changedFiles: []` (fehlende Dateien sind kein Diff-Thema) |
| X-22 | Developer-„Report“ ist kein Parameter | Kompilierzeit (A-11): es gibt keinen Weg, Behauptungen zu übergeben |

## 16. Pflicht-Mutation-Smokes

Je Mutant: exakt eine Stelle, in-memory angewandt (Methode wie `forge/reviews/FORGE-CORE-0001B.v2.mutations.json`),
Testlauf, Ergebnis `detected` mit Namen des fehlschlagenden Tests. Mindestens:

| ID | Mutant | Erwarteter Detektor |
|---|---|---|
| M01 | Parser akzeptiert ein Listing ohne End-NUL | `tree-listing.test.ts` |
| M02 | Parser akzeptiert Typ `tree` | `tree-listing.test.ts` |
| M03 | Duplikatprüfung entfernt | `tree-listing.test.ts` |
| M04 | `maxTreeEntries`-Prüfung entfernt | `tree-listing.test.ts` (A-08) |
| M05 | Bytes ≥ 0x80 gelten als darstellbar (`RepoPathSchema`-Prüfung entfernt) | `path-rules.test.ts` (NFC/NFD) |
| M06 | `.git`-Segmentprüfung entfernt | `path-rules.test.ts` |
| M07 | `git~N`-Prüfung entfernt | `path-rules.test.ts` |
| M08 | Reservierte Gerätenamen entfernt | `path-rules.test.ts` |
| M09 | Prüfung „Segment endet mit `.`“ entfernt | `path-rules.test.ts` |
| M10 | `node_modules`-Prüfung entfernt | `path-rules.test.ts` |
| M11 | `checkTree` akzeptiert `100755` | `tree-rules.test.ts` |
| M12 | Kollisionsvergleich ohne Casefold | `tree-rules.test.ts` |
| M13 | Datei/Verzeichnis-Kollision entfernt | `tree-rules.test.ts` |
| M14 | S6 vergleicht nur `sha`, nicht `mode` | `diff-authority.test.ts` |
| M15 | S6 lässt `deleted` weg | `diff-authority.test.ts` (X-04) |
| M16 | `protectedPathHit` ohne Casefold | `protected-paths.test.ts` (`Package.json`) |
| M17 | Stufe `forge` für jeden Task erlaubt | `protected-paths.test.ts`, X-12 |
| M18 | S10 (Kern-Aufruf) übersprungen oder Fehler verworfen | `diff-authority.test.ts` (A-12) |
| M19 | `maxBlobBytes`-Prüfung entfernt | `diff-authority.test.ts` (X-18) |
| M20 | S9 (Koordinationsausnahme) entfernt | `diff-authority.test.ts` (X-15) |
| M21 | Stop nach S5 entfernt (`changedFiles` trotz Modusfehler gefüllt) | `diff-authority.test.ts` (A-05) |
| M22 | `normalizeFailures` ohne Sortierung | `diff-authority.test.ts` (A-06) |

Der Kern kennt am Basis-Commit kein Feld für diese Liste; `mutationSmoke: "required"` verlangt deshalb den
Nachweis im Run-Protokoll (§19). Developer-Mutationsergebnisse sind Behauptungen, bis der Reviewer sie nachstellt.

## 17. Non-Goals

Aufruf von `git`, Checkout, Fetch, Ancestry, Contract-Bindung, Merge-Base (FORGE-VERIFIER-0002);
Container, Installation, Typecheck- und Testausführung, Testinventar, Evidence-Datei, Workflow-YAML
(FORGE-VERIFIER-0003); Mutantenlauf im Verifier (nach Kernerweiterung); Binärerkennung; Rename-Unterstützung;
Policy-Datei; Contract-Format 2; GitHub-API; Änderungen am Kern unter `src/forge/`.

## 18. Größe

Empfohlen ≤ 400 Zeilen Produktionscode unter `src/forge-verifier/` (inkl. Kommentare und Leerzeilen),
erwartet 300–380. Tests 600–900 Zeilen, ausgenommen.

## 19. Developer-Protokoll (Bootstrap)

1. Branch `forge/run/codex/FORGE-VERIFIER-0001-1` von `R` (aktueller `main`-Head, der `M` enthält). Kein Rebase, kein `--force`.
2. Contract ausschließlich aus Git lesen: `git cat-file -p <C>:forge/contracts/FORGE-VERIFIER-0001.md`; Quittung berechnen
   (`contract_commit`, `contract_blob` = `git rev-parse <C>:forge/contracts/FORGE-VERIFIER-0001.md`,
   `content_hash` = SHA-256 über `forge-contract-v1\n` + Text, `byte_count`, `end_marker` = letzte Zeile wörtlich)
   und als Block `FORGE READ RECEIPT v1` in den PR-Body stellen. Bei Abweichung zum Erwartungswert stoppen.
3. Staleness-Prüfung nach §3; bei Treffern stoppen und melden.
4. Nur die 14 Dateien aus §4 anlegen. `npm ci --ignore-scripts`, `npm run typecheck`, `npm test` lokal; Mutanten §16 nachweisen.
5. Draft-PR gegen `main` mit Quittung, Befehlen und Exit-Codes, Mutationsergebnissen, Abweichungen. Alles darin ist Behauptung;
   geprüfte Tatsachen sind, was Verifier und unabhängiger Reviewer selbst feststellen.
6. Widerspricht ein Prompt diesem Contract, gilt der Contract; die Abweichung wird gemeldet.

## 20. Freigabe (extern, nicht Teil dieses Dokuments)

Die Freigabe wird außerhalb dieses Textes festgehalten (`forge/approvals/FORGE-VERIFIER-0001.v1.architecture_review.json`,
gebunden an den Content-Hash dieses exakten Textes). Das Dokument selbst trägt keinen Status.

<!-- END OF CONTRACT FORGE-VERIFIER-0001 v1 -->
