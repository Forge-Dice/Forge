# FORGE + MYSTERY — FINAL OWNER RECONCILIATION

Stand: 2026-10-04, ca. 15:00–16:00 UTC · Autor: Claude (Owner-Reconciliation, read-only gegenüber kanonischem Code)
Repository: `Forge-Dice/Forge` · `main` = `3d7545d843883418348004e68717399a64da7a7d` (vor und nach dieser Arbeit per `git ls-remote` gelesen, unverändert)
Quellen: ausschließlich Originalartefakte auf den Remote-Branches `forge/owner/audits/*` (60 Branches gelesen) plus `main`. Zusätzlich die nicht öffentliche Datei `FORGE-V0.1-FINAL-BOOTSTRAP-RECONCILIATION.md` aus dem Projektordner (im Folgenden **FBR**; sie liegt nicht in Git, wird nur zitiert, persönliche Daten daraus werden nicht übernommen).
Leitreferenz: `FORGE-V0.1-ARCHITECTURE-FREEZE` (**FRZ**). Wo neuere Originalartefakte FRZ in Einzelpunkten widersprechen, ist das unten als Owner-Entscheidung oder als Wortlautreparatur ausgewiesen, nicht still übernommen.

Dieser Bericht enthält **keine neue Architektur**. Jede Änderung ist entweder ein exakter OLD → NEW-Textrepair, eine Owner-Entscheidung zwischen bereits in den Artefakten beschriebenen Optionen oder eine Reihenfolgeregel.

---

## 0. Ergebnis in zehn Zeilen

1. **Forge:** FORGE-BOOTSTRAP-0001A/B/C sind alle **REPAIR REQUIRED**. Die Reparaturen sind endlich und textlich (Paketrevision r2 + contractVersion 2). Danach ist **A architecture-review-ready**; B und C folgen in der DAG A → B → C.
2. Von den 8 neueren Forge-Blockern sind 4 Contracttext-Defekte (Streaming-Budgets, Gate↔Stage-2, Review-Schemas, maskierte Mutanten), 2 sind Oracle-/Planungsdefekte außerhalb von A/B/C (16/61 Golden-Abweichungen, Second-Parent im Reference/Core/Korpus), 1 ist ein Deployment-Gate (Isolation), 1 ist ein Wortlautkonflikt plus R2-Template-Fehler (R3-Bypass / Drill-PASS).
3. **CORE-0002 bleibt nach BOOTSTRAPPED.** Zwei Artefakte würden es still vorziehen (Freeze §16, V2-Preflight „new tasks use Format 2“); das wird durch Owner-Entscheidung D1 ausdrücklich ausgeschlossen.
4. **Mystery:** Die unabhängige Freeze Verification (NO-GO) hat F01 fälschlich als „MYST-0001 NOT AVAILABLE“ geführt; MYST-0001 lag seit 09:07Z auf `forge/owner/audits/MYST-0001-PLAYERREF` (Goldens unabhängig reproduziert).
5. Von den 11 blockierenden Mystery-Findings sind nach Abgleich: 1 RESOLVED BY EXISTING CONTRACT (F01 inhaltlich), 7 SMALL CONTRACT REPAIR (F01-Einbindung, F03, F05, F06, F07, F08, F09, F10), 1 NEW REVISION REQUIRED (F02 Release→Proof-Adapter), 1 Owner-Entscheidung (F04 Belegpflicht), 1 STILL BLOCKING, aber nur für den Vitrine-Release, nicht für den Contract-Freeze (F11).
6. Kein nach 09:19Z committetes Mystery-Artefakt schließt einen Finding; alle sind byte-identisch mit bereits verifizierten Quellen oder inhaltlich älter (Solvability-Repair: Inhalt vom 03.10.).
7. Eine einzige Queue P0–P5 (Abschnitt C). Codex-Implementierung ist **nicht** freigegeben, bevor A repariert, reviewt, im Repo registriert und die P0-Plattformschritte live aktiv sind.
8. Zehn offene Owner-Entscheidungen (Abschnitt D), jede mit Empfehlung.
9. **Forge: READY FOR CONTRACT REPAIR. Mystery: FREEZE READY AFTER LISTED REPAIRS.**
10. **Exact next action:** Seb entscheidet D1–D10 (Abschnitt D) in einem Owner-Entscheidungsprotokoll.

---

## 1. Quellenregister

### 1.1 Gelesene Branches (Remote, Commit, Commitzeit UTC)

| Artefakt | Branch `forge/owner/audits/…` | Commit | Zeit |
|---|---|---|---|
| Bootstrap Experimental Report + Lab | FORGE-V0.1-BOOTSTRAP | da9b3d51 | 09:15Z |
| Verifier A/B/C Implementation Package + Contracts 0001A/B/C | FORGE-MINIMUM-VERIFIER-IMPLEMENTATION | bb525bfd | 08:37Z |
| A/B/C Independent Certification | VERIFIER-ABC-INDEPENDENT-CERTIFICATION | b854b113 | 08:38Z |
| Independent Verifier Reference | FORGE-VERIFIER-REFERENCE | 2062fca5 | 08:37Z |
| Reference Oracle Quality Report | reference-oracle-quality | 83214206 | 08:36Z |
| Ruleset Live Drill (Paket, Runbook, Templates) | FORGE-RULESET-LIVE-DRILL | 005bcd09 | 08:36Z |
| First Drill Pre-Mortem | FORGE-FIRST-DRILL-PRE-MORTEM | 9e5789e0 | 08:37Z |
| CORE-0002 Draft + Validation | FORGE-CORE-0002 | b8fb63bf | 11:14Z |
| Bootstrap Contract Plan | FORGE-V0.1-BOOTSTRAP-CONTRACT-PLAN | 67baaad7 | 09:07Z |
| VERIFIER-0001 Final Contract Reconciliation | FORGE-VERIFIER-0001 | b22fd25b | 11:37Z |
| Contract V2 Implementation Preflight | FORGE-CONTRACT-V2-IMPLEMENTATION-PREFLIGHT | 421c4ede | 11:29Z |
| Actions Policy Preflight | FORGE-ACTIONS-POLICY-PREFLIGHT | 01dfb21c | 11:39Z |
| Independent Readiness Audit | FORGE-V0.1-INDEPENDENT-READINESS-AUDIT | 32b1cfe8 | 09:16Z |
| Architecture Freeze (Leitreferenz) | FORGE-V0.1-ARCHITECTURE-FREEZE | a5302309 | 09:07Z |
| MYST-0001 PlayerRef | MYST-0001-PLAYERREF | a256e517 | 09:07Z |
| MYST-0002 FINAL-CANDIDATE + Repair | MYST-0002-REPAIR | ea22147f | 09:07Z |
| MYST-0003 | MYST-0003-EVIDENCE-ACCESS | 8ae160f6 | 09:07Z |
| MYST-0004 | MYST-0004-EVIDENCE-PRESENTATION | 51c2ddc4 | 09:07Z |
| MYST-0005A/B | MYST-0005-INTERROGATION | 76405cd3 | 09:07Z |
| Challenge (MYST-CHALLENGE-0001 + Exactness) | MYST-ACCUSATION-CHALLENGE-EXACTNESS | 7514e7e6 | 09:17Z |
| Solvability Repair (MYST-SOLVABILITY-0001) | MYSTERY-SOLVABILITY-ACCUSATION-REPAIR | f02b7a56 | 14:14Z |
| Session A/B/C | MYSTERY-SESSION-PRODUCTION-PACKAGE | b94db40e | 08:38Z |
| VS-5 Preflight | MYSTERY-VS5-PREFLIGHT | 284ea9de | 11:42Z |
| Vertical Slice Preflight | MYSTERY-VERTICAL-SLICE-PREFLIGHT | 79e1f81d | 11:47Z |
| Vitrine (Case Pack, Headless Spec, Brief) | DIE-LEERE-VITRINE | fa3a1cbf | 09:14Z |
| Vitrine Certification + Proof Profile | DIE-LEERE-VITRINE-SOLVABILITY-CERTIFICATION | e66e7e19 | 09:03Z |
| Cross-Contract | MYSTERY-CROSS-CONTRACT-CONSISTENCY | 3254b9c2 | 08:37Z |
| InfoFlow | mystery-infoflow | 006ecf36 | 08:37Z |
| Scale | MYSTERY-SCALE-COMPLEXITY | 27dd70f0 | 10:54Z |
| Authoring Stress | MYSTERY-CASE-AUTHORING-STRESS | 8b68e511 | 14:40Z |
| Independent Freeze Verification | MYSTERY-INDEPENDENT-FREEZE-VERIFICATION | 25a8a17b | 09:19Z |
| Final Reconciliation Freeze | MYSTERY-FINAL-RECONCILIATION-SPEC-FREEZE | 5e77872d | 09:07Z |
| Contract Consolidation | MYSTERY-CONTRACT-CONSOLIDATION | 6982a0aa | 09:07Z |

Weitere Branches (Deep Audit, Hardening, Minimum Product, Identity, Org Migration, Run Recovery, Pipeline Challenge, Contract System V2, Handoff Audit, Overnight Plan, TASK-0004/0005, Codex Inventory, Roadmaps) wurden nur gezielt für einzelne Belege gelesen.

### 1.2 Inhaltshashes der zu reparierenden Contracts (SHA-256 der Rohbytes)

| Contract | SHA-256 | Format |
|---|---|---|
| FORGE-BOOTSTRAP-0001A.contract.DRAFT.md | `db206a9834a9ff460fade6e8ee88d2dd099873e84bb1b2a779879d94c88d0084` | 1 |
| FORGE-BOOTSTRAP-0001B.contract.DRAFT.md | `b6aa76ffdd5035ffdf5d7ad402659bf83bf861ef39000d6d582429785a3852f2` | 1 |
| FORGE-BOOTSTRAP-0001C.contract.DRAFT.md | `cdddfc96bddc159eb572d84d47babf24af6a1991fe596fabc65c7985c16bcbd1` | 1 |
| Paketbindung A/B/C (Sectionhash §§1–15) | `0e6d89179623535ed431206b2352dfdb66d8edbfad3340d6f10b77ef63c4f0d4` | – |
| FORGE-CORE-0002.contract.DRAFT.md | `5259bb488886f23782608527c83cbfb1cdfd443884a12687ee3bbfa385c09c25` | 1 (führt F2 ein) |
| MYST-0001-PLAYERREF-V1 | raw `a602ab16…ea192`, fcv2 `f4d3185898015901fad3155fdc37836652c486b028b30528ca4beb17f3726335` | 2 |
| MYST-0002.contract.FINAL-CANDIDATE | raw `f8f72fa58115fec37b1994c551a697470fd29a87d627736a2060b85a8708b84c`, fcv1 `e1eba9e1e248376f18774ee8899208c4a7a066e0cf5d5cc23973db4b3cf91e1c` | 1 |
| MYST-0003 V1 | raw `dd39b7fc…84f35` | 1 |
| MYST-0004 V1 | raw `6a2e155f…2973` | 1 |
| MYST-0005A V1 | raw `fc4c7a63…3e0e` | 1 |
| MYST-0005B V1 | raw `abcb3a48…f6a180` | 1 |
| MYST-CHALLENGE-0001 | raw `9888f9b5…86f58f4` | 1 |
| MYST-SOLVABILITY-0001 | raw `06b0e5f2…09d8` | 1 |
| MYST-SESSION-0001A/B/C | `060f3fc6…c394` / `3550a9df…7251` / `6263e005…3205` | 1 |

Alle Mystery-Rohhashes stimmen mit dem Quellenregister der Freeze Verification überein; es wurde dasselbe Byte-Exemplar geprüft. Die gemeinsamen Abschnitte von Session A/B/C sind bytegleich (Zeilenversatz: SB = SA − 31, SC = SA − 28).

### 1.3 Kürzel

PKG = FORGE-MINIMUM-VERIFIER-IMPLEMENTATION-PACKAGE (Zeilen nach Textkonvertierung der HTML); A/B/C = FORGE-BOOTSTRAP-0001A/B/C; CERT = A/B/C Independent Certification; ROQ = Reference Oracle Quality; REF = Verifier Reference; DRILL = Ruleset Live Drill; PM = First Drill Pre-Mortem; EXP = Bootstrap Experimental Report; V01R = VERIFIER-0001 Final Reconciliation; V2PF = Contract V2 Preflight; RA = Readiness Audit. M1…M5B = MYST-0001…0005B; CH = MYST-CHALLENGE-0001; SOL = MYST-SOLVABILITY-0001; SA/SB/SC = MYST-SESSION-0001A/B/C; FV = Mystery Independent Freeze Verification; FR = Mystery Final Reconciliation Spec Freeze; VIT = Vitrine-Case-Pack/Spec; BRIEF = Vitrine Player Brief; CERT-V = Vitrine Solvability Certification.

---

## A. FORGE

### A.0 Welche DAG gilt

Die aktuelle Bootstrap-DAG ist **FORGE-BOOTSTRAP-0001A → 0001B → 0001C** (alle Format 1; A ohne Dependencies, B → A, C → B, `acceptedCommit` jeweils `null`). Sie ersetzt die Sequenz FRZ §16 ([2] VERIFIER-0001 ∥ [3] CORE-0002 → [4] VERIFIER-0002 → … → [6] VERIFIER-0003) und die Queue Q01–Q29 des Bootstrap Contract Plan. FBR hat bereits dieselbe Form (P0 → Owner-Ops-PR → A → B → C → LIVE → Drill → BOOTSTRAPPED → CORE-0002), benennt die Knoten aber noch VERIFIER-0001/2/3; die realen IDs sind 0001A/B/C.

- Der historische Draft `341ec983` (VERIFIER-0001) ist NOT COMPARABLE (CERT-Kopf) und wird nicht mehr verwendet. V01R gibt ausdrücklich keinen Contract aus („**Not issued.**“, „NOT READY FOR ARCHITECTURE REVIEW“) und erwähnt A/B/C nicht. Er ersetzt A/B/C nicht.
- CERT-Urteil (wörtlich): „REQUEST CONTRACT CHANGES — A noch nicht registrierungsbereit“; A/B/C und gesamt REQUEST CONTRACT CHANGES; Produktivaktivierung NO-GO.
- PKG-Urteil (wörtlich): „GO für die spezifizierte Implementierung in drei abhängigen Tasks; NO-GO für heutige Produktivaktivierung“.

### A.1 Reparaturweg (gilt für alle A/B/C-Repairs)

Die Contracts verweisen auf das Paket als normative Quelle („Normative Details stehen im mitgelieferten FORGE-MINIMUM-VERIFIER-IMPLEMENTATION-PACKAGE.html, Abschnitte 1–18“, A Z. 48 / B Z. 53 / C Z. 57) und binden nur §§1–15 per Hash `0e6d8917…`. Fast alle Defekte liegen in §§2, 3, 9, 10, 11, 13. Deshalb:

1. **Eine neue Paketrevision r2** (eine Datei, einzige normative Quelle) mit allen PKG-Repairs unten. Neuer `normative-sections.json`, neuer Sectionhash. r2 bindet **§§1–18** (heute referenziert, aber nur §§1–15 gebunden; CERT §1).
2. A/B/C ändern im Body nur: Bindungszeile (neuer Hash, Revisionsname), Mutantenlisten, Acceptance-Zusätze, Dependency-Sätze. **contractVersion 2**, kanonisch neu parsen, neuer `forge-contract-v1`-contentHash, `baseCommit` gegen dann aktuelles `main` prüfen.
3. Normativen Text nicht doppelt in Contract und Paket führen.
4. Die 61 ROQ-Goldens werden gegen r2 neu bestätigt.

Contract: A, B, C · Section: Body „Normative Bindung“ (A Z. 56, B Z. 61, C Z. 65)
OLD: „Normative Bindung: SHA256 der UTF-8-JSON-Sequenz [sectionNumber,title,htmlBody] für Abschnitte 1–15, compact JSON ohne abschließenden LF, ist 0e6d89179623535ed431206b2352dfdb66d8edbfad3340d6f10b77ef63c4f0d4.“
NEW: „Normative Bindung: SHA256 der UTF-8-JSON-Sequenz [sectionNumber,title,htmlBody] für Abschnitte 1–18 von FORGE-MINIMUM-VERIFIER-IMPLEMENTATION-PACKAGE r2, compact JSON ohne abschließenden LF, ist ‹r2-Hash›. Revision 1 (0e6d8917…) ist superseded.“
Evidence: CERT §1 („§§16–18 sind damit referenziert, aber nicht Bestandteil dieses angegebenen Sectionhashes“).
Blocking reason: Jede Reparatur in §§1–15 bricht sonst die Bindung; Reparatur nur im Contractbody erzeugt zwei widersprüchliche Quellen.

### A.2 Die 8 Blocker

#### Blocker 1 — Widersprüchliche Streaming-Budgets (CERT F01) → Contract A (+ B)

Contract: A (PKG §2, Grenzwerttabelle; Owner `process.py`, `objects.py`), B (Worker-Report)
Section: PKG §2 „Trusted Bootstrap“, Grenzwertzeile stdout/stderr (PKG Z. 82)
OLD: „| stdout + stderr | je Prozess zusammen höchstens 8 MiB; Überlauf ist Infrastrukturfehler“
NEW: „| stdout + stderr (Diagnose/Log) | je Prozess zusammen höchstens 8 MiB; Überlauf ist Infrastrukturfehler (EXECUTION_IO). Gilt nicht für die geframten Datenkanäle der folgenden Zeile.
| Geframte Datenkanäle | cat-file --batch: je Objekt Header höchstens 64 Byte, danach genau die deklarierte Größe plus 1 LF; deklarierte Größe vor dem Lesen gegen das Typlimit Commit/Tree/Blob prüfen; kumulativ je Prozess höchstens das Budget entpackter Objekte aus dieser Tabelle; stderr dieser Prozesse höchstens 1 MiB. Worker-Report: Payload höchstens 8 MiB (Inventarlimit) plus Frameheader höchstens 64 Byte, innerhalb /out 16 MiB.
Fehlerpriorität geframter Kanäle: deklarierte Größe über Typ- oder Summenlimit → GIT_LIMIT vor dem Lesen des Inhalts; Header-, Framing- oder Längenabweichung → GIT_OBJECT; Report über Payload- oder Framegrenze → TEST_INVENTORY (im Mutantenlauf MUTANT_INFRA); stderr-Überlauf → EXECUTION_IO. Kein bestehendes Objekt-, Inventar-, Summen- oder Zeitlimit wird dadurch erhöht.“
Zusatz A „Acceptance“ (an A Z. 68 anhängen): „Grenzfälle der Datenkanäle: Blob mit genau 8 MiB und Tree mit genau 16 MiB über denselben Batchprozess werden vollständig gelesen; 8 MiB + 1 Byte Blob ergibt GIT_LIMIT ohne Inhaltslesen; mehrere einzeln zulässige Objekte im selben Batchprozess bestehen bis zum Summenlimit.“
Zusatz B „Acceptance“ (an B Z. 73 anhängen): „Report mit genau 8 MiB Payload plus Frameheader wird angenommen; 8 MiB + 1 Byte Payload ergibt TEST_INVENTORY.“
Evidence: CERT F01; Probe P03 (`blob 8388608`, `framedOutput 8388663`, `overBy 55`); CA-001/002/046. Zusätzlich: ein zulässiger 16-MiB-Tree (PKG Z. 74) überschreitet das 8-MiB-Prozessbudget um das Doppelte.
Blocking reason: Ein konformer Implementierer muss entweder zulässige Objekte ablehnen oder das Budget eigenmächtig lockern. Die Alternative „veröffentlichte Limits inklusive Framing reduzieren“ ändert sichtbare Limits und wird deshalb nicht gewählt; die gewählte Fassung lockert keinen Schutz (CERT: „Kein Schutz lockern“). Keine Owner-Entscheidung nötig.

#### Blocker 2 — Lücke Gate ↔ Stage-2-Review (CERT F02) → Contract C

Contract: C · Section: PKG §10 „Final Recheck“, Zeile „Re-run all jobs“ (PKG Z. 255); PKG §9 Snapshotdigest (Z. 245); §13 AV-155 (Z. 498)
OLD (Z. 255): „| Re-run all jobs | forge-gate setzt nur nach vollem Erfolg output receipt = fixed canonical JSON {runId,runAttempt,B,H,contractHash,policyHash,verifierSha}. Stage 2 vergleicht mit eigenem aktuellen Attempt. Re-run failed jobs behält ein altes Gate-Receipt und scheitert. Jobs des spezifischen Attempts müssen genau einen forge-gate und den einen laufenden forge-verify enthalten; keine Matrix-/Namensduplikate.“
NEW (Z. 255): „| Re-run all jobs | forge-gate setzt nur nach vollem Erfolg output receipt = fixed canonical JSON {runId,runAttempt,B,H,contractHash,policyHash,verifierSha,reviewSnapshotDigest}. reviewSnapshotDigest ist der von forge-gate unmittelbar vor Ausgabe des Receipts nach §9 berechnete Snapshotdigest (64 hex). Stage 2 vergleicht mit eigenem aktuellen Attempt und vergleicht reviewSnapshotDigest mit dem eigenen Stage-2-Start-Snapshot; jede Abweichung ist REVIEW_CHANGED. Re-run failed jobs behält ein altes Gate-Receipt und scheitert. Jobs des spezifischen Attempts müssen genau einen forge-gate und den einen laufenden forge-verify enthalten; keine Matrix-/Namensduplikate. Laufzeitgarantie ist ausschließlich ein frischer vollständiger Attempt; welches Re-run-Menü der Owner benutzt hat, ist nicht beobachtbar und wird nicht behauptet.“
OLD (Z. 245, zweiter Satz): „Jeder Unterschied während des Laufs führt zu REVIEW_CHANGED oder einem höher priorisierten aktuellen Blocker.“
NEW: „Beobachtungsgrenze ist der Gate-Snapshot desselben Attempts: forge-gate berechnet ihn und bindet ihn im Receipt (§10); Stage-2-Start und beide Final-Snapshots müssen ihm gleichen. Jeder Unterschied führt zu REVIEW_CHANGED oder einem höher priorisierten aktuellen Blocker.“
OLD (Z. 498): „| AV-155 | Review / Final | Review vor erster Beobachtung editiert und jetzt korrekt gebunden | PASS |“
NEW: „| AV-155 | Review / Final | Review vor der Gate-Beobachtung desselben Attempts editiert und jetzt korrekt gebunden | PASS |“
Neu C „Required Verifier Mutations“ (nach C Z. 88): „C5: reviewSnapshotDigest-Vergleich zwischen Receipt und Stage-2-Start auslassen — Gate→Stage2-Edit-Assertion (AV-154) muss scheitern.“
Evidence: CERT F02; P04 (`distinctGateReviews: true`, `identicalReceipts: true`); CA-065.
Blocking reason: AV-154 verlangt eine Erkennung, die mit dem normierten Receipt unmöglich ist. Die Beobachtungsgrenze ist eine Owner-Entscheidung (**D2**); die Alternative (nur Stage-2-Frische, AV-154 abschwächen) nimmt einen heute versprochenen Schutz zurück.

#### Blocker 3 — Offene Review-Schemas (CERT F04) und nicht geschlossene Sollcodes (CERT F03) → C (+ A/B)

Contract: C · Section: PKG §9 „Owner Attestation“ (Z. 242, 244)
OLD (Z. 242, Teil): „findings=[{id,severity,summary}]. … keine blocking-Findings bei approve. Nichtblocking-Findings bleiben reviewbar.“
NEW: „findings ist eine Liste strikter Objekte {id,severity,summary}: id [a-z0-9][a-z0-9-]{0,31}, innerhalb des Berichts eindeutig; severity ∈ {"info","minor","major","critical"}; summary nichtleerer String höchstens 512 Byte. Unbekannte Felder oder Werte → REVIEW_FORMAT. Ein Finding ist blocking genau dann, wenn severity ∈ {"major","critical"}. result=approve verlangt null blocking Findings, sonst REVIEW_BLOCKED; result=request_changes ist stets REVIEW_BLOCKED; jeder andere result-Wert ist REVIEW_FORMAT. Nicht-blocking Findings bleiben reviewbar und verhindern kein PASS. Für OWNER_OPS gilt keine automatische Providerregel; die Unabhängigkeit des externen Reviews ist dort allein Owner-attestiert.“
OLD (Z. 244, Teil): „Neue approve darf ältere Blocker nur explizit in supersedes=[{reviewId,bodyHash,state}] freigeben; IDs allein reichen wegen Editierbarkeit nicht.“
NEW: der OLD-Satz, gefolgt von: „Blocker im Sinne von supersedes ist jeder ältere veröffentlichte Owner-Review mit state CHANGES_REQUESTED oder DISMISSED, jeder ältere Owner-COMMENTED-Review mit gültiger revoke-Variante oder mit approve-Variante, deren externalReviewResult request_changes ist oder die blocking Findings enthält, sowie jeder ältere Owner-COMMENTED-Body, der mit FORGE-ATTESTATION-V1 beginnt und nicht strikt gültig ist. Die Menge supersedes muss exakt der Menge aller zum Prüfzeitpunkt vorhandenen Blocker entsprechen. Eine in einem früheren Review erklärte Supersedierung wirkt nicht fort (keine Transitivität). bodyHash = SHA256 der exakten aktuellen Bodybytes, state = aktueller API-State.“

F03-Sollcodes (geteilt):

| Fall | Contract | OLD (PKG) | NEW |
|---|---|---|---|
| AV-004 | A | Z. 39 „PR/run/actor IDs positive dezimale Integer ≤ 2^53−1.“ | „PR/run/actor IDs sind JSON-Zahltoken nur aus [1-9][0-9]*, ohne Vorzeichen, Bruchteil, Exponent oder führende Null, Wert ≤ 2^53−1; 1e0, 1.0 und 01 sind PR_INPUT.“ |
| AV-071 | A | Z. 273 „| GIT_HISTORY | BASE nicht erreichbar; Merge/Root/zu viele neue Commits; leerer End-Diff“ | „| GIT_HISTORY | BASE nicht erreichbar; Merge/Root; leerer End-Diff oder HEAD=BASE“; Z. 270 GIT_LIMIT ergänzt „inklusive mehr als 128 neuer Commits“. AV-071 bleibt GIT_LIMIT. |
| AV-115 | B | Z. 458 „Gleiche flache fullName-Zeichenfolge bei anderer ancestor-Struktur | TEST_INVENTORY“ | AV-115a „BASE-Identität fehlt und eine Identität mit gleichem gedrucktem fullName, aber anderem ancestor-Tupel ersetzt sie | TEST_INVENTORY“; AV-115b „Zusätzliche Identität mit gleichem gedrucktem fullName unter anderem ancestor-Tupel in genehmigter neuer Datei, alle BASE-Identitäten vorhanden | PASS“ |
| AV-150 | C | Z. 493 „External-Review result reject | REVIEW_BLOCKED“ | AV-150 „External-Review result request_changes (schemagültig) | REVIEW_BLOCKED“; neu AV-150b „External-Review result reject (nicht im Enum) | REVIEW_FORMAT“ |
| AV-123/124/125 | B | Z. 466–468 „… | EXECUTION_SANDBOX“ | siehe Blocker 7 |
| AV-009 | A | Z. 353 „Remote-URL aus PR wird angeboten | GIT_FETCH“ | „PR-Datensatz enthält head.repo.clone_url/eine abweichende URL: wird ignoriert, Fetch nur vom festen Remote; PASS bei sonst gültigem Input. Eine abweichende Remote-Konfiguration im ODB ist GIT_LAYOUT.“ |
| AV-096 | A/B | Z. 439 | Präzedenz: Branch-TASK ≠ registrierter Task → IDENTITY_NAMESPACE (Phase 3); Contract-Task ≠ Policy-Task bei passendem Branch → CONTRACT_BINDING. |
| AV-141 | B | Z. 484 „Developer meldet detected ohne unabhängigen Mutantenlauf | MUTANT_INFRA“ | „Fehlender required Mutant → MUTANT_NOT_APPLIED; Developer-Detected-Feld wird ignoriert (keine Ingress-Quelle), der unabhängige Lauf entscheidet.“ |

Evidence: CERT F03/F04; P08 (`declaredExternalResultEnum: ["approve","request_changes"]`, `AV150Value: "reject"`); CA-032/076/077/078/080.
Blocking reason: Ein approve mit critical-Findings ergibt je Implementierung ein anderes Resultat; Sollcodes widersprechen sich. Severity-Enum, Schwelle und Blocker-Menge sind Owner-Entscheidung **D3** (Empfehlung oben).

#### Blocker 4 — Maskierte Mutanten-Evidenz (CERT F08) → A, B, C

Contract: A/B/C · Section: „Required Verifier Mutations“ (A Z. 74–79, B Z. 79–82, C Z. 85–88) und PKG §13 letzter Absatz (Z. 521)
OLD (A Z. 79): „Mutanten sind lokale Testinstrumente, keine HEAD-Dateien. Jede Veränderung muss exakt lokalisierbar, einmal angewandt, nicht äquivalent und durch echte Testassertion erkannt sein. Anchorbytes werden nach finaler Implementierung für den Acceptance-Runner eingefroren und vom Reviewer kontrolliert; keine zur Implementierung passende neue Semantik wählen.“
NEW (ersetzt A Z. 79, wortgleich als Schlussabsatz in B und C): „Mutanten sind lokale Testinstrumente, keine HEAD-Dateien. Jeder Mutant ist an genau eine normativ zugesagte Schutzwirkung und genau einen isolierten Assertiontest auf der Schicht dieser Schutzwirkung gebunden. Alle anderen Barrieren, die denselben Input ablehnen könnten, bleiben unverändert und werden im Abnahmebericht benannt; die Fixture ist so gewählt, dass sie diese Barrieren passiert (Masking-Erklärung). Als KILLED zählt ausschließlich, dass der Assertiontest statt der normativ verlangten Ablehnung bzw. Diff-/Klassifikationssemantik ein unsicheres Ergebnis beobachtet. Ein geänderter Fehlercode zwischen zwei sicheren Ablehnungen, ein Compiler-/Importfehler, Timeout, NOT_APPLIED oder ein nicht ausgeführter Test zählt nicht. Datei, Anchorbytes, Byteposition und Before/After-SHA256 werden nach finaler Implementierung vom unabhängigen Reviewer eingefroren; keine zur Implementierung passende neue Semantik wählen.“

