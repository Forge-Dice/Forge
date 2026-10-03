# TASK-0005 — Reconciliation und adversarialer Self-Audit

Status: review_ready; kein unabhängiger Architekturentscheid und keine Implementierungsfreigabe.
Vertragsquelle: forge/contracts/TASK-0005.md, Version 2, Commit 0453f85ad2ccb557a1f215e8bb912655597588fa.
Contract-Blob: 1e6f36e56ca439e50502ec1717b8e842499bf115.
Geprüfte Dependency: 1de7efeefccb8c0ab130b582d1389f7fc0f5ebf8.
TASK-0004-Produktion: e9cb8e23c765deee5fab2d16bc0b793f53708714.

Dieses Dokument ist ein Review-Beleg. Es erweitert den Contract nicht und ersetzt keine Acceptance Tests.
TASK-0005-Code wurde weder angelegt noch ausgeführt. "Geplant" und "am Dependency-Code geprüft" sind getrennte Nachweisarten.

## Ergebnis und Gate

Keine offene technische Dependency-Annahme im Kandidaten gefunden. Der zwischenzeitlich eingetroffene unabhängige Review der Version 1 fand jedoch B1/J1; Version 2 ist die noch nicht freigegebene Antwort darauf. Drei Architekturentscheidungen sind explizit und müssen extern mitgeprüft werden:

1. Claim-Query statt ausschließlich Statement-Handle: sonst wäre echte Unwissenheit zu einer noch nicht vorhandenen Attitude nicht anfragbar.
2. Nur flüchtige Runtime-Policy; keine persistente Author-Policy und kein Welt→Policy-Adapter.
3. Originalref-Herkunft plus Engine-Owner-Bindung: numerische Handle-Gleichheit reicht für fremde Projektionen nicht.

Implementierung bleibt BLOCKED_PENDING_APPROVAL. Ein Selbstreview, ein grüner TASK-0004-Testlauf und eine Core-Freigabe öffnen dieses Gate nicht.
Bei Änderung dieser Entscheidungen muss der Contract versioniert und erneut reconciled werden.

## Tatsächliche API-/Code-Kompatibilitätsmatrix

Alle Pfade relativ zum Repository; Zeilen beziehen sich auf die Dependency-Basis.

| Dependency | Tatsächlicher Befund | Folge für TASK-0005 |
|---|---|---|
| src/domain/npc-knowledge.projection.ts:13 | VisibleKind: person/location/item/event/evidence/proposition/conclusion | Kategorie ist Teil jedes Schlüssels, keine reinen Nummern |
| :17–20 | VisibleRef hat readonly kind/index; kein Brand | Roh-Ref kann typseitig keine Projektion nachweisen |
| :27–36 | NpcVisibleClaim: genau neun explizite Varianten | Lokales striktes Shape, beidseitiger Type-Test, expliziter Output-Neuaufbau |
| :38–48 | Context nur schemaVersion/asOf/self/awareness/attitudes | Kein weiterer Zustand/Resolver darf als Parameter hinzukommen |
| :44–46 | Attitude: subject, claim, stance | Subject steuert Policy-Regel; Claim beantwortet Frage; Stance liefert subjektive Polarität |
| :50–52 | ProjectionResult success/context oder CONTEXT_BINDING_MISMATCH | Nur erfolgreicher Context kann Engine-Eingang sein |
| :76–85 | Snapshot/Truth/Solution-Bindung wird vor Freigabe geprüft | TASK-0005 prüft keine Welt-Hashes und erhält keine Weltparameter |
| :113–139 | Feldweise Claim-Projektion | Keine vollständigen Domain-Objekte freigegeben |
| :141–150 | Stances werden feldweise neu erzeugt | M1 sichert fehlende Snapshot-Identität zusätzlich ab |
| :152–156 | projectNpcKnowledge(snapshot, truth, solution) | Einziger Runtime-Export der Projection |
| :180–187 | Sichtbare IDs je Kategorie sortiert, dann 1..N; Ref bei jedem Aufruf neu | Wertgleiche lokale Ref-Vorkommen können !== sein |
| :189–206 | Awareness/Attitudes deterministisch sortiert; Result deep-frozen | Engine muss weder sortierte Inputs erzwingen noch Context modifizieren |
| src/domain/npc-knowledge.ts:130–133 | Statement-Key ist Namespace plus sortierte Claim-Felder | Proposition-Alias-IDs ergeben keine zweite NPC-Attitude |
| :258–260 | knowledge.value muss proposition.truth entsprechen | Engine darf knowledge verwenden, objektive Wahrheit jedoch nicht nachladen |
| :268–270 | Doppelte strukturelle Statements abgelehnt | Exaktes Claim-Matching ist auf tatsächlichen Contexts eindeutig |
| :288–301 | Parser liefert nominalen, rekursiv readonly/frozen NPC-Snapshot | Snapshot bleibt oberhalb der Barriere; kein TASK-0005-Import |
| src/domain/case-solution.ts | Conclusion-Resolver privat; strukturell doppelte ConclusionClaims verboten | Keine private Evaluator-Nutzung; Conclusion-Beliefs bleiben subjektiv |

