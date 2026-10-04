# MYSTERY VERTICAL SLICE ROADMAP

Status: **Architektur-Entwurf, read-only.** Keine Implementierung, keine Commits, keine PRs, keine Task-IDs vergeben.
Stand: 2026-10-03. Repository: `Forge-Dice/Forge`, `main` = `3d7545d843883418348004e68717399a64da7a7d`.
Verifiziert auf `main`: `npm run typecheck` Exit 0, `npm test` 22 Dateien, **1087 Tests grün** (Lauf vom 2026-10-03, 23,9 s).

Ziel: der kürzeste Weg vom heutigen Domain-Modell zu einem **headless** vollständig durchspielbaren Mystery-Fall. Kein UI, keine Grafik, kein Runtime-LLM. Forge selbst wird hier nicht entworfen.

Grundlage sind ausschließlich der tatsächlich vorhandene Mystery-Code und die beiden vorliegenden Designs:

- `MYSTERY-TASK-0006-CANDIDATES.md` (Inventar, Kandidaten A/B/C, Roadmap 0006–0010)
- `MYSTERY-ACCUSATION-VERDICT-DESIGN.md` (`evaluateConclusionClaim`, Verdict-Semantik, offene Entscheidungen D1–D10)

Abweichungen von diesen Designs sind in jedem Abschnitt als **Abweichung** markiert und in Abschnitt 4.7 gesammelt.

Arbeitstitel statt Task-IDs: **VS-1 … VS-6**. Die Vergabe der IDs (insbesondere für Accusation & Verdict) bleibt offen.

---

## 1. Current Capability Map

### 1.1 Wo liegt was (Git, geprüft am 2026-10-03)

| Baustein | Lage | Commit / Blob | Zustand |
|---|---|---|---|
| TASK-0001 / 0001a CaseTruth | **main** | `27075fe`, `de5feb9` | implementiert, getestet |
| TASK-0002 Semantic Validator | **main** | `3169529` | implementiert, getestet |
| TASK-0003 CaseSolution | **main** | `5bfa5a4` | implementiert, getestet; `resolveConclusion` und `claimKey` **privat** |
| TASK-0004 v1 NPC Knowledge + Projection | **main** | `e9cb8e2`, M1-Testfix als Cherry-Pick `e5764ee` | implementiert, getestet; Contract `forge/contracts/TASK-0004.md` (YAML-Frontmatter, `status: approved`, `architecture_review: pending_chatgpt_final_check`) |
| TASK-0005 Dialogue Policy Contract v2 | nur Branch `codex/mystery-task-0005` | `0453f85`, Blob `1e6f36e5…`, Head `fab792a` | `review_ready`, `implementation_gate: blocked_pending_approval` |
| TASK-0005 Claude-Review v2 (APPROVE, blob-gebunden) | nur Branch `claude/forge-architecture-review-hjdq89` | `be40a68` | ChatGPT-Finalcheck laut Contract §18 offen |
| TASK-0005 Implementierung | **nirgends** | – | auf keinem der 6 Remote-Branches existiert `npc-dialogue-policy.ts` |
| Accusation & Verdict | nur Projektdatei (Design) | – | kein Code, kein Contract |
| `forge/run/codex/IDENTITY-SPIKE-1` | Branch | `8dc692b` | nur Identitäts-Spike, kein Mystery-Inhalt |

**Abweichung zu `MYSTERY-TASK-0006-CANDIDATES.md` §1.1/§1.2:** Dort war `main` noch leer (`.gitkeep`). Seit PR #1 (`3d7545d`) liegen TASK-0001 bis TASK-0004 einschließlich M1 auf `main`. Die Aussage „Baseline: nein“ in der dortigen Tabelle ist überholt. Der Domain-Produktionscode auf `main` ist byteidentisch mit dem auf `codex/mystery-task-0005` (geprüft per `git diff --stat`; die Branches unterscheiden sich nur in Forge-Core-, Contract- und Review-Dateien).

### 1.2 Was der Code heute tatsächlich kann

| Modul (Zeilen) | Öffentliche API | Fähigkeit | Für die Slice relevant |
|---|---|---|---|
| `case-truth.ts` (340) | `parseCaseTruth`, ID-Schemas, `ClaimSchema` (3 Arten: `personAt`, `eventHasParticipant`, `eventHasItem`), `TickSchema`, `DeepReadonly` | Objektive Welt: Personen, Orte, Items, Beziehungen, Events (Zeit, Ort, Teilnehmer, Items, Ursachen), Motive, Propositionen mit `truth`, Evidence (`source` + `links` supports/refutes), Secrets, Red Herrings. Tief eingefroren, gebrandet. | Welt, Evidence-Katalog, Propositionen |
| `case-truth.identity.ts` (39) | `hashCaseTruth`, `serializeCaseTruth` | Kanonischer SHA-256 (`forge-case-c14n-v1`) | Bindung aller neuen Dokumente |
| `case-semantics.ts` (267) | `validateCaseSemantics` | 8 Widerspruchsregeln (Ort, Claim, Kausalität), sortierter Report | Autoren-Lint beim Paketbau |
| `case-solution.ts` (296) | `createCaseSolutionSchema`, `parseCaseSolution`, `ConclusionClaimSchema` (6 Arten) | Answer Key: Resolutions je Event, Conclusions-Katalog, `requiredConclusions`. Wahrheitstabelle `resolveConclusion` privat. | Verdict-Quelle |
| `case-solution.identity.ts` (39) | `hashCaseSolution` | `forge-solution-c14n-v1` | NPC-Bindung |
| `npc-knowledge.ts` (303) | `createNpcKnowledgeSchema`, `parseNpcKnowledge` | Statischer epistemischer Snapshot je NPC: awareness, attitudes (knowledge faktiv / belief / uncertain), Provenance nur Annotation, Regel 14 „keine automatische Zuteilung“ | NPC-Wissen |
| `npc-knowledge.projection.ts` (207) | `projectNpcKnowledge` → `NpcVisibleContext` | Informationsbarriere: lokale Handles `(kind,index)` ab 1 je Kategorie, 9 Claim-Formen, keine IDs/Namen/Wahrheitswerte/Provenance | Eingabe der Dialogue-Engine |

Testbasis: `tests/case-truth.fixture.ts` (Fall „Brieföffner“, `case:letter-opener`), `tests/case-solution.fixture.ts` (Fall „Gift im Tee“), `tests/npc-knowledge.fixture.ts` (Fall „Bibliothek“ mit `SPOILER`-Marker für Leak-Tests).

### 1.3 Was nur als Design existiert

| Design | Kernaussagen, die diese Roadmap übernimmt |
|---|---|
| TASK-0005 Contract v2 | `createDialoguePolicyEngine(context)` → `querySchema`, `policySchema`, `evaluate(query, policy)`; Query = `ask_about_claim` über eine der 9 Claim-Formen mit **Original-Refs aus dem Context**; Runtime-Policy = `defaultAction` + Regeln je Statement-Subject; Entscheidungstabelle §10; Ergebnis = genau ein `CommunicativeAct` (assert / express_uncertainty / claim_ignorance / refuse / evade); `intent` bleibt intern; Engine erhält nie Truth/Solution. §4: ein persistentes Autoren-Policy-Dokument braucht einen **eigenen Contract** (Autorenadapter). |
| TASK-0005 v2 Review | V2-O1: nicht konstruierbare Fragen müssen von `claim_ignorance` ununterscheidbar sein; V2-O2: Verbalization erhält nur `act`; V2-O6: Indizes nie zeigen. |
| Accusation & Verdict Design | E1–E6, `evaluateConclusionClaim(truth, solution, claim: unknown)` additiv in `case-solution.ts`; Anklage = Literale `{claim, value}` an Truth gebunden; `solved ⇔ missing = ∅ ∧ contradicted = ∅`; `undetermined` neutral; `PlayerVerdict` nur `{verdict}`; Matrix #1–#50; D1–D10 offen. |

