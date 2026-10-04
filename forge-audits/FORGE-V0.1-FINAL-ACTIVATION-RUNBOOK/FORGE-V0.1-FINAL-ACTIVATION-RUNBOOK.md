# FORGE V0.1 — FINAL OPERATIONS & ACTIVATION RUNBOOK

Stand: 2026-10-04, ca. 17:30–18:30 UTC · Autor: Claude (Anthropic), Rolle Owner-Runbook-Autor, read-only gegenüber dem kanonischen Repository
Repository: `Forge-Dice/Forge` (immutable ID 1401864629) · `main` = `3d7545d843883418348004e68717399a64da7a7d` (vor Beginn per `git ls-remote` gelesen)
Status dieses Dokuments: **AUTHORED — NOT EXECUTED.** Kein Schritt dieses Runbooks wurde ausgeführt, kein Kästchen ist abgehakt, kein Prüfpunkt gilt als bestanden.

Begleitdokumente (gleiches Verzeichnis):
- `FORGE-V0.1-ACTIVATION-CHECKLIST.md` — abhakbare Kurzfassung je Schritt
- `FORGE-V0.1-EVIDENCE-SHEET.md` — leere Evidence-Formulare (Plattform, A/B/C, Isolation, Aktivierung, Drill D1–D9, BOOTSTRAPPED)
- `FORGE-V0.1-STOP-RECOVERY-MATRIX.md` — jede STOP-Bedingung mit Sofortmaßnahme und Wiedereinstieg

Dieses Runbook enthält **keine neue Architektur, keine neue Owner-Ausnahme und keine Live-Ausführung.** Jeder Schritt ist aus einem unten registrierten Originalartefakt abgeleitet; die Quelle steht am Schritt. Wo Quellen sich widersprechen, steht die Auflösung im Abweichungsregister (§2), nicht still im Text.

---

## 0. Ergebnis in zehn Zeilen

1. Die Aktivierung läuft in acht Phasen P0–P7 strikt nacheinander; jede Phase hat einen Gate-Schritt, ohne den die nächste nicht beginnt.
2. P0 baut die Plattform **ohne R2**: Repo-Settings, Actions Execution Policy (AEP) zuerst, dann R1 → R7 → R4 → R5 → R6 → R3, S1-Negativtest, Owner-Ops-PR (REC P0.4/P0.5, DRILL §3).
3. A, B und C laufen als Format-1-Bootstrap (D1) in der DAG A → B → C; jede Abnahme ist extern-reviewt, Owner-attestiert und Owner-gemergt, ohne Maschinencheck (der Verifier zertifiziert seine eigene Entstehung nicht).
4. C wird in P3 nur registriert und implementiert; abgenommen und gemergt wird C erst nach bestandener Execution-Isolation-Live-Validierung (P4), weil der Merge von C die Inbetriebnahme ist (FBR §8).
5. R2 kommt **zuletzt** (P5), erst nach nativer Check-Bindung mit echter numerischer `integration_id`; R2 erlaubt ausschließlich Merge Commit (D4).
6. R3 trägt die **beabsichtigte** PR-only-Owner-Autorisierung (User 315180734, `bypass_mode: pull_request`); sie wird pro Merge protokolliert und ist kein STOP. Ein „Zero-Bypass“-PASS-Kriterium existiert in diesem Runbook nicht (D4, Repair 8b/8c).
7. Halt und Break Glass verwenden ausschließlich die beschlossene Mechanik: Runs abbrechen, Actions aus, R3-Bypass entziehen; Revert-Fenster genau wie FBR §12. Kein Halt-Ruleset, keine Halt-Variable.
8. Der erste gemanagte Run ist der clampAtZero-Drill (P6): D1 legitim gemergt, D2–D9 adversarial, alle mit vorab festgelegtem Code/Schicht.
9. „FORGE V0.1 BOOTSTRAPPED“ darf erst nach vollständigem Beleg E1–E9 (§10) ausgesprochen werden. **CORE-0002 startet vorher nicht** — keine Registrierung, kein Run-Branch, kein Format-2-Contract.
10. Heute nicht startbar: A/B/C-r2-Finalcontracts, Paket r2, Drill-Paket r2 und die Drill-Contracts sind **NOT AVAILABLE** (§3). Das Runbook ist trotzdem vollständig; diese Artefakte sind harte Eingangsbedingungen der betroffenen Schritte.

---

## 1. Quellenregister

Gelesen direkt von den Remote-Branches `forge/owner/audits/*` (Commit-SHA = Branch-Spitze zum Lesezeitpunkt) bzw. aus dem Projektordner. SHA-256 über die Rohbytes.

| Kürzel | Artefakt | Ort / Commit | SHA-256 |
|---|---|---|---|
| FRZ | FORGE-V0.1-ARCHITECTURE-FREEZE.md | `FORGE-V0.1-ARCHITECTURE-FREEZE` @ `a5302309` | `a07847c7…b599a79` |
| REC | FORGE-MYSTERY-FINAL-OWNER-RECONCILIATION.md (D1–D10) | `FORGE-MYSTERY-FINAL-OWNER-RECONCILIATION` @ `52dab20b` | `7dbcb852…c45949c4` |
| DRILL | FORGE-RULESET-LIVE-DRILL.html + OWNER-RUNBOOK.txt + api-templates | `FORGE-RULESET-LIVE-DRILL` @ `005bcd09` | html `f6de270e…cdadcdb`, runbook `c26e113b…71d9c` |
| PM | FORGE-FIRST-DRILL-PRE-MORTEM.html | `FORGE-FIRST-DRILL-PRE-MORTEM` @ `9e5789e0` | `7643c85a…39438` |
| EI | FORGE-EXECUTION-ISOLATION-REPORT.md + EI-ACCEPTANCE-CONTRACT.md | `FORGE-EXECUTION-ISOLATION` @ `372b196e` | report `162ff584…79448`, contract `7eaac082…06273` |
| AEPF | Actions Policy Preflight (EVIDENCE-README + JSON) | `FORGE-ACTIONS-POLICY-PREFLIGHT` @ `01dfb21c` | README `3a3e51e6…ad9a6` |
| EXP | FORGE-V0.1-BOOTSTRAP-EXPERIMENTAL-REPORT.html | `FORGE-V0.1-BOOTSTRAP` @ `da9b3d51` | `d3ed7f74…a2a3c` |
| ABCR | A/B/C Repair Candidates v2 + Repair Report | `FORGE-VERIFIER-ABC-REPAIR` @ `5fdc4169` | A `4f721a4b…496a4`, B `92be65ef…08e4e1`, C `5f008f91…4ad1`, Report `203409d7…38c07` |
| ORV2 | High-Confidence Oracle V2 (Report + raw-results.json) | `FORGE-HIGH-CONFIDENCE-ORACLE-V2` @ `ea46c266` | report `7ff13a1e…bfafda`, raw `7fb889d1…87143` |
| FBR | FORGE-V0.1-FINAL-BOOTSTRAP-RECONCILIATION.md | Projektordner (nicht in Git; persönliche Daten daraus werden nicht übernommen) | `2dd467e9…6aef7` |
| BCP | FORGE-V0.1-BOOTSTRAP-CONTRACT-PLAN.md | Projektordner | `c344e022…401bd5` |

Ruleset-/AEP-Templates (DRILL `api-templates/candidate-rulesets/*.json`, `actions-policy.json`): R1 `01c35cc1…`, R2 `f38373a7…`, R3 `b6cea887…`, R4 `5355a6eb…`, R5 `97318871…`, R6 `9f9e373d…`, R7 `bac56218…`, AEP `1b04114a…`.

**Owner-Entscheidungen:** D1–D10 aus REC sind laut Sebs Auftrag vom 2026-10-04 angenommen (Empfehlung je Entscheidung). D4 ist für dieses Runbook ausdrücklich bindend. OD-B4 („kein Halt-Ruleset“) ist laut REC D.1 durch die DRILL-Freeze-Mechanik beantwortet.

**Vorrang bei Widerspruch** (wie im Auftrag für Contract-Repairs festgelegt): (1) bindende Owner-Entscheidung → (2) späteres experimentelles/Closure-Ergebnis → (3) Originalcontract → (4) ältere Design-/Research-Artefakte. FRZ ist Leitreferenz, außer wo eine Owner-Entscheidung oder ein späteres Labor sie ausdrücklich ersetzt.

---

## 2. Abweichungsregister (was dieses Runbook gegenüber einzelnen Quellen festlegt, und warum)

