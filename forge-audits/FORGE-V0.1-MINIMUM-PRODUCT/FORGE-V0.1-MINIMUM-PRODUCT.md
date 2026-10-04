# FORGE V0.1 MINIMUM PRODUCT

| Feld | Wert |
|---|---|
| Rolle | Principal Product/Platform Architect |
| Modus | rein lesend. Keine Änderung am Repository, keine Commits, keine PRs |
| Datum | 2026-10-03 |
| Repository | `Wuerfelduell/Forge` (Stand nach `git fetch` ~07:35 UTC) |
| Gelesene Stände | `codex/forge-core-v2-repair` @ `b9339d2` (Forge-Core maßgeblich), `codex/mystery-task-0005` @ `fab792a`, `claude/forge-architecture-review-hjdq89` @ `be40a68`, `codex/task-0004-contract` @ `6a8c0c5`, `main` @ `f5dbc73` (nur `.gitkeep`) |
| Quellen | `src/forge/*`, `package.json`, `forge/contracts/*`, `forge/reviews/*` (u. a. `FORGE-CORE-0001B.v2.verification.md`, `TASK-0004-M1-verification.md`, Red-Team-Bericht), `forge/coordination/{CLAUDE,CODEX}.md` beider Tracks, Git-Historie, die Auftragsnachrichten im Projekt, `forge-audits/FORGE-DEEP-AUDIT.md`, `forge-audits/FORGE-CONTRACT-HANDOFF-AUDIT.md`, `forge-handoffs/TASK-0004-dependency-handoff.yaml` |
| Nicht selbst ausgeführt | Die Test-Suite (1086/1086 grün auf `b9339d2`) wurde vom Deep Audit ausgeführt; hier nur zitiert |
| Parallel laufend | Red Team, Run-Recovery/Parallel-Policy, TASK-0006-Auswahl. Deren Ergebnisse lagen beim Schreiben noch nicht vor; wo sie diesen Bericht berühren, ist das markiert |

**Belegkennzeichen:** GIT (aus Commits/Dateien), PILOT (aus Verifikationsberichten und Koordinationslogs), CHAT (aus Sebs Auftragsnachrichten in diesem Projekt), AUDIT (vom Deep Audit ausgeführt), INFERRED (Schlussfolgerung, nicht direkt belegt).

---

## Kurzantwort

**Forge V0.1 ist kein Orchestrator, sondern ein Torwächter mit Zustandsanzeige, gebaut aus GitHub plus dem vorhandenen Kern.** Ein Task besteht aus genau zwei Pull Requests gegen ein geschütztes `main`: einem Contract-PR (Freigabe = Review) und einem Run-PR (Abnahme = Merge). GitHub Actions prüft unabhängig vom Developer, Forge berechnet Hashes, Handoff und Zustand selbst, und Seb trifft die vier menschlichen Entscheidungen (Freigeben, Starten, Abnehmen, Stoppen) am Android-Handy. Forge ruft in V0.1 kein Modell auf, betreibt keinen Server und speichert nichts außerhalb von Git und GitHub.

Das Hauptproblem des Pilots war nicht fehlende Plattform, sondern **dass Seb der Router zwischen drei Agenten war** und dabei Contracts, SHAs und Zustände von Hand übertrug. V0.1 ist fertig, wenn diese Relaisarbeit für einen echten Task verschwunden ist.

---

## 1. What Forge Actually Is Today

### 1.1 Faktenlage

| Bereich | Ist-Zustand | Beleg |
|---|---|---|
| Produktionskern | Reine TypeScript-Bibliothek, 12 Dateien, ca. 1225 Zeilen (`state.ts` allein 452). Parser + Hash, Start-Gate, Run-Lebenszyklus, Verifikationsbewertung, Review, Abnahme, Replay | GIT |
| Tests | 22 Testdateien, 1086 Tests grün; dazu 3 Red-Team-Testdateien. Test-LOC ca. 3× Produktions-LOC | AUDIT, PILOT |
| Laufzeit | **Keine.** Kein Prozess erzeugt Events, kein Log wird gespeichert, kein Code liest Git. Einziger Konsument echter Repo-Dateien ist `tests/forge/dogfood.test.ts` mit handgeschriebenen Beobachtungen | GIT |
| CI | **Keine.** `.github/` fehlt auf allen Branches; ebenso `.gitattributes` | GIT |
| Integration | `main` enthält nur `.gitkeep`. Nichts ist gemerged, kein PR existiert. Vier Arbeits-Branches mit sich überschneidenden, aber verschiedenen Ständen; `codex/forge-core-v2-repair` × `codex/mystery-task-0005` kollidiert in `forge/coordination/CODEX.md` | GIT, AUDIT |
| Echte Tasks unter Forge | **Null.** Die echten Mystery-Contracts (TASK-0004, TASK-0005) haben YAML-Frontmatter mit Statusfeldern und sind für den Kern nicht parsebar (`FRONTMATTER_MISSING`). Der Core-eigene Contract `FORGE-CORE-0001B.v2.md` liegt unter einem Pfad, den der Kern ablehnt | GIT, AUDIT |
| Identitäten | Claude committet als „Claude“, Codex als `Diceduel <315180734+Wuerfelduell@…>`, also unter Sebs GitHub-Konto. Eine einzige Claude-Session hat spezifiziert, implementiert, eigene Approval-JSONs „im Namen des Owners“ geschrieben, geredteamt und reviewt | GIT |
| Prozess | Seb verteilt lange Rollen-Prompts (je 50–150 Zeilen) an Claude, Codex und ChatGPT, überträgt Ergebnisse, SHAs und Urteile zwischen ihnen, und liest lange Berichte, um zu entscheiden | CHAT |
| Tempo | Gesamte Git-Historie ca. 15,5 Stunden (2026-10-02 15:01 UTC bis 2026-10-03 06:31 UTC), 35 Commits, 5 Mystery-Tasks + Core 0001A/B + Repair | GIT |

### 1.2 In einem Satz

Forge ist heute **eine gut getestete Spezifikation in ausführbarer Form plus ein manueller Mehragenten-Prozess, dessen Router, Gedächtnis und Integrationspunkt Seb ist.**

### 1.3 Was davon wertvoll ist

Der Kern beantwortet die richtigen Fragen, er bekommt sie nur nie gestellt:

- Content-Hash über den exakten Contract-Text, Approval am Hash, Status abgeleitet statt gespeichert.
- Start vom Contract-Commit, Base muss Vorfahr sein.
- Verifikation gegen genau die Contract-Revision des Runs: Scope je Datei, Pflicht-Checks mit exaktem Befehl, Mutationen, Renames an beiden Enden.
- Abnahme nur auf dem letzten verifizierten Run der aktuellen Revision.

Für V0.1 ist der Kern **eine Bibliothek von Prüffunktionen**, die in GitHub Actions gegen echte Git-Fakten laufen. Er muss dafür nicht wachsen.

