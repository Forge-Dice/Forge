# MYST-0004 — Evidence Presentation & Player Release V1: Preflight + Contract Package

Stand: 2026-10-03, read-only. Repository `Forge-Dice/Forge`, `main` = `3d7545d843883418348004e68717399a64da7a7d` (selbst per `git fetch` geprüft). Basis: `npm run typecheck` 0 Fehler, `npm test` 1087/1087 grün (in einer Scratch-Kopie ausgeführt). Nichts im Repository geändert, kein Branch, kein Commit, kein PR.

Begleitdatei: `MYST-0004-EVIDENCE-PRESENTATION-V1.contract.DRAFT.md` (Format 1, parst mit `parseContractDocument` von `main`; `contentHash` `b3848250f336ac92459e828481383896835f0546d57d13951f36de7e83fc780c`, Git-Blob `f6c20f3d84b0aebb39fcfa75109d56edbdec057b`, 44 015 Bytes).

**Nummernhinweis.** Der `OVERNIGHT-EXECUTION-PLAN` führte `MYST-0004` als „NPC Interrogation + Translator-Bridge (VS-4)“, und `MYST-0005` (Case Package) hängt dort von „MYST-0004“ ab. Der Owner hat `MYST-0004` jetzt dieser Aufgabe zugewiesen. Die neue Nummer für Interrogation und die Korrektur der Abhängigkeitsliste von MYST-0005 sind Owner-Entscheidung (OE-M4-9); dieses Paket löst das nicht auf.

---

## 1. Actual Boundary

### 1.1 Implementiert auf `main`

| Element | Felder / Fakten | Spoilerpotenzial |
|---|---|---|
| `Evidence` (`src/domain/case-truth.ts`) | strict `{ id, description, source, links }` | siehe 1.2 |
| `Evidence.id` | `evidence:<slug>`, Slug frei wählbar | **ja**: sprechende Slugs (`evidence:ben-is-the-murderer`) |
| `Evidence.description` | `TextSchema`, objektive Autorenprosa | **ja**: Fixture „Annas Fingerabdruck auf dem Brieföffner (vom Vortag)“ verrät die Red-Herring-Auflösung |
| `Evidence.source` | `person`\|`location`\|`item`\|`event` + ID | **ja**: Herkunft kann verborgen sein (`gloves-dirty` stammt aus `event:walk`; „Anna arbeitet im Garten“) |
| `Evidence.links` | ≥ 1 `{ propositionId, direction: supports\|refutes }` | **ja**: Richtung + Proposition + deren `truth` ergeben die Auflösung |
| `Proposition` | `{ id, claim, truth }` | **ja**: `truth` ist die Lösung |
| `Claim` (exportiertes `ClaimSchema`) | `personAt{personId, locationId, at}`, `eventHasParticipant{eventId, personId}`, `eventHasItem{eventId, itemId}` | Form selbst neutral; Referenzen können sprechen |
| `Secret` | `{ id, propositionIds }` | **ja**: Mitgliedschaft markiert Geheimnisse |
| `RedHerring` | `{ id, evidenceIds, misleadingPropositionId }` | **ja**: markiert Täuschung |
| Entitäten | `persons/locations/items` `{ id, name }`, `events` `{ id, description, time, locationId, participantIds, itemIds, causedByEventIds }`, `motives`, `relationships` | IDs und Beschreibungen ja; Namen meist nicht, aber nicht garantiert |
| `CaseSolution` (`case-solution.ts`) | Resolutions, Conclusions (`conclusion:`) | **ja** (Lösung) |
| NPC Knowledge + Projection (`npc-knowledge*.ts`) | eigene Spielergrenze für NPC-Kontext: projektionslokale Handles, Allowlist von 9 Claim-Formen | Muster für Neuaufbau-Barriere, nicht wiederverwendbar (NPC-spezifisch) |
| Identität | `hashCaseTruth` (`forge-case-c14n-v1`, jedes Array Menge), `hashCaseSolution` | — |

Verfügbare Proposition-/Entity-Referenzen in einer Evidence: genau `source.id` (eine Entität) und `links[].propositionId` (indirekt über `claim` weitere Entitäten). Mehr nicht.

### 1.2 Nur Entwurf (nicht als implementiert behandelt)

