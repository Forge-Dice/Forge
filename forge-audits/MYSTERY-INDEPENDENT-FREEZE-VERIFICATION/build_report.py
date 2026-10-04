from pathlib import Path
import html,json,hashlib,re
R=Path(__file__).resolve().parent
parts=[]
def p(s):parts.append('<p>'+html.escape(s)+'</p>')
def pre(s):parts.append('<pre>'+html.escape(s)+'</pre>')
def section(n,title):parts.append(f'<section id="s{n}"><h2>{n}. {html.escape(title)}</h2>')
def end():parts.append('</section>')
def table(headers,rows):
 parts.append('<div class="scroll"><table><thead><tr>'+''.join('<th>'+html.escape(str(v))+'</th>' for v in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+html.escape(str(v))+'</td>' for v in row)+'</tr>' for row in rows)+'</tbody></table></div>')
sources={
 'M2':'MYST-0002.contract.FINAL-CANDIDATE.md',
 'M3':'MYST-0003-EVIDENCE-ACCESS-V1.contract.DRAFT.md',
 'M4':'MYST-0004-EVIDENCE-PRESENTATION-V1.contract.DRAFT.md',
 'M5A':'MYST-0005A-INTERROGATION-AUTHORING-V1.contract.DRAFT.md',
 'M5B':'MYST-0005B-INTERROGATION-RELEASE-V1.contract.DRAFT.md',
 'CH':'MYST-CHALLENGE-0001.contract.DRAFT.md',
 'SOL':'MYST-SOLVABILITY-0001.contract.DRAFT.md',
 'SA':'MYST-SESSION-0001A.contract.DRAFT.md',
 'SB':'MYST-SESSION-0001B.contract.DRAFT.md',
 'SC':'MYST-SESSION-0001C.contract.DRAFT.md',
 'INFO':'MYSTERY-INFORMATION-FLOW-REPORT.html',
 'SCALE':'MYSTERY-SCALE-COMPLEXITY-REPORT.html',
 'CROSS':'MYSTERY-CROSS-CONTRACT-CONSISTENCY-REPORT.html',
 'CERT':'DIE-LEERE-VITRINE-SOLVABILITY-CERTIFICATION.html',
 'VIT':'DIE-LEERE-VITRINE-CASE-PACK.zip',
 'VSPEC':'DIE-LEERE-VITRINE-HEADLESS-SPEC.html',
 'BRIEF':'DIE-LEERE-VITRINE-PLAYER-BRIEF.html',
 'AUTHOR':'MYSTERY_CASE_AUTHORING_STRESS_REPORT.pdf',
}
p('Unabhängige Prüfung vom 04.10.2026. Bezugsobjekt: die tatsächlich verfügbaren aktuellen Originalcontracts und Fallartefakte nach den belegten Repairs. Repository Forge-Dice/Forge, main 3d7545d843883418348004e68717399a64da7a7d. STRICT READ-ONLY: ausschließlich GitHub-GET, lokale Kopien und lokale Proben; keine Repository-, Branch-, PR-, Review- oder Settingsänderung.')
p('Urteil: NO-GO für den vollständigen Mystery-Spec-Freeze. Das bestehende Design muss nicht neu entworfen werden. Fehlende normative Ref-/Release→Proof-Grenzen, nicht gebundener öffentlicher Fallinhalt und konkrete Semantikwidersprüche verhindern den Freeze. Die fehlende Produktionsimplementierung an sich ist KEIN Spec-Freeze-Blocker.')
p('Dieser Bericht enthält private Vitrine-Autoreninformationen. Originalreports wurden gelesen, ihre Modell-PASS-Zahlen werden nicht als eigene Produktionsprüfungen ausgegeben. CLAUDE FINAL REPAIR: Als eigenständige finale Claude-Datei ist M2 FINAL-CANDIDATE belegt. Eine darüber hinausgehende finale Release→Proof-Reparatur ist nicht verfügbar; der Zertifizierungsanhang liefert ausdrücklich nur einen LAB ADAPTER PROPOSAL. Keine Rekonstruktion aus Zusammenfassungen.')

section(1,'Freeze Criteria')
p('Die Kriterien wurden in FREEZE-CRITERIA-PRECOMMITTED.md vor Sichtung individueller Findings festgeschrieben. Fehlendes Original = NOT VERIFIED; ein Report ersetzt niemals einen Contract. SMALL REPAIRS setzt vollständige Evidenz und ausschließlich endliche, genaue, semantikerhaltende Textkorrekturen voraus. Eine fehlende normative Schnittstelle ist nicht automatisch eine kleine Reparatur.')
criteria=[
('C1','Jedes persistente Datum besitzt genau eine Autorität.','FAIL','Öffentliche Setup-/Frage-/Label-/Regeldaten und Adapterzertifikate besitzen noch keinen vollständigen normativen Owner.'),
('C2','Jedes Runtime-Datum besitzt einen eindeutigen Producer je Grenze.','FAIL','Kein vollständig spezifizierter Producer von ReleasedObservation aus aktuellem ReleaseTrace.'),
('C3','Jeder Consumer besitzt exakten Typ, Binding, Lifetime und Serialization.','FAIL','M1 fehlt; Package.refs erfüllt M4/M5B-Translator nicht direkt; Proof-Port ist offen.'),
('C4','Keine offene semantische Contradiction.','FAIL','Required-only, ask/interrogate, Vitrine-Belegpflicht und enge Rollenfrage.'),
('C5','Kein zyklischer harter Dependencygraph.','PARTIAL','Bekannter Session-/Hash-DAG azyklisch; M1-Namespace und dynamische Public-Rule-Freigabe nicht abschließend geprüft.'),
('C6','Kein verborgenes Truth-Leak oder implizite Faktpromotion.','NOT VERIFIED','Lokale DTO-Regeln gut; Vitrine-Startbrief-Leak reproduziert, gesamte finale Adaptergrenze fehlt.'),
('C7','Deterministischer bounded Replay ohne quadratischen Contractzwang.','PARTIAL / FAIL','Eventautorität und Terminalität exakt; Vollprefix-Serialisierung pro Event wörtlich vorgeschrieben.'),
('C8','Challenge Core/Scope/determined/matching/Required/public question vollständig.','PARTIAL','Verdictformel exakt; Publicationformulierungen widersprechen sich und Vitrine-Policy weicht ab.'),
('C9','Solvability ist endlich und garantiert präzise Begrenztes.','PASS lokal','n≤6, 2^n≤64, explicit roots/licenses und gemeinsamen Witness normiert; Adapterintegration bleibt gesondert FAIL.'),
('C10','Referenzidentitäten und Mutation/Invalidation stabil definiert.','PARTIAL','Sessionkomponenten gut gebunden, aber Ref-Ableitung und öffentliche Inhaltsabdeckung nicht vollständig.'),
('C11','Versionierungs-/Compatibilitypfad vorhanden.','PASS lokal / PARTIAL gesamt','Exact package/ruleset, kein Upgrade; endgültige Contractfassung und M1-/Adapterversion fehlen.'),
]
table(['ID','Objektives Kriterium','Ergebnis','Begründung'],criteria)
end()

section(2,'Artifact Completeness')
p('Native Datei-Titelsuche MYST/MYSTERY/VITRINE/VS-5, zusätzliche Titelprüfungen MYST-0001/FREEZE/RECONCILIATION/REPAIR/PREFLIGHT, aktuelle vollständige gefilterte Dateiliste und zehn extrahierte Evidenzarchive wurden geprüft. Die gelesene vollständige main-Dateiliste enthält keine MYST-0001- oder finale Release→Proof-Datei. NOT AVAILABLE bezeichnet den zugänglichen Bestand, keine Behauptung über alle anderen Projektthreads oder privaten Datenträger.')
table(['Verlangt','Tatsächlich verfügbares Original','Status / Freeze-Relevanz'],[
('0001','Kein Volltext, keine Implementierung; nur M4/M5B/Session-Zitate.','NOT AVAILABLE — BLOCKING. Kein Hash-/Encoding-/Namespacevertrag daraus erfunden.'),
('0002',sources['M2']+' + REPAIR-REPORT + REPAIR-EVIDENCE; alter Draft ebenfalls vorhanden.','Volltext gelesen. Final Candidate gewählt; ältere Fassung nur Herkunft.'),
('0003',sources['M3']+' + PACKAGE.','Volltext gelesen.'),
('0004',sources['M4']+' + PACKAGE; Fassung 04.10. 06:42 UTC.','Volltext gelesen. Reports sind ausdrücklich nicht faktiv.'),
('0005A',sources['M5A']+' + 0005-PACKAGE.','Volltext gelesen.'),
('0005B',sources['M5B']+' + 0005-PACKAGE.','Volltext gelesen. Persistenzvokabular noch ask.'),
('Challenge',sources['CH']+' + Exactness-Report/Evidence.','Volltext gelesen; verweist auf alten M2-Inhaltshash.'),
('Solvability',sources['SOL']+' + Repair-Report/Evidence.','Volltext gelesen; versionierten trusted Releaseadapter ausdrücklich vorausgesetzt.'),
('Session A/B/C',sources['SA']+' / '+sources['SB']+' / '+sources['SC']+' + Production-Package/Evidence.','Drei echte aktuelle Volltexte. Gemeinsame §§2–11 bytegleich; ersetzen fehlenden alten VS-5 nicht rückwirkend.'),
('Vitrine',sources['VSPEC']+' / '+sources['BRIEF']+' / '+sources['VIT']+' / DIE-LEERE-VITRINE-PROOF-PROFILE.json.','Originale und enthaltene truth/solution/access/NPC/profile/host/proof/manifests gelesen. 55 ZIP-Einträge. Kein modernes Presentation- oder Sessionpackage.'),
('InfoFlow',sources['INFO']+' + INFOFLOW-EVIDENCE.zip.','Vollbericht verfügbar. Befunde/Modellgrenzen mit Originalhost geprüft.'),
('Scale',sources['SCALE']+' + SCALE-EVIDENCE.zip.','Vollbericht verfügbar. Copy/Serialization-Prefixkosten relevant; keine Optimierungsarbeit durchgeführt.'),
('Cross-Contract',sources['CROSS']+' + CROSS-CONTRACT-EVIDENCE.zip.','Vollbericht verfügbar. Frühere Session-UNKNOWN durch heutige A/B/C teilweise geschlossen.'),
('Certification',sources['CERT']+' + CERT-EVIDENCE.zip.','Original NOT CERTIFIED; Reparaturdateien ausdrücklich Kandidaten.'),
('Zusätzlicher Authoring-Report',sources['AUTHOR']+' + EXPERIMENTAL_APPENDIX.zip.','Original gelesen. Kein zwingender neuer Truth-Claimtyp für engen Slice erforderlich.'),
('Claudes finale Release→Proof-Reparatur','Nur factivity-bridge.REPAIR-CANDIDATE.json: status LAB ADAPTER PROPOSAL, NOT accepted Session or MYST-0004 API.','Finale normative Reparatur NOT AVAILABLE. Kandidat ist Prüfinput, keine Ersatzautorität.'),
])
p('Quellenrang: implementierte Basisschemas für vorhandene APIs; jüngster verfügbarer Contract für geplante APIs; Case-Spec für authored Fallinhalt; Reports nur als Evidenz. Nicht akzeptierte Dependency-Commits blockieren einen Implementierungsstart, aber nicht automatisch einen reinen Designfreeze. Die semantisch maßgebliche finale Textauswahl muss trotzdem feststehen.')
end()