---

## 2. Proven Needs

Nur Bedarfe, für die es einen konkreten Vorfall oder messbaren Aufwand im Pilot gibt.

| # | Bedarf | Vorfall / Beleg | Wie oft |
|---|---|---|---|
| N1 | **Contract nur aus Git, nie aus dem Chat** | Abgeschnittene Contracts, fehlende Textteile, zwei Fassungen, nicht ersetzte Platzhalter, Developer rekonstruierte Semantik (CHAT 07:04). TASK-0001 bis 0003 ohne versionierten Contract (Deep Audit 14.1) | Jeder Task bis 0003 |
| N2 | **Freigabe muss außerhalb des Contract-Texts liegen und authentifiziert sein** | TASK-0004: `status: approved` und gleichzeitig `architecture_review: pending_chatgpt_final_check`, implementiert 14 min 53 s nach dem Contract-Commit (GIT `6a8c0c5` → `e9cb8e2`). Approval-JSONs wurden vom Developer-Agenten selbst geschrieben (GIT) | 2 von 2 Contracts mit Status-Frontmatter |
| N3 | **Ein gemeinsamer Integrationsstand** | `main` leer, vier divergente Branches, add/add-Konflikt in `CODEX.md`; Forge-Core baut auf ungeprüftem `e9cb8e2` auf; Seb hielt TASK-0004 für einen Draft, obwohl Contract und Implementierung in Git lagen (Projekt-Memory, CHAT) | Dauerzustand |
| N4 | **Kein Mensch tippt oder vergleicht SHAs** | 45 SHA-Nennungen (21 verschiedene) allein in `forge/` auf dem Repair-Branch; zwei Bindungssysteme parallel (Git-Blob-SHA-1 in Reviews, SHA-256 mit Präfix im Kern, P-08); Sebs Aufträge enthalten SHAs zum Abgleich | Jeder Handoff |
| N5 | **Prüfung in einer Umgebung, die der Developer nicht kontrolliert** | Jede Verifikation lief auf dem Rechner des Developers und wurde als Markdown-Tabelle mit Exit-Codes dokumentiert. Testkonfiguration und `describe.skip` können Checks aushöhlen (AUDIT VX-03/04). CRLF auf Windows zerstörte gehashte Artefakte, Dateien wurden von Hand zurückgesetzt (PILOT v2-Verification §4) | Jeder Run |
| N6 | **Mutationen, die der Contract vorgibt, nicht der Developer** | M1: Mutant `return stance;` bestand 154/154 Tests trotz ausdrücklichem Acceptance-Kriterium (PILOT). Ein Mutant wurde falsch als must-detect klassifiziert (P-06). Mutationsdefinitionen R4b/P2/K9 waren nicht versioniert (P-11). Jede Kampagne wurde von Hand neu gebaut (Vite-Transform, Hash-Buchhaltung) | Jede Implementierung (35, 28, 63, 12, 6 Mutanten) |
| N7 | **Unabhängiges Review, das wirklich unabhängig ist** | Unabhängiges Review fand B1/J1 in TASK-0005, die der Self-Audit übersah (P-05). Gleichzeitig waren die „unabhängigen“ Rollen oft dieselbe Session (P-09) und das Routing unklar: Contract sagt „ChatGPT final check“, Freigabe kam von Claude auf einem anderen Branch (P-07) | Jeder Contract, jede Implementierung |
| N8 | **Ein Ort, an dem der aktuelle Zustand steht** | Branch-Discovery zu Beginn jeder Session: Koordinationslogs notieren „saw origin/codex/… @ fc01e4a“, Deep Audit musste eine Branch-Landkarte bauen; Seb musste Stände in Aufträge schreiben | Jede Session |
| N9 | **Erkennen veralteter Abhängigkeiten** | „Tasks wurden gegen veraltete Dependency-SHAs spezifiziert“, „Contract wurde parallel weiterentwickelt“ (CHAT 07:28); TASK-0002-Revision änderte zugesagte Semantik von TASK-0001 (`de5feb9`, P-03) | Mehrfach |
| N10 | **Erkennen, dass Arbeit nicht angekommen ist** | „Agent produziert lokalen Commit, Push schlägt fehl“ (CHAT 07:28); Codex setzte nach Unterbrechung eine Worktree fort (PILOT CODEX.md) | Selten, aber real |

**Nicht in der Liste**, weil ohne Vorfall: Kosten, Kill, Preview, Parallelität auf Task-Ebene (es gab Parallelität auf Branch-Ebene, deren einziges Problem N3 war).

---

## 3. Unproven Ideas

Ideen aus dem ursprünglichen Plan oder dem Kern, für die der Pilot **keinen** Bedarf gezeigt hat. „Unbewiesen“ heißt nicht „falsch“, sondern „nicht jetzt bauen, sondern auf Auslöser warten“.

| Idee | Warum unbewiesen | Auslöser, der sie rechtfertigen würde |
|---|---|---|
| Eigene PWA / Mobile-App | Alle Entscheidungen des Pilots sind GitHub- oder Chat-Aktionen; keine fehlte am Handy, außer Run-Start (siehe 7) | Eine Owner-Aktion ist in GitHub Mobile nachweislich nicht in ≤ 3 Taps möglich, oder mehrere Repos/Nutzer |
| Backend-Server, Postgres | Kein Zustand existiert, der nicht in Git/GitHub liegt; unter 10 k Events | Fakten, die GitHub nicht speichert (Kosten, Leases) und die regelmäßig gebraucht werden |
| Queue / Scheduler | Nie mehr als ein Run je Track gleichzeitig | Mehr als ca. 3 gleichzeitige Runs oder Runs, die Forge selbst startet |
| LLM-Gateway, Anthropic-/OpenAI-Adapter | Forge ruft kein Modell auf; Agenten liefen in Claude Code, Codex, ChatGPT | Run-Start per Hand wird nach V0.1 messbar zum Engpass |
| Cloud Runner für Agenten | Agenten laufen bereits in den Umgebungen der Anbieter | Ein Agent braucht eine Umgebung, die kein Anbieter liefert |
| SSE / Live-Streaming | Kein UI, das live sein müsste | Eigenes UI existiert |
| Preview Deployments | Das Spiel hat keine Oberfläche; alles ist Domänenlogik mit Tests | Erster Task mit sichtbarer Ausgabe |
| Kostenmodell in Forge | Keine einzige Kostenzahl im Repo; Kosten waren nie Gegenstand eines Problems | Erste Monatsrechnung, die überrascht |
| Persistenter Event-Log mit Hash-Kette | Replay lief nie auf echten Daten; GitHub hat die Historie bereits | Ein Fakt muss überleben, den GitHub nicht hält |
| Leases / Heartbeats | Ein Abbruch im Pilot, von Hand fortgesetzt | Wiederholte verwaiste Runs |
| `remote_verified` als eigener Zustand, `run_failed`-Codes, Mehrfachbeobachtungen | Kein echter Fall | entfällt in V0.1: „PR existiert“ ersetzt das |
| `different_identity`-Policy, `mutationSmoke: optional`, Reviewer-Quoren | Ohne echte Identitäten wirkungslos; `optional` ≡ `none` | echte Identitäten machen eine feste Regel ausreichend |
| Kill Switch | Nie benutzt | ist billig, kommt als Sperre mit (Fähigkeit K10), aber ohne eigene Infrastruktur |
| Große Fuzz-/Red-Team-Kampagnen am Kern | Interne Konsistenz bereits belegt (9000 Events, 0 Abweichungen); Risiken liegen an den Eingängen | Kernänderung |

