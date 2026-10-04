# FORGE RUN RECOVERY & PARALLEL TASK POLICY

| Feld | Wert |
|---|---|
| Rolle | Principal Distributed Systems Architect |
| Modus | rein lesend. Keine Änderung am Repository, keine Commits, keine PRs, kein Branch berührt |
| Datum | 2026-10-03 |
| Repository | `Wuerfelduell/Forge` |
| Maßgeblicher Forge-Core-Stand | `codex/forge-core-v2-repair` @ `b9339d2` (Implementierung `811ed0d`). Geprüft um ca. 07:35 UTC: es gibt **keinen neueren Codex-Baseline-Branch**. Remote-Branches: `main` `f5dbc73`, `claude/forge-architecture-review-hjdq89` `be40a68`, `codex/forge-core-v2-repair` `b9339d2`, `codex/mystery-task-0005` `fab792a`, `codex/task-0004-contract` `6a8c0c5` |
| Baut auf | `forge-audits/FORGE-DEEP-AUDIT.md` §5.3, §9, §12, §17, §18 (FR-01..FR-15, Konfliktklassen, V0.1-Architektur „GitHub als Torwächter“). Dort Gesagtes wird nur referenziert. Paralleler Bericht: `FORGE-DEEP-RED-TEAM.md` (anderer Thread) |
| Labels | wie im Deep Audit: **CODE** (aus Quelltext), **GIT** (aus Historie), **INFERRED** (Schluss), **PILOT** (von Seb berichteter Vorfall), **DECISION** (Entwurfsentscheidung dieses Berichts) |

---

## 0. Kurzfassung

**Ein Satz:** Forge braucht keinen verteilten Koordinator, sondern eine einzige, wiederholbare Funktion `reconcile(Log, Git, jetzt) → Events`, die aus zwei dauerhaften Wahrheiten (Forge-Log und GitHub) ableitet, was mit jedem Run los ist. Alles, was ein Agent lokal weiß oder tut, ist flüchtig und zählt für Forge erst, wenn es in Git sichtbar ist.

Die wichtigsten Entscheidungen:

1. **Zwei Wahrheiten, keine dritte.** Der Log hält Absichten und Entscheidungen (Start, Abbruch, Review, Freigabe). Git hält Arbeit und Fortschritt (Commits, Refs, PRs, Check-Runs). Agent-Callbacks, Chat-Aussagen, lokale Checkouts und Status-Felder in Markdown-Dateien sind **nie** Quelle eines Zustands. Damit werden „Push erfolgreich, Callback verloren“ und „Backend-Restart“ trivial: es gibt nichts zu verlieren.
2. **Der Run besitzt einen Ref, nicht der Agent.** Forge legt `forge/run/<runId>` beim Start auf den Startcommit an. Ein Retry ist ein **neuer** Run mit neuem Ref. Das ist das gesamte Fencing: ein Zombie-Worker kann nur in einen toten Ref schreiben, dessen Inhalt nie gemergt wird. Keine Fencing-Tokens, keine Locks.
3. **Lease ja, Heartbeat-Dienst nein.** Ein Run hat eine Lease mit großzügiger TTL (Vorschlag 3 h, Obergrenze 12 h). Erneuert wird sie durch **beobachteten Fortschritt** (neuer Head auf dem Run-Ref). „Push ist der Heartbeat.“ Abgelaufen ist sie nur, wenn der Reconciler *nach* Ablauf erfolgreich beobachtet hat, dass nichts passiert ist. Ein GitHub-Ausfall lässt also nie eine Lease ablaufen.
4. **Ein Schreiber, optimistisch.** Der Reconciler läuft als GitHub-Workflow in einer Actions-`concurrency`-Gruppe; der Log ist eine JSONL-Datei, deren Append ein Fast-Forward-Push ist. Wer verliert, liest neu und rechnet neu. Das ist die einzige Synchronisation, die Forge bei zwei bis drei parallelen Runs braucht.
5. **Jede Operation hat einen deterministischen Schlüssel.** `runId` aus `(Task, Contract-Version, Attempt)`, `eventId` aus dem kausalen Schlüssel. Gleicher Schlüssel, gleicher Inhalt = No-op. Gleicher Schlüssel, anderer Inhalt = `NEEDS_HUMAN`. Der Merge geschieht nur als Compare-and-Swap auf den verifizierten SHA.
6. **Parallelität wird an der Quelle begrenzt, nicht am Ende repariert.** Scope-Lease beim Start (keine zwei aktiven Runs mit überlappendem `modify`/`create`), eine **serielle Spur** für geteilte Flächen (`package.json`, Lockfile, Contracts, Testkonfiguration, Migrationen, generierte Dateien). Wer zuerst merged, gewinnt; alle anderen werden `STALE` und **reconcilen** (main hineinmergen, neu verifizieren). Neu-Review nur, wenn die Konfliktauflösung Code verändert hat.
7. **Contract-Änderung während eines Runs wird verboten, nicht toleriert.** Heute erlaubt der Kern sie (RT-07). V0.1: `contract_registered` wird abgelehnt, solange ein Run aktiv ist; der Owner muss zuerst abbrechen. Das macht „Contract wurde parallel weiterentwickelt“ unmöglich statt nur erkennbar.
8. **Status steht nie in einem Dokument.** `status: approved/draft/review_ready` in Contract-Frontmatter ist die Ursache des TASK-0004-Vorfalls. Status kommt nur aus `forge status`, abgeleitet aus Log + Git.
9. **NEEDS_HUMAN ist ein abgeleitetes Overlay mit Grundcode, kein Zustand, in dem etwas wartet.** Es blockiert automatische Übergänge, löst sich nie selbst auf und wird nur durch ein authentifiziertes Owner-Event aufgehoben.

---

## 1. Current Limitations

### 1.1 Was der Kern (`b9339d2`) heute zu Runs weiß

| # | Grenze | Beleg | Folge im Recovery-Fall |
|---|---|---|---|
| L-01 | **Keine Zeit im Kern.** `recordedAt` ist „informational only, never used in decisions“ | CODE `events.ts:130` | Kein Timeout, keine Lease. Ein toter Worker hält den Task für immer in `implementing` (SM-13) |
| L-02 | **Nur Owner/Developer können einen Run beenden.** `run_failed` erlaubt `developer`, `owner`; `run_abandoned` nur `owner` | CODE `events.ts:149-150` | Kein System-Ablauf. Jede Recovery ist Handarbeit des Owners |
| L-03 | **Push vor Report ist nicht aufzeichenbar.** `remote_observed` nur im Zustand `reported` | CODE `state.ts:359-364` | „Push erfolgreich, Callback verloren“ ist für den Kern unsichtbar (FR-03) |
| L-04 | **Nach `remote_verified` ist keine Beobachtung mehr möglich** | CODE `state.ts:281` (`requireRun`) | Branch-Löschung, Force-Push, Head-Drift zwischen Verifikation und Abnahme sind nicht aufzeichenbar (RT-09, SM-05) |
| L-05 | **Kein Verifikationsversuch als Zustand.** `verification_recorded` ist das erste und einzige Verifier-Event | CODE `events.ts`, Deep Audit §3.1 | „Verifier startet nicht“ und „Verifier stirbt“ sind ununterscheidbar von „noch nicht dran“ |
| L-06 | **Contract-Revision während aktivem Run erlaubt** | CODE `state.ts:293-307` (keine Prüfung auf aktiven Run); RT-07 | Run endet `verified` auf `superseded`, Ergebnis still wertlos |
| L-07 | **Duplikate sind keine No-ops.** Zweites `run_started` mit gleicher `runId` → `RUN_ALREADY_EXISTS`; zweiter Report → `RUN_STATE_INVALID` | CODE `state.ts:332`, Deep Audit E-16 | Ein Appender, der Ablehnungen als Fehler behandelt, bricht bei jedem Retry; ein Duplikat ist nicht von einem echten Konflikt unterscheidbar |
| L-08 | **Kein Event-ID, kein `seq`, kein `prevHash`** | Deep Audit §5.1 | Idempotenz und Single-Writer sind nicht formulierbar |
| L-09 | **Start-Gate kennt nur den eigenen Task.** Keine Prüfung anderer aktiver Runs, kein `main` | CODE `start-gate.ts:55-101` | Zwei Runs mit gleichem Scope starten ungehindert; Staleness gegenüber `main` existiert nicht (Deep Audit §9.1) |
| L-10 | **Run startet vom Contract-Commit, Base ist Teil des Contract-Hashes.** `startFromCommit = revision.contractCommit`, `baseCommit` in den gehashten Metadaten | CODE `start-gate.ts:100`, `contract-document.ts:29` | Jede neue Base erzwingt eine neue Contract-Version und damit ein neues Architektur-Review. Ein bloß veralteter Run kann nicht billig nachgezogen werden |
| L-11 | **Späte Ergebnisse werden abgewiesen, aber nicht festgehalten.** Nach `run_abandoned` scheitert jede Beobachtung/Evidence mit `RUN_STATE_INVALID` | Deep Audit E-21 (SM-09) | Verwaiste Commits existieren nur in Git, ohne Spur im Log |
| L-12 | **Kein `NEEDS_HUMAN`, kein `task_withdrawn`, kein `stale`, kein `merged`** | Deep Audit §3.1 | Jeder Stillstand sieht gleich aus |
| L-13 | **Keine Laufzeit.** Kein Prozess erzeugt Events, liest Git oder hält einen Log | Deep Audit §2.1 | Recovery existiert heute nur als Chat zwischen Seb und Agenten |

### 1.2 Was der Pilot gezeigt hat und welcher Mechanismus fehlte

| # | Vorfall | Beleg | Klasse | Fehlender Mechanismus |
|---|---|---|---|---|
| P-A | Agent produziert lokalen Commit, Push schlägt fehl | PILOT | Persistenzlücke | Fortschritt zählt nur, wenn er in Git ist; Push-Protokoll mit Prüfung per `ls-remote`; Lease, die ohne Push abläuft |
| P-B | Contract wurde parallel weiterentwickelt | PILOT; GIT: TASK-0005 v1→v2 auf `codex/mystery-task-0005`, Review von v1/v2 nur auf Claude-Branch `be40a68`; FORGE-CORE-0001B v1 und `FORGE-CORE-0001B.v2.md` nebeneinander | Stale Contract | Sperre für Contract-Revision bei aktivem Run (L-06); Contract nur aus `main` |
| P-C | Ein Agent hielt TASK-0004 für Draft, obwohl Contract v1 (`6a8c0c5`) und Implementierung (`e9cb8e2`) existierten | PILOT; GIT: `forge/contracts/TASK-0004.md` trägt `status: approved` und „Review ausstehend“ im selben Frontmatter | Stale Context | Status nur abgeleitet; Read-Receipt (Log-`seq`, `main`-SHA) im Run-Manifest |
| P-D | Verschiedene Branches enthielten unterschiedliche Projektstände | GIT: Deep Audit §2.4; `git merge-tree` → add/add-Konflikt in `forge/coordination/CODEX.md`; Merge-Base beider Codex-Branches ist `e9cb8e2` | Kein Integrationspunkt | `main` als einziger Projektstand; Reconciler listet „nicht integrierte Arbeit“ |
| P-E | Tasks wurden gegen veraltete Dependency-SHAs spezifiziert | GIT: FORGE-CORE-0001A `baseCommit = e9cb8e2` (ungeprüft); TASK-0005 `base_commit 1de7efe` existiert nur auf einem Agenten-Branch; TASK-0004-Handoff: Base `5bfa5a4` vs. Branch-Head `be40a68` | Stale Dependency | Dependency = „Merge-Commit des Tasks ist Vorfahre von `main`“; Base nur aus `main` |

