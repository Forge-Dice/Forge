---json
{
  "forgeContractFormat": 1,
  "taskId": "MYST-SOLVABILITY-0001",
  "contractVersion": 1,
  "baseCommit": "3d7545d843883418348004e68717399a64da7a7d",
  "dependencies": [
    {
      "taskId": "MYST-0002",
      "acceptedCommit": null
    }
  ],
  "scope": {
    "create": [
      "src/domain/case-solvability.ts",
      "tests/case-solvability.fixture.ts",
      "tests/case-solvability.test.ts",
      "tests/case-solvability.property.test.ts",
      "tests/case-solvability.typecheck.ts"
    ],
    "modify": []
  },
  "requiredChecks": [
    {
      "name": "typecheck",
      "command": "npm run typecheck"
    },
    {
      "name": "test",
      "command": "npm test"
    }
  ],
  "mutationSmoke": "required"
}
---
# MYST-SOLVABILITY-0001 v1 — Minimum Solvability V1

**DRAFT IMPLEMENTATION CONTRACT. Nicht freigegeben, nicht registriert, nicht implementieren aufgrund dieses Berichts.**

Dieser Contract ist ein neues Audit-Artefakt. Er verändert keine vorhandenen Contracts oder historischen Artefakte. Die Task-ID ist ein vorläufiger Vorschlag; globale Owner-ID-Reservierungen außerhalb der gelesenen Quellen sind UNKNOWN. Keine Verwendung oder Umbenennung des im Evidence-Access-Design bereits genannten MYST-0008.

## 0. Format, Basis und tatsächliche Voraussetzungen

Format 1 ist die einzige Form, die der aktuelle `parseContractDocument` akzeptiert. `reads`, Limits, Tests, Mutanten und Reviewgrenzen stehen deshalb im Body. Kein Format-2-Feld im Frontmatter; kein vorgeschobener Format-2-Endmarker.

Basis: Forge-Dice/Forge, `3d7545d843883418348004e68717399a64da7a7d`.

**Blocker vor Ausführung:** MYST-0002 liegt auf dieser Basis nur als Draft vor. Sein additiver `evaluateConclusionClaim`-Export wird benötigt. `acceptedCommit: null` ist absichtlich keine erfundene Freigabe und kein lauffähiges Dependency-Pin. Vor Registrierung/Start: MYST-0002 akzeptieren, tatsächlichen Commit pinnen, neuen main lesen, API und Reads erneut prüfen und Contract-Fassung/Basis revidieren. Keine Kopie der Conclusion-Wahrheitstabelle und kein Parser-Prober in Produktionscode als Umgehung.

Der echte Release-/Replay-Adapter existiert heute ebenfalls nicht. Unitfixtures dürfen ihn stubben; ein PASS mit Stub ist kein Nachweis eines heutigen Spiels. Vor Abnahme des Example Case muss derselbe Port durch den tatsächlichen headless Reducer implementiert und mit dessen gebundenem Release-Manifest getestet werden. Das Adapter-Schreiben ist nicht Scope dieses Tasks.

## 1. Ziel und Garantie

Implementiere genau einen kleinen autorenseitigen Checker: fallgebundene AND-Implikationen aus tatsächlich replayten freigegebenen Beobachtungen, ergänzt um vollständige endliche Antwortvektoren über einem kleinen AnswerScope.

PASS bedeutet ausschließlich: Unter den explizit veröffentlichten authored Fallregeln existiert ein gemeinsamer gültiger Witness, der alle benötigten Prämissen freigibt; jedes `solution.requiredConclusions`-Literal ist daraus herleitbar; alle verbliebenen vollständigen Antwortvektoren stimmen bei den Pflichtliteralen überein; bei `must_disambiguate` bleibt genau ein Vektor über den abgefragten Dimensionen.

PASS beweist keine natürliche Richtigkeit eines authored Schlussgesetzes, keine menschliche Lösbarkeit, keinen Spielspaß, keine vollständigen alternativen Weltmodelle und kein universelles Mystery-Theorem. Fallregeln, Faktivitätsfreigaben und Spieler-Präsentation bleiben Gegenstand des menschlichen Authoring-Reviews.

