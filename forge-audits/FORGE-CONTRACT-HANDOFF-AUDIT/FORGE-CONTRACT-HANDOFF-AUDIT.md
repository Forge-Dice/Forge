# FORGE CONTRACT HANDOFF AUDIT

Rolle: FORGE CONTRACT HANDOFF AUDITOR (rein lesend). Datum: 2026-10-03.
Keine Dateien im Repository geändert, keine Commits, keine PRs.

**Geprüfte Stände**

| Gegenstand | Ref / SHA |
|---|---|
| Forge-Core v2-Repair (maßgeblich) | `codex/forge-core-v2-repair` @ `b9339d2` (Impl `811ed0d`, A-PATCH-0001 `4cbbb25`) |
| Forge-Core ursprünglich | `claude/forge-architecture-review-hjdq89` @ `be40a68` (0001A `8cae4cc`, 0001B `8230f1d`) |
| TASK-0004-Contract | Commit `6a8c0c5349eccaf12f45e3e9128b816f316d37a6`, Pfad `forge/contracts/TASK-0004.md`, Git-Blob `334fe6fea10967fc06d23034d8743d92f389e67c`, 604 Zeilen, 38 629 Bytes |
| TASK-0004-Implementierung | `e9cb8e23c765deee5fab2d16bc0b793f53708714` (Parent = `6a8c0c5`), M1-Testfix `1de7efe` auf `codex/mystery-task-0005` |
| Eigene Verifikation | Repair-Branch frisch: `vitest run tests/forge tests/forge-red-team` → 15 Dateien, 635 Tests grün; `tsc --noEmit` ok |

Gelesen wurden vollständig: `src/forge/*.ts` (alle 12 Dateien), `tests/forge/dogfood.test.ts`, der TASK-0004-Contract, Kopf des TASK-0005-Contracts, die Approval-JSONs, Red-Team-Bericht (Befundtabelle), `forge/coordination/{CLAUDE,CODEX}.md`, FORGE-CORE-0001A §18 (Non-Goals).

---

## 1. Aktueller Stand

**Forge-Core ist ein reiner, zustandsloser Prüfkern, kein Laufzeitsystem.** `createForgeKernel` (`src/forge/kernel.ts`) bekommt Events als Input und berechnet daraus Zustände. Es gibt:

- keinen persistierten ForgeLog (0001A §18 Non-Goal: „Log-Persistenz“; `state.ts`-Kommentar: „ForgeLog is authoritative“, aber nirgends gespeichert),
- keinen Git-Adapter: Kein Produktionscode liest Commits, Blobs oder Refs. Alle Repo-Fakten (`repoObservation`, `changedFiles`, `remote_observed`) sind **vom Aufrufer gelieferte „witnessed observations“**,
- keine CLI, keinen Prozess, der Events erzeugt. Einziger Konsument echter Repo-Dateien ist der Test `tests/forge/dogfood.test.ts`,
- keine Authentifizierung: Identität und Rolle jedes Events sind selbst erklärt (RT-05).

**Der TASK-0004-Contract ist für den Kern kein gültiger Contract.** Er hat YAML-Frontmatter (`---` … `task:` …), der Kern verlangt kanonisches JSON hinter `---json`. `dogfood.test.ts` fixiert das ausdrücklich: „the pilot TASK-0004 contract (YAML with status fields) is not a valid Forge contract“ → `FRONTMATTER_MISSING`.

**Der TASK-0004-Contract behauptet seinen Freigabestatus selbst und widersprüchlich:** `status: approved` und gleichzeitig `architecture_review: pending_chatgpt_final_check`, verfasst von `spec_author: codex`. Der Kern-Entwurf hat genau das absichtlich ausgeschlossen (CLAUDE.md CP1: „contracts carry no status; approval is an external hash-bound record“). Unter `forge/approvals/` existiert kein Record für TASK-0004.

**TASK-0004 ist bereits implementiert.** `e9cb8e2` (Autor Claude, 6 neue Dateien, exakt der Scope aus §2) hat `6a8c0c5` als Parent; M1 `1de7efe` folgt. TASK-0005 v2 baut ausdrücklich auf `1de7efe` auf, und `e9cb8e2` ist auch Vorfahre des Claude-Forge-Core-Branches. Der im Auftrag beschriebene Ablauf („Codex erstellt forge/contracts/TASK-0004.md, danach bekommt Developer-Claude nur …“) ist für TASK-0004 also bereits Geschichte. Positiv: Derselbe Blob `334fe6fe…` liegt auf allen vier Branches; eine zweite, abweichende Fassung im Repo habe ich nicht gefunden.

## 2. Was bereits funktioniert

Gilt **nur, wenn** Events tatsächlich in den Kern eingespeist werden und die Beobachtungen wahr sind (Repair-Branch):