| Entwurf | Was er vorsieht | Status |
|---|---|---|
| MYST-0001 PlayerRef V1 | `pr1_` + 16 Crockford-Base32-Zeichen, gesalzen + an `truthHash` gebunden; Arten `person location item event evidence`; `buildPlayerRefIndex`, `playerRefFor(index, kind, id)` (einzige vorgesehene Ref-Quelle), `resolvePlayerRef` ohne Orakel; Auflösung ≠ Autorisierung | Draft, **Format 2** (auf `main` nicht parsbar) |
| MYST-0003 Evidence Access | `EvidenceAccessMap` gebunden an `truthHash`; `resolveInvestigation(map, known, action)` → `found: EvidenceId[]` (intern); `known` = `{kind,id}` im Domain-ID-Raum; **kein** Inhalt, kein Label, keine Player-Sicht; eigenes Profil `forge-evidence-access-c14n-v1` | Draft, Format 1 |
| MYST-0002 Accusation | Verdict-Schicht | Draft, für MYST-0004 irrelevant |

Folge: MYST-0004 ist die Stelle, an der aus einer intern entdeckten `EvidenceId` erstmals spielerseitiger Inhalt wird. Davor gibt es nichts Spielersicheres über Evidence.

---

## 2. Data Model

Ein eigenes, autorenseitiges Dokument `EvidencePresentation`, an genau eine `CaseTruth` gebunden (gleiches Muster wie MYST-0003):

```ts
{
  schemaVersion: 1,
  caseId,                 // = truth.caseId
  truthHash,              // = hashCaseTruth(truth)
  entries: [{             // genau ein Eintrag je Evidence der Truth
    evidenceId,
    text,                 // spielerseitiger Text, PlayerTextSchema (T1–T6)
    mentions: [{ kind: "person"|"location"|"item"|"event", id }],   // ≤ 16, Menge
    reports: [{ claim: Claim, stance: "affirms"|"denies",
                source: { kind: "observation" } | { kind: "testimony", personId } }],  // ≤ 8, Menge
  }],
}
```

Beantwortet die geforderten Fragen:

| Frage | Feld |
|---|---|
| player-facing Text | `text` |
| welche Entitäten strukturell freigegeben werden | `mentions` (plus die Evidence selbst, implizit) |
| welche strukturierten Aussagen mitgeteilt werden | `reports` |
| was **nicht** freigegeben wird | alles andere; es gibt kein Feld, über das `description`, `source`, `links`, `truth`, Secret-/Red-Herring-Mitgliedschaft oder Solution fließen könnten |

Getroffene Entscheidungen:

- **Getrenntes Dokument statt Erweiterung von `Evidence` oder der Access-Map.** `CaseTruth` bleibt unverändert (Auftrag), MYST-0003 bleibt unverändert (Auftrag), und Präsentation ändert sich häufiger als Wahrheit oder Zugang. Eigener Hash = eigene Änderungsspur.
- **Vollständigkeit (R4).** Jede Evidence braucht einen Eintrag, auch eine in MYST-0003 `inaccessible` (z. B. `anna-statement`, die später über Befragung kommt). Fehlende Präsentation ist ein Autorenfehler beim Laden, nicht ein Laufzeitfehler mitten im Spiel. Kosten: ein Eintrag je Evidence, der ohnehin nötig ist.
- **Claim-Vokabular wiederverwendet.** `ReportSchema.claim` ist exakt `ClaimSchema` aus `case-truth.ts` (Import, keine Kopie). Keine neue Claim-Sprache, keine Proposition-ID.
- **Abschluss (R7).** Jede Entität, die ein Report nennt (inkl. Zeuge), muss in `mentions` stehen. `mentions` ist damit die eine, vollständige Liste aller freigegebenen Entitäten eines Eintrags; Reviewer prüfen eine Liste, nicht zwei.
- **Kein Selbstwiderspruch (R8).** Eine Quelle bejaht oder verneint einen Claim, nicht beides; zwei Zeugen dürfen sich widersprechen.

---

## 3. Text vs Structured Information

| Ebene | Inhalt | Darf PlayerKnowledge verwenden? | Mechanisch geprüft |
|---|---|---|---|
| A. Präsentationstext | `text` | **nein**, nur Anzeige/Protokoll; wird nie geparst | Form (T1–T6), nicht Inhalt |
| B1. Evidence existiert | PlayerRef der Evidence | ja (bekannte Evidence) | Ref-Format, Injektivität |
| B2. Entität bekannt | `mentions` | ja (bekannte Entität) | Existenz in Truth, Eindeutigkeit |
| B3. berichtete Aussage | `reports` | ja, **als attribuierte Aussage** („E zeigt / X sagt: Claim bejaht/verneint“), nie als Wahrheit | Referenzen ⊆ mentions, Eindeutigkeit |

Beispiel aus dem Auftrag:

```text
text:     "Auf dem Messer befindet sich ein Fingerabdruck."
mentions: [{ kind: "item", id: "item:knife" }]
reports:  []          // das Claim-Vokabular hat keine Form „Person berührte Item“
```

Freigegeben: „Evidence X existiert“, „Item knife ist bekannt“. **Nicht**: „Proposition P ist wahr“, auch nicht „P wird gestützt“.

Kleinste V1-Struktur: `text` + `mentions` + `reports`. Geprüft und verworfen:

| Alternative | Warum nicht |
|---|---|
| nur `text` (wie VS-2-`label`) | PlayerKnowledge bekäme keine Entitäten; jede spätere Investigation (MYST-0003 `TARGET_NOT_KNOWN`) bliebe blockiert oder müsste Text parsen |
| `text` + `mentions`, ohne `reports` | Zeugenaussagen und Alibis wären nur Prosa; VS-4/VS-6 bräuchten später doch strukturierte Aussagen, und die würden dann nachträglich an Evidence angeflanscht. `reports` kostet ca. 25 Zeilen |
| `reports` mit `propositionId` statt Claim | Proposition-IDs sind wahrheitsnah (Truth-Wert hängt daran) und sprechend; Spielerseite soll nie Proposition-Identität erhalten |
| Polarität aus `links.direction` übernehmen | wäre automatische Übernahme von Autorenstruktur, die sich auf Wahrheit bezieht (Spoiler-Pfad) |

---

## 4. PlayerRef Dependency

| Frage | Entscheidung | Begründung |
|---|---|---|
| Implementierungsabhängigkeit? | **Nein** | Strukturelles Port-Objekt `PlayerRefTranslator { caseId, truthHash, refFor(kind, id) }`; kein Import aus MYST-0001; Tests mit Test-Double (`fakeTranslator`, Vertrag §3.5) |
| Paket-/Laufzeitabhängigkeit? | **Ja** | Echte Releases brauchen einen aus `PlayerRefIndex` gebauten Translator (`refFor = (k,id) => playerRefFor(index,k,id)`); Konstruktion in VS-5 |
| Contract parallel vorbereitbar? | **Ja**, und registrierbar ohne MYST-0001 | Eine Kopplung bleibt: `PLAYER_REF_PATTERN` = wörtlich MYST-0001 D3 (`^pr1_[0-9a-hjkmnp-tv-z]{16}$`). Ändert MYST-0001 sein Format vor Annahme, braucht MYST-0004 eine Revision |

Architektur wie bevorzugt: Authoring verwendet intern kanonische IDs; das Release an den Spieler enthält ausschließlich PlayerRefs. Der Release prüft die Rückgaben des Ports selbst (Format, Injektivität, Bindung), weil genau hier die Spielergrenze liegt. Ein fehlerhafter Port (gibt kanonische ID oder Slug zurück) kann nichts leaken.

Warum das Pattern hart verdrahten statt nur „kein Doppelpunkt“: Ein Port, der `id.split(":")[1]` liefert, gäbe `ben` zurück, sprechend und ohne Doppelpunkt. Nur das exakte Format schließt das aus.

---

## 5. Release API

```ts
releaseEvidence(presentation: EvidencePresentation, evidenceId: unknown, translator: PlayerRefTranslator): ReleaseResult
```

- Eingabe: geparste, gebundene Präsentation; interne Evidence-ID (z. B. aus MYST-0003 `found`); Translator.
- Ausgabe: `{ success: true, observation }` mit `observation = { schemaVersion: 1, evidence: PlayerRef, text, mentions: [{kind, ref}], reports: [PlayerReport] }`, tief eingefroren, Ordnung nach Ref (nie nach kanonischer ID, nie nach Autorenreihenfolge).
- Fehler: `BINDING_MISMATCH` (Port gehört zu anderem Fall/anderer Truth: stale Mapping, falsches Paket), `UNKNOWN_EVIDENCE`, `REF_UNAVAILABLE` (Port liefert keine gültige, eindeutige Ref). Konstanten ohne Echo.
- Rein: kein `CaseTruth`-Parameter, kein `CaseSolution`, keine Session, kein Zustand. Die Funktion kann strukturell nichts lesen, was nicht im Präsentationseintrag steht.
- Keine Autorisierung: ob die Evidence entdeckt wurde, prüft der Aufrufer (gleiches Prinzip wie MYST-0001 „Auflösung ≠ Autorisierung“). Ein zusätzlicher `authorized`-Parameter wurde verworfen: Der Aufrufer würde dieselbe ID in beide Parameter schreiben; der Schutz wäre Schein.

