# FORGE DEEP RED TEAM

Rolle: Principal Adversarial Security Reviewer · Stand: 2026-10-03 · strikt read-only
Geprüfter Stand: `codex/forge-core-v2-repair` @ `b9339d213476265d919cf3d33c0503e8bb3dc23c` (Impl. `811ed0d`)
Kein Commit, kein Push, kein PR, kein Branch berührt. Alle Experimente liefen in einem Wegwerf-Klon im Scratchpad dieser Session (Code unverändert, eigene Testdatei nur dort). Das Experiment-Skript liegt zur Nachvollziehbarkeit unter `forge-audits/deep-red-team-experiments/x.test.ts` (in einem Wegwerf-Klon nach `tests/xrt/` legen und mit `npx vitest run tests/xrt` ausführen).

Kennzeichnung der Herkunft:
- **NEU**: in RT-01..RT-15 und im Deep Audit (`FORGE-DEEP-AUDIT.md`) nicht enthalten.
- **NEU (Variante von X)**: neuer Mechanismus oder neue Folge eines bekannten Befunds X.
- **BEKANNT (X)**: nur zur Vollständigkeit der Matrix, mit Verweis. Nicht als neu gezählt.

---

## 1. Scope

**Neuester Stand.** `git ls-remote origin` am 2026-10-03 ~07:30 UTC: `codex/forge-core-v2-repair` = `b9339d2`, `claude/forge-architecture-review-hjdq89` = `be40a68`, `codex/mystery-task-0005` = `fab792a`, `codex/task-0004-contract` = `6a8c0c5`, `main` = `f5dbc73` (leer). Codex hat **keinen** neueren Baseline-Branch gepusht. Geprüft wurde deshalb `b9339d2`, derselbe Stand wie im Deep Audit.

**Untersucht** (vollständig gelesen, 1225 Zeilen): `src/forge/{primitives,identity,ancestry,contract-document,events,runs,start-gate,verification,state,kernel,freeze,node-sha256}.ts`, dazu `tests/forge-red-team/findings.test.ts`, `forge/reviews/FORGE-CORE-0001AB.red-team.md`, die Contracts unter `forge/contracts/`, `tsconfig.json`, `package.json`.

**Bereiche:** Contracts, Approval, Start Gate, Eventlog, Replay, Runs, Remote Verification (Observation), Scope Enforcement, Checks, Mutation Evidence, Reviewer Independence, Acceptance, Red-Team-Tests.

**Methode.**
1. 30 Kernel-Experimente gegen den echten Code (Vitest im Wegwerf-Klon, Fixtures aus `tests/forge/fixtures.ts` und `run-fixtures.ts` importiert, nicht verändert). Ergebnisse als `X01..X43` zitiert.
2. Git-Experimente in Wegwerf-Repos (`G1..G6`): Rename-Erkennung, Symlinks, Case-Kollision, `refs/replace`, Shallow Clone, `check-ref-format`.
3. Abgleich jeder Hypothese mit RT-01..RT-15 und dem Deep Audit (C-, L-, V-, R-, NRT-Nummern).

**Nicht geprüft:** echte GitHub-Webhooks, Fork-Netzwerk-Verhalten auf github.com (würde einen Push erfordern), Windows- und macOS-Dateisysteme (nur Linux verfügbar). Diese Punkte sind als TRUST_BOUNDARY oder INFERRED markiert.

---

## 2. Actual Trust Boundaries

Der Kern ist eine reine Funktion `(Log, Policy, sha256) → Zustand`. Er führt nichts aus, liest kein Git und authentifiziert niemanden. Jede Sicherheitsaussage hängt daran, wer welchen Fakt liefert.

| Fakt im Kern | Wer liefert ihn heute | Was der Kern selbst prüft | Grenze |
|---|---|---|---|
| Identität (`actor`) und Rolle (`role`) | jeder Event-Absender, selbst erklärt | Schema; `sameIdentity` als Feldvergleich; `OWNER_NOT_HUMAN` nur bei `task_accepted` | keine Authentifizierung (RT-05) |
| Contract-Text und Hash | Spec-Autor | kanonisches Format, Hash über **dekodierten Text** | Text ↔ Blob-Bytes nicht gebunden (DRT-27) |
| `contractCommit` | Spec-Autor | nichts bei Registrierung | erst das Gate vergleicht gegen eine gelieferte Beobachtung (C-26) |
| Start-Beobachtung (Refs, Parent-Kanten, Datei am Commit) | **Developer** (`run_started` hat Rolle `developer`) | Erreichbarkeit und Ancestry über die gelieferten Kanten | NRT-30 |
| Remote-Beobachtung | Observer, selbst erklärt | Ancestry über gelieferte Kanten; **eine** positive Beobachtung genügt; nur im Zustand `reported` annehmbar | keine Zeit, keine Reihenfolge, kein Repo, kein Widerruf (DRT-11/12, RT-09) |
| Verification Evidence | Verifier, selbst erklärt | Check-Namen und Command-Strings exakt, Exit 0, Pfade gegen Scope (String-Gleichheit), Mutationsliste formal | keine Diff-Basis (NRT-01), keine Dateimodi (DRT-22), keine Diff-Optionen (DRT-21) |
| Code Review | Code-Reviewer, selbst erklärt | Commit = verifizierter Commit, Unabhängigkeit vom Developer gemäß Policy | Findings ohne Gedächtnis über Runs und Versionen (E-01, DRT-02) |
| Acceptance | „Owner“ mit `actorType: human` | Zustand `review_approved`, neuester verifizierter Run | `human` ist ein Feld |
| Reihenfolge und Vollständigkeit des Logs | unbestimmter Appender | strikte Zustandsmaschine pro Event | keine `eventId`, kein `prevHash`, kein CAS (L-01..L-12) |

**Was der Kern tatsächlich garantiert:** Wenn alle gelieferten Fakten wahr sind und genau ein Appender den Log seriell schreibt, ist die Zustandsableitung korrekt, deterministisch und fail-closed. Die Experimente unten bestätigen das für alle Reihenfolge-, Race- und Wiederholungsangriffe innerhalb des Logs (DRT-13, -36..-39, -44). Die neuen Befunde liegen fast alle **an den Rändern**: wie Beobachtungen zeitlich gedeutet werden, wie Pfade und Inhalte identifiziert werden, und dass Gates kein Gedächtnis haben.

---

## 3. 30+ Attack Matrix

44 Hypothesen. Status: CONFIRMED (Angriff gelingt am echten Code), MITIGATED (Code schützt, Grund angegeben), TRUST_BOUNDARY (Schutz hängt an einem ehrlichen Lieferanten außerhalb des Kerns), NOT_REPRODUCED (Angriff scheitert).

### 3.1 Contracts und Approval