| Mechanismus | Code | Wirkung |
|---|---|---|
| Content-Hash über exakten Text | `contract-document.ts` `parseContractDocument`: `sha256("forge-contract-v1\n" + text)` | Jede Byte-Änderung (inkl. Abschneiden) ergibt eine andere Revision. BOM, CR, Lone Surrogates, nicht-kanonisches JSON werden abgelehnt. |
| Metadaten nur aus dem Text | `ContractMetadataSchema` | `taskId`, `contractVersion`, `baseCommit`, `dependencies`, `scope`, `requiredChecks`, `mutationSmoke` sind strikt, Contract-Datei darf nie im eigenen Scope stehen. |
| Registrierung | `state.ts` `contract_registered` | `CONTRACT_HASH_MISMATCH`, `CONTRACT_TASK_MISMATCH`, `CONTRACT_PATH_MISMATCH` (Pfad muss `forge/contracts/<taskId>.md` sein), `CONTRACT_VERSION_NOT_NEXT` (lückenlos aufsteigend, kein Duplikat). |
| Approval hash-gebunden | `approval_recorded` | Bindet an `contentHash`, nur aktuelle Revision, unabhängiger Reviewer, `changes_requested` braucht Findings, **approved + blocking Finding → `VERDICT_INCONSISTENT`** (A-PATCH-0001, nur Repair-Branch). |
| Dependency-Bindung | `approval_recorded` | Approval verlangt pro Dependency `acceptedCommit` == tatsächlich akzeptierter, verifizierter Commit (`DEPENDENCY_UNRESOLVED/NOT_ACCEPTED/MISMATCH`). |
| Start-Gate | `start-gate.ts` `canStartDeveloperRun` | Aktuell + approved; beobachtete Datei (Commit, Pfad, Hash) muss exakt der Registrierung entsprechen; Contract- und Base-Commit remote erreichbar; Base ist Vorfahre des Contract-Commits; Dependencies sind Vorfahren der Base. **`startFromCommit` = Contract-Commit**, nicht Base. |
| Run-Bindung | `run_started` | Run speichert `ContractRef {taskId, contractVersion, contentHash}` und Start-Beobachtung. Ein Run je Task gleichzeitig. |
| Remote-Persistenz | `remoteOutcome` | Ergebnis muss im beanspruchten Ref liegen und den Start-Commit als Vorfahr haben. |
| Verifikation gegen genau diesen Contract | `verification.ts` `evaluateVerification`, `verificationOf` | Holt Metadaten über `run.contract.contentHash`, prüft `requiredChecks` (Name + exakter Befehl + Exit 0, eindeutig), Scope pro Datei, Mutationen. `forge/contracts/` und `forge/approvals/` sind immer verboten, Löschungen immer verboten, Renames an beiden Enden geprüft (RT-01 behoben). |
| Review/Abnahme | `code_review_recorded`, `task_accepted` | Nur auf letztem verifizierten Run der aktuellen Revision, Abnahme nur durch `human`. |

Kurz: **Das Datenmodell für „Run ist an genau einen Contract-Blob gebunden und wird gegen genau diesen geprüft“ existiert bereits und ist gut getestet.** Es fehlt der Teil, der es mit der Wirklichkeit verbindet.

## 3. Fehlende Mechanismen

1. **Contract-Format-Brücke.** Der Pilot-Contract (YAML + Statusfelder) ist nicht kernkonform. Ohne kernkonformes `---json`-Frontmatter gibt es keinen Hash, keine Registrierung, keinen Scope.
2. **Git-Observer.** Niemand erzeugt `repoObservation.contractAtCommit`, `refs`, `parents` und `changedFiles` aus dem echten Repository. Heute ist jede Beobachtung eine Behauptung.
3. **Persistierter ForgeLog.** Ohne Log gibt es kein Approval-Event, keinen Run, keine Bindung. Die Approval-JSONs in `forge/approvals/` werden vom Kern nie gelesen (nur der Dogfood-Test prüft sie).
4. **Kein Abgleich `contractText` ↔ Git bei der Registrierung.** `contract_registered` nimmt `contractCommit` und `contractText` getrennt entgegen und prüft nicht, dass der Text der Blob an `contractCommit:contractPath` ist. Erst das Start-Gate vergleicht, und auch nur gegen eine gelieferte Beobachtung.
5. **Versionierungskonvention widerspricht dem Kern.** `contractPathFor` erzwingt immer `forge/contracts/<taskId>.md`. Im Repo liegt aber `FORGE-CORE-0001B.v2.md` als Sidecar; als Kern-Event wäre das `CONTRACT_PATH_MISMATCH` (CODEX.md bestätigt: „sidecar v2 is not automatically canonical kernel registration“). Für TASK-0004 muss entschieden werden: neue Version = gleicher Pfad, neuer Commit.
6. **Developer-seitiger Lesebeweis.** Nichts bindet den Text, den der Developer-Agent tatsächlich verarbeitet hat, an den Hash.
7. **Kein Handoff-Objekt.** Es gibt kein definiertes Format, das Forge an den Developer gibt; heute ist es Chat.
8. **Identitäten/Rollen selbst erklärt (RT-05).** Ein Developer kann technisch ein `approval_recorded` mit Reviewer-Identität schreiben.
9. **Dependencies der Mystery-Kette sind dem Kern unbekannt.** TASK-0001…0003 sind nie registriert oder akzeptiert. Ein TASK-0004-Contract mit Dependencies würde `DEPENDENCY_NOT_ACCEPTED` liefern. Praktikabel: `dependencies: []` und Bindung über `baseCommit`.
10. **Supersession während aktivem Run (RT-07)** und **spätere Remote-Rückwärtsbewegung (RT-09)** sind nicht abgedeckt.

