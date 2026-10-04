# MYST-0003 EVIDENCE ACCESS PACKAGE

**MYST-0003 — Evidence Access & Investigation V1 · Final Preflight + Contract Preparation**
Stand: 2026-10-03 · Read-only · Repository `Forge-Dice/Forge`, `main` = `3d7545d843883418348004e68717399a64da7a7d` (selbst per `git fetch` verifiziert)
Begleitdatei: `MYST-0003-EVIDENCE-ACCESS-V1.contract.DRAFT.md` (Draft-Contract, Format 1)

Verifikation auf `main`: `npm run typecheck` 0 Fehler, `npm test` 1087/1087 grün. Kein Repository-Inhalt wurde verändert; keine Commits, Branches oder PRs. Golden Vectors wurden mit zwei unabhängigen Werkzeugen (Node `node:crypto`, Python `hashlib`) berechnet. Zusätzlich wurde in einem Wegwerf-Klon außerhalb des Repos ein Machbarkeits-Prototyp geschrieben (158 + 31 Zeilen, typecheck sauber, Kernfälle der Matrix bestätigt). Er ist **nicht** Teil der Lieferung und dient nur dazu, dass Contract-Erwartungen (Issue-Pfade, Fehlerreihenfolge, Hash) gegen echtes Zod 4.6.5 stimmen.

Kurzfassung: **GO** für Review und Registrierung des Draft-Contracts. MYST-0003 ist **unabhängig von MYST-0001** implementierbar (Variante B), weil es vollständig im Domain-ID-Raum arbeitet und keinerlei Inhalt an Spieler gibt. **NO-GO** für jede direkte Spielerausgabe von `found`, bis MYST-0001 und eine eigene Content-Release-Schicht existieren.

---

## 1. Current Evidence Semantics

Exakt, was Evidence auf `main` bedeutet (`src/domain/case-truth.ts`):

| Aspekt | Tatsächlicher Code | Bedeutung |
|---|---|---|
| Schema | `EvidenceSchema` = strict `{ id, description, source, links }` | Keine weiteren Felder, kein Fundort, kein Zugriffsstatus, kein Spielertext |
| `id` | `evidence:<slug>`, Slug `[a-z0-9][a-z0-9_-]{0,63}`, ASCII | Global eindeutig über **alle** Collections (gemeinsame `known`-Menge in `checkReferenceIntegrity`); Slug ist autorenlesbar und kann Spoiler tragen |
| `description` | `TextSchema` (mind. ein Nicht-Whitespace) | Objektiver **Autorentext**. Beispiel Fixture: „Annas Fingerabdruck auf dem Brieföffner (vom Vortag)“ verrät bereits die Auflösung des Red Herrings → nicht spielersicher |
| `source` | `person \| location \| item \| event` mit ID | **Herkunft** der Evidence (wer/was sie erzeugt hat), nicht Fundort. Fixture: `gloves-dirty` hat Source `event:walk` |
| `links` | ≥ 1, je `{ propositionId, direction: supports \| refutes }`, je Proposition höchstens einmal | Objektive Autorenaussage, welche Propositionen die Evidence stützt/widerlegt. Kein Gewicht, keine Stärke |
| Richtung vs. Wahrheit | nicht geprüft | Evidence darf eine falsche Proposition stützen (Fixture: `fingerprint` stützt `anna-at-murder`, `truth: false`) und eine wahre widerlegen. Das ist die Basis für Red Herrings |
| Referenzen | `source.id` und alle `propositionId` müssen existieren | Nur Existenz, Art über Präfix |
| Red Herrings | `redHerrings[].evidenceIds` + `misleadingPropositionId` | Autorenannotation; spoilert, welche Evidence in die Irre führt |
| Truth Hash | `hashCaseTruth`, Profil `forge-case-c14n-v1`, **jedes Array wird sortiert** | Evidence ist Teil der Truth-Identität; Reihenfolge von `evidence`/`links` ist bedeutungslos |
| Semantik-Validator | `validateCaseSemantics` | Prüft Evidence **gar nicht** („evidence direction … deliberately not checked“) |
| NPC Awareness | `AwarenessSubject` `evidence`; Provenance `observed_evidence` | NPC kann Evidence „kennen“; Validierung nur Existenz. Projektion gibt nur lokale Handles aus, nie Inhalt. Kein Bezug zu Auffindbarkeit |
| Solution | `case-solution.ts` referenziert Evidence nicht | Evidence ist nicht Teil der kanonischen Auflösung |
| Fixtures | `fullCase()`: 4 Evidence (Sources: item, person, location, event); `goldenCase()`: 0 Evidence | Jede Source-Art ist abgedeckt |

Folgerung: Evidence ist heute ein **objektives, vollständig spoilerndes Autorenobjekt**. Nichts davon ist spielersichtbar, und nichts davon sagt, wo oder wie man es findet. Genau diese Lücke schließt MYST-0003, ohne das Evidence-Objekt anzufassen.

## 2. PlayerRef Dependency Decision

**Entscheidung: B — unabhängig, mit sauberer Domain-Grenze.** MYST-0003 hat keine Abhängigkeit zu MYST-0001 und versteckt keine PlayerRef-Logik.

Begründung:

1. **Getrennte Fragen.** PlayerRef beantwortet „welche Entität meint diese Spielereingabe?“ (Auflösung). MYST-0003 beantwortet „darf und liefert diese Aktion auf eine bekannte Entität etwas?“ (Autorisierung + Discovery). Der PlayerRef-Entwurf sagt selbst: Auflösung ist keine Autorisierung. Beides gehört in getrennte Module.
2. **Kompatible Form ohne Import.** `KnownEntityRef` (`{ kind, id }` mit `kind ∈ person/location/item/event/evidence`) ist strukturell identisch mit `ResolvedEntity` aus dem MYST-0001-Entwurf. VS-5 kann die Ausgabe von `resolvePlayerRef` direkt als `known`-Element bzw. als Aktionsziel verwenden, ohne dass eines der Module das andere importiert.
3. **Keine Spielerausgabe.** MYST-0003 gibt nur interne Evidence-IDs zurück (§6). Erst die Session-Schicht übersetzt sie mit `playerRefFor` in PlayerRefs. Die Spoiler-Grenze liegt damit dort, wo PlayerRef ohnehin hingehört.
4. **Kein Zeitverlust.** MYST-0001 und MYST-0003 können parallel implementiert und reviewt werden; VS-5 (Session) hängt dann von beiden ab.

Bedingungen der Entscheidung (gehen in den VS-5-Contract):

- `found` darf nie ungefiltert einen Spieler erreichen; VS-5 muss jede Evidence-ID über MYST-0001 übersetzen.
- VS-5 muss sicherstellen, dass `known`, Map und Truth zum selben Paket gehören (MYST-0003 erkennt fallfremde `known`-Refs bewusst nicht, A-39/A-76).
- Ändert MYST-0001 die Form von `ResolvedEntity`, ist ein Adapter in VS-5 nötig, keine Änderung an MYST-0003.

Formaler Hinweis: Der MYST-0001-Draft ist in **Format 2** geschrieben, das `main` nicht parsen kann. Der MYST-0003-Draft ist bewusst Format 1 (§11). Siehe Hotspot H-1.

## 3. Access Map

Eigenes autorenseitiges Dokument `EvidenceAccessMap`, getrennt von `CaseTruth` (CaseTruth bleibt unverändert, Truth-Hash bleibt stabil):

```ts
{
  schemaVersion: 1,
  caseId: CaseId,
  truthHash: string,                 // = hashCaseTruth(truth)
  entries: [
    { evidenceId, access: { kind: "inaccessible" } },
    { evidenceId, access: { kind: "discoverable", paths: InvestigationAction[] /* ≥ 1, Menge */ } },
  ],
}
```

Entscheidungen:

| # | Frage | Entscheidung | Begründung |
|---|---|---|---|
| D-1 | Ein Eintrag oder mehrere je Evidence? | **Genau ein Eintrag je Evidence** (Vollständigkeit + Eindeutigkeit, R3/R4), aber **mehrere Pfade** innerhalb eines Eintrags | Der Eintrag ist die Einheit für „eindeutig behandelt“; Pfade sind ODER-verknüpft. Ein-Pfad-Zwang würde Autoren zu Duplikat-Evidence zwingen (Brieföffner: am Gegenstand **oder** beim Durchsuchen der Bibliothek). Kosten: ≈ 10 Zeilen, Monotonie bleibt erhalten. Abweichung vom früheren VS-2-Design (D-1/OD-6: ein Pfad) |
| D-2 | Wie wird „inaccessible“ ausgedrückt? | Expliziter Status `{ kind: "inaccessible" }` ohne Pfade | Keine stillen Lücken: fehlender Eintrag ist ein Autorenfehler (R4), nicht „unauffindbar“. Testimony-Evidence (`anna-statement`) bleibt so für VS-4 verfügbar, ohne über Investigation zu leaken |
| D-3 | Bedeutung von `inaccessible` | „durch **keine** Investigation-Aktion entdeckbar“ | Ob VS-4 (Befragung) sie freigibt, regelt VS-4. MYST-0003 trifft darüber keine Aussage |
| D-4 | Pfad-Form | identisch mit der Aktion (`{ kind: "search_location", locationId }` …) | Matching = Gleichheit des Zielschlüssels; keine zweite Darstellung, keine Übersetzung |
| D-5 | Muss Pfadziel zu `Evidence.source` passen? | **Nein**, keine Prüfung | Source ist Herkunft, nicht Fundort (`gloves-dirty`: Source `event:walk`, Fund an `item:gloves`). Jeder Abgleich wäre Inferenz |
| D-6 | `revision`, `label`, Freitext in der Map? | **Nein** | Identität ist der Hash; Präsentationstext gehört nicht in die Zugriffsschicht (§6) |
| D-7 | Map in CaseTruth einbetten? | **Nein** | Würde TASK-0001 ändern und den Truth-Hash aller bestehenden Bindungen (NPC-Snapshots, Solution) brechen |

Parser-Regeln R1–R6 (Bindung zuerst, dann Evidence-Referenz, Eindeutigkeit, Vollständigkeit, Ziel-Referenz, Pfad-Eindeutigkeit) stehen vollständig im Contract §4.

## 4. Investigation Vocabulary

Herleitung aus dem Domain-Modell statt Übernahme der Beispielliste:

- Kandidaten sind die vier `SourceRef`-Arten, weil nur sie als Entitäten mit Evidence in Beziehung stehen: `person`, `location`, `item`, `event`.
- **`location` → `search_location`**: physischer Ort, den man durchsucht.
- **`item` → `examine_item`**: physischer Gegenstand, den man untersucht.
- **`person` → `examine_person`**: physische Spuren an einer Person (Kratzer, Erde an Schuhen). Ausdrücklich **keine** Befragung; Aussagen sind VS-4. Behalten, weil Spuren an Personen sonst als künstliche Items modelliert werden müssten (Kosten: eine Union-Variante).
- **`event` → keine Aktion.** Events sind vergangene Vorgänge mit Zeitspanne; V1 hat kein Zeitmodell und keine Anwesenheit. „Ein Event untersuchen“ wäre entweder eine Ortssuche (Event hat `locationId`) oder Inferenz. Evidence mit Event-Source wird über Ort/Item/Person erreicht oder ist inaccessible.

Ergebnis (geschlossen, Contract §3.1):

```ts
| { kind: "search_location"; locationId: LocationId }
| { kind: "examine_item";    itemId: ItemId }
| { kind: "examine_person";  personId: PersonId }
```

Eigenschaften: strikt typisiert (Zod `strictObject`, Discriminator `kind`), Art des Ziels steckt im Feldnamen **und** im ID-Präfix (eine `location:`-ID in `itemId` scheitert am Schema), keine Parameter, kein Freitext, bijektive Abbildung Aktion ↔ Ziel.

## 5. Pure Resolution API

```ts
resolveInvestigation(map: EvidenceAccessMap, known: unknown, action: unknown): InvestigationResult

type InvestigationResult =
  | { readonly success: true; readonly found: readonly EvidenceId[] }
  | { readonly success: false; readonly code: "INVALID_ACTION" | "INVALID_KNOWN_REFS" | "TARGET_NOT_KNOWN" };
```

Ablauf: Aktion parsen → `known` parsen → Ziel ∈ `known`? → alle discoverable Einträge mit passendem Pfad sammeln → sortiert, eingefroren zurückgeben.

Bewusste Festlegungen:

| Punkt | Festlegung | Warum |
|---|---|---|
| Rückgabe „neu“ oder „erreichbar“? | **Erreichbar** (`found`), nicht „neu“ | Die Funktion kennt keinen Entdeckungszustand. „Neu“ = `found \ discovered` berechnet VS-5; so bleibt die Funktion zustandslos und idempotent |
| `truth` als Parameter? | **Nein** | Die Funktion kann strukturell keine Truth-Inhalte leaken; die Bindung ist durch den gebundenen Parser und den Brand garantiert (wie früheres OD-4) |
| Wiederholte Aktion | gültig, gleiches `found`, kein Fehler | Gewählte V1-Semantik |
| Ziel ohne Evidence | `found: []`, Erfolg | Kein Orakel über „hier ist nichts“ vs. „unbekannt“ hinaus |
| Unbekanntes vs. fallfremdes Ziel | beide `TARGET_NOT_KNOWN`, identische Konstante | Kein Existenz-Orakel |
| Fallfremder Ref **in** `known` | `found: []` (Aufruferfehler, kein Code) | Die Sicherheitseigenschaft „nie Evidence ohne autorisierten Pfad“ gilt trotzdem; Paketbindung ist VS-5 |
| Fehlerreihenfolge | `INVALID_ACTION` vor `INVALID_KNOWN_REFS` vor `TARGET_NOT_KNOWN` | Determinismus |
| Was wird nicht getan | keine Session, kein PlayerKnowledge-Update, keine Wahrheitsbewertung, keine Freigabe von Propositionen, keine Conclusions, keine Freischaltung neuer Ziele | Auftrag |

Monotonie/Idempotenz: `discovered' = discovered ∪ found`. Da `found` nur von (Map, Aktion) abhängt und `known` durch Discovery nie wächst, ist die Vereinigung über eine Aktionsfolge nur eine Funktion der **Menge** der ausgeführten Aktionen (A-72). Die Session-Historie bleibt davon unberührt nicht-kommutativ (Reihenfolge der Events, `seq`).

## 6. Player-Safe Evidence Boundary

Grenze: **entdeckt ≠ freigegeben.**

| Ebene | Inhalt | Eigentümer |
|---|---|---|
| Discovered | Menge interner `EvidenceId` | MYST-0003 (`found`), Zustand in VS-5 |
| Referenzierbar | PlayerRef je entdeckter Evidence | MYST-0001 + VS-5 |
| Released | spielersicherer Text/Aussagen zu einer Evidence | **nicht MYST-0003** |

Entscheidung: MYST-0003 benötigt **keinen** Player-Safe View und definiert keinen.

- `Evidence.description` ist nachweislich nicht spielersicher (Fixture spoilert „vom Vortag“). Sie automatisch freizugeben wäre ein stiller Leak.
- `links` verraten, welche Propositionen eine Evidence betrifft, und damit, worauf es ankommt; `source` verrät Herkunft. Beides bleibt intern.
- Ein `label` in der Map (früheres OD-8) würde Präsentation an den `accessHash` koppeln (jede Textkorrektur ändert den Zugriffs-Hash) und Text ohne PlayerRef-Grenze ausgeben.
- Empfehlung: ein eigenes autorenseitiges Dokument `EvidencePresentation` (pro Evidence ein Spielertext, optional freigegebene Claim-Formen über die vorhandene Allowlist-Idee von TASK-0004) als Teil der PlayerKnowledge-Projektion in VS-4/VS-5, mit eigenem Hash. Es braucht PlayerRefs (MYST-0001) für Querverweise und gehört deshalb nicht hierher.

