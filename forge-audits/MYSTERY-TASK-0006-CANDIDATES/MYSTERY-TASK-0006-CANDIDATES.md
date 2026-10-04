# Mystery: Kandidaten für TASK-0006

Rolle: Lead Game Systems Architect, read-only. Keine Dateien im Repo geändert, keine Commits, keine PRs.
Stand: 2026-10-03. Geprüft: alle Remote-Branches von `Wuerfelduell/Forge`.
Auf `codex/mystery-task-0005` (fab792a): `npm ci`, `npm run typecheck` (Exit 0) und `npm test` laufen durch: 7 Testdateien, **452 Tests grün**.

---

## 1. Inventar

### 1.1 Branch-Topologie

```
f5dbc73  main (nur .gitkeep)
  └ b8460b4 → 27075fe → de5feb9 → 3169529 → 5bfa5a4 → 6a8c0c5 → e9cb8e2      (gemeinsamer Stamm)
        ├ codex/mystery-task-0005:  1de7efe (M1) → fc01e4a → 0453f85 → fab792a
        ├ claude/forge-architecture-review-hjdq89: Forge-Core 0001A/B … → f712e50 → be40a68
        └ codex/forge-core-v2-repair: … f712e50 → 2d4276b … → b9339d2
codex/task-0004-contract = 6a8c0c5 (nur Contract, kein Code)
```

Der Produktionscode unter `src/domain` ist auf allen drei Arbeitsbranches **identisch**. Der einzige Unterschied im Domain-Bereich ist der Test-only-Fix M1 (`1de7efe`, +17 Zeilen in `tests/npc-knowledge.projection.test.ts`), der nur auf `codex/mystery-task-0005` liegt.

### 1.2 Status je Task

| Task | Inhalt | Implementiert | Contract im Repo | Review | Lage | Baseline (`main`) |
|---|---|---|---|---|---|---|
| TASK-0001 | CaseTruth, immutables Domain-Modell (+ Tooling b8460b4) | ja, `27075fe` | nein | laut Seb extern, kein Artefakt im Repo | Stamm aller Arbeitsbranches | nein |
| TASK-0001a | Safe-Integer-Ticks, Red-Herring-Semantik | ja, `de5feb9` | nein | wie oben | Stamm | nein |
| TASK-0002 | Semantic Case Validator V1 (`case-semantics-v1`) | ja, `3169529` | nein | wie oben | Stamm | nein |
| TASK-0003 | CaseSolution / Answer Key, an `truthHash` gebunden | ja, `5bfa5a4` | nein | ChatGPT PASS laut Seb, kein Artefakt im Repo | Stamm | nein |
| TASK-0004 | NPC Knowledge & Belief + Projektion `NpcVisibleContext` | **ja**, `e9cb8e2` (+ Test-Fix M1 `1de7efe` nur auf Side-Branch) | ja, v1 `6a8c0c5`, YAML-Frontmatter | Metadaten widersprüchlich: `status: approved`, aber `architecture_review: pending_chatgpt_final_check`; M1-Verifikation `forge/reviews/TASK-0004-M1-verification.md` | Stamm (Code), M1 nur `codex/mystery-task-0005` | nein |
| TASK-0005 | Deterministic NPC Dialogue Policy | **nein**, auf keinem Branch existiert `npc-dialogue-policy.ts` | ja, v2 `0453f85` (`status: review_ready`, `implementation_gate: blocked_pending_approval`) | Claude v1 REQUEST_CHANGES (`8357672`), Claude v2 APPROVE (`be40a68`, nur auf Claude-Branch), ChatGPT-Finalcheck offen | Contract auf `codex/mystery-task-0005`, Review auf Claude-Branch | nein |

Abweichung zur Darstellung „TASK-0004 ist nur ein Draft“: Im Git existieren ein als `approved` markierter v1-Contract und eine vollständige, getestete Implementierung. Dieser Widerspruch ist weiterhin ungeklärt (siehe `FORGE-CONTRACT-HANDOFF-AUDIT.md`).

