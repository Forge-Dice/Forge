# FORGE V0.1 — VERIFIER IMPLEMENTATION PACKAGE

Stand: 2026-10-03. Rolle: Lead Security Architect (Claude, Thread „Verifier Implementation Package“). Modus: READ-ONLY.
Kanonisches Repository: **Forge-Dice/Forge** (Repo-ID 1401864629, öffentlich), `main` = `3d7545d843883418348004e68717399a64da7a7d`
(Merge Commit von PR #1, Parents `f5dbc73…` und `0dfd903…`, Tree `67103229baccaefd68ce5047d8503eca9883f1d3`).
Nichts wurde verändert: keine Datei im Repo, kein Commit, kein PR, keine GitHub-Einstellung. Dieses Paket und der
Contract-Entwurf liegen ausschließlich unter `/mnt/project-files/forge-audits/`.

Belegmarker: **[GIT]** im Klon geprüft · **[API]** GitHub-API gelesen · **[DOKU]** github/docs @ main (raw.githubusercontent.com,
docs.github.com ist über den Proxy nicht erreichbar) · **[LOKAL]** eigenes Experiment (Git 2.43, Node 22.22, Vitest 5.0.3) ·
**[OWNER]** nur Seb kann es sehen oder entscheiden · **[UNVERIFIZIERT]** plausibel, nicht belegt · **[INFERENZ]** Schlussfolgerung.

Grundlage (nicht umgeschrieben, nur reconciled): FORGE-DEEP-AUDIT (A-xx, NRT-xx), FORGE-DEEP-RED-TEAM (DRT-xx), FORGE-RUN-RECOVERY,
FORGE-V0.1-MINIMUM-PRODUCT (MP), FORGE-V0.1-HARDENING-PLAN (HP, K-/P-/O-Tasks, D-1..D-15), FORGE-IDENTITY-GITHUB-PROTECTION (IGP),
FORGE-INDEPENDENT-VERIFIER-DESIGN (VD, AC-01..42, S1..S13, C1..C10), FORGE-ORGANIZATION-MIGRATION-DELTA (Delta, F1..F10, B1..B7),
FORGE-CONTRACT-SYSTEM-V2 (V2, parallel entstanden; Abgleich in §13.3).

Abkürzungen: `B` = Diff-Basis (Merge-Base von `main` und PR-Head), `H` = geprüfter PR-Head, `M` = Merge Commit auf `main`,
`C` = Contract-Commit (`= M^2` unter Merge-Commit-Strategie), `R` = Run-Basis (`main`-Head beim Start).

## 1. Organization Migration Delta (Teil A, kurz)

Vollständige Herleitung: Delta §1–§10. Hier nur die acht Antworten.

| # | Frage | Antwort |
|---|---|---|
| 1 | Entfallene Personal-Repo-Einschränkungen | Teams als Bypass-Akteure und für „Required reviewers“; Org-Audit-Log als Beleg für Pusher-Identität; Org-Settings (Base Permission, 2FA-Pflicht, PAT-Policy, App-Installation nur Owner, Actions-Defaults auf Org-Ebene); Actor-Regeln nach Rolle in Actions-Policies. **Nicht** gewonnen (Free-Plan, öffentlich): Push-Rulesets, Org-Rulesets mit „Require workflows“, Custom Repository Roles [DOKU via Delta F9/§5]. |
| 2 | Nutzbare Org-Rollen | Org Owner = Seb; Member mit Base Permission „No permission“ = forge-codex; Team `forge-dev-codex` {forge-codex} mit Repo-Rolle Write; optional Team `forge-owners` {Seb}. Repo-Rollen bleiben Admin/Write; Maintain/Triage bringen hier nichts. |
| 3 | Minimale Rechte forge-codex | Genau: Write auf `Forge-Dice/Forge` (push auf `forge/run/codex/**`, PRs öffnen, Checks lesen). Sonst nichts: keine Org-Rechte, keine weiteren Repos, keine Team-Maintainer-Rolle. |
| 4 | Ausdrücklich NICHT | Admin/Maintain; Mitglied eines Bypass-Teams; Merge nach `main` (Ruleset: Required Check + Review, kein Bypass); Force-Push/Delete auf `main` und `forge/contract/**`; Push auf `forge/run/claude/**` und `forge/owner/**`; zählendes Review (CODEOWNERS `@Wuerfelduell`, Approver ist Seb); Classic PAT (Org-Policy sperrt); Workflow-Ausführung über `push`/`pull_request` (Actions-Policy). Nicht entziehbar, daher neutralisiert: Write darf Actions-Variablen/-Secrets verwalten [DOKU via Delta] → der Verifier liest weder `vars.*` noch `secrets.*`; es existieren keine Secrets. |
| 5 | Fine-grained PATs | Relevant nur, wenn Codex außerhalb seines Connectors pusht: ein PAT **von forge-codex**, Resource Owner `Forge-Dice`, nur dieses Repo, `contents: write`, `pull_requests: write`, `metadata: read`, Org-Policy „Genehmigung erforderlich“ mit Laufzeitgrenze. Für den Verifier selbst irrelevant (keine Secrets, kein Token im Container). |
| 6 | Einfachere Rulesets | Bypass-Listen über Teams statt per Changelog belegter Nutzer-Bypässe; Kill-Switch als deaktiviertes Ruleset `forge-halt` statt Variable `FORGE_HALT`; `main`: PR-Pflicht, Required Checks `forge-gate` **und** `forge-verify` (Quelle GitHub Actions, „up to date“ strikt), Review von Code Owner, Dismiss stale, lineare Historie **nicht** (Merge Commit ist Sebs Entscheidung), kein Bypass; Namensraum-Rulesets `forge/run/claude/**`, `forge/owner/**` (nur Seb), `forge/contract/**` (kein Force-Push). |
| 7 | Streichbare Workarounds | Nutzer-Bypass; `FORGE_HALT`-Variable; Push-Rule-Fallback für `.github/**` (gibt es nicht; Actions-Policy S1 ist jetzt harte Vorbedingung); Squash-only (ersetzt durch Merge-Commit-Invarianten, §7); „Repository Activity“ als einziger Pusher-Beleg (jetzt Org-Audit-Log); CODEOWNERS bleibt inhaltlich gleich. |
| 8 | Unverändert relevante Findings | DRT-11/12 (Beobachtungsmodell → §7), DRT-02 (Reviewer-Shopping → Architektur-Gate, außerhalb dieses Pakets), DRT-18/05 (refs/replace, Merge-Commit-Ancestry → §4, §7), Deep Audit A-01..A-26 Testintegrität (vitest.config, describe.skip, trivialer Mutant → §5, §6), T04 gleichnamiger Check (nur Actions-Policy schließt ihn → §3), Delta B4 (ChatGPT/Claude halten eine Owner-Verbindung → Owner-Modus-Entscheidung §14), K-01..K-05 Kernaufgaben bleiben offen. |

## 2. Final Trust Boundary

Sebs Liste, kritisch geprüft. „Trusted“ heißt hier: der Verifier darf darauf eine Entscheidung stützen, ohne sie zu prüfen.

| Element | Status | Korrektur / Bedingung |
|---|---|---|
| Workflow-/Verifier-Code aus `main` | **trusted, bedingt** | Nur weil `pull_request_target` Workflow und Standard-Checkout aus dem Default-Branch lädt [DOKU] **und** die Actions-Policy jeden anderen Event für Workflows verbietet (§3). Zusätzlich: Actions nur per 40-Hex-SHA gepinnt, Container-Image per Digest, kein `cache`, kein `vars.*`, kein `secrets.*`. „main“ heißt `github.sha` des Events; bewegt sich `main` während des Laufs rückwärts (`MAIN_REWRITTEN`), ist der Lauf rot (§4.9). |
| GitHub PR-Metadaten | **teilweise trusted** | Trusted: `repository.id`, `pull_request.number`, `head.sha`, `head.repo.id`, `base.repo.id`, `base.ref`, `user.login`, `github.sha`, `github.run_id`. **Untrusted:** Titel, Body, Labels, Kommentare, `head.ref` (vom Developer gewählt; nur Selektor für den Task, nie Beweis), `merge_commit_sha`/`mergeable` (von GitHub verzögert berechnet; wird nie benutzt), `base.sha` (Momentaufnahme; die Basis berechnet der Verifier selbst). |
| Git-Objekte nach Neutralisierung | **trusted als Adressierung, nicht als Inhalt** | Nach §4: frischer Klon, nur `refs/heads/main` und `refs/pull/N/head`, `GIT_NO_REPLACE_OBJECTS=1`, keine Alternates, nicht shallow, `ls-remote` ohne `refs/replace/*`. Dann ist „Blob X an Pfad P in Tree von H“ eine Tatsache. Der **Inhalt** jedes Blobs aus `H` bleibt untrusted (Daten, nie Anweisung). |
| GitHub Actions Runner für diesen Job | **trusted für den Job** | Der Runner trägt `GITHUB_TOKEN` (contents: read) und `ACTIONS_RUNTIME_TOKEN`; diese sind Teil der Grenze: PR-Code läuft ausschließlich in `docker run` ohne Umgebung, ohne Netz, ohne Mounts außer Arbeitsbaum, Ausgabe und read-only Werkzeugen (§6). Runner-Dateien (`GITHUB_OUTPUT`, `_temp`) sind für den Container unsichtbar. |
| PR-Branch, Developer-Report, Commit Messages, Contract-Freitext, package scripts des PRs, Testkonfiguration des PRs, zusätzliche Workflows des PRs, Symlinks/Submodules, Git-Refs des Developers, Repo-Inhalte als Anweisungen | **untrusted, bestätigt** | Umsetzung: Report und Text kommen in keinem Verifier-Pfad vor (0001 hat keinen Parameter dafür, §13 X-22); Scripts werden nie ausgeführt (`--ignore-scripts`, Binärdateien direkt); Konfiguration kommt aus `main` (`--config /trusted/…`) **und** PR-Konfigurationsdateien sind geschützte Pfade; PR-Workflows laufen nicht (Policy) und sind geschützte Pfade; Symlinks/Submodules werden vor jeder Materialisierung im ganzen Tree abgewiesen; Developer-Refs werden nie geholt (nur `refs/pull/N/head`). |
| **Ergänzungen (fehlten in der Liste)** | untrusted | `.gitattributes`/`.gitmodules`/`.mailmap` im Tree (deshalb Materialisierung per `cat-file`, nie `checkout`/`archive`); verschachtelte `tsconfig*.json`/`jsconfig*.json` (Vite/esbuild lesen die nächstgelegene) und `vitest.config.*` in Unterordnern; `__snapshots__`/`*.snap`; eingechecktes `node_modules` (Node-Auflösung bevorzugt `src/node_modules/x`); Contract-Blob **am Head** (nur der Blob an `B` zählt); fremde Check-Runs und Commit-Statuses am Head (nur der eigene Job zählt; Ruleset bindet die Quelle an GitHub Actions); Repository-Variablen und -Secrets (Write verwaltet sie); Actions-Cache (für `pull_request_target` nur lesbar [DOKU], trotzdem nicht benutzt); Artefakte anderer Läufe (`workflow_run`-Muster wird nicht verwendet); Chat-Kommandos in PR-Kommentaren (auch vom Owner-Login: Delta B4, Connectoren handeln als Seb). |
| **Restvertrauen, das bleibt** | benannt | npm-Registry unterhalb des Lockfile-Integrity-Hashes; GitHub selbst (Event-Payload, Check-Run-Bindung, Ruleset-Durchsetzung); das Container-Runtime des Runners; Vitest-Interna im Prozess des Tests (Exit-Code-Autorität, Fälschung durch Testcode nicht beweisbar → Mutanten + Review, §6). |

## 3. GitHub Actions Architecture

### 3.1 Semantik der vier Trigger (echte GitHub-Semantik)

| Trigger | Woher kommt die Workflow-Datei | Token/Kontext | Verwendbar als Required Check | Urteil |
|---|---|---|---|---|
| `pull_request` | aus dem PR-Merge-Commit, also **vom PR kontrolliert** [DOKU, VD §2.1] | Basis-Kontext; für Fork-PRs read-only | ja, aber der PR könnte den gleichnamigen Job selbst definieren (T04) | **nicht verwenden**; Actions-Policy verbietet den Event |
| `pull_request_target` | aus dem **Default-Branch**; auch der Standard-Checkout zeigt auf den Default-Branch [DOKU] | Basis-Kontext; `github.sha` = `main`-Head beim Event; Token standardmäßig schreibfähig → hier auf `contents: read` reduziert | ja; Check-Run hängt am PR-Head-SHA | **gewählt** |
| `workflow_run` | Default-Branch, läuft nach einem anderen Workflow; Artefakte des Auslösers sind Eingaben | Basis-Kontext | ja | **nicht verwenden**: der Auslöser wäre ein `pull_request`-Lauf (PR-kontrolliert); Artefakt-Substitution und PR-Nummern-Spoofing sind die klassische Lücke; zweiter Angriffsraum ohne Gewinn |
| `workflow_dispatch` | gewählte Ref | manuell | Checks eines Dispatch-Laufs zählen nicht als Required Check des PR [DOKU via VD §2.1] | **nur Owner-Werkzeug** (Wiederholung/Diagnose), nicht Teil des Gates; Policy: Actor = Seb |

Entscheidung: **ein** Workflow `.github/workflows/forge-verify.yml`, Event ausschließlich `pull_request_target` (`types: opened, synchronize, reopened`, `branches: [main]`), **zwei Jobs** mit sauberer Trennung:

- **Gate** (`forge-gate`): arbeitet nur mit Event-Daten und Git-Objekten. Kein Byte aus dem PR wird ausgeführt, keine Datei aus `H` wird geschrieben. Prüft Repository-Identität, Fork, Head-Bindung, Basis, Ancestry, Contract-Bindung, Diff-Autorität (0001/0002). Ergibt `failed(<CODE>)` oder `ok` plus Job-Outputs (nur SHAs und Task-ID).
- **Execution** (`forge-verify`): materialisiert `H` aus Blobs, führt Typecheck und Tests im Container ohne Umgebung aus, schreibt Evidence (0003).

Warum nicht zwei Workflows: eine Kopplung über `workflow_run` müsste Artefakte oder PR-Nummern als Eingabe nehmen (untrusted). Zwei Jobs in einem Workflow aus `main` teilen nur `needs`-Outputs, die der Gate-Job selbst berechnet hat. Beide Jobs stammen aus derselben Datei auf `main`.

### 3.2 Zwingende Begleitregeln

| ID | Regel | Begründung / Beleg |
|---|---|---|
| W1 | Beide Jobs sind Required Checks (`forge-gate`, `forge-verify`), Quelle „GitHub Actions“, „Require branches to be up to date“ aktiv. | Required Check = Job-Name, unabhängig von Workflow und Event [DOKU]; strikt → `H` enthält den `main`-Head beim Merge, daher `tree(M) == tree(H)` (§7). |
| W2 | `forge-verify` hat `needs: forge-gate` **und** `if: always()`; sein erster Step bricht explizit ab, wenn `needs.forge-gate.result != 'success'`. | Ein übersprungener Job meldet **„Success“** und blockiert den Merge nicht, auch als Required Check [DOKU: „A job that is skipped will report its status as Success“]. Deshalb nie ein Job-`if` für Sicherheitsbedingungen; Bedingungen werden als Steps mit `exit 1` formuliert. |
| W3 | `permissions: { contents: read }` auf Workflow-Ebene; kein Job erhöht Rechte; `persist-credentials: false`. | Minimaler Token; der Token wird für ein öffentliches Repo zum Fetchen nicht gebraucht. |
| W4 | Keine `secrets.*`, keine `vars.*`, kein `actions/cache`, kein `cache:` in `setup-node`; `cache-mode` nicht auf `write` gesetzt (für `pull_request_target` standardmäßig read-only [DOKU]). | Write kann Variablen/Secrets setzen (Delta); Cache-Poisoning ausgeschlossen. |
| W5 | Nur zwei Fremd-Actions, beide per 40-Hex-SHA gepinnt: `actions/checkout` (für die Werkzeuge aus `main`, `ref: ${{ github.sha }}`, `fetch-depth: 1`, `submodules: false`, `path: trusted`) und `actions/setup-node` (Node 22, ohne Cache). Alles andere ist `git`/`node`/`docker` direkt. | `node --experimental-strip-types` braucht Node ≥ 22.6; Runner-Node reicht nicht verlässlich. |
| W6 | `runs-on: ubuntu-24.04` (nicht `-latest`), `timeout-minutes` 15 (Gate) / 40 (Verify), `concurrency: forge-verify-<PR>` mit `cancel-in-progress: true`. | Abbruch erzeugt nie „grün“, nur „kein Ergebnis“; der neue Head bekommt seinen eigenen Lauf. |
| W7 | **Actions-Policy (S1), harte Vorbedingung:** Events `push`, `pull_request`, `workflow_run`, `schedule`, `issue_comment` für alle Workflows verboten; `.github/workflows/forge-verify.yml` darf `pull_request_target` (alle Akteure, denn der Lauf läuft im Kontext des PR-Autors forge-codex); `workflow_dispatch` nur Akteur Seb. Negativtest: ein `on: push`-Workflow aus einem Developer-Branch wird mit „Event not allowed“ abgewiesen. | Policies sind für **alle öffentlichen Repositories** unabhängig vom Plan verfügbar, auf Enterprise-, Org- und Repo-Ebene, Settings → Actions → Policies, REST `/rest/actions/policies` [DOKU: about-actions-policies, control-workflow-execution]. Ab **2026-11-02** blockiert die GitHub-Default-Policy `pull_request_target` in öffentlichen Repos; eine explizite Allow-Policy ist ohnehin Pflicht [DOKU]. Ohne Policy ist T04 (gleichnamiger Check aus einem PR-Workflow) auf einem Free-Org-Repo nicht schließbar (Delta B2). |
| W8 | Repo-Settings: Workflow-Token „Read repository contents“, „Allow GitHub Actions to create and approve pull requests“ aus, Fork-PR-Workflows „Require approval for all external contributors“ (Forks scheitern ohnehin an der Repo-ID). | IGP §12, Delta §8. |
| W9 | Kein Chat-Ops (`/forge …`) im Verifier. | Delta B4: Owner-Login ist nicht gleich Owner-Hand. |

### 3.3 Workflow-Skelett (Entwurf, nicht committed)

```yaml
name: forge-verify
on:
  pull_request_target:
    types: [opened, synchronize, reopened]
    branches: [main]
permissions:
  contents: read
concurrency:
  group: forge-verify-${{ github.event.pull_request.number }}
  cancel-in-progress: true
jobs:
  forge-gate:
    name: forge-gate
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    outputs:
      head: ${{ steps.gate.outputs.head }}
      base: ${{ steps.gate.outputs.base }}
      task: ${{ steps.gate.outputs.task }}
    steps:
      - uses: actions/checkout@<40-hex-sha>          # Werkzeuge aus main, nie PR-Code
        with: { ref: "${{ github.sha }}", persist-credentials: false, fetch-depth: 1, submodules: false, path: trusted }
      - uses: actions/setup-node@<40-hex-sha>
        with: { node-version: "22" }
      - id: gate
        env:
          FORGE_EVENT_REPO_ID: ${{ github.event.repository.id }}
          FORGE_HEAD_REPO_ID: ${{ github.event.pull_request.head.repo.id }}
          FORGE_BASE_REPO_ID: ${{ github.event.pull_request.base.repo.id }}
          FORGE_PR_NUMBER: ${{ github.event.pull_request.number }}
          FORGE_HEAD_SHA: ${{ github.event.pull_request.head.sha }}
          FORGE_MAIN_SHA: ${{ github.sha }}
          FORGE_HEAD_REF: ${{ github.event.pull_request.head.ref }}   # Selektor, kein Beweis
          FORGE_PR_AUTHOR: ${{ github.event.pull_request.user.login }}
        run: node --experimental-strip-types trusted/forge/verifier/gate.ts   # nur Daten und Git-Objekte
  forge-verify:
    name: forge-verify
    needs: forge-gate
    if: always()                                      # W2: nie "skipped = success"
    runs-on: ubuntu-24.04
    timeout-minutes: 40
    steps:
      - name: require gate success
        if: needs.forge-gate.result != 'success'
        run: |
          echo "::error::forge-gate result is '${{ needs.forge-gate.result }}'"
          exit 1
      - uses: actions/checkout@<40-hex-sha>
        with: { ref: "${{ github.sha }}", persist-credentials: false, fetch-depth: 1, submodules: false, path: trusted }
      - uses: actions/setup-node@<40-hex-sha>
        with: { node-version: "22" }
      - env:
          FORGE_HEAD_SHA: ${{ needs.forge-gate.outputs.head }}
          FORGE_BASE_SHA: ${{ needs.forge-gate.outputs.base }}
          FORGE_TASK_ID: ${{ needs.forge-gate.outputs.task }}
          FORGE_MAIN_SHA: ${{ github.sha }}
          FORGE_PR_NUMBER: ${{ github.event.pull_request.number }}
          FORGE_RUN_ID: ${{ github.run_id }}
          FORGE_RUN_ATTEMPT: ${{ github.run_attempt }}
        run: node --experimental-strip-types trusted/forge/verifier/verify.ts  # fetch, Diff-Autorität, Materialisierung, docker run, Evidence
```

Der Verify-Job wiederholt alle Gate-Prüfungen (Repo-ID, Head-Bindung, Diff-Autorität), weil Job-Outputs zwar trusted sind, aber eine Wiederholung billig ist und `H` zwischen den Jobs nicht gewechselt haben darf (`HEAD_MOVED`).

## 4. Checkout Authority

Keine impliziten Annahmen. Jede Zeile ist eine Prüfung mit Code; jede Prüfung läuft in **beiden** Jobs vor jeder weiteren Arbeit.

### 4.1 Repository

`FORGE_EVENT_REPO_ID == 1401864629 == FORGE_HEAD_REPO_ID == FORGE_BASE_REPO_ID`, sonst `REPOSITORY_MISMATCH` bzw. `FORK_PR_NOT_SUPPORTED`. Die Zahl ist Konstante im Verifier-Code auf `main` (nicht Variable). `github.repository_owner == "Forge-Dice"` ist Zusatzprüfung (Umbenennungen ändern den Namen, nie die ID) [API: Repo-ID unverändert nach Transfer, Delta F6].

### 4.2 Head-SHA

`HEAD_SHA = github.event.pull_request.head.sha` (40 Hex, Event-Daten). Nach dem Fetch muss `git rev-parse refs/forge/pr-head == HEAD_SHA` gelten (`HEAD_MOVED`); am Ende des Verify-Jobs erneut `git ls-remote <url> refs/pull/N/head` == `HEAD_SHA` (`HEAD_MOVED_LATE`). Es wird nie „der Branch“ geprüft, immer dieser SHA; der Check-Run hängt an ihm.

### 4.3 Ref und Fetch (exakt)

```bash
export GIT_NO_REPLACE_OBJECTS=1 GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null GIT_TERMINAL_PROMPT=0 LC_ALL=C
REPO="$RUNNER_TEMP/repo"; URL="https://github.com/Forge-Dice/Forge"   # öffentlich: kein Token nötig, keiner wird gesetzt
git init -q "$REPO" && cd "$REPO"
git -c core.useReplaceRefs=false fetch --no-tags --prune --no-recurse-submodules --no-write-fetch-head "$URL" \
    "+refs/heads/main:refs/forge/main" "+refs/pull/$FORGE_PR_NUMBER/head:refs/forge/pr-head"
```

- **Welche Ref:** nur `refs/heads/main` und `refs/pull/N/head`. Nie `refs/pull/N/merge` (GitHubs Testmerge, verzögert, nicht das, was gemergt wird), nie Developer-Branches, nie `refs/replace/*`, nie Tags.
- **fetch-depth:** voll (kein `--depth`, kein `--shallow-since`); danach `git rev-parse --is-shallow-repository` muss `false` sein (`SHALLOW_REPOSITORY`), `.git/shallow` darf nicht existieren.
- **persist-credentials:** `false` beim `actions/checkout` der Werkzeuge; der frische Klon hat nie Credentials; Prüfung `git config --show-origin --get-regexp 'http\..*extraheader'` leer (`CREDENTIAL_LEAK`).
- **GITHUB_TOKEN:** `contents: read`; wird in keinem `git`-Aufruf benutzt und nie an `docker run` übergeben.

### 4.4 Base-SHA

`B = git merge-base refs/forge/main refs/forge/pr-head`; genau ein Ergebnis (`BASE_AMBIGUOUS`); `B` liegt auf der First-Parent-Kette von `refs/forge/main` (`git rev-list --first-parent refs/forge/main` enthält `B`, sonst `BASE_NOT_ON_MAIN`). `github.event.pull_request.base.sha` wird **nicht** verwendet (Momentaufnahme von GitHub). `B` wird in die Evidence geschrieben (`base.sha`, `base.tree`).

### 4.5 `main`-Bindung

`FORGE_MAIN_SHA` (= `github.sha`) muss Vorfahr-oder-gleich von `refs/forge/main` (live) sein (`MAIN_REWRITTEN`: Force-Push auf `main` während des Laufs). `main` darf vorwärts gelaufen sein; Werkzeuge stammen aus `github.sha`, die Evidence nennt beide.

### 4.6 refs/replace, Alternates, Grafts, Worktrees, Mirror

| Prüfung | Code |
|---|---|
| `git ls-remote "$URL" 'refs/replace/*'` leer | `REMOTE_REPLACE_REFS` (nur Owner kann löschen; Rulesets schützen keine `refs/replace/*`) |
| lokal `git for-each-ref refs/replace` leer; zusätzlich `GIT_NO_REPLACE_OBJECTS=1` und `-c core.useReplaceRefs=false` in jedem Aufruf | `LOCAL_REPLACE_REFS` |
| `.git/objects/info/alternates` fehlt; `GIT_ALTERNATE_OBJECT_DIRECTORIES` nicht gesetzt (`env -i` + Allowlist) | `ALTERNATES_PRESENT` |
| `.git/info/grafts` fehlt; `.git/shallow` fehlt | `GRAFTS_PRESENT` / `SHALLOW_REPOSITORY` |
| `git worktree list --porcelain` nennt genau ein Worktree; es gibt **keinen** Checkout von `H` | `WORKTREE_PRESENT` |
| `git config --get remote.origin.mirror` leer (kein `--mirror`-Klon) | `MIRROR_CLONE` |
| `git fsck --connectivity-only --no-dangling refs/forge/pr-head refs/forge/main` ohne Fehler | `OBJECTS_INCOMPLETE` |

Beleg: `git replace --graft` verändert `rev-list`/`merge-base` eines Klons, `GIT_NO_REPLACE_OBJECTS=1` neutralisiert das; die Refspec oben holt `refs/replace/*` nie [LOKAL, VD Anhang A]. 

### 4.7 Submodules, Symlinks

`--no-recurse-submodules`, nie `git submodule`. Im Tree von `H` sind `160000` (Gitlink) und `120000` (Symlink) durch 0001 (`TREE_MODE_FORBIDDEN`) **vor** jeder Materialisierung ausgeschlossen; `.gitmodules` ist geschützter Pfad. Materialisierung schreibt nur reguläre Dateien.

### 4.8 Merge-Commit des PRs vs. tatsächlicher Head

Geprüft wird `H` (tatsächlicher Head), nie GitHubs Testmerge. Der spätere Merge Commit `M` auf `main` hat `M^2 == H` und wegen W1 (strikt „up to date“) `tree(M) == tree(H)`: der Verifier hat exakt den Tree gesehen, der auf `main` landet. Ohne W1 wäre `tree(M) ≠ tree(H)` möglich; deshalb ist W1 Teil der Sicherheitsannahme, nicht Komfort.

### 4.9 Arbeitsbaum (Materialisierung ohne Checkout)

```bash
W="$RUNNER_TEMP/work"; mkdir -p "$W"
git ls-tree -r -l -z --full-tree "$HEAD_SHA" > head.lst      # Eingabe der Diff-Autorität (0001)
git ls-tree -r -l -z --full-tree "$B"        > base.lst
# erst nach passed: true der Diff-Autorität:
# je Eintrag (alle 100644, ASCII-Pfade): mkdir -p "$W/$(dirname path)"; git cat-file blob <sha> > "$W/path"
# Reihenfolge: Pfade sortiert; Schreiben mit O_EXCL (Node: flag "wx"); keine Attribute, keine Filter, keine Hooks
```

Kein `git checkout`, kein `git archive`, kein `git worktree add`: alle drei werten `.gitattributes` (`export-ignore`, `export-subst`, `filter`, `eol`) aus dem **untrusted** Tree aus; `git archive` materialisiert außerdem Symlinks [LOKAL]. `cat-file` liest Blobs byte-genau.

### 4.10 Contract-Bindung (VERIFIER-0002, Kurzfassung)

Task-ID aus `FORGE_HEAD_REF` nach Muster `forge/run/codex/<TASK>-<n>` (`BRANCH_NAME_INVALID`); Contract-Blob aus `B:forge/contracts/<TASK>.md` (`CONTRACT_MISSING_AT_BASE`), fatal UTF-8 dekodiert (`CONTRACT_NOT_UTF8`), `parseContractDocument` (`CONTRACT_INVALID`); Registrierungs-Merge `M = git log -1 --first-parent --format=%H refs/forge/main -- forge/contracts/<TASK>.md`, Bedingungen: `M ⊑ B` (`CONTRACT_NOT_IN_BASE`), `diff --raw --no-renames M^1 M` berührt genau diese Datei (`CONTRACT_MERGE_NOT_ISOLATED`), jeder Commit in `M^1..M^2` hat genau einen Parent und berührt nur diese Datei (`CONTRACT_COMMIT_NOT_LINEAR`/`CONTRACT_COMMIT_NOT_ISOLATED`), Blob an `B` == Blob an `M` (`CONTRACT_REVISED_SINCE_BASE`), `baseCommit` aus dem Frontmatter ⊑ `M^1` und auf der First-Parent-Kette (`BASE_NOT_IN_CONTRACT_HISTORY`). `C := M^2`. Kein Approval-Check im Verifier (Architektur-Gate ist außerhalb; `forge/approvals/*.json` wird in P-03 geprüft).

## 5. Diff Authority

Vollständig spezifiziert im Contract-Entwurf (§13, dort §5–§10). Hier Entscheidung und Begründung.

### 5.1 Kanonischer Diff = Differenz zweier Tree-Listings

Eingabe sind die Bytes von `git ls-tree -r -l -z --full-tree <B>` und `… <H>` (vom Gate-Job erzeugt). Die geänderten Dateien
sind die Mengendifferenz nach Pfad mit Blob-SHA- und Modusvergleich. Gründe gegenüber `git diff --raw --no-renames` (VD §5.1):

1. Identische Aussage: ein Commit-Diff **ist** ein Tree-Vergleich; es gibt keine Information im Raw-Diff, die zwei vollständige Listings nicht enthalten.
2. Keine Rename-/Copy-Heuristik existiert überhaupt (DRT-21 entfällt konstruktiv); „Rename“ ist `deleted` + `added`, und `deleted` ist nach Kernregel immer eine Verletzung.
3. Dieselbe Eingabe liefert Modi, Blob-Größen (`-l`), Kollisionen und geschützte Pfade über den **gesamten** Head-Tree, nicht nur über den Diff (ein Symlink, der schon auf `main` läge, wäre im Diff unsichtbar).
4. Ein Parser statt zwei; Determinismus trivial (Sortierung nach Codeeinheiten; Pfade sind ASCII).

`git diff --raw --no-renames -z --abbrev=40 B H` bleibt als **Kreuzprobe** in 0002/0003 (Evidence `diff.crossCheck: equal`); Abweichung ist `DIFF_CROSSCHECK_MISMATCH`.

### 5.2 Regeln (Codes) in fester Reihenfolge

| Fall | Behandlung | Code |
|---|---|---|
| added / modified / deleted | Mengendifferenz; `modified` auch bei reinem Moduswechsel | → Kern `SCOPE_VIOLATION` bei Verstoß; Löschung immer |
| rename | `deleted` + `added`, keine Erkennung | `SCOPE_VIOLATION` (Löschung) |
| mode changes | jeder Eintrag in `H` muss `100644 blob` sein (ganzer Tree) | `TREE_MODE_FORBIDDEN` |
| symlink `120000`, gitlink `160000`, `100755` | wie oben, **vor** Materialisierung, Stop | `TREE_MODE_FORBIDDEN` |
| casefold collisions | ganzer Tree, Datei/Datei und Datei/Verzeichnis | `CASE_COLLISION` |
| Unicode / path normalization | ganzer Tree muss ASCII 0x21–0x7E und `RepoPathSchema`-konform sein; NFC/NFD und jede Unicode-Kollision sind damit ausgeschlossen, nicht normalisiert | `PATH_NOT_REPRESENTABLE` (Subjekt `hex:`) |
| Windows-reservierte Namen | `con prn aux nul com1–9 lpt1–9` als Stamm, Segment endet mit `.`; `.git`, `git~N`; `node_modules` | `PATH_NOT_PORTABLE`, `PATH_GIT_RESERVED`, `TREE_PATH_FORBIDDEN` |
| geschützte Pfade `.github/**`, package.json, package-lock, vitest configs, tsconfig, Forge Contracts, Forge Policy | zwei Stufen (§5.3), casefold, Treffer auf geänderten Pfaden und auf Scope-Einträgen | `PROTECTED_PATH_CHANGED`, `FORGE_PATH_RESERVED`, `SCOPE_PATH_PROTECTED` |
| Koordinationsausnahme des Kerns (`forge/coordination/`) | aufgehoben: muss exakt im Scope stehen | `SCOPE_VIOLATION` (Verifier) |
| Limits | 20 000 Tree-Einträge, 4 MiB Listing, 200 Änderungen, 2 MiB je geändertem Blob | `TREE_TOO_LARGE`, `TOO_MANY_CHANGES`, `BLOB_TOO_LARGE` |
| Eingabe defekt | NUL-basierter Parser, Kopf-Regex, Duplikate | `TREE_LISTING_MALFORMED`, `TREE_DUPLICATE_PATH` |

Stop-Punkte: Parserfehler, Pfad-/Modus-/Kollisionsfehler und `TOO_MANY_CHANGES` beenden die Auswertung mit `changedFiles: null`,
weil danach nichts materialisiert werden darf. Geschützte Pfade, Größen und Scope werden vollständig gesammelt und sortiert gemeldet.

### 5.3 Geschützte Pfade (Entscheidung)

- **Stufe `always`** (jeder Task, auch `FORGE-…`): Root `.gitattributes .gitmodules .npmrc .nvmrc .node-version package.json package-lock.json npm-shrinkwrap.json yarn.lock pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json`; Präfixe `forge/contracts/ forge/approvals/`; in jeder Tiefe `package.json .npmrc .gitattributes tsconfig.json tsconfig.*.json jsconfig*.json vitest.config.* vitest.workspace.* vitest.projects.* vite.config.* *.snap __snapshots__/`. Diese Dateien bestimmen, womit der Verifier installiert, typprüft und testet; sie ändern sich nur per Owner-PR.
- **Stufe `forge`** (nur Tasks mit Präfix `FORGE-`, dann exakter Scope): Präfixe `.github/ forge/ src/forge/ src/forge-verifier/ tests/forge/ tests/forge-red-team/ tests/forge-verifier/ scripts/`; Root `CODEOWNERS .gitignore`.
- „Forge Policy“: Es gibt noch keine `forge/policy.json`; die Regeltabelle ist Code in `src/forge-verifier/protected-paths.ts` (Stufe `forge`, also Owner-reviewte Änderung). Führt ein späterer Task eine Policy-Datei ein, gilt `Policy ⊇ PROTECTED_RULES` als Test.
- Nicht behandelt in 0001 (benannt): Binärerkennung (Scope ist exakt, Größe begrenzt; Reviewer sieht Binärdateien im Scope), Renames (nicht unterstützt), Owner-PRs (§14 OD-3).

### 5.4 Baseline-Hygiene

`main` erfüllt alle Regeln heute: 71 Einträge, alle `100644`, nur ASCII, keine Kollisionen, keine reservierten Namen, längster Pfad 60 Zeichen; Listing-SHA-256 `7087aa36585e2fdce38b84215d53f04cde20e9fb42ce652866b11b767601c1f2` (6519 Bytes) [GIT]. Das Listing ist Golden-Vector im Contract (A-03).

## 6. Test Integrity Model

Leitsatz: Es wird nur behauptet, was ein Exit-Code oder ein Blob-Vergleich beweist. Alles andere heißt „Detektor“ oder „Review-Pflicht“.

### 6.1 Dürfen PR-Tests überhaupt direkt laufen? Ja, unter genau diesen Bedingungen

1. Das Gate ist `ok`: Repository-ID, kein Fork, Head gebunden, `B` eindeutig und auf `main`, Contract an `B` gefunden und gebunden, **Diff-Autorität `passed: true`** (damit: keine Symlinks, Submodule, Exec-Bits, keine geschützten Pfade, Scope eingehalten, Limits).
2. Der Arbeitsbaum wurde aus Blobs materialisiert (§4.9), nie ausgecheckt.
3. Werkzeuge kommen aus `main` (`github.sha`): `node_modules` wird **auf dem Runner** im Trusted-Checkout mit `npm ci --ignore-scripts --no-audit --no-fund` aus dem Lockfile von `main` installiert [LOKAL: funktioniert, esbuild lädt ohne Postinstall] und **read-only** in den Container gemountet. Vorbedingung: Lockfile- und `package.json`-Blob an `B` == an `github.sha` (`TOOLCHAIN_DRIFT`, Developer muss den Branch aktualisieren); an `H` sind sie ohnehin blob-gleich zu `B` (geschützt). Folge: **kein** Container braucht Netz; `postinstall` jeder Art ist gegenstandslos.
4. Jeder Lauf im Container: `docker run --rm --init --env-file /dev/null --user 1000:1000 --cap-drop ALL --security-opt no-new-privileges --pids-limit 512 --memory 4g --cpus 2 --network none --read-only --tmpfs /tmp:rw,size=512m -v "$W:/work" -v "$TRUSTED/node_modules:/work/node_modules:ro" -v "$TRUSTED/forge/verifier:/trusted:ro" -v "$OUT:/out" -w /work <image@sha256:…>`. Kein Token, keine Umgebung, kein Netz, kein Zugriff auf Runner-Dateien.
5. Kommandos sind die **trusted Implementierung** der Allowlist, nie `npm run`: `typecheck` → `node node_modules/typescript/bin/tsc --noEmit -p /work/tsconfig.json`; `test` → `node node_modules/vitest/vitest.mjs run --root /work --config /trusted/vitest.verifier.config.mts --reporter=json --outputFile=/out/test.json --reporter=default --passWithNoTests=false --allowOnly=false --pool forks --isolate`. Alle Flags an Vitest 5.0.3 geprüft [LOKAL]; wichtig: `--allowOnly` ist standardmäßig `!process.env.CI`, im leeren Container also **true**, daher explizit `false`.
6. Exit-Code ist die einzige Autorität für pass/fail. `requiredChecks[].command` muss exakt `npm run typecheck` bzw. `npm test` lauten (Allowlist; sonst `CHECK_NOT_ALLOWED`); die Evidence trägt `command` (Contract-String für den Kern) und `executedCommand` (tatsächlich).

### 6.2 A. Baseline Integrity

„Baseline“ = Tree von `B` (auf der First-Parent-Kette von `main`), Werkzeuge von `github.sha`, trusted Vitest-Konfiguration `forge/verifier/vitest.verifier.config.mts` aus `main` (Skizze: `include: ["tests/**/*.test.ts"]`, `exclude: ["**/node_modules/**", "forge/**", ".github/**"]`, `pool: "forks"`, `isolate: true`, `allowOnly: false`, `passWithNoTests: false`, `setupFiles: []`, `globalSetup: []`, `snapshotOptions.updateSnapshot: "none"`, `testTimeout: 30000`, `hookTimeout: 30000`, `maxWorkers: 2`). Der Verifier führt denselben Test-Befehl zusätzlich auf dem materialisierten Tree von `B` aus (zweiter Container, Kosten hier ≈ 1 min) und erhält das **Baseline-Inventar** ohne jede Developer-Angabe. Heute auf `main`: `tsc` Exit 0; Vitest 22 Dateien, 1087/1087 Tests, 125 Suites, 0 skipped, 0 todo [LOKAL]. Fällt die Baseline selbst rot aus, ist das `BASELINE_RED` (Owner-Problem auf `main`), nie ein Developer-Fehler.

### 6.3 B. Required Test Commands

Kern: `evaluateVerification` verlangt je `requiredChecks[]` genau einen Evidence-Check mit gleichem `name`, gleichem `command` und `exitCode === 0` (`CHECK_FAILED`). Verifier: Allowlist (§6.1 Nr. 5–6), Ausführung im Container, Exit-Codes aus `docker run`. Timeout → Exit ≠ 0 → rot (nie „pending“). Die Deep-Audit-Fälle: `vitest.config` im PR (1086 → 19) ist `PROTECTED_PATH_CHANGED` **und** wirkungslos (`--config` aus `main`) **und** Inventar-Detektor (`total(H) < total(B)`); `package.json`-Script-Umschreibung ist `PROTECTED_PATH_CHANGED` und ohnehin unbenutzt.

### 6.4 C. Test-Count / Manifest Integrity (Detektor, nicht Beweis)

Aus `/out/test.json` (Vitest-JSON-Reporter) von `H` und von `B`:

| Regel | Fehlercode | Status |
|---|---|---|
| I-1 Summen über `testResults[].assertionResults` = `numTotalTests`/`numPassedTests`/`numFailedTests`/`numPendingTests`/`numTodoTests`; Datei fehlt oder nicht parsebar | `INVENTORY_INCONSISTENT` / `INVENTORY_MISSING` | Detektor |
| I-2 Testdateien außerhalb des Scopes: Anzahl, skipped, todo identisch zur Baseline | `INVENTORY_DRIFT_OUT_OF_SCOPE` | Redundanz (Scope macht es schon unmöglich) |
| I-3 Testdateien im Scope: `skipped + todo` ≤ Baseline der Datei; neue Testdateien: `skipped + todo == 0`, `total ≥ 1` | `INVENTORY_SKIP_INCREASED` | Detektor für `describe.skip`/`it.todo` |
| I-4 `numTotalTests(H) ≥ numTotalTests(B)` | `INVENTORY_SHRUNK` | Detektor |

Ehrliche Grenze: Testcode läuft im selben Prozess wie Vitest und kann `/out/test.json` schreiben oder Vitest-Interna fälschen (VD §12, AC-31/32). Deshalb entscheidet nur der Exit-Code über pass/fail, und das Inventar ist ein zusätzlicher **Fehler**grund, nie ein Erfolgsgrund. Die Evidence markiert es als `source: "container-report"`. Code Review bleibt Pflicht für: `.skip`/`.todo`/entfernte Assertions in Scope-Testdateien, Importe von `vitest/...`-Interna, `globalThis.__vitest*`, `process.binding`, neue `.d.ts`/`declare global`.

### 6.5 D. Mutation Smoke (V0.1: contractgebunden, reviewer-repliziert)

Fakten am Kern (3d7545d): `mutationSmoke` ist ein Enum ohne Mutantenliste; `effectiveMutations` nimmt Verifier-Mutationen, wenn `evidence.mutations !== null`, sonst **die des Developers**; `required` mit leerer Liste ist `MUTATION_EVIDENCE_INVALID`; `optional` ohne Mutationen besteht [GIT]. Der Verifier kann in V0.1 keine Mutanten ausführen, weil der Contract sie nicht maschinenlesbar trägt (HP K-04 bzw. V2 `mutants[]` offen).

Regel V0.1: Der Verifier ruft den Kern **ohne** Mutationsurteil auf (`mutationSmoke: "none"`-Projektion, `report.mutations = []`, `evidence.mutations = null`) und schreibt in die Evidence `mutations: { status: "not_evaluated_by_verifier", contractRequires: <enum>, listedInContract: <n> }`. Die Pflicht aus dem Contract (§16 des Entwurfs: 22 benannte Mutanten) wird im Review-Gate erfüllt: der Developer meldet Ergebnisse als Behauptung (Methode wie `forge/reviews/FORGE-CORE-0001B.v2.mutations.json`: in-memory Transform, genau eine Fundstelle), der unabhängige Reviewer repliziert sie, Seb attestiert. Wortlaut in jedem Bericht: „N/N Contract-Mutanten getötet (reviewer-repliziert)“, nie „Mutation Score“. Ein trivialer Mutant erfüllt damit nichts mehr, weil die Mutanten im Contract stehen (owner-approved), nicht im Report. Maschinelle Ausführung folgt als VERIFIER-0004 nach K-04/CORE-0002 (Namen, `before/after`, Dateien aus dem Frontmatter).

### 6.6 E. Echtes Mutation Testing

Nicht vorhanden, nicht behauptet. Keine Scores, keine Abdeckungszahlen, kein „mutation-tested“. Kandidat für V0.2 (Stryker-artig, in Container, nur Zusatzinformation für Reviewer).

## 7. Remote Authority

Prinzip V0.1: **GitHub ist der Beobachter.** Der Check-Run des Verifiers hängt am exakten Head-SHA, das Ruleset verlangt ihn strikt
auf dem aktuellen Head, und die Abnahme ist der Merge Commit. Kein Eventlog-, kein Lease-System.

| Red-Team-Fund | Konzeptionelle Lösung V0.1 | Beleg |
|---|---|---|
| Verspäteter Push-Webhook nach Branch Delete (DRT-11) | Es gibt keinen Webhook-Konsumenten mehr. Verifiziert wird ein SHA innerhalb des Jobs; `ls-remote refs/pull/N/head` am Jobende bindet ihn (`HEAD_MOVED_LATE`). Ein späteres Löschen des Branches ändert nichts an „H wurde verifiziert“; gemergt werden kann nur über den PR, dessen Head-Check an `H` hängt. | GitHub-Semantik [DOKU], §4.2 |
| Push vor Developer-Report (DRT-12) | Es gibt keinen Developer-Report über Commits. Die Behauptung ist der PR-Head; jeder Push erzeugt `synchronize`, einen neuen Lauf und einen neuen Check am neuen SHA. Ein alter grüner Check zählt für den neuen Head nicht (W1 strikt). | §3.2 W1, W6 |
| Zeitlose Remote-Beobachtung | Ersetzt durch GitHubs Check-Run (Zeitstempel, Run-ID, SHA) plus Evidence `observedAt`, `workflow.runId`, `runAttempt`. Jede Beobachtung ist reproduzierbar (deterministische Eingaben), nicht nur datiert. | §8 |
| refs/replace (DRT-18) | `GIT_NO_REPLACE_OBJECTS=1`, `core.useReplaceRefs=false`, Refspec ohne `refs/replace/*`, `ls-remote`-Prüfung `REMOTE_REPLACE_REFS` (nur Owner löscht). | §4.6 [LOKAL] |
| Merge Commit als Contract-Commit (DRT-05) | Neue Invarianten unter Merge-Commit-Strategie: Registrierung ist Merge `M` mit `M^1` = altes `main`, `diff(M^1, M)` berührt genau `forge/contracts/<TASK>.md`, jeder Commit in `M^1..M^2` hat genau einen Parent und berührt nur diese Datei; `C := M^2` (ein Parent → K-05 `CONTRACT_COMMIT_NOT_LINEAR` bleibt sinnvoll). Abnahme: Merge `M'` mit `M'^2 == H` und `tree(M') == tree(H)` (W1). PR #1 erfüllt die Abnahme-Form bereits (`tree(3d7545d) == tree(0dfd903)`) [GIT]. | §4.10, Delta B3 |
| Ungeprüfter Code zwischen Base und Contract (C-08) | Auf `main` kommt in V0.1 nichts ohne Required Check an (Ausnahme Owner-Modus, §14 OD-3). `baseCommit` ⊑ `M^1` ⊑ `R`; semantische Staleness (gelesene Dateien geändert) wird im Bootstrap manuell geprüft (Entwurf §3) und mechanisch mit V2 `reads`/`SPEC_STALE`. | §13.3 |
| Falsche Remote-Behauptung (`claimedRemoteRef`) | Der Verifier kennt keine Behauptung; `remoteOutcome` des Kerns wird, falls der Kern angebunden wird (P-05), aus `ls-remote` innerhalb des Jobs gespeist (`ref: refs/pull/N/head`, `head: H`), nie vom Developer. | Kern `remoteOutcome` [GIT] |

Nicht gebaut (bewusst V0.1): Observer-Workflow mit Zeit/Sequenz (HP S-02), Leases, Status-Projektion, Replay des Kerns aus GitHub-Fakten (P-05). Diese bleiben möglich, weil die Evidence alle nötigen Bindungen enthält (§8).

## 8. FORGE-VERIFICATION-EVIDENCE v1

Vom Verify-Job geschrieben: kanonisches JSON (`JSON.stringify(obj, null, 2)`, Schlüssel in Definitionsreihenfolge), als Job-Summary (gekürzt), als Datei `forge-evidence-<HEAD_SHA>.json` im Artefakt und als Block im Check-Output. **Kein Feld stammt aus PR-Text, Developer-Report, Kommentaren oder Branch-Namen** (die Task-ID stammt aus dem Branch-Namen, ist aber nur Selektor und wird durch den gefundenen Contract an `B` bestätigt; die Evidence trägt die Task-ID des **geparsten** Contracts). Inventarfelder sind als Container-Report markiert.

```json
{
  "forgeEvidenceFormat": 1,
  "repository": { "id": 1401864629, "fullName": "Forge-Dice/Forge", "visibility": "public" },
  "pullRequest": { "number": 7, "headRef": "forge/run/codex/TASK-0006-1", "author": "forge-codex", "event": "pull_request_target", "action": "synchronize" },
  "workflow": {
    "ref": "Forge-Dice/Forge/.github/workflows/forge-verify.yml@refs/heads/main",
    "workflowSha": "<github.workflow_sha>", "toolsCommit": "<github.sha>", "runId": 123456789, "runAttempt": 1,
    "verifierFiles": { "forge/verifier/verify.ts": "<blob sha>", "forge/verifier/gate.ts": "<blob sha>", "forge/verifier/vitest.verifier.config.mts": "<blob sha>", "src/forge-verifier/protected-paths.ts": "<blob sha>" },
    "image": "node:22.<x>.<y>-bookworm-slim@sha256:<digest>", "runner": "ubuntu-24.04", "gitVersion": "2.x", "nodeVersion": "22.x", "observedAt": "2026-10-03T12:00:00Z"
  },
  "main": { "eventSha": "<github.sha>", "liveSha": "<refs/forge/main am Jobende>", "rewritten": false },
  "base": { "sha": "<B>", "tree": "<B^{tree}>", "isMergeBaseOfMainAndHead": true, "onFirstParentChain": true },
  "head": { "sha": "<H>", "tree": "<H^{tree}>", "sourceRef": "refs/pull/7/head", "repoId": 1401864629, "stillAtRefOnExit": true },
  "contract": {
    "taskId": "TASK-0006", "path": "forge/contracts/TASK-0006.md", "readAt": "<B>", "blob": "<blob sha>",
    "contentHash": "<sha256 forge-contract-v1\\n + text>", "contractVersion": 1, "forgeContractFormat": 1,
    "registrationMerge": "<M>", "contractCommit": "<C = M^2>", "baseCommit": "<aus Frontmatter>",
    "scope": { "create": [], "modify": [] }, "requiredChecks": [{ "name": "typecheck", "command": "npm run typecheck" }, { "name": "test", "command": "npm test" }], "mutationSmoke": "required"
  },
  "checkout": { "freshClone": true, "shallow": false, "replaceRefsOnRemote": 0, "alternates": false, "refsFetched": ["refs/heads/main", "refs/pull/7/head"], "fsckConnectivity": "ok", "gitNoReplaceObjects": true },
  "diff": {
    "method": "ls-tree-difference", "baseListingSha256": "<…>", "headListingSha256": "<…>", "headEntryCount": 74,
    "changedFiles": [ { "path": "src/domain/accusation.ts", "change": "added", "oldMode": null, "newMode": "100644", "oldBlob": null, "newBlob": "<sha>", "size": 4120 } ],
    "crossCheckGitDiffRaw": "equal", "failures": []
  },
  "tree": { "allModes100644": true, "caseCollisions": 0, "protectedPathsIdentical": true },
  "toolchain": { "lockfileBlob": "<sha an github.sha == B == H>", "packageJsonBlob": "<…>", "tsconfigBlob": "<…>", "installCommand": "npm ci --ignore-scripts --no-audit --no-fund", "installExitCode": 0 },
  "checks": [
    { "name": "typecheck", "command": "npm run typecheck", "executedCommand": "node node_modules/typescript/bin/tsc --noEmit -p /work/tsconfig.json", "exitCode": 0, "durationMs": 8123, "network": "none" },
    { "name": "test", "command": "npm test", "executedCommand": "node node_modules/vitest/vitest.mjs run --root /work --config /trusted/vitest.verifier.config.mts …", "exitCode": 0, "durationMs": 41200, "network": "none",
      "inventory": { "source": "container-report", "files": 23, "total": 1101, "passed": 1101, "failed": 0, "skipped": 0, "todo": 0 },
      "baselineInventory": { "source": "container-report", "files": 22, "total": 1087, "passed": 1087, "failed": 0, "skipped": 0, "todo": 0 } }
  ],
  "mutations": { "status": "not_evaluated_by_verifier", "contractRequires": "required", "listedInContract": 22 },
  "kernel": { "evaluateVerification": { "passed": true, "mutationSource": "none" }, "projection": "scope-and-checks-only" },
  "result": { "passed": true, "failures": [] },
  "evidenceHash": "<sha256 des kanonischen JSON ohne dieses Feld>"
}
```

Pflichtfelder aus dem Auftrag und wo sie liegen: repository identity → `repository.id`; PR number → `pullRequest.number`; base SHA → `base.sha`; head SHA → `head.sha`; merge-base SHA → `base.sha` (identisch per Definition, `isMergeBaseOfMainAndHead`); contract path/blob/content hash → `contract.*`; verifier version/hash → `workflow.workflowSha`, `toolsCommit`, `verifierFiles`; workflow identity → `workflow.ref`, `runId`, `runAttempt`; canonical changed-file list + modes → `diff.changedFiles[]`; executed commands + exit codes → `checks[]`; test counts → `checks[].inventory` (markiert); mutation smoke → `mutations`; overall → `result`. Bindung an den Kern: `VerificationEvidenceSchema` erhält `runId` (aus `forge/run/codex/<TASK>-<n>` → `run:<task>-<n>`), `verifiedCommit = head.sha`, `method: "fresh_clone"`, `changedFiles` ohne Modi, `checks` (`name`, `command`, `exitCode`), `mutations: null` [GIT]. Es gibt keine Signatur (keine Secrets, kein OIDC in V0.1); Authentizität kommt aus der Herkunft (nur ein Lauf aus `main` kann den Check-Run `forge-verify` erzeugen, Policy W7) und der SHA-Bindung des Check-Runs.

## 9. Review Packet (ChatGPT / Claude / Grok)

Reviewer brauchen **Identifikatoren und Hashes, keine Inhalte**: Code und Contract lesen sie selbst aus dem öffentlichen Repo per SHA. So kann kein Packet Inhalte „vorsagen“, und nichts aus dem Developer-Report wandert hinein.

```json
{
  "forgeReviewPacketFormat": 1,
  "repository": { "id": 1401864629, "fullName": "Forge-Dice/Forge" },
  "pullRequest": 7,
  "head": "<H>", "base": "<B>", "mainAtVerification": "<github.sha>",
  "contract": { "taskId": "TASK-0006", "path": "forge/contracts/TASK-0006.md", "blob": "<sha>", "contentHash": "<…>", "contractVersion": 1, "contractCommit": "<C>" },
  "changedFiles": [ { "path": "src/domain/accusation.ts", "change": "added", "newBlob": "<sha>" } ],
  "checks": [ { "name": "typecheck", "exitCode": 0 }, { "name": "test", "exitCode": 0, "inventoryDelta": { "total": 14, "skipped": 0, "todo": 0 } } ],
  "mutations": { "status": "not_evaluated_by_verifier", "listedInContract": 22 },
  "evidenceHash": "<…>", "evidenceUrl": "<Artefakt-/Run-URL>",
  "reviewTask": "Code Review gegen Contract <contentHash> am Head <H>. Developer-Report ist nicht Teil dieses Pakets; Behauptungen daraus zählen nicht.",
  "answerFormat": "FORGE REVIEW v1: verdict approve|changes_requested|contract_change, findings[{severity, summary, location}], boundTo{head, contentHash, evidenceHash}"
}
```

Nicht enthalten (und warum): Developer-Report (Behauptung), Commit Messages (Behauptung), Runner-Logs und Pfade (Rauschen, keine Bindung), Blob-Inhalte (Reviewer liest per SHA; verhindert Prompt-Injection über das Packet), Secrets (es gibt keine), Mystery-Inhalte außerhalb des Diffs (kein Spoiler-Transport; der Diff selbst ist öffentlich). Der Reviewer antwortet SHA-gebunden; Seb attestiert auf GitHub (IGP §10). Die Owner-Verbindungen von ChatGPT/Claude dürfen nur lesen (Delta B4).

## 10. Adversarial Matrix (48 Angriffe)

Erkennungsschichten: **POL** Actions-Policy (W7) · **WF** Workflow-Struktur (W1–W6) · **GATE** Checkout-/Contract-Bindung (0002) · **DIFF** Diff-/Pfad-Autorität (0001) · **SBX** Container (§6.1) · **TEST** Vitest-Flags/trusted Config · **INV** Inventar (Detektor) · **KRN** Kern `evaluateVerification` · **RS** Ruleset · **GH** GitHub-Semantik · **REV** Code Review / Mutanten (nicht maschinell beweisbar).

| # | Attack | Expected detection layer | Expected result |
|---|---|---|---|
| 1 | Fake changedFiles: PR-Body/Report behauptet `changedFiles: []`, realer Diff ändert 7 Dateien | DIFF (kein Report-Parameter) | Report ignoriert; 7 Einträge aus Listings; Scope-Urteil darüber |
| 2 | Fake green check: Commit-Status `forge-verify = success` per API am Head | RS (Quelle = GitHub Actions) + GH | Status zählt nicht; Merge weiter blockiert |
| 3 | Duplicate check name: Workflow im Developer-Branch mit Job `forge-verify` (`on: push` oder `on: pull_request`) | POL | Lauf abgewiesen („event not allowed“); keine zweite Check-Run-Quelle; zusätzlich `.github/` ist `FORGE_PATH_RESERVED`/Scope |
| 4 | Workflow spoofing: PR ändert `forge-verify.yml` | GH (`pull_request_target` lädt aus `main`) + DIFF | `main`-Workflow läuft; `FORGE_PATH_RESERVED` (TASK) bzw. Scope (FORGE ohne Eintrag) |
| 5 | Vitest config injection: `vitest.config.ts` mit `include: ["tests/nothing.test.ts"]` (Deep Audit 1086 → 19) | DIFF + TEST + INV | `PROTECTED_PATH_CHANGED`; `--config` aus `main` ignoriert sie; `INVENTORY_SHRUNK` |
| 6 | Verschachtelte `src/vitest.config.mts` oder `src/tsconfig.json` (esbuild liest nächstgelegene) | DIFF | `PROTECTED_PATH_CHANGED` (Basename-Regel in jeder Tiefe) |
| 7 | `describe.skip` in Testdatei außerhalb des Scopes | KRN | `SCOPE_VIOLATION` |
| 8 | `describe.skip` in Testdatei im Scope | INV (Detektor) + REV | `INVENTORY_SKIP_INCREASED`; Review-Pflicht bleibt |
| 9 | Package script rewrite: `"test": "exit 0"` | DIFF + SBX | `PROTECTED_PATH_CHANGED`; Scripts werden nie ausgeführt |
| 10 | Test deletion | KRN | `SCOPE_VIOLATION` (Löschung immer) |
| 11 | Assertion weakening (`expect(true).toBe(true)`) in Scope-Testdatei | REV + Mutanten (nur wenn ein Contract-Mutant diese Datei trifft) | nicht maschinell beweisbar; benannt in §6.4 |
| 12 | Trivial mutant (`return stance;` passiert 154/154) | Contract-Mutanten (owner-approved) + REV | Developer-Mutanten zählen nicht; Pflichtmutanten stehen im Contract |
| 13 | refs/replace: Developer pusht `refs/replace/<C>` mit Graft | GATE | `REMOTE_REPLACE_REFS`; ohnehin neutral (`GIT_NO_REPLACE_OBJECTS`, Refspec) |
| 14 | Shallow clone (Fehlkonfiguration des Runners) | GATE | `SHALLOW_REPOSITORY` statt stillem Fail-Open |
| 15 | Second-parent injection: Run-PR enthält Merge mit fremdem Zweig | GATE/DIFF | Diff gegen `B` zeigt alle Dateien des Zweigs → Scope; Historienform ist nicht sicherheitsrelevant, der Tree ist es |
| 16 | Contract merge commit: Registrierungs-Merge `M` mit Code in `M^1..M^2` | GATE | `CONTRACT_MERGE_NOT_ISOLATED` / `CONTRACT_COMMIT_NOT_ISOLATED` |
| 17 | Symlink `src/x.ts → /etc/passwd` oder `→ ../../.npmrc` | DIFF (ganzer Tree, vor Materialisierung) | `TREE_MODE_FORBIDDEN`, `changedFiles: null` |
| 18 | Submodule `160000` auf fremdes Repo + `.gitmodules` | DIFF | `TREE_MODE_FORBIDDEN`, `PROTECTED_PATH_CHANGED` |
| 19 | Mode-only diff: `chmod +x src/a.ts` | DIFF | `TREE_MODE_FORBIDDEN`; Rückweg `100755 → 100644` wäre `modified` (Scope) |
| 20 | Rename `git mv a b` (auch innerhalb des Scopes) | DIFF + KRN | `deleted a` + `added b` → `SCOPE_VIOLATION` für `a` (V0.1 kennt keine Renames) |
| 21 | Case collision `src/Accusation.ts` neben `src/accusation.ts`; Datei `src/a` neben `src/A/x.ts` | DIFF | `CASE_COLLISION` |
| 22 | Unicode collision `src/café.ts` NFC und NFD; `src/Fälle.ts` | DIFF | `PATH_NOT_REPRESENTABLE` (`hex:`-Subjekt) |
| 23 | Windows reserved path `tests/aux.test.ts`, `src/CON.ts`, `notes.`, `.GIT/x`, `GIT~1/x` | DIFF | `PATH_NOT_PORTABLE` / `PATH_GIT_RESERVED` |
| 24 | Deleted protected file (`package-lock.json`, `.github/CODEOWNERS`) | DIFF + KRN | `PROTECTED_PATH_CHANGED`/`FORGE_PATH_RESERVED` + `SCOPE_VIOLATION` |
| 25 | Head changes after verification (Push nach grünem Lauf, Owner merged „den Branch“) | GH + RS (strikt) | neuer Head ohne Check → nicht mergebar; alter Check hängt am alten SHA |
| 26 | Head bewegt sich während des Laufs | GATE | `HEAD_MOVED` / `HEAD_MOVED_LATE`; `synchronize` startet neuen Lauf |
| 27 | Stale review: Approval auf altem Head, dann Push | RS („Dismiss stale approvals“) + Check-Bindung | Approval verfällt; Check fehlt am neuen Head |
| 28 | Fork PR | GATE | `FORK_PR_NOT_SUPPORTED` vor jedem Fetch |
| 29 | Foreign repo/head: Event mit `head.repo.id ≠ 1401864629` oder Workflow in geforktem Repo | GATE (Konstante) | `REPOSITORY_MISMATCH` |
| 30 | Cancelled workflow (Write bricht Lauf ab) | WF/GH | kein Ergebnis = kein grüner Check; Merge blockiert; Neustart prüft denselben SHA mit Code aus `main` |
| 31 | Skipped required job (Job-`if` falsch, Gate übersprungen) | WF (W2) | `forge-verify` läuft mit `if: always()` und schlägt explizit fehl; „skipped = success“ unmöglich |
| 32 | Cache poisoning (Developer schreibt Cache-Einträge) | WF (W4) + GH | kein Cache benutzt; `pull_request_target` nur lesender Cache-Zugriff |
| 33 | Artifact substitution (fremdes Artefakt als Eingabe) | WF | Verifier konsumiert keine Artefakte; Evidence ist Ausgabe |
| 34 | Modified lockfile | DIFF + §6.1 Nr. 3 | `PROTECTED_PATH_CHANGED`; Installation nutzt `main`-Lockfile ohnehin |
| 35 | Modified tsconfig (`strict: false`) | DIFF | `PROTECTED_PATH_CHANGED` |
| 36 | Modified package.json (Deps, `overrides`, `workspaces`) | DIFF | `PROTECTED_PATH_CHANGED` |
| 37 | Malicious postinstall in `package.json` | DIFF + SBX | geschützt; `--ignore-scripts`; Installation auf dem Runner aus `main`, nie aus `H` |
| 38 | Dependency install script (Lifecycle-Hook einer Abhängigkeit) | SBX | `--ignore-scripts`; `node_modules` read-only im Container; kein Netz |
| 39 | Untrusted generated file (`*.snap`, `__snapshots__`, `.d.ts` mit `declare global`) | DIFF (`*.snap`, `__snapshots__`) + REV (`.d.ts`) | `PROTECTED_PATH_CHANGED`; `.d.ts` ist Review-Blocker (benannt) |
| 40 | Huge diff: 5 000 Dateien, 50 MB Blob, 30 000 Tree-Einträge | DIFF | `TOO_MANY_CHANGES` / `BLOB_TOO_LARGE` / `TREE_TOO_LARGE` vor Materialisierung |
| 41 | Missing contract: Branch `forge/run/codex/TASK-0007-1`, kein `forge/contracts/TASK-0007.md` an `B` | GATE | `CONTRACT_MISSING_AT_BASE` |
| 42 | Changed contract during run: v2 auf `main` gemergt, Developer merged `main` in den Branch | GATE | neues `B` → Contract v2 zählt; alter Head ohne Check; `CONTRACT_REVISED_SINCE_BASE`, falls Blob an `B` ≠ Blob an `M` |
| 43 | False remote claim (`claimedRemoteRef` auf nie gepushten Commit) | GATE | kein Claim-Parameter; `ls-remote` im Job ist die Beobachtung |
| 44 | Deleted branch after verification | GH | Check bleibt an `H`; Merge nur über den PR; Löschung schließt den PR, kein Merge möglich |
| 45 | Developer attempts owner action (Ruleset ändern, Merge erzwingen, Review approven, `forge-halt` aktivieren) | RS + Org-Rollen | Write hat keinen Admin; CODEOWNERS-Review nur Seb; kein Bypass |
| 46 | `FORGE_HALT`-Variable gesetzt/überschattet (Write verwaltet Variablen) | WF (W4) | Verifier liest keine Variablen; Kill-Switch ist Ruleset `forge-halt` |
| 47 | Eingechecktes `src/node_modules/zod/index.js` (Modulauflösung schattet die echte Abhängigkeit) | DIFF | `TREE_PATH_FORBIDDEN` |
| 48 | Test liest `process.env`, `/proc/1/environ`, `/run/secrets`, versucht `curl` | SBX | leere Umgebung, kein Token, `--network none`; Test schlägt fehl oder findet nichts |

Nicht beweisbar (ehrlich, unverändert aus VD §12): Testsemantik (Nr. 11), Ergebnisfälschung über Vitest-Interna (Exit-Code-Autorität; Netz: Contract-Mutanten), Inventarfälschung aus dem Container, Container-Escape, Registry-Supply-Chain unterhalb des Lockfile-Integrity-Hashes.

## 11. Three-task Implementation Split

Schnitt nach Vertrauensgrenzen: 0001 ist reine Logik ohne Git, 0002 ist alles, was `git` berührt, 0003 ist alles, was den Prüfling ausführt und die Welt (Workflow, Evidence) berührt. Ein Mutantenlauf im Verifier ist bewusst ein vierter Task nach der Kernerweiterung (K-04/CORE-0002).

### 11.1 FORGE-VERIFIER-0001 — Canonical Diff and Path Authority

| Feld | Inhalt |
|---|---|
| **Ziel** | Deterministische Liste geänderter Dateien aus zwei `ls-tree`-Listings; Pfad-, Modus-, Kollisions-, Schutz- und Größenregeln über den ganzen Head-Tree; Scope-Urteil durch den bestehenden Kern. Kein `git`, keine I/O. |
| **Dependencies** | keine Forge-Abnahme; Code an `3d7545d` (`src/forge/{primitives,freeze,verification,runs,contract-document}.ts`). |
| **Dateien** | create: `src/forge-verifier/{diff-authority,failures,node-sha256,path-rules,protected-paths,tree-listing,tree-rules}.ts`, `tests/forge-verifier/{diff-authority,path-rules,protected-paths,tree-listing,tree-rules}.test.ts`, `tests/forge-verifier/{fixtures,typecheck}.ts`. modify: keine. |
| **Öffentliche API** | `parseTreeListing(bytes)`, `classifyPath(pathBytes)`, `pathSubject(pathBytes)`, `protectedPathHit(path, taskId)`, `PROTECTED_RULES`, `checkTree(entries)`, `collectChangedFiles(input, contract, deps)`, `normalizeFailures`, `compareFailures`, `TREE_LIMITS`, `DIFF_LIMITS`, `nodeSha256Bytes`; Typen `DiffAuthorityFailure(Code)`, `DiffAuthorityResult`, `TreeEntry`, `ClassifiedEntry`, `Sha256Bytes`. |
| **Acceptance Criteria** | A-01..A-13 des Entwurfs (§13): exakte 14 Dateien; 1087 Alt-Tests grün; Golden-Listing von `main`; jeder Code mit Positiv-/Negativfall; Reihenfolge/Stop; Determinismus unter Permutation; Immutabilität; Grenzwerte; `grep`-Regeln; 22 Mutanten detected; Typtests; Kern-Übernahme; ≤ 400 Zeilen. |
| **Adversarial Tests** | X-01..X-22 (Symlink, Gitlink, Exec-Bit, Rename, Casefold Datei/Datei und Datei/Verzeichnis, NFC/NFD, reservierte Namen, `.GIT`/`GIT~1`, `node_modules`, geschützte Dateien in jeder Tiefe, `.github` für TASK vs. FORGE, `forge/contracts` trotz Scope, Koordinationsausnahme, Scope-Alias, 201 Änderungen, 2 MiB + 1, defekte Listings, Zeilenumbruch im Pfad, kein Report-Parameter). |
| **Produktionscode** | 300–380 Zeilen (Grenze 400). |
| **Testcode** | 600–900 Zeilen. |

### 11.2 FORGE-VERIFIER-0002 — Checkout Authority, Contract Binding, Gate

| Feld | Inhalt |
|---|---|
| **Ziel** | Alles, was Git-Fakten beschafft, an einer Stelle (HP P-01-Gedanke, auf den Verifier zugeschnitten): frischer Klon mit exakten Refspecs, Soundness (shallow, replace, alternates, grafts, worktrees, mirror, fsck), `B` als eindeutige Merge-Base auf der First-Parent-Kette, Head- und `main`-Bindung, Contract an `B` lesen und parsen, Registrierungs-Merge-Invarianten (§4.10), Task-ID aus dem Branch-Namen (Selektor), Listings für 0001 erzeugen, Kreuzprobe `git diff --raw --no-renames`, Gate-Entscheidung als reine Funktion über bezeugte Fakten. |
| **Dependencies** | 0001 (`collectChangedFiles`), Kern `parseContractDocument`, `nodeSha256Utf8`. |
| **Dateien** | create: `src/forge-verifier/git.ts` (einziger `child_process`-Import; `execFile("git", …)` ohne Shell, `env -i`-Allowlist, Refs/Pfade hinter `--`), `src/forge-verifier/checkout-authority.ts`, `src/forge-verifier/contract-binding.ts`, `src/forge-verifier/gate.ts` (rein), `forge/verifier/gate.ts` (CLI: liest `FORGE_*`, schreibt `GITHUB_OUTPUT`), `tests/forge-verifier/{git,checkout-authority,contract-binding,gate}.test.ts`, `tests/forge-verifier/git-fixtures.ts` (Wegwerf-Repos mit dem `git`-Binary unter `os.tmpdir()`). modify: `tests/forge-verifier/typecheck.ts`. |
| **Öffentliche API** | `runGit(repoDir, args, opts)`, `prepareRepository({ url, prNumber, dest })`, `assertSound(repoDir, url)`, `resolveBase(repoDir)`, `bindHead(repoDir, headSha)`, `bindMain(repoDir, eventMainSha)`, `taskIdFromBranch(ref)`, `bindContract(repoDir, base, taskId, parse)`, `treeListing(repoDir, commit)`, `crossCheckRawDiff(repoDir, base, head, changedFiles)`, `decideGate(facts): GateDecision` (`{ ok: true, base, head, taskId, contract } \| { ok: false, failures }`). |
| **Acceptance Criteria** | Jeder Code aus §4 (`REPOSITORY_MISMATCH`, `FORK_PR_NOT_SUPPORTED`, `HEAD_MOVED`, `HEAD_MOVED_LATE`, `SHALLOW_REPOSITORY`, `REMOTE_REPLACE_REFS`, `LOCAL_REPLACE_REFS`, `ALTERNATES_PRESENT`, `GRAFTS_PRESENT`, `WORKTREE_PRESENT`, `MIRROR_CLONE`, `OBJECTS_INCOMPLETE`, `CREDENTIAL_LEAK`, `BASE_AMBIGUOUS`, `BASE_NOT_ON_MAIN`, `MAIN_REWRITTEN`, `BRANCH_NAME_INVALID`, `CONTRACT_MISSING_AT_BASE`, `CONTRACT_NOT_UTF8`, `CONTRACT_INVALID`, `CONTRACT_NOT_IN_BASE`, `CONTRACT_MERGE_NOT_ISOLATED`, `CONTRACT_COMMIT_NOT_LINEAR`, `CONTRACT_COMMIT_NOT_ISOLATED`, `CONTRACT_REVISED_SINCE_BASE`, `BASE_NOT_IN_CONTRACT_HISTORY`, `DIFF_CROSSCHECK_MISMATCH`) mit Positiv-/Negativfall in echten Wegwerf-Repos; Umgebung des Elternprozesses (`GIT_ALTERNATE_OBJECT_DIRECTORIES`, `GIT_CONFIG_*`, `HOME`) erreicht `git` nicht; `decideGate` ist deterministisch und eingefroren; Gate-Lauf gegen einen Klon von `Forge-Dice/Forge` mit PR #2 endet `BRANCH_NAME_INVALID`/`CONTRACT_MISSING_AT_BASE` (IDENTITY-SPIKE-1 ist kein Task), nicht mit Ausnahme. |
| **Adversarial Tests** | Replace-Ref-Graft pusht in Wegwerf-Remote (Ancestry bleibt echt, `REMOTE_REPLACE_REFS` schlägt an); Shallow-Klon; Alternates-Datei; Graft-Datei; zweites Worktree; Mirror-Klon; Head nach dem Fetch weiterbewegt; Criss-Cross-Merge mit zwei Merge-Bases; `B` auf Seitenzweig; Registrierungs-Merge mit Code-Commit in `M^1..M^2`; Contract-Commit mit zwei Parents; Contract gelöscht an `B`; Blob mit `0xFF`; Contract an `B` ≠ an `M`; Branch `forge/run/codex/../x`, `--upload-pack=…` als Ref-Argument; manipuliertes Listing (Kreuzprobe schlägt an); `.gitattributes` mit `filter`/`export-ignore` im Head-Tree hat keinen Effekt auf Listings. |
| **Produktionscode** | 320–400 Zeilen. |
| **Testcode** | 500–800 Zeilen (Tests brauchen `git` im Testcontainer → Image-Entscheidung OD-7). |

### 11.3 FORGE-VERIFIER-0003 — Execution Sandbox, Inventory, Evidence v1, Workflow

| Feld | Inhalt |
|---|---|
| **Ziel** | Prüfling aus Blobs materialisieren, Werkzeuge aus `main` installieren, Typecheck und Tests auf `H` und Baseline `B` im Container ohne Umgebung/Netz, Inventar I-1..I-4, Evidence v1 mit `evidenceHash`, Job-Summary und Check-Output, Workflow-Datei, trusted Vitest-Konfiguration, Image-Pin, Owner-Checkliste (Policy, Rulesets, Required Checks). |
| **Dependencies** | 0001, 0002; Owner-Entscheidungen OD-2, OD-3, OD-7, OD-8. |
| **Dateien** | create: `src/forge-verifier/materialize.ts`, `src/forge-verifier/container.ts` (reiner Argument-Builder), `src/forge-verifier/checks.ts`, `src/forge-verifier/inventory.ts`, `src/forge-verifier/evidence.ts`, `forge/verifier/verify.ts` (CLI), `forge/verifier/vitest.verifier.config.mts`, `forge/verifier/image.json` (Tag + Digest), `forge/verifier/OWNER-CHECKLIST.md`, `.github/workflows/forge-verify.yml`, `tests/forge-verifier/{materialize,container,inventory,evidence}.test.ts`. modify: `tests/forge-verifier/typecheck.ts`. |
| **Öffentliche API** | `materializeTree(repoDir, commit, entries, dest)` (nur `100644`, `O_EXCL`), `dockerArgs(spec)`, `runCheck(spec)`, `inventoryFromReport(json)`, `compareInventories(head, base, scope)`, `buildEvidence(facts)`, `canonicalJson(obj)`, `evidenceHash(evidence)`, `toKernelEvidence(evidence)` (→ `VerificationEvidenceSchema`-konform, `mutations: null`). Der Typ `EvidenceFacts` hat **kein** Feld für Developer-Angaben (Kompilierzeit-Beweis). |
| **Acceptance Criteria** | Unit: Materialisierung schreibt exakt die Blobs, verweigert alles ≠ `100644`, bricht bei existierendem Pfad ab; Argument-Builder erzeugt genau die Flags aus §6.1 Nr. 4 (Snapshot-Test gegen festen String); Inventar I-1..I-4 mit Fixture-Reports; Evidence kanonisch, Hash reproduzierbar, Schema vollständig (§8), `toKernelEvidence` validiert gegen `VerificationEvidenceSchema`. Live (Spike-Kriterien VD §13, auf Merge Commit umgestellt): S2 Workflow-Herkunft, S3 kein Token/Env/Netz im Container, S4 Diff-Determinismus über zwei Läufe, S5 Modus-/Pfadfälle rot vor Materialisierung, S6 Ancestry-Fälle, S7 Testintegrität (`vitest.config`, `package.json`, `tsconfig`, `describe.skip`, `it.only`, `process.exit(0)`), S9 Required Check greift (API-Status zählt nicht; neuer Push macht unmergebar), S10 Evidence vollständig und `tree(M) == tree(H)` nach Merge, S11 jeder rote Fall endet mit Code innerhalb `timeout-minutes`, S12 Fork rot ohne Fetch. |
| **Adversarial Tests** | Testdatei liest `process.env`/`/proc/1/environ`/`/run/secrets` und versucht `fetch("https://example.org")` → nichts, Netzfehler; Test schreibt nach `/work/../out` → read-only/unsichtbar; verwaister Prozess überschreibt `/out/test.json` → pass/fail unverändert, Inventar als Detektor markiert; `it.only` → Exit 1; `toMatchSnapshot` ohne Snapshot → rot (`updateSnapshot: "none"`); Test mit Endlosschleife → Timeout → Exit ≠ 0; `.d.ts` mit `declare global` kompiliert (benannt als Review-Blocker, nicht verhindert); zwei Läufe derselben SHA → gleiche `evidenceHash`-Eingaben außer `observedAt`/`runId`. |
| **Produktionscode** | 350–400 Zeilen TypeScript + ≈110 Zeilen YAML/Config. |
| **Testcode** | 400–600 Zeilen (Docker-Pfade nur im Live-Spike, Unit-Tests für reine Teile). |

Danach, außerhalb dieses Schnitts: **FORGE-VERIFIER-0004** Mutantenlauf im Verifier (nach K-04/CORE-0002: Mutanten aus dem Frontmatter, in-memory Transform wie `forge/reviews/FORGE-CORE-0001B.v2.mutations.json`, `MUTATION_SURVIVED`/`MUTATION_EVIDENCE_INVALID` aus dem Kern), Owner-Modus (OD-3), Status-Projektion/Kern-Replay (P-05).

## 12. Recommended First Task

**FORGE-VERIFIER-0001.** Gründe:

1. Es braucht keine GitHub-Einstellung, keinen Workflow, kein Secret, kein `git`, kein Docker; es kann **während** des Identity-Spikes und vor der Actions-Policy implementiert und vollständig offline getestet werden.
2. Es schließt die meisten Zeilen der Matrix (Schicht DIFF: 17 von 48) und ist die Vorbedingung dafür, dass 0002 überhaupt einen Prüfling freigeben darf („fail before materialize“).
3. Es ist der kleinste Task mit vollständiger Testbarkeit im späteren Verifier selbst (keine `git`-/Docker-Abhängigkeit in den Tests) und etabliert die Golden-Fixture-Disziplin (Listing von `main`).
4. Ein Fehler darin ist folgenlos für das Repository: reine Bibliothek, keine Integration.
5. Der Contract liegt fertig als Entwurf vor (§13) und ist gegen den realen Parser validiert.

## 13. DRAFT IMPLEMENTATION CONTRACT — FORGE-VERIFIER-0001

### 13.1 Status

**Entwurf. Nicht freigegeben. Nicht committed.** Datei im Audit-Ordner: `/mnt/project-files/forge-audits/FORGE-VERIFIER-0001.contract.DRAFT.md`.
Zielpfad nach Freigabe: `forge/contracts/FORGE-VERIFIER-0001.md` mit **byte-identischem** Inhalt (Dateiname im Audit-Ordner trägt den Zusatz, der Text nicht; der Text enthält kein Statusfeld und keine Draft-Markierung, damit er unverändert committed werden kann). Jede Änderung eines Bytes ergibt einen neuen Content-Hash.

### 13.2 Validierung gegen den realen Parser (3d7545d)

Ausgeführt mit `node --experimental-strip-types`, Import von `/home/claude/Forge/src/forge/contract-document.ts` (`parseContractDocument`) und `src/forge/node-sha256.ts` (`nodeSha256Utf8`); Frontmatter erzeugt mit `JSON.stringify(meta, null, 2)` [LOKAL]:

```text
ok FORGE-VERIFIER-0001 v1
contentHash 341ec9839fb04ab01fae3b91d4e9e531295c727c0e0a37a15cac978b8b044299
bytes 32686 lines 442 endsWithNewline true
lastLine "<!-- END OF CONTRACT FORGE-VERIFIER-0001 v1 -->"
scope.create 14 modify 0
mutationSmoke required
```

Datei-SHA-256 (`sha256sum` der Draft-Datei, identisch mit dem Text): `7b3e93bb823628bb9057cd2cf69a578aa824f2d04614fec250cda922b04c27e0`.
Geprüft außerdem: kein BOM, kein CR, kein weicher Trennstrich/Zero-Width-Zeichen, UTF-8 fatal dekodierbar, Pfade im Scope `RepoPathSchema`-konform und sortiert, Task-ID `TaskIdSchema`-konform, Scope enthält nicht den eigenen Contract-Pfad.

### 13.3 Abgleich mit FORGE-CONTRACT-SYSTEM-V2 §3.9 (übernommen / bewusst abgewichen)

| Punkt | V2 verlangt | Dieser Entwurf | Bewertung |
|---|---|---|---|
| `forgeContractFormat` | 2 (`FORMAT_NOT_CURRENT` sonst) | **1** | **Bewusste Abweichung.** Format 2 existiert im Kern nicht (`z.literal(1)` [GIT]); Sebs Auftrag verlangt Frontmatter gemäß aktuellem Parser. Migrationspfad: nach CORE-0002 eine `metadata-only`-Revision v2 mit identischem Body (OD-5). |
| `baseCommit` → `specifiedAgainst` | Feldname und Semantik „gegen diesen Stand gelesen“, `⊑ M^1`, First-Parent-Kette; Start von `runBase` | Feld heißt `baseCommit` (Format 1); **Semantik übernommen** (Entwurf §3: keine Startanweisung, Run startet von `R`, `C = M^2`) | Semantik gleich, Name formatbedingt. |
| `mutants[]` mit `before/after`, 1–8 Stück | maschinenlesbar | kein Feld in Format 1 → 22 Mutanten semantisch in §16, `mutationSmoke: "required"`, Verifier wertet nicht aus (§6.5) | Abweichung formatbedingt; bei Migration auf ≤ 8 konkrete `before/after`-Paare reduzieren, Rest bleibt Prosa (V2 §10.3-Muster). |
| Check-Allowlist | `requiredChecks[].command` ∈ Policy | `npm run typecheck`, `npm test` | identisch. |
| Contract-Commit `C = M^2`, Linearität in `M^1..M^2`, `tree(M) == tree(C)` | übernehmen | übernommen (Paket §4.10, §7; Entwurf §3) | gleich. |
| Geschützte Pfade | Parser-Liste (K-01) + Policy, Policy ⊇ Parser | Regeltabelle als Code in 0001; Test „Policy ⊇ `PROTECTED_RULES`“ dem Policy-Task auferlegt (Entwurf §8) | kompatibel; **Erweiterung:** zwei Stufen (`always`/`forge`), `*.snap`, `__snapshots__`, `node_modules`, verschachtelte `tsconfig*`/`jsconfig*` (V2 kennt diese nicht). |
| End-Marker als letzte Zeile | Pflicht | `<!-- END OF CONTRACT FORGE-VERIFIER-0001 v1 -->` | übernommen. |
| Diff-Basis `B` = merge-base, `runBase` auf First-Parent-Kette | Präzisierung | übernommen (§4.4) | gleich. |
| `reads[]`, `SPEC_STALE` | mechanisch | manuell: Entwurf §3 nennt die gelesenen Dateien, Developer prüft vor Start | formatbedingt manuell. |
| `limits.maxProductionLines` | mechanisch gezählt | §18 Prosa ≤ 400, A-13 | formatbedingt manuell. |
| Pflichtüberschriften als Anker, Findings-IDs | Format 2 | nicht anwendbar | – |

### 13.4 Vollständiger Text (byte-identisch zur Draft-Datei)

````markdown
---json
{
  "forgeContractFormat": 1,
  "taskId": "FORGE-VERIFIER-0001",
  "contractVersion": 1,
  "baseCommit": "3d7545d843883418348004e68717399a64da7a7d",
  "dependencies": [],
  "scope": {
    "create": [
      "src/forge-verifier/diff-authority.ts",
      "src/forge-verifier/failures.ts",
      "src/forge-verifier/node-sha256.ts",
      "src/forge-verifier/path-rules.ts",
      "src/forge-verifier/protected-paths.ts",
      "src/forge-verifier/tree-listing.ts",
      "src/forge-verifier/tree-rules.ts",
      "tests/forge-verifier/diff-authority.test.ts",
      "tests/forge-verifier/fixtures.ts",
      "tests/forge-verifier/path-rules.test.ts",
      "tests/forge-verifier/protected-paths.test.ts",
      "tests/forge-verifier/tree-listing.test.ts",
      "tests/forge-verifier/tree-rules.test.ts",
      "tests/forge-verifier/typecheck.ts"
    ],
    "modify": []
  },
  "requiredChecks": [
    {
      "name": "typecheck",
      "command": "npm run typecheck"
    },
    {
      "name": "test",
      "command": "npm test"
    }
  ],
  "mutationSmoke": "required"
}
---
# FORGE-VERIFIER-0001 — Canonical Diff and Path Authority

## 1. Ziel und Verbindlichkeit

Dieser Contract spezifiziert den ersten Baustein des unabhängigen Verifiers: eine reine, deterministische
Diff- und Pfad-Autorität. Sie bestimmt aus zwei Tree-Listings (Basis `B` und Prüfling `H`, beide vom
vertrauenswürdigen Workflow erzeugt) die kanonische Liste geänderter Dateien, prüft Pfadform, Modi,
Kollisionen, geschützte Pfade und Größenlimits und übergibt das Ergebnis dem bestehenden Kern
(`evaluateVerification` aus `src/forge/verification.ts`) für die Scope-Entscheidung.

Kein Wert dieses Moduls stammt vom Developer. Eingaben sind ausschließlich Bytes, die der Verifier selbst
mit `git ls-tree` erzeugt hat, sowie die Metadaten des Contracts, den der Verifier selbst aus `main` gelesen hat.
PR-Text, Developer-Report, Kommentare und Container-Ausgaben kommen in diesem Modul nicht vor.

Das Modul ruft kein `git`, liest keine Dateien, kein Netz, keine Umgebung. Es wirft nie auf Daten; jede
Abweichung ist ein benannter Fehlercode. Alle Ergebnisse sind tief eingefroren; Eingaben bleiben unverändert.

## 2. Herkunft und Reconciliation gegen `main` (3d7545d843883418348004e68717399a64da7a7d)

Alle Namen des Kerns, die dieser Contract verwendet, wurden am genannten Commit im Code geprüft.
Erfunden wird nichts; neue Namen sind ausschließlich die in §4 bis §11 definierten.

| Fakt | Beleg am Basis-Commit |
|---|---|
| Frontmatter ist `---json\n` + `JSON.stringify(raw, null, 2)` + `\n---\n`; andere Formatierung ist `FRONTMATTER_NOT_CANONICAL` | `src/forge/contract-document.ts` (`FRONTMATTER_OPEN`, `FRONTMATTER_CLOSE`, Stufe 3) |
| Schema v1 kennt genau `forgeContractFormat: 1`, `taskId`, `contractVersion`, `baseCommit`, `dependencies`, `scope.create`, `scope.modify`, `requiredChecks` (min. 1), `mutationSmoke: none/optional/required`; kein `mutants`, `reads`, `limits`, kein Statusfeld | `ContractMetadataSchema` (strictObject) |
| Der Hash ist `sha256("forge-contract-v1\n" + text)` und steht nie im Dokument | `CONTRACT_HASH_PREFIX`, `parseContractDocument` |
| `RepoPathSchema`: `^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$`, max. 255, keine Segmente `.`/`..`; `TaskIdSchema`: `^[A-Z][A-Z0-9]*(-[A-Z0-9]+)+$` | `src/forge/primitives.ts` |
| `ChangedFileSchema`: `{path, change: added/modified/deleted}` oder `{fromPath, toPath, change: renamed}` | `src/forge/runs.ts` |
| `evaluateVerification(metadata, report, evidence)`: `added` muss in `scope.create`, `modified` in `scope.modify`; Löschung immer Verletzung; Präfixe `forge/contracts/`, `forge/approvals/` immer verboten; Präfix `forge/coordination/` ist **vom Scope ausgenommen** (`PROCESS_NOTE_PREFIX`) | `src/forge/verification.ts` (`scopeViolations`) |
| `VerificationFailure = { code, subject }`, Codes `CHECK_FAILED`, `SCOPE_VIOLATION`, `MUTATION_SURVIVED`, `MUTATION_EVIDENCE_INVALID`; Sortierung mit `compareCodeUnits` | `src/forge/verification.ts`, `src/forge/primitives.ts` |
| `deepFreeze` friert Ergebnisse tief ein | `src/forge/freeze.ts` |
| Adaptermuster für Node-Abhängigkeiten: `nodeSha256Utf8` ist die einzige Datei unter `src/forge` mit `node:`-Import | `src/forge/node-sha256.ts` |
| Dogfood-Test verlangt, dass jede Datei direkt unter `src/forge` und `tests/forge` im Scope eines `FORGE-CORE-*`-Contracts steht; er liest nur diese beiden Verzeichnisse | `tests/forge/dogfood.test.ts` (`readdirSync`) |
| `tsconfig.json` `include: ["src", "tests"]`; `npm test` = `vitest run` ohne Konfigurationsdatei, Standard-Include erfasst `tests/**/*.test.ts` | `tsconfig.json`, `package.json` |
| Tree von `main`: 71 Einträge, alle Modus `100644`, nur ASCII-Pfade, keine Casefold-Kollisionen; `git ls-tree -r -l -z --full-tree 3d7545d…` hat 6519 Bytes, SHA-256 `7087aa36585e2fdce38b84215d53f04cde20e9fb42ce652866b11b767601c1f2`; Tree-Objekt `67103229baccaefd68ce5047d8503eca9883f1d3` | lokale Beobachtung mit Git 2.43 |

Folgerungen: Neuer Code liegt unter `src/forge-verifier/` und `tests/forge-verifier/` (nicht unter `src/forge/`,
sonst bricht der Dogfood-Test). Beide Verzeichnisse werden von `tsc` und `vitest` ohne Konfigurationsänderung erfasst.
Der Kern wird nicht verändert; dieser Contract hat `scope.modify: []`.

## 3. Basis, Startpunkt, Contract-Commit

`baseCommit` ist der `main`-Commit, gegen den diese Spezifikation gelesen wurde (3d7545d…). Er ist keine
Startanweisung. Der Run startet vom `main`-Head zum Startzeitpunkt (Run-Basis `R`), nachdem der
Contract-PR per Merge Commit `M` auf `main` liegt; der Contract-Commit ist `C = M^2`, und `R` enthält `M`.
Hat sich zwischen `baseCommit` und `R` eine der in §2 belegten Dateien geändert
(`src/forge/contract-document.ts`, `src/forge/primitives.ts`, `src/forge/runs.ts`, `src/forge/verification.ts`,
`src/forge/freeze.ts`, `tests/forge/dogfood.test.ts`, `tsconfig.json`, `package.json`, `package-lock.json`),
stoppt der Developer vor der ersten Codezeile und meldet die Dateien; dann ist eine neue Contract-Version nötig.

`dependencies` ist leer: dieser Contract setzt keinen abgenommenen Forge-Task voraus, nur den Code an `baseCommit`.

## 4. Dateien (exakt)

`scope.create` (14 Dateien), `scope.modify` leer. Keine weitere Datei darf entstehen oder sich ändern.

| Datei | Rolle |
|---|---|
| `src/forge-verifier/failures.ts` | Fehlercodes, Vergleich, Normalisierung (dedupliziert, sortiert, eingefroren) |
| `src/forge-verifier/tree-listing.ts` | Parser für `git ls-tree -r -l -z --full-tree <commit>`; Limits |
| `src/forge-verifier/path-rules.ts` | Pfad-Darstellbarkeit (ASCII `RepoPath`), Portabilität, Git-reservierte Segmente, `node_modules` |
| `src/forge-verifier/protected-paths.ts` | Regeltabelle geschützter und Forge-reservierter Pfade; `protectedPathHit` |
| `src/forge-verifier/tree-rules.ts` | Modusregel, Casefold-Kollisionen (Datei/Datei und Datei/Verzeichnis) über den ganzen Tree |
| `src/forge-verifier/diff-authority.ts` | `collectChangedFiles`: feste Reihenfolge aller Regeln, Kern-Aufruf, Ergebnisform |
| `src/forge-verifier/node-sha256.ts` | Node-Adapter `nodeSha256Bytes`; einzige Datei unter `src/forge-verifier` mit `node:`-Import |
| `tests/forge-verifier/fixtures.ts` | Listing-Builder (Bytes), Scope-Builder, Golden-Listing von `main`, Hilfs-SHA |
| `tests/forge-verifier/tree-listing.test.ts` | Parser-Tests |
| `tests/forge-verifier/path-rules.test.ts` | Pfadregel-Tests |
| `tests/forge-verifier/protected-paths.test.ts` | Regeltabellen-Tests |
| `tests/forge-verifier/tree-rules.test.ts` | Modus- und Kollisionstests |
| `tests/forge-verifier/diff-authority.test.ts` | Ende-zu-Ende, Reihenfolge, Determinismus, Kern-Integration, adversariale Fälle |
| `tests/forge-verifier/typecheck.ts` | Kompilierzeit-Tests (`@ts-expect-error`), nie ausgeführt |

Erlaubte Importe aus dem Kern: `src/forge/primitives.ts` (`RepoPathSchema`, `compareCodeUnits`),
`src/forge/freeze.ts` (`deepFreeze`), `src/forge/verification.ts` (`evaluateVerification`, Typen),
`src/forge/runs.ts` (Typ `ChangedFile`), `src/forge/contract-document.ts` (Typ `ContractMetadata`).
Keine neue Dependency in `package.json`. Kein Import aus `tests/`.

## 5. Fehlercodes (`src/forge-verifier/failures.ts`)

```ts
export type DiffAuthorityOwnCode =
  | "TREE_LISTING_MALFORMED" | "TREE_TOO_LARGE" | "TREE_DUPLICATE_PATH"
  | "PATH_NOT_REPRESENTABLE" | "PATH_NOT_PORTABLE" | "PATH_GIT_RESERVED" | "TREE_PATH_FORBIDDEN"
  | "TREE_MODE_FORBIDDEN" | "CASE_COLLISION"
  | "TOO_MANY_CHANGES" | "BLOB_TOO_LARGE"
  | "PROTECTED_PATH_CHANGED" | "FORGE_PATH_RESERVED" | "SCOPE_PATH_PROTECTED";
export type DiffAuthorityFailureCode = DiffAuthorityOwnCode | VerificationFailureCode;
export type DiffAuthorityFailure = { readonly code: DiffAuthorityFailureCode; readonly subject: string | null };
export function compareFailures(a: DiffAuthorityFailure, b: DiffAuthorityFailure): number;
export function normalizeFailures(failures: readonly DiffAuthorityFailure[]): readonly DiffAuthorityFailure[];
```

`VerificationFailureCode` ist der Kern-Typ aus `src/forge/verification.ts`; davon tritt hier konstruktiv nur
`SCOPE_VIOLATION` auf (§10 Schritt S10). `compareFailures` ordnet nach `code`, dann `subject`
(`null` zuerst), jeweils mit `compareCodeUnits`. `normalizeFailures` entfernt exakte Duplikate
(`code` und `subject` gleich), sortiert und friert ein. Subjekte sind Pfade als Text; nicht darstellbare
Pfadbytes erscheinen als `hex:<kleingeschriebenes Hex der ersten 256 Bytes>` (§7).

## 6. Tree-Listing-Parser (`src/forge-verifier/tree-listing.ts`)

Eingabe sind die unveränderten Bytes von

```text
git ls-tree -r -l -z --full-tree <commit>
```

Je Eintrag: `<mode> SP <type> SP <sha> SP* <size> TAB <pathBytes> NUL`; `<size>` ist rechtsbündig mit Leerzeichen
aufgefüllt (Dezimalzahl für Blobs, `-` für Gitlinks). `-z` liefert Pfade roh, ohne Quoting. Ein leeres Listing
(0 Bytes) ist gültig und hat 0 Einträge.

```ts
export const TREE_LIMITS: { readonly maxListingBytes: 4194304; readonly maxTreeEntries: 20000 };
export type TreeEntry = {
  readonly mode: string; readonly type: "blob" | "commit"; readonly sha: string;
  readonly size: number | null; readonly pathBytes: Uint8Array;
};
export type TreeListingResult =
  | { readonly ok: true; readonly entries: readonly TreeEntry[] }
  | { readonly ok: false; readonly failure: DiffAuthorityFailure };
export function parseTreeListing(bytes: Uint8Array): TreeListingResult;
```

Regeln, in dieser Reihenfolge:

1. `bytes.length > maxListingBytes` → `TREE_TOO_LARGE` (`subject: null`).
2. Nicht leer und letztes Byte ≠ NUL → `TREE_LISTING_MALFORMED` (`subject: null`). Zerlegung an NUL; kein Zeilenparser.
3. Je Datensatz: erstes TAB trennt Kopf und Pfad. Kopf muss `^(\d{6}) (blob|commit) ([0-9a-f]{40}) +(-|\d+)$`
   erfüllen; Pfad nicht leer; `-` nur bei `commit`, Zahl nur bei `blob`. Sonst `TREE_LISTING_MALFORMED`,
   `subject` = Index des Datensatzes als Dezimaltext. Der Typ `tree` (nur mit `-t`) ist hier fehlerhaft.
4. Anzahl > `maxTreeEntries` → `TREE_TOO_LARGE`.
5. Gleiche `pathBytes` zweimal → `TREE_DUPLICATE_PATH`, `subject` = `pathSubject(pathBytes)`.

Der Parser interpretiert Pfade nicht; `pathBytes` ist eine Kopie, nie eine View auf die Eingabe.

## 7. Pfadregeln (`src/forge-verifier/path-rules.ts`)

```ts
export type PathClassification =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly failure: DiffAuthorityFailure };
export function classifyPath(pathBytes: Uint8Array): PathClassification;
export function pathSubject(pathBytes: Uint8Array): string;
export const RESERVED_DEVICE_STEMS: readonly string[];
```

`pathSubject`: sind alle Bytes im Bereich 0x21–0x7E, der Pfad als Text; sonst `hex:` plus Hex der ersten 256 Bytes.

`classifyPath`, erste zutreffende Regel entscheidet, `subject` = `pathSubject(pathBytes)`:

1. Ein Byte außerhalb 0x21–0x7E, oder der Text erfüllt `RepoPathSchema` nicht (Zeichenmenge, Segmente `.`/`..`,
   Länge > 255) → `PATH_NOT_REPRESENTABLE`. Damit sind Leerzeichen, Steuerzeichen, Backslash, `<>:"|?*`
   und jedes Nicht-ASCII-Zeichen (also auch NFC/NFD-Varianten und Unicode-Kollisionen) ausgeschlossen.
2. Ein Segment ist casefold `.git` oder erfüllt `^git~[0-9]+$` → `PATH_GIT_RESERVED`.
3. Ein Segment ist casefold `node_modules` → `TREE_PATH_FORBIDDEN`.
4. Ein Segment endet mit `.`, oder der Teil eines Segments vor dem ersten `.` ist casefold in
   `RESERVED_DEVICE_STEMS` = `con prn aux nul com1…com9 lpt1…lpt9` → `PATH_NOT_PORTABLE`.
   (Ein Segment, das mit `.` beginnt, hat den leeren Stamm und ist nicht reserviert.)

Casefold bedeutet hier ASCII-`toLowerCase`, weil nach Regel 1 nur ASCII vorkommt.

## 8. Geschützte und reservierte Pfade (`src/forge-verifier/protected-paths.ts`)

```ts
export const FORGE_TASK_PREFIX = "FORGE-";
export type ProtectedTier = "always" | "forge";
export type ProtectedRuleKind = "root" | "prefix" | "basename" | "basenameRegex" | "segment";
export type ProtectedRule = { readonly tier: ProtectedTier; readonly kind: ProtectedRuleKind; readonly pattern: string };
export const PROTECTED_RULES: readonly ProtectedRule[];
export type ProtectedHit = { readonly tier: ProtectedTier; readonly rule: ProtectedRule };
export function protectedPathHit(path: string, taskId: string): ProtectedHit | null;
```

Vergleich stets auf dem kleingeschriebenen Pfad. `root` = ganzer Pfad gleich; `prefix` = Pfad beginnt mit
Muster (Muster endet auf `/`); `basename` = letztes Segment gleich; `basenameRegex` = letztes Segment erfüllt
den verankerten regulären Ausdruck; `segment` = irgendein Segment gleich.

Stufe `always` (für jeden Task verboten; ein Treffer ist `PROTECTED_PATH_CHANGED`):

| Art | Muster |
|---|---|
| root | `.gitattributes`, `.gitmodules`, `.npmrc`, `.nvmrc`, `.node-version`, `package.json`, `package-lock.json`, `npm-shrinkwrap.json`, `yarn.lock`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.json` |
| prefix | `forge/contracts/`, `forge/approvals/` |
| basename | `package.json`, `.npmrc`, `.gitattributes`, `tsconfig.json` |
| basenameRegex | `^tsconfig\..+\.json$`, `^jsconfig(\..+)?\.json$`, `^vitest\.(config\|workspace\|projects)\..+$`, `^vite\.config\..+$`, `\.snap$` |
| segment | `__snapshots__` |

Stufe `forge` (nur erlaubt, wenn `taskId` mit `FORGE-` beginnt; sonst `FORGE_PATH_RESERVED`; auch dann gilt der exakte Scope):

| Art | Muster |
|---|---|
| prefix | `.github/`, `forge/`, `src/forge/`, `src/forge-verifier/`, `tests/forge/`, `tests/forge-red-team/`, `tests/forge-verifier/`, `scripts/` |
| root | `codeowners`, `.gitignore` |

`protectedPathHit` prüft zuerst alle `always`-Regeln (erster Treffer in Tabellenreihenfolge), dann die
`forge`-Regeln; ein `forge`-Treffer wird für Tasks mit Präfix `FORGE-` zu `null`. Begründung der Stufen:
`always`-Dateien bestimmen, womit der Verifier selbst installiert, typprüft und testet, oder sind Kern-Tabu;
sie ändern sich ausschließlich per Owner-PR. `forge`-Pfade sind Prozessmaschinerie; Produkt-Tasks (`TASK-…`)
dürfen sie nie berühren. Die Tabelle ist Code, keine Konfiguration; eine spätere Policy-Datei muss sie
enthalten (Test „Policy ⊇ `PROTECTED_RULES`“ ist Aufgabe des Tasks, der die Policy einführt).

## 9. Tree-Regeln (`src/forge-verifier/tree-rules.ts`)

```ts
export type ClassifiedEntry = {
  readonly path: string; readonly mode: string; readonly type: "blob" | "commit";
  readonly sha: string; readonly size: number | null;
};
export function checkTree(entries: readonly ClassifiedEntry[]): readonly DiffAuthorityFailure[];
```

Über den **gesamten** Prüfling-Tree, nicht nur über den Diff:

1. `mode !== "100644"` oder `type !== "blob"` → `TREE_MODE_FORBIDDEN` (`subject` = Pfad). Damit sind `100755`,
   `120000` (Symlink) und `160000` (Submodul) ausgeschlossen, auch wenn sie bereits auf `main` lägen.
2. Zwei Pfade mit gleichem casefold → `CASE_COLLISION` für jeden beteiligten Pfad.
3. Casefold eines Pfads gleich dem casefold eines Verzeichnispräfixes eines anderen Pfads
   (z. B. Datei `src/a` und Datei `src/A/x.ts`) → `CASE_COLLISION` (`subject` = der Dateipfad).

Rückgabe normalisiert (§5). Ein Contract kann in dieser Version keine Ausnahme erteilen.

## 10. Diff Authority (`src/forge-verifier/diff-authority.ts`)

```ts
export type Sha256Bytes = (bytes: Uint8Array) => string;
export const DIFF_LIMITS: { readonly maxChangedFiles: 200; readonly maxBlobBytes: 2097152 };
export type DiffAuthorityInput = { readonly baseListing: Uint8Array; readonly headListing: Uint8Array };
export type DiffAuthorityContract = Readonly<Pick<ContractMetadata, "taskId" | "scope">>;
export type DiffAuthorityDeps = { readonly sha256Hex: Sha256Bytes };
export type ListingDigests = { readonly base: string; readonly head: string };
export type DiffAuthorityResult =
  | { readonly passed: true; readonly changedFiles: readonly ChangedFile[];
      readonly listingSha256: ListingDigests; readonly headEntryCount: number }
  | { readonly passed: false; readonly failures: readonly DiffAuthorityFailure[];
      readonly changedFiles: readonly ChangedFile[] | null;
      readonly listingSha256: ListingDigests; readonly headEntryCount: number | null };
export function collectChangedFiles(
  input: DiffAuthorityInput, contract: DiffAuthorityContract, deps: DiffAuthorityDeps,
): DiffAuthorityResult;
```

Der kanonische Diff ist die Mengendifferenz zweier Tree-Listings. Es gibt keine Rename-Erkennung und keine
Schwellenwerte: eine Verschiebung ist `deleted` plus `added`, eine Löschung ist nach Kernregel immer eine
Verletzung. `changedFiles` enthält nie `change: "renamed"`.

Reihenfolge (fest; „stop“ beendet mit `passed: false` und den bis dahin gesammelten, normalisierten Fehlern):

| Schritt | Regel |
|---|---|
| S1 | `listingSha256 = { base: sha256Hex(baseListing), head: sha256Hex(headListing) }`; steht in jedem Ergebnis. |
| S2 | `parseTreeListing(headListing)`; Fehler → stop (`changedFiles: null`, `headEntryCount: null`). |
| S3 | `parseTreeListing(baseListing)`; Fehler → stop. |
| S4 | `classifyPath` für jeden Prüfling-Eintrag (Fehler sammeln) und jeden Basis-Eintrag (Fehler sammeln, `subject` mit Präfix `base:`). |
| S5 | `checkTree` über alle klassifizierten Prüfling-Einträge (sammeln). Liegt nach S4/S5 ein Fehler vor → stop (`changedFiles: null`). Nichts aus diesem Tree darf danach materialisiert werden. |
| S6 | Änderungsmenge: Pfad nur in `H` → `added`; nur in `B` → `deleted`; in beiden mit ungleichem `sha` **oder** ungleichem `mode` → `modified`. Sortierung nach Pfad mit `compareCodeUnits`. Mehr als `maxChangedFiles` Einträge → `TOO_MANY_CHANGES` (`subject` = Anzahl als Text), stop (`changedFiles: null`). |
| S7 | Für `added`/`modified`: `size > maxBlobBytes` → `BLOB_TOO_LARGE` (`subject` = Pfad). |
| S8 | Für jeden geänderten Pfad: `protectedPathHit(path, taskId)`; Stufe `always` → `PROTECTED_PATH_CHANGED`, Stufe `forge` → `FORGE_PATH_RESERVED`. Für jeden Pfad in `scope.create ∪ scope.modify`: Treffer → `SCOPE_PATH_PROTECTED` (unabhängig davon, ob er geändert wurde). |
| S9 | Koordinationsausnahme des Kerns aufheben: geänderter Pfad mit Präfix `forge/coordination/`, der nicht exakt (`added` in `scope.create`, `modified` in `scope.modify`) im Scope steht → `SCOPE_VIOLATION` (`subject` = Pfad). |
| S10 | `evaluateVerification({ scope, requiredChecks: [], mutationSmoke: "none" }, { mutations: [] }, { changedFiles, checks: [], mutations: null })`; bei `passed: false` werden dessen `failures` unverändert übernommen. Die Argumente werden nach dem Aufruf nicht weiterverwendet. |
| S11 | `normalizeFailures`; `passed` genau dann, wenn keine Fehler. `changedFiles` ist in diesem Fall auch bei `passed: false` gefüllt (für die Evidence). Ergebnis tief eingefroren. |

Stoppen in S2 bis S6 ist Absicht: Pfad- und Modusfehler werden entschieden, bevor irgendein Schritt des
Verifiers den Prüfling in ein Arbeitsverzeichnis schreibt. Die Schritte S7 bis S10 sammeln vollständig.

## 11. SHA-256-Port (`src/forge-verifier/node-sha256.ts`)

```ts
export const nodeSha256Bytes: Sha256Bytes; // createHash("sha256").update(bytes).digest("hex")
```

Einzige Datei unter `src/forge-verifier/` mit `node:`-Import. `diff-authority.ts` erhält den Port per `deps`
und ist dadurch in Tests mit jeder SHA-256-Implementierung prüfbar.

## 12. Invarianten

1. Rein: gleiche Bytes und gleicher Contract ergeben byte-gleiche Ergebnisse (nach `JSON.stringify`), unabhängig von der Reihenfolge der Einträge in den Listings.
2. Der Developer kann die Änderungsmenge nicht beeinflussen: sie folgt allein aus `B`, `H` und der Regeltabelle.
3. Jeder Pfad in `changedFiles` erfüllt `RepoPathSchema` und besteht aus ASCII 0x21–0x7E; `changedFiles` ist duplikatfrei und sortiert.
4. `passed: true` impliziert: alle Prüfling-Einträge haben Modus `100644`, keine Kollision, keine geschützte oder reservierte Änderung, Scope nach Kernregel eingehalten, kein `forge/coordination/`-Pfad außerhalb des exakten Scopes, kein Blob über dem Limit, höchstens 200 Änderungen.
5. Kein Wurf auf Daten: Jede Eingabe-Bytefolge endet in einem `DiffAuthorityResult`.
6. Keine Seiteneffekte: keine Imports aus `node:` außer in `node-sha256.ts`; keine Mutation der Eingaben.
7. Die Regeltabelle `PROTECTED_RULES` ist eingefroren und exportiert; Tests referenzieren sie, statt sie zu kopieren.

## 13. Acceptance Criteria

| ID | Kriterium |
|---|---|
| A-01 | Der Implementierungs-Diff gegen `R` enthält genau die 14 Dateien aus `scope.create`, nur `added`, alle Modus `100644`. |
| A-02 | `npm run typecheck` und `npm test` grün; alle 1087 am Basis-Commit vorhandenen Tests bleiben unverändert grün; Dogfood-Test grün. |
| A-03 | Golden-Listing: `tests/forge-verifier/fixtures.ts` enthält die Bytes von `git ls-tree -r -l -z --full-tree 3d7545d843883418348004e68717399a64da7a7d`; ein Test prüft SHA-256 `7087aa36585e2fdce38b84215d53f04cde20e9fb42ce652866b11b767601c1f2`, 71 Einträge, und dass `collectChangedFiles` mit diesem Listing als `B` und `H` für `TASK-0006` mit leerem Scope `passed: true` und `changedFiles: []` liefert. |
| A-04 | Jeder Fehlercode aus §5 (einschließlich `SCOPE_VIOLATION`) hat mindestens einen auslösenden und einen knapp nicht auslösenden Test. |
| A-05 | Reihenfolge §10 nachgewiesen: ein Listing mit Symlink **und** Scope-Verletzung liefert nur `TREE_MODE_FORBIDDEN` und `changedFiles: null`; ein Listing mit geschütztem Pfad **und** Scope-Verletzung liefert beide Codes und gefüllte `changedFiles`. |
| A-06 | Determinismus: Permutation der Einträge beider Listings ändert `JSON.stringify(result)` nicht. |
| A-07 | Immutabilität: Ergebnisse sind tief eingefroren (Freeze-Scan); Eingabe-`Uint8Array`s sind nach dem Aufruf byte-gleich. |
| A-08 | Limits an der Grenze: 20000 Einträge ok, 20001 `TREE_TOO_LARGE`; 200 Änderungen ok, 201 `TOO_MANY_CHANGES`; Blob 2097152 Bytes ok, 2097153 `BLOB_TOO_LARGE`; Listing 4194304 Bytes ok, 4194305 `TREE_TOO_LARGE`. |
| A-09 | `grep` über `src/forge-verifier/`: `node:` nur in `node-sha256.ts`; kein `child_process`, `fs`, `process.env`, `fetch`; keine Provider-Namen (anthropic, openai, claude, codex, gpt). Tests rufen kein `git` auf. |
| A-10 | Pflicht-Mutation-Smokes §16: jeder Mutant `detected`; `not_applied` gilt nicht als Erfolg; keine Äquivalenz ohne konkrete Begründung. |
| A-11 | `tests/forge-verifier/typecheck.ts`: `changedFiles.push` ist Typfehler; `collectChangedFiles` ohne `scope` ist Typfehler; eine `switch`-Vollständigkeitsprüfung über `DiffAuthorityFailureCode` kompiliert; `renamed` ist für `changedFiles`-Elemente nicht zuweisbar. |
| A-12 | Kern-Integration: ein nicht im Scope liegender `added`-Pfad erzeugt `SCOPE_VIOLATION` **durch den Kern** (Nachweis: der Test kommt ohne eigene Scope-Logik aus und vergleicht mit einem direkten `evaluateVerification`-Aufruf). |
| A-13 | Produktionscode ≤ 400 Zeilen (§18). |

## 14. Testmatrix (Mindestumfang)

- Parser: leeres Listing; ein Eintrag; fehlendes End-NUL; Kopf mit 5-stelligem Modus, ungültigem Typ, `tree`, kurzem SHA, Großbuchstaben im SHA, Größe `-` bei `blob`, Zahl bei `commit`; leerer Pfad; Pfad mit TAB und mit Zeilenumbruch (roh, gültig für den Parser, dann §7); Größenfeld mit mehr als sieben Zeichen; Duplikat; Limits (A-08); Kopie statt View.
- Pfadregeln: jede Regel aus §7 mit auslösendem und knapp gültigem Fall (`src/a b.ts`, `src/a\tb.ts`, `src/café.ts` NFC und NFD, Backslash, `..`, `.`, 255 vs. 256 Zeichen, `.git`, `.GIT`, `GIT~1`, `git~12`, `node_modules`, `NODE_MODULES`, `con`, `CON.txt`, `aux.test.ts`, `lpt1.ts`, `com0.ts` (gültig), `.con` (gültig), `notes.`, `.gitkeep` (gültig)); `pathSubject` Text vs. Hex.
- Regeltabelle: jeder Eintrag von `PROTECTED_RULES` durch mindestens einen Pfad getroffen; Casefold (`Package.json`, `.GitHub/x`, `FORGE/contracts/x.md`); Stufenlogik mit `TASK-0006`, `FORGE-VERIFIER-0002`, `FORGEX-1` (kein Präfix-Treffer, also reserviert); `always` schlägt `forge` (`forge/contracts/x.md` für `FORGE-…` bleibt verboten).
- Tree-Regeln: `100755`, `120000`, `160000`, `040000`-artiger Eintrag, Typ `commit` mit Modus `100644`; Kollisionen Datei/Datei, Datei/Verzeichnis, drei Beteiligte, keine Kollision bei unterschiedlichen Verzeichnissen.
- Diff Authority: `added`/`modified`/`deleted`; Modus-only-Änderung ist `modified`; Rename als `deleted`+`added`; Reihenfolge und Stop-Verhalten (A-05); Scope-Pfad geschützt; `forge/coordination/` mit und ohne Scope-Eintrag für `FORGE-…`-Task; Kern-Übernahme (A-12); Golden-Listing (A-03); Permutation (A-06); Immutabilität (A-07); `listingSha256` mit injiziertem Fake-Hash und mit `nodeSha256Bytes`.

## 15. Adversariale Pflichttests (`tests/forge-verifier/diff-authority.test.ts`)

Jeder Fall nennt Eingabe und erwartete Codes; die Nummern verweisen auf die Matrix des Verifier-Pakets.

| ID | Eingabe | Erwartung |
|---|---|---|
| X-01 | `H` enthält `src/x.ts` als `120000` | `TREE_MODE_FORBIDDEN`, `changedFiles: null` |
| X-02 | `H` enthält `vendor/sub` als `160000 commit` | `TREE_MODE_FORBIDDEN` |
| X-03 | `src/a.ts` wechselt `100644` → `100755` | `TREE_MODE_FORBIDDEN` |
| X-04 | `git mv src/a.ts src/b.ts` (Scope erlaubt `src/b.ts`) | `SCOPE_VIOLATION` für `src/a.ts` (Löschung) |
| X-05 | `src/Accusation.ts` neben `src/accusation.ts` | `CASE_COLLISION` für beide |
| X-06 | Datei `src/a` neben `src/A/x.ts` | `CASE_COLLISION` |
| X-07 | `src/café.ts` (NFC) und (NFD) | `PATH_NOT_REPRESENTABLE` mit `hex:`-Subjekt |
| X-08 | `tests/aux.test.ts`, `tests/notes.`, `src/CON.ts` | `PATH_NOT_PORTABLE` |
| X-09 | `.GIT/config`, `src/GIT~1/x` | `PATH_GIT_RESERVED` |
| X-10 | `src/node_modules/zod/index.js` | `TREE_PATH_FORBIDDEN` |
| X-11 | `Package.json`, `src/package.json`, `tests/tsconfig.spec.json`, `src/vitest.config.mts`, `tests/__snapshots__/a.snap`, `tests/a.test.ts.snap` | `PROTECTED_PATH_CHANGED` je Pfad |
| X-12 | `TASK-0006` ändert `.github/workflows/forge-verify.yml` | `FORGE_PATH_RESERVED` plus `SCOPE_VIOLATION` |
| X-13 | `FORGE-VERIFIER-0002` ändert `.github/workflows/forge-verify.yml` mit Scope-Eintrag | kein `FORGE_PATH_RESERVED`; `passed: true` |
| X-14 | `FORGE-VERIFIER-0002` ändert `forge/contracts/TASK-0006.md` mit Scope-Eintrag | `PROTECTED_PATH_CHANGED`, `SCOPE_PATH_PROTECTED`, `SCOPE_VIOLATION` |
| X-15 | `FORGE-VERIFIER-0002` fügt `forge/coordination/CODEX.md` ohne Scope-Eintrag hinzu | `SCOPE_VIOLATION` (vom Verifier, obwohl der Kern allein es durchließe) |
| X-16 | Scope enthält `forge/Contracts/TASK-0006.md`; keine Änderung daran | `SCOPE_PATH_PROTECTED` |
| X-17 | 201 geänderte Dateien, alle im Scope | `TOO_MANY_CHANGES`, `changedFiles: null` |
| X-18 | Blob mit 2097153 Bytes im Scope | `BLOB_TOO_LARGE` |
| X-19 | Listing ohne End-NUL; Listing mit `tree`-Typ; Basis-Listing mit `src/a b.ts` | `TREE_LISTING_MALFORMED`; `TREE_LISTING_MALFORMED`; `PATH_NOT_REPRESENTABLE` mit `base:`-Präfix |
| X-20 | Pfad `src/new\nline.ts` (Zeilenumbruch im Pfad) | Parser ok, `PATH_NOT_REPRESENTABLE` |
| X-21 | Identische Listings, aber `scope.create` nennt eine Datei, die nicht entstand | `passed: true`, `changedFiles: []` (fehlende Dateien sind kein Diff-Thema) |
| X-22 | Developer-„Report“ ist kein Parameter | Kompilierzeit (A-11): es gibt keinen Weg, Behauptungen zu übergeben |

## 16. Pflicht-Mutation-Smokes

Je Mutant: exakt eine Stelle, in-memory angewandt (Methode wie `forge/reviews/FORGE-CORE-0001B.v2.mutations.json`),
Testlauf, Ergebnis `detected` mit Namen des fehlschlagenden Tests. Mindestens:

| ID | Mutant | Erwarteter Detektor |
|---|---|---|
| M01 | Parser akzeptiert ein Listing ohne End-NUL | `tree-listing.test.ts` |
| M02 | Parser akzeptiert Typ `tree` | `tree-listing.test.ts` |
| M03 | Duplikatprüfung entfernt | `tree-listing.test.ts` |
| M04 | `maxTreeEntries`-Prüfung entfernt | `tree-listing.test.ts` (A-08) |
| M05 | Bytes ≥ 0x80 gelten als darstellbar (`RepoPathSchema`-Prüfung entfernt) | `path-rules.test.ts` (NFC/NFD) |
| M06 | `.git`-Segmentprüfung entfernt | `path-rules.test.ts` |
| M07 | `git~N`-Prüfung entfernt | `path-rules.test.ts` |
| M08 | Reservierte Gerätenamen entfernt | `path-rules.test.ts` |
| M09 | Prüfung „Segment endet mit `.`“ entfernt | `path-rules.test.ts` |
| M10 | `node_modules`-Prüfung entfernt | `path-rules.test.ts` |
| M11 | `checkTree` akzeptiert `100755` | `tree-rules.test.ts` |
| M12 | Kollisionsvergleich ohne Casefold | `tree-rules.test.ts` |
| M13 | Datei/Verzeichnis-Kollision entfernt | `tree-rules.test.ts` |
| M14 | S6 vergleicht nur `sha`, nicht `mode` | `diff-authority.test.ts` |
| M15 | S6 lässt `deleted` weg | `diff-authority.test.ts` (X-04) |
| M16 | `protectedPathHit` ohne Casefold | `protected-paths.test.ts` (`Package.json`) |
| M17 | Stufe `forge` für jeden Task erlaubt | `protected-paths.test.ts`, X-12 |
| M18 | S10 (Kern-Aufruf) übersprungen oder Fehler verworfen | `diff-authority.test.ts` (A-12) |
| M19 | `maxBlobBytes`-Prüfung entfernt | `diff-authority.test.ts` (X-18) |
| M20 | S9 (Koordinationsausnahme) entfernt | `diff-authority.test.ts` (X-15) |
| M21 | Stop nach S5 entfernt (`changedFiles` trotz Modusfehler gefüllt) | `diff-authority.test.ts` (A-05) |
| M22 | `normalizeFailures` ohne Sortierung | `diff-authority.test.ts` (A-06) |

Der Kern kennt am Basis-Commit kein Feld für diese Liste; `mutationSmoke: "required"` verlangt deshalb den
Nachweis im Run-Protokoll (§19). Developer-Mutationsergebnisse sind Behauptungen, bis der Reviewer sie nachstellt.

## 17. Non-Goals

Aufruf von `git`, Checkout, Fetch, Ancestry, Contract-Bindung, Merge-Base (FORGE-VERIFIER-0002);
Container, Installation, Typecheck- und Testausführung, Testinventar, Evidence-Datei, Workflow-YAML
(FORGE-VERIFIER-0003); Mutantenlauf im Verifier (nach Kernerweiterung); Binärerkennung; Rename-Unterstützung;
Policy-Datei; Contract-Format 2; GitHub-API; Änderungen am Kern unter `src/forge/`.

## 18. Größe

Empfohlen ≤ 400 Zeilen Produktionscode unter `src/forge-verifier/` (inkl. Kommentare und Leerzeilen),
erwartet 300–380. Tests 600–900 Zeilen, ausgenommen.

## 19. Developer-Protokoll (Bootstrap)

1. Branch `forge/run/codex/FORGE-VERIFIER-0001-1` von `R` (aktueller `main`-Head, der `M` enthält). Kein Rebase, kein `--force`.
2. Contract ausschließlich aus Git lesen: `git cat-file -p <C>:forge/contracts/FORGE-VERIFIER-0001.md`; Quittung berechnen
   (`contract_commit`, `contract_blob` = `git rev-parse <C>:forge/contracts/FORGE-VERIFIER-0001.md`,
   `content_hash` = SHA-256 über `forge-contract-v1\n` + Text, `byte_count`, `end_marker` = letzte Zeile wörtlich)
   und als Block `FORGE READ RECEIPT v1` in den PR-Body stellen. Bei Abweichung zum Erwartungswert stoppen.
3. Staleness-Prüfung nach §3; bei Treffern stoppen und melden.
4. Nur die 14 Dateien aus §4 anlegen. `npm ci --ignore-scripts`, `npm run typecheck`, `npm test` lokal; Mutanten §16 nachweisen.
5. Draft-PR gegen `main` mit Quittung, Befehlen und Exit-Codes, Mutationsergebnissen, Abweichungen. Alles darin ist Behauptung;
   geprüfte Tatsachen sind, was Verifier und unabhängiger Reviewer selbst feststellen.
6. Widerspricht ein Prompt diesem Contract, gilt der Contract; die Abweichung wird gemeldet.

## 20. Freigabe (extern, nicht Teil dieses Dokuments)

Die Freigabe wird außerhalb dieses Textes festgehalten (`forge/approvals/FORGE-VERIFIER-0001.v1.architecture_review.json`,
gebunden an den Content-Hash dieses exakten Textes). Das Dokument selbst trägt keinen Status.

<!-- END OF CONTRACT FORGE-VERIFIER-0001 v1 -->
````

## 14. Remaining Owner Decisions

| ID | Entscheidung | Optionen | Empfehlung |
|---|---|---|---|
| OD-1 | **Identity-Spike PASS feststellen** | Im Org-Audit-Log (`Forge-Dice` → Settings → Audit log, Aktion `git.push`) prüfen, dass der Push von `8dc692b0adc82e9dd2ccef60b6013006e700a744` (PR #2, Branch `forge/run/codex/IDENTITY-SPIKE-1`) von `forge-codex` kam, nicht von `Wuerfelduell` [OWNER]. Zusatz: Author/Committer des Spike-Commits tragen eine private E-Mail-Adresse, die GitHub `forge-codex` zuordnet [API]; E-Mail-Attribution ist fälschbar, deshalb Commit-E-Mail auf `337272506+forge-codex@users.noreply.github.com` umstellen (337272506 = User-ID von forge-codex [API]). | Beides tun; ohne Audit-Log-Beleg kein PASS. |
| OD-2 | **Actions-Policy S1** anlegen und Negativtest fahren (W7), **bevor** irgendein Workflow auf `main` landet | Org- oder Repo-Ebene; Repo-Ebene reicht für ein Repo | Org-Ebene (gilt auch für künftige Repos), Negativtest dokumentieren. |
| OD-3 | **Owner-PRs** (Contract-PRs, `.github`, Lockfile-Updates, Hygiene) müssen die Required Checks passieren | (a) Gate-„Owner-Modus“ für Branches `forge/owner/**` und `forge/contract/**`: Autor-Login = Seb **und** Branch-Namensraum per Ruleset nur für Seb beschreibbar; dann keine Stufenprüfung geschützter Pfade, aber Tree-Regeln, Typecheck, Tests, Baseline; Contract-PRs zusätzlich P-03-Regeln; (b) Ruleset-Bypass für Seb; (c) Required Checks zeitweise aus | **(a)**. (b) scheitert an Delta B4 (Connectoren handeln als Seb), (c) ist ein Loch. Umsetzung in 0002/0003; bis dahin landen Owner-Änderungen vor dem Aktivieren der Required Checks (Delta §8 Reihenfolge). |
| OD-4 | Dürfen `FORGE-…`-Tasks `.github/workflows/**` und `forge/verifier/**` über ihren exakten Scope ändern? | (a) ja (Entwurf: Stufe `forge`); (b) nein, nur Owner (dann committet Seb YAML/Config aus dem 0003-Deliverable selbst) | **(a)**: Änderung ist im laufenden PR inert (Workflow kommt aus `main`), owner-approved per Contract und Merge; weniger Handarbeit. |
| OD-5 | Contract-Format für FORGE-VERIFIER-0001 | (a) Format 1 jetzt (Entwurf); (b) auf CORE-0002/Format 2 warten | **(a)**; später `metadata-only`-Revision v2 mit identischem Body. |
| OD-6 | `mutationSmoke: "required"` ohne maschinelle Auswertung | (a) `required` im Text, reviewer-repliziert, Verifier meldet `not_evaluated_by_verifier`; (b) `none` bis VERIFIER-0004 | **(a)**: hält die Pflicht sichtbar; Wortlaut „N/N Contract-Mutanten getötet (reviewer-repliziert)“. |
| OD-7 | Container-Image | (a) `node:22.<x>-bookworm` (enthält `git`, nötig für 0002-Tests im Sandbox-Lauf), per Digest gepinnt; (b) `-slim` und 0002-Tests außerhalb des Verifiers | **(a)**; Digest in `forge/verifier/image.json`. |
| OD-8 | Baseline-Testlauf auf `B` im zweiten Container (verdoppelt Testzeit, heute ≈ 1 min) | behalten / streichen | behalten: einzige developer-freie Quelle für das Baseline-Inventar. |
| OD-9 | Geschützte Pfade bestätigen | `*.snap`/`__snapshots__` ganz verboten; `.gitignore`/`CODEOWNERS` Stufe `forge`; `scripts/` reserviert; `pnpm-workspace.yaml` Stufe `always` | so lassen; Änderungen kosten nur eine Contract-Revision vor Implementierung. |
| OD-10 | Architektur-Reviewer für den 0001-Contract | ChatGPT oder Grok über das Review Packet (nicht Codex, nicht dieser Claude-Thread); Verdict SHA-/Hash-gebunden (`341ec983…`); Seb attestiert als Approval-Record `forge/approvals/FORGE-VERIFIER-0001.v1.architecture_review.json` | ChatGPT (bereits als Reviewer von 0001B v2 etabliert), Grok als zweite Stimme optional. |
| OD-11 | Run-Benennung | Branch `forge/run/codex/FORGE-VERIFIER-0001-1`, Kern-Run-ID `run:forge-verifier-0001-1` (erfüllt `RunIdSchema` [GIT]) | so festlegen. |
| OD-12 | Repo-Einstellungen aus Delta §8 Schritte 2–4 (Org-Base-Permission, 2FA, PAT-Policy, Teams, Merge-Methode nur „Merge commit“, PR-Erstellung nur Collaborators) | – | vor dem ersten Run-PR erledigen [OWNER]. |

## 15. GO / NO-GO nach dem Codex Identity Spike

**GO (bedingt) für die Implementierung von FORGE-VERIFIER-0001 durch forge-codex**, sobald in dieser Reihenfolge erfüllt:

1. OD-1: Pusher von `8dc692b…` im Org-Audit-Log = `forge-codex` (Seb). Bis dahin gilt forge-codex als nicht bewiesen, und kein Run-PR wird akzeptiert.
2. OD-10: unabhängiges Architektur-Review des Entwurfs mit Verdict `approved` auf Content-Hash `341ec9839fb04ab01fae3b91d4e9e531295c727c0e0a37a15cac978b8b044299`; Approval-Record durch Seb.
3. Contract-PR von Seb (`forge/contract/FORGE-VERIFIER-0001`), Datei byte-identisch zur Draft-Datei, Merge Commit `M` mit genau dieser einen Datei; `C = M^2`.
4. Run-Branch `forge/run/codex/FORGE-VERIFIER-0001-1` von `R` (`main`-Head mit `M`), Developer-Protokoll des Entwurfs §19; Staleness-Prüfung gegen die in §3 des Entwurfs genannten Dateien.

Begründung: 0001 braucht keine GitHub-Einstellung, keinen Workflow, kein Secret und keinen Zugriff auf Git zur Laufzeit. Das Risiko eines Fehlstarts ist verlorene Arbeit, nie ein Loch im Repository. Der Required Check existiert noch nicht; die Prüfung dieses ersten Runs erfolgt wie bei 0001B v2 durch unabhängiges Review plus lokale Replikation der Mutanten durch den Reviewer, und Seb merged per Merge Commit.

**NO-GO**:

- für jede Änderung an GitHub-Einstellungen, Rulesets oder das Anlegen des Workflows, bis OD-2 (Actions-Policy mit Negativtest) erledigt und OD-3 (Owner-Modus) entschieden ist; Required Checks erst eintragen, nachdem `forge-gate`/`forge-verify` einmal grün gelaufen sind (Delta §8 Schritt 6);
- für FORGE-VERIFIER-0002/0003 als Run-PRs, bis 0001 abgenommen ist (0002 importiert 0001) und OD-7 entschieden ist;
- für Produkt-Tasks (z. B. TASK-0006) über den Verifier, bis 0003 live ist und ein Drill (FORGE-DRILL-0001, Run-Recovery/First-Managed-Run-Drill) bestanden wurde;
- für jede Nutzung der ChatGPT-/Claude-Owner-Verbindungen zum Schreiben im Repo (Delta B4) — Reviewer lesen nur.

Dieser Thread hat nichts verändert: keine Datei im Repository, kein Commit, kein PR, keine Einstellung. Es gibt nichts zurückzurollen.

## Anhang A: Eigene Git-/Werkzeug-Experimente (Wegwerf-Repos, Git 2.43.0, Node 22.22.0, Vitest 5.0.3) [LOKAL]

| # | Beobachtung | Folge im Design |
|---|---|---|
| G1 | `git ls-tree -r -l -z --full-tree` liefert je Eintrag `<mode> SP <type> SP <sha> SP* <size> TAB <path> NUL`; Größe rechtsbündig (Breite ≥ 7), `-` bei `commit`; Pfade roh (Zeilenumbruch, Anführungszeichen, NFC/NFD unverändert) | Parser §6 des Entwurfs; NUL-basiert, kein Zeilenparser |
| G2 | Reiner Moduswechsel `100644 → 100755` erscheint in `git diff --raw` als `M` mit ungleichen Modi, nicht als eigener Status; Typwechsel (Datei → Symlink) als `T` | Modi aus den Listings vergleichen, nie nur den Status lesen |
| G3 | `git mv` mit `--no-renames` ist `D` + `A`; mit Standard-Einstellungen `R100` | Rename-Heuristik entfällt durch Listing-Differenz |
| G4 | Git speichert `src/café.ts` in NFC und NFD als zwei Pfade; `src/A.ts` neben `src/a.ts` ebenfalls | ASCII-Pflicht und Casefold-Kollision über den ganzen Tree |
| G5 | Symlink `120000`, Gitlink `160000`; `git archive` schreibt den Symlink real heraus; `git diff --numstat` zeigt `-` für Binärdateien | Materialisierung per `cat-file`, nie `archive`/`checkout`; Binärerkennung nicht in 0001 |
| G6 | `git replace --graft` ändert `rev-list`/`merge-base` des Klons; `GIT_NO_REPLACE_OBJECTS=1` stellt die echte Historie wieder her; Standard-Refspec holt `refs/replace/*` nicht | §4.6 |
| G7 | `git rev-parse --is-shallow-repository` erkennt Shallow-Klone; `.git/shallow` existiert | `SHALLOW_REPOSITORY` |
| G8 | Pfade mit Leerzeichen, Zeilenumbruch, `aux.test.ts`, `notes.` lassen sich committen | Pfadregeln §7 des Entwurfs |
| G9 | `npm ci --ignore-scripts` mit dem Lockfile von `main` installiert vollständig; esbuild lädt ohne Postinstall; `tsc --noEmit` Exit 0; `vitest run` 22 Dateien, 1087/1087 Tests, 125 Suites, 0 skipped/todo | Baseline-Inventar §6.2 |
| G10 | Vitest 5.0.3 kennt `--root`, `--config`, `--reporter=json --outputFile`, `--pool forks`, `--isolate`, `--passWithNoTests`, `--allowOnly`, `--testTimeout`, `--hookTimeout`, `--bail`; `--allowOnly` ist standardmäßig `!process.env.CI` | expliziter Flag-Satz §6.1 |
| G11 | `main`-Tree: 71 Einträge, alle `100644`, längster Pfad 60 Zeichen, keine Kollisionen, keine reservierten Namen; Listing 6519 Bytes, SHA-256 `7087aa36…c1f2` | Golden-Vector A-03 |
| G12 | `node --experimental-strip-types` importiert `src/forge/contract-document.ts` direkt (mit `.ts`-Imports); der Entwurf wurde damit gegen den echten Parser validiert | §13.2 |

## Anhang B: Verifizierte Doku-Aussagen (github/docs @ main, 2026-10-03) [DOKU]

1. `pull_request_target`: Workflow-Datei und Standard-Checkout stammen aus dem Default-Branch; `github.sha` ist der Head des Basis-Branchs.
2. Ein übersprungener Job meldet den Status „Success“ und blockiert den Merge nicht, auch wenn er Required Check ist (`data/reusables/actions/workflows/skipped-job-status-checks-passing.md`, `content/pull-requests/reference/status-checks.md`).
3. Required-Check-Name = Job-Name, unabhängig von Workflow-Datei, Matrix und Event; jeder mit Write kann Commit-Statuses setzen, deshalb bindet das Ruleset die Quelle an GitHub Actions.
4. Actions-Policies (Event- und Actor-Regeln, auf Workflow-Pfade eingrenzbar) sind für alle öffentlichen Repositories unabhängig vom Plan verfügbar, auf Enterprise-, Org- und Repo-Ebene; Settings → Actions → Policies; REST `/rest/actions/policies` (`actions/concepts/security/about-actions-policies.md`, `actions/how-tos/administer/control-workflow-execution.md`).
5. Ab 2026-11-02 blockiert die Default-Policy `pull_request_target` in öffentlichen Repositories; eine explizite Allow-Policy ist nötig.
6. `cache-mode` existiert als Workflow-/Job-Schlüssel (`read`, `write`, `write-only`); Trigger mit niedrigem Vertrauen wie `pull_request_target` erhalten standardmäßig nur Lesezugriff (`actions/reference/workflow-syntax.md`, `dependency-caching.md`).

## Anhang C: Spike-Stand PR #2 [API]

Draft-PR #2 von `forge-codex` (User-ID 337272506), Branch `forge/run/codex/IDENTITY-SPIKE-1`, Head `8dc692b0adc82e9dd2ccef60b6013006e700a744` (leerer Commit auf `3d7545d`). Author- und Committer-Login werden von GitHub `forge-codex` zugeordnet, allerdings über eine private E-Mail-Adresse (hier nicht wiedergegeben) → OD-1. Der **Pusher** ist über die API ohne Admin nicht sichtbar; Beleg nur über Org-Audit-Log / Repository Activity [OWNER]. Im Repository existieren 0 Workflows [API].

## Anhang D: Von diesem Thread geschriebene Dateien

- `/mnt/project-files/forge-audits/FORGE-V0.1-VERIFIER-IMPLEMENTATION-PACKAGE.md` (dieses Paket)
- `/mnt/project-files/forge-audits/FORGE-VERIFIER-0001.contract.DRAFT.md` (Entwurf, SHA-256 `7b3e93bb823628bb9057cd2cf69a578aa824f2d04614fec250cda922b04c27e0`, Content-Hash `341ec9839fb04ab01fae3b91d4e9e531295c727c0e0a37a15cac978b8b044299`)

Nichts unter `/home/claude/Forge` wurde verändert (`git status --short` leer).
