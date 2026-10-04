# MYSTERY FINAL RECONCILIATION & SPEC FREEZE

Stand: 2026-10-04, ca. 08:00Z. Strikt read-only: keine Änderung an Repository, Branches, PRs, Reviews oder Einstellungen; keine bestehende Projektdatei verändert.
Repository `Forge-Dice/Forge`, `origin/main` = `3d7545d843883418348004e68717399a64da7a7d` (heute per `git fetch` geprüft; 6 Remote-Branches, unverändert).
Vorgänger: `MYSTERY-CONTRACT-CONSOLIDATION-PLAN.md` (07:30Z). Wo dieses Dokument abweicht, gilt dieses Dokument.

**Kernaussage vorab.** Von den angeforderten Quellen liegen nur die sechs Contract-Drafts MYST-0001…0005B und der Forge-Bootstrap-Plan vor. **Challenge, Solvability, Session A/B/C, VS-5-Preflight, alle fünf Vitrine-Artefakte und alle vier Reports (Cross-Contract, Information-Flow, Scale, Authoring-Stress) sind NOT AVAILABLE**: weder in `/mnt/project-files/` (einschließlich `uploads/`) noch im Repository. Sie wurden nicht rekonstruiert. Alles, was nur aus ihnen entscheidbar ist, ist unten als `BLOCKED_BY_MISSING_ARTIFACT` markiert. Alles, was sich aus den vorhandenen Contracts, dem Code auf `main` und dem Bootstrap-Plan entscheiden lässt, ist entschieden.

---

## 1. Source Inventory

| Quelle | Verfügbar | Ort / Identität |
|---|---|---|
| Remote `main` | ja | `3d7545d`, 1087 Tests (Stand Bootstrap-Plan) |
| MYST-0001 PlayerRef | ja | `MYST-0001-PLAYERREF-V1.contract.DRAFT.md`, F2, contentHash (v2-Präfix) `f4d31858…` |
| MYST-0002 FINAL Candidate | ja | `MYST-0002.contract.FINAL-CANDIDATE.md`, F1, `e1eba9e1…` (+ Repair-Report) |
| MYST-0003 Evidence Access | ja | `MYST-0003-EVIDENCE-ACCESS-V1.contract.DRAFT.md`, F1, `8574f1e2…` |
| MYST-0004 Evidence Presentation | ja | `MYST-0004-EVIDENCE-PRESENTATION-V1.contract.DRAFT.md`, F1, `b3848250…` |
| MYST-0005A Interrogation Authoring | ja | `MYST-0005A-INTERROGATION-AUTHORING-V1.contract.DRAFT.md`, F1, `dc7c48f5…` |
| MYST-0005B Interrogation Runtime/Release | ja | `MYST-0005B-INTERROGATION-RELEASE-V1.contract.DRAFT.md`, F1, `621d9416…` |
| Forge Bootstrap Contract Plan | ja | `FORGE-V0.1-BOOTSTRAP-CONTRACT-PLAN.md` (07:09Z) |
| MYST-CHALLENGE-0001 | **NOT AVAILABLE** | – |
| MYST-SOLVABILITY-0001 | **NOT AVAILABLE** | (nur ältere `MYSTERY-SOLVABILITY-V1-RESEARCH.md`, nicht der Contract) |
| Session Package A / B / C | **NOT AVAILABLE** | – |
| VS-5 Preflight | **NOT AVAILABLE** | – |
| Vitrine: Case Spec, Player Brief, Case Pack, Certification, Proof Profile | **NOT AVAILABLE** | – |
| Cross-Contract Consistency Report | **NOT AVAILABLE** | – |
| Information-Flow / Noninterference Report | **NOT AVAILABLE** | – |
| Scale / Complexity Report | **NOT AVAILABLE** | – |
| Case Authoring Stress Report | **NOT AVAILABLE** | – |

Alle sechs Draft-Hashes wurden heute neu berechnet und sind unverändert seit ihrer Erstellung.

## 2. Experimental Evidence Map

Die Zahlen stammen aus Sebs Auftrag. Die zugehörigen Berichte und Skripte liegen hier nicht vor; sie sind **vom Owner berichtete Scratch-Evidenz**, nicht nachgeprüft und kein Produktionsnachweis.

| Experiment | Berichtete Zahlen | Stützt | Hier prüfbar? |
|---|---|---|---|
| Challenge Exactness | 60 Solution-Konfig., 25 680 Versuche, keine False Accepts/Rejects | §4: Core + Scope + determined/matching | nein (Lab fehlt); konsistent mit MYST-0002 §15 und Repair-Report (4 247 Versuche, Challenge ⇒ Core) |
| Solvability Repair | 36 Fälle, 768 Proof-Konfig., 6 144 Properties, 1 106 Accusations; neutral 509 unbelegte akzeptiert, Exactness 0 davon und 63/63 gültige | §4, §9 | nein |
| Vitrine | 192 Progress States, 1 200 Sequenzen, 12 Mutationen, 531 441 Accusations; keine Softlocks / False Accepts / Rejects | §22 (Fallmodell) | nein |
| Information Flow | 1 024 Twin-Paare, 21 504 Vergleiche; zwei Vitrine-Scratch-Leakklassen | §10, §15 | nein; Leakklassen nicht lesbar |
| Scale | 581 Gruppen, 99 353 Assertions; Grenzen: Findings, History-Kopien, Replay-Hashing | §11 | nein |
| Session | 124 Checks, 640 Histories, 16 900 Aktionen, keine Replay-Abweichung | §12 | nein |

## 3. Final ID Policy

Ersetzt §2.3/§2.4 des Consolidation-Plans (Owner-Richtung: spezialisierte IDs bleiben).

- **P-1** `TASK-NNNN` ist geschlossen. **TASK-0006…TASK-0010 werden nie vergeben** (TASK-0006 hat vier dokumentierte Bedeutungen, u. a. als synthetische ID in `tests/forge-red-team/differential.test.ts:33-34` auf `main`).
- **P-2** Kern-Domain-Contracts: `MYST-NNNN`, Splits mit Suffix `A`, `B`, … (MYST-0001…0005B bestehen).
- **P-3** Spezialisierte Familien behalten ihre Arbeitsnamen als echte `taskId`: `MYST-CHALLENGE-NNNN`, `MYST-SOLVABILITY-NNNN`. Für die Session-Pakete gilt: die ID, die das Artefakt bereits trägt, sofern sie zu `TaskIdSchema` (`/^[A-Z][A-Z0-9]*(-[A-Z0-9]+)+$/`) passt und frei ist; sonst `MYST-SESSION-0001A/B/C` (= A Package/PlayerKnowledge, B Reducer, C Save/Replay). Kein Alias, keine Umnummerierung.
- **P-4** **MYST-0006, MYST-0007, MYST-0008 werden nie vergeben.** Der OVERNIGHT-Plan (Session/Save-Replay/Solvability) und der Consolidation-Plan (Challenge/VS-5/Solvability) haben ihnen widersprüchliche Bedeutungen gegeben. Nächste freie Kernnummer: **MYST-0009**.
- **P-5** Eine einmal vergebene ID wechselt nie das Thema; verworfene IDs bleiben verbraucht.
- **P-6** Bestehende Dateien werden nie umbenannt oder umgeschrieben.
- **P-7** Fälle tragen keine Task-ID: Dateiname `CASE-<slug>`, Identität = `caseId` der CaseTruth.

