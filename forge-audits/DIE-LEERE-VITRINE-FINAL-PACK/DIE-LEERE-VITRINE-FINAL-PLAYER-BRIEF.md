# Die leere Vitrine — Finaler Spielerbrief

> **Status:** FINAL AUTHORING CANDIDATE. Spoilerfreier Startbrief. Der Abschnitt zwischen den Markern `PUBLIC-BEGIN` und `PUBLIC-END` ist der einzige Teil, den Blindtester oder Spieler erhalten. Er ist eine Darstellung von `DIE-LEERE-VITRINE-FINAL-PUBLIC-CONTENT.json` (title, brief, challengeQuestion, Labels/Rollen der initial bekannten Entitäten, publicRules) und enthält keinen weiteren Text. Normativ für die Runtime sind die Bytes in PublicContent, nicht diese Markdown-Darstellung.
>
> Änderungen gegenüber dem Original-Brief (`DIE-LEERE-VITRINE-PLAYER-BRIEF.html`, sha256 `954bf394…`): ausschließlich die D8-Patches P11, P12, P13 aus MYSTERY-RELEASE-PROOF-CERTIFICATION-CLOSURE (Belegpflicht entfernt) sowie die bereits im Original-`public-initial.json` vorhandene Startzeit 18:08. Keine neue Person, kein neuer Ort, kein neuer Hinweis. Der Hinweis „nicht Teil einer implementierten Oberfläche" bleibt hier außerhalb des Spielertexts.

<!-- PUBLIC-BEGIN -->

## Die leere Vitrine

Es ist 18:08 Uhr. Die Goldmedaille „Morgenstern“ fehlt. Der authentifizierte Sensor setzt die eigenhändige Entnahme auf 18:04:00 in der Galerie. Prüfe die vier verbliebenen Personen. Unabhängige Nachweise helfen dir, den Fall zu lösen.

### Dein Auftrag

**Wer entnahm die Medaille eigenhändig?**

Wähle genau eine der vier Personen als eigenhändigen Entnehmer. Die Nachweise helfen dir beim Deduzieren. Eine vollständige richtige Antwort löst den Fall auch ohne gesammelte oder zitierte Belege. not_solved bedeutet, dass die eingereichte Antwort den Fallauftrag noch nicht erfüllt; es nennt keine falschen Einzelaussagen.

### Vier Personen

| Name | Rolle |
|---|---|
| Max Brandt | Historiker und Vertreter der ehemaligen Eigentümerfamilie |
| Lina Kern | Restauratorin |
| Nora Weiss | Museumsfotografin |
| Oskar Falk | Aufsicht und Schlüsselverwalter |

### Fünf Orte

| Ort | Startinteresse |
|---|---|
| Galerie | Die leere Vitrine und die Besuchsaufzeichnungen. |
| Innenhof | Der Bereich des Fototermins. |
| Archiv | Aufsicht, Arbeitsaufzeichnungen und Schlüsselverwaltung. |
| Werkstatt | Restaurierung und Transportmaterial. |
| Foyer | Schließung und Anwesenheitsliste. |

### Fallregeln

1. Die Medaille wurde um 18:04:00 in der Galerie von einer einzelnen Person eigenhändig entnommen. Wer nachweislich zu genau diesem Zeitpunkt an einem anderen Ort war, scheidet als direkter Entnehmer aus.
2. Nur Max, Lina, Nora und Oskar kommen als direkte Entnehmer in Betracht. Es gab genau einen direkten Entnehmer. Sind drei ausgeschlossen, bleibt die vierte Person.
3. Die als Beobachtung freigegebenen Bildnachweise sind in diesem Fall unverfälscht und mit dem Entnahmesensor synchronisiert. Zeugenaussagen können irren. Ein Besuch zu einer anderen Uhrzeit und eine Gesprächsverweigerung beweisen keine eigenhändige Entnahme.

### Deine Aktionen

Orte durchsuchen, verfügbare strukturierte Fragen an Personen stellen, freigegebene Gerätenachweise auslesen und eine vollständige Antwort abgeben. Neue bekannte Entitäten können weitere Fragen oder Nachweise verfügbar machen. Fragen und Untersuchungen sind wiederholbar; sie verbrauchen in diesem ersten Fall keine Zeit und keine Punkte.

Aussagen von Personen gehören ins Berichtsjournal. Unabhängige Beobachtungen bleiben getrennt. Eine Gesprächsverweigerung und ein bloßer früherer Besuch sind keine Schuldbeweise.

<!-- PUBLIC-END -->

## Autorenhinweise (nicht an Spieler)

- Initial bekannt und daher hier benennbar: vier Personen, fünf Orte, die Medaille, die Entnahme um 18:04. Nichts sonst. Kamera, Archivterminal, Fototermin, Archivarbeit, Schlüssel, Kassette und alle Nachweise werden erst durch Spielaktionen bekannt.
- „Innenhof – der Bereich des Fototermins“ ist Ortsprosa, kein bekannter Vorgang. Die Frage nach dem Film wird erst nach dem Fund des Kontaktbogens verfügbar. Ob das verwirrt, misst der Blindtest (Protokoll B-10); der Zertifizierungs-Repair R5 bleibt bewusst bedingt.
- Die Reihenfolge Max, Lina, Nora, Oskar ist eine feste authored Darstellungsreihenfolge und keine Lösungsreihenfolge.
