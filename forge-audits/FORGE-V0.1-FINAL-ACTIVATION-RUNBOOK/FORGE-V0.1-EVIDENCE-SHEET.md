# FORGE V0.1 — ACTIVATION EVIDENCE SHEET

Stand: 2026-10-04 · Autor: Claude (Anthropic) · Status: **LEERE VORLAGE — NOT EXECUTED.** Keine Zelle ist ausgefüllt; kein Prüfpunkt gilt als bestanden.

Ausfüllregeln (aus PM §5 und DRILL §11):
- □ = ungefüllt. `NOT APPLICABLE` nur mit konkretem Grund.
- IDs und SHAs nie aus Chatlabels oder vermuteten Branchnamen rekonstruieren; immer aus API-/Git-Readback, vollständig (40 hex).
- Rohe API-Antworten und Logs außerhalb jedes Developer-PRs archivieren (Projektordner bzw. `forge/ops/` per Owner-Ops-PR); SHA-256 jeder gespeicherten Datei in die Zelle.
- Keine Secrets, Tokens, Authorization-Header oder untrusted Volltexte eintragen.
- Evidenzklasse je Zeile: `API` · `UI` · `GIT` · `LAB` · `MODEL`. UNKNOWN, PENDING, INCONCLUSIVE und 403/404 sind kein PASS.
- Ergebnis je Zeile: `PASS` · `FAIL` · `INCONCLUSIVE` · `STOP` (mit STOP-ID aus der Matrix).

---

## §A Kopf

| Feld | Wert |
|---|---|
| Ausführender (Name, numerische ID) | □ |
| Repository / immutable ID | `Forge-Dice/Forge` / 1401864629 (bei Beginn erneut lesen: □) |
| `main` bei Beginn | □ |
| Runbook-Paket SHA-256 (vier Dateien) | □ |
| Owner-Entscheidungsprotokoll SHA-256 | □ |
| Paket r2 Sectionhash | □ |
| contentHash 0001A / 0001B / 0001C (je finale Revision) | □ / □ / □ |
| Drill-Paket r2 Commit | □ |
| FORGE-DRILL-0001 / -0002 contentHash | □ / □ |

---

## §B Plattform (P0)

