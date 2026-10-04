# FORGE V0.1 — ACTIVATION CHECKLIST

Stand: 2026-10-04 · Autor: Claude (Anthropic) · Status: **NOT EXECUTED — kein Kästchen ist abgehakt.**
Begleitet `FORGE-V0.1-FINAL-ACTIVATION-RUNBOOK.md` (Schritt-IDs identisch). Details, Quellen und STOP-Regeln stehen dort; Evidence wird im `FORGE-V0.1-EVIDENCE-SHEET.md` eingetragen, STOP-Fälle nach `FORGE-V0.1-STOP-RECOVERY-MATRIX.md` behandelt.

Regel für jede Zeile: ☐ wird erst abgehakt, wenn die zugehörige Evidence-Zelle ausgefüllt ist. UNKNOWN, PENDING, INCONCLUSIVE und 403/404 sind nie ein Haken.

---

## Vor Beginn (Eingangsbedingungen, heute offen)

☐ OI-1 Claude-/AI-GitHub-Zugang, der als `Wuerfelduell` schreibt, ist vom Owner dokumentiert und nach FRZ §4.4 aufgelöst
☐ OI-4 Paket r2 + 0001A/B/C v2 liegen vor und setzen D1–D3, D6, REC A.1–A.3 um (heute NOT AVAILABLE; ABCR-Candidates weichen ab)
☐ OI-5 Drill-Paket r2 liegt vor (heute NOT AVAILABLE)
☐ OI-6 FORGE-DRILL-0001/0002 Contract + Plan liegen reviewt vor (heute NOT AVAILABLE)
☐ OI-8 Org-Ebene der Actions-Policies per UI dokumentiert

---

## P0 — Owner Platform Preparation

☐ P0.1 Entscheidungsprotokoll D1–D10 geschrieben, SHA-256 notiert
☐ P0.2 `GET /user`: Owner-Token = 315180734, Codex-Token = 337272506
☐ P0.2 Repo-ID 1401864629, public, default `main`
☐ P0.2 Collaborators/Teams: nur Owner (admin) und `forge-codex` (write)
☐ P0.2 Apps, Deploy Keys, Webhooks, Secrets, Variables, Environments, Runner inventarisiert; Abweichungen erklärt
☐ P0.2 Rulesets `[]`, `main` unprotected, Repo-AEP `total_count=0` gelesen
☐ P0.3 Drill-Paket r2: R2 `["merge"]` in candidate + drill, DENY squash/rebase, 8c-Wortlaut, SHA256SUMS neu, Selbsttests grün
☐ P0.4 Zwei frische Lab-Repos angelegt (`…-a`, `…-root`), Actions aus, Codex ohne Write
☐ P0.4 DRILL-Runbook §0–§13 vollständig ausgeführt, ein Fall nach dem anderen
☐ P0.4 91 Fälle + AP-Kontrollen + squash/rebase-DENY mit Evidence
☐ P0.4 PB-2 R3-User-Bypass setzbar belegt
☐ P0.4 PB-3 AEP blockt push / pull_request / workflow_dispatch vor Jobstart belegt
☐ P0.4 Native Head-Check-Bindung belegt, `integration_id` beobachtet
☐ P0.4 DRILL §12 PASS, kein offener UNKNOWN/INCONCLUSIVE/PENDING
☐ P0.5 Merge commit an; Squash aus; Rebase aus; Auto-Merge aus; Auto-Delete aus; Update-Branch aus
☐ P0.5 Default workflow permissions = read; Actions dürfen PRs weder erstellen noch approven
☐ P0.5 Allowed actions nur lokal/Forge-Dice; Fork-Approval; Secret Scanning + Push Protection an; Dependabot updates aus
☐ P0.6 AEP `forge-trusted-pr-target-only` angelegt; Readback == Runbook §5.3; Parents bekannt
☐ P0.7 R1 angelegt + Readback
☐ P0.7 R7 angelegt + Readback
☐ P0.7 R4 angelegt + Readback (Bypass User 337272506 always)
☐ P0.7 R5 angelegt + Readback (Bypass User 315180734 always)
☐ P0.7 R6 angelegt + Readback (Excludes exakt vier)
☐ P0.7 R3 angelegt + Readback (Bypass User 315180734 pull_request, nur creation + update)
☐ P0.7 R2 **nicht** angelegt
☐ P0.7 Ref-Liste vorher == nachher
☐ P0.8 `forge/owner/s1-negative` mit `x.yml` + PR-eigener `forge-v01.yml` gepusht, PR geöffnet
☐ P0.8 push und pull_request blockiert mit Plattformgrund, null Jobs, PR geschlossen, Branch erhalten
☐ P0.9 N1 Tag-Create Owner → DENY R7
☐ P0.9 N2 Stray-Branch Owner → DENY R6
☐ P0.9 N3 Owner in `forge/run/codex/…` → DENY R4
☐ P0.9 N4 Codex in `forge/owner/…` → DENY R5
☐ P0.9 N5 Stray-Branch Codex → DENY R6
☐ P0.9 N6 Codex in `forge/run/codex/PROBE-…/ok` → ALLOW
☐ P0.10 PR #2 geschlossen, nicht gemergt; Branch `IDENTITY-SPIKE-1` erhalten
☐ P0.10 Codex-Commit-Identität = noreply von `forge-codex`
☐ P0.11 Owner-Ops-PR: Dateiliste ⊆ Allowlist, keine Code-/Workflowdatei
☐ P0.11 Externes Review + Owner-Review
☐ P0.11 Merge per merge-async (`sha=H`, merge, direct_merge, bypass_rules=true), terminal merged
☐ P0.11 `M0.parents == [3d7545d…, H]`, `merged_by.id == 315180734`, Ledger Zeile 1
☐ **P0-Gate** Evidence-Abschnitt P0 signiert