**Nicht Bestandteil irgendeiner Baseline:** Nichts. `main` enthält ausschließlich `.gitkeep`, es gibt keine PRs und im Forge-Core-ForgeLog ist kein Mystery-Task `accepted`.

### 1.3 Was das Domain-Modell heute tatsächlich kann

| Schicht | Modul | Tatsächliche Fähigkeit | Fehlt |
|---|---|---|---|
| Objektive Welt | `case-truth.ts` | Personen, Orte, Items, Beziehungen, Events (Zeit, Ort, Teilnehmer, Items, Ursachen), Motive, Propositionen (nur `personAt`, `eventHasParticipant`, `eventHasItem`), Evidence (Quelle + `supports`/`refutes`-Links auf Propositionen), Secrets, Red Herrings. Tief eingefroren, gebrandet, `hashCaseTruth`. | Wo, wann und wie Evidence auffindbar ist. Keine Ortsgraphen. |
| Weltkonsistenz | `case-semantics.ts` | Raum-, Claim- und Kausalwidersprüche, deterministisch sortiert. | Ausdrücklich keine Lösbarkeit, keine Evidence-Richtung, keine Schuld. |
| Answer Key | `case-solution.ts` | Resolutions je Event (Verantwortung mit Rollen, Vollständigkeit, Intent, Mechanismus, `causesComplete`), Conclusions (6 Claim-Arten), `requiredConclusions` als Literale. Interne Wahrheitstabelle `resolveConclusion` (true/false/undetermined) ist **privat**. | Öffentlicher Evaluator, Anklage, Urteil. Verbindung Evidence → Conclusion. |
| NPC-Epistemik | `npc-knowledge.ts`, `.projection.ts` | Statische Snapshots je NPC (awareness, knowledge/belief/uncertain), Provenance nur als Annotation; Projektion mit lokalen Handles, 9 Claim-Formen, ohne IDs/Namen/Wahrheitswerte. | Keine automatische Ableitung, keine History, keine Weitergabe. |
| Dialog | TASK-0005 (nur Contract) | Query + Runtime-Policy → genau ein `CommunicativeAct`. | Implementierung, ConversationState, Verbalization. |
| Spieler | – | nichts | Player Knowledge, Aktionen, Anklage. |

Zwei Lücken prägen die Kandidatenwahl:

1. **Zwischen Evidence und Conclusions gibt es keine Brücke.** Evidence stützt nur Orts- und Teilnahme-Propositionen; die Lösung spricht über Verantwortung, Rolle, Intent, Mechanismus und Kausalität. Lösbarkeit ist deshalb heute nicht einmal formulierbar.
2. **Das Spielende ist nicht prüfbar.** Der Answer Key existiert, aber niemand kann eine Spielerbehauptung gegen ihn auswerten, weil der Evaluator privat ist.

---

## 2. Kandidaten-Screening

| Kandidat | Urteil für TASK-0006 | Grund |
|---|---|---|
| NPC Knowledge Weiterentwicklung | später | TASK-0004-Status ist ungeklärt; jede Änderung baut auf einem umstrittenen Fundament. |
| Knowledge Transfer | später | Braucht Zeit-/History-Modell; TASK-0004 ist bewusst „Snapshot statt History“. |
| Observation (Wissen aus Zeugenschaft ableiten) | später | Widerspricht TASK-0004 Regel 14 „keine automatische Zuteilung“; das ist eine Architekturentscheidung, kein kleiner Task. |
| Dialogue Policy | ist TASK-0005 | Contract liegt vor, Implementierung wartet auf Freigabe. |
| Deterministic Interrogation | später | Hängt an der TASK-0005-Implementierung (parallele Abhängigkeit). |
| Player Knowledge | später | Sinnvoll erst, wenn klar ist, was der Spieler erwerben kann (Evidence-Zugang, Aussagen). |
| **Evidence Discovery** | **Kandidat B** | Klein machbar, schließt die Lücke „wo findet man Evidence“. |
| Investigation Actions | in B enthalten | Ohne Discovery-Modell inhaltsleer. |
| **Accusation Model** | **Kandidat A** | Zusammen mit Solution Evaluation. |
| **Solution Evaluation** | **Kandidat A** | Baut ausschließlich auf TASK-0003. |
| **Solvability** | **Kandidat C** (statische Vorstufe) | Hoher Wert, aber mehr offene Designentscheidungen. |
| Case Generator | deutlich später | Braucht Solvability als Orakel. |
| Living World Events | deutlich später | Braucht Zeitfortschreibung, Knowledge Transfer und Observation. |