## 4. MYST-0002 / Challenge Repair

**Befund am MYST-0002 FINAL Candidate (`e1eba9e1…`):** Er enthält **keinen** Required-only-Widerspruch. Er sagt bereits wörtlich:
- §15: „`allowedClaims` enthält Claims ohne Polarität, **nie eine Required-only-Whitelist** (sie würde die Lösung als Frage veröffentlichen). Jeder Pflicht-Claim muss in `allowedClaims` liegen.“
- §7 D1 und „Partial Responsibility“: `undetermined` ist neutral und wird nicht als `false` behandelt.
- §15: „`undetermined` wird nicht umdefiniert; der Wrapper lehnt nur die Einreichung solcher Claims ab.“

Die Required-only-Formulierung, die das Cross-Contract-Audit gefunden hat, kann deshalb nur in MYST-CHALLENGE-0001 oder im überholten MYST-0002-Draft v1 (`3758b20c…`, SUPERSEDED) stehen. Beides ist hier nicht nachprüfbar (Challenge fehlt; v1 enthält das Wort nicht).

| Dokument | Reparatur |
|---|---|
| MYST-0002 FINAL Candidate | **KEEP AS IS.** Keine Änderung. |
| MYST-CHALLENGE-0001 | `BLOCKED_BY_MISSING_ARTIFACT` für den exakten OLD-Text. Der **NEW**-Text steht fest, weil er nur MYST-0002 §15 übernimmt: |

NEW (normativ für MYST-CHALLENGE-0001, wörtlich einzusetzen, wo der Contract die Annahmeregel definiert):

> Challenge solved ⇔ `evaluateAccusation(truth, solution, accusation).verdict === "solved"` ∧ für jedes eingereichte Literal `(c, v)`: (1) `claimKey(c)` ∈ `allowedClaims`, (2) `evaluateConclusionClaim(truth, solution, c).status ≠ "undetermined"`, (3) `v === status`. `allowedClaims` ist eine endliche, öffentliche, an `truthHash` gebundene Menge von Claims ohne Polarität, die alle Pflicht-Claims enthält und darüber hinaus nicht nur aus Pflicht-Claims besteht, sofern der Fall weitere öffentlich gefragte Claims hat. `undetermined` bleibt dreiwertig; nur die Einreichung eines undeterminierten Claims führt zu `not_solved`. Spielerseitig nur `solved | not_solved`.

Argumentreihenfolge: MYST-0002 legt `(truth, solution, accusation)` fest. Jedes Challenge-/Solvability-Artefakt mit `(acc, truth, solution)` (so in `MYSTERY-SOLVABILITY-V1-RESEARCH.md`) muss angepasst werden.

Offene Teilfrage aus MYST-0002 §15 („ob alle `allowedClaims` determiniert sein müssen“): **Entscheidung:** Authoring-Invariante, geprüft durch Solvability; kein Laufzeitverhalten. Begründung: ein undeterminierter erlaubter Claim ist eine Falle, die nur der Autor beheben kann.

## 5. Release → Proof Repair

**Vorhandene Typen reichen. Kein neuer Domain-Typ.**

| Kategorie | Vorhandener Typ | Fundstelle | Trägt Wahrheit? |
|---|---|---|---|
| OBSERVATION „Spieler hat Evidence E gesehen“ | `EvidenceObservation.evidence` | MYST-0004 §5.4, §8 | nein |
| REPORTED CLAIM aus Evidence | `PlayerReport {claim, stance: affirms\|denies, source: observation \| testimony(person)}` zusammen mit `observation.evidence` | MYST-0004 §3.2, §5.4, §8 („nie eine Wahrheitsaussage“) | nein |
| REPORTED CLAIM aus Befragung | `InterrogationObservation {npc, questionId, act, stance, statement}` | MYST-0005B §5.1 | nein (knowledge und belief werden gleich abgebildet, §5.2) |
| AUTHORED PROOF PREMISE | Proof Profile | **NOT AVAILABLE** | – |

Die Lücke liegt also nicht in den Release-Typen, sondern in der Referenzierung durch das Proof Profile. Kleinste Reparatur: ein **Premise-Key-Mapping im Proof Profile** (Owner: MYST-SOLVABILITY-0001), autorenseitig in Domain-IDs, nie spielerseitig:

| Premise-Art | Key | Erzeugt durch | Bedeutung |
|---|---|---|---|
| `seen` | `{kind:"seen", evidenceId}` | MYST-0003 erreichbar + MYST-0004 Release | „E wurde gesehen“ |
| `reported` | `{kind:"reported", evidenceId, report}` mit `report` = der autorenseitige Report-Eintrag `{claim, stance, source}` aus der Presentation (kanonisches JSON nach `forge-evidence-presentation-c14n-v1`) | MYST-0004 | „E zeigt / Person X sagt: Claim bejaht/verneint“ |
| `answered` | `{kind:"answered", npcId, questionId, stance, claim}` | MYST-0005A Regel + **MYST-0005B `decideResponse`** auf dem Paket-Snapshot | „NPC antwortet mit Stance S zu Claim C“ |

Regeln:
- **PR-1** Eine Premise ist nur gültig, wenn sie aus dem Paket mechanisch erzeugbar ist: `reported` muss byte-gleich als Report in der Presentation stehen; bei `answered` muss `decideResponse` auf dem Paket-Snapshot genau diese Stance liefern. Der Autor kann keine Stance behaupten, die der Runtime-Code nicht liefert.
- **PR-2** Ein Proof-Schritt ist `premises[] ⟹ (claim, value)`. Die Folgerung ist **Autorenbehauptung (Warrant)** und wird nicht aus den Premises abgeleitet. Geprüft wird nur: (a) Premises erzeugbar und erreichbar, (b) `evaluateConclusionClaim(truth, solution, claim).status === value` (MYST-0002), (c) `claimKey(claim)` ∈ `allowedClaims` (Challenge).
- **PR-3** Es gibt **keine** Regel „`reported`/`answered` ⇒ Claim wahr“. „NPC Anna asserts P“ ist eine Premise; dass P stimmt, ergibt sich allein aus der kanonischen Prüfung in PR-2(b). Gleiches gilt für „Evidence supports P“.
- **PR-4** Die Premise-Keys sind Autorendaten und erscheinen nie im PlayerKnowledge oder in Saves.

Version impact: keine Änderung an MYST-0004/0005A/0005B. Die Reparatur liegt vollständig im (fehlenden) Solvability-Contract und Proof Profile.

## 6. Final PlayerKnowledge

Abgeleitet aus MYST-0004 §8, MYST-0005B §6, MYST-0003 §5, MYST-0001 D5/D6. Session A ist nicht verfügbar; der Abgleich mit Session A ist `BLOCKED_BY_MISSING_ARTIFACT`. Dies ist die Sollform, gegen die Session A geprüft wird.

```
PlayerKnowledge V1 (abgeleiteter Zustand, nie persistiert)
  knownEntities        : Set<{kind ∈ person|location|item|event, ref: PlayerRef}>
                         = initialAwareness ∪ ⋃ evidenceObservation.mentions ∪ ⋃ interrogationObservation.mentions
  evidence             : Map<PlayerRef(evidence), EvidenceObservation>   // discovered = released; MYST-0003 findet, MYST-0004 gibt sofort frei
  interrogations       : Map<(npc PlayerRef, questionId), InterrogationObservation>
  reportedStatements   : abgeleitete Sicht, keine eigene Quelle:
                         { provenance: {evidence: ref} , report: PlayerReport }
                       ∪ { provenance: {npc: ref, questionId}, stance, statement }
```

