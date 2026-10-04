# FORGE V0.1 — STOP / Recovery Matrix

Status: OWNER-RUNBOOK-ANHANG (keine Live-Ausführung, keine neue Mechanik)
Gehört zu: `FORGE-V0.1-FINAL-ACTIVATION-RUNBOOK.md` (§6 HALT/Break Glass, §8 Phasen, §9 CORE-0002-Sperre)
Quellen: Runbook §6/§8/§9; PM §8 (Recovery Matrix) und §11 (STOP-Satz); DRILL §10 (Freeze-Operation und Feldkorrekturen); FBR §12 (Break Glass).
Stand: 2026-10-04. Repository `Forge-Dice/Forge` wurde nur gelesen.

---

## 0. Lesart

- **Jeder STOP beginnt mit H-0** (Runbook §6.1): keine weiteren Pushes, Re-runs, Merges, Settings-Lockerungen oder Aufräumaktionen; STOP-Satz (Runbook §6.4) mit UTC notieren und im Evidence Sheet §J eintragen.
- **HALT-Stufe** gibt an, welche weiteren Schritte aus §6.1 Pflicht sind:
  - **H0**: nur H-0 + H-4 (Evidence sichern). Für Schritte ohne laufende Workflows auf dem kanonischen Repo.
  - **H1**: H-0, H-1 (Runs abbrechen, ggf. force-cancel), H-4.
  - **HALT voll**: H-0 → H-1 → H-2 (Actions aus) → H-3 (R3 `bypass_actors=[]`) → H-4. Bei laufendem untrusted Job hat H-1 Vorrang vor jedem Export.
- **Recovery** listet nur bereits beschlossene Maßnahmen. Was hier nicht steht, ist nicht erlaubt; dann bleibt der Zustand STOP, bis der Owner eine neue D-Entscheidung persistiert hat.
- **Wiedereinstieg** nennt den frühesten Schritt, ab dem weitergearbeitet werden darf, und immer mit **neuem Nachweis** (alte Evidence wird nicht wiederverwendet, wenn sich B/H/P/W geändert hat).
- **Global verboten** (gilt in jeder Zeile, Runbook §6.3 und §7.4/§7.5): Direkt-Push auf `main`; Force-Push; Branch-/Tag-Löschung; Rebase; `update-branch`; R1/R2 deaktivieren; Bypass in R1/R2/R6/R7; `always`-Bypass für `main`; App-Pins entfernen oder Any-Source-Checks; AEP erweitern; Org-Policies lockern; History umschreiben; im Check-Fenster mehr als einen PR mergen; Verifier-Code ohne Contract ändern; STOP automatisch aufheben; einen Negativfall nachträglich zu D1 umdeklarieren.
- Die Spalte „Verboten“ nennt nur, was **zusätzlich** für den konkreten Fall naheliegend, aber unzulässig ist.

---

## 1. P0 — Owner Platform Preparation

