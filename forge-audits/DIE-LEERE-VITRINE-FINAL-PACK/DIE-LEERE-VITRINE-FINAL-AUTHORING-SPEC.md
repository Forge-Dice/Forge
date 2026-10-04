# DIE LEERE VITRINE — Final Authoring Spec

**PRIVATE AUTORENDOKUMENT. Enthält Truth, Solution, NPC-Innenzustand und Proof-Graph. Niemals an Blindtester oder Spieler geben.**

Stand 2026-10-04 · Repository `Forge-Dice/Forge` · main `3d7545d843883418348004e68717399a64da7a7d` (unverändert, nur gelesen) · Status: **FINAL AUTHORING CANDIDATE**, nicht registriert, keine Produktionsimplementierung.

Dieses Dokument konsolidiert den bestehenden Fall. Es gibt keinen neuen Fall, keine neue Person, keinen neuen Ort, keine neue Hinweisquelle, keine neue Mechanik und keine neue Architektur. Jede Aussage ist auf ein Originalartefakt zurückgeführt (Abschnitt 0.2). Wo ein Wert erst aus dem finalen Artefakt berechnet werden kann, steht `TO_BE_COMPUTED_FROM_FINAL_ARTIFACT`.

---

## 0. Grundlagen

### 0.1 Bindende Owner-Entscheidungen (nicht neu geöffnet)

| ID | Inhalt | Wirkung in diesem Paket |
|---|---|---|
| D8 | Session V1: richtige vollständige Antwort ergibt `solved`. Keine technische Evidence-possession-Pflicht im Reducer. | Kein Citation-/Receipt-Gate, `requireReleasedProof` entfernt, Brief ohne Belegpflicht. Proof und Evidence bleiben Deduktionsmittel, Authoring-/Solvability-Evidence und Certification-Evidence. |
| D9 | Release→Proof-Adapter und PublicContent gehören zu Session A. | PublicContent und `forge-release-proof-v1`-certificateData sind Session-A-Komponenten; Runner läuft in der Fallabnahme, kein vierter Session-Task. |
| D10 | Public/Presentation-Text ist identitätsgebunden. | Jede Byteänderung an Brief, Label, Fragetext, Regeltext, Kartentext ändert `packageHash` und invalidiert alte Saves. allowedClaims dürfen false/undetermined enthalten. |

### 0.2 Gelesene Originalquellen

Alle von den Remote-Branches `forge/owner/audits/*` gelesen, nicht aus Chat rekonstruiert.

| Quelle | Branch @ Commit | Verwendete Dateien |
|---|---|---|
| Case Spec, Player Brief, Case Pack | `DIE-LEERE-VITRINE` @ `fa3a1cbf` | HEADLESS-SPEC.html (`d5e894ec…`), PLAYER-BRIEF.html (`954bf394…`), CASE-PACK.zip (`fddfdb4c…`): truth, solution, access, questions, interrogation-*, npc-*, case-host, public-initial, proof-profile |
| Certification, Proof Profile | `DIE-LEERE-VITRINE-SOLVABILITY-CERTIFICATION` @ `e66e7e19` | CERTIFICATION.html (`59725aa2…`), PROOF-PROFILE.json (`c052e467…`), CERT-EVIDENCE.zip: presentation/challenge/factivity REPAIR-CANDIDATEs |
| Release→Proof Certification Closure | `MYSTERY-RELEASE-PROOF-CERTIFICATION-CLOSURE` @ `d17f5211` | Report (`6dd79ad0…`), SESSION-A-RELEASE-PROOF-ANNEX.md (`cb0b8ba0…`), CONTRACT-PATCH-TABLE.md P01–P20 (`6fd59c61…`), VITRINE-RECERTIFICATION-CHECKLIST.md CERT-1..10 (`fa13da70…`), RELEASE-PROOF-MAPPING.tsv |
| Package/Replay Binding Closure | `MYSTERY-PACKAGE-REPLAY-BINDING-CLOSURE` @ `7ffa39c8` | Report, CONTRACT-REPAIRS.md R01–R10, hash-profile-registry.json (`91d077d8…`) |
| Final Owner Reconciliation | `FORGE-MYSTERY-FINAL-OWNER-RECONCILIATION` @ `52dab20b` | B.4–B.13, D8–D10 |
| Solvability Repair | `MYSTERY-SOLVABILITY-ACCUSATION-REPAIR` @ `f02b7a56` | MYST-SOLVABILITY-0001 draft, Report (Root-Arten, must_disambiguate) |
| Challenge Exactness | `MYST-ACCUSATION-CHALLENGE-EXACTNESS` @ `7514e7e6` | MYST-CHALLENGE-0001 draft §4–§6 |
| InfoFlow Report | `mystery-infoflow` @ `006ecf36` | INFORMATION-FLOW-REPORT.html §17/§18 (`53c38b83…`) |
| Scale Report | `MYSTERY-SCALE-COMPLEXITY` @ `27dd70f0` | §29 Vitrine-Baseline |
| Authoring Stress | `MYSTERY-CASE-AUTHORING-STRESS` @ `8b68e511` | PDF (Grenze: Domain-Kern prüft Beweisweg nicht) |
| Independent Freeze Verification | `MYSTERY-INDEPENDENT-FREEZE-VERIFICATION` @ `25a8a17b` | F04, F05, F11, §10 Vitrine Witness |
| Session A/B/C | `MYSTERY-SESSION-PRODUCTION-PACKAGE` @ `b94db40e` | SB §3–§6 (Events, PlayerKnowledge, Challenge-Integration) |
| **Final Mystery Contract Integration** | `/mnt/project-files/forge-audits/MYSTERY-FINAL-CONTRACT-INTEGRATION/` (Report sha256 `1b2c17ed…`, Manifest `b8f0a90e…`; nicht auf GitHub persistiert, Identitäts-STOP) | Verdikt „FREEZE CANDIDATE READY FOR INDEPENDENT REVIEW“. Erschien während der Arbeit an diesem Paket; Abgleich in §14. Keine Kandidatenrevision ist akzeptiert (`acceptedCommit: null`). |