section(3,'Ownership')
p('Authority meint die Herkunft des fachlichen Datums, nicht jede Kopie desselben Werts. Ein truthHash in mehreren Dokumenten ist eine überprüfte Bindung, keine zweite Truth-Autorität. Persistierte abgeleitete Reports oder Projektionen dürfen keine Autorität erhalten. Die folgenden Pfadfamilien decken alle persistenten Domänen-/Session-/Fallartefakte ab; * bedeutet alle Felder des jeweils benannten Schemas.')
table(['Persistentes Feld / Artefakt','Ein fachlicher Owner','Consumer / erlaubte Kopie','Befund'],[
('CaseTruth.schemaVersion/caseId/revision; persons/locations/items/relationships/events/motives/propositions/evidence/secrets/redHerrings[*]','CaseTruth-Schema + authored Truth','Solution/NPC/Authoring; Hash bindet vollständigen Snapshot.','ONE. Proposition.truth nur hier. Evidence.links erzeugt keine Prooftruth.'),
('CaseSolution.schemaVersion/caseId/revision/truthHash; resolutions[*], conclusions[*], requiredConclusions[*]','CaseSolution-Schema + authored Solution','M2/CH/SOL; Status aus bestehendem resolveConclusion.','ONE. Required steht nur in Solution; Profile/Challenge besitzen Coverage, keine zweite Requiredliste.'),
('NpcKnowledgeSnapshot.schemaVersion/caseId/truthHash/solutionHash/npcId/revision/asOf/awareness[*]/attitudes[*]','NPC-Snapshot-Schema + authored Snapshot','Projection/M5B; SA snapshotHash.','ONE. acquire/provenance/knowledge-vs-belief privat.'),
('EvidenceAccessMap.schemaVersion/caseId/truthHash/entries[evidenceId,access.kind,paths[*]]','M3','Session Discovery; host.access ist ältere abgeleitete Fallkopie.','ONE normativ; alte host.access-Kopie vor Migration nicht zugleich bearbeiten.'),
('EvidencePresentation.schemaVersion/caseId/truthHash/entries[evidenceId,text,mentions[*],reports[claim,stance,source]]','M4','releaseEvidence; Session hält Empfangskopie.','ONE normativ. Alte Vitrine presentation{title,text,observed} hat anderen Shape.'),
('QuestionCatalogue.schemaVersion/caseId/truthHash/revision/questions[id,mentions[*]]','M5A','M5B Askability; SA catalogueHash.','ONE. questionText ist NICHT Teil dieses Schemas.'),
('InterrogationProfile.schemaVersion/caseId/truthHash/catalogueHash/npcId/revision/rules[*]','M5A','M5B selected question/reveal.','ONE.'),
('PlayerRef config.profile/saltHex, preimage/namespace, Mapping und Collision-/Resolutionregeln','Soll MYST-0001 besitzen','SA PackageRefSource konsumiert actual Mapping.','ZERO VERIFIED OWNER für vollständiges Protokoll, M1 fehlt.'),
('Accusation.schemaVersion/caseId/truthHash/literals[claim,value]','M2 Schema; Sessionevent für tatsächlichen Empfang','CH; Save bewahrt Playerinputs, Canonicalaccusation transient.','ONE je Grenze; fachlich keine persistente Verdictautorität.'),
('Challenge.schemaVersion/caseId/truthHash/solutionHash/allowedClaims[*]','CH','SA bindet; SB wendet an.','ONE, aber M2 §15 konkurriert mit CH §6 beim Required-only-Verbot.'),
('CaseProofProfile.schemaVersion/bindings[*]/answerScope/ambiguityPolicy/question/observations[*]/nodes[*]/edges[*]/witnessStepIds','SOL','Private Checker-/Certification-Inputs.','ONE. expected observations keine tatsächlich empfangenen Roots.'),
('ReleaseManifest.schemaVersion/releaseContextHash/adapterVersion/certificateData','SA Envelope; Inhalt benötigt authored Adaptercontract','SOL WitnessReplay und Fallabnahme.','ZERO OWNER für certificateData-Schema, Reportmapping, Lizenzfreigabe und Eventtabelle.'),
('InitialSetup.schemaVersion/known[*]','SA','B initialSession; keine Initial-Discovery aus Evidence-Awareness.','ONE für Grantliste. Vitrine public-initial/host.initialKnown müssen explizit darauf reconciliieren.'),
('Public question, publicRoster, crimeTime/location, publicRules[id,text], questionText[npc,text], publicEventLabels, personRoles, entityLabels, BRIEF','Vitrine authored Hostinhalt; kein vollständiger V1-Packagecontract dafür','Initial-/PublicView, Frageliste, Lizenzpräsentation.','ZERO normativer Package-/Releaseowner; manche Labels doppelt gespeichert. Source of truth und Hashpfad offen.'),
('CasePackageInput Komponenten; CasePackageIdentity schemaVersion/packageHash/rulesetVersion und Componenthashprofile','Soll SA sein','SB/SC lesen; identische Definitionen in drei gemeinsamen Drafttexten.','ONE fachlich: identische gemeinsame Packageautorität. Drei normative Textkopien ohne redaktionelle Vorrangregel; aktuell kein inhaltlicher Drift (F12 NONBLOCKING).'),
('SessionEvent.type/action/target/npc/questionId/literals[claim,value]','Soll SB Eventcontract sein','SC accepted event history; M5B beschreibt ask als persistente Form.','MULTIPLE incompatible vocabulary: ask vs interrogate.'),
('Save.schemaVersion/packageIdentity/events/checksum','SC','Decoder prüft; SB replay rekonstruiert.','ONE im geplanten Split. Legacy savedData{schemaVersion,packageHash,commands} ist anderes Format.'),
('PlayerKnowledge known[firstSeen], discoveries[firstDiscoveryEvent], observations[source,eventIndex,payload]; SessionState phase/verdicts','Nur abgeleitet durch SA helper / SB Transition','UI trusted allowlist; keine untrusted Loadautorität.','KEIN zusätzliches persistentes Authorityfeld. Observation payload owner M4/M5B, Empfangsprovenance SB.'),
('PRIVATE projection-*.json, golden traces, certification/InfoFlow/Scale/Crossreports und result files','Jeweiliges Lab als Evidenzproducer','Nur Review/QA; dürfen Snapshot/Contract/Runtime nicht überschreiben.','Keine konkurrierende Gameplayautorität. content/status/sourceMain/redHerringDesign-Metadaten bleiben authored/QA.'),
])
p('ZERO OWNER ist bei einer bewusst privaten QA-Datei unproblematisch, bei Releasecertificate-Semantik und öffentlichem Gameplayinhalt blockierend. MULTIPLE OWNERS meint hier normative Konflikte oder fehlenden Vorrang; nicht legitime Bindingkopien. Die drei Sessiontexte sind aktuell bytegleich. Das allein erzeugt weder einen zweiten fachlichen Owner noch einen aktuellen Semantikkonflikt; eine redaktionelle Ein-Owner-Regel ist F12 NONBLOCKING.')
end()