Leak-Sperren in MYST-0003 (Contract §6, Tests A-54…A-60, A-77): Ergebnisse enthalten nur `success`/`found` bzw. `success`/`code`; Fehler ohne Echo; Quelltext enthält weder `description` noch `links`; keine Imports aus Solution/NPC-Modulen; `resolveInvestigation` erhält keine Truth.

## 7. Identity/Hashing

- `accessHash = hashEvidenceAccessMap(map)` = SHA-256 über `"forge-evidence-access-c14n-v1\n" + kanonisches JSON` der geparsten Map.
- **Bindung an exakte Truth:** `caseId` und `truthHash` sind Teil der Map und damit des Hashs; der Parser erzwingt `truthHash === hashCaseTruth(truth)`. Gleiche `revision` bei anderer Truth wird abgelehnt (A-04).
- **Prüfung der Array-Semantik von `forge-case-c14n-v1`:** Das Profil sortiert jedes Array. Für die Map ist das korrekt, weil sie nur zwei Arrays hat (`entries`, `paths`), beide fachlich Mengen sind und der Parser Duplikate ausschließt; zwei verschiedene gültige Maps können daher nicht denselben String ergeben. Würde später ein ordnungsrelevantes Array (z. B. Ketten, Stufen) hinzukommen, braucht es ein neues Profil. Deshalb ein **eigenes** Profil mit wörtlich gleichen Regeln (Domänentrennung, A-70) und lokal duplizierter `canonicalize` wie bei `case-solution.identity.ts`.
- Unicode/Escaping: Die Map enthält nur ASCII-IDs, Literale und Hex. Nicht-ASCII, Homoglyphen, Steuerzeichen und Whitespace scheitern bereits am ID-Schema (A-61); die Kanonisierung bleibt trotzdem `JSON.stringify`-basiert ohne Normalisierung.
- Keine Zahlen außer `schemaVersion: 1` (Literal), daher kein Safe-Integer-Risiko (A-22).

Golden Vectors (zweifach berechnet, vollständige Strings im Contract §7.3):

| Vektor | Bedeutung | SHA-256 |
|---|---|---|
| `H0` | Fixture | `fb7cd127d9dcc0981c1167e49acfb946230b7695903d1104ead6fb0ca5cee967` |
| `HE` | leere Map für `goldenCase()` | `95b862a0008e37447750580f8c3dacc64ca3fff5e915bbd6320d42e02111a8af` |
| `H1` | ein Pfad geändert | `e7543458ac142e2da7c6486b39a9aa195f56e00c30f9535b462ea60c5ce52914` |
| `H2` | accessible → inaccessible | `757c0657b2bd5a9bdd4b64696e9500e64871375e57165ee7adef8a083780b2ea` |
| `H3` | inaccessible → discoverable | `7219592d209ef60e7edb6960d068f07037504f9f9c1d641bb69c7f30c6461004` |
| `H5` | ein Pfad entfernt | `87006a8f938bbf4c3124caa17cb662499195653881620b6973a98c49574dbe6f` |
| `H6` | andere `truthHash` | `80d382cd426d83385d1e4bb058de0e0c773b98f046a54a52e7b4ca24cf14c065` |
| — | Reorder von Einträgen/Pfaden | = `H0` |

## 8. 50+ Adversarial Cases

77 Fälle; identisch mit Contract §11 (dort verbindlich).

Legende Ergebnis: `OK` = Parse erfolgreich bzw. `{ success: true, found }`; `ISSUE@pfad` = `ZodError` mit Issue an diesem Pfad; `IA` = `INVALID_ACTION`, `IK` = `INVALID_KNOWN_REFS`, `TNK` = `TARGET_NOT_KNOWN`. `M` = Fixture-Map (§3.4), `T` = `parseCaseTruth(fullCase())`, `K` = alle Personen, Orte und Items von `T` als bekannte Refs. Datei: `P` = `tests/evidence-access.test.ts`, `I` = `tests/evidence-access.identity.test.ts`, `S` = `tests/evidence-access.security.test.ts`, `C` = `tests/evidence-access.typecheck.ts`.