Warum Release nicht direkt eine Liste von IDs nimmt: Ein Release je Evidence hält Fehler lokal (eine fehlende Ref blockiert nur diese Evidence) und macht Idempotenz trivial. Batch ist ein `map` beim Aufrufer.

Volle Spezifikation: Vertrag §5.

---

## 6. PlayerKnowledge Effects

Exakt übernehmbar (Vertrag §8):

| Kategorie | Aus | Wird zu | Explizit nicht |
|---|---|---|---|
| known evidence | `observation.evidence` | Menge bekannter Evidence-Refs | keine Bedeutung, keine Links |
| known entity | `mentions[]` | Menge bekannter Entitäts-Refs mit Art | kein Name, keine Rolle; aber: **darf Untersuchungsziel werden** |
| reported/observed statement | `reports[]` + Evidence-Ref | Menge attribuierter Aussagen | keine Wahrheit, kein Glaube, keine Proposition, keine Conclusion; Widersprüche bleiben stehen |
| presentation text | `observation.text` | Anzeige-Log | nie Eingabe einer Regel, nie geparst |

Keine Inferenz: Aus „Anna sagt, sie war im Garten“ entsteht weder „Anna war im Garten“ noch „Anna war nicht in der Bibliothek“. Aus zwei Reports entsteht kein dritter. Aus einer Erwähnung entsteht keine weitere Erwähnung.

Empfehlung für VS-5 (nicht Teil dieses Vertrags): PlayerKnowledge im PlayerRef-Raum speichern (das ist, was der Spieler kennt); für MYST-0003 werden bekannte Refs per `resolvePlayerRef(index, ref, kind)` in Domain-Refs übersetzt. Save-Dateien binden dann Salt und `truthHash` mit (Paket-Hash, §8).

---

## 7. Spoiler Analysis

Leak-Pfade und ihre Sperre:

| Pfad | Sperre | Art |
|---|---|---|
| kanonische Evidence-/Entitäts-ID im Output | Output nur aus Port; Port-Rückgabe formatgeprüft | mechanisch |
| Ordnung verrät Slug-Alphabet | Sortierung nach Ref | mechanisch |
| `description` / `source` / `links` / `truth` / Secret / Red Herring / Solution | nie gelesen; `releaseEvidence` bekommt keine Truth; Quelltextregel verbietet die Bezeichner | strukturell |
| Report gibt unerwähnte Entität frei | R7 | mechanisch |
| unbekannte/falsche Entitätsart | Schema + R5 | mechanisch |
| stale Mapping / falsches Paket | Bindung Port ↔ Präsentation | mechanisch |
| Port gibt Slug/ID/Duplikat | Format + Injektivität | mechanisch |
| Steuer-/Bidi-/unsichtbare Zeichen (Trojan-Source-artige Anzeigetäuschung) | T3/T4 | mechanisch |
| kanonische ID oder PlayerRef im Autorentext | T5/T6 | mechanisch (Unfallschutz) |
| inhaltlicher Spoiler im Text („vom Vortag“) | Autor | **nicht prüfbar** |
| Report verrät mehr als Text (exakter Tick) | Autor | nicht prüfbar |
| Erwähnung schaltet zu früh ein Untersuchungsziel frei | Autor + Solvability (später) | nicht prüfbar hier |

**Entscheidung zu „person:killer“ im Spielertext:** V1 **verbietet** es hart (Parse-Fehler), kein Lint. Begründung: Kein legitimer Spielertext enthält `<präfix>:<kleinbuchstabe>` in Kennungsform; Falsch-Positive (`Kontaktperson:anna`) sind selten und mit einem Leerzeichen behebbar; ein Lint ohne Warnkanal würde ignoriert. Homoglyphen und Großschreibung (`Person:Ben`) werden bewusst nicht erkannt: Der Check schützt vor Copy-Paste-Unfällen, nicht vor einem böswilligen Autor (der kann Spoiler ohnehin als Prosa schreiben). Dasselbe gilt für PlayerRef-Literale (`pr1_…`) im Text: verboten, weil saltabhängig und von einer UI leicht als Link missdeutet.

Vollständige Matrix (76 Fälle): Vertrag §11, Zusammenfassung §10 unten.

---

## 8. Identity/Hashing

**Ja, eigener Hash** `presentationHash`. Begründung: Text und Freigaben beeinflussen beobachtbares Verhalten, sind aber weder in `truthHash` noch in `accessHash` enthalten. Ohne eigenen Hash könnte ein Save/Replay mit geändertem Text unbemerkt weiterlaufen. VS-5 bindet `truthHash`, `accessHash`, `presentationHash` und die PlayerRef-Konfiguration in einem Paket-Hash.