### 0.3 Klassifikation

`PRIVATE` = nur Autor/QA. `INTERNAL` = trusted Host, nie Spieler. `PUBLIC-INITIAL` = ab Start sichtbar. `PUBLIC-ON-RELEASE` = sichtbar erst nach tatsächlicher Freigabe durch eine akzeptierte Aktion.

---

## 1. Fall in Kürze (PRIVATE)

Am Schließabend fehlt die Goldmedaille „Morgenstern“ aus einer Vitrine der Galerie. Der authentifizierte Sensor datiert die eigenhändige Entnahme auf 18:04:00. Vier Personen sind im Museum. **Lina Kern** entnahm die Medaille eigenhändig und legte sie um 18:05 in der Werkstatt in eine Transportkassette. Max Brandt war um 18:02 tatsächlich in der Galerie (wahre falsche Spur), zur Tatzeit aber mit Nora Weiss im Innenhof. Oskar Falk war zur Tatzeit im Archiv, glaubt aber fälschlich, Max sei um 18:04 in der Galerie gewesen.

Lernziel des Einführungsfalls: eine falsche zeitliche Erinnerung prüfen, eine wahre belastende Tatsache richtig einordnen und drei direkte Täterhypothesen durch unabhängige Bildnachweise ausschließen. Nicht verlangt: Motiv, Mittäterschaft, Planerrolle.

## 2. Private / Public Split

Kein Public-Inhalt wird aus privaten Beschreibungen abgeleitet. Public-Inhalt existiert ausschließlich als explizit authored Text in PublicContent oder EvidencePresentation oder als deterministischer Ruleset-Output aus freigegebenen Claims.

| Artefakt / Feld | Klasse | Eigentümer | Datei |
|---|---|---|---|
| CaseTruth (Personen, Orte, Items, Events inkl. Beschreibungen, Propositionen mit truth, Evidence.description/source/links, Motive, Secret, RedHerring) | PRIVATE | TASK-0001 | Case Pack `truth.json` (unverändert) |
| CaseSolution (Resolution, requiredConclusions) | PRIVATE | TASK-0003 | Case Pack `solution.json` (unverändert) |
| NPC-Snapshots (Awareness, Attitudes mit knowledge/belief/uncertain, acquiredAt, Provenance) | PRIVATE | Session A §2 / TASK-0004 | Case Pack `npc-*.json` (unverändert) |
| NPC-Projektionen / VisibleRefs | INTERNAL, transient | main projection | nie Package-, nie Spieleroutput |
| Interrogation-Profile (Regeln, Claim, Reveal) | PRIVATE | MYST-0005A | Case Pack `interrogation-*.design.json` |
| Fragekatalog (IDs, Mentions) | PRIVATE (IDs sind Event-Wire-Keys) | MYST-0005A | Case Pack `questions.design.json` |
| Evidence Access | PRIVATE | MYST-0003 | Case Pack `evidence-access.design.json` |
| EvidencePresentation (Kartentext, Mentions, Reports) | PRIVATE input → PUBLIC-ON-RELEASE je Karte | MYST-0004 | `DIE-LEERE-VITRINE-FINAL-EVIDENCE-PRESENTATION.json` |
| PublicContent (Titel, Brief, Challengefrage, Labels/Rollen, Fragetexte, Regeltexte) | PRIVATE input → PUBLIC (Labels nur für bekannte Entities) | Session A §2 (D9) | `DIE-LEERE-VITRINE-FINAL-PUBLIC-CONTENT.json` |
| InitialSetup | PRIVATE input → bestimmt PUBLIC-INITIAL | Session A §2 | `DIE-LEERE-VITRINE-FINAL-PLAYER-SETUP.json` |
| AccusationChallenge (allowedClaims ohne Polarität) | PRIVATE input, nicht spoilernd | Session A §2 / CH | `DIE-LEERE-VITRINE-FINAL-CHALLENGE.json` |
| Proof Profile + certificateData | PRIVATE | Session A §2 (D9) / SOL | `DIE-LEERE-VITRINE-FINAL-PROOF-PROFILE.json` |
| refSalt, PlayerRef-Mapping | PRIVATE | Session A §2 / MYST-0001 | beim Package-Build erzeugt |
| Certification-Erwartungen | PRIVATE | Zertifizierer | `DIE-LEERE-VITRINE-CERTIFICATION-CHECKLIST.md` |
| Spielerbrief | PUBLIC-INITIAL | Darstellung von PublicContent | `DIE-LEERE-VITRINE-FINAL-PLAYER-BRIEF.md` (nur PUBLIC-Abschnitt) |
| NPC-Antworttext | PUBLIC-ON-RELEASE | Ruleset `mystery-session-v1` (Hosttemplate) | kein Packagetext; Wortlaut ist Rulesetcode (Binding Closure R06) |

