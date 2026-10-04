# FORGE V0.1 — ARCHITECTURE FREEZE / PRE-IMPLEMENTATION COUNCIL

| Feld | Wert |
|---|---|
| Rolle | Principal Architect, abschließender Architekturrat vor der Implementierung von Forge V0.1 |
| Modus | **rein lesend**: keine Datei im Repository geändert, kein Commit, kein PR, keine GitHub-Einstellung berührt, nichts implementiert |
| Datum | 2026-10-03 (Lesestand der Berichte 13:36 UTC, des Repositories 13:25 UTC) |
| Kanonisches Repository | `Forge-Dice/Forge` (GitHub-Organisation `Forge-Dice`, Repo-ID `1401864629`, öffentlich, Free-Plan) |
| Maßgeblicher Stand | `main` = `3d7545d843883418348004e68717399a64da7a7d` (Merge Commit von PR #1, Eltern `f5dbc73…` und `0dfd903…`; selbst per `git ls-remote` um 13:25 UTC bestätigt) |
| Status dieses Dokuments | **Leitende Architekturreferenz für Forge V0.1.** Wo ein früherer Bericht abweicht, gilt dieses Dokument. Wo dieses Dokument schweigt, gilt der jeweils jüngste Bericht, dann der Code auf `main`. |
| Ergebnisform | Entscheidungen, keine Implementierung. Fünf Owner-Entscheidungen in §19; alles andere ist hier entschieden und begründet. |

## Vorrangregeln (vom Owner vorgegeben, hier angewandt)

1. Spätere empirische Befunde schlagen frühere Annahmen.
2. Tatsächlicher Code auf `main` schlägt jedes Design-Dokument.
3. Aktuelle Organization-Topologie (`Forge-Dice`, Teams, Org-Audit-Log, Write-Rolle) schlägt alle Annahmen aus der Personal-Repo-Zeit (`Wuerfelduell/Forge`).

Zusätzlich angewandt: Eine Entscheidung des Owners (Merge Commit, Identitäten, Identity-Spike PASS, Trust Boundary „Claude schreibt nicht“) wird nicht neu verhandelt, sondern konsistent zu Ende gedacht.

## Beleg-Labels

| Label | Bedeutung |
|---|---|
| `CODE` | aus `src/forge/**` oder anderen Dateien auf `main` `3d7545d` gelesen |
| `GIT` | aus Git-Objekten/Refs des kanonischen Repos (Klon + `ls-remote`) |
| `API` | aus der GitHub-API (PR-Metadaten, Nutzer-IDs) |
| `DOC:<Kürzel>` | aus einem der unten gelisteten Berichte |
| `OWNER` | vom Owner mitgeteilt (Identity-Spike PASS, Rollen, Repo-Transfer); hier nicht nachprüfbar |
| `INFERRED` | Schlussfolgerung dieses Berichts |
| `DECISION` | Festlegung dieses Berichts |

## Gelesene Artefakte und ihr Stand

| Kürzel | Datei (`/mnt/project-files/forge-audits/`) | Datum | Stand der Lektüre |
|---|---|---|---|
| CHA | `FORGE-CONTRACT-HANDOFF-AUDIT.md` | 07:10 | vollständig (per Extraktion) |
| DA | `FORGE-DEEP-AUDIT.md` (1081 Zeilen, 233 ID-tragende Befunde) | 07:27 | vollständig (per Extraktion), Severity-Schema KRITISCH/HOCH/MITTEL/NIEDRIG |
| RT | `FORGE-DEEP-RED-TEAM.md` + `deep-red-team-experiments/x.test.ts` | 07:41 | vollständig (per Extraktion), Schema BLOCKING/IMPORTANT/HARDENING |
| RR | `FORGE-RUN-RECOVERY.md` (F-01…F-24, PT-01…PT-13, SD-01…SD-11, NH-Katalog) | 07:37 | vollständig (per Extraktion) |
| MP | `FORGE-V0.1-MINIMUM-PRODUCT.md` (N1–N10, M01–M18, K1–K10, A1–A8, Exit-Kriterien 1–10) | 07:36 | vollständig |
| HP | `FORGE-V0.1-HARDENING-PLAN.md` (D-1…D-15, K-01…K-05, P-01…P-06, O-01/O-02, S-01…S-15, D-01…D-13) | 08:15 | vollständig |
| IGP | `FORGE-IDENTITY-GITHUB-PROTECTION.md` (Optionen A–G, RS-MAIN/ALL/RUN/SPEC, Adapter, 5 Owner-Fragen) | 08:24 | vollständig |
| VD | `FORGE-INDEPENDENT-VERIFIER-DESIGN.md` (T01–T24, C1–C10, AC-01…42, S1–S13) | 08:26 | vollständig |
| OMD | `FORGE-ORGANIZATION-MIGRATION-DELTA.md` (F1–F10, B1–B7) | 10:18 | vollständig |
| ROAD | `MYSTERY-VERTICAL-SLICE-ROADMAP.md` (VS-1…VS-6) | 10:34 | vollständig (per Extraktion) |
| DRILL | `FORGE-FIRST-MANAGED-RUN-DRILL.md` (A-1…A-8, FI-01…25, N-1…N-8) | 10:36 | vollständig |
| CSV2 | `FORGE-CONTRACT-SYSTEM-V2.md` (Format 2, ACV-01…40, OD-A…OD-L) | 10:40 | vollständig |
| PKG | `FORGE-V0.1-VERIFIER-IMPLEMENTATION-PACKAGE.md` (48 Angriffe, VERIFIER-0001…0003, OD-1…OD-12) | 11:05 | vollständig |
| V1-DRAFT | `FORGE-VERIFIER-0001.contract.DRAFT.md` (Format 1, contentHash `341ec983…`, 32 686 Bytes) | 10:51 | vollständig (eingebettet in PKG §13) |
| AVD | `MYSTERY-ACCUSATION-VERDICT-DESIGN.md` (D1–D10) | 07:41 | vollständig (per Extraktion) |
| VS2 | `MYSTERY-VS2-IMPLEMENTATION-DESIGN.md` | 11:05 | per Extraktion, nur für §15/§16 relevant |
| T6 | `MYSTERY-TASK-0006-CANDIDATES.md` | 07:33 | per Extraktion, nur für §15 relevant |
| SOLV | `MYSTERY-SOLVABILITY-V1-RESEARCH.md` (S1–S8, §15 Required Inputs, §17 Contract-Skizze) | 13:32 | Kurzfassung, §5, §15, §17 gelesen; für die Forge-Architektur nur über die Contract-Form relevant (§15.5) |
| PAC | `FORGE-PIPELINE-ADVERSARIAL-CHALLENGE.md` (PA-01…PA-118, 15 neue Befunde, Top-10, 12 Required-Before-Drill-Punkte) | 13:36 | vollständig |
| ARCH | „Forge Architecture V0.1“ | **nicht auffindbar**: weder im Repo (alle Refs durchsucht) noch unter `/mnt/project-files`; das Projekt wurde nicht aus einem älteren Projekt übernommen (Chat-Historie leer) | Die Rolle „Architekturreferenz“ war bisher auf MP, HP und DA verteilt; dieses Dokument übernimmt sie |

Direkt am Code und am Repository geprüft: alle 13 Module unter `src/forge/`, `package.json`, alle Contracts, Approvals und Reviews unter `forge/`, `forge/BASELINE-STATUS.md`, `forge/coordination/*.md`, alle sechs Remote-Branches, PR #1 (merged 08:15:41Z) und PR #2 (Draft, `forge/run/codex/IDENTITY-SPIKE-1` @ `8dc692b`, leerer Commit, Autor/Committer `forge-codex` mit einer privaten E-Mail-Adresse (hier bewusst nicht wiedergegeben), Login `forge-codex`, User-ID 337272506) [CODE][GIT][API]. Collaborators, Rulesets und Actions-Einstellungen sind per API nicht lesbar (403) [API]; alle Aussagen dazu sind `OWNER` oder `DOC`.

---

## 0. Zusammenfassung: die Zielarchitektur in zwölf Sätzen

1. Forge V0.1 ist ein **Torwächter über GitHub**: `main` von `Forge-Dice/Forge` ist die einzige Wahrheit; es gibt keinen Forge-Eventlog, keinen Reconciler, keine Lease, keinen Server, keine PWA.
2. Jeder Task besteht aus genau zwei Arten von Pull Requests: einem **Contract-PR** (`forge/contract/<TASK>-v<N>` → `main`, registriert per Merge Commit `M` mit `M^2 = C`, dem einzigen, isolierten Contract-Commit) und einem oder mehreren **Run-PRs** (`forge/run/codex/<TASK>-<n>` → `main`, abgenommen per Merge Commit `A` mit `A^2 = H`, dem verifizierten Head, `tree(A) == tree(H)`).
3. Alle Merges nach `main` sind **Merge Commits**; Squash und Rebase sind in den Repo-Einstellungen abgeschaltet; „Require linear history“ ist aus.
4. Es gibt genau **zwei Required Checks**, `forge-gate` und `forge-verify`, beide aus dem einen Workflow `.github/workflows/forge-verify.yml` auf `main` (einziger Trigger `pull_request_target`; kein `pull_request_review`, W-32), Quelle „GitHub Actions“, „up to date“ strikt.
5. Der Verifier (GitHub Actions, `github-actions[bot]`) ist die einzige Instanz, die Prüflingscode ausführt: im Container ohne Umgebung und Netz, mit Werkzeugen aus `main`; der Entwickler-Report ist Beschreibung, niemals Fakt.
6. Identitäten sind GitHub-Logins: `Wuerfelduell` = einziger Mensch (Owner, Admin, kein Bypass), `forge-codex` = einziger schreibender Agent (Write über Team `forge-dev-codex`), Claude/ChatGPT/Grok = lesende Reviewer über den SHA-gebundenen Adapter, deren Urteil der Owner attestiert.
7. Contracts sind Dateien `forge/contracts/<TASK>.md` im **Format 2** (`specifiedAgainst`, `reads`, `mutants`, `limits`, `findings`, `supersedes`, End-Marker); Format 1 bleibt nur für die drei Bootstrap-Contracts der Verifier-Kette zulässig.
8. Ein Run startet immer vom aktuellen `main` (`runBase ⊒ M`), nicht vom Contract-Commit; `SPEC_STALE` (Änderungen an `reads ∪ scope` zwischen `specifiedAgainst` und `runBase`) erzwingt eine Contract-Revision, keinen Waiver.
9. Freigaben sind GitHub-Reviews von `Wuerfelduell` mit `FORGE REVIEW v1`-Block des externen Reviewers und `FORGE ATTEST v1`-Zeile; Dateien unter `forge/approvals/` sind Geschichte.
10. V0.1 fährt **eine Spur**: höchstens ein offener Run-PR im ganzen Repository; parallele Contract-PRs sind erlaubt.
11. Legacy (TASK-0001…0005, Sidecar `FORGE-CORE-0001B.v2.md`, Approvals, Koordinationsdateien, alte Branches, PR #2) wird eingefroren, nie umgeschrieben; TASK-0005 wird erst bei VS-3 als v3 mit `supersedes.format: "legacy"` migriert.
12. Forge V0.1 ist fertig, wenn `FORGE-DRILL-0001` mit allen Injektionen und der produktive Task VS-1 „Accusation & Verdict“ durch genau diese Pipeline gelaufen und per Merge Commit auf `main` sind (§18).

### Die fünf Owner-Entscheidungen (Details §19)

| # | Frage | Empfehlung |
|---|---|---|
| OE-1 | Reviewer-Besetzung für Bootstrap-Contracts/-Runs und Drill (Architektur / Code) | Owner- oder Claude-entworfene Contracts: ChatGPT (Architektur), Claude ohne Projektdateien (Code); Codex-entworfene Contracts: Claude oder Grok (Architektur), der jeweils andere (Code); Grok optional als zweite Stimme |
| OE-2 | Task-ID des produktiven Tasks VS-1 (`TASK-0006` oder neues Schema `MYST-0001`) und Übernahme der Design-Entscheidungen D1–D10 aus AVD als Arbeitsannahmen | `TASK-0006`, D1–D10 wie empfohlen |
| OE-3 | Repository öffentlich belassen (Free-Plan, Rulesets, Grok liest frei) oder Wechsel auf GitHub Team (private Repos mit Rulesets, Org-Rulesets, Required Workflows) | öffentlich belassen |
| OE-4 | Claude in V0.1 ausschließlich lesend (Stufe A) oder zweite Developer-Identität `forge-claude` (Stufe B, kostenpflichtig) | Stufe A |
| OE-5 | Identity-Spike-Beleg (Audit-Log: Pusher von `8dc692b` = `forge-codex`, noreply-E-Mail) und S1-Nachweis (Negativ-/Positivtest) | beides vor dem ersten Run-PR schriftlich in `forge/ops/` ablegen |

Alles Übrige, einschließlich Contract-Format-Zeitpunkt, Check-Namen, Namensräume, Merge-Regeln, Mutanten-Semantik, Findings-Carry-Forward, Halt-Mechanismus, Parallelität, Migration und Reihenfolge, ist in diesem Dokument entschieden.

---
## 1. Resolve Contradictions

Jeder Punkt: **KONFLIKT** (wer sagt was), **OPTIONEN**, **ENTSCHEIDUNG**, **BEGRÜNDUNG**, **KONSEQUENZ** (was sich in Code, Workflow, Ruleset oder Dokument ändert). Die Nummern W-01…W-32 werden im weiteren Dokument zitiert.

### W-01 Merge Commit vs. lineare Historie

- **KONFLIKT:** HP D-2 („`main` ist linear, nur Squash-Merges“) und VD C8/AC-22 setzen Squash und „Require linear history“ voraus; IGP §6, OMD §5/B3, PKG §4.10, CSV2 §4 und die Owner-Entscheidung verlangen Merge Commits; PR #1 wurde tatsächlich per Merge Commit integriert (`3d7545d`, zwei Eltern, `tree(3d7545d) == tree(0dfd903)`) [GIT].
- **OPTIONEN:** (a) Squash + lineare Historie; (b) Merge Commit, lineare Historie aus; (c) Rebase-Merge.
- **ENTSCHEIDUNG:** **(b).** Alle Merges nach `main` sind Merge Commits (`--no-ff`). Repo-Einstellung: nur „Merge commit“ erlaubt; Squash und Rebase abgeschaltet; Ruleset-Regel „Require linear history“ **aus**.
- **BEGRÜNDUNG:** Spätere Entscheidung des Owners und spätere Berichte (OMD, PKG, CSV2) schlagen HP/VD. Sachlich: Der reviewte und verifizierte SHA `H` bleibt in der Historie erreichbar (`A^2 = H`), der Start-Gate-Begriff „Vorfahr“ bleibt anwendbar, und mit strikter „up to date“-Regel gilt `tree(A) == tree(H)`, weil `main`-Spitze zum Merge-Zeitpunkt Vorfahr von `H` ist. Squash würde den geprüften SHA aus `main` entfernen (IGP §6); Rebase erzeugt neue SHAs ohne Review.
- **KONSEQUENZ:** HP D-2, HP §8.1 „nur Squash“, VD C8, VD AC-22 und VD S10 sind ersetzt. Invarianten (bindend): Registrierungs-Merge `M`: `M^1` = vorheriges `main`, `M^2 = C`, `git diff --raw --no-renames M^1 M` berührt genau `forge/contracts/<TASK>.md`, jeder Commit in `M^1..M^2` hat genau einen Elternteil und berührt nur diese Datei. Abnahme-Merge `A`: `A^1` = vorheriges `main`, `A^2 = H` (verifizierter Head), `tree(A) == tree(H)`. Das Gate prüft beides nach (`REGISTRATION_TREE_MISMATCH`, `CONTRACT_MERGE_NOT_ISOLATED`, `CONTRACT_COMMIT_NOT_LINEAR`), damit DRT-05/F4 („Merge Commit schmuggelt Code als Contract“) geschlossen bleibt.

### W-02 Contract Commit `C` vs. Registrierungs-Merge `M`

- **KONFLIKT:** Der Kern bindet Approval und Start an den Commit, an dem die Contract-Datei liegt (`contractCommit`, `startFromCommit = contractCommit`) [CODE `start-gate.ts`]. VD §4.5 definiert `C` als „jüngsten first-parent-Commit auf `main`, der den Pfad ändert“ — unter Merge Commits wäre das `M` mit zwei Eltern, und VD würde es als `CONTRACT_COMMIT_NOT_LINEAR` ablehnen (DRILL N-5). CSV2 §4 und PKG §4.10 setzen `C = M^2`. DRILL A-3 setzt im Handoff `contract_commit = R = M`.
- **OPTIONEN:** (a) `C = M` (der Merge selbst); (b) `C = M^2`, `M` nur Registrierungsnachweis; (c) beides führen.
- **ENTSCHEIDUNG:** **(c) mit klarer Rollenverteilung.** `C := M^2` ist der **Contract-Commit** (ein Elternteil, nur die Contract-Datei): an ihn binden Approval (`FORGE REVIEW v1` auf `C`), `contentHash`, `blobSha` und die Quittung des Developers. `M` ist der **Registrierungs-Merge**: Er bestimmt die Versionsnummer (Anzahl der Registrierungs-Merges dieses Pfads auf der First-Parent-Kette von `main`), den Registrierungszeitpunkt und die Untergrenze für `runBase` (`M ⊑ runBase`). Der Handoff nennt beide: `contract_commit: C`, `registration_merge: M`.
- **BEGRÜNDUNG:** Nur `C` ist „ein Commit mit genau dieser Datei“ (Hash-Bindung ohne Rauschen); nur `M` liegt auf `main` (Reihenfolge, Versionen, „registriert“ ist eine Eigenschaft von `main`). Beide Fakten sind aus Git ableitbar, keiner wird vom Developer geliefert.
- **KONSEQUENZ:** VD §4.5 lautet neu: „`M` = jüngster first-parent-Commit auf `main`, der den Pfad ändert; `C = M^2`; `C` hat genau einen Elternteil `C^1 = M^1`.“ Daraus folgt eine Zusatzregel für Contract-PRs: **genau ein Commit** im PR (`M^2^1 == M^1`); der Autor fasst vor Review zusammen (Force-Push auf dem eigenen Contract-Branch ist erlaubt, §9). DRILL A-3 wird korrigiert (`contract_commit = C`, zusätzlich `registration_merge = M`). Kern: `canStartDeveloperRun` bleibt auf `contractAtCommit = {C, path, hash}` [CODE]; der Startpunkt wird durch W-03 ersetzt.

### W-03 `specifiedAgainst` vs. `runBase` vs. `baseCommit`

- **KONFLIKT:** Kern Format 1: `baseCommit` ist Teil des gehashten Frontmatters, der Run startet vom Contract-Commit, `baseCommit ⊑ contractCommit`, Dependencies `⊑ baseCommit` [CODE]. HP D-12 behält das für V0.1 („Trennung erst, wenn Reconcile-Fälle real auftreten“, = S-04). CSV2 §7 trennt `specifiedAgainst` (gelesener Stand, gehasht) und `runBase` (Startpunkt, Run-Fakt) mit `SPEC_STALE`. PKG benutzt den Format-1-Feldnamen `baseCommit` mit V2-Bedeutung. DA C-08/C-10 (HOCH, E-12): zwischen `baseCommit` und `contractCommit` kann ungeprüfter Code liegen. RR L-10: „jede neue Base erzwingt neue Contract-Version“ ist zu teuer.
- **OPTIONEN:** (a) Format-1-Semantik: Start vom Contract-Commit; (b) CSV2: `specifiedAgainst` + `runBase`; (c) Hybrid: `baseCommit` behalten, aber als `specifiedAgainst` lesen.
- **ENTSCHEIDUNG:** **(b) sofort als Gate-Semantik, (c) als Übergangsregel für Format-1-Contracts.** Für jeden Run gilt: `runBase := merge-base(H, main)` muss auf der First-Parent-Kette von `main` liegen, `M ⊑ runBase` (Contract registriert, bevor der Run startete) und `specifiedAgainst ⊑ runBase`. Der Developer startet **immer vom aktuellen `main`**, nie von `C`. `SPEC_STALE` := `changedFiles(specifiedAgainst, runBase) ∩ (reads ∪ scope.create ∪ scope.modify) ≠ ∅` → Run-PR rot, Auflösung nur durch Contract-Revision (kein Waiver, CSV2 OD-B). In Format-1-Contracts (nur Bootstrap, W-14) wird `baseCommit` vom Gate als `specifiedAgainst` gelesen und `reads` als leer angenommen.
- **BEGRÜNDUNG:** Unter Merge Commits ist „Start vom Contract-Commit“ ohnehin falsch: `C` liegt nicht auf `main` (es ist `M^2`), ein Branch von `C` hätte `main`-Spitze nicht als Vorfahr und würde „up to date“ nie erfüllen, ohne `main` zu mergen. DA C-08 ist damit strukturell geschlossen: Zwischen `specifiedAgainst` und `runBase` liegt nur `main`-Historie (alles per Merge akzeptiert), und `SPEC_STALE` macht relevante Bewegungen sichtbar. HP D-12 wird aufgehoben, weil der Preis (S-04 später nachrüsten, Drill auf falscher Semantik) höher ist als die Gate-Regel (zwei `git`-Aufrufe).
- **KONSEQUENZ:** Kern-Änderung in FORGE-CORE-0002 (W-14): Feld `specifiedAgainst` (Format 2), Start-Gate nimmt `runBase` als Parameter (`CONTRACT_NOT_IN_RUN_BASE`, `RUN_BASE_NOT_PERSISTED`). Gate (VERIFIER-0002): `BASE_NOT_ON_MAIN`, `CONTRACT_NOT_IN_RUN_BASE`, `SPEC_STALE`. Handoff nennt **keinen** Startpunkt-SHA mehr, sondern „aktuelles `main`“. DRILL §9 Walkthrough und HP P-04 Rollenvorlage (`git checkout --detach <contract_commit>`) werden entsprechend geändert: `git switch -c forge/run/codex/<TASK>-<n> origin/main`.

### W-04 Eventlog vs. GitHub als Wahrheit

- **KONFLIKT:** Kern und `forge/BASELINE-STATUS.md`: „Eventlog authoritative“ [CODE]. DA §5.4 und RR §3/§4: persistierter JSONL-Log mit `seq`/`eventId`/`prevHash`, Reconciler `reconcile(Log, Git, jetzt)`, zwei Wahrheiten. MP A1, HP D-1, PKG: GitHub ist die einzige Wahrheit, kein Log in V0.1.
- **OPTIONEN:** (a) Log als Wahrheit, GitHub als Beobachtung; (b) GitHub als Wahrheit, kein Log; (c) GitHub als Wahrheit, Log als abgeleitete Projektion.
- **ENTSCHEIDUNG:** **(b) für V0.1, (c) als V0.2-Option.** In V0.1 wird kein Forge-Event geschrieben und keiner gelesen. Jeder Zustand (registriert, freigegeben, laufend, verifiziert, abgenommen) wird zur Prüfzeit aus Git-Objekten und PR-/Review-Daten abgeleitet. Der Kern wird als **Bibliothek** benutzt (Parser, Hash, Scope-Urteil, Format-2-Validierung) und, wo das Gate es braucht, per kurzem synthetischem `replay` (HP P-05-Projektion), ohne Persistenz.
- **BEGRÜNDUNG:** Jeder Fakt, den Forge V0.1 braucht, liegt in GitHub (RR §2.3 Erkenntnis 2: „kein Fall erfordert, dem Agenten zu glauben“). Ein zweiter Wahrheitsort erzeugt genau die Klassen von Problemen, die DA L-01…L-12 und RR F-12…F-14 beschreiben, ohne dass ein Vorfall sie rechtfertigt (HP D-01). Sebs Vorgabe „kein komplexes Recovery-System“.
- **KONSEQUENZ:** DA §5.4, RR §3–§4 (Reconciler, Idempotenzschlüssel, Eventumschlag) sind DEFERRED (§2). `forge/BASELINE-STATUS.md` wird im ersten Owner-Hygiene-PR um den Satz ergänzt: „Seit V0.1 ist `main` die einzige Wahrheit; der Kern-Eventlog ist eine In-Memory-Bibliothek“ (einzige Textänderung an Legacy-Dateien, §13). Alle Kern-Zustände `remote_observed`, `verification_recorded` usw. werden in V0.1 nicht persistiert; K-05-Regeln (Owner-Human, Rollen) wirken in V0.1 nur über Gate und Policy.

### W-05 Lease vs. keine Lease

- **KONFLIKT:** RR §7 definiert eine Lease in der Phase `STARTED` mit Ablauf nur nach erfolgreicher Beobachtung; DA SM-13 „Worker tot, Task für immer `implementing`“; MP/HP D-9/D-15: keine Lease, Run = offener PR, Owner schließt. HP S-10 (Lease per Schedule-Workflow) ist SHOULD mit Auslöser „erster verwaister Run-PR > 1 Tag“.
- **OPTIONEN:** (a) Lease im Workflow; (b) keine Lease, Owner schließt verwaiste PRs; (c) Lease nur als Anzeige.
- **ENTSCHEIDUNG:** **(b).** „Aktiver Run“ := offener PR von `forge/run/codex/<TASK>-<n>` gegen `main`. Es gibt keine Zeit in Forge V0.1. Ein verwaister Run endet, indem der Owner den PR schließt (`run abandoned`), der nächste Run bekommt `n+1`.
- **BEGRÜNDUNG:** Ein Developer, ein Repo, eine Spur (W-20): Ein toter Run blockiert sichtbar den einzigen Slot, der Owner sieht es im PR-Listing. Jede Automatik bräuchte Zeit, Schedule-Workflow und Beobachtungsmodell (HP S-02/S-10), also genau die Infrastruktur, die DEFERRED ist.
- **KONSEQUENZ:** RR F-01…F-03, F-20, SD-10 werden in §11 durch „Owner schließt PR“ ersetzt; Gate-Regel: ein geschlossener (nicht gemergter) Run-PR gilt als beendet, seine Branch bleibt (RS-ALL verbietet Löschen), seine Commits dürfen im nächsten Run per Cherry-Pick wiederverwendet werden (Salvage ist Developer-Entscheidung, keine Forge-Funktion).

### W-06 Status-Felder im Contract

- **KONFLIKT:** `forge/contracts/TASK-0004.md` trägt `status: approved` und `architecture_review: pending_chatgpt_final_check` im YAML-Frontmatter [CODE]; DA C-22/TD-04, RR SD-05 („Lint: kein `status`-Feld“), CSV2 §3 („Status wird abgeleitet“); Kern-Schema ist `strictObject` und lehnt Zusatzfelder ab [CODE].
- **OPTIONEN:** (a) Status im Contract pflegen; (b) Status nur abgeleitet.
- **ENTSCHEIDUNG:** **(b).** Ein Contract enthält keinen Status, kein Review-Ergebnis, keinen Zeitstempel, keine Chat-Referenz. Status = Ableitung aus GitHub: registriert ⇔ `M` auf `main`; freigegeben ⇔ APPROVED-Review mit gültigem `FORGE REVIEW v1`-Block auf `C`; laufend ⇔ offener Run-PR; verifiziert ⇔ `forge-verify` grün auf Head; abgenommen ⇔ `A` auf `main`.
- **BEGRÜNDUNG:** Der Kern erzwingt es bereits (`METADATA_SCHEMA` bei Fremdfeldern), der Pilot hat gezeigt, was Status-Prosa anrichtet (P-C: TASK-0004 wurde 14 min 53 s nach dem Contract-Commit implementiert, Review „ausstehend“).
- **KONSEQUENZ:** Contract-Check-Code `STATUS_ASSERTION` (CSV2 Anhang B) im Gate: Frontmatter-Fremdfelder sind Schema-Fehler, Prosa-Muster wie „Status:“, „approved“, „freigegeben am“ in Überschriften sind Lint-Fehler. TASK-0004.md bleibt unverändert als Legacy (W-15).

### W-07 Findings Carry-Forward

- **KONFLIKT:** DA #6 (HOCH, E-01/E-22): Findings überleben keinen neuen Run. HP D-5: zugewiesener Reviewer statt Ledger (Ledger = S-03). CSV2 §6: `findings[]` im Contract der Folgeversion mit IDs `F-<TASK>-<PR#>-<k>`, Rücknahme nur durch den Reviewer (OD-F). RT BLOCKING 2: blocking Findings sind in keinem Gate.
- **OPTIONEN:** (a) nur zugewiesener Reviewer; (b) Findings nur im Contract (jedes Rework = Revision); (c) Findings nach Art getrennt: Code-Findings im Run-PR-Body, Contract-Findings im Contract.
- **ENTSCHEIDUNG:** **(c) plus (a).** Jedes blockierende Finding erhält im `FORGE REVIEW v1`-Block eine ID `F-<TASK>-<PR#>-<k>` und eine Auflösungsart `code_change` oder `contract_change`. Code-Findings wandern über den Block `FORGE FINDINGS v1` im Body des nächsten Run-PRs derselben Contract-Version (je ID: `fixed <commit>` oder `disputed <Begründung>`); Contract-Findings erzwingen eine Revision, die sie in `findings[]` (Format 2) führt. Das Gate prüft **Vollständigkeit** (jede blockierende ID aus dem jüngsten `REQUEST_CHANGES` des Vorgänger-PRs ist aufgeführt, `FINDINGS_NOT_CARRIED`), der zugewiesene Reviewer prüft die **Substanz** und ist der einzige, der eine ID zurückziehen darf (`WITHDRAW_NOT_AUTHOR`); Reviewer-Wechsel nur per Owner-Kommentar `/forge reviewer code <name>` (HP D-5).
- **BEGRÜNDUNG:** Eine Revision pro Code-Rework (b) würde jedes `request_changes` zu einem Architektur-Review machen (CSV2 §4.4 „immer neues Review“) und damit die Carry-Forward-Pflicht zur Umgehungseinladung. Reiner Reviewer-Zwang (a) hängt am Gedächtnis eines LLM-Reviewers über Sessions hinweg, das es nicht gibt; die IDs im PR-Body sind das Gedächtnis.
- **KONSEQUENZ:** HP S-03 wird MUST BEFORE FIRST PRODUCTIVE RUN (§2) und in FORGE-PLAT-0001 umgesetzt (Parser für Review- und Findings-Blöcke, Vollständigkeitsprüfung über die PR-Historie des Tasks per API, `pull-requests: read`). Für den Kern (Format 2 `findings[]`) in FORGE-CORE-0002. Zusätzlich die Rework-Regel aus HP S-11: Ein Folge-Run darf nicht denselben Head-SHA einreichen wie der PR mit `request_changes(code_change)` (`REWORK_SAME_COMMIT`).

### W-08 Verifier-Identität

- **KONFLIKT:** DA #1: Verifier darf der Developer sein (E-02). HP/IGP/VD/PKG/OMD: GitHub Actions aus `main`. Owner: „GitHub Actions = zukünftiger unabhängiger Verifier“. Offen war nur die Ausgestaltung (VD: `pull_request_target`; HP O-02: Spike zwischen `pull_request_target` und Dispatch).
- **OPTIONEN:** (a) Actions `pull_request_target` aus `main`; (b) Actions `workflow_dispatch` durch Owner; (c) externer Runner.
- **ENTSCHEIDUNG:** **(a).** Verifier-Identität ist `github-actions[bot]` mit `GITHUB_TOKEN` (`contents: read`, `pull-requests: read`, sonst nichts), Workflow `.github/workflows/forge-verify.yml` ausschließlich aus `main`, Trigger ausschließlich `pull_request_target` (`opened`, `synchronize`, `reopened`, `edited`, `ready_for_review`); **kein** `pull_request_review` (W-32). Kein `vars.*`, kein `secrets.*`, Actions per SHA gepinnt, Prüflingscode nur im Container (PKG §3–§6).
- **BEGRÜNDUNG:** Der Verifier darf nicht vom Developer startbar oder beeinflussbar sein; `pull_request_target` nimmt die Workflow-Datei aus `main`, der PR-Inhalt bleibt Datenobjekt. Dispatch (b) macht den Owner zum Flaschenhals und löst den „edited“-Fall (DRILL N-8) nicht.
- **KONSEQUENZ:** HP O-02 wird auf die Spike-Punkte reduziert, die PKG nicht bereits mit Doku-Belegen beantwortet (siehe §7.10). Die Actions-Policy S1 (W-25) ist Voraussetzung, weil nur sie verhindert, dass ein PR-eigener Workflow gleichnamige Check-Runs erzeugt.

### W-09 Owner-Identität

- **KONFLIKT:** Der Pilot kannte den Owner nur als `actorType: "human"`-Feld und als von einer KI geschriebene Approval-Datei (DA C-21, KRITISCH). IGP/OMD: `Wuerfelduell` = Owner, Admin, **kein** Bypass-Eintrag. OMD F8/B4: Claude- und ChatGPT-Connectoren halten eine Admin-Verbindung als `Wuerfelduell`.
- **OPTIONEN:** (a) Owner mit Ruleset-Bypass; (b) Owner ohne Bypass, Notfall = Ruleset sichtbar ändern; (c) Owner-Aktionen über eine eigene App-Identität.
- **ENTSCHEIDUNG:** **(b).** `Wuerfelduell` ist Org Owner und Repo Admin, einziger `human` in `forge/policy.json`, in keiner Bypass-Liste. Der Owner pusht nie direkt auf `main`; er merged PRs (Merge Commit), attestiert Reviews, ändert Einstellungen. Jede Owner-Änderung an Repo-Dateien läuft als **Owner-PR** von `forge/owner/<thema>` (W-27).
- **BEGRÜNDUNG:** Weil Connectoren als `Wuerfelduell` handeln (OMD B4), wäre ein Bypass ein stiller Durchgriff für jede Fehlbedienung eines Agenten mit Owner-Verbindung. Ohne Bypass muss eine falsche Owner-Aktion die Rulesets ändern, was im Org-Audit-Log steht.
- **KONSEQUENZ:** Gate-Regel `OWNER_ON_RUN_BRANCH`: PR-Autor oder Pusher `Wuerfelduell` auf `forge/run/**` → rot (OMD B4). Owner-Attestationen sind nur in GitHub-Reviews gültig, nie in Dateien. `forge/approvals/*.json` wird eingefroren (W-24). Notfall: Ruleset `forge-halt` auf `active` (W-21).

### W-10 Reviewer-Identität

- **KONFLIKT:** Kern: Reviewer ist selbst erklärte Identität mit `different_identity|different_provider`-Vergleich [CODE]; DA #1 (RT-05). HP D-4: ChatGPT ohne Identität handelt über Seb, „zählt als Owner-Urteil, nie als unabhängiges Review“. IGP §10: Adapter mit `FORGE-REVIEW v1`-Block und `FORGE-ATTEST`-Zeile; CSV2 §5: `FORGE REVIEW v1`-Block im APPROVED-Review auf `C`. Owner: Claude/ChatGPT/Grok = externe, SHA-/Hash-gebundene Reviewer.
- **OPTIONEN:** (a) eigene GitHub-Identität je Reviewer (Machine Accounts, kostenpflichtig); (b) Adapter: Reviewer liest, Owner attestiert; (c) Reviewer-Bot per App.
- **ENTSCHEIDUNG:** **(b).** Reviewer haben in V0.1 keine GitHub-Identität. Ein Review entsteht so: Der Verifier (Run-PR) bzw. das Gate (Contract-PR) erzeugt ein **Review Packet** (PKG §9: Repo, PR, Head-SHA, Contract-Hash, Diff-Listing, Evidence-Hash). Der externe Reviewer antwortet mit einem `FORGE REVIEW v1`-Block, der `head`, `blob`, `contract` (Hash), `packet`, `verdict`, `mutant`- und `finding`-Zeilen enthält (Grammatik §5.9.1). Der Owner reicht den Block **wörtlich** als GitHub-Review ein (APPROVED oder REQUEST_CHANGES) und hängt die Zeile `FORGE ATTEST v1 reviewer=<chatgpt|claude|grok> block=<sha256 des Blocks> by=Wuerfelduell` an. GitHub-seitig ist das ein Review von `Wuerfelduell`; Forge-seitig trägt es den Reviewer-Namen als attestierte Behauptung. Unabhängigkeit: Code-Reviewer-Provider ≠ Developer-Provider (Codex/OpenAI entwickelt → ChatGPT ist **kein** zulässiger Code-Reviewer für Codex-Runs; Claude oder Grok sind es); Architektur-Reviewer ≠ Spec-Autor-Provider.
- **BEGRÜNDUNG:** Kostenlos, sofort umsetzbar, und die einzige Form, die mit der Trust Boundary („Claude schreibt nicht“) vereinbar ist. Die Grenze ist bekannt und akzeptiert (IGP §13 Nr. 1): Eine Kollusion „Owner attestiert ungelesen“ ist nicht technisch verhinderbar; Packet-Hash und Finding-Abgleich erschweren sie.
- **KONSEQUENZ:** Blocknamen vereinheitlicht (W-23): `FORGE REVIEW v1`, `FORGE ATTEST v1` (Leerzeichen, nicht Bindestrich; CSV2-Form, weil FORGE-PLAT-0001 den Parser dort spezifiziert). Das Gate prüft Block-Syntax, `head == PR-Head`, `contractHash == aktueller Contract`, Attest-Hash, Provider-Unabhängigkeit und dass der Review-Autor `Wuerfelduell` ist (`REVIEW_BLOCK_MISMATCH`, `REVIEWER_NOT_INDEPENDENT`, `ATTEST_INVALID`). Zur Verwechslung „ChatGPT reviewt Codex“ (HP OD-3-Empfehlung, DRILL-Rollen): ChatGPT ist für Codex-Runs **Architektur-Reviewer** (Spec-Autor Codex → ebenfalls Provider-Konflikt!) — deshalb gilt: Wenn `forge-codex` den Contract schreibt, ist der Architektur-Reviewer Claude oder Grok, nicht ChatGPT; wenn Seb oder Claude den Contract entwirft, darf ChatGPT ihn reviewen. Siehe OE-1.

### W-11 Koordinations-Ausnahme

- **KONFLIKT:** Kern: `forge/coordination/` ist von der Scope-Prüfung ausgenommen (`PROCESS_NOTE_PREFIX`) [CODE]; DA #8 (HOCH, VX-01): Code- und Prompt-Injection-Kanal; HP K-01, VD §6, PKG X-15: Ausnahme entfernen, `forge/` komplett geschützt.
- **OPTIONEN:** (a) Ausnahme behalten; (b) Ausnahme im Kern entfernen; (c) Ausnahme im Kern lassen, Verifier überstimmt.
- **ENTSCHEIDUNG:** **(b), bis dahin (c).** Die Verifier-Pfadautorität (VERIFIER-0001) behandelt `forge/**` als geschützt, unabhängig vom Kern (PKG X-15 bestätigt das als Pflichttest). FORGE-CORE-0002 entfernt `PROCESS_NOTE_PREFIX` und die Ausnahme aus `scopeViolations` (HP K-01, Teil). Die Dateien `forge/coordination/CLAUDE.md` und `CODEX.md` werden im ersten Owner-Hygiene-PR gelöscht (Historie bleibt); Koordination zwischen Agenten läuft ausschließlich über PR-Bodies, Review-Blöcke und Handoff-Kommentare.
- **BEGRÜNDUNG:** Die Ausnahme hat im Pilot den einzigen echten Merge-Konflikt erzeugt (RR PT-11) und ist ein Ausführungs- und Injektionskanal (VX-01: eine `.test.ts` unter `forge/coordination/` läuft im Verifier).
- **KONSEQUENZ:** HP K-01 wird nicht als eigener Task geführt, sondern in FORGE-CORE-0002 aufgenommen (Kern) und ist in VERIFIER-0001 bereits enthalten (Verifier). `forge/roles/*.md` (Rollenvorlagen) sind der einzige neue Inhalt unter `forge/`, der nicht Contract/Policy ist, und nur per Owner-PR änderbar.

### W-12 Evidence v2/v3 vs. Evidence v1

- **KONFLIKT:** Kern: `VerificationEvidenceSchema` mit `changedFiles` ohne Diff-Basis, `renamed`, `method: "fresh_clone"`, `mutations|null` [CODE] (DA #3 KRITISCH, E-09). HP K-03 „Evidence v3“ (Kern-Schema mit `diffBase`, `diffOptions`, Modi, Kollisionen). PKG §8 „FORGE-VERIFICATION-EVIDENCE v1“ (`forgeEvidenceFormat: 1`, JSON-Artefakt des Verifiers mit `toKernelEvidence`-Abbildung, `mutations: null`).
- **OPTIONEN:** (a) Kern-Schema zu v3 erweitern und Verifier darauf bauen; (b) Verifier-Evidence v1 als eigenes Dokument, Kern unverändert; (c) beides.
- **ENTSCHEIDUNG:** **(b).** Die maßgebliche Evidence ist das Verifier-Dokument `FORGE-VERIFICATION-EVIDENCE v1` (PKG §8): Repo-ID, PR-Nummer, `head`, `base` (= `runBase`), `main` zur Laufzeit, Contract (`blobSha`, `contentHash`, `C`, `M`), `listingSha256` von Basis- und Head-Listing, `changedFiles` mit Modi aus den Listings, Checks (`name`, `argv`, `exitCode`, `durationMs`), Inventar (`total`, `passed`, `failed`, `skipped`, `todo`, `baselineTotal`), `image` (Digest), `lockfileSha256`, `workflowRunId`, `runAttempt`, `evidenceHash`. Es wird als Actions-Artefakt gespeichert, im Check-Output zusammengefasst und im Review Packet referenziert. Das Kern-Schema wird **nicht** auf v3 erweitert; `toKernelEvidence` liefert dem Kern nur, was `evaluateVerification` braucht (Scope-Urteil), mit `mutations: null`.
- **BEGRÜNDUNG:** Ohne persistierten Log (W-04) ist das Kern-Evidence-Schema nur eine Funktionssignatur. Zwei Evidence-Formate zu pflegen wäre doppelte Arbeit ohne Konsumenten. Die Bindung „Evidence gehört zu genau diesem Head“ erledigen Required Check auf Head-SHA + strikte „up to date“-Regel, nicht ein Kernfeld.
- **KONSEQUENZ:** HP K-03 entfällt als Task; `DIFF_BASE_MISMATCH` u. ä. sind Verifier-Codes. Die Nummerierung „v3“ wird nicht weitergeführt; es gibt genau **ein** Evidence-Format mit `forgeEvidenceFormat: 1`.

### W-13 `mutationSmoke` vs. Mutantenliste

- **KONFLIKT:** Kern: Enum `none|optional|required`, Developer-Mutationen zählen, `equivalent`-Quittung [CODE] (DA C-32/C-33, E-05/E-06). HP K-04: `{name,file,find,replace,note}`, Verifier führt aus, `optional` entfällt. VD §9.3/CSV2: `mutants[{id,file,before,after,tests}]` (1–8). PKG OD-6: in V0.1 **nicht** vom Verifier ausgewertet („reviewer-repliziert“), VERIFIER-0004 später. DRILL A-4: Mutantenliste im Frontmatter vorausgesetzt.
- **OPTIONEN:** (a) Verifier führt Mutanten aus (VERIFIER-0004 vor Drill); (b) Mutanten im Contract, Reviewer repliziert, Verifier meldet `not_evaluated`; (c) Mutanten nur Prosa.
- **ENTSCHEIDUNG:** **(b) in V0.1, (a) in V0.2.** Format 2 trägt `mutants[]` (1–8 Einträge, `{id, file, before, after, tests}`; `file ∈ scope`; `before` genau einmal in der Datei am Head, Kern/Gate-Code `MUTANT_NOT_APPLICABLE`); `mutationSmoke` entfällt in Format 2. Der Code-Reviewer **muss** jeden Mutanten am verifizierten Head anwenden und das Ergebnis im Review-Block melden (`mutants: [{id, outcome: killed|survived}]`); ein `survived` ist blockierendes Finding mit `contract_change` oder `code_change`. Der Verifier schreibt in die Evidence `mutants: "not_evaluated_by_verifier"`. Format-1-Bootstrap-Contracts setzen `mutationSmoke: "required"` mit Mutanten in der Prosa (PKG OD-6 (a)).
- **BEGRÜNDUNG:** Der Mutantenlauf im Verifier braucht in-memory-Transform plus Kernerweiterung (PKG §11.3 „bewusst vierter Task“); ihn vor den Drill zu ziehen verlängert den kritischen Pfad um einen Run-Zyklus. Die Reviewer-Replikation ist für ≤ 8 Mutanten und einen Reviewer mit Klonmöglichkeit (Claude-Thread, Grok mit Repo-Lesezugriff) realistisch und wird durch die Pflichtfelder im Block erzwungen.
- **KONSEQUENZ:** HP K-04 geht in FORGE-CORE-0002 (Schema) auf; die Ausführung ist FORGE-VERIFIER-0004 (V0.2). Kern-Änderung: `DeveloperReport` verliert `mutations`, `code_review_recorded` verliert die Äquivalenz-Quittung (K-04 (3)/(4)); `evaluateVerification(metadata, evidence)` ohne Report.

### W-14 Contract-Pfad, Versionierung und Format-Zeitpunkt

- **KONFLIKT:** Kern: ein Pfad `forge/contracts/<TASK>.md`, Versionen als aufeinanderfolgende Commits (`CONTRACT_VERSION_NOT_NEXT`) [CODE]; Repo: Sidecar `FORGE-CORE-0001B.v2.md` (DA C-14, BASELINE-STATUS „B-v2 sidecar registration open“); CSV2: ein Pfad, `supersedes{contractVersion, contentHash, blobSha, format}`; Format 2 als neue Literal-Nummer (OD-I). PKG OD-5: VERIFIER-0001 in Format 1 **jetzt**; CSV2 OD-L: FORGE-CORE-0002 sofort als Bootstrap-PR.
- **OPTIONEN:** (a) Format 1 für alles bis CORE-0002, dann Format 2; (b) erst CORE-0002, dann alles in Format 2; (c) Format 1 dauerhaft mit Zusatzdateien.
- **ENTSCHEIDUNG:** **(a) mit harter Grenze.** Format 1 ist zulässig **nur** für die Bootstrap-Contracts FORGE-VERIFIER-0001, FORGE-CORE-0002 und, falls CORE-0002 beim Schreiben noch nicht auf `main` ist, FORGE-VERIFIER-0002. Ab dem ersten Contract, der nach dem Abnahme-Merge von CORE-0002 registriert wird, ist Format 2 Pflicht (`FORMAT_NOT_CURRENT`); FORGE-DRILL-0001 und VS-1 sind Format 2. Ein Pfad pro Task, Versionen = Registrierungs-Merges, `supersedes` verkettet; Sidecar-Dateien sind verboten (`CONTRACT_PR_NOT_ISOLATED`, Dateiname ≠ `<TASK>.md`).
- **BEGRÜNDUNG:** VERIFIER-0001 ist gegen den realen Parser validiert und blockiert nichts; auf Format 2 zu warten verzögert den Verifier um einen vollen Zyklus. Umgekehrt muss der Drill das Format fahren, das der produktive Run fährt (sonst prüft der Drill die falsche Pipeline).
- **KONSEQUENZ:** Für Bootstrap-Contracts gilt die Übergangsregel aus W-03 (`baseCommit` ≙ `specifiedAgainst`). Legacy-Dateien `FORGE-CORE-0001A.md`, `…-PATCH-0001.md`, `FORGE-CORE-0001B.md`, `FORGE-CORE-0001B.v2.md`, `TASK-0004.md` bleiben unverändert (§13); ihre Tasks sind nicht Forge-managed (`LEGACY_CONTRACT_HISTORY`).

### W-15 TASK-0004 / TASK-0005 Migration

- **KONFLIKT:** CHA §12: TASK-0004 retroaktiv binden (Approval + Verifikation von `e9cb8e2` gegen Blob `334fe6fe…`) statt neu implementieren; CHA §8 Schritt 0: kernkonformer Rewrite als neuer Commit `C1`; RR Anhang B #4: Statusfelder in kernkonformer Migration entfernen; DA §18 Task 5: TASK-0005 als erster echter Run migrieren; HP D-13/S-09: Legacy bleibt Geschichte, Migration nur bei Bedarf; CSV2 OD-C/OD-D: TASK-0004 einfrieren (A), TASK-0005 liegen lassen, bei Implementierung als v3 mit `supersedes.format: "legacy"`; ROAD: VS-3 = TASK-0005-Implementierung mit Contract v2 **unverändert** (550-Zeilen-Grenze), Vorbedingung „dokumentierte externe Freigabe“.
- **OPTIONEN:** (a) retroaktive Bindung; (b) Rewrite jetzt; (c) einfrieren, TASK-0005 bei Bedarf als v3.
- **ENTSCHEIDUNG:** **(c).** TASK-0004 ist durch den Baseline-Merge `3d7545d` auf `main` und damit **historisch akzeptiert**; es wird weder neu registriert noch gebunden noch umgeschrieben. Legacy-Tasks (TASK-0001…0004) sind als Dependency nur in der Form `{taskId, acceptedCommit: "3d7545d…", provenance: "legacy"}` referenzierbar; der Gate prüft dafür nur `acceptedCommit ⊑ runBase`. TASK-0005 wird **erst** registriert, wenn VS-3 ansteht: als `forge/contracts/TASK-0005.md` v3 im Format 2 mit `supersedes: {contractVersion: 2, blobSha: "1e6f36e5…", contentHash: <sha256 des Legacy-Textes>, format: "legacy"}`, Pflichtabschnitt „Migration aus Legacy“, **neues** Architektur-Review (die Claude-Freigabe auf `be40a68` ist historische Evidenz, kein Forge-Approval). Die 550-Zeilen-Grenze aus v2 wird dabei als `limits.maxProductionLines: 550` übernommen (ROAD-Empfehlung), nicht auf 400 gekürzt.
- **BEGRÜNDUNG:** Retroaktive Bindung erzeugt einen Approval-Akt für Code, der längst gemerged ist (Scheinfreigabe); ein Rewrite jetzt kostet ein Review ohne Nutzen. Der einzige Punkt, an dem TASK-0005 Forge-Semantik braucht, ist der Start seiner Implementierung. VS2 §15 löst den Legacy-Dependency-Platzhalter falsch („Commit von TASK-0001 auf der First-Parent-Kette“ existiert nicht; First-Parent-Kette von `main` ist `3d7545d → f5dbc73`) — deshalb die Festlegung auf `3d7545d` als einheitlichen Legacy-Anker.
- **KONSEQUENZ:** §13 Migrationstabelle. VS2 §15 und SOLV §17 (Platzhalter `27075fe…`, `5bfa5a4…`, `e9cb8e2…`) werden beim Contract-Schreiben auf `3d7545d…` gesetzt. Branch `codex/mystery-task-0005` und `claude/forge-architecture-review-hjdq89` bleiben bis zur Registrierung von v3 unangetastet (RS-ALL verbietet Löschen ohnehin).

### W-16 Harte Zeilenlimits

- **KONFLIKT:** Pilot-Contracts: „Überschreitung begründen“ (nie geprüft); CSV2 OD-A: `limits.maxProductionLines` hart (`SIZE_EXCEEDED`); AVD/ROAD: VS-1-Grenze 300, T6: 400; ROAD: „VS-3 ≤ 550, alle anderen ≤ 400“ gegen Sebs Wunsch „< 400“; PKG: VERIFIER-Tasks 300–400 mit Grenze 400; HP: jeder Task einzeln unter 400.
- **OPTIONEN:** (a) weich (Reviewer entscheidet); (b) hart im Verifier; (c) hart mit Owner-Waiver.
- **ENTSCHEIDUNG:** **(b).** Format 2 `limits: {maxProductionLines, maxChangedFiles}` ist Pflicht; der Verifier (`forge-gate`) zählt **hinzugefügte Zeilen** in Nicht-Testdateien (`git diff --numstat --no-renames runBase..H`, Dateien außerhalb `tests/**`) und geänderte Dateien (Listing-Differenz); Überschreitung → `SIZE_EXCEEDED`, rot, Erhöhung nur per Revision. Policy-Obergrenze: kein Contract darf `maxProductionLines > 550` setzen (`LIMIT_ABOVE_POLICY`). Format-1-Bootstrap-Contracts: Policy-Default 400/20.
- **BEGRÜNDUNG:** Eine nie geprüfte Grenze ist Prosa. Die Zählung über `--numstat` ist deterministisch, weil der Head-Tree ohnehin ASCII-only und `100644`-only sein muss (PKG §7–§9); Binärdateien gibt es nicht.
- **KONSEQUENZ:** VS-1-Contract: `maxProductionLines: 300`, `maxChangedFiles: 6`; TASK-0005 v3: 550; VERIFIER-000x: 400. ROAD §4.7 „VS-3 ≤ 550“ wird akzeptiert (Alternative wäre eine Neuversion mit erneutem Review, deren Nutzen nur in 150 Zeilen besteht).

### W-17 `SPEC_STALE`

- **KONFLIKT:** Kern und DA kennen den Begriff nicht (Stale nur gegenüber Revision, nicht gegenüber `main`); RR SD-01 „Stale Base“ mit RECONCILE/RESTART; CSV2 §7.3 `SPEC_STALE` über `reads ∪ scope.modify`, OD-B Revision statt Waiver, OD-H `reads` optional mit Lint; PAC PA-77: leeres `reads` umgeht `SPEC_STALE`.
- **OPTIONEN:** (a) kein `SPEC_STALE`, Reviewer prüft; (b) `SPEC_STALE` mit optionalem `reads`; (c) `SPEC_STALE` mit Pflichtfeld `reads`.
- **ENTSCHEIDUNG:** **(c).** `reads` ist Pflichtfeld (leeres Array zulässig); `SPEC_STALE := changedFiles(specifiedAgainst, runBase) ∩ (reads ∪ scope.create ∪ scope.modify) ≠ ∅`, zusätzlich **Existenzregel**: jede Datei in `scope.modify ∪ reads` muss an `specifiedAgainst` existieren (`READS_NOT_FOUND`), jede Datei in `scope.create` darf an `runBase` nicht existieren (`CREATE_TARGET_EXISTS`). Der Architektur-Reviewer bestätigt im Review-Block `reads_reviewed: true`, dass `reads` die im Body genannten Dependency-Dateien vollständig abbildet (menschlicher Rest, PAC PA-77). Kein Waiver.
- **BEGRÜNDUNG:** Die Spezifikation wurde gegen einen Stand gelesen; bewegt sich genau dieser Stand an den gelesenen Stellen, ist das Review formal wertlos. Ein Waiver würde den Owner zum Architektur-Reviewer machen.
- **KONSEQUENZ:** `SPEC_STALE` wird am Run-PR geprüft (Gate) **und** am Contract-PR zur Merge-Zeit (`specifiedAgainst` vs. `M^1`; bewegt sich `main` vor dem Merge an gelesenen Stellen, muss der Autor `specifiedAgainst` aktualisieren → neuer Hash → neues Review; das ist gewollt).

### W-18 Check-Namen

- **KONFLIKT:** Kern: `requiredChecks[].name` muss `/^[a-z][a-z0-9-]{0,31}$/` erfüllen — **kein Schrägstrich** [CODE]; HP D-14: `forge`, `forge-approval`; IGP: `forge-contract`, `forge-gate`, `forge-verify`, `forge-policy`; PKG/OMD: `forge-gate`, `forge-verify`; DRILL A-1: vier Namen; Owner-Beispiel: `forge/contract`, `forge/scope`, `forge/typecheck`, `forge/test`, `forge/mutation-smoke`, `forge/verification`; PAC PA-39: Namensmenge nicht eingefroren = Required Checks tot oder beratend.
- **OPTIONEN:** (a) viele Checks mit Schrägstrich (ein Check je Prüfung); (b) zwei Checks; (c) ein Check.
- **ENTSCHEIDUNG:** **(b), ein für alle Mal.** Zwei Ebenen, zwei Vokabulare:
  1. **GitHub Check Runs** (Job-Namen im Workflow `forge-verify.yml`, Quelle „GitHub Actions“, beide **required**, beide **strict**): `forge-gate` und `forge-verify`. Keine weiteren Checks, keine Umbenennung ohne Revision dieses Dokuments. Die Prüfungen, die Seb als `forge/contract`, `forge/scope`, `forge/verification` benennt, sind **Abschnitte des Check-Outputs** von `forge-gate` (Contract, Identität, Scope-Vorprüfung, Quittung, Review/Attestation, Findings, Limits) bzw. `forge-verify` (Tree-Regeln, Diff, Checks, Inventar, Evidence); jeder Abschnitt beginnt mit einer Zeile `forge/<abschnitt>: PASS|FAIL <code>`, damit die Owner-Sicht am Handy die gewünschte Granularität hat.
  2. **Contract-Checks** (`requiredChecks[].name` im Frontmatter): Namen aus der Policy-Allowlist `typecheck`, `test` mit **fest gepinnten** Kommandos (`npm run typecheck`, `npm test`); abweichende Kommandos → `CHECK_NOT_ALLOWED`. Schrägstriche sind hier wegen des Kern-Regex unzulässig und bleiben es.
- **BEGRÜNDUNG:** Required Checks sind namensexakt; jeder zusätzliche Name ist ein zusätzlicher Weg, den Merge totzustellen (PA-39). Zwei Jobs trennen die Vertrauensgrenze sauber (Gate: nur Daten/Git; Verify: Prüflingscode im Container). Der Kern-Regex ist Code und schlägt das Beispiel im Auftrag.
- **KONSEQUENZ:** HP D-14, IGP §8–§9 (vier Checks), DRILL A-1 sind ersetzt. `forge-approval`/`forge-policy` gehen in `forge-gate` auf (Abschnitt `forge/review`). Ruleset `forge-main`: genau diese zwei Required Checks (§9).

### W-19 Handoff für Run n > 1

- **KONFLIKT:** HP P-04: Handoff nur beim Contract-Merge (Workflow-Kommentar); CSV2 §7: `result_ref` mit n = Anzahl Run-PRs + 1; RR: `run:<task>-v<version>-a<attempt>`, Manifest je Attempt; DRILL N-7: unspezifiziert.
- **OPTIONEN:** (a) Handoff nur einmal, Developer zählt selbst; (b) Handoff je Run durch Workflow; (c) Handoff je Run durch Owner-Kommentar aus Vorlage.
- **ENTSCHEIDUNG:** **(c) mit Gate-Prüfung.** Je Task existiert ein **Tracking-Issue** `forge: <TASK>` (vom Owner bei Registrierung angelegt, Label `forge-task`). Jeder Run beginnt mit einem Kommentar `FORGE DEVELOPER HANDOFF v2` des Owners auf diesem Issue (Felder §5.9), erzeugt aus der Rollenvorlage `forge/roles/handoff.md` durch Einsetzen von acht Werten, die der Owner aus der Job-Summary des Contract-PRs bzw. der GitHub-Oberfläche kopiert (`task` mit Version, `contract_commit`, `registration_merge`, `content_hash`, `blob`, `run`, `branch`, `previous_pr`; Grammatik §5.9.5). Es gibt **keinen** Handoff-Workflow in V0.1. Der Gate prüft unabhängig vom Handoff: `n` im Branch-Namen = Anzahl bisheriger (geschlossener oder gemergter) Run-PRs des Tasks + 1 (`RUN_NUMBER_NOT_NEXT`), kein offener Run-PR des Tasks, und für n > 1 den Findings-Block (W-07). Der Handoff ist damit Komfort für den Developer, kein Sicherheitsmechanismus.
- **BEGRÜNDUNG:** Ein Handoff-Workflow bräuchte `pull-requests: write` und wäre der einzige schreibende Workflow (Angriffsfläche, PA-40); die sechs Werte sind ohnehin im Check-Output sichtbar. Der Gate macht den Developer-Fehler („falsches n“, „Vorgänger offen“) mechanisch sichtbar.
- **KONSEQUENZ:** HP P-04 schrumpft auf die Rollenvorlagen (`forge/roles/*.md`), die in FORGE-OPS-0001 per Owner-PR landen. DRILL §9 Walkthrough: Run 2 beginnt mit Handoff-Kommentar #2 auf dem Issue.

### W-20 Parallele Runs

- **KONFLIKT:** RR: Scope-Lease + serielle Spur, `maxActiveRuns` 3, `maxActiveRunsPerAgent` 1; HP D-15: `maxActiveRuns = 1` bis nach dem ersten Run, Scope-Lease = S-05; ROAD: VS-1/VS-2/VS-3 parallel startbar; DA §9.3: sechs Punkte Parallelisierung.
- **OPTIONEN:** (a) parallel mit Scope-Lease; (b) eine Spur; (c) parallel ohne Regeln.
- **ENTSCHEIDUNG:** **(b) für V0.1.** Höchstens **ein offener Run-PR im Repository** (`RUN_LIMIT`). Parallele **Contract-PRs** sind unbegrenzt erlaubt (höchstens einer je Task, `CONTRACT_PR_DUPLICATE`). Scope-Lease (`SCOPE_LEASE_CONFLICT`), Pfadklassen `shared`/`protected` und RECONCILE-Automatik sind V0.2.
- **BEGRÜNDUNG:** Es gibt genau eine Developer-Identität, die auf einem Checkout arbeitet (RR P-A/P-D); „parallel“ hieße für Codex ohnehin sequenziell. Jede Parallelregel braucht Scope-Vergleiche über offene PRs und eine Policy-Datei mit Pfadklassen — Infrastruktur, deren Fehler erst sichtbar würden, wenn zwei Runs kollidieren.
- **KONSEQUENZ:** ROAD §5 „VS-1/VS-2/VS-3 parallel“ wird zu einer **Contract-Parallelität**: alle drei Contracts können gleichzeitig entworfen, reviewt und registriert werden; implementiert wird nacheinander. Reihenfolge: §15/§16.

### W-21 `FORGE_HALT`-Variable vs. Ruleset `forge-halt`

- **KONFLIKT:** HP O-01/P-02 und VD AC-38: Repository-Variable `FORGE_HALT`; OMD §5/B5: Write darf Actions-Variablen verwalten → Variable ist durch `forge-codex` umgehbar; stattdessen deaktiviertes Ruleset `forge-halt` („Restrict updates“ auf `main`).
- **ENTSCHEIDUNG:** Ruleset `forge-halt` (Ziel `~DEFAULT_BRANCH`, Regel „Restrict updates“, keine Bypass-Liste, Enforcement `disabled`; zum Anhalten auf `active`). Zusätzlich für einen Verifier-Stopp: Workflow über Actions-UI deaktivieren (Admin). Der Verifier liest **kein** `vars.*` und kein `secrets.*`.
- **BEGRÜNDUNG:** Nur Admins ändern Rulesets; die Aktion steht im Org-Audit-Log.
- **KONSEQUENZ:** HP §8.4 „`FORGE_HALT=1` macht `forge` rot“ wird zu „`forge-halt` aktiv ⇒ kein Merge nach `main` möglich (Merge-Button gesperrt), Drill-Nachweis per Screenshot/Link“.

### W-22 Branch-Namensraum

- **KONFLIKT:** HP/MP/CSV2: `forge/run/<TASK>-<n>`; IGP/OMD/PKG/DRILL: `forge/run/<agent>/<TASK>-<n>`; Spec-Branches: IGP `forge/spec/**`, PKG `forge/contract/**`.
- **ENTSCHEIDUNG:** Run-Branches `forge/run/codex/<TASK>-<n>` (Team-Bypass `forge-dev-codex`), reserviert `forge/run/claude/**` (gesperrt, leere Bypass-Liste), Contract-Branches `forge/contract/<TASK>-v<N>`, Owner-Branches `forge/owner/<thema>`. Alle anderen Branch-Namen sind verboten (Catch-all-Ruleset, §9).
- **BEGRÜNDUNG:** Branch-Hoheit je Developer ist nur über getrennte Namensräume mit eigenem Bypass-Akteur ausdrückbar (IGP §7, OMD §5). `forge/contract/` statt `forge/spec/`, weil das Kern-Vokabular „Contract“ ist und der jüngste Bericht (PKG) es verwendet.
- **KONSEQUENZ:** Policy `runBranchPattern: "forge/run/<agent>/<TASK>-<n>"`; Gate prüft `agent` == Login/ID des PR-Autors (`BRANCH_AGENT_MISMATCH`, PAC PA-04).

### W-23 Blocknamen und -versionen

- **KONFLIKT:** `FORGE READ RECEIPT v1` (HP P-04/CHA §6) vs. `v2` (CSV2 §8); `FORGE-REVIEW v1`/`FORGE-ATTEST` (IGP §10) vs. `FORGE REVIEW v1` (CSV2 §5); `FORGE DEVELOPER HANDOFF v1` (HP/CHA) vs. `v2` (CSV2).
- **ENTSCHEIDUNG:** Genau fünf Blöcke, alle mit Leerzeichen-Schreibweise und Versionsnummer in der Kopfzeile: `FORGE READ RECEIPT v2`, `FORGE REVIEW v1`, `FORGE ATTEST v1`, `FORGE FINDINGS v1`, `FORGE DEVELOPER HANDOFF v2`. Grammatik in §5.9. Kein Block wird ohne Versionssprung geändert.
- **BEGRÜNDUNG:** Der Parser (FORGE-PLAT-0001) ist gegen genau eine Grammatik zu testen; die CSV2-Form ist die jüngste und vollständigste.
- **KONSEQUENZ:** IGP §10 und HP P-04 Blockformate sind ersetzt.

### W-24 Approval-Dateien vs. GitHub-Reviews

- **KONFLIKT:** `forge/approvals/*.json` (Format `forgeApprovalRecord: 1`, Actor `human/owner`, geschrieben von einer KI-Session, Basis „No line-by-line owner review“) [CODE]; DA C-21 (KRITISCH), TD-05; PKG OD-10 schlägt noch einen Approval-Record für VERIFIER-0001 vor.
- **ENTSCHEIDUNG:** Keine neuen Dateien unter `forge/approvals/`. Jede Freigabe ist ein GitHub-Review von `Wuerfelduell` (W-10). Der Ordner wird eingefroren (Legacy), der Pfad bleibt `always`-geschützt.
- **BEGRÜNDUNG:** Eine Datei kann jeder mit Write schreiben; ein Review trägt Login, Zeit, `commit_id` und ist nicht von Agenten fälschbar.
- **KONSEQUENZ:** PKG OD-10 Satz „Seb attestiert als Approval-Record `forge/approvals/…json`“ ist ersetzt durch „Seb attestiert als GitHub-Review auf dem Contract-PR“.

### W-25 Actions-Policy S1 und `pull_request_target`

- **KONFLIKT:** VD C7/OMD B2/PKG OD-2: S1 (Events `push`/`pull_request` verboten) als Abwehr gegen gleichnamige Checks, Verfügbarkeit im Free-Plan unverifiziert; PAC PA-30: GitHub blockt `pull_request_target` in öffentlichen Repos per Default-Policy **ab 2026-11-02**; ohne explizite Erlaubnis startet der Verifier nie (fail-closed, aber tot).
- **ENTSCHEIDUNG:** Die Actions-Event-Policy ist **zwingende Vorbedingung** mit zwei Wirkungen: Sie **erlaubt** genau `.github/workflows/forge-verify.yml` für `pull_request_target` (und `pull_request_review`) und **verbietet** alle anderen Events und Workflows für alle Akteure (`workflow_dispatch` nur Owner). Negativtest S1 (ein PR-eigener Workflow `on: push`/`on: pull_request` darf nicht laufen) und Positivtest (der Verifier läuft nach Aktivierung der Policy) werden als `forge/ops/S1-RESULT.md` dokumentiert. Scheitert S1 im Free-Plan, ist der Weg GitHub Team (Org-Rulesets, Required Workflows) — das ist OE-3.
- **BEGRÜNDUNG:** Spätere empirische Quelle (PAC, Doku-Beleg mit Ablaufdatum) schlägt die früheren Annahmen.
- **KONSEQUENZ:** §2 MUST BEFORE FIRST DRILL Nr. 3; §9 Actions-Einstellungen; §14 GO-Bedingung.

### W-26 Rollenverteilung (Spec-Autor, Developer, Reviewer)

- **KONFLIKT:** DA #1: ein Akteur bis `accepted`; HP OD-3-Empfehlung: Spec Codex, Architektur-Review Seb/ChatGPT, Developer Claude, Code-Review Codex; DRILL: Spec-Autor + Developer = Codex, Architektur-Review ChatGPT, Code-Review Claude/Grok; CSV2 OD-J: Developer darf Spec-Autor sein; IGP Frage 5: darf `forge-codex` Spec-Autor sein; OMD: Claude schreibt nichts.
- **ENTSCHEIDUNG:** Spec-Autor darf jeder sein, der pushen darf (`Wuerfelduell` auf `forge/contract/**`, `forge-codex` auf `forge/contract/**`); Developer ist in V0.1 ausschließlich `forge-codex`; Architektur-Reviewer-Provider ≠ Spec-Autor-Provider; Code-Reviewer-Provider ≠ Developer-Provider (also nie ChatGPT für Codex-Runs); Verifier = Actions; Attestierer = `Wuerfelduell`. Claude ist in V0.1 Reviewer und Spec-Entwerfer (Text, den Seb pusht), nie Pusher. HP OD-3-Empfehlung („Developer: Claude, Code-Review: Codex“) ist durch die Trust Boundary (OMD) überholt.
- **BEGRÜNDUNG:** Die Unabhängigkeit liegt bei den Reviewern (CSV2 OD-J); die Provider-Regel schließt die Pilot-Konstellation „derselbe Anbieter spezifiziert, implementiert und reviewt“ (DA #2) mechanisch aus, soweit der Gate den Provider aus Policy (Developer-Login) und Attest-Zeile (Reviewer-Name) kennt.
- **KONSEQUENZ:** Policy-Feld `providers: {forge-codex: "openai", chatgpt: "openai", claude: "anthropic", grok: "xai"}`; Gate-Codes `REVIEWER_NOT_INDEPENDENT`. OE-1 fragt nur noch, **welcher** der zulässigen Reviewer die Bootstrap-Contracts reviewt.

### W-27 Owner-PRs, Required Approvals und Code-Owner-Review

- **KONFLIKT:** IGP §6/HP O-01: „Required approvals 1“, „Require review from Code Owners“ (CODEOWNERS `@Wuerfelduell`); PKG OD-3: Owner-Modus für `forge/owner/**` und `forge/contract/**`; PAC PA-20 (★): mit genau einem Code Owner, der selbst PRs autort, ist jeder Owner-PR unmergebar (Autor darf nicht approven) → Bypass-Druck.
- **OPTIONEN:** (a) Approvals 1 + Code-Owner-Review, Owner autort nie (Codex pusht alle Contracts und Konfigurationen); (b) Approvals 0, Code-Owner-Review aus, Attestations-Logik ausschließlich im Required Check `forge-gate`; (c) zweite menschliche Identität.
- **ENTSCHEIDUNG:** **(b).** Ruleset `forge-main`: „Require a pull request before merging“ **an**, „Required approvals“ **0**, „Require review from Code Owners“ **aus**, „Require conversation resolution“ an, „Restrict who can dismiss reviews“ = nur `Wuerfelduell`. Die Freigabe-Logik liegt vollständig in `forge-gate` (required, strict): Für einen Run-PR verlangt der Gate ein Review von `Wuerfelduell` mit State `APPROVED` auf dem aktuellen Head mit gültigem `FORGE REVIEW v1`- und `FORGE ATTEST v1`-Block; für einen **owner-autorisierten** PR (Contract- oder Owner-Branch, Autor `Wuerfelduell`) verlangt er ein Review von `Wuerfelduell` mit State `COMMENTED` auf dem aktuellen Head mit denselben Blöcken (GitHub verbietet Selbst-Approval, nicht Selbst-Kommentar), dazu einen externen Reviewer ≠ Owner-Provider. Damit **nur der Owner merged**, erhält `main` ein zweites Ruleset `forge-main-merge` mit der einzigen Regel „Restrict updates“ und Bypass-Akteur `Wuerfelduell` (`always`) — ein Bypass, der nur diese eine Regel betrifft, während `forge-main` ohne Bypass für alle gilt. CODEOWNERS bleibt als Datei (automatische Review-Anfrage an Seb), aber ohne Ruleset-Zwang.
- **BEGRÜNDUNG:** Es gibt genau einen Menschen. (a) macht Codex zur Hand des Owners für jede Textzeile und schafft einen Laundering-Pfad (Agent approvt Owner-Inhalt); (c) ist mit den GitHub-Nutzungsbedingungen (ein kostenloses Konto je Person, ein Machine Account) nicht verfügbar. (b) hat genau einen Durchsetzungspunkt, den PA-39 ohnehin verlangt (Gate required + strict), und bindet die Attestation an den Head-SHA statt an GitHubs Approval-Mechanik. „Restrict updates“ mit Owner-Bypass ist die einzige Ruleset-Form, die „nur Seb merged“ technisch ausdrückt.
- **KONSEQUENZ:** §9 Rulesets neu; IGP §5 Zeile „`main` per PR mergen“ wird technisch durch `forge-main-merge` erzwungen; HP §8.1 „Stale-Approval-Drill“ wird zu „Push nach Attestation macht `forge-gate` rot (`ATTEST_STALE`)“. PKG OD-3 ist damit entschieden (Owner-Modus = Branch-Namensraum `forge/owner/**` + `forge/contract/**` mit Autor `Wuerfelduell`, nicht Bypass, nicht Checks-aus).

### W-28 Identity-Spike: PASS vs. Beleg

- **KONFLIKT:** Owner: „Identity-Spike ist PASS“; PKG OD-1/OMD B1: PASS nur mit Org-Audit-Log-Beleg (Pusher = `forge-codex`) und Umstellung der Commit-E-Mail auf die noreply-Adresse; eigener Befund: Commit `8dc692b` trägt Autor/Committer `forge-codex` mit einer **privaten** E-Mail-Adresse [GIT]; PR-Autor ist `forge-codex` (User-ID 337272506) [API].
- **ENTSCHEIDUNG:** Die Owner-Aussage gilt für die **Authentifizierung** (Codex pusht als `forge-codex`; PR-Autor belegt es). Zwei Punkte bleiben als MUST BEFORE FIRST DRILL: (1) Seb legt den Audit-Log-Eintrag (`git.push`, Akteur `forge-codex`, Ref `forge/run/codex/IDENTITY-SPIKE-1`) als Zitat in `forge/ops/IDENTITY-SPIKE.md` ab (OE-5); (2) die Git-Identität von Codex wird auf `forge-codex <337272506+forge-codex@users.noreply.github.com>` umgestellt, und der Gate prüft Autor- und Committer-E-Mail jedes Commits in `runBase..H` gegen die Policy-Allowlist des Developers (`COMMIT_IDENTITY_MISMATCH`). PR #2 wird nach dem Beleg **geschlossen, nicht gemergt** (leerer Commit, kein Contract).
- **BEGRÜNDUNG:** E-Mail-Attribution ist fälschbar, aber eine Allowlist macht die Fälschung sichtbar; Metadata-Rulesets (Autor-Muster) gibt es nur im Team-/Enterprise-Plan (PAC §7), also übernimmt der Gate diese Prüfung.
- **KONSEQUENZ:** §4 Identitätsmatrix, §13 (PR #2 schließen), §16 Task FORGE-OPS-0001.

### W-29 Ort der Lesequittung (PAC PA-13, DRILL N-8)

- **KONFLIKT:** HP P-04/CSV2 §8: Quittung im PR-Body; `pull_request_target` läuft per Default nicht bei `edited` → Body nach grünem Gate änderbar.
- **ENTSCHEIDUNG:** Die Quittung `FORGE READ RECEIPT v2` steht in der **Commit-Message eines leeren Commits**, der der erste Commit des Run-Branches ist (`git commit --allow-empty -F receipt.txt`); der Gate liest sie aus `git log --format=%B runBase..H` (genau ein Commit mit dieser Kopfzeile, und zwar der erste; sonst `RECEIPT_MISSING`/`RECEIPT_DUPLICATE`). Force-Push ist auf `forge/run/**` gesperrt, also ist die Quittung unveränderlich. Der PR-Body trägt nur den `FORGE FINDINGS v1`-Block (n > 1); dafür löst der Workflow zusätzlich auf `edited` aus, und der Gate ist required — eine Body-Änderung erzeugt einen neuen, zunächst `queued` Check-Run auf demselben SHA und sperrt den Merge, bis er grün ist.
- **BEGRÜNDUNG:** Unveränderliche Bindung schlägt Neubewertung; der leere Commit ist zugleich der sichtbare Startpunkt des Runs im Log.
- **KONSEQUENZ:** Rollenvorlage Developer (§6 Schritt 7); Gate-Codes `RECEIPT_MISSING`, `RECEIPT_INVALID`, `RECEIPT_MISMATCH`, `RECEIPT_DUPLICATE`, `RECEIPT_NOT_FIRST`.

### W-30 Geschützte Pfade: Wurzel-Präfix vs. Basename (PAC PA-80)

- **KONFLIKT:** HP K-01: Liste gilt für Repo-Wurzel-Pfade (außer `__snapshots__`, `*.snap`, `node_modules/`); V1-DRAFT/PKG §8: Basenames `package.json`, `package-lock.json`, `tsconfig*.json`, `vitest.config.*`, `vite.config.*`, `.npmrc`, `.gitattributes`, `.gitmodules` auf **jeder** Ebene (Stufe `always`), dazu `forge/`, `.github/`, `src/forge*`, `tests/forge*`, `scripts/` (Stufe `forge`).
- **ENTSCHEIDUNG:** Die **PKG-/V1-DRAFT-Semantik** ist verbindlich (Stufe `always` als Basename-Regel auf jeder Ebene, Stufe `forge` als Wurzel-Präfix, casefold-normalisiert). Der Kern (CORE-0002) übernimmt dieselbe Liste als `isProtectedPath` mit identischer Semantik und wird im Verifier-Test gegen die Verifier-Liste differenziell geprüft (eine Quelle, zwei Konsumenten).
- **BEGRÜNDUNG:** Nicht-Determinismus zwischen zwei Spezifikationen ist selbst der Fehler (PA-80); die strengere Regel kostet nichts, weil verschachtelte `package.json` in diesem Repo nicht vorkommen.
- **KONSEQUENZ:** HP K-01 Pfadliste ist durch PKG §8 ersetzt; V1-DRAFT bleibt gültig.

### W-31 Unqualifizierte Refs und Tags (PAC PA-06)

- **KONFLIKT:** CSV2 §4 und DRILL §7.6 verwenden `main` unqualifiziert; ein Tag namens `main` macht `git rev-parse main` mehrdeutig; kein Tag-Ruleset vorgesehen.
- **ENTSCHEIDUNG:** Alle Git-Abfragen in Gate und Verifier verwenden ausschließlich `refs/heads/main`, `refs/pull/<N>/head` und `<sha>^{commit}`; Tags sind in V0.1 **vollständig verboten** (Ruleset `forge-no-tags`: Restrict creations/updates/deletions auf `refs/tags/**`, keine Bypass-Liste). Releases werden nicht benutzt.
- **BEGRÜNDUNG:** Forge braucht keine Tags; ein Verbot ist billiger als eine Mehrdeutigkeitsbehandlung.
- **KONSEQUENZ:** §9; VERIFIER-0002 Testfall „Tag `main` existiert“ (synthetisch im Wegwerf-Repo).

### W-32 `pull_request_review` als Verifier-Trigger (neuer Befund dieses Berichts)

- **KONFLIKT:** PKG §3/§11.3 und W-08 (oben) sehen neben `pull_request_target` den Trigger `pull_request_review` vor, damit der Gate nach einer Attestation neu bewertet. Die GitHub-Dokumentation (Quelltext `events-that-trigger-workflows.md`, Tabelle zu `pull_request_review`) legt für dieses Event `GITHUB_SHA` = „Last merge commit on the `GITHUB_REF` branch“ und `GITHUB_REF` = `refs/pull/<N>/merge` fest; nur `pull_request_target` „runs in the context of the default branch of the base repository“ [DOC]. Ein `pull_request_review`-Lauf nimmt die Workflow-Datei also aus dem **Merge-Commit des PRs**, d. h. aus Prüflingscode.
- **OPTIONEN:** (a) `pull_request_review` behalten und `.github/**` als Stufe `always` schützen; (b) `pull_request_review` streichen, Neubewertung nach Attestation durch „Re-run all jobs“ (gleiche Workflow-Datei aus `main`, gleicher `GITHUB_SHA`, `MAIN_MOVED`-Schutz) und bei bewegtem `main` durch eine Body-Änderung des PRs (`edited`-Event, frischer `pull_request_target`-Lauf); (c) Check-Runs per API aus einem `workflow_dispatch`-Lauf.
- **ENTSCHEIDUNG:** **(b).** Der Workflow hat genau einen Trigger-Block: `pull_request_target` mit `types: [opened, synchronize, reopened, edited, ready_for_review]`, dazu `workflow_dispatch` (nur Owner, nur für Smoke-Tests, erzeugt keine PR-Checks). Die Actions-Event-Policy S1 erlaubt genau diese Events für genau diese Datei; `pull_request_review`, `pull_request`, `push`, `issue_comment`, `workflow_run`, `merge_group` sind für alle Workflows verboten.
- **BEGRÜNDUNG:** (a) schützt nicht: Ein PR, der `.github/workflows/forge-verify.yml` ändert, ist zwar im regulären Gate rot, aber der manipulierte Workflow liefe beim nächsten Review-Event und könnte gleichnamige Check-Runs (`forge-gate`, `forge-verify`) aus derselben App-Quelle am Head-SHA erzeugen; bei Namensgleichheit zählt der jüngste Check-Run (PAC PA-33). (c) verlässt das Job-Status-Modell und erzeugt genau die Doppelquellen-Ambiguität, die PA-33 vermeiden will. (b) kostet den Owner einen Klick je Attestation.
- **KONSEQUENZ:** PKG §11.3 Trigger-Liste, W-08, MD-03 und MD-10 lauten entsprechend (ohne `pull_request_review`). §6 T-03/T-09 enthalten den Re-run-Schritt; §7.2 den Trigger-Block; §9.4 die S1-Policy; §7.10 den Spike „Re-run eines `pull_request_target`-Laufs behält Workflow-Datei und `GITHUB_SHA`“.

### Zusammenfassung der ersetzten Aussagen

| Ersetzt | Durch |
|---|---|
| HP D-2, D-12, D-14, D-5 (allein), O-01 Ruleset-Details („Squash“, „Approvals 1“, „Code Owners“, `FORGE_HALT`-Variable), K-03, K-04 (Ausführung), P-04 (Workflow) | W-01, W-03, W-18, W-07, W-27, W-21, W-12, W-13, W-19 |
| VD §4.5 (C first-parent), C8, AC-22, S10, AC-38 | W-02, W-01, W-21 |
| IGP §6–§9 Ruleset-Details, vier Checks, Blocknamen, `forge/spec/**`, Owner-Fragen 3–5 | W-27, W-18, W-23, W-22, W-26 |
| CSV2 OD-A…OD-L (siehe §5.1), `reads` optional | §5, W-17 |
| PKG OD-1…OD-12 (siehe §5.2/§7.10), PKG-Trigger `pull_request_review` | W-28, W-25, W-27, §7, W-32 |
| DRILL A-1…A-8, N-5…N-8 | W-18, W-22, W-02, W-13, W-30, W-23, W-21, W-19, W-29 |
| RR Lease, Reconciler, NH-Katalog, `run:<task>-v<v>-a<n>` | W-05, W-04, §11 |
| CHA B3 (Start vom Contract-Commit), Handoff v1, Receipt v1 | W-03, W-23 |
| AVD/ROAD/VS2/SOLV Format-1-Annahmen, Legacy-Platzhalter, VS-Parallelität | W-14, W-15, W-20 |

---
## 2. Final V0.1 Scope

Kriterium für MUST (aus HP §2, verschärft): Ohne den Punkt kann entweder (a) ein einzelner Akteur falsche Arbeit nach `main` bringen, ohne zu täuschen, oder (b) der Drill prüft eine andere Pipeline als der produktive Run, oder (c) der Verifier startet nicht (PA-30). Alles andere ist V0.2 oder DEFERRED, auch wenn es irgendwo „HOCH“ heißt.

### 2.1 MUST BEFORE FIRST DRILL (MD-01…MD-14)

| ID | Inhalt | Liefert | Quelle |
|---|---|---|---|
| MD-01 | Org-/Repo-Einstellungen: Base Permission „No permission“, Repo-Erstellung für Member aus, 2FA-Pflicht, Classic PATs gesperrt, fine-grained PATs nur mit Genehmigung, App-Installation nur Owner, Merge-Methode **nur Merge Commit**, PR-Erstellung „Collaborators only“, Fork-Workflows nur mit Approval, Actions-Default-Token „Read“, „Actions darf PRs erstellen/approven“ **aus**, Merge Queue aus, keine Repo-Secrets | FORGE-OPS-0001 (Owner) | OMD §8 Schritte 2–4, PKG OD-12, PAC PA-40/41/98 |
| MD-02 | Team `forge-dev-codex` = {`forge-codex`} mit Write; Git-Identität von Codex auf noreply-Adresse; Audit-Log-Beleg des Spikes in `forge/ops/IDENTITY-SPIKE.md`; PR #2 geschlossen | FORGE-OPS-0001 | W-28, OE-5 |
| MD-03 | Actions-Event-Policy (S1): nur `forge-verify.yml` auf `pull_request_target` (fünf Typen, W-32), `workflow_dispatch` nur Owner, alles andere verboten; Negativ- und Positivtest in `forge/ops/S1-RESULT.md` | FORGE-OPS-0001 | W-25, PA-30/31/33 |
| MD-04 | Rulesets `forge-main`, `forge-main-merge`, `forge-all-branches`, `forge-run-codex`, `forge-run-claude`, `forge-contract`, `forge-owner`, `forge-no-stray-branches`, `forge-no-tags`, `forge-halt` (disabled) nach §9; Required Checks erst nach dem ersten grünen Lauf eintragen; Export der Konfiguration in `forge/ops/RULESETS.md`; Negativ-Drills (Owner-Push auf `main`, Codex-Push auf `forge/run/claude/x`, Force-Push, Tag, Branch außerhalb der Namensräume) | FORGE-OPS-0001 | §9, PA-01…PA-10 |
| MD-05 | Hygiene-Dateien per Owner-PR: `.gitattributes` (`* text=auto eol=lf`), `.nvmrc` (`22`), `.github/CODEOWNERS` (Datei, ohne Ruleset-Zwang), `forge/policy.json` v1 (§3.4), `forge/roles/{spec-author,architecture-reviewer,developer,code-reviewer,handoff}.md`, Löschung `forge/coordination/CLAUDE.md` und `CODEX.md`, Ergänzung eines Absatzes in `forge/BASELINE-STATUS.md` (W-04) | FORGE-OPS-0001 | HP O-01, W-11 |
| MD-06 | Verifier Teil 1: `src/forge-verifier/` Diff- und Pfadautorität (V1-DRAFT, Format 1, Hash `341ec983…`) | FORGE-VERIFIER-0001 | PKG §11.1 |
| MD-07 | Kern Format 2: `specifiedAgainst`, `reads`, `mutants`, `limits`, `findings`, `supersedes`, `title`, End-Marker, Pflichtabschnitte, Wegfall der Koordinations-Ausnahme, `isProtectedPath` (PKG-Semantik), ASCII-Regel für Check-Kommandos, `runBase` im Start-Gate, `DeveloperReport` ohne Mutationen | FORGE-CORE-0002 | W-03, W-11, W-13, W-14, W-17, W-30 |
| MD-08 | Verifier Teil 2: Checkout-Autorität, Contract-Bindung an `runBase`, Registrierungs-Merge-Invarianten (commitweiser Walk), `BASE_NOT_ON_MAIN`, `SPEC_STALE`, `MAIN_MOVED`, Quittung aus Commit-Message, Run-Nummer, Single Lane, Identitäts-E-Mail-Prüfung, Limits | FORGE-VERIFIER-0002 | PKG §11.2 + W-03/W-16/W-17/W-19/W-20/W-28/W-29, PA-35/72 |
| MD-09 | Plattform-Blockparser und Policy: `forge/policy.json`-Schema (User-IDs), Parser für `FORGE REVIEW v1`, `FORGE ATTEST v1`, `FORGE FINDINGS v1`, `FORGE READ RECEIPT v2`; Review-Prüfung (Head, Hash, Attest-Hash, Provider-Unabhängigkeit, Owner-Modus COMMENTED), Findings-Vollständigkeit über die PR-Historie; nur lesender GitHub-API-Client | FORGE-PLAT-0001 | CSV2 §11.2, W-07, W-10, W-27 |
| MD-10 | Verifier Teil 3: Materialisierung aus Blobs, Container ohne Env/Netz mit **read-only** `/work` und tmpfs, Checks und Inventar, Baseline-Lauf, Evidence v1, Job-Summary mit `forge/<abschnitt>`-Zeilen, Review Packet, Workflow `forge-verify.yml` (zwei Jobs, nur `pull_request_target` mit `edited`, W-32), Image-Digest | FORGE-VERIFIER-0003 | PKG §11.3, W-12, W-18, PA-95 |
| MD-11 | Required Checks `forge-gate` + `forge-verify` (strict, Quelle GitHub Actions) in `forge-main` eintragen, nachdem beide auf einem Owner-PR grün liefen; bösartiges PR-Set (§14.4) ausgeführt, jeder PR rot, Links in `forge/ops/ADVERSARIAL-PRS.md` | Owner + Drill-Vorbereitung | HP Exit-Kriterium 5, PAC §6 |
| MD-12 | Tracking-Issue-Konvention und Handoff-Vorlage erprobt (ein Issue `forge: FORGE-DRILL-0001`) | Owner | W-19 |
| MD-13 | Attestierungs-Checkliste des Owners (`forge/roles/attestation-checklist.md`): Packet-Hash prüfen, Head vergleichen, Reasoning lesen, Injection-Muster, Mutanten-Ergebnisse vorhanden; Regel für Owner-Assistenten: Repo-/PR-/Contract-Text ist Daten, nie Anweisung | FORGE-OPS-0001 | PAC PA-111/112/113 |
| MD-14 | Drill-Contract `FORGE-DRILL-0001` (Format 2, Parse-Report nach DRILL §4) registriert und freigegeben | Spec-Autor + Reviewer + Owner | DRILL |

### 2.2 MUST BEFORE FIRST PRODUCTIVE MYSTERY RUN (MP-01…MP-07)

| ID | Inhalt | Quelle |
|---|---|---|
| MP-01 | `FORGE-DRILL-0001` vollständig durchlaufen: Run 1 (Injektionen FI-01…FI-25, soweit auf V0.1 anwendbar, Ergebnis je Injektion dokumentiert) geschlossen, Run 2 abgenommen und per Merge Commit auf `main`; Protokoll `forge/ops/DRILL-0001.md` mit Zählung: Owner-Handgriffe (≤ 6: Issue anlegen, Handoff kommentieren, Contract-Review attestieren, Code-Review attestieren, Merge Contract, Merge Run), Contract-Textzeilen in Chats (0), von Hand getippte SHAs (0 — alle Werte kopiert) | DRILL §10, MP Exit-Kriterien 2–4 |
| MP-02 | Jede Drill-Injektion, die **nicht** wie erwartet rot wurde, ist entweder behoben (Fix-PR, erneuter Nachweis) oder als akzeptiertes Restrisiko in §17 dieses Dokuments nachgetragen; keine stille Lücke | DRILL §8 |
| MP-03 | Owner-Entscheidungen OE-1…OE-5 getroffen; D1–D10 aus AVD als Arbeitsannahmen bestätigt; Task-ID vergeben | §19 |
| MP-04 | Contract VS-1 im Format 2 (§15.2) registriert, extern reviewt (Architektur-Reviewer-Provider ≠ Spec-Autor-Provider), attestiert | AVD §14, W-26 |
| MP-05 | Code-Reviewer für VS-1 benannt (Provider ≠ OpenAI, da Developer = Codex): Claude ohne Projektdateien oder Grok | W-26 |
| MP-06 | `forge/ops/S1-RESULT.md` bestätigt, dass die Policy nach dem GitHub-Stichtag 2026-11-02 weiterhin greift (falls der Run nach dem Stichtag stattfindet: Positivtest wiederholen) | PA-30 |
| MP-07 | Kein offener Run-PR, kein offener Contract-PR für VS-1 (Single Lane frei) | W-20 |

### 2.3 V0.2 (nach dem ersten produktiven Merge; auslöser-gebunden)

| ID | Inhalt | Auslöser |
|---|---|---|
| V2-01 | FORGE-VERIFIER-0004: Mutantenlauf im Verifier (in-memory, Kontroll-Mutant mit Pflicht-`detected:false`, Phasenisolation), `MUTATION_SURVIVED` mechanisch | erster Run, in dem der Reviewer Mutanten nicht vollständig repliziert hat, spätestens VS-3 |
| V2-02 | Parallele Runs: Scope-Lease über offene Run-PRs, Pfadklassen `shared`/`protected`, `maxActiveRuns` > 1, RECONCILE-auto mit `merge-tree`-Regel | zweiter Developer oder zwei gleichzeitig startbare Contracts mit disjunktem Scope |
| V2-03 | Status-Projektion (`forge status` als Workflow-Kommentar oder angeheftetes Issue) | mehr als drei offene Tasks |
| V2-04 | Claude als Developer (`forge-claude`, Stufe B) mit eigenem Namensraum und Team | OE-4 |
| V2-05 | Eventlog als abgeleitete Projektion aus GitHub (JSONL in Git, `seq`/`eventId`/`prevHash`), Kernel-Replay über echte Historie | erster Fakt außerhalb von GitHub (Kosten, Leases) oder Auditbedarf |
| V2-06 | Lease/Ablauf für verwaiste Run-PRs per Schedule-Workflow | erster Run-PR > 7 Tage ohne Push |
| V2-07 | Owner-Kommandos (`/forge reviewer`, `/forge halt`) | Handy-Bedienung erfordert es |
| V2-08 | Testinventar je Datei gegen Baseline (statt Summen) | erster Run, der bestehende Testdateien modifiziert |
| V2-09 | Signierte Commits für `forge-codex` | sobald Codex Cloud signieren kann |
| V2-10 | `protectedPathOverrides` im Contract für Forge-Kern-Tasks nach Bootstrap | erster Kern-Task nach V0.1-Exit |

### 2.4 DEFERRED (nicht ohne nachgewiesenen Bedarf)

PWA, Backend, Postgres, Queue, SSE, eigener Cloud-Runner, Agentenstart per Dispatch (MP §9, DA §20); Reconciler, NEEDS_HUMAN-Katalog, Retry-Budgets, Idempotenzschlüssel, Salvage (RR §3–§4, §8; HP D-03); Budgets/Kostenzählung/LLM-Gateway (HP D-04); eigenes Forge-Repository (HP D-06); Merge Queue (HP D-07, PA-41); Fork-Netzwerk (HP D-08); Performance/RT-12…14 (HP D-09); Mehrfach-Reviews, Quoren, LLM als Verifier (HP D-10); Egress-Sperre über `--network none` hinaus (HP D-11); DB-Migrationen, generierte Dateien (HP D-12); automatisches Contract-Rebase (HP D-13); Signaturen/PKI/Merkle (DA §20 Nr. 6); YAML-Parser für Legacy (CHA §11); Metadata-Rulesets (Team-Plan).

### 2.5 Was aus HP/MP bewusst **nicht** mehr V0.1 ist

| HP/MP-Item | Status hier | Grund |
|---|---|---|
| HP K-01 als eigener Task | in CORE-0002 und VERIFIER-0001 aufgegangen | eine Pfadliste, zwei Konsumenten (W-30) |
| HP K-02 (Pfad-/Ref-/Text-Primitive im Kern) | nur ASCII-Kommandos und `RefName`-Vollqualifikation in CORE-0002; Rest im Verifier (VERIFIER-0001 Pfadregeln) | der Kern verarbeitet in V0.1 keine Live-Refs |
| HP K-03 Evidence v3 | entfällt (W-12) | ein Evidence-Format |
| HP K-05 Owner-/Rollen-/Linearitätsregeln im Kern | Linearität/Isolation im Gate (VERIFIER-0002); `OWNER_NOT_HUMAN` für alle Owner-Events in CORE-0002 (eine Zeile, RT IMPORTANT 8); Rest V2-05 | ohne Log keine Kern-Events |
| HP P-01 Git-Snapshot | = VERIFIER-0002 `git.ts` | gleiche Idee, Verifier-Schnitt |
| HP P-02 Policy + API-Client | = FORGE-PLAT-0001 | — |
| HP P-03/P-05 Contract-/Run-Gate | = VERIFIER-0002 + PLAT-0001, Check `forge-gate` | W-18 |
| HP P-04 Handoff-Workflow | entfällt; Vorlagen + Owner-Kommentar (W-19) | kein schreibender Workflow |
| HP P-06 Verifier | = VERIFIER-0003 (Mutanten V2-01) | W-13 |
| HP O-02 Spike | reduziert auf §7.10 Restpunkte; der Rest ist durch PKG Anhang B (Doku) belegt | — |
| MP Exit-Kriterium 8 (Budget sichtbar) | DEFERRED | keine Kostendaten |
| DA Exit-Kriterium 2 (Replay eines echten Logs) | V2-05 | kein Log in V0.1 |

---
## 3. Final Repository Model

### 3.1 Ein Repository, ein `main`, drei Branch-Namensräume

- **Ein Repository.** `Forge-Dice/Forge` (Repo-ID `1401864629`) enthält Forge-Kern, Verifier, Plattformcode, Policy, Contracts **und** den Mystery-Produktcode. Ein eigenes Forge-Repository (HP D-06) bleibt DEFERRED: Die Pfadstufen `always`/`forge` (W-30) und der eine Verifier-Workflow setzen voraus, dass Prüfer und Prüfling im selben Baum liegen; eine Trennung würde Cross-Repo-Vertrauen (Checkout eines zweiten Repos im Verifier, zweite Token-Grenze) einführen, für das es in V0.1 keinen Bedarf gibt.
- **Ein `main`.** `refs/heads/main` ist der einzige langlebige Branch und die einzige Wahrheit (W-04). Es gibt keine `develop`-, `release`- oder Integrationsbranches. Jeder andere Branch ist ein PR-Branch in genau einem der drei Namensräume aus W-22; alle übrigen Branch-Namen sind per Ruleset gesperrt (§9.1 Nr. 8). Die fünf heute existierenden Legacy-Branches (`claude/forge-architecture-review-hjdq89`, `codex/forge-core-v2-repair`, `codex/mystery-task-0005`, `codex/task-0004-contract`, `forge/run/codex/IDENTITY-SPIKE-1`) bleiben als eingefrorene Geschichte stehen (§13); sie sind weder lösch- noch aktualisierbar.
- **Keine Tags, keine Releases, keine Forks, keine Merge Queue, keine Submodule, keine Symlinks, keine Binärdateien, keine Nicht-ASCII-Pfade** (PKG §7, W-31). Jede dieser Eigenschaften wird vom Verifier am gesamten Head-Tree geprüft, nicht nur am Diff (`TREE_RULE_VIOLATION`).

### 3.2 Was wo liegt

| Pfad auf `main` | Inhalt | Wird geändert durch | Schutzstufe (Verifier) |
|---|---|---|---|
| `.github/workflows/forge-verify.yml` | der einzige Workflow (zwei Jobs `forge-gate`, `forge-verify`) | FORGE-VERIFIER-0003 (Run-PR mit exaktem Scope, PKG OD-4), danach nur Owner-PR | `forge` |
| `.github/CODEOWNERS` | `* @Wuerfelduell` (automatische Review-Anfrage, **ohne** Ruleset-Zwang, W-27) | Owner-PR | `forge` |
| `.gitattributes`, `.nvmrc` | `* text=auto eol=lf`; `22` | Owner-PR (FORGE-OPS-0001) | `always` (Basename-Regel) |
| `package.json`, `package-lock.json`, `tsconfig*.json`, `vitest.config.*`, `vite.config.*`, `.npmrc` | Werkzeugkette | Owner-PR | `always` (auf jeder Ebene) |
| `forge/contracts/<TASK>.md` | genau eine Datei je Task, Versionen = Registrierungs-Merges (W-14) | Contract-PR (`forge/contract/<TASK>-v<N>`), nie Run-PR | `always` |
| `forge/policy.json` | Identitäten (User-IDs), Rollen, Provider, Namensräume, Check-Allowlist, Limits, Legacy-Anker (§3.4) | Owner-PR | `forge` |
| `forge/roles/*.md` | Rollenvorlagen: `spec-author.md`, `architecture-reviewer.md`, `developer.md`, `code-reviewer.md`, `handoff.md`, `attestation-checklist.md` | Owner-PR | `forge` |
| `forge/ops/*.md` | Owner-Nachweise: `IDENTITY-SPIKE.md`, `S1-RESULT.md`, `RULESETS.md`, `ADVERSARIAL-PRS.md`, `DRILL-0001.md`, `ARCHITECTURE-FREEZE-V0.1.md` (Kopie dieses Dokuments, §20) | Owner-PR | `forge` |
| `forge/verifier/image.json` | Container-Image-Digest des Verifiers (PKG OD-7) | FORGE-VERIFIER-0003, danach Owner-PR | `forge` |
| `forge/approvals/**`, `forge/reviews/**` | **eingefroren** (Legacy, W-24); neue Freigaben und Reviews existieren nur als GitHub-Reviews | niemand (Löschung in V0.2 möglich) | `always` |
| `forge/coordination/**` | wird in FORGE-OPS-0001 gelöscht (W-11); Historie bleibt | Owner-PR (einmalig) | `forge` |
| `forge/BASELINE-STATUS.md` | Legacy-Statusdokument plus ein Absatz (W-04) | Owner-PR (einmalig) | `forge` |
| `src/forge/**`, `tests/forge/**` | Forge-Kern als Bibliothek (Parser, Hash, Schema Format 1+2, Scope-Urteil, synthetischer Replay) | FORGE-CORE-000x (Run-PR mit exaktem Scope) | `forge` |
| `src/forge-verifier/**`, `tests/forge-verifier/**` | Pfad-/Diff-Autorität, Git-Fakten, Gate-Regeln, Sandbox, Evidence, Packet | FORGE-VERIFIER-000x | `forge` |
| `src/forge-platform/**`, `tests/forge-platform/**` | Policy-Schema, Blockparser (§5.9), Review-/Findings-Prüfung, lesender GitHub-API-Client | FORGE-PLAT-000x | `forge` |
| `scripts/**` | reserviert für Forge-Werkzeuge (heute leer) | FORGE-Tasks | `forge` |
| `src/domain/**`, `src/**` (übrige), `tests/**` (übrige) | Mystery-Produktcode und Tests | Produkt-Tasks (`TASK-xxxx`) per Run-PR | frei innerhalb `scope` |
| `*.snap`, `__snapshots__/**` | verboten (PKG OD-9) | — | `always` |

Regeln dazu:

1. **Stufe `always`** darf kein Run-PR ändern, auch kein `FORGE-`-Task (`PROTECTED_PATH_CHANGED`). Änderungen laufen als Owner-PR.
2. **Stufe `forge`** dürfen nur Tasks mit Präfix `FORGE-` ändern, und nur Pfade, die **exakt** in `scope.create`/`scope.modify` stehen (PKG OD-4 (a)); ein Produkt-Task mit `src/forge/x.ts` im Scope ist bereits am Contract-PR rot (`SCOPE_PROTECTED_FOR_TASK_CLASS`).
3. Der Verifier liest seine Werkzeuge (Workflow, `src/forge-verifier`, `src/forge-platform`, `src/forge`, `forge/policy.json`) **ausschließlich aus `main`**, nie aus dem PR (`pull_request_target`, W-08). Dass ein `FORGE-VERIFIER-`-Run den Verifier selbst ändern darf, ist deshalb ungefährlich: Die Änderung wirkt erst nach dem Abnahme-Merge, und der Merge setzt ein attestiertes Review voraus.
4. Wie die TypeScript-Werkzeuge auf dem Runner ausgeführt werden (Build nach `dist/` im Workflow oder Type-Stripping des gepinnten Node), entscheidet FORGE-VERIFIER-0003; verbindlich ist nur: kein Prüflingscode läuft auf dem Runner, nur im Container (PKG §3).

### 3.3 Branch-Namensräume (bindend, W-22)

| Namensraum | Zweck | Erzeugen/Aktualisieren dürfen | Force-Push | Löschen | Ziel-PR |
|---|---|---|---|---|---|
| `refs/heads/main` | Wahrheit | niemand direkt; Aktualisierung nur durch Merge eines PRs durch den Owner (`forge-main-merge`) | nein | nein | — |
| `forge/run/codex/<TASK>-<n>` | Run von `forge-codex`; `n` = laufende Nummer je Task ab 1 | Team `forge-dev-codex` | nein | nein | → `main` |
| `forge/run/claude/**` | reserviert (Stufe B, OE-4) | niemand | nein | nein | — |
| `forge/contract/<TASK>-v<N>` | Contract-PR; genau ein Commit `C` | `forge-codex`, Owner | **ja** (Zusammenfassen auf einen Commit, Rebase auf `main`) | nein | → `main` |
| `forge/owner/<thema>` | Owner-PRs (Hygiene, Policy, Rollen, Ops-Nachweise, Workflow-Pflege) | Owner | ja | nein | → `main` |
| alles andere | verboten | niemand (bestehende Legacy-Branches eingefroren) | nein | nein | — |

`<TASK>` erfüllt `TaskIdSchema` (`/^[A-Z][A-Z0-9]*(-[A-Z0-9]+)+$/`, max. 64) [CODE]; `<n>` und `<N>` sind Dezimalzahlen ohne führende Null; `<thema>` ist `[a-z0-9-]{1,40}`. Der Gate prüft Branch-Name gegen PR-Typ, Autor und Contract (`BRANCH_PATTERN_INVALID`, `BRANCH_AGENT_MISMATCH`, `BRANCH_TASK_MISMATCH`).

### 3.4 `forge/policy.json` v1

Die Policy ist die einzige Konfigurationsdatei von Forge. Sie wird vom Gate **aus `main`** gelesen; ein Owner-PR, der die Policy ändert, wird noch mit der alten Policy geprüft (Bootstrap-Eigenschaft, gewollt). Identitäten stehen als **User-IDs** (PAC PA-116); Logins sind Anzeige.

```json
{
  "forgePolicyFormat": 1,
  "repository": { "id": 1401864629, "fullName": "Forge-Dice/Forge", "defaultBranch": "refs/heads/main" },
  "owner": { "id": 315180734, "login": "Wuerfelduell" },
  "developers": [
    {
      "id": 337272506, "login": "forge-codex", "name": "codex", "provider": "openai",
      "team": "forge-dev-codex", "runNamespace": "forge/run/codex/",
      "commitEmails": ["337272506+forge-codex@users.noreply.github.com"]
    }
  ],
  "reviewers": [
    { "name": "chatgpt", "provider": "openai" },
    { "name": "claude",  "provider": "anthropic" },
    { "name": "grok",    "provider": "xai" }
  ],
  "specAuthorIds": [315180734, 337272506],
  "checks": { "typecheck": "npm run typecheck", "test": "npm test" },
  "limits": { "defaultMaxProductionLines": 400, "defaultMaxChangedFiles": 20, "policyMaxProductionLines": 550, "policyMaxChangedFiles": 30 },
  "maxOpenRunPRs": 1,
  "bootstrapFormat1TaskIds": ["FORGE-VERIFIER-0001", "FORGE-CORE-0002", "FORGE-VERIFIER-0002"],
  "legacy": {
    "anchor": "3d7545d843883418348004e68717399a64da7a7d",
    "acceptedTaskIds": ["TASK-0001", "TASK-0002", "TASK-0003", "TASK-0004", "FORGE-CORE-0001A", "FORGE-CORE-0001A-PATCH-0001", "FORGE-CORE-0001B"]
  }
}
```

Festlegungen: `provider` des Owners ist implizit `human`. `TASK-0005` steht **nicht** unter `legacy.acceptedTaskIds` (nicht akzeptiert) und ist als Dependency erst referenzierbar, wenn seine v3 abgenommen ist (W-15). Das Schema (`PolicySchema`, strict) liegt in `src/forge-platform/policy.ts` (FORGE-PLAT-0001); jede unbekannte Eigenschaft ist ein Fehler.

### 3.5 Was im Repository ausdrücklich **nicht** liegt

Kein Eventlog, keine Approval- oder Review-Dateien für neue Tasks, keine Statusdateien, keine Handoff-Dateien, keine Secrets, keine Umgebungsvariablen für Forge, keine `.github/`-Dateien außer Workflow und CODEOWNERS, keine Submodule, keine generierten Dateien, kein zweites `package.json`.

### 3.6 Fakten und ihr Ort (die Wahrheitstabelle)

| Fakt | Ort | Leser |
|---|---|---|
| Contract-Text, Version, Hash | Blob an `C = M^2`; Versionszahl = Anzahl Registrierungs-Merges des Pfads auf der First-Parent-Kette von `main` | Gate, Reviewer, Developer |
| Architektur-Freigabe | GitHub-Review (`APPROVED`, bzw. `COMMENTED` bei Owner-Autorschaft) von `Wuerfelduell` auf dem Contract-PR mit `FORGE REVIEW v1` + `FORGE ATTEST v1` | Gate |
| Run gestartet | leerer erster Commit mit `FORGE READ RECEIPT v2` auf `forge/run/codex/<TASK>-<n>`; offener Draft-PR | Gate, Owner |
| Verifiziert | Check-Run `forge-verify` = `success` am Head-SHA; Evidence v1 als Actions-Artefakt | Owner, Reviewer (Packet) |
| Code-Freigabe | GitHub-Review `APPROVED` von `Wuerfelduell` am Head-SHA mit Blöcken | Gate |
| Abgenommen | Abnahme-Merge `A` auf `main` mit `A^2 = H` | Gate (für Dependencies: `acceptedCommit = A`), alle |
| Offene Findings | letzter `REQUEST_CHANGES`-Review des Vorgänger-PRs; Antwort im `FORGE FINDINGS v1`-Block des Nachfolger-PRs | Gate, Reviewer |
| Halt | Ruleset `forge-halt` aktiv | GitHub (Merge gesperrt), Owner |
| Identität | GitHub-Login/User-ID des PR-Autors, Pushers (Audit-Log), Review-Autors; Commit-E-Mails | Gate, Owner |

---

## 4. Final Identity Model

### 4.1 Grundsatz

Eine Identität ist in Forge V0.1 ein **GitHub-Konto** (User-ID) oder der **Actions-Bot**. Alles, was kein GitHub-Konto hat (Claude, ChatGPT, Grok), handelt in GitHub **nie selbst**; sein Urteil wird vom Owner attestiert und bleibt eine attestierte Behauptung (W-10). Der Kern-Begriff „selbst erklärte Identität“ (`AgentIdentity`) [CODE] hat in V0.1 keine Autorität; er wird vom Gate aus GitHub-Fakten befüllt.

### 4.2 Identitätsmatrix

| Akteur | GitHub-Identität | Repo-Berechtigung | Darf | Darf nicht | Wie Forge authentifiziert |
|---|---|---|---|---|---|
| **Human Owner (Seb)** | `Wuerfelduell`, User-ID `315180734`, Org Owner, Repo Admin; einziger Mensch | Admin; **kein** Bypass in `forge-main`, `forge-all-branches`, `forge-run-*`, `forge-no-tags`; Bypass (Rolle „Organization admin“) nur in `forge-main-merge`, `forge-contract`, `forge-owner` | Contract-PRs und Owner-PRs eröffnen (`forge/contract/**`, `forge/owner/**`); Reviews attestieren (APPROVED/REQUEST_CHANGES auf fremden PRs, COMMENTED auf eigenen); PRs mergen (einziger Merger); Tracking-Issues und Handoff-Kommentare schreiben; Run-PRs schließen; Rulesets, Actions-Policy, Teams verwalten; Workflow-Läufe neu starten; `forge-halt` aktivieren | auf `main` pushen; auf `forge/run/**` pushen oder Branches dort anlegen (`forge-run-codex` ohne Owner-Bypass; Gate `OWNER_ON_RUN_BRANCH`); Required Checks umgehen; eigene PRs approven (GitHub verbietet es); Freigaben als Datei schreiben; Rulesets „kurz lockern“ (jede Änderung steht im Org-Audit-Log und ist in `forge/ops/RULESETS.md` nachzutragen) | User-ID in `policy.owner`; Review-Autor-ID; Merge-Akteur (Audit-Log); Commit-E-Mail nur für Owner-PRs relevant (nicht geprüft) |
| **Owner-Connectoren** (Claude-, ChatGPT-Sessions mit Admin-Verbindung als `Wuerfelduell`; OMD B4, PAC PA-110) | dieselbe Identität wie der Owner (für GitHub ununterscheidbar) | wie Owner | lesen; Texte entwerfen, die der Owner selbst pusht | **jede** Schreibaktion in GitHub (Push, PR, Review, Merge, Kommentar, Settings); jede Attestation | nicht unterscheidbar — deshalb Prozessregel (Rollenvorlage `attestation-checklist.md`: Agenten mit Owner-Verbindung schreiben nicht) plus Gate-Regel `OWNER_ON_RUN_BRANCH`; Restrisiko in §17 (PA-110) |
| **Codex Developer** | `forge-codex`, User-ID `337272506`; Org-Member; Team `forge-dev-codex` | Write (über Team); Bypass in `forge-run-codex` und `forge-contract` (Team) | Branches `forge/run/codex/<TASK>-<n>` anlegen und pushen; Run-PRs (Draft → Ready) eröffnen; Contract-PRs auf `forge/contract/<TASK>-v<N>` eröffnen (Spec-Autor, W-26); PR-Body und Kommentare schreiben; Issues lesen | auf `main`, `forge/run/claude/**`, `forge/owner/**` oder sonstige Branches pushen; Tags; Force-Push auf Run-Branches; Reviews mit Wirkung (ein Review von `forge-codex` wird vom Gate ignoriert); Mergen (`forge-main-merge`); Rulesets, Actions-Variablen mit Wirkung (der Verifier liest keine), Secrets; Workflows außer `forge-verify.yml` ausführen (S1) | PR-Autor-ID == `developers[].id`; Branch-Namensraum == `runNamespace` (`BRANCH_AGENT_MISMATCH`); Autor-E-Mail jedes Commits in `runBase..H` ∈ `commitEmails`, Committer-E-Mail ∈ `commitEmails ∪ {noreply@github.com}` (Web-„Update branch“) (`COMMIT_IDENTITY_MISMATCH`); Pusher laut Org-Audit-Log (Owner-Stichprobe, nicht automatisiert) |
| **Claude** (Anthropic) | keine | keine | als Reviewer: Review Packet lesen, Head klonen (öffentliches Repo), Mutanten anwenden, `FORGE REVIEW v1`-Block erzeugen; Contract-Texte entwerfen (der Owner pusht sie); Architektur- und Code-Reviews für Codex-Runs (Provider ≠ OpenAI) | schreiben (Stufe A, OE-4); Attestieren; Reviews von Contracts, deren `Forge-Spec-Author` `claude` ist | `FORGE ATTEST v1 reviewer=claude` durch den Owner; `providers.claude = anthropic` in der Policy |
| **ChatGPT** (OpenAI) | keine | keine | als Architektur-Reviewer für Contracts, deren Spec-Autor nicht OpenAI ist (Owner- oder Claude-Entwürfe); Code-Review nur für Nicht-Codex-Runs (in V0.1: keine) | schreiben; Code-Review von Codex-Runs (`REVIEWER_NOT_INDEPENDENT`); Architektur-Review von Codex-Contracts | `FORGE ATTEST v1 reviewer=chatgpt`; `providers.chatgpt = openai` |
| **Grok** (xAI) | keine | keine | Architektur- und Code-Reviews wie Claude (Provider xAI) | schreiben | `FORGE ATTEST v1 reviewer=grok`; `providers.grok = xai` |
| **GitHub Actions (Verifier)** | `github-actions[bot]` mit `GITHUB_TOKEN` des Workflows aus `main` | `contents: read`, `pull-requests: read`, `checks: write` (implizit für den eigenen Check-Run); alles andere `none`; „Actions darf PRs erstellen/approven“ **aus** | Check-Runs `forge-gate`, `forge-verify` am PR-Head erzeugen; Evidence-Artefakt und Job-Summary schreiben; Prüflingscode im Container ausführen | pushen, kommentieren, reviewen, mergen, Issues schreiben, Secrets lesen (es gibt keine), Netz aus dem Container | Workflow-Quelle `main`; Check-Run-Quelle „GitHub Actions“ (Required-Check-Bindung an die App); S1 verhindert Gleichnamige aus PR-Workflows |
| **Alle anderen GitHub-Nutzer** | beliebig | keine (Org Base Permission „No permission“; PR-Erstellung „Collaborators only“) | lesen (öffentliches Repo) | Branches, PRs, Issues, Kommentare mit Wirkung | Gate ignoriert Reviews/Kommentare von Nicht-Policy-IDs (`REVIEW_AUTHOR_NOT_OWNER`) |

### 4.3 Unabhängigkeitsregeln (vom Gate geprüft)

1. **Code-Review:** `reviewer.provider ≠ developer.provider`. Für Codex-Runs sind damit Claude und Grok zulässig, ChatGPT nicht.
2. **Architektur-Review:** `reviewer.provider ≠ provider(Forge-Spec-Author)`. Der Spec-Autor steht als Kopfzeile `Forge-Spec-Author: <owner|codex|claude|chatgpt|grok>` im Body des Contract-PRs (§5.9.6); bei Autor `forge-codex` muss sie `codex` lauten (`SPEC_AUTHOR_MISMATCH`), bei Autor `Wuerfelduell` erklärt sie, welcher Assistent den Text entworfen hat (`owner` = selbst). Provider von `owner` ist `human`, also ist für Owner-Entwürfe jeder Reviewer zulässig.
3. **Attestierer** ist immer `Wuerfelduell` (`REVIEW_AUTHOR_NOT_OWNER`). Ein Review eines anderen Kontos hat keine Wirkung.
4. **Verifier ≠ Developer** ist strukturell (Workflow aus `main`, Token ohne Schreibrechte).
5. **Owner ≠ Developer** ist strukturell (kein Owner-Bypass auf Run-Branches) und wird am Run-PR geprüft (`OWNER_ON_RUN_BRANCH`: Autor oder ein Commit-Autor mit Owner-E-Mail).

### 4.4 Trust Boundary „Claude schreibt nicht“ (Stufe A)

Operativ bedeutet Stufe A: Keine Claude-Session pusht, eröffnet PRs, reviewt in GitHub oder merged — auch nicht über den Owner-Connector. Claude liefert Text (Contract-Entwürfe, Review-Blöcke, Berichte); der Owner liest und überträgt ihn. Dieses Dokument selbst ist nach dieser Regel entstanden (nichts im Repository verändert). Stufe B (`forge-claude` als zweite Developer-Identität mit eigenem Team und Namensraum `forge/run/claude/**`) ist in den Rulesets bereits vorbereitet (reservierter, gesperrter Namensraum) und wird nur durch OE-4 aktiviert.

### 4.5 Was bewusst nicht authentifiziert wird

- **Der Pusher eines Commits** ist für Forge nur über das Org-Audit-Log sichtbar; der Gate prüft Autor-/Committer-E-Mails (fälschbar, aber sichtbar). Signierte Commits sind V2-09.
- **Der tatsächliche Reviewer** hinter einer Attestation. Der Owner ist die Vertrauenswurzel; Packet-Hash, Head-Bindung, Pflichtfelder (Mutanten-Ergebnisse, Finding-IDs) und die Checkliste machen „ungelesen attestiert“ aufwendig, nicht unmöglich (§17, PA-111/113).
- **Der Owner selbst.** Es gibt genau einen Menschen; eine zweite menschliche Identität ist in V0.1 nicht verfügbar (W-27).

---
## 5. Contract System V2 Finalization

### 5.1 Entscheidungen zu CSV2 OD-A…OD-L

| OD | Frage | CSV2-Empfehlung | **Entscheidung** | Abweichung / Verweis |
|---|---|---|---|---|
| OD-A | Zeilenlimit hart oder weich? | hart | **hart** (`SIZE_EXCEEDED`), Policy-Deckel 550 (`LIMIT_ABOVE_POLICY`) | W-16 |
| OD-B | `SPEC_STALE`: Revision oder Owner-Waiver? | Revision | **Revision, kein Waiver** | W-17 |
| OD-C | TASK-0004 einfrieren oder retro-binden? | einfrieren (A) | **einfrieren**; TASK-0004 ist Legacy-akzeptiert mit Anker `3d7545d` | W-15, §13 |
| OD-D | TASK-0005 jetzt migrieren oder liegen lassen? | liegen lassen | **liegen lassen** bis VS-3; dann v3 mit `supersedes.format: "legacy"` | W-15 |
| OD-E | Legacy-Dependencies (`provenance: "legacy"`) erlauben? | erlauben | **erlauben**, aber nur für `policy.legacy.acceptedTaskIds` und nur mit `acceptedCommit = legacy.anchor` | §5.3 |
| OD-F | Wer zieht ein blockierendes Finding zurück? | nur der Reviewer | **nur der Reviewer** (`withdraw:` im eigenen späteren Block); Reviewer-Wechsel nur durch Owner-Kommentar `/forge reviewer code <name>` auf dem Tracking-Issue | W-07 |
| OD-G | Pflichtabschnitte ausreichend? | so lassen | **so lassen**, aber Überschriften fest in ASCII-Englisch (`## Acceptance Criteria`, `## Non-Goals`, `## Changes since v<n>`, `## Migration from Legacy`); Fließtext frei (Deutsch erlaubt) | Abweichung nur in der Schreibweise: ASCII-Überschriften machen den Lint trivial und umgehen Umlaut-Kodierungsfragen |
| OD-H | `reads` Pflicht oder optional? | optional + Lint | **Pflichtfeld** (leeres Array zulässig, muss aber ausdrücklich dastehen); `reads_reviewed: true` im Architektur-Review-Block | **Abweichung**, Begründung W-17 (PAC PA-77) |
| OD-I | Format 2 als neue Literal-Nummer? | Format 2 | **Format 2**, Hash-Domäne `forge-contract-v2\n` | §5.4 |
| OD-J | Darf der Developer Spec-Autor sein? | ja | **ja**; Unabhängigkeit liegt bei den Reviewern (Provider-Regeln §4.3) | W-26 |
| OD-K | Blocksprache | Feldnamen englisch, Freitext frei | **so** | §5.9 |
| OD-L | Erster Format-2-Contract, Reihenfolge CORE-0002 | CORE-0002 sofort | **CORE-0002 sofort** (Format 1, parallel zu VERIFIER-0001); erster Format-2-Contract ist der erste nach dem Abnahme-Merge von CORE-0002 registrierte (voraussichtlich FORGE-PLAT-0001 oder FORGE-VERIFIER-0002) | W-14, §16 |

### 5.2 Entscheidungen zu PKG OD-1…OD-12

| OD | Thema | **Entscheidung** |
|---|---|---|
| OD-1 | Identity-Spike PASS | PASS für Authentifizierung (Owner-Aussage); Audit-Log-Zitat und noreply-E-Mail sind MD-02 (W-28, OE-5) |
| OD-2 | Actions-Policy S1 | **Org-Ebene**, Negativ- und Positivtest in `forge/ops/S1-RESULT.md` (W-25) |
| OD-3 | Owner-PRs durch die Checks | **(a) Owner-Modus** = Branch-Namensraum `forge/owner/**`/`forge/contract/**` **und** Autor `Wuerfelduell`; kein Bypass, keine Checks-Pause (W-27) |
| OD-4 | Dürfen `FORGE-`-Tasks `.github/workflows/**` und `forge/verifier/**` per Scope ändern? | **(a) ja**, exakte Pfade (§3.2 Regel 2) |
| OD-5 | Format für FORGE-VERIFIER-0001 | **(a) Format 1 jetzt**; **keine** spätere metadata-only-Revision: akzeptierte Tasks sind eingefroren (§5.8 Nr. 6) |
| OD-6 | `mutationSmoke: "required"` ohne Verifier-Auswertung | **(a)**: reviewer-repliziert, Verifier meldet `not_evaluated_by_verifier` (W-13) |
| OD-7 | Container-Image | **(a)** `node:22.<x>-bookworm` per Digest, Digest in `forge/verifier/image.json` |
| OD-8 | Baseline-Lauf im zweiten Container | **behalten** (einzige developer-freie Quelle des Baseline-Inventars) |
| OD-9 | Geschützte Pfade | **so lassen** (PKG §8, W-30) |
| OD-10 | Architektur-Reviewer für VERIFIER-0001 | **OE-1**; Attestation als GitHub-Review, nicht als Approval-Datei (W-24) |
| OD-11 | Run-Benennung | Branch `forge/run/codex/FORGE-VERIFIER-0001-1`; Kern-Run-ID `run:forge-verifier-0001-1` nur intern im synthetischen Replay |
| OD-12 | Repo-/Org-Einstellungen aus OMD §8 | **vor dem ersten Run-PR** (MD-01) |

### 5.3 Frontmatter Format 2

Datei `forge/contracts/<TASK>.md`; Zeile 1 exakt `---json`, dann kanonisches JSON, dann eine Zeile `---`, dann der Body. Schema `ContractMetadataV2Schema` (zod `strictObject`, FORGE-CORE-0002):

| Feld | Typ / Regel | Prüfung (wo) |
|---|---|---|
| `forgeContractFormat` | Literal `2` | Parser |
| `taskId` | `TaskIdSchema` [CODE]; == Dateiname ohne `.md` | Parser, Gate (`CONTRACT_PATH_MISMATCH`) |
| `title` | String 1–120 Zeichen, keine Steuerzeichen; == Titel in der H1 des Bodys | Parser, Lint (`TITLE_MISMATCH`) |
| `contractVersion` | positive Ganzzahl; == `<N>` im Branch-Namen, im End-Marker und == Anzahl bisheriger Registrierungs-Merges + 1 | Parser, Gate (`CONTRACT_VERSION_NOT_NEXT`) |
| `specifiedAgainst` | 40 Hex (klein); Commit auf der First-Parent-Kette von `refs/heads/main` | Gate (`SPECIFIED_AGAINST_NOT_ON_MAIN`) |
| `supersedes` | `null` (nur bei `contractVersion: 1`) oder `{ contractVersion: N-1, contentHash: 64 Hex, blobSha: 40 Hex, format: 2 \| "legacy" }`; bei `format: 2` muss `blobSha` der Blob an `M_{N-1}^2` sein und `contentHash` dazu passen; bei `"legacy"` muss der Blob im Repository existieren (Legacy-Branch) | Gate (`SUPERSEDES_MISMATCH`, `SUPERSEDES_BLOB_UNKNOWN`) |
| `dependencies` | Array (max. 16) von `{ taskId, acceptedCommit: 40 Hex, provenance: "forge" \| "legacy" }`; **kein** `null` mehr; `forge` ⇒ `acceptedCommit` ist ein Abnahme-Merge `A` dieses Tasks auf `main`; `legacy` ⇒ `taskId ∈ policy.legacy.acceptedTaskIds` und `acceptedCommit == policy.legacy.anchor` | Gate (`DEPENDENCY_NOT_ACCEPTED`, `DEPENDENCY_NOT_IN_RUN_BASE`) |
| `reads` | Array (max. 64) von `RepoPath`, sortiert, eindeutig, **Pflichtfeld**; jede Datei existiert an `specifiedAgainst` | Parser, Gate (`READS_NOT_FOUND`) |
| `scope` | `{ create: RepoPath[], modify: RepoPath[] }`, disjunkt, sortiert, eindeutig, zusammen ≤ `limits.maxChangedFiles`; `modify` existiert an `specifiedAgainst`; `create` existiert nicht an `M^1` (Merge-Zeit) bzw. `runBase` (Run); kein Pfad der Stufe `always`; Stufe `forge` nur für `FORGE-`-Tasks | Parser, Gate (`CREATE_TARGET_EXISTS`, `SCOPE_PROTECTED`, `SCOPE_PROTECTED_FOR_TASK_CLASS`) |
| `requiredChecks` | Array von `{ name, command }`; `name ∈ policy.checks`, `command == policy.checks[name]`; **beide** Policy-Checks (`typecheck`, `test`) müssen vorkommen | Parser, Gate (`CHECK_NOT_ALLOWED`, `CHECK_SET_INCOMPLETE`) |
| `mutants` | Array 1–8 von `{ id: /^m[1-8]$/, file ∈ scope.create ∪ scope.modify, before: String 1–400, after: String 0–400 ≠ before, tests: RepoPath[] ≥ 1 }`; IDs eindeutig; für `file ∈ scope.modify` kommt `before` an `specifiedAgainst` genau einmal vor | Parser, Gate (`MUTANT_ANCHOR_AMBIGUOUS`); am Head: Code-Reviewer (V0.1), Verifier (V0.2, `MUTANT_NOT_APPLICABLE`) |
| `limits` | `{ maxProductionLines: 1…policyMaxProductionLines, maxChangedFiles: 1…policyMaxChangedFiles }` | Parser, Gate (`LIMIT_ABOVE_POLICY`) |
| `findings` | Array von `{ id: F-ID, status: "addressed" \| "withdrawn", note: String 1–400 }`; muss jede blockierende `contract_change`-ID aus dem jüngsten `REQUEST_CHANGES` auf dem Vorgänger-Contract-PR **und** dem jüngsten Run-PR der Vorgängerversion enthalten; `withdrawn` nur, wenn ein späterer Block desselben Reviewers die ID zurückzieht | Gate (`FINDINGS_NOT_CARRIED`, `WITHDRAW_NOT_AUTHOR`) |

Entfallen gegenüber Format 1: `baseCommit` (→ `specifiedAgainst`), `mutationSmoke` (→ `mutants`), `acceptedCommit: null`.

### 5.4 Kanonische Form und Hash

1. Der Dateiinhalt ist gültiges UTF-8 ohne BOM, ohne CR, ohne C0-Steuerzeichen außer `\n` und `\t`, ohne Bidi-Steuerzeichen (U+202A–U+202E, U+2066–U+2069) und ohne Zero-Width-Zeichen (U+200B–U+200F) im **gesamten** Text (Frontmatter und Body; DRT-28, ACV-26). Der Parser dekodiert mit `fatal: true`; damit sind Blob-Bytes und Text bijektiv (DRT-27).
2. Frontmatter: `JSON.stringify(raw, null, 2)` muss den Text byte-identisch reproduzieren (Format-1-Regel, unverändert) [CODE].
3. `contentHash := sha256("forge-contract-v2\n" ‖ bytes)` über die Blob-Bytes. Format 1 behält `forge-contract-v1\n`. Ein Format-2-Text kann damit nie denselben Hash wie ein Format-1-Text haben.
4. Überall, wo ein Contract zitiert wird (Review-Block, Quittung, Handoff, Evidence, Packet), stehen **beide** Identitäten: `contentHash` und `blobSha` (Git-Blob-SHA des Objekts an `C`). Divergieren sie, ist das ein Fehler (`CONTRACT_IDENTITY_MISMATCH`).

### 5.5 Body: Pflichtabschnitte und End-Marker

- Erste Body-Zeile: `# <TASK> v<N>: <title>`.
- Pflichtüberschriften (exakt, Ebene 2, Reihenfolge frei): `## Acceptance Criteria`, `## Non-Goals`; zusätzlich `## Changes since v<N-1>` wenn `contractVersion > 1`; `## Migration from Legacy` wenn `supersedes.format == "legacy"`. Weitere Abschnitte frei (`## Goal`, `## Design`, `## Test Matrix`, `## Mutants` als Prosa-Erklärung der Frontmatter-Mutanten).
- Verboten im Body: Statusaussagen (Zeilen, die mit `Status:`, `status:`, `Approved`, `Freigegeben`, `Review:` beginnen, und Überschriften, die `approved`/`freigegeben` enthalten; `STATUS_ASSERTION`); Zeitstempel in Überschriften; Chat-Links als Begründung (`laut Chat`, `siehe Thread`; `CHAT_REFERENCE`, Lint).
- Letzte Zeile exakt `<!-- END OF CONTRACT <TASK> v<N> -->`, gefolgt von genau einem `\n` (`END_MARKER_MISSING`, `END_MARKER_MISMATCH`). Der Marker gehört zum gehashten Text; ein abgeschnittener Contract hat damit einen anderen Hash **und** keinen Marker.

### 5.6 Begriffe (bindende Definitionen)

| Begriff | Definition |
|---|---|
| **`C` (Contract-Commit)** | `M^2`; genau ein Elternteil; `diff(C^1, C)` berührt genau `forge/contracts/<TASK>.md`. Hash-, Blob-, Review- und Quittungsbindung hängen an `C`. |
| **`M` (Registrierungs-Merge)** | jüngster First-Parent-Commit auf `refs/heads/main`, der den Pfad ändert; `M^1` = vorheriges `main`, `M^2 = C`, `tree(M) == tree(C)`, `C^1 == M^1` (W-01/W-02). Versionszahl = Anzahl solcher Merges für den Pfad. |
| **`specifiedAgainst`** | der `main`-Commit, gegen den Spec-Autor und Architektur-Reviewer gelesen haben; Teil des gehashten Textes; auf der First-Parent-Kette von `main`. |
| **`runBase`** | `merge-base(H, refs/heads/main)`; muss auf der First-Parent-Kette von `main` liegen; `M ⊑ runBase`, `specifiedAgainst ⊑ runBase`. Wird nie vom Developer genannt, immer berechnet. |
| **`reads`** | Dateien, die die Spezifikation voraussetzt, ohne sie zu ändern. Zusammen mit `scope` die Menge, deren Bewegung `SPEC_STALE` auslöst. |
| **`scope`** | `create` (darf am Ende neu existieren) und `modify` (darf geändert werden). Löschen und Umbenennen sind in V0.1 nie erlaubt [CODE]; `added ⊆ create`, `modified ⊆ modify`, `deleted = renamed = ∅`. |
| **`requiredChecks`** | genau die Policy-Checks mit gepinnten Kommandos; der Verifier führt sie im Container aus; Exit 0 und Inventar-Regel (§7.4) entscheiden. |
| **`limits`** | harte Obergrenzen: hinzugefügte Zeilen in Nicht-Testdateien (`git diff --numstat --no-renames runBase H`, Pfade außerhalb `tests/**`) und Anzahl geänderter Dateien (Listing-Differenz). |
| **`mutants`** | 1–8 textuelle Mutanten mit Anker; `killed` = mindestens einer der genannten Tests schlägt fehl, nachdem `before` durch `after` ersetzt wurde; `survived` = alle genannten Tests bestehen weiter. V0.1: vom Code-Reviewer am verifizierten Head ausgeführt und im Block gemeldet; `survived` ist blockierendes Finding. |
| **`findings` / Carry-Forward** | Jedes blockierende Finding trägt eine ID `F-<TASK>-<PR#>-<k>` und eine Auflösungsart. `code_change`-Findings wandern in den `FORGE FINDINGS v1`-Block des nächsten Run-PRs derselben Version; `contract_change`-Findings in `findings[]` der nächsten Version. Der Gate prüft Vollständigkeit, der zugewiesene Reviewer die Substanz (W-07). |
| **Revision** | neue Contract-Version = neuer Contract-PR `forge/contract/<TASK>-v<N+1>` mit `supersedes` auf v<N>. Frühere Freigaben verlieren mit `M_{N+1}` ihre Wirkung (`SUPERSEDED`, abgeleitet). |
| **`SPEC_STALE`** | `changedFiles(specifiedAgainst, X) ∩ (reads ∪ scope.create ∪ scope.modify) ≠ ∅` mit `X = M^1` (Contract-PR zur Merge-Zeit; praktisch: `refs/heads/main` zur Prüfzeit) bzw. `X = runBase` (Run-PR). Auflösung nur durch Revision mit neuem `specifiedAgainst`. |
| **Lesenachweis** | `FORGE READ RECEIPT v2` in der Commit-Message des **leeren ersten Commits** des Run-Branches (W-29); bindet `C`, `M`, `contentHash`, `blobSha`, `run`, den Start-`main`. |
| **Abnahme** | Merge Commit `A` auf `main` mit `A^2 = H` (verifizierter, reviewter Head), `tree(A) == tree(H)`; `acceptedCommit(TASK) := A`. |

### 5.7 Der Contract-PR im Gate (Check `forge-gate`, Abschnitte `forge/contract`, `forge/identity`, `forge/review`)

Reihenfolge der Prüfungen; der erste Fehler je Abschnitt wird gemeldet, alle Abschnitte werden ausgewertet:

1. **Branch und Autor:** Name `forge/contract/<TASK>-v<N>` (`BRANCH_PATTERN_INVALID`); Autor-ID ∈ `policy.specAuthorIds` (`AUTHOR_NOT_SPEC_AUTHOR`); Kopfzeile `Forge-Spec-Author:` genau einmal im PR-Body, bei Autor `forge-codex` == `codex` (`SPEC_AUTHOR_MISMATCH`).
2. **Isolation:** genau ein Commit im PR, `C^1 == refs/heads/main`-Spitze zur Prüfzeit (`CONTRACT_PR_NOT_SINGLE_COMMIT`, `CONTRACT_NOT_ON_MAIN_TIP`; letzteres macht GitHub mit „up to date“ zur Merge-Zeit ohnehin zur Pflicht); `git diff --raw --no-renames C^1 C` = genau eine Zeile `A`/`M` für `forge/contracts/<TASK>.md`, Modus `100644` (`CONTRACT_PR_NOT_ISOLATED`).
3. **Format:** Format 2, oder Format 1 genau dann, wenn `taskId ∈ policy.bootstrapFormat1TaskIds` (`FORMAT_NOT_CURRENT`); Parser-Fehlercodes des Kerns unverändert (`FRONTMATTER_MISSING`, `FRONTMATTER_NOT_CANONICAL`, `METADATA_SCHEMA`, `CARRIAGE_RETURN`, …) [CODE].
4. **Version und Kette:** `N` == Registrierungs-Merges + 1 (`CONTRACT_VERSION_NOT_NEXT`); `supersedes` passt zum Blob an `M_{N-1}^2` (`SUPERSEDES_MISMATCH`); Task nicht akzeptiert (`TASK_ACCEPTED_FROZEN`) und nicht in `policy.legacy.acceptedTaskIds` (`LEGACY_TASK_FROZEN`); für `TASK-0005`: `supersedes.format == "legacy"` und `## Migration from Legacy` vorhanden (`LEGACY_CONTRACT_HISTORY` sonst).
5. **Stand:** `specifiedAgainst` auf der First-Parent-Kette (`SPECIFIED_AGAINST_NOT_ON_MAIN`); `SPEC_STALE` gegen `refs/heads/main`; Existenzregeln `READS_NOT_FOUND`, `CREATE_TARGET_EXISTS`.
6. **Scope, Checks, Limits, Mutanten, Dependencies:** wie §5.3.
7. **Belegung:** kein offener Run-PR dieses Tasks (`RUN_ACTIVE`, RR F-17 als Prävention), kein zweiter offener Contract-PR dieses Tasks (`CONTRACT_PR_DUPLICATE`).
8. **Lint:** `STATUS_ASSERTION`, `CHAT_REFERENCE`, `TITLE_MISMATCH`, End-Marker.
9. **Review Packet:** Sind 1–8 fehlerfrei, schreibt der Gate das Packet (§7.6) in die Job-Summary: Repo-ID, PR, `C`, `blobSha`, `contentHash`, `specifiedAgainst`, `main`-Spitze, `Forge-Spec-Author`, Dependency-Liste, `packetHash`.
10. **Review und Attestation:** Es existiert ein Review von `Wuerfelduell` (State `APPROVED`; bei Autor `Wuerfelduell` State `COMMENTED`), dessen Body einen gültigen `FORGE REVIEW v1`-Block mit `kind: architecture` und eine gültige `FORGE ATTEST v1`-Zeile enthält; `blob` == Blob an `C`, `contract` == `<TASK> v<N> <contentHash>`, `packet` == aktueller `packetHash`, `reviewer.provider ≠ provider(Forge-Spec-Author)`, `reads_reviewed: true`, `verdict: approve` (`REVIEW_PENDING`, `REVIEW_BLOCK_MISMATCH`, `REVIEWER_NOT_INDEPENDENT`, `ATTEST_INVALID`, `REVIEW_CHANGES_REQUESTED`). **Bindung über den Blob, nicht über den Commit-SHA:** Ein Rebase des Contract-Branches auf ein bewegtes `main` (nötig wegen „up to date“ und Ein-Commit-Regel) ändert `C`, nicht den Blob; das Review bleibt gültig, solange Blob, `contentHash` und `packetHash` (der `C` nicht enthält) unverändert sind. Bewegt sich `main` an gelesenen Stellen, schlägt Nr. 5 `SPEC_STALE` an, und die nötige Änderung von `specifiedAgainst` erzeugt einen neuen Hash und damit ein neues Review — genau wie gewollt (W-17).

Abschnitt `forge/verify` (Check `forge-verify`) läuft für Contract-PRs unverändert wie für Run-PRs (Tree-Regeln, Checks, Inventar gegen Baseline): Einheitlichkeit schlägt Optimierung, und der Lauf kostet etwa eine Minute.

### 5.8 Revisionsregeln

1. Eine Revision ist immer ein neuer Contract-PR; Versionen entstehen nur durch Registrierungs-Merges (nie durch Pushes auf den Contract-Branch).
2. Keine Revision, solange ein Run-PR des Tasks offen ist (`RUN_ACTIVE`). Will der Spec-Autor trotzdem ändern, schließt der Owner zuerst den Run-PR (Run abgebrochen, §6).
3. `supersedes` verkettet jede Version mit der vorherigen über `contentHash` **und** `blobSha`; die Kette ist vom Gate vollständig nachrechenbar.
4. Jede Revision braucht ein neues Architektur-Review (CSV2 §4.4); es gibt keine „kleine“ Revision ohne Review. Der Reviewer sieht im Packet die Vorgängerversion und muss im Block alle offenen blockierenden IDs der Vorgängerversion behandeln (Gate: Vollständigkeit).
5. `changes_requested` auf einem Contract-PR: Der Autor ändert den Text, fasst auf einen Commit zusammen (Force-Push erlaubt), neuer Hash, neues Packet, neues Review; `findings[]` wird dabei **nicht** gefüllt (gleiche Version, noch nicht registriert); erst eine Revision einer registrierten Version trägt `findings[]`.
6. Nach der Abnahme (`A` auf `main`) ist ein Task **eingefroren**: keine weitere Version (`TASK_ACCEPTED_FROZEN`), analog `TASK_ALREADY_ACCEPTED` im Kern [CODE]. Folgearbeit ist ein neuer Task mit Dependency auf `A`. Ein Task-Name mit `-PATCH-` hat keine Sondersemantik (DRT-07); da jeder Run vom aktuellen `main` startet (W-03), läuft ein abhängiger Task ohnehin gegen den gepatchten Stand.
7. Eine registrierte, aber nie gelaufene Version kann durch eine Revision ersetzt werden; eine registrierte Version kann nicht gelöscht werden (Pfadregel, Historie).

### 5.9 Blockgrammatiken (bindend; Parser in `src/forge-platform/blocks.ts`)

Allgemeine Regeln: Ein Block ist ein Markdown-Fence mit Info-String `forge`; die erste Zeile im Fence ist die Kopfzeile `FORGE <NAME> v<n>`; danach Zeilen `key: value` (Schlüssel ASCII, Doppelpunkt-Leerzeichen, Wert bis Zeilenende, max. 500 Zeichen, kein Tab, keine Steuer-/Bidi-Zeichen); mehrwertige Schlüssel werden wiederholt; unbekannte Schlüssel, fehlende Pflichtschlüssel und doppelte einwertige Schlüssel sind Fehler; Reihenfolge frei; Leerzeilen verboten. Der **Blockhash** ist `sha256` über die Bytes von der Kopfzeile bis einschließlich der letzten Zeile im Fence (LF-normalisiert, ohne die Fence-Zeilen). Ausnahme: `FORGE READ RECEIPT v2` steht in einer Commit-Message ohne Fence (Subject = Kopfzeile, Leerzeile, dann `key: value`-Zeilen).

#### 5.9.1 `FORGE REVIEW v1` (im Body eines GitHub-Reviews von `Wuerfelduell`)

```forge
FORGE REVIEW v1
kind: architecture | code | owner
repo: 1401864629
pr: <PR-Nummer>
head: <40hex>                      # Run-/Owner-PR: Head-SHA; Contract-PR: C
blob: <40hex>                      # Blob-SHA der Contract-Datei (Contract-PR: an C; Run-PR: an runBase)
contract: <TASK> v<N> <64hex>      # contentHash; bei kind: owner entfällt die Zeile
packet: <64hex>                    # packetHash aus der Job-Summary
reviewer: chatgpt | claude | grok
verdict: approve | request_changes
reads_reviewed: true | false       # Pflicht bei kind: architecture
mutant: <id> killed | survived     # Pflicht bei kind: code, genau eine Zeile je Contract-Mutant
finding: <F-ID> blocking | note code_change | contract_change <Text>   # 0..n
withdraw: <F-ID> <Text>            # 0..n, nur IDs, die derselbe reviewer früher vergeben hat
summary: <Text>                    # genau eine Zeile
```

`F-ID` = `F-<TASK>-<PR#>-<k>`, `k` ab 1 je Review fortlaufend. `verdict: request_changes` erfordert ≥ 1 `finding … blocking`; `verdict: approve` erfordert 0 `finding … blocking` **und** `withdraw:` für jede im Vorgänger-PR als `disputed` gemeldete ID (`FINDINGS_OPEN`); jeder `mutant … survived` erfordert ein blockierendes Finding, das ihn nennt (`MUTANT_SURVIVED_UNADDRESSED`). GitHub-State und `verdict` müssen übereinstimmen (`APPROVED` ⇔ `approve`, `REQUEST_CHANGES` ⇔ `request_changes`; `COMMENTED` nur im Owner-Modus mit `approve`; `REVIEW_STATE_MISMATCH`).

#### 5.9.2 `FORGE ATTEST v1` (letzte Zeile desselben Review-Bodys, außerhalb des Fences)

```
FORGE ATTEST v1 reviewer=<chatgpt|claude|grok> block=<64hex> by=Wuerfelduell
```

`block` == Blockhash des Review-Blocks darüber; `reviewer` == `reviewer:` im Block; Review-Autor-ID == `policy.owner.id` (`ATTEST_INVALID`). Die Zeile ist die ausdrückliche Erklärung des Owners, den Block wörtlich vom genannten Reviewer übernommen zu haben.

#### 5.9.3 `FORGE FINDINGS v1` (im Body eines Run-PRs mit `n > 1` oder wenn der Vorgänger-PR derselben Version mit `REQUEST_CHANGES` endete)

```forge
FORGE FINDINGS v1
task: <TASK> v<N>
previous_pr: <PR-Nummer>
finding: <F-ID> fixed <40hex> | disputed <Text>    # eine Zeile je blockierender code_change-ID des Vorgängers
```

Gate: jede blockierende `code_change`-ID aus dem jüngsten `REQUEST_CHANGES`-Review des Vorgänger-PRs ist aufgeführt (`FINDINGS_NOT_CARRIED`); `fixed <sha>` liegt in `runBase..H` (`FINDINGS_COMMIT_UNKNOWN`); `H ≠` Head des Vorgänger-PRs bei `request_changes(code_change)` (`REWORK_SAME_COMMIT`, HP S-11).

#### 5.9.4 `FORGE READ RECEIPT v2` (Commit-Message des leeren ersten Commits des Run-Branches)

```
FORGE READ RECEIPT v2

task: <TASK> v<N>
contract_commit: <40hex>        # C
registration_merge: <40hex>     # M
content_hash: <64hex>           # vom Developer lokal aus der ausgecheckten Datei berechnet
blob: <40hex>
run: <n>
run_base: <40hex>               # refs/heads/main zum Zeitpunkt des Abzweigens
```

Gate: genau ein Commit mit dieser Kopfzeile in `git rev-list --first-parent runBase..H`, und zwar der älteste (`RECEIPT_MISSING`, `RECEIPT_DUPLICATE`, `RECEIPT_NOT_FIRST`); Commit ist leer (`tree == tree(parent)`, `RECEIPT_NOT_EMPTY`); Werte stimmen mit Git überein: `C == M^2`, `M` registriert `<TASK>` als Version `N`, `content_hash`/`blob` == Blob an `C`, `run` == `<n>` im Branch-Namen, `M ⊑ run_base ⊑ runBase` (`RECEIPT_MISMATCH`); Syntax (`RECEIPT_INVALID`).

#### 5.9.5 `FORGE DEVELOPER HANDOFF v2` (Owner-Kommentar auf dem Tracking-Issue `forge: <TASK>`)

```forge
FORGE DEVELOPER HANDOFF v2
task: <TASK> v<N>
contract_commit: <40hex>
registration_merge: <40hex>
content_hash: <64hex>
blob: <40hex>
run: <n>
branch: forge/run/codex/<TASK>-<n>
previous_pr: <PR-Nummer> | none
```

Der Gate parst den Handoff **nicht**; er ist die Startanweisung für den Developer (W-19). Die Werte stammen aus der Job-Summary des Contract-PRs (kopiert, nicht getippt). Der übrige Kommentar verweist auf `forge/roles/developer.md`.

#### 5.9.6 Kopfzeile `Forge-Spec-Author` (im Body jedes Contract-PRs)

```
Forge-Spec-Author: owner | codex | claude | chatgpt | grok
```

Genau eine solche Zeile (`SPEC_AUTHOR_MISSING`); Teil des Review Packets; Änderung nach Review → neuer `packetHash` → `REVIEW_BLOCK_MISMATCH` (der Workflow läuft auf `edited`).

### 5.10 Übergangsregeln für Format-1-Bootstrap-Contracts

Für `taskId ∈ policy.bootstrapFormat1TaskIds` (FORGE-VERIFIER-0001, FORGE-CORE-0002, ggf. FORGE-VERIFIER-0002) gilt: `baseCommit` wird als `specifiedAgainst` gelesen; `reads := []`; `limits := policy.limits.default*`; `dependencies[].acceptedCommit` darf nicht `null` sein (`DEPENDENCY_UNRESOLVED`) und wird wie `provenance: "forge"` geprüft (für `TASK-000x`-Abhängigkeiten gilt der Legacy-Anker); `mutationSmoke: "required"` mit Mutanten in der Prosa, reviewer-repliziert (Review-Block `mutant:`-Zeilen mit den Prosa-IDs); kein End-Marker-Zwang; `findings` und `supersedes` existieren nicht (Carry-Forward nur über Review-Blöcke). Diese Regeln gelten für höchstens drei Tasks und enden mit der Abnahme des letzten Format-1-Tasks (spätestens FORGE-VERIFIER-0002); danach entfernt ein Owner-PR die Liste aus der Policy, und der Gate lehnt Format 1 ab (`FORMAT_NOT_CURRENT`).

---
## 6. Final Run Protocol

### 6.1 Zustände eines Tasks (abgeleitet, nie gespeichert)

```
IDEA ─T-01→ CONTRACT DRAFT ─T-02→ CONTRACT PR OPEN ─T-03→ CONTRACT ATTESTED ─T-04→ REGISTERED (M, Version N)
  ─T-05→ HANDED OFF (Run n) ─T-06→ RUN STARTED (Quittung, Draft-PR) ─T-07→ IMPLEMENTING ─T-08→ READY FOR REVIEW
  ─T-09→ CODE ATTESTED ─T-11→ ACCEPTED (A)

Seitenausgänge:  T-10 Rework (Run n+1 derselben Version) · T-10' Revision (Version N+1) · T-12 Abbruch (Owner schließt)
                 · T-13 Halt (Ruleset forge-halt) · SPEC_STALE jederzeit → Revision
```

Jeder Zustand ist aus GitHub ableitbar (§3.6). „Ein Run“ = ein Run-PR; „Run n“ = der n-te Run-PR des Tasks (über alle Versionen gezählt). Höchstens ein offener Run-PR im Repository (W-20).

### 6.2 Übergänge

| Nr. | Übergang | Autorität (wer handelt) | Input | Output / Nachweis | Fehlerfall |
|---|---|---|---|---|---|
| T-01 | IDEA → CONTRACT DRAFT | Spec-Autor (`Wuerfelduell` oder `forge-codex`; Text darf von Claude/ChatGPT/Grok entworfen sein, der Owner pusht ihn dann selbst) nach `forge/roles/spec-author.md` | Idee; `main` an `specifiedAgainst`; Dependency-Dateien (`reads`) | lokale Datei `forge/contracts/<TASK>.md` im Format 2 (Bootstrap: Format 1) | keiner; nichts ist aufgezeichnet |
| T-02 | DRAFT → CONTRACT PR OPEN | Spec-Autor | ein Commit auf `forge/contract/<TASK>-v<N>`; PR gegen `main` mit Kopfzeile `Forge-Spec-Author:` | `forge-gate` Abschnitte `forge/contract`, `forge/identity` grün; Review Packet in der Job-Summary; `forge-verify` grün | Strukturfehler (§5.7 Nr. 1–8) → Autor korrigiert, Force-Push (erlaubt), neuer Lauf. `RUN_ACTIVE`/`CONTRACT_PR_DUPLICATE` → warten bzw. Owner schließt den anderen PR |
| T-03 | CONTRACT PR OPEN → CONTRACT ATTESTED | Owner (Attestierer); externer Architektur-Reviewer (Provider ≠ Spec-Autor-Provider) | Packet (aus Job-Summary kopiert) → Reviewer; Reviewer liest Contract-Blob und `reads` an `specifiedAgainst`, bestätigt `reads_reviewed`, liefert Block | GitHub-Review von `Wuerfelduell` (APPROVED; COMMENTED bei eigenem PR) mit `FORGE REVIEW v1` + `FORGE ATTEST v1`; **Owner klickt „Re-run all jobs“** auf dem jüngsten Workflow-Lauf → Abschnitt `forge/review` grün (W-32) | `REVIEW_CHANGES_REQUESTED` → Autor ändert, Hash ändert sich, zurück zu T-02 (kein `findings[]`, §5.8 Nr. 5). `REVIEWER_NOT_INDEPENDENT`/`ATTEST_INVALID` → Owner korrigiert das Review (dismiss + neu). `MAIN_MOVED` beim Re-run → Owner ändert den PR-Body (Zeile `Forge-Reeval: <k>`), frischer Lauf |
| T-04 | CONTRACT ATTESTED → REGISTERED | **Owner** (einziger Merger, `forge-main-merge`) | beide Required Checks grün am Head `C`, Branch „up to date“ | Merge Commit `M` auf `main`, `M^2 = C`; Version N; Job-Summary des letzten Laufs nennt `C`, `M^1`, `contentHash`, `blobSha` | GitHub: „not up to date“ → Autor rebased (Force-Push; Review bleibt über den Blob gültig, §5.7 Nr. 10); `SPEC_STALE` → Autor hebt `specifiedAgainst`, neuer Hash → T-03 erneut; `forge-halt` aktiv → kein Merge |
| T-05 | REGISTERED → HANDED OFF | Owner | Werte aus der Job-Summary (`C`, `M`, Hash, Blob, `N`), Nummer `n` = bisherige Run-PRs des Tasks + 1, `previous_pr` | Tracking-Issue `forge: <TASK>` (Label `forge-task`; einmal je Task) und Kommentar `FORGE DEVELOPER HANDOFF v2` nach `forge/roles/handoff.md` | falsche Werte → Developer-Quittung passt nicht → T-06 `RECEIPT_MISMATCH` (selbstkorrigierend); keine Gate-Prüfung des Handoffs |
| T-06 | HANDED OFF → RUN STARTED | Developer `forge-codex` nach `forge/roles/developer.md` | Handoff; `git fetch origin refs/heads/main`; `git switch -c forge/run/codex/<TASK>-<n> origin/main`; Hash der ausgecheckten Contract-Datei lokal berechnet und mit Handoff verglichen; leerer Commit mit `FORGE READ RECEIPT v2`; Push; **Draft-PR** gegen `main`, Body mit `Closes #<issue>` und (n > 1 oder Vorgänger mit `REQUEST_CHANGES`) `FORGE FINDINGS v1` | `forge-gate`: `forge/identity`, `forge/receipt`, `forge/contract` (registriert, aktuelle Version, `SPEC_STALE` gegen `runBase`), `forge/lane` (`RUN_LIMIT`, `RUN_NUMBER_NOT_NEXT`), `forge/findings` grün; `forge/review: FAIL REVIEW_PENDING` ist in diesem Zustand erwartet | `RUN_LIMIT` (anderer Run offen), `RUN_NUMBER_NOT_NEXT`, `RECEIPT_*`, `SPEC_STALE`, `CONTRACT_NOT_CURRENT` (Version inzwischen ersetzt), `BRANCH_AGENT_MISMATCH`, `OWNER_ON_RUN_BRANCH`, `COMMIT_IDENTITY_MISMATCH`, `FINDINGS_NOT_CARRIED` → **Developer arbeitet nicht weiter** (Rollenvorlage: „Rot nach dem ersten Push heißt anhalten“); Owner schließt den PR, Ursache beheben, Run n+1 |
| T-07 | RUN STARTED → IMPLEMENTING | Developer | Commits (WIP erlaubt), Pushes; `git merge origin/main` erlaubt (sauberer Merge, §7.3 Nr. 6); kein Force-Push, kein Rebase | je Push: `forge-gate` (ohne Review) und `forge-verify` (Tree-Regeln, Diff, Limits, Checks, Inventar, Evidence) | `SCOPE_VIOLATION`, `PROTECTED_PATH_CHANGED`, `SIZE_EXCEEDED`, `CHECK_FAILED`, `INVENTORY_REGRESSION`, `TREE_RULE_VIOLATION`, `RUN_MERGE_FOREIGN_PARENT`, `RUN_MERGE_NOT_CLEAN`, `COMMIT_IDENTITY_MISMATCH` → Developer korrigiert und pusht. `MAIN_MOVED`/Infrastruktur (§10 F7) → Re-run durch Owner oder nächster Push |
| T-08 | IMPLEMENTING → READY FOR REVIEW | Developer | PR „Ready for review“; Body enthält kurze Beschreibung (Prosa, ohne Autorität), Findings-Block falls Pflicht | `ready_for_review`-Lauf: `forge-verify` grün, `forge-gate` alle Abschnitte außer `forge/review` grün; **Review Packet (Run)** in der Job-Summary: Repo, PR, `H`, `runBase`, `main`, Contract (`C`, `M`, Hash, Blob), Listing-Diff, Evidence-Hash, Mutantenliste, offene Findings, `packetHash`. Damit endet die Arbeit des Developers | Verifier rot → zurück zu T-07. Developer-Session endet ohne Ready → T-12 |
| T-09 | READY FOR REVIEW → CODE ATTESTED | Owner; externer Code-Reviewer (Provider ≠ Developer-Provider, also Claude oder Grok) | Packet → Reviewer; Reviewer klont `H` (öffentliches Repo), prüft Diff gegen Contract, wendet **jeden** Mutanten an und führt die genannten Tests aus, liefert Block mit `mutant:`-Zeilen und Findings | GitHub-Review `APPROVED` von `Wuerfelduell` am Head `H` mit Blöcken; Owner „Re-run all jobs“ → `forge/review` grün; `forge-gate` grün | `REQUEST_CHANGES` → T-10; `MUTANT_SURVIVED_UNADDRESSED`, `REVIEW_BLOCK_MISMATCH`, `REVIEWER_NOT_INDEPENDENT`, `ATTEST_INVALID` → Owner korrigiert; `ATTEST_STALE` (nach dem Review ein Nicht-Merge-Commit oder unsauberer Merge in `reviewedHead..H`, oder `patch-id` geändert) → neues Review |
| T-10 | CODE ATTESTED(request_changes) → Rework | Owner schließt den Run-PR (`run abandoned` ist dieselbe Mechanik); Developer | letztes `REQUEST_CHANGES`-Review mit blockierenden `code_change`-IDs | Handoff n+1 mit `previous_pr`; Run n+1 ab aktuellem `main` (Cherry-Pick der alten Commits erlaubt), Body mit `FORGE FINDINGS v1` (`fixed`/`disputed` je ID), neuer Head ≠ alter Head | `FINDINGS_NOT_CARRIED`, `REWORK_SAME_COMMIT`, `FINDINGS_OPEN` (disputed ohne `withdraw:` im neuen Review) |
| T-10' | CODE ATTESTED(request_changes, contract_change) oder `SPEC_STALE` → Revision | Owner schließt Run-PR; Spec-Autor | blockierende `contract_change`-IDs; neuer `specifiedAgainst` | Contract-PR v<N+1> mit `supersedes` und `findings[]` → T-02…T-05; Run n+1 für Version N+1 | `FINDINGS_NOT_CARRIED` am Contract-PR; `RUN_ACTIVE`, falls der Run-PR noch offen ist |
| T-11 | CODE ATTESTED → ACCEPTED | **Owner** | beide Required Checks grün am Head `H`, Branch „up to date“, `forge-halt` inaktiv | Merge Commit `A` auf `main`, `A^2 = H`, `tree(A) == tree(H)`; Issue wird durch `Closes #` geschlossen; `acceptedCommit(TASK) = A` | „not up to date“ (`main` bewegt): nur der Developer kann den Run-Branch aktualisieren (`git merge origin/main`, sauber) → neuer Head → Verifier läuft neu, Review gilt fort (Fortgeltungsregel §7.3 Nr. 8), Owner merged; ist kein Developer verfügbar → T-12 und Run n+1 |
| T-12 | jeder Run-Zustand → Abbruch | Owner (schließt PR); Developer kann nur melden, nicht beenden | — | geschlossener PR = beendeter Run; Branch bleibt (unlöschbar), Commits wiederverwendbar; `n+1` frei | keiner. Ein geschlossener PR darf **nicht** wieder geöffnet werden (`reopened` → `RUN_REOPENED` rot): ein Run endet genau einmal |
| T-13 | jeder Zustand → Halt | Owner (Ruleset `forge-halt` → `active`) | Verdacht auf Integritätsbruch (§10 F8) | kein Merge nach `main` möglich; Pushes, Reviews, Verifier laufen weiter; Eintrag im Org-Audit-Log; Notiz in `forge/ops/` nach Aufhebung | keiner (Ruleset-Änderung ist nur Admins möglich) |

### 6.3 Invarianten des Protokolls

- **I-1** Kein Code erreicht `main` außer über T-04 (nur Contract-Datei) und T-11 (nur verifizierter, attestierter Head). Beide sind Merge Commits durch den Owner.
- **I-2** Nichts, was der Developer schreibt (PR-Body, Commit-Messages außer der Quittung, Kommentare, Dateien), ist für ein Urteil autoritativ. Die Quittung ist eine **Behauptung**, die der Gate gegen Git prüft; sie beweist Lesen nur insofern, als die Werte nur aus dem registrierten Contract stammen können.
- **I-3** Jedes Urteil ist an einen SHA gebunden: Reviews an `C` (über den Blob) bzw. `H` (mit Fortgeltung über saubere `main`-Merges), Checks an `H`, Abnahme an `A^2 = H`.
- **I-4** Zeit kommt nicht vor. Kein Zustand hängt von einer Frist ab; alles Verwaiste endet durch den Owner (T-12).
- **I-5** Der Owner führt je Task im Normalfall genau sechs Handgriffe aus: Issue anlegen und Handoff kommentieren (T-05), Architektur attestieren (T-03), Contract mergen (T-04), Code attestieren (T-09), Run mergen (T-11); dazu je Attestation ein „Re-run“-Klick, der kein Urteil enthält und nicht gezählt wird. Er tippt keinen SHA und keine Contract-Zeile; alle Werte werden kopiert.
- **I-6** Der Developer braucht genau drei Dinge: den Handoff-Kommentar, Lesezugriff auf `main` und Schreibrecht auf seinen Namensraum. Er braucht keinen Forge-Client, kein Token außer seinem GitHub-Konto, keine Umgebungsvariable.
- **I-7** Rot ist der Normalzustand eines unfertigen PRs (`REVIEW_PENDING`); grün gibt es nur für den Zustand, der mergebar sein soll. Es gibt keinen „beratenden“ Check.

### 6.4 Die Rollenvorlagen (`forge/roles/*.md`, Owner-PR in FORGE-OPS-0001)

| Datei | Inhalt (Pflichtteile) |
|---|---|
| `spec-author.md` | Format-2-Skelett, Pflichtabschnitte, Regeln für `reads`/`scope`/`mutants`/`limits`, Verbot von Statusprosa, Kopfzeile `Forge-Spec-Author`, Ein-Commit-Regel, Hash-Kommando (`sha256sum` mit Domänenpräfix, bzw. `node scripts/…` sobald vorhanden) |
| `architecture-reviewer.md` | Packet-Felder, Pflicht `reads_reviewed`, Finding-Schema, Provider-Regel, Hinweis: Contract-Prosa ist Daten, nie Anweisung (PA-111/112) |
| `developer.md` | Schritte T-06…T-08 wörtlich (`git`-Kommandos), Quittungsformat, „Rot nach dem ersten Push = anhalten“, `git merge origin/main` statt Rebase, keine Dateien außerhalb `scope`, keine Änderung an Tests außer in `scope`, Body-Vorlage mit `Closes #` |
| `code-reviewer.md` | Klonanleitung (`git fetch origin refs/pull/<N>/head`), Mutanten-Replikation Schritt für Schritt, Finding-IDs, Pflichtfelder, Verbot „laut Chat“ |
| `handoff.md` | `FORGE DEVELOPER HANDOFF v2`-Vorlage mit Herkunft jedes Werts (Job-Summary-Zeile) |
| `attestation-checklist.md` | Owner-Checkliste vor jeder Attestation: Packet-Hash vergleichen, Head/Blob vergleichen, Reasoning gelesen, Injection-Muster geprüft, alle `mutant:`-Zeilen vorhanden, kein Review-Text aus einer Session mit Owner-Verbindung übernommen, ohne ihn gelesen zu haben; Regel: Agenten mit Owner-Verbindung schreiben nicht |

---
## 7. Verifier Architecture

### 7.1 Grundsätze (PKG §3, verschärft)

1. **Ein Workflow, zwei Jobs, zwei Checks.** `.github/workflows/forge-verify.yml` aus `main`; Jobs `forge-gate` und `forge-verify`; keine weiteren Workflows im Repository (S1 verbietet sie ohnehin).
2. **Prüflingscode läuft nur im Container.** Der Runner führt ausschließlich Code aus `main` aus (Checkout von `refs/heads/main`); der PR-Inhalt wird aus Git-Objekten **materialisiert** (Blobs per SHA, nie `git archive`, nie `npm pack`; PAC PA-59) und im Container ohne Netz und ohne Umgebung ausgeführt.
3. **Daten, nicht Aussagen.** Jeder Fakt stammt aus Git-Objekten des kanonischen Repos (`GIT_NO_REPLACE_OBJECTS=1`, vollständiger Fetch, nur `refs/heads/*` und `refs/pull/<N>/head`, alle Refs voll qualifiziert) oder aus der GitHub-API (PR-Metadaten, Reviews, PR-Liste). Developer-Report, PR-Body-Prosa und Commit-Messages (außer der Quittung) werden nicht gelesen.
4. **Fail-closed.** Jeder unerwartete Zustand (API-Fehler, fehlende Daten, Timeout, Skipped-Job) ist rot. Ein übersprungener Job zählt bei GitHub als Erfolg; deshalb `if: always()` mit explizitem Fehlschlag, wenn der Gate nicht `success` lieferte (PKG).
5. **Keine Schreibrechte.** `permissions: contents: read, pull-requests: read`; keine Kommentare, keine Labels, kein Push, keine Approvals. Die einzigen Ausgaben sind Check-Run-Status, Job-Summary und das Evidence-Artefakt.
6. **Kein Zustand zwischen Läufen.** Kein Cache (`cache-mode: none`, kein `setup-node` mit `cache:`), keine Variablen, keine Secrets, kein Artefakt-Import (PAC PA-37/38).

### 7.2 Workflow (normative Skizze; Vollform in FORGE-VERIFIER-0003)

```yaml
name: forge
on:
  pull_request_target:
    types: [opened, synchronize, reopened, edited, ready_for_review]   # W-32: kein pull_request_review
  workflow_dispatch:            # nur Owner (S1); Smoke-Test gegen eine PR-Nummer, erzeugt keinen PR-Check
    inputs: { pr: { required: true } }
permissions: {}
concurrency:
  group: forge-pr-${{ github.event.pull_request.number || inputs.pr }}
  cancel-in-progress: true      # abgebrochener Lauf = cancelled ≠ success (PA-36)
jobs:
  forge-gate:
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    permissions: { contents: read, pull-requests: read }
    outputs: { structural: ${{ steps.gate.outputs.structural }}, packet: ${{ steps.gate.outputs.packet_hash }} }
    steps:
      - uses: actions/checkout@<sha>            # ref = refs/heads/main (pull_request_target-Default), fetch-depth: 0
        with: { persist-credentials: false }
      - run: |
          git -c protocol.version=2 fetch --no-tags origin \
            '+refs/heads/*:refs/remotes/origin/*' \
            "+refs/pull/${PR}/head:refs/forge/pr-head"
        env: { GIT_NO_REPLACE_OBJECTS: "1" }
      - id: gate
        run: node <werkzeug-aus-main> gate --pr "$PR" --event "$GITHUB_EVENT_PATH" --main "$GITHUB_SHA"
        env: { GIT_NO_REPLACE_OBJECTS: "1", GITHUB_TOKEN: ${{ github.token }} }
  forge-verify:
    needs: forge-gate
    if: always()
    runs-on: ubuntu-24.04
    timeout-minutes: 30
    permissions: { contents: read }
    steps:
      - run: test "${{ needs.forge-gate.outputs.structural }}" = "pass" || { echo "forge/verify: FAIL GATE_STRUCTURAL_FAILED"; exit 1; }
      - uses: actions/checkout@<sha>
      - run: git fetch … (wie oben)
      - run: node <werkzeug-aus-main> verify --pr "$PR" --main "$GITHUB_SHA" --image "$(jq -r .digest forge/verifier/image.json)"
      - uses: actions/upload-artifact@<sha>
        with: { name: forge-evidence-${{ github.event.pull_request.head.sha }}, path: evidence.json, retention-days: 90 }
```

Bindend daran: Trigger-Block, `permissions`, `concurrency`, `if: always()`-Konstruktion, Fetch-Refspecs, `GIT_NO_REPLACE_OBJECTS=1`, Actions nur per Commit-SHA gepinnt, Artefakt-Name mit Head-SHA. Nicht bindend: Step-Aufteilung, Werkzeugaufruf.

**Gate-Abschluss:** `forge-gate` endet `success` genau dann, wenn **alle** Abschnitte grün sind, einschließlich `forge/review`. Das Output `structural` ist `pass`, wenn alle Abschnitte außer `forge/review` grün sind; `forge-verify` läuft also auch bei ausstehender Attestation, damit der Developer sein Ergebnis sieht und der Owner das Packet bekommt.

**`MAIN_MOVED`:** Beide Jobs vergleichen `GITHUB_SHA` (= `main`-Spitze zum Event-Zeitpunkt) mit `refs/heads/main` laut API (`GET /repos/{id}/git/ref/heads/main`) und brechen bei Abweichung rot ab (PAC PA-35). Dasselbe gilt für Re-runs. Neubewertung erzwingt der Owner durch eine Body-Änderung (`edited`).

**`HEAD_MOVED`:** `github.event.pull_request.head.sha` muss gleich `refs/forge/pr-head` nach dem Fetch sein; sonst rot (ein neuer Lauf für den neuen Head folgt ohnehin).

### 7.3 Job `forge-gate` (nur Daten, Git-Objekte, API; kein Prüflingscode)

Ausgabe je Abschnitt eine Zeile `forge/<abschnitt>: PASS` oder `forge/<abschnitt>: FAIL <CODE> <Detail>` in Log und Job-Summary (W-18). Abschnitte und Inhalt:

1. **`forge/policy`** — `forge/policy.json` aus `main` parsen (strict); Repo-ID aus Event == Policy (`REPO_MISMATCH`); PR-Typ aus Branch-Namen bestimmen (`run`, `contract`, `owner`; `BRANCH_PATTERN_INVALID`); `forge-halt` wird **nicht** geprüft (das ist GitHubs Aufgabe).
2. **`forge/identity`** — Autor-ID gegen Policy je PR-Typ; Run: `BRANCH_AGENT_MISMATCH`, `OWNER_ON_RUN_BRANCH`, Commit-E-Mails in `runBase..H` (`COMMIT_IDENTITY_MISMATCH`, Committer `noreply@github.com` erlaubt); Contract: `AUTHOR_NOT_SPEC_AUTHOR`, `SPEC_AUTHOR_MISSING/MISMATCH`; Owner: Autor == Owner (`OWNER_PR_AUTHOR_MISMATCH`).
3. **`forge/base`** — `runBase = merge-base(H, refs/heads/main)`; `runBase` auf der First-Parent-Kette von `main` (`BASE_NOT_ON_MAIN`); `H` kein Vorfahr von `main` (`PR_ALREADY_MERGED`); PR-Zustand `open` und nicht `reopened` nach Schließung (`RUN_REOPENED`, nur Run-PRs: ein Run endet genau einmal; Contract-/Owner-PRs dürfen wieder geöffnet werden).
4. **`forge/contract`** — Contract-PR: §5.7 Nr. 2–8. Run-PR: Contract-Datei an `runBase` existiert, parst, Version N ist die aktuelle (Anzahl Registrierungs-Merges bis `runBase`; `CONTRACT_NOT_CURRENT`), Task nicht akzeptiert (`TASK_ACCEPTED_FROZEN`), `M ⊑ runBase` (`CONTRACT_NOT_IN_RUN_BASE`), `SPEC_STALE` gegen `runBase`, Dependencies `⊑ runBase` (`DEPENDENCY_NOT_IN_RUN_BASE`), Format-Regel (`FORMAT_NOT_CURRENT`).
5. **`forge/receipt`** (nur Run) — §5.9.4.
6. **`forge/history`** (nur Run) — Commit-Walk über `git rev-list --first-parent runBase..H`: jeder Commit hat einen Elternteil **oder** ist ein Merge, dessen zweiter Elternteil auf der First-Parent-Kette von `refs/heads/main` liegt (`RUN_MERGE_FOREIGN_PARENT`) und dessen Tree gleich `git merge-tree --write-tree <erster Elternteil> <zweiter Elternteil>` ist (`RUN_MERGE_NOT_CLEAN`; Konflikt ⇒ Run neu starten, §11); kein Commit außer dem Quittungs-Commit ist leer (`EMPTY_COMMIT`); für jeden Nicht-Merge-Commit: `git diff --raw --no-renames <parent> <commit>` berührt nur Pfade aus `scope.create ∪ scope.modify` und keinen geschützten Pfad (PA-72: add+delete in Zwischencommits; `INTERMEDIATE_PATH_VIOLATION`). Contract-PR: `CONTRACT_PR_NOT_SINGLE_COMMIT`, `CONTRACT_PR_NOT_ISOLATED`. Owner-PR: nur `OWNER_PR_MERGE_FOREIGN_PARENT` (Merges aus `main` erlaubt, sonst frei).
7. **`forge/lane`** (nur Run) — offene Run-PRs im Repo (API, `state=open`, Head-Ref-Präfix `forge/run/`): genau dieser (`RUN_LIMIT`); `n` == geschlossene + gemergte Run-PRs des Tasks + 1 (`RUN_NUMBER_NOT_NEXT`). Contract-PR: `RUN_ACTIVE`, `CONTRACT_PR_DUPLICATE`.
8. **`forge/findings`** (nur Run) — Vorgänger-PR (höchste Nummer unter den geschlossenen Run-PRs des Tasks) hatte als letztes Review `REQUEST_CHANGES` mit blockierenden `code_change`-IDs ⇒ Body-Block Pflicht, Vollständigkeit, `fixed`-SHAs in `runBase..H`, `REWORK_SAME_COMMIT`. Contract-PR mit N > 1: `findings[]`-Vollständigkeit gegen Vorgängerversion (Contract-PR-Reviews) und gegen den letzten Run-PR der Vorgängerversion (`contract_change`-IDs).
9. **`forge/limits`** (nur Run) — `git diff --numstat --no-renames runBase H` (hinzugefügte Zeilen in Pfaden außerhalb `tests/**`) ≤ `limits.maxProductionLines`; Anzahl Pfade in der Listing-Differenz ≤ `limits.maxChangedFiles` (`SIZE_EXCEEDED`).
10. **`forge/packet`** — bei `structural = pass`: Review Packet (§7.6) berechnen, in die Summary schreiben, `packet_hash` als Output.
11. **`forge/review`** — Reviews des PRs per API (alle, chronologisch): nur Reviews mit Autor-ID == Owner zählen (`REVIEW_AUTHOR_NOT_OWNER` für andere wird ignoriert, nicht rot); das **jüngste nicht verworfene** Owner-Review mit gültigem Block entscheidet; Prüfungen §5.7 Nr. 10 bzw. für Run-PRs: `kind: code`, `head` == `H` **oder** Fortgeltung (Nr. 12), `blob` == Contract-Blob an `runBase`, `contract`-Zeile, `packet` == aktueller `packetHash` (der Packet-Hash eines Run-PRs enthält `H` nicht direkt, sondern den Listing-Diff und den Evidence-Hash des zuletzt grünen `forge-verify`-Laufs; damit überlebt er einen sauberen `main`-Merge), alle `mutant:`-Zeilen vollständig und mit den Contract-IDs identisch (`MUTANT_REPORT_INCOMPLETE`), `verdict: approve`, keine offenen `disputed`-IDs, Provider-Unabhängigkeit, Attest-Zeile. Fehlt ein Review: `REVIEW_PENDING`. Letztes Review `REQUEST_CHANGES`: `REVIEW_CHANGES_REQUESTED`.
12. **Fortgeltungsregel (Run-PR):** Ein Review auf `H0 ≠ H` gilt fort, wenn jeder Commit in `git rev-list --first-parent H0..H` ein sauberer Merge aus `main` nach Nr. 6 ist **und** `git patch-id --stable` von `git diff --no-renames runBase0 H0` gleich dem von `git diff --no-renames runBase H` ist (`ATTEST_STALE` sonst). Für Contract-PRs gilt die Blob-Regel (§5.7 Nr. 10). Für Owner-PRs gilt strikt `head == H`.

Der Gate benutzt den Kern als Bibliothek: Parser/Hash/Schema (Format 1 und 2), `isProtectedPath`, Scope-Urteil (`evaluateVerification` mit `toKernelEvidence` aus der Listing-Differenz). Kein Replay wird persistiert.

### 7.4 Job `forge-verify` (Prüflingscode im Container)

1. **Tree-Regeln am gesamten Head-Tree** (`git ls-tree -r -l -z --full-tree H`): jeder Pfad ASCII-`RepoPath`, Modus `100644` (keine `100755`, `120000`, `160000`; `TREE_RULE_VIOLATION`), keine casefold-Kollision, keine Windows-reservierten Namen, keine Segmente mit abschließendem Punkt/Leerzeichen (DRT-23/24/25), keine Dateien > 1 MiB, keine `*.snap`/`__snapshots__`.
2. **Kanonischer Diff** = Differenz der Listings von `runBase` und `H` (added/modified/deleted mit Blob-SHAs; `deleted ≠ ∅` ⇒ `SCOPE_VIOLATION`); geschützte Pfade nach Stufe und Task-Klasse (`PROTECTED_PATH_CHANGED`); `added ⊆ scope.create`, `modified ⊆ scope.modify` über den Kern (`SCOPE_VIOLATION`). Für Owner-PRs entfällt die Stufenprüfung, nicht die Tree-Regel.
3. **Materialisierung** von `H` und von `runBase` (Baseline) aus Blobs nach `work/head` und `work/base` (keine Git-Metadaten, kein `.git`), `node_modules` aus `main`-Lockfile auf dem Runner installiert (`npm ci --ignore-scripts` mit der `package-lock.json` von `main`; die Lockfile ist Stufe `always`, also identisch in `H`) und **read-only** gemountet.
4. **Container** (`image@digest` aus `forge/verifier/image.json`): `docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges --pids-limit 512 --memory 4g --cpus 2 -e CI=1 -e NODE_OPTIONS= -v work/<phase>:/work:ro -v node_modules:/work/node_modules:ro --tmpfs /tmp:rw,noexec,nosuid,size=512m -w /work`; **keine** Umgebungsvariablen außer den genannten, kein Token, keine Secrets, kein Volume mit Schreibrecht außer tmpfs (PAC PA-95: jede Phase bekommt einen eigenen, frisch materialisierten `/work`).
5. **Phasen:** (a) Baseline `npm run typecheck`, `npm test -- --reporter=json --outputFile=/tmp/inv.json` auf `work/base`; (b) dieselben Kommandos auf `work/head`, je Check genau das Policy-Kommando (`argv` aus der Policy, nicht aus dem Contract-Text); Exit-Codes und Dauer; Inventar aus dem JSON-Reporter (`total`, `passed`, `failed`, `skipped`, `todo`).
6. **Inventar-Regel:** `failed == 0`, `total(head) ≥ total(base)`, `skipped(head) + todo(head) ≤ skipped(base) + todo(base)`; sonst `INVENTORY_REGRESSION` (DA #4, V-11/V-12). Reporter-Ausfall (kein JSON) ⇒ `INVENTORY_UNAVAILABLE`, rot.
7. **Mutanten:** nicht ausgeführt; Evidence `mutants: "not_evaluated_by_verifier"` (W-13).
8. **Evidence v1** (§7.5) schreiben, `evidenceHash` berechnen, Zusammenfassung in die Job-Summary (`forge/tree`, `forge/diff`, `forge/checks`, `forge/inventory`, `forge/evidence` je eine Zeile), Artefakt hochladen.

### 7.5 `FORGE-VERIFICATION-EVIDENCE v1` (einziges Evidence-Format, W-12)

```json
{
  "forgeEvidenceFormat": 1,
  "repository": { "id": 1401864629 }, "pr": 12, "head": "<40hex>", "base": "<runBase>", "main": "<GITHUB_SHA>",
  "contract": { "taskId": "TASK-0006", "contractVersion": 1, "path": "forge/contracts/TASK-0006.md",
                "blobSha": "<40hex>", "contentHash": "<64hex>", "contractCommit": "<C>", "registrationMerge": "<M>" },
  "listing": { "baseSha256": "<64hex>", "headSha256": "<64hex>" },
  "changedFiles": { "added": [{ "path": "...", "blob": "<40hex>" }], "modified": [...], "deleted": [] },
  "checks": [ { "name": "typecheck", "argv": ["npm","run","typecheck"], "exitCode": 0, "durationMs": 1234 },
              { "name": "test", "argv": ["npm","test","--","--reporter=json","--outputFile=/tmp/inv.json"], "exitCode": 0, "durationMs": 45678 } ],
  "inventory": { "head": { "total": 1101, "passed": 1101, "failed": 0, "skipped": 0, "todo": 0 },
                 "base": { "total": 1087, "passed": 1087, "failed": 0, "skipped": 0, "todo": 0 } },
  "limits": { "productionLinesAdded": 212, "changedFiles": 6 },
  "mutants": "not_evaluated_by_verifier",
  "image": "<registry>/node@sha256:<digest>", "lockfileSha256": "<64hex>",
  "workflow": { "runId": 0, "runAttempt": 1, "workflowSha": "<GITHUB_SHA>" },
  "evidenceHash": "<64hex über das kanonische JSON ohne dieses Feld>"
}
```

`toKernelEvidence(evidence)` liefert dem Kern `{ runId, verifiedCommit: head, method: "fresh_clone", changedFiles (Pfade), checks (name, command = argv.join(" "), exitCode), mutations: null }` für `evaluateVerification` [CODE]; der Kern-`method`-Literal bleibt, weil die Materialisierung aus Blobs semantisch ein frischer Klon ist.

### 7.6 Review Packet

Kanonisches JSON in der Job-Summary (Fence `json`), `packetHash = sha256(JSON)`:

- **Contract-PR:** `{ kind: "architecture", repository.id, pr, contractCommit: C, blobSha, contentHash, taskId, contractVersion, specifiedAgainst, mainAtPacket, specAuthor, dependencies[], supersedes, previousBlockingFindings[] }` — `C` ist enthalten, aber die Review-Gültigkeit hängt am Blob (§5.7 Nr. 10); ändert sich `C` durch Rebase, berechnet der Gate das Packet neu und vergleicht den im Block genannten `packet` gegen den Packet-Hash **ohne** `contractCommit` und `mainAtPacket` (`packetCore`). Konkret: Der Block nennt `packet: <packetCoreHash>`; die Summary zeigt beide Hashes.
- **Run-PR:** `{ kind: "code", repository.id, pr, taskId, contractVersion, contractCommit, registrationMerge, blobSha, contentHash, runBase, listingDiff (Pfad + Blob je Datei), evidenceHash, mutants[] (aus dem Contract), previousBlockingFindings[], findingsBlock (aus dem Body) }` — `H` ist über `listingDiff` und `evidenceHash` gebunden; ein sauberer `main`-Merge ändert weder Blobs der Scope-Dateien noch das Urteil, wohl aber `evidenceHash` (neuer Lauf). Deshalb nennt der Block `packet: <packetCoreHash>` über das Packet **ohne** `evidenceHash`; die Fortgeltungsregel (§7.3 Nr. 12) sichert den Rest.
- **Owner-PR:** `{ kind: "owner", repository.id, pr, head, listingDiff, evidenceHash }`, Bindung strikt an `head`.

Der Reviewer erhält das Packet als Text; er beschafft sich Contract und Code selbst aus dem öffentlichen Repository (nach Blob-/Commit-SHA), nie aus einem vom Developer gelieferten Anhang (PAC PA-111 Teilmitigation).

### 7.7 Härtungsliste (bindend)

| Maßnahme | Grund |
|---|---|
| `GIT_NO_REPLACE_OBJECTS=1` in jedem Git-Aufruf; kein `--mirror`; Fetch nur `refs/heads/*` und `refs/pull/<N>/head` | DRT-18, PA-09 |
| `fetch-depth: 0`, dann voller Fetch; `OBSERVATION_INCOMPLETE` bei fehlenden Eltern | DRT-19 |
| Refs nur `refs/heads/main`, `refs/forge/pr-head`, `<sha>^{commit}`; nie `main` oder `origin/main` unqualifiziert | PA-06, W-31 |
| `--no-renames --raw` bzw. Listing-Differenz; Modi aus `ls-tree` | DRT-21/22, V-26 |
| Actions per Commit-SHA gepinnt; `persist-credentials: false` | Supply-Chain, Token-Leak |
| `permissions` minimal; „Actions darf PRs erstellen/approven“ aus | PA-40 |
| `concurrency` je PR mit `cancel-in-progress`; `cancelled ≠ success` | PA-36 |
| Kein Cache, keine Variablen, keine Secrets, kein `workflow_run`, kein `merge_group` | PA-37/38/41, W-21 |
| Container: `--network none --read-only --cap-drop ALL`, tmpfs `noexec`, frisches `/work` je Phase | PA-91/95/98, C-31 |
| Checks nur mit Policy-`argv`, nie Shell-String aus dem Contract | C-31 |
| `MAIN_MOVED`, `HEAD_MOVED` | PA-12/35 |
| Inventar-Regel gegen Baseline aus zweitem Container | DA #4 |
| Evidence enthält Image-Digest und Lockfile-Hash | V-29, PA-99 |
| Artefakt-Name mit Head-SHA, Retention 90 Tage; Evidence zusätzlich im Packet gehasht | Nachvollziehbarkeit |

### 7.8 Owner-Modus (PKG OD-3 (a), W-27)

Für PRs von `forge/owner/**` mit Autor `Wuerfelduell`: `forge-gate` prüft Identität, Tree-Regeln, `forge/history` (nur Fremd-Eltern), `forge/review` mit `kind: owner` und State `COMMENTED`, Attestation durch externen Reviewer (jeder Provider, da Owner-Provider `human`); **keine** Stufenprüfung geschützter Pfade, keine Scope-Prüfung, keine Limits; `forge-verify` läuft vollständig (Tree, Checks, Inventar). Damit kann der Owner Workflow, Policy, Rollen, Lockfile und Hygiene ändern, aber nie ohne grünen Verifier und nie ohne ein zweites Augenpaar.

### 7.9 Was der Verifier in V0.1 **nicht** tut

Keine Mutanten (V2-01), keine Lease/Zeit (W-05), keine Kommentare oder Labels (keine Schreibrechte), kein Handoff (W-19), kein Status-Issue (V2-03), keine Reviews lesen außer vom Owner, kein Lesen von Fork-Refs, kein `git archive`, kein Netz, keine Verifikation von Contract-Prosa (nur Lint).

### 7.10 Verbleibende Spike-Punkte (vor MD-11 empirisch zu belegen, Ergebnis in `forge/ops/S1-RESULT.md` bzw. `forge/ops/RULESETS.md`)

| # | Frage | Erwartung (Doku) | Falls anders |
|---|---|---|---|
| SP-1 | Erlaubt die Actions-Event-Policy im Free-Org-Plan die Auswahl „nur `pull_request_target` für genau eine Workflow-Datei“? (S1 Negativ-/Positivtest) | ja (PAC §0 Doku-Beleg) | OE-3 (Team-Plan) |
| SP-2 | Behält „Re-run all jobs“ eines `pull_request_target`-Laufs Workflow-Datei und `GITHUB_SHA` des Originallaufs? | ja (PAC PA-35, `rerun.md`) | Neubewertung nur über `edited` |
| SP-3 | Löst eine Body-Änderung durch den Owner `pull_request_target: edited` aus und erzeugt einen neuen Check-Run am unveränderten Head? | ja | Attestations-Neubewertung braucht einen Developer-Push |
| SP-4 | Zählt bei zwei Check-Runs gleichen Namens am selben SHA aus derselben App der jüngste? | ja (PAC PA-33) | ohne Relevanz, wenn S1 steht |
| SP-5 | Verhindert `forge-main-merge` („Restrict updates“, Bypass Rolle Organization admin) den Merge-Button für `forge-codex` auch bei grünen Checks, und erlaubt er ihn dem Owner ohne Bypass-Dialog? | ja | Alternative: Owner merged weiterhin allein per Konvention; Gate-Code `MERGED_BY_NOT_OWNER` nachträglich erkennbar |
| SP-6 | Wird der Draft-Zustand eines PRs von GitHub als Merge-Hindernis behandelt? | ja | Gate-Code `PR_IS_DRAFT` ergänzen |
| SP-7 | Ist `git merge-tree --write-tree` (Git ≥ 2.38) auf dem Runner verfügbar? | ja (ubuntu-24.04) | Clean-Merge-Regel über `git merge --no-commit` im Wegwerf-Klon |
| SP-8 | Liefert der Vitest-JSON-Reporter unter `--reporter=json` ein vollständiges Inventar inkl. `skipped`/`todo`? | ja (vitest 5) | zweiter Reporter `verbose` parsen |

---
## 8. Canonical Check Names (ein für alle Mal, W-18)

### 8.1 GitHub Check Runs

| Check-Name (exakt) | Quelle | Required in `forge-main` | Strict („up to date“) | Inhalt |
|---|---|---|---|---|
| `forge-gate` | GitHub Actions (Job `forge-gate` in `forge-verify.yml`) | **ja** | **ja** | §7.3: Policy, Identität, Base, Contract, Quittung, Historie, Spur, Findings, Limits, Packet, Review |
| `forge-verify` | GitHub Actions (Job `forge-verify` in `forge-verify.yml`) | **ja** | **ja** | §7.4: Tree, Diff/Scope/geschützte Pfade, Checks, Inventar, Evidence |

Es gibt keinen dritten Check. `forge-contract`, `forge-approval`, `forge-policy`, `forge`, `forge/contract`, `forge/scope`, `forge/verification`, `forge/mutation-smoke` existieren **nicht** als Check-Runs. Die Granularität, die der Owner im PR sehen will, liefert die Job-Summary mit den Abschnittszeilen.

### 8.2 Abschnittszeilen (Job-Summary und Log)

Format: `forge/<abschnitt>: PASS` | `forge/<abschnitt>: FAIL <CODE> <Detail>`; Abschnitte des Gates: `policy`, `identity`, `base`, `contract`, `receipt`, `history`, `lane`, `findings`, `limits`, `packet`, `review`; des Verifiers: `tree`, `diff`, `checks`, `inventory`, `evidence`. Abschnitte, die für den PR-Typ nicht gelten, melden `SKIP` (nicht `PASS`). Die Zeilen sind maschinenlesbar (eine je Abschnitt, feste Reihenfolge), damit `forge/ops/DRILL-0001.md` sie wörtlich zitieren kann.

### 8.3 Contract-Checks (`requiredChecks[].name`)

| Name | Kommando (gepinnt in `forge/policy.json`) | Pflicht |
|---|---|---|
| `typecheck` | `npm run typecheck` (= `tsc --noEmit` laut `package.json` [CODE]) | ja |
| `test` | `npm test` (= `vitest run`); der Verifier hängt `-- --reporter=json --outputFile=/tmp/inv.json` an, ohne die Contract-Bindung zu verändern | ja |

Weitere Namen (`lint`, `build`) erfordern eine Policy-Änderung per Owner-PR **und** einen Eintrag in `package.json` (Stufe `always`) im selben Owner-PR. Der Kern-Regex `/^[a-z][a-z0-9-]{0,31}$/` bleibt [CODE].

### 8.4 Änderungsregel

Check-Namen, Abschnittsnamen und Fehlercodes (Anhang B) sind Teil dieses Dokuments. Eine Änderung erfordert eine neue Version dieses Dokuments in `forge/ops/` (Owner-PR) **und**, bei Check-Namen, die gleichzeitige Anpassung des Rulesets `forge-main` — in dieser Reihenfolge: erst Workflow mit neuem Job-Namen mergen (der neue Name erscheint am nächsten PR), dann Ruleset ergänzen, dann den alten Namen entfernen. Nie umgekehrt (toter Merge, PA-39).

---

## 9. GitHub Rulesets (Checkbox-Ebene)

Alle Angaben beziehen sich auf **Repository-Rulesets** (nicht Classic Branch Protection) von `Forge-Dice/Forge`. Bypass-Akteure sind in Rulesets Rollen, Teams oder Apps; „Owner“ bedeutet hier die Rolle **Organization admin**, deren einziges Mitglied `Wuerfelduell` ist (Governance-Regel: kein zweiter Org-Admin in V0.1). Jede Konfiguration wird nach dem Anlegen als JSON-Export in `forge/ops/RULESETS.md` abgelegt und nach jedem Negativ-Drill (MD-04) mit Datum bestätigt. Stand heute: per API nicht lesbar (403) [API]; alles Folgende ist Soll.

### 9.1 Branch-Rulesets

| # | Name | Enforcement | Ziel (Target branches) | Bypass list | Rules (☑ an / ☐ aus) |
|---|---|---|---|---|---|
| 1 | `forge-main` | **Active** | Include: default branch (`~DEFAULT_BRANCH`) | **leer** | ☑ Restrict deletions · ☐ Require linear history · ☑ Require a pull request before merging → Required approvals **0**, ☑ Dismiss stale pull request approvals when new commits are pushed, ☐ Require review from Code Owners, ☑ Require approval of the most recent reviewable push, ☑ Require conversation resolution before merging, Allowed merge methods: ☑ Merge ☐ Squash ☐ Rebase · ☑ Require status checks to pass → ☑ Require branches to be up to date before merging, Checks: `forge-gate` (GitHub Actions), `forge-verify` (GitHub Actions) [erst nach MD-11 eintragen] · ☑ Block force pushes · ☐ Require signed commits · ☐ Require merge queue · ☐ Require deployments to succeed · ☐ Require code scanning results · ☐ Restrict creations · ☐ Restrict updates (siehe #2) |
| 2 | `forge-main-merge` | **Active** | Include: `~DEFAULT_BRANCH` | Rolle **Organization admin**, „Always“ | ☑ Restrict updates — sonst nichts. Wirkung: nur der Owner kann `main` aktualisieren, d. h. mergen; alle Regeln aus #1 gelten für ihn weiter (dort kein Bypass) |
| 3 | `forge-all-branches` | **Active** | Include: all branches (`**`); **Exclude:** `refs/heads/forge/contract/**`, `refs/heads/forge/owner/**` | leer | ☑ Block force pushes · ☑ Restrict deletions — sonst nichts. Folge: kein Branch wird je gelöscht (Repo-Setting „Automatically delete head branches“ **aus**) |
| 4 | `forge-run-codex` | **Active** | Include: `refs/heads/forge/run/codex/**` | Team **`forge-dev-codex`**, „Always“ | ☑ Restrict creations · ☑ Restrict updates · ☑ Restrict deletions · ☑ Block force pushes. Wirkung: nur `forge-codex` legt an und pusht; der Owner kann hier weder pushen noch „Update branch“ klicken (PA-118, OMD B4) |
| 5 | `forge-run-claude` | **Active** | Include: `refs/heads/forge/run/claude/**` | leer | ☑ Restrict creations · ☑ Restrict updates · ☑ Restrict deletions · ☑ Block force pushes. Reservierter, gesperrter Namensraum (OE-4) |
| 6 | `forge-contract` | **Active** | Include: `refs/heads/forge/contract/**` | Team `forge-dev-codex` **und** Rolle Organization admin, „Always“ | ☑ Restrict creations · ☑ Restrict updates · ☑ Restrict deletions · ☐ Block force pushes (Ein-Commit-Regel und Rebase, W-02) |
| 7 | `forge-owner` | **Active** | Include: `refs/heads/forge/owner/**` | Rolle Organization admin, „Always“ | ☑ Restrict creations · ☑ Restrict updates · ☑ Restrict deletions · ☐ Block force pushes |
| 8 | `forge-no-stray-branches` | **Active** | Include: all branches; **Exclude:** `~DEFAULT_BRANCH`, `refs/heads/forge/run/**`, `refs/heads/forge/contract/**`, `refs/heads/forge/owner/**` | leer | ☑ Restrict creations · ☑ Restrict updates. Wirkung: Legacy-Branches eingefroren, keine neuen Branches außerhalb der Namensräume |
| 9 | `forge-halt` | **Disabled** (Aktivieren = Halt) | Include: `~DEFAULT_BRANCH` | leer | ☑ Restrict updates. Aktiv ⇒ niemand, auch der Owner nicht, kann `main` aktualisieren (W-21). Deaktivieren nur nach Notiz in `forge/ops/` |

### 9.2 Tag-Ruleset

| # | Name | Enforcement | Ziel | Bypass | Rules |
|---|---|---|---|---|---|
| 10 | `forge-no-tags` | **Active** | Include: all tags (`**`) | leer | ☑ Restrict creations · ☑ Restrict updates · ☑ Restrict deletions (W-31, PA-06) |

### 9.3 Erwartete Wirkungen (Negativ-Drills in MD-04; jede Zeile ein Screenshot/API-Antwort in `forge/ops/RULESETS.md`)

| Versuch | Akteur | Erwartung |
|---|---|---|
| `git push origin HEAD:refs/heads/main` | Owner, Codex | abgelehnt (#1 PR-Pflicht; #2 für Codex) |
| Merge-Button eines grünen PRs | Codex | nicht verfügbar / abgelehnt (#2) |
| Merge-Button eines grünen PRs | Owner | verfügbar, Merge Commit (#2 Bypass) |
| Merge eines PRs ohne grüne Checks oder nicht „up to date“ | Owner | abgelehnt (#1, kein Bypass) |
| Force-Push auf `forge/run/codex/x-1` | Codex | abgelehnt (#3/#4) |
| Push auf `forge/run/claude/x-1` | Codex, Owner | abgelehnt (#5) |
| Push auf `forge/run/codex/x-1` | Owner | abgelehnt (#4) |
| Branch `feature/x` anlegen | Codex, Owner | abgelehnt (#8) |
| Branch löschen (beliebig) | Codex, Owner | abgelehnt (#3) |
| Tag `main` oder `v1` anlegen | Codex, Owner | abgelehnt (#10) |
| Push auf `codex/mystery-task-0005` | Codex, Owner | abgelehnt (#8) |
| Force-Push auf `forge/contract/X-v1` | Codex | erlaubt (#6, kein Block) |
| Review eines anderen dismissen | Codex | abgelehnt (#1 „Restrict who can dismiss“ ist in Rulesets Teil der Bypass-Logik: ohne Bypass darf nur der Review-Autor bzw. Admin dismissen — Owner-Verifikation nötig, SP-9) |
| `forge-halt` aktiv, Merge eines grünen PRs | Owner | abgelehnt (#9) |

SP-9 (Ergänzung zu §7.10): Ob „Restrict who can dismiss pull request reviews“ in Repository-Rulesets als eigene Option existiert oder über die Bypass-Liste ausgedrückt wird, ist beim Anlegen zu prüfen; Ziel ist: nur der Owner darf Reviews verwerfen (PAC PA-18). Da der Gate das jüngste Owner-Review liest, hat ein Dismiss durch Codex ohnehin keine Wirkung auf das Urteil, aber er soll auch nicht möglich sein.

### 9.4 Actions-Einstellungen (Org und Repo)

| Einstellung | Wert |
|---|---|
| Actions permissions | „Allow `Forge-Dice`, and select non-`Forge-Dice`, actions and reusable workflows“: nur `actions/checkout@<sha>`, `actions/upload-artifact@<sha>` (per Commit-SHA; Allowlist mit exakten SHAs) |
| Actions-Event-Policy (S1, Org-Ebene) | **Workflow `.github/workflows/forge-verify.yml`: Events `pull_request_target`, `workflow_dispatch` erlaubt. Alle anderen Workflows und Events verboten.** `workflow_dispatch`-Auslösung nur durch Org-Admin (sofern die Policy Akteure unterscheidet; sonst Repo-Setting „Require approval for … workflows“) |
| Fork pull request workflows | „Require approval for all external contributors“ (Forks sind ohnehin nicht nötig) |
| Workflow permissions (Default `GITHUB_TOKEN`) | **Read repository contents and packages permissions** |
| Allow GitHub Actions to create and approve pull requests | **aus** (PA-40) |
| Artifact and log retention | 90 Tage |
| Secrets, Variables, Environments, Runner-Gruppen, Self-hosted Runner | **keine** |
| Cache | nicht verwendet (`cache-mode: none`) |

### 9.5 Repository- und Organisationseinstellungen (MD-01)

| Bereich | Einstellung | Wert |
|---|---|---|
| Org → Member privileges | Base permissions | **No permission** |
| Org → Member privileges | Repository creation | aus (nur Owner) |
| Org → Member privileges | Repository forking (private) | — (Repo öffentlich; Forks können PRs nicht eröffnen, s. u.) |
| Org → Authentication security | Two-factor authentication | **required** |
| Org → Personal access tokens | Classic PATs | **restricted**; Fine-grained PATs: „Require administrator approval“ |
| Org → Third-party access / GitHub Apps | Installation | nur Owner |
| Org → Teams | `forge-dev-codex` = {`forge-codex`}, Repo-Rolle **Write** | einziges Team mit Zugriff |
| Org → Audit log | Streaming/Export | optional; Einträge `git.push`, `repository_ruleset.*`, `protected_branch.*` werden für `forge/ops/` zitiert |
| Repo → General → Features | Issues **an** (Tracking-Issues); Wikis, Projects, Discussions **aus** | |
| Repo → General → Pull Requests | ☑ Allow merge commits (Default message: „Pull request title“) · ☐ Allow squash merging · ☐ Allow rebase merging · ☐ Always suggest updating pull request branches · ☐ Allow auto-merge · ☐ Automatically delete head branches | W-01, W-05 |
| Repo → General → Moderation / Pull request creation | „Collaborators only“ bzw. „Limit to users explicitly granted access“ | OMD §8 |
| Repo → Collaborators and teams | Direct collaborators **keine**; Team `forge-dev-codex` Write; `Wuerfelduell` Admin via Org-Owner | |
| Repo → Code security | Secret scanning + Push protection **an** (kostenlos, öffentlich); Dependabot alerts an, Dependabot updates **aus** (würden PRs außerhalb der Namensräume erzeugen) | |
| Repo → Webhooks, Deploy keys, Environments, Secrets, Variables | **keine** | |
| Repo → Rules | #1–#10 wie oben | |
| Repo → Branches | keine Classic Branch Protection (nur Rulesets) | |

### 9.6 Bootstrap-Reihenfolge der Schutzmaßnahmen

1. Org-/Repo-Einstellungen (§9.5), Team, Actions-Einstellungen inkl. S1 (§9.4) — vor jedem Workflow.
2. Rulesets #3–#10 anlegen und per Negativ-Drill bestätigen.
3. Ruleset #1 **ohne** Required Checks und #2 anlegen (PR-Pflicht, Merge-Commit-Zwang gelten ab jetzt; die Bootstrap-PRs FORGE-OPS-0001…FORGE-VERIFIER-0003 laufen mit Review-Attestation, aber ohne maschinellen Check, §16.3).
4. Nach dem Abnahme-Merge von FORGE-VERIFIER-0003 einen Owner-PR eröffnen (z. B. `forge/owner/checks-smoke` mit einer Änderung an `forge/ops/`), beide Checks grün sehen, **dann** `forge-gate` und `forge-verify` als Required Checks in #1 eintragen (MD-11).
5. Bösartiges PR-Set (§14.4) ausführen; jede Zeile rot; Nachweis in `forge/ops/ADVERSARIAL-PRS.md`.

---
## 10. Failure Model

### 10.1 Fehlerklassen

| Klasse | Name | Erkennung (wo) | Wirkung | Wer löst auf | Wiederholung |
|---|---|---|---|---|---|
| **F1** | `STRUCTURAL` — Branch-, Autor-, Isolation-, Historien-, Spur- oder Quittungsfehler | `forge-gate` Abschnitte `policy`, `identity`, `base`, `receipt`, `history`, `lane` | PR rot; Developer soll anhalten (T-06) | Developer (Korrektur im selben PR nur, wenn der Fehler durch einen weiteren Push behebbar ist: `COMMIT_IDENTITY_MISMATCH` nein, `INTERMEDIATE_PATH_VIOLATION` nein — Historie ist unveränderlich ⇒ Owner schließt, Run n+1); Spec-Autor (Contract-PR: Force-Push) | neuer Push / neuer Run |
| **F2** | `CONTRACT_INVALID` — Parser-, Schema-, Lint-, Limit-, Scope-Definitions- oder Kettenfehler des Contracts | `forge-gate` `contract` (Contract-PR) | Contract-PR rot; keine Registrierung | Spec-Autor | Force-Push auf den Contract-Branch |
| **F3** | `SPEC_STALE` / `DEPENDENCY` — Stand des Contracts passt nicht zu `main`/`runBase` | `forge-gate` `contract` (beide PR-Typen) | PR rot; Run-PR: Developer hält an, Owner schließt | Spec-Autor (Revision mit neuem `specifiedAgainst`) | Contract-PR v<N+1>, dann Run n+1 |
| **F4** | `VERIFICATION_FAILED` — Tree-Regel, Scope/geschützte Pfade, Check-Exit ≠ 0, Inventar-Regression, Limits | `forge-verify` (`tree`, `diff`, `checks`, `inventory`), `forge-gate` `limits` | PR rot | Developer (Push im selben PR) | jeder Push ist ein neuer Lauf; keine Begrenzung |
| **F5** | `REVIEW_BLOCKED` — `REVIEW_PENDING`, `REVIEW_CHANGES_REQUESTED`, offene Findings | `forge-gate` `review`, `findings` | PR rot (erwartet bis zur Attestation) | Owner/Reviewer (Attestation) bzw. Developer (Rework, Run n+1) bzw. Spec-Autor (Revision) | Re-run nach Attestation |
| **F6** | `ATTESTATION_INVALID` — Blocksyntax, Hash, Head/Blob, Provider, Attest-Zeile, Mutanten-Vollständigkeit, `ATTEST_STALE` | `forge-gate` `review` | PR rot | Owner (Review verwerfen und korrekt neu einreichen; bei `ATTEST_STALE` neues Review) | Re-run |
| **F7** | `INFRA` — Runner-Ausfall, Timeout, `MAIN_MOVED`, `HEAD_MOVED`, API-Fehler, Image nicht ladbar, `cancelled` | beide Jobs; Check-Run `failure`/`cancelled`/`timed_out` ohne vollständige Abschnittszeilen bzw. mit `INFRA_*`-Code | PR rot; **zählt nie als Bestehen** | Owner: „Re-run all jobs“ (einmal); bleibt es rot: Ursache klären (GitHub-Status, Image-Digest, API-Limits); `MAIN_MOVED`: Owner ändert PR-Body (`edited`) | **höchstens ein** Re-run je Head und Ursache; danach gilt der Fehler als real, bis die Ursache in `forge/ops/` dokumentiert ist |
| **F8** | `INTEGRITY_HALT` — Verdacht, dass die Schutzschicht versagt hat: Push auf `main` ohne PR, Merge durch Nicht-Owner, gelöschter Branch, Force-Push auf `main`, Check-Run aus unbekannter Quelle, Workflow-Lauf außerhalb `forge-verify.yml`, Owner-Connector hat geschrieben | Owner (Audit-Log, PR-Liste, Actions-Übersicht); nachträglich durch Gate-Codes am nächsten PR (`PR_ALREADY_MERGED`, `BASE_NOT_ON_MAIN`) | `forge-halt` aktiv: kein Merge | **nur Mensch**; Analyse in `forge/ops/INCIDENT-<datum>.md`; ggf. Revert per Owner-PR (Merge Commit, nie History-Rewrite); Aufhebung des Halts erst nach Notiz | — |

### 10.2 Fail-closed-Garantien

1. Ein fehlender, übersprungener, abgebrochener oder abgestürzter Check ist **nicht** grün (Required Check verlangt `success`).
2. Ein Required Check, der nie gepostet wird (toter Workflow, S1 falsch, Policy-Stichtag), blockiert den Merge, statt ihn freizugeben (PA-30: fail-closed, aber tot — deshalb SP-1 und MP-06).
3. Die Gate-Logik hängt nicht von GitHubs Approval-Zähler ab (Approvals 0); sie hängt am Required Check `forge-gate` mit eigener Review-Prüfung. Fällt der Check aus, gibt es keinen Merge.
4. Kein Fehler wird „weggeklickt“: Es gibt keinen Waiver, keinen Bypass für `forge-main`, keine Checks-Pause. Der einzige Hebel ist eine Ruleset-Änderung durch den Owner, die im Audit-Log steht und laut MD-04 in `forge/ops/RULESETS.md` nachzutragen ist.
5. Der Developer kann keinen Fehler verbergen: Alles, was der Gate liest, kommt aus Git-Objekten oder von der API; der PR-Body wird nur für den Findings-Block und die Spec-Author-Zeile gelesen, und beides wird gegen Git bzw. Policy geprüft.

### 10.3 Was nicht als Fehler gilt

`REVIEW_PENDING` an einem unfertigen PR; `SKIP`-Abschnitte; ein geschlossener Run-PR (regulärer Abbruch); Legacy-Branches und -Dateien; Reviews von Nicht-Owner-Konten (ignoriert); ein `MAIN_MOVED` nach einer bewusst ausgelösten Neubewertung.

---

## 11. Recovery Minimum (nur GitHub-Mechanismen, keine Forge-Automatik)

| Szenario | Erkennung | Behandlung | Nachweis |
|---|---|---|---|
| **Developer bricht ab / Session verloren** (RR F-01…F-03, F-19) | Run-PR ohne Push, Owner stellt es fest | Owner schließt den PR (T-12). Run n+1 mit Handoff; Developer darf Commits des alten Branches per Cherry-Pick übernehmen (Branch bleibt lesbar). Kein Zombie-Problem: der alte Branch ist tot, weil sein PR geschlossen ist und `RUN_REOPENED` ein Wiederöffnen verhindert; ein später Push auf den alten Branch bleibt ohne PR wirkungslos | geschlossener PR, Handoff-Kommentar n+1 |
| **Stale main** — `main` hat sich während des Runs bewegt (RR SD-01) | GitHub „not up to date“; `SPEC_STALE` falls an gelesenen Stellen | (a) Keine Berührung von `reads ∪ scope`: Developer `git fetch origin refs/heads/main && git merge --no-edit origin/main` (sauber), Push; Verifier läuft neu, Review gilt fort (§7.3 Nr. 12). (b) Berührung: `SPEC_STALE` → Revision (T-10'). (c) Merge-Konflikt: kein Auflösungs-Commit im Run-Branch (`RUN_MERGE_NOT_CLEAN`); Owner schließt, Run n+1 ab frischem `main` mit Cherry-Picks | Gate-Zeilen `forge/history: PASS`, `forge/contract: PASS` |
| **Verifier rot wegen echtem Fehler** (F4) | `forge-verify` FAIL mit Code | Developer korrigiert im selben PR | neuer Lauf grün |
| **Verifier rot wegen Infrastruktur** (F7) | Check-Run `failure`/`cancelled`/`timed_out` ohne Abschnittszeilen, `INFRA_*`, `MAIN_MOVED` | Owner „Re-run all jobs“ (einmal). `MAIN_MOVED`: Owner editiert PR-Body (Zeile `Forge-Reeval: <k>`). Weiterhin rot: Ursache in `forge/ops/` notieren; ggf. Image-Digest per Owner-PR aktualisieren | Lauf-Links in `forge/ops/` |
| **Push nach Review** (RR F-21, V-24) | neuer Head; `ATTEST_STALE`, falls Nicht-Merge-Commit | Reviewer bewertet erneut (neues Packet), Owner attestiert erneut; alte Reviews bleiben als Geschichte | neues Review am neuen Head |
| **Run-Branch gelöscht** (RR F-06, FR-13) | darf nicht vorkommen (#3 Restrict deletions) | Wenn doch: F8 — `forge-halt`, Audit-Log prüfen (`PROTECTION_BYPASSED`), Ruleset wiederherstellen, Run n+1 | Incident-Notiz |
| **Force-Push auf Run-Branch** (RR F-07) | darf nicht vorkommen (#3/#4) | Wenn doch: F8 | Incident-Notiz |
| **Force-Push oder Direkt-Push auf `main`** (RR F-07b) | darf nicht vorkommen (#1/#2/#3) | F8: `forge-halt`; Zustand per `git log --first-parent` prüfen; Korrektur nur vorwärts (Revert-Owner-PR), nie Rewrite | Incident-Notiz |
| **Actions-Lauf abgebrochen** (`cancel-in-progress` durch schnellen zweiten Push, oder manuell) | Check `cancelled` | Der jüngste Push hat seinen eigenen Lauf; nichts zu tun. Manuell abgebrochen: Re-run | — |
| **GitHub-Ausfall** (RR F-11) | Checks `queued`/kein Lauf | nichts tun; nach Rückkehr Re-run oder nächster Push. Kein Zustand geht verloren, weil es keinen Forge-Zustand gibt | — |
| **Owner nicht verfügbar** | PR wartet auf Attestation/Merge | nichts passiert; der Run bleibt offen (keine Frist). Single Lane blockiert — bewusst (W-05) | — |
| **Reviewer liefert keinen Block / verweigert** (RR F-10) | kein Review | Owner wählt anderen zulässigen Reviewer (`/forge reviewer code <name>` als Issue-Kommentar, dokumentarisch); bereits vergebene Finding-IDs behalten ihre Autorschaft, der neue Reviewer darf sie nicht zurückziehen, nur neue vergeben — ein offenes Finding des alten Reviewers muss dann als `fixed` nachgewiesen werden | Issue-Kommentar |
| **Falsche Contract-Version registriert** (Tippfehler, falscher `specifiedAgainst`) | nach `M` bemerkt | Revision v<N+1> (`## Changes since v<N>` erklärt es); v<N> bleibt Geschichte | Contract-PR |
| **Falscher Merge durch Owner** (z. B. Run-PR mit `forge-halt` versehentlich deaktiviert) | Owner bemerkt | Vorwärtskorrektur: Owner-PR mit `git revert -m 1 <A>` (Merge Commit), extern reviewt wie jeder Owner-PR; Dependents sehen den Revert nicht automatisch (V0.2: PT-13) | Owner-PR |
| **Identity-Verdacht** (Push als `forge-codex` von unbekannter Quelle) | Audit-Log, `COMMIT_IDENTITY_MISMATCH` | F8; Codex-Credentials rotieren (OpenAI-seitig), Team-Mitgliedschaft prüfen | Incident-Notiz |

Grundsatz: **Jede Behandlung ist ein normaler PR, ein Schließen, ein Re-run oder eine Ruleset-Änderung.** Es gibt keinen Reconciler, keine Lease, keinen Retry-Zähler, keinen NEEDS_HUMAN-Katalog (RR §3–§4, §8 → DEFERRED); „Mensch nötig“ ist der Normalzustand jedes Wartens.

---

## 12. Parallelism Rules (V0.1)

| Regel | Inhalt | Durchsetzung |
|---|---|---|
| P-1 | Höchstens **ein offener Run-PR** im Repository | Gate `RUN_LIMIT` (API-Zählung offener PRs mit Head-Präfix `forge/run/`) |
| P-2 | Höchstens **ein offener Run-PR je Task** folgt aus P-1; Run-Nummern sind lückenlos | `RUN_NUMBER_NOT_NEXT` |
| P-3 | **Beliebig viele offene Contract-PRs**, aber höchstens einer je Task | `CONTRACT_PR_DUPLICATE` |
| P-4 | Kein Contract-PR für einen Task mit offenem Run-PR | `RUN_ACTIVE` |
| P-5 | Owner-PRs sind unbegrenzt; sie bewegen `main` und können offene Run-PRs „stale“ machen → Owner merged Owner-PRs bevorzugt, wenn kein Run-PR „Ready for review“ ist | Konvention (`forge/roles/attestation-checklist.md`) |
| P-6 | Contract-Registrierungen während eines laufenden Runs sind erlaubt (sie berühren nur `forge/contracts/**`, nie `reads ∪ scope` eines Produkt-Tasks); der Developer merged `main` sauber nach | `RUN_MERGE_NOT_CLEAN`, Fortgeltungsregel |
| P-7 | Mehrere Developer-Identitäten gibt es nicht (OE-4); mehrere Reviewer parallel sind erlaubt (das jüngste Owner-Review zählt) | Policy |
| P-8 | Scope-Leases, Pfadklassen, `maxActiveRuns > 1`, RECONCILE-Automatik: **V0.2** (V2-02) | — |

Praktische Folge für die Roadmap: VS-1, VS-2, VS-3 können **gleichzeitig spezifiziert, reviewt und registriert** werden; implementiert wird nacheinander (W-20). Der kritische Pfad der Mystery-Roadmap (ROAD: VS-3 → VS-4 → VS-5 → VS-6) bleibt unverändert; die Parallelität der Roadmap war immer Contract-Parallelität, da es einen Developer gibt.

---
## 13. Historical Migration

Grundsatz (W-15, HP D-13): **Geschichte wird eingefroren, nie umgeschrieben.** Legacy ist alles, was vor dem ersten Registrierungs-Merge unter diesem Dokument entstanden ist. Nur zwei Legacy-Dateien werden berührt (Löschung der Koordinationsdateien, ein Absatz in `BASELINE-STATUS.md`), beides per Owner-PR in FORGE-OPS-0001.

| # | Objekt | Ist (belegt) | Entscheidung | Aktion | Wann |
|---|---|---|---|---|---|
| 1 | TASK-0001, TASK-0002, TASK-0003 | Code auf `main`, kein Contract, keine Forge-Provenienz [CODE, BASELINE-STATUS] | **Legacy-akzeptiert**, Anker `3d7545d…` | keine; als Dependency nur `{taskId, acceptedCommit: 3d7545d…, provenance: "legacy"}` | — |
| 2 | `forge/contracts/TASK-0004.md` | YAML-Frontmatter mit `status: approved`, `architecture_review: pending_chatgpt_final_check`, 604 Zeilen, Code implementiert bei `e9cb8e2` [CODE, GIT] | **eingefroren**, Legacy-akzeptiert; keine weitere Version (`LEGACY_TASK_FROZEN`) | keine | — |
| 3 | TASK-0005: Contract v2 auf `codex/mystery-task-0005` (`fab792a`, Blob `1e6f36e5…`, 514 Zeilen), Claude-APPROVE auf `claude/forge-architecture-review-hjdq89` (`be40a68`), `forge/reviews/TASK-0005.architecture-review.md` (v1, REQUEST_CHANGES) auf `main` [GIT, CODE] | nicht registriert, nicht akzeptiert | **liegen lassen** bis VS-3; dann `forge/contracts/TASK-0005.md` **v3** im Format 2 mit `supersedes: { contractVersion: 2, blobSha: "1e6f36e5…", contentHash: sha256(Blob-Bytes ohne Domänenpräfix), format: "legacy" }`, Pflichtabschnitt `## Migration from Legacy`, `limits.maxProductionLines: 550`, **neues** Architektur-Review; die Claude-Freigabe auf `be40a68` ist historische Evidenz, kein Forge-Approval | Contract-PR `forge/contract/TASK-0005-v3` | bei VS-3 (§15.5) |
| 4 | `forge/contracts/FORGE-CORE-0001A.md`, `…-PATCH-0001.md`, `FORGE-CORE-0001B.md`, `FORGE-CORE-0001B.v2.md` | Format 1, Sidecar-Datei verletzt die Pfadregel [CODE] | **eingefroren**; Tasks Legacy-akzeptiert (Kern liegt auf `main`); Sidecar bleibt als Datei | `tests/forge/dogfood.test.ts` verliert in FORGE-CORE-0002 die Sidecar-Akzeptanz (liegt im Scope `tests/forge/**`) | CORE-0002 |
| 5 | `forge/approvals/*.json` (2 Dateien, `recordedBy` KI-Session) | DA C-21 KRITISCH | **eingefroren**, Pfad `always`-geschützt; keine neuen Dateien | keine | — |
| 6 | `forge/reviews/**` | Review-Prosa des Pilots | **eingefroren**; neue Reviews nur als GitHub-Reviews | keine | — |
| 7 | `forge/coordination/CLAUDE.md`, `CODEX.md` | Koordinations-Logs; Ausnahme im Kern [CODE]; Injektionskanal (DA #8, PA-112) | **löschen** (Historie bleibt) | Owner-PR | FORGE-OPS-0001 |
| 8 | `forge/BASELINE-STATUS.md` | „Eventlog authoritative“, Prozessschulden | **ein Absatz ergänzen**: „Seit V0.1 ist `main` die einzige Wahrheit; der Kern-Eventlog ist eine In-Memory-Bibliothek; maßgeblich ist `forge/ops/ARCHITECTURE-FREEZE-V0.1.md`.“ Rest unverändert | Owner-PR | FORGE-OPS-0001 |
| 9 | Branches `codex/forge-core-v2-repair`, `codex/task-0004-contract`, `codex/mystery-task-0005`, `claude/forge-architecture-review-hjdq89` | Legacy [GIT] | **eingefroren** (Ruleset #3 kein Löschen, #8 kein Update) | keine | — |
| 10 | Branch `forge/run/codex/IDENTITY-SPIKE-1` (`8dc692b`, leerer Commit) und PR #2 (Draft) | Identity-Spike [GIT, API] | PR #2 **schließen, nicht mergen**, nachdem der Audit-Log-Beleg in `forge/ops/IDENTITY-SPIKE.md` liegt; Branch bleibt. Der Name passt in das Run-Muster (`TASK = IDENTITY-SPIKE`, `n = 1`); der Gate wird ihn als geschlossenen Run eines Tasks ohne Contract sehen — wirkungslos, weil `RUN_REOPENED` und `CONTRACT_*` jede Wiederverwendung verhindern | Owner | MD-02 |
| 11 | PR #1 (merged, `3d7545d`) | Baseline-Merge [GIT] | nichts | — | — |
| 12 | Hash-Fixtures mit LF-Bytes, Windows-CRLF-Risiko (BASELINE-STATUS, DA C-34) | kein `.gitattributes` [CODE] | `.gitattributes` `* text=auto eol=lf`, `.nvmrc` `22` | Owner-PR | FORGE-OPS-0001 |
| 13 | `tests/forge-red-team/**` (Red-Team-Experimente, heute auf `main`) | Tests, die bekannte Lücken dokumentieren [CODE] | bleiben; Pfad `forge`-geschützt (`tests/forge*`); Anpassung nur durch FORGE-Tasks, wenn CORE-0002 Verhalten ändert (z. B. Koordinations-Ausnahme) | ggf. in CORE-0002 Scope aufnehmen | CORE-0002 |
| 14 | Kern-Begriffe „Observer“, `remote_observed`, Lease, persistierter Log | Code und frühere Berichte | in V0.1 **ohne Konsumenten**; Code bleibt (Bibliothek), wird nicht entfernt (kein Nutzen, Review-Kosten) | keine | V0.2 entscheidet |
| 15 | Frühere Berichte (DA, RT, RR, CHA, MP, HP, IGP, VD, OMD, DRILL, CSV2, PKG, PAC, ROAD, AVD, VS2, T6, SOLV) | Projektdateien | **nicht umgeschrieben**; dieses Dokument gilt bei Widerspruch (§1) | Verweis in `forge/ops/ARCHITECTURE-FREEZE-V0.1.md` | FORGE-OPS-0001 |
| 16 | ID „TASK-0006“ im TASK-0005-v2-Review (Verbalisierungs-Task) | Namenskollision mit VS-1 (T6) | VS-1 erhält `TASK-0006` (OE-2); der Verbalisierungs-Task erhält seine ID bei Spezifikation (nicht 0006) | — | OE-2 |

---

## 14. Drill Readiness (`FORGE-DRILL-0001`)

### 14.1 Die drei Spezifikationslücken des Drill-Berichts (N-5, N-6, N-7) und der Trigger-Punkt (N-8)

| Lücke | Festlegung hier |
|---|---|
| N-5 Contract-Registrierung per Merge Commit | W-01/W-02: `M` Registrierungs-Merge, `C = M^2` Contract-Commit, Ein-Commit-Regel, Invarianten `REGISTRATION_TREE_MISMATCH`, `CONTRACT_MERGE_NOT_ISOLATED`, `CONTRACT_COMMIT_NOT_LINEAR`; Handoff nennt `contract_commit = C` **und** `registration_merge = M` |
| N-6 Check-Namen | W-18/§8: genau `forge-gate` und `forge-verify`, beide required + strict; Abschnittszeilen für die Granularität |
| N-7 Handoff für Run n > 1 | W-19/§5.9.5: Owner-Kommentar `FORGE DEVELOPER HANDOFF v2` auf dem Tracking-Issue mit `previous_pr`; Gate prüft `RUN_NUMBER_NOT_NEXT` und den Findings-Block |
| N-8 Re-Evaluierung bei `edited` | W-29/W-32: Quittung im leeren ersten Commit (unveränderlich); Workflow läuft auf `edited`; Attestations-Neubewertung per Re-run/`edited` |

N-1 (keine Pipeline) → FORGE-VERIFIER-0001…0003, PLAT-0001, OPS-0001; N-2 (keine Mutantenliste) → CORE-0002 Format 2; N-3 (Identity-Spike) → MD-02/OE-5; N-4 (S1) → MD-03/SP-1.

### 14.2 Drill-Annahmen A-1…A-8 abgeglichen

| Annahme | Stand jetzt |
|---|---|
| A-1 vier Check-Namen | ersetzt: zwei Checks (§8); die **Erwartungen** je Injektion bleiben, nur die Zuordnung ändert sich (Contract-Prüfungen → `forge-gate` Abschnitt `contract`; Approval → Abschnitt `review`) |
| A-2 `forge/spec/<TASK>` | ersetzt: `forge/contract/<TASK>-v<N>` (W-22); Run-Branch wie angenommen |
| A-3 `contract_commit = R` | ersetzt: `contract_commit = C = M^2`, zusätzlich `registration_merge = M` (W-02); FI-10 (Registrierung mit Fremdcode im Seitenzweig) bleibt Injektion, erwarteter Code `CONTRACT_MERGE_NOT_ISOLATED` bzw. `INTERMEDIATE_PATH_VIOLATION` |
| A-4 Mutantenliste im Frontmatter | bestätigt (Format 2 `mutants[]`, W-13); Ausführung durch Code-Reviewer, nicht Verifier — Injektionen „Mutant überlebt“ werden im Review-Block sichtbar (`mutant: m2 survived` ⇒ blockierendes Finding), nicht im Check |
| A-5 geschützte Pfade | bestätigt mit PKG-Semantik (W-30); `src/domain/**`, `tests/*.test.ts` frei — der Drill bleibt wo er ist |
| A-6 Adapter-Blöcke `FORGE-REVIEW v1`/`FORGE-ATTEST` | ersetzt durch `FORGE REVIEW v1`/`FORGE ATTEST v1` mit `packet`-Hash (W-23, §5.9) |
| A-7 `allowedChecks` | bestätigt als `policy.checks` (§3.4) |
| A-8 `forge-halt` | bestätigt (W-21) |

### 14.3 Drill-Contract (Format 2, Eckwerte; Volltext schreibt der Spec-Autor nach DRILL §4–§7)

| Feld | Wert |
|---|---|
| `taskId` | `FORGE-DRILL-0001` — Präfix `FORGE-` nur wegen des Namens; der Scope liegt vollständig **außerhalb** geschützter Pfade, die Stufe `forge` wird nicht genutzt |
| `scope.create` | `src/domain/parse-report.ts`, `tests/parse-report.test.ts` |
| `scope.modify` | `[]` |
| `reads` | `src/domain/case-truth.ts`, `src/domain/case-solution.ts`, `src/domain/npc-knowledge.ts` (die drei Parser) |
| `dependencies` | `[]` (die Parser sind Legacy-Code; eine Legacy-Dependency wäre zulässig, ist aber nicht nötig, weil nichts gebunden werden muss) |
| `limits` | `maxProductionLines: 150`, `maxChangedFiles: 2` |
| `mutants` | die drei aus DRILL §6 (Escape-Reihenfolge, Bidi-Bereich, Sortierung), `tests: ["tests/parse-report.test.ts"]` |
| `requiredChecks` | `typecheck`, `test` |
| Rollen | Spec-Autor **Codex** (`Forge-Spec-Author: codex`) ⇒ Architektur-Reviewer **Claude oder Grok** (nicht ChatGPT, Provider-Regel); Developer Codex; Code-Reviewer **der jeweils andere** (Claude/Grok); Attestierer und Merger Owner. Alternative: Owner pusht einen Claude-Entwurf (`Forge-Spec-Author: claude`) ⇒ Architektur-Review ChatGPT, Code-Review Claude/Grok. OE-1 wählt |
| Runs | Run 1 = Injektionslauf (alle anwendbaren FI-01…FI-25, Ergebnis je Injektion als Abschnittszeile zitiert), vom Owner **geschlossen**; Run 2 = Abnahmelauf, gemergt. Beide Runs nutzen dieselbe Contract-Version |

### 14.4 Bösartiges PR-Set für MD-11 (vor dem Drill; jede Zeile muss rot sein)

| # | Versuch | Erwartete Zeile |
|---|---|---|
| X-01 | Run-PR ohne Quittungs-Commit | `forge/receipt: FAIL RECEIPT_MISSING` |
| X-02 | Quittung mit falschem `content_hash` | `forge/receipt: FAIL RECEIPT_MISMATCH` |
| X-03 | Quittung nicht als erster Commit | `forge/receipt: FAIL RECEIPT_NOT_FIRST` |
| X-04 | Run-PR von `Wuerfelduell` (Branch per Admin-Versuch) | Ruleset #4 lehnt Push ab; falls doch: `forge/identity: FAIL OWNER_ON_RUN_BRANCH` |
| X-05 | Run-Branch `forge/run/codex/<TASK>-2` ohne Run 1 | `forge/lane: FAIL RUN_NUMBER_NOT_NEXT` |
| X-06 | zweiter offener Run-PR (anderer Task) | `forge/lane: FAIL RUN_LIMIT` |
| X-07 | Commit mit fremder Autor-E-Mail | `forge/identity: FAIL COMMIT_IDENTITY_MISMATCH` |
| X-08 | Datei außerhalb `scope` | `forge/diff: FAIL SCOPE_VIOLATION` |
| X-09 | `package.json` geändert (`"test": "exit 0"`) | `forge/diff: FAIL PROTECTED_PATH_CHANGED` |
| X-10 | `vitest.config.ts` hinzugefügt | `forge/diff: FAIL PROTECTED_PATH_CHANGED` |
| X-11 | `describe.skip` in einer Scope-Testdatei, bestehende Tests unverändert | `forge/inventory: FAIL INVENTORY_REGRESSION` (skipped steigt) |
| X-12 | Testdatei gelöscht | `forge/diff: FAIL SCOPE_VIOLATION` (deleted) |
| X-13 | Symlink `src/domain/x.ts → ../../package.json` | `forge/tree: FAIL TREE_RULE_VIOLATION` |
| X-14 | Datei `src/Domain/x.ts` (Casefold-Kollision) | `forge/tree: FAIL TREE_RULE_VIOLATION` |
| X-15 | Zwischencommit legt `src/forge/evil.ts` an, Folgecommit löscht sie | `forge/history: FAIL INTERMEDIATE_PATH_VIOLATION` |
| X-16 | Merge eines fremden Branches in den Run-Branch | `forge/history: FAIL RUN_MERGE_FOREIGN_PARENT` |
| X-17 | Contract-PR mit zwei Commits | `forge/history: FAIL CONTRACT_PR_NOT_SINGLE_COMMIT` |
| X-18 | Contract-PR mit zweiter Datei | `forge/history: FAIL CONTRACT_PR_NOT_ISOLATED` |
| X-19 | Contract mit `status: approved` im Frontmatter | `forge/contract: FAIL METADATA_SCHEMA` |
| X-20 | Contract mit `scope.modify: ["src/forge/state.ts"]` für `TASK-`-ID | `forge/contract: FAIL SCOPE_PROTECTED_FOR_TASK_CLASS` |
| X-21 | Contract ohne End-Marker | `forge/contract: FAIL END_MARKER_MISSING` |
| X-22 | Contract registriert, dann Owner-PR ändert eine `reads`-Datei, dann Run-PR | `forge/contract: FAIL SPEC_STALE` |
| X-23 | Review-Block mit `reviewer: chatgpt` auf Codex-Run | `forge/review: FAIL REVIEWER_NOT_INDEPENDENT` |
| X-24 | Attest-Zeile mit falschem Blockhash | `forge/review: FAIL ATTEST_INVALID` |
| X-25 | Review-Block ohne `mutant:`-Zeile für m3 | `forge/review: FAIL MUTANT_REPORT_INCOMPLETE` |
| X-26 | Push nach Attestation (Nicht-Merge-Commit) | `forge/review: FAIL ATTEST_STALE` |
| X-27 | PR-Body nach grünem Gate editiert (Findings-Block entfernt) | neuer Lauf (`edited`): `forge/findings: FAIL FINDINGS_NOT_CARRIED` |
| X-28 | PR-eigener Workflow `.github/workflows/x.yml` mit `on: push` | kein Lauf (S1); zusätzlich `forge/diff: FAIL PROTECTED_PATH_CHANGED` |
| X-29 | Tag `main` pushen | Ruleset #10 lehnt ab |
| X-30 | Branch `feature/x` anlegen | Ruleset #8 lehnt ab |
| X-31 | Direktpush auf `main` | Rulesets #1/#2 lehnen ab |
| X-32 | Merge-Versuch eines grünen PRs durch `forge-codex` | Ruleset #2 lehnt ab (SP-5) |
| X-33 | Run-PR wieder öffnen nach Schließen | `forge/base: FAIL RUN_REOPENED` |

Ergebnisse (Lauf-Links, Zeilen) in `forge/ops/ADVERSARIAL-PRS.md`. Die PRs bleiben geschlossen stehen (Branches unlöschbar); ihre Branch-Namen verbrauchen Run-Nummern fiktiver Tasks (`FORGE-X-0001` o. ä.), damit sie den Drill nicht stören.

### 14.5 PAC „Required Before Drill“ (12 Punkte) → wo erledigt

| PAC §6 | hier |
|---|---|
| 1 S1 | MD-03, SP-1 |
| 2 Required-Check-Menge | §8, MD-11 |
| 3 Identity-Spike, User-ID-Bindung | MD-02, §3.4 (IDs), PA-116 |
| 4 Rulesets inkl. Tag-Ruleset, Dismiss-Beschränkung | §9, MD-04, SP-9 |
| 5 CODEOWNERS mit ≥ 2 Identitäten | **anders gelöst**: Approvals 0, Code-Owner-Review aus, Attestation im Required Check, `forge-main-merge` (W-27) — der Deadlock entfällt ohne zweite Identität |
| 6 Receipt unveränderlich | W-29 |
| 7 Merge-Commit-Registrierung mit commitweisem Walk | W-01/W-02, §7.3 Nr. 6 |
| 8 voll qualifizierte Refs | W-31, §7.7 |
| 9 `/work`-Isolation, Kontroll-Mutant | §7.4 Nr. 4 (frisches `/work` je Phase); Kontroll-Mutant gehört zu VERIFIER-0004 (V2-01), in V0.1 ersetzt durch Reviewer-Replikation (der Reviewer kann `toString`-Orakel nicht täuschen, weil er den Mutanten selbst anwendet) |
| 10 Protected-Path-Semantik | W-30 |
| 11 `MAIN_MOVED` | §7.2 |
| 12 keine Secrets, Actions-Approve aus | §9.4, MD-01 |

### 14.6 Urteil

- **Design: GO.** Mit diesem Dokument sind alle Spezifikationslücken geschlossen, die DRILL §12 und PAC §8 nannten; es gibt keine zwei Quellen mehr für Check-Namen, Pfadschutz, Registrierung oder Blöcke.
- **Ausführung: NO-GO heute.** Auf `main` gibt es keinen Workflow, keine Policy, keine Rulesets (lesbar), keinen Nachweis zu S1; der Identity-Spike ist nur als Owner-Aussage belegt.
- **GO-Kriterien (alle erfüllt ⇒ Drill startet):** MD-01…MD-14 abgehakt (§2.1); SP-1…SP-9 beantwortet und abgelegt; X-01…X-33 rot und dokumentiert; `forge/ops/` enthält `IDENTITY-SPIKE.md`, `S1-RESULT.md`, `RULESETS.md`, `ADVERSARIAL-PRS.md`; Tracking-Issue `forge: FORGE-DRILL-0001` existiert; kein offener Run-PR.

---

## 15. Productive Run Readiness (VS-1 „Accusation & Verdict“)

### 15.1 Wann VS-1 starten darf

Genau dann, wenn MP-01…MP-07 (§2.2) erfüllt sind. Nachweisorte: `forge/ops/DRILL-0001.md` (MP-01/02), Owner-Kommentar auf dem Tracking-Issue `forge: TASK-0006` (MP-03: OE-Entscheidungen und D1–D10 als Arbeitsannahmen, verlinkt auf AVD), Contract-PR `forge/contract/TASK-0006-v1` (MP-04), Handoff-Kommentar (MP-05 Reviewer-Benennung), `forge/ops/S1-RESULT.md` (MP-06), PR-Liste (MP-07).

### 15.2 Contract-Form für TASK-0006 (Format 2; Werte aus AVD §14/ROAD; Platzhalter in spitzen Klammern)

```json
{
  "forgeContractFormat": 2,
  "taskId": "TASK-0006",
  "title": "Accusation & Verdict (VS-1)",
  "contractVersion": 1,
  "specifiedAgainst": "<main-SHA zum Zeitpunkt des Lesens; nach FORGE-DRILL-0001-Abnahme>",
  "supersedes": null,
  "dependencies": [
    { "taskId": "TASK-0004", "acceptedCommit": "3d7545d843883418348004e68717399a64da7a7d", "provenance": "legacy" }
  ],
  "reads": [
    "src/domain/case-semantics.ts",
    "src/domain/case-solution.identity.ts",
    "src/domain/case-truth.ts",
    "tests/case-solution.fixture.ts",
    "tests/case-truth.fixture.ts"
  ],
  "scope": {
    "create": [
      "src/domain/case-accusation.ts",
      "tests/case-accusation.fixture.ts",
      "tests/case-accusation.test.ts",
      "tests/case-accusation.typecheck.ts",
      "tests/conclusion-evaluation.test.ts"
    ],
    "modify": [ "src/domain/case-solution.ts" ]
  },
  "requiredChecks": [
    { "name": "typecheck", "command": "npm run typecheck" },
    { "name": "test", "command": "npm test" }
  ],
  "mutants": [ "<8 Mutanten aus AVD §12 mit id m1…m8, file ∈ scope, before/after, tests>" ],
  "limits": { "maxProductionLines": 300, "maxChangedFiles": 6 },
  "findings": []
}
```

Festlegungen: Die Änderung an `src/domain/case-solution.ts` ist **additiv** (ROAD); `reads` nennt die Dateien, die der Spec-Autor tatsächlich gelesen hat (die Liste oben ist der Vorschlag aus den Dateinamen auf `main`, der Spec-Autor passt sie an); die Legacy-Platzhalter aus VS2 §15/SOLV §17 (`27075fe…`, `5bfa5a4…`, `e9cb8e2…`) werden **nicht** verwendet (W-15). D1–D10 aus AVD gelten als Arbeitsannahmen und stehen im Body unter `## Non-Goals`/`## Design` (OE-2).

### 15.3 Rollen für VS-1

| Rolle | Besetzung | Regel |
|---|---|---|
| Spec-Autor | Empfehlung: Owner pusht einen aus AVD abgeleiteten Entwurf (`Forge-Spec-Author: claude`); Alternative: Codex (`codex`) | §4.3 Nr. 2 |
| Architektur-Reviewer | bei `claude`: ChatGPT oder Grok; bei `codex`: Claude oder Grok | Provider ≠ Spec-Autor |
| Developer | `forge-codex` | einzige Developer-Identität |
| Code-Reviewer | Claude (Session ohne Projektdateien) oder Grok; **nie** ChatGPT | Provider ≠ OpenAI |
| Attestierer / Merger | `Wuerfelduell` | — |

### 15.4 Grenzen für VS-1

Kein geschützter Pfad im Scope (Produkt-Task); `limits` 300/6; genau sechs Scope-Dateien (fünf neue, eine additiv geänderte); keine Änderung an `tests/case-solution.*` oder anderen Bestandsdateien außer `case-solution.ts` (sonst Revision); Mutanten decken die acht AVD-Fehlerklassen ab; Inventar steigt (neue Tests), kein `skipped`.

### 15.5 Nach VS-1

VS-2 (Evidence Access) und VS-3 (TASK-0005 v3, 550 Zeilen, Legacy-`supersedes`) dürfen bereits **während** VS-1 als Contract-PRs eröffnet, reviewt und registriert werden (P-3/P-6); ihre Runs folgen nacheinander in der Reihenfolge, die der Owner im Handoff festlegt (ROAD-Empfehlung: VS-2, dann VS-3; kritischer Pfad VS-3 → VS-4 → VS-5 → VS-6). SOLV ist Entwurfsgrundlage für VS-6 und für V0.1 nicht entscheidungsrelevant; der dort skizzierte Contract (Format 2, 400/4, 8 Mutanten) ist mit diesem Dokument verträglich.

---
## 16. Implementation Sequence (genau acht Tasks)

### 16.1 Reihenfolge und Abhängigkeiten

```
[1] FORGE-OPS-0001 (Owner-PRs + Einstellungen)
        │
        ├────────────► [2] FORGE-VERIFIER-0001 (Format 1)  ─┐
        │                                                    ├─► [4] FORGE-VERIFIER-0002 ─┐
        └────────────► [3] FORGE-CORE-0002 (Format 1) ──────┤                             ├─► [6] FORGE-VERIFIER-0003 ─► MD-11 ─► [7] FORGE-DRILL-0001 ─► [8] TASK-0006 (VS-1)
                                                             └─► [5] FORGE-PLAT-0001 ──────┘
```

Contracts dürfen parallel entworfen und registriert werden; Runs laufen nacheinander (Single Lane). Reihenfolge der Runs: 2 → 3 → 4 → 5 → 6 → 7 (zwei Runs) → 8. [2] und [3] sind unabhängig; welcher zuerst läuft, entscheidet der Owner (Empfehlung: [2], weil der Contract validiert vorliegt).

### 16.2 Task-Karten

| # | ID (Platzhalter) | Ziel | Abhängigkeiten | Scope (Pfade) | Produktionszeilen (Grenze) | Akzeptanz | Reviewer (Architektur / Code) | Format / Modus |
|---|---|---|---|---|---|---|---|---|
| 1 | **FORGE-OPS-0001** | Betriebsgrundlage: Org-/Repo-/Actions-Einstellungen, Team, S1, Rulesets #1–#10 (ohne Required Checks), Hygiene-Dateien, Policy v1, Rollenvorlagen, Löschung Koordination, BASELINE-Absatz, `forge/ops/{IDENTITY-SPIKE,S1-RESULT,RULESETS}.md`, Kopie dieses Dokuments nach `forge/ops/ARCHITECTURE-FREEZE-V0.1.md`, PR #2 schließen | keine | `.gitattributes`, `.nvmrc`, `.github/CODEOWNERS`, `forge/policy.json`, `forge/roles/*.md`, `forge/ops/*.md`, `forge/BASELINE-STATUS.md`, Löschungen `forge/coordination/*` | — (Konfiguration und Prosa; kein Produktionscode) | §9.5/§9.4 Tabellen vollständig; Negativ-Drills §9.3 dokumentiert; Policy parst gegen das Schema aus [5] (vorab: JSON-Lint); S1 Negativ-/Positivtest; Audit-Log-Zitat des Spikes | kein Architektur-Review; Code-Review = externes Review der Textdateien durch ChatGPT **oder** Claude (Owner-Provider `human` ⇒ frei), attestiert als COMMENTED | Owner-PRs auf `forge/owner/**`; mehrere PRs erlaubt (Einstellungen zuerst, Dateien danach) |
| 2 | **FORGE-VERIFIER-0001** | Diff- und Pfadautorität: `RepoPath`-Regeln, casefold-Kollisionen, geschützte Pfade (`always`/`forge`, Basename + Präfix), Listing-Differenz aus zwei `ls-tree`-Listings, Tree-Regeln, Scope-Urteil über Kern | [1] (Team, Rulesets #3–#8) | `src/forge-verifier/{paths,protected,listing,tree,diff,index}.ts` u. a. (14 Dateien laut V1-DRAFT), `tests/forge-verifier/**` | 300–400 (**400**, Policy-Default) | V1-DRAFT-Testmatrix grün; differenzielle Tests gegen Kern-`isProtectedPath` nach [3] (vorerst gegen Liste); keine Git-Aufrufe (rein) | OE-1 (Empfehlung: ChatGPT Architektur, da Spec-Autor Claude-Entwurf vom Owner gepusht; Code: Claude ohne Projektdateien oder Grok) | **Format 1** (Hash `341ec983…`), **Bootstrap-Run** (§16.3) |
| 3 | **FORGE-CORE-0002** | Kern Format 2: `ContractMetadataV2Schema`, Hash-Domäne v2, End-Marker, Pflichtabschnitte-Lint, `isProtectedPath`, Wegfall `PROCESS_NOTE_PREFIX`, `runBase` im Start-Gate, `DeveloperReport` ohne Mutationen, `OWNER_NOT_HUMAN` für alle Owner-Events, ASCII-Regel für Check-Kommandos, `RefName` voll qualifiziert, Sidecar-Akzeptanz aus `dogfood.test.ts`, Textregeln (Bidi/NUL/Zero-Width) | [1] | `src/forge/{contract-document,verification,start-gate,state,events,primitives,protected-paths}.ts`, `tests/forge/**`, ggf. `tests/forge-red-team/**` | 260–340 (**400**) | alle 1087 Bestandstests grün oder begründet geändert (nur Verhaltensänderungen aus diesem Dokument); neue Tests für jede Regel aus §5.3–§5.5; RTN-05/06/07/08/11/12/13/17 aus RT §6 als Tests grün | OE-1 | **Format 1**, Bootstrap-Run |
| 4 | **FORGE-VERIFIER-0002** | Git-Fakten und Gate-Regeln: Fetch/Refs, `runBase`, First-Parent-Kette, Registrierungs-Invarianten, Commit-Walk (`INTERMEDIATE_PATH_VIOLATION`, Clean-Merge-Regel), `SPEC_STALE`, Existenzregeln, Quittung aus Commit-Message, Run-Nummer/Spur (über API-Client aus [5] oder Stub), Identitäts-E-Mails, Limits (`numstat`), `MAIN_MOVED`/`HEAD_MOVED`, Format-Regel, Legacy-Dependencies, Abschnittszeilen | [2], [3] | `src/forge-verifier/{git,gate,receipt,history,lane,limits}.ts`, `tests/forge-verifier/**` (Wegwerf-Repos in Tests) | 320–400 (**400**) | Testfälle für jeden Code aus Anhang B, der in §7.3 Nr. 1–9 vorkommt; Tag-`main`-Fall; `refs/replace`-Fall; Shallow-Fall; add+delete-Fall; Clean-Merge-Fall | OE-1 | Format 1, falls [3] noch nicht abgenommen; sonst Format 2; Bootstrap-Run |
| 5 | **FORGE-PLAT-0001** | Plattformschicht: `PolicySchema`, Blockparser (§5.9, fünf Blöcke + Kopfzeile), Blockhash, Review-Gültigkeit (Blob-/Head-Bindung, Fortgeltung per `patch-id`, Provider-Unabhängigkeit, Owner-Modus, Mutanten-Vollständigkeit, `FINDINGS_OPEN`), Findings-Vollständigkeit über PR-Historie, Review Packet (`packetCore`), lesender GitHub-API-Client (PR, Reviews, PR-Liste, Ref) | [3] | `src/forge-platform/{policy,blocks,review,findings,packet,github}.ts`, `tests/forge-platform/**` | 300–400 (**400**) | Grammatik-Tests je Block (positiv/negativ, Zeichenregeln), Attest-Hash, Owner-Modus, Unabhängigkeits-Matrix (4 Provider), Findings-Carry-Forward-Szenarien aus DA §8.2/RT DRT-02/35, API-Client gegen aufgezeichnete Antworten | OE-1 | **Format 2** (erster Format-2-Contract, nach Abnahme von [3]); Bootstrap-Run |
| 6 | **FORGE-VERIFIER-0003** | Materialisierung aus Blobs, Container-Lauf (Flags §7.4), Baseline-Phase, Inventar (JSON-Reporter), Evidence v1, `toKernelEvidence`, Job-Summary, Packet-Ausgabe, CLI `gate`/`verify`, Workflow `forge-verify.yml`, `forge/verifier/image.json` | [2], [4], [5] | `src/forge-verifier/{materialize,sandbox,inventory,evidence,summary,cli}.ts`, `.github/workflows/forge-verify.yml`, `forge/verifier/image.json`, `tests/forge-verifier/**` | 300–400 (**400**) | Verifier verifiziert sich selbst nach dem Merge auf einem Owner-Smoke-PR (MD-11); Evidence-Schema-Tests; Container-Flags als Test (argv-Snapshot); Inventar-Regel-Tests; `if: always()`-Konstruktion per Workflow-Lint | OE-1 | **Format 2**; Bootstrap-Run (letzter); optionaler Owner-Smoke per `workflow_dispatch` vom Run-Branch vor dem Merge |
| 7 | **FORGE-DRILL-0001** | Parse-Report für die Domain-Parser (DRILL §4); zugleich erster Forge-managed Run mit allen Injektionen (Run 1) und Abnahme (Run 2) | MD-01…MD-14 (Prozess); keine Code-Dependency | `src/domain/parse-report.ts`, `tests/parse-report.test.ts` | 80–110 (**150**), 2 Dateien | DRILL §10 Erfolgskriterien; jede Injektion rot mit erwartetem Code oder dokumentiertes Restrisiko; `forge/ops/DRILL-0001.md` | Spec-Autor Codex ⇒ Architektur Claude/Grok, Code der jeweils andere (§14.4) | **Format 2**; **Forge-Run** (Verifier aktiv, Required Checks an) |
| 8 | **TASK-0006 (VS-1)** | Accusation & Verdict nach AVD (D1–D10), §15.2 | `TASK-0004` (legacy), MP-01…MP-07 | §15.2 (6 Dateien) | 205–280 (**300**) | AVD §13 Akzeptanzkriterien; 8 Mutanten vom Reviewer getötet; Inventar steigt; Merge Commit `A` auf `main` | §15.3 | **Format 2**; Forge-Run — **der erste produktive Mystery-Run** |

Summe Produktionszeilen Forge-Code (2–6): etwa 1 500–1 950, jeweils unter 400 je Task (HP-Vorgabe). Zwei Format-1-Contracts (ggf. drei), vier Format-2-Contracts.

### 16.3 Bootstrap-Modus für die Runs [2]–[6]

Bis `forge-verify.yml` auf `main` liegt und die Required Checks eingetragen sind (MD-11), gibt es keinen maschinellen Verifier. Für diese fünf Run-PRs gilt ersatzweise, **ohne Ausnahme**:

1. Alle Rulesets außer den Required Checks sind aktiv (PR-Pflicht, Merge Commit, Namensräume, kein Force-Push, nur Owner merged).
2. Der Developer arbeitet exakt nach `forge/roles/developer.md` (Quittungs-Commit, Branch ab `main`, Draft → Ready).
3. Der **Code-Reviewer ersetzt den Verifier**: Er klont `H`, prüft `git diff --raw --no-renames runBase H` gegen den Contract-Scope und die geschützten Pfade (mit dem Kern-Skript auf `main`, sobald [3] gemergt ist; vorher per Liste aus V1-DRAFT), führt `npm run typecheck` und `npm test` aus, vergleicht das Testinventar mit `runBase`, wendet jeden Mutanten an und meldet alles im Review-Block (`mutant:`-Zeilen, zusätzlich `summary:` mit Inventar und Exit-Codes).
4. Der Owner attestiert erst nach eigener Sichtung der Abschnittsergebnisse im Block und merged per Merge Commit.
5. Jeder Bootstrap-Run wird in `forge/ops/BOOTSTRAP-RUNS.md` mit PR-Nummer, `H`, `A`, Reviewer und Review-Link protokolliert; nach MD-11 prüft der Owner einmalig, dass der aktive Verifier auf einem Owner-Smoke-PR grün ist, der den Stand nach [6] enthält (Nachweis, dass der Bootstrap-Code die eigenen Regeln erfüllt: Tree-Regeln, Inventar, geschützte Pfade unverändert).

Das Risiko dieses Modus (fünf Runs ohne maschinelle Prüfung) ist bekannt und akzeptiert (§17, DA #9): Es ist dasselbe Risiko wie bisher, nur mit expliziter Rollentrennung, Hash-Bindung und Merge-Commit-Spur, und es endet mit [6].

### 16.4 Was nicht in dieser Reihenfolge steht

FORGE-VERIFIER-0004 (Mutantenlauf, V2-01), Status-Projektion (V2-03), Claude als Developer (V2-04), Eventlog-Projektion (V2-05), VS-2…VS-6 (ROAD) — alles nach §18.

---
## 17. Threat Coverage

Status-Vokabular: **FIXED** = mechanisch geschlossen durch Design + benannten Task (nach dessen Abnahme); **MITIGATED** = mechanisch verkleinert, Rest ist Prozess oder Owner-Sorgfalt; **DEFERRED** = bewusst V0.2 mit Auslöser; **ACCEPTED RISK** = bleibt in V0.1 offen, ausdrücklich getragen. Kein Befund aus DA (KRITISCH/HOCH + Top-10), RT (BLOCKING/IMPORTANT/HARDENING), CHA (B1–B6), RR (Kernfälle) oder PAC (15 neue + Top-10) fehlt; Spalte „Mechanik“ nennt Code/Regel und Task.

### 17.1 Deep Audit — Top-10 und alle KRITISCH/HOCH/MITTEL-IDs

| ID | Befund (kurz) | Status | Mechanik / Task |
|---|---|---|---|
| DA #1 / RT-05 / V-01 / C-27 | Ein Akteur bis `accepted`; Identitäten selbst erklärt | **FIXED** | GitHub-Identitäten (§4), Policy mit User-IDs (OPS-0001), Provider-Unabhängigkeit im Gate (`REVIEWER_NOT_INDEPENDENT`, PLAT-0001), Verifier = Actions, Owner = einziger Merger (`forge-main-merge`) |
| DA #2 / C-21 / TD-01 / TD-05 / P-09 | Pilot: eine Session tat alles; Approvals von KI als „human“ | **FIXED** (Zukunft) / ACCEPTED (Vergangenheit) | W-24 (keine Approval-Dateien), W-09/W-28 (Codex-Identität, E-Mail-Allowlist `COMMIT_IDENTITY_MISMATCH`), Legacy eingefroren (§13) |
| DA #3 / V-02 / V-03 / TD-06 | Evidence ohne Diff-Basis | **FIXED** | Listing-Differenz `runBase`↔`H` im Verifier, Evidence v1 mit `base`/`listing`-Hashes (VERIFIER-0001/0003) |
| DA #4 / V-11 / V-12 / V-13 / C-28 / TD-08 | Checks aushöhlbar (Config, Skips, `package.json`) | **FIXED** | Stufe `always` (`PROTECTED_PATH_CHANGED`), Inventar-Regel gegen Baseline (`INVENTORY_REGRESSION`), Policy-`argv` (VERIFIER-0001/0003) |
| DA #5 / C-08 / C-09 / C-10 / P-13 / TD-10 | Ungeprüfter Code zwischen `baseCommit` und `contractCommit` | **FIXED** | W-03: Start vom aktuellen `main`, `specifiedAgainst ⊑ runBase`, `C^1 == M^1`, Isolation (`CONTRACT_PR_NOT_ISOLATED`); Dependencies nur akzeptierte (`DEPENDENCY_NOT_ACCEPTED`) (CORE-0002, VERIFIER-0002) |
| DA #6 / R-01…R-03 / TD-11 | Findings überleben keinen neuen Run | **FIXED** | Finding-IDs, `FORGE FINDINGS v1`, `findings[]`, `FINDINGS_NOT_CARRIED`, `REWORK_SAME_COMMIT`, `FINDINGS_OPEN`, Rücknahme nur Reviewer (PLAT-0001, CORE-0002) |
| DA #7 / L-01…L-12 / TD-13 / TD-14 | Eventlog kein belastbarer Source of Truth | **FIXED by removal** | W-04: kein Log in V0.1; `main` ist die Wahrheit; Projektion V2-05 |
| DA #8 / V-05…V-08 / A-01 / A-04 / TD-09 / RT-02 | Koordinations-Ausnahme = Code-/Prompt-Injection | **FIXED** | W-11: Ausnahme entfernt (CORE-0002), `forge/**` geschützt (VERIFIER-0001), Dateien gelöscht (OPS-0001); Prompt-Injection-Rest siehe PA-112 |
| DA #9 / TD-04 / TD-07 / C-14 | Kern hat nie einen echten Task gesteuert; keine CI | **MITIGATED → FIXED mit [6]** | Verifier-Kette [2]–[6]; Bootstrap-Modus §16.3 ist das getragene Übergangsrisiko; FORGE-DRILL-0001 ist der Nachweis |
| DA #10 / TD-02 | Kein Branch mit Gesamtstand, add/add-Konflikt | **FIXED** (durch PR #1 `3d7545d`) | Rulesets frieren Legacy-Branches ein (§9 #8) |
| C-17 | Prosa widerspricht Metadaten | **MITIGATED** | Pflichtabschnitte + Lint (`STATUS_ASSERTION`, `TITLE_MISMATCH`); Architektur-Reviewer prüft Prosa↔Frontmatter (`reads_reviewed`); Rest menschlich |
| C-31 | Check-Command als Shell-Injection | **FIXED** | Policy-`argv`, kein Shell-String aus dem Contract (`CHECK_NOT_ALLOWED`); Container ohne Netz/Secrets (VERIFIER-0003) |
| C-33 / V-17 / V-18 / TD-12 | Mutation-Smoke trivial/äquivalent-geschummelt | **MITIGATED** (V0.1) → FIXED (V2-01) | Mutanten im Contract (CORE-0002), Reviewer-Replikation mit Pflichtzeilen (`MUTANT_REPORT_INCOMPLETE`, `MUTANT_SURVIVED_UNADDRESSED`); Verifier-Ausführung VERIFIER-0004 |
| V-24 / TD-16 / RT-09 | Head wandert nach Verifikation; Mensch merged Branch statt SHA | **FIXED** | Required Checks strict am Head, `A^2 = H`, `ATTEST_STALE`, Fortgeltung nur bei sauberem `main`-Merge mit gleicher `patch-id` (PLAT-0001, VERIFIER-0002) |
| V-25 / NRT-09 | Nicht darstellbare Dateinamen hängen den Run | **FIXED** | Tree-Regel ASCII-`RepoPath` am ganzen Tree (`TREE_RULE_VIOLATION`), fail-closed statt hängen (VERIFIER-0001) |
| V-26 | Symlink/Submodul als „added“ | **FIXED** | Modi aus `ls-tree`, nur `100644` (VERIFIER-0001) |
| V-29 | Umgebung ≠ Contract | **MITIGATED** | Image-Digest + Lockfile-Hash in Evidence; `.nvmrc`; `engines` unverändert |
| TD-03 | `.gitattributes`, Node-Pin | **FIXED** | OPS-0001 |
| TD-15 | Kein Lease/Timeout | **ACCEPTED RISK** (bewusst) | W-05: Owner schließt; V2-06 |
| TD-19 | Rollen selbst erklärt | **FIXED** | wie DA #1 |

### 17.2 Red Team — BLOCKING / IMPORTANT / HARDENING

| ID | Befund | Status | Mechanik / Task |
|---|---|---|---|
| BLOCKING 1: DRT-11, DRT-12, DRT-16, DRT-20 | Beobachtungsmodell (Reihenfolge, Löschung, Fork-SHA, `repo`) | **FIXED by removal** | Kein Observer in V0.1; Fakten direkt aus Git/API zur Prüfzeit; Required Check am Head, `A^2 = H`; `repository.id` in Policy/Evidence/Packet (`REPO_MISMATCH`); Fetch nur kanonische Refs (DRT-20) |
| BLOCKING 2: DRT-02, DRT-35 | Findings-Ledger für beide Gates | **FIXED** | `findings[]` (Architektur-Gate, `FINDINGS_NOT_CARRIED` am Contract-PR), `FORGE FINDINGS v1` (Code-Gate), `REWORK_SAME_COMMIT` |
| BLOCKING 3: DRT-18, DRT-05 | `refs/replace`, Contract-Merge-Commit | **FIXED** | `GIT_NO_REPLACE_OBJECTS=1`, kein Mirror, nur heads/pull-Refs (§7.7); `C` ein Elternteil, `C^1 == M^1`, commitweiser Walk (`CONTRACT_COMMIT_NOT_LINEAR`, `CONTRACT_PR_NOT_ISOLATED`, `INTERMEDIATE_PATH_VIOLATION`). Push-Verbot für `refs/replace/*` ist im Free-Plan nicht ausdrückbar → durch Tooling neutralisiert (ACCEPTED Restpunkt: ein solcher Ref kann existieren, wirkt aber nirgends) |
| IMPORTANT 4: DRT-23, DRT-24 | Alias-Pfade, Casefold-Kollisionen | **FIXED** | casefold-normalisierte Pfadregeln im Parser (CORE-0002, `METADATA_SCHEMA`) und Tree-Regel (VERIFIER-0001) |
| IMPORTANT 5: DRT-22 | Symlink unter Coordination | **FIXED** | Modi-Regel + Ausnahme entfernt |
| IMPORTANT 6: DRT-21 | Rename-Semantik abhängig von Diff-Optionen | **FIXED** | Listing-Differenz statt `git diff`; `--no-renames --raw` überall; Renames = Verstoß (Kern unverändert) |
| IMPORTANT 7: DRT-27 | Hash über dekodierten Text ≠ Blob | **FIXED** | Hash über Blob-Bytes mit `fatal`-Dekoder, `blobSha` überall mitgeführt (`CONTRACT_IDENTITY_MISMATCH`) (CORE-0002) |
| IMPORTANT 8: DRT-34 | Owner-Rolle ohne Mensch | **FIXED** | `OWNER_NOT_HUMAN` für alle Owner-Events (CORE-0002, eine Zeile); in V0.1 zusätzlich strukturell: Owner-Aktionen sind GitHub-Aktionen von `Wuerfelduell` |
| IMPORTANT 9: DRT-19 | Shallow Clone → stilles Hängen | **FIXED** | `fetch-depth: 0`, voller Fetch, `OBSERVATION_INCOMPLETE` fail-closed |
| IMPORTANT 10: DRT-07 | Stale Dependency nach Patch-Task | **MITIGATED** | Start vom aktuellen `main` (W-03): abhängige Tasks laufen gegen den gepatchten Stand; akzeptierte Tasks eingefroren (§5.8 Nr. 6); Revert-Erkennung für Dependents V0.2 (PT-13) |
| HARDENING 11: DRT-17 | RefName-Tricks | **FIXED** | nur voll qualifizierte Refs, `RefName`-Regel im Kern (CORE-0002), Refs nach `--` (VERIFIER-0002) |
| HARDENING 12: DRT-25 | Windows-reservierte Namen | **FIXED** | `RepoPath`-Regel (CORE-0002), Tree-Regel (VERIFIER-0001) |
| HARDENING 13: DRT-28 | NUL/Bidi in Prosa | **FIXED** | Textregeln §5.4 im Parser (CORE-0002), Block-Zeichenregeln (PLAT-0001) |
| HARDENING 14: DRT-15 | Lone Surrogates in Persistenz | **FIXED by removal** | keine Persistenz; Parser lehnt ohnehin ab [CODE] |
| HARDENING 15: DRT-03, DRT-32, DRT-42, DRT-43 | `contractCommit` nicht geprüft; Mutanten-Namenszwillinge; RunId-Squatting; `recordedAt` frei | **FIXED** | `C` aus Git abgeleitet, nie geliefert; `mutants[].id` Regex, eindeutig; Run-Nummer aus Branch + PR-Zählung (`RUN_NUMBER_NOT_NEXT`); keine Zeitfelder in V0.1 |
| RT §9 „bekannt, weiter BLOCKING“: NRT-30 (Start-Beobachtung vom Developer), NRT-01, NRT-12/13, NRT-02 | — | **FIXED** | alle Fakten vom Gate berechnet; siehe DA #3/#4/#5 |
| RTN-01…RTN-19 | Regressionstests | **FIXED** (Testpflicht) | RTN-05/06/07/08/11/12/13/17/19 als Tests in CORE-0002; RTN-01/02/03/14/15 als Verifier-Tests in VERIFIER-0002 (Beobachtungsmodell ersetzt durch Git-Fakten); RTN-04/09/10/16/18 in PLAT-0001/VERIFIER-0001 bzw. gegenstandslos (kein Log) |

### 17.3 Contract-Handoff-Audit — Blocker B1–B6 und S-Punkte

| ID | Befund | Status | Mechanik |
|---|---|---|---|
| B1 Kernkonformes Format | **FIXED** | Format 2 (Format 1 nur Bootstrap), `FORMAT_NOT_CURRENT`, Lint |
| B2 Approval als externer hash-gebundener Record | **FIXED, anders** | GitHub-Review mit `FORGE REVIEW v1` (`contract: <TASK> v<N> <hash>`, `blob`) statt Datei (W-24) |
| B3 Start vom `contract_commit` | **ERSETZT** | W-03: Start vom aktuellen `main`; Bindung über Quittung + `M ⊑ runBase`; CHA Fall 16 („Contract nicht in der Historie des Ergebnisses“) ist damit **immer** erfüllt, weil `M` auf `main` liegt |
| B4 Lesequittung mit Blob/Hash + End-Marker | **FIXED** | `FORGE READ RECEIPT v2` im leeren ersten Commit, vom Gate verglichen (nicht vom Developer) |
| B5 Versionierungsregel | **FIXED** | ein Pfad, Versionen = Registrierungs-Merges, `supersedes`, Sidecar verboten |
| B6 „TASK-0004 starten“ klären | **FIXED** | TASK-0004 ist Legacy-akzeptiert; nichts wird gestartet (W-15) |
| S1–S10 (Should-fix) | diverse | **MITIGATED/FIXED** | Statusfelder verboten (S-Lint), Handoff-Kommentar mit Identifikatoren, 20-Fälle-Matrix als Testfälle in VERIFIER-0002 (Contract-/Base-Fälle) |

### 17.4 Run Recovery — Kernfälle

| ID | Fall | Status | Mechanik |
|---|---|---|---|
| F-01…F-03, F-19 | Agent stirbt / kehrt spät zurück | **ACCEPTED RISK** (Owner schließt) | W-05, §11; kein Zombie-Schaden wegen `RUN_REOPENED` und Required Checks am neuen PR |
| F-04b, F-22 | Fremdschreiber auf Run-Ref | **FIXED** | Ruleset #4 (nur Team), `COMMIT_IDENTITY_MISMATCH`, `OWNER_ON_RUN_BRANCH` |
| F-06, F-07, F-07b | Branch gelöscht, Force-Push, `main` rewritten | **FIXED** | Rulesets #1–#4; Verstoß ⇒ F8 Halt |
| F-08, F-09 | Verifier startet nicht / stirbt | **MITIGATED** | fail-closed Required Check; ein Re-run; `MAIN_MOVED`; Infra ≠ Bestehen; PA-30 als MP-06 |
| F-11, F-12, F-13, F-14 | GitHub down, Backend-Restart, Duplikate, Doppelklick | **FIXED by removal** | kein Backend, kein Log, keine Webhooks; Checks sind idempotent je Head |
| F-17 | Stale Contract während Run | **FIXED** | `RUN_ACTIVE` am Contract-PR (Prävention) |
| F-18, SD-03, PT-07, PT-13 | Stale Dependency | **FIXED** (vor Start) / **DEFERRED** (Revert während Run) | `DEPENDENCY_NOT_ACCEPTED`, `DEPENDENCY_NOT_IN_RUN_BASE`; Revert-Erkennung V0.2 |
| F-21, SD-01 | Head-Drift, Stale Base | **FIXED** | `ATTEST_STALE`, strict up to date, Clean-Merge-Regel |
| F-23, SD-04 | Falscher Stand, Quittung ≠ Manifest | **FIXED** | `RECEIPT_MISMATCH`, `SPEC_STALE` |
| SD-05 | Statusaussage im Contract | **FIXED** | `STATUS_ASSERTION`, `METADATA_SCHEMA` |
| PT-01…PT-06, PT-08…PT-12 | Parallelität, Lockfile, Pfadklassen | **DEFERRED** (V2-02) / **FIXED** (PT-06/PT-12 durch Stufe `always`) | W-20 |
| NH-Katalog, Retry-Budgets, Reconciler | — | **DEFERRED** | §2.4 |

### 17.5 Pipeline Adversarial Challenge — 15 neue Befunde und Top-10

| ID | Befund | Status | Mechanik |
|---|---|---|---|
| PA-110 ★ (Top 1) | Owner-Run über Owner-KI-Connector | **MITIGATED** | Prozessregel Stufe A + Checkliste (MD-13); `OWNER_ON_RUN_BRANCH`; kein Owner-Bypass auf Run-Branches (#4); Owner-PRs brauchen externes Review; **Rest menschlich**: ein Connector kann als Owner mergen/attestieren — getragenes Hauptrisiko von V0.1 |
| PA-30 ★ (Top 2) | `pull_request_target`-Policy-Stichtag 2026-11-02 | **FIXED** (mit S1) | MD-03, MP-06, SP-1; fail-closed, falls S1 fehlt |
| PA-111 ★ (Top 3) | Prompt-Injection → KI-APPROVE, laxe Attestation | **MITIGATED** | Packet-Hash, Blob-/Head-Bindung, Pflichtzeilen (`mutant:`, Finding-IDs), Reviewer beschafft Code selbst, Rollenvorlagen (Daten ≠ Anweisung), Checkliste; **Rest menschlich** (ACCEPTED) |
| PA-39 ★ (Top 4) | Required-Check-Menge nicht eingefroren | **FIXED** | §8 (zwei Checks, Änderungsregel) |
| PA-112 ★ (Top 5) | Prompt-Injection gegen Owner-Assistenten über Repo-Text | **MITIGATED** | Koordinationsdateien gelöscht; Textregeln (Bidi/NUL/Zero-Width) in Contracts und Blöcken; Checkliste; **Rest menschlich** (ACCEPTED) |
| PA-95 ★ (Top 6) | Geteiltes beschreibbares `/work` | **FIXED** | frisches `/work` je Phase, read-only, tmpfs `noexec` (VERIFIER-0003) |
| PA-94 ★ (Top 7) | `toString`-Mutations-Orakel | **MITIGATED** (V0.1) → FIXED (V2-01 mit Kontroll-Mutant) | Reviewer wendet Mutanten selbst an (kein In-Memory-Transform im Test sichtbar) |
| PA-13 ★ (Top 8) | Receipt im mutierbaren PR-Body | **FIXED** | W-29 (leerer Commit), `edited`-Trigger für den Findings-Block |
| PA-20 ★ (Top 9) | Single-Code-Owner-Deadlock | **FIXED** | W-27 (Approvals 0, Code-Owner-Review aus, `forge-main-merge`) |
| PA-72 ★ (Top 10) | Seitenzweig add+delete | **FIXED** | commitweiser Walk (`INTERMEDIATE_PATH_VIOLATION`), Ein-Commit-Regel für Contract-PRs |
| PA-04 ★ | Fremder Run-Namensraum | **FIXED** | Ruleset #5 gesperrt, `BRANCH_AGENT_MISMATCH` |
| PA-06 ★ | Tag `main` | **FIXED** | Ruleset #10, voll qualifizierte Refs (W-31) |
| PA-116 ★ | Login statt User-ID | **FIXED** | Policy mit IDs (§3.4) |
| PA-35 ★ | Re-run alter Läufe | **FIXED** | `MAIN_MOVED` |
| PA-41 ★ | Merge Queue | **FIXED** | aus (§9.5), kein `merge_group` |
| PA-59 ★ | `git archive`/`export-subst` | **FIXED** | Materialisierung aus Blobs (Regel §7.1 Nr. 2) |
| PA-18 | Review-Dismiss durch Write | **MITIGATED** | SP-9 (Ruleset-Option prüfen); Gate liest nur Owner-Reviews, Dismiss durch Codex hat keine Wirkung auf das Urteil |
| PA-33, PA-31 | Gleichnamige Checks aus PR-Workflow | **FIXED** | S1 + App-Quellbindung; **W-32** schließt zusätzlich den `pull_request_review`-Pfad |
| PA-40, PA-98 | Actions-Token approvt; Secrets | **FIXED** | §9.4, `permissions` minimal, keine Secrets |
| PA-77 | leeres `reads` | **MITIGATED** | Pflichtfeld + `reads_reviewed` (W-17); Rest menschlich |
| PA-113 | Attestation ohne Prüfung | **MITIGATED** | mechanische Teile im Gate; Checkliste; Rest menschlich (ACCEPTED) |
| PA-07, PA-08, PA-09, PA-99 | belegt harmlos / nur dokumentieren | **ACCEPTED RISK** (wirkungslos) | Tag-Ruleset deckt PA-07/08 mit ab; Fetch ignoriert fremde Namensräume |
| **Neu (W-32)** | `pull_request_review` nimmt Workflow aus dem PR-Merge-Commit | **FIXED** | Trigger gestrichen; S1 verbietet das Event für alle Workflows; Re-run/`edited` als Neubewertung |

### 17.6 Was ausdrücklich als Restrisiko getragen wird (die ehrliche Liste)

1. **Der Owner und seine Connectoren** (PA-110/111/112/113): Ein Mensch ist die Vertrauenswurzel; ein Agent mit Owner-Verbindung kann als Owner handeln. Mechanik hilft (kein Bypass auf Run-Branches, Pflichtfelder, Packet-Hash, externes Review auch für Owner-PRs), aber Attestieren ohne Lesen und Mergen auf Zuruf sind nicht verhinderbar. Gegenmaßnahme: Checkliste, Audit-Log, Regel „Agenten mit Owner-Verbindung schreiben nicht“.
2. **Bootstrap-Modus** (§16.3): fünf Runs ohne maschinellen Verifier.
3. **Mutanten ohne Verifier** (W-13): Reviewer-Replikation bis V2-01.
4. **Keine Zeit, keine Lease** (W-05): verwaiste Runs blockieren die Spur, bis der Owner handelt.
5. **E-Mail-basierte Commit-Identität** (W-28): fälschbar, aber sichtbar; Signaturen V2-09.
6. **Legacy-Code ohne Forge-Provenienz** (TASK-0001…0004, Kern 0001A/B): akzeptiert als Baseline; jede künftige Änderung läuft durch die Pipeline.
7. **`refs/replace/*` und sonstige Nicht-Head-Refs** können gepusht werden (kein Ruleset im Free-Plan); Tooling ignoriert sie.
8. **Plattformannahmen SP-1…SP-9**: bis zum Nachweis Annahmen; jede negative Antwort hat einen benannten Ausweichpfad (§7.10).

---
## 18. Minimal V0.1 Definition

**Forge V0.1 ist fertig, wenn** auf `Forge-Dice/Forge` genau zwei Required Checks (`forge-gate`, `forge-verify`) aus dem einen Workflow `forge-verify.yml` auf `main` jeden Pull Request nach `main` bewerten und dabei Identität (User-ID, Namensraum, Commit-E-Mail), Contract-Bindung (`C = M^2`, Format 2, `specifiedAgainst`, `SPEC_STALE`), Lesequittung im ersten Commit, Scope und geschützte Pfade, Limits, Testinventar gegen Baseline, Review-Attestation mit Provider-Unabhängigkeit und Findings-Carry-Forward mechanisch durchsetzen; wenn die Rulesets `forge-main`, `forge-main-merge`, `forge-all-branches`, `forge-run-codex`, `forge-run-claude`, `forge-contract`, `forge-owner`, `forge-no-stray-branches`, `forge-no-tags` aktiv und `forge-halt` bereit sind und ihre Wirkung durch die Negativ-Drills in `forge/ops/RULESETS.md` und `forge/ops/ADVERSARIAL-PRS.md` belegt ist; wenn `FORGE-DRILL-0001` mit Run 1 (alle Injektionen rot oder als Restrisiko in §17.6 nachgetragen) und Run 2 (abgenommen, Merge Commit `A` mit `A^2 = H`) vollständig durch diese Pipeline gelaufen ist und `forge/ops/DRILL-0001.md` die sechs Owner-Handgriffe, null getippte SHAs und null Contract-Zeilen im Chat zählt; **und wenn der erste produktive Mystery-Task `TASK-0006` „Accusation & Verdict“ als Format-2-Contract registriert, extern reviewt, von `forge-codex` implementiert, vom Verifier verifiziert, von einem Reviewer eines anderen Anbieters inklusive aller acht Mutanten geprüft und vom Owner per Merge Commit auf `main` abgenommen wurde** — ohne Bypass, ohne Waiver, ohne Ruleset-Änderung während des Runs. Alles, was dann noch fehlt (Mutantenlauf im Verifier, parallele Runs, Status-Projektion, Claude als Developer, Eventlog-Projektion), ist V0.2 und hat einen benannten Auslöser (§2.3).

---

## 19. Owner Decisions (genau fünf)

| # | Entscheidung | Optionen | **Empfehlung** | Warum jetzt | Konsequenz der Alternative |
|---|---|---|---|---|---|
| **OE-1** | Reviewer-Besetzung für die Bootstrap-Contracts und -Runs ([2]–[6]) sowie für den Drill | (a) Architektur ChatGPT, Code Claude (ohne Projektdateien); (b) Architektur Claude, Code Grok; (c) Architektur Grok, Code Claude; (d) je Task wechselnd | **(a) für Owner-/Claude-entworfene Contracts** (ChatGPT ist als Reviewer von 0001B v2 etabliert), **(b) oder (c) für Codex-entworfene Contracts** (ChatGPT dann ausgeschlossen); Grok als zweite Stimme optional. Für den Drill: Spec-Autor Codex ⇒ (b) oder (c) | Ohne Besetzung kann kein Contract-PR attestiert werden (MD-14, [2]) | Jede zulässige Besetzung ist gleichwertig; nur ChatGPT-Code-Review für Codex-Runs ist ausgeschlossen |
| **OE-2** | Task-ID und Arbeitsannahmen für VS-1 | (a) `TASK-0006` + D1–D10 wie in AVD empfohlen; (b) neues Schema `MYST-0001`; (c) D-Abweichungen | **(a)** | Der Contract-Text braucht die ID und die Entscheidungen (MP-03) | (b) kostet nur Umbenennung in AVD/ROAD; (c) verzögert den Contract um ein Design-Review |
| **OE-3** | Plan: öffentlich + Free bleiben oder GitHub Team | (a) öffentlich, Free; (b) Team (private Rulesets, Org-Rulesets, Required Workflows, Metadata-Rulesets) | **(a)**, solange SP-1 positiv ausfällt | S1 ist die Vorbedingung für alles (MD-03, PA-30); scheitert sie im Free-Plan, ist (b) der einzige Weg | (b) ermöglicht Required Workflows als zweite Verteidigungslinie und Commit-Autor-Regeln; Kosten laufend |
| **OE-4** | Claude in V0.1 nur lesend (Stufe A) oder zweite Developer-Identität `forge-claude` (Stufe B) | (a) Stufe A; (b) Stufe B | **(a)** | Namensraum und Ruleset sind vorbereitet; (b) bräuchte ein weiteres Konto/Team und verdoppelt die Identitätsfläche vor dem ersten Run | (b) erlaubt Claude-Runs und Provider-Wechsel beim Developer; erst nach V0.1-Exit sinnvoll (V2-04) |
| **OE-5** | Identity-Spike-Beleg und S1-Nachweis in `forge/ops/` | (a) Audit-Log-Zitat (`git.push`, Akteur `forge-codex`, Ref `forge/run/codex/IDENTITY-SPIKE-1`) + noreply-E-Mail-Umstellung + S1-Negativ-/Positivtest als Dateien; (b) Owner-Aussage genügt | **(a)** | Beides sind MUST BEFORE FIRST DRILL (MD-02, MD-03) und nur der Owner kann sie liefern | (b) lässt die einzige nicht mechanische Vertrauensannahme (Codex pusht als Codex) unbelegt |

Alles andere ist entschieden. Insbesondere **nicht** mehr offen: Merge-Strategie (Merge Commit), Format-Zeitpunkt (Format 1 nur Bootstrap), Check-Namen (zwei), Blocknamen (fünf + Kopfzeile), Namensräume (drei), Quittungsort (leerer Commit), Mutanten-Semantik (Reviewer-repliziert), Findings-Carry-Forward (IDs, zwei Kanäle), Halt (Ruleset), Parallelität (eine Spur), Migration (einfrieren), Reihenfolge (acht Tasks), Trigger (nur `pull_request_target`), Required Approvals (0) und Owner-Merge-Zwang (`forge-main-merge`).

---

## 20. Dieses Dokument als Architekturreferenz

1. **Geltung.** Dieses Dokument ist die leitende Architekturreferenz für Forge V0.1. Bei Widerspruch zu einem früheren Bericht gilt dieses Dokument (§1 nennt die ersetzten Aussagen). Bei Widerspruch zum Code auf `main` gilt der Code, und der Widerspruch ist ein Befund, der eine Revision dieses Dokuments oder einen Task erzeugt.
2. **Ort.** Der Owner legt eine byteidentische Kopie als `forge/ops/ARCHITECTURE-FREEZE-V0.1.md` per Owner-PR in FORGE-OPS-0001 ab (Prozessregel: Entwickler lesen Verträge und Referenzen aus Git, nie aus Chats). Spätere Änderungen sind Owner-PRs mit externem Review; Versionen werden im Dateikopf gezählt (`Revision 1`, `Revision 2`, …), nie durch Sidecar-Dateien.
3. **Was Developer und Reviewer daraus lesen.** Developer: §3.3, §5.9.4, §6.2 (T-06…T-08), §7.3/§7.4 Codes. Spec-Autor: §5. Reviewer: §4.3, §5.9.1/§5.9.2, §7.6. Owner: §6, §9, §10, §11, §14, §19.
4. **Was dieses Dokument nicht ist.** Keine Implementierung, kein Contract, keine Freigabe. Die Contracts [2]–[8] werden aus ihm abgeleitet und einzeln reviewt; der V1-DRAFT bleibt unverändert gültig (Hash `341ec983…`), weil seine Format-1-Semantik durch §5.10 gedeckt ist.
5. **Lesestand.** Alle Aussagen über GitHub-Einstellungen sind Soll (per API nicht lesbar); alle Aussagen über Code sind gegen `3d7545d` geprüft; alle Aussagen über Berichte gegen die Dateien in `/mnt/project-files/forge-audits/` mit Stand 13:36 UTC.

**Keine Datei im Repository wurde geändert, kein Commit erzeugt, kein PR eröffnet, keine Einstellung berührt. Ende des Berichts.**

---

## Anhang A — Namensglossar (einzige gültige Schreibweisen)

| Kategorie | Namen |
|---|---|
| Repository | `Forge-Dice/Forge`, ID `1401864629`, Default-Branch `refs/heads/main` |
| Identitäten | `Wuerfelduell` (315180734), `forge-codex` (337272506), Team `forge-dev-codex`, `github-actions[bot]`; Reviewer-Namen `chatgpt`, `claude`, `grok`; Provider `human`, `openai`, `anthropic`, `xai` |
| Branch-Namensräume | `forge/run/codex/<TASK>-<n>`, `forge/run/claude/**` (reserviert), `forge/contract/<TASK>-v<N>`, `forge/owner/<thema>` |
| Workflow und Jobs | `.github/workflows/forge-verify.yml`; Workflow-Name `forge`; Jobs/Checks `forge-gate`, `forge-verify` |
| Abschnittszeilen | `forge/policy`, `forge/identity`, `forge/base`, `forge/contract`, `forge/receipt`, `forge/history`, `forge/lane`, `forge/findings`, `forge/limits`, `forge/packet`, `forge/review`, `forge/tree`, `forge/diff`, `forge/checks`, `forge/inventory`, `forge/evidence` |
| Contract-Checks | `typecheck`, `test` |
| Blöcke | `FORGE REVIEW v1`, `FORGE ATTEST v1`, `FORGE FINDINGS v1`, `FORGE READ RECEIPT v2`, `FORGE DEVELOPER HANDOFF v2`; Kopfzeile `Forge-Spec-Author:`; Hilfszeile `Forge-Reeval:` |
| Dateien | `forge/contracts/<TASK>.md`, `forge/policy.json`, `forge/roles/{spec-author,architecture-reviewer,developer,code-reviewer,handoff,attestation-checklist}.md`, `forge/ops/{IDENTITY-SPIKE,S1-RESULT,RULESETS,ADVERSARIAL-PRS,BOOTSTRAP-RUNS,DRILL-0001,ARCHITECTURE-FREEZE-V0.1}.md`, `forge/verifier/image.json`, `.github/CODEOWNERS`, `.gitattributes`, `.nvmrc` |
| Code-Verzeichnisse | `src/forge/`, `src/forge-verifier/`, `src/forge-platform/`, `tests/forge/`, `tests/forge-verifier/`, `tests/forge-platform/`, `tests/forge-red-team/` (Legacy) |
| Rulesets | `forge-main`, `forge-main-merge`, `forge-all-branches`, `forge-run-codex`, `forge-run-claude`, `forge-contract`, `forge-owner`, `forge-no-stray-branches`, `forge-no-tags`, `forge-halt` |
| Formate | Contract Format 1 (`forge-contract-v1\n`), Format 2 (`forge-contract-v2\n`); `FORGE-VERIFICATION-EVIDENCE v1` (`forgeEvidenceFormat: 1`); `forgePolicyFormat: 1` |
| Tasks | FORGE-OPS-0001, FORGE-VERIFIER-0001, FORGE-CORE-0002, FORGE-VERIFIER-0002, FORGE-PLAT-0001, FORGE-VERIFIER-0003, FORGE-DRILL-0001, TASK-0006; später FORGE-VERIFIER-0004, TASK-0005 (v3) |
| Tracking-Issues | Titel `forge: <TASK>`, Label `forge-task` |
| Git-Begriffe | `C` (Contract-Commit = `M^2`), `M` (Registrierungs-Merge), `H` (Run-Head), `A` (Abnahme-Merge, `A^2 = H`), `runBase` (`merge-base(H, main)`), `specifiedAgainst` |

## Anhang B — Fehlercodes (Gate und Verifier; Kern-Codes aus `src/forge` unverändert)

| Abschnitt | Codes |
|---|---|
| `policy` | `REPO_MISMATCH`, `POLICY_INVALID`, `BRANCH_PATTERN_INVALID` |
| `identity` | `BRANCH_AGENT_MISMATCH`, `BRANCH_TASK_MISMATCH`, `OWNER_ON_RUN_BRANCH`, `COMMIT_IDENTITY_MISMATCH`, `AUTHOR_NOT_SPEC_AUTHOR`, `SPEC_AUTHOR_MISSING`, `SPEC_AUTHOR_MISMATCH`, `OWNER_PR_AUTHOR_MISMATCH` |
| `base` | `BASE_NOT_ON_MAIN`, `PR_ALREADY_MERGED`, `RUN_REOPENED`, `HEAD_MOVED`, `MAIN_MOVED` |
| `contract` (Contract-PR) | Kern-Parser-Codes (`FRONTMATTER_MISSING`, `FRONTMATTER_NOT_CANONICAL`, `METADATA_SCHEMA`, `CARRIAGE_RETURN`, …), `FORMAT_NOT_CURRENT`, `CONTRACT_PATH_MISMATCH`, `CONTRACT_VERSION_NOT_NEXT`, `SUPERSEDES_MISMATCH`, `SUPERSEDES_BLOB_UNKNOWN`, `TASK_ACCEPTED_FROZEN`, `LEGACY_TASK_FROZEN`, `LEGACY_CONTRACT_HISTORY`, `SPECIFIED_AGAINST_NOT_ON_MAIN`, `SPEC_STALE`, `READS_NOT_FOUND`, `CREATE_TARGET_EXISTS`, `SCOPE_PROTECTED`, `SCOPE_PROTECTED_FOR_TASK_CLASS`, `CHECK_NOT_ALLOWED`, `CHECK_SET_INCOMPLETE`, `LIMIT_ABOVE_POLICY`, `MUTANT_ANCHOR_AMBIGUOUS`, `DEPENDENCY_NOT_ACCEPTED`, `DEPENDENCY_UNRESOLVED`, `FINDINGS_NOT_CARRIED`, `WITHDRAW_NOT_AUTHOR`, `STATUS_ASSERTION`, `CHAT_REFERENCE`, `TITLE_MISMATCH`, `END_MARKER_MISSING`, `END_MARKER_MISMATCH`, `CONTRACT_IDENTITY_MISMATCH`, `RUN_ACTIVE`, `CONTRACT_PR_DUPLICATE` |
| `contract` (Run-PR) | `CONTRACT_NOT_CURRENT`, `CONTRACT_NOT_IN_RUN_BASE`, `SPEC_STALE`, `DEPENDENCY_NOT_IN_RUN_BASE`, `FORMAT_NOT_CURRENT`, `TASK_ACCEPTED_FROZEN`, `REGISTRATION_TREE_MISMATCH`, `CONTRACT_MERGE_NOT_ISOLATED`, `CONTRACT_COMMIT_NOT_LINEAR` |
| `receipt` | `RECEIPT_MISSING`, `RECEIPT_INVALID`, `RECEIPT_MISMATCH`, `RECEIPT_DUPLICATE`, `RECEIPT_NOT_FIRST`, `RECEIPT_NOT_EMPTY` |
| `history` | `CONTRACT_PR_NOT_SINGLE_COMMIT`, `CONTRACT_PR_NOT_ISOLATED`, `CONTRACT_NOT_ON_MAIN_TIP`, `RUN_MERGE_FOREIGN_PARENT`, `RUN_MERGE_NOT_CLEAN`, `EMPTY_COMMIT`, `INTERMEDIATE_PATH_VIOLATION`, `OWNER_PR_MERGE_FOREIGN_PARENT`, `OBSERVATION_INCOMPLETE` |
| `lane` | `RUN_LIMIT`, `RUN_NUMBER_NOT_NEXT` |
| `findings` | `FINDINGS_NOT_CARRIED`, `FINDINGS_COMMIT_UNKNOWN`, `REWORK_SAME_COMMIT`, `FINDINGS_OPEN` |
| `limits` | `SIZE_EXCEEDED` |
| `review` | `REVIEW_PENDING`, `REVIEW_CHANGES_REQUESTED`, `REVIEW_BLOCK_MISMATCH`, `REVIEW_STATE_MISMATCH`, `REVIEWER_NOT_INDEPENDENT`, `REVIEW_AUTHOR_NOT_OWNER` (informativ), `ATTEST_INVALID`, `ATTEST_STALE`, `MUTANT_REPORT_INCOMPLETE`, `MUTANT_SURVIVED_UNADDRESSED` |
| `tree` | `TREE_RULE_VIOLATION` |
| `diff` | `SCOPE_VIOLATION`, `PROTECTED_PATH_CHANGED`, `DIFF_BASE_MISMATCH` (Listing-Basis ≠ `runBase`) |
| `checks` | `CHECK_FAILED`, `CHECK_TIMEOUT` |
| `inventory` | `INVENTORY_REGRESSION`, `INVENTORY_UNAVAILABLE` |
| `evidence` | `EVIDENCE_WRITE_FAILED` |
| Infrastruktur (jeder Abschnitt) | `INFRA_FETCH_FAILED`, `INFRA_API_FAILED`, `INFRA_IMAGE_UNAVAILABLE`, `GATE_STRUCTURAL_FAILED` (in `forge-verify`, wenn der Gate strukturell rot war) |
| Kern, neu oder erweitert in CORE-0002 | `CONTRACT_NOT_IN_RUN_BASE`, `RUN_BASE_NOT_PERSISTED`, `OWNER_NOT_HUMAN` (alle Owner-Events), `METADATA_SCHEMA` (Pfadregeln, Textregeln) |
| Owner-Befunde (keine Gate-Codes; Vokabular für `forge/ops/INCIDENT-*.md`) | `PROTECTION_BYPASSED`, `MERGED_BY_NOT_OWNER`, `PR_IS_DRAFT` (nur falls SP-5/SP-6 negativ ausfallen) |
| V0.2 (reserviert) | `MUTANT_NOT_APPLICABLE`, `MUTATION_SURVIVED`, `MUTATION_EVIDENCE_INVALID`, `SCOPE_LEASE_CONFLICT`, `DEPENDENCY_CHANGED` |

Jeder Code ist genau einem Abschnitt zugeordnet und wird im Fließtext, wo er vorkommt, mit derselben Schreibweise referenziert; die Klassennamen F1–F8 aus §10.1 und die GitHub-Review-States (`APPROVED`, `COMMENTED`, `REQUEST_CHANGES`) sind keine Codes. Neue Codes erfordern eine Revision dieses Dokuments (§8.4).
