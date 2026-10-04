# Die leere Vitrine — Certification Checklist

**PRIVATE QA-DOKUMENT.** Stand 2026-10-04. Grundlage: CERT-1…CERT-10 aus `MYSTERY-RELEASE-PROOF-CERTIFICATION-CLOSURE/VITRINE-RECERTIFICATION-CHECKLIST.md` (Commit `d17f5211`, sha256 `fa13da70…`), wörtlich übernommen und in zwei Teile getrennt.

- **Teil A: AUTHORING CERTIFICATION.** Prüft authored Daten. Jetzt ausführbar.
- **Teil B: RUNTIME WITNESS.** Braucht implementierte, akzeptierte echte Domain-Komponenten (M1, M3, M4, M5A/B, Challenge, Solvability, Session A/B/C). Ein Scratch-Reducer, auch der historische Case-Pack-Host oder das Python-Modell dieses Pakets, gilt **nie** als Produktionswitness.

Verdikt-Regel (CERT-10): `CERTIFIED` erst nach CERT-1…CERT-9 gegen die reale Vertragskette. Spielspaß und menschliche Lösbarkeit bleiben getrennt UNKNOWN.

---

## Teil A — Authoring Certification (jetzt prüfbar)

| ID | Herkunft | Prüfpunkt | Wie prüfen | Stand dieses Pakets |
|---|---|---|---|---|
| AU-1 | CERT-3 | Human Review: jede Faktizitätslizenz (`rule:certified-sources` für d03/d04/d05) und jede PUBLIC_RULE-Instanz (`rule:manual-presence`, `rule:closed-roster`) lizenziert genau Body und Konsequenz, inklusive Zeit, Rolle, Negation. | Mensch liest §8.2 der Authoring Spec gegen die drei Regeltexte. | OFFEN (menschlicher Review nötig) |
| AU-2 | CERT-3 | Frage ist öffentlich, antwortunabhängig: vier Kandidaten × direct_actor, `required_literals`. | Challenge-JSON + Authoring-Check C01–C03. | PASS (Modell) |
| AU-3 | CERT-3 | Lösung, Hinweisquellen und Personen unverändert gegenüber Original. | Manifest: truth/solution/access/catalogue/profiles/snapshots per SHA-256 unverändert; truthHash/solutionHash neu berechnet. | PASS |
| AU-4 | CERT-5 (Modellteil) | Required literals aus freigegebenen OBSERVED-Roots ableitbar; must_disambiguate lässt genau 1 von 16 Vektoren; d04 allein 4, d05 allein 8, keine 16. | Authoring-Check A09–A12. | PASS (Modell) |
| AU-5 | CERT-5 (Modellteil) | Jede OBSERVED-Prämisse referenziert einen wörtlich authored Report ihrer Quell-Evidence mit `source: observation`; jede Prämisse ist kanonisch wahr; NPC-Berichte sind keine Roots. | Authoring-Check A13–A16. | PASS (Modell) |
| AU-6 | CERT-9 (Modellteil) | Alle 8 Evidence erreichbar; jeder Fortschrittszustand kann den Beweis noch erreichen; q08 erst nach d03; q05 ohne Reveal. | Authoring-Check A01–A07 (192 Zustände, unabhängig zur Certification reproduziert). | PASS (Modell) |
| AU-7 | CERT-7 (Datenteil) | Keine Canonical-ID in Public-Texten oder Spielerbrief; keine Lösung/kein Motiv; keine Citation-Pflicht; Fragetexte exakt 20; Labels eindeutig; Textlimits. | Authoring-Check P01–P08. | PASS (Modell, struktureller Marker-Scan) |
| AU-8 | CERT-7 (Datenteil) | Natürlichsprachliche Spoilerfreiheit von Brief, Regeln, Fragetexten, Kartentexten und Labels (z. B. dass „Werkstattaufnahme“ nichts über den Kasseteninhalt verrät). | Menschlicher Review; Marker-Scan beweist das nicht. | OFFEN (menschlicher Review nötig) |
| AU-9 | CERT-6 (Datenteil) | Challenge enthält kein Evidence-/Citation-/Proof-Feld; `requireReleasedProof` nirgends in Package-Komponenten; Brief ohne Belegpflicht (D8). | Authoring-Check C05, P04; Manifest `forbiddenLegacyInputs`. | PASS |
| AU-10 | CERT-2 (Datenteil) | Package-Manifest-Kandidat vollständig; alle nicht berechenbaren Hashes als `TO_BE_COMPUTED_FROM_FINAL_ARTIFACT`; Scratch-Salt/-Namespace/-Hashes verboten. | Manifest-Review. | PASS (Kandidat) |
| AU-11 | CERT-1 (Vorbereitung) | Quellenstand dokumentiert; abhängige Stellen gegenüber Final Mystery Contract Integration markiert. | Authoring Spec §0.2, §14. | PASS; Integration abgeglichen (Spec §14), Contract-Pins offen bis Akzeptanz |

Ausführen: `python3 DIE-LEERE-VITRINE-AUTHORING-CHECK.py <case-pack-dir>` (Python-Standardbibliothek). Ergebnis dieses Pakets: **31/31 PASS**, siehe `DIE-LEERE-VITRINE-AUTHORING-CHECK.results.json`. Zwei Mutationen (Spoiler + Citation im Brief, entfernter q14-Reveal) wurden erkannt (4 FAIL), die Prüfungen können also scheitern. Das Modell ist ein unabhängiger Authoring-Referenzcheck, **kein Runtime Witness**.

