# FORGE CONTRACT SYSTEM V2

Rolle: Contract-System-Designer (rein lesend). Datum: 2026-10-03.
Keine Dateien im Repository geändert, keine Commits, keine PRs. Keine Implementierung.

**Geprüfte Stände (alle selbst aus Git gelesen)**

| Gegenstand | Ref / SHA | Beleg |
|---|---|---|
| Kanonisches Repo | `Forge-Dice/Forge`, `main` = `3d7545d843883418348004e68717399a64da7a7d` | `git rev-list --parents -n1`: Merge-Commit, Parents `f5dbc73` (altes main) und `0dfd903` (Baseline-Head) |
| Forge-Core auf `main` | `src/forge/*.ts`, 12 Dateien, 1 225 Zeilen | `contract-document.ts` 145 Z., `state.ts` 452 Z., `start-gate.ts` 101 Z., `verification.ts` 129 Z. |
| Contracts auf `main` | `FORGE-CORE-0001A.md`, `FORGE-CORE-0001A-PATCH-0001.md`, `FORGE-CORE-0001B.md`, `FORGE-CORE-0001B.v2.md`, `TASK-0004.md` | Format 1 (`---json`) für die vier Core-Contracts, YAML für TASK-0004 |
| TASK-0004 v1 (Legacy) | Commit `6a8c0c5` (Parent `5bfa5a4`), Blob `334fe6fea10967fc06d23034d8743d92f389e67c`, 38 629 Bytes, LF | identischer Blob auf `main` und allen vier historischen Branches |
| TASK-0005 v1 / v2 (Legacy, nur Branch) | v1 `fc01e4a` Blob `b56b5f69…`; v2 `0453f85` Blob `1e6f36e56ca439e50502ec1717b8e842499bf115`, 35 380 Bytes, Branch-Head `fab792a` | nicht auf `main`; Reviews: v1 REQUEST_CHANGES (`forge/reviews/TASK-0005.architecture-review.md` auf `main`), v2 APPROVE blob-gebunden nur auf `claude/forge-architecture-review-hjdq89` @ `be40a68` |
| Approvals auf `main` | `forge/approvals/FORGE-CORE-0001A.v1…json`, `…0001B.v1…json` | `actor: human/owner`, `recordedBy: ai_agent` („night-run developer session“) |
| Paralleler Thread | `FORGE-V0.1-VERIFIER-IMPLEMENTATION-PACKAGE.md` | **existierte beim Schreiben dieses Berichts noch nicht** in `/mnt/project-files/forge-audits/`; Abgleich siehe §3.9 gegen `FORGE-INDEPENDENT-VERIFIER-DESIGN.md` |

Grundlagen: `FORGE-CONTRACT-HANDOFF-AUDIT.md` (Fälle 1–20, Handoff v1, Blocker B1–B6), `FORGE-DEEP-AUDIT.md` (C-01…C-38, §7.4, §10), `FORGE-DEEP-RED-TEAM.md` (DRT-02, DRT-03, DRT-05, DRT-07, DRT-18, DRT-27, RTN-04/05/11/17/18), `FORGE-RUN-RECOVERY.md` (§5.6 Punkt 5 Contract-Base vs. Run-Base, SD-02/04/05), `FORGE-V0.1-HARDENING-PLAN.md` (D-2, D-5, D-12, D-13, K-04, K-05, P-03, P-04, S-03, S-04, S-09), `FORGE-ORGANIZATION-MIGRATION-DELTA.md` (B3: Merge-Commit-Invarianten), `FORGE-INDEPENDENT-VERIFIER-DESIGN.md` (§4.5, §6.1, §9.3).

Sprachregel: **Kern** = `src/forge` (rein, zeitlos, bekommt bezeugte Fakten). **Contract-Check** = der Required Check `forge` auf einem Contract-PR (GitHub Actions aus `main`). **Run-Gate** = derselbe Workflow auf einem Run-PR. **Verifier** = der Lauf, der den Run-Head prüft. GIT = aus dem Repository gelesen, CODE = aus `src/forge`, INFERENZ = Schlussfolgerung.

---

## 0. Kurzfassung

1. **Contract = genau eine Datei `forge/contracts/<TASK>.md` mit `---json`-Frontmatter im Format 2, ohne jedes Statusfeld, mit End-Marker als letzter Zeile.** Identität einer Revision ist das Tripel (`contentHash` über den dekodierten Text, Git-Blob-SHA über die Bytes, Contract-Commit `C`). Alle drei Werte stehen in jeder Quittung, jedem Approval und jeder Evidence.
2. **Zwei Bases, klar getrennt.** `specifiedAgainst` (im Contract, gehasht) ist der `main`-Commit, gegen den der Spec-Autor die APIs gelesen hat. `runBase` (nicht im Contract) ist der `main`-Head, von dem der Run abzweigt. Regel: `specifiedAgainst ⊑ M ⊑ runBase`, wobei `M` der Registrierungs-Merge des Contracts auf `main` ist; `diff(specifiedAgainst, runBase) ∩ (scope.modify ∪ reads) = ∅`, sonst `SPEC_STALE` und neue Revision.
3. **Contract-Commit `C` ist nie ein Merge-Commit.** Bei Merge-Commit-Strategie auf `main` ist `C = M^2`, der Head des Contract-PR. Jeder Commit in `M^1..M^2` hat genau einen Parent und berührt nur die Contract-Datei; `tree(M) == tree(M^2)`. `M` ist das Registrierungsereignis, nicht der Contract-Commit.
4. **Versionen sind Merges, nicht Pushes.** `contractVersion` = Anzahl der auf `main` gemergten Revisionen dieses Pfads + 1. Iterationen innerhalb eines Contract-PR sind Commits, keine Versionen. Jede Revision v>1 nennt `supersedes` (Version + `contentHash` + Blob) der Vorrevision; `SupersededBy` wird nie gespeichert, sondern aus `git log --first-parent main -- <pfad>` abgeleitet.
5. **Blocking Findings haben IDs und müssen getragen werden.** Jedes blocking Finding bekommt die ID `F-<TASK>-<PR#>-<k>`. Eine Folgerevision oder ein Folge-PR muss jede offene blocking ID in `findings[]` mit `resolution: "resolved"` und einem existierenden `## `-Anker adressieren, sonst `FINDINGS_NOT_CARRIED`. Eine Revision, deren Text und Metadaten (ohne Version/Supersedes/Findings) mit der Vorrevision identisch sind, wird abgelehnt (`CONTRACT_REVISION_NO_CHANGE`). Zusätzlich gilt der zugewiesene Reviewer (D-5). Beides zusammen schließt DRT-02 in beiden Richtungen: gleicher Text bei anderem Reviewer, und anderer Reviewer bei gleichem Text.
6. **Approval = GitHub-Review `APPROVED` des zugewiesenen Architektur-Reviewers auf genau dem Head-SHA `C`**, mit einem `FORGE REVIEW v1`-Block, der Blob und `contentHash` wiederholt. Kein Approval überlebt eine Byte-Änderung. Es gibt keine „Re-Approval light“: jede Revision braucht ein neues Approval; die Check-Summary zeigt dem Reviewer nur, ob die Änderung metadata-only oder textuell ist.
7. **Read-Proof = tool-berechnete Quittung** (`FORGE READ RECEIPT v1`: `contract_commit`, `contract_blob`, `content_hash`, `byte_count`, `line_count`, `heading_count`, `end_marker`, `run_base`) im Run-PR-Body, vom Gate gegen Git nachgerechnet. Sie beweist, dass das Werkzeug den ganzen Blob gesehen hat, nicht, dass der Agent ihn verstanden hat. Letzteres fängt der Verifier gegen denselben Blob.
8. **Migration von TASK-0004/0005 ist nur explizit möglich:** Format-2-Revision am selben Pfad mit `supersedes.format: "legacy"` + Legacy-Blob-SHA, Pflichtabschnitt „Migration aus Legacy“, neues Architektur-Review. Ohne diese Felder: `LEGACY_CONTRACT_HISTORY`, Task bleibt nicht Forge-managed (D-13). Empfehlung: TASK-0004 einfrieren (Implementation ist Baseline-Provenienz), TASK-0005 erst migrieren, wenn es implementiert werden soll.
9. **Zwei Implementierungstasks:** `FORGE-CORE-0002` (Kern: Format 2, Supersedes, Findings-Carry-Forward, `runBase` im Start-Gate; ca. 200–260 Produktionszeilen) und `FORGE-PLAT-0001` (Contract-Check über Git-Fakten + Quittungs-/Review-Blöcke; ca. 280–360 Zeilen). Beide unter 400.

---

## 1. Current Problems

Jedes Problem ist mit Fundstelle belegt. „Pilot“ = TASK-0004/0005-Praxis, „Kern“ = `src/forge` auf `main`.

| # | Problem | Beleg | Folge |
|---|---|---|---|
| CP-01 | **Zwei Formate nebeneinander.** Vier Core-Contracts haben `---json`, TASK-0004 (`main`) und TASK-0005 (Branch) haben YAML mit `status:`, `architecture_review:`, `implementation_gate:` | `forge/contracts/TASK-0004.md` Z. 1–8 (GIT); `tests/forge/dogfood.test.ts:50-52` fixiert „not a valid Forge contract“ → `FRONTMATTER_MISSING` | Kein Hash, kein Scope, keine Registrierung für die Mystery-Contracts |
| CP-02 | **Status steht im Contract und widerspricht sich selbst.** `status: approved` neben `architecture_review: pending_chatgpt_final_check` (TASK-0004); TASK-0005 §18 enthält fünf Statuszeilen („Vertragsstatus: FINAL CANDIDATE / review_ready“ …) | TASK-0004 Z. 5–8; TASK-0005 v2 §18 (GIT) | Freigabe ist Selbstauskunft des Autors; Handoff-Audit Fall 10 live |
| CP-03 | **Approval ohne Reviewer-Identität.** Beide Approval-JSONs haben `actor: human/owner`, geschrieben von `recordedBy: ai_agent`; `basis` sagt ausdrücklich „No line-by-line owner review of this exact text took place“ | `forge/approvals/*.json` (GIT); Deep Audit C-21 | Kern liest diese Dateien nie; sie sind Prosa-Evidenz |
| CP-04 | **Versionierung widerspricht dem Kern.** `contractPathFor` erzwingt `forge/contracts/<taskId>.md` (`contract-document.ts:17-19`), aber `FORGE-CORE-0001B.v2.md` liegt als Sidecar | `contract-document.ts:17`; Deep Audit C-14; CODEX.md: „sidecar v2 is not automatically canonical kernel registration“ | Zwei Versionierungsregeln; eine davon unregistrierbar |
| CP-05 | **Patch als eigene Task-ID** statt v2 (`FORGE-CORE-0001A-PATCH-0001`) | GIT; Deep Audit C-15, DRT-07 | Dependents sehen nicht, dass 0001A überholt ist |
| CP-06 | **Architektur-Gate ohne Gedächtnis.** Eine v2, die sich nur in `contractVersion` unterscheidet, wird nach `changes_requested` approved, auch vom selben Reviewer | `state.ts` `approval_recorded`: prüft nur `task.contracts.at(-1) === revision` und Reviewer-Unabhängigkeit, erbt keine `decisions` (CODE); DRT-02/X04a,b | Versionsnummer hochzählen ohne Fix ist heute möglich |
| CP-07 | **Findings haben keine IDs.** `FindingSchema = {severity, summary, location}` | `primitives.ts:30-34` (CODE) | Nichts kann „Finding X adressiert“ ausdrücken |
| CP-08 | **Contract-Commit darf Merge-Commit sein.** Start-Gate prüft nur `baseCommit ⊑ contractCommit` | `start-gate.ts:92` (CODE); DRT-05/X23 | Zweiter Parent schmuggelt ungeprüften Code in den Startpunkt |
| CP-09 | **Base-Begriff vermischt zwei Dinge.** `baseCommit` ist gehasht (Teil des Contracts) **und** Startpunkt-Semantik („Developer startet vom Contract-Commit“, `startFromCommit = revision.contractCommit`, `start-gate.ts:100`) | CODE; Run Recovery §5.6 Punkt 5; Hardening D-12 vertagt die Trennung | Mit Merge-Commit-`main` ist „Start vom Contract-Commit“ nicht mehr merge-fähig: `C` liegt auf dem Seitenzweig, der Run-Branch wäre nie „up to date“ (INFERENZ, §7.2) |
| CP-10 | **Hash bindet dekodierten Text, nicht Bytes.** Drei verschiedene Blobs mit ungültigem UTF-8 ergeben denselben `contentHash` | `contract-document.ts:140` hasht `text`; DRT-27/X12 | Kern-Identität und Git-Identität fallen auseinander |
| CP-11 | **Kein End-Marker, kein Größenlimit.** Abgeschnittener Text ist einfach „eine andere Revision“; 50 MB Contract wird angenommen | Deep Audit C-38; Handoff-Audit Fall 7/19 | Pilot-Fehler „Contract nur teilweise geladen“ ist nicht erkennbar |
| CP-12 | **Registrierung prüft Text ↔ Commit nicht.** `contract_registered` nimmt `contractCommit` und `contractText` getrennt an; zwei Versionen mit demselben `contractCommit` werden angenommen | `state.ts` `contract_registered` (CODE); DRT-03/X33 | Erst das Start-Gate vergleicht, und nur gegen eine gelieferte Beobachtung |
| CP-13 | **Chat ist Dependency.** 0001A §2 „Grundlage: FORGE-CORE-0001 Revision 2 (Chat-Draft) plus die acht Architekturentscheidungen aus dem ChatGPT-Review“; TASK-0005 §18 „ausstehender unabhängiger ChatGPT-Check“ | GIT | Was den Contract begründet, ist nicht in Git |
| CP-14 | **Dependencies der Mystery-Kette sind dem Kern unbekannt.** TASK-0001…0003 nie registriert; `dependencies: []` überall, Bindung nur über `baseCommit` | Core-Contracts (GIT); Handoff-Audit §3 Punkt 9 | `DEPENDENCY_NOT_ACCEPTED` wäre die Folge jeder ehrlichen Deklaration |
| CP-15 | **Check-Commands frei.** `requiredChecks[].command` ist beliebiger Text; `{"name":"test","command":"true"}` ist gültig | `contract-document.ts:24` (CODE); C-29/C-31 | Verifier-Allowlist existiert nur im Design |
| CP-16 | **Mutationspflicht ist ein Enum** (`none | optional | required`), die Mutanten selbst stehen in Prosa (TASK-0005 §16, 0001A §17) | CODE; D-7, K-04 | Developer-Mutationen zählen, trivialer Mutant erfüllt `required` |
| CP-17 | **Keine Pflichtstruktur.** Acceptance Criteria, Non-Goals, Größe stehen in frei benannten Abschnitten (`## 12. Acceptance Criteria`, `## 15. Non-Goals`, `## 16. Maximale Produktionscodegröße…`) | TASK-0004/0005 (GIT) | Reviewer-Vorlagen und Quittungen können keine Abschnitte referenzieren |
| CP-18 | **TASK-0004 ist implementiert ohne gültiges Approval**, 14 min 53 s nach dem Contract-Commit; TASK-0005 v2 ist blob-gebunden approved, aber nur auf einem Branch, der nicht auf `main` ist | Deep Audit C-22; `be40a68` (GIT) | Jede Migration muss diese Geschichte benennen, nicht überschreiben |

