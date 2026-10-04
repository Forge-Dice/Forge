# MYSTERY SOLVABILITY V1 RESEARCH

Status: **Research/Design, read-only.** Keine Implementierung, keine Commits, keine PRs, keine Task-IDs vergeben. Arbeitstitel: **VS-6 Solvability**.
Stand: 2026-10-03. Repository `Forge-Dice/Forge`, `main` = `3d7545d843883418348004e68717399a64da7a7d` (TASK-0001…0004 + M1).
Verifiziert auf `main`: `npm ci`, `npm run typecheck` Exit 0, `npx vitest run` 22 Dateien, **1087 Tests grün**. Working Tree nach allen Experimenten unverändert (`git status` leer).

Grundlagen (alle gelesen, Stand 2026-10-03):

- Code auf `main`: `src/domain/case-truth.ts`, `case-semantics.ts`, `case-solution.ts`, `npc-knowledge.ts`, `npc-knowledge.projection.ts`, beide Identity-Module, Fixtures `tests/case-truth.fixture.ts`, `case-solution.fixture.ts`, `npc-knowledge.fixture.ts`, Black-Box-Prober `statusOf` in `tests/case-solution.test.ts`.
- TASK-0005 Contract v2 (`origin/codex/mystery-task-0005:forge/contracts/TASK-0005.md`, 514 Zeilen): Entscheidungstabelle §10, Acts §11, V2-O1/O2.
- `MYSTERY-VERTICAL-SLICE-ROADMAP.md` (Fixpunkt `maximalJournal`, Witness W1–W9, Beispiel „Der Brieföffner“ §7, Solvability-Stufen §6).
- `MYSTERY-ACCUSATION-VERDICT-DESIGN.md` (E1–E6, `evaluateConclusionClaim`, `solved ⇔ missing = ∅ ∧ contradicted = ∅`, D1–D10).
- `MYSTERY-TASK-0006-CANDIDATES.md` (Kandidat C „Begründungsgraph“).
- `MYSTERY-VS2-IMPLEMENTATION-DESIGN.md` (lag während der Arbeit vor: `EvidenceAccessMap` mit genau einem Eintrag je Evidence, `via` oder `inaccessible`; drei Aktionen; eine Entdeckungsstufe; keine Unlocks; `PlayerEvidenceView` mit `id/label/source/links{claim,direction}` **ohne** Propositions-IDs; Exporte `accessibleEvidenceIds`, `referencedEntities`; Solvability-Interface §11 I-1…I-10).
- `FORGE-CONTRACT-SYSTEM-V2.md` §3 (Format 2) für die Contract-Skizze in Abschnitt 17.

Was **nicht** vorlag: ein VS-5-Design (Package, Briefing, Session). Alle Annahmen über VS-5 sind als **[A-VS5-n]** markiert; alle Annahmen über VS-4 als **[A-VS4-n]**; alle Annahmen über VS-1 beziehen sich auf das Accusation-Design. Der Begriff `ambiguityPolicy` kommt in keinem vorhandenen Dokument vor; er wird hier erstmals definiert (Abschnitt 10).

Notation: `at(p,l,t)` = `personAt`, `part(e,p)` = `eventHasParticipant`, `item(e,i)` = `eventHasItem`; `resp(p,e)`, `role(p,e,r)`, `none(e)`, `cause(c→e)`, `intent(e,v)`, `mech(e,v)` wie im Accusation-Design. Ein **Literal** ist `⟨claim, value⟩`, geschrieben `claim=T` / `claim=F`.

---

## Kurzfassung

| # | Ergebnis |
|---|---|
| S1 | **Es gibt im heutigen Modell keine Brücke von Propositionen zu Conclusions.** Dieselbe, semantisch widerspruchsfreie Truth „Der Brieföffner“ (Revision 4) akzeptiert vier unvereinbare Answer Keys: Ben, Anna (nie anwesend), Clara (das Opfer), niemand. Alle vier parsen (Experiment Abschnitt 1.3). Logische Lösbarkeit aus Evidence ist im Modell daher **nicht definierbar**; jede Solvability-Prüfung ist eine Prüfung **autorisierter** Inferenz plus mechanischer Erreichbarkeit. |
| S2 | Der Roadmap-Witness (Fixpunkt + W1–W9) prüft Erreichbarkeit und Wahrheitskonformität von Zitaten, aber **nie die Relevanz** eines Zitats für die Conclusion. Jedes wahre, erreichbare Zitat „begründet“ jede Pflicht-Conclusion (Abschnitt 4, RF-01). Er ist eine Nicht-Vakuitäts-Prüfung, keine Lösbarkeitsprüfung. Teile davon überleben. |
| S3 | **Gewählte V1**: Erreichbarkeits-Fixpunkt (VS-2/VS-4/VS-5) + geschlossener Regelsatz (eine semantisch beweisbar korrekte Propositions-Regel `R-EXCL`, zwei Hypothesenraum-Regeln `ELIM`/`CW-NONE`) + **autorisierte Brückenregeln mit Personenvariable**, die der Validator gegen den Fall selbst widerlegt (**case-lokale Gegenbeispielprüfung** über die im Briefing genannten Verdächtigen) + **berechnete** Ableitung (kleinster Fixpunkt) statt autorisierter Beweisschritte. |
| S4 | Der Witness enthält keine Schritte, keine Zitate und kein „trust me“: nur Brückenregel-Schemata und zwei Policies. Alles Übrige berechnet der Validator. Zirkularität, Selbstreferenz, Reihenfolge und Duplikate sind damit **konstruktiv** ausgeschlossen, nicht nur geprüft. |
| S5 | V1 zertifiziert nur Pflicht-Literale der Arten `personResponsibleForEvent` und `noPersonResponsibleForEvent`. `role`, `cause`, `intent`, `mechanism` sind im Propositionsvokabular nicht begründbar; als Pflicht-Literal ⇒ `CONCLUSION_KIND_UNSUPPORTED`. Das ist die ehrliche Grenze von TASK-0001/0003, keine V1-Faulheit. |
| S6 | **`ambiguityPolicy`** regelt genau drei Befunde (`CONFLICT_UNRESOLVED`, `BRIDGE_UNDETERMINED_INSTANCE`, `RESPONSIBILITY_NOT_COMPLETE`): unter `must_be_determined` blockierend, unter `may_remain_ambiguous` Information mit Verdict `certified_ambiguous`. Ein nicht ableitbares Pflicht-Literal ist unter **keiner** Policy zulässig. |
| S7 | Das Beispiel „Der Brieföffner“ ist unter V1 zertifizierbar **genau dann**, wenn das Briefing (VS-5) drei Dinge liefert, die die Roadmap noch nicht vorsieht: Verdächtige `{anna, ben}` (ohne das Opfer), die Zusagen „Täter unter den Verdächtigen“ und „es gibt einen Täter“, und die Spielersicht auf Ort und Zeit bekannter Events. Ohne Verdächtigenmenge ist die Brückenregel „Teilnehmer ⇒ verantwortlich“ durch Clara widerlegt; ohne Event-Sicht ist Annas Alibi nicht mit dem Mord verknüpfbar. |
| S8 | Größe V1: ≈ 320–380 Produktionszeilen in einer Datei, Obergrenze 400; Rückfall: Erreichbarkeit nach VS-5. 58 adversariale Fälle (Abschnitt 11), 8 Mutanten (Abschnitt 17). |

---

## 1. Problem Definition

### 1.1 Der Satz, den Forge/Mystery nicht behaupten darf

„Dieser Fall ist lösbar, weil ein Answer Key existiert.“ Ein `CaseSolution` beweist nur, dass ein Autor eine Auflösung notiert hat, die zu sich selbst passt (TASK-0003: Pflicht-Literale lösen zu ihrem Wert auf). Er beweist nicht, dass ein Spieler sie aus dem, was er sehen und hören kann, erreichen kann. Die Prüfung, die hier entworfen wird, muss deshalb eine **andere** Aussage machen als „der Key existiert“, und sie muss sagen, was sie geprüft hat und was nicht.

### 1.2 Sieben Begriffe, strikt getrennt

| Begriff | Definition in diesem Dokument | Quelle im Modell | Spoiler? |
|---|---|---|---|
| **Objective truth** | Was in der Welt gilt: Events (Ort, Zeit, Teilnehmer, Items, Ursachen) und `Proposition.truth`; dazu die kanonische Auflösung (`resolutions`) als objektiver Teil des Answer Keys | `CaseTruth`, `CaseSolution.resolutions` | ja |
| **Accessible information** | Was ein Spieler ausgehend vom Briefing durch irgendeine Folge erlaubter Kommandos erhalten **kann**: Evidence-Views, Aussagen, Event-Sichten, Briefing-Zusagen. Eine Menge, nicht ein Pfad | Fixpunkt über VS-2-Map, VS-4-Profile, VS-5-Briefing (Abschnitt 9) | nein (ist per Definition spielerseitig) |
| **Player observations** | Was der Spieler in **einem** Durchlauf tatsächlich erhalten hat | `Session.discoveredEvidenceIds`, `Session.statements` (VS-5) | nein |
| **Authored inference** | Vom Autor behauptete Schlussregeln, die Beobachtungen mit Conclusions verbinden | heute: nichts; Roadmap: `justifications.cites`; **V1: `bridgeRules`** im Witness | ja (verrät mit dem Hypothesenraum die Lösung) |
| **Canonical conclusion** | Ein Eintrag des Conclusion-Katalogs mit seinem Status `true / false / undetermined` aus den Resolutions (`resolveConclusion`, TASK-0003 §6) | `CaseSolution.conclusions` + `evaluateConclusionClaim` (VS-1) | ja |
| **Required conclusion** | Pflicht-Literal `(claim, value)`; nie `undetermined` (Parser) | `CaseSolution.requiredConclusions` | ja |
| **Solvability** | Eigenschaft eines **Fallpakets**: Jedes Pflicht-Literal liegt im kleinsten Fixpunkt des zugelassenen Regelsatzes über den **wahren, zugänglichen** Beobachtungen, und die so gebildete Anklage ist `solved` (VS-1). Plus Nebenbedingungen (Abschnitt 5.3) | neu: `certifySolvability` | das Zertifikat ist Autorenwerkzeug, nie spielerseitig |

Zwei Dinge sind **nicht** dasselbe wie Solvability und werden hier nicht behauptet: (a) dass ein Mensch die Ableitung findet (Schwierigkeit), (b) dass der Spieler wahre von falschen Beobachtungen unterscheiden kann, über das hinaus, was Abschnitt 10 (Konfliktauflösung) garantiert.

### 1.3 Der Befund, der alles bestimmt: keine Brücke

Evidence verlinkt ausschließlich Propositionen (`EvidenceLinkSchema.propositionId`, `case-truth.ts` Z. 159–162). Propositionen haben genau drei Claim-Arten: `personAt`, `eventHasParticipant`, `eventHasItem` (Z. 127–144). Conclusions haben sechs **disjunkte** Arten über Verantwortung, Rolle, Kausalität, Intent, Mechanismus (`case-solution.ts` Z. 78–95). `checkSolution` prüft Referenzen und die Konsistenz von Pflicht-Literalen mit den Resolutions (Z. 160–262), aber **nie** Resolutions gegen Events: Wer verantwortlich ist, wird nicht mit Teilnehmerlisten abgeglichen. TASK-0003 sagt das selbst: „responsibility never implies physical presence“ (Z. 17).

Experiment (Scratch-Skript gegen `main`, nichts im Repo geändert): Truth „Der Brieföffner“ Revision 4 nach Roadmap §7.1 (`validateCaseSemantics` → 0 Findings, `truthHash` `1e55a431…`). Vier Answer Keys gegen dieselbe Truth:

| Answer Key | `resolutions[murder].assignments` | Pflicht | Parse |
|---|---|---|---|
| Ben (Roadmap) | `[ben: direct_actor]`, complete | `resp(ben)=T`, `resp(anna)=F` | **OK** |
| Anna, nie am Tatort | `[anna: planner]`, complete | `resp(anna)=T`, `resp(ben)=F` | **OK** |
| Clara, das Opfer | `[clara: direct_actor]`, complete | `resp(clara)=T`, `resp(ben)=F` | **OK** |
| Niemand (Unfall) | `[]`, complete | `resp(ben)=F`, `resp(anna)=F` | **OK** |

Teilnehmer von `event:murder` sind `person:ben, person:clara`; Anna ist kein Teilnehmer. Folgerungen:

1. **Satz (keine Brücke).** Für jede widerspruchsfreie Truth T und jede Menge wahrer Propositions-Literale gibt es gebundene Solutions, die sich in jedem Conclusion-Literal unterscheiden. Die Propositionen determinieren den Answer Key nicht. Beweis: der Parser vergleicht Resolutions nur mit sich selbst (Experiment oben ist eine Instanz).
2. **Kein eingebauter Schluss „Teilnehmer ⇒ verantwortlich“ ist korrekt**: Clara ist Teilnehmerin des Mordes und nicht verantwortlich (sie ist Opfer, `targets`). **Kein eingebauter Schluss „nicht Teilnehmer ⇒ nicht verantwortlich“ ist korrekt**: Giftmischer und Planer sind nie anwesend (TASK-0003-Fixture „Gift im Tee“: Anna verantwortlich für `event:death`, nicht Teilnehmerin).
3. Damit kann **kein** systemseitiger Regelsatz Verantwortung aus Propositionen ableiten. Jede Brücke ist autorisiert. Die Designfrage lautet nicht „wie beweisen wir Lösbarkeit“, sondern: **Welche Voraussetzungen einer autorisierten Brücke sind maschinell prüfbar, so dass die bekannten Fehlschlüsse (Opfer als Täter, Anwesenheit als Schuld, Köder, zwei gleich plausible Verdächtige) mechanisch auffliegen?**

### 1.4 Was „ehrlich“ heißt

Das Zertifikat (Abschnitt 5.3) ist ein Satz mit acht nummerierten Teilaussagen und einer Liste dessen, was es nicht sagt. Jede Teilaussage ist ein deterministischer Test. Nichts im Report ist eine Einschätzung.

---

## 2. Existing Model

### 2.1 Code auf `main` (vollständig gelesen)

| Modul | Was V1 davon nutzt | Verifizierte Fakten (Zeilen auf `main`) |
|---|---|---|
| `case-truth.ts` (340) | Entitäten, Events mit `time`/`locationId`/`participantIds`/`itemIds`, Propositionen mit `truth`, Evidence `links[{propositionId, direction}]`, `redHerrings[{evidenceIds, misleadingPropositionId}]` | `ClaimSchema` drei Arten (Z. 127–144); Evidence adressiert jede Proposition höchstens einmal (Z. 164–183); Red Herring ist ein Paar (Evidence-Menge, **eine** irreführende Proposition) (Z. 190–194); `secrets`, `motives`, `relationships` haben keine Propositionsform |
| `case-semantics.ts` (267) | Als **Vorbedingung** (leerer Report) für die Korrektheit von `R-EXCL` | `PERSON_LOCATION_CONFLICT` über Event-Teilnahme **und** wahre `personAt`-Propositionen (Z. 87–110, 243–260); `PARTICIPANT_CLAIM_MISMATCH` (Z. 141–152); `PERSON_PRESENCE_NEGATED` (Z. 121–138); halboffene Intervalle `start ≤ t < end` (Z. 48–53) |
| `case-solution.ts` (296) | Status eines Conclusion-Claims; `completeness`; `requiredConclusions` | `resolveConclusion` privat (Z. 126–150): `resp` ⇒ `true` falls zugewiesen, sonst `false` bei `complete`, `undetermined` bei `partial`; `none` ⇒ `true` nur bei `complete []`; `cause` nur direkte Kanten (Z. 141–144); Pflicht-Literal nie `undetermined` (Test `tests/case-solution.test.ts:303`) |
| `npc-knowledge.ts` (303) | Attitudes als Quelle potenzieller Aussagen; `knowledge` ist faktiv (Z. 257–260), `belief` darf falsch sein, `uncertain` hat `leaning` | Regel 14 des Contracts: keine automatische Zuteilung (`forge/contracts/TASK-0004.md` Z. 540) |
| `npc-knowledge.projection.ts` (207) | nur mittelbar über VS-4 | Handles `(kind, index)`, 9 Claim-Formen |
| TASK-0005 v2 (Contract) | Acts `assert{value, commitment}`, `express_uncertainty{leaning}`, `claim_ignorance`, `refuse`, `evade`; `invert` kehrt nur die Polarität; `feign_ignorance` nur unter Default `answer` | §10 Entscheidungstabelle; §11 Acts ohne `intent`; V2-O1 |

### 2.2 Was nur als Design existiert und was V1 davon voraussetzt

