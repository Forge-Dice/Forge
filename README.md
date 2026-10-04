# Forge

Node 22, TypeScript, zod. `npm install`, then `npm run typecheck` and `npm test`.

## Spielen und Fälle schreiben

### Spielen

```sh
npm run play                 # Terminal, Fall "vitrine"
npm run play -- geige        # anderer Fall: vitrine, brieföffner (briefoeffner), geige, hüttenkasse, nachtzug
npm run play -- geige --lang en   # auf Englisch (im Browser: Umschalter oben, die Wahl bleibt gespeichert)
npm run play:web             # Browser auf http://localhost:4173 (PORT=… für einen anderen Port)
npm run build:web            # eine einzige HTML-Datei (dist/kriminalfaelle.html), spielbar ohne Server
npm run play -- liste        # alle Fälle mit Schwierigkeit
```

Befehle im Terminal (`hilfe` zeigt sie im Spiel):

| Befehl | Wirkung |
| --- | --- |
| `fall` | Fallbeschreibung, Regeln und Auftrag |
| `bekannt` | alles, was du bisher kennst |
| `u`, `u <nr>` | Untersuchungen anzeigen, eine ausführen |
| `f`, `f <nr>` | Fragen anzeigen, eine stellen |
| `v`, `v <nr>` | einer Aussage einen Fund vorhalten |
| `j` | Journal: alle Funde und Aussagen, Zahl der Hinweise |
| `a`, `a <nr>` | Verdächtige anzeigen, anklagen |
| `h` | Hinweis; wiederholt wird er konkreter, er wird gezählt |
| `speichern [datei]`, `laden [datei]` | Spielstand (Standard: `<fall>.save.json`) |
| `ende` | beenden |

Ein Spielstand ist das Ereignisprotokoll der Session; Laden spielt es neu ab. Auf Englisch heißen die
Befehle `case`, `known`, `i`, `q`, `c`, `j`, `a`, `h`, `save`, `load`, `quit` (`help`); beide Sätze
gelten in beiden Sprachen. Ein Spielstand lädt auch in der anderen Sprache.

### Fälle schreiben

Ein Fall ist ein Ordner mit JSON-Dateien (Beispiele unter `tests/fixtures/`):

| Datei | Inhalt |
| --- | --- |
| `case.json` | `{ "refSalt": "<32 Hex-Zeichen>" }`, fest, damit Spielstände gültig bleiben |
| `truth.json` | die Wahrheit: Personen, Orte, Gegenstände, Ereignisse, Aussagen, Beweise |
| `solution.json` | die Lösung und die geforderten Schlüsse |
| `evidence-access.json` | welche Untersuchung welchen Fund liefert |
| `evidence-presentation.json` | wie ein Fund dem Spieler gezeigt wird |
| `questions.json` | Fragenkatalog |
| `npc-<name>.json`, `interrogation-<name>.json` | Wissen und Antwortregeln je befragbarer Person (Lügen: Regel `act: "lie"`) |
| `initial-setup.json` | was der Spieler zu Beginn kennt |
| `challenge.json` | die Anklage-Aufgabe |
| `public-content.json` | Titel, Einleitung, Regeln, Namen, Fragetexte, optional Epilog |
| `release-manifest.json` | der Lösungsweg (Zeuge): Schritte mit `{"$playerRefOf": {kind, id}}` |
| `proof-profile.json` | der Beweis, dass der Lösungsweg den Fall entscheidet |

Hashes, die das Werkzeug berechnet, schreibt man als `"TO_BE_COMPUTED_FROM_FINAL_ARTIFACT"`.

```sh
npm run check-case -- tests/fixtures/geige          # prüft Dateien, Bindungen und Lösbarkeit
npm run check-case -- --fix tests/fixtures/geige    # trägt berechnete Hashes ein
```

Sprachfassungen: ein Unterordner je Sprache (`en/`) mit übersetzter `public-content.json` und
`evidence-presentation.json`. Nur Texte ändern sich (Titel, Einleitung, Namen, Rollen, Fragen, Regeln,
Fundtexte, Epilog); Wahrheit, Lösung, Personen und Beweis bleiben gemeinsam. `check-case` prüft jede
Sprachfassung nach dem Grundfall: reine Übersetzung, keine internen IDs, lösbar. Die Texte der
Oberfläche stehen in `src/play/messages.ts`.

Exit-Code 0 heißt: gültig und lösbar. Jeder Fehler nennt Datei und Feld. Spielbar wird ein Fall mit
einem Eintrag in `PLAY_CASES` (`src/play/cases.ts`).

Ist der Fall gültig, spielt ihn `check-case` zusätzlich mit dem Spieltest-Bot und gibt dessen
Balance-Warnungen als Hinweise aus (`--ohne-spieltest` lässt das weg). Ausführlich:

```sh
npm run playtest -- geige       # oder: all; --seeds N für mehr oder weniger Läufe
```

Vier simulierte Spielstile (systematisch, neugierig, voreilig, hinweise) spielen über die echte
Session. Ein Bot klagt richtig an, sobald sein eigenes Wissen den Beweis des Falls trägt. Daraus
folgen Kennzahlen, eine Schwierigkeit von 1 bis 5 und Warnungen (zu früh lösbar, falsche Fährte nie
berührt, Fund ohne Rolle im Beweis, Raten lohnt sich). Die Schwierigkeit steht als `difficulty` in
`PLAY_CASES`; ein Test hält sie gleich dem gemessenen Wert, `npm run playtest` nennt bei Abweichung
den neuen Wert.

Regelversionen (v1, v2, v3) sind an einer Stelle erklärt: `RULESET_VERSIONS` in
`src/domain/case-package.ts`. Kurz: v1 ohne Lügen, v2 mit Lügen und Vorhalten, v3 zusätzlich mit
Hinweisen. `check-case` zertifiziert unter v1 oder v2, gespielt wird jeder Fall unter v3.