| ID | Schritt | Trigger | Erkennung | HALT | Recovery (abschließend) | Wiedereinstieg | Verboten |
|---|---|---|---|---|---|---|---|
| S-P0-01 | P0.1 | Eine offene Owner-Frage (OE/OD) lässt sich nur mit neuer Architektur beantworten | Entscheidungsprotokoll-Entwurf enthält Mechanik, die nicht in FRZ/REC/FBR steht | H0 | Frage als offen markieren; separater Architekturauftrag außerhalb dieses Runbooks | P0.1 nach persistierter D-Entscheidung | Neue Mechanik im Entscheidungsprotokoll „mitbeschließen“ |
| S-P0-02 | P0.2 | Schreibweg einer Rolle unklar (welcher Account schreibt mit welchem Token wohin) | Inventar: Rolle ohne belegte `user.id`/Token-Herkunft | H0 | Read-only klären; fehlende Identität einrichten lassen (Owner) | P0.2 | Ausweichen auf einen anderen Account (z. B. Owner schreibt als Codex oder umgekehrt) |
| S-P0-03 | P0.2 / P0.7 | OI-1 (Claude-Connector schreibt als Wuerfelduell) nicht vom Owner dokumentiert/aufgelöst | P0.1-Protokoll ohne OI-1-Eintrag | H0, blockiert ab P0.7 | Owner dokumentiert OI-1 im Entscheidungsprotokoll (eigene Claude-Identität oder bewusst akzeptierte Owner-Schreibweise mit Kennzeichnung) | P0.7 | Rulesets anlegen, solange Reviewer-/Autor-Identitäten nicht trennbar belegt sind |
| S-P0-04 | P0.3 | Drill-Paket r2 enthält Änderungen über 8a/8c hinaus | Diff r2 gegen DRILL `005bcd09` zeigt weitere Dateien/Logik | H0 | r2 zurückweisen; neue r2 nur mit 8a/8c | P0.3 | Zusätzliche Änderungen „gleich mit“ akzeptieren |
| S-P0-05 | P0.4 | Unerwartetes ALLOW im Lab | `drill.py`-Case-Ergebnis ALLOW, wo DENY erwartet | HALT voll (Lab) — DRILL §10 Freeze `--execute freeze` | Lab-Evidence sichern; Ursache als Feldfehler oder Designfehler klassifizieren; Feldfehler: exakte Korrektur unter Freeze (DRILL §10-Tabelle, §6 unten); Designfehler: NO-GO | P0.4 mit **neuem** Lab-Run (neue Run-ID) | Lab-Ergebnis als „flake“ werten; Lab-Repo aufräumen |
| S-P0-06 | P0.4 | Untrusted Job startet im Lab | Run-Liste zeigt Job aus PR-Head-Workflow | HALT voll (Lab), H-1 zuerst | Wie S-P0-05; zusätzlich AEP-Readback | P0.4 neu | Execution-Policy um Events/Akteure erweitern |
| S-P0-07 | P0.4 | `NATIVE_HEAD_CHECK_BINDING_NOT_PROVEN` oder ein Schreibzugriff auf `Forge-Dice/Forge` während des Labs | Drill-Ergebnis / Audit-Log des kanonischen Repos | HALT voll (Lab); bei kanonischem Schreibzugriff H0 + H-4 auf kanonischem Repo | Binding: DRILL §10 „P6 binding“: keine Feldkorrektur, Freeze, NO-GO. Kanonischer Schreibzugriff: Incident-Notiz, Ref erhalten | P0.4 erst nach D-Entscheidung | Any-Source-Pin, neuer Check-Publisher, R2-Abschwächung |
| S-P0-08 | P0.5 | Owner kann Settings nicht lesen/schreiben | 403/404 auf Settings-Endpunkte | H0 | Identität/Rechte klären (Owner-Account 315180734, Admin) | P0.5 | 403/404 als „leer“ oder „Default“ werten |
| S-P0-09 | P0.6 | AEP zeigt zusätzliche Event-/Pfad-/Akteur-Ausnahme oder Parent-Policy unbekannt (OI-8) | AEP-Readback ≠ §5.3; Org-Policy 404 | H0 | Exakt Sollwert §5.3 unter Freeze herstellen (DRILL §10 P3-Zeile); Parent-Policy nur read-only klären | P0.6 mit neuem Readback | Parent-Policy automatisiert abschalten; zusätzliche Ausnahme stehen lassen |
| S-P0-10 | P0.7 | Zusätzlicher Bypass oder breite Ausnahme in einem Ruleset; Ref-Liste verändert | Readback R1/R7/R4/R5/R6/R3 ≠ §5.2; Ref-Liste ≠ Snapshot | H0 (Actions auf kanonischem Repo noch aus) | Feldkorrektur gemäß §6 dieser Matrix; Ref-Veränderung: Incident, Ref nicht überschreiben | P0.7 ab dem betroffenen Ruleset, danach komplette Reihenfolge erneut lesen | `forge/**`-Breitausnahme; RepositoryRole statt User-ID |
| S-P0-11 | P0.8 | Ein Job startet beim S1-Negativtest | Run-Liste nicht leer | HALT voll | AEP- und Actions-Readback; Feldkorrektur nur bei belegt falschem Wert (PM §8 „D6 workflow“: Owner-Fix nur im separaten Auftrag, danach Policy-Negative erneut) | P0.6 | Workflow-Datei „vorsichtshalber“ löschen; Run-Logs löschen |
| S-P0-12 | P0.9 | Unerwartetes ALLOW bei kanonischer Negativprobe | Probe-Ergebnis ALLOW | HALT voll | Ref-Änderung bleibt Teil des Incidents; Feldkorrektur §6; neuer isolierter Nachweis (DRILL §10 P8/P9) | P0.9 nach neuem Lab-Nachweis | Geänderte Ref zurücksetzen/löschen |
| S-P0-13 | P0.10 | PR #2 versehentlich gemergt | `main` ≠ erwarteter Stand; PR #2 `merged=true` | H0 + H-3 | Revert-PR nach Runbook §6.2 Zeile „gemergter PR falsch, Verifier gesund“ (R2 existiert noch nicht → normaler Owner-Merge über R3-PR-Bypass) | P0.10 | Reset/Force-Push auf `main` |
| S-P0-14 | P0.11 | Ops-PR enthält Code-/Workflowdatei; Merge-Methode ≠ merge; Merger ≠ 315180734 | PR-Files-Liste; `M.parents`; `merged_by.id` | H0; bereits gemergt: + H-3 | Nicht gemergt: PR schließen, Branch erhalten, neuer Ops-PR mit nur Owner-Dokumenten. Gemergt: Revert-PR §6.2 | P0.11 | Datei im offenen PR entfernen und weiter-mergen ohne neues Review |