## 3. Private Authoring

### 3.1 Entities

| Art | Canonical ID | Public Label (PublicContent) | Initial bekannt |
|---|---|---|---|
| Person | person:max | Max Brandt — Historiker und Vertreter der ehemaligen Eigentümerfamilie | ja |
| Person | person:lina | Lina Kern — Restauratorin | ja |
| Person | person:nora | Nora Weiss — Museumsfotografin | ja |
| Person | person:oskar | Oskar Falk — Aufsicht und Schlüsselverwalter | ja |
| Ort | location:galerie / hof / archiv / werkstatt / foyer | Galerie / Innenhof / Archiv / Werkstatt / Foyer | ja |
| Item | item:medaille | Goldmedaille „Morgenstern“ | ja |
| Item | item:schluessel | Vitrinenschlüssel | nein (D07) |
| Item | item:kamera | Noras Kamera | nein (q08 Reveal) |
| Item | item:terminal | Archivterminal | nein (q14 Reveal) |
| Item | item:kassette | Transportkassette | nein (D06) |
| Event | event:e04 | Entnahme um 18:04 | ja |
| Event | e01 Schließrunde, e02 Galeriebesuch um 18:02, e03 Schlüsselübergabe um 18:03, e05 Hoffototermin, e06 Archivarbeit, e07 Werkstattaufnahme um 18:05, e08 Entdeckung der leeren Vitrine | wie links | nein; e08 nie erreichbar und für nichts erforderlich |
| Evidence | evidence:d01…d08 | Besucherstempel, Entnahmeprotokoll, Kontaktbogen, Vollständiger Hoffilm, Archivaufnahme, Werkstattaufnahme, Schlüsselquittung, Schließliste | nein |

### 3.2 Events (nur Autor; Ticks in Sekunden ab 18:00:00)

| Event | Zeit | Ort | Privater Inhalt |
|---|---|---|---|
| e01 | 0 (18:00) | Foyer | Alle vier bleiben nach der Schließung. |
| e02 | 120 (18:02) | Galerie | Max betrachtet die Medaille, Oskar beobachtet ihn. Max entnimmt nicht. |
| e03 | 180 (18:03) | Archiv | Oskar übergibt Lina den Vitrinenschlüssel. |
| e04 | 240 (18:04) | Galerie | **Lina entnimmt die Medaille eigenhändig.** |
| e05 | [220,280) | Innenhof | Nora und Max im synchronisierten Hoffoto. |
| e06 | [220,280) | Archiv | Oskar arbeitet, Archivkamera erfasst ihn. |
| e07 | 300 (18:05) | Werkstatt | **Lina legt die Medaille in die Transportkassette**; Bild zeigt nur geschlossenen Deckel. |
| e08 | 360 (18:06) | Galerie | Nora entdeckt die leere Vitrine. |

Intervalle sind halboffen; beide enthalten Tick 240. Ein Besuch bei Tick 120 ist kein Alibi für 240.

### 3.3 Solution (PRIVATE answer key, einzige Autorität)

`solution.json`, solutionHash `52b7912e…adcf`: Resolution e04, Ziel item:medaille, responsibility complete, Lina `direct_actor`, intent intended, mechanism ordinary, causesComplete true. requiredConclusions: actor-max **false**, actor-lina **true**, actor-nora **false**, actor-oskar **false**. Diese Liste existiert ausschließlich in CaseSolution; Proof Profile und Challenge kopieren sie nicht.

### 3.4 Motiv, Secret, Red Herring

- motive:lina: Lina will eine unerlaubte Reparatur vor der morgigen Leihgeberprüfung verbergen. Nur Erzählung, keine Proof-Prämisse, nie öffentlich vor einer optionalen solved-only Coda (nicht Teil von V1).
- secret:medaille: p06 (Lina Galerie@240), p13 (Medaille bei e07), p15 (Schlüssel bei e04). Keine Freigabe in V1.
- red-herring:max: Evidence d01, misleadingPropositionId p02 (Max Galerie@240, objektiv false). Der Brückenschluss „Max@120 ⇒ actor(Max)“ ist nur Autorenmetadatum; der Proofgraph hat keine solche Kante.

### 3.5 Versteckter NPC-Zustand (alle asOf 480)

| NPC | Privater Zustand | Dramaturgische Funktion |
|---|---|---|
| Max | knowledge: p01 true, p02 false, p03 true; keine Attitude zu Linas Ort oder zur Kamera. | Wahre falsche Spur; bestreitet 18:04-Galerie. |
| Lina | knowledge p06 true (eigene Tat), p20 true; belief actor-max false; withholding bei q16/q20 (decline). Lügt nicht. | Täterin, verweigert statt zu lügen. |
| Nora | knowledge p03, p04, p10 true, p02 false; uncertain (leaning null) zu p06. | Alibizeugin, gibt Kamera frei. |
| Oskar | knowledge p01, p05, p09, p19 true; **belief p02 true (objektiv false)**, Provenance author_modeled_inference. | Ehrlich irrender Zeuge. |

Provenance, acquiredAt, Stance-Art und Awareness werden nie exportiert.

## 4. Public Content

Normativ: `DIE-LEERE-VITRINE-FINAL-PUBLIC-CONTENT.json` (Session-A PublicContent, strict). Inhalt:

| Feld | Inhalt / Regel |
|---|---|
| title | „Die leere Vitrine“ |
| brief | Startbrief ohne Belegpflicht (Closure P11–P13), Ortsprosa, Aktionen, Journalhinweise. 1.374 UTF-16-Einheiten (≤4000). |
| challengeQuestion | „Wer entnahm die Medaille eigenhändig?“ |
| labels | 30 Entities (4 Personen mit role, sonst role null). Ausgabe nur für prefix-Known. Keine Roster-/Briefableitung aus Truth. |
| questionTexts | genau 20, je (Profil-NPC, Regelfrage) einer, Originalwortlaut aus case-host `questionText`. |
| publicRules | rule:certified-sources, rule:closed-roster, rule:manual-presence; Originaltext; statisch ab S0 sichtbar. |

Konsolidierung der geforderten Teile:

| Teil | Quelle im Paket |
|---|---|
| Player-facing Fallname | `publicContent.title` |
| Startbriefing | `publicContent.brief` + `publicRules` |
| Personennamen | `labels[kind=person].label` + `.role` |
| Ortsnamen | `labels[kind=location].label` |
| Evidence-Beobachtungen | Kartentitel = `labels[kind=evidence].label`; Kartentext/Reports = EvidencePresentation `entries[].text/.reports` (§6) |
| NPC-Antwort-Semantik | §7: Act + Response-Stance + PlayerClaim (PlayerRefs) + Mentions; Wortlaut aus Ruleset-Template mit PublicContent-Labels. „Ja“ heißt „NPC bejaht“, nie „objektiv bestätigt“. knowledge und belief sind öffentlich identisch. |
| Fragekatalog-Präsentation | `questionTexts` je NPC; eine Frage erscheint erst, wenn NPC und alle Frage-Mentions bekannt sind. Frage-IDs `question:qNN` sind neutrale, antwortunabhängige Nummern und Event-Wire-Keys, nie Anzeigetext. |
| Anklage/Challenge-Präsentation | `challengeQuestion` + vier Personenlabels in fester Darstellungsreihenfolge Max, Lina, Nora, Oskar; Auswahl wird zu vier Literalen expandiert (§9). Spieler sieht nur solved/not_solved. |

Keine Canonical-ID erscheint in einem Textfeld (geprüft: Authoring-Check P01/P02).

## 5. Initial Player Setup (S0)

Normativ: `DIE-LEERE-VITRINE-FINAL-PLAYER-SETUP.json`, `initialSetup.known` = genau 11 Entities:

- Personen: max, lina, nora, oskar
- Orte: galerie, hof, archiv, werkstatt, foyer
- Item: medaille
- Event: e04

Begründung: Alle elf sind im Brief explizit genannt. Nichts ist bekannt, nur weil es in CaseTruth existiert. **Initial bekannte Evidence: keine.** Keine initiale Discovery, kein initialer Report, keine initiale Proof-Closure.

| S0-Aspekt | Wert |
|---|---|
| Verfügbare Aktionen | `investigate/search_location` auf 5 Orte; `investigate/examine_item` auf medaille (zulässig, `found:[]`); `investigate/examine_person` auf 4 Personen (zulässig, `found:[]`); `interrogate` mit 19 Fragen; `accuse` |
| Befragbare NPCs | alle vier |
| Nicht verfügbar | q08 (Mention e05 unbekannt); examine_item auf Kamera/Terminal (Targets unbekannt → ACTION_UNAVAILABLE ohne Existenzorakel) |
| Briefing | PublicContent title, brief, challengeQuestion, drei publicRules, Labels der 11 bekannten Entities |

## 6. Investigation Routes

Alle acht Evidence-Stücke sind `discoverable`. **Inaccessible Evidence: keine.** Privat und nie freigegeben bleiben die Truth-Inhalte, die keine Karte trägt: p02, p06, p09, p10 als Fakt, p13, p14, p15, Event-Beschreibungen, Motiv, Medaillen-Verbleib.

Discovery ist nicht Wahrheit. Eine Karte wird bei Erstentdeckung freigegeben (Text, Mentions, Reports mit `source: observation`). Kein Report wird automatisch zur Welttatsache; nur die in §8 lizenzierten OBSERVED-Roots wirken im Proof.

