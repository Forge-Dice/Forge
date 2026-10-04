# FORGE IDENTITY & GITHUB PROTECTION MODEL

| Feld | Wert |
|---|---|
| Rolle | Security / Repository Architect für Forge V0.1 |
| Modus | rein lesend. Keine Änderung am Repository, an Settings oder Rulesets; keine Commits, keine PRs |
| Datum | 2026-10-03 |
| Repository | `Wuerfelduell/Forge` (Stand nach `git fetch` ~08:00 UTC; `main` @ `f5dbc73`, nur `.gitkeep`; vier Arbeits-Branches; keine PRs) |
| Grundlage | `forge-audits/FORGE-DEEP-AUDIT.md`, `FORGE-DEEP-RED-TEAM.md`, `FORGE-V0.1-MINIMUM-PRODUCT.md`; GitHub-API-Abfragen (Repo-Metadaten, Collaborators, Commits); offizielle GitHub-Dokumentation, GitHub-Changelog, GitHub-REST-Referenz, Anthropic-, OpenAI- und xAI-Dokumentation (jeweils heute abgerufen) |
| Parallel laufend | FORGE-V0.1-HARDENING-PLAN.md und FORGE-INDEPENDENT-VERIFIER-DESIGN.md. Dieser Bericht behandelt Identitäten und GitHub-Schutz; Verifier-Interna (was die Checks prüfen) werden nur so weit berührt, wie die Schutzregeln sie brauchen |

**Belegkennzeichen:** DOKU (offizielle GitHub-Doku), API (GitHub-REST-Referenz), CHANGELOG (GitHub-Changelog), REPO (im Repository bzw. per GitHub-API beobachtet), VENDOR (Anthropic-, OpenAI-, xAI-Doku), COMMUNITY (inoffiziell, GitHub-Community-Diskussion), INFERRED (Schlussfolgerung, nicht direkt belegt, vor Umsetzung per Spike prüfen).

---

## Kurzantwort

**Empfohlenes V0.1-Modell: ein geschütztes GitHub-Repository mit Rulesets ohne Bypass, eine echte Maschinen-Identität je Developer-Agent (Codex zuerst, als das eine kostenlose Machine-Account, das GitHubs Nutzungsbedingungen erlauben), Seb als einziger authentifizierter Entscheider, GitHub Actions als einziger Verifier, und ein SHA-gebundener Review-Adapter für alle KI-Reviewer ohne eigene GitHub-Identität (ChatGPT, Grok, in V0.1 auch Claude).**

Drei Befunde, die die Richtung bestimmen:

1. **Das Repository ist öffentlich** (`visibility: public`, REPO). Deshalb stehen Rulesets und CODEOWNERS schon auf GitHub Free zur Verfügung (DOKU). Wird es privat, braucht Sebs Konto GitHub Pro, sonst fallen beide Schutzmechanismen weg.
2. **Heute handeln beide Agenten unter Sebs Authentifizierung, nicht nur Codex.** Codex-Commits sind GitHub-seitig als `Wuerfelduell` zugeordnet (Author und Committer, REPO). Claude-Commits tragen den Autor „Claude“, aber Claude Code pusht und antwortet über Sebs verbundenes GitHub-Konto (VENDOR, INFERRED für den Push-Pfad). Der Autor-String im Commit ist kosmetisch und frei wählbar; die Identität, die GitHub kennt, ist die Anmeldung, die pusht.
3. **Ein persönliches Konto kennt nur zwei Rollen: Owner und Collaborator mit Schreibrecht** (DOKU). Alles, was ein Developer nicht darf (main pushen, Workflow ändern, fremde Branches beschreiben), muss deshalb über Rulesets und CODEOWNERS erzwungen werden, nicht über Rollen. Das geht; die Rulesets dafür stehen in Abschnitt 6 bis 9.

---

## 1. Actors

| Akteur | GitHub-Identität heute | GitHub-Identität V0.1 (empfohlen) | Rolle in Forge |
|---|---|---|---|
| **Seb / Owner** | `Wuerfelduell` (ID 315180734), Repo-Owner und einziger Collaborator (REPO) | unverändert; **kein Bypass-Eintrag** in Rulesets, damit die Regeln auch für ihn gelten | mergt `main`, ändert Rulesets, CODEOWNERS und `forge/policy.json`, attestiert externe Reviews, bestätigt Owner-Ausnahmen |
| **Codex Developer** | pusht als `Wuerfelduell` (Commits `Diceduel <315180734+Wuerfelduell@users.noreply.github.com>`, 10 Commits, REPO) | **Machine Account `forge-codex`** (kostenlos, ToS-konform), Collaborator mit Schreibrecht, in ChatGPT als verbundenes GitHub-Konto hinterlegt | schreibt nur `forge/run/codex/**`, öffnet und aktualisiert Run-PRs |
| **Claude Developer** | Commit-Autor `Claude <noreply@anthropic.com>` (GitHub ordnet den Autor dem Konto `claude` zu, REPO); Push und PR-Aktionen laufen über Sebs GitHub-Verbindung (VENDOR, INFERRED) | **Stufe A (V0.1, 0 €):** kein eigener Developer-Zugang; Claude liefert Specs/Reviews über den Adapter. **Stufe B:** zweiter Machine Account `forge-claude` auf kostenpflichtigem Plan oder nach Rückfrage beim GitHub-Support, als GitHub-Verbindung in Sebs claude.ai-Konto | schreibt nur `forge/run/claude/**`, öffnet und aktualisiert Run-PRs |
| **Unabhängiger AI-Reviewer** (ChatGPT, Grok, Claude ohne Identität) | keine | keine; **Adapter**: Review-Payload für exakten SHA, von Seb attestiert und als GitHub-Review eingereicht | gibt Review ab, verändert nichts |
| **GitHub Actions Verifier** | existiert nicht (`.github/` fehlt auf allen Branches, REPO) | `github-actions[bot]`, `GITHUB_TOKEN` nur lesend, keine Secrets, Workflows aus `main` | Pflicht-Checks `forge-contract`, `forge-gate`, `forge-verify`, `forge-policy`; schreibt Check-Summaries |

Weitere Fakten aus der GitHub-API (REPO, 2026-10-03): Konto `Wuerfelduell` am 2026-08-10 erstellt, 3 öffentliche Repos; `pull_request_creation_policy: all` (jeder GitHub-Nutzer darf PRs öffnen); `web_commit_signoff_required: false`; kein Commit eines Agenten ist signiert (`git log --show-signature`: 33× `N`, nur der Web-Commit `f5dbc73` trägt GitHubs eigene Signatur).

---

## 2. Current Problem

**Was Forge heute sieht.** Der Kern (`identity.ts`, `policy`) rechnet Unabhängigkeit aus Logins, die der Aufrufer selbst liefert (Deep Audit). GitHub könnte diese Logins beglaubigen, tut es aber nicht, weil es nur eine Anmeldung gibt: Sebs.

**Was GitHub heute sieht.**

| Beobachtung | Beleg | Folge |
|---|---|---|
| Codex-Commits: Author und Committer = `Wuerfelduell` | `list_commits` auf `codex/forge-core-v2-repair`: `author.login = committer.login = Wuerfelduell` (REPO) | Jeder Codex-Push wäre für ein Ruleset ein Push des Owners. Ein „Developer darf main nicht pushen“ ist gegen Codex nicht formulierbar |
| Claude-Commits: Autor „Claude“, GitHub zeigt Login `claude` (ID 81847) | `list_commits` auf `f712e50` (REPO) | Die Zuordnung entsteht nur über die Autor-E-Mail und ist kein Authentifizierungsmerkmal. Pushende Identität ist die GitHub-Verbindung von Sebs claude.ai-Konto; Anthropic dokumentiert ausdrücklich, dass Antworten auf Review-Kommentare „using your GitHub account“ gepostet werden (VENDOR) |
| Keine Branch-Regeln, keine CODEOWNERS, keine Workflows | `.github/` fehlt auf allen vier Branches (REPO) | Force-Push, Löschen, direkter Push auf `main` sind für jede Schreibidentität möglich |
| Öffentliches Repo, PR-Erstellung für alle offen | `visibility: public`, `pull_request_creation_policy: all` (REPO) | Fremde können Forks und PRs anlegen; mit `pull_request`-Workflows laufen deren Dateien im Fork-Kontext mit, mit `pull_request_target` sogar im Kontext von `main` |
| Eine Claude-Session hat spezifiziert, implementiert, Approval-JSONs „im Namen des Owners“ geschrieben und reviewt | Deep Audit, V0.1-Bericht §1.1 | Rollen­trennung existierte nur im Prompt |