**Gemeinsamer Nenner aller fünf:** Jeder Beteiligte hatte einen *lokal* gültigen Zustand (eigener Checkout, eigener Branch, eigener Chat-Kontext) und es gab keine Instanz, die diesen gegen einen gemeinsamen, dauerhaften Zustand abgeglichen hat. Genau diese Instanz ist der Reconciler aus §3.

---

## 2. Failure Matrix

### 2.1 Begriffe

- **Persistiert** = was nach dem Fehler dauerhaft existiert, getrennt nach **Log** (Forge-Log, V0.1 JSONL in Git) und **Git** (Refs, Commits, PRs, Check-Runs auf GitHub). Lokaler Agent-Zustand wird separat genannt, zählt aber nie.
- **Beobachtbar** = was der Reconciler beim nächsten Lauf sehen kann, ohne dem Agenten zu glauben.
- **Sicherer Schritt** = die Recovery-Aktion, die bei jeder Interpretation des Fehlers korrekt ist (also auch dann, wenn der Agent noch lebt).
- **A** = automatisch durch den Reconciler. **NH** = `NEEDS_HUMAN` mit Grundcode aus §8. **A→NH** = automatisch bis zum Retry-Limit, dann NH.

Annahmen (V0.1 nach Deep Audit §17): Run = Ref `forge/run/<runId>` + PR gegen `main`; Verifier = Actions-Workflow aus `main`; Reconciler = Workflow mit Concurrency-Gruppe; Ruleset verbietet Force-Push und Löschen auf `main` und `forge/run/**` für Agenten-Identitäten.

### 2.2 Matrix

| # | Fall | Persistiert | Beobachtbar | Sicherer Recovery-Schritt | A / NH |
|---|---|---|---|---|---|
| F-01 | **Agent stirbt vor Änderung** | Log: `run_started`, Lease. Git: Run-Ref == Startcommit. Lokal: nichts | Ref-Head unverändert, kein PR; nach `leaseUntil` keine Bewegung | Nach Ablauf (bestätigt durch erfolgreiche Beobachtung): `run_expired(NO_PROGRESS)`. Scope-Lease frei. Task zurück auf `ready`. Neuer Attempt mit neuer `runId` und neuem Ref, wenn Retry-Budget übrig | A→NH (`RETRY_BUDGET_EXHAUSTED`) |
| F-02 | **Nach Änderung, vor Commit** | wie F-01. Lokal: schmutziger Working Tree (bei Cloud-Containern meist verloren, bei Codex/Windows evtl. vorhanden) | identisch mit F-01; Forge kann den Unterschied nicht sehen und soll es nicht | wie F-01. Uncommitted Arbeit ist für Forge nicht existent. Prävention: Agent-Protokoll „früh und oft WIP-Commits pushen“ (§7) | A→NH |
| F-03 | **Nach Commit, vor Push** (P-A) | wie F-01. Lokal: Commit `c1` | identisch mit F-01, solange der Agent nicht pusht | Lebt der Agent noch: er pusht innerhalb der Lease → normaler Fortschritt (F-05 gilt für den Push). Sonst F-01. Kommt der Push nach Ablauf: F-19 | A |
| F-04 | **Während Push** | Git-Ref-Update ist atomar: Ref zeigt entweder auf alten Head oder auf `c1`. Hochgeladene, nicht referenzierte Objekte sind unsichtbar | Ref-Head ist alt **oder** `c1`; sonst nichts | Agent-Seite: Push-Ergebnis ist unklar → `git ls-remote origin forge/run/<runId>`; ist Head == `c1`: fertig; ist Head == alter Head: denselben Push wiederholen (idempotent); sonst F-04b. Forge-Seite: nichts zu tun, Beobachtung zeigt die Wahrheit | A |
| F-04b | Push abgelehnt, **non-fast-forward** | Git: Ref zeigt auf `x`, der nicht Vorfahre von `c1` ist | Ref-Head `x` ≠ letzter beobachteter Head des Agenten | Nie Force-Push (Ruleset verhindert es ohnehin). Agent fetcht: ist `c1` Nachfahre von `x`, war es ein Race mit sich selbst → normal pushen. Sonst hat **jemand anderes** in den Run-Ref geschrieben → Agent stoppt, Reconciler setzt NH | NH (`FOREIGN_WRITE_ON_RUN_REF`) |
| F-04c | Push abgelehnt, **403 / Rechte** | nichts Neues | Push-Fehler nur beim Agenten | Agent meldet über das einzige Rückkanal-Mittel, das ohne Push geht (PR-Kommentar ist auch Schreibzugriff, also meist ebenfalls blockiert). Forge sieht F-01 → Lease läuft ab. Wiederholte Ablaufe desselben Agenten ohne jeden Push sind ein Rechte-Signal | A→NH (`AGENT_CANNOT_PUSH` nach 2 Abläufen ohne einen einzigen Push) |
| F-05 | **Push erfolgreich, Callback verloren** | Git: Ref-Head `c1`, evtl. PR. Log: nur `run_started` | Ref-Head ≠ Startcommit | Kein Callback nötig. Reconciler schreibt `progress_observed(runId, c1)` und verlängert die Lease. „Fertig“ ist ebenfalls aus Git ablesbar: PR existiert und ist *ready for review* (nicht Draft). Dann `run_submitted(runId, headSha)` mit `headSha` aus GitHub, nicht aus einer Agentenaussage | A |
| F-06 | **Run-Branch gelöscht** | Git: Ref fehlt; Commits evtl. noch per SHA abrufbar (nicht garantiert). Log: letzter beobachteter Head `h` | `ls-remote` ohne Ref; `GET /commits/h` | (a) Run aktiv, `h` abrufbar: Forge legt den Ref auf `h` neu an (Forge besitzt den Namensraum `forge/run/**`, Anlegen auf bekannten SHA ist idempotent). (b) `h` nicht abrufbar: `run_failed(RESULT_LOST)`, neuer Attempt. (c) Run schon gemergt: normales Aufräumen, ignorieren. (d) Löschung durch Agenten-Identität trotz Ruleset: Ruleset-Fehlkonfiguration | (a)(b)(c) A; (d) NH (`PROTECTION_BYPASSED`) |
| F-07 | **Force-Push auf Run-Branch** | Git: Head `h2`, nicht Nachfahre von `h` | Reconciler: `isAncestor(h, h2)` falsch | Run sofort `run_failed(HISTORY_REWRITTEN)`. Kein Merge, auch nicht von `h`. Ruleset sollte das verhindern; wenn es trotzdem passiert, war es ein Owner-Bypass oder eine Fehlkonfiguration | NH (`HISTORY_REWRITTEN`) |
| F-07b | **Force-Push auf `main`** | Git: `main` nicht Nachfahre des letzten beobachteten `main` | wie F-07 auf `main` | `FORGE_HALT` (kein Start, keine Verifikation, kein Merge). Jede `merged`-Aussage im Log ist ungeprüft | NH (`MAIN_REWRITTEN`), global |
| F-08 | **Verifier startet nicht** | Log: `run_submitted(sha)`, `verification_requested(runId, sha, attempt=k)`. Git: kein Check-Run für `sha` | Kein Check-Run mit Workflow-Namen und `head_sha == sha` nach `T_verify_start` (Vorschlag 30 min) | Erneuter Dispatch mit gleichem Schlüssel `(runId, sha, k+1)`. Vor dem Dispatch prüfen, ob ein Check-Run für `(sha, k)` doch existiert (Dispatch-Ergebnis kann verloren sein) | A→NH (`VERIFIER_UNAVAILABLE`, nach 2 Versuchen) |
| F-09 | **Verifier stirbt** | Git: Check-Run `cancelled` / `timed_out` / `failure` **ohne** Evidence-Artefakt | Check-Run-Status + Fehlen des Evidence-Artefakts | Infrastrukturfehler ≠ Testfehler. Kein Evidence-Artefakt → ein Wiederholungsversuch mit `k+1`. Evidence vorhanden mit Exit-Code ≠ 0 → echter Fehlschlag → Rework, **kein** Retry. Evidence nur aus einem abgeschlossenen Job, nie aus Teil-Logs | A→NH (`VERIFIER_UNAVAILABLE`) |
| F-10 | **Reviewer stirbt** | Log: Run `verified`, Review angefordert. Git: PR ohne Review am Head-SHA; evtl. einzelne Kommentare | Kein `APPROVED`/`CHANGES_REQUESTED`-Review am exakten Head-SHA nach `T_review` | Teil-Kommentare zählen nicht. Erinnerung einmal (idempotent per `(runId, sha, reviewer)`). Neue Zuweisung ist Owner-Sache, weil die Reviewer-Wahl Teil der Unabhängigkeitsgarantie ist | NH (`REVIEW_OVERDUE`, niedrige Dringlichkeit) |
| F-11 | **GitHub down** | nichts Neues; laufende Agenten arbeiten lokal weiter, Pushes scheitern | API 5xx / Timeouts beim Reconciler | Nichts schreiben. Aus einem Fehler nie eine negative Beobachtung ableiten (Kern hält das schon: negative Beobachtungen terminieren nicht). **Lease-Uhr steht**, weil Ablauf eine erfolgreiche Beobachtung nach `leaseUntil` verlangt (§7). Agenten: Push mit Backoff wiederholen (F-04). Nach Rückkehr: normaler Reconcile-Lauf holt alles nach | A |
| F-12 | **Backend restart** | V0.1 hat kein Backend. Reconciler-Lauf ist zustandslos: Log + Git rein, Events raus | Ein abgebrochener Reconciler-Lauf hat entweder seinen Log-Append gepusht oder nicht (atomares Ref-Update) | Nächster Lauf rechnet alles neu. Doppelt erzeugte Events sind durch deterministische `eventId` No-ops (§4). Gilt genauso für eine spätere lokale CLI oder einen Server | A |
| F-13 | **Duplicate Webhook** | Git: unverändert. Log: Event evtl. schon vorhanden | gleiche `X-GitHub-Delivery`-ID **oder** gleiche abgeleitete Tatsache | Der Webhook ist nur ein *Weckruf*, kein Datenträger: der Reconciler liest bei jedem Lauf den aktuellen Git-Zustand. Daraus abgeleitete Events haben inhaltsbasierte `eventId` → No-op. Damit ist auch „zwei verschiedene Trigger beobachten dieselbe Tatsache“ (Push-Event + Schedule) abgedeckt | A |
| F-14 | **Start zweimal gedrückt** | Log: evtl. zwei `start_requested` | gleiche Anfrage | `runId = run:<task>-v<version>-a<attempt>`, `attempt` = Anzahl bisheriger Runs dieser Revision + 1, berechnet aus dem Log. Beide Klicks erzeugen dieselbe `runId` und dieselbe `eventId` → zweiter ist No-op. Echte Nebenläufigkeit (beide lesen denselben Log) löst der Fast-Forward-Append: der zweite Schreiber verliert, liest neu, sieht den Run, No-op | A |
| F-15 | **Kill während Agent läuft** | Log: `run_cancelled(runId, by owner)`. Git: Ref mit WIP | Cancel-Event im Log | Forge kann den Agentenprozess nicht beenden (Forge betreibt keine Agenten) und behauptet das auch nicht. Wirkung: Run terminal, Scope-Lease frei, PR wird von Forge geschlossen, jeder spätere Push auf diesen Ref ist **verwaist** (F-19). Agent-Protokoll: vor jedem Push `forge status <runId>` prüfen und bei `cancelled` stoppen (Höflichkeit, nicht Sicherheit) | A |
| F-16 | **Kill während Push** | Reihenfolge Log ↔ Git ist beliebig | Ref evtl. mit `c1`, Log mit `run_cancelled` | Der Log entscheidet: Cancel ist eine Owner-Entscheidung und gewinnt immer, egal ob der Push davor oder danach landete. `c1` wird als `late_result_observed` festgehalten (nur Spur, kein Zustand). Nie mergen. Wiederverwenden nur über F-19 | A |
| F-17 | **Stale Contract** (P-B) | Log: Run auf Revision v1; v2 registriert (heute erlaubt, L-06) | `run.contentHash ≠ currentContract.contentHash` | **V0.1: verhindert.** `contract_registered` bei aktivem Run → abgelehnt (`RUN_ACTIVE`). Will der Spec-Autor dennoch ändern, braucht er ein Owner-Cancel → NH. Für Altbestände (v2 kam vor Einführung der Regel): Run sofort `run_superseded`, kein Merge möglich | NH (`CONTRACT_CHANGE_DURING_RUN`) |
| F-18 | **Stale Dependency** (P-E) | Log: Contract B nennt Dependency A mit Commit `a1`. Git: `main` enthält A als `a1'` (anderer SHA nach Reconcile von A) oder A wurde revertiert | Merge-Commit von A ist nicht Vorfahre von `main`, oder ist es nicht mehr (Revert) | Vor Start: Start-Gate blockiert (`DEPENDENCY_NOT_IN_MAIN`) → A, Task bleibt `ready`, kein Run. Während Run: A wird revertiert oder neu definiert → B `stale_dependency`, kein Merge, NH. Ein bloß neuerer `main`, der A unverändert enthält, ist **kein** Stale-Dependency-Fall, sondern Stale Base (§5) | vor Start A, während Run NH (`DEPENDENCY_CHANGED`) |
| F-19 | **Worker kommt nach Timeout zurück** | Log: `run_expired` (oder `cancelled`). Git: neuer Push auf alten Ref `forge/run/<alt>`; evtl. läuft schon Attempt `a+1` auf eigenem Ref | Push auf Ref eines terminalen Runs | Fencing über den Namensraum: der Zombie kann den neuen Attempt nicht überschreiben, weil der einen eigenen Ref hat. Reconciler schreibt `late_result_observed(runId, sha)`. Wiederverwendung nur durch bewusste Owner-Entscheidung: neuer Attempt mit `salvageFrom: sha`, der normal verifiziert und reviewt wird. Kein Auto-Salvage | A (Spur), NH nur wenn Owner retten will (`LATE_RESULT_AVAILABLE`, informativ) |
| F-20 | **Lease läuft während Verifikation/Review ab** | Run `submitted`/`verified` | Lease-Ablauf nach Submit | Die Lease gilt nur für die Phase, in der der Developer arbeitet (`STARTED`). Ab `SUBMITTED` ist der Head eingefroren; Verifier und Review haben eigene Fristen (F-08..F-10). Ein Push nach Submit macht die Verifikation ungültig (F-21) | A |
| F-21 | **Head-Drift nach Submit / nach Verify** (SM-05) | Git: PR-Head `h2 ≠ verifiedSha` | `pr.head.sha ≠ verifiedSha` | Verifikation und Review gelten nur für ihren SHA. Run fällt zurück nach `STARTED`-Äquivalent (`resubmitted`); neue Verifikation nötig. Merge ist ohnehin CAS auf `verifiedSha` | A |
| F-22 | **Zwei Agenten bekommen denselben Run** (Doppelzuweisung, P-B-Variante) | Git: zwei Schreiber auf einem Ref | F-04b beim zweiten | Wer zuerst pusht, gewinnt; der zweite bekommt non-ff und stoppt. Ursache ist eine doppelte Beauftragung durch Menschen → NH | NH (`FOREIGN_WRITE_ON_RUN_REF`) |
| F-23 | **Agent arbeitet auf falschem Stand** (P-C, P-D) | Git: Run-Ref-Commits mit Parent außerhalb des Startcommits, oder PR-Body mit falscher Read-Receipt | `startSha` ist nicht Vorfahre des Heads; oder Receipt (`logSeq`, `mainSha`, `contractHash`) ≠ Manifest | Submit wird abgelehnt (`WRONG_BASE` / `RECEIPT_MISMATCH`). Neuer Attempt mit korrektem Manifest | A→NH bei Wiederholung |
| F-24 | **Reconciler selbst hängt oder fällt aus** | Log: letzter Append alt | Owner sieht „Log-Head älter als X“ in `forge status` | Kein Watchdog-Dienst. Der Schedule-Trigger ist der Watchdog; fällt auch der aus, zeigt `forge status` das Alter des Log-Heads. Nichts geht verloren, weil alles aus Git nachgerechnet wird | NH (`RECONCILER_STALLED`) erst ab z. B. 6 h |

