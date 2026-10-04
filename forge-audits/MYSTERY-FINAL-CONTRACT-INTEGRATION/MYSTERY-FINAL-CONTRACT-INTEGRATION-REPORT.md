# MYSTERY — FINAL CONTRACT REPAIR INTEGRATION & FREEZE CANDIDATE

Stand: 2026-10-04 · Rolle: Principal Contract Integration Engineer + Mystery Systems Architect · Autor: Claude (Anthropic)
Repository: `Forge-Dice/Forge` · `main` = `3d7545d843883418348004e68717399a64da7a7d` vor und nach der Arbeit (per `git ls-remote` geprüft), kanonischer Code strikt read-only.

## 0. Ergebnis

**MYSTERY FREEZE CANDIDATE READY FOR INDEPENDENT REVIEW**

- 11 Contracts im Set: **7 NEW REVISION REQUIRED** (v2-Candidates erzeugt: MYST-0002, MYST-0004, MYST-0005B, MYST-CHALLENGE-0001, MYST-SESSION-0001A/B/C), **4 UNCHANGED** (MYST-0001, MYST-0003, MYST-0005A, MYST-SOLVABILITY-0001), **0 BLOCKED**.
- 11 Freeze Findings: **11 geschlossen** (10 CLOSED_BY_THIS_REPAIR, 1 CLOSED_BY_EXISTING_TEXT), **0 offen**. F12 (nonblocking) ebenfalls geschlossen.
- 132 exakte OLD→NEW-Ersetzungen, jede mit Ankerzählung = 1 gegen die gepinnten Originalbytes; Herkunft je Ersetzung in `PATCH-LOG.json`.
- Alle 7 Candidates parsen mit `parseContractDocument` von `main@3d7545d` (Format 1); contentHash = SHA-256(`forge-contract-v1\n` + Text).
- Statischer Cross-Contract-Check: **13/13 PASS** (`STATIC-CROSS-CONTRACT-CHECK.json`).
- **GitHub-Persistenz: STOP.** Die authentifizierte GitHub-Identität dieser Session ist `Wuerfelduell` (GitHub MCP `get_me`, id 315180734). Eine eigene Claude-Contributor-Schreibidentität ist nicht verfügbar; gemäß Auftrag wurde nicht auf einen anderen Account ausgewichen. Kein Push, kein Branch, kein PR, kein Merge.

## 1. Quellen (ausschließlich Remote-Audit-Branches + main)

| Quelle | Branch `forge/owner/audits/…` | Commit |
|---|---|---|
| Owner-Reconciliation (D1–D10, B.2–B.15) | FORGE-MYSTERY-FINAL-OWNER-RECONCILIATION | 52dab20b |
| Freeze-Blocker-Repair (F01–F11, Patchtabelle) | MYSTERY-FREEZE-BLOCKER-REPAIR | 0681d453 |
| Release→Proof-Certification-Closure (P01–P20, Annex, CERT-1..10) | MYSTERY-RELEASE-PROOF-CERTIFICATION-CLOSURE | d17f5211 |
| Package/Replay-Binding-Closure (R01–R10, Registry, DAG) | MYSTERY-PACKAGE-REPLAY-BINDING-CLOSURE | 7ffa39c8 |
| Independent Freeze Verification (F01–F12, 50 Angriffe) | MYSTERY-INDEPENDENT-FREEZE-VERIFICATION | 25a8a17b |
| Final Reconciliation Spec Freeze | MYSTERY-FINAL-RECONCILIATION-SPEC-FREEZE | 5e77872d |
| MYST-0001 | MYST-0001-PLAYERREF | a256e517 |
| MYST-0002 FINAL-CANDIDATE | MYST-0002-REPAIR | ea22147f |
| MYST-0003 | MYST-0003-EVIDENCE-ACCESS | 8ae160f6 |
| MYST-0004 | MYST-0004-EVIDENCE-PRESENTATION | 51c2ddc4 |
| MYST-0005A/B | MYST-0005-INTERROGATION | 76405cd3 |
| MYST-CHALLENGE-0001 | MYST-ACCUSATION-CHALLENGE-EXACTNESS | 7514e7e6 |
| MYST-SOLVABILITY-0001 | MYSTERY-SOLVABILITY-ACCUSATION-REPAIR | f02b7a56 |
| Session A/B/C | MYSTERY-SESSION-PRODUCTION-PACKAGE | b94db40e |
| VS-5 Preflight, Cross-Contract, InfoFlow, Scale, Authoring Stress, Vitrine Case/Certification/Proof Profile | MYSTERY-VS5-PREFLIGHT 284ea9de · MYSTERY-CROSS-CONTRACT-CONSISTENCY 3254b9c2 · mystery-infoflow 006ecf36 · MYSTERY-SCALE-COMPLEXITY 27dd70f0 · MYSTERY-CASE-AUTHORING-STRESS 8b68e511 · DIE-LEERE-VITRINE fa3a1cbf · DIE-LEERE-VITRINE-SOLVABILITY-CERTIFICATION e66e7e19 | — |