Was bereits gut ist und **bleibt**: kanonisches JSON (`JSON.stringify(raw, null, 2)`), Stufenprüfung BOM/CR/Surrogate, striktes Schema ohne Statusfelder, Hash erst nach Wohlgeformtheit, `CONTRACT_VERSION_NOT_NEXT` lückenlos, Approval an Hash gebunden, Start-Gate mit bezeugter Beobachtung, `forge/contracts/` und `forge/approvals/` immer verboten im Run-Diff.

---

## 2. Canonical Contract Lifecycle

### 2.1 Objekte

| Objekt | Wo | Identität | Unveränderlich? |
|---|---|---|---|
| **Task** | implizit: erster Contract-PR für `forge/contracts/<TASK>.md` | `taskId` | ja (ID) |
| **Contract-Revision** | Blob an `C:forge/contracts/<TASK>.md` | (`taskId`, `contractVersion`, `contentHash`, `blobSha`, `C`) | ja; eine Revision wird nie editiert, nur superseded |
| **Registrierungs-Merge `M`** | Merge-Commit auf `main`, `M^2 = C` | `M` | ja |
| **Approval** | GitHub-Review `APPROVED` auf `C` + `FORGE REVIEW v1`-Block | (`C`, Reviewer-Login) | ja (ein neuer Push = neuer Head = Review verfällt) |
| **Finding** | `FORGE REVIEW v1`-Block eines Reviews (Contract-PR oder Run-PR) | `F-<TASK>-<PR#>-<k>` | ja |
| **Run** | PR von `forge/run/<TASK>-<n>` nach `main`, Quittung im Body | (`taskId`, `n`) → bindet genau eine Revision | Head bewegt sich, Bindung nicht |
| **Acceptance** | Owner-Merge des Run-PR: `A^1` = altes `main`, `A^2` = verifizierter Head, `tree(A) == tree(A^2)` | `A` | ja |

Es gibt **kein** gespeichertes Statusfeld. Jeder Zustand unten ist eine Funktion dieser Git-/GitHub-Fakten (D-1).

### 2.2 Ablauf (eine Revision)

```text
 Spec-Autor                 Contract-Check `forge`        Architektur-Reviewer       Owner (Seb)
 ──────────                 ──────────────────────        ────────────────────       ───────────
 1. Branch forge/spec/<TASK>-v<n>
    genau 1 Datei, Format 2,
    End-Marker, PR nach main
                         2. parse (fatal UTF-8) → Tripel
                            Struktur, Supersedes, Findings-
                            Carry-Forward, Base-Regeln,
                            Allowlist, Mutanten-Form,
                            Legacy-Erkennung → Summary
                                                        3. Review auf Head C:
                                                           APPROVED + FORGE REVIEW v1
                                                           oder CHANGES_REQUESTED
                                                           + Findings mit IDs
    4. bei Findings: neue Commits
       im selben PR (keine neue
       Version), zurück zu 2.
                         5. `forge-approval` grün ⇔ zugewiesener
                            Reviewer ≠ Autor, APPROVED auf
                            aktuellem Head
                                                                                   6. Merge (Merge-Commit M):
                                                                                      M^1 = altes main, M^2 = C,
                                                                                      tree(M) == tree(C)
                         7. Handoff-Workflow aus main postet
                            FORGE DEVELOPER HANDOFF v1
                            (nur Identifikatoren)
```

Danach **Run** (Developer liest `C:forge/contracts/<TASK>.md` aus Git, startet von `runBase` = aktuellem `main`-Head, Quittung in den PR-Body), **Verifier** (gegen genau dieses Tripel), **Code-Review** (gegen dasselbe Tripel), **Owner-Merge** = Acceptance.

### 2.3 Abgeleitete Zustände einer Revision

| Zustand | Definition (Fakten) |
|---|---|
| `proposed` | offener Contract-PR, Head-Blob parst, `forge` grün, `forge-approval` rot |
| `approved` | wie `proposed`, zusätzlich `forge-approval` grün auf dem aktuellen Head |
| `current` | `main:forge/contracts/<TASK>.md` hat genau diesen Blob; es gibt keinen jüngeren Registrierungs-Merge für den Pfad |
| `superseded` | Blob war einmal an `main:<pfad>`, ist es nicht mehr (`git log --first-parent main -- <pfad>` zeigt einen jüngeren Merge) |
| `withdrawn` | Contract-PR geschlossen ohne Merge; kein Effekt auf `main`; **offene blocking Findings dieses PR bleiben offen** und müssen vom nächsten PR getragen werden |
| `bound` | ein Run-PR mit Quittung auf dieses Tripel ist offen oder gemergt |
| `accepted` | Run-PR auf dieses Tripel wurde vom Owner gemergt |

Task-Zustände (`planned … accepted`) bleiben die des Kerns (`state.ts` `taskState`); V0.1 berechnet sie ephemer per `replay` über synthetisierte Events (D-1).

### 2.4 Grundregeln

- **R1 Eine Datei, ein Pfad.** `forge/contracts/<TASK>.md`. Keine Sidecars, keine `.vN.md`. Eine Revision ersetzt die Datei am selben Pfad; die alte Revision bleibt als Blob in der Historie.
- **R2 Versionen sind Merges.** `contractVersion` wird nur durch Merge erhöht. Innerhalb eines PR wird iteriert, nicht versioniert.
- **R3 Genau ein Contract-PR und genau ein Run-PR je Task gleichzeitig offen.** Ein Contract-PR darf nicht gemergt werden, solange ein Run-PR dieses Tasks offen ist (`RUN_ACTIVE`); der Owner schließt zuerst den Run (RT-07, K-05 (4)).
- **R4 Keine Semantik im Handoff.** Der Developer bekommt Identifikatoren, liest den Blob aus Git, quittiert tool-berechnet.
- **R5 Chat ist nie Grundlage.** Jede Begründung, Entscheidung, Reviewer-Aussage, die den Contract trägt, steht entweder im Contract-Text selbst oder in einem Git-Objekt/GitHub-Review mit SHA bzw. PR-Nummer.
- **R6 Legacy wird nicht still migriert.** §10.

---

## 3. Schema

### 3.1 Dateiform (deterministisch, ohne Git prüfbar)

```text
---json\n
<kanonisches JSON = JSON.stringify(JSON.parse(x), null, 2)>\n
---\n
<Body: Markdown, UTF-8, LF, kein BOM, kein CR, kein U+0000, keine Bidi-Steuerzeichen>
<!-- END OF CONTRACT <taskId> v<contractVersion> -->\n   ← letzte Zeile, genau einmal, letztes Byte LF
```

Hash: `contentHash = sha256("forge-contract-v1\n" + text)` über den fatal dekodierten Text (Präfix bleibt `v1`, weil die Hash-Eingabe unverändert „ganzer Text“ ist; ein Präfix-Bump würde nur die vier Core-Contracts von Format 1 doppelt identifizieren). `blobSha = git hash-object` über die Bytes. Für jeden akzeptierten Contract identifizieren beide dieselben Bytes, weil der Check nur fatal dekodierte Blobs annimmt (schließt CP-10 an der Grenze; der Kern-Port bleibt textbasiert, S-08).

### 3.2 Frontmatter Format 2 (Beispiel, vollständig)

```json
{
  "forgeContractFormat": 2,
  "taskId": "TASK-0006",
  "title": "Accusation & Verdict",
  "contractVersion": 2,
  "supersedes": {
    "contractVersion": 1,
    "contentHash": "0f3c…64hex",
    "blobSha": "9a1b…40hex",
    "format": 2
  },
  "specifiedAgainst": "3d7545d843883418348004e68717399a64da7a7d",
  "dependencies": [
    { "taskId": "TASK-0003", "acceptedCommit": "5bfa5a47562282548cf7c916c2328f8e03fcc473", "provenance": "legacy" }
  ],
  "reads": [
    "src/domain/case-solution.ts",
    "src/domain/case-truth.ts"
  ],
  "scope": {
    "create": [
      "src/domain/case-accusation.ts",
      "tests/case-accusation.fixture.ts",
      "tests/case-accusation.test.ts",
      "tests/case-accusation.typecheck.ts"
    ],
    "modify": [
      "src/domain/case-solution.ts"
    ]
  },
  "requiredChecks": [
    { "name": "typecheck", "command": "npm run typecheck" },
    { "name": "test", "command": "npm test" }
  ],
  "mutants": [
    {
      "id": "VERDICT-IGNORES-CONTRADICTED",
      "file": "src/domain/case-accusation.ts",
      "before": "if (contradicted.length > 0) return \"wrong\";",
      "after": "if (false) return \"wrong\";",
      "tests": ["tests/case-accusation.test.ts"]
    }
  ],
  "limits": {
    "maxProductionLines": 300,
    "maxChangedFiles": 5
  },
  "findings": [
    { "id": "F-TASK-0006-14-1", "resolution": "resolved", "where": "## 5. Verdict-Regel" }
  ]
}
```

### 3.3 Felddefinitionen und Regeln

Parser-Regeln (P) sind ohne Git prüfbar und gehören in `contract-document.ts` (Task 1). Check-Regeln (G) brauchen Git/GitHub und gehören in den Contract-Check (Task 2). Reviewer-Regeln (R) sind Prosa für die Rollenvorlage.