| Gefragtes Feld | Entscheidung |
|---|---|
| knownEntities | ja, wie oben; einzige Eingabe für MYST-0003 `known` und MYST-0005B Askability (nach Rückübersetzung über `resolvePlayerRef` im Host) |
| discoveredEvidence | = Schlüssel von `evidence`; kein separates Feld (sonst doppelte Autorität) |
| evidence observations | ja (`EvidenceObservation`, inkl. `text` nur als Anzeige; `text` ist nie Regeleingabe, MYST-0004 §8) |
| NPC observations | ja (`InterrogationObservation`, inkl. `decline` und `does_not_know`) |
| reported statements | nur abgeleitete Sicht |
| provenance | implizit über den Schlüssel (Evidence-Ref bzw. NPC-Ref + questionId) |
| submitted accusations | **nein**, nicht Teil von PlayerKnowledge. Sie sind Aktionen im Session-Log (Session B/C). Ein Verdict wird nie gespeichert, sondern beim Replay neu berechnet |

Verboten im PlayerKnowledge: Wahrheitswerte, kanonische IDs, `VisibleRef`, `CaseSolution`, Premise-Keys, Verdicts, NPC-Projektionskontexte, Bridge/Translator-Objekte (MYST-0005B §5.5 „Trusted-only“).

## 7. Package Binding Closure

Grundsatz: Jedes Komponenten-Dokument bindet sich selbst an `caseId` + `truthHash`. Das Paket verifiziert beim Laden einmal, dass alle Bindungen übereinstimmen, und hasht danach nicht mehr (§11 C).

| Komponente | Hash/Profil vorhanden? | In `CasePackageIdentity`? | Begründung |
|---|---|---|---|
| CaseTruth | `hashCaseTruth`, `forge-case-c14n-v1` (main) | **ja** (Wurzel) | |
| CaseSolution | `hashCaseSolution`, `forge-solution-c14n-v1` (main) | **ja** | Solution bindet `truthHash`, ist aber selbst nicht in der Truth enthalten |
| PlayerRef-Konfiguration | Profil `forge-mystery-playerref-v1` + `refSalt` | **ja**: `refSalt` im Paketdokument | Saves speichern PlayerRefs; anderer Salt ⇒ andere Refs. `PlayerRefIndex` selbst trägt den Salt nicht und ist abgeleitet, nicht gehasht |
| Evidence Access | `forge-evidence-access-c14n-v1` | **ja** | |
| Evidence Presentation | `forge-evidence-presentation-c14n-v1` (enthält `text`) | **ja** in der Inhaltsidentität; für Saves gilt §8 | |
| NPC Snapshots | **kein Hash auf `main`** (TASK-0004 exportiert keinen) | **ja**, je NPC | Lücke: Profil fehlt. Owner: Session A (definiert `forge-npc-snapshot-c14n-v1` nach dem Muster von `forge-case-c14n-v1`, ohne TASK-0004 zu ändern) |
| Question Catalogue | `forge-interrogation-catalogue-c14n-v1` | **ja** | Session liest den Katalog direkt (Askability über `mentions`) |
| Interrogation Profiles | `forge-interrogation-profile-c14n-v1` | **ja**, je NPC | Profile binden `catalogueHash`; der Katalog-Eintrag oben ist trotzdem nötig, weil er direkt benutzt wird |
| Challenge | Profil NOT AVAILABLE | **ja** | Laufzeit braucht `allowedClaims` |
| Player Setup / Initial Awareness | Profil NOT AVAILABLE | **ja** | Laufzeiteingabe (Startmenge `knownEntities`) |
| Proof Profile | NOT AVAILABLE | **nein** | Nicht zur Laufzeit benutzt. Das **Zertifikat** bindet `packageIdentity` + `proofProfileHash`. Richtung Zertifikat → Paket, nie umgekehrt (kein Zyklus) |
| Replay Ruleset | – | **nein** | Gehört zur Engine, nicht zum Inhalt. Der **Save-Header** bindet `{packageIdentity, rulesetId}` mit `rulesetId` = versionierte Konstante von Session B/C |

Hash-Graph (azyklisch): `truth ← {solution, access, presentation, snapshots, catalogue, challenge, playerSetup}`, `catalogue ← profiles`, `{alle} ← packageIdentity`, `packageIdentity ← {certificate, save}`, `proofProfile ← certificate`.

## 8. Presentation/Localization Decision

Entscheidung V1 (minimal, ohne Localization-Architektur):
- **L-1** MYST-0004 bleibt unverändert: `presentationHash` umfasst `text`, weil das Dokument als Autorenartefakt exakt identifiziert sein muss.
- **L-2** Saves speichern nur Aktionen (MYST-0005B §6: `{type:"ask", npc, questionId}`; Investigation-/Accusation-Aktionen analog), nie Observations oder Text. Replay erzeugt die Observations neu.
- **L-3** Da `text` laut MYST-0004 §8 nie Regeleingabe ist, ist ein Replay mit geändertem Text semantisch identisch. Der Save bindet deshalb nicht `presentationHash`, sondern einen **semantischen Presentation-Fingerprint**: Hash über `{caseId, truthHash, entries[{evidenceId, mentions, reports}]}` (ohne `text`) im Profil `forge-evidence-presentation-semantic-v1`. Owner: Session A (rechnet ihn aus dem geparsten Dokument; keine Änderung an MYST-0004).
- **L-4** Folge: Tippfehler-Korrektur ⇒ alte Saves laden weiter und zeigen beim Replay den neuen Text. Jede Änderung an `mentions` oder `reports` ⇒ Save wird abgelehnt (semantisch nötig).
- **L-5** `CasePackageIdentity` (Inhalt, für Zertifikat) behält `presentationHash` mit Text. Ein Zertifikat gilt also nach einer Textkorrektur nicht mehr automatisch; Neuzertifizierung ist dann nur die Text-Spoiler-Prüfung (Autorenverantwortung, MYST-0004 §6).

## 9. Evidence Requirement Decision

**Entscheidung: E = C + D, saubere Trennung. Nicht A, nicht B in V1.**

| Layer | Besitzt | Nicht |
|---|---|---|
| MYST-0002 Core | kanonische Konsistenz + Pflichtabdeckung | kein Wissen, keine Belege (§7a) |
| MYST-CHALLENGE-0001 | Exactness im öffentlichen Scope | kein PlayerKnowledge-Gating |
| MYST-SOLVABILITY-0001 / Zertifikat (C) | **Belegpflicht als Authoring-Anforderung:** jede akzeptierte Antwort ist über mindestens eine Proof-Route aus erreichbaren Premises begründbar; keine Route ohne Premises ab Start | keine Laufzeitprüfung |
| Blindtest / Gameplay (D) | ob Spieler tatsächlich über Belege lösen | keine Garantie |

Begründung: Ein Runtime-Gate (A/B) bräuchte einen Proof-Checker über PlayerKnowledge zum Zeitpunkt der Anklage. Das ist neue Architektur. Die Belegpflicht in der Vitrine-Spec wird deshalb als Zertifizierungsanforderung gelesen.