| Schritt | Erwartung | Evidence (URI/Hash) | Klasse | Ergebnis |
|---|---|---|---|---|
| P0.1 Entscheidungsprotokoll | zehn Antworten | □ | GIT | □ |
| P0.2 `GET /user` Owner | id 315180734 | □ | API | □ |
| P0.2 `GET /user` Codex | id 337272506 | □ | API | □ |
| P0.2 Repo-Metadaten | 1401864629, public, `main` | □ | API | □ |
| P0.2 Collaborators/Teams/Rollen | Owner admin, Codex write, sonst niemand | □ | API | □ |
| P0.2 Apps mit Repo-Zugriff + Rechte | inventarisiert; OI-1-Notiz | □ | API/UI | □ |
| P0.2 Deploy Keys / Webhooks / Secrets / Variables / Environments / Runner | alle leer | □ | API | □ |
| P0.2 Rulesets inkl. Parents / Branch Protection | `[]` / unprotected | □ | API | □ |
| P0.2 Actions-Policies Repo / Org | 0 / per UI belegt | □ | API/UI | □ |
| P0.3 Drill-Paket r2 | nur 8a/8c + 2 DENY-Fälle; Selbsttests grün | □ | GIT | □ |
| P0.4 Lab-Repos (`…-a`, `…-root`) Namen + IDs | frisch, ≠ 1401864629 | □ | API | □ |
| P0.4 Fallergebnisse 91 + AP + squash/rebase | DRILL §12 | □ | LAB | □ |
| P0.4 PB-2 R3-User-Bypass setzbar | ja | □ | LAB | □ |
| P0.4 PB-3 AEP blockt push/pull_request/dispatch | Blocked-Proof je Event | □ | LAB | □ |
| P0.4 Native Head-Check-Bindung + `integration_id` | belegt, Ganzzahl | □ | LAB | □ |
| P0.5 Repo-Settings-Readback | §5.4 | □ | API | □ |
| P0.5 Actions-Settings-Readback | read, kein PR-Approve, lokale Actions | □ | API | □ |
| P0.6 AEP-POST + Readback (`has_parents=true`) | == §5.3 | □ | API | □ |
| P0.7 R1 Readback (ID, bypass, rules) | == §5.2 | □ | API | □ |
| P0.7 R7 Readback | == §5.2 | □ | API | □ |
| P0.7 R4 Readback | == §5.2 | □ | API | □ |
| P0.7 R5 Readback | == §5.2 | □ | API | □ |
| P0.7 R6 Readback | == §5.2 | □ | API | □ |
| P0.7 R3 Readback | == §5.2, nur creation+update | □ | API | □ |
| P0.7 R2 nicht vorhanden; Ref-Liste vorher == nachher | ja | □ | API | □ |
| P0.8 S1 push-Event | blockiert, Grund, 0 Jobs | □ | UI/API | □ |
| P0.8 S1 pull_request-Event (`x.yml`) | blockiert, Grund, 0 Jobs | □ | UI/API | □ |
| P0.8 S1 pull_request-Event (PR-eigene `forge-v01.yml`) | blockiert, Grund, 0 Jobs | □ | UI/API | □ |
| P0.9 N1 Tag Owner | DENY R7, Ref fehlt | □ | GIT | □ |
| P0.9 N2 Stray Owner | DENY R6 | □ | GIT | □ |
| P0.9 N3 Owner → codex-Namensraum | DENY R4 | □ | GIT | □ |
| P0.9 N4 Codex → owner-Namensraum | DENY R5 | □ | GIT | □ |
| P0.9 N5 Stray Codex | DENY R6 | □ | GIT | □ |
| P0.9 N6 Codex eigener Namensraum | ALLOW | □ | GIT | □ |
| P0.10 PR #2 | closed, merged=false | □ | API | □ |
| P0.10 Codex-Commit-Identität | noreply `forge-codex` | □ | GIT | □ |
| P0.11 Owner-Ops-PR Nr. / H / Dateiliste | ⊆ Allowlist | □ | API/GIT | □ |
| P0.11 Reviews (extern + Owner) | Bytes-Hash, Review-IDs | □ | API | □ |
| P0.11 merge-async UUID → terminal | merged | □ | API | □ |
| P0.11 `M0`, Parents, `merged_by.id` | `[3d7545d…, H]`, 315180734 | □ | GIT/API | □ |

P0-Signatur Owner (UTC): □

---

## §C Bootstrap-Contracts A / B / C (P1–P3)

Je Contract eine Spalte.

| Feld | A | B | C |
|---|---|---|---|
| Finale Revision / `contractVersion` | □ | □ | □ |
| contentHash (`forge-contract-v1`) | □ | □ | □ |
| `baseCommit` (Ancestry zu `main` belegt) | □ | □ | □ |
| `acceptedCommit` Vorgänger (echte SHA) | — | □ (= A_A) | □ (= A_B) |
| Architektur-Reviewer (Instanz) ≠ Autor (Instanz) | □ | □ | □ |
| Architektur-Review-Bytes SHA-256 / Ergebnis | □ | □ | □ |
| Registrierungs-PR / `M_x` / Contract-Blob-ID | □ | □ | □ |
| Handoff-Hash / Lesequittung-Commit | □ | □ | □ |
| Run-Branch / PR / eingefrorener Head | □ | □ | □ (`H_C`) |
| Acceptance-Report (Fälle grün / gesamt) | □ | □ | □ |
| Mutanten KILLED nach Regel (Liste, Masking-Erklärung) | A1–A5: □ | B1–B5: □ | C1–C5: □ |
| Goldens r2 / ORV2-Differential (equal / explained / open=0) | □ | □ | □ |
| Isolations-Denials lokal / GitHub-hosted (nur B) | — | □ / □ | — |
| Acceptance-Image-Digest (B) / Produktions-Image-Digest (C) | — | □ | □ |
| Offline-Isolationsnachweis (C) | — | — | □ |
| Code-Review-Bytes SHA-256 / Ergebnis | □ | □ | □ |
| Owner-Attestation Review-ID / Body-Hash | □ | □ | □ (in P5.2) |
| Abnahme-Merge `A_x` / Parents / `merged_by.id` | □ | □ | □ (in P5.2) |