| Design | Von V1 benutzt | Annahme |
|---|---|---|
| VS-1 Accusation | `evaluateConclusionClaim(truth, solution, claim) → {success, status}`; `parseAccusation`, `evaluateAccusation` (`solved ⇔ missing = ∅ ∧ contradicted = ∅`); lokaler struktureller Claim-Schlüssel | D4/D8 wie Roadmap |
| VS-2 Evidence Access (Design liegt vor) | `EvidenceAccessMap` (ein Eintrag je Evidence: `via` **oder** `inaccessible`), `applyInvestigationAction(map, state, action)`, `projectInvestigation(map, truth, state)` → `PlayerEvidenceView{id, label, source, links[{claim, direction}]}`, `accessibleEvidenceIds(map)`, `referencedEntities(view)` | keine; I-10: `label` wird vom Witness nie gelesen, `inaccessible` nie zitiert |
| VS-3/VS-4 Interrogation | `createInterrogation(truth, solution, snapshot, profile).ask(claim) → Statement{npcId, claim, answer}`; `answer.kind ∈ {assert, express_uncertainty, claim_ignorance, refuse, evade}`; Claim im Statement stammt aus der **Frage** | **[A-VS4-1]** `ask` ist eine reine Funktion von (Snapshot, Profil, Claim); **[A-VS4-2]** eine Frage über eine dem NPC unsichtbare Entität liefert den Default-Act (V2-O1) |
| VS-5 Package/Briefing/Session | `CasePackage` (Truth, Solution, Map, Briefing, NPCs; `validateCaseSemantics` leer, sonst `PACKAGE_INCONSISTENT`); `Briefing.known*Ids`, `interrogablePersonIds`; `knownEntities` = Briefing ∪ `referencedEntities` der Views ∪ Referenzen aus Statements | **[A-VS5-1]** Briefing erhält `hypotheses[]` (Verdächtige + Zusagen je Event, Abschnitt 9.4); **[A-VS5-2]** Briefing exponiert für jedes dem Spieler bekannte Event eine `PlayerEventView{eventId, locationId, time}`; **[A-VS5-3]** bekannte Ticks = Ticks aus zugänglichen Link-Claims ∪ Ticks der Event-Sichten |

### 2.3 Abbildung der sieben Begriffe auf heutige und geplante Objekte

```
objective truth        = CaseTruth ∪ CaseSolution.resolutions         (Autor)
accessible information = Fixpunkt(Briefing, EvidenceAccessMap, Profile) (berechnet, Abschnitt 9)
player observations    = Session.discoveredEvidenceIds ∪ Session.statements (VS-5, nur für E2E)
authored inference     = SolvabilityWitness.bridgeRules                (Autor, Abschnitt 7)
canonical conclusion   = evaluateConclusionClaim(truth, solution, claim) (VS-1)
required conclusion    = CaseSolution.requiredConclusions              (Autor)
solvability            = certifySolvability(package, witness).verdict  (berechnet, Abschnitt 12)
```

---

## 3. Candidate Approaches

Alle fünf Ansätze werden an derselben Frage gemessen: Welche Aussage macht ein grünes Ergebnis, und welche Autorenfehler erkennt es? Zusätzlich ist der Befund aus 1.3 zu beachten: Kein Ansatz kann Verantwortung aus Propositionen **herleiten**, weil das Modell diese Herleitung nicht kennt. Jeder Ansatz, der Lösbarkeit behauptet, muss sagen, woher der Schluss auf Verantwortung kommt.

### 3.1 A · Allgemeiner Begründungsgraph (Kandidat C der TASK-0006-Analyse)

Der Autor liefert je Pflicht-Conclusion Mengen von Propositions-Literalen als „Begründung“. Geprüft wird: jede Prämisse objektiv wahr, jede Prämisse durch Evidence in passender Richtung gestützt, Red-Herring-Evidence zählt nicht. Nicht geprüft: ob die Prämissen die Conclusion tragen. Die Candidates-Analyse nennt das selbst „Scheinsicherheit“. Zusätzlich: Prämissen sind nur Propositionen, also kann der Graph Motive, Beziehungen, Opferrolle nicht ausdrücken; die Erreichbarkeit fehlt ganz (statisch). Ein beliebiger Graph mit autorisierten Implikationen wäre eine Inferenz-Engine ohne Semantik.

### 3.2 B · Fixpunkt + autorisierter Witness (Roadmap VS-6)

Fixpunkt `maximalJournal` für Erreichbarkeit; Witness mit Walkthrough und Zitaten; W1–W9. Geprüft: Walkthrough endet `solved`; jede Pflicht-Conclusion hat ≥ 1 Zitat; Zitate erreichbar, vor `accuse` erhalten, wahrheitskonform (Evidence-Richtung, Statement-Wahrheit), nicht nur Red Herring; Lints W8/W9. Nicht geprüft: Relevanz der Zitate für die Conclusion (Abschnitt 4). Die Roadmap sagt das („nicht logisch beweisbar“), aber die Namen „Solvability“ und „Witness“ versprechen mehr, als W1–W9 halten.

### 3.3 C · Enumerierte Proof Recipes (geschlossener, systemseitiger Regelsatz)

Das System definiert endlich viele Schlussregeln (z. B. „Alibi ⇒ nicht Teilnehmer“, „Teilnehmer ∧ Tatwaffe ⇒ Täter“); der Validator sucht per Forward Chaining aus den zugänglichen Fakten. Vorteil: nichts ist „trust me“, alles deterministisch, keine Autorenlast. Nachteil, und zwar entscheidend: Nach 1.3 existiert **keine** systemseitige Regel von Propositionen zu Verantwortung, die in allen Fällen korrekt ist. Jede eingebaute Brückenregel ist in irgendeinem legitimen Fall falsch (Opfer, Giftmischer, Fluch). Ein reiner Recipe-Ansatz kann also entweder nichts beweisen oder lügt. Was von C bleibt: die **Propositions-Regeln**, die aus `case-semantics-v1` folgen, und der Mechanismus „Forward Chaining über einen geschlossenen Regelsatz“.

### 3.4 D · SAT/Constraint-artig (Modell-Eindeutigkeit)

Kodierung: Variablen für `resp(p,e)` je Person und Event; Constraints aus Truth, Evidence und einer Theorie; Lösbarkeit ⇔ alle Modelle stimmen in den Pflicht-Literalen überein (Eindeutigkeit). Das ist die **richtige Definition** von Lösbarkeit. Problem: Ohne Theorie, die Propositionen mit `resp` verbindet, ist jede Belegung der `resp`-Variablen ein Modell; nichts ist eindeutig; jeder Fall ist „unlösbar“. Die Theorie wäre wieder die autorisierte Brücke. Was von D bleibt: die Eindeutigkeitsidee, angewandt auf einen **endlichen, explizit genannten Hypothesenraum** (die Verdächtigen). Dort ist Eindeutigkeit durch Aufzählung prüfbar, und für Horn-Regeln fällt sie mit dem Forward-Chaining-Fixpunkt zusammen (Lemma L5, Abschnitt 6).

### 3.5 E · Keine automatische Prüfung

Ehrlich, kostenlos, erkennt nichts. Die Slice würde „headless spielbar“ liefern, ohne je zu wissen, ob ein Fall nur mit Spoiler lösbar ist. Für den späteren Case Generator fehlt das Abnahmeorakel. E ist die Nullhypothese, gegen die V1 sich rechtfertigen muss: V1 muss echte Autorenfehler deterministisch erkennen, die E durchlässt, ohne falsche Sicherheit zu erzeugen.

### 3.6 Bewertung

Skala: `++` sehr gut, `+` gut, `o` neutral/bedingt, `−` schlecht, `−−` disqualifizierend. „Soundness“: grün ⇒ der Fall ist mit zugänglicher, wahrer Information lösbar. „Completeness“: lösbarer Fall ⇒ grün (für irgendeinen Witness).

| Kriterium | A Graph | B Fixpunkt+Witness | C Recipes | D SAT | E keine | **V1 (Abschnitt 5)** |
|---|---|---|---|---|---|---|
| Soundness | `−−` Relevanz ungeprüft | `−−` Relevanz ungeprüft | `o` relativ zu Regelgültigkeit; es gibt aber keine gültigen Brückenregeln ⇒ leer | `o` relativ zur Theorie; ohne Theorie leer | – | `+` relativ zu: Semantik-Konsistenz, Briefing-Zusagen, case-lokaler Gegenbeispielfreiheit; jede Relativierung ist im Report benannt |
| Completeness | `++` (akzeptiert fast alles, deshalb wertlos) | `++` (dito) | `−−` | `−−` | – | `o` Regelsatz klein; Diagnose `SUSPECTS_INDISTINGUISHABLE` liefert eine **notwendige** Bedingung |
| Authoring burden | `o` Prämissen je Conclusion | `−` Walkthrough + Zitate je Conclusion, zwei Quellen der Wahrheit (Walkthrough vs. Fixpunkt) | `++` keine | `−−` Theorie schreiben | `++` | `+` 1–3 Regelschemata je Fall + Verdächtige/Zusagen im Briefing (die der Spieler ohnehin braucht) |
| Deterministische Testbarkeit | `+` | `+` | `++` | `o` Solver-Abhängigkeit, außer eigener Aufzähler | – | `++` reine Funktionen, sortierte Reports, Fixpunkt |
| False positives (unfairer Fall grün) | hoch | hoch | niedrig (weil fast nie grün) | niedrig | – | niedrig–mittel: „unnatürliche“ Regel ohne Gegenbeispiel; Testimony-Diskriminierung (Restrisiken Abschnitt 5.4) |
| False negatives (fairer Fall rot) | niedrig | niedrig | sehr hoch | sehr hoch | – | mittel: Fälle, die Besitz, Gelegenheit, Zeitrekonstruktion brauchen, sind nicht ausdrückbar; `role/cause/intent/mech` nie zertifizierbar |
| Scope (Produktionszeilen) | 350–500 + Schemadruck | 200–280 | ≈ 150, aber inhaltsleer | 500+ | 0 | 320–380 |

Konsequenz: Keiner der reinen Ansätze ist brauchbar. B und A scheitern an Relevanz, C und D an der fehlenden Brücke, E an Nutzlosigkeit. V1 kombiniert: Fixpunkt (B), geschlossener Regelsatz mit Forward Chaining (C), Eindeutigkeit über einen endlichen Hypothesenraum (D), und macht die autorisierte Brücke zu einem **Schema mit Variable**, dessen Gültigkeit **im Fall selbst** widerlegbar ist.

---

## 4. Adversarial Critique

Ziel: den Roadmap-Ansatz B (Fixpunkt + Witness W1–W9) widerlegen. Jede Widerlegung ist ein konkreter Witness oder ein konkretes Paket, das die Regeln besteht, obwohl der Fall nicht lösbar ist, oder umgekehrt. Fixture: „Der Brieföffner“ Revision 4 (Roadmap §7).

| # | Angriff | Was W1–W9 sagen | Warum das falsch ist | Überlebt in V1? |
|---|---|---|---|---|
| RF-01 | **Relevanzlücke.** Witness zitiert `evidence:cuff-button` (stützt `part(murder,ben)=T`) für **`resp(anna,murder)=F`** und `evidence:muddy-path` (stützt `at(anna,garden,1500)=T`) für **`resp(ben,murder)=T`** | W2 ≥ 1 Zitat ✓, W3 erreichbar ✓, W5 Richtung passt ✓, W6 kein Red Herring ✓, W1 `solved` ✓ (Pflicht-Literale lösen immer zu ihrem Wert auf) | Die Zitate sind vertauscht und begründen nichts. W1–W9 verbinden Zitat-Inhalt nie mit Conclusion-Inhalt. Jedes wahre erreichbare Zitat begründet jede Pflicht-Conclusion | nein: V1 kennt keine Zitate; Literale müssen über Regeln mit Variable verbunden sein |
| RF-02 | **Opfer als Täter.** Answer Key „Clara did it“ (1.3, parst). Witness zitiert `cuff-button` für `resp(clara)=T` | alle W bestanden | Der Key ist absurd, die Evidence spricht von Ben. B kann einen falschen Key relativ zur Evidence prinzipiell nicht erkennen | teilweise: V1 erkennt ihn **nicht** direkt (kein Ansatz kann; Verantwortung ist nicht herleitbar), aber die Brückenregel „`part(murder,P)=T ⇒ resp(P)=T`“ über Verdächtige `{ben, clara}` hat das Gegenbeispiel Ben (Teilnehmer, laut diesem Key nicht verantwortlich) ⇒ `BRIDGE_COUNTEREXAMPLE`; die Regel „Teilnehmer ⇒ Täter“ ist in diesem Key widersprüchlich, und ohne sie ist nichts ableitbar ⇒ `REQUIRED_NOT_DERIVED` |
| RF-03 | **W5 je Evidence, nicht je Link.** Evidence `fingerprint` hat einen wahren Link (`item(murder,opener)=T`) und einen falschen (`part(murder,anna)=T`). Witness zitiert `fingerprint` für `resp(anna)=T` (Variante mit Key „Anna“) | W5 verlangt nur „≥ 1 Link passt“ ✓ | Das Zitat wirkt über den falschen Link. Granularität ist falsch | nein: V1 arbeitet mit **Link-Literalen**; jeder Link wird einzeln gegen `truth` geprüft |
| RF-04 | **W6 je Evidence.** `fingerprint` ist Red-Herring-Evidence; sein wahrer Link `item(murder,opener)=T` ist damit **nicht** zitierbar (False Negative); umgekehrt ist ein falscher Link in einer Evidence, die in keinem Red Herring steht, nur durch W5 abgedeckt, das aber per Evidence prüft (RF-03) | W6 schließt die ganze Evidence aus | Red Herring ist im Schema ein Paar (Evidence, **eine** Proposition); W6 ignoriert die Proposition | nein: Red-Herring-Ausschluss je Link `(evidenceId, propositionId)` |
| RF-05 | **Zwei Quellen der Erreichbarkeit.** Der Walkthrough (W3/W4) und der Fixpunkt können auseinanderlaufen: ein Walkthrough, der durch eine Lücke in VS-5 (Bug) `event:argument` kennt, „beweist“ Erreichbarkeit, die der Fixpunkt verneint, oder umgekehrt | W3 prüft gegen den Walkthrough, `EVIDENCE_UNREACHABLE` gegen den Fixpunkt | Zwei Definitionen von „erreichbar“; welche gilt? | nein: V1 hat **nur** den Fixpunkt; der Walkthrough ist E2E-Fixture (Roadmap §8), kein Witness-Bestandteil |
| RF-06 | **Geständnis als Beweis.** NPC Ben mit Conclusion-Attitude `belief resp(ben,murder)=T`, Profil `answer`. Witness zitiert `statement ben resp(ben)=T` für `resp(ben)=T` | W4 assert ✓, W7 Status = `value` ✓ | Jeder Fall mit geständigem NPC ist „lösbar“; W7 benutzt objektive Wahrheit, um ein Testimonium zu akzeptieren, das der Spieler nicht prüfen kann | teilweise: V1 lässt Conclusion-Statements **nicht** als Axiome zu (nur Propositions-Literale, Abschnitt 8.1); Propositions-Testimonien unterliegen `testimonyPolicy` und werden als `TESTIMONY_DEPENDENCY` ausgewiesen |
| RF-07 | **Kein Hypothesenraum.** Negative Pflicht-Literale (`resp(anna)=F`) werden durch irgendein wahres Zitat „begründet“; dass Anna *ausgeschlossen* werden kann, ist nicht formulierbar | W2 ✓ | „Nicht verantwortlich“ ist eine Aussage über Alternativen; ohne Alternativenmenge ist sie nicht prüfbar | nein: V1 verlangt Verdächtige je Event im Briefing und prüft Brückenregeln über **alle** Verdächtigen |
| RF-08 | **Vokabularlücke verdeckt.** Pflicht `intent(murder,intended)=T`. Witness zitiert `cuff-button` | alle W ✓ | Nichts im Propositionsvokabular spricht über Intent; B meldet die Lücke nicht, sondern „zertifiziert“ | nein: `CONCLUSION_KIND_UNSUPPORTED` |
| RF-09 | **W9 ist Solution-Lint**, kein Witness-Kriterium; es kann mit jedem Witness bestehen oder scheitern | – | Vermischt zwei Fragen (Key-Qualität vs. Lösbarkeit) | ja, als `RESPONSIBILITY_NOT_COMPLETE` unter `ambiguityPolicy` |
| RF-10 | **Konflikte ungeprüft.** `fingerprint` sagt „Anna war dabei“, Bens Lüge bestätigt es. Der Spieler steht vor einem Widerspruch zu Annas Alibi. B prüft nicht, ob der Widerspruch aus zugänglicher Information **auflösbar** ist | W6/W7 filtern mit Spoiler-Wissen, der Spieler hat es nicht | Ein Fall, in dem die Irreführung nie widerlegbar ist, besteht B | nein: `CONFLICT_UNRESOLVED` (Abschnitt 10) |
| RF-11 | **Bindung.** Der Roadmap-Witness bindet `truthHash`, nicht `solutionHash`, hängt aber von `requiredConclusions` ab. Nach einer Solution-Revision (andere Pflicht) bleibt der Witness formal gültig und W2 schlägt erst beim nächsten Lauf auf | – | stiller Drift | nein: Witness bindet Truth **und** Solution |
| RF-12 | **Zitat-Mehrdeutigkeit.** W4 „zitiertes Statement ist ein assert“: ein Statement wird durch `(npcId, claim)` identifiziert, aber die Policy kann denselben Claim je nach Profil `assert true` **oder** `assert false` liefern (invert). Welcher Wert ist zitiert? | unspezifiziert | der Witness zitiert ein Objekt ohne Polarität | nein: V1-Axiome sind Literale **mit** Wert, berechnet aus dem tatsächlichen Act |

