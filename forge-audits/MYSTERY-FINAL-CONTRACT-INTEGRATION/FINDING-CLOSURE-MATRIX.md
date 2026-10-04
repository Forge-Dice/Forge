# FINDING CLOSURE MATRIX — Mystery Final Contract Integration

Basis: `main` = `3d7545d843883418348004e68717399a64da7a7d` (unverändert). Quelle der elf Findings: `forge/owner/audits/MYSTERY-INDEPENDENT-FREEZE-VERIFICATION` @ `25a8a17b` (Tabelle F01–F12; F12 nonblocking).
Repair-Lab-Stand vor dieser Integration: 11 total, 9 CLOSED, 2 OWNER DECISIONS (F02 = D9, F04 = D8). D8 und D9 sind angenommen.

| Finding | Titel (FV) | Klassifikation | Angewandte Patches (PATCH-LOG.json) | Ort im Candidate | Evidenz |
|---|---|---|---|---|---|
| F01 | MYST-0001 / finale Reparatur nicht verfügbar | **CLOSED_BY_THIS_REPAIR** | B.2-start, B.2-type, B.2-para+R01, B.2-M4a, B.2-M4b, B.2-M5Ba, B.2-M5Bb, B.2-M5Bc | SA/SB/SC Startgate + §2; M4 §1/§5.3; M5B §1/§5 | Master B.2/B.3; R01; FB F01 |
| F02 | Release→Proof / Public-Rule / Witness-Adapter normativ offen | **CLOSED_BY_THIS_REPAIR** | P05, P06, P07, IR-01+R04-release, IR-05 | SA §2 Anhang forge-release-proof-v1 (Kopien SB/SC) | Release-Proof-Closure P05–P07; Master B.4; D9 |
| F03 | Öffentliches authored Gameplay nicht vollständig packagegebunden | **CLOSED_BY_THIS_REPAIR** | P02, P03, P04, R03+R05, IR-02, B.5-compat, B.5-A41, B.5-C41+B.12-C42 | SA §2, §9; SA A41; SC C41 | Master B.5; R03; P02–P04; D10 |
| F04 | Vitrine Receiptpflicht widerspricht Session V1 | **CLOSED_BY_THIS_REPAIR** | P08, IR-03 | SB §6 (Kopien SA/SC); Abnahmepunkt 6 | Release-Proof-Closure P08, P11–P20; Master B.6; D8 |
| F05 | Required-only / enge Rollenfrage widersprüchlich | **CLOSED_BY_THIS_REPAIR** | P09, P10 | M2 §15; CH §6 | P09/P10 = Master B.7 |
| F06 | Persistentes ask vs interrogate | **CLOSED_BY_THIS_REPAIR** | B.8 | M5B §6 | Master B.8 |
| F07 | Ref-Port / Known-Übersetzung beim Consumer fehlt exakt | **CLOSED_BY_THIS_REPAIR** | B.9-refs, B.9-interrogate, B.9-investigate | SA §2 refs; SB §5 | Master B.9 |
| F08 | M2 no-throw für beliebiges JS unknown nicht erfüllt | **CLOSED_BY_THIS_REPAIR** | B.10a, B.10b, B.10c | M2 §5.1, AC-05, AC-06 | Master B.10 |
| F09 | Quadratische Prefixarbeit durch wörtlichen Contract | **CLOSED_BY_THIS_REPAIR** | B.11-resolver, B.11-helpers, B.11-size, B.11-accuse, R08, B.11-A38 | SA §2/Ergänzung, SB §5, §11; A38 | Master B.11; R08/R09; Scale |
| F10 | Finale Public-Loadfehler-Allowlist offen | **CLOSED_BY_THIS_REPAIR** | B.12+R07, B.5-C41+B.12-C42 | SC §8; C42 | Master B.12; R07 |
| F11 | Vitrine aktuelle Release-/Save-Kompatibilität fehlt | **CLOSED_BY_EXISTING_TEXT** | — | kein Contract; P5-Gate | Master B.13; FB F11; Release-Proof-Closure §9 + Checkliste |