---

## 2. P1 — Contract A

| ID | Schritt | Trigger | Erkennung | HALT | Recovery | Wiedereinstieg | Verboten |
|---|---|---|---|---|---|---|---|
| S-P1-01 | P1.1 | Repair braucht neue Architektur oder widerspricht FRZ ohne D-Entscheidung. **Heute aktiv: r2/finale A/B/C NOT AVAILABLE (OI-4).** | Kein Contract-Paket r2 mit Hash in Git | H0 | r2 erstellen lassen (eigener Auftrag); bei FRZ-Konflikt D-Entscheidung | P1.1 | ABCR-Candidates direkt als final verwenden (AB-Register: Severity-Enum, transitive Supersedes, fehlende A5/B5/C5) |
| S-P1-02 | P1.2 | Oracle-Erwartung per Mehrheitsentscheid oder aus Reference abgeleitet | Oracle-Bericht ohne unabhängige Herleitung je Fall | H0 | Oracle neu, unabhängig | P1.2 | Reference-Implementierung als Wahrheit nehmen |
| S-P1-03 | P1.3 | Reviewer = Autor (betrifft OI-2: Claude ist r2-Autor und D5-Reviewer) | Review-Identität == Autor-Identität | H0 | Anderen externen Reviewer einsetzen | P1.3 | Selbstreview als externes Review zählen |
| S-P1-04 | P1.4 | `baseCommit` ≠ aktuelles `main` ohne Revision; andere Datei im Registrierungs-PR | Contract-Kopf vs. `git rev-parse main`; PR-Files | H0 | Contract-Revision auf aktuellem `main`; PR mit genau der Contract-Datei | P1.4 | `baseCommit` stillschweigend anpassen ohne neues Review |
| S-P1-05 | P1.5 | Contract per Chat übergeben oder Scope-Erweiterung im Handoff | Handoff-Text enthält Contracttext oder zusätzliche Pfade | H0 | Handoff neu: nur Repo/Pfad/Commit/Hash/Base | P1.5 | Chat-Kopie als Quelle akzeptieren |
| S-P1-06 | P1.6 | Änderung bestehender Tests oder `src/forge/**`, neue Dependency, Datei außerhalb Scope | Diff gegen `allowedFiles` | H0 | PM §8 D2/D7-Muster: saubere neue Branch von B, neuer Review; alter PR geschlossen, Branch erhalten | P1.6 | Out-of-scope-Commit per Revert „reinigen“ und weiter |
| S-P1-07 | P1.7 | Mutant nur durch Codewechsel zwischen zwei sicheren Ablehnungen „getötet“; Developer-Selbstauskunft als Nachweis | Abnahmebericht: Mutantenwirkung nicht am selben Code belegt | H0 | Abnahme neu mit unabhängigem Mutantenlauf | P1.7 | Developer-Report als Abnahmeevidenz |

---

## 3. P2 — Contract B

