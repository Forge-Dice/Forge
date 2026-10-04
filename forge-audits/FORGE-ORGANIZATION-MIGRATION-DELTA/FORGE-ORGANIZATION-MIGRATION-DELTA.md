# FORGE ORGANIZATION MIGRATION DELTA

| | |
|---|---|
| Datum | 2026-10-03 |
| Rolle | Read-only Reconcile (keine Implementierung, keine Commits, keine PRs, keine Einstellungen geändert) |
| Kanonisches Repo | `Forge-Dice/Forge` (vorher `Wuerfelduell/Forge`, dort bleibt es historische Provenienz) |
| Abgeglichen gegen | `FORGE-IDENTITY-GITHUB-PROTECTION.md` (IGP), `FORGE-INDEPENDENT-VERIFIER-DESIGN.md` (VD), `FORGE-V0.1-HARDENING-PLAN.md` (HP), `FORGE-V0.1-MINIMUM-PRODUCT.md` (MP). Diese Berichte werden **nicht** umgeschrieben; dieses Dokument ist ein Delta darauf. |
| GitHub-Doku | `github/docs` @ `2bd66de` (Commit vom 2026-10-02), Quelldateien gelesen, nicht docs.github.com |

**Belegkennzeichen:** `GIT` = selbst per `git clone`/`ls-remote` geprüft · `API` = GitHub-API über die Session · `DOKU` = github/docs-Quelltext · `OWNER` = Angabe von Seb, von hier nicht prüfbar · `UNVERIFIZIERT` = weder Doku noch Messung · `INFERENZ` = Schluss aus Belegen.

**Kurzantwort:** Die Empfehlung ändert sich **nicht grundlegend**. Owner ohne Bypass, `forge-codex` als einziger Developer, Actions als Verifier, SHA-gebundene externe Reviews bleiben. Es ändern sich fünf Stellen: Teams ersetzen den unsicheren Nutzer-Bypass, Fine-grained PATs werden möglich, Merge Commit ersetzt Squash im Härtungsplan, `FORGE_HALT` als Repo-Variable ist unter Write-Rolle nicht mehr owner-exklusiv, und die beiden Verifier-Fallbacks (Push-Rules, „Require workflows“) entfallen auf einem Free-Plan ersatzlos. Damit wird die Actions-Policy (Spike S1) zur harten Vorbedingung ohne Ausweichweg.

---

## 1. Facts confirmed

| # | Fakt | Beleg |
|---|---|---|
| F1 | `Forge-Dice/Forge` ist öffentlich lesbar (anonymer Clone über den Git-Proxy funktioniert). | GIT |
| F2 | `main` = **`3d7545d843883418348004e68717399a64da7a7d`**, Parents `f5dbc73` (alte leere `main`) und `0dfd903` (PR-Head). Committer `GitHub`, Commit trägt eine GitHub-Signatur (`gpgsig`). | GIT |
| F3 | PR #1 „Initial project baseline…“ ist **merged** (2026-10-03 08:15:41Z, `merged_by: Wuerfelduell`), Head `codex/forge-core-v2-repair` @ `0dfd903`, Base `main` @ `f5dbc73`, 31 Commits, 70 Dateien, +14.343. Merge-Methode: Merge Commit. | API, GIT |
| F4 | **Tree(`3d7545d`) == Tree(`0dfd903`)**: Mit aktuellem Head liefert ein Merge Commit exakt den geprüften Tree, und der geprüfte Head ist zweiter Parent. Das ist der Nachweis für die Merge-Commit-Entscheidung am realen Objekt. | GIT |
| F5 | Alle Branches erhalten, SHAs identisch zum alten Repo: `main` 3d7545d, `claude/forge-architecture-review-hjdq89` be40a68, `codex/forge-core-v2-repair` 0dfd903, `codex/mystery-task-0005` fab792a, `codex/task-0004-contract` 6a8c0c5. Einziger PR-Ref: `refs/pull/1/head`. | GIT |
| F6 | Der alte Name leitet um: `git ls-remote https://github.com/Wuerfelduell/Forge` liefert dieselben Refs; die GitHub-API löst `Wuerfelduell/Forge` auf `Forge-Dice/Forge` auf. Die **Repository-ID bleibt `1401864629`** (VD-Evidence-Feld `repository.id` gilt unverändert, nur `fullName` ändert sich). | GIT, API |
| F7 | Auf `main` gibt es **kein `.github/`**, keine Workflows, kein CODEOWNERS. `forge/coordination/{CLAUDE,CODEX}.md` liegen in `main` (HP-OD-4 ist faktisch entschieden: Koordinationsdateien sind in der Baseline). | GIT |
| F8 | Die GitHub-Verbindung dieser Claude-Session authentifiziert als **`Wuerfelduell`** (`get_me`). Jede Schreibaktion von Claude über diesen Connector wäre für GitHub eine Owner-Aktion. | API |
| F9 | Collaborators, Rulesets, Actions-Einstellungen, Org-Plan und Org-Einstellungen sind von hier **nicht lesbar** (403 „Resource not accessible by integration“ bzw. Proxy-Sperre). Rollen von `forge-codex`, Org-Plan und Repo-Settings sind daher `OWNER`. | API |
| F10 | `forge-codex` = Org-Member, Repo Write, kein Admin; `Wuerfelduell` = Org Owner, Repo Admin; ChatGPT hat Verbindungen zu beiden Konten. | OWNER |