---

## 2. Missing Capabilities

Gegen den Ziel-Loop (Abschnitt 3) fehlen heute genau diese Fähigkeiten. Alles andere ist vorhanden.

| # | Fehlende Fähigkeit | Warum sie fehlt | Schließt |
|---|---|---|---|
| M1 | **Evidence Discovery**: wo und wie ein Evidence-Stück auffindbar ist | `Evidence.source` sagt, *woher* ein Beweis stammt, nicht *wie* der Spieler ihn erreicht | VS-2 |
| M2 | **Investigation Actions**: deterministische Spieleraktionen auf Orte/Items/Personen | kein Aktionsmodell | VS-2 |
| M3 | **Player Knowledge**: was der Spieler kennt (Entitäten, Evidence, Aussagen) und eine Sicht auf Evidence **ohne** `Proposition.truth` und ohne Red-Herring-Markierung | heute nur Autoren-Objekte; `Evidence`/`Proposition` tragen Spoiler | VS-2 (Sicht), VS-5 (Zustand) |
| M4 | **Dialogue Policy Engine** (TASK-0005) | nur Contract | VS-3 |
| M5 | **NPC-Befragung mit Domain-IDs**: Abbildung Spielerfrage → projektionslokale Handles, authored Policy je NPC, Aussage als Spielerinformation | TASK-0005 ist bewusst flüchtig und handle-basiert; Autorenadapter laut §4 ausgelagert | VS-4 |
| M6 | **NPC Interrogation State**: Gesprächsverlauf je NPC | TASK-0004 ist Snapshot ohne History, TASK-0005 ohne ConversationState | VS-5 (Transkript in der Session) |
| M7 | **Accusation & Verdict** | `resolveConclusion` privat, keine öffentliche Auswertung | VS-1 |
| M8 | **Case Session State**: Zustandsmaschine Start → Ermittlung → Anklage → Verdict | nichts vorhanden | VS-5 |
| M9 | **Save/Load** | nichts vorhanden; alle Dokumente sind aber bereits reine, kanonisch hashbare JSON-Daten | VS-5 |
| M10 | **Solvability**: prüfbare Aussage „dieser Fall ist headless lösbar“ | keine Brücke Evidence → Conclusions (Propositionen sprechen über Ort/Teilnahme, Conclusions über Verantwortung) | VS-6 |
| M11 | **Fallpaket**: Truth + Solution + Zugangsmodell + NPCs + Briefing als gebündelte, gegenseitig gebundene Eingabe | nichts vorhanden | VS-5 |
| M12 | **Headless End-to-End-Szenario** | nichts vorhanden | VS-6 |

Nicht fehlend, sondern bewusst **außerhalb der Slice**: Zeitfortschritt während der Ermittlung, NPC-Reaktion auf Konfrontation, Wissensweitergabe zwischen NPCs, Hinweise, Versuchslimits, spielerseitige Handles statt Domain-IDs, Verbalisierung, UI (siehe Abschnitt 10).

---

## 3. Target Game Loop

Headless bedeutet: Der „Spieler“ ist ein Testskript, das Kommandos an eine reine Funktion `applyCommand(session, command)` schickt und den eingefrorenen Folgezustand erhält. Keine Konsole, kein Text, kein LLM.

```
startCase(package)                          → Session(phase: investigating)
   │
   ├─ investigate(search_location L)        → neue Evidence-Karten, neue bekannte Entitäten
   ├─ investigate(examine_item I)           → dito
   ├─ investigate(examine_person P)         → dito (physische Spuren, nicht Aussagen)
   │
   ├─ ask(npc P, claim)                     → Statement (assert/uncertain/ignorance/refuse/evade)
   │
   ├─ note(text)                            → Journal-Eintrag ohne Semantik
   ├─ setHypothesis(literals)               → Spieler-Literale (Form der Anklage, ungeparst)
   │
   └─ accuse()                              → Session(phase: closed, verdict: solved | not_solved)
```

Verbindliche Eigenschaften des Loops:

1. **Alles ist eine Funktion des Fallpakets und der Kommandofolge.** Gleiche Eingaben liefern bytegleiche Session-JSON.
2. **Objektive Wahrheit, Answer Key, NPC-Snapshots und Policies werden nur gelesen.** Kein Kommando verändert ein Autorendokument.
3. **Der Spieler sieht nie**: `Proposition.truth`, `redHerrings`, `secrets`, `motives`, Resolutions, Conclusion-IDs, `requiredConclusions`, NPC-Provenance, NPC-Stance-Quelle, Policy-Intent, Handle-Indizes.
4. **Keine Inferenz-Engine.** Der Loop verbindet Beweise nicht automatisch mit Schlussfolgerungen; die Hypothese bildet der Spieler.
5. **Kein Zeitmodell in der Ermittlung.** Die Ermittlung findet „nach dem Fall“ statt; alle NPC-Snapshots sind zu diesem Zeitpunkt authored (`asOf`), alle Evidence ist grundsätzlich auffindbar. Zeit innerhalb der Slice ist nur die objektive Timeline der Truth.

---

## 4. Six-or-fewer Task Roadmap

Sechs Tasks. Drei davon sind parallel startbar. Jeder Task ist unabhängig reviewbar, deterministisch testbar, ohne UI und ohne Runtime-LLM. Zeilenangaben sind Produktionscode inklusive Kommentare, Tests ausgenommen.

Gemeinsame Regeln für alle sechs (aus den vorhandenen Modulen übernommen, nicht neu):

- Neue Dokumente sind strikte Zod-Schemas, keine Defaults, keine Coercion, deep-frozen, nominal gebrandet, an `caseId` + `truthHash` gebunden (Muster `createCaseSolutionSchema`).
- Fehler sind Result-Unions (`{success:false, code}`), nicht Exceptions, außer beim Parsen (`ZodError`).
- Keine Zufallswerte, keine Systemzeit, keine `localeCompare`-Sortierung; Ordnung immer nach UTF-16-Codeeinheiten.
- Jede neue öffentliche Sicht auf Spielerseite ist eine **explizite Allowlist** pro Variante (kein Object-Spread, kein Deny-Listing), wie `visibleClaim` in der Projektion.
- Bestehende Dateien werden nur dort geändert, wo es der Task ausdrücklich nennt; alle bestehenden 1087 Tests bleiben unverändert grün.

### VS-1 · Accusation & Verdict

| | |
|---|---|
| **Ziel** | Spieleranklage als Literale gegen den gebundenen Answer Key auswerten; Siegzustand. |
| **Grundlage** | `MYSTERY-ACCUSATION-VERDICT-DESIGN.md` vollständig, Entscheidungen E1–E6. |
| **Dependencies** | TASK-0001, TASK-0003 (Code auf `main`). Keine Abhängigkeit von 0002, 0004, 0005. |
| **Dateien** | modify (additiv): `src/domain/case-solution.ts` (+35–50: `ConclusionStatus`, `ConclusionEvaluation`, `evaluateConclusionClaim`). create: `src/domain/case-accusation.ts`, `tests/conclusion-evaluation.test.ts`, `tests/case-accusation.fixture.ts`, `tests/case-accusation.test.ts`, `tests/case-accusation.typecheck.ts`. |
| **API** | `evaluateConclusionClaim(truth, solution, claim: unknown): ConclusionEvaluation` · `createAccusationSchema(truth)` / `parseAccusation(input, truth): Accusation` · `evaluateAccusation(accusation, truth, solution): AccusationResult` · `toPlayerVerdict(evaluation): PlayerVerdict`. |
| **Kernregeln** | `solved ⇔ missing = ∅ ∧ contradicted = ∅`; Bewertung gegen Resolutions, nicht Katalog; `undetermined` neutral; Duplikate/Widersprüche = Parse-Fehler; keine Conclusion-IDs in der Eingabe; Report nur Zähler; `PlayerVerdict` hat genau den Schlüssel `verdict`. |
| **Größe** | ≈ 205–280 Zeilen (Design §12). Obergrenze 300. |
| **Tests** | Matrix #1–#50 und P1–P4 aus dem Design; Differentialtest `evaluateConclusionClaim` gegen den vorhandenen Black-Box-Prober `statusOf` in `tests/case-solution.test.ts`. |
| **Für die Slice getroffene Arbeitsannahmen zu D1–D10** | Empfehlungen des Designs übernommen: D1 neutral, D2 explizit, D3 Fehler, D4 gültig, D5 undetermined, D6 Einzelfunktion, D7 lokaler Schlüssel, D8 Zähler, D9 keine Grenze, D10 Host-Sache. **Diese bleiben Sebs Entscheidung**; die Roadmap hängt nur von D4 (leere Anklage gültig) und D8 (Spieler sieht nur `verdict`) ab. |

