# MYSTERY VS-2 IMPLEMENTATION DESIGN

**Evidence Access & Investigation Actions**

Read-only-Designdokument, 2026-10-03. Kein Code, kein Contract, keine Änderung am Repository.

| | |
|---|---|
| Kanonisches Repo | `Forge-Dice/Forge`, `main` = `3d7545d843883418348004e68717399a64da7a7d` (Merge PR #1), enthält TASK-0001, 0001a, 0002, 0003, 0004 (+ M1 `e5764ee`) |
| Geprüfte Quellen (Git, `main`) | `src/domain/case-truth.ts` (340 Z.), `case-truth.identity.ts` (39), `case-semantics.ts` (267), `case-solution.ts` (296), `case-solution.identity.ts` (39), `npc-knowledge.ts` (303), `npc-knowledge.projection.ts` (207), `tests/case-truth.fixture.ts`, `tests/npc-knowledge.fixture.ts`, `tests/npc-knowledge.projection.test.ts`, `forge/contracts/TASK-0004.md` |
| Side-Branches | `claude/forge-architecture-review-hjdq89`, `codex/forge-core-v2-repair`, `codex/mystery-task-0005`, `codex/task-0004-contract`, `forge/run/codex/IDENTITY-SPIKE-1`: auf **keinem** liegt eine Datei zu Evidence Access, Session, Accusation oder Witness. Nichts davon wird hier als implementiert behandelt. |
| Geprüfte Projektdokumente | `MYSTERY-VERTICAL-SLICE-ROADMAP.md` (VS-2, VS-5, VS-6, §3, §6, §7, §8), `MYSTERY-ACCUSATION-VERDICT-DESIGN.md` (§3, §8, §13), `MYSTERY-TASK-0006-CANDIDATES.md` (Kandidat B), `forge-handoffs/TASK-0004-dependency-handoff.yaml` (`spoiler_risks`, `projection_constraints`), `FORGE-CONTRACT-SYSTEM-V2.md` (§3.1–3.3, Format 2) |
| Baseline-Verifikation | `npm ci --ignore-scripts`, `npm run typecheck`, `npm test` auf `3d7545d` in dieser Sitzung: Typecheck 0 Fehler, 1087 Tests grün (Log in der Sitzung; keine Dateien geändert) |
| Vorgaben aus dem Auftrag | kein UI, kein Runtime-LLM, kein Zeitmodell, keine Quests, keine freie Textinterpretation; Spieler besitzt Evidence nicht automatisch; CaseTruth wird nicht umgedeutet; < 400 Produktionszeilen; keine neue Runtime-Dependency; Solvability nur als Schnittstelle |

Konventionen in diesem Dokument: Normative Entscheidungen heißen **D-n**, offene Entscheidungen für Seb **OD-n**, adversariale Fälle **A-nn**, Schnittstellenanforderungen an VS-5/VS-6 **I-n**. Typnotation ist Skizze, kein Code.

---

## 1. Current Model

Was das Datenmodell auf `main` heute über die sechs angefragten Begriffe ausdrücken kann, Feld für Feld (Quelle: `src/domain/case-truth.ts`, Zeilenangaben auf `3d7545d`).

### 1.1 Entitäten und ihre Felder

| Begriff | Schema (Zeile) | Felder | Was es ausdrückt | Was es **nicht** ausdrückt |
|---|---|---|---|---|
| **Location** | `LocationSchema` (Z. 85) | `id`, `name` | Existenz eines Ortes mit Anzeigename | Nachbarschaft, Enthaltensein, Betretbarkeit, welche Items oder Evidence dort sind, ob der Spieler den Ort kennt |
| **Item** | `ItemSchema` (Z. 86) | `id`, `name` | Existenz eines Gegenstands | Aufenthaltsort, Besitzer, Zustand, Untersuchbarkeit |
| **Event** | `EventSchema` (Z. 101–118) | `id`, `description`, `time`, `locationId`, `participantIds`, `itemIds`, `causedByEventIds` | Objektives Geschehen: wer, womit, wo, wann, Ursachen | Beobachter, hinterlassene Spuren, Sichtbarkeit; `description` ist Autorenprosa („Clara wird mit dem Brieföffner getötet“) |
| **Proposition** | `PropositionSchema` (Z. 148–152) | `id`, `claim` (`personAt` \| `eventHasParticipant` \| `eventHasItem`), `truth` | Eine strukturierte Behauptung über die Welt mit objektivem Wahrheitswert | Wer sie kennt, ob sie dem Spieler zugänglich ist, Herleitbarkeit |
| **Evidence** | `EvidenceSchema` (Z. 166–184) | `id`, `description`, `source: SourceRef`, `links: {propositionId, direction}[]` (≥ 1, je Proposition höchstens einmal) | Ein Beweisstück existiert, stammt von genau einer Quelle (`person` \| `location` \| `item` \| `event`) und stützt/widerlegt Propositionen | **Wo** und **wie** es gefunden wird, ob es gefunden wurde, ob es Red Herring ist (steht nur in `redHerrings`), was der Spieler davon sieht |
| **Evidence source** | `SourceRefSchema` (Z. 154–159) | `{kind, id}` | Herkunft des Beweisstücks (Roadmap §4.7: „nur Herkunft“) | Zugang. Beispiel Fixture: `evidence:gloves-dirty` hat `source: event:walk`; ein Event kann nicht „durchsucht“ werden. `evidence:anna-statement` hat `source: person:anna`; das ist eine Aussage, kein physischer Fundort |
| **Secret / RedHerring** | Z. 186–195 | Mengen von Propositions- bzw. Evidence-IDs | Autorenannotation | Werden nirgends an Spieler oder NPC projiziert (TASK-0004 §10) |

### 1.2 Was das bestehende Modell bereits garantiert und VS-2 übernimmt

| Garantie | Quelle | Nutzung in VS-2 |
|---|---|---|
| ID-Form `prefix:slug`, Slug `[a-z0-9][a-z0-9_-]{0,63}` | `idSchema` (Z. 11–17) | Kind einer Referenz ist aus dem Präfix prüfbar; Aktionen mit falschem Präfix scheitern im Schema |
| Referenzvollständigkeit, eindeutige IDs über alle Collections | `checkReferenceIntegrity` (Z. 220–293) | VS-2 prüft nur seine eigenen Referenzen gegen `truth` |
| Deep-Freeze + Brand nach `structuredClone` | Z. 310–329 | Gleiches Muster für Map, State und Projektion |
| `hashCaseTruth` über `forge-case-c14n-v1` (Arrays als Mengen) | `case-truth.identity.ts` | Bindung der Map (wie `CaseSolution.truthHash`, `NpcKnowledgeSnapshot.truthHash`) |
| Snapshot-Elementtypen `CaseTruth["evidence"][number]` | TASK-0004 §2 | Gelesene Truth-Elemente werden so typisiert, nicht über `Evidence` |
| Informationsbarriere mit Allowlist, feldweiser Neuaufbau, keine Objekt-Identitäten | `npc-knowledge.projection.ts`, M1 `e5764ee`, Test `expectNoLeaks` | Gleiche Testform für die Spieler-Projektion |

### 1.3 Was es heute nicht gibt

- Keine Relation „Evidence ist über X erreichbar“. `source` ist dafür semantisch ungeeignet (Abschnitt 1.1) und ihre Umdeutung wäre genau die stille Umdeutung von CaseTruth, die der Auftrag verbietet.
- Kein Spielerzustand irgendeiner Art. `NpcKnowledgeSnapshot` ist authored und statisch; „Spielerwissen“ ist in TASK-0004 §15 ausdrücklich Non-Goal.
- Keine Aktion, kein Reducer, keine spielerseitige Sicht auf Evidence. Die einzige Projektion (`projectNpcKnowledge`) gibt Evidence nur als lokalen Handle ohne Inhalt frei.
- Kein Ortsgraph, keine Item-Position, keine Zeit nach dem Fall. Alle vier bleiben in VS-2 bewusst nicht modelliert.

---

## 2. Missing Capability

Genau drei Fähigkeiten fehlen; VS-2 liefert alle drei und nichts darüber hinaus.

| # | Fähigkeit | Form | Warum nicht weniger |
|---|---|---|---|
| M-1 | **Authored Zugang**: Für jedes Evidence der Truth steht fest, durch welche Aktion es erreichbar ist, oder dass es unerreichbar ist | neues, an `truthHash` gebundenes Dokument `EvidenceAccessMap` | Ohne authored Relation müsste der Code sie aus `source` raten (Umdeutung) oder alles wäre sofort zugänglich (Auftrag: nicht automatisch besitzen) |
| M-2 | **Runtime-Zustand und Reducer**: Welche Evidence der Spieler erreicht hat, und eine reine Funktion, die eine Aktion darauf anwendet | `InvestigationState` + `applyInvestigationAction` | Ohne Zustand gibt es keinen Unterschied zwischen „existiert“ und „gefunden“ |
| M-3 | **Spielersichere Projektion**: Was der Spieler über erreichte Evidence sieht, als Allowlist mit feldweisem Neuaufbau | `projectInvestigation` → `PlayerEvidenceView[]` | Ohne Barriere liefe `truth.evidence[i]` samt `description`, Proposition-`truth` (über den Link) und Objektidentitäten an den Spieler |

Nicht fehlend, sondern bewusst nicht Teil von VS-2 (werden in Abschnitt 11 als Schnittstelle markiert): Spielerwissen über Entitäten (VS-5), Erreichbarkeits-Fixpunkt und Lint (VS-6), Aussagen von NPCs (VS-4).

---

## 3. Domain Decisions

Antworten auf die zehn Fragen des Auftrags. Jede Antwort ist eine Entscheidung mit Begründung und der verworfenen Alternative.

### D-1 · Wo Evidence zugänglich ist: separates Dokument, nicht CaseTruth-V2

**Entscheidung.** Zugang steht in einem eigenen, authored Dokument `EvidenceAccessMap`, gebunden an `caseId` + `hashCaseTruth(truth)`. Genau ein Eintrag je Evidence-ID der Truth; jeder Eintrag nennt genau **eine** Aktion (`via`) oder markiert das Evidence ausdrücklich als `inaccessible`.

**Warum nicht CaseTruth-V2** (etwa `Location.evidenceIds` oder `Evidence.access`): Jede Änderung an `CaseTruthShapeSchema` ändert `hashCaseTruth` für alle Fälle, invalidiert jede Solution und jeden NPC-Snapshot (beide binden `truthHash`), berührt vier abgenommene Tasks und bräuchte `schemaVersion: 2` samt Migrationsregel. Außerdem ist Zugang kein Weltfakt, sondern Spielregel: dieselbe Welt kann in zwei Fassungen mit unterschiedlichem Zugang gespielt werden. Das ist dieselbe Trennung wie Truth/Solution/NPC.

**Warum nicht `source` als Zugang**: Abschnitt 1.1; `source: event` und `source: person` haben keinen physischen Fundort. Der Reducer liest `source` **nie**.

**Warum genau eine Aktion je Evidence und nicht eine Liste**: Eine Liste wäre ODER-Semantik; sie kostet im Reducer nichts, aber im Witness (VS-6 W3) und in jedem Test eine zweite Dimension. Der Beispielfall braucht sie nicht. Eine spätere Liste ist eine additive Schemaänderung der Map (`schemaVersion: 2`), nicht der Truth (OD-6).

**Warum `inaccessible` explizit statt „Evidence aus der Truth entfernen“** (Abweichung von Roadmap VS-2, dort: Parse scheitert ohne Eintrag): `Evidence` in der Truth ist objektiv, und NPC-Snapshots referenzieren Evidence über `awareness` und `provenance.observed_evidence` (TASK-0004 §7). Ein Beweisstück, das ein NPC gesehen hat, das aber verbrannt ist, muss in der Truth bleiben dürfen. Implizit (kein Eintrag = unerreichbar) wäre schlechter, weil ein vergessener Eintrag dann still ein Loch erzeugt. Explizit kostet eine Union-Variante.

### D-2 · Aktionsvokabular: drei zielgebundene Aktionen, nichts weiter

```text
InvestigationAction =
  | { kind: "search_location", locationId: LocationId }
  | { kind: "examine_item",    itemId: ItemId }
  | { kind: "examine_person",  personId: PersonId }
```

Das Vokabular ist „untersuche eine Entität“, und die Aktionsart folgt der Entitätsart. Events sind kein Ziel (ein vergangenes Geschehen lässt sich nicht untersuchen; Spuren eines Events liegen an Orten, Items oder Personen).

Aus den Kandidaten des Auftrags gestrichen:

| Kandidat | Warum gestrichen |
|---|---|
| `visitLocation` | Ohne Bewegungs- und Zeitmodell ist „besuchen“ bedeutungslos; es wäre ein freier Pflichtklick vor `search_location` |
| `inspectLocation` / `inspectItem` | Sind `search_location` / `examine_item` (Benennung wie Roadmap §3, damit VS-5 `investigate(action)` unverändert bleibt) |
| `discoverEvidence` | Entdecken ist **Ergebnis** einer Aktion, keine Aktion; eine Aktion `discover(evidenceId)` setzte voraus, dass der Spieler die Evidence-ID schon kennt, was ein Orakel über ihre Existenz wäre |
| `examineEvidence` | Siehe D-4 |

`examine_person` bleibt mit der Semantik der Roadmap: physische Untersuchung (Kleidung, Besitz, Spuren), **keine** Aussagen; Aussagen laufen über VS-4. Es ist die Variante, die sich am ehesten streichen ließe (OD-2); der Beispielfall braucht sie nicht.

### D-3 · Preconditions: genau drei, keine davon „Unlock“

| # | Precondition | Prüfung | Ergebnis bei Verletzung |
|---|---|---|---|
| P-1 | Bindung: `state.caseId`/`state.truthHash` gleich `map.caseId`/`map.truthHash` | Reducer, Feldvergleich | `{ success: false, code: "BINDING_MISMATCH" }`, Zustand unverändert |
| P-2 | Aktion ist wohlgeformt (strict, Präfix passt zur Art) | `InvestigationActionSchema` (bei untrusted Input) bzw. Typ | Zod-Fehler vor dem Reducer |
| P-3 | Ziel-ID existiert in der Truth | Reducer gegen die beim Map-Parse gesammelten Ziel-ID-Mengen | `{ success: false, code: "UNKNOWN_TARGET" }`, Zustand unverändert |

Es gibt **keine** Precondition „Spieler kennt das Ziel“ in VS-2, weil VS-2 kein Spielerwissen hat (D-9). Es gibt keine Precondition „Evidence X vorher entdeckt“ (D-7). Es gibt keine Kosten, keine Zeit, keine Items als Werkzeug.

### D-4 · `discovered` vs. `examined`: eine Stufe, nicht zwei

**Entscheidung.** VS-2 kennt genau einen Zustand je Evidence: **nicht erreicht** oder **entdeckt**. „Entdeckt“ heißt: die Evidence-ID ist in `state.discoveredEvidenceIds`, und die vollständige `PlayerEvidenceView` dieses Evidence ist freigegeben. Einen Zustand „gefunden, aber noch nicht untersucht“ gibt es nicht.

**Warum nicht beides.** Eine zweite Stufe hätte nur dann Informationswert, wenn `examine` eine Precondition hätte, die `discover` nicht hat (Werkzeug, Labor, Zeit, Kosten). Alle diese Modelle sind in VS-2 ausgeschlossen. Ohne sie ist `examine` ein freier Pflichtklick direkt nach `discover`: Er steuert keine Information, verdoppelt aber den Zustandsraum (zwei Mengen statt einer), die Save/Load-Prüfung, die Ableitung des Spielerwissens in VS-5 (zählt die Quelle einer unexaminierten Evidence als bekannt?) und die Witness-Regel W3 in VS-6 („examined vor accuse“ statt „discovered vor accuse“). Das sind geschätzt 60–90 Produktionszeilen und rund 15 adversariale Fälle für null Spielwert.

**Erweiterungspfad, falls später gewünscht:** Eine Aktion `examine_evidence(evidenceId)` mit Precondition „entdeckt“, die eine zweite View-Stufe freigibt. Das ist additiv: neue Union-Variante, neues State-Feld unter `schemaVersion: 2` der Map und des State. Keine Entscheidung von VS-2 wird dadurch rückgängig.

### D-5 · Was eine Aktion freigibt: genau die `PlayerEvidenceView` der neu entdeckten Evidence

Je entdecktem Evidence sieht der Spieler:

| Feld | Herkunft | Begründung |
|---|---|---|
| `id` | `evidence:<slug>` aus der Truth | Stabile Referenz für VS-5 (`discoveredEvidenceIds`) und VS-6 (Zitate `{kind:"evidence", id}`) |
| `label` | **authored in der Access-Map**, nicht `Evidence.description` | D-6 |
| `source: {kind, id}` | `truth.evidence[i].source`, feldweise neu gebaut | Herkunft ist strukturell und vom Autor gewählt; sie ist der Mechanismus, über den der Spieler neue Entitäten kennenlernt (Roadmap §7.4: `item:gloves` wird über `gloves-dirty` bekannt) |
| `links: { claim, direction }[]` | `truth.evidence[i].links` → `truth.propositions[j].claim` + `direction`; **ohne** `propositionId`, **ohne** `truth`; feldweise neu gebaut; dedupliziert nach (Claim-Schlüssel, direction); sortiert | Der Claim ist der Inhalt des Beweises („stützt: Ben war Teilnehmer des Mordes“). Die Propositions-ID trägt keinen Inhalt, nur Spoilerrisiko (D-8); `truth` ist die Lösung |

Nicht freigegeben, nie: `Evidence.description`, `Proposition.truth`, `Proposition.id`, Red-Herring-Zugehörigkeit, `secrets`, `motives`, `relationships`, Namen und Beschreibungen von Personen/Orten/Items/Events, Event-Felder (`time`, `participantIds`, …), die `via`-Aktion anderer Evidence, die Existenz nicht entdeckter Evidence, der Hash.

Was der Spieler **zusätzlich** aus einer View ableiten darf, entscheidet VS-5 (Entitäten, auf die `source` und `claim` zeigen, werden „bekannt“); VS-2 liefert dafür nur die Referenzen.

### D-6 · Spielertext: authored `label` in der Map; `Evidence.description` bleibt Autorenprosa

Der Auftrag nennt Evidence descriptions als Spoilerkanal, und die Fixture bestätigt es: „Annas Fingerabdruck auf dem Brieföffner **(vom Vortag)**“ verrät den Red Herring. TASK-0004 §10 behandelt bereits **alle** `description`- und `name`-Felder der Truth als nicht projizierbar. VS-2 bleibt bei dieser Grenze: `Evidence.description` ist Autorennotiz wie `Event.description` und `Motive.description`.

Damit der Spieler überhaupt Text sieht, trägt jeder zugängliche Map-Eintrag ein `label: Text` (ein nicht-leerer String, wie `TextSchema`). Das ist die konkrete Form des Prinzips „nur ausdrücklich freigegebene Information“: Alles, was der Spieler als Text liest, wurde **für den Spieler** geschrieben. Kosten: drei Zeilen Schema. Alternativen: (a) `Evidence.description` freigeben (Roadmap-Vorschlag) verlagert den Spoilerschutz vollständig auf Autorendisziplin; (b) gar kein Text macht die View für jede spätere UI unbrauchbar und erzeugt den Druck, später doch (a) zu tun. Verbleibendes Risiko: Ein Autor schreibt den Spoiler ins Label; das ist nicht mechanisch prüfbar (A-11), aber es ist dann ein Fehler in einem Feld, dessen einziger Zweck die Spielerfreigabe ist, nicht ein Nebeneffekt eines Autorenfelds.

`inaccessible`-Einträge haben kein Label (es gäbe nichts, wo es erscheinen könnte).

### D-7 · Evidence schaltet keine Evidence frei

**Entscheidung.** Die Map hat kein `requires`, kein `unlocks`. Die Menge entdeckter Evidence nach einer Folge von Aktionen ist die Vereinigung der Ausbeuten der einzelnen Aktionen: monoton, kommutativ, idempotent. Die Endmenge hängt nur von der **Menge** ausgeführter Aktionen ab, nicht von ihrer Reihenfolge.

**Warum.** Erstens reicht weniger: Verkettung entsteht ohnehin über Spielerwissen (VS-5): `gloves-dirty` macht `item:gloves` bekannt, erst dann ist `examine_item(gloves)` zulässig. Das ist eine Freischaltung **durch Wissen**, nicht durch Evidence, und sie liegt in der Schicht, die Wissen hat. Zweitens erzeugt jedes Unlock-Modell Zyklenprüfung, Reihenfolgeabhängigkeit, eine zweite Erreichbarkeitsdefinition für VS-6 und einen Save/Load-Zustand, der mehr als eine Menge ist. Drittens bleibt die Eigenschaft „Endmenge = f(Aktionsmenge)“ als Ein-Zeilen-Property testbar.

Konsequenz für den Auftragspunkt „circular unlocks“: In VS-2 unmöglich. Der verwandte Fall „Evidence nur über eine Entität erreichbar, die erst dieses Evidence bekannt macht“ ist kein Zyklus im Reducer, sondern Unerreichbarkeit im Fixpunkt von VS-6 (`EVIDENCE_UNREACHABLE`, A-51).

### D-8 · Keine automatische Wissensableitung: fünf Sperren

1. **Der Reducer liest die Truth nicht.** `applyInvestigationAction(map, state, action)` hat `truth` nicht als Parameter. Die Map enthält nur IDs und Labels; was er nicht hat, kann er nicht ableiten oder leaken.
2. **Keine Transitivität.** Entdecken von Evidence entdeckt nicht die Evidence an ihrer `source`, nicht andere Evidence zur selben Proposition, nicht die Evidence, die an einer im Claim genannten Entität liegt. Nur die Map-Einträge mit exakt passendem `via` zählen.
3. **Die View enthält keine Wahrheitswerte und keine Propositions-IDs.** Zwei Beweise zur selben Behauptung sind nur über strukturelle Claim-Gleichheit korrelierbar, was ein Spieler auch mit Zettel und Stift könnte.
4. **Der Zustand ist eine Menge von Evidence-IDs.** Keine abgeleiteten Fakten, keine Zähler, keine „bekannten Entitäten“ (VS-5 leitet sie **pure** aus den Views ab und speichert sie nicht, Roadmap VS-5).
5. **Ergebnisse sind ununterscheidbar, wo Unterscheidung ein Orakel wäre.** `success` mit `newlyDiscovered: []` ist dasselbe für: Ziel ohne Evidence, Ziel mit bereits entdeckter Evidence, Ziel dessen Evidence `inaccessible` ist. Nicht entdeckte Evidence ist in der Projektion schlicht abwesend; es gibt keine Einzelabfrage `view(evidenceId)` in VS-2, die „nicht entdeckt“ von „existiert nicht“ unterscheiden könnte (D-10).

### D-9 · Interaktion mit Player Knowledge (VS-5): VS-2 liefert Referenzen, VS-5 gated

VS-2 ist die **Evidence-Grenze**, nicht die **Spieler-Grenze**. Die Arbeitsteilung:

| Aufgabe | Schicht |
|---|---|
| „Darf der Spieler dieses Ziel untersuchen?“ (Ziel bekannt?) | VS-5, vor dem Aufruf des Reducers; `UNKNOWN_TO_PLAYER` für unbekannte **und** nicht existierende Ziele gleichermaßen (I-3) |
| „Was liegt dort?“ | VS-2 Reducer |
| „Was sieht der Spieler davon?“ | VS-2 Projektion |
| „Welche Entitäten kennt der Spieler jetzt?“ | VS-5, pure Ableitung: Briefing ∪ Referenzen aus `source` und `claim` aller Views ∪ Referenzen aus Statements (VS-4) |

VS-2 hat damit an seiner eigenen API ein Existenz-Orakel (`UNKNOWN_TARGET` nur für nicht existierende IDs). Das ist beabsichtigt und dokumentiert: Die API ist Domain-intern; die spielerseitige Fassade ist VS-5, die beide Fälle kollabiert. Alternative „VS-2 nimmt eine `known`-Menge entgegen“ wurde verworfen, weil VS-2 dann ein Spielerwissensmodell hätte, das es laut Auftrag nicht haben soll, und VS-5 es ohnehin braucht.

### D-10 · Determinismus: Sortierung, Mengen, keine Objektfreigabe

- Alle Listen in Map-Snapshot, State und Projektion sind nach UTF-16-Code-Units sortiert (`a < b`), wie `case-semantics` und die Projektion von TASK-0004; keine `localeCompare`.
- `discoveredEvidenceIds` ist kanonisch (sortiert, eindeutig); der Parser **lehnt** unsortierte oder doppelte Eingaben ab, statt zu normalisieren (OD-7), damit Save/Load bytegleich ist und ein manipulierter Zustand sichtbar scheitert.
- Views sind nach `id` sortiert, Links nach (kanonischem Claim-JSON, `direction`). Autorenreihenfolge in `truth.evidence[i].links` und in `map.entries` ist unsichtbar.
- Ausgabeobjekte werden in fester Schlüsselreihenfolge konstruiert, geklont und tief eingefroren; kein Ausgabeobjekt ist ein Objekt aus `truth`, `map` oder `state` (M1-Regel `e5764ee`).
- Keine Uhr, kein Zufall, keine Map-/Set-Iterationsreihenfolge, die nicht vorher sortiert wurde.
- Die Projektion ist eine reine Funktion von (`map`, `truth`, `state`); der Reducer von (`map`, `state`, `action`). Gleiche Eingaben liefern bytegleiches `JSON.stringify`.

### D-11 · Sprechende IDs: Roh-IDs in dieser Slice, Autorenregel + Lint, keine Handles in VS-2

Der Spieler braucht in dieser Slice stabile Referenzen, die er in Aktionen (`examine_item(item:gloves)`), Fragen (VS-4, `ask(npc, claim)`) und der Anklage (VS-1 `AccusationInput` verwendet `ConclusionClaimSchema` mit **Roh-IDs**, Design §3.1) wieder einsetzt. Die Roadmap (§7) hat deshalb entschieden, dass die Slice Domain-IDs an den Spieler gibt und IDs neutral benannt werden. VS-2 folgt dem. Konsequenzen und Schutz:

- Die View gibt **nur** IDs der Arten `evidence`, `person`, `location`, `item`, `event` frei (die fünf `AwarenessSubject`-Arten aus TASK-0004), nie `proposition`, `secret`, `red-herring`, `motive`, `relationship`, `conclusion`. Die Präfixe der verborgenen Collections erscheinen nie (Handoff `id_prefix_category`).
- Spoiler in Slugs (`event:ben-kills-clara`, `item:murder-weapon`) sind nicht mechanisch erkennbar; sie sind eine **Autorenregel** (Roadmap §7: neutrale IDs). Als heuristischer Lint für VS-6 wird empfohlen (I-8): Kein Slug eines Events, Items, Orts oder Evidence enthält den Slug einer Person als Token (`ben-kills-clara` enthält `ben`); Evidence-Slugs enthalten nicht `red-herring`, `herring`, `fake`, `true`, `false`.
- Projektionslokale dichte Handles (TASK-0004-Stil) wären in VS-2 nicht stabil über Aktionen hinweg; stabile Pseudonyme wären ein Spielerwissens-Zustand (Reihenfolge der Entdeckung) und damit VS-5. Beides lässt sich **über** VS-2 legen, ohne VS-2 zu ändern, weil die View nur `{kind, id}`-Referenzen trägt, die eine spätere Schicht 1:1 ersetzen kann (OD-1).

---

## 4. Authored Access Model

### 4.1 Dokument `EvidenceAccessMap` (Skizze, normativ)

```text
EvidenceAccessMap = {
  schemaVersion: 1,
  caseId: CaseId,
  truthHash: SHA256,                      // hashCaseTruth(truth), 64 hex lowercase
  revision: positive safe integer,        // Autorenzähler wie bei Solution/NPC; nie projiziert
  entries: EvidenceAccessEntry[]
}

EvidenceAccessEntry =
  | { evidenceId: EvidenceId, via: InvestigationAction, label: Text }
  | { evidenceId: EvidenceId, via: { kind: "inaccessible" } }

InvestigationAction =
  | { kind: "search_location", locationId: LocationId }
  | { kind: "examine_item",    itemId: ItemId }
  | { kind: "examine_person",  personId: PersonId }
```

Alle Objekte strikt (`z.strictObject`), alle Felder Pflicht, keine Defaults, keine Coercion. `SHA256`- und `Text`-Regeln wie TASK-0003/0004. `EvidenceAccessEntry` ist eine Union auf `via.kind` (`inaccessible` hat kein `label`; ein `label` dort ist `unrecognized_keys`).

### 4.2 Parse-Regeln in dieser Reihenfolge

| # | Regel | Pfad bei Fehler | Vorbild |
|---|---|---|---|
| R-1 | Shape strikt, `schemaVersion: 1`, Aktionen mit passendem ID-Präfix | Zod-Standardpfade | alle Tasks |
| R-2 | Bindung: `caseId === truth.caseId`, `truthHash === hashCaseTruth(truth)`; bei Verletzung **Abbruch** ohne weitere Prüfung | `["caseId"]`, `["truthHash"]` | `checkSolution` (case-solution.ts Z. 170–181) |
| R-3 | Jede `evidenceId` existiert in `truth.evidence` | `["entries", i, "evidenceId"]` | `Unknown … "<id>"`-Meldungen |
| R-4 | Keine `evidenceId` doppelt | `["entries", i, "evidenceId"]` (spätere Stelle) | `Duplicate resolution` |
| R-5 | **Vollständigkeit**: jede Evidence-ID der Truth hat genau einen Eintrag | `["entries"]`, Meldung nennt die fehlende ID | neu (Roadmap VS-2) |
| R-6 | Jedes `via`-Ziel existiert in der passenden Truth-Collection | `["entries", i, "via", "<idFeld>"]` | Referenzprüfung |
| R-7 | Transform: `structuredClone` → `deepFreeze` → Brand `"EvidenceAccessMap"`; Snapshot-Typ `DeepReadonly` | – | alle Tasks |

Nicht geprüft, bewusst: Plausibilität von `via` gegenüber `source` (D-1: Zugang ≠ Herkunft; A-30), Labeltext (A-11), ob mindestens ein Eintrag zugänglich ist (eine Map, in der alles `inaccessible` ist, ist gültig; dass der Fall dann unlösbar ist, meldet VS-6).

### 4.3 Beispiel „Der Brieföffner“ (Roadmap §7.3, ergänzt um Labels)

```text
caseId: case:letter-opener, truthHash: <hashCaseTruth(Revision 4)>, revision: 1
entries:
  evidence:cuff-button   via search_location(location:library)   label "Abgerissener Manschettenknopf neben dem Schreibtisch"
  evidence:fingerprint   via examine_item(item:letter-opener)     label "Fingerabdruck auf dem Brieföffner"
  evidence:muddy-path    via search_location(location:garden)     label "Frische Fußspuren im Gartenbeet"
  evidence:gloves-dirty  via search_location(location:garden)     label "Erde an einem Paar Gartenhandschuhe"
```

Beachte: `fingerprint` ist in der Truth „Annas Fingerabdruck … (vom Vortag)“; das Label sagt weder „Annas“ noch „vom Vortag“. Dass es Annas Abdruck ist, transportiert der Link-Claim `eventHasParticipant(event:murder, person:anna)` mit `supports`; dass er vom Vortag ist, soll der Spieler über Annas Alibi (`muddy-path`, `gloves-dirty`, Aussagen) selbst folgern.

---

## 5. Runtime State

```text
InvestigationState = {
  schemaVersion: 1,
  caseId: CaseId,
  truthHash: SHA256,
  discoveredEvidenceIds: EvidenceId[]     // sortiert (Code-Units), eindeutig, darf leer sein
}
```

Tief eingefroren, Brand `"InvestigationState"`. Erzeugbar nur über drei Wege:

| Weg | Signatur | Zweck |
|---|---|---|
| Start | `initialInvestigationState(map): InvestigationState` | leere Menge, Bindung aus der Map kopiert |
| Reducer | `applyInvestigationAction(map, state, action)` | Folgezustand |
| Laden | `parseInvestigationState(input: unknown, map): InvestigationState` | Save/Load (VS-5) |

Parse-Regeln für `parseInvestigationState`: strict shape; Bindung gegen `map.caseId`/`map.truthHash` (Abbruch bei Verletzung); jede ID existiert in der Map (R-3 der Map garantiert damit Existenz in der Truth); jede ID ist in der Map **zugänglich** (`via.kind !== "inaccessible"`; A-17); Liste sortiert und eindeutig (A-18, A-19). Die Map ist der einzige zweite Parameter: Sie trägt die Bindung und die Zugangsmengen; die Truth wird hier nicht gebraucht.

Was der State **nicht** enthält und warum:

- Keine Aktionsliste: Die Endmenge ist eine Funktion der Aktionsmenge (D-7); das Kommando-Log ist in VS-5 „die Wahrheit“ (Roadmap VS-5: `replay(package, log)` muss den Zustand bytegleich reproduzieren). Zwei Wahrheiten in einer Datei wären ein Konsistenzproblem.
- Kein Map-Hash: Eine geänderte Map (Evidence verschoben) wird über das Log-Replay in VS-5 erkannt (`SESSION_LOG_MISMATCH`); die semantische Mindestbedingung „entdeckt ⇒ zugänglich“ prüft der State-Parser (A-35, OD-5).
- Kein Spielerwissen, keine Zähler, keine Zeit.

---

## 6. Actions

### 6.1 Schema und Typ

`InvestigationActionSchema` (Abschnitt 4.1) wird exportiert, damit VS-5 Kommandos aus untrusted Input parsen kann; der Reducer nimmt den **Typ** `InvestigationAction` entgegen und verlässt sich auf TypeScript für die Form, prüft aber Ziel-Existenz zur Laufzeit (P-3), weil Brands nicht zur Laufzeit existieren.

### 6.2 Semantik je Aktion

| Aktion | Ziel | Ausbeute | Bemerkung |
|---|---|---|---|
| `search_location(L)` | `location:*` muss in `truth.locations` sein | alle Einträge mit `via = search_location(L)` | Ein Ort kann null bis n Evidence tragen |
| `examine_item(I)` | `item:*` in `truth.items` | alle Einträge mit `via = examine_item(I)` | Items haben keinen Ort; `examine_item` ist unabhängig von jedem `search_location` |
| `examine_person(P)` | `person:*` in `truth.persons` | alle Einträge mit `via = examine_person(P)` | Physisch. Aussagen sind VS-4. Das Opfer ist eine Person und kann untersucht werden |

Es gibt keine Aktion auf Evidence, keine auf Events, keine ohne Ziel.

### 6.3 Aktionsschlüssel

Zum Nachschlagen wird jede Aktion auf einen String `kind|id` abgebildet (`search_location|location:garden`). Die Map wird beim Parse zusätzlich in einem Index `Map<actionKey, EvidenceId[]>` (sortiert) gehalten; dieser Index ist Implementierungsdetail hinter dem Brand und nicht Teil des serialisierten Dokuments. Alternative ohne Index: lineare Suche über `entries` pro Aktion; bei handgeschriebenen Fällen gleichwertig, der Index spart aber einen Sortierschritt je Aufruf. Entscheidung dem Developer überlassen; beide sind unter 15 Zeilen.

---

## 7. Reducer Semantics

### 7.1 Signatur

```text
applyInvestigationAction(
  map: EvidenceAccessMap,
  state: InvestigationState,
  action: InvestigationAction
): InvestigationResult

InvestigationResult =
  | { success: true,  state: InvestigationState, newlyDiscovered: readonly EvidenceId[] }
  | { success: false, code: "BINDING_MISMATCH" | "UNKNOWN_TARGET" }
```

### 7.2 Schritte (normativ)

1. **Bindung** (P-1): `state.caseId === map.caseId && state.truthHash === map.truthHash`, sonst `BINDING_MISMATCH`.
2. **Ziel** (P-3): Ziel-ID in der beim Map-Parse aus der Truth übernommenen Menge der jeweiligen Art, sonst `UNKNOWN_TARGET`. (Die Map hält dafür die drei ID-Mengen `locations`, `items`, `persons` der gebundenen Truth; alternativ nimmt der Reducer `truth` nur für diese Prüfung entgegen, siehe OD-4. Empfehlung: Mengen in der Map, damit der Reducer die Truth nicht sieht, D-8 Sperre 1.)
3. **Ausbeute**: `yield = sorted(entries mit actionKey(via) === actionKey(action))`.
4. **Differenz**: `newlyDiscovered = yield \ state.discoveredEvidenceIds` (sortiert).
5. **Folgezustand**: Bei leerer Differenz **derselbe** `state` (Referenz), sonst neuer State mit `discoveredEvidenceIds = sorted(state ∪ newlyDiscovered)`, geklont, eingefroren.
6. Ergebnisobjekt eingefroren; `newlyDiscovered` eingefroren.

### 7.3 Eigenschaften (jede ist ein Test)

| Eigenschaft | Aussage |
|---|---|
| Totalität | Jede wohlgeformte Eingabe liefert ein Ergebnis; nie `throw` nach dem Schema |
| Reinheit | Keine Mutation von `map`, `state`, `action`; keine Retention von `action` |
| Monotonie | `state' ⊇ state` |
| Idempotenz | `apply(apply(s, a).state, a).newlyDiscovered = []`, `state` referenzgleich |
| Kommutativität | `apply(apply(s, a), b).state ≡ apply(apply(s, b), a).state` (bytegleich) |
| Mengenabhängigkeit | Für jede Aktionsfolge: Endzustand = `initial ∪ ⋃ yield(a)` über die Menge der Aktionen |
| Fehler ändern nichts | `success: false` ⇒ `state` unberührt, kein Teilergebnis, keine Diagnosewerte außer `code` |
| Ununterscheidbarkeit | Ziel ohne Evidence, Ziel mit nur bereits entdeckter Evidence und Ziel mit nur `inaccessible` Evidence liefern dasselbe `{ success: true, state (gleiche Referenz), newlyDiscovered: [] }` |

### 7.4 Was der Reducer nicht tut

Keine Truth lesen, keine `source` auswerten, keine Projektion erzeugen, keine Aktion protokollieren, kein Spielerwissen prüfen, keine Zeit zählen.

---

## 8. Projection/Spoiler Boundary

### 8.1 Signatur

```text
projectInvestigation(
  map: EvidenceAccessMap,
  truth: CaseTruth,
  state: InvestigationState
): InvestigationProjection

InvestigationProjection =
  | { success: true,  evidence: readonly PlayerEvidenceView[] }     // sortiert nach id
  | { success: false, code: "BINDING_MISMATCH" }

PlayerEvidenceView = {
  id: EvidenceId,
  label: Text,                                   // aus map.entries
  source: { kind: "person" | "location" | "item" | "event", id: string },
  links: readonly { claim: PlayerClaim, direction: "supports" | "refutes" }[]
}

PlayerClaim =                                    // feldweise neu gebaut, exhaustiv über ClaimSchema
  | { kind: "personAt", personId, locationId, at }
  | { kind: "eventHasParticipant", eventId, personId }
  | { kind: "eventHasItem", eventId, itemId }
```

Eine Ganz-Zustands-Projektion statt `view(evidenceId)`: Nicht entdeckte Evidence ist **abwesend**; es gibt keinen Rückgabewert, der „nicht entdeckt“ von „existiert nicht“ unterscheidet (D-8 Sperre 5). VS-5 bekommt alle Views in einem Aufruf und leitet daraus Spielerwissen ab.

### 8.2 Schritte (normativ)

1. **Bindung neu prüfen** (Brands sind nicht Laufzeit; Muster `isBound` in `npc-knowledge.projection.ts` Z. 72–82): `hashCaseTruth(truth) === map.truthHash`, `truth.caseId === map.caseId`, `state.caseId/truthHash === map.*`. Sonst `BINDING_MISMATCH` ohne Teilobjekt.
2. Für jede ID in `state.discoveredEvidenceIds` (bereits sortiert): Truth-Evidence und Map-Eintrag nachschlagen (beide existieren nach Parse-Regeln; falls nicht, `BINDING_MISMATCH`, „unreachable for correctly bound inputs“ wie in TASK-0004).
3. `source` als neues Objekt `{ kind, id }`.
4. Links: für jeden Link `truth.propositions[propositionId].claim` → `PlayerClaim` per `switch` über `claim.kind` mit expliziter Konstruktion je Variante (**kein Spread**, kein `structuredClone` des Truth-Objekts, damit ein neues Claim-Feld in TASK-0001 nicht still durchrutscht, sondern ein Compile-Fehler wird). Schlüssel `(canonicalJson(claim), direction)`; Duplikate entfernen; sortieren.
5. View in fester Schlüsselreihenfolge `id, label, source, links` konstruieren; Ergebnis tief einfrieren.

### 8.3 Spoilerkanäle und ihre Behandlung

| Kanal (Handoff `spoiler_risks`) | In VS-2 | Behandlung |
|---|---|---|
| `raw_domain_ids` (sprechende IDs) | **offen, bewusst** (D-11) | Nur fünf ID-Arten; Autorenregel; Lint-Empfehlung I-8; Handle-Schicht später über VS-2 legbar |
| `id_prefix_category` (`secret:`, `red-herring:`, `motive:`, `proposition:`, `conclusion:`) | geschlossen | Diese Präfixe erscheinen in keiner View (Propositions-ID entfernt, D-5) |
| `names` | geschlossen | Nie gelesen |
| `descriptions` (`Evidence.description`, `Event.description`, `Motive.description`) | geschlossen | Nie gelesen; `label` ist authored für den Spieler (D-6) |
| `proposition_truth` | geschlossen | Nie gelesen; Test A-39 |
| Red-Herring-Zugehörigkeit, `secrets`, `motives`, `relationships` | geschlossen | Nie gelesen; Test A-38/A-40 |
| `truthHash` / `revision` | geschlossen in der View | Die View enthält weder Hash noch Revision; der State enthält `truthHash` (nötig für Bindung; nicht invertierbar; VS-5 entscheidet, ob er die Session-JSON so an eine UI gibt) |
| `event_fields` | geschlossen | Events erscheinen nur als ID in `source`/`claim`; `time`, `participantIds`, `causedByEventIds` nie |
| `collection_order` | geschlossen | Alle Ausgaben sortiert, unabhängig von Autorenreihenfolge |
| Existenz nicht entdeckter Evidence | geschlossen | Keine Einzelabfrage; `newlyDiscovered: []` ununterscheidbar (7.3) |
| `via` anderer Evidence (wo liegt was) | geschlossen | Die Map wird nie projiziert; nur Labels der entdeckten Einträge |
| Objektidentitäten | geschlossen | Feldweiser Neuaufbau; Test wie `expectNoLeaks` (M1) |
| Ticks in `personAt.at` | **offen, authored** | Der Claim ist vom Autor als Beweisinhalt gewählt; der Tick ist Teil des Claims. Kein eigener Schutz |
| Entitäten in Claims/`source`, die der Spieler noch nicht kannte | **offen, authored** | Das ist der beabsichtigte Mechanismus, über den Entitäten bekannt werden (VS-5). Der Autor steuert ihn über die Link-Auswahl |

### 8.4 Leak-Test (Pflicht, Form aus `tests/npc-knowledge.projection.test.ts`)

Fixture mit `SPOILER`-Marker in **allen** `name`-/`description`-Feldern und sprechenden IDs für alle verborgenen Collections (`proposition:ben-guilty-true`, `secret:ben-did-it`, `red-herring:fake-print`). Rekursive Prüfung von `projectInvestigation(...)`: nur Strings aus der Allowlist {freigegebene IDs der fünf Arten, Labels aus der Map, Enum-Literale `personAt|eventHasParticipant|eventHasItem|supports|refutes|person|location|item|event`}, nur sichere Ganzzahlen, keine Symbole/Funktionen/Getter, keine Objektidentität aus `truth`, `map`, `state`.

---

## 9. Binding & Immutability

| Dokument | Bindung | Prüfzeitpunkt | Unveränderlichkeit |
|---|---|---|---|
| `EvidenceAccessMap` | `caseId` + `truthHash = hashCaseTruth(truth)` (Profil `forge-case-c14n-v1`) | `parseEvidenceAccessMap(input, truth)`; Abbruch vor Referenzprüfung | `structuredClone` + `deepFreeze` + Brand; Eingabeobjekt danach irrelevant |
| `InvestigationState` | `caseId` + `truthHash`, kopiert aus der Map | `initialInvestigationState`, `parseInvestigationState(input, map)`, Reducer (Feldvergleich) | wie oben; Reducer gibt neue, eingefrorene Zustände zurück; unveränderter Zustand wird referenzgleich zurückgegeben |
| Projektion | Map ↔ Truth per `hashCaseTruth(truth)` **neu berechnet**; State ↔ Map per Feldvergleich | jeder Aufruf | Ergebnis tief eingefroren, keine geteilten Objekte |

Regeln:

- **Stale Truth**: Jede Änderung der Truth (auch nur `revision`) ändert `truthHash`; Map-Parse scheitert, jeder gespeicherte State scheitert beim Laden, die Projektion liefert `BINDING_MISMATCH`. Das ist dieselbe Härte wie bei Solution und NPC-Snapshot und bewusst; eine Migration ist Autorenarbeit (neue Map-Revision).
- **Inhaltsbindung, nicht Objektbindung**: Eine zweite, inhaltsgleiche Truth-Instanz (`parseCaseTruth(sameInput)`) hat denselben Hash und ist gültig (A-08).
- **Brand ist Compile-Zeit**: Ein handgebautes Objekt mit passenden Feldern wird vom Reducer als State akzeptiert, wenn Bindung und Form stimmen. Untrusted Zustände **müssen** durch `parseInvestigationState`. Das ist dieselbe Haltung wie TASK-0004 §11 und wird im Contract so festgeschrieben (A-23).
- **Keine Map-Identität in VS-2**: Es gibt kein `hashEvidenceAccessMap` (OD-5). VS-5 bindet das Paket über `truthHash`/`solutionHash`; wenn VS-5 die Map-Identität braucht, ist ein Identity-Modul nach dem Muster `case-solution.identity.ts` (≈ 40 Zeilen, Profil `forge-access-c14n-v1`) ein eigener kleiner Schritt.

---

## 10. 40+ Adversarial Cases

Spalten: Fall, Eingabe/Szenario, erwartetes Verhalten, prüfende Stelle. „Schema“ = Zod-Fehler mit Pfad; „Reducer“ = `InvestigationResult`; „Projektion“ = `InvestigationProjection`; „Test“ = reine Eigenschaftsprüfung ohne Fehlerpfad.

### 10.1 Map-Parsing (A-01 bis A-15)

| # | Szenario | Erwartet | Stelle |
|---|---|---|---|
| A-01 | Eintrag mit `evidenceId` `evidence:ghost`, nicht in Truth | Fehler `Unknown evidence "evidence:ghost"` an `["entries", i, "evidenceId"]` | R-3 |
| A-02 | Zwei Einträge für `evidence:fingerprint` | Fehler am zweiten Vorkommen | R-4 |
| A-03 | Truth hat `evidence:cuff-button`, Map hat keinen Eintrag dafür | Fehler `Evidence "evidence:cuff-button" has no access entry` an `["entries"]` | R-5 |
| A-04 | `via: search_location("location:cellar")`, Ort nicht in Truth | Fehler an `["entries", i, "via", "locationId"]` | R-6 |
| A-05 | `via: { kind: "search_location", locationId: "item:gloves" }` (Präfix passt nicht zur Art) | Schema-Fehler (ID-Regex) **vor** jeder Referenzprüfung | R-1 |
| A-06 | `caseId: "case:other"` bei sonst korrekter Map | Fehler an `["caseId"]`, keine Referenzfehler gemeldet (Abbruch) | R-2 |
| A-07 | Truth-Revision 3 → 4 (nur `revision` geändert), Map trägt alten Hash | Fehler an `["truthHash"]` | R-2 |
| A-08 | Zweite Truth-Instanz aus identischem Input | gleicher Hash, Map gültig | R-2, Test |
| A-09 | Zusatzfelder `requires`, `availableFrom`, `description`, `unlocks` im Eintrag | `unrecognized_keys` | R-1 |
| A-10 | `label: "   "` | `Text must contain a non-whitespace character` | R-1 |
| A-11 | `label: "Annas Fingerabdruck (vom Vortag, Red Herring)"` | **akzeptiert**; nicht mechanisch prüfbar; dokumentierte Restverantwortung des Autors; Heuristik-Lint in VS-6 (I-8) | – |
| A-12 | `schemaVersion: 2` | Schema-Fehler | R-1 |
| A-13 | Truth ohne Evidence, `entries: []` | gültig; jede Aktion liefert `[]` | R-5, Test |
| A-14 | `inaccessible`-Eintrag mit `label` | `unrecognized_keys` (Union-Variante ohne Label) | R-1 |
| A-15 | Eingabeobjekt nach dem Parse mutiert (`input.entries.push(...)`) | Snapshot unverändert; Schreibzugriff auf den Snapshot wirft (`strict`) | R-7, Test |

### 10.2 State-Parsing und Save/Load (A-16 bis A-23)

| # | Szenario | Erwartet | Stelle |
|---|---|---|---|
| A-16 | `discoveredEvidenceIds: ["evidence:ghost"]` | Fehler an `[..., 0]`: nicht in der Map | `parseInvestigationState` |
| A-17 | Discovered enthält ein `inaccessible` Evidence | Fehler: `"evidence:burned-letter" is not accessible` | `parseInvestigationState` |
| A-18 | Discovered unsortiert `["evidence:muddy-path", "evidence:cuff-button"]` | Fehler: Liste muss sortiert sein (keine stille Normalisierung) | `parseInvestigationState` (OD-7) |
| A-19 | Discovered mit Duplikat | Fehler am zweiten Vorkommen | `parseInvestigationState` |
| A-20 | State `truthHash` ≠ `map.truthHash` | Fehler an `["truthHash"]`, Abbruch | Bindung |
| A-21 | **Cross-Case**: State aus `case:other`, dessen Evidence-IDs zufällig gleich heißen | Fehler an `["caseId"]`; selbst bei gleichem `caseId` scheitert der Hash | Bindung |
| A-22 | **Malformed**: `discoveredEvidenceIds: "evidence:x"`, `null`, fehlendes Feld, `-0`-Spielereien in nicht vorhandenen Zahlfeldern | Schema-Fehler | Schema |
| A-23 | Handgebautes State-Objekt (ohne Parser) mit korrekten Feldern an den Reducer | wird akzeptiert (Brand ist Compile-Zeit); Contract verlangt Parser für untrusted Input; Test dokumentiert das Verhalten | Doku |
| A-54 | **Save/Load-Roundtrip**: `JSON.parse(JSON.stringify(state))` → `parseInvestigationState` → `JSON.stringify` | bytegleich; feste Schlüsselreihenfolge `schemaVersion, caseId, truthHash, discoveredEvidenceIds` | Test |

### 10.3 Reducer (A-24 bis A-35)

| # | Szenario | Erwartet | Stelle |
|---|---|---|---|
| A-24 | `examine_item("item:ghost")` | `UNKNOWN_TARGET`, State referenzgleich | P-3 |
| A-25 | Aktion aus untrusted Input mit falschem Präfix | `InvestigationActionSchema` lehnt ab, Reducer wird nicht erreicht | Schema |
| A-26 | **Duplicate action**: `search_location(garden)` zweimal | zweites Mal `success`, `newlyDiscovered: []`, `state` referenzgleich | 7.3 |
| A-27 | **Order permutation**: Aktionen `[library, opener, garden]` in allen 6 Reihenfolgen | identische `JSON.stringify(state)`; `newlyDiscovered` je Schritt verschieden, Endmenge gleich | 7.3 |
| A-28 | Ziel ohne Evidence: `examine_item(gloves)` im Beispiel | `success`, `[]`, referenzgleich; **bytegleich** zu A-26 | 7.3 |
| A-29 | Ziel, dessen einzige Evidence `inaccessible` ist | wie A-28; kein Unterschied beobachtbar | 7.3 |
| A-30 | **Evidence am „falschen“ Ort**: `cuff-button` hat `source: location:library`, Map sagt `via: search_location(garden)` | Map gültig; `search_location(library)` liefert **nicht** `cuff-button`; `search_location(garden)` liefert es. Zeigt: `source` steuert nie den Zugang | Test |
| A-31 | **Replay**: dieselbe Aktionsfolge zweimal ab `initial` | bytegleiche Endzustände; Replay ab einem geladenen Zwischenzustand ergibt dasselbe wie ohne Unterbrechung | Test |
| A-32 | Map und State aus verschiedenen Truth-Revisionen | `BINDING_MISMATCH`, kein Teilergebnis | P-1 |
| A-33 | `result.newlyDiscovered.push(...)`, `result.state.discoveredEvidenceIds.push(...)` | wirft (eingefroren) | Test |
| A-34 | Aktionsobjekt nach `apply` mutiert | kein Effekt auf State oder Folgeaufrufe | Test |
| A-35 | **Stale Map**: Autor verschiebt `cuff-button` von library nach garden (neue Map-Revision, gleiche Truth). Alter State mit `cuff-button` entdeckt | State-Parse gültig (immer noch zugänglich); erst das Log-Replay in VS-5 zeigt die Abweichung (`SESSION_LOG_MISMATCH`). Dokumentierte Grenze (OD-5) | Doku |

### 10.4 Projektion und Spoiler (A-36 bis A-48)

| # | Szenario | Erwartet | Stelle |
|---|---|---|---|
| A-36 | **Examine vor Discover**: Spieler will `evidence:cuff-button` sehen, bevor er die Bibliothek durchsucht hat | Es gibt keine Einzelabfrage; die View-Liste enthält es nicht; VS-5 muss jede Anfrage nach einer nicht gelisteten ID wie eine nach einer nicht existierenden beantworten (I-3) | 8.1 |
| A-37 | Projektion mit Truth einer anderen Revision | `BINDING_MISMATCH`, kein Teilobjekt | 8.2 Schritt 1 |
| A-38 | **Hidden author data**: `motives`, `secrets`, `relationships`, `redHerrings`, `Event.description`, `Evidence.description`, `causedByEventIds` geändert; Map neu an die neue Truth gebunden; gleicher State-Inhalt neu gebunden | `JSON.stringify(projection)` identisch | Test (Form 14.6) |
| A-39 | `Proposition.truth` einer verlinkten Proposition invertiert (Truth neu gebunden) | Projektion identisch | Test |
| A-40 | Red Herring `fingerprint` aus `redHerrings` entfernt bzw. hinzugefügt | Projektion identisch | Test |
| A-41 | **Speaking IDs + Marker**: Fixture mit `SPOILER` in allen Namen/Beschreibungen und `event:ben-kills-clara` | Kein `SPOILER` in der Projektion; `event:ben-kills-clara` erscheint **nur**, wenn ein freigegebener Claim oder `source` es referenziert (dann ist es authored release, D-11); der Test unterscheidet beide Fälle | Leak-Test |
| A-42 | `proposition:ben-guilty-true` ist verlinkt | Die ID erscheint nie; nur `{ claim, direction }` | Leak-Test |
| A-43 | Zwei Propositionen mit identischem Claim (wie `ben-at-library` / `ben-seen-in-library` in der NPC-Fixture), beide von einem Evidence verlinkt | genau **ein** Link in der View; die Propositions-Anzahl ist unsichtbar | 8.2 Schritt 4 |
| A-44 | `links` in der Truth permutiert (Hash unverändert, Arrays sind Mengen) | View bytegleich | Test |
| A-45 | `entries` in der Map permutiert | Projektion und Reducer bytegleich | Test |
| A-46 | `gloves-dirty` entdeckt (source `item:gloves`), `fingerprint` nicht | View enthält nur `gloves-dirty`; kein Hinweis auf Evidence an `item:gloves` oder anderswo | Test |
| A-47 | Zwei Einträge mit gleichem `label` | gültig (Labels sind kein Schlüssel) | R-1 |
| A-48 | **Objekt-Sharing** (M1 `e5764ee`): `projection.evidence[0].links[0].claim` vs. `truth.propositions[j].claim`; `source` vs. `truth.evidence[i].source` | nie referenzgleich; keine Getter/Symbole | Leak-Test |

### 10.5 Verkettung, Erreichbarkeit, Rand (A-49 bis A-57)

| # | Szenario | Erwartet | Stelle |
|---|---|---|---|
| A-49 | ID-Lookalikes (`location:gаrden` mit kyrillischem а) | Regex `[a-z0-9_-]` lehnt ab; keine Normalisierung von Labels (wie alle Tasks) | Schema |
| A-50 | Große Map (10 000 Einträge), 10 000 Aktionen | O(Einträge) pro Aktion ohne Index, O(Ausbeute · log) mit Index; kein rekursiver Algorithmus; keine Grenze nötig | Doku |
| A-51 | **„Circular unlock“ via Wissen**: `evidence:x` nur via `examine_item(item:y)`, und `item:y` wird nur durch `evidence:x` bekannt | In VS-2 erreichbar (keine Wissens-Precondition); in VS-5 nie erreichbar; VS-6 Fixpunkt meldet `EVIDENCE_UNREACHABLE` (I-6). Kein Zyklus im Reducer, weil es keine Unlocks gibt | VS-6 |
| A-52 | Witness zitiert ein `inaccessible` Evidence | VS-6 W3 scheitert mechanisch; VS-2 liefert dafür `accessibleEvidenceIds(map)` (I-1) | VS-6 |
| A-53 | **Unreachable by design**: alle Einträge `inaccessible` | Map gültig; Reducer liefert immer `[]`; Unlösbarkeit ist Befund von VS-6, nicht Parse-Fehler | R-5 |
| A-55 | Input mit `__proto__`-Schlüssel oder Prototyp-Manipulation | `strictObject` meldet `unrecognized_keys`; geklonte Snapshots haben keine fremden Prototypen | Schema |
| A-56 | `action = { kind: "examine_item", itemId: "item:gloves", locationId: "location:garden" }` | `unrecognized_keys` | Schema |
| A-57 | Truth-Revision entfernt `location:garden`; Map-Einträge zeigen darauf | Hash anders ⇒ R-2 scheitert zuerst; selbst mit nachgetragenem Hash scheitert R-6 | R-2, R-6 |
| A-58 | **Multi-Evidence an einem Ziel**: `muddy-path` und `gloves-dirty` beide via garden | `newlyDiscovered: ["evidence:gloves-dirty", "evidence:muddy-path"]` (sortiert, nicht Autorenreihenfolge) | 7.2 |
| A-59 | Reducer mit Map A und State aus Map B derselben Truth (gleiche Bindung, andere Einträge) | Bindung stimmt ⇒ akzeptiert; das ist A-35 und bewusst nicht in VS-2 erkennbar | Doku |
| A-60 | Projektion eines leeren State | `{ success: true, evidence: [] }`, eingefroren | Test |

Summe: 60 Fälle (A-01 … A-60). Alle Fälle mit Stelle „Test“, „Schema“, „Reducer“, „Projektion“, „Leak-Test“ oder „R-n/P-n“ sind in VS-2 prüfbar; die mit „VS-6“ oder „Doku“ markierten sind Schnittstellen- oder Dokumentationsfälle.

---

## 11. Solvability Interface

Was VS-6 (und VS-5) von VS-2 brauchen. Nichts davon wird in VS-2 implementiert außer den als „Export in VS-2“ markierten Hilfsfunktionen, die trivial sind und sonst zweimal entstünden.

| # | Bedarf | Lieferant | Form |
|---|---|---|---|
| I-1 | Menge der zugänglichen Evidence-IDs (für W3: zitierte Evidence muss zugänglich sein; für `EVIDENCE_UNREACHABLE`: „authored unerreichbar“ vs. „durch Wissen unerreichbar“ unterscheiden) | **Export in VS-2**: `accessibleEvidenceIds(map): readonly EvidenceId[]` (sortiert) | ≈ 5 Zeilen |
| I-2 | Ausbeute einer Aktion ohne Zustand (für den Fixpunkt `maximalJournal`) | VS-6 ruft `applyInvestigationAction(map, state, action)` auf; eine zusätzliche zustandsfreie Funktion ist nicht nötig | – |
| I-3 | Kollaps von `UNKNOWN_TARGET` und „unbekannt für den Spieler“ zu `UNKNOWN_TO_PLAYER` | VS-5, vor dem Reducer-Aufruf | Regel im VS-5-Contract |
| I-4 | Entitätsreferenzen einer View (für `knownEntities` in VS-5 und den Fixpunkt in VS-6) | **Export in VS-2 (empfohlen)**: `referencedEntities(view): readonly { kind: "person"\|"location"\|"item"\|"event", id }[]` (sortiert, dedupliziert; `source` plus Claim-Felder) | ≈ 15 Zeilen; sonst identischer Code in VS-5 und VS-6 |
| I-5 | Richtung und Wahrheit der Links (W5: `supports` ⇔ `truth:true`) | Truth direkt (`truth.evidence`, `truth.propositions`); VS-2 trägt nichts bei und darf es nicht (die View hat keine `truth`) | – |
| I-6 | Fixpunkt-Skizze: `known₀ = Briefing`; wiederhole: für jede bekannte Entität der drei Zielarten Aktion anwenden, Projektion bilden, `referencedEntities` aller Views zu `known` hinzufügen; bis keine Änderung. Terminiert, weil Entitäten und Evidence endlich und beide Mengen monoton wachsen | VS-6 mit I-1, I-4, Reducer, Projektion | – |
| I-7 | W3 „zitiertes Evidence vor `accuse` entdeckt“ | `state.discoveredEvidenceIds` der Session im Walkthrough (VS-5 hält den State) | – |
| I-8 | Lints auf Autorendaten: (a) ID-Spoiler-Heuristik (D-11), (b) Doppelkanal W8 (personenbezogene Evidence vs. Statement), (c) Label-Heuristik (Label enthält Personennamen aus `truth.persons[].name`, oder „Red Herring“, „Vortag“ ist nicht heuristisch fassbar; nur Namen sind prüfbar) | VS-6, liest Truth + Map | – |
| I-9 | Für den Witness-Walkthrough: Aktionen sind Teil von `Command` in VS-5; VS-2 exportiert `InvestigationActionSchema`, damit VS-5 `investigate(action)` strikt parsen kann | **Export in VS-2** | 0 Zeilen zusätzlich |
| I-10 | `inaccessible` darf vom Witness nie zitiert werden; `label` wird vom Witness nie gelesen | Regel im VS-6-Contract | – |

Daten, die VS-6 **nicht** aus VS-2 bekommt und auch nicht bekommen soll: Red-Herring-Zugehörigkeit (aus Truth), Conclusion-Status (aus VS-1), NPC-Aussagen (aus VS-4).

---

## 12. Proposed Files/APIs

### 12.1 Dateien

| Datei | Inhalt | Zeilen (Schätzung) |
|---|---|---|
| `src/domain/evidence-access.ts` | Schemas (Aktion, Eintrag, Map, State), `parseEvidenceAccessMap`, `createEvidenceAccessMapSchema`, `initialInvestigationState`, `parseInvestigationState`, `applyInvestigationAction`, `accessibleEvidenceIds`, `projectInvestigation`, `referencedEntities` | 260–320 |
| `tests/evidence-access.fixture.ts` | Beispielfall „Der Brieföffner“ Revision 4 (Roadmap §7.1) als Truth-Input + Map-Input; Leak-Fixture mit `SPOILER`-Marker und sprechenden IDs | 180–240 |
| `tests/evidence-access.test.ts` | Map-Parse, State-Parse, Reducer-Eigenschaften, Projektion, Adversarial A-01…A-60 (soweit VS-2) | 450–600 |
| `tests/evidence-access.typecheck.ts` | `@ts-expect-error`: State nicht ohne Parser/Reducer konstruierbar, Views schreibgeschützt, `PlayerClaim` ohne `truth`, Reducer nimmt keine `truth` | 50–70 |

Keine Änderung an bestehenden Dateien. Keine neue Dependency (`zod` 4.6.5, `node:crypto` über `hashCaseTruth`). Ein eigener Projektionsmodul-Split (`evidence-access.projection.ts`, Muster TASK-0004) ist möglich, bringt aber bei < 100 Projektionszeilen nichts (OD-3).

### 12.2 Öffentliche API (vollständig)

```text
// Schemas / Typen
InvestigationActionSchema, InvestigationAction
EvidenceAccessMapInput, EvidenceAccessMap            // Brand "EvidenceAccessMap"
InvestigationStateInput, InvestigationState          // Brand "InvestigationState"
PlayerEvidenceView, PlayerClaim
InvestigationResult, InvestigationProjection

// Map
createEvidenceAccessMapSchema(truth: CaseTruth)
parseEvidenceAccessMap(input: unknown, truth: CaseTruth): EvidenceAccessMap
accessibleEvidenceIds(map: EvidenceAccessMap): readonly EvidenceId[]

// State
initialInvestigationState(map: EvidenceAccessMap): InvestigationState
parseInvestigationState(input: unknown, map: EvidenceAccessMap): InvestigationState

// Reducer
applyInvestigationAction(map, state, action): InvestigationResult

// Projektion
projectInvestigation(map, truth, state): InvestigationProjection
referencedEntities(view: PlayerEvidenceView): readonly { kind, id }[]
```

Importe aus bestehendem Code, alle öffentlich: `CaseIdSchema`, `EvidenceIdSchema`, `LocationIdSchema`, `ItemIdSchema`, `PersonIdSchema`, `TextSchema`, `CaseTruth`, `DeepReadonly` aus `case-truth.ts`; `hashCaseTruth` aus `case-truth.identity.ts`. **Nicht** importiert: `case-solution.ts` (keine Abhängigkeit von TASK-0003), `npc-knowledge*.ts`, `case-semantics.ts`.

### 12.3 Fehlercodes (vollständig)

| Code | Wo |
|---|---|
| Zod-Issues mit Pfad | beide Parser |
| `BINDING_MISMATCH` | Reducer, Projektion |
| `UNKNOWN_TARGET` | Reducer |

Keine weiteren Codes. Insbesondere kein `ALREADY_DISCOVERED`, kein `NOT_DISCOVERED`, kein `NOTHING_FOUND` (jeder davon wäre ein Orakel, D-8).

---

## 13. Size Estimate

| Block | Zeilen |
|---|---|
| Header, Importe, Kommentar | 20 |
| ID-/Aktions-/Eintrags-/Map-Schemas | 45 |
| `checkAccessMap` (Bindung, Referenzen, Duplikate, Vollständigkeit) | 45 |
| Freeze, `createEvidenceAccessMapSchema`, `parseEvidenceAccessMap`, Index-Aufbau | 30 |
| State-Schema, `initialInvestigationState`, `parseInvestigationState` | 40 |
| `applyInvestigationAction` + Aktionsschlüssel | 35 |
| `projectInvestigation` + `PlayerClaim`-Konstruktion + Link-Dedupe/Sort | 60 |
| `accessibleEvidenceIds`, `referencedEntities` | 20 |
| **Summe** | **≈ 295** (Spanne 260–320) |

Vorgabe < 400: erfüllt mit Reserve. Vorgeschlagene Contract-Obergrenze `maxProductionLines: 350` (Roadmap: 350). Rückfalloptionen, falls der Developer über 350 kommt, in dieser Reihenfolge: `referencedEntities` nach VS-5 verschieben (−15), `examine_person` streichen (−8), Index durch lineare Suche ersetzen (−10).

Testumfang: ≈ 700–900 Zeilen über drei Dateien; das ist das Verhältnis der bestehenden Tasks (TASK-0004: 510 Produktion, 1110 Test).

---

## 14. Open Decisions

| # | Frage | Empfehlung | Konsequenz der Alternative |
|---|---|---|---|
| OD-1 | Roh-IDs an den Spieler (wie VS-1-Design und Roadmap §7) oder opake Handles schon in VS-2? | **Roh-IDs**; Handle-Schicht später über VS-5 legen | Handles in VS-2 brauchen Entdeckungsreihenfolge als Zustand (= Spielerwissen) und zwingen VS-1 zur Rückübersetzung |
| OD-2 | `examine_person` behalten? | **Behalten** (eine Union-Variante; physische Spuren an Personen sind ein gängiger Beweistyp) | Streichen spart ≈ 8 Zeilen und 2 Tests; Spuren an Personen müssten als Items modelliert werden |
| OD-3 | Eine Datei oder Split in `evidence-access.ts` + `evidence-access.projection.ts`? | **Eine Datei** | Split folgt TASK-0004-Muster, kostet aber eine zweite Importgrenze für < 100 Zeilen |
| OD-4 | Reducer prüft Ziel-Existenz über ID-Mengen in der Map (Reducer ohne `truth`) oder nimmt `truth` als Parameter? | **Mengen in der Map** (Reducer kann die Truth strukturell nicht leaken) | `truth`-Parameter spart ≈ 6 Zeilen, öffnet aber den Kanal, den D-8 Sperre 1 schließt |
| OD-5 | Map-Identität (`hashEvidenceAccessMap`) jetzt oder in VS-5? | **VS-5**, wenn das Paket es braucht | Jetzt: +40 Zeilen Identity-Modul, State könnte `accessMapHash` tragen und A-35/A-59 schließen |
| OD-6 | Mehrere Zugangswege je Evidence (`via: InvestigationAction[]`)? | **Nein** (D-1) | Additiv als `schemaVersion: 2` der Map möglich |
| OD-7 | `parseInvestigationState` lehnt unsortierte/doppelte Listen ab oder normalisiert? | **Ablehnen** | Normalisieren macht Save/Load tolerant, aber ein manipulierter Zustand wäre nicht mehr vom echten unterscheidbar |
| OD-8 | `label` in der Map (D-6), `Evidence.description` freigeben, oder kein Text? | **`label`** | Siehe D-6 |
| OD-9 | `inaccessible` explizit (D-1) oder Roadmap-Regel „Evidence ohne Eintrag ⇒ Parse-Fehler, Autor entfernt sie aus der Truth“? | **Explizit** | Roadmap-Regel bricht NPC-Snapshots mit `observed_evidence` auf verbrannte Beweise |
| OD-10 | Task-ID und Einordnung: VS-2 = `TASK-0006`? Die Accusation (VS-1) war als „MYSTERY-NEXT“ ohne ID gesetzt; TASK-0005-Review verwendet „TASK-0006“ bereits für Verbalization | Seb vergibt IDs; dieses Dokument verwendet keine | Nummernkollision mit dem Hinweis im TASK-0005-Review (V2-O1/O2 nennt „TASK-0006“ für Verbalization) |
| OD-11 | Soll VS-2 `validateCaseSemantics` als Vorbedingung verlangen (Map nur auf widerspruchsfreien Truths)? | **Nein**; das ist Paket-Lint in VS-5 (Roadmap) | Jetzt: Abhängigkeit von TASK-0002 ohne Nutzen für VS-2 |

Keine dieser Entscheidungen ändert die Abschnitte 4–9 strukturell; alle sind lokal.

---

## 15. Draft Contract Shape

Nur Skizze im Format 2 (`FORGE-CONTRACT-SYSTEM-V2.md` §3.1–3.3). **Kein Contract.** Task-ID, Titel, Mutanten-`before`-Strings und Zeilen sind Platzhalter, die der Spec-Author gegen den dann aktuellen `main` festlegt; `specifiedAgainst` ist der heutige `main`-Head.

```text
---json
{
  "forgeContractFormat": 2,
  "taskId": "<OD-10>",
  "title": "Evidence Access & Investigation Actions",
  "contractVersion": 1,
  "supersedes": null,
  "specifiedAgainst": "3d7545d843883418348004e68717399a64da7a7d",
  "dependencies": [
    { "taskId": "TASK-0001", "acceptedCommit": "<Commit von TASK-0001 auf der First-Parent-Kette>", "provenance": "legacy" }
  ],
  "reads": [
    "src/domain/case-truth.ts",
    "src/domain/case-truth.identity.ts",
    "src/domain/npc-knowledge.projection.ts",
    "tests/case-truth.fixture.ts",
    "tests/npc-knowledge.projection.test.ts"
  ],
  "scope": {
    "create": [
      "src/domain/evidence-access.ts",
      "tests/evidence-access.fixture.ts",
      "tests/evidence-access.test.ts",
      "tests/evidence-access.typecheck.ts"
    ],
    "modify": []
  },
  "requiredChecks": [
    { "name": "typecheck", "command": "npm run typecheck" },
    { "name": "test", "command": "npm test" }
  ],
  "mutants": [
    {
      "id": "ACCESS-IGNORES-COMPLETENESS",
      "file": "src/domain/evidence-access.ts",
      "before": "<Zeile, die eine fehlende Evidence als Issue meldet>",
      "after": "<dieselbe Zeile ohne Meldung>",
      "tests": ["tests/evidence-access.test.ts"]
    },
    {
      "id": "REDUCER-USES-SOURCE",
      "file": "src/domain/evidence-access.ts",
      "before": "<Vergleich actionKey(entry.via) === actionKey(action)>",
      "after": "<Vergleich gegen die source-ID statt via>",
      "tests": ["tests/evidence-access.test.ts"]
    },
    {
      "id": "PROJECTION-LEAKS-TRUTH",
      "file": "src/domain/evidence-access.ts",
      "before": "<Konstruktion { claim, direction }>",
      "after": "<Konstruktion { claim, direction, truth: proposition.truth }>",
      "tests": ["tests/evidence-access.test.ts"]
    },
    {
      "id": "PROJECTION-SHARES-CLAIM",
      "file": "src/domain/evidence-access.ts",
      "before": "<feldweiser Neuaufbau des Claims>",
      "after": "<claim: proposition.claim>",
      "tests": ["tests/evidence-access.test.ts"]
    },
    {
      "id": "STATE-ACCEPTS-UNSORTED",
      "file": "src/domain/evidence-access.ts",
      "before": "<Sortierprüfung in parseInvestigationState>",
      "after": "<Prüfung entfernt>",
      "tests": ["tests/evidence-access.test.ts"]
    }
  ],
  "limits": {
    "maxProductionLines": 350,
    "maxChangedFiles": 4
  },
  "findings": []
}
---
# <taskId> FINAL IMPLEMENTATION CONTRACT

## 1. Verbindliche Basis und Ziel
   (D-1 … D-11 dieses Dokuments als normative Regeln; Trennung Truth / Map / State / View)
## 2. Exakte erlaubte Implementierungsdateien
   (scope.create, keine Modifikation)
## 3. Endgültiges Datenmodell
   (Abschnitt 4.1, 5)
## 4. Endgültige öffentliche API
   (Abschnitt 12.2, 12.3)
## 5. Bindungsregeln
   (Abschnitt 9)
## 6. Reducer-Semantik und Eigenschaften
   (Abschnitt 7)
## 7. Projektion und Spoiler-Isolation
   (Abschnitt 8; Allowlist, feldweiser Neuaufbau, Leak-Test-Form)
## 8. Acceptance Criteria
   (Abschnitt 7.3 Eigenschaften, 10.1–10.4 als Testmatrix, Beispiel „Der Brieföffner“ Revision 4)
## 9. Adversarial Tests der Informationsbarriere
   (A-36 … A-48)
## 10. Non-Goals
   (Zeit, Kosten, Unlocks, Spielerwissen, Einzelabfrage, Handles, UI, LLM, Map-Hash, Solvability)
## 11. Schnittstelle zu VS-5/VS-6
   (I-1 … I-10, nur als Dokumentation; keine Implementierung)
## 12. Maximale Produktionscodegröße
   (350; Rückfalloptionen Abschnitt 13)
<!-- END OF CONTRACT <taskId> v1 -->
```

Hinweise zur Form: `reads ∩ scope.create = ∅` eingehalten; `modify` leer, daher keine `MUTANT_NOT_APPLICABLE`-Prüfung an `specifiedAgainst` (Mutanten auf `create`-Dateien prüft erst der Verifier); `dependencies` als `legacy`, weil TASK-0001 vor dem Forge-Prozess gemerged wurde (Format-2-Regel §3.3); Pflichtabschnitte `Acceptance Criteria` und `Non-Goals` vorhanden; kein Statusfeld, kein `baseCommit`.

---

**STOP.** Keine Implementierung. Keine Dateien im Repository geändert, keine Commits, keine PRs.