Öffentliche Projection-Typen: VisibleKind, VisibleRef, NpcVisibleClaim, NpcVisibleContext, ProjectionResult.
Öffentliches Projection-Zod-Schema: keines.
NpcVisibleContext selbst ist strukturell typisiert, nicht nominal. TASK-0005 ist kein beliebiger Context-JSON-Importer.
Die drei Proposition-Varianten und sechs Conclusion-Varianten haben heute disjunkte kind-Werte.
Deshalb kann auf echten Contexts derselbe vollständige Claim nicht unter beiden Statement-Kategorien vorkommen.
Wird diese Dependency-Eigenschaft später geändert, muss das Matching neu reviewed werden.

### Neun Varianten, genau diese Felder

| Claim-kind | Felder nach kind | Zulässige Referenzkategorien |
|---|---|---|
| personAt | person, location, at | person, location |
| eventHasParticipant | event, person | event, person |
| eventHasItem | event, item | event, item |
| personResponsibleForEvent | person, event | person, event |
| personRoleForEvent | person, event, role | person, event |
| noPersonResponsibleForEvent | event | event |
| eventCausedEvent | causeEvent, event | event, event |
| eventIntent | event, value | event |
| eventMechanism | event, value | event |

Stance: knowledge/value:boolean; belief/value:boolean; uncertain/leaning:boolean|null.
TASK-0004 verbietet knowledge für Conclusions bereits beim Parsing. Der projizierte Type bildet diese Korrelation nicht als separate Union ab.
TASK-0005 darf deshalb keine solche Type-Garantie erfinden und keine neue Conclusion-Wissensregel implementieren.

## Acceptance-Criteria-Nachweisplan

"Code geprüft" betrifft ausschließlich die vorhandene Dependency. Die folgenden TASK-0005-Tests sind geplant, nicht bestanden.

| AC | Konkreter Review-/Testnachweis nach Freigabe |
|---|---|
| 01 | git diff --name-status gegen M1: exakt fünf neue Allowlist-Dateien |
| 02 | npm ci, npm run typecheck, npm test in frischem Remote-Checkout; Exitcodes und Anzahl protokollieren |
| 03 | AST-/Exportreview: genau acht Type-Exports und createDialoguePolicyEngine; nur zod runtime, drei freigegebene Type-Imports |
| 04 | Neun handgeschriebene Vektoren V01–V09; lokale Shape-Union beidseitig NpcVisibleClaim-kompatibel |
| 05 | Jedes Objekt: Pflichtfeld entfernen/Zusatzfeld einfügen; Zahlen und Literale parametrieren; Issuepfad prüfen |
| 06 | Getter-Zähler bleibt 0; Symbol/nonenumerable/custom-prototype/cycle/sparse/Array-extra abgelehnt |
| 07 | Originale lokale Ref-Objekte aus self/awareness/Claims zulässig; lokale Kopien und fremde Originals unzulässig |
| 08 | person:1 vs event:1 vs proposition:1 vs conclusion:1; falsche Feldkategorie und Policy-Kategorie ablehnen |
| 09 | Subject nicht vorhanden, identisch doppelt, widersprüchlich doppelt; invert bei drei uncertain-Werten ablehnen |
| 10 | Vollständiges Kreuzprodukt der Stance-/Action-Tabelle unten; keine objektive Wahrheit als Test-Orakel der Kommunikation |
| 11 | V12: gleicher Claim mit anderem at; Frage zulässig, nur sincere claim_ignorance |
| 12 | Default refuse + passende answer-Regel → Assertion; nicht passender Claim → refuse; Regelpermutation invariant |
| 13 | Query A/Policy B, Query B/Policy A, beide B an Engine A; gleicher Context in zwei Engines ebenfalls ablehnen |
| 14 | Result-Claim entspricht ausschließlich gematchter Context-Attitude; unbekannter Query-Inhalt erscheint nirgends im Result |
| 15 | V13/V21 unter derselben Policy: Acts exakt gleich; nur Decision.intent verschieden; Act hat keine Stance-/Intent-Properties |
| 16 | V14/V15 sowie V16/V17 jeweils vollständig gleich; kein hasKnowledge/subject im Act |
| 17 | Originalcontainer vor/nach Parse/Evaluate identisch und weiter veränderbar; Context unverändert |
| 18 | Object-Graph-Identitäten gegen Context, Rohquery/-policy und geparste Query/-policy; alle neuen DTOs deep-frozen |
| 19 | Wiederholungen/Property-Reihenfolge/Regelreihenfolge/getrennte lokal gebundene Engines: deep- und JSON-gleich |
| 20 | Zwei gültig neu gebundene Welten mit gleichem sichtbaren Context: gleiche PolicyResults |
| 21 | Descriptor-/Prototyp-/Symbol-/Identitäts-Inspektion, exakte Key-Allowlist, Marker-Sentinels; keine bloße JSON-Suche |
| 22 | Exhaustiveness-/beidseitige Typprüfung und unbekannte kind-Eingabe; keine Default-Spread-Variante |
| 23 | Unter derselben Policy: passende/fehlende Attitude bei Default=Regel refuse/evade ununterscheidbar; feign nur unter answer; abweichende Refusal-/Evasion-Regeln ausdrücklich unterscheidbar |