### VS-2 · Evidence Access & Investigation Actions

| | |
|---|---|
| **Ziel** | Authored Zugangsmodell je Evidence, deterministische Aktionen, spielersichere Evidence-Sicht. |
| **Grundlage** | Kandidat B aus `MYSTERY-TASK-0006-CANDIDATES.md` §3, verschlankt. |
| **Dependencies** | TASK-0001 (Code auf `main`). Sonst nichts. |
| **Dateien** | create: `src/domain/evidence-access.ts`, `tests/evidence-access.fixture.ts`, `tests/evidence-access.test.ts`, `tests/evidence-access.typecheck.ts`. |
| **Dokument** | `EvidenceAccessMap = { schemaVersion:1, caseId, truthHash, entries: { evidenceId, via: InvestigationAction }[] }`. Genau ein Eintrag je Evidence-ID; jedes Evidence der Truth muss einen Eintrag haben (sonst ist es unerreichbar und der Parse scheitert; eine bewusst unerreichbare Evidence muss der Autor also aus der Truth nehmen). |
| **Aktionen** | `InvestigationAction = { kind:"search_location", locationId } \| { kind:"examine_item", itemId } \| { kind:"examine_person", personId }`. `examine_person` steht für physische Untersuchung (Kleidung, Besitz, Spuren), **nicht** für Aussagen. |
| **API** | `parseEvidenceAccessMap(input, truth)` · `applyInvestigationAction(map, truth, discovered: ReadonlySet<EvidenceId>, action): { newlyDiscovered: EvidenceId[] }` (sortiert, eingefroren, idempotent) · `toPlayerEvidenceView(truth, evidenceId): PlayerEvidenceView`. |
| **PlayerEvidenceView** (Allowlist) | `{ id, description, source: {kind,id}, links: { proposition: { id, claim }, direction }[] }`. **Nie**: `Proposition.truth`, Red-Herring-Zugehörigkeit, Secrets. Die Claim-Objekte werden feldweise neu aufgebaut. |
| **Kernregeln** | Monotonie und Reihenfolgeunabhängigkeit: die Endmenge entdeckter Evidence hängt nur von der Menge der ausgeführten Aktionen ab. Keine Zeit (`availableFrom` entfällt), keine Kosten, keine Voraussetzungen zwischen Evidence-Stücken. |
| **Größe** | ≈ 220–300 Zeilen. Obergrenze 350. |
| **Tests** | Referenzintegrität und Bindung; Vollständigkeit der Map; Idempotenz; Permutation der Aktionen; Leak-Test mit `SPOILER`-Marker (Muster `tests/npc-knowledge.fixture.ts`): kein Marker aus `truth`-Feldern, Red Herrings oder Secrets in `JSON.stringify(view)`. |
| **Abweichung zu Kandidat B** | `availableFrom`-Tick und jedes Zeitmodell entfallen (Begründung: Abschnitt 3, Eigenschaft 5). Personenbezogene Evidence (`source.kind = "person"`) bleibt als Evidence erlaubt und wird wie jede andere über die Map erreicht; Aussagen von NPCs laufen **nicht** über die Map, sondern über VS-4. Beide Kanäle dürfen im selben Fall vorkommen, die Autoren sollten sie aber nicht für dieselbe Information doppelt nutzen (Lint in VS-6). |

### VS-3 · Dialogue Policy Engine (= TASK-0005 Implementierung)

| | |
|---|---|
| **Ziel** | Den vorliegenden, von Claude (v2) freigegebenen Contract umsetzen. |
| **Grundlage** | `forge/contracts/TASK-0005.md` v2 (`0453f85`, Blob `1e6f36e5…`) unverändert; Claude-Review `be40a68`. |
| **Dependencies** | TASK-0004 (Code auf `main`, identisch zur Contract-Basis `1de7efe` im Domain-Teil). Prozessvoraussetzung laut Contract §18: dokumentierte externe Freigabe (ChatGPT-Finalcheck oder ausdrückliche Owner-Anweisung). |
| **Dateien** | exakt die fünf aus Contract §3: `src/domain/npc-dialogue-policy.ts`, `tests/npc-dialogue-policy.{fixture,test,security.test,typecheck}.ts`. |
| **API** | exakt Contract §12: `createDialoguePolicyEngine(context)`, `DialogueQuery`, `RuntimeDialoguePolicy`, `CommunicativeAct`, `PolicyDecision`, `PolicyResult`. |
| **Größe** | Contract §17 empfiehlt **≤ 550** Zeilen. |
| **Tests** | Contract §14 AC-01…AC-23, Testmatrix §15, Mutationsplan `forge/reviews/TASK-0005-mutation-plan.md` (D01–D43) plus X01–X14 aus dem v2-Review. |
| **Abweichung zur 400-Zeilen-Vorgabe** | Diese Roadmap ändert den Contract nicht. Die 550 stammen aus dem Contract und sind durch die Security-Pipeline (§8, fünf Parsing-Stufen, Origin-WeakSets) begründet. Wer die 400 erzwingen will, muss den Contract neu versionieren und erneut reviewen lassen; das ist **länger**, nicht kürzer. Empfehlung: Contract so lassen. |
| **Hinweis** | Der Contract nennt als Repository `Wuerfelduell/Forge` und als Basis `1de7efe`. Beides ist historisch; `main` `3d7545d` enthält denselben Domain-Code. Die Freigabe sollte das ausdrücklich festhalten, statt den Contract zu editieren (§18: Frontmatter-Änderung ist keine Freigabe). |

### VS-4 · NPC Interrogation Adapter