---

## 4. Manual Workflow

Alle manuellen Schritte, die der Pilot tatsächlich gebraucht hat, in der Reihenfolge eines Tasks. „Wer“ ist, wer die Arbeit tatsächlich getan hat.

| ID | Schritt | Wer | Beleg |
|---|---|---|---|
| M01 | Rollen-Prompt für jeden Agenten schreiben (Rolle, Scope, Verbote, Stände, Ausgabeformat) | Seb, oft mit ChatGPT vorformuliert | CHAT: fünf Aufträge mit je 50–150 Zeilen zwischen 07:02 und 07:29 |
| M02 | Contract zwischen ChatGPT, Codex und Claude per Copy-Paste übertragen | Seb | CHAT 07:04; P-01 |
| M03 | Contract-Format und Status von Hand pflegen (YAML-Status, „pending_chatgpt_final_check“, Sidecar `.v2.md`) | Codex/Claude | GIT; Handoff-Audit §3 |
| M04 | SHAs übertragen und abgleichen (Base, Contract-Commit, Blob, Content-Hash, Implementierung) | Seb + alle Agenten | 45 SHA-Nennungen in `forge/`; zwei Hash-Systeme (P-08) |
| M05 | Branch-Discovery: herausfinden, welcher Branch welchen Stand hat | jeder Agent zu Sessionbeginn, Seb | CLAUDE.md CP2/CP3/CP5/CP8; Deep Audit 2.4; TASK-0004-„Draft“-Irrtum |
| M06 | Dependency-Stand prüfen (Ist meine Base aktuell? Gilt der Review noch für diesen Blob?) | Auditoren, Codex | Dependency-Handoff-YAML; TASK-0005 v2 bindet `1de7efe` und Blob `1e6f36e5…` von Hand |
| M07 | Approval-Datei schreiben bzw. Freigabe im Chat erteilen und weitertragen | Developer-Agent bzw. Seb | `forge/approvals/*.json` (GIT); „ChatGPT … PASS“ (CHAT) |
| M08 | Tests lokal ausführen und Ergebnis als Tabelle dokumentieren (npm ci, typecheck, test, Exit-Codes) | Developer | v2-Verification §5, M1-Verification |
| M09 | Remote-Persistenz prüfen (`git ls-remote`, frischer Clone, erneuter Testlauf) | Developer | v2-Verification §5; M1 „Fresh Remote Verification“; CLAUDE.md CP3/CP5 |
| M10 | Umgebungsprobleme reparieren (CRLF-Rücksetzung, npm nicht im PATH, PowerShell-Quoting, Windows-Pfad im Dogfood-Test) | Codex | v2-Verification §4/§5; M1 |
| M11 | Mutationskampagne bauen, ausführen, Hashes und Ergebnisse dokumentieren, Äquivalenz begründen | Developer | `FORGE-CORE-0001B.v2.mutations.json`, M1 §Mutation, CLAUDE.md CP2/CP3/CP5 |
| M12 | Review beim anderen Anbieter anstoßen, Ergebnis zurücktragen, an Blob-SHA binden | Seb | „ChatGPT hat TASK-0003 … reviewed“ (CHAT); TASK-0005 v1/v2-Reviews |
| M13 | Koordinationslog-Eintrag schreiben und die Logs der anderen lesen | jeder Agent, jeder Schritt | CLAUDE.md CP1–CP9, CODEX.md (beide Tracks) |
| M14 | Lange Berichte lesen, um eine Entscheidung zu treffen | Seb | Deep Audit 107 KB, Red-Team-Bericht, Verifikationsberichte |
| M15 | Entscheiden: freigeben, starten, abnehmen, stoppen | Seb | durchgängig |
| M16 | Baseline integrieren (welcher Stand kommt nach `main`, Konflikte lösen) | Codex, gerade laufend | CHAT 07:28 „Codex arbeitet parallel an der Baseline“ |
| M17 | Unterbrochenen Run fortsetzen bzw. fehlgeschlagenen Push nachholen | Agent + Seb | CODEX.md „resumed existing repair“; CHAT 07:28 |
| M18 | Audit- und Red-Team-Aufträge formulieren und verteilen | Seb | dieses Projekt: sechs parallele Analyse-Threads |

---

## 5. Automation Matrix

Skala: **FREQUENCY** = pro Session / pro Handoff / pro Task / pro Run / selten. **PAIN** und **ERROR_PRONE** = hoch / mittel / niedrig, begründet. **NOW** = Teil von V0.1, **LATER** = nach V0.1-Exit, **NEVER** = bleibt Mensch oder entfällt ersatzlos.