**Urteil.** B ist eine Prüfung auf *Nicht-Vakuität* (es gibt wahre erreichbare Beweise und der Walkthrough endet `solved`) plus Reachability. Sie ist nützlich und bleibt in V1 enthalten, aber unter dem Namen „Solvability Witness“ ist sie irreführend. Was aus B überlebt: der Erreichbarkeits-Fixpunkt (Stufe 1 der Roadmap, unverändert), die Wahrheitsfilter W5/W7 (je Link, je Literal), der Red-Herring-Ausschluss (je Link), W9 als Ambiguitäts-Lint, und W1 als abschließende VS-1-Probe (`ACCUSATION_NOT_SOLVED`, in V1 nur noch Defense in Depth, weil Lemma L3 sie impliziert).

**Gegenprobe gegen V1 selbst** (die wichtigsten Angriffe auf das hier vorgeschlagene Design; vollständig in Abschnitt 11):

| Angriff auf V1 | Abwehr |
|---|---|
| Brückenregel ohne Variable („`item(murder,opener)=T ⇒ resp(P)=T`“) | Schema: mindestens eine Prämisse muss `$P` enthalten (`BRIDGE_PREMISE_NOT_DISCRIMINATING`) |
| Verdächtigenmenge auf eine Person schrumpfen, damit die Gegenbeispielprüfung trivial wird | `SUSPECTS_TOO_FEW` (≥ 2) und `PROMISE_VIOLATED`, wenn ein zugewiesener Täter fehlt |
| Opfer in die Verdächtigen aufnehmen und Regel „Teilnehmer ⇒ Täter“ | `BRIDGE_COUNTEREXAMPLE(clara)`: genau der Fehlschluss „Anwesenheit ⇒ Verantwortung“ |
| Regel, die nur für den tatsächlichen Täter instanziierbar ist, weil die Prämisse eine Proposition nennt, die es nur über ihn gibt („`at(P,library,1500)=T`“, Proposition existiert nur für Ben) | Instanzen ohne entscheidbare Wahrheit werden als `BRIDGE_UNCHECKABLE_INSTANCE` gemeldet; die Prüfung wird dadurch schwächer, nie unkorrekt, und der Reviewer sieht es |
| Regel, die zufällig ohne Gegenbeispiel ist, aber „unnatürlich“ („wer nicht im Garten war, ist der Täter“) | nicht mechanisch erkennbar; Restrisiko 5.4; der Report druckt jede Regel in lesbarer Form, das Zertifikat ist reviewbar |
| Testimonium eines Lügners, das zufällig wahr ist | Objektiv wahr ⇒ zulässiges Axiom unter `trusted`; unter `corroborated` nur mit zweiter Quelle; `TESTIMONY_DEPENDENCY` zeigt Pflicht-Literale, die ohne Testimonium nicht ableitbar sind |
| Falsche Beobachtung, die der Spieler nie widerlegen kann | `CONFLICT_UNRESOLVED` unter `must_be_determined` blockierend |

---

## 5. Selected V1

### 5.1 In einem Satz

**V1 = Erreichbarkeits-Fixpunkt + geschlossener Regelsatz + autorisierte Brückenregeln mit Personenvariable, die der Validator gegen den Fall selbst widerlegt + berechnete Ableitung.** Der Autor liefert nur, was mechanisch nicht herleitbar ist (die Brücke) und zwar in einer Form, deren Voraussetzungen mechanisch prüfbar sind (Schema mit Variable über einen im Briefing genannten Hypothesenraum). Alles andere berechnet der Validator.

### 5.2 Entscheidungen

| # | Frage | Entscheidung | Grund / verworfene Alternative |
|---|---|---|---|
| V-01 | Witness-Primitive | Genau drei: `bridgeRules[]` (Schemata), `testimonyPolicy`, `ambiguityPolicy`. Keine Schritte, keine Zitate, kein Walkthrough | Zitate ohne Regel sind „trust me“ (RF-01); Schritte erzeugen Reihenfolge-, Duplikat- und Zyklusfehler, die ein Fixpunkt gar nicht erst zulässt |
| V-02 | Inferenzschritte | **berechnet** als kleinster Fixpunkt über den Regelsatz (Forward Chaining), mit vollständiger Spur je Literal | Für Horn-Regeln vollständig (L5); die Spur ist die Erklärung für den Reviewer |
| V-03 | Zugelassene Regeln | `R-EXCL` (semantisch korrekt), `BR` (autorisiert, case-geprüft), `ELIM`, `CW-NONE` (korrekt unter Briefing-Zusagen). Sonst nichts | Jede weitere eingebaute Brücke ist nach 1.3 in irgendeinem Fall falsch |
| V-04 | Brückenregel-Form | `∀P ∈ S(e): Prämissen(P) ⊢ resp(P,e)=v`; Prämissen = Propositions-Literal-Templates mit Variable `$P` in Personenpositionen, Konstanten sonst; `e` konstant; ≥ 1 Prämisse enthält `$P` | Die Variable ist der einzige Hebel, der Diskriminierung prüfbar macht; Event-Variablen bringen in V1 nichts (Events sind in Pflicht-Literalen konstant) |
| V-05 | Gegenbeispielprüfung | Für jede Instanz `P ∈ S(e)`: gelten alle Prämissen objektiv, muss `status(resp(P,e)) = v` sein. `undetermined` ⇒ `BRIDGE_UNDETERMINED_INSTANCE`; Widerspruch ⇒ `BRIDGE_COUNTEREXAMPLE`; nicht entscheidbare Prämisse (`personAt` ohne Katalog-Proposition) ⇒ `BRIDGE_UNCHECKABLE_INSTANCE` | Die Prüfung läuft über **objektive** Wahrheit, nicht über Zugänglichkeit: eine Regel muss auch für Verdächtige stimmen, über die der Spieler wenig weiß |
| V-06 | Evidence Accessibility | Fixpunkt über VS-2-Reducer/Projektion + VS-5-Briefing (Abschnitt 9). `inaccessible`-Einträge: nie Axiom, kein Finding. `via`-Einträge, deren Ziel nie bekannt wird: `EVIDENCE_UNREACHABLE` (blockierend) | VS-2 D-7/I-1/I-6 |
| V-07 | Proposition polarity | Literale tragen `value` explizit. `supports` ⇒ `=T`, `refutes` ⇒ `=F`, `assert{value}` ⇒ `=value`. Negation entsteht **nur** durch `refutes`, `assert false` oder `R-EXCL`. Keine Closed-World-Annahme über Propositionen | E4 des Accusation-Designs auf Propositionen übertragen |
| V-08 | Conclusion polarity | Abgeleitetes `⟨k,v⟩` ist gültig genau dann, wenn `status(k) = v` (bestimmt). `undetermined` beweist keine Polarität. Negative Pflicht-Literale brauchen eine Ableitung wie positive (`BR` mit `v=F`, `CW-NONE`) | kein implizites „wer nicht genannt ist, ist unschuldig“ |
| V-09 | Alternative Hypothesen | Je Event `e` mit Pflicht-Literal `resp(·,e)`/`none(e)`: Verdächtigenmenge `S(e)` aus dem Briefing, `|S(e)| ≥ 2`, `S(e) ⊆` spielerbekannte Personen; `BR`-Instanzen laufen über `S(e)` | Der Hypothesenraum muss spielerseitig sein (der Spieler soll genau diese Alternativen erwägen), deshalb Briefing, nicht Witness |
| V-10 | Briefing-Zusagen | `culprits_among_suspects(e)`: zugewiesene Personen ⊆ `S(e)`; `some_culprit(e)`: `status(none(e)) = F`. Beides gegen den Key geprüft (`PROMISE_VIOLATED`) | `ELIM` und `CW-NONE` sind nur unter diesen Zusagen korrekt (L4); sie sind autorisierte Spielregeln („Es war Mord, einer von euch war es“), keine Inferenz |
| V-11 | `ambiguityPolicy` | `must_be_determined` (Default) oder `may_remain_ambiguous`; wirkt genau auf drei Befunde (Abschnitt 10) | nie auf Ableitbarkeit von Pflicht-Literalen |
| V-12 | complete/partial | Pflicht-Event mit `partial` ⇒ `RESPONSIBILITY_NOT_COMPLETE` (Ambiguitätsbefund). `BR`-Instanz mit `undetermined` ⇒ Ambiguitätsbefund. `CW-NONE` verlangt `complete` | W9 und D1 des Accusation-Designs, hier als Policy statt als harte Regel |
| V-13 | undetermined | Nie ein Axiom, nie eine Prämisse, nie eine gültige Ableitung; in `BR`-Instanzen ein Ambiguitätsbefund; Pflicht-Literale sind per TASK-0003 nie undetermined | konsistent mit E3 (undetermined neutral) auf Prüfseite |
| V-14 | Supernatural mechanism | Keine Sonderregel. `mech(e,supernatural)` als Pflicht ⇒ `CONCLUSION_KIND_UNSUPPORTED`. Für Verantwortung ändert ein übernatürlicher Mechanismus nur, welche Brückenregel Gegenbeispiele hat (Fluch aus dem Garten widerlegt „¬Teilnehmer ⇒ ¬verantwortlich“ an der Täterin selbst) | genau deshalb sind Brückenregeln nie eingebaut; `R-EXCL` bleibt korrekt, weil `case-semantics-v1` Bilokation unabhängig vom Mechanismus verbietet (Experiment 1.3) |
| V-15 | Direct vs transitive cause | `cause` ist in V1 nicht zertifizierbar (kein Propositionsvokabular). Keine Transitivitätsregel; TASK-0003 wertet transitive Ursachen bei `causesComplete` als `false` | eine spätere `cause`-Regel müsste wie `BR` case-geprüft werden |
| V-16 | Testimonium | Nur Propositions-Statements mit `answer.kind = "assert"` liefern Literale; `express_uncertainty`, `claim_ignorance`, `refuse`, `evade` liefern nichts. Conclusion-Statements liefern nie Axiome. `testimonyPolicy ∈ {evidence_only, corroborated, trusted}`, Default `corroborated` | RF-06; der Spieler kann Wahrheit von Testimonium nicht prüfen, der Validator schon, deshalb muss die Abhängigkeit sichtbar sein (`TESTIMONY_DEPENDENCY`) |
| V-17 | Unterstützte Pflicht-Arten | `personResponsibleForEvent` (T/F), `noPersonResponsibleForEvent` (T/F). Alle anderen ⇒ `CONCLUSION_KIND_UNSUPPORTED` | S5 |
| V-18 | Ground-Steps („trust me“ ohne Variable) | **verboten** (Schema) | der Auftrag verlangt maschinenprüfbare Voraussetzungen |
| V-19 | Walkthrough | kein Witness-Bestandteil; bleibt E2E-Fixture (Roadmap §8) | RF-05 |
| V-20 | Report | nur host-seitig; enthält Spuren mit Spoilern; es gibt **keine** spielerseitige Projektion von Solvability | das Zertifikat ist Autorenwerkzeug |

### 5.3 Das Zertifikat (normativ)

`verdict: "certified"` unter `solvability-v1` bedeutet **genau**:

1. **Bindung.** Witness, Briefing, Map, Solution und NPC-Dokumente binden dieselbe `truthHash`, der Witness zusätzlich die `solutionHash`; `validateCaseSemantics(truth)` ist leer (Paketvorbedingung).
2. **Erreichbarkeit.** Ausgehend vom Briefing liefert der Fixpunkt (Abschnitt 9) die Mengen `K*` (Entitäten), `Ticks*`, `E*` (Evidence) und `Σ*` (inhaltstragende Aussagen); keine `via`-Evidence bleibt unerreichbar.
3. **Axiome.** Jedes Axiom ist ein objektiv wahres Propositions-Literal aus einem erreichbaren Evidence-Link (kein Red-Herring-Link), einer erreichbaren Aussage gemäß `testimonyPolicy`, oder einer Event-Sicht.
4. **Brückenregeln.** Jede Regel des Witness enthält `$P` in ≥ 1 Prämisse, referenziert nur spielerbekannte Entitäten, und hat über `S(e)` keine Instanz, in der alle Prämissen objektiv gelten und `status(resp(P,e)) ≠ v`; unter `must_be_determined` auch keine Instanz mit `undetermined`.
5. **Zusagen.** Jede Briefing-Zusage gilt im Answer Key; `|S(e)| ≥ 2`; `S(e) ⊆ K*`.
6. **Ableitung.** Jedes Pflicht-Literal liegt im kleinsten Fixpunkt `Δ` des Regelsatzes `{R-EXCL, BR, ELIM, CW-NONE}` über den Axiomen; jedes Element von `Δ` gilt objektiv (L3, zusätzlich geprüft).
7. **Konflikte.** Unter `must_be_determined`: jedes erreichbare, objektiv falsche Literal, das einen Verdächtigen nennt, ist durch `Δ` widerlegt (`¬ℓ ∈ Δ`); jedes Pflicht-Event ist `complete`.
8. **VS-1-Abschluss.** Die Anklage aus genau den Pflicht-Literalen ergibt `solved`.

Es bedeutet **nicht**: dass die Brückenregeln außerhalb dieses Falls gelten; dass ein Mensch die Ableitung findet; dass der Spieler ohne die Garantie aus 7 wahre von falschen Aussagen unterscheiden kann; irgendetwas über `role`, `cause`, `intent`, `mechanism`; dass die Verdächtigenmenge „fair“ gewählt ist (nur, dass sie die Täter enthält, ≥ 2 Personen umfasst und dem Spieler bekannt ist); dass Labels, IDs oder Beschreibungen spoilerfrei sind (Lint-Thema, Abschnitt 16).

### 5.4 Restrisiken (False Positives), ausdrücklich

| Risiko | Beispiel | Warum nicht mechanisch lösbar | Mitigation |
|---|---|---|---|
| Unnatürliche Regel ohne Gegenbeispiel | „`at(P,garden,1500)=F ⇒ resp(P,murder)=T`“ über `{anna, ben}`: Ben war nicht im Garten, Anna schon, Clara kein Verdächtiger ⇒ keine Instanz widerspricht | Ob eine Regel narrativ plausibel ist, ist keine Eigenschaft des Modells | Report druckt Regeln lesbar; Reviewer-Pflicht; Lint-Idee für V2: Prämissen müssen das Pflicht-Event oder die Tatwaffe nennen |
| Zufällig wahres Testimonium | Ben invertiert einen falschen Belief und sagt zufällig die Wahrheit | Der Validator prüft objektive Wahrheit, der Spieler nicht | `corroborated` als Default; `TESTIMONY_DEPENDENCY` |
| Nicht entscheidbare `personAt`-Instanzen | Regel über `at(P, l, t)` mit Katalog-Proposition nur für eine Person | `personAt` hat keine Wahrheit außerhalb des Katalogs | `BRIDGE_UNCHECKABLE_INSTANCE` (info) |
| Verdächtigenmenge als Spoiler | `S(e) = {ben, anna}`, Clara fehlt ⇒ Spieler „weiß“, dass Clara Opfer ist | Das ist gewollt: das Briefing darf sagen, wer Opfer ist | – |
| Zwei Täter, beide Verdächtige, Regel trifft beide | kein Gegenbeispiel, beide ableitbar | korrekt | – |

---

## 6. Formal Semantics

### 6.1 Grundobjekte

- `T` = `CaseTruth`, `S` = `CaseSolution` gebunden an `T`, `M` = `EvidenceAccessMap`, `B` = Briefing, `N` = Menge der NPC-Paare `(snapshot, profile)`, `W` = Witness. Paket `Π = (T, S, M, B, N)`; Vorbedingung `validateCaseSemantics(T).findings = ∅`.
- Propositions-Claims `C_p` (drei Arten), Conclusion-Claims `C_c` (sechs Arten). Claim-Gleichheit ist strukturell (lokaler Schlüssel wie VS-1 D7).
- **Objektive Wahrheit** `τ : C_p → {T, F, ⊥}`: ist `c` der Claim einer Katalog-Proposition `p`, dann `τ(c) = p.truth`; sonst, falls `c.kind ∈ {eventHasParticipant, eventHasItem}`, aus der Teilnehmer-/Item-Liste des Events; sonst `⊥` (nicht entscheidbar). Wohldefiniert, weil `PARTICIPANT_CLAIM_MISMATCH`/`ITEM_CLAIM_MISMATCH` Katalog und Listen gleichsetzen und `CLAIM_TRUTH_CONFLICT` doppelte Claims mit verschiedener Wahrheit verbietet.
- **Status** `σ : C_c → {T, F, U}` = `evaluateConclusionClaim(T, S, k).status` (VS-1; Event ohne Resolution ⇒ `U`).
- **Literal** `ℓ = ⟨c, v⟩` mit `v ∈ {T, F}`; `holds(ℓ) ⇔ τ(c) = v` bzw. `σ(k) = v`. `¬ℓ = ⟨c, ¬v⟩`.
- `Req = { ⟨claim(S.conclusions[id]), v⟩ : (id, v) ∈ S.requiredConclusions }`.