| Punkt | Festlegung |
|---|---|
| Profil | `forge-evidence-presentation-c14n-v1` (eigene Domäne, Regeln wie `forge-case-c14n-v1`) |
| Array-Semantik | alle drei Arrays (`entries`, `mentions`, `reports`) sind Mengen; Duplikate durch R3/R6/R8 ausgeschlossen, also injektiv |
| Text | String, keine Normalisierung, kein Trimmen: jedes Zeichen zählt (P1, P5 NFC↔NFD, P7 Leerzeichen) |
| Reihenfolge | Umordnen von Einträgen, Mentions, Reports und Objekt-Schlüsseln ändert nichts (P0) |
| Bindung | `caseId` + `truthHash` im Hash; neue Truth = neuer Hash |
| Golden Vectors | `CANON_P` (1342 Bytes), `CANON_E`, P0–P7, PE; Node und Python unabhängig gerechnet (Vertrag §7.3) |

| Vektor | SHA-256 |
|---|---|
| P0 Fixture | `8d790f71e045e0132f6fa7ff6bf3b85020561870485df355e8d1ac5a38eda3cf` |
| PE leerer Fall | `f37a3c040156755302245a68cde1b6ce5d93b5d5216d2f2e5fd4b7af6b4f5a19` |
| P1 Text `.`→`!` | `29e881d1…` |
| P5 Text NFD | `ed1bad29…` |

Unicode-Normalisierung wurde bewusst **nicht** verlangt: `String.prototype.normalize` hängt an der ICU-Version der Laufzeit; ein NFC-Pflichtcheck könnte zwischen Node-Versionen anders entscheiden. Folge: NFC- und NFD-Text sind zwei verschiedene Präsentationen (sichtbar gleich, Hash verschieden). Das ist konservativ und deterministisch (Hotspot H-6).

---

## 9. Authoring Ergonomics

Getestet an 12 Evidence-Beispielen (vier aus `fullCase()`, acht typische Formen). Spalten: Doppelpflege gegenüber `description` (Text) und `links` (Reports); Zahl der zu schreibenden IDs.

| # | Evidence | `description` (Autor) | `text` (Spieler) | mentions | reports | Doppelpflege |
|---|---|---|---|---|---|---|
| 1 | `fingerprint` (Red Herring) | „Annas Fingerabdruck auf dem Brieföffner (vom Vortag)“ | „Auf dem Griff des Brieföffners ist ein Fingerabdruck. Der Abgleich ergibt: Er stammt von Anna.“ | item, person | – (kein Claim „berührte“) | Text **muss** abweichen (Spoiler) |
| 2 | `anna-statement` (Zeugin) | „Anna hörte Ben streiten und war danach durchgehend im Garten“ | „Anna sagt: „Ich habe Ben streiten hören. Danach war ich die ganze Zeit im Garten.““ | 2 person, event, location | 2 × testimony | Claim `ben-at-argument` = Link-Claim (Wiederholung von 3 IDs) |
| 3 | `muddy-path` | „Frische Fußspuren im Gartenbeet“ | „Im Gartenbeet sind frische Fußspuren.“ | location | – | Text ≈ Description |
| 4 | `gloves-dirty` (Quelle verborgen) | „Erde an den Gartenhandschuhen“ | „An den Gartenhandschuhen klebt Erde.“ | item | – | Text ≈ Description; Quelle `event:walk` bewusst nicht erwähnt |
| 5 | Überwachungskamera | „Kamera zeigt Ben um 23:10 im Flur“ | „Die Aufnahme zeigt Ben um 23:10 Uhr im Flur.“ | person, location | 1 × observation `personAt` | Claim = Link-Claim |
| 6 | Alibi-Bestreitung | „Clara lügt: war in der Küche“ | „Clara bestreitet, in der Küche gewesen zu sein.“ | person, location | 1 × testimony `personAt` **denies** | Text muss abweichen („lügt“) |
| 7 | Zerrissener Brief | „Erpresserbrief von Ben an Clara“ | „Ein zerrissener Brief: „Zahl oder alle erfahren es. – B.““ | – (B. bleibt Rätsel) | – | Text muss abweichen; keine Mention, sonst wäre „B.“ aufgelöst |
| 8 | Blut an der Waffe | „Claras Blut am Brieföffner“ | „Am Brieföffner klebt getrocknetes Blut.“ | item | **keine** `eventHasItem(murder, opener)`: das wäre Inferenz und gäbe `event:murder` frei | Disziplin: Reports = was die Evidence sagt, nicht was sie beweist |
| 9 | Kassenbon | „Ben kaufte am Vortag Handschuhe“ | „Kassenbon: ein Paar Gartenhandschuhe, bar bezahlt, gestern.“ | item | – | Text muss abweichen (Käufer verborgen) |
| 10 | Gehörter Streit | „Streit zwischen Ben und Clara in der Bibliothek“ | „Aus der Bibliothek waren laute Stimmen zu hören.“ | location, event | – | Text muss abweichen (Teilnehmer verborgen) |
| 11 | Geplante Falschspur | „Von Ben platzierter Zettel, der Anna belastet“ | „Ein Zettel: „Anna war um elf in der Bibliothek.““ | person, location | 1 × observation `personAt` affirms (falscher Claim) | Report bewusst gegen die Wahrheit; nie Wahrheitswert |
| 12 | Sprechende ID `evidence:ben-poison-receipt` | „Bens Giftquittung“ | „Eine Apothekenquittung über ein Rattengift.“ | item | – | ID erreicht den Spieler nie (PlayerRef) |