| Evidence | Startvoraussetzung | Aktion | Target | Freigegebene Beobachtung (Kartentext) | Neu bekannt (Mentions) | Fortschrittsfolge |
|---|---|---|---|---|---|---|
| d01 Besucherstempel | S0 | search_location | Galerie | „Der Besucherstempel bestätigt: Max war um 18:02 in der Galerie. Über den Zeitpunkt 18:04 sagt der Stempel nichts.“ Report: Max@Galerie 18:02 | Galerie, Max (bekannt), Karte d01 | Wahre falsche Spur; keine Proof-Prämisse. |
| d02 Entnahmeprotokoll | S0 | search_location | Galerie (zusammen mit d01) | „Authentifizierter Entnahmesensor meldet 18:04:00; zeigt keine Identität.“ Report: e04 betrifft Medaille | e04, Medaille (bekannt), Karte d02 | Bestätigt Zeitpunkt; keine Identität. |
| d03 Kontaktbogen | S0 | search_location | Innenhof | „Nora ist auf einem undatierten Kontaktbogen des Hoffototermins erkennbar. Frage sie nach dem vollständigen Fotonachweis.“ Report: Nora Teilnehmerin e05 | **e05 Hoffototermin (neu)**, Nora, Karte d03 | Macht q08 verfügbar. Kein 18:04-Alibi. |
| d04 Vollständiger Hoffilm | Kamera bekannt (q08 nach d03) | examine_item | Noras Kamera | „Vollständiger Kamerafilm zeigt Max und Nora um 18:04:00 im Hof.“ Reports: Max@Hof 18:04, Nora@Hof 18:04 | Innenhof, Max, Nora, Karte d04 | Zwei Proof-Prämissen (observed:max, observed:nora). |
| d05 Archivaufnahme | Terminal bekannt (q14) | examine_item | Archivterminal | „Archivkamera zeigt Oskar um 18:04:00 im Archiv.“ Report: Oskar@Archiv 18:04 | Archiv, Oskar, Karte d05 | Proof-Prämisse observed:oskar. |
| d06 Werkstattaufnahme | S0 | search_location | Werkstatt | „Werkstattaufnahme, 18:05: Lina steht an einer geschlossenen Transportkassette. Ihr Inhalt ist nicht sichtbar.“ Reports: Lina Teilnehmerin e07, e07 betrifft Kassette, Lina@Werkstatt 18:05 | **e07, Transportkassette (neu)**, Werkstatt, Lina, Karte d06 | Nachträgliche Gelegenheit; kein Alibi, kein Inhaltsbeweis. Kassette bekannt, aber ohne Access-Pfad. |
| d07 Schlüsselquittung | S0 | search_location | Archiv | „Quittung bestätigt Oskar und Lina bei der Schlüsselübergabe um 18:03.“ Reports: Lina/Oskar Teilnehmer e03, e03 betrifft Schlüssel, Lina@Archiv 18:03 | **e03, Vitrinenschlüssel (neu)**, Archiv, Lina, Oskar, Karte d07 | Verdachtsvertiefung; keine Rollenbehauptung. |
| d08 Schließliste | S0 | search_location | Foyer | „Schließliste nennt genau die vier Personen, die im Museum verblieben.“ Reports: alle vier Teilnehmer e01 | **e01 (neu)**, vier Personen, Karte d08 | Verständlichkeit des geschlossenen Kreises. |

Regeln: keine Kaskade innerhalb einer Aktion; mehrere Karten derselben Aktion werden nach öffentlicher PlayerRef sortiert (InfoFlow F02, §11); Wiederholung erzeugt ein Event, aber keine zweite Karte; Ortssuche ersetzt keine Geräteauslesung.

## 7. Interrogation — alle 20 Fragen

Antwortentscheidung ausschließlich über MYST-0005B `decideResponse` auf dem gebundenen NPC-Snapshot (nie `Proposition.truth`). knowledge/belief → affirms/denies; uncertain leaning null → uncertain; keine Attitude → does_not_know (dann kein Statement, keine Mentions, kein Reveal); decline → keine Freigabe. Antworten sind deterministisch und wiederholbar bytegleich; jede Wiederholung erzeugt einen eigenen ObservationRecord.

PlayerKnowledge-Effekt: `recordInterrogation` hängt einen ObservationRecord `{source:{kind:npc,eventIndex,npc,questionId}, observation}` an und erweitert Known nur um Statement-Mentions. Kein Faktengewinn.

| Frage | NPC | Text | Verfügbar | Interner Zustand (PRIVATE) | Öffentliche Antwort | Freigegebener Claim | Neu bekannt | Proof-Relevanz |
|---|---|---|---|---|---|---|---|---|
| q01 | Max | Waren Sie um 18:02 in der Galerie? | S0 | knowledge true | affirms | Max@Galerie 18:02 | – | keine (Bericht) |
| q02 | Max | Waren Sie um 18:04 in der Galerie? | S0 | knowledge false | denies | Max@Galerie 18:04 | – | keine |
| q03 | Max | Waren Sie um 18:04 im Hof? | S0 | knowledge true | affirms | Max@Hof 18:04 | – | keine; ersetzt d04 nicht |
| q04 | Max | War Lina um 18:04 in der Galerie? | S0 | keine Attitude | does_not_know | – | – | keine |
| q05 | Max | Wo ist der vollständige Fotonachweis? | S0 | keine Attitude (Regel hat Reveal e05+Kamera) | does_not_know | – | – (**kein Reveal**) | Negativkontrolle |
| q06 | Nora | War Max um 18:04 im Hof? | S0 | knowledge true | affirms | Max@Hof 18:04 | – | keine |
| q07 | Nora | Waren Sie um 18:04 im Hof? | S0 | knowledge true | affirms | Nora@Hof 18:04 | – | keine |
| q08 | Nora | Kann ich den vollständigen Film dieses Hoffototermins sehen? | nach d03 (e05 bekannt) | knowledge true | affirms | e05 betrifft Noras Kamera | **Noras Kamera** (Reveal) | Zugriff auf d04 (Witness-Schritt), keine Prämisse |
| q09 | Nora | War Max um 18:04 in der Galerie? | S0 | knowledge false | denies | Max@Galerie 18:04 | – | keine |
| q10 | Nora | War Lina um 18:04 in der Galerie? | S0 | uncertain, leaning null | uncertain | Lina@Galerie 18:04 | – | keine; nie Boolean |
| q11 | Oskar | War Max um 18:02 in der Galerie? | S0 | knowledge true | affirms | Max@Galerie 18:02 | – | keine |
| q12 | Oskar | War Max um 18:04 in der Galerie? | S0 | **belief true, objektiv false** | affirms | Max@Galerie 18:04 | – | keine; bleibt Bericht |
| q13 | Oskar | Waren Sie um 18:04 im Archiv? | S0 | knowledge true | affirms | Oskar@Archiv 18:04 | – | keine; ersetzt d05 nicht |
| q14 | Oskar | Wo ist der unabhängige Archivnachweis? | S0 | knowledge true | affirms | e06 betrifft Archivterminal | **Archivarbeit, Archivterminal** (Reveal) | Zugriff auf d05 (Witness-Schritt) |
| q15 | Oskar | War Lina um 18:03 bei Ihnen im Archiv? | S0 | knowledge true | affirms | Lina@Archiv 18:03 | – | keine |
| q16 | Lina | Waren Sie um 18:04 in der Galerie? | S0 | withholding | decline | – | – | keine; kein Schuldbeweis |
| q17 | Lina | Hat Max die Medaille eigenhändig entnommen? | S0 | belief false (wahr) | denies | Max direct_actor e04 | – | keine |
| q18 | Lina | Waren Sie um 18:05 in der Werkstatt? | S0 | knowledge true | affirms | Lina@Werkstatt 18:05 | – | keine |
| q19 | Lina | War Nora um 18:04 im Hof? | S0 | keine Attitude | does_not_know | – | – | keine |
| q20 | Lina | Möchten Sie zur Entnahme Stellung nehmen? | S0 | withholding | decline | – | – | keine |