AC-09 zusätzlich in Version 2: feign_ignorance unter Default refuse/evade für jede Stance ablehnen.
AC-15 vergleicht dieselbe Policy bei bekanntem/fehlendem Claim, nicht mehr unterschiedliche Policies.

### Vollständige Entscheidungsmatrix als Testplan

| Stance | Varianten | actions | Erwartung |
|---|---|---|---|
| knowledge | true, false | answer | sincere assert, identischer Boolean, unqualified |
| knowledge | true, false | invert | deceptive assert, invertierter Boolean, unqualified |
| belief | true, false | answer | sincere assert, identischer Boolean, belief |
| belief | true, false | invert | deceptive assert, invertierter Boolean, belief |
| knowledge/belief | beide Boolean-Werte | refuse, evade | withholding, nur kind |
| knowledge/belief | beide Boolean-Werte | feign_ignorance | deceptive, nur claim_ignorance |
| uncertain | true, false, null | answer | sincere express_uncertainty, leaning unverändert |
| uncertain | true, false, null | refuse, evade | withholding, nur kind |
| uncertain | true, false, null | feign_ignorance | deceptive claim_ignorance |
| uncertain | true, false, null | invert | Policy-ZodError, Pfad rules/i/action |
| fehlt | kein Statement-Handle | answer, refuse, evade Default | sincere ignorance bzw. withholding refuse/evade |

Die 23 positiven JSON-Vektoren und zwei Parsefehler-Vektoren ergänzen diese Matrix; sie ersetzen nicht das vollständige Kreuzprodukt.
Sämtliche feign_ignorance-Erfolgsfälle verlangen Default answer. Default refuse/evade + feign ist jeweils ein Policy-Parsefehler.
Knowledge false benötigt ein tatsächlich falsches Proposition-Fixture, nicht einen unsicheren Cast auf einen erfundenen Context.
Belief false zur objektiv wahren knife-used-Proposition (V03) und Belief true zur objektiv falschen nobody-responsible-Conclusion (V09) sind bewusst adversarial.

## Vektor- und Dependency-Verifikation

forge/reviews/TASK-0005-test-vectors.json enthält 23 explizite erwartete Results, zwei geplante Parsefehler und einen expliziten erwarteten Context.
Ein temporäres node-stdin-Prüfskript hat ausschließlich bestehende TASK-0004-APIs importiert:
world/npcInput/aware/propositionAttitude/conclusionAttitude aus dem bestehenden Fixture,
parseNpcKnowledge und projectNpcKnowledge.

Ergebnis: Exit 0; expectedContext stimmt vollständig mit tatsächlicher Projektion überein;
23 positive Vektoren referenzieren vorhandene Claims/Subjects; alle neun Claim-Formen sind vertreten.
Die drei uncertain-Fixture-Varianten konnten jeweils durch TASK-0004 geparst und projiziert werden.
Bei inhaltlichen Acts stimmen die handgeschriebenen Claim-/Subject-Werte mit der tatsächlichen Dependency überein.