Die Lab-Berichte (VS-5, Cross-Contract, InfoFlow, Scale, Authoring Stress, Vitrine) wurden nur über die bereits in den Closure-Paketen gegen sie geprüften Befunde verwendet; keiner liefert neue widersprechende Evidenz. Chat-Zusammenfassungen sind keine Quelle. Alle Quell-Hashes stehen im Manifest.

## 2. Bindende Owner-Entscheidungen

D1–D10 aus FORGE-MYSTERY-FINAL-OWNER-RECONCILIATION sind angenommen und wurden nicht neu geöffnet. Für Mystery umgesetzt:

- **D8:** Session-V1-Siegbedingung. Vollständige richtige vierteilige direct_actor-Antwort ⇒ `solved`, ohne Beleg-, NPC-, Proof-Receipt- oder Citation-Gate (SB §6, P08). Evidence/Proof dienen Deduktion und Zertifizierung. Eine spätere Beweisabgabe braucht einen eigenen Challenge-Policy-Contract.
- **D9:** Release→Proof-Adapter und PublicContent normativ in Session A §2. VS-5 durch Session A/B/C ersetzt (Aliasregel im Manifest, keine Textänderung in M3). TASK-0005 v2 durch MYST-0005A/B ersetzt.
- **D10:** Saves binden Presentation/PublicContent-Text exakt; allowedClaims dürfen false/undetermined enthalten; öffentliche Texte sind identitätsgebunden; M2/M3/M4/M5-Ownerentscheidungen bestätigt.

## 3. Patch-Autorität und dokumentierte Abweichungen

Rangfolge bei Konflikten: (1) Ownerentscheidung, (2) späteres experimentelles Closure-Ergebnis, (3) Originalcontract, (4) ältere Design-/Research-Artefakte. Bestehende Patches wurden wörtlich übernommen; P01–P10 direkt aus `CONTRACT-PATCHES.json` (SHA-256 im Manifest), Master-B-Texte und R-Texte wörtlich.