| ID | Attack | Expected Security Property | Actual Behavior | Status | Evidence | Recommended Fix |
|---|---|---|---|---|---|---|
| DRT-01 | Contract-Text nach Approval ändern und starten | Approval gilt nur für exakt den Text | neuer Text = neuer Hash; Start `CONTRACT_FILE_MISMATCH`/`CONTRACT_UNKNOWN` | MITIGATED · BEKANNT (C-01) | `start-gate.ts:83-89`, Approval hängt an `contentHash` | – |
| DRT-02 | **Architektur-`changes_requested` (blocking) umgehen:** v2 registrieren, die sich nur in `contractVersion` unterscheidet, dann approved durch anderen oder denselben Reviewer | Blocking-Findings einer Revision müssen in der nächsten Revision adressiert werden | v2 wird approved, Task `ready`, sowohl mit `vendor-c` (X04a) als auch mit demselben Reviewer (X04b). Scope, Checks, Text identisch bis auf die Versionsnummer | **CONFIRMED · NEU (Architektur-Analogon zu E-01)** | X04a/X04b; `state.ts:308-328` prüft nur die aktuelle Revision, `decisions` werden nicht vererbt | Findings-Ledger auch für das Architektur-Gate: `approval_recorded(approved)` auf v(n+1) muss jede offene blocking Finding-ID aus v≤n als `resolved`/`withdrawn` adressieren; zugewiesener Reviewer pro Task, Wechsel nur durch Owner |
| DRT-03 | Falscher `contractCommit` bei Registrierung; zwei Versionen mit **demselben** `contractCommit` | Commit muss die Datei mit genau diesem Hash enthalten; ein Commit kann nicht zwei Inhalte haben | Registrierung prüft den Commit nicht. v1 und v2 mit identischem `contractCommit` werden beide angenommen (X33), obwohl eine Datei an einem Commit nur einen Inhalt haben kann | TRUST_BOUNDARY · BEKANNT (C-26), Teilaspekt X33 NEU | X33; `state.ts:293-306` | Bei Registrierung `contractCommit` gegen eine Observer-Beobachtung `(commit, path, blobSha, contentHash)` prüfen; `contractCommit` je Task streng monoton (v(n+1) Nachfahre von v(n)) |
| DRT-04 | Falscher `baseCommit` (kein Vorfahre des Contract-Commits) | Start blockiert | `BASE_NOT_IN_CONTRACT_HISTORY` | MITIGATED / TRUST_BOUNDARY · BEKANNT (C-07) | `start-gate.ts:92` | – |
| DRT-05 | **Contract-Commit als Merge-Commit**, zweiter Parent bringt ungeprüften Seitenzweig mit | ungeprüfter Code darf nicht im Startpunkt landen | Graph `contract → [base, EVIL]`: Start erlaubt, `startFromCommit = contract` enthält EVIL (X23). Kein Scope-Diff sieht EVIL | **CONFIRMED · NEU (Variante von C-08)** | X23; `start-gate.ts:92` prüft nur `base ⊑ contract` | Regel aus C-08 schärfen: Contract-Commit hat **genau einen** Parent, dieser ist `baseCommit`, und `diff(base, contract)` = nur die Contract-Datei |
| DRT-06 | Stale Dependency: Developer erfindet in seiner Start-Beobachtung die Kante `base → acceptedCommit(dep)` | Dependency muss wirklich in der Base liegen | ehrlicher Graph: `DEPENDENCY_NOT_IN_BASE`; erfundene Kante: Start erlaubt (X43) | CONFIRMED · BEKANNT (NRT-30/E-04), Dependency-Folge NEU | X43_honest vs X43_fabricated | Start-Beobachtung nur vom Observer, nie vom Developer |
| DRT-07 | Stale Dependency nach Patch-Task: B hängt an A@X; später wird `A-PATCH` (eigene Task-ID) akzeptiert, weil A fehlerhaft war | B muss erkennen, dass seine Dependency überholt ist | Kein Event verbindet A und A-PATCH; B wird mit dem fehlerhaften A@X approved und akzeptiert | CONFIRMED (CODE) · NEU (Folge von C-15) | `state.ts:320-325` vergleicht nur `acceptedCommitOf(dep)`; reales Muster `FORGE-CORE-0001A-PATCH-0001` | Patches als neue Version derselben Task-ID, oder Event `task_superseded_by` mit Warnung für alle Dependents |
| DRT-08 | Dependency nach Runstart ersetzen | Dependency-SHA ist fest | Acceptance ist terminal: `contract_registered`/`approval_recorded` nach Acceptance → `TASK_ALREADY_ACCEPTED`; SHA im Contract fixiert | MITIGATED | `state.ts:296, 311, 415-424` | – |
| DRT-09 | Contract-Commit ist nicht Vorfahre des Run-Ergebnisses | Run nie `remote_verified` | `remoteOutcome` verlangt `startedFromCommit ⊑ claimedResultCommit` | MITIGATED / TRUST_BOUNDARY · BEKANNT (C-25) | `verification.ts:24-29` | – |

### 3.2 Eventlog, Replay, Reihenfolge, Duplikate

| ID | Attack | Expected | Actual | Status | Evidence | Fix |
|---|---|---|---|---|---|---|
| DRT-10 | Duplicate Webhook: gleiches `verification_recorded` zweimal | Duplikat = No-op | zweites Event `RUN_STATE_INVALID (verified)` | CONFIRMED · BEKANNT (E-16) | X19 | `eventId` als Idempotenzschlüssel (Deep Audit §5.4) |
| DRT-11 | **Push-Webhook kommt vor dem Developer-Report** (natürliche Reihenfolge: erst Push, dann Report) | Beobachtung wird angenommen oder gepuffert | `remote_observed` im Zustand `running` → `RUN_STATE_INVALID`. Ohne Retry nach dem Report bleibt der Run für immer `reported` | **CONFIRMED · NEU** | X02; `state.ts:361` akzeptiert nur `reported` | Beobachtungen in jedem aktiven Zustand annehmen und erst ab Report auswerten, oder Observer pollt nach dem Report aktiv |
| DRT-12 | **Beobachtungen außer Reihenfolge:** zuerst „Branch gelöscht“ (`head: null`), danach ein verspätet zugestellter alter Push (`head: RESULT`) | Neueste Wahrheit zählt; ein gelöschter Branch ist nicht persistiert | Run wird `remote_verified` (X01), Kette läuft bis `accepted` (X01c). Ein danach eintreffendes „gelöscht“ wird abgelehnt (X01b) | **CONFIRMED · NEU (verwandt mit RT-09)** | X01/X01b/X01c; `state.ts:202` (`observations.some(...)`) | Beobachtung trägt `observedAt` und monotone `seq` eines einzigen Observers; gewertet wird die **jüngste** Beobachtung pro Ref; vor Review und vor Acceptance Pflicht-Neubeobachtung |
| DRT-13 | Events in falscher Reihenfolge (Report vor Start, Verification vor Observation, Review vor Verification, Acceptance vor Review) | abgelehnt | jeweils abgelehnt | MITIGATED · BEKANNT (L-07) | strikte `requireRun`-Zustände, X18 | – |
| DRT-14 | Replay-Manipulation: Log kürzen, Event einfügen, Policy tauschen | erkennbar | nicht erkennbar | CONFIRMED · BEKANNT (L-01, L-04, E-07, E-08) | Deep Audit §5 | Genesis-Event, `prevHash`, externer Anker |
| DRT-15 | Persistenz verliert einzelne Surrogate (UTF-8-Encoder statt `JSON.stringify`): zwei Labels `dev\ud800`/`dev\ud801` werden beide zu `dev�` | Replay ergibt denselben Zustand | Live: unabhängig, `ok`. JSON-Roundtrip: `ok` (X13_json). Verlustbehafteter Export: Replay bricht bei Index 7 mit `REVIEWER_NOT_INDEPENDENT` ab (X13_lossy) | MITIGATED, solange JSONL per `JSON.stringify` geschrieben wird · NEU (Identitäts-Folge von RT-13) | X13_* | `TextSchema` und `AgentIdentity.label` lehnen einzelne Surrogate ab; Log-Format „JSONL via `JSON.stringify`“ festschreiben |
| DRT-16 | Force-Push oder Branch-Delete nach `remote_verified` | Kern erfährt davon, Acceptance blockiert | Beobachtung nicht aufzeichenbar (`RUN_STATE_INVALID`) | CONFIRMED · BEKANNT (RT-09) | X01b | siehe DRT-12 |

