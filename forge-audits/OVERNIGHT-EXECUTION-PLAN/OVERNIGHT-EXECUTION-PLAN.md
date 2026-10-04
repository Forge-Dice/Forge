# OVERNIGHT FORGE + MYSTERY EXECUTION PLAN

| Feld | Wert |
|---|---|
| Datum | 2026-10-03, Lesestand Repository 18:54 UTC |
| Modus | **read-only**. Keine Datei im Repository geändert, kein Commit, kein Branch, kein PR, keine Einstellung berührt. |
| Kanonisches Repository | `Forge-Dice/Forge`, `main` = `3d7545d843883418348004e68717399a64da7a7d` |
| Leitreferenz | `FORGE-V0.1-ARCHITECTURE-FREEZE.md` (im Folgenden FREEZE). Wo dieser Plan abweicht, ist die Abweichung als **DV-n** markiert und als Owner-Entscheidung in §11 gelistet. |
| Begleitdatei | `MYST-0001-PLAYERREF-V1.contract.DRAFT.md` (Format-2-Entwurf, §6) |

Beleg-Labels: `GIT` (Git-Objekte, `git ls-remote`, Klon), `API` (GitHub-API), `RUN` (heute hier ausgeführt), `CODE` (Quelltext auf `main` gelesen), `DOC` (Bericht in `/mnt/project-files/forge-audits/`), `OWNER` (nur von Seb mitgeteilt, hier nicht nachprüfbar), **`NOT AVAILABLE`** (Artefakt weder im Repo noch in den Projektdateien; nicht rekonstruiert).

---

## 1. Verified Current State

### 1.1 Remote-Stand

| Fakt | Wert | Beleg |
|---|---|---|
| `main` | `3d7545d…` = Merge Commit von PR #1, Eltern `f5dbc73…`, `0dfd903…` | GIT |
| Tags | keine | GIT (`ls-remote`) |
| Typecheck | Exit 0 | RUN (`npm ci`, `npm run typecheck`) |
| Tests | 22 Dateien, **1087/1087 grün**, Exit 0 | RUN (`vitest run`) |
| Tree | 71 Einträge, alle `100644`, Tree `67103229…`, `ls-tree -r -l -z` SHA-256 `7087aa36…` (identisch mit VERIFIER-0001-Draft §2) | RUN |
| Offene PRs | **#2** Draft, `forge/run/codex/IDENTITY-SPIKE-1` @ `8dc692b`, Autor `forge-codex` (ID 337272506), 0 geänderte Dateien, **0 Reviews, 0 Kommentare** | API |
| Geschlossene PRs | #1 merged 08:15:41Z, Autor `Wuerfelduell`, **0 Reviews** | API |
| Issues | keine | API |
| Workflows / Läufe | **0 / 0** | API |
| `.github/`, CODEOWNERS, `forge/policy.json`, `forge/ops/`, `forge/roles/`, `.gitattributes`, `.nvmrc` | **existieren auf keinem Ref** | GIT (alle Refs durchsucht) |
| Rulesets, Actions-Policy, Teams | per API hier nicht lesbar | – (FREEZE: 403) |

### 1.2 Remote-Branches