## 2. Scope und unveränderliche Autoritäten

Nur die fünf Dateien im Frontmatter. Keine anderen Dateien verändern. Keine neue Runtime- oder Dev-Dependency. Bestehendes Zod und Node crypto dürfen benutzt werden. Keine Modifikation von CaseTruth, Semantic Validation, CaseSolution-Schemas, resolveConclusion, NPC-Wissen, Forge, PlayerRef, Access, Dialogue, Session oder Save.

MYST-0002 ist Autorität für ConclusionStatus. Proposition-Wahrheit wird ausschließlich zur Validierung freigegebener OBSERVED-Literale und inferred Konsequenzen gelesen, niemals als versteckte Proof-Seedquelle. Evidence.links/source/description, Secrets, RedHerrings und NPC-Stance erzeugen keine Prämisse.

## 3. Öffentliche API

```ts
export function createCaseProofProfileSchema(truth: CaseTruth, solution: CaseSolution);
export type CaseProofProfileInput = z.input<ReturnType<typeof createCaseProofProfileSchema>>;
export type CaseProofProfile = z.output<ReturnType<typeof createCaseProofProfileSchema>>;
export function parseCaseProofProfile(input: unknown, truth: CaseTruth, solution: CaseSolution): CaseProofProfile;

export type WitnessReplayResult =
  | { readonly success: true; readonly bindings: ProofBindings;
      readonly released: readonly ReleasedObservation[] }
  | { readonly success: false; readonly code: "REPLAY_UNAVAILABLE" | "INVALID_WITNESS" };
export type WitnessReplay = (orderedStepIds: readonly string[]) => WitnessReplayResult;

export type ProofFinding = {
  readonly code: ProofFindingCode;
  readonly subjectIds: readonly string[];
  readonly path: readonly (string | number)[];
  readonly relatedIds: readonly string[];
  readonly severity: "error" | "warning";
};
export type SolvabilityReport = {
  readonly status: "pass" | "fail" | "unknown";
  readonly findings: readonly ProofFinding[];
  readonly survivingAnswerCount: number;
  readonly competingAnswerSamples: readonly HypothesisVector[];
};
export function checkCaseSolvability(
  truth: CaseTruth, solution: CaseSolution, profile: CaseProofProfile,
  replayWitness: WitnessReplay
): SolvabilityReport;
```

Die im API-Block referenzierten Typen werden ebenfalls als Typen exportiert: ProofBindings, ReleasedObservation, ProofFindingCode, HypothesisVector. Keine weiteren Laufzeit-Exporte. Kein exportierter Conclusion-Resolver, kein öffentlicher Verdict-/PlayerKnowledge-/Session-Adapter. Alle Typen nachfolgend normativ. Typsicher readonly, Ergebnisse rekursiv gefroren, keine Eingabemutation.

## 4. Profile und Beobachtungen

Strikte JSON-Objekte. `CaseProofProfileInput`:

```ts
{
  schemaVersion: 1,
  bindings: { caseId, truthHash, solutionHash, releaseHash },
  answerScope: ConclusionId[],                 // 1..6, Menge; Referenzen auf S.conclusions
  ambiguityPolicy: "must_disambiguate" | "may_remain_ambiguous",
  question: { kind: "required_literals" }
          | { kind: "identify_all_responsible", eventId: EventId },
  observations: ReleasedObservation[],         // 0..64, erwartete autorisierte Releasepayloads
  nodes: ProofNode[],                          // 1..128
  edges: ProofEdge[],                          // 0..128
  witnessStepIds: string[]                     // 0..256, GEORDNET, Aktion-IDs eines trusted Adapterkatalogs
}
```

Hashstrings sind genau 64 lowercase hex. `releaseHash` bindet den manifestierten Release-/Question-/Ruleinhalt einschließlich der typisierten Nodebedeutungen, auf die öffentliche Regeldeskriptoren verweisen; IDs ohne gebundene Bedeutung genügen nicht. Der Host-Port muss exakt dieses Manifest verwenden. Sein Serializer-/Hashprofil wird durch die Release-/Adapterimplementation explizit versioniert; nicht durch diesen Task als vorhandene neue API erfunden. Portcode ist vertrauenswürdiger Produktions-/Testcode, keine Funktion aus authored Daten. Keine `reachable`-/`approved`-Booleans im Profile. Witness-Schritte sind opake begrenzte Strings, keine JS-Ausdrücke, Shellcommands, Regexprogramme oder beliebiger Skriptcode.