| | |
|---|---|
| **Ziel** | Der im TASK-0005-Contract §4 vorgesehene **Autorenadapter**: authored Dialog-Profil je NPC mit Domain-IDs, Spielerfrage mit Domain-IDs → Engine-Query mit Original-Refs → `act` → `Statement` als Spielerinformation. |
| **Dependencies** | TASK-0004 (Code), VS-3 (Engine). Kein Zugriff auf Secrets, Motives, Relationships oder Resolutions (Contract §4). |
| **Dateien** | create: `src/domain/npc-interrogation.ts`, `tests/npc-interrogation.fixture.ts`, `tests/npc-interrogation.test.ts`, `tests/npc-interrogation.security.test.ts`. |
| **Dokument** | `NpcDialogueProfile = { schemaVersion:1, caseId, truthHash, solutionHash: string \| null, npcId, defaultAction: "answer"\|"refuse"\|"evade", rules: { subject: { kind:"proposition"\|"conclusion", id }, action }[] }`. Dieselben Einschränkungen wie die Runtime-Policy (keine Regel ohne passende Attitude, `invert` nicht auf `uncertain`, `feign_ignorance` nur unter `answer`); die Prüfung wird **nicht** dupliziert, sondern durch Übersetzung in `policySchema.parse` der Engine ausgeführt, deren Issue-Pfade auf `["rules", i, …]` abgebildet werden. |
| **API** | `parseNpcDialogueProfile(input, truth, solution, snapshot)` · `createInterrogation(truth, solution, snapshot, profile): Interrogation` (projiziert einmal, baut Engine, hält Handle-Tabelle) · `Interrogation.ask(claim: unknown): AskResult`. |
| **Handle-Tabelle** | Der Adapter leitet die Sichtbarkeitsmenge nach TASK-0004 §10 Schritt 2–5 ab (self ∪ awareness ∪ Attitude-Subjects ∪ Claim-Referenzen, je Kategorie nach UTF-16 sortiert, Index ab 1) und hält `domainId → Original-Ref-Objekt` (die erste Vorkommensinstanz aus `context`). Das ist die vom Contract §7.3 erlaubte Host-Umschreibung. Ein **Differentialtest** gegen `projectNpcKnowledge` pinnt die Tabelle: für jede Attitude des Snapshots muss `visibleClaim(claim, tabelle)` dem projizierten Claim deep-equal sein. |
| **Statement** (Allowlist) | `{ npcId, claim: ConclusionClaim \| Claim (Domain-IDs, aus der **Frage**, nie aus dem Act rekonstruiert), answer: { kind:"assert", value, commitment } \| { kind:"express_uncertainty", leaning } \| { kind:"claim_ignorance" } \| { kind:"refuse" } \| { kind:"evade" } }`. **Nie**: `intent`, Subject-Handles, Indizes, Stance-Quelle. Erlaubt, weil die Engine den Act-Claim ausschließlich aus der exakt passenden Attitude baut, die strukturell gleich der Frage ist (Contract §9/§11). |
| **V2-O1-Regel** | Referenziert die Frage eine Entität, die der NPC nicht sieht (kein Eintrag in der Handle-Tabelle), liefert `ask` **ohne Engine-Aufruf** exakt den Act, den dieselbe Policy für einen Claim ohne Attitude liefert: `claim_ignorance` unter `answer`, `refuse`/`evade` unter dem jeweiligen Default. Bytegleich, nicht unterscheidbar. |
| **V2-O2-Regel** | Von `PolicyResult` verlässt nur `decision.act` den Adapter; `intent` wird nie gelesen. Testbar: `Object.keys(statement.answer)` enthält kein `intent`. |
| **Kernregeln** | Keine ConversationState-Änderung im NPC: Snapshot und Profil sind konstant; zweimal dieselbe Frage ergibt bytegleich dasselbe Statement. Fragen fügen dem Context nichts hinzu. |
| **Größe** | ≈ 200–280 Zeilen. Obergrenze 350. |
| **Tests** | Alle fünf Act-Arten über Domain-IDs; unsichtbare Entität = ununterscheidbar; Profil-Übersetzung je Regelverbot mit Pfaden; Leak-Test (`SPOILER`, Indizes, `intent`); Determinismus; Mutanten: `intent` durchreichen, Claim aus Act statt Frage, Sichtbarkeitsprüfung entfernen. |
| **Abweichung zur Roadmap 0006–0010** | Der dortige Task 0009 „Deterministic Interrogation Session (ConversationState)“ wird hier auf den **Adapter ohne Zustand** reduziert; der Gesprächsverlauf lebt in der Session (VS-5). Konfrontation, Wiederholungsreaktionen und Memory-Updates sind Non-Goals (wie TASK-0005 §17). |

### VS-5 · Case Session, Player Journal & Save/Load

| | |
|---|---|
| **Ziel** | Fallpaket bündeln, Session-Zustandsmaschine als reiner Reducer, Journal als Spielerwissen, Persistenz. |
| **Dependencies** | VS-1 (Anklage), VS-2 (Aktionen, Evidence-Sicht), VS-4 (Befragung). TASK-0002 nur als Lint beim Paketbau. Kann gegen die **Typen** von VS-1/2/4 bereits spezifiziert werden, bevor deren Code gemerged ist. |
| **Dateien** | create: `src/domain/case-package.ts`, `src/domain/case-session.ts`, `tests/case-session.fixture.ts`, `tests/case-session.test.ts`, `tests/case-session.security.test.ts`, `tests/case-session.typecheck.ts`. |
| **CasePackage** | `loadCasePackage({ truth, solution, accessMap, briefing, npcs: { snapshot, profile }[] })`: parst in Reihenfolge, prüft alle Bindungen gegen dieselbe `truthHash`/`solutionHash`, führt `validateCaseSemantics` aus (Findings ≠ ∅ ⇒ `PACKAGE_INCONSISTENT`), verlangt genau ein Profil je NPC-Snapshot. **Briefing** (neu, authored): `{ schemaVersion:1, caseId, truthHash, knownPersonIds, knownLocationIds, knownItemIds, knownEventIds, interrogablePersonIds }`; `interrogablePersonIds` ⊆ NPCs mit Snapshot. |
| **Session** | `{ schemaVersion:1, caseId, truthHash, phase: "investigating"\|"closed", log: Command[], discoveredEvidenceIds, statements: Statement[], notes: string[], hypothesis: AccusationInput["literals"], verdict: PlayerVerdict \| null }`. Deep-frozen, gebrandet. |
| **Abgeleitetes Spielerwissen** (nicht gespeichert, pure Funktion) | `knownEntities(package, session)` = Briefing ∪ Referenzen aus `PlayerEvidenceView` entdeckter Evidence (source, Link-Claims) ∪ Referenzen aus Statements. Aktionen und Fragen sind nur auf bekannte Entitäten zulässig (`UNKNOWN_TO_PLAYER`), sonst gäbe es ein Orakel über die Existenz von Entitäten. |
| **Kommandos** | `start`, `investigate(action)`, `ask(npcId, claim)`, `note(text)`, `setHypothesis(literals)`, `accuse`. `applyCommand(package, session, command): CommandResult` mit `{ success:true, session }` oder `{ success:false, code }` (`PHASE_CLOSED`, `UNKNOWN_TO_PLAYER`, `NOT_INTERROGABLE`, `INVALID_HYPOTHESIS` mit Zod-Pfaden, `BINDING_MISMATCH`). Jedes erfolgreiche Kommando wird an `log` angehängt. |
| **accuse** | `parseAccusation(hypothesis)` → bei Fehler `INVALID_HYPOTHESIS` und **keine** Phasenänderung (D10: zählt nicht als Versuch); sonst `evaluateAccusation` → `toPlayerVerdict` → `phase: "closed"`. **Genau eine Anklage** beendet die Session. |
| **Save/Load** | `serializeSession(session): string` (feste Schlüsselreihenfolge) · `parseSession(input, package): Session` (strikt, Bindung, Referenzen). Integritätsregel: `replay(package, session.log)` muss die geladene Session bytegleich reproduzieren, sonst `SESSION_LOG_MISMATCH`. Damit ist das Log die Wahrheit und der Zustand ein Cache. |
| **Größe** | ≈ 300–380 Zeilen (Package ≈ 90, Session ≈ 250). Obergrenze 400; Rückfalloption: `note` entfällt (≈ 15 Zeilen) oder der Package-Loader wandert nach VS-6. |
| **Tests** | Zustandsmaschine (jede Kommando×Phase-Kombination); Determinismus und Replay; Save/Load-Roundtrip bytegleich; Leak-Test über `serializeSession` mit `SPOILER`-Marker in allen Spoiler-Feldern des Pakets; `UNKNOWN_TO_PLAYER` vor und nach Entdeckung; falsche Anklage → `not_solved` und `closed`; Mutanten: Phase nicht geschlossen, Log nicht angehängt, Spielerwissen aus Truth statt aus Journal, Verdict-Report statt PlayerVerdict gespeichert. |
| **Abweichung zur Roadmap 0006–0010** | „Player Case Journal“ (0010) und Session sind **ein** Task; Spielerwissen wird abgeleitet statt gespeichert. |