| ID | Schritt | FREQUENCY | PAIN | ERROR_PRONE | Entscheidung | Wie |
|---|---|---|---|---|---|---|
| M02 | **Contract Copy-Paste** | pro Contract-Version, je Empfänger | hoch | **hoch** (belegt: abgeschnitten, Doppelfassung, Platzhalter) | **NOW: abschaffen** | Contract nur als Datei im Contract-PR. Agenten bekommen den Handoff (nur IDs) und lesen den Blob selbst; Read-Quittung (Blob + Hash, tool-berechnet) im Run-PR wird vom Gate geprüft |
| M04 | **SHA Reconciliation** | pro Handoff, mehrfach | hoch | **hoch** (zwei Hash-Systeme, Statusirrtum) | **NOW** | Forge berechnet Blob, Content-Hash, Contract-Commit, Start-Commit und druckt sie in Check-Summary und Handoff. Kein Mensch tippt einen SHA. Eine Bindungsregel: Content-Hash des Kerns, Blob nur als Kontrollwert |
| M09 | **Remote Persistence Verification** | pro Run | mittel | mittel | **NOW: entfällt** | Was im PR ist, ist persistiert. Prüfung läuft auf frischem Checkout des PR-Head in Actions. `ls-remote` und Fresh-Clone-Tabellen entfallen |
| M05 | **Branch Discovery** | pro Session | hoch | **hoch** (TASK-0004-Irrtum) | **NOW** | `main` ist der einzige Integrationsstand; offene Arbeit = offene PRs. Ein Status-Issue listet je Task Zustand und „wartet auf“ |
| M06 | **Stale Dependency Detection** | pro Contract und vor Merge | mittel | **hoch** (belegt) | **NOW** | Gate-Check: Contract-Base liegt auf `main`, Run startet vom Merge-Commit des Contracts, Dependencies sind in `main`. Ruleset „Branch muss aktuell sein“ erzwingt Neuverifikation, wenn `main` sich bewegt hat. Semantische Staleness (Review galt einer anderen Fassung) erledigt „Approval verfällt bei neuem Push“ |
| M08 | **Test Verification** | pro Run | mittel | mittel (Exit-Code-Verwechslung, Testkonfig aushöhlbar) | **NOW** | Required Check in Actions aus `main` definiert, mit Testinventar (Anzahl, Skips) gegen den letzten Stand von `main` |
| M11 | **Mutation Smoke** | pro Implementierung | **hoch** (jedes Mal neu gebaut) | **hoch** (Developer wählt Mutanten, P-04, P-06) | **NOW, minimal** | Contract listet Mutanten als exaktes Suchen/Ersetzen; Verifier wendet jeden einzeln im Speicher an (Verfahren aus `mutations.json` und M1 übernehmen); überlebender Mutant = Check rot, Äquivalenz nur per Reviewer-Kommentar. Explorative Großkampagnen: **NEVER als Gate** |
| M12 | **Cross-Provider Review** | pro Contract, pro Implementierung | hoch (Relais) | mittel (Routing unklar, P-07) | **NOW: Aufzeichnung. LATER: Anstoßen** | Review = GitHub-Review auf dem PR durch eine Identität ≠ Autor. Das Anstoßen des Reviewer-Agenten bleibt in V0.1 eine Handoff-Zeile. ChatGPT ohne eigene GitHub-Identität kann nur über Seb handeln; sein Urteil zählt dann als Owner-Urteil |
| M16 | **Baseline/PR Handling** | einmalig jetzt, danach pro Task | hoch (jetzt) | hoch (Konflikte) | **NEVER für die Erst-Integration** (Owner-Entscheidung, läuft bereits). **NOW danach** | Danach ist jeder Task ein PR; Merge nur grün, aktuell, mit Approval auf dem letzten Push |
| M03 | Contract-Format/Status pflegen | pro Contract | mittel | hoch | **NOW** | Vorlage mit `---json`-Frontmatter; Contract-Check im Contract-PR mit dem Kern-Parser; Status steht nie im Contract |
| M07 | Approval-Datei/Chat-Freigabe | pro Contract | niedrig | **hoch** (Agent schreibt im Namen des Owners) | **NOW: abschaffen** | Freigabe ist ein GitHub-Review; `forge/approvals/*.json` entfällt |
| M10 | Umgebungsreparaturen | pro Run auf Windows | mittel | hoch | **NOW: Ursache beseitigen** | `.gitattributes` (`* text=auto eol=lf`), Node-Version pinnen; maßgeblich ist der Linux-Verifier. Lokale Umgebung der Agenten bleibt deren Sache |
| M13 | Koordinationslogs | pro Schritt | mittel | mittel (Konflikt, Injektionskanal) | **NOW: entfällt** | Ersetzt durch PR-Verlauf und Status-Issue. Keine Agenten-Notizen mehr im Produktpfad |
| M01 | Rollen-Prompts schreiben | pro Agent und Schritt | **hoch** | mittel | **NOW: Vorlagen. LATER: automatisch** | Feste Rollenvorlagen im Repo (Developer, Reviewer, Spec-Autor), die nur den Handoff als Variable nehmen. Damit wird jeder Auftrag ca. 10 Zeilen |
| M17 | Run-Fortsetzung, Push-Nachholen | selten | mittel | mittel | **LATER** (Leases) | V0.1 erkennt nur: kein PR bzw. Head ≠ verifizierter SHA → nicht abnehmbar. Ergebnis des Run-Recovery-Threads abwarten |
| M14 | Lange Berichte lesen | pro Entscheidung | **hoch** | mittel | **NOW teilweise** | Check-Summaries mit „blockierend zuerst“ und fester Kopfzeile. Die Entscheidung selbst bleibt Mensch |
| M15 | Freigeben, starten, abnehmen, stoppen | pro Task | niedrig | niedrig | **NEVER** | Das sind die Owner-Entscheidungen. Forge macht sie nur leicht und an SHAs gebunden |
| M18 | Audit-Aufträge verteilen | unregelmäßig | mittel | niedrig | **NEVER in V0.1** | Analysearbeit, kein Gate |

**Ergebnis der Matrix:** Neun der zwölf schmerzhaften Schritte verschwinden nicht durch Automatisierung von Agenten, sondern durch **einen anderen Ort der Wahrheit** (Git/GitHub statt Chat) und **eine Prüfung, die nicht beim Developer läuft**. Genau das ist V0.1.

---

## 6. V0.1 Architecture

### 6.1 FORGE V0.1 MINIMUM PRODUCT: zehn Kernfähigkeiten

| # | Fähigkeit | Ersetzt | Nachgewiesener Bedarf |
|---|---|---|---|
| **K1** | **Geschützte Baseline.** `main` ist der einzige Integrationsstand: nur per PR, kein Force-Push, Required Checks, Merge nur durch `Wuerfelduell` | M05, M16 | N3, N8 |
| **K2** | **Contract-PR.** Ein Contract ist eine Datei `forge/contracts/<TASK>.md` mit kernkonformem `---json`-Frontmatter ohne Statusfeld. Neue Version = gleicher Pfad, neuer Commit, also sichtbarer Diff zur Vorversion. Ein Check parst ihn mit dem Kern und druckt Content-Hash, Blob, Scope, Checks, Mutanten | M02, M03 | N1, N4 |
| **K3** | **Authentifizierte Freigabe.** Freigabe = Approving Review einer berechtigten Identität ≠ Spec-Autor auf dem Contract-PR; ein neuer Push verwirft sie. Merge des Contract-PR = registriert und freigegeben | M07, M12 (Aufzeichnung) | N2, N7 |
| **K4** | **Handoff ohne Inhalt.** Forge erzeugt nach dem Merge den Handoff aus Identifikatoren (Repo, Run-ID, Contract-Commit, Blob, Content-Hash, Ziel-Branch) plus feste Rollenvorlage. Der Agent liest den Contract selbst aus Git und legt eine tool-berechnete Read-Quittung in den Run-PR | M01, M02, M04 | N1, N4 |
| **K5** | **Start-Gate auf echtem Git.** Ein Run ist ein PR von `forge/run/<TASK>-<n>`. Der Gate-Check prüft: verzweigt vom Merge-Commit des Contracts, Contract ist aktuell und freigegeben, Dependencies in `main`, Read-Quittung stimmt | M06 | N2, N9 |
| **K6** | **Unabhängiger Verifier.** Ein Workflow aus `main` (nicht aus dem PR) prüft den exakten PR-Head auf frischem Linux-Checkout: Diff gegen den Start-Commit (ohne Rename-Erkennung), Scope mit `evaluateVerification`, Pflicht-Checks mit Testinventar, geschützte Pfade (`.github/`, `package.json`, Testkonfiguration, `forge/contracts/`, `forge/policy.json`) | M08, M09, M10 | N5 |
| **K7** | **Mutation Smoke aus dem Contract.** Der Verifier wendet die im Contract gelisteten Mutanten einzeln im Speicher an; jeder muss erkannt werden. Äquivalenz nur durch Reviewer-Kommentar | M11 | N6 |
| **K8** | **Echte Identitäten und Rollen.** Jeder Agent hat eine eigene GitHub-Identität; `forge/policy.json` (nur Owner änderbar) ordnet Logins Rollen zu. Unabhängigkeit wird aus Logins berechnet, nicht aus Event-Feldern | M07, M12 | N2, N7 |
| **K9** | **Zustand an einem Ort.** Je PR eine Check-Summary mit Forge-Zustand und „wartet auf“; ein angeheftetes Status-Issue listet alle Tasks. Berechnet durch Replay des Kerns über aus GitHub abgeleitete Events, nicht gespeichert | M05, M13, M14 | N8 |
| **K10** | **Abnahme und Sperre.** Abnahme = Merge des Run-PR durch den Owner, nur wenn alle Checks auf dem Head grün sind, der Branch aktuell ist und das Code-Review dem letzten Push gilt. Eine Repository-Variable `FORGE_HALT` lässt Gate und Verifier fehlschlagen, damit nichts mehr nach `main` kommt | M15 (erleichtert) | N3, N10 |

