---json
{
  "forgeContractFormat": 1,
  "taskId": "MYST-0005B",
  "contractVersion": 1,
  "baseCommit": "3d7545d843883418348004e68717399a64da7a7d",
  "dependencies": [
    {
      "taskId": "MYST-0005A",
      "acceptedCommit": null
    }
  ],
  "scope": {
    "create": [
      "src/domain/interrogation.ts",
      "tests/interrogation.fixture.ts",
      "tests/interrogation.test.ts",
      "tests/interrogation.security.test.ts",
      "tests/interrogation.typecheck.ts",
      "tests/npc-knowledge.projection.bridge.test.ts"
    ],
    "modify": [
      "src/domain/npc-knowledge.projection.ts"
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
# MYST-0005B v1 — Interrogation Release V1 (DRAFT)

Status: **DRAFT**, nicht registriert, nicht freigegeben. Ziel-Pfad bei Registrierung: `forge/contracts/MYST-0005B.md`.

**Startsperre (absichtlich):** Die Dependency MYST-0005A trägt `acceptedCommit: null`. `src/forge/state.ts` lehnt eine Architektur-Freigabe damit als `DEPENDENCY_UNRESOLVED` ab. Vor Freigabe braucht dieser Contract eine neue Revision mit dem akzeptierten Commit von MYST-0005A und einem `baseCommit`, der ihn enthält. Alle Fakten in §1.2 zu MYST-0005A/MYST-0004 sind gegen deren **Drafts** formuliert und müssen dabei gegen gemergten Code reconciled werden.

Architektur: `forge-audits/MYST-0005-INTERROGATION-PACKAGE.md` (nicht normativ).

## 1. Verbindlichkeit, Basis und Abhängigkeiten

### 1.1 Ziel

Implementiere die transiente Laufzeithälfte der NPC-Befragung V1:

```
(questionId, known) + trusted Dokumente
  → Projektion mit Bridge-Capability (einmal pro Aufruf)
  → decideResponse: Stance aus genau einer strukturell passenden Attitude
  → Release-Translator VisibleRef → PlayerRef, nur für autorisierte Entitäten
  → InterrogationObservation (PlayerRefs, questionId, Stance-Enum)
```

Keine Lügen, kein Gesprächszustand, kein Freitext, keine Persistenz von Laufzeitobjekten.

### 1.2 Gelesene Fakten

| Fakt | Ort |
|---|---|
| `projectNpcKnowledge(snapshot, truth, solution)` → `{success:true, context}` \| `{success:false, code:"CONTEXT_BINDING_MISMATCH"}`, tief eingefroren | `src/domain/npc-knowledge.projection.ts` @ `baseCommit` |
| Private Helfer dort: `isBound`, `claimReferences`, `visibleClaim`, `visibleStance`, lokale `indexOf`-Tabelle (`"kind\|id"` → Index), `ref(kind,id)` erzeugt bei **jedem** Aufruf ein neues Objekt | dito |
| `VisibleRef = {kind,index}`; Indizes 1..N je Art nach UTF-16-Sortierung der sichtbaren IDs; gleiche Werte in zwei Projektionen können verschiedene Entitäten meinen (Probe: Annas und Bens `{person,2}`) | dito, Probe |
| Je Kontext passt ein vollständiger Claim höchstens einer Attitude (TASK-0004-Duplikatregel über strukturelle Claim-Schlüssel) | `src/domain/npc-knowledge.ts` |
| knowledge ist faktiv (Parser lehnt Abweichung von `truth` ab) | dito |
| `JSON.stringify` eines eingefrorenen Funktionsobjekts → `"{}"`; `structuredClone` → `DataCloneError` | Probe |
| **Draft MYST-0004 (Angleichung):** struktureller Port `PlayerRefTranslator = { caseId, truthHash, refFor(kind, id): string \| null }`, `PLAYER_REF_PATTERN = /^pr1_[0-9a-hjkmnp-tv-z]{16}$/` (wörtlich MYST-0001 D3), Rückgaben werden geprüft (Form, Injektivität), Observation-Mentions `{kind, ref}` nach `ref` sortiert, Report-Stance `affirms`/`denies` | `MYST-0004-EVIDENCE-PRESENTATION-V1.contract.DRAFT.md` §5 |
| **Draft MYST-0005A:** `src/domain/interrogation-authoring.ts` (`QuestionCatalogue`, `InterrogationProfile`, `EntityRef`, `StatementClaim`, `statementClaimReferences`) und `.identity.ts` (`hashQuestionCatalogue`) | `MYST-0005A-…contract.DRAFT.md` §6 |

### 1.3 Abhängigkeiten

MYST-0005A (Authoring). TASK-0001/0003/0004 als Legacy über `baseCommit`. **MYST-0001 ist keine Implementierungsabhängigkeit** (gleiches Modell wie MYST-0004): PlayerRefs kommen über den Port; VS-5 baut ihn aus `PlayerRefIndex` (`refFor = (k, id) => playerRefFor(index, k, id)`). Kopplung: `PLAYER_REF_PATTERN` = MYST-0001 D3; ändert MYST-0001 das Format vor Annahme, ist eine Revision Pflicht.

## 2. Dateien und Größenlimits

| Datei | Inhalt | Limit |
|---|---|---|
| `src/domain/npc-knowledge.projection.ts` (modify) | Bridge-Export, additiv | netto **≤ +50** Zeilen |
| `src/domain/interrogation.ts` (create) | Typen, `decideResponse`, Translator, `interrogate` | ≤ 230 |
| **Produktion gesamt (neu + Netto-Delta)** | | **≤ 280** |

Imports von `interrogation.ts`: Typen aus `./case-truth.ts`, `./case-solution.ts`, `./npc-knowledge.ts`; Runtime aus `./npc-knowledge.projection.ts` (`projectNpcKnowledgeWithBridge` + Typen), `./interrogation-authoring.ts` (`statementClaimReferences` + Typen), `./interrogation-authoring.identity.ts` (`hashQuestionCatalogue`), `./case-truth.identity.ts` (`hashCaseTruth`). Kein Import aus `player-ref.ts` oder `evidence-presentation.ts`; kein `zod`-Bedarf; kein `node:*`.

## 3. Fixture (`tests/interrogation.fixture.ts`)

Truth/Solution = `world()` aus `tests/npc-knowledge.fixture.ts`; Katalog und Profil Dora = MYST-0005A-Fixture (importieren). Port = Test-Double `fakeRefs(truth)`: `{ caseId: truth.caseId, truthHash: hashCaseTruth(truth), refFor: (k, id) => "pr1_" + sha256hex(k + "\n" + id).slice(0, 16) }` (erfüllt `PLAYER_REF_PATTERN`; `node:crypto` nur in der Test-Fixture). Erwartete Refs werden nie als Literal geschrieben, sondern als `pr(kind, id) = fakeRefs(truth).refFor(kind, id)`.

Dora-Snapshot (geprüft: parst und projiziert an `baseCommit`), mit den Helfern `propositionAttitude`/`conclusionAttitude` der bestehenden Fixture:

- `npcId: person:dora`, `asOf: 500`, `revision: 1`, an Solution gebunden.
- awareness (alle `prior_knowledge`, `acquiredAt 0`): person anna, person ben, location library, item knife, event ben-kills-clara, evidence bloody-knife.
- attitudes: `ben-at-library` knowledge true · `anna-at-library` knowledge false · `anna-in-killing` belief true (objektiv falsch) · `ben-in-killing` uncertain leaning true · `knife-used` uncertain leaning false · Conclusion `ben-responsible` belief false · Conclusion `argument-caused-killing` uncertain leaning null.

Anna-NPC (für Mehr-NPC-Fälle): `npcId: person:anna`, awareness person ben, location library; attitude `ben-at-library` belief true; Profil mit genau der Regel `question:ben-in-library` wie bei Dora.

`known` (Standard) = alle Entitäten der Truth (4 Personen, 2 Orte, 1 Item, 3 Events, 2 Evidence).

Erwartete Dora-Observations mit Standard-`known`:

| questionId | act | stance | statement | mentions (Entitäten) |
|---|---|---|---|---|
| ben-in-library | answer | affirms | `personAt(pr(ben), pr(library), 300)` | ben, library |
| anna-in-library | answer | denies | `personAt(pr(anna), pr(library), 300)` | anna, library |
| anna-in-killing | answer | affirms | `eventHasParticipant(pr(ben-kills-clara), pr(anna))` | ben-kills-clara, anna |
| ben-in-killing | answer | leans_affirms | `eventHasParticipant(pr(ben-kills-clara), pr(ben))` | ben-kills-clara, ben |
| knife-used | answer | leans_denies | `eventHasItem(pr(ben-kills-clara), pr(knife))` | ben-kills-clara, knife |
| ben-responsible | answer | denies | `personResponsibleForEvent(pr(ben), pr(ben-kills-clara))` | ben, ben-kills-clara |
| ben-planned | answer | does_not_know | — | — |
| argument-caused-killing | answer | uncertain | `eventCausedEvent(pr(argument), pr(ben-kills-clara))` | argument, ben-kills-clara |
| where-was-ben | answer | affirms | `personAt(pr(ben), pr(library), 300)` | ben, library (library nur dank `reveal`) |
| anna-in-garden | answer | does_not_know | — | — |
| bloody-knife | decline | — | — | — |

## 4. Projektions-Bridge (Änderung an `npc-knowledge.projection.ts`)

### 4.1 Neue Exporte (nur diese)

```ts
export type NpcSourceClaim = CaseTruth["propositions"][number]["claim"] | CaseSolution["conclusions"][number]["claim"];
export type NpcEntityRef = {
  readonly kind: "person" | "location" | "item" | "event" | "evidence";
  readonly id: string;
};
export type NpcProjectionBridge = {
  readonly visibleClaimOf: (claim: NpcSourceClaim) => NpcVisibleClaim | null;
  readonly entityOf: (ref: VisibleRef) => NpcEntityRef | null;
  readonly toJSON: () => never;
};
export type BridgedProjectionResult =
  | { readonly success: true; readonly context: NpcVisibleContext; readonly bridge: NpcProjectionBridge }
  | { readonly success: false; readonly code: "CONTEXT_BINDING_MISMATCH" };
export function projectNpcKnowledgeWithBridge(
  snapshot: NpcKnowledgeSnapshot, truth: CaseTruth, solution: CaseSolution | null,
): BridgedProjectionResult;
```

### 4.2 Semantik

1. `projectNpcKnowledge` bleibt in Signatur, Ergebnis, Fehlerobjekt, Einfrieren und Schlüsselreihenfolge **unverändert**. Beide Funktionen nutzen denselben privaten Kern; es gibt genau eine Index-Berechnung.
2. `context` aus `projectNpcKnowledgeWithBridge` ist deep-equal und JSON-gleich zu `projectNpcKnowledge(...).context` für dieselben Eingaben.
3. `emitted`: aufruflokale `Map<object, NpcEntityRef>`, befüllt nur, wenn der Kern ein Ref-Objekt einer der fünf Entitätsarten für den Kontext erzeugt. Nicht modulweit, nicht exportiert, nie Quelle der Abbildung (Quelle bleibt `indexOf`).
4. `entityOf(ref)`: `emitted.get(ref)` per Objektidentität; sonst `null`. Gibt ein neues, eingefrorenes `{kind, id}` zurück. Kopien, JSON-Roundtrips, Refs anderer Projektionen, Statement-Refs (`proposition`/`conclusion`) und Nicht-Objekte → `null`. Nie ein Fehler.
5. `visibleClaimOf(claim)`: wenn **alle** Referenzen aus dem privaten `claimReferences(claim)` in `indexOf` liegen, der tief eingefrorene Claim aus dem privaten `visibleClaim` (Ref-Objekte werden **nicht** in `emitted` registriert); sonst `null`.
6. `toJSON()` wirft `TypeError`. `bridge` und das äußere Ergebnis sind eingefroren.
7. Fehlerfall: dasselbe Fehlerobjekt wie `projectNpcKnowledge` (deep-equal), ohne `bridge`.
8. Kopfkommentar der Datei um einen Satz ergänzen: die Bridge ist eine trusted-only Capability und gibt kanonische IDs heraus; sie gehört nie in Kontext, Policy oder Spielerausgabe.

## 5. `src/domain/interrogation.ts`

### 5.1 Typen

```ts
export const RESPONSE_STANCES = ["affirms", "denies", "leans_affirms", "leans_denies", "uncertain", "does_not_know"] as const;
export type ResponseStance = (typeof RESPONSE_STANCES)[number];

type R = string; // PlayerRef, geprüft gegen PLAYER_REF_PATTERN
export type PlayerClaim =
  | { readonly kind: "personAt"; readonly person: R; readonly location: R; readonly at: number }
  | { readonly kind: "eventHasParticipant"; readonly event: R; readonly person: R }
  | { readonly kind: "eventHasItem"; readonly event: R; readonly item: R }
  | { readonly kind: "personResponsibleForEvent"; readonly person: R; readonly event: R }
  | { readonly kind: "personRoleForEvent"; readonly person: R; readonly event: R; readonly role: ResponsibilityRole }
  | { readonly kind: "noPersonResponsibleForEvent"; readonly event: R }
  | { readonly kind: "eventCausedEvent"; readonly causeEvent: R; readonly event: R }
  | { readonly kind: "eventIntent"; readonly event: R; readonly value: Intent }
  | { readonly kind: "eventMechanism"; readonly event: R; readonly value: Mechanism };

export type InterrogationObservation =
  | { readonly schemaVersion: 1; readonly npc: R; readonly questionId: QuestionId; readonly act: "decline" }
  | { readonly schemaVersion: 1; readonly npc: R; readonly questionId: QuestionId; readonly act: "answer"; readonly stance: "does_not_know" }
  | {
      readonly schemaVersion: 1; readonly npc: R; readonly questionId: QuestionId; readonly act: "answer";
      readonly stance: Exclude<ResponseStance, "does_not_know">;
      readonly statement: PlayerClaim;
      readonly mentions: readonly { readonly kind: "person" | "location" | "item" | "event"; readonly ref: R }[];
    };

export type InterrogationResult =
  | { readonly success: true; readonly observation: InterrogationObservation }
  | { readonly success: false; readonly code: "BINDING_MISMATCH" | "QUESTION_NOT_AVAILABLE" | "REF_UNAVAILABLE" };

export type ResponseDecision =
  | { readonly stance: "does_not_know"; readonly claim: null }
  | { readonly stance: Exclude<ResponseStance, "does_not_know">; readonly claim: NpcVisibleClaim };

export const PLAYER_REF_PATTERN = /^pr1_[0-9a-hjkmnp-tv-z]{16}$/;   // wörtlich MYST-0001 D3, identisch MYST-0004
export type PlayerRefTranslator = {                                // strukturell identisch MYST-0004 §5.1
  readonly caseId: string;
  readonly truthHash: string;
  readonly refFor: (kind: "person" | "location" | "item" | "event" | "evidence", id: string) => string | null;
};
export type ReleaseTranslator = { readonly translate: (ref: VisibleRef) => string | null; readonly toJSON: () => never };

export type InterrogationInput = {
  readonly truth: CaseTruth;
  readonly solution: CaseSolution | null;
  readonly snapshot: NpcKnowledgeSnapshot;
  readonly catalogue: QuestionCatalogue;
  readonly profile: InterrogationProfile;
  readonly refs: PlayerRefTranslator;  // trusted Port, Rückgaben werden geprüft
  readonly known: readonly EntityRef[];   // vom trusted Host (Session) abgeleitet
  readonly questionId: unknown;           // Spielereingabe
};
```

Schlüsselreihenfolge in JSON exakt wie in den Typen oben (Observation: `schemaVersion, npc, questionId, act, stance, statement, mentions`; Mention: `kind, ref`; Claim: `kind`, dann Felder wie gelistet; Ergebnis: `success, observation` bzw. `success, code`).

### 5.2 `decideResponse(context, target)`

Reine Funktion, liest ausschließlich `context.attitudes`.

1. `target === null` ⇒ `{ stance: "does_not_know", claim: null }`.
2. Suche die Attitude, deren `claim` strukturell gleich `target` ist: gleicher `kind` und für **jedes** Feld gleicher Wert; Ref-Felder vergleichen `kind` und `index`; Property-Reihenfolge irrelevant; keine Inferenz (keine Negation, Äquivalenz, Kausalität, Zeit). Keine ⇒ `does_not_know`.
3. Stance-Abbildung (exhaustiv, ohne `default`):

| Attitude-Stance | `stance` |
|---|---|
| knowledge `true`, belief `true` | `affirms` |
| knowledge `false`, belief `false` | `denies` |
| uncertain `true` | `leans_affirms` |
| uncertain `false` | `leans_denies` |
| uncertain `null` | `uncertain` |

4. `claim` ist **das Objekt aus `context.attitudes[i].claim`** (Identität), nicht eine Kopie und nicht `target`.

knowledge und belief werden identisch abgebildet: Unterscheidung wäre wegen Faktivität ein Wahrheitsorakel. Es gibt keine Täuschung: ein NPC mit Attitude kann nie `does_not_know` liefern, und die Polarität wird nie verändert.

### 5.3 `createReleaseTranslator(bridge, refs, authorized)`

Liefert eingefroren `{ translate, toJSON }`. `translate(ref)`: `entity = bridge.entityOf(ref)`; `null` ⇒ `null`; `"kind|id"` nicht in `authorized` ⇒ `null`; `r = refs.refFor(entity.kind, entity.id)`; `r` kein String oder `!PLAYER_REF_PATTERN.test(r)` ⇒ `null`; sonst `r`. `toJSON` wirft `TypeError`. Kein Zustand außer der aus `authorized` gebildeten Schlüsselmenge. Ausnahmen aus `refFor` werden nicht gefangen (trusted Port, wie MYST-0004).

### 5.4 `interrogate(input)` — normative Reihenfolge

1. **Bindung** (alle ⇒ `BINDING_MISMATCH`): `catalogue.caseId/truthHash` = Truth; `profile.caseId/truthHash` = Truth; `profile.catalogueHash === hashQuestionCatalogue(catalogue)`; `profile.npcId === snapshot.npcId`; `refs.caseId/truthHash` = Truth; `projectNpcKnowledgeWithBridge(snapshot, truth, solution)` erfolgreich.
2. **Frage**: `questionId` ist ein String und gleich `rules[i].questionId` einer Regel des Profils ⇒ Regel; sonst `QUESTION_NOT_AVAILABLE`.
3. **Askability**: jede Entität aus `mentions(question) ∪ {person:npcId}` ist in `known` (Vergleich `kind|id`) ⇒ weiter; sonst **derselbe** `QUESTION_NOT_AVAILABLE` (kein eigener Code: sonst Existenzorakel über erratbare Slugs).
4. **NPC-Ref**: `npc = refs.refFor("person", npcId)`; kein String oder `PLAYER_REF_PATTERN` verfehlt ⇒ `REF_UNAVAILABLE`. Gilt für alle Observation-Arten.
5. **Decline**: `act === "decline"` ⇒ Observation `decline`. Der epistemische Zustand wird dafür nie gelesen.
6. `target = bridge.visibleClaimOf(rule.claim)`; `decision = decideResponse(context, target)`.
7. `does_not_know` ⇒ Observation ohne `statement`/`mentions`.
8. `translator = createReleaseTranslator(bridge, refs, [...question.mentions, {person,npcId}, ...rule.reveal])`. `statement` wird **aus `decision.claim`** feldweise neu aufgebaut, jedes Ref über `translator.translate`; ein `null` ⇒ `REF_UNAVAILABLE` (keine Teilantwort). Zwei verschiedene Entitäten (Statement-Entitäten und NPC zusammen) mit derselben Ref ⇒ `REF_UNAVAILABLE` (Injektivität, wie MYST-0004). `mentions` = die verschiedenen Entitäten des Statements als `{kind, ref}`, aufsteigend nach `ref` (UTF-16). Wegen R1 sind das genau die autorisierten Entitäten, die im Statement vorkommen; nur durch `reveal` autorisierte Entitäten erscheinen hier zum ersten Mal.
9. Ergebnis neu konstruiert und tief eingefroren. Fehlerobjekte sind modulweit konstante, eingefrorene Objekte (ein Objekt je Code).

`interrogate` liest nie: `proposition.truth`, Resolutions, `requiredConclusions`, Secrets, RedHerrings, Motives, Relationships, Namen, Beschreibungen, Provenance, `acquiredAt`, `asOf`. Kein Verlauf, keine Zeit, kein Zufall.

### 5.5 Öffentliche API (vollständig)

`RESPONSE_STANCES`, `ResponseStance`, `PLAYER_REF_PATTERN`, `PlayerRefTranslator`, `PlayerClaim`, `InterrogationObservation`, `InterrogationResult`, `ResponseDecision`, `decideResponse`, `ReleaseTranslator`, `createReleaseTranslator`, `InterrogationInput`, `interrogate`. Keine weiteren Exporte. Keine modulweiten veränderlichen Werte, keine `WeakMap`/`WeakSet`/`WeakRef`, keine Symbole, kein `localeCompare`.

Trusted-only: `createReleaseTranslator` und die Bridge sind für Host-Code und Tests; sie dürfen nie an Spieler-, UI- oder Persistenzschichten gelangen.

## 6. Grenze zur Session (VS-5)

Persistiert wird ausschließlich `{ type: "ask", npc: PlayerRef, questionId }`. Beim Replay: `npc` über MYST-0001 (`resolvePlayerRef`) auflösen, Snapshot/Profil aus dem Paket, `known` aus dem Log-Präfix, Port aus dem `PlayerRefIndex`, `interrogate`. Spielerwissen wächst nur um `observation.mentions` (dieselbe Regel wie für MYST-0004-Evidence-Observations). `QUESTION_NOT_AVAILABLE` wird nicht geloggt; `BINDING_MISMATCH`/`REF_UNAVAILABLE` sind Hostfehler und dürfen nie an Spieler. Das Paket muss eine Snapshot-Identität binden (auf `baseCommit` fehlt ein Snapshot-Hash; nicht Teil dieses Tasks).

## 7. Acceptance Criteria

| ID | Kriterium |
|---|---|
| AC-01 | Diff exakt `scope.create` + `scope.modify`. |
| AC-02 | `npm run typecheck`, `npm test` grün; alle bestehenden Projektionstests unverändert grün. |
| AC-03 | Exporte/Imports exakt §2, §4.1, §5.5. |
| AC-04 | Bridge-Semantik §4.2 inkl. Differentialtest gegen `projectNpcKnowledge`. |
| AC-05 | Stance-Tabelle §5.2 für alle 7 Stance-Belegungen plus fehlende Attitude. |
| AC-06 | Reihenfolge §5.4; genau drei Fehlercodes; ein Spielerfehlercode. |
| AC-07 | Observation enthält nie kanonische IDs, VisibleRefs, Indizes, Stance-Art, Provenance, Zeit, `SPOILER`. |
| AC-08 | Metamorphe Invarianten: knowledge↔belief, Provenance/acquiredAt, Awareness-Menge, unbefragte Attitudes, Eingabe-Reihenfolgen. |
| AC-09 | Bridge und Translator nicht serialisierbar (`JSON.stringify` wirft, `structuredClone` wirft). |
| AC-10 | Determinismus: wiederholte und permutierte Aufrufe bytegleich; kein Zustand. |
| AC-11 | Keine Eingabe mutiert; kein Ergebnisobjekt mit einer Eingabe geteilt; Ergebnisse tief eingefroren. |
| AC-12 | Testmatrix §8 vollständig; Mutanten §9 getötet; Limits §2. |
| AC-13 | Typecheck-Datei: `InterrogationObservation` enthält kein Feld vom Typ `VisibleRef`; die `decline`-Variante hat kein `stance`; `ResponseStance` hat exakt 6 Literale; `InterrogationInput` verlangt gebrandete `QuestionCatalogue`/`InterrogationProfile`/`NpcKnowledgeSnapshot`; die drei gemeinsamen `PlayerClaim`-Varianten sind strukturell identisch mit MYST-0004. |

## 8. Testmatrix (verbindlich)

| # | Fall | Erwartung |
|---|---|---|
| B-01 | **true knowledge** `ben-in-library` | `affirms`, Statement `personAt(pr(ben), pr(library), 300)` |
| B-02 | **false knowledge** `anna-in-library` | `denies` |
| B-03 | **true belief** (Anna-NPC, `ben-at-library` belief true) | `affirms`, bytegleich zu B-01 bis auf `npc` |
| B-04 | **false belief** (objektiv falsch) `anna-in-killing` | `affirms` |
| B-05 | belief false (Variante: Dora belief false auf `ben-in-killing`) | `denies` |
| B-06 | **uncertain leaning true** `ben-in-killing` | `leans_affirms` |
| B-07 | **uncertain leaning false** `knife-used` | `leans_denies` |
| B-08 | **uncertain neutral** `argument-caused-killing` (Conclusion) | `uncertain`, Statement `eventCausedEvent` |
| B-09 | **absent attitude** `ben-planned` | `does_not_know`, kein `statement`, kein `mentions` |
| B-10 | **conclusion belief** `ben-responsible` belief false | `denies` |
| B-11 | **Evidence awareness** Dora sieht `bloody-knife`; Frage `bloody-knife` | `decline`; Observation ohne Evidence-Bezug |
| B-12 | Evidence-Awareness entfernt | alle 11 Observations bytegleich |
| B-13 | **unknown person** `questionId: "question:nobody"` | `QUESTION_NOT_AVAILABLE` |
| B-14 | Nicht-String `questionId` (Zahl, Objekt, `null`) | `QUESTION_NOT_AVAILABLE`, kein Echo |
| B-15 | **player-known, NPC-unknown** `anna-in-garden` (Dora sieht Garten nicht) | `does_not_know` |
| B-16 | **NPC-known, player-unknown** `known` ohne `library`; Frage `ben-in-library` | `QUESTION_NOT_AVAILABLE` |
| B-17 | **explicit entity reveal** `where-was-ben`, `known` ohne `library` | `affirms`, `mentions` = `[{person, pr(ben)}, {location, pr(library)}]` (nach `ref` sortiert) |
| B-18 | Reveal bei `does_not_know` (Regel-Claim ohne Attitude, mit Reveal) | kein Statement, keine `mentions` |
| B-19 | Reveal bei `decline` | keine Freigabe |
| B-20 | **forbidden reveal** Translator mit `authorized` ohne `library`, Ref = `library` aus dem Statement | `translate` → `null` (Laufzeitverteidigung; über `interrogate` mit geparsten Dokumenten unerreichbar) |
| B-21 | **repeated question** 3× | bytegleich, keine Zustandsänderung |
| B-22 | Fragereihenfolge permutiert (alle 11) | Menge der Observations identisch |
| B-23 | **multiple NPCs** Anna und Dora, gleiche Frage | unabhängig, je korrekt |
| B-24 | **context A ref in context B** Translator(Dora) mit Ref-Objekt aus Annas Projektion (gleiches `{kind,index}`) | `null` |
| B-25 | JSON-Kopie eines eigenen Refs | `entityOf` → `null` |
| B-26 | Statement-Ref (`proposition`) an `entityOf` | `null` |
| B-27 | **stale projection** Bridge aus Snapshot-Rev. 1, Ref aus Rev. 2 | `null` |
| B-28 | **reordered projection** Awareness/Attitudes im Snapshot permutiert | identische Observations |
| B-29 | **changed NPC snapshot** `ben-at-library` knowledge→uncertain(true) | `leans_affirms` statt `affirms`; Profil unverändert gültig |
| B-30 | Snapshot anderer NPC als Profil | `BINDING_MISMATCH` |
| B-31 | **changed Truth** (Name geändert) mit altem Katalog | `BINDING_MISMATCH` |
| B-32 | **changed Solution** Snapshot an alte Solution gebunden | `BINDING_MISMATCH` |
| B-33 | Changed Truth, alle Dokumente neu gebunden | Observations gleich bis auf PlayerRef-Strings (über Index rückgeführt identisch) |
| B-34 | Port mit `truthHash` einer anderen Truth | `BINDING_MISMATCH` |
| B-35 | **speaking IDs** JSON aller Observations | kein kanonisches Präfix, kein `SPOILER`, kein `"index"`, kein `knowledge`/`belief`/`provenance`/`acquiredAt` |
| B-36 | knowledge ↔ belief (gleiche Polarität) metamorph | bytegleich |
| B-37 | provenance/acquiredAt metamorph | bytegleich |
| B-38 | unbefragte Attitude hinzugefügt | alle bisherigen Observations bytegleich |
| B-39 | Proposition-Truth-Wert geflippt (ohne knowledge darauf), neu gebunden | Observations rückgeführt identisch |
| B-40 | **response determinism** zwei getrennte, wertgleiche Eingabesätze | JSON-bytegleich, Schlüsselreihenfolge exakt §5 B-Contract |
| B-41 | **input mutation** alle Eingaben vor/nach `interrogate` | deep-equal, keine Objektteilung Result↔Eingabe |
| B-42 | **deep freeze** Observation, Fehlerobjekt, Bridge, Translator | eingefroren; `JSON.stringify(bridge)` und `(translator)` werfen `TypeError` |
| B-43 | Differential: `projectNpcKnowledgeWithBridge(...).context` vs. `projectNpcKnowledge(...).context` über alle Projektions-Fixtures | deep-equal und JSON-gleich |
| B-44 | `visibleClaimOf` mit Alias-Claim (`ben-seen-in-library`-Form, andere Property-Reihenfolge) | matcht dieselbe Attitude wie B-01 |
| B-45 | Snapshot ohne Solution (`solution: null`, `solutionHash: null`), Frage `ben-responsible` | `does_not_know` (keine Conclusion-Attitudes möglich) |
| B-46 | NPC selbst nicht in `known` | `QUESTION_NOT_AVAILABLE` |
| B-47 | Fehlerobjekte aus B-13, B-14, B-16, B-46 | jeweils deep-equal `{ success: false, code: "QUESTION_NOT_AVAILABLE" }`, eingefroren, ohne weitere Felder |
| B-48 | Port leakt: `refFor = (k, id) => id` bzw. `→ "ben"` bzw. Großbuchstaben/falsche Länge | `REF_UNAVAILABLE`, kein Teilergebnis |
| B-49 | Port nicht injektiv (konstante gültige Ref) bei `ben-in-library` | `REF_UNAVAILABLE` |
| B-50 | Port liefert `null` für `library` | `REF_UNAVAILABLE` |

## 9. Mutationsanker und Mutanten

`\|` in Tabellenzellen steht für `|` im Code.

Anker (je genau einmal, wörtlich):

| Datei | Anker |
|---|---|
| `npc-knowledge.projection.ts` | `const entity = emitted.get(ref);` |
| `interrogation.ts` | `return stance.value ? "affirms" : "denies";` |
| `interrogation.ts` | `if (decision.stance === "does_not_know")` |
| `interrogation.ts` | `if (!authorizedKeys.has(key)) return null;` |
| `interrogation.ts` | `if (typeof r !== "string" \|\| !PLAYER_REF_PATTERN.test(r)) return null;` |

| Mutant | Änderung | Getötet durch |
|---|---|---|
| B-M1 | knowledge und belief unterschiedlich abgebildet (z. B. belief → `leans_*`) | B-03, B-36 |
| B-M2 | Leaning ignoriert (uncertain immer `uncertain`) | B-06, B-07 |
| B-M3 | Statement/Mentions auch bei `does_not_know` aus `rule.claim` freigegeben | B-09, B-18 |
| B-M4 | `entityOf` per Wert über `indexOf` statt Identität | B-24, B-25, B-27 |
| B-M5 | Translator ohne `authorized`-Prüfung | B-20 |
| B-M6 | `rule.reveal` nicht in `authorized` aufgenommen | B-17 |
| B-M11 | Port-Rückgabe ungeprüft (Form/Injektivität) | B-48, B-49 |
| B-M7 | Askability-Prüfung entfernt | B-16 |
| B-M8 | eigener Code `QUESTION_NOT_ASKABLE` | B-16, B-47 |
| B-M9 | Claim-Matching nur über `kind` und erstes Ref-Feld | B-04 |
| B-M10 | Bridge-Aufzeichnung verändert den Kontext (z. B. zusätzliches Feld am Ref) | B-43, bestehende Projektionstests |

## 10. Non-Goals

- Keine Lügen/Täuschung (`invert`, `feign_ignorance`, Stance-Override), keine Deception-Schicht.
- Kein Gesprächszustand, keine Wiederholungsreaktion, keine Konfrontation, kein Fragetext, keine Verbalisierung.
- Keine Session, kein Paket, kein Snapshot-Hash, keine Persistenz, keine Awareness-Fragen.
- Keine Änderung an `npc-knowledge.ts`, an Authoring- oder PlayerRef-Modulen, `package.json`, Lockfile, `tsconfig.json`.

## 11. Developer-Abschluss

Diff-Statistik (Limits §2, Netto-Delta der Projektionsdatei separat), Ausgabe `npm run typecheck`/`npm test`, Mutantenprotokoll B-M1…B-M11, Differentialtest-Ergebnis.

<!-- END OF CONTRACT MYST-0005B v1 -->