---

## 3. Drei TASK-0006-Kandidaten

### Kandidat A: Accusation Model & deterministischer Urteilsevaluator

**Goal**
Eine Spieleranklage als strukturierte Menge von Conclusion-Claims mit Polarität (zum Beispiel „person:a ist `direct_actor` für event:poisoning“, „Intent = intended“) gegen eine gebundene `CaseSolution` auswerten. Ergebnis ist ein deterministisches, eingefrorenes Urteil: gelöst, falsch oder unvollständig. Zusätzlich gibt es eine bewusst minimale spielerseitige Sicht, die den Answer Key nicht ausleakt (analog zur Trennung `intent`/`act` aus TASK-0005).

**Warum jetzt?**
- Es schließt die Mystery-Kette am Ende: Ohne Urteil gibt es keinen Siegzustand, und der Answer Key aus TASK-0003 bleibt ungenutzt.
- Es braucht nur TASK-0001 bis 0003, also den Teil, dessen Status niemand bestreitet. Die offene Frage zu TASK-0004 und die TASK-0005-Freigabe berühren es nicht.
- Die Wahrheitstabelle existiert bereits (`resolveConclusion`, TASK-0003 §6). Der Task stellt also keine neue Fachsemantik auf, sondern macht eine vorhandene nutzbar.
- Objektive Wahrheit wird nur gelesen, nie verändert, und für die Auswertung wird kein LLM gebraucht.

**Dependencies**
- Code: `case-truth.ts`, `case-truth.identity.ts`, `case-solution.ts`, `case-solution.identity.ts` (TASK-0001/0001a/0003).
- Keine Abhängigkeit von TASK-0002, 0004 oder 0005.
- Forge-Prozess: Da im ForgeLog kein Mystery-Task `accepted` ist, wäre `dependencies` entweder leer oder `{taskId: "TASK-0003", acceptedCommit: null}`; die Code-Bindung erfolgt über `baseCommit`.

**Expected files** (Richtwert, der Contract legt fest)
- neu: `src/domain/case-accusation.ts`
- neu: `tests/case-accusation.fixture.ts`, `tests/case-accusation.test.ts`, `tests/case-accusation.typecheck.ts`
- Designentscheidung im Contract: entweder `src/domain/case-solution.ts` minimal ändern und die Wahrheitstabelle als reine Funktion exportieren (`scope.modify`), oder die Tabelle im neuen Modul spiegeln und durch einen Differentialtest gegen das Parse-Verhalten absichern. Empfehlung: exportieren, damit es genau eine Quelle der Wahrheit gibt.

**Expected production size**
Etwa 220 bis 350 Zeilen (zum Vergleich: `case-solution.ts` hat 296, `npc-knowledge.ts` 303). Obergrenze im Contract: 400.