## P1 — A

☐ P1.1 Paket r2 (§§1–18, neuer Sectionhash) + 0001A/B/C v2 auf Audit-Branch; Parser OK; contentHashes notiert
☐ P1.1 Severity {info, minor, major, critical}, blocking = major/critical; Supersedes ohne Transitivität
☐ P1.1 `reviewSnapshotDigest` im Receipt; Mutanten A1–A5, B1–B5, C1–C5
☐ P1.2 61 Goldens + 24 Property-Familien gegen r2 grün; ORV2 neu gepinnt; „0-legitimate“ umgelabelt
☐ P1.3 Architektur-Review A approve, keine major/critical Findings; Reviewer ≠ Autor protokolliert
☐ P1.4 Registrierungs-PR A gemergt (`M_A`), Contract-Blob byte-gleich, Ledger
☐ P1.5 Handoff (Repo, Pfad, Commit, Hash, Base) ohne Contracttext; Run-Branch + Lesequittung
☐ P1.6 PR A: Diff nur Scope, lineare Commits
☐ P1.7 Acceptance A vollständig grün
☐ P1.7 A1–A5 KILLED nach Mutantenregel (isoliert, Masking-Erklärung, Bytes eingefroren)
☐ P1.7 Differential: 0 offene Abweichungen
☐ P1.7 Code-Review approve, Owner-Attestation, Merge → `A_A`, Ledger
☐ **P1-Gate**

## P2 — B

☐ P2.1 B-Revision: `acceptedCommit = A_A`, aktueller `baseCommit`, Version erhöht, neu gehasht, Review approve
☐ P2.2 Registrierung B (`M_B`), Ledger
☐ P2.3 Docker-fähige Testfläche benannt; Run + PR B
☐ P2.4 Acceptance B grün; B1–B5 KILLED
☐ P2.4 Isolationsprobe lokal: Netz, Docker-Socket, Commandfiles, Read-only-Pfade gemessen denied
☐ P2.4 Isolationsprobe GitHub-hosted Runner (separate Testfläche): dieselben Denials gemessen
☐ P2.4 Acceptance-Image digest-gepinnt, nicht Produktionsimage
☐ P2.4 Review, Attestation, Merge → `A_B`, Ledger
☐ **P2-Gate**

## P3 — C (Registrierung/Implementierung)

☐ P3.1 C-Revision: `acceptedCommit = A_B`, D2/D3, F09, 8d, Workflow nur `pull_request_target`, `permissions: {}`
☐ P3.1 Clamp-BASE in if-Form + drei Tests (PM §2) im C-Scope
☐ P3.2 Registrierung C (`M_C`), Ledger
☐ P3.3 Implementierung C, PR offen, Head `H_C` eingefroren
☐ P3.3 Produktions-Image-Digest owner-reviewed
☐ P3.3 Offline-Isolationsnachweis mit exakten Workflow-Parametern grün
☐ P3.3 Acceptance C grün; C1–C5 KILLED; Code-Review approve
☐ P3.3 C **nicht** gemergt
☐ **P3-Gate**

## P4 — Execution-Isolation Live Validation

Kein Punkt ist bestanden. Jede Zeile braucht eine gemessene Beobachtung auf der Testfläche mit Stage-2-Sandbox aus `H_C` (EI-Report „Remaining live validation required“ 1–11; EI-01…EI-20).

