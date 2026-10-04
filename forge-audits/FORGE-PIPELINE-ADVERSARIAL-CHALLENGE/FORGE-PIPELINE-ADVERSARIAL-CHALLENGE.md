# FORGE PIPELINE ADVERSARIAL CHALLENGE

**Rolle:** Unabhängiger Security-Reviewer (NICHT Designer). Read-only.
**Repo:** `Forge-Dice/Forge`, `main = 3d7545d843883418348004e68717399a64da7a7d` (verifiziert via GitHub-API).
**Datum:** 2026-10-03.
**Methode:** Design-Dokumente gelesen, aber ihre Schlussfolgerungen nicht ungeprüft übernommen. GitHub-Semantik gegen `github/docs`-Quellen und `actions/checkout`-Quelltext belegt. Git-Verhalten in lokalen Experimenten reproduziert. Live-Repo-Zustand über die GitHub-API geprüft. Neue Angriffe (nicht in Deep Audit / Red Team / Identity / Verifier / Contract V2 / Hardening / Drill) sind mit **★ NEU** markiert.

Angriffs-IDs: `PA-xx`. Querverweise auf vorhandene Findings: DRT- (Red Team), A-/V-/NRT-/C-/E- (Deep Audit), AC-/T-/S- (Verifier Design), ACV- (Contract V2), K-/P-/O-/S-/D- (Hardening Plan), FI-/N- (Drill), B-/F- (Org Migration Delta).

---

## 0. Belegter Ist-Zustand (Fundament für jedes Urteil)

Jedes „wirkt / wirkt nicht" unten gilt gegen das **vollständig implementierte, geplante V0.1-System**. Der tatsächliche Repo-Zustand ist davon weit entfernt. Verifiziert am 2026-10-03 über die GitHub-API (authentifiziert als `Wuerfelduell`, Org-Owner):

