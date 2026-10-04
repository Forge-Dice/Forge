# FORGE INDEPENDENT VERIFIER DESIGN

Rolle: Principal CI/Supply-Chain Engineer · Stand: 2026-10-03 · strikt read-only (kein Commit, kein Push, kein PR, kein Workflow angelegt)

**Geprüfter Stand.** `git ls-remote` 2026-10-03 ~08:00 UTC: `main` = `f5dbc73` (nur `.gitkeep`), `codex/forge-core-v2-repair` = `b9339d2` (unverändert gegenüber Deep Audit und Red Team), keine `.github/`-Workflows im Repo (`actions_list` → 0 Workflows), kein `vitest.config.*`, kein `.gitmodules`, `package.json` mit `"test": "vitest run"` und `"typecheck": "tsc --noEmit"`, Lockfile `package-lock.json`. Das Repository ist **public** (`visibility: public`, `allow_forking: true`, Eigentümer ist ein User-Account, keine Organisation). Diese drei Fakten (public, User-Repo, Forks erlaubt) bestimmen mehrere Entscheidungen unten.

**Quellen.** `src/forge/*.ts` @ `b9339d2` (insbesondere `verification.ts`, `runs.ts`, `contract-document.ts`, `start-gate.ts`), `forge/contracts/FORGE-CORE-0001B.v2.md`, `forge/reviews/FORGE-CORE-0001B.v2.mutations.json`; die Audits `FORGE-DEEP-AUDIT.md` (§6, §7, §16, §17.4), `FORGE-DEEP-RED-TEAM.md` (DRT-IDs), `FORGE-RUN-RECOVERY.md` (§9), `FORGE-V0.1-MINIMUM-PRODUCT.md` (K5–K7, Exit 5–7). GitHub-Actions-Semantik wurde **nicht aus dem Gedächtnis**, sondern aus dem Quelltext der offiziellen Dokumentation (`github/docs`, Branch `main`, Stand 2026-10-03) verifiziert; `docs.github.com` selbst war aus dieser Umgebung nicht erreichbar, der Doku-Quelltext unter `raw.githubusercontent.com/github/docs` schon. Zitierte Dateien: `events-that-trigger-workflows.md`, `securely-using-pull_request_target.md`, `secure-use.md`, `dependency-caching.md`, `about-actions-policies.md`, `control-workflow-execution.md`, `available-rules-for-rulesets.md`, `troubleshooting-rules.md`, `troubleshooting-required-status-checks.md`, `status-checks.md`, `contexts.md`, `managing-github-actions-settings-for-a-repository.md`. Git-Verhalten (Raw-Diff-Format, Modi, `refs/replace`, Shallow, Case-Kollision) wurde in Wegwerf-Repos mit Git 2.43 nachgestellt (Anhang A).

**Abgrenzung.** Ein paralleler Thread schreibt `FORGE-V0.1-HARDENING-PLAN.md` (Kernel-Reparaturen, Reihenfolge der OPS-Tasks). Dieser Bericht entwirft nur den Verifier (Workflow, Checkout, Diff, Test-Integrität, Evidence, Mutanten, Angriffe, Spike-Kriterien) und nennt Kernel-Änderungen nur dort, wo der Verifier sie zwingend braucht.

---

## Kurzantwort

1. **Trigger: `pull_request_target`**, gehärtet, auf PRs gegen `main` beschränkt. Laut aktueller Doku wird Workflow-Datei **und** der Standard-Checkout vom **Default-Branch des Basis-Repos** genommen, nie aus dem PR. Code aus dem PR wird im Runner-Prozess **nie** ausgeführt, sondern nur als Daten gelesen (Git-Objekte) und ausschließlich in einem Docker-Container ohne Umgebungsvariablen, ohne Token und (für Tests) ohne Netz ausgeführt. `pull_request` ist unbrauchbar (Workflow-Datei aus dem Merge-Commit des PR), `workflow_run` liefert nur Behauptungen eines unprivilegierten Laufs, `workflow_dispatch`-Checks zählen laut Doku nicht als Required Check eines PR.
2. **Zwingende Begleit-Konfiguration**, ohne die der Trigger nicht sicher ist: keine Repository-Secrets (keine einzige), `GITHUB_TOKEN` restriktiv (`permissions: contents: read`), `cache-mode: none`, Actions-**Event-Policy** auf Repo-Ebene, die nur `pull_request_target` (für `.github/workflows/forge-verify.yml`) und `workflow_dispatch` (nur Owner) erlaubt und `push`/`pull_request` verbietet. Letzteres ist zugleich die Antwort auf „manipulierbare requiredChecks“: ohne Workflow-Läufe aus dem PR kann kein gleichnamiger Check entstehen. GitHub schaltet außerdem am **2026-11-02** eine Default-Policy scharf, die `pull_request_target` in public Repos blockiert; Forge braucht deshalb ohnehin eine explizite Allow-Policy.
3. **Diff-Basis** ist `merge-base(main, head)`, berechnet vom Verifier (nie vom Developer), Diff mit `--raw --no-renames -z` inklusive Modi; Contract-Commit muss Vorfahre der Basis sein; `GIT_NO_REPLACE_OBJECTS=1`, voller Fetch, Fork-PRs scheitern.
4. **Was der Verifier beweist:** Dateimenge, Modi, Pfadregeln, byte-identische Schutzdateien, Exit-Codes von `tsc` und `vitest` unter **Konfiguration aus `main`**, und dass jeder im Contract gelistete Mutant eine Assertion zum Scheitern bringt. **Was er nicht beweist:** dass Tests semantisch etwas prüfen, dass das Testinventar nicht aus dem Container heraus gefälscht wurde, dass der Container nicht ausgebrochen ist, und wer den Contract freigegeben hat (das ist der Gate-Check, nicht der Verifier).

---

## 1. Threat Model

### 1.1 Akteure und Vertrauen

| Akteur | Vertrauen | Fähigkeiten in V0.1 |
|---|---|---|
| Owner (`Wuerfelduell`, Mensch) | vertrauenswürdig, einziger Admin | ändert `main` per Merge, Rulesets, Policies, Workflows |
| Developer-Agent (Claude/Codex mit eigener GitHub-Identität, Schreibrecht) | **untrusted** | pusht beliebige Commits auf `forge/run/*`, öffnet PRs, schreibt PR-Text, kann Workflows in seinem Branch anlegen, kann Commit-Statuses per API setzen, kann `refs/replace/*` pushen, kann Forks anlegen |
| Spec-Autor-Agent | untrusted gegenüber dem Verifier (Contract-Inhalt wird vom Architektur-Reviewer bewertet, nicht vom Verifier) | pusht `forge/spec/*`, schreibt Contract inkl. `scope`, `requiredChecks`, Mutanten |
| Reviewer-Agent | untrusted gegenüber dem Verifier | GitHub-Review |
| Externe (public Repo) | untrusted, kein Schreibrecht | Fork + PR aus Fork |
| GitHub (Plattform, Hosted Runner, Actions-Backend) | vertrauenswürdig (Annahme) | führt Workflow aus `main` aus, bindet Check-Runs an SHAs, erzwingt Rulesets |
| npm-Registry | vertrauenswürdig bis auf Lockfile-Integrität (Annahme, siehe §12) | liefert Pakete per `integrity`-Hash des Lockfiles |

### 1.2 Was der Developer **nicht** bestimmen darf (Auftrag) und wo das heute scheitert

| Fakt | Heute (Kern `b9339d2`) | Beleg | Verifier-Regel |
|---|---|---|---|
| welche Dateien geändert wurden | `changedFiles` kommt vom Evidence-Lieferanten; leere Liste besteht (NRT-01/E-09) | `verification.ts:49-70` prüft nur gelieferte Pfade | Verifier berechnet Diff selbst (§5) |
| welche Tests wirklich liefen | nur `exitCode` je Command (V-11, V-12) | `verification.ts:107-111` | Konfiguration aus `main`, Inventar (§7) |
| welche Testkonfiguration gilt | `vitest.config.ts` im Scope höhlt `npm test` aus (NRT-12) | Deep Audit §7.2 V-11 | Schutzpfade byte-identisch (§6, §7) |
| ob sein Commit remote existiert | Beobachtung selbst erklärt, zeitlos (DRT-11/12) | `state.ts:202` | Verifier arbeitet nur auf `refs/pull/N/head` des kanonischen Repos (§4) |
| welche Git-Ancestry gilt | Kanten vom Developer geliefert (NRT-30), `refs/replace` täuscht ehrliche Tools (DRT-18), Merge-Commit als Contract-Commit (DRT-05) | X43, G4, X23 | Ancestry aus eigenem Fetch, `GIT_NO_REPLACE_OBJECTS=1`, Ein-Parent-Regel (§4) |

### 1.3 Bedrohungen (aus den Audits, in der Reihenfolge des Auftrags) und wo sie behandelt werden

| # | Bedrohung | Herkunft | Abschnitt |
|---|---|---|---|
| T01 | `changedFiles: []` trotz realem Diff | NRT-01, E-09 | §5, §8 |
| T02 | `vitest.config.ts` reduziert Tests | NRT-12, V-11 | §6, §7 |
| T03 | `describe.skip` / `it.skip` / `.todo` | NRT-13, V-12 | §7 |
| T04 | manipulierbare `requiredChecks` (gleichnamiger Check/Status) | Deep Audit §17.4 Punkt 3 | §2.4, §3 |
| T05 | `refs/replace` | DRT-18 | §4 |
| T06 | Shallow Clone | DRT-19 | §4 |
| T07 | Rename-Erkennung | DRT-21, V-04/V-05 | §5 |
| T08 | Symlinks (`120000`) | DRT-22, V-26, A-15 | §5, §6 |
| T09 | Submodules (`160000`, `.gitmodules`) | V-26, A-06 | §5, §6 |
| T10 | Case-Kollisionen | DRT-24 | §6 |
| T11 | Windows-reservierte Pfade, End-Punkt/Leerzeichen | DRT-25 | §6 |
| T12 | Contract-Commit mit zweitem Parent | DRT-05 | §4.5 |
| T13 | ungeprüfter Code zwischen Base und Contract | NRT-02, C-08 | §4.5 |
| T14 | falsche Diff-Basis | V-03 | §4.4, §5 |
| T15 | PR-Head ändert sich nach Verification | V-24, NRT-18 | §4.6, §2.5 |
| T16 | Developer verändert Workflow / Testconfig | A-05, A-10, NRT-22 | §2, §6, §7 |
| T17 | Fork-/Repo-Verwechslung | DRT-20 | §4.2 |
| T18 | Mutation Smoke mit trivialem Mutanten | NRT-15/16, E-05/06 | §9 |
| T19 | Secret-Exfiltration durch Testcode | A-04 | §2, §3 |
| T20 | Testcode beeinflusst Evidence im selben Job (`$GITHUB_OUTPUT`, Runner-Temp) | A-24 | §3, §7.4 |
| T21 | Lifecycle-Scripts bei `npm ci` | A-23 | §7.2 |
| T22 | Cache Poisoning | Doku `secure-use.md` | §2.3 |
| T23 | undarstellbare Pfade hängen den Run auf | NRT-09, V-25 | §6 |
| T24 | Riesen-Diff, Riesen-Report | A-14 | §6, §8 |

### 1.4 Sicherheitsziel des Verifiers (präzise)

Für ein Paar `(B, H)` mit `B = merge-base(main, H)`, `H` = PR-Head, berechnet der Verifier **deterministisch aus Git-Objekten des kanonischen Repos und aus Dateien, die an `main` (bzw. `B`) liegen,** ein Urteil `passed | failed(codes)` und eine Evidence, so dass gilt: Ein Developer, der nur `H` kontrolliert (plus beliebige weitere Refs, Forks, PR-Texte, API-Statuses, eigene Workflows in seinem Branch), kann **weder** das Urteil **noch** die Evidence beeinflussen, außer über den Inhalt der Dateien, die der Contract ihm freigibt, und innerhalb dieser Dateien nur so, wie §12 es als nicht beweisbar ausweist.