☐ P4.1 Testfläche `forge-ei-live-<datum>` spiegelt `H_C` byte-gleich; AEP == §5.3; keine Secrets

**I-1 Gepinnte Stage-2-Sandbox**
☐ EI-19 Image/Runtime-Digest == owner-reviewter Digest; Aufruf unveränderlich
☐ EI-02 `forge-verify` läuft als eigener frischer GitHub-hosted `ubuntu-24.04`-Job nach Gate-Erfolg
☐ EI-06 untrusted Test-/Typecheck-Code läuft nur in der inneren Sandbox, nie direkt auf dem Runner-Host
☐ EI-08 non-root, keine zusätzlichen Capabilities, `no-new-privileges`, kein Host-PID-Namespace, kein Docker-Socket

**I-2 Netzwerk-Verbot**
☐ EI-07 TCP nach außen denied (gemessen)
☐ EI-07 UDP/DNS denied
☐ EI-07 Loopback/Host-/Service-Endpunkte denied
☐ EI-07 Package-Registry nicht erreichbar

**I-3 Credentials / Env**
☐ EI-11 Env aus Allowlist neu aufgebaut; kein `GITHUB_TOKEN`
☐ EI-11 keine Actions-Runtime-/Service-Credentials, keine OIDC-Request-Variablen, keine Secrets, keine Proxy-Credentials
☐ EI-11 kein geerbtes HOME/PATH/npm-Config/`NODE_OPTIONS`
☐ EI-12 Job-Permissions minimal; kein Schreibtoken für PR-beeinflusste Schritte
☐ Runner-HOME und Credential-Dateien (z. B. git-credentials) aus der Sandbox nicht lesbar

**I-4 Read-only / Dateisystem**
☐ EI-09 trusted Verifier/Toolchain/Config/Inputs read-only (Schreibversuch → EROFS/EACCES gemessen)
☐ EI-09 nur begrenzter Supervisor-Scratch/Output beschreibbar
☐ EI-10 Symlink-, Hardlink- und Pfad-Escape nach außen schlägt fehl
☐ EI-14 kein Zugriff auf `GITHUB_OUTPUT`, `GITHUB_ENV`, Step-Summary, Commandfiles
☐ EI-13 HOME/TMP/Cache starten leer und werden verworfen

**I-5 Prozessbaum-Terminierung**
☐ EI-16 Timeout beendet den gesamten Sandbox-Prozessbaum/Namespace
☐ EI-16 `setsid`-/detached-/Hintergrundprozess überlebt die Terminierung nicht (nachgewiesen nach Jobende)

**I-6 Ressourcen: CPU / RAM / PID / Disk / Output**
☐ EI-17 CPU-Grenze greift (Endlosschleife terminiert)
☐ EI-17 RAM-Grenze greift
☐ EI-17 PID-/Prozesszahl-Grenze greift (Fork-Flut)
☐ EI-17 Schreibbytes-/Dateizahl-Grenze greift
☐ EI-17 stdout/stderr-Grenze greift (Flut wird abgeschnitten/abgelehnt, kein ungefiltertes Workflow-Command im Hostlog)
☐ EI-18 Test-Enumeration, Materialisierung, Archiv-/Artefaktgröße und -tiefe begrenzt, fail-closed
☐ die gewählten Grenzwerte stehen im akzeptierten C/Paket (keine hier erfundenen Zahlen)

**I-7 Stage1 → Stage2 Isolation**
☐ EI-01 `forge-gate` führt keinen PR-Byte aus (kein npm, Import, Collection, Config, Hook)
☐ EI-03 Stage 2 bindet Repo-ID, PR, Base/Main, Head, Task/Contract selbst neu
☐ EI-04/EI-05 Install nur Baseline-Lockfile + `npm ci --ignore-scripts`; trusted Binaries/Configs; PR-Scripts/Configs/Loader/`NODE_OPTIONS` ohne Wirkung
☐ EI-20 kein veränderlicher Kanal Stage 1 → Stage 2 (Cache, Artefakt, Env, generierte Config, Git-Object-Store) — Marker aus Stage 1 in Stage 2 nicht sichtbar

**I-8 Trusted Evidence**
☐ EI-15 finale Evidence/Artefakte nur vom Supervisor nach Sandbox-Exit und Schema-/Inhaltsprüfung erzeugt
☐ untrusted Code kann Worker-Report, Final-Evidence oder GitHub-Commandfiles nicht fälschen (Fälschungsversuch → abgewiesen, Entscheid unverändert)
☐ tatsächliche Job-Permissions und Frische-Verhalten entsprechen dem Modell (EI-Report Punkt 11)

