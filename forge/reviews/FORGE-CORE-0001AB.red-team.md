# FORGE-CORE-0001A/B – Red-Team Report

| Feld | Wert |
|---|---|
| Rolle | Autor als adversarialer Red-Team-Tester. **Kein Self-Review im Sinne einer Freigabe, kein APPROVE.** |
| Geprüfter Forge-Stand | `bd3becb7dfbefc58089d69118f568bf32cab3b7d` (Produktionscode `src/forge/*` unverändert seit `8230f1d`) |
| Contracts | `forge/contracts/FORGE-CORE-0001A.md`, `forge/contracts/FORGE-CORE-0001B.md` (Stand `bd3becb`) |
| Produktionsänderungen | **keine** (kein Finding erfüllt die Bedingung „eindeutiger Bug innerhalb des bestehenden Contracts“; siehe §9) |
| Neue Tests | `tests/forge-red-team/` (test-only, absichtlich außerhalb des kontraktierten `tests/forge`-Scopes; siehe §8) |
| Adressat | späterer unabhängiger Reviewer |

## 0. Ergebnis in einem Satz

Ein differenzieller Fuzzer (unabhängiges Referenzmodell, ~2 700 akzeptierte und ~6 300 abgelehnte generierte Events über 30 Seeds, alle Task- und Run-Zustände, 24 Rejection-Codes) fand **keine** Abweichung zwischen Kernel und Contract-Regeln. Die Befunde liegen an den Rändern: ein **Contract-Loch in der Scope-Prüfung für Renames (MAJOR)**, mehrere Grenz-/Robustheitslücken (MINOR) und dokumentierte Vertrauensgrenzen (OBSERVATION). B22 bleibt für alle erreichbaren Zustände äquivalent.

| Severity | IDs |
|---|---|
| BLOCKING | – |
| MAJOR | RT-01 |
| MINOR | RT-03, RT-06, RT-10, RT-12 |
| OBSERVATION | RT-02, RT-04, RT-05, RT-07, RT-08, RT-09, RT-11, RT-13, RT-14, RT-15, PERF-1, PERF-2, PERF-2b, PERF-3 |

## 1. Findings

Jedes Finding ist als Test in `tests/forge-red-team/findings.test.ts` reproduziert („RT-xx documents …“). Diese Tests fixieren das **aktuelle** Verhalten und sollen bei einer späteren Contract-Änderung bewusst kippen.

### RT-01 – MAJOR: Rename ist ein Einzelpfad; die Coordination-Ausnahme verdeckt Renames in beide Richtungen

- **Commit / Ort:** `bd3becb`, `src/forge/runs.ts` `ChangedFileSchema`, `src/forge/verification.ts` `scopeViolations`; Contract 0001B §5 (`changedFiles: { path, change: … | "renamed" }`) und §8 (Coordination-Präfix wird *vor* allen anderen Regeln ignoriert).
- **Reproduktion:** `evaluateVerification(meta, report, { changedFiles: [{ path: "forge/coordination/TASK-0001.md", change: "renamed" }], … })` → `passed: true`.
- **Gegenbeispiele:**
  - `git mv forge/contracts/TASK-0001.md forge/coordination/TASK-0001.md`, vom Verifier als `git diff --name-status -M` mit Zielpfad erfasst → bestanden, obwohl der Contract von seinem Pfad verschwindet („contracts immer Verstoß“).
  - `git mv forge/coordination/note.md src/forge/evil.ts`, mit Quellpfad erfasst → bestanden, obwohl eine Datei außerhalb des Scopes entsteht.
  - Dieselbe Änderung mit dem jeweils anderen Pfad erfasst → Verstoß. Das Ergebnis hängt also von einer **nicht spezifizierten Konvention** ab.
- **Expected:** Ein Rename aus oder in einen Nicht-Coordination-Pfad ist immer ein Verstoß (§8 „renamed immer Verstoß“; „contracts/approvals immer Verstoß“).
- **Actual:** Ein Rename, dessen einziger erfasster Pfad unter `forge/coordination/` liegt, wird ignoriert.
- **Invariante:** 0001B §8 Scope, F8 (nur Coordination-Notizen sind ausgenommen).
- **Warum kein stiller Fix:**
  - Der Code setzt den Contract wörtlich um.
  - Die Reparatur braucht einen zweiten Pfad im Schema; das ist eine Contract-Änderung (neue Version).