### 3.3 Remote Refs und Git-Beobachtung

| ID | Attack | Expected | Actual | Status | Evidence | Fix |
|---|---|---|---|---|---|---|
| DRT-17 | RemoteRef-Tricks: Refs `main` **und** `refs/heads/main` mit verschiedenen Heads in einer Beobachtung; `claimedRemoteRef: "--upload-pack"` | eine kanonische Ref-Schreibweise; keine optionsartigen Namen | beides angenommen (X06a, X06b). `git check-ref-format refs/heads/--upload-pack` ist gültig (G6), `refs/heads/refs/heads/main` ebenso, d. h. die Mehrdeutigkeit existiert in Git selbst | CONFIRMED im Kern; Ausnutzung TRUST_BOUNDARY (Observer-CLI) · NEU (Variante von RT-15) | X06a/b, G6 | `RefName` nur voll qualifiziert (`refs/heads/…`), kein Segment beginnt mit `-` oder `.`; Observer übergibt Refs immer nach `--` |
| DRT-18 | **`refs/replace/*` fälscht Ancestry für einen ehrlichen Observer:** Developer pusht `git replace --graft EVIL CONTRACT` als `refs/replace/<sha>` | Observer sieht nur echte Parent-Kanten | Mirror-Klon des Remotes: `merge-base --is-ancestor CONTRACT EVIL` = **YES**; normaler Klon: NO; mit `GIT_NO_REPLACE_OBJECTS=1`: NO (G4) | **CONFIRMED · NEU** (Kern erhält die gefälschte Kante, obwohl jeder Akteur „ehrlich“ `git` aufruft) | G4: Bare-Remote, `git push … 'refs/replace/*'`, `git clone --mirror` | Observer und Verifier immer mit `GIT_NO_REPLACE_OBJECTS=1`, keine Mirror-Klone, `refs/replace/*` per Branch-Protection/Push-Regel verbieten |
| DRT-19 | Unvollständige Beobachtung durch Shallow Clone (GitHub Actions `fetch-depth: 1` ist Standard) | Run endet sichtbar | Shallow-Klon kennt keinen Parent; Ancestry nicht beweisbar → Run bleibt `reported`, es gibt keinen Fehlerübergang außer durch Developer/Owner | CONFIRMED (fail-closed, Liveness) · NEU | G5: `rev-list --parents` liefert 1 Wort, `merge-base` „Not a valid commit“ | Observer mit `fetch-depth: 0`; Fehlercode `OBSERVATION_INCOMPLETE` statt stillem Hängen |
| DRT-20 | Fork-Netzwerk: Commit liegt nur in einem Fork, ist aber auf github.com per SHA über das Upstream-Repo abrufbar | Evidence und Beobachtung gelten nur für `Wuerfelduell/Forge` | Weder Beobachtung noch Evidence noch Contract nennen ein Repository. Ein Verifier, der `git fetch origin <sha>` macht, prüft ggf. Fork-Code | TRUST_BOUNDARY · NEU (nicht getestet, kein Push erlaubt) | `events.ts:18-22`, `runs.ts:62-69` ohne Repo-Feld | `repo: "Wuerfelduell/Forge"` in Beobachtung und Evidence; Verifier holt nur Refs per `ls-remote` des kanonischen Repos, nie einen nackten SHA |
| DRT-41 | Beobachtung mit fehlenden Kanten | blockiert | `not_contained`, Run hängt | MITIGATED (Sicherheit) · Liveness wie DRT-19 | `ancestry.ts:1-2` | wie DRT-19 |
| DRT-44 | Zyklischer, erfundener Graph | terminiert | terminiert, blockiert (`BASE_COMMIT_NOT_PERSISTED`) | MITIGATED | X39; `seen`-Set in `ancestry.ts:13` | – |

### 3.4 Scope, Pfade, Dateisysteme

