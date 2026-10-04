# MYST-0005 INTERROGATION PACKAGE — Interrogation & Release V1

Stand: 2026-10-03, Architektur- und Contract-Preflight. **Read-only**: kein Commit, kein Branch, kein PR, keine Änderung im Repository.
Repository: `Forge-Dice/Forge`, `main` = `3d7545d843883418348004e68717399a64da7a7d` (selbst per `git fetch` geprüft).
Begleitdateien in diesem Ordner:

- `MYST-0005A-INTERROGATION-AUTHORING-V1.contract.DRAFT.md` (Format 1, parst auf `main`)
- `MYST-0005B-INTERROGATION-RELEASE-V1.contract.DRAFT.md` (Format 1, parst auf `main`; startblockiert bis MYST-0005A akzeptiert ist)

Pipeline, die dieses Paket entwirft:

```
Spieler wählt (npc PlayerRef, questionId)            ← VS-5 Session, persistiert nur das
  → trusted: NpcKnowledgeSnapshot + Truth + Solution
  → Projection (TASK-0004) mit Bridge-Capability      ← einmal pro Frage, transient
  → deterministische Policy (authored act + Stance)   ← reine Funktion, nur sichtbarer Kontext
  → Release-Translator VisibleRef → PlayerRef         ← nur explizit autorisierte Refs
  → InterrogationObservation (nur PlayerRefs, questionId, Stance-Enum)
```

---

## 1. Current State

### 1.1 Klassifikation (geprüft an `3d7545d`, TASK-0005-Branch `codex/mystery-task-0005` @ `0453f85`)

| Baustein | Status | Ort / Beleg |
|---|---|---|
| `CaseTruth` (Claims `personAt`, `eventHasParticipant`, `eventHasItem`; Propositionen mit `truth`; Evidence, Secrets, RedHerrings) | **IMPLEMENTED** | `src/domain/case-truth.ts` |
| `CaseSolution` (6 Conclusion-Claim-Arten, Resolutions, Required) | **IMPLEMENTED** | `src/domain/case-solution.ts` |
| `NpcKnowledgeSnapshot` (awareness, attitudes knowledge/belief/uncertain, provenance, acquiredAt; knowledge faktiv; Conclusions nie knowledge) | **IMPLEMENTED** | `src/domain/npc-knowledge.ts` |
| `projectNpcKnowledge` → `NpcVisibleContext` mit `VisibleRef {kind,index}` | **IMPLEMENTED** | `src/domain/npc-knowledge.projection.ts` |
| `AwarenessSubjectSchema` (5 Entitätsarten) exportiert | **IMPLEMENTED** | `npc-knowledge.ts` |
| TASK-0005 v2 „Deterministic NPC Dialogue Policy“ (Claim-Query, Runtime-Policy mit `invert`/`feign_ignorance`, WeakSet-Herkunftsprüfung, `CommunicativeAct` mit `commitment`) | **HISTORICAL CONTRACT** (nur Branch, nie implementiert; Review `forge/reviews/TASK-0005.architecture-review.md` auf `main` + APPROVE `be40a68`) | `git show origin/codex/mystery-task-0005:forge/contracts/TASK-0005.md` |
| VS-4 „NPC Interrogation Adapter“ (`NpcDialogueProfile`, Handle-Tabelle, Statement mit Domain-IDs) | **DESIGN ONLY** | `MYSTERY-VERTICAL-SLICE-ROADMAP.md` §VS-4 |
| PlayerRef V1 (`buildPlayerRefIndex`, `playerRefFor`, `resolvePlayerRef`) | **DESIGN ONLY** (Draft, Format 2, nicht registrierbar auf `main`) | `MYST-0001-PLAYERREF-V1.contract.DRAFT.md` |
| Evidence Access (MYST-0003), Accusation (MYST-0002) | **DESIGN ONLY** (Drafts) | `forge-audits/` |
| MYST-0004 Evidence Presentation & Release | **DESIGN ONLY** (Draft des parallelen Threads; nach Fertigstellung gelesen und angeglichen, H-9) | `MYST-0004-EVIDENCE-PRESENTATION-*.md` |
| `npc-dialogue-policy.ts`, Fragekatalog, Policy-/Release-Authoring, VisibleRef↔PlayerRef-Bridge, Snapshot-Hash, Session | **MISSING** | kein Branch enthält sie |

### 1.2 Probe-Fakten (Scratch-Kopie von `main`, `npm ci`, verworfen)

| # | Fakt | Folge für MYST-0005 |
|---|---|---|
| P1 | `CaseTruth` erlaubt strukturell identische Claims unter verschiedenen Proposition-IDs (Fixture `ben-at-library` / `ben-seen-in-library`: 6 Propositionen, 5 Claim-Schlüssel). | Antwortsuche muss **strukturell über den Claim** matchen, nicht über die Proposition-ID. |
| P2 | `knowledge` mit Wert ≠ objektiver Wahrheit wird vom Parser abgelehnt (faktiv). | Jede spielersichtbare Unterscheidung knowledge/belief ist ein **Wahrheitsorakel** (§3.2). |
| P3 | Zwei Projektionen derselben Truth: Annas `{person,2}` = Ben, Bens `{person,2}` = Clara. Werte identisch, Referenten verschieden. | Wertbasierte VisibleRef-Übersetzung über Projektionsgrenzen ist falsch. Bindung muss an die Projektion (§7). |
| P4 | Indizes sind Rang in der UTF-16-Sortierung der für den NPC sichtbaren kanonischen IDs. | Ein Index ist selbst ein Seitenkanal (Rang, Mengengröße). VisibleRefs dürfen nie zum Spieler. |
| P5 | Ein eingefrorenes Objekt nur aus Funktionen: `JSON.stringify` → `"{}"`, `structuredClone` → `DataCloneError`. | Capability-Objekte brauchen ein explizites `toJSON`, das wirft; sonst wird „{}“ still persistiert. |
| P6 | Gleiches Snapshot zweimal projiziert → bytegleich. Weil Indizes Ränge in der sortierten Sichtbarkeitsmenge sind, verschiebt jede neu sichtbare Entität, die früher sortiert, alle späteren Indizes ihrer Art (aus dem Algorithmus, Schritt 4–5 in `projectNpcKnowledge`). | Projektionen sind nicht stabil über Snapshot-Revisionen → nie persistieren, pro Frage neu bilden. |
| P7 | Dasselbe Entity erscheint im Kontext als **verschiedene** Objekte (`awareness[i] !== attitudes[j].claim.person`), alle eingefroren. | Identitätsprüfung muss alle von der Projektion erzeugten Objekte kennen, nicht „das eine“. |
| P8 | Dora-Fixture (§11) parst und projiziert: Evidence-Awareness (`evidence:bloody-knife`) und `event:argument` (nur über Claim) sind im Kontext sichtbar. | Sichtbar ≠ freigegeben: beides darf nie in eine Observation, außer als autorisierter Claim-Ref. |