Einzelne Mutanten (OLD jeweils die bestehende Zeile):
- A1 OLD „A1: GIT_NO_REPLACE_OBJECTS entfernen und Layout-Prüfung für refs/replace entfernen — dedizierter Original-Blob-Assertiontest muss scheitern.“ → NEW „A1: Layout-Prüfung für refs/replace (auch packed) entfernen; Env-Allowlist und Raw-Objekt-Rehash bleiben unverändert — isolierter Layout-Assertiontest (AV-025) muss statt GIT_LAYOUT Akzeptanz zeigen. Die Entfernung von GIT_NO_REPLACE_OBJECTS ist kein Securitykill, weil der Rehash die Ersatzbytes weiterhin ablehnt (P01).“
- A4 OLD „A4: duplicate Rawtree-Entry vor Prüfung in dict überschreiben — Duplicate-Assertiontest muss scheitern.“ → NEW „A4: in readTree die Rohentries vor Duplicate- und Sortierprüfung in ein dict überführen, sodass keine spätere Rohprüfung die Doublette sieht — isolierter readTree-Assertiontest mit doppeltem Rohnamen (AV-030) muss statt GIT_COLLISION/GIT_OBJECT Akzeptanz zeigen; der Reviewer weist nach, dass kein verbleibender Rawcheck äquivalent wirkt.“
- **A5 neu:** „A5: Ein-Parent-Prüfung für neue Commits oberhalb BASE entfernen — isolierter validateHistory-Assertiontest mit echtem Zwei-Parent-HEAD und ansonsten gültiger Treeänderung (AV-029) muss statt GIT_HISTORY Akzeptanz zeigen.“
- B1 OLD „B1: exact Scope auf startsWith umstellen — scope escape Assertion muss scheitern.“ → NEW „B1: exact Scope auf startsWith umstellen — isolierter checkScope-Assertiontest: modify-Scope src/a.ts, zusätzlich gültige nicht genehmigte ADD-Datei src/a.ts-extra.ts (kein DELETE, kein file→directory, kein Mode-/Pfad-/Klassenfehler) muss statt SCOPE_PATH Akzeptanz zeigen.“
- B2 OLD „B2: vollständiges Inventar auf bloße Gesamtzahl reduzieren — löschen+neue Tests Assertion muss scheitern.“ → NEW „B2: compareInventory auf Gesamtzahl reduzieren — isolierter Inventarschicht-Test ohne vorgelagerten Freeze: Verlust einer BASE-Identität plus eine neue Identität bei gleicher Gesamtzahl (AV-118) muss statt TEST_INVENTORY Akzeptanz zeigen.“
- B3 OLD „B3: nonzero als KILLED klassifizieren — Compiler-/Timeout-Assertion muss scheitern.“ → NEW „B3: im Klassifikator jeden nonzero Exit als KILLED werten und den Infra-Vorrang für Exit ≠ 1 entfernen — isolierter Klassifikatortest mit vollständigem Report, AssertionError im benannten Test und Exit 2 bzw. Signal −9 muss statt INFRA_FAILURE KILLED zeigen; vorgeschaltete Compiler-/Timeoutguards werden durch die Fixture nicht ausgelöst.“
- **B5 neu (schließt M10):** „B5: Coordination-Prefixausnahme in checkScope einführen — isolierter Scopetest ADD forge/coordination/CODEX.md ohne Scope (AV-080) muss statt SCOPE_PATH Akzeptanz zeigen.“
- C1 OLD „C1: review.user.login statt user.id — same-name/wrong-ID Assertion muss scheitern.“ → NEW „C1: an der einzigen Stelle der Owner-Identitätsentscheidung review.user.login statt user.id verwenden — Assertiontest gleicher Login, falsche numeric ID (AV-145) muss statt REVIEW_MISSING Akzeptanz zeigen; kein zweiter numeric-Vorfilter maskiert sie.“
- C3 OLD „C3: runAttempt aus Gate-Receipt nicht prüfen — rerun-failed-jobs Assertion muss scheitern.“ → NEW „C3: Vergleich receipt.runAttempt mit aktuellem Attempt entfernen — isolierter final-Test, in dem die Attempt-Jobliste korrekt ist, das Receipt aber den runAttempt des Vorattempts trägt, muss statt IDENTITY_RECHECK Akzeptanz zeigen. Der Re-run-failed-jobs-Fall (AV-170) wird zusätzlich vom Attempt-Jobset abgewiesen und zählt nicht als C3-Kill (P06).“
- C4 OLD „C4: final main-Abgleich auslassen — stale-main Assertion muss scheitern.“ → NEW „C4: Final-Abgleich aktuelles main=B entfernen — isolierte Final-Snapshotfixture mit PR.base.sha=B und GITHUB_SHA=B, aber /branches/main ≠ B (AV-166) muss statt PR_STALE Akzeptanz zeigen; die übrigen frischen Base-Prüfungen werden in der Fixture konstant gehalten.“
- C5 neu: siehe Blocker 2.

PKG Z. 521 OLD: „Zusätzlich verpflichtend: sechs Implementationsmutanten des Verifiers selbst müssen durch diese Suite auffliegen: (M1) … (M10) Coordination-Prefixausnahme einführen. …“ (nennt „sechs“, listet zehn)
NEW: „Zusätzlich verpflichtend: die Contractmutanten A1–A5, B1–B5 und C1–C5 müssen nach der Mutantenregel der Contracts durch diese Suite in isolierten Assertiontests auffliegen. Abbildung der bisherigen IDs: M1→A1, M2→B1, M3→B2, M4→B3, M5→C1, M6→C2, M7→C3, M8→A2, M9→C4, M10→B5. Das ist die verbindliche Mutation-Testing-Abnahme der späteren Implementierung, noch kein gemessener Mutation Score.“
Evidence: CERT F08; `mutants.json` (A1 „Doppelmutant, nicht exact byte-bound“, C3 „kosmetische Securityevidence“); P01, P06; CA-112–118. V2PF Z. 447 („masked“) betrifft Test-Timeouts, nicht F08; V01R §8 und ROQ §5 bestätigen das Kill-Kriterium.
Blocking reason: Verlangte Securitykills beweisen teils nur einen Codewechsel zwischen zwei sicheren Ablehnungen; Ein-Parent-Guard (A) und Coordination-Ausnahme (M10) hätten gar keinen Mutanten.

#### Blocker 5 — Reference Oracle: 16/61 Golden-Abweichungen → **kein A/B/C-Defekt**; Oracle + FBR-PASS-Kriterium

Befund: ROQ Z. 5: „61 unabhängige Golden-Fälle zeigen 16 Reference-Abweichungen.“ Aufteilung: 4 Pfadgrammatik, 1 Coordination-Ausnahme, 6 Mutation/Patch-Klassifikation, 5 History (zweiter Parent, Revert-Zwischencommit, leerer End-Diff, BASE=HEAD, 129 Commits). Alle 61 Goldens sind `CONTRACT-DERIVED`, und jede Erwartung ist bereits durch PKG-Text getragen (z. B. PKG Z. 99, 107, 124, 198, 202). Das Tiny-Modell erfüllt alle 54 Layer-Goldens. Die 300 CLI-Vergleiche der Reference sind Selbstvergleiche. ROQ-Urteil: „NO-GO als unverändertes Codex-Oracle“; „61 golden + 24 property families … GO, begrenzter Scope“. REF-Urteil: „GO als unabhängiges Differential-Referenzmodell; NO-GO als produktiver Sicherheitsverifier.“

Repair 5a — Contract: A · Section: PKG §13 nach AV-070 (einziger Contract-Anteil)
OLD: (absence; nächster bestehender Satz PKG Z. 99: „End-Diff H gegen B muss nichtleer sein.“ — ohne eigenen Acceptance-Fall)
NEW: „| AV-070b | History / Scope | Nichtleere neue Commitkette mit leerem End-Diff gegen BASE | GIT_HISTORY | SPECIFIED — noch kein Integrationstest |“

Repair 5b — Planungsdokument FBR §9, PASS-Kriterium für C (FBR Z. 232; nicht öffentlich, Owner-Datei)
OLD: „(2) für jeden Fall im Differential Corpus (150 Repos, 6 400 Prüfungen, 300 CLI-Vergleiche): gleiches Urteil (pass/fail) **und** gleiche Menge Fehlercodes; (3) **null** ungeklärte Abweichungen;“
NEW: „(2) die 61 unabhängigen Golden-Fälle und 24 Property-Familien (ROQ) sind normativ, gegen Paket r2 neu bestätigt, und müssen grün sein; der Differential Corpus (150 Repos / 6 400 Prüfungen / 300 CLI-Vergleiche) wird nur explorativ verglichen und ist kein Gleichheitsorakel für Fehlercode-Mengen; (3) jede Abweichung wird nach ROQ §11 triagiert – Reference-Fehler werden dokumentiert, nicht nachgebaut;“
Evidence: ROQ Z. 5, 8, 78–81, 202, 204; `golden-conformance.json`; CERT §9 Z. 165 („Unverändert ist der Gesamtcorpus kein A/B/C-Produktionsacceptance“).
Blocking reason: Unter der heutigen FBR-Regel würde ein korrekt implementiertes A/B/C in genau diesen 16 Fällen FAILEN. Rolle der Reference = Owner-Entscheidung **D6**.

#### Blocker 6 — Fehlender Second-Parent-Schutz → A verlangt ihn bereits; fehlt in Reference, Core-`main`, Korpus und Mutantenabnahme

Befund: A/PKG verlangen ihn (A Z. 68 „2. Parent verboten nur oberhalb BASE“; PKG Z. 99 „Jeder neue Commit hat exakt einen Parent“; AV-029 → GIT_HISTORY). Fehlend:
- Reference: kein Guard, Mutant `permit-second-parent` „PREEXISTING_DEFECT_EQUIVALENT_ON_WITNESS“ (ROQ Z. 84, 93, 120).
- Forge-Core `main`: RA Z. 72 „ancestry.ts:11–21 akzeptiert alle Parent-Kanten; start-gate.ts:90–95 nutzt normale Any-parent-Ancestry. EXPERIMENTALLY VERIFIED“.
- Korpus: „0-legitimate hat einen Mergehead, während A jeden neuen Commit single-parent verlangt“ (CERT Z. 165).
- CORE-0002 Z. 212 verschiebt First-Parent-Prüfungen auf „VERIFIER-0002“, das in der A/B/C-DAG nicht mehr existiert.
- A hat keinen Mutanten dafür (→ A5, Blocker 4).
- BASE-seitige Ancestry über zweite Parents ist ohne Traversal-/Budgetregel (CA-009).

Repair 6a — Contract: A · Section: Acceptance (A Z. 68)
OLD: „Mode+Content doppelt sichtbar; 2. Parent verboten nur oberhalb BASE.“
NEW: „Mode+Content doppelt sichtbar; 2. Parent verboten nur oberhalb BASE; Pflicht-Goldens: zweiter Parent, Revert-Zwischencommit, BASE=HEAD, leerer End-Diff, 129 Commits (ROQ Z. 120); Positivfall: baseCommit nur über zweiten Parent eines BASE-Merges erreichbar → PASS.“
Repair 6b — Contract: A · Section: PKG §3 validateHistory (Z. 99, Satz anhängen)
OLD: „Verträge können einen älteren baseCommit haben, dieser muss in authentisch gelesener BASE-Ancestry liegen.“
NEW: der OLD-Satz, gefolgt von: „Die Ancestry-Prüfung für Contract.baseCommit und Dependency-acceptedCommit läuft ab B über alle Parents (auch zweite Merge-Parents) iterativ mit Besuchtmenge, begrenzt durch das Objektbudget aus §2; Überschreitung GIT_LIMIT; fehlende Objekte GIT_OBJECT.“
Repair 6c — Korpus/Reference (kein Contract): Fall „0-legitimate“ mit Merge-HEAD als erwartetes GIT_HISTORY umlabeln oder einparentig neu bauen; Reference bekommt `len(parents(c)) == 1` für alle `c` in `BASE..HEAD`, Killing-Witness aus RA.
Repair 6d — Plattform-Regel (Queue): `src/forge/start-gate.ts` auf `main` ist bis zur Aktivierung von C kein Produktionsgate. Keine `required_linear_history`-Regel (R1 deckt `main`, sonst bräuchte es ein R8).
Blocking reason: Ohne A5 ist der Guard ungeprüft entfernbar; ohne 6c würde der Korpus einen korrekten Guard als Regression melden.

#### Blocker 7 — Execution-Isolation nicht zertifiziert → Deployment-Gate (bleibt NO-GO), plus B-Acceptance- und FBR-Repair

Befund: Kein Labor hatte Docker (EXP Z. 427; REF Z. 100 „EXECUTION_ISOLATION_NOT_TESTED“; ROQ Z. 136). CERT F10 ist für den Contracttext NONBLOCKING; das NO-GO-Deploymentgate bleibt. Zwei echte Textdefekte:

Repair 7a — Contract: B · Section: PKG §13 AV-123/124/125 (Z. 466–468) und B „Acceptance“ (B Z. 73)
OLD (B Z. 73): „Der Worker darf weder Netzwerk noch Docker-Socket/Actions-Commandfiles erreichen; kein stdout-Workflowcommand gelangt ungefiltert ins Hostlog.“
NEW: der OLD-Satz, gefolgt von: „Nachweis: Probe-Worker mit exakt den §6-Flags meldet gemessene Denials (Netz, Docker-Socket, Commandfiles, schreibgeschützte Pfade; z. B. ENOENT/EACCES/ENETUNREACH/EROFS) im Worker-Report, lokal und auf einem GitHub-hosted Runner einer separat autorisierten Testfläche; Verifierentscheid und Supervisorzustand bleiben unverändert. EXECUTION_SANDBOX nur, wenn die Sandbox-Voraussetzung vor Workerstart fehlt, ein Zugriff gelingt oder die Probe nicht auswertbar ist. Ohne Docker ist B nicht abnahmefähig.“
OLD (AV-123..125 Erwartung): „| EXECUTION_SANDBOX |“
NEW: „| Isolationsprobe: Denial gemessen, Entscheid unverändert |“
Repair 7b — Contract: A · Section: Acceptance (A Z. 68) / PKG §2 Z. 83
OLD (A Z. 68, Teil): „Prozessgruppen tatsächlich terminieren.“
NEW: „Prozessgruppen tatsächlich terminieren; setsid-Nachfahren werden von A ausdrücklich nicht garantiert, sondern durch cgroup-/Container-Lifecycle (B Worker, C Image/Workflow) und die Deploymentabnahme erfasst.“
Repair 7c — FBR Z. 216 und Z. 131 (Owner-Planungsdatei)
OLD (Z. 216): „Dazu die 29 Offline-Sicherheitstests (Live Drill) grün“
NEW: „Dazu die B/C-Isolations-Abnahmeprobes (AV-123..125, gemessene Denials) und ein Isolations-Probe-PR auf der Testfläche grün; die 29 Drill-Selbsttests sind nur Harness-Nachweis.“ (Z. 131 analog: „die 29 Offline-Sicherheitstests“ → „die B/C-Isolations-Abnahmeprobes“.)
Evidence: CERT F03/F10, CA-031; DRILL `validation/offline-safety-results.json` („These tests do not establish GitHub server behavior“).
Blocking reason: Blockiert B-Abnahme und Produktivaktivierung, nicht die Architekturreview von A.