| Feld | Typ / Regel | Ebene | Grund |
|---|---|---|---|
| `forgeContractFormat` | Literal `2` | P | Format 1 bleibt für die vier Core-Contracts parsebar (Lesepfad), neue Contracts müssen 2 sein (`FORMAT_NOT_CURRENT` im Check) |
| `taskId` | `TaskIdSchema` (`^[A-Z][A-Z0-9]*(-[A-Z0-9]+)+$`, ≤64); `= Dateiname ohne .md` | P (Schema), G (Dateiname) | CP-04 |
| `title` | Text, 1–120 Zeichen, keine Zeilenumbrüche | P | `task_registered.title` kommt aus dem Contract, nicht aus Chat |
| `contractVersion` | positive ganze Zahl | P | – |
| `supersedes` | `null` ⇔ `contractVersion === 1`; sonst `{contractVersion: n-1, contentHash: 64hex \| null, blobSha: 40hex, format: 2 \| "legacy"}`. `contentHash` darf nur bei `format: "legacy"` `null` sein | P (Form), G (`blobSha` = Blob an `M_prev:<pfad>`, `contentHash` gleich; Legacy: Blob existiert in `git log --first-parent main -- <pfad>`) | CP-04/05, §4, §10 |
| `specifiedAgainst` | `CommitSha` | P; G: liegt auf First-Parent-Kette von `main` **und** `⊑ M^1` des eigenen Merges (zum Check-Zeitpunkt: `⊑ main`-Head) | CP-09; ersetzt `baseCommit` |
| `dependencies[]` | `{taskId, acceptedCommit, provenance: "forge" \| "legacy"}`, `taskId` eindeutig ≠ eigene | P; G: `forge` → `acceptedCommit` ist Merge-Commit eines gemergten Run-PR dieses Tasks auf First-Parent-Kette (`DEPENDENCY_NOT_MERGED`); `legacy` → `acceptedCommit ⊑ specifiedAgainst` (`DEPENDENCY_NOT_IN_SPEC_BASE`), kein Acceptance-Lookup | CP-14; Legacy sichtbar statt `[]` |
| `reads[]` | `RepoPath[]`, eindeutig, `∩ scope.create = ∅` | P; G: jede Datei existiert an `specifiedAgainst` (`READS_NOT_FOUND`); Lint: jeder Pfad `src/**/*.ts` im Body (Backticks), der nicht in `scope.create` liegt, muss in `reads` oder `scope.modify` stehen (`READS_INCOMPLETE`) | macht die „Direkt verifizierte Dependency“-Tabelle maschinenlesbar; Grundlage für `SPEC_STALE` |
| `scope.create` / `scope.modify` | `RepoPath[]`, disjunkt (casefold!), kein Pfad casefold unter geschützten Präfixen (`forge/`, `.github/`, `src/forge/`, `tests/forge/`, `tests/forge-red-team/` nur mit Präfix `FORGE-`), keine Konfigurationsdateien (`package.json`, `package-lock.json`, `tsconfig*.json`, `vitest.config.*`, `.npmrc`, `.gitattributes`, `.gitmodules`); keine Windows-reservierten Namen; `1 ≤ \|create\|+\|modify\| ≤ 32` | P (K-01/K-02 übernehmen die Listen; hier nur referenziert) | C-28, DRT-23/24/25 |
| `requiredChecks[]` | `{name, command}`, ≥1, Namen eindeutig | P; G: jedes Paar exakt in `policy.allowedChecks` (`CHECK_NOT_ALLOWED`) | CP-15; Form für `evaluateVerification` unverändert |
| `mutants[]` | `{id: ^[A-Z0-9][A-Z0-9-]{2,31}$, file, before, after, tests[]}`; `id` eindeutig; `file ∈ scope.create ∪ scope.modify` und beginnt mit `src/`; `before ≠ after`, `before` nicht leer, ohne `\n`? (nein: mehrzeilig erlaubt, aber ohne CR); `tests[]` unter `tests/`, nicht leer; `1 ≤ \|mutants\| ≤ 8` | P; G: für `file ∈ scope.modify` kommt `before` an `specifiedAgainst` genau einmal vor (`MUTANT_NOT_APPLICABLE`); für `scope.create` erst im Verifier | CP-16, D-7, VD §9.3 |
| `limits` | `{maxProductionLines: int ≥ 1, maxChangedFiles: int ≥ 1}`; `maxChangedFiles ≥ \|create\|` | P | CP-11; Verifier zählt (§3.6) |
| `findings[]` | `{id: ^F-<taskId>-[0-9]+-[0-9]+$, resolution: "resolved", where: "## …"}`; `id` eindeutig; `where` ist exakt eine `## `-Zeile des Bodys (`FINDING_ANCHOR_MISSING`); bei `contractVersion === 1` leer | P; G: jede offene blocking ID des Tasks ist enthalten (`FINDINGS_NOT_CARRIED`); jede genannte ID existiert (`FINDING_UNKNOWN`) | CP-06/07, §6 |
| **verboten** | jedes andere Feld (`status`, `approved`, `architecture_review`, `implementation_gate`, `spec_author`, `base_commit`, `mutationSmoke`, `baseCommit`) | P (`strictObject`) | CP-02 |

Weitere Parser-Regeln:

- `END_MARKER_MISSING` (letzte Zeile ≠ Marker), `END_MARKER_MISMATCH` (Marker nennt andere `taskId`/Version), `END_MARKER_DUPLICATE` (Marker mehr als einmal), `NO_TRAILING_NEWLINE`.
- `FORBIDDEN_CHARACTER` für U+0000, U+202A–U+202E, U+2066–U+2069, U+200E/U+200F (RTN-17). Sonstige Unicode-Prosa bleibt erlaubt (deutsch, Umlaute, Pfeile).
- `CONTRACT_TOO_LARGE` ab 262 144 Bytes (Parser-Konstante); die Policy darf enger sein (`policy.maxContractBytes`, Vorschlag 131 072). TASK-0004 hat 38 629, TASK-0005 35 380 Bytes.
- `SECTION_MISSING`: Body enthält je genau eine `## `-Zeile, die `Acceptance Criteria` bzw. `Non-Goals` enthält; bei `contractVersion > 1` zusätzlich eine, die `Änderungen gegenüber v<n-1>` oder `Changes since v<n-1>` enthält; bei `supersedes.format === "legacy"` zusätzlich `Migration aus Legacy`.
- Lints mit Heuristikcharakter (G, nicht P, weil fehlbar): `STATUS_ASSERTION` (Zeile beginnt mit `Status:`, `Vertragsstatus:`, `Implementierungsstatus:`, `Architektur-Freigabe:`, `Freigabe:` oder enthält `review_ready`, `BLOCKED_PENDING_APPROVAL`, `status: approved`), `CHAT_REFERENCE` (`chat.openai.com`, `chatgpt.com/`, `claude.ai/`, `Chat-Draft`, `laut Chat`, `im Chat`, `per Nachricht`). Beide machen den Check rot; ein Owner-Kommentar `/forge lint-waive <code>` hebt genau einen Code auf (`policy.lintWaivable`).

### 3.4 Warum `baseCommit` durch `specifiedAgainst` ersetzt wird

`baseCommit` trug zwei Bedeutungen (CP-09). Mit der Merge-Commit-Strategie bleibt nur eine davon haltbar: „gegen diesen Stand wurde spezifiziert“. Der Startpunkt ist ein Run-Fakt (`runBase`), kein Contract-Fakt, weil er sich mit jedem Merge auf `main` ändert, ohne dass die Spezifikation falsch wird. Für den Kern bleibt `BASE_NOT_IN_CONTRACT_HISTORY` sinnvoll, nur mit `specifiedAgainst` als Subjekt: `specifiedAgainst ⊑ C` gilt konstruktiv, weil `specifiedAgainst ⊑ M^1 ⊑ C` (PR up to date). Der gefährliche Fall C-08 („ungeprüfter Code zwischen Base und Contract-Commit“) ist auf `main` konstruktiv ausgeschlossen (alles kam per Required Check), und die verbleibende semantische Staleness wird mechanisch über `reads` erkannt (§7.3).

### 3.5 Welche Felder maschinenlesbar sein müssen (Antwort auf Frage 7)

Maschinenlesbar ist, was ein Gate **entscheidet** oder ein Verifier **prüft**: `taskId`, `title`, `contractVersion`, `supersedes`, `specifiedAgainst`, `dependencies`, `reads`, `scope`, `requiredChecks`, `mutants`, `limits`, `findings`, der End-Marker und die beiden Pflichtüberschriften (als Anker). Dazu außerhalb des Contracts: Quittung, Review-Block, Handoff (§7, §8).

### 3.6 Was bewusst nur in Markdown steht (Antwort auf Frage 8)

| Inhalt | Warum nicht maschinenlesbar |
|---|---|
| Ziel, Datenmodell, API, Regeln, Entscheidungstabellen | Das ist die Spezifikation; sie wird von Menschen und Agenten gelesen und vom Reviewer beurteilt. Eine Formalisierung wäre ein zweites Typsystem |
| **Acceptance Criteria** (Tabelle `AC-nn`) | Nur die Überschrift ist Anker. Eine maschinenlesbare AC-Liste würde suggerieren, der Verifier prüfe sie; er prüft nur Scope, Checks, Mutanten, Limits. Die Zuordnung AC ↔ Test ist Reviewer-Arbeit |
| **Non-Goals** | Reviewer-Material; der Verifier kann „nicht gebaut“ nur über `scope` erzwingen |
| Testmatrix | Pflichtlektüre für den Developer, nicht für das Gate; Mutanten sind der maschinelle Extrakt daraus |
| Dependency-Fakten-Tabelle (Exporte, Signaturen) | Prosa; `reads` ist ihr maschineller Extrakt, `READS_INCOMPLETE` verbindet beide |
| Begründung von Entscheidungen, Reconciliation-Ergebnis | Geschichte; darf alles Mögliche zitieren, aber nur Git-/PR-Objekte (R5) |
| „Änderungen gegenüber v(n-1)“, „Migration aus Legacy“ | Pflichtabschnitte als Anker; Inhalt ist Prosa für den Reviewer |
| Empfohlene Größe als Begründung | Der Zahlenwert steht in `limits`; die Prosa erklärt ihn |

`limits.maxProductionLines` wird vom Verifier deterministisch gezählt: Summe der **hinzugefügten** Zeilen (`git diff --numstat runBase..head`) über Dateien unter `src/**` im Scope; Löschungen geben keinen Kredit. Überschreitung → `SIZE_EXCEEDED`, Run rot (Entscheidung OD-A, §12).

### 3.7 Geschützte Pfade und Overrides

V0.1: keine Overrides im Contract (VD §5.2 bewusst ohne Feld; S-12 vertagt). Forge-Core-Tasks (`FORGE-*`) dürfen `src/forge/**`, `tests/forge/**`, `tests/forge-red-team/**` im Scope haben, wenn `policy.forgeCorePrefix` das freigibt; alle anderen geschützten Pfade bleiben für jeden Contract tabu. Bootstrap-PRs (D-10) laufen außerhalb des Contract-Systems.

### 3.8 Formatbeispiel für ein Legacy-Supersedes (TASK-0005 v3)

```json
"contractVersion": 3,
"supersedes": {
  "contractVersion": 2,
  "contentHash": null,
  "blobSha": "1e6f36e56ca439e50502ec1717b8e842499bf115",
  "format": "legacy"
}
```

Erst-Registrierung mit `contractVersion > 1` ist genau dann erlaubt, wenn `supersedes.format === "legacy"` (Kernregel in Task 1). Der Check verlangt zusätzlich, dass der Legacy-Blob in der First-Parent-Historie von `main` am selben Pfad vorkommt **oder** der Owner ihn per `/forge legacy-blob <sha>` attestiert (TASK-0005 v2 ist nicht auf `main`; §10).

### 3.9 Abgleich mit dem parallelen Verifier-Package

Die Datei `FORGE-V0.1-VERIFIER-IMPLEMENTATION-PACKAGE.md` lag zum Schreibzeitpunkt nicht vor. Abgeglichen wurde gegen `FORGE-INDEPENDENT-VERIFIER-DESIGN.md`, auf dem das Package aufbaut. Verbindliche Schnittstellen, die ein Contract-Draft im Package treffen muss, und **bewusste Abweichungen**:

| Punkt | Verifier-Design | Dieses Dokument | Abweichung |
|---|---|---|---|
| Mutanten-Form | `"mutants": [{id,file,before,after,tests}]` (§9.3) | identisch, plus `before ≠ after`, `file` unter `src/`, 1–8 Stück | keine |
| Check-Allowlist | `requiredChecks[].command` muss Policy-Eintrag entsprechen (§7.2) | `CHECK_NOT_ALLOWED` im Contract-Check | keine |
| Contract-Commit-Ermittlung | `C = git log -1 --first-parent main -- CPATH`, genau ein Parent (§4.5) | **Mit Merge-Commits ist der First-Parent-Commit `M` (zwei Parents).** V2: `C = M^2`, Linearität gilt für alle Commits in `M^1..M^2`, `tree(M) == tree(C)` | **ja, muss im Package übernommen werden** (Delta B3) |
| `baseCommit` | wird gegen `C^` geprüft (§4.5) | heißt `specifiedAgainst`, Regel `⊑ M^1` und auf First-Parent-Kette | **ja** (Feldname) |
| `forgeContractFormat` | 1 | 2 | **ja** (Parser muss 2 akzeptieren; Task 1) |
| `mutationSmoke` | Enum entfällt (D-7) | entfällt; `mutants.length > 0` ⇒ Pflicht | keine |
| Protected paths | Policy-Liste (§6.1) | Parser-Liste (K-01) + Policy-Liste; beide müssen gleich sein (Test: Policy ⊇ Parser) | keine |
| End-Marker | nicht erwähnt | Pflicht, letzte Zeile | Ergänzung |
| Diff-Basis des Verifiers | `B = merge-base(head, main)` (§4.4) | `runBase` muss genau dieses `B` sein und auf der First-Parent-Kette liegen; Quittung nennt es | Präzisierung |

Falls das Package einen Contract im Format 1 mit `baseCommit` und `mutationSmoke` entwirft, ist er mit diesem Schema **nicht** kompatibel; der Unterschied ist genau die obige Tabelle.

---

## 4. Versioning

### 4.1 Wie eine neue Contract-Version entsteht (Antwort auf Frage 1)

1. Spec-Autor (Rolle `spec_author`) liest `main:forge/contracts/<TASK>.md` (aktuelle Revision v(n)) und das zugehörige Tripel aus der Check-Summary des letzten Registrierungs-Merges.
2. Er legt Branch `forge/spec/<TASK>-v<n+1>` von `main` an und ändert **nur** diese Datei: `contractVersion: n+1`, `supersedes = {n, contentHash(v(n)), blobSha(v(n)), 2}`, `findings[]` für jede offene blocking ID, Pflichtabschnitt „Änderungen gegenüber v(n)“, neuer End-Marker `v<n+1>`.
3. PR nach `main`. Der Contract-Check prüft `supersedes` gegen den Blob an `main` (nicht gegen den Branch), `CONTRACT_VERSION_NOT_NEXT` gegen `|git log --first-parent main -- <pfad>|` (nur Format-2-Revisionen zählen; Legacy nur mit `supersedes.format: "legacy"`), `CONTRACT_REVISION_NO_CHANGE`, `FINDINGS_NOT_CARRIED`.
4. Zugewiesener Reviewer reviewt den Head. Iterationen im PR sind Commits auf demselben Branch; die Versionsnummer bleibt n+1.
5. Owner merged (Merge-Commit `M`). Ab jetzt ist v(n+1) `current`, v(n) `superseded`.