Lokale Observation-/Node-/Edge-IDs: ASCII `[a-z][a-z0-9:_-]{0,63}`. Global einzigartige IDs je jeweiliger Collection. Keine Cross-Collection-Magie.

Interne `ProofLiteral`:

```ts
{ kind: "proposition", propositionId: PropositionId, value: boolean }
| { kind: "conclusion", conclusionId: ConclusionId, value: boolean }
```

`ReleasedObservation` ist genau eine der folgenden Varianten mit `id`:

1. `OBSERVED`: `literal` ausschließlich PropositionLiteral; `source` ist `{kind:"initial"}` oder `{kind:"evidence", evidenceId}`. Bedeutet explizit freigegebene, authored als faktiv zertifizierte Beobachtung. Nicht bloß Evidence wurde gefunden. Wert muss zur referenzierten Proposition passen.
2. `REPORTED_BY_NPC`: `npcId` plus `literal: ProofLiteral`. Bedeutet das Auftreten dieses Berichts, nicht die Wahrheit seines Inhalts. Falsche Berichte sind zulässig. Keine `stance`, `intent`, `knowledge`, `belief`, Truthflags oder implizite Faktivität im Spielerport.
3. `ENTITY_AWARENESS`: `entity` ist ein gültiger interner Ref für person/location/item/event/evidence. Bedeutet ausschließlich Bekanntheit, keine Welt- oder Schuldbehauptung.
4. `PUBLIC_RULE`: `rules` ist die finite Liste veröffentlichter Fallregeldeskriptoren `{ edgeId, allOf: NodeId[], yields: ProofLiteral }`. `allOf` enthält die fachlichen Prämissen ohne das License-Node selbst; Menge, nicht Reihenfolge. Es müssen genau die referenzierten Konsequenzliterale freigegeben sein. Die Player-Präsentationsschicht übersetzt interne Referenzen; dieser Checker gibt diese Payloads nie an Spieler aus.

**INFERRED ist kein Release-Root.** Inferred Playerjournal-Einträge sind außerhalb dieser Rootunion. Schlussresultate existieren hier als Literalnodes mit Proof-Trace.

`ProofNode`:

```ts
{ id, kind: "observation", observationId }
| { id, kind: "literal", literal: ProofLiteral }
```

`ProofEdge`: `{ id, allOf: NodeId[], to: NodeId, license: NodeId }`. Keine weitere Regelart. `allOf` nichtleer und duplikatfrei; mindestens eine fachliche Prämisse zusätzlich zur License. `to` muss Literalnode sein. `license` muss Observationnode zu PUBLIC_RULE sein, selbst in `allOf` liegen; der PUBLIC_RULE-Deskriptor muss Edge-ID, fachliche body-Menge und Konsequenz exakt abdecken.

## 5. Parser / Binding / Referenzen

Schema bound to T/S. Solution an Truth überprüfen. Profile-Bindings zu `caseId`, `hashCaseTruth(T)`, `hashCaseSolution(S)` exakt. Bei Bindingfehler keine Folge-Referenzprüfungen. Plain JSON safeParse, parse wirft ZodError. Kein Versprechen für Proxies/Getter-Objekte aus fremdem ausführbarem JS.

Prüfe alle Entity-/Proposition-/Conclusion-/Node-/Observation-/Rule-Referenzen sowie Eindeutigkeit. Structural duplicate edges = gleiche allOf-Menge, gleiche Konsequenz und gleiche License, auch bei anderer Edge-ID; ablehnen. Gleiche ConclusionClaim-Struktur darf nicht über neue lokale IDs umgangen werden; S garantiert den kanonischen Katalog bereits.