| ID | Datei | Fall | Eingabe / Mutation | Erwartung |
|---|---|---|---|---|
| A-01 | P | Gültige Map | `M` gegen `T` | OK; Ergebnis tief eingefroren; `entries.length === 4` |
| A-02 | P | Falscher Fall | `caseId: "case:other"` | genau 1 Issue `ISSUE@caseId`; keine Folge-Issues (Bindung zuerst) |
| A-03 | P | Geänderte Truth | `M` gegen Truth mit geänderter Event-Beschreibung | `ISSUE@truthHash` |
| A-04 | P | Gleiche Revision, andere Truth | Truth mit `revision: 3`, nur `proposition:anna-in-garden.truth` invertiert | `ISSUE@truthHash`; `revision` spielt für die Bindung keine Rolle |
| A-05 | P | Hash-Form | `truthHash` in Großbuchstaben / 63 Zeichen | `ISSUE@truthHash` (Schema) |
| A-06 | P | Fremde Evidence | zusätzlicher Eintrag `evidence:other` | `ISSUE@entries,4,evidenceId` |
| A-07 | P | Fehlender Eintrag | Eintrag `evidence:gloves-dirty` entfernt | `ISSUE@entries` mit Nennung der fehlenden ID |
| A-08 | P | Doppelter Eintrag, gleicher Inhalt | Eintrag 0 dupliziert | `ISSUE@entries,4,evidenceId` |
| A-09 | P | Doppelter Eintrag, widersprüchlich | `evidence:muddy-path` zusätzlich als `inaccessible` | `ISSUE@entries,4,evidenceId` |
| A-10 | P | Fremdes Ziel | Pfad `search_location` `location:cellar` | `ISSUE@entries,i,access,paths,j,locationId` |
| A-11 | P | Falsche Zielart | `{ kind: "search_location", locationId: "item:gloves" }` | Schema-Issue an `locationId` |
| A-12 | P | Falsches Feld | `{ kind: "search_location", itemId: "item:gloves" }` | Schema-Issue (strict, fehlendes `locationId`) |
| A-13 | P | Doppelter Pfad | derselbe Pfad zweimal, Schlüsselreihenfolge vertauscht | `ISSUE@entries,i,access,paths,1` |
| A-14 | P | Leere Pfadliste | `{ kind: "discoverable", paths: [] }` | Schema-Issue an `paths` |
| A-15 | P | Inaccessible mit Pfaden | `{ kind: "inaccessible", paths: [...] }` | Schema-Issue (strict) |
| A-16 | P | Unbekannter Zugriffsstatus | `{ kind: "hidden" }` | Schema-Issue an `access,kind` |
| A-17 | P | Event als Ziel | `{ kind: "inspect_event", eventId: "event:walk" }` | Schema-Issue an `kind` (kein V1-Ziel) |
| A-18 | P | Unbekanntes Feld Wurzel | `revision: 1` | Schema-Issue (strict) |
| A-19 | P | Unbekanntes Feld Eintrag | `label: "Fingerabdruck"` | Schema-Issue (strict) |
| A-20 | S | `__proto__` Wurzel | `JSON.parse` mit `"__proto__": { "polluted": true }` | Schema-Issue; `({}).polluted === undefined` |
| A-21 | S | `constructor` / `prototype` | als Schlüssel in einem Pfad und einem Eintrag | je Schema-Issue |
| A-22 | P | schemaVersion | `2`, `"1"`, `0`, `-0`, `NaN`, `Infinity`, `2**53` | je Schema-Issue; `1.0` ist identisch zu `1` und OK |
| A-23 | P | Null Evidence | `goldenCase()` mit `entries: []` | OK |
| A-24 | S | Eingabemutation Parse | Eingabe vorher/nachher `structuredClone`-Vergleich; nach dem Parse Eingabe ändern | Eingabe unverändert; Ergebnis bleibt unverändert (keine geteilten Objekte) |
| A-25 | S | Deep Freeze | rekursiv über das Parse-Ergebnis | jedes Objekt/Array `Object.isFrozen`; Zuweisung wirft `TypeError` |
| A-26 | P | Source ≠ Fundort | `evidence:gloves-dirty` (Source `event:walk`) über `examine_item item:gloves` | OK, kein Issue |
| A-27 | P | Stützt falsche Proposition | `evidence:fingerprint` stützt `proposition:anna-at-murder` (`truth: false`), discoverable | OK |
| A-28 | P | Widerlegt wahre Proposition | Truth-Variante: `evidence:muddy-path` `refutes` `proposition:anna-in-garden` (`truth: true`), Map neu gebunden | OK; `found` identisch zu A-30 |
| A-29 | P | Map ohne Discovery-Pfad gültig | alle Einträge `inaccessible` | OK; jede Aktion liefert `found: []` |
| A-30 | P | Mehrere Evidence an einem Ziel | `search_location location:garden`, `K` | OK `["evidence:gloves-dirty","evidence:muddy-path"]` (sortiert) |
| A-31 | P | Zwei Pfade zu einer Evidence | `examine_item item:letter-opener` und `search_location location:library` | beide OK `["evidence:fingerprint"]` |
| A-32 | P | Wiederholte Suche | A-30 zweimal | beide OK, tief gleich; kein Fehler |
| A-33 | P | Null Evidence am Ziel | `examine_person person:ben` | OK `[]` |
| A-34 | P | Inaccessible nie entdeckbar | jede Aktion über jedes Ziel von `K` | `evidence:anna-statement` in keinem `found` |
| A-35 | P | Source-Person nicht Fundort | `examine_person person:anna` | OK `[]` (Statement ist inaccessible) |
| A-36 | P | Ziel dem Spieler unbekannt | A-30 mit `known: []` | TNK |
| A-37 | P | Teilwissen | `known` nur `location:library`; Aktion `search_location location:garden` | TNK |
| A-38 | S | Fremdes Ziel | `search_location location:cellar`, `K` | TNK; `Object.is` mit Ergebnis aus A-36 (kein Existenz-Orakel) |
| A-39 | P | Fremdes Ziel in `known` (Aufruferfehler) | `known = [...K, { kind: "location", id: "location:cellar" }]`, Aktion darauf | OK `[]` (festgehaltenes Verhalten, §5.4) |
| A-40 | P | Falsche Zielart in Aktion | `{ kind: "examine_item", itemId: "location:garden" }` | IA |
| A-41 | P | Unbekannte Aktion | `kind: "search"`, `"inspect_event"`, `"interrogate"` | je IA |
| A-42 | S | Unbekanntes Aktionsfeld | `{ ..., depth: 2 }` | IA |
| A-43 | S | `__proto__` in Aktion | `JSON.parse('{"kind":"search_location","locationId":"location:garden","__proto__":{"x":1}}')` | IA; keine Prototyp-Verschmutzung |
| A-44 | S | Aktion kein Objekt | `null`, `undefined`, `"location:garden"`, `[]`, `42`, `true` | je IA |
| A-45 | S | Ungültige known-Refs | kein Array; `null`-Element; Zusatzfeld; `kind: "proposition"`; `kind: "conclusion"`; `{ kind: "item", id: "location:garden" }` | je IK |
| A-46 | P | Fehlerreihenfolge | Aktion und `known` ungültig | IA |
| A-47 | P | known-Reorder und Duplikate | `K` umgekehrt und jedes Element doppelt | Ergebnis tief gleich zu A-30 |
| A-48 | P | Property-Reorder | Aktion und known-Refs mit vertauschter Schlüsselreihenfolge | Ergebnis tief gleich |
| A-49 | P | Map-Reorder | Einträge und Pfade umgekehrt | Ergebnis jeder Aktion tief gleich; Hash = `H0` |
| A-50 | S | Eingabemutation Resolve | `known`, `action` vorher/nachher verglichen; tief eingefrorene Eingaben | unverändert; eingefrorene Eingaben werden akzeptiert |
| A-51 | S | Ergebnis eingefroren | Erfolg und Fehler | `Object.isFrozen` rekursiv; `found` ist nicht dasselbe Array wie in der Map |
| A-52 | S | Getter in Aktion | `locationId`-Getter, der beim zweiten Lesen wirft | kein Wurf; Ergebnis entspricht dem ersten gelesenen Wert |
| A-53 | S | Geerbte Felder | `Object.create({ kind: "search_location", locationId: "location:garden" })` | Ergebnis tief gleich zur Plain-Object-Aktion (festgehaltenes Zod-Verhalten) |
| A-54 | S | Fehler ohne Echo | alle Fehlerergebnisse | `JSON.stringify(result)` ist exakt `{"success":false,"code":"<CODE>"}` |
| A-55 | S | Erfolg ohne Inhalte | jedes Erfolgsergebnis | Schlüssel exakt `["success","found"]`; JSON enthält keine `description`, keinen Namen, kein `proposition:`, kein `location:`/`item:`/`person:`/`event:`, kein `true`/`false` außer `success` |
| A-56 | S | Keine Wahrheitsenthüllung | zwei Truths, nur Propositions-`truth` invertiert, je eigene gebundene Map gleichen Inhalts | `found` für alle Aktionen identisch |
| A-57 | C | Keine Lösungsenthüllung | `resolveInvestigation` hat genau 3 Parameter; `CaseSolution` als Argument ist Typfehler | Typecheck |
| A-58 | C | Kein NPC-Wissen | `NpcKnowledgeSnapshot` als Argument ist Typfehler; Modul importiert `npc-knowledge*` nicht | Typecheck + Quelltext-Test in S |
| A-59 | S | ID-Leak in Fehlern | Fehler aus A-36, A-38, A-40 | jeweils eingefrorene Konstante, `Object.is`-gleich pro Code |
| A-60 | S | Sprechende ID | Truth-Variante mit `evidence:ben-is-the-murderer` | erscheint nur in `found` (intern, §6); nie in Fehlern; Typ ist `EvidenceId` |
| A-61 | S | Unicode / Escaping | `location:gärten`, kyrillisches `а` in `location:gаrden`, Vollbreite, `"location:garden\n"`, `"location:garden\u0000"`, `" location:garden"` | Aktion: IA; in der Map: Schema-Issue |
| A-62 | I | Golden Vector Fixture | `serializeEvidenceAccessMap(parse(M))` und Hash | exakt `CANON_M` und `H0` (§7.3) |
| A-63 | I | Golden Vector leer | `goldenCase()`-Map mit `entries: []` | exakt `CANON_E` und `HE` |
| A-64 | I | Pfadänderung | `muddy-path`: Garten → Bibliothek | `H1` ≠ `H0` |
| A-65 | I | accessible → inaccessible | `muddy-path` inaccessible | `H2` |
| A-66 | I | inaccessible → discoverable | `anna-statement` über `examine_person person:anna` | `H3` |
| A-67 | I | Pfad entfernt | zweiter Pfad von `fingerprint` entfernt | `H5` |
| A-68 | I | Andere Truth-Bindung | `truthHash` = 64×`0` (nur Serializer-Ebene, ohne Parse) | `H6` |
| A-69 | I | Reorder-Invarianz | Einträge, Pfade, Objektschlüssel permutiert | `H0` |
| A-70 | I | Domänentrennung | Hash ≠ SHA-256(`"forge-case-c14n-v1\n"` + `CANON_M`) und ≠ `hashCaseTruth(T)` | ungleich |
| A-71 | I | Hash-Form | jeder Hash | `/^[0-9a-f]{64}$/` |
| A-72 | P | Monotonie / Idempotenz | alle Folgen der Länge ≤ 3 über 7 Aktionen (inkl. Wiederholungen) | Vereinigung der `found` hängt nur von der Aktionsmenge ab, nicht von Reihenfolge oder Wiederholung |
| A-73 | P | Keine Freischaltung | nach A-30 `known` unverändert; `examine_person person:anna` bleibt bei `known` ohne Anna TNK | Discovery erweitert `known` nie |
| A-74 | C | Brand | Plain-Objekt als `EvidenceAccessMap` | Typfehler |
| A-75 | C | Rückgabetyp | `found` ist `readonly EvidenceId[]`; Zuweisung an `found[0]` | Typfehler |
| A-76 | S | Map anderer Fall (Aufruferfehler) | Map für `case:golden`, Aktion/known aus `T` | OK `[]` (festgehaltenes Verhalten, Bindung ist Aufgabe von VS-5, §9) |
| A-77 | S | Quelltextgrenzen | Quelltext von `src/domain/evidence-access*.ts` | kein `Math.random`, `Date`, `localeCompare`, `WeakMap`, `npc-knowledge`, `case-solution`, `description`, `links` |