**Kern des Problems in einem Satz:** Forge kann Developer und Owner nicht unterscheiden, weil GitHub sie nicht unterscheiden kann; die Lösung ist nicht mehr Kernel-Code, sondern getrennte Anmeldungen plus Regeln, die an diese Anmeldungen binden.

**Was ChatGPT betrifft:** ChatGPTs GitHub-App („ChatGPT-codex-connector“) ist laut OpenAI-Hilfe nur lesend („The GitHub app in ChatGPT only lets you read from your repositories“, VENDOR). ChatGPT kann also auf GitHub weder reviewen noch approven. Codex' separates Code-Review-Feature postet Reviews „just like a teammate would“ (VENDOR), aber unter OpenAIs App-Identität, nicht unter einer, die Seb kontrolliert; siehe Abschnitt 3.3.

---

## 3. Options

### 3.1 Übersicht

| Option | Was GitHub sieht | Kann PR öffnen / Review abgeben | Kann Bypass-Akteur sein | Kosten | Aufwand | Sicherheit | Urteil für V0.1 |
|---|---|---|---|---|---|---|---|
| **A. Separater GitHub-Account (Machine Account)** | eigener Login, z. B. `forge-codex` | ja / ja | ja (`User`-Bypass, CHANGELOG 2026-05-07) | 1 Account kostenlos; weitere nur bezahlt oder nach Rücksprache (ToS) | gering: Account, 2FA, Collaborator-Einladung, Verbindung im Agenten-Produkt | gut: eigene Credentials, eigene Rulesets-Bindung; Schwäche: Collaborator = volles Schreibrecht, PAT-Einschränkung (3.4) | **ja, für Codex sofort** |
| **B. Eigene GitHub App** | `name[bot]`, Installation Token 1 h (DOKU) | ja / ja (Approvals zählen laut COMMUNITY, Copilot-Ausnahme ist DOKU) | ja (`Integration`) | 0 € | mittel: App anlegen, Private Key verwahren, Token-Minting in den Push-Pfad bringen | sehr gut, wenn der Agent den Token nutzen kann | **nein für Cloud-Agenten** (Codex Cloud und Claude Cloud pushen über ihre eigenen Connectoren); **Option für lokale CLI-Läufe** |
| **C. Vendor-App als Identität** (Claude GitHub App, Codex Connector) | `claude`, `chatgpt-codex-connector` | Codex Review: Kommentare/Reviews als Bot (VENDOR) | ja (`Integration`) | 0 € | 0 | nicht von Seb kontrollierbar; Codex-Bot ist derselbe Anbieter wie der Codex-Developer | **als Zusatz-Reviewer für Claude-Runs nutzbar, nicht als Developer-Identität** |
| **D. Fine-grained PAT** | der Login des Token-Besitzers | ja / ja | über den User | 0 € | gering | gut (Repo-Scope, Permissions, Ablauf) **aber:** nicht nutzbar durch Collaborators auf fremden persönlichen Repos (DOKU) | **nur, wenn das Repo in eine Organisation zieht** |
| **E. Classic PAT (`repo`)** | der Login des Token-Besitzers | ja / ja | über den User | 0 € | gering | mäßig: gilt für alle Repos des Besitzers, kein Permission-Split | **akzeptabel für einen Machine Account, der nichts anderes besitzt**, nur für lokale Läufe nötig |
| **F. SSH Deploy Key (write)** | kein Login; Push-Zuordnung ohne Nutzerkonto | **nein** (nur Git, keine API) / nein | ja (`DeployKey`, nur `always`, API) | 0 € | gering | schwach: „Deploy keys with write access can perform the same actions as an organization member with admin access“ (DOKU), kein Ablauf, keine Passphrase | **nein** |
| **G. GitHub Actions (`GITHUB_TOKEN`)** | `github-actions[bot]` | PR/Approve nur, wenn der Repo-Schalter es erlaubt; bei persönlichen Konten standardmäßig aus (DOKU) | ja (`Integration`) | 0 € | 0 | Token endet mit dem Job, Permissions pro Workflow; Approvals von `github-actions[bot]` zählen nicht für Required Reviews (COMMUNITY) | **ja, als Verifier**, nie als Developer oder Reviewer |

### 3.2 Separate GitHub Accounts (Machine Accounts)

- GitHubs Nutzungsbedingungen: „One person or legal entity may maintain no more than one free Account“ und „You may maintain no more than one free machine account in addition to your free Personal Account“; der Mensch „is ultimately responsible for the machine's actions“ (DOKU, Terms of Service). Automatisch registrierte Konten sind verboten; ein von einem Menschen angelegter Machine Account ist erlaubt.
- Konsequenz: **Seb darf genau einen kostenlosen Machine Account betreiben.** Ein zweiter braucht einen bezahlten Plan auf diesem Konto (dann ist er kein „free machine account“ mehr; INFERRED aus dem Wortlaut, nicht offiziell bestätigt) oder eine Rückfrage beim GitHub-Support.
- In einem persönlichen Repo erhalten Collaborators pauschal Schreibrecht; es gibt nur „repository owner“ und „collaborators“ (DOKU). Ein Machine Account kann also technisch alles, was Rulesets ihm nicht verbieten: andere Branches anlegen, PRs schließen, Kommentare editieren oder löschen („Anyone with write access to a repository can edit comments“, DOKU), Reviews verwerfen („repository administrators or people with write access can dismiss a review“, DOKU). Abschnitt 9 nennt die Gegenmaßnahmen.
- Einbindung in die Agenten-Produkte: Codex Cloud nutzt das GitHub-Konto, das in ChatGPT verbunden ist (OAuth gegen die App „ChatGPT-codex-connector“, VENDOR). Wird dort `forge-codex` statt `Wuerfelduell` verbunden, pusht Codex als `forge-codex` (INFERRED; die OpenAI-Doku beschreibt den Verbindungsvorgang, nicht die Attribution). Claude Code Cloud nutzt analog das GitHub-Konto, das in Sebs claude.ai-Konto verbunden ist; die Claude GitHub App muss zusätzlich auf dem Repo installiert sein (VENDOR). In beiden Fällen muss der Repo-Owner die Vendor-App auf `Wuerfelduell/Forge` installieren und den Machine Account als Collaborator einladen.

### 3.3 GitHub Apps und Bot-Identitäten