| ID | Attack | Expected | Actual | Status | Evidence | Fix |
|---|---|---|---|---|---|---|
| DRT-21 | Rename-Semantik hängt an den Diff-Optionen des Verifiers | gleiche Git-Änderung → gleiches Urteil | `CODEX.md → archive/CODEX.md`: mit Rename-Erkennung `R100` → **passed**; mit `--no-renames` `D`+`A` → **failed** (X09, G1). Umgekehrt scheitert jeder legitime Rename innerhalb des Scopes immer (X09_scopeRename) | CONFIRMED · NEU (Variante von §7.4.1 Deep Audit) | X09_*, G1 | Evidence nennt `diffOptions`; Kern verlangt `--no-renames` (dann reicht `added/modified/deleted`) |
| DRT-22 | **Symlink unter `forge/coordination/`** auf eine Datei außerhalb des Repos (`/etc/hostname`) oder auf `src/` | Symlinks nur mit Freigabe | erscheint als `A` (Mode `120000` nur in `--raw`), Evidence kennt keine Modi, Coordination-Ausnahme lässt ihn ohne Scope durch (X10). Ein Agent, der Coordination-Dateien als Kontext liest, liest die Host-Datei (G2: `cat` liefert den Hostnamen) | **CONFIRMED · NEU (Kombination aus V-26 und RT-02)** | X10, G2 | Evidence mit Git-Mode; `120000` und `160000` immer `SCOPE_VIOLATION`, auch unter Coordination |
| DRT-23 | **Aliase geschützter Pfade im Scope:** `forge/Contracts/TASK-0001.md`, `Forge/contracts/TASK-0001.md`, `forge/contracts./TASK-0001.md`, `forge/approvals/TASK-0001.json`, fremder Contract `forge/contracts/TASK-0002.md` | Contract unzulässig bzw. Verstoß | Contract parst (X07a). Änderungen an den Alias-Pfaden bestehen die Verifikation (X07b), weil `ownPath` und `ALWAYS_FORBIDDEN_PREFIXES` exakte, case-sensitive Präfixvergleiche sind. Auf case-insensitiven Checkouts (Windows, macOS) landet `forge/Contracts/…` im echten Contract-Verzeichnis | **CONFIRMED · NEU** | X07a/b; `contract-document.ts:47`, `verification.ts:12, 60` | Parser: Scope-Pfade case-gefaltet gegen alle geschützten Präfixe prüfen und ablehnen; Segmente mit End-Punkt/Leerzeichen verbieten |
| DRT-24 | Case-Kollision: `src/A.ts` neben `src/a.ts`, `forge/coordination/codex.md` neben `CODEX.md` | eine Datei = ein Pfad auf allen Plattformen | Git speichert beide (G3), Kern wertet `src/A.ts` als legitimes `added` (X08). Unter Coordination braucht es nicht einmal Scope. Auf Windows/macOS überschreibt beim Checkout eine Datei die andere | CONFIRMED (Kern, Git) · Plattformfolge INFERRED · NEU | X08, G3 | Kern lehnt `changedFiles` ab, deren case-gefalteter Pfad mit einem anderen Pfad im Tree kollidiert (Verifier liefert dazu `git ls-tree`-Kollisionsliste) |
| DRT-25 | Windows-reservierte Namen und End-Punkte unter Coordination (`forge/coordination/aux.md`, `notes.`) | plattformneutrale Pfade | `RepoPath`-Regex erlaubt sie, Coordination-Ausnahme lässt sie zu. Git for Windows verweigert den Checkout solcher Pfade (`invalid path`) | CONFIRMED (Regex) · Folge INFERRED · NEU | `primitives.ts:14-20` | Regex: keine reservierten Gerätenamen, kein End-Punkt/Leerzeichen je Segment |
| DRT-26 | CRLF im Contract | gleicher Hash auf allen Plattformen | `CARRIAGE_RETURN`, fail-closed | MITIGATED (Kern) · Betriebsrisiko BEKANNT (C-34) | `contract-document.ts:109` | `.gitattributes` mit `* text=auto eol=lf` |

### 3.5 Inhalte, Unicode, JSON

| ID | Attack | Expected | Actual | Status | Evidence | Fix |
|---|---|---|---|---|---|---|
| DRT-27 | **Ungültige UTF-8-Bytes:** drei verschiedene Blobs (`…0xFF`, `…0xFE`, `…EF BF BD`) | verschiedene Bytes → verschiedener Hash | `Buffer.toString("utf8")` ersetzt ungültige Bytes durch U+FFFD; alle drei ergeben **denselben** `contentHash` `13716a6ddcca…` (X12). Der Hash bindet dekodierten Text, nicht den Blob | **CONFIRMED · NEU** | X12; `contract-document.ts:140` | Hash über Blob-Bytes (oder `TextDecoder("utf-8", { fatal: true })` als Pflicht-Port); Approval zusätzlich an Blob-SHA binden |
| DRT-28 | NUL und Bidi-Override in der Contract-Prosa | sichtbar markiert oder abgelehnt | angenommen (X35). Agenten lesen die Prosa als Anweisung | CONFIRMED · NEU (Prosa-Variante von C-30) | X35 | Steuerzeichen außer `\n`/`\t` und Bidi-Zeichen U+202A–U+202E, U+2066–U+2069 im ganzen Text ablehnen |
| DRT-29 | Zahlen- und JSON-Sonderfälle (`contractVersion: 9007199254740993`, `1.0`, `__proto__`) | abgelehnt | `FRONTMATTER_NOT_CANONICAL` (X15); `__proto__` abgelehnt (RT-11) | MITIGATED | X15; `contract-document.ts:121-128` | – |
| DRT-30 | Rohes Event nach `applyEvent` mutieren (TOCTOU) | Zustand unverändert | unverändert (X14) | MITIGATED · BEKANNT (RT-11/12) | X14 | – |
| DRT-31 | Check-Evidence: gleicher Command, ausgehöhlte Semantik; zusätzlich `forge/coordination/x.d.ts`, um den Typecheck zu beeinflussen | Check beweist das Gemeinte | Aushöhlen über Config/Skip: BEKANNT (VX-03/04). `.d.ts` unter Coordination: **NOT_REPRODUCED**, weil `tsconfig.json` nur `src` und `tests` einschließt | CONFIRMED (bekannt) / NOT_REPRODUCED (`.d.ts`) | `tsconfig.json` `"include": ["src","tests"]` | `tsconfig.json` in die immer geschützten Pfade aufnehmen, sonst kippt dieser Schutz mit einer Zeile |
| DRT-32 | Mutation-Evidence: Namens-Zwillinge `m1` und `m1 ` | ein Mutant = ein Name | beide gelten als verschieden und `required` ist erfüllt (X38) | CONFIRMED · NEU, gering (Variante von E-05) | X38 | Mutationsnamen als Slug-Regex; Mutationsliste kommt aus dem Contract (Deep Audit §7.4.4) |

### 3.6 Identität, Rollen, Review, Acceptance