### 6.2 Erreichbarkeit (Abschnitt 9 im Detail)

- `K_0 = B.knownPersonIds ∪ B.knownLocationIds ∪ B.knownItemIds ∪ B.knownEventIds`.
- `D(K) = { e ∈ accessibleEvidenceIds(M) : target(M.via(e)) ∈ K }` (Ziel der Aktion ist bekannt).
- `K_{n+1} = K_n ∪ ⋃_{e ∈ D(K_n)} referencedEntities(view(e))`. Monoton, endlich ⇒ `K* = lfp`. `E* = D(K*)`.
- `Ticks* = { t : at(·,·,t) in einem Link-Claim von E* } ∪ { Ticks der Event-Sichten für Events in K* }` **[A-VS5-3]**.
- `Σ* = { (n, c, act) : n ∈ B.interrogablePersonIds, c Claim einer Attitude von n, refs(c) ⊆ K*, ticks(c) ⊆ Ticks*, act = ask_n(c) }`. Für Claims ohne Attitude liefert die Engine inhaltsfreie Acts (TASK-0005 §10), daher ist die Beschränkung auf Attitude-Claims ohne Verlust.
- `EventFacts* = { (e, loc(e), time(e)) : e ∈ K* }` **[A-VS5-2]**.

### 6.3 Beobachtungen, Axiome, Konfliktmenge

- `O_E = { (e, ⟨claim(p), dir⟩) : e ∈ E*, (p, dir) ∈ links(e) }` mit `supports ↦ T`, `refutes ↦ F`.
- `RH = { (e, p) : ∃ r ∈ T.redHerrings: e ∈ r.evidenceIds ∧ r.misleadingPropositionId = p }` (Red-Herring-Links).
- `O_Σ = { (n, ⟨c, v⟩) : (n, c, act) ∈ Σ*, act = assert{value: v} , c ∈ C_p }`.
- **Beobachtungsmenge** `O = O_E ∪ O_Σ` (alles, was der Spieler als Literal lesen kann, wahr oder falsch).
- `sources(ℓ) = { e : (e, ℓ) ∈ O_E, (e, p) ∉ RH } ∪ { n : (n, ℓ) ∈ O_Σ }` (Evidence-Stücke und NPCs als getrennte Quellen).
- **Axiome** `Ax = { ℓ : holds(ℓ) ∧ admissible(ℓ) }` mit `admissible` nach `testimonyPolicy`:
  - `evidence_only`: `sources(ℓ) ∩ E* ≠ ∅`;
  - `corroborated`: `sources(ℓ) ∩ E* ≠ ∅ ∨ |sources(ℓ)| ≥ 2`;
  - `trusted`: `sources(ℓ) ≠ ∅`.
- **Konfliktmenge** `Conf = { ℓ : (·, ℓ) ∈ O ∧ ¬holds(ℓ) }` (Red-Herring-Links, Lügen, falsche Beliefs, unmarkierte falsche Links).

### 6.4 Regeln

Für Event `e` sei `S(e)` die Verdächtigenmenge und `Prom(e)` die Zusagen aus `B.hypotheses`.

| Regel | Form | Nebenbedingungen |
|---|---|---|
| `R-EXCL` | `⟨at(p,l,t), T⟩ ⊢ ⟨part(e,p), F⟩` | `(e, l_e, time_e) ∈ EventFacts*`, `l_e ≠ l`, `t ∈ time_e` (instant: `t = at`; interval: `start ≤ t < end`); Konklusion muss Katalog-Proposition oder listenentscheidbar sein (`τ ≠ ⊥`) |
| `BR(r, P)` | `{ ⟨c_i[P], v_i⟩ }_i ⊢ ⟨resp(P, e_r), v_r⟩` | `r ∈ W.bridgeRules`, `P ∈ S(e_r)`; Regel gültig (6.5) |
| `ELIM(e, P_0)` | `{ ⟨resp(P, e), F⟩ : P ∈ S(e) \ {P_0} } ⊢ ⟨resp(P_0, e), T⟩` | `culprits_among_suspects(e), some_culprit(e) ∈ Prom(e)`, beide gültig |
| `CW-NONE(e)` | `{ ⟨resp(P, e), F⟩ : P ∈ S(e) } ⊢ ⟨none(e), T⟩` | `culprits_among_suspects(e) ∈ Prom(e)` gültig; `completeness(e) = complete` |

**Ableitbare Menge** `Δ = lfp(λX. Ax ∪ { concl(ρ) : ρ Regelinstanz, prem(ρ) ⊆ X })`. Terminiert, weil der Literalraum endlich ist (Katalog-Claims, listenentscheidbare Claims über `K*`, `resp`/`none` über `S(e) × Pflicht-Events`).

### 6.5 Gültigkeit einer Brückenregel

Regel `r` mit Variable `P`, Event `e`, Prämissen-Templates `c_i[P]`, Werte `v_i`, Konklusionswert `v_r` ist **gültig in `Π`** genau dann, wenn:

1. (Diskriminierung) `∃ i: P kommt in c_i vor`.
2. (Referenzen) alle konstanten Entitäten der Templates und `e` liegen in `K*`.
3. (Kein Gegenbeispiel) `∀ P ∈ S(e): (∀ i: τ(c_i[P]) = v_i) ⇒ σ(resp(P,e)) = v_r`.
4. (Bestimmtheit) unter `must_be_determined`: `∀ P ∈ S(e): (∀ i: τ(c_i[P]) = v_i) ⇒ σ(resp(P,e)) ≠ U`.

Instanzen mit `∃ i: τ(c_i[P]) = ⊥` erfüllen die Prämisse nicht (vakuös) und werden als `BRIDGE_UNCHECKABLE_INSTANCE` gemeldet. Eine Regel ohne Instanz mit erfüllter Prämisse ist vakuös (`BRIDGE_VACUOUS`, info).

### 6.6 Solvability

```
Solvable_v1(Π, W)  ⇔  Req ⊆ Δ
                     ∧ ∀ ℓ ∈ Req: kind(ℓ) ∈ {personResponsibleForEvent, noPersonResponsibleForEvent}
                     ∧ ∀ r ∈ W.bridgeRules: gültig(r)
                     ∧ ∀ e ∈ Events(Req): |S(e)| ≥ 2 ∧ S(e) ⊆ K* ∧ Prom(e) gültig
                     ∧ unreachable(M, B) = ∅
                     ∧ evaluateAccusation(Req) = solved
Determined(Π, W)   ⇔  ∀ ℓ ∈ Conf: (mentions(ℓ) ∩ ⋃ S(e) ≠ ∅ ⇒ ¬ℓ ∈ Δ)
                     ∧ ∀ e ∈ Events(Req): completeness(e) = complete
                     ∧ keine BR-Instanz mit U
certified            ⇔  Solvable ∧ Determined
certified_ambiguous  ⇔  Solvable ∧ ¬Determined ∧ ambiguityPolicy = may_remain_ambiguous
not_certified        sonst
```

### 6.7 Lemmata

- **L1 (R-EXCL korrekt).** Sei `validateCaseSemantics(T) = ∅`, `τ(at(p,l,t)) = T`, `e` mit `loc(e) ≠ l` und `t ∈ time(e)`. Wäre `p ∈ participants(e)`, dann enthielte `personFacts` den Fakt `(p, loc(e), time(e), e)` und `(p, l, @t, prop)`; sie überlappen und unterscheiden sich im Ort ⇒ `PERSON_LOCATION_CONFLICT` (Z. 87–110, 243–260), Widerspruch. Also `p ∉ participants(e)`, und `τ(part(e,p)) = F` (Katalog per `PARTICIPANT_CLAIM_MISMATCH`, sonst Liste). Experimentell bestätigt (1.3: drei Varianten, jede liefert das erwartete Finding). ∎
- **L2 (BR-Instanz korrekt).** Feuert `BR(r, P)` mit `prem ⊆ Δ` und gilt `Δ ⊆ holds` (Induktion), dann gelten alle `c_i[P]` objektiv; nach 6.5(3) ist `σ(resp(P,e)) = v_r`. ∎
- **L3 (Δ ⊆ holds).** Induktion über die Fixpunktiteration: Axiome gelten per Definition; `R-EXCL` per L1; `BR` per L2; `ELIM`: `some_culprit` ⇒ `assignments(e) ≠ ∅`; `culprits_among_suspects` ⇒ `assignments(e) ⊆ S(e)`; alle `P ≠ P_0` in `S(e)` haben `σ = F`, sind also nicht zugewiesen (zugewiesen ⇒ `T`); also `assignments(e) ⊆ {P_0}` und nicht leer ⇒ `P_0` zugewiesen ⇒ `σ(resp(P_0,e)) = T`; `CW-NONE`: analog `assignments(e) = ∅`, mit `complete` ⇒ `σ(none(e)) = T`. ∎
- **L4 (VS-1-Abschluss).** `Req ⊆ Δ ⊆ holds` ⇒ jedes Pflicht-Literal ist `matched`, keines `contradicted`; die Anklage aus `Req` ist `solved` (Accusation-Design §4). `ACCUSATION_NOT_SOLVED` ist unter korrekter VS-1 unerreichbar und dient als Mutations-Detektor. ∎
- **L5 (Vollständigkeit des Forward Chaining).** Alle Regeln sind Horn-Klauseln über einem endlichen Literalraum; `Δ` ist das kleinste Modell; ein Pflicht-Literal ist genau dann aus `Ax` unter den Regeln herleitbar, wenn es in `Δ` liegt. Insbesondere stimmt „in jedem Modell von `Ax ∪ Regeln` wahr“ (die D-Sicht, Eindeutigkeit) mit „in `Δ`“ überein. ∎
- **L6 (Determinismus, Permutationsinvarianz).** `K*`, `Δ` und `Conf` sind Mengen, definiert als Fixpunkte monotoner Operatoren; sie hängen nicht von der Reihenfolge der Regeln, Evidence-Einträge, Attitudes oder Witness-Felder ab. Die Spur wird kanonisch sortiert (Literal-Schlüssel, dann Regelname, dann Instanz). Zwei Läufe liefern bytegleiches JSON. ∎
- **L7 (Monotonie und ihre Grenze).** Zusätzliche wahre, zulässige Axiome vergrößern `Δ` und verkleinern nie `Solvable`. Zusätzliche **falsche** Beobachtungen (neue Lügen, neue Red Herrings) vergrößern `Conf` und können `Determined` kippen. Das ist gewollt: Misdirection ist Spielinhalt, aber sie muss widerlegbar bleiben. ∎

---

## 7. Witness Model

### 7.1 Dokument (Skizze, normativ; strikt, keine Defaults, deep-frozen, gebrandet)

```text
SolvabilityWitness = {
  schemaVersion: 1,
  caseId: CaseId,
  truthHash: SHA256,                 // hashCaseTruth(truth)
  solutionHash: SHA256,              // hashCaseSolution(solution): die Regeln sind gegen den Key geprüft
  revision: positive safe integer,
  testimonyPolicy: "evidence_only" | "corroborated" | "trusted",
  ambiguityPolicy: "must_be_determined" | "may_remain_ambiguous",
  bridgeRules: BridgeRule[]          // darf leer sein (dann ist nichts ableitbar; Fall ist nie certified)
}

BridgeRule = {
  id: "bridge:<slug>",               // eindeutig im Witness
  eventId: EventId,                  // konstantes Pflicht-Event
  premises: PremiseTemplate[],       // min 1; mindestens eine enthält "$P"
  conclusion: { value: boolean }     // ⟨resp($P, eventId), value⟩; die Form ist fest, nur der Wert ist frei
}

PremiseTemplate = { claim: ClaimTemplate, value: boolean }

ClaimTemplate =
  | { kind: "personAt",            personId: PersonId | "$P", locationId: LocationId, at: Tick }
  | { kind: "eventHasParticipant", eventId: EventId, personId: PersonId | "$P" }
  | { kind: "eventHasItem",        eventId: EventId, itemId: ItemId }
```

Was der Witness **nicht** enthalten kann (Schema): Conclusion-IDs, Propositions-IDs, Evidence-IDs, Statement-Zitate, Schrittlisten, Freitext, Walkthrough, Red-Herring-IDs, Secrets, Motive, Provenance. Ein Feld `conclusionId` oder `cites` ist `unrecognized_keys`. Damit ist „Beweis funktioniert nur mit Spoiler-ID“ konstruktiv ausgeschlossen: Die einzigen Identitäten im Witness sind Entitäts-IDs, die der Spieler ebenfalls erhält (VS-2 D-11), und Claim-Strukturen, die in den Views stehen.

### 7.2 Parse-Regeln (Reihenfolge)

| # | Regel | Pfad bei Fehler |
|---|---|---|
| P-1 | Shape strikt, `schemaVersion: 1`, Templates per Discriminator, `$P` nur in `personId`-Positionen | Zod-Pfade |
| P-2 | Bindung `caseId`, `truthHash`, `solutionHash`; bei Verletzung Abbruch | `["caseId"]`, `["truthHash"]`, `["solutionHash"]` |
| P-3 | Regel-IDs eindeutig | `["bridgeRules", j, "id"]` (spätere Stelle) |
| P-4 | `eventId` jeder Regel existiert in `truth.events` und hat ein Pflicht-Literal `resp(·, e)` oder `none(e)` (sonst ist die Regel zweckfrei: `["bridgeRules", i, "eventId"]`, Meldung „no required conclusion about this event“) | |
| P-5 | Konstante Entitäten der Templates existieren in der Truth | `["bridgeRules", i, "premises", j, "claim", "<feld>"]` |
| P-6 | ≥ 1 Prämisse enthält `$P` | `["bridgeRules", i, "premises"]` (`BRIDGE_PREMISE_NOT_DISCRIMINATING` als Zod-Issue) |
| P-7 | Keine zwei Prämissen mit gleichem Template-Schlüssel (Duplikat) und keine zwei mit gleichem Schlüssel und verschiedenem Wert (Widerspruch ⇒ nie erfüllbar) | `["bridgeRules", i, "premises", j]` |
| P-8 | Transform: Regeln nach `id` sortieren, Prämissen nach Template-Schlüssel sortieren, `structuredClone` → `deepFreeze` → Brand `"SolvabilityWitness"` | – |

Erreichbarkeit (`K*`) wird **nicht** beim Parsen geprüft, weil der Witness nur gegen Truth und Solution gebunden ist; `BRIDGE_REFERENCES_UNKNOWN_ENTITY` ist ein Validator-Befund (braucht das Paket).

### 7.3 Warum berechnete Ableitung statt autorisierter Schritte

| Autorisierte Schrittliste | Berechneter Fixpunkt |
|---|---|
| Zyklen, Vorwärtsreferenzen, Duplikate, Reihenfolge müssen geprüft werden (≈ 40 Zeilen, 6 Fälle) | konstruktiv ausgeschlossen |
| Autor kann einen gültigen Beweis falsch aufschreiben (False Negative ohne Erkenntniswert) | nur die Regeln können falsch sein |
| „Mehrere Beweispfade“ sind eine Autorenentscheidung | alle Pfade werden gefunden und in der Spur gezeigt |
| Autor-Intention sichtbar | Intention ist für Lösbarkeit irrelevant |
| Spur = Eingabe | Spur = Ausgabe (Erklärung) |

Der Witness ist also kein Beweis, sondern eine **Theorie** (die Brücke), und der Validator ist der Beweiser über einen bewusst winzigen Regelsatz. „Witness“ bleibt als Name, weil das Dokument bezeugt, womit der Autor die Lösbarkeit begründet.

### 7.4 Der Witness ist ein Spoiler-Dokument

Verdächtigenmenge plus Brückenregeln plus Truth determinieren die Lösung (das ist der Zweck). Der Witness gehört zur Autorenseite des Pakets wie `CaseSolution` und darf nie an Spieler oder Verbalization gelangen. Es gibt keine spielerseitige Projektion.

---

## 8. Inference Rules

### 8.1 Axiom-Schemata (Quellen)

| Quelle | Literal | Vorbedingungen (alle maschinell) | Finding, wenn verletzt |
|---|---|---|---|
| `AX-E` Evidence-Link | `⟨claim(p), dir⟩` | `e ∈ E*`; `(e, p) ∉ RH`; `holds` | falscher Link: kein Axiom, Mitglied von `Conf`; unmarkiert ⇒ `FALSE_LINK_NOT_RED_HERRING` (info) |
| `AX-S` Aussage | `⟨c, v⟩` aus `assert{value: v}` zu Propositions-Claim `c` | `(n, c, act) ∈ Σ*`; `holds`; `admissible` nach Policy | Lüge/falscher Belief: kein Axiom, Mitglied von `Conf` (`STATEMENT_FALSE`, info) |
| `AX-EV` Event-Sicht | `(e, loc, time)` (kein Literal, Nebenbedingung für `R-EXCL`) | `e ∈ K*` **[A-VS5-2]** | – |

