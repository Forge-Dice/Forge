---json
{
  "forgeContractFormat": 1,
  "taskId": "MYST-SESSION-0001A",
  "contractVersion": 1,
  "baseCommit": "3d7545d843883418348004e68717399a64da7a7d",
  "dependencies": [
    {
      "taskId": "MYST-0001",
      "acceptedCommit": null
    },
    {
      "taskId": "MYST-0002",
      "acceptedCommit": null
    },
    {
      "taskId": "MYST-0003",
      "acceptedCommit": null
    },
    {
      "taskId": "MYST-0004",
      "acceptedCommit": null
    },
    {
      "taskId": "MYST-0005A",
      "acceptedCommit": null
    },
    {
      "taskId": "MYST-0005B",
      "acceptedCommit": null
    },
    {
      "taskId": "MYST-CHALLENGE-0001",
      "acceptedCommit": null
    },
    {
      "taskId": "MYST-SOLVABILITY-0001",
      "acceptedCommit": null
    }
  ],
  "scope": {
    "create": [
      "src/domain/case-package.ts",
      "src/domain/case-package.identity.ts",
      "src/domain/player-knowledge.ts",
      "tests/case-package.test.ts",
      "tests/case-package.identity.test.ts",
      "tests/player-knowledge.test.ts",
      "tests/case-package.fixture.ts",
      "tests/case-package.typecheck.ts"
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
# MYST-SESSION-0001A — Package / PlayerKnowledge V1

**DRAFT. Nicht registriert, nicht freigegeben, auf dieser Basis nicht startbar. Kein Implementierungsauftrag durch dieses Lab.**

## Verbindlichkeit und Startgate

Dieser Contract verwendet ausschließlich das heute akzeptierte Format 1. dependencies.acceptedCommit=null ist absichtlich ungelöst, kein Dummy-Pin. Vor Architekturfreigabe alle Abhängigkeiten tatsächlich akzeptieren, Commits pinnen und baseCommit/contractVersion nach erneuter API-Prüfung revidieren. MYST-0001 ist ein nur sekundär belegter Taskname; vollständigen Contract/Ref-Adapter und Namespace vor Start prüfen. Task-ID nicht extern reserviert. Alte Scratch-Mocks sind kein Produktionsersatz.

Normativ sind die folgenden gemeinsamen Semantikabschnitte und die taskeigene Testmatrix. Nur der im Frontmatter aufgeführte Scope wird implementiert; gemeinsam beschriebene andere Taskteile werden importiert, nicht dupliziert. Keine bestehenden Dateien verändern. Neue Runtime- oder Dev-Dependencies verboten. Kein Import aus src/forge. Vorhandenes zod/node:crypto genügt.

## Ziel, API und Abgrenzung dieses Tasks

Implementiere ausschließlich resolveCasePackage, Componentidentitäten, die neuen JSON-Helfer und PlayerKnowledge-Typen/Helper. Runtimeexports in case-package.ts: PACKAGE_LIMITS, resolveCasePackage. Identity-/Knowledgeexports sind in der gemeinsamen Ergänzung definiert; alle dort genannten Typen exportieren. Kein Reducer, Save oder Solvability-Runner. Package.proof:null technisch zulässig; Publication-PASS nie aus Metadata ableiten.

## Reads / Source of truth

Aktueller main: src/domain/case-truth.ts, case-truth.identity.ts, case-semantics.ts, case-solution.ts, case-solution.identity.ts, npc-knowledge.ts, npc-knowledge.projection.ts sowie bestehende zugehörige Tests. Draft-Inputs: MYST-0002 FINAL CANDIDATE; MYST-0003; MYST-0004 vom 2026-10-04; MYST-0005A/B; MYST-CHALLENGE-0001; MYST-SOLVABILITY-0001. Die exakten SHA-256 der gelesenen Texte stehen im Evidenceinventar. Vor Start gelten akzeptierte Quellen statt dieser Draftannahmen; Abweichung → Contractrevision, keine API-Erfindung.

## 2. Package Identity

PROPOSED normativ: Eine Session ist exakt an EIN unveränderliches Package, EINE Challenge, EINE Presentation-Sprache und EINEN Ruleset gebunden. Der Host wählt das Package. Ein Save wählt keinen beliebigen Pfad, URL, Modulnamen oder ausführbaren Resolver.

```ts
type CasePackageIdentity = Readonly<{
  schemaVersion: 1;
  packageHash: string; // 64 lowercase hex
  rulesetVersion: "mystery-session-v1";
}>;
type EntityRef = {kind:"person"|"location"|"item"|"event"|"evidence"; id:string};
type InitialSetup = {
  schemaVersion:1;
  known: readonly EntityRef[]; // unique set; existing entities
};
// NEW trusted boundary contract, not an asserted MYST-0001 export:
type PackageRefSource = {
  caseId:string; truthHash:string;
  config:{profile:string; saltHex:string}; // exact profile name; 32 lowercase hex
  refFor(kind:EntityRef["kind"],id:string):string|null;
  resolve(ref:string):EntityRef|null;
};
```

PackageRefSource ist ein synchroner vertrauenswürdiger Adapter um den tatsächlichen PlayerRefIndex. Vor Produktionsstart muss seine Konstruktion gegen den vollständigen, akzeptierten PlayerRef-Contract festgelegt werden. Dieses Lab definiert absichtlich keinen alternativen Hash-Algorithmus. Ein gültiges syntaktisches Token beweist keine Autorisierung.

```ts
type CasePackageInput = {
  schemaVersion:1; rulesetVersion:"mystery-session-v1";
  truth:unknown; solution:unknown; access:unknown; presentation:unknown;
  catalogue:unknown;
  npcs:readonly {snapshot:unknown; profile:unknown}[];
  initial:InitialSetup; challenge:unknown;
  proof:null|{profile:unknown; releaseManifest:string};
};
// Trusted-only; output of resolveCasePackage, deeply readonly.
type ResolvedCasePackage = {
  identity:CasePackageIdentity;
  truth:CaseTruth; solution:CaseSolution;
  access:EvidenceAccessMap; presentation:EvidencePresentation;
  catalogue:QuestionCatalogue;
  npcs:readonly {snapshot:NpcKnowledgeSnapshot; profile:InterrogationProfile}[];
  initial:InitialSetup; challenge:AccusationChallenge;
  proof:null|{profile:CaseProofProfile; releaseManifest:string; releaseHash:string};
  refs: {refFor(kind:EntityRef["kind"],id:string):string|null;
         resolve(ref:string):EntityRef|null};
};
type PackageFinding = {code:"SHAPE"|"BINDING"|"REFERENCE"|"REF_MAPPING"|
 "LIMIT"|"PROOF_BINDING"; path:readonly(string|number)[]};
resolveCasePackage(input:unknown, source:PackageRefSource):
 | {ok:true; package:ResolvedCasePackage}
 | {ok:false; findings:readonly PackageFinding[]};
```

Resolver-Schritte: bounded JSON-like Input prüfen; Truth/Solution mit echten Parsern parsen; Semantic Validation muss für Veröffentlichung eine leere findings-Liste haben (das heutige SemanticFinding hat kein severity-Feld) (dieser Package-Resolver ist keine neue Semantik-Engine); Draft-Parser für Access, Presentation, Catalogue, NPC-Profile/Snapshots und Challenge verwenden. Alle Bindungen tatsächlich neu berechnen. Je NPC genau ein Profil + Snapshot mit derselben npcId; Duplikate ablehnen, leere NPC-Menge für technische Cases erlaubt. NPCs müssen existieren, aber nicht alle Personen müssen NPCs sein. Initial known muss vollständig referenzvalidiert sein; leere Menge erlaubt. Jeder initial bekannte Evidence-Ref bedeutet hier nur Awareness, KEINE Discovery und KEINE Inhaltsfreigabe.

Ref-Tabelle einmal für alle fünf Entity-Arten bauen. Jedes Ergebnis muss dem in 4/5B vorgeschriebenen Muster entsprechen, global injektiv sein und durch source.resolve exakt auf kind/id zurückführen. Unvollständige Tabelle, Kollision und falsche Rückauflösung sind Packagefehler. Kopierte Tabellen werden eingefroren; spätere source-Mutation oder Portwechsel wirkt nicht auf ein bereits aufgelöstes Package. Die Produktionsintegration darf einen anderen Ref-Namespace nur als neues Package laden.

Kein CasePackageIdentity.caseId nötig: der vollständige Identitätshash bindet es transitiv. Dadurch braucht der Save keine potentiell sprechende Case-ID oder private Solution-/Component-Hashes. Der Host kann außerhalb des Save einen menschenlesbaren Titel anzeigen. Packageidentity ist kein Geheimnis und keine Signatur.

### Komponenten und kanonische Identität

H(tag,x) = SHA-256 UTF-8(tag + LF + C(x)). C ist ein NEUES strukturelles JSON-Profil: Objektschlüssel rekursiv nach UTF-16-Codeeinheiten sortieren; Arrays in ihrer vorhandenen Reihenfolge erhalten; JSON.stringify-Primitivdarstellung, kein Whitespace, keine Normalisierung, nur wohlgeformte Unicode-Strings und endliche sichere Integer für die hier neu eingeführten Zahlen. Ein globales „alle Arrays sortieren“ ist für Save/Witness falsch. Mengen werden ausschließlich an den folgenden typisierten Grenzen vorher sortiert und auf Duplikate geprüft.

| Komponente | Autoritative Bytes / Normalisierung |
|---|---|
| truthHash / solutionHash | existierende hashCaseTruth / hashCaseSolution unverändert; diese behandeln ihre Domainarrays als Mengen |
| accessHash / presentationHash | jeweiliger Draft-Hash; Presentation.text vollständig enthalten |
| catalogueHash / profileHash | hashQuestionCatalogue / hashInterrogationProfile; keine eigene Kopie dieser Kanonisierung |
| snapshotHash | NEW H("forge-npc-snapshot-v1", snapshot mit awareness/attitudes nach C sortiert); kompletter geparster Snapshot einschließlich revision, asOf, acquiredAt, provenance und Bindungen. Keine sonstigen Arrayfelder. |
| npcBundleHash | NEW H("forge-session-npcs-v1", nach npcId sortierte Einträge {npcId,snapshotHash,profileHash}); npcId unique |
| initialHash | NEW H("forge-session-initial-v1", initial mit known nach kind/id sortiert) |
| challengeHash | NEW H("forge-session-challenge-v1", Challenge mit allowedClaims nach claimKey sortiert); Challenge-Draft hat noch keinen Hash |
| refsHash | NEW H("forge-session-refs-v1", {config,caseId,truthHash,mapping}); mapping ist die vollständige nach kind/id sortierte {kind,id,ref}-Tabelle. Verwendet die tatsächlichen PlayerRef-Ausgaben, keinen angenommenen Algorithmus. |
| releaseContextHash | NEW H("forge-session-release-context-v1", {rulesetVersion,truthHash,solutionHash,accessHash,presentationHash,catalogueHash,npcBundleHash,initialHash,refsHash,challengeHash}) |
| releaseHash, falls proof vorhanden | NEW SHA-256 UTF-8("forge-session-release-v1\n" + releaseManifest). releaseManifest ist kanonisches JSON C mit festem Envelope {schemaVersion:1,releaseContextHash,adapterVersion,certificateData}; kein packageHash/proofHash, kein ausführbarer Code. certificateData ist bounded authoring JSON, KEINE ausführbare Runtime-Policy und keine Solvability-Autorität. |
| proofHash | NEW H("forge-session-proof-v1", vollständiges geparstes ProofProfile), mit ausschließlich answerScope/observations/nodes/edges/allOf/rules als typisierten Mengen sortiert; witnessStepIds strikt geordnet. Alternativ konservativ C ohne Mengennormalisierung zulässig? NEIN: Vertrag fordert die hier genannten Pfade exakt. |
| packageHash | NEW H("forge-case-package-v1", {schemaVersion:1,rulesetVersion,releaseContextHash,releaseHash:null|string,proofHash:null|string}) |

Hash-DAG: Komponenten → releaseContextHash → releaseManifest/releaseHash → ProofProfile.bindings.releaseHash → proofHash → packageHash. Kein Packagehash im eigenen Input, kein Identity-Hash im PlayerRef-Adapter-Input dieses Contracts. Falls der tatsächliche PlayerRef-Draft eine vollständige Packagehash-Abhängigkeit verlangt, ist das ein expliziter Reconciliation-Blocker: vor Start muss ein vorgelagerter, eigenständiger Ref-Namespace vereinbart werden. Nicht durch einen Fixed-Point-Hash oder leeren Dummyhash umgehen.

ResolvedCasePackage ist kein Transport-DTO. Funktionen und private Dokumente gehen nie an UI oder Save. Der Factory-Output erhält eine toJSON-Methode, die wirft; strukturierte Clones scheitern an Funktionen. Das ist Unfallschutz, keine Sandbox gegen vertrauenswidrigen Hostcode. Public output wird aus einem eigenen Allowlist-DTO konstruiert.

### Proof-Bindung ohne vorgetäuschte Zertifizierung

Package A parst das ProofProfile mit dessen echtem Parser, prüft T/S-Bindungen, berechnet releaseHash und verlangt dessen exakte Übereinstimmung mit profile.bindings.releaseHash. Im Manifest muss releaseContextHash stimmen. Der Resolver führt certificateData NICHT aus und behauptet niemals „solvable“, nur „gebunden“. proof:null ist für technische Sessiontests zulässig; ein veröffentlichter Vitrine-Slice braucht einen separaten positiven echten Witness-Lauf.

Der Solvability-Port gehört in die Fall-Abnahme: witnessStepIds → ausdrücklich authored endliche Eventtabelle → replaySession desselben Packages → Release-Trace. Evidence-Report und NPC-Observation werden anhand exakter freigegebener Payloads auf Profile-Observationen gemappt. OBSERVED erfordert eine separate reviewte Faktivitätslizenz; source=observation allein reicht nicht. REPORTED_BY_NPC wird aus affirms/denies und dem passenden Claim erzeugt, nicht aus interner knowledge/belief; uncertainty darf nicht als Boolean-Bericht erfunden werden. PUBLIC_RULE braucht ein wirklich veröffentlichtes Regelpayload. Profile.observations dürfen niemals einfach als Replayausgabe zurückgegeben werden.

UNKNOWN/BLOCKER: Der aktuelle Draft liefert keinen vollständigen standardisierten Zertifikats-/Public-Rule-Präsentationsadapter. Dieses Lab erfindet ihn nicht als vorhandene API. Das Manifest bindet die später reviewten Adapterdaten und deren Version; der echte Vitrine-Witness ist eine Publikationsabnahme, kein vierter Session-Produktionstask. Ein Stub-PASS reicht nicht. Änderung von certificateData/Adapterversion invalidiert Package und Save.


### Ergänzung: genaue A-Helfer und größenbedingte B/C-Abhängigkeit

PROPOSED normativ. player-knowledge.ts exportiert Typen KnownEntity, ObservationRecord, PlayerKnowledge sowie initialPlayerKnowledge(pkg), recordEvidence(knowledge,observation,eventIndex), recordInterrogation(knowledge,observation,eventIndex). Initial überführt ausschließlich pkg.initial.known mit pkg.refs; recordEvidence nimmt die Evidence selbst und Mentions auf, entdeckt genau einmal; recordInterrogation nimmt ausschließlich Mentions auf und hängt jeden Empfang an. Alle drei geben eine neue deeply frozen Kopie zurück, keine Mutation. Sie sind trusted-only und werden erst nach vollständiger Port-/Ref-Validierung von B verwendet. Eine reine helper-Funktion darf keine Eigenautorität zum Evidence-Release erhalten.

case-package.identity.ts exportiert serializeSessionJson(value) für das beschriebene C, hashSessionJson(profile,value) für H sowie die konkreten package-internen Componenthashfunktionen. Keine Nutzung des Truth-Serializers für Historien. Die JSON-Safety-Prüfung validateSessionJson(value,{maxDepth,maxNodes}) arbeitet iterativ und meldet Limit/Shape vor rekursiver Serialisierung; keine Caller-konfigurierbare Semantik, nur die hier festgelegten Konstanten. Sie wird in A/C wiederverwendet und gehört zum A-Zeilenbudget. Plain JSON bedeutet keine Funktionen, undefined, Symbole, BigInt, NaN/Infinity, unsichere Integer, Accessoren, Zyklen oder fremde Prototypen. Fremder ausführbarer JS-Code, der Proxies liefert, ist keine unterstützte untrusted Schnittstelle.

B prüft die prospektive Savegröße ohne Import von C: C({schemaVersion:1,packageIdentity:pkg.identity,events:prospectiveEvents,checksum:"0".repeat(64)}) in UTF-8. Alle echten Checksums sind genau 64 ASCIIzeichen; die Länge ist deshalb exakt. C verwendet denselben Serializer und dieselbe Envelopeform. Kein Dependencyzyklus. B kann den Check vor vollständiger Gameplayauswertung ausführen, sobald ein Event geparst ist; die Abnahme/Commitentscheidung bleibt nach allen Portprüfungen atomar.

Strict private Packageinput-JSON darf proof.releaseManifest als String enthalten. Dessen nach JSON.parse geprüfter Envelope hat exakt schemaVersion/releaseContextHash/adapterVersion/certificateData; adapterVersion ASCII [a-z][a-z0-9._-]{0,63}, certificateData ausschließlich bounded JSON. A akzeptiert ihn als gebundenes authoring artifact und führt weder Witness noch Zertifikatsinterpretation aus. Nicht vorhandener standardisierter Adapter bleibt eine ausdrücklich spätere Fall-Abnahme, kein stillschweigender Solvability-PASS.

## 3. PlayerKnowledge

PROPOSED: PlayerKnowledge V1 ist ein quellengebundenes Informationsjournal, kein Set objektiv wahrer Propositionen und keine neue menschliche Logik-Engine.

```ts
type KnownEntity = {kind:EntityRef["kind"]; ref:string;
  firstSeen:{kind:"initial"}|{kind:"event";eventIndex:number}};
type ObservationRecord =
 | {source:{kind:"evidence";eventIndex:number;evidence:string};
    observation:EvidenceObservation}
 | {source:{kind:"npc";eventIndex:number;npc:string;questionId:string};
    observation:InterrogationObservation};
type PlayerKnowledge = {
  schemaVersion:1;
  known:readonly KnownEntity[];
  discoveries:readonly {evidence:string;firstDiscoveryEvent:number}[];
  observations:readonly ObservationRecord[];
};
type VerdictRecord={eventIndex:number;verdict:"solved"|"not_solved"};
type SessionState={identity:CasePackageIdentity;phase:"active"|"solved";
  events:readonly SessionEvent[];knowledge:PlayerKnowledge;
  verdicts:readonly VerdictRecord[]};
```

eventIndex ist nullbasiert im akzeptierten Log. Keine eingehende seq, kein Timestamp, kein Versuchszähler als separate Autorität. Bekannte Entities nach ref sortieren; erste Herkunft bleibt erhalten. Discoveries nach evidence-Ref sortieren; erste Fundaktion bleibt erhalten. Observations chronologisch; bei mehreren Evidence-Funden derselben Aktion nach öffentlichem Evidence-Ref sortieren. NPC-Wiederholungen erzeugen je einen ObservationRecord, weil es zwei Gesprächsereignisse sind. Der Payload bleibt gleich bei gleichen Inputs. Wiederholte Suche erzeugt ein Event, aber keinen zweiten Discovery-/EvidenceObservation-Eintrag. Eine Summary-Ansicht darf identische Berichte gruppieren, bleibt rein abgeleitet.

Nur initial.known, neu veröffentlichte Evidence selbst und observation.mentions vergrößern Known. Kein Nachziehen aus Evidence.source/links, Report.claim, Truth/Eventpartizipanten, Solution, interner NPC-Awareness oder NPC-Provenance. Die Release-Module garantieren Referenzabdeckung; Session verlangt zusätzlich jede freigegebene Mention rückauflösbar, artkorrekt und paketgebunden. Ein referenzierter Report-Claim außerhalb der erlaubten Mentions ist ein Host-Invariantfehler, keine Gelegenheit zum stillen Freischalten.

Observation provenance ist Spieler-Empfangsherkunft: WANN im akzeptierten Log, WELCHE Evidence oder WELCHER NPC und WELCHE Frage. NPC internal provenance (witnessed_event/told_by_person etc.) bleibt privat. EvidenceObservation.reports[].source ist eine freigegebene Aussagequelle und bleibt erhalten, kann aber weder als objective truth noch als interner NPC-Erkenntnisweg verwendet werden. Widersprüchliche NPC-Berichte koexistieren. Leans/uncertain/does_not_know/decline sind jeweils genau der Draft-Payload. Kein automatisches Überschreiben früherer Reports und kein automatischer Faktengewinn.

Keine PlayerKnowledge-Loadfunktion aus untrusted JSON. Verlässlicher Zustand entsteht durch initialSession und Reducer/Replaying. Eine TypeScript-Brand ist nur Typdisziplin, keine Authentisierung. Server-Host bzw. headless Runner verwaltet den Zustand; direkt manipulierter JS-Heap ist außerhalb dieser Vertrauensgrenze.

## 4. Event Vocabulary

PROPOSED exakt drei strikt geparste Shapes, keine optionalen semantischen Felder:

```ts
type SessionEvent =
 | {type:"investigate";action:"search_location"|"examine_item"|"examine_person";target:string}
 | {type:"interrogate";npc:string;questionId:string}
 | {type:"accuse";literals:readonly {claim:PlayerConclusionClaim;value:boolean}[]};
type PlayerConclusionClaim =
 | {kind:"personResponsibleForEvent";person:string;event:string}
 | {kind:"personRoleForEvent";person:string;event:string;role:"direct_actor"|"planner"|"facilitator"}
 | {kind:"noPersonResponsibleForEvent";event:string}
 | {kind:"eventCausedEvent";causeEvent:string;event:string}
 | {kind:"eventIntent";event:string;value:"intended"|"unintended"|"not_applicable"}
 | {kind:"eventMechanism";event:string;value:"ordinary"|"supernatural"|"mixed"};
```

Refstrings erfüllen das Draft-Muster /^pr1_[0-9a-hjkmnp-tv-z]{16}$/. questionId übernimmt QuestionIdSchema aus 5A; keine frei erfundene Frage. Der PlayerConclusionClaim enthält genau die sechs Conclusion-Arten aus dem neunfachen 5B-PlayerClaim. Session überträgt sie feldweise in Canonical-IDs; das ist Transportkonversion, keine neue Statusauflösung. Die sechs Varianten müssen explizit getestet werden. role/value heißen wie im Original; das äußere literal.value bleibt Boolean.

Einzelnes Event ≤16 KiB kanonisches UTF-8; maximal 32 Literale. Claims innerhalb einer Accusation behalten Eingabereihenfolge. Duplikate/Widersprüche derselben Claimstruktur werden durch parseAccusation abgewiesen, nicht zusammengelegt. Keine clientseitigen truthHash/caseId/challengeId/solutionHash-Felder. Leere Anklage ist als syntaktisch gültiges Event zulässig und ergibt abhängig von der echten Challenge/Core-Semantik einen Verdict; keine frei erfundene Sonderregel. Package-Publikation verlangt für den ersten Fall mindestens eine requiredConclusion und nichtleeren Challenge-Scope.

Vorhandensein und Kind jedes Ref müssen passen UND jedes eingehende Entity-Ref muss bereits im Known des Präfixes liegen. Das betrifft auch event/causeEvent in Accusations. Alle gültigen, aber unbekannten Refs werden genauso abgewiesen wie nicht existente Refs. Keine Token-Auflösung gewährt selbst Known. Nicht verfügbare Fragen und unbekannte NPCs ergeben dasselbe öffentliche ACTION_UNAVAILABLE.

## 5. Reducer

```ts
initialSession(pkg:ResolvedCasePackage):SessionState;
reduceSession(pkg:ResolvedCasePackage,state:SessionState,input:unknown):
 | {ok:true;state:SessionState;output:SessionOutput}
 | {ok:false;state:SessionState;code:"ACTION_UNAVAILABLE"|"SESSION_CLOSED"|"LIMIT_REACHED"}
 | {ok:false;state:SessionState;code:"HOST_FAILURE"}; // trusted-only branch
type SessionOutput =
 | {type:"investigate";observations:readonly EvidenceObservation[]}
 | {type:"interrogate";observation:InterrogationObservation}
 | {type:"accuse";verdict:"solved"|"not_solved"};
```

HOST_FAILURE wird im Playertransport in eine allgemeine technische Nichtverfügbarkeit übersetzt, niemals in not_solved oder Domain-IDs. Detaillierter interner Diagnosepfad ist nur für Tests/Hostlog. Resultate sind neu konstruiert und tief readonly/frozen; bei Ablehnung dieselbe unveränderte State-Referenz zurückgeben. Trusted Portthrows können am äußeren Session-Einstieg in HOST_FAILURE gefangen werden; keine behauptete Isolation bösartigen Hostcodes.

Normative Reihenfolge: (1) Package-/Stateidentity prüfen → HOST_FAILURE. (2) solved → SESSION_CLOSED für jede Eingabe, ohne irgendeinen Gameplayport aufzurufen. (3) Historylimit → LIMIT_REACHED. (4) Raw-Event-Limits und Shape; Refauflösung, Kind und prefix-Known. (5) Ports synchron auf temporärem Zustand auswerten. (6) alle Releases, Refbindings, Outputlimits und vollständigen Prospective-Save-Bytes prüfen. (7) einmal atomar neuen State und Event publizieren. Fehler in einem von mehreren Releases führt zum vollständigen Rollback, einschließlich Known und Discovery.

investigate: target auflösen; exakte Canonical-Action mit locationId/itemId/personId aufbauen; known als Canonical EntityRef[] aus dem Präfix; resolveInvestigation verwenden. Neue IDs = found minus discoveries. Found muss existierende Evidence sein; Übersetzung vor öffentlicher Sortierung. Für alle neuen IDs releaseEvidence aufrufen, deren Output validieren; erst dann Evidence+Mentions und Records übernehmen. Leere Ergebnisse und bereits komplett entdeckte Suchresultate sind akzeptierte Aktionen. Keine cascading Investigation in derselben Aktion: ein dadurch bekannt gewordenes Item verlangt ein nächstes Event.

interrogate: NPC muss als person bekannt und mit Snapshot/Profil im Package vorhanden sein. Snapshot/Profil auswählen; catalogue, refs, prefix-known, questionId an interrogate übergeben. QUESTION_NOT_AVAILABLE wird ACTION_UNAVAILABLE; Binding/Ref-Fehler werden HOST_FAILURE. Erfolgreiche decline/does_not_know sind akzeptierte Beobachtungen, keine Fehler. Der Reducer liest nie internen NPC-Stance zur eigenen Antwortentscheidung.

accuse: alle Claims übersetzen, parseAccusation({schemaVersion:1,caseId:pkg.truth.caseId,truthHash:hashCaseTruth(pkg.truth),literals},pkg.truth), dann evaluateChallengeAccusation mit exakt pkg.challenge. Gültiges not_solved wird geloggt und lässt phase active. solved wird geloggt, phase solved. Technische Core-/Challengefehler werden nicht als Fehlanklage verschleiert. Es gibt keinen frei wählbaren Core-only-Modus.

Terminal: nach dem ersten solved keine weiteren akzeptierten Events, auch keine Beobachtungen, Fehlanklagen oder leeren Suchen. Views/Save dürfen weiter gelesen werden. Replay eines Logs mit Events nach solved ist INVALID_HISTORY; niemals abschneiden. Wiederholtes Event bedeutet keine Netzwerk-Retry-Idempotenz. Ein eventId-/Idempotency-Key-Feature gehört nicht in V1; ein Transport muss unbestätigte Requests bewusst behandeln.

## 6. Challenge Integration

DESIGN INPUT + PROPOSED: Der Spieler liefert die Antwort, der Host wählt die Challenge. Ein Package enthält genau eine Challenge. Dadurch braucht accuse kein challengeId und kann nicht auf einen leichteren Scope umschalten. Derselbe Truthzustand mit anderer Challenge oder Solution erhält anderen packageHash und inkompatiblen Save.

Challenge-Result solved ist die einzige technische Siegbedingung im V1-Sessionloop. Known autorisiert verwendete Entitäten, aber nicht die Wahrheit der Behauptungen. Kein Nachweiszwang, keine inferred journal facts, keine Solvability-Abfrage pro Anklage. Undetermined ist weiterhin ein legitimer Core-Status, der im Challenge-Wrapper eine eingereichte Antwort nicht erfüllt.

CASE-SPECIFIC CHANGE REQUIRED: Die Vitrine verlangt im bisherigen Scratch-Host requireReleasedProof und zitierte Evidence. Der aktuelle Challenge-Draft kann das nicht ausdrücken. Empfehlung für den minimalen Slice: Belege zum Deduzieren anbieten, aber diese zusätzliche technische Siegsperre entfernen; die vollständige vierteilige Täterantwort bleibt erforderlich. Ein UI kann eine Auswahl deterministisch in vier positive/negative Rollenliterale expandieren, jedoch ist das eine ausdrücklich festzulegende UI-Konvention, keine neue Session-Aktion. Wer die Belegpflicht behalten will, braucht zuerst einen eigenen, kleinen Challenge-Policy-Contract; dieses Paket aktiviert sie nicht durch versteckte Sessionbedingungen.

EXPERIMENTALLY VERIFIED im Scratch-Modell: Die richtige vollständige Antwort kann im Initialzustand solved ergeben. Das ist kein Replayfehler, sondern die konkrete verbleibende Produktentscheidung. Brute-force über mehrere komplette Antworten wird weder durch neutrale Core-Truth noch durch Exactness allein verhindert. Für den ersten Slice akzeptabel nach expliziter Case-Spec-Korrektur; kein Anti-Cheat-Claim.

## 7. Interrogation Replay

PROPOSED: Jeder Replay beginnt mit initialSession desselben aufgelösten Packages. NPC, questionId und Known werden aus Event und Präfix rekonstruiert. Bei jedem akzeptierten interrogate läuft die echte 5B-Pipeline erneut: projectNpcKnowledgeWithBridge → decideResponse → ReleaseTranslator → InterrogationObservation. Bridgeobjekte sind frisch und bleiben transient. Kein VisibleRef, kein lokaler Index, kein ResponseDecision, keine frühere Antwort und kein NPC-Provenance-Dump wird persistiert.

Snapshots ändern sich in diesem V1 nicht mit Sessionevents. asOf ist der im Package eingefrorene NPC-Zeitpunkt, keine Sessionuhr. Player-Known beeinflusst Askability; es überschreibt nicht NPC-Wissen. Zwei Replays mit denselben Komponenten und demselben Ruleset müssen dieselben Antworten liefern. Ein verändertes NPC-belief, eine Revision, ein Provenancefeld oder ein Profil erzeugt neue Identität; auch wenn einzelne Antworten zufällig gleich bleiben. Keine heuristische Rückwärtskompatibilität.

```ts
replaySession(pkg:ResolvedCasePackage,events:unknown):
 | {ok:true;state:SessionState}
 | {ok:false;code:"INVALID_HISTORY"|"LIMIT_REACHED"|"HOST_FAILURE";
    eventIndex:number|null};
```

Replay prüft zunächst Collection-/Bytelimits, dann denselben Reducer in Reihenfolge. Beim ersten abgewiesenen Event abbrechen; keine Teilzustände an Spieler und keine Fortsetzung hinter einem ungültigen Präfix. eventIndex ist eine interne Diagnose und wird nicht mit privaten Codes öffentlich erklärt. Replay verschluckt abgewiesene Events NICHT. Ein akzeptiertes Log enthält definitionsgemäß nur Inputs, die damals am jeweiligen Präfix akzeptiert wurden.

## 8. Save Format

PROPOSED normativ:

```json
{"schemaVersion":1,"packageIdentity":{"schemaVersion":1,"packageHash":"<64hex>","rulesetVersion":"mystery-session-v1"},"events":[],"checksum":"<64hex>"}
```

Der Block zeigt das Shape, nicht die kanonische Schlüsselreihenfolge. Tatsächliche Wireform ist C(envelope), dessen Schlüssel nach UTF-16 sortiert sind. Body = Envelope ohne checksum. checksum = H("forge-session-save-v1",body). rulesetVersion steht genau einmal in packageIdentity; keine zweite potentiell widersprüchliche Version. Keine Derived-Felder, kein solved, keine NPC-Observationen, kein bekanntes Entityset, keine Verdicts, keine Evidence discoveries.

```ts
encodeSessionSave(pkg:ResolvedCasePackage,state:SessionState):
 | {ok:true;text:string}|{ok:false;code:"INVALID_STATE"|"LIMIT_REACHED"|"HOST_FAILURE"};
decodeSessionSave(pkg:ResolvedCasePackage,text:unknown):
 | {ok:true;state:SessionState}
 | {ok:false;code:"INVALID_SAVE"|"INCOMPATIBLE_PACKAGE"|"LIMIT_REACHED"|
   "CHECKSUM_MISMATCH"|"INVALID_HISTORY"|"HOST_FAILURE"};
```

Encode vertraut keiner übergebenen Derived-Kopie: Packageidentity prüfen, accepted events mit replaySession neu ableiten, resultierende Derived-Sicht mit dem State vergleichen. Abweichung → INVALID_STATE. Erst dann Body/Checksum aus Identity und Events bilden. Das ist eine Konsistenzprüfung innerhalb trusted Hostcode, keine Signatur. Alternativ still eine beschädigte State-Sicht zu reparieren ist hier ausdrücklich nicht der Contract.

Decode: Stringtyp und UTF-8-Bytelimit; JSON.parse in try; iterativer Plain-JSON-Depth/Node/Unicode/number-Check; exact root/nested Shapes; Serialisierung C(parsed) muss exakt Eingabestring ergeben. Damit werden Whitespacevarianten, doppelte JSON-Keys, Escapeschreibvarianten, BOM und -0 statt 0 fail-closed abgewiesen, ohne einen eigenen JSON-Parser zu bauen. Kanonische Saves sind kein allgemein tolerant editierbares JSON-Importformat. Dann Versions-/Packagevergleich, Checksumprüfung, Replay. Jeder Schritt arbeitet auf geparsten eigenen Daten, nicht mehrfach auf unbekannten Getterobjekten. JSON mit unpaired surrogate ist ungültig; keine Unicode-Normalisierung. Checksummenvergleich braucht kein Geheimnis und keine Timing-Schutzbehauptung.

Ein gekürzter, neu korrekt checksummierter gültiger Verlauf ist ein gültiger früherer Save. Eine neu erzeugte ebenfalls gültige Historie ist ebenfalls gültig. Akzeptierter Eventinhalt kann geändert und neu gehasht werden; wenn Replay ihn akzeptiert, wird er geladen. Das ist gewollte Grenze dieses lokalen V1-Saveformats.

## 9. Compatibility

PROPOSED: V1 verwendet exact-package/exact-ruleset. Keine Migration, kein „best effort“, kein Überspringen von Events und kein automatisches Upgrade auf das neueste Package. Ein Host kann alte Packages und den passenden Ruleset getrennt archivieren und Saves gegen genau diese Version laden. Ist sie nicht vorhanden, lautet das Ergebnis inkompatibel/unverfügbar, nicht beschädigt.

| Änderung | V1 Save |
|---|---|
| Truth, Solution, Access, Challenge oder initial known | invalidieren |
| NPC-Snapshot/Profil/Catalogue, auch nur private Provenance | invalidieren; konservativer Snapshotvertrag |
| Presentation.text, Leerzeichen, NFC/NFD, Report, Mention | invalidieren |
| Zertifikatsmanifest, ProofProfile, Witnessreihenfolge | invalidieren |
| PlayerRef-Salt/Profil oder tatsächliche Mappingtabelle | invalidieren |
| Ruleset-Verhalten oder geänderte Auswahl-/Release-/Verdictlogik | neue rulesetVersion + neue Packageidentity erforderlich |
| Sourcecode-Refactoring mit unveränderter spezifizierter Semantik | keine Änderung nötig; Regression-/Golden-Tests Pflicht |
| Sortierung einer ausdrücklich mengenartigen Component-Collection | keine Änderung nach typisierter Normalisierung |
| Reihenfolge der Events oder witnessStepIds | immer signifikant |
| UI-Schrift, Layout, Codeformatierung außerhalb Package | unverändert |

Textänderungen invalidieren HEUTE zu Recht: Evidence Presentation hash bindet Text, und Text kann Hinweise, Negationen oder Zeitangaben ändern. Aus „nur kosmetisch“ ist mechanisch keine sichere semantische Klassifikation ableitbar. Schon CaseTruth.name/description sind Teil des heutigen Truthhash; blindes Strippen wäre eine neue Domänenidentität, keine Sessionoptimierung.

Lokalisierung später: stabiler semantischer Contentkern + getrennte Locale-Bundles mit versionierten message keys, Parametern und Review gegen dieselben Release-Reports. Dann könnte gameplayIdentity gleich und displayIdentity verschieden sein. Das verlangt eine ausdrückliche MYST-0004-/CaseTruth-Identitätsrevision und Replaydefinition: semantisch gleich versus wortgleich. Für V1 ein Package pro Sprache. Keine automatische Übersetzung und kein Runtime-LLM.

## 10. Security Boundary

IMPLEMENTED/DESIGN INPUT Grenzen bleiben erhalten. Trusted: geparste Domainkomponenten, Packageprovider, Ref-Adapter, Domainmodule, Rulesetcode, reviewed Authoring. Untrusted: Sessionevent-JSON und Save-String. Client liefert niemals den trusted Packageinput als Autorität. Opaque Refs reduzieren versehentliche ID-Spoiler, sind aber keine Secrets oder Capability-Tokens.

Session autorisiert jeden eingehenden Ref gegen prefix-Known, sperrt direkte Evidence-Release-Aufrufe aus Spielerinput und nimmt nur explizite Mentions auf. Malformed/fremde/stale/unbekannte Refs erhalten dieselbe Actionfehlermeldung. Keine internen Bindings oder private Solverdiagnosen in Spieleroutput. Public Observation kann nach Authoring trotzdem einen narrativen Spoiler enthalten; Textreview bleibt nötig. questionId kann selbst sprechend sein: opaque neutrale IDs wie question:q08 sind Autorenkonvention, kein durch Session gelöstes Problem.

Checksum erkennt versehentliche Beschädigung, nicht gezielte Neuberechnung. Keine Anti-Cheat-, Autorenvertrauens-, Origin- oder Serverauthentizitätsgarantie. Signierte Saves, Online-Autorität, Geheimhaltung lokaler Assets, Manipulationsschutz des JS-Heaps und Netzwerk-Retryschutz sind Non-goals. Kein pauschales „Save sicher“.

## 11. Resource Limits

PROPOSED konservative Budgets, keine Performance-Messwerte und keine universelle Fallgrößengrenze. Sie gelten zusätzlich zu strengeren Componentlimits. Die Vitrine braucht fünf zentrale Untersuchung/Befragungsaktionen, 20 Fragen und 8 Evidence: deutlicher Spielraum ohne offene Endlosschleifen.

| Grenze | Wert / Grund |
|---|---|
| accepted events | 512. Über 25 vollständige Runden aller 20 Fragen; begrenzt Replay und NPC-Observationswachstum |
| Anklageliterale pro Event | 32, deutlich über vier Pflichtliteralen, unter Challenge-Scope-Maximum 256; keine Veränderung der Core-API |
| Eventbytes | 16 KiB UTF-8, ausreichend für 32 streng geformte Claims; Inputbudget vor tiefer Validation |
| Savebytes | 1 MiB UTF-8, global verbindlich; 512×16KiB ist NICHT automatisch zulässig. Reducer prüft Prospective-Savegröße vor Annahme, damit jeder akzeptierte Zustand speicherbar bleibt |
| Raw Package JSON | 2 MiB vor Domainparse; ref source ist separater trusted Port |
| Package Entities insgesamt | 256 über fünf Ref-Arten, initial known höchstens 256, keine unbekannten Initialrefs |
| Evidence / NPCs / Fragen | 64 / 16 / 128; je NPC höchstens 128 Regeln; stets Componentlimits zusätzlich |
| Accesspfade pro Evidence | 16; 64×16 begrenzt linearen Resolver für diesen Slice |
| Presentation | bestehende 1000 UTF-16 units/Text, 16 Mentions, 8 Reports beibehalten; kein zusätzlicher Freitext pro Event |
| neue/abgeleitete Observationen | ≤512 NPC-Records +64 einmalige Evidence-Records =576; Known ≤256 |
| JSON-Tiefe / Knoten | 32 / 100000 für Package und Save; iterativ prüfen, bevor rekursive Canonicalizer/Validatoren laufen |
| Proof | bestehende Maxima: 6 Answerdimensionen, 64 Observations, 128 Nodes/Edges, Witness 256; releaseManifest ≤256 KiB innerhalb Packagebudget |
| Hashes / salt | 64 lowercase hex / 32 lowercase hex; kein Nullplaceholder als automatisch freigegebene Referenz |

Zeitlimits in Millisekunden werden nicht Teil des deterministischen Reducers. Ein äußerer Test-Runner kann hängenbleibende trusted Ports abbrechen; der synchrone Runtimevertrag lässt keine fremden Scripts zu. Hashes und Refindizes werden einmal beim Package-Resolve gebaut, nicht pro Historyprefix neu. Bei 512 Events ist simples Replay vor Encode vertretbar; keine Snapshots oder inkrementellen Savechains nötig. Tatsächliche Laufzeit-/Speichermessung folgt mit echten Modulen. Die hier gemessene Python-Labzeit ist kein Produktionsbenchmark.


### Save-Hash-Golden-Vektoren

EXPERIMENTALLY VERIFIED: dieselben Bytes unabhängig in Python hashlib und Node crypto geprüft. order-a/order-b sind isolierte Kanonisierungstests, keine vollständigen Save-Envelope-Fixtures.

**empty**

```json
{"events":[],"packageIdentity":{"packageHash":"0000000000000000000000000000000000000000000000000000000000000000","rulesetVersion":"mystery-session-v1","schemaVersion":1},"schemaVersion":1}
```

SHA-256 von `forge-session-save-v1\n` + diesen Bytes: `58a1857b0b76ba1f342237261c2d4c9877f7cc7bb2a78c116d8e1ecebdc6875f`.

**order-a**

```json
{"events":[{"npc":"pr1_0000000000000001","questionId":"question:q01","type":"interrogate"},{"action":"search_location","target":"pr1_0000000000000002","type":"investigate"}]}
```

SHA-256 von `forge-session-save-v1\n` + diesen Bytes: `34070a1340d5d69359930e4c7549045873aa4c370831e127afd10c91a62095af`.

**order-b**

```json
{"events":[{"action":"search_location","target":"pr1_0000000000000002","type":"investigate"},{"npc":"pr1_0000000000000001","questionId":"question:q01","type":"interrogate"}]}
```

SHA-256 von `forge-session-save-v1\n` + diesen Bytes: `3004ef17c2a6cba8f8f67fd0fb1d51f11722e00ef36c5bca97a21a2bc5799dc1`.



## Acceptance Criteria dieses Tasks

1. Alle 40 nachfolgenden Fälle sowie relevante gemeinsame Invarianten mit realen Dependencies grün; typecheck und bestehende vollständige Testsuite grün. Keine Tests löschen/skippen.
2. Nur Scope-Dateien; keine neue Dependency; Ziel 340–399 Produktionszeilen, lesbarer Code. Wenn <400 nicht seriös möglich: Contractrevision vor Scopeerweiterung, keine Golf-Lösung.
3. Alle Input/Output-Grenzen frozen/eigene Kopie; keine Mutation und keine heimliche Zeit/Zufallsabhängigkeit.
4. Kein Runtime-LLM, kein I/O im Domainpfad außer SHA-256, keine Dateipfad-/URLauflösung aus Save.
5. Authentizität, Anti-Cheat, Online-Synchronisation, Save-Migration, Gameplayzeit, dynamische NPCs, Mehrfach-Challenges und Citation-Gates sind Non-goals.
6. Die reale Vitrine-Fallabnahme ist separat: ursprüngliche Citationpflicht reconciliieren, echter Proof-Witness statt Stub.

| ID | Inputvariation | Erwartung |
|---|---|---|
| A01 | Truth unbekanntes Rootfeld | SHAPE; keine Packageausgabe |
| A02 | Solution falscher truthHash | BINDING vor Folgeprüfung |
| A03 | Access fremder Case | BINDING |
| A04 | Presentation stale truthHash | BINDING |
| A05 | Catalogue anderer Truthstand | BINDING |
| A06 | NPC-Profil falscher catalogueHash | BINDING |
| A07 | Snapshot andere solutionHash | BINDING |
| A08 | Snapshot/Profil verschiedene npcId | BINDING |
| A09 | Doppeltes NPC-Paar | REFERENCE |
| A10 | NPC nicht in Truth.persons | REFERENCE |
| A11 | Initialref unbekannte Entity | REFERENCE |
| A12 | Initialref falsche Art | REFERENCE |
| A13 | Doppelte initial known | SHAPE/REFERENCE |
| A14 | Initial bekannte Evidence | Known, aber keine Discovery/Observation |
| A15 | Leeres initial known | gültig; keine automatische Freigabe |
| A16 | Refsource falscher caseId | REF_MAPPING |
| A17 | Refsource falscher truthHash | REF_MAPPING |
| A18 | Refsource salt 31/33 Hexzeichen | SHAPE |
| A19 | Ref fehlt für eine verborgene Entity | REF_MAPPING |
| A20 | Zwei Entities gleicher Token | REF_MAPPING |
| A21 | Refinverse andere Art/ID | REF_MAPPING |
| A22 | Ref syntaktisch ungültig | REF_MAPPING |
| A23 | Source nach Resolve verändert | bestehendes Package unverändert |
| A24 | Snapshot private Provenance geändert | snapshotHash und packageHash ändern |
| A25 | Snapshot asOf/revision geändert | packageHash ändert |
| A26 | Challenge Scope hinzugefügt | packageHash ändert |
| A27 | Nur Scope-Reihenfolge geändert | Hash gleich |
| A28 | Known-Reihenfolge geändert | Hash gleich |
| A29 | Witness-Schritte vertauscht | proofHash/packageHash ändern |
| A30 | Proof binding.releaseHash falsch | PROOF_BINDING |
| A31 | Manifest releaseContextHash falsch | PROOF_BINDING |
| A32 | Manifest executable JS als String | nie ausführen; nur Daten; keine PASS-Behauptung |
| A33 | proof null | technisches Package zulässig; Slice-Publikation noch nicht zertifiziert |
| A34 | proof pass-artiges Zusatzflag | Schemafehler; keine abgeleitete Autorität |
| A35 | Presentation ein Leerzeichen verändert | packageHash ändert |
| A36 | Salt verändert bei gleichem Mapping | refsHash/packageHash ändern |
| A37 | Mapping verändert bei gleicher Config | refsHash/packageHash ändern |
| A38 | 257 Entities oder 65 Evidence | LIMIT |
| A39 | Package über 2MiB/Depth32/100000 Nodes | LIMIT vor Domainparse |
| A40 | ResolvedPackage JSON.stringify | wirft; Public DTO bleibt serialisierbar |

## Mutation Smoke — mindestens acht

| Mutant | Semantische Mutation | Killer |
|---|---|---|
| M1 | Bindingcheck Truth→Solution entfernen | A02 |
| M2 | Snapshot-provenance aus Hash entfernen | A24 |
| M3 | allowedClaims unsortiert hashen | A27 |
| M4 | Refinverseprüfung entfernen | A21 |
| M5 | RefsHash aus releaseContextHash entfernen | A37 |
| M6 | Witnessarray als Menge sortieren | A29 |
| M7 | Initial Evidence automatisch releasen | A14 |
| M8 | Globale Refkollision tolerieren | A20 |

Mutanten sind semantische Anforderungen, keine vorgetäuschten vorhandenen Quelltextanker. Der spätere Reviewer bestimmt am echten Diff einen ausführbaren Patch je Mutant, hält ihn im Evidencepacket fest und repliziert den Killer. Ein Compilefehler ersetzt keinen logischen Killer. Überlebender Mutant blockiert. Keine Tests gegen eine zweite implementierungsgleiche Wahrheitstabelle.

## Handoff

Abgabe: tatsächlicher Head, diff --stat, Produktionszeilenzahl, typecheck/test-Ausgabe, alle Matrixfälle zu Testnamen zugeordnet, Mutationpacket und API-Reconciliation. Keine Aktivierung oder Registrierung wird durch dieses Dokument autorisiert. Kein spezieller Format-2-Endmarker.