### 2.3 Drei Einsichten aus der Matrix

1. **Nur vier der 24 Fälle brauchen eine Uhr** (F-01..F-03, F-08). Alles andere ist ein Vergleich zwischen Log und Git. Deshalb reicht eine einfache Lease; Zeit muss nicht in den Kern.
2. **Kein Fall verlangt, dem Agenten etwas zu glauben.** Push-Erfolg, Fertig-Signal, Ergebnis-SHA, Verifikation, Review: alles ist aus GitHub ablesbar. Der Developer-Report wird damit zur Beschreibung, nicht zur Tatsache (konsistent mit Deep Audit §14.5).
3. **Alle NH-Fälle sind entweder Rechte-/Identitätsprobleme (F-04c, F-06d, F-07, F-22), Semantik (F-17, F-18) oder ausgeschöpfte Budgets.** Infrastrukturausfälle (F-11, F-12, F-13, F-24 bis zur Schwelle) sind nie NH.

---

## 3. Recovery State Machine

### 3.1 Prinzip

```text
     Forge-Log (Absichten, Entscheidungen)          GitHub (Arbeit, Fortschritt)
     task/contract/approval/start/cancel/            refs, commits, PRs, reviews,
     review/human_resolved                           check-runs, Artefakte
                    \                                  /
                     \                                /
                      ▼                              ▼
              reconcile(log, gitSnapshot, now, policy)   ← rein, deterministisch, testbar
                                   │
                                   ▼
                  neue Events (mit deterministischer eventId)
                  + idempotente Git-Aktionen (Ref anlegen, PR schließen,
                    Verifier dispatchen, Merge per CAS)
                                   │
                                   ▼
             Append an log.jsonl als Fast-Forward-Push (verliert → neu rechnen)
```

- `reconcile` ist eine reine Funktion wie der heutige Kern. Sie wird getestet wie der Kern: Log-Präfix + Git-Snapshot + Zeit → erwartete Events. Damit sind alle Fälle aus §2 als Unit-Tests formulierbar, ohne GitHub.
- Ausgeführt wird sie von einem Workflow mit `concurrency: { group: forge-reconcile, cancel-in-progress: false }`, getriggert durch `push`, `pull_request`, `pull_request_review`, `check_run`/`workflow_run`, `workflow_dispatch` (Owner-Aktionen) und `schedule` (alle 15 min als Watchdog; GitHub garantiert Schedule-Pünktlichkeit nicht, daher nur als Netz).
- Der **Kern bleibt zeitlos**. Der Reconciler entscheidet „Lease abgelaufen“ und schreibt `run_expired` mit Rolle `system`. Der Kern prüft nur, ob das Event im aktuellen Zustand zulässig ist. Determinismus des Replays bleibt erhalten, weil die Zeitentscheidung als Tatsache im Log steht.

### 3.2 Run-Zustände

Persistiert wird **kein** Zustand, nur Events; Zustände sind abgeleitet (bewährtes Prinzip des Kerns).

| Zustand | Bedeutung | Abgeleitet aus | Kern-Entsprechung heute |
|---|---|---|---|
| `REQUESTED` | Start angefordert, Gate noch nicht bestanden oder Ref noch nicht angelegt | `start_requested` | – |
| `STARTED` | Ref existiert auf Startcommit, Lease aktiv, Developer arbeitet | `run_started` (+ `progress_observed`*) | `running` |
| `SUBMITTED` | Developer hat fertig gemeldet; Head eingefroren = `submittedSha` | `run_submitted(sha)` aus „PR ready for review“ | `reported` + `remote_verified` (zusammengelegt: ein PR-Head **ist** remote persistiert) |
| `VERIFYING` | Verifier angefordert, Versuch `k` | `verification_requested(sha, k)` | – (L-05) |
| `VERIFIED` | Evidence grün für `sha` | `verification_recorded` | `verified` |
| `REWORK` | Evidence rot oder Review `request_changes(code_change)` | `verification_recorded` (rot) / `code_review_recorded` | `failed` bzw. Task `rework_required` |
| `APPROVED` | Review approve am exakten `sha` | `code_review_recorded` | Task `review_approved` |
| `STALE` | `main` ist kein Vorfahre von `sha` | abgeleitet aus Git, **kein Event** nötig | – |
| `MERGED` | PR gemergt mit Head == `verifiedSha` | `run_merged(sha, mergeCommit)` | Task `accepted` |
| `EXPIRED` | Lease abgelaufen ohne Submit | `run_expired` (system) | `abandoned(WORKER_LOST)` |
| `CANCELLED` | Owner-Abbruch | `run_cancelled` (owner) | `abandoned(OWNER_CANCELLED)` |
| `SUPERSEDED` | Contract-Revision geändert (nur Altfälle, §2 F-17) | `contract_registered` bei aktivem Run | `verified` auf superseded (RT-07) |
| `FAILED` | technischer Endzustand mit Code (`RESULT_LOST`, `HISTORY_REWRITTEN`, `WRONG_BASE`, `DEVELOPER_ABORTED`) | `run_failed` | `failed` |

\* `progress_observed` ist optional als Log-Event. Alternative: der Reconciler leitet `lastProgressAt` bei jedem Lauf aus den Events `ref_head_observed` ab. Empfehlung: **ein** Event je neuem Head (`ref_head_observed(runId, sha)`), weil damit auch F-06 (Wiederherstellen auf letzten Head) und F-07 (Vorfahrenprüfung) eine Grundlage im Log haben. Volumen: ein Event pro Push, unkritisch.