### 1.3 ID-Drift

Der `OVERNIGHT-EXECUTION-PLAN` führte Interrogation als **MYST-0004** und Case Package als MYST-0005. Seb hat nun MYST-0004 = Evidence Presentation & Release und MYST-0005 = Interrogation & Release festgelegt. Folge: Package/Session/Replay rücken auf MYST-0006+ (Owner-Entscheidung OE-M5-8). Dieses Paket verwendet **MYST-0005A/B** (gültig für `TaskIdSchema` `^[A-Z][A-Z0-9]*(-[A-Z0-9]+)+$`).

---

## 2. Question Model

### 2.1 Prüfung der fünf Kategorien

| Kategorie | Bewertung |
|---|---|
| `ask_about_person/location/event/evidence` | Offene Themenfragen. Ohne Zusatzregel müsste die Engine aus mehreren Attitudes **auswählen** (Ordnung, Menge, Priorität) und würde dabei unbefragte Attitudes freigeben. Vier Kategorien unterscheiden sich nur im Typ des erwähnten Entities, nicht in der Semantik. |
| `ask_about_claim` | Ja/Nein-Frage zu genau einem Claim. Sauber, aber kann **nie** etwas Neues zeigen (alle Claim-Refs stehen schon in der Frage) → Abschnitt 8 wäre unmöglich. |

**Ergebnis: keine fünf Kategorien. Eine einzige statement-basierte Struktur in zwei Teilen:**

1. **Frage (Katalog, fallweit):** `{ id: QuestionId, mentions: EntityRef[] }` — nur, *welche* Entitäten die Frage erwähnt. Das ist zugleich die Askability-Bedingung (alle `mentions` müssen dem Spieler bekannt sein). Text/Formulierung ist Präsentation, nicht Domain.
2. **Regel (NPC-Profil):** pro Frage, die dieser NPC gestellt bekommen kann, *genau ein* adressiertes Statement (`claim`, Domain-IDs, 9 Claim-Arten) plus explizite `reveal`-Liste — oder `decline`.

„Ja/Nein“ ist der Spezialfall `claimRefs(claim) ⊆ mentions ∪ {npc}`; „offen“ (Wo war Ben?) ist `mentions = [ben]` mit Claim `personAt(ben, library, 300)` und `reveal = [library]`. Kategorien sind höchstens UI-Gruppierung über `mentions[*].kind`.

### 2.2 Warum der Claim in der Regel und nicht in der Frage steht

Dieselbe Frage („Wo war Ben um 300?“) adressiert bei Dora einen anderen Claim als bei Anna. Steckt der Claim in der Frage, sind offene Fragen unmöglich; steckt er nur in der Regel, ist er autorenseitig, versioniert und nie spielergesteuert. Kein Freitext, kein NLU, keine vom Spieler zusammengesetzten Claims (TASK-0005 erlaubte genau das, mit 550 Zeilen Herkunftsprüfung als Folge).

### 2.3 Bewusst nicht in V1

Awareness-Fragen („Kennst du X?“), Mehrfach-Statements pro Antwort, Folgefragen, Konfrontation mit Evidence, Wiederholungsreaktionen. Awareness bleibt vollständig verborgen (§10).

---

## 3. Response Semantics

### 3.1 Spielerseitige Stance (`ResponseStance`, geschlossen, 6 Werte)

| NPC-Zustand zum adressierten Claim (strukturelles Match) | `stance` | Statement freigegeben? |
|---|---|---|
| knowledge `true` | `affirms` | ja |
| belief `true` | `affirms` | ja |
| knowledge `false` | `denies` | ja |
| belief `false` | `denies` | ja |
| uncertain, leaning `true` | `leans_affirms` | ja |
| uncertain, leaning `false` | `leans_denies` | ja |
| uncertain, leaning `null` | `uncertain` | ja |
| keine Attitude (oder Claim-Entity für NPC unsichtbar) | `does_not_know` | **nein** |

Plus der Policy-Act `decline` (keine Stance, kein Statement). `decline` ist Zurückhaltung, keine Stance.

### 3.2 Befund: TASK-0005-`commitment` ist ein Wahrheitsorakel

TASK-0005 v2 §10/§11 gibt `assert` mit `commitment: "unqualified"` (aus knowledge) bzw. `"belief"` aus. Da knowledge faktiv ist (P2), gilt: `unqualified` ⇒ Claim objektiv so. Ein Spieler, der `unqualified` sieht, liest die Wahrheit ab. **MYST-0005 kollabiert knowledge und belief** auf `affirms`/`denies`. Ein objektiv falscher Belief wird ehrlich und ununterscheidbar von Wissen behauptet; genau das macht Zeugenaussagen fehlbar.

### 3.3 Leaning

Leaning bleibt (`leans_*`), weil es subjektiv und nicht faktiv ist (der Parser koppelt `uncertain.leaning` nicht an die Wahrheit). Ohne Leaning ginge autorierter Inhalt verloren („Ich glaube schon, bin mir aber nicht sicher“).

### 3.4 Was eine Stance dennoch verrät

`uncertain` vs. `does_not_know` verrät, dass der NPC eine modellierte Haltung hat. Das ist beabsichtigter, ehrlicher Inhalt, kein Leck. Es verrät nie die Stance-Art, Provenance oder Zeit.

---

## 4. Lie Boundary

V1 hat **keine Täuschungsschicht**. Festgelegt:

1. Keine Aktion `invert`, kein `feign_ignorance`, kein Stance-Override im Profil. Das Profil kann nur `answer` (ehrlich nach §3.1) oder `decline`.
2. Ein NPC mit knowledge `true` kann in V1 den Claim **nicht** verneinen; mit knowledge/belief jeglicher Art kann er nicht `does_not_know` sagen.
3. `does_not_know` entsteht ausschließlich, wenn zur adressierten Claim-Struktur keine Attitude existiert.
4. `decline` ist von `does_not_know` beobachtbar verschieden und entscheidet sich **allein** aus dem Profil (nie aus dem epistemischen Zustand). Damit entfällt der J1/B1-Kanal aus dem TASK-0005-Review strukturell: ein `decline` beweist keine Attitude.
5. Irreführung in V1 geht nur über **falsche Beliefs** (ehrlich geäußert) und über autorenseitige Auswahl, welche Fragen ein NPC beantwortet.
6. Eine spätere Deception-Schicht (eigene Task-ID) kann die TASK-0005-Entscheidungstabelle (`invert` nur auf knowledge/belief, `feign_ignorance` nur unter answer) wiederverwenden. Sie muss dann `ResponseStance` *unverändert* lassen (Lüge = andere Stance aus demselben Enum), damit Sessions und Saves kompatibel bleiben.

**Konsequenz für die Roadmap:** `MYSTERY-VERTICAL-SLICE-ROADMAP.md` §7.5/§8 (Ben lügt per `invert`, `feign_ignorance`) ist in V1 nicht darstellbar. Das Beispiel muss neu autoriert werden (Ben `decline`t zur Tat; Ben hat einen falschen Belief über Anna). Der Solvability-Witness W7 („Lüge ist kein gültiges Zitat“) wird in V1 zu „falscher Belief ist kein gültiges Zitat“ (OE-M5-1).

---

## 5. Persistent Authoring (MYST-0005A)

Zwei unveränderliche, gebundene, gehashte Dokumente. Keine Runtime-Objekte, keine Funktionen, keine WeakSet-/Objektidentität, keine VisibleRefs.

### 5.1 `QuestionCatalogue` (einmal pro Fall)

```ts
{
  schemaVersion: 1,
  caseId: CaseId,
  truthHash: Sha256,           // = hashCaseTruth(truth)
  revision: positive int,
  questions: { id: QuestionId /* "question:<slug>" */, mentions: EntityRef[] /* ≥1, eindeutig */ }[]  // ≥1, id eindeutig
}
```

`EntityRef` = `AwarenessSubjectSchema` aus `npc-knowledge.ts` (person, location, item, event, evidence). Jede Mention muss in der Truth existieren.

### 5.2 `NpcInterrogationProfile` (einmal pro befragbarem NPC)

```ts
{
  schemaVersion: 1,
  caseId, truthHash,
  catalogueHash: Sha256,       // = hashQuestionCatalogue(catalogue)
  npcId: PersonId,
  revision: positive int,
  rules: (
    | { questionId, act: "answer", claim: StatementClaim, reveal: EntityRef[] }
    | { questionId, act: "decline" }
  )[]                          // darf leer sein; questionId eindeutig und im Katalog
}
```

`StatementClaim` = `ClaimSchema` ∪ `ConclusionClaimSchema` (9 disjunkte Arten, Domain-IDs, gegen die Truth referenzgeprüft).

Release-Regeln (Parse-Zeit, mit Pfaden):

- **R1 Abdeckung:** jede Entität in `claimRefs(claim)` liegt in `mentions(question) ∪ {npcId} ∪ reveal`. Sonst Issue an `["rules", i, "claim"]`.
- **R2 Reveal nur aus dem Claim:** jedes `reveal[j]` liegt in `claimRefs(claim)`. Sonst `["rules", i, "reveal", j]`.
- **R3 Reveal ist neu:** `reveal[j]` liegt nicht in `mentions ∪ {npcId}`. Sonst `["rules", i, "reveal", j]`.
- **R4** `reveal` eindeutig.

Bewusst **nicht** gebunden: `solutionHash`, Snapshot-Revision. Das Profil bleibt gültig, wenn sich das Wissen des NPC ändert; die Antworten ändern sich dann deterministisch. Regeln auf Claims ohne Attitude sind erlaubt (→ `does_not_know`), damit das Profil keine Information über Attitudes trägt.

### 5.3 Identität

Eigene Profile `forge-interrogation-catalogue-c14n-v1` und `forge-interrogation-profile-c14n-v1`, Kanonisierung wie `forge-case-c14n-v1` (Schlüssel und **jedes** Array nach UTF-16 sortiert; in beiden Dokumenten sind alle Arrays Mengen). Hash = SHA-256 über `"<profil>\n<c14n>"`. Golden Vectors (Node + Python, identisch):

| Dokument | Hash |
|---|---|
| Fixture-Truth `case:library` (`tests/npc-knowledge.fixture.ts` `world()`) | `f445f3b4ea632409542d6db96438f06db81b823990a2402ca9387fbcf60a6657` |
| Fixture-Katalog (11 Fragen) | `8a72ee2d9ebacb0806d53fd2d064653c6da9bbdb51e1f7a19c8ab6bdf6fb9e0e` |
| Fixture-Profil Dora (11 Regeln) | `358a5f3945030d485778219aa1f1ec258507ed9034496743c050bd9e8b17b0e5` |

---

## 6. Transient Policy

### 6.1 Wiederverwendung aus TASK-0005