### VS-6 · Solvability Witness & Headless End-to-End

| | |
|---|---|
| **Ziel** | Prüfbare Lösbarkeit **ohne Inferenz-Engine** und das vollständige headless Szenario mit dem Beispiel-Fall aus Abschnitt 7. |
| **Dependencies** | VS-5 (und damit transitiv alle anderen). |
| **Dateien** | create: `src/domain/case-witness.ts`, `tests/case-witness.test.ts`, `tests/mystery-e2e.fixture.ts` (Beispiel-Fall als Paket), `tests/mystery-e2e.test.ts`. |
| **Dokument** | `SolvabilityWitness = { schemaVersion:1, caseId, truthHash, walkthrough: Command[], justifications: { literal: { claim, value }, cites: ({ kind:"evidence", id } \| { kind:"statement", npcId, claim })[] }[] }`. Ein Eintrag je `requiredConclusion` (Abdeckung über den lokalen Claim-Schlüssel aus VS-1). |
| **Validator** | `validateWitness(package, witness): WitnessReport` (sortierte Findings, Muster `case-semantics-v1`): **W1** Walkthrough läuft über `applyCommand` fehlerfrei bis `closed` mit `solved`. **W2** Jede Pflicht-Conclusion hat eine Begründung mit ≥ 1 Zitat. **W3** Jedes zitierte Evidence ist im Walkthrough **vor** `accuse` entdeckt. **W4** Jedes zitierte Statement ist im Walkthrough tatsächlich erhalten worden und ist ein `assert`. **W5** Jedes zitierte Evidence hat ≥ 1 Link, dessen Richtung zur objektiven Wahrheit passt (`supports` ⇔ `truth:true`, `refutes` ⇔ `truth:false`). **W6** Kein Zitat ist Evidence, das **ausschließlich** über Red-Herring-Links wirkt. **W7** Ein zitiertes Statement widerspricht der Wahrheit nicht: Propositions-Claim gegen `Proposition.truth`, Conclusion-Claim gegen `evaluateConclusionClaim` (Status muss `value` sein; `undetermined` ist kein Beleg). **W8** Lint: keine Proposition wird sowohl von personenbezogener Evidence als auch von einem Statement desselben NPC mit gleicher Polarität belegt (Doppelkanal, Abschnitt VS-2). **W9** Lint: jedes Event mit Pflicht-Verantwortung hat `completeness: "complete"` (Schrotflinten-Risiko aus Design §6, D1). |
| **Erreichbarkeits-Fixpunkt** | `maximalJournal(package)`: Fixpunkt über alle Aktionen auf bekannten Entitäten und alle Attitude-Claims der NPCs, deren Referenten dem Spieler bekannt sind. Dient W3/W4 als obere Schranke und liefert die Kennzahl „unerreichbare Evidence“ als Finding (`EVIDENCE_UNREACHABLE`). |
| **Größe** | ≈ 200–280 Zeilen. Obergrenze 350. |
| **Tests** | Beispiel-Fall besteht W1–W9; je eine Mutation des Witness oder Pakets pro Regel schlägt genau diese Regel; E2E-Test Abschnitt 8/9. |
| **Abweichung zu Kandidat C / Roadmap 0008** | Lösbarkeit wird als **autorisierte Zeugenschaft** (Witness) geprüft, nicht als Begründungsgraph über Propositions-Literale. Grund: Kandidat C stößt sofort an die Grenze, dass Motive/Secrets keine Prämissen sein können, und kostet 350–500 Zeilen ohne eigenen Spielwert. Der Witness ist kleiner, nutzt nur bestehende APIs und liefert das, was die Slice braucht: einen Beweis, dass **dieser** Fall headless lösbar ist. „Lösbar“ heißt hier ausdrücklich: *erreichbar und vom Autor mit wahrheitskonformen Belegen begründet*, nicht *logisch beweisbar*. |

### 4.7 Gesammelte Abweichungen von den vorliegenden Designs

| Quelle | Dort | Hier | Grund |
|---|---|---|---|
| Candidates §1 | `main` leer | `main` enthält 0001–0004 + M1 | Stand nach PR #1 |
| Candidates §6 | 5 Tasks 0006–0010 plus 0005 parallel | 6 Tasks VS-1…VS-6 inklusive 0005 | 0005 liegt auf dem kritischen Pfad zur Befragung; ehrlich mitzählen |
| Candidates §6 / Kandidat C | Solvability = statischer Begründungsgraph | Witness mit W1–W9 | kleiner, keine Grenze der Propositionen, nutzt nur vorhandene APIs |
| Candidates Kandidat B | `availableFrom`-Tick | kein Zeitmodell | Slice braucht keine Zeit; Entscheidung vertagt statt halb modelliert |
| Candidates 0009 | Interrogation Session mit ConversationState | Adapter ohne Zustand, Transkript in Session | TASK-0005 §17 nennt ConversationState als Non-Goal; NPC bleibt statisch |
| Candidates 0010 | Journal als eigener Task | Journal = abgeleitetes Spielerwissen in VS-5 | ein Dokument weniger, kein Doppelzustand |
| Accusation Design | D1–D10 offen | Empfehlungen als Arbeitsannahmen übernommen | nur D4/D8 sind für die Roadmap tragend; Rest bleibt Sebs Entscheidung |
| TASK-0005 §17 | Obergrenze 550 | unverändert | Contract hat Vorrang vor der 400-Zeilen-Wunschgrenze |
| Seb: „<400 Produktionszeilen“ | – | VS-3 ≤ 550, alle anderen ≤ 400 | siehe oben |

Keine Abweichung von TASK-0001…0004: Keine bestehende Semantik wird umgedeutet. Neue Semantik wird nur durch **neue, explizit benannte Dokumente** eingeführt: `EvidenceAccessMap`, `PlayerEvidenceView`, `NpcDialogueProfile`, `Statement`, `CaseBriefing`, `CasePackage`, `Session`, `SolvabilityWitness`. Insbesondere bleiben `Evidence.source` (nur Herkunft), `Provenance` (nur Annotation), `Motive`/`Secret`/`Relationship` (in der Slice **inert**, nur Autorenkontext) und TASK-0004 Regel 14 (keine automatische Zuteilung) unangetastet.

---

## 5. Dependency Graph

```
 main @ 3d7545d: TASK-0001/0001a · TASK-0002 · TASK-0003 · TASK-0004(+M1)
        │                 │                 │                  │
        │                 │                 │                  │ (+ externe Freigabe
        │                 │                 │                  │    Contract v2)
        ▼                 │                 ▼                  ▼
   ┌─────────┐            │            ┌─────────┐       ┌─────────┐
   │  VS-2   │            │            │  VS-1   │       │  VS-3   │
   │ Evidence│            │            │ Accus.  │       │ Dialog  │
   │ Access  │            │            │ Verdict │       │ Engine  │
   └────┬────┘            │            └────┬────┘       └────┬────┘
        │                 │                 │                 ▼
        │                 │                 │            ┌─────────┐
        │                 │                 │            │  VS-4   │
        │                 │                 │            │ Interro-│
        │                 │                 │            │ gation  │
        │                 │                 │            └────┬────┘
        │                 │ (Lint)          │                 │
        └────────────┐    │     ┌───────────┘   ┌─────────────┘
                     ▼    ▼     ▼               ▼
                   ┌─────────────────────────────┐
                   │           VS-5              │
                   │ Package · Session · Journal │
                   │          Save/Load          │
                   └──────────────┬──────────────┘
                                  ▼
                   ┌─────────────────────────────┐
                   │           VS-6              │
                   │ Witness · Headless E2E      │
                   └─────────────────────────────┘
```