| Fall | Ergebnis Runtime | Ergebnis Zertifizierung |
|---|---|---|
| Spieler kennt Lösung am Start | Challenge solved | **Zertifikat schlägt fehl** (CERT-6), wenn eine Route ohne Premises existiert; das ist ein Fallfehler |
| Spieler rät richtig | solved (gewollt; Raten ist nicht verhinderbar ohne Gate) | unberührt |
| nur Teil der Evidence | solved, falls korrekt | unberührt; Zertifikat verlangt nur, dass eine vollständige Route erreichbar ist |
| alle Evidence, keine NPC-Aussage | solved, falls korrekt | Zertifikat dokumentiert, ob eine Route ohne `answered`-Premises existiert |
| alternative gültige Route | solved | zulässig; Zertifikat listet mindestens eine Route, mehrere erlaubt |

## 10. Vitrine Leak Repairs

`BLOCKED_BY_MISSING_ARTIFACT`. Die zwei Leakklassen stehen im Information-Flow-Report bzw. Vitrine-Scratch, beide nicht verfügbar. Sie werden nicht geraten.

Klassifikationsregel für den Nachtrag (keine neue Architektur):

| Wenn die Leakklasse … | Klasse |
|---|---|
| nur im Scratch-Mock auftritt und der Contract-Code das Verhalten ausschließt (z. B. Mock nutzt kanonische IDs statt `refFor`) | NON-ISSUE (Mock-Fehler) |
| aus Autorentext/Mentions/Reports der Vitrine stammt (MYST-0004 §6 „Restverantwortung des Autors“) | CASE DATA FIX |
| eine Contract-Regel verletzt, die der Draft nicht mechanisch erzwingt | CONTRACT FIX (am besitzenden Contract, neue Revision falls registriert) |
| aus Session-Reihenfolge/Fehlerabbildung entsteht | RUNTIME FIX (Session A/B, siehe §15) |
| bewusst freigegeben ist (z. B. Art einer Mention, MYST-0004 §6) | ACCEPTED LEAK |

## 11. Scale Repairs

Der Scale-Report fehlt; die drei Grenzen werden nach Owner zugeordnet, ohne seine Messwerte.

**A. Massenhafte Findings** (kein globales Limit):

| Layer | Regel |
|---|---|
| Autoren-Parser (MYST-0003/0004/0005A, TASK-0001 Schema) | Begrenzung über **Eingabegrößen** (wie `PRESENTATION_LIMITS` in MYST-0004); die Issue-Zahl ist dann durch die Eingabe beschränkt. Parser ohne Größenlimit: Befund für deren Review (in den vorliegenden Drafts nur MYST-0004 mit expliziten Limits gesehen; Prüfung der anderen gehört ins Review) |
| Semantic Validator (TASK-0002, legacy) | unverändert; Aufrufer (Solvability) kappt |
| Solvability | eigener Cap pro Finding-Art + Gesamtzahl + Zähler „weitere unterdrückt“ |
| Session Load | fail-fast: erster Fehler, ein Code (§15) |

**B. History Copies** (Session B): Der Reducer bekommt und liefert **keinen** History-Array. Regel: `reduce(state, action) → state'`, wobei `state` nur abgeleiteten Zustand (PlayerKnowledge + Zähler) enthält. Die Aktionsliste gehört Session C (append-only; jedes Element beim Anhängen tief eingefroren; kein Kopieren des Arrays pro Event). Immutability gilt pro Element und pro `state`.

**C. Wiederholtes Hashing:** `resolvePackage(raw) → ResolvedPackage` (Session A) parst und verifiziert alle Komponenten-Hashes und Bindungen **genau einmal** und liefert ein gebrandetes, tief eingefrorenes Objekt. Reducer und Replay nehmen nur `ResolvedPackage` und rufen nie `hash*` auf. Testbar über Spy (`hash*`-Aufrufe = Komponentenzahl, unabhängig von der Aktionszahl).

Contract-Reparaturen: in Session A (C), Session B (B), Session C (B), Solvability (A). Exakter OLD-Text: `BLOCKED_BY_MISSING_ARTIFACT`.

## 12. Session A/B/C Repairs

`BLOCKED_BY_MISSING_ARTIFACT` für alle konkreten OLD→NEW. Prüfliste, die beim Eintreffen der drei Contracts mechanisch angewandt wird (abgeleitet aus den vorhandenen Contracts):

| # | Prüfung | Soll | Quelle |
|---|---|---|---|
| S-1 | Dependencies | A: MYST-0001, 0003, 0004, 0005A (+ Challenge für Paketinhalt); B: A, 0003, 0004, 0005B, 0002, Challenge; C: B. Keine Abhängigkeit von Solvability | §16 |
| S-2 | Fehlende Hashes | NPC-Snapshot-Profil, Challenge-Hash, Player-Setup-Hash, semantischer Presentation-Fingerprint | §7, §8 |
| S-3 | doppelte State Authority | `discoveredEvidence` nicht neben `evidence`; Verdict nicht im State | §6 |
| S-4 | PlayerRef Ownership | Refs nur aus `playerRefFor` (MYST-0001 D5); Ports aus genau einem `PlayerRefIndex` | §13 |
| S-5 | persisted VisibleRef | verboten (MYST-0005B §5.5) | |
| S-6 | persisted derived verdict | verboten; Replay rechnet neu | §6 |
| S-7 | persisted NPC runtime engine / Bridge | verboten (MYST-0005B §5.5) | |
| S-8 | Replay mit neuestem Paket | verboten; Save bindet `packageIdentity` (semantisch, §8) + `rulesetId`; Mismatch ⇒ Ladefehler | §7 |
| S-9 | Nichtdeterminismus | kein `Date`, `Math.random`, `localeCompare`, keine Map-Iteration über unsortierte Schlüssel in Ausgaben | Muster aller Drafts |
| S-10 | Reihenfolge Investigation | `resolvePlayerRef` → MYST-0003 (Autorisierung) → MYST-0004 Release; nie Release ohne vorherigen Fund | MYST-0004 §5.5 |

## 13. PlayerRef Reconciliation

MYST-0001 ist **vollständig verfügbar** (D1–D8, API). Abgleich gegen die Consumer (Session A fehlt):

| Prüfpunkt | MYST-0001 | MYST-0004 | MYST-0005B | Ergebnis |
|---|---|---|---|---|
| Syntax | `pr1_` + 16 Zeichen, `^pr1_[0-9a-hjkmnp-tv-z]{16}$` | identisch (§5.3) | identisch (§5.1) | **konsistent** (Alphabet `0-9 a-h j k m n p-t v-z` = D3.4) |
| Salt | 32 Hex, 128 Bit, Null-Salt verboten, keine Normalisierung | nicht berührt | nicht berührt | konsistent; Paket muss Salt tragen (§7) |
| Kürzung | 80 Bit (10 Bytes), 16×5 Bit | – | – | konsistent |
| Kind-Encoding | Art im Preimage, nicht im String | Mentions tragen `kind` sichtbar (bewusst, §6) | ebenso | konsistent |
| Arten | person, location, item, event, evidence | `RefKind` identisch | Port-Arten identisch | konsistent; MYST-0003 `KnownEntityRef` ebenfalls |
| Membership | `resolvePlayerRef` nur exakte Index-Einträge | prüft nur Format (Port vertrauenswürdig) | ebenso | akzeptiert; Membership prüft der Host bei Spielereingaben |
| Kollision | `REF_COLLISION` beim Indexaufbau, autorenseitig | – | – | konsistent; Session A muss `REF_COLLISION` auf Paketfehler abbilden (D6) |
| Paketbindung | Index trägt `caseId`, `truthHash`, nicht den Salt | Translator-Bindung `caseId`/`truthHash` | ebenso | **Lücke:** falscher Salt besteht die Bindung; wird erst beim Replay als `REF_UNRESOLVED` sichtbar. Reparatur in Session A: Salt ist Teil der Paketidentität (§7) |
| Auflösung ≠ Autorisierung | D6 ausdrücklich | keine Autorisierung (§5.5) | Askability über `known` | konsistent; Autorisierung: MYST-0003 bzw. 0005B-Askability |