#### Blocker 8 — R3-Bypass / Drill-PASS-Semantik → Wortlautkonflikt FRZ/PM + R2-Template-Fehler; A/B/C sagen nichts über R3

Befund: Owner-only-Merge funktioniert im 7-Ruleset-Modell nur über den R3-PR-Bypass (EXP Z. 522–524; DRILL Z. 19 „R1 und R2 sind bypassfrei. R3 gewährt nur Owner-PR-Bypass.“). FRZ Z. 162 sagt „in keiner Bypass-Liste“, PM Z. 258/261 macht „No protection bypass required“ zum PASS-Kriterium; damit ist der Drill-Exit „dauerhaft STOP-BYPASS-LITERAL“ (PM Z. 261). Zusätzlich erlaubt das R2-Template `merge, squash, rebase` (PM B2). In A/B/C heißt die Plattformseite H1–H3; ein Drill-PASS ist dort „exit 0 nur durch trusted Supervisor nach vollständigem Final-Recheck“ mit `policyAssurance="owner_attested"` und beweist nie die Live-Wirksamkeit von Rulesets/Bypass (PKG Z. 257, 308).

Repair 8a — DRILL-Templates `api-templates/candidate-rulesets/R2.json` und `drill-rulesets/R2.json`
OLD: `"allowed_merge_methods": [ "merge", "squash", "rebase" ]`
NEW: `"allowed_merge_methods": [ "merge" ]` plus je ein DENY-Fall für squash und rebase im Drill-Inventar.
Repair 8b — FRZ §2 Entscheidung (b), Z. 162 (Leitreferenz, Wortlaut)
OLD: „`Wuerfelduell` ist Org Owner und Repo Admin, einziger `human` in `forge/policy.json`, in keiner Bypass-Liste.“
NEW: „`Wuerfelduell` ist Org Owner und Repo Admin, einziger `human` in `forge/policy.json`; Bypass ausschließlich in R3 (`forge-main-owner-merge`, User 315180734, bypass_mode `pull_request`) und R5; R1/R2/R4-Scope/R6/R7 und die Actions Execution Policy sind für ihn bypassfrei.“ (FRZ Z. 1045 „Organization admin Always“-Bypass gilt als superseded.)
Repair 8c — PM §9 PASS-Kriterium (PM Z. 258)
OLD: „No protection bypass required“
NEW: „Kein Bypass von R1/R2/R6/R7/AEP/Scope; die geplante R3-PR-only-Owner-Autorisierung wird benutzt, pro Merge protokolliert (merge_method=merge, bypass_rules=true) und ist kein STOP.“ (STOP-BYPASS-LITERAL, PM Z. 261, entfällt.)
Repair 8d — Contract: C · Section: Acceptance (optional, klärend)
OLD: (absence; Kriterien verstreut in PKG §17 Punkt 7 und C Z. 75)
NEW: „Drill-PASS ist genau: (1) Attempt 1 forge-verify rot wegen REVIEW_MISSING, (2) Mutant return n KILLED, (3) Equivalent-Mutant-Negativfixture ergibt MUTANT_SURVIVED, (4) nach Owner-COMMENT und Re-run all jobs forge-verify exit 0 mit policyAssurance=owner_attested. Ein Drill-PASS ist kein Nachweis der Ruleset-/Bypass-/Execution-Policy-Wirksamkeit; diese belegt ausschließlich der isolierte Ruleset Live Drill.“
Blocking reason: Mit wörtlichem „kein Bypass“ kann der erste Drill nie bestehen; mit squash/rebase erlaubt würde R2 eine falsche Merge-Methode nicht stoppen und `C = M^2` (FRZ) brechen. Entscheidung **D4**.

### A.3 Weitere CERT-Punkte (F05, F06, F07, F09)

- **F05 (NONBLOCKING, Integrationsgrenze)** — Contract A „Ergebnis“, anhängen: „bootstrap.py enthält einen eigenen festen Minimaltransport für genau die vier GETs aus §2 Schritt 2 (feste URLs, ohne Authorization, ohne Redirect, Limits aus §2); A importiert kein C-Modul. C github.py darf diesen Transport wrappen, nicht ersetzen oder verändern.“ Contract B „Acceptance“, anhängen: „Die Worker-Acceptance nutzt ein extern digest-gepinntes harmloses Acceptance-Image als Testinput; es ist kein Produktionsimage und wird von C nicht ersetzt.“
- **F06 (NONBLOCKING)** — B Z. 86 OLD „… Keine erfundene Accepted-SHA einsetzen.“ NEW anhängen: „Nichtnull und Commit-Ancestry beweisen keine Taskannahme (P05); Policy v1 hat keine acceptedDependencies-Map. Autorität für die Annahme von A ist allein die dokumentierte externe unabhängige Owner-Abnahme; ohne sie bleiben B und C gesperrt.“ C analog für B.
- **F07 (NONBLOCKING)** — B Z. 86 OLD „kanonisch neu parsen und hashen.“ NEW „kanonisch neu parsen und hashen und contractVersion erhöhen.“
- **F09 (BLOCKING, C)** — PKG §13 OLD AV-170 „Re-run failed jobs verwendet Gate-Receipt von Attempt 1 | IDENTITY_RECHECK“ → NEW „Attempt ≥ 2 ohne frischen forge-gate-Job im selben Attempt (z. B. Re-run failed jobs) | IDENTITY_RECHECK“. OLD AV-172 „Fremder Workflow liefert gleichnamigen Check | POLICY_CHECKS“ und AV-173 „Alte grüne Checks sollen neue SHA freigeben | POLICY_CHECKS“ → NEW Erwartung „POLICY_DEPLOYMENT (Deployment-Abnahme im Owner-Live-Drill: Required Check an diesen Workflow/diese App gebunden; alte grüne Checks geben neue SHA nicht frei)“. Laufzeitgarantie-Satz siehe Blocker 2 NEW. Kein zusätzliches GET (Entscheidung **D3**, Teil c).
- **A-Kernel ohne Acceptance** (CERT `requirements.json` A-KERNEL `"acceptance": []`) — Contract A „Acceptance“, anhängen: „Image-Kernel lädt ausschließlich den geprüften BASE-Manifestgraphen: HEAD-main.py oder ein nicht im Manifest gelisteter Import → POLICY_INVALID; fehlender Manifest-Eintrag → POLICY_INVALID.“

### A.4 Urteil je Contract

| Contract | Urteil | Repairs |
|---|---|---|
| **FORGE-BOOTSTRAP-0001A** | **REPAIR REQUIRED** | Bindung r2 (A.1); Blocker 1 (PKG §2 + Acceptance); Blocker 3 (AV-004, AV-071, AV-009, AV-096); Blocker 4 (Mutantenregel, A1, A4, A5); Blocker 5a (AV-070b); Blocker 6a/6b; Blocker 7b; F05 (eigener GET-Transport); A-Kernel-Acceptance; contractVersion 2 |
| **FORGE-BOOTSTRAP-0001B** | **REPAIR REQUIRED** | Bindung r2; Blocker 1 (Report-Framing); Blocker 3 (AV-115a/b, AV-141); Blocker 4 (Regel, B1, B2, B3, B5); Blocker 7a (gemessene Denials); F05 (Acceptance-Image); F06/F07; acceptedCommit von A erst nach echter Annahme |
| **FORGE-BOOTSTRAP-0001C** | **REPAIR REQUIRED** | Bindung r2; Blocker 2 (Receipt-Digest, AV-155, C5); Blocker 3 (Schema, Blocking-Prädikat, Supersedes, AV-150/150b); Blocker 4 (Regel, C1, C3, C4); F09 (AV-170/172/173); Blocker 8d (Drill-PASS-Liste); acceptedCommit von B erst nach echter Annahme |

### A.5 Ist A nach diesen Repairs architecture-review-ready?

**Ja.** Begründung:
- Nach den A-Repairs bleibt kein A-Finding offen; F02, F04, F09 betreffen nur C. CERT §16: „Architektur Git/Pfade/History tragfähig“; CERT §17: „Als Draft Gegenstand eines Reviews: ja.“
- A braucht logisch nichts von B/C (CERT §12: „Keine zwingende logische oder Hash-Selbstreferenz“), sofern A den eigenen GET-Transport hat (F05), gegen einen generierten BASE-Stub außerhalb des Repos getestet wird (A Z. 64) und keinen Produktions-Image-Digest voraussetzt (Digest und Rezept gehören C).

Bedingungen (alle in der Queue verankert): (a) Paket r2 mit neuem Sectionhash, A bindet ihn; (b) neuer A-contentHash, kanonisch geparst, baseCommit gegen aktuelles `main`; (c) die Bootstrap-Abnahme bleibt externer Initial-Trust („der neue Verifier darf seine eigene Entstehung nicht rückwirkend zertifizieren“, A Z. 52); (d) **D1** ist entschieden, sonst wäre A nach V01R/V2PF-Regeln „Freeze-policy-invalid“ (requiredChecks `forge-v01:*`, >400 LOC, Format 1).

### A.6 CORE-0002 wird nicht still vorgezogen

- CORE-0002 ist ein Format-1-Dokument, das Format 2 einführt; `dependencies: []`; verlangt vorher FORGE-OPS-0001 und unabhängige Architekturreview (CORE-0002 Z. 50/60: „conveys no approval or permission to implement“).
- **Ziehen es vor:** FRZ §16 (Task [3] parallel zu VERIFIER-0001), Bootstrap Contract Plan Q10–Q12, CORE-0002 Z. 50 („Implement Architecture Freeze task [3]“), und implizit V2PF Z. 9/409 („new tasks use Format 2“ – würde vor A Format-2-Support verlangen). **Ziehen es nicht vor:** PKG §16 („Keine Core-Änderung und kein erfundener Format-2-Block“), CERT, ROQ, REF, PM, FBR Z. 90 („**nicht** im Bootstrap-DAG“).
- **Entscheidung (D1):** A/B/C (und der Drill-Contract) sind der Format-1-Bootstrap; „new tasks use Format 2“ gilt ab BASE = BOOTSTRAPPED.
- **Neuer Konflikt nach BOOTSTRAPPED:** CORE-0002 ändert 7 Dateien unter `src/forge/**` und 13 bestehende Testdateien; beides ist im A/B/C-Policyprofil DEV und OWNER_OPS geschützt (PKG ~Z. 131), und seine requiredChecks (`npm run typecheck`, `npm test`) sind keine `forge-v01:*`-Registryschlüssel. Ohne Policy-Revision würde der gerade gebaute Verifier CORE-0002 korrekt ablehnen. Zusätzlich ändert CORE-0002 genau die Parsermodule (`contract-document.ts`, `primitives.ts`), die A/B/C als BASE-Parser pinnen. Daraus folgt Entscheidung **D7** und die Queue-Position P4.0 (nach Drill-Exit, nicht dazwischen).

---

## B. MYSTERY

### B.0 Grundbefunde

1. **FV-Fehler F01:** FV §2 Z. 29 „0001 | Kein Volltext … NOT AVAILABLE — BLOCKING“. MYST-0001 lag auf `forge/owner/audits/MYST-0001-PLAYERREF` (Commit `a256e517`, 09:07:02Z), FV wurde um 09:19:04Z committet. Consolidation Plan und FR führten den Hash `f4d31858…` bereits. Die Bytes stimmen (fcv2 `f4d31858…`). Goldens unabhängig reproduziert: V-01 Preimage `ebf23c7f…`, V-01…V-05 `pr1_xfs3rzypnyradx49`, `pr1_zmkgz9c35yhk1qa3`, `pr1_znh7e2dfbmaffz8n`, `pr1_yyqw0dn6dan7mbdt`, `pr1_44rh5ek8sxdz4w97`; aus V-10 `evidence:muddy-path` → `pr1_4f7xab53w32bm1nq`, `person:anna` → `pr1_an69m26v8wh36rry`.
2. **Keine späteren Lösungen:** Alle nach 09:19Z committeten Mystery-Artefakte sind byte-identisch mit FV-Quellen oder inhaltlich älter: Solvability-Repair (14:14Z) hat Inhaltsdatum 03.10. (`observedAtUTC 2026-10-03T20:34:25Z`), SOL-Hash `06b0e5f2…` = FV-Register; Authoring Stress (14:40Z) PDF `a1583b41…` = FV „AUTHOR“; Scale `667ded6e…` = FV „SCALE“; VS-5 und Vertical-Slice-Preflight sind Scratch-Ergebnisse ohne Vertragsdokument.
3. **Belegpflicht-Ownership ist auf Contract-Ebene geklärt:** M2 §7a (Core nicht zuständig für Beweis), CH §2, SA §6 Z. 273 („Challenge-Result solved ist die einzige technische Siegbedingung im V1-Sessionloop … Kein Nachweiszwang“). Belegbarkeit gehört der Fallabnahme (SOL-Zertifizierung + optional Blindtest), nicht einem Runtime-Gate. Offen ist nur der Vitrine-Konflikt F04.

### B.1 Die 11 blockierenden Findings + verlangte Themen

| # | Finding / Thema | Klassifikation |
|---|---|---|
| F01 | PlayerRef-Grenze (MYST-0001) | **RESOLVED BY EXISTING CONTRACT** (M1 vollständig) + **SMALL CONTRACT REPAIR** (Einbindung SA/SB/SC, Pins M4/M5B) |
| – | PlayerRef-Salt-Bindung | **RESOLVED BY EXISTING CONTRACT** (truthHash, keine Rückkante) + ein Satz in SA (Teil F01-Repair) |
| F02 | Release → Proof / Public-Rule / Witness-Adapter | **NEW REVISION REQUIRED** (SA-Revision mit normativem Adapteranhang) |
| F03 | Package-Bindung öffentlicher Inhalte | **SMALL CONTRACT REPAIR** (SA additiv: `publicContent`) |
| F04 | Vitrine-Belegpflicht vs Session V1 | Owner-Entscheidung **D8**; bei Empfehlung **SMALL CONTRACT REPAIR** (nur Falldaten/Brief, SA-Statuszeile) |
| F05 | Challenge Required-only-Konflikt | **SMALL CONTRACT REPAIR** (M2 §15 + CH §6 Rollenzeile) |
| F06 | ask vs interrogate | **SMALL CONTRACT REPAIR** (M5B §6) |
| F07 | Ref-Port / Known-Übersetzung | **SMALL CONTRACT REPAIR** (SA-Typ + SB §5) |
| F08 | M2 no-throw-Umfang | **SMALL CONTRACT REPAIR** (M2 §5.1, AC-05/06) |
| F09 | Quadratische Prefixarbeit (+ Scale) | **SMALL CONTRACT REPAIR** (SA:183, :179, :265, :139) |
| F10 | Public-Load-Fehler-Allowlist | **SMALL CONTRACT REPAIR** (SC §8) |
| F11 | Vitrine-Zertifizierungskette | **STILL BLOCKING für den Vitrine-Release (P5)**, nicht für den Contract-Freeze (Begründung B.13) |
| – | NPC-Snapshot-Identität | **RESOLVED BY EXISTING CONTRACT** (SA:154/155) |
| – | presentation-vs-semantic identity | **RESOLVED BY EXISTING CONTRACT** (SA bindet Text; FR OD-4 = Nein) |
| – | evidence requirement ownership | **RESOLVED BY EXISTING CONTRACT** (kein Runtime-Gate) |
| – | session/replay dependencies | **RESOLVED BY EXISTING CONTRACT** (DAG azyklisch) |
| F12 | Ein-Owner-Regel Session-Text + CH-Pin (nonblocking) | **SMALL CONTRACT REPAIR** |