| Eigenschaft | Wert |
|---|---|
| Parallel startbar ab sofort | VS-1, VS-2, VS-3 (keine Dateiüberschneidung; VS-1 ändert `case-solution.ts` nur additiv, die anderen beiden berühren es nicht) |
| Kritischer Pfad | VS-3 → VS-4 → VS-5 → VS-6 (vier Schritte) |
| Kürzester Pfad zu „Anklage auswertbar“ | VS-1 allein |
| Kürzester Pfad zu „Ermittlung ohne Befragung“ | VS-1 + VS-2 + VS-5 (mit `ask` als Stub, der `NOT_INTERROGABLE` liefert, wenn `interrogablePersonIds` leer ist) |
| Dateiüberschneidung | keine zwischen den Tasks; jede neue Produktionsdatei gehört genau einem Task |
| Modify-Liste über alle Tasks | ausschließlich `src/domain/case-solution.ts` (VS-1, additiv) |

Prozesshinweis (aus Candidates §5, weiterhin gültig): Contracts im Forge-Core-Format (`---json`-Frontmatter mit `forgeContractFormat`, `scope.create/modify`, `requiredChecks`, `mutationSmoke`), `baseCommit = 3d7545d` oder dessen Nachfolger auf `main`. `dependencies` kann leer bleiben, solange kein Mystery-Task im ForgeLog `accepted` ist; die Code-Bindung läuft über `baseCommit`.

---

## 6. Solvability Strategy

Die Slice kann Lösbarkeit nicht beweisen, weil das Modell keine Inferenz von Propositionen (Ort, Teilnahme, Item) zu Conclusions (Verantwortung, Rolle, Intent, Mechanismus, Kausalität) besitzt und diese Lücke bewusst nicht durch eine Logik-Engine geschlossen wird. Die Strategie hat deshalb drei Stufen, von denen die Slice die ersten beiden liefert.

**Stufe 1 – Erreichbarkeit (mechanisch, VS-5/VS-6).** Der Fixpunkt `maximalJournal` zeigt, welche Evidence und welche NPC-Aussagen ein Spieler überhaupt erreichen kann, ausgehend vom Briefing. Unerreichbare Evidence ist ein Autorenfehler (`EVIDENCE_UNREACHABLE`). Diese Stufe ist vollständig und deterministisch.

**Stufe 2 – Autorisierte Zeugenschaft (VS-6).** Der Autor liefert einen Walkthrough und je Pflicht-Conclusion Belege. Der Validator prüft nicht, *ob* der Schluss zwingend ist, sondern dass die Belege (a) erreichbar und im Walkthrough tatsächlich gesammelt sind, (b) in die richtige Richtung zeigen, (c) nicht nur über Red Herrings wirken und (d) NPC-Aussagen die Wahrheit nicht verfehlen. Damit sind die typischen Autorenfehler abgefangen: Lösung ohne Spuren, Spur hinter dem Ziel versteckt, Lüge als Beleg, Red Herring als Beleg.

**Stufe 3 – Begründbarkeit (nach der Slice).** Erst hier käme ein Begründungsgraph (Kandidat C) oder ein Fall-Generator mit Lösbarkeitsorakel. Beides braucht vermutlich reichere Propositionen (Besitz, Gelegenheit, Motiv als Claim) und ist eine Schemaänderung an TASK-0001.

Eigenschaften, die die Slice garantiert, in Prüfbegriffen:

| Garantie | Mechanismus |
|---|---|
| Der richtige Fall ist in endlich vielen Kommandos lösbar | W1 (Walkthrough bis `solved`) |
| Jede Pflicht-Conclusion ist belegt | W2–W4 |
| Belege sind wahrheitskonform | W5, W7 |
| Red Herrings allein führen nicht zur Lösung | W6; außerdem ist jede falsche Anklage per VS-1 `not_solved` |
| Falsche Anklagen sind nie `solved` | VS-1-Formel; P2-Orakel |
| Der Spieler kann die Lösung nicht aus dem Session-JSON lesen | Leak-Tests VS-2/VS-4/VS-5 |
| Die Schrotflinte (alle anklagen) scheitert | W9 verlangt `complete` bei Pflicht-Verantwortung, dann ist jede falsche Zusatzanklage `contradicted` |

---

## 7. Example Case

Arbeitstitel **„Der Brieföffner“**, `case:letter-opener`. Abgeleitet aus `tests/case-truth.fixture.ts` `fullCase()` (Revision 3), damit die Slice keine zweite Welt erfinden muss. Änderungen gegenüber der Fixture sind markiert. Alle IDs sind neutral (kein `ben-kills-clara` wie in der NPC-Fixture), weil die Slice Domain-IDs an den Spieler gibt.

### 7.1 CaseTruth (Revision 4)

| Sammlung | Inhalt |
|---|---|
| persons | `person:anna` Anna · `person:ben` Ben · `person:clara` Clara (Opfer) |
| locations | `location:library` Bibliothek · `location:garden` Garten |
| items | `item:letter-opener` Brieföffner · `item:gloves` Gartenhandschuhe |
| relationships | `relationship:ben-owes-clara` (Ben → Clara, „schuldet Geld“, [0, 3600)) |
| events | `event:argument` Streit über das Testament, [600, 1200), Bibliothek, {ben, clara} · `event:murder` @1500, Bibliothek, {ben, clara}, {letter-opener}, verursacht durch `event:argument` · `event:walk` Anna arbeitet im Garten, [1000, 2000), Garten, {anna}, {gloves} |
| motives | `motive:debt` (ben, [murder]) |
| propositions | `proposition:ben-at-murder` eventHasParticipant(murder, ben) **true** · `proposition:anna-at-murder` eventHasParticipant(murder, anna) **false** · `proposition:opener-used` eventHasItem(murder, letter-opener) **true** · `proposition:ben-at-argument` eventHasParticipant(argument, ben) **true** · `proposition:anna-in-library` personAt(anna, library, 1500) **false** · `proposition:anna-in-garden` personAt(anna, garden, 1500) **true** |
| evidence | `evidence:fingerprint` Annas Fingerabdruck auf dem Brieföffner (vom Vortag); source item letter-opener; supports anna-at-murder, supports opener-used · `evidence:muddy-path` Frische Fußspuren im Gartenbeet; source location garden; supports anna-in-garden · `evidence:gloves-dirty` Erde an den Gartenhandschuhen; **source item gloves** (Fixture: event walk); refutes anna-in-library · **neu** `evidence:cuff-button` Abgerissener Manschettenknopf von Bens Hemd neben dem Schreibtisch; source location library; supports ben-at-murder · **entfernt** `evidence:anna-statement` (Fixture): Annas Aussage wird in der Slice durch ihren NPC-Snapshot abgebildet, nicht doppelt als Evidence (Lint W8) |
| secrets | `secret:debt` [ben-at-argument] |
| redHerrings | `red-herring:fingerprint` [fingerprint] → anna-at-murder |

`validateCaseSemantics` liefert für diese Truth keine Findings (die Fixture ist dafür ausgelegt; `cuff-button` fügt nur Evidence hinzu).

### 7.2 CaseSolution

| Event | completeness | assignments | intent | mechanism | causesComplete |
|---|---|---|---|---|---|
| murder | complete | ben: [direct_actor] | intended | ordinary | true |
| argument | complete | [] | not_applicable | ordinary | true |