Signaturen Owner: A □ · B □ · C (Offline, P3-Gate) □

---

## §D Aktivierung (P5)

| Schritt | Erwartung | Evidence | Klasse | Ergebnis |
|---|---|---|---|---|
| P5.1 `main` / offene PRs / PR #2 / Readbacks | unverändert, nur C-PR offen | □ | API | □ |
| P5.1 Datum vs. 2026-11-02 | davor oder S1 erneut belegt | □ | — | □ |
| P5.2 `A_C`, Workflow-Blob-Vergleich | byte-gleich `H_C` | □ | GIT | □ |
| P5.3 Smoke-PR Nr. / H / Inhalt | Ledger, S1, Drill-Contracts | □ | API | □ |
| P5.3 Attempt 1 (Run-ID, Jobs, Ergebnis) | gate success, verify `REVIEW_MISSING` | □ | API | □ |
| P5.3 Externer Report-Hash / Owner-Attestation-ID | gebunden an B/H/C/P | □ | API | □ |
| P5.3 Attempt 2: Jobs frisch, success, `triggering_actor.id` | 315180734 | □ | API | □ |
| P5.3 Receipt (runId, runAttempt, B, H, contractHash, policyHash, verifierSha, reviewSnapshotDigest) | vollständig | □ | API/LOG | □ |
| P5.4 Isolations-Probe-PR (Stage 2 erreicht? Probes) | denied / INCONCLUSIVE | □ | API/LOG | □ |
| P5.5 Check-Run `forge-gate`: app.id, app.slug, head_sha, suite, PR | Ganzzahl, = H | □ | API | □ |
| P5.5 Check-Run `forge-verify`: app.id, app.slug, head_sha, suite, PR | gleiche app.id, = H | □ | API | □ |
| P5.6 R2-Payload SHA-256 / Readback | == §5.2 mit Ganzzahl | □ | API | □ |
| P5.6 Vollreadback 7 + AEP, `rules/branches/main`, Coverage | == §5 | □ | API | □ |
| P5.6 `deploymentDigest` / `checkedAt` | □ | □ | — | □ |
| P5.7 Smoke-Merge UUID → terminal, M, Parents | merged, `[B, H]` | □ | API/GIT | □ |

P5-Signatur Owner: □

---

## §E Execution-Isolation Live Validation (P4)

Testfläche: □ (Repo, ID) · `H_C`: □ · Image-Digest: □ · Runner-Image/Version: □
Für jeden Prüfpunkt: Probe-PR/Run-ID, `probeId`, `attempted`, `denied`, `observationKind`, `observationCode`, Verifier-Entscheid (unverändert?), Log-Hash.