Summe: 18 answer-Regeln, 2 decline; 14 bestimmte Berichte, 1 uncertain, 3 does_not_know. Genau eine bestimmte Behauptung ist objektiv falsch (q12). Interne Intent/Stance-Art, Provenance und Awareness erscheinen nie in PlayerContent.

## 8. Proof Profile

Normativ: `DIE-LEERE-VITRINE-FINAL-PROOF-PROFILE.json`. Graph semantisch unverändert gegenüber dem Original (`c052e467…`): 8 Roots, 12 Nodes, 4 AND-Kanten, `must_disambiguate`, Frage `required_literals`, Scope = vier direct_actor-Conclusions, witnessStepIds = search-hof → ask-nora-photo → read-camera → ask-oskar-record → read-terminal. Nur `bindings.releaseHash` ist neu zu berechnen; der Scratch-Wert `2eaf25cc…` ist ungültig.

Der finale Release→Proof-Adapter `forge-release-proof-v1` (Session-A-Annex §4) ist als `releaseManifestCandidate.certificateData` instanziiert: 5 Steps als echte Session-B-Events (investigate/interrogate) mit PlayerRef-Platzhaltern, 4 OBSERVED-PremiseMaps und 4 PUBLIC_RULE-Gates.

### 8.1 Vier Ebenen streng getrennt

| Ebene | Was es ist | Vitrine-Beispiele | Wirkt im Proof? |
|---|---|---|---|
| OBSERVATION | Tatsächlich freigegebener Report einer Evidence-Karte, `source: observation` | alle Reports von d01–d08 | nur mit expliziter authored Faktizitätslizenz |
| REPORTED CLAIM | Freigegebene NPC-Aussage (affirms/denies/uncertain) oder Testimony | q01–q20 | **nein**; kein REPORTED_BY_NPC-Root in diesem Profil |
| AUTHORED PROOF PREMISE | OBSERVED-Root (Report + Lizenz) oder PUBLIC_RULE-Instanz (nach Gate) | observed:hof-contact/max/nora/oskar; public-rule:max/nora/oskar/remaining | ja |
| OBJECTIVE CANONICAL ANSWER | CaseSolution.requiredConclusions | F/T/F/F | nur Konsistenzprüfung und Verdict, nie Proof-Füllung |

Es gilt nie „NPC sagt P ⇒ P wahr“. Gegenbeispiel im Fall: Oskar bejaht Max@Galerie 18:04 (q12), Max verneint dasselbe (q02), p02 ist false. Beide Berichte koexistieren, keiner wird Fakt.

### 8.2 Jede Prämisse auf eine konkrete freigegebene Beobachtung

| Prämisse | Freigegebene Beobachtung | Lizenz (publicRule) | Literal | Gate |
|---|---|---|---|---|
| observed:hof-contact | d03 Report eventHasParticipant(e05, Nora) affirms | rule:certified-sources | p18 = true | tatsächliche d03-Freigabe; kein Pflichtziel |
| observed:max | d04 Report personAt(Max, Innenhof, 240) affirms | rule:certified-sources | p03 = true | tatsächliche d04-Freigabe |
| observed:nora | d04 Report personAt(Nora, Innenhof, 240) affirms | rule:certified-sources | p04 = true | tatsächliche d04-Freigabe |
| observed:oskar | d05 Report personAt(Oskar, Archiv, 240) affirms | rule:certified-sources | p05 = true | tatsächliche d05-Freigabe |
| public-rule:max | – | rule:manual-presence | ⇒ actor-max = false | nach observed:max |
| public-rule:nora | – | rule:manual-presence | ⇒ actor-nora = false | nach observed:nora |
| public-rule:oskar | – | rule:manual-presence | ⇒ actor-oskar = false | nach observed:oskar |
| public-rule:remaining | – | rule:closed-roster | 3 Ausschlüsse ⇒ actor-lina = true | nach observed:max, :nora, :oskar |

Die drei generischen Regeltexte sind ab S0 symmetrisch sichtbar. Instanz-Receipts und der Graph bleiben INTERNAL/QA. Die positive remaining:lina-Kante darf nie als Menü, JSON oder Regelblatt sichtbar werden.