section(4,'Producer/Consumer')
table(['Runtime-Typ','Producer → Consumer','Binding / Übersetzung','Lifetime / Serialization','Trust / Ergebnis'],[
('CaseTruth / CaseSolution','parseCaseTruth / parseCaseSolution → alle privaten Domänenmodule','Solution an caseId+truthHash; veröffentlichte Truth semantisch prüfen.','Immutable Packagelebenszeit; private canonical domain JSON.','Trusted authored; geschlossen.'),
('NpcKnowledgeSnapshot','parseNpcKnowledge → projectNpcKnowledgeWithBridge','T/S/npcId/asOf; komplette snapshotHash-Bindung in SA.','Frozen im Package; privat serialisierbar.','Trusted; geschlossen.'),
('PlayerRefIndex / resolved EntityRef','M1 build/resolve → SA PackageRefSource, SB','Exakter Algorithmus/namespace/encoding fehlen.','Packagelebenszeit; Reversemap privat.','OFFEN — F01.'),
('PackageRefSource / ResolvedCasePackage.refs','Trusted M1 adapter → resolveCasePackage → SB','Source caseId+truthHash+config; vollständige injektive Tabelle+Inverse; kopiert.','Source transient, refs Closure Packagelebenszeit; kein Public DTO.','Shape für consumer translator fehlt: refs hat nur refFor/resolve — F07.'),
('ResolvedCasePackage / identity','SA resolveCasePackage → SB initial/reduce/replay, SC save','Komponentenhash-DAG, exact-package/exact-ruleset.','Immutable; toJSON wirft; Funktionen nicht clonebar.','Trusted-only; öffentliche Semantikabdeckung offen — F03.'),
('KnownEntity / PlayerKnowledge','SA initial/record helpers im SB Commit → SB, PublicView','Nur initial + veröffentlichte Evidence + autorisierte Mentions; eventIndex nullbasiert.','Abgeleitet; Journal geordnet, Known/Discovery nach ref. Nicht saved.','Keine Faktenautorität; geschlossen bis Interface-/Ownershippatch.'),
('SessionEvent / PlayerConclusionClaim','SB strict parse von untrusted input → Transition / SC','3 Eventarten, 6 Conclusionvarianten; Refkind und prefix-Known.','Accepted Inputlog; kanonische Eventarrays geordnet.','Untrusted bis Parse/Authorize; M5B ask widerspricht — F06.'),
('Canonical EntityRef[] / InvestigationAction','SB feldweise Refauflösung → M3 resolveInvestigation','search_location→locationId, examine_item→itemId, examine_person→personId.','Pro Aktion transient; nie Playeroutput.','Hostderived; geschlossen.'),
('InvestigationResult.found','M3 → SB difference(discoveries) → M4','T-Bindung beider Komponenten über Package; found existierende Evidence prüfen.','Aktion; canonical-ID-sort intern, öffentlich nach übersetztem ref.','Privat; Discovery≠Release.'),
('M4/M5B PlayerRefTranslator','SB muss aus pkg.truth + pkg.refs konstruieren → releaseEvidence/interrogate','{caseId,truthHash,refFor}; pkg.refs allein nicht type-compatible.','Aktion/Package; trusted Funktionen, keine Serialisierung.','MISSING EXACT CONVERSION — F07.'),
('EvidenceObservation / PlayerReport / M4.PlayerClaim','M4 releaseEvidence → SB recordEvidence / public output','Evidence+Mentions+Reports closure; Translator T; Paketrückauflösung.','Einmal pro Discovery; DTO mit fixem key/orderprofil; nicht im Save.','Authored public payload, source=observation trotzdem kein Fakt.'),
('NpcEpistemicContext / VisibleRef','Projection core → decideResponse/bridge','Lokale Objectidentity; kind/index nur innerhalb derselben Projection.','Ein Aufruf; raw context serialisierbar aber privat.','Trusted; darf nie UI/untrusted Generator erreichen.'),
('NpcProjectionBridge / ReleaseTranslator','M5B factory → interrogate','Original emitted object + explicit authorization, keine copied/fremden/statement refs.','Transient; toJSON wirft; keine Persistenz.','Trusted capability; geschlossen.'),
('ResponseDecision / NpcVisibleClaim','M5B decideResponse → selected release','Struktureller Claimvergleich; knowledge/belief gleicher Commitment.','Transient; nicht Public-/Saveobjekt.','Privat; geschlossen.'),
('InterrogationObservation / M5B.PlayerClaim','M5B interrogate → SB recordInterrogation / output','T/S/snapshot/catalogue/profile; canonical Known; statement mentions.','Empfangsrecord pro Wiederholung; 3 diskriminierte Varianten.','Public authored report; decline/dnk haben keine mentions.'),
('ObservationRecord / verdict record','SB atomarer Commit → Journal/Views','eventIndex+Evidence oder npc/question; Empfangsquelle, nicht private NPC-Provenance.','Derived Sessionstate; replay regeneriert.','Geschlossen; kein last-writer-wins-Fakt.'),
('Canonical Accusation','SB translates 6 variants + M2 parseAccusation → CH','T binding; client liefert keine hash/caseId; Duplicatepolarity verboten.','Nur Evaluation; canonical IDs nicht persistierter Playerinput.','Private host datum; geschlossen.'),
('ConclusionEvaluation / AccusationResult','M2 → CH/SOL/QA','Bestehende status authority; T/S binding; U neutral im Core.','Pro Evaluation; true/false/U nur intern.','Answer-key oracle privat; no-throw-Versprechen offen — F08.'),
('ChallengeAccusationResult / SessionOutput.accuse','CH → SB terminal transition → Player','Core + Scope + determined matching; globale Requiredcoverage.','Binäres Public Verdict; Statephase derived.','Legitime Antwortdeklassifikation; Vitrine receipt widerspricht — F04.'),
('ReleaseTrace → ReleasedObservation','Noch zu spezifizierender authored Witnessadapter → SOL','Exact payload/ref/literal/source/licence mapping; canonical certificate, kein stance-only promotion.','Gemeinsamer ordered witness; private finite output.','MISSING PRODUCER — F02. Profile.observations sind keine Ersatzproduktion.'),
('PUBLIC_RULE DTO / rule receipt','Fallpräsentation/Adapter → Spieler + SOL','Deskriptorbody+yield müssen zur wirklich sichtbaren Regel passen; Releasezeit fixieren.','Initial oder expliziter authorized release; keine private Graphserialisierung.','MISSING normative public type/release mapping — F02/F03.'),
('WitnessReplayResult / SolvabilityReport / HypothesisVector','Trusted real replay adapter / SOL → Author QA','ProofBindings+releaseHash; status pass/fail/unknown; ≤64 vollständige Boolvektoren.','Private Certification; kein Spielerreport.','SOL semantisch exakt; Portinhalt fehlt.'),
('Save text / decoded SessionState','SC encode/decode → SB replay → trusted host','Canonical wire, exact identity, checksum, accepted-prefix transitions.','Persistierter Inputlog; neu abgeleitete frozen State.','Save untrusted; no derived-state load; geschlossen bis obige boundaries.'),
])
p('Die zeichnerische Pipeline enthält zwei verschiedene Prüfpfade: Authoring-Solvability konsumiert Releases über den Witnessadapter; Runtime-accuse konsumiert ausdrücklich keine Proofclosure. Der vom Nutzer verlangte Pfeil proof→accusation hat im aktuellen Runtimecontract daher keinen normativen Owner. Ihn mit einem Mock einzusetzen wäre eine heimliche Belegpflicht.')
end()

section(5,'Release→Proof')
p('Adversarialer Maßstab: Autorisierung des Reports, Wahrheit seines Inhalts und rechtfertigbare Inferenz sind drei verschiedene Schritte. M4 §3.2/§8 und M5B §5.2 verwehren implizite Faktivität; SOL §§4–6 verlangt authored Faktivitätszertifikat für OBSERVED und veröffentlichte License für Schlusskanten. Diese Trennung ist richtig. Die Umsetzung der Grenze ist nicht final spezifiziert.')
table(['Fall','Tatsächlicher Payload / Quelle','Ohne explizite Regel','Mit expliziter authored Berechtigung','Status'],[
('Truthful Evidence observation','D04: Bericht Max/Hof@240 affirms, source=observation; Kandidat nennt p03=true.','Nur EvidenceReport. source=observation oder canonical true allein seeds nichts.','Exakte D04/report→observed:max/p03:true-Faktivitätslizenz + tatsächlich released Payload; danach public exclude:max-Kante.','Kandidat vorhanden, normative Zertifikats-/Receiptgrenze offen.'),
('Misleading true observation','D01: Max/Galerie@120; wahrer früherer Besuch.','Kein direct_actor@240. Lokaler Originalproof liefert keine Rollenfacts.','Falls dieser Fakt zertifiziert wird, nur der gleiche Zeitliteralroot; Schuld braucht eigene explizite zulässige Kante.','Kein automatischer Schluss. D01 ist kein benötigter SOL-root.'),
('False NPC belief','Oskar Q12 affirms Max/Galerie@240; authored belief falsch.','Reportevent, kein OBSERVED. Nur Q12 gehört nach lokalem Host in Journal; proof facts {}.','REPORTED_BY_NPC kann exakt diese Äußerung modellieren; Inhalt nur über öffentlich reviewte Kante weiterführen, falscher kanonischer Schluss wird abgewiesen.','Boolean Reportmapping erforderlich; kein knowledge-kind lesen.'),
('Uncertain NPC report','Nora Q10 stance=uncertain, statement Lina/Galerie@240.','Kein true/false aus uncertain, leans_affirms oder leans_denies.','Im aktuellen SOL-Roottyp nicht boolesch repräsentierbar; im Journal erhalten und aus booleschem Prooftrace auslassen. Neue Rootart wäre neue Semantik, hier nicht vorgeschlagen.','Normative Ausschlussregel im Adapter muss exakt sein.'),
('Conflicting reports','Oskar Q12 affirms und Max Q02 denies denselben Claim; zwei Empfangsrecords.','Beide berichten; weder Mehrheit, letzter Writer noch interne knowledge-Stance gibt objektive Wahrheit. Lokaler proof facts {}.','Separate ausdrücklich authored Beobachtungsidentitäten/Quellen; eine veröffentlichte, fachlich reviewte Schlusskante kann eine Konsequenz tragen.','Kein implizites Konfliktauflösen.'),
])
p('Die verfügbare factivity-bridge.REPAIR-CANDIDATE.json enthält vier Evidence/report/literal-Mappings und publicLicense="rule:certified-sources". Sie enthält keinen endgültigen Schema-/Parservertrag, keinen vollständigen uncertain/conflicting/NPC-Mappingvertrag, keinen standardisierten Rule-Receipt-Datentyp und keinen Eventtabellen-/Session-Adapter. presentationBytesSha256 bindet zwar eine Kandidatendatei, beweist aber keine tatsächlich autorisierte Runtimefreigabe. Sie ist ausdrücklich keine accepted API.')
p('SOL prüft canonical consistency, aber kann menschliche Berechtigung einer Schlussregel nicht beweisen. Ein explizit authored Report→Literal-Gesetz darf nicht allein dadurch als fachlich korrekt gelten, dass die private Solution die Konsequenz zufällig bestätigt. Review der öffentlichen Regel bleibt erforderlich. Ebenso darf ein Claimalias nicht über first-match auf beliebige Proposition-ID aufgelöst werden; der Adapter muss das konkrete Literal binden.')
end()

