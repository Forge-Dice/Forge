# FORGE + MYSTERY — SUPERSESSION MAP

Stand: 2026-10-04 ~17:50Z · `main` = `3d7545d8` · IDs wie in [FORGE-MYSTERY-NORMATIVE-SOURCE-INDEX.md](FORGE-MYSTERY-NORMATIVE-SOURCE-INDEX.md) und `source-index.json`.

Aufgenommen ist eine Kette nur, wenn ein Original sie ausdrücklich ausspricht (Zitat- oder Abschnittsangabe in der Spalte „Beleg“). Ähnlichkeit, gleicher Name oder späteres Datum reichen nicht. Kandidaten, für die kein Beleg gefunden wurde, stehen in §3.

Legende: `→` = wird ersetzt durch · `⇢` = wird ersetzt durch (PENDING, noch nicht vorhanden) · `[Dn]` = durch Ownerentscheidung.

SRC-F-R2, SRC-M-INT und SRC-F-RUNBOOK liegen nur im Projektordner, nicht in Git (Identitätssperre). Ihre Supersession gilt für den Candidate-Status; Implementierungsautorität entsteht erst durch Persistenz, Review und Registrierung.

---

## 1. Forge

| # | Kette | Beleg |
|---|---|---|
| S-F1 | FRZ §16: VERIFIER-0001 ∥ CORE-0002 → VERIFIER-0002 → … → VERIFIER-0003 **→** FORGE-BOOTSTRAP-0001A → 0001B → 0001C (Format 1) → Drill → BOOTSTRAPPED → CORE-0002 | Owner Reconciliation A.0 („Sie ersetzt die Sequenz FRZ §16 … und die Queue Q01–Q29“); D1 |
| S-F2 | FORGE-VERIFIER-0001 Draft `341ec983` **→** FORGE-BOOTSTRAP-0001A/B/C | Owner Reconciliation A.0 („NOT COMPARABLE … wird nicht mehr verwendet“), D.1 OE-11, PB-1 |
| S-F3 | FORGE-BOOTSTRAP-0001A/B/C r1 (contractVersion 1, PKG r1 §§1–15 `0e6d8917…`) **→** ABC-REPAIR *.contract.CANDIDATE.md (contractVersion 2, Reparaturbasis) **→** SRC-F-R2 (A/B/C-v2, Projektordner 17:46Z, noch nicht in Git; bindet PKG r1 per Datei-Hash `27bb408d…` §§1–18) | ABC-REPAIR-Report („Version impact: A contractVersion 1→2“, OLD/NEW je Patch); Owner Reconciliation A.1 (r2, „Revision 1 (0e6d8917…) ist superseded“ als NEW-Text); Seb 17:31:35Z (Work-r2-Candidates als Basis, Historie unverändert); R2-Manifest `supersedes` (r1-Rohhashes) und `repairBasis` (ABC-REPAIR `5fdc4169`) |
| S-F4 | VERIFIER-0001 Final Contract Reconciliation (requiredChecks typecheck/test, 400/20, „new tasks use Format 2“) **→** [D1] gilt erst ab BOOTSTRAPPED | Owner Reconciliation A.5(d), D1 |
| S-F5 | Bootstrap Contract Plan (Q01–Q29, OD-B1..B8) **→** FBR (privat) **→** Owner Reconciliation Queue P0–P5 | Owner Reconciliation A.0, D.1 (OD-B1, B3–B7 als beantwortet) |
| S-F6 | Verifier Reference als Gleichheitsorakel **→** [D6] Golden-Paket (61 + 24) als normatives Regressionsorakel; Reference bleibt nur Differential-Referenz | D6; ROQ („NO-GO für die unveränderte Reference als normatives Codex-Oracle“) |
| S-F7 | V2PF als eigener Format-2-Strang (CS2-01..03) **→** [D7] CORE-0002 als einziger Format-2-Strang, V2PF nur Anforderungsquelle | D7 |
| S-F8 | R2-Template mit squash/rebase, „kein Bypass“-Wortlaut (FRZ Z. 162, PM-PASS) **→** [D4] R2 merge-only, R3-PR-only-Owner-Bypass beabsichtigt **→** SRC-F-RUNBOOK (R2 merge-only, R3-Bypass beabsichtigt, kein Zero-Bypass-Kriterium); Drill-Paket r2 selbst weiter offen | D4, Owner Reconciliation Blocker 8 (8a–8c), Queue P0.2 |
| S-F9 | Ruleset Live Drill + Pre-Mortem (Ablauf, Sollwerte, Evidence-Teil) **→** SRC-F-RUNBOOK (Projektordner) | Seb 17:31:31Z (Auftrag „EIN endgültiges Owner-Runbook“) |
| S-F10 | First Managed Run Drill (03.10., erster Run = MYST-0001) **→** Pre-Mortem D1 clampAtZero zuerst, Mystery nach Drill-Exit | Owner Reconciliation D.1 (OE-7) |
| S-F11 | Halt-Ruleset (Bootstrap Plan) **→** Freeze-Verfahren: Actions aus + R3-Bypass entfernen + Runs canceln | Owner Reconciliation D.1 (OD-B4) |
| S-F12 | Approval-Records `forge/approvals/*.json` (auf `main`), PKG OD-10 **→** Attestation als GitHub-Review auf dem Contract-PR | FRZ (Konflikt zu `forge/approvals`, „PKG OD-10 … ist ersetzt“) |
| S-F13 | Hardening Plan, Identity/GitHub Protection, Run Recovery, Independent Verifier Design, Pipeline Challenge, Deep Audit, Contract System V2 (jeweils in den genannten Punkten) **→** FRZ | FRZ-Abschnitt „Zusammenfassung der ersetzten Aussagen“ und die KONSEQUENZ-Zeilen je Entscheidung (z. B. HP D-2/§8.1, VD C8/AC-22/S10, RR F-01…F-03/F-20/SD-10, IGP §8–§10, HP D-14, DRILL A-1/A-2) |
| S-F14 | Personal-Repo `Wuerfelduell/Forge` **→** `Forge-Dice/Forge` | FRZ-Vorrangregel 3 |