Nie Axiom: `express_uncertainty` (keine Festlegung), `claim_ignorance`/`refuse`/`evade` (inhaltsfrei), Conclusion-Statements (Testimonium über die Lösung selbst; RF-06), Briefing-Freitext, Labels, Beschreibungen, Namen, Secrets, Motive, Beziehungen, Provenance, Red-Herring-Markierungen (letztere nutzt der Validator nur zum **Ausschluss**).

### 8.2 `R-EXCL` (Ortsausschluss; systemseitig; korrekt per L1)

```
⟨at(p, l, t), T⟩ ,  (e, l_e, time_e) ∈ EventFacts* ,  l_e ≠ l ,  t ∈ time_e
───────────────────────────────────────────────────────────────────────────
⟨part(e, p), F⟩
```

Instanziierung: über alle `at`-Literale in `Δ` × alle Events in `K*`. Die Konklusion muss `τ ≠ ⊥` haben (immer der Fall: `part` ist listenentscheidbar). Nicht enthalten (bewusst, V2-Kandidaten): `R-PART-AT` (`part(e,p)=T ⊢ at(p, loc(e), t)=T`), `R-UNIQ-LOC` (`at(p,l,t)=T ⊢ at(p,l',t)=F`), Item-Analoga. Sie sind ebenfalls aus `case-semantics-v1` korrekt, werden aber vom Beispiel nicht gebraucht und kosten je ≈ 10 Zeilen und 3 Fälle.

### 8.3 `BR` (autorisierte Brücke; Gültigkeit 6.5)

```
Regel r:  ∀P ∈ S(e):  ⟨c_1[P], v_1⟩ , … , ⟨c_n[P], v_n⟩  ⊢  ⟨resp(P, e), v_r⟩
Instanz:  P_0 ∈ S(e),  ∀i: ⟨c_i[P_0], v_i⟩ ∈ Δ
────────────────────────────────────────────────────────────────
⟨resp(P_0, e), v_r⟩
```

Prüfungen vor dem ersten Feuern (Abschnitt 6.5; Findings in Abschnitt 14): `BRIDGE_PREMISE_NOT_DISCRIMINATING` (Parse), `BRIDGE_REFERENCES_UNKNOWN_ENTITY`, `BRIDGE_COUNTEREXAMPLE(r, P)`, `BRIDGE_UNDETERMINED_INSTANCE(r, P)`, `BRIDGE_UNCHECKABLE_INSTANCE(r, P)`, `BRIDGE_VACUOUS(r)`. Eine Regel mit blockierendem Befund feuert **nicht** (sonst könnte eine widerlegte Regel noch Literale beisteuern).

Verbotene Formen, damit niemand sie „eingebaut“ erwartet (jede ist in einem legitimen Fall falsch, 1.3):

| Pseudo-Regel | Gegenbeispiel im Modell |
|---|---|
| `part(e,P)=T ⇒ resp(P,e)=T` | Opfer ist Teilnehmer (`targets`) |
| `part(e,P)=F ⇒ resp(P,e)=F` | Giftmischer, Planer, Fluch (TASK-0003 Fixture) |
| `item(e,i)=T ∧ (i gehört P) ⇒ resp(P,e)=T` | Besitz ist kein Claim |
| Motiv/Secret/Beziehung ⇒ `resp` | keine Propositionsform; für den Spieler unzugänglich |
| `cause` transitiv | TASK-0003 wertet transitiv als `false` bei `causesComplete` |

Dieselben Formen **als Brückenregel des Autors** sind zulässig und werden im Fall geprüft: „`part(murder,P)=T ⇒ resp(P)=T`“ ist in „Der Brieföffner“ mit `S = {anna, ben}` gültig und mit `S = {anna, ben, clara}` widerlegt.

### 8.4 `ELIM` und `CW-NONE` (Hypothesenraum-Regeln; korrekt unter Zusagen, L3)

```
ELIM(e, P_0):   culprits_among_suspects(e), some_culprit(e) ∈ Prom(e)   (beide gegen den Key geprüft)
                ∀P ∈ S(e) \ {P_0}: ⟨resp(P,e), F⟩ ∈ Δ
                ───────────────────────────────────────────
                ⟨resp(P_0, e), T⟩

CW-NONE(e):     culprits_among_suspects(e) ∈ Prom(e),  completeness(e) = complete
                ∀P ∈ S(e): ⟨resp(P,e), F⟩ ∈ Δ
                ───────────────────────────────────────────
                ⟨none(e), T⟩
```

Beide Regeln sind die formale Fassung zweier Spielkonventionen, die das Briefing dem Spieler ausdrücklich mitteilt. Sie sind **keine** Inferenz über Propositionen und benutzen keine Closed-World-Annahme über die ganze Welt, sondern nur über die genannte Menge. Ohne die jeweilige Zusage existiert die Regel nicht.

### 8.5 Instanziierungsräume (für Komplexität und Determinismus)

| Regel | Instanzen | Reihenfolge in der Spur |
|---|---|---|
| `R-EXCL` | `at`-Literale in `Δ` × Events in `K*` | Literal-Schlüssel, dann Event-ID |
| `BR` | Regeln (nach `id`) × `S(e)` (nach ID) | `id`, dann Person |
| `ELIM` | Pflicht-Events × `S(e)` | Event, dann Person |
| `CW-NONE` | Pflicht-Events | Event |

Iteration bis Fixpunkt; innerhalb einer Runde alle Regeln in fester Reihenfolge; jedes neue Literal mit allen Begründungen (eine Spur kann mehrere `by`-Einträge je Literal tragen).

---

## 9. Accessibility

### 9.1 Fixpunkt (konkret, über VS-2/VS-4/VS-5-APIs)

```
known   ← Briefing (persons ∪ locations ∪ items ∪ events)
ticks   ← ticks aus Event-Sichten der bekannten Events                     [A-VS5-2/3]
state   ← initialInvestigationState(map)
repeat
  for each location L ∈ known: state ← applyInvestigationAction(map, state, search_location(L)).state
  for each item I ∈ known:     state ← … examine_item(I) …
  for each person P ∈ known:   state ← … examine_person(P) …
  views ← projectInvestigation(map, truth, state).evidence
  known ← known ∪ ⋃ referencedEntities(view);  ticks ← ticks ∪ { at : at(·,·,at) in view.links }
until known unverändert
E*       ← state.discoveredEvidenceIds
unreach  ← accessibleEvidenceIds(map) \ E*                                   → EVIDENCE_UNREACHABLE
Σ*       ← for each n ∈ interrogable: for each attitude claim c of n with refs(c) ⊆ known ∧ ticks(c) ⊆ ticks:
              createInterrogation(truth, solution, snapshot_n, profile_n).ask(c)     [A-VS4-1]
```

Eigenschaften: monoton (VS-2 D-7: keine Unlocks, Endmenge = f(Aktionsmenge)), terminierend (endliche Entitäten), reihenfolgeunabhängig, rein. Der Spieler „kennt“ in V1 nur, was VS-5 als bekannt definiert; Aussagen fügen nichts hinzu, weil der Claim aus der Frage stammt (VS-4). Evidence mit `inaccessible` erscheint in keiner Menge und erzeugt kein Finding (VS-2 D-1: verbranntes Beweisstück bleibt in der Truth).

### 9.2 Was zugänglich ist und was nicht

| Information | Zugänglich? | Mechanismus |
|---|---|---|
| Evidence-View (`id`, `label`, `source`, `links{claim, direction}`) | ja, wenn in `E*` | VS-2 |
| `Proposition.truth`, Propositions-ID, Red-Herring-Zugehörigkeit | nie | VS-2 D-5 |
| Aussage mit Inhalt (`assert`, `express_uncertainty`) | ja, wenn Attitude vorhanden, Referenten bekannt, Policy `answer`/`invert` | VS-4 |
| Existenz einer Attitude bei abweichender `refuse`/`evade`-Regel | ja (TASK-0005 §10, autorisiert), aber **kein Literal**; V1 wertet diesen Kanal nicht | – |
| Ort und Zeit bekannter Events | ja **[A-VS5-2]** | VS-5 Event-Sicht |
| Verdächtige, Zusagen | ja **[A-VS5-1]** | VS-5 Briefing |
| Secrets, Motive, Beziehungen, Resolutions, Conclusion-IDs, Provenance, `intent` | nie | Roadmap §3 Eigenschaft 3 |

### 9.3 Testimonium: `testimonyPolicy`

| Policy | Axiom aus Aussage, wenn … | Verwendung |
|---|---|---|
| `evidence_only` | nie (Aussagen nur in `Conf` und zur Konfliktauflösung relevant) | strengste Zertifikate; Fälle, die ganz auf physischen Spuren beruhen |
| `corroborated` (**Default**) | das Literal zusätzlich aus Evidence stammt **oder** von ≥ 2 verschiedenen NPCs behauptet wird | Standard; verhindert, dass ein einzelner (zufällig ehrlicher) Zeuge den Fall trägt |
| `trusted` | das Literal objektiv wahr ist | nur für Fälle, in denen Zeugen per Design ehrlich sind; der Report markiert `TESTIMONY_DEPENDENCY` |

`commitment: belief` zählt wie `unqualified` (eine Festlegung ist eine Festlegung; die Differenz ist Verbalization). Zwei lügende NPCs, die dieselbe Lüge erzählen, erzeugen kein Axiom, weil die Lüge nicht `holds`; sie landen in `Conf`.

`TESTIMONY_DEPENDENCY(ℓ)` für `ℓ ∈ Req`: `ℓ ∈ Δ` aber `ℓ ∉ Δ_E`, wobei `Δ_E` der Fixpunkt ohne `AX-S` ist. Zwei Fixpunktläufe, exakt, billig.

### 9.4 Benötigte Briefing-Erweiterung (VS-5) **[A-VS5-1]**

```text
Briefing.hypotheses: {
  eventId: EventId,                            // jedes Event mit Pflicht-Literal resp(·,e) oder none(e) braucht genau einen Eintrag
  suspectPersonIds: PersonId[],                // ≥ 2, ⊆ knownPersonIds; der Spieler erwägt genau diese
  promises: ("culprits_among_suspects" | "some_culprit")[]   // eindeutig; darf leer sein
}[]
Briefing.eventViews: { eventId, locationId, time }[]   // für jedes knownEventId; VS-5 entscheidet, ob auch für
                                                       // später bekannt werdende Events (V1 nimmt an: ja, für alle in K*)
```

Fehlt der `hypotheses`-Eintrag für ein Pflicht-Event ⇒ `HYPOTHESES_MISSING(e)` (blockierend). Diese Felder sind spielerseitig (sie sagen dem Spieler, was er annehmen darf) und gehören deshalb nicht in den Witness. Falls VS-5 sie ablehnt, ist V1 nicht zertifizierbar; es gibt keinen stillen Fallback, weil ein Hypothesenraum im Witness den Spieler nicht erreichen würde und die Gegenbeispielprüfung zur Selbstbedienung des Autors machte.

---

## 10. Ambiguity

### 10.1 Vier Arten von Mehrdeutigkeit im Modell

| Art | Definition | Behandlung in V1 |
|---|---|---|
| α Hypothesen-Mehrdeutigkeit | Zwei Verdächtige erfüllen dieselben zugänglichen wahren Prämissen, aber nur einer ist verantwortlich | `BRIDGE_COUNTEREXAMPLE` für jede Regel, die sie trennen soll; Diagnose `SUSPECTS_INDISTINGUISHABLE` wenn ihre zugänglichen wahren Literal-Profile unter Umbenennung gleich sind (dann kann **keine** Brückenregel existieren) ⇒ blockierend über `REQUIRED_NOT_DERIVED` |
| β Beobachtungs-Mehrdeutigkeit (Misdirection) | Der Spieler sieht ein falsches Literal (Red Herring, Lüge, falscher Belief) und ein wahres, die sich widersprechen, oder nur das falsche | **auflösbar** ⇔ `¬ℓ ∈ Δ`; sonst `CONFLICT_UNRESOLVED(ℓ)`, wenn `ℓ` einen Verdächtigen nennt |
| γ Vokabular-Mehrdeutigkeit | Katalog-Conclusions über `role`, `cause`, `intent`, `mech` sind aus Propositionen nie entscheidbar | als Pflicht: `CONCLUSION_KIND_UNSUPPORTED`; als Nicht-Pflicht: ignoriert (VS-1 bewertet Extra-Claims neutral oder contradicted, das ist Spielersache) |
| δ Key-Unbestimmtheit | Der Autor lässt etwas offen (`partial`, `roles: null`, `intent: null`) | `RESPONSIBILITY_NOT_COMPLETE(e)` für Pflicht-Events; `BRIDGE_UNDETERMINED_INSTANCE`; sonst neutral (E3) |

### 10.2 Definition `ambiguityPolicy`

Genau drei Befunde sind **Ambiguitätsbefunde**: `CONFLICT_UNRESOLVED`, `BRIDGE_UNDETERMINED_INSTANCE`, `RESPONSIBILITY_NOT_COMPLETE`.

| | `must_be_determined` (Default) | `may_remain_ambiguous` |
|---|---|---|
| Ambiguitätsbefund vorhanden | **blockierend** ⇒ `not_certified` | Information ⇒ `certified_ambiguous` (falls sonst alles grün) |
| Pflicht-Literal nicht ableitbar | `not_certified` | `not_certified` (**keine Ausnahme**) |
| Brückenregel mit Gegenbeispiel | `not_certified` | `not_certified` |
| Evidence unerreichbar, Zusage verletzt, Bindung | `not_certified` | `not_certified` |

**`may_remain_ambiguous` bedeutet tatsächlich:** „Jedes Pflicht-Literal ist aus zugänglicher, wahrer Information mit den zugelassenen Regeln ableitbar. Aber (a) der Spieler kann auf zugängliche Fehlinformation über einen Verdächtigen stoßen, die er aus zugänglicher Information nicht widerlegen kann, und/oder (b) der Answer Key lässt die Verantwortung mindestens eines Verdächtigen offen, so dass ein Spieler, der über die Pflicht-Literale hinaus Hypothesen festlegt, falsch liegen kann, ohne dass das Spiel ihn widerlegt (VS-1: undetermined ist neutral, Schrotflinte möglich).“ Es bedeutet **nicht**, dass ein Pflicht-Literal mehrdeutig bleiben darf: Ein Pflicht-Literal ist per VS-1 Siegbedingung; wäre es nicht ableitbar, müsste der Spieler raten, und das Zertifikat wäre eine Lüge.

**`must_be_determined` bedeutet zusätzlich:** Jede zugängliche Fehlinformation über einen Verdächtigen ist aus zugänglicher Information widerlegbar, und jedes Pflicht-Event ist `complete`, so dass jede falsche Zusatzanklage über Verdächtige `contradicted` ist (keine Schrotflinte, Accusation-Design §6).

### 10.3 Konfliktauflösung präzise

`ℓ ∈ Conf` „nennt einen Verdächtigen“, wenn `ℓ` eine `personId` aus `⋃_e S(e)` enthält. Auflösung: `¬ℓ ∈ Δ`. Beispiele im Beispiel-Fall: `part(murder, anna)=T` (Red Herring, Bens Lüge) wird durch `R-EXCL` aus Annas Garten-Alibi widerlegt; `part(murder, ben)=F` (Bens Lüge) durch `cuff-button`. Nicht aufgelöst wäre z. B. Bens Lüge, wenn `cuff-button` fehlte (SC-11/SC-13): Dann steht Bens Aussage gegen die Eliminationsableitung `ELIM`, die den Spieler zwar zur richtigen Anklage führt, ihm aber kein Mittel gibt, Bens Behauptung „ich war nicht dabei“ zu widerlegen. `may_remain_ambiguous` erlaubt genau diese Situation und benennt sie.

Falsche Literale über Nicht-Verdächtige (z. B. eine Lüge über Clara) müssen nicht widerlegt werden: Sie können keine Anklage über Verdächtige stützen. Falsche Literale, die kein Pflicht-Event betreffen, ebenfalls nicht.

---

## 11. 50+ Cases

### 11.1 Fixture `LO` und Witness `W0`

`LO` = Paket „Der Brieföffner“ Revision 4 exakt nach Roadmap §7.1–7.5 (Truth, Solution, Map wie VS-2 §4.3 mit Labels, Briefing, NPC-Snapshots und Profile), ergänzt um die V1-Felder des Briefings **[A-VS5-1/2]**:

- `hypotheses: [{ eventId: murder, suspectPersonIds: [anna, ben], promises: [culprits_among_suspects, some_culprit] }]`
- `eventViews: [{ eventId: murder, locationId: library, time: { instant @1500 } }]`

`W0` = `{ testimonyPolicy: corroborated, ambiguityPolicy: must_be_determined, bridgeRules: [BR-IN, BR-OUT] }` mit

- `BR-IN`: `part(murder, $P)=T ⊢ resp($P, murder)=T`
- `BR-OUT`: `part(murder, $P)=F ⊢ resp($P, murder)=F`

Erwarteter Lauf auf `LO + W0` (Referenz für alle Varianten):