**Overlay `NEEDS_HUMAN(code)`:** kann auf jedem nicht-terminalen Zustand liegen und auf der Task-Ebene (z. B. `RETRY_BUDGET_EXHAUSTED`). Es blockiert alle automatischen Übergänge *dieses* Runs/Tasks (andere Tasks laufen weiter), außer Beobachtungen (die werden weiter aufgezeichnet). Aufgehoben nur durch `human_resolved(code, decision)` vom Owner.

### 3.3 Diagramm

```text
                         start_requested (idempotent per runId)
                                   │ Gate ok + Ref angelegt
                                   ▼
        ┌─────────────────────── STARTED ◄──────────────── resubmit (Head-Drift, F-21)
        │  Lease aktiv;           │  ▲                                         ▲
        │  ref_head_observed ─────┘  │ (verlängert Lease)                      │
        │                            │                                         │
        │ Lease abgelaufen           │ PR ready for review                     │
        │ (bestätigt)                ▼                                         │
        ▼                        SUBMITTED ──── verification_requested ──► VERIFYING
     EXPIRED ◄── (terminal)          │                                   │  │  │
                                     │                 Infra-Fehler,k<2  │  │  │ Infra-Fehler,k=2
                                     │                 ┌─────────────────┘  │  └──► NH(VERIFIER_UNAVAILABLE)
                                     │                 ▼                    │
                                     │             VERIFYING(k+1)           │ Evidence
                                     │                                      ▼
                                     │                       grün ──► VERIFIED ──review──► APPROVED
                                     │                       rot  ──► REWORK                 │
                                     │                                  │                    │ main bewegt
                                     │      neuer Attempt (neue runId) ◄┘                    ▼
                                     │                                                    STALE
                                     │                                                      │ RECONCILE (§5):
                                     │                                                      │ main mergen → neuer sha
                                     └──────────────────────────────────────────────────────┘ → VERIFYING; Re-Review
                                                                                              nur wenn Auflösung Code änderte
   APPROVED ∧ verifiedSha == PR-Head ∧ main ⊑ sha ──► Merge (CAS auf sha) ──► MERGED (terminal)

   Aus jedem nicht-terminalen Zustand:
     run_cancelled (owner)            ──► CANCELLED (terminal)
     run_failed(code) (system/dev)    ──► FAILED (terminal)
     contract_registered (Altfall)    ──► SUPERSEDED (terminal)
   Overlay jederzeit: NEEDS_HUMAN(code) — blockiert Automatik, bis human_resolved
```

### 3.4 Übergangstabelle

| Von | Auslöser (beobachtet / Event) | Wächter | Neues Event | Wer | A/NH |
|---|---|---|---|---|---|
| – | Owner drückt Start | Task `ready`/`rework_required`, Gate gegen echtes Git, Scope-Lease frei, Retry-Budget übrig, kein `FORGE_HALT` | `start_requested`, dann `run_started(startSha, leaseUntil)` und Ref-Anlage | Reconciler | A |
| `REQUESTED` | Ref-Anlage scheitert (Ref existiert auf anderem SHA) | – | – | Reconciler | NH (`RUN_REF_CONFLICT`) |
| `STARTED` | neuer Head `h` auf Run-Ref | `startSha ⊑ h`, `lastHead ⊑ h` | `ref_head_observed(h)`, Lease verlängert | Reconciler | A |
| `STARTED` | neuer Head nicht Nachfahre | – | `run_failed(HISTORY_REWRITTEN)` | Reconciler | NH |
| `STARTED` | `now > leaseUntil`, erfolgreiche Beobachtung ohne neuen Head | – | `run_expired(NO_PROGRESS)` | Reconciler | A |
| `STARTED` | `now > startedAt + leaseCap` | trotz Fortschritt | – | Reconciler | NH (`RUN_OVERLONG`) |
| `STARTED` | PR ready for review, Head `s` | `startSha ⊑ s`, Read-Receipt stimmt, `changedFiles(startSha..s)` ⊆ Scope (echter Diff) | `run_submitted(s)` | Reconciler | A |
| `SUBMITTED` | – | kein `FORGE_HALT` | `verification_requested(s, 1)` + Dispatch | Reconciler | A |
| `VERIFYING(k)` | kein Check-Run nach `T_verify_start` / Job ohne Evidence beendet | `k < 2` | `verification_requested(s, k+1)` | Reconciler | A |
| `VERIFYING(2)` | wie oben | – | – | Reconciler | NH |
| `VERIFYING` | Evidence-Artefakt aus abgeschlossenem Job für `s` | – | `verification_recorded` | Reconciler (Aggregator) | A |
| `VERIFIED` | Review am PR mit `commit_id == s` | Reviewer ≠ Developer (GitHub-Login), Reviewer zugewiesen | `code_review_recorded` | Reconciler | A |
| `APPROVED` | Owner merged (oder Owner-Merge-Dispatch) | `pr.head == verifiedSha`, `main ⊑ verifiedSha`, keine offene NH | Merge per API mit `sha`-Parameter, dann `run_merged` | Owner (+Reconciler) | Merge = Owner-Aktion |
| `APPROVED`/`VERIFIED` | `main ⋢ s` | – | (abgeleitet `STALE`) | – | A |
| `STALE` | Policy §5 ergibt RECONCILE-auto | Merge `main → run-ref` textuell sauber, keine geteilten Flächen berührt | Forge legt Merge-Commit `m` auf Run-Ref an (Update-Branch, CAS auf `s`) → `ref_head_observed(m)` → `run_submitted(m)` | Reconciler | A |
| `STALE` | Policy §5 ergibt RECONCILE-dev | Konflikt in eigenen Scope-Dateien | Run zurück an Developer: Lease neu, Status „reconcile required“ | Reconciler | A |
| `STALE` | Policy §5 ergibt RESTART/NH | – | `run_failed(STALE_BASE)` bzw. NH | Reconciler | A / NH |
| beliebig aktiv | Owner Cancel | – | `run_cancelled`, PR schließen, Scope-Lease frei | Owner | – |
| terminal | neuer Push auf Ref | – | `late_result_observed(sha)` | Reconciler | A |

### 3.5 Invarianten (als Tests des Reconcilers formulierbar)

1. **I-1 Ein aktiver Run je Task** (heute schon im Kern) **und je Scope-Pfad über alle Tasks** (neu, §5).
2. **I-2 Der Merge-Commit eines `MERGED`-Runs hat `verifiedSha` als Parent** und `verifiedSha` hat eine grüne Evidence mit `diffBase == startSha` (Deep Audit NRT-01).
3. **I-3 Kein Event erzeugt aus einer gescheiterten Beobachtung einen negativen Zustandswechsel.** Ablauf, Löschung, Force-Push werden nur aus erfolgreichen Beobachtungen abgeleitet.
4. **I-4 Ein terminaler Run wird nie wieder aktiv.** Retry = neue `runId`.
5. **I-5 `reconcile` ist idempotent:** `reconcile(log + reconcile(log, g), g) == ∅` bei gleichem Git-Snapshot und gleicher Zeit.
6. **I-6 Replay ohne Zeit:** der Kern-Replay des Logs ergibt denselben Zustand, egal wann er läuft (Zeitentscheidungen stehen als Events im Log).

---

## 4. Idempotency Rules

### 4.1 Grundregel

Jede Forge-Operation hat einen **Idempotenzschlüssel**, der aus fachlichen Größen berechnet wird, nicht aus Zufall oder Zeit. Für Log-Events ist der Schlüssel die `eventId`.

| Ergebnis beim zweiten Mal | Bedeutung | Reaktion |
|---|---|---|
| gleicher Schlüssel, gleicher Inhalt | Duplikat | No-op, Erfolg melden |
| gleicher Schlüssel, anderer Inhalt | echter Konflikt | ablehnen, `NEEDS_HUMAN(IDEMPOTENCY_CONFLICT)` |
| anderer Schlüssel, im aktuellen Zustand unzulässig | Kern-Ablehnung | ablehnen, **nicht** in den Log |

Damit ist L-07 gelöst, ohne die Kern-Semantik zu ändern: Duplikaterkennung passiert *vor* `applyEvent` im Appender.

### 4.2 Operationen und ihre Schlüssel

| Operation | Muss idempotent sein? | Schlüssel | Mechanismus |
|---|---|---|---|
| Task registrieren | ja | `task:<taskId>` | gleiche ID + gleicher Titel = No-op |
| Contract registrieren | ja | `contract:<taskId>:v<version>:<contentHash>` | Text = Blob am Merge-Commit des Spec-PR; gleicher Hash = No-op |
| Architektur-Approval | ja | `approval:<contentHash>:<reviewerLogin>` | GitHub-Review-ID ist zusätzlich eindeutig |
| **Run starten** | **ja, kritisch** (F-14) | `run:<taskId>-v<version>-a<attempt>` | `attempt` aus Log berechnet; Fast-Forward-Append als CAS |
| Run-Ref anlegen | ja | Ref-Name + Ziel-SHA | `POST /git/refs`; „existiert bereits“ mit gleichem SHA = Erfolg, mit anderem SHA = NH |
| Agent-Push | ja (vom Agenten) | Ref + Ziel-SHA | Git-Push desselben SHA ist No-op; nie `--force` |
| PR öffnen | ja | Head-Ref | Vor Anlage nach PR mit diesem Head suchen |
| Head beobachten | ja | `head:<runId>:<sha>` | inhaltsbasiert (F-13) |
| Submit | ja | `submit:<runId>:<sha>` | gleicher SHA = No-op; neuer SHA = Resubmit |
| Verifier dispatchen | ja | `verify:<runId>:<sha>:<attempt>` | Vor Dispatch nach existierendem Check-Run für `(sha, attempt)` suchen; Dispatch-Input trägt den Schlüssel, der Job schreibt ihn ins Artefakt |
| Evidence aufzeichnen | ja | `evidence:<runId>:<sha>:<attempt>` | ein Artefakt je Schlüssel; zweites Artefakt mit anderem Inhalt = NH |
| Code-Review aufzeichnen | ja | `review:<runId>:<sha>:<reviewerLogin>:<githubReviewId>` | nur das letzte Review je Reviewer am exakten SHA zählt |
| Lease verlängern | ja, monoton | `lease:<runId>:<sha>` | `leaseUntil` nur nach vorn |
| Lease-Ablauf | ja | `expire:<runId>:<leaseUntil>` | zweiter Lauf erzeugt denselben Schlüssel |
| Cancel | ja | `cancel:<runId>` | auf terminalem Run No-op |
| Ref wiederherstellen (F-06) | ja | Ref + SHA | wie Ref anlegen |
| PR schließen | ja | PR-Nummer | geschlossen = Erfolg |
| Branch mit `main` aktualisieren (RECONCILE-auto) | ja, **CAS** | `reconcile:<runId>:<sha>:<mainSha>` | `PUT /pulls/{n}/update-branch` mit `expected_head_sha = sha` |
| **Merge** | **ja, CAS** | `merge:<runId>:<verifiedSha>` | `PUT /pulls/{n}/merge` mit `sha = verifiedSha`; ist der PR schon mit diesem SHA gemergt = Erfolg |
| Benachrichtigung an Seb | ja (sonst Spam) | `notify:<reasonCode>:<runId|taskId>:<eventId>` | höchstens einmal je Grund und Ursache |
| Log-Append | ja | `seq` + `prevHash` | Fast-Forward-Push; verliert → neu lesen, Duplikate fallen per `eventId` raus |
| Retry-Zähler | – (nicht gespeichert) | – | aus dem Log gezählt, nie als Zähler persistiert |