Jedes S.requiredConclusions muss in answerScope liegen. Profile speichert keine zweite Required-Liste und keine zweite Resolution. Inferred Literale müssen durch T bzw. MYST-0002 exakt zu ihrem Boolean auflösen; undetermined bleibt undetermined und ist kein ableitbares kanonisches Literal. Falsche NPC-Berichte bleiben zulässige Reportroots, ohne Canonical-Factprüfung.

Transform: entkoppelte strukturierte Kopie, rekursiv freeze, Brand `CaseProofProfile`. Keine Mutation der Rohdaten.

## 6. Deterministische Proof-Semantik

1. Aktuelle Bindingprüfung T/S/Profile; Failfinding bei Mismatch. Keine private Weltprüfung als Proof-Root.
2. Port genau einmal mit der **geordneten** witnessStepIds-Folge aufrufen. Derselbe Witness muss alle benötigten Roots gemeinsam freigeben. Portthrow oder REPLAY_UNAVAILABLE → status unknown + REPLAY_UNAVAILABLE, kein PASS. INVALID_WITNESS → fail. Ausgabe strict-validieren; Bindings und jedes Releasepayload müssen zum autorisierten Profilekatalog passen. Doppelte identische Release-IDs sind mengenartig deduplizierbar; widersprüchliche Payloads fail.
3. Nur exakt replayte Observationnodes als initial established. OBSERVED zusätzlich kanonisch faktiv prüfen. Reports, Awareness und öffentliche Regeln sind Informationseinheiten; kein automatischer Transfer ihres Inhaltes zu Weltliteralnodes.
4. Least fixed point: Edge feuert genau dann, wenn alle body-Nodes established sind, ihre license veröffentlicht ist und die Konsequenz kanonisch konsistent ist. Kein Negation-as-failure, keine Hypothesenautorität, keine spontan bekannten Conclusions, keine empty-/self-supporting Seeds.
5. OBSERVED-Propositionen zählen als explizit released PropositionLiteral; REPORTED-Propositionen nie automatisch. Eine Report→Literal-Brücke ist nur eine explizite, öffentlich veröffentlichte fallgebundene Kante. Die semantische Berechtigung dieser Regel ist menschlich zu reviewen.
6. Für jedes S.requiredConclusions: pass nur wenn genau Claim/Literalpolarität hergeleitet. Negativer Wert ist explizites Literal, nicht Abwesenheit eines positiven Nodes.
7. Zyklen diagnostizieren. Nicht erzeugende Zyklen liefern warning PROOF_CYCLE plus bei fehlender Goalableitung Fehler; ein erreichbarer unabhängiger Seed darf eine zyklische Restkomponente füllen. Keine pauschale Ablehnung harmloser produktiver Zyklen.
8. Nicht replayte Prämissen: warning PREMISE_NOT_REACHED mit Node- und Observation-ID. Missing goal ist error REQUIRED_NOT_DERIVED. Eine ungenutzte unerreichbare Evidence allein invalidiert keinen gültigen anderen Proof.

## 7. Vollständige endliche Hypothesen und Ambiguity

**Keine authored Hypothesenliste im öffentlichen Profile.** Der Checker erzeugt intern alle `2^n` Boolean-Antwortvektoren über dem answerScope, n ≤ 6, maximal 64. Reihenfolge: Scope nach UTF-16-Codeeinheiten, False vor True; vollständig, duplikatfrei. HypothesisVector ist readonly Array `{conclusionId,value}` in dieser kanonischen Reihenfolge.

Diese Vektoren sind vollständige **Antworten auf die abgefragten Dimensionen**, keine vollständigen Welt-/CaseSolution-Kopien. Sie bilden eine konservative Obermenge möglicher Antworten, inklusive mancher logisch unmöglicher Kombinationen. Keine Alternative wird allein wegen der privaten kanonischen Solution eliminiert.

Eliminierung: H wird entfernt, wenn für einen seiner Scopeclaims die entgegengesetzte Polarität aus den replayten Prämissen bewiesen ist. Nur solche Proofresultate, nicht private Statuswerte, eliminieren H. Mindestens ein kanonisch kompatibler Vektor muss existieren; Fehler sonst. Kanonischer Status undetermined lässt beide H-Polaritäten kompatibel; niemals false daraus machen.

