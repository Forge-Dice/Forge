---json
{
  "forgeContractFormat": 1,
  "taskId": "MYST-0004",
  "contractVersion": 1,
  "baseCommit": "3d7545d843883418348004e68717399a64da7a7d",
  "dependencies": [],
  "scope": {
    "create": [
      "src/domain/evidence-presentation.ts",
      "src/domain/evidence-presentation.identity.ts",
      "tests/evidence-presentation.fixture.ts",
      "tests/evidence-presentation.test.ts",
      "tests/evidence-presentation.identity.test.ts",
      "tests/evidence-presentation.security.test.ts",
      "tests/evidence-presentation.typecheck.ts"
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
# MYST-0004 v1 — Evidence Presentation & Player Release V1 (DRAFT)

Status: **DRAFT**, nicht registriert, nicht freigegeben. Ziel-Pfad bei Registrierung: `forge/contracts/MYST-0004.md`.
Format: `forgeContractFormat: 1`, so wie `parseContractDocument` auf `baseCommit` es tatsächlich akzeptiert (geprüft). Format 2 existiert auf `main` nicht und wird hier nicht vorgetäuscht.

Nummernhinweis: Der `OVERNIGHT-EXECUTION-PLAN` führte `MYST-0004` für „Interrogation + Translator-Bridge (VS-4)“. Der Owner hat `MYST-0004` diesem Task zugewiesen. Die Neunummerierung des Interrogation-Tasks und die Abhängigkeitsliste des späteren Case-Package-Tasks entscheidet der Owner; dieser Vertrag löst das nicht auf.

## 1. Verbindlichkeit, Basis und Abhängigkeiten

### 1.1 Ziel

Implementiere die kleinste autorenseitige Schicht, die festlegt, **was ein Spieler sieht, wenn eine Evidence freigegeben wird**:

1. ein autorenseitiges, an genau eine `CaseTruth` gebundenes Dokument `EvidencePresentation`, das für **jede** Evidence der Truth einen spielerseitigen Text, die ausdrücklich freigegebenen Entitäten (`mentions`) und die ausdrücklich mitgeteilten strukturierten Aussagen (`reports`) festlegt;
2. eine reine Funktion `releaseEvidence(presentation, evidenceId, translator)`, die für eine Evidence ein spielersicheres `EvidenceObservation` erzeugt, das ausschließlich PlayerRefs, den autorisierten Text und die autorisierten Aussagen enthält;
3. eine Identität `hashEvidencePresentation` (`presentationHash`) mit eigenem Kanonisierungsprofil.

Das Modul liest nie `Evidence.description`, `Evidence.source`, `Evidence.links`, `Proposition.truth`, Secrets, Red Herrings, `CaseSolution`, NPC-Wissen oder Namen. Es kennt keine Session, kein Spielerwissen-Objekt, keine UI und keine LLM-Ausgabe.

### 1.2 Gelesene Fakten auf `baseCommit`

| Fakt | Ort |
|---|---|
| `EvidenceSchema` = strict `{ id, description, source, links }`; `description: TextSchema`; `source` = `person`\|`location`\|`item`\|`event`; `links` ≥ 1 `{ propositionId, direction: supports\|refutes }` | `src/domain/case-truth.ts` |
| `ClaimSchema` (exportiert) = `personAt{personId, locationId, at}` \| `eventHasParticipant{eventId, personId}` \| `eventHasItem{eventId, itemId}`; `PropositionSchema` = `{ id, claim, truth: boolean }` | `src/domain/case-truth.ts` |
| `SecretSchema` = `{ id, propositionIds }`, `RedHerringSchema` = `{ id, evidenceIds, misleadingPropositionId }` | `src/domain/case-truth.ts` |
| ID-Schemas `^<prefix>:[a-z0-9][a-z0-9_-]{0,63}$` für `case person location item relationship event motive proposition evidence secret red-herring`; `conclusion:` in `src/domain/case-solution.ts`; IDs sind über alle Collections eindeutig | `src/domain/case-truth.ts`, `src/domain/case-solution.ts` |
| `CaseTruth` tief eingefroren, gebrandet, nur über `parseCaseTruth`; `DeepReadonly` exportiert | `src/domain/case-truth.ts` |
| `hashCaseTruth(truth)` → 64 Hex; Profil `forge-case-c14n-v1`: Schlüssel sortiert, **jedes** Array eine Menge, `canonicalize` privat | `src/domain/case-truth.identity.ts` |
| Muster gebundener Parser (Factory, Bindung zuerst, `deepFreeze(structuredClone(…))`, Brand) | `src/domain/npc-knowledge.ts` |
| `hasLoneSurrogate` existiert privat in `src/forge/contract-document.ts` (nicht importierbar aus `src/domain`) | `src/forge/contract-document.ts` |
| `fullCase()` → `case:letter-opener`, `hashCaseTruth` = `f8794eba02ff4cb846158a9d5d145ade93e24fd109d88f7a4b5244f175453a73`; 4 Evidence (`fingerprint`, `anna-statement`, `muddy-path`, `gloves-dirty`); `secret:debt`, `red-herring:fingerprint` | `tests/case-truth.fixture.ts` |
| `goldenCase()` → `case:golden`, keine Evidence, `hashCaseTruth` = `bd95eb9a8569f4f3f62eab50aac94e75cd601b54e3432776cc6663a204647501` | `tests/case-truth.fixture.ts` |
| Basis: `npm run typecheck` 0 Fehler, `npm test` 1087/1087 grün | auf `baseCommit` ausgeführt (2026-10-03) |
| Laufzeit-Dependencies nur `zod` 4.6.5; `node:crypto` im Domain-Code bereits genutzt | `package.json`, `src/domain/*.identity.ts` |

### 1.3 Abhängigkeiten

`dependencies` ist leer.

- TASK-0001 (CaseTruth) ist Legacy-Code auf `baseCommit`, im Kernel aber nicht registriert (ein Eintrag würde `DEPENDENCY_MISMATCH` bzw. `DEPENDENCY_UNRESOLVED` erzeugen); gebunden über `baseCommit`.
- **MYST-0001 (PlayerRef V1) ist keine Implementierungsabhängigkeit.** Das Modul importiert nichts aus MYST-0001. Es definiert einen strukturellen Port `PlayerRefTranslator` (§5.1). Tests verwenden ausschließlich den Test-Double aus §3.5.
- **MYST-0001 ist eine Laufzeit-/Paketabhängigkeit** des späteren Aufrufers (VS-5): Nur ein aus einem `PlayerRefIndex` gebauter Translator liefert echte Referenzen. Die Konstante `PLAYER_REF_PATTERN` (§5.3) ist wörtlich das Referenzformat aus dem MYST-0001-Entwurf D3. Ändert MYST-0001 dieses Format vor seiner Annahme, ist eine Revision dieses Vertrags Pflicht (Hotspot, kein stiller Drift).
- **MYST-0003 ist keine Abhängigkeit**, weder Import noch Laufzeit. Beide Module sind über `truthHash` an dieselbe Truth gebunden; die Verknüpfung (entdeckt → freigeben) ist Aufgabe von VS-5 (§9).

## 2. Dateien und Größenlimits

Nur die Dateien aus `scope.create`. Keine bestehende Datei wird geändert (insbesondere nicht `case-truth.ts`, nicht MYST-0003-Dateien). Keine neue Dependency (Laufzeit oder Dev).

| Datei | Inhalt | Limit (physische Zeilen inkl. Kommentare) |
|---|---|---|
| `src/domain/evidence-presentation.ts` | Text-Regeln, Schemas, gebundener Parser, `releaseEvidence` | ≤ 255 |
| `src/domain/evidence-presentation.identity.ts` | Profil, Serializer, Hash | ≤ 40 |
| Produktion gesamt | | **≤ 290** |
| `tests/evidence-presentation.fixture.ts` | `presentationFixture()` (§3.4), `fakeTranslator` (§3.5), Golden-Konstanten (§7.3, §5.6), `spoilerCase()` (§11) | — |
| `tests/evidence-presentation.test.ts` | Parser, Release, Ordnung | — |
| `tests/evidence-presentation.identity.test.ts` | Profil, Vektoren | — |
| `tests/evidence-presentation.security.test.ts` | Spoiler-Matrix §11, Quelltextprüfungen | — |
| `tests/evidence-presentation.typecheck.ts` | Typ-Grenzen (§10 AC-14) | — |

Referenzprototyp (verworfen, nicht Teil des Vertrags): 249 + 32 = 281 Zeilen.

## 3. Datenmodell

### 3.1 Spielertext `PlayerTextSchema`

Ein `string` mit genau diesen Regeln, ohne Trimmen und ohne Unicode-Normalisierung:

| Regel | Inhalt | Meldung (wörtlich) |
|---|---|---|
| T1 | Länge ≤ `PRESENTATION_LIMITS.textMaxLength` = 1000 UTF-16-Codeeinheiten (`z.string().max`) | Zod-Standard |
| T2 | enthält mindestens ein Nicht-Whitespace-Zeichen (`/\S/`) | `Text must contain a non-whitespace character` |
| T3 | wohlgeformtes Unicode (kein unpaariges Surrogat; lokale Kopie der Logik aus `contract-document.ts`) | `Text must be well-formed Unicode` |
| T4 | kein Zeichen aus der Verbotsmenge `FORBIDDEN_CHARACTERS`: U+0000–U+0009, U+000B–U+001F, U+007F–U+009F, U+061C, U+200B, U+200E, U+200F, U+2028, U+2029, U+202A–U+202E, U+2060, U+2066–U+2069, U+FEFF. Erlaubt bleiben U+000A (Zeilenumbruch), U+200C/U+200D (ZWNJ/ZWJ) | `Text contains a forbidden control, bidi or invisible character` |
| T5 | kein Treffer von `CANONICAL_ID_IN_TEXT` = `/(?:case\|person\|location\|item\|relationship\|event\|motive\|proposition\|evidence\|secret\|red-herring\|conclusion):[a-z0-9]/` (ohne Flags, ohne Lookbehind) | `Text must not contain a canonical ID` |
| T6 | kein Treffer von `PLAYER_REF_IN_TEXT` = `/pr1_[0-9a-z]{16}/` | `Text must not contain a PlayerRef` |

T2–T6 werden in einem `superRefine` alle geprüft (mehrere Issues möglich); der Issue-Pfad ist der Feldpfad `["entries", i, "text"]`. In Quelltext-Literalen werden die Codepunkte aus T4 ausschließlich als `\uXXXX`-Escapes geschrieben, nie als rohe Zeichen.

T5/T6 sind ein **Unfallschutz**, keine Spoilererkennung: Sie verhindern, dass ein Autor technische Kennungen in Spielertext kopiert. Inhaltliche Spoiler in Prosa („Ben ist der Mörder“) sind autorenseitiger Inhalt und mechanisch nicht prüfbar (§6).

### 3.2 Erwähnung und Aussage

```ts
MentionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("person"), id: PersonIdSchema }),
  z.strictObject({ kind: z.literal("location"), id: LocationIdSchema }),
  z.strictObject({ kind: z.literal("item"), id: ItemIdSchema }),
  z.strictObject({ kind: z.literal("event"), id: EventIdSchema }),
]);

ReportSchema = z.strictObject({
  claim: ClaimSchema,                              // importiert aus case-truth.ts, unverändert
  stance: z.enum(["affirms", "denies"]),
  source: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("observation") }),
    z.strictObject({ kind: z.literal("testimony"), personId: PersonIdSchema }),
  ]),
});
```

- `mentions`: die Entitäten, die durch diese Evidence **dem Spieler bekannt werden dürfen**. Die Evidence selbst ist nie ein Mention (sie wird immer freigegeben). Evidence, Proposition, Secret, Red Herring, Motive, Relationship, Case und Conclusion sind keine erlaubten Arten.
- `reports`: strukturierte Aussagen, die die Evidence **dem Spieler mitteilt**: „diese Quelle bejaht/verneint diese Behauptung“. Ein Report ist nie eine Wahrheitsaussage, trägt keine Proposition-ID, keinen Wahrheitswert und keine Link-Richtung. `observation` = die Evidence zeigt es selbst; `testimony` = eine Person sagt es.

### 3.3 Dokument

```ts
PresentationEntrySchema = z.strictObject({
  evidenceId: EvidenceIdSchema,
  text: PlayerTextSchema,
  mentions: z.array(MentionSchema).max(PRESENTATION_LIMITS.maxMentions),   // 16
  reports: z.array(ReportSchema).max(PRESENTATION_LIMITS.maxReports),      // 8
});
PresentationShapeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  caseId: CaseIdSchema,
  truthHash: z.string().regex(/^[0-9a-f]{64}$/),
  entries: z.array(PresentationEntrySchema),
});
```

Kein `label`, keine `revision`, kein Feld `description`, `source` (auf Eintragsebene), `links`, `truth`, `secret`, `redHerring`. Die Identität des Dokuments ist sein Hash (§7).

### 3.4 Fixture (verbindlich, `tests/evidence-presentation.fixture.ts`)

`presentationFixture()` liefert ein frisches, veränderbares Objekt gegen `parseCaseTruth(fullCase())`:

```ts
{
  schemaVersion: 1,
  caseId: "case:letter-opener",
  truthHash: "f8794eba02ff4cb846158a9d5d145ade93e24fd109d88f7a4b5244f175453a73",
  entries: [
    { evidenceId: "evidence:fingerprint",
      text: "Auf dem Griff des Brieföffners ist ein Fingerabdruck. Der Abgleich ergibt: Er stammt von Anna.",
      mentions: [{ kind: "item", id: "item:letter-opener" }, { kind: "person", id: "person:anna" }],
      reports: [] },
    { evidenceId: "evidence:anna-statement",
      text: "Anna sagt: „Ich habe Ben streiten hören. Danach war ich die ganze Zeit im Garten.“",
      mentions: [{ kind: "person", id: "person:anna" }, { kind: "person", id: "person:ben" },
                 { kind: "event", id: "event:argument" }, { kind: "location", id: "location:garden" }],
      reports: [
        { claim: { kind: "eventHasParticipant", eventId: "event:argument", personId: "person:ben" },
          stance: "affirms", source: { kind: "testimony", personId: "person:anna" } },
        { claim: { kind: "personAt", personId: "person:anna", locationId: "location:garden", at: 1500 },
          stance: "affirms", source: { kind: "testimony", personId: "person:anna" } },
      ] },
    { evidenceId: "evidence:muddy-path", text: "Im Gartenbeet sind frische Fußspuren.",
      mentions: [{ kind: "location", id: "location:garden" }], reports: [] },
    { evidenceId: "evidence:gloves-dirty", text: "An den Gartenhandschuhen klebt Erde.",
      mentions: [{ kind: "item", id: "item:gloves" }], reports: [] },
  ],
}
```

Alle Texte sind UTF-8-Literale, wie hier abgedruckt (`„` U+201E, `“` U+201C, `ö`, `ß`). Ein Test prüft, dass `truthHash` gleich `hashCaseTruth(parseCaseTruth(fullCase()))` ist.

### 3.5 Test-Double `fakeTranslator` (nur in Tests)

```ts
const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
fakeRef(kind, id) = "pr1_" + (erste 16 Bytes b von sha256(utf8(`${kind}\n${id}`))).map(b => ALPHABET[b & 31]).join("")
fakeTranslator(truth) = { caseId: truth.caseId, truthHash: hashCaseTruth(truth), refFor: fakeRef }
```

Das ist **keine** PlayerRef-Ableitung (kein Salt) und darf nie aus `src/` exportiert werden. Vektoren (Node und Python geprüft):

| kind, id | fakeRef |
|---|---|
| evidence, `evidence:fingerprint` | `pr1_53trdamn1z833nc7` |
| evidence, `evidence:anna-statement` | `pr1_k4tq1cfq5v3d8wyv` |
| evidence, `evidence:muddy-path` | `pr1_gzt4xjcqp47990ze` |
| evidence, `evidence:gloves-dirty` | `pr1_sqvqp73b02b32qsq` |
| person, `person:anna` | `pr1_pddmm9vn96qyzyg7` |
| person, `person:ben` | `pr1_43j91mpcqhqd7eqv` |
| event, `event:argument` | `pr1_hnp5f21z42d6a2dq` |
| location, `location:garden` | `pr1_stcg6ft3cway8h06` |
| item, `item:letter-opener` | `pr1_3m50bymz53yhv757` |
| item, `item:gloves` | `pr1_17jdyekm6zj6rbmd` |

## 4. Gebundener Parser

```ts
createEvidencePresentationSchema(truth: CaseTruth)   // Zod-Schema, gebrandet "EvidencePresentation"
parseEvidencePresentation(input: unknown, truth: CaseTruth): EvidencePresentation   // wirft ZodError
```

Regeln als `superRefine` auf `PresentationShapeSchema`, in dieser Reihenfolge:

- **R1 Bindung.** `caseId === truth.caseId` und `truthHash === hashCaseTruth(truth)` (einmal pro Schema-Erzeugung berechnet). Bei Fehler Issues an `["caseId"]` bzw. `["truthHash"]` und **keine** weiteren Regeln.
- **R2 Evidence-Referenz.** Jede `evidenceId` existiert in `truth.evidence`; sonst Issue an `["entries", i, "evidenceId"]`.
- **R3 Eindeutigkeit.** Höchstens ein Eintrag je `evidenceId`; Issue an `["entries", i, "evidenceId"]`.
- **R4 Vollständigkeit.** Jede Evidence der Truth hat genau einen Eintrag; je fehlender Evidence ein Issue an `["entries"]`, Nachricht enthält die fehlende ID.
- **R5 Mention-Referenz.** Jede Erwähnung existiert in der Collection ihrer Art (`persons`, `locations`, `items`, `events`); sonst Issue an `["entries", i, "mentions", j, "id"]`.
- **R6 Mention-Eindeutigkeit.** Kein `(kind, id)` doppelt; Issue an `["entries", i, "mentions", j]`.
- **R7 Abschluss.** Jede Entität, die ein Report referenziert (Claim-Felder und `testimony.personId`), ist in `mentions` desselben Eintrags; sonst Issue an `["entries", i, "reports", j]`. Damit gibt kein Report eine Entität frei, die nicht ausdrücklich erwähnt ist, und R5 deckt die Existenz ab.
- **R8 Report-Eindeutigkeit.** Je Eintrag höchstens ein Report je Schlüssel `(claim, source)` **ohne** `stance`; Issue an `["entries", i, "reports", j]`. Dieselbe Quelle kann eine Behauptung nicht zugleich bejahen und verneinen; verschiedene Quellen dürfen sich widersprechen.

Nicht geprüft (bewusst): Übereinstimmung von Text und Mentions, Übereinstimmung von Reports mit `links`, `Proposition.truth` oder `source`, ob `text` gleich `Evidence.description` ist. Autorenfehlermeldungen dürfen IDs enthalten; sie sind autorenseitig.

Ergebnis: `deepFreeze(structuredClone(parsed))`, gebrandet, Typ `DeepReadonly<…>`; die Eingabe wird nie verändert und teilt kein Objekt mit dem Ergebnis.

## 5. Release

### 5.1 Signatur und Port

```ts
export type RefKind = "person" | "location" | "item" | "event" | "evidence";
export type PlayerRefTranslator = {
  readonly caseId: string;
  readonly truthHash: string;
  readonly refFor: (kind: RefKind, id: string) => string | null;
};
export function releaseEvidence(presentation: EvidencePresentation, evidenceId: unknown, translator: PlayerRefTranslator): ReleaseResult;
```

Der Port ist vertrauenswürdiger Hostcode (gleiches Modell wie die Ports in MYST-0001 und `src/forge/contract-document.ts`): Ausnahmen aus `refFor` werden nicht gefangen. Seine **Rückgabewerte** werden trotzdem geprüft (§5.3), weil sie die Spielergrenze überqueren. Vorgesehene Konstruktion in VS-5 (nicht Teil dieses Vertrags): `{ caseId: index.caseId, truthHash: index.truthHash, refFor: (k, id) => playerRefFor(index, k, id) }`.

### 5.2 Algorithmus

1. `translator.caseId !== presentation.caseId` oder `translator.truthHash !== presentation.truthHash` → `BINDING_MISMATCH`.
2. `entry` = Eintrag mit `entry.evidenceId === evidenceId` (strikter Vergleich, keine Normalisierung; Nicht-Strings treffen nie); keiner → `UNKNOWN_EVIDENCE`.
3. Für die Liste `[("evidence", entry.evidenceId), …mentions als (kind, id)]` in dieser Reihenfolge: `ref = translator.refFor(kind, id)`. Ist `ref` kein String, verfehlt `PLAYER_REF_PATTERN` oder wurde in diesem Aufruf schon vergeben → `REF_UNAVAILABLE`. `refFor` wird für **keine** andere Entität aufgerufen (insbesondere nie für `source` oder Proposition-Referenzen).
4. Reports in Spielerform umbauen (§5.4); jede Entitätsreferenz wird über die in Schritt 3 vergebenen Refs ersetzt (R7 garantiert Vollständigkeit).
5. `observation` in fester Schlüsselreihenfolge konstruieren; `mentions` aufsteigend nach `ref` (UTF-16-Codeeinheiten), `reports` aufsteigend nach `JSON.stringify` des fertigen Spieler-Reports (UTF-16-Codeeinheiten). Kein `localeCompare`. Die Ordnung hängt nie von kanonischen IDs oder der Autorenreihenfolge ab.
6. `{ success: true, observation }` tief einfrieren und zurückgeben.

Kein Teilergebnis: Schlägt Schritt 3 für irgendeine Entität fehl, wird nichts freigegeben.

### 5.3 `PLAYER_REF_PATTERN`

`/^pr1_[0-9a-hjkmnp-tv-z]{16}$/` — wörtlich MYST-0001-Entwurf D3. Strings mit Doppelpunkt (alle kanonischen IDs), Slugs ohne Präfix, Großschreibung, Leerraum und andere Längen werden abgewiesen.

### 5.4 Ergebnis

```ts
export type PlayerClaim =
  | { readonly kind: "personAt"; readonly person: string; readonly location: string; readonly at: number }
  | { readonly kind: "eventHasParticipant"; readonly event: string; readonly person: string }
  | { readonly kind: "eventHasItem"; readonly event: string; readonly item: string };
export type PlayerReport = {
  readonly claim: PlayerClaim;
  readonly stance: "affirms" | "denies";
  readonly source: { readonly kind: "observation" } | { readonly kind: "testimony"; readonly person: string };
};
export type EvidenceObservation = {
  readonly schemaVersion: 1;
  readonly evidence: string;                                         // PlayerRef der Evidence
  readonly text: string;                                             // exakt entry.text
  readonly mentions: readonly { readonly kind: "person" | "location" | "item" | "event"; readonly ref: string }[];
  readonly reports: readonly PlayerReport[];
};
export type ReleaseErrorCode = "BINDING_MISMATCH" | "UNKNOWN_EVIDENCE" | "REF_UNAVAILABLE";
export type ReleaseResult =
  | { readonly success: true; readonly observation: EvidenceObservation }
  | { readonly success: false; readonly code: ReleaseErrorCode };
```

Schlüsselreihenfolge: Observation `schemaVersion, evidence, text, mentions, reports`; Mention `kind, ref`; Report `claim, stance, source`; Claim `kind` zuerst, dann die Felder in der oben gezeigten Reihenfolge; Source `kind` zuerst. Fehlerergebnisse sind modulweite, eingefrorene Konstanten (genau eine je Code) mit genau den Schlüsseln `success`, `code`; kein Echo, keine ID, keine Art, keine Nachricht.

### 5.5 Festgelegte Semantik

- **Rein:** gleiche Eingaben → tief gleiches Ergebnis; kein Zustand, kein Zufall, keine Zeit.
- **Wiederholung:** derselbe Release liefert ein tief gleiches Ergebnis; die Übernahme ins Spielerwissen ist idempotent (§8).
- **Keine Autorisierung:** `releaseEvidence` prüft nicht, ob die Evidence entdeckt wurde. Vorbedingung des Aufrufers (VS-5): nur Evidence, die MYST-0003 (oder ein späterer Mechanismus) geliefert hat. Festgehaltenes Verhalten (A-73).
- **Keine Inferenz:** Ausgabe = Text + Mentions + Reports des Eintrags, nichts weiter. Keine Ableitung aus `links`, Claims, Events, Secrets oder Solutions.
- `releaseEvidence` liest aus `presentation` ausschließlich `caseId`, `truthHash` und `entries[]`; es erhält weder `CaseTruth` noch `CaseSolution`.

### 5.6 Golden Releases (Fixture §3.4, `fakeTranslator`)

`JSON.stringify(releaseEvidence(parsedFixture, id, fakeTranslator(truth)))` ist bytegleich:

`evidence:fingerprint` (307 Bytes):
```text
{"success":true,"observation":{"schemaVersion":1,"evidence":"pr1_53trdamn1z833nc7","text":"Auf dem Griff des Brieföffners ist ein Fingerabdruck. Der Abgleich ergibt: Er stammt von Anna.","mentions":[{"kind":"item","ref":"pr1_3m50bymz53yhv757"},{"kind":"person","ref":"pr1_pddmm9vn96qyzyg7"}],"reports":[]}}
```

`evidence:anna-statement` (767 Bytes):
```text
{"success":true,"observation":{"schemaVersion":1,"evidence":"pr1_k4tq1cfq5v3d8wyv","text":"Anna sagt: „Ich habe Ben streiten hören. Danach war ich die ganze Zeit im Garten.“","mentions":[{"kind":"person","ref":"pr1_43j91mpcqhqd7eqv"},{"kind":"event","ref":"pr1_hnp5f21z42d6a2dq"},{"kind":"person","ref":"pr1_pddmm9vn96qyzyg7"},{"kind":"location","ref":"pr1_stcg6ft3cway8h06"}],"reports":[{"claim":{"kind":"eventHasParticipant","event":"pr1_hnp5f21z42d6a2dq","person":"pr1_43j91mpcqhqd7eqv"},"stance":"affirms","source":{"kind":"testimony","person":"pr1_pddmm9vn96qyzyg7"}},{"claim":{"kind":"personAt","person":"pr1_pddmm9vn96qyzyg7","location":"pr1_stcg6ft3cway8h06","at":1500},"stance":"affirms","source":{"kind":"testimony","person":"pr1_pddmm9vn96qyzyg7"}}]}}
```

`evidence:muddy-path` (207 Bytes):
```text
{"success":true,"observation":{"schemaVersion":1,"evidence":"pr1_gzt4xjcqp47990ze","text":"Im Gartenbeet sind frische Fußspuren.","mentions":[{"kind":"location","ref":"pr1_stcg6ft3cway8h06"}],"reports":[]}}
```

`evidence:gloves-dirty` (201 Bytes):
```text
{"success":true,"observation":{"schemaVersion":1,"evidence":"pr1_sqvqp73b02b32qsq","text":"An den Gartenhandschuhen klebt Erde.","mentions":[{"kind":"item","ref":"pr1_17jdyekm6zj6rbmd"}],"reports":[]}}
```

## 6. Informationsgrenze

| Information | Freigabe |
|---|---|
| kanonische IDs (Evidence, Entitäten, alle anderen) | **nie**; nur PlayerRefs über den Port, formatgeprüft |
| `Evidence.description`, `Event.description`, `Motive.description` | **nie gelesen** |
| `Evidence.source` | **nie gelesen**; nur wenn der Autor die Entität ausdrücklich erwähnt |
| `Evidence.links`, Proposition-IDs, `direction` | **nie gelesen** |
| `Proposition.truth`, Secrets, Red Herrings, `CaseSolution`, NPC-Wissen | **nie gelesen**, kein Import |
| Namen von Entitäten | nicht im Observation; nur soweit der Autor sie in `text` schreibt |
| `text` | genau wie autorisiert |
| `mentions` | genau die autorisierten, als `{ kind, ref }` |
| `reports` | genau die autorisierten, ohne Wahrheitswert |
| Art einer erwähnten Entität | freigegeben (bewusst; im Text ohnehin erkennbar) |

Restverantwortung des Autors (mechanisch nicht prüfbar, dokumentiert): inhaltliche Spoiler im Text, Reports, die mehr verraten als der Text (z. B. exakter Tick), Erwähnungen, die Untersuchungsziele freischalten (§9).

Quelltextregel: `src/domain/evidence-presentation*.ts` enthält die Zeichenfolgen `description`, `links`, `propositions`, `secrets`, `redHerrings`, `case-solution`, `npc-knowledge`, `truth.evidence[` nicht (auch nicht in Kommentaren). Erlaubte Imports: `zod`, `node:crypto` (nur Identity-Datei), `./case-truth.ts`, `./case-truth.identity.ts` (nur `hashCaseTruth`), zwischen den neuen Dateien nur Typen. Verboten: `Math.random`, `Date`, `localeCompare`, `normalize(`, `WeakMap`/`WeakSet`/`WeakRef`, modulweiter veränderlicher Zustand, Imports aus `src/forge/*`.

## 7. Identität und Hashing

### 7.1 Profil `forge-evidence-presentation-c14n-v1`

- Objekt-Schlüssel rekursiv nach UTF-16-Codeeinheiten sortiert.
- **Jedes Array ist eine Menge**: Elemente nach eigenem kanonischem JSON sortiert.
- Primitive über `JSON.stringify`, kein Whitespace, kein abschließender Zeilenumbruch; Strings weder getrimmt noch normalisiert.
- Eingabe ist ausschließlich das geparste, gebundene `EvidencePresentation`.

Array-Prüfung: Das Dokument enthält genau drei Arrays, `entries`, `mentions`, `reports`. Alle sind fachlich Mengen (die Release-Ausgabe ist ordnungsunabhängig, §5.2 Schritt 5), und R3/R6/R8 schließen Duplikate aus; Sortieren bildet also keine zwei verschiedenen Dokumente auf denselben String ab. `text` ist ein String, kein Array: jede Textänderung (ein Zeichen, Leerzeichen, NFC↔NFD) ändert den Hash. `canonicalize` wird lokal dupliziert (Truth-Version ist privat).

### 7.2 Hash

`hashEvidencePresentation(p)` = SHA-256 (hex, klein) über UTF-8 von `"forge-evidence-presentation-c14n-v1\n" + serializeEvidencePresentation(p)`. Über `caseId` und `truthHash` an die exakte Truth gebunden.

### 7.3 Golden Vectors (Node `node:crypto` und Python `hashlib` unabhängig berechnet)

`CANON_P` (Fixture §3.4, 1342 Bytes UTF-8):

```text
{"caseId":"case:letter-opener","entries":[{"evidenceId":"evidence:anna-statement","mentions":[{"id":"event:argument","kind":"event"},{"id":"location:garden","kind":"location"},{"id":"person:anna","kind":"person"},{"id":"person:ben","kind":"person"}],"reports":[{"claim":{"at":1500,"kind":"personAt","locationId":"location:garden","personId":"person:anna"},"source":{"kind":"testimony","personId":"person:anna"},"stance":"affirms"},{"claim":{"eventId":"event:argument","kind":"eventHasParticipant","personId":"person:ben"},"source":{"kind":"testimony","personId":"person:anna"},"stance":"affirms"}],"text":"Anna sagt: „Ich habe Ben streiten hören. Danach war ich die ganze Zeit im Garten.“"},{"evidenceId":"evidence:fingerprint","mentions":[{"id":"item:letter-opener","kind":"item"},{"id":"person:anna","kind":"person"}],"reports":[],"text":"Auf dem Griff des Brieföffners ist ein Fingerabdruck. Der Abgleich ergibt: Er stammt von Anna."},{"evidenceId":"evidence:gloves-dirty","mentions":[{"id":"item:gloves","kind":"item"}],"reports":[],"text":"An den Gartenhandschuhen klebt Erde."},{"evidenceId":"evidence:muddy-path","mentions":[{"id":"location:garden","kind":"location"}],"reports":[],"text":"Im Gartenbeet sind frische Fußspuren."}],"schemaVersion":1,"truthHash":"f8794eba02ff4cb846158a9d5d145ade93e24fd109d88f7a4b5244f175453a73"}
```

`CANON_E` (`goldenCase()`, `entries: []`, 134 Bytes):

```text
{"caseId":"case:golden","entries":[],"schemaVersion":1,"truthHash":"bd95eb9a8569f4f3f62eab50aac94e75cd601b54e3432776cc6663a204647501"}
```

| Vektor | Änderung gegenüber Fixture | SHA-256 |
|---|---|---|
| `P0` | keine | `8d790f71e045e0132f6fa7ff6bf3b85020561870485df355e8d1ac5a38eda3cf` |
| `P0` | `entries`, alle `mentions`, alle `reports` umgekehrt; Objekt-Schlüssel in anderer Reihenfolge | `8d790f71…` (gleich) |
| `PE` | `CANON_E` | `f37a3c040156755302245a68cde1b6ce5d93b5d5216d2f2e5fd4b7af6b4f5a19` |
| `P1` | `muddy-path.text` endet auf `!` statt `.` | `29e881d129d84678c5a1035de935f174cb96dd0a9dbd871c12dec7b00eb94b3e` |
| `P2` | `gloves-dirty.mentions` + `location:garden` | `390bbbbeb07c1218f9742b8aa8827f831274ab6413c1e911ae286e2cffb6a10f` |
| `P3` | `anna-statement`, Report `personAt`: `stance` → `denies` | `78bb28a2956d0de76b73dd5c08049a1adbdfb2646e1ad4bcdfe2ef80e9ba04e9` |
| `P4` | `anna-statement`, Report `eventHasParticipant`: `source` → `{ kind: "observation" }` | `0dc8d1e4c52457778eb441fb139b75fb9b9788575bdd050be688092951fb6e84` |
| `P5` | `fingerprint.text` in NFD (`ö` zerlegt) | `ed1bad29001ff5babf24eb84731310e60471075abbe302ae007306ec94e1e74c` |
| `P6` | `anna-statement`, `personAt.at` → 1501 | `b4cb0a03649fd99f97515079b4fc544562df4df306082f45c509a01afa1ca4c2` |
| `P7` | `muddy-path.text` mit angehängtem Leerzeichen | `a2aec5ebe28711365b527648b1662d5bfbe851c10d34bf9378e1b375587469ac` |

## 8. Wirkung auf Spielerwissen (Vertrag für VS-5, hier nur festgelegt, nicht implementiert)

Aus einem erfolgreichen `EvidenceObservation` darf ein späteres PlayerKnowledge genau übernehmen:

| Kategorie | Quelle | Bedeutung | Nicht |
|---|---|---|---|
| bekannte Evidence | `observation.evidence` | „der Spieler hat diese Evidence gesehen“ | keine Aussage über ihre Bedeutung |
| bekannte Entität | jedes `mentions[k]` | „der Spieler kennt diese Entität“ (darf Untersuchungsziel werden) | keine Rolle, kein Name, keine Schuld |
| berichtete Aussage | jedes `reports[k]`, **zusammen mit** `observation.evidence` | „Evidence E zeigt/Person X sagt: Claim bejaht/verneint“ | keine Wahrheit, kein Glaube, keine Proposition, keine Conclusion |
| Präsentationstext | `observation.text` | nur Anzeige/Protokoll | wird nie geparst, ist nie Eingabe einer Regel |

Regeln: Mengenvereinigung (idempotent, ordnungsunabhängig); widersprüchliche Reports bleiben nebeneinander bestehen; keine Ableitung neuer Entitäten, Aussagen oder Wahrheiten; Release fügt nie etwas hinzu, das nicht im Observation steht.

## 9. Grenze zu MYST-0003 und VS-5

Vorgesehene Kette (nicht Teil dieses Vertrags): MYST-0003 `resolveInvestigation` → neue Evidence-IDs (intern) → `releaseEvidence` je ID → Observation an Spieler → Mentions werden über `resolvePlayerRef` (MYST-0001) zu `known` für spätere Untersuchungen. Eine Erwähnung **schaltet damit Untersuchungsziele frei**; das ist beabsichtigte Spielmechanik und Autorenverantwortung. VS-5 bindet `truthHash`, `accessHash`, `presentationHash` und die PlayerRef-Konfiguration in einem Paket-Hash.

## 10. Acceptance Criteria

- AC-01 Exporte von `src/domain/evidence-presentation.ts` sind genau: `PRESENTATION_LIMITS`, `PLAYER_REF_PATTERN`, `PlayerTextSchema`, `MentionSchema`, `ReportSchema`, `PresentationEntrySchema`, `createEvidencePresentationSchema`, `parseEvidencePresentation`, `releaseEvidence` sowie die Typen `MentionKind`, `RefKind`, `EvidencePresentationInput`, `EvidencePresentation`, `PlayerRefTranslator`, `PlayerClaim`, `PlayerReport`, `EvidenceObservation`, `ReleaseErrorCode`, `ReleaseResult`. Von der Identity-Datei genau `EVIDENCE_PRESENTATION_CANONICALIZATION_PROFILE`, `serializeEvidencePresentation`, `hashEvidencePresentation`.
- AC-02 `PRESENTATION_LIMITS` ist tief gleich `{ textMaxLength: 1000, maxMentions: 16, maxReports: 8 }`.
- AC-03 Fixture §3.4 parst; Ergebnis tief eingefroren; Mutation der Eingabe nach dem Parse ändert das Ergebnis nicht.
- AC-04 R1–R8 werden mit den angegebenen Pfaden gemeldet; R1-Fehler erzeugen keine Folge-Issues.
- AC-05 T1–T6 einschließlich aller Codepunkte aus T4 einzeln getestet (je Codepunkt bzw. Bereichsgrenzen: erstes und letztes Zeichen jedes Bereichs).
- AC-06 Die vier Golden Releases §5.6 werden bytegleich reproduziert.
- AC-07 Für Fixture und eine Permutation (Einträge, Mentions, Reports umgekehrt, Schlüssel umsortiert) sind alle Releases tief gleich.
- AC-08 Die Fehlercodes `BINDING_MISMATCH`, `UNKNOWN_EVIDENCE`, `REF_UNAVAILABLE` werden in der Reihenfolge §5.2 erzeugt; Fehlerergebnisse sind referenzgleich je Code und haben genau zwei Schlüssel.
- AC-09 `refFor` wird pro Release genau einmal je `(evidence)` und je Mention aufgerufen, für nichts sonst (Spy).
- AC-10 Golden Vectors §7.3 bytegleich (CANON_P, CANON_E, P0–P7, Permutationsgleichheit).
- AC-11 Spoiler-Scan: Für `spoilerCase()` (§11 Vorspann) enthält `JSON.stringify` aller Observations keinen der verbotenen Strings.
- AC-12 Quelltextregeln §6 als Test über den Dateiinhalt.
- AC-13 Zeilenlimits §2 als Test über den Dateiinhalt (physische Zeilen).
- AC-14 Typecheck-Datei: `EvidencePresentation` ist aus einem Plain-Objekt nicht zuweisbar (`@ts-expect-error`); `RefKind` lässt `"proposition"` nicht zu; `EvidenceObservation` hat keine Schlüssel `id`, `description`, `links`, `truth`, `source` (auf oberster Ebene); `PlayerClaim` hat kein Feld `personId`.
- AC-15 `npm run typecheck` 0 Fehler; `npm test` grün, alle 1087 Basistests unverändert grün.
- AC-16 Jeder Mutant §12 wird von den genannten Testdateien getötet (Mutation Smoke, required).

## 11. Testmatrix (adversarial)

`spoilerCase()` (Fixture-Datei): eine gültige Truth mit sprechenden IDs `person:killer`, `person:victim`, `item:murder-weapon`, `location:crime-scene`, `event:the-murder`, `evidence:killer-fingerprint`, `evidence:planted-note`, `proposition:killer-did-it`, `secret:killer-affair`, `red-herring:planted-note`, Beschreibungen mit dem Marker `SPOILER-DESC-…`, Namen mit `SPOILER-NAME-…`, plus eine passende Presentation, deren Texte keinen Marker enthalten. Verbotene Strings im Scan: jede ID der Truth, jeder Slug-Teil ≥ 4 Zeichen (`killer`, `victim`, `murder-weapon`, `crime-scene`, `the-murder`, `planted-note`, `killer-did-it`, `killer-affair`), `SPOILER-DESC`, `SPOILER-NAME`, `"truth"`, `"supports"`, `"refutes"`, `"links"`, `"description"`, `"propositionId"`.

| ID | Angriff | Eingabe | Erwartung | Datei |
|---|---|---|---|---|
| A-01 | sprechende Evidence-ID | Release `evidence:killer-fingerprint` | `observation.evidence` ist PlayerRef; Scan sauber | security |
| A-02 | Täter-/Personen-ID | Mention `person:killer` | nur `{kind:"person", ref}`; Scan sauber | security |
| A-03 | Ordnungsorakel (Slug-Alphabet) | Mentions in Autorenreihenfolge a…z | Ausgabe nach `ref` sortiert, nicht nach ID; permutierte Eingabe gleiches Ergebnis | test |
| A-04 | Art erwähnter Entitäten | beliebig | `kind` sichtbar (bewusste Freigabe) | test |
| A-05 | verborgene Quelle | `gloves-dirty` (source `event:walk`) | kein Ref für `event:walk`; `refFor` nie mit `event:walk` aufgerufen | security |
| A-06 | Port-Aufrufe | Spy über alle Releases | Aufrufmenge = {Evidence} ∪ Mentions je Eintrag | security |
| A-07 | Proposition-Links | alle Releases | kein `links`/`propositionId`; `refFor` nie mit `proposition` | security |
| A-08 | Wahrheitswerte | Scan des Observations | kein Boolean irgendwo im Observation | security |
| A-09 | Secret-Mitgliedschaft | Truth-Variante ohne `secret:debt` (neu gebunden) | Observations tief gleich zur Fixture-Truth (gleicher Fake-Port) | security |
| A-10 | Red-Herring-Mitgliedschaft | Truth-Variante ohne `red-herring:fingerprint` | Observations tief gleich | security |
| A-11 | Wahrheit gekippt | Truth-Variante, alle `truth` invertiert (neu gebunden) | Observations tief gleich | security |
| A-12 | Solution-Daten | Quelltext | kein Import `case-solution`; keine Solution-Parameter | security |
| A-13 | `Evidence.description` | `spoilerCase` | `SPOILER-DESC` nicht im Scan | security |
| A-14 | Autor kopiert `description` wörtlich in `text` | Text = Description | akzeptiert (Autoreninhalt) | test |
| A-15 | Namen | `spoilerCase` | `SPOILER-NAME` nicht im Scan; kein Namensfeld | security |
| A-16 | unbekannte Entität | Mention `person:ghost` | R5-Issue `["entries",i,"mentions",j,"id"]` | test |
| A-17 | Evidence als Mention | `{kind:"evidence", …}` | Schemafehler | test |
| A-18 | verbotene Arten | `proposition`, `secret`, `red-herring`, `conclusion`, `motive`, `relationship`, `case` | je Schemafehler | test |
| A-19 | unreleased Entity über Report | Report `eventHasItem(event:walk, item:gloves)` ohne Mention `event:walk` | R7-Issue | test |
| A-20 | Zeuge nicht erwähnt | `testimony.personId` fehlt in Mentions | R7-Issue | test |
| A-21 | released Entity | Mention ohne Report | nur in `mentions` | test |
| A-22 | Proposition-ID im Report | `{ propositionId, … }` | Schemafehler (strict) | test |
| A-23 | Wahrheitswert im Report | Report mit `truth: true` | Schemafehler | test |
| A-24 | Report auf unbekanntes Event | Claim `event:nope`, Mention fehlt | R7-Issue (und R5, falls erwähnt) | test |
| A-25 | Selbstwiderspruch | gleicher Claim + Quelle, `affirms` und `denies` | R8-Issue | test |
| A-26 | Zeugen widersprechen sich | gleicher Claim, zwei Zeugen, gegensätzlich | akzeptiert; beide im Release | test |
| A-27 | doppelte Mention | gleiches `(kind,id)` zweimal | R6-Issue | test |
| A-28 | Mention-Limit | 17 / 16 | Fehler / gültig | test |
| A-29 | Report-Limit | 9 / 8 | Fehler / gültig | test |
| A-30 | Fremdfelder im Eintrag | `description`, `source`, `links`, `label` | je `unrecognized_keys` | test |
| A-31 | Truth geändert | `fullCase()` mit `revision: 4` | R1 `["truthHash"]`, keine weiteren Issues | test |
| A-32 | fremder Fall | `caseId: "case:other"` | R1 `["caseId"]` | test |
| A-33 | stale PlayerRef-Mapping | Port mit altem `truthHash` | `BINDING_MISMATCH` | security |
| A-34 | falsches Paket | Port mit `caseId` eines anderen Falls | `BINDING_MISMATCH` | security |
| A-35 | fehlende Ref | `refFor` → `null` für eine Mention | `REF_UNAVAILABLE`, kein Teilergebnis | security |
| A-36 | Port leakt kanonische ID | `refFor = (k,id) => id` | `REF_UNAVAILABLE` | security |
| A-37 | Port leakt Slug | `refFor` → `"ben"` | `REF_UNAVAILABLE` | security |
| A-38 | Port nicht injektiv | konstante Ref | `REF_UNAVAILABLE` | security |
| A-39 | Ref-Form | Großbuchstaben, Leerzeichen, 15/17 Zeichen, `i`/`l`/`o`/`u` | `REF_UNAVAILABLE` | security |
| A-40 | Nicht-String-Ref | Zahl, Objekt, `undefined` | `REF_UNAVAILABLE` | security |
| A-41 | unbekannte Evidence | `evidence:nope`, fallfremde ID, `42`, `null`, PlayerRef-String, ID mit Leerzeichen | `UNKNOWN_EVIDENCE`, referenzgleich | test |
| A-42 | Fehler-Echo | alle Fehlerpfade | genau Schlüssel `success`, `code` | security |
| A-43 | doppelter Release | zweimal dieselbe ID | tief gleich | test |
| A-44 | Property-Reihenfolge | Eingabeschlüssel umsortiert | gleicher Hash, gleiche Releases | identity |
| A-45 | Sammlungsreihenfolge | Einträge/Mentions/Reports permutiert | `P0`, gleiche Releases | identity |
| A-46 | geteilte Objekte | Observation vs. Presentation | keine gemeinsamen Objekte; Observation eingefroren | test |
| A-47 | Eingabemutation nach Parse | Fixture-Objekt nachträglich ändern | geparstes Dokument unverändert | test |
| A-48 | Port mutiert Ergebnis | `refFor` hält Referenz, versucht später zu schreiben | unmöglich (eingefroren) | security |
| A-49 | geänderter Text | `P1`, `P5`, `P7` | Hash ändert sich | identity |
| A-50 | Whitespace-Text | `"  \n "` | T2 | test |
| A-51 | leerer Text | `""` | T2 | test |
| A-52 | Länge | 1000 / 1001 Codeeinheiten; 500 Astral-Emoji (1000 Einheiten) / 501 | gültig / Fehler / gültig / Fehler | test |
| A-53 | Bidi | U+202A…U+202E, U+2066…U+2069, U+200E, U+200F, U+061C | T4 | test |
| A-54 | Steuerzeichen | U+0000, U+0009, U+000B, U+000D, U+001F, U+007F, U+0085, U+009F | T4 | test |
| A-55 | unsichtbare Trenner | U+2028, U+2029, U+FEFF, U+200B, U+2060 | T4 | test |
| A-56 | unpaarige Surrogate | U+D800 allein, U+DC00 allein, U+D800 am Ende | T3 | test |
| A-57 | legitime Zeichen | Zeilenumbruch, ZWJ-Emoji-Sequenz, ZWNJ, `„“`, `ß` | gültig | test |
| A-58 | Homoglyph-ID | U+0440 U+0435 statt `pe`: `реrson:ben` | gültig (Grenze dokumentiert: Unfallschutz, Autor vertrauenswürdig) | test |
| A-59 | injizierte kanonische ID | `"Täter: person:killer"` | T5 | security |
| A-60 | weitere Präfixe | `evidence:x`, `red-herring:x`, `conclusion:x`, `case:x`, `secret:x`, `proposition:x` | T5 | security |
| A-61 | keine ID-Form | `Person:Ben`, `person: ben`, `person:` am Ende | gültig | test |
| A-62 | Falsch-Positiv | `Kontaktperson:anna` | T5 (bewusst konservativ) | test |
| A-63 | PlayerRef im Text | `"siehe pr1_53trdamn1z833nc7"` | T6 | security |
| A-64 | Markup | `<script>`, `**fett**` | gültig; Text ist Klartext, Renderer escaped (Non-Goal) | test |
| A-65 | Nicht-String-Text | Zahl, `null`, Array | Schemafehler | test |
| A-66 | malformed Dokument | `schemaVersion: 2`, `entries` kein Array, Fremdschlüssel an Wurzel | Schemafehler | test |
| A-67 | fehlender Eintrag | Fixture ohne `muddy-path` | R4 mit ID in Nachricht | test |
| A-68 | Eintrag für unbekannte Evidence | `evidence:ghost` | R2 | test |
| A-69 | doppelter Eintrag | `fingerprint` zweimal | R3 | test |
| A-70 | leerer Fall | `goldenCase()`, `entries: []` | gültig, `PE` | identity |
| A-71 | Report widerspricht Wahrheit | Anna bezeugt falschen Claim | akzeptiert; Wahrheit nie gelesen | test |
| A-72 | Report = lösungsrelevanter Claim | Observation `eventHasParticipant(the-murder, killer)` | akzeptiert (autorisierte Freigabe, Hotspot) | test |
| A-73 | Release ohne Entdeckung | beliebige ID der Presentation | freigegeben; Autorisierung ist Vorbedingung des Aufrufers | test |
| A-74 | Erwähnung schaltet Ziel frei | Mention `item:gloves` | im Observation; Wirkung auf Investigation dokumentiert (§9) | test |
| A-75 | Report präziser als Text | `at: 1500`, Text „danach“ | akzeptiert (Autorenverantwortung) | test |
| A-76 | Präfix-Map-Vollständigkeit | Liste der Präfixe in T5 | gleich allen ID-Präfixen aus `case-truth.ts` + `conclusion` (Test liest beide Quelltexte) | security |

## 12. Mutationsanker und Mutanten

Die Produktionsdateien enthalten jeden Anker **genau einmal**, wörtlich:

| ID | Datei | Anker (vorher) | Mutant (nachher) | tötende Tests |
|---|---|---|---|---|
| m1 | `evidence-presentation.ts` | `if (CANONICAL_ID_IN_TEXT.test(text))` | `if (false)` | security |
| m2 | `evidence-presentation.ts` | `if (FORBIDDEN_CHARACTERS.test(text))` | `if (false)` | test |
| m3 | `evidence-presentation.ts` | `translator.truthHash !== presentation.truthHash` | `false` | security |
| m4 | `evidence-presentation.ts` | `!PLAYER_REF_PATTERN.test(ref)` | `false` | security |
| m5 | `evidence-presentation.ts` | `\|\| used.has(ref)` | (leer) | security |
| m6 | `evidence-presentation.ts` | `if (!mentioned.has(mentionKey(kind, id)))` | `if (false)` | test |
| m7 | `evidence-presentation.ts` | `if (!seen.has(id))` | `if (false)` | test |
| m8 | `evidence-presentation.ts` | `.sort((a, b) => byCodeUnits(a.ref, b.ref))` | (leer) | test |
| m9 | `evidence-presentation.identity.ts` | `.sort(byCodeUnits).join(",")` | `.join(",")` | identity |

In `m5` ist `\|` nur die Tabellen-Maskierung; der Anker lautet `|| used.has(ref)`. Ein überlebender Mutant ist ein blockierender Befund. Im verworfenen Prototyp wurden m1, m3–m8 und ein Stance-Schlüssel-Mutant gegen einen Rauchtest getötet; m9 überlebte dort nur mangels Assertion (AC-10 deckt ihn ab).

## 13. Non-Goals

- Keine UI, kein Rendering, kein Markup, kein Escaping, keine Lokalisierung, keine Mehrsprachigkeit.
- Keine LLM-Ausgabe, keine Textgenerierung, keine Textprüfung auf inhaltliche Spoiler.
- Keine Schlussfolgerungsengine, keine Inferenz, kein Spielerwissen-Objekt, keine Session, kein Save/Load.
- Keine Namen/Entitätspräsentation (wie heißt eine erwähnte Person für den Spieler): eigener späterer Task.
- Keine Autorisierung (entdeckt?), keine Investigation, keine Änderung an MYST-0003, keine Änderung an `CaseTruth`.
- Keine PlayerRef-Implementierung, kein Import aus MYST-0001.
- Keine Wiederverwendung von `Evidence.description` und keine Ableitung von Reports aus `links` (V2-Kandidat, Paket §9).
- Kein Lint für Namen im Text ohne Mention (VS-6-Kandidat).
- Keine Unicode-Normalisierung.

## 14. Developer-Abschluss

Der Run-PR enthält: Ausgabe von `npm run typecheck` und `npm test` (Gesamtzahl, alle 1087 Basistests grün), Zeilenzahlen der beiden Produktionsdateien, Mutation-Smoke-Protokoll m1–m9 (je Mutant: angewendet, tötender Test, zurückgesetzt), und eine Liste aller Abweichungen von diesem Vertrag (erwartet: keine).