Abdeckung der geforderten Kategorien: foreign evidence A-06 · foreign target A-10/A-38 · wrong target kind A-11/A-40 · unknown player target A-36/A-37 · inaccessible A-34/A-35/A-29 · repeated search A-32 · multiple evidence at one target A-30 · zero evidence A-23/A-33 · duplicate access entry A-08/A-09 · missing entry A-07 · two paths A-31 · source ≠ target A-26 · supports false A-27 · refutes true A-28 · no truth reveal A-56 · no solution reveal A-57 · no NPC knowledge A-58 · canonical ID leakage A-54/A-59 · speaking ID A-60 · input reorder A-47 · property reorder A-48 · access-map reorder A-49/A-69 · input mutation A-24/A-50 · deep freeze A-25/A-51 · changed truth A-03 · same revision/different hash A-04 · wrong case A-02 · unsafe integer A-22 · unknown fields A-18/A-19/A-42 · `__proto__` A-20/A-43 · constructor/prototype A-21 · golden vector A-62/A-63 · Unicode/escaping A-61 · collision/duplicate IDs A-08/A-13/A-47 (Truth selbst verbietet Cross-Collection-Duplikate).

Zwei Fälle halten bewusst Zod-Verhalten fest, das im Prototyp beobachtet wurde: `strictObject` akzeptiert **geerbte** Eigenschaften (`Object.create({...})`, A-53) und liest Getter genau einmal (A-52). Das ist deterministisch und unkritisch, solange nach dem Parse nur das Parse-Ergebnis verwendet wird (Contract §5.2).