- **Kleinste Reparatur (Contract-Revision):**
  - `ChangedFile` für `renamed` um `fromPath` erweitern.
  - Die Coordination-Ausnahme gilt nur, wenn **beide** Pfade unter dem Präfix liegen.
  - Alternativ als Boundary-Regel: Verifier erfassen ohne Rename-Erkennung (`--no-renames`); dann gilt `renamed` nur noch für reine Coordination-Moves.

### RT-03 – MINOR: Widersprüchliche doppelte Check-Einträge bestehen

- **Ort:** `src/forge/runs.ts` `VerificationEvidenceSchema.checks`; `verification.ts` `evaluateVerification`; 0001B §8.
- **Reproduktion:** `checks: [{ name: "test", command: "npm test", exitCode: 1 }, { name: "test", command: "npm test", exitCode: 0 }]` → `passed: true`.
- **Expected (fail-closed):** Eine widersprüchliche Evidence wird abgelehnt. `changedFiles` sind bereits pfadeindeutig, `checks` aber nicht.
- **Actual:** `some(...)` findet den grünen Eintrag.
- **Reparatur:** Check-Namen in der Evidence eindeutig machen (Schema-Refinement analog zu `changedFiles`). Das ist eine Contract-Ergänzung, daher hier nicht umgesetzt.

### RT-06 – MINOR: Architektur-Approval darf ein `blocking` Finding tragen

- **Ort:** `state.ts` `approval_recorded`; 0001A §9.
- **Reproduktion:** `decide(hash, "approved", { findings: [{ severity: "blocking", … }] })` → akzeptiert, Task `ready`.
- **Expected:** symmetrisch zu Code Review 0001B §9 Regel 6 (`approve` ⇒ kein blocking Finding).
- **Actual:** Der Contract schweigt, der Kernel akzeptiert.
- **Reparatur:** In 0001A §9 Regel „approved ⇒ kein blocking Finding“ (`FINDINGS_INCONSISTENT` oder Wiederverwendung von `VERDICT_INCONSISTENT`) aufnehmen.

### RT-10 – MINOR: `applyEvent` vertraut dem übergebenen Zustand

- **Ort:** `state.ts` `applyEvent`; nur `POLICY_MISMATCH` wird geprüft.
- **Reproduktion:**
  1. `structuredClone(realState)`, darin `tasks[0].acceptance` setzen, ohne dass ein Event im Log steht.
  2. `applyEvent(forged, registerTask("TASK-0002"))` → `ok`.
  3. Der neue Zustand meldet `accepted`.
  4. `replay(newState.log)` ergibt `awaiting_review`.
- **Konsequenz:**
  - Nur `replay(log)` ist selbstauthentifizierend.
  - Ein gespeicherter oder übertragener `ForgeState` kann vom eigenen Log abweichen, ohne dass der Kernel es merkt.
  - Dadurch wäre B22 nicht mehr äquivalent (siehe §6).
- **Invariante:** 0001A §14.1 („jeder Zustand ist abgeleitet“) ist nur für Kernel-erzeugte Zustände garantiert. Der Contract legt nicht fest, dass `state` aus dem Kernel stammen muss.
- **Reparatur:**
  - Vertrauensgrenze im Contract festschreiben: Persistenz speichert den Log, nie den Zustand.
  - Optional: eine kernel-lokale `WeakSet` erzeugter Zustände mit Ablehnung fremder Zustände. Das braucht einen neuen Code und damit eine Contract-Änderung.

### RT-12 – MINOR: Werfende Getter oder Proxy-Traps entkommen `applyEvent`/`replay` als Exception