Befund:

- **Text vs. `description`:** in 3 von 12 Fällen fast gleich (3, 4, 5), einmal nur umformuliert (2), in 8 von 12 muss der Text abweichen, weil `description` die Auflösung trägt. Automatische Übernahme wäre in der Mehrzahl ein Leak. Doppelpflege ist also überwiegend keine Doppelung, sondern zwei verschiedene Texte für zwei Leser.
- **Reports vs. `links`:** Reports in 4 von 12 Fällen; in 2 davon (2, 5) ist der Claim identisch mit einem Link-Claim (3–4 IDs wiederholt). In 6 und 11 widerspricht der Report bewusst der Wahrheit, in 8 wäre ein aus `links` abgeleiteter Report eine Inferenz und ein Leak.
- **Mentions:** im Schnitt 1,6 IDs je Evidence; sie sind die eigentliche Freigabe-Entscheidung und kein Duplikat.
- **Aufwand je Evidence:** ein Satz Text, 1–4 Mention-IDs, selten ein Report. Gesamtkosten für einen Fall mit 15 Evidence: ca. 15 Sätze + 25 IDs.

Maßnahmen gegen unnötige Doppelpflege, ohne die Spoilergrenze aufzugeben:

| Maßnahme | V1? | Begründung |
|---|---|---|
| R7 als Fehler statt impliziter Freigabe | ja | verhindert Drift: Report-IDs und Mentions können nicht auseinanderlaufen, ohne dass der Parser es meldet |
| Vollständigkeit R4 | ja | fehlende Präsentation fällt beim Laden auf |
| `text: { fromDescription: true }` (explizites Opt-in) | **nein** | Release bräuchte die Truth; eine spätere Description-Änderung würde still Spielertext ändern; in 8/12 Fällen falsch |
| Report-Kurzform `{ fromProposition, stance }`, beim Parsen zum Claim expandiert | **nein, V2-Kandidat** | spart 2–3 IDs in ~15 % der Fälle, verleitet aber zu „alle Links freigeben“; Hash müsste über die expandierte Form laufen |
| Lint „Name einer Truth-Entität steht im Text, Entität nicht erwähnt“ | **nein, VS-6-Kandidat** | nützlich (Inkonsistenz Text ↔ Struktur), braucht Warnkanal |
| Lint „`text` === `description`“ | **nein, VS-6-Kandidat** | Hinweis für Review, kein Fehler (Fälle 3/4 sind legitim) |

---

## 10. Adversarial Matrix

76 Fälle, vollständig mit Eingabe, Erwartung und Testdatei in Vertrag §11. Abdeckung der Pflichtpunkte:

| Pflichtpunkt | Fälle |
|---|---|
| speaking Evidence ID | A-01, A-12 (Beispiel), A-41 |
| killer/person IDs | A-02, A-59 |
| hidden source | A-05, A-06 |
| proposition links | A-07, A-22 |
| truth values | A-08, A-11, A-23, A-71 |
| secret membership | A-09 |
| red-herring membership | A-10 |
| solution data | A-12, A-72 |
| unreleased entity | A-19, A-20, A-24 |
| released entity | A-21, A-74 |
| duplicate release | A-43 |
| property order | A-44, A-45, A-03 |
| changed presentation text | A-49 (P1, P5, P7) |
| changed truth | A-31, A-11 |
| stale PlayerRef mapping | A-33 |
| wrong package | A-34, A-32 |
| malformed text | A-50, A-51, A-52, A-65, A-66 |
| Unicode/Bidi/control chars | A-53 – A-57 |
| injected canonical ID inside authored text | A-59 – A-63, A-58 (Grenze) |
| Port-Fehlverhalten | A-35 – A-40 |
| Vollständigkeit | A-67 – A-70 |

