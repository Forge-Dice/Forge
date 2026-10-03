# TASK-0005 — Mutation-, Security- und Typprüfplan

Status: planned, NOT EXECUTED.
Contract: Version 2, 0453f85ad2ccb557a1f215e8bb912655597588fa.
Dependency: 1de7efeefccb8c0ab130b582d1389f7fc0f5ebf8.
Keine TASK-0005-Produktion vorhanden; dieser Katalog behauptet keinen Mutationserfolg.
Tatsächlich ausgeführte M1-Smokes stehen ausschließlich in TASK-0004-M1-verification.md.

## Reproduktionsprotokoll nach formaler Freigabe

1. Exakten Implementierungs-SHA in sauberem, separatem Checkout auschecken.
2. npm ci, npm run typecheck, npm test; Exitcodes, Testzahlen und Runtime-Versionen protokollieren.
3. Jeden Mutanten einzeln im Speicher oder in einem separaten temporären Checkout anwenden.
4. Exakt erwartete Fundstellenzahl sowie Original-/Mutant-Source-Hashes erfassen.
5. Behauptete Änderung durch Diff oder Transform-Ausgabe nachweisen; keine bloße replace-Annahme.
6. Testlauf muss die veränderte Funktion erreichen; passende Regression namentlich benennen.
7. Nach dem Lauf Originalzustand nachweisen, insbesondere keine Mutation im später gepushten Commit.
8. Testfehler, Infrastrukturfehler und nicht angewendete Mutationen getrennt zählen.
9. Remote-Commit erneut frisch prüfen; lokale grüne Runs ersetzen den Remote-Nachweis nicht.

Klassifikation:

- detected: Mutation nachweislich angewendet, Testlauf gültig, erwarteter Verhaltensbruch durch Assertion erkannt.
- survived: Mutation angewendet/erreichbar, gültiger Testlauf bleibt grün.
- equivalent: zusätzlich nachvollziehbarer semantischer Beweis für alle erlaubten Eingaben; nicht nur fehlende Testabdeckung.
- invalid: verändertes Programm kompiliert/startet nicht oder Infrastrukturfehler verhindert den Verhaltensnachweis.
- not_applied: keine/verfehlte Fundstelle, unveränderte Source oder unbestätigte Transformation.
- not_run: geplanter Mutant ohne Lauf.

Ein Timeout allein ist kein genereller detected-Beleg: erst konkrete Änderung und reproduzierbare verletzte Terminierungsanforderung belegen.
Kombinierte Mutationen separat kennzeichnen; sie ersetzen nicht die Einzelmutanten.

## Must-detect-Katalog

Alle Einträge aktuell not_run. Die Implementierungsstruktur kann Mutationsstellen ändern, nicht die verlangte Beobachtung.