Weitere Befunde:
- `PLAYER_REF_PATTERN` existiert dreimal (MYST-0001 `PlayerRefSchema`, MYST-0004, MYST-0005B), `PlayerRefTranslator` zweimal, `PlayerClaim` zweimal **mit verschiedenem Inhalt** (MYST-0004: 3 Varianten; MYST-0005B: 9 Varianten). Das ist gewollt (keine Compile-Abhängigkeit), aber Session A importiert beide. **Reparatur Session A:** Import mit Aliasnamen, ein Union-Typ für Spieler-Claims, plus ein Konsistenztest (Pattern-Quelltext gleich, beide Translator-Typen gegenseitig zuweisbar). MYST-0004/0005B bleiben unverändert.
- DESIGN-Pin: MYST-0004 und MYST-0005B zitieren „MYST-0001-Entwurf D3“ ohne Hash. **Reparatur:** Pin auf MYST-0001-contentHash (§17).

## 14. Hash Profile Registry

Format aller Profile: SHA-256-Hex über UTF-8 von `"<profile>\n" + <kanonisches JSON>`, außer PlayerRef (eigene Ableitung).

| Identität | Profilstring | Input | Arrays | Bindung | Output | Consumer | Status |
|---|---|---|---|---|---|---|---|
| CaseTruth | `forge-case-c14n-v1` | geparste Truth | jedes Array als Menge sortiert | – | `truthHash` | alle | main |
| CaseSolution | `forge-solution-c14n-v1` | geparste Solution | wie Truth | `truthHash` | `solutionHash` | MYST-0002 indirekt, Paket | main |
| PlayerRef | `forge-mystery-playerref-v1` | `profile\nsalt\ncaseId\ntruthHash\nkind\nid` | – | caseId, truthHash, salt | 80-Bit-Ref | 0004, 0005B, Session | Draft |
| Evidence Access | `forge-evidence-access-c14n-v1` | geparste AccessMap | Mengen | caseId, truthHash | `accessHash` | Paket | Draft |
| Evidence Presentation | `forge-evidence-presentation-c14n-v1` | geparste Presentation **inkl. text** | Mengen | caseId, truthHash | `presentationHash` | Paket, Zertifikat | Draft |
| Presentation semantisch | `forge-evidence-presentation-semantic-v1` | wie oben ohne `text` | Mengen | caseId, truthHash | Fingerprint | Save | **neu, Owner Session A (§8)** |
| NPC Snapshot | – | – | – | – | – | Paket | **fehlt** (Owner Session A) |
| Question Catalogue | `forge-interrogation-catalogue-c14n-v1` | geparster Katalog | Mengen | caseId, truthHash | `catalogueHash` | Profile, Paket | Draft |
| Interrogation Profile | `forge-interrogation-profile-c14n-v1` | geparstes Profil | Mengen | caseId, truthHash, catalogueHash | Profilhash | Paket | Draft |
| Challenge | ? | ? | ? | ? | ? | Paket | NOT AVAILABLE |
| Proof Profile | ? | ? | ? | ? | ? | Zertifikat | NOT AVAILABLE |
| Player Setup | ? | ? | ? | ? | ? | Paket | NOT AVAILABLE |
| CasePackage | ? | Komponenten-Hashes (§7) | – | – | `packageIdentity` | Zertifikat, Save | NOT AVAILABLE |
| Save Checksum | ? | – | – | – | – | Session C | NOT AVAILABLE |

Prüfungen auf den vorhandenen Profilen: keine zwei Profile mit gleicher Aufgabe; alle versioniert (`-v1`); Array-Semantik überall explizit „Menge“ und durch Duplikatregeln abgesichert; keine Hash-Zyklen; einzige Präsentations-Instabilität ist `text` in `presentationHash`, durch §8 entschärft. Namensabweichung `forge-mystery-playerref-v1` (kein `c14n`, weil Ableitung statt Kanonisierung) ist korrekt so.

## 15. Error Boundary Freeze

Regel: Interne Codes dürfen alles unterscheiden. Spielerseitig gibt es pro Operation höchstens die unten genannten Ergebnisse. Ein Spieler kann nie unterscheiden zwischen „Ref existiert nicht“, „Ref gehört zu anderem Fall“, „Ref existiert, ist aber nicht bekannt/erlaubt“.

| Operation | Interne Codes (vorhanden) | Spielerseitig erlaubt |
|---|---|---|
| Investigation | MYST-0001 `REF_UNRESOLVED`; MYST-0003 `INVALID_ACTION`, `INVALID_KNOWN_REFS`, `TARGET_NOT_KNOWN` | Erfolg mit neuen Observations (ggf. leer) **oder** genau ein Code `ACTION_NOT_AVAILABLE`. `INVALID_KNOWN_REFS` ist Host-Fehler ⇒ `INTERNAL_ERROR` |
| Evidence Release | MYST-0004 `BINDING_MISMATCH`, `UNKNOWN_EVIDENCE`, `REF_UNAVAILABLE` | nie direkt spielerausgelöst; jeder Fehler ⇒ `INTERNAL_ERROR`, Aktion wird nicht angewandt |
| Interrogation | MYST-0005B `BINDING_MISMATCH`, `QUESTION_NOT_AVAILABLE`, `REF_UNAVAILABLE`; NPC-Ref über `REF_UNRESOLVED` | Observation **oder** `QUESTION_NOT_AVAILABLE` (auch für unbekannten/fremden NPC-Ref); Binding/RefUnavailable ⇒ `INTERNAL_ERROR` |
| Accusation (Core) | MYST-0002 `ACCUSATION_BINDING_MISMATCH`, `SOLUTION_BINDING_MISMATCH`, `INVALID_CLAIM`, `UNKNOWN_REFERENCE` | Core-Verdict wird **nie** spielerseitig gezeigt (§7a) |
| Challenge | Gründe pro Literal nur intern/QA | `solved` \| `not_solved` **oder** `ACCUSATION_INVALID` (Form ungültig, Ref nicht auflösbar), ohne Detail |
| Session Load | Paket-/Bindungs-/Ruleset-/Prüfsummenfehler, `REF_COLLISION` | genau `SAVE_NOT_LOADABLE`; Details nur im Diagnosekanal |

`INTERNAL_ERROR` sagt dem Spieler nichts über Inhalte; er bedeutet nur „Spiel defekt“. Konkrete Codenamen gehören den Session-Contracts; die Regel oben ist normativ.

## 16. Final Dependency DAG