## 4. 20-Fälle-Bedrohungsmatrix

Spalten: **Kern** = Verhalten von Forge-Core (Repair-Branch), *vorausgesetzt* die Events werden eingespeist und Beobachtungen sind wahr. **Heute (Pilot)** = was im tatsächlichen TASK-0004-Ablauf ohne Kern-Einsatz greift.
Legende: VERHINDERT (Event/Start abgelehnt), ERKANNT (nachträglich als Fehlschlag sichtbar), OFFEN (Trust Boundary oder nicht abgedeckt).

| # | Fall | Kern | Mechanismus / Lücke | Heute (Pilot) |
|---|---|---|---|---|
| 1 | Contract nach Approval verändert | VERHINDERT beim Start | Neuer Text = neuer Hash; Approval hängt an altem Hash. Neuer Text braucht neue Version + neues Approval; sonst `CONTRACT_FILE_MISMATCH`/`CONTRACT_NOT_APPROVED`. | OFFEN. `status: approved` steht *im* Text und wandert bei jeder Änderung mit. |
| 2 | Contract-Pfad zeigt auf falsche Datei | VERHINDERT | `CONTRACT_PATH_MISMATCH` bei Registrierung, `CONTRACT_FILE_MISMATCH` am Start-Gate. | OFFEN (Developer prüft manuell). |
| 3 | Contract gehört zu anderem Task | VERHINDERT | `CONTRACT_TASK_MISMATCH`; Start-Request sucht Hash nur innerhalb des Tasks → `CONTRACT_UNKNOWN`. | OFFEN (nur Frontmatter-Sichtprüfung). |
| 4 | Contract-Version veraltet | VERHINDERT beim Start | `CONTRACT_NOT_CURRENT`; Approval einer überholten Revision → `CONTRACT_SUPERSEDED`. **Lücke RT-07:** neue Version während laufendem Run → Run endet `verified` auf überholter Revision, Ergebnis still wirkungslos. | OFFEN. |
| 5 | Developer startet auf falschem Base-Commit | ERKANNT | Start ist fest `startFromCommit = contractCommit`. `remoteOutcome` verlangt Start-Commit als Vorfahr des Ergebnisses → Run bleibt `reported`, wird nie `remote_verified`. Fremde Commits dazwischen erscheinen im Diff → `SCOPE_VIOLATION`. Setzt ehrlichen Verifier-Diff voraus. | OFFEN. (Real für TASK-0004 korrekt: Parent von `e9cb8e2` ist `6a8c0c5`.) |
| 6 | Dependency nach Freigabe geändert | VERHINDERT | Dependency = unveränderlicher akzeptierter Commit; akzeptierte Tasks nehmen keine neuen Contracts an (`TASK_ALREADY_ACCEPTED`); `DEPENDENCY_NOT_IN_BASE` am Start. | TEILWEISE: `base_commit` pinnt implizit; Dependency-Tabelle ist Prosa. |
| 7 | Contract nur teilweise geladen | VERHINDERT im Kern / OFFEN beim Agenten | Hash deckt den ganzen Text; ein abgeschnittener Text ist eine andere (unregistrierte) Revision. Was der Agent im Kontext hatte, sieht der Kern nicht. | OFFEN; genau der Pilotfehler. |
| 8 | Contract-Hash stimmt nicht | VERHINDERT | `CONTRACT_HASH_MISMATCH`, `CONTRACT_FILE_MISMATCH`. | OFFEN (kein Hash im Handoff). |
| 9 | Branch enthält neueren unapproved Contract | VERHINDERT/ERKANNT | Start hängt an Hash + Contract-Commit, nicht am Branch-Head. Neue Version registriert → alte `CONTRACT_NOT_CURRENT`, neue `CONTRACT_NOT_APPROVED`. Startet der Developer trotzdem vom Head, landet die Contract-Änderung im Diff → `SCOPE_VIOLATION` (`forge/contracts/` immer verboten). | OFFEN. Beim Lesen vom Branch statt vom Commit liest der Developer, was gerade dort liegt. |
| 10 | Draft statt Approved implementiert | VERHINDERT | `CONTRACT_NOT_APPROVED`; Status ist abgeleitet, nie gespeichert. | **OFFEN, live:** TASK-0004 trägt `status: approved` bei `architecture_review: pending_chatgpt_final_check`, kein Approval-Record. Implementiert wurde trotzdem. |
| 11 | Approved mit Blocking-Findings | VERHINDERT (nur Repair) | `VERDICT_INCONSISTENT` (A-PATCH-0001, `4cbbb25`). Auf `claude/forge-architecture-review-hjdq89` noch möglich (RT-06). | OFFEN (keine strukturierten Findings). |
| 12 | Developer ändert Contract während Implementierung | ERKANNT | Autorität bleibt der registrierte Hash; Änderung unter `forge/contracts/` → `SCOPE_VIOLATION`. Pushen kann er trotzdem (keine Branch-Protection). | OFFEN. |
| 13 | Developer ändert Approval-Datei | ERKANNT im Run-Diff / OFFEN sonst | `forge/approvals/` immer verboten. Aber: Der Kern liest Approval-Dateien gar nicht; das echte Approval ist ein Event mit selbst erklärter Identität (RT-05). Ein gefälschtes Event ist nicht erkennbar. | OFFEN. Approval-JSON ist Prosa-Evidenz. |
| 14 | Contract wird umbenannt | VERHINDERT/ERKANNT | Im Run: beide Rename-Enden verletzen Scope (RT-01-Fix). Außerhalb: beobachteter Pfad ≠ registrierter → `CONTRACT_FILE_MISMATCH`. | OFFEN. |
| 15 | Contract wird gelöscht | ERKANNT (teilweise) | Im Run: Löschung immer verboten. Außerhalb: Bindung an Commit, nicht Head; Löschung auf dem Head ändert nichts, solange der Commit erreichbar ist. Unerreichbar (Force-Push) → `CONTRACT_NOT_PERSISTED`, aber nur am Start; danach nicht mehr geprüft (vgl. RT-09). | OFFEN. |
| 16 | Implementierung auf Commit ohne Contract | ERKANNT | Wie Fall 5: Ergebnis muss den Contract-Commit als Vorfahr haben; zusätzlich `BASE_NOT_IN_CONTRACT_HISTORY`. **Folgerung für den Prozess: Developer verzweigt vom `contract_commit`, nicht von `base_commit`.** | OFFEN. Das geplante Feld „expected base SHA“ lädt sogar zum falschen Start ein. |
| 17 | Zwei Contracts behaupten dieselbe Task-Version | VERHINDERT im Log | `CONTRACT_VERSION_NOT_NEXT`; der zuerst registrierte gewinnt. Zwei Dateien auf zwei Branches erkennt der Kern nicht, solange niemand die zweite registriert. | OFFEN. (Aktuell kein Live-Fall: ein Blob auf allen Branches.) |
| 18 | Chat-Prompt widerspricht Contract | ERKANNT (nur Scope/Checks) | Kern sieht keinen Chat. Zusätzliche Dateien → `SCOPE_VIOLATION`; andere Check-Befehle → `CHECK_FAILED`. Semantische Widersprüche (API-Namen, Verhalten) nur durch Code-Review. | OFFEN. |
| 19 | Agent behauptet, Contract gelesen zu haben, hat nur Ausschnitt verarbeitet | OFFEN (Trust Boundary) | Nicht beweisbar. Abgemildert, nicht gelöst: tool-berechneter Hash, End-Marker, Prüfung des Ergebnisses gegen den ganzen Contract (Abschnitt 6). | OFFEN. |
| 20 | Contract referenziert nicht persistierte Dependency-SHA | VERHINDERT zum Beobachtungszeitpunkt | Dependency-Commit = verifizierter, remote-beobachteter Commit; Start-Gate verlangt Base remote erreichbar und Dependency als Vorfahr der Base. Spätere Rückwärtsbewegung nicht aufzeichenbar (RT-09). | OFFEN (`5bfa5a4` ist faktisch remote erreichbar; geprüft hat das kein Mechanismus). |