| Kategorie | EI-ID | Prüfpunkt | Probe / Run | Beobachtung (Kind/Code) | Entscheid unverändert | Ergebnis |
|---|---|---|---|---|---|---|
| I-1 Sandbox gepinnt | EI-19 | Digest/Runtime == owner-reviewt | □ | □ | □ | □ |
| I-1 | EI-02 | frischer eigener Job nach Gate | □ | □ | □ | □ |
| I-1 | EI-06 | untrusted Code nur in Sandbox | □ | □ | □ | □ |
| I-1 | EI-08 | non-root, keine Caps, no-new-privileges, kein Host-PID, kein Docker-Socket | □ | □ | □ | □ |
| I-2 Netzwerk | EI-07 | TCP extern | □ | □ | □ | □ |
| I-2 | EI-07 | UDP/DNS | □ | □ | □ | □ |
| I-2 | EI-07 | Loopback/Host/Service | □ | □ | □ | □ |
| I-2 | EI-07 | Package-Registry | □ | □ | □ | □ |
| I-3 Credentials/Env | EI-11 | `GITHUB_TOKEN` nicht sichtbar | □ | □ | □ | □ |
| I-3 | EI-11 | Runtime-/OIDC-/Service-Credentials, Secrets, Proxy nicht sichtbar | □ | □ | □ | □ |
| I-3 | EI-11 | HOME/PATH/npm-Config/`NODE_OPTIONS` nicht geerbt | □ | □ | □ | □ |
| I-3 | EI-12 | Job-Permissions minimal | □ | □ | □ | □ |
| I-3 | — | Runner-HOME/Credential-Dateien nicht lesbar | □ | □ | □ | □ |
| I-4 Read-only/FS | EI-09 | trusted Mounts read-only (Schreibversuch) | □ | □ | □ | □ |
| I-4 | EI-09 | nur begrenzter Scratch beschreibbar | □ | □ | □ | □ |
| I-4 | EI-10 | Symlink/Hardlink/Pfad-Escape | □ | □ | □ | □ |
| I-4 | EI-14 | `GITHUB_OUTPUT`/`GITHUB_ENV`/Summary/Commandfiles | □ | □ | □ | □ |
| I-4 | EI-13 | HOME/TMP/Cache leer, verworfen | □ | □ | □ | □ |
| I-5 Prozessbaum | EI-16 | Timeout beendet ganzen Baum | □ | □ | □ | □ |
| I-5 | EI-16 | `setsid`/detached überlebt nicht | □ | □ | □ | □ |
| I-6 Ressourcen | EI-17 | CPU | □ | □ | □ | □ |
| I-6 | EI-17 | RAM | □ | □ | □ | □ |
| I-6 | EI-17 | PID/Prozesszahl | □ | □ | □ | □ |
| I-6 | EI-17 | Schreibbytes/Dateizahl | □ | □ | □ | □ |
| I-6 | EI-17 | stdout/stderr | □ | □ | □ | □ |
| I-6 | EI-18 | Enumeration/Materialisierung/Archiv begrenzt | □ | □ | □ | □ |
| I-7 Stage1→Stage2 | EI-01 | Gate führt keinen PR-Byte aus | □ | □ | □ | □ |
| I-7 | EI-03 | Stage 2 bindet selbst neu | □ | □ | □ | □ |
| I-7 | EI-04/05 | `--ignore-scripts`, trusted Binaries/Configs | □ | □ | □ | □ |
| I-7 | EI-20 | kein Cache-/Artefakt-/Env-/Config-/ODB-Kanal (Marker) | □ | □ | □ | □ |
| I-8 Trusted Evidence | EI-15 | Evidence nur vom Supervisor nach Exit + Validierung | □ | □ | □ | □ |
| I-8 | — | Report-/Evidence-/Commandfile-Fälschung abgewiesen | □ | □ | □ | □ |
| I-8 | — | Job-Permissions/Frische == Modell | □ | □ | □ | □ |

Gewählte Grenzwerte (aus akzeptiertem C/Paket, nicht hier festgelegt): CPU □ · RAM □ · PID □ · Bytes/Dateien □ · stdout/stderr □ · Zeit □
P4-Signatur Owner: □

---

## §F Drill D1 — legitimer Run (PM §5, je Feld eine Zeile)