section(6,'Challenge')
pre('CoreSolved(A) = CoversAllRequired(A) AND no determined literal contradicts its asserted polarity.\nChallengeSolved(A) = CoreSolved(A) AND every claim is in Scope AND status(claim) is Boolean AND status(claim) == asserted value.')
table(['Begriff / Attack','Exakte verfügbare Regel','Ergebnis'],[
('Core','M2 §7: undetermined neutral; Requiredvergleich claimKey+Polarity; Solution global.','Geschlossen. Kein Playerabschluss über Core allein.'),
('Scope','CH §4: 1..256 nackte Claims, unique claimKey; jede Requiredclaim enthalten; false/U zulässig.','Geschlossen strukturell. Keine Gewinnpolarität im Scope.'),
('determined / matching','CH §5: literal.status === literal.value; U passt weder true noch false.','Geschlossen. Shotgun via U-Extras abgewiesen.'),
('Required','A deckt alle S.requiredConclusions exakt ab, auch negative. Keine Proof-/Challenge-eigene Requiredliste.','Geschlossen. Semantisch ähnliche andere Claims ersetzen nichts.'),
('Shotgun alles=true','Complete: unschuldige/andere falsche Claims widersprechen; partial: U-Claims rejected durch CH.','Geschlossen für eine einzelne Anklage. Alle tatsächlich verantwortlichen Akteure sind kein verbotener Shotgun.'),
('Wahre Extras','In-scope+determined+matching Extras bleiben zulässig; Out-of-scope→not_solved.','Geschlossen. Solvabilityscope muss nicht pauschal gleich Challengeumfang sein.'),
('Public question / Required-only','M2 §15: nie Required-only-Whitelist. CH §6/P21 erlaubt öffentlich vorgewählte Ja/Nein-Dimensionen mit Scope=Requiredkeys.','BLOCKING contradiction F05; kein verdict-code defect.'),
('Enge direct_actor-Frage','Vitrine fragt direct_actor für vier feste Personen. CH Rollenfrage verlangt pro Kandidat alle drei Rollen; §6 required_literals erlaubt enge Teilfrage.','Explizit required_literals-Einordnung und Vorrang dieser Zeile fehlen im Fallvertrag — F05/F11.'),
('identify_all_responsible','CH: vollständige öffentliche Kandidaten+alle tatsächlichen Verantwortlichen+nobody; SOL: jede Truthperson+nobody, max5 Personen.','Kompatibel nur mit bewusst geschlossener veröffentlichter Population. Enthält T hidden Personen, darf man sie nicht automatisch als UI-Kandidaten ausgeben. Publication ablehnen oder enge Frage authoren.'),
('Mehrere vollständige Versuche','CH keine Attempts/Proofpolicy; SB lässt gültige Fehlanklagen aktiv; Start-Known kennt vier Personen und e04.','Raten/Enumeration der vollständigen Antwort ist ausdrücklich zulässig. Kein Anti-Bruteforce-Claim. Vitrine verlangt derzeit anderes Verhalten — F04.'),
('Scope-/Required-Leak','CH §6 Gegenweltcheck: gleiche öffentliche Frage bei geänderter privater Antwort → gleiche Kandidatenfamilie. Lösungshash/Required/kanonische Hidden-IDs privat.','Richtig normiert; öffentliche Frage selbst noch nicht vollständig packagegebunden — F03.'),
])
end()

section(7,'Package Identity')
p('Legende: RC=releaseContextHash, RH=releaseHash, PH=proofHash, PK=packageHash. Bei proof=null sind RH/PH null. Jede PK- oder Rulesetänderung macht einen Save mit alter Identity im neuen Package INCOMPATIBLE_PACKAGE, auch einen leeren Save. Der Save bleibt gegen archiviertes altes Package+alten Ruleset gültig. „Invalidieren“ bedeutet keine rückwirkende Zerstörung.')
table(['Mutation einer Komponente','Welche Identität muss ändern?','Save im neuen Package','Semantisch irrelevant? / offene Stelle'],[
('Truthfeld: IDs, revision, name/description, events, propositions, Evidence.links/source, secret/redHerring','truthHash; abhängige T-bindings; RC/RH/PH/PK neu berechnen.','Alle alten Saves inkompatibel.','Auch nicht gameplayrelevante Truthprosa ist derzeit absichtlich signifikant; M1-Refrotation UNKNOWN.'),
('Solution: resolution/roles/null/completeness/intent/mechanism/targets/required/conclusions/revision','solutionHash; NPC/CH/Proof-S-bindings, RC/RH/PH/PK.','Alle.','Keine Ausnahme für zufällig gleiche betrachtete Verdicts.'),
('Accesspfad/access.kind/evidence entry','accessHash→RC→RH/PH→PK.','Alle.','Reihenfolge entries/paths ist Menge, reine Permutation irrelevant.'),
('Presentation.text/mentions/reports/source/stance','presentationHash→RC→RH/PH→PK.','Alle.','Ein Leerzeichen oder NFC/NFD signifikant. entries/mentions/reports-Mengenpermutation irrelevant.'),
('Catalogue question id/mentions/revision','catalogueHash; profile.catalogueHash neu; RC/RH/PH/PK.','Alle.','question-/mention-Arrays Mengen; FrageTEXT steht nicht hier.'),
('InterrogationProfile act/claim/reveal/revision','profileHash→npcBundleHash→RC/RH/PH/PK.','Alle.','rules/reveal Permutation als Menge irrelevant.'),
('NPC snapshot stance/awareness/asOf/revision/provenance/acquiredAt','snapshotHash→npcBundleHash→RC/RH/PH/PK.','Alle.','Auch private Provenance signifikant. awareness/attitudes-Mengenpermutation irrelevant.'),
('Initial known membership','initialHash→RC/RH/PH/PK.','Alle.','known-Reihenfolge irrelevant; Duplikate ungültig.'),
('Challenge.allowedClaims membership/caseId/T/S binding','challengeHash→RC/RH/PH/PK.','Alle.','Scope-Reihenfolge irrelevant; kein per-Challenge Requiredset.'),
('Ref salt/profile oder tatsächliche mapping bytes','refsHash→RC/RH/PH/PK.','Alle, einschließlich empty save.','Saltwechsel bei gleich geliefertem Mapping bleibt signifikant. Ob nackte Refs bei jeder PK-Änderung rotieren: M1 fehlt.'),
('Manifest adapterVersion/certificateData','RH→Profile.bindings.releaseHash→PH→PK.','Alle.','CertificateData-Schema/typisierte Mengenpfade noch UNKNOWN. Nicht automatisch sortieren.'),
('Proof answerScope/observations/nodes/edges/question/ambiguity','PH→PK; RH nur falls gebundene Release-/Regelbedeutungen ebenfalls ändern.','Alle.','Typisierte Sets irrelevant permutierbar; eigene ID-/Inhaltsänderung signifikant. Keine PH-Rückbindung in RH.'),
('witnessStepIds Reihenfolge','PH→PK.','Alle.','GEORDNET: immer signifikant. Der Eventkatalog der Step-IDs ist noch kein vollständig normiertes Identityinput.'),
('Public question wording/type, publicRules text/descriptors, questionText, entity labels/roster/brief','Soll semantischen Host-/Manifestinput→RC/RH/PK ändern. AKTUELL kein vollständiger Pflichtpfad.','AKTUELL NICHT GARANTIERT; F03.','Kein pauschales „nur UI“. Negation/Rollenwort/Regelzeit ändern Gameplayinformation.'),
('Engine-/Reducer-/Release-/Verdictsemantik','Neue rulesetVersion und neue PK; ggf. Adapterversion/Hashprofil.','Alle.','Unveränderte Semantik bei Refactoring braucht keine Version, Regression erforderlich.'),
('Objekt-Key-Reihenfolge / explizit mengenartige Arrays','Nach jeweiligem canonical profile Identität gleich.','Kompatibel.','C bewahrt nicht-mengenartige Arrays, besonders Saveevents und witness.'),
('Eventreihenfolge / Anklageliteral-Reihenfolge im Save','PK gleich, Savebody/checksum anders.','Replay abhängig von neuer Reihenfolge; keine packageinvalidierung.','Verdict kann bei Claimpermutation gleich bleiben, Historybytes nicht.'),
('checksum allein / zusätzliche derived Felder im Save','Checksum muss aus body neu berechnet sein; derived Zusatzfeld Shape-REJECT.','Corrupt checksum rejected; neu gehashte gültige Geschichte erlaubt.','Keine Authentizität/Anti-Cheat-Garantie.'),
('UI-Font/Layout/Codeformatierung außerhalb authored Package','Keine fachliche Identität ändert.','Kompatibel.','Nur wirklich außerhalb gebundener Semantik; keine Textstrip-Heuristik.'),
])
p('Der aktuelle bekannte Hashgraph ist azyklisch: Komponenten→RC→RH→PH→PK→Savechecksum. M1-Namespace darf keine Rückkante zum PK verlangen, solange PK die Reftabelle bindet. Der alte Vitrine-Host leitet Refs dagegen aus seinem eigenen vollständigen case-lab-package-v1-Hash ab. Das ist ein anderes provisional Profil und keine bestätigte M1-Kompatibilität.')
end()

section(8,'Session')
table(['Aspekt','Verfügbarer Vertrag','Urteil'],[
('Event authority','SB §4/5: nur akzeptierte investigate/interrogate/accuse Inputs; reject unveränderter State; nullbasierter eventIndex.','Geschlossen, F06-Eventname bereinigen.'),
('Derived state','SA §3: Known/Discovery/Observation/verdict/phase aus Package+accepted log; SC §8 speichert nichts davon.','Geschlossen. Kein PlayerKnowledge-Load aus untrusted JSON.'),
('History','Wiederholungen/leere gültige Suchen/decline/dnk werden akzeptiert und geloggt; Empfangsreports pro Befragung, Evidence einmal.','Geschlossen. Keine implizite Requestidempotenz.'),
('Atomicity','SB §5: temporäre Portauswertung, jeder Release/Ref validiert; einmal Commit. Zweiter fehlender Release rollback alles.','Geschlossen. Keine Discovery vor tatsächlichem Release.'),
('Replay','SB §7: gleicher Package, initial state, ordered prefix, echte M5B-Pipeline, snapshot.asOf eingefroren, erster invalid event abort.','Deterministische Semantik geschlossen; Ref-/Portkonstruktion F01/F07 bleibt.'),
('terminal solved','Nach erstem CH-solved jede Aktion SESSION_CLOSED ohne Gameplayport, log nach solved INVALID_HISTORY, nicht trimmen.','Geschlossen. Technischer Terminalzustand erlaubt Publicwissen phase=solved.'),
('package mismatch','Exact package/ruleset; kein Upgrade/Migration. Encode replays und vergleicht Derived State; wrong state identity HOST_FAILURE.','Geschlossen für vorhandene Identitätsinputs. Public semantics F03 fehlt.'),
('Limits','512 events, 32 literals/event, 16KiB canonical event, 1MiB save, 2MiB raw package, depth32/nodes100000; 256 entities/64 evidence/16 NPC/128 questions.','Finite Ressourcen. Package-/Savebudgets zusätzlich zu Domainlimits, keine aktuelle Runtimebenchmark-Garantie.'),
('History immutability','SA helper: neue deeply frozen Kopie; SB outputs frozen/eigene Kopie; Replay derselbe Reducer.','Observationale Unveränderlichkeit gut; ob private append/shared frozen subtrees erlaubt sind, nicht ausdrücklich geschlossen.'),
('Quadratischer Contractzwang','Gemeinsame Ergänzung verlangt C({…events:prospectiveEvents,checksum:64zeros}) in UTF-8 vor jeder Annahme; wörtlicher Ablauf serialisiert alle Prefixe.','F09 BLOCKING für explizites Freeze-Kriterium. 512 Events: 131328 Eventvorkommen statt 512. Keine Historyimmutability-Sicherheitsanforderung erzwingt diesen Algorithmus.'),
])
p('Die 512-Grenze macht den Aufwand endlich, beseitigt aber keinen O(n²)-Contractzwang. Der konkrete Patch in §13 erlaubt intern Working-State/structural sharing und exakte inkrementelle Bytelänge, bei gleichen Übergängen und immutable veröffentlichten States. Kein neuer Snapshot-, Checkpoint-, Savechain- oder Autoritätsmechanismus wird benötigt. Eine einzelne Encode-Replayprüfung mit linearer abschließender Serialisierung ist sinnvoll; vollständige Prefixserialisierung nach jedem Event ist dafür unnötig.')
end()