| ID | Attack | Expected | Actual | Status | Evidence | Fix |
|---|---|---|---|---|---|---|
| DRT-33 | Reviewer = Developer mit Label-Zwilling (`"vendor-a-agent "`, Leerzeichen) unter `different_identity` | abgelehnt | Kette bis `accepted` (X05) | CONFIRMED · BEKANNT (RT-05) | X05 | echte Identitäten (GitHub-Login je Agent) |
| DRT-34 | **Owner-Rolle ohne Mensch:** KI oder `system` mit Rolle `owner` bricht fremde Runs ab (`run_abandoned`), setzt sie `failed`, registriert Tasks | Owner-Aktionen nur durch Menschen | alle angenommen (X03a-c). Nur `task_accepted` prüft `actorType` (X03d `OWNER_NOT_HUMAN`) | CONFIRMED · NEU als Inkonsistenz (RT-05 deckt die Selbsterklärung, nicht die uneinheitliche Prüfung) | X03a-d; `state.ts:382-387, 422`; `events.ts:142, 149-150` | `OWNER_NOT_HUMAN` für alle Owner-Events; später an authentifizierte Owner-Identität binden |
| DRT-35 | Blocking Finding im Code Review umgehen: neuer Run mit demselben Commit, anderer oder derselbe Reviewer | Findings überleben | `accepted` | CONFIRMED · BEKANNT (E-01, E-22) | Deep Audit §8.2 | Findings-Ledger (siehe DRT-02) |
| DRT-36 | Acceptance trotz stale Run (Run auf überholter Revision) | abgelehnt | `RUN_NOT_LATEST_VERIFIED`; `latestVerifiedRun` filtert auf die aktuelle Revision. Stale gegenüber `main`: Kern kennt `main` nicht | MITIGATED (Revision) / TRUST_BOUNDARY (Integration, BEKANNT §9) | `state.ts:213-221, 421` | – |
| DRT-37 | Alter Run nach neuerem Run (später Report/Evidence für einen bereits `failed` Run) | abgelehnt | `RUN_STATE_INVALID (failed)` (X18a/b) | MITIGATED | X18 | – |
| DRT-38 | Parallele Runs desselben Tasks | höchstens einer aktiv | `START_NOT_ALLOWED (RUN_ALREADY_ACTIVE)` (X17). Zwei Appender ohne Compare-and-Swap könnten beide Starts gegen denselben Zustand prüfen | MITIGATED (Kern) / TRUST_BOUNDARY (Appender) | X17; `start-gate.ts:67` | Appender schreibt nur mit erwarteter Log-Länge (CAS) |
| DRT-39 | Contract-Version-Race und Approval-Version-Race | genau eine v(n+1); Approval nur auf aktuelle Revision | `CONTRACT_VERSION_NOT_NEXT`, `CONTRACT_SUPERSEDED`, `APPROVAL_ALREADY_DECIDED`; `run_started` rechnet das Gate neu (C-36) | MITIGATED (Kern) / TRUST_BOUNDARY (Appender) | `state.ts:304, 314-315, 333` | wie DRT-38 |
| DRT-40 | Manipulierter DeveloperReport: Developer kommt einer drohenden negativen Verifikation mit `run_failed(DEVELOPER_ABORTED)` zuvor und startet neu | Abbruch nach Push ist sichtbar als solcher | Run `failed`, Neustart erlaubt (X42). Die Spur „wäre durchgefallen“ entsteht nie | CONFIRMED · BEKANNT (E-25) | X42 | Developer-Abbruch nur in `running`; danach nur Owner |
| DRT-42 | RunId-Squatting: Developer von Task A belegt `run:task-0002-1` | Run-IDs je Task | Task B kann diese ID nicht mehr nutzen (`RUN_ALREADY_EXISTS`, X40) | CONFIRMED · NEU, gering | X40 | Run-ID vom Kern ableiten (`<taskId>:<n>`) |
| DRT-43 | `recordedAt` frei wählbar (`"1970-01-01 lol"`, rückdatiert) | Zeitangaben vertrauenswürdig oder fehlen | angenommen (X37). Der Kern nutzt sie nicht, eine Mobile-Ansicht würde sie aber anzeigen | CONFIRMED · NEU, gering | X37; `events.ts:130` | Zeit nur vom Appender setzen; Feld aus Events von Agenten entfernen |

---

## 4. Confirmed Findings

Nur **neue** bestätigte Befunde (bekannte siehe Deep Audit). Reihenfolge nach Gewicht.

### F1 · DRT-12 + DRT-11: Remote-Observation ist zeitlos, ungeordnet und nicht widerrufbar (NEU)
- **Mechanik.** `runState` wertet `run.observations.some(contained)` (`state.ts:202`). Beobachtungen haben weder Zeit noch Sequenz. Sobald eine positive dabei ist, ist der Run `remote_verified`, und danach ist jede weitere Beobachtung `RUN_STATE_INVALID` (RT-09).
- **Angriff/Unfall.** Branch wird gelöscht → Delete-Webhook wird als negative Beobachtung aufgezeichnet → ein verspäteter Push-Webhook mit dem alten Head trifft ein → Run `remote_verified` → Verifikation, Review, Acceptance (X01c `accepted`). Der akzeptierte Commit ist auf keinem Ref mehr.
- **Gegenrichtung (DRT-11).** Ein Push-Webhook vor dem Report wird abgelehnt (X02). Ein rein webhookgetriebener Observer verliert damit genau das Ereignis, das er melden soll.
- **Warum das zählt.** Der nächste Schritt laut Deep Audit ist ein Git-Observer. Mit der heutigen Semantik ist jeder Observer, der Ereignisse statt Zustände meldet, falsch.

### F2 · DRT-02: Architektur-Gate ohne Gedächtnis (NEU)
`changes_requested` mit blocking Finding ist endgültig nur für den Hash. Eine v2, die sich ausschließlich in `contractVersion` unterscheidet, wird von einem anderen Reviewer (X04a) **oder demselben** (X04b) approved. Zusammen mit E-01 (Code Review) heißt das: Kein Gate in Forge erzwingt, dass ein blocking Finding je adressiert wird.

### F3 · DRT-18: `refs/replace` erzeugt gefälschte Ancestry bei ehrlichem Tooling (NEU)
Bisher galt „erfundene Kanten“ (E-04) als Problem eines unehrlichen Observers. G4 zeigt: Ein Developer mit Push-Recht kann `refs/replace/*` ins Remote legen, und ein **ehrlicher** Observer, der einen Mirror-Klon nutzt, liefert danach selbst die gefälschte Kante `EVIL → CONTRACT`. Das trifft `remoteOutcome` und das Start-Gate (`BASE_NOT_IN_CONTRACT_HISTORY`, `DEPENDENCY_NOT_IN_BASE`).

### F4 · DRT-05: Merge-Commit als Contract-Commit (NEU, Variante von C-08)
Die vorgeschlagene C-08-Regel („Contract-Commit ist direktes Kind der Base“) reicht nicht, wenn sie als „Base ist ein Parent“ implementiert wird: Ein Merge-Commit mit Parents `[base, EVIL]` erfüllt sie (X23). Die Regel muss „genau ein Parent“ lauten.

### F5 · DRT-23 + DRT-24 + DRT-25: Pfadidentität ist String-Identität (NEU)
Der Kern schützt `forge/contracts/` und `forge/approvals/` per exaktem, case-sensitivem Präfix. Ein approbierter Scope darf `forge/Contracts/TASK-0001.md`, einen fremden Contract oder `forge/approvals/…` enthalten (X07a); die Verifikation besteht (X07b). Auf Windows/macOS ist das derselbe Ordner. Case-Kollisionen (`src/A.ts` neben `src/a.ts`, `codex.md` neben `CODEX.md`) und Windows-reservierte Namen sind unter der Coordination-Ausnahme ganz ohne Scope möglich. Seb und Codex arbeiten nachweislich auch auf Windows (CRLF-Vorfall, Deep Audit §2).