```
HARD IMPLEMENTATION (Import/Test-Fixture; einzige Kanten in `dependencies`)
  legacy TASK-0001/0003/0004 ─► MYST-0001, 0002, 0003, 0004, 0005A, 0005B   (über Base, F2: provenance legacy)
  MYST-0005A ───────────────► MYST-0005B
  MYST-0002 ────────────────► MYST-CHALLENGE-0001
  MYST-0001, 0003, 0004, 0005A, CHALLENGE ─► Session A (Package/PlayerKnowledge)
  Session A, MYST-0002, 0003, 0004, 0005B, CHALLENGE ─► Session B (Reducer)
  Session B ────────────────► Session C (Save/Replay)
  MYST-0002, CHALLENGE, 0003, 0004, 0005B (decideResponse, PR-1) ─► MYST-SOLVABILITY-0001

RUNTIME / PACKAGE (keine `dependencies`-Kante)
  MYST-0001 ─► Aufrufer von 0004/0005B (Translator)    alle Komponenten ─► CASE-leere-vitrine
  Solvability ─► Zertifikat der Vitrine                 Session C ─► Zertifikats-Replay (CERT-8)

DESIGN RELATION ONLY (Hash-Pin im Text)
  MYST-0001 ─ MYST-0003 (ResolvedEntity-Form), MYST-0004 (Pattern), MYST-0005B (Pattern)
  MYST-0004 ─ MYST-0005B (Port-Form)
```

Die Session- und Solvability-Kanten sind aus den vorhandenen Contracts abgeleitet (welche Funktionen sie aufrufen müssen) und gegen die fehlenden Artefakte zu prüfen. Bewusst **keine** Kante: Solvability ↛ Session (Solvability simuliert über die Domain-Funktionen; falls das fehlende Artefakt Session B importiert, ist das eine HARD-Kante und verschiebt Solvability hinter Session B). MYST-0003 ↛ MYST-0004 und umgekehrt. MYST-0002 ↛ TASK-0004.

## 17. Contract Repair Table

Format-Grundsatz (aus dem Bootstrap-Plan §4.1/§4.3, **neu gegenüber dem Consolidation-Plan**): Die Format-1-Menge ist fest `{FORGE-VERIFIER-0001, FORGE-CORE-0002}`. Ab `A_CORE2` wird jeder neue Contract in Format 2 registriert, und vor der Verifier-Aktivierung merged der Owner keine Mystery-PRs. Damit wird **kein** MYST-Contract je in Format 1 registriert; jeder F1-Draft wird vor der Registrierung transkodiert (mechanisch, Feldmapping Consolidation-Plan §7). Da keiner registriert ist, bleibt überall `contractVersion: 1`.

| Contract | Verdikt | Repair |
|---|---|---|
| MYST-0001 | KEEP AS IS | – (F2 bereits; registrierbar ab `A_CORE2`) |
| MYST-0002 | SMALL REPAIR (nur Format) | R-2 |
| MYST-0003 | SMALL REPAIR (nur Format) | R-3 |
| MYST-0004 | SMALL REPAIR | R-4a, R-4b |
| MYST-0005A | SMALL REPAIR | R-5A |
| MYST-0005B | WAIT FOR DEPENDENCY (+ Repair vorab) | R-5B |
| MYST-0002 Draft v1 | SUPERSEDED | – |
| MYST-CHALLENGE-0001, MYST-SOLVABILITY-0001, Session A/B/C | BLOCKED_BY_MISSING_ARTIFACT | Soll-Texte §4, §5, §7, §8, §11, §12 |

**R-2** Contract: MYST-0002. Location: Frontmatter + §0. OLD: `"forgeContractFormat": 1`, `"baseCommit": "3d7545d…"`, `"dependencies": []`, `"mutationSmoke": "required"`; Mutanten nur in §11c. NEW: F2-Frontmatter: `forgeContractFormat: 2`, `title`, `specifiedAgainst: <main bei Registrierung>`, `supersedes: null`, `dependencies: [{TASK-0001, acceptedCommit: 3d7545d…, provenance: "legacy"}, {TASK-0003, …}]`, `reads` (§3), `limits {maxProductionLines: 220, maxChangedFiles: 6}`, `mutants` (m1–m10 wörtlich aus §11c), End-Marker `<!-- END OF CONTRACT MYST-0002 v1 -->`; §0 Satz „Geschrieben im Format 1 …“ ersetzt durch „Format 2; transkodiert aus F1-Kandidat `e1eba9e1…`, Body unverändert“. Reason: Bootstrap-Plan §4.1. Evidence: §4.3 S-a/S-b. Version impact: keine (v1, nie registriert); neuer contentHash; Domain-Review bleibt gültig über Transcode-Nachweis.

**R-3** MYST-0003: wie R-2 (Legacy: TASK-0001; `limits.maxProductionLines: 260`; Mutanten M1–M9 aus §12). Version impact: keine.

**R-4a** Contract: MYST-0004. Location: §5.3. OLD: „`/^pr1_[0-9a-hjkmnp-tv-z]{16}$/` — wörtlich MYST-0001-Entwurf D3.“ NEW: „`/^pr1_[0-9a-hjkmnp-tv-z]{16}$/` — wörtlich MYST-0001 v1 D3 (`MYST-0001-PLAYERREF-V1.contract.DRAFT.md`, contentHash `f4d3185898015901…` bzw. der bei Registrierung von MYST-0001 gültige Hash).“ Reason: DESIGN-Pin. Evidence: §13. Version impact: keine.
**R-4b** MYST-0004: Format wie R-2 (Legacy TASK-0001; limits 290/7; m1–m9 aus §12); Absatz „Nummernhinweis“ ersetzen durch „IDs: siehe MYSTERY-FINAL-RECONCILIATION-SPEC-FREEZE §3.“ Version impact: keine.

**R-5A** Contract: MYST-0005A. Location: §9. OLD: Mutantentabelle in Prosa („A-M1 | R1 entfernt“ …). NEW: je Mutant `id`, `file`, `before` (= einer der vorhandenen §9-Anker, wörtlich), `after` (wörtlicher Ersatztext), `tests` (die bisherigen „Getötet durch“-Fälle). Beispiel A-M2 (`npcKey` aus `allowed` entfernt): `before: const allowed = new Set([...mentionKeys, npcKey, ...revealKeys]);` → `after: const allowed = new Set([...mentionKeys, ...revealKeys]);`, tests #23. Mutanten ohne passenden Anker (A-M5 Bindung, A-M6 Sortierung, A-M7 Existenz, A-M8 deepFreeze) bekommen zusätzlich einen Anker in §9; das ändert keine Semantik, nur die Prüfbarkeit. Plus Format wie R-2 (Legacy TASK-0001, 0003, 0004; limits 260/7). Reason: Format 2 verlangt wörtliche Mutanten; unabhängiger Verifier braucht sie. Evidence: Bootstrap §7.2 (Mutantenform). Version impact: keine.

**R-5B** MYST-0005B: Mutanten B-M1…B-M11 wie R-5A wörtlich machen; §5.1 Kommentar „wörtlich MYST-0001 D3“ wie R-4a pinnen; nach Akzeptanz von MYST-0005A: `dependencies: [{MYST-0005A, acceptedCommit: <A>, provenance: "forge"}]`, `specifiedAgainst` ⊇ A, §1.2-Fakten gegen gemergten Code abgleichen (Drift-Prozedur). Version impact: keine, solange vorher nicht registriert.