## 2. Previous assumptions invalidated

| Bisherige Annahme | Quelle | Status jetzt |
|---|---|---|
| „Ein persönliches Konto kennt nur Owner und Collaborator mit Schreibrecht“ | IGP §Kurzantwort Pkt. 3, §3.2, §13 Pkt. 4 | **Entfällt.** Org-Repos haben Read / Triage / Write / Maintain / Admin (DOKU `repository-roles.yml`). Custom Roles nur Enterprise Cloud (DOKU). |
| „Fine-grained PATs fallen aus“ | IGP §3.4, §13 Pkt. 11; HP OD-1 | **Entfällt** für Org-Member. Nicht unterstützt bleibt nur der Fall „outside or repository collaborator“ (DOKU). |
| Branch-Hoheit je Agent hängt am Nutzer-Bypass (nur per Changelog 2026-05-07 belegt) | IGP §7, §13 Pkt. 12 | **Entfällt als Risiko.** Die aktuelle Doku listet für github.com als Bypass-Akteure Repo-Admins/Org-Owner, Rollen Write/Maintain, **Teams (nicht secret)**, GitHub Apps, Dependabot; einzelne Nutzer stehen dort **nicht** (DOKU `rulesets-bypass-step.md`). Teams lösen das sauber. |
| „Kein Audit Log, nur 90-Tage-Security-Log des Kontos“ | IGP §3.7, §13 Pkt. 7 | **Entfällt.** Org-Audit-Log, 180 Tage, nur Owner sehen es, inkl. REST-Endpunkt (DOKU). Umfang auf Free nicht separat ausgewiesen: UNVERIFIZIERT. |
| „GITHUB_TOKEN-Defaults gelten pro Repo“ | IGP §3.6, VD §Begleitkonfiguration | **Ändert sich:** Defaults werden von der Org geerbt; ein restriktiverer Org-Wert sperrt die permissive Option im Repo (DOKU). Wie der transferierte Repo-Wert jetzt steht: UNVERIFIZIERT. |
| VD-Fallback 2: Push-Rule „Restrict file paths `.github/**`“ | VD §2.4 | **Entfällt ersatzlos.** Push-Rulesets gibt es auf github.com nur im Team-Plan für **private/internal** Repos (DOKU `repo-rules.md`). Ein öffentliches Repo bekommt sie in keinem Plan. |
| VD-Fallback 3: „In eine kostenlose Organisation umziehen, dann Org-Rulesets mit Require workflows“ | VD §2.4, §1 | **War falsch für Free.** Org-Rulesets (und damit Ruleset-Workflows) gibt es nur für Team oder Enterprise (DOKU `creating-rulesets-for-repositories-in-your-organization.md`). |
| `FORGE_HALT` als Repository-Variable ist ein Owner-Schalter | MP §Kill, VD AC-38 und Workflow-Zeile 562, IGP §9 Pkt. 7 | **Gilt nicht mehr.** Write darf Actions-Variablen und -Secrets im Repo anlegen, ändern, löschen (DOKU, Zeilen mit `repo-ci-cd-admin`, auf github.com aktiv). Eine Org-Variable hilft nicht, weil eine gleichnamige Repo-Variable sie überschreibt (DOKU `variables.md`). |
| VD C1 „Es existieren keine Repo-Secrets“ als vom Owner garantierte Vorbedingung | VD §2.3 C1 | **Nur noch Beobachtung, keine Garantie:** Write kann Secrets anlegen. Unschädlich, solange kein Workflow sie referenziert und C7 (Policy) Developer-Workflows verhindert (INFERENZ). |
| `main` ist leer, Baseline offen | HP Grundlage, VD §Geprüfter Stand, MP | **Überholt:** Baseline ist in `main` (F2–F4). |
| Squash-only, lineare Historie | HP D-2, HP §8 Checkliste, VD C8 „lineare Historie“, VD S10 „nach Squash-Merge“, VD Grenze 11 | **Durch Owner-Entscheidung überholt:** Merge Commit (siehe §5, §6). IGP hatte bereits Merge-Commit-only empfohlen und bleibt hier gültig. |