## 9. Challenge

Normativ: `DIE-LEERE-VITRINE-FINAL-CHALLENGE.json`.

- AnswerScope: vier `personRoleForEvent(X, e04, direct_actor)` für X ∈ {Max, Lina, Nora, Oskar}. Endlich, öffentlich, antwortunabhängig aus dem öffentlichen Roster und der öffentlich festgelegten Rolle.
- Fragetyp `required_literals` (Closure P10). Scope gleich Required-Keys ist zulässig, weil die Dimensionen vor der Antwortwahl öffentlich feststehen (P09). Es gibt keine geheime Required-only-Whitelist: drei der vier Scope-Claims sind kanonisch false.
- Exactness: solved ⇔ MYST-0002-Core solved ∧ jedes Literal im Scope ∧ Status === eingereichte Polarität. Undetermined erfüllt nie; in diesem Fall sind alle vier bestimmt.
- UI-Konvention: Auswahl einer Person → vier Literale, die gewählte true, die anderen false. Kein Evidence-, Citation- oder Proof-Feld. Kein Evidence-possession-Gate (D8).
- Ergebnis: 1 von 16 vollständigen Vektoren und 1 von 4 One-hot-Auswahlen ist solved. Die konkrete Lösung steht nur in CaseSolution.
- Konsequenz D8: Raten ist möglich (höchstens 4 Versuche). Das ist für den Einführungsfall akzeptiert und kein Anti-Bruteforce-Claim.

## 10. Solvability

Bezugsmodell: veröffentlichte Fallregeln, vier direct_actor-Dimensionen, `must_disambiguate`.

### Route A — Primärer Witness (Hof zuerst; gebunden als witnessStepIds)

| # | Aktion | Neu freigegeben | Prämissen aktiv | Offene Vektoren |
|---|---|---|---|---|
| 1 | Innenhof durchsuchen | d03 (e05, Nora) | observed:hof-contact | 16 |
| 2 | Nora q08 | Kamera (Reveal) | – | 16 |
| 3 | Kamera auslesen | d04 | observed:max, observed:nora ⇒ actor-max=false, actor-nora=false | 4 |
| 4 | Oskar q14 | e06, Terminal (Reveal) | – | 4 |
| 5 | Terminal auslesen | d05 | observed:oskar ⇒ actor-oskar=false; remaining ⇒ actor-lina=true | 1 |

Antwortableitung: R1 (manual-presence) mit d04/d05 schließt Max, Nora, Oskar als direkte Entnehmer aus; R2 (closed-roster) lässt Lina. Benötigte freigegebene Beobachtungen: d04 (zwei Reports) und d05; d03 als Zugriffsbrücke. Aus S0 erreichbar: ja (alle fünf Aktionen ab S0 bzw. nach Vorgängerschritt).

### Route B — Alternative Reihenfolge (Terminal zuerst; Certification §16)

q14 → Terminal (d05) → [optional Galerie, q12] → Innenhof (d03) → q08 → Kamera (d04). Dieselben Prämissen, dieselbe Ableitung. Das ist eine gültige alternative **Reihenfolge** (10 zulässige Interleavings der zwei Pflichtketten), **keine zweite unabhängige Beweisroute**.

### Keine zweite Evidence-Route

Im bestehenden Fall existiert genau ein minimaler Beweis: {d04, d05}. NPC-Aussagen (q03, q06, q07, q13) sind wahr, aber nur Berichte und ersetzen keine Bildnachweise. Es wird keine Route erfunden. Ein im Closure-Lab getesteter alternativer Proofgraph war synthetisch (LAB ONLY) und ändert nichts am Fall.

| Informationslage | Mögliche Einzeltäter | Offene Boolean-Vektoren | Proof |
|---|---|---|---|
| keine Alibis | 4 | 16 | fail |
| nur d04 | Lina / Oskar | 4 | fail |
| nur d05 | Max / Lina / Nora | 8 | fail |
| d04 + d05 | Lina | 1 | pass |

Single points of failure: d03→q08→Kamera und q14→Terminal. Beide sind wiederholbar, kosten nichts und bleiben aus jedem Zustand erreichbar (192 Fortschrittszustände, unabhängig im Authoring-Check reproduziert).

D8-Klarstellung: Diese Routen sind Autoren- und Zertifizierungsnachweis. Die Runtime verlangt sie nicht. Eine richtige Antwort ohne Beweis ist solved; ihr Spielerjournal besteht dann keine Proof-Prüfung, was keine Runtime-Wirkung hat.

## 11. InfoFlow Repair — zwei Vitrine-Scratch-Leaks

Beide Befunde stammen aus dem archivierten **Scratch-Host** `simulate.py` des Case Packs, nicht aus `main` und nicht aus Produktionscode. Sie werden nicht als Produktionsbug umetikettiert.