| ID | Quelle sagt | Runbook verwendet | Grund |
|---|---|---|---|
| AB-01 | FRZ §9: zehn Rulesets inkl. `forge-halt` (disabled→active) | sieben Rulesets R1–R7 + AEP, **kein** Halt-Ruleset | OD-B4 (REC D.1), FBR §3/§12, DRILL §2 |
| AB-02 | FRZ Z. 162 „in keiner Bypass-Liste“; FRZ Z. 1045 „Organization admin Always“ | Bypass ausschließlich R3 (User 315180734, `pull_request`) und R5 (User 315180734, `always`) | D4, REC Repair 8b |
| AB-03 | DRILL-Templates R2 `allowed_merge_methods: [merge, squash, rebase]` | `["merge"]` + DENY-Fälle squash/rebase im Drill-Inventar | D4, REC Repair 8a |
| AB-04 | PM §9 PASS „No protection bypass required“; STOP-BYPASS-LITERAL | „Kein Bypass von R1/R2/R6/R7/AEP/Scope; R3-PR-only-Owner-Autorisierung wird benutzt, pro Merge protokolliert, kein STOP“ | D4, REC Repair 8c |
| AB-05 | FRZ §7.2/§9.4: Workflow `forge-verify.yml`, zusätzlich `workflow_dispatch` | Workflow `.github/workflows/forge-v01.yml` (Contract C), Trigger **nur** `pull_request_target`, Owner-Recheck = Re-run all jobs | EXP H3, FRZ W-32, REC D.1 PB-1, ABCR C „Workflow boundary“ |
| AB-06 | FBR §3: R2 bei P0 aktiv mit leerer Required-Check-Liste | R2 wird erst in P5 angelegt, nach `bind-checks` mit echter `integration_id`; bis dahin erzwingt die Repo-Einstellung „nur Merge Commit“ die Methode | REC P0.4 („R2 noch nicht“) und P2.3; DRILL §3 P6/P7; Platzhalter `__BIND_CHECK_APP_ID__` darf nie an GitHub gesendet werden (DRILL README) |
| AB-07 | FBR §8/§13 „29 Offline-Sicherheitstests (Live Drill) grün“ als Isolationsnachweis | B/C-Isolations-Abnahmeprobes mit gemessenen Denials + EI-Live-Validierung; die 29 Tests sind nur Harness-Nachweis | REC Repair 7c |
| AB-08 | FBR §9 PASS: Differential Corpus als Gleichheitsorakel | normativ: 61 Goldens + 24 Property-Familien gegen Paket r2; Korpus explorativ; Abweichung nach Triage, Referenzfehler dokumentiert | D6, REC Repair 5b |
| AB-09 | ORV2 (16:17Z): 76 High-Confidence-Fälle + 30 Property-Familien, „GO AS DIFFERENTIAL ORACLE“, alle Auflösungen `contractSensitive` an die alten Drafts gebunden | zusätzlich als Differentialorakel nach Neu-Pinning gegen die finalen Contracts; ersetzt das D6-Golden-Paket nicht; nie Mehrheitsentscheid | D6 bindend vor späterem Labor; ORV2 Protokoll Punkt 1/8 |
| AB-10 | FBR §3 AEP „nur `.github/workflows/forge-verify.yml`“ (Pfadfilter) | AEP-JSON aus DRILL: `workflow_path.include = ["~ALL"]`, `exclude = []`, Events nur `pull_request_target`, Akteure nur 315180734 und 337272506 | DRILL §8 (später, exakt, ohne Pfadausnahme); EXP H3 „keine Path-Ausnahmen“ |
| AB-11 | BCP §10 E3 „VERIFIER-0001, CORE-0002, VERIFIER-0002, VERIFIER-0003“; E4 „Format 1 geschlossen“; E9 „Halt disabled“ | E3 = 0001A/B/C; E4 = Format 1 bleibt bis CORE-0002 (D1); E9 ohne Halt-Ruleset | REC A.0/D1, FBR §14 Schritt 12 |
| AB-12 | ältere Pläne: Halt über Repo-Variable `FORGE_HALT` | verworfen | AEPF: `forge-codex` konnte im Labor `FORGE_HALT=false` anlegen (Write darf Variablen verwalten); FRZ W-21 |
| AB-13 | PM B2: falsche Merge-Methode nur operativ („MANUAL ONLY“) | durch R2 `["merge"]` serverseitig gesperrt; zusätzlich operative Prüfung | D4 |
| AB-14 | PM §11.2: D2–D9 vor dem einzigen D1-Merge, alle gegen den D1-Contract | D1 zuerst (FORGE-DRILL-0001), danach D2–D9 gegen registrierten FORGE-DRILL-0002, alle geschlossen | REC P3.1/P3.2 (später, zitiert PM als Checkliste); FBR §10 TD-1/TD-2 |
| AB-15 | ABCR Candidate C: Severity `critical/high/medium/low/info` + `disposition`, Supersedes innerhalb eines Envelopes **transitiv**, Codes `REVIEW_SCHEMA`/`REVIEW_CHANGED_AFTER_GATE`; je Contract max. 4 Mutanten, kein A5/B5/C5; keine r2-Paketbindung | Runbook verlangt in P1.1/P2.1/P3.1 Contracts, die **D2/D3 und REC A.1–A.3** umsetzen (Severity {info, minor, major, critical}, blocking = major/critical; Supersedes über ältere Reviews, exakte Blockermenge, **keine Transitivität**; Receipt-Feld `reviewSnapshotDigest`; Mutanten A1–A5, B1–B5, C1–C5; Bindung Paket r2 §§1–18) | D2/D3 bindend vor späterem Labor; Abweichung wird hier nicht repariert, sondern ist Eingangs-STOP (§3 OI-4) |
| AB-16 | FRZ §9.4 Allowlist `actions/checkout`, `actions/upload-artifact` | Allowed Actions: nur lokale/Forge-Dice-Actions wie im Drill; Contract C verlangt „no checkout/cache/HEAD step“. Ein Bedarf an externen Actions entsteht nur aus dem akzeptierten C-Workflow und wird dann per SHA gepinnt | DRILL Runbook §2, ABCR C |

---

## 3. Fehlende Artefakte und offene Punkte (nichts davon wird hier rekonstruiert)

| ID | Gegenstand | Wirkung im Runbook |
|---|---|---|
| OI-1 | **Identität des Claude-GitHub-Zugangs.** Diese Sitzung ist laut `get_me` als `Wuerfelduell` (315180734) authentifiziert. Jede AI-Sitzung mit diesem Connector schreibt technisch als Owner; nach R5 sind solche Writes auf `forge/owner/**` regelkonform (PAC PA-110, FRZ §4.4 „Stufe A: Claude schreibt nicht“). | P0.2 inventarisiert alle Schreibwege; P0.7 startet erst, wenn der Owner diesen Zustand dokumentiert und gemäß FRZ §4.4 aufgelöst hat (Zugang auf read-only gesetzt bzw. AI-Writes ausgeschlossen). Das Runbook trifft dazu keine neue Entscheidung. |
| OI-2 | **Autor/Reviewer-Kollision.** REC P1.1 nennt Claude als Autor der Contract-Repairs; D5 nennt Claude als externen Architektur-/Code-Reviewer für A/B/C. FBR §14 hält Claude nur dann als Reviewer für zulässig, wenn Claude keine Contract-Inhalte schreibt. | P1.3/P2.1/P3.1 verlangen, dass die reviewende Instanz nicht die Autorin der jeweiligen Revision ist; der Owner protokolliert vor dem Review, welche Instanz welche Rolle hatte. Ist das nicht möglich → STOP vor dem Review. |
| OI-3 | **Kanonischer Isolations-Probe-PR (FBR §8 Zeile C).** Kein Quellartefakt spezifiziert, über welches Profil/welchen Scope ein Owner-Probe-PR Stage 2 erreicht, ohne vorher am Gate abgewiesen zu werden. | P5.4 gilt nur als Isolationsnachweis, wenn der Run nachweislich Stage 2 erreicht. Weist das Gate vorher ab, ist P5.4 **INCONCLUSIVE** (nicht PASS); dann tragen P4 (Lab) und die D-Läufe den Nachweis, und der Owner hält das in E5 fest. |
| OI-4 | **A/B/C r2 Final Contracts und Paket r2 (§§1–18): NOT AVAILABLE.** Vorhanden sind nur ABCR-Candidates v2, die in den unter AB-15 genannten Punkten von D2/D3/REC A.1–A.3 abweichen. | P1.1 ist Eingangs-STOP, bis eine r2-Fassung vorliegt, die D1–D3/D6 und REC A.1–A.3 umsetzt. |
| OI-5 | **Drill-Paket r2** (R2 merge-only, DENY squash/rebase, PM-PASS-Wortlaut): NOT AVAILABLE. | P0.3 muss es erzeugen; P0.4 startet nicht ohne. |
| OI-6 | **FORGE-DRILL-0001 (D1) und FORGE-DRILL-0002 (D2–D9) Contract-/Plantexte:** NOT AVAILABLE. Eckwerte stehen in PM §2/§3. | P5.3 und P6 setzen registrierte, reviewte Drill-Contracts voraus. |
| OI-7 | ORV2-Report: Datei ist nach „## 4“ byte-beschädigt; `raw-results.json` ist intakt (76/76, 16 resolved, 30 Familien/24 000 Checks, 13/13 Self-Mutanten). | Nur `raw-results.json` und Abschnitte 1–3 werden zitiert. |
| OI-8 | Organisationsweite Actions-Policies: API 404 (AEPF), also UNKNOWN, nicht leer. | P0.6 verlangt Owner-UI-Nachweis der Org-Ebene. |
| OI-9 | GitHub-Default-Blockierung von `pull_request_target` in öffentlichen Repos ab **2026-11-02** (EXP §4, FBR AD-5). | Liegt P5 nach diesem Datum: S1-Positivlauf und AEP-Readback in P5.1 erneut belegen. |

---

## 4. Rollen und Identitäten

| Rolle | Identität (numerisch maßgeblich) | Darf | Darf nicht |
|---|---|---|---|
| Owner | `Wuerfelduell`, User-ID **315180734**, Org Owner, Repo Admin, einziger Mensch | Settings, Rulesets, AEP; Owner-PRs auf `forge/owner/**`, `forge/contract/**`; Attestation (PR-Review COMMENTED); einziger Merger über R3 | direkter Push auf `main`; Push auf `forge/run/codex/**`; Delete/Force-Push (R1); Bypass in R1/R2/R6/R7/AEP |
| Developer | `forge-codex`, User-ID **337272506**, Repo-Rolle Write (keine Maintain/Admin) | Push auf `forge/run/codex/**` (R4), PRs aus diesem Namensraum | Merge; Settings; Owner-/Contract-Namensraum; Workflow-Start außer `pull_request_target` |
| Externer Reviewer | Claude (Anthropic) für A/B/C und Drill (D5); Codex-Lab als unabhängiger Prüfer für Mystery-Repairs | Review-Bericht als Bytes, gebunden an B/H/C/P | eigene Arbeit reviewen (OI-2); GitHub-Schreibaktionen |
| GitHub Actions | `GITHUB_TOKEN` mit `permissions: {}` | trusted `pull_request_target`-Läufe aus `main` | Ref-Writes, Merge, PR-Erstellung/-Approval |
| Unabhängiger Lab-Runner | vom Owner benannt, nicht Codex | Acceptance, Mutanten, Oracle-Differential für A/B/C | Implementierungscode ändern |

Jede Identitätsprüfung erfolgt über `GET /user` (numerische `id`) des tatsächlich verwendeten Tokens; Commit-Author/Committer oder Loginnamen beweisen nichts (DRILL §1).

---

## 5. Sollwerte: Rulesets R1–R7, AEP, Repository-Einstellungen

### 5.1 Ruleset-Tabelle (final reconciliert)

| # | Name | Target | Include | Exclude | Bypass (exakt) | Rules |
|---|---|---|---|---|---|---|
| R1 | `forge-refs-immutable` | branch | `~ALL` | `[]` | `[]` | `deletion`, `non_fast_forward` |
| R2 | `forge-main-quality` | branch | `refs/heads/main` | `[]` | `[]` | `pull_request` (merge only, 0 approvals, last-push false, code-owner false, stale-dismiss false, thread-resolution false); `required_status_checks` (`forge-gate`, `forge-verify`, beide mit numerischer `integration_id` aus P5.5; strict = true; `do_not_enforce_on_create` = false) |
| R3 | `forge-main-owner-merge` | branch | `refs/heads/main` | `[]` | `[{User, 315180734, pull_request}]` | `creation`, `update` (`update_allows_fetch_and_merge: false`) — **keine weiteren Regeln** (FBR PB-2) |
| R4 | `forge-codex-writer` | branch | `refs/heads/forge/run/codex/**/*` | `[]` | `[{User, 337272506, always}]` | `creation`, `update` (fetch_and_merge false) |
| R5 | `forge-owner-contract-writer` | branch | `refs/heads/forge/owner/**/*`, `refs/heads/forge/contract/**/*` | `[]` | `[{User, 315180734, always}]` | `creation`, `update` (fetch_and_merge false) |
| R6 | `forge-deny-other-branches` | branch | `~ALL` | `refs/heads/main`, `refs/heads/forge/run/codex/**/*`, `refs/heads/forge/owner/**/*`, `refs/heads/forge/contract/**/*` | `[]` | `creation`, `update` (fetch_and_merge false) |
| R7 | `forge-no-tags` | tag | `~ALL` | `[]` | `[]` | `creation`, `update` (fetch_and_merge false), `deletion` |