**Unverändert gültig** (nicht durch die Org aufgehoben): eine kostenlose Machine-Account-Regel (ToS), keine Metadaten-Regeln (Enterprise), keine Push-Rules (öffentliches Repo), kein „Require workflows“ auf Free, Approvals zählen nur von Write+, ein Developer braucht mindestens Write zum Pushen, der Repo-Inhalt ist weltweit lesbar.

## 3. Identity model changes

| Akteur | Bisher (IGP) | Jetzt | Änderung |
|---|---|---|---|
| Seb | Owner + einziger Collaborator von `Wuerfelduell/Forge` | Org Owner `Forge-Dice` + Repo Admin; kein Bypass-Eintrag | Gleiches Prinzip. Neu: Org Owner hat implizit Admin auf jedem Org-Repo und verwaltet Teams, PAT- und App-Policies, Org-Audit-Log. |
| Codex | sollte `forge-codex` als Collaborator werden | `forge-codex` = Org Member, Repo Write | Umgesetzt (OWNER). **Bis zum Spike-PASS nicht verifiziert**, dass Codex wirklich als `forge-codex` pusht und nicht über die ebenfalls verbundene `Wuerfelduell`-Verbindung. |
| Claude | Stufe A (Adapter) oder B (`forge-claude`, kostenpflichtig) | Stufe A gesetzt durch Sebs Trust Boundary; Namespace `forge/run/claude/**` erst mit eigener Identität | Klarstellung: Claudes heutige GitHub-Verbindung ist `Wuerfelduell` (F8). Claude darf in V0.1 auf `Forge-Dice/Forge` **nichts schreiben**; jede Schreibaktion wäre eine Owner-Aktion. |
| ChatGPT / Grok | Adapter, Seb attestiert | unverändert | ChatGPT hält jetzt eine Admin-Verbindung (`Wuerfelduell`). Das ist ein Fehlbedienungsrisiko, kein Modellwechsel (§9 B4). |
| Actions | unabhängiger Verifier | unverändert | Repo-ID `1401864629` unverändert (F6). |

`forge/policy.json` (HP P-02) muss `repo: "Forge-Dice/Forge"` tragen und zusätzlich die numerische Repo-ID pinnen, weil der alte Name weiter umleitet, solange niemand unter `Wuerfelduell/Forge` neu anlegt (DOKU `transferring-a-repository.md`). Refs nur per `ls-remote` gegen den **neuen** Namen (HP D-6). Logins vergleicht P-02 bereits case-insensitiv.

## 4. Permission model changes

**Frage 2, feinere Rollen:** Verfügbar sind Read, Triage, Write, Maintain, Admin. Für Forge relevant:

| Rolle | Kann (DOKU) | Für Forge |
|---|---|---|
| Read | Reviews abgeben, **aber nicht** approven oder „request changes“ mit Wirkung | nutzlos für zählende Reviews |
| Triage | PRs schließen/öffnen/zuweisen, Reviews anfordern; nicht pushen, nicht approven | kein Developer möglich |
| Write | pushen, mergen, approven, Code Owner sein, Statuses setzen, Workflows starten/abbrechen/neu starten, **Actions-Secrets und -Variablen verwalten**, fremde Kommentare editieren/löschen, Reviews verwerfen | Minimum für einen Developer |
| Maintain | zusätzlich Merge-Methoden konfigurieren | **niemandem außer Seb** geben (könnte Squash/Rebase wieder einschalten) |
| Admin | Rulesets, Settings, Collaborators | nur Seb |