## 18. Registration Order

Randbedingungen aus dem Bootstrap-Plan: Format 2 erst ab `A_CORE2`; Mystery-PRs werden erst nach Verifier-Aktivierung gemergt. Architecture Reviews (Domain-Inhalt) können **sofort** laufen.

| Schritt | Wann | Was |
|---|---|---|
| 1 | jetzt | Architecture Reviews des Domain-Inhalts: MYST-0002, MYST-0003, MYST-0005A (nach R-5A), MYST-0004 (nach R-4a), MYST-0001. Review bindet F1- bzw. F2-Hash; nach Transkodierung nur Transcode-Nachweis |
| 2 | ab Verifier-Aktivierung | Welle-1-Registrierungen, parallel, je ein Contract-PR: MYST-0001, 0002, 0003, 0004, 0005A. Vor jedem PR: Drift-Prozedur gegen dann-aktuellen `main` (erwartet Klasse A: nur `src/forge/**` hat sich geändert, nicht in `reads`), Transkodierung, `specifiedAgainst` = dann-aktueller `main` |
| 3 | je nach Akzeptanz | MYST-0005B (nach 0005A), MYST-CHALLENGE-0001 (nach 0002) |
| 4 | nach Welle 2 | Session A, dann B, dann C; Solvability parallel zu B, sofern es Session nicht importiert |

Kein Contract wird mit `acceptedCommit: null` registriert. Kein Contract wird gegen einen `main` registriert, gegen den die Drift-Prüfung nicht gelaufen ist.

## 19. Freeze Rule

**Freeze-Punkt FZ-1:** Veröffentlichung dieses Dokuments für MYST-0001…0005B, nach Anwendung der Repairs R-2…R-5B. Für Challenge, Solvability und Session A/B/C gilt FZ-1 erst nach einem Nachtrag zu diesem Dokument, der ihre Texte gegen §4–§16 prüft.

- **FR-1** Nach FZ-1 ändert sich ein Contract nur durch: (A) Architecture-Review-Finding, (B) Implementation-Finding, (C) Cross-Contract-Integrationsfehler, (D) neue explizite Owner-Entscheidung. Jede Änderung nennt ihren Auslöser.
- **FR-2** Jede normative Änderung nach FZ-1 erhöht `contractVersion` und setzt `supersedes` (F2), auch vor Registrierung. Damit ersetzt FR-2 die Consolidation-Regel R-V-1 („Version zählt nur registrierte Revisionen“) für alles nach FZ-1.
- **FR-3** Keine stillen Draft-Edits: Jede Datei nach FZ-1 ist byte-eingefroren; Korrekturen erscheinen als neue Datei `<ID>.v<N>.contract.DRAFT.md`.
- **FR-4** Ausnahmen ohne Versionssprung: (a) Transkodierung F1→F2 mit Transcode-Nachweis, (b) Drift-Klasse A/B (nur `specifiedAgainst`, wenn vor Registrierung ohnehin neu geschrieben wird).
- **FR-5** Keine neuen Mystery-Architekturdrafts bis Welle 2 akzeptiert ist, außer für eine nachgewiesene Schnittstellenlücke (dann als Owner-Entscheidung).

## 20. OD-C1–OD-C11 Final Decisions

| ID | Original Question | Old Rec. | New Evidence | Final |
|---|---|---|---|---|
| OD-C1 | Einheitlicher Zähler MYST-0006/7/8 | ja | Owner-Richtung: spezialisierte IDs behalten | **RESOLVED (Owner-Richtung)**: §3 P-3/P-4 |
| OD-C2 | TASK-0006…0010 retired | ja | Owner: „niemals wiederverwenden“ | **RESOLVED (Owner)** |
| OD-C3 | TASK-0005 v2 SUPERSEDED durch MYST-0005A/B | ja | Bootstrap-Plan §4.4 plant noch „TASK-0005 v3 Format 2“ (aus FREEZE W-15); Konflikt | **OFFEN** (OD-1 unten) |
| OD-C4 | nur COMPILE/TEST in `dependencies` | ja | `start-gate.ts` prüft je Dependency `acceptedCommit` ⊑ `baseCommit`; DESIGN-Kanten haben keinen | **RESOLVED BY EVIDENCE** |
| OD-C5 | Drift A/B ohne Bump | ja | Run startet bei `contractCommit`, Base nur Vorfahr | **RESOLVED BY EVIDENCE** (für Registrierte; vor Registrierung FR-4b) |
| OD-C6 | Format-Migration | ja | Bootstrap §4.1: F1-Menge fest, alle MYST in F2 | **RESOLVED BY EVIDENCE**, aber anders als empfohlen: kein MYST bleibt F1 (§17) |
| OD-C7 | Freeze D0 + WIP 2 | ja | Owner verlangt Freeze-Regel in diesem Auftrag | **RESOLVED**: ersetzt durch §19 |
| OD-C8 | Small Repairs ohne Bump | ja | vor FZ-1, unregistriert | **RESOLVED**: R-2…R-5B ohne Bump; danach FR-2 |
| OD-C9 | Naming Convention | ja | kein Widerspruch gefunden | **RESOLVED** (Konvention gilt; Owner kann widersprechen) |
| OD-C10 | fehlende Artefakte ablegen | ja | weiterhin alle fehlend, jetzt blockierend | **OFFEN** (OD-2) |
| OD-C11 | Unowned U-1…U-5 → Session | ja | Session-Artefakte fehlen | **OFFEN, technisch vorentschieden** in §21; Bestätigung nach Nachtrag |

Offene Owner-Entscheidungen insgesamt (7):

| ID | Frage | Empfehlung |
|---|---|---|
| OD-1 | TASK-0005 v2: SUPERSEDED durch MYST-0005A/B (Bootstrap-Plan-Zeile „v3“ entfällt)? | ja |
| OD-2 | Fehlende Artefakte (Liste §25) in `forge-audits/` ablegen, damit der Nachtrag FZ-1 für Challenge/Solvability/Session erreicht? | ja, Voraussetzung für Gesamt-Freeze |
| OD-3 | Belegpflicht = Zertifizierung + Blindtest, kein Runtime-Gate in V1 (§9)? | ja |
| OD-4 | Saves binden semantischen Presentation-Fingerprint ohne Text (§8)? | ja |
| OD-5 | Spielerseitige Fehlerregel §15 (Kollaps auf `ACTION_NOT_AVAILABLE` / `QUESTION_NOT_AVAILABLE` / `ACCUSATION_INVALID` / `SAVE_NOT_LOADABLE`)? | ja |
| OD-6 | `allowedClaims` müssen alle determiniert sein (Authoring-Invariante, §4)? | ja |
| OD-7 | Spielerseitige Namen/Labels und Briefing außerhalb der semantischen Paketidentität (§21)? | ja |

Technisch entschieden, nicht zurückdelegiert: Release→Proof per Premise-Mapping (§5), Paketgrenzen (§7), Scale-Owner (§11), PlayerRef (§13).

## 21. Vitrine Ownership Map

Die konkreten Vitrine-Daten sind NOT AVAILABLE; die Zuordnung je Datenart ist endgültig, die Zuordnung je Datum folgt im Nachtrag. Kein Datum hat zwei Autoritäten.

