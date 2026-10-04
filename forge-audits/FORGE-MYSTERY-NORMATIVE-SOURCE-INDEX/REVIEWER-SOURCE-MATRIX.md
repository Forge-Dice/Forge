# REVIEWER SOURCE MATRIX

Stand: 2026-10-04 ~17:50Z · `main` = `3d7545d8` · Details und IDs: [FORGE-MYSTERY-NORMATIVE-SOURCE-INDEX.md](FORGE-MYSTERY-NORMATIVE-SOURCE-INDEX.md)

Reviewer-Besetzung nach **D5**: A/B/C (Developer Codex/OpenAI) reviewt Claude (Anthropic); Mystery-Repairs von Claude prüft ein Codex-Lab; Attestation immer Seb. Ein Review bindet genau den geprüften Blob/Hash (FRZ).

Spalten: **Contract source** = was geprüft wird · **Owner decisions** = was der Text einhalten muss · **Required evidence** = was vorliegen muss, damit ein approve möglich ist · **Historical evidence only** = darf zur Begründung gelesen werden, entscheidet nichts.

## Forge

| Review | Contract source | Owner decisions | Required evidence | Historical evidence only |
|---|---|---|---|---|
| **A v2 Architektur** (P1.2) | SRC-F-R2: `FORGE-BOOTSTRAP-0001A-v2.contract.md` (Projektordner, raw `c84c507c…`; vor Review in Git persistieren) + gebundene PKG-r1-HTML `27bb408d…` | D1, D3 (soweit A betroffen), D6 | Owner Reconciliation A.4/A.5-Bedingungen (Bindung §§1–18, neuer contentHash, kanonisch geparst, baseCommit = aktuelles `main`); Bewertung der A.1-Abweichung (keine separate Paket-r2-Datei, Index §8.1a); ROQ-Goldens gegen r2 bestätigt (D6); Oracle-V2-Erwartungen neu gepinnt; A-Mutanten anwendbar und nicht maskiert (Blocker 4) | A/B/C Certification (r1), ABC-REPAIR Report, Reference, Bootstrap Experimental Report, Verifier Spike, FRZ-Vorgeschichte |
| **B v2/v3 Architektur** | SRC-F-R2 B (raw `2a9d736e…`); später Revision v3 mit `acceptedCommit` A | D1, D3, D6 | B-Acceptance mit gemessenen Isolations-Denials (Blocker 7a), Mutanten B1–B5 nach Regel | Execution Isolation Lab (Anforderungsquelle EI-01…EI-16), Certification |
| **C v2/v3 Architektur** | SRC-F-R2 C (raw `1a67681c…`) | **D2** (reviewSnapshotDigest), **D3** (Schema/Severity), **D4** (R2/R3, Drill-PASS 8d), D1 | Receipt-Digest + Mutant C5; geschlossenes Review-Schema exakt nach D3; Workflow nur `pull_request_target`; EI-01…EI-20 normativ gefordert, Isolation als Deployment-Gate formuliert, nicht als PASS | ABC-REPAIR Patch C-1/C-2 (C-2 weicht von D3 ab), Certification F02/F03/F04/F09 |
| **A/B/C Implementierung** (Code-Review) | der registrierte Contract am `contractCommit` | wie oben | Lab-Runner-Ergebnis: Acceptance + Mutanten KILLED nach Regel; Diff nur im Scope; keine Änderung bestehender Tests oder `src/forge/**` | Differentialvergleich mit Oracle V2 / Reference (Hinweis, kein Urteil) |
| **Drill D1–D9** | registrierter Drill-Contract + SRC-F-RUNBOOK Evidence Sheet | D4 | Drill-PASS-Liste (8d) vollständig; erwartete Ablehnungscodes D2–D9; Exit E1–E9 | Pre-Mortem-Modelle, Ruleset-Drill r1 |
| **CORE-0002 Revision** | CORE-0002 v2 gegen BOOTSTRAPPED-Policy | D1, D7 | CORE-Profil im Policy-File (Owner-PR) vorhanden; Format-2-Parser + Dogfood-Test | CORE-0002 Draft v1, V2PF (Anforderungsquelle), Contract System V2 |
| **Plattform-Aktivierung** (Owner) | SRC-F-RUNBOOK | D4 | Read-back aller Rulesets/AEP als JSON; isolierter Live-Drill PASS (P0.3); Execution-Isolation-Live-Checks (keiner heute bestanden) | Actions Policy Preflight, Bootstrap Experimental Report, Ruleset-Drill r1 |