- **Ort:** `state.ts` `step` (`ForgeEventSchema.safeParse`); analog `canStartDeveloperRun`.
- **Reproduktion:** Event mit `get body() { throw … }` oder einem Proxy mit werfendem `ownKeys` → `applyEvent` wirft. Der Zustand bleibt unverändert, weil auf einem Klon gearbeitet wird.
- **Expected:** 0001A §13 beschreibt `applyEvent` als total (`{ ok } | { ok: false, rejection }`).
- **Actual:** Die Exception geht an den Aufrufer.
- **Bewertung:** Aus JSON-Logs nicht erreichbar, nur aus In-Process-Werten. Zod liest jeden Getter genau einmal (geprüft); es gibt also keinen TOCTOU-Effekt.
- **Reparatur:** `safeParse` in `try/catch` kapseln → `EVENT_SCHEMA` mit Pfad `[]`.
  - Das wäre vermutlich innerhalb des Contracts.
  - Bewusst **nicht** umgesetzt, weil der Contract Accessor-Eingaben nicht ausdrücklich adressiert. Entscheidung für den Reviewer.

### Observations (kein aktueller Vertragsbruch)

| ID | Beobachtung | Nachweis |
|---|---|---|
| RT-02 | Die Coordination-Ausnahme deckt **jede** Datei unter `forge/coordination/`, auch `CODEX.md` eines anderen Agenten (modified/deleted). Die Do-not-touch-Regel ist prozessual, nicht maschinell. | findings „RT-02“ |
| RT-04 | Die Mutationsliste des Verifiers **ersetzt** die des Developers. Ein vom Developer gemeldeter überlebender Mutant verschwindet, wenn der Verifier eine eigene Liste liefert (vertrauter Verifier, Contract §8 wörtlich). | findings „RT-04“ |
| RT-05 | `actorType`, `role` und Identität sind selbsterklärt. Daraus folgen mehrere Sybil- und Rollenkombinationen, siehe die Liste unter dieser Tabelle. | findings „RT-05“, Identitätsmatrix |
| RT-07 | Eine neue Contract-Version kann während eines aktiven Runs registriert und approved werden. Der Run endet `verified` auf einer superseded Revision, das Ergebnis wird still verworfen, ein Review ist unmöglich. | findings „RT-07“ |
| RT-08 | Ein Dependency-Zyklus A↔B ist nie freigebbar; es gibt nur `DEPENDENCY_NOT_ACCEPTED`, keine eigene Diagnose. Fail-closed, aber unauffällig. | findings „RT-08“ |
| RT-09 | Nach `remote_verified` sind weitere Beobachtungen `RUN_STATE_INVALID`. Ein späterer Force-Push, der das Ergebnis entfernt, ist nicht einmal aufzeichenbar; Persistenz ist ein Zeitpunkt-Fakt. | findings „RT-09“ |
| RT-11 | Geerbte Properties werden gelesen; Symbol- und nicht-enumerierbare Zusatzfelder werden still verworfen. Eigene `__proto__`/`constructor`/`prototype`-Keys werden abgelehnt. Eingaben werden nie mutiert. Der Log speichert Kopien mit `Object.prototype`. | findings „RT JavaScript object attacks“ |
| RT-13 | **Parser:** Stufe 1 prüft nur den Rohtext. Eine JSON-Escape-Sequenz `"\ud800"` erzeugt nach `JSON.parse` ein einzelnes Surrogat im Metadatenfeld `requiredChecks[].command`; das ist kanonisch und wird akzeptiert. Hash und Text bleiben eindeutig, ein späterer UTF-8-Export normalisiert aber zu U+FFFD. | Probe p3 |
| RT-14 | **Parser:** Kanonisches, sehr tiefes JSON (Tiefe ~6 000) wird je nach Stack-Größe als `FRONTMATTER_JSON` statt `METADATA_SCHEMA` klassifiziert. Abgelehnt wird immer, kein Crash; gültige Metadaten sind flach. | Probe p4 |
| RT-15 | **Schemas:** `RepoPath` akzeptiert `.git/config`, `.github/workflows/x.yml`, `...`, `-`. `RefName` akzeptiert git-ungültige Namen (`.`, `a.`, `/a`, `a/`, `x.lock`, `HEAD`, `__proto__` als String). Refs werden nur auf Gleichheit verglichen, Scope wird vom Contract-Autor festgelegt; kein Bypass. | Probe p3 |

Sybil- und Rollenkombinationen aus RT-05 (in V0.0 absichtlich nicht verhindert):