Nach Revision 2 erneut geprüft: Exit 0; 23 positive Vektoren, zwei negative Fixture-Rezepte,
vier identische Policy-Paare für Kreuz-Default-Vergleiche. Erwartete Acts der drei nicht unterscheidbaren Paare sind bytegleich;
das bewusst unterscheidbare V22/V23-Paar ist verschieden. Das sind statische Orakel-/Recipe-Prüfungen, keine ausgeführten Policy-Entscheidungen.

Dies prüft Fixture-Kompatibilität, NICHT Dialogue-Verhalten. Kein TASK-0005-Evaluator wurde simuliert oder implementiert.
Die zukünftigen Tests müssen queryClaimAt/ruleSubjectAt in Originalobjekte auflösen.
expectedContext ist ein Vergleichsorakel und darf nie als Engine-Input verwendet werden.
Die JSON-Datei ist ein Reviewer-/Testartefakt mit Autoren-IDs im Fixture-Rezept, kein sichtbarer Runtime-Context.

## Spoiler-/Security-Self-Audit

| Angriff | Warum die gewählte Grenze ihn abdeckt | Pflichtprobe |
|---|---|---|
| Fremde Projektion hat dieselben Handle-Werte | Originalref-WeakSet prüft Herkunft VOR Schema-Klon | A/B wertgleich, jedes fremde Ref einzeln einsetzen |
| Zwei Engines auf demselben Context | Query/Policy-Owner-WeakSets sind engine-lokal | Alle Mischkombinationen; Fehler ohne Details |
| Eigene co-referente Objekte sind !== | Semantische Schlüssel benutzen kind/index | Query mit awareness-Ref statt Claim-Ref funktioniert |
| Kategorien kollidieren numerisch | Getrennte Shape-Kategorien und Paarschlüssel | proposition:1 und conclusion:1 haben verschiedene Regeln |
| Freie Frage wird als Wahrheit behandelt | Matching ausschließlich vorhandener vollständiger Claim | at/Rolle/Mechanismus ändern → ohne Match nur Default |
| Evidence/Event-Awareness wird interpretiert | Awareness liefert Referenten, keine Attitude | Nur Awareness + Teilnehmerfrage → Unwissen |
| Policy wird neuer Faktenkanal | Regel enthält nur Statement-Subject und geschlossene Aktion | Zusatzclaim/Ersatzperson/Text ablehnen |
| Unbekannte Conclusion wird automatisch wahr | Kein Solution-Import und kein Resolver | Belief bei kanonisch true/false/undetermined kommunikativ gleich |
| Getter enthält Weltzugriff | Descriptor-Vorprüfung vor normalem Lesen | Getter wirft/inkrementiert; trotzdem Aufrufzahl 0 |
| Versteckte Weltreferenz | Nur feldweiser Neubau, Source-Identitätsprüfung | Nicht-enumerierbare Properties, Symbole, Prototypen inspizieren |
| Deep-freeze tarnt Quellobjekt-Sharing | Freeze und fehlende Identität getrennt prüfen | Mutation analog M1 auf Claim-/Subject-Ref |
| Refusal-Auswahl verrät Attitude-Existenz | Nur Default=Regel garantiert denselben Act bei Fehlen; abweichende Regel ist bewusst erkennbar | V14/V15 gleich unter derselben Policy; V22/V23 dokumentieren den Unterschied |
| Intent gelangt zu Verbalization | Nur decision.act ist freigegeben | Exact-keys und kein Parent-/Closure-Link im Act |
| Neue Dependency-Claim-Art | Type-Union-Abgleich und geschlossene Schema-Allowlist | Compile-time Drift-Probe muss scheitern |

Wichtige Grenze: Die API verhindert direkte versehentliche Fremdhandle-Nutzung, keine böswillige Ausführung im selben Hostprozess.
Ein vertrauenswürdiger Aufrufer kann bewusst fremde Inhalte auf lokale Ref-Objekte übersetzen; dies ist eine neue lokal gebundene Frage.
Ein Hash des sichtbaren JSONs würde gleichwertige Projektionen ebenfalls nicht auseinanderhalten und wäre keine stärkere Herkunftsgarantie.