Nicht darunter, bewusst: Agentenstart, Kosten, Preview, Recovery-Automatik, Parallelplanung.

### 6.2 Ablauf eines Tasks

```text
 Spec-Autor (Agent)           Reviewer (andere Identität)        Seb (Android)
       │ push forge/spec/TASK-x                                        │
       ▼                                                              │
 [Contract-PR] ──check: forge-contract (Parser, Hash, Policy)          │
       │◄────────── Review: approve / request changes ─────────────────│ (Approve als Owner
       │                                                               │  oder via Reviewer)
       └── Merge (Owner) ─► main: Contract registriert + freigegeben
                                   │
                   forge-status: Handoff im Status-Issue ─────────────►│ kopiert 6 Zeilen in
                                                                       │ Claude-/Codex-App
 Developer (Agent) ◄───────────────────────────────────────────────────┘
       │ git checkout <contract-merge-commit>; liest Contract per Tool; Read-Quittung
       │ push forge/run/TASK-x-1
       ▼
 [Run-PR] ──check: forge-gate (Start-Gate gegen echtes Git)
          ──check: forge-verify (Scope, Checks + Inventar, Mutanten) aus main
          ◄── Code-Review durch Identität ≠ Developer
          ── Merge (Owner, nur grün + aktuell + Review auf letztem Push) = accepted
```

### 6.3 Was der Kern beiträgt, und was nicht

| Kernteil | V0.1-Verwendung |
|---|---|
| `contract-document.ts` (Parser, Hash) | **direkt**, im Contract-Check und im Handoff |
| `start-gate.ts` | **direkt**, mit Beobachtungen aus echtem Git statt aus Fixtures |
| `verification.ts` (`evaluateVerification`) | **direkt**, mit einer `changedFiles`-Liste, die der Verifier selbst aus `git diff` berechnet |
| `identity.ts` | über Logins aus `policy.json` gespeist |
| `state.ts`, `events.ts`, `runs.ts`, Replay | **nur für die Zustandsanzeige (K9)**: Events werden bei jedem Lauf aus GitHub-Fakten abgeleitet und repliziert. Das ist zugleich der erste Einsatz des Kerns auf echten Daten |
| Event-Felder wie `actorType`, selbst erklärte Rollen, `DeveloperReport` als Evidenz | nicht als Vertrauensquelle; Developer-Angaben sind nur Information im PR-Text |

**Kernel-Freeze für V0.1:** Keine neuen Zustände, keine neuen Event-Typen. Änderungen am Kern nur dort, wo der Verifier sie braucht (Diff-Basis, Testinventar, erweiterte geschützte Pfade).

### 6.4 Wo ich vom Deep Audit abweiche

Der Deep Audit (Abschnitte 17–20) und dieser Bericht stimmen in der Leitentscheidung überein: GitHub als Torwächter, keine PWA, kein Backend, kein Postgres, keine Queue, kein LLM-Gateway, Verifier in Actions. Abweichungen:

| # | Deep Audit | Hier | Begründung |
|---|---|---|---|
| A1 | Eigener persistenter Log `forge-log/log.jsonl` mit Genesis, `seq`, `eventId`, `prevHash`; ein Workflow als einziger Schreiber | **Kein eigener Log in V0.1.** Die Wahrheit sind PRs, Reviews, Check-Runs und Merge-Commits; der Zustand wird bei Bedarf daraus berechnet | Ein zweiter Ort der Wahrheit neben GitHub ist neue Infrastruktur (Schreibrechte für Workflows, Nebenläufigkeit, Genesis-Migration) für einen Bedarf ohne Vorfall. Reviews lassen sich in GitHub nicht löschen, nur sichtbar verwerfen; Merges auf geschütztem `main` sind dauerhaft. Ein Log lohnt sich erst, wenn Fakten anfallen, die GitHub nicht hält (Kosten, Leases) |
| A2 | Kernel-Erweiterungen Findings-Ledger, Staleness, Leases, `run_failed` durch System, Retry-Zähler (Tasks 6, 8, 9) | **GitHub-Regeln statt Kernel-Features:** Rework im selben PR (ein „Request changes“ blockiert, bis derselbe Reviewer freigibt), „Approval verfällt bei neuem Push“, „Approval des letzten Push nötig“, „Branch muss aktuell sein“, Force-Push gesperrt | Diese Regeln schließen Head-Drift, Findings, die einen neuen Run nicht überleben, und Merge auf veralteter Base, ohne dass der Kern wächst. Der Kern ist laut Audit intern konsistent; jede weitere Zeile vor dem ersten echten Run vergrößert den Abstand zur Wirklichkeit |
| A3 | Run-Start über `forge-gate` per Dispatch | **Run-Start bleibt in V0.1 ein Handoff, den Seb in die Agenten-App gibt** | Ein Workflow-Dispatch startet keinen Agenten. Ohne Adapter gibt es keinen Mechanismus dafür; den zu bauen ist genau die Plattformarbeit, die V0.1 vermeiden soll. „Run gestartet“ ist in V0.1 beobachtbar als neuer Run-PR |
| A4 | Budgets in `policy.json`, Retry-Limits, Tagessumme; Exit-Kriterium „Budget“ | **Kosten sind kein V0.1-Produktteil.** Ausgabelimits beim Anbieter je Agent-Schlüssel werden gesetzt (Konfiguration, kein Code) | Es gibt keine Kostendaten und keinen Kostenvorfall. Provider-Limits sind die einzige Grenze, die auch ohne Forge hält; eine Zählung in Forge wäre ohne Datenquelle Selbstauskunft |
| A5 | Mutationsliste im Contract und Ausführung im Verifier erst in NEXT 10 (Task 7) | **In V0.1 (K7)** | M1 ist der stärkste Beleg des Pilots, dass grüne Tests nicht reichen, und jede Mutationskampagne wurde von Hand neu gebaut. Das Verfahren existiert schon zweimal (Vite-Transform in `mutations.json` und M1) |
| A6 | Exit-Kriterien enthalten vier Recovery-Drills und Budget-Drill | **Ein Drill (Push fehlt) und ein Manipulations-Drill (Force-Push auf Run-Branch)** | Nur diese zwei sind im Pilot passiert bzw. werden von GitHub-Regeln direkt abgedeckt. Den Rest liefert der Run-Recovery-Thread als Eingabe für V0.2 |
| A7 | Erster echter Run: TASK-0005 | **Der Task, den Seb dafür bestimmt (laut Projekt TASK-0006)** | Sebs Vorgabe im TASK-0006-Auftrag. TASK-0005 braucht ohnehin eine kernkonforme Migration und damit ein neues Review; ob er manuell oder als zweiter Forge-Run läuft, ist Sebs Entscheidung |
| A8 | Status über eine generierte Markdown-Datei oder ein Issue | **Nur Issue und Check-Summaries**, keine generierte Datei im Repo | Eine vom Workflow committete Statusdatei bräuchte Schreibrechte auf `main` oder einen Nebenbranch und erzeugt Commits ohne Wert |