Ergebnis: **11 / 11 geschlossen** (10 CLOSED_BY_THIS_REPAIR, 1 CLOSED_BY_EXISTING_TEXT), **0 offen**. Kein Originalartefakt liefert neue konkrete widersprechende Evidenz.

Nonblocking F12 (Ein-Owner-Regel, CH-Pin): CLOSED_BY_THIS_REPAIR (P01 in SA/SB/SC; CH Design Dependency auf MYST-0002 v2).

## Begründungen

- **F01 — CLOSED_BY_THIS_REPAIR.** Inhalt durch bestehenden MYST-0001-v1-Text vollständig (fcv2 f4d31858…, Goldens); diese Integration pinnt ihn in SA/SB/SC (Startgate, PackageRefSource, R01), MYST-0004 und MYST-0005B.
- **F02 — CLOSED_BY_THIS_REPAIR.** D9(a) angenommen. Anhang forge-release-proof-v1 in SA §2 (P05) samt P06/P07; Kette Release → PlayerKnowledge Observation → authored Proof Premise → Proof Route → Solvability; NPC asserts P / Evidence supports P / Player heard P ⇒ P true ausgeschlossen.
- **F03 — CLOSED_BY_THIS_REPAIR.** PublicContent als strikte SA-Komponente, publicContentHash im releaseContextHash, Invalidierungszeile, A41/C41.
- **F04 — CLOSED_BY_THIS_REPAIR.** D8 angenommen. SB §6 (Kopien SA/SC) P08: vollständige richtige vierteilige direct_actor-Antwort = solved ohne Beleg-/Receipt-/Citation-Gate. Vitrine-Falldeltas P11–P20 sind als Re-Authoring-Delta für P5.2 festgehalten (kein Contract).
- **F05 — CLOSED_BY_THIS_REPAIR.** M2 §15 erlaubt öffentlich vorab festgelegte Dimensionen, verbietet geheime Auswahl; CH §6 Rollenzeile mit required_literals-Einzelrolle.
- **F06 — CLOSED_BY_THIS_REPAIR.** MYST-0005B §6 persistiert ausschließlich SB-§4-Event interrogate; ask kein Alias.
- **F07 — CLOSED_BY_THIS_REPAIR.** pkg.refs mit caseId/truthHash/refFor/resolve; SB interrogate übersetzt Präfix-Known in kanonische EntityRef[]; releaseEvidence(pkg.presentation,id,pkg.refs).
- **F08 — CLOSED_BY_THIS_REPAIR.** No-throw auf Plain-JSON + nicht werfende Getter (AC-E5) begrenzt; keine Sandbox.
- **F09 — CLOSED_BY_THIS_REPAIR.** Exakte Größenformel B0+ΣC(event_i)+max(0,n−1); beobachtbare Immutabilität statt Vollkopie; Resolve verifiziert einmal, Replay nutzt Binding; LIMIT vor Domainparse.
- **F10 — CLOSED_BY_THIS_REPAIR.** Player-Fassade gibt nur {ok:false,code:"SAVE_UNAVAILABLE"}; Detailcodes privat; HOST_FAILURE nie not_solved; C42.
- **F11 — CLOSED_BY_EXISTING_TEXT.** Als Contract-Freeze-Blocker durch bestehende Texte geschlossen (Master B.13, FB F11, Owner-Auftrag §17): bleibt Vitrine-Release-Gate P5 mit CERT-1..CERT-10 (VITRINE-RECERTIFICATION-CHECKLIST.md); echter Witness mit implementiertem Reducer, kein Scratch-Reducer.

## Freeze-Angriffe (FV, 50)

MYSTERY-FREEZE-BLOCKER-REPAIR: 44 closed/contained, 6 nur bedingt auf D8/D9 (#11–13, #15, #18 → F02; #29 → F04). Mit D8/D9 angenommen und P05–P08 integriert sind auch diese sechs durch den Candidate-Text geschlossen. Die 30 Zusatzregressionen der Freeze-Repair (28 deterministisch, 2 D8/D9-abhängig) gelten entsprechend.