Keine Behauptung globaler Noninterference bei geänderter Policy: Policy-Aktionen sind explizit autorisierte Steuerinformationen.
Wenn ein späterer Adapter eine geheime Weltvariable in answer/refuse kodiert, kann diese Entscheidung Information tragen.
Genau deshalb ist solch ein Adapter nicht Bestandteil dieses Contracts.
Noninterference wird hier bei gleichen freigegebenen Context-, Query- und Policy-Inhalten geprüft.

Raw-ID-Renames sichtbarer Entitäten können TASK-0004-Handle-Sortierung ändern; solche Welten sind nicht notwendig context-gleich.
Metamorphische Proben müssen zuerst identischen sichtbaren Inhalt nachweisen, bevor sie bytegleiche PolicyResults verlangen.

Die erlaubten Claim-Tags personResponsibleForEvent und noPersonResponsibleForEvent sind kein Leak eines Resolution-Objekts.
Ein Test darf freigegebene subjektive Claims nicht anhand eines Wortfilters auf "Responsible" verbieten.
Ebenso sind subjektive value/leaning-Werte ausdrücklich erlaubt; verboten ist zusätzlicher objektiver Status.

## Adversariale Fixture-Planung außerhalb der JSON-Vektoren

1. Zwei frische Projektionen derselben Welt: deep-equal, disjunkte Ref-Identitäten; je eigene Engine.
2. Zwei andere Welten mit gleicher sichtbarer Handle-Struktur: direkte Fremdrefs ablehnen, keine Raw-ID zum Vergleich einführen.
3. Person-Ref erscheint in awareness und zwei Claims mit !== Instanzen: alle Originalvorkommen zulässig.
4. Entities nur über Claim bekannt: keine explizite Awareness erforderlich; Entity-Ref bleibt zulässig.
5. Vollständig leere attitudes, sichtbare self/person/event/evidence: Fragen erzeugen keine Interpretation.
6. Snapshot knowledge bleibt nach invert wert- und identitätsmäßig unverändert; Act ist eigenständiger Graph.
7. Drei gültige Solutions lassen Anna-Verantwortung true/false/undetermined; NPC glaubt jeweils true.
   Die requiredConclusions-Fixture muss bei jedem World-Edit weiterhin passen. Keine Umgehung des Solution-Parsers.
8. Beliebige verborgene Namen/Beschreibungen/Secrets ändern, Hashes neu binden, sichtbar identische Snapshot-Daten projizieren.
9. Ein Shared-Ref-DAG ist kein Zyklus: gleiche originale Ref zweimal in causeEvent/event als Frage verwenden.
10. Zyklen und tiefe ungültige Container dürfen keinen Getter ausführen; iterative Vorprüfung vermeidet rekursiven Stackoverflow.
11. Ergebnisse rekursiv mit Reflect.ownKeys und Object.getOwnPropertyDescriptors inspizieren.
    Erlaubt: gewöhnliche Daten-Properties plus Array.length; Prototypen separat prüfen.
12. Ungültige Anfragen liefern interne Zod-Diagnostik; diese Diagnostik ist KEIN CommunicativeAct und darf nicht weitergereicht werden.

## Typ-Testplan (nicht ausgeführt)

- Bidirektionale Assignability zwischen lokal abgeleitetem Claim-Input und NpcVisibleClaim.
- @ts-expect-error: evaluate erhält DialogueQueryInput statt gebrandeter DialogueQuery.
- @ts-expect-error: RuntimeDialoguePolicyInput statt geparster Policy.
- @ts-expect-error: Mutation an query.claim, policy.rules, decision.act sowie verschachtelten Refs.
- Positive Autorenstruktur: Root-Query und Policy-Container sind editierbar.
- Negative Typfälle für falsche Ref-Kategorie, unzulässige Rolle/Mechanismus, fehlende Pflichtfelder.
- Keine Compile-time-Behauptung, zwei Engine-Instanzen hätten verschiedene Brands:
  diese Instanzbindung ist ausdrücklich eine Runtime-Eigenschaft der WeakSets.
- Keine öffentliche Input-Definition als unknown/any durch den Wrapper. z.input des vorgesehenen Schemas separat kontrollieren.
- Exporte gegen Contract-Liste vergleichen, nicht nur prüfen, ob gewünschte Imports kompilieren.

## Scope- und Prozessprüfung

TASK-0005-Produktion: nicht vorhanden.
M1: nur tests/npc-knowledge.projection.test.ts.
Kandidat: nur forge/contracts/TASK-0005.md.
Diese ergänzenden Review-Artefakte gehören zum autorisierten Spezifikations-/Auditblock, nicht zum späteren Implementierungsdiff der fünf Dateien.
Keine Änderungen an CaseTruth, CaseSolution, NPC-Produktion, package.json, Lockfile oder Forge-Core.