**Acceptance-test potential: sehr hoch**
- Vollständige Matrix: jede der 6 Claim-Arten × true/false/undetermined × Polarität der Anklage.
- Metamorphe Tests: Reihenfolge der Anklagepunkte und Property-Reihenfolge ändern das Urteil nicht; ein zusätzlicher korrekter, aber nicht geforderter Punkt ändert das Urteil nicht (oder gezielt doch, je nach Contract-Regel); ein einzelner widersprechender Punkt kippt das Urteil auf „falsch“.
- Bindung: Anklage gegen fremde Solution oder fremde Truth wird abgewiesen.
- Informationsbarriere: Die Spieler-Sicht ist bytegleich für alle falschen Anklagen derselben Fehlerklasse und enthält keine Conclusion-IDs, keine Liste fehlender Punkte, keine Resolution-Daten.
- Bestehende 452 Tests bleiben unverändert grün; `mutationSmoke` ist sinnvoll `required`.

**Risks**
- *Orakel-Missbrauch:* Wenn das Urteil pro Anklagepunkt richtig/falsch meldet, kann ein Host den Answer Key abfragen. Gegenmaßnahme: Die Spieler-Sicht ist nur ein Gesamturteil; Versuchslimits sind Host-Sache und ausdrücklich Non-Goal.
- *Semantik von „undetermined“:* Ein Anklagepunkt, den die Lösung offenlässt, ist weder richtig noch falsch. Der Contract muss festlegen, ob er ignoriert wird oder die Anklage ungültig macht. Empfehlung: zählt nicht als Fehler, erfüllt aber auch keine Pflicht.
- *Domain-IDs in der Anklage:* Spieler-Handles existieren noch nicht, deshalb nimmt V1 Domain-IDs entgegen. Später braucht es einen Adapter aus der Spieler-Sicht. Das ist ein bewusst offener Punkt, kein Leck, weil der Evaluator auf Host-Seite läuft.
- *Änderung einer Baseline-Datei:* Wenn `resolveConclusion` exportiert wird, muss der Contract den Diff auf genau diesen Export begrenzen.

**What it unlocks next**
Einen Siegzustand und damit einen headless spielbaren Fall. Solvability kann später formal fragen: „Gibt es eine aus erreichbarer Evidence begründbare Anklage, die der Evaluator als gelöst wertet?“ Der Case Generator bekommt sein Abnahmekriterium. Player Knowledge bekommt ein Ziel, auf das hingearbeitet wird.

---

### Kandidat B: Evidence Discovery Map & deterministische Investigation Actions

**Goal**
Ein an `truthHash` gebundenes, authored Dokument `EvidenceAccessMap`, das für jedes Evidence-Stück festlegt, wie es entdeckt werden kann: zum Beispiel `search_location(locationId)`, `examine_item(itemId)`, `examine_person(personId)`, jeweils mit `availableFrom`-Tick. Dazu eine reine Funktion `applyInvestigationAction(discovered, action, tick)`, die die neu entdeckten Evidence-IDs sortiert und eingefroren zurückgibt.

**Warum jetzt?**
- Es schließt die erste große Lücke: Evidence existiert objektiv, ist aber nicht erreichbar. Ohne Zugangsmodell gibt es keine Ermittlung und keine Lösbarkeit.
- Es baut nur auf TASK-0001 auf und ist rein deterministisch.

**Dependencies**
- Code: `case-truth.ts`, `case-truth.identity.ts`. Optional `case-semantics.ts`, wenn die Map nur auf widerspruchsfreien Fällen gültig sein soll.
- Keine Abhängigkeit von 0003, 0004 oder 0005.

**Expected files**
- neu: `src/domain/evidence-access.ts`
- neu: `tests/evidence-access.fixture.ts`, `tests/evidence-access.test.ts`, `tests/evidence-access.typecheck.ts`

**Expected production size**
Etwa 300 bis 450 Zeilen. Obergrenze im Contract: 500.