**Querschnittsvorbehalt für die ganze Kern-Spalte:** Alle Repo-Fakten kommen als vom Aufrufer gelieferte Beobachtungen, Identitäten sind selbst erklärt (RT-05), `applyEvent` vertraut dem übergebenen Zustand (RT-10). „VERHINDERT“ heißt also: verhindert gegen Irrtum und Copy-Paste-Fehler, nicht gegen einen Akteur, der die Beobachtungen oder Events fälscht. Für das eigentliche Pilotproblem (Abschneiden, Doppelfassungen, Platzhalter, veraltete Stände) ist das ausreichend.

## 5. Minimaler Developer-Handoff

Prinzip: Der Handoff enthält **nur Identifikatoren, keine Semantik**. Alles Inhaltliche steht im Blob.

```
FORGE DEVELOPER HANDOFF v1
repository:      Wuerfelduell/Forge
run_id:          run:task-0004-1
contract_commit: <40-hex>
contract_blob:   <40-hex git blob sha von contract_commit:forge/contracts/TASK-0004.md>
content_hash:    <64-hex sha256("forge-contract-v1\n" + text)>
result_ref:      <branch, auf den gepusht wird>
```

Dazu ein fester, für alle Tasks identischer Boilerplate-Absatz (kein task-spezifischer Text):