| ID | Schritt | Trigger | Erkennung | HALT | Recovery | Wiedereinstieg | Verboten |
|---|---|---|---|---|---|---|---|
| S-P2-01 | P2.1 | Erfundene oder nicht-`main`-SHA als `acceptedCommit` A | `git merge-base --is-ancestor <sha> main` schlägt fehl oder SHA ≠ Ledger-Zeile A | H0 | B-Revision mit Ledger-SHA von A | P2.1 | SHA aus Chat oder Bericht übernehmen |
| S-P2-02 | P2.4 | Ein Isolationszugriff gelingt; keine Docker-fähige Fläche | Gemessene Denial-Liste unvollständig; Abnahmefläche ohne Docker | H0 | Implementierungsfehler: PM §8 „Verifier/Workflow defect“ (Repair + unabhängiges Review). Fehlende Fläche: Fläche bereitstellen | P2.3 bzw. P2.4 | B ohne Docker abnehmen („ohne Docker ist B nicht abnahmefähig“) |

---

## 4. P3 — Contract C

| ID | Schritt | Trigger | Erkennung | HALT | Recovery | Wiedereinstieg | Verboten |
|---|---|---|---|---|---|---|---|
| S-P3-01 | P3.1 | Anderer Trigger als `pull_request_target`; Checks-Publisher oder Admin-Token; Clamp-BASE nicht in if-Form | C-Revision-Review | H0 | C-Revision korrigieren, neues Review | P3.1 | Zusätzliche Trigger „für Tests“ |
| S-P3-02 | P3.3 | Push nach Head-Freeze ohne neues Review; Workflow-Abweichung | PR-Head ≠ eingefrorenes `H_C`; Workflow-Diff | H0 | Neues Review auf neuem Head; `H_C` neu einfrieren | P3.3 | C mergen (C wird erst in P5.2 gemergt) |

---

## 5. P4 — Execution-Isolation Live Validation

| ID | Schritt | Trigger | Erkennung | HALT | Recovery | Wiedereinstieg | Verboten |
|---|---|---|---|---|---|---|---|
| S-P4-01 | P4.1 | Testfläche weicht von `H_C` ab; Schreibzugriff auf `Forge-Dice/Forge` | Workflow-Blob auf Testfläche ≠ `H_C`; Audit-Log kanonisch | HALT voll (Testfläche); kanonisch H0 + H-4 | Testfläche neu aus `H_C`; kanonischer Schreibzugriff: Incident | P4.1 | Testfläche „nachziehen“ statt neu aufsetzen |
| S-P4-02 | P4.2 | Netzwerk erreichbar, Credential/Token sichtbar, Schreibzugriff außerhalb Scratch, überlebender Prozess, Grenzwert nicht durchgesetzt, Stage1→Stage2-Kanal, Evidence fälschbar | Probe-PR-Ergebnis je EI-Kategorie I-1..I-8 | HALT voll (Testfläche) | PM §8 „Verifier/Workflow defect“: Repair-Contract + unabhängiges Review → C-Revision; zurück zu P3 | P3.1 | Grenzwert lockern; Kategorie als INCONCLUSIVE durchwinken |

---

## 6. P5 — Workflow / Ruleset Activation

| ID | Schritt | Trigger | Erkennung | HALT | Recovery | Wiedereinstieg | Verboten |
|---|---|---|---|---|---|---|---|
| S-P5-01 | P5.1 | Fremder offener PR oder Abweichung von Sollzustand | PR-Liste; Ruleset-/AEP-Readback | H0 | Ursache klären; fremde PRs schließen lassen; erneut prüfen | P5.1 | Fremden PR mitlaufen lassen |
| S-P5-02 | P5.2 | Blob-Abweichung; Merge eines anderen Heads als `H_C` | `M.parents[1]` ≠ `H_C`; Blob-Vergleich | HALT voll | Revert-PR §6.2 (ohne R2-Fenster, R2 existiert noch nicht) | P5.1 | `merge-async` ohne `sha=` |
| S-P5-03 | P5.3 / P5.5 | Checks hängen nicht am PR-Head oder an falscher Suite/App (`NATIVE_HEAD_CHECK_BINDING_NOT_PROVEN`); Job aus anderem Workflow; Bindung nicht eindeutig | Check-Run `head_sha` ≠ H; `app.id` ≠ erwartet | HALT voll | DRILL §10 „P6 binding“: keine Feldkorrektur, Freeze, NO-GO bis D-Entscheidung | P5.3 nach D-Entscheidung | Any-Source-Check, neuer Publisher |
| S-P5-04 | P5.4 | Kanonische Isolations-Probe entkommt (OI-3: Weg zu Stage 2 unspezifiziert) | Probe-Ergebnis | HALT voll | C-Revision; zurück zu P3 | P3.1 | Probe als Testflächen-Artefakt abtun |
| S-P5-05 | P5.6 | R2-Readback ≠ §5; Platzhalter `__BIND_CHECK_APP_ID__` gesendet; Any-Source | R2-Readback | HALT voll | Feld exakt korrigieren unter HALT (DRILL §10 P7-Zeile: 0 Approvals, Reviewflags false, echte Checknamen/App-ID, strict=true) | P5.6 | R2 abschwächen; R2 deaktivieren |
| S-P5-06 | P5.7 | Merge gelingt ohne grüne Checks oder mit anderer Methode | `M` existiert ohne grüne Required Checks am Head; Methode ≠ merge | HALT voll | Incident; Revert-PR §6.2; PM §8 „Wrong merge already happened“: Drill FAIL, neue überprüfte Baseline | P5.6 (R2 erneut readback), dann P5.7 neu | Reset/Force; spontane Methodensperre ohne Settingsauftrag |