### F6 · DRT-22: Symlinks unter Coordination (NEU als Kombination)
`forge/coordination/host.md → /etc/hostname` ist für den Kern ein normales `added` ohne Scope (X10, G2). Jeder Agent, der Coordination-Dateien als Kontext liest, liest die Zieldatei seiner eigenen Maschine. Das ist ein Exfiltrationskanal in Richtung Agent-Kontext, kein theoretischer: genau diese Dateien werden heute gelesen.

### F7 · DRT-27: Contract-Hash bindet dekodierten Text, nicht Bytes (NEU)
Drei verschiedene Blobs ergeben denselben `contentHash` (X12). Reviews im Projekt werden an „Commit + Blob-SHA“ gebunden, Approvals im Kern an den `contentHash`. Diese beiden Identitäten fallen auseinander, sobald ein Blob ungültiges UTF-8 enthält.

### F8 · DRT-21: Urteil hängt an den Diff-Optionen des Verifiers (NEU, Variante)
Dieselbe Git-Änderung besteht mit Rename-Erkennung und scheitert ohne (X09, G1). Die Evidence enthält die Optionen nicht. Zwei ehrliche Verifier kommen zu verschiedenen Ergebnissen.

### F9 · DRT-34: Owner-Prüfung uneinheitlich (NEU als Inkonsistenz)
Nur `task_accepted` verlangt `actorType: "human"`. `run_abandoned`, `run_failed` (Owner-Zweig) und `task_registered` nehmen jede Identität mit Rolle `owner` an (X03a-c). Ein Agent kann den Run eines anderen Agenten beenden, ohne auch nur „human“ behaupten zu müssen.

### F10 · Kleinere neue Befunde
DRT-17 (Ref-Mehrdeutigkeit, optionsartige Refs), DRT-19 (Shallow Clone hängt still), DRT-15 (Surrogate in Identitäten bei verlustbehaftetem Export), DRT-28 (NUL/Bidi in Prosa), DRT-32 (Mutationsnamen-Zwillinge), DRT-42 (RunId-Squatting), DRT-43 (`recordedAt` frei), DRT-03/X33 (zwei Versionen am selben Commit), DRT-07 (Patch-Task macht Dependency still stale), DRT-20 (kein Repo in Beobachtung/Evidence, TRUST_BOUNDARY).

---

## 5. Existing Protections

Was der Code nachweislich richtig macht (jeweils am Code geprüft):

1. **Hash-gebundene Approval** (DRT-01): Approval, Start und Run hängen am `contentHash`; jede Textänderung erzeugt eine neue Identität.
2. **Gate wird beim Start neu berechnet** (DRT-39, C-36): `run_started` ruft `startGate(view, …)` auf, ein zwischenzeitlich superseded Contract blockiert.
3. **Versionierung streng** (DRT-39): `CONTRACT_VERSION_NOT_NEXT`, `CONTRACT_SUPERSEDED`, `APPROVAL_ALREADY_DECIDED` verhindern Versions- und Approval-Races innerhalb eines seriellen Logs.
4. **Ein aktiver Run je Task** (DRT-38): `taskState === implementing` blockiert jeden zweiten Start (X17).
5. **Späte Events toter Runs** (DRT-37): `requireRun` mit erlaubten Zuständen lehnt Report, Observation und Evidence für `failed`/`abandoned` ab (X18).
6. **Acceptance nur auf dem neuesten verifizierten Run der aktuellen Revision** (DRT-36), gebunden an `runId`, nicht an einen frei wählbaren Commit.
7. **Dependencies sind fest** (DRT-08): Acceptance ist terminal, `acceptedCommit` muss bei Approval exakt dem akzeptierten Commit entsprechen.
8. **Fail-closed Ancestry** (DRT-41, -44): fehlende Kanten blockieren, Zyklen terminieren.
9. **Strikter Contract-Parser** (DRT-26, -29): kanonisches JSON, kein CR, kein BOM, keine einzelnen Surrogate im Rohtext, Präzisionsverlust bei Zahlen fällt als nicht kanonisch auf.
10. **Eingaben werden kopiert und eingefroren** (DRT-30): Mutation des Roh-Events nach `applyEvent` ändert den Zustand nicht (X14).
11. **Rename-Grenze seit `811ed0d`**: beide Enden zählen; Renames über die Coordination-Grenze sind Verstöße (RT-01 bleibt repariert).
12. **Doppelte Check-Namen** in Evidence und Contract abgelehnt (RT-03 bleibt repariert); **blocking Finding in Architektur-Approval** abgelehnt (RT-06 bleibt repariert, `state.ts:319`).
13. **Typecheck-Programm** schließt `forge/` nicht ein (DRT-31): eine `.d.ts` unter Coordination beeinflusst `tsc` heute nicht.

---

## 6. New Regression Tests Needed

Je neuem Befund ein Test, der heute **rot** sein muss (beschreibt die Soll-Eigenschaft). Nicht implementiert.

| Test | Soll-Eigenschaft | Befund |
|---|---|---|
| RTN-01 | negative Beobachtung mit höherer `seq` nach positiver → Run nicht `remote_verified`; verspätete positive mit niedrigerer `seq` → ignoriert | DRT-12 |
| RTN-02 | positive Beobachtung im Zustand `running` wird angenommen und nach dem Report gewertet | DRT-11 |
| RTN-03 | `task_accepted` verlangt eine Beobachtung, die jünger ist als die Verifikation und den Commit enthält | DRT-12, RT-09 |
| RTN-04 | v(n+1) nach `changes_requested` mit blocking Finding: `approved` ohne Adressierung jeder offenen Finding-ID → abgelehnt | DRT-02 |
| RTN-05 | Start-Gate: Contract-Commit mit zwei Parents → `CONTRACT_COMMIT_NOT_LINEAR` | DRT-05 |
| RTN-06 | Parser: Scope mit `forge/Contracts/…`, `Forge/contracts/…`, `forge/contracts./…`, `forge/approvals/…`, fremdem Contract-Pfad → `METADATA_SCHEMA` | DRT-23 |
| RTN-07 | Verifikation: `changedFiles` mit case-gefalteter Kollision gegenüber Tree oder anderer Datei → `SCOPE_VIOLATION` | DRT-24 |
| RTN-08 | `RepoPath`: `aux.md`, `con`, `x.`, `x ` je Segment abgelehnt | DRT-25 |
| RTN-09 | Evidence mit Mode `120000` oder `160000` unter `forge/coordination/` → `SCOPE_VIOLATION` | DRT-22 |
| RTN-10 | Evidence ohne `diffOptions.renames === false` → `EVENT_SCHEMA`; Rename-Einträge nicht mehr zulässig | DRT-21 |
| RTN-11 | zwei Byte-verschiedene Blobs dürfen nicht denselben `contentHash` ergeben (Port bekommt Bytes oder dekodiert fatal) | DRT-27 |
| RTN-12 | `run_abandoned`, `run_failed` (Owner), `task_registered` mit `actorType != human` → `OWNER_NOT_HUMAN` | DRT-34 |
| RTN-13 | `RefName` ohne `refs/`-Präfix, mit `-`-Segmentanfang oder beidem `main` und `refs/heads/main` in einer Beobachtung → abgelehnt | DRT-17 |
| RTN-14 | Observer-Integrationstest: Remote mit `refs/replace/*` → Observer liefert die **echten** Kanten (`GIT_NO_REPLACE_OBJECTS=1`) | DRT-18 |
| RTN-15 | Observer-Integrationstest: Shallow-Checkout → expliziter Fehler statt `reported` für immer | DRT-19 |
| RTN-16 | `TextSchema`/`label` mit einzelnem Surrogat → abgelehnt; Log-Roundtrip-Test über die echte Persistenzfunktion | DRT-15 |
| RTN-17 | Contract-Text mit U+0000 oder U+202E → abgelehnt | DRT-28 |
| RTN-18 | zwei Revisionen desselben Tasks mit identischem `contractCommit` → abgelehnt | DRT-03 |
| RTN-19 | Mutationsname außerhalb eines Slug-Formats → abgelehnt | DRT-32 |