```
1. git fetch; git checkout --detach <contract_commit>; git switch -c <result_ref>
2. Contract per Tool lesen, nicht aus dem Prompt:
   git cat-file -p <contract_commit>:forge/contracts/<task>.md
3. Prüfen und im Start-Bericht ausgeben (Werte vom Tool, nicht abgetippt):
   git rev-parse <contract_commit>:forge/contracts/<task>.md   == contract_blob
   sha256 von "forge-contract-v1\n"+Text                         == content_hash
   Frontmatter taskId/contractVersion/baseCommit; baseCommit ist Vorfahr von contract_commit
4. Bei jeder Abweichung: STOPP, nichts implementieren, Abweichung melden.
5. Nur metadata.scope ändern. Bei Widerspruch Prompt vs. Contract gilt der Contract.
```

**Welche Felder wirklich nötig sind**

| Feld | Nötig? | Begründung |
|---|---|---|
| `repository` | ja | Nicht ableitbar. |
| `contract_commit` | ja | Einziger Anker in die Historie; zugleich Startpunkt. |
| `contract_blob` *oder* `content_hash` | ja, mindestens einer | Integritätsanker. `contract_blob` prüft der Developer mit reinem `git`; `content_hash` ist der Kern-Schlüssel. Beides mitzugeben kostet nichts und deckt beide Seiten ab. |
| `run_id` | ja, sobald der Kern läuft | Bindet Bericht und Evidenz an den Run. |
| `result_ref` | ja | `remoteOutcome` prüft gegen genau diesen Ref. |
| `task` | ableitbar | Aus Frontmatter; als Kontrollwert harmlos, aber nicht autoritativ. |
| `contract_path` | ableitbar | Kern erzwingt `forge/contracts/<taskId>.md`. Weglassen nimmt Fall 2 die Angriffsfläche. |
| `contract_version`, `base_commit`, Scope, Checks, Dependencies | ableitbar | Stehen im Contract. **`base_commit` nicht als Startanweisung mitgeben**: gestartet wird vom `contract_commit` (Fall 16). Höchstens als Kontrollwert. |
| Contract-Text, Zusammenfassungen, Zusatzwünsche | **verboten** | Genau die Quelle von Fall 7, 18, 19. |

## 6. Contract-Read/Binding-Konzept

Ziel ist nicht zu beweisen, was im Modellkontext passiert ist, sondern dass (a) der richtige vollständige Blob das autoritative Input war, (b) der Run daran gebunden ist und (c) das Ergebnis gegen genau diesen Blob geprüft wird. (b) und (c) leistet der Kern bereits; es fehlt (a) plus ein paar Bindungsfelder.

**Drei einfache Bausteine, keine neue Kryptografie:**

1. **Tool-berechnete Read-Quittung im Start.** Der Developer-Agent gibt als ersten Schritt die *Ausgabe* von `git rev-parse <commit>:<pfad>`, `wc -l -c` und der SHA-256-Berechnung zurück, plus die Liste der `##`-Überschriften. Diese Werte stammen aus dem Werkzeug, nicht aus dem Gedächtnis des Modells; ein abgeschnittener oder anderer Text liefert andere Werte. Forge (oder Seb) vergleicht maschinell gegen `contract_blob`/`content_hash` und gegen die Überschriftenliste des registrierten Texts. Bei Abweichung kein `run_started`.
2. **End-Marker im Contract.** Letzte Zeile jedes Contracts: `<!-- END OF CONTRACT <taskId> v<N> -->`. Der Agent muss diese Zeile wörtlich in der Quittung zitieren. Das ist der billigste Schutz gegen Read-Tools mit Zeilen- oder Byte-Limit und gegen Chat-Abschneiden. Der Marker ist Teil des Hashes, also nicht nachträglich anhängbar.
3. **ContractRef überall mitführen.** `run_started` trägt bereits `contentHash`; der Kern schreibt `ContractRef` in den Run. Ergänzen sollte man nur: `DeveloperReport` nennt `contractCommit` + `contentHash` (heute fehlt das Feld; Abgleich gegen den Run wäre eine Zeile), und der Code-Reviewer bekommt denselben Handoff (Commit + Blob) statt eines Chat-Auszugs, sodass auch Review und Abnahme gegen denselben Blob laufen.

