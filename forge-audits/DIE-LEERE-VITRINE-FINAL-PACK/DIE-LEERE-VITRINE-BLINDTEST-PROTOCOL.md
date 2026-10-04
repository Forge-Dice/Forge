# Die leere Vitrine — Blindtest-Protokoll

**Status: PROTOKOLL, NICHT DURCHGEFÜHRT.** Spielspaß, Verständlichkeit und menschliche Lösbarkeit bleiben **UNKNOWN**, bis ein Test nach diesem Protokoll stattgefunden hat. Grundlage: Blind Playtest Protocol der Solvability-Certification (§21), angepasst an D8 (keine Belegpflicht).

Dieses Dokument ist für die Moderation. Die Testperson sieht es nicht.

## 1. Voraussetzungen

- Ausführbar erst mit einer headless Oberfläche, die ein aufgelöstes Package dieses Pakets abspielt (frühestens nach CERT-2; aussagekräftig nach CERT-10). Ein Test auf dem historischen Scratch-Host ist möglich, misst dann aber den alten Brief mit Belegpflicht und ist als solcher zu kennzeichnen.
- Testperson erhält **nur** den PUBLIC-Abschnitt von `DIE-LEERE-VITRINE-FINAL-PLAYER-BRIEF.md` und die Oberfläche. Kein Zugriff auf Authoring Spec, Proof Profile, Checklist, Case Pack, Debug-Ausgaben oder Dateibrowser.
- Testperson kennt den Fall nicht und hat keine Projekt-Chats dazu gelesen.
- Moderation erklärt zu Beginn nur die Bedienung, keine Reihenfolge und keine Hinweise auf Kamera oder Terminal. Technische Hilfe wird protokolliert und als solche markiert.
- Denken laut und Notizen sind erlaubt. Keine Zeitbegrenzung; Abbruch jederzeit.

## 2. Ablauf

1. Brief lesen lassen (Zeitpunkt T0 = Ende des Lesens).
2. Frei spielen, bis `solved` oder freiwilliger Abbruch.
3. Nach jeder Anklage kurz fragen: „Warum diese Person?“ (wörtlich notieren, nicht kommentieren).
4. Abschlussinterview (Abschnitt 5).
5. Moderation füllt die Auswertung (Abschnitt 4) direkt nach dem Test aus.

## 3. Erfassung während des Tests

| Feld | Inhalt |
|---|---|
| Aktionsindex | fortlaufende Nummer |
| Uhrzeit (real) | nur im Testprotokoll, nicht im Spiel |
| Aktion | Durchsuchen / Frage (NPC + Text) / Gerät auslesen / Anklage |
| Sichtbares Angebot | welche Fragen und Ziele zu diesem Zeitpunkt angeboten wurden |
| Output | Karte, Antwort, solved/not_solved |
| Neu bekannt | neue Personen/Orte/Gegenstände/Vorgänge laut Oberfläche |
| Hypothese | geäußerte Vermutung + Begründung + Unsicherheit (wörtlich) |
| Wunschaktion | Aktionen oder Fragen, die die Testperson wollte, aber nicht fand |
| Moderationseingriff | ja/nein, Art |

## 4. Messgrößen (Auswertung)