- dieselbe KI mit anderem `label` oder `model` gilt unter `different_identity` als unabhängig;
- ein anders geschriebener Provider-Slug (`vendor-a2`) gilt sogar unter `different_provider` als unabhängig;
- eine KI kann `actorType: "human"` erklären und dann abnehmen;
- eine Identität kann Developer, Observer und Verifier desselben Runs sein (Architekturentscheidung 2: Verifier-Unabhängigkeit ist nur Projektion).

## 2. State-Machine-Angriffe (Auftrag §1)

Jeder Punkt wurde durch Tests oder den Differential-Fuzzer abgedeckt:

| Szenario | Ergebnis |
|---|---|
| mehrere Tasks parallel, Runs verschiedener Tasks gleichzeitig aktiv | erlaubt; je Task höchstens ein aktiver Run (Property) |
| zwei aktive Runs desselben Tasks | `START_NOT_ALLOWED` (`RUN_ALREADY_ACTIVE`) |
| mehrere Contract-Versionen, changes_requested → neue Version | korrekt; neue Version erbt keine Entscheidung |
| code_change → neuer Run; contract_change → neue Version | korrekt (`rework_required` startbar, `contract_revision_required` nicht) |
| failed/abandoned Run → neuer Run | korrekt |
| mehrfach not_contained → contained | korrekt; negative Beobachtungen terminieren nie |
| accepted → weitere Events | alle task-bezogenen Events abgelehnt; Property „Task-Record und Runs eines akzeptierten Tasks ändern sich nie wieder“ |
| superseded Contract → Runversuch | `CONTRACT_NOT_CURRENT` |
| alter verified Run nach neuer Version | verliert Wirkung (RT-07); Review `RUN_NOT_LATEST_VERIFIED` |
| Review eines alten Runs | `RUN_NOT_LATEST_VERIFIED` (vom Fuzzer erreicht) |
| Dependency später accepted | dieselbe Draft-Version wird nach der Abnahme freigebbar (keine Entscheidung wurde gespeichert) |
| mehrere Dependencies | T4 → {T2, T3} im Fuzzer |
| Dependency auf sich selbst | `METADATA_SCHEMA` |
| Zyklus A→B→A | nie freigebbar (RT-08) |

**Logisch unmögliche, aber erreichbare Zustände:**

- `verified` auf superseded Revision (RT-07);
- „approved“ mit blocking Finding (RT-06);
- ein Run, dessen Developer zugleich sein Verifier und Observer ist (RT-05).

Keiner davon verletzt eine Contract-Invariante.

## 3. Event-Sequence-Fuzzing und Metamorphic Properties (Auftrag §2, §10)

`tests/forge-red-team/differential.test.ts` und `model.ts`:

- **Generator:** deterministisch (Mulberry32), zustandsgeführt.
  - 6 Tasks mit Dependencies, darunter der Zyklus T5↔T6.
  - Mehrere Versionen, adversariale Beobachtungen:
    - fehlende Kanten, Zyklen, Merge-Zweitparent;
    - Head rückwärts, `null` oder fremd;
    - fremder Ref, Ref-Namen wie `constructor`, `-`, `x.lock`.
  - Evidence-Varianten:
    - Rename in Coordination, contracts/approvals-Pfade;
    - doppelte Checks, negative Exit-Codes;
    - alle Mutationskombinationen.
  - Identitäten: Autor, Relabel, gleicher Provider, System, Mensch, AI-Owner.
  - Ack-Varianten: Teilmenge, Obermenge, umgekehrte Reihenfolge.