**Acceptance-test potential: hoch**
- Referenzintegrität und Bindung (wie bei TASK-0003/0004).
- Zeitregeln: Evidence vor `availableFrom` ist nicht entdeckbar, danach immer. Zum Beispiel darf eine Spur, die aus `event:walk` stammt, nicht vor dem Event-Start verfügbar sein; diese Regel ist eindeutig prüfbar.
- Idempotenz und Monotonie: dieselbe Aktion zweimal liefert beim zweiten Mal nichts Neues; die Reihenfolge der Aktionen ändert die Endmenge nicht.
- Evidence mit `source.kind = "person"` (Aussagen) ist die Schnittstelle zu Befragungen; der Contract muss festlegen, ob sie hier überhaupt entdeckbar ist.

**Risks**
- *Scope-Sog:* Die Arbeit kippt leicht in ein Spieler-Zustandsmodell, Ortsgraphen, Zeitfortschritt und Aktionskosten. Alles davon muss Non-Goal sein.
- *Überschneidung mit Dialog:* Personenbezogene Evidence (Aussagen) gehört eigentlich in die Befragung (TASK-0005 und Folgetask). Wird das hier festgelegt, entsteht eine Schnittstelle zu einem nicht implementierten Task.
- *Zeitmodell:* Welcher Tick gilt für den Spieler? Die objektive Timeline (`timeline.unit = "second"`) beschreibt den Fall, nicht die Ermittlung. Diese Trennung muss der Contract klären, sonst entsteht später Umbauaufwand.
- Mehr offene Designentscheidungen als bei A; als erster Prozess-Task daher riskanter.

**What it unlocks next**
Player Knowledge (Notizbuch), Solvability mit Erreichbarkeit, Hint-System, später Living-World-Events, die Spuren erzeugen oder vernichten.

---

### Kandidat C: Solvability V1 (statisch): Begründungsgraph Evidence → Conclusions

**Goal**
Ein an Truth und Solution gebundenes, authored Dokument `CaseReasoning`, das für jede `requiredConclusion` eine oder mehrere Begründungen als Menge von Propositions-Literalen angibt. Dazu ein Validator, der deterministisch prüft: Jede Prämisse stimmt mit der objektiven Wahrheit überein, jede Prämisse wird von mindestens einem Evidence-Stück in passender Richtung gestützt (`supports` für true, `refutes` für false), und Red-Herring-Evidence zählt nicht als tragende Stütze. Das Ergebnis ist ein sortierter Findings-Report im Stil von `case-semantics-v1`.

**Warum jetzt?**
- Es baut die fehlende Brücke zwischen Evidence und Conclusions, also das Herz eines fairen Mystery.
- Es ist das Qualitätskriterium für jeden späteren Case Generator.

**Dependencies**
- Code: `case-truth.ts`, `case-solution.ts` und beide Identity-Module (TASK-0001 und 0003).
- Fachlich hängt die volle Lösbarkeit von Kandidat B (Erreichbarkeit) ab; die statische Version prüft nur Begründbarkeit, nicht Auffindbarkeit.

**Expected files**
- neu: `src/domain/case-reasoning.ts`
- neu: `tests/case-reasoning.fixture.ts`, `tests/case-reasoning.test.ts`, `tests/case-reasoning.typecheck.ts`

**Expected production size**
Etwa 350 bis 500 Zeilen. Obergrenze im Contract: 550.

**Acceptance-test potential: mittel bis hoch**
Die Prüfregeln selbst sind gut testbar (Matrix aus Wahrheit, Richtung und Red Herring, Bindung, Sortierung). Ob eine Begründung fachlich trägt, prüft das System aber nicht: Die Inferenz von „Anna war am Tatort, ihre Fingerabdrücke sind auf dem Messer“ zu „Anna ist `direct_actor`“ bleibt eine Autorenbehauptung.

**Risks**
- *Scheinsicherheit:* Ein grüner Report bedeutet „unter den vom Autor deklarierten Begründungen lösbar“, nicht „lösbar“. Das muss im Namen und Contract stehen, sonst wird es falsch verwendet.
- *Logik-Engine-Sog:* Die naheliegende Erweiterung zu echten Inferenzregeln (Alibi, Gelegenheit, Motiv) ist ein eigenes Großprojekt.
- *Ausdrucksarmut der Propositionen:* Es gibt nur drei Claim-Arten. Motive, Beziehungen und Secrets sind keine Propositionen und können daher keine Prämissen sein. Der Task stößt schnell an diese Grenze und erzeugt Druck, das Truth-Schema zu ändern; das gehört nicht in einen ersten Prozess-Task.
- Höchste Zahl offener Designentscheidungen der drei Kandidaten.