| ID | Konflikt / Abweichung | Entscheidung |
|---|---|---|
| DV-01 | SA §6: Master B.6 „ENTSCHIEDEN …“ vs P08 „OWNER D8 ACCEPTED …“ | P08 (später, präziser: alle vier Literale im accuse, keine Scope-Umschaltung). Gleiche Semantik. |
| DV-02 | PublicContent questionTexts: Master B.5 „je (NPC-Profil, Katalogfrage)“ vs R03/Annex „genau die authored Profilregel-Fragepaare“ | R03 (später; verhindert Pflichttext für nicht zugewiesene Paare). |
| DV-03 | Vitrine-Brief: Master B.6 BRIEF-Texte vs P11–P13 | P11–P13; nicht angewandt (Case-Delta für P5.2). |
| DV-04 | CH-Pin: Master B.15 NEW pinnt `e1eba9e1…` vs B.15-Hinweis „nach F05/F08-Repair auf reparierte Fassung“ | Pin auf MYST-0002 v2 `65b12f75…`. |
| DV-05 | F07: FV-Vorschlag (Translator aus `hashCaseTruth`) vs Master B.9/R08 (`pkg.refs.truthHash`, einmal berechnet) | Master B.9 + R08. |
| DV-06 | FR §7/§21 „refSalt im Paketdokument“ vs Master B.3/R01 (Salt über trusted Port) | Master B.3/R01. |
| DV-07 | FR §5 Premise-Keys `seen/reported/answered` vs Annex forge-release-proof-v1 | Annex (FR überholt, Master B.4). |
| DV-08 | Consolidation-Plan „contractVersion zählt nur registrierte Revisionen“ vs Closure „Session v2“ | Einheitlich contractVersion 2 für jede NEW REVISION; v1 bleibt als Vorgänger-Identität im Manifest. Registrierung: Format-2-Transkodierung ohne Versionssprung. |
| DV-09 | B.11 Größenabsatz | Master-NEW wörtlich (der Satz „Alle echten Checksums …“ entfällt, B0 enthält den 64-Zeichen-Platzhalter). |
| DV-10 | B.2 und R01 überlappen | Master-B.2-Text plus R01-Zusätze als „Ergänzung R01“; widerspruchsfrei. |
| DV-11 | challengeHash: „nach claimKey sortiert“ vs Registry „SET nach C(claim)“ | Registry (R04 ist pfadgenau normativ). |
| DV-12 | A42/A43 zusätzlich zu A41 | Aus R01-Negativkontrolle und Annex §5 (bestehende Abnahmepflichten), keine neue Semantik. |
| IR-01…IR-05 | Integrationsfolgen ohne eigenes Patchpaket | IR-01 certificateData-Tabellenzeile an Annex angepasst; IR-02 PublicContent-Parser in den Resolver-Schritten; IR-03 Abnahmepunkt 6 an D8; IR-04 Fallzahlen 43/42; IR-05 Typbezug PlayerReport/PlayerClaim im Annex. Ferner Titel, Revisionsvermerke, M2-Versionssatz. |

## 4. Contract-Entscheidungen

| Contract | Entscheidung | Candidate / akzeptierte Identität | Inhalt der Revision |
|---|---|---|---|
| MYST-0001 | UNCHANGED | fcv2 `f4d31858…26335` | — (Ref-Ableitung, Salt, Kollision, Resolution ≠ Authorization vollständig) |
| MYST-0002 | NEW REVISION REQUIRED | v2 fcv1 `65b12f758d6e…17ef` | F05 §15 (P09), F08 §5.1/AC-05/AC-06 (B.10) |
| MYST-0003 | UNCHANGED | fcv1 `8574f1e2a2b3…` | — |
| MYST-0004 | NEW REVISION REQUIRED | v2 fcv1 `18e383d06a8e…9e9b` | F01-Pin MYST-0001 v1 (B.2) |
| MYST-0005A | UNCHANGED | fcv1 `dc7c48f5221c…` | — |
| MYST-0005B | NEW REVISION REQUIRED | v2 fcv1 `ad5702488089…b7c5` | F06 `interrogate` (B.8), F01-Pin (B.2) |
| MYST-CHALLENGE-0001 | NEW REVISION REQUIRED | v2 fcv1 `b29fab7b7039…8fbd` | F05 §6 (P10), Pin MYST-0002 v2 (B.15) |
| MYST-SOLVABILITY-0001 | UNCHANGED | fcv1 `5eb4b289d17e…` | — (Port bleibt Stub-fähig; echter Adapter = SA-Annex) |
| MYST-SESSION-0001A | NEW REVISION REQUIRED | v2 fcv1 `f48559e0ba61…7a6d` | zentrale Reparatur, s. §5 |
| MYST-SESSION-0001B | NEW REVISION REQUIRED | v2 fcv1 `deeeef058908…bacb` | gemeinsame §§2–11 bytegleich; normativ §§4–7 |
| MYST-SESSION-0001C | NEW REVISION REQUIRED | v2 fcv1 `8df316a16638…b11b` | gemeinsame §§2–11 bytegleich; normativ §§8–9; C41/C42 |