### B.2 F01 — PlayerRef-Grenze

M1 liefert alle von FV verlangten Elemente: Namespace `"forge-mystery-playerref-v1"` (D3.1, Z. 159), Preimage aus sechs LF-verbundenen Feldern `PROFILE, refSalt, caseId, truthHash, kind, id` (Z. 159), Encoding SHA-256 → 10 Byte → Crockford-Base32 klein, `pr1_` + 16 Zeichen (Z. 160–165), Config `refSalt` 32 Hex klein, Null-Salt verboten (D2 Z. 153), `resolvePlayerRef` mit konstantem `REF_UNRESOLVED` (D5 Z. 175), `REF_COLLISION` (D4 Z. 169), Goldens V-01…V-05, V-10 (Z. 279–310). Pattern, Arten und Translator stimmen mit M4/M5B/SA überein. Abweichungen nur in der Einbindung:

Contract: MYST-SESSION-0001A (gleicher Text SB Z. 42, SC Z. 45) · Section: Startgate-Absatz (SA Z. 73)
OLD: „MYST-0001 ist ein nur sekundär belegter Taskname; vollständigen Contract/Ref-Adapter und Namespace vor Start prüfen.“
NEW: „MYST-0001 ist `MYST-0001-PLAYERREF-V1.contract.DRAFT.md` (Format 2, contentHash `forge-contract-v2` `f4d3185898015901fad3155fdc37836652c486b028b30528ca4beb17f3726335`). Der Ref-Adapter ist in §2 (PackageRefSource) festgelegt.“

Contract: SA (SB Z. 69–75, SC Z. 72–78) · Section: §2 PackageRefSource (SA Z. 100–106)
OLD: „`// NEW trusted boundary contract, not an asserted MYST-0001 export:` … `config:{profile:string; saltHex:string}; // exact profile name; 32 lowercase hex` … `resolve(ref:string):EntityRef|null;`“
NEW: „`// Trusted Adapter um MYST-0001 v1; keine eigene Ref-Ableitung:` … `config:{profile:"forge-mystery-playerref-v1"; saltHex:string}; // saltHex = exakt der an buildPlayerRefIndex übergebene refSalt` … `resolve(ref:string):ResolvedEntity|null; // MYST-0001-Typ, gebrandete IDs`“

Contract: SA (SB Z. 78, SC Z. 81) · Section: §2 (SA Z. 109)
OLD: „PackageRefSource ist ein synchroner vertrauenswürdiger Adapter um den tatsächlichen PlayerRefIndex. Vor Produktionsstart muss seine Konstruktion gegen den vollständigen, akzeptierten PlayerRef-Contract festgelegt werden. Dieses Lab definiert absichtlich keinen alternativen Hash-Algorithmus. Ein gültiges syntaktisches Token beweist keine Autorisierung.“
NEW: „PackageRefSource ist ein synchroner vertrauenswürdiger Adapter um den PlayerRefIndex aus MYST-0001. Konstruktion: Der Host parst die Truth mit `parseCaseTruth` und ruft dann `buildPlayerRefIndex(truth, refSalt)` auf. `REF_SALT_INVALID` ergibt ein Paket-Finding `SHAPE`, `REF_COLLISION` ein Paket-Finding `REF_MAPPING`; in beiden Fällen entsteht kein Package, Kollisionsdetails gehen nur in den Autorenlog. Bei Erfolg gilt: `caseId = index.caseId`, `truthHash = index.truthHash`, `config = {profile: index.profile, saltHex: refSalt}`, `refFor = (k, id) => playerRefFor(index, k, id)`, `resolve = r => { const x = resolvePlayerRef(index, r); return x.success ? {kind: x.kind, id: x.id} : null; }`. Der Salt ist Autoreneingabe des Falls (MYST-0001 D2), wird vom trusted Packageprovider neben dem Packageinput geliefert und erscheint nie in Event, Save oder Public DTO. Die Session rotiert keinen Salt: Refs ändern sich genau dann, wenn refSalt, caseId oder truthHash sich ändern (MYST-0001 AC-06/AC-07); ein neuer Salt ist eine Autorenentscheidung und ergibt über refsHash ein neues Package (A36). Ein gültiges syntaktisches Token beweist keine Autorisierung.“

Contract: MYST-0004 (Z. 75, 264), MYST-0005B (Z. 73, 78, 192) · Section: Ref-Verweise
OLD: „— wörtlich MYST-0001-Entwurf D3.“
NEW: „— wörtlich MYST-0001 v1 D3 (`MYST-0001-PLAYERREF-V1.contract.DRAFT.md`, contentHash `forge-contract-v2` `f4d31858…`).“
Evidence: M1 Z. 149–310; Consolidation Plan §1; FR §1/§13; Goldens reproduziert.
Blocking reason (für Einbindung): Name `refSalt`/`saltHex`, Rückgabeshape und gebrandete IDs weichen ab; ohne Festlegung entstehen zwei Adapter.

### B.3 PlayerRef-Salt-Bindung

**RESOLVED BY EXISTING CONTRACT.** Preimage enthält `truthHash`, nirgends `packageHash` (M1 Z. 159, AC-07 Z. 261). Kette: truthHash → Refs → refsHash (SA Z. 158) → releaseContextHash → packageHash; azyklisch. Salt-Wechsel bei gleichem Mapping ändert das Package (SA A36/A37). Rotation braucht keine Policy, weil Saves exakt an ein Package gebunden sind (SA §9). Herkunft: SA hat kein Saltfeld in `CasePackageInput` (Z. 112–119), der Salt kommt über den trusted Port (Z. 358). FR §7/§21 („refSalt im Paketdokument“) sind damit überholt. Einziger Repair: der Satz im SA-NEW aus B.2.

### B.4 F02 — Release → Proof: NEW REVISION REQUIRED

OLD-Belege: SA Z. 160 („certificateData ist bounded authoring JSON, KEINE ausführbare Runtime-Policy“), SA Z. 174 („UNKNOWN/BLOCKER: Der aktuelle Draft liefert keinen vollständigen standardisierten Zertifikats-/Public-Rule-Präsentationsadapter“), SA Z. 185, SOL Z. 50 („Der echte Release-/Replay-Adapter existiert heute ebenfalls nicht“), SOL Z. 116, 120. Einzige Konkretisierung: CERT-V `factivity-bridge.REPAIR-CANDIDATE.json`, ausdrücklich „LAB ADAPTER PROPOSAL“. FR §5 (Premise-Keys `seen/reported/answered`) ist durch SOL überholt und darf nicht als Adapter gelten; FR PR-2 („Folgerung ist Autorenbehauptung“) widerspricht SOL Z. 147 („`license` muss Observationnode zu PUBLIC_RULE sein“).

Was in M4/M5B existiert und genügt (keine Änderung an M4/M5A/M5B): M4 `EvidenceObservation` (Refs → ENTITY_AWARENESS), M4 `PlayerReport` (nur mit authored Faktizitätslizenz → OBSERVED), M5B `InterrogationObservation` mit `affirms/denies` (→ REPORTED_BY_NPC). Was fehlt: certificateData-Typ, Step-ID → SessionEvent, explizite Claim→Literal-Tabelle ohne First-Match, Ausschluss von `leans_*`/`uncertain`/`does_not_know`/`decline`, Testimony-Fall, PUBLIC_RULE-DTO + Receipt + Eligibility, Regel „nur replayte Payloads zählen“.

Warum NEW REVISION statt Kleinpatch: neuer normativer Datentyp in SA §2 mit Abnahmefällen; FV lehnt ausdrücklich ab, einen fertig entworfenen Anhang zu behaupten. **Er wird hier nicht als gewählter Text ausgegeben.** Festgelegt wird nur der Rahmen, der keine neue Architektur ist, sondern SA Z. 172 + SOL §4/§6 formalisiert:

Contract: MYST-SESSION-0001A · Section: §2 (SA Z. 174)
OLD: „UNKNOWN/BLOCKER: Der aktuelle Draft liefert keinen vollständigen standardisierten Zertifikats-/Public-Rule-Präsentationsadapter. Dieses Lab erfindet ihn nicht als vorhandene API. …“
NEW (Revision SA v2, Rahmen; Volltext wird in P4.1 geschrieben und reviewt): „Release→Proof-Adapter `forge-release-proof-v1` ist normativer Anhang dieses Contracts (Owner: SA §2, Runner in der Fallabnahme, kein vierter Session-Task). `adapterVersion` muss `"forge-release-proof-v1"` sein. certificateData ist exakt typisiert: geordnete `steps` {stepId, event:SessionEvent} (jede ID aus profile.witnessStepIds genau einmal) und `observations` der vier SOL-Arten OBSERVED (nur aus genau einem replayten Evidence-Report mit bytegleichem C-Payload und gebundener `licenseRuleId` aus `publicContent.publicRules`), REPORTED_BY_NPC (nur affirms/denies mit bytegleichem claim; literal.value === (stance==="affirms")), ENTITY_AWARENESS, PUBLIC_RULE (released erst nach allen `afterObservations` im selben Replay, keine Selbstlizenz). leans_affirms, leans_denies, uncertain, does_not_know und decline erzeugen keine Observation; ein Eintrag dafür ist Parsefehler. Literale sind explizit authored; mehrdeutige Aliase sind Parsefehler, First-Match verboten. Der Runner gibt ausschließlich aus dem Replay abgeleitete ReleasedObservations zurück; profile.observations dient nur dem Vergleich. Änderung an certificateData oder adapterVersion invalidiert Package und Save.“
Evidence: FV F02, Angriffe #11–13, #15, #18; SA Z. 160/172/174/185; SOL Z. 50/116/120/136/147; CERT-V R2.
Blocking reason: Ohne Adapter gibt es keinen eindeutigen Producer von ReleasedObservation (FV C2) und keinen current-contract Witness. Owner-Zuordnung = Entscheidung **D9**.

### B.5 F03 — Package-Bindung öffentlicher Inhalte: SMALL CONTRACT REPAIR

Contract: SA (SB Z. 81–88, SC Z. 84–91) · Section: §2 CasePackageInput (SA Z. 112–119)
OLD: „`initial:InitialSetup; challenge:unknown;`“
NEW: „`initial:InitialSetup; challenge:unknown; publicContent:unknown; // strict PublicContent`“
Contract: SA · Section: §2 ResolvedCasePackage (SA Z. 127) — einfügen: „`publicContent:PublicContent;`“
Contract: SA · Section: §2 nach SA Z. 139 — neuer Absatz:
OLD: (absence)
NEW: „PublicContent = {schemaVersion:1; title:string; brief:string; challengeQuestion:string; labels:readonly {entity:EntityRef; label:string; role:string|null}[]; questionTexts:readonly {npc:string; questionId:string; text:string}[]; publicRules:readonly {id:string; text:string}[]}. Strikt, keine Zusatzfelder. Texte ≤1000 UTF-16, brief ≤4000, ohne Normalisierung. labels: jede Entity höchstens einmal, existierend. questionTexts: genau ein Text je (NPC-Profil, Katalogfrage). publicRules-IDs eindeutig. PublicContent ist alleiniger Owner aller spielerlesbaren Fall-, Frage-, Regel-, Label- und Brieftexte. Spielerausgaben verwenden ausschließlich PublicContent plus Known; ein Label einer nicht bekannten Entity wird nie ausgegeben. Kein Roster und kein Briefing aus Truth.“
Contract: SA · Section: §2 Komponententabelle (nach SA Z. 157) — neue Zeile: „| publicContentHash | NEW H("forge-session-public-content-v1", publicContent mit labels nach kind/id, questionTexts nach npc/questionId, publicRules nach id sortiert) |“
Contract: SA · Section: §2 releaseContextHash (SA Z. 159)
OLD: „…initialHash,refsHash,challengeHash}) |“
NEW: „…initialHash,refsHash,challengeHash,publicContentHash}) |“
Contract: SA · Section: §9 Invalidierungstabelle — neue Zeile: „| PublicContent (Brief, Label, Fragetext, Regeltext, Challengefrage), auch ein Zeichen | invalidieren |“; neue Abnahmefälle A41 („questionText um ein Zeichen geändert → packageHash ändert“), C41 („alter Save gegen Package mit geändertem publicRules-Text → INCOMPATIBLE_PACKAGE“); 120er-Matrix entsprechend revidieren.
Evidence: FV F03, Angriffe #37, #39, #40; VIT `case-host.design.json` Z. 71ff/114/229/311/321/330 (ungebunden); INFO-Probe „hidden-person-in-initial-brief“ (Leak reproduziert).
Blocking reason: Gleiche Packageidentität mit bedeutungsänderndem Frage-/Regeltext wäre möglich; Startbrief-Leak. Additiv, keine neue Architektur (neue Komponente in bestehender Hashstruktur). FR OD-7 („Namen, Labels, Briefing außerhalb der Identität“) ist damit mit **Nein** beantwortet.

### B.6 F04 — Vitrine-Belegpflicht vs Session V1

OLD-Belege: VIT `case-host.design.json` Z. 108 `"requireReleasedProof": true`; VIT §15 `{ type: "accuse"; actor: PlayerRef; evidenceRefs: readonly PlayerRef[] }`; BRIEF Z. 6 „Zitiere unabhängige entdeckte Nachweise, die deine Entscheidung tragen. not_solved verrät nicht, ob die Person falsch ist oder die Nachweise unzureichend sind.“; SA Z. 273 „Kein Nachweiszwang“; SA Z. 275 „CASE-SPECIFIC CHANGE REQUIRED … Empfehlung für den minimalen Slice: Belege zum Deduzieren anbieten, aber diese zusätzliche technische Siegsperre entfernen“; CERT-V §14 (richtige Antwort in allen 192 Zuständen solved, in 176 davon ohne vollständigen Proof; ohne Belegpflicht höchstens 4 One-hot-Versuche).