Es gibt keinen „Rebase“ ohne neue Version: Ändert sich nur `specifiedAgainst`, ist das trotzdem v(n+1) (Metadaten gehören zum gehashten Text). Das ist billig, weil die Summary die Änderung als `metadata-only` ausweist.

### 4.2 Was eine Revision auslösen darf

| Auslöser | Quelle | Pflichtinhalt der Revision |
|---|---|---|
| Blocking Finding aus Architektur-Review (geschlossener PR) | `FORGE REVIEW v1` im Contract-PR | `findings[]` für jede ID |
| Code-Review `request_changes` mit `requires: contract_change` | `FORGE REVIEW v1` im Run-PR | `findings[]` für jede ID; der Run-PR wird geschlossen (nicht gemergt) |
| `SPEC_STALE` (Datei in `reads`/`scope.modify` hat sich seit `specifiedAgainst` geändert) | Run-Gate | neues `specifiedAgainst`, Abschnitt „Änderungen“ nennt die Dateien |
| Owner-Entscheidung (Scope-Änderung, Non-Goal wird Goal) | Owner | Abschnitt „Änderungen“ |
| Äquivalenter Mutant (Verifier `MUTATION_SURVIVED`, Reviewer-Urteil „äquivalent“) | Verifier + Reviewer | Mutant entfernt oder ersetzt; sichtbar im Diff (D-7) |

### 4.3 Supersedes / SupersededBy

- `supersedes` ist **im neuen** Contract und gehasht. Es nennt die Vorrevision durch Version, `contentHash` und Blob. Das macht die Kette ohne Log prüfbar: `git log --first-parent main -- <pfad>` liefert die Merges, und jeder Blob muss das `supersedes` seines Nachfolgers erfüllen (`CONTRACT_SUPERSEDES_MISMATCH`).
- `supersededBy` wird **nie gespeichert**. Die alte Datei existiert am `main`-Head nicht mehr; ihr Blob ist unveränderlich. Abgeleitet: „v(n) ist superseded“ ⇔ es existiert ein jüngerer Registrierungs-Merge für den Pfad.
- Patches sind Revisionen derselben Task-ID (schließt C-15/DRT-07). `FORGE-CORE-0001A-PATCH-0001` bleibt Geschichte.

### 4.4 Wann braucht eine Revision neues Architecture Review? (Antwort auf Frage 2)

**Immer.** Jede Revision ist ein neuer Blob; ein Approval ist an `C` (und damit an den Blob) gebunden; ein neuer Head verwirft es (Ruleset „Dismiss stale approvals“, und `forge-approval` prüft `commit_id == head`). Es gibt keine Ausnahme für „nur `specifiedAgainst` geändert“, weil der Reviewer genau dann prüfen muss, ob die Spezifikation auf dem neuen Stand noch stimmt (Run Recovery §5.6 Gegenargument).

Was sich ändert, ist der **Aufwand**, nicht die Pflicht. Die Check-Summary klassifiziert die Revision:

| Klasse | Definition | Hinweis an den Reviewer |
|---|---|---|
| `metadata-only` | Body byteidentisch zu v(n), nur Frontmatter geändert | Diff der Frontmatter-Felder; bei `specifiedAgainst`: Dateiliste `diff(old, new) ∩ (reads ∪ scope.modify)` |
| `textual` | Body geändert | vollständiger Diff; `findings[].where`-Abschnitte zuerst |
| `migration` | `supersedes.format === "legacy"` | vollständiges Review, weil es die erste Format-2-Freigabe des Tasks ist |

Reviewer-Identität: derselbe zugewiesene Reviewer wie bei v(n) (D-5), sonst `REVIEWER_NOT_ASSIGNED`; Wechsel nur per Owner-Kommentar `/forge reviewer architecture <login>`.

### 4.5 Wie Forge Versionsnummer-Hochzählen ohne Fix verhindert (Antwort auf Frage 4)

Vier unabhängige Sperren, jede für sich ausreichend gegen den beobachteten Angriff DRT-02:

1. **`CONTRACT_REVISION_NO_CHANGE`** (Kern, Registrierung): Body und Metadaten ohne `contractVersion`/`supersedes`/`findings` sind mit v(n) identisch → abgelehnt. Reine Versions-Bumps sind damit unmöglich.
2. **`FINDINGS_NOT_CARRIED`** (Kern, Registrierung): jede offene blocking ID aus v(n) (Architektur-`changes_requested` oder Code-Review `contract_change`) muss in `findings[]` mit `resolution: "resolved"` und einem existierenden `## `-Anker stehen. Ein Finding ohne Fix im Text ist zwar noch möglich, aber der Anker zwingt den Autor, eine Stelle zu nennen, und
3. **zugewiesener Reviewer** (Check, D-5): derselbe Reviewer, der das Finding geschrieben hat, muss die Folgerevision approven. Reviewer-Shopping über einen anderen Login scheitert an `REVIEWER_NOT_ASSIGNED`; derselbe Reviewer sieht sein eigenes Finding in `findings[]` und den Anker.
4. **Carry-Forward über geschlossene PRs** (Check): Findings eines geschlossenen, nicht gemergten Contract-PR bleiben offen (§6.2). Ein neuer PR mit altem Text trägt sie oder ist rot.

Was bleibt: ein Reviewer, der sein eigenes blocking Finding ohne Fix abhakt. Das ist keine mechanische Lücke, sondern die Definition von Review.

---

## 5. Approval Binding

### 5.1 Form

Approval = GitHub-Review `APPROVED` auf dem Contract-PR, `commit_id = C` (aktueller Head), vom zugewiesenen Reviewer mit Rolle `architecture_reviewer` in `forge/policy.json`, Login ≠ PR-Autor, Review-Body beginnt mit:

```text
FORGE REVIEW v1
task:            TASK-0006
contract_version: 2
contract_commit: <40-hex>   (= Head, den GitHub als commit_id führt)
contract_blob:   <40-hex>
content_hash:    <64-hex>
verdict:         approved
findings:        none
```

Für `CHANGES_REQUESTED`:

```text
verdict:         changes_requested
findings:
  F-TASK-0006-14-1 blocking  §5: Verdict-Regel widerspricht AC-07 bei undetermined
  F-TASK-0006-14-2 non_blocking §9: Mutant 3 ist trivial
```

Die ID-Nummer `<k>` vergibt der Reviewer fortlaufend innerhalb seines Reviews; der Check prüft Format (`F-<TASK>-<PR#>-<k>`), PR-Nummer = dieser PR, Eindeutigkeit über alle Reviews des Tasks. `forge-approval` ist rot, wenn der Block fehlt, `contract_blob`/`content_hash` nicht zum Head passen (`REVIEW_BLOCK_MISMATCH`) oder `verdict` nicht zum GitHub-Review-State passt.

### 5.2 Warum Tripel statt nur `contentHash`

| Schlüssel | Wer benutzt ihn | Was er nicht kann |
|---|---|---|
| `contentHash` | Kern (`findRevision`, `approval_recorded`, `run_started`) | unterscheidet keine Bytes bei ungültigem UTF-8 (DRT-27) |
| `blobSha` | Git, Reviews („blob-bound“ in TASK-0005-Reviews), `git rev-parse C:<pfad>` | Kern kennt ihn nicht (kein SHA-1-Port) |
| `C` | GitHub (`commit_id` des Reviews), Handoff, Quittung | ein Commit kann die Datei nur einmal enthalten; allein reicht er nicht, weil Registrierung Commit ↔ Text nicht prüft (DRT-03) |

Der Contract-Check verlangt alle drei konsistent und schreibt sie in die Summary. Ab da ist jedes Artefakt, das nur einen der drei nennt, unvollständig (`RECEIPT_INVALID`, `REVIEW_BLOCK_MISMATCH`).

### 5.3 Externe Reviewer (ChatGPT, Grok)

Ein Review ohne eigene GitHub-Identität wird von Seb als Owner gepostet, mit demselben Block und einer Zeile `attested_for: chatgpt` (frei, informativ). Es zählt als **Owner-Review**, nie als unabhängiges Review (D-4). Ist Seb Spec-Autor, ist es nicht unabhängig → `forge-approval` rot. Das ist die Antwort auf CP-03: ein Approval hat immer einen GitHub-Login, der nicht der Autor ist.

### 5.4 Was im Kern ankommt

V0.1 synthetisiert pro Check-Lauf: `task_registered` (Owner, Titel aus v1), `contract_registered` v1..k (Actor = Autor-Login des jeweiligen Contract-PR, Text = Blob an `M_i`), `approval_recorded` je Revision (Reviewer-Login, Verdict, Findings mit IDs aus dem Block), danach `kernel.replay` muss `ok` sein. Das ersetzt die Approval-JSONs; `forge/approvals/` bleibt Geschichte und verboten im Run-Diff.

---

## 6. Finding Carry-Forward

### 6.1 Finding-Modell

`Finding = {id, severity: blocking | non_blocking, summary, location}`; `id` ist Pflicht und eindeutig je Task. Quellen:

| Quelle | PR-Art | Kern-Event (synthetisiert) |
|---|---|---|
| Architektur-Review `CHANGES_REQUESTED` | Contract-PR | `approval_recorded(changes_requested, findings)` |
| Code-Review `REQUEST_CHANGES` mit `requires: contract_change` | Run-PR | `code_review_recorded(request_changes, contract_change, findings)` |
| Code-Review `REQUEST_CHANGES` mit `requires: code_change` | Run-PR | `code_review_recorded(…code_change…)` — **nicht** vom Contract getragen; trägt der nächste Run (S-11) |

**Offen** ist ein blocking Finding, bis (a) eine registrierte Folgerevision es in `findings[]` als `resolved` trägt **und** der zugewiesene Reviewer diese Revision approved, oder (b) der Reviewer es in einem späteren Review-Block als `withdrawn F-…` zurücknimmt. Der Autor kann nichts zurückziehen (OD-F).

### 6.2 Wie alte Blocking Findings übernommen werden (Antwort auf Frage 3)

```text
Offene blocking IDs des Tasks  =  ⋃ über alle Contract-PRs und Run-PRs des Pfads
                                   { F aus FORGE REVIEW v1 mit severity blocking }
                                 \  { F, die in einer *gemergten* Revision als resolved stehen }
                                 \  { F, die ein späterer Review-Block des Reviewers als withdrawn nennt }
```

Regeln:

1. **Registrierung** (Kern + Check): `findings[]` der neuen Revision ⊇ offene IDs, sonst `FINDINGS_NOT_CARRIED` mit der Liste. Nicht existierende IDs → `FINDING_UNKNOWN`. Jede `where`-Überschrift existiert.
2. **Approval** (Check): der Reviewer sieht in der Summary jede getragene ID mit ihrem Anker und dem Diff dieses Abschnitts gegen v(n). Approved er, sind die IDs geschlossen.
3. **Geschlossene PRs zählen.** Ein `withdrawn` Contract-PR (geschlossen ohne Merge) löscht keine Findings. Darum muss der Check alle PRs lesen, die den Pfad geändert haben, nicht nur `main`.
4. **Code-Review-Findings mit `contract_change`** werden genauso getragen; der Run-PR wird geschlossen, der Contract-PR trägt die IDs, der neue Run beginnt auf der neuen Revision.
5. **Kern-Spiegelung** (Task 1): `approval_recorded(approved)` auf v(n+1) wird abgelehnt (`FINDINGS_NOT_CARRIED`), wenn eine blocking ID aus `decisions` von v(≤n) oder aus `verdict.findings` eines Runs auf v(≤n) mit `requires: contract_change` fehlt. So gilt die Regel auch, falls der Kern später persistiert läuft.

### 6.3 Was nicht getragen wird

Non-blocking Findings (Hinweise) und Observations werden nicht erzwungen; die Summary listet sie als „offen, nicht blockierend“. Findings aus Red-Team-Berichten (`forge/reviews/*.red-team.md`) sind keine Review-Blöcke und werden nicht automatisch zu IDs; wer sie binden will, schreibt ein Review mit Block.

---

## 7. Run Binding

### 7.1 Handoff (nur Identifikatoren; aus Handoff-Audit §5, ergänzt)

```text
FORGE DEVELOPER HANDOFF v2
repository:       Forge-Dice/Forge
task:             TASK-0006
contract_version: 2
contract_commit:  <C, 40-hex>
contract_blob:    <40-hex>
content_hash:     <64-hex>
registered_at:    <M, 40-hex>            # Registrierungs-Merge auf main
run_base:         <R, 40-hex>            # main-Head beim Posten; Developer prüft, ob main weitergewandert ist
result_ref:       refs/heads/forge/run/TASK-0006-1
role_template:    forge/roles/developer.md@<main-sha>
```

Kein Contract-Text, keine Zusammenfassung, kein `specifiedAgainst` als Startanweisung. Der Workflow aus `main` postet ihn als Kommentar auf den gemergten Contract-PR (P-04).