`must_disambiguate`: alle Pflichtliterale herleitbar UND genau ein vollständiger Scopevektor bleibt. Das verlangt Belege für jede abgefragte Dimension, nicht globale Eindeutigkeit des ganzen Falls.

`may_remain_ambiguous`: alle Pflichtliterale herleitbar UND jeder verbleibende Vektor stimmt bei ihnen überein. Andere scoped Dimensionen dürfen offen bleiben. Keine Ambiguität der Required-Antwort erlaubt. Der positive Witness muss weiterhin gültig sein; die Policy lockert keine Fakten-/Binding-/Proofprüfung.

Keine Dimensionen außerhalb answerScope werden beurteilt. Kein PASS für eine vermeintliche Vollantwort auf beliebige Claims über den ganzen Fall.

## 8. Vollständige Verantwortungsfrage

Bei `question.kind = identify_all_responsible` muss answerScope genau die kanonischen Katalogclaims personResponsibleForEvent für **jede Person in T** am eventId plus noPersonResponsibleForEvent dieses Events enthalten. Fehlende Claims im Katalog → Authoringfinding; niemals still ergänzen. responsibility.completeness dieses Events muss complete sein. Alle kanonisch positiven Claims in dieser Familie müssen S.requiredConclusions positiv verlangen; bei nobody gilt das für nobody=true. Explizite negative Pflichtfragen bleiben zusätzliche S.requiredConclusions.

Das ist eine Authoringbedingung für diese konkrete Frage, keine Veränderung der Wahrheitstabelle und keine Pflicht, alle Resolutions des Falls globally complete zu machen. Maximal fünf Personen für diese Frage innerhalb des n≤6-V1-Limits. Bei partial kann eine engere required_literals-Frage valide sein, „alle Verantwortlichen“ nicht.

## 9. Strukturierte Findings

ProofFindingCode umfasst:

```
BINDING_MISMATCH, REPLAY_UNAVAILABLE, INVALID_WITNESS,
INVALID_REPLAY_RESULT, RELEASE_RECORD_MISMATCH,
FALSE_OBSERVATION, REQUIRED_NOT_DERIVED, PREMISE_NOT_REACHED,
NONCANONICAL_INFERENCE, UNPUBLISHED_RULE, PROOF_CYCLE,
NO_SURVIVING_HYPOTHESIS, REQUIRED_AMBIGUOUS,
AMBIGUITY_POLICY_VIOLATION, ANSWER_SCOPE_INVALID_FOR_QUESTION,
FULL_ANSWER_INCOMPLETE, POSITIVE_ANSWER_NOT_REQUIRED
```

Structural shape/ref/duplicate failures sind ZodIssues des Profileparsers mit Feldpfaden. Schemafehler dürfen nicht verschluckt und als unsolved-Spielerantwort dargestellt werden. Checkerfindings: stabile code, subjectIds, path, relatedIds, severity; keine Freitext-only Findingsemantik. Zyklen melden die beteiligten Node-IDs, nicht nur einen allgemeinen „cyclic“-String. Ambiguity enthält bis zu vier repräsentative überlebende Vektoren mit deterministischer Reihenfolge; survivingAnswerCount vollständig.

Sortierung nach code, path, subjectIds, relatedIds (UTF-16, keine localeCompare). Fehlerautorität: binding zuerst; replay unavailable unknown; ansonsten alle passenden Proof-/Ambiguityfehler sammeln. Fehlerfreie pass-Reports können warnings enthalten. Alle Reports sind autorenseitig und dürfen nie automatisch an Spieler ausgegeben werden.

## 10. Acceptance Criteria