- **Referenzmodell:** komplett unabhängig, ohne Produktionshelper. Es enthält eigene BFS-Ancestry, eigenes Remote-Outcome, eigene Verifikationsbewertung, eigene Run- und Task-Zustände, eigenes Gate und eigene Event-Annahme je Typ. Nur das Zod-Event-Schema stammt aus der Produktion.
- **Geprüft nach jedem Kandidaten:**
  1. Kernel- und Modell-Entscheidung (accept/reject) gleich.
  2. Alle Task- und Run-Zustände gleich dem Modell.
  3. Ein abgelehntes Event wird von `apply` und `replay` identisch abgelehnt (gleicher Index, gleiche Rejection).
  4. Bijektives Umbenennen aller Ref-Namen plus Umkehr der `refs`- und `parents`-Key-Reihenfolge ändert keine Entscheidung und keinen Zustand.
  5. Ein akzeptierter Task ist terminal.
  6. Höchstens ein aktiver Run je Task.
  7. `review_approved`/`accepted` ⇒ verified Run mit approve, `reviewedCommit == verifiedCommit == claimedResultCommit`; `accepted` ⇒ menschlicher Owner.
  8. `ready` ⇒ Approval und Dependencies mit exakt akzeptierten Commits.
  9. Jeder Run referenziert eine registrierte, approvte Revision seines Tasks.
  10. `verified` ⇒ Beobachtung vorhanden.
  11. `replay(log) == applyEvent`-Kette.
  12. Zustand tief eingefroren.
- **Coverage (gemessen, 30 Seeds × 300 Schritte):** etwa 2 700 akzeptierte Events.
  - **Task-Zustände:** alle 9 erreicht, darunter `accepted` (~590 Zustandsbeobachtungen), `review_approved` (~40), `contract_revision_required` (~50) und `rework_required` (~90).
  - **Run-Zustände und Event-Typen:** alle 6 Run-Zustände und alle 11 Event-Typen akzeptiert.
  - **Rejection-Codes:** 24, darunter `DEPENDENCY_MISMATCH`, `RUN_NOT_LATEST_VERIFIED` und `EQUIVALENT_MUTATIONS_NOT_ACKNOWLEDGED`.
  - Die erste Generatorversion erreichte `RUN_NOT_LATEST_VERIFIED` nicht und kam nur selten bis Review und Abnahme. Sie wurde gezielt nachgeschärft; die Coverage ist jetzt als Test festgeschrieben.
- **Ergebnis:** 0 Abweichungen.

Das bestehende Phase-8-Differential hatte zwei Schwächen, die der neue Test schließt:

- Es benutzte für `runState` die Produktion.
- Es enthielt keine Dependencies.

**Fuzzer-Stärke (Meta-Mutation):** siehe §7.

## 4. Trust-Boundary (Auftrag §3)

**Was Forge beweist (aus dem Log, unabhängig von Beobachtungen):**

- Rollen, Unabhängigkeitsregeln über selbsterklärte Identitäten.
- Reihenfolge und Zustandsübergänge, Contract-Hash-Bindung.
- Höchstens eine Entscheidung je Revision und Gate.
- Dependency-Commit = akzeptierter `verifiedCommit`.
- `reviewedCommit == verifiedCommit == claimedResultCommit`.
- Abnahme nur aus `review_approved`.

**Was Forge relativ zu einer bezeugten Beobachtung beweist:**

- Erreichbarkeit von Contract- und Base-Commit aus den Refs.
- `base ⊑ contractCommit`, `acceptedCommit ⊑ base`.
- `start ⊑ result ⊑ head` am beanspruchten Ref.

Fehlende Kanten blockieren nur (geprüft: unvollständiger Graph, Zyklus terminiert, Zweitparent wird verfolgt, unbekannter Ref-Commit hilft nicht).

**Was prinzipiell nicht beweisbar ist und kein Bug ist:**

- **Erfundene oder falsche Parent-Kanten:** Eine falsche Kante `result → start` macht `contained`.
- **Falscher `contractAtCommit`-Hash:** Er wird nur gegen die Revision verglichen, nicht gegen den echten Blob.
- **Inhalt der Evidence:** `changedFiles` und `checks` stammen vom vertrauten Verifier.
- **Spätere Rückwärtsbewegung des Remote:** RT-09.
- **Identität des Beobachters.**

**Messgrenzen der Graphen (PERF-3):**

| Fall | Ergebnis |
|---|---|
| tiefe Kette, 300 000 Kanten | Ancestry 0,46 s, Schema-Parse 0,83 s, keine Rekursion |
| 1 000 000 Parents eines Commits | 2,0 s |
| Diamant-Leiter mit 2^5000 Pfaden | 14 ms dank Besucht-Menge |

## 5. Contract-Parser und JS-Objekte (Auftrag §4, §5)

**Geprüft ohne Crash:**