| TASK-0005 v2 | MYST-0005 |
|---|---|
| Engine erhält nur `NpcVisibleContext`, nie Truth/Solution/Snapshot | **übernommen** (`decideResponse(context, target)`) |
| Strukturelles Claim-Matching (Diskriminator + alle Felder, Refs als (kind,index), ohne Inferenz) | **übernommen** |
| Inhalt nur aus der passenden Attitude, nie aus der Query | **übernommen** (Statement wird aus `attitude.claim` übersetzt) |
| Höchstens eine Attitude pro Claim (TASK-0004-Duplikatregel) | **übernommen** als Dependency-Fakt |
| Feste Schlüsselreihenfolge, tiefes Einfrieren, keine Spreads | **übernommen** |
| Spielergebaute Visible-Queries + 5-stufige Origin-Pipeline + engine-lokale WeakSets für Query/Policy | **entfällt**: Spieler liefern nur `questionId`; Visible-Claims baut ausschließlich trusted Code über die Bridge. Kein fremder VisibleRef kann eintreten. |
| `invert`, `feign_ignorance`, `intent` | **entfällt** (§4) |
| `commitment: unqualified/belief` | **entfällt** (Orakel, §3.2) |
| Runtime-Policy-Dokument ohne Persistenz | **ersetzt** durch persistentes Profil (§5) + transiente Auswertung |
| `createDialoguePolicyEngine(context)` Objekt mit Schemas | **nicht sinnvoll**: ohne zustandsbehaftete Origin-Prüfung bleibt eine reine Funktion. Ein Engine-Objekt wäre Zustand ohne Zweck. |

### 6.2 `decideResponse(context, target)`

```ts
decideResponse(context: NpcVisibleContext, target: NpcVisibleClaim | null):
  { stance: "does_not_know"; claim: null } | { stance: Exclude<ResponseStance,"does_not_know">; claim: NpcVisibleClaim }
```

`target === null` (eine Claim-Entity ist für den NPC unsichtbar) ⇒ `does_not_know`. Sonst die eindeutige Attitude mit strukturell gleichem Claim; `claim` ist **das eingefrorene Objekt aus dem Kontext** (Identität bleibt für den Translator erhalten). `decline` erreicht `decideResponse` nie.

Getrennt bleiben: *persistent* = Katalog + Profil (Daten, Hash); *runtime* = Projektion, Bridge, `decideResponse`, Translator (Funktionen, pro Frage, verworfen).

---

## 7. PlayerRef Translator Capability

### 7.1 Untersuchte Designs

| | Design | Bewertung |
|---|---|---|
| **T1** | Modulweite `WeakMap<NpcVisibleContext, IdTable>`, befüllt in `projectNpcKnowledge` | **verworfen.** Versteckte globale Wahrheit, prozessweiter Zustand, Seb-Vorgabe. |
| **T2** | Neu-Ableitung der Handle-Tabelle im neuen Modul aus dem Snapshot (ROAD VS-4), gepinnt durch Differentialtest | Keine Änderung an TASK-0004, aber **dupliziert** den privaten Index-Algorithmus und `visibleClaim`. Bindung nur über Wertgleichheit: P3 zeigt, dass gleiche Werte andere Entitäten meinen. |
| **T3** | **Projektion prägt die Capability.** Neue Funktion im Projektionsmodul liefert `{context, bridge}` aus *demselben* Aufruf; die Bridge schließt über die aufruflokale `indexOf`-Tabelle und eine aufruflokale Menge der von genau dieser Projektion erzeugten Ref-Objekte. | Eine Quelle der Wahrheit (kein Duplikat), Bindung an genau eine Projektion, nichts Globales. Kosten: additive Änderung an einer TASK-0004-Datei. |
| **T4** | Versiegelte Pipeline: Projektion + Policy + Übersetzung in **einem** synchronen Aufruf; kein VisibleRef verlässt ihn | Stärkste Garantie (Fremd-Refs unmöglich per Konstruktion), aber allein kein testbares Capability-Objekt. |
| **T5** | VisibleRef um Projektions-Nonce erweitern | **verworfen.** Ändert TASK-0004-Typen, Nonce bricht Determinismus. |

### 7.2 Gewählt: T3 + T4

- `projectNpcKnowledgeWithBridge(snapshot, truth, solution)` (neu, in `npc-knowledge.projection.ts`) liefert `{ success, context, bridge }`. `projectNpcKnowledge` bleibt in Ein-/Ausgabe bytegleich.
- `bridge` (eingefroren, genau drei Member):
  - `visibleClaimOf(claim)` — Domain-Claim → sichtbarer Claim dieser Projektion, `null` wenn eine Entität unsichtbar ist. Nutzt die **privaten** `claimReferences`/`visibleClaim` des Moduls (kein Duplikat).
  - `entityOf(ref)` — kanonische Entität **nur** für Ref-Objekte, die diese Projektion selbst erzeugt hat (Identität), sonst `null`. Kopien, JSON-Roundtrips, Refs anderer Projektionen, Statement-Refs → `null`.
  - `toJSON()` — wirft `TypeError` (P5).
- `createReleaseTranslator(bridge, refs, authorized)` (MYST-0005B) liefert eingefroren `{ translate(ref): string | null, toJSON() /* wirft */ }`. `translate` = `bridge.entityOf(ref)` → muss in `authorized` liegen → `refs.refFor(kind, id)` → Rückgabe muss `PLAYER_REF_PATTERN` erfüllen. `refs` ist der strukturelle Port `PlayerRefTranslator { caseId, truthHash, refFor }`, **identisch zu MYST-0004**; VS-5 baut ihn aus dem MYST-0001-`PlayerRefIndex`. Damit ist MYST-0001 Laufzeit-, aber keine Implementierungsabhängigkeit.
- `interrogate(...)` erzeugt Projektion, Bridge und Translator **innerhalb eines Aufrufs** und gibt nur die Observation zurück (T4). Die Capabilities sind exportiert nur, damit sie direkt testbar sind; sie sind trusted-only.

Erfüllte Anforderungen: gültig für genau eine Projektion (Identitätsmenge pro Aufruf); nicht serialisierbar (`toJSON` wirft, `structuredClone` wirft); kanonische IDs nur innerhalb von `entityOf`/Translator; nur Refs aus `authorized` werden übersetzt. Die aufruflokale Identitätsmenge ist **keine** globale Bridge: sie wird pro Projektion erzeugt, ist nicht modulweit, ist nicht die Quelle der Abbildung (das ist `indexOf`) und wird nie persistiert.

---

## 8. Entity Reveal

**Ja**, eine autorisierte Aussage darf eine neue PlayerRef freigeben, aber nur **explizit pro Regel**:

```json
{ "questionId": "question:where-was-ben", "act": "answer",
  "claim": { "kind": "personAt", "personId": "person:ben", "locationId": "location:library", "at": 300 },
  "reveal": [ { "kind": "location", "id": "location:library" } ] }
```

