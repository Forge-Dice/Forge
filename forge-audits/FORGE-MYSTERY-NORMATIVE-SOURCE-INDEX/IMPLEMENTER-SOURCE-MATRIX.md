# IMPLEMENTER SOURCE MATRIX

Stand: 2026-10-04 ~17:50Z · `main` = `3d7545d8` · Details und IDs: [FORGE-MYSTERY-NORMATIVE-SOURCE-INDEX.md](FORGE-MYSTERY-NORMATIVE-SOURCE-INDEX.md)

**Grundregel für jeden Codex-Run:** Die einzige Implementierungsautorität ist der auf `main` registrierte Contract am im Handoff genannten `contractCommit` (Prozessregel, FRZ T-06). Heute ist **keiner** der unten genannten Tasks registriert. Jede Zeile beschreibt deshalb, was ein Run lesen wird, sobald der Contract registriert ist, und welche Quellen er nie als Autorität behandeln darf. Ein Developer liest keine Audit-Branches, um Semantik zu rekonstruieren; die Spalte READ nennt nur, was der registrierte Contract selbst referenziert oder was als Kontext nötig ist.

Spalte „Start frühestens“ = Queue-Position aus der Owner Reconciliation §C.

## Forge

| Wenn du implementierst | READ THESE | DO NOT USE AS AUTHORITY | Start frühestens |
|---|---|---|---|
| **FORGE-BOOTSTRAP-0001A** | registrierter Contract A v2 auf `main` (entsteht aus SRC-F-R2); die von ihm gebundene PKG-r1-HTML (Datei-Hash `27bb408d…`, §§1–18) mit den Overrides im Contract-Text; `main` als BASE | ABC-REPAIR *.CANDIDATE.md, r1-Drafts, PKG r1 ohne die Contract-Overrides, FORGE-MINIMUM-VERIFIER-CODEX-HANDOFF.txt, VERIFIER-0001 341ec983, V01R, Reference/Oracle-V2-Code, Execution-Isolation-Lab, Chat | P2.1: nach P1.3 (A registriert) und P0.4 (Plattform aktiv) |
| **FORGE-BOOTSTRAP-0001B** | registrierter Contract B (Revision v3 mit echtem `acceptedCommit` von A, P2.2) + gebundene PKG-r1-HTML; Code von A auf `main` | wie A; zusätzlich EI-ACCEPTANCE-CONTRACT.md als eigene Quelle (nur über B/C-Text verbindlich) | P2.2: nach Annahme von A |
| **FORGE-BOOTSTRAP-0001C** | registrierter Contract C (Revision v3 mit `acceptedCommit` B) + gebundene PKG-r1-HTML; D2/D3/D4 und EI-01…EI-20 stehen im C-Text | wie A; ABC-REPAIR Patch C-2 (weicht von D3 ab); Ruleset-Drill-Templates als Workflow-Vorlage | P2.3: nach Annahme von B |
| **Drill D1 clampAtZero** (`src/forge-drill/`) | registrierter Drill-Contract (Format 1, D1) | Pre-Mortem-Modelle, Drill-Lab-Skripte, First Managed Run Drill | P3.1: nach C gemergt und R2 aktiv |
| **FORGE-CORE-0002** | registrierte CORE-0002-Revision gegen BOOTSTRAPPED-Policy mit CORE-Profil (D7) | CORE-0002 Draft v1, V2PF-Lab-Code und -Encodings, Contract System V2, FRZ §16-Position | P4.0: nach BOOTSTRAPPED (P3.3) |

## Mystery

Alle Mystery-Contracts werden vor Registrierung nach Format 2 transkodiert und erst nach CORE-0002 registriert (Owner Reconciliation B.16). Die Candidate-Identität je taskId bestimmt `MYSTERY-FINAL-CONTRACT-MANIFEST.json` aus SRC-M-INT (Projektordner, noch nicht in Git, noch nicht unabhängig re-verifiziert). Single lane: ein offener Run-PR zugleich.

| Wenn du implementierst | READ THESE | DO NOT USE AS AUTHORITY | Start frühestens |
|---|---|---|---|
| **MYST-0001** PlayerRef | registrierter MYST-0001 (Format 2; Candidate fcv2 `f4d31858…` oder laut Manifest); Legacy-Code TASK-0001 auf `main` | Vitrine `case-scratch-playerref-v1`, Package/Replay `verify-vectors.py` als Implementierung, FV-Befund F01 | P4.3, nach P4.0 und P4.2 |
| **MYST-0002** Accusation/Verdict | registrierter MYST-0002 (aus FINAL-CANDIDATE + F05/F08 laut Manifest) | MYST-0002 V1 Draft, Accusation-Verdict Design, Solvability-Lab-Resolver | P4.3 |
| **MYST-0003** Evidence Access | registrierter MYST-0003 (F2-transkodiert) | MYST-0003 Package als Normtext, VS-2 Design | P4.3 |
| **MYST-0004** Evidence Presentation | registrierter MYST-0004 (mit MYST-0001-Pin) | MYST-0004 Package, Vitrine `presentation.MYST-0004.REPAIR-CANDIDATE.json`, Overnight-Plan-Nummerierung | P4.3 |
| **MYST-0005A** Interrogation Authoring | registrierter MYST-0005A (wörtliche Mutanten) | TASK-0005 v2 und dessen Testvektoren/Mutationsplan, `codex/mystery-task-0005` | P4.3 |
| **MYST-0005B** Interrogation Release | registrierter MYST-0005B (F06, Pin, `acceptedCommit` 0005A) | wie 0005A | P4.4, nach Annahme 0005A |
| **MYST-CHALLENGE-0001** | registrierter Challenge-Contract (F05, F12-Pin); D10 OD-6 | Exactness-Report-Oracles, Solvability-Repair-Lab | P4.4, nach Annahme MYST-0002 |
| **MYST-SOLVABILITY-0001** | registrierter Solvability-Contract; Release→Proof-Semantik aus Session A (D9a) | Solvability V1 Research, Release-Proof `model.py`, Vitrine Proof Profile (alt) | P4.4, nach Annahme MYST-0002 |
| **Session A** (Package/PlayerKnowledge, PublicContent, Release→Proof-Adapter) | registrierte Session-A-Revision (NEW REVISION, aus SRC-M-INT); darin integrierte Hash-Registry und Adapter | Package/Replay Closure und Release-Proof Closure als eigene Quellen (nur Patchquellen), VS-5, Vertical Slice Preflight, Scratch-Reducer | P5.1, nach P4.4 |
| **Session B** (Reducer) | registrierte Session-B-Revision mit `acceptedCommit` Session A; D8-Siegbedingung im Text | VS-5-Prototyp (123 Checks), Scale-Lab-Reducer | P5.1, nach Annahme Session A |
| **Session C** (Save/Replay) | registrierte Session-C-Revision mit `acceptedCommit` Session B; D10 (Saves binden Text) | VS-5, Package/Replay `lab.mjs` | P5.1, nach Annahme Session B |
| **Vitrine** (Fallinhalt, kein Code-Contract) | PENDING-V-PACK (Authoring Spec, PublicContent, Player Setup, Proof Profile, Challenge, Manifest), gebunden an die dann registrierten Contracts | Scratch Case Pack, alte Proof Profile, Headless Spec als Datenquelle | P5.2, nach P5.1 |

## Immer verboten als Autorität

Chat-Nachrichten und Zusammenfassungen; Audit-Berichte jeder Art; Lab- und Scratch-Code; nicht registrierte Drafts und Candidates; ältere Contract-Versionen nach einer registrierten Revision; Legacy-Approval-Records in `forge/approvals/`.