Spoiler-Scan (AC-11): eine eigene `spoilerCase()`-Truth mit sprechenden IDs und Markern in Beschreibungen und Namen; das serialisierte Ergebnis aller Releases darf keinen davon enthalten. A-09 bis A-11 sind Differenztests: Truth-Varianten ohne Secret, ohne Red Herring, mit invertierten Wahrheitswerten liefern tief gleiche Observations.

Mutanten (9, mit Ankern, Vertrag §12): Text-ID-Check, Zeichenverbot, Bindung, Ref-Format, Ref-Injektivität, Abschluss R7, Vollständigkeit R4, Ausgabeordnung, Hash-Mengensemantik. Im verworfenen Prototyp wurden 9 von 10 geprüften Mutanten von einem Rauchtest getötet; der Hash-Ordnungsmutant überlebte nur mangels Assertion, AC-10 deckt ihn ab.

---

## 11. Scope

| Kriterium | Ziel | Stand |
|---|---|---|
| Produktionszeilen | < 300 | Limit 290 (255 + 40 je Datei, 290 gesamt); Prototyp 249 + 32 = 281 |
| neue Dependency | keine | keine (`zod`, `node:crypto` vorhanden) |
| Änderung an `CaseTruth` | keine | `scope.modify: []`; `ClaimSchema` wird nur importiert |
| Änderung an MYST-0003 | keine | kein Import, keine Datei |
| Session / UI / LLM | keine | Non-Goals §13 |
| Dateien | | 2 Produktion, 5 Test |

Der Prototyp lag in einer Scratch-Kopie außerhalb des Repositories, wurde nur zur Größenschätzung, für die Vektoren und den Mutantenrauchtest benutzt und ist kein Teil der Lieferung.

Risiko für das Limit: Die Quelltextregel (keine Wörter `description`, `secrets` usw., auch nicht in Kommentaren) und lokal duplizierte Helfer (`hasLoneSurrogate`, `deepFreeze`, `canonicalize`) kosten ca. 35 Zeilen. 9 Zeilen Reserve gegenüber dem Prototyp sind knapp, aber ausreichend; ein Entwickler mit ausführlicherem Stil sollte Kommentare kürzen, nicht Regeln.

---

## 12. Draft Contract

Datei: `/mnt/project-files/forge-audits/MYST-0004-EVIDENCE-PRESENTATION-V1.contract.DRAFT.md`

| Eigenschaft | Wert |
|---|---|
| Format | `forgeContractFormat: 1` (das einzige, das `main` parst) |
| Parse auf `main` | ok, `parseContractDocument(text, nodeSha256Utf8)` |
| `contentHash` | `b3848250f336ac92459e828481383896835f0546d57d13951f36de7e83fc780c` |
| Git-Blob | `f6c20f3d84b0aebb39fcfa75109d56edbdec057b` |
| `baseCommit` | `3d7545d843883418348004e68717399a64da7a7d` |
| `dependencies` | `[]` (Legacy nicht im Kernel; MYST-0001 nur Laufzeit; MYST-0003 keine) |
| `scope.create` | 2 Produktions-, 5 Testdateien |
| `mutationSmoke` | `required` |

Inhalt: Ziel, gelesene Fakten, Abhängigkeiten, Dateien und Limits, Datenmodell mit Text-Regeln T1–T6, Fixture, Test-Double mit Vektoren, gebundener Parser R1–R8, Release-Algorithmus, Ausgabetypen, vier bytegenaue Golden Releases, Informationsgrenze, Hash-Profil mit Golden Vectors, PlayerKnowledge-Wirkung, Grenze zu MYST-0003/VS-5, 16 Acceptance Criteria, 76 adversariale Fälle, 9 Mutanten mit Ankern, Non-Goals, Developer-Abschluss.

Registrierung: Die Datei ist ein Entwurf. Bei Registrierung wird sie als `forge/contracts/MYST-0004.md` committed (Prozessregel: Verträge kommen aus Git). Falls zu diesem Zeitpunkt ein Format-2-Parser existiert, ist ein Transcode nötig (H-2).

---

## 13. Review Hotspots