Owner-Entscheidung **D8**. Bei Empfehlung (Session V1 gilt, Belegpflicht entfällt) sind die Repairs klein und betreffen nur Fallartefakte plus eine SA-Statuszeile:
- VIT `case-host.design.json` Z. 108 OLD `"requireReleasedProof": true` → NEW Feld entfernt; Command ist SB `accuse{literals}`.
- VIT Headless Spec §14 OLD „Öffentlicher Command: genau eine bekannte Person aus dem Vier-Personen-Kreis plus 0–8 verschiedene, bereits entdeckte EvidenceRefs. …“ → NEW „Öffentliche Antwort: genau eine bekannte Person aus dem Vier-Personen-Kreis. Die UI expandiert sie deterministisch in vier direct_actor-Literale (eine true, drei false) gemäß SB `accuse{literals}`. solved ⇔ Challenge-Wrapper solved. Belege sind Deduktionshilfe, keine Siegbedingung.“
- BRIEF Z. 4 OLD „…und belege deine Entscheidung mit unabhängigen Nachweisen.“ → NEW „…und finde heraus, wer die Medaille eigenhändig entnommen hat.“
- BRIEF Z. 6 OLD (oben) → NEW „Untersuche die Nachweise und wähle den eigenhändigen Entnehmer. Die vollständige richtige Antwort schließt den Fall ab. not_solved verrät nicht, welche Person stattdessen richtig wäre.“
- BRIEF Z. 27 OLD „…und eine belegte Anklage abgeben.“ → NEW „…und eine Anklage abgeben.“
- SA Z. 275 (alle drei Kopien) OLD „CASE-SPECIFIC CHANGE REQUIRED: …“ → NEW „ENTSCHIEDEN: Die Vitrine verwendet keine Belegpflicht. Die Personenwahl wird von der UI deterministisch in vier direct_actor-Literale expandiert; das ist eine UI-Konvention, keine Session-Aktion.“
Alternative (Belegpflicht bleibt) = NEW REVISION von SB + eigener Challenge-Policy-Contract (SA Z. 275); widerspricht SA Z. 273 und FV §10; nicht empfohlen.

### B.7 F05 — Challenge Required-only-Konflikt: SMALL CONTRACT REPAIR (M2 §15 + CH §6)

Welche Seite: **M2 §15** wird repariert. Gründe: M2 §15 delegiert selbst an den Folgetask („entscheidet der Folgetask“); CH ist Owner der Challenge-Definition; die CH-Erlaubnis ist experimentell belegt (Exactness §6: vorab gewählte Ja/Nein-Frage hat in true- und false-Welt denselben Scope); die frühere FR-Entscheidung „M2 KEEP“ fiel ohne CH-Text (`BLOCKED_BY_MISSING_ARTIFACT`) und ist überholt. Keine AC, kein Mutant und keine Core-Semantik von M2 ändern sich.

Contract: MYST-0002 FINAL-CANDIDATE · Section: §15 (Z. 445)
OLD: „- `allowedClaims` enthält Claims ohne Polarität, nie eine Required-only-Whitelist (sie würde die Lösung als Frage veröffentlichen). Jeder Pflicht-Claim muss in `allowedClaims` liegen (Authoring-Invariante); ob alle `allowedClaims` determiniert sein müssen, entscheidet der Folgetask bzw. Solvability.“
NEW: „- `allowedClaims` enthält Claims ohne Gewinnpolarität. Verboten ist ein Scope, der aus geheimen Required-Zielen, Assignments oder Statuswerten ausgewählt wird (er würde die Lösung als Frage veröffentlichen). Gleichheit mit den Required-Claim-Keys ist zulässig, wenn die gefragten Claim-Dimensionen vor der Antwortwahl öffentlich und antwortunabhängig festgelegt sind; die Publication-Prüfung legt MYST-CHALLENGE-0001 §6 fest. Jeder Pflicht-Claim muss in `allowedClaims` liegen (Authoring-Invariante); ob alle `allowedClaims` determiniert sein müssen, entscheidet der Folgetask bzw. Solvability.“
Contract: MYST-CHALLENGE-0001 · Section: §6 Tabellenzeile „Rollenfrage“ (CH Z. 121)
OLD: „| Rollenfrage | Für jeden öffentlich gewählten Kandidaten alle drei Rollen-Claims anbieten. Nicht nur bekannte/wahre Rollen oder Personen aus geheimen Assignments auswählen. Bekannte Rollenliste ist geschlossen; roles:null bleibt U. „Alle Rollen“ ist bei null nicht als bestimmte Abschlussantwort veröffentlichbar. |“
NEW: „| Rollenfrage (offen: „welche Rolle hatte wer?“) | Für jeden öffentlich gewählten Kandidaten alle drei Rollen-Claims anbieten. Nicht nur bekannte/wahre Rollen oder Personen aus geheimen Assignments auswählen. Bekannte Rollenliste ist geschlossen; roles:null bleibt U. „Alle Rollen“ ist bei null nicht als bestimmte Abschlussantwort veröffentlichbar. Eine vorab öffentlich festgelegte einzelne Rolle (z. B. nur `direct_actor`) ist eine `required_literals`-Frage: genau diese Rolle für alle öffentlichen Kandidaten anbieten. |“
Evidence: FV F05, Angriffe #25/#26; CH Z. 120, 155 (P21); Exactness-Report §6, L04.
Blocking reason: Zwei normative Texte geben für dieselbe Vitrine-Frage gegensätzliche Antworten. Fallseitig (Teil F11): Vitrine deklariert `required_literals` mit `direct_actor` für vier Kandidaten (bereits so im Proof Profile).

### B.8 F06 — ask vs interrogate: SMALL CONTRACT REPAIR

Contract: MYST-0005B · Section: §6 (Z. 260), erster Satz
OLD: „Persistiert wird ausschließlich `{ type: "ask", npc: PlayerRef, questionId }`.“
NEW: „Persistiert wird ausschließlich das in MYST-SESSION-0001B §4 definierte akzeptierte Event `{ type: "interrogate", npc: PlayerRef, questionId }`; `ask` ist kein V1-Eventname und kein Alias.“
Evidence: SB Z. 195 (`{type:"interrogate";npc:string;questionId:string}`), SA-Goldens Z. 386/394; M5B §10 („keine Persistenz“). Owner des Eventvokabulars ist SB.
Blocking reason: Zwei Eventnamen für dieselbe persistierte Aktion brechen Replay-Kompatibilität.

### B.9 F07 — Ref-Port / Known-Übersetzung: SMALL CONTRACT REPAIR

Contract: SA (SB Z. 98–99, SC Z. 101–102) · Section: §2 ResolvedCasePackage.refs (SA Z. 129–130)
OLD: „`refs: {refFor(kind:EntityRef["kind"],id:string):string|null;` / `resolve(ref:string):EntityRef|null};`“
NEW: „`refs: {caseId:string; truthHash:string; // = source.caseId/truthHash, beim Resolve gegen Truth geprüft` / `refFor(kind:EntityRef["kind"],id:string):string|null;` / `resolve(ref:string):ResolvedEntity|null}; // strukturell PlayerRefTranslator (MYST-0004 §5.1, MYST-0005B §5.1)`“
Contract: SB (SA Z. 263, SC Z. 235) · Section: §5 interrogate (SB Z. 232)
OLD: „interrogate: NPC muss als person bekannt und mit Snapshot/Profil im Package vorhanden sein. Snapshot/Profil auswählen; catalogue, refs, prefix-known, questionId an interrogate übergeben. QUESTION_NOT_AVAILABLE wird ACTION_UNAVAILABLE; …“
NEW: „interrogate: `pkg.refs.resolve(npc)` muss `{kind:"person", id}` ergeben, und `npc` muss im Präfix-Known liegen; gebraucht wird der npcs-Eintrag mit `snapshot.npcId === id`, sonst ACTION_UNAVAILABLE. `known` = für jedes Präfix-`KnownEntity` `pkg.refs.resolve(k.ref)`; das Ergebnis darf nicht null sein und muss `k.kind` entsprechen, sonst HOST_FAILURE. Übergeben werden kanonische `EntityRef[]`, nicht `KnownEntity`. Aufruf: `interrogate({truth:pkg.truth, solution:pkg.solution, snapshot, catalogue:pkg.catalogue, profile, refs:pkg.refs, known, questionId})`. QUESTION_NOT_AVAILABLE wird ACTION_UNAVAILABLE; …(Rest unverändert)“
Contract: SB · Section: §5 investigate (SB Z. 230, Teilsatz)
OLD: „Für alle neuen IDs releaseEvidence aufrufen, deren Output validieren;“
NEW: „Für alle neuen IDs `releaseEvidence(pkg.presentation, id, pkg.refs)` aufrufen, deren Output validieren;“
Evidence: M4 Z. 241–245, 253; M5B Z. 206–207, 240; FV F07, Angriffe #35/#36.
Blocking reason: Consumer verlangen caseId/truthHash und kanonische gebrandete Refs; heutiger Typ liefert beides nicht.

### B.10 F08 — M2 no-throw-Umfang: SMALL CONTRACT REPAIR

Contract: MYST-0002 FINAL-CANDIDATE · Section: §5.1 (Z. 113), AC-05 (Z. 228), AC-06 (Z. 229)
OLD (Z. 113): „Die Funktion wirft für keine Eingabe vom Typ `unknown` als `claim` (bei korrekt geparster Truth und Solution).“
NEW: „Die Funktion wirft für keinen Plain-JSON-Wert als `claim` und für Objekte mit nicht werfenden Daten-Accessoren (AC-E5), jeweils bei korrekt geparster Truth und Solution. Werfende Accessoren, Proxies, Zyklen und fremde Prototypen sind keine unterstützte Eingabe. Der Parametertyp bleibt `unknown`, eine Sandbox wird nicht zugesagt.“
OLD (Z. 228, Teil): „…kein Throw für beliebige `unknown`-Claims (inkl. `null`, Array, String, Objekt mit Getter, Objekt mit Zusatzschlüssel).“
NEW: „…kein Throw für Plain-JSON-Claims (inkl. `null`, Array, String, Objekt mit Zusatzschlüssel) und für ein Objekt mit nicht werfendem Getter (AC-E5).“
OLD (Z. 229, Teil): „…`safeParse` wirft für keine Eingabe…“
NEW: „…`safeParse` wirft für keinen Plain-JSON-Wert…“
Evidence: FV F08; CROSS X107 (werfender Getter durchdringt safeParse); SA Z. 181 (Plain-JSON-Grenze). Enger als FV-Vorschlag: die nicht werfende Getter-Garantie (AC-E5) bleibt.
Blocking reason: Versprechen ist mit Zod nicht erfüllbar; Session konsumiert ohnehin nur selbst geparstes JSON.

### B.11 F09 + Scale — SMALL CONTRACT REPAIR (SA, gemeinsamer Text)

Contract: SA (SB Z. 152, SC Z. 155) · Section: §5 prospektive Savegröße (SA Z. 183)
OLD: „B prüft die prospektive Savegröße ohne Import von C: C({schemaVersion:1,packageIdentity:pkg.identity,events:prospectiveEvents,checksum:"0".repeat(64)}) in UTF-8. Alle echten Checksums sind genau 64 ASCIIzeichen; die Länge ist deshalb exakt. …“
NEW: „B prüft die prospektive Savegröße ohne Import von C über die exakte Bytelänge, nicht durch Vollserialisierung je Event: B0 = UTF8Length(C({schemaVersion:1,packageIdentity:pkg.identity,events:[],checksum:"0".repeat(64)})). Für n Events gilt B = B0 + Σ UTF8Length(C(event_i)) + max(0,n−1). Keine Rundung oder Approximation; ein abgelehntes Event ändert B nicht. Differential-Tests gegen die Vollserialisierung sind Pflicht; kein persistierter Cache-Owner. …(Rest unverändert)“
Contract: SA · Section: (SA Z. 179)
OLD: „Alle drei geben eine neue deeply frozen Kopie zurück, keine Mutation.“
NEW: „Normiert sind beobachtbare Unveränderlichkeit und unmutierte Caller-Inputs, nicht eine Vollkopie je Event. Frozen Subtrees dürfen geteilt werden. replaySession darf einen privaten Working-State nutzen, wenn Übergänge, Outputs, Limits und Fehlerpriorität exakt reduceSession entsprechen. Veröffentlichte Snapshots und der Endstate bleiben immutable.“
Contract: SB (SA Z. 265, SC Z. 237) · Section: §5 accuse (SB Z. 234)
OLD: „…parseAccusation({schemaVersion:1,caseId:pkg.truth.caseId,truthHash:hashCaseTruth(pkg.truth),literals},pkg.truth)…“
NEW: „…parseAccusation({schemaVersion:1,caseId:pkg.truth.caseId,truthHash:pkg.refs.truthHash,literals},pkg.truth)… (der beim Resolve gebundene unveränderliche Truth-Hash, einmal berechnet)“
Contract: SA · Section: §2 Resolver-Schritte (SA Z. 139)
OLD: „Resolver-Schritte: bounded JSON-like Input prüfen; Truth/Solution mit echten Parsern parsen; Semantic Validation …“
NEW: „Resolver-Schritte: Bytes/Tiefe/Knoten sowie Rohzählungen der Root-Collections (Entities 256, Evidence 64, NPCs 16, Fragen 128) vor jedem Zod-Parse und vor der Semantic Validation prüfen (LIMIT); dann Truth/Solution mit echten Parsern parsen; Semantic Validation …“ (A38 präzisiert: „LIMIT vor Domainparse“.)
Evidence: FV F09, Probe „literal-prospective-size-work“ (512 Events: 131.328 statt 512 Eventserialisierungen); SCALE-Report; SA Z. 368 („Hashes … einmal beim Package-Resolve“). Eventbudget bleibt 512 (SA §11 strenger als SCALE-Vorschlag 1000).
Blocking reason: Wörtlicher Contract erzwingt O(n²) gegen ein ausdrückliches Freeze-Kriterium (FV C7); Rehash je Anklage widerspricht SA Z. 368.

### B.12 F10 — Public-Load-Fehler: SMALL CONTRACT REPAIR (SC §8)

Contract: SC (SA Z. 307–310) · Section: §8 nach decodeSessionSave (SC Z. 282)
OLD: (absence; nächster Text SA Z. 292: „…eventIndex ist eine interne Diagnose und wird nicht mit privaten Codes öffentlich erklärt.“)
NEW: „decodeSessionSave und replaySession bleiben trusted Host-APIs. Die Player-Fassade gibt bei jeder nicht erfolgreichen Lade- oder Replay-Operation ausschließlich den konstanten Fehler `{ok:false;code:"SAVE_UNAVAILABLE"}` aus; sie gibt keinen eventIndex, keine Checksum, keine Package-Komponente, keine Zod-, ID- oder Proof-Diagnose aus. Detailcodes bleiben im privaten Hostlog. HOST_FAILURE wird nie zu not_solved.“ Neuer Abnahmefall C42: „jeder Decode-Fehlercode → öffentlich identisch SAVE_UNAVAILABLE“.
Evidence: FV F10, Angriff #49; INFO §13.
Blocking reason: Error-Noninterference-Grenze sonst offen.

### B.13 F11 — Vitrine-Zertifizierungskette: STILL BLOCKING (Vitrine-Release), nicht Contract-Freeze