### Neu beobachtete Forge-Core-Formatgrenze

Remote-Core beobachtet an bd3becb7dfbefc58089d69118f568bf32cab3b7d.
Dessen src/forge/contract-document.ts verlangt kanonische JSON-Frontmatter mit ---json und externen Hash-gebundenen Approval-Records.
TASK-0005 Version 2 behält die bisherige manuelle YAML-Frontmatter mit review_ready/pending-Feldern.
Er ist damit NICHT direkt durch den neuen Core-Parser importierbar. Schon der Header würde FRONTMATTER_MISSING liefern.

Dies ist eine dokumentierte Integrationsgrenze, keine neue Dialogue-Dependency.
Core-Code wurde weder übernommen noch unabhängig vollständig reviewed.
Kein Core-Approval wird aus diesem Contract oder aus Claudes Owner-Freigabe abgeleitet.
Vor einem späteren Core-Import braucht es eine explizite Formatmigration und die zugehörige tatsächliche Freigabe; keine stille approved-Umschreibung.

### Verlässlichkeit der Übergabe

Git-SHAs, tatsächliche Exporte, eigene M1-Mutationen und Dependency-Vektorprüfung sind direkte Nachweise.
Claudes CP6 meldet abgeschlossene Core-Arbeit mit ausstehendem unabhängigen Review; seine Testzahlen werden hier nicht als selbst verifiziert ausgegeben.
Das Contract-Gate bleibt trotz abgeschlossener Reconciliation geschlossen.

## Eingegangener unabhängiger Review und Antwort

Am nächsten Remote-Checkpoint beobachtet: 8357672a4e50a3ec439c9bb9b493d206da416015.
Quelle: forge/reviews/TASK-0005.architecture-review.md auf Claudes Branch, direkt aus Git gelesen.
Verdict REQUEST_CHANGES bezieht sich auf Version 1, Commit fc01e4a3ed50f8f39eca920e42e710c7088e9451,
Blob b56b5f69e1bde72d72e881e1bc4b6a89653ecd57. Es ist kein Approval der Version 2.

| Finding | Antwort in Contract Version 2 | Nachweisplan |
|---|---|---|
| B1 BLOCKING | feign_ignorance nur bei Default answer; sonst action-Issue | Zwei negative JSON-Vektoren, Stance-Kreuzprodukt und neuer Mutant D43 |
| J1 MAJOR | Regelbasierte Act-Auswahl kann Existenz des exakten Claims offenbaren; Aussage explizit korrigiert | AC-23; V14/V15 und V16/V17 gleiche Policy; V22/V23 bewusst verschieden |
| N1 | Eindeutiger Match als Dependency-Tatsache, kein Tie-Break | tatsächlicher statementKey plus disjunkte Claim-Arten |
| N2 | Act ist eigener frozen Teilgraph ohne Rückverweis; cloned Act intent-frei | Keys/Descriptors/Identitäten/structuredClone prüfen |
| N3 | Eigene Issue-Pfade exakt festgelegt; -0 und Shared-Ref-DAG explizit | Tests auf späteres Duplikat und rules/i/action |
| N4 | Stance-Indexed-Access und lokale Literaltypen ausdrücklich zulässig | keine neuen Imports |
| N5 | Echter projizierter Context als Vorbedingung; keine Constructor-Validierung | alle Fixtures aus projectNpcKnowledge |
| O2/O3/O6 | Solution-Nullability; externe blobgebundene Freigabe; beobachtbare Immutability-Anforderung | Dependency-/Gate-/Freeze-Checks |

Die Reviewer-Demonstration verwendet an einer Stelle knowledge für einen personRoleForEvent-Claim; das ist durch TASK-0004 nicht darstellbar.
Der zugrunde liegende J1-Befund bleibt real: Schon eine personAt-Knowledge-Attitude oder ein Role-Belief ergibt denselben Existenzkanal.
Ein refusal alleine beweist dabei weder Knowledge-Stance noch positive Polarität. Version 2 hält diese Grenze ausdrücklich fest.

Lerneffekt: Der ursprüngliche Self-Review hatte exakte Act-Shapes geprüft, aber nicht die Wahl des Acts unter derselben Policy.
Die Änderung wurde nicht als unabhängige Freigabe umetikettiert. Die Review-Anfrage bleibt für den neuen Blob offen.
