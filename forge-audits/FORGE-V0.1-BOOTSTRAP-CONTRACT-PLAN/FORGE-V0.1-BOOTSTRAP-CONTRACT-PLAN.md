# FORGE V0.1 BOOTSTRAP CONTRACT PLAN

Stand: 2026-10-04, ca. 07:30 UTC. Rolle: Principal Software Architect + Contract/Release Engineer.
Modus: **strikt read-only.** Kein Commit, kein Branch, kein PR, kein Review, keine Einstellung wurde angefasst.

**Geprüfte Basis (selbst verifiziert, nicht aus Memory übernommen):**

| Fakt | Wert | Beleg |
|---|---|---|
| `main` | `3d7545d843883418348004e68717399a64da7a7d` („Merge pull request #1 …/codex/forge-core-v2-repair“) | `git fetch` + `git log` |
| Tests auf `main` | 22 Dateien, **1087 passed** | `npx vitest run`, lokal |
| Contract-Parser | nur `forgeContractFormat: z.literal(1)`, Hash-Präfix `forge-contract-v1\n` | `src/forge/contract-document.ts:12,26` |
| Workflows | **0** | GitHub API `list_workflows` → `total_count: 0` |
| PRs | #1 geschlossen (Baseline, Merge-Commit `3d7545d` auf `main`), #2 offen/Draft (Identity Spike, Autor `forge-codex` id 337272506, Head `8dc692b`) | GitHub API |
| Rulesets / Actions-Policy | **nicht lesbar** von dieser Session (UNVERIFIED) | — |
| VERIFIER-0001 Draft | contentHash `341ec9839fb04ab01fae3b91d4e9e531295c727c0e0a37a15cac978b8b044299` (heute nachgerechnet: `sha256("forge-contract-v1\n" ‖ bytes)`), Datei-SHA-256 `7b3e93bb823628bb9057cd2cf69a578aa824f2d04614fec250cda922b04c27e0`, 32 686 Bytes, `baseCommit` = aktueller `main` | lokal |

**Quellenlage.** Leitend ist `FORGE-V0.1-ARCHITECTURE-FREEZE.md` (FREEZE). Ergänzend `OVERNIGHT-EXECUTION-PLAN.md` (ONP) und der VERIFIER-0001-Draft. Der **Bootstrap Experimental Report**, das **OPS-0001-Paket** und der **CORE-0002-Draft** liegen weder im Repo noch in den Projektdateien: Sie werden hier als **MISSING** geführt und nicht rekonstruiert. Sebs Richtungsvorgaben aus dem Experimental Report gelten als gegeben und überschreiben FREEZE, wo sie abweichen:

| Vorgabe (Seb) | Wirkung auf FREEZE |
|---|---|
| Two-stage verifier `forge-gate` / `forge-verify` | = FREEZE §7/§8, unverändert |
| 7 Rulesets + Actions Execution Policy | ersetzt die 10 Rulesets aus FREEZE §9.1/§9.2; die 7 selbst werden hier **nicht** neu entworfen, nur ihre Funktion vorausgesetzt (s. §2.4) |
| Last-Push-Approval entfernt | löst ONP L-1 (Owner-PR-Aussperrung) |
| Delete/Force-Push bypassfrei | auch der Owner hat keinen Bypass; damit ist History-Rewrite technisch ausgeschlossen (§9) |
| Owner-Recheck über „Re-run all jobs“ | Re-Evaluation der Attestation; setzt voraus, dass `forge-gate` Reviews **live per API** liest (§6, DL-3) |
| clampAtZero als erster Drill | ersetzt FREEZE §14.3 (Parse-Report) und ONP §7 (PlayerRef/MYST-0001) als ersten Drill |

---

## 1. Actual Inventory

Status-Vokabular: **ON MAIN** · **SIDE BRANCH** · **DRAFT ONLY** · **SUPERSEDED** · **MISSING** · **BLOCKED**. Mehrfachstatus, wo nötig.

### 1.1 Contracts und Kern

| Artefakt | Status | Ort / Beleg | Bootstrap-Relevanz |
|---|---|---|---|
| FORGE-CORE-0001A | **ON MAIN** (Legacy, eingefroren) | `forge/contracts/FORGE-CORE-0001A.md`, Hash `af91442e…` | Code-Fundament (`src/forge/**`); Contract wird nie umgeschrieben |
| FORGE-CORE-0001A-PATCH-0001 | **ON MAIN** (Legacy) | `forge/contracts/FORGE-CORE-0001A-PATCH-0001.md`, `3e9125a5…` | dito |
| FORGE-CORE-0001B (v1) | **ON MAIN** (Legacy), teilweise **SUPERSEDED** durch v2 | `forge/contracts/FORGE-CORE-0001B.md`, `680db30f…` | dito |
| FORGE-CORE-0001B v2 | **ON MAIN** als Sidecar (Legacy; Sidecar-Registrierung bleibt offen und wird nicht nachgeholt) | `forge/contracts/FORGE-CORE-0001B.v2.md`, `7db0e722…` | Sidecar-Muster ist ab jetzt verboten (FREEZE W-14) |
| TASK-0004 | **ON MAIN** (YAML, für den Kern ungültig: `FRONTMATTER_MISSING`); Branch `codex/task-0004-contract` ist vollständig in `main` enthalten → **SUPERSEDED** | `forge/contracts/TASK-0004.md` | keine; Legacy-Anker `3d7545d` |
| TASK-0005 v2 | **SIDE BRANCH** `codex/mystery-task-0005` (`fab792a`) | `forge/contracts/TASK-0005.md` dort | außerhalb Bootstrap (VS-3) |
| FORGE-CORE-0002 Draft | **MISSING** → Registrierung **BLOCKED** | nicht in Repo/Projektdateien (ONP §1.3 bestätigt) | kritischer Pfad |
| FORGE-VERIFIER-0001 Draft | **DRAFT ONLY** (validiert, Hash heute reproduziert) | `/mnt/project-files/forge-audits/FORGE-VERIFIER-0001.contract.DRAFT.md` | erster Bootstrap-Contract, sofort registrierbar nach Review |
| FORGE-VERIFIER-0002 Draft | **MISSING** (nur Task-Karte FREEZE §16.2 #4) | — | kritischer Pfad |
| FORGE-VERIFIER-0003 Draft | **MISSING** (nur Task-Karte FREEZE §16.2 #6, Workflow-Skizze §7.2) | — | kritischer Pfad |
| FORGE-PLAT-0001 | **DRAFT ONLY** als Design (CSV2/FREEZE), kein Contract; nach ONP DV-1 hinter den ersten Drill verschoben | — | nur Teilmenge nötig, s. §3 |
| Drill-Contract clampAtZero | **MISSING** (`clampAtZero` existiert in `src/`/`tests/` nicht; `grep` leer) | — | §7 schneidet ihn |
| `src/forge-verifier/**`, `.github/workflows/**`, `forge/verifier/**` | **MISSING** | `ls` | entsteht durch VERIFIER-0001…0003 |

### 1.2 OPS-Artefakte

| Artefakt | Status | Bemerkung |
|---|---|---|
| Bootstrap Experimental Report | **MISSING** | Quelle der 7 Rulesets + Actions Policy; muss als Datei nach `forge/ops/` (Prozessregel „aus Git lesen“) |
| FORGE-OPS-0001 Execution Package | **MISSING** | Inhalt hier nur aus FREEZE §16.2 #1 + Seb-Vorgaben abgeleitet |
| `forge/policy.json`, `forge/roles/*.md`, `forge/ops/*.md`, `.github/CODEOWNERS`, `.gitattributes`, `.nvmrc` | **MISSING** auf allen Refs | entstehen im Owner-Bootstrap-PR (§5) |
| Rulesets / Actions-Policy live | **UNVERIFIED** (API nicht lesbar) | Owner liefert JSON-Export |
| Ruleset-Konflikte H1/H2/H3/H8 (ONP) | **MISSING**; vermutlich im Experimental Report aufgelöst | Owner bestätigt (OD-B1) |
| `forge/coordination/CLAUDE.md`, `CODEX.md` | **ON MAIN**, laut FREEZE obsolet | Löschung im Owner-Bootstrap-PR; Tests lesen die Dateien nicht (nur Pfad-Strings in `tests/forge-red-team/*`) |
| `forge/BASELINE-STATUS.md` | **ON MAIN** | Satz „eventlog is authoritative“ ist durch FREEZE W-04 überholt |

### 1.3 Historische Approvals / Reviews

| Artefakt | Status | Wert für Bootstrap |
|---|---|---|
| `forge/approvals/FORGE-CORE-0001A.v1.architecture_review.json`, `…0001B.v1…` | **ON MAIN**, **SUPERSEDED** als Freigabeform (FREEZE W-24); von KI-Session geschrieben, Basis „no line-by-line review“ | keiner; Ordner bleibt `always`-geschützt, keine neuen Dateien |
| `forge/reviews/FORGE-CORE-0001B.v2.chatgpt-review.md` (PASS auf `811ed0d`) | **ON MAIN** | historische Evidenz für den Kern-Stand; kein Forge-Approval |
| `forge/reviews/FORGE-CORE-0001AB.red-team.md`, `…v2.mutations.json`, `…v2.verification.md` | **ON MAIN** | dito |
| `forge/reviews/TASK-0005.architecture-review.md` (v1, REQUEST_CHANGES) | **ON MAIN**, **SUPERSEDED** | keiner |
| `TASK-0005.v2.architecture-review.md` (Claude, APPROVE) | **SIDE BRANCH** `claude/forge-architecture-review-hjdq89` | keiner (VS-3) |
| GitHub-Reviews auf PRs | keine | Ab Bootstrap ist jede Freigabe ein GitHub-Review von `Wuerfelduell` |
| Identity Spike PR #2 | **SIDE BRANCH**, offen/Draft; Commit-E-Mail privat (FREEZE W-28) | Beleg nach `forge/ops/IDENTITY-SPIKE.md`, PR schließen (nicht mergen) |
| `codex/forge-core-v2-repair` | **SUPERSEDED** (0 Commits vor `main`) | — |

### 1.4 Folge

Exakt **ein** Bootstrap-Contract ist heute registrierbar (VERIFIER-0001). Drei Contracts (CORE-0002, VERIFIER-0002, VERIFIER-0003) und der Drill fehlen als Text. Das ist der eigentliche kritische Pfad, nicht Code.

---

## 2. Bootstrap Boundary

### 2.1 Das Henne-Ei-Problem, präzise

`forge-gate`/`forge-verify` laufen über `pull_request_target`, also **immer mit dem Workflow von `main`**. Der PR, der den Workflow einführt, kann sich deshalb nie selbst prüfen; ebenso kein PR davor. Die Lösung ist nicht eine größere Owner-Ausnahme, sondern eine **dreistufige Grenze**, bei der der Verifier-Code selbst **nicht** per Owner-Ausnahme kommt, sondern über normale Contracts mit reviewer-repliziertem Verifier (FREEZE §16.3), und sich nach Aktivierung rückwirkend selbst prüft.

### 2.2 Die drei Zonen

| Zone | Was | Wie freigegeben | Maschinelle Prüfung |
|---|---|---|---|
| **B0 — OWNER BOOTSTRAP (einmalig)** | (a) GitHub-Einstellungen: Org/Repo, Team `forge-dev-codex`, 7 Rulesets **ohne** Required Checks, Actions **deny-all** (s. §6). (b) **genau ein** Owner-PR `forge/owner/bootstrap-0001` mit Nicht-Code-Dateien (§5.2) | Owner + zwei unabhängige externe Reviews | keine (existiert nicht) |
| **B1 — CONTRACT-GOVERNED BOOTSTRAP** | Contract-PRs und Run-PRs für VERIFIER-0001, CORE-0002, VERIFIER-0002, VERIFIER-0003; der Workflow `forge-verify.yml` kommt **hier**, als Scope von VERIFIER-0003 | Architektur-Review des Contracts, Code-Reviewer ersetzt Verifier (FREEZE §16.3), Owner attestiert und merged | Code-Reviewer führt lokal aus; kein Check auf GitHub |
| **B2 — VERIFIER ACTIVE** | Aktivierung (§6), dann Drill und alles Weitere | normaler Forge-Prozess | `forge-gate` + `forge-verify` required, strict |

### 2.3 Zuordnung (abschließend)

| Gegenstand | Zone | Begründung |
|---|---|---|
| Rulesets, Team, Repo-Settings, Actions deny-all | B0 (Einstellung) | Ohne sie ist jede spätere Bindung (Identität, Namensraum, Merge-Commit) wertlos; Einstellungen sind keine Dateien und können nicht per Contract kommen |
| `forge/policy.json` v1, `forge/roles/*.md`, `forge/ops/*.md`, `.github/CODEOWNERS`, `.gitattributes`, `.nvmrc`, Löschung `forge/coordination/*`, BASELINE-Absatz | B0 (Owner-PR) | Daten und Prosa, die der Verifier später **liest**; vorher nur Referenz für Menschen und Reviewer. Kein ausführbarer Code |
| Kopie FREEZE und Experimental Report nach `forge/ops/` | B0 (Owner-PR) | Prozessregel: Developer lesen Referenzen aus Git |
| `src/forge-verifier/**`, `tests/forge-verifier/**` | B1 | Code → Contract-Pflicht, ohne Ausnahme |
| Kernänderungen `src/forge/**` (Format 2, `isProtectedPath`, `runBase`, Wegfall `PROCESS_NOTE_PREFIX`) | B1 (CORE-0002) | Code, und Dogfood-Test verlangt Scope in einem `FORGE-CORE-*`-Contract |
| `.github/workflows/forge-verify.yml`, `forge/verifier/image.json` | B1 (VERIFIER-0003) | Workflow ist ausführbarer Code mit Repository-Rechten; gerade **nicht** Owner-Ausnahme |
| Required Checks eintragen, Actions allow-one | B2-Schwelle (Einstellung nach Smoke) | erst nach Beweis, dass die Checks laufen und grün werden |
| Drill (clampAtZero) und alle Produkt-Runs | B2 | brauchen aktiven Verifier |
| PLAT-0001 (vollständige Blockgrammatik, Findings-Carry-Forward, Provider-Matrix) | B2 | DV-1 (ONP): nicht vor dem ersten Drill nötig |

### 2.4 Was die 7 Rulesets **funktional** leisten müssen (ohne Neuentwurf)

Dieser Plan setzt nur diese Funktionen voraus. Wenn der Experimental Report eine davon nicht abdeckt, ist das ein Befund (OD-B1), kein Neuentwurf hier.

| F | Funktion | Gebraucht für |
|---|---|---|
| F-1 | PR-Pflicht auf `main`, Merge-Commit-only, **ohne** Bypass | kein Direct Push, auch nicht vom Owner |
| F-2 | nur der Owner kann `main` aktualisieren (Restrict updates + Owner-Bypass nur für diese Regel) | Codex kann nicht mergen |
| F-3 | Delete + Force-Push auf allen Branches gesperrt, **bypassfrei** | kein History-Rewrite, keine Spurvernichtung |
| F-4 | Namensräume: `forge/run/codex/**` nur `forge-codex`; `forge/contract/**`; `forge/owner/**` nur Owner; keine Streubranches; keine Tags | Identität ↔ Branch |
| F-5 | Required Checks `forge-gate` + `forge-verify`, strict — **leer bis §6 Schritt 5** | Aktivierung |
| F-6 | **Halt**: vorab angelegt, **disabled**; aktiv ⇒ niemand aktualisiert `main` | Break Glass (§9) |

F-6 ist der einzige Punkt mit Unsicherheit: FREEZE hatte `forge-halt` als eigenes Ruleset. Ob es unter den 7 ist, kann hier nicht geprüft werden (OD-B4).

### 2.5 Zirkularitätsprüfung

| Kante | Zirkulär? | Warum nicht |
|---|---|---|
| Verifier-Code braucht Verifier zur Prüfung | nein | B1-Runs werden vom Code-Reviewer verifiziert; der aktive Verifier prüft danach den Gesamtbaum im Smoke-PR rückwirkend (§6 Schritt 4) |
| Workflow muss auf `main` sein, damit er läuft; PR dorthin braucht Checks | nein | Required Checks sind bis Schritt 5 leer; Actions sind bis Schritt 2 deny-all, also läuft im VERIFIER-0003-Run-PR **gar nichts** |
| `forge-gate` liest `forge/policy.json`; Policy kommt per PR, der geprüft werden müsste | nein | Policy kommt in B0, vor jedem Gate; spätere Policy-Änderungen sind Owner-PRs **durch** das Gate |
| CORE-0002 führt Format 2 ein, ist selbst Contract | nein | CORE-0002 ist Format 1 (vom heutigen Parser lesbar) |
| Smoke-PR braucht Attestation, Gate prüft Attestation, Owner attestiert erst nach Lauf | nein | Re-run all jobs nach dem Review (DL-3) |

---

## 3. Contract DAG

### 3.1 Minimaler DAG

```
B0  OWNER BOOTSTRAP (Einstellungen + forge/owner/bootstrap-0001)
 │
 ├──► [1] FORGE-VERIFIER-0001   (Format 1, rein: Pfade, Tree, Diff, Scope)  ──┐
 │                                                                           │
 └──► [2] FORGE-CORE-0002       (Format 1, Kern: Format 2, isProtectedPath,  ├──► [3] FORGE-VERIFIER-0002 (Format 2: forge-gate)
                                  runBase, ohne PROCESS_NOTE_PREFIX)  ───────┘            │
                                                                                          ▼
                                                    [4] FORGE-VERIFIER-0003 (Format 2: forge-verify + Workflow + CLI)
                                                                                          │
                                                                                          ▼
                                                              ACTIVATION (§6, Einstellungen + Smoke-PR)
                                                                                          │
                                                                                          ▼
                                                    [5] FORGE-DRILL-0001 (Format 2, clampAtZero, D1)
                                                                                          │
                                                                                          ▼
                                                    [6] FORGE-DRILL-0002 (Format 2, Zielscheibe für D2–D9; nur geschlossene PRs)
```

Kanten sind Code- **oder** Format-Abhängigkeiten. Single Lane: Runs strikt nacheinander. Contracts dürfen vorher entworfen, aber erst registriert werden, wenn ihr `specifiedAgainst`/`baseCommit` die Abhängigkeiten enthält.

### 3.2 Prüfung jeder Aufteilung

| Knoten | Notwendig? | Begründung | Vereinfachung geprüft |
|---|---|---|---|
| OPS foundation | **ja, aber nicht als Contract** | Einstellungen und Daten, kein Code; ein Contract würde einen Gate voraussetzen, den es nicht gibt. Deshalb B0-Owner-PR statt „FORGE-OPS-0001-Contract“ | Mehrere Owner-PRs (FREEZE erlaubt) → **auf genau einen reduziert**, damit die Ausnahme zählbar ist |
| VERIFIER-0001 | **ja** | einziger fertiger, hashgebundener Draft; rein, keine Git-Aufrufe, unabhängig von CORE-0002 | Zusammenlegen mit 0002: zusammen ≈ 700 Produktionszeilen > Grenze 400; und 0001 ist heute GO, 0002 hat keinen Text → nicht zusammenlegen |
| CORE-0002 | **ja** | (1) Der Drill muss das Format fahren, das Produkt-Runs fahren (FREEZE W-14); ohne CORE-0002 bliebe Format 1 dauerhaft. (2) `forge-gate` braucht `specifiedAgainst`/`reads`/`limits`/`mutants`, um `SPEC_STALE`, Limits und Mutanten-Vollständigkeit zu prüfen. (3) Die Koordinations-Ausnahme des Kerns (`PROCESS_NOTE_PREFIX`) muss weg | Drill in Format 1 und CORE-0002 danach: spart nichts (CORE-0002 bleibt Pflicht vor VS-1), verlängert aber das Format-1-Fenster und lässt den Drill die falsche Pipeline prüfen → verworfen |
| VERIFIER-0002 (`forge-gate`) | **ja** | Git-Fakten, Registrierungs-Invarianten (`C = M^2`), Commit-Walk, Quittung, Run-Nummer/Lane, Identität, Limits, `MAIN_MOVED`, Format-Regel, Policy-Lesen, **minimale Attestation** (s. u.) | Verschmelzen mit 0003: > 700 Zeilen, und 0002 (nur Daten/Git) und 0003 (führt Prüflingscode aus) haben verschiedene Sicherheitsklassen → getrennt lassen |
| VERIFIER-0003 (`forge-verify` + Workflow) | **ja** | Sandbox, Inventar, Evidence, CLI, `forge-verify.yml`, Image-Digest | — |
| PLAT-0001 | **nein, nicht vor dem Drill** | DV-1 (ONP). Aber: „Owner-Recheck über Re-run all jobs“ setzt voraus, dass `forge-gate` die Owner-Attestation liest. Daher wandert **genau diese Teilmenge** nach VERIFIER-0002: jüngstes Review von User-ID 315180734 auf `commit_id == H` mit Zeile `FORGE ATTEST v1 block=<sha256> by=Wuerfelduell`, live per API (s. G-4). Vollgrammatik, Provider-Matrix, Findings-Carry-Forward bleiben PLAT-0001 nach dem Drill | Schätzung VERIFIER-0002 + Attest-Teil > 400 Zeilen → Regel: beim Schreiben des 0002-Contracts entscheidet die Zeilenschätzung; liegt sie über 400, wird **vor** der Registrierung in `VERIFIER-0002` (Git/Gate) und `VERIFIER-0002A` (Policy+Attest) geteilt, nie nachträglich |
| Drill-Contract | **ja, zwei Contracts** | D1 muss akzeptiert (gemergt) werden; danach friert der Task ein (`TASK_ACCEPTED_FROZEN`), weitere Runs gegen denselben Contract würden aus dem **falschen** Grund rot. D2–D9 brauchen deshalb eine eigene Zielscheibe (FORGE-DRILL-0002), die bewusst nie akzeptiert wird | Alternative „D2–D9 zuerst als Runs 1–8, D1 als Run 9“ geht ohne zweiten Contract, macht D1 aber zum neunten Run mit acht Handoffs (OD-B6) |

### 3.3 Gefundene Lücken im Zusammenspiel (müssen in die Contract-Texte, keine Neuentwürfe)

| ID | Lücke | Wo zu schließen |
|---|---|---|
| G-1 | FREEZE §5.3: `supersedes.format ∈ {2, "legacy"}`. Eine spätere Revision von VERIFIER-0001 oder CORE-0002 (Format-1-Contracts, aber Forge-managed akzeptiert) hat keinen gültigen Wert | CORE-0002-Contract: Enum um `1` erweitern (Bedeutung: Vorgänger ist Bootstrap-Format-1 an `M_{N-1}^2`, Hash mit `forge-contract-v1\n`) |
| G-2 | `tests/forge/dogfood.test.ts` liest `src/forge` und `tests/forge` mit `readdirSync` **nicht rekursiv**; ein neues Unterverzeichnis erscheint als Eintrag und muss im Scope stehen | CORE-0002-Contract: keine Unterverzeichnisse unter `src/forge`/`tests/forge`, oder Test anpassen (im Scope) |
| G-3 | `tests/forge-red-team/findings.test.ts:41` erwartet, dass eine Änderung an `forge/coordination/CODEX.md` durchgeht | CORE-0002 Scope `modify` muss diesen Test enthalten (Verhaltensänderung ist gewollt) |
| G-4 | Re-run all jobs wiederholt das **ursprüngliche Event-Payload**. Liest der Gate Reviews aus dem Payload, sieht der Re-run die neue Attestation nie | VERIFIER-0002-Contract: Reviews, Head-SHA und `main`-SHA **immer live per API** lesen; Payload nur als Zeiger (PR-Nummer) |
| G-5 | Policy-Schema ist FREEZE-seitig PLAT-0001 zugeordnet, Gate braucht es aber in VERIFIER-0002 | VERIFIER-0002 (oder 0002A) übernimmt `PolicySchema` |
| G-6 | Pre-Activation gibt es keine mechanische Format-1-Sperre | prozedural in B1 (§4.3), mechanisch ab Aktivierung |

---

## 4. Format Migration

### 4.1 Festlegung

| Contract | Format | Grund |
|---|---|---|
| FORGE-VERIFIER-0001 | **1** | heutiger Parser; Draft validiert (`341ec983…`) |
| FORGE-CORE-0002 | **1** | führt Format 2 ein; muss vom heutigen Parser lesbar sein; Dogfood-Test parst jeden `FORGE-CORE-*`-Contract |
| FORGE-VERIFIER-0002 | **2** | **Abweichung von FREEZE W-14 „ggf. 1“**: Registrierung erst nach dem Abnahme-Merge von CORE-0002 (Code-Abhängigkeit besteht ohnehin). Damit ist die Format-1-Menge fest **{VERIFIER-0001, CORE-0002}**, kein „ggf.“ mehr |
| FORGE-VERIFIER-0003, FORGE-DRILL-0001/0002 und alles danach | **2** | |

**Format 2 wird eingeführt durch FORGE-CORE-0002** (Abnahme-Merge `A_CORE2`). Ab `A_CORE2` gilt: jeder neu registrierte Contract ist Format 2.

### 4.2 Wer Format 2 prüft, bevor der Gate existiert

Zwischen `A_CORE2` und der Aktivierung gibt es keinen Gate. Der Architektur-Reviewer führt für jeden Format-2-Contract `parseContractDocument` aus `main` (Stand ≥ `A_CORE2`) lokal aus und schreibt `contentHash` (Präfix `forge-contract-v2\n`) **und** `blobSha` in seinen Review-Block. Ohne beide Werte attestiert der Owner nicht.

### 4.3 Schließen von Format 1 (zweistufig, keine Automatik)

| Stufe | Wann | Wie |
|---|---|---|
| S-a prozedural | ab `A_CORE2` | Owner registriert keinen Format-1-Contract mehr; Reviewer lehnt jeden ab. `forge/policy.json` enthält von Anfang an `bootstrapFormat1TaskIds: ["FORGE-CORE-0002","FORGE-VERIFIER-0001"]` (sortiert), ohne „ggf.“ |
| S-b mechanisch | ab Aktivierung (§6 Schritt 5) | `forge-gate` lehnt **jeden** Contract-PR mit `forgeContractFormat: 1` ab (`FORMAT_NOT_CURRENT`), unabhängig von der Liste; die Liste dient danach nur noch dem Lesen akzeptierter Format-1-Contracts als Dependency |
| S-c Nachweis | vor BOOTSTRAPPED | ein Format-1-Contract-PR (Wegwerf-ID) wird rot; Teil der D-Reihe oder eigener Negativ-PR (§10 E4) |

Der **Parser** behält Format 1 für immer: Legacy-Contracts auf `main` und die Dogfood-Tests hängen daran, und Hashes sind an die exakten Bytes gebunden. „Format 1 geschlossen“ heißt: keine neue Registrierung, nicht: nicht mehr lesbar.

### 4.4 Behandlung bestehender Format-1-Contracts danach

| Contract | Behandlung |
|---|---|
| FORGE-CORE-0001A, PATCH-0001, 0001B, 0001B.v2 (Sidecar) | Legacy, eingefroren, nie umgeschrieben, keine Revision; Tasks `LEGACY_CONTRACT_HISTORY` |
| TASK-0004 (YAML) | Legacy, nur als Dependency mit Anker `3d7545d…`, `provenance: "legacy"` |
| FORGE-VERIFIER-0001, FORGE-CORE-0002 | gültig und akzeptiert; als Dependency referenzierbar (`provenance: "forge"`, `acceptedCommit` = ihr `A`). Eine Revision ist nur als **Format-2-Contract v2** mit `supersedes.format: 1` möglich (G-1) |
| TASK-0005 v2 (Side Branch) | unverändert bis VS-3; dann v3 Format 2, `supersedes.format: "legacy"` (FREEZE W-15) |

Keine automatische Migration, kein Umschreiben, keine Sidecars.

---

## 5. Owner Bootstrap

### 5.1 Die Ausnahme in einem Satz

> **Einmal**, und nur vor der Aktivierung, darf der Owner Einstellungen setzen und **genau einen** PR `forge/owner/bootstrap-0001` ohne maschinellen Check mergen, der ausschließlich die Dateien aus §5.2 enthält; der Code des Verifiers fällt **nicht** darunter.

Danach gibt es bis zur Aktivierung nur noch B1-Merges (Contract-PRs und Run-PRs der vier Bootstrap-Tasks) und den Smoke-PR. Jeder davon steht im Ledger (§5.6).

### 5.2 Erlaubte Dateien im Bootstrap-PR (abschließend)

| Pfad | Änderung | Inhalt |
|---|---|---|
| `forge/policy.json` | add | Policy v1 (FREEZE §3.4): User-IDs `Wuerfelduell` 315180734, `forge-codex` 337272506, Provider, Checks `typecheck`/`test`, Limits, geschützte Pfade, `bootstrapFormat1TaskIds` (§4.3), Legacy-Anker `3d7545d…`; kanonisch (`JSON.stringify(x, null, 2) + "\n"`) |
| `forge/roles/*.md` | add | Rollenvorlagen nach FREEZE §6.4; Dateiliste wird im PR-Body vor dem Review fixiert |
| `forge/ops/BOOTSTRAP.md` | add | genau §5.1–§5.7 dieses Plans als bindender Text, inkl. Schlusssatz „Diese Ausnahme ist mit Merge von bootstrap-0001 verbraucht“ |
| `forge/ops/ARCHITECTURE-FREEZE-V0.1.md` | add | byteidentische Kopie; SHA-256 im PR-Body |
| `forge/ops/BOOTSTRAP-EXPERIMENTAL-REPORT.md` | add | byteidentische Kopie (MISSING hier); SHA-256 im PR-Body |
| `forge/ops/RULESETS.md` | add | JSON-Export der 7 Rulesets + Actions-Policy-Zustand (deny-all), Negativ-Drills mit Datum |
| `forge/ops/IDENTITY-SPIKE.md` | add | Audit-Log-Zitat `git.push`, Akteur `forge-codex`, Ref `forge/run/codex/IDENTITY-SPIKE-1`; noreply-E-Mail-Umstellung (OE-5) |
| `forge/ops/BOOTSTRAP-RUNS.md` | add | leeres Ledger mit Kopfzeile |
| `.github/CODEOWNERS` | add | `* @Wuerfelduell` (nur Review-Anfrage, kein Ruleset-Zwang) |
| `.gitattributes` | add | darf keinen Renormalisierungs-Diff erzeugen (Prüfung §5.4) |
| `.nvmrc` | add | Node-Major, das CI nutzen wird |
| `forge/BASELINE-STATUS.md` | modify | ein Absatz: „eventlog authoritative“ durch Verweis auf FREEZE W-04 ersetzt |
| `forge/coordination/CLAUDE.md`, `CODEX.md` | delete | obsolet |

**Verboten** im Bootstrap-PR: alles unter `src/`, `tests/`, `.github/workflows/`, `forge/contracts/`, `forge/approvals/`, `forge/reviews/`, `forge/verifier/`; `package.json`, `package-lock.json`, `tsconfig.json`, `.npmrc`, `vitest.*`, `vite.*`; jede Datei mit Modus ≠ `100644`; Nicht-ASCII-Pfade; Symlinks; Submodule.

### 5.3 Unabhängige Reviews

| Review | Wer | Bindung |
|---|---|---|
| R-1 Text/Policy | ChatGPT (via Adapter) | Review-Block auf Head-SHA `H_B`, Listing-Hash (§5.5) |
| R-2 Text/Policy, adversarial | Claude, frische Session **ohne** Projektdateien und ohne diesen Plan als Anweisung | dito |
| Owner | `Wuerfelduell`, GitHub-Review `COMMENTED` auf `H_B` mit `FORGE REVIEW v1` + `FORGE ATTEST v1` | `commit_id == H_B` |

Zwei Provider, weil es keinen Gate gibt und die Policy der Vertrauensanker des Gates wird. Nach Grok-Verfügbarkeit darf Grok eine der beiden Stimmen ersetzen, nicht beide.

### 5.4 Lokale Checks (Owner oder Reviewer, Ergebnis im Review-Block)

1. `git diff --raw --no-renames 3d7545d H_B` ⊆ §5.2-Liste; nichts anderes.
2. `git ls-tree -r -l -z --full-tree H_B`: alle Modus `100644`, ASCII-Pfade, keine Casefold-Kollision.
3. `H_B^1 == main`-Spitze bei Merge-Zeit; genau ein Nicht-Merge-Commit auf dem Branch (keine Zwischencommits mit anderen Pfaden).
4. `node -e` JSON-Parse von `forge/policy.json` und Kanonik-Vergleich (`JSON.stringify(JSON.parse(s), null, 2) + "\n" === s`).
5. `git add --renormalize . && git status --porcelain` auf frischem Klon von `H_B` → leer (`.gitattributes` ändert keine Bytes; hashgebundene Contracts behalten LF).
6. `npm ci && npm run typecheck && npm test` → 1087 passed (keine Teständerung erlaubt, daher gleiche Zahl).
7. `sha256sum` der beiden Kopien in `forge/ops/` == im PR-Body genannte Werte.
8. Für jeden Contract auf `main`: Hash unverändert (`af91442e…`, `3e9125a5…`, `680db30f…`, `7db0e722…`).

### 5.5 Hash-/SHA-Bindungen

| Objekt | Gebunden an |
|---|---|
| Review R-1, R-2, Owner | `H_B` (40 Hex) + SHA-256 des `ls-tree`-Listings von `H_B` |
| Merge | Merge-Commit `A_B` mit `A_B^2 == H_B`; Ledger-Zeile 1 |
| Kopien | SHA-256 von FREEZE und Experimental Report im PR-Body und im Owner-Review |
| Policy | Blob-SHA von `forge/policy.json` an `A_B` im Ledger (spätere Policy-Änderungen nur über Gate) |

### 5.6 Was nach dem Merge sofort technisch gesperrt ist bzw. wird

| Sperre | Mechanismus | Zeitpunkt |
|---|---|---|
| Direct Push auf `main` (auch Owner) | F-1 ohne Bypass | schon in B0 aktiv |
| Merge durch Codex | F-2 | B0 |
| Delete/Force-Push überall | F-3 bypassfrei | B0 |
| Workflows jeder Art | Actions deny-all | B0, bis Aktivierung |
| zweiter Owner-Bootstrap-PR | **prozedural** bis Aktivierung (Ledger: genau eine B0-Zeile); **mechanisch** ab Aktivierung, weil jeder Owner-PR durch `forge-gate` muss (externer Reviewer, Attestation, Pfadregeln) | — |
| Mystery-/Produkt-PRs | Lane-Regel: bis Aktivierung merged der Owner nur Ledger-PRs | prozedural |

Ehrlich: Zwischen B0 und Aktivierung ist die Menge der zulässigen Merges **nicht** mechanisch erzwungen, weil es keinen Gate gibt. Abgefangen wird das durch (a) F-1/F-3 (keine Geschichte geht verloren), (b) das Ledger, (c) die Exit-Prüfung E6: `git log --first-parent 3d7545d..main` muss **zeilengenau** dem Ledger entsprechen. Jede Abweichung verhindert „BOOTSTRAPPED“.

### 5.7 Keine permanente Hintertür

- Die Ausnahme ist an **eine** Branch-Bezeichnung (`forge/owner/bootstrap-0001`) und **einen** Merge gebunden; `forge/ops/BOOTSTRAP.md` erklärt sie als verbraucht.
- Owner-PRs nach der Aktivierung sind **keine** Ausnahme, sondern ein normaler Modus durch `forge-gate` (FREEZE W-27).
- Keine Bypass-Einträge für Required Checks, Delete, Force-Push. Der einzige Owner-Bypass ist F-2 (wer `main` aktualisieren darf), nicht *wie*.

---

## 6. Verifier Activation

### 6.1 Reihenfolge

| Schritt | Aktion | Akteur | Erfolgsbeweis | Rückweg bei Fehler |
|---|---|---|---|---|
| 0 | Vorbedingung: Abnahme-Merge `A_V3` von VERIFIER-0003 auf `main`; Ledger vollständig bis `A_V3` | — | `git log --first-parent` | — |
| 1 | **files on main** prüfen: `.github/workflows/forge-verify.yml` und `forge/verifier/image.json` an `main` == an `H_V3` (Blob-SHAs); Workflow nennt nur SHA-gepinnte Actions; Trigger nur `pull_request_target` (+ `workflow_dispatch`) | Owner, Code-Reviewer | Blob-Vergleich im Ledger | Revision VERIFIER-0003 (Actions sind noch aus, nichts lief) |
| 2 | **Actions Policy**: von deny-all auf allow-one: Actions-Allowlist exakt die SHAs aus dem Workflow; Event-Policy erlaubt nur `forge-verify.yml` für `pull_request_target`/`workflow_dispatch`; Default-Token read-only; „Actions can create/approve PRs“ aus. **S1-Negativtest** sofort danach auf `forge/owner/s1-negative` (PR-eigener Workflow `on: pull_request` und eine Datei `forge-verify.yml` mit `on: pull_request` im PR) → darf **nicht** laufen; PR schließen, nicht mergen | Owner | Screenshot/API in `forge/ops/S1-RESULT.md` (kommt mit Schritt 4) | Actions wieder deny-all |
| 3 | **workflow**: Erster Lauf. Owner öffnet `forge/owner/checks-smoke` mit genau zwei Dateien: `forge/ops/BOOTSTRAP-RUNS.md` (vollständiges Ledger) und `forge/ops/S1-RESULT.md`. `pull_request_target` startet `forge-verify.yml` von `main` | Owner | Check-Runs `forge-gate` und `forge-verify` existieren | Actions deny-all, Revision VERIFIER-0003 |
| 4 | **first smoke**: externer Reviewer + Owner-Attest-Review (`COMMENTED`) auf dem Smoke-Head; Owner **Re-run all jobs**; beide Checks **grün**. `forge-verify` läuft dabei über den **gesamten Baum** (Tree-Regeln, Inventar, Tests im Container) → rückwirkender Beweis, dass alles aus B0/B1 die eigenen Regeln erfüllt | Owner, Reviewer | grüne Check-Runs auf Smoke-Head, Links im Ledger-Nachtrag | Smoke-PR schließen; Fehler → Revision des betroffenen Bootstrap-Tasks (noch ohne Required Checks möglich) |
| 5 | **required checks**: `forge-gate`, `forge-verify` (Quelle: GitHub Actions) in F-5 eintragen, strict an. Erst **jetzt** Smoke-PR mergen (Merge ist nun schon unter Required Checks) | Owner | Ruleset-Export-Nachtrag in `forge/ops/RULESETS.md` (über nächsten Owner-PR) | Checks wieder austragen = Break Glass (§9) |
| 6 | **normal mode**: Ab hier jeder Merge nur mit beiden Checks grün. Erster Normal-Modus-PR ist der Drill-Contract-PR | — | — | — |

### 6.2 Deadlock-Suche

| ID | Mögliche Blockade | Befund | Auflösung |
|---|---|---|---|
| DL-1 | Run-PR von VERIFIER-0003 enthält einen Workflow; mit erlaubten Actions könnte ein `on: pull_request`-Workflow aus dem PR laufen | **real**, wenn die Actions-Policy erst *nach* „files on main“ kommt und Actions vorher **an** sind | Actions in B0 **deny-all**; Wechsel auf allow-one erst in Schritt 2. Damit ist Sebs Reihenfolge sicher |
| DL-2 | Required Checks eintragen, bevor sie je liefen → GitHub bietet die Namen nicht an bzw. jeder PR hängt auf „Expected — waiting“ | real (ONP L-2) | Schritt 3/4 vor 5 |
| DL-3 | Gate verlangt Attestation; Owner attestiert erst nach Lauf; Re-run nutzt alten Payload | real, wenn Gate Payload liest | G-4: Gate liest live per API; Owner-Recheck = Re-run all jobs |
| DL-4 | `pull_request_target` wird in öffentlichen Repos per Default-Policy ab **2026-11-02** blockiert (PAC PA-30) | real, datumsabhängig | Schritt 2 setzt explizite Erlaubnis; liegt die Aktivierung nach dem 02.11., S1-Positivtest wiederholen |
| DL-5 | Smoke-PR verändert `forge/ops/`; Pfadregel `forge`-Stufe nur für `FORGE-`-Tasks | möglich | Owner-Modus (FREEZE W-27) erlaubt `forge/ops/**` auf `forge/owner/**` — muss so im 0002-Contract stehen (Prüfpunkt beim Contract-Review) |
| DL-6 | Strict „up to date“ + nur Codex darf auf `forge/run/codex/**` pushen + Owner kann nicht „Update branch“ | kein Deadlock, aber Wartezustand | Codex merged `main` in den Run-Branch (FREEZE §11) |
| DL-7 | Halt-Ruleset aktiv ⇒ auch der Owner-Revert-PR kann nicht mergen | real im Incident | Break Glass §9: Halt erst deaktivieren, wenn der Revert-PR grün und reviewt ist, dann sofort mergen |
| DL-8 | Verifier selbst kaputt nach Aktivierung ⇒ jeder Fix-PR rot (Fix braucht grünen Verifier) | **real**, der härteste Fall | Break Glass BG-3 (§9) |
| DL-9 | Ein einziger Mensch: Owner-PR braucht externen Reviewer ≠ Owner-Provider | kein Deadlock, solange ChatGPT/Claude/Grok erreichbar | OE-1-Besetzung |
| DL-10 | Smoke-PR muss das Ledger enthalten; Ledger soll Smoke-Lauf-Links enthalten | Henne-Ei klein | Lauf-Links kommen in den **nächsten** Owner-PR (RULESETS-Nachtrag), nicht in den Smoke-PR |
| DL-11 | VERIFIER-0002-Contract (Format 2) kann erst nach `A_CORE2` registriert werden; Run VERIFIER-0001 und CORE-0002 sind single lane | Serialisierung, kein Deadlock | Reihenfolge §11 |

---

## 7. Drill Contract

### 7.1 Zweck

Nicht Produktfunktion testen, sondern Forge: Registrierung (`C = M^2`), Quittung, Run-Branch-Identität, beide Checks, Reviewer-Mutanten, Attestation + Re-run, Merge-Commit `A^2 = H`. Die Funktion ist absichtlich trivial, damit jede rote Zeile eindeutig Forge zuzuordnen ist.

### 7.2 FORGE-DRILL-0001 v1 (Format 2, Eckwerte)

| Feld | Wert |
|---|---|
| `forgeContractFormat` | `2` |
| `taskId` / `title` | `FORGE-DRILL-0001` / `clampAtZero drill` |
| `contractVersion` / `supersedes` | `1` / `null` |
| `specifiedAgainst` | `main`-Spitze nach Smoke-Merge (Aktivierung abgeschlossen) |
| `dependencies` | `[]` |
| `reads` | `[]` |
| `scope.create` | `src/drill/clamp-at-zero.ts`, `tests/drill/clamp-at-zero.test.ts` |
| `scope.modify` | `[]` |
| `limits` | `maxProductionLines: 20`, `maxChangedFiles: 2` |
| `requiredChecks` | `typecheck` (`npm run typecheck`), `test` (`npm test`) |

Pfadwahl: `src/drill/` liegt außerhalb jeder geschützten Stufe (nicht `src/forge*`), berührt keine Produktdomäne und keine Bestandsdatei. `tsconfig.json` schließt `src` und `tests` rekursiv ein; Vitest findet `*.test.ts` ohne Konfiguration.

**Verhalten (vollständig):** `export function clampAtZero(value: number): number`
- `NaN` → wirft `RangeError("clampAtZero: NaN")`
- `value < 0` (inkl. `-Infinity`) → `0`
- `-0` → `+0` (`Object.is(result, 0)`)
- sonst → `value` (inkl. `+Infinity`)

**Pflicht-Ankertext** (je genau einmal in `src/drill/clamp-at-zero.ts`, damit Mutanten am Head eindeutig anwendbar sind):

```ts
if (Number.isNaN(value)) throw new RangeError("clampAtZero: NaN");
if (value < 0) return 0;
if (Object.is(value, -0)) return 0;
```

**Mutanten** (`tests: ["tests/drill/clamp-at-zero.test.ts"]`, vom Code-Reviewer repliziert):

| ID | before | after | getötet durch |
|---|---|---|---|
| m1 | `if (value < 0) return 0;` | `if (value < -1) return 0;` | `clampAtZero(-0.5) === 0` |
| m2 | `throw new RangeError("clampAtZero: NaN");` | `return 0;` | NaN wirft |
| m3 | `Object.is(value, -0)` | `Object.is(value, 0)` | `Object.is(clampAtZero(-0), 0)` |

Kein Mutant ist äquivalent (geprüft: `value <= 0` wäre äquivalent zu `< 0` bei Rückgabe `0` und deshalb bewusst **nicht** gewählt).

**Acceptance Criteria:** die vier Verhaltenszeilen als Tests; drei Mutanten getötet; Testinventar steigt um ≥ 4 und kein bestehender Test verschwindet; Produktionszeilen ≤ 20.
**Non-Goals:** keine Exporte außer `clampAtZero`, kein Einsatz im Produktcode, keine Änderung an Bestandsdateien.

### 7.3 D1 — der legitime Run

| Schritt | Akteur | Erwarteter Beleg |
|---|---|---|
| 1 Contract-PR `forge/contract/FORGE-DRILL-0001-v1`, ein Commit `C` | Spec-Autor (s. §8) bzw. Owner pusht | `forge-gate` grün (Contract-Abschnitt) |
| 2 Architektur-Review mit `contentHash` + `blobSha`; Owner-Attest; Re-run; Merge `M` | Reviewer, Owner | `M^2 == C`, Ledger nicht mehr nötig (normaler Modus) |
| 3 Tracking-Issue + `FORGE DEVELOPER HANDOFF v2` | Owner | Kommentar |
| 4 Run-Branch `forge/run/codex/FORGE-DRILL-0001-1` ab `main`, erster Commit leer mit `FORGE READ RECEIPT v2` | `forge-codex` | Commit-Autor/Committer noreply-Allowlist |
| 5 Implementierungs-Commit(s), PR Draft → Ready | `forge-codex` | `forge-gate` + `forge-verify` grün auf `H` |
| 6 Code-Review: Mutanten m1–m3 am Head, Inventar, Exit-Codes | Code-Reviewer | Review-Block mit `mutant: m1 killed` … |
| 7 Owner-Attest auf `H`, **Re-run all jobs**, grün | Owner | Gate-Abschnitt `review: PASS` |
| 8 Merge `A` | Owner | `A^2 == H`; `forge/ops/DRILL-0001.md` per nächstem Owner-PR |

### 7.4 D2–D9 — adversariale Runs (separat, nie gemergt)

Zielscheibe ist **FORGE-DRILL-0002 v1** (Format 2, registriert nach D1-Merge): `scope.modify = [src/drill/clamp-at-zero.ts, tests/drill/clamp-at-zero.test.ts]`, `create = []`, gleiche Limits, ein Mutant. Jeder D-Run ist ein eigener Run-PR (`forge/run/codex/FORGE-DRILL-0002-<n>`), wird rot (oder vom Ruleset abgelehnt) und vom Owner **geschlossen**. Run n > 1 braucht jeweils einen neuen Handoff (testet nebenbei `RUN_NUMBER_NOT_NEXT`). Die Angriffsinhalte schreibt ein Red-Team-Spec (Claude), gepusht von `forge-codex`; kein D-Run mischt sich mit einer legitimen Developer-Änderung.

| D | Angriff | Erwartung (Code laut FREEZE Anhang B, wo vorhanden) |
|---|---|---|
| D2 | zusätzliche Datei außerhalb Scope (`src/domain/x.ts`) | `forge-gate` rot, `SCOPE_VIOLATION` |
| D3 | Änderung an geschütztem Pfad (`package.json` oder `.github/workflows/forge-verify.yml`) | rot, geschützter Pfad |
| D4 | Test bricht (Verhalten falsch) | `forge-verify` rot, `CHECK_FAILED` |
| D5 | Quittung fehlt / falscher Contract-Hash in der Quittung | `forge-gate` rot (Quittungscode) |
| D6 | Push nach Owner-Attestation | `forge-gate` rot bis neue Attestation (`ATTEST_STALE`) |
| D7 | PR-eigener Workflow `on: pull_request` bzw. gleichnamiger Job `forge-gate` | läuft nicht (S1); kein grüner Fremd-Check |
| D8 | falsche Identität: Owner pusht auf `forge/run/codex/**`; Commit mit Fremd-E-Mail | Ruleset lehnt Push ab; `COMMIT_IDENTITY_MISMATCH` |
| D9 | `main` bewegt sich nach grünem Lauf | Merge gesperrt (strict) bzw. `MAIN_MOVED` |

Falls der Experimental Report eine eigene D2–D9-Liste hat, gilt jene; diese Tabelle ist dann nur der Abgleich.

---

## 8. Review Routing

Regeln (FREEZE W-26, unverändert): Architektur-Reviewer-Provider ≠ Spec-Autor-Provider; Code-Reviewer-Provider ≠ Developer-Provider ⇒ **nie ChatGPT als Code-Reviewer** (Developer ist immer `forge-codex`/OpenAI); Owner attestiert und merged; Claude schreibt nie ins Repo (Stufe A), Claude-Texte pusht der Owner.

### 8.1 Vor Grok-Verfügbarkeit

| Task | Spec-Autor | Architektur-Reviewer | Developer | Code-Reviewer | Owner |
|---|---|---|---|---|---|
| Owner-Bootstrap-PR | Owner (Texte z. T. Claude) | — | — | ChatGPT **und** Claude (frisch) | attestiert, merged |
| VERIFIER-0001 | Claude (Draft liegt vor) | **ChatGPT** | Codex | **Claude** (frische Session, ohne Projektdateien) | ✓ |
| CORE-0002 | Autor des MISSING-Drafts; falls OpenAI → | **Claude** | Codex | **Claude** (andere Session als Architektur) | ✓ |
| CORE-0002 | falls Claude → | **ChatGPT** | Codex | **Claude** (frisch) | ✓ |
| VERIFIER-0002/-0003 | Claude | **ChatGPT** | Codex | **Claude** (frisch) | ✓ |
| FORGE-DRILL-0001 | ChatGPT | **Claude** (Session A) | Codex | **Claude** (Session B) | ✓ |
| FORGE-DRILL-0002 + D-Inhalte | Claude (Red Team) | ChatGPT | Codex | Claude (frisch) | ✓ |
| Smoke-PR / Ops-Nachträge | Owner | — | — | ChatGPT oder Claude | ✓ |

Restrisiko vor Grok: Bei Claude-Specs reviewt Claude auch den Code (gleicher Provider auf Spec und Code-Review, nicht aber auf Developer). Gemildert durch frische Session ohne Projektdateien und dadurch, dass die Architektur-Freigabe vom anderen Provider kommt. Provider-**Self**-Review (Developer-Provider reviewt eigenen Code) kommt nie vor.

### 8.2 Nach Grok-Verfügbarkeit

| Task-Typ | Spec-Autor | Architektur | Code |
|---|---|---|---|
| Claude-Spec | Claude | ChatGPT | **Grok** |
| ChatGPT/Codex-Spec | ChatGPT/Codex | Claude | **Grok** (oder Claude) |
| Owner-PR | Owner | — | zwei aus {ChatGPT, Claude, Grok} |

Damit ist jede Rolle bei Claude-Specs providerdisjunkt (Anthropic / OpenAI / OpenAI-Developer / xAI). Grok wird nicht rückwirkend für B1 eingesetzt.

---

## 9. Break Glass

### 9.1 Grundsätze (nicht verhandelbar)

1. **Kein Direct Push auf `main`** — technisch ausgeschlossen durch F-1 ohne Bypass; der Owner editiert dieses Ruleset im Incident nicht.
2. **Kein Rewrite** — F-3 bypassfrei; Korrektur nur vorwärts (`git revert -m 1 <A>` als PR).
3. **Schutz nie komplett aus** — höchstens die zwei Required-Check-Einträge, nur in BG-3, nur für einen PR.
4. Jeder Incident hat eine Notiz `forge/ops/INCIDENT-<nnnn>.md`, die **im selben** Korrektur-PR liegt.

### 9.2 Stufen (kleinste zuerst)

| Stufe | Wann | Owner darf | Owner darf nicht |
|---|---|---|---|
| **BG-0 Halt** | jeder Verdacht | Halt-Ruleset (F-6) aktivieren; offene PRs schließen; Re-run | sonst nichts ändern |
| **BG-1 Vorwärts-Revert, Verifier gesund** | ein gemergter PR ist falsch, Gate/Verify funktionieren | Owner-PR `forge/owner/revert-<nnnn>`: nur `git revert -m 1 <A>` + Incident-Notiz; externes Review; Checks grün; Halt kurz deaktivieren, mergen, Halt-Entscheidung dokumentieren | Code ändern, mehr als den Revert |
| **BG-2 Vor Aktivierung (B0/B1)** | Fehler in Bootstrap-Merge, noch keine Required Checks | wie BG-1, aber Code-Reviewer verifiziert den Revert manuell (Tree von `A_rev` == Tree vor `A` auf den betroffenen Pfaden); Ledger-Zeile | neuen Code „nachschieben“ statt revertieren |
| **BG-3 Verifier selbst defekt** (DL-8) | `forge-gate`/`forge-verify` sind falsch rot oder falsch grün, und jeder Fix braucht sie | (1) BG-0; (2) Revert-PR des verursachenden Verifier-Abnahme-Merges vorbereiten, zwei externe Reviews; (3) **nur** die zwei Required-Check-Einträge in F-5 entfernen; (4) Halt deaktivieren, genau diesen PR mergen; (5) Required Checks wieder eintragen; (6) Smoke-Lauf (§6 Schritt 3–4) wiederholen; (7) Ruleset-Export + Audit-Log-Auszug (`repository_ruleset.*`) in nächsten Owner-PR | PR-Pflicht, Merge-Restriktion, Delete/Force-Push-Regeln anfassen; Workflows ändern ohne Contract; einen zweiten PR im offenen Fenster mergen |
| **BG-4 Identität kompromittiert** | Push als `forge-codex` von unbekannter Quelle | BG-0; Team-Mitgliedschaft entziehen; Credentials rotieren; dann BG-1 | Branches löschen (gesperrt) |

Das Fenster in BG-3 ist der einzige Moment nach Aktivierung, in dem ein PR ohne Checks gemergt wird. Es ist an einen Revert gebunden (kein neuer Code), an zwei externe Reviews und an den Audit-Log-Nachweis. Ein Fix neuen Codes für den Verifier kommt danach als normaler Contract-Run **mit** wiederhergestelltem Verifier-Stand.

Der Org-Admin kann Rulesets technisch immer ändern; das ist nicht abschaltbar. Die Abwehr ist Sichtbarkeit: jede Ruleset-Änderung erscheint im Audit-Log und muss in `forge/ops/` erklärt sein (Exit-Kriterium E6/E9).

---

## 10. Exit Criteria — „FORGE V0.1 BOOTSTRAPPED“

Alle gleichzeitig, nicht früher:

| E | Kriterium | Nachweis |
|---|---|---|
| E1 | 7 Rulesets + Actions Policy angelegt, Negativ-Drills (Direct Push Owner/Codex, Codex-Merge, Delete, Force-Push, Fremdnamensraum, Tag) rot | `forge/ops/RULESETS.md` mit Datum |
| E2 | genau ein Owner-Bootstrap-PR gemergt, mit R-1, R-2, Owner-Review auf `H_B` | Ledger Zeile 1 |
| E3 | VERIFIER-0001, CORE-0002, VERIFIER-0002, VERIFIER-0003: je Contract-PR (`M^2 = C`) und Run-PR (`A^2 = H`) mit Architektur- und Code-Review, Owner-Attest | Ledger |
| E4 | Format 1 geschlossen: Policy-Liste fest; ein Format-1-Contract-PR nach Aktivierung ist rot (`FORMAT_NOT_CURRENT`) | geschlossener Negativ-PR |
| E5 | Aktivierung §6 komplett: S1 negativ + positiv, Smoke grün, Required Checks eingetragen (strict) | `S1-RESULT.md`, Ruleset-Export |
| E6 | `git log --first-parent 3d7545d..main` == Ledger, zeilengenau; Audit-Log ohne unerklärte Ruleset-Änderung oder Push auf `main` | Ledger + Audit-Auszug |
| E7 | D1 gemergt über den vollen Prozess, beide Checks grün auf `H`, Attestation per Re-run bestätigt | PR-Link, `DRILL-0001.md` |
| E8 | D2–D9 je rot (oder Ruleset-Ablehnung) mit erwartetem Grund, alle geschlossen | `forge/ops/DRILL-0001.md` |
| E9 | kein offener Break-Glass-Incident; Halt disabled mit Notiz; PR #2 geschlossen (nicht gemergt) | — |

„BOOTSTRAPPED“ heißt nicht „V0.1 fertig“: PLAT-0001 (Vollgrammatik, Findings, Provider-Matrix) und der erste produktive Mystery-Run folgen danach.

---

## 11. Exact Ordered Queue

Q = einzelner, abhakbarer Schritt. Kein Schritt beginnt vor Abschluss des vorigen, außer wo „∥“ steht (nur Textarbeit, keine Merges).

| Q | Schritt | Akteur | Vorbedingung |
|---|---|---|---|
| Q01 | Experimental Report, OPS-0001-Paket und CORE-0002-Draft in die Projektdateien legen | Owner | — |
| Q02 | OD-B1…OD-B8 entscheiden | Owner | Q01 |
| Q03 | B0-Einstellungen: Org/Repo, Team `forge-dev-codex`, Codex noreply-E-Mail, Actions **deny-all**, 7 Rulesets ohne Required Checks, Halt disabled; Negativ-Drills | Owner | Q02 |
| Q04 | Owner-Bootstrap-PR `forge/owner/bootstrap-0001` öffnen (§5.2), lokale Checks §5.4 | Owner | Q03 |
| Q05 | R-1 (ChatGPT), R-2 (Claude frisch), Owner-Attest; Merge `A_B` | Reviewer, Owner | Q04 |
| Q06 | PR #2 schließen (nicht mergen) | Owner | Q05 (Beleg liegt in `IDENTITY-SPIKE.md`) |
| Q07 ∥ | Architektur-Review VERIFIER-0001-Draft (Hash `341ec983…`) | ChatGPT | Q01 |
| Q08 ∥ | CORE-0002-Contract finalisieren (Format 1; G-1, G-2, G-3 aufnehmen) + Architektur-Review | Spec-Autor, Reviewer | Q01 |
| Q09 | Contract-PR VERIFIER-0001 (`forge/contract/FORGE-VERIFIER-0001-v1`, ein Commit, Draft byteidentisch, s. Hinweis unten), Merge `M_V1` | Owner | Q05, Q07 |
| Q10 | Contract-PR CORE-0002, Merge `M_CORE2` | Owner | Q05, Q08 |
| Q11 | Run VERIFIER-0001 (Bootstrap-Modus), Code-Review, Attest, Merge `A_V1`, Ledger | Codex, Claude, Owner | Q09 |
| Q12 | Run CORE-0002, Code-Review, Merge `A_CORE2` — **ab hier Format 2 Pflicht** | Codex, Reviewer, Owner | Q10, Q11 (Lane) |
| Q13 ∥ | VERIFIER-0002-Contract (Format 2, inkl. G-4, G-5, Attest-Teilmenge, Owner-Modus `forge/ops/**`; Split-Entscheid 0002/0002A nach Zeilenschätzung) + Review mit v2-Hash/BlobSha | Claude, ChatGPT | Q12 |
| Q14 | Contract-PR + Run VERIFIER-0002 (bzw. 0002 dann 0002A), Merge(s) | Codex, Claude, Owner | Q13 |
| Q15 ∥ | VERIFIER-0003-Contract (Format 2: Workflow, Image-Digest, CLI, Container) + Review | Claude, ChatGPT | Q14 |
| Q16 | Contract-PR + Run VERIFIER-0003, Merge `A_V3` | Codex, Claude, Owner | Q15 |
| Q17 | Aktivierung Schritt 1: files on main | Owner, Reviewer | Q16 |
| Q18 | Schritt 2: Actions allow-one + S1-Negativtest | Owner | Q17 |
| Q19 | Schritt 3–4: Smoke-PR (Ledger + S1-RESULT), Reviews, Re-run, grün | Owner, Reviewer | Q18 |
| Q20 | Schritt 5: Required Checks eintragen; Smoke-PR mergen | Owner | Q19 |
| Q21 | Owner-PR: RULESETS-Nachtrag + Smoke-Lauf-Links (erster Normal-Modus-Owner-PR) | Owner | Q20 |
| Q22 | Format-1-Negativ-PR (Wegwerf-ID), rot, schließen (E4) | Owner | Q20 |
| Q23 ∥ | FORGE-DRILL-0001-Contract (§7.2) + Architektur-Review | ChatGPT, Claude | Q20 |
| Q24 | Contract-PR DRILL-0001, Merge `M_D1` | Owner | Q23 |
| Q25 | D1 Run (§7.3), Merge `A_D1` | Codex, Claude, Owner | Q24 |
| Q26 | FORGE-DRILL-0002-Contract + Registrierung | Claude, ChatGPT, Owner | Q25 |
| Q27 | D2 … D9 nacheinander, je rot, je geschlossen | Codex (Red-Team-Inhalt), Owner | Q26 |
| Q28 | Owner-PR `forge/ops/DRILL-0001.md` + Ledger-Abschluss + Audit-Auszug | Owner | Q27 |
| Q29 | E1–E9 prüfen → **FORGE V0.1 BOOTSTRAPPED** | Owner + ein externer Reviewer | Q28 |

Hinweis zu Q09: Der Draft trägt `baseCommit: 3d7545d…`. Nach `A_B` ist `3d7545d` weiterhin auf der First-Parent-Kette von `main`; mit `reads = []` und `scope.modify = []` ist er nach FREEZE §5.10 nie `SPEC_STALE`. Er **kann** also unverändert (Hash `341ec983…`) registriert werden; der Golden-Listing-Test (A-03) nutzt fest eingebettete Bytes von `3d7545d` und hängt nicht am aktuellen Baum. Empfehlung: unverändert registrieren, damit das vorhandene Review gültig bleibt.

---

## 12. Owner Decisions

| # | Entscheidung | Empfehlung | Konsequenz der Alternative |
|---|---|---|---|
| **OD-B1** | Experimental Report als Quelle bestätigen und als Kopie in den Bootstrap-PR; deckt er F-1…F-6 (§2.4) und H1/H2/H3/H8? | **ja, Kopie in `forge/ops/`** | ohne Kopie lesen Developer/Reviewer die Ruleset-Wahrheit aus dem Chat (Prozessregel verletzt) |
| **OD-B2** | CORE-0002-Draft bereitstellen; wer ist Spec-Autor? | bereitstellen, Autor im PR-Header nennen | ohne Draft bleibt Q10 BLOCKED, damit der ganze Pfad |
| **OD-B3** | Attestations-Teilmenge in VERIFIER-0002 (statt PLAT-0001) | **ja** (sonst ist „Owner-Recheck per Re-run“ wirkungslos) | Attestation bis PLAT-0001 nur prozedural; D6 wäre nicht mechanisch rot |
| **OD-B4** | Ist ein Halt-Ruleset (disabled) unter den 7? | **muss es geben**; falls nicht, als 8. anlegen oder Halt = Required Check „forge-halt“ (immer rot) — Owner wählt | ohne Halt ist BG-0 nicht verfügbar |
| **OD-B5** | Actions in B0 deny-all bis Aktivierung | **ja** | Actions an + Policy später öffnet DL-1 |
| **OD-B6** | D1 zuerst, D2–D9 gegen FORGE-DRILL-0002 | **ja** | D2–D9 als Runs 1–8 auf DRILL-0001, D1 als Run 9: ein Contract weniger, acht Handoffs, D1 spät |
| **OD-B7** | Drill-Pfade `src/drill/`, `tests/drill/`; Code bleibt danach im Repo | **ja** | Revert nach dem Drill = zusätzlicher Owner-PR ohne Nutzen |
| **OD-B8** | Reviewer-Besetzung vor Grok (§8.1), Claude-Code-Review in frischer Session | **ja** | sonst OE-1 (FREEZE) neu entscheiden |

Abweichungen gegenüber FREEZE, die dieser Plan einführt (zur Bestätigung): VERIFIER-0002 fest Format 2 (§4.1); OPS-0001 als **genau ein** Owner-PR; PLAT-0001 hinter den Drill (DV-1, ONP) mit Attest-Teilmenge in 0002; Drill = clampAtZero statt Parse-Report/PlayerRef; zwei Drill-Contracts.

---

## 13. GO / NO-GO

| Gegenstand | Urteil | Bedingung |
|---|---|---|
| Dieser Plan als Bootstrap-Pfad | **GO** | OD-B1…OD-B8 |
| B0-Einstellungen (Q03) | **GO**, sobald OD-B1/B4/B5 entschieden | Experimental Report als Referenz |
| Owner-Bootstrap-PR (Q04/Q05) | **GO** nach Q03 | §5.2-Allowlist, zwei externe Reviews |
| VERIFIER-0001 Registrierung + Run (Q07–Q11) | **GO** | Architektur-Review auf Hash `341ec983…` (heute reproduziert), B0 abgeschlossen |
| CORE-0002 | **NO-GO** | Draft MISSING (OD-B2) |
| VERIFIER-0002 / -0003 | **NO-GO** | Texte MISSING; frühestens nach `A_CORE2` bzw. `A_V2` |
| Aktivierung | **NO-GO** | braucht `A_V3` |
| Drill (D1–D9) | **NO-GO** | braucht Aktivierung |
| **Gesamt: FORGE V0.1 BOOTSTRAPPED heute** | **NO-GO** | frühestens nach Q29 |

**Kurzurteil:** Der Bootstrap ist zirkelfrei lösbar, ohne dass Verifier-Code je an der Contract-Pflicht vorbeigeht. Die einzige Owner-Ausnahme ist ein Einstellungs-Block plus genau ein Nicht-Code-PR. Der kritische Pfad sind jetzt drei fehlende Contract-Texte (CORE-0002, VERIFIER-0002, VERIFIER-0003), nicht Code oder Architektur.

**Keine Datei im Repository wurde geändert, kein Commit, kein Branch, kein PR, kein Review, keine Einstellung. STOP.**