## Teil B — Runtime Witness (benötigt reale Module)

| ID | Prüfpunkt (wörtlich nach Closure, gekürzt) | Voraussetzung | Stand |
|---|---|---|---|
| CERT-1 | Akzeptierte und gepinnte Revisionen von MYST-0001/2/3/4/5A/5B, Challenge, Solvability, Session A/B/C inkl. Session-A-Adapter/PublicContent-Anhang und Master-Repairs; exakte Quellversionen; azyklischer Dependency-/Hashgraph. | Akzeptanz der Integrations-Kandidaten + Registrierung | NOT STARTED |
| CERT-2 | Vollständig migriertes, unveränderliches Vitrine-Package mit echten PlayerRefs und aktuellen DTOs/Events auflösen; Public-Text/Regeln, Snapshots, Access, Selectors, Deskriptoren und Proof Profile binden; alten Scratch-releaseHash/Ref-Namespace und jeden stale/fremden Input ablehnen. | echter Package-Resolver (Session A), MYST-0001 | NOT STARTED |
| CERT-3 | (Authoring-Teil = AU-1, AU-2, AU-3) | – | siehe Teil A |
| CERT-4 | Bestehenden 5-Schritt-Witness durch echten Reducer/Replay ab Initialzustand laufen lassen; tatsächliche d03/d04/d05-Reports, q08/q14-Mentions, Regel-Display/qualifizierte Receipts und adapterabgeleitete ReleasedObservations erfassen. Canned expected-root Port ablehnen. | Session B Reducer/Replay, M3/M4/M5B, Adapter-Runner | NOT STARTED |
| CERT-5 | Echtes `checkCaseSolvability`: Required literals abgeleitet, must_disambiguate lässt genau 1 von 16; Positivkontrollen pass; fehlende/vertauschte/falsche/unlizenzierte Roots fail; gültige Reihenfolgevarianten (Route B) prüfen; keine zweite unabhängige Evidence-Route behaupten. | MYST-SOLVABILITY-0001 implementiert | NOT STARTED (Modellteil AU-4/AU-5 PASS) |
| CERT-6 | D8 mit echter Challenge/Session: richtige vollständige Anfangsantwort solved; alle 15 falschen vollständigen Vektoren not_solved; partial/unknown/fremde/doppelte Claims wie spezifiziert; Evidence-Anzahl und fehlende NPC-Aussagen ergeben kein Siegtor; nach solved jedes Event abgelehnt. | MYST-0002, CH, Session B | NOT STARTED |
| CERT-7 | An jedem akzeptierten Präfix echte Release-/PlayerKnowledge-/PublicView-Tests der PUBLIC/INTERNAL/SECRET-Grenzen inkl. hidden person/location (InfoFlow F01), öffentliche Kartenreihenfolge (F02), opake Frage-IDs, knowledge↔belief, Testimony-Quelle, Proof/Solution/Error-Leaks, Namespace-Rebinding. | Session A/B, M4, M5B | NOT STARTED (Datenteil AU-7/AU-8) |
| CERT-8 | Save/Load/Replay des Witness und einer solved-Historie: exakter State und Public Outputs, Eventreihenfolge, Checksum; inkompatible Packages/geänderte Texte/Salt/Selector/Regeln abgelehnt; öffentlicher Fehler konstant `SAVE_UNAVAILABLE`; technische Fehler nie not_solved. | Session C | NOT STARTED |
| CERT-9 | Begrenzte erreichbare Progression mit echten Modulen: jeder getestete nichtterminale Präfix hat eine legale Vervollständigung zum Witness; Wiederholungen und falsche Anklagen erhalten Fortschritt; q08 vor d03 und Kamera vor Reveal ohne Mutation abgelehnt. | Session B + alle Ports | NOT STARTED (Modellteil AU-6 PASS) |
| CERT-10 | Unabhängiger Rezertifizierer archiviert reale Modul-/Versions-/Commit-Evidence, Kommandos, Logs, Negativfälle, Artefakt-Hashes. CERTIFIED nur nach CERT-1…9. Spaß und menschliche Lösbarkeit separat UNKNOWN; Blindtest optional. Kein Scratch-Reducer als Produktionsnachweis. | alles oben | NOT STARTED |

## Reihenfolge (verbindlich nach Owner Reconciliation B.13 / P5)

Contracts akzeptiert und gepinnt → Vitrine-Komponenten auf aktuelle Verträge (dieses Paket) → echte PlayerRefs mit paketgebundenem Salt erzeugen, Package auflösen, Proof Profile und releaseManifest neu binden → CERT-4…CERT-9 mit echtem Replay-Port und Save/Load-Roundtrip → CERT-10 → optional Blindtest.

## Aktueller Gesamtstatus

- Authoring Certification: bereit; Modellteile PASS, zwei menschliche Reviews (AU-1, AU-8) offen.
- Runtime Witness: **erforderlich**, nicht begonnen, blockiert auf Implementierung.
- Historische Certification (`e66e7e19`): bleibt NOT CERTIFIED für das historische Scratch-Package.
- Verdikt dieses Pakets: **NOT YET CERTIFIED** (kein Widerspruch zur Lösbarkeit des Modells).