## 2. Mystery

| # | Kette | Beleg |
|---|---|---|
| S-M1 | TASK-0005 v1 (fc01e4a) → TASK-0005 v2 (0453f85, `codex/mystery-task-0005`, persistiert auf `…/TASK-0005`) **→** [D9c] MYST-0005A (v1) + MYST-0005B (v2 in SRC-M-INT) | D9(c); Seb 17:31:04Z („TASK-0005 v2 wird durch MYST-0005A/B ersetzt“). Damit auch überholt: FRZ „TASK-0005 v3 bei VS-3“ |
| S-M2 | VS-5 (Roadmap-Slice, Preflight-Prototyp) **→** [D9b] MYST-SESSION-0001A/B/C (v2 in SRC-M-INT) | D9(b); Release-Proof Closure §1 („VS-5's 123 prototype checks … are not current Session evidence“) |
| S-M3 | Mystery Accusation-Verdict Design → MYST-0002 V1 Draft + Package **→** MYST-0002.contract.FINAL-CANDIDATE (v1, fcv1 `e1eba9e1…`) **→** MYST-0002 v2 in SRC-M-INT (F05, F08; Projektordner, noch nicht in Git) | FR §17 („MYST-0002 Draft v1 SUPERSEDED“); MYST-0002 Repair Report; Owner Reconciliation B.7, B.10; SRC-M-INT-Manifest `supersededArtifacts` |
| S-M4 | Consolidation Plan (MYST-0006 = Challenge, 0007 = Session/Replay, 0008 = Solvability; TASK-0006…0010 retired) **→** FR §3 (spezialisierte IDs; MYST-0006/0007/0008 und TASK-0006…0010 nie vergeben; nächste Kernnummer MYST-0009) | FR §3 („Ersetzt §2.3/§2.4 des Consolidation-Plans“); Owner Reconciliation D.1 (OD-C1) |
| S-M5 | Overnight Plan (MYST-0006/0007/0008-Bedeutungen) **→** FR §3 P-4 | FR §3 P-4 |
| S-M6 | FR §5 Release→Proof Premise-Keys (seen/reported/answered) **→** Owner Reconciliation B.4 (NEW REVISION in Session A) → Release-Proof Closure Session-A-Annex **→** Session A v2 in SRC-M-INT | Release-Proof Closure §1 („superseded by the fully sourced Master B.4/B.7“); D9(a); SRC-M-INT Report DV-07 |
| S-M7 | Freeze Blocker Repair: F02/F04 „STILL OPEN (D8/D9)“ **→** [D8, D9] angenommen | Seb 17:31:04Z §3; Release-Proof Closure §1 |
| S-M8 | Vitrine Belegpflicht als Siegbedingung **→** [D8] Session-V1-Siegbedingung | D8 |
| S-M9 | Vitrine Solvability Certification (NOT CERTIFIED, Proof Profile, factivity bridge als Repair-Kandidat) **→** Vitrine Recertification Checklist (Release-Proof Closure, CERT-1…CERT-10) **⇢** PENDING-V-PACK → Zertifizierung P5.3 | Release-Proof Closure §1 („historical certification says NOT CERTIFIED … repair candidates“); Seb 17:32:29Z |
| S-M10 | Vitrine Headless Spec / Brief / Scratch Case Pack **⇢** PENDING-V-PACK | Seb 17:32:29Z („Die vorhandene Vitrine bleibt der Fall“, Konsolidierung in ein finales Paket) |
| S-M11 | Originaldrafts MYST-0004, MYST-0005B, MYST-CHALLENGE-0001, MYST-SESSION-0001A/B/C (je v1) **→** jeweils v2 in SRC-M-INT. Unverändert (keine Supersession): MYST-0001, MYST-0003, MYST-0005A, MYST-SOLVABILITY-0001 | Seb 17:31:04Z §13/§15; SRC-M-INT-Manifest (`contracts[].status`, `candidateIdentity`) |
| S-M12 | Alle Mystery-F1-Drafts **→** Format 2 durch Transkodierung vor Registrierung (ohne Versionssprung) | FR §17 / FR-4(a); Owner Reconciliation B.16 |
| S-M13 | FR „NOT AVAILABLE“-Befunde (Challenge, Solvability, Session, VS-5, Vitrine, Reports) **→** alle auf Audit-Branches vorhanden | Owner Reconciliation D.1 (OD-2 / OD-C10), §1.1 |
| S-M14 | FV-Befund F01 „MYST-0001 NOT AVAILABLE“ **→** MYST-0001 vorhanden, F01 RESOLVED BY EXISTING CONTRACT | Owner Reconciliation B.0.1, B.1 |
| S-M15 | Offene OD-4, OD-6, OD-7, M2 N-1…N-4, OE-M3/M4/M5 **→** [D10] bestätigt | D10 |
| S-M16 | Overnight Plan: MYST-0004 = „Interrogation + Translator-Bridge (VS-4)“ **→** MYST-0004 = Evidence Presentation (Owner-Zuweisung); Interrogation läuft als MYST-0005A/B | MYST-0004 V1 Draft Z. 38 und Package Z. 7 („Nummernhinweis … Der Owner hat MYST-0004 diesem Task zugewiesen“); FR R-4b ersetzt den Hinweis später durch Verweis auf FR §3 |

## 3. Geprüft, aber nicht als Supersession bestätigt

| Vermutete Kette | Befund |
|---|---|
| Verifier Reference → High-Confidence Oracle V2 | **Nicht bestätigt.** Oracle V2 nennt sich „GO AS DIFFERENTIAL ORACLE“, listet 16 Reference-Divergenzen als REFERENCE BUG und leitet keine Erwartung aus der Reference ab, erklärt aber keine Ersetzung. D6 verlangt, die Reference nicht als Autorität zu reparieren; das ist eine Rollenänderung (S-F6), keine Nachfolge durch Oracle V2. Beide sind Differentialwerkzeuge; normativ ist das Golden-Paket. |
| Execution Isolation Lab → C-Contract | Nicht als Supersession, sondern als Anforderungsquelle: Seb 17:31:35Z „C muss die notwendige Isolation normativ fordern“. Erst SRC-F-R2 (C) macht EI-Anforderungen normativ. |
| Mystery Integration ersetzt Freeze Blocker Repair / Package Closure / Release-Proof Closure | Nein: Die Closures bleiben Evidenz (Rang 2). Die Integration wendet ihre Patches an; das ist Anwendung, keine Ersetzung des Evidenzberichts. |
| PKG r1 → separate Paketdatei r2 | Vorgesehen (Owner Reconciliation A.1), aber nicht erzeugt: r2 bindet PKG r1 per Datei-Hash und führt die Repairs im Contract (selbstdokumentierte Abweichung, Index §8.1a). PKG r1 ist deshalb **nicht** superseded. |

## 4. Nie umschreiben

Alle Artefakte links einer Kette bleiben byte-unverändert auf ihren Branches (FR §19 FR-3, FR P-6, FRZ Punkt 11, Seb 17:31:35Z „Historische r1-Artefakte unverändert lassen“). Supersession bedeutet hier ausschließlich: keine Autorität mehr für neue Arbeit.