Volle Hashes, Pfade und Patch-IDs: `MYSTERY-FINAL-CONTRACT-MANIFEST.json`. Historische Drafts bleiben unverändert archiviert; jeder Candidate trägt einen Revisionsvermerk mit Vorgänger-Identität.

## 5. Session A (zentrale normative Reparatur)

Integriert in den bytegleichen gemeinsamen Abschnitten von SA/SB/SC (normativer Owner gemäß P01: SA §§2–3, SB §§4–7, SC §§8–9):

- **Release→Proof-Adapter** `forge-release-proof-v1` als normativer Anhang in §2 (P05; Annex-SHA-256 `cb0b8ba0…`, nur Überschriftenebenen abgesenkt), P06 (strikter Manifest-Envelope), P07 (Producer je SOL-Root).
- **PublicContent** (P02–P04, R03): strikte Komponente, alleiniger Owner öffentlicher Titel-/Brief-/Label-/Rollen-/Frage-/Regeltexte; publicContentHash im releaseContextHash; Ausgabe nur PublicContent + Präfix-Known; kein Roster aus Truth.
- **PlayerKnowledge ownership** SA §3 (P01), unverändert quellengebundenes Journal.
- **PlayerRef config/salt binding** (B.2, R01): `profile:"forge-mystery-playerref-v1"`, saltHex = exakter refSalt, Konstruktion nur über `buildPlayerRefIndex`, vollständige Mitgliedschafts- und Inversprüfung, Salt nie in Save/Event/DTO; refsHash bindet Config und Mapping.
- **NPC snapshot identity** (R02): kompletter geparster Snapshot, awareness/attitudes als SET nach C, alle Metadaten inklusive solutionHash null.
- **Evidence Access / Presentation / Interrogation Authoring / Challenge / Proof Profile identity**: Registry R04 mit allen 18 Profilen pfadgenau eingebettet (Registry-JSON-SHA-256 `91d077d8…`).
- **Player Setup / initial awareness**: `forge-session-initial-v1`, unverändert.
- **Presentation/Public Text gemäß D10**: jede Textbyte-Änderung ändert das Package und invalidiert alte Saves (§9-Zeile, A41, C41).
- **CasePackageIdentity closure** (R05): Deskriptor exakt drei Felder; Auflösung nur über vollständigen Deskriptor; keine latest-, revision-only- oder same-case-Substitution.
- **Hash-DAG** eingebettet (package-identity-dag.mmd); keine zyklische Abhängigkeit (packageHash fließt nie in PlayerRef, proofHash nie ins Manifest).

## 6. Release → Proof

Kette: Release → PlayerKnowledge Observation → authored Proof Premise (certificateData-Selector) → Proof Route (SOL-Kanten mit öffentlicher Lizenz) → Solvability/Certification.
Ausgeschlossen im Candidate-Text: NPC asserts P ⇒ P wahr (REPORTED_BY_NPC = Auftreten des Berichts); Evidence concerns/supports P ⇒ P wahr (OBSERVED nur mit expliziter authored Faktizitätslizenz und Canonical Consistency); Player heard P ⇒ P wahr (leans/uncertain/does_not_know/decline nie Boolean). Der Adapter definiert je Observation explizit, welche veröffentlichte Payload die Premise erfüllt; keine generische Inference Engine. MYST-0002 bleibt alleinige Autorität für Canonical Consistency.

## 7. Session B, Session C, Challenge, Solvability