---

## 7. P6 — ClampAtZero Drill

| ID | Schritt | Trigger | Erkennung | HALT | Recovery | Wiedereinstieg | Verboten |
|---|---|---|---|---|---|---|---|
| S-P6-01 | P6.0 | Ein Preflight-Punkt offen (u. a. OI-5/OI-6 Drill-Paket/Drill-Contracts NOT AVAILABLE) | Checkliste P6.0 | H0 | Fehlendes Artefakt liefern lassen | P6.0 | Improvisation während Live |
| S-P6-02 | P6.1 | PM-STOP-Bedingung; Verifier grün ohne Attestation | `forge-verify` success ohne gültige `FORGE-ATTESTATION-V1` | HALT voll | PM §8 „Verifier/Workflow defect“ | P5 nach Repair-Abnahme | Grünen Lauf trotzdem mergen |
| S-P6-03 | P6.2 | Unerwartete Annahme eines Negativfalls; evil-Job startet (globaler STOP) | Fall-Ergebnis ACCEPT; Run-Liste | HALT voll | PM §8 Zeile des Falls (§8 unten); bei Jobstart zuerst Freeze/Incidentreview des Settingspfads | P6.0 | Negativfall zu D1 umdeklarieren |
| S-P6-04 | P6.3 | Eine Pflichtklasse FAIL/UNKNOWN/INCONCLUSIVE/NOT EXECUTED | Drill-Exit-Tabelle (PM §9) | H0 | Fehlende Klasse mit neuem Lauf belegen | betroffener Schritt P6.1/P6.2 | „Zero bypass“ als PASS-Kriterium oder sprachliches Umetikettieren zu PASS |

---

## 8. P7 und übergreifend

| ID | Schritt | Trigger | Erkennung | HALT | Recovery | Wiedereinstieg | Verboten |
|---|---|---|---|---|---|---|---|
| S-P7-01 | P7.1 | Ein E-Kriterium E1–E9 offen | Evidence Sheet §H | H0 | Fehlenden Beleg erbringen; bei Ledger-Abweichung (E6) Incident | P7.1 | BOOTSTRAPPED mit Vorbehalt erklären |
| S-X-01 | jederzeit vor `M_BS` | CORE-0002-Verstoß: Contract-PR, Registrierung, Task-Index-Eintrag, Ref unter `forge/run/codex/FORGE-CORE-0002/**`, Format-2-Contract auf `main`, Änderung an `src/forge/contract-document.ts` oder `src/forge/primitives.ts`, Mystery-Registrierung | PR-/Ref-Liste; Diff `main` | H0; gemergt: + H-3 | PR schließen, Ref erhalten, Incident-Notiz; gemergt: Revert-PR §6.2 | Schritt, in dem der Verstoß auftrat | Ref löschen; Revert ohne Incident-Notiz |

---

## 9. Drill-Fallrecovery (PM §8, unverändert übernommen)

„Retry same run“ heißt nur zulässige Infrastruktur-Wiederholung mit identischen B/H/C/P/I. Jede neue W-ID oder verbrauchte Attemptnummer braucht neue Owner-Attestation für den konkreten Zielattempt. Ein Negativfall bleibt Negativfall.