| Fakt | Beleg | Konsequenz |
|---|---|---|
| **Keine Workflows vorhanden.** `actions_list list_workflows` → `total_count: 0`. | API | Verifier, Gate, Approval-Check, Handoff existieren heute **nicht**. Kein mechanischer Schutz aktiv. |
| **Keine Tags, keine Releases.** `list_tags` → `[]`, `list_releases` → `[]`. | API | Tag-/Ref-Shadowing heute trivial möglich (kein Tag-Ruleset nachweisbar). |
| **Kein `.github/`, kein CODEOWNERS auf `main`.** | Clone + OMD F7 | Kein Code-Owner-Review, kein Workflow-Pfad geschützt. |
| **Rulesets/Collaborators/Actions-Settings nicht lesbar** (403 „Resource not accessible by integration"). | `list_repository_collaborators` 403 | Ob `forge-main`, `forge-all-branches`, Actions-Policy S1 existieren und wie konfiguriert, ist **von hier nicht verifizierbar**. Alle „Nein"-Urteile, die auf Rulesets/Policy beruhen, sind damit **Annahmen über zukünftige Konfiguration**, kein belegter Schutz. |
| **PR #2 offen** (Identity-Spike, Draft, Autor `forge-codex` id 337272506, Head `forge/run/codex/IDENTITY-SPIKE-1`, Base `main`). Keine Reviews, `mergeable_state: clean`. | API | `forge-codex` kann bereits PRs gegen `main` öffnen. Ohne Required Check ist `clean` = sofort mergebar für jeden mit Merge-Recht. |
| `pull_request_target` wird durch eine **neue GitHub-Default-Policy** in öffentlichen Repos blockiert; aktuell „evaluate", **Durchsetzung ab 2026-11-02**. | `securely-using-pull_request_target.md` (`<!-- expires 2026-11-02 -->`) | Der gesamte Verifier-Trigger steht und fällt mit einer **explizit konfigurierten** Actions-Event-Policy. Siehe PA-30 (kritisch). |

> **Kernaussage:** Der Angreifer muss heute nichts umgehen. Es gibt keine Pipeline. Die folgende Analyse bewertet, ob das *Design* hält, wenn es gebaut ist, und welche Lücken auch dann bleiben.

---

## 1. Threat Model

**Angreifer:** Besitzt `forge-codex` vollständig (Account-Übernahme oder bösartiger Entwickler). Schreibrecht (Write) auf `Forge-Dice/Forge`.

**Kann:**
- beliebige Git-Objekte erzeugen und pushen, soweit Rulesets es zulassen (Commits, Bäume, Blobs, Merge-Commits, mehrere Parents, beliebige Pfade/Modi, Tags, beliebige `refs/*`-Namespaces);
- PR-Inhalt vollständig kontrollieren (Head-Commits, Titel, Body, Beschreibungen, eigene Kommentare, Draft-Status, Base-Retargeting);
- über die GitHub-REST/GraphQL-API ebenso agieren wie über `git push` (beides unterliegt denselben Rulesets; Push-Rulesets greifen laut Doku auch für die Blob-/Tree-/Contents-Endpunkte);
- als Write-Inhaber Commit-Status setzen, eigene (ggf. fremde) Reviews/Kommentare manipulieren im Rahmen der Rolle, Workflow-Runs abbrechen/neu starten, Actions-Variablen/-Secrets verwalten, Tags/Branches/Forks erzeugen;
- Forge-Contracts, Workflows, Policies und alle Design-Dokumente lesen und exakt nachbauen;
- Prosa in Repo-Dateien, Contract-Texten, PR-Bodies und Kommentaren platzieren, die **von Menschen und von KI-Reviewern/-Assistenten gelesen** wird (Prompt-Injection-Fläche).

**Kann nicht (per Annahme):**
- Org-/Repo-Admin-Einstellungen ändern (Rulesets, Branch-Schutz, Actions-Policy, CODEOWNERS-Durchsetzung, Base-Permissions);
- Owner-Credentials nutzen;
- GitHub-Actions-Admin-Rechte ausüben;
- die GitHub-Plattform selbst kompromittieren (Actions-Runner-Isolation, Token-Ausstellung, Ref-Datenbank gelten als vertrauenswürdig).

**Schutzziel (vom Angreifer zu brechen):** Es darf **kein Commit nach `main` gelangen, der nicht exakt so verifiziert und reviewt wurde wie im V0.1-Design vorgesehen** — d. h. gegen den registrierten Contract, mit ehrlicher Scope-/Test-/Mutanten-Prüfung, mit unabhängigem menschlich attestiertem Review, gebunden an genau den akzeptierten SHA.

**Zwei Vertrauensebenen, die der Angreifer getrennt angreift:**
1. **Mechanische Ebene** (Git-Objekte, Rulesets, Actions, Verifier-Container). Hier ist das Design stark, *wenn* korrekt gebaut.
2. **Identitäts- und menschliche Ebene** (wer ist `forge-codex` wirklich; wer merged; wer attestiert ein externes Review; welche KI handelt mit welchen Rechten). Hier ist das Design **strukturell am schwächsten** — die meisten „OFFEN"-Urteile und Top-Findings liegen hier.

---

## 2. Attack Surface

| # | Fläche | Was der Angreifer berührt |
|---|---|---|
| S-A | Branch-/Ref-/Ruleset-Ebene | Push auf `main`, Force-Push, Delete/Recreate, Run-Branch-Namespaces, Tags, Releases, `refs/*` außerhalb heads/tags, API-vs-git, lineare Historie vs. Merge-Commit |
| S-B | Pull-Request-Mechanik | Head-Race (`synchronize`), Draft, `edited`/Body-Mutation, Base-Retargeting, derselbe SHA in zwei PRs, Merge-Commit-Zweitparent, Stale-Approval, Review-Dismissal, CODEOWNERS (Self-Approval, Single-Owner-Deadlock), „letzter Push" |
| S-C | GitHub Actions / Verifier-Trigger | `pull_request_target`-Default-Policy, Event-Policy S1, Required-Check-Quelle/-Name, Doppel-Check-Name, Commit-Status-Spoof, Workflow-Änderung im PR, neuer `on:push`-Workflow, Re-Run, Concurrency-Cancel, Cache, Artefakte, Token-Rechte, „Actions darf PRs approven", Merge-Queue/`merge_group` |
| S-D | Git-Objekt-/Pfad-Ebene | `refs/replace`, Shallow, Renames, Symlinks, Submodule, Exec-Bit, Case-Kollision, Windows-reservierte Namen, undarstellbare Pfade, CRLF/BOM/UTF-8, `.gitattributes` `export-subst`, Riesen-Diff |
| S-E | Contract-/Gate-Logik | Contract-Text nach Approval, Contract-Commit-Isolation/Merge, Base enthält C nicht, Start von falscher Base, Versions-Race, `supersedes`, Findings-Carry-Forward, `reads`/`SPEC_STALE`, Read-Receipt im mutierbaren Body, Legacy-Contracts, Scope-Aliasse/Casefold, Protected-Path-Root-only-Inkonsistenz |
| S-F | Verifier-interne Semantik | `npm`-Lifecycle, Dependency-Import-Nebenwirkungen, Vitest-Config/Skip/Only, `package.json`-Testscript, Mutation-Smoke (trivial / `toString`-Orakel / Kontrollmutant), geteiltes `/work`-Mount, Nichtdeterminismus + Re-Run, Evidence-Tampering im selben Job, Secret-/Netz-Exfiltration, Env-/Engine-Mismatch |
| S-G | Identitäts- & menschliche Ebene | `forge-codex` echte Identität vs. Owner-Connector-Run, externes Reviewer-Paket (Substitution + Prompt-Injection), Owner-KI-Assistent via Repo-/PR-/Contract-Prosa, menschliche Attestierungsfehler |

---

## 3. 60+ konkrete Angriffe

Legende „Wirkt?": **Nein** = durch das vollständig gebaute Design verhindert. **JA** = wirkt auch gegen das geplante Design (echte Lücke). **BEDINGT** = wirkt nur, wenn eine genannte Kontrolle fehlt/falsch konfiguriert ist. **OFFEN** = außerhalb des mechanischen Modells (Mensch/KI/Identität), nicht vollständig verhinderbar. **★ NEU** = von den bisherigen Audits nicht (so) erfasst.

### S-A · Branch-, Ref- und Ruleset-Ebene

| ID | Angriff | Voraussetzung | Wirkt? | Warum | Nötige Mitigation | V0.1/Defer |
|---|---|---|---|---|---|---|
| PA-01 | `git push origin HEAD:main` (direkt auf `main`) | Write | Nein | `forge-main`: PR-Pflicht, kein Bypass für `forge-codex`. (FI-22) | Ruleset `forge-main` aktiv, Bypass nur Owner. **Heute nicht verifizierbar (403).** | V0.1 |
| PA-02 | Force-Push / History-Rewrite auf `main` oder Run-Branch | Write | Nein | `forge-all-branches`: Block force-push + restrict deletions (default an). (FI-21) | Ruleset über **alle** Branches, inkl. `**`. | V0.1 |
| PA-03 | Run-Branch löschen und an anderem SHA neu anlegen (Check-Zustand zurücksetzen) | Write | Nein | „Restrict deletions" + „Restrict updates" auf `forge/run/**`; Neuanlage am selben Namen neu bewertet. | Run-Ruleset restrict create/update/delete, Bypass = jeweiliges Team. | V0.1 |
| PA-04 ★ | Push in **fremden** Run-Namespace `forge/run/claude/**` statt `forge/run/codex/**` | Write; Ruleset deckt nur `codex/**` | BEDINGT | Wenn nur `forge/run/codex/**` einen Bypass-Team-Scope hat und andere Namespaces offen bleiben, kann `forge-codex` dort Branches anlegen und so einen „Claude-Run" fälschen. | Ein Run-Ruleset pro Namespace **oder** Catch-all, das Create/Update aller `forge/run/**` auf das jeweils zuständige Team restringiert; Gate prüft Autor==Namespace-Agent. (erweitert FI-12) | V0.1 |
| PA-05 | Linearität vs. Merge-Commit-Strategie ausnutzen: `main` verlangt „lineare Historie", Registrierung braucht Merge-Commit | Write | Nein | Design hat sich **gegen** „require linear history" entschieden (Merge-Commit-Registrierung, OMD B3). Doku bestätigt: lineare Historie verbietet Merge-Commits. | `main`-Ruleset **ohne** „Require linear history"; Merge-Methode nur „merge commit". Invarianten I1–I5 ersetzen den Linearitätsschutz. | V0.1 |
| PA-06 ★ | Tag `main` anlegen, um unqualifizierte Ref-Lookups umzuleiten | Write; kein Tag-Ruleset | BEDINGT | Experiment: bei existierendem Tag `main` ist `git rev-parse main` **mehrdeutig** und liefert das Tag-Ziel (Warnung „refname 'main' is ambiguous"). Ebenso `origin/main`. Jedes Tooling, das unqualifizierte Refs nutzt (CV2 §4, Drill §7.6 schreiben `main` unqualifiziert), liest dann den falschen Commit. | Tag-Ruleset: Create/Update/Delete auf `refs/tags/**` nur mit Bypass. **Alle** Kern-/Gate-/Observer-Queries fully-qualified: `refs/heads/main`, `refs/remotes/origin/main`, Commits als `<sha>^{commit}`. (konkretisiert DRT-17) | **Required Before Drill** |
| PA-07 ★ | Tag mit 40-Hex-Namen = SHA eines EVIL-Commits, um Bare-SHA-Lookups umzuleiten | Write | Nein | Experiment widerlegt die naheliegende Sorge: `git rev-parse <40hex>` **ignoriert** den gleichnamigen Tag und löst die literale SHA auf (Git-Regel „never creates a ref ending in 40 hex"). Bare-SHA bleibt eindeutig. | Trotzdem Tag-Ruleset (PA-06); zusätzlich `advice.objectNameWarning` nicht als Fehler werten. | Defer (belegt harmlos) |
| PA-08 ★ | Release + zugehörigen Tag erzeugen, um Artefakte/Provenienz zu streuen | Write | Nein (kein Pfad nach `main`) | Releases/Tags bringen keinen Code nach `main`. Risiko nur via Tag-Shadowing (PA-06). | Tag-Ruleset; Kern ignoriert Releases vollständig. | Defer |
| PA-09 ★ | Pushen außerhalb `refs/heads/*`/`refs/tags/*` (z. B. `refs/notes/*`, `refs/forge/*`) | Write; Ruleset deckt nur heads/tags | BEDINGT (geringe Wirkung) | Branch-/Tag-Rulesets greifen nur für `refs/heads/**` bzw. `refs/tags/**`. Andere Namespaces können pushbar bleiben. Aber: `actions/checkout` holt per Refspec **nur** heads + tags (Quelltext belegt `+refs/heads/*` und optional `+refs/tags/*`); der Observer vertraut nur definierten Refs. | Observation/Checkout trauen ausschließlich `refs/heads/<run>` + `merge-base` zu `refs/heads/main`; alle anderen Namespaces ignorieren. | V0.1 (dokumentieren) |
| PA-10 | REST-API (`create_or_update_file`, Blob/Tree) statt `git push`, um Rulesets zu umgehen | Write | Nein | Doku (`troubleshooting-rules.md`): Push-Rulesets gelten **auch** für „Create a blob/tree/contents"-Endpunkte; Branch-Schutz (PR-Pflicht) gilt für die Ref-Aktualisierung unabhängig vom Transport. | Keine Sonderbehandlung nötig; Rulesets decken API ab. | V0.1 |

### S-B · Pull-Request-Mechanik

| ID | Angriff | Voraussetzung | Wirkt? | Warum | Nötige Mitigation | V0.1/Defer |
|---|---|---|---|---|---|---|
| PA-11 | Nach grünem Verify neuen Schadcode pushen; Owner merged „den Branch" | Write; Owner merged unachtsam | Nein | `synchronize` startet neuen Verify; neuer Head ohne grünen Required Check nicht mergebar; „dismiss stale approvals" + „approval of most recent reviewable push" verwerfen das alte Approval. (AC-26/27, V-24) | `main`-Ruleset: Required Check strict + Dismiss stale + most-recent-push-approval. Owner merged **immer den PR** (nie lokal den Branch-Head). | V0.1 |
| PA-12 | Head-Race: Head bewegt sich **während** des Verify | Write | Nein | `HEAD_MOVED`-Check; `synchronize`-Event ersetzt den Lauf; Check ist SHA-gebunden. (AC-27, §4.3) | Verifier vergleicht `github.event.pull_request.head.sha` mit live Head; Abbruch `HEAD_MOVED`. | V0.1 |
| PA-13 ★ | Read-Receipt / Handoff-Claims im **PR-Body** nach grünem Gate editieren (`edited` triggert Gate nicht) | Write; Gate liest PR-Body | **JA** | Doku: `pull_request_target` läuft per Default nur bei `opened/synchronize/reopened`. `edited` (Body-/Titeländerung) ist **nicht** dabei. Liegt die `FORGE READ RECEIPT v2` im PR-Body und wird dort geparst, kann sie nach grünem Gate unbemerkt geändert werden, ohne Neubewertung. (N-8, FI-02b) | Read-Receipt/Handoff **nicht** im mutierbaren PR-Body binden, sondern an einen Commit/ein Review (unveränderlich). Falls doch Body: `types: [opened, synchronize, reopened, edited]` **und** Gate ist Required Check. | **Required Before Drill** |
| PA-14 ★ | Base-Branch des PR per `edited` umhängen (Retargeting) | Write | BEDINGT | `edited` feuert bei Base-Wechsel, triggert aber die Default-`pull_request_target`-Typen nicht. Gegen `main` bleibt der Required Check SHA-gebunden und strict; ein Retarget auf einen **ungeschützten** Branch führt nicht nach `main`. Risiko nur, wenn Gate-Verdikt base-abhängig gecacht wird. | Gate/Policy bei `edited` neu bewerten **oder** base-abhängige Verdikte strikt an `merge-base(main,H)` zur Merge-Zeit binden (strict „up to date"). | V0.1 (dokumentieren) |
| PA-15 ★ | Denselben Head-SHA `H` in zwei PRs nutzen: `H` in Wegwerf-PR A verifizieren, dann „echten" PR B bei `H` eröffnen — Check schon grün | Write | BEDINGT | Check-Runs sind **SHA-gebunden und PR-übergreifend geteilt**. Ein grüner `forge-verify` an `H` erscheint auch in PR B. Approval bleibt aber pro-PR und an „letzten Push" gebunden; der Gate liest PR-Kontext (Branchname, Autor, Contract). | Gate/Policy binden **PR-Kontext** (Nummer, Base, Run-Branch, Contract-ID), nicht nur den SHA; Approval + most-recent-push-Regel pro PR. (neu ggü. AC-12/AC-26) | V0.1 |
| PA-16 | Blocking `changes_requested` durch neuen Run mit demselben Commit + anderem Reviewer umgehen | Write | Nein | Findings-Carry-Forward: offene blocking IDs müssen als `resolved`/`withdrawn` deklariert sein; Approval-Check lehnt sonst ab. (DRT-35, NRT-03, ACV-01/02, S-03) | `forge-approval` als **Required Check** mit Findings-Ledger; nicht nur beratend. | V0.1 |
| PA-17 | Stale-Approval nach Push behalten | Write | Nein | „Dismiss stale pull request approvals when commits are pushed" verwirft Approval bei Diff-Änderung. (FI-05) | Ruleset-Option aktiv. | V0.1 |
| PA-18 | Eigenes blocking Review selbst dismissen | Write | BEDINGT | Doku: „anyone with write permissions can dismiss the blocking review", **außer** „Restrict who can dismiss pull request reviews" ist gesetzt. Ohne diese Option kann `forge-codex` ein Changes-Requested-Review eines anderen wegräumen. | Ruleset/Branch-Schutz: „Restrict who can dismiss reviews" auf Owner/Team begrenzen. (★ NEU als expliziter Required-Punkt) | **Required Before Drill** |
| PA-19 | Eigenen PR selbst approven | Write; CODEOWNERS | Nein | Autoren können eigene PRs nicht approven; „Require review from Code Owners" + Code-Owner ≠ Autor. (ACV-34) | CODEOWNERS vorhanden + „require code owner review". | V0.1 |
| PA-20 ★ | **Single-Code-Owner-Deadlock** als Druck zum Bypass: `*` → nur `@Wuerfelduell`. Contract-PR von Seb selbst authored ⇒ einziger Code-Owner kann nicht approven ⇒ unmergebar ⇒ Versuchung, Schutz temporär zu lockern | Owner authored einen PR | OFFEN (Betrieb) | Bei genau einem Code-Owner und Autor==Owner gibt es keinen gültigen Approver; der einzige Ausweg ist Bypass/Abschalten — genau das Loch, das der Angreifer provozieren will (Social-Engineering/Timing). | Zweite menschliche Owner-Identität **oder** Code-Owner-Team mit ≥2 Personen; Bootstrap-PRs (D-10) mit dokumentierter, zeitlich begrenzter Ausnahme statt Ad-hoc-Lockerung. | **Required Before Drill** |
| PA-21 | „Approval of most recent reviewable push" umgehen, indem ein Zweitkonto den letzten Push macht | zwei Identitäten | Nein | Regel verlangt Approver ≠ letzter Pusher; identitätsbasiert. Zwei Identitäten erfordern zwei echte Accounts (Identity-Plane, siehe S-G). | Option aktiv; Identitätsbindung P-02. | V0.1 |

### S-C · GitHub Actions / Verifier-Trigger

| ID | Angriff | Voraussetzung | Wirkt? | Warum | Nötige Mitigation | V0.1/Defer |
|---|---|---|---|---|---|---|
| PA-30 ★ | **Default-Policy blockt `pull_request_target`** (ab 2026-11-02) ⇒ Verifier läuft nie ⇒ je nach Konfig Merge-Stau oder (falls Check nicht required) Fail-open | Plattform-Default | **JA / kritisch** | Doku belegt: GitHub blockt `pull_request_target` in Public-Repos per Default-Policy, aktuell evaluate, **enforced 2026-11-02**. Ohne **explizit** konfigurierte Actions-Event-Policy, die `pull_request_target` erlaubt, startet der Verifier nach dem Stichtag nicht. Ist `forge-verify` Required + strict, wird jeder PR unmergebar (fail-closed, aber tot); ist er nicht required, fällt der einzige Codeschutz weg (fail-open). | Actions-Event-Policy (S1) anlegen, die **genau** `.github/workflows/forge-verify.yml` für `pull_request_target` **erlaubt** und alle anderen Events/Workflows restringiert. Vor dem Drill verifizieren (Policy-Insights). | **Required Before Drill** |
| PA-31 | Neuer Workflow im Run-Branch, `on: push`, Job `forge-verify`, der `success` meldet | Write | Nein (mit S1) | Actions-Event-Policy weist `push`-getriggerte Workflows ab („Event 'push' is not allowed…"); zudem erzeugt das nicht den Required-Check aus der **GitHub-Actions-App-Quelle** am richtigen SHA. (AC-11, FI-23, S2) | S1-Event-Policy (nur erlaubte Events) **plus** Required-Check an App-Quelle gebunden. | V0.1 |
| PA-32 | Per API Commit-Status `forge-verify = success` setzen | Write | Nein | Doku: Required Check kann an eine **bestimmte App als Quelle** gebunden werden; ein Status aus anderer Quelle erfüllt ihn nicht und blockt bei Namensgleichheit eher den Merge. (AC-12, S9) | Required Check mit „expected source = GitHub Actions". | V0.1 |
| PA-33 ★ | **Doppelter Check-Name**: Status/Check `forge-verify` aus zwei Quellen; Präzedenz ausnutzen | Write | Nein (mit App-Quelle + S1) | Doku: „both must pass" bei Namensgleichheit und App-Quellbindung. Einzige verbleibende Lücke im Free-Plan ist S1 (keine „required workflows"-Alternative). Da S1 ohnehin für PA-30 nötig ist, ist dies abgedeckt. | S1 (zwingend) + App-Quellbindung; exakter Check-Name eingefroren (siehe PA-39). | V0.1 |
| PA-34 | `.github/workflows/forge-verify.yml` im PR-Head ändern/löschen | Write | Nein | `pull_request_target` lädt Workflow **immer aus dem Default-Branch** (`main`), nicht aus dem PR-Head (Doku bestätigt). Zusätzlich ist `.github/**` Protected Path ⇒ `PROTECTED_PATH_CHANGED`. (AC-10) | Trigger-Semantik `pull_request_target`; `.github/**` immer protected. | V0.1 |
| PA-35 ★ | **Re-Run eines alten Laufs** nutzt alten `GITHUB_SHA`/alte Workflow-Revision und die Rechte des Original-Triggerers | Write | Nein (mit MAIN_MOVED) | Doku (`rerun.md`): Re-Runs nutzen **denselben `GITHUB_SHA`/`GITHUB_REF`** und die Rechte des ursprünglichen Auslösers. Für `pull_request_target` ist `GITHUB_SHA` die `main`-Spitze **zum Zeitpunkt des Original-Events**. Ein Re-Run eines alten grünen Laufs bewertet nicht den neuen Head neu (neuer Head hat keinen Check) und validiert ggf. gegen veraltetes `main`. | `MAIN_MOVED`-Check: Verifier vergleicht `GITHUB_SHA` mit live `main`-Spitze (API) und bricht bei Abweichung ab. Re-Run erzeugt kein Approval. (konkretisiert §4.3) | **Required Before Drill** |
| PA-36 | Verify-Lauf per Concurrency-Cancel abwürgen (`cancel-in-progress`) | Write; schnelle Pushes | Nein | Ein abgebrochener Lauf meldet `cancelled` ≠ `success`; Required Check bleibt rot ⇒ nicht mergebar. (C10) | `concurrency: forge-verify-${pr.number}`, cancel-in-progress; Required Check muss `success` sein. Hinweis: Für **Required-Workflow-Rulesets** warnt die Doku vor cancel-in-progress — hier ist es ein gewöhnlicher Required Status Check, daher zulässig. | V0.1 |
| PA-37 | Cache-Poisoning aus dem PR-Lauf (Verifier liest vergifteten Cache) | Write | Nein | Doku: `pull_request_target` hat **read-only** Cache-Zugriff im Default-Branch-Scope — kann wiederherstellen, aber nicht schreiben/überschreiben. Design setzt zusätzlich `cache-mode: none`. (AC-41, T22) | `cache-mode: none`; kein `setup-node` mit `cache:`; **niemals** `cache-mode: write` auf diesem Low-Trust-Trigger (Doku warnt, dass das den Schutz aufhebt). | V0.1 |
| PA-38 ★ | **Artefakt-Poisoning** über einen zweiten, vom Angreifer kontrollierten Workflow, dessen Artefakt ein vertrauenswürdiger Workflow konsumiert | Write; ein `workflow_run`-Konsument existiert | Nein (im aktuellen Design) | Secure-use-Doku: `workflow_run`, der Fremd-Artefakte ausführt/liest, ist angreifbar. Der Verifier ist ein **einzelner** `pull_request_target`-Workflow, der seine eigene `evidence.json` erzeugt und **kein** Entwickler-Artefakt konsumiert. | Kein `workflow_run`-Workflow, der PR-Artefakte liest; Evidence nur aus dem Verifier selbst. Falls je ein Konsument hinzukommt: Artefakte als untrusted behandeln. | V0.1 (Regel festhalten) |
| PA-39 ★ | **Uneinheitliche/Falsch benannte Required Checks** ⇒ der real prüfende Job ist nicht der required Check (beratend) oder der required Name wird nie gepostet (toter Merge) | Design-Inkonsistenz | **JA** | Check-Namen divergieren über die Dokumente: HP D-14 (`forge`, `forge-approval`), IGP (`forge-gate`/`forge-verify`/`forge-policy`), OMD §5 nennt **nur** `forge-verify` als required, Drill A-1 (`forge-contract`/`forge-gate`/`forge-verify`/`forge-approval`). Doku: Required-Status-Checks sind **namens-exakt**; ein Name ohne Job bleibt „pending" (Merge tot). Ist nur `forge-verify` required, sind Identitäts-, Read-Receipt-, Findings- und Approval-Prüfungen **nur beratend**. (N-6) | Vor dem Drill die **exakte** Menge der Required Checks einfrieren und dokumentieren: welche Namen, welche Quelle, welche sind required. Mindestens der Codeschutz (`forge-verify`) **und** der Approval-/Policy-Check müssen required sein. | **Required Before Drill** |
| PA-40 ★ | Verifier-`GITHUB_TOKEN` approved selbst PRs / schreibt nach `main` | Write beeinflusst Workflow? Nein, aber Fehlkonfig | Nein (bei Default) | Doku: „Allow GitHub Actions to create and approve pull requests" ist für neue Org-Repos **per Default aus**; Token-Permissions sollen minimal sein. Ein approvender Bot wäre ein Bypass. | Workflow `permissions: contents: read, checks: write` (keine Erhöhung); Repo-/Org-Setting „Actions darf PRs erstellen/approven" = **aus** verifizieren. (★ als expliziter Check) | **Required Before Drill** |
| PA-41 ★ | **Merge-Queue** umgeht den PR-Head-Check (queued Merge auf `gh-readonly-queue/main/**` ohne `merge_group`-Verify) | Merge-Queue aktiviert | BEDINGT | Doku: Merge-Queue erzeugt temporäre `gh-readonly-queue/{base}`-Branches mit **anderem SHA**; CI muss auf `merge_group` neu laufen. Läuft der Verifier nicht auf `merge_group`, wird ungeprüft gemerged. Design wählt **merge-commit ohne Queue** (D-07 defer). | Merge-Queue in V0.1 **nicht** aktivieren; falls doch, `forge-verify` zusätzlich `on: merge_group`. | V0.1 (Queue aus halten) |
| PA-42 | Fork-PR: Commit nur im Fork, Verifier soll Fork-Head prüfen | Write + Fork | Nein | `actions/checkout` verweigert Fork-Head ohne `allow-unsafe-pr-checkout` (Quelltext/Doku); Verifier endet `FORK_PR_NOT_SUPPORTED`. `forge-codex` als Collaborator umgeht die „external contributor"-Approval ggf., aber der Verifier-Fetch scheitert dennoch. (AC-28, S12) | Verifier §4.2: Fork-Head nie fetchen; `FORK_PR_NOT_SUPPORTED`. Setting „require approval for fork workflows" als Tiefenschutz. | V0.1 |

### S-D · Git-Objekt- und Pfad-Ebene

| ID | Angriff | Voraussetzung | Wirkt? | Warum | Nötige Mitigation | V0.1/Defer |
|---|---|---|---|---|---|---|
| PA-50 | `refs/replace/<C>` mit Graft auf EVIL pushen, um Ancestry zu fälschen | Write | Nein | Experiment: `refs/replace` wirkt lokal, wird aber durch `GIT_NO_REPLACE_OBJECTS=1`/`--no-replace-objects` neutralisiert. `actions/checkout` holt per Refspec **nur** heads/tags, **nicht** `refs/replace/*` — der Replace-Ref kommt im Runner gar nicht an. (DRT-18/F3, AC-13, ACV-38) | Verifier: `GIT_NO_REPLACE_OBJECTS=1` gesetzt; nur heads/tags fetchen; optional `REMOTE_REPLACE_REFS`-Detektor. | V0.1 |
| PA-51 | Shallow-Checkout ⇒ Ancestry-Prüfung „hängt" oder ist unvollständig | Fehlkonfig | Nein | `SHALLOW_REPOSITORY`-Check statt stillem Hängen. (DRT-19, AC-14) | `fetch-depth: 0` erzwingen + Shallow-Detektor fail-closed. | V0.1 |
| PA-52 | Symlink (`120000`) auf `/etc/passwd`/`../../.npmrc` als „added" | Scope erlaubt Pfad | Nein | Mode-Prüfung **vor** Materialisierung: `MODE_FORBIDDEN`. (DRT-22, AC-17, V-26, A-15) | Evidence mit Git-Mode; `120000`/`160000` verboten vor Checkout. | V0.1 |
| PA-53 | Submodul (`160000` + `.gitmodules`) auf fremdes Repo | Scope | Nein | `MODE_FORBIDDEN`/`SUBMODULES_FORBIDDEN`. (AC-18, T09) | Mode `160000` verboten; `.gitmodules` protected. | V0.1 |
| PA-54 | Rename über Schutzgrenze bzw. Diff-Optionen-Abhängigkeit | Write | Nein | `--no-renames` ⇒ beide Enden sichtbar (`D`+`A`), beide Scope-geprüft. (DRT-21/F8, AC-15/16, V-04/05) | Diff deterministisch `--raw --no-renames -z` gegen `merge-base`. | V0.1 |
| PA-55 | Exec-Bit setzen (`chmod +x src/a.ts`, Mode `100755`) | Scope | Nein | Mode-Prüfung `MODE_FORBIDDEN`. (AC-37, FI-17a) | Nur `100644` für Code; Mode in Evidence. | V0.1 |
| PA-56 | Case-Kollision `src/Forge/Kernel.ts` neben `src/forge/kernel.ts` | Write | Nein | Experiment: Git speichert beide; `CASE_COLLISION`-Detektor (casefold). (DRT-24, AC-19, T10) | Casefold-Kollisionsprüfung über alle Pfade. | V0.1 |
| PA-57 | Windows-reservierte/undarstellbare Pfade (`aux.ts`, Trailing-Dot, Space, Nicht-ASCII) | Scope | Nein | `PATH_NOT_PORTABLE`/`PATH_NOT_REPRESENTABLE` statt Hängen. (DRT-25, AC-20/36, V-25, NRT-09) | Portabilitäts-/Darstellbarkeitsprüfung fail-closed. | V0.1 |
| PA-58 | CRLF/BOM/ungültiges UTF-8 im Contract, um Hash/Identität zu verschieben | Write | Nein | Fatal-Dekodierung; `CARRIAGE_RETURN`/`BOM`/`CONTRACT_NOT_UTF8`; Approval zusätzlich an Blob-SHA. (DRT-26/27/F7, ACV-24/25, AC-40, S-08) | Hash über **Bytes**; Blob-SHA-Bindung; `.gitattributes` `* text=auto eol=lf` als Hygiene (O-01). | V0.1 |
| PA-59 ★ | **Verschachtelte `.gitattributes` mit `export-subst`/`export-ignore`** verfälschen eine `git archive`-Materialisierung | Verifier nutzt `git archive` | Nein (im aktuellen Design) | Experiment: `git archive` **substituiert** `$Format:%H$` (export-subst) und **lässt** `export-ignore`-Dateien weg — Archiv-Inhalt ≠ Blob-Inhalt. Der Verifier materialisiert aber über Git-Objektoperationen (`cat-file`/`ls-tree`) aus Blob-SHAs, nicht über `git archive`; damit greift export-subst nicht. | Regel festhalten: Materialisierung **nie** via `git archive`/`npm pack`; Blobs direkt per SHA lesen. Check-Commands im Container berühren keine `.gitattributes`-Expansion. | V0.1 (Regel) |
| PA-60 | Riesen-Diff / Riesen-Blob als DoS | Write | Nein | `DIFF_TOO_LARGE`/`BLOB_TOO_LARGE` vor Checkout. (A-14, AC-35, S-13) | Größenlimits vor Materialisierung. | V0.1 |

### S-E · Contract- und Gate-Logik

| ID | Angriff | Voraussetzung | Wirkt? | Warum | Nötige Mitigation | V0.1/Defer |
|---|---|---|---|---|---|---|
| PA-70 | Contract-Text nach Approval ändern und starten | Write | Nein | Neuer Text = neuer Hash; `CONTRACT_FILE_MISMATCH`/`CONTRACT_SUPERSEDED`. (DRT-01, C-01, ACV-21) | Approval an Blob-SHA + End-Marker-Version gebunden. | V0.1 |
| PA-71 | Contract-Commit als **Merge-Commit**, dessen zweiter Parent ungeprüften Code einbringt | Write | Nein | Invariante: jeder Commit in `R^1..R^2` einzel-parent und berührt nur die Contract-Datei; `R` selbst ist die Registrierungs-Merge, `tree(R)==tree(C)`. (DRT-05/F4, AC-22, ACV-08, A-3) | Gate walkt `R^1..R^2` commitweise (nicht nur Endpunkt-Diff) — siehe PA-72. | V0.1 |
| PA-72 ★ | **Seitenzweig add+delete** im Registrierungs-/Run-Pfad: Datei in Zwischen-Commit anlegen und wieder löschen, sodass der Endpunkt-Diff sie verbirgt | Write | Nein (mit commitweisem Walk) | Experiment: `git diff merge-base..side` zeigt die add+delete-Datei **nicht** (Netto-Null); `git log main -- EVIL.md` ist leer (History-Simplification). Nur ein **commitweiser** Walk mit Einzel-Parent- und Pfad-Prüfung je Commit (I1–I5) fängt es. Ein reiner Endpunkt-Diff würde es übersehen. | Invarianten I1–I5 **je Commit** in `R^1..R^2` bzw. im Run-Scope prüfen; niemals nur `merge-base..HEAD` diffen. `--first-parent` nur für die `main`-Versionskette, nicht für die Isolationsprüfung. | V0.1 |
| PA-73 | Base enthält `C` nicht / Start von altem `main` oder Fremd-Branch | Write | Nein | `CONTRACT_NOT_IN_BASE`/`WRONG_BASE`; Run-Base = `merge-base(head, main)`. (AC-24, ACV-16/17, FI-11, C-08) | Gate bindet Run-Base an `main`-First-Parent-Kette; Quittung `run_base`. | V0.1 |
| PA-74 | Zwei Texte als „v2" / zwei Revisionen am selben `C` | Write | Nein | `CONTRACT_VERSION_NOT_NEXT`/`CONTRACT_COMMIT_REUSED`; ein Pfad, ein Inhalt. (DRT-03/39, C-12, ACV-39) | Versionskette über `--first-parent main -- <pfad>` **fully-qualified** (PA-06!). | V0.1 |
| PA-75 | `supersedes` zeigt auf falsche Vorversion / Branch-Blob | Write | Nein | `CONTRACT_SUPERSEDES_MISMATCH` gegen Blob an `main`. (ACV-05) | Kette lückenlos gegen `main`-Blobs. | V0.1 |
| PA-76 | Findings-Carry-Forward über geschlossenen/neuen PR aushebeln | Write | Nein | Findings aus geschlossenen PRs zählen; `FINDING_UNRESOLVED`. (ACV-02/03, S-03) | Ledger aus Review-**State** + `commit_id`, nicht aus editierbarem Text. | V0.1 |
| PA-77 ★ | `reads` leer lassen, um `SPEC_STALE` zu umgehen, während die Prosa Abhängigkeiten nennt | Write | BEDINGT | Mechanisch nur teils erkennbar (`READS_EMPTY`-Lint, Abgleich Prosa↔`reads`). Wenn `reads` leer ist, feuert `SPEC_STALE` nie, obwohl die Spezifikation veraltet sein kann. (ACV-15) | `reads` Pflichtfeld; Lint gegen Dependency-Tabelle im Body; Architektur-Reviewer prüft Vollständigkeit (menschlich). | V0.1 + OFFEN-Rest |
| PA-78 ★ | **Legacy-Contracts auf `main` per Run-Branch-Namen selektieren** (z. B. `TASK-0004.md` YAML, `FORGE-CORE-*`) mit kernelweitem Scope | Write | BEDINGT | `main` trägt Legacy-Contracts in abweichendem Format. Wenn das Run-Gate nicht erzwingt, dass nur **registrierte, format-2** Contracts einen Run autorisieren, kann ein Run gegen einen Legacy-Contract mit weitem Scope gestartet werden. (C-14/15, D-13, ACV-35) | Gate: nur `forge/contracts/<taskId>.md` in Format 2 mit gültiger Registrierungs-Merge; Legacy ⇒ `LEGACY_CONTRACT_HISTORY`, kein Run. | V0.1 |
| PA-79 | Scope-/Protected-Aliasse: `forge/Contracts/…`, `Forge/contracts/…`, Case-Varianten | Write | Nein | Casefold-Vergleich geschützter Pfade; `PROTECTED_PATH_ALIAS`. (DRT-23, AC-21, ACV-28, K-01) | Geschützte Pfade und Scope casefold-normalisiert. | V0.1 |
| PA-80 ★ | **Protected-Path-Root-only vs. Basename-Regel**: HP K-01 schützt `package.json` nur **repo-root**; Verifier-Draft schützt `package.json` als **Basename**. Angreifer nutzt `packages/x/package.json` o. Ä. | Write; Inkonsistenz | BEDINGT | Zwei Spezifikationen widersprechen sich (K-01 „Liste gilt für Repo-Wurzel-Pfade" vs. FORGE-VERIFIER-0001 Basename `package.json`/`.gitattributes`). Eine verschachtelte `package.json` wird von Root-`npm ci` nur mit Workspaces installiert (Workspaces-Config liegt in der **geschützten** Root-`package.json`), daher geringe direkte Codewirkung — aber die **Inkonsistenz selbst** macht das Urteil nichtdeterministisch. | **Eine** verbindliche Protected-Path-Semantik festlegen (empfohlen: Präfix- **und** Basename-Regeln explizit, `package*.json`/`tsconfig*.json`/`vitest.config.*`/`.gitattributes`/`.gitmodules`/`.npmrc` auf jeder Ebene). Vor dem Drill angleichen. | **Required Before Drill** |
| PA-81 | `requiredChecks`/Check-Command mit Homoglyph/Bidi (`npm tеst`, U+202E) | Write | Nein | Exakter String-Vergleich gegen Allowlist; `CHECK_NOT_ALLOWED`; verbotene Steuerzeichen. (C-30, ACV-26/27) | `allowedChecks` strikt; Zeichen-Lint. | V0.1 |

### S-F · Verifier-interne Semantik

| ID | Angriff | Voraussetzung | Wirkt? | Warum | Nötige Mitigation | V0.1/Defer |
|---|---|---|---|---|---|---|
| PA-90 | `postinstall`/Lifecycle-Script in `package.json` oder Dependency | `package.json` im Scope | Nein | `npm ci --ignore-scripts`; `package.json` byte-identisch (protected). (A-23, AC-34, T21) | `--ignore-scripts`; `package*.json` protected. | V0.1 |
| PA-91 ★ | **Import-Nebenwirkung einer Dependency** (Code läuft beim `import` im Test, nicht via Script) | neue Dependency | Nein (mit protected + Netz aus) | Auch ohne Lifecycle-Script läuft Modulcode beim Import. Aber: Deps ändern = `package*.json`-Änderung = `PROTECTED_PATH_CHANGED`; im Test `--network none`, keine Secrets/Token ⇒ keine Exfiltration; Ergebnis nur über Exit-Code. | `package*.json` protected; Tests `--network none`, keine Secrets (C1), kein Token im Container (C3). Rest siehe PA-95. | V0.1 |
| PA-92 | `vitest.config.*` höhlt `npm test` aus (`include` auf eine Datei) / `describe.skip`/`it.only`/`"test":"exit 0"` | Scope | Nein | Trusted-Config `--config /trusted/…`, `allowOnly:false`; `package.json`/Config protected; Inventar-Detektor. (V-11/12/13, AC-02/03/06/07, FI-16) | Testlauf nur mit **trusted** Config; Testinventar je Datei vs. Baseline. | V0.1 |
| PA-93 | Mutation-Smoke mit trivialem Mutanten erfüllen (`required` + 1 detektierter Mutant) | Write | Nein | Mutantenliste **im Contract** (K-04), Ausführung im Verifier; Developer-gemeldete Mutanten zählen nicht; überlebender Mutant ⇒ `MUTATION_SURVIVED`. (C-33/E-05, V-17, AC-29/30, FI-07, S8) | Contract-definierte Mutanten, in-memory im Verifier ausgeführt. | V0.1 |
| PA-94 ★ | **`Function.prototype.toString`-Orakel**: ein In-Scope-Test liest den eigenen Quelltext und „detektiert" einen In-Memory-Mutanten deterministisch, ohne Verhalten zu prüfen ⇒ Mutation-Smoke scheinbar bestanden | Write; In-Memory-Mutant als Source-Transform | **JA (wenn nicht gegengeprüft)** | Wird der Mutant als Source-Transform eingespielt, ist er über `toString()`/Stack-Introspektion sichtbar; ein Test kann „detected" vortäuschen, ohne echte Assertion. Rein mechanisch nicht von echter Detektion unterscheidbar. | **Kontroll-/No-op-Mutant**, der als `detected:false` gemeldet werden **muss**; meldet der Test ihn als detektiert ⇒ `MUTATION_EVIDENCE_INVALID`. Zusätzlich Mutant so einspielen, dass `toString` die Originalform zeigt (AST-Transform mit Source-Map), damit Introspektion nicht trägt. | **Required Before Drill** |
| PA-95 ★ | **Geteiltes beschreibbares `/work`-Mount** über Container-Phasen: ein Test in der Basisphase überschreibt Testdateien/Quellen, sodass spätere Mutanten-Phasen trivial „detektieren" oder Checks verfälscht sind | Write; `-v $W:/work` über install/typecheck/test/mutant geteilt | **JA (wenn nicht isoliert)** | Ist `/work` über alle Phasen beschreibbar geteilt, kann In-Scope-Testcode den Zustand für nachfolgende Phasen manipulieren (Evidence-Tampering im selben Job, A-24/T20). | Zwischen den Phasen aus **trusted Blobs** neu materialisieren **oder** Mutanten-/Check-Phasen mit **read-only** Tree und separatem tmpfs laufen lassen; Evidence je Phase frisch. | **Required Before Drill** |
| PA-96 ★ | **Nichtdeterministische Tests + Re-Run-Brute-Force**: Zufall/Zeitabhängigkeit, bis Basis grün und Mutanten „detektiert" zufällig zusammenfallen | Write; flaky Tests | BEDINGT | Ohne Determinismus-Zwang kann wiederholtes Re-Run (bis 50×/Run laut Doku) ein günstiges Ergebnis erzwingen. | Determinismus-Gate (S4): Basislauf N× byte-gleich; Zeit/Seed einfrieren; Re-Run-Limit; flaky ⇒ `NONDETERMINISTIC`. | V0.1 |
| PA-97 | Evidence im selben Job über `$GITHUB_OUTPUT`/Runner-Temp fälschen | Write | Nein (mit PR-Code nie im Runner-Prozess) | PR-Code läuft nur im **Container**, nie im Runner-Prozess (C4); Evidence aus Exit-Codes + trusted Aggregator. (A-24, T20, FI-19) | PR-Code strikt containerisiert; Aggregator trusted; keine PR-beeinflussbare Job-Ausgabe. | V0.1 |
| PA-98 | Secret-/Token-/Netz-Exfiltration aus Testcode | Write | Nein | **Keine** Repo-Secrets (C1), kein Token im Container (C3), Tests `--network none` (C4). (A-04, S3, AC-33) | C1–C4 verifizieren: es *existieren* keine Secrets, nicht nur „nicht referenziert". | V0.1 |
| PA-99 | Env-/Engine-Mismatch (Node-/npm-Version ≠ Contract) | Write | Nein (niedrig) | Evidence kann Umgebung festhalten; Image per Digest gepinnt (C6). (V-29) | Node per Image-Digest; Env in Evidence. | Defer (niedrig) |

### S-G · Identitäts- und menschliche Ebene (die eigentliche Trust Boundary)

| ID | Angriff | Voraussetzung | Wirkt? | Warum | Nötige Mitigation | V0.1/Defer |
|---|---|---|---|---|---|---|
| PA-110 ★ | **Owner-Run über den falschen Connector**: ein Codex-Lauf über eine Owner-Verbindung (`Wuerfelduell`) statt über `forge-codex` erzeugt einen „Owner-Run" mit Admin-Rechten | eine Owner-KI-Verbindung existiert | **JA / strukturell** | **Belegt in dieser Session:** `get_me` → `Wuerfelduell` (Org-Owner). Jede Schreibaktion einer Claude/ChatGPT-Session über diesen Connector ist für GitHub Owner-Handeln. Ein Agent, der versehentlich/bösartig über diese Verbindung pusht, approvt oder merged, hängt **nicht** am `forge-codex`-Schutz. (OMD B4, F8, DRT-34/F9, A-26) | Jeder Agent nutzt **ausschließlich** seine eigene Identität/Token; Gate prüft Autor==Entwickler-Identität (nicht Owner); Owner-Connector **nie** für Entwickler-/Merge-Automatik; Identity-Spike (PR #2) vor dem Drill als PASS abschließen (B1). | **Required Before Drill** |
| PA-111 ★ | **Externes Reviewer-Paket substituieren / Prompt-Injection in Diff+Contract**, um ein KI-APPROVE zu erzeugen, das Seb attestiert | Write; externer Adapter | **OFFEN** | Der Entwickler schreibt Diff **und** Contract — also den Input des externen Reviewers. Prompt-Injection in Code-Kommentaren/Contract-Prosa kann das Modell zu `APPROVE` bewegen; das APPROVE wird über Sebs Attestierung zu einem gültigen GitHub-Review. `packetHash` bindet nur (headSha, mergeBaseSha, Contract-Bytes), nicht die *Semantik* des Urteils. (IGP §10, A-02, DRT-28) | `forge-policy` prüft `commit_id == headSha == live Head == packet.head` + `packetHash`; Seb liest das **Modell-Reasoning real** und achtet auf Injection; Review-Rollenvorlage verbietet „laut Chat"-Begründungen (ACV-23). Residualrisiko bleibt menschlich. | V0.1 + **OFFEN** |
| PA-112 ★ | **Prompt-Injection gegen den Owner-KI-Assistenten** über Repo-Dateien (`forge/coordination/*.md` liegen in `main` und sind für jeden Run lesbar), PR-Bodies, Kommentare, Contract-Prosa | Write; Owner nutzt KI mit Owner-Rechten | **OFFEN** | `forge/coordination/{CLAUDE,CODEX}.md` sind in `main` und ohne Scope lesbar. Ein Owner-Assistent (Admin-Connector) kann durch eingebettete Instruktionen zu Merge/Dismiss/Ruleset-Änderung verleitet werden — genau die Admin-Aktionen, die `forge-codex` selbst nicht hat. (A-01/02, DRT-28/F5) | Owner-Assistenten behandeln Repo-/PR-/Contract-Text als **untrusted Daten**, nie als Instruktionen; destruktive/merge-/settings-Aktionen nur auf explizite Owner-Anweisung; NUL/Bidi/unsichtbare Zeichen im Contract ablehnen (ACV-26). | V0.1-Prozess + **OFFEN** |
| PA-113 | **Attestierung ohne echte Prüfung**: Seb setzt `FORGE-ATTEST`, ohne `headSha`/`packetHash` zu verifizieren | menschlicher Fehler | OFFEN | Die Attestierung ist nur so stark wie Sebs Sorgfalt. | Attestierungs-Checkliste; `forge-policy` erzwingt die mechanisch prüfbaren Teile (commit_id==headSha==live). | V0.1 (mechanischer Teil) + OFFEN |
| PA-114 | **Owner merged den Branch-Head statt des SHA** / merged während offener Contract-Revision | menschlicher Fehler | Nein (mechanisch) | Neuer Head ohne Check nicht mergebar; offene Revision ⇒ `CONTRACT_PR_OPEN`/`RUN_SUPERSEDED`. (AC-26, ACV-18, FI-14) | Required Check strict; Gate sperrt bei offener Revision. | V0.1 |
| PA-115 | **Reviewer == Developer** über Zweit-Login / Label-Zwilling | zwei Identitäten | Nein | `forge-approval`: `different_identity`; CODEOWNERS Autor≠Approver. (DRT-33, E-14, ACV-34) | Identitätsbindung P-02; Rollen getrennt; echte Zweit-Identität nötig. | V0.1 |
| PA-116 ★ | **Login-basierte Policy statt User-ID**: Bindung an `forge-codex` als Login, nicht als stabile Account-ID | Write; Login-Wiederverwendung | BEDINGT | Logins sind umbenennbar/wiederverwendbar; die stabile Identität ist die numerische ID (`forge-codex` = 337272506, verifiziert). Policy/Gate an Login statt ID sind gegen Umbenennung anfällig. | Identitäten in Policy/Gate an **User-ID** binden, nicht an Login. | V0.1 |
| PA-117 ★ | **`maxActiveRuns`/Run-Limit** durch parallele Run-PRs oder RunId-Squatting aushebeln | Write | Nein | `RUN_LIMIT`/`RUN_ALREADY_ACTIVE`/`RUN_ALREADY_EXISTS`; `maxActiveRuns=1` bis nach dem ersten Run. (DRT-38/42, FI-13, D-15) | Serielle Spur `maxActiveRuns=1`; RunId je Task. | V0.1 |
| PA-118 | **Owner-Push in Run-Branch** (Owner-Run, B4) | Owner-Fehler | Nein | Ruleset lehnt Owner-Push in `forge/run/codex/**` ab (Bypass nur Team). (FI-18) | Run-Ruleset Bypass = Entwickler-Team, nicht Owner. | V0.1 |

---

## 4. Novel Findings (nicht / nicht so in den bisherigen Audits)

In absteigender Wichtigkeit. Jedes ist oben als **★ NEU** geführt.

1. **PA-30 — `pull_request_target`-Default-Policy (2026-11-02).** Der gesamte Verifier-Trigger ist ab dem Stichtag tot, wenn keine explizite Actions-Event-Policy `pull_request_target` erlaubt. Die Audits behandeln S1 als Abwehr gegen Doppel-Checks; neu ist, dass **dieselbe Policy ab Nov 2 Voraussetzung dafür ist, dass der Verifier überhaupt startet**. Belegt aus `securely-using-pull_request_target.md`.
2. **PA-110 — Owner-Run über den falschen Connector.** In dieser Session belegt: `get_me` = `Wuerfelduell` (Owner). Die stärkste Eskalation umgeht `forge-codex` komplett, weil Owner-privilegierte KI-Verbindungen existieren. Identitäts-Plane, nicht Git-Plane.
3. **PA-111 / PA-112 — Prompt-Injection als Review-/Owner-Bypass.** Der Entwickler schreibt den Input der KI-Reviewer (Diff+Contract) und kann Owner-Assistenten über in `main` liegende Koordinationsdateien steuern. Die menschlich-attestierte und die KI-Review-Schicht sind die eigentliche Trust Boundary.
4. **PA-39 — Required-Check-Namensmenge nicht eingefroren.** Wenn nur `forge-verify` required ist (OMD §5), sind Identitäts-, Read-Receipt-, Findings- und Approval-Prüfungen **beratend**. Namens-Divergenz über die Dokumente kann den Merge sogar tot stellen (Check nie gepostet).
5. **PA-13 — Read-Receipt im mutierbaren PR-Body.** `edited` triggert `pull_request_target` nicht ⇒ Body-Claims nach grünem Gate änderbar.
6. **PA-94 / PA-95 — Verifier-interne Mutations-Umgehung.** `toString`-Orakel und geteiltes beschreibbares `/work`-Mount erlauben, Mutation-Smoke und Check-Evidence zu fälschen, ohne echte Tests. Braucht Kontrollmutant + Phasen-Isolation.
7. **PA-72 — Seitenzweig add+delete.** Experimentell belegt, dass Endpunkt-Diff und `git log -- <pfad>` die Zwischen-Datei verbergen; nur commitweiser Invarianten-Walk fängt es. Verschärft C-08/DRT-05 zur konkreten Prüfvorschrift.
8. **PA-06 — Tag-Shadowing unqualifizierter Refs.** `main`/`origin/main` als Tag machen unqualifizierte Lookups mehrdeutig (experimentell). CV2/Drill nutzen unqualifizierte Refs. (40-Hex-Tag dagegen harmlos, PA-07 — ebenfalls experimentell belegt.)
9. **PA-20 — Single-Code-Owner-Deadlock.** `*`→`@Wuerfelduell` + Autor==Owner macht Owner-authored PRs unmergebar und erzeugt Bypass-Druck.
10. **PA-80 — Protected-Path-Root-only vs. Basename-Inkonsistenz** zwischen HP K-01 und dem Verifier-Draft macht das Urteil nichtdeterministisch.
11. **PA-116 — Login- statt ID-Bindung.** Policy/Gate müssen an die stabile User-ID binden.
12. **PA-35 — Re-Run-Semantik** (alter `GITHUB_SHA`, Rechte des Original-Triggerers) als konkreter Auslöser für den `MAIN_MOVED`-Zwang.
13. **PA-04 — Cross-Namespace-Push** in fremde `forge/run/**`-Räume.
14. **PA-41 — Merge-Queue-Lücke** (falls je aktiviert, ohne `merge_group`-Verify).
15. **PA-59 — `git archive`/`export-subst`-Materialisierungsregel** (im aktuellen Design vermieden, aber ungeschrieben).

---

## 5. Top 10 der höchsten Restrisiken

Priorisiert nach *Wahrscheinlichkeit × Wirkung × Unvollständigkeit der Mitigation*.

1. **PA-110 — Owner-Run über Owner-KI-Connector.** Vollständige Umgehung; existiert heute belegt. Mitigation ist Prozess/Identität, nicht Code.
2. **PA-30 — `pull_request_target`-Policy-Stichtag.** Ohne S1-Event-Policy fällt der Verifier aus; harte Deadline 2026-11-02.
3. **PA-111 — Externes KI-Review via Prompt-Injection + laxe Attestierung.** APPROVE-Laundering; Residualrisiko bleibt menschlich.
4. **PA-39 — Nicht eingefrorene Required-Check-Menge.** Entscheidet, ob Identität/Approval mechanisch bindend oder nur beratend sind.
5. **PA-112 — Prompt-Injection gegen Owner-Assistenten** über in `main` liegende Koordinations-/Contract-Prosa.
6. **PA-95 — Geteiltes beschreibbares `/work`** macht Mutanten-/Check-Evidence fälschbar.
7. **PA-94 — `toString`-Mutations-Orakel** ohne Kontrollmutant.
8. **PA-13 — Read-Receipt/Handoff im mutierbaren PR-Body** (`edited` triggert nicht).
9. **PA-20 — Single-Code-Owner-Deadlock** erzeugt Bypass-Druck beim Bootstrap.
10. **PA-72 — Seitenzweig add+delete**, falls Isolation per Endpunkt-Diff statt commitweise geprüft wird.

Mechanische Git-/Pfad-Angriffe (S-D) und die meisten Contract-Logik-Fälle (S-E) sind durch das Design **gut abgedeckt**, sofern gebaut; sie stehen bewusst nicht in den Top 10.

---

## 6. Required Before Drill (Minimalmenge)

Ohne diese Punkte ist der Drill nicht aussagekräftig oder nicht durchführbar. (Alles zusätzlich zum offensichtlichen: die Pipeline muss überhaupt gebaut sein — heute `total_count: 0` Workflows, kein CODEOWNERS, keine lesbaren Rulesets.)

1. **Actions-Event-Policy (S1) konfigurieren und per Policy-Insights verifizieren**, die `.github/workflows/forge-verify.yml` für `pull_request_target` erlaubt und alle anderen Events/Workflows/Actoren restringiert. **Blocker gegen PA-30/31/33, Stichtag 2026-11-02.**
2. **Required-Check-Menge einfrieren und dokumentieren** (exakte Namen, Quelle = GitHub-Actions-App, welche required). Mindestens Codeschutz **und** Approval/Policy müssen required + strict sein. **PA-39.**
3. **Identity-Spike (PR #2) als PASS abschließen; jede Agenten-Schreibaktion an die eigene Identität/User-ID binden**, Owner-Connector nie für Entwickler-/Merge-Automatik. **PA-110/116, OMD B1.**
4. **Rulesets scharf stellen und (vom Owner) verifizieren:** `forge-main` (PR-Pflicht, Code-Owner-Review, dismiss stale, most-recent-push-approval, **restrict who can dismiss reviews**, Required Checks strict, kein Bypass für `forge-codex`); `forge-all-branches` (no force-push/delete); Run-Namespace-Rulesets für **alle** `forge/run/**`; **Tag-Ruleset**. **PA-01/02/03/04/06/18.**
5. **CODEOWNERS mit ≥2 Owner-Identitäten (oder Owner-Team)** anlegen, um den Single-Owner-Deadlock und Self-Approval-Druck aufzulösen. **PA-19/20.**
6. **Read-Receipt/Handoff unveränderlich binden** (Commit/Review, nicht PR-Body) oder Gate auf `edited` + Required. **PA-13.**
7. **Contract-Registrierung per Merge-Commit mit commitweisem Invarianten-Walk (I1–I5)** spezifizieren und testen (nicht nur Endpunkt-Diff). **PA-71/72, OMD B3/N-5.**
8. **Alle Kern-/Gate-/Observer-Git-Queries fully-qualified** (`refs/heads/main`, `<sha>^{commit}`), nie unqualifiziertes `main`. **PA-06.**
9. **Verifier-Härtung:** Phasen-Isolation des `/work`-Mounts (read-only oder Neu-Materialisierung je Phase) **und** Kontroll-/No-op-Mutant, der `detected:false` sein muss. **PA-94/95.**
10. **Protected-Path-Semantik vereinheitlichen** (Root-only vs. Basename auflösen). **PA-80.**
11. **`MAIN_MOVED`-Check** gegen live `main`-Spitze, inkl. Re-Run-Fall. **PA-35.**
12. **Verifizieren, dass keine Repo-Secrets existieren und „Actions darf PRs erstellen/approven" = aus.** **PA-40/98 (C1).**

---

## 7. Can Defer (bewusst nach V0.1)

- **PA-07** 40-Hex-Tag-Shadowing (experimentell als harmlos belegt; Tag-Ruleset deckt es ohnehin mit).
- **PA-08** Releases (kein Pfad nach `main`).
- **PA-09** Nicht-head/tag-Ref-Namespaces (werden nicht gefetcht; nur dokumentieren).
- **PA-41** Merge-Queue (in V0.1 schlicht nicht aktivieren).
- **Commit-Signaturen** (operativ schwer für Agenten; „require signed commits" später).
- **Metadata-Restrictions** (Commit-Message-/Author-Pattern) — nur Team/Enterprise-Plan, im Free-Org-Repo nicht verfügbar.
- **PA-99** Env-/Engine-Mismatch (Image-Digest reicht vorerst).
- **PA-59** `git archive`-Regel (nur als Negativ-Regel festhalten).
- Parallele Runs > 1, Scope-Lease, Reconciler, persistenter Hash-Chain-Log — wie in HP/Deep-Audit als Defer eingestuft (D-01..D-13, S-01..S-15); erst nach dem ersten erfolgreichen Run relevant.
- Netzwerk-Egress-Sperre im Verifier über `--network none` hinaus (GitHub-hosted Runner bieten keine einfache Egress-Policy; Verifier hat ohnehin keine Secrets).

---

## 8. Overall GO / NO-GO

**Design-Urteil: GO (bedingt).** Gegen die mechanische Ebene (S-A, S-C-Trigger, S-D, S-E, S-F) ist das geplante V0.1-System **belastbar**, wenn es vollständig und korrekt gebaut wird. Die meisten der 80+ Angriffe scheitern am Design; die experimentell geprüften Git-/Pfad-Fälle (Replace-Refs, Shallow, Modi, Case, Seitenzweig, Tag-Shadowing) bestätigen die vorgesehenen Mitigationen oder entschärfen die Sorge (40-Hex-Tag).

**Drill-Urteil: NO-GO zum jetzigen Zeitpunkt.** Gründe, hart und belegt:
- Es existiert **keine Pipeline** (`total_count: 0` Workflows, kein CODEOWNERS, Rulesets von hier nicht verifizierbar). Ein Drill würde heute nur zeigen, dass ein ungeschütztes Repo ungeschützt ist.
- **PA-30** (harte Deadline 2026-11-02) macht die Actions-Event-Policy zur nicht verhandelbaren Voraussetzung.
- Die **Identitäts-Plane** (PA-110/111/112) ist der schwächste Punkt und liegt außerhalb des Git-/Actions-Modells; der Identity-Spike ist noch nicht als PASS abgeschlossen (PR #2 offen, Draft).
- Mehrere **Spezifikations-Inkonsistenzen** (Required-Check-Namen PA-39, Protected-Path-Semantik PA-80, Merge-Commit-Registrierung noch nicht spezifiziert) machen das Urteil der Pipeline heute nichtdeterministisch.

**Weg zum GO:** Abschluss der zwölf Punkte unter §6 „Required Before Drill". Danach ist der in FORGE-FIRST-MANAGED-RUN-DRILL beschriebene Trockenlauf (Parse-Report-Drill mit Injektionen FI-01..25) aussagekräftig. Die verbleibenden **OFFEN**-Risiken (PA-111/112/113) sind durch Mechanik nicht vollständig schließbar; sie gehören in eine **Attestierungs-/KI-Umgangs-Checkliste** für den Owner und bleiben das bewusst getragene Restrisiko von V0.1.

**Keine Implementierung vorgenommen. Read-only. Ende.**

---

### Anhang: Verifikationsnotizen (Belege)

- **Live-Repo** (GitHub-API, 2026-10-03, auth. als `Wuerfelduell`/Owner): `main` 3d7545d (Merge PR #1, Parents `f5dbc73`+`0dfd903`); Branches: `main`, `codex/forge-core-v2-repair`, `codex/mystery-task-0005`, `codex/task-0004-contract`, `forge/run/codex/IDENTITY-SPIKE-1`, `claude/forge-architecture-review-hjdq89`; **0 Workflows**, **0 Tags**, **0 Releases**; Collaborators/Rulesets 403; PR #2 offen (Draft, `forge-codex`, mergeable_state clean).
- **GitHub-Semantik** aus `github/docs` (raw): `pull_request_target`-Default-Policy + `allow-unsafe-pr-checkout` (`securely-using-pull_request_target.md`, `<!-- expires 2026-11-02 -->`); Re-Run nutzt gleichen `GITHUB_SHA`/Original-Actor-Rechte (`re-running-workflows-and-jobs.md`); Required-Check namens-exakt + App-Quellbindung, strict (`troubleshooting-rules.md`, `about-protected-branches.md`, `available-rules-for-rulesets.md`); `edited` nicht in Default-`pull_request_target`-Typen (`events.md`); Cache read-only für `pull_request_target`, `cache-mode: write` hebt Schutz auf (`dependency-caching.md`, `workflow-syntax.md`); „restrict who can dismiss reviews", „most recent reviewable push", „dismiss stale" (`available-rules-for-rulesets.md`); CODEOWNERS vom Base-Branch, „any of the owners" genügt (`about-code-owners.md`); Actions-Event-Policy Actor/Event-Regeln (`about-actions-policies.md`, `control-workflow-execution.md`); `actions/checkout`-Refspecs nur heads/tags (`ref-helper.ts`, `git-command-manager.ts`); Push-Rulesets gelten für Blob/Tree/Contents-API (`troubleshooting-rules.md`); Metadata-Restrictions Team-Plan (`available-rules-for-rulesets.md`); Merge-Queue `merge_group`/`gh-readonly-queue` (`managing-a-merge-queue.md`).
- **Lokale Git-Experimente** (git 2.43.0): Tag `main`/`origin/main` ⇒ unqualifizierte Refs mehrdeutig; 40-Hex-Tag ⇒ Bare-SHA bleibt eindeutig (Tag ignoriert); `.gitattributes` `export-subst`/`export-ignore` wirken nur über `git archive`, nicht über `cat-file`/`ls-tree`; Seitenzweig add+delete ⇒ Endpunkt-Diff und `git log -- <pfad>` verbergen die Datei, nur commitweiser Walk fängt es; Case-Kollision ⇒ beide Pfade im Tree; `refs/replace` ⇒ durch `GIT_NO_REPLACE_OBJECTS=1` neutralisiert.