Conclusions: `conclusion:ben-responsible` resp(ben, murder) · `conclusion:anna-responsible` resp(anna, murder) · `conclusion:ben-actor` role(ben, murder, direct_actor) · `conclusion:intended` intent(murder, intended).
**requiredConclusions**: `ben-responsible = true`, `anna-responsible = false`. (Rolle und Intent sind erlaubte Zusatzaussagen, keine Pflicht, weil die Slice dafür keinen Beleg bietet; `argument` ist `complete []`, damit `none(argument)` bestimmt ist.)

### 7.3 EvidenceAccessMap

| Evidence | via |
|---|---|
| cuff-button | search_location(library) |
| fingerprint | examine_item(letter-opener) |
| muddy-path | search_location(garden) |
| gloves-dirty | search_location(garden) |

### 7.4 Briefing

knownPersons {anna, ben, clara} · knownLocations {library, garden} · knownItems {letter-opener} · knownEvents {murder} · interrogable {anna, ben}.

Bewusste Entscheidungen im Briefing: Der Garten gehört zum Anwesen und ist dem Ermittler von Anfang an bekannt; ohne ihn wäre Annas Alibi unerreichbar, weil keine anfangs erreichbare Evidence und keine Aussage den Garten referenziert (Stufe 1 der Lösbarkeit, `EVIDENCE_UNREACHABLE`). Die Handschuhe sind anfangs **unbekannt** und werden erst durch `gloves-dirty` (source item gloves) bekannt. `event:argument` ist nicht im Briefing und wird im Walkthrough nie referenziert: Der Streit bleibt ein Secret, und Annas Wissen darüber ist für den Spieler nicht abfragbar, weil er den Event nicht kennt.

### 7.5 NPC-Snapshots (asOf 3600, Solution gebunden)

**Anna** – awareness: anna, ben, clara, library, garden, gloves, argument, walk.
Attitudes: ben-at-argument **knowledge true** (witnessed_event argument, acquiredAt 900) · anna-in-garden **knowledge true** (witnessed_event walk, 1500) · anna-in-library **knowledge false** (witnessed_event walk, 1500) · ben-at-murder **uncertain, leaning true** (author_modeled_inference, 1600).
Profil: default `answer`, keine Regeln. Anna sagt ehrlich, was sie weiß.

**Ben** – awareness: anna, ben, clara, library, garden, letter-opener, argument, murder.
Attitudes: ben-at-murder **knowledge true** (witnessed_event murder, 1500) · ben-at-argument **knowledge true** (witnessed_event argument, 900) · opener-used **knowledge true** (witnessed_event murder, 1500) · anna-at-murder **knowledge false** (witnessed_event murder, 1500) · anna-in-garden **belief true** (author_modeled_inference, 1500; er hat sie im Garten gesehen, als er kam).
Profil: default `answer`; Regeln: ben-at-murder → **invert** (Lüge: „ich war nicht dabei“) · anna-at-murder → **invert** (Lüge: „Anna war dabei“, passend zum Red Herring) · opener-used → **feign_ignorance** · ben-at-argument → `evade` (vom Default abweichend, also laut Contract §10 ein erkennbarer Hinweis, dass er dazu eine Haltung hat).

Alle vier Regeln sind nach TASK-0005 §9 zulässig: `invert` nur auf knowledge/belief, `feign_ignorance` nur unter Default `answer`.

### 7.6 SolvabilityWitness

Walkthrough: siehe Abschnitt 8. Begründungen:

| Pflicht-Literal | Zitate |
|---|---|
| resp(ben, murder) = true | evidence cuff-button |
| resp(anna, murder) = false | evidence muddy-path; evidence gloves-dirty; statement anna personAt(anna, garden, 1500); statement ben personAt(anna, garden, 1500) (belief, bestätigt das Alibi) |

Erwartete Validator-Ergebnisse: W1–W9 bestanden. Gegenproben, die scheitern müssen: `fingerprint` als Zitat (W6), Bens Aussage zu ben-at-murder als Zitat (W7: assert false gegen truth true), Annas Aussage zu ben-at-argument als Zitat (W3/W4: im Walkthrough nicht erreichbar, weil `event:argument` unbekannt bleibt), `murder` auf `partial` (W9).

---

## 8. Headless Playthrough

Kommandofolge des Witness-Walkthroughs und die beobachtbare Wirkung. Alles, was rechts steht, ist Inhalt der Session-JSON nach dem jeweiligen Kommando; nichts davon enthält Spoiler-Felder.