Alle `enforcement: "active"`. Keine Role-, Team-, Integration- oder `exempt`-Bypässe. Keine klassische Branch Protection zusätzlich.

**Bypass-Sollwert (das ist das PASS-Kriterium, nicht „zero bypass“):**
- `bypass_actors == []` für R1, R2, R6, R7.
- R3 `bypass_actors == [{"actor_type":"User","actor_id":315180734,"bypass_mode":"pull_request"}]` — **beabsichtigt**. Jeder Owner-Merge benutzt diese Autorisierung über `PUT /repos/Forge-Dice/Forge/pulls/{n}/merge-async` mit `sha=<H>`, `merge_method=merge`, `merge_action=direct_merge`, `bypass_rules=true` und wird im Evidence Sheet protokolliert. R2 gilt dabei unverändert (bypassfrei).
- R4 `bypass_actors == [{"actor_type":"User","actor_id":337272506,"bypass_mode":"always"}]`.
- R5 `bypass_actors == [{"actor_type":"User","actor_id":315180734,"bypass_mode":"always"}]`.
- Für den Owner bypassfrei: R1, R2, R4-Scope, R6, R7 und die AEP (D4, Repair 8b).

### 5.2 Exakte JSON-Payloads (POST `/repos/Forge-Dice/Forge/rulesets`)

R1–R7 entsprechen byte-semantisch DRILL `api-templates/candidate-rulesets/R*.json`, mit genau einer Änderung in R2 (`allowed_merge_methods`) und der Ersetzung des Platzhalters erst in P5.5.

```json
{"name":"forge-refs-immutable","target":"branch","enforcement":"active","bypass_actors":[],
 "conditions":{"ref_name":{"include":["~ALL"],"exclude":[]}},
 "rules":[{"type":"deletion"},{"type":"non_fast_forward"}]}
```
```json
{"name":"forge-main-quality","target":"branch","enforcement":"active","bypass_actors":[],
 "conditions":{"ref_name":{"include":["refs/heads/main"],"exclude":[]}},
 "rules":[
  {"type":"pull_request","parameters":{"allowed_merge_methods":["merge"],
   "dismiss_stale_reviews_on_push":false,"require_code_owner_review":false,
   "require_last_push_approval":false,"required_approving_review_count":0,
   "required_review_thread_resolution":false}},
  {"type":"required_status_checks","parameters":{"do_not_enforce_on_create":false,
   "required_status_checks":[
     {"context":"forge-gate","integration_id":<INTEGER_FROM_P5.5>},
     {"context":"forge-verify","integration_id":<INTEGER_FROM_P5.5>}],
   "strict_required_status_checks_policy":true}}]}
```
`<INTEGER_FROM_P5.5>` ist eine JSON-Ganzzahl aus der nativen Check-Bindung. Der Platzhalter oder `null`, `-1`, ein String oder eine weggelassene `integration_id` (Any-Source) darf **nie** gesendet werden (DRILL README; AEPF: Any-Source-Status führte im Labor zu `merged=true` ohne Verifier).
```json
{"name":"forge-main-owner-merge","target":"branch","enforcement":"active",
 "bypass_actors":[{"actor_type":"User","actor_id":315180734,"bypass_mode":"pull_request"}],
 "conditions":{"ref_name":{"include":["refs/heads/main"],"exclude":[]}},
 "rules":[{"type":"creation"},{"type":"update","parameters":{"update_allows_fetch_and_merge":false}}]}
```
```json
{"name":"forge-codex-writer","target":"branch","enforcement":"active",
 "bypass_actors":[{"actor_type":"User","actor_id":337272506,"bypass_mode":"always"}],
 "conditions":{"ref_name":{"include":["refs/heads/forge/run/codex/**/*"],"exclude":[]}},
 "rules":[{"type":"creation"},{"type":"update","parameters":{"update_allows_fetch_and_merge":false}}]}
```
```json
{"name":"forge-owner-contract-writer","target":"branch","enforcement":"active",
 "bypass_actors":[{"actor_type":"User","actor_id":315180734,"bypass_mode":"always"}],
 "conditions":{"ref_name":{"include":["refs/heads/forge/owner/**/*","refs/heads/forge/contract/**/*"],"exclude":[]}},
 "rules":[{"type":"creation"},{"type":"update","parameters":{"update_allows_fetch_and_merge":false}}]}
```
```json
{"name":"forge-deny-other-branches","target":"branch","enforcement":"active","bypass_actors":[],
 "conditions":{"ref_name":{"include":["~ALL"],"exclude":["refs/heads/main",
   "refs/heads/forge/run/codex/**/*","refs/heads/forge/owner/**/*","refs/heads/forge/contract/**/*"]}},
 "rules":[{"type":"creation"},{"type":"update","parameters":{"update_allows_fetch_and_merge":false}}]}
```
```json
{"name":"forge-no-tags","target":"tag","enforcement":"active","bypass_actors":[],
 "conditions":{"ref_name":{"include":["~ALL"],"exclude":[]}},
 "rules":[{"type":"creation"},{"type":"update","parameters":{"update_allows_fetch_and_merge":false}},{"type":"deletion"}]}
```

### 5.3 Actions Execution Policy (POST `/repos/Forge-Dice/Forge/actions/policies`)

```json
{"name":"forge-trusted-pr-target-only","enforcement":"active",
 "conditions":{"workflow_path":{"include":["~ALL"],"exclude":[]}},
 "rules":[
  {"type":"restrict_actions_actors","parameters":{"allowed_actors":[
    {"id":315180734,"type":"User"},{"id":337272506,"type":"User"}]}},
  {"type":"restrict_action_events","parameters":{"allowed_events":["pull_request_target"]}}]}
```
Readback: `GET /repos/Forge-Dice/Forge/actions/policies?has_parents=true&per_page=100` und `GET …/actions/policies/{id}`. Die AEP ist kein achtes Ruleset; sie ist die zweite Schutzfläche neben den Ref-Rulesets (EXP §13).

### 5.4 Repository- und Actions-Einstellungen (Sollwerte, FRZ §9.4/§9.5 mit AB-05/AB-16)

| Bereich | Sollwert |
|---|---|
| Pull Requests | Merge commits **an**; Squash **aus**; Rebase **aus**; Auto-Merge **aus**; Head-Branches automatisch löschen **aus**; „Always suggest updating PR branches“ **aus** |
| Actions → General | Allowed actions: nur lokale/Forge-Dice-Actions (AB-16); Default workflow permissions **read**; „Allow GitHub Actions to create and approve pull requests“ **aus**; Fork-PR-Workflows: Approval für alle externen Beitragenden |
| Secrets, Variables, Environments, Deploy Keys, Webhooks, Self-hosted Runner | **keine** |
| Collaborators/Teams | Owner Admin (Org Owner); `forge-codex` Write (direkt oder via Team `forge-dev-codex`); sonst niemand mit Write |
| Apps mit Schreibrecht | inventarisiert; siehe OI-1 |
| Code security | Secret Scanning + Push Protection an; Dependabot updates aus |
| Klassische Branch Protection | keine |

---

## 6. Halt und Break Glass (ausschließlich beschlossene Mechanik)

Rahmen: kein Halt-Ruleset (OD-B4), keine Halt-Variable (AB-12); R1 und R2 bypassfrei; R3 Owner PR-only. Quelle: FBR §12, DRILL §10 (Freeze-Operation) und STOP-Teil des DRILL-Owner-Runbooks.

### 6.1 HALT (Incident beginnt) — Reihenfolge fest

| Schritt | Aktion | API/Ort | Beleg |
|---|---|---|---|
| H-0 | Keine weiteren Pushes, Re-runs, Merges, Settings-Lockerungen oder Aufräumaktionen. STOP-Satz notieren (§6.4). | — | STOP-Satz mit UTC |
| H-1 | Laufende und wartende Workflow-Runs abbrechen. Greift Cancel nicht: Force-Cancel. | `POST /repos/Forge-Dice/Forge/actions/runs/{id}/cancel`, ggf. `/force-cancel` | Run-IDs, Endzustand |
| H-2 | Actions im Repository deaktivieren, wenn der Verifier selbst oder ein untrusted Job verdächtig ist. | `PUT /repos/Forge-Dice/Forge/actions/permissions` mit `{"enabled":false}` | Readback `enabled=false` |
| H-3 | `main` einfrieren: R3 `bypass_actors=[]` setzen; R3 bleibt `active` mit denselben Includes und Regeln. Danach kann niemand `main` aktualisieren. | `PUT /repos/Forge-Dice/Forge/rulesets/{R3_id}` | R3-Readback vorher/nachher |
| H-4 | Evidence sichern: Run-Logs, R1–R7 + AEP als JSON, Audit-Log-Auszug (`repository_ruleset.*`, `git.push`), betroffene SHAs, offene `merge-async`-UUIDs read-only bis final verfolgen. | GET-only | Incident-Datei-Entwurf `forge/ops/INCIDENT-<nnnn>.md` |

Bei laufendem untrusted Job hat H-1 Vorrang vor jedem Export. Ein bereits angenommener `merge-async`-Request wird durch H-2/H-3 nicht widerrufen; er bleibt Teil des Incidents (DRILL §10).

### 6.2 Was der Owner bei einem Incident darf

| Fall | Erlaubt (abschließend) |
|---|---|
| Check fällt aus Infrastrukturgründen | **einmal** Re-run all jobs je Head und Ursache; bleibt es rot, gilt der Fehler als real |
| Verifier falsch rot oder falsch grün (Defekt nach Aktivierung) | (1) HALT §6.1. (2) Revert-PR `forge/owner/revert-<nnnn>`: **nur** `git revert -m 1 <A_x>` des verursachenden Abnahme-Merges + Incident-Datei; zwei externe Reviews, Owner-Review. (3) In R2 **nur** die zwei Required-Check-Einträge entfernen (R2 bleibt aktiv; PR-Pflicht und Merge-Commit-Regel bleiben). (4) R3-Bypass zurückgeben und **genau diesen** PR mergen. (5) Checks in R2 sofort wieder eintragen (gleiche `integration_id`). (6) Actions wieder an, Smoke (P5.3-Muster) wiederholen. (7) Folge-Owner-PR mit Ruleset-JSON vorher/nachher und Audit-Auszug |
| Ein gemergter PR ist falsch, Verifier gesund | wie oben ohne (3) und (5): normaler Revert-PR durch die Checks |
| Plattformfehler vor Aktivierung (P0–P4) | nur H-1…H-4; Korrektur genau des falschen Feldwerts auf den Sollwert §5, während eingefroren; danach neuer Nachweis |

R3-Bypass wird erst zurückgegeben, wenn der Revert-PR grün und reviewt ist (FBR AD-6).

### 6.3 Was der Owner nicht darf

Direkt auf `main` pushen; Force-Push oder Löschen; R1 oder R2 deaktivieren oder Bypass-Akteure in R1/R2/R6/R7 eintragen; einen `always`-Bypass für `main` setzen; App-Pins entfernen oder Any-Source-Checks eintragen; die AEP um Events/Pfade/Akteure erweitern; organisationsweite Policies lockern; History umschreiben; im Check-Fenster mehr als **einen** PR mergen oder etwas anderes als den Revert; Verifier-Code ohne Contract ändern; einen STOP automatisch aufheben.