- AC-01 Nur Scope, 0 neue Dependencies, ≤400 hinzugefügte Produktionszeilen. Ziel 280–360. Nicht durch Codeverdichtung oder Testlöschung erreichen. Wenn sauber nicht möglich: Scope-/Contractrevision, keine stillen Abstriche.
- AC-02 typecheck/test der revidierten Basis grün, bestehende Tests/Fixtures unverändert. MYST-0002 Conclusionstatus über ganze bestehende Differentialtabelle unverändert.
- AC-03 vollständige Semantik §§4–9; mindestens 80 konkrete Tests der Matrix und 768 deterministic seeded configurations mit den acht Metamorphic Properties.
- AC-04 alle acht Produktionsmutanten §12 getötet; Testname und reproduzierbare Mutation festhalten. Keine „mutant killed“ Behauptung bei nicht anwendbarem Anchor oder ungetesteter Compilefehler-Abkürzung.
- AC-05 negative und positive Controls: missing/unreachable/circular/report/ambiguous Fälle fail; unabhängiger Pfad und may-policy kontrolliert pass.
- AC-06 Immutable Inputs/Outputs, deterministische Sortierung, Sets permutation-invariant; witnessStepIds bleiben geordnet.
- AC-07 Keine hidden Truth/Solution/NPC-Daten als Proof-Seed; Factprüfung darf im Reviewer Trace nur nach explizitem Release sichtbar werden.
- AC-08 keine authored omitted-competitor Möglichkeit: Hypothesen intern generiert; `hypotheses` als Profile-Zusatzschlüssel ablehnen.
- AC-09 trusted Portabsenz/Throw liefert unknown; kein Timeout/Systemzeit-Runtime innerhalb Checker, synchroner bounded Port.
- AC-10 Kopflose Integration mit echtem Adapter ist gesonderte Example-Case-Abnahme und wird nicht durch Stubs ersetzt. Authoringreview bestätigt öffentlich erkennbare Rule-/Fact-Lizenzen vor Slice-Freigabe.

## 11. Adversariale Testmatrix (DRAFT, vollständig normativ)