Zusätzlich sollten die bestehenden „documents“-Tests RT-05, RT-09 und RT-02 um je einen Fall ergänzt werden, der die neue Variante (DRT-34, DRT-12, DRT-22) ausdrücklich als offen dokumentiert, bis sie repariert ist.

---

## 7. Architectural Weaknesses

1. **Kein Zeitmodell für Beobachtungen.** Persistenz ist ein „irgendwann einmal gesehen“-Fakt. Es gibt keine Reihenfolge, keine Frische und keinen Widerruf (F1). Das kollidiert mit jedem realen Observer, ob Webhook oder Polling. Forge braucht eine einzige Observer-Identität mit monotoner Sequenz und Pflicht-Neubeobachtungen an den Gates Review und Acceptance.
2. **Pfad- und Inhaltsidentität sind Zeichenketten.** Git, NTFS, APFS und Linux haben verschiedene Vorstellungen davon, wann zwei Pfade gleich sind (Case, End-Punkte, reservierte Namen), und was eine Datei ist (Mode, Symlink, Submodul). Der Kern kennt nur exakte Strings (F5, F6, F8). Der Contract-Hash kennt nur dekodierten Text, nicht Bytes (F7).
3. **Gates ohne Gedächtnis.** Weder Architektur- noch Code-Review überträgt Findings auf die nächste Revision oder den nächsten Run (F2, E-01). Ein `changes_requested` ist damit eine Empfehlung.
4. **Uneinheitliche Rollenprüfung.** Die einzige harte Rollenregel (`OWNER_NOT_HUMAN`) gilt für ein einziges Event (F9). Selbst innerhalb des Modells „selbst erklärte Identitäten“ ist das inkonsistent.
5. **Git-Fakten werden von Werkzeugen erzeugt, deren Konfiguration Teil der Angriffsfläche ist.** `refs/replace`, Shallow Clones, Rename-Schwellen und Mirror-Klone ändern, was ein ehrlicher Observer oder Verifier meldet (F3, F8, DRT-19). Die Evidence enthält keine dieser Einstellungen.
6. **Kein Repository-Bezug.** Beobachtung, Evidence und Contract nennen kein Repository (DRT-20). Auf GitHub teilen Forks Objekte mit dem Upstream.
7. **Appender undefiniert.** Alle Race-Schutzmechanismen (DRT-38, -39) gelten nur bei serieller Anwendung auf den neuesten Zustand. CAS auf die Log-Länge ist nirgends spezifiziert.

Diese sieben Punkte ergänzen die Schwächen des Deep Audit (selbst gelieferte Fakten, fehlende Diff-Basis, aushöhlbare Checks, Log ohne Integrität), sie ersetzen sie nicht.

---

## 8. Top Findings

### BLOCKING
1. **Remote-Observation ohne Zeit, Reihenfolge, Widerruf und Repo** (F1: DRT-12, DRT-11; mit RT-09, DRT-20). Ein gelöschter oder überschriebener Branch kann zu `accepted` führen (X01c), ein Push vor dem Report geht verloren (X02).
2. **Blocking Findings haben in keinem Gate Bestand** (F2: DRT-02, zusammen mit dem bekannten E-01/E-22). Eine v2, die nur die Versionsnummer ändert, macht ein Architektur-`changes_requested` wirkungslos.
3. **Ancestry-Fakten sind mit ehrlichem Tooling fälschbar** (F3: DRT-18) und der Contract-Startpunkt kann per Merge-Commit ungeprüften Code enthalten (F4: DRT-05, Variante von C-08).

### IMPORTANT
4. Aliase geschützter Pfade und Case-Kollisionen (F5: DRT-23, DRT-24).
5. Symlinks und Dateimodi unter Coordination (F6: DRT-22).
6. Urteil abhängig von Rename-Optionen (F8: DRT-21).
7. Contract-Hash über dekodierten Text (F7: DRT-27).
8. Owner-Events ohne `human`-Prüfung (F9: DRT-34).
9. Shallow-Clone-Observer hängt still (DRT-19).
10. Stale Dependency nach Patch-Task (DRT-07).

### HARDENING
11. `RefName` voll qualifiziert, ohne optionsartige Segmente (DRT-17).
12. Windows-reservierte Namen und End-Punkte (DRT-25).
13. Steuer- und Bidi-Zeichen in Contract-Prosa (DRT-28).
14. Einzelne Surrogate in `TextSchema`/Labels, festes JSONL-Format (DRT-15).
15. Mutationsnamen als Slugs (DRT-32), Run-IDs vom Kern (DRT-42), `recordedAt` nur vom Appender (DRT-43), eindeutiger `contractCommit` je Revision (DRT-03).

---

## 9. Welche Findings vor dem ersten echten Forge-managed Task behoben werden müssen

Annahme: Der erste echte Task läuft nach dem V0.1-Vorschlag des Deep Audit (GitHub als Gatekeeper, Observer und Verifier als Workflows, JSONL-Log).