### 7.2 Wie ein Run exakt eine Contract-Version bindet (Antwort auf Frage 5)

Fünf Bindungen, in dieser Reihenfolge geprüft (Run-Gate, jeder Push):

1. **Branch-Name** `forge/run/<TASK>-<n>`, `n` = Anzahl bisheriger Run-PRs des Tasks + 1 (`RUN_NUMBER_NOT_NEXT`); PR-Base `main`; Head im selben Repo.
2. **Run-Base** `R = merge-base(head, main)` liegt auf der First-Parent-Kette von `main` (`WRONG_BASE`) und `M ⊑ R` (`CONTRACT_NOT_IN_RUN_BASE`), wobei `M` der Registrierungs-Merge der aktuellen Revision ist.
3. **Blob-Gleichheit** `git rev-parse R:forge/contracts/<TASK>.md == contract_blob` der aktuellen Revision (`CONTRACT_SUPERSEDED`, wenn `main` inzwischen eine neuere Revision trägt; `CONTRACT_FILE_MISMATCH` sonst).
4. **Quittung** im PR-Body (§8) nennt dasselbe Tripel und dasselbe `R` (`RECEIPT_MISSING`, `RECEIPT_MISMATCH`).
5. **Kern** (`canStartDeveloperRun` mit `runBase = R`): `allowed` und `startFromCommit === R`; Beobachtung `{refs: {main, pull/N/head}, parents: rev-list --parents specifiedAgainst..head, contractAtCommit: {R, pfad, contentHash}}` kommt aus dem Git-Snapshot aus `main`, nie vom Developer.

Der Run ist damit an genau ein Tripel gebunden; jeder Push wird neu geprüft (TOCTOU-sicher, C-36). Evidence, Code-Review-Block und Acceptance nennen dasselbe Tripel.

Was der Developer tut (Rollenvorlage): `git fetch origin main`, `git switch -c forge/run/<TASK>-<n> origin/main` (nicht `--detach <contract_commit>`!), Contract lesen mit `git cat-file -p <contract_commit>:forge/contracts/<TASK>.md` **und** prüfen `git rev-parse HEAD:forge/contracts/<TASK>.md == contract_blob`, Quittung erzeugen, erst dann Code.

### 7.3 Contract-Base vs. Run-Base (Antwort auf Frage 6)

| | `specifiedAgainst` | `runBase` (`R`) |
|---|---|---|
| Wo | im Contract, gehasht | Run-PR-Fakt (`merge-base(head, main)`), in Quittung und Evidence |
| Bedeutung | gegen diesen `main`-Stand wurden `reads` gelesen und `scope.modify` geschrieben | von diesem `main`-Stand zweigt der Run ab; gegen ihn diffet der Verifier |
| Regel | auf First-Parent-Kette, `⊑ M^1` | auf First-Parent-Kette, `⊒ M` |
| Staleness | — | `diff --raw --no-renames specifiedAgainst R` ∩ (`reads` ∪ `scope.modify`) ≠ ∅ → `SPEC_STALE`, Run-Gate rot, Developer stoppt; Ausweg ist eine Revision mit neuem `specifiedAgainst` (OD-B) |
| Dependencies | `acceptedCommit ⊑ specifiedAgainst` | automatisch erfüllt, weil `specifiedAgainst ⊑ R`; zusätzlich `DEPENDENCY_REVERTED`, wenn ein Revert-Merge einer Dependency zwischen `specifiedAgainst` und `R` liegt (S-07, heuristisch über Commit-Titel „Revert“, markiert als INFERENZ) |

Damit ist RECONCILE (Run Recovery §5.2) ein Merge von `main` in den Run-Branch ohne Contract-Änderung, solange `SPEC_STALE` nicht anschlägt. Die Trennung ist genau die Entscheidung aus Run Recovery Anhang B.1, hier als Pflicht, weil Merge-Commit-`main` den Start vom Contract-Commit ohnehin unmöglich macht (CP-09).

### 7.4 Contract-Commit darf kein Merge-Commit sein

Verbindliche Registrierungs-Invarianten für einen Merge `M` auf `main`, der `forge/contracts/<TASK>.md` ändert (Delta B3, präzisiert):

```text
I1  M hat genau zwei Parents; M^1 = vorheriger main-Head (First-Parent-Kette)
I2  git diff --raw --no-renames M^1 M  berührt genau {forge/contracts/<TASK>.md}
I3  für jeden Commit X in  git rev-list M^1..M^2 :
      X hat genau einen Parent  (CONTRACT_COMMIT_NOT_LINEAR)
      git diff --raw --no-renames X^ X  berührt nur forge/contracts/<TASK>.md  (CONTRACT_COMMIT_NOT_ISOLATED)
I4  tree(M) == tree(M^2)                 (REGISTRATION_TREE_MISMATCH; folgt aus „up to date“ + I3)
I5  C := M^2;  rev-parse C:<pfad> == rev-parse M:<pfad> == contract_blob
```

Der Contract-Check prüft I3 bereits auf dem PR (jeder Commit der PR-Range), der Run-Gate prüft I1–I5 nachträglich an `M`. Für den Kern: `observation.parents[C].length === 1` und `observation.contractCommitPaths === [pfad]` (K-05 (5), hier referenziert). Der Kern sieht `C`, nie `M`.

---

## 8. Read Proof

### 8.1 Quittung

Im Run-PR-Body, erster Block, vom Developer-Werkzeug erzeugt (Rollenvorlage gibt die Befehle vor):

```text
FORGE READ RECEIPT v2
task:             TASK-0006
contract_version: 2
contract_commit:  <C>
contract_blob:    <git rev-parse C:forge/contracts/TASK-0006.md>
content_hash:     <sha256("forge-contract-v1\n" + text)>
byte_count:       <git cat-file -s C:forge/contracts/TASK-0006.md>
line_count:       <wc -l>
heading_count:    <grep -c '^## '>
end_marker:       <!-- END OF CONTRACT TASK-0006 v2 -->      # letzte Zeile wörtlich
run_base:         <git merge-base HEAD origin/main>
```

Das Gate rechnet jede Zeile aus Git nach (`RECEIPT_MISMATCH` nennt die Zeile). Zusätzliche Zeilen → `RECEIPT_INVALID`. Derselbe Block ist Pflicht im Code-Review (`FORGE REVIEW v1` + Quittung), damit Review und Abnahme nachweislich denselben Blob meinen.

### 8.2 Was die Quittung beweist und was nicht

| Beweist | Beweist nicht |
|---|---|
| Das Werkzeug des Developers hat den vollständigen Blob gelesen (Bytes, Zeilen, Überschriften, letzte Zeile stimmen) | dass das Modell jeden Abschnitt im Kontext behalten hat |
| Der Developer kennt das korrekte Tripel und die korrekte Run-Base | dass er den Contract über den Prompt stellt |
| Ein abgeschnittenes Read-Tool (Zeilen-/Byte-Limit) fällt sofort auf, weil `end_marker`/`line_count` nicht stimmen | – |

Das Fehlende wird hinten abgefangen: Scope, Checks, Mutanten, Limits prüft der Verifier gegen den registrierten Blob; Acceptance Criteria prüft der Code-Reviewer gegen denselben Blob. Mehr behauptet die Quittung nicht (Handoff-Audit §6, §11: keine Quiz-/Zusammenfassungsbeweise).

### 8.3 Deterministische Erkennung abgeschnittener Dateien (Antwort auf Frage 9)

Vier Schichten, alle ohne Ermessen:

1. **Dateiebene (Parser):** letztes Byte ist `\n`; letzte Zeile ist exakt `<!-- END OF CONTRACT <taskId> v<N> -->`; der Marker kommt genau einmal vor; `taskId`/`N` stimmen mit dem Frontmatter überein. Ein abgeschnittener Text verliert den Marker; ein angehängter Text verschiebt ihn (`END_MARKER_NOT_LAST`); ein kopierter Marker aus v1 passt nicht (`END_MARKER_MISMATCH`).
2. **Objektebene (Git):** `contract_blob` und `byte_count` kommen aus `git`; ein anderer Inhalt hat eine andere Blob-SHA. Zwei zusammenkopierte Hälften zweier Versionen sind ein dritter Blob.
3. **Kernebene:** `contentHash` deckt den ganzen Text; eine abgeschnittene Kopie ist eine unregistrierte Revision (`CONTRACT_UNKNOWN`).
4. **Leseebene (Quittung):** `line_count`, `heading_count`, `end_marker` müssen mit dem Blob übereinstimmen; sie kommen aus dem Werkzeug, das den Text wirklich geladen hat, nicht aus dem Modell.

Nicht gebaut: Abschnitts-Hashes, Zeilennummern im Text, Prüfsummen pro Überschrift (Handoff-Audit §11). Der Marker plus Blob plus Quittung decken alle beobachteten Pilotfehler.

---

## 9. 25+ Adversarial Cases

Status: PREVENTED (Check/Gate/Kern lehnt ab, bevor etwas gilt), DETECTED (wird nach dem Ereignis rot, bevor es Wirkung hat), TRUST (hängt an Reviewer oder einem ehrlichen Werkzeug). Ebene: P Parser, K Kern, CC Contract-Check, RG Run-Gate, V Verifier, RS Ruleset/CODEOWNERS, R Reviewer.