- Ohne `reveal` scheitert das Profil-Parsing (R1): `library` ist weder erwähnt noch der NPC.
- `reveal` kann nichts außerhalb des Claims freigeben (R2) und nichts Bekanntes doppelt (R3).
- Release passiert nur bei `affirms/denies/leans_*/uncertain`. Bei `does_not_know` und `decline` wird **weder** Statement **noch** Reveal ausgegeben, also kein „Garten“ aus einer Nicht-Antwort.
- Die Observation trägt `mentions: {kind, ref}[]` (wie MYST-0004): genau die verschiedenen Entitäten des freigegebenen Statements, sortiert nach Ref. Wegen R1 sind das nur autorisierte Entitäten; eine nur per `reveal` autorisierte erscheint hier zum ersten Mal. VS-5 erweitert das Spielerwissen für **beide** Observation-Arten nach derselben Regel: `known += observation.mentions`. Eine nicht im Statement vorkommende Entität erscheint nie.
- Laufzeit-Verteidigung: Der Translator übersetzt nur `mentions ∪ {npc} ∪ reveal`; ein Ref außerhalb (für gültige Eingaben unerreichbar) ⇒ ganze Antwort `REF_UNAVAILABLE` (Code wie MYST-0004), nie eine Teilantwort. Ebenso, wenn der Port eine Rückgabe liefert, die kein gültiger PlayerRef ist oder nicht injektiv ist.

---

## 9. Determinism

| Szenario | Festlegung |
|---|---|
| Wiederholte Frage | Gleiche Eingaben ⇒ bytegleiche Observation. Kein Gesprächsspeicher, kein Zähler, keine Zeit. |
| Fragereihenfolge | Irrelevant: `interrogate` liest keinen Verlauf. Nur `known` hängt vom Verlauf ab und wird von VS-5 aus dem Log-Präfix abgeleitet (replaybar). |
| Mehrere NPCs | Unabhängig. Jede Frage projiziert genau einen Snapshot; Refs eines NPC sind in einem anderen unübersetzbar. |
| Geänderter Snapshot | Neue Antwort möglich (gewollt). Profil bleibt gültig. VS-5 muss die Snapshot-Identität ans Paket binden; **es gibt auf `main` keinen `hashNpcKnowledge`** → Hotspot H-6. |
| Unbekanntes Subject | Unbekannte/fremde/nicht-String-`questionId`, nicht gelistete Frage **und** nicht askbare Frage (Mention unbekannt) ⇒ derselbe eingefrorene Fehler `QUESTION_NOT_AVAILABLE`, kein Echo (sonst Existenzorakel über erratbare Slugs). |
| Umsortierte Eingaben | Katalog-, Regel-, Mention-, Reveal-, Awareness-, Attitude-Reihenfolge ändern weder Hash noch Observation. |

---

## 10. Information Flow (adversarial)

| Quelle | Kann sie in die Observation? | Garantie / Test |
|---|---|---|
| Objektive Wahrheit (`proposition.truth`) | nein | wird nie gelesen; Knowledge-Kollaps (§3.2); metamorph: knowledge↔belief gleicher Polarität ⇒ identische Observation |
| `CaseSolution` (Resolutions, Required) | nein | nur Conclusion-Claims über die Projektion; Required/Resolutions nie gelesen |
| Kanonische IDs | nein (außer der autorierten `questionId`) | Serialisierte Observation enthält keines der Präfixe `person:`, `location:`, `item:`, `event:`, `evidence:`, `proposition:`, `conclusion:`, `case:` und kein `SPOILER` |
| `VisibleRef`, Index, `asOf`, `self` | nein | Observation-Typ hat kein solches Feld; JSON enthält kein `"index"` |
| Stance-Art (knowledge/belief) | nein | 6-Wert-Enum |
| Provenance, acquiredAt | nein | metamorph: Ändern (gültig) ⇒ identische Observation |
| Versteckte Awareness (inkl. Evidence) | nein, und **ohne Einfluss** | metamorph: Awareness-Liste beliebig (gültig) ändern ⇒ identische Observation, weil jede Attitude-Entität ohnehin sichtbar ist |
| Unbefragte Attitudes | nein, **ohne Einfluss** | metamorph: weitere Attitudes hinzufügen ⇒ identische Observation |
| Secrets, RedHerrings, Motives, Relationships, Namen, Beschreibungen | nein | nie gelesen; Leak-Test mit `SPOILER`-Markern |
| Existenz einer Attitude via `decline` | nein | `decline` hängt nur am Profil (Mutant B-M2) |
| Existenz einer Entität via Fehler | nein | ein Fehlercode für alle Spielerfehler |
| Reihenfolge-Seitenkanal | nein | `mentions` nach PlayerRef sortiert (hashbasiert, nicht nach ID) |
| Autorenabsicht über Verfügbarkeit/`decline`-Wahl | **ja, bewusst** | ist Spieldesign, nicht Mechanik → Authoring-Leitfaden (H-4) |
| Sprechende `questionId` | **ja, wenn Autor schlecht benennt** | QuestionIds sind per Definition öffentlich (H-3) |

---

## 11. 50+ Test Matrix

79 Fälle. A = MYST-0005A, B = MYST-0005B. Fixture: `tests/npc-knowledge.fixture.ts` `world()` (Fall `case:library`, sprechende IDs, `SPOILER` in allen Texten). Katalog = 11 Fragen, Profil Dora = 11 Regeln (beide wörtlich im A-Contract §3.4). Dora-Snapshot und Erwartungstabelle im B-Contract §3.