## Mystery

| Review | Contract source | Owner decisions | Required evidence | Historical evidence only |
|---|---|---|---|---|
| **Freeze-Re-Verifikation** (P4.2, nicht der Autor) | SRC-M-INT (Projektordner, Manifest `b8f0a90e…`; vor Review in Git persistieren): Manifest + 7 v2-Candidates + 4 unveränderte Originale | D8, D9, D10 (nicht neu öffnen) | FV-Kriterien C1–C11 gegen den integrierten Stand; Finding-Closure-Matrix F01–F11 (+F12); statischer Cross-Contract-Check; azyklischer Hash-DAG | Independent Freeze Verification (Stand 09:19Z), Freeze Blocker Repair, Cross-Contract, InfoFlow, Scale, Authoring Stress |
| **MYST-0001** | UNCHANGED laut Manifest (fcv2 `f4d31858…`) | D10 | Goldens V-01…V-05 reproduziert; „resolution ≠ authorization“ | Package/Replay `verify-vectors.py` (unabhängige Reproduktion) |
| **MYST-0002** | v2 laut Manifest (raw `8e66e861…`, F05/F08) | D10 (N-1…N-4) | Repair-Evidence; MYST-0002 bleibt alleinige Canonical-Consistency-Autorität | V1 Draft, Accusation-Verdict Design |
| **MYST-0003 / MYST-0004** | 0003 UNCHANGED; 0004 v2 (raw `fd3f8ded…`, Pin) | D10 (OE-M3, OE-M4) | Transcode-Nachweis (Body unverändert) | Packages, VS-2 Design |
| **MYST-0005A / 0005B** | 0005A UNCHANGED; 0005B v2 (raw `feed5af3…`) | D9c, D10 (OE-M5) | wörtliche Mutanten (0005A); F06-Repair (0005B) | TASK-0005 v2 inkl. Self-Audit |
| **MYST-CHALLENGE-0001** | v2 laut Manifest (raw `03d034d5…`) | D8, D10 (OD-6) | keine geheime Required-only-Whitelist; undetermined bleibt dreiwertig; kein Evidence-Gate | Exactness Report + Evidence |
| **MYST-SOLVABILITY-0001** | UNCHANGED laut Manifest | D8, D9a | Proof-Semantik nur über Session-A-Adapter; „NPC sagt P ⇒ P wahr“ ausgeschlossen | Solvability Repair Report, Solvability V1 Research |
| **Session A / B / C** | v2 laut Manifest (raw `38e5cb8a…` / `3e2a5ff6…` / `76bc24d5…`) | D8, D9a/b, D10 | Hash-Registry ohne Zyklus; PublicContent-Ownership; revidierte 120er-Acceptance-Matrix; gemeinsame Abschnitte bytegleich | Session Production Package (Original), Package/Replay Closure, Release-Proof Closure, VS-5 Preflight, Scale |
| **Vitrine Authoring** | PENDING-V-PACK | D8, D9, D10 | Private/Public-Split; jede Proof-Premise mit realer freigegebener Quelle; Startwissen explizit; Hashes nur aus finalen Artefakten (sonst TO_BE_COMPUTED) | Headless Spec, Scratch Case Pack, alte Certification, InfoFlow |
| **Vitrine Certification** (P5.3, unabhängig) | Vitrine Final Pack + implementierte Domain-Komponenten | D8 | CERT-1…CERT-10 mit echtem Reducer-Witness und Save/Load-Roundtrip | Release-Proof `model.py`, alte Certification (NOT CERTIFIED) |

## Für jedes Review

Ein approve bindet den exakten Blob/contentHash. Ein Bericht, der neuer ist als der geprüfte Candidate, ändert das Urteil nur, wenn er eine Owner-Entscheidung, ein Finding nach FR-1 oder einen nachgewiesenen Widerspruch zum Candidate-Text enthält.