☐ P4.3 Owner-Abnahme Evidence §E signiert; Testfläche archiviert, nicht gelöscht
☐ **P4-Gate**

## P5 — Workflow / Ruleset Activation

☐ P5.1 `main` == letzter Ledger-Eintrag; offene PRs nur C; PR #2 geschlossen; AEP + sechs Rulesets unverändert
☐ P5.1 Datum vor 2026-11-02 oder S1-Positiv/AEP erneut belegt
☐ P5.2 Owner-Attestation `H_C`; Merge → `A_C`; Workflow-Blob == reviewte Bytes
☐ P5.3 Smoke-/Bind-PR mit Ledger, S1-Evidence, Drill-Contracts/-Plänen geöffnet
☐ P5.3 Attempt 1: gate success, verify `REVIEW_MISSING`
☐ P5.3 Externes Review + Owner-Attestation (COMMENTED, `commit_id=H`, Ziel-Attempt 2)
☐ P5.3 Re-run all jobs: beide Jobs frisch, success; `triggering_actor.id == 315180734`
☐ P5.3 Receipt enthält `reviewSnapshotDigest`
☐ P5.4 Isolations-Probe-PR: Stage 2 erreicht und alle Probes denied — oder INCONCLUSIVE dokumentiert (OI-3)
☐ P5.5 beide Check-Runs: gleiche numerische `app.id` (GitHub Actions), `head_sha == H`, trusted Suite, keine Duplikate
☐ P5.6 R2 mit Ganzzahl-`integration_id` angelegt; kein Platzhalter gesendet
☐ P5.6 Vollreadback sieben Rulesets + AEP == §5; Coverage ohne Lücke; `deploymentDigest`/`checkedAt` notiert
☐ P5.7 Smoke-PR unter R2 gemergt (merge-async, terminal merged, `M.parents == [B, H]`), Ledger
☐ **P5-Gate**

## P6 — ClampAtZero Drill

☐ P6.0 PM §11.1 vollständig; B1–B7 und D2-Pfadfrage aufgelöst
☐ P6.1 Handoff, Lesequittung R (`R.tree == B.tree`), Run-Branch `…/FORGE-DRILL-0001/d1-01`
☐ P6.1 Draft-PR mit Hpre; Draft-Gate `PR_STATE`, verify explizit rot
☐ P6.1 H = exakt ternäre Zielbytes; ready_for_review
☐ P6.1 Attempt 1: gate success; Tests/Inventar grün; m-negative KILLED; verify `REVIEW_MISSING`
☐ P6.1 Head-Freeze; externer Anthropic-Report gebunden an {repoId, pr, B, H, C, V, P}
☐ P6.1 Owner-Attestation für nächsten Attempt; Re-run all jobs; beide success; zwei stabile Final-Snapshots ≤ 10 s
☐ P6.1 Premerge-Readback; Merge (`sha=H`, merge, direct_merge, bypass_rules=true); terminal merged
☐ P6.1 `M.parents == [B, H]`, `M.tree == H.tree`, `merged_by.id == 315180734`
☐ P6.1 Drill-PASS 8d (1)–(4) vollständig
☐ P6.2 D2 `SCOPE_PATH` · ☐ D3 `SCOPE_PATH` + `TEST_INVENTORY` · ☐ D4 `SCOPE_PATH` + `SCOPE_PROTECTED` + `TEST_STATUS` · ☐ D5 `SCOPE_PATH` + `SCOPE_PROTECTED`, Config nie geladen
☐ P6.2 D6 Codes + evil null Jobs mit Blockgrund · ☐ D7 `SCOPE_PATH` · ☐ D8 `MUTANT_SURVIVED` · ☐ D9 `REVIEW_BINDING` (+ Race `PR_STALE` separat)
☐ P6.2 alle D2–D9-PRs geschlossen, Branches erhalten, nichts gemergt
☐ P6.3 PM §9 alle Pflichtklassen PASS mit 8c-Wortlaut
☐ **P6-Gate**

## P7 — BOOTSTRAPPED

☐ E1 · ☐ E2 · ☐ E3 · ☐ E4 · ☐ E5 · ☐ E6 · ☐ E7 · ☐ E8 · ☐ E9 (Runbook §10)
☐ CORE-0002-Sperre nie verletzt (Runbook §9)
☐ P7.2 `forge/ops/BOOTSTRAPPED.md` per Owner-Ops-PR unter beiden Required Checks gemergt (`M_BS`)
☐ erst jetzt: „FORGE V0.1 BOOTSTRAPPED“; erst jetzt darf CORE-0002 eingereiht werden