### 4.3 Was nicht idempotent ist und deshalb geschützt werden muss

| Operation | Warum nicht idempotent | Schutz |
|---|---|---|
| **Agent-Arbeit selbst** (LLM-Session) | kostet Geld, Ergebnis nicht deterministisch | Nur über `runId` startbar; Retry-Budget je Task-Revision (Vorschlag 2 automatische Attempts); kein Auto-Retry nach Testfehler |
| Verifier-Lauf | kostet Runner-Minuten, kann flaky sein | max. 2 Versuche je `(runId, sha)`; ein zweites Rot mit Evidence ist echt |
| Benachrichtigung an Menschen | jede Wiederholung kostet Aufmerksamkeit | Dedup-Schlüssel (oben) |
| Owner-Merge in GitHub-UI | Mensch klickt, nicht Forge | Branch-Protection: Required Check am exakten Head + „up to date“ macht den falschen Merge unmöglich, auch ohne Forge |

### 4.4 Event-Umschlag (Ergänzung zu Deep Audit §5.4)

Deep Audit §5.4 schlägt `seq`, `eventId`, `prevHash`, Genesis vor. Für Recovery kommen hinzu:

- `cause`: die `eventId` oder die GitHub-Objekt-ID (Delivery, Check-Run, Review), aus der das Event abgeleitet wurde. Damit sind Duplikate auch über verschiedene Trigger erkennbar.
- `observedAt`: Zeit des Reconcilers (nicht des Agenten). Wird nur für Lease-Entscheidungen *bei der Erzeugung* benutzt; der Replay ignoriert sie (I-6).
- Rolle `system` für `run_expired`, `ref_head_observed`, `run_submitted`, `verification_requested`, `late_result_observed`, `run_failed(RESULT_LOST|HISTORY_REWRITTEN|WRONG_BASE|STALE_BASE)`. Identität = Workflow (`github-actions[bot]` im Repo `Wuerfelduell/Forge`, Workflow-Pfad auf `main`).

---

## 5. Parallel Task Policy

### 5.1 Ausgangslage: A und B starten vom selben Base, A merged zuerst

```text
main:   M0 ──────────────────────────── M1 (= Merge von A)
          \                            /
A:         a1 ── a2 ──────────────────┘
          \
B:         b1 ── b2 ── b3   (verified auf b3, Base M0)
```

**Heute (Kern ohne `main`, CODE):** B wird unabhängig von A `accepted`, obwohl `M1 + b3` nie gebaut, getestet oder reviewt wurde (Deep Audit §9.1).

**V0.1:** B ist `STALE`, sobald `M1` existiert, weil `M1 ⋢ b3`. B darf erst gemergt werden, wenn sein Head `M1` enthält und auf genau diesem Head grün verifiziert ist (Branch-Protection „Require branches to be up to date“ + Required Check). Welcher Weg dorthin, entscheidet die Klassifikation unten.

### 5.2 Die vier Ergebnisse

| Ergebnis | Bedeutung | Wer handelt | Kosten |
|---|---|---|---|
| **CONTINUE** | B arbeitet unverändert weiter; `main` muss erst vor dem Merge hereingeholt werden | niemand jetzt | keine |
| **RECONCILE** | B holt `main` per **Merge-Commit** auf den Run-Ref, neu verifizieren. *auto*: Forge selbst, wenn textuell sauber und keine geteilte Fläche betroffen. *dev*: Developer von B löst Konflikte in Dateien seines Scopes | Forge oder Developer B | ein Verifier-Lauf; Re-Review nur bei Code-Änderung durch die Auflösung |
| **RESTART** | Bs Arbeit ist auf neuem Stand nicht sinnvoll fortsetzbar, der Contract gilt aber weiter. Neuer Attempt vom aktuellen `main` (Developer darf alte Commits per Cherry-Pick mitnehmen) | Developer B, Owner startet | ein Run |
| **NEEDS_HUMAN** | Ob Bs Contract auf dem neuen Stand noch stimmt, ist eine Spezifikationsfrage | Owner / Architekt | ggf. neue Contract-Version mit Review |

**Warum Merge-Commit statt Rebase:** Merge lässt die verifizierten und reviewten Commits von B unverändert (SHAs bleiben, Reviews bleiben an ihren Commits nachvollziehbar), der Run-Ref bleibt Fast-Forward (Ruleset ohne Force-Push bleibt einhaltbar), und die Konfliktauflösung steht isoliert im Merge-Commit, wo der Reviewer sie gezielt ansehen kann. Rebase würde jeden SHA ändern und Force-Push verlangen. **Entscheidung: kein Rebase auf Run-Refs.** („REBASE/RESTART“ aus dem Auftrag wird damit zu „RESTART“.)

### 5.3 Wann ist ein Re-Review nötig?

Ein Re-Review nach RECONCILE ist nötig, **genau wenn** der Merge-Commit `m` nicht dem automatischen Merge-Ergebnis entspricht, also wenn ein Mensch oder Agent bei der Auflösung Inhalt geschrieben hat. Prüfbar, ohne `range-diff` zu interpretieren: `git merge-tree --write-tree main s` liefert ohne Konflikt einen Tree `T`; ist `tree(m) == T`, war die Auflösung mechanisch → kein Re-Review, nur Re-Verify. Sonst: Review nur des Diffs `T..m` (kleiner, gezielter Review).

Offener Punkt für den Spike (INFERRED): Ob GitHubs „Dismiss stale approvals“ ein Approval bei einem sauberen Base-Merge entwertet, muss geprüft werden. Forge sollte sich nicht darauf verlassen, sondern das Review im Log an `s` binden und die Regel oben selbst anwenden.

### 5.4 Klassifikation nach Dateiart

Notation: `D_A` = Dateien, die A geändert hat (`M0..M1`), `D_B` = Dateien, die B geändert hat (`M0..b3`), `S_B` = Bs Scope.

| # | Situation | Ergebnis für B | Begründung | Erkennung |
|---|---|---|---|---|
| PT-01 | **Getrennte Dateien**, keine geteilte Fläche: `D_A ∩ D_B = ∅` | **CONTINUE**, vor Merge **RECONCILE-auto** | Textuell sicher. Semantische Konflikte (A ändert API, B nutzt sie in neuer Datei) findet nur ein Lauf auf `M1 + b3`, deshalb ist Re-Verify Pflicht. Schlägt Re-Verify fehl, obwohl B allein grün war → PT-01b | `merge-tree` ohne Konflikt; `D_A ∩ D_B = ∅` |
| PT-01b | Getrennte Dateien, aber Re-Verify nach Merge rot | **RECONCILE-dev**, wenn die Reparatur in `S_B` liegt; sonst **NEEDS_HUMAN** (`SEMANTIC_CONFLICT`) | Wenn B nur durch Änderung außerhalb seines Scopes grün wird, ist das eine Scope- bzw. Contract-Frage | Evidence rot nur auf Merge-Head |
| PT-02 | **Gleiche Dateien**, textuell sauber mergebar | **RECONCILE-auto**, Re-Verify; kein Re-Review (Tree-Regel §5.3) | Kommt mit Scope-Lease (PT-10) nur vor, wenn A einen Pfad außerhalb seines deklarierten Scopes änderte, was die Scope-Prüfung im Verifier hätte stoppen müssen. Deshalb zusätzlich Warnung an Owner | `D_A ∩ D_B ≠ ∅`, `merge-tree` sauber |
| PT-03 | **Gleiche Dateien, Konflikt** | **RECONCILE-dev**; Re-Review des Auflösungs-Diffs. Muss die Auflösung As Verhalten ändern → **NEEDS_HUMAN** (`SEMANTIC_CONFLICT`) | Konfliktauflösung ist Codearbeit; As Verhalten ist durch As Review gedeckt und darf von B nicht stillschweigend geändert werden | `merge-tree` mit Konflikt; Auflösungs-Diff berührt Zeilen aus `D_A` |
| PT-04 | **`package.json`**, nur A hat geändert | **RECONCILE-auto**; Verifier macht `npm ci` auf Merge-Head | Bs Code muss mit neuer Dependency-Menge laufen; reiner Re-Verify-Fall | `package.json ∈ D_A`, `∉ D_B` |
| PT-05 | **`package.json`**, beide haben geändert | **RESTART** des Dependency-Teils: B übernimmt `main`s `package.json`, wendet seine Absicht mit `npm install <pkg>@<ver>` erneut an. Kein Textmerge | JSON-Textmerge kann syntaktisch gültig und semantisch falsch sein (doppelte Ranges, Skripte). Kommt mit serieller Spur (PT-10) nicht vor; falls doch: Lease-Verletzung → Owner-Hinweis | `package.json ∈ D_A ∩ D_B` |
| PT-06 | **Lockfile** (`package-lock.json`) | **Nie textuell mergen.** Nach jedem Merge, der `package.json` berührt: `npm install --package-lock-only` auf dem Merge-Head durch den Developer (RECONCILE-dev) oder Forge, wenn Policy das Kommando kennt. Verifier: `npm ci` muss erfolgreich sein (scheitert bei Inkonsistenz) | Lockfile ist generiert; ein Textmerge produziert inkonsistente Integrity-Hashes. Lockfile-Änderung ohne `package.json`-Änderung im Scope ist verboten | Lockfile ∈ `D_A` oder `D_B` |
| PT-07 | **Contracts** (`forge/contracts/**`) | Run-PRs dürfen Contracts nie ändern (verbotene Pfade). Änderte A Bs Dependency-Contract (A ist Dependency von B und hat neue Version), → **NEEDS_HUMAN** (`DEPENDENCY_CHANGED`). Änderte A einen Contract, von dem B nicht abhängt → **CONTINUE** | Ob Bs Spezifikation noch stimmt, ist eine Architektur-Frage (Pilot P-03/TASK-0001a) | Dependency-Liste von B ∩ Tasks mit neuer Revision seit Bs Approval |
| PT-08 | **DB-Migrationen** (heute nicht vorhanden; Regel für später) | Migrationen sind serielle Spur (PT-10). Kollision der Nummer → **RECONCILE-dev** (umnummerieren, Re-Verify gegen frische DB). Berührt As Migration dieselbe Tabelle wie Bs → **NEEDS_HUMAN** (`MIGRATION_CONFLICT`) | Reihenfolge ist Semantik; zwei „Version 2“-Migrationen sind kein Textkonflikt, aber ein Datenfehler | Pfadklasse `migrations` in Policy; gleiche Nummer oder gleiche Tabelle (Tabelle: nur per Konvention/Dateiname erkennbar) |
| PT-09 | **Generierte Dateien** (heute nicht relevant) | Nie hand-mergen. Nach Merge regenerieren mit dem in `forge/policy.json` hinterlegten Kommando → **RECONCILE-auto**, wenn Kommando bekannt; sonst **NEEDS_HUMAN** (`NO_REGENERATE_COMMAND`). Verifier: „regenerieren erzeugt keinen Diff“ (Drift-Check) | Generiertes Ergebnis ist Funktion der Quellen; nur die Quellen werden gemergt | Pfadklasse `generated` in Policy |
| PT-10 | **Prävention: Scope-Lease + serielle Spur** | Start von B wird abgelehnt (`SCOPE_LEASE_CONFLICT`), solange A aktiv ist und `S_A ∩ S_B ≠ ∅` oder beide eine Datei der Klasse `shared` im Scope haben | Verlagert PT-02/03/05/08 von „reparieren“ zu „gar nicht erst starten“; kostet bei 2–3 Runs fast nichts | Start-Gate (Deep Audit §9.3 Punkt 4/5) |
| PT-11 | **Koordinationsdateien** (`forge/coordination/*.md`) | Entfernen aus dem Produktrepo (Deep Audit §14.5). Bis dahin: Datei je Agent **und Run**, nie je Agent | Der einzige echte Konflikt im Pilot (CODEX.md add/add, GIT) | – |
| PT-12 | **Testkonfiguration, `tsconfig.json`, `.github/`, `forge/policy.json`** | Verbotene Pfade für Run-PRs (Deep Audit NRT-12). Änderung nur über Owner-Spec-PR, dann für alle aktiven Runs **RECONCILE-auto** mit Re-Verify | Eine Testkonfig-Änderung ändert, was „grün“ bedeutet; alle offenen Runs müssen gegen die neue Bedeutung laufen | Pfadklasse `protected` |
| PT-13 | **A wurde revertiert** nachdem B darauf aufbaut | **NEEDS_HUMAN** (`DEPENDENCY_CHANGED`) | Bs Contract setzt As Verhalten voraus | Revert-Commit von As Merge in `main` (V0.1: nur über einen Forge-Task „revert TASK-X“, der Abhängige markiert) |