Befund: CERT-V „NOT CERTIFIED für die aktuelle Vertragskette“; Profil trägt alten Scratch-`releaseHash 2eaf25cc…`; alter Host nutzt `card{title,observations[observed]}`, `ask`, Scratch-Refs (`case-scratch-playerref-v1`, Testsalt).
Reklassifizierung gegenüber FV (unabhängige Begründung): Ein current-contract Witness verlangt einen echten Reducer-Replay (FV F11 NEW: „Erst dieser Trace kann current-contract Witness sein“). Den Reducer gibt es erst nach Implementierung von SA/SB/SC; die Implementierung setzt den Contract-Freeze voraus. Den Witness zur Freeze-Bedingung zu machen, erzeugt einen Zyklus (Freeze → Implementierung → Witness → Freeze). F11 bleibt deshalb voll blockierend, aber als **Gate von P5 (Vitrine-Release)**. Für den Contract-Freeze genügt, dass die Kette normativ vollständig ist: F01 (Refs), F02 (Adapter), F03 (PublicContent), F04 (Siegbedingung), F05 (Fragetyp) und F06 (Event) — alle oben geschlossen bzw. als Repair gelistet.
Reihenfolge (verbindlich, P5): Contracts akzeptiert und gepinnt → Vitrine auf aktuelle Verträge umschreiben (M4 entries/mentions/reports, M5B-Observations, `interrogate`, `accuse{literals}`, echte M1-Refs mit paketgebundenem Salt, `publicContent`, Karten nach öffentlicher Ref sortiert, Aktionsabbildung search→investigate/search_location, read_record→investigate/examine_item, ask→interrogate) ohne neue Personen/Lösung/Hinweisquelle → Package auflösen, Proof Profile neu binden → `checkCaseSolvability` mit echtem Replay-Port PASS + Save/Load-Roundtrip → Zertifizierung → optional Blindtest. Eine Zertifizierung davor erzeugt nur Scratch-Evidenz.

### B.14 Weitere Themen (verlangt)

- **NPC-Snapshot-Identität — RESOLVED BY EXISTING CONTRACT.** SA Z. 154: „snapshotHash | NEW H("forge-npc-snapshot-v1", snapshot mit awareness/attitudes nach C sortiert); kompletter geparster Snapshot einschließlich revision, asOf, acquiredAt, provenance und Bindungen.“ SA Z. 155 npcBundleHash → releaseContextHash → packageHash. Gegen `main` geprüft: `npc-knowledge.ts` hat genau die Arrays `awareness`, `attitudes`. Abnahme A07/A08/A24/A25/C12. Vertical-Slice-Preflight E01 PASS belegt die Notwendigkeit. Owner = SA.
- **presentation-vs-semantic identity — RESOLVED BY EXISTING CONTRACT.** SA Z. 153 („presentationHash … Presentation.text vollständig enthalten“), §9 Z. 327 („Presentation.text, Leerzeichen, NFC/NFD … invalidieren“), Z. 336, Z. 338 (Lokalisierung nur per Identitätsrevision). FR §8 L-3 und OD-4 („Saves binden semantischen Fingerprint ohne Text“) sind damit mit **Nein** beantwortet.
- **evidence requirement ownership — RESOLVED BY EXISTING CONTRACT** (B.0 Punkt 3). Ergänzung CERT-6 aus FR §22 („keine Proof-Route ohne Premises ab Start“) ist nach SA §6 bewusst kein V1-Kriterium.
- **session/replay dependencies — RESOLVED BY EXISTING CONTRACT.** SA → M1, M2, M3, M4, M5A, M5B, CH, SOL; SB → SA; SC → SA, SB; SOL → M2; CH → M2. Azyklisch (FV §11, CROSS §13). SA nutzt SOL nur als Parser (FR §12 S-1 „keine Session→Solvability-Kante“ ist überholt). Alle `acceptedCommit:null` sind Start-Gate, kein Freeze-Blocker.
- **Vitrine certification chain** — siehe B.13.
- **VS-5 Preflight** — 123/123 PASS, `prototypeOnly:true`; weicht vom aktuellen Session-Vertrag ab (eingehende `seq`, P043 partial shotgun accepted, 1000 Events). Historische Evidenz; das VS-5-Vertragsdokument ist durch SA/SB/SC ersetzt (Teil von D9).

### B.15 F12 — Ein-Owner-Regel und CH-Pin (NONBLOCKING): SMALL CONTRACT REPAIR

Contract: SA (SB Z. 44, SC Z. 47) · Section: Kopfabsatz (SA Z. 75)
OLD: „Normativ sind die folgenden gemeinsamen Semantikabschnitte und die taskeigene Testmatrix.“
NEW: „Normativ sind die taskeigene Testmatrix und der eigene Owner-Teil der gemeinsamen Abschnitte: SA §§2–3 (Packageidentität, JSON-Profil, PlayerKnowledge, PublicContent, Release→Proof-Adapter), SB §§4–7 (Events, Reducer, Terminal, Replay, Session-Limits), SC §§8–9 (Savewire, Checksum, Decode, Compatibility, Save-Limits, öffentliche Load-Fehler). §§10–11 gelten gemeinsam, die Limits gehören jeweils dem Owner-Abschnitt. Gleichlautende Kopien in den anderen Dateien sind informativ; weichen sie ab, ist eine Revision nötig, es gibt keinen stillen Vorrang.“
Contract: MYST-CHALLENGE-0001 · Section: Design Dependency (CH Z. 43)
OLD: „Design Dependency: `MYST-0002-ACCUSATION-VERDICT-V1.contract.DRAFT.md`, Inhaltshash `sha256("forge-contract-v1\n" + exactText)` = `3758b20c5eef9ee9dbaa9b04660cc0d82de041da183326308e7d1f37868b027d`.“
NEW: „Design Dependency: `MYST-0002.contract.FINAL-CANDIDATE.md`, Inhaltshash `sha256("forge-contract-v1\n" + exactText)` = `e1eba9e1e248376f18774ee8899208c4a7a066e0cf5d5cc23973db4b3cf91e1c` (Rohbytes-SHA-256 `f8f72fa58115fec37b1994c551a697470fd29a87d627736a2060b85a8708b84c`). Gegenüber dem Vorgänger `3758b20c…` sind Wahrheitstabelle, API, Binding und Verdict-Formel unverändert; neu sind §7a/§15 (Core ≠ Challenge).“
Hinweis: FV nennt als neuen Pin den Rohhash `f8f72fa5…`; im CH-Satz muss der fcv1-Wert stehen, sonst passt der Pin nicht zur Formel im selben Satz. Nach dem F05/F08-Repair von M2 ändern sich beide Werte erneut; der Pin wird dann auf die reparierte Fassung gesetzt (P4.1).

### B.16 Format- und Registrierungsfolge (Mystery)

- M1 ist Format 2 und auf `main` nicht parsebar (`src/forge/contract-document.ts:26` `z.literal(1)`). FR §17 / OD-C6: alle MYST-Dokumente werden vor Registrierung nach Format 2 transkodiert (ohne Versionssprung).
- Daraus folgt: **Mystery-Registrierung setzt CORE-0002 voraus.** Das ist der einzige legitime Grund, CORE-0002 in die Queue zu nehmen, und er liegt nach BOOTSTRAPPED (P4.0).
- Single Lane (FRZ): ein offener Run-PR zugleich. „Wave 1 parallel“ heißt parallel **reviewbar**, nicht parallel laufend.

### B.17 Mystery-Verdict-Begründung

Nach den Repairs B.2–B.12, B.15 und der Entscheidung D8 sind alle elf FV-Freeze-Kriterien normativ erfüllbar: C1 (PublicContent, Adapter-Owner), C2 (eindeutiger Producer via Adapter), C3 (Ref-Port, Translator), C4 (Required-only, ask/interrogate, Belegpflicht entschieden), C5 (DAG), C6 (Startbrief nur aus PublicContent/Known, Load-Fehler konstant), C7 (lineare Größenprüfung), C8 (CH §6), C9 (SOL lokal PASS), C10 (Ref/Salt/Snapshot/PublicContent-Invalidierung), C11 (Pins). F02 ist die einzige größere Arbeit; sie ist eine benannte Revision mit festem Rahmen, kein offenes Design. Daher **FREEZE READY AFTER LISTED REPAIRS**, mit der Bedingung einer unabhängigen Freeze-Re-Verifikation (P4.2) nach Anwendung.

---

## C. SINGLE EXECUTION QUEUE

Eine Queue. Forge geht vor Mystery-Implementierung; Mystery-Contract-Repairs (reine Textarbeit, kein Code) laufen parallel zu Forge P1–P3, damit nichts wartet. **Keine Codex-Implementierung, bevor P1.3 und P0.4 erfüllt sind.** Contracts liest Codex nur aus Git (Prozessregel), nie aus Chat.

### P0 — Owner / Platform

| Schritt | Actor | Artefakt | Harte Voraussetzungen | Parallel mit | STOP | Completion evidence |
|---|---|---|---|---|---|---|
| P0.1 Owner-Entscheidungen | Seb | Entscheidungsprotokoll D1–D10 (Datei auf neuem `forge/owner/audits/…`-Branch oder im Projektordner) | dieser Bericht | – | Entscheidung, die neue Architektur verlangt → zurück an Reconciliation | Protokoll mit Antwort je D1–D10 |
| P0.2 Drill-Paket r2 | Claude oder Codex (Audit-Branch, kein main) | FORGE-RULESET-LIVE-DRILL r2: R2 merge-only (8a), DENY-Fälle squash/rebase, PM-PASS-Wortlaut (8c) | D4 | P1.1, P4.1 | Änderung über 8a/8c hinaus | neue SHA256SUMS, Selbsttests grün |
| P0.3 Isolierter Ruleset Live Drill | Seb (Owner-Runbook) | Wegwerf-Lab-Repo, 91 Fälle (42 Owner / 30 Codex / 19 Actions), Aktivierungsreihenfolge P0–P9 des Drills | P0.2; frisches Lab-Repo; Codex-Schreibrecht erst nach aktiver AEP | P1.1, P1.2, P4.1 | jedes unerwartete ALLOW; NATIVE_HEAD_CHECK_BINDING_NOT_PROVEN; jeder Schreibzugriff auf `Forge-Dice/Forge` → Owner-Freeze (Actions aus, R3-Bypass entfernen, Runs canceln) | Drill-Evidence mit PASS laut DRILL Z. 608–618; PB-3 (AEP blockt push/pull_request) live beantwortet; R3-User-Bypass im UI setzbar belegt |
| P0.4 Kanonische Plattform | Seb | Actions Execution Policy `forge-trusted-pr-target-only` zuerst; dann R1, R7, R4, R5, R6, R3; **R2 noch nicht** | P0.3 PASS | P1.2 | Abweichung vom Drill-Verhalten | read-back aller Rulesets/AEP als JSON; Codex-noreply-Identität gesetzt; PR #2 geschlossen |
| P0.5 Owner-Ops-PR | Seb (Owner-PR `forge/owner/bootstrap-0001`) | `forge/policy.json`, Rollen, `forge/ops/` (FRZ-Kopie, Experimental Report, dieser Bericht), CODEOWNERS, `.gitattributes`, `.nvmrc` | P0.4 | P1.2 | jede Code-/Workflowdatei im Owner-Ops-PR | Merge-Commit auf main, Read-back |

### P1 — Forge Contract Review

| Schritt | Actor | Artefakt | Harte Voraussetzungen | Parallel mit | STOP | Completion evidence |
|---|---|---|---|---|---|---|
| P1.1 Contract-Repair | Claude (Autor) | PKG r2 (§§1–18 gebunden) + 0001A/B/C contractVersion 2 mit allen Repairs aus A.2–A.3 | D1, D2, D3, D6 | P0.2, P0.3, P4.1 | ein Repair braucht neue Architektur; Konflikt mit FRZ, der nicht in D1–D10 entschieden ist | r2-Datei + neuer Sectionhash; drei Contracts parsen mit `parseContractDocument` auf main; neue contentHashes; Diff OLD→NEW = dieser Bericht |
| P1.2 Architektur-Review A | unabhängiger Reviewer laut D5 | FORGE REVIEW zu 0001A v2 (+ Sichtprüfung B/C v2) | P1.1 | P0.3–P0.5 | blocking Finding → zurück zu P1.1 | Review-Block `approve`, keine major/critical Findings; ROQ-Goldens gegen r2 bestätigt |
| P1.3 Registrierung A | Seb | Owner-PR registriert 0001A (Format 1, taskIndex) auf main | P1.2, P0.5 | – | baseCommit ≠ aktuelles main ohne Revision | Merge-Commit; Contract aus Git lesbar |

### P2 — Forge Bootstrap Implementation

| Schritt | Actor | Artefakt | Harte Voraussetzungen | Parallel mit | STOP | Completion evidence |
|---|---|---|---|---|---|---|
| P2.1 Implementierung A | Codex | Run-Branch `forge/run/codex/FORGE-BOOTSTRAP-0001A/<slug>` | P1.3, P0.4 aktiv, Reviewer benannt | P4.1, P4.2 | Scope-Abweichung; Änderung bestehender Tests oder `src/forge/**`; neue Dependency | unabhängiger Lab-Runner: Acceptance A + Mutanten A1–A5 KILLED nach Regel; Review approve; Owner-Merge → echtes acceptedCommit A |
| P2.2 B-Revision + Implementierung | Claude (Revision mit acceptedCommit A, neuem baseCommit) → Review → Seb registriert → Codex | 0001B v3 | P2.1 akzeptiert; Docker-fähige Testfläche | P4.x | keine gemessenen Isolations-Denials (AV-123..125) | wie P2.1 für B, inkl. Isolationsprobe lokal + GitHub-hosted |
| P2.3 C-Revision + Implementierung | wie P2.2 | 0001C v3, `.github/workflows/forge-v01.yml` (nur `pull_request_target`) | P2.2 akzeptiert | P4.x | Workflow mit anderem Trigger; Checks-Publisher/Admin-Token | wie P2.1 für C; nach Merge: bind-checks mit `integration_id`, dann **R2 aktivieren** (merge-only, required `forge-gate` + `forge-verify`); Drill-Contract + Plan vor R2 auf BASE publiziert |

### P3 — Live Drill (erster gemanagter Run)

| Schritt | Actor | Artefakt | Harte Voraussetzungen | Parallel mit | STOP | Completion evidence |
|---|---|---|---|---|---|---|
| P3.1 D1 clampAtZero | Codex (Developer), Seb (Attestation, Merge) | Drill-Contract `src/forge-drill/clamp-at-zero.ts` | P2.3 + R2 aktiv; PM-Blocker B0–B7 geschlossen; PM §11 Checkliste | P4.x | PM-STOP-Bedingungen; Verifier grün ohne Attestation | Drill-PASS-Liste (8d) vollständig; Merge-Commit |
| P3.2 D2–D9 | Codex/Seb | FORGE-DRILL-0002 (geschlossene PRs) | P3.1 | P4.x | jede unerwartete Annahme | erwartete Ablehnungscodes je Fall |
| P3.3 BOOTSTRAPPED | Seb | Exit-Protokoll E1–E9 (inkl. first-parent log == ledger) | P3.2 | – | ein E-Kriterium offen | Exit-Protokoll auf main |

### P4 — Mystery Contract Wave 1