| | F01 Hidden person/location im Startbriefing | F02 Kanonische Kartenreihenfolge |
|---|---|---|
| Ursprünglicher Leak | `public_initial()` iteriert Truth-Personen/-Orte vollständig; eine versteckte zusätzliche Person/Ort außerhalb initialKnown/publicRoster erscheint mit Name/Ref, Anzahl und Reihenfolge ändern sich. HIGH, IMPLEMENTATION BUG im archivierten Scratch-Host. | `simulate.py:57–59` sortiert gleichzeitig freigegebene Karten nach Canonical EvidenceId; zwei interne Umbenennungen bei gleichem Text drehen die Reihenfolge. LOW, IMPLEMENTATION BUG im archivierten Scratch-Host. |
| Finale owning layer | Session A §2 PublicContent + InitialSetup (Master B.5, Binding R03, Closure P02–P04). | Session B `investigate`/PlayerKnowledge (Übersetzung vor öffentlicher Sortierung) + MYST-0004 (Mentions/Reports nach PlayerRef sortiert). |
| Finaler Repair | Spielerausgabe nur aus PublicContent ∩ prefix-Known. Labels unbekannter Entities werden nie ausgegeben. Kein Roster/Brief aus Truth. publicContentHash geht in releaseContextHash. | Mehrere Karten derselben Aktion nach öffentlicher PlayerRef sortieren (SB §3), nie nach Canonical-ID. |
| Public/Private-Konsequenz | Original-Vitrine hat keine versteckten Personen/Orte; der Leak war im Originalinhalt nicht ausgelöst. Der Repair macht das strukturell unmöglich. Abnahme: CERT-7 (hidden-person/location-Twin). | Betrifft nur die gemeinsame Galerie-Suche (d01+d02). Öffentliche Reihenfolge hängt danach nur vom paketgebundenen Salt ab; eine Saltänderung ist ein erlaubter Namespace-/Paketwechsel. Abnahme: CERT-7 (Rename-Twin). |

## 12. Package Manifest

Normativ: `DIE-LEERE-VITRINE-PACKAGE-MANIFEST.json`. Unveränderte Originale werden per Commit/Pfad/SHA-256 referenziert, migrierte Komponenten liegen in diesem Paket. Real berechnet sind nur truthHash `77b2ec91…` und solutionHash `52b7912e…` (in diesem Auftrag mit unveränderten `main`-Identitätsfunktionen neu berechnet). Alle übrigen Hashes, die PlayerRefs, `refSalt`, releaseContextHash, releaseHash, proofHash und packageHash sind `TO_BE_COMPUTED_FROM_FINAL_ARTIFACT`. Verbotene Legacy-Inputs sind dort gelistet (Scratch-Host, Scratch-Refs, alter Package-/Releasehash, Projektionen).

## 13. Abgelöste Legacy-Abschnitte des Original-Case-Spec

Gemäß Closure P14–P20 und D8 sind im Original-Case-Spec ersetzt: §3 Spielerfrage (P16), §14 Evidence Receipt (P17 → D8-Siegbedingung, §9 hier), §15 Command-Protokoll (P18 → Session-B-Events `investigate`/`interrogate`/`accuse{literals}`; Abbildung search→investigate/search_location, read_record→investigate/examine_item, ask→interrogate), §17 Save (P19 → Session C), AC34 (P20) und AC36 (P14 → richtige vollständige Antwort ohne Citation-Proof ist solved). Die Originale bleiben archiviert und unverändert.

## 14. Abgleich mit „Final Mystery Contract Integration“

Das Integrationsergebnis (7 v2-Kandidaten: M2, M4, M5B, CHALLENGE, SESSION A/B/C; unverändert: M1, M3, M5A, SOLVABILITY) wurde gegen dieses Paket abgeglichen:

| # | Stelle | Integrationsstand | Dieses Paket | Ergebnis |
|---|---|---|---|---|
| 1 | PublicContent-Shape, Limits, Regel-ID-Pattern | Session A v2 | §4, PUBLIC-CONTENT.json, Check P05–P10 | konsistent |
| 2 | InitialSetup `{schemaVersion:1, known}` | Session A v2 | §5, PLAYER-SETUP.json | konsistent |
| 3 | certificateData (steps, OBSERVED-Alternativen mit `licenseRuleId`, PUBLIC_RULE) | Session A v2 Adapter `forge-release-proof-v1` | §8, PROOF-PROFILE.json | konsistent |
| 4 | SessionEvent `investigate`/`interrogate`/`accuse{literals}` | Session B v2, M5B v2 | §6, §7, §13 | konsistent |
| 5 | P09/P10 (Scope = Required-Keys bei öffentlicher Frage) | M2 v2, CHALLENGE v2 | §9, CHALLENGE.json | konsistent |
| 6 | Fall-Deltas P11–P20 | `caseDeltasNotApplied`, für dieses Paket reserviert (DV-02 questionTexts = Profilregel-Paare, DV-03 P11–P13 Brief) | §4, §13, Brief | hier angewendet |
| 7 | Contract-Pins/Hashes (CERT-1) | Kandidaten-Hashes vorhanden, `acceptedCommit: null` | Manifest-Pins `TO_BE_COMPUTED_FROM_FINAL_ARTIFACT` | **bleibt offen** bis Akzeptanz und Registrierung |

Keine Abweichung gefunden, die Fall, Lösung oder Hinweise ändert. Ändern sich die Kandidaten vor Akzeptanz, gilt die akzeptierte Fassung; dieses Paket ist dann ohne Änderung von Fall, Lösung oder Hinweisen nachzuziehen.

## 15. Offene Punkte

- Runtime Witness (CERT-4…CERT-9) braucht implementierte Domain-Komponenten; Scratch-Reducer zählen nicht.
- PlayerRefs und `refSalt` existieren erst beim Package-Build.
- Menschliche Lösbarkeit, Verständlichkeit und Spielspaß: **UNKNOWN** bis zum Blindtest.
- R5 (Ortsprosa vs. konkreter Fototermin) bleibt bedingt auf Blindtest-Befund.