| Fall | Retry same run? | Neuer Run / Branch / PR? | Neuer Contract / Review? | Owner-Settingsfix? |
|---|---|---|---|---|
| D1 fehlende Erstattestation | Ja, nach technischer Evidence und externem Review: all jobs | Nein, wenn B/H/P unverändert | Externes Review + Owner-Attestation für W/a+1 | Nein |
| D2 out-of-scope | Nein (bleibt korrekt rot) | Ja, saubere Branch von B; History nicht per Revert „reinigen“ | D1-Contract unverändert; Review für neuen W/H | Nein |
| D3 deletion | Nein | Ja, saubere Branch/PR, kein Force-Push | Keine Scopeerweiterung; neues Review | Nein |
| D4 skip | Nein | Ja, saubere Branch/PR | Keine Teständerung genehmigen; neues Review | Nein |
| D5 config | Nein | Ja, saubere Branch/PR | Kein neuer D1-Contract für Config; neues Review | Nur wenn globaler Policy-Block nicht wirkt → STOP des gesamten Drills |
| D6 workflow | Nein | Ja; nach untrusted Jobstart zuerst Freeze/Incidentreview des Settingspfads | Kein Developer-Workflow-Allow; später neues unabhängiges Review | Nur bei belegt falscher Execution-Policy, im separaten Ownerauftrag, danach Policy-Negative erneut |
| D7 extra file | Nein | Ja, saubere Branch/PR | D1 bleibt exact scope; neues Review | Nein |
| D8 survivor | Nein (terminale Ablehnung bleibt reproduzierbar) | Für positives D1 eigener Run/PR mit unverändertem Plan | Negative Fixture bleibt getrennt; nie „audit equivalent“ im Produktplan | Nein |
| D9 head change | Alten H1-Reviewattempt nicht grün machen | Neuer W für stabilen H2; D1-Abnahme trotzdem auf separater sauberer Branch | Neues externes Review für H2; neue W/Attempt-Attestation | Nein |
| `main` bewegt / Policy geändert | Nein; alter Event-SHA bleibt B0 | Neue Branch/Run-ID/PR aus B1; kein Merge-Update, kein Rebase/Force | Contractrevision auf B1 prüfen/publizieren, P/L/C neu pinnen; Review komplett neu | Nur wenn Schutzpayload tatsächlich falsch war |
| Malformed/stale/dismissed/revoked Review | Ja, wenn B/H/P exakt; neuer all-jobs-Attempt | Nein, außer W/Base/Head unbrauchbar | Neue Owner-COMMENT mit aktuellem Bodyhash/supersedes; externer Bericht bei geändertem H/C/P neu | Nein |
| Failed-jobs-Rerun / falscher Rerun-Akteur | Ja: nur neuer zielattestierter all-jobs-Attempt | Nein bei gleichem B/H; verbrauchtes a nicht wiederverwenden | Neue Owner-Attestation für nächsten Attempt | Nein, sofern Rechte/Policy korrekt |
| API-Transport / Rate Limit / Timeout | Ja nach belegter Availability und vollständiger frischer Prüfung; nie cached success; max. ein interner identischer Retry | Nur bei veränderten Bindungen | Neuer Targetattempt; Review ggf. neu; Deployment `checkedAt` frisch | Keine Credentialerweiterung oder Limitsenkung |
| Branch inaccessible | Erst Zustand lesen; nicht löschen/recreate/force | Wenn Ref tatsächlich verloren: neue Branch/PR nach Ownerentscheidung; STOP-Incident behalten | Review/W/Attempt neu; Contract nur bei neuem B | R1-Recoverydiagnose, falls unerlaubte Löschung belegt |
| Verifier/Workflow-Defekt | Nein, kein „grünes Glück“ suchen | Nach eigener Repair-Abnahme und neuem B vollständig neue Runs | Repair-Contract + unabhängiges Review; D1–D9 betroffen + Kernbindung neu | Nur bei separat belegt falschen Settings; kein Checkpflicht-Bypass |
| Ruleset-Defekt / Native-Binding-Überraschung | Kein fachlicher Retry bis Config-Drill PASS | Frische isolierte Controls; danach kanonischer neuer B/Run, wenn Änderung versioniert ist | Neue Deployment-Attestation; Codecontract nur bei Implementationsänderung | Exakte Feldkorrektur oder NO-GO; nie Any-Source/Broad Bypass/privilegierter Publisher |
| Falscher Merge bereits passiert | Nein; kein Reset/Force/Delete | Drill FAIL; neue überprüfte Baseline; erneuter D1-Drill | Neues Owner-Abnahmeprotokoll; Source-/Produktkorrektur nur per eigenem autorisiertem Contract | Keine spontane Methodensperre ohne Settingsauftrag |