**Was das leistet und was nicht.** Fälle 7, 8, 9, 10, 16 werden damit vor dem ersten Code-Commit sichtbar. Fall 19 bleibt eine Trust Boundary: Ein Agent kann den Hash korrekt berechnen und trotzdem nur einen Teil beachten. Abgefangen wird das hinten heraus: Scope und Checks prüft der Kern mechanisch gegen den registrierten Contract, die übrigen Acceptance Criteria der Reviewer gegen denselben Blob. Mehr als das sollte man nicht behaupten.

## 7. Chat-vs-Contract-Priorität

**Regel:** Der registrierte und approbierte Contract-Blob ist die einzige Implementierungsgrundlage. Prompt-Anweisungen können ihn weder erweitern noch einschränken. Eine Scope-Änderung entsteht nur über eine neue Contract-Version → neues Approval → neuen Run.

**Wie das sicher umgesetzt wird:**

- **Strukturell, nicht per Appell:** Der Handoff enthält keine Semantik (Abschnitt 5). Was nicht im Prompt steht, kann ihm nicht widersprechen.
- **Mechanisch durchgesetzt existiert bereits:** Eine zusätzliche Datei X führt in `evaluateVerification` zu `SCOPE_VIOLATION`, der Run wird `failed`, Review und Abnahme sind unmöglich. Das ist Erkennung, keine Verhinderung, aber ausreichend, weil ein Run ohne `verified` wertlos ist.
- **Verhalten des Developers:** Widerspricht ein Prompt dem Contract, implementiert er nach Contract und trägt den Widerspruch in `DeveloperReport.deviations` ein. Er „löst“ den Konflikt nicht selbst durch Mehrarbeit.
- **Restlücken ehrlich benennen:**
  - `forge/coordination/**` ist immer erlaubt (RT-02): Ein Prompt könnte dort beliebige Dateien schreiben lassen, auch die Logdatei des anderen Agenten. Für Handoffs sollte die Ausnahme auf die eigene Datei verengt werden.
  - Semantische Widersprüche innerhalb des Scopes (anderer Funktionsname, anderes Verhalten) erkennt nur der Code-Review.
  - Eine neue Contract-Version während des Runs (RT-07) entwertet den Run still. Der Prozess sollte bei Supersession den laufenden Run explizit abbrechen (`run_abandoned OWNER_CANCELLED`).

## 8. Konkreter TASK-0004-Run

Vorbemerkung: TASK-0004 ist bereits implementiert (`e9cb8e2`, M1 `1de7efe`). Der folgende Ablauf zeigt, wie ein Run aussehen *müsste*; als Live-Test eignet er sich nur als Wiederholung oder als nachträgliche Bindung. Kein TASK-0004-Code wird hier implementiert.

**Schritt 0: Contract kernkonform machen (Spec-Author, neuer Commit `C1`).** Gleicher Pfad, YAML-Kopf ersetzt, Statusfelder entfernt, Text sonst unverändert, End-Marker angehängt:

```
---json
{
  "forgeContractFormat": 1,
  "taskId": "TASK-0004",
  "contractVersion": 1,
  "baseCommit": "5bfa5a47562282548cf7c916c2328f8e03fcc473",
  "dependencies": [],
  "scope": {
    "create": [
      "src/domain/npc-knowledge.ts",
      "src/domain/npc-knowledge.projection.ts",
      "tests/npc-knowledge.fixture.ts",
      "tests/npc-knowledge.test.ts",
      "tests/npc-knowledge.projection.test.ts",
      "tests/npc-knowledge.typecheck.ts"
    ],
    "modify": []
  },
  "requiredChecks": [
    { "name": "typecheck", "command": "npm run typecheck" },
    { "name": "test", "command": "npm test" }
  ],
  "mutationSmoke": "optional"
}
---

# TASK-0004 FINAL IMPLEMENTATION CONTRACT
…(unveränderter Text §1–§17)…
<!-- END OF CONTRACT TASK-0004 v1 -->
```