section(9,'Error Boundary')
table(['Grenze','Normativer öffentlicher Ausgang','Private Diagnose / NI-Prüfung'],[
('Malformed/foreign/stale/unknown/unreleased/wrong-kind Ref bei aktiver Session','ACTION_UNAVAILABLE, gleicher public shape, keine echo IDs oder fehlenden refs.','SB §4/5 und B02–04/B14–16; INFO modelliert ACTION_NOT_AVAILABLE, kein automatisch normativer Codewechsel.'),
('Valid known investigation ohne Fund','Erfolg mit observations:[].','Legitime Information über nutzbare Aktion; kein hidden evidence count.'),
('NPC unavailable question / unknown NPC','ACTION_UNAVAILABLE.','5B QUESTION_NOT_AVAILABLE private; existence vs askability nicht differenzieren.'),
('NPC decline / does_not_know / uncertain','Erfolgreicher selected Observation DTO.','Spielinhalt, keine Errorcodes. Keine implizite factivity.'),
('Valid accusation false/U/out of scope/missing Required','Binär not_solved.','Keine per-Claim-Gründe, counts, remainingRequired, solutionHash oder proofpath.'),
('Domain Binding/Ref/Portthrow','Generische technische Nichtverfügbarkeit; kein not_solved.','HOST_FAILURE nur trusted; private Domain-/Zod-/Refdiagnose nicht weitergeben.'),
('Session closed / event/save limit','SESSION_CLOSED / LIMIT_REACHED in festgelegter Priorität.','Hängt von bekanntem Verlauf ab; zulässige Declassification, kein Existenzorakel.'),
('Load/Replay-Fehler','Keine Teilstates/Privateindexdetails; finale Public-DTO-Codemap fehlt.','SC besitzt detaillierte Codes; SB §7 eventIndex intern. INFO verlangt generic rejection. Nicht ohne explizite Transportregel veröffentlichen.'),
('M2 unknown claim','M2 §5.1/AC05/06 verspricht no-throw für beliebige unknown/Getters.','Zod safeParse allein schützt vor werfendem Getter nicht. F08: Plain-JSON-Vertrag exakt einschränken; keine JS-Sandbox erfinden.'),
])
p('INFO berichtet 1024 Modell-Twins mit 0 unerlaubten Unterschieden; das ist historische, begrenzte Modellevidenz. Session A/B/C war dort nicht als aktuelle Quelle verfügbar. Die heutige SB-Facade schließt action error classes weitgehend, die öffentliche Loadfehlercodierung ist noch nicht vollständig festgelegt. Bytegleiche Outputs über verschiedene geheime Packageversionen werden nicht versprochen: packageHash und Refrotation sind deklarierte Identitätsmetadaten; legitime Verdictabfragen dürfen sich unterscheiden.')
p('INFO-F01/F02 wurden hier direkt am Originalhost nachgestellt: public_initial iteriert alle Truthpersons/locations; eine nichtinitiale zusätzliche Person erhöht suspects von 4 auf 5. Canonical-Evidence-Rename bei konstanten public aliases/Texten dreht die Kartenreihenfolge. Dies sind lokale Boundaryproben des alten Scratchhosts, keine production bugs und kein zertifiziert spielbarer rebound Twin. M4/SB regeln bereits Publicref-Sortierung; deren reale Fallübernahme fehlt.')
p('Ausdrücklich akzeptiert: selected stance/mention/card count, geordneter Playerverlauf, binäres Verdict, veröffentlichte Kandidatenliste und immutable Packagewechsel. Nicht behauptet: konstante Laufzeit, Schutz des manipulierten JS-Heaps oder Geheimhaltung vollständig lokal ausgelieferter Fallassets. Diese Non-goals werden nicht zu neuen Freezeanforderungen umgedeutet.')
end()

section(10,'Vitrine Witness')
p('Der vollständig verlangte abstrakte Fluss ist mit den Originalcontracts nicht schließbar. Nachfolgend steht für jeden Pfeil sein Owner, exakter Typ und fehlende Naht. Fünf produktive Beschaffungsaktionen sind im Originalhost nachgestellt; nach anschließender Beleganklage lautet phase=solved. Das ist weiterhin das alte observed/citation-Modell.')
table(['Schritt / Pfeil','Daten / Typ','Contractowner','Belegt / fehlend'],[
('start→initial knowledge','InitialSetup.known: 4 Personen, 5 Orte, Medaille, e04; keine discovery.','SA initialPlayerKnowledge; SB initialSession.','Grantliste kompatibel. Public brief/rules/labels Outputowner und Binding fehlen (F03).'),
('investigate Hof→Access','SessionEvent investigate/search_location/target PlayerRef → canonical locationId; known canonical refs.','SB §5→M3 resolveInvestigation.','Typkonversion beschrieben; tatsächliche M1-Refs unbestätigt.'),
('Access→release D03','found evidence:d03 → new evidenceId → EvidenceObservation.','SB atomic orchestration→M4 releaseEvidence.','Alte card{ref,title,text,observations} passt nicht zu neuem DTO. Kandidat verfügbar, Migration nicht finale Autorität (F11).'),
('release→knowledge','D03 mentions e05/Nora → Known e05, Discovery D03.','SA recordEvidence im SB commit.','Typisch geschlossen mit aktuellem DTO; kein Wahrheitssprung.'),
('knowledge→interrogate Nora Q08','Bekannter e05+Nora autorisiert Q08, refs translator und canonical known.','SB→M5A catalogue/profile→M5B interrogate.','Portkonstruktion F07 muss ergänzt werden.'),
('interrogate→observation','affirms eventHasItem(e05,Kamera), statement+mentions.','M5B §5.4.','Reveal Kamera, kein factivity. Originalhost nachgestellt.'),
('observation→knowledge→investigate Kamera','Kamera-Mention→known→examine_item→D04.','SA/SB→M3→M4.','Closed sequence im Design. D04 moderner Release nur Kandidat.'),
('interrogate Oskar Q14→Terminal→D05','affirms eventHasItem(e06,Terminal), mentions Terminal; examine_item.','M5B→SA/SB→M3/M4.','Gleiche Grenze; unabhängige Beschaffungskette.'),
('Evidence/NPC observations→proof roots','D04 p03/p04, D05 p05 als zertifizierte OBSERVED; NPC selected reports bleiben Reports.','Soll authored Witnessadapter→SOL ReleasedObservation sein.','KEIN vollständiger normativer Producer. F02, kein Mock zum Auffüllen.'),
('released premises→public license receipts','exclude:max/nora/oskar; remaining:Lina erst nach veröffentlichter Schlussbasis.','Soll authored public-rule release→SOL PUBLIC_RULE sein.','Runtime DTO/Receipt/Releaseeligibility offen. Keine private remaining-Kante initial exportieren (F02/F03).'),
('proof→accusation','4 hergeleitete direct_actor-Literale; Player wählt Antwort.','SOL ist Authoringchecker; SB accuse liest KEINE Proofclosure.','Pfeil fehlt absichtlich im aktuellen Runtimevertrag. Vitrine verlangt dagegen Receipt: F04.'),
('accusation→challenge','6 PlayerConclusionClaimvarianten feldweise canonical; hier 4 direct_actor-Literale.','SB→M2 parseAccusation→CH evaluateChallengeAccusation.','Geschlossen nach scope reconciliation; keine automatische UI-Expansion als Contract behauptet.'),
('challenge→verdict','solved/not_solved; first solved terminal.','CH→SB.','Gleiches vollständig richtiges initial guess: aktueller Sessionvertrag solved, Originalhost not_solved.'),
('verdict→save','phase/verdicts derived, persistierte accepted inputs + identity + checksum.','SC §8.','Legacy manifest saved commands ist anderes Format; final package identity fehlt.'),
('save→replay→gleicher State','Wire check→identity→checksum→ordered accepted events→fresh actual releases.','SC→SB.','Designpfad exakt; voller Vitrine-Witness bleibt wegen F01/F02/F03/F04/F07/F11 NOT VERIFIED.'),
])
p('Das authored Fallmodell selbst bleibt plausibel bounded lösbar: CERT enumeriert 192 Fortschrittszustände, 16 Boolantworten für vier direkte Rollen und 1200 konstruierte Folgen. Diese Zahlen sind gelesene Certification-Evidenz, nicht hier erneut ausgeführte Gesamtprüfung. Zertifiziert wurde gerade nicht die aktuelle Vertragskette. Hier neu ausgeführt: fünf Originalhost-Beschaffungsaktionen+Anklage, Frühanklage, falscher Belief, uncertainty, Konfliktreports, zwei Releaseboundary-Proben, Sessiontextvergleich, Empty-save-Golden und Serialisierungsarbeit.')
end()