**What it unlocks next**
Mit Kandidat B kombiniert eine echte Solvability-Prüfung; danach Case-Generator-Abnahme, Hint-System und Schwierigkeitsgrade.

---

## 4. Vergleich

| Kriterium | A Accusation & Verdict | B Evidence Discovery | C Solvability statisch |
|---|---|---|---|
| Klein genug für klaren Contract | **ja**, Semantik existiert bereits | ja, mit striktem Non-Goal-Katalog | knapp |
| Deterministisch testbar | **vollständig** (geschlossene Matrix) | vollständig | Regeln ja, Fachsinn nein |
| Runtime-LLM nötig | nein | nein | nein |
| Nutzen fürs Spiel | Siegzustand, Spielende | Ermittlung wird möglich | Fairness-Garantie |
| Baut auf tatsächlichem Modell | ja, auf `resolveConclusion` | ja, auf `Evidence.source` | ja, aber stößt an Grenzen der Propositionen |
| Parallele Abhängigkeiten | **nur 0001–0003** | nur 0001 | 0001 + 0003, fachlich B |
| Offene Designentscheidungen | 3 (undetermined, Export vs. Spiegel, Spieler-Sicht) | 4–5 (Zeit, Aussagen, Zustand, Kosten) | 5+ |
| Eignung als erster Forge-Prozess-Task | **sehr gut** | gut | mäßig |

---

## 5. RECOMMENDED TASK-0006

**Kandidat A: Accusation Model & deterministischer Urteilsevaluator.**

Begründung in einem Satz: Es ist der einzige Kandidat, dessen Fachsemantik schon vollständig im geprüften Code steckt (`resolveConclusion`, TASK-0003 §6), der nur vom unstrittigen Teil der Baseline abhängt und dessen Abnahme sich als geschlossene Matrix formulieren lässt. Damit testet der erste Durchlauf durch den neuen Forge-Prozess den Prozess und nicht unsere Fähigkeit, offene Spieldesign-Fragen zu klären.

Vor dem Contract müssen wir gemeinsam drei Punkte entscheiden:

1. Wird die Wahrheitstabelle aus `case-solution.ts` exportiert (eine Datei in `scope.modify`) oder im neuen Modul gespiegelt und differentiell getestet? Meine Empfehlung: exportieren.
2. Wie zählt ein Anklagepunkt, den die Lösung als `undetermined` offenlässt? Meine Empfehlung: kein Fehler, aber auch keine erfüllte Pflicht.
3. Was sieht der Spieler? Meine Empfehlung: nur `solved` / `not_solved`, und das interne Report-Objekt geht nie an die Spieler-Sicht.

Prozesshinweise für den Contract:

- Das Format muss der Forge-Core-Parser lesen können (`---json`-Frontmatter mit `forgeContractFormat`, `taskId`, `contractVersion`, `baseCommit`, `dependencies`, `scope.create/modify`, `requiredChecks`, `mutationSmoke`). Die bisherigen Mystery-Contracts nutzen YAML und werden vom Kernel abgelehnt.
- Die Wahl des `baseCommit` ist offen, weil es keinen Branch gibt, der Forge-Core v2 (`b9339d2`) und den neuesten Mystery-Stand (`1de7efe`/`fab792a`) zugleich enthält. Für Kandidat A ist das unkritisch, da sich die Domain-Produktionsdateien auf beiden Linien nicht unterscheiden. Trotzdem muss es einmal festgelegt werden, am besten mit einer zusammengeführten Baseline auf `main`.
- Namenskollision: Die Claude-Reviews zu TASK-0005 (`forge/reviews/TASK-0005.v2.architecture-review.md`, V2-O1 und V2-O2) verweisen auf „TASK-0006“ als Ort für Verbalization und ConversationState. Wird TASK-0006 die Anklage, müssen diese Übergaben auf den späteren Befragungs-Task umgeschrieben werden (in der Roadmap unten TASK-0009).