| Größe | Wert |
|---|---|
| `K*` | anna, ben, clara, library, garden, letter-opener, **gloves** (über `gloves-dirty`), murder; **nicht** argument, walk |
| `Ticks*` | {1500} (aus `muddy-path`/`gloves-dirty`-Claims und der Event-Sicht) |
| `E*` | cuff-button, fingerprint, gloves-dirty, muddy-path (4/4; unerreichbar: keine) |
| `Σ*` | Anna: `at(anna,garden,1500)` assert T, `at(anna,library,1500)` assert F, `part(murder,ben)` express_uncertainty; Ben: `part(murder,ben)` assert F (Lüge), `item(murder,opener)` claim_ignorance, `part(murder,anna)` assert T (Lüge), `at(anna,garden,1500)` assert T belief. `ben-at-argument` beider NPCs **nicht** erreichbar (argument ∉ K*) |
| `Ax` | `part(murder,ben)=T` [cuff-button]; `item(murder,opener)=T` [fingerprint, Nicht-RH-Link]; `at(anna,garden,1500)=T` [muddy-path, Anna, Ben]; `at(anna,library,1500)=F` [gloves-dirty, Anna] |
| `Δ \ Ax` | `part(murder,anna)=F` [R-EXCL ← at(anna,garden,1500)=T, murder@library@1500]; `resp(ben,murder)=T` [BR-IN(ben); ELIM(murder, ben)]; `resp(anna,murder)=F` [BR-OUT(anna)] |
| `BR`-Prüfung | BR-IN: anna vakuös, ben ✓; BR-OUT: anna ✓ (`complete` ⇒ F), ben vakuös; keine Gegenbeispiele |
| `Conf` | `part(murder,anna)=T` [fingerprint RH-Link, Bens Lüge] → widerlegt durch R-EXCL ✓; `part(murder,ben)=F` [Bens Lüge] → widerlegt durch cuff-button ✓ |
| VS-1 | Anklage `[resp(ben)=T, resp(anna)=F]` ⇒ `solved` |
| **Verdict** | **`certified`**, 0 Befunde, `TESTIMONY_DEPENDENCY` leer (`Δ_E = Δ`) |

Schreibweise in der Tabelle: `must`/`may` = `ambiguityPolicy`; Befunde ohne Severity sind blockierend; `(amb)` = Ambiguitätsbefund; `(info)` = Information. Jede Zeile ist ein Test; „Parse-Fehler“ meint `parseSolvabilityWitness` bzw. den VS-5-Briefing-Parser mit Zod-Pfad.

### 11.2 Erreichbarkeit

| # | Abweichung von `LO + W0` | Verdict | Befunde | Prüft |
|---|---|---|---|---|
| SC-01 | keine | certified | – ; Spur: 4 Axiome, 4 abgeleitete Literale, `resp(ben)=T` mit zwei Begründungen | Baseline, E2E-03 |
| SC-02 | `truth.evidence = []`, `redHerrings = []`, Map leer, beide Profile Default `refuse` | not_certified | `REQUIRED_NOT_DERIVED` ×2; `SUSPECTS_INDISTINGUISHABLE(anna, ben)` (info) | **Answer Key vorhanden, aber kein Evidence** |
| SC-03 | Briefing `knownLocationIds = []`, `knownItemIds = []` | not_certified | `EVIDENCE_UNREACHABLE` ×4; `REQUIRED_NOT_DERIVED` ×2 | **alle Evidence unerreichbar** (Map gültig, Fixpunkt leer) |
| SC-04 | Briefing ohne `garden` | not_certified | `EVIDENCE_UNREACHABLE(muddy-path, gloves-dirty)`; `REQUIRED_NOT_DERIVED(resp(anna)=F)`; `CONFLICT_UNRESOLVED(part(murder,anna)=T)` (amb) | Alibi unerreichbar ⇒ negative Pflicht nicht ableitbar; Annas Aussage über den Garten ist nicht fragbar |
| SC-05 | Map: `muddy-path via examine_item(gloves)` (gloves erst über `gloves-dirty` bekannt) | certified | – ; Report `reachability.iterations = 2` | Fixpunkt über mehr als eine Runde |
| SC-06 | Map: `cuff-button via examine_item(gloves)` **und** `gloves-dirty via examine_item(gloves)` (gloves wird nie bekannt) | not_certified | `EVIDENCE_UNREACHABLE(cuff-button, gloves-dirty)`; `CONFLICT_UNRESOLVED(part(murder,ben)=F)` (amb); `resp(ben)=T` dennoch über ELIM in `Δ` | zyklische Zugangsabhängigkeit = Unerreichbarkeit, kein Zyklus (VS-2 D-7) |
| SC-07 | Map: `fingerprint: inaccessible` | certified | – ; `item(murder,opener)=T` kein Axiom mehr; `Conf` ohne RH-Literal | `inaccessible` ≠ unerreichbar: kein Finding, nie Axiom (VS-2 I-10) |
| SC-08 | `muddy-path`, `gloves-dirty` aus Truth und Map entfernt | certified | `TESTIMONY_DEPENDENCY(resp(anna)=F)` (info): Tick 1500 nur aus der Event-Sicht; `at(anna,garden,1500)=T` aus Anna + Ben (2 NPCs, corroborated) | **[A-VS5-3]** Ticks aus Event-Sicht; unter `evidence_only` stattdessen `REQUIRED_NOT_DERIVED(resp(anna)=F)` |

### 11.3 Evidence-Wahrheit und Richtung

| # | Abweichung | Verdict | Befunde | Prüft |
|---|---|---|---|---|
| SC-09 | `redHerrings = [{ fingerprint → opener-used }]` (wahre Proposition als „irreführend“ markiert) | certified | `FALSE_LINK_NOT_RED_HERRING(fingerprint, part(murder,anna)=T)` (info) | RH-Ausschluss **je Link**: der wahre Link fällt aus `Ax`, der falsche Link ist unmarkiert und wird gemeldet; beides unschädlich |
| SC-10 | `redHerrings = []` | certified | `FALSE_LINK_NOT_RED_HERRING(…)` (info) | falscher Link ohne Markierung ist Autorenhinweis, kein Blocker (er ist widerlegbar) |
| SC-11 | `cuff-button` **refutes** `ben-at-murder` | must: not_certified; may: certified_ambiguous | `FALSE_LINK_NOT_RED_HERRING(cuff-button)` (info); `CONFLICT_UNRESOLVED(part(murder,ben)=F)` (amb); `resp(ben)=T` nur über ELIM | Richtung falsch ⇒ kein Axiom; Elimination rettet die Ableitung, nicht die Widerlegbarkeit |
| SC-12 | `bridgeRules = []` | not_certified (beide Policies) | `REQUIRED_NOT_DERIVED` ×2 | **richtige Evidence, aber keine erlaubte Schlussregel** |
| SC-13 | `cuff-button` stützt `opener-used` statt `ben-at-murder` | must: not_certified; may: certified_ambiguous | `CONFLICT_UNRESOLVED(part(murder,ben)=F)` (amb); `resp(ben)=T` über ELIM | wahr, aber irrelevant: Bens Lüge bleibt unwiderlegt |
| SC-14 | zusätzliche Evidence `torn-sleeve` (supports `ben-at-murder`, via `examine_person(ben)`) | certified | – ; Spur: `part(murder,ben)=T` mit 2 Quellen; jede der beiden allein genügt | **redundant evidence** |

### 11.4 Brückenregeln

| # | Abweichung | Verdict | Befunde | Prüft |
|---|---|---|---|---|
| SC-15 | `suspectPersonIds = [anna, ben, clara]` | not_certified | `BRIDGE_COUNTEREXAMPLE(BR-IN, clara)` (Teilnehmerin, `resp(clara)=F`); `REQUIRED_NOT_DERIVED(resp(ben)=T)` (BR-IN deaktiviert; ELIM braucht `resp(clara)=F`, das BR-OUT nicht liefert, weil Clara Teilnehmerin ist) | **Anwesenheit → fälschlich Verantwortung** (Opfer) |
| SC-16 | Regel `BR-X: item(murder,opener)=T ⊢ resp($P)=T` | Parse-Fehler `["bridgeRules", i, "premises"]` | `BRIDGE_PREMISE_NOT_DISCRIMINATING` | Regel ohne `$P` |
| SC-17 | Regel `BR-BAIT: item(murder,opener)=T ∧ at($P,library,1500)=F ⊢ resp($P)=T` zusätzlich | not_certified | `BRIDGE_COUNTEREXAMPLE(BR-BAIT, anna)` (Prämissen gelten, `resp(anna)=F`); `BRIDGE_UNCHECKABLE_INSTANCE(BR-BAIT, ben)` (info, keine Katalog-Proposition `at(ben,library,1500)`) | **true bait → false conclusion**; der wahre Fingerabdruck-Link als Köder |
| SC-18 | Truth-Variante: Anna ebenfalls Teilnehmerin des Mordes (`anna-at-murder=T`, `walk` endet 1400, `anna-in-garden`/`anna-in-library` auf Tick 1300, Evidence `second-button` stützt `anna-at-murder`), Key unverändert (nur Ben, complete) | not_certified | `BRIDGE_COUNTEREXAMPLE(BR-IN, anna)`; `REQUIRED_NOT_DERIVED` ×2 (BR-OUT vakuös) | **zwei gleich plausible Verantwortliche** |
| SC-19 | wie SC-18, zusätzlich alle Garten-Evidence und Annas Aussagen entfernt | not_certified | `SUSPECTS_INDISTINGUISHABLE(anna, ben)` (info); `BRIDGE_COUNTEREXAMPLE`; `REQUIRED_NOT_DERIVED` ×2 | notwendige Bedingung: identische zugängliche Profile ⇒ keine Regel kann trennen |
| SC-20 | Regel `BR-V: at($P,garden,1500)=T ∧ part(murder,$P)=T ⊢ resp($P)=T` zusätzlich | certified | `BRIDGE_VACUOUS(BR-V)` (info) | leere Regel schadet nicht |
| SC-21 | Solution: `murder` **partial** `[ben]`, Pflicht nur `resp(ben)=T` (anna=F wäre vom TASK-0003-Parser abgelehnt) | must: not_certified; may: certified_ambiguous | `BRIDGE_UNDETERMINED_INSTANCE(BR-OUT, anna)` (amb); `RESPONSIBILITY_NOT_COMPLETE(murder)` (amb) | **partial responsibility**; Schrotflinten-Risiko (D1/W9) |
| SC-22 | Paket aus `tests/case-solution.fixture.ts` („Gift im Tee“): Pflicht `resp(anna,death)=T`, Verdächtige `{anna, bruno}`, Regel `part(death,$P)=F ⊢ resp($P,death)=F` | not_certified | `BRIDGE_COUNTEREXAMPLE(…, anna)` (nicht anwesend, aber verantwortlich) | Fernwirkung widerlegt „¬Teilnehmer ⇒ ¬verantwortlich“ an der Täterin selbst |
| SC-23 | Variante: Anna verflucht Clara aus dem Garten; Key `mechanism: supernatural`, `[anna]`, Pflicht `resp(anna)=T`, `mech(murder,supernatural)=T` | not_certified | `CONCLUSION_KIND_UNSUPPORTED(mech)`; `BRIDGE_COUNTEREXAMPLE(BR-OUT, anna)`; ohne `mech`-Pflicht: `REQUIRED_NOT_DERIVED(resp(anna)=T)` (nichts im Propositionsvokabular unterscheidet die Täterin) | **supernatural mechanism**: keine Sonderregel; R-EXCL bleibt korrekt |
| SC-24 | Regel mit `conclusion: { role: "direct_actor", value: true }` | Parse-Fehler `unrecognized_keys` | – | Konklusionsform ist fest (`resp($P, e)`) |
| SC-25 | Prämisse `{ kind: "personResponsibleForEvent", … }` | Parse-Fehler (Discriminator) | – | Prämissen sind Propositions-Templates, keine Conclusions (Stratifikation) |
| SC-26 | Regel mit Feld `propositionId` oder `conclusionId` | Parse-Fehler `unrecognized_keys` | – | **proof only works with spoiler ID** (unmöglich) |

### 11.5 Aussagen

| # | Abweichung | Verdict | Befunde | Prüft |
|---|---|---|---|---|
| SC-27 | Regel `BR-ARG: part(argument,$P)=T ⊢ resp($P,murder)=T` | not_certified | `BRIDGE_REFERENCES_UNKNOWN_ENTITY(BR-ARG, event:argument)`; Annas wahres Wissen `ben-at-argument` ist unerreichbar | **witness uses inaccessible NPC knowledge**; Variante mit `argument` im Briefing: Regel gültig, aber `part(argument,ben)=T` nur von Anna (1 NPC, Ben `evade`) ⇒ unter `corroborated` kein Axiom, unter `trusted` Axiom |
| SC-28 | `cuff-button` entfernt; Ben-Profil ohne `invert` auf `ben-at-murder` (ehrliches `assert T`) | certified | – ; `part(murder,ben)=T` ist unter `corroborated` **kein** Axiom (1 Quelle), `resp(ben)=T` über ELIM aus Evidence; unter `trusted` zusätzlich BR-IN über das Geständnis | Einzelzeuge trägt den Fall nicht; Elimination schon |
| SC-29 | wie `LO` (Ben lügt `part(murder,ben)=F`); **Mutant**: Wahrheitsfilter der Axiome entfernt | Mutant erkannt | `DERIVED_LITERAL_FALSE(resp(ben)=F)` (BR-OUT(ben) hätte aus der Lüge gefeuert; `σ = T`) | **false premise** kann nie Axiom sein; Defense in Depth |
| SC-30 | `cuff-button` entfernt; Annas `uncertain(ben-at-murder, leaning T)` bleibt | must: not_certified; may: certified_ambiguous | `CONFLICT_UNRESOLVED(part(murder,ben)=F)` (amb); `resp(ben)=T` über ELIM | `express_uncertainty` ist kein Axiom und widerlegt nichts |
| SC-31 | keine (Ben `feign_ignorance` auf `opener-used`) | certified | – ; Spur: `item(murder,opener)=T` nur aus `fingerprint`, kein Statement-Axiom | `claim_ignorance` trägt kein Literal; V2-O1 bleibt unberührt |
| SC-32 | `muddy-path` entfernt | certified (`corroborated`); not_certified (`evidence_only`) | `TESTIMONY_DEPENDENCY(resp(anna)=F)` (info); unter `evidence_only`: `REQUIRED_NOT_DERIVED(resp(anna)=F)`, `CONFLICT_UNRESOLVED(part(murder,anna)=T)` | zwei NPCs (Anna, Bens Belief) korroborieren; `gloves-dirty` (`=F`) kann R-EXCL nicht speisen |
| SC-33 | Ben mit Conclusion-Attitude `belief resp(ben,murder)=T`, Profil `answer` auf allem; `cuff-button` entfernt | certified | – ; das Conclusion-Statement ist **kein** Axiom und steht nicht in `Conf`; `resp(ben)=T` über ELIM | Geständnis zählt nicht (RF-06) |

### 11.6 Conclusions, Polarität, Hypothesenraum

| # | Abweichung | Verdict | Befunde | Prüft |
|---|---|---|---|---|
| SC-34a | Pflicht nur `resp(ben)=T` | certified | – | negatives Literal nicht gefordert: Autorenentscheidung, kein Befund |
| SC-34b | Pflicht `[ben=T, anna=F]`, Witness nur `BR-IN` | not_certified | `REQUIRED_NOT_DERIVED(resp(anna)=F)` | **missing negative required conclusion** (ELIM liefert nur `T`, CW-NONE nur `none`) |
| SC-35 | Unfall-Variante: Event `fall` (Clara allein, library @1500), Key `complete []`, Pflicht `none(fall)=T`; Verdächtige `{anna, ben}`, Zusage nur `culprits_among_suspects`; Ben-Alibi als Evidence (`at(ben,cellar,1500)=T`) | certified | – ; Spur: R-EXCL ×2 → BR-OUT ×2 → CW-NONE | `none(e)=T` über Closed-World der Verdächtigen; mit zusätzlicher Zusage `some_culprit`: `PROMISE_VIOLATED(some_culprit, fall)` |
| SC-36 | Key weist Clara zu (`[clara]`), Verdächtige `{anna, ben}` | not_certified | `PROMISE_VIOLATED(culprits_among_suspects, murder)`; ELIM/CW-NONE deaktiviert | Zusage gegen den Key geprüft |
| SC-37 | Key `complete []` + Zusage `some_culprit` | not_certified | `PROMISE_VIOLATED(some_culprit, murder)` | |
| SC-38 | `suspectPersonIds = [ben]` | not_certified | `SUSPECTS_TOO_FEW(murder)` | Gegenbeispielprüfung darf nicht trivialisiert werden |
| SC-39 | `suspectPersonIds = [anna, ben, dora]`, Dora existiert in der Truth, ist nicht gebrieft und wird nie referenziert | not_certified | `SUSPECT_UNKNOWN_TO_PLAYER(dora)` | Hypothesenraum muss spielerbekannt sein |
| SC-40 | `hypotheses = []` | not_certified | `HYPOTHESES_MISSING(murder)` | |
| SC-41 | Pflicht zusätzlich `cause(argument→murder)=T` | not_certified | `CONCLUSION_KIND_UNSUPPORTED(cause)` | **direct vs transitive cause**: in V1 gar nicht zertifizierbar; keine Transitivitätsregel |
| SC-42 | Pflicht zusätzlich `intent(murder,intended)=T` bzw. `role(ben,murder,direct_actor)=T`; Katalog-Conclusion `ben-actor` mit `roles: null` (undetermined), nicht Pflicht | not_certified bzw. certified | `CONCLUSION_KIND_UNSUPPORTED`; der undetermined Katalogeintrag erzeugt keinen Befund | **undetermined conclusion** ist neutral, solange nicht Pflicht (TASK-0003 schließt Pflicht aus) |