- **Session B**: Reducer-Autorität, geordnete akzeptierte Events, deterministische Effekte, terminal `solved`, atomarer Rollback, abgeleitetes PlayerKnowledge, keine persistierte abgeleitete Autorität, Ports exakt (B.9), accuse mit gebundenem truthHash (B.11/R08), beobachtbare Immutabilität ohne normativen O(n²)-Kopierzwang (B.11/R09), D8 (P08), Ruleset-Kompatibilität (R06). Keine neue Session-Architektur.
- **Session C**: exakte CasePackageIdentity, PublicContent-Bindung, Ruleset-Identität, geordnete History, Checksum = Integrität, keine latest-/revision-only-Ersetzung, keine persistierte abgeleitete Verdict-, PlayerKnowledge-, VisibleRef- oder NPC-Engine-Autorität (R07), Resolve verifiziert einmal und Replay nutzt das Binding (R08), konstante Public-Load-Fassade SAVE_UNAVAILABLE (B.12). Keine Anti-Cheat-Garantie.
- **Challenge**: endlicher öffentlicher AnswerScope, determined-and-matching Exactness, allowedClaims mit false/undetermined erlaubt, undetermined bleibt dreiwertig, keine geheime Required-only-Whitelist (P09/P10), kein Evidence-possession-Gate, MYST-0002 bleibt Core.
- **Solvability**: unverändert; Observation/ReportedStatement ist keine objective truth; Proof Profile definiert Premises und Routes; Belegpflicht bleibt Zertifizierungs-/Authoring-Eigenschaft, nicht Voraussetzung für `solved`.

## 8. MYST-0001/0003/0004/0005A/B

Nur nachgewiesene Repairs: Pins (F01), `interrogate` (F06). Weiterhin gilt: PlayerRef-Auflösung ≠ Autorisierung; Salt/Profil/Package-Bindung geschlossen; VisibleRef projection-local und nie persistiert; Evidence-Release leakt keine objektive Wahrheit; NPC-Release leakt weder Intent noch Originalstance; PublicContent-Ownership eindeutig (SA); Interrogation Authoring (M5A) und Runtime (M5B/SB) eindeutig getrennt. Kein Scope verbreitert.

## 9. Scale

A. Findings: layer-spezifische Bounds statt globalem Magic Limit (R10-Klassifikation; offene Zielgeräte-Budgets bleiben OPEN BOUND).
B. Session History: rein/deterministisch, beobachtbar immutable, keine normative Vollkopie je Event.
C. Hashing: Package Resolve verifiziert Komponenten-Identitäten einmal; Replay darf das verifizierte immutable Binding wiederverwenden.
Keine Optimierungsarchitektur erfunden.

## 10. Versionierung

Historische Drafts unverändert. Jede normative Änderung ⇒ NEW REVISION (contractVersion 2). Registrierung nach Forge BOOTSTRAPPED in Format 2 (setzt CORE-0002 voraus, Master B.16/D1/D7). Keine stillen Draft-Edits: jede Byteänderung ist eine protokollierte Ersetzung in `PATCH-LOG.json`.

## 11. Final Dependency DAG

Siehe `FINAL-DEPENDENCY-DAG.md`. Frontmatter-Kanten unverändert, azyklisch. Wellen: (1) M1, M2, M3, M4, M5A parallel; (2) M5B, CH, SOL; (3) SA; (4) SB; (5) SC; danach P5 (Vitrine). Kanten klassifiziert als HARD IMPLEMENTATION, RUNTIME/PACKAGE oder DESIGN RELATION ONLY.

## 12. Statischer Cross-Contract-Check (13/13 PASS)

X01 Parse + contentHash · X02 Versionen · X03 Dependency-Graph geschlossen/azyklisch · X04 Pins exakt · X05 Session-Gemeinsamtext bytegleich (`42a1a5e3…`) · X06 Hash-/Profilnamen ⊆ Registry · X07 publicContentHash in jeder releaseContext-Liste · X08 keine überholten Normtexte (ask-Event, UNKNOWN/BLOCKER, Required-only-Totalverbot, Rehash je Anklage, Vollkopie, Präfixserialisierung, requireReleasedProof, evidenceRefs, seen/reported/answered, unbeschränktes no-throw, Scratch-Namespace, generisches profile) · X09 Typ-Ownership · X10 Persistenz-Ownership · X11 Proof-/Challenge-/Session-/Replay-Semantik · X12 Deskriptor · X13 PlayerRef-/Snapshot-/PublicContent-Identität. Details: `STATIC-CROSS-CONTRACT-CHECK.json`.