| ID | Angriff / Fehler | Erwartete Eigenschaft | Mechanismus V2 | Ebene | Status |
|---|---|---|---|---|---|
| ACV-01 | v(n+1) unterscheidet sich nur in `contractVersion` nach blocking `changes_requested` (DRT-02/X04) | Blocking Findings müssen adressiert werden | `CONTRACT_REVISION_NO_CHANGE` (Body+Metadaten identisch) und `FINDINGS_NOT_CARRIED` | K, CC | PREVENTED |
| ACV-02 | Alten Contract-PR schließen, neuen PR mit gleichem Text öffnen, anderen Reviewer anfragen | Findings überleben PR-Wechsel | Findings aus geschlossenen PRs zählen (§6.2); `REVIEWER_NOT_ASSIGNED` für anderen Login | CC | PREVENTED |
| ACV-03 | `findings[]` listet alle IDs mit Ankern, aber der Abschnitt ist unverändert | Finding ist nicht adressiert | Mechanisch nur `FINDING_ANCHOR_MISSING`; Summary zeigt „Abschnitt unverändert gegenüber v(n)“ (Diff leer) als roten Hinweis; Urteil beim zugewiesenen Reviewer | CC, R | TRUST (sichtbar gemacht) |
| ACV-04 | `findings[].id` nennt eine fremde oder erfundene ID (`F-TASK-0005-3-9`) | Nur echte IDs | `FINDING_UNKNOWN` (Task-Präfix ≠ eigene `taskId` ist schon `METADATA_SCHEMA`) | P, CC | PREVENTED |
| ACV-05 | `supersedes` zeigt auf v(n-1) statt v(n) oder auf einen Branch-Blob | Kette lückenlos | `CONTRACT_SUPERSEDES_MISMATCH` gegen Blob an `main` | K, CC | PREVENTED |
| ACV-06 | Zwei Contract-PRs für denselben Task gleichzeitig; der zweite wird nach dem ersten gemergt | Eine Revision je Version | `CONTRACT_PR_DUPLICATE` solange beide offen; nach Merge des ersten `CONTRACT_VERSION_NOT_NEXT`/`SUPERSEDES_MISMATCH` für den zweiten (Ruleset „up to date“ erzwingt Rebase, der Check läuft neu) | CC, RS | PREVENTED |
| ACV-07 | Contract-PR enthält zusätzlich `src/x.ts` oder ändert `forge/policy.json` | Contract-PR ist isoliert | `CONTRACT_PR_NOT_ISOLATED` (I2/I3); CODEOWNERS für `forge/**` | CC, RS | PREVENTED |
| ACV-08 | Contract-Branch enthält einen Merge-Commit, dessen zweiter Parent EVIL einbringt (DRT-05/X23) | Kein ungeprüfter Code im Registrierungspfad | I3: jeder Commit in `M^1..M^2` ein Parent → `CONTRACT_COMMIT_NOT_LINEAR`; Kern: `parents[C].length === 1` | CC, K | PREVENTED |
| ACV-09 | Contract-PR ist nicht up to date; `M` wird echter Merge mit abweichendem Tree | Registrierung ändert nur die Contract-Datei | Ruleset „Require branches to be up to date“; nachträglich I4 `REGISTRATION_TREE_MISMATCH` am Run-Gate (Task nicht startbar, Owner muss v(n+1) registrieren) | RS, RG | PREVENTED / DETECTED |
| ACV-10 | `specifiedAgainst` auf Seitenzweig oder nicht auf First-Parent-Kette | Spezifikation gegen `main` | `SPEC_BASE_NOT_ON_MAIN` | CC | PREVENTED |
| ACV-11 | `specifiedAgainst` = Root `f5dbc73`, obwohl `reads` Dateien nennt, die später entstanden (C-09) | Base beschreibt den gelesenen Stand | `READS_NOT_FOUND` (Datei existiert an `specifiedAgainst` nicht); existiert sie, greift `SPEC_STALE` am Run-Gate | CC, RG | PREVENTED |
| ACV-12 | Dependency mit `provenance: forge` auf einen Legacy-Task (TASK-0003) | Nur gemergte Run-PRs sind Forge-Dependencies | `DEPENDENCY_NOT_MERGED` (kein Run-PR dieses Tasks existiert); korrekt wäre `legacy` | CC | PREVENTED |
| ACV-13 | Dependency `legacy` mit `acceptedCommit`, der nicht Vorfahre von `specifiedAgainst` ist | Dependency liegt im gelesenen Stand | `DEPENDENCY_NOT_IN_SPEC_BASE`; Kern: `DEPENDENCY_NOT_IN_BASE` | CC, K | PREVENTED |
| ACV-14 | Zwischen Contract-Merge und Run-Start merged ein anderer Task eine Datei aus `reads` | Spezifikation könnte veraltet sein | `SPEC_STALE` am Run-Gate mit Dateiliste; Ausweg nur Revision (OD-B) | RG | DETECTED (vor Code) |
| ACV-15 | `reads` wird leer gelassen, um `SPEC_STALE` zu umgehen; Dependency-Tabelle im Body nennt `src/domain/case-solution.ts` | `reads` spiegelt die Prosa | `READS_INCOMPLETE` (Backtick-Pfade `src/**/*.ts` im Body außerhalb `scope.create` müssen in `reads` ∪ `scope.modify` stehen) | CC | PREVENTED (heuristisch; Reviewer-Checkliste zusätzlich) |
| ACV-16 | Developer startet vom Contract-Commit `C` statt von `main` | Run-Base liegt auf `main` | `merge-base(head, main)` = `M^1`, nicht ⊒ `M` → `CONTRACT_NOT_IN_RUN_BASE`; Ruleset „up to date“ blockiert zusätzlich den Merge | RG, RS | PREVENTED |
| ACV-17 | Developer startet von altem `main` vor `M` oder von einem Branch | wie ACV-16 | `WRONG_BASE` / `CONTRACT_NOT_IN_RUN_BASE`; Quittung `run_base` passt nicht | RG | PREVENTED |
| ACV-18 | Neue Revision wird gemergt, während ein Run-PR offen ist (RT-07) | Run bleibt an seine Revision gebunden und wird sichtbar überholt | Contract-Check: `RUN_ACTIVE` verhindert den Merge; falls Owner dennoch (Bypass gibt es nicht) → Run-Gate `CONTRACT_SUPERSEDED` beim nächsten Lauf | CC, RG | PREVENTED |
| ACV-19 | Contract abgeschnitten gelesen (Read-Tool mit Zeilenlimit), Developer implementiert §1–§9 | Vollständige Lektüre nachweisbar | Quittung: `line_count`/`end_marker` falsch → `RECEIPT_MISMATCH`; ohne Quittung `RECEIPT_MISSING` | RG | DETECTED (vor Verifier) |
| ACV-20 | Datei endet mit Marker, danach weiterer Text (zwei Contracts hintereinander kopiert) | Marker ist letzte Zeile | `END_MARKER_NOT_LAST`/`END_MARKER_DUPLICATE` | P | PREVENTED |
| ACV-21 | Marker aus v1 in v2 übernommen | Marker nennt Version | `END_MARKER_MISMATCH` | P | PREVENTED |
| ACV-22 | `status: approved` im Frontmatter; „Vertragsstatus: FINAL“ im Body | Kein Status im Contract | `METADATA_SCHEMA` (strict); `STATUS_ASSERTION`-Lint rot | P, CC | PREVENTED (Lint heuristisch) |
| ACV-23 | Body begründet Entscheidungen mit „laut ChatGPT-Review im Chat“ oder Chat-URL | Keine Chat-Dependency | `CHAT_REFERENCE`-Lint rot; Rollenvorlage: Begründungen nur per SHA/PR | CC, R | PREVENTED (heuristisch) |
| ACV-24 | Blob mit ungültigem UTF-8 (`0xFF`), dritter Blob mit U+FFFD, gleicher `contentHash` (DRT-27) | Verschiedene Bytes ≠ gleiche Identität | Fatal-Dekodierung → `CONTRACT_NOT_UTF8`; nur dekodierbare Blobs bekommen ein Tripel; Approval nennt `contract_blob` | CC | PREVENTED |
| ACV-25 | CRLF (Windows-Checkout ohne `.gitattributes`), BOM | Gleiche Bytes überall | `CARRIAGE_RETURN`/`BOM` (bestehend); O-01 setzt `.gitattributes` `* text=auto eol=lf` für `forge/**` | P, RS | PREVENTED |
| ACV-26 | Bidi-Override oder NUL in der Prosa, damit ein Agent etwas anderes liest als der Reviewer sieht | Keine unsichtbaren Steuerzeichen | `FORBIDDEN_CHARACTER` | P | PREVENTED |
| ACV-27 | `requiredChecks: [{"name":"test","command":"npm tеst"}]` (kyrillisches е) oder `"true"` | Nur erlaubte Checks | `CHECK_NOT_ALLOWED` (exakter String-Vergleich mit Policy) | CC | PREVENTED |
| ACV-28 | Scope enthält `forge/Contracts/TASK-0001.md` oder `Src/Forge/state.ts` (Case-Variante, DRT-23) | Geschützte Pfade casefold | `METADATA_SCHEMA` (K-01 casefold-Präfixe) | P | PREVENTED |
| ACV-29 | Mutant, dessen `before` an `specifiedAgainst` 0- oder 2-mal vorkommt; Mutant in `tests/`; Mutant `return x` → `return` (Syntaxfehler) | Mutanten müssen anwendbar und nicht trivial sein | `MUTANT_NOT_APPLICABLE` (CC, nur `scope.modify`); `METADATA_SCHEMA` (`file` nicht unter `src/`); Syntaxfehler → `MUTATION_EVIDENCE_INVALID` im Verifier (VD §9.3) | P, CC, V | PREVENTED / DETECTED |
| ACV-30 | 1 MB Contract, 500 Scope-Einträge, 50 Mutanten | Größenlimits | `CONTRACT_TOO_LARGE`, `METADATA_SCHEMA` (≤32 Pfade, ≤8 Mutanten) | P | PREVENTED |
| ACV-31 | Developer hält `maxProductionLines` durch Einzeiler-Kompression ein | Limit ist ehrlich | Mechanisch nicht erkennbar; Code-Review-Vorlage nennt es; `SIZE_EXCEEDED` fängt nur die ehrliche Überschreitung | R | TRUST |
| ACV-32 | Developer ändert `forge/contracts/<TASK>.md` oder `forge/policy.json` im Run-PR | Contracts sind im Run unantastbar | `PROTECTED_PATH_CHANGED` (Verifier), `SCOPE_VIOLATION` (Kern), CODEOWNERS | V, K, RS | PREVENTED |
| ACV-33 | Developer schreibt Quittung ab (Werte aus dem Handoff), ohne den Blob zu lesen | Quittung beweist Werkzeug-Lektüre | `line_count`/`heading_count`/`end_marker` stehen nicht im Handoff und sind nur aus dem Blob zu bekommen; ein Agent, der sie trotzdem rät, scheitert hinten an Verifier/Review | RG, V, R | TRUST (bewusst, §8.2) |
| ACV-34 | Spec-Autor reviewt eigenen Contract über zweiten Login; Developer ist Architektur-Reviewer des eigenen Contracts (E-14) | Rollen getrennt | `forge-approval`: Reviewer ≠ Autor nach Policy-Identität (Provider-Regel); Run-Gate: `DEVELOPER_APPROVED_OWN_CONTRACT`; Logins/Rollen nur aus `policy.json` | CC, RG | PREVENTED (soweit Logins ehrlich zugeordnet sind) |
| ACV-35 | Format-2-`TASK-0004.md` v2 ohne `supersedes.format: "legacy"` (stille Migration) | Migration ist explizit | `LEGACY_CONTRACT_HISTORY` (Pfad hat Nicht-Format-2-Blob in der Historie, kein Legacy-Supersedes) | CC | PREVENTED |
| ACV-36 | Legacy-Migration nennt falschen Legacy-Blob (z. B. TASK-0005 v1 statt v2) | Migration bindet den wirklichen Vorgänger | `LEGACY_BLOB_MISMATCH` gegen `git log --first-parent main -- <pfad>` bzw. Owner-Attestation `/forge legacy-blob` | CC | PREVENTED |
| ACV-37 | Sidecar `TASK-0006.v2.md` oder Umbenennung im Contract-PR | Ein Pfad | `CONTRACT_PR_NOT_ISOLATED` (Pfad ≠ `forge/contracts/<taskId>.md`), `METADATA_SCHEMA` (`taskId` ≠ Dateiname) | CC | PREVENTED |
| ACV-38 | Developer pusht `refs/replace/*`, um Ancestry zu fälschen (DRT-18) | Ehrliche Kanten | Git-Snapshot aus `main` mit `GIT_NO_REPLACE_OBJECTS=1`, kein Mirror-Klon, `REPLACE_REFS_PRESENT` rot (P-01) | RG, V | PREVENTED (P-01 vorausgesetzt) |
| ACV-39 | Zwei Revisionen desselben Tasks am selben `C` (DRT-03/X33) | Ein Commit, ein Inhalt | Unmöglich am selben Pfad; Kern zusätzlich `CONTRACT_COMMIT_REUSED` (K-05 (6)) | K | PREVENTED |
| ACV-40 | `title` im Contract weicht vom Thread-/Chat-Titel ab und wird nachträglich „korrigiert“ | Titel ist Contract-Inhalt | Titeländerung ist eine Revision wie jede andere (`textual`/`metadata-only`), nie ein Edit | CC | PREVENTED |

Zusammenfassung: 34 von 40 PREVENTED, 3 DETECTED vor Wirkung, 3 TRUST mit benannter Rückfanglinie (ACV-03, ACV-31, ACV-33). Die drei TRUST-Fälle sind alle Varianten von „ein Mensch oder Agent behauptet, etwas beachtet zu haben“; mehr als Sichtbarmachung plus Verifikation gegen den Blob ist dort nicht ehrlich zu versprechen.

---

## 10. Migration Rules

### 10.1 Grundsatz (Antwort auf Frage 10)

Nichts an `forge/contracts/TASK-0004.md` (Blob `334fe6fe…`) oder `forge/contracts/TASK-0005.md` (Blob `1e6f36e5…` auf dem Branch) wird je editiert, umbenannt oder gelöscht. Eine Migration ist **immer**:

1. eine neue Revision am selben Pfad im Format 2 mit `supersedes = {contractVersion: <letzte Legacy-Version>, contentHash: null, blobSha: <Legacy-Blob>, format: "legacy"}`,
2. mit Pflichtabschnitt `## Migration aus Legacy`, der mindestens enthält: Legacy-Blob und -Commit, ob der Body byteidentisch übernommen wurde (Diff-Beschreibung), welche Statuszeilen entfernt wurden, welche Reviews der Legacy-Version existieren (mit Commit/Blob), ob eine Implementation existiert (Commit) und was mit ihr geschieht,
3. mit **neuem** Architektur-Review (neue Bytes = neues Review, D-13/S-09); der Reviewer darf seine blob-gebundene Legacy-Review als Eingabe nennen, nicht als Ersatz,
4. gekennzeichnet im PR-Titel `MIGRATE <TASK> v<n>`; der Check zeigt `migration` als Revisionsklasse,
5. mit `findings[]` für jede blocking ID, die sich aus den Legacy-Reviews ableiten lässt. Legacy-Reviews haben keine Review-Blöcke; die IDs werden **einmalig** vom Owner vergeben (`/forge legacy-findings <TASK> B1,J1,…` auf dem Migrations-PR) und dann wie normale IDs behandelt.

Ohne 1. und 2.: `LEGACY_CONTRACT_HISTORY`, der Task bleibt nicht Forge-managed (Hardening D-13). Das ist das „nicht stillschweigend“: Entweder die Migration ist als solche benannt, oder sie findet nicht statt.

### 10.2 TASK-0004

Fakten: Contract v1 YAML `6a8c0c5`/`334fe6fe…` auf `main`; `status: approved` ohne Approval-Record; Implementation `e9cb8e2` (Parent = `6a8c0c5`, genau die sechs Scope-Dateien), M1-Fix `1de7efe`, beides in der Baseline `0dfd903` und damit in `main`. TASK-0005 baut darauf.

Optionen:

| Option | Was passiert | Kosten | Empfehlung |
|---|---|---|---|
| **A: Einfrieren** | Keine Migration. TASK-0004 ist Baseline-Provenienz (`BASELINE-STATUS.md` nennt es bereits als „historical YAML metadata“). Künftige Tasks binden den Code über `specifiedAgainst` und `dependencies[].provenance: "legacy"` mit `acceptedCommit: 1de7efe…` (oder `e9cb8e2…`) | keine; TASK-0004 kann nie Forge-managed werden, braucht es aber nicht (fertig) | **ja** |
| B: Retro-Binding | Migrations-Revision v2 (Format 2, Body identisch, `scope` = die sechs Dateien, `specifiedAgainst: 5bfa5a4…`), neues Review, dann ein „Run“ ohne Code-Änderung, der `e9cb8e2` als Ergebnis quittiert | Review-Aufwand; Run-Gate kann `e9cb8e2` nicht als Run-PR binden (ist schon in `main`); es bräuchte einen Sonderpfad | nein |
| C: Neu implementieren | Migration + echter Run | zweiter konkurrierender Stand (Handoff-Audit B6) | nein |