section(11,'DAG')
table(['Graph / Kante','Befund','Minimaler Umgang'],[
('Baseline Truth→Solution; Truth+Solution→NPC snapshot/projection','Azyklisch; bestehende Datenschemata.','Keine Verantwortung→Präsenz-Rückinferenz einführen.'),
('M3/M4/M5A→Baseline; M5B→M5A+Projection','Keine nötige M3↔M4-Direktabhängigkeit. M4/M5B verwenden Refport, keinen M1-Import.','M1 trotzdem Laufzeit-/Integrationdependency des Host.'),
('M2→Baseline; CH→M2; SOL→Baseline+M2','Azyklisch. SOL benötigt nicht implementierte Session zur Unitsemantik, nur trusted Witnessport zur Zertifizierung.','Keine Solvability-PASS-Abhängigkeit vor Ref/Access/Presentation erfinden.'),
('SA→M1/M2/M3/M4/M5A/M5B/CH/SOL-parser; SB→SA; SC→SA+SB','Bekannte Frontmatter-DAG azyklisch. B runtime-importiert M2/M3/M4/M5B/CH transitiv verfügbare accepted Module.','A kann B/C initial types definieren, aber ruft sie nicht zum Resolve auf. A→SOL nur Parser, kein echter Witness.'),
('B prospective save size→A serializer; C encode/decode→B replay','Kein B→C-Import. Envelopeform gemeinsam beschrieben.','Byteprofil hat C als semantischen Owner; exakte Größenhilfe darf A/B ohne C-import berechnen.'),
('Real witness→SB replay+M4/M5B traces→SOL check','Kein harter Zyklus, wenn SA nur Bindung prüft und nicht Zertifizierung zum Auflösen verlangt.','Nicht parse/resolved package mit publication certificate verwechseln.'),
('Dynamic PUBLIC_RULE depends on derived proof closure','Privater Adaptercode kann Regelinstances nach bereits veröffentlichten Prämissen freigeben; genaue Eligibility-/Producerregel fehlt.','Nicht automatisch alle privaten edges initial releasen; F02 muss release order ohne self-licensing spezifizieren.'),
('Component hashes→RC→RH→PH→PK→save checksum','Aktuell bekannte definierte Hashkanten ohne Rückbindung.','manifest darf weder PK noch PH als eigenen Input tragen.'),
('M1 refs←final PK bei gleichzeitiger PK←refsHash','Mögliche harte cycle, kein belegter aktueller M1-Defekt.','M1 fehlt: Graph nicht abschließend geschlossen. Kein Fixed-point-/Dummyhash.'),
('Challenge Draftpin→alter M2-Hash','Keine cycle, aber dokumentarisch stale Dependency.','Aktuellen M2-Textinhalt genau pinnen, acceptedCommit erst bei tatsächlicher Annahme.'),
])
p('Unnötig: M4→M3 oder M5B→M4 nur wegen identischer Refports; SOL-checker als Prerequisite jedes laufenden accuse. Fehlend: normativer M1-/public-content-/Witnessadapter-Anschluss. Ein noch nicht gepinnter Commit ist kein erfundener Graphzyklus. Der bekannte DAG lässt eine endliche Build-/Authoringreihenfolge zu, sein unbekannter Teil darf nicht als PASS gelten.')
end()

section(12,'50 Freeze Attacks')
p('Jede Zeile formuliert eine plausible Implementiererentscheidung. CLOSED/NONBLOCKING bedeutet: Contracts bestimmen die Semantik bereits eindeutig, Umsetzung darf wählen. OPEN/BLOCKING bedeutet: eine normative Lücke oder Contradiction bleibt. OPEN/NONBLOCKING markiert nur die redaktionelle Quellenpflege bei aktuell identischer Semantik. Dies ist ein Spezifikationsangriffskatalog; er behauptet nicht 50 ausgeführte Produktionsmutationstests.')
attacks=[
('Andere Ref-Preimage-Trennung/Encoding wählen.','Nicht eindeutig; vollständiger M1 fehlt.','F01'),
('PlayerRefs mit finalem packageHash statt truthHash erzeugen.','Nicht entscheidbar; mögliche Hashrückkante.','F01'),
('Salt bei jeder Packageänderung rotieren statt beibehalten.','M1-Namespacepolicy unbekannt.','F01'),
('Globale Refkollision still reindexieren.','SA §2 verlangt injektiv/inverse, fehlende Tabelle/Kollision Packagefehler.',''),
('Salt ändern, tatsächliches Mapping gleich lassen und empty save laden.','SA §2/9 refsHash bindet config+mapping; Save inkompatibel.',''),
('Freies validiertes Ref genügt als Berechtigung.','SB §4 verlangt prefix-Known und passenden kind.',''),
('Found Evidence direkt als Truth/Playerkarte ausgeben.','M3 §6 intern; SB→M4 vor Discoverycommit.',''),
('Evidence.source automatisch zum Fundort machen.','M3 §4/5 explizit nicht aus source ableiten.',''),
('Initial bekannte Evidence sofort releasen.','SA §2/A14: Awareness ohne Discovery/Release.',''),
('Report.claim referenzierte Entity automatisch known machen.','SA §3 erlaubt nur mentions/Evidence/initial; closure-Verletzung Hostfehler.',''),
('Source=observation ohne Zertifikat zu OBSERVED machen.','M4 verneint das; aber exakter zulässiger Zertifikatsvertrag fehlt.','F02'),
('Zertifikat nach Reportindex statt vollständigem Payload matchen.','Kandidat nutzt exakte Reports; finale Matching-/Canonicalisierungsvorschrift fehlt.','F02'),
('Wahr passenden Claimalias per first-match Proposition auswählen.','Kein vollständiges authored Alias/Literal-Mapping im Adaptercontract.','F02'),
('NPC affirms nach Lesen interner knowledge als faktiv nehmen.','M5B knowledge/belief öffentlich gleich; SOL automatische Reportseeds verboten.',''),
('Leans_affirms als Report=true im Solvabilityport codieren.','SA §2 verbietet Booleanaufwertung; konkrete Adapterauslassung/Union fehlt.','F02'),
('Konfliktreports durch latest writer überschreiben.','SA §3/B22: beide quellengebunden erhalten.',''),
('Unreleased expected profile.observations als replay roots zurückgeben.','SA §2 und SOL §6 ausdrücklich verboten.',''),
('Alle PUBLIC_RULE-Instanzen mit Täteryield initial veröffentlichen.','Fall fordert spätere Freigabe; normativer public-rule release/receipt fehlt.','F02'),
('Proofseed direkt aus Evidence.links erzeugen.','M4/SOL autorisieren das ausdrücklich nicht.',''),
('True earlier presence zum direct_actor-Beweis erklären.','SOL nur explizit gelicensete kanonisch konsistente Kante; kein eingebauter Schluss.',''),
('Core-solved als Player-solved ausgeben.','M2 §7a, SB §5: immer CH.',''),
('Undetermined zu false umschreiben.','M2 neutral, CH status matching rejects beide Polaritäten.',''),
('Extra true literal außerhalb Scope akzeptieren.','CH §5 not_solved ohne per-Literal-Hinweis.',''),
('Negatives Required durch Abwesenheit/ähnliche Claims ersetzen.','M2 §7 literal/claimKey/Polarity exakt.',''),
('Required-only Scope für vorgewählte Ja/Nein-Frage erlauben.','M2 §15 verbietet, CH §6/P21 erlaubt.','F05'),
('Vier direct_actor-Claims statt zwölf Rollenclaims authoren.','required_literals vs Rollenfrage-Priorität für Vitrine nicht endgültig geschlossen.','F05'),
('Öffentliche Kandidaten nach tatsächlichen Assignments filtern.','CH §6 verbietet answerabhängigen Scope; Gegenweltcheck.',''),
('Zusätzliche wahre, bestimmte in-scope Claims akzeptieren.','CH §2/5 erlaubt; keine generelle answer-equality nötig.',''),
('Vitrine schon vor Belegen mit korrekter vollständiger Antwort lösen.','SA/B §6 ja, VIT/BRIEF/certification receipt nein.','F04'),
('Saveevent Befragung als ask statt interrogate speichern.','M5B §6 vs SB §4.','F06'),
('Wiederholte leere Suchen oder decline/dnk nicht loggen.','SB §5/B06/17/18/34: akzeptiert/loggen.',''),
('Nach solved weiteres Event ignorieren und log abschneiden.','SB §5/7: closed; replay invalid history, niemals trimmen.',''),
('Beim zweiten fehlgeschlagenen Release ersten Fund behalten.','SB §5/B08 atomarer vollständiger rollback.',''),
('Received NPC report einmal deduplizieren statt pro Gespräch erfassen.','SA §3/B21: gleiche Payload, verschiedene eventIndex-Records.',''),
('Raw pkg.refs direkt an M4/M5B geben.','Resolved refs hat keine caseId/truthHash, Consumer braucht beide.','F07'),
('PlayerKnown refs direkt als InterrogationInput.known verwenden.','M5B erwartet canonical EntityRef; exakte SB-interrogate-Portkonversion nur teilweise beschrieben.','F07'),
('Initialsuspects aus Truthpersons statt initialKnown/publicRoster bauen.','Alter Host tut das; V1 besitzt keinen vollständigen PublicViewvertrag.','F03/F11'),
('Karten in canonical found-ID-Reihenfolge emittieren.','SB/M4 regeln public ref order; Originalhost entspricht nicht.','F11'),
('Questiontext ändern, Identity gleich lassen.','Kein bindender V1-Owner/Pfad für questionText.','F03'),
('Public law negieren oder Roster ändern, neues Package nicht erzeugen.','Im alten hostHash gebunden, in SA input nicht zwingend enthalten.','F03'),
('Falschen npc provenance/asOf ändern, Package gleich lassen.','SA snapshotHash kompletter Snapshot, RC/PK ändert.',''),
('Proof/Witnessarrays pauschal als Mengen sortieren.','SA §2: witnessStepIds geordnet, typisierte Sets exakt normalisiert.',''),
('Saveevents mit Truth-Mengenserializer sortieren.','SA/SC strukturelles C bewahrt Eventreihenfolge.',''),
('Nichtkanonisches SaveJSON mit doppelten Keys akzeptieren.','SC §8 wire-equality rejects nach JSON.parse.',''),
('Gültigen Verlauf editieren/rechecksummen, trotzdem laden.','SC §8 ausdrücklich erlaubt bei valid replay; kein Anti-Cheat.',''),
('Jeden bisherigen Prefix für Prospective-Savebytes neu serialisieren.','Wörtliche SA-Ergänzung fordert genau das, O(n²)-Kriterium nicht erfüllt.','F09'),
('Beim Replay intern append und frozen subtrees teilen.','Neue deeply frozen Kopie/gleicher Reducer lässt Interpretationsspielraum; explizite äquivalente interne Strategie nötig.','F09'),
('Werfenden Getter bei M2 unknown claim safeParse durchlassen.','M2 no-throw auch Getter vs Zod-Aufruf; Plain-JSON-Grenze widerspricht nicht normiertem Versprechen.','F08'),
('Detaillierten Loadcode/eventIndex an Spieler schicken.','Private Index normiert; vollständige öffentliche Loadcodemap fehlt.','F10'),
('Drei Session-Semantiktexte unabhängig korrigieren.','Aktuell bytegleich, aber keine exakte normative Ein-Owner-/Vorrangregel für Weiterentwicklung.','F12'),
]
assert len(attacks)==50
table(['#','Plausible Interpretation / Änderung','Antwort aus verfügbaren Contracts','Klasse / Finding'],[(i,a,b,('OPEN / NONBLOCKING — '+f if f=='F12' else 'OPEN / BLOCKING — '+f) if f else 'CLOSED / NONBLOCKING') for i,(a,b,f) in enumerate(attacks,1)])
p(f'Ergebnis: {sum(bool(f) for _,_,f in attacks)} offene Angriffe, {sum(not bool(f) for _,_,f in attacks)} geschlossene Angriffe. Davon 22 BLOCKING und eine redaktionell NONBLOCKING (F12). Die Zeilen werden zu elf blockierenden Findings plus einem redaktionellen Finding gebündelt; kein künstliches Zählen gleicher Rootursachen als neue Architekturprobleme. Öffentliches standalone arbitrary JS, universelle Casegrößen, Online-Autorität und natürliche Sprach-Spoilererkennung sind keine zusätzlichen V1-Requirements.')
end()