---

## 2. GitHub Actions Trigger Decision

### 2.1 Verifizierte Semantik der vier Trigger

Quelle: `content/actions/reference/workflows-and-actions/events-that-trigger-workflows.md` und `content/actions/reference/security/securely-using-pull_request_target.md` (github/docs, 2026-10-03). Spalte „Workflow-Revision“ = aus welchem Commit die Workflow-Datei gelesen wird.

| Trigger | Workflow-Revision | `GITHUB_SHA` / `GITHUB_REF` | Token / Secrets | Zitat (gekürzt) | Für den Verifier |
|---|---|---|---|---|---|
| `pull_request` | **Merge-Commit des PR** (`refs/pull/N/merge`), also vom PR kontrolliert | letzter Merge-Commit auf dem Merge-Branch / `refs/pull/N/merge` | bei Fork-PRs read-only Token, keine Secrets; bei Same-Repo-PRs Repo-Default (konfigurierbar) | „`pull_request` … is unusual: it runs the workflow file from the **merge commit of the pull request**.“ | **ungeeignet**: der Prüfling definiert die Prüfung |
| `pull_request_target` | **Default-Branch des Basis-Repos** (bei github.com; auf älteren GHES der Base-Branch) | letzter Commit auf dem Default-Branch / Default-Branch (Reusable `ref-description` sagt „base branch“; für PRs gegen `main` identisch) | Basis-Repo-`GITHUB_TOKEN` mit den Rechten laut `permissions:`, Zugriff auf Secrets | „the workflow, and any subsequent `actions/checkout` call that does not specify a `ref`, is taken from the **base repository's default branch**, not from the pull request.“ · Warnung: „Workflows that use these triggers must not explicitly check out untrusted code … **You must ensure the checked-out code is only ever inspected as data and never executed**.“ | **gewählt**, unter den Bedingungen in §2.3 |
| `workflow_run` | Default-Branch | letzter Commit auf Default-Branch / Default-Branch | volle Secrets und Write-Token („able to access secrets and write tokens, even if the previous workflow was not“) | „A `workflow_run` workflow should treat artifacts uploaded by other workflows as untrusted data, since their contents can come from a fork.“ | **ungeeignet als Verifier**: das Testergebnis eines vorgelagerten `pull_request`-Laufs ist eine Behauptung des Prüflings (er definiert den Lauf). Brauchbar nur für Status-Projektion ohne Prüfling-Code |
| `workflow_dispatch` | der Ref, gegen den dispatcht wird (Button nur, wenn Datei auf Default-Branch; per API gegen jeden Branch) | letzter Commit des gewählten Ref / dieser Ref | Secrets und Token wie bei `push` | `troubleshooting-required-status-checks.md`: „if a workflow is triggered by `workflow_dispatch` on a pull request's head branch, checks reported by its jobs do not appear in the pull request's checks section … they do not satisfy a required status check in a branch ruleset.“ | **ungeeignet als Required Check**; brauchbar als Owner-Re-Check/Status-Lauf mit `ref: main`, wenn der Lauf das Ergebnis per Checks-API als eigenen Check-Run schreibt (im Spike zu prüfen, ob ein per API erzeugter Check-Run der `github-actions`-App als Required Check zählt) |

Weitere verifizierte Tatsachen, die die Entscheidung tragen:

- **Cache.** „workflows triggered by `pull_request_target` have read-only access to the cache in the default branch's scope … cannot create or overwrite them“ (`securely-using-pull_request_target.md`, `dependency-caching.md`). Damit ist Cache Poisoning durch `pull_request_target` plattformseitig entschärft; der Verifier setzt zusätzlich `cache-mode: none` und benutzt keinen Cache.
- **`actions/checkout`-Schutz.** Das Auschecken eines Fork-PR-Heads unter `pull_request_target` erfordert jetzt explizit `allow-unsafe-pr-checkout: true`; „This protection only covers fork pull request refs.“ Forge setzt dieses Flag **nicht** und lehnt Fork-PRs ohnehin ab (§4.2).
- **Default-Policy ab 2026-11-02.** „GitHub has added a default policy that will block the `pull_request_target` event in public repositories. This policy will be enforced on November 2, 2026.“ Da Forge public ist, muss eine explizite Actions-Event-Policy `pull_request_target` für den Verifier-Workflow erlauben, sonst läuft er ab November nicht mehr.
- **Required Checks und Trigger.** Checks aus Workflow-Jobs zählen für einen PR nur bei `push`, `pull_request`, `pull_request_review`, `pull_request_target`, `deployment`, `deployment_status` (`troubleshooting-required-status-checks.md`). `pull_request_target` ist also für den Required Check zulässig.
- **Namensregel.** „Required status checks do not take workflow, matrix, or event trigger types into account“ (`troubleshooting-rules.md`); der Name ist `<job name>`. Jeder Workflow, der einen gleichnamigen Job erzeugt, bedient denselben Required Check (§2.4).
- **Quelle binden.** Im Ruleset kann als Quelle des Required Check eine App gewählt werden („If the status is set by any other person or integration, merging won't be allowed“). Damit zählen per API gesetzte Commit-Statuses von Agenten nicht; und: „If a check and a commit status have the same name, both must pass.“
- **Ruleset-Workflows („Require workflows to pass before merging“)**, die eine Workflow-Datei an einem festen Ref erzwingen würden, sind laut Doku **nur auf Organisations- oder Enterprise-Ebene** konfigurierbar („Ruleset workflows can be configured at the organization or enterprise level“). Für das User-Repo `Wuerfelduell/Forge` nicht verfügbar; siehe Fallback in §2.4.

### 2.2 Entscheidung

**`pull_request_target`, eingeschränkt auf `branches: [main]` und `types: [opened, synchronize, reopened]`, mit Workflow-Datei und allen Prüfwerkzeugen aus `main`, PR-Inhalt nur als Daten im Runner, Ausführung von PR-Code ausschließlich in einem Container ohne Umgebung.** Keine der drei Alternativen erfüllt die Kernfrage („Sicherheitslogik aus `main`, nicht aus dem PR“) **und** liefert einen Required Check am PR-Head:

- `pull_request`: Logik aus dem PR. Fällt weg.
- `workflow_run`: Logik aus `main`, aber alles, was über den PR bekannt ist, kommt als Artefakt aus einem Lauf, dessen Definition der PR bestimmt. Das ist genau die „Agentenbehauptung“, die der Auftrag verbietet. Fällt weg.
- `workflow_dispatch`: Logik aus `main`, aber kein automatischer Lauf je Push, Checks zählen nicht als Required Check, und der Dispatcher wählt den Ref. Bleibt als Owner-Werkzeug (Re-Check, Status), nicht als Gate.

Die Bequemlichkeits-Variante („`pull_request` reicht, wir prüfen ja Schutzpfade“) wird ausdrücklich **nicht** empfohlen: Wenn der PR die Workflow-Datei löscht oder ersetzt, läuft unter `pull_request` schlicht eine andere Prüfung oder gar keine.

### 2.3 Bedingungen, unter denen `pull_request_target` sicher ist (alle zwingend)

| # | Bedingung | Warum | Nachweis im Spike |
|---|---|---|---|
| C1 | **Keine Repository-Secrets.** Nicht nur „nicht referenziert“: es existieren keine. | Secrets des Repos sind jedem Workflow auf jedem Branch zugänglich, auch einem `push`-Workflow des Developers in seinem Branch (solange Event-Policies das nicht verbieten). | Settings → Secrets leer; Workflow referenziert `secrets.*` nirgends |
| C2 | `permissions: contents: read` auf Workflow-Ebene; keine Job-Erhöhung. Repo-Default „restricted“ (nur `contents`/`packages` read, laut Doku Default für neue User-Repos). | Token darf nichts schreiben, falls er doch in untrusted Kontext gerät. | Workflow-Datei; Settings → Actions → Workflow permissions |
| C3 | `persist-credentials: false` bei jedem `actions/checkout`; Token taucht in keiner `.git/config` auf. | Container bekommt Mounts des Checkouts; eine persistierte Credential wäre lesbar. | `git config --list` im Job zeigt keinen `extraheader` |
| C4 | **PR-Code läuft nie im Runner-Prozess.** Nur `git`-Objektoperationen (`cat-file`, `diff --raw`, `ls-tree`, `rev-list`, `merge-base`) und Vergleiche in trusted Code aus `main`. `npm ci`, `tsc`, `vitest` laufen in `docker run` mit `--env-file /dev/null`, nicht-root, `--cap-drop ALL`, `--security-opt no-new-privileges`, `--pids-limit`, `--memory`, `--cpus`, `--read-only` plus `tmpfs`, und für Tests `--network none`. | Deckt T19, T20, A-24; Runner-Dateien (`_temp`, `GITHUB_OUTPUT`, Runtime-Token) sind im Container nicht vorhanden. | Negativtest: ein Test, der `process.env` und `/proc/1/environ` ausgibt, sieht keinen Token |
| C5 | `cache-mode: none`; keine `actions/cache`, kein `setup-node` mit `cache:`. | T22 | Workflow-Datei |
| C6 | Alle `uses:` auf **volle Commit-SHAs** gepinnt; Docker-Image per **Digest** (`node:22.x.y-bookworm-slim@sha256:…`). | Supply Chain des Verifiers selbst. | Workflow-Datei; `docker inspect` |
| C7 | **Actions-Event-Policy (Repo-Ebene):** Workflow-Pfad `.github/workflows/forge-verify.yml` → erlaubtes Event nur `pull_request_target`; alle anderen Workflow-Pfade → kein Event erlaubt (bzw. `workflow_dispatch` nur für Actor `Wuerfelduell`). Keine `push`-, keine `pull_request`-Läufe im Repo. | (a) erfüllt die Default-Policy ab 2026-11-02 per expliziter Allow-Regel; (b) kein Workflow aus einem Developer-Branch läuft → keine gleichnamigen Checks (T04), kein Token in untrusted Workflows, keine Secrets-Frage. Doku: „Event rules control which events are permitted, such as `push`, `pull_request`, `pull_request_target`, and `workflow_dispatch`“; „Actions policies are available at the enterprise, organization, and repository levels.“ | Spike-Punkt S1: Policies-Tab unter Settings → Actions im User-Repo sichtbar und `push`-Workflow aus Developer-Branch wird mit „Event 'push' is not allowed“ abgewiesen |
| C8 | Ruleset `main`: Required Check `forge-verify` mit **Quelle GitHub Actions**, „Require branches to be up to date“ (strict), PR Pflicht, „Dismiss stale approvals“, „Require approval of the most recent reviewable push“, Force-Push und Löschen blockiert, lineare Historie (nur Squash/Rebase). Ruleset `forge/run/**` und `forge/spec/**`: Force-Push und Löschen blockiert. | T04 (Statuses zählen nicht), T15, DRT-05 (Ein-Parent-Commits auf `main`). | Settings → Rules |
| C9 | **Fork-PRs scheitern** im Verifier (§4.2) und Setting „Fork pull request workflows: require approval for all external contributors“. | T17, DRT-20. | Negativtest mit Fork |
| C10 | `concurrency: forge-verify-${{ github.event.pull_request.number }}`, `cancel-in-progress: true`; `timeout-minutes` auf Job- und Container-Ebene. | Check-Runs sind pro SHA; ein abgebrochener Lauf für einen überholten Head ist korrekt. | Workflow-Datei |

### 2.4 Das Problem „gleichnamiger Check“ (T04) und seine Lösung

Fakten: Ein Required Check ist ein **Name**. Jeder Workflow-Job mit diesem Namen aus einem zulässigen Event (`push`, `pull_request`, …) erzeugt einen Check-Run dieses Namens an dem SHA. Die Doku sagt nicht, welcher von zwei gleichnamigen Check-Runs am selben SHA zählt; fail-closed ist anzunehmen, dass ein Developer mit einem eigenen `on: push`-Workflow in seinem Branch (`jobs: forge-verify: run: true`) einen **grünen** `forge-verify` am Head erzeugt, zeitlich nach dem roten aus `main`. Ohne Gegenmaßnahme ist der Required Check wertlos.

Lösung in der Reihenfolge der Präferenz:

1. **Actions-Event-Policy (C7)**: `push` und `pull_request` sind im Repo nicht erlaubt → ein Developer-Workflow läuft nie. Zusätzlich verhindert C8 (Quelle = GitHub Actions), dass Commit-Statuses per API zählen. Dies ist die einzige Lösung, die die Kollision an der Wurzel ausschließt.
2. **Fallback, falls Policies im User-Repo nicht verfügbar sind:** Push-Rule „Restrict file paths: `.github/**`“ (Bypass nur Owner), so dass kein Branch außer über den Owner Workflow-Dateien tragen kann. Verfügbarkeit von Push-Rulesets für User-Repos im Spike prüfen.
3. **Letzter Fallback:** Repo in eine (kostenlose) Organisation übertragen; dort stehen Organisations-Rulesets mit „Require workflows to pass“ zur Verfügung, die die Workflow-Datei an einem festen Ref erzwingen.

In jedem Fall schreibt der Verifier **am Ende** des Laufs eine Zeile in die Evidence, die alle Check-Runs am Head-SHA mit dem Namen `forge-verify` zählt (API `GET /commits/{sha}/check-runs?check_name=forge-verify`, Token `checks: read`), und markiert `duplicateCheckRuns > 1` als `failed(CHECK_NAME_COLLISION)`. Das ist Erkennung, keine Verhinderung (ein späterer Lauf kann noch kommen), deshalb ist Punkt 1 oder 2 Pflicht.

### 2.5 Warum der PR-Head nach der Verifikation nicht „weiterwandern“ kann

Check-Runs gehören zu einem SHA; „Required checks must pass on the latest commit SHA. Checks from earlier commits don't satisfy the requirement.“ Ein neuer Push erzeugt einen neuen Head ohne Check → nicht mergebar bis `forge-verify` auf dem neuen Head grün ist; „Require approval of the most recent reviewable push“ verwirft zugleich das Code-Review. Der Merge selbst muss mit Squash (lineare Historie) und „up to date“ erfolgen; dann ist der Tree des Squash-Commits auf `main` identisch mit dem verifizierten Head-Tree (`head.tree` in der Evidence, §8), was eine nachträgliche Prüfung „`main` trägt einen verifizierten Tree“ erlaubt.

---

## 3. Trusted/Untrusted Boundary

```text
 TRUSTED (aus main @ github.sha, Workflow-Datei inklusive)          UNTRUSTED (PR-Head H und alles, was der Developer kontrolliert)
 ───────────────────────────────────────────────────────────         ───────────────────────────────────────────────────────────────
 .github/workflows/forge-verify.yml                                   Dateien unter H (alle), Commit-Metadaten, Branch-Name (nur Selektor)
 forge/verifier/*  (Node-CLI: Diff, Pfadregeln, Inventar, Evidence)   PR-Titel/-Body, Developer-Report, Read-Quittung
 forge/verifier/vitest.verifier.config.mts                            Kommentare, Reviews (für den Verifier irrelevant)
 forge/policy.json (Schutzpfade, Check-Allowlist, Limits)             Commit-Statuses per API, eigene Workflows im Branch (durch C7 tot)
 src/forge/** (Parser, evaluateVerification)                          refs/replace/*, weitere Refs, Forks
 forge/contracts/<TASK>.md **gelesen an B** (= main-Stand)            Artefakte, Caches (nicht benutzt)
 node_modules aus package-lock.json **an B** (= byte-identisch zu H, erzwungen)
 Docker-Image per Digest, Node-Version per Image
```

Grenzübergänge, exakt:

| Übergang | Richtung | Form | Regel |
|---|---|---|---|
| Git-Objekte von H in den Runner | untrusted → trusted | `git fetch` (Objekte), `git cat-file`, `git diff --raw`, `git ls-tree` | nur Objektoperationen; **kein** `git checkout` von H, bevor §5/§6 vollständig bestanden sind; kein Lesen von H-Dateien über das Dateisystem (nur `git show H:<path>`) |
| Arbeitsbaum von H in den Container | trusted → untrusted | `git archive H \| tar -x` in ein frisches Verzeichnis (keine Symlinks mehr möglich, weil §5 sie vorher ablehnt), Bind-Mount nach `/work` | Container ohne Env, ohne Token, nicht-root |
| Testergebnis aus dem Container | untrusted → trusted | **Exit-Code** von `docker run` (autoritativ) und JSON-Report aus `/out` (nur Inventar, nicht autoritativ, §7.4) | Exit-Code entscheidet pass/fail; Inventar nur für Zusatzregeln, deren Fälschbarkeit §12 benennt |
| Evidence nach GitHub | trusted → GitHub | Job Summary, Artefakt, Check-Conclusion | wird vom trusted Job geschrieben, nie aus dem Container |

Was **nicht** zur Vertrauensbasis gehört: `github.event.pull_request.*` ist Plattform-Metadatum (vertrauenswürdig als Beschreibung des PR), aber `head.sha`, `head.ref`, `title`, `body` werden nur als **Selektoren und Bindungswerte** benutzt, nie als Tatsachenbehauptung über Inhalt. Der Branch-Name wählt den Task (`forge/run/<TASKID>-<n>`), bestimmt aber nichts am Urteil außer, **gegen welchen** auf `main` liegenden Contract geprüft wird; die Evidence nennt diesen Contract mit Blob-SHA und Content-Hash.

---

## 4. Checkout Algorithm

Alle Schritte laufen im trusted Job, mit `env: GIT_NO_REPLACE_OBJECTS=1 GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 GIT_TERMINAL_PROMPT=0` auf Workflow-Ebene. Jeder Fehlschlag ist `failed(<CODE>)` mit Evidence, nie ein Hängen.

### 4.1 Repository

- `REPO_ID = github.repository_id` (numerisch, unveränderlich; `github.repository` kann durch Umbenennung wechseln). Beides in die Evidence.
- `HEAD_SHA = github.event.pull_request.head.sha`, `PR = github.event.pull_request.number`, `BASE_REF = github.event.pull_request.base.ref` (muss `main` sein, sonst `failed(BASE_NOT_MAIN)`; der `branches:`-Filter verhindert den Lauf ohnehin).
- `MAIN_SHA = github.sha` (bei `pull_request_target` der letzte Commit des Default-Branch zum Zeitpunkt des Events).

### 4.2 Fork-Ausschluss (T17, DRT-20)

`github.event.pull_request.head.repo.id != REPO_ID` oder `head.repo.fork == true` → `failed(FORK_PR_NOT_SUPPORTED)` **vor jedem Fetch**. Begründung: Fork-Objekte sind im Fork-Netzwerk per nacktem SHA über das Upstream-Repo abrufbar; nur Refs des kanonischen Repos sind eine verlässliche Aussage „liegt in `Wuerfelduell/Forge`“. Agenten pushen in V0.1 ausschließlich auf `forge/run/*` im kanonischen Repo. Zusätzlich greift der `actions/checkout`-Schutz, weil `allow-unsafe-pr-checkout` nicht gesetzt ist.

### 4.3 Fetch (exakt)

```bash
# Schritt A: trusted Checkout von main (Werkzeuge). actions/checkout@<SHA>:
#   ref: ${{ github.sha }}   fetch-depth: 0   persist-credentials: false   path: trusted
# (Standardrefspec +refs/heads/*:refs/remotes/origin/*, holt niemals refs/replace/*; Anhang A, G-Exp. 4)

# Schritt B: PR-Head ins selbe Objekt-Repo holen, ausschließlich über den PR-Ref des kanonischen Repos:
cd trusted
git fetch --no-tags --no-recurse-submodules origin \
  "+refs/pull/${PR}/head:refs/forge/pr-head" \
  "+refs/heads/main:refs/forge/main"
# Token: für ein public Repo kein Token nötig. Falls privat: Token nur für diesen einen Befehl via
#   git -c http.https://github.com/.extraheader="AUTHORIZATION: basic <b64(x-access-token:TOKEN)>" fetch …
# und niemals in die Konfiguration schreiben.

# Schritt C: Bindungen prüfen
test "$(git rev-parse refs/forge/pr-head)" = "$HEAD_SHA"      || fail HEAD_MOVED          # PR-Ref zeigt nicht mehr auf das Event-Head
test "$(git rev-parse refs/forge/main)"    = "$MAIN_SHA"      || fail MAIN_MOVED          # main hat sich seit dem Event bewegt (neuer Lauf kommt via "up to date"); fail-closed
test "$(git rev-parse --is-shallow-repository)" = false       || fail SHALLOW_REPOSITORY  # T06, DRT-19
test -z "$(git for-each-ref refs/replace/)"                   || fail LOCAL_REPLACE_REFS  # darf nie vorkommen
test -z "$(git ls-remote origin 'refs/replace/*')"            || fail REMOTE_REPLACE_REFS # T05, DRT-18: jemand hat Replace-Refs gepusht
git cat-file -e "${HEAD_SHA}^{commit}"                        || fail HEAD_NOT_A_COMMIT
git fsck --connectivity-only --no-dangling refs/forge/pr-head || fail OBJECTS_INCOMPLETE
```

Welche Refs der Verifier **überhaupt** kennt: `refs/remotes/origin/*` (von actions/checkout), `refs/forge/main`, `refs/forge/pr-head`. Keine Tags, keine `refs/replace/*`, keine `refs/pull/*/merge` (der Merge-Ref ist ein von GitHub berechneter Vorschlag; der Verifier prüft **den Head**, nicht einen simulierten Merge; die Aktualitätsregel „up to date“ sorgt dafür, dass Head und Merge-Ergebnis denselben Tree haben).

### 4.4 Diff-Basis

```bash
B=$(git merge-base --all refs/forge/main refs/forge/pr-head)
[ "$(printf '%s\n' "$B" | wc -l)" = 1 ]                       || fail AMBIGUOUS_MERGE_BASE   # criss-cross: fail-closed
git merge-base --is-ancestor "$B" refs/forge/main             || fail BASE_NOT_ON_MAIN
```

`B` ist die **einzige** Diff-Basis. Sie wird nicht aus dem Contract, nicht aus dem PR-Text, nicht aus dem Developer-Report genommen. Bei erzwungenem „up to date“ gilt zum Merge-Zeitpunkt `B == MAIN_SHA`; vorher kann `B` älter sein, was korrekt ist, weil dann genau die Änderungen des PR gegenüber dem gemeinsamen Vorfahren gemessen werden (das ist auch der Diff, den GitHub im PR zeigt). Ein „evil merge“ (Developer merged `main` in seinen Branch und schmuggelt dabei Änderungen ein) ist in `diff(B, H)` sichtbar, weil die Schmuggelware nicht in `main` liegt.

### 4.5 Contract-Bindung und Ancestry-Regeln (T12, T13)

```bash
TASK=$(echo "$HEAD_REF" | sed -nE 's#^forge/run/([A-Z][A-Z0-9]*(-[A-Z0-9]+)+)-[0-9]+$#\1#p'); [ -n "$TASK" ] || fail NOT_A_RUN_BRANCH
CPATH="forge/contracts/${TASK}.md"
git cat-file -e "${B}:${CPATH}"                               || fail CONTRACT_MISSING_AT_BASE
CBLOB=$(git rev-parse "${B}:${CPATH}")
# Contract-Commit C = jüngster first-parent-Commit auf main bis B, der CPATH geändert hat
C=$(git log -1 --first-parent --format=%H "$B" -- "$CPATH")
[ "$(git rev-parse "${C}:${CPATH}")" = "$CBLOB" ]              || fail CONTRACT_HISTORY_INCONSISTENT
[ "$(git rev-list --parents -n1 "$C" | wc -w)" = 2 ]           || fail CONTRACT_COMMIT_NOT_LINEAR   # genau ein Parent (DRT-05: nicht "base ist ein Parent", sondern "genau ein Parent")
[ "$(git diff --raw --no-renames -z "${C}^" "$C" | tr '\0' '\n' | grep -c '^:')" = 1 ] \
  && git diff --raw --no-renames -z "${C}^" "$C" | tr '\0' '\n' | grep -qx "$CPATH" \
                                                              || fail CONTRACT_COMMIT_NOT_ISOLATED  # der Contract-Commit ändert nur die Contract-Datei
git merge-base --is-ancestor "$C" "$B"                        || fail CONTRACT_NOT_IN_BASE
```

Der Contract-Text wird mit `git cat-file blob "$CBLOB"` als **Bytes** gelesen, mit `TextDecoder("utf-8", { fatal: true })` dekodiert (ungültiges UTF-8 → `failed(CONTRACT_NOT_UTF8)`, DRT-27) und mit `parseContractDocument` aus **trusted** `src/forge` geparst. `baseCommit` aus dem Frontmatter wird geprüft: `baseCommit ⊑ C^` (Vorfahre-oder-gleich des Parents von C), sonst `failed(CONTRACT_BASE_INVALID)`. Die eigentliche Prüfung „zwischen `baseCommit` und `C` liegt kein ungeprüfter Code“ ist auf `main` konstruktiv erfüllt: alles auf `main` kam per PR mit Required Check hinein (C8), und C ist ein Ein-Parent-Commit, der nur die Contract-Datei enthält. Semantische Staleness (`main` hat sich zwischen `baseCommit` und `C` im Scope bewegt) ist Sache des Contract-PR-Checks `forge-contract` (gleicher Workflow, anderer Job, hier nicht entworfen): `diff --raw baseCommit..mainTip` ∩ `scope` = ∅.

### 4.6 Bindung des Heads

Die Evidence trägt `head.sha`, `head.tree = git rev-parse H^{tree}`, `base.sha = B`, `main.sha = MAIN_SHA`. Der Check-Run hängt an `HEAD_SHA`. Bewegt sich der Branch, ist der neue Head ohne Check (§2.5). Bewegt sich `main`, erzwingt „up to date“ ein Update des Branches, also neuen Head, also neuen Lauf mit neuem `B`.

### 4.7 Arbeitsbaum für den Container

Erst **nach** bestandenem §5 und §6:

```bash
mkdir -p "$RUNNER_TEMP/work" && git archive --format=tar "$HEAD_SHA" | tar -x -C "$RUNNER_TEMP/work"
```

`git archive` materialisiert Blobs; Symlinks und Gitlinks wären als Modi vorher abgelehnt worden. Kein `.git`-Verzeichnis im Arbeitsbaum. Das Verzeichnis gehört dem Container-User (`chown 1000:1000`).

---

## 5. Diff Algorithm

### 5.1 Befehl (deterministisch)

```bash
git -c core.quotePath=false -c diff.renames=false \
  diff --raw --no-renames --no-color --no-ext-diff --no-textconv -z --abbrev=40 "$B" "$HEAD_SHA" > diff.raw
```

Eigenschaften, in Anhang A nachgestellt:

- `--raw -z`: je Eintrag `:<oldmode> <newmode> <oldsha> <newsha> <status>\0<path>\0`; Pfad roh (Bytes), keine Quoting-Ambiguität.
- `--no-renames` (und Config `diff.renames=false` als Gürtel): Status-Menge ist `A`, `D`, `M`, `T` (Typwechsel); `R`/`C` kommen nicht vor. Das Urteil hängt damit nicht mehr von Rename-Schwellen ab (DRT-21/F8). `U`, `X`, `B` dürfen bei zwei Commit-Trees nicht auftreten → `failed(DIFF_UNEXPECTED_STATUS)`.
- `--abbrev=40`: volle Blob-SHAs für die Evidence.
- Keine Content-Diffs; das Ergebnis hängt nicht vom Diff-Algorithmus ab.

### 5.2 Verarbeitung (Reihenfolge ist Teil der Spezifikation)

1. **Parsen** mit einem NUL-basierten Parser (kein `split("\n")`). Jeder Eintrag: `{oldMode, newMode, oldBlob, newBlob, status, pathBytes}`.
2. **Limits**: `entries.length > policy.maxChangedFiles` (Vorschlag 200) → `failed(DIFF_TOO_LARGE)`; `diff.raw` > 1 MiB → ebenso. (T24)
3. **Pfad-Darstellbarkeit**: `pathBytes` muss gültiges UTF-8 und dann dem `RepoPathSchema` (`^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$`, keine `.`/`..`-Segmente, ≤ 255) genügen → sonst `failed(PATH_NOT_REPRESENTABLE, <hex>)`. Fail statt Hängen (NRT-09, V-25).
4. **Modi** (vor allem anderen, weil danach ausgecheckt wird): erlaubt ist ausschließlich `100644` für `newMode` bei `A`/`M` und für `oldMode` bei `D`/`M`. `120000` (Symlink), `160000` (Gitlink/Submodule), `100755` (ausführbar) und Status `T` → `failed(MODE_FORBIDDEN, path)`. Ein Contract kann in V0.1 **keine** Ausnahme erteilen (kein Feld dafür; Deep Audit §7.4 schlug `protectedPathOverrides` vor, hier bewusst nicht).
5. **Sortierung** nach `pathBytes` (Byte-Vergleich). Determinismus der Evidence.
6. **Abbildung** auf den Kern: `A → added`, `M → modified`, `D → deleted`; `T` ist bereits ausgeschlossen. Die Liste wird `evaluateVerification(metadata, report=∅, evidence)` aus **trusted** `src/forge` übergeben (Scope, immer verbotene Präfixe, Löschverbot). Zusätzlich die Regeln aus §6, die der Kern heute nicht kennt.
7. **Tree-Regeln** (nicht nur Diff): §6.3 prüft den gesamten Head-Tree, weil Kollisionen und `.gitmodules` auch dort relevant sind, wo der Diff nichts zeigt.

### 5.3 Was „Rename“ in V0.1 bedeutet

Ein Rename ist `D` + `A`. `D` ist nach Kernregel immer eine Verletzung (v2: „Deleted files are always violations“). Folge: **Verschiebungen sind in V0.1 nicht erlaubt**, auch nicht innerhalb des Scopes (X09_scopeRename). Das ist eine bewusste Einschränkung, keine Lücke; sie entfernt DRT-21 vollständig. Braucht ein Task einen Rename, muss der Contract das als `delete`+`create` mit Begründung tragen, was eine Kern-Erweiterung voraussetzt (Löschliste im Scope). Für die ersten Tasks (TASK-0006) wird kein Rename erwartet.

### 5.4 Coordination-Ausnahme

Der Kern lässt `forge/coordination/**` ohne Scope zu (`PROCESS_NOTE_PREFIX`). V0.1 (M13) schafft Koordinationsdateien im Produktpfad ab. Der Verifier behandelt deshalb `forge/coordination/**` **nicht** als Ausnahme, sondern wie jeden anderen Pfad; bis der Kern angepasst ist, prüft der Verifier dies vor dem Kern-Aufruf (Regel P-07 in §6). Eine ausführbare Datei unter Coordination (NRT-10) kann so nicht entstehen; `.md` dort ist nur erlaubt, wenn der Contract sie im Scope führt.

---

## 6. Path/File-Mode Rules

Alle Regeln gelten **zusätzlich** zu `evaluateVerification`. Jede Verletzung ist `failed(<CODE>, <path>)`; mehrere Verletzungen werden gesammelt und sortiert gemeldet. Vergleich „casefold“ = Unicode-Casefold nach NFC-Normalisierung (Pfade sind nach §5.2 Schritt 3 ohnehin ASCII, der Vergleich ist dann `toLowerCase`).

### 6.1 Immer geschützte Pfade (byte-identisch zu `B`, unabhängig vom Contract)

Liste in `forge/policy.json` auf `main` (Owner-only); V0.1-Vorschlag:

```text
.github/**                 .gitattributes   .gitmodules   .gitignore   .npmrc   .nvmrc   .node-version
package.json   package-lock.json   npm-shrinkwrap.json   yarn.lock   pnpm-lock.yaml
tsconfig.json  tsconfig.*.json   jsconfig*.json
vitest.config.*   vite.config.*   vitest.workspace.*   vitest.projects.*   **/vitest.config.*   **/vite.config.*
forge/policy.json   forge/contracts/**   forge/approvals/**   forge/roles/**   forge/verifier/**
CODEOWNERS   .github/CODEOWNERS   docs/CODEOWNERS
```

Regel P-01: Jeder Diff-Eintrag, dessen Pfad casefold auf eines dieser Muster passt → `PROTECTED_PATH_CHANGED`. Regel P-02: Für die Einzeldateien (`package.json`, Lockfile, `tsconfig.json`, `.npmrc`, `.gitattributes`) wird zusätzlich **Blob-Gleichheit** `git rev-parse B:<p>` == `git rev-parse H:<p>` geprüft (auch ohne Diff-Eintrag; Redundanz gegen Parser-Fehler). Regel P-03: Zusätzlich für Forge-Kern-Pfade `src/forge/**`, `tests/forge/**`, `tests/forge-red-team/**`: nur erlaubt, wenn `policy.json` den Task-ID-Präfix `FORGE-` dafür freigibt (A-25).

### 6.2 Pfadform (DRT-23, DRT-25, A-16..A-19)

- P-04 **Alias geschützter Präfixe**: Pfad casefold beginnt mit einem geschützten Präfix (`forge/contracts/`, `forge/approvals/`, `.github/` …), auch wenn der exakte String abweicht (`forge/Contracts/`, `Forge/contracts/`) → `PROTECTED_PATH_ALIAS`. Auch im **Contract-Scope** selbst: Scope-Einträge, die casefold einen geschützten Präfix treffen, machen den Contract ungültig (`CONTRACT_SCOPE_PROTECTED`); dies gehört in den Contract-PR-Check, der Run-Verifier prüft es defensiv noch einmal.
- P-05 **Windows/portable Segmente**: Segment casefold ∈ {`con`, `prn`, `aux`, `nul`, `com1`..`com9`, `lpt1`..`lpt9`} oder mit Suffix `.*` davon (`aux.ts`), Segment endet mit `.` oder Leerzeichen, Segment enthält `<>:"|?*`, Steuerzeichen, Backslash → `PATH_NOT_PORTABLE`. Segment `.git` (casefold) irgendwo → `PATH_GIT_RESERVED`. Pfadlänge > 255 oder Segment > 128 → `PATH_TOO_LONG`.
- P-06 **Case-Kollision (gesamter Head-Tree)**: `git ls-tree -r -z --name-only H`; zwei Pfade mit gleichem casefold → `CASE_COLLISION` (beide Pfade). Gilt für den ganzen Tree, nicht nur den Diff, damit auch eine bereits auf `main` vorhandene Kollision (Baseline-Hygiene) sichtbar wird; Anhang A, G-Exp. 3 zeigt, dass Git beide Dateien speichert.
- P-07 **Coordination**: `forge/coordination/**` ohne Scope-Eintrag → `SCOPE_VIOLATION` (siehe §5.4).

### 6.3 Tree-Regeln (gesamter Head-Tree)

- P-08 `git ls-tree -r H` enthält irgendeinen Eintrag mit Modus `120000`, `160000` oder `100755` → `TREE_MODE_FORBIDDEN`. Auch `.gitmodules` im Tree → `SUBMODULES_FORBIDDEN`. Begründung: ein bereits auf `main` liegender Symlink wäre durch den Diff unsichtbar, aber im Container wirksam.
- P-09 `node_modules/` oder `.git/` als Tree-Pfad → `TREE_PATH_FORBIDDEN`.
- P-10 Dateigröße eines geänderten Blobs > `policy.maxBlobBytes` (Vorschlag 2 MiB) → `BLOB_TOO_LARGE`; Binärerkennung (`git diff --numstat` liefert `-`) für geänderte Pfade außerhalb einer `policy.binaryAllow`-Liste → `BINARY_NOT_ALLOWED` (A-22).

### 6.4 Scope (Kern) nach allen obigen Regeln

`evaluateVerification` prüft `added` ∈ `scope.create`, `modified` ∈ `scope.modify`, kein `deleted`, keine Änderung unter `forge/contracts/`/`forge/approvals/`. Der Verifier ruft ihn mit `report.mutations = []` und `evidence.mutations = <eigene Liste>` auf (§9), so dass niemals Developer-Mutationen „effektiv“ werden (`effectiveMutations` nimmt Verifier-Mutationen, wenn vorhanden).

---

## 7. Test Integrity

### 7.1 Ziel und Grenze

Ziel: Der Exit-Code der Required Checks sagt etwas über **den Code in H unter der Test- und Typkonfiguration von `main`** aus. Nicht Ziel: beweisen, dass die Tests inhaltlich gut sind.

### 7.2 Ausführung (exakt)

```bash
IMG="node:22.<x>.<y>-bookworm-slim@sha256:<digest>"      # aus forge/policy.json, trusted
W="$RUNNER_TEMP/work"; OUT="$RUNNER_TEMP/out"; T="$GITHUB_WORKSPACE/trusted/forge/verifier"
COMMON=(--rm --init --env-file /dev/null --user 1000:1000 --cap-drop ALL --security-opt no-new-privileges
        --pids-limit 512 --memory 4g --cpus 2 --read-only --tmpfs /tmp:rw,size=512m
        -v "$W:/work" -v "$OUT:/out" -v "$T:/trusted:ro" -w /work)

# (1) Install: Netz nötig; lockfile ist byte-identisch zu main (P-02); keine Lifecycle-Scripts
docker run "${COMMON[@]}" --network bridge "$IMG" \
  npm ci --ignore-scripts --no-audit --no-fund --userconfig /trusted/npmrc   ; echo "install=$?"
# (2) Typecheck: tsconfig byte-identisch zu main
docker run "${COMMON[@]}" --network none "$IMG" \
  node node_modules/typescript/bin/tsc --noEmit -p /work/tsconfig.json       ; TC=$?
# (3) Tests: Konfiguration AUS main, Root = Prüfling
docker run "${COMMON[@]}" --network none "$IMG" \
  node node_modules/vitest/vitest.mjs run --root /work --config /trusted/vitest.verifier.config.mts \
       --reporter=json --outputFile=/out/test.json --passWithNoTests=false --allowOnly=false ; TS=$?
```

Begründungen:

- `--ignore-scripts`: `package.json`-Skripte und Dependency-Lifecycle-Hooks laufen nicht (A-23). Im Spike zu prüfen: `esbuild` (Dependency von Vitest) funktioniert ohne Postinstall über das plattformspezifische optionale Paket; sonst Install-Schritt im Container mit Netz, aber ebenfalls ohne Env.
- Kommandos werden **nicht** über `npm test`/`npm run typecheck` gestartet, sondern direkt über die Binärdateien aus dem gerade installierten `node_modules`. Der Contract-String `requiredChecks[].command` muss exakt einem Eintrag der Check-Allowlist in `forge/policy.json` entsprechen (`typecheck: "npm run typecheck"`, `test: "npm test"`); der Verifier führt die dort hinterlegte trusted Implementierung aus und trägt beides in die Evidence (`command` = Contract-String für den Kern, `executedCommand` = tatsächlich).
- `--config /trusted/...`: Vitest nimmt die angegebene Datei und sucht keine Konfiguration im Root. Zusätzlich P-01 (keine `vitest.config.*` im Tree). Beides, damit der Schutz nicht an einer Vitest-Eigenschaft hängt.
- Trusted Konfiguration (Skizze): `test.include = ["tests/**/*.test.ts"]`, `test.exclude = ["**/node_modules/**", "forge/**"]`, `pool: "forks"`, `isolate: true`, `allowOnly: false`, `passWithNoTests: false`, `setupFiles: []`, `globalSetup: []`, `testTimeout: 30000`, `hookTimeout: 30000`, `maxWorkers: 2`.
- `--network none` für Typecheck und Tests: kein Exfiltrationskanal, keine Netzabhängigkeit in Tests.

### 7.3 Was technisch verhindert wird vs. was Code Review erkennen muss

| Angriff | Technisch verhindert? | Mechanismus | Code Review |
|---|---|---|---|
| PR ändert `package.json` (Scripts, Deps) | **Ja** | P-01/P-02 Blob-Gleichheit; außerdem werden Scripts nicht benutzt | – |
| PR fügt `vitest.config.*`/`vite.config.*` hinzu (auch in Unterordnern) | **Ja** | P-01; `--config` aus `main` | – |
| PR ändert `tsconfig.json` | **Ja** | P-01/P-02 | – |
| PR ändert Workflow | **Ja** | Workflow kommt aus `main` (Trigger); P-01; Event-Policy (C7) verhindert Läufe aus dem PR | – |
| PR skippt Tests in **nicht** im Scope liegenden Testdateien | **Ja** | jede Änderung dort ist `SCOPE_VIOLATION` | – |
| PR löscht eine Testdatei | **Ja** | `D` ist immer Verletzung | – |
| PR skippt/entfernt Tests in **im Scope** liegenden Testdateien | **Teilweise** | Inventarregel I-1..I-4 (§7.4) als Detektor; fälschbar (§12) | **Ja**: Reviewer prüft Diff der Testdateien auf `.skip`, `.todo`, entfernte Assertions, `expect.assertions`-Verlust |
| `.only` | **Ja** | `allowOnly: false` → Vitest Exit 1 | – |
| Test, der immer besteht (leere Assertion) | **Nein** | – (Mutation Smoke erkennt es nur, wenn ein Mutant genau diese Datei treffen sollte) | **Ja** |
| Test fälscht Ergebnisse über Vitest-Interna (`__vitest_worker__`-RPC) | **Nein** (nur Exit-Code-Autorität, keine Prozessisolation innerhalb Vitest) | Mutation Smoke erkennt pauschale Fälschung (Mutant überlebt) | **Ja**: Import von `vitest/...`-Interna, `globalThis.__vitest*`, `process.binding` in Testdateien ist ein Blocker |
| `process.exit(0)` im Test | **Ja** (empirisch) | Vitest 5 fängt ab (Deep Audit NRT-14 NOT REPRODUCED); im Spike erneut bestätigen | – |
| Test manipuliert `/out/test.json` per verwaistem Prozess | **Nein** für das Inventar; **Ja** für pass/fail (Exit-Code) | `--init` beendet Waisen beim Container-Ende, Fenster bleibt | – (Inventar ist Hilfsregel) |
| Test liest Secrets/Token | **Ja** | keine Secrets; Container ohne Env; Token nicht gemountet | – |
| Test schreibt in Runner-Dateien (`GITHUB_OUTPUT`, `_temp`) | **Ja** | Container sieht sie nicht | – |
| Test braucht Netz (Exfiltration) | **Ja** | `--network none` | – |
| `.d.ts` im Scope verändert Typprüfung | **Nein** | tsconfig `include: ["src","tests"]` nimmt jede `.d.ts` unter `tests/` mit | **Ja**: neue `.d.ts` oder `declare global`/`declare module` in Scope-Dateien sind Blocker |
| Lockfile-Dependency kompromittiert (Registry) | **Nein** (Integrity-Hash schützt nur gegen Austausch des gleichen Versionsstrings) | – | Dependency-Updates nur per Owner-PR |

### 7.4 Testinventar (Hilfsregeln, nicht autoritativ)

Aus `/out/test.json` (Vitest-JSON-Reporter: `numTotalTests`, `numPassedTests`, `numFailedTests`, `numPendingTests`, `numTodoTests`, `testResults[].name`, `assertionResults[].status`) und aus einem **Baseline-Lauf** derselben trusted Konfiguration auf `git archive B` (zweiter Container):

- I-1 Konsistenz: Summen über `assertionResults` = `num*`-Felder, sonst `INVENTORY_INCONSISTENT`.
- I-2 Für jede Testdatei, die **nicht** im Scope ist: Inventar (Anzahl, skipped, todo) identisch zur Baseline, sonst `INVENTORY_DRIFT_OUT_OF_SCOPE` (müsste wegen Scope ohnehin unmöglich sein; Redundanz).
- I-3 Für Testdateien im Scope: `skipped + todo` darf die Baseline der Datei nicht übersteigen; neue Testdateien: `skipped + todo == 0` und `total >= 1`.
- I-4 Gesamt: `numTotalTests(H) >= numTotalTests(B) - entfernteTestsInScopeDateien` ist in V0.1 vereinfacht zu `numTotalTests(H) >= numTotalTests(B)` (Tests dürfen nicht weniger werden; wer einen Test ersetzen will, ersetzt ihn 1:1 oder der Contract nennt es, was eine spätere Contract-Erweiterung ist).

Diese Regeln sind **Detektoren für ehrliche Fehler und plumpe Abkürzungen**; §12 benennt, dass ein Angreifer sie aus dem Container heraus fälschen kann. Deshalb entscheidet über pass/fail nur der Exit-Code, und das Inventar ist ein zusätzlicher Failure-Grund, nie ein Erfolgsgrund.

---

## 8. Evidence Schema

Maschinenlesbar, kanonisches JSON (`JSON.stringify(obj, null, 2)` mit sortierten Schlüsseln), geschrieben vom trusted Job als Artefakt `forge-evidence-<HEAD_SHA>.json`, als Job-Summary (verkürzt) und als Datei im Check-Output. **Keine** Felder, die aus PR-Text, Developer-Report, Kommentaren oder Container-Inhalten stammen, außer dem markierten Inventar.

```json
{
  "forgeEvidenceFormat": 1,
  "repository": { "id": 1401864629, "fullName": "Wuerfelduell/Forge", "visibility": "public" },
  "event": { "name": "pull_request_target", "action": "synchronize", "pullRequest": 42, "deliveryRunId": "…" },
  "workflow": {
    "ref": "Wuerfelduell/Forge/.github/workflows/forge-verify.yml@refs/heads/main",
    "sha": "<github.workflow_sha>", "runId": "<github.run_id>", "runAttempt": 1,
    "toolsCommit": "<github.sha = main-Stand der Werkzeuge>", "policyBlob": "<blob sha von forge/policy.json an toolsCommit>",
    "verifierConfigBlob": "<blob sha von forge/verifier/vitest.verifier.config.mts>",
    "image": "node:22.x.y-bookworm-slim@sha256:…", "runner": "ubuntu-24.04", "gitVersion": "2.x", "nodeVersion": "22.x.y", "npmVersion": "10.x"
  },
  "main": { "ref": "refs/heads/main", "sha": "<MAIN_SHA>" },
  "base": { "sha": "<B>", "tree": "<B^{tree}>", "isMergeBaseOfMainAndHead": true },
  "head": { "sha": "<HEAD_SHA>", "tree": "<H^{tree}>", "ref": "refs/heads/forge/run/TASK-0006-1", "sourceRef": "refs/pull/42/head", "repoId": 1401864629 },
  "contract": {
    "taskId": "TASK-0006", "path": "forge/contracts/TASK-0006.md", "readAt": "<B>",
    "blob": "<git blob sha>", "contentHash": "<sha256 forge-contract-v1\\n + text>", "contractVersion": 1,
    "commit": "<C>", "commitParents": 1, "baseCommit": "<aus Frontmatter>",
    "scope": { "create": [], "modify": [] }, "requiredChecks": [], "mutationSmoke": "required", "mutants": 3
  },
  "checkout": { "gitNoReplaceObjects": true, "shallow": false, "replaceRefsOnRemote": 0, "refsLoaded": ["refs/remotes/origin/*", "refs/forge/main", "refs/forge/pr-head"], "fsckConnectivity": "ok" },
  "diff": {
    "command": "git diff --raw --no-renames --no-color --no-ext-diff --no-textconv -z --abbrev=40 <B> <H>",
    "entries": [ { "path": "src/domain/accusation.ts", "status": "A", "change": "added", "oldMode": "000000", "newMode": "100644", "oldBlob": "0000…", "newBlob": "…" } ],
    "entryCount": 3, "rawSha256": "<sha256 von diff.raw>"
  },
  "tree": { "caseCollisions": [], "forbiddenModes": [], "submodules": false, "protectedPathsIdentical": ["package.json", "package-lock.json", "tsconfig.json", ".npmrc", ".gitattributes"] },
  "checks": [
    { "name": "typecheck", "command": "npm run typecheck", "executedCommand": "tsc --noEmit -p /work/tsconfig.json", "exitCode": 0, "durationMs": 8123, "network": "none" },
    { "name": "test", "command": "npm test", "executedCommand": "vitest run --root /work --config /trusted/vitest.verifier.config.mts …", "exitCode": 0, "durationMs": 41200, "network": "none",
      "inventory": { "source": "container-report-not-tamper-proof", "total": 1101, "passed": 1101, "failed": 0, "skipped": 0, "todo": 0, "files": 38 },
      "baselineInventory": { "total": 1086, "passed": 1086, "failed": 0, "skipped": 0, "todo": 0, "files": 37 } }
  ],
  "mutations": [
    { "id": "M-ACC-01", "file": "src/domain/accusation.ts", "beforeSha256": "…", "afterSha256": "…", "applied": 1,
      "sourceHash": "<sha256 Originalmodul>", "mutantHash": "<sha256 mutiertes Modul>", "exitCode": 1,
      "outcome": "detected", "killedBy": ["tests/accusation.test.ts > rejects verdict without motive"], "assertionFailures": 2, "loadErrors": 0, "durationMs": 9800 }
  ],
  "duplicateCheckRuns": 1,
  "result": { "passed": true, "failures": [] },
  "evidenceHash": "<sha256 des kanonischen JSON ohne dieses Feld>"
}
```

Bindungen: `repository.id` + `head.sha` + `base.sha` + `main.sha` + `contract.blob`/`contentHash` + `workflow.sha`/`toolsCommit`/`policyBlob`/`image` + `diff.rawSha256` + `checks[].exitCode` + `mutations[]` + `result`. Alles davon berechnet der Job selbst. Es gibt **keine Signatur** (keine Secrets, keine OIDC-Nutzung in V0.1); die Authentizität der Evidence liegt darin, dass sie nur aus einem Workflow-Lauf stammen kann, dessen Definition auf `main` liegt, und dass der Check-Run von GitHub an `head.sha` gebunden ist. Wer die Evidence später liest (Status-Projektion, Mensch), prüft `workflow.ref` endet auf `@refs/heads/main` und `repository.id` stimmt. Kern-Integration: aus `diff.entries` wird `changedFiles`, aus `checks` die Kern-`checks` (`name`, `command`, `exitCode`), aus `mutations` die `MutationResult`-Liste; `method: "fresh_clone"` bleibt als Literal, `verifiedCommit = head.sha`, `runId` aus dem Branch-Namen. Die vom Deep Audit geforderten Felder `diffBase`, Modi, Inventar liegen in der Evidence bereits vor und können bei 0001B v3 in den Kern übernommen werden.

---

## 9. Mutation Strategy

### 9.1 Ehrliche Benennung

V0.1 besitzt **kein Mutation Testing**. Es gibt keinen Mutations-Score, keine automatische Mutantengenerierung, keine Aussage „Tests sind stark“. V0.1 beweist genau dies: **„Jeder der N im freigegebenen Contract gelisteten Textersetzungen in Produktionsdateien bringt mindestens eine Test-Assertion unter der Konfiguration aus `main` zum Scheitern.“** Das heißt in Evidence und Check-Summary „Contract Mutants: N/N killed“, nicht „Mutation Smoke passed“ und nicht „mutation score“.

### 9.2 Warum das trotzdem etwas wert ist

Der Pilot-Befund M1 (grüne Tests, falscher Code) und `mutations.json` (12 Mutanten, In-Memory-Vite-Transform) zeigen: ein vom **Reviewer** gewählter Mutant, der die Kernaussage des Tasks trifft, ist ein billiger und harter Beweis dafür, dass die Tests diese Aussage überhaupt prüfen. Zusätzlich ist er das einzige technische Mittel gegen pauschal gefälschte Testergebnisse (§7.3): ein Test, der immer „pass“ meldet, kann keinen Mutanten töten.

### 9.3 Regeln (Verifier)

- Mutanten stehen **im Contract** (Frontmatter-Erweiterung, Vorschlag: `"mutants": [{"id","file","before","after","tests":[…]}]`) und kommen damit aus `main` an `B`. Developer-Mutationen im PR oder Report werden **ignoriert** (`report.mutations` wird nicht gelesen).
- Gültigkeitsregeln je Mutant (Verletzung → `MUTATION_EVIDENCE_INVALID`, der Run scheitert, auch wenn der Mutant „detected“ wäre): `file` ∈ `scope.create ∪ scope.modify` und liegt unter `src/**` (nicht in Tests, nicht in Konfiguration); `before` kommt im Modul **genau einmal** vor (`applied == 1`); `after != before`; `id` ist ein Slug (`^[A-Z0-9][A-Z0-9-]{2,31}$`, DRT-32), Ids eindeutig; Anzahl Mutanten zwischen `policy.minMutants` (1) und `policy.maxMutants` (8); Gesamtzeitbudget.
- „Detected“ heißt: Vitest-Exit ≠ 0 **und** im Report mindestens eine `assertionResults[].status == "failed"` in einer der gelisteten Testdateien **und** `loadErrors == 0` (kein Syntax-/Importfehler des mutierten Moduls). Ein Mutant, der das Modul unladbar macht, ist trivial und zählt als `MUTATION_EVIDENCE_INVALID` (T18). Ein Mutant, bei dem Tests außerhalb der gelisteten Dateien scheitern, zählt ebenfalls nicht als detected (sonst könnte man ein globales `throw` als Mutanten nehmen).
- „Survived“ (Exit 0) → `MUTATION_SURVIVED` → Run `failed`. Eine Äquivalenz-Klassifikation gibt es im Verifier **nicht**; äquivalente Mutanten werden durch eine neue Contract-Version entfernt (Reviewer-Entscheidung, sichtbar im Contract-Diff), nicht durch ein Rationale-Feld (E-06).
- Mechanik: wie `mutations.json`, aber trusted: ein Vite-Plugin in `forge/verifier/vitest.verifier.config.mts` (enforce `pre`), das die Ersetzung im Speicher vornimmt, `sourceHash`/`mutantHash` protokolliert und bei `count != 1` abbricht. Je Mutant ein eigener Container-Lauf (`--network none`), damit Mutanten sich nicht gegenseitig beeinflussen. Baseline-Lauf ohne Mutant muss grün sein (ist der reguläre Check `test`).

### 9.4 Was der Architektur-Reviewer dafür tun muss

Mutanten gehören zur Contract-Freigabe. Checkliste für den Reviewer (Prozess, nicht Verifier): mindestens ein Mutant pro zentraler Regel des Tasks; keine Mutanten, deren Erkennung trivial ist (Typfehler, `throw`); `tests` nennt die Dateien, die den Mutanten fangen müssen. Der Contract-PR-Check validiert nur die Form (Slug, Datei im Scope, `before != after`), nicht die Qualität.

---

## 10. Adversarial Cases (42)

Erwartetes Ergebnis = Verhalten des entworfenen Verifiers plus Begleitkonfiguration (§2.3). „Blockiert durch“ nennt den ersten greifenden Mechanismus. Jeder Fall ist als Spike-Test gegen die echte Pipeline gedacht (Exit-Kriterium 5 des V0.1-Berichts erweitert).

| # | Angriff | Erwartetes Ergebnis | Blockiert durch |
|---|---|---|---|
| AC-01 | PR-Body/Report behauptet `changedFiles: []`, realer Diff ändert 7 Dateien | Report ignoriert; Diff selbst berechnet; Scope-Urteil über 7 Dateien | §5 |
| AC-02 | PR fügt `vitest.config.ts` (`include: ["tests/nothing.test.ts"]`) hinzu | `failed(PROTECTED_PATH_CHANGED)`; Tests liefen zusätzlich mit trusted Config | P-01, `--config` |
| AC-03 | PR setzt `"test": "exit 0"` in `package.json` | `failed(PROTECTED_PATH_CHANGED)`; Scripts werden nicht benutzt | P-01/P-02, §7.2 |
| AC-04 | PR ändert `tsconfig.json` (`strict: false`) | `failed(PROTECTED_PATH_CHANGED)` | P-01/P-02 |
| AC-05 | `describe.skip` in einer Testdatei **außerhalb** des Scopes | `failed(SCOPE_VIOLATION)` | Kern-Scope |
| AC-06 | `describe.skip` in einer Testdatei **im Scope** | `failed(INVENTORY_SKIP_INCREASED)` (Detektor); Reviewer-Pflicht bleibt | I-3; §7.3 |
| AC-07 | `it.only` auf einen trivialen Test | Vitest Exit 1 → `failed(CHECK_FAILED test)` | `allowOnly: false` |
| AC-08 | Testdatei gelöscht | `failed(SCOPE_VIOLATION)` (D immer) | Kern |
| AC-09 | Neue `forge/coordination/notes.test.ts` | `failed(SCOPE_VIOLATION)`; zusätzlich würde trusted Config `forge/**` ausschließen | P-07, Config |
| AC-10 | PR ändert `.github/workflows/forge-verify.yml` | läuft trotzdem der **main**-Workflow; `failed(PROTECTED_PATH_CHANGED)` | Trigger-Semantik, P-01 |
| AC-11 | Developer legt in seinem Branch `on: push`-Workflow mit Job `forge-verify: run: true` an | Lauf wird von der Event-Policy abgewiesen („Event 'push' is not allowed“); kein zweiter Check-Run; zusätzlich P-01 | C7 |
| AC-12 | Developer setzt per API Commit-Status `forge-verify = success` am Head | zählt nicht (Quelle ≠ GitHub Actions); „check and status same name → both must pass“ | C8 |
| AC-13 | Developer pusht `refs/replace/<C>` mit Graft auf EVIL | `failed(REMOTE_REPLACE_REFS)`; selbst ohne Erkennung: `GIT_NO_REPLACE_OBJECTS=1`, Refspec holt keine Replace-Refs (Anhang A, G4) | §4.3 |
| AC-14 | Runner-Checkout ist shallow (Fehlkonfiguration) | `failed(SHALLOW_REPOSITORY)` statt stillem Hängen | §4.3 |
| AC-15 | `git mv forge/coordination/CODEX.md archive/CODEX.md` | `D`+`A` → `failed(SCOPE_VIOLATION)` für beide | `--no-renames`, Kern |
| AC-16 | Legitimer Rename innerhalb Scope | `failed(SCOPE_VIOLATION)`; V0.1 kennt keine Renames (dokumentierte Einschränkung) | §5.3 |
| AC-17 | Symlink `src/x.ts → /etc/passwd` oder `→ ../../.npmrc` | `failed(MODE_FORBIDDEN)` **vor** jedem Checkout | §5.2 Schritt 4 |
| AC-18 | Submodule (`160000` + `.gitmodules`) auf fremdes Repo | `failed(MODE_FORBIDDEN, SUBMODULES_FORBIDDEN)` | §5.2, P-08 |
| AC-19 | `src/Accusation.ts` neben vorhandenem `src/accusation.ts` | `failed(CASE_COLLISION)` | P-06 |
| AC-20 | `tests/aux.test.ts`, `tests/notes..test.ts`, Segment mit End-Leerzeichen | `failed(PATH_NOT_PORTABLE)` | P-05 |
| AC-21 | Scope enthält `forge/Contracts/TASK-0006.md`; PR schreibt diese Datei | `failed(PROTECTED_PATH_ALIAS)`; Contract hätte den Contract-Check nicht passieren dürfen | P-04 |
| AC-22 | Contract-Commit auf `main` ist Merge-Commit mit zweitem Parent EVIL | `failed(CONTRACT_COMMIT_NOT_LINEAR)`; Ruleset „lineare Historie“ verhindert ihn ohnehin | §4.5, C8 |
| AC-23 | Contract-Commit ändert neben dem Contract noch `src/forge/verification.ts` | `failed(CONTRACT_COMMIT_NOT_ISOLATED)` | §4.5 |
| AC-24 | Run-Branch zweigt von einem Commit ab, der C nicht enthält (älteres `main` oder fremder Branch) | `B` ohne C → `failed(CONTRACT_NOT_IN_BASE)` | §4.4/4.5 |
| AC-25 | Developer „rebased“ so, dass sein Diff gegen einen selbst gewählten Commit klein aussieht | irrelevant: Basis ist stets `merge-base(main, H)` | §4.4 |
| AC-26 | Nach grünem Lauf neuer Push mit Schadcode, Owner merged „den Branch“ | neuer Head ohne Check → nicht mergebar; Review verfällt | §2.5, C8 |
| AC-27 | Head bewegt sich **während** des Laufs | `failed(HEAD_MOVED)`; `synchronize`-Event startet den neuen Lauf | §4.3 Schritt C |
| AC-28 | PR aus einem Fork, Commit nur im Fork | `failed(FORK_PR_NOT_SUPPORTED)`; `actions/checkout` würde Fork-Head ohne Flag verweigern | §4.2 |
| AC-29 | Developer liefert in PR eigene „Mutanten: 12/12 detected“ | ignoriert; nur Contract-Mutanten aus `main` an `B` zählen | §9.3 |
| AC-30 | Contract-Mutant ersetzt `return x` durch `return` (Syntaxfehler) | `MUTATION_EVIDENCE_INVALID` (loadErrors > 0, keine Assertion) | §9.3 |
| AC-31 | Testdatei im Scope fälscht Ergebnisse über Vitest-Interna (alle Tests „pass“) | Exit 0 → Check `test` grün (nicht beweisbar); Contract-Mutanten **überleben** → `MUTATION_SURVIVED` → `failed` | §9 als Netz; Review |
| AC-32 | Test startet verwaisten Prozess, der `/out/test.json` mit `skipped: 0` überschreibt | pass/fail unverändert (Exit-Code); Inventarregel umgangen → dokumentiert als nicht beweisbar | §12 |
| AC-33 | Test liest `process.env`, `/proc/1/environ`, versucht `curl` nach außen | keine Variablen, kein Token, `--network none` → nichts zu holen; Test schlägt fehl oder ist wirkungslos | C4 |
| AC-34 | `postinstall`-Script in `package.json` oder Dependency | `package.json` byte-identisch; `--ignore-scripts` | P-02, §7.2 |
| AC-35 | 5 000 geänderte Dateien, 50 MB Blob | `failed(DIFF_TOO_LARGE)` / `BLOB_TOO_LARGE` vor Checkout | §5.2, P-10 |
| AC-36 | Datei `src/Fälle.ts` oder `src/a b.ts` | `failed(PATH_NOT_REPRESENTABLE)` statt Hängen | §5.2 Schritt 3 |
| AC-37 | `chmod +x src/a.ts` | `failed(MODE_FORBIDDEN)` | §5.2 |
| AC-38 | `FORGE_HALT=1` als Repository-Variable | Workflow endet sofort `failed(HALTED)` vor jedem Fetch | K10 |
| AC-39 | Branch heißt `forge/run/TASK-0007-1`, aber `forge/contracts/TASK-0007.md` fehlt an `B` | `failed(CONTRACT_MISSING_AT_BASE)` | §4.5 |
| AC-40 | Contract-Datei an `B` enthält ungültiges UTF-8 (U+FFFD-Kollaps, DRT-27) | `failed(CONTRACT_NOT_UTF8)`; Evidence trägt Blob-SHA **und** Content-Hash | §4.5 |
| AC-41 | Developer pusht Cache-Einträge (poisoning) für `main`-Scope | `pull_request_target` hat nur Lesezugriff auf den Cache; `cache-mode: none`; kein Cache benutzt | C5, Doku |
| AC-42 | PR gegen `codex/…` statt `main`, um den Verifier zu umgehen | kein Verifier-Lauf (Filter), aber auch kein Weg nach `main` ohne PR gegen `main` | C8 |

---

## 11. Minimal Workflow

Nicht implementiert; Skizze für den Spike. Platzhalter `<SHA>`/`<digest>` werden beim Anlegen gepinnt. Der Job heißt `forge-verify` (= Name des Required Check).

```yaml
name: forge-verify
on:
  pull_request_target:
    branches: [main]
    types: [opened, synchronize, reopened]
permissions:
  contents: read
  checks: read          # nur für die Duplikat-Zählung (§2.4); sonst entfernen
cache-mode: none
concurrency:
  group: forge-verify-${{ github.event.pull_request.number }}
  cancel-in-progress: true
env:
  GIT_NO_REPLACE_OBJECTS: "1"
  GIT_CONFIG_GLOBAL: /dev/null
  GIT_CONFIG_NOSYSTEM: "1"
  GIT_TERMINAL_PROMPT: "0"
jobs:
  forge-verify:
    runs-on: ubuntu-24.04
    timeout-minutes: 40
    steps:
      - name: Halt switch
        if: ${{ vars.FORGE_HALT == '1' }}
        run: echo "::error::FORGE_HALT" && exit 1
      - name: Reject forks
        if: ${{ github.event.pull_request.head.repo.id != github.repository_id }}
        run: echo "::error::FORK_PR_NOT_SUPPORTED" && exit 1
      - name: Trusted tools from main
        uses: actions/checkout@<full-SHA>
        with: { ref: "${{ github.sha }}", fetch-depth: 0, persist-credentials: false, path: trusted }
      - name: Fetch PR head objects (data only)
        working-directory: trusted
        run: |
          git fetch --no-tags --no-recurse-submodules origin \
            "+refs/pull/${{ github.event.pull_request.number }}/head:refs/forge/pr-head" \
            "+refs/heads/main:refs/forge/main"
      - name: Verify (checkout rules, diff, paths, scope, contract)   # §4-§6, trusted Node-CLI
        working-directory: trusted
        run: node forge/verifier/verify.mjs phase1 --head "${{ github.event.pull_request.head.sha }}" --main "${{ github.sha }}" --pr "${{ github.event.pull_request.number }}" --head-ref "${{ github.event.pull_request.head.ref }}" --out "$RUNNER_TEMP/evidence"
      - name: Materialize head tree (no execution)
        working-directory: trusted
        run: mkdir -p "$RUNNER_TEMP/work" && git archive --format=tar "${{ github.event.pull_request.head.sha }}" | tar -x -C "$RUNNER_TEMP/work" && sudo chown -R 1000:1000 "$RUNNER_TEMP/work"
      - name: Checks and contract mutants in container                   # §7, §9
        working-directory: trusted
        run: node forge/verifier/verify.mjs phase2 --work "$RUNNER_TEMP/work" --out "$RUNNER_TEMP/evidence" --image "node:22.<x>.<y>-bookworm-slim@sha256:<digest>"
      - name: Evidence
        if: always()
        working-directory: trusted
        run: node forge/verifier/verify.mjs finalize --out "$RUNNER_TEMP/evidence" >> "$GITHUB_STEP_SUMMARY"
      - uses: actions/upload-artifact@<full-SHA>
        if: always()
        with: { name: "forge-evidence-${{ github.event.pull_request.head.sha }}", path: "${{ runner.temp }}/evidence/evidence.json", retention-days: 90 }
```

Begleitkonfiguration (einmalig, Owner): keine Secrets; Workflow permissions „Read repository contents and packages“; „Allow GitHub Actions to create and approve pull requests“ aus; Fork-Workflows „Require approval for all external contributors“; Actions-Policy (Events/Actors) wie C7; Rulesets wie C8; CODEOWNERS für `.github/**`, `forge/policy.json`, `forge/verifier/**`, `forge/contracts/**` → `@Wuerfelduell`.

Bewusst **nicht** im Workflow: `actions/setup-node` (Node kommt aus dem Image), `actions/cache`, Secrets, `pull_request`, Matrix, Job-Outputs aus dem Container, ein Aggregator über `needs` (ein einziger trusted Job genügt, weil der Prüfling nie im Job-Prozess läuft; A-24 löst der Container, nicht die Job-Trennung).

---

## 12. What Cannot Be Proven

1. **Semantische Qualität der Tests.** Der Verifier beweist Exit-Codes und das Töten der gelisteten Mutanten, nicht, dass die Tests das Richtige prüfen. Code Review.
2. **Integrität von Ergebnissen innerhalb des Vitest-Prozessraums.** Testcode läuft im selben Container und (in `forks`) als Kindprozess von Vitest; er kann Vitest-Interna erreichen und Ergebnisse fälschen (AC-31). Netz: Contract-Mutanten (ein pauschal fälschender Test tötet keinen Mutanten) und Review (Interna-Importe sind Blocker). Eine harte Lösung (Ergebnisse außerhalb des Prozessraums erzeugen, z. B. je Testdatei ein Container mit eigenem Exit-Code) ist V0.2-Material.
3. **Testinventar.** Zahlen aus `/out/test.json` sind aus dem Container heraus fälschbar (AC-32). Deshalb nur zusätzlicher Failure-Grund.
4. **Container-Isolation.** Docker auf dem GitHub-Runner ist eine Prozess-/Namespace-Isolation, kein Hypervisor. Ein Kernel-Exploit im Container könnte den Runner erreichen; dort liegt ein read-only Token und kein Secret. Restrisiko benannt, nicht beseitigt.
5. **Supply Chain unterhalb des Lockfiles.** `npm ci` prüft Integritätshashes gegen das Lockfile von `main`; ein auf der Registry kompromittiertes, aber identisch gehashtes Paket ist ausgeschlossen, ein von `main` bereits akzeptiertes bösartiges Paket nicht. Dependency-Updates sind Owner-PRs.
6. **Welcher von zwei gleichnamigen Check-Runs zählt.** Nicht dokumentiert. Darum wird die Entstehung verhindert (C7/C8), nicht die Auswertung modelliert.
7. **Verfügbarkeit der GitHub-Features im User-Repo.** Actions-Policies auf Repo-Ebene, Push-Rules „Restrict file paths“, Ruleset-Quelle „GitHub Actions“: Doku belegt Existenz, nicht die Verfügbarkeit im konkreten Plan/Kontotyp. Spike S1.
8. **Freigabe und Identitäten.** Ob der Contract an `B` von einer unabhängigen Identität freigegeben wurde und ob der PR-Autor Developer-Rolle hat, ist der Gate-Check (`forge-gate`, Reviews per API, `forge/policy.json`), nicht dieser Verifier. Die Evidence bindet den Contract (Blob, Hash, Commit), bewertet aber dessen Freigabe nicht.
9. **Zeit.** Die Evidence sagt nichts darüber, ob `main` sich **nach** dem Lauf bewegt hat; das erledigt das Ruleset „up to date“ zum Merge-Zeitpunkt, nicht der Verifier.
10. **Nicht-Determinismus der Tests.** Flaky Tests erzeugen rote Läufe ohne Angreifer; ein Re-Run ist ein neuer Lauf desselben SHA mit neuer Evidence (`runAttempt`). Der Verifier kann Flakiness nicht von Sabotage unterscheiden.
11. **Merge-Ergebnis ≠ Head.** Geprüft wird H, nicht der Merge-Commit. Mit „up to date“ und Squash ist der resultierende Tree gleich H's Tree; ohne diese Regeln wäre der Beweis unvollständig.
12. **Renames.** V0.1 kann keine legitimen Verschiebungen abbilden (§5.3).

---

## 13. Exit Criteria for Verifier Spike

Der Spike (FORGE-OPS-0002) ist bestanden, wenn alle Punkte mit Workflow-Lauf-Links belegt sind. Reihenfolge ist Abhängigkeitsreihenfolge.

| # | Kriterium | Beleg |
|---|---|---|
| S1 | **Plattform-Features existieren im User-Repo:** Settings → Actions → **Policies** ist vorhanden; eine Policy, die `push` verbietet, weist einen `on: push`-Workflow aus einem Developer-Branch mit „Event 'push' is not allowed“ ab; eine Allow-Regel für `pull_request_target` auf `.github/workflows/forge-verify.yml` ist aktiv. Falls Policies fehlen: Push-Rule „Restrict file paths `.github/**`“ nachweislich wirksam; falls auch das fehlt: Entscheidung Owner über Organisation (§2.4). | Screenshot/Policy-Insights, abgewiesener Lauf |
| S2 | **Workflow-Herkunft:** Ein PR, der `forge-verify.yml` löscht und einen eigenen `forge-verify`-Job definiert, erzeugt genau einen Check-Run `forge-verify`, und zwar aus `main` (`workflow.ref` endet auf `@refs/heads/main`), rot wegen `PROTECTED_PATH_CHANGED`. | Lauf-Link, Evidence |
| S3 | **Kein Token, keine Secrets im Container:** Ein Testfall, der `process.env`, `/proc/1/environ`, `/run/secrets` ausgibt und `curl https://example.org` versucht, zeigt nichts und scheitert am Netz. Runner-Log zeigt keinen `extraheader` in `git config`. | Lauf-Log |
| S4 | **Diff-Determinismus:** Zwei Läufe desselben SHA erzeugen byte-gleiche `diff.entries` und gleichen `diff.rawSha256`; `--no-renames` nachgewiesen durch AC-15 (`D`+`A`). | Evidence-Vergleich |
| S5 | **Modi und Pfade:** AC-17, AC-18, AC-19, AC-20, AC-21, AC-36, AC-37 jeweils rot mit dem erwarteten Code **vor** dem Schritt „Materialize“. | Läufe |
| S6 | **Ancestry:** AC-13 (Replace-Ref) rot `REMOTE_REPLACE_REFS`; AC-22/23 rot; AC-24 rot `CONTRACT_NOT_IN_BASE`; ein legitimer Run-PR (von `main` nach Contract-Merge verzweigt) grün. | Läufe |
| S7 | **Test-Integrität:** AC-02, AC-03, AC-04 rot `PROTECTED_PATH_CHANGED`; AC-07 rot über Vitest-Exit; AC-05 rot `SCOPE_VIOLATION`; AC-06 rot über Inventar; `process.exit(0)` im Test → rot (Bestätigung von NRT-14). `npm ci --ignore-scripts` funktioniert mit dem Lockfile von `main` (esbuild lädt). | Läufe |
| S8 | **Mutanten:** Ein Contract mit 3 Mutanten: zwei werden getötet, ein absichtlich nicht getesteter überlebt → rot `MUTATION_SURVIVED`; ein Syntax-Mutant → rot `MUTATION_EVIDENCE_INVALID`; Developer-„Mutationen“ im PR-Text haben keinen Einfluss. Nachstellung von M1. | Läufe |
| S9 | **Required Check greift:** Ruleset `main` mit `forge-verify` (Quelle GitHub Actions), strict; ein per API gesetzter Status `forge-verify=success` (AC-12) macht den PR **nicht** mergebar; ein roter Lauf blockiert; nach Fix grün und mergebar; neuer Push macht ihn wieder unmergebar (AC-26). | Merge-Box-Screenshots |
| S10 | **Evidence vollständig und gebunden:** `evidence.json` validiert gegen das Schema aus §8; `head.tree` entspricht nach Squash-Merge `git rev-parse main^{tree}`; `evidenceHash` reproduzierbar aus der Datei. | Evidence, Git |
| S11 | **Fail statt Hängen:** Jeder rote Fall endet mit Code und Summary innerhalb `timeout-minutes`; kein Lauf bleibt „pending“. | Läufe |
| S12 | **Fork:** PR aus einem Fork endet rot `FORK_PR_NOT_SUPPORTED` ohne Fetch des Fork-Heads. | Lauf |
| S13 | **Owner-Aufwand:** Der gesamte Spike kommt ohne Secrets, ohne eigene GitHub App, ohne Server aus; die Begleitkonfiguration ist als Checkliste dokumentiert und von Seb einmal durchgeklickt. | Checkliste |

Nicht Spike-Kriterium: Status-Projektion, Gate-Check (Freigabe/Identitäten), Mutanten-Qualität, Performance über 40 Minuten.

---

## Anhang A: Git-Experimente (Wegwerf-Repos, Git 2.43.0, Linux)

| # | Aufbau | Ergebnis (gekürzt) | Verwendung |
|---|---|---|---|
| G1 | Branch mit `A` (Datei), `D` (`package.json`), Symlink `forge/coordination/host.md → /etc/hostname`, `src/X.ts` neben `src/x.ts`, `chmod +x src/b.ts`, zweiter Commit macht `src/a.ts` zum Symlink; `git diff --raw --no-renames -z --abbrev=40 BASE HEAD` | `:000000 120000 … A forge/coordination/host.md` · `:100644 000000 … D package.json` · `:000000 100644 … A src/X.ts` · `:100644 120000 … T src/a.ts` · `:000000 100755 … A src/b.ts` · `:000000 100644 … A src/x.ts` | §5: Raw-Format, Modi `120000`/`100755`, Status `T` |
| G2 | `git ls-tree -r HEAD \| tr A-Z a-z \| sort \| uniq -d` | `src/x.ts` | P-06 Kollisionserkennung |
| G3 | `git replace --graft EVIL BASE`; `merge-base --is-ancestor BASE EVIL` | ohne Schutz: **ja (gefälscht)**; mit `GIT_NO_REPLACE_OBJECTS=1`: nein; mit `-c core.useReplaceRefs=false`: nein | §4.3 |
| G4 | `git clone` (normal) vs. `--mirror` eines Remotes mit `refs/replace/*` | normal: 0 Replace-Refs geholt; mirror: 1 | §4.3: Standard-Refspec schützt, Mirror nicht |
| G5 | `git clone --depth 1`; `rev-list --parents -n1 HEAD` | `is-shallow-repository = true`, ein Wort (kein Parent) | §4.3 Shallow-Check |
| G6 | `git fetch origin <nackter SHA>` gegen lokales Remote | erlaubt (`uploadpack.allowAnySHA1InWant` lokal); auf github.com ebenfalls üblich → deshalb nur Refs fetchen (§4.3) | DRT-20 |

## Anhang B: Verifizierte Doku-Zitate (github/docs @ main, 2026-10-03)

- `events-that-trigger-workflows.md`, `pull_request_target`: „This event runs in the context of the default branch of the base repository, rather than in the context of the merge commit, as the `pull_request` event does. … Avoid using this event if you need to build or run code from the pull request.“ Tabelle: `GITHUB_SHA` „Last commit on default branch“.
- `events-that-trigger-workflows.md`, `pull_request`: `GITHUB_SHA` „Last merge commit on the `GITHUB_REF` branch“, `GITHUB_REF` „PR merge branch `refs/pull/PULL_REQUEST_NUMBER/merge`“; „The `pull_request` webhook event payload is empty for merged pull requests and pull requests that come from forked repositories.“
- `events-that-trigger-workflows.md`, `workflow_run`: „The workflow started by the `workflow_run` event is able to access secrets and write tokens, even if the previous workflow was not.“
- `events-that-trigger-workflows.md`, `workflow_dispatch`: „Once a workflow has run at least once, you can dispatch it against any branch or tag via the GitHub API“; Tabelle `GITHUB_REF` „Branch or tag that received dispatch“.
- `securely-using-pull_request_target.md`: „`pull_request_target` makes one critical and subtle change: the workflow, and any subsequent `actions/checkout` call that does not specify a `ref`, is taken from the base repository's default branch, not from the pull request.“ · „You must ensure the checked-out code is only ever inspected as data and never executed before using a `pull_request_target` event.“ · „workflows triggered by `pull_request_target` have read-only access to the cache in the default branch's scope.“ · „Setting `allow-unsafe-pr-checkout: true` as an `actions/checkout` input allows checking out pull request head refs from forks. … This protection only covers fork pull request refs.“ · „GitHub has added a default policy that will block the `pull_request_target` event in public repositories. This policy will be enforced on November 2, 2026.“
- `secure-use.md`: „The `pull_request_target` and `workflow_run` workflow triggers, when used with the checkout of an untrusted pull request, expose the repository to security compromises. … Workflows triggered on `workflow_run` should treat artifacts uploaded from other workflows with caution.“
- `about-actions-policies.md` / `control-workflow-execution.md`: „Actions policies are available at the enterprise, organization, and repository levels.“ · „Event rules control which events are permitted, such as `push`, `pull_request`, `pull_request_target`, and `workflow_dispatch`.“ · „Actor rules control who can trigger workflows“. Fehlermeldung bei Verstoß: „Event 'workflow_dispatch' is not allowed to trigger Actions workflows.“
- `troubleshooting-required-status-checks.md`: „Required checks must pass on the latest commit SHA. Checks from earlier commits don't satisfy the requirement.“ · „If a check and a commit status have the same name, both must pass when that name is required.“ · Zählende Trigger für Job-Checks: `push`, `pull_request`, `pull_request_review`, `pull_request_target`, `deployment`, `deployment_status`; `workflow_dispatch`-Checks „do not satisfy a required status check in a branch ruleset.“
- `troubleshooting-rules.md`: „Required status checks do not take workflow, matrix, or event trigger types into account.“ Check-Name = `<job name>`.
- `available-rules-for-rulesets.md`: Quelle eines Required Check kann eine App sein („If the status is set by any other person or integration, merging won't be allowed“); „Require branches to be up to date“ (strict); „Dismiss stale pull request approvals“; „require an approval from someone other than the last person to push“; „Require linear history … must use a squash merge or a rebase merge“; „Require workflows to pass before merging“: „Ruleset workflows can be configured at the organization or enterprise level“ und „Any filters you specify for the supported events are ignored“.
- `managing-github-actions-settings-for-a-repository.md`: „By default, when you create a new repository in your personal account, `GITHUB_TOKEN` only has read access for the `contents` and `packages` scopes.“ · „By default, when you create a new repository in your personal account, workflows are not allowed to create or approve pull requests.“
- `contexts.md`: `github.workflow_ref` „The ref path to the workflow. For example, `octocat/hello-world/.github/workflows/my-workflow.yml@refs/heads/my_branch`“; `github.workflow_sha` „The commit SHA for the workflow file“; `github.repository_id` „The ID of the repository … different from the repository name“; `needs.<job_id>.result` ∈ {`success`, `failure`, `cancelled`, `skipped`}.