| Datum | Einziger Owner | In semantischer Paketidentität? |
|---|---|---|
| Truth (Personen, Orte, Items, Events, Evidence, Propositionen, Secrets, Red Herrings) | TASK-0001/0002 | ja |
| Solution, Conclusions, Pflichtliterale | TASK-0003 | ja |
| NPC-Wissen | TASK-0004 (Hash: Session A) | ja |
| Evidence-Fundwege | MYST-0003 | ja |
| Evidence-Präsentation | MYST-0004 | `mentions`/`reports` ja; `text` nur Inhaltsidentität (§8) |
| Fragenkatalog | MYST-0005A | ja |
| NPC-Profil | MYST-0005A | ja |
| Challenge-Definition (`allowedClaims`) | MYST-CHALLENGE-0001 | ja |
| Proof Profile | MYST-SOLVABILITY-0001 | nein (nur Zertifikat) |
| Initial Player Awareness | Session A (Player Setup) | ja |
| Spielerseitige Personen-/Ortsnamen, Briefing | Session A (Player Setup, Darstellungsteil) | **nein**, bewusst außerhalb: reine Darstellung, wie `text` (OD-7) |
| Package Manifest | Session A | ist die Identität |
| Replay Ruleset | Session B/C (`rulesetId`) | nein (Save-Header) |
| Freischaltkanten (Mention/Reveal → known) | Session B (Regel), MYST-0004/0005A (Daten) | Daten ja |
| PlayerRef-Salt | Session A (Feld), MYST-0001 (Semantik) | ja |

Unowned aus dem Consolidation-Plan: U-1, U-2, U-3, U-5 → Session A; U-4 → Session B; U-6 (Evidence nur über Events) und U-7 (lügende NPCs) bleiben außerhalb V1. Ob die Vitrine U-6/U-7 braucht: Nachtrag.

## 22. Vitrine Certification Repair

Status: Fallmodell im Scratch lösbar/eindeutig (berichtet); Gesamtzertifizierung **NOT CERTIFIED**. Für eine erneute Zertifizierung desselben Falls müssen existieren:

- **CERT-1** Vitrine-Paket lädt mit Session A; alle Komponenten-Hashes einmal verifiziert; `packageIdentity` notiert.
- **CERT-2** Jede Proof-Premise ist nach §5 PR-1 erzeugbar: `reported` byte-gleich in der Presentation, `answered`-Stance gleich dem Ergebnis von MYST-0005B `decideResponse` auf dem Paket-Snapshot.
- **CERT-3** Jede Premise ist ab Initial Awareness erreichbar über MYST-0003-Fundwege und Session-B-Freischaltung.
- **CERT-4** Jede Proof-Folgerung ist laut MYST-0002 `evaluateConclusionClaim` determiniert und passend und liegt in `allowedClaims`.
- **CERT-5** Challenge-Exactness auf dem echten Paket: Pflicht-Claims ⊆ `allowedClaims`, alle `allowedClaims` determiniert (OD-6), eindeutige gewinnende Antwort im Scope.
- **CERT-6** Keine Proof-Route ohne Premises aus der Initial Awareness (Lösung nicht am Start bekannt).
- **CERT-7** Infoflow-Twin-Test mit den **echten** MYST-0004/0005B-Funktionen auf Vitrine-Daten; beide Leakklassen klassifiziert und geschlossen oder als ACCEPTED LEAK dokumentiert.
- **CERT-8** Replay der Zertifizierungs-Aktionsfolge mit Session C reproduziert PlayerKnowledge und Challenge-Verdict bei gleicher `packageIdentity` + `rulesetId`.
- **CERT-9** Zertifikatsdatei `CASE-leere-vitrine.solvability-cert.MYST-SOLVABILITY-0001.v1.json` bindet `packageIdentity`, `proofProfileHash` und die `acceptedCommit`s aller prüfenden Contracts.

## 23. Implementation Wave Plan

| Wave | Contracts | parallel | Harte Voraussetzungen | Review-Reihenfolge |
|---|---|---|---|---|
| 1 | MYST-0001, 0002, 0003, 0004, 0005A | alle fünf | Verifier-Aktivierung (Forge); MYST-0001 `A_CORE2` | 0002 → 0003 → 0005A → 0004 → 0001 |
| 2 | MYST-0005B, MYST-CHALLENGE-0001 | beide | 0005A bzw. 0002 akzeptiert | Challenge → 0005B |
| 3 | Session A → B → C; MYST-SOLVABILITY-0001 | Solvability ∥ Session B | Welle 2; Artefakte vorhanden (OD-2) | A → Solvability → B → C |
| 4 | Vitrine-Integration und Zertifizierung | – | Welle 3 | CERT-1…CERT-9 |

## 24. Final Freeze Verdict

| Contract | Verdikt |
|---|---|
| MYST-0001 | READY FOR ARCHITECTURE REVIEW (Registrierung ab `A_CORE2`) |
| MYST-0002 | READY FOR ARCHITECTURE REVIEW (Domain); Registrierung nach R-2 |
| MYST-0003 | READY FOR ARCHITECTURE REVIEW (Domain); Registrierung nach R-3 |
| MYST-0004 | READY AFTER SMALL REPAIR (R-4a) |
| MYST-0005A | READY AFTER SMALL REPAIR (R-5A) |
| MYST-0005B | BLOCKED BY DEPENDENCY (MYST-0005A) |
| MYST-CHALLENGE-0001 | BLOCKED BY MISSING ARTIFACT |
| MYST-SOLVABILITY-0001 | BLOCKED BY MISSING ARTIFACT |
| Session A / B / C | BLOCKED BY MISSING ARTIFACT |

Gesamtarchitektur: **FREEZE READY WITH LISTED REPAIRS** für den Kern MYST-0001…0005B. **Kein Gesamt-Freeze** für Challenge, Solvability, Session und Vitrine, weil ihre Texte nicht vorliegen; die Sollregeln, gegen die sie geprüft werden, sind hier eingefroren (§4–§16).

## 25. Remaining Unknowns

1. Texte von MYST-CHALLENGE-0001, MYST-SOLVABILITY-0001, Session A/B/C, VS-5-Preflight.
2. Vitrine: Case Spec, Player Brief, Case Pack, Certification, Proof Profile.
3. Cross-Contract-, Information-Flow-, Scale- und Authoring-Stress-Report; insbesondere die zwei Leakklassen und die Scale-Messwerte.
4. Ob Solvability Session B importiert (würde Welle 3 serialisieren).
5. Ob die Vitrine Evidence nur über Events oder lügende NPCs braucht (außerhalb V1).
6. Wo genau der Required-only-Widerspruch steht (Challenge-Text oder alter MYST-0002-Draft).
7. Ob die Autoren-Parser von MYST-0003/0005A ausreichende Eingabegrößenlimits haben (Review-Frage, §11 A).

## 26. GO / NO-GO

- **GO** für Architecture Reviews von MYST-0002, MYST-0003, MYST-0001 jetzt und von MYST-0005A/0004 nach ihren kleinen Repairs. Keine weitere Architekturarbeit am Kern nötig.
- **NO-GO** für den Gesamt-Spec-Freeze und die Vitrine-Zertifizierung, bis die in §25 Punkte 1–3 genannten Artefakte in `forge-audits/` liegen. Danach ist nur ein Nachtrag nötig, kein neuer Design-Pass: Texte gegen §4–§16 prüfen und die OLD→NEW-Zeilen ergänzen.

STOP.