---

## 6. Mystery-Roadmap (nächste etwa fünf Domain-Tasks)

Keine UI, keine Grafik, kein Runtime-LLM. Jeder Schritt liest objektive Wahrheit nur; keiner verändert sie.

| # | Task | Baut auf | Ergebnis |
|---|---|---|---|
| parallel | **TASK-0005 implementieren** (Dialogue Policy, Contract v2 liegt vor) | 0004 | Nach ChatGPT-Finalcheck. Läuft unabhängig von 0006, da keine Dateiüberschneidung. |
| 1 | **TASK-0006 Accusation & Verdict** | 0001–0003 | Siegzustand. Ein Fall hat erstmals Anfang (Truth), Lösung und Ende (Urteil). |
| 2 | **TASK-0007 Evidence Discovery Map & Investigation Actions** (Kandidat B) | 0001 | Evidence wird erreichbar; erste deterministische Spieleraktionen. |
| 3 | **TASK-0008 Solvability V1** (Kandidat C plus Erreichbarkeit aus 0007) | 0003, 0006, 0007 | Prüfbare Aussage: „Aus entdeckbarer Evidence ist eine Anklage begründbar, die 0006 als gelöst wertet.“ |
| 4 | **TASK-0009 Deterministic Interrogation Session** (ConversationState über 0005, übernimmt V2-O1/O2) | 0004, 0005 | Befragung über mehrere Fragen hinweg; Aussagen werden als Spieler-Information erfassbar. |
| 5 | **TASK-0010 Player Case Journal & headless End-to-End-Fall** | 0006, 0007, 0009 | Spielerwissen aus entdeckter Evidence und gehörten Aussagen, Anklage daraus, ein vollständig skriptbar durchspielbarer Testfall. |

Danach, in dieser Reihenfolge sinnvoll: Observation und Knowledge Transfer (NPC-Wissen aus Zeugenschaft und Weitergabe, benötigt eine Entscheidung gegen TASK-0004 Regel 14 und ein History-Modell), Living World Events, Case Generator (mit 0008 als Abnahmeorakel), und erst dann Verbalization mit LLM, die ausschließlich `act` erhält.

Kurz zur Reihenfolge: Ich setze das Ende der Kette (Urteil) vor die Mitte (Ermittlung), weil sich so jeder Folgetask an einem festen Ziel messen lässt. Solvability kommt erst, wenn Erreichbarkeit modelliert ist, sonst prüft sie nur die halbe Frage.

---

## 7. Belege

- Topologie: `git log --graph --all` am 2026-10-03; Branch-Dateilisten über `git ls-tree`.
- Code: `src/domain/*.ts` auf `codex/mystery-task-0005` @ `fab792a`; `resolveConclusion` in `src/domain/case-solution.ts` (privat, Wahrheitstabelle TASK-0003 §6).
- Contracts: `forge/contracts/TASK-0004.md` (v1, Frontmatter `status: approved` / `architecture_review: pending_chatgpt_final_check`), `forge/contracts/TASK-0005.md` (v2, `review_ready`, §17 Non-Goals nennt TASK-0006 ausdrücklich als nicht enthalten).
- Forge-Core-Format: `src/forge/contract-document.ts` auf `codex/forge-core-v2-repair` (`FRONTMATTER_OPEN = "---json\n"`, `DependencyRefSchema = {taskId, acceptedCommit | null}`).
- Tests: `npm run typecheck` Exit 0, `npm test` 452/452 grün auf `fab792a`.