| ID | Mutation | Konkretes Gegenbeispiel | Erwartete Erkennung |
|---|---|---|---|
| D01 | Query-Originalref-Herkunft weglassen | Fremde wertgleiche person/event-Refs in Query A | safeParse muss scheitern, mit relevanter claim-Ref-Pfadzuordnung |
| D02 | Policy-Originalref-Herkunft weglassen | Subject aus Projektion B mit gleichem Paar | safeParse false; rules/0/subject |
| D03 | Ref-Herkunft erst an geclonten Refs prüfen | Eigene korrekte Original-Refs | Positive Parsefälle werden fälschlich abgelehnt |
| D04 | Query-Owner-Prüfung weglassen | Query von Engine B, lokale Policy A | Exakt DIALOGUE_CONTEXT_MISMATCH statt Erfolg |
| D05 | Policy-Owner-Prüfung weglassen | Query A, Policy B | Derselbe Fehler |
| D06 | Globale statt engine-lokaler Owner-Registry | Zwei Engines über identischem Context | Gegenseitige Inputs bleiben unzulässig |
| D07 | Kategorie aus Subject-Schlüssel entfernen | proposition:1 und conclusion:1 verschiedene Regeln | Beide Regeln getrennt akzeptiert und korrekt ausgewertet |
| D08 | Nur Ref-Objektidentität für Claim-Gleichheit | Gleiches Paar aus anderer lokaler Original-Instanz | Muss gematchte Attitude finden, nicht Unwissen |
| D09 | at oder role beim Claim-Matching ignorieren | Exakter Claim fehlt bei anderem Tick/Rolle | Nur Unwissen statt Assertion |
| D10 | Ursache/Ziel im Claim gleichsetzen | Zwei sichtbare Events, vertauschte Kante | Keine transitive/umgekehrte Ableitung |
| D11 | Unbekannten Query-Claim ins Result kopieren | Nur Awareness, keine Attitude | Exakt inhaltsfreier claim_ignorance |
| D12 | Belief answer als deceptive markieren | V03 bzw. V09 | sincere trotz objektiv falscher Einschätzung |
| D13 | Invert ohne Boolean-Umkehr | V10/V11 und Gegenpolaritäten | Boolean muss invertiert sein |
| D14 | Invert setzt immer false | Belief/Knowledge false | Erwartetes true |
| D15 | Invert ändert commitment zu unqualified | Belief-Stance | commitment bleibt belief |
| D16 | uncertain(null) über Truthiness in false ändern | V18 | leaning bleibt null |
| D17 | uncertain(false) als fehlend interpretieren | V20 | express_uncertainty false statt Unwissen |
| D18 | Invert auf uncertain erlauben | true/false/null leaning | Policy-Parse muss ablehnen |
| D19 | feign_ignorance als sincere markieren | Knowledge/Belief/Uncertain | deceptive; Act trotzdem inhaltsgleich ehrlicher Unwissenheit |
| D20 | Subject/hasKnowledge an refuse hängen | V14/V15 | Exact-keys und bekannte/fehlende Attitude ununterscheidbar |
| D21 | Evade erfindet alternativen Claim | V16/V17 | Act enthält nur kind |
| D22 | Intent am Act speichern | Deceptive Assertion/Ignorance | Act-Allowlist und Descriptorprüfung |
| D23 | Spezifische Regel ignorieren | Default refuse + spezifisch answer | Assertion statt Refusal |
| D24 | Erste beliebige Regel wählen | Zwei Subjects mit unterschiedlichen Regeln | Query für zweites Subject und Regelpermutation |
| D25 | Doppelte Regeln zulassen/last-wins | Identische und gegensätzliche Duplikate | Parsefehler unabhängig von Reihenfolge |
| D26 | Deep-freeze weglassen | Erfolgreicher Query/Policy/Result | Alle Ebenen Object.isFrozen plus Mutationversuch |
| D27 | Claim/Subject aus Context direkt übernehmen | Assertion mit verschachtelten Refs | Quellobjekt-Identitätsprüfung gegen Context |
| D28 | Claim aus geparster Query direkt übernehmen | Bekanntes Statement | Quellobjekt-Identitätsprüfung gegen Parsed-Query |
| D29 | Nur flaches Input-Clone | Rohpolicy.rules nach Parse ändern | Geparste Policy unverändert, Rohcontainer nicht eingefroren |
| D30 | Result bekommt verborgenes Context-Feld | Object.defineProperty nonenumerable | Reflect.ownKeys/Descriptors + Source-Identität |
| D31 | Owner/Context in Symbol-Property speichern | Symbol am Query/Result | Keine Runtime-Brands als Property erlaubt |
| D32 | Context/Decision als Result-Prototyp setzen | Verdeckter Rückverweis | Erlaubten Prototyp und Objektgraph prüfen |
| D33 | Datenvormerkung liest Getter | Werfender Getter an claim/person/rules | Aufrufzähler 0; normaler ZodError |
| D34 | Symbol-/nonenumerable-Vorprüfung entfernen | Verborgene private Source in Rohinput | Parse muss ablehnen |
| D35 | Zyklusprüfung behandelt DAG als Zyklus | Derselbe Originaleventref in causeEvent und event | Zulässige Frage muss parsebar bleiben |
| D36 | Neue Claim-Art via default/spread freigeben | Unbekanntes kind/Zusatzproperty | Strict-Parsefehler und Compile-Time-Drift-Probe |
| D37 | Regelreihenfolge beeinflusst Result | Permutation disjunkter Regeln | Deep-/JSON-Gleichheit |
| D38 | Zufalls-/Zeitfeld hinzufügen | Wiederholte identische Inputs | Exakte Shape plus deterministisches JSON |
| D39 | Fehler verrät Query/Policy/Context | Fremde Engine-Inputs | Exakt success:false,code; keine weiteren Keys |
| D40 | Unsichere Tick/Index-Zahlen akzeptieren | NaN/Infinity/2**53/-0 für Tick/0 für Ref | Normaler Parsefehler |
| D41 | Default invert/feign_ignorance zulassen | Fehlende Attitude | Strict-Enum-Parsefehler; keine Default-Täuschung |
| D42 | Nur unbekannte Extra-Properties strippen | Text/rawId/truth/provenance einschleusen | Strict-ZodError statt stilles Entfernen |
| D43 | feign-/Default-Kopplung entfernen | feign_ignorance unter Default refuse/evade | Policy-Parsefehler an rules/i/action für alle sieben Stance-Ausprägungen |