## 9. Session Integration Boundary

MYST-0003 definiert **nicht**: `SessionEvent`, `seq`, Save/Load, `firstDiscoverySeq`, Session-Phase, Discovery-Zustand, PlayerKnowledge.

Vorgesehene Nutzung durch VS-5 (Vorschlag, nicht Vertragsinhalt):

1. Paket bindet `truthHash` und `accessHash`; Save-Header trägt beide.
2. Spieler sendet `{ verb, targetRef: PlayerRef }` → VS-5 löst über MYST-0001 auf → bildet `InvestigationAction` (Domain).
3. `resolveInvestigation(map, knownDomainRefs, action)`.
4. Bei Erfolg: Event `{ seq, action }` loggen; `newly = found \ discovered`; `discovered ∪= found`; `firstDiscoverySeq` je neuer Evidence = aktuelles `seq` (abgeleitet, nicht gespeichert).
5. Spielerausgabe nur als PlayerRefs (`playerRefFor`) plus Inhalte aus der Content-Release-Schicht.
6. Replay = dieselben Aufrufe in Log-Reihenfolge; da `found` rein ist, ist der abgeleitete Zustand reproduzierbar.

Ob VS-5 erfolglose Aktionen (`TARGET_NOT_KNOWN`) loggt, entscheidet VS-5. Die Startmenge `known` (welche Orte/Personen/Items der Spieler zu Beginn kennt) muss VS-5 autorenseitig festlegen; MYST-0003 schaltet nie Ziele frei.

## 10. Scope and Estimates

| Datei | Geschätzt | Limit |
|---|---|---|
| `src/domain/evidence-access.ts` | 155–175 (Prototyp: 158) | 210 |
| `src/domain/evidence-access.identity.ts` | 30–35 (Prototyp: 31) | 50 |
| **Produktion gesamt** | **≈ 190** | **260** (< 400) |
| Tests (4 Dateien + Fixture) | 650–900 | kein Limit |

Neue Dateien: 7. Geänderte Dateien: 0. Neue Dependencies: 0. Nur `zod`, `node:crypto`, `case-truth.ts`, `case-truth.identity.ts`.

## 11. DRAFT IMPLEMENTATION CONTRACT

Datei: `MYST-0003-EVIDENCE-ACCESS-V1.contract.DRAFT.md` (Ziel bei Registrierung `forge/contracts/MYST-0003.md`).