| Branch | Head | Verhältnis zu `main` | Klasse |
|---|---|---|---|
| `main` | `3d7545d` | – | IMPLEMENTED ON MAIN |
| `codex/forge-core-v2-repair` | `0dfd903` | vollständig in `main` (PR #1) | HISTORICAL (gemergt) |
| `codex/task-0004-contract` | `6a8c0c5` | vollständig in `main` (0 eigene Commits) | HISTORICAL (gemergt) |
| `codex/mystery-task-0005` | `fab792a` | 4 eigene Commits (`1de7efe` = Original von M1, inhaltlich als `e5764ee` in `main`; `fc01e4a`, `0453f85`, `fab792a`): TASK-0005-Contract v2 (Blob `1e6f36e5…`, 514 Zeilen, YAML), Mutationsplan, Self-Audit, Testvektoren, M1-Verifikation | HISTORICAL SIDE BRANCH |
| `claude/forge-architecture-review-hjdq89` | `be40a68` | 1 eigener Commit: `forge/reviews/TASK-0005.v2.architecture-review.md` (APPROVE, blob-gebunden an v2) | HISTORICAL SIDE BRANCH |
| `forge/run/codex/IDENTITY-SPIKE-1` | `8dc692b` | 1 leerer Commit auf `3d7545d`; Autor **und** Committer `forge-codex`, aber mit einer **privaten E-Mail-Adresse, nicht** `337272506+forge-codex@users.noreply.github.com` | HISTORICAL (Spike) |

Befund zum Spike: Unter FREEZE §3.4/§4.2 würde genau dieser Commit vom Gate mit `COMMIT_IDENTITY_MISMATCH` abgelehnt. Der Spike belegt den PR-Autor (`API`), nicht den Pusher (nur Org-Audit-Log, `OWNER`) und nicht die künftige Commit-Identität. Das bestätigt OE-5 als offenen Punkt.

### 1.3 Klassifikation

**IMPLEMENTED ON MAIN** (CODE + RUN)

| Bereich | Module | Contracts/Provenienz auf `main` |
|---|---|---|
| Mystery | TASK-0001/0001a `case-truth.ts` (+`case-truth.identity.ts`), TASK-0002 `case-semantics.ts`, TASK-0003 `case-solution.ts` (+`.identity.ts`), TASK-0004 `npc-knowledge.ts` + `npc-knowledge.projection.ts`, M1-Testfix | nur `forge/contracts/TASK-0004.md` (YAML-Frontmatter; der Kernparser liefert `FRONTMATTER_MISSING`, RUN); TASK-0001…0003 ohne Contract |
| Forge-Kern | `src/forge/` 13 Module (Contract-Parser Format 1, Hash `forge-contract-v1\n`, Start-Gate, Runs, Verifikation/Scope, Events/State, Identity), Red-Team-Tests und Referenzmodell | `FORGE-CORE-0001A.md`, `…-0001A-PATCH-0001.md`, `FORGE-CORE-0001B.md`, `FORGE-CORE-0001B.v2.md` (Sidecar); alle vier parsen mit dem Kernparser (RUN, Hashes `af91442e…`, `3e9125a5…`, `680db30f…`, `7db0e722…`) |
| Reviews/Approvals | `forge/approvals/*.json` (2, Legacy), `forge/reviews/` (5 Dateien inkl. ChatGPT-PASS für B-v2-Repair) | keine GitHub-Reviews auf irgendeinem PR (API) |

**DESIGNED ONLY** (DOC; kein Code auf irgendeinem Ref)

| Artefakt | Ort |
|---|---|
| Forge V0.1 Gesamtarchitektur, 8-Task-Sequenz, Rulesets, Blöcke | FREEZE |
| FORGE-VERIFIER-0001 Contract-Draft, Format 1, **contentHash `341ec983…` heute mit dem Kernparser reproduziert**, 32 686 Bytes | `FORGE-VERIFIER-0001.contract.DRAFT.md` (RUN) |
| FORGE-VERIFIER-0002/0003, FORGE-PLAT-0001, FORGE-DRILL-0001 | FREEZE §16, PKG, CSV2, DRILL |
| VS-1 Accusation & Verdict | `MYSTERY-ACCUSATION-VERDICT-DESIGN.md` (D1–D10 offen) |
| VS-2 Evidence Access | `MYSTERY-VS2-IMPLEMENTATION-DESIGN.md` (OD-1…OD-11 offen) |
| VS-4/VS-5/VS-6 | `MYSTERY-VERTICAL-SLICE-ROADMAP.md`, `MYSTERY-SOLVABILITY-V1-RESEARCH.md` |
| PlayerRef V1 | dieser Plan §5/§6 (Richtung von Seb vorgegeben) |

**NOT AVAILABLE** (von Seb genannt, weder im Repo noch unter `/mnt/project-files`; nicht rekonstruiert)

| Artefakt | Folge |
|---|---|
| FORGE-OPS-0001 Execution Package | F1 kann hier nur nach FREEZE §9/§16.2 beschrieben werden |
| FORGE-CORE-0002 Draft Contract | F3 nicht prüfbar; kein Hash, kein Review möglich |
| Ruleset-/OPS-Konflikte **H1, H2, H3, H8** (die Kennungen kommen in keinem Artefakt vor) | F1 (Rulesets) **BLOCKED** bis die Auflösung im Repo oder in den Projektdateien liegt |
| VS-5 Session/Replay Preflight („123 Scratch-Checks“) | nicht als PASS verwendet; VS-5-Zuschnitt hier aus ROAD abgeleitet |
| Player Reference Boundary Studie | nur Sebs Zusammenfassung im Auftrag wird verwendet |
| Begründung für „FORGE-VERIFIER-0001 Reconciliation BLOCKED“ | siehe 1.4 |

**BLOCKED**

| Was | Blocker |
|---|---|
| Required Checks | kein Workflow existiert (API) |
| TASK-0005-Implementierung | v2 nicht registriert; FREEZE §13 #3 verlangt v3 Format 2 mit neuem Review |
| Rulesets (F1) | H1/H2/H3/H8 NOT AVAILABLE |
| FORGE-CORE-0002 (F3) | Draft NOT AVAILABLE |
| FORGE-VERIFIER-0001 | laut Seb BLOCKED; siehe 1.4 |

**OBSOLETE** (bleiben als Geschichte stehen, werden nicht umgeschrieben)

`forge/coordination/CLAUDE.md`, `CODEX.md` (FREEZE: in OPS-0001 löschen); Aussage „Eventlog authoritative“ in `BASELINE-STATUS.md` (ersetzt durch FREEZE W-04); `forge/approvals/*.json` als Freigabeform (ersetzt durch GitHub-Reviews, W-24); Squash/lineare Historie aus HP/VD (ersetzt durch Merge Commit, W-01); Task-IDs `FORGE-OPS-0002` (Verifier-Spike), `FORGE-OPS-0003` (Status-Projektion), `FORGE-CORE-0003` (Run-Verifier) aus MP/HP (durch FREEZE-Namen ersetzt, §8).

### 1.4 FORGE-VERIFIER-0001: Ist die Quelle wirklich fehlend?

Hier liegt die Datei `FORGE-VERIFIER-0001.contract.DRAFT.md` mit 32 686 Bytes. Der Kernparser auf `main` liefert für sie heute `contentHash = 341ec9839fb04ab01fae3b91d4e9e531295c727c0e0a37a15cac978b8b044299`, exakt den in Memory und FREEZE zitierten Wert (RUN). Alle Reconciliation-Fakten aus ihrem §2 reproduzieren sich heute bytegleich gegen `3d7545d` (Tree-Hash, Listing-Hash, 71 Einträge, `PROCESS_NOTE_PREFIX`, `ALWAYS_FORBIDDEN_PREFIXES`, Schema v1; RUN), und `main` hat sich seit dem Draft nicht bewegt.

Wenn „fehlende exakte historische Quelle“ den Draft-Text selbst meint, ist er hier vorhanden und hash-verifiziert. Was die externe Reconciliation stattdessen vermisst hat, ist hier NOT AVAILABLE. **Owner-Aktion:** bestätigen, dass diese Datei die gemeinte Quelle ist; dann ist der Blocker aufgehoben (§11 OE-11).

---

## 2. Forge Critical Path

Definition: **FIRST REAL FORGE-MANAGED DEVELOPMENT RUN** = ein Run-PR von `forge-codex` gegen einen auf `main` registrierten Contract, dessen Head von `forge-gate` und `forge-verify` (Workflow aus `main`, Required Checks aktiv) grün geprüft, von einem Reviewer eines anderen Anbieters reviewt, vom Owner attestiert und per Merge Commit `A` (`A^2 = H`) abgenommen wird.

Die Bootstrap-Runs davor (FREEZE §16.3) sind bereits Contract → Codex → Review → Merge, nur ohne maschinellen Verifier. Der erste von ihnen (F2) ist deshalb die Generalprobe des Prozesses.

| # | Schritt | Wer | Liefert | Hängt ab von | Status heute |
|---|---|---|---|---|---|
| **F1** | **FORGE-OPS-0001** in zwei Teilen. **A (Einstellungen):** MD-01 Org/Repo (nur Merge Commit, Actions-Token read, Actions darf PRs nicht approven), Team `forge-dev-codex`, Codex-Git-Identität auf noreply, Audit-Log-Beleg des Spikes, S1-Actions-Event-Policy, Rulesets #3–#10, dann #2, dann #1 **ohne** Required Checks (FREEZE §9.6 Schritte 1–3). **B (Owner-PR `forge/owner/ops-0001`):** `.gitattributes`, `.nvmrc`, `.github/CODEOWNERS`, `forge/policy.json` v1, `forge/roles/*.md`, `forge/ops/{IDENTITY-SPIKE,S1-RESULT,RULESETS,ARCHITECTURE-FREEZE-V0.1}.md`, Löschung `forge/coordination/*`, BASELINE-Absatz. PR #2 schließen. | Seb | Betriebsgrundlage | OE-1, OE-3, OE-5, H1/H2/H3/H8 | **BLOCKED** (H-Konflikte, OPS-Package NOT AVAILABLE) |
| **F2** | **FORGE-VERIFIER-0001** Bootstrap-Run (Format 1, Hash `341ec983…`): Diff-/Pfad-Autorität, rein | Codex | `src/forge-verifier/` Teil 1 | F1, Architektur-Review des Drafts, Contract-PR registriert | Draft bereit |
| **F3** | **FORGE-CORE-0002** Bootstrap-Run (Format 1): Format 2 im Kern, `isProtectedPath`, `runBase`, Wegfall Koordinations-Ausnahme | Codex | Kern Format 2 | F1, Draft + Review | Draft NOT AVAILABLE |
| **F4** | **FORGE-VERIFIER-0002** Bootstrap-Run: Git-Fakten, Registrierungs-Invarianten, Commit-Walk, Quittung, Lane, Limits, `SPEC_STALE`, `MAIN_MOVED` | Codex | Gate-Regeln | F2, F3 | nicht spezifiziert |
| **F5** | **FORGE-VERIFIER-0003** Bootstrap-Run (Sandbox, Inventar, Evidence, Workflow `forge-verify.yml`, Image-Digest) **ohne** Review-/Packet-Prüfung (DV-1); danach Owner-Smoke-PR `forge/owner/checks-smoke`, beide Checks grün, **erst dann** Required Checks in #1 eintragen; bösartiges PR-Set X-01…X-22, X-28…X-33 | Codex, dann Seb | aktiver Verifier | F4 | nicht spezifiziert |
| **F6** | **Erster echter Run: MYST-0001 PlayerRef V1** (§7), Run 1 mit Injektionen (geschlossen), Run 2 Abnahme | Codex, Reviewer, Seb | erster Forge-managed Merge | F5, Contract registriert | Draft-Contract liegt bei |

**DV-1 (Abweichung von FREEZE §16):** FORGE-PLAT-0001 (maschinelle Prüfung von `FORGE REVIEW v1`/`FORGE ATTEST v1`, Findings-Carry-Forward, Review Packet) rückt von Position 5 auf **direkt nach F6**. Für den ersten echten Run ist die Attestation trotzdem eindeutig: Blockgrammatik FREEZE §5.9 ist fix, der Owner prüft nach `attestation-checklist.md`, und PLAT-0001 kann nach seinem Merge die Reviews dieses PRs nachträglich maschinell nachprüfen (die Blöcke liegen unveränderlich in der PR-Historie). Ersparnis: ein Bootstrap-Run vor dem ersten echten Run; F5 wird kleiner. Ohne DV-1 hat der Pfad sieben Schritte (FREEZE-Reihenfolge). PLAT-0001 bleibt Pflicht vor dem zweiten produktiven Mystery-Run (FREEZE MP-Liste).

**Aussperrschutz (bindend für F1/F5):**

| Risiko | Regel |
|---|---|
| L-1 „Require approval of the most recent reviewable push“ in #1 bei Required approvals 0: Für Owner-PRs (Owner ist letzter Pusher und kann den eigenen PR nicht approven) ist die Wirkung hier nicht belegt | #1 zuerst **ohne** dieses Häkchen aktivieren; Positivtest „Owner-PR mergebar“ und Negativtest „Codex kann nicht mergen“ in `forge/ops/RULESETS.md`; Häkchen nur setzen, wenn der Positivtest danach noch besteht (OE-9) |
| L-2 Required Checks, die nie laufen | erst nach grünem Smoke-PR (F5) eintragen; vorher nie |
| L-3 `pull_request_target` wird in öffentlichen Repos ab **2026-11-02** per Default-Policy blockiert (PAC PA-30) | S1-Policy in F1-A, Positivtest in F5 wiederholen; liegt F6 nach dem 02.11., Positivtest erneut (FREEZE MP-06) |
| L-4 `forge-halt` | bleibt **disabled**; Aktivieren sperrt auch den Owner |
| L-5 Notausgang | Org-Admin kann Rulesets immer bearbeiten; jede Änderung mit Grund in `forge/ops/RULESETS.md` nachtragen |

**AFTER FIRST RUN:** FORGE-PLAT-0001; restliche bösartige PRs X-23…X-27 (Review-Abschnitt); Attestations-Nachprüfung des F6-PRs; Entfernen von Format 1 aus der Policy.
**DEFER:** alles aus FREEZE §2.3 und §2.4 (VERIFIER-0004 Mutantenlauf, parallele Runs, Status-Projektion, Eventlog, Leases, Recovery-Automatik, PWA, Backend, Postgres, Queue).

---

## 3. Mystery Critical Path

Ziel: **HEADLESS PLAYABLE MYSTERY VERTICAL SLICE** = ein Testlauf, der „Der Brieföffner“ als Paket lädt, eine Session startet, über PlayerRefs ermittelt, einen NPC befragt, eine Anklage erhebt, `solved` erhält, speichert, lädt und per Replay bytegleich reproduziert, ohne dass eine kanonische ID den Spielerkanal erreicht.

### 3.1 Wer wirklich separat sein muss

| Kandidat | Separat? | Grund |
|---|---|---|
| VS-1 Accusation & Verdict | **ja** | eigene Datei, ändert `case-solution.ts` additiv, 205–280 Zeilen |
| VS-2 Evidence Access | **ja** | eigene Datei, 260–320 Zeilen, keine Abhängigkeit außer TASK-0001 |
| VS-3 Dialogue Policy Engine | **ja** | existierender Contract TASK-0005 (≤ 550 Zeilen), nur Migration auf v3 |
| PlayerRef V1 | **ja** | von Seb als eigener Task gesetzt; unabhängig (§5) |
| VS-4 Interrogation + Release + NPC→Player-Bridge | **ja, ein Task** | Bridge und Adapter teilen dieselbe Übersetzungstabelle; getrennt von PlayerRef V1 |
| VS-5A Package | **ja** | Bündelung, Bindungen, Salt, Briefing; Voraussetzung für 5B |
| VS-5B Session | **ja** | größter Block (Reducer, abgeleitetes Spielerwissen, PlayerRef-Fassade) |
| VS-5C Save/Replay + Headless E2E | **ja, aber zusammenlegbar mit 5B**, falls der 5B-Contract unter 260 Zeilen bleibt | Replay ist eine Faltung über `applyCommand`; separat lassen, weil das Laden fremder Saves eigene Angriffsfläche ist |
| VS-6 Solvability Witness | **nein, nach der Slice** | Zertifikat, nicht Spielbarkeit; SOLV verlangt Briefing-Erweiterungen, die erst nach 5A feststehen |

### 3.2 Die acht Tasks bis zur Slice

| # | ID (Vorschlag, §8) | Arbeitstitel | Abhängigkeiten (Code) | Produktionszeilen (Grenze) | Grundlage |
|---|---|---|---|---|---|
| M1 | MYST-0001 | PlayerRef V1 | TASK-0001 (legacy) | 140–200 (**220**) | §6 Draft |
| M2 | MYST-0002 | Accusation & Verdict (VS-1) | TASK-0003 (legacy) | 205–280 (**300**) | AVD, FREEZE §15.2 |
| M3 | MYST-0003 | Evidence Access (VS-2) | TASK-0001 (legacy) | 260–320 (**350**) | VS2 §15 |
| M4 | TASK-0005 v3 | Dialogue Policy Engine (VS-3) | TASK-0004 (legacy) | ≤ 550 (**550**) | Contract v2 `1e6f36e5…` → Format 2 |
| M5 | MYST-0004 | Interrogation + Translator-Bridge (VS-4) | TASK-0005, MYST-0001, TASK-0004 | 250–350 (**380**) | ROAD VS-4 + Translator (unten) |
| M6 | MYST-0005 | Case Package (VS-5A) | MYST-0001, MYST-0003, MYST-0004, TASK-0002 | 140–220 (**250**) | ROAD VS-5, SOLV §9.4 |
| M7 | MYST-0006 | Case Session (VS-5B) | MYST-0002, MYST-0005 | 280–380 (**400**) | ROAD VS-5 |
| M8 | MYST-0007 | Save/Replay + Headless E2E (VS-5C) | MYST-0006 | 120–200 (**250**) | ROAD VS-5/§8/§9 |

Kritischer Pfad (Runs nacheinander, Single Lane): **M4 → M5 → M6 → M7 → M8**. M1, M2, M3 haben keine gegenseitigen Abhängigkeiten; M1 muss vor M5 abgenommen sein, M3 vor M6, M2 vor M7.

Run-Reihenfolge (Empfehlung): **M1 (= erster echter Run, F6)** → PLAT-0001 → M2 → M3 → M4 → M5 → M6 → M7 → M8. Contracts aller acht dürfen parallel geschrieben, reviewt und registriert werden (FREEZE P-3/P-6).

### 3.3 Festlegungen, die die Tasks zusammenhalten

- **Interne Module bleiben bei Domain-IDs.** VS-1 (`AccusationInput` mit Roh-IDs), VS-2 (`PlayerEvidenceView` mit `{kind, id}`) und TASK-0005 werden **nicht** auf PlayerRefs umgebaut. Die Übersetzung ID ↔ PlayerRef geschieht ausschließlich an der Spielerfassade in M7 (Session) und in der Bridge M5. Begründung: VS2 D-11 hat genau diese 1:1-Ersetzbarkeit vorgesehen; keine Revision fertiger Designs.
- **PlayerRefs nur für die fünf Entitätsarten.** Propositionen und Conclusions erreichen den Spieler als Claims über Entitäts-PlayerRefs, nie als eigene Referenz. Eine Anklage wird spielerseitig als Literale über PlayerRef-Claims eingegeben und in M7 in `AccusationInput` mit Domain-IDs übersetzt.
- **Translator-Bridge (M5).** `createInterrogation(...)` erhält PlayerRef-Index, Truth, Solution, Snapshot und Profil **als explizite Argumente** und erzeugt pro Aufruf einen transienten Translator-Wert (PlayerRef → Domain-ID → Original-`VisibleRef` des Kontexts und zurück), der als Argument durchgereicht und danach verworfen wird. Kein modulweiter oder versteckter `WeakMap`-Zustand in M5. Die privaten `WeakSet`s **innerhalb** der TASK-0005-Engine (Herkunftsprüfung, Contract §7.1) sind davon unberührt; sie sind Engine-intern und freigegeben.
- **Resolution ≠ Authorization.** M1 löst nur auf; M7 entscheidet mit `knownEntities(package, session)` und `UNKNOWN_TO_PLAYER`, ob eine aufgelöste Entität benutzt werden darf. Unbekannt, nicht existent und nicht auflösbar kollabieren an der Spielerfassade auf einen Code.
- **Salt im Paket.** M6 speichert `refSalt` im Paket, baut den Index, mappt `REF_COLLISION`/`REF_SALT_INVALID` auf einen Paketfehler ohne Detail für Spieler.
- **E2E in M8.** Der vollständige headless Durchlauf aus ROAD §8/§9 ist Akzeptanztest von M8.

---

## 4. Parallelization Matrix

Provider: Codex und ChatGPT = OpenAI; Claude = Anthropic; Grok = xAI (verfügbar ab **Montag 2026-10-05**); Owner = human. Bindende Regeln (FREEZE §4.3): Architektur-Reviewer ≠ Provider des Spec-Autors; Code-Reviewer ≠ Provider des Developers (also nie ChatGPT für Codex-Runs). Zusätzliche Präferenz (Seb): Spec-Autor-Provider ≠ Code-Reviewer-Provider, wo möglich. Bis Montag ist der Code-Reviewer für Codex-Runs eine **frische Claude-Session ohne Projektdateien** (FREEZE OE-1 (a)); ab Montag Grok.

| Task | SPEC AUTHOR | ARCHITECTURE REVIEWER | DEVELOPER | CODE REVIEWER | OWNER ACTION |
|---|---|---|---|---|---|
| FORGE-OPS-0001 | Claude (Package NOT AVAILABLE hier; Autor des externen Packages) | ChatGPT | Seb (Einstellungen, Owner-PR) | ChatGPT (Textdateien; Owner-Provider human ⇒ frei) | H1/H2/H3/H8 auflösen, Einstellungen, S1-Tests, Negativ-Drills, Owner-PR mergen, PR #2 schließen |
| FORGE-VERIFIER-0001 | Claude (Draft vorhanden) | ChatGPT | Codex | Grok (Fallback: Claude frisch) | Quelle bestätigen (OE-11), Contract-PR pushen, Review attestieren, registrieren, Code-Review attestieren, mergen |
| FORGE-CORE-0002 | laut Seb vorbereitet, Autor unbekannt (NOT AVAILABLE) | Provider ≠ Autor (ChatGPT, wenn Claude-Entwurf) | Codex | Grok | Draft hochladen, attestieren, mergen |
| FORGE-VERIFIER-0002 | Claude | ChatGPT | Codex | Grok | attestieren, mergen |
| FORGE-VERIFIER-0003 | Claude | ChatGPT | Codex | Grok | attestieren, mergen, Smoke-PR, Required Checks, bösartiges PR-Set |
| MYST-0001 PlayerRef V1 | Claude (Draft liegt bei) | ChatGPT (+ Grok optional als zweite Stimme) | Codex | Grok | Restentscheidungen PR-D1…PR-D6, Run 1 schließen, Run 2 mergen |
| FORGE-PLAT-0001 | Codex | Claude | Codex | Grok | attestieren, mergen |
| MYST-0002 Accusation (VS-1) | Claude (AVD) | ChatGPT | Codex | Grok | D1–D10 bestätigen |
| MYST-0003 Evidence (VS-2) | Codex (aus VS2 §15) | Claude | Codex | Grok | OD-1…OD-11 bestätigen |
| TASK-0005 v3 Dialogue (VS-3) | Codex (Migration des eigenen v2) | Grok (unabhängig vom Claude-APPROVE auf v2) | Codex | Claude frisch | Migration freigeben, 550-Zeilen-Grenze bestätigen |
| MYST-0004 Interrogation + Bridge | Claude | ChatGPT; Red-Team Grok | Codex | Grok | attestieren, mergen |
| MYST-0005 Package | Codex | Claude | Codex | Grok | Briefing-Felder aus SOLV §9.4 aufnehmen oder ablehnen |
| MYST-0006 Session | Claude | ChatGPT; Red-Team Grok | Codex | Grok | attestieren, mergen |
| MYST-0007 Save/Replay + E2E | Claude | ChatGPT | Codex | Grok | E2E-Abnahme |

Gleichzeitig möglich: Specs und Architektur-Reviews aller Zeilen laufen parallel zu jedem Codex-Run; Codex schreibt Contracts (PLAT-0001, VS-2, VS-3 v3, Package), während kein Run offen ist oder zwischen Runs. Nicht parallel: zwei Runs (Single Lane), zwei Attestationen desselben PRs, Owner-PRs während ein Run-PR „Ready for review“ ist (P-5).

Kapazitätsengpass ist **Seb** (jede Attestation, jede Registrierung, jeder Merge). Pro Task mindestens fünf Owner-Handgriffe (Contract pushen, Architektur-Review attestieren, registrieren, Code-Review attestieren, Run mergen).

---

## 5. PlayerRef V1 Preflight

Prüfung jeder vorgegebenen Richtung gegen den Code auf `3d7545d`:

| Vorgabe | Code-Befund | Ergebnis |
|---|---|---|
| opaque PlayerRef | kein bestehender Typ dieses Namens; `VisibleRef` (TASK-0004) ist projektionslokal `{kind, index}` und bleibt unberührt | umsetzbar, neue Datei |
| Arten person/location/item/event/evidence | alle fünf als ID-Schemas und Collections in `CaseTruth` vorhanden; identisch mit `AwarenessKind` der Projektion | ✓ |
| keine Proposition/Conclusion-PlayerRefs | Typ und Index schließen sie aus | ✓ |
| deterministische Ableitung, SHA-256 | `node:crypto` `createHash` ist im Domain-Code etabliert (`case-truth.identity.ts`) | ✓ keine neue Dependency |
| 128-Bit-refSalt | Autoreneingabe, 32 Hex; kein Zufall im Domain-Code nötig | ✓ |
| 80-Bit-Ausgabe | 10 Bytes → 16 Crockford-Base32-Zeichen, exakt ohne Padding | ✓ |
| kind Teil der Ableitung | Preimage-Feld | ✓ |
| package-bound | Paket existiert nicht. Bindung V1 = Salt (pro Paket) + `caseId` + `hashCaseTruth(truth)` | ✓ ohne CasePackage |
| Collision = Build-Fehler, keine Verlängerung | `REF_COLLISION`, kein Teilindex | ✓ testbar nur mit Digest-Port (echte 80-Bit-Kollision ist nicht findbar) |
| ASCII | IDs sind per Schema ASCII; Ausgabe ASCII | ✓ |
| keine kanonischen IDs in Spielerfehlern | ein Spielerfehlercode `REF_UNRESOLVED` ohne Felder | ✓ |
| resolution ≠ authorization | Modul ohne Wissensmodell; Contract-Regel + Test | ✓ |
| keine VisibleRef-Bridge, keine WeakMap | Non-Goal + Quelltext-Test | ✓ |
| Kollisionsrisiko | 14 Entitäten im Testfall; Wahrscheinlichkeit für 1 000 Entitäten ≈ 4·10⁻¹⁹ (RUN, Formel n²/2⁸¹) | vernachlässigbar, trotzdem harter Fehler |

**Ergebnis: JA, PlayerRef V1 ist unabhängig vom vollständigen CasePackage implementierbar.** Benötigt werden nur `CaseTruth`, `hashCaseTruth` und ein vom Aufrufer gelieferter Salt; alle drei existieren oder sind reine Eingaben.

Restentscheidungen, die der Draft mit Default belegt (Owner kann ändern, jede Änderung ist eine Contract-Revision vor Registrierung, keine nach):

| # | Frage | Default im Draft | Alternative |
|---|---|---|---|
| PR-D1 | Stringform | `pr1_` + 16 Crockford-Zeichen, Art nicht sichtbar | Artpräfix (`p_`, `l_`…) erleichtert UI, verrät aber die Art |
| PR-D2 | Bindung | Salt + `caseId` + `truthHash` | nur Salt (Refs überleben Truth-Revisionen; Saves sind ohnehin an `truthHash` gebunden) |
| PR-D3 | Spielerfehler | ein Code `REF_UNRESOLVED` für alles | getrennt `REF_MALFORMED` (Form ist öffentlich, harmlos) |
| PR-D4 | Kollisionstest | optionaler Digest-Port mit Default | interne Hilfsfunktion exportieren (größere API) |
| PR-D5 | Null-Salt | verboten | erlaubt (nur Formprüfung) |
| PR-D6 | Eingabe-Normalisierung | keine (exakt) | Crockford-Faltung `I/L→1`, `O→0`, Kleinschreibung |

---

## 6. PlayerRef Draft Contract

Datei: `/mnt/project-files/forge-audits/MYST-0001-PLAYERREF-V1.contract.DRAFT.md` (Zielpfad bei Registrierung `forge/contracts/MYST-0001.md`, bytegleich).

| Eigenschaft | Wert |
|---|---|
| Format | 2 (FREEZE §5.3–§5.5): `specifiedAgainst` `3d7545d…`, `reads` (3 Dateien), `scope.create` 4 Dateien, `modify` leer, 8 Mutanten mit Pflichtankern, `limits` 220/4, `findings` leer, Legacy-Dependency TASK-0001, End-Marker |
| Größe | 20 659 Bytes, Git-Blob `1a08704965b9d4044f77a3f1a4d8df4e4a980e4e` |
| contentHash (vorläufig) | `f4d3185898015901fad3155fdc37836652c486b028b30528ca4beb17f3726335` = SHA-256(`forge-contract-v2\n` ‖ Bytes) nach FREEZE §5.4 |
| Hier geprüft (RUN) | Frontmatter kanonisch (`JSON.stringify(…, null, 2)` bytegleich); keine CR/BOM/C0/Bidi/Zero-Width; keine verbotenen Statuszeilen; H1 = Titel; End-Marker letzte Zeile |
| Nicht geprüft | Parse mit einem Format-2-Parser (existiert erst nach F3/FORGE-CORE-0002); Gate-Regeln (nach F4). Diese Punkte sind **nicht PASS** |
| Testvektoren | V-01…V-05 und V-10 (14-Einträge-Index für `fullCase()`) mit zwei unabhängigen Werkzeugen berechnet (Python `hashlib` und `printf | sha256sum`; Base32 zweimal unabhängig kodiert); `GOLDEN_SHA256` und der `fullCase()`-Hash mit dem echten `hashCaseTruth` auf `main` ermittelt |
| Implementiert | **nein** |

Der Draft ist Text, keine Freigabe. Vor Registrierung: Architektur-Review (ChatGPT; Spec-Autor Claude), Entscheidung OE-2 (ID-Schema), PR-D1…PR-D6.

---

## 7. First Forge Drill Selection

Gemeint ist der Task für F6, den ersten Run mit aktivem Verifier.

| Kriterium | A. winziger Drill (FREEZE `FORGE-DRILL-0001` Parse-Report bzw. Mini-Kernänderung) | **B. PlayerRef V1 (MYST-0001)** | C. Accusation & Verdict (VS-1) |
|---|---|---|---|
| Risiko | gering fachlich; als Kernvariante berührt er `src/forge/**` (Stufe `forge`, Dogfood-Test verlangt Scope in einem `FORGE-CORE-*`-Contract) | gering bis mittel: kleine Fläche, aber Spoiler-Grenze | mittel: Antwortschlüssel-Logik, D1–D10 offen |
| Produktionszeilen | 80–110 (Kern: 20–60) | 140–200, Grenze 220 | 205–280, Grenze 300 |
| Bestandsdateien geändert | nein (Kern: ja) | **nein** | ja (`case-solution.ts`, additiv) |
| Testbarkeit | gut | **sehr gut**: Vektoren ohne Projektcode per `sha256sum` nachrechenbar; 8 Anker | gut: 46-Fälle-Matrix, 8 Mutanten |
| Security-Relevanz | gering (Kern: hoch, Vertrauensanker) | mittel, eng begrenzt (Orakel, Leak, Kollision) | mittel (Verdict-Leak, D8) |
| Fachlicher Nutzen | keiner bzw. Diagnosekomfort | **hoch**: blockiert M5, M6, M7 | hoch: Siegbedingung |
| Eignung Contract → Developer → Verifier → Review → Merge | gut, aber testet nur den einfachsten Pfad | **gut**: reiner `create`-Scope, harte Limits, Mutanten am Head trivial anwendbar, Reviewer kann Vektoren unabhängig prüfen | gut, testet zusätzlich `scope.modify`; besser als zweiter Produkt-Run |
| Offene Entscheidungen | keine | PR-D1…D6 (Defaults gesetzt) | D1–D10 |
| Abhängig von unfertigen Modulen | nein | **nein** | nein |

**Auswahl: B, PlayerRef V1 (MYST-0001).** Kleinster Task mit echtem Nutzen, keine Bestandsdatei, keine Abhängigkeit von ungebautem Code, die stärkste unabhängige Prüfbarkeit, und er gibt dem kritischen Mystery-Pfad (M5) den Vorlauf. Run 1 (Injektionen nach DRILL §8, Contract-Injektionen auf Wegwerf-IDs `FORGE-DRILL-09xx`) wird geschlossen, Run 2 abgenommen. C folgt als zweiter Produkt-Run und deckt `scope.modify` ab.

**DV-2:** FREEZE §14 sieht `FORGE-DRILL-0001` (Parse-Report) als Drill und VS-1 als ersten produktiven Run vor. Dieser Plan ersetzt den Drill-Task durch MYST-0001; die Drill-Mechanik (zwei Runs, Injektionen, `forge/ops/DRILL-0001.md`) bleibt. Das Kriterium „V0.1 fertig“ (FREEZE §18) verschiebt sich entsprechend: erster produktiver Mystery-Run nach PLAT-0001 ist MYST-0002.

---

## 8. Task-ID / Naming Plan

### 8.1 Inventar (Repo alle Refs + Projektdateien; GIT, DOC)

| ID | Bedeutung(en) | Kollision |
|---|---|---|
| TASK-0001, 0001a, 0002, 0003, 0004 | Mystery-Legacy, auf `main` | keine |
| TASK-0005 | Dialogue Policy; Contract v2 nur auf Side-Branch | keine; bleibt die ID für VS-3 |
| **TASK-0006** | (a) Verbalization/ConversationState im TASK-0005-Review auf `main`; (b) Accusation/VS-1 laut T6 §5 und FREEZE OE-2; (c) VS-2 als Option in VS2 OD-10; (d) synthetische Fixture in `tests/forge-red-team/differential.test.ts` auf `main` | **drei Bedeutungen plus Fixture** |
| TASK-0007…0010 | Roadmap-Platzhalter in T6/VD | weich belegt |
| TASK-0009, 0100, 0200, 9999 | synthetische IDs in Kerntests auf `main` | Fixture-Belegung |
| FORGE-CORE-0001A/B, -PATCH-0001 | Legacy-Kern | keine |
| FORGE-CORE-0002 | Kern Format 2 (FREEZE) | keine |
| FORGE-CORE-0003 | Run-Verifier in MP (veraltet) | Altbedeutung |
| FORGE-OPS-0001 | Betriebsgrundlage (FREEZE) | keine |
| FORGE-OPS-0002, 0003 | Verifier-Spike bzw. Status-Projektion in MP/HP/VD (veraltet) | Altbedeutung |
| FORGE-VERIFIER-0001…0004, FORGE-PLAT-0001, FORGE-DRILL-0001 | FREEZE | keine |
| FORGE-DRILL-0901 ff., FORGE-X-0001 ff. | Wegwerf-IDs für Injektionen/bösartige PRs | keine |
| VS-1…VS-6, VS-5A/B/C | Arbeitstitel | erfüllen `TaskIdSchema` (`VS-1` ist formal gültig) |
| MYST-0001 | Option in FREEZE OE-2 | frei |

### 8.2 Schema ab sofort

1. **Mystery-Produkt-Tasks: `MYST-NNNN`**, beginnend bei `MYST-0001`. `TASK-NNNN` wird nicht weiter vergeben. Ausnahme: **TASK-0005** behält seine ID (Fortsetzung, v3 mit `supersedes.format: "legacy"`).
2. **TASK-0006 wird nie vergeben.** Zu viele Bedeutungen in eingefrorenen Dateien; jede künftige Erwähnung wäre mehrdeutig. (Abweichung von der FREEZE-Empfehlung zu OE-2; die FREEZE nennt `MYST-0001` als Option.)
3. **Forge-Tasks: `FORGE-<KOMPONENTE>-NNNN`** mit genau den Komponenten `OPS`, `CORE`, `VERIFIER`, `PLAT`, `DRILL`. Nummern je Komponente fortlaufend.
4. **Retired, nie vergeben:** `FORGE-CORE-0003`, `FORGE-OPS-0002`, `FORGE-OPS-0003` (Altbedeutungen in Berichten). Nächste freie Nummern: CORE-0004, OPS-0004.
5. **Wegwerf-Bereiche:** `FORGE-DRILL-0900…0999` für Contract-Injektionen, `FORGE-X-0001…` für bösartige PRs; nie gemergt.
6. **Arbeitstitel `VS-n` sind nie Task-IDs**; Contracts nennen sie nur im Titel.
7. **Registry:** `forge/ops/TASK-IDS.md` (Owner-PR in F1-B) mit Zeilen `ID | Titel | Status (reserved/registered/accepted/abandoned/retired) | Contract-Commit`. Eine ID ist ab Eintrag verbraucht, auch wenn der Task aufgegeben wird. Historische Dateien werden nicht umbenannt.

### 8.3 Vergabe jetzt

| ID | Inhalt |
|---|---|
| MYST-0001 | PlayerRef V1 |
| MYST-0002 | Accusation & Verdict (VS-1) |
| MYST-0003 | Evidence Access (VS-2) |
| TASK-0005 (v3) | Dialogue Policy Engine (VS-3) |
| MYST-0004 | NPC Interrogation + Translator-Bridge (VS-4) |
| MYST-0005 | Case Package (VS-5A) |
| MYST-0006 | Case Session (VS-5B) |
| MYST-0007 | Save/Replay + Headless E2E (VS-5C) |
| MYST-0008 | reserviert: Solvability V1 (VS-6) |

---

## 9. Tomorrow Morning Queue

Sonntag 2026-10-04. Grok ist erst Montag verfügbar.

| | NOW-1 | NOW-2 | NOW-3 | NOW-4 | NOW-5 |
|---|---|---|---|---|---|
| **Task** | Owner-Entscheidungen §11 treffen; fehlende Artefakte in `/mnt/project-files/` ablegen (OPS-0001-Package, CORE-0002-Draft, H1/H2/H3/H8-Auflösung, VS-5-Preflight, PlayerRef-Studie); OE-5: Audit-Log-Zitat des Spike-Pushes notieren | Architektur-Review FORGE-VERIFIER-0001 | Architektur-Review MYST-0001 PlayerRef V1 | Reconciliation FORGE-CORE-0002 gegen `main` `3d7545d` | Contract-Entwurf MYST-0003 Evidence Access (VS-2), Format 2, `Forge-Spec-Author: codex` |
| **Agent** | Seb | ChatGPT | ChatGPT (eigene Unterhaltung) | Claude | Codex |
| **Input** | dieser Plan §11; FREEZE §19 | `FORGE-VERIFIER-0001.contract.DRAFT.md` (Hash `341ec983…`), FREEZE §3.2/§5.10/§7, Repo @ `3d7545d` | `MYST-0001-PLAYERREF-V1.contract.DRAFT.md`, `src/domain/case-truth*.ts`, `tests/case-truth.fixture.ts` @ `3d7545d`, Plan §5 | CORE-0002-Draft (aus NOW-1), FREEZE §5, §16.2 Zeile 3 | `MYSTERY-VS2-IMPLEMENTATION-DESIGN.md` §12–§15 (von Seb übergeben, Codex sieht die Projektdateien nicht), FREEZE §5.3–§5.5, Repo @ `3d7545d` |
| **Erwarteter Output** | Entscheidungen OE-1…OE-11 als kurze Datei in den Projektdateien; Artefakte hochgeladen | `FORGE REVIEW v1`-Block (APPROVE oder REQUEST_CHANGES mit F-IDs), gebunden an Hash `341ec983…` | `FORGE REVIEW v1`-Block, gebunden an contentHash `f4d31858…` und Blob `1a087049…`; Stellungnahme PR-D1…D6 | reconcilierter Format-1-Draft mit Parser-Hash und Faktentabelle, oder exakte Abweichungsliste | Contract-Text (Datei an Seb, **kein Push**) |
| **Blocker** | keiner | keiner | keiner | **Draft NOT AVAILABLE** bis NOW-1 ihn ablegt. Ersatz bei Leerlauf: Claude schreibt MYST-0002 (VS-1) Format-2-Entwurf aus AVD mit D1–D10-Defaults | Seb muss die Design-Datei an Codex geben |
| **Parallel mit** | allen | NOW-1, NOW-4, NOW-5 | NOW-1, NOW-4, NOW-5 (NOW-2 in anderer Unterhaltung) | NOW-1, NOW-2, NOW-3, NOW-5 | NOW-1…NOW-4 |

### NEXT (nach NOW, in dieser Reihenfolge)

1. F1-A Einstellungen und Rulesets mit Aussperrschutz L-1…L-5 (Seb), sobald H1/H2/H3/H8 aufgelöst sind.
2. F1-B Owner-PR mit Policy, Rollen, Ops-Nachweisen, `TASK-IDS.md`; PR #2 schließen.
3. Contract-PRs `forge/contract/FORGE-VERIFIER-0001-v1` und (wenn Draft vorhanden) `forge/contract/FORGE-CORE-0002-v1` pushen, Reviews attestieren, registrieren.
4. F2 Codex-Run FORGE-VERIFIER-0001 (Bootstrap), Code-Review Grok (Montag), Merge.
5. F3 Codex-Run FORGE-CORE-0002 (Bootstrap).
6. Parallel: Claude spezifiziert VERIFIER-0002 und VERIFIER-0003 (ohne Review-/Packet-Teil, DV-1); Codex spezifiziert PLAT-0001 und TASK-0005 v3.

### LATER

F4 VERIFIER-0002 → F5 VERIFIER-0003 → Smoke-PR → Required Checks → bösartiges PR-Set → **F6 MYST-0001 (Run 1 Injektionen, Run 2 Abnahme)** → PLAT-0001 → MYST-0002 → MYST-0003 → TASK-0005 v3 → MYST-0004 → MYST-0005 → MYST-0006 → MYST-0007 (Headless Slice) → MYST-0008 Solvability.

---

## 10. Deferred Work

| Was | Wann |
|---|---|
| FORGE-PLAT-0001 | direkt nach F6 (DV-1) |
| Bösartige PRs X-23…X-27 (Review-Abschnitt) | mit PLAT-0001 |
| FORGE-VERIFIER-0004 (Mutantenlauf im Verifier), parallele Runs, Status-Projektion, Eventlog-Projektion, Leases, Owner-Kommandos, signierte Commits, `protectedPathOverrides` | FREEZE §2.3 V0.2 mit Auslöser |
| Claude als Developer (`forge-claude`) | nach V0.1 (OE-4) |
| Solvability V1 (MYST-0008) | nach der Slice |
| Verbalization, ConversationState, Konfrontation, natürliche Sprache, Runtime-LLM | nach der Slice |
| Zeitmodell für Evidence, Versuchslimits, Hints, Formular-/Closed-World-Adapter | nach der Slice |
| Map-Identität `hashEvidenceAccessMap` | in MYST-0005, nur falls das Paket sie braucht |
| PWA, Backend, Postgres, Queue, SSE, Cloud-Runner, Merge Queue, Team-Plan | FREEZE §2.4 DEFERRED |
| Recovery-Automatik, Reconciler, NEEDS_HUMAN-Katalog | DEFERRED; V0.1 nutzt nur GitHub-Mechanismen (FREEZE §11) |
| Löschen von Legacy-Branches, Approval-Dateien | nie in V0.1 |

---

## 11. Remaining Owner Decisions

| # | Entscheidung | Empfehlung |
|---|---|---|
| OE-1 | Reviewer-Besetzung | wie §4 |
| OE-2 | ID-Schema für Mystery | `MYST-NNNN`, TASK-0006 nie vergeben (§8); D1–D10 aus AVD als Arbeitsannahmen für MYST-0002 |
| OE-3 | öffentlich/Free | bleiben, solange S1 positiv |
| OE-4 | Claude nur lesend | ja (Stufe A) |
| OE-5 | Spike-Beleg + Codex-noreply-Identität + S1-Nachweis in `forge/ops/` | ja; der Spike-Commit selbst trägt nicht die noreply-Adresse (§1.2) |
| OE-6 | DV-1: PLAT-0001 nach dem ersten echten Run | ja (6 statt 7 Schritte) |
| OE-7 | DV-2: erster echter Run = MYST-0001 statt FORGE-DRILL-0001 | ja |
| OE-8 | PlayerRef PR-D1…PR-D6 | Defaults aus §5 |
| OE-9 | „Approval of the most recent reviewable push“ in `forge-main` | erst nach Positivtest für Owner-PRs (L-1) |
| OE-10 | Slice-Ende = MYST-0007 mit E2E; Solvability danach | ja |
| OE-11 | Ist `FORGE-VERIFIER-0001.contract.DRAFT.md` (Hash `341ec983…`) die gemeinte „exakte historische Quelle“? | bestätigen ⇒ Blocker aufgehoben |
| H1/H2/H3/H8 | Ruleset-/OPS-Konflikte | Auflösung ablegen; Inhalt hier NOT AVAILABLE |

---

## 12. GO / NO-GO Summary

| Gegenstand | Urteil | Bedingung / Grund |
|---|---|---|
| Owner-Entscheidungen, Artefakte hochladen (NOW-1) | **GO** | – |
| Architektur-Review FORGE-VERIFIER-0001 (NOW-2) | **GO** | Quelle hash-verifiziert |
| Architektur-Review MYST-0001 (NOW-3) | **GO** | Draft liegt bei |
| FORGE-CORE-0002 Review/Registrierung | **NO-GO** | Draft NOT AVAILABLE |
| Spike-Beleg, Codex-Identitätsumstellung, S1-Konfiguration | **GO** | unabhängig von H-Konflikten |
| Rulesets anlegen (F1-A Rest) | **NO-GO** | H1/H2/H3/H8 unaufgelöst; danach GO mit L-1…L-5 |
| Required Checks aktivieren | **NO-GO** | kein Workflow; erst nach grünem Smoke (F5) |
| Codex-Run FORGE-VERIFIER-0001 | **NO-GO heute**, GO nach F1 + Review + Registrierung | Single-Lane-Namensraum und Policy fehlen |
| Codex-Runs für Mystery-Tasks | **NO-GO** bis F5 | erster echter Run ist MYST-0001 |
| Mystery-Contracts schreiben und reviewen | **GO** | parallel erlaubt (P-3) |
| Backend/PWA/Recovery-Infrastruktur | **NO-GO** | DEFER |

Nächster Engpass ist nicht Code, sondern die Owner-Seite: H1/H2/H3/H8 und die zwei fehlenden Drafts entscheiden, ob F1 und F3 am Sonntag beginnen können.

**Keine Datei im Repository geändert, kein Commit, kein Branch, kein PR, keine Einstellung berührt.**