- Eine eigene GitHub App kann „independently of a user“ handeln; „API requests made by an app installation are attributed to the app“, Installation Tokens laufen nach 1 Stunde ab, sind auf die installierten Repos und die gewährten Permissions begrenzt (DOKU). Eine App ist ein zulässiger Bypass-Akteur (`Integration`, API).
- Grenze: Der Agent muss den Token tatsächlich benutzen. Codex Cloud und Claude Code Cloud pushen über die Credentials ihrer eigenen Connectoren (bei Claude: „a proxy authenticates on the session's behalf with scoped credentials“, VENDOR). Eine eigene App hilft dort nicht. Sie hilft bei lokalen Läufen (Codex CLI, Claude Code CLI oder Remote Control auf Sebs Rechner), wo ein Credential-Helper einen Installation Token erzeugt. Für V0.1 nicht empfohlen, weil beide Agenten vorrangig in der Cloud laufen.
- Vendor-Bots: Codex Code Review wird per `@codex review` oder automatisch ausgelöst und „posts a review on the pull request“ (VENDOR). Es ist eine echte, authentifizierte Bot-Identität, aber (a) vom selben Anbieter wie der Codex-Developer, (b) Approval-Verhalten nicht dokumentiert. Anthropic bietet mit der Claude GitHub App „Auto-fix“ und Code Review an (VENDOR); ob dabei eine Bot-Identität oder Sebs Konto postet, ist für Review-Antworten dokumentiert (Sebs Konto) und sonst nicht verifiziert.
- Hinweis zu Approvals durch Bots: Offiziell ist nur belegt, dass Copilot-Approvals nicht zählen (DOKU). Dass Approvals von `github-actions[bot]` nicht zählen, während eine eigene GitHub App oder ein Machine Account zählen, stammt aus einer Community-Diskussion (COMMUNITY). Für das V0.1-Modell ist das unerheblich, weil kein Bot approven soll.

### 3.4 Fine-grained PATs und Classic PATs

- Fine-grained PATs sind „limited to access resources owned by a single user or organization“. Ausdrücklich nicht unterstützt: „Using fine-grained personal access token to contribute to repositories where the user is an outside or repository collaborator“ (DOKU). **Ein Machine Account, der Collaborator auf Sebs persönlichem Repo ist, kann also kein fine-grained PAT dafür verwenden.**
- Classic PATs mit Scope `repo` funktionieren, gelten aber für alle Repos des Besitzers; `workflow`-Scope ist für Änderungen an `.github/workflows` nötig (DOKU). Für einen Machine Account, der ausschließlich für Forge existiert, ist das vertretbar. Ablauf setzen.
- PATs sind nur relevant, wenn ein Agent lokal pusht. In der Cloud nutzen beide Agenten ihre Connectoren.
- Fine-grained PATs werden erst nutzbar, wenn das Repo in eine Organisation umzieht und der Machine Account Mitglied ist (Resource Owner = Organisation; persönliche Konten brauchen keine Genehmigung, Organisationen können sie verlangen, DOKU). Siehe Abschnitt 13, Option „Organisation“.

### 3.5 SSH Deploy Keys

- Nur Git-Zugriff, nur ein Repo, lesend oder schreibend; schreibend „can perform the same actions as an organization member with admin access“; keine Passphrase, kein Ablauf (DOKU). Deploy Keys sind Bypass-Akteure (`DeployKey`, Modus nur `always`, API).
- Ein Deploy Key kann keinen PR öffnen, kein Review abgeben, keinen Check schreiben. Forge braucht PRs. **Ungeeignet als Developer- oder Reviewer-Identität.** Einzig denkbarer Einsatz: ein Read-only-Key für einen externen Reviewer, der einen privaten Spiegel liest. Beim öffentlichen Repo unnötig.

### 3.6 GitHub Actions Identity

- `GITHUB_TOKEN` ist ein Installation Token der GitHub-Actions-App, auf das Repo begrenzt, läuft mit dem Job ab (max. 6 h auf GitHub-hosted Runnern); von ihm ausgelöste Events starten keine neuen Workflow-Läufe (DOKU). Standard bei persönlichen Konten: nur `contents` und `packages` lesend; der Schalter „Allow GitHub Actions to create and approve pull requests“ ist bei persönlichen Konten standardmäßig aus (DOKU).
- `pull_request` führt die Workflow-Datei aus dem Merge-Commit des PRs aus; `pull_request_target` die aus dem Basis-Branch, mit dessen Privilegien; GitHub warnt: „You must ensure the checked-out code is only ever inspected as data and never executed“ (DOKU). Fork-PRs bekommen keine Secrets und einen lesenden Token (DOKU).
- Ein übersprungener Job „will report its status as 'Success'. It will not prevent a pull request from merging, even if it is a required check“ (DOKU). Pflicht-Checks dürfen deshalb keine `paths`-Filter haben; sie laufen immer und entscheiden intern.
- Für Required Status Checks kann die App gewählt werden, die den Check liefern muss („select an app that has recently set this check as the expected source“, DOKU). Das sperrt Commit-Statuses anderer Identitäten mit gleichem Namen aus, nicht aber einen zweiten Workflow in demselben PR mit gleichem Job-Namen („make sure that job names are unique across all workflows“, DOKU). Abschnitt 9 schließt diese Lücke über den Vergleich von `.github/**` mit `main`.

### 3.7 Was Rulesets auf diesem Repo können und was nicht

| Fähigkeit | Verfügbar für `Wuerfelduell/Forge` (öffentlich, GitHub Free) | Beleg |
|---|---|---|
| Branch-Rulesets: Pull Request erforderlich, Required Approvals, Stale-Dismissal, Code-Owner-Review, Approval des letzten Pushes, Conversation Resolution, Merge-Methoden, Required Status Checks mit App-Quelle und Up-to-date, Force-Push-Sperre, Lösch-/Erstell-/Update-Sperre, lineare Historie, signierte Commits | **ja** („Rulesets are available in public repositories with GitHub Free“) | DOKU |
| Bypass-Akteure: Repo-Admin, Rollen, Teams, GitHub Apps, Deploy Keys, **einzelne Nutzer**; Modi `always`, `pull_request`, `exempt` | **ja**; Nutzer-Bypass seit 2026-05-07 auf Repo-Ebene per UI, REST und GraphQL | API, CHANGELOG |
| CODEOWNERS mit „Require review from Code Owners“ | **ja** (öffentliches Repo); privat erst ab GitHub Pro | DOKU |
| Push-Rulesets (Dateipfade, Dateigröße, Endungen) | **nein**: „available for the GitHub Team plan in internal and private repositories“ | DOKU |
| Metadaten-Regeln (Commit-Message, Autor-E-Mail, Branch-Namensmuster) | **nein**: nur „Organizations on a GitHub Enterprise plan“ | DOKU |
| „Require workflows to pass before merging“ (Workflow an Ref gepinnt) | **nein**: nur Organisations-/Enterprise-Rulesets | DOKU |
| Enforcement `evaluate` | **nein** (Enterprise) | API |
| Organisations-Rulesets | nein (Team/Enterprise) | DOKU |
| PR-Erstellung auf Collaborators begrenzen | **ja**, seit 2026-02-13 für alle öffentlichen und privaten Repos | CHANGELOG, DOKU |
| Audit Log | nur persönliches Security Log (90 Tage, Kategorien u. a. `repo`, `oauth_access`, `public_key`); Repository-Activity-View zeigt Pushes, Force-Pushes, Branch-Änderungen je authentifiziertem Nutzer | DOKU |

Praktische Folge: **Geschützte Pfade (Workflows, Contracts, Policy) lassen sich auf diesem Plan nicht beim Push sperren, nur beim Merge**: CODEOWNERS erzwingt Sebs Review, und der Verifier macht den PR rot. Ein Developer kann solche Dateien auf seinem Run-Branch ändern; nach `main` kommen sie ohne Seb nicht.

---

## 4. Recommended V0.1 Identity Model

**Leitsatz: Jede Entscheidung, die Forge zählt, ist eine GitHub-Aktion einer eigenen Anmeldung; wer keine hat, liefert einen SHA-gebundenen Payload, den Seb attestiert.**

### 4.1 Identitäten

| Rolle | Identität | Begründung |
|---|---|---|
| Owner | `Wuerfelduell` | existiert; einziger Admin; bleibt bewusst **außerhalb aller Bypass-Listen**, damit auch er `main` nur per PR mit grünen Checks verändern kann. Notfall = Ruleset ändern (sichtbar im Security Log und in der Ruleset-Historie) |
| Codex Developer | `forge-codex` (Machine Account, kostenlos) | Codex ist der Agent, der heute tatsächlich unter Sebs Konto committet (REPO) und laut Projekt die Baseline nach `main` bringt; das eine erlaubte kostenlose Machine Account geht dorthin |
| Claude Developer | **Stufe A:** in V0.1 kein Developer-Zugang; Claude arbeitet als Spec-Autor und Reviewer über den Adapter, oder als Developer nur auf Branches, die Seb danach wie fremden Code reviewt. **Stufe B (empfohlen, sobald Claude Runs fahren soll):** `forge-claude`, zweiter Machine Account auf bezahltem Plan oder nach Zusage des GitHub-Supports, als GitHub-Verbindung in Sebs claude.ai hinterlegt | Ohne zweite Identität wären Claude-Pushes GitHub-seitig Sebs Pushes; damit könnte Claude als Developer das Owner-Review eines Claude-PRs nicht von Seb trennen. Stufe B kostet einen Plan, Stufe A kostet Claude als Developer |
| AI-Reviewer (ChatGPT, Grok, Claude ohne Identität) | keine; Adapter (Abschnitt 10) | ChatGPT-App ist lesend (VENDOR); Grok-Connector ist lesend (VENDOR, Abschnitt 11); eine Review-Identität mit „nur Review“ ist in einem persönlichen Repo ohnehin nicht herstellbar (Collaborator = Schreibrecht) |
| Zusatz-Reviewer mit eigener Identität | `chatgpt-codex-connector` (Codex Code Review) für **Claude-Runs** | authentifiziert, SHA-gebunden durch GitHub; nicht unabhängig von `forge-codex` |
| Verifier | `github-actions[bot]`, Workflows aus `main` | einzige Umgebung, die keinem Developer gehört |

### 4.2 Was das Modell leistet

- `main` ändert sich nur durch Merge eines PRs, den Seb approved hat, nach grünen Checks aus `main`-Workflows, auf aktuellem Stand. Auch Seb kann nicht direkt pushen.
- Jeder Run-Branch gehört genau einer Anmeldung. Ein Developer kann den Branch des anderen weder anlegen noch beschreiben noch löschen; Force-Push ist überall gesperrt.
- Workflows, Contracts, Policy, Test-Konfiguration und Paketdateien kommen nur mit Sebs Code-Owner-Review nach `main`; der Verifier macht jeden Run-PR rot, der sie anfasst.
- Ein Developer kann seinen eigenen PR nicht approven („Pull request authors cannot approve their own pull requests“, DOKU); ein neuer Push verwirft Approvals; der letzte Push muss von jemand anderem als dem Pusher approved sein.
- Externe Reviews sind an den Head-SHA gebunden; GitHub speichert zu jedem Review die `commit_id`. Forge akzeptiert nur Reviews, deren `commit_id` dem gemergten Head entspricht.

### 4.3 Was das Modell nicht leistet (Vorgriff auf Abschnitt 13)

GitHub kennt für jede attestierte KI-Review **Seb** als Entscheider, nicht das Modell. Forge kann den Modellnamen nur als Behauptung in der Attestation mitführen. Ob ChatGPT oder Grok wirklich gelesen hat, beweist der Payload-Hash, nicht GitHub.

---

## 5. Permission Matrix

Legende: ✅ erlaubt und durchgesetzt, ❌ technisch gesperrt, ⚠️ technisch möglich, nur durch Policy/Check verboten, – nicht zutreffend. „Durchgesetzt durch“ nennt den Mechanismus.

| Aktion | Seb (Owner) | `forge-codex` | `forge-claude` (Stufe B) | AI-Reviewer ohne Identität | `github-actions[bot]` | Durchgesetzt durch |
|---|---|---|---|---|---|---|
| `main` direkt pushen | ❌ | ❌ | ❌ | – | ❌ | RS-MAIN: Pull Request erforderlich, keine Bypass-Akteure |
| `main` per PR mergen | ✅ (nach eigenem Approval, Checks grün, aktuell) | ❌ | ❌ | – | ❌ | RS-MAIN: Required Approval + Code Owner + Checks; Developer könnten den Merge-Knopf nur drücken, wenn alle Bedingungen erfüllt sind, und die Code-Owner-Bedingung erfordert Seb |
| Force-Push / Branch löschen (alle Branches) | ❌ | ❌ | ❌ | – | ❌ | RS-ALL: `non_fast_forward`, `deletion`, kein Bypass |
| `forge/run/codex/**` anlegen und pushen | ❌ | ✅ | ❌ | – | ❌ | RS-RUN-CODEX: `creation` + `update`, Bypass nur `forge-codex` |
| `forge/run/claude/**` anlegen und pushen | ❌ | ❌ | ✅ | – | ❌ | RS-RUN-CLAUDE analog |
| `forge/spec/**` anlegen und pushen | ✅ | ✅ | ✅ | – | ❌ | RS-SPEC: nur Force-Push/Löschen gesperrt; Autor wird per Policy geprüft |
| Beliebige andere Branches anlegen | ⚠️ | ⚠️ | ⚠️ | – | ❌ | optional RS-CATCHALL (`creation` auf `~ALL` minus Muster, Bypass Seb) |
| PR öffnen / aktualisieren | ✅ | ✅ (eigener Run-Branch) | ✅ (eigener Run-Branch) | ❌ | ❌ (Schalter aus) | PR-Erstellung auf Collaborators begrenzt; Head-Muster vom Gate geprüft |
| Review approven (zählt) | ✅ | ⚠️ auf fremden PRs | ⚠️ auf fremden PRs | ❌ | ❌ | GitHub: Autor nie; Policy-Check: Reviewer-Login ∉ Developer-Vendor des Runs; Code-Owner-Review bleibt Sebs |
| Review verwerfen (dismiss) | ✅ | ⚠️ | ⚠️ | – | ❌ | GitHub erlaubt Write; `forge-policy` schlägt fehl, wenn ein Dismissal nicht von Seb stammt |
| Kommentar/Review-Text anderer editieren | ✅ | ⚠️ | ⚠️ | – | ❌ | GitHub erlaubt Write, Edit-Historie sichtbar; `forge-policy` prüft Attestation gegen `commit_id` und Hash, nicht gegen Text allein |
| `.github/**`, `forge/policy.json`, `forge/contracts/**`, `CODEOWNERS`, `package*.json`, `vitest.config.*`, `tsconfig*` nach `main` bringen | ✅ per PR mit eigenem Review | ❌ ohne Seb | ❌ ohne Seb | – | ❌ | CODEOWNERS + „Require review from Code Owners“; `forge-verify` rot bei Run-PRs |
| Rulesets, CODEOWNERS, Repo-Settings ändern | ✅ | ❌ | ❌ | – | ❌ | Admin-Recht; nur Seb ist Admin |
| Checks schreiben (`forge-*`) | ❌ | ❌ | ❌ | – | ✅ | Required Check mit Quelle „GitHub Actions“; fremde Commit-Statuses zählen nicht |
| Workflow-Dateien, die Checks erzeugen, ändern | ✅ per PR | ⚠️ auf eigenem Branch, ❌ nach `main` | ⚠️ / ❌ | – | ❌ | `forge-verify` aus `main` vergleicht `.github/**` des PR-Heads mit `main` und wird rot bei Abweichung |
| Owner-Ausnahme bestätigen | ✅ (Kommentar `/forge override <id>` + Approval) | ❌ | ❌ | – | ❌ | `forge-policy` akzeptiert Override nur vom Login mit Rolle `owner` in `forge/policy.json` |
| Review-Payload erzeugen | – | – | – | liest öffentliches Repo / Payload | ✅ (`forge-review-packet`) | Abschnitt 10 |
| Attestiertes Review einreichen | ✅ | ❌ | ❌ | ❌ | ❌ | nur Owner-Login darf Attestations-Reviews einreichen (Policy) |

Hinweis zur Zeile „Review approven“: In einem persönlichen Repo zählt jedes Approval einer Schreibidentität für „Required Approvals“. Dass `forge-codex` einen Claude-PR approven kann, ist deshalb GitHub-seitig nicht zu verhindern. Forge verlangt zusätzlich Sebs Code-Owner-Review auf jedem PR, der Contract- oder Policy-Pfade berührt, und `forge-policy` prüft die Unabhängigkeit aller Reviews am Head. Wer also was approved hat, ist nachvollziehbar und policy-geprüft, auch wenn GitHub allein es nicht sperrt.

---

## 6. main Ruleset

**Name:** `forge-main` · **Ziel:** `~DEFAULT_BRANCH` · **Enforcement:** `active` · **Bypass-Liste: leer.**

| Regel | Einstellung | Warum |
|---|---|---|
| Restrict deletions | an | `main` darf nie verschwinden |
| Block force pushes (`non_fast_forward`) | an | Historie ist Beweismittel (Deep Audit, DRT-18) |
| Restrict creations | aus (Branch existiert) | – |
| Require linear history | **aus** | Forge braucht Vorfahren-Beziehungen: der geprüfte Run-Head muss nach dem Merge Vorfahre von `main` sein (Start-Gate „Base muss Vorfahr sein“). Squash würde den reviewten SHA aus der Historie entfernen |
| Require a pull request before merging | an | einziger Weg nach `main` |
| · Required approvals | **1** | Seb; eine zweite Pflicht-Approval wäre in V0.1 nur durch einen Developer-Bot erfüllbar und damit wertlos |
| · Dismiss stale approvals on new push | an | Head-Drift (Deep Audit E-01, DRT-02) |
| · Require review from Code Owners | an | zieht Seb auf jeden PR, der geschützte Pfade berührt |
| · Require approval of the most recent reviewable push | an | der Approver darf nicht der letzte Pusher sein |
| · Require conversation resolution | an | blockierende Findings werden sichtbar abgearbeitet, nicht übersprungen (DRT-02-Gedächtnis auf GitHub-Ebene) |
| · Allowed merge methods | **nur Merge Commit** | siehe lineare Historie; Rebase würde neue SHAs erzeugen, Squash den Head verlieren. Forge liest `merge_commit_sha` des PRs als Abnahme-Commit |
| · Automatically request Copilot review | aus | kein Teil des Modells |
| Require status checks to pass | an; Checks: `forge-contract`, `forge-gate`, `forge-verify`, `forge-policy`; **Quelle: GitHub Actions**; **Require branches to be up to date: an** (`strict_required_status_checks_policy: true`) | Up-to-date erzwingt die Neuprüfung nach jeder `main`-Bewegung (Exit-Kriterium 7 des V0.1-Berichts). „Do not require status checks on creation“ aus |
| Require signed commits | **aus in V0.1** | Agenten-Commits sind unsigniert (REPO); die Regel würde jeden Merge blockieren. Kandidat für V0.2, wenn Developer-Identitäten signieren können |
| Require deployments / merge queue / code scanning | aus | nicht benötigt |

**Zur Bypass-Liste:** Bleibt sie leer, gilt alles auch für Seb. Das ist gewollt. Wenn Seb etwas an den Regeln vorbei braucht, ändert er das Ruleset; das ist der einzige „Administrator Bypass“ und bleibt sichtbar. Ein Eintrag „Repository admin, pull_request“ wäre die bequemere Variante, würde aber jeden Owner-Fehler zum stillen Durchgriff machen. Nicht empfohlen.

---

## 7. run/** Ruleset

Drei Rulesets, weil die Branch-Hoheit pro Developer nur über getrennte Bypass-Listen ausdrückbar ist. **Das erfordert einen Namensraum je Agent** und ist eine Abweichung vom V0.1-Bericht (K5: `forge/run/<TASK>-<n>`): empfohlen `forge/run/<agent>/<TASK>-<n>`, z. B. `forge/run/codex/TASK-0006-1`.

**RS-ALL `forge-all-branches`** · Ziel: `~ALL` · Bypass: leer

| Regel | Einstellung |
|---|---|
| Block force pushes | an |
| Restrict deletions | an (Aufräumen erfolgt durch Seb per Ruleset-Ausnahme oder nach V0.1 über eine Bypass-Regel `Repository admin, always` nur für `deletion`) |

**RS-RUN-CODEX `forge-run-codex`** · Ziel: Include `refs/heads/forge/run/codex/**/*` · Bypass: **User `forge-codex`, Modus `always`**

| Regel | Einstellung | Wirkung |
|---|---|---|
| Restrict creations | an | nur `forge-codex` kann Branches in diesem Namensraum anlegen |
| Restrict updates | an | nur `forge-codex` kann dort pushen; auch Seb nicht (kein „Update branch“-Knopf für Seb; Nachziehen von `main` macht der Developer per Merge-Commit) |
| Block force pushes | an (redundant zu RS-ALL, explizit) | Push-Historie des Runs ist unveränderlich |
| Restrict deletions | an | Run-Branches bleiben bis zur Owner-Aufräumung |

**RS-RUN-CLAUDE `forge-run-claude`**: identisch mit Ziel `refs/heads/forge/run/claude/**/*` und Bypass User `forge-claude`. In Stufe A (kein `forge-claude`) wird dieses Ruleset mit leerer Bypass-Liste angelegt; der Namensraum ist dann für alle gesperrt und wird mit Stufe B geöffnet.

**RS-SPEC `forge-spec`** · Ziel: `refs/heads/forge/spec/**/*` · Bypass: leer · Regeln: Block force pushes, Restrict deletions. Spec-Branches dürfen alle Schreibidentitäten anlegen; wer der Spec-Autor ist, prüft `forge-contract` am PR-Autor-Login.

**Optional RS-CATCHALL `forge-no-stray-branches`** · Ziel: Include `~ALL`, Exclude `refs/heads/forge/run/**/*`, `refs/heads/forge/spec/**/*`, `~DEFAULT_BRANCH` · Bypass: Repository admin `always` · Regel: Restrict creations. Verhindert, dass Developer außerhalb der Namensräume Branches anlegen (Scratch-Branches, Namensverwechslungen). Nicht sicherheitskritisch, weil `main` ohnehin nur über PRs erreichbar ist.

**Pattern-Syntax:** Rulesets nutzen fnmatch; `*` matcht keinen `/`, `**` schon; GitHubs Beispiel ist `qa**/**/*` (DOKU). `forge/run/codex/**/*` deckt `forge/run/codex/TASK-0006-1` und tiefere Ebenen ab. Bei der Anlage in der UI das Muster am Testbranch prüfen.

**Zur Nutzer-Bypass-Funktion:** Einzelne Nutzer als Bypass-Akteure gibt es auf Repo-Ebene seit 2026-05-07 (CHANGELOG); die REST-Referenz führt `actor_type: User` (API). Sollte die UI das wider Erwarten nicht anbieten, ist die Alternative ein Umzug in eine Organisation mit Teams (Abschnitt 13).

---

## 8. Contract PR Rules

Ein Contract-PR ist kein eigener Branch-Typ, sondern ein PR gegen `main`, dessen Diff ausschließlich unter `forge/contracts/` liegt. Die Regeln kombinieren RS-MAIN, CODEOWNERS und den Check `forge-contract`.

**CODEOWNERS** (`.github/CODEOWNERS`, letzte passende Zeile gewinnt, DOKU):

```
# Forge: nur der Owner darf diese Pfade nach main bringen
*                       @Wuerfelduell
/.github/               @Wuerfelduell
/forge/policy.json      @Wuerfelduell
/forge/contracts/       @Wuerfelduell
/package.json           @Wuerfelduell
/package-lock.json      @Wuerfelduell
/vitest.config.*        @Wuerfelduell
/tsconfig*.json         @Wuerfelduell
```

Die erste Zeile `*` macht Seb zum Code Owner für alles; damit verlangt jeder PR Sebs Approval, was der V0.1-Realität (Seb ist der einzige menschliche Entscheider) entspricht. Code Owner müssen Schreibrecht haben; Seb ist Admin (DOKU). Code Owner werden auf Draft-PRs nicht angefordert (DOKU); Agenten öffnen deshalb Draft-PRs und markieren erst nach grünen Checks „Ready for review“.

**Check `forge-contract`** (läuft immer, entscheidet intern; ein Skip zählt als Erfolg und ist deshalb verboten):

1. Ist der Diff zu `main` ausschließlich unter `forge/contracts/`? Sonst: kein Contract-PR; der Check meldet „n/a“ grün nur, wenn der Diff **gar keine** Contract-Datei enthält; mischt der PR Contract und Code, wird er rot.
2. Head-Branch matcht `forge/spec/<TASK>`; genau eine Contract-Datei `forge/contracts/<TASK>.md`; Pfad und `TASK` stimmen überein.
3. Parser des Kerns akzeptiert die Datei (`---json`-Frontmatter, keine Statusfelder); Content-Hash und Blob-SHA in die Summary.
4. Contract-Commit ist kein Merge-Commit (DRT-05); alle Commits des PRs sind Nachfolger des aktuellen `main`.
5. PR-Autor-Login hat in `forge/policy.json` die Rolle `spec_author` oder `owner`.
6. Mutanten- und Required-Checks-Liste sind nicht leer (K7).

**Freigabe:** Approving Review einer Identität ≠ Spec-Autor. Da Seb Code Owner ist, ist sein Approval in V0.1 stets Pflicht. Hat ein Agent den Contract geschrieben, ist Sebs Approval zugleich die unabhängige Freigabe; hat Seb ihn geschrieben, braucht es ein attestiertes KI-Review (Abschnitt 10) **und** Sebs Merge; GitHub kennt dann nur Seb, Forge kennt die Attestation.

**Merge:** nur Merge Commit; `merge_commit_sha` des PRs ist der Contract-Commit für den Handoff.

---

## 9. Run PR Rules

Ein Run-PR ist ein PR von `forge/run/<agent>/<TASK>-<n>` gegen `main`. RS-MAIN gilt; dazu:

**Check `forge-gate`** (aus `main`, nur Daten lesen, kein PR-Code ausführen):

1. Head-Branch matcht `forge/run/(codex|claude)/<TASK>-<n>`; PR-Autor-Login ist der in `forge/policy.json` für diesen Namensraum eingetragene Developer. GitHub garantiert durch RS-RUN-*, dass nur dieser Login dort pushen konnte; der Check macht es lesbar.
2. Merge-Base von Head und `main` ist der Merge-Commit des freigegebenen Contract-PRs oder ein Nachfolger davon; der Contract in `main` ist unverändert seit dem Branch-Punkt (Blob-SHA).
3. Diff Head gegen Merge-Base (ohne Rename-Erkennung, DRT-21) berührt keinen geschützten Pfad: `.github/**`, `forge/policy.json`, `forge/contracts/**`, `CODEOWNERS`, `package.json`, Lockfile, `vitest.config.*`, `tsconfig*`. Groß-/Kleinschreibungs- und Alias-Varianten der Pfade gelten als Treffer (DRT-23/24).
4. `.github/**` des PR-Heads ist byte-gleich mit `main`. Damit ist jeder Test-Job, der mit `pull_request` aus dem PR-Head läuft, nachweislich die Workflow-Definition aus `main`; ein zweiter Workflow mit gleichem Job-Namen (Spoofing) wäre ein Diff und fällt hier durch.
5. Read-Quittung im PR-Text entspricht Content-Hash und Blob des Contracts (K4).
6. Kein Review am Head wurde verworfen, außer durch den Owner (`review_dismissed`-Timeline-Events); alle Reviews am Head stammen von Logins mit Rolle `reviewer`/`owner` und ≠ Developer-Vendor des Runs.
7. `FORGE_HALT` nicht gesetzt.

**Check `forge-verify`**: führt den PR-Code aus (Tests, Mutanten) und läuft deshalb mit `pull_request`, `permissions: contents: read`, keine Secrets, kein Cache, Actions auf volle SHAs gepinnt (DOKU). Er ist vertrauenswürdig, weil `forge-gate` Punkt 4 die Workflow-Datei als unverändert nachweist. Inhalt: siehe FORGE-INDEPENDENT-VERIFIER-DESIGN.md.

**Check `forge-policy`**: liest `forge/policy.json` aus `main` (nie aus dem PR), prüft Rollen aller Beteiligten, Unabhängigkeit der Reviews, Owner-Overrides und Attestations (Abschnitt 10). Schreibt die Zustandssummary.

**Review und Merge:** mindestens ein Approval am Head von einer Identität ≠ Developer (GitHub: Autor kann nicht; Policy: nicht derselbe Vendor); Code-Owner-Approval von Seb (immer, wegen `*`-Zeile); Branch aktuell gegenüber `main`; Merge durch Seb als Merge Commit = `accepted`. Nachziehen von `main` auf den Run-Branch erzeugt einen Merge-Commit **auf dem Run-Branch** (Force-Push ist gesperrt); der Diff in Punkt 3 wird deshalb gegen die Merge-Base gerechnet, nicht gegen den Start-Commit. Jeder Push, auch ein Nachzieh-Merge, verwirft Approvals und erfordert eine neue Review-Runde; das ist der Preis für Up-to-date und bewusst so.

**Was der Developer trotzdem kann und wie es sichtbar wird:**

| Handlung | GitHub-Faktum | Forge-Reaktion |
|---|---|---|
| geschützte Datei auf dem eigenen Branch ändern | PR-Diff | `forge-gate` rot; CODEOWNERS fordert Seb |
| fremdes Review verwerfen | Timeline `review_dismissed` mit Actor | `forge-policy` rot |
| Kommentartext anderer editieren | Edit-Historie mit Nutzer und Zeit (DOKU) | Attestation wird gegen `commit_id` und Payload-Hash geprüft, nicht gegen den Text |
| PR schließen oder neu öffnen | Timeline | kein Effekt auf `main` |
| den anderen Developer-PR approven | Review mit Login | GitHub zählt es; `forge-policy` rot, wenn Vendor-Regel verletzt; Sebs Code-Owner-Approval bleibt Pflicht |
| Workflow-Lauf abbrechen | Actions-Log | Required Check nicht grün, kein Merge |

---

## 10. External Reviewer Adapter

Für Reviewer ohne GitHub-Identität (ChatGPT heute, Grok, Claude in Stufe A). **Grundsatz: Das Modell liest Identifikatoren und Inhalt aus unveränderlichen Quellen, nicht aus einem Chat-Paste; Seb überträgt nur das Urteil, und GitHub protokolliert Seb.**

### 10.1 Review-Payload (erzeugt vom Verifier, Job `forge-review-packet`)

Nach grünem `forge-gate` schreibt der Workflow aus `main` ein Paket als Check-Summary und als Workflow-Artefakt:

```json
{
  "forgeReviewPacket": 1,
  "repo": "Wuerfelduell/Forge",
  "pr": 42,
  "headSha": "<40 hex>",
  "mergeBaseSha": "<40 hex>",
  "contract": { "path": "forge/contracts/TASK-0006.md", "blob": "<40 hex>", "contentHash": "sha256:<64 hex>" },
  "changedFiles": [ { "path": "src/domain/accusation.ts", "blobBefore": "<40 hex|null>", "blobAfter": "<40 hex>" } ],
  "checks": { "forge-gate": "success", "forge-verify": "success" },
  "diffUrl": "https://github.com/Wuerfelduell/Forge/compare/<mergeBaseSha>...<headSha>.diff",
  "rawBase": "https://raw.githubusercontent.com/Wuerfelduell/Forge/<headSha>/",
  "packetHash": "sha256:<64 hex über das kanonische JSON ohne dieses Feld>"
}
```

Alle URLs sind SHA-gebunden und damit unveränderlich; das Repo ist öffentlich, also ohne Zugang lesbar. Wird das Repo privat, braucht der Reviewer ein lesendes Credential (siehe 11).

### 10.2 Reviewer-Seite

Seb gibt dem Modell nur: Rollenvorlage `forge/roles/reviewer.md` + den `packetHash` + die Paket-URL (Check-Summary oder Artefakt). Das Modell lädt Paket, Diff und Dateien selbst (Grok über seinen GitHub-Connector oder per URL; ChatGPT über die lesende GitHub-App oder per URL) und liefert ein Review mit festem Kopf:

```
FORGE-REVIEW v1
repo: Wuerfelduell/Forge
pr: 42
headSha: <40 hex, aus dem Paket kopiert>
packetHash: sha256:<64 hex, aus dem Paket kopiert>
reviewer: grok-4 | chatgpt | claude   (Behauptung des Modells)
verdict: APPROVE | REQUEST_CHANGES
findings:
  - [BLOCKING|MAJOR|MINOR] <Datei>:<Zeile> <Befund>
```

Weicht der Head-SHA oder der Packet-Hash ab, ist das Review ungültig; das ist der Mechanismus gegen „Review auf dem falschen Stand“ (P-07, Deep Audit).

### 10.3 Attestation durch Seb

1. Seb vergleicht `headSha` und `packetHash` des Reviews mit der Check-Summary des PRs (zwei Strings, am Handy machbar).
2. Seb reicht auf GitHub **ein Review als er selbst** ein: Zustand `Approve` oder `Request changes` gemäß `verdict`, Body = das vollständige Modell-Review inklusive Kopf, davor eine Zeile `FORGE-ATTEST owner=Wuerfelduell model=<reviewer> headSha=<…> packetHash=<…>`.
3. GitHub speichert zu diesem Review `commit_id` = Head-SHA zum Zeitpunkt der Abgabe. `forge-policy` akzeptiert die Attestation nur, wenn `commit_id == headSha` im Body **und** `headSha == aktueller PR-Head` **und** `packetHash` gleich dem vom Workflow berechneten Wert.
4. Ein späterer Push verwirft das Approval (Stale-Dismissal) und ändert den Head; der Zyklus beginnt neu.

**Klarstellung, wie gefordert:** Für GitHub ist der Approver **Seb**. Rulesets, Required Reviews und Merge-Berechtigung sehen ausschließlich `Wuerfelduell`. Der Modellname im Body ist eine von Seb übernommene Behauptung. Forge zählt die Attestation als Rolle `owner_attested_review` mit Attribut `model`, nicht als eigene Identität. Unabhängigkeit gegenüber dem Developer besteht, weil Seb kein Developer ist; Unabhängigkeit gegenüber Seb selbst besteht nicht.

**Warum nicht als Datei committen:** Ein Commit in den Run-Branch würde den Head verschieben und das Review entwerten; ein Commit nach `main` bräuchte einen eigenen PR. Reviews bleiben in GitHub (Review-Objekt mit `commit_id`), das Status-Issue verlinkt sie. Review-Texte sind durch Schreibidentitäten editierbar, aber mit sichtbarer Historie; Zustand und `commit_id` sind nicht editierbar.

---

## 11. Grok Integration

**Faktenlage (VENDOR, xAI-Ankündigung vom 2026-05-06):** Grok bietet Connectors, darunter GitHub, mit „search code, summarize PRs, review changes“, plus „Bring Your Own MCP“. Der Connector authentifiziert sich mit einem GitHub-Konto, das der Nutzer verbindet. Von Schreibzugriff (Reviews posten) ist nicht die Rede. xAI veröffentlicht außerdem `grok-build` (Terminal-Coding-Agent, Apache 2.0) ohne dokumentierte GitHub-App-Identität. **Eine Grok-eigene GitHub-Identität, die Reviews abgibt, ist nicht belegt; das Modell nimmt sie nicht an.**

**Wie Grok den SHA-gebundenen Payload ohne Schreibrecht erhält:**

| Weg | Voraussetzung | Bewertung |
|---|---|---|
| **W1: Öffentliche URLs** (Paket als Check-Summary/Artefakt, Diff unter `compare/<base>...<head>.diff`, Dateien unter `raw.githubusercontent.com/.../<headSha>/`) | Repo bleibt öffentlich; Grok darf URLs abrufen | **empfohlen für V0.1**: kein Credential, SHA-gebunden, unveränderlich |
| **W2: Grok-GitHub-Connector** mit einem Konto, das lesen darf | ein GitHub-Konto in Grok verbinden; bei öffentlichem Repo reicht jedes Konto, bei privatem ein Collaborator | funktioniert laut xAI für PR-Zusammenfassung und Review; **nicht Sebs Owner-Konto verbinden** (Grok hätte sonst OAuth-Zugriff auf alles, was Seb sieht). Ein weiteres kostenloses Konto ist durch die ToS nicht gedeckt, wenn `forge-codex` schon existiert; W1 vermeidet das |
| **W3: Read-only Deploy Key** für einen privaten Spiegel | privates Repo, Grok kann SSH (unwahrscheinlich) | nicht praktikabel |
| **W4: Eigenes MCP** („Bring Your Own MCP“) von Seb betrieben, das nur `GET` auf Paket, Diff und Dateien je SHA erlaubt | Seb hostet einen kleinen Read-only-Server | für V0.2, wenn das Repo privat wird; in V0.1 unnötig |

**Ablauf mit Grok als drittem Reviewer:**

1. `forge-gate` grün → `forge-review-packet` erzeugt Paket und Hash.
2. Seb gibt Grok Rollenvorlage, Paket-URL und `packetHash` (keine Inhalte, keine getippten SHAs).
3. Grok lädt Paket, Diff, Dateien; liefert `FORGE-REVIEW v1` mit kopiertem `headSha` und `packetHash`.
4. Seb attestiert wie in 10.3; `forge-policy` prüft.
5. Für die Unabhängigkeitsregel in `forge/policy.json` zählt Grok als Vendor `xai`, also unabhängig von `forge-codex` (OpenAI) und `forge-claude` (Anthropic).

**Grenzen:** Grok sieht nur, was öffentlich ist; eine Review-Zusage von Grok ist nicht authentifiziert; Rate- und Kontextgrenzen des Connectors sind nicht dokumentiert. Ob Grok den Diff vollständig liest oder zusammenfasst, kann Forge nicht prüfen; dagegen hilft nur die Pflicht, konkrete Datei-/Zeilenbefunde zu liefern, die `forge-policy` gegen `changedFiles` abgleicht (ein Befund auf einer nicht geänderten Datei macht das Review ungültig).

---

## 12. Setup Checklist

Reihenfolge ist bewusst. Alles sind Owner-Handgriffe, keine Code-Änderungen außer den genannten Dateien. **Nichts davon wurde ausgeführt.**

**Vorbereitung**

1. Entscheidung: Repo bleibt öffentlich (Free genügt) oder wird privat (dann vorher GitHub Pro für `Wuerfelduell`, sonst keine Rulesets und keine CODEOWNERS; DOKU).
2. Repo-Setting **Pull requests → Collaborators only** (Settings › General › Features; CHANGELOG 2026-02-13). Schließt Fremd-PRs.
3. Actions-Settings: Default workflow permissions **Read**; „Allow GitHub Actions to create and approve pull requests“ **aus** (Standard bei persönlichen Konten, prüfen); Fork-PR-Workflows „Require approval for all outside collaborators“.
4. 2FA auf `Wuerfelduell` prüfen; GitHub Mobile für Reviews und Merges einrichten.

**Identitäten**

5. Machine Account `forge-codex` anlegen (eigene E-Mail, 2FA, Profilhinweis „machine account operated by @Wuerfelduell“). Das ist der eine kostenlose Machine Account.
6. `forge-codex` als Collaborator einladen (Schreibrecht ist in persönlichen Repos die einzige Stufe, DOKU); Einladung im Bot-Konto annehmen.
7. In ChatGPT/Codex die GitHub-Verbindung auf `forge-codex` umstellen (Settings → GitHub trennen, neu mit `forge-codex` verbinden); die App „ChatGPT-codex-connector“ bleibt vom Owner auf `Wuerfelduell/Forge` installiert. Spike: ein Test-Push auf `forge/run/codex/SPIKE-1` muss im Activity-View als `forge-codex` erscheinen.
8. Entscheidung Stufe A oder B für Claude. Bei B: Machine Account `forge-claude` auf bezahltem Plan oder nach Support-Zusage; Collaborator; GitHub-Verbindung in Sebs claude.ai-Konto auf `forge-claude` umstellen; Claude GitHub App bleibt installiert. Spike wie in 7.
9. Keine PATs, keine Deploy Keys anlegen, solange beide Agenten in der Cloud laufen. Falls ein Agent lokal pusht: Classic PAT mit `repo` (+`workflow` nur, wenn er Workflows bauen soll, was Developer nie dürfen) **auf dem Machine Account**, 90 Tage Ablauf.

**Dateien (per PR nach `main`, von Seb reviewt)**

10. `.github/CODEOWNERS` wie in Abschnitt 8.
11. `forge/policy.json` v0: Logins → Rollen und Vendor (`Wuerfelduell`: owner; `forge-codex`: developer, vendor openai, namespace `forge/run/codex/`; `forge-claude`: developer, vendor anthropic, namespace `forge/run/claude/`; attestierbare Modelle: `chatgpt`, `grok`, `claude`), geschützte Pfade, Unabhängigkeitsregel „Reviewer-Vendor ≠ Developer-Vendor“, `requiredAttestedReviews: 1`.
12. `forge/roles/{developer,reviewer,spec-author}.md` mit Handoff- und Paket-Platzhaltern.
13. Workflows `forge-contract.yml`, `forge-run.yml` (Jobs `forge-gate`, `forge-verify`, `forge-policy`, `forge-review-packet`), `forge-status.yml`; alle ohne `paths`-Filter, Actions auf SHA gepinnt, `permissions` minimal. Inhalt: Verifier-Thread.

**Rulesets (Settings › Rules › Rulesets)**

14. `forge-all-branches` (RS-ALL).
15. `forge-main` (RS-MAIN) zunächst **ohne** Required Status Checks aktivieren, damit die Workflow-PRs aus Schritt 13 überhaupt mergen können; nach dem ersten grünen Lauf die vier Checks als Required mit Quelle „GitHub Actions“ und Up-to-date nachtragen.
16. `forge-run-codex`, `forge-run-claude`, `forge-spec`, optional `forge-no-stray-branches`.
17. Negativtests (Exit-Kriterium 5/10 des V0.1-Berichts): Seb versucht direkten Push auf `main` (muss scheitern); `forge-codex` versucht Push auf `forge/run/claude/x` und Force-Push auf eigenen Branch (müssen scheitern); ein PR mit geändertem Workflow muss `forge-gate` rot und Code-Owner-Review anfordern; ein Commit-Status `forge-verify` per API von `forge-codex` darf den Required Check nicht erfüllen.

**Adapter**

18. Erste attestierte Review durchspielen (ChatGPT oder Grok über W1) auf einem Test-PR; `forge-policy` muss die Attestation anerkennen und bei manipuliertem `headSha` ablehnen.

**Historie**

19. Die bestehenden Branches enthalten Commits unter Sebs Identität; sie werden nicht umgeschrieben (Force-Push ist ab RS-ALL ohnehin gesperrt). Die Erst-Integration nach `main` (Codex, läuft) ist der letzte Merge, der Seb-identische Developer-Commits enthält; ab dann gilt das Modell.

---

## 13. Known Limitations

1. **Seb ist der einzige authentifizierte Entscheider.** Jede KI-Review ohne eigene Identität wird GitHub-seitig zu Sebs Review. Forge kann den Modellnamen nur als Behauptung mitführen. Eine Kollusion „Seb attestiert ungelesen“ ist nicht technisch verhinderbar; sie ist durch Packet-Hash und Befund-Abgleich nur erschwert.
2. **Ein kostenloser Machine Account.** Die ToS erlauben genau einen; die zweite Developer-Identität (Claude) kostet einen bezahlten Plan oder braucht die Zusage des GitHub-Supports. In Stufe A kann Claude keine Runs als eigenständiger Developer fahren, ohne dass GitHub den Push Seb zuschreibt.
3. **Claude Cloud pusht mit dem verbundenen Konto.** Welche Identität Claude hat, entscheidet die GitHub-Verbindung in Sebs claude.ai-Konto, nicht Forge. Dass eine Umstellung auf `forge-claude` wie erwartet funktioniert, ist INFERRED und braucht den Spike aus Schritt 8. Gleiches gilt für Codex (Schritt 7).
4. **Collaborator = Schreibrecht.** Persönliche Repos kennen keine Rollen. Developer-Bots können Reviews verwerfen, Kommentare editieren, PRs schließen, fremde PRs approven. Diese Handlungen sind sichtbar (Timeline, Edit-Historie) und werden von `forge-policy` als Verstoß gewertet, aber nicht von GitHub gesperrt.
5. **Geschützte Pfade sind nur merge-geschützt, nicht push-geschützt.** Push-Rulesets (Dateipfade) gibt es auf diesem Plan nicht. CODEOWNERS plus Verifier verhindern den Weg nach `main`, nicht die Änderung auf dem Run-Branch.
6. **Kein „Require workflows“ und keine Metadaten-Regeln.** Die Workflow-Integrität hängt am Vergleich `.github/**` gegen `main` im Gate (Abschnitt 9, Punkt 4) und am Code-Owner-Review. Ein Fehler in dieser einen Prüfung öffnet die Verifier-Spoofing-Lücke; der Verifier-Thread sollte sie mit dem bösartigen Test-PR (Exit-Kriterium 5) abdecken.
7. **Signierte Commits nicht erzwingbar**, weil Agenten unsigniert committen. Autor-Strings bleiben kosmetisch; nur die pushende Anmeldung ist belastbar. Die Repository-Activity-View zeigt sie; ein Audit Log gibt es für persönliche Konten nicht, nur das 90-Tage-Security-Log des Kontos.
8. **Admin ist Single Point.** Seb kann Rulesets, CODEOWNERS und Policy ändern. Das ist gewollt (Owner), aber bedeutet: Ein kompromittiertes Owner-Konto kompromittiert Forge. 2FA und Passkeys sind Pflicht, nicht Option.
9. **Approvals von Bots:** Die Aussage, dass Approvals einer eigenen GitHub App oder eines Machine Accounts für Required Reviews zählen, während `github-actions[bot]` nicht zählt, ist nur durch Community-Quellen belegt. Für dieses Modell irrelevant, solange kein Bot approven soll; relevant, falls V0.2 Bot-Reviewer mit eigener Identität einführt.
10. **Öffentliches Repo.** Code, Contracts und Reviews sind weltweit lesbar. Das ist zugleich die Voraussetzung dafür, dass Rulesets kostenlos sind und Grok ohne Credential lesen kann. Ein Wechsel auf privat erfordert GitHub Pro **und** einen Lesepfad für externe Reviewer (W2 oder W4).
11. **Fine-grained PATs fallen aus**, solange das Repo einem persönlichen Konto gehört und die Bots Collaborators sind. Lokale Läufe brauchen Classic PATs auf dem Bot-Konto.
12. **Nutzer-Bypass ist neu** (Mai 2026). Sollte die UI ihn für dieses Repo nicht anbieten, bleibt für die Branch-Hoheit je Developer nur der Umzug in eine Organisation mit Teams.
13. **Codex Code Review ist nicht unabhängig von Codex.** Als Zusatz-Reviewer nur für Claude-Runs sinnvoll; ob er approven kann oder nur kommentiert, ist nicht dokumentiert.
14. **Up-to-date plus Stale-Dismissal kostet Review-Runden.** Jedes Nachziehen von `main` verwirft Approvals; bei zwei parallelen Runs ist mit einer zusätzlichen Attestation pro Run zu rechnen. Der Run-Recovery-Bericht behandelt die Parallel-Policy.

**Option für V0.2, nicht V0.1: Umzug in eine kostenlose Organisation.** Sie brächte Rollen (Read/Triage/Write/Maintain), Teams als Bypass-Akteure, fine-grained PATs mit Organisation als Resource Owner, ein Organisations-Audit-Log und den Schalter „Allow GitHub Actions to create and approve pull requests“ auf Org-Ebene. Sie brächte **keine** zusätzlichen Identitäten (Machine-Account-Regel bleibt), keine Push-Rulesets und keine Org-Rulesets (beides Team-Plan). Für die vier Rollen von V0.1 ist sie nicht nötig; sie wird nötig, wenn ein Reviewer-Bot mit eigener Identität nur lesen und reviewen, aber nicht schreiben dürfen soll.

---

## Anhang: Entscheidungen, die Seb treffen muss, bevor umgesetzt wird

1. Repo öffentlich lassen (0 €, Grok liest frei) oder privat machen (GitHub Pro, Lesepfad für Reviewer nötig)?
2. Claude als Developer in V0.1 (Stufe B, zweiter Machine Account kostenpflichtig) oder nur als Spec-Autor/Reviewer über den Adapter (Stufe A)?
3. Namensraum je Agent `forge/run/<agent>/<TASK>-<n>` akzeptiert (Abweichung von K5)?
4. Merge-Methode ausschließlich Merge Commit (Historie bleibt, keine lineare Historie) akzeptiert?
5. Soll `forge-codex` auch Spec-Autor sein dürfen, oder schreibt in V0.1 nur Seb Contracts?