### 10.3 TASK-0005

Fakten: v1 `fc01e4a`/`b56b5f69…` REQUEST_CHANGES (B1, J1 blocking; N1–N5 minor; O1–O6) in `8357672`; v2 `0453f85`/`1e6f36e5…` APPROVE blob-gebunden in `be40a68` (nur auf `claude/forge-architecture-review-hjdq89`); v1-Review auf `main` unter `forge/reviews/TASK-0005.architecture-review.md`; v2-Review nicht auf `main`; Body v2 §18 enthält fünf Statuszeilen; keine Implementation.

Empfohlener Weg, **nur wenn** TASK-0005 implementiert werden soll (Seb hat TASK-0006 Accusation & Verdict als ersten echten Forge-Task vorgesehen; TASK-0005 kann warten):

1. Migrations-PR `MIGRATE TASK-0005 v3`: Pfad `forge/contracts/TASK-0005.md` (auf `main` neu, weil v1/v2 nur auf dem Branch liegen), `contractVersion: 3`, `supersedes: {2, null, "1e6f36e5…", "legacy"}`; Legacy-Blob ist nicht in der `main`-Historie → Owner attestiert `/forge legacy-blob 1e6f36e5…`.
2. Body = v2-Body **ohne** YAML-Kopf, ohne §18-Statuszeilen (die bleiben im Abschnitt „Migration aus Legacy“ zitiert), plus Format-2-Frontmatter: `specifiedAgainst` = ein `main`-Commit ⊒ `1de7efe` (z. B. `3d7545d`), `dependencies: [{TASK-0004, 1de7efe…, legacy}]`, `reads: [src/domain/npc-knowledge.projection.ts, src/domain/npc-knowledge.ts, …]` aus §2, `scope.create` = die fünf Dateien aus §3, `mutants` aus §16 (die 15 Prosa-Mutanten werden auf ≤8 konkrete `before/after`-Paare reduziert, Rest bleibt Prosa), `limits.maxProductionLines: 550`, End-Marker `v3`.
3. `findings`: `F-TASK-0005-L-1` (B1) und `F-TASK-0005-L-2` (J1), vom Owner per `/forge legacy-findings` vergeben, mit `where` auf §9 bzw. §10 (die v2-Review-Tabelle belegt die Auflösung).
4. Neues Review durch den zugewiesenen Reviewer (Claude, weil Claude die Legacy-Reviews schrieb; Codex ist Autor). Das v2-APPROVE ist Eingabe, nicht Ersatz.

Alternative: nicht migrieren, TASK-0005 bleibt „nicht integrierte Arbeit“ (Run Recovery SD-07), bis es dran ist. Das ist die Default-Empfehlung (OD-D).

### 10.4 Die vier Core-Contracts (Format 1)

`FORGE-CORE-0001A.md`, `-0001B.md`, `-0001A-PATCH-0001.md`, `-0001B.v2.md` bleiben byteidentisch. Sie werden nicht nach Format 2 migriert; die Tasks sind abgeschlossen (Baseline). `FORGE-CORE-0001B.v2.md` bleibt als Sidecar Geschichte; neue Forge-Core-Tasks bekommen neue IDs (`FORGE-CORE-0002` …) im Format 2. Der Parser akzeptiert Format 1 weiterhin **nur lesend** (Dogfood-Tests), der Contract-Check verlangt für neue PRs Format 2 (`FORMAT_NOT_CURRENT`).

### 10.5 `forge/approvals/*.json`

Bleiben Geschichte, werden nie gelesen, bleiben verboten im Run-Diff. Kein neues Approval-JSON wird je geschrieben; Approvals sind GitHub-Reviews (§5).

---

## 11. Two Implementation Tasks

Beide Tasks sind Vorlagen für Contracts im Format 2 (nicht selbst Contracts). Zeilenangaben sind Produktionszeilen inkl. Kommentare/Leerzeilen, Tests ausgenommen. Beide laufen in V0.1 als Bootstrap-PRs (D-10): Autor ≠ Reviewer, Merge durch Seb.

### 11.1 FORGE-CORE-0002 — Contract Format 2 im Kern

| Feld | Inhalt |
|---|---|
| **Ziel** | Der Kern parst Format 2, kennt `supersedes`, Findings mit IDs, Carry-Forward und `runBase`; Format 1 bleibt lesbar. Keine neuen Zustände, keine neuen Event-Typen (D-3). |
| **specifiedAgainst** | `3d7545d843883418348004e68717399a64da7a7d` (`main`) |
| **reads** | `src/forge/contract-document.ts`, `src/forge/primitives.ts`, `src/forge/state.ts`, `src/forge/start-gate.ts`, `src/forge/events.ts`, `src/forge/verification.ts`, `src/forge/runs.ts` |
| **scope.modify** | `src/forge/contract-document.ts`, `src/forge/primitives.ts`, `src/forge/state.ts`, `src/forge/start-gate.ts`, `src/forge/events.ts`, `src/forge/verification.ts`, `tests/forge/contract-document.test.ts`, `tests/forge/state.test.ts`, `tests/forge/start-gate.test.ts`, `tests/forge/fixtures.ts`, `tests/forge/run-fixtures.ts`, `tests/forge/dogfood.test.ts`, `tests/forge/kernel.test.ts`, `tests/forge/scenarios.test.ts`, `tests/forge/review-acceptance.test.ts`, `tests/forge-red-team/model.ts`, `tests/forge-red-team/findings.test.ts`, `tests/forge-red-team/differential.test.ts` |
| **scope.create** | `tests/forge/contract-v2.test.ts` |
| **Erwartete Produktionszeilen** | 200–260 (contract-document ~120, primitives ~15, state ~60, start-gate ~20, events ~10, verification ~10) |
| **Acceptance-Idee** | (1) `ContractMetadataSchema` = Union Format 1 (unverändert) \| Format 2 nach §3.3 (alle P-Regeln: Supersedes-Form, `reads ∩ create = ∅`, Mutanten-Form und Grenzen, `limits`, `findings`-Form, geschützte Präfixe casefold wie K-01, Listenlimits). (2) Neue Issue-Codes `END_MARKER_MISSING \| END_MARKER_MISMATCH \| END_MARKER_DUPLICATE \| NO_TRAILING_NEWLINE \| FORBIDDEN_CHARACTER \| CONTRACT_TOO_LARGE \| SECTION_MISSING \| FINDING_ANCHOR_MISSING` als Stufe 1b/5 (Marker/Anker nach Schema; Zeichen/Größe mit Stufe 1). Für Format 1 werden Marker- und Abschnittsregeln **nicht** angewendet (die vier Core-Contracts müssen weiter parsen; Dogfood-Test bleibt grün). (3) `FindingSchema` erhält `id: ^F-[A-Z][A-Z0-9]*(-[A-Z0-9]+)+-[0-9]+-[0-9]+$`; `approval_recorded`/`code_review_recorded` lehnen doppelte IDs innerhalb eines Events ab (`FINDING_ID_DUPLICATE`). (4) `contract_registered`: v(n+1).supersedes muss `{n, contentHash(v(n)), blobSha beliebig (nicht geprüft, Kern kennt keine Blobs), format 2}` sein → `CONTRACT_SUPERSEDES_MISMATCH`; erste Registrierung mit `contractVersion > 1` nur bei `supersedes.format === "legacy"`; `CONTRACT_REVISION_NO_CHANGE` (Body nach `---\n` und Metadaten ohne `contractVersion/supersedes/findings` deep-equal zu v(n)); `FINDINGS_NOT_CARRIED` (offene blocking IDs aus `decisions` aller Vorrevisionen mit `changes_requested` und aus `verdict.findings` von Runs mit `requires: contract_change`, abzüglich in gemergten Revisionen als `resolved` getragener und per `withdrawn` zurückgenommener); `FINDING_UNKNOWN`; `CONTRACT_COMMIT_REUSED`; Registrierung in Task-Zustand `implementing` → `RUN_ACTIVE`, in `awaiting_review`/`review_approved` → `TASK_STATE_INVALID` (K-05 (4)/(6), hier übernommen). (5) `approval_recorded` erhält optionales `withdrawn: FindingId[]`, nur bei `verdict: approved`, nur IDs offener blocking Findings des Tasks (`FINDING_UNKNOWN`), nur durch denselben Reviewer, der sie schrieb (`WITHDRAW_NOT_AUTHOR`). (6) `StartRequest` erhält `runBase: CommitSha`; Gate: `contractAtCommit.commit === runBase` (statt `=== contractCommit`), `isAncestorOrSelf(contractCommit, runBase)` sonst `CONTRACT_NOT_IN_RUN_BASE`, `runBase` von Refs erreichbar sonst `RUN_BASE_NOT_PERSISTED`, `startFromCommit = runBase`; `BASE_NOT_IN_CONTRACT_HISTORY` prüft `specifiedAgainst ⊑ contractCommit` (Format 1: `baseCommit`). (7) `effectiveMutations`/`mutationFailures`: Format 2 ⇒ Pflicht genau dann, wenn `mutants.length > 0`; Developer-Mutationen zählen bei Format 2 nie (`source` nur `verifier` oder `none`); Format 1 unverändert. (8) `remoteOutcome` verlangt weiterhin `startedFromCommit ⊑ claimedResultCommit` (jetzt `runBase`). |
| **Mutanten (Pflicht, Auswahl)** | Marker-Prüfung entfernt; `supersedes.contentHash`-Vergleich entfernt; `CONTRACT_REVISION_NO_CHANGE` vergleicht nur Body; `FINDINGS_NOT_CARRIED` ignoriert Code-Review-Findings; `withdrawn` ohne Autorprüfung; `runBase`-Ancestry entfernt; `startFromCommit` wieder `contractCommit`; Format-2-Mutanten mit `report.mutations` gewertet; `FORBIDDEN_CHARACTER` nur für U+0000 |
| **Non-Goals** | Blob-SHA im Kern (kein SHA-1-Port, S-08), Legacy-Blob-Prüfung (Check), Reviewer-Zuweisung (D-5, Check), Git-Zugriff, persistierter Log, neue Zustände, YAML, Migration der Core-Contracts, `protectedPathOverrides`, Lints (`STATUS_ASSERTION`, `CHAT_REFERENCE`, `READS_INCOMPLETE`: Check-Ebene), Verifier-Mutantenausführung (K-04/P-06) |
| **Überschneidungen** | Ersetzt den Schema-Teil von K-04 (Mutantenliste im Contract) und die Contract-Regeln (4)/(5)/(6) aus K-05; K-05 behält Owner-/Observer-/Verifier-Rollenregeln und `RUN_ID_NOT_DERIVED`. Reihenfolge: FORGE-CORE-0002 vor K-05 mergen (beide berühren `state.ts`). |

### 11.2 FORGE-PLAT-0001 — Contract-Check über Git-Fakten und Quittungs-/Review-Blöcke