| # | T | Fall | Erwartung |
|---|---|---|---|
| 1 | A | Fixture-Katalog parst | Erfolg, tief eingefroren, Hash `8a72ee2d…` |
| 2 | A | Fixture-Profil Dora parst | Erfolg, eingefroren, Hash `358a5f39…` |
| 3 | A | Katalog `caseId` falsch | Issue `["caseId"]`, keine Folge-Issues |
| 4 | A | Katalog `truthHash` falsch | Issue `["truthHash"]` |
| 5 | A | Doppelte `question.id` | Issue `["questions", j, "id"]` |
| 6 | A | Mention unbekannte Person | Issue `["questions", i, "mentions", k, "id"]` |
| 7 | A | Mention doppelt | Issue `["questions", i, "mentions", k]` |
| 8 | A | `mentions: []` | Issue (min 1) |
| 9 | A | Mention-Art `proposition` | Shape-Issue |
| 10 | A | QuestionId ohne Präfix / Großbuchstaben | Shape-Issue |
| 11 | A | Profil `catalogueHash` falsch | Issue `["catalogueHash"]` |
| 12 | A | Profil `npcId` unbekannt | Issue `["npcId"]` |
| 13 | A | Regel auf unbekannte `questionId` | Issue `["rules", i, "questionId"]` |
| 14 | A | Zwei Regeln gleiche `questionId` | Issue `["rules", j, "questionId"]` |
| 15 | A | Claim mit unbekannter Event-ID | Issue `["rules", i, "claim", "eventId"]` |
| 16 | A | `eventCausedEvent` Ursache = Ziel | Shape-Issue aus `ConclusionClaimSchema` |
| 17 | A | **Forbidden reveal:** `where-was-ben` ohne `reveal` | R1-Issue `["rules", i, "claim"]` |
| 18 | A | **Explicit reveal:** `where-was-ben` mit `reveal:[library]` | Erfolg |
| 19 | A | `reveal` enthält Entität außerhalb des Claims (`garden`) | R2 `["rules", i, "reveal", 0]` |
| 20 | A | `reveal` enthält erwähnte Entität (`ben`) | R3 `["rules", i, "reveal", 0]` |
| 21 | A | `reveal` enthält den NPC selbst | R3 |
| 22 | A | `reveal` doppelt | R4 |
| 23 | A | NPC selbst im Claim, nicht erwähnt (Dora fragt nach `personAt(dora,…)`) | Erfolg (implizit erlaubt) |
| 24 | A | `decline` mit Zusatzfeld `claim` | Shape-Issue (strict) |
| 25 | A | Regel auf Claim ohne passende Proposition/Conclusion | Erfolg (Claim muss nur referenzvollständig sein) |
| 26 | A | `rules: []` | Erfolg |
| 27 | A | Permutation aller Arrays (Fragen, Mentions, Regeln, Reveals) | identische Hashes |
| 28 | A | Property-Reihenfolge vertauscht | identische Hashes |
| 29 | A | Eingabe nach Parse mutiert | geparstes Dokument unverändert; Eingabe nicht mutiert |
| 30 | A | **Deep freeze** Katalog/Profil (jede Ebene) | `Object.isFrozen` überall |
| 31 | A | Golden Vectors Katalog/Profil | exakt §5.3 |
| 32 | A | Profil-Schema mit fremdem Katalog gebunden | Issue `["catalogueHash"]` |
| 33 | B | **true knowledge** `ben-in-library` | `affirms`, Statement `personAt(pr(ben), pr(library), 300)` |
| 34 | B | **false knowledge** `anna-in-library` | `denies` |
| 35 | B | **true belief** (Anna-NPC, `ben-at-library` belief true) | `affirms`, bytegleich zu #33 bis auf `npc` |
| 36 | B | **false belief** (objektiv falsch) `anna-in-killing` | `affirms` |
| 37 | B | belief false (Variante: Dora belief false auf `ben-in-killing`) | `denies` |
| 38 | B | **uncertain leaning true** `ben-in-killing` | `leans_affirms` |
| 39 | B | **uncertain leaning false** `knife-used` | `leans_denies` |
| 40 | B | **uncertain neutral** `argument-caused-killing` (Conclusion) | `uncertain`, Statement `eventCausedEvent` |
| 41 | B | **absent attitude** `ben-planned` | `does_not_know`, kein `statement`, keine `mentions` |
| 42 | B | **conclusion belief** `ben-responsible` belief false | `denies` |
| 43 | B | **Evidence awareness** Dora sieht `bloody-knife`; Frage `bloody-knife` | `decline`; Observation ohne Evidence-Bezug |
| 44 | B | Evidence-Awareness entfernt | alle 11 Observations bytegleich |
| 45 | B | **unknown person** `questionId: "question:nobody"` | `QUESTION_NOT_AVAILABLE` |
| 46 | B | Nicht-String `questionId` (Zahl, Objekt, `null`) | `QUESTION_NOT_AVAILABLE`, kein Echo |
| 47 | B | **player-known, NPC-unknown** `anna-in-garden` (Dora sieht Garten nicht) | `does_not_know` |
| 48 | B | **NPC-known, player-unknown** `known` ohne `library`; Frage `ben-in-library` | `QUESTION_NOT_AVAILABLE` |
| 49 | B | **explicit entity reveal** `where-was-ben`, `known` ohne `library` | `affirms`, `mentions` enthält `pr(library)` |
| 50 | B | Reveal bei `does_not_know` (Regel-Claim ohne Attitude, mit Reveal) | kein Statement, keine `mentions` |
| 51 | B | Reveal bei `decline` | keine Freigabe |
| 52 | B | **forbidden reveal** Translator mit `authorized` ohne `library`, Ref = `library` aus dem Statement | `translate` → `null` (Laufzeitverteidigung; über `interrogate` mit geparsten Dokumenten unerreichbar) |
| 53 | B | **repeated question** 3× | bytegleich, keine Zustandsänderung |
| 54 | B | Fragereihenfolge permutiert (alle 11) | Menge der Observations identisch |
| 55 | B | **multiple NPCs** Anna und Dora, gleiche Frage | unabhängig, je korrekt |
| 56 | B | **context A ref in context B** Translator(Dora) mit Ref-Objekt aus Annas Projektion (gleiches `{kind,index}`) | `null` |
| 57 | B | JSON-Kopie eines eigenen Refs | `entityOf` → `null` |
| 58 | B | Statement-Ref (`proposition`) an `entityOf` | `null` |
| 59 | B | **stale projection** Bridge aus Snapshot-Rev. 1, Ref aus Rev. 2 | `null` |
| 60 | B | **reordered projection** Awareness/Attitudes im Snapshot permutiert | identische Observations |
| 61 | B | **changed NPC snapshot** `ben-at-library` knowledge→uncertain(true) | `leans_affirms` statt `affirms`; Profil unverändert gültig |
| 62 | B | Snapshot anderer NPC als Profil | `BINDING_MISMATCH` |
| 63 | B | **changed Truth** (Name geändert) mit altem Katalog | `BINDING_MISMATCH` |
| 64 | B | **changed Solution** Snapshot an alte Solution gebunden | `BINDING_MISMATCH` |
| 65 | B | Changed Truth, alle Dokumente neu gebunden | Observations gleich bis auf PlayerRef-Strings (über Index rückgeführt identisch) |
| 66 | B | PlayerRef-Index einer anderen Truth | `BINDING_MISMATCH` |
| 67 | B | **speaking IDs** JSON aller Observations | kein kanonisches Präfix, kein `SPOILER`, kein `"index"`, kein `knowledge`/`belief`/`provenance`/`acquiredAt` |
| 68 | B | knowledge ↔ belief (gleiche Polarität) metamorph | bytegleich |
| 69 | B | provenance/acquiredAt metamorph | bytegleich |
| 70 | B | unbefragte Attitude hinzugefügt | alle bisherigen Observations bytegleich |
| 71 | B | Proposition-Truth-Wert geflippt (ohne knowledge darauf), neu gebunden | Observations rückgeführt identisch |
| 72 | B | **response determinism** zwei getrennte, wertgleiche Eingabesätze | JSON-bytegleich, Schlüsselreihenfolge exakt §5 B-Contract |
| 73 | B | **input mutation** alle Eingaben vor/nach `interrogate` | deep-equal, keine Objektteilung Result↔Eingabe |
| 74 | B | **deep freeze** Observation, Fehlerobjekt, Bridge, Translator | eingefroren; `JSON.stringify(bridge)` und `(translator)` werfen `TypeError` |
| 75 | B | Differential: `projectNpcKnowledgeWithBridge(...).context` vs. `projectNpcKnowledge(...).context` über alle Projektions-Fixtures | deep-equal und JSON-gleich |
| 76 | B | `visibleClaimOf` mit Alias-Claim (`ben-seen-in-library`-Form, andere Property-Reihenfolge) | matcht dieselbe Attitude wie #33 |
| 77 | B | Port leakt kanonische ID / Slug / falsche Form | `REF_UNAVAILABLE`, kein Teilergebnis |
| 78 | B | Port nicht injektiv | `REF_UNAVAILABLE` |
| 79 | B | Port liefert `null` für eine Statement-Entität | `REF_UNAVAILABLE` |