**Neu aus diesem Red Team, vorher zu beheben:**
1. **Observation-Modell** (BLOCKING 1). Mindestens: eine Observer-Identität, Beobachtung mit `repo`, `seq` und `observedAt`; gewertet wird die jüngste Beobachtung pro Ref; Beobachtungen auch in `running` annehmen; Pflicht-Neubeobachtung direkt vor `code_review_recorded` und `task_accepted`. Ohne das ist der erste Observer, der gebaut wird, an der falschen Semantik ausgerichtet.
2. **Findings-Ledger für beide Gates** (BLOCKING 2). Mindestens: Approval einer Folgeversion bzw. Approve eines Folge-Runs muss offene blocking Findings adressieren; ein `request_changes(code_change)` erlaubt keinen Folge-Run mit identischem Commit.
3. **Observer- und Verifier-Härtung als Betriebsregel** (BLOCKING 3): `GIT_NO_REPLACE_OBJECTS=1`, kein Mirror-Klon, `fetch-depth: 0`, Diff immer `--no-renames --raw` mit Modi; Push von `refs/replace/*` per Repository-Regel verbieten. Contract-Commit genau ein Parent = `baseCommit`.
4. **Pfadregeln im Parser und in der Verifikation** (IMPORTANT 4, 5): geschützte Präfixe case-gefaltet, keine Symlinks/Submodule, keine Case-Kollisionen. Begründung für „vorher“: Seb und Codex arbeiten auch auf Windows, und die Coordination-Ausnahme macht DRT-22/-24/-25 ohne jeden Scope ausnutzbar.
5. **`OWNER_NOT_HUMAN` für alle Owner-Events** (IMPORTANT 8). Eine Zeile, beseitigt eine Inkonsistenz, bevor echte Runs existieren, die ein Agent abbrechen könnte.

**Bereits bekannt und weiterhin BLOCKING (Deep Audit, hier nur bestätigt, nicht neu gezählt):** authentifizierte Identitäten statt selbst erklärter (RT-05/E-02/E-14), Diff-Basis in der Evidence (NRT-01/E-09), aushöhlbare Checks und ungeschützte Build-/Testkonfiguration (NRT-12/13, C-28), ungeprüfter Code zwischen Base und Contract-Commit (NRT-02/C-08, ergänzt um DRT-05), Start-Beobachtung vom Developer (NRT-30).

**Kann nach dem ersten Task kommen:** DRT-21 (sobald `--no-renames` Betriebsregel ist, entschärft), DRT-27, DRT-07, DRT-19 als Fehlercode, alle HARDENING-Punkte.

---

### Anhang: Experimente

Alle gegen unveränderten Code `b9339d2` im Wegwerf-Klon, Node 22, Vitest 5.0.3.

| ID | Aufbau | Ergebnis |
|---|---|---|
| X01 | Report → `remote_observed(head:null)` → `remote_observed(head:RESULT)` | `remote_verified` |
| X01b | danach `remote_observed(head:null)` | `RUN_STATE_INVALID (remote_verified)` |
| X01c | X01 + verify + approve + accept | `accepted` |
| X02 | `remote_observed` direkt nach `run_started` | `RUN_STATE_INVALID (running)` |
| X03a-c | KI bzw. `system` mit Rolle `owner`: `run_abandoned`, `run_failed`, `task_registered` | `abandoned`, `failed`, `ok` |
| X03d | KI mit Rolle `owner`: `task_accepted` | `OWNER_NOT_HUMAN` |
| X04a/b | v1 `changes_requested` (blocking) → v2 nur `contractVersion: 2` → Approval durch `vendor-c` / denselben Reviewer | beide `ready` |
| X05 | `different_identity`, Reviewer = Developer-Label + Leerzeichen | `ok` bis `accepted` |
| X06a/b | Refs `main` + `refs/heads/main` + `-x` + `--upload-pack`; `claimedRemoteRef: "--upload-pack"` | beide `ok` |
| X07a/b | Scope mit Alias-Pfaden des eigenen Contracts, `forge/approvals/…`, fremdem Contract; Evidence `added` auf Alias-Pfade | Contract gültig; `passed: true` |
| X08 | Scope `src/Foo.ts`, Evidence `added` | `passed: true` |
| X09 | Coordination-Move mit/ohne Rename-Erkennung; Rename innerhalb Scope | `true` / `false`; Scope-Rename `SCOPE_VIOLATION` × 2 |
| X10 | `forge/coordination/context.md` `added` | `passed: true` |
| X12 | Contract + `0xFF` / `0xFE` / `EF BF BD`, via `Buffer.toString("utf8")` | identischer Hash `13716a6ddcca…` |
| X13 | Labels `dev\ud800` vs `dev\ud801`: live / JSON-Roundtrip / verlustbehaftet | `ok` / `ok` / `REVIEWER_NOT_INDEPENDENT` Index 7 |
| X14 | Roh-Event nach Replay mutiert | Zustand unverändert |
| X15 | `contractVersion: 9007199254740993` | `FRONTMATTER_NOT_CANONICAL` |
| X17 | zwei `run_started` | `RUN_ALREADY_ACTIVE` |
| X18a/b | Report / Evidence für `failed` Run nach neuem Run | `RUN_STATE_INVALID (failed)` |
| X19 | `verification_recorded` doppelt | `RUN_STATE_INVALID (verified)` |
| X23 | Contract-Commit mit Parents `[base, EVIL]` | Start erlaubt |
| X33 | v1 und v2 mit identischem `contractCommit` | `ok` |
| X35 | Contract-Prosa mit U+0000 und U+202E | gültig |
| X37 | `recordedAt: "1970-01-01 lol"` | `ok` |
| X38 | `required`, Mutanten `m1` und `m1 ` (detected) | `passed: true` |
| X39 | Graph-Zyklus `head ↔ contract` | terminiert, `BASE_COMMIT_NOT_PERSISTED` |
| X40 | Task A belegt `run:task-0002-1` | Task B: `RUN_ALREADY_EXISTS` |
| X42 | `DEVELOPER_ABORTED` auf `remote_verified`, Neustart | `failed`, Neustart `ok` |
| X43 | Dependency nicht in Base; ehrlicher vs. erfundener Graph | `DEPENDENCY_NOT_IN_BASE` vs. `ok` |
| G1 | Move `CODEX.md → archive/CODEX.md`, `git diff --name-status` mit/ohne `--no-renames` | `R100` vs. `D` + `A` |
| G2 | Symlinks `forge/coordination/context.md → ../../src/a.ts`, `host.md → /etc/hostname` | `A`, Mode `120000` nur in `--raw`; `cat` liest Host-Datei |
| G3 | `src/a.ts` und `src/A.ts` im selben Tree | beide gespeichert |
| G4 | `git replace --graft EVIL CONTRACT`, Push `refs/replace/*` in Bare-Remote | Mirror-Klon: Ancestry YES; normaler Klon: NO; `GIT_NO_REPLACE_OBJECTS=1`: NO |
| G5 | `git clone --depth 1` | kein Parent, Ancestry nicht beweisbar |
| G6 | `git check-ref-format refs/heads/{-x,--upload-pack,main,a.lock}` | gültig, gültig, gültig, ungültig |