| ID | Test | Erwartung |
|---|---|---|
| T01 | Format schemaVersion 2 | Parsefehler |
| T02 | Unknown root field hypotheses | Parsefehler; keine ausgelassene Konkurrenz |
| T03 | Unknown executable rule field | Parsefehler |
| T04 | Empty answerScope | Parsefehler |
| T05 | Six scoped dimensions | gültig, 64 Hypothesen |
| T06 | Seven scoped dimensions | Limit-Parsefehler |
| T07 | Unknown ConclusionID | Referenz-Parsefehler |
| T08 | Foreign case binding | Bindingfehler vor Referenzen |
| T09 | Changed Truth hash | Bindingfehler |
| T10 | Changed Solution hash | Bindingfehler |
| T11 | Replay foreign releaseHash | fail BINDING_MISMATCH |
| T12 | Replay old Solution binding | fail BINDING_MISMATCH |
| T13 | Port unavailable | unknown REPLAY_UNAVAILABLE |
| T14 | Port throws | unknown, kein Error-Echo |
| T15 | Invalid ordered step | fail INVALID_WITNESS |
| T16 | Corrupt replay result | fail INVALID_REPLAY_RESULT |
| T17 | Released record not in manifest | fail RELEASE_RECORD_MISMATCH |
| T18 | Record payload modified | fail RELEASE_RECORD_MISMATCH |
| T19 | Repeated identical release | Mengenidempotenz |
| T20 | Observed false value | fail FALSE_OBSERVATION |
| T21 | Observed Conclusion as root | Parsefehler |
| T22 | False NPC belief report | zulässiger Report, keine Faktableitung |
| T23 | NPC internal knowledge only | keine freigegebene Root |
| T24 | NPC assertion without authored bridge | required bleibt underived |
| T25 | Evidence inaccessible | premise warning + fehlendes Goal |
| T26 | Evidence discovered, payload not released | keine Proofprämisse |
| T27 | Evidence links supports false proposition | kein automatischer Fakt; RedHerring zulässig |
| T28 | Evidence source points culprit | keine Prämisse |
| T29 | Speaking description solution text | kein versteckter Proofseed |
| T30 | Missing license node | Parsefehler |
| T31 | License not included in allOf | Parsefehler |
| T32 | Rule not publicly released | UNPUBLISHED_RULE / fehlende Ableitung |
| T33 | Published rule yields different literal | UNPUBLISHED_RULE |
| T34 | Cycle without source seed | PROOF_CYCLE + REQUIRED_NOT_DERIVED |
| T35 | Self-supporting conclusion | keine Ableitung |
| T36 | Two-node mutually supporting cycle | keine Ableitung |
| T37 | Independent path next to unseeded cycle | pass mit cycle warning |
| T38 | Seeded productive cycle | pass, kein künstlicher Root |
| T39 | Empty body / license only | Parsefehler |
| T40 | Reported required conclusion | kein objektiver Root |
| T41 | Explicit licensed true report implication | fallgebundene Ableitung erlaubt |
| T42 | Explicit false report-to-false-fact promotion | NONCANONICAL_INFERENCE |
| T43 | Conclusion status undetermined inferred | NONCANONICAL_INFERENCE |
| T44 | Duplicate edge same ID | Parsefehler |
| T45 | Duplicate structural edge other ID | Parsefehler |
| T46 | Independent alternative path | pass |
| T47 | Delete only reachable goal path | REQUIRED_NOT_DERIVED |
| T48 | All scoped truth hidden, no releases | fail |
| T49 | Equal supported competing answer | AMBIGUITY_POLICY_VIOLATION |
| T50 | must disambiguate two survivors | fail |
| T51 | may ambiguity nonrequired dimension | pass |
| T52 | may ambiguity required dimension | fail REQUIRED_AMBIGUOUS |
| T53 | Same fixture must→may | nicht strenger |
| T54 | Private canonical answer eliminates competitor shortcut | nicht erlaubt |
| T55 | Missing positive required literal proof | REQUIRED_NOT_DERIVED |
| T56 | Missing negative required literal proof | REQUIRED_NOT_DERIVED |
| T57 | Absent positive proof treated as negative | nicht erlaubt |
| T58 | Wrong polarity derived | NONCANONICAL_INFERENCE |
| T59 | Extra true irrelevant evidence | keine schlechtere Solvability |
| T60 | Extra unreachable evidence | kein neues PASS |
| T61 | Multiple responsible, both asked | beide Pflichtantworten belegen |
| T62 | Planner vs actor | keine implizite Rollenvertauschung |
| T63 | Complete nobody responsibility | nobody=true herleitbar |
| T64 | Partial nobody unresolved | nicht als false oder true erfinden |
| T65 | Complete competitor-domain generation | alle 2^n Vektoren |
| T66 | Hypothesis order deterministic | gleiche count/samples |
| T67 | Full responsibility with partial key | FULL_ANSWER_INCOMPLETE |
| T68 | Full answer missing positive required actor | POSITIVE_ANSWER_NOT_REQUIRED |
| T69 | Full answer missing person candidate | ANSWER_SCOPE_INVALID_FOR_QUESTION |
| T70 | Full answer missing nobody claim | ANSWER_SCOPE_INVALID_FOR_QUESTION |
| T71 | Awareness of person | keine Schuldprämisse |
| T72 | Known entity but unreleased evidence | keine observation |
| T73 | Exclusive branches one combined witness | INVALID_WITNESS, kein path union |
| T74 | Release set reordered | gleicher Report |
| T75 | Witness step order reversed with prerequisites | fail INVALID_WITNESS |
| T76 | Input mutated after parse | geparstes Profile unverändert |
| T77 | Output mutation attempt | TypeError / unverändert |
| T78 | Compile-time unknown Profile | kein branded Profile |
| T79 | Compile-time readonly nested arrays | Mutation Typfehler |
| T80 | Inputs repeated | tiefergebnisgleich |

### Metamorphic Properties (768 Konfigurationen, mindestens acht Checks je Konfiguration)

1. Adding unreached Evidence/record cannot turn fail into pass.
2. Removing a proof path cannot improve solvability (alternative paths dürfen erhalten bleiben).
3. Reordering set-like collections does not change status or finding identities.
4. Adding a canonically valid independent licensed path cannot break a PASS.
5. Circular/self-supporting edges alone never establish a required literal.
6. False NPC belief never automatically becomes objective premise.
7. may_remain_ambiguous is never stricter than must_disambiguate for otherwise identical inputs.
8. Reordering released record sets does not change status; ordered witness steps werden ausdrücklich NICHT permutiert.

Generator seed dokumentieren, 1..6 scoped Dimensionen, 0..64 observations, bounded edges/nodes. Sowohl PASS als auch FAIL müssen tatsächlich entstehen. Kein zufallsbasierter Runtimecode in Produktion; seeded Generator nur im Test.