**Frage 4, Developer-Rechte stärker reduzieren:** Über die **Rolle nicht**: Write ist die kleinste Rolle mit Push, Custom Roles gibt es nur auf Enterprise Cloud. Reduzieren lässt sich auf vier anderen Ebenen:

1. **Ruleset-Ebene:** Developer darf nur in `forge/run/codex/**` schreiben (Team-Bypass, §5), Reviews verwerfen nur Seb (Ruleset-Option „restrict who can dismiss“, DOKU; Verfügbarkeit in der UI des Free-Org-Repos: UNVERIFIZIERT).
2. **Actions-Policy-Ebene:** Actor-Regeln können jetzt nach **Repository-Rolle** filtern (DOKU `control-workflow-execution.md`): Write darf keine Workflows auslösen außer dem Verifier über `pull_request_target`. Das schließt Workflow-Start, -Neustart-Missbrauch und Developer-Workflows aus.
3. **Token-Ebene:** Ein Fine-grained PAT oder ein App-User-Token wirkt nur mit der **Schnittmenge** aus Token-Permissions und Rolle. Für `forge-codex` reicht Contents RW, Pull requests RW, Metadata R; ohne Workflows, Actions, Secrets, Variables, Administration.
4. **Org-Ebene:** Base Permission „No permission“ (Default für Org-Member ist Read auf öffentliche Repos, DOKU), Repo-Erstellung für Member aus, 2FA-Pflicht (DOKU, auf github.com verfügbar), App-Installationen nur durch Owner.

Punkt 3 greift für **Codex Cloud nur, wenn der ChatGPT-Codex-Connector selbst schmale Permissions hat**; welche er auf `Forge-Dice` angefordert hat, sieht Seb als Org Owner unter den installierten GitHub Apps. UNVERIFIZIERT.

**Frage 3, Fine-grained PATs:** Jetzt sinnvoll, aber nur für **lokale oder CLI-Läufe** von `forge-codex` (Resource Owner `Forge-Dice`, nur Repo `Forge`, Permissions wie oben, Ablauf ≤ 90 Tage). Org-Policies (DOKU, auf github.com verfügbar): Fine-grained-Tokens nur mit Owner-Genehmigung (das ist der Default), **Classic PATs für die Org sperren**, maximale Laufzeit setzen. IGP §12 Pkt. 9 („Classic PAT auf dem Machine Account“) ist damit ersetzt. Solange beide Agenten in der Cloud laufen, wird **kein** PAT angelegt.

## 5. Ruleset changes

Basis bleibt IGP §6–§8. Änderungen:

| Ruleset | Änderung | Grund |
|---|---|---|
| `forge-main` | Allowed merge methods **nur Merge Commit**; „Require linear history“ **aus** (wäre mit Merge Commits unvereinbar); zusätzlich **„Restrict who can dismiss reviews“ → nur Seb**. Rest wie IGP (PR, 1 Approval, Code Owners, Approval des letzten Pushes, Stale-Dismissal, strict Required Check `forge-verify` mit Quelle GitHub Actions, keine Bypass-Liste). | Merge-Entscheidung; Write kann sonst Reviews verwerfen |
| `forge-all-branches` | unverändert; schützt auch die fünf historischen Branches vor Löschen/Force-Push | Provenienz (F5) |
| `forge-run-codex` | Bypass **Team `forge-dev-codex`** (nur `forge-codex`) statt User-Bypass | Teams sind dokumentierte Bypass-Akteure, Nutzer nicht (§2) |
| `forge-run-claude` | unverändert gesperrt (leere Bypass-Liste) bis eigene Claude-Identität | Trust Boundary |
| `forge-spec` | unverändert | – |
| Catch-all gegen Streu-Branches | wird empfohlen statt optional, Bypass Repo-Admin | Write kann sonst beliebige Branches anlegen |
| **neu: `forge-halt`** | Ziel `~DEFAULT_BRANCH`, Regel „Restrict updates“, keine Bypass-Liste, **Enforcement `disabled`**; zum Anhalten auf `active` stellen | ersetzt `FORGE_HALT`-Variable für den Integrationsstopp; nur Admins können Rulesets ändern (DOKU) |
| optional: Regel **„Required reviewers“** | Team `forge-owners` (nur Seb, Team mit Write) für `/.github/`, `/forge/`, `/src/forge/` … | Neu, Public Preview, **nur in Org-Repos** (DOKU). Liegt im Ruleset statt in einer Datei. Nicht auf dem kritischen Pfad; CODEOWNERS reicht für V0.1. |