section(13,'Blocking Findings')
p('OLD→NEW-Patches sind Vorschläge im Bericht; keine Quelldatei geändert. Fertige Patchtexte stehen nur dort, wo die vorhandene Semantik eine genaue Korrektur erlaubt. Fehlende Originale oder noch nicht spezifizierte Zertifikats-/Public-Content-Interfaces werden nicht durch erfundene Vollverträge „repariert“. Diese offenen Abschlussbedingungen reichen für NO-GO.')
findings=[
('F01','MYST-0001 / finale Reparatur nicht verfügbar','M4 §1.3/5.3, M5B §1.3, SA §2; Artifactsearch.','BLOCKING — fehlende Originalautorität.',
 'OLD: Nur sekundäre Refmuster/Portannahmen gelten als ausreichender Anschluss.\nNEW: Freeze von Ref-/Sessionintegration bleibt NOT VERIFIED, bis der vollständige aktuelle MYST-0001-Originaltext mit exact namespace/preimage/encoding/config/resolve/collision/goldens gelesen und gegen SA bestätigt ist. Ein Final-Repair-Text muss im Freezeinventar mit Inhaltshash gewählt sein. Kein generierter Ersatzalgorithmus.'),
('F02','Release→Proof / Public-Rule / Witnessadapter normativ offen','SA §2 UNKNOWN/BLOCKER; SOL §4/6; CERT R2; vier-entry LAB-Kandidat.','BLOCKING — zentrale fehlende Schnittstelle.',
 'OLD: certificateData = beliebiges bounded JSON; exakter Release-/Rule-/Eventtabellenadapter später.\nNEW: Für diesen Freeze muss ein einzelner normativer authored Adapteranhang gewählt sein, der certificateData exakt typisiert, Step-ID→SessionEvent bindet, Evidence/NPC-Claim→konkretes Literal+Quelle+Observation-ID abbildet, uncertainty ausdrücklich ohne Booleanroot lässt, public Rulepayload/Receipt und Eligibility fixiert sowie keine first-match-Aliase akzeptiert. Checker konsumiert nur real replayte Releasepayloads, keine expected observations. Volltext fehlt; dieser Bericht behauptet keinen fertig entworfenen Anhang.'),
('F03','Öffentliches authored Gameplay nicht vollständig packagegebunden','SA CasePackageInput/RC-Tabelle; VIT host.publicRules/questionText/entityLabels/roster/BRIEF.','BLOCKING — Ownership+Identity+Releaseboundary.',
 'OLD: Package bindet nur bereits aufgeführte Komponenten; publicRules/questionText/labels/brief können extern bleiben.\nNEW: Bestehender Vitrine-Hostanhang muss einen einzigen normativen Owner und exakte private/public Shapes für öffentlichen Frage-/Roster-/Regel-/Labelinhalt benennen und deren autoritative Bytes in den Release-/Packageinput binden. Gleiche Packageidentity mit anderem bedeutungsänderndem Frage-/Regeltext ist unzulässig. Bound-content Mutationstest muss alten Save im neuen Package ablehnen. Kein implizites Truth-Roster als PublicView.'),
('F04','Vitrine Receiptpflicht widerspricht Session V1','SA/SB/SC §6; VIT requireReleasedProof=true; BRIEF Auftrag; CERT §14/20.','BLOCKING — bewusste semantische Entscheidung noch nicht konsolidiert.',
 'OLD (VIT): requireReleasedProof:true; accuse{actor,evidenceRefs}; not_solved auch bei unzureichenden Belegen.\nNEW (falls Session V1 maßgeblich): requireReleasedProof entfernen; Event ist strikt accuse{literals}. Richtige vollständige bekannte Antwort darf initial solved liefern. BRIEF „Zitiere unabhängige entdeckte Nachweise…“ → „Untersuche die Nachweise und wähle den eigenhändigen Entnehmer. Die vollständige richtige Antwort schließt den Fall ab.“ Aussage not_solved unterscheidet unzureichende Belege entfernen; angepasste Caseabnahme/Expected-results neu binden.\nDiese NEW-Fassung ändert Gameplay, ist deshalb kein semantikerhaltender Kleinpatch und wird hier nicht als bereits gewählte Produktentscheidung ausgegeben. Bleibt die Belegpflicht maßgeblich, ist Session V1 dafür ausdrücklich unzureichend; kein verstecktes Gate ergänzen.'),
('F05','Required-only / enge Rollenfrage widersprüchlich','M2 §15; CH §6/P21/Rollenzeile; VIT 4 direct_actor Claims.','BLOCKING; präziser Textrepair verfügbar.',
 'OLD M2 §15: „allowedClaims enthält Claims ohne Polarität, nie eine Required-only-Whitelist…“\nNEW: „allowedClaims enthält Claims ohne Gewinnpolarität. Verboten ist eine aus geheimen Required-Zielen oder Assignments abgeleitete Kandidatenauswahl. Gleichheit mit Required-Claimkeys ist zulässig, wenn die abgefragten Dimensionen vor Antwortwahl öffentlich und antwortunabhängig festgelegt sind; CH §6 entscheidet die Publicationprüfung.“\nOLD CH Rollenzeile: pauschal alle drei Rollenclaims pro Kandidat.\nNEW: „Bei einer offenen/all-roles Frage alle drei Rollenclaims pro öffentlich gewähltem Kandidaten. Eine vorab öffentlich festgelegte einzelne Rollen-/Ja-Nein-Frage fällt unter required_literals; alle öffentlichen Kandidaten für genau diese feste Dimension anbieten.“\nVIT/Proof/Questionanhang ausdrücklich required_literals, direct_actor für vier feste Kandidaten, keine identify_all_responsible-Deklaration.'),
('F06','Persistentes ask vs interrogate','M5B §6 gegen SB §4; alle Sessioncopies.','BLOCKING; kleiner eindeutiger Repair.',
 'OLD M5B §6: Persistiert ausschließlich {type:"ask",npc:PlayerRef,questionId}.\nNEW: Session B besitzt das accepted Eventvokabular. Eine akzeptierte Befragung wird als {type:"interrogate",npc:PlayerRef,questionId} gespeichert. Frageablehnung wird nicht gespeichert. Replay benutzt exakt dieses Event; ask ist nur Legacy-Scratch und kein V1-Alias. Bei decline/does_not_know existieren keine mentions; nur statement-bearing Variante erweitert Known.'),
('F07','Ref-Port / Known-Übersetzung beim Consumer fehlt exakt','SA ResolvedCasePackage.refs vs M4 §5.1 / M5B InterrogationInput; SB §5.','BLOCKING; kleiner exakter Adapterpatch.',
 'OLD SB: pkg.refs bzw. „refs“ direkt an releaseEvidence/interrogate reichen.\nNEW SB: const translator = {caseId:pkg.truth.caseId, truthHash:hashCaseTruth(pkg.truth), refFor:pkg.refs.refFor}; den aktuellen unveränderlichen pkg.truthHash darf ein trusted vorgebundener Host äquivalent wiederverwenden. Für jeden prefix-KnownRef pkg.refs.resolve auflösen, kind/inverse prüfen und Canonical EntityRef[] an M3/M5B übergeben; nicht KnownEntity{ref,firstSeen}. M4 bekommt translator. M5B bekommt {truth,solution,snapshot,catalogue,profile,refs:translator,known:canonicalKnown,questionId}. Kein Clienttranslator. Missing/wrong binding ist HOST_FAILURE.'),
('F08','M2 no-throw für beliebiges JS unknown nicht erfüllt','M2 §5.1/AC05/06; CROSS X107 Getterprobe; SA/SOL Plain-JSON-Grenze.','BLOCKING; kleiner präziser Scopepatch.',
 'OLD: wirft für keine unknown-Eingabe, inkl. Objekt mit Getter; safeParse wirft für keine Eingabe.\nNEW: No-throw gilt für unterstützte Plain-JSON-Werte; Runtime-untrusted Inputs kommen aus eigenem begrenztem JSON-Parse. Accessoren, Proxies, fremde Prototypen, Zyklen und fremder ausführbarer JS-Code sind keine unterstützte Schnittstelle. AC05/06 ersetzen Gettergarantie durch Plain-JSON-positive/negative Werte; trusted Host-Portexceptions behandelt Session außen als HOST_FAILURE. API claim:unknown bleibt erhalten, kein Sandboxclaim.'),
('F09','Quadratische Prefixarbeit durch wörtlichen Contract','SA gemeinsame Ergänzung, helper Kopie, SB/SC replay; SCALE Copy-Kosten.','BLOCKING für verlangtes Komplexitätskriterium; semantikerhaltender Repair.',
 'OLD: B prüft Größe durch vollständiges C(envelope mit prospectiveEvents) pro Event; überall neue tief gefrorene Kopie.\nNEW: Normiert sind exakte prospective canonical UTF-8-Bytelänge, atomarer Commit und beobachtbare Unveränderlichkeit, NICHT Vollprefixserialisierung/-kopie pro Event. Frozen Subtrees dürfen geteilt werden. replaySession darf einen privaten Working-State benutzen, wenn Übergänge/Outputs/Limits/Errorpriorität genau reduceSession entsprechen; veröffentlichte Snapshots und Endstate bleiben immutable und caller Inputs unmutiert.\nExakte Größenäquivalenz: B0=UTF8Length(C({schemaVersion:1,packageIdentity:pkg.identity,events:[],checksum:"0".repeat(64)})). Für n Events: B=B0+ΣUTF8Length(C(event_i))+max(0,n−1). Keine Rundung/Approximation; rejected event ändert B nicht. Encode behält Replay-/Derivedvergleich und serialisiert den endgültigen Body. Differential Prefixchecks gegen Vollserialisierung genügen; kein neuer persistierter Cacheowner.'),
('F10','Finale Public-Loadfehler-Allowlist offen','SC §7/8 detaillierte Codes; SB eventIndex privat; INFO §13 generic rejection.','BLOCKING für vollständige Error-NI-Grenze; kleiner exakter Facadepatch.',
 'OLD: Decoder-Union kann vom Transport beliebig weitergereicht werden.\nNEW: decodeSessionSave bleibt trusted Host-API. Playerfacade konstruiert exakt success-Output oder einen konstanten generischen SAVE_UNAVAILABLE-Fehler für jede nicht erfolgreiche Lade-/Replayoperation. Keine eventIndex-, checksum-, packagecomponent-, Zod-, ID- oder Proofdiagnose öffentlich. Detaillierte Codes bleiben im privaten Hostlog; HOST_FAILURE wird niemals not_solved. Autoritative Publiccodekonstante im Sessiontransportanhang wählen, keine Änderung an innerer Decodersemantik.'),
('F11','Vitrine aktuelle Release-/Save-Kompatibilität fehlt','VIT card()/manifest/host presentation; CERT NOT CERTIFIED; INFO F01/F02.','BLOCKING — realer typed witness nicht durch alte Simulation ersetzbar.',
 'OLD: Alte card{title,observations[type:observed,value]} / commands-Save / provisional refs gelten als aktueller Witness.\nNEW: Finale Casefassung besitzt gültige M4.entries/mentions/reports, finalen CH-Anhang, final gebundene Ref-/Public-/Zertifikatsdaten und SessionEvent-Trace. Aktionsabbildung explizit: search→investigate/search_location; read_record→investigate/examine_item; ask→interrogate. accuse folgt F04. Startbrief ausschließlich aus ausdrücklich freigegebenen Initialdaten; Evidencekarten nach öffentlichem Ref statt canonical ID. Erst dieser Trace kann current-contract Witness sein; alter Scratch-PASS bleibt historische Evidenz.'),
('F12','Eine finale Textautorität für Session-Split fehlt','SA/SB/SC gemeinsame §§2–11 alle normativ, bytegleich; CH pin alter M2.','NONBLOCKING — identische Semantik, kein aktueller fachlicher Mehrfachowner; Quellenpflege.',
 'OLD: Drei gemeinsame Semantikblöcke gelten normativ ohne priorisierten Owner; CH nennt älteren M2-Hash.\nNEW: SA besitzt Packageidentity/JSONprofil/PlayerKnowledge (§§2–3 und Packagehelper); SB besitzt Events/Transition/Terminal/Replay/Sessionlimits (§§4–7 und zugehörige Limits); SC besitzt Savewire/Checksum/Decode/Compatibility (§§8–9 und Savegrenzen). Gleichlautende Kopien in anderen Dateien sind informativ; Konflikt erfordert Revision, keinen stillen Vorrang zur Runtime. §10-Publicboundary gehört zum expliziten Hostanhang. Finale Texte über genaue Inhaltshashes pinnen; CH Basishash auf gewählten M2-Candidate aktualisieren. acceptedCommit:null bleibt bis tatsächlicher Annahme, keinen Commit erfinden.'),
]
table(['Finding','Problem','Evidenz','Einordnung'],[(x[0],x[1],x[2],x[3]) for x in findings])
for ident,title,evidence,classification,patch in findings:
 parts.append('<h3>'+ident+' — '+html.escape(title)+'</h3>');pre(patch)