- BOM am Anfang (→ `BOM`), BOM im Body (zulässig), CRLF, einzelne High-/Low-Surrogate, umgekehrtes Paar, gültiges Paar.
- 10 MB Body.
- Leeres Body; fehlender Zeilenumbruch nach `---` (→ `UNTERMINATED`).
- Mehrere `---` im Body (der erste `\n---\n` endet das Frontmatter; im kanonischen JSON kann diese Folge nicht vorkommen, also keine Mehrdeutigkeit).
- Leeres Frontmatter, `{}`.
- Tiefes JSON 10^6 (→ `FRONTMATTER_JSON`).
- `NaN`, `1e0`, `-0`, unsichere und `2^53`-Integer, doppelte Keys, `\u`-Escapes (nicht kanonisch).
- Eigene `__proto__`-Keys auf Top-Level und in `scope` (→ `METADATA_SCHEMA`), `constructor` (→ `METADATA_SCHEMA`).

**Nicht normalisierende Hash-Eigenschaften:**

- Body mit und ohne abschließenden Zeilenumbruch → verschiedene Hashes.
- Der Hash deckt exakt den Text ab; eine Hash-Mehrdeutigkeit wurde nicht gefunden.

**JS-Objekte:**

- `Object.create(null)`- und eingefrorene Eingaben werden akzeptiert und als eigene Kopien geloggt.
- Eigene `__proto__`/`constructor`/`prototype`-Zusatzfelder → `EVENT_SCHEMA`; die Eingabe wird nicht mutiert.
- Geerbte Properties, Symbole und nicht-enumerierbare Felder: RT-11.
- Getter und Proxy: RT-12.
- Sparse Arrays in `replay`: Löcher → `EVENT_SCHEMA` (bestehender Test).

## 6. Mutation-System und B22 (Auftrag §8)

**Matrix in `findings.test.ts` (alle Fälle × `none`/`optional`/`required`):**

| Fall | Ergebnis |
|---|---|
| `must_detect` + `detected` | gültig |
| `must_detect` + `survived` | `MUTATION_SURVIVED` |
| `must_detect` + `not_applied` | ungültig |
| `must_detect` mit Rationale | ungültig |
| `equivalent` + `survived` mit Rationale | gültig |
| `equivalent` ohne Rationale, + `detected`, + `not_applied` | ungültig |
| `none` | ignoriert alles |
| doppelte Namen | ungültig |
| `required` mit leerer Liste | ungültig |
| `optional` mit leerer Liste | gültig |
| Verifier-Liste vs. Developer-Liste | Verifier-Liste ersetzt (RT-04) |
| Quittungen | Menge: Reihenfolge egal; Teilmenge, Obermenge und Duplikate abgelehnt |

Leere Rationale und reine Whitespace-Rationale lehnt `TextSchema` am Schema ab (bestehende Tests).

**B22** (`acceptedCommitOf` liest `claimedResultCommit` statt `verifiedCommit`): **Äquivalenz bestätigt für alle erreichbaren Zustände.**

- **Beweisidee:**
  - Eine Abnahme verlangt `review_approved` ⇒ der Run ist `verified` ⇒ `verification_recorded` wurde akzeptiert, und das verlangt `verifiedCommit == claimedResultCommit`.
  - Der Report ist pro Run genau einmal setzbar (nur in `running`), die Verifikation nur einmal (nur in `remote_verified`). Beide Werte sind danach unveränderlich.
- **Empirisch:**
  - Der Fuzzer prüft die Gleichheit für jeden `accepted`/`review_approved`-Zustand.
  - Der Meta-Mutant F03 = B22 überlebt den Fuzzer, wie für ein äquivalentes Mutant erwartet.
- **Widerlegbar nur außerhalb der erreichbaren Zustandsmenge:** über einen gefälschten Zustand (RT-10). Deshalb ist es kein MAJOR; die Äquivalenzbegründung sollte aber „für Kernel-erzeugte Zustände“ präzisieren.

## 7. Meta-Mutation: Erkennt der Red-Team-Fuzzer echte Fehler?

20 Produktionsmutanten wurden temporär angewendet und nur gegen `tests/forge-red-team` geprüft. Je Mutant wurde der Source-Hash geändert; nach jedem Lauf wurde wiederhergestellt; danach war `git diff -- src` leer.