**Frage 5, was vereinfacht sich:** Branch-Hoheit über Teams statt Nutzer-Bypass, keine Unsicherheit mehr, ob die UI Nutzer-Bypass anbietet. Ein `Restrict updates` mit Rollen-Bypass „Write“ wäre **falsch** (gälte für jeden mit Write). Komplizierter wird nichts; der Wegfall der linearen Historie streicht eine Regel.

**Frage 6, entfallende Workarounds:** Classic PAT auf dem Bot-Konto (IGP §12 Pkt. 9); „Umzug in eine Organisation“ als V0.2-Option (IGP §13) bzw. als Verifier-Fallback (VD §2.4 Pkt. 3); Reliance auf den Changelog-Nutzer-Bypass (IGP §7). **Nicht** entfallen: `.github/**`-Bytevergleich gegen `main` im Gate (IGP §9 Pkt. 4), Code-Owner-Review als einziger Merge-Schutz für geschützte Pfade, Seb-Attestation externer Reviews.

## 6. Verifier implications

**Frage 7, bleibt das Design sicher?** Ja im Kern; drei Punkte ändern sich.

1. **Trigger und Isolation unverändert:** `pull_request_target` aus dem Default-Branch, PR-Code nur als Git-Objekte und im Container ohne Token und Netz, keine Secrets referenziert, Fork-PRs scheitern. Repo-ID-Check bleibt `1401864629` (F6).
2. **S1 wird harte Vorbedingung ohne Fallback.** Die Duplikat-Check-Name-Lücke (VD §2.4, T04) schließt auf einem öffentlichen Free-Org-Repo **nur** die Actions-Policy (Events `push`/`pull_request` verboten, `forge-verify.yml` nur `pull_request_target`). Actions-Policies existieren auf Org- und Repo-Ebene (DOKU); Verfügbarkeit im konkreten Free-Plan: UNVERIFIZIERT, Spike S1 prüft das jetzt in `Forge-Dice`. Neu nutzbar: Actor-Regel nach Rolle (Write darf keine Workflows auslösen, `workflow_dispatch` nur Seb). Achtung: Der Verifier läuft im Kontext des PR-Autors `forge-codex`; die Allow-Regel für `pull_request_target` auf `forge-verify.yml` muss für alle Akteure gelten. Ab 2026-11-02 blockiert die GitHub-Default-Policy `pull_request_target` in öffentlichen Repos, also ist eine explizite Allow-Policy sowieso Pflicht (VD). Scheitert S1, gibt es nur den Weg über einen bezahlten Plan (Team: Org-Rulesets mit Required Workflows).
3. **`FORGE_HALT` raus aus `vars`:** VD-Workflow-Zeile 562 und AC-38 dürfen sich nicht auf eine Variable stützen, die `forge-codex` setzen oder per Repo-Variable überschatten kann. Integrationsstopp = Ruleset `forge-halt` (§5). Ein Verifier-Stopp ist optional über Deaktivieren des Workflows oder die Actions-Policy (Admin-Aktionen). Allgemein: Der Verifier vertraut **keinem** `vars.*` und keinem `secrets.*`.
4. **Merge-Commit-Anpassung (aus Sebs Entscheidung, nicht aus der Org):** VD C8 „lineare Historie“ und AC-22 „Ruleset verhindert Merge-Commit ohnehin“ entfallen. Die Sicherheit kommt aus dem Gate, nicht aus der Historienform. Neue Invarianten für ein angenommenes `M` auf `main`: `M^1` = vorheriges `main`, `M^2` = verifizierter Head `H`, `tree(M) == tree(H)` (am realen PR #1 erfüllt, F4). S10 und VD-Grenze 11 lauten dann „nach Merge Commit“ statt „nach Squash“. Write kann Läufe abbrechen oder neu starten: Abbruch ergibt keinen grünen Check (nur Blockade), Neustart prüft denselben SHA mit Code aus `main` (INFERENZ).

## 7. External reviewer implications

**Frage 9:** Das Modell bleibt: Claude, ChatGPT, Grok sind SHA-/Hash-gebundene Reviewer über den Adapter, **für GitHub ist der Approver Seb** (IGP §10).

- Die Org ändert daran nichts, weil zählende Approvals Write voraussetzen (DOKU), auch bei der neuen Regel „Required reviewers“ (Team mit Write). Eine Reviewer-Identität mit Write könnte pushen; mit Read kann sie nur nicht-zählende Kommentare abgeben, und jedes weitere Konto stößt an die Ein-Machine-Account-Regel.
- Öffentliches Repo: ChatGPT und Grok lesen weiter ohne Credential; keine neuen Lesepfade nötig.
- Neu zu beachten: Sowohl ChatGPT als auch Claude halten heute eine **Owner-Verbindung** (`Wuerfelduell`, F8/F10). Reviewer dürfen über diese Verbindungen **nur lesen**. Eine Review-Abgabe über den Connector würde als Sebs Approval zählen und die Attestation umgehen.
- Branch-Namespace `forge/run/codex/<TASK>-<n>` ist mit IGP §7 identisch; `forge/run/claude/**` bleibt gesperrt.

## 8. Updated setup sequence

Erledigt: Transfer, Baseline per Merge Commit (`3d7545d`), `forge-codex` als Member mit Write (OWNER).

| Schritt | Wer | Inhalt | Ersetzt |
|---|---|---|---|
| 1 | Codex | **Identity-Spike PASS**: Branch `forge/run/codex/SPIKE-1`, Push, Draft-PR; Beleg = PR-Autor **und** Pusher `forge-codex` (Repository Activity bzw. Org-Audit-Log), nicht `Wuerfelduell` | HP O-01 Checkliste „Codex unter eigenem Login“ |
| 2 | Seb | Org-Settings: Base Permission „No permission“, Repo-Erstellung für Member aus, 2FA-Pflicht, PAT-Policy (Classic gesperrt, Fine-grained mit Genehmigung, Laufzeitgrenze), App-Installation nur Owner; **Permissions des ChatGPT-Codex-Connectors und der Claude-App auf `Forge-Dice` ansehen**; Actions Org-Level: Token „Read“, Actions dürfen keine PRs erstellen/approven | IGP §12 Pkt. 2–3 (jetzt auf Org-Ebene) |
| 3 | Seb | Teams `forge-dev-codex` {forge-codex} mit Write auf `Forge`; optional `forge-owners` {Wuerfelduell} | IGP §12 Pkt. 6 |
| 4 | Seb | Repo-Settings: Merge-Methoden nur „Merge commit“, PR-Erstellung „Collaborators only“, Fork-Workflows nur mit Approval | IGP §12, HP O-01 |
| 5 | Seb | **Actions-Policy (S1)** auf Org- oder Repo-Ebene: `push`/`pull_request` verboten, `forge-verify.yml` nur `pull_request_target`, `workflow_dispatch` nur Seb; Negativtest: Developer-Workflow `on: push` läuft nicht | VD C7; vorher Spike-Item, jetzt Blocker |
| 6 | Seb | Rulesets nach §5 (inkl. `forge-halt` disabled); Required Check erst eintragen, wenn `forge-verify` einmal gelaufen ist | IGP §6–§8, HP O-01 |
| 7 | Codex (PR), Seb (Review) | HP O-01-Rest: `.gitattributes`, `.nvmrc`, `.github/CODEOWNERS` mit `@Wuerfelduell` (**Frage 8: CODEOWNERS ändert sich inhaltlich nicht**; ein Team-Owner wäre möglich, muss sichtbar sein und Write haben (DOKU), bringt in V0.1 nichts) | HP O-01 |
| 8 | wie HP | O-02 Verifier-Spike → P-03 → P-05 → P-06 → `FORGE-DRILL-0001` → erster echter Task | HP §5 |

Vor Schritt 8 muss die Contract-/Run-Spezifikation in HP K-05 und P-03 auf Merge Commit umgestellt werden (§9 B3).

**Frage 10, kritischer Pfad:** Etwas kürzer (Baseline steht, O-01 schrumpft auf CODEOWNERS/Hygiene, Teams statt unsicherer Nutzer-Bypass), dafür zwei neue harte Glieder vor O-02: **Identity-Spike PASS** und **S1 ohne Fallback**. Reihenfolge: Spike → Org/Repo-Settings → Actions-Policy → Rulesets → O-01-Rest → O-02 → P-03 → P-05 → P-06 → Drill → erster Task.

## 9. Remaining blockers

| ID | Blocker | Wer löst | Belegstand |
|---|---|---|---|
| B1 | Codex-Identity-Spike noch nicht PASS | Codex, Seb | OWNER |
| B2 | Actions-Policies im `Forge-Dice`-Free-Plan vorhanden und wirksam (S1), sonst keine Abwehr gegen gleichnamige Checks außer bezahltem Plan | Seb (Spike) | DOKU belegt Existenz, Plan-Verfügbarkeit UNVERIFIZIERT |
| B3 | HP D-2 (Squash) und die daraus abgeleiteten Regeln widersprechen der Merge-Commit-Entscheidung. Neu zu spezifizieren: **Registrierung** = Merge Commit `M` mit `M^1` = altes `main`, `git diff --raw --no-renames M^1 M` berührt genau `forge/contracts/<TASK>.md`, **jeder** Commit in `M^1..M^2` hat genau einen Parent und berührt nur diese Datei; damit bleibt DRT-05 (Merge Commit schmuggelt Code als Contract) geschlossen. **Abnahme** = `M^2` = verifizierter Head, `tree(M) == tree(H)`. Betrifft HP K-05 (`CONTRACT_COMMIT_NOT_LINEAR`), P-03, §8-Checkliste („nur Squash“), Drill; VD C8, AC-22, S10. D-12 („`baseCommit` auf der First-Parent-Kette“) bleibt gültig. | Spec-Autor des jeweiligen Tasks, Review wie gehabt | INFERENZ auf Basis F4 |
| B4 | ChatGPT (und Claude) halten eine Admin-Verbindung `Wuerfelduell`. Ein Codex-Lauf über die falsche Verbindung erzeugt einen „Owner-Run“. Gegenmaßnahme in P-02/P-05: PR-Autor oder Pusher == Owner auf `forge/run/**` → rot; organisatorisch: in Codex für `Forge-Dice` nur `forge-codex` verbinden, wenn das Produkt das trennt | Seb, P-02/P-05 | OWNER, Produktverhalten UNVERIFIZIERT |
| B5 | `FORGE_HALT` als Variable ist durch Write umgehbar; Kill-Switch auf Ruleset `forge-halt` umstellen (MP K10, VD AC-38) | Seb, P-06 | DOKU |
| B6 | Org-Plan, Base Permission, Quelle des Write-Rechts von `forge-codex` (direkt oder Base Permission), Actions-Defaults des transferierten Repos sind von hier nicht lesbar | Seb (Sichtprüfung) | F9 |
| B7 | Weiter offen aus HP: OD-3 (Reviewer des ersten Tasks), OD-5 (Task-ID/Designentscheidungen). OD-1 ist durch `forge-codex` gelöst (nach B1), OD-2 durch Stufe A, OD-4 durch F7. | Seb | – |

## 10. Whether my previous recommendation materially changes

**Nein, nicht grundlegend.** Das Zielmodell aus IGP (Owner ohne Bypass, eine Developer-Maschinenidentität, Actions als Verifier, Seb-attestierte externe Reviews, Merge-Commit-only, Namespace je Agent) war bereits so gebaut, dass es ohne Org-Rollen auskommt. Die Org macht es robuster, nicht anders:

1. **Präziser:** Teams als Bypass-Akteure statt nur per Changelog belegtem Nutzer-Bypass; Review-Dismissal auf Seb begrenzbar; Actor-Regeln nach Rolle; Org-Audit-Log für den Spike-Beleg.
2. **Neu möglich:** Fine-grained PATs für lokale Läufe, Classic PATs per Org-Policy sperrbar.
3. **Korrigiert:** Die Annahme, eine kostenlose Org bringe „Require workflows“, war falsch (Team/Enterprise). Beide Verifier-Fallbacks entfallen; die Actions-Policy ist die einzige Abwehr der Check-Namens-Kollision.
4. **Neu entdeckt:** Write verwaltet Actions-Variablen und -Secrets, also ist `FORGE_HALT` als Variable kein Owner-Schalter; Ersatz ist ein deaktiviertes Halt-Ruleset.
5. **Durch Sebs Entscheidung, nicht durch die Org:** Squash aus HP wird durch Merge Commit ersetzt. Die Sicherheit verschiebt sich von „ein Parent auf `main`“ auf diff- und tree-basierte Gate-Invarianten (B3). Der reale Merge von PR #1 erfüllt sie bereits (F4).

Developer-Rechte lassen sich über die Rolle nicht unter Write drücken; die Reduktion läuft über Rulesets, Actions-Policy, Token-Scope und Org-Settings.