### 11.7 Ambiguität

| # | Abweichung | Verdict | Befunde | Prüft |
|---|---|---|---|---|
| SC-43 | = SC-13 mit `may_remain_ambiguous` | certified_ambiguous | `CONFLICT_UNRESOLVED` (info) | Bedeutung von `may_remain_ambiguous` (10.2) |
| SC-44 | = SC-12 mit `may_remain_ambiguous` | not_certified | `REQUIRED_NOT_DERIVED` ×2 | `may_remain_ambiguous` rettet nie ein Pflicht-Literal |
| SC-45 | Ben-Attitude `belief at(clara,garden,1500)=T` (falsch), Profil `answer` | certified | – ; `Conf` enthält das Literal, es nennt keinen Verdächtigen | Konfliktregel ist auf Verdächtige begrenzt |
| SC-46 | Key `intent: null`, Katalog `conclusion:intended` nicht Pflicht | certified | – | γ-Mehrdeutigkeit ist Spielersache (VS-1 neutral) |
| SC-47 | `muddy-path` entfernt, `evidence_only` | not_certified | `REQUIRED_NOT_DERIVED(resp(anna)=F)`; `CONFLICT_UNRESOLVED(part(murder,anna)=T)` (amb) | Widerlegung nur über Testimonium möglich ⇒ unter `evidence_only` keine |

### 11.8 Struktur, Determinismus, Bindung

| # | Abweichung | Verdict | Befunde | Prüft |
|---|---|---|---|---|
| SC-48 | Permutation von `bridgeRules`, `premises`, `truth.evidence`, `attitudes`, `map.entries`, `hypotheses` | certified | – ; `JSON.stringify(report)` bytegleich mit SC-01 | **order permutation** |
| SC-49 | zwei Regeln mit gleicher `id` → Parse-Fehler `["bridgeRules", 1, "id"]`; zwei inhaltsgleiche Regeln mit verschiedenen IDs | Parse-Fehler bzw. certified | – ; Spur nennt beide Regeln als Begründung | **duplicate steps** |
| SC-50 | Property: Fixpunkt mit umgekehrter/zufälliger (seeded) Regelreihenfolge | identisches `Δ` | – ; eine Regel, deren Prämisse ihre eigene Konklusion wäre, ist nicht darstellbar (Prämissen-Arten ≠ Konklusions-Art) | **circular proof**, **witness references itself**: konstruktiv unmöglich |
| SC-51 | Regel `BR-H: at($P,library,1500)=T ⊢ resp($P)=T` zusätzlich (Proposition existiert für niemanden mit `T`) | certified | `BRIDGE_UNCHECKABLE_INSTANCE(BR-H, ben)` (info); BR-H feuert nie (kein Axiom); ohne `W0`: `REQUIRED_NOT_DERIVED` ×2 | **witness uses hidden proposition**: ein Literal ohne zugängliche Quelle ist nie in `Δ` |
| SC-52 | `BR-IN` entfernt / `BR-OUT` entfernt | certified / not_certified | – / `REQUIRED_NOT_DERIVED(resp(anna)=F)` und `resp(ben)=T` fällt mit (ELIM braucht `resp(anna)=F`) | **multiple valid proof paths**: `resp(ben)=T` hat in `LO` zwei Begründungen |
| SC-53 | zweimal `certifySolvability`; Witness-JSON mit anderer Property-Reihenfolge | certified | bytegleiche Reports; alle Teile eingefroren | Determinismus, E2E-05 |
| SC-54 | Witness `truthHash` der Revision 3 / `solutionHash` eines anderen Keys | not_certified | genau `WITNESS_BINDING_MISMATCH`, sonst nichts | Bindung an Truth **und** Solution (RF-11) |
| SC-55 | **Mutant**: VS-1-Abschluss liefert `not_solved` | Mutant erkannt | `ACCUSATION_NOT_SOLVED` | L4, Defense in Depth |
| SC-56 | Witness mit `cites`, `walkthrough`, `justifications` (Roadmap-Form) | Parse-Fehler `unrecognized_keys` | – ; Typecheck: kein Export `toPlayer*` in `case-solvability.ts` | Roadmap-Witness ist kein V1-Witness; keine Spielerprojektion |
| SC-57 | Property (seeded): zu einem `certified`-Paket eine wahre, nicht-RH Evidence hinzufügen | certified bleibt | – | L7 Monotonie; Gegenstück: eine falsche Aussage über einen Verdächtigen kann `must_be_determined` kippen (dokumentiert) |
| SC-58 | `eventViews = []` (**[A-VS5-2]** nicht erfüllt) | not_certified | `REQUIRED_NOT_DERIVED(resp(anna)=F)`; `CONFLICT_UNRESOLVED(part(murder,anna)=T)` (amb) | R-EXCL braucht Ort und Zeit des Events; ohne VS-5-Sicht ist das Beispiel nicht zertifizierbar |

### 11.9 Abdeckung der geforderten Fälle

| Gefordert | Fälle |
|---|---|
| Answer key vorhanden, aber kein Evidence | SC-02 |
| alle Evidence unerreichbar | SC-03, SC-06 |
| richtige Evidence, aber keine erlaubte Schlussregel | SC-12, SC-44 |
| Anwesenheit → fälschlich Verantwortung | SC-15, SC-22 |
| true bait → false conclusion | SC-17 |
| zwei gleich plausible Verantwortliche | SC-18, SC-19 |
| partial responsibility | SC-21 |
| missing negative required conclusion | SC-34b |
| circular proof / witness references itself | SC-50, SC-25 |
| witness uses hidden proposition | SC-51 |
| witness uses inaccessible NPC knowledge | SC-27 |
| false premise | SC-29, SC-11 |
| undetermined conclusion | SC-21, SC-42 |
| proof only works with spoiler ID | SC-26, SC-56 |
| order permutation | SC-48, SC-53 |
| duplicate steps | SC-49 |
| redundant evidence | SC-14 |
| multiple valid proof paths | SC-52 |
| supernatural mechanism | SC-23 |
| direct vs transitive cause | SC-41 |
| `ambiguityPolicy` | SC-21, SC-43, SC-44 |

---

## 12. Algorithm

`certifySolvability(pkg, witness)`; alle Schritte rein, ohne Zeit, Zufall oder `localeCompare`; jede Liste nach UTF-16-Codeeinheiten sortiert; Ergebnis tief eingefroren.

```
1  Bindung
   witness.caseId/truthHash/solutionHash gegen pkg; sonst Report mit genau WITNESS_BINDING_MISMATCH.
   (pkg ist per VS-5 bereits semantisch konsistent und in sich gebunden.)

2  Hypothesenraum (Briefing)
   für jedes Event e mit Pflicht-Literal resp(·,e) oder none(e):
     Eintrag fehlt            → HYPOTHESES_MISSING(e)
     |S(e)| < 2               → SUSPECTS_TOO_FEW(e)
     für jede Zusage z ∈ Prom(e):
       culprits_among_suspects: assignments(e) ⊄ S(e)  → PROMISE_VIOLATED(z, e)
       some_culprit:            σ(none(e)) ≠ F         → PROMISE_VIOLATED(z, e)
   für jedes Pflicht-Literal: kind ∉ {resp, none} → CONCLUSION_KIND_UNSUPPORTED(ℓ)
   (Zusagen mit Befund gelten als nicht vorhanden: ELIM/CW-NONE bleiben aus.)

3  Erreichbarkeit (Abschnitt 9.1)
   K*, Ticks*, E*, Σ*, EventFacts*; unreach = accessibleEvidenceIds(map) \ E* → EVIDENCE_UNREACHABLE(e)
   S(e) ⊄ K* → SUSPECT_UNKNOWN_TO_PLAYER(p)

4  Beobachtungen und Axiome (6.3)
   O_E, O_Σ, RH, sources(ℓ), holds(ℓ); Ax nach testimonyPolicy; Conf = { ℓ ∈ O : ¬holds(ℓ) }
   falscher Link ∉ RH → FALSE_LINK_NOT_RED_HERRING(e, ℓ) (info); falsche Aussage → STATEMENT_FALSE(n, ℓ) (info)
   Ax_E = Ax ohne Aussagen (für TESTIMONY_DEPENDENCY)

5  Brückenregeln (6.5)
   für jede Regel r (nach id):
     Konstanten ∉ K*                     → BRIDGE_REFERENCES_UNKNOWN_ENTITY(r, id)
     für jeden P ∈ S(e_r) (nach id):
       τ(c_i[P]) für alle i:  ⊥ dabei     → BRIDGE_UNCHECKABLE_INSTANCE(r, P) (info), Instanz vakuös
       alle Prämissen gelten:
         σ(resp(P,e)) = U                → BRIDGE_UNDETERMINED_INSTANCE(r, P) (amb)
         σ(resp(P,e)) ≠ v_r (bestimmt)   → BRIDGE_COUNTEREXAMPLE(r, P)
     keine Instanz mit geltenden Prämissen → BRIDGE_VACUOUS(r) (info)
   Regel mit blockierendem Befund feuert in 6 nicht.

6  Ableitung (Forward Chaining)
   Δ ← Ax; trace ← Axiome mit Quellen
   repeat
     für R-EXCL, dann BR (nach id, P), dann ELIM (e, P), dann CW-NONE (e):
       jede Instanz mit prem ⊆ Δ: concl zu Δ hinzufügen (neu oder weitere Begründung), trace-Eintrag
       ¬holds(concl) → DERIVED_LITERAL_FALSE (unerreichbar bei korrekter Implementierung; Mutations-Detektor)
   until Δ unverändert
   Δ_E ← dieselbe Iteration über Ax_E

7  Abdeckung und Abhängigkeit
   ℓ ∈ Req, ℓ ∉ Δ   → REQUIRED_NOT_DERIVED(ℓ)
   ℓ ∈ Req ∩ Δ \ Δ_E → TESTIMONY_DEPENDENCY(ℓ) (info)
   Diagnose: Profile prof(P) = { ℓ[P ↦ ·] : ℓ ∈ Ax, P ∈ mentions(ℓ) }; prof(P) = prof(Q) für P ≠ Q ∈ S(e)
            → SUSPECTS_INDISTINGUISHABLE(P, Q) (info)

8  Ambiguität (Abschnitt 10)
   ℓ ∈ Conf mit mentions(ℓ) ∩ ⋃S(e) ≠ ∅ und ¬ℓ ∉ Δ → CONFLICT_UNRESOLVED(ℓ) (amb)
   Pflicht-Event e mit completeness partial            → RESPONSIBILITY_NOT_COMPLETE(e) (amb)

9  VS-1-Abschluss
   parseAccusation({ literals: Req }) → evaluateAccusation; verdict ≠ solved → ACCUSATION_NOT_SOLVED

10 Report
   findings sortiert nach (code, subjectIds); severity je Code; amb unter must_be_determined → blocking
   verdict = not_certified, falls ein blocking-Befund; certified_ambiguous, falls nur amb/info und may_remain_ambiguous;
             certified, falls nur info
```

Die Schritte 1–2 sind reine Lookups; 3 ist der Fixpunkt über VS-2/VS-4; 5 und 6 sind die einzigen Stellen mit Instanziierung; 7–9 sind Mengenvergleiche. Kein Schritt ruft die Engine von VS-3 direkt auf; alles läuft über `createInterrogation(...).ask` (VS-4), damit die V2-O1/O2-Regeln automatisch gelten.

---

## 13. Complexity

Bezeichnungen: `n` Entitäten, `m` Evidence-Einträge, `λ` Links gesamt, `a` Attitudes über alle NPCs, `s = max |S(e)|`, `r` Brückenregeln, `π` max. Prämissen je Regel, `q` Katalog-Propositionen, `ε` Pflicht-Events, `|L|` Literalraum ≤ `q + n·|Events| + s·ε`.

| Schritt | Schranke | „Der Brieföffner“ |
|---|---|---|
| Fixpunkt `K*` | ≤ `n` Runden × (`n` Aktionen × Reducer `O(m)` + Projektion `O(λ)`) ⇒ `O(n²·m + n·λ)` | 2 Runden, 7 → 8 Entitäten |
| `Σ*` | `a` Aufrufe von `ask`; je Aufruf `O(a)` (Projektion + Engine) ⇒ `O(a²)` | 9 Attitudes, 7 Aufrufe |
| Axiome, `Conf` | `O(λ + a)` | 5 Link-Literale + 5 Statement-Literale |
| Brückenprüfung | `O(r · s · π)` τ-Lookups | 2 · 2 · 1 |
| Ableitung | ≤ `|L|` Runden × (`R-EXCL`: `|at-Literale| · |Events|` + `BR`: `r·s·π` + `ELIM`: `ε·s²` + `CW`: `ε·s`) ⇒ polynomiell, praktisch 2–4 Runden | 3 Runden, 8 Literale |
| `Δ_E`, Profile, Konflikte | zweiter Fixpunkt + `O(s² · |Ax|)` + `O(|Conf|)` | trivial |
| VS-1 | `O(|Req| · |Resolutions|)` | 2 Literale |

Keine Suche, kein Backtracking, keine Exponentialität: Der Hypothesenraum ist explizit (`S(e)`), die Regeln sind Horn, der Literalraum endlich. Eine SAT-Kodierung (Ansatz D) würde bei `s` Verdächtigen `2^(s·ε)` Belegungen betrachten; V1 braucht sie nicht, weil L5 die Eindeutigkeit über den Fixpunkt liefert.

---

## 14. Proposed APIs

Eine Produktionsdatei, vier Testdateien; Muster `case-solution.ts`/`npc-knowledge.ts`.

```text
// src/domain/case-solvability.ts

// Witness
export type SolvabilityWitnessInput, SolvabilityWitness        // Brand "SolvabilityWitness", DeepReadonly
export function createSolvabilityWitnessSchema(truth: CaseTruth, solution: CaseSolution)
export function parseSolvabilityWitness(input: unknown, truth: CaseTruth, solution: CaseSolution): SolvabilityWitness

// Erreichbarkeit (eigenständig nutzbar, z. B. von VS-5 für Lints)
export type ReachabilityReport = {
  readonly knownEntities: readonly { kind, id }[],       // sortiert
  readonly knownTicks: readonly number[],
  readonly accessibleEvidenceIds: readonly EvidenceId[],  // = E*
  readonly inaccessibleEvidenceIds: readonly EvidenceId[],// authored inaccessible (kein Befund)
  readonly unreachableEvidenceIds: readonly EvidenceId[], // via, aber nie erreichbar (Befund)
  readonly statements: readonly Statement[],              // Σ*, sortiert nach (npcId, Claim-Schlüssel)
  readonly iterations: number
}
export function computeReachability(pkg: CasePackage): ReachabilityReport

// Zertifikat
export type SolvabilityFinding = { readonly code: SolvabilityFindingCode; readonly severity: "blocking" | "ambiguity" | "info";
                                   readonly subjectIds: readonly string[]; readonly message: string }
export type Derivation = { readonly literal: Literal; readonly by: readonly (
    | { kind: "evidence"; evidenceId }
    | { kind: "statement"; npcId }
    | { kind: "rule"; rule: "R-EXCL" | "BR" | "ELIM" | "CW-NONE"; ruleId?: string; instance?: PersonId; premises: readonly Literal[] })[] }
export type SolvabilityReport = {
  readonly rulesetVersion: "solvability-v1",
  readonly verdict: "certified" | "certified_ambiguous" | "not_certified",
  readonly policy: { readonly testimony: TestimonyPolicy; readonly ambiguity: AmbiguityPolicy },
  readonly reachability: ReachabilityReport,
  readonly axioms: readonly Derivation[],
  readonly derivations: readonly Derivation[],     // Δ \ Ax, jede mit allen Begründungen
  readonly conflicts: readonly { literal: Literal; sources: readonly string[]; refuted: boolean }[],
  readonly findings: readonly SolvabilityFinding[] // sortiert (code, subjectIds)
}
export function certifySolvability(pkg: CasePackage, witness: SolvabilityWitness): SolvabilityReport
```

Befundcodes (vollständig):