## 12. Mutanten (acht Mindeständerungen)

| ID | Semantische Änderung | Killende Kriterien |
|---|---|---|
| M1 | Profil-/Witness-Bindingprüfung überspringen | T08–T12 |
| M2 | Canonical-status-Prüfung für OBSERVED überspringen | T20, T21 |
| M3 | Alle Literalnodes anfänglich established setzen | T34–T38 |
| M4 | Unreached Rootnode trotzdem initial etablieren | T25, T26, T47 |
| M5 | REPORTED-Literal wie OBSERVED-Literal automatisch seeden | T22–T24, T40 |
| M6 | PUBLIC_RULE-Payload-/License-Prüfung überspringen | T30–T33 |
| M7 | must_disambiguate wie may_remain_ambiguous behandeln | T50–T54 |
| M8 | Nur kanonischen Antwortvektor erzeugen / Konkurrenz vergessen | T48–T54, T65 |

Mutanten werden in Wegwerfkopien des implementierten Codes ausgeführt, keine kanonischen Änderungen. Vor Mutation Smoke tatsächliche Einzelanker dokumentieren; hier werden keine noch nicht existierenden Quellzeilen erfunden.

## 13. Limits und Non-Goals

≤400 Produktionszeilen, ≤5 Files. 1..6 Antwortdimensionen; ≤64 interne Hypothesen; ≤64 Rootkatalogeinträge; ≤128 Nodes und Edges; ≤256 geordnete Witnesssteps. Bounds vor graph traversal prüfen. Iterative fixed point; bounded cycle analysis; keine exponentielle Autorenliste.

Nicht: universeller Theorem Prover, allgemeine Solvability Engine für beliebige Cases, neue Mystery Claimarten, transitive kausale Regeln, spontane Rolle-aus-Anwesenheit, automatische NPC-Faktivität, Rule-Code aus Daten, Runtime LLM, Package-/UI-/Session-/PlayerRef-/Accessimplementation, Saveauthentizität, Gameplayexactnesswrapper oder Änderung von MYST-0002-Coreverdict.

Build-Time-LLM darf Profile entwerfen, niemals eigene Authoringlizenzen als unabhängig geprüft attestieren. Mensch reviewt die fallbezogenen Schlussregeln und ihre öffentliche Darstellung.

## 14. Abgabe

Produktionsdiff, Testresultate, 768-Konfigurations-Seed und Gegenbeispiele, Mutantreport mit 8+ kills, API-/Boundarydoc und eine Fixture mit positivem Proof sowie negativem konkurrierendem Beispiel. Keine direkte Spieler-Ausgabe der Findings. Kein eigenmächtiger Contract-/Ruleset-/GitHub-Write aufgrund dieses Drafts.

## 15. Reads auf der fixierten Basis

| Datei | Git-Blob |
|---|---|
| `src/domain/case-truth.ts` | `ecc698e23a59a603ffe8211baf2fc1209126e699` |
| `src/domain/case-truth.identity.ts` | `c8ee8f78faa0cf4e158ec4c9a48a1bbb4fd6be98` |
| `src/domain/case-semantics.ts` | `9dfac52ceed4e2f78d40b0983dd12b703db2dfb2` |
| `src/domain/case-solution.ts` | `f06adf21fdd3d2b55d23d87cb9ad4b7f10e7c281` |
| `src/domain/case-solution.identity.ts` | `ea5e1e4147607d6e4b274c3e93336ebbea4cdc7d` |
| `src/domain/npc-knowledge.ts` | `5671e141e43785d3b9eb1febf7ce15c057e6bb43` |
| `src/forge/contract-document.ts` | `8baed736d500eeb3a8f8ab63110f15dc7d5a1a4e` |
| `tests/case-solution.test.ts` | `b42f0219c53514d0ad5eefb73c1735d9b9798aed` |

MYST-0002 Draft als Designinput, SHA-256 des separat gelesenen Textes im Audit-Evidenceverzeichnis. Sein zukünftiger implementierter Blob ist UNKNOWN und muss vor Start gepinnt werden.
