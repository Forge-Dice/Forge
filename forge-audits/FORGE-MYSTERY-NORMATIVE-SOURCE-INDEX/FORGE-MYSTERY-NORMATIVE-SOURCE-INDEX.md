# FORGE + MYSTERY — NORMATIVE SOURCE INDEX

Stand: 2026-10-04, ca. 17:50 UTC · Autor: Claude (rein dokumentarisch, read-only gegenüber `main` und allen indizierten Artefakten)
Repository: `Forge-Dice/Forge` · `main` = `3d7545d843883418348004e68717399a64da7a7d` (vor und nach der Arbeit per `git ls-remote` gelesen)
Gelesen: alle 66 Remote-Branches `forge/owner/audits/*` (Liste mit Commit in `source-index.json`), dazu `main:forge/**`, die Projektdateien ohne Git-Gegenstück und Sebs Auftragsnachrichten vom 2026-10-04 17:31–17:32Z.

Dieser Index fügt **keine Semantik** hinzu. Er entscheidet keine offene Frage, repariert keinen Contract und erklärt keine Supersession, die nicht in einem Original steht. Wo zwei Originale sich widersprechen, steht hier nur, welche dokumentierte Regel greift und wo die Auflösung hingehört.

Begleitdateien: [Supersession Map](FORGE-MYSTERY-SUPERSESSION-MAP.md) · [Implementer Matrix](IMPLEMENTER-SOURCE-MATRIX.md) · [Reviewer Matrix](REVIEWER-SOURCE-MATRIX.md) · `source-index.json` (maschinenlesbar, gleiche IDs).

---

## 0. Antwort in fünf Zeilen

1. **Bindende Ownerentscheidungen:** D1–D10 aus `FORGE-MYSTERY-FINAL-OWNER-RECONCILIATION` (von Seb am 2026-10-04 17:31Z angenommen), plus die Vorrangregeln und Owner-Vorgaben in FRZ und die Prozessregel „Contract nur aus Git“.
2. **Normative Candidate-Quellen heute:** Forge A/B/C = die r2-Contracts v2 aus dem A/B/C-r2-Thread (`/mnt/project-files/forge-audits/FORGE-BOOTSTRAP-R2-FINAL-CONTRACTS/`, 17:46Z, wegen Identität **noch nicht in Git**); CORE-0002 = Draft (erst nach BOOTSTRAPPED). Mystery = das Manifest der Mystery-Integration (`/mnt/project-files/forge-audits/MYSTERY-FINAL-CONTRACT-INTEGRATION/`, 17:48Z, **noch nicht in Git**): v2 für MYST-0002, 0004, 0005B, CHALLENGE-0001, SESSION-0001A/B/C; unverändert MYST-0001, 0003, 0005A, SOLVABILITY-0001.
3. **Operative Candidates:** FRZ (Leitreferenz), Mystery Final Reconciliation Spec Freeze (ID-Policy, Freeze-Regel) und das neue Final Activation Runbook (Projektordner, noch nicht in Git; Ruleset Live Drill und Pre-Mortem sind jetzt dessen Quellmaterial).
4. **Experimentelle Evidenz, Reviews, Historie:** alles andere. Kein Lab-Bericht ist Contract-Text; Closure-Labs sind Patchquellen, normativ erst nach Integration.
5. **Von vier erwarteten Nachfolgern liegen drei vollständig vor** (A/B/C r2, Mystery-Integration, Activation Runbook), alle nur im Projektordner, weil auch diese Threads an der Identitätssperre gestoppt haben bzw. nicht gepusht haben. Das Vitrine Final Pack ist noch in Arbeit (9 von 10 Dateien). Bis dahin gilt der jeweils genannte Interim-Eintrag (§9).

**Implementierungsautorität hat heute kein Artefakt in diesem Index.** Codex-Implementierung beginnt laut Queue erst mit einem reviewten und auf `main` registrierten Contract (Owner Reconciliation §C, P1.3 + P0.4).

---

## 1. Klassen

| Klasse | Bedeutung in diesem Index |
|---|---|
| OWNER_DECISION | Vom Owner ausdrücklich angenommene Entscheidung. Bindet alle Candidates. |
| NORMATIVE_CONTRACT_CANDIDATE | Aktueller Contract-Text (oder Fall-Authoring-Paket) für eine Task-ID. Noch nicht registriert, also keine Implementierungsfreigabe. |
| NORMATIVE_OPERATIONAL_CANDIDATE | Aktuelle Quelle für Architektur, Prozess, Plattform, Rulesets, Drill. |
| EXPERIMENTAL_EVIDENCE | Lab-, Preflight-, Closure- oder Scratch-Ergebnis. Liefert Befunde und Patchvorschläge, keine Normtexte. |
| INDEPENDENT_REVIEW | Unabhängige Prüfung eines bestimmten Artefaktstands; gilt für genau diesen Stand. |
| HISTORICAL_DESIGN | Frühere Designs/Pläne, in spätere Quellen aufgegangen. Nur Herkunft und Begründung. |
| SUPERSEDED | Durch eine benannte spätere Quelle ausdrücklich ersetzt. |
| PRIVATE/BLOCKED | Nicht in Git persistiert, weil sensibel. |
| REFERENCE_ONLY | Nachschlagematerial (Inventare, Legacy auf `main`, Fallinhalt-Quelle), keine Normquelle. |

---

## 2. Inventar

Eine Zeile je fachlichem Artefakt. Evidence (ZIPs, JSON, Logs, Skripte) ist dem Bericht zugeordnet, zu dem sie gehört; die vollständigen Dateilisten stehen in `source-index.json`.