### 5.5 Entscheidungsverfahren (in dieser Reihenfolge, erste Regel gewinnt)

```text
1. Hat sich der Contract von B oder einer Dependency von B seit Bs Approval geändert,
   oder wurde eine Dependency revertiert?                         → NEEDS_HUMAN
2. Berührt D_A eine Datei der Klasse protected (Testconfig, CI, Policy)?
                                                                  → RECONCILE-auto (+ Re-Verify)
3. Berühren D_A und D_B gemeinsam eine Datei der Klasse shared
   (package.json, Lockfile, migrations, generated)?               → PT-05/06/08/09
4. Liefert merge-tree(main, b) einen Konflikt?
     4a. Auflösung nur in S_B möglich                             → RECONCILE-dev
     4b. sonst                                                    → NEEDS_HUMAN
5. Sonst                                                          → RECONCILE-auto
6. Re-Verify auf Merge-Head rot?
     6a. Reparatur in S_B                                         → RECONCILE-dev (Rework)
     6b. sonst                                                    → NEEDS_HUMAN (SEMANTIC_CONFLICT)
7. B ist mehr als N Merges hinter main oder RECONCILE schlug zweimal fehl
                                                                  → RESTART (neuer Attempt vom aktuellen main)
```

`N` als Policy-Wert (Vorschlag 5). Schritt 7 verhindert, dass ein langer Run endlos nachgezogen wird.

### 5.6 Weitere Regeln

1. **Ein Integrationszweig.** Projektstand = `main`. Jeder andere Branch ist entweder ein aktiver Run-Ref oder „nicht integrierte Arbeit“ (§6, SD-07). Das beantwortet P-D.
2. **Wer zuerst merged, gewinnt.** Keine Priorisierung, keine Merge-Queue in V0.1. Bei ≤ 3 parallelen Runs ist die Zahl der Reconciles klein.
3. **Parallelitätsgrenze** in `forge/policy.json`: `maxActiveRuns` (Vorschlag 3), `maxActiveRunsPerAgent` (Vorschlag 1). Begründung: Codex arbeitet heute auf einem Windows-Checkout; zwei Runs auf einem Checkout sind die Quelle von P-A/P-D-artigen Verwechslungen.
4. **Spec-PRs sind ebenfalls parallel.** Zwei Spec-PRs für verschiedene Tasks stören sich nicht. Zwei Spec-PRs für denselben Task: der zweite wird beim Merge abgelehnt, weil `contractVersion` nicht mehr „höchste + 1“ ist (Kern prüft das schon, `CONTRACT_VERSION_NOT_NEXT`). Das ist bereits die richtige Regel gegen P-B auf Spec-Ebene.
5. **Contract-Base und Run-Base trennen (DECISION, braucht Seb).** Heute ist `baseCommit` Teil des gehashten Contracts (L-10), und der Run startet vom Contract-Commit. Folge: jede neue Base = neue Contract-Version = neues Review. Vorschlag: Der Contract nennt nur seine Dependencies (Task-IDs, die in `main` gemergt sein müssen) und optional `specifiedAgainst` (der `main`-SHA, gegen den die API gelesen wurde). Der Run startet vom **aktuellen `main`-Head**, der `specifiedAgainst` als Vorfahren haben muss. Damit sind RECONCILE und RESTART billig und Contract-Revisionen bleiben für echte Spezifikationsänderungen reserviert. Gegenargument: ein Contract, der gegen `M0` geschrieben wurde, kann auf `M5` falsch sein. Antwort: genau das prüft der Verifier auf dem Merge-Head; semantische Änderungen an Dependencies fängt Regel 1 in §5.5.

---

## 6. Stale Detection

Jeder Pilot-Vorfall ist eine Form von „ein Beteiligter handelt auf einem veralteten Zustand“. Jede Staleness braucht einen Detektor, der **ohne Agentenaussage** auskommt.

| ID | Art | Frage | Detektor (Reconciler) | Wann geprüft | Folge |
|---|---|---|---|---|---|
| SD-01 | **Stale Base** | Enthält der Run-Head den aktuellen `main`? | `isAncestor(mainHead, runHead)` | jedes `push` auf `main`, vor Merge | `STALE` → §5 |
| SD-02 | **Stale Contract** (P-B) | Läuft der Run noch auf der aktuellen Revision? | `run.contentHash == currentContract(task).contentHash` | bei jedem `contract_registered`, vor Merge | V0.1: kann nicht entstehen (Sperre). Altfall: `SUPERSEDED` |
| SD-03 | **Stale Dependency** (P-E) | Ist jede Dependency als gemergter Task in `main` und unverändert? | Für jede Dependency `d`: `mergeCommit(d) ⊑ mainHead`, keine neuere Revision von `d` seit Bs Approval, kein Revert | Start-Gate; bei jedem Merge eines Tasks, der Dependency ist | vor Start: Gate blockiert; während Run: NH |
| SD-04 | **Stale Context** (P-C) | Hat der Agent den Stand gelesen, den Forge ihm gegeben hat? | Run-Manifest enthält `{logSeq, mainSha, contractHash, startSha}`; Agent muss im PR-Body eine **tool-berechnete** Read-Receipt mit denselben Werten liefern (Deep Audit §10, Exit-Kriterium 3); Vergleich beim Submit | Submit | `RECEIPT_MISMATCH` → Submit abgelehnt |
| SD-05 | **Stale Status-Aussage** (P-C) | Steht irgendwo ein Status, der nicht aus dem Log kommt? | Lint im Spec-PR-Gate: Contract-Frontmatter darf kein `status`-Feld enthalten; Koordinationsdateien sind keine Statusquelle | Spec-PR | Spec-PR rot |
| SD-06 | **Stale Start** | Ist der Run vom richtigen Commit losgelaufen? | `startSha ⊑ runHead` und Merge-Base(runHead, main) ⊒ `startSha` | jeder `ref_head_observed` | `WRONG_BASE` |
| SD-07 | **Nicht integrierte Arbeit** (P-D) | Gibt es Commits, die weder in `main` noch in einem aktiven Run sind? | Alle Refs außer `main` und aktiven `forge/run/*`: `commits(ref) \ commits(main)` ≠ ∅ | Schedule (täglich reicht) | Liste in `forge status` (informativ, kein NH). Heute: vier Branches mit nicht integrierter Arbeit |
| SD-08 | **Stale Verification** | Gilt die Evidence für den aktuellen Head? | `evidence.sha == pr.head.sha` und `evidence.policyVersion == current` | vor Merge | Re-Verify |
| SD-09 | **Stale Review** | Gilt das Review für den aktuellen Head? | `review.commit_id == verifiedSha` oder Tree-Regel §5.3 | vor Merge | Re-Review oder nur Auflösungs-Review |
| SD-10 | **Stale Lease** | Arbeitet der Run noch? | §7 | Schedule + jedes Event | `EXPIRED` |
| SD-11 | **Stale Log** | Ist der Reconciler aktuell? | Alter des letzten Log-Appends vs. jüngstes GitHub-Event | `forge status` | Anzeige, NH erst ab Schwelle (F-24) |

**Grundsatz:** Staleness ist immer ein Vergleich zweier SHAs oder Hashes, nie ein Vergleich von Zeitstempeln (Ausnahme: SD-10, SD-11). Damit ist sie deterministisch und replaybar.

**Regel gegen P-C, ausdrücklich:** Ein Agent, der wissen will, ob TASK-X Draft, approved oder implementiert ist, fragt `forge status TASK-X`. Die Antwort ist abgeleitet aus Log + Git und nennt die Belege (Contract-Hash, Approval-Review-ID, Merge-Commit). Was in Markdown-Dateien, Chats oder Koordinationsnotizen steht, ist Kontext, nie Status. Konsequenz für Altbestände: `forge/contracts/TASK-0004.md` (`status: approved` bei ausstehendem Review) und `TASK-0005.md` (`status: review_ready`, während das Approval auf einem anderen Branch liegt) sind genau die Art Dokument, die diesen Fehler erzeugt.

---

## 7. Lease/Heartbeat Decision

### 7.1 Entscheidung

**Ja zu einer Lease, nein zu einem Heartbeat-Dienst.** Begründung:

- Ohne Lease bleibt jeder tote Worker für immer `implementing` (L-01, SM-13). Das blockiert den Task und (mit Scope-Lease) alle überlappenden Tasks. Ein Owner-Eingriff je totem Worker widerspricht dem Exit-Kriterium „höchstens vier Owner-Aktionen pro Task“.
- Ein separater Heartbeat (Agent ruft alle N Sekunden eine API) braucht einen Endpunkt, Authentifizierung und einen Prozess beim Agenten. Claude Code und Codex können heute zuverlässig nur eines nach außen: **pushen**. Also ist der Push der Heartbeat.
- Distributed Locks (etcd, Redis, Zookeeper, K8s-Leases) lösen ein Problem, das Forge nicht hat: sub-sekündliche Exklusivität vieler Prozesse. Forge hat ≤ 3 Runs, Minuten- bis Stundengranularität, einen Schreiber.

### 7.2 Minimale Semantik

