---json
{
  "forgeContractFormat": 1,
  "taskId": "MYST-0003",
  "contractVersion": 1,
  "baseCommit": "3d7545d843883418348004e68717399a64da7a7d",
  "dependencies": [],
  "scope": {
    "create": [
      "src/domain/evidence-access.ts",
      "src/domain/evidence-access.identity.ts",
      "tests/evidence-access.fixture.ts",
      "tests/evidence-access.test.ts",
      "tests/evidence-access.identity.test.ts",
      "tests/evidence-access.security.test.ts",
      "tests/evidence-access.typecheck.ts"
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
# MYST-0003 v1 — Evidence Access & Investigation V1 (DRAFT)

Status: **DRAFT**, nicht registriert, nicht freigegeben. Ziel-Pfad bei Registrierung: `forge/contracts/MYST-0003.md`.
Format: `forgeContractFormat: 1`, so wie `parseContractDocument` auf `baseCommit` es tatsächlich akzeptiert (geprüft, §1.3). Format 2 existiert auf `main` nicht und wird hier nicht vorgetäuscht.

## 1. Verbindlichkeit, Basis und Abhängigkeiten

### 1.1 Ziel

Implementiere die kleinste deterministische, autorenseitig festgelegte Evidence-Discovery-Schicht für den headless Mystery Vertical Slice:

1. eine autorenseitige, an genau eine `CaseTruth` gebundene `EvidenceAccessMap`, die für **jede** Evidence der Truth eindeutig festlegt, ob und über welche strukturierten Investigation-Aktionen sie entdeckbar ist;
2. eine reine Funktion `resolveInvestigation(map, known, action)`, die für eine gültige, autorisierte Aktion die Menge der dadurch erreichbaren Evidence-IDs liefert;
3. eine Identität `hashEvidenceAccessMap` (`accessHash`) mit eigenem Kanonisierungsprofil.

Das Modul kennt keine Session, keine Event-Historie, kein Spielerwissen-Objekt, keine PlayerRefs, keine Präsentation und keinen Inhalt von Evidence. Es gibt **keinen** Evidence-Inhalt frei (§6).

### 1.2 Gelesene Fakten auf `baseCommit`

| Fakt | Ort |
|---|---|
| `EvidenceSchema` = strict `{ id, description, source, links }`; `links` ≥ 1, je Proposition höchstens einmal; `direction ∈ {supports, refutes}` | `src/domain/case-truth.ts` |
| `SourceRefSchema` = `person` \| `location` \| `item` \| `event`; Source ist Herkunft, kein Fundort | `src/domain/case-truth.ts` |
| ID-Schemas `EvidenceIdSchema`, `LocationIdSchema`, `ItemIdSchema`, `PersonIdSchema`, `EventIdSchema`, `CaseIdSchema`, Form `^<prefix>:[a-z0-9][a-z0-9_-]{0,63}$` (ASCII, kein Zeilenumbruch); IDs sind über alle Collections eindeutig | `src/domain/case-truth.ts` |
| `CaseTruth` ist tief eingefroren, gebrandet, nur über `parseCaseTruth` erhältlich; `DeepReadonly` exportiert | `src/domain/case-truth.ts` |
| `hashCaseTruth(truth)` → 64 Kleinbuchstaben-Hex; Profil `forge-case-c14n-v1` behandelt **jedes** Array als Menge (sortiert nach kanonischem JSON); `canonicalize` ist privat | `src/domain/case-truth.identity.ts` |
| Muster gebundener Parser: Factory `createNpcKnowledgeSchema(truth, …)`, Bindung zuerst, danach keine Folge-Issues; Ergebnis `deepFreeze(structuredClone(…))` + Brand | `src/domain/npc-knowledge.ts` |
| `fullCase()` → `case:letter-opener`, `revision: 3`, `hashCaseTruth` = `f8794eba02ff4cb846158a9d5d145ade93e24fd109d88f7a4b5244f175453a73`; 3 Personen, 2 Orte, 2 Items, 3 Events, 4 Evidence | `tests/case-truth.fixture.ts` (auf Basis ausgeführt) |
| `goldenCase()` → `case:golden`, keine Evidence, `hashCaseTruth` = `bd95eb9a8569f4f3f62eab50aac94e75cd601b54e3432776cc6663a204647501` | `tests/case-truth.fixture.ts` |
| Basis: `npm run typecheck` 0 Fehler, `npm test` 1087/1087 grün | auf `baseCommit` ausgeführt |
| Laufzeit-Dependencies: nur `zod` 4.6.5; `node:crypto` wird im Domain-Code bereits genutzt | `package.json`, `src/domain/*.identity.ts` |

### 1.3 Abhängigkeiten

`dependencies` ist leer. Begründung:

- TASK-0001 (CaseTruth) ist Legacy-Code auf `baseCommit`, im Forge-Kernel aber nicht als akzeptierter Task registriert. Ein Eintrag mit `acceptedCommit` würde in `src/forge/state.ts` als `DEPENDENCY_MISMATCH`, ein Eintrag mit `null` als `DEPENDENCY_UNRESOLVED` abgelehnt. Die Legacy-Grundlage ist über `baseCommit` gebunden.
- **MYST-0001 (PlayerRef V1) ist keine Abhängigkeit.** Dieses Modul arbeitet ausschließlich im Domain-ID-Raum. PlayerRef ist eine Übersetzung an der Spielergrenze, die später (Session/VS-5) vor und nach dem Aufruf stattfindet (§9). Es gibt keinen Import zwischen den Modulen und keine versteckte PlayerRef-Implementierung in diesem Task.

## 2. Dateien und Größenlimits

Nur die Dateien aus `scope.create`. Keine bestehende Datei wird geändert. Keine neue Dependency (Laufzeit oder Dev).

| Datei | Inhalt | Limit (physische Zeilen inkl. Kommentare) |
|---|---|---|
| `src/domain/evidence-access.ts` | Schemas, gebundener Parser, `resolveInvestigation` | ≤ 210 |
| `src/domain/evidence-access.identity.ts` | Profil, Serializer, Hash | ≤ 50 |
| Produktion gesamt | | **≤ 260** (Ziel < 400 klar eingehalten) |
| `tests/evidence-access.fixture.ts` | Factory `evidenceAccessFixture()` (§3.4), Golden-Konstanten (§7.3) | — |
| `tests/evidence-access*.test.ts`, `tests/evidence-access.typecheck.ts` | Testmatrix §11 | — |

## 3. Datenmodell

### 3.1 Investigation-Aktion (geschlossenes V1-Vokabular)

```ts
InvestigationActionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("search_location"), locationId: LocationIdSchema }),
  z.strictObject({ kind: z.literal("examine_item"), itemId: ItemIdSchema }),
  z.strictObject({ kind: z.literal("examine_person"), personId: PersonIdSchema }),
]);
```

Jede Aktion hat genau ein Ziel. Abbildung Aktion → Ziel (`actionTarget`):

| Aktion | Ziel `{ kind, id }` |
|---|---|
| `search_location` | `{ kind: "location", id: locationId }` |
| `examine_item` | `{ kind: "item", id: itemId }` |
| `examine_person` | `{ kind: "person", id: personId }` |

Die Abbildung ist bijektiv. Zielschlüssel: `` `${kind}|${id}` `` (`targetKey`). Es gibt keine Ereignis-Aktion (Events haben in V1 keinen Ort der Untersuchung), keine Befragung (VS-4) und keine weiteren Parameter.

### 3.2 Zugriffsstatus je Evidence

```ts
EvidenceAccessSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("inaccessible") }),
  z.strictObject({ kind: z.literal("discoverable"), paths: z.array(InvestigationActionSchema).min(1) }),
]);
EvidenceAccessEntrySchema = z.strictObject({ evidenceId: EvidenceIdSchema, access: EvidenceAccessSchema });
```

- `inaccessible`: durch **keine** Investigation-Aktion entdeckbar. Ob ein anderer Mechanismus (z. B. Befragung, VS-4) die Evidence später freigibt, ist nicht Gegenstand dieses Tasks.
- `discoverable`: entdeckbar durch **jede** der Aktionen in `paths` (ODER). `paths` ist eine nichtleere Menge; zwei Pfade mit gleichem `targetKey` sind Duplikate.

### 3.3 Map

```ts
EvidenceAccessMapShape = z.strictObject({
  schemaVersion: z.literal(1),
  caseId: CaseIdSchema,
  truthHash: z.string().regex(/^[0-9a-f]{64}$/),
  entries: z.array(EvidenceAccessEntrySchema),
});
```

Keine `revision`, kein `label`, kein Freitext, keine Zahl außer `schemaVersion`. Die Identität der Map ist ihr Hash (§7).

### 3.4 Fixture (verbindlich, `tests/evidence-access.fixture.ts`)

`evidenceAccessFixture()` liefert ein frisches, veränderbares Objekt (Factory) gegen `parseCaseTruth(fullCase())`:

```ts
{
  schemaVersion: 1,
  caseId: "case:letter-opener",
  truthHash: "f8794eba02ff4cb846158a9d5d145ade93e24fd109d88f7a4b5244f175453a73",
  entries: [
    { evidenceId: "evidence:fingerprint", access: { kind: "discoverable", paths: [
      { kind: "examine_item", itemId: "item:letter-opener" },
      { kind: "search_location", locationId: "location:library" } ] } },
    { evidenceId: "evidence:anna-statement", access: { kind: "inaccessible" } },
    { evidenceId: "evidence:muddy-path", access: { kind: "discoverable", paths: [
      { kind: "search_location", locationId: "location:garden" } ] } },
    { evidenceId: "evidence:gloves-dirty", access: { kind: "discoverable", paths: [
      { kind: "examine_item", itemId: "item:gloves" },
      { kind: "search_location", locationId: "location:garden" } ] } },
  ],
}
```

Ein Test prüft, dass `truthHash` gleich `hashCaseTruth(parseCaseTruth(fullCase()))` ist.

## 4. Gebundener Parser

```ts
createEvidenceAccessMapSchema(truth: CaseTruth)   // Zod-Schema, Bindung an genau diese Truth
parseEvidenceAccessMap(input: unknown, truth: CaseTruth): EvidenceAccessMap   // wirft ZodError
```

Regeln, in dieser Reihenfolge, als `superRefine` auf `EvidenceAccessMapShape`:

- **R1 Bindung.** `caseId === truth.caseId` und `truthHash === hashCaseTruth(truth)`. `hashCaseTruth` wird einmal pro Schema-Erzeugung berechnet. Schlägt R1 fehl, werden Issues an `["caseId"]` bzw. `["truthHash"]` gemeldet und **keine** weiteren Regeln geprüft. `truth.revision` wird nicht verglichen.
- **R2 Evidence-Referenz.** Jede `evidenceId` existiert in `truth.evidence`, sonst Issue an `["entries", i, "evidenceId"]`.
- **R3 Eindeutigkeit.** Höchstens ein Eintrag je `evidenceId`; jeder weitere Eintrag erhält ein Issue an `["entries", i, "evidenceId"]`.
- **R4 Vollständigkeit.** Jede Evidence von `truth` hat einen Eintrag; je fehlender Evidence ein Issue an `["entries"]`, Nachricht enthält die fehlende ID.
- **R5 Ziel-Referenz.** Jedes Pfadziel existiert in der Collection seiner Art (`locations`, `items`, `persons`) von `truth`, sonst Issue an `["entries", i, "access", "paths", j, <idFeld>]`.
- **R6 Pfad-Eindeutigkeit.** Innerhalb eines Eintrags kein `targetKey` doppelt; Issue an `["entries", i, "access", "paths", j]`.

Kein weiterer semantischer Abgleich: Es wird **nicht** geprüft, ob ein Pfadziel zu `Evidence.source`, zu Event-Orten, zu Links oder zur Wahrheit von Propositionen passt. Autorenfehlermeldungen dürfen IDs enthalten; sie sind autorenseitig.

Ergebnis: `deepFreeze(structuredClone(parsed))`, gebrandet `"EvidenceAccessMap"`, Typ `DeepReadonly<…>`. Keine geteilten Objekte mit der Eingabe; die Eingabe wird nie verändert.

## 5. Investigation-Auflösung

```ts
resolveInvestigation(map: EvidenceAccessMap, known: unknown, action: unknown): InvestigationResult
```

### 5.1 Eingaben

- `known`: Array von `KnownEntityRef` = strict `{ kind, id }` mit `kind ∈ {"person","location","item","event","evidence"}` und dem zur Art passenden ID-Schema (strukturell gleich `ResolvedEntity` aus dem MYST-0001-Entwurf, ohne Import). Mengen-Semantik: Reihenfolge und Duplikate sind bedeutungslos; `[]` ist gültig. Nur Refs der Zielarten (`person`, `location`, `item`) haben Wirkung.
- `action`: wird mit `InvestigationActionSchema` geparst.

### 5.2 Algorithmus

1. `action` parsen; bei Fehler → `INVALID_ACTION`.
2. `known` mit `z.array(KnownEntityRefSchema)` parsen; bei Fehler → `INVALID_KNOWN_REFS`.
3. `target = actionTarget(parsedAction)`; ist `targetKey(target)` nicht in der Menge der `targetKey` aus `known` → `TARGET_NOT_KNOWN`.
4. `found` = alle `evidenceId` der Einträge mit `access.kind === "discoverable"`, die einen Pfad mit `targetKey` gleich `targetKey(target)` haben; aufsteigend nach UTF-16-Codeeinheiten sortiert (kein `localeCompare`).
5. Rückgabe `{ success: true, found }`, neu konstruiert und tief eingefroren.

Nach Schritt 1 und 2 werden ausschließlich die Parse-Ergebnisse verwendet; die Roh-Eingaben werden nicht erneut gelesen.

### 5.3 Ergebnis

```ts
type InvestigationErrorCode = "INVALID_ACTION" | "INVALID_KNOWN_REFS" | "TARGET_NOT_KNOWN";
type InvestigationResult =
  | { readonly success: true; readonly found: readonly EvidenceId[] }
  | { readonly success: false; readonly code: InvestigationErrorCode };
```

- Fehlerergebnisse sind modulweite, eingefrorene Konstanten (genau eine je Code) mit genau den Schlüsseln `success`, `code`. Kein Echo, keine ID, keine Art, keine Nachricht.
- Ein unbekanntes und ein fallfremdes Ziel ergeben dasselbe `TARGET_NOT_KNOWN` (kein Existenz-Orakel).
- `found: []` ist ein Erfolg (Ziel ohne Evidence, nur inaccessible Evidence, oder wiederholte Aktion).

### 5.4 Festgelegte Semantik

- **Rein:** gleiche Eingaben → tief gleiches Ergebnis; kein Zustand, kein Zufall, keine Zeit.
- **Wiederholung:** eine wiederholte gültige Aktion ist gültig und liefert dasselbe `found`; "neu entdeckt" berechnet der Aufrufer als Mengendifferenz.
- **Monoton, idempotent:** `discovered' = discovered ∪ found`; die Vereinigung hängt nur von der Menge der ausgeführten Aktionen ab.
- **Keine Freischaltung:** Discovery erweitert `known` nie; `found` enthält nur Evidence-IDs.
- **Inaccessible** Evidence erscheint in keinem `found`.
- **Auflösung ≠ Autorisierung:** Schritt 3 ist die einzige Autorisierung. Ob `known` selbst korrekt und fallgebunden ist, verantwortet der Aufrufer (VS-5). Ein fallfremder, aber in `known` aufgeführter Ref ergibt `found: []` (A-39); eine Map eines anderen Falls ergibt `found: []` (A-76). Beides ist festgehaltenes Verhalten, kein Fehlercode.
- `resolveInvestigation` liest aus `map` ausschließlich `entries[].evidenceId` und `entries[].access`. Es erhält weder `CaseTruth` noch `CaseSolution` noch `NpcKnowledgeSnapshot`.

## 6. Informationsgrenze: entdeckt ≠ freigegeben

- `found` ist ein **interner** Domain-Wert. Kanonische Evidence-IDs können sprechend sein (`evidence:ben-is-the-murderer`) und dürfen nie direkt einen Spieler erreichen. Die Übersetzung in PlayerRefs ist Aufgabe der späteren Session-Schicht über MYST-0001.
- Dieses Modul gibt **keinen** Evidence-Inhalt frei: keine `description`, keine `source`, keine `links`, keine Proposition-IDs, keine Wahrheitswerte, keine Namen, keine Zielinformation. Der Quelltext von `src/domain/evidence-access*.ts` enthält die Bezeichner `description` und `links` nicht.
- Ein spielersicherer Evidence-Inhalt (autorenseitiger Text, freigegebene Aussagen) ist Nicht-Ziel (§13).

## 7. Identität und Hashing

### 7.1 Profil `forge-evidence-access-c14n-v1`

- Objekt-Schlüssel rekursiv nach UTF-16-Codeeinheiten sortiert (kein `localeCompare`).
- Jedes Array ist eine Menge: Elemente nach ihrem eigenen kanonischen JSON sortiert.
- Primitive über `JSON.stringify`, kein Whitespace, kein abschließender Zeilenumbruch; Strings weder getrimmt noch normalisiert.
- Eingabe ist ausschließlich das geparste, gebundene `EvidenceAccessMap`.

Prüfung der Array-Semantik (warum die Mengenregel hier korrekt ist): Die Map enthält genau zwei Arrays, `entries` und `paths`. Beide sind fachlich Mengen (Reihenfolge bedeutungslos, §3.2, §5.4), und R3/R6 schließen Duplikate aus, sodass Sortieren keine zwei verschiedenen Maps auf denselben String abbildet. Die Regeln entsprechen wörtlich `forge-case-c14n-v1`; das Profil ist trotzdem eigenständig, damit Truth-, Solution- und Access-Hashes nie verwechselbar sind. `canonicalize` wird wie in `case-solution.identity.ts` lokal dupliziert (die Truth-Version ist privat; keine bestehende Datei wird geändert).

### 7.2 Hash

`hashEvidenceAccessMap(map)` = SHA-256 (hex, klein) über UTF-8 von `"forge-evidence-access-c14n-v1\n" + serializeEvidenceAccessMap(map)`. Der Hash ist über `truthHash` und `caseId` an die exakte Truth gebunden. Jede Änderung eines Pfads, eines Zugriffsstatus, der Bindung oder der Eintragsmenge ändert den Hash; Umordnen nicht.

### 7.3 Golden Vectors (zweifach berechnet: Node `node:crypto` und Python `hashlib`)

`CANON_M` (Fixture §3.4, 733 Bytes):

```text
{"caseId":"case:letter-opener","entries":[{"access":{"kind":"discoverable","paths":[{"itemId":"item:gloves","kind":"examine_item"},{"kind":"search_location","locationId":"location:garden"}]},"evidenceId":"evidence:gloves-dirty"},{"access":{"kind":"discoverable","paths":[{"itemId":"item:letter-opener","kind":"examine_item"},{"kind":"search_location","locationId":"location:library"}]},"evidenceId":"evidence:fingerprint"},{"access":{"kind":"discoverable","paths":[{"kind":"search_location","locationId":"location:garden"}]},"evidenceId":"evidence:muddy-path"},{"access":{"kind":"inaccessible"},"evidenceId":"evidence:anna-statement"}],"schemaVersion":1,"truthHash":"f8794eba02ff4cb846158a9d5d145ade93e24fd109d88f7a4b5244f175453a73"}
```

`CANON_E` (`goldenCase()`, `entries: []`):

```text
{"caseId":"case:golden","entries":[],"schemaVersion":1,"truthHash":"bd95eb9a8569f4f3f62eab50aac94e75cd601b54e3432776cc6663a204647501"}
```

| Vektor | Änderung gegenüber Fixture | SHA-256 |
|---|---|---|
| `H0` | keine | `fb7cd127d9dcc0981c1167e49acfb946230b7695903d1104ead6fb0ca5cee967` |
| `HE` | `CANON_E` | `95b862a0008e37447750580f8c3dacc64ca3fff5e915bbd6320d42e02111a8af` |
| `H1` | `muddy-path`: `location:garden` → `location:library` | `e7543458ac142e2da7c6486b39a9aa195f56e00c30f9535b462ea60c5ce52914` |
| `H2` | `muddy-path` → `{ kind: "inaccessible" }` | `757c0657b2bd5a9bdd4b64696e9500e64871375e57165ee7adef8a083780b2ea` |
| `H3` | `anna-statement` → discoverable über `examine_person person:anna` | `7219592d209ef60e7edb6960d068f07037504f9f9c1d641bb69c7f30c6461004` |
| `H5` | `fingerprint`: zweiten Pfad (`search_location location:library`) entfernt | `87006a8f938bbf4c3124caa17cb662499195653881620b6973a98c49574dbe6f` |
| `H6` | `truthHash` = `"0".repeat(64)` (nur Serializer) | `80d382cd426d83385d1e4bb058de0e0c773b98f046a54a52e7b4ca24cf14c065` |
| `H0` | Einträge umgekehrt und Pfade von `fingerprint` umgekehrt | `fb7cd127…` (gleich) |

## 8. Öffentliche API (vollständig)

`src/domain/evidence-access.ts`:

```ts
export const INVESTIGATION_ACTION_KINDS: readonly ["search_location", "examine_item", "examine_person"];
export const InvestigationActionSchema;      // §3.1
export type InvestigationAction;
export const EvidenceAccessSchema;           // §3.2
export const EvidenceAccessEntrySchema;      // §3.2
export const KnownEntityRefSchema;           // §5.1
export type KnownEntityRef;
export function createEvidenceAccessMapSchema(truth: CaseTruth); // §4, Output gebrandet "EvidenceAccessMap"
export type EvidenceAccessMapInput;          // z.input des gebundenen Schemas
export type EvidenceAccessMap;               // tief readonly, gebrandet
export function parseEvidenceAccessMap(input: unknown, truth: CaseTruth): EvidenceAccessMap;
export type InvestigationErrorCode = "INVALID_ACTION" | "INVALID_KNOWN_REFS" | "TARGET_NOT_KNOWN";
export type InvestigationResult;             // §5.3
export function resolveInvestigation(map: EvidenceAccessMap, known: unknown, action: unknown): InvestigationResult;
```

`src/domain/evidence-access.identity.ts`:

```ts
export const EVIDENCE_ACCESS_CANONICALIZATION_PROFILE = "forge-evidence-access-c14n-v1";
export function serializeEvidenceAccessMap(map: EvidenceAccessMap): string;
export function hashEvidenceAccessMap(map: EvidenceAccessMap): string;
```

Weitere Exporte sind nicht erlaubt. Erlaubte Imports: `zod`, `node:crypto`, `./case-truth.ts`, `./case-truth.identity.ts` (nur `hashCaseTruth`), zwischen den beiden neuen Dateien nur Typen. Verboten im Produktionscode: `Math.random`, `Date`, `localeCompare`, `WeakMap`/`WeakSet`/`WeakRef`, modulweiter veränderlicher Zustand, Imports aus `npc-knowledge*`, `case-solution*`, `case-semantics`, `src/forge/*`.

## 9. Grenze zur Session (VS-5)

Dieser Task definiert **kein** `SessionEvent`, keine `seq`, kein Save/Load, kein `firstDiscoverySeq`, keine Session-Phase und keinen Zustand entdeckter Evidence. Vorgesehene Nutzung durch VS-5 (nicht Teil dieses Vertrags): PlayerRef auflösen (MYST-0001) → Domain-Aktion bilden → `resolveInvestigation(map, knownDomainRefs, action)` → Mengendifferenz zu bereits Entdecktem → Evidence-IDs über `playerRefFor` übersetzen. VS-5 bindet `truthHash` und `hashEvidenceAccessMap(map)` im Paket und prüft, dass Map, Truth und `known` zum selben Paket gehören.

## 10. Acceptance Criteria

- AC-1 Nur die sieben `scope.create`-Dateien entstehen; keine bestehende Datei ändert sich; `package.json`/`package-lock.json` unverändert.
- AC-2 `npm run typecheck` 0 Fehler; `npm test` grün, inklusive aller 1087 bestehenden Tests.
- AC-3 Öffentliche API exakt §8; Typen wie spezifiziert.
- AC-4 Parser erfüllt R1–R6 mit den angegebenen Issue-Pfaden; R1-Fehler unterdrückt Folge-Issues.
- AC-5 `resolveInvestigation` erfüllt §5.2–§5.4 einschließlich Prüfreihenfolge und Fehlerkonstanten.
- AC-6 Jede Evidence der Truth wird genau einmal behandelt; inaccessible Evidence ist nie in `found`.
- AC-7 Kein Evidence-Inhalt, keine Proposition, kein Wahrheitswert, keine Zielinformation in irgendeinem Ergebnis (§6).
- AC-8 Hash und kanonische Strings entsprechen exakt §7.3.
- AC-9 Parse- und Auflösungsergebnisse sind tief eingefroren; Eingaben werden nie verändert.
- AC-10 Produktionszeilen ≤ 260 (§2); jeder Mutationsanker aus §12 kommt im angegebenen Produktionsfile genau einmal wörtlich vor.
- AC-11 Jeder Mutant aus §12 wird von mindestens einem benannten Test getötet (manuell oder per Skript nachgewiesen, Ergebnis im PR-Text).
- AC-12 Alle Testfälle A-01…A-77 aus §11 sind implementiert; Test-Titel beginnen mit der Fall-ID.

## 11. Testmatrix

Legende Ergebnis: `OK` = Parse erfolgreich bzw. `{ success: true, found }`; `ISSUE@pfad` = `ZodError` mit Issue an diesem Pfad; `IA` = `INVALID_ACTION`, `IK` = `INVALID_KNOWN_REFS`, `TNK` = `TARGET_NOT_KNOWN`. `M` = Fixture-Map (§3.4), `T` = `parseCaseTruth(fullCase())`, `K` = alle Personen, Orte und Items von `T` als bekannte Refs. Datei: `P` = `tests/evidence-access.test.ts`, `I` = `tests/evidence-access.identity.test.ts`, `S` = `tests/evidence-access.security.test.ts`, `C` = `tests/evidence-access.typecheck.ts`.

| ID | Datei | Fall | Eingabe / Mutation | Erwartung |
|---|---|---|---|---|
| A-01 | P | Gültige Map | `M` gegen `T` | OK; Ergebnis tief eingefroren; `entries.length === 4` |
| A-02 | P | Falscher Fall | `caseId: "case:other"` | genau 1 Issue `ISSUE@caseId`; keine Folge-Issues (Bindung zuerst) |
| A-03 | P | Geänderte Truth | `M` gegen Truth mit geänderter Event-Beschreibung | `ISSUE@truthHash` |
| A-04 | P | Gleiche Revision, andere Truth | Truth mit `revision: 3`, nur `proposition:anna-in-garden.truth` invertiert | `ISSUE@truthHash`; `revision` spielt für die Bindung keine Rolle |
| A-05 | P | Hash-Form | `truthHash` in Großbuchstaben / 63 Zeichen | `ISSUE@truthHash` (Schema) |
| A-06 | P | Fremde Evidence | zusätzlicher Eintrag `evidence:other` | `ISSUE@entries,4,evidenceId` |
| A-07 | P | Fehlender Eintrag | Eintrag `evidence:gloves-dirty` entfernt | `ISSUE@entries` mit Nennung der fehlenden ID |
| A-08 | P | Doppelter Eintrag, gleicher Inhalt | Eintrag 0 dupliziert | `ISSUE@entries,4,evidenceId` |
| A-09 | P | Doppelter Eintrag, widersprüchlich | `evidence:muddy-path` zusätzlich als `inaccessible` | `ISSUE@entries,4,evidenceId` |
| A-10 | P | Fremdes Ziel | Pfad `search_location` `location:cellar` | `ISSUE@entries,i,access,paths,j,locationId` |
| A-11 | P | Falsche Zielart | `{ kind: "search_location", locationId: "item:gloves" }` | Schema-Issue an `locationId` |
| A-12 | P | Falsches Feld | `{ kind: "search_location", itemId: "item:gloves" }` | Schema-Issue (strict, fehlendes `locationId`) |
| A-13 | P | Doppelter Pfad | derselbe Pfad zweimal, Schlüsselreihenfolge vertauscht | `ISSUE@entries,i,access,paths,1` |
| A-14 | P | Leere Pfadliste | `{ kind: "discoverable", paths: [] }` | Schema-Issue an `paths` |
| A-15 | P | Inaccessible mit Pfaden | `{ kind: "inaccessible", paths: [...] }` | Schema-Issue (strict) |
| A-16 | P | Unbekannter Zugriffsstatus | `{ kind: "hidden" }` | Schema-Issue an `access,kind` |
| A-17 | P | Event als Ziel | `{ kind: "inspect_event", eventId: "event:walk" }` | Schema-Issue an `kind` (kein V1-Ziel) |
| A-18 | P | Unbekanntes Feld Wurzel | `revision: 1` | Schema-Issue (strict) |
| A-19 | P | Unbekanntes Feld Eintrag | `label: "Fingerabdruck"` | Schema-Issue (strict) |
| A-20 | S | `__proto__` Wurzel | `JSON.parse` mit `"__proto__": { "polluted": true }` | Schema-Issue; `({}).polluted === undefined` |
| A-21 | S | `constructor` / `prototype` | als Schlüssel in einem Pfad und einem Eintrag | je Schema-Issue |
| A-22 | P | schemaVersion | `2`, `"1"`, `0`, `-0`, `NaN`, `Infinity`, `2**53` | je Schema-Issue; `1.0` ist identisch zu `1` und OK |
| A-23 | P | Null Evidence | `goldenCase()` mit `entries: []` | OK |
| A-24 | S | Eingabemutation Parse | Eingabe vorher/nachher `structuredClone`-Vergleich; nach dem Parse Eingabe ändern | Eingabe unverändert; Ergebnis bleibt unverändert (keine geteilten Objekte) |
| A-25 | S | Deep Freeze | rekursiv über das Parse-Ergebnis | jedes Objekt/Array `Object.isFrozen`; Zuweisung wirft `TypeError` |
| A-26 | P | Source ≠ Fundort | `evidence:gloves-dirty` (Source `event:walk`) über `examine_item item:gloves` | OK, kein Issue |
| A-27 | P | Stützt falsche Proposition | `evidence:fingerprint` stützt `proposition:anna-at-murder` (`truth: false`), discoverable | OK |
| A-28 | P | Widerlegt wahre Proposition | Truth-Variante: `evidence:muddy-path` `refutes` `proposition:anna-in-garden` (`truth: true`), Map neu gebunden | OK; `found` identisch zu A-30 |
| A-29 | P | Map ohne Discovery-Pfad gültig | alle Einträge `inaccessible` | OK; jede Aktion liefert `found: []` |
| A-30 | P | Mehrere Evidence an einem Ziel | `search_location location:garden`, `K` | OK `["evidence:gloves-dirty","evidence:muddy-path"]` (sortiert) |
| A-31 | P | Zwei Pfade zu einer Evidence | `examine_item item:letter-opener` und `search_location location:library` | beide OK `["evidence:fingerprint"]` |
| A-32 | P | Wiederholte Suche | A-30 zweimal | beide OK, tief gleich; kein Fehler |
| A-33 | P | Null Evidence am Ziel | `examine_person person:ben` | OK `[]` |
| A-34 | P | Inaccessible nie entdeckbar | jede Aktion über jedes Ziel von `K` | `evidence:anna-statement` in keinem `found` |
| A-35 | P | Source-Person nicht Fundort | `examine_person person:anna` | OK `[]` (Statement ist inaccessible) |
| A-36 | P | Ziel dem Spieler unbekannt | A-30 mit `known: []` | TNK |
| A-37 | P | Teilwissen | `known` nur `location:library`; Aktion `search_location location:garden` | TNK |
| A-38 | S | Fremdes Ziel | `search_location location:cellar`, `K` | TNK; `Object.is` mit Ergebnis aus A-36 (kein Existenz-Orakel) |
| A-39 | P | Fremdes Ziel in `known` (Aufruferfehler) | `known = [...K, { kind: "location", id: "location:cellar" }]`, Aktion darauf | OK `[]` (festgehaltenes Verhalten, §5.4) |
| A-40 | P | Falsche Zielart in Aktion | `{ kind: "examine_item", itemId: "location:garden" }` | IA |
| A-41 | P | Unbekannte Aktion | `kind: "search"`, `"inspect_event"`, `"interrogate"` | je IA |
| A-42 | S | Unbekanntes Aktionsfeld | `{ ..., depth: 2 }` | IA |
| A-43 | S | `__proto__` in Aktion | `JSON.parse('{"kind":"search_location","locationId":"location:garden","__proto__":{"x":1}}')` | IA; keine Prototyp-Verschmutzung |
| A-44 | S | Aktion kein Objekt | `null`, `undefined`, `"location:garden"`, `[]`, `42`, `true` | je IA |
| A-45 | S | Ungültige known-Refs | kein Array; `null`-Element; Zusatzfeld; `kind: "proposition"`; `kind: "conclusion"`; `{ kind: "item", id: "location:garden" }` | je IK |
| A-46 | P | Fehlerreihenfolge | Aktion und `known` ungültig | IA |
| A-47 | P | known-Reorder und Duplikate | `K` umgekehrt und jedes Element doppelt | Ergebnis tief gleich zu A-30 |
| A-48 | P | Property-Reorder | Aktion und known-Refs mit vertauschter Schlüsselreihenfolge | Ergebnis tief gleich |
| A-49 | P | Map-Reorder | Einträge und Pfade umgekehrt | Ergebnis jeder Aktion tief gleich; Hash = `H0` |
| A-50 | S | Eingabemutation Resolve | `known`, `action` vorher/nachher verglichen; tief eingefrorene Eingaben | unverändert; eingefrorene Eingaben werden akzeptiert |
| A-51 | S | Ergebnis eingefroren | Erfolg und Fehler | `Object.isFrozen` rekursiv; `found` ist nicht dasselbe Array wie in der Map |
| A-52 | S | Getter in Aktion | `locationId`-Getter, der beim zweiten Lesen wirft | kein Wurf; Ergebnis entspricht dem ersten gelesenen Wert |
| A-53 | S | Geerbte Felder | `Object.create({ kind: "search_location", locationId: "location:garden" })` | Ergebnis tief gleich zur Plain-Object-Aktion (festgehaltenes Zod-Verhalten) |
| A-54 | S | Fehler ohne Echo | alle Fehlerergebnisse | `JSON.stringify(result)` ist exakt `{"success":false,"code":"<CODE>"}` |
| A-55 | S | Erfolg ohne Inhalte | jedes Erfolgsergebnis | Schlüssel exakt `["success","found"]`; JSON enthält keine `description`, keinen Namen, kein `proposition:`, kein `location:`/`item:`/`person:`/`event:`, kein `true`/`false` außer `success` |
| A-56 | S | Keine Wahrheitsenthüllung | zwei Truths, nur Propositions-`truth` invertiert, je eigene gebundene Map gleichen Inhalts | `found` für alle Aktionen identisch |
| A-57 | C | Keine Lösungsenthüllung | `resolveInvestigation` hat genau 3 Parameter; `CaseSolution` als Argument ist Typfehler | Typecheck |
| A-58 | C | Kein NPC-Wissen | `NpcKnowledgeSnapshot` als Argument ist Typfehler; Modul importiert `npc-knowledge*` nicht | Typecheck + Quelltext-Test in S |
| A-59 | S | ID-Leak in Fehlern | Fehler aus A-36, A-38, A-40 | jeweils eingefrorene Konstante, `Object.is`-gleich pro Code |
| A-60 | S | Sprechende ID | Truth-Variante mit `evidence:ben-is-the-murderer` | erscheint nur in `found` (intern, §6); nie in Fehlern; Typ ist `EvidenceId` |
| A-61 | S | Unicode / Escaping | `location:gärten`, kyrillisches `а` in `location:gаrden`, Vollbreite, `"location:garden\n"`, `"location:garden\u0000"`, `" location:garden"` | Aktion: IA; in der Map: Schema-Issue |
| A-62 | I | Golden Vector Fixture | `serializeEvidenceAccessMap(parse(M))` und Hash | exakt `CANON_M` und `H0` (§7.3) |
| A-63 | I | Golden Vector leer | `goldenCase()`-Map mit `entries: []` | exakt `CANON_E` und `HE` |
| A-64 | I | Pfadänderung | `muddy-path`: Garten → Bibliothek | `H1` ≠ `H0` |
| A-65 | I | accessible → inaccessible | `muddy-path` inaccessible | `H2` |
| A-66 | I | inaccessible → discoverable | `anna-statement` über `examine_person person:anna` | `H3` |
| A-67 | I | Pfad entfernt | zweiter Pfad von `fingerprint` entfernt | `H5` |
| A-68 | I | Andere Truth-Bindung | `truthHash` = 64×`0` (nur Serializer-Ebene, ohne Parse) | `H6` |
| A-69 | I | Reorder-Invarianz | Einträge, Pfade, Objektschlüssel permutiert | `H0` |
| A-70 | I | Domänentrennung | Hash ≠ SHA-256(`"forge-case-c14n-v1\n"` + `CANON_M`) und ≠ `hashCaseTruth(T)` | ungleich |
| A-71 | I | Hash-Form | jeder Hash | `/^[0-9a-f]{64}$/` |
| A-72 | P | Monotonie / Idempotenz | alle Folgen der Länge ≤ 3 über 7 Aktionen (inkl. Wiederholungen) | Vereinigung der `found` hängt nur von der Aktionsmenge ab, nicht von Reihenfolge oder Wiederholung |
| A-73 | P | Keine Freischaltung | nach A-30 `known` unverändert; `examine_person person:anna` bleibt bei `known` ohne Anna TNK | Discovery erweitert `known` nie |
| A-74 | C | Brand | Plain-Objekt als `EvidenceAccessMap` | Typfehler |
| A-75 | C | Rückgabetyp | `found` ist `readonly EvidenceId[]`; Zuweisung an `found[0]` | Typfehler |
| A-76 | S | Map anderer Fall (Aufruferfehler) | Map für `case:golden`, Aktion/known aus `T` | OK `[]` (festgehaltenes Verhalten, Bindung ist Aufgabe von VS-5, §9) |
| A-77 | S | Quelltextgrenzen | Quelltext von `src/domain/evidence-access*.ts` | kein `Math.random`, `Date`, `localeCompare`, `WeakMap`, `npc-knowledge`, `case-solution`, `description`, `links` |

## 12. Mutationsanker und Mutanten

Jeder Anker kommt im genannten File **genau einmal** wörtlich vor.

| Anker | File |
|---|---|
| `if (map.truthHash !== truthHash)` | `evidence-access.ts` |
| `if (!evidenceIds.has(entry.evidenceId))` | `evidence-access.ts` |
| `if (!covered.has(evidence.id))` | `evidence-access.ts` |
| `if (seenPaths.has(key))` | `evidence-access.ts` |
| `if (!knownKeys.has(targetKey(target))) return TARGET_NOT_KNOWN;` | `evidence-access.ts` |
| `if (!targets[target.kind].has(target.id))` | `evidence-access.ts` |
| `found.sort(byCodeUnits)` | `evidence-access.ts` |
| `value.map(canonicalize).sort(byCodeUnits)` | `evidence-access.identity.ts` |
| `` `${EVIDENCE_ACCESS_CANONICALIZATION_PROFILE}\n${serializeEvidenceAccessMap(map)}` `` | `evidence-access.identity.ts` |

| Mutant | before → after | muss töten |
|---|---|---|
| M1 Truth-Bindung aus | `if (map.truthHash !== truthHash)` → `if (false)` | A-03, A-04 |
| M2 Vollständigkeit aus | `if (!covered.has(evidence.id))` → `if (false)` | A-07 |
| M3 Pfad-Duplikate erlaubt | `if (seenPaths.has(key))` → `if (false)` | A-13 |
| M4 Autorisierung aus | `if (!knownKeys.has(targetKey(target))) return TARGET_NOT_KNOWN;` → `` (Zeile entfernt) | A-36, A-37, A-38 |
| M5 Fremde Evidence erlaubt | `if (!evidenceIds.has(entry.evidenceId))` → `if (false)` | A-06 |
| M6 Fremdes Pfadziel erlaubt | `if (!targets[target.kind].has(target.id))` → `if (false)` | A-10 |
| M7 Unsortiert | `found.sort(byCodeUnits)` → `found` | A-30 |
| M8 Array-Reihenfolge im Hash | `value.map(canonicalize).sort(byCodeUnits)` → `value.map(canonicalize)` | A-62, A-69 |
| M9 Profil-Präfix fehlt | `` `${EVIDENCE_ACCESS_CANONICALIZATION_PROFILE}\n${serializeEvidenceAccessMap(map)}` `` → `serializeEvidenceAccessMap(map)` | A-62, A-63, A-70 |

## 13. Non-Goals

- Keine PlayerRef-Erzeugung, -Auflösung oder -Abhängigkeit (MYST-0001).
- Kein spielersicherer Evidence-Inhalt, keine Freigabe von `description`, `source`, `links`, Propositionen oder Wahrheitswerten; kein `label`.
- Kein Discovery-Zustand, keine Historie, kein `SessionEvent`, keine `seq`, kein Save/Load, keine Phase, kein CasePackage.
- Keine Freischaltung neuer Ziele durch Funde, keine Ketten, keine Voraussetzungen, keine Rätsel.
- Keine Zeit, keine Wahrscheinlichkeit, keine Würfe, keine Freitextsuche, keine Textinterpretation, keine LLM-Aufrufe.
- Keine Befragung (VS-4) und keine Ereignis-Untersuchung.
- Keine Schlussfolgerung, keine Lösbarkeitsprüfung, keine Konsistenzprüfung zwischen `source`, Fundort und Wahrheit.
- Keine Änderung an `case-truth*`, `case-solution*`, `npc-knowledge*`, `case-semantics.ts` oder `src/forge/*`.

## 14. Developer-Abschluss

Der PR enthält: Liste der neuen Dateien mit Zeilenzahlen, Ergebnis von `npm run typecheck` und `npm test`, die Mutantentabelle aus §12 mit tötendem Test je Mutant, und eine Bestätigung, dass keine bestehende Datei verändert wurde.

<!-- END OF CONTRACT MYST-0003 v1 -->