| # | Kommando | Ergebnis (spielersichtbar) |
|---|---|---|
| 0 | `start` | phase investigating; bekannt: anna, ben, clara, library, garden, letter-opener, murder |
| 1 | `investigate search_location(library)` | entdeckt **cuff-button**: „Abgerissener Manschettenknopf …“, source location library, links [{ ben-at-murder: eventHasParticipant(murder, ben), supports }] |
| 2 | `investigate examine_item(letter-opener)` | entdeckt **fingerprint**: links [{ anna-at-murder, supports }, { opener-used, supports }]; der Spieler sieht nicht, dass es ein Red Herring ist |
| 3 | `investigate search_location(garden)` | entdeckt **muddy-path** (links anna-in-garden: supports) und **gloves-dirty** (source item gloves, links anna-in-library: refutes) ⇒ `item:gloves` jetzt bekannt |
| 4 | `investigate examine_item(gloves)` | `newlyDiscovered: []`; Kommando gültig und geloggt |
| 5 | `ask ben eventHasParticipant(murder, ben)` | Statement ben: **assert false, unqualified** (Lüge; der Spieler sieht nur die Aussage) |
| 6 | `ask ben eventHasParticipant(murder, anna)` | Statement ben: **assert true, unqualified** (Lüge; stützt scheinbar den Fingerabdruck) |
| 7 | `ask ben eventHasItem(murder, letter-opener)` | Statement ben: **claim_ignorance** (feign; bytegleich mit ehrlicher Unwissenheit) |
| 8 | `ask ben eventHasItem(murder, gloves)` | Statement ben: **claim_ignorance** (Handschuhe sind für Ben unsichtbar; V2-O1: ununterscheidbar von #7) |
| 9 | `ask anna personAt(anna, garden, 1500)` | Statement anna: **assert true, unqualified** |
| 10 | `ask anna personAt(anna, library, 1500)` | Statement anna: **assert false, unqualified** |
| 11 | `ask anna eventHasParticipant(murder, ben)` | Statement anna: **express_uncertainty, leaning true** |
| 12 | `ask anna eventHasParticipant(murder, anna)` | Statement anna: **claim_ignorance** (keine Attitude; ehrlich, bytegleich mit #8 unter derselben Default-Aktion) |
| 13 | `ask ben personAt(anna, garden, 1500)` | Statement ben: **assert true, belief** (Ben bestätigt unfreiwillig Annas Alibi und widerspricht #6) |
| 14 | `ask anna eventHasParticipant(argument, ben)` | **UNKNOWN_TO_PLAYER**: `event:argument` ist nicht bekannt; dieselbe Antwort wie für jede unbekannte oder nicht existierende ID, nicht geloggt |
| 15 | `note "Ben widerspricht sich: Anna angeblich im Zimmer, aber auch im Garten."` | notes +1 |
| 16 | `setHypothesis [ resp(ben, murder)=true, resp(anna, murder)=false ]` | hypothesis gesetzt |
| 17 | `accuse` | **verdict solved**, phase closed; der Session-JSON enthält `verdict: {"verdict":"solved"}` und keine Zähler |

Das Log enthält 16 Kommandos (#14 ist abgelehnt und wird nicht geloggt). Die Session-JSON nach #17 enthält: `discoveredEvidenceIds` [cuff-button, fingerprint, gloves-dirty, muddy-path] (sortiert), 9 Statements, 1 Notiz, 2 Hypothesen-Literale, das Verdict.

Varianten, die der E2E-Test zusätzlich fährt:

- **Falsche Anklage** nach #15: `setHypothesis [ resp(anna, murder)=true ]`, `accuse` ⇒ `not_solved`, closed; danach jedes Kommando ⇒ `PHASE_CLOSED`.
- **Schrotflinte**: `[ resp(ben)=true, resp(anna)=true, resp(clara)=true ]` ⇒ `not_solved` (anna und clara `contradicted`, weil `complete`).
- **Halbe Lösung**: `[ resp(ben)=true ]` ⇒ `not_solved` (anna=false fehlt; E4).
- **Save/Load** nach #8: `parseSession(JSON.parse(serializeSession(s)))` bytegleich, Fortsetzung mit #9–#17 ergibt dieselbe End-Session wie ohne Unterbrechung.
- **Replay**: `replay(package, s17.log)` bytegleich `s17`.

---

## 9. End-to-End Acceptance

Abnahme der gesamten Slice (Test `tests/mystery-e2e.test.ts` in VS-6 plus die Einzel-Abnahmen der Tasks).

| ID | Kriterium | Prüfung |
|---|---|---|
| E2E-01 | `npm run typecheck` und `npm test` bestehen; die 1087 Bestandstests sind unverändert | CI |
| E2E-02 | Das Beispiel-Paket lädt (`loadCasePackage`) ohne Findings; alle Bindungen auf dieselbe `truthHash` | Test |
| E2E-03 | Der Witness-Walkthrough endet in `solved`; `validateWitness` liefert keine Findings | Test |
| E2E-04 | Die drei falschen Anklagen aus Abschnitt 8 enden in `not_solved` | Test |
| E2E-05 | Determinismus: zwei Läufe liefern bytegleiche `serializeSession`; Replay des Logs bytegleich | Test |
| E2E-06 | Save/Load-Roundtrip an jeder Position des Walkthroughs bytegleich und fortsetzbar | Test, parametrisiert über alle 17 Log-Präfixe |
| E2E-07 | Informationsbarriere: Paket mit `SPOILER`-Marker in Titel, Namen, Beschreibungen der nicht-spielersichtbaren Felder, in Secrets, Motiven, Resolutions, Conclusion-IDs, Provenance; `serializeSession` jeder Session enthält den Marker nur in Evidence-Beschreibungen, die der Spieler entdeckt hat | Test |
| E2E-08 | Keine `truth`-Werte von Propositionen, keine Red-Herring-IDs, kein `intent`, keine `index`-Felder in irgendeiner Session-JSON | strukturelle Suche über das serialisierte Objekt |
| E2E-09 | Unbekannte Entität: `investigate`/`ask` auf unbekannte Entität liefert `UNKNOWN_TO_PLAYER`, unabhängig davon, ob die Entität existiert, Red Herring ist oder vom NPC gesehen wird | Test |
| E2E-10 | V2-O1: Frage an Ben nach `item:gloves` (für Ben unsichtbar) ist bytegleich mit einer Frage nach einem Claim ohne Attitude unter derselben Policy | Test |
| E2E-11 | Die Autorendokumente des Pakets sind nach jedem Kommando deep-equal und eingefroren; `hashCaseTruth`/`hashCaseSolution` unverändert | Test |
| E2E-12 | Ein geparstes Session-Objekt ist tief eingefroren; Mutation des Rohinputs nach dem Parsen wirkt nicht | Test |
| E2E-13 | Jede Witness-Regel W1–W9 hat eine Negativprobe, die genau diese Regel meldet | Test |
| E2E-14 | Kein Produktionsmodul der Slice importiert Node-APIs außer `node:crypto` in den Identity-Modulen; kein Netzwerk, keine Zeit, kein Zufall | Import-Prüfung im Typecheck-Test |
| E2E-15 | Mutation-Smoke je Task mit dokumentierten Mutanten (Verdict-Formel, Allowlists, Phasenwechsel, Log-Anhang, Sichtbarkeitsprüfung, `intent`-Durchreichung) | Report |

Definition von „headless spielbar“ für die Abnahme: Ein Skript, das nur `loadCasePackage`, `applyCommand`, `serializeSession` und `parseSession` benutzt, kann den Beispiel-Fall von `start` bis `verdict` durchspielen, zwischendurch speichern und laden, und erhält bei falscher Anklage `not_solved`.

---

## 10. What Comes After Vertical Slice

In empfohlener Reihenfolge; jeder Punkt ist ein eigener Task mit eigenem Contract. Nichts davon ist für die Slice nötig.

1. **Spieler-Handles statt Domain-IDs.** Eine Projektion der Spielersicht mit lokalen Handles (wie TASK-0004), damit Autoren-IDs nicht mehr an die Oberfläche gelangen. Bis dahin: IDs neutral benennen (Lint-Kandidat).
2. **Mehrfache Anklagen, Versuchslimits, Hinweise.** Session-Phase `accused` mit Rückkehr zur Ermittlung; der interne Zähler-Report aus VS-1 wird zur Hint-Quelle mit eigener Informationsfreigabe (Design §8).
3. **Zeit in der Ermittlung.** `availableFrom`, Tagesphasen, NPC-Snapshots je Zeitpunkt; dann wird das Kandidat-B-Zeitmodell gebraucht.
4. **ConversationState und Konfrontation.** Der NPC reagiert auf vorgelegte Evidence oder Widersprüche; neue Snapshots pro Zustand (TASK-0004 erlaubt nur komplette Snapshots, keine Fortschreibung).
5. **Observation und Knowledge Transfer.** Wissen aus Zeugenschaft und Weitergabe ableiten; erfordert eine Entscheidung gegen TASK-0004 Regel 14 und ein History-Modell (Candidates §6).
6. **Solvability Stufe 3.** Begründungsgraph (Kandidat C) oder Generator-Orakel; wahrscheinlich mit reicheren Propositionen (Besitz, Gelegenheit, Motiv) als Schemaänderung an TASK-0001.
7. **Living World Events** und **Case Generator** (mit 6 als Abnahmeorakel).
8. **Verbalisierung.** Erst hier ein LLM, das ausschließlich `Statement.answer` und `PlayerEvidenceView` erhält (V2-O2), nie Session, Paket oder `intent`.
9. **UI / PWA / Backend.** Die Session-JSON und `applyCommand` sind die Schnittstelle; der Server hält das Paket, der Client nie.
10. **Forge-Prozess.** Jeder der sechs Tasks sollte als `---json`-Contract laufen, damit die Slice zugleich der erste vollständige Mystery-Durchlauf durch Forge-Core ist.

---

## Belege

- Branch-Topologie und Datei-Existenz: `git branch -r`, `git ls-tree -r --name-only <branch>`, `git diff --stat origin/main origin/<branch>` am 2026-10-03 auf dem Clone von `Forge-Dice/Forge`.
- Code: `src/domain/*.ts` auf `main` `3d7545d`, vollständig gelesen (Zeilenzahlen per `wc -l`).
- TASK-0005: `git show origin/codex/mystery-task-0005:forge/contracts/TASK-0005.md` (514 Zeilen, v2) und `git show origin/claude/forge-architecture-review-hjdq89:forge/reviews/TASK-0005.v2.architecture-review.md`.
- Designs: `/mnt/project-files/forge-audits/MYSTERY-TASK-0006-CANDIDATES.md`, `/mnt/project-files/forge-audits/MYSTERY-ACCUSATION-VERDICT-DESIGN.md`.
- Tests: `npm ci && npm run typecheck && npx vitest run` auf `main`: Exit 0 / Exit 0, 22 Dateien, 1087 Tests.

STOP. Keine Implementierung. Offen für Sebs Entscheidung: Task-IDs, Reihenfolge der drei parallelen Starts, D1–D10, Freigabe von TASK-0005 v2.