| Feld | Inhalt |
|---|---|
| **Ziel** | Eine reine Funktion `checkContractPr(repoDir, prFacts, policy) → CheckResult` plus Block-Parser, ausführbar als Skript im Workflow `forge` (Contract-Pipeline). Sie liefert den Zustand „grün/rot mit Codes“ und die Markdown-Summary (Tripel, Revisionsklasse, Findings-Carry-Forward, „wartet auf“). Keine GitHub-Schreibzugriffe. |
| **specifiedAgainst** | `main` nach Merge von FORGE-CORE-0002 |
| **dependencies** | FORGE-CORE-0002 (`provenance: forge`), P-01 Git-Snapshot (falls vorhanden; sonst siehe Scope) |
| **reads** | `src/forge/contract-document.ts`, `src/forge/kernel.ts`, `src/forge-github/git-snapshot.ts` (falls P-01 gemergt), `forge/policy.json` (falls P-02 gemergt) |
| **scope.create** | `src/forge-github/contract-check.ts`, `src/forge-github/blocks.ts` (Quittung + Review-Block: Format, Parse, Vergleich), `src/forge-github/pr-facts.ts` (Schema der PR-Fakten-JSON: Nummer, Autor, Head/Base-SHA, Dateiliste mit Status, Reviews mit `commit_id`/`state`/`body`/Login, Kommentare mit Login/Body; wird vom Workflow-Schritt per `gh api` erzeugt, nicht vom Modul geholt), `scripts/forge-contract-check.ts`, `tests/forge-github/contract-check.test.ts`, `tests/forge-github/blocks.test.ts` (Wegwerf-Repos mit `git`-Binary, PR-Fakten als Fixtures) |
| **Erwartete Produktionszeilen** | 280–360 (contract-check ~200, blocks ~80, pr-facts ~40, script ~30). Falls P-01 fehlt: zusätzlich `src/forge-github/git-exec.ts` ≤ 60 Zeilen (feste Umgebung `GIT_NO_REPLACE_OBJECTS=1`, `--`-Trennung, `execFile` ohne Shell); dann 340–400, hart gedeckelt auf 400, notfalls `pr-facts.ts` als reines Zod-Schema ohne Helfer |
| **Acceptance-Idee** | Grün genau dann, wenn in dieser Reihenfolge nichts rot ist: (1) PR-Base = `main`, Head im selben Repo, Autor hat Rolle `spec_author` (Policy). (2) Dateiliste = genau `forge/contracts/<TASK>.md` (`added`/`modified`), `CONTRACT_PR_NOT_ISOLATED`; jeder Commit in `base..head` ein Parent und nur diese Datei (I3). (3) Blob am Head fatal dekodiert (`CONTRACT_NOT_UTF8`), `parseContractDocument` ok, `forgeContractFormat === 2` (`FORMAT_NOT_CURRENT`), `taskId` = Dateiname. (4) Historie: `git log --first-parent main -- <pfad>` → Liste der Registrierungs-Merges; jeder Blob darin parst Format 2, sonst Legacy-Historie; `contractVersion` = Länge + 1 (`CONTRACT_VERSION_NOT_NEXT`); `supersedes` = Tripel des jüngsten Blobs (`CONTRACT_SUPERSEDES_MISMATCH`); Legacy nur mit `supersedes.format: "legacy"` und `blobSha` in der Historie oder Owner-Kommentar `/forge legacy-blob <sha>` (`LEGACY_CONTRACT_HISTORY`, `LEGACY_BLOB_MISMATCH`); bei v>1 Revisionsklasse `metadata-only`/`textual`/`migration` und `CONTRACT_REVISION_NO_CHANGE`. (5) `specifiedAgainst` auf First-Parent-Kette von `main` (`SPEC_BASE_NOT_ON_MAIN`); `reads` existieren dort (`READS_NOT_FOUND`); Dependencies: `forge` → Merge-Commit eines gemergten Run-PR (`forge/run/<dep>-<n>`) auf der Kette und `⊑ specifiedAgainst` (`DEPENDENCY_NOT_MERGED`), `legacy` → `⊑ specifiedAgainst` (`DEPENDENCY_NOT_IN_SPEC_BASE`). (6) `requiredChecks` ⊆ `policy.allowedChecks` exakt (`CHECK_NOT_ALLOWED`); Mutanten auf `scope.modify`: `before` an `specifiedAgainst` genau einmal (`MUTANT_NOT_APPLICABLE`). (7) Lints `STATUS_ASSERTION`, `CHAT_REFERENCE`, `READS_INCOMPLETE` (Regeln §3.3), aufhebbar nur per Owner-Kommentar `/forge lint-waive <code>` (Login = `policy.ownerLogin`). (8) Findings: alle `FORGE REVIEW v1`-Blöcke aus Reviews aller PRs des Pfads (PR-Fakten-JSON liefert sie, Liste vom Workflow über `gh pr list --search path:`), offene blocking IDs berechnen, `FINDINGS_NOT_CARRIED`/`FINDING_UNKNOWN`. (9) Kein offener Run-PR des Tasks (`RUN_ACTIVE`), kein zweiter offener Contract-PR (`CONTRACT_PR_DUPLICATE`), `FORGE_HALT` nicht gesetzt. (10) Kernel-Replay der synthetisierten Historie + dieser Revision muss `ok` sein (Konsistenzprobe; Rejection-Code wird durchgereicht). — **Blöcke**: `formatReceipt/parseReceipt` (`FORGE READ RECEIPT v2`, §8.1), `formatReview/parseReview` (`FORGE REVIEW v1`, §5.1), `compareReceipt(receipt, computed) → mismatching field names`. — **Summary**: Tripel, `M`-Kandidat (= Head), Revisionsklasse, Diff-Felder, Carry-Forward-Tabelle (ID, Anker, „Abschnitt geändert: ja/nein“), zugewiesener Reviewer (erster `architecture_reviewer`-Login mit Review auf einem PR des Pfads, oder jüngster Owner-Kommentar `/forge reviewer architecture <login>`), „wartet auf“. |
| **Mutanten (Pflicht, Auswahl)** | Linearitätsprüfung I3 entfernt; `supersedes`-Vergleich gegen Branch statt `main`; Legacy ohne Owner-Attestation akzeptiert; `CHECK_NOT_ALLOWED` vergleicht nur Namen; Findings aus geschlossenen PRs ignoriert; `READS_INCOMPLETE` ignoriert `scope.modify`; Quittungsvergleich lässt `end_marker` aus; `/forge lint-waive` von Nicht-Owner akzeptiert |
| **Non-Goals** | `forge-approval`-Check (zugewiesener Reviewer als Required Check: Rest von P-03), Run-Gate (P-05; benutzt `blocks.ts`), Handoff-Posting (P-04), Workflow-YAML (P-03/O-02), GitHub-API-Client (PR-Fakten kommen als JSON), Status-Issue (S-01), Verifier (P-06), Migration selbst (Owner-Arbeit nach §10) |
| **Überschneidungen** | Ersetzt die Contract-Pipeline-Hälfte von P-03 und `receipt.ts` aus P-04; P-03 behält `forge-approval`, P-04 behält Handoff und Rollenvorlagen (jetzt mit Handoff v2 und Quittung v2 nach §7.1/§8.1). |

### 11.3 Was danach noch fehlt (nicht Teil der zwei Tasks)

Run-Gate mit `runBase`-Regeln und Quittungsvergleich (P-05, nutzt `blocks.ts` und `canStartDeveloperRun` mit `runBase`), Verifier mit `limits`-Zählung und Contract-Mutanten (P-06/K-04-Rest), Rollenvorlagen (P-04), Rulesets inkl. `.gitattributes` (O-01), Legacy-Attestations-Kommandos (`/forge legacy-blob`, `/forge legacy-findings`; S-15).

---

## 12. Open Decisions

| ID | Frage | Optionen | Empfehlung |
|---|---|---|---|
| OD-A | `limits.maxProductionLines`: harter Verifier-Fehler oder nur Summary-Warnung? | hart (`SIZE_EXCEEDED`, Run rot; Erhöhung nur per Revision) / weich (Warnung, Reviewer entscheidet) | **hart**; die Pilot-Contracts sagen „Überschreitung begründen“, was nie geprüft wurde. Eine Revision kostet einen Review-Durchlauf und macht die Begründung sichtbar |
| OD-B | `SPEC_STALE`: immer neue Revision, oder Owner-Waiver `/forge waive-stale <sha>`? | Revision / Waiver | **Revision** in V0.1 (einfacher, ein Mechanismus). Waiver als S-Task, wenn Revisionen wegen trivialer Dateiänderungen (Kommentare) häufig werden |
| OD-C | TASK-0004: einfrieren (A) oder retro-binden (B)? | §10.2 | **A** |
| OD-D | TASK-0005: jetzt als v3 migrieren oder liegen lassen bis zur Implementation? | §10.3 | **liegen lassen**; erst migrieren, wenn es der nächste Task nach TASK-0006 ist |
| OD-E | Legacy-Dependencies (`provenance: "legacy"`) erlauben oder nur `specifiedAgainst` + Prosa? | erlauben / verbieten | **erlauben**; macht TASK-0001…0005 als Dependency sichtbar statt `dependencies: []` |
| OD-F | Wer darf ein blocking Finding zurückziehen? | nur der Reviewer, der es schrieb / auch Owner | **nur Reviewer**; Owner kann den Reviewer wechseln (`/forge reviewer`), der neue kann es dann zurückziehen; das bleibt im PR sichtbar |
| OD-G | Pflichtabschnitte: `Acceptance Criteria`, `Non-Goals` (+ `Änderungen gegenüber v<n>`, `Migration aus Legacy`) ausreichend, oder zusätzlich `Testmatrix`, `Mutanten`? | – | **so lassen**; Mutanten sind maschinell, Testmatrix ist Reviewer-Sache |
| OD-H | `reads` Pflichtfeld (≥1) oder optional? | – | **optional, aber `READS_INCOMPLETE`-Lint**; ein Task ohne jede Code-Dependency (reines neues Modul) hat ehrlich `reads: []` |
| OD-I | Format 2 als neue Literal-Nummer oder Format 1 additiv erweitern? | – | **Format 2**; `baseCommit` → `specifiedAgainst` und `mutationSmoke` → `mutants` sind keine Erweiterungen, sondern Bedeutungsänderungen |
| OD-J | Darf der Developer der Spec-Autor sein (Codex schreibt und implementiert)? | ja / nein | **ja**, solange Architektur-Reviewer ≠ beiden und Code-Reviewer ≠ Developer; die Unabhängigkeit liegt bei den Reviewern (Pilot: Codex spezifiziert, Claude implementiert, ist aber nicht erzwungen) |
| OD-K | Reviewer-Findings-Block in Deutsch oder Englisch? Feldnamen sind englisch, Summary-Text frei | – | Feldnamen fest (englisch), Freitext frei |
| OD-L | Task-ID des ersten Format-2-Contracts (TASK-0006?) und ob FORGE-CORE-0002 vor oder nach O-01/O-02 läuft | – | FORGE-CORE-0002 sofort als Bootstrap-PR (keine Plattformabhängigkeit); FORGE-PLAT-0001 nach O-02 |

---

### Anhang A: Antworten auf die zehn Fragen in Kurzform

1. **Neue Version:** neuer Branch von `main`, nur die Datei, `contractVersion+1`, `supersedes` = Tripel der `main`-Revision, `findings[]` für offene IDs, Pflichtabschnitt „Änderungen“, End-Marker; Merge = Version (§4.1).
2. **Neues Architecture Review:** immer; Aufwand wird über die Revisionsklasse gesteuert, nicht die Pflicht (§4.4).
3. **Alte Blocking Findings:** IDs aus Review-Blöcken aller PRs des Pfads; offene IDs müssen in `findings[]` mit Anker stehen; nur der Reviewer zieht zurück (§6).
4. **Versionsnummer ohne Fix:** `CONTRACT_REVISION_NO_CHANGE` + `FINDINGS_NOT_CARRIED` + zugewiesener Reviewer + Carry-Forward über geschlossene PRs (§4.5).
5. **Run bindet eine Version:** Branch-Name, `runBase ⊒ M`, Blob-Gleichheit an `runBase`, Quittung, Kern-Gate mit `runBase`; jeder Push neu (§7.2).
6. **Contract-Base vs. Run-Base:** `specifiedAgainst` im Contract (gelesener Stand), `runBase` als Run-Fakt (Startpunkt); `SPEC_STALE` über `reads ∪ scope.modify` (§7.3).
7. **Maschinenlesbar:** Frontmatter-Felder §3.3, End-Marker, zwei Pflichtanker, Quittung, Review-Block, Handoff (§3.5).
8. **Nur Markdown:** Spezifikation, AC-Tabelle, Non-Goals, Testmatrix, Dependency-Prosa, Begründungen (§3.6).
9. **Abgeschnittene Dateien:** Marker als letzte Zeile (genau einmal, versioniert), Blob/Bytes, `contentHash`, Quittung mit `line_count`/`heading_count`/`end_marker` (§8.3).
10. **Nicht stillschweigend migrieren:** nur per `supersedes.format: "legacy"` + Legacy-Blob + Pflichtabschnitt + neues Review; sonst `LEGACY_CONTRACT_HISTORY`; TASK-0004 einfrieren, TASK-0005 bei Bedarf als v3 (§10).

### Anhang B: Fehlercodes dieses Entwurfs (neu gegenüber `main`)

Parser: `END_MARKER_MISSING`, `END_MARKER_MISMATCH`, `END_MARKER_DUPLICATE`, `NO_TRAILING_NEWLINE`, `FORBIDDEN_CHARACTER`, `CONTRACT_TOO_LARGE`, `SECTION_MISSING`, `FINDING_ANCHOR_MISSING`.
Kern: `CONTRACT_SUPERSEDES_MISMATCH`, `CONTRACT_REVISION_NO_CHANGE`, `FINDINGS_NOT_CARRIED`, `FINDING_UNKNOWN`, `FINDING_ID_DUPLICATE`, `WITHDRAW_NOT_AUTHOR`, `CONTRACT_COMMIT_REUSED`, `RUN_ACTIVE`, `CONTRACT_NOT_IN_RUN_BASE`, `RUN_BASE_NOT_PERSISTED`.
Contract-Check: `FORMAT_NOT_CURRENT`, `CONTRACT_PR_NOT_ISOLATED`, `CONTRACT_COMMIT_NOT_LINEAR`, `CONTRACT_COMMIT_NOT_ISOLATED`, `CONTRACT_NOT_UTF8`, `LEGACY_CONTRACT_HISTORY`, `LEGACY_BLOB_MISMATCH`, `SPEC_BASE_NOT_ON_MAIN`, `READS_NOT_FOUND`, `READS_INCOMPLETE`, `DEPENDENCY_NOT_MERGED`, `DEPENDENCY_NOT_IN_SPEC_BASE`, `CHECK_NOT_ALLOWED`, `MUTANT_NOT_APPLICABLE`, `STATUS_ASSERTION`, `CHAT_REFERENCE`, `CONTRACT_PR_DUPLICATE`, `REVIEWER_NOT_ASSIGNED`, `REVIEW_BLOCK_MISMATCH`.
Run-Gate/Verifier: `WRONG_BASE`, `REGISTRATION_TREE_MISMATCH`, `CONTRACT_SUPERSEDED`, `SPEC_STALE`, `DEPENDENCY_REVERTED`, `RECEIPT_MISSING`, `RECEIPT_INVALID`, `RECEIPT_MISMATCH`, `RUN_NUMBER_NOT_NEXT`, `DEVELOPER_APPROVED_OWN_CONTRACT`, `SIZE_EXCEEDED`, `PROTECTED_PATH_CHANGED`.

STOP.