---

## 10. Zulässige Feldkorrekturen (DRILL §10, auf das kanonische Repo übertragen)

Vor jeder Feldkorrektur sichern: Rule-/Policy-Vollpayload, sichtbare Revision/`updated_at`, aktuelle Ref-Liste, aktiver Schutz je betroffener Ref, Request-IDs, PR/SHA/Run-Attempt und Fehlgrund. Korrektur nur unter Freeze (H-2/H-3), nur auf den Sollwert in Runbook §5, danach neuer Nachweis.

| Bereich (Runbook-Phase) | Was darf auf Sollwert zurückgesetzt werden | Was niemals |
|---|---|---|
| Identität/Token (P0.2) | Richtigen Owner-Account/Token/Repo binden; Actions im Setup wieder disabled | Fremde/rückdatierte Refs überschreiben |
| Repo-/Actions-Settings (P0.5) | Nur General Actions für geprüfte Owner-Controls; danach disabled | Org-weite Parent-Policies ändern |
| AEP (P0.6) | Exakt User-IDs 315180734/337272506, Event `pull_request_target`, `~ALL`, `exclude=[]` | Zusätzliche Event-/Pfad-Ausnahme; Parent-Policy automatisiert abschalten |
| R1/R7 (P0.7) | R1 branch: deletion + non_fast_forward, bypass `[]`; R7 tag: creation + update + deletion, bypass `[]` | R1/R7 zur Reinigung aussetzen |
| R4/R5 (P0.7) | R4 Codex User/`always`; R5 Owner User/`always`; exakt rekursive Includes | Owner-`always` in R4; Codex-/Actions-Bypass in R5; RepositoryRole statt User |
| R6 (P0.7) | Exakte Excludes aus Referenz-JSON | Breite `forge/**`-Ausnahme; R6-Bypass |
| R3 (P0.7, nach HALT) | Nur User Owner/`pull_request`; Merge via API `bypass_rules=true` | `always`-Bypass auf `main`; R3 vor neuer bewusst gestarteter Prüfung wieder öffnen |
| Native Binding (P5.5) | **keine** — Freeze, NO-GO | R2-Abschwächung; Any-Source-Pins; neuer Check-Publisher |
| R2 (P5.6) | 0 Approvals, Reviewflags false, echte Checknamen + numerische `integration_id`, `strict=true`, nur Merge-Commit | Grünen PR per Owner-Bypass an R2 vorbeimergen; Parent-/klassische Regeln pauschal abschalten |
| Timing/Voraussetzungen | Nur read-only klären; nach unerwartetem ALLOW neuer isolierter Run | Automatische Reaktivierung; Ref-Reparatur; Löschen von Runs/Logs/Reviews |

---

## 11. Break-Glass-Fenster (Kurzfassung von Runbook §6.2/§6.4)

Nur bei Verifier-Defekt **nach** Aktivierung (ab P5.6): HALT → Revert-PR `forge/owner/revert-<nnnn>` (nur `git revert -m 1 <A_x>` + Incident-Datei, zwei externe Reviews, Owner-Review) → in R2 nur die zwei Required-Check-Einträge entfernen → R3-Bypass zurück, **genau diesen** PR mergen → Checks sofort wieder eintragen (gleiche `integration_id`) → Actions an, Smoke wiederholen → Folge-Owner-PR mit Ruleset-JSON vorher/nachher.

Audit: genau zwei `repository_ruleset.update` auf R2; dazwischen genau ein Merge-Commit auf `main`, dessen Diff Revert + Incident-Datei ist. Jede Abweichung ist ein eigener Incident und verhindert BOOTSTRAPPED (E-Kriterium).

Es gibt kein Halt-Ruleset (OD-B4) und keine `FORGE_HALT`-Variable.
