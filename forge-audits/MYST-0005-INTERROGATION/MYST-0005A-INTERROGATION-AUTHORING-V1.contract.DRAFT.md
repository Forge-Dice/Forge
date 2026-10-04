---json
{
  "forgeContractFormat": 1,
  "taskId": "MYST-0005A",
  "contractVersion": 1,
  "baseCommit": "3d7545d843883418348004e68717399a64da7a7d",
  "dependencies": [],
  "scope": {
    "create": [
      "src/domain/interrogation-authoring.ts",
      "src/domain/interrogation-authoring.identity.ts",
      "tests/interrogation-authoring.fixture.ts",
      "tests/interrogation-authoring.test.ts",
      "tests/interrogation-authoring.identity.test.ts",
      "tests/interrogation-authoring.security.test.ts",
      "tests/interrogation-authoring.typecheck.ts"
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
# MYST-0005A v1 — Interrogation Authoring V1 (DRAFT)

Status: **DRAFT**, nicht registriert, nicht freigegeben. Ziel-Pfad bei Registrierung: `forge/contracts/MYST-0005A.md`.
Format: `forgeContractFormat: 1`, wie `parseContractDocument` auf `baseCommit` es akzeptiert. Architektur und Begründungen: `forge-audits/MYST-0005-INTERROGATION-PACKAGE.md` (nicht normativ; dieser Contract ist vollständig).

## 1. Verbindlichkeit, Basis und Abhängigkeiten

### 1.1 Ziel

Implementiere die persistente, autorenseitige Hälfte der NPC-Befragung V1:

1. `QuestionCatalogue`: fallweite, an genau eine `CaseTruth` gebundene Liste strukturierter Fragen. Eine Frage ist nur `{ id, mentions }`: welche Entitäten sie erwähnt. Kein Text, kein Claim.
2. `NpcInterrogationProfile`: pro NPC, an Truth und Katalog gebunden. Für jede Frage, die diesem NPC gestellt werden kann, genau eine Regel: `answer` mit genau einem adressierten Claim und expliziter `reveal`-Liste, oder `decline`.
3. Die Release-Regeln R1–R4 (§4.3), die verhindern, dass eine Antwort eine Entität ohne ausdrückliche Autorenfreigabe zeigt.
4. Identitäten `hashQuestionCatalogue`, `hashInterrogationProfile`.

Dieses Modul beantwortet keine Frage, kennt keine NPC-Projektion, keine PlayerRefs, keine Session und keinen Gesprächszustand. Es enthält keine Funktionen, die zur Laufzeit an Spieler-Eingaben gebunden sind.

### 1.2 Gelesene Fakten auf `baseCommit`

| Fakt | Ort |
|---|---|
| `ClaimSchema` (exportiert): `personAt{personId,locationId,at}`, `eventHasParticipant{eventId,personId}`, `eventHasItem{eventId,itemId}`, strikt | `src/domain/case-truth.ts` |
| `ConclusionClaimSchema` (exportiert): `personResponsibleForEvent`, `personRoleForEvent{role}`, `noPersonResponsibleForEvent`, `eventCausedEvent` (refine: Ursache ≠ Ziel), `eventIntent{value}`, `eventMechanism{value}`; Diskriminatoren disjunkt zu `ClaimSchema` | `src/domain/case-solution.ts` |
| `AwarenessSubjectSchema` (exportiert): `{kind: person\|location\|item\|event\|evidence, id}` strikt mit gebrandeten IDs | `src/domain/npc-knowledge.ts` |
| ID-Form `^<prefix>:[a-z0-9][a-z0-9_-]{0,63}$`; alle IDs einer Truth über alle Collections eindeutig; `PersonIdSchema`, `CaseIdSchema`, `TickSchema`, `DeepReadonly` exportiert | `src/domain/case-truth.ts` |
| Truth erlaubt strukturell gleiche Claims unter verschiedenen Proposition-IDs (`proposition:ben-at-library` / `ben-seen-in-library`) | `tests/npc-knowledge.fixture.ts` |
| `hashCaseTruth`; Kanonisierung `forge-case-c14n-v1`: Objektschlüssel und **jedes** Array nach UTF-16-Codeeinheiten sortiert; `canonicalize` ist privat | `src/domain/case-truth.identity.ts` |
| Muster gebundener Parser: Factory, Bindung zuerst, danach keine Folge-Issues, `deepFreeze(structuredClone(…))` + Brand | `src/domain/npc-knowledge.ts` |
| `world()` in `tests/npc-knowledge.fixture.ts` → `case:library`, `hashCaseTruth` = `f445f3b4ea632409542d6db96438f06db81b823990a2402ca9387fbcf60a6657`; Personen anna, ben, clara, dora; Orte library, garden; Item knife; Events argument, ben-kills-clara, walk; Evidence bloody-knife, muddy-boots | auf Basis ausgeführt |
| Basis: `npm run typecheck` 0 Fehler, `npm test` 1087/1087 | Merge-Stand `3d7545d` (Roadmap/Plan-Verifikation 2026-10-03) |

### 1.3 Abhängigkeiten

`dependencies` ist leer. TASK-0001/0003/0004 sind Legacy-Code auf `baseCommit`, im Kernel nicht registriert (ein Eintrag würde in `src/forge/state.ts` als `DEPENDENCY_UNRESOLVED`/`DEPENDENCY_MISMATCH` scheitern). Die Grundlage ist über `baseCommit` gebunden. MYST-0001 (PlayerRef) ist **keine** Abhängigkeit: dieses Modul arbeitet nur im Domain-ID-Raum.

## 2. Dateien und Größenlimits

Nur `scope.create`. Keine bestehende Datei wird geändert. Keine neue Dependency.

| Datei | Inhalt | Limit (physische Zeilen inkl. Kommentare) |
|---|---|---|
| `src/domain/interrogation-authoring.ts` | Schemas, gebundene Parser, R1–R4, `statementClaimReferences` | ≤ 210 |
| `src/domain/interrogation-authoring.identity.ts` | 2 Profile, Serializer, Hashes | ≤ 50 |
| **Produktion gesamt** | | **≤ 260** |

Imports der Produktionsdateien: `zod`; aus `./case-truth.ts` (Schemas/Typen), `./case-truth.identity.ts` (`hashCaseTruth`), `./case-solution.ts` (`ConclusionClaimSchema`, Typen), `./npc-knowledge.ts` (`AwarenessSubjectSchema`, Typ); Identity-Datei zusätzlich `node:crypto`. Nichts aus `npc-knowledge.projection.ts`, `case-semantics.ts`, `src/forge/`.

## 3. Datenmodell

### 3.1 Primitive

- `QuestionIdSchema` = String `^question:[a-z0-9][a-z0-9_-]{0,63}$`, Brand `"QuestionId"`.
- `EntityRef` = Ausgabe von `AwarenessSubjectSchema` (Wiederverwendung, kein neues Schema).
- `StatementClaimSchema` = `z.union([ClaimSchema, ConclusionClaimSchema])` (9 disjunkte Arten). Keine eigenen Claim-Kopien.

### 3.2 `QuestionCatalogue` (strikt)

```ts
{
  schemaVersion: 1;
  caseId: CaseId;
  truthHash: string;          // 64 Kleinbuchstaben-Hex
  revision: number;           // positive Ganzzahl
  questions: { id: QuestionId; mentions: EntityRef[] }[];   // questions ≥ 1, mentions ≥ 1
}
```

### 3.3 `NpcInterrogationProfile` (strikt)

```ts
{
  schemaVersion: 1;
  caseId: CaseId;
  truthHash: string;
  catalogueHash: string;      // 64 Kleinbuchstaben-Hex
  npcId: PersonId;
  revision: number;           // positive Ganzzahl
  rules: (
    | { questionId: QuestionId; act: "answer"; claim: StatementClaim; reveal: EntityRef[] }
    | { questionId: QuestionId; act: "decline" }
  )[];                        // darf leer sein
}
```

`rules` ist eine diskriminierte Union über `act`. `decline` trägt keine weiteren Felder (strikt). Es gibt **keine** weiteren Aktionen (kein `invert`, kein `feign_ignorance`, kein Default, keine Stance-Felder).

### 3.4 Fixture (verbindlich, `tests/interrogation-authoring.fixture.ts`)

Truth = `world().truth` aus `tests/npc-knowledge.fixture.ts` (nicht kopieren, importieren). Die Fixture-Datei exportiert Factories, die **frische** mutable Eingaben liefern, wörtlich:

Katalog:

```json
{
  "schemaVersion": 1,
  "caseId": "case:library",
  "truthHash": "f445f3b4ea632409542d6db96438f06db81b823990a2402ca9387fbcf60a6657",
  "revision": 1,
  "questions": [
    {"id": "question:ben-in-library", "mentions": [{"kind": "person", "id": "person:ben"}, {"kind": "location", "id": "location:library"}]},
    {"id": "question:anna-in-library", "mentions": [{"kind": "person", "id": "person:anna"}, {"kind": "location", "id": "location:library"}]},
    {"id": "question:anna-in-killing", "mentions": [{"kind": "person", "id": "person:anna"}, {"kind": "event", "id": "event:ben-kills-clara"}]},
    {"id": "question:ben-in-killing", "mentions": [{"kind": "person", "id": "person:ben"}, {"kind": "event", "id": "event:ben-kills-clara"}]},
    {"id": "question:knife-used", "mentions": [{"kind": "event", "id": "event:ben-kills-clara"}, {"kind": "item", "id": "item:knife"}]},
    {"id": "question:ben-responsible", "mentions": [{"kind": "person", "id": "person:ben"}, {"kind": "event", "id": "event:ben-kills-clara"}]},
    {"id": "question:ben-planned", "mentions": [{"kind": "person", "id": "person:ben"}, {"kind": "event", "id": "event:ben-kills-clara"}]},
    {"id": "question:argument-caused-killing", "mentions": [{"kind": "event", "id": "event:argument"}, {"kind": "event", "id": "event:ben-kills-clara"}]},
    {"id": "question:where-was-ben", "mentions": [{"kind": "person", "id": "person:ben"}]},
    {"id": "question:anna-in-garden", "mentions": [{"kind": "person", "id": "person:anna"}, {"kind": "location", "id": "location:garden"}]},
    {"id": "question:bloody-knife", "mentions": [{"kind": "evidence", "id": "evidence:bloody-knife"}]}
  ]
}```

Profil Dora:

```json
{
  "schemaVersion": 1,
  "caseId": "case:library",
  "truthHash": "f445f3b4ea632409542d6db96438f06db81b823990a2402ca9387fbcf60a6657",
  "catalogueHash": "8a72ee2d9ebacb0806d53fd2d064653c6da9bbdb51e1f7a19c8ab6bdf6fb9e0e",
  "npcId": "person:dora",
  "revision": 1,
  "rules": [
    {"questionId": "question:ben-in-library", "act": "answer", "claim": {"kind": "personAt", "personId": "person:ben", "locationId": "location:library", "at": 300}, "reveal": []},
    {"questionId": "question:anna-in-library", "act": "answer", "claim": {"kind": "personAt", "personId": "person:anna", "locationId": "location:library", "at": 300}, "reveal": []},
    {"questionId": "question:anna-in-killing", "act": "answer", "claim": {"kind": "eventHasParticipant", "eventId": "event:ben-kills-clara", "personId": "person:anna"}, "reveal": []},
    {"questionId": "question:ben-in-killing", "act": "answer", "claim": {"kind": "eventHasParticipant", "eventId": "event:ben-kills-clara", "personId": "person:ben"}, "reveal": []},
    {"questionId": "question:knife-used", "act": "answer", "claim": {"kind": "eventHasItem", "eventId": "event:ben-kills-clara", "itemId": "item:knife"}, "reveal": []},
    {"questionId": "question:ben-responsible", "act": "answer", "claim": {"kind": "personResponsibleForEvent", "personId": "person:ben", "eventId": "event:ben-kills-clara"}, "reveal": []},
    {"questionId": "question:ben-planned", "act": "answer", "claim": {"kind": "personRoleForEvent", "personId": "person:ben", "eventId": "event:ben-kills-clara", "role": "planner"}, "reveal": []},
    {"questionId": "question:argument-caused-killing", "act": "answer", "claim": {"kind": "eventCausedEvent", "causeEventId": "event:argument", "eventId": "event:ben-kills-clara"}, "reveal": []},
    {"questionId": "question:where-was-ben", "act": "answer", "claim": {"kind": "personAt", "personId": "person:ben", "locationId": "location:library", "at": 300}, "reveal": [{"kind": "location", "id": "location:library"}]},
    {"questionId": "question:anna-in-garden", "act": "answer", "claim": {"kind": "personAt", "personId": "person:anna", "locationId": "location:garden", "at": 300}, "reveal": []},
    {"questionId": "question:bloody-knife", "act": "decline"}
  ]
}```

## 4. Gebundene Parser

### 4.1 API-Form

`createQuestionCatalogueSchema(truth)` und `createInterrogationProfileSchema(truth, catalogue)` liefern Zod-Schemas: privates Shape-Schema → `superRefine` (Bindung, Referenzen, Regeln) → `transform(deepFreeze(structuredClone(…)))` → `brand`. `parseQuestionCatalogue(input, truth)` und `parseInterrogationProfile(input, truth, catalogue)` rufen `.parse` auf. Hashes von Truth und Katalog werden **einmal pro Schema-Erzeugung** berechnet.

### 4.2 Katalog-Prüfungen (Reihenfolge normativ)

1. Bindung: `caseId === truth.caseId` sonst Issue `["caseId"]`; `truthHash === hashCaseTruth(truth)` sonst `["truthHash"]`. Bei Bindungsfehler **keine** weiteren Issues.
2. `questions[j].id` eindeutig; späteres Vorkommen: `["questions", j, "id"]`.
3. Jede Mention existiert in der Truth-Collection ihrer Art (`persons`, `locations`, `items`, `events`, `evidence`): sonst `["questions", i, "mentions", k, "id"]`.
4. Mentions je Frage eindeutig nach `kind|id`; späteres Vorkommen `["questions", i, "mentions", k]`.

### 4.3 Profil-Prüfungen (Reihenfolge normativ)

1. Bindung: `caseId` → `["caseId"]`; `truthHash` → `["truthHash"]`; `catalogueHash === hashQuestionCatalogue(catalogue)` → `["catalogueHash"]`; `catalogue.caseId/truthHash` passen zur Truth, sonst Issue `["catalogueHash"]`. Bei Bindungsfehler keine weiteren Issues.
2. `npcId` ist eine Person der Truth → sonst `["npcId"]`.
3. `rules[j].questionId` eindeutig (`["rules", j, "questionId"]`) und im Katalog vorhanden (`["rules", i, "questionId"]`). Fehlt die Frage, keine weiteren Prüfungen für diese Regel.
4. Nur `act: "answer"`: jede ID im `claim` existiert in der Truth (`personId`, `locationId`, `itemId`, `eventId`, `causeEventId`), sonst `["rules", i, "claim", <feld>]`; jedes `reveal[j]` existiert, sonst `["rules", i, "reveal", j, "id"]`. Bei einem Referenzfehler in dieser Regel keine R-Prüfungen.
5. Release-Regeln, mit `M = mentions(question) ∪ {person:npcId}` und `C = statementClaimReferences(claim)`:
   - **R1 Abdeckung**: jedes `c ∈ C` liegt in `M ∪ reveal`. Sonst **ein** Issue `["rules", i, "claim"]`.
   - **R2 Reveal aus dem Claim**: jedes `reveal[j] ∈ C`. Sonst `["rules", i, "reveal", j]`.
   - **R3 Reveal ist neu**: kein `reveal[j] ∈ M`. Sonst `["rules", i, "reveal", j]`.
   - **R4 Eindeutig**: `reveal` eindeutig nach `kind|id`; späteres Vorkommen `["rules", i, "reveal", j]`.

Bewusst **keine** Prüfung, ob zum Claim eine Proposition/Conclusion existiert, ob ein NPC eine Attitude hat, ob der Katalog jede Frage einem NPC zuordnet oder ob eine Solution gebunden ist.

### 4.4 `statementClaimReferences(claim)`

Liefert die Entitätsreferenzen eines Claims als neue, eingefrorene `EntityRef[]` in Feldreihenfolge, dedupliziert nach `kind|id`:

| kind | Referenzen |
|---|---|
| personAt | person, location |
| eventHasParticipant | event, person |
| eventHasItem | event, item |
| personResponsibleForEvent, personRoleForEvent | person, event |
| noPersonResponsibleForEvent, eventIntent, eventMechanism | event |
| eventCausedEvent | event (`causeEventId`), event (`eventId`) |

Exhaustiv per `switch` ohne `default`; eine neue Claim-Art muss am Compiler scheitern.

## 5. Identität

### 5.1 Profile

`QUESTION_CATALOGUE_PROFILE = "forge-interrogation-catalogue-c14n-v1"`, `INTERROGATION_PROFILE_PROFILE = "forge-interrogation-profile-c14n-v1"`.

Kanonisierung identisch zu `forge-case-c14n-v1`: Objektschlüssel nach UTF-16-Codeeinheiten sortiert; **jedes** Array wird nach der kanonischen Zeichenkette seiner Elemente sortiert (alle Arrays beider Dokumente sind Mengen); Skalare per `JSON.stringify`. Eigene private Implementierung in der Identity-Datei (die bestehende ist privat; kein Export ändern).

`serializeQuestionCatalogue`, `serializeInterrogationProfile` → kanonische Zeichenkette.
`hashQuestionCatalogue(c)` = SHA-256-Hex über UTF-8 von `QUESTION_CATALOGUE_PROFILE + "\n" + serializeQuestionCatalogue(c)`; analog `hashInterrogationProfile`.

### 5.2 Golden Vectors (zweifach berechnet: Node `node:crypto`, Python `hashlib`; identisch)

| Eingabe | Wert |
|---|---|
| `hashCaseTruth(world().truth)` | `f445f3b4ea632409542d6db96438f06db81b823990a2402ca9387fbcf60a6657` |
| `hashQuestionCatalogue(Fixture-Katalog)` | `8a72ee2d9ebacb0806d53fd2d064653c6da9bbdb51e1f7a19c8ab6bdf6fb9e0e` |
| `hashInterrogationProfile(Fixture-Profil Dora)` | `358a5f3945030d485778219aa1f1ec258507ed9034496743c050bd9e8b17b0e5` |
| Länge `serializeQuestionCatalogue(Fixture)` | 1477 Zeichen |
| Länge `serializeInterrogationProfile(Fixture)` | 2006 Zeichen |

## 6. Öffentliche API (vollständig)

`src/domain/interrogation-authoring.ts`:

```ts
export const QuestionIdSchema;                 // brand "QuestionId"
export type QuestionId;
export type EntityRef;                         // = z.output<typeof AwarenessSubjectSchema>
export const StatementClaimSchema;
export type StatementClaim;
export function statementClaimReferences(claim: DeepReadonly<StatementClaim>): readonly EntityRef[];
export function createQuestionCatalogueSchema(truth: CaseTruth);
export type QuestionCatalogueInput;            // z.input
export type QuestionCatalogue;                 // z.output, tief readonly, Brand "QuestionCatalogue"
export function parseQuestionCatalogue(input: unknown, truth: CaseTruth): QuestionCatalogue;
export function createInterrogationProfileSchema(truth: CaseTruth, catalogue: QuestionCatalogue);
export type InterrogationProfileInput;
export type InterrogationProfile;              // Brand "NpcInterrogationProfile"
export function parseInterrogationProfile(input: unknown, truth: CaseTruth, catalogue: QuestionCatalogue): InterrogationProfile;
```

`src/domain/interrogation-authoring.identity.ts`:

```ts
export const QUESTION_CATALOGUE_PROFILE: "forge-interrogation-catalogue-c14n-v1";
export const INTERROGATION_PROFILE_PROFILE: "forge-interrogation-profile-c14n-v1";
export function serializeQuestionCatalogue(c: QuestionCatalogue): string;
export function hashQuestionCatalogue(c: QuestionCatalogue): string;
export function serializeInterrogationProfile(p: InterrogationProfile): string;
export function hashInterrogationProfile(p: InterrogationProfile): string;
```

Keine weiteren Exporte. Keine `WeakMap`/`WeakSet`/`WeakRef`, keine Symbole, kein modulweiter veränderlicher Zustand, kein `Math.random`, keine Systemzeit, kein `localeCompare`.

## 7. Acceptance Criteria

| ID | Kriterium |
|---|---|
| AC-01 | Diff enthält exakt die Dateien aus `scope.create`; keine bestehende Datei geändert. |
| AC-02 | `npm run typecheck` und `npm test` grün, alle bestehenden 1087 Tests eingeschlossen. |
| AC-03 | Exporte und Imports exakt §2/§6. |
| AC-04 | Alle Prüfungen aus §4.2/§4.3 mit genau den angegebenen Pfaden; nach Bindungsfehler keine Folge-Issues. |
| AC-05 | R1–R4 je mit positivem und negativem Test, inklusive impliziter Freigabe des NPC selbst. |
| AC-06 | Geparste Dokumente tief eingefroren, teilen kein Objekt mit der Eingabe; Eingabe unverändert. |
| AC-07 | Golden Vectors §5.2 exakt; Hash invariant unter Permutation jedes Arrays und jeder Property-Reihenfolge. |
| AC-08 | `statementClaimReferences` für alle 9 Arten, dedupliziert, eingefroren. |
| AC-09 | Typecheck-Datei: `QuestionCatalogue`/`InterrogationProfile` nicht aus Rohobjekten zuweisbar (Brand); `decline`-Regel hat kein `claim`; `act` ist exakt `"answer" \| "decline"`; `StatementClaim` ist beidseitig kompatibel mit `z.output<typeof ClaimSchema> \| ConclusionClaim`. |
| AC-10 | Testmatrix §8 vollständig umgesetzt. |
| AC-11 | Mutanten §9 werden jeweils von mindestens einem Test getötet. |
| AC-12 | Größenlimits §2 eingehalten. |

## 8. Testmatrix (verbindlich)

| # | Fall | Erwartung |
|---|---|---|
| 1 | Fixture-Katalog parst | Erfolg, tief eingefroren, Hash §5.2 |
| 2 | Fixture-Profil Dora parst | Erfolg, eingefroren, Hash §5.2 |
| 3 | Katalog `caseId` falsch | genau Issue `["caseId"]` |
| 4 | Katalog `truthHash` falsch | genau Issue `["truthHash"]` |
| 5 | Doppelte `question.id` | `["questions", j, "id"]` |
| 6 | Mention `person:zoe` (unbekannt) | `["questions", i, "mentions", k, "id"]` |
| 7 | Mention doppelt | `["questions", i, "mentions", k]` |
| 8 | `mentions: []` | Issue an `["questions", i, "mentions"]` |
| 9 | Mention-Art `proposition` | Shape-Issue |
| 10 | `id: "Question:x"`, `"question:"`, `"q:x"` | Shape-Issue |
| 11 | Profil `catalogueHash` falsch | genau `["catalogueHash"]` |
| 12 | Profil `npcId: "person:zoe"` | `["npcId"]` |
| 13 | Regel auf `question:nope` | `["rules", i, "questionId"]` |
| 14 | Zwei Regeln `question:ben-in-library` | `["rules", j, "questionId"]` |
| 15 | Claim `eventId: "event:nope"` | `["rules", i, "claim", "eventId"]` |
| 16 | `eventCausedEvent` Ursache = Ziel | Shape-Issue (`ConclusionClaimSchema`-Refine) |
| 17 | **Forbidden reveal**: `where-was-ben` mit `reveal: []` | R1 `["rules", i, "claim"]` |
| 18 | **Explicit reveal**: Fixture-Regel `where-was-ben` | Erfolg |
| 19 | `reveal: [location:garden]` bei Claim über library | R2 `["rules", i, "reveal", 0]` |
| 20 | `reveal: [person:ben]` bei Mention ben | R3 `["rules", i, "reveal", 0]` |
| 21 | `reveal: [person:dora]` (NPC selbst) | R3 |
| 22 | `reveal` doppelt | R4 `["rules", i, "reveal", 1]` |
| 23 | Neue Frage `question:dora-where` (mentions `[location:garden]`), Regel `personAt(dora, garden, 300)`, `reveal: []` | Erfolg (NPC implizit) |
| 24 | `decline` mit Zusatzfeld `claim` | Shape-Issue (strict) |
| 25 | Regel-Claim ohne zugehörige Proposition (`personAt(anna, garden, 300)`) | Erfolg |
| 26 | `rules: []` | Erfolg |
| 27 | Permutation aller Arrays | identische Hashes beider Dokumente |
| 28 | Property-Reihenfolge vertauscht (alle Ebenen) | identische Hashes |
| 29 | Eingabe nach Parse mutiert | geparstes Dokument unverändert; Parse mutiert Eingabe nicht |
| 30 | Deep freeze | `Object.isFrozen` auf jeder Ebene beider Dokumente |
| 31 | Golden Vectors | exakt §5.2 inkl. Längen |
| 32 | Profil mit Katalog einer anderen Truth (Truth mit geändertem Namen) | Issue `["catalogueHash"]` bzw. `["truthHash"]`, keine Folge-Issues |
| 33 | `act: "invert"` / `"feign_ignorance"` / fehlendes `act` | Shape-Issue |
| 34 | `statementClaimReferences` je Claim-Art | exakt §4.4 |

## 9. Mutationsanker und Mutanten

`\|` in Tabellenzellen steht für `|` im Code.

`src/domain/interrogation-authoring.ts` enthält jeden der folgenden Texte genau einmal, wörtlich:

| Anker | Zweck |
|---|---|
| `"question:"` in der Regex von `QuestionIdSchema` (`/^question:[a-z0-9][a-z0-9_-]{0,63}$/`) | ID-Form |
| `const allowed = new Set([...mentionKeys, npcKey, ...revealKeys]);` | R1-Menge |
| `if (!claimKeys.has(key))` | R2 |
| `if (mentionKeys.has(key) \|\| key === npcKey)` | R3 |

| Mutant | Änderung | Getötet durch |
|---|---|---|
| A-M1 | R1 entfernt | #17 |
| A-M2 | `npcKey` aus `allowed` entfernt | #23 |
| A-M3 | R2 entfernt | #19 |
| A-M4 | R3 entfernt | #20, #21 |
| A-M5 | `catalogueHash`-Bindung entfernt | #11, #32 |
| A-M6 | Arrays in der Kanonisierung nicht sortiert | #27 |
| A-M7 | Mention-Existenzprüfung entfernt | #6 |
| A-M8 | `deepFreeze` durch flaches `Object.freeze` ersetzt | #30 |

## 10. Non-Goals

- Keine Antwortlogik, keine Projektion, keine PlayerRefs, keine Observation (MYST-0005B).
- Keine Lügen-/Täuschungsaktionen, keine Defaults, keine Stance-Felder, kein Freitext, keine Fragetexte.
- Keine Session, kein Paket, kein Snapshot-Hash, keine Persistenz von Laufzeitobjekten.
- Keine Änderung an bestehenden Dateien, `package.json`, Lockfile, `tsconfig.json`.

## 11. Developer-Abschluss

Bericht mit: Diff-Statistik je Datei (Limits §2), Ausgabe von `npm run typecheck` und `npm test`, Mutantenprotokoll A-M1…A-M8 (je Mutant: angewendet, getötet von Test #), Bestätigung der Golden Vectors.

<!-- END OF CONTRACT MYST-0005A v1 -->