---

## 7. Mobile Control Plane

### 7.1 Grundsatz

Am Handy werden **Entscheidungen** getroffen, nicht Inhalte transportiert. Jede Entscheidung, die Forge zählt, ist eine authentifizierte GitHub-Aktion. Eine Freigabe im Chat (Claude-App, ChatGPT) ist keine Freigabe, weil sie nicht an Identität und SHA gebunden ist; genau das war P-07.

In V0.1 sind drei Apps beteiligt, die Seb heute schon benutzt: **GitHub Mobile** (Entscheidungen, Zustand), **Claude-App** und **ChatGPT/Codex-App** (Agenten starten und stoppen). Forge baut keine eigene Oberfläche.

### 7.2 Minimale User Journeys

| Journey | V0.1-Weg am Android-Handy | Taps (Ziel) | Was Forge liefern muss | Lücke bis später |
|---|---|---|---|---|
| **Projekt ansehen** | GitHub Mobile → Repo → angeheftetes Issue „Forge Status“ | 2 | Je Task eine Zeile: Zustand, aktuelle Contract-Version, offener PR, „wartet auf: Seb / Reviewer / Developer / Verifier“ | keine |
| **Contract ansehen** | Status-Issue → Contract-PR → Check „forge-contract“ (Kopf) bzw. „Files“ (Diff zur Vorversion) | 2–3 | Kopf mit Task, Version, Base, Scope (geschützte Pfade markiert), Checks (Steuerzeichen sichtbar), Mutanten, Content-Hash. Kein 600-Zeilen-Lesen nötig, um zu wissen, was sich geändert hat | keine |
| **Review ansehen** | PR → Reviews/Conversation | 1–2 | Reviewer-Identität und Rolle aus `policy.json` im Check sichtbar; blockierende Findings als „Request changes“ | Strukturierte Finding-IDs: später |
| **Approve** | Contract-PR → Review → Approve | 3 | Check zeigt vorher: Reviewer ≠ Autor, Contract parsebar, Base auf `main` | keine |
| **Run starten** | Status-Issue → Handoff-Block kopieren → in Claude- oder Codex-App einfügen | 3 + App-Wechsel | Handoff (6 Zeilen) plus Name der Rollenvorlage. Kein Contract-Text, kein abgetippter SHA | Start per Kommentar ohne App-Wechsel: LATER (siehe 9) |
| **Runstatus** | GitHub-Benachrichtigung bei neuem PR, rotem Check, Review-Anfrage → PR → Checks | 1–2 | Check-Namen eindeutig (`forge-gate`, `forge-verify`), Summary mit Zustand | Live-Fortschritt eines Agenten: nur in dessen App |
| **Fehler/Findings** | PR → fehlgeschlagener Check → Summary | 2 | Blockierend zuerst: Scope-Verstöße, rote Checks, Testinventar-Abweichung, überlebende Mutanten, je mit Datei | keine |
| **Kosten** | Mobile Browser → Nutzungsseiten der Anbieter; Actions-Minuten in GitHub | – | **nichts** in V0.1; nur gesetzte Ausgabelimits je Agent-Schlüssel | Tagessumme in Forge: LATER |
| **Kill** | (1) Integration stoppen: `FORGE_HALT=1` in den Repo-Einstellungen (mobiler Browser) oder PR schließen. (2) Rechenzeit stoppen: Session in Claude-/Codex-App beenden. (3) Notfall: Agent-Identität als Collaborator entfernen | 3–5 | Gate und Verifier lesen `FORGE_HALT`. Dokumentierte Notfallschritte | Ein-Tap-Kill über alle Agenten: braucht Adapter, LATER |
| **Preview** | entfällt; das Spiel hat keine Oberfläche | – | – | Preview-Deployments, sobald ein Task sichtbare Ausgabe hat |
| **Merge** | Run-PR → Merge | 2 | Merge-Button nur aktiv, wenn Checks auf Head grün, Branch aktuell, Code-Review gilt dem letzten Push; Check nennt den verifizierten SHA | keine |

### 7.3 Ehrliche Einschränkungen

- **Run starten und Kill (Rechenzeit) gehen nicht über GitHub allein.** Ohne Adapter kann Forge keinen Agenten starten oder anhalten. V0.1 akzeptiert das, weil beides in Apps geht, die Seb am Handy bereits hat, und weil der eigentliche Fehler (Inhalt per Copy-Paste) durch K4 verschwindet.
- **`FORGE_HALT` in den Repo-Einstellungen** ist am Handy nur über den mobilen Browser erreichbar, nicht in der GitHub-App (INFERRED, im Spike prüfen). Das reicht für einen nie benutzten Notfallschalter.
- **ChatGPT hat keine GitHub-Identität.** Ein ChatGPT-Review kann nur als Owner-Review eingehen. Wenn ein anbieterübergreifendes Review gefordert ist, muss es ein Agent mit eigener Identität sein (Claude oder Codex mit eigener Identität), oder es zählt nicht als unabhängig.