Ein D07-Einzelmutant kann bei zusätzlicher gleichwertiger Kategorieprüfung wirkungslos sein.
Dann NICHT künstlich must_detect behaupten: genaue Mutationsstelle dokumentieren und beweisen, welche zweite Prüfung ihn äquivalent macht.
Das Verhalten "Kategorie ignorieren" als Gesamtausfall muss dennoch mit einem gezielten Mutanten detektierbar bleiben.

## Equivalence-Kandidaten — keine vorweggenommene Klassifikation

| Änderung | Möglicher Beweis | Wann keinesfalls equivalent |
|---|---|---|
| Private Lookup-Map durch lineare Suche ersetzen | Gleiche eindeutige Subjects/Claims, keine Seiteneffekte | Erst-/letztwins bei erlaubten Duplikaten; Property-/Regelreihenfolge beeinflusst Result |
| Redundanten Pair-Existenzcheck nach erfolgreicher Originalref-Prüfung entfernen | Alle registrierten Originalrefs stammen ausschließlich aus gültigem immutable Context | Registry enthält mehr Objekte, falsche Kategorie oder fremde Ref-Vorkommen |
| Innere zweite Freeze-Anweisung entfernen | Übergeordneter rekursiver Freeze erreicht dasselbe Objekt vor Rückgabe | Pfad gibt vorher zurück oder einzelne Inputs bleiben frei |
| Aktionszweige mit identischem inhaltsfreiem Act zusammenfassen | Decision.intent bleibt in jedem Fall korrekt | honest/deceptive ignorance wird intern gleichgesetzt |
| Numerischen Compare-Code stilistisch ändern | Für alle erlaubten sicheren Indizes gleiche Totalordnung | localeCompare/Systemlocale/Strings statt Zahlen |
| Nicht verwendeten lokalen Cache entfernen | Reine Optimierung ohne gespeicherte Entscheidungszustände | Cache bestimmt Owner/Herkunft oder Ausgabeidentität |

"Vom Compiler blockiert" ist ein Type-Safety-Beleg, aber kein bestandener Runtime-Mutationstest.
Zum Beispiel ein zusätzliches Claim-kind, das schon am Exhaustiveness-Test scheitert, separat als Compile-Time-Drift-Test dokumentieren.

## Handgeschriebene negative Testvektoren

Diese Fälle sind Testaufbau-Anweisungen, kein neues Query-JSON-Protokoll.