p('F12 wird ausdrücklich nicht als NO-GO-Grund verwendet: identische normative Kopien sind aktuell semantisch eine Autorität; der alte CH-Basishash ist als Herkunftspin erkennbar. Die vorgeschlagene Ein-Owner-Regel verhindert künftigen Drift, sie repariert keinen heute belegten Gameplaykonflikt. Nicht blockierend: keine production implementation heute; fehlender Blindtest/Funbeweis; optionale Autorendiagnose-/Editorqualität; bewusst fehlende Online-/Anti-Cheat-/Migrationfeatures; O(n²)-Stellen im vorhandenen Worldvalidator innerhalb gewählter endlicher Slicebudgets; nichtkanonische Voransichten; getrennte M4/M5B.PlayerClaim-Namen ohne unqualifizierten Barrel. Keine neue Feature-Roadmap erforderlich.')
end()

section(14,'Final Verdict')
parts.append('<div class="verdict">NO-GO</div>')
p('Antwort auf die einzige Zielfrage: NEIN. Die tatsächlich verfügbare Mystery-Architektur ist nach den belegten Repairs noch nicht vollständig freeze-ready. Das entscheidende Problem ist die offene normative Integration: vollständiger M1, exact Release→Proof/Public-Rule/Witnesscontract und gebundener öffentlicher Fallinhalt fehlen; Vitrine und Session wollen unterschiedliche Siegbedingungen. Deshalb wäre FREEZE READY WITH SMALL REPAIRS derzeit zu stark.')
p('M2 Core/CH-Exactness, M3 Discovery, M4 Report-Release, M5 Authoring/Commitment und bounded SOL-Proof bilden eine nachvollziehbare Grundlage. Session A/B/C schließt Eventautorität, Ableitung, Terminalität und große Teile von Save/Identity. Genau diese belastbaren Grenzen erlauben endliche Repairs statt eines Architekturwechsels. Sie ersetzen aber keine fehlenden Originale und entscheiden den Belegpflichtkonflikt nicht.')
p('Freeze kann erst neu bewertet werden, wenn F01–F04/F11 durch ausgewählte finale Originale geschlossen und die präzisen F05–F10-Korrekturen konsistent übernommen sind. F12 ist redaktionelle Pflege und verändert das Verdict nicht. Kein Commit, neue Featureplanung oder Implementierung wurde in diesem Auftrag ausgelöst. STOP.')
parts.append('<details><summary>Quellenregister — Originalbytes und Scope</summary>')
table(['Kurzquelle','Originaldatei','SHA-256 der lokalen Originalbytes'],[(k,v,hashlib.sha256((R/'evidence/library'/v).read_bytes()).hexdigest()) for k,v in sources.items()])
p('Repositorydateien wurden über fixierte Commit-URLs vollständig für den relevanten Domainkern heruntergeladen; Blob-SHAs sind im vollständigen Tree verankert. Das gepinnte main hat seven domain files, die hier vollständig gelesen wurden. Die Testzahlen anderer Labs bleiben deren historische Resultate. Keine externe Bibliotheksinstallation oder Produktionssuite als eigener Testlauf behauptet.')
p('Neu ausgeführte unabhängige Proben: Originalhostdefinitionen bis vor scenarios[] geladen, ohne dessen Generator-/Writebackteil auszuführen. Private probe.py/probe-results.json liegen im Scratchprüfverzeichnis. Die drei Session-Gemeinschaftsblöcke wurden bitgleich verglichen. Verfügbare normative Draftkopien in den verschiedenen Evidenzarchiven besitzen jeweils identische Raw-SHA-256; kein versteckter neuerer Contract wurde darin gefunden.')
parts.append('<details><summary>Eigene Probe-Ergebnisse (privat)</summary><pre>'+html.escape((R/'probe-results.json').read_text())+'</pre></details>')
parts.append('<details><summary>Vorab fixierte Freeze-Kriterien</summary><pre>'+html.escape((R/'FREEZE-CRITERIA-PRECOMMITTED.md').read_text())+'</pre></details></details>')
end()
titles=['Freeze Criteria','Artifact Completeness','Ownership','Producer/Consumer','Release→Proof','Challenge','Package Identity','Session','Error Boundary','Vitrine Witness','DAG','50 Freeze Attacks','Blocking Findings','Final Verdict']
nav=''.join(f'<a href="#s{i}">{i}. {html.escape(t)}</a>' for i,t in enumerate(titles,1))
doc='''<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MYSTERY INDEPENDENT FREEZE VERIFICATION</title><style>
:root{color-scheme:light;--navy:#122338;--ink:#213044;--line:#d5dce3}*{box-sizing:border-box}body{margin:0;background:#f3f5f7;color:var(--ink);font:16px/1.6 system-ui,-apple-system,Segoe UI,sans-serif}main{max-width:1400px;margin:auto;background:white;padding:40px 44px 70px}header{border-bottom:4px solid var(--navy);padding-bottom:24px}h1{font-size:clamp(26px,4vw,44px);line-height:1.15;color:var(--navy);max-width:1050px}h2{font-size:27px;color:var(--navy);border-top:1px solid var(--line);padding-top:28px;margin-top:34px}h3{font-size:19px;margin-top:28px}.kicker{letter-spacing:.12em;text-transform:uppercase;font-size:12px;font-weight:700;color:#59708a}.verdict{display:inline-block;background:#922d2b;color:white;padding:8px 18px;font-weight:800;font-size:24px;letter-spacing:.04em}p{max-width:1120px;margin:18px 0}.scroll{overflow-x:auto;margin:22px 0}table{border-collapse:collapse;width:100%;font-size:14px;line-height:1.5;min-width:720px}th{text-align:left;background:var(--navy);color:white;padding:12px;vertical-align:top}td{padding:12px;border:1px solid var(--line);vertical-align:top;overflow-wrap:anywhere}tr:nth-child(even){background:#f5f7fa}pre{font:13px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;background:#eef2f6;border-left:3px solid #7791aa;padding:18px;white-space:pre-wrap;overflow-wrap:anywhere}nav{display:flex;flex-wrap:wrap;gap:8px;margin-top:25px}nav a{font-size:12px;background:#edf2f7;color:#22384d;text-decoration:none;padding:6px 9px;border-radius:4px}details{margin:22px 0;border:1px solid var(--line);padding:14px}summary{cursor:pointer;font-weight:600}section{scroll-margin-top:20px}@media(max-width:700px){main{padding:25px 18px}h2{font-size:23px}p{font-size:15px}}@media print{body{background:white}main{padding:0;max-width:none}nav{display:none}.scroll{overflow:visible}table{min-width:0;font-size:10px}h2,h3,tr{break-inside:avoid}details{display:block}pre{font-size:10px}}</style></head><body><main><header><div class="kicker">Read-only · unabhängiges Specification Lab · 04.10.2026</div><h1>MYSTERY INDEPENDENT FREEZE VERIFICATION</h1><div class="verdict">NO-GO</div><nav>'''+nav+'</nav></header>'+''.join(parts)+'</main></body></html>'
out=R/'MYSTERY-INDEPENDENT-FREEZE-VERIFICATION.html'
out.write_text(doc)
print(json.dumps({'path':str(out),'bytes':out.stat().st_size,'attacks':len(attacks),'openAttacks':sum(bool(f) for _,_,f in attacks),'blockingFindings':sum('BLOCKING' in f[3] and 'NONBLOCKING' not in f[3] for f in findings),'sections':len(titles)},ensure_ascii=False))