## 13. Vitrine Certification Boundary

Kein Contract-Freeze-Blocker. Nach Freeze und Implementierung braucht der reale Fall CERT-1…CERT-10 (Release→Proof-Closure, `VITRINE-RECERTIFICATION-CHECKLIST.md`). Der echte Witness verwendet den implementierten Reducer; kein Scratch-Reducer gilt als Produktionsbeweis. Die Vitrine-Falldeltas P11–P20 sind im Manifest als nicht angewandtes Re-Authoring-Delta für P5.2 festgehalten.

## 14. Hinweise für das Architecture Review (keine Blocker)

- RN-1: SA-Zeilenziel 340–399 umfasst jetzt strikte PublicContent- und certificateData-Parser; die bestehende Klausel „Contractrevision vor Scopeerweiterung“ greift, falls nötig.
- RN-2: SB importiert M2/M3/M4/M5B/CH direkt; Frontmatter listet nur SA; Start-Gate ist transitiv über SA erfüllt.
- RN-3: Der Release→Proof-Runner ist Fallabnahme-Werkzeug (D9a), kein Session-Task; er wird vor CERT-4/CERT-5 gebraucht.
- RN-4: Annex, R-Texte und Registry sind wörtlich englisch in deutschen Contracts übernommen (keine Neuformulierung).
- RN-5: P4.2 verlangt eine unabhängige Freeze-Re-Verifikation durch einen anderen Prüfer als den Autor dieser Integration (D5: Codex-Lab).

## 15. Final Verdict

| Contract | Verdict |
|---|---|
| MYST-0001 | UNCHANGED / READY |
| MYST-0002 v2 | READY FOR ARCHITECTURE REVIEW |
| MYST-0003 | UNCHANGED / READY |
| MYST-0004 v2 | READY FOR ARCHITECTURE REVIEW |
| MYST-0005A | UNCHANGED / READY |
| MYST-0005B v2 | READY FOR ARCHITECTURE REVIEW |
| MYST-CHALLENGE-0001 v2 | READY FOR ARCHITECTURE REVIEW |
| MYST-SOLVABILITY-0001 | UNCHANGED / READY |
| MYST-SESSION-0001A v2 | READY FOR ARCHITECTURE REVIEW |
| MYST-SESSION-0001B v2 | READY FOR ARCHITECTURE REVIEW |
| MYST-SESSION-0001C v2 | READY FOR ARCHITECTURE REVIEW |

**Gesamt: MYSTERY FREEZE CANDIDATE READY FOR INDEPENDENT REVIEW.**

## 16. Persistenz

Authentifizierte GitHub-Identität: `Wuerfelduell` (GitHub MCP `get_me`). Der Auftrag verbietet Schreibaktionen als Wuerfelduell oder forge-codex. Daher **STOP für die GitHub-Persistenz**: kein Branch `forge/owner/audits/MYSTERY-FINAL-CONTRACT-INTEGRATION`, kein Commit, kein Push. Die Deliverables liegen im Projektordner unter `forge-audits/MYSTERY-FINAL-CONTRACT-INTEGRATION/` mit identischer Struktur und `SHA256SUMS`, bereit für eine Persistenz unter einer zulässigen Identität.

## 17. Reproduktion

`reproduce/README.md`: Quellen aus den Audit-Branches extrahieren, `python3 build.py` (132 Anker, Abbruch bei jeder Abweichung), `python3 check.py` (Parser von main@3d7545d via `node --experimental-strip-types`), `python3 gen.py`.

STOP.