- Format 1 (`---json`, kanonisches `JSON.stringify(raw, null, 2)`), weil `parseContractDocument` auf `main` nur `forgeContractFormat: 1` mit genau den Feldern `taskId, contractVersion, baseCommit, dependencies, scope, requiredChecks, mutationSmoke` akzeptiert. Mutanten stehen deshalb im Text (§12), `mutationSmoke: "required"`.
- **Gegen den echten Parser geprüft:** `parseContractDocument` auf `3d7545d` → `ok: true`, `taskId MYST-0003`, `contractVersion 1`, `contentHash` = `8574f1e2a2b37a53efe7475d9fc3bee1510db3f8f40cb06c3be6926a80ac0c6d` (`sha256("forge-contract-v1\n" + text)`). Größe 34 480 Bytes, Git-Blob `9bbfdc656865d0da629e1f7c9f51a7741b37d905`. Diese Werte gelten nur für den unveränderten Draft.
- `dependencies: []`: Legacy-Tasks sind im Kernel nicht registriert (ein Eintrag würde `DEPENDENCY_MISMATCH`/`DEPENDENCY_UNRESOLVED` auslösen), und MYST-0001 ist bewusst keine Abhängigkeit.
- End-Marker `<!-- END OF CONTRACT MYST-0003 v1 -->` als letzte Zeile: von Format 1 nicht verlangt, schadet nicht, erleichtert eine spätere Format-2-Migration.
- Enthält: Scope, gelesene Fakten, API, Bindung, Hashing mit Golden Vectors, 12 Acceptance Criteria, Non-Goals, 77 Testfälle, 9 Mutanten mit wörtlichen Ankern, Datei- und Zeilenlimits.

## 12. Review Hotspots

| # | Hotspot | Risiko | Empfehlung |
|---|---|---|---|
| H-1 | **Formatbruch zwischen Drafts:** MYST-0001 ist Format 2 (nicht parsebar auf `main`), MYST-0003 ist Format 1 | Uneinheitliche Mystery-Contracts; MYST-0001 kann ohne FORGE-CORE-0002 nicht registriert werden | Seb entscheidet: MYST-0001 auf Format 1 zurückportieren oder beide nach CORE-0002 in Format 2 |
| H-2 | `found` enthält sprechende kanonische IDs | Leak, falls VS-5 `found` direkt ausgibt | VS-5-Contract muss „nur PlayerRefs an den Spieler“ als AC und Test tragen |
| H-3 | Fallfremde `known`-Refs bzw. Map eines anderen Falls ergeben `found: []` statt Fehler | Stiller Aufruferfehler | Bewusst (keine Truth im Resolver); VS-5 prüft Paketbindung. Alternative wäre ein `truth`-Parameter (+≈ 8 Zeilen, Leak-Kanal) |
| H-4 | Mehrere Pfade je Evidence (Abweichung vom früheren VS-2-Design) | Mehr Testfläche | Monotonie bleibt; per Owner-Entscheid auf genau einen Pfad reduzierbar (`.length(1)`), Hash-Profil unverändert |
| H-5 | `examine_person` vs. Befragung (VS-4) | Autoren mappen Aussagen fälschlich auf `examine_person` | Autorenkonvention: Aussagen = inaccessible + VS-4; später Paket-Lint |
| H-6 | Kein Event-Ziel | Evidence mit Event-Source muss umgemappt oder inaccessible werden | Bewusst; additive `schemaVersion: 2` möglich |
| H-7 | Keine Freischaltung | Fälle, in denen ein Fund einen neuen Ort eröffnet, sind in V1 nicht ausdrückbar | Lösbarkeit muss mit der Startmenge `known` und VS-4 erreichbar sein; Witness (MYST-0008) prüft das |
| H-8 | Zod akzeptiert geerbte Eigenschaften in `strictObject` | Überraschung für Reviewer | Verhalten in A-53 festgehalten; Implementierung liest nach dem Parse nur Parse-Daten |
| H-9 | Mutationsanker legen Code-Formulierungen fest | Developer-Freiheit eingeschränkt | Wie bei MYST-0001 gewollt, damit `mutationSmoke` reproduzierbar ist |
| H-10 | `dependencies: []` verschweigt formal TASK-0001 | Kernel kennt Legacy nicht | Legacy über `baseCommit` gebunden und in §1.2/§1.3 dokumentiert |

Offene Owner-Entscheidungen (Arbeitsannahmen bis zur Entscheidung):

| # | Frage | Arbeitsannahme |
|---|---|---|
| OE-M3-1 | Variante A oder B (PlayerRef-Abhängigkeit)? | **B** |
| OE-M3-2 | Mehrere Pfade je Evidence? | **Ja** |
| OE-M3-3 | `examine_person` behalten? | **Ja** |
| OE-M3-4 | Player-Safe View in MYST-0003? | **Nein**, eigene Schicht in VS-4/VS-5 |
| OE-M3-5 | `accessHash` jetzt (nicht erst VS-5)? | **Jetzt** |
| OE-M3-6 | Contract-Format für Mystery-Tasks bis CORE-0002 | **Format 1** |

## 13. GO / NO-GO

**GO** für:

- Review und Registrierung des MYST-0003-Draft-Contracts (Format 1, parserverifiziert), vorbehaltlich OE-M3-1…6.
- Implementierung parallel zu MYST-0001; keine Abhängigkeit, keine bestehende Datei betroffen, ≈ 190 Produktionszeilen.

**NO-GO** für:

- jede direkte Spielerausgabe von `found` oder Evidence-Inhalten, bevor MYST-0001 (PlayerRef) und eine Content-Release-Schicht existieren;
- das Einbetten einer Player-Safe View oder eines `label` in MYST-0003;
- Format 2 im MYST-0003-Contract, solange `main` es nicht parsen kann.

Kein Blocker im vorhandenen Code gefunden.