| ID | Mutant | Ergebnis gegen `tests/forge-red-team` |
|---|---|---|
| F01 | Containment ohne Startcommit-Ancestry | detected (21 Tests rot) |
| F02 | `latestVerifiedRun` ignoriert Revision | detected (25) |
| F03 | **B22**: accepted commit = claimed commit | **survived – äquivalent** (§6) |
| F04 | Gate ignoriert Dependency-in-Base | detected (1) |
| F05 | Dependency-Mismatch ignoriert | detected (2) |
| F06 | Coordination-Ausnahme auf `forge/` ausgeweitet | detected (17) |
| F07 | Verifikationsbewertung ignoriert | detected (31) |
| F08 | Code-Reviewer-Unabhängigkeit entfernt | detected (23) |
| F09 | contract_change wie code_change | detected (16) |
| F10 | Ancestry nur über ersten Parent | detected (20) |
| F11 | run_failed durch fremden Developer | detected (17) |
| F12 | Rollenprüfung entfernt | detected (17) |
| F13 | Approval auf superseded Revision | detected (13) |
| F14 | equivalent + detected gültig | detected (7) |
| F15 | abgelehntes Event trotzdem in `work.log` | **survived – äquivalent**: `step` arbeitet auf einer Arbeitskopie, die bei jeder Ablehnung verworfen wird (`applyEvent` und `replay`). Kein Zweig mutiert vor der letzten Prüfung; die Invariante „abgelehnte Events verändern nichts“ ist strukturell. |
| F16 | Quittung als Teilmenge | detected (3) |
| F17 | Abandon nur in `running` | detected (20) |
| F18 | Owner-Mensch-Prüfung entfernt | detected (3) |
| F19 | Gate erlaubt `awaiting_review` | detected (2) |
| F20 | changes_requested ohne Findings | detected (21) |

Ergebnis: 18 detected, 2 survived. Beide überlebenden Mutanten sind mit Begründung äquivalent; 0 not applied. Skript: Scratch `meta.py`, Muster exakt einmal gefunden, sonst `NOT_APPLIED`.

## 8. Neue Tests

Neue Testdateien (test-only, Commit getrennt von diesem Artefakt):

- `tests/forge-red-team/model.ts` – unabhängiges Referenzmodell.
- `tests/forge-red-team/differential.test.ts` – 30 Seeds mit je 300 Schritten plus Coverage-Test (31 Tests).
- `tests/forge-red-team/findings.test.ts` – Charakterisierung aller RT-Findings, Mutationsmatrix, Identitätsmatrix, JS-Objekt- und Graph-Angriffe (38 Tests).

**Ort:** Die Dateien liegen bewusst außerhalb von `tests/forge/`.

- `tests/forge/dogfood.test.ts` verlangt, dass jede Datei dort im Scope eines Forge-Contracts liegt. Das hat die erste Platzierung zu Recht gemeldet.
- Contracts dürfen ohne neue Version nicht erweitert werden.
- Ein späterer Contract kann `tests/forge-red-team/` adoptieren.

## 9. Produktionsfixes

Keine. Begründung je Kandidat:

- **RT-01, RT-03, RT-06:** brauchen Contract-Änderungen.
- **RT-10:** braucht eine Entscheidung zur Vertrauensgrenze.
- **RT-12:** wäre vermutlich contract-konform reparierbar (`try/catch` → `EVENT_SCHEMA`). Der Contract adressiert Accessor-Eingaben aber nicht; die Entscheidung liegt beim Reviewer.

## 10. Performance (Auftrag §9; nur gemessen, nichts optimiert)

Node 22, Container, `replay` mit Fixtures:

| Last | Events | Zeit |
|---|---|---|
| 1 Task, 125 / 250 / 500 / 1 000 / 2 000 / 3 000 fehlgeschlagene Runs | 253 … 6 003 | 51 ms / 49 ms / 202 ms / 1,2 s / 8,7 s / 28,3 s |
| 1 Task, 100 / 200 / 400 verifizierte, nachgearbeitete Runs | 503 … 2 003 | 47 ms / 60 ms / 374 ms |
| 200 … 1 600 Tasks registriert | 200 … 1 600 | 6–22 ms |
| 1 Task, 100 / 200 / 400 Contract-Versionen | 201 … 801 | 22–35 ms |
| 1 Run mit 1 000 / 10 000 / 50 000 Mutationen | 8 | 19 / 25 / 136 ms |
| gemischte Lebenszyklen, 1 k / 10 k / 30 k / 100 k Events | | 45 ms / 0,31 s / 1,69 s / 40,8 s |