| ID | Frage | Messung | Werte |
|---|---|---|---|
| B-01 | Konnte die Person den Täter bestimmen? | Endzustand | solved / Abbruch / technische Blockade / Moderationshilfe |
| B-02 | Wurde die Lösung erklärt oder geraten? | Abschlussbegründung gegen die Ableitung: nennt die Person für alle drei Ausgeschlossenen einen unabhängigen Bildnachweis zur Tatzeit und die Einer-aus-vier-Regel? | erklärt vollständig / teilweise / geraten / Ausschlussraten (alle Personen nacheinander) |
| B-03 | Welche Hinweise wurden genutzt? | Liste der in Hypothesen und Schlussbegründung genannten Karten und Aussagen | je Hinweis: genannt ja/nein; tragend ja/nein |
| B-04 | Wo gab es Sackgassen? | Phasen ≥3 aufeinanderfolgende Aktionen ohne neue Karte, neue Entität oder neue Frage; Wunschaktionen | Anzahl, Aktionsindex, Ursache laut Testperson |
| B-05 | War eine falsche Interpretation plausibel? | Hypothesen, die auf Besucherstempel (Max 18:02), Oskars Aussage zur Galerie um 18:04, Schlüsselquittung, Werkstattaufnahme oder Gesprächsverweigerung als Schuldbeweis beruhen | je Spur: vertreten ja/nein, wodurch aufgegeben |
| B-06 | Zeit bis zur ersten Anklage und bis solved | Realzeit ab T0; zusätzlich Aktionsanzahl | Minuten, Aktionen |
| B-07 | Anzahl Anklagen | Zähler | gesamt, davon not_solved |
| B-08 | Verständnis von not_solved | Interviewfrage 5 | hält not_solved für Unschuldsbeweis der Person ja/nein; erwartet Begründung ja/nein |
| B-09 | Bericht vs. Beobachtung | Abschlussbegründung | trennt NPC-Aussagen von Bildnachweisen ja/nein; versteht Oskars Irrtum ja/nein |
| B-10 | Fototermin-Lücke (R5) | Wunschaktion „nach dem Film fragen“ vor Fund des Kontaktbogens | ja/nein, wie lange gesucht |
| B-11 | Nebenhinweise | Interviewfrage 8 | Kontext / Füllmaterial / verwirrend |
| B-12 | Spielspaß | Interviewfrage 8 + 9 | freie Antwort; keine Skala als Ersatz für Messung |

Interpretation:
- Ein falscher erster Verdacht ist kein FAIL.
- **FAIL**: technische Sackgasse oder eine notwendige Information, die nur durch Erraten eines technischen Tokens erreichbar war.
- **REVIEW**: individueller ungelöster Durchlauf, reines Raten bei B-02, oder Abbruch an einer Sackgasse; das ist kein Gegenbeweis zur formalen Lösbarkeit.
- **PASS** (für diesen einen Durchlauf): Auftrag in eigenen Worten beschrieben; Schlussbegründung trennt Berichte, Beobachtungen und Ausschlussregel; keine versteckte notwendige Information.
- Mit D8 ist eine richtige Antwort ohne Beweise solved. B-02 ist deshalb die zentrale Messung, ob gelöst oder geraten wurde. Bis zu vier Versuche durch Ausprobieren sind möglich; das ist im Einführungsfall bewusst zugelassen und wird nur gemessen.

## 5. Abschlussinterview

1. Was war aus deiner Sicht der Auftrag?
2. Wie hat sich deine Vermutung im Verlauf verändert?
3. Welche Informationen waren für deine letzte Entscheidung ausschlaggebend?
4. Wie bist du mit widersprüchlichen Aussagen umgegangen?
5. Was hast du aus einem not_solved-Ergebnis geschlossen?
6. An welchen Stellen wusstest du nicht, was du als Nächstes tun kannst?
7. Gab es Informationen, die dir fehlten oder widersprüchlich erschienen?
8. Welche Teile fandest du interessant, mühsam oder unklar, und warum?
9. Würdest du einen weiteren Fall dieser Art spielen wollen? Warum (nicht)?

## 6. Umfang und Grenzen

- Ein Durchlauf ist explorativ, keine statistische Aussage. Für eine erste Aussage zu Fairness und Verständlichkeit mindestens drei unabhängige Testpersonen; Ergebnisse je Person getrennt berichten.
- Ergebnisse ändern weder Fall noch Lösung automatisch. Eine Fallreparatur (z. B. R5) ist eine eigene Authoring-Revision mit neuem publicContentHash und neuem Package.
- Ergebnisbericht ohne Lösung im Titel und in der Zusammenfassung, damit er weiteren Testpersonen nicht schadet.