| Feld | Erwartete Bindung / Inhalt | Live-Wert / Evidence-URI / Hash |
|---|---|---|
| Case / Surface / UTC | D1; `Forge-Dice/Forge` 1401864629; Start/Ende | □ |
| main SHA vor Registrierung | A (Authoring-Snapshot) | □ |
| Contract-Commit | K: Commit + Blob-ID + Pfad + Bytes + Rawhash + Parser-Ergebnis | □ |
| Contract-Identität | taskId FORGE-DRILL-0001 / Version / C | □ |
| Registrierungs-PR / Merge | Owner-PR-ID + G + `merged_by.id`; Task-Index | □ |
| Run-Base | B; Event-SHA = live main = V; baseCommit-Ancestry | □ |
| Policy / Taskplan | P / L, Pfade/Blobs; deploymentDigest; accepted dependencies | □ |
| Image / Manifest | OCI I; Bootstrap-/Input-Manifesthash; Sandbox-Nachweis (§E) | □ |
| Handoff | Volltext-Hash, Sender/Empfänger, Pins, STOP-Regeln | □ |
| Lesequittung | R; `R.parent = B`; `R.tree = B.tree`; Pins; als Selbstauskunft markiert | □ |
| Run-Branch / Actor | `forge/run/codex/FORGE-DRILL-0001/d1-01`; Create/Update unter 337272506 | □ |
| PR | Nummer/ID, `user.id` 337272506, Base `main`, draft→ready | □ |
| Draft-Head / Final-Head | Hpre / H; Source-Blob; Modes; alle Zwischenänderungen | □ |
| Draft-Gate | W_draft; `PR_STATE`; verify explizit rot; kein Worker | □ |
| Gate-Run Attempt 1 | W / a=1 / Job- und Check-IDs; success | □ |
| Gate-Receipt | {runId, runAttempt, B, H, contractHash, policyHash, verifierSha, reviewSnapshotDigest} | □ |
| Verify-Run Attempt 1 | `REVIEW_MISSING` bei sonst sauberem Lauf | □ |
| BASE/HEAD Checks | Typecheck-Exits; Inventar-Digests + Multiset + Status; vollständig | □ |
| Mutation m-negative | Anchor `return n < 0 ? 0 : n;` → `return n;`; Original/Result-SHA; KILLED | □ |
| Externer Review | Anthropic; Report-Bytes E; gebunden an B/H/C/V/P/pr/repo; approve; keine major/critical | □ |
| Owner-Attestation | Review-ID; `user.id` 315180734; COMMENTED; `commit_id = H`; Body-Hash; submitted_at; supersedes | □ |
| Review-Set | alle Seiten; IDs/States/Body-Hashes; Start-/Final-Digest | □ |
| Re-run | W / a=2; Original-Actor; `triggering_actor.id` 315180734; all jobs | □ |
| Native Checks | je Name: app.id, head_sha = H, Suite, PR; genau zwei Namen | □ |
| Deployment-Readback | R1–R7 + AEP Payloads; digest; checkedAt ≤ 30 min | □ |
| Final-Snapshots | zwei stabile, ≤ 10 s, B/H/P/Review/Attempt gleich | □ |
| Premerge-Readback | PR offen, nicht draft; main = B; head = H; nichts geändert | □ |
| Merge-Request | `sha=H`, `merge_method=merge`, `merge_action=direct_merge`, `bypass_rules=true`; UUID | □ |
| Merge-Ergebnis | M; terminal merged; `merged_by.id` 315180734; `M.parents=[B,H]`; `M.tree=H.tree`; main = M | □ |
| Drill-PASS 8d (1)–(4) | alle vier belegt | □ |
| Klassifikation / Ergebnis | PASS / FAIL / INCONCLUSIVE | □ |

---

## §G Drill D2–D9 und Zusatzproben — Case-Ergebnisblatt