(JSON muss exakt `JSON.stringify(raw, null, 2)` entsprechen; die einzeiligen Check-Objekte oben sind nur zur Lesbarkeit gekürzt. `dependencies: []`, weil TASK-0001…0003 dem Kern unbekannt sind; die Bindung läuft über `baseCommit`. `modify: []` entspricht AC-01 „ausschließlich die sechs neuen Dateien“. Der dogfood-Test „TASK-0004 is not a valid Forge contract“ würde dann bewusst kippen und muss im selben Schritt angepasst werden.)

**Schritt 1: Log-Events (Forge/Seb).**

```
task_registered      owner          TASK-0004 "NPC Knowledge & Belief Model"
contract_registered  spec_author    path forge/contracts/TASK-0004.md, commit C1, text = Blob, declaredContentHash = H
approval_recorded    architecture_reviewer (≠ codex)  contentHash H, approved, findings ohne blocking
```

**Schritt 2: Start-Gate.** `canStartDeveloperRun({taskId, contentHash: H, repoObservation})` mit Beobachtung aus `git ls-remote` + `git rev-list --parents` + `git rev-parse C1:forge/contracts/TASK-0004.md`. Erwartet: `allowed: true, startFromCommit: C1`.

**Schritt 3: Handoff an Developer-Claude (vollständig):**

```
FORGE DEVELOPER HANDOFF v1
repository:      Wuerfelduell/Forge
run_id:          run:task-0004-1
contract_commit: C1
contract_blob:   <git rev-parse C1:forge/contracts/TASK-0004.md>
content_hash:    H
result_ref:      claude/task-0004-run-1
```

**Schritt 4: Read-Quittung des Developers (vor erstem Code-Commit).** Ausgabe von `rev-parse` (== Blob), SHA-256 (== H), `wc -l -c`, Überschriften `## 1.` … `## 17.`, wörtlich zitierter End-Marker, Frontmatter-Werte. Forge vergleicht; erst dann `run_started`.

**Schritt 5: Implementierung** auf `claude/task-0004-run-1`, verzweigt von C1, Push.

**Schritt 6: Bericht und Prüfung.** `developer_report_recorded` (inkl. `contractCommit` + `contentHash`, Abweichungen) → `remote_observed` (Ergebnis enthält C1) → `verification_recorded` (frischer Clone, `changedFiles` = Diff C1..Ergebnis, genau die sechs `added`-Dateien, beide Checks Exit 0) → `code_review_recorded` gegen denselben Blob → `task_accepted` durch Seb.

Retrospektive Probe: Für den vorhandenen Stand gilt bereits Parent(`e9cb8e2`) = `6a8c0c5` = Contract-Commit, und `e9cb8e2` enthält genau die sechs Scope-Dateien. Eine nachträgliche Bindung würde also mechanisch passen. Was fehlt, ist das Approval: Laut Contract selbst war der Architekturcheck bei der Implementierung noch offen.

## 9. BLOCKER vor Nutzung

1. **B1 – Kernkonformes Contract-Format.** Neue Contracts mit `---json`-Frontmatter nach `ContractMetadataSchema`, ohne Statusfelder im Text. Ohne das gibt es keinen Hash-, Scope- oder Check-Anker.
2. **B2 – Approval als externer, hash-gebundener Record.** Mindestens ein Approval-Record (wie `forge/approvals/*.json`) mit `contentHash` + Version + unabhängigem Reviewer, angelegt nach dem Contract-Commit. `status: approved` im Contract darf nicht mehr als Freigabe gelten.
3. **B3 – Start vom `contract_commit`.** Handoff nennt `contract_commit` als Startpunkt; `base_commit` nur als Kontrollwert. Sonst liegt der Contract nicht in der Historie des Ergebnisses (Fall 16).
4. **B4 – Read-Quittung mit Blob/Hash + End-Marker** vor dem ersten Code-Commit, verglichen von jemand anderem als dem Developer (Forge-Skript oder Seb).
5. **B5 – Versionierungsregel festlegen.** Neue Version = gleicher Pfad `forge/contracts/<taskId>.md` in neuem Commit (Kernmodell), keine `.vN.md`-Sidecars für Handoff-Contracts.
6. **B6 – Klären, was „TASK-0004 starten“ heißt.** Eine Implementierung existiert bereits (`e9cb8e2`). Neu starten erzeugt einen konkurrierenden zweiten Stand; nachträglich binden braucht erst das fehlende Approval.

Ein minimaler Git-Observer-Schritt (B4 + Start-Gate-Prüfung) kann zunächst ein kleines Skript oder ein manueller Prüfschritt sein; der volle Log ist kein Blocker für Stufe 0.

## 10. SHOULD-FIX später