| ID | Artefakt | Ort | Klasse | Status |
|---|---|---|---|---|
| SRC-OWN-RECON | FORGE + MYSTERY Final Owner Reconciliation (D1–D10, Repair-Texte A.1–A.6/B.2–B.15, Queue P0–P5) | `…/FORGE-MYSTERY-FINAL-OWNER-RECONCILIATION` @ `52dab20b` | OWNER_DECISION | ACCEPTED (D1–D10 angenommen durch Seb, 2026-10-04 17:31Z) |
| SRC-F-CORE0002 | FORGE-CORE-0002 Contract Draft (führt Format 2 ein) | `…/FORGE-CORE-0002` @ `b8fb63bf` | NORMATIVE_CONTRACT_CANDIDATE | DEFERRED: frühestens nach BOOTSTRAPPED (D1); Revision v2 gegen CORE-Policy-Profil nötig (D7) |
| SRC-M-0001 | MYST-0001 PlayerRef V1 (Format 2) | `…/MYST-0001-PLAYERREF` @ `a256e517` | NORMATIVE_CONTRACT_CANDIDATE | CANDIDATE, UNCHANGED laut SRC-M-INT-Manifest (aktuelle Identität = Original, contractVersion 1) |
| SRC-M-0003 | MYST-0003 Evidence Access V1 (+ Package) | `…/MYST-0003-EVIDENCE-ACCESS` @ `8ae160f6` | NORMATIVE_CONTRACT_CANDIDATE | CANDIDATE, UNCHANGED laut SRC-M-INT-Manifest (contractVersion 1; F1→F2-Transkodierung vor Registrierung) |
| SRC-M-0005A | MYST-0005A Interrogation Authoring V1 (+ gemeinsames MYST-0005 Package) | `…/MYST-0005-INTERROGATION` @ `76405cd3` | NORMATIVE_CONTRACT_CANDIDATE | CANDIDATE, UNCHANGED laut SRC-M-INT-Manifest (contractVersion 1) |
| SRC-M-SOL | MYST-SOLVABILITY-0001 Draft + Solvability/Accusation Repair Report + Evidence | `…/MYSTERY-SOLVABILITY-ACCUSATION-REPAIR` @ `f02b7a56` | NORMATIVE_CONTRACT_CANDIDATE | CANDIDATE, UNCHANGED laut SRC-M-INT-Manifest (contractVersion 1; Proof-Semantik über Session A v2) |
| SRC-F-R2 | FORGE-BOOTSTRAP-0001A/B/C v2 (r2) + R2-Manifest + Authoring Report | nur Projektordner (`FORGE-BOOTSTRAP-R2-FINAL-CONTRACTS/`) | NORMATIVE_CONTRACT_CANDIDATE | AVAILABLE nur im Projektordner (2026-10-04 17:46Z); nicht in Git (Persistenz BLOCKED: Identität Wuerfelduell). Selbstangabe: A/B/C READY FOR INDEPENDENT ARCHITECTURE REVIEW; B/C-Ausführung BLOCKED bis echtes acceptedCommit (v3); C-Aktivierung BLOCKED durch Execution-Isolation-Gate |
| SRC-M-INT | Mystery Final Contract Integration (Report, Manifest, Final DAG, Finding Closure Matrix, Static Cross-Contract Check, Patch Log, 7 Candidates v2) | nur Projektordner (`MYSTERY-FINAL-CONTRACT-INTEGRATION/`) | NORMATIVE_CONTRACT_CANDIDATE | AVAILABLE nur im Projektordner (2026-10-04 17:48Z, SHA256SUMS geprüft); nicht in Git (Persistenz STOPPED: Identität Wuerfelduell). Selbstangabe: MYSTERY FREEZE CANDIDATE READY FOR INDEPENDENT REVIEW; 11/11 Freeze-Findings geschlossen |
| PENDING-V-PACK | Die leere Vitrine Final Authoring & Certification Pack | erwartet `…/DIE-LEERE-VITRINE-FINAL-PACK` | NORMATIVE_CONTRACT_CANDIDATE | PENDING (in Arbeit; Teildateien im Projektordner, keine Autorität) |
| SRC-F-FRZ | FORGE V0.1 Architecture Freeze (Leitreferenz) | `…/FORGE-V0.1-ARCHITECTURE-FREEZE` @ `a5302309` | NORMATIVE_OPERATIONAL_CANDIDATE | IN FORCE als Leitreferenz, in Einzelpunkten durch D1–D10 überholt |
| SRC-M-FR | Mystery Final Reconciliation & Spec Freeze (ID-Policy, DAG, Registrierungsfolge, Freeze-Regel) | `…/MYSTERY-FINAL-RECONCILIATION-SPEC-FREEZE` @ `5e77872d` | NORMATIVE_OPERATIONAL_CANDIDATE | IN FORCE für ID-Policy §3 (OD-C1 beantwortet, Owner Reconciliation D.1), Freeze-Regel §19, Repair-Tabelle §17; teilweise überholt |
| SRC-F-RUNBOOK | FORGE V0.1 Final Activation Runbook + Checklist + Evidence Sheet + STOP/Recovery Matrix | nur Projektordner (`FORGE-V0.1-FINAL-ACTIVATION-RUNBOOK/`) | NORMATIVE_OPERATIONAL_CANDIDATE | AVAILABLE nur im Projektordner (2026-10-04 ~17:50Z, SHA256SUMS geprüft); nicht in Git. Selbstangabe: AUTHORED — NOT EXECUTED; kein Prüfpunkt bestanden |
| SRC-F-EI | Execution Isolation Security Lab + EI Acceptance Contract (EI-01…EI-20) | `…/FORGE-EXECUTION-ISOLATION` @ `372b196e` | EXPERIMENTAL_EVIDENCE | NO-GO (17/44 contained, 27/44 exposed; kein Container-Runtime im Lab) |
| SRC-F-EXP | Bootstrap Experimental Report + Lab | `…/FORGE-V0.1-BOOTSTRAP` @ `da9b3d51` | EXPERIMENTAL_EVIDENCE | GO für lokale Verifier-Implementierung + isolierten Live-Drill; NO-GO für 'Bootstrap sicher aktiviert' |
| SRC-F-ORACLE-V2 | High-Confidence Oracle V2 (Differential-Orakel) | `…/FORGE-HIGH-CONFIDENCE-ORACLE-V2` @ `ea46c266` | EXPERIMENTAL_EVIDENCE | GO AS DIFFERENTIAL ORACLE; contractSensitive gegen r1-Drafts gebunden |
| SRC-F-REF | Independent Verifier Reference + Evidence | `…/FORGE-VERIFIER-REFERENCE` @ `2062fca5` | EXPERIMENTAL_EVIDENCE | GO als Differential-Referenz, NO-GO als produktiver Verifier; per D6 nicht als Autorität repariert |
| SRC-F-APP | Actions Policy Preflight (Lab-Repo, API-Evidenz) | `…/FORGE-ACTIONS-POLICY-PREFLIGHT` @ `01dfb21c` | EXPERIMENTAL_EVIDENCE | Evidenz 2026-10-03; Lab-Repo archiviert |
| SRC-F-SPIKE | Verifier Experimental Spike (Git/Diff/Hook/Textconv-Proben, 214 Dateien) | `…/FORGE-VERIFIER-EXPERIMENTAL-SPIKE` @ `1a55add6` | EXPERIMENTAL_EVIDENCE | Lokale Evidenz 2026-10-03; Parser-Probe ausdrücklich 'NOT production or approved contract' |
| SRC-M-FBR | Mystery Freeze Blocker Repair (Patches, Closure Matrix, Regression Evidence) | `…/MYSTERY-FREEZE-BLOCKER-REPAIR` @ `0681d453` | EXPERIMENTAL_EVIDENCE | FREEZE READY AFTER OWNER DECISION (9 closed, F02/F04 offen bis D8/D9 – inzwischen angenommen) |
| SRC-M-PKG | Package Identity & Replay Binding Closure (Hash-Profile-Registry, Package-Identity-DAG) | `…/MYSTERY-PACKAGE-REPLAY-BINDING-CLOSURE` @ `7ffa39c8` | EXPERIMENTAL_EVIDENCE | PACKAGE BINDING CLOSED / REPLAY BINDING CLOSED (Spezifikationsebene) |
| SRC-M-RPC | Release → Proof → Vitrine Certification Closure (Session-A-Annex, Patch Table, Recert-Checklist) | `…/MYSTERY-RELEASE-PROOF-CERTIFICATION-CLOSURE` @ `d17f5211` | EXPERIMENTAL_EVIDENCE | Release→Proof CLOSED im Repair-Paket; Vitrine Spec CERTIFICATION MODEL READY; Runtime IMPLEMENTATION REQUIRED |
| SRC-M-XC | Mystery Cross-Contract Consistency Report + Evidence | `…/MYSTERY-CROSS-CONTRACT-CONSISTENCY` @ `3254b9c2` | EXPERIMENTAL_EVIDENCE | NO-GO für Gesamtintegration (Stand 04.10. vormittags) |
| SRC-M-IF | Mystery Information Flow Report + Spoilerfree Summary + Evidence | `…/mystery-infoflow` @ `006ecf36` | EXPERIMENTAL_EVIDENCE | NO-GO für vollständiges Produktionszertifikat |
| SRC-M-SCALE | Mystery Scale & Complexity Report + Evidence | `…/MYSTERY-SCALE-COMPLEXITY` @ `27dd70f0` | EXPERIMENTAL_EVIDENCE | GO WITH CHANGES für TINY/MEDIUM; Node-Lab, keine Smartphone-Messung |
| SRC-M-AUTH | Mystery Case Authoring Stress Report (PDF) + Experimental Appendix | `…/MYSTERY-CASE-AUTHORING-STRESS` @ `8b68e511` + `…/MYSTERY_CASE_AUTHORING_STRESS_REPORT` @ `8df14a32` | EXPERIMENTAL_EVIDENCE | Evidenz |
| SRC-M-VS5 | VS-5 Preflight (nur Ergebnis-JSON, prototypeOnly) | `…/MYSTERY-VS5-PREFLIGHT` @ `284ea9de` | EXPERIMENTAL_EVIDENCE | Scratch-Ergebnis; 123 Prototyp-Checks sind keine aktuelle Session-Evidenz (SRC-M-RPC §1) |
| SRC-M-VSP | Vertical Slice Preflight (Scratch-Probes) | `…/MYSTERY-VERTICAL-SLICE-PREFLIGHT` @ `79e1f81d` | EXPERIMENTAL_EVIDENCE | Scratch ohne Vertragsdokument (Owner Reconciliation B.0.2) |
| SRC-F-ROQ | Reference Oracle Quality Report (61 Goldens, 16 Reference-Abweichungen) | `…/reference-oracle-quality` @ `83214206` | INDEPENDENT_REVIEW | NO-GO für unveränderte Reference als Codex-Oracle |
| SRC-F-CERT | A/B/C Independent Certification (F01–F10) | `…/VERIFIER-ABC-INDEPENDENT-CERTIFICATION` @ `b854b113` | INDEPENDENT_REVIEW | REQUEST CONTRACT CHANGES (A/B/C r1); Defektregister für r2 |
| SRC-F-RA | V0.1 Independent Readiness Audit | `…/FORGE-V0.1-INDEPENDENT-READINESS-AUDIT` @ `32b1cfe8` | INDEPENDENT_REVIEW | GO WITH BLOCKERS (Stand 2026-10-03) |
| SRC-H-FORGE-DEEP-RED-TEAM | Forge Deep Red Team (+ x.test.ts) | `…/FORGE-DEEP-RED-TEAM` @ `e42e4ae3` | INDEPENDENT_REVIEW | HISTORICAL |
| SRC-H-FORGE-PIPELINE-ADVERSARIAL-CHALLENGE | Pipeline Adversarial Challenge | `…/FORGE-PIPELINE-ADVERSARIAL-CHALLENGE` @ `ae84c3fd` | INDEPENDENT_REVIEW | HISTORICAL |
| SRC-M-FV | Mystery Independent Freeze Verification (11 Blocking Findings) | `…/MYSTERY-INDEPENDENT-FREEZE-VERIFICATION` @ `25a8a17b` | INDEPENDENT_REVIEW | NO-GO (Stand 09:19Z); Kriterien C1–C11 bleiben Prüfmaßstab für Re-Verifikation (Queue P4.2) |
| SRC-V-CERT | Die leere Vitrine: Formal Solvability Certification + Proof Profile + Evidence | `…/DIE-LEERE-VITRINE-SOLVABILITY-CERTIFICATION` @ `e66e7e19` | INDEPENDENT_REVIEW | NOT CERTIFIED für die aktuelle Vertragskette; Proof Profile + factivity bridge = Repair-Kandidaten |
| SRC-F-V2PF | Contract V2 Implementation Preflight (V2PF) + Lab-Modelle | `…/FORGE-CONTRACT-V2-IMPLEMENTATION-PREFLIGHT` @ `421c4ede` | REFERENCE_ONLY | REFERENCE: Anforderungsquelle für die CORE-0002-Revision (D7); 'new tasks use Format 2' gilt erst ab BOOTSTRAPPED (D1) |
| SRC-F-DRILL | Ruleset Live Drill (R1–R7 + Actions Execution Policy, 91 Fälle, Owner-Runbook) | `…/FORGE-RULESET-LIVE-DRILL` @ `005bcd09` | REFERENCE_ONLY | Quelle und Drill-Material des Runbooks (Templates, Skripte, 91 Fälle); Ablauf/Sollwerte jetzt SRC-F-RUNBOOK; LIVE NOT EXECUTED; R2-Template-Fehler per D4 (Drill-Paket r2, Queue P0.2) |
| SRC-F-PM | First Drill Pre-Mortem (clampAtZero, PASS-Kriterien, Blocker B0–B7) | `…/FORGE-FIRST-DRILL-PRE-MORTEM` @ `9e5789e0` | REFERENCE_ONLY | Quelle des Runbook-Drillteils; PASS-Wortlaut per D4/8c korrigiert im Runbook; LIVE-START NO-GO, DRILL NOT EXECUTED |
| SRC-F-T4 | TASK-0004 Dependency Handoff + M1-Verifikation | `…/TASK-0004-DEPENDENCY-HANDOFF` @ `edbd3b52` + `…/TASK-0004-M1` @ `549ee577` | REFERENCE_ONLY | TASK-0004 ist durch Baseline-Merge 3d7545d historisch akzeptiert (FRZ Entscheidung (c)); nie neu registriert |
| SRC-P-CODEXINV | Codex Artifact Persistence Inventory | `…/CODEX-ARTIFACT-INVENTORY` @ `26b8804b` | REFERENCE_ONLY | Sammelprotokoll; 69 Artefakte als 'sensitive blocked' nicht veröffentlicht |
| SRC-V-CASE | Die leere Vitrine: Headless Spec, Player Brief, Scratch Case Pack | `…/DIE-LEERE-VITRINE` @ `fa3a1cbf` | REFERENCE_ONLY | Fallinhalt-Quelle für Re-Authoring (P5.2); Belegpflicht durch D8 überholt; Scratch-PlayerRef-Protokoll ohne MYST-0001-Kompatibilität |
| REF-PERSIST | PERSISTENCE-REPORT-2026-10-04.md | nur Projektordner | REFERENCE_ONLY | Persistenzprotokoll 2026-10-04 ~10:55Z |
| REF-MAIN-LEGACY | Legacy auf main 3d7545d: forge/contracts (FORGE-CORE-0001A/B, PATCH-0001, B.v2, TASK-0004), forge/approvals, forge/reviews, forge/coordination, BASELINE-STATUS | `main` @ `3d7545d8` | REFERENCE_ONLY | Legacy eingefroren, nie umschreiben (FRZ Punkt 11); TASK-0001…0004 historisch akzeptiert |
| SRC-F-ABC-R1 | FORGE-BOOTSTRAP-0001A/B/C Contract Drafts r1 + Minimum Verifier Implementation Package (PKG r1) | `…/FORGE-MINIMUM-VERIFIER-IMPLEMENTATION` @ `bb525bfd` | SUPERSEDED | SUPERSEDED (contractVersion 1); historisch unverändert lassen |
| SRC-F-ABC-REPAIR | FORGE-BOOTSTRAP-0001A/B/C contract.CANDIDATE (contractVersion 2) + Targeted Repair Report | `…/FORGE-VERIFIER-ABC-REPAIR` @ `5fdc4169` | SUPERSEDED | SUPERSEDED als Candidate durch r2 (Reparaturbasis laut Seb 17:31:35Z und R2-Manifest 'repairBasis'); bleibt Evidenz der Repair-Herleitung |
| SRC-F-V0001-DRAFT | FORGE-VERIFIER-0001 Contract Draft (341ec983) + V0.1 Verifier Implementation Package | `…/FORGE-V0.1-VERIFIER-IMPLEMENTATION-PACKAGE` @ `5a847a78` | SUPERSEDED | SUPERSEDED (CERT: NOT COMPARABLE; Owner Reconciliation A.0, D.1 OE-11) |
| SRC-F-V01-RECON | FORGE-VERIFIER-0001 Final Contract Reconciliation (V01R) + prior-v01-draft | `…/FORGE-VERIFIER-0001` @ `b22fd25b` | SUPERSEDED | SUPERSEDED: gab keinen Contract aus ('Not issued'); Anforderungen requiredChecks typecheck/test und 400/20 gelten erst ab BOOTSTRAPPED (D1) |
| SRC-F-BOOTPLAN | V0.1 Bootstrap Contract Plan (Q01–Q29, OD-B1..B8) | `…/FORGE-V0.1-BOOTSTRAP-CONTRACT-PLAN` @ `67baaad7` | SUPERSEDED | SUPERSEDED: Queue durch A/B/C-DAG + Queue P0–P5 ersetzt (Owner Reconciliation A.0); OD-B1/B3–B7 beantwortet (D.1) |
| SRC-H-OVERNIGHT-EXECUTION-PLAN | Overnight Execution Plan | `…/OVERNIGHT-EXECUTION-PLAN` @ `47b40d45` | SUPERSEDED | SUPERSEDED |
| SRC-M-T5 | TASK-0005 v2 Contract (Deterministic NPC Dialogue Policy) + Self-Audit, Mutation Plan, Test Vectors | `…/TASK-0005` @ `b6d0a188` | SUPERSEDED | SUPERSEDED durch MYST-0005A/B (D9c) |
| SRC-M-0002 | MYST-0002 Accusation & Verdict FINAL-CANDIDATE + Repair Report/Evidence | `…/MYST-0002-REPAIR` @ `ea22147f` | SUPERSEDED | SUPERSEDED als Candidate durch MYST-0002 v2 in SRC-M-INT (F05, F08); Manifest supersededArtifacts |
| SRC-M-0002-V1 | MYST-0002 Accusation-Verdict V1 Draft + Package | `…/MYST-0002-ACCUSATION-VERDICT` @ `cda9171e` | SUPERSEDED | SUPERSEDED durch FINAL-CANDIDATE (FR §17 'MYST-0002 Draft v1 SUPERSEDED') |
| SRC-M-0004 | MYST-0004 Evidence Presentation V1 (+ Package) | `…/MYST-0004-EVIDENCE-PRESENTATION` @ `51c2ddc4` | SUPERSEDED | SUPERSEDED als Candidate durch MYST-0004 v2 in SRC-M-INT (F01-Pin) |
| SRC-M-0005B | MYST-0005B Interrogation Release V1 | `…/MYST-0005-INTERROGATION` @ `76405cd3` | SUPERSEDED | SUPERSEDED als Candidate durch MYST-0005B v2 in SRC-M-INT (F01-Pin, F06) |
| SRC-M-CH | MYST-CHALLENGE-0001 Draft + Accusation Challenge Exactness Report + Evidence | `…/MYST-ACCUSATION-CHALLENGE-EXACTNESS` @ `7514e7e6` | SUPERSEDED | SUPERSEDED als Candidate durch MYST-CHALLENGE-0001 v2 in SRC-M-INT (F05, F12-Pin); Exactness-Report bleibt Evidenz |
| SRC-M-SESS | MYST-SESSION-0001A/B/C Drafts + Session Production Package + Acceptance-120 | `…/MYSTERY-SESSION-PRODUCTION-PACKAGE` @ `b94db40e` | SUPERSEDED | SUPERSEDED als Candidate durch MYST-SESSION-0001A/B/C v2 in SRC-M-INT; Production Package bleibt Evidenz |
| SRC-M-CONSOL | Mystery Contract Consolidation Plan (OD-C1..C11) | `…/MYSTERY-CONTRACT-CONSOLIDATION` @ `6982a0aa` | SUPERSEDED | SUPERSEDED durch FR, wo abweichend (insb. MYST-0006/0007/0008-Nummerierung) |
| SRC-H-FORGE-DEEP-AUDIT | Forge Deep Audit (03.10.) | `…/FORGE-DEEP-AUDIT` @ `d5f4b0fa` | HISTORICAL_DESIGN | HISTORICAL |
| SRC-H-FORGE-V0.1-HARDENING-PLAN | V0.1 Hardening Plan | `…/FORGE-V0.1-HARDENING-PLAN` @ `5d1e3fe9` | HISTORICAL_DESIGN | HISTORICAL |
| SRC-H-FORGE-V0.1-MINIMUM-PRODUCT | V0.1 Minimum Product | `…/FORGE-V0.1-MINIMUM-PRODUCT` @ `3fc167ba` | HISTORICAL_DESIGN | HISTORICAL |
| SRC-H-FORGE-IDENTITY-GITHUB-PROTECTION | Identity & GitHub Protection | `…/FORGE-IDENTITY-GITHUB-PROTECTION` @ `5333a3ce` | HISTORICAL_DESIGN | HISTORICAL |
| SRC-H-FORGE-ORGANIZATION-MIGRATION-DELTA | Organization Migration Delta | `…/FORGE-ORGANIZATION-MIGRATION-DELTA` @ `dc97e40b` | HISTORICAL_DESIGN | HISTORICAL |
| SRC-H-FORGE-RUN-RECOVERY | Run Recovery | `…/FORGE-RUN-RECOVERY` @ `046ca5f0` | HISTORICAL_DESIGN | HISTORICAL |
| SRC-H-FORGE-INDEPENDENT-VERIFIER-DESIGN | Independent Verifier Design | `…/FORGE-INDEPENDENT-VERIFIER-DESIGN` @ `36a77a3f` | HISTORICAL_DESIGN | HISTORICAL |
| SRC-H-FORGE-CONTRACT-SYSTEM-V2 | Contract System V2 | `…/FORGE-CONTRACT-SYSTEM-V2` @ `e9ce18ac` | HISTORICAL_DESIGN | HISTORICAL |
| SRC-H-FORGE-CONTRACT-HANDOFF-AUDIT | Contract Handoff Audit | `…/FORGE-CONTRACT-HANDOFF-AUDIT` @ `62fb31ce` | HISTORICAL_DESIGN | HISTORICAL |
| SRC-H-FORGE-FIRST-MANAGED-RUN-DRILL | First Managed Run Drill (03.10.) | `…/FORGE-FIRST-MANAGED-RUN-DRILL` @ `242c8262` | HISTORICAL_DESIGN | HISTORICAL |
| SRC-H-MYSTERY-ACCUSATION-VERDICT-DESIGN | Accusation & Verdict Design | `…/MYSTERY-ACCUSATION-VERDICT-DESIGN` @ `de8fcce2` | HISTORICAL_DESIGN | HISTORICAL |
| SRC-H-MYSTERY-SOLVABILITY-V1-RESEARCH | Solvability V1 Research | `…/MYSTERY-SOLVABILITY-V1-RESEARCH` @ `04e71f06` | HISTORICAL_DESIGN | HISTORICAL |
| SRC-H-MYSTERY-VERTICAL-SLICE-ROADMAP | Vertical Slice Roadmap (VS-1…VS-5) | `…/MYSTERY-VERTICAL-SLICE-ROADMAP` @ `5e8bcc69` | HISTORICAL_DESIGN | HISTORICAL |
| SRC-H-MYSTERY-VS2-IMPLEMENTATION-DESIGN | VS-2 Implementation Design | `…/MYSTERY-VS2-IMPLEMENTATION-DESIGN` @ `25e18a77` | HISTORICAL_DESIGN | HISTORICAL |
| SRC-H-MYSTERY-TASK-0006-CANDIDATES | TASK-0006 Candidates | `…/MYSTERY-TASK-0006-CANDIDATES` @ `586243c9` | HISTORICAL_DESIGN | HISTORICAL |
| REF-OLD-BRANCHES | Ältere Nicht-Audit-Branches: codex/mystery-task-0005, codex/task-0004-contract, codex/forge-core-v2-repair, claude/forge-architecture-review-hjdq89, forge/run/codex/IDENTITY-SPIKE-1 | Nicht-Audit-Branches | HISTORICAL_DESIGN | HISTORICAL; nicht Teil von forge/owner/audits/**, nur zur Herkunft |
| PRIVATE-FBR | FORGE-V0.1-FINAL-BOOTSTRAP-RECONCILIATION.md (FBR) | nur Projektordner | PRIVATE/BLOCKED | BLOCKED_SENSITIVE_ARTIFACT (enthält private E-Mail-Adresse); nur über Zitate in der Owner Reconciliation verwendbar |

---

## 3. Bindende Ownerentscheidungen

### 3.1 D1–D10

Quelle: `FORGE-MYSTERY-FINAL-OWNER-RECONCILIATION` §D (Branch-Commit `52dab20b`). Annahme: Seb im Projekt-Chat am 2026-10-04 um 17:31:04Z („Die Owner-Entscheidungen D1–D10 … sind angenommen“), wiederholt in den Aufträgen 17:31:31Z (D1–D7 für Forge) und 17:31:35Z. Die Annahme liegt nicht als Datei in Git; Queue P0.1 sah ein Entscheidungsprotokoll als Datei vor.

| D | Thema | Entscheidung | Betroffene Artefakte | Löst | Ersetzt |
|---|---|---|---|---|---|
| D1 | Bootstrap-Format und -Policy | FORGE-BOOTSTRAP-0001A/B/C und Drill-Contract sind Format-1-Bootstrap mit eigenen requiredChecks forge-v01:* und contract-spezifischen LOC-Grenzen. 'New tasks use Format 2' und 400/20-Defaults gelten ab BASE = BOOTSTRAPPED. | SRC-F-ABC-REPAIR; SRC-F-R2; SRC-F-CORE0002; SRC-F-V2PF; SRC-F-V01-RECON; SRC-F-FRZ §16; SRC-M-FR §17 | A wäre nach V01R/V2PF-Regeln 'Freeze-policy-invalid'; verhindert stilles Vorziehen von CORE-0002. | FRZ §16 Sequenz und Format-1-Menge; V2PF 'new tasks use Format 2' (zeitlich); V01R requiredChecks typecheck/test, 400/20 (zeitlich); Bootstrap Plan Q10–Q12; FR §17 Format-1-Menge {VERIFIER-0001, CORE-0002} |
| D2 | Review-Beobachtungsgrenze (CERT F02) | reviewSnapshotDigest wird im Gate-Receipt gebunden; Mutant C5. | SRC-F-R2 (C); SRC-F-ABC-REPAIR (Patch C-1 deckt sich); SRC-F-CERT F02 | Review-Änderung zwischen Gate und Stage 2 bleibt nicht unbemerkt. | Alternative 'nur Stage-2-Frische, AV-154 abgeschwächt' |
| D3 | Review-Schema und Fremdcheck-Grenze (CERT F04, F09) | (a) severity {info, minor, major, critical}, blocking = major/critical; (b) supersedes fail-closed inkl. DISMISSED und fehlerhafter FORGE-Bodies, keine Transitivität; (c) OWNER_OPS allein Owner-attestiert; (d) fremde gleichnamige Checks als Deployment-Abnahme (POLICY_DEPLOYMENT), kein zusätzliches GET. | SRC-F-R2 (C); SRC-F-ABC-REPAIR (Patch C-2 weicht ab: Enum critical|high|medium|low|info, transitive Closure); SRC-F-CERT F03/F04/F09 | Offene Review-Schemas und Sollcodes; deterministisches PASS ohne neue API-Fläche. | abweichende Schema-Varianten in SRC-F-ABC-REPAIR Patch C-2 (nach Regel R-SEB-1731 Rang 1 > Rang 2) |
| D4 | R2/R3-Plattformmodell | R2 nur Merge Commit; R3-PR-only-Owner-Bypass ist beabsichtigte, protokollierte Owner-Autorisierung; FRZ Z. 162 und PM-PASS-Wortlaut werden angepasst (Repairs 8a–8c). | SRC-F-DRILL (R2-Template); SRC-F-PM (PASS-Wortlaut); SRC-F-FRZ Z. 162; SRC-F-RUNBOOK; SRC-F-R2 (C: Drill-PASS-Liste 8d) | Drill-Exit unter sieben Rulesets erreichbar; kein falsches 'zero bypass'-PASS-Kriterium. | literal 'kein Bypass' (FRZ Z. 162, PM); R2-Template mit squash/rebase |
| D5 | Reviewer-Besetzung | A/B/C (Developer Codex/OpenAI): Claude (Anthropic) als externer Reviewer; Mystery-Repairs von Claude: Codex-Lab als unabhängiger Prüfer; Attestation immer durch Seb. | SRC-F-R2; SRC-M-INT; Queue P1.2, P4.2 | OE-1 / OD-B8; Providerunabhängigkeit. | offene Reviewerfrage OE-1, OD-B8 |
| D6 | Rolle der Reference / des Oracles | Golden-Paket (61 Fälle + 24 Property-Familien) = normatives Regressionsorakel, gegen r2 neu bestätigt; 150-Repo-Korpus nur explorativ; Reference wird nicht als Autorität repariert, Korpusfall '0-legitimate' umgelabelt. | SRC-F-ROQ; SRC-F-REF; SRC-F-ORACLE-V2; SRC-F-R2 | Korrektes A/B/C scheitert nicht an 16 Reference-Fehlern. | Reference als Gleichheitsorakel |
| D7 | CORE-0002 nach BOOTSTRAPPED | Einmaliges, im Policy-File benanntes CORE-Profil (Owner-PR) für genau CORE-0002; CORE-0002 ist der einzige Format-2-Strang; V2PF dient als Anforderungsquelle seiner Revision. | SRC-F-CORE0002; SRC-F-V2PF; Mystery-Registrierung (Format 2) | Bootstrap-Verifier würde CORE-0002 sonst korrekt ablehnen; Mystery-Registrierung bliebe blockiert. | V2PF CS2-01..03 als eigener Strang |
| D8 | Vitrine-Siegbedingung (Mystery F04) | Session-V1-Siegbedingung: richtige vollständige Antwort = solved; keine technische Belegpflicht; Evidence/Proof = Deduktion und Zertifizierung; Belegpflicht später nur über eigenen Challenge-Policy-Contract. | SRC-V-CASE; SRC-V-CERT; SRC-M-SESS (SA-Statuszeile); SRC-M-FBR F04; PENDING-V-PACK; SRC-M-INT | F04 Vitrine-Belegpflicht vs Session V1. | Vitrine-Belegpflicht als Siegbedingung (Spec/Brief) |
| D9 | Owner neuer Mystery-Normtexte und Altlasten | (a) Release→Proof-Adapter und PublicContent gehören in Session A §2 (Runner in Fallabnahme); (b) VS-5 durch Session A/B/C ersetzt; (c) TASK-0005 v2 durch MYST-0005A/B ersetzt. | SRC-M-SESS; SRC-M-RPC; SRC-M-PKG; SRC-M-VS5; SRC-M-T5; SRC-M-0005A; SRC-M-0005B; SRC-M-INT | F02 Producer-Ownership; OD-1; CROSS R1 / CERT-V R7. | VS-5-Vertrag; TASK-0005 v2 (und FRZ-Plan 'TASK-0005 v3 bei VS-3') |
| D10 | Bestätigung überholter Mystery-Entscheidungen | OD-4 = Nein (Saves binden Text); OD-6 = Nein (allowedClaims dürfen false/undetermined enthalten); OD-7 = Nein (öffentliche Texte identitätsgebunden); M2-Owner-Review N-1…N-4 angenommen; OE-M3-1..5, OE-M4-1..8, OE-M5-2..7 wie im Contracttext umgesetzt. | SRC-M-0002; SRC-M-0003; SRC-M-0004; SRC-M-0005A; SRC-M-0005B; SRC-M-CH; SRC-M-SESS (SC); SRC-M-FR (OD-4/6/7) | Formale Lücke zwischen Contracttext und Owner-Protokoll. | offene OD-4, OD-6, OD-7 und OE-M3/M4/M5-Punkte |

### 3.2 Weitere bindende Owner-Vorgaben (bereits vor D1–D10)

| Vorgabe | Quelle |
|---|---|
| Vorrangregeln 1–3 und „Owner-Entscheidungen werden nicht neu verhandelt“ | FRZ, Kopf |
| Merge Commit als Merge-Methode; Identitäten Wuerfelduell / forge-codex; Identity-Spike PASS | FRZ, Kopf und §1 |
| Contracts sind versionierte Dateien in Git; der Developer liest sie nur aus Git | Seb 2026-10-03 07:02Z; FRZ T-06 |
| Kanonisches Repo `Forge-Dice/Forge`; `Wuerfelduell/Forge` nur Herkunft | FRZ-Vorrangregel 3 |
| GitHub-Persistenz von Claude nur über eine eigene Claude-Contributor-Identität | Seb 2026-10-04 17:31–17:32Z (alle vier Aufträge und dieser) |

---

## 4. Forge Authority Map

„Entscheidet“ heißt: bei Widerspruch gilt diese Quelle. „Interim“ heißt: gilt, bis der genannte PENDING-Nachfolger vorliegt.

| Frage | Entscheidet | Interim / Ergänzung | Nicht als Autorität |
|---|---|---|---|
| Gesamtarchitektur, Rollen, Prozess, Contract-Format 2, Gate-Struktur (`forge-gate` + `forge-verify`) | FRZ | — | Deep Audit, Hardening Plan, Verifier Design, Contract System V2 |
| Welche Bootstrap-DAG gilt? | Owner Reconciliation A.0 + D1: FORGE-BOOTSTRAP-0001A → B → C (Format 1), dann Drill | — | FRZ §16, Bootstrap Contract Plan Q01–Q29, FBR-Knotennamen |
| Contract-Text A/B/C | **SRC-F-R2** (r2, contractVersion 2; Projektordner, Git-Persistenz offen) | — | ABC-REPAIR-Candidates (Reparaturbasis), r1-Drafts, VERIFIER-0001 341ec983, V01R |
| Normative Paketdetails, auf die A/B/C verweisen | PKG r1 HTML, gebunden durch r2 über Datei-Hash `27bb408d…` (§§1–18) plus OLD→NEW-Overrides im Contract | Abweichung von Owner Reconciliation A.1 (separate r2-Datei) ist im r2-Report selbst dokumentiert; Bewertung im Review P1.2 (§8.1a) | Codex-Handoff-TXT im PKG-Branch |
| Review-Schema, Severity, Blocking, supersedes | **D3**, umgesetzt in r2 C | — | ABC-REPAIR Patch C-2 (weicht von D3 ab, siehe §8.1) |
| Gate↔Stage-2-Bindung | **D2** (`reviewSnapshotDigest`), im r2-C-Text enthalten | — | — |
| Regressionsorakel | **D6**: Golden-Paket aus Reference Oracle Quality (61 + 24 Property-Familien), gegen r2 neu bestätigt | — | Verifier Reference als Gleichheitsorakel; 150-Repo-Korpus |
| Differentialprüfung | High-Confidence Oracle V2 (eigene Rolle „GO AS DIFFERENTIAL ORACLE“) | Erwartungen sind gegen r1 gebunden und müssen gegen r2 neu gepinnt werden | Oracle V2 gegen Contract-Text |
| Execution Isolation | Deployment-Gate (Owner Reconciliation Blocker 7); Anforderungen in r2 C §9 (EI-01…EI-20), Live-Nachweis im Runbook | Execution-Isolation-Lab als Anforderungsherkunft | EI-Lab als „bestanden“; EI-Datei als registrierter Contract |
| Rulesets R1–R7, Actions Execution Policy, Aktivierungsfolge | **SRC-F-RUNBOOK** (Phasen P0–P7, eigene Nummerierung), gebunden an D4 | Ruleset Live Drill als Template-/Skriptmaterial (R2-Template-Fehler per D4) | „zero bypass“-Formulierungen (FRZ Z. 162, PM) |
| Drill D1 clampAtZero, D2–D9, PASS-Liste | SRC-F-RUNBOOK (Evidence Sheet) + C r2 (Drill-PASS-Liste 8d) | First Drill Pre-Mortem als Quellmaterial | First Managed Run Drill (03.10.) |
| Break Glass / Halt | Owner Reconciliation D.1 (OD-B4): Actions aus + R3-Bypass entfernen + Runs canceln | Ruleset Live Drill Freeze-Verfahren | Halt-Ruleset aus dem Bootstrap Plan |
| BOOTSTRAPPED-Kriterien | SRC-F-RUNBOOK §10 (E1–E9), abgeleitet aus Queue P3.3 | — | — |
| CORE-0002 / Format 2 | D1 (erst ab BOOTSTRAPPED) + D7 (CORE-Profil, einziger F2-Strang) | CORE-0002 Draft v1 als Ausgangstext; V2PF als Anforderungsquelle | V2PF „new tasks use Format 2“ vor BOOTSTRAPPED; V2PF-Lab-Encodings |
| Reviewer-Besetzung | D5 | — | — |
| Legacy TASK-0001…0004, FORGE-CORE-0001* | `main` 3d7545d, eingefroren (FRZ Punkt 11, Entscheidung (c)) | — | TASK-0004-Handoff als offener Auftrag |

---

## 5. Mystery Authority Map

Die aktuelle Candidate-Identität je taskId bestimmt `MYSTERY-FINAL-CONTRACT-MANIFEST.json` aus **SRC-M-INT** (Projektordner `forge-audits/MYSTERY-FINAL-CONTRACT-INTEGRATION/`, 17:48Z, Manifest-SHA-256 `b8f0a90e…`; noch nicht in Git). „v2“ = Datei in `candidates/`; „UNCHANGED“ = Originaldatei auf dem Audit-Branch bleibt die Identität. Alle sind vom Autor als review-bereit gemeldet und noch nicht unabhängig re-verifiziert (P4.2).

| Bereich | Aktuelle Candidate-Autorität | Bindende Owner-Vorgabe | Nicht als Autorität |
|---|---|---|---|
| PlayerRef | MYST-0001 v1, UNCHANGED (fcv2 `f4d31858…`); Einbindung/Pins stehen in M4 v2, M5B v2, Session A v2 | D10 | Vitrine-Scratch-Protokoll `case-scratch-playerref-v1`; FV-Befund „MYST-0001 NOT AVAILABLE“ |
| Accusation / Canonical Consistency | MYST-0002 v2 (raw `8e66e861…`; alleinige Autorität für Canonical Consistency) | D10 (N-1…N-4) | MYST-0002 V1 Draft; FINAL-CANDIDATE v1 `e1eba9e1…`; Accusation-Verdict Design |
| Evidence Access | MYST-0003 v1, UNCHANGED | D10 (OE-M3) | MYST-0003 Package (Begründung) |
| Evidence Presentation | MYST-0004 v2 (raw `fd3f8ded…`) | D10 (OE-M4) | MYST-0004 v1; Package; Overnight-Nummerierung |
| Interrogation | MYST-0005A v1, UNCHANGED; MYST-0005B v2 (raw `feed5af3…`) | D9c, D10 (OE-M5) | TASK-0005 v2; MYST-0005B v1 |
| Challenge | MYST-CHALLENGE-0001 v2 (raw `03d034d5…`) | D8, D10 (OD-6: allowedClaims dürfen false/undetermined enthalten) | CHALLENGE v1; Exactness-Report als Normtext |
| Solvability | MYST-SOLVABILITY-0001 v1, UNCHANGED | D8, D9a | Solvability V1 Research; Scratch-Modelle |
| Session A (Package/PlayerKnowledge, PublicContent, Release→Proof-Adapter, Hash-Registry) | MYST-SESSION-0001A v2 (raw `38e5cb8a…`) | D9a, D10 | SA v1; VS-5 (D9b); Closure-Labs als eigene Quelle |
| Session B (Reducer, Siegbedingung) | MYST-SESSION-0001B v2 (raw `3e2a5ff6…`) | D8 | SB v1; VS-5-Prototyp-Checks |
| Session C (Save/Replay) | MYST-SESSION-0001C v2 (raw `76bc24d5…`) | D10 (OD-4: Saves binden Text) | SC v1; VS-5 |
| Proof (Release→Proof) | Session A v2 (Adapter normativ dort, D9a); Release-Proof Closure nur Patchquelle | D8, D9a | FR §5 Premise-Keys; Vitrine `factivity-bridge.REPAIR-CANDIDATE.json` |
| Package Identity / Hash-Registry | Session A v2 (Registry mit 18 Profilen eingebettet); Package/Replay Closure nur Patchquelle | D9a, D10 | ältere Package-Manifest-Designs im Vitrine-Pack |
| Replay | Session C v2 | D10 | VS-5 |
| Evidence-Pflicht / Siegbedingung | **D8**: Session V1, richtige vollständige Antwort = solved | D8 | Vitrine-Belegpflicht |
| IDs | FR §3 (P-1…P-7): spezialisierte IDs; MYST-0006/0007/0008 und TASK-0006…0010 nie vergeben; nächste Kernnummer MYST-0009 | — | Consolidation Plan §2.3/§2.4; Overnight Plan |
| Freeze / Änderungsregeln | FR §19 (FR-1…FR-5) | — | stille Draft-Edits |
| Registrierungsfolge | Owner Reconciliation Queue P4 (nach CORE-0002, single lane); Kantenklassen in SRC-M-INT `FINAL-DEPENDENCY-DAG.md` | D1, D7 | FR-Annahme „Format-1-Menge {VERIFIER-0001, CORE-0002}“ |
| Vitrine (Fallinhalt) | **PENDING-V-PACK**; Interim: Vitrine Headless Spec / Brief / Case Pack nur als Fallinhalt-Quelle. Die Fall-Deltas P11–P20 hat SRC-M-INT bewusst nicht angewandt | D8, D9, D10 | Scratch Case Pack als Produktionsdaten |
| Vitrine-Zertifizierung | Gate P5.3 mit echtem Reducer-Witness; Checkliste CERT-1…CERT-10 aus Release-Proof Closure | D8 | Scratch-Reducer als Witness; historische Zertifizierung (NOT CERTIFIED) |
| Freeze-Prüfmaßstab | Kriterien C1–C11 der Independent Freeze Verification, angewandt auf SRC-M-INT (P4.2, Prüfer per D5) | D5 | — |

---

## 6. Konfliktregel

Es gibt keine einzelne, für beide Domänen niedergeschriebene Gesamtordnung. Normativ formuliert sind diese Regeln, wörtlich aus den Originalen:

| ID | Regel | Quelle |
|---|---|---|
| R-FRZ | FRZ ist Leitreferenz; wo ein früherer Bericht abweicht, gilt FRZ; wo FRZ schweigt, gilt der jüngste Bericht, dann `main`. (1) Spätere empirische Befunde schlagen frühere Annahmen. (2) Code auf `main` schlägt jedes Design-Dokument. (3) Org-Topologie schlägt Personal-Repo-Annahmen. Owner-Entscheidungen werden nicht neu verhandelt. | FRZ Kopf |
| R-OWNRECON | Neuere Artefakte, die FRZ widersprechen, gelten nur als ausgewiesene Owner-Entscheidung oder Wortlautreparatur, nie still. | Owner Reconciliation Kopf |
| R-SEB-1731 | Bei widersprechenden Patchvorschlägen: 1. bindende Ownerentscheidung > 2. späteres experimentelles Closure-Ergebnis > 3. Originalcontract > 4. ältere Design-/Research-Artefakte. Abweichung dokumentieren. | Seb 17:31:04Z (nicht in Git) |
| R-FV | Fehlendes Original = NOT VERIFIED; ein Report ersetzt niemals einen Contract. | Independent Freeze Verification |
| R-FR19 | Nach Freeze: Änderung nur durch Review-/Implementation-Finding, Cross-Contract-Fehler oder neue Owner-Entscheidung; jede normative Änderung = neue Version mit `supersedes`; keine stillen Draft-Edits. | FR §19 |
| R-PROCESS | Contracts nur aus Git, am registrierten Commit. | Seb 2026-10-03; FRZ T-06 |

Abgleich mit der im Auftrag vorgeschlagenen Reihenfolge („spätere Ownerentscheidung > finaler reparierter Candidate > späteres Closure/Review für Evidenz > ursprünglicher Contract > historisches Design“): Die tatsächlich angenommene Regel ist R-SEB-1731. Sie stellt das **Closure-Ergebnis über den Originalcontract**, kennt aber keinen eigenen Rang „finaler reparierter Candidate“. Ein solcher Candidate (r2, Mystery-Integration) entsteht genau durch Anwendung von Rang 1 und 2 auf Rang 3. Er schlägt deshalb alles unter ihm, weil er sie integriert, nicht durch eine eigene Rangstufe. Ein Widerspruch zwischen einem fertigen Candidate und einer Owner-Entscheidung bleibt ein Fehler des Candidates (Rang 1 gilt).

Zusammenspiel, ohne neue Regel:
- R-FRZ (1) „spätere empirische Befunde schlagen frühere Annahmen“ betrifft **Fakten** (z. B. was GitHub tatsächlich tut). Es macht einen Lab-Bericht nicht zu Contract-Text; dafür gelten R-OWNRECON, R-FV und R-SEB-1731.
- R-FRZ (2) „`main` schlägt Design“ beschreibt den Ist-Zustand. Es macht Legacy-Code nicht zur Vorgabe für neue Tasks.

---

## 7. No Silent Authority: konkrete Anwendungen

| Regel | Betroffene Artefakte in diesem Bestand |
|---|---|
| Ein Lab-Report wird nicht normativ, weil er neuer ist | Execution Isolation (EI-Datei heißt „ACCEPTANCE-CONTRACT“, ist aber Lab-Ergebnis; normativ erst über r2 C §9); Oracle V2; Freeze Blocker Repair; Package/Replay Closure; Release-Proof Closure (alle 16:09–16:25Z, also neuer als die Owner Reconciliation, aber Rang 2, nicht Contract) |
| Ein Scratch-Modell wird nie Produktionsautorität | VS-5 Preflight (`prototypeOnly: true`), Vertical Slice Preflight, Vitrine Scratch Case Pack und `case-scratch-playerref-v1`, Release-Proof `model.py`, Package/Replay `lab.mjs`, V2PF-Lab-Encodings, Verifier Experimental Spike Parser-Probe, Verifier Reference |
| Ein historischer Draft überschreibt keinen finalen Candidate | MYST-0002 V1 Draft vs FINAL-CANDIDATE; VERIFIER-0001 341ec983 vs A/B/C; A/B/C r1 vs ABC-REPAIR v2 vs r2; MYST-0002/0004/0005B/CHALLENGE/SESSION v1 vs v2 (SRC-M-INT); TASK-0005 v2 vs MYST-0005A/B; Consolidation Plan vs FR |
| Ein Review gilt nur für den geprüften Stand | A/B/C Certification (r1), Freeze Verification (Stand 09:19Z), Vitrine Certification (alte Vertragskette), Readiness Audit (03.10.) |

---

## 8. Festgestellte Widersprüche (nur dokumentiert, nicht aufgelöst)

### 8.1 D3 vs ABC-REPAIR Patch C-2
`FORGE-VERIFIER-ABC-REPAIR-REPORT.md` Patch C-2 (16:10Z): severity `critical|high|medium|low|info`, disposition `block|note`, transitive supersedes-Closure. D3 (angenommen 17:31Z): severity `{info, minor, major, critical}`, blocking = major/critical, keine Transitivität. Nach R-SEB-1731 gilt D3. **Erledigt in r2:** C übernimmt D3 und lehnt das C-2-Schema ausdrücklich ab (r2-Authoring-Report Z. 110–120).

### 8.1a r2 und Owner Reconciliation A.1
Die Owner Reconciliation A.1 verlangt eine eigene Paketrevision r2 als einzige normative Quelle mit neuem Sectionhash und „Normativen Text nicht doppelt in Contract und Paket führen“. r2 legt keine eigene Paketdatei an, sondern bindet PKG r1 per Datei-Hash und schreibt die Repairs als OLD→NEW-Overrides in die Contracts. Der r2-Report nennt das selbst als Abweichung (Z. 47, Z. 123 „INTEGRATED-MOD“). Dieser Index bewertet das nicht; das Architektur-Review (P1.2) muss es prüfen.

### 8.2 Owner Reconciliation kennt sechs spätere Labs nicht
Die Owner Reconciliation (15:26Z) sagt „Kein nach 09:19Z committetes Mystery-Artefakt schließt einen Finding“. Danach entstanden Freeze Blocker Repair (16:09Z), Package/Replay Closure (16:18Z), Release-Proof Closure (16:25Z), ABC-Repair (16:10Z), Execution Isolation (16:12Z) und Oracle V2 (16:17Z). Diese Aussage beschreibt den Stand um 15:26Z. Die D-Entscheidungen bleiben unberührt; die Labs sind Rang-2-Quellen für die laufenden Integrationen.

### 8.3 Format-1-Menge
FRZ und FR §17 nennen {FORGE-VERIFIER-0001, FORGE-CORE-0002 (ggf. VERIFIER-0002)}. Durch A.0/D1 überholt: Format-1-Bootstrap = 0001A/B/C + Drill-Contract; CORE-0002 führt Format 2 ein und läuft nach BOOTSTRAPPED.

### 8.4 Doppelter Branch
`MYSTERY-CASE-AUTHORING-STRESS` und `MYSTERY_CASE_AUTHORING_STRESS_REPORT` enthalten byte-identische Dateien (PDF-Blob `6eb6840a…`, ZIP-Blob `10339496…`). Indiziert als ein Artefakt.

### 8.5 Oracle-Rollen
Es gibt drei Orakel-Artefakte mit verschiedenen Rollen: das Golden-Paket (normativ per D6), die Verifier Reference (nur Differential, nicht repariert) und Oracle V2 (Differential, unabhängig gebaut). Kein Original erklärt, dass Oracle V2 die Reference ersetzt (Supersession Map S-F6).

### 8.6 Persönliche Daten in Commit-Metadaten
Die Commits der `forge-codex`- und `Diceduel`-Autoren auf mehreren Audit-Branches tragen eine persönliche E-Mail-Adresse im Autor-Feld. Das ist keine Artefaktklassifikation; es betrifft dieselbe Datenschutzfrage, wegen der FBR blockiert ist.

---

## 9. Nachfolger aus den laufenden Threads

Geprüft beim Start (17:36Z: nichts vorhanden) und erneut vor Abschluss (17:47Z, 17:49Z und 17:52Z, Remote-Branch und Projektordner). Kein Remote-Branch existiert. r2, Mystery-Integration und Runbook melden dieselbe Identitätssperre wie dieser Index; die Vitrine hat noch nicht abgeschlossen. Aufgenommen ist nur, was als vollständiger Satz vorlag.

| ID | Erwarteter Branch | Erwarteter Pfad | Stand 17:52Z / Interim |
|---|---|---|---|
| SRC-F-R2 | `forge/owner/audits/FORGE-BOOTSTRAP-R2-FINAL-CONTRACTS` (nicht vorhanden) | **vorhanden im Projektordner** `FORGE-BOOTSTRAP-R2-FINAL-CONTRACTS/`, 5/5 Dateien (17:46Z, Hashes in `source-index.json`) | aufgenommen als aktuelle A/B/C-Candidate-Quelle |
| SRC-F-RUNBOOK | `forge/owner/audits/FORGE-V0.1-FINAL-ACTIVATION-RUNBOOK` (nicht vorhanden) | **vorhanden im Projektordner** `FORGE-V0.1-FINAL-ACTIVATION-RUNBOOK/`, 4/4 Dateien + SHA256SUMS geprüft | aufgenommen als operative Quelle; Status AUTHORED — NOT EXECUTED |
| SRC-M-INT | `forge/owner/audits/MYSTERY-FINAL-CONTRACT-INTEGRATION` (nicht vorhanden) | **vorhanden im Projektordner** `MYSTERY-FINAL-CONTRACT-INTEGRATION/` (Report, Manifest, DAG, Closure-Matrix, Static Check, Patch-Log, 7 Candidates, reproduce/; SHA256SUMS geprüft, 17:48Z) | aufgenommen als aktuelle Mystery-Candidate-Quelle |
| PENDING-V-PACK | `forge/owner/audits/DIE-LEERE-VITRINE-FINAL-PACK` | `forge-audits/DIE-LEERE-VITRINE-FINAL-PACK/` (10 Dateien laut Auftrag) | in Arbeit: 9/10 Pflichtdateien im Projektordner (Integration Report fehlt). Vitrine Spec/Brief/Case Pack nur als Fallinhalt |

Wenn ein PENDING-Artefakt vollständig erscheint, ändert sich dieser Index nur in den Zeilen, die den Interim-Eintrag nennen. Ein Nachtrag prüft dann, ob das neue Artefakt D1–D10 einhält (insbesondere D3 bei r2, D8/D9/D10 bei Mystery und Vitrine).

---

## 10. Persistenz

Der GitHub-Connector dieser Session ist als `Wuerfelduell` authentifiziert (`get_me`, 2026-10-04 ~17:36Z). Nach Sebs Identitätsregel ist das keine Claude-Contributor-Identität. Deshalb wurde **nichts gepusht**; der Ziel-Branch `forge/owner/audits/FORGE-MYSTERY-NORMATIVE-SOURCE-INDEX` existiert nicht. Die Deliverables liegen nur im Projektordner `/mnt/project-files/forge-audits/FORGE-MYSTERY-NORMATIVE-SOURCE-INDEX/`.