---

## 12. VS-5 Interface

**Hypothese bestätigt, mit zwei Ergänzungen.**

Session-Event (persistiert, Log ist Wahrheit):

```ts
{ type: "ask", npc: PlayerRef, questionId: QuestionId }
```

Nicht persistiert: `VisibleRef`, `NpcVisibleContext`, Bridge, Translator, Policy-Entscheidung, kanonische IDs, Stance-Art, Snapshot-Inhalte.

Replay je Event: `resolvePlayerRef(index, npc, "person")` → `npcId` → `(snapshot, profile)` aus dem Paket → `known` aus dem Log-Präfix → `interrogate(...)` → Observation. Bytegleich, weil `interrogate` rein ist.

Ergänzungen:

1. **`known` ist Eingabe.** `interrogate` prüft `mentions ∪ {npc} ⊆ known` selbst (wie `resolveInvestigation` in MYST-0003). VS-5 liefert `known` als Domain-`EntityRef[]`, abgeleitet aus Briefing ∪ Evidence-Discovery/-Release (MYST-0003/0004) ∪ `observation.mentions` früherer Fragen (per `resolvePlayerRef` in Domain-Refs übersetzt, wie MYST-0004 §6 empfiehlt).
2. **Paketbindung.** Das spätere Paket muss binden: `truthHash`, `solutionHash`, `catalogueHash`, je NPC `profileHash` **und eine Snapshot-Identität**. Letztere fehlt auf `main` (H-6); VS-5A (Package) braucht `hashNpcKnowledge` oder eine Paket-Kanonisierung.

Abgelehnte Fragen (`QUESTION_NOT_AVAILABLE`) werden nicht geloggt. Gespeicherte Observations sind höchstens Cache und müssen beim Laden per Replay bytegleich reproduziert werden.

---

## 13. Implementation Split

Ehrliche Schätzung (Produktionszeilen inkl. Kommentare, an MYST-0003/TASK-0004-Stil gemessen):

| Teil | Zeilen |
|---|---|
| Katalog + Profil Schemas, gebundene Parser, R1–R4, `statementClaimReferences` | 170–200 |
| Identity (2 Profile, c14n, 2 Hashes) | 40–50 |
| Projektion: `projectNpcKnowledgeWithBridge`, Bridge, Typen (netto, additiv) | 35–50 |
| `decideResponse`, Translator, `PlayerClaim`-Aufbau (9 Arten), `interrogate`, Bindungsprüfungen, Typen | 180–220 |
| **Summe** | **≈ 425–520** |

**Nicht als ein Task unter 400.** Split in zwei Tasks:

| Task | Inhalt | Prod-Limit | Dependencies |
|---|---|---|---|
| **MYST-0005A** Interrogation Authoring V1 | Katalog, Profil, Release-Regeln R1–R4, Hashes | **≤ 260** | keine registrierten (Legacy TASK-0001/0003/0004 über `baseCommit`) |
| **MYST-0005B** Interrogation Release V1 | Bridge in der Projektion, `decideResponse`, Translator, `interrogate`, Observation | **≤ 280** (davon Projektionsdatei netto ≤ +50) | MYST-0005A (MYST-0001 nur zur Laufzeit, über den Port wie MYST-0004) |

Der Schnitt liegt an der natürlichen Naht *persistent vs. runtime*: A ist ohne PlayerRef vollständig test- und mergebar; B ist der einzige Task, der kanonische IDs und PlayerRefs gleichzeitig berührt.

---

## 14. Draft Contracts