- **S1 – Git-Observer im Code:** `repoObservation` und `changedFiles` aus echtem Git erzeugen statt behaupten (kleiner Adapter neben `node-sha256.ts`).
- **S2 – Persistierter ForgeLog** (z. B. JSONL im Repo oder außerhalb), Replay als einzige Wahrheit (RT-10 normativ).
- **S3 – `contract_registered` gegen Git prüfen:** Text == Blob an `contractCommit:contractPath`.
- **S4 – `DeveloperReport` um `contractCommit`/`contentHash` erweitern** und gegen `run.contract` abgleichen.
- **S5 – RT-07:** Registrierung einer neuen Version bei aktivem Run ablehnen oder Run automatisch abbrechen.
- **S6 – RT-02:** Coordination-Ausnahme auf die eigene Datei der Rolle verengen.
- **S7 – RT-09:** Persistenz nach `remote_verified` erneut beobachtbar machen (vor Abnahme erneut prüfen).
- **S8 – RT-05:** Rollen-/Identitätsbindung (z. B. Event-Quelle = Werkzeug, nicht Agent) – erst wenn mehrere unabhängige Akteure Events schreiben.
- **S9 – A-PATCH-0001 auf den Claude-Branch bzw. Merge des Repair-Branchs**, damit nicht zwei Kern-Stände mit unterschiedlichem RT-06-Verhalten existieren.
- **S10 – Branch-Protection für `forge/contracts/**` und `forge/approvals/**`**, damit Fälle 12/13 verhindert statt nur erkannt werden.

## 11. Was ausdrücklich NICHT gebaut werden sollte

- **Keine Signaturen, PKI, Merkle-Manifeste oder Attestation.** Git-Blob-SHA + SHA-256-Content-Hash reichen für das Problem (Abschneiden, Doppelfassungen, veraltete Stände).
- **Kein „Beweis des Lesens“** über Quizfragen, Zusammenfassungs-Abgleich oder Modellkontext-Inspektion. Nicht verlässlich, teuer, und nicht nötig, weil das Ergebnis gegen den Blob geprüft wird.
- **Kein Section-Hash-Manifest pro Abschnitt.** Der Gesamthash plus Überschriftenliste plus End-Marker deckt Teil-Laden ab.
- **Keine Statusfelder im Contract** (`status`, `architecture_review`, `implementation_gate`). Status ist abgeleitet.
- **Keine Contract-Inhalte, Zusammenfassungen oder „Ergänzungen“ im Handoff.**
- **Kein YAML-Parser im Kern**, nur um Altcontracts zu lesen (0001A §18 schließt YAML und Migration aus). Neue Contracts kernkonform schreiben.
- **Keine Plattform** (GitHub App, Queue, DB) für diesen Schritt. Stufe 0 ist ein Skript plus der vorhandene Kern.

## 12. Empfehlung

**NO – TASK-0004 kann nicht mit dem neuen Prozess gestartet werden, jedenfalls nicht so, wie er beschrieben ist.**

Technische Begründung:

1. **Der Contract ist nicht kernkonform.** YAML-Frontmatter → `FRONTMATTER_MISSING` (durch `dogfood.test.ts` fixiert). Es gibt keinen Kern-Hash, keine Registrierung, keinen maschinenlesbaren Scope.
2. **Die Freigabe ist nicht nachweisbar.** `status: approved` ist eine Selbstauskunft des Spec-Authors bei gleichzeitig `architecture_review: pending_chatgpt_final_check`; es gibt keinen hash-gebundenen Approval-Record. Das ist live Fall 10 („Draft statt Approved“).
3. **Forge-Core kann die Bindung heute nicht durchsetzen.** Kein Log, kein Git-Observer, keine Read-Quittung; jede Prüfung wäre manuell.
4. **TASK-0004 ist bereits implementiert** (`e9cb8e2`, M1 `1de7efe`, TASK-0005 baut darauf auf). Ein „Start“ wäre ein zweiter, konkurrierender Run.

**Was heute schon geht (Stufe 0, ohne Code-Änderung am Kern):** Das Prinzip „Developer bekommt Repo + Commit + Blob und liest aus Git“ ist mit reinem `git` sofort nutzbar und beseitigt Abschneiden, Doppelfassungen und Platzhalter bereits. Empfohlen: B1–B5 auf den **nächsten** Contract anwenden (kernkonform, Approval-Record an Hash gebunden, Start vom Contract-Commit, Read-Quittung mit End-Marker) und dann mit dem Handoff aus Abschnitt 5 starten. Für TASK-0004 selbst ist der sinnvollere Weg die nachträgliche Bindung: Contract-Approval nachholen und den vorhandenen Stand `e9cb8e2` gegen genau den Blob `334fe6fe…` verifizieren. Ein Neu-Implementieren ist nicht sinnvoll.