| Element | Regel |
|---|---|
| Besitzer | Die Lease gehört dem **Run**, nicht dem Agenten. Ein Agent mit zwei Runs hat zwei Leases |
| Vergabe | Bei `run_started`: `leaseUntil = observedAt + TTL`. `TTL` aus `forge/policy.json` (Vorschlag **3 h**) |
| Erneuerung | Jeder vom Reconciler beobachtete neue Head auf dem Run-Ref: `leaseUntil = max(leaseUntil, observedAt + TTL)`. Optional zusätzlich ein Owner- oder Developer-Kommando `/forge extend` als PR-Kommentar (authentifizierter Login), höchstens einmal je TTL |
| Obergrenze | `startedAt + leaseCap` (Vorschlag **12 h**). Danach kein Ablauf, sondern `NEEDS_HUMAN(RUN_OVERLONG)`: ein Run, der so lange braucht, ist ein Scope- oder Agent-Problem |
| Ablauf | Nur durch den Reconciler, nur wenn eine **erfolgreiche** Beobachtung mit `observedAt > leaseUntil` keinen neuen Head zeigt (I-3). Ein GitHub-Ausfall verlängert also implizit |
| Uhr | Ausschließlich die Zeit des Reconciler-Workflows. Agent-Zeitstempel und Commit-Daten werden nie benutzt (Commit-Datum ist vom Autor frei setzbar) |
| Wirkung des Ablaufs | `run_expired` (terminal). Scope-Lease frei. Task wieder startbar. Ref bleibt (für Salvage/Audit), wird aber nie gemergt |
| Fencing | Über den Namensraum: neuer Attempt = neue `runId` = neuer Ref. Ein zurückkehrender Worker schreibt in seinen toten Ref (F-19). Zusätzlich: Merge nur per CAS auf den verifizierten SHA des **aktiven** Runs. Keine Tokens an Agenten |
| Gilt für | Nur Phase `STARTED` (und `STALE` mit RECONCILE-dev, dann mit neuer TTL). Verifier und Review haben Fristen (`T_verify_start` 30 min, `T_verify_run` = Job-Timeout, `T_review` z. B. 48 h → nur Erinnerung/NH, kein Ablauf) |
| Scope-Lease | Gleiche Lebensdauer wie die Run-Lease. Gehalten von `REQUESTED` bis terminal oder `MERGED` |
| Kern | Unverändert zeitlos. Neu nur: Event `run_expired` mit Rolle `system` (heute `run_abandoned(WORKER_LOST)` nur durch Owner) |

### 7.3 Warum 3 h und Push-als-Heartbeat genügen

- Die Pilotdaten (GIT) zeigen Implementierungsläufe im Bereich von Minuten bis wenigen Stunden (TASK-0004: 14 min 53 s zwischen Contract und Implementierung; 0001B v2: ca. 1 h zwischen Spec `1c79692` und Implementierung `811ed0d`). 3 h TTL ist großzügig; ein zu früher Ablauf kostet nur einen neuen Attempt, ein zu später nur Wartezeit.
- Agenten-Protokoll (Teil des Run-Manifests): „Pushe mindestens jede Stunde einen WIP-Commit auf `forge/run/<runId>`.“ Das ist gleichzeitig Heartbeat, Schutz vor F-02/F-03 und Fortschrittsanzeige für Seb.
- Fehlalarm-Kosten sind klein, weil Ablauf nichts löscht: der Ref bleibt, Salvage ist möglich.

---

## 8. NEEDS_HUMAN Rules

### 8.1 Grundsätze

1. **NH ist für Entscheidungen, nicht für Störungen.** Infrastruktur (GitHub down, Verifier flaky, Duplikat, Restart) wird automatisch behandelt, bis ein Budget erschöpft ist. Erst das erschöpfte Budget ist eine Entscheidung („weitermachen oder aufgeben?“).
2. **NH hat immer einen Code, ein Objekt (Run/Task) und die Optionen.** Seb soll am Handy mit einer Antwort entscheiden können.
3. **NH löst sich nie selbst auf.** Auch wenn die Ursache verschwindet (Branch wieder da), bleibt das Overlay, bis `human_resolved` kommt. Grund: ein NH wegen `HISTORY_REWRITTEN` darf nicht dadurch verschwinden, dass jemand den alten Head zurückschreibt.
4. **NH blockiert nur den betroffenen Run/Task.** Ausnahme: globale Codes (`MAIN_REWRITTEN`, `PROTECTION_BYPASSED`) setzen `FORGE_HALT`.
5. **Default bei Schweigen: nichts passiert.** Keine Eskalationstimer, die selbst entscheiden.

### 8.2 Katalog

| Code | Auslöser | Objekt | Optionen für Seb | Blockiert |
|---|---|---|---|---|
| `RETRY_BUDGET_EXHAUSTED` | 2 Attempts einer Task-Revision `EXPIRED`/`FAILED` (technisch) | Task | neuer Attempt (anderer Agent?) / Task zurückziehen / Scope verkleinern (neue Version) | Starts dieses Tasks |
| `AGENT_CANNOT_PUSH` | 2 Abläufe ohne einen einzigen Push desselben Agenten | Agent | Rechte prüfen / Agent für Forge deaktivieren | Starts für diesen Agenten |
| `FOREIGN_WRITE_ON_RUN_REF` | non-ff auf Run-Ref; Commit von fremder Identität | Run | Run abbrechen und neu starten / fremden Commit akzeptieren (Run läuft weiter) | Run |
| `HISTORY_REWRITTEN` | Force-Push auf Run-Ref | Run | Run abbrechen / Owner bestätigt eigenen Force-Push | Run |
| `MAIN_REWRITTEN` | `main` nicht Nachfahre des letzten beobachteten `main` | global | Owner prüft, setzt Log-Anker neu | **alles** (`FORGE_HALT`) |
| `PROTECTION_BYPASSED` | Löschung/Force-Push durch Identität, die das laut Ruleset nicht darf | global | Ruleset reparieren | **alles** |
| `VERIFIER_UNAVAILABLE` | 2 Verifier-Versuche ohne Evidence | Run | erneut versuchen / Workflow reparieren | Run |
| `REVIEW_OVERDUE` | kein Review nach `T_review` | Run | Reviewer neu zuweisen / warten | nichts (informativ) |
| `CONTRACT_CHANGE_DURING_RUN` | Spec-PR für Task mit aktivem Run | Task | Run abbrechen und Spec mergen / Spec-PR zurückstellen | Spec-PR |
| `DEPENDENCY_CHANGED` | Dependency neu revidiert oder revertiert, während abhängiger Run aktiv oder approved | Task | Contract bleibt gültig (Architekt bestätigt) / neue Contract-Version | Merge des abhängigen Runs |
| `SEMANTIC_CONFLICT` | Re-Verify nach Merge rot und Reparatur außerhalb Scope; oder Konfliktauflösung ändert As Verhalten | Run | Scope-Erweiterung (neue Contract-Version) / Run abbrechen / A anpassen (neuer Task) | Run |
| `MIGRATION_CONFLICT` | zwei Migrationen auf dieselbe Tabelle | Run | Reihenfolge festlegen | Run |
| `NO_REGENERATE_COMMAND` | generierte Datei kollidiert, kein Kommando in Policy | Run | Kommando in Policy ergänzen | Run |
| `RUN_OVERLONG` | Lease-Obergrenze erreicht trotz Fortschritt | Run | verlängern / abbrechen | Run |
| `RUN_REF_CONFLICT` | Run-Ref existiert schon auf anderem SHA | Run | Ref prüfen | Run |
| `IDEMPOTENCY_CONFLICT` | gleicher Schlüssel, anderer Inhalt | Event-Quelle | prüfen (Hinweis auf Fehler oder Manipulation) | betroffenes Objekt |
| `RECONCILER_STALLED` | Log-Head älter als Schwelle bei neueren GitHub-Events | global | Workflow prüfen | nichts (Anzeige) |
| `LATE_RESULT_AVAILABLE` | Push auf terminalen Run, während Task nicht gemergt ist | Task | ignorieren / Salvage als neuer Attempt | nichts (informativ) |

**18 Codes, davon 3 informativ, 2 global.** Mehr sollte V0.1 nicht haben. Jeder Code ist durch einen Fall in §2 oder §5 begründet.

### 8.3 Darstellung

`forge status` (und die Benachrichtigung) zeigt je NH: Code, Objekt, ein Satz Ursache mit SHA-Beleg, Optionen als Befehle (`/forge resolve <code> <option>` als PR-/Issue-Kommentar oder Workflow-Dispatch). Das passt zu Deep Audit §11 (GitHub mobil statt PWA).

---

## 9. Minimal V0.1 Requirements

Ergänzt Deep Audit §18 (Tasks 3, 8, 9, 10). Jede Anforderung nennt den Fall, der sie begründet.

### 9.1 Kern (`src/forge`, klein, rein)

| # | Anforderung | Begründet durch |
|---|---|---|
| K-1 | Rolle `system` (nur Workflow-Identität) mit Events `run_expired`, `ref_head_observed`, `run_submitted`, `verification_requested`, `late_result_observed`, `run_merged` | L-01..L-05, F-01, F-05, F-08, F-19 |
| K-2 | `run_cancelled` (owner) ersetzt `run_abandoned(OWNER_CANCELLED)`; `run_failed` erhält Codes `RESULT_LOST`, `HISTORY_REWRITTEN`, `WRONG_BASE`, `STALE_BASE` und Rolle `system` | F-06, F-07, F-15, F-23 |
| K-3 | `contract_registered` abgelehnt bei aktivem Run (`RUN_ACTIVE`) | L-06, F-17, P-B |
| K-4 | Beobachtungen auch vor Report und nach Verifikation zulässig (als `ref_head_observed`), damit Drift, Löschung, Force-Push aufzeichenbar sind | L-03, L-04, F-05..F-07, F-21 |
| K-5 | Verifikationsversuche `(sha, attempt)` als Zustand; Evidence muss `attempt` und `sha` tragen | L-05, F-08, F-09 |
| K-6 | Abgeleitetes Overlay `needsHuman(runId|taskId) → code[]` und Event `human_resolved` (owner) | L-12, §8 |
| K-7 | Duplikat-Erkennung über `eventId` *vor* `applyEvent` (im Appender, nicht im Kern) | L-07, F-13, F-14 |

### 9.2 Reconciler (`forge reconcile`, Node-CLI, nur in Workflows)

| # | Anforderung | Begründet durch |
|---|---|---|
| R-1 | Reine Funktion `reconcile(log, gitSnapshot, now, policy) → {events, gitActions}` mit Unit-Tests für **jeden** Fall F-01..F-24 | §2, Invariante I-5 |
| R-2 | Git-Snapshot nur aus GitHub-API/`git ls-remote`, nie aus Agentenangaben | §2.3 Punkt 2 |
| R-3 | Workflow mit `concurrency`-Gruppe, Triggern aus §3.1 und 15-min-Schedule | F-12, F-13, F-24 |
| R-4 | Log-Append als Fast-Forward-Push mit `seq`, `eventId`, `prevHash`, `cause`, `observedAt` | §4.4, Deep Audit §5.4 |
| R-5 | Lease nach §7 (TTL, Erneuerung durch Push, Obergrenze, Ablauf nur nach erfolgreicher Beobachtung) | F-01..F-03, F-11 |
| R-6 | Alle Git-Schreibaktionen idempotent bzw. CAS (§4.2): Ref-Anlage, Update-Branch mit `expected_head_sha`, Merge mit `sha` | F-04, F-06, F-14, §5 |
| R-7 | Stale-Detektoren SD-01..SD-09 | §6 |
| R-8 | Parallel-Klassifikation §5.5 inkl. `merge-tree`-Tree-Regel für Re-Review | §5 |
| R-9 | Retry-Budgets aus Log gezählt: 2 Attempts je Revision, 2 Verifier-Versuche je SHA | F-01, F-08, F-09 |