### 6.4 Audit-Regel für das Check-Fenster und STOP-Satz

- Das Fenster ist durch genau zwei `repository_ruleset.update`-Ereignisse auf R2 begrenzt (Checks raus / Checks rein).
- `git log --first-parent` zeigt dazwischen **genau einen** Merge-Commit auf `main`, dessen Diff der Revert plus Incident-Datei ist (Tree nach Revert == Tree vor `A_x` auf den betroffenen Pfaden).
- Jede Abweichung ist ein eigener Incident und verhindert BOOTSTRAPPED.

STOP-Satz (PM §11, wörtlich zu verwenden):
```
STOP FORGE <PHASE> — case=<ID>, invariant=<fixed name>, expected=<layer/code>,
actual=<observed layer/code>, repoId=1401864629, main=<B>, head=<H>,
run=<W>/<attempt>, evidence=<URI/hash>.
No further pushes, re-runs, merges, settings relaxation or cleanup.
Apply only the pre-authorized recovery row; otherwise remain stopped.
```

---

## 7. Gemeinsame Regeln für alle Phasen

1. **Ein Schritt nach dem anderen.** Kein paralleles Auslösen; vor dem nächsten Schritt Ergebnis, Ref-SHAs und Request-IDs sichern (DRILL Runbook §0).
2. **Evidenzklassen** getrennt kennzeichnen: API-Readback, UI-Beobachtung, Lab-Fixture, Git-Objekt. 403/404 ist UNKNOWN, nie „leer“. Pending/queued/202 ist kein Ergebnis. INCONCLUSIVE ist kein PASS.
3. **Contracts nur aus Git.** Developer erhalten Repo, Pfad, Commit, Hash, Base — nie Contracttext per Chat (Prozessregel 2026-10-03).
4. **Keine Lockerung.** Kein STOP wird durch Schwächung einer Regel, Policy, eines App-Pins oder einer Checkpflicht umgangen.
5. **Kein Aufräumen.** Keine Branch-/Tag-Löschung, kein Force-Push, kein Rebase, kein `update-branch`; Negativfälle bleiben als geschlossene PRs mit erhaltenen Branches.
6. **Merge immer** per `merge-async` mit `sha=<erwarteter Head>`, `merge_method=merge`, `merge_action=direct_merge`, `bypass_rules=true` (R3), danach terminalen Status abwarten; `M.parents == [B, H]`, `M.tree == H.tree`, `merged_by.id == 315180734`.
7. **Fristen:** Deployment-Readback beim finalen PASS ≤ 30 min alt und nicht in der Zukunft (PM §10 P9); Joblimits laut Paket (PM §11: Job ≤ 20 min, Install 180 s, Typecheck 60 s, Suite 120 s, Mutant 30 s, Final ≤ 10 s) werden live nicht gelockert.
8. **Ledger:** Jeder Merge auf `main` ab P0 bekommt eine Ledger-Zeile (Schritt, PR, M, Parents, merged_by, Zweck). E6 vergleicht später `git log --first-parent 3d7545d..main` zeilengenau.

---

## 8. Phasenfolge

Format je Schritt: **Actor · Identity · Preconditions · Exact action · Expected GitHub object/state · Evidence · PASS · FAIL · STOP · Recovery.** Evidence-Felder sind im Evidence Sheet unter derselben Schritt-ID vorbereitet; STOP-IDs verweisen auf die STOP-Recovery-Matrix.

---

### P0 — Owner Platform Preparation

Ziel: Plattform im Sollzustand §5 **ohne R2**, AEP vor jedem Developer-Push wirksam, ein gemergter Owner-Ops-PR. Quellen: REC P0.1–P0.5, DRILL Runbook, FBR §7, FRZ §9.

#### P0.1 Owner-Entscheidungsprotokoll persistieren
- **Actor:** Seb · **Identity:** Wuerfelduell (Mensch)
- **Preconditions:** REC gelesen; D1–D10 angenommen.
- **Exact action:** Protokolldatei `OWNER-DECISIONS-D1-D10.md` mit je einer Zeile „Dn: Empfehlung angenommen, <UTC>“ anlegen (Projektordner); Aufnahme nach `forge/ops/` im Owner-Ops-PR (P0.11).
- **Expected state:** Datei existiert; in Git spätestens mit P0.11.
- **Evidence:** SHA-256 der Datei; später Blob-ID auf `main`.
- **PASS:** jede der zehn Entscheidungen hat genau eine Antwort.
- **FAIL:** fehlende oder mehrdeutige Antwort.
- **STOP:** eine Antwort verlangt neue Architektur (S-P0-01).
- **Recovery:** zurück an Reconciliation; P0.2 ff. beginnen nicht.

#### P0.2 Identitäts- und Schreibweg-Inventar (read-only)
- **Actor:** Seb · **Identity:** Owner-Token (fine-grained, nur `Forge-Dice/Forge`, Administration read) und separat Codex-Token
- **Preconditions:** P0.1.
- **Exact action:** `GET /user` je Token (IDs 315180734 / 337272506); `GET /repos/Forge-Dice/Forge` (ID 1401864629, public, default `main`); `GET …/collaborators?affiliation=all` + `…/collaborators/{u}/permission`; Teams; Org-Basisrechte; installierte GitHub Apps mit Repo-Zugriff und Rechten; `…/keys`, `…/hooks`, `…/actions/secrets`, `…/actions/variables`, `…/environments`, `…/actions/runners`; `…/rulesets?includes_parents=true`; `…/branches/main/protection`; `…/actions/policies?has_parents=true`; Org-Actions-Policies (bei 404 UI-Nachweis, OI-8).
- **Expected state:** Owner admin; `forge-codex` write (kein maintain/admin); keine weiteren Schreiber; keine Secrets/Variables/Environments/Deploy Keys/Webhooks/Self-hosted Runner; Rulesets `[]`; `main` unprotected; Repo-AEP `total_count=0`.
- **Evidence:** JSON je Endpoint mit UTC und Request-ID; App-Liste mit Rechten; Notiz zu OI-1.
- **PASS:** alle Reads 200 oder per UI belegt, Inventar entspricht Expected oder jede Abweichung ist erklärt.
- **FAIL:** unbekannter Schreiber, Secret, Variable, Runner, Deploy Key oder Webhook.
- **STOP:** ungeklärter Schreibweg (S-P0-02); OI-1 nicht vom Owner dokumentiert (S-P0-03, blockiert ab P0.7).
- **Recovery:** Schreiber entfernen bzw. Zustand dokumentieren (separate Owner-Aktion), Inventar vollständig wiederholen.

#### P0.3 Drill-Paket r2 erzeugen (Audit-Branch, kein `main`)
- **Actor:** Claude oder Codex (Audit-Branch) · **Identity:** eigene Contributor-Identität (nicht Owner, OI-1)
- **Preconditions:** D4.
- **Exact action:** In DRILL r2 genau: `candidate-rulesets/R2.json` und `drill-rulesets/R2.json` → `"allowed_merge_methods":["merge"]` (Repair 8a); je ein DENY-Fall `MERGE-squash` und `MERGE-rebase` im Case-Inventar; PASS-Wortlaut nach Repair 8c; `SHA256SUMS.txt` neu; `python3 tests/selftest_drill.py` grün.
- **Expected state:** neuer Branch `forge/owner/audits/FORGE-RULESET-LIVE-DRILL-R2` (oder vom Owner benannt) mit genau diesen Änderungen.
- **Evidence:** Commit-SHA, Diff gegen `005bcd09`, neue SHA256SUMS, Selbsttest-Log.
- **PASS:** Diff enthält nur 8a/8c-Änderungen und die zwei DENY-Fälle; Selbsttests grün.
- **FAIL:** Selbsttest rot.
- **STOP:** Änderung über 8a/8c hinaus (S-P0-04).
- **Recovery:** neue Revision des Pakets; alte bleibt erhalten.

#### P0.4 Isolierter Ruleset Live Drill (Wegwerf-Lab)
- **Actor:** Seb (Owner-Terminal) + Codex-Terminal für Codex-Fälle · **Identity:** getrennte fine-grained Tokens nur für die Drill-Repos (Owner: Administration, Contents, Workflows, Actions, Pull requests, Commit statuses; Codex: Contents, Workflows, Actions, Pull requests, **keine** Administration)
- **Preconditions:** P0.3; zwei frische öffentliche Repos `Forge-Dice/forge-ruleset-drill-<datum>-a` und `…-root` ohne README/Template/Fork; Actions bei Setup aus; Codex zunächst ohne Write; Runner verweigert Repo-Name `Forge-Dice/Forge` und ID 1401864629.
- **Exact action:** DRILL `OWNER-RUNBOOK.txt` Abschnitte 0–13 wörtlich mit Paket r2: prepare/plan offline → seed → Owner-Canary-Kontrollen → AEP install + Token-Control → R1, R7 + Actions-M1-Proben → R4, R5, R6, R3 → Codex Write → native bind-PR, Owner Re-run all jobs, `bind-checks` → R2 → Ref-Matrix → Root-Fenster → PR/Merge-/Self-PR-/Negativfälle → Stale/Strict → AEP-Drill → Actions als Ref-/Merge-Akteur → Abschluss.
- **Expected state:** 91 benannte Fälle (42 Owner / 30 Codex / 19 Actions) plus AP-Control-/Re-run-Nachweise und die zwei r2-DENY-Fälle; sieben aktive Regeln + AEP im Lab.
- **Evidence:** vollständige Evidence nach DRILL §11 (Payload-Readbacks, je Versuch Before/After-SHA, Request-ID, Auth-Actor, `merge-async`-UUID + finaler Zustand, Check-Runs mit `app.id`/`head_sha`/Suite, `triggering_actor.id`, Blocked-Proof je Event, Root-Snapshot). Zusätzlich gesondert: **PB-2** R3-User-Bypass per API/UI setzbar; **PB-3** AEP blockt `push`/`pull_request`/`workflow_dispatch` vor Jobstart; **native Head-Check-Bindung** bewiesen und beobachtete `integration_id`.
- **PASS:** DRILL §12 vollständig, mit Wortlaut 8c (geplante R3-Autorisierung benutzt und protokolliert); squash/rebase DENY durch R2; kein offener UNKNOWN/INCONCLUSIVE/PENDING.
- **FAIL:** ein erwartetes ALLOW scheitert ohne Lockout-Erklärung (DRILL §9).
- **STOP:** jedes unerwartete ALLOW; untrusted Jobstart; `NATIVE_HEAD_CHECK_BINDING_NOT_PROVEN`; jeder Schreibzugriff auf `Forge-Dice/Forge` (S-P0-05/06/07).
- **Recovery:** DRILL-Freeze (`drill.py --execute freeze`), Recovery-Tabelle DRILL §10, neuer isolierter Run mit frischem Repo/Run-ID; keine kanonische Aktivierung, bis ein vollständiger Lauf PASS ist.