- **PERF-1:**
  - Runs je Task wachsen **kubisch**. Ursache: `taskState` → `isRunTerminal` → `runState` → `findRun` (linear) für jeden Run des Tasks, und das bei jedem Gate-Aufruf.
  - Erster praktisch problematischer Punkt: etwa 2 000 Runs je Task (über 8 s).
  - Realistische Pilotwerte (unter 10 Runs je Task) sind unkritisch.
- **PERF-2:**
  - Gemischte Logs wachsen überquadratisch.
  - Problematisch ab etwa 50 k–100 k Events.
  - Der frühere CP4-Messpunkt (29 600 Events ≈ 4,1 s) liegt im selben Bereich.
- **PERF-3:** siehe §4 (Graphen).

**PERF-2b – inkrementelles `applyEvent`** (die Online-API, gleiche gemischte Lebenszyklen):

| Events | `applyEvent` Schritt für Schritt | `replay` | Zustand (JSON) |
|---|---|---|---|
| 1 008 | 3,45 s | 20 ms | 0,9 MB |
| 3 006 | 30,9 s | 62 ms | 2,7 MB |
| 6 003 | 136,7 s | 119 ms | 5,4 MB |

- Je Event werden `structuredClone` und `deepFreeze` des **gesamten** Zustands ausgeführt, einschließlich aller Contract-Texte im Log.
- Kosten: O(Zustandsgröße) pro Event, also O(n²) für eine Sitzung, mit hoher Konstante.
- **Das ist die praktisch relevanteste Grenze:** schon um 1 000 Events dauert jeder Schritt mehrere Millisekunden, um 6 000 Events über 20 ms.
- Keine Contract-Verletzung (§13 verlangt Reinheit, keine Laufzeit).
- Reparaturidee ohne Semantikänderung: strukturelles Teilen eingefrorener Teilbäume statt Vollklon.

Kein Befund rechtfertigt eine Mikrooptimierung ohne Contract-Anforderung. Werden Logs angreiferbeeinflusst, ist PERF-1 ein DoS-Hebel. Die Reparaturidee (Index `runId → Run`, gecachte Run-Zustände) ändert keine Semantik.

## 11. Koordination

- **TASK-0005 v2 erschienen** (nur notiert, nicht reviewt, kein TASK-0005-Code):
  - Contract-Commit `0453f85ad2ccb557a1f215e8bb912655597588fa`
  - Blob `1e6f36e56ca439e50502ec1717b8e842499bf115`
  - Branch-Head `fab792afb4acb7d8bd709133829becd8d7e16aaf`, inklusive `forge/coordination/CODEX.md` und TASK-0005-Audit-Artefakten
- Keine Codex-Datei wurde verändert.

## 12. Punkte für den unabhängigen Reviewer

1. **RT-01:** Rename-Repräsentation entscheiden (`fromPath` oder `--no-renames`) und 0001B revidieren.
2. **RT-12:** `applyEvent` total machen (`try/catch`) – ja oder nein?
3. **RT-10:** Vertrauensgrenze „Persistenz = Log“ normativ festschreiben.
4. **RT-03, RT-06:** Konsistenzregeln für Evidence-Checks und Approval-Findings.
5. **B22:** Begründung auf „Kernel-erzeugte Zustände“ präzisieren.
6. **Referenzmodell:** prüfen, ob es den Contract richtig liest. Abweichungen zwischen Contract und Modell würden hier als „0 Abweichungen“ verdeckt, wenn Autor-Lesart und Modell denselben Irrtum teilen.
7. **PERF-2b / PERF-1:** inkrementelles `applyEvent` (O(Zustand) je Event) und kubisches Wachstum mit Runs je Task. Grenzen oder strukturelles Teilen für eine spätere Version festlegen.