| ID | Hotspot | Empfehlung |
|---|---|---|
| H-1 | `PLAYER_REF_PATTERN` dupliziert MYST-0001 D3. Formatänderung in MYST-0001 bricht MYST-0004 | MYST-0001-Format vor MYST-0004-Run einfrieren, oder MYST-0004 erst nach MYST-0001-Annahme registrieren |
| H-2 | MYST-0001-Entwurf ist Format 2, MYST-0003/0004 Format 1 | Owner wählt ein Format für die Mystery-Reihe (bereits offen als MYST-0003 H-1) |
| H-3 | Release prüft keine Entdeckung | VS-5-Vertrag muss Test „nur entdeckte Evidence wird released“ enthalten |
| H-4 | Reports können lösungsrelevante Claims als beobachtet ausgeben (A-72) und präziser sein als der Text (A-75) | Autorenrichtlinie + VS-6-Solvability-Prüfung; nicht mechanisch in V1 |
| H-5 | Mentions schalten MYST-0003-Untersuchungsziele frei | in der Solvability-Analyse (MYST-0008) als Kante modellieren |
| H-6 | keine Unicode-Normalisierung | bewusst; falls der Owner NFC will: Pflichtcheck mit festgelegter Node-Version |
| H-7 | T5 erkennt Homoglyphen und Großschreibung nicht; Falsch-Positiv `Kontaktperson:anna` | als Unfallschutz akzeptieren |
| H-8 | Kein Name im Observation: UI kann „Anna“ nur aus dem Text anzeigen | eigener Task „Entity Presentation“ (Namen sind ebenfalls Autoreninhalt, nicht automatisch spielersicher) |
| H-9 | Port-Ausnahmen werden nicht gefangen | gleiches Vertrauensmodell wie MYST-0001; bewusst |
| H-10 | Vollständigkeit R4 verlangt Präsentation auch für nie erreichbare Evidence | bewusst (Ladefehler statt Laufzeitfehler); Owner kann auf „optional + UNKNOWN_EVIDENCE“ umstellen |
| H-11 | Nummernkonflikt MYST-0004 (Interrogation im Overnight-Plan) | Owner vergibt neue Nummer, korrigiert MYST-0005-Abhängigkeiten |

Offene Owner-Entscheidungen (Arbeitsannahmen im Vertrag):

| ID | Frage | Arbeitsannahme |
|---|---|---|
| OE-M4-1 | eigenes Dokument statt Feld an Evidence/Access-Map | eigenes Dokument |
| OE-M4-2 | Vollständigkeit je Evidence | ja |
| OE-M4-3 | kanonische ID / PlayerRef im Text | harter Parse-Fehler |
| OE-M4-4 | Report-Vokabular = `ClaimSchema` + `affirms/denies` + `observation/testimony` | ja |
| OE-M4-5 | Abschluss R7 explizit (Fehler) statt implizit | explizit |
| OE-M4-6 | keine Wiederverwendung von `description`/`links` in V1 | ja |
| OE-M4-7 | `PLAYER_REF_PATTERN` hart verdrahtet | ja |
| OE-M4-8 | keine Unicode-Normalisierung | ja |
| OE-M4-9 | Nummerierung (Interrogation, MYST-0005-Deps) | offen, Owner |

---

## 14. GO / NO-GO

**GO** für Contract-Review und Registrierung als `MYST-0004` v1, unter diesen Bedingungen:

1. Owner bestätigt OE-M4-1 bis OE-M4-8 oder ändert sie (jede Änderung = Vertragsrevision vor Registrierung).
2. OE-M4-9 (Nummerierung) ist entschieden, damit Plan und Vertrag nicht dieselbe Nummer für zwei Tasks führen.
3. H-1: MYST-0001-Referenzformat ist eingefroren, bevor MYST-0004 läuft. Implementierung und Tests von MYST-0004 brauchen MYST-0001 nicht.
4. Unabhängiges Architektur-Review durch einen Nicht-Anthropic-Reviewer (Entwurf stammt von Claude).

**NO-GO** nur für: Implementierung vor Bedingung 1, oder Registrierung in Format 2 ohne existierenden Format-2-Parser.

Begründung für GO: Die Schicht ist klein (Prototyp 281 Zeilen), braucht keine neue Dependency, ändert weder `CaseTruth` noch MYST-0003, ist ohne MYST-0001 implementier- und testbar, und alle Leak-Pfade, die mechanisch sperrbar sind, sind strukturell gesperrt (keine Truth im Release, Port-Rückgaben geprüft). Was nicht mechanisch sperrbar ist (inhaltliche Spoiler im Autorentext), ist ausdrücklich als Autorenverantwortung benannt und auf ein einziges Feld begrenzt, dessen einziger Zweck die Spielerfreigabe ist.

STOP.