| Schritt | Actor | Artefakt | Harte Voraussetzungen | Parallel mit | STOP | Completion evidence |
|---|---|---|---|---|---|---|
| P4.1 Mystery-Repairs (Text) | Claude | Revisionen: M2 (F05, F08), M5B (F06), M4/M5B Pins (F01), CH (F05, F12-Pin), SA/SB/SC v2 (F01, F03, F07, F09, F10, F12, Adapteranhang F02), Vitrine-Fall-Texte (F04 nach D8) | D8, D9 | P0, P1, P2, P3 | jede Änderung außerhalb der gelisteten OLD/NEW; neue Feature-Mechanik | neue Dateien mit contentHashes auf Audit-Branch; gemeinsame Session-Abschnitte weiter bytegleich |
| P4.2 Freeze-Re-Verifikation | unabhängiger Prüfer (nicht der Autor von P4.1) | Re-Run der FV-Kriterien C1–C11 gegen P4.1 | P4.1 | P1–P3 | ein Kriterium FAIL | Urteil FREEZE READY |
| P4.0 CORE-0002 | Claude (Revision gegen BOOTSTRAPPED-Policy) → Review → Seb → Codex | CORE-0002 v2 (Format-2-Support) | P3.3; D7 umgesetzt (Policy-Profil) | P4.1/P4.2 | Run berührt geschützte Pfade ohne D7-Profil | Format-2-Parser auf main, Dogfood-Test |
| P4.3 Wave-1-Runs | Codex (single lane) | M1 → M2 → M3 → M4 → M5A (je F2-transkodiert, registriert) | P4.0, P4.2 | – | SPEC_STALE; Abhängigkeit nicht akzeptiert | je Run: Review approve, Merge, acceptedCommit |
| P4.4 Wave 1b | Codex | M5B (→ M5A), CH (→ M2), SOL (→ M2) | jeweilige acceptedCommits | – | wie P4.3 | wie P4.3 |

### P5 — Mystery Integration

| Schritt | Actor | Artefakt | Harte Voraussetzungen | Parallel mit | STOP | Completion evidence |
|---|---|---|---|---|---|---|
| P5.1 Session | Codex | SA → SB → SC (Revisionen mit echten acceptedCommits) | P4.4 | – | Abweichung in gemeinsamen Abschnitten | 120er-Matrix (revidiert) grün; Goldens |
| P5.2 Vitrine re-authoring | Claude/Autor | Fall auf aktuelle Verträge (B.13) | P5.1 | – | neue Person/Lösung/Hinweisquelle | Package resolved, Proof Profile neu gebunden |
| P5.3 Vitrine-Zertifizierung | unabhängiger Prüfer | Zertifizierung mit echtem Reducer-Witness + Save/Load-Roundtrip | P5.2 | – | NOT CERTIFIED | CERTIFIED gegen aktuelle Vertragskette |
| P5.4 Blindtest (optional) | Seb + Testperson | – | P5.3 | – | – | Protokoll |

---

## D. OWNER DECISIONS (10, tatsächlich offen)

**D1 — Bootstrap-Format und -Policy**
QUESTION: Gelten FORGE-BOOTSTRAP-0001A/B/C (und der Drill-Contract) als Format-1-Bootstrap mit ihren eigenen requiredChecks (`forge-v01:*`) und contract-spezifischen LOC-Grenzen, obwohl V2PF („new tasks use Format 2“) und V01R (requiredChecks nur typecheck/test, 400/20) etwas anderes verlangen?
RECOMMENDATION: Ja. „New tasks use Format 2“ und die 400/20-Defaults gelten ab BASE = BOOTSTRAPPED.
ALTERNATIVES: (b) Format 2 sofort → CORE-0002 oder V2PF CS2-01..03 müssten vor A laufen; (c) A/B/C auf ≤400 LOC schneiden.
CONSEQUENCE: (a) A bleibt unabhängig von CORE-0002, Bootstrap-DAG unverändert. (b) zieht CORE-0002 still vor und schafft einen Bootstrap-Zyklus (Format-2-Parser ohne Verifier). (c) entweder Schutzumfang reduziert oder deutlich mehr Tasks.

**D2 — Review-Beobachtungsgrenze (CERT F02)**
QUESTION: Wird der Review-Snapshot des Gates im Receipt gebunden?
RECOMMENDATION: Ja, `reviewSnapshotDigest` im Receipt (Blocker 2 NEW), Mutant C5.
ALTERNATIVES: Nur Stage-2-Frische, AV-154 abgeschwächt.
CONSEQUENCE: Empfehlung erhält den versprochenen Schutz bei einem zusätzlichen Receipt-Feld; Alternative lässt eine Review-Änderung zwischen Gate und Stage 2 unbemerkt.

**D3 — Review-Schema und Fremdcheck-Grenze (CERT F04, F09)**
QUESTION: (a) severity-Enum und Blocking-Schwelle, (b) Umfang der Blocker-Menge für supersedes, (c) Provider-Unabhängigkeit bei OWNER_OPS, (d) fremde gleichnamige Checks?
RECOMMENDATION: (a) {info, minor, major, critical}, blocking = major/critical; (b) fail-closed inkl. DISMISSED und fehlerhafter FORGE-Bodies, keine Transitivität; (c) bei OWNER_OPS allein Owner-attestiert, ausdrücklich benannt; (d) als Deployment-Abnahme (POLICY_DEPLOYMENT), kein zusätzliches GET.
ALTERNATIVES: andere Schwelle (z. B. auch minor blockierend); automatische Providerregel für OWNER_OPS; zusätzliches festes GET auf check-runs.
CONSEQUENCE: Empfehlung macht PASS deterministisch ohne neue API-Fläche; zusätzliches GET erfasst trotzdem keine nach dem Final angelegten Checks.

**D4 — R2/R3-Plattformmodell**
QUESTION: R2 nur Merge-Commit, und ist der R3-PR-only-Owner-Bypass die beabsichtigte, protokollierte Owner-Autorisierung (FRZ Z. 162 und PM-PASS-Wortlaut werden angepasst)?
RECOMMENDATION: Ja zu beidem (Repairs 8a–8c).
ALTERNATIVES: Literal „kein Bypass“ beibehalten → Owner-only-Merge muss anders gebaut werden (z. B. Code-Owner-Review mit fremdem Approver), was FRZ-Entscheidung (b) „Required approvals 0“ widerspricht.
CONSEQUENCE: Empfehlung macht den Drill-Exit erreichbar; Alternative macht ihn unter den sieben Rulesets dauerhaft STOP.

**D5 — Reviewer-Besetzung für A/B/C und Mystery-Contracts (OE-1/OD-B8)**
QUESTION: Wer reviewt Architektur und Implementierung von A/B/C (Developer Codex/OpenAI) und die Mystery-Repairs (Autor Claude)?
RECOMMENDATION: A/B/C: Claude (Anthropic) als externer Reviewer gemäß Providerregel (PKG §9 DEV: developer.provider=openai ⇒ externalReviewer.provider=anthropic); Mystery-Repairs von Claude: Codex-Lab als unabhängiger Prüfer (wie FV). Attestation immer durch Seb.
ALTERNATIVES: ChatGPT für Mystery-Review; Seb allein.
CONSEQUENCE: Empfehlung erfüllt die Providerunabhängigkeit (FRZ: ChatGPT reviewt nie Codex-Runs) ohne neue Rollen.

**D6 — Rolle der Reference / des Oracles**
QUESTION: Ist das Golden-Paket (61 Fälle + 24 Property-Familien) das normative Regressionsorakel und der 150-Repo-Korpus nur explorativ (FBR §9 Repair 5b)? Wird die Reference repariert?
RECOMMENDATION: Ja; Reference wird nicht als Autorität repariert, nur Goldens gegen r2 neu bestätigen und Korpusfall „0-legitimate“ umlabeln.
ALTERNATIVES: Reference vollständig reparieren (ROQ Z. 207) und als Gleichheitsorakel behalten.
CONSEQUENCE: Empfehlung verhindert, dass korrektes A/B/C an 16 Reference-Fehlern scheitert; Alternative kostet eine eigene Reparaturrunde vor P2.

**D7 — CORE-0002 nach BOOTSTRAPPED**
QUESTION: Wie darf CORE-0002 nach BOOTSTRAPPED geschützte `src/forge/**`-Dateien und 13 bestehende Tests ändern, und welcher Format-2-Strang gilt (CORE-0002 oder V2PF CS2-01..03)?
RECOMMENDATION: Ein einmaliges, im Policy-File benanntes CORE-Profil (Owner-PR) für genau CORE-0002; CORE-0002 ist der einzige Format-2-Strang, V2PF dient als Anforderungsquelle für dessen Revision.
ALTERNATIVES: CORE-0002 in „nur neue Dateien + neue Tests“ aufteilen; oder V2PF CS2-Strang statt CORE-0002.
CONSEQUENCE: Ohne Entscheidung lehnt der eigene Verifier CORE-0002 korrekt ab, und Mystery-Registrierung (Format 2) bleibt blockiert.

**D8 — Vitrine-Siegbedingung (Mystery F04)**
QUESTION: Gilt für die Vitrine die Session-V1-Siegbedingung (richtige vollständige Antwort = solved) oder bleibt die Belegpflicht?
RECOMMENDATION: Session V1; Belegpflicht entfällt, Belege bleiben Deduktionshilfe (B.6). Belegpflicht später nur über eigenen Challenge-Policy-Contract.
ALTERNATIVES: (B) Belegpflicht bleibt → neue Revision SB + Challenge-Policy-Contract; (C) Zitieren möglich ohne Wirkung (semantisch = Empfehlung).
CONSEQUENCE: Empfehlung: nur Falltexte ändern sich, ≤4 Rateversuche möglich (für ersten Slice akzeptiert, SA Z. 277). (B): Proof-Closure im Reducer, widerspricht SA Z. 273, verschiebt den Freeze.

**D9 — Owner neuer Mystery-Normtexte und Altlasten**
QUESTION: (a) Release→Proof-Adapter und PublicContent gehören in SA §2 (Owner SA, Runner in Fallabnahme)? (b) VS-5-Vertrag gilt als durch Session A/B/C ersetzt? (c) TASK-0005 v2 gilt als durch MYST-0005A/B ersetzt (OD-1)?
RECOMMENDATION: Ja zu (a), (b), (c).
ALTERNATIVES: eigener vierter Session-Task für den Adapter; VS-5 als separater Contract; TASK-0005 v3 im Legacy-Strang.
CONSEQUENCE: Empfehlung hält die DAG klein und schließt CROSS R1 / CERT-V R7; Alternativen fügen Tasks hinzu, ohne Semantik zu gewinnen.

**D10 — Bestätigung überholter Mystery-Entscheidungen**
QUESTION: Werden die folgenden Punkte so protokolliert: OD-4 = Nein (Saves binden Text), OD-6 = Nein (allowedClaims dürfen false/undetermined enthalten, CH §4 Z. 96/P18 gilt), OD-7 = Nein (öffentliche Texte sind identitätsgebunden, F03), M2-Owner-Review N-1…N-4 angenommen (N-4 durch CH bestätigt), OE-M3-1..5 / OE-M4-1..8 / OE-M5-2..7 wie im Contracttext umgesetzt?
RECOMMENDATION: Ja, gesammelt bestätigen.
ALTERNATIVES: Einzelne Punkte neu öffnen.
CONSEQUENCE: Bestätigung schließt die letzte formale Lücke zwischen Contracttext und Owner-Protokoll; ein Neuöffnen bedeutet die jeweilige Contract-Revision.

### D.1 Entfernt (inzwischen eindeutig beantwortet)

| Entscheidung | Beantwortet durch |
|---|---|
| OE-7 (erster Run = MYST-0001) | PM: D1 clampAtZero zuerst; Mystery erst nach Drill-Exit |
| OE-9 Last-push approval | EXP H1 REMOVE |
| OE-11 / 341ec983-Draft | CERT: NOT COMPARABLE; A/B/C ersetzt VERIFIER-0001..0003 |
| OD-B1 Report-Kopie | Reports persistiert (60 Audit-Branches) |
| OD-B3 Attestation-Subset in VERIFIER-0002 | VERIFIER-0002 existiert nicht mehr; Attestation in C |
| OD-B4 Halt-Ruleset | DRILL-Freeze: Actions aus + R3-Bypass entfernen + Runs canceln |
| OD-B5 Actions deny-all | AEP-JSON final im DRILL (live: P0.3) |
| OD-B6 D1 zuerst | PM bestätigt |
| OD-B7 Drill-Pfad | `src/forge-drill/` (C, PM) |
| PB-1 Contract-IDs/Format/Workflow | PKG: 0001A/B/C, Format 1, `forge-v01.yml` in C |
| PB-2 R3-Bypass-Form | R3.json: User 315180734, `pull_request` (Wortlaut D4) |
| PB-4 Verifier liest live, GET-only | C Z. 71 normativ |
| OD-2 / OD-C10 fehlende Artefakte | alle auf Audit-Branches |
| OD-C1 MYST-Zähler | FR §3: spezialisierte IDs, MYST-0006/7/8 nie vergeben |
| OD-3 Belegpflicht = Zertifizierung + Blindtest | SA §6; Restfrage nur Vitrine (D8) |
| OD-5 Fehlercodes | SB §5; Lade-Codes durch F10-Repair |
| OE-M3-6 Format 1 | FR §17 / OD-C6: alles nach F2 |
| D7 Eventbudget, D12 Snapshot konservativ, D13 Lokalisierung, D14 Anti-Cheat, D15 Challenge-Wrapper, D18 LLM-Profile (Session-Digest) | jeweils durch SA/SC/SOL-Text |
| PB-3 AEP blockt push/pull_request | offen, aber keine Entscheidung: wird durch P0.3 experimentell beantwortet |

Zurückgestellt, nicht blockierend: OE-3 (public/Free vs Team, Status quo gilt), OE-5 (Spike-Evidence nach `forge/ops/` → Teil P0.5), Authoring AF-01 (Validator-CLI, SHOULD), PR-target-Default-Änderung ab 2026-11-02 (bei P2.3 erneut prüfen).

---

## E. FINAL VERDICT

**Forge: READY FOR CONTRACT REPAIR**
A/B/C sind REPAIR REQUIRED mit endlichen, exakt benannten Repairs. Nach Paket r2 + contractVersion 2 ist A architecture-review-ready (A.5). Nicht READY FOR ARCHITECTURE REVIEW, weil CERT F01/F02/F04/F08 heute normative Widersprüche sind; nicht READY FOR IMPLEMENTATION, weil weder Contract noch Plattform (P0.3/P0.4) bereit sind. CORE-0002 bleibt nach BOOTSTRAPPED.

**Mystery: FREEZE READY AFTER LISTED REPAIRS**
Bedingungen: D8 und D9 entschieden; Repairs B.2–B.12, B.15 angewandt; F02-Adapteranhang als SA-Revision geschrieben; unabhängige Freeze-Re-Verifikation (P4.2) bestätigt. F11 (Vitrine-Zertifizierung) bleibt Gate von P5, nicht vom Contract-Freeze.

**EXACT NEXT ACTION**
Seb beantwortet D1–D10 aus Abschnitt D (Empfehlung annehmen oder Alternative wählen) in einem Owner-Entscheidungsprotokoll.

STOP.