| ID | Aufbau | Erwartung |
|---|---|---|
| N01 | Originalpersonref aus neuer wertgleicher Projektion | Query safeParse false; Ref-Pfad betroffen |
| N02 | { ...localOriginalRef } statt Original | Ebenfalls abgelehnt |
| N03 | JSON.parse(JSON.stringify(queryInput)) | Abgelehnt; Serialisierung ist keine Neubindung |
| N04 | policy.rules[0].subject aus fremder Projektion | Policy safeParse false |
| N05 | Engine A parsed query an Engine B evaluate mit B-policy | Exakt eingefrorenes Mismatch-Result |
| N06 | Gleicher Context, zwei Engines, geparste Inputs tauschen | Ebenfalls Mismatch |
| N07 | Original entity-Ref als Policy-Subject | Kategoriefehler |
| N08 | Original statement-Ref als Claim-Event | Kategoriefehler |
| N09 | Alle Values stimmen, aber Query enthält eigenes truth oder text | Strict-Parsefehler |
| N10 | Invert-Regel auf vorhandene uncertain-Attitude | Action-Pfad-ZodError |
| N11 | Zwei Regeln für dieselbe Subject-Paaridentität | ZodError auch bei identischer Aktion |
| N12 | Fehlende DefaultAction/SchemaVersion/rules | Pflichtfeldfehler |
| N13 | Person-/Event-/Evidence-Awareness, keine Attitudes | Zulässige Frage mit Default answer → sincere ignorance |
| N14 | Query unbekannter Claim bei Default refuse/evade | Withholding, ausschließlich kind im Act |
| N15 | Query-ClaimcauseEvent === event als Originalobjekt-DAG | Parse zulässig, ohne Attitude Unwissen |
| N16 | Getter wirft bei Zugriff | Getter nie aufgerufen; safeParse false |
| N17 | Zyklischer eigener Zusatzcontainer | Kein RangeError; normaler ZodError |
| N18 | Array mit Loch/extra-property/eigenem Symbol | Normaler ZodError, kein stilles Weglassen |
| N19 | feign_ignorance unter Default refuse oder evade | Parsefehler an rules/i/action; kein Act |

AC-23-Kreuzvergleiche immer unter IDENTISCHER Policy ausführen, nur Query ändern:
- Default refuse + passende refuse-Regel: bekannte/fehlende Attitude → gleicher Act.
- Default evade + passende evade-Regel: ebenfalls gleicher Act.
- Default answer + feign-Regel: deceptive/honest ignorance → gleicher Act, unterschiedlicher interner Intent.
- Abweichende refuse-/evade-Regel: bekannte/fehlende Attitude → bewusst unterscheidbare Acts; dokumentierter Existenzhinweis.

Der unabhängige Review 8357672 nennt einen Mutanten "Claim aus Query statt Context".
Bei direkter Objektweitergabe muss D28 ihn erkennen. Bei vollständig neu aufgebautem Claim nach erfolgreichem exaktem Match sind die Daten dagegen identisch.
Ohne weitere Seiteneffekte kann ein solcher feldweiser Neubau beobachtbar äquivalent sein; die normative Context-Quellregel bleibt zusätzlich Gegenstand des Codereviews.
Ein Identitätstest kann nicht beweisen, aus welcher von zwei wertgleichen Quellen einzelne primitive Werte gelesen wurden.

## Integrations- und Metamorphic-Plan

- Domain-Objekte nur in Testfixtures verwenden; Engine bekommt immer nur echten erfolgreichen Context.
- Verborgene Texte ändern → Truth/Solution/NPC korrekt neu parsen und neu hashen → sichtbare Gleichheit zuerst prüfen → gleiche lokale Query/Policy → gleiches Result.
- Drei kanonische Conclusion-Statuswerte bei gleichem NPC-Belief: Kommunikation bleibt gleich.
- Veränderte Autoren-Provenance bei unveränderter freigegebener Attitude: kein Einfluss auf Result.
- Snapshot-Revision und acquisition-Zeiten ändern, soweit TASK-0004 gültig und asOf gleich bleibt: keine neue Runtime-Information.
- Reihenfolge der Source-Collections und NPC-Collections permutieren: TASK-0004-Invarianz zuerst prüfen.
- Deep-equal Contexts sind keine austauschbaren Capability-Objekte: eigene Inputs erfolgreich, direkte Fremdinputs scheitern.
- Keine künstliche Runtime-Abhängigkeit auf fs/crypto/CaseTruth für einen Security-Test in den Produktionscode aufnehmen.

## Abschlussformat für den späteren Developer

Tabelle je Mutation: ID, exakte Before/After-Stelle, Fundstellenzahl, Source-/Mutant-Hash, erreichter Testname,
Exitcode, passed/failed/error-Zahlen, Klassifikation mit Begründung.

Zusätzlich: tatsächlicher Diff, API-Exportliste, Produktionszeilenzahl, Typprüfergebnis,
frische Remote-SHA-Verifikation, offene Security-Findings.
Solange TASK-0005 nicht approved implementiert ist, bleiben sämtliche D-/N-Einträge geplant.