#### P0.5 Kanonische Repository-/Actions-Einstellungen
- **Actor:** Seb · **Identity:** Owner-Token (Administration write), `GET /user` = 315180734 vor Beginn
- **Preconditions:** P0.4 PASS; P0.2 PASS.
- **Exact action:** `PATCH /repos/Forge-Dice/Forge` mit `allow_merge_commit=true`, `allow_squash_merge=false`, `allow_rebase_merge=false`, `allow_auto_merge=false`, `delete_branch_on_merge=false`, `allow_update_branch=false`; Actions: `PUT …/actions/permissions/workflow` (`default_workflow_permissions=read`, `can_approve_pull_request_reviews=false`); Allowed actions nach §5.4; Fork-Approval; Secret Scanning/Push Protection an; Dependabot updates aus.
- **Expected state:** Readback entspricht §5.4.
- **Evidence:** Readback-JSON aller geänderten Endpoints; UI-Screenshot der Merge-Button-Optionen.
- **PASS:** jeder Wert = Sollwert.
- **FAIL:** ein Wert weicht ab.
- **STOP:** Owner kann Settings nicht lesen/schreiben (Identitäts-/Rechteproblem, S-P0-08).
- **Recovery:** exakt den abweichenden Wert korrigieren, erneut lesen.

#### P0.6 AEP auf dem kanonischen Repository
- **Actor:** Seb · **Identity:** Owner-Token
- **Preconditions:** P0.5; Org-Ebene der Actions-Policies per UI dokumentiert (OI-8); keine offenen PRs mit Workflow-Dateien (PR #2 enthält keine).
- **Exact action:** `POST /repos/Forge-Dice/Forge/actions/policies` mit JSON §5.3; Readback `?has_parents=true`.
- **Expected state:** genau eine Repo-Policy, active, `~ALL`/`exclude=[]`, Events nur `pull_request_target`, Akteure exakt 315180734 und 337272506; Parent-Policies bekannt und nicht lockernd.
- **Evidence:** POST-Antwort, Readback-JSON, Parent-Liste, UI-Screenshot „Policies“.
- **PASS:** Readback == §5.3.
- **FAIL:** Readback weicht ab.
- **STOP:** zusätzliche Event-/Pfad-/Akteur-Ausnahme sichtbar; Parent-Policy unbekannt (S-P0-09).
- **Recovery:** Policy exakt auf §5.3 setzen; keine Parent-Policy automatisiert abschalten.

#### P0.7 Rulesets R1 → R7 → R4 → R5 → R6 → R3 (R2 **noch nicht**)
- **Actor:** Seb · **Identity:** Owner-Token
- **Preconditions:** P0.6 PASS; OI-1 vom Owner dokumentiert/aufgelöst (S-P0-03); Codex pusht bis P0.8 nicht (Handoff-Sperre).
- **Exact action:** je `POST /repos/Forge-Dice/Forge/rulesets` mit JSON §5.2 in der Reihenfolge R1, R7, R4, R5, R6, R3; nach jedem POST `GET …/rulesets/{id}`.
- **Expected state:** sechs aktive Rulesets; R2 fehlt; bestehende Branches außerhalb der Namensräume (`claude/forge-architecture-review-hjdq89`, `codex/*`) sind ab R6 eingefroren, ab R1 unlöschbar; `forge/owner/audits/*` bleibt nur für 315180734 schreibbar; `forge/run/codex/IDENTITY-SPIKE-1` bleibt erhalten.
- **Evidence:** sechs Readbacks (ID, `source`, `enforcement`, `conditions`, `rules`, `bypass_actors`), `GET …/rules/branches/main`, Ref-Liste vorher/nachher (unverändert).
- **PASS:** jedes Readback == Sollwert; Bypass-Sollwert §5.1 exakt.
- **FAIL:** Feldabweichung.
- **STOP:** zusätzlicher Bypass oder breite Ausnahme; Ref-Liste verändert (S-P0-10).
- **Recovery:** HALT nicht nötig, solange kein Workflow existiert; Feld exakt korrigieren, Readback wiederholen.

#### P0.8 S1-Negativtest auf dem kanonischen Repository
- **Actor:** Seb · **Identity:** Owner (Git-Push authentifiziert als 315180734)
- **Preconditions:** P0.6, P0.7 PASS; keine Workflows auf `main`.
- **Exact action:** Branch `forge/owner/s1-negative` ab `main` mit genau zwei Dateien: `.github/workflows/x.yml` (`on: [push, pull_request]`, ein Job mit harmlosem `UNTRUSTED_SENTINEL`-Echo) und `.github/workflows/forge-v01.yml` mit `on: pull_request` (gleiche Sentinel-Form). Push; PR nach `main` öffnen; 2 min und 15 min beobachten; PR schließen (Branch behalten).
- **Expected state:** Push akzeptiert (R5); kein Job gestartet; Policy-Blockierung sichtbar (Policy insights).
- **Evidence:** Blocked-Proof je Event (Event, Actor-ID, Workflow-Pfad, SHA, Ref, Zeitfenster, Blockgrund, keine `job.started_at`, kein Sentinel), UI-Screenshot Policy insights, PR-Nummer geschlossen.
- **PASS:** beide Events blockiert mit konkretem Plattformgrund, null gestartete Jobs.
- **FAIL:** kein Blockgrund nach 15 min → INCONCLUSIVE (kein PASS).
- **STOP:** ein Job startet (S-P0-11).
- **Recovery:** HALT §6.1 (H-1, H-2); AEP-Feld prüfen/korrigieren; neuer Test auf frischem Branchnamen; Codex-Push-Sperre bleibt.

#### P0.9 Nicht-destruktive kanonische Negativproben (PD-1)
- **Actor:** Seb und Codex, je eigenes Terminal · **Identity:** numerisch geprüft
- **Preconditions:** P0.8 PASS (erst danach darf Codex pushen, FBR §7.2).
- **Exact action:** nur **Create-Versuche auf neuen Namen**, Commit = leerer Marker-Commit ohne Workflow-Datei, Basis `main`:
  N1 Owner erzeugt Tag `forge-probe-<datum>` (R7); N2 Owner erzeugt `forge-probe/<datum>/owner` (R6); N3 Owner erzeugt `forge/run/codex/PROBE-<datum>/owner` (R4); N4 Codex erzeugt `forge/owner/probe-<datum>/codex` (R5); N5 Codex erzeugt `forge-probe/<datum>/codex` (R6); N6 Codex erzeugt `forge/run/codex/PROBE-<datum>/ok` (R4 ALLOW, positive Kontrolle). Kein Versuch auf `main`, keine Delete-/Force-Versuche auf bestehenden Refs (die beweist P0.4 im Lab).
- **Expected state:** N1–N5 DENY mit Rulegrund, Ref nicht vorhanden; N6 ALLOW.
- **Evidence:** je Versuch Auth-Actor-ID, Kommando, Git-/HTTP-Antwort mit Rulegrund, Ref-Readback danach.
- **PASS:** N1–N5 DENY mit zuordenbarer Regel; N6 ALLOW.
- **FAIL:** DENY nur wegen Token-Rechten (kein Rule-PASS) → Setup korrigieren, wiederholen.
- **STOP:** jedes unerwartete ALLOW (S-P0-12).
- **Recovery:** HALT H-3/H-4; der entstandene Ref bleibt erhalten (R1); Ruleset-Feld korrigieren; neue Probe mit neuem Namen.

#### P0.10 Identity Closeout
- **Actor:** Seb · **Identity:** Owner
- **Preconditions:** P0.9.
- **Exact action:** PR #2 schließen (nicht mergen), Branch `forge/run/codex/IDENTITY-SPIKE-1` behalten; Codex-Commit-Identität auf die GitHub-noreply-Adresse von `forge-codex` festlegen und an einem Testcommit (N6) prüfen; Identity-Spike-Evidence für `forge/ops/` vorbereiten (OE-5).
- **Expected state:** PR #2 `closed`, `merged=false`; keine offenen PRs außer Owner-Ops.
- **Evidence:** PR-Readback; N6-Commit author/committer.
- **PASS:** wie Expected.
- **FAIL/STOP:** PR #2 versehentlich gemergt → S-P0-13 (Incident, Revert-Weg §6.2).
- **Recovery:** siehe Matrix.

#### P0.11 Owner-Ops-PR `forge/owner/bootstrap-0001`
- **Actor:** Seb · **Identity:** Owner
- **Preconditions:** P0.1–P0.10 PASS; externe(s) Review(s) des Inhalts (D5-Rolle, OI-2 beachtet).
- **Exact action:** ein PR mit ausschließlich: `forge/policy.json` (bindet User-IDs 315180734/337272506), `forge/roles/*.md`, `forge/ops/` (FRZ-Kopie, Experimental Report, REC, Entscheidungsprotokoll P0.1, `RULESETS.md` mit P0.4–P0.9-Evidence, `S1-RESULT.md`, dieses Runbook-Paket), `CODEOWNERS`, `.gitattributes`, `.nvmrc`. Keine Code-, Test- oder Workflowdatei; keine Datei, die das Paket r2 einem Contract zuweist (z. B. `forge/verifier/*` gehört C). Owner-Review COMMENTED auf `H`. Merge per `merge-async` (§7 Nr. 6).
- **Expected state:** Merge-Commit `M0` auf `main`, `M0.parents == [3d7545d…, H]`; Ledger Zeile 1.
- **Evidence:** PR, Diff-Dateiliste, Reviews, `merge-async`-UUID + terminal merged, `M0`, `merged_by.id`.
- **PASS:** wie Expected; Dateiliste ⊆ Allowlist.
- **FAIL:** Merge abgelehnt mit erklärbarem Grund.
- **STOP:** Code-/Workflowdatei im PR; Merge-Methode ≠ merge; Merger ≠ 315180734 (S-P0-14).
- **Recovery:** PR schließen, neuer PR mit korrekter Dateiliste; falscher Merge → Revert-PR §6.2.

**P0-Gate:** P0.1–P0.11 PASS, Evidence-Sheet-Abschnitt P0 vom Owner signiert. Erst dann P1.

---

### P1 — A Registration / Implementation / Acceptance

Quellen: REC A.1–A.6, P1.1–P1.3, P2.1; ABCR §10; D1, D2, D3, D5, D6.

#### P1.1 Finales Contract-Paket r2 (Eingangs-STOP heute)
- **Actor:** Contract-Autor laut REC P1.1 (Claude) · **Identity:** Contributor-Identität, nicht Owner (OI-1)
- **Preconditions:** D1, D2, D3, D6; REC A.1–A.3 als OLD→NEW-Vorgabe; ABCR-Candidates nur als Eingabe.
- **Exact action:** Paket `FORGE-MINIMUM-VERIFIER-IMPLEMENTATION-PACKAGE` r2 (eine Datei, §§1–18 gebunden, neues `normative-sections.json`, neuer Sectionhash) und 0001A/B/C `contractVersion: 2` mit allen Repairs aus REC A.2/A.3 auf einem Audit-Branch.
- **Expected state:** r2-Datei + drei Contracts; `parseContractDocument` (Format 1) auf `main` OK; neue `forge-contract-v1`-contentHashes.
- **Evidence:** Branch-SHA, Sectionhash, drei contentHashes, Parser-Log, Diff OLD→NEW gegen REC.
- **PASS:** jede AB-15-Abweichung ist im Sinne von D2/D3/REC aufgelöst; A bindet r2; A hat A1–A5, B hat B1–B5, C hat C1–C5.
- **FAIL:** Parser-Fehler, fehlender Repair.
- **STOP:** ein Repair braucht neue Architektur oder widerspricht FRZ ohne D-Entscheidung (S-P1-01). **Heute: NOT AVAILABLE (OI-4) → STOP.**
- **Recovery:** neue Revision; kein Weiterschalten.

#### P1.2 Oracle-Neubestätigung gegen r2
- **Actor:** unabhängiger Prüfer (nicht Codex, nicht der r2-Autor) · **Identity:** —
- **Preconditions:** P1.1 PASS.
- **Exact action:** 61 Goldens + 24 Property-Familien (D6) gegen r2 neu bestätigen; ORV2 nach Protokoll Punkt 1 neu pinnen (alle `contractSensitive`-Fälle neu ableiten); Korpusfall „0-legitimate“ nach REC Repair 6c umlabeln.
- **Expected state:** normative Goldens grün gegen r2; ORV2-Pins zeigen auf r2.
- **Evidence:** Golden-Liste mit Erwartung + Quelle, Property-Seed/Checks, ORV2-Pin-Datei.
- **PASS:** keine ungeklärte Abweichung; Referenzfehler dokumentiert, nicht nachgebaut.
- **FAIL:** Golden widerspricht r2 → Contract-Frage.
- **STOP:** Mehrheitsentscheid oder Erwartung aus Reference abgeleitet (S-P1-02).
- **Recovery:** Architecture Review entscheidet per Contract-Revision.

#### P1.3 Architektur-Review A
- **Actor:** externer Reviewer laut D5 (Claude/Anthropic), Instanz ≠ r2-Autor (OI-2) · **Identity:** Review-Bytes, vom Owner attestiert
- **Preconditions:** P1.1, P1.2.
- **Exact action:** FORGE-Review zu 0001A v2 (+ Sichtprüfung B/C v2) mit Bindung an Contract-Hash und Paket-r2-Hash.
- **Expected state:** Review-Bericht `approve`, keine Findings mit Severity major/critical (D3).
- **Evidence:** Reportbytes + SHA-256, Instanz-/Rollenprotokoll.
- **PASS:** approve ohne blocking Finding.
- **FAIL:** blocking Finding → zurück zu P1.1.
- **STOP:** Reviewer = Autor (S-P1-03).
- **Recovery:** anderer zulässiger Reviewer; neue Revision.

#### P1.4 Registrierung A
- **Actor:** Seb · **Identity:** Owner
- **Preconditions:** P1.3 PASS; P0-Gate.
- **Exact action:** Owner-PR von `forge/contract/FORGE-BOOTSTRAP-0001A-v2` mit genau der Contractdatei und Task-Index-Eintrag (Format 1); Owner-Review; Merge §7 Nr. 6. Noch keine Required Checks (R2 fehlt) → Bootstrap-Abnahme ist reviewer-verifiziert.
- **Expected state:** Merge `M_A`; Contract-Blob auf `main` byte-gleich mit reviewter Fassung.
- **Evidence:** PR, `M_A`, Blob-ID, Rohbyte-Hash = contentHash-Input, Ledger-Zeile.
- **PASS:** wie Expected; `baseCommit` liegt in der Ancestry von `main`.
- **FAIL:** Hash-Abweichung.
- **STOP:** `baseCommit` ≠ aktuelles `main` ohne Revision; andere Datei im PR (S-P1-04).
- **Recovery:** neue Contract-Revision auf neuem Branch (`…-v3`); alter Branch bleibt.

#### P1.5 Handoff und Run-Start A
- **Actor:** Seb (Handoff), Codex (Run) · **Identity:** Codex 337272506
- **Preconditions:** P1.4.
- **Exact action:** Handoff mit Repo, Pfad, Contract-Commit, contentHash, erwartetem `main`; Codex liest aus Git, legt `forge/run/codex/FORGE-BOOTSTRAP-0001A/<slug>` ab aktuellem `main` an; Lesequittung in der Form, die r2 vorschreibt (sonst PM-Konvention: leerer Commit, Tree = Base-Tree).
- **Expected state:** Run-Branch existiert, erster Commit Lesequittung.
- **Evidence:** Handoff-Text + Hash, Ref-Readback, Quittungscommit.
- **PASS:** Pins in der Quittung stimmen.
- **FAIL:** falsche Pins → neuer Run-Branch.
- **STOP:** Contract per Chat übergeben oder Scope-Erweiterung im Handoff (S-P1-05).
- **Recovery:** Handoff neu; alter Branch bleibt.

#### P1.6 Implementierung A
- **Actor:** Codex · **Identity:** 337272506
- **Preconditions:** P1.5.
- **Exact action:** Implementierung strikt im Scope von A; PR nach `main`.
- **Expected state:** offener PR, Diff nur Scope-Pfade.
- **Evidence:** PR, Diff-Dateiliste, Commits linear, ein Parent je Commit.
- **PASS:** Scope exakt.
- **FAIL:** Defekt → Fix im selben Run.
- **STOP:** Änderung bestehender Tests oder `src/forge/**`, neue Dependency, Datei außerhalb Scope (S-P1-06).
- **Recovery:** PR schließen, neuer Run (History bleibt).

#### P1.7 Abnahme A
- **Actor:** unabhängiger Lab-Runner; externer Code-Reviewer (D5); Seb (Attestation, Merge)
- **Preconditions:** P1.6; Head eingefroren.
- **Exact action:** Acceptance A vollständig; Mutanten A1–A5 nach Mutantenregel (isolierter Assertiontest, Masking-Erklärung, Anchorbytes/Before-After-SHA vom Reviewer eingefroren); Goldens/ORV2-Differential; Code-Review; Owner-Attestation (Review COMMENTED auf `H`); Merge §7 Nr. 6.
- **Expected state:** `A_A` = echter accepted commit.
- **Evidence:** Acceptance-Report, Mutantentabelle (KILLED nur nach Regel), Differential-Zählzeile, Review-Bytes, Attestation-ID, `A_A`, Ledger.
- **PASS:** alle Acceptance-Fälle grün; A1–A5 KILLED; keine ungeklärte Abweichung; approve.
- **FAIL:** Fall rot → Fix im selben Run oder neuer Run.
- **STOP:** Mutant nur durch Codewechsel zwischen zwei sicheren Ablehnungen „getötet“; Developer-Selbstauskunft als Nachweis (S-P1-07).
- **Recovery:** Abnahme wiederholen; B bleibt gesperrt.

**P1-Gate:** `A_A` auf `main`, im Ledger, Evidence signiert.

---

### P2 — B Registration / Implementation / Acceptance

Quellen: REC P2.2, Blocker 7a, F05/F06/F07; ABCR §10.

#### P2.1 B-Revision mit echtem `acceptedCommit` A
- **Actor:** Contract-Autor → externer Reviewer (≠ Autor) · **Preconditions:** P1-Gate.
- **Exact action:** 0001B Revision: `dependencies[0].acceptedCommit = A_A`, `baseCommit` = aktuelles `main`, `contractVersion` erhöhen, kanonisch neu parsen/hashen (F07); Satz F06 („Autorität für die Annahme von A ist allein die dokumentierte externe unabhängige Owner-Abnahme“); Review.
- **Evidence:** neue Contract-Datei, Hash, Review.
- **PASS:** approve; kein `null` mehr.
- **STOP:** erfundene oder nicht-`main`-SHA (S-P2-01).
- **Recovery:** Revision neu.

#### P2.2 Registrierung B
- wie P1.4 mit `forge/contract/FORGE-BOOTSTRAP-0001B-v<N>`; Ergebnis `M_B`.

#### P2.3 Implementierung B
- **Actor:** Codex · **Preconditions:** P2.2; Docker-fähige Testfläche benannt.
- **Exact action/Expected/STOP:** wie P1.5/P1.6 für B.

#### P2.4 Abnahme B (inkl. gemessener Isolations-Denials)
- **Actor:** unabhängiger Lab-Runner, Code-Reviewer, Seb
- **Preconditions:** P2.3; extern digest-gepinntes harmloses Acceptance-Image (F05), kein Produktionsimage.
- **Exact action:** Acceptance B; Mutanten B1–B5; Isolationsprobe: Probe-Worker mit exakt den §6-Flags meldet gemessene Denials (Netz, Docker-Socket, Actions-Commandfiles, schreibgeschützte Pfade; z. B. ENETUNREACH/ENOENT/EACCES/EROFS) **lokal und auf einem GitHub-hosted Runner einer separat autorisierten Testfläche**; Verifierentscheid und Supervisorzustand unverändert (Repair 7a).
- **Evidence:** je Probe `{probeId, attempted, denied, observationKind, observationCode}`; Runner-Typ; Image-Digest; Acceptance-/Mutanten-Report; Review; Attestation; `A_B`.
- **PASS:** alle Probes `denied=true` mit Messung; B1–B5 KILLED; approve.
- **FAIL:** Probe nicht auswertbar → EXECUTION_SANDBOX, kein PASS.
- **STOP:** ein Zugriff gelingt; keine Docker-fähige Fläche („ohne Docker ist B nicht abnahmefähig“) (S-P2-02).
- **Recovery:** B-Fix im selben Run oder neue B-Revision; C bleibt gesperrt.

**P2-Gate:** `A_B` auf `main`, Evidence signiert.

---

### P3 — C Registration / Implementation (keine Abnahme in dieser Phase)

Quellen: REC P2.3, Blocker 2/3/4/8d, F09; ABCR C; PM §2; FBR §7/§8.

#### P3.1 C-Revision mit echtem `acceptedCommit` B
- **Actor:** Contract-Autor → externer Reviewer (≠ Autor)
- **Preconditions:** P2-Gate.
- **Exact action:** 0001C Revision mit `acceptedCommit = A_B`, aktuellem `baseCommit`, erhöhter Version; muss enthalten: Receipt-Feld `reviewSnapshotDigest` + Mutant C5 (D2); Review-Schema nach D3; AV-170/172/173 nach F09; Drill-PASS-Liste 8d; Workflow `.github/workflows/forge-v01.yml` nur `pull_request_target`, `permissions: {}`, kein Checkout/Cache/HEAD-Step, `forge-verify` mit `always()` und explizit rotem Pfad; Drill-Fixture `src/forge-drill/clamp-at-zero.ts` in der **if-Form** und `tests/forge-v01/clamp-at-zero.test.ts` mit den drei Tests aus PM §2.
- **Evidence:** Contract, Hash, Review.
- **PASS:** approve; alle Punkte vorhanden.
- **STOP:** anderer Trigger; Checks-Publisher oder Admin-Token; Clamp-BASE nicht in if-Form (S-P3-01).
- **Recovery:** Revision.

#### P3.2 Registrierung C
- wie P1.4; Ergebnis `M_C`.

#### P3.3 Implementierung C und Offline-Nachweise (PR bleibt offen)
- **Actor:** Codex (Implementierung); Code-Reviewer (Offline-Nachweise)
- **Preconditions:** P3.2.
- **Exact action:** Implementierung C im Scope; Produktions-Image-Rezept + Digest (EI-19) zur Owner-Review; Offline-Isolationsnachweis mit exakt den Workflow-Parametern gegen ein feindliches Test-Repo (Netz, Env, Token, Schreibzugriff auf Verifier-Ausgaben, Prozess-Escape) (FBR §8 Zeile B, Repair 7c); Acceptance C; Mutanten C1–C5; Code-Review.
- **Expected state:** offener C-PR mit eingefrorenem Head `H_C`; **kein Merge in P3**.
- **Evidence:** `H_C`, Image-Digest, Offline-Isolationsreport, Acceptance-/Mutanten-Report, Review-Bytes.
- **PASS:** alle Offline-Nachweise grün, approve.
- **FAIL:** Fix im selben Run.
- **STOP:** Push nach Head-Freeze ohne neues Review; Workflow-Abweichung (S-P3-02).
- **Recovery:** neuer Head → neues Review.

**P3-Gate:** `H_C` eingefroren, Offline-Nachweise signiert, Image-Digest owner-reviewed.

---

### P4 — Execution-Isolation Live Validation

Quellen: EI (Report „Remaining live validation required“ 1–11, EI-01…EI-20), REC Blocker 7, FBR §8. **Kein Punkt dieses Abschnitts ist bestanden.** Die Checkliste steht in `FORGE-V0.1-ACTIVATION-CHECKLIST.md` §P4 und als Formular im Evidence Sheet §E.

#### P4.1 Testfläche aufsetzen
- **Actor:** Seb · **Identity:** Owner-Token nur für die Testfläche
- **Preconditions:** P3-Gate.
- **Exact action:** frisches öffentliches Repo `Forge-Dice/forge-ei-live-<datum>`; keine Secrets/Variables/Environments; Actions aus; AEP exakt §5.3 (Akteure ggf. Owner + Codex-Labtoken); `main` = exakte Bytes aus `H_C` für `tools/forge_v01/**`, `forge/verifier/**`, `.github/workflows/forge-v01.yml` + gepinnter Image-Digest; Actions an.
- **Expected state:** Testfläche spiegelt `H_C` byte-gleich.
- **Evidence:** Repo-ID, Tree-Vergleich gegen `H_C`, AEP-Readback, Image-Digest.
- **STOP:** jede Abweichung von `H_C`; Schreibzugriff auf `Forge-Dice/Forge` (S-P4-01).

#### P4.2 Feindliche Probe-PRs (eine Kategorie pro PR)
- **Actor:** Seb (Probe-Inhalte, harmlos, nur Canaries) · **Identity:** Owner bzw. Lab-Codex-Token
- **Exact action:** je Kategorie ein PR, dessen untrusted Code in Stage 2 ausgeführt wird; Kategorien und Einzelprüfungen = Checkliste §P4 (I-1 … I-8). Nach jedem Lauf Logs, Worker-Report und Supervisor-Evidence sichern; PR schließen.
- **Expected state:** jede Probe `attempted=true`, `denied=true` mit Messung; `forge-verify` rot mit erwartetem Code; Stage 1 führt keinen PR-Byte aus.
- **Evidence:** Evidence Sheet §E je Prüfpunkt.
- **PASS:** jeder EI-Prüfpunkt hat eine gemessene Denial oder eine belegte Grenzdurchsetzung; keine Probe entkommt.
- **FAIL:** Probe nicht auswertbar → INCONCLUSIVE, wiederholen.
- **STOP:** Netzwerk erreichbar, Credential/Token sichtbar, Schreibzugriff außerhalb Scratch, überlebender Prozess, Grenzwert nicht durchgesetzt, Stage1→Stage2-Kanal, Evidence fälschbar (S-P4-02).
- **Recovery:** HALT auf der Testfläche; Befund an C (oder B) als Revision → zurück zu P3 (bzw. P2); kanonisch passiert nichts.

#### P4.3 Owner-Abnahme der Isolation
- **Actor:** Seb · **Exact action:** Evidence Sheet §E vollständig prüfen und signieren; Testfläche archivieren (nicht löschen).
- **PASS:** EI-01…EI-20 vollständig belegt. **Erst dann P5.**

---

### P5 — Workflow / Ruleset Activation (kanonisch)

Quellen: FBR §7.2 (Schritte 2–4), REC P2.3, DRILL §3 P6/P7, EXP §11/§12, PM B7.

#### P5.1 Vor-Aktivierungsprüfung
- **Actor:** Seb · **Exact action:** `main` lesen (= letzter Ledger-Eintrag); offene PRs listen (nur C-PR; keine Codex-/Fremd-PRs, FBR AD-7); PR #2 geschlossen; AEP und sechs Rulesets erneut lesen (== P0); Datum gegen 2026-11-02 prüfen (OI-9).
- **PASS:** alles unverändert. **STOP:** fremder offener PR oder Abweichung (S-P5-01). **Recovery:** Ursache klären; fremde PRs schließen lassen; erneut prüfen.

#### P5.2 Abnahme und Merge von C (Inbetriebnahme)
- **Actor:** externer Reviewer, Seb · **Preconditions:** P4.3, P5.1.
- **Exact action:** Owner-Attestation für `H_C`; Merge §7 Nr. 6 → `A_C`. Ab jetzt läuft `forge-v01.yml` aus `main` für jedes `pull_request_target`-Ereignis.
- **Expected state:** Workflow-Blob auf `main` byte-gleich mit reviewtem `H_C`.
- **Evidence:** `A_C`, Blob-Vergleich, Ledger.
- **STOP:** Blob-Abweichung; Merge eines anderen Heads (S-P5-02). **Recovery:** HALT H-1/H-2/H-3; Revert-PR §6.2 (ohne R2-Fenster, R2 existiert noch nicht).

#### P5.3 Smoke- und Bind-PR (Owner-Ops)
- **Actor:** Seb; externer Reviewer · **Identity:** Owner
- **Preconditions:** P5.2; FORGE-DRILL-0001 (und -0002) Contract + Plan reviewt (OI-6).
- **Exact action:** PR `forge/owner/checks-smoke` mit Ledger-Update, S1-Evidence und Publikation der Drill-Contracts/-Pläne + Task-Index (REC P2.3: „Drill-Contract + Plan vor R2 auf BASE publiziert“). Attempt 1 abwarten: `forge-gate` success, `forge-verify` rot `REVIEW_MISSING`. Externes Review + Owner-Attestation (COMMENTED, `commit_id=H`, Ziel-Attempt 2). Owner **Re-run all jobs**.
- **Expected state:** Attempt 2: beide Jobs frisch ausgeführt und `success`; `triggering_actor.id = 315180734`; Receipt mit `runId`, `runAttempt=2`, B, H, Contract-/Policy-Hash, `verifierSha`, `reviewSnapshotDigest`.
- **Evidence:** Check-Runs je Name: `app.id`, `app.slug`, `head_sha == H`, `check_suite.id`, PR-Zuordnung; Jobs des Attempts vollständig; Receipt; Attestation-ID.
- **PASS:** genau zwei Check-Namen, am PR-Head, aus der trusted Suite, success.
- **FAIL:** Attempt-2-Fehler mit Code → nach Matrix.
- **STOP:** Checks hängen nicht am PR-Head oder an falscher Suite/App (`NATIVE_HEAD_CHECK_BINDING_NOT_PROVEN`); Job aus anderem Workflow (S-P5-03).
- **Recovery:** HALT; kein R2; NO-GO bis Klärung im Lab (kein Custom-Check-Publisher, keine Any-Source-Pins).

#### P5.4 Kanonischer Isolations-Probe-PR
- **Actor:** Seb · **Exact action:** PR `forge/owner/isolation-probe` mit Owner-Probe-Inhalt (FBR §8 Zeile C); Lauf beobachten; PR schließen, Branch behalten.
- **Expected state:** jede Probe scheitert, `forge-verify` rot mit erwartetem Code.
- **PASS:** Run erreicht nachweislich Stage 2 und alle Probes gemessen denied.
- **INCONCLUSIVE:** Gate weist vor Stage 2 ab (OI-3) → in E5 festhalten; P4-Evidence trägt.
- **STOP:** eine Probe entkommt (S-P5-04). **Recovery:** HALT; C-Revision; zurück zu P3.

#### P5.5 Native Check-Bindung (`bind-checks`)
- **Actor:** Seb · **Exact action:** aus P5.3 die numerische `app.id` beider Check-Runs lesen; prüfen: identisch für beide, = GitHub-Actions-App, `head_sha == H`, keine Duplikate/Matrixsuffixe; R2-JSON §5.2 mit dieser Ganzzahl rendern.
- **Evidence:** Check-Run-JSON, gerendertes R2-JSON + SHA-256.
- **STOP:** Bindung nicht eindeutig (S-P5-03).

#### P5.6 R2 anlegen (zuletzt) und Vollreadback
- **Actor:** Seb · **Exact action:** `POST …/rulesets` mit gerendertem R2; Readback aller sieben Rulesets + AEP; `GET …/rules/branches/main`; Coverage-Abgleich (keine `~ALL`-Writer-Ausnahme, keine R6-Exclude-Lücke).
- **Expected state:** sieben aktive Rulesets, Sollwerte §5 exakt; `deploymentDigest` + `checkedAt` notiert.
- **PASS:** Readback == §5. **STOP:** Abweichung, Platzhalter gesendet, Any-Source (S-P5-05). **Recovery:** Feld exakt korrigieren unter HALT; nie R2 abschwächen.

#### P5.7 Smoke-PR unter R2 mergen (positiver Pfad)
- **Actor:** Seb · **Exact action:** prüfen, dass P5.3-Checks am aktuellen Head und up-to-date sind (sonst neuer Attempt mit neuer Attestation); Merge §7 Nr. 6.
- **Expected state:** terminal merged; `M.parents == [B, H]`; Ledger.
- **PASS:** Merge unter aktivem R2 mit grünen nativen Checks und protokollierter R3-Autorisierung.
- **STOP:** Merge gelingt ohne grüne Checks oder mit anderer Methode (S-P5-06). **Recovery:** HALT; Incident.

PD-4-Negativfälle (Merge bei fehlendem/rotem/fremdem/veraltetem Check) werden **nicht** auf dem kanonischen `main` erzwungen; sie sind im Lab (P0.4) belegt und kanonisch durch D2–D9 (rot, nie gemergt) abgedeckt (DRILL §2, PM §7, FBR §10).

**P5-Gate:** sieben Rulesets + AEP aktiv und gelesen; Smoke gemergt; Bindung belegt; P4-Abnahme signiert; P5.4 PASS oder als INCONCLUSIVE dokumentiert.

---

### P6 — ClampAtZero Drill (erster gemanagter Run)

Quellen: PM §1–§11, REC Repair 8c/8d, P3.1/P3.2. Das Evidence Sheet §F/§G enthält die ausfüllbaren Formulare.

#### P6.0 Preflight
- **Actor:** Seb · **Exact action:** PM §11.1 vollständig abhaken; PM-Blocker: B0 (A/B/C akzeptiert, Plattform aktiv) durch P1–P5; B1 Draft-Gate als rote Safety-Probe im Drill-Contract festgelegt; B2 durch R2 merge-only; B3 durch D4/8c; B4 Primär-Code-Priorität in akzeptiertem C/Paket eingefroren; B5/B6 Lesequittung + Hpre-Konvention im Drill-Contract festgelegt; B7 durch P0.4 + P5.3/P5.5; D2-Pfadfrage entschieden (echter ungeschützter Nicht-Mystery-Sourcepfad oder D2 als Layer-Probe ausdrücklich akzeptiert).
- **STOP:** ein Punkt offen (S-P6-01). Keine Improvisation während Live.

#### P6.1 D1 — legitimer Run (FORGE-DRILL-0001)
- **Actor:** Codex (Developer), Claude (externer Reviewer), Seb (Attestation, Merge)
- **Exact action (PM §1 Schritte 2–12):** Handoff → Lesequittung R (leerer Commit, `R.tree == B.tree`) → Run-Branch `forge/run/codex/FORGE-DRILL-0001/d1-01` → Draft-PR mit Hpre (if-Block-Form) → Draft-Gate `PR_STATE`, `forge-verify` explizit rot → H mit exakt `return n < 0 ? 0 : n;` → ready_for_review → W Attempt 1: Gate success, Tests/Inventar/m-negative KILLED, `forge-verify` rot `REVIEW_MISSING` → Head-Freeze → externer Anthropic-Report gebunden an {repoId, pr, B, H, C, V, P} → Owner-Attestation für Attempt a+1 → Re-run all jobs → beide success, zwei stabile Final-Snapshots ≤ 10 s → Premerge-Readback → Merge §7 Nr. 6.
- **Drill-PASS (REC 8d, genau):** (1) Attempt 1 `forge-verify` rot wegen `REVIEW_MISSING`; (2) Mutant m-negative KILLED; (3) Equivalent-Mutant-Negativfixture ergibt `MUTANT_SURVIVED` (D8); (4) nach Owner-COMMENT und Re-run all jobs `forge-verify` exit 0 mit `policyAssurance=owner_attested`. Ein Drill-PASS ist kein Nachweis der Ruleset-/Bypass-/AEP-Wirksamkeit; diese belegt ausschließlich P0.4.
- **STOP:** PM-STOP-Bedingungen; Verifier grün ohne Attestation (S-P6-02).

#### P6.2 D2–D9 — adversariale Runs (FORGE-DRILL-0002)
- **Actor:** Codex, Seb · **Exact action:** je ein eigener Run/PR von frischem `main`, genau eine verletzte Invariante (PM §3), nie gemergt; nach Evidence schließen, Branch behalten.

| Fall | Eingriff | Erwartete Schicht / Code (PM §3) |
|---|---|---|
| D2 | genau eine weitere ungeschützte .ts-Source außerhalb Scope | Stage 1 `SCOPE_PATH`; Stage 2 Dependency-Failure ohne Worker |
| D3 | Clamp-Testdatei löschen | Stage 1 `SCOPE_PATH`; Inventar-Layerprobe `TEST_INVENTORY` |
| D4 | `it` → `it.skip` im trusted Test | Full funnel `SCOPE_PATH`; Freeze-Probe `SCOPE_PROTECTED`; Inventarprobe `TEST_STATUS` |
| D5 | neue `vitest.config.mjs` mit `include=[]` | `SCOPE_PATH`; Schutzklassifikation `SCOPE_PROTECTED`; Config nie geladen |
| D6 | `.github/workflows/evil.yml` (harmloser push-Sentinel) | `SCOPE_PATH`/`SCOPE_PROTECTED`; AEP blockt evil vor Jobstart (null Jobs) |
| D7 | `notes.txt` | `SCOPE_PATH`; keine Prefix-/Coordination-Ausnahme |
| D8 | separate Negativ-Fixture: Equivalent-Audit-Mutant | Stage 1 success, BASE/HEAD success, `MUTANT_SURVIVED` |
| D9 | H1 attestiert, Codex pusht H2 (Whitespace) | `REVIEW_BINDING` bei stabilem H2; Race separat `PR_STALE`; Merge-Request `sha=H1` lehnt ab |

- **PASS:** jeder Fall mit positiver Kontrolle, erwartetem Code und belegter Schicht, Refs unverändert, PR geschlossen.
- **STOP:** unerwartete Annahme; evil-Job startet (globaler STOP) (S-P6-03).

#### P6.3 Drill-Exit
- **Actor:** Seb · **Exact action:** PM §9 Pflichtklassen konjunktiv prüfen, mit Wortlaut 8c für „Bypass“: „Kein Bypass von R1/R2/R6/R7/AEP/Scope; die geplante R3-PR-only-Owner-Autorisierung wird benutzt, pro Merge protokolliert (merge_method=merge, bypass_rules=true) und ist kein STOP.“
- **PASS:** jede Pflichtklasse belegt. **STOP:** eine Klasse FAIL/UNKNOWN/INCONCLUSIVE/NOT EXECUTED (S-P6-04).

---

### P7 — BOOTSTRAPPED Declaration

Siehe §10 für die exakten Belege. Ablauf:

#### P7.1 Exit-Prüfung
- **Actor:** Seb; unabhängiger Prüfer (nicht Codex, nicht Autor eines geprüften Contracts) · **Exact action:** E1–E9 gegen Evidence prüfen; Ledger gegen `git log --first-parent 3d7545d..main` zeilengenau; Audit-Log-Auszug.
- **STOP:** ein E-Kriterium offen (S-P7-01).

#### P7.2 Exit-Protokoll auf `main`
- **Actor:** Seb · **Exact action:** Owner-Ops-PR `forge/owner/bootstrapped` mit `forge/ops/BOOTSTRAPPED.md` (E1–E9 mit Links/Hashes, Ledger, Drill-Evidence-Index) — läuft durch beide Required Checks, Attestation, Re-run all jobs, Merge §7 Nr. 6.
- **Expected state:** Merge-Commit `M_BS`; ab hier und erst ab hier darf „FORGE V0.1 BOOTSTRAPPED“ gesagt werden.
- **Danach (nicht Teil dieses Runbooks):** CORE-0002 nach REC P4.0 / D7 (einmaliges CORE-Profil per Owner-PR, CORE-0002 einziger Format-2-Strang).

---

## 9. CORE-0002-Sperre bis BOOTSTRAPPED

Bis `M_BS` auf `main` liegt, gilt (D1, D7, REC A.6):
- kein Contract-PR, kein Registrierungs-Merge und kein Task-Index-Eintrag für FORGE-CORE-0002;
- kein Ref unter `forge/run/codex/FORGE-CORE-0002/**`;
- kein Format-2-Contract auf `main`; „new tasks use Format 2“ gilt erst ab BASE = BOOTSTRAPPED;
- keine Änderung an `src/forge/contract-document.ts` oder `src/forge/primitives.ts` (die A/B/C als BASE-Parser pinnen);
- Mystery-Registrierung wartet (MYST-0001 ist Format 2 und braucht CORE-0002).

Ein Verstoß ist STOP S-X-01 (Matrix): PR schließen, Ref erhalten, Incident-Notiz; gemergt → Revert-PR §6.2.

---

## 10. BOOTSTRAPPED — exakte Belege (alle gleichzeitig)

| E | Kriterium | Beleg (Evidence Sheet §H) |
|---|---|---|
| E1 | Sieben Rulesets + AEP aktiv, Readback == §5 (Bypass-Sollwert, R2 merge-only, integer `integration_id`); Lab-Drill P0.4 PASS; kanonische Proben P0.8/P0.9 PASS | `forge/ops/RULESETS.md`, `S1-RESULT.md`, Readback-JSON mit `checkedAt` |
| E2 | Genau ein Owner-Bootstrap-PR (P0.11) gemergt, Merge Commit, Owner-Merger | Ledger Zeile 1 |
| E3 | 0001A/B/C: je Registrierungs-Merge und Abnahme-Merge mit Architektur- und Code-Review (Reviewer ≠ Autor), Owner-Attestation, echte `acceptedCommit`-Kette A_A → A_B → A_C; Mutanten A1–A5/B1–B5/C1–C5 KILLED nach Regel; Goldens gegen r2 grün | Ledger + Reports |
| E4 | Format 1 ist einziges registriertes Contractformat; kein Format-2-Contract, kein CORE-0002-Artefakt auf `main` (§9) | Tree-Listing `main`, Task-Index |
| E5 | Aktivierung komplett: P4-Isolationsabnahme signiert (EI-01…EI-20); S1 negativ (P0.8) und positiv (P5.3); Smoke unter R2 gemergt (P5.7); `bind-checks` belegt; P5.4 PASS oder als INCONCLUSIVE dokumentiert (OI-3) | Evidence §E/§D |
| E6 | `git log --first-parent 3d7545d..main` == Ledger zeilengenau; Audit-Log ohne unerklärte Ruleset-Änderung, ohne Push auf `main`, ohne Merge eines Nicht-Owners | Ledger + Audit-Auszug |
| E7 | D1 über den vollen Prozess gemergt; Drill-PASS-Liste 8d vollständig; `M.parents == [B, H]`, `M.tree == H.tree` | PR-Link, `forge/ops/DRILL-0001.md` |
| E8 | D2–D9 je rot mit erwartetem Code/Schicht, alle geschlossen, Branches erhalten | `forge/ops/DRILL-0001.md` |
| E9 | Kein offener STOP, kein offener Incident, kein offenes Break-Glass-Fenster; R3-Bypass vorhanden (nicht eingefroren) mit Notiz; R2-Checks eingetragen; PR #2 geschlossen, nicht gemergt; Deployment-Readback ≤ 30 min alt bei Erklärung | Readback + Notiz |

Zusätzlich: PM §9 alle Pflichtklassen PASS (mit 8c-Wortlaut) und PM §10 P1–P3 erfüllt. „BOOTSTRAPPED“ heißt nicht „V0.1 fertig“.

---

## 11. Was dieses Runbook ausdrücklich nicht tut

- Es ändert keine GitHub-Settings, aktiviert keine Workflows, legt keine Rulesets an, öffnet keine PRs und merged nichts.
- Es repariert keine Contracts (AB-15 bleibt Eingangs-STOP) und erzeugt kein Paket r2.
- Es markiert keinen Isolations-, Plattform- oder Drill-Prüfpunkt als bestanden.
- Es führt keine neue Owner-Ausnahme, kein Halt-Ruleset, keine Halt-Variable und keinen zusätzlichen Check-Publisher ein.
- Es behauptet keine atomare Review-/Settings-/Merge-Garantie: nach einem grünen Lauf kann ein Review widerrufen werden, ohne dass der Check automatisch rot wird; der Owner prüft unmittelbar vor dem Merge (PM §6 „Grenze des minimalen Designs“).

STOP.