---

## 8. Infrastructure Required Now

| Baustein | Wofür | Aufwand-Art |
|---|---|---|
| **GitHub-Repo mit Rulesets auf `main`**: nur PR, Required Checks `forge-gate`/`forge-verify`/`forge-contract`, Approval verfällt bei Push, Approval des letzten Push nötig, Branch muss aktuell sein, kein Force-Push, keine Löschung; Force-Push auch auf `forge/run/**` gesperrt | K1, K3, K10 | Konfiguration |
| **CODEOWNERS** für `.github/`, `forge/policy.json`, `forge/contracts/**`, Testkonfiguration, `package.json`, Lockfile → nur Owner | K6, K8 | Konfiguration |
| **GitHub Actions**, drei Workflows aus `main`: `forge-contract` (Contract-PR), `forge-run` (Gate + Verify + Mutanten, je Check ein Job, ohne Secrets, `contents: read`), `forge-status` (Summaries und Status-Issue) | K2, K5, K6, K7, K9 | Code, klein |
| **Kleine Node-CLI im Repo** (`forge contract-check`, `forge handoff`, `forge verify`, `forge status`), die `src/forge` aufruft. Läuft in Actions; lokal nur lesend nützlich | K2, K4, K5, K6, K9 | Code, klein |
| **`forge/policy.json`**: Login → Rolle, geschützte Pfade, Unabhängigkeitsregel | K8 | Datei |
| **Eigene GitHub-Identität je Agent**, insbesondere für Codex (heute Sebs Konto) | K8 | Owner-Konfiguration |
| **Rollenvorlagen** `forge/roles/{developer,reviewer,spec-author}.md` mit Handoff-Platzhalter | K4 | Dateien |
| **`.gitattributes`** (`* text=auto eol=lf`) und gepinnte Node-Version | K6 | Dateien |
| **Ausgabelimits beim Anbieter** je Agent-Schlüssel/Konto | Kostenschutz ohne Forge | Owner-Konfiguration |

**Nicht** nötig: Server, Datenbank, eigene GitHub App, Secrets in Workflows, Modell-Zugang für Forge.

---

## 9. Infrastructure Deferred

| Baustein | V0.1? | Warum | Wann neu prüfen |
|---|---|---|---|
| **PWA** | Nein | GitHub Mobile deckt Entscheidungen und Zustand ab; Agenten-Apps decken Start und Stopp ab | Eine Journey aus 7.2 braucht nachweislich mehr als drei Taps oder einen Desktop |
| **Backend** | Nein | Workflows sind das Backend; ein Server bräuchte Auth, Hosting, Secrets und wäre selbst Angriffsfläche | Forge muss Agenten selbst starten (Adapter) oder Webhooks außerhalb von Actions empfangen |
| **Postgres** | Nein | Kein Zustand außerhalb von Git/GitHub (Abweichung A1) | Kosten-, Lease- oder Mehrnutzerdaten |
| **Queue** | Nein | GitHub-Events sind die Queue; nie mehr als ein Run je Track | Mehr als ca. 3 gleichzeitige Runs, die Forge selbst startet |
| **GitHub App (eigene)** | Nein | `GITHUB_TOKEN` in Workflows plus getrennte Agenten-Identitäten genügen für einen Owner. Die Agenten bringen eigene Apps ihrer Anbieter mit | Mehrere Repos oder Nutzer; oder Workflow-Token reicht für Status-Issue/Checks nicht |
| **GitHub Actions** | **Ja** | Einzige verfügbare Umgebung, die nicht dem Developer gehört (N5) | – |
| **LLM Gateway** | Nein | Forge ruft kein Modell auf; Kostengrenze über Anbieter-Limits | Forge ruft selbst Modelle auf und braucht zentrale Limits |
| **Anthropic Adapter** | Nein | Run-Start per Handoff reicht für V0.1 (A3). Billigster späterer Weg: Agent wird per PR-/Issue-Kommentar in GitHub ausgelöst, sofern der Anbieter das anbietet (INFERRED, nicht in diesem Repo geprüft) | Nach V0.1-Exit, wenn manuelle Starts gemessen der größte verbleibende Handgriff sind |
| **OpenAI Adapter** | Nein | wie Anthropic; zusätzlich zuerst Codex-Identität lösen | wie oben |
| **Cloud Runner** | Nein für Agenten; für den Verifier genügen GitHub-hosted Runner | Agenten laufen bereits beim Anbieter | Agent braucht Umgebung, die kein Anbieter liefert, oder Verifier braucht mehr als GitHub-Runner |
| **SSE** | Nein | kein eigenes UI; GitHub-Benachrichtigungen | eigenes UI existiert |
| **Preview Deployments** | Nein | Das Spiel hat keine Oberfläche | erster Task mit sichtbarer Ausgabe |
| Persistenter Event-Log mit Hash-Kette | Nein | Abweichung A1 | Fakten außerhalb von GitHub |
| Leases, Heartbeats, Recovery-Automatik | Nein | ein Vorfall, von Hand gelöst; Erkennung „kein PR“ reicht | Ergebnis des Run-Recovery-Threads; wiederholte verwaiste Runs |
| Kosten-/Budget-Tracking | Nein | keine Daten, kein Vorfall (A4) | erste überraschende Rechnung |

---

## 10. Exit Criteria

V0.1 ist fertig, wenn jeder Punkt mit einem Beleg (PR-Link, Workflow-Lauf, Check-Summary) nachgewiesen ist.

1. **Ein echter Task end-to-end über Forge**: Contract-PR → Review durch Identität ≠ Spec-Autor → Merge → Handoff → Run-PR von `forge/run/*` → Gate und Verifier grün → Code-Review durch Identität ≠ Developer → Merge durch `Wuerfelduell` **am Android-Handy**. Task: der von Seb bestimmte erste Forge-Task (laut Projekt TASK-0006).
2. **Null Contract-Text und null getippte SHAs in Chats** für diesen Task. Jeder Agent bekam nur Handoff + Rollenvorlage; seine Read-Quittung stimmte mit dem vom Check berechneten Hash überein.
3. **Höchstens fünf Owner-Handgriffe pro Task**: Freigabe, Handoff an Developer, Handoff an Reviewer, Abnahme (Merge), gegebenenfalls eine Rückfrage. Kein Weiterleiten von Ergebnissen zwischen Agenten.
4. **Eine Wahrheit**: `main` enthält Forge-Core und Mystery-Stand; das Status-Issue beantwortet „was ist auf `main`, was ist offen, wer ist dran“ korrekt; keine Koordinationsdateien mehr im Produktpfad; kein Arbeitsstand existiert nur auf einem Agenten-Branch.
5. **Verifier nicht vom Developer steuerbar**, nachgewiesen mit einem absichtlich bösartigen Test-PR, der fehlschlagen muss: ändert den Workflow, ändert `vitest.config.*`, fügt `describe.skip` ein, legt eine `.test.ts` außerhalb des Scopes an, setzt einen Commit-Status gleichen Namens per API, liefert leeren Diff-Anspruch, enthält Code zwischen Base und Contract-Commit.
6. **Mutation Smoke wirkt**: Ein im Contract gelisteter Mutant, den die Tests nicht erkennen, macht `forge-verify` rot (Nachstellung von M1).
7. **Staleness wirkt**: Wird `main` nach der Verifikation bewegt, ist der Run-PR nicht mergebar, bis er auf aktuellem `main` erneut grün ist; ein neuer Push verwirft das Code-Review.
8. **Identitäten**: Jeder Agent handelt unter eigener GitHub-Identität; Codex nicht mehr unter Sebs Konto; ein Review des Developers auf dem eigenen PR zählt nachweislich nicht.
9. **Sperre**: `FORGE_HALT=1` lässt Gate und Verifier nachweislich fehlschlagen; die Notfallschritte für Agenten-Sitzungen und Identitäten sind dokumentiert.
10. **Zwei Störfälle durchgespielt**: Push fehlt (kein PR → Status zeigt „wartet auf Developer“, nichts wird angenommen) und Force-Push auf Run-Branch (vom Ruleset abgewiesen).