| Datei | Format | `parseContractDocument` auf `3d7545d` | contentHash | Git-Blob |
|---|---|---|---|---|
| `MYST-0005A-INTERROGATION-AUTHORING-V1.contract.DRAFT.md` | 1 | `ok: true`, `dependencies: []` | `dc7c48f5221c19bdda449a8bf03ac1ecb2875b63dadf048b4b1f396c72b1aedf` | `7c3558c4…` |
| `MYST-0005B-INTERROGATION-RELEASE-V1.contract.DRAFT.md` | 1 | `ok: true`, `dependencies: [MYST-0005A → null]` | `621d94163b5035cf10cc81129ecbd4320ed34f7ba486320d2335f0fc5e5492c9` | `5824621e…` |

B trägt `dependencies: [{MYST-0005A, null}]`. Das ist absichtlich: `src/forge/state.ts:321` lehnt eine Architektur-Freigabe mit `acceptedCommit: null` als `DEPENDENCY_UNRESOLVED` ab. B kann erst freigegeben werden, wenn A akzeptiert ist und eine neue B-Revision den Commit einträgt (und `baseCommit` hebt). MYST-0001 ist dank des Ports keine Kernel-Dependency.

---

## 15. Review Hotspots

| ID | Hotspot | Empfehlung |
|---|---|---|
| H-1 | B ändert `npc-knowledge.projection.ts` (TASK-0004, akzeptierter Code). Die Bridge gibt kanonische IDs an trusted Code. | Additiv; `projectNpcKnowledge` unverändert; Differentialtest #75; Header-Kommentar der Datei um die Bridge ergänzen. Alternative T2 bleibt möglich (OE-M5-3). |
| H-2 | Identitätsmenge in der Bridge sieht wie das verbotene WeakMap-Muster aus. | Ist aufruflokal, nicht modulweit, nicht Quelle der Abbildung, nie persistiert (§7.2). Reviewer soll genau das prüfen (Mutant B-M4). |
| H-3 | `questionId` ist spielersichtbar und persistiert. Sprechende Slugs (`question:ben-is-killer`) spoilern. | QuestionIds sind öffentlich per Definition; Authoring-Leitfaden; optional späterer Lint. |
| H-4 | Verfügbarkeit pro NPC und `decline`-Wahl verraten Autorenabsicht. | Spieldesign-Verantwortung; Leitfaden „gleiche Fragen für alle befragbaren NPCs“. |
| H-5 | Knowledge-Kollaps verwirft die Unterscheidung „weiß“/„glaubt“, die das Roadmap-Beispiel nutzte. | Gewollt (§3.2). Spätere Stärke nur als autorierte, nicht faktive Angabe. |
| H-6 | Kein Snapshot-Hash auf `main`. | In VS-5A (Package) lösen, nicht hier. |
| H-7 | `PLAYER_REF_PATTERN` und `PlayerRefTranslator` sind in MYST-0004 und MYST-0005B je lokal definiert (bewusst, damit keiner vom anderen abhängt). | Nach Merge beider in ein gemeinsames Modul konsolidieren; ändert MYST-0001 das Ref-Format vor Annahme, müssen beide revidiert werden. |
| H-8 | TASK-0005 v2 (approved by Claude) wird durch MYST-0005 faktisch ersetzt. | Owner muss TASK-0005 als „superseded, Deception-Schicht später“ markieren (OE-M5-1). |
| H-9 | Angleichung an MYST-0004 (Datei lag nach Entwurf vor und wurde eingearbeitet): gleicher Port, gleiches Ref-Pattern, `mentions: {kind, ref}[]` nach Ref sortiert, Stance `affirms`/`denies`, Fehlercode `REF_UNAVAILABLE`, `PlayerClaim` für die drei Proposition-Claim-Arten strukturell identisch. Unterschied: MYST-0005-Observations haben keinen Freitext und eine 6-wertige Stance. | Reviewer prüft beide Contracts gemeinsam; Sebs Vorschlag `asserts` wurde für die Angleichung zu `affirms`. |
| H-10 | `ConclusionClaim`-Fragen ohne gebundene Solution: Profil bindet keine Solution. | Korrekt, weil Claims nur gegen die Truth referenzgeprüft werden; Snapshot ohne Solution hat keine Conclusion-Attitudes ⇒ `does_not_know`. Test in B. |

---

## 16. GO / NO-GO

| Gegenstand | Urteil |
|---|---|
| Architektur MYST-0005 (statement-basierte Fragen, 6-Wert-Stance, keine Lügen, T3+T4-Bridge, explizites Reveal, stateless) | **GO** |
| **MYST-0005A** Contract-Review und Registrierung | **GO** (keine Dependencies; nach Owner-Bestätigung OE-M5-1/2/4/6/7) |
| **MYST-0005B** Contract-Review | **GO** für Review |
| **MYST-0005B** Registrierung/Start | **NO-GO bis** MYST-0005A akzeptiert ist und eine neue B-Revision dessen `acceptedCommit` trägt; plus OE-M5-3 entschieden. Für echte Spielerausgabe zur Laufzeit braucht VS-5 außerdem MYST-0001. |
| TASK-0005 v2 als VS-3 implementieren | **NO-GO** (Orakel `commitment`, Lügen außerhalb V1; Reuse siehe §6.1) |

### Owner-Entscheidungen

| ID | Frage | Empfehlung |
|---|---|---|
| OE-M5-1 | V1 ohne Lügen; TASK-0005 v2 → „superseded“, Deception später; Roadmap-Beispiel neu autorieren | **ja** |
| OE-M5-2 | knowledge/belief spielerseitig kollabieren (6-Wert-`ResponseStance`) | **ja** |
| OE-M5-3 | Bridge in `npc-knowledge.projection.ts` (T3) statt Duplikat (T2) | **T3** |
| OE-M5-4 | QuestionIds sind öffentlich und werden persistiert | **ja** |
| OE-M5-5 | B nutzt den PlayerRef-Port wie MYST-0004 (statt harter MYST-0001-Abhängigkeit) | **ja** |
| OE-M5-6 | `decline` als einziger Policy-Act neben `answer` | **ja** |
| OE-M5-7 | Verfügbarkeit pro NPC = Regeln im Profil; nicht gelistete Fragen sind nicht stellbar | **ja** |
| OE-M5-8 | Package/Session/Replay auf MYST-0006+ umnummerieren | **ja** |

STOP. Keine Implementierung.