| Case | Positive Kontrolle / Base / Head | Erwarteter Code / Schicht | Tatsächlich / GitHub-Zustand / Evidence | Ergebnis / Recovery |
|---|---|---|---|---|
| D2 Scope | □ | `SCOPE_PATH` (Stage 1); Stage 2 ohne Worker | □ | □ |
| D3 Test gelöscht | □ | `SCOPE_PATH`; Layerprobe `TEST_INVENTORY` | □ | □ |
| D4 Test skipped | □ | `SCOPE_PATH`; `SCOPE_PROTECTED`; `TEST_STATUS` | □ | □ |
| D5 Config-Injection | □ | `SCOPE_PATH`; `SCOPE_PROTECTED`; Config nie geladen | □ | □ |
| D6 Workflow | □ | `SCOPE_PATH`/`SCOPE_PROTECTED`; evil 0 Jobs + Blockgrund | □ | □ |
| D7 Extra-Datei | □ | `SCOPE_PATH` | □ | □ |
| D8 Survivor | □ | `MUTANT_SURVIVED` (nicht `MUTANT_INFRA`) | □ | □ |
| D9 Stale Review | □ | `REVIEW_BINDING`; Merge `sha=H1` abgelehnt | □ | □ |
| D9-Race (separat) | □ | `PR_STALE` | □ | □ |
| Owner-only-Merge (Lab-Beleg P0.4) | □ | Codex/Actions DENY R3, Owner ALLOW | □ | □ |
| R1 Delete/Force (Lab-Beleg P0.4) | □ | DENY R1, Ref unverändert | □ | □ |
| Re-run failed jobs | □ | `IDENTITY_RECHECK` | □ | □ |
| Post-PASS-Widerruf | □ | Owner-Premerge-STOP (keine Auto-Invalidierung) | □ | □ |
| Falsche Merge-Methode (Lab-Beleg P0.4) | □ | DENY R2 (squash/rebase) | □ | □ |

Jeder Fall: PR geschlossen □ · Branch erhalten □ · nichts gemergt □
Drill-Exit PM §9 (8c-Wortlaut) — Signatur Owner: □

---

## §H BOOTSTRAPPED — Exit-Belege

| E | Beleg | Evidence-URI / Hash | Prüfer (≠ Autor) | Ergebnis |
|---|---|---|---|---|
| E1 | 7 Rulesets + AEP == §5; P0.4 PASS; P0.8/P0.9 PASS | □ | □ | □ |
| E2 | Owner-Bootstrap-PR = Ledger Zeile 1 | □ | □ | □ |
| E3 | A/B/C Registrierungs- + Abnahme-Merges, Reviews, Attestationen, acceptedCommit-Kette, Mutanten, Goldens | □ | □ | □ |
| E4 | nur Format 1; kein CORE-0002-/F2-Artefakt auf `main` | □ | □ | □ |
| E5 | §E signiert; S1 negativ/positiv; Smoke unter R2; bind-checks; P5.4 PASS oder INCONCLUSIVE dokumentiert | □ | □ | □ |
| E6 | first-parent-Log == Ledger; Audit-Log ohne unerklärte Änderung | □ | □ | □ |
| E7 | D1 gemergt, 8d vollständig | □ | □ | □ |
| E8 | D2–D9 rot mit erwartetem Code, geschlossen, Branches erhalten | □ | □ | □ |
| E9 | kein offener STOP/Incident/BG-Fenster; R3-Bypass vorhanden; R2-Checks eingetragen; PR #2 geschlossen; Readback ≤ 30 min | □ | □ | □ |
| PM §9 / §10 P1–P3 | alle Pflichtklassen PASS | □ | □ | □ |
| `M_BS` | `forge/ops/BOOTSTRAPPED.md` gemergt unter beiden Required Checks | □ | □ | □ |

Erklärung „FORGE V0.1 BOOTSTRAPPED“ — Owner, UTC: □

---

## §I Ledger (jeder Merge auf `main` ab `3d7545d`)

| # | Schritt | PR | Merge-Commit M | `M^1` | `M^2` | `merged_by.id` | Methode | Zweck |
|---|---|---|---|---|---|---|---|---|
| 1 | P0.11 | □ | □ | 3d7545d… | □ | □ | merge | Owner-Ops |
| 2 | P1.4 | □ | □ | □ | □ | □ | merge | Registrierung A |
| … | | | | | | | | |

---

## §J STOP- und Incident-Log

| UTC | STOP-ID (Matrix) | STOP-Satz (Runbook §6.4) | Halt-Schritte H-1…H-4 ausgeführt | Recovery-Zeile | Wiedereinstieg | Abschluss-Notiz |
|---|---|---|---|---|---|---|
| □ | □ | □ | □ | □ | □ | □ |