Nicht Exit-Kriterium: Kosten, Preview, automatische Agentenstarts, Recovery-Automatik, Parallelplanung.

---

## 11. Next 5 Platform Tasks

| # | Task | Inhalt | Nachgewiesener Bedarf | Abhängigkeit |
|---|---|---|---|---|
| 1 | **FORGE-OPS-0001 Baseline und Repo-Hygiene** | Erst-Integration nach `main` abschließen (Codex arbeitet daran), Rulesets, CODEOWNERS, `.gitattributes`, Node-Pin, Koordinationsdateien aus dem Produktpfad nehmen, eigene GitHub-Identität für Codex, `policy.json` v0 | N3, N5 (CRLF), N8, P-09, P-12 | Owner-Entscheidungen |
| 2 | **FORGE-OPS-0002 Verifier-Spike** | Nachweis, dass ein Required Check aus `main` stammt und vom PR nicht verändert oder durch einen gleichnamigen Status ersetzt werden kann (Kandidat: `pull_request_target`, nur Lesen, keine Secrets, expliziter Checkout des Head-SHA). Mit dem bösartigen Test-PR aus Exit-Kriterium 5 | N5 | 1 |
| 3 | **FORGE-CORE-0002 Contract-PR und Handoff** | `---json`-Vorlage ohne Status, Migration des nächsten echten Contracts, `forge contract-check` im Contract-PR, `forge handoff` nach Merge, Rollenvorlagen, Gate-Check auf dem Run-PR (Verzweigung vom Contract-Merge-Commit, Dependencies in `main`, Read-Quittung) | N1, N2, N4, N9 | 1, 2 |
| 4 | **FORGE-CORE-0003 Run-Verifier** | Je Pflicht-Check ein Job; Diff gegen Start-Commit ohne Rename-Erkennung; `evaluateVerification` mit selbst berechneten `changedFiles`; Testinventar (Anzahl, Skips) gegen `main`; Mutanten aus dem Contract im Speicher; Summary blockierend zuerst | N5, N6 | 2, 3 |
| 5 | **FORGE-OPS-0003 Status-Projektion und erster echter Run** | `forge status`: Events aus GitHub ableiten, Kern replayen, Check-Summaries und Status-Issue schreiben. Danach der erste echte Task end-to-end vom Handy, mit Zählung der Owner-Handgriffe | N8; Exit-Kriterien 1–4 | 3, 4 |

Was danach kommt, entscheidet die Messung aus Task 5: Wenn manuelle Starts der größte Rest sind, ein Adapter; wenn verwaiste Runs auftreten, Leases; wenn Kosten auffallen, Zählung.

---

## 12. Top 10 Dinge, die wir NICHT bauen sollten

| # | Nicht bauen | Warum nicht |
|---|---|---|
| 1 | **Eigene PWA oder Mobile-App** | Jede V0.1-Entscheidung geht in GitHub Mobile; eine eigene App löst keines der Pilotprobleme und braucht Backend, Auth und Hosting |
| 2 | **Backend mit Postgres** | Kein Zustand außerhalb von Git/GitHub; ein Server wäre neue Angriffsfläche ohne nachgewiesenen Bedarf |
| 3 | **Eigenen Event-Log als zweite Wahrheit neben GitHub** | Replay lief nie auf echten Daten; GitHub hält PRs, Reviews und Merges bereits authentifiziert. Erst bauen, wenn Fakten anfallen, die GitHub nicht hält |
| 4 | **Weitere Kernel-Zustände, Findings-Ledger, Leases, Retry-Zähler vor dem ersten echten Run** | GitHub-Regeln decken diese Fälle für einen Owner ab; der Kern ist intern konsistent, seine Lücken liegen an den Eingängen |
| 5 | **LLM-Gateway und Anbieter-Adapter** | Forge ruft in V0.1 kein Modell auf. Erst messen, ob Agentenstarts nach V0.1 wirklich der Engpass sind |
| 6 | **Eigenen Cloud-Runner für Agenten** | Agenten laufen beim Anbieter; nur der Verifier braucht Trennung, und dafür reichen GitHub-Runner |
| 7 | **Queue, Scheduler, Parallelplanung** | Nie mehr als ein Run je Track; das einzige Parallelproblem war fehlende Integration (N3) |
| 8 | **Kosten- oder Billing-System** | Keine Kostendaten, kein Vorfall. Anbieter-Limits je Schlüssel sind die einzige Grenze, die auch hält, wenn Forge versagt |
| 9 | **LLM als Verifier oder automatischer Merge** | Checks sind maschinell; ein Modell ist nur ein weiterer nicht vertrauenswürdiger Reviewer. Merge ist Owner-Entscheidung |
| 10 | **Weitere Red-Team-, Fuzz- und Mutationskampagnen als Pflichtprozess** | Hoher Aufwand je Durchlauf, Grenzertrag am reinen Kern gering. Mutationen gehören als kurze Liste in den Contract (K7), nicht als Kampagne in jeden Run |

---

## Anhang: Offene Owner-Entscheidungen, die V0.1 blockieren

1. Welcher Stand kommt bei der Erst-Integration nach `main` (läuft bei Codex)? Was passiert mit dem TASK-0004-Contract v1 und `e9cb8e2` (Dependency-Audit-Thread)?
2. Welche GitHub-Identität bekommt Codex?
3. Wer ist der unabhängige Reviewer je Gate, wenn ChatGPT keine eigene Identität hat?
4. Ist TASK-0006 der erste Forge-Task, und läuft TASK-0005 vorher noch manuell?