| Code | Severity | Subjekte |
|---|---|---|
| `WITNESS_BINDING_MISMATCH` | blocking | – (einziger Befund im Report) |
| `HYPOTHESES_MISSING` | blocking | eventId |
| `SUSPECTS_TOO_FEW` | blocking | eventId |
| `SUSPECT_UNKNOWN_TO_PLAYER` | blocking | eventId, personId |
| `PROMISE_VIOLATED` | blocking | promise, eventId |
| `CONCLUSION_KIND_UNSUPPORTED` | blocking | Literal-Schlüssel |
| `EVIDENCE_UNREACHABLE` | blocking | evidenceId |
| `BRIDGE_REFERENCES_UNKNOWN_ENTITY` | blocking | ruleId, entityId |
| `BRIDGE_COUNTEREXAMPLE` | blocking | ruleId, personId |
| `REQUIRED_NOT_DERIVED` | blocking | Literal-Schlüssel |
| `DERIVED_LITERAL_FALSE` | blocking (intern) | Literal-Schlüssel |
| `ACCUSATION_NOT_SOLVED` | blocking (intern) | – |
| `BRIDGE_UNDETERMINED_INSTANCE` | ambiguity | ruleId, personId |
| `RESPONSIBILITY_NOT_COMPLETE` | ambiguity | eventId |
| `CONFLICT_UNRESOLVED` | ambiguity | Literal-Schlüssel |
| `BRIDGE_UNCHECKABLE_INSTANCE` | info | ruleId, personId |
| `BRIDGE_VACUOUS` | info | ruleId |
| `FALSE_LINK_NOT_RED_HERRING` | info | evidenceId, Literal-Schlüssel |
| `STATEMENT_FALSE` | info | npcId, Literal-Schlüssel |
| `TESTIMONY_DEPENDENCY` | info | Literal-Schlüssel |
| `SUSPECTS_INDISTINGUISHABLE` | info | eventId, personId, personId (sortiert) |

Keine spielerseitige Projektion; kein `toPlayer*`-Export (Typecheck-Test). Erlaubte Importe: `zod`; `case-truth.ts` (ID-Schemas, `TickSchema`, Typen), `case-truth.identity.ts`, `case-solution.ts` (`ConclusionClaimSchema`, `evaluateConclusionClaim`, Typen), `case-solution.identity.ts`, VS-1 (`parseAccusation`, `evaluateAccusation`), VS-2 (`applyInvestigationAction`, `projectInvestigation`, `accessibleEvidenceIds`, `referencedEntities`, `initialInvestigationState`), VS-4 (`createInterrogation`), VS-5 (`CasePackage`-Typ). Kein Import von `npc-knowledge.projection.ts` oder `npc-dialogue-policy.ts` (nur über VS-4), kein `case-semantics.ts` (Vorbedingung liegt bei VS-5).

Dateien: `src/domain/case-solvability.ts` (≈ 320–380 Zeilen: Schema 55, Erreichbarkeit 70, Axiome/Konflikte 50, Brückenprüfung 50, Ableitung 80, Abdeckung/Ambiguität/VS-1 40, Report 35); `tests/case-solvability.fixture.ts` (`LO`, `W0`, Varianten-Factories); `tests/case-solvability.test.ts` (SC-01…SC-58, Properties); `tests/case-solvability.typecheck.ts`; `tests/mystery-e2e.test.ts` bleibt wie in der Roadmap (Walkthrough ist E2E, nicht Witness). Obergrenze 400; Rückfall: `computeReachability` nach VS-5 (das `knownEntities` ohnehin ableitet), dann ≈ 270–310.

---

## 15. Required Inputs from VS-2/3/4/5

| Von | Benötigt | Status | Konsequenz bei Fehlen |
|---|---|---|---|
| **VS-1** | `evaluateConclusionClaim(truth, solution, claim)`; `parseAccusation(input, truth)`, `evaluateAccusation(acc, truth, solution)` mit `solved ⇔ missing = ∅ ∧ contradicted = ∅`; struktureller Claim-Schlüssel (lokal nachgebaut, D7) | Design vorhanden | ohne VS-1: `σ` nicht berechenbar; V1 kann nicht starten |
| **VS-2** | `EvidenceAccessMap` mit `via`/`inaccessible` je Evidence; `initialInvestigationState(map)`; `applyInvestigationAction(map, state, action) → {state, newlyDiscovered}`; `projectInvestigation(map, truth, state) → PlayerEvidenceView[]` mit `links[{claim, direction}]` **ohne** Propositions-IDs; `accessibleEvidenceIds(map)`; `referencedEntities(view)` | Design vorhanden (§4.1, §7.1, §8.1, §11 I-1/I-4/I-6) | `referencedEntities` fehlt ⇒ lokal nachbauen (≈ 15 Zeilen, Doppelcode mit VS-5); `inaccessible` fehlt ⇒ `unreachableEvidenceIds` = alle nicht erreichten |
| **VS-3** | nichts direkt | Contract v2 | nur über VS-4 |
| **VS-4** | `createInterrogation(truth, solution, snapshot, profile).ask(claim: unknown) → AskResult` mit `Statement{npcId, claim, answer}`; `answer.kind ∈ {assert{value, commitment}, express_uncertainty{leaning}, claim_ignorance, refuse, evade}`; **[A-VS4-1]** rein und zustandslos; **[A-VS4-2]** unsichtbare Entität ⇒ Default-Act (V2-O1); Claim im Statement aus der Frage | Roadmap-Design | ohne VS-4: `Σ* = ∅`, `testimonyPolicy` wirkungslos; Beispiel bleibt über Evidence zertifizierbar (SC-07/SC-31 zeigen, dass Aussagen in `LO` nicht tragend sind) |
| **VS-5** | `CasePackage` (semantisch konsistent, alle Bindungen gleich); `Briefing.known*Ids`, `interrogablePersonIds`; **neu [A-VS5-1]** `Briefing.hypotheses[]` (Verdächtige ≥ 2 je Pflicht-Event, Zusagen); **neu [A-VS5-2]** `Briefing.eventViews[]` (Ort, Zeit) für bekannte Events, Entscheidung ob nur gebriefte oder alle `K*`-Events; **[A-VS5-3]** Tick-Bekanntheit = Ticks aus Views ∪ Event-Sichten; `knownEntities(pkg, session)` identisch zur Fixpunktdefinition (sonst Drift zwischen Spiel und Zertifikat) | kein Design vorhanden | ohne `hypotheses`: `HYPOTHESES_MISSING` für jedes Pflicht-Event, nichts zertifizierbar; ohne `eventViews`: R-EXCL tot, Beispiel nicht zertifizierbar (SC-58) |
| **TASK-0002** | leerer Report als Paketvorbedingung (L1) | Code auf `main` | VS-5 erzwingt es; V1 prüft es nicht erneut |

Ausdrückliche Bitte an VS-5: `knownEntities` und die Fixpunktregel in Abschnitt 9.1 müssen **eine** Definition sein. Empfehlung: `computeReachability` exportieren und `knownEntities(pkg, session)` als dessen Einschränkung auf das tatsächlich Entdeckte implementieren, oder umgekehrt den VS-5-Ableiter in VS-6 wiederverwenden. Zwei Implementierungen derselben Regel sind RF-05 in neuem Gewand.

---

## 16. Non-Goals

- Keine allgemeine Inferenz-Engine, keine Regelsprache für Autoren jenseits der Brückenregel-Form, keine Negation-as-Failure, keine Wahrscheinlichkeiten, keine Gewichte.
- Keine Herleitung von `role`, `cause`, `intent`, `mechanism`; keine Transitivität; keine Besitz-, Gelegenheits-, Motiv- oder Beziehungs-Propositionen. Die Empfehlung für V2 lautet: **eine** additive Claim-Art `eventHasTarget(e, p)` in TASK-0001 (`schemaVersion: 2`), damit das Opfer spielerseitig als Fakt existiert und die Verdächtigenmenge nicht das einzige Mittel ist, es auszuschließen.
- Keine Beweissuche über autorisierte Schritte; keine Erklärung in natürlicher Sprache; kein LLM.
- Keine Schwierigkeitsmessung, kein Hint-System, keine Bewertung „wie offensichtlich“ eine Ableitung ist.
- Keine Zeit in der Ermittlung, keine Konfrontation, kein ConversationState, keine Wissensweitergabe (Roadmap §10).
- Keine Prüfung der Existenz-Hinweise durch abweichende `refuse`/`evade`-Regeln (TASK-0005 §10, autorisiert); V1 wertet nur Literale.
- Keine Spielerprojektion des Zertifikats; kein Replay des Walkthroughs (E2E-Test, Roadmap §8).
- Keine Lints auf Labels, Slugs, Beschreibungen, Doppelkanal W8, Namens-Heuristiken (VS-2 I-8); das ist ein eigener Lint-Task (`case-lint`), nicht Teil des Zertifikats.
- Kein Case Generator, kein Orakel über Fallfamilien; V1 prüft genau ein Paket mit genau einem Witness.
- Keine Änderung an TASK-0001…0004-Semantik, keine Änderung an `case-solution.ts` über VS-1 hinaus.

---

## 17. Draft Contract Shape

Nur Skizze im Format 2 (`FORGE-CONTRACT-SYSTEM-V2.md` §3), **kein** Contract. `taskId`, `specifiedAgainst` und `dependencies` kann erst festlegen, wer VS-1…VS-5 gemerged hat: Format 2 verlangt für `provenance: "forge"` den Merge-Commit eines gemergten Run-PR, und `specifiedAgainst` muss diese Merges enthalten. Deshalb stehen hier Platzhalter.

```json
{
  "forgeContractFormat": 2,
  "taskId": "<offen, Arbeitstitel VS-6>",
  "title": "Mystery Solvability V1: Reachability, Bridge Rules, Certificate",
  "contractVersion": 1,
  "supersedes": null,
  "specifiedAgainst": "<main-SHA nach Merge von VS-1, VS-2, VS-4, VS-5>",
  "dependencies": [
    { "taskId": "TASK-0001", "acceptedCommit": "27075fe…", "provenance": "legacy" },
    { "taskId": "TASK-0003", "acceptedCommit": "5bfa5a4…", "provenance": "legacy" },
    { "taskId": "TASK-0004", "acceptedCommit": "e9cb8e2…", "provenance": "legacy" },
    { "taskId": "<VS-1>", "acceptedCommit": "<merge>", "provenance": "forge" },
    { "taskId": "<VS-2>", "acceptedCommit": "<merge>", "provenance": "forge" },
    { "taskId": "<VS-4>", "acceptedCommit": "<merge>", "provenance": "forge" },
    { "taskId": "<VS-5>", "acceptedCommit": "<merge>", "provenance": "forge" }
  ],
  "reads": [
    "src/domain/case-truth.ts",
    "src/domain/case-truth.identity.ts",
    "src/domain/case-solution.ts",
    "src/domain/case-solution.identity.ts",
    "src/domain/case-accusation.ts",
    "src/domain/evidence-access.ts",
    "src/domain/npc-interrogation.ts",
    "src/domain/case-package.ts"
  ],
  "scope": {
    "create": [
      "src/domain/case-solvability.ts",
      "tests/case-solvability.fixture.ts",
      "tests/case-solvability.test.ts",
      "tests/case-solvability.typecheck.ts"
    ],
    "modify": []
  },
  "requiredChecks": [
    { "name": "typecheck", "command": "npm run typecheck" },
    { "name": "test", "command": "npm test" }
  ],
  "mutants": [
    { "id": "AXIOM-TRUTH-FILTER-REMOVED", "file": "src/domain/case-solvability.ts", "before": "<holds(ℓ)-Filter beim Axiomaufbau>", "after": "<Filter entfernt>", "tests": ["tests/case-solvability.test.ts"] },
    { "id": "RH-LINK-ADMITTED", "file": "src/domain/case-solvability.ts", "before": "<RH-Link-Ausschluss>", "after": "<Ausschluss entfernt>", "tests": ["tests/case-solvability.test.ts"] },
    { "id": "BR-COUNTEREXAMPLE-SKIPPED", "file": "src/domain/case-solvability.ts", "before": "<Vergleich σ(resp(P,e)) ≠ v_r>", "after": "<immer gültig>", "tests": ["tests/case-solvability.test.ts"] },
    { "id": "BR-UNDETERMINED-AS-FALSE", "file": "src/domain/case-solvability.ts", "before": "<U-Zweig der Instanzprüfung>", "after": "<U wie F behandelt>", "tests": ["tests/case-solvability.test.ts"] },
    { "id": "ELIM-WITHOUT-PROMISE", "file": "src/domain/case-solvability.ts", "before": "<Zusagen-Prüfung vor ELIM>", "after": "<ELIM immer aktiv>", "tests": ["tests/case-solvability.test.ts"] },
    { "id": "CONFLICT-DEFUSE-IGNORED", "file": "src/domain/case-solvability.ts", "before": "<¬ℓ ∈ Δ-Prüfung>", "after": "<immer refuted>", "tests": ["tests/case-solvability.test.ts"] },
    { "id": "REACHABILITY-FROM-TRUTH", "file": "src/domain/case-solvability.ts", "before": "<K_0 aus Briefing>", "after": "<K_0 = alle Entitäten der Truth>", "tests": ["tests/case-solvability.test.ts"] },
    { "id": "VARIABLE-CHECK-REMOVED", "file": "src/domain/case-solvability.ts", "before": "<≥ 1 Prämisse enthält $P>", "after": "<Prüfung entfernt>", "tests": ["tests/case-solvability.test.ts"] }
  ],
  "limits": { "maxProductionLines": 400, "maxChangedFiles": 4 },
  "findings": []
}
```

Gliederung des Contract-Bodys (Pflichtüberschriften nach Format 2 enthalten):

1. Verbindliche Basis, Dependency-Fakten (exakte Exporte von VS-1/VS-2/VS-4/VS-5 am `specifiedAgainst`-Stand; Satz „keine Brücke“ aus 1.3 als normative Begründung).
2. Begriffe (die sieben aus 1.2) und das Zertifikat (5.3) wortgleich.
3. Witness-Dokument und Parse-Regeln (7.1, 7.2).
4. Formale Semantik (6.1–6.6) und Lemmata L1–L7 als normative Eigenschaften mit je einem Test.
5. Regelsatz (8.1–8.5) einschließlich der Liste verbotener eingebauter Regeln.
6. Erreichbarkeit (9.1) mit der Pflicht, VS-5 `knownEntities` wiederzuverwenden.
7. `testimonyPolicy`, `ambiguityPolicy` (9.3, 10.2) mit den drei Ambiguitätsbefunden.
8. Algorithmus und Ausgabe-Reihenfolge (12), Befundcodes (14).
9. **Acceptance Criteria**: SC-01…SC-58 plus Properties (Permutation, Determinismus, Monotonie, Fixpunkt-Reihenfolge); E2E-03/05/13 der Roadmap.
10. Mutationsplan: die acht Mutanten oben, jeder mit erwarteter Fundstelle.
11. **Non-Goals** (16).
12. Größe: `maxProductionLines: 400`, Rückfall `computeReachability` → VS-5.

---

## Belege

- Repository-Zustand: `git rev-parse HEAD` = `3d7545d843883418348004e68717399a64da7a7d`; `git status` leer vor und nach allen Experimenten; `git fetch origin codex/mystery-task-0005` nur zum Lesen des Contracts.
- Verifikation: `npm ci && npm run typecheck && npx vitest run` auf `main`, 2026-10-03: Exit 0 / 22 Dateien, 1087 Tests grün, 19,4 s.
- Experiment „keine Brücke“ (Scratchpad, `node --experimental-strip-types`): Truth Revision 4 (`validateCaseSemantics` 0 Findings, `truthHash 1e55a431e20695d8757cc932e52bc2d57da2667f6b0a09ca62442dce242241df`); vier unvereinbare Answer Keys parsen; Teilnehmer von `event:murder` = `person:ben, person:clara`.
- Experiment „R-EXCL“: drei Truth-Varianten (Anna als Mord-Teilnehmerin; `anna-at-murder` auf `true`; `anna-in-library` auf `true`) liefern `PERSON_LOCATION_CONFLICT`, `PARTICIPANT_CLAIM_MISMATCH`, `PERSON_PRESENCE_NEGATED` wie in L1 vorausgesetzt.
- Code vollständig gelesen: `src/domain/*.ts` (1 491 Zeilen), `src/forge/contract-document.ts` (Format-1-Parser), Fixtures und `tests/case-solution.test.ts` (Prober `statusOf`, Wahrheitstabelle AC-07, AC-08 „rejects an undetermined conclusion required as %s“).
- Designs vollständig gelesen: Roadmap (468 Zeilen), Accusation-Design (457), Candidates (252), VS-2-Design (747; Abschnitte 3, 4, 6–8, 11, 12, 14), Contract-System V2 §3, TASK-0005 Contract v2 (514), `forge/contracts/TASK-0004.md` (Regel 14, Z. 540), `forge/BASELINE-STATUS.md`.

STOP. Keine Implementierung. Offen für Sebs Entscheidung: Task-ID für VS-6; Annahme von **[A-VS5-1]** (`hypotheses`) und **[A-VS5-2]** (`eventViews`) im VS-5-Design; Default `testimonyPolicy: corroborated` und `ambiguityPolicy: must_be_determined`; V2-Schemaerweiterung `eventHasTarget`.