### 9.3 GitHub-Konfiguration

| # | Anforderung | Begründet durch |
|---|---|---|
| G-1 | Ruleset `main`: nur PR, kein Force-Push, kein Löschen, „up to date before merge“, Required Check = Forge-Verifier (Quelle GitHub Actions) | F-07b, §5.1 |
| G-2 | Ruleset `forge/run/**`: kein Force-Push, kein Löschen für Agenten-Identitäten; Anlegen nur durch Workflow | F-06, F-07, F-22 |
| G-3 | Eigene GitHub-Identität je Agent (Codex nicht unter Seb) | F-04b, F-22; Deep Audit Befund 2 |

### 9.4 Policy und Protokoll

| # | Anforderung | Begründet durch |
|---|---|---|
| P-1 | `forge/policy.json`: `leaseTtl`, `leaseCap`, `maxActiveRuns`, `maxActiveRunsPerAgent`, Pfadklassen `shared`, `protected`, `generated`, `migrations` mit Regenerier-Kommandos, `staleMergeLimit` | §5, §7 |
| P-2 | Scope-Lease im Start-Gate (`SCOPE_LEASE_CONFLICT`) über alle aktiven Runs; serielle Spur für `shared` | PT-10 |
| P-3 | Run-Manifest mit `{runId, ref, startSha, mainSha, logSeq, contractHash, leaseUntil}`; Read-Receipt im PR-Body, tool-berechnet | SD-04, P-C |
| P-4 | Kein `status`-Feld in Contract-Dokumenten (Spec-PR-Lint) | SD-05, P-C |
| P-5 | **Agenten-Protokoll** (Teil jedes Manifests, 6 Regeln): (1) Vor Arbeit `git fetch` und `forge status <runId>`; bei nicht `STARTED` stoppen. (2) Nur auf `forge/run/<runId>` pushen, nie auf andere Refs. (3) Mindestens stündlich WIP pushen. (4) Nie `--force`. (5) Push-Ergebnis unklar → `git ls-remote` prüfen, dann gleichen Push wiederholen. (6) non-ff → stoppen und melden | F-02..F-04b, F-15, F-22 |
| P-6 | Dependencies = „Merge-Commit in `main`“; Base nur aus `main` (Deep Audit C-08). Trennung Contract-Base/Run-Base nach Entscheidung Seb (§5.6 Punkt 5) | SD-03, P-E, L-10 |

### 9.5 Abnahme (Recovery-Drills, ergänzt Deep Audit Exit-Kriterium 9)

V0.1-Recovery gilt als fertig, wenn diese Drills gegen die echte Pipeline (nicht nur Unit-Tests) einmal gelaufen sind und der Log das erwartete Ergebnis zeigt:

1. F-01 Agent startet, pusht nie → `run_expired` nach TTL, Task startbar, Attempt 2 mit neuem Ref.
2. F-05 Agent pusht und öffnet PR, kein Report → Run wird `SUBMITTED` und verifiziert.
3. F-14 Start-Dispatch zweimal gleichzeitig → genau ein `run_started`.
4. F-16 Cancel, danach Push → `late_result_observed`, PR geschlossen, kein Merge möglich.
5. F-19 Attempt 1 läuft ab, Attempt 2 startet, Attempt 1 pusht → Attempt 2 unberührt.
6. F-09 Verifier-Job abgebrochen → genau ein Retry, beim zweiten Abbruch NH.
7. §5 PT-01: zwei Runs mit getrennten Dateien, A merged → B wird automatisch reconciled und re-verifiziert, Merge ohne Re-Review.
8. §5 PT-10: zweiter Run mit überlappendem Scope → Start abgelehnt.
9. F-17: Spec-PR für Task mit aktivem Run → blockiert mit NH.
10. F-11-Simulation: Reconciler-Lauf mit API-Fehlern über `leaseUntil` hinweg → kein Ablauf.

---

## 10. Dinge, die wir noch NICHT bauen sollten

| # | Nicht bauen | Warum nicht (Bedarf nicht nachgewiesen) | Wann überdenken |
|---|---|---|---|
| 1 | **Distributed Locks** (etcd, Redis-Redlock, Zookeeper, K8s-Lease-Objekte) | Ein Schreiber (Actions-Concurrency) plus Fast-Forward-Push ist ein korrekter CAS für ≤ 3 Runs. Locks bringen Clock-Skew-, Fencing- und Betriebsprobleme | mehrere Repos mit gemeinsamem Log oder > 10 parallele Runs |
| 2 | **Heartbeat-Endpunkt / Agent-Daemon** | Push ist der Heartbeat; Agenten können nichts anderes zuverlässig | ein Agent-Typ, der lange ohne Commits arbeiten muss (bisher keiner) |
| 3 | **Kubernetes, eigener Agent-Runner, Prozesskontrolle** („Kill“ beendet den Agenten wirklich) | Forge betreibt keine Agenten (Deep Audit §17). Cancel wirkt über Fencing; ein weiterlaufender Zombie kann nichts mergen | wenn Forge selbst Agenten startet und bezahlt |
| 4 | **Queue / Scheduler / Priorisierung** | GitHub-Events sind die Queue, Reconciler ist der Scheduler, „wer zuerst merged“ ist die Priorität | wenn Seb regelmäßig mehr Runs will als `maxActiveRuns` |
| 5 | **GitHub Merge Queue** | Bei 2–3 Runs ist manuelles Reconcile billiger als Merge-Queue-Konfiguration und deren Sonderfälle (Merge-Group-Refs sind nicht im Push-Event-Modell, siehe Systemhinweis zu Merge-Queue-Branches) | > 3 gleichzeitige approved Runs |
| 6 | **Automatische Konfliktlösung durch ein LLM** | Konfliktauflösung ist Codearbeit und braucht Review; ein Auto-Resolver wäre ein ungeprüfter Developer | nie ohne eigenen Run |
| 7 | **Auto-Salvage verwaister Ergebnisse** | Ein später Commit wurde nie gegen den Contract-Kontext des neuen Attempts geprüft; Salvage ist eine Owner-Entscheidung | wenn Abläufe mit wertvollem Ergebnis häufig werden |
| 8 | **Automatisches Contract-Rebase** (neue Contract-Version mit neuer Base erzeugen) | Contract-Änderung ist eine Spezifikationsentscheidung (P-B, P-03). Stattdessen Contract-Base von Run-Base trennen (§5.6) | – |
| 9 | **Saga-/Kompensations-Framework, Exactly-once-Delivery** | Idempotente Schlüssel + Reconcile-from-scratch sind einfacher und decken alle 24 Fälle | – |
| 10 | **Snapshot- oder Zustandsdatenbank** (Postgres für Run-Zustand) | Zustand ist abgeleitet; Replay < 1 s bei Pilotgrößen. Gespeicherte Projektionen erzeugen genau die Staleness, die §6 bekämpft (RT-10) | > 10 k Events (Deep Audit L-11) |
| 11 | **Migrations-Framework und Generator-Pipeline** | Es gibt weder Migrationen noch generierte Dateien im Repo. Die Regeln PT-08/PT-09 reichen als Platzhalter in der Policy | erster Task mit Persistenz/Codegen |
| 12 | **Textueller Lockfile-/`package.json`-Merge-Treiber** | Lockfile wird regeneriert, `package.json` ist serielle Spur | – |
| 13 | **Sub-Minuten-Leases, Lease-Tuning, adaptive TTL** | Fehlalarme kosten nur einen Attempt; Pilot-Laufzeiten sind Stunden | wenn Abläufe nachweislich echte Arbeit abbrechen |
| 14 | **Feingranulare Pfad-Locks auf Zeilen- oder Symbolebene** | Scope-Lease auf Dateiebene reicht; Semantik findet der Verifier auf dem Merge-Head | – |
| 15 | **Eigene Recovery-UI** | `forge status` + NH-Kommandos über GitHub mobil (Deep Audit §11) | wenn ein konkreter Schritt am Handy nicht geht |

---

## Anhang A: Abbildung der Pilot-Vorfälle

| Vorfall | Was V0.1 daraus macht | Mechanismen |
|---|---|---|
| P-A Lokaler Commit, Push scheitert | Für Forge existiert der Commit nicht. Lease läuft ab, Attempt 2. Agent-Protokoll verhindert, dass Arbeit lange nur lokal liegt | F-03, F-04, §7, P-5 |
| P-B Contract parallel weiterentwickelt | Nicht mehr möglich während eines Runs; auf Spec-Ebene schon heute durch `CONTRACT_VERSION_NOT_NEXT` | K-3, F-17, §5.6 Punkt 4 |
| P-C TASK-0004 für Draft gehalten | Status kommt nur aus `forge status`; Read-Receipt beim Submit | SD-04, SD-05, P-3, P-4 |
| P-D Branches mit unterschiedlichen Ständen | `main` ist der einzige Projektstand; nicht integrierte Arbeit wird gelistet | §5.6 Punkt 1, SD-07 |
| P-E Veraltete Dependency-SHAs | Dependency = „in `main` gemergt“; Base aus `main`; Änderung einer Dependency → NH | SD-03, P-6, PT-07, PT-13 |

## Anhang B: Entscheidungen, die Seb treffen muss

1. **Contract-Base von Run-Base trennen?** (§5.6 Punkt 5). Empfehlung: ja. Ohne diese Trennung ist jeder RECONCILE formal eine neue Contract-Version mit neuem Review.
2. **Lease-Werte**: TTL 3 h, Obergrenze 12 h, 2 Attempts je Revision, 2 Verifier-Versuche je SHA. Empfehlung: so starten, nach den ersten echten Runs anpassen.
3. **`maxActiveRunsPerAgent = 1`?** Empfehlung: ja, solange Codex auf einem einzigen Windows-Checkout arbeitet.
4. **Status-Felder aus bestehenden Contracts entfernen** (betrifft TASK-0004, TASK-0005) bei der kernkonformen Migration (Deep Audit Roadmap Task 5).

## Anhang C: Abgrenzung

- Nicht wiederholt: Bedrohungsmodell, Evidence-Härtung, Identitäten, Verifier-Isolation (Deep Audit §6, §7, §17.4) und Red-Team-Angriffe (paralleler Bericht `FORGE-DEEP-RED-TEAM.md`).
- Neu gegenüber Deep Audit §12 (FR-01..FR-15): Trennung persistiert/beobachtbar je Fall; F-04b/c, F-09-Unterscheidung Infra/Test, F-11 Lease-Uhr bei Ausfall, F-16 „Cancel gewinnt“, F-17 Sperre statt Toleranz, F-18 Stale Dependency, F-19..F-24; Reconciler als reine Funktion; vollständige Zustandsmaschine; Idempotenzschlüssel je Operation; Parallel-Klassifikation je Dateiart mit Entscheidungsverfahren und Re-Review-Regel; NH-Katalog.
- Keine eigenen Experimente in diesem Bericht; alle Kernaussagen zu `b9339d2` sind CODE (Zeilenangaben) oder verweisen auf Deep-Audit-Experimente (E-16, E-21, RT-07).
