---json
{
  "forgeContractFormat": 1,
  "taskId": "FORGE-CORE-0001A",
  "contractVersion": 1,
  "baseCommit": "e9cb8e23c765deee5fab2d16bc0b793f53708714",
  "dependencies": [],
  "scope": {
    "create": [
      "src/forge/primitives.ts",
      "src/forge/identity.ts",
      "src/forge/contract-document.ts",
      "src/forge/ancestry.ts",
      "src/forge/events.ts",
      "src/forge/state.ts",
      "src/forge/start-gate.ts",
      "src/forge/kernel.ts",
      "src/forge/node-sha256.ts",
      "src/forge/freeze.ts",
      "tests/forge/fixtures.ts",
      "tests/forge/contract-document.test.ts",
      "tests/forge/identity.test.ts",
      "tests/forge/ancestry.test.ts",
      "tests/forge/state.test.ts",
      "tests/forge/start-gate.test.ts",
      "tests/forge/kernel.test.ts",
      "tests/forge/dogfood.test.ts",
      "tests/forge/typecheck.ts"
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
# FORGE-CORE-0001A – Contract Lifecycle, Approval, Dependency Binding, Developer Start Gate

Autor: Claude (spec_author und developer dieser Nacht).
Grundlage: FORGE-CORE-0001 Revision 2 (Chat-Draft) plus die acht Architekturentscheidungen aus dem ChatGPT-Review, die im Night-Run-Auftrag festgelegt wurden.
Freigabe: Diese Datei enthält bewusst **keinen** Status. Freigaben sind externe, an den Inhalts-Hash gebundene Datensätze (siehe §21).

## 1. Ziel und Basis

Implementiere den ersten Teil des Forge-Prozesskerns als reine TypeScript-Domainlogik:

- kanonisches Contract-Dokument mit Inhalts-Hash,
- Event-Log mit abgeleiteten Zuständen für Task und Contract-Revision,
- hash-gebundene Architektur-Freigaben mit Review-Unabhängigkeit,
- Dependency Binding,
- Ancestry über bezeugte Commit-Kanten,
- das deterministische Developer Start Gate.

Basis: `e9cb8e23c765deee5fab2d16bc0b793f53708714` (Mystery-Stand inkl. TASK-0004). Der Mystery-Code wird weder verwendet noch verändert.

Run-Lifecycle, Remote-Verifikation, Verification Evidence, Mutation Results, Code Review und Task-Abnahme gehören zu FORGE-CORE-0001B und werden hier **nicht** vorweggenommen.

## 2. Herkunft und Reconciliation gegenüber Revision 2

Übernommen aus den Architekturentscheidungen:

1. Der ForgeLog wird nicht persistiert; der Kern erhält Events als Input.
2. Unabhängiger Verifier ist in V0.0 nicht Pflicht (betrifft 0001B).
3. Review-Unabhängigkeit: AI-vs-AI darf `different_provider` verlangen; ein menschlicher Reviewer braucht nur eine vom Autor verschiedene Identität.
4. Contract-, Task- und Run-Zustand sind getrennte, abgeleitete Projektionen.
5. Keine gespeicherten Status-Strings.
6. Git-, Remote- und Befehlsfakten sind bezeugte Beobachtungen.
7. Lokaler Commit ist nicht remote verifiziert (betrifft 0001B).
8. `accepted` ist das V0.0-Ende (betrifft 0001B).

Reconciliation-Befunde gegenüber Revision 2 (in diesem Contract gelöst):

- **F1 (Widerspruch):** Revision 2 startete Runs bei `baseCommit`. Der Contract selbst liegt aber in einem Nachfahren-Commit, sodass jeder Scope-Diff die Contract-Datei enthalten hätte. Jetzt gilt: `startFromCommit = contractCommit`, und `baseCommit` muss Vorfahre-oder-gleich `contractCommit` sein (§12).
- **F2:** Menschliche Reviewer werden nicht durch Provider-Regeln blockiert (§5).
- **F3:** In 0001A existiert keine Task-Abnahme. Contracts mit Abhängigkeiten sind daher in 0001A nie freigebbar (§10). Das ist beabsichtigt, nicht ein Fehler.
- **F4:** `applyEvent` arbeitet auf dem Zustand, nicht auf dem rohen Log (§13).
- **F5:** Das JSON-Frontmatter muss kanonisch formatiert sein; doppelte Keys oder abweichende Formatierung werden abgelehnt (§6).
- **F6:** Ein nicht geschlossenes Frontmatter hat einen eigenen Fehlercode (§6).
- **F7:** Der Zustand trägt die Review-Policy, mit der er aufgebaut wurde; Events mit einem anderen Kernel werden abgelehnt (§13).

## 3. Dateien

Ausschließlich die Dateien aus `scope.create` im Frontmatter. Keine bestehende Datei wird verändert, keine Dependency hinzugefügt. `zod` ist bereits vorhanden und wird verwendet.

## 4. Primitive (`src/forge/primitives.ts`)

| Schema | Regel |
|---|---|
| `CommitShaSchema` | `^[0-9a-f]{40}$` |
| `Sha256HexSchema` | `^[0-9a-f]{64}$` |
| `TaskIdSchema` | `^[A-Z][A-Z0-9]*(-[A-Z0-9]+)+$`, höchstens 64 Zeichen |
| `RepoPathSchema` | relativer POSIX-Pfad: Segmente aus `[A-Za-z0-9._-]+`, getrennt durch `/`, keine leeren Segmente, kein Segment `.` oder `..`, höchstens 255 Zeichen |
| `RefNameSchema` | `^[A-Za-z0-9._/-]+$`, höchstens 255 Zeichen, ohne `..` und ohne `//` |
| `TextSchema` | String mit mindestens einem Nicht-Leerzeichen |
| `FindingSchema` | strict `{ severity: "blocking" \| "non_blocking", summary: Text, location: string \| null }` |

Alle exportierten Schemas sind strikt; Typen werden aus ihnen abgeleitet.

## 5. AgentIdentity und Review-Unabhängigkeit (`src/forge/identity.ts`)

```text
AgentIdentity = {
  actorType: "human" | "ai_agent" | "system",
  provider: ^[a-z0-9][a-z0-9._-]{0,63}$,     // Kleinbuchstaben-Slug; keine Provider-Enums
  model: string (nicht leer) | null,
  label: Text
}
ReviewPolicy = { aiReviewIndependence: "different_identity" | "different_provider" }
```

- `sameIdentity(a, b)`: alle vier Felder gleich.
- `isIndependentReviewer(author, reviewer, policy)`:
  1. `reviewer.actorType === "system"` → `false`
  2. `sameIdentity(author, reviewer)` → `false`
  3. beide `ai_agent` und `policy.aiReviewIndependence === "different_provider"` → `author.provider !== reviewer.provider`
  4. sonst `true`

Ein menschlicher Reviewer braucht also nur eine andere Identität, unabhängig vom Provider-Feld. Die Rolle ist kein Teil der Identität.

Bekannte Grenze: Identität ist selbsterklärt; ein anderes `label` derselben Person wird nicht erkannt. Authentifizierung gehört nicht zu V0.0.

## 6. Contract-Dokument und Hash (`src/forge/contract-document.ts`)

Dateipfad: `contractPathFor(taskId) = "forge/contracts/" + taskId + ".md"`.

Format:

```text
---json\n
<kanonisches JSON>\n
---\n
<Body, darf leer sein>
```

`parseContractDocument(text, sha256Utf8)` prüft in dieser Reihenfolge und liefert bei Fehlern **alle** Issues der ersten fehlschlagenden Stufe:

| Stufe | Issue-Code | Bedingung |
|---|---|---|
| 1 | `NOT_WELL_FORMED_UNICODE` | einzelnes Surrogat irgendwo im Text |
| 1 | `BOM` | erstes Zeichen U+FEFF |
| 1 | `CARRIAGE_RETURN` | `\r` irgendwo im Text |
| 2 | `FRONTMATTER_MISSING` | Text beginnt nicht mit `---json\n` |
| 2 | `FRONTMATTER_UNTERMINATED` | kein `\n---\n` nach dem Öffner |
| 3 | `FRONTMATTER_JSON` | `JSON.parse` scheitert |
| 3 | `FRONTMATTER_NOT_CANONICAL` | Frontmatter-Text ≠ `JSON.stringify(JSON.parse(text), null, 2)` |
| 4 | `METADATA_SCHEMA` | Zod-Fehler (Pfad mit Präfix `["metadata", …]`) |

Stufe 1 meldet alle zutreffenden Codes gemeinsam; Stufen 2 bis 4 werden nur erreicht, wenn die vorige ohne Issue blieb.

```text
ContractMetadata (strict, alle Felder Pflicht) = {
  forgeContractFormat: 1,
  taskId: TaskId,
  contractVersion: positive safe integer,
  baseCommit: CommitSha,
  dependencies: { taskId: TaskId, acceptedCommit: CommitSha | null }[],
  scope: { create: RepoPath[], modify: RepoPath[] },
  requiredChecks: { name: ^[a-z][a-z0-9-]{0,31}$, command: Text }[],
  mutationSmoke: "none" | "optional" | "required"
}
```

Zusätzliche Metadatenregeln (`METADATA_SCHEMA`):

- Abhängigkeits-taskIds eindeutig und nie gleich der eigenen taskId.
- `scope.create` und `scope.modify` je ohne Duplikate und disjunkt.
- Der eigene Contract-Pfad liegt in keiner der beiden Listen.
- `requiredChecks` nicht leer, Namen eindeutig.

Prozessfelder wie `status`, `approved` oder `architecture_review` sind durch das strikte Schema unzulässig.

Hash:

```text
contentHash = sha256Utf8("forge-contract-v1\n" + text)
CONTRACT_HASH_PREFIX = "forge-contract-v1\n"
Sha256Utf8 = (text: string) => string   // 64 lowercase hex; UTF-8 von text
```

Der Hash wird erst nach Stufe 1 berechnet, also nur für wohlgeformten Text. Das Ergebnis ist ein tief eingefrorenes `{ ok: true, document: { ref: { taskId, contractVersion, contentHash }, metadata, text } }` oder `{ ok: false, issues: { code, path }[] }`.

Boundary-Regel (nicht Teil des Kerns, aber verbindlich für Aufrufer): Dateibytes werden mit `new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })` dekodiert. Nur dann gilt UTF-8(text) == Dateibytes und ein BOM bleibt erkennbar.

## 7. Events (0001A-Teil, `src/forge/events.ts`)

```text
ForgeEvent (strict) = {
  actor: AgentIdentity,
  role: "owner" | "spec_author" | "architecture_reviewer",
  recordedAt: string | null,          // rein informativ, nie in Entscheidungen
  body: EventBody
}
EventBody (discriminated by "type") =
  | { type: "task_registered", taskId, title: Text }
  | { type: "contract_registered", taskId, contractPath: RepoPath, contractCommit: CommitSha,
      contractText: string, declaredContentHash: Sha256Hex }
  | { type: "approval_recorded", taskId, contentHash: Sha256Hex, gate: "architecture_review",
      verdict: "approved" | "changes_requested", findings: Finding[] }
```

Rollen: `task_registered` nur `owner`, `contract_registered` nur `spec_author`, `approval_recorded` nur `architecture_reviewer`.

## 8. Zustand und Projektionen (`src/forge/state.ts`)

Gespeichert werden ausschließlich Fakten:

```text
ForgeState = {
  policy: ReviewPolicy,
  log: readonly ForgeEvent[],
  tasks: readonly TaskRecord[]                   // Registrierungsreihenfolge
}
TaskRecord = { taskId, title, registeredBy: AgentIdentity, contracts: readonly ContractRevisionRecord[] }   // aufsteigende Version
ContractRevisionRecord = {
  ref: ContractRef, metadata: ContractMetadata, contractPath, contractCommit,
  author: AgentIdentity, decisions: readonly ApprovalDecision[]
}
ApprovalDecision = { gate, verdict, reviewer: AgentIdentity, findings: Finding[] }
```

Abgeleitet, nie gespeichert:

- `contractRevisionState(state, taskId, contentHash)`: `"superseded"` (höhere Version existiert), sonst `"changes_requested"` (Entscheidung für das Pflicht-Gate ist so), sonst `"approved"`, sonst `"draft"`; `null` bei unbekanntem Hash.
- `taskState(state, taskId)`: in 0001A genau `"planned"` (kein Contract), `"ready"` (aktuelle Revision approved) oder `"specifying"`; `null` bei unbekanntem Task.
- `currentContract(state, taskId)`: höchste Version oder `null`.

Pflicht-Gates: genau `["architecture_review"]`.

## 9. Approval

`approval_recorded` ist nur zulässig, wenn:

1. Task und Revision (`contentHash`) existieren (`TASK_UNKNOWN`, `CONTRACT_UNKNOWN`),
2. die Revision nicht superseded ist (`CONTRACT_SUPERSEDED`),
3. noch keine Entscheidung für `(contentHash, gate)` existiert (`APPROVAL_ALREADY_DECIDED`),
4. der Reviewer gemäß §5 unabhängig vom Autor der Revision ist (`REVIEWER_NOT_INDEPENDENT`),
5. bei `changes_requested` mindestens ein Finding vorliegt (`FINDINGS_REQUIRED`),
6. bei `approved` jede Abhängigkeit aufgelöst ist (§10).

Eine `changes_requested`-Entscheidung ist für diesen Hash endgültig; eine Änderung verlangt eine neue `contractVersion`. Eine neue Version erbt keine Entscheidung.

## 10. Dependency Binding

- Log-Regel (bei `approved` erzwungen): Für jede Abhängigkeit gilt `acceptedCommit != null` (sonst `DEPENDENCY_UNRESOLVED`) und die Abhängigkeit ist ein akzeptierter Task mit genau diesem Commit (sonst `DEPENDENCY_NOT_ACCEPTED`).
- In 0001A gibt es keine Task-Abnahme. Die interne Funktion `acceptedCommitOf(state, taskId)` liefert daher immer `null`. 0001B ersetzt sie.
- Repo-Regel G1 (im Gate, bezeugt): jeder nicht-null `acceptedCommit` ist Vorfahre-oder-gleich `baseCommit`.
- Keine transitiven Abhängigkeiten.

## 11. Ancestry (`src/forge/ancestry.ts`)

```text
CommitGraph = Readonly<Record<CommitSha, readonly CommitSha[]>>   // bezeugte Parent-Kanten, Ausschnitt genügt
isAncestorOrSelf(ancestor, descendant, graph): boolean
isReachableFromRefs(commit, refs: Readonly<Record<RefName, CommitSha>>, graph): boolean
```

- Traversierung von `descendant` über Parents, iterativ, mit Besucht-Menge. Zyklen in bezeugten Kanten terminieren.
- Fehlende Kanten bedeuten "nicht erreichbar" (**fail-closed**). Lookups nur über eigene Properties.

## 12. Developer Start Gate (`src/forge/start-gate.ts`)

```text
RepoObservation (strict) = {
  refs: Record<RefName, CommitSha>,
  parents: Record<CommitSha, CommitSha[]>,
  contractAtCommit: { commit: CommitSha, path: RepoPath, contentHash: Sha256Hex }
}
StartRequest = { taskId: TaskId, contentHash: Sha256Hex, repoObservation: RepoObservation }
canStartDeveloperRun(state, request: unknown) -> StartDecision
StartDecision =
  | { allowed: true, startFromCommit: CommitSha }                      // = contractCommit
  | { allowed: false, reasons: { code: BlockReasonCode, subject: string | null }[] }
```

Auswertung:

1. Request ungültig → genau `[REQUEST_INVALID]`.
2. Task unbekannt → genau `[TASK_UNKNOWN]`.
3. `taskState ≠ "ready"` → `TASK_NOT_STARTABLE` (subject = Task-Zustand).
4. Revision mit `contentHash` in diesem Task unbekannt → `CONTRACT_UNKNOWN`; die Schritte 5 und 6 entfallen.
5. Log-Fakten der Revision: superseded → `CONTRACT_NOT_CURRENT`; keine `approved`-Entscheidung → `CONTRACT_NOT_APPROVED`.
6. Bezeugte Repo-Fakten:
   - `CONTRACT_FILE_MISMATCH`: `contractAtCommit` weicht in Commit, Pfad oder Hash von der Revision ab.
   - `CONTRACT_NOT_PERSISTED`: `contractCommit` ist von keinem Ref erreichbar.
   - `BASE_COMMIT_NOT_PERSISTED`: `baseCommit` ist von keinem Ref erreichbar.
   - `BASE_NOT_IN_CONTRACT_HISTORY`: `baseCommit` ist nicht Vorfahre-oder-gleich `contractCommit`.
   - `DEPENDENCY_NOT_IN_BASE` (subject = taskId): G1 verletzt.

`allowed` genau dann, wenn kein Grund vorliegt. Gründe sind sortiert nach `code`, dann `subject` (UTF-16-Codeeinheiten; `null` zuerst) und tief eingefroren. Die Reihenfolge von `refs`- und `parents`-Keys hat keinen Einfluss.

Vertrauensgrenze: Das Gate beweist Log-Fakten. Repo-Fakten sind nur so wahr wie die übergebene Beobachtung. Fehlende Kanten können nur blockieren, nie freigeben.

## 13. Kernel und Event-Anwendung (`src/forge/kernel.ts`)

```text
createForgeKernel({ sha256Utf8: Sha256Utf8, policy: ReviewPolicy }) -> {
  policy,
  emptyState(): ForgeState,
  parseContractDocument(text): ContractDocumentResult,
  applyEvent(state, event: unknown): { ok: true, state } | { ok: false, rejection },
  replay(events: readonly unknown[]): { ok: true, state } | { ok: false, index, rejection },
  canStartDeveloperRun(state, request: unknown): StartDecision
}
Rejection = { code: EventRejectCode, path: (string | number)[], issues: { code, path }[] }
```

- `applyEvent` ist rein: Ein abgelehntes Event verändert nichts. Ein akzeptiertes Event liefert einen neuen, tief eingefrorenen Zustand, in dessen `log` das geparste Event steht.
- `replay(events)` entspricht exakt der schrittweisen Anwendung auf `emptyState()` und bricht beim ersten abgelehnten Event mit dessen Index ab.
- Ein Zustand mit anderer Policy als der Kernel wird abgelehnt (`POLICY_MISMATCH`).
- `node-sha256.ts` exportiert `nodeSha256Utf8` (die einzige Datei unter `src/forge/` mit `node:*`-Import).

`contract_registered` ist nur zulässig, wenn:

- der Task existiert (`TASK_UNKNOWN`),
- `parseContractDocument(contractText)` ok ist (`CONTRACT_DOCUMENT_INVALID`, mit `issues`),
- der berechnete Hash == `declaredContentHash` (`CONTRACT_HASH_MISMATCH`),
- `metadata.taskId` == Event-`taskId` (`CONTRACT_TASK_MISMATCH`),
- `contractPath` == `contractPathFor(taskId)` (`CONTRACT_PATH_MISMATCH`),
- `contractVersion` == bisherige höchste Version + 1, erste = 1 (`CONTRACT_VERSION_NOT_NEXT`).

Weitere Rejection-Codes: `EVENT_SCHEMA` (mit Zod-Pfad), `ROLE_NOT_ALLOWED`, `TASK_ALREADY_REGISTERED`.

## 14. Invarianten

1. Kein gespeichertes Statusfeld; jeder Zustand ist abgeleitet.
2. Metadaten und Hash stammen nur aus `contractText`.
3. Höchstens eine Entscheidung pro `(contentHash, gate)`.
4. `changes_requested` ist endgültig für den Hash.
5. Eine Freigabe verlangt aufgelöste, akzeptierte Abhängigkeiten.
6. Unabhängigkeit gemäß §5.
7. Ancestry fail-closed.
8. Kein `node:*` außerhalb von `node-sha256.ts`; keine Uhr, kein Zufall, kein globaler veränderlicher Zustand.
9. Eingaben werden nie verändert; Ausgaben und Zustände sind tief eingefroren.
10. Abgelehnte Events verändern nichts.
11. Kein Provider-Name im Produktionscode.

## 15. Acceptance Criteria

| ID | Kriterium |
|---|---|
| A-01 | Implementierungsdiff enthält genau Dateien aus `scope.create`. |
| A-02 | `npm run typecheck` und `npm test` grün, inkl. aller 451 bestehenden Tests. |
| A-03 | Golden-Vector: Hash eines Fixture-Contracts unabhängig per `sha256sum` berechnet und eingecheckt. |
| A-04 | Jeder Contract-Issue-Code hat einen auslösenden und einen knapp gültigen Test. |
| A-05 | Gekürzte oder veränderte Contracts werden über `declaredContentHash` abgelehnt; Prozessfelder im Frontmatter abgelehnt. |
| A-06 | Approval-Regeln §9 vollständig getestet, inkl. menschlicher und AI-Unabhängigkeit und `system`. |
| A-07 | Neue Version: superseded, erbt nichts; `changes_requested` nie wieder freigebbar. |
| A-08 | Abhängigkeiten in 0001A: `null` → `DEPENDENCY_UNRESOLVED`, sonst `DEPENDENCY_NOT_ACCEPTED`. |
| A-09 | Jeder BlockReason mit auslösendem und knapp nicht auslösendem Fall; mehrere Gründe gemeinsam, sortiert. |
| A-10 | Ancestry: Merge-Commits, Zyklen, fehlende Kanten (fail-closed). |
| A-11 | Replay-Determinismus: `replay` == schrittweises `applyEvent`; Permutation von Record-Keys ohne Effekt. |
| A-12 | Zustände, Dokumente und Entscheidungen sind tief eingefroren; Inputs bleiben unverändert. |
| A-13 | Dogfood: Dieser Contract wird von `parseContractDocument` akzeptiert, und sein Hash entspricht dem externen Freigabe-Record. |
| A-14 | `grep`: `node:` nur in `node-sha256.ts`; keine Provider-Namen (anthropic, openai, claude, codex, gpt) in `src/forge/`. |
| A-15 | Mutation-Smokes §17: jeder Mutant detected oder begründet equivalent; kein `not_applied`. |

## 16. Testmatrix (Mindestumfang)

- Parser: jede Stufe und jeder Code; Stufe-1-Mehrfachcodes; Grenzfälle (leerer Body, Frontmatter direkt gefolgt vom Ende, `---json` ohne Zeilenumbruch, doppelte Keys, umsortierte Keys in kanonischer Formatierung, Unicode-Escapes, unbekannte Felder, jede Metadatenregel).
- Hash: Golden-Vector; Ein-Byte-Änderung ändert den Hash; Präfix wirkt.
- Identity: alle Zweige von `isIndependentReviewer` für human/ai/system und beide Policies.
- Events: Schema, Rollen, alle Rejection-Codes.
- Projektionen: alle Revision- und Task-Zustände.
- Gate: alle Codes, Kombinationen, Sortierung, Determinismus bei Key-Permutation, `REQUEST_INVALID`.
- Ancestry: linear, Merge, Zyklus, unbekannter Commit, fehlende Kante.
- Replay: Gleichheit mit schrittweiser Anwendung; Abbruchindex; Policy-Mismatch.
- Immutability: Freeze-Scan, Mutationsversuche werfen; Inputs unverändert.
- Dogfood (A-13).

## 17. Pflicht-Mutation-Smokes

Mindestens:

1. BOM-Prüfung entfernt
2. CR-Prüfung entfernt
3. Surrogate-Prüfung entfernt
4. Kanonik-Prüfung entfernt
5. Hash ohne Präfix
6. `declaredContentHash` nicht verglichen
7. Versionsprüfung entfernt
8. zweite Entscheidung erlaubt
9. Unabhängigkeit: Provider-Regel auch für Menschen
10. Unabhängigkeit: `system` erlaubt
11. Dependency-Prüfung bei Approval entfernt
12. Ancestry fail-open (fehlende Kante = erreichbar)
13. `BASE_NOT_IN_CONTRACT_HISTORY` entfernt
14. Gründe unsortiert
15. abgelehntes Event verändert den Zustand

`not_applied` gilt nicht als Erfolg. Äquivalenz braucht eine konkrete Begründung.

## 18. Non-Goals

Runs, Remote-Verifikation, Verification Evidence, Mutation Results, Code Review, Task-Abnahme, Log-Persistenz, PWA/React/Hono/Postgres/GitHub App/API/Queue/SSE, Browser-SHA-Adapter, YAML, Migration alter Contracts, Authentifizierung.

## 19. Größe

Empfohlen ≤ 650 Zeilen Produktionscode unter `src/forge/` (inkl. Kommentare und Leerzeilen). Tests sind ausgenommen.

## 20. Übergabe an 0001B

0001B darf `state.ts`, `events.ts`, `start-gate.ts` und `kernel.ts` ausdrücklich erweitern:

- Run-Events und abgeleitete Run- und Task-Zustände,
- `RUN_ALREADY_ACTIVE`,
- `acceptedCommitOf` aus `task_accepted`,
- Gate-Neuberechnung in `run_started`.

0001B bindet sich mit `dependencies` nicht an 0001A (keine Task-Abnahme im Log der Nacht), sondern über `baseCommit` = 0001A-Implementierungscommit.

## 21. Freigabe (extern, nicht Teil dieses Dokuments)

Die Freigabe liegt als hash-gebundener Record in `forge/approvals/FORGE-CORE-0001A.v1.architecture_review.json`.

Für diese Nacht gilt: Der Owner hat im Night-Run-Auftrag die in §2 genannten Architekturentscheidungen vorab autorisiert. Der Record dokumentiert genau das. Er ersetzt **kein** zeilenweises unabhängiges Review dieses Textes. Das ChatGPT-Code-Review steht aus.

Format des Records (Pilot-Artefakt, keine Kernel-API):

```text
{
  forgeApprovalRecord: 1,
  taskId, contractVersion, contentHash, gate, verdict,
  actor: AgentIdentity,
  recordedBy: AgentIdentity,
  basis: string
}
```
