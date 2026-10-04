from pathlib import Path
import json,csv,hashlib,html,re,collections,zipfile,datetime

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'certification'
SRC=ROOT/'sources'
PKG=ROOT/'extracted/FORGE-MINIMUM-VERIFIER-IMPLEMENTATION-PACKAGE'
REF=ROOT/'extracted/FORGE-VERIFIER-REFERENCE-EVIDENCE'
MAIN='3d7545d843883418348004e68717399a64da7a7d'
NORM='0e6d89179623535ed431206b2352dfdb66d8edbfad3340d6f10b77ef63c4f0d4'
E=html.escape
def table(headers,rows):
    return '<div class="table"><table><thead><tr>'+''.join('<th>'+E(str(h))+'</th>' for h in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+E(str(v))+'</td>' for v in row)+'</tr>' for row in rows)+'</tbody></table></div>'
def p(t):return '<p>'+t+'</p>'
def pre(t):return '<pre>'+E(t)+'</pre>'
def ul(items):return '<ul>'+''.join('<li>'+t+'</li>' for t in items)+'</ul>'
sections=[]
def section(i,title,body):sections.append((i,title,body))

identity=json.loads((OUT/'source-identity.json').read_text())
accept=json.loads((PKG/'deliverables/adversarial-matrix.json').read_text())
additional=json.loads((OUT/'additional-cases.json').read_text())
probes=json.loads((OUT/'probe-results.json').read_text())
tree=json.loads((ROOT/'main-tree.json').read_text())
baseline=json.loads((OUT/'main-baseline.json').read_text())
reference=json.loads((REF/'results/differential/cases.json').read_text())['cases']
rerun=json.loads((OUT/'reference-rerun.json').read_text())

reqs=[
('A-INPUT','A/C','§2, §4.1–3','Feste Repo-ID, positive sichere IDs, SHA/JSON/Trigger/PR/Ref-Abgleich'),
('A-FETCH','A','§2','Frische bare ODB, feste Remote und Refs, kein Checkout, kein Depth/Tag/Submodule/Redirect'),
('A-ENV','A','§2','Neue Env-Allowlist; fixed Git argv; keine Credential-/Hook-/Proxy-/Node-Injektion'),
('A-LAYOUT','A','§2','Replace auch packed, Alternates, Grafts, Shallow, Promisor, unerlaubte Config/Hooks reject'),
('A-RAW','A','§3','Typ, OID-Rehash, bounded Framing, Commitstruktur, Tree-OID/Sortierung/Rohduplikate'),
('A-PATH','A','§2–3','Rawbytes, ASCII, vollständige Prefix-/Case-/Leaf-Tries, Windowsnamen und Pfadlimits'),
('A-MODE','A/B','§3–4','100644 neu; 100755 nur unverändert; Symlink/Gitlink/Modeänderung reject'),
('A-HISTORY','A/B','§3–4','HEAD→BASE linear, echte Parents; BASE-Merges erlaubt; alle Zwischen-Snapshots; Netto-Diff nichtleer'),
('A-DIFF','A','§3','Rohpfadunion, ADD/DELETE/MODIFY/MODE_CHANGE; Mode+Content beide; kein Rename'),
('A-LIMIT','A/B','§2','ODB/Objekt-/Pfad-/Prozess-/Materialisierungsbudgets während Verarbeitung'),
('A-FS','A','§5','Frische Roots; alle Parents dir_fd/O_NOFOLLOW; Leaf O_EXCL; regular/nlink; bounded Bytes/Hash'),
('A-KERNEL','A/C','§2','Image-Kernel separat, nur geprüfter BASE-Manifestgraph, niemals HEAD-Verifier'),
('B-CONTRACT','B','§1, §4','Bestehender Format1-Parser und Präfixhash aus BASE; gebundener Task/Plan/Policyindex'),
('B-DEPENDENCY','B/Owner','§4, B/C Dependency','Echte akzeptierte SHA, nichtnull, authentische BASE-Ancestry; externe Annahme nicht erfinden'),
('B-SCOPE','B','§4','Exact create/modify; keine Deletes/Modeänderungen/Coordination-Ausnahme'),
('B-FREEZE','B','§4, §6','DEV-TCB/Config/Toolchain/bestehende Tests gefroren; Owner nur explicit TCBscope'),
('B-REGISTRY','B','§2, §4','Commands sind Registrydaten; exakte ordered Checks; keine Shell/impliziten Commands'),
('B-TOOLCHAIN','B','§6','BASE Manifest/Lock, ignore-scripts; trusted Compiler/Vitest/config; keine HEAD-Injection'),
('B-WORKER','B/C','§2, §6','Frische getrennte Dockercontainer, Read-only/net-none/cgroups/seccomp; keine Host-/Token-/Socketpfade'),
('B-INVENTORY','B','§7','Komplette Runtimefiles/structural tuple+occurrence, expanded Tests, unique/complete/canonical'),
('B-STATUS','B','§7','BASE vollständig grün; HEAD alle Basetests und alle neuen passed; no only/skip/todo/retry'),
('B-TRANSPORT','B','§6–7','Ein bounded geframter strikter Report; Supervisor beobachtet Exit/Timeout; kein stdout-Echo'),
('B-PATCH','B','§8','Exact einmaliger überlappender Byteanchor, ein Source-MODIFY, Hash/Diff/Frischmaterialisierung'),
('B-KILL','B','§8','Infrastructure dominiert; benannte vorher passed Tests; Exit1+AssertionError; kein Developerfallback'),
('C-REVIEW','C','§9','Server numeric Owner COMMENTED auf H; strikt gebundener canonical Body/externer Bericht'),
('C-INDEPENDENCE','C/Owner','§9','DEV openai braucht anthropic; Providerherkunft vom Owner attestiert, keine Hash-Authentifizierung'),
('C-LATEST','C','§9','Latest published Ownerreview, kein älterer Fallback; Revocation/Blocker/Supersedes'),
('C-EDIT','C','§9–10','Review-Snapshotvergleich an Beobachtungsgrenzen; kein erfundener REST-Edithistorienbeweis'),
('C-FINAL','C','§10','Cleanup vor Final; frische PR/main/review/run-Fakten; zwei stabile Runden in <=10s'),
('C-ATTEMPT','C','§10','Owner triggering_actor.id, Attempt>=2; gleich gebundenes frisches Gatereceipt, exakte Attemptjobs'),
('C-WORKFLOW','C','§2, §10, C Acceptance','Nur PR-target/base main, permissions {}, frische VM/Stage2, always mit rotem Fehlerpfad'),
('C-DEPLOY','C/Owner','§10, C Ergebnis','H1/H2/H3+native Checks extern abgenommen; owner_attested Digest/TTL; kein Publisherfallback'),
('X-CLEANUP','A/B/C','§2, §5, §10','Gruppen/Container/Fds/Roots beendet/entsorgt, Cleanupfehler nie PASS'),
('X-ERROR','A/B/C','§4, §11','Geschlossene Fehlercodes, feste Priorität, feste Gründe, Hashsubjects; keine untrusted Texte'),
('X-PROPERTY','A/B/C','§14, Draft Acceptance','Deterministische Propertyfamilien, independent oracle; 10k je Familie'),
('X-SIZE','A/B/C','§12, §15, Draft Status','Weiche Produktionsschätzung, Tests separat, keine kosmetische Kompression'),
]

def mapping(n):
    if n<=12:return ['A-INPUT','A-FETCH']
    if n<=17:return ['A-LIMIT']
    if n<=21:return ['A-ENV']
    if n<=28:return ['A-LAYOUT']
    if n==29:return ['A-HISTORY']
    if n<=35:return ['A-RAW','A-PATH']
    if n<=38:return ['A-FS']
    if n<=58:return ['A-PATH']
    if n<=66:return ['A-MODE','A-DIFF']
    if n<=72:return ['A-HISTORY','A-LIMIT']
    if n==73:return ['A-RAW']
    if n<=80:return ['B-SCOPE','A-HISTORY']
    if n<=92:return ['B-SCOPE','B-FREEZE']
    if n<=96:return ['A-INPUT','B-CONTRACT']
    if n in (98,99):return ['B-DEPENDENCY']
    if n==101:return ['B-REGISTRY']
    if n<=101:return ['B-CONTRACT']
    if n<=118:return ['B-INVENTORY','B-STATUS']
    if n==119:return ['B-WORKER','A-LIMIT']
    if n==120:return ['B-TOOLCHAIN']
    if n==121:return ['B-TRANSPORT','B-INVENTORY']
    if n<=125:return ['B-WORKER','B-TOOLCHAIN']
    if n<=134:return ['B-PATCH','B-KILL']
    if n==135:return ['B-PATCH','B-SCOPE']
    if n<=142:return ['B-KILL']
    if n<=151:return ['C-REVIEW','C-INDEPENDENCE']
    if n==152:return ['C-LATEST']
    if n==153:return ['C-LATEST','C-REVIEW']
    if n<=156:return ['C-EDIT']
    if n<=163:return ['C-LATEST','C-REVIEW']
    if n<=167:return ['C-FINAL']
    if n<=170:return ['C-ATTEMPT']
    if n<=173:return ['C-WORKFLOW','C-ATTEMPT']
    if n<=175:return ['C-DEPLOY']
    if n==176:return ['C-FINAL','A-INPUT']
    return ['X-CLEANUP']

annotations={
4:'GAP: Exponentialnotation ist lexikalisch, positiver Integerwert allein schließt 1e0 nicht aus.',
9:'CLARIFY: offered URL als Testeingang vs ignoriertes Zusatzfeld; feste Remote soll nie ersetzt werden.',
30:'LAYER: Git fsck/fetch kann früher GIT_FETCH/GIT_OBJECT liefern; raw parser muss Duplicateflag sehen.',
64:'LAYER: raw unknown-octal mode vs Git-Vorfilter sauber trennen.',
71:'CLARIFY: GIT_LIMIT vs §11 GIT_HISTORY bei History-Budget; Tabelle und prose nicht gleich.',
74:'LAYER: Scope/Protected-Precedence mit ausdrücklich genehmigtem Testscope definieren.',
79:'MUTANT MASK: file→directory erzeugt DELETE; für B1 andere gültige Prefixdatei verwenden.',
80:'LAYER: Coordination ist auch außerhalb DEV-Klassen; exakter Testeingang erforderlich.',
81:'LAYER: eigener Contract kann parserseitig nicht in Scope; geschützten Pfadtest isolieren.',
96:'CLARIFY: Namespace-Mismatch vs CONTRACT_BINDING; TASK wird laut Regex aus registriertem Task gebunden.',
98:'COVERED null-blocking, beweist kein Taskacceptance-Lifecycle.',
99:'COVERED Ancestry, beweist allein keine taskId→acceptedCommit-Zuordnung.',
109:'COVERED echter .only-Report im Paket; kein bloßer Collectionerror.',
115:'AMBIGUOUS: Ersatz einer Baselineidentität FAIL, bloße Coexistenz anderer ancestor-Tupel PASS.',
121:'LIMIT: übergroß/strukturell gefälscht reject; perfekte inprozessuale Reporterfälschung laut §6 nicht ausschließbar.',
123:'LAYER: ein erfolgloser Zugriffsversuch kann vom OS abgewiesen werden und Test grün bleiben; erwartetes Ergebnis muss Isolationprobe vs Supervisorcode benennen.',
124:'LAYER: syscall/network denied ist kein automatisch beobachtbarer Supervisorfail. stdout command bleibt Daten.',
125:'LAYER: readonly denial ist Isolationerfolg; hostile access attempt nicht selbst ein vertrauenswürdiges Ereignis.',
141:'CLARIFY: fehlender required Mutant NOT_APPLIED vs explizite fake-evidence INFRA; konkrete Fixtures unterscheiden.',
150:'CONTRADICTORY TOKEN: §9 erlaubt request_changes, nicht reject; invalid schema vs REVIEW_BLOCKED.',
154:'BLOCKING: Gate→Stage2-Reviewdigest fehlt im fixen Receipt; siehe F02/P04.',
155:'OBSERVATION BOUNDARY: before first observation gilt je Job oder gesamtem Attempt? F02.',
161:'GAP: Supersedesclosure und genaue Menge aller bekannten/noch aktiven Blocker fehlen.',
162:'CLARIFY: ausschließlich Owner ist autorisierter Findings-Schreiber; nicht zweite frei gelabelte AI-Person.',
167:'LAYER: gleiche immutable B-SHA und andere Policybytes ist kein normaler Git-Run; OID-/Startsnapshot-Prüfgrenze explizit.',
170:'C3 MASK: aktueller Attemptjobset enthält ebenfalls kein frisches Gate; Codewechsel allein ist kein Securitykill.',
172:'GAP: aktuelle-Run-Jobs lesen keine fremden Check-Runs; Runtime-Nachweis vs deploymentPolicy konkret trennen.',
173:'DEPLOYMENT: Supervisor kann aktuellen Run binden, native Merge-Enforcement/stale-green bleibt Plattformabnahme.',
}
coverage=[]
for c in accept:
    n=int(c['id'][3:]);r=dict(c,requirements=mapping(n),review=annotations.get(n,'MAPPED; keine zusätzliche Widerspruchsfeststellung bei Contract-Level-Prüfung'),layer='Layerisoliert gemäß §13; Fullfunnel darf früh sicher rejecten',productionExecution='NOT_EXECUTED')
    coverage.append(r)
(OUT/'acceptance-coverage.json').write_text(json.dumps(coverage,ensure_ascii=False,indent=2)+'\n')
(OUT/'requirements.json').write_text(json.dumps([dict(id=a,owner=b,source=c,requirement=d,acceptance=[x['id'] for x in coverage if a in x['requirements']]) for a,b,c,d in reqs],ensure_ascii=False,indent=2)+'\n')

compat=[]
for r in identity:
    m=r['result']['document']['metadata'];k=r['contract']
    for path in m['scope']['create']:
        compat.append(dict(contract=k,path=path,role='CREATE',exists=(ROOT/'main-snapshot'/path).exists(),assessment='VALID_NEW_TARGET'))
for path in ['src/forge/contract-document.ts','src/forge/primitives.ts','src/forge/freeze.ts','src/forge/node-sha256.ts','package.json','package-lock.json','tsconfig.json']:
    e=next(x for x in tree['tree'] if x['path']==path)
    compat.append(dict(contract='shared',path=path,role='READ',exists=True,gitBlobId=e['sha'],assessment='EXISTS_BYTE_VERIFIED'))
(OUT/'main-compatibility.json').write_text(json.dumps(compat,ensure_ascii=False,indent=2)+'\n')

findings=[
('F01','BLOCKING CONTRACT DEFECT','A/B','§2 output=8MiB; §3/§6 framed data','Bounded Datenstrom und Prozesslogbudget sind nicht getrennt. Ein Blob von genau 8MiB benötigt 8.388.663 Bytes im cat-file-Frame; P03. Ein langlebiger Batch über mehrere erlaubte Objekte scheitert ebenfalls am pauschalen Lebenszeitbudget.','Für framed Objekt-/Inventardaten verbindliche gesonderte Streamingbudgets und Fehlerpriorität festlegen, oder veröffentlichte Limits inklusive Framing konsistent reduzieren. Kein Schutz lockern.'),
('F02','BLOCKING CONTRACT DEFECT','C','§9–10; AV154/155; P04','Stage1 beobachtet Review R0; gültige Bearbeitung vor Stage2 ergibt R1. Das feste Receipt enthält keinen Reviewdigest; Stage2Start und beide Finalrunden sehen nur R1. Gleiches Receipt bei zwei unterschiedlichen Gate-Beobachtungen beweist fehlende Information.','Beobachtungsgrenze normativ entscheiden: verlangten Gate-Snapshotdigest im trusted Receipt binden oder explizit Stage2-only-Frische ausweisen und AV154 ändern. Zwei gleiche Finalrunden lösen den Zwischenjobverlust nicht.'),
('F03','BLOCKING ACCEPTANCE DEFECT','A/B/C geteilt','§4/§11/§13; AV004/071/115/150/123–125','Einige Sollcodes/Inputformen sind nicht geschlossen. reject ist kein gültiger external result. Gleicher fullName ist bei unterschiedlichen Tupeln erlaubt, bei Ersatz nicht. 129 Historycommits heißen in Tabelle GIT_LIMIT, in §11 auch GIT_HISTORY. Ein OS-denied Workerzugriff ist Isolationserfolg, kein automatisch sichtbares Supervisorereignis.','Feste Layer/konkrete Eingaben/Präzedenz ergänzen; gültige request_changes von schema-invalid reject trennen; denied-probe mit gemessenem Isolationresultat statt erfundenem Supervisor-Sensor abnehmen.'),
('F04','BLOCKING SCHEMA DEFECT','C','§9 external findings + supersedes','StrictObject wird verlangt, aber Severityenum, Blockingprädikat und Supersedesclosure sind nicht geschlossen. Ein approve mit critical/fatal-Findings hat je Implementationsinterpretation anderes Resultat; bereits supersedete Blocker sind unklar.','Exakte Review-/Finding-/Supersedes-Typen und deterministisches Blockingprädikat festlegen. DEV-Providerregel bewahren; weitergehende OWNER_OPS-Unabhängigkeit nur als bewusst benannte Produktentscheidung aufnehmen.'),
('F05','NONBLOCKING INTEGRATION NOTE','A/B/C','§2/§12; A Stub; B Worker; C Image','A besitzt Live-GET-Bootstrap, github.py kommt C; B fordert Dockerabnahme, Rezept kommt C. Kein zwingender logischer Zyklus, wenn A einen eigenen festen Minimaltransport und B ein extern gepinntes Acceptanceimage verwendet. Diese Harnessinputs sind noch nicht explizit typisiert.','Ownership und externe Acceptanceinputs vor Implementierungsausführung kurz fixieren. A-Stub darf keine B/C-Produktionssemantik implementieren; spätere Wrapper aus C müssen A unverändert benutzen können.'),
('F06','NONBLOCKING TRUST/RESPONSIBILITY NOTE','B/Owner','§4 dependencies; P05','Nichtnull+Commit-Ancestry beweisen keine Taskannahme. Policy v1 hat keine acceptedDependencies-Map. Die Drafts verlangen echte unabhängige Abnahme und trusted Ownerpublikation; diese bleibt die Autorität. Kein Developer kann den BASE-Contract frei umbeschriften.','Verantwortung externem Owner-Acceptanceprozess ausdrücklich zuweisen und Proofgrenze nennen; nicht aus Ancestry eine maschinell authentifizierte historische Taskannahme ableiten. Ohne echte Annahme B/C sperren.'),
('F07','NONBLOCKING SOURCE/REVISION NOTE','A/B/C','Draft Bindung; historische Quelle','Alle Bytes vorhanden und Hashbindung stimmt. reads und harte Tasklimits existieren nicht in Format1. B/C null ist gewollt blockierend. B erwähnt Rehash/Reparse, C auch Revisionserhöhung. Historischer 341ec983-Draft nicht verfügbar.','A/B/C unverändert zitieren; B/C vor Ausführung reale Accepted-SHAs/aktuelle Base/neue Revision reviewen. Historischen Vergleich nur nach Bytefund schließen; kein Text aus Erinnerung ersetzen.'),
('F08','BLOCKING MUTANT EVIDENCE DEFECT','A/B/C Acceptance','A1/A4/B1/B2/B3/C1/C3/C4; P01/P06','Guardmutanten sind keine aktuell anwendbaren bytegebundenen Patches. Deferral bis Implementation ist legitim, aber garantierte Securitykills sind mehrfach maskierbar. A1 lässt Rawhash aktiv; C3 lässt Attemptjobset aktiv. Codewechsel zwischen zwei sicheren Rejects beweist keine gebrochene Schutzwirkung.','Jeden Mutanten auf eine konkrete normativ zugesagte Schutzwirkung und einen isolierten Assertiontest binden. Nach Implementation exact bytes einfrieren; masking erklären. Kein geänderter Fehlercode oder Compilercrash als Securitykill zählen.'),
('F09','BLOCKING C RESPONSIBILITY/OUTCOME DEFECT','C/Owner','§10; AV170/172/173','Fester Current-Run/Attempt-Jobread beweist keine Abwesenheit eines fremden gleichnamigen Checks. Receipt+Jobs beweisen frische vollständige Ausführung, nicht welches Re-run-Menü benutzt wurde; gleichwertiger graph rerun kann dieselben beobachteten Fakten liefern.','Runtimegarantie auf nachweisbare frische vollständige Attemptjobs binden; fremde native Check-Assoziation als genau definierte Deploymentabnahme ausweisen oder passende feste GETs normativ hinzufügen. Keine stillen alternativen Publisher/Token einführen.'),
('F10','NONBLOCKING EXECUTION BOUNDARY','A/B/C/Owner','§2/§6/§10','Keine Docker-/cgroup-/GitHub-Livedrills in dieser Zertifizierung. Processgroup allein stoppt nicht jeden setsid-Nachfahren; Container/cgroup-Lifecycle muss das abnehmen. Reporterfälschung und Review-ABA/after-final-race sind ausdrücklich zugestandene Grenzen.','Bestehende NO-GO-Deploymentgates erhalten. Keine stärkere Isolation-/Atomizitäts-/Reportehrlichkeitsgarantie aus Unitproben ableiten.'),
]
(OUT/'findings.json').write_text(json.dumps([dict(id=a,severity=b,owner=c,source=d,finding=e,requiredClosure=f) for a,b,c,d,e,f in findings],ensure_ascii=False,indent=2)+'\n')

responsibility=[
('Objekterwerb/Rawbytes/ODB/Hash/History','A','B konsumiert geprüfte Fakten; C orchestriert','OWNED'),
('Nummerische PR-/Run-/Repo-Fakten','A bootstrap + C github/final','Feste GETs; A-Transport/C-Wrapper-Schnittstelle noch klar benennen','F05 NOTE'),
('Pfad-/Mode-/Materialisierungsgrenze','A','B darf Rohsnapshot nicht normalisieren oder erneut unsicher exportieren','OWNED'),
('Exact Scope/Profile/Freeze/Registry','B','A liefert Änderungen; C darf keine Candidate-Ausnahme machen','OWNED'),
('Akzeptierte Taskdependency','Owner externe unabhängige Bootstrapabnahme','B prüft Nichtnull/Ancestry; kein authentischer Taskaccepted-Beweis im Policyformat','F06 TRUST BOUNDARY'),
('BASE-/HEAD-/Mutantensandbox und Toolchain','B Worker + C gepinntes Image/Workflow','A Prozess-/IOprimitiven; unabhängiger B-Testimageinput','F05 NOTE / deployment pending'),
('Collection/Inventar/Status/Mutationsklassifikation','B','C vertraut nur Supervisorresultat, nicht Developer-Report','OWNED mit F01/F03/F08'),
('Reviewauthentifizierung/Latest/Binding/Provider','C; Owner attestiert externe Providerherkunft','Kein Hash beweist Providerautorschaft','F04 blocking schemas'),
('Reviewedit Gate→Stage2','C','A transportiert nur festes Receipt; B hat keine Reviewauthority','UNOWNED INFORMATION F02'),
('Reviewedit Stage2Start→Final','C','Komplette relevante Liste erneut lesen','OWNED; ABA-Grenze bleibt'),
('Fremde/stale gleichnamige Nativechecks','Owner Deployment + C Current-Runbindung','Currentrun-Jobliste allein reicht nicht','F09 outcome responsibility'),
('H1/H2/H3/Rulesets/Merge expected HEAD','Owner administrativ','C owner_attested Digest/TTL; permissions{} kann nicht als live_verified dienen','OWNED EXTERNAL ASSUMPTION'),
('After-final Review/main Race','Owner unmittelbar vor Merge','Kein atomarer C-Snapshot; Auto-Merge untersagt','EXPLICIT LIMIT'),
('Cleanup/Quotas/child lifecycle','A primitiv + B Container + C vor Final','Host/VM lifecycle Operator-TCB','OWNED; Livebeweis fehlt'),
('Mutantenqualität/byte anchors','Acceptanceautor + unabhängiger Reviewer','Keine Produktionsplan-Toolmutanten; isolierte Guardassertions','F08 blocking evidence'),
('Reference-Profilübersetzung','Unabhängiger Differentialadapter/Reviewer','Nie produktiven Gate an Labfixture vorbei grün schalten','COMPARISON ONLY'),
]

mutants=[
('A1','DOES_NOT_APPLY','AMBIGUOUS','Replace env+Layout weg','P01: Rawhash noch wirksam; Reader-origin-Assertion kann rot werden, aber replaced Byteacceptance bleibt verhindert. Doppelmutant, nicht exact byte-bound.'),
('A2','DOES_NOT_APPLY','APPLIES (semantic)','Parent O_NOFOLLOW weg','P02: Linux folgt Symlink bei O_DIRECTORY allein. Echte Parent-FD-Assertion bricht Sicherheitsgrenze; genaue spätere Anchorposition nötig.'),
('A3','DOES_NOT_APPLY','APPLIES (semantic)','MODE_CHANGE aus Diff','Diff muss zwei Flags enthalten. Isolierter Diffassertiontest sinnvoll; Fullgate kann Mode anderweitig rejecten.'),
('A4','DOES_NOT_APPLY','AMBIGUOUS','Rawentries früh in dict','Sinnvoll nur vor allen Duplicate-/Sortguards. Nach einem verbleibenden Rawcheck wäre äquivalent.'),
('B1','DOES_NOT_APPLY','APPLIES (semantic, conditional)','Scope startsWith','Gültige verschiedene .ts-Prefixdatei statt file→directory-DELETE benutzen; sonst Guardmaskierung.'),
('B2','DOES_NOT_APPLY','APPLIES (semantic, isolated)','Inventory auf count','Verlust+Zusatz bei identischer Zahl in Inventarlayer; Fullfunnel freezed alte Tests bereits.'),
('B3','DOES_NOT_APPLY','AMBIGUOUS','nonzero=KILLED','Ein vorgeschalteter Compiler/Timeoutguard kann unverändert rejecten. Die tatsächliche classifier-Zeile muss normativen Infra-Vorrang entfernen.'),
('B4','DOES_NOT_APPLY','APPLIES (semantic)','Developerfallback','Isolierter fake detected ohne unabhängigen Kill muss rot; keine bloße Anzeigelogik mutieren.'),
('C1','DOES_NOT_APPLY','AMBIGUOUS','login statt id','Vorheriger numeric Reviewfilter kann alles bereits rejecten. Autoritätsentscheidung konkret lokalisieren.'),
('C2','DOES_NOT_APPLY','APPLIES (semantic)','Latest Blocker überspringen','Neuest revoke+ältere approve kontrollierter Reviewlayer. Full Digestchange darf Test nicht als Ersatz töten.'),
('C3','DOES_NOT_APPLY','AMBIGUOUS','Receipt runAttempt nicht prüfen','P06: fehlender neuer Gatejob wird vom aktuellen Attemptjobset weiterhin rejectet. Nur Codeänderung ist kosmetische Securityevidence.'),
('C4','DOES_NOT_APPLY','AMBIGUOUS','final main nicht prüfen','Andere frische PR.base/GITHUB_SHA-Prüfungen können stale main sehen. Kontrollierte Snapshotfixture nötig.'),
]
(OUT/'mutants.json').write_text(json.dumps([dict(id=a,currentMain=b,futureSemantic=c,mutation=d,review=e) for a,b,c,d,e in mutants],ensure_ascii=False,indent=2)+'\n')

refcompat=[]
for c in reference:
    family=c['id'].split('-',1)[1]
    gaps=['Branch lacks required task/nonce form','Format1 commands use reference npm registry','Policy/attestation/inventory schemas require explicit translation','Repo contains no production manifest/policy/taskindex; local layer only']
    if family=='limit':gaps.append('files=1 is reference-only operator limit; fixed v01 profile does not set this limit')
    if family in ('version','base-binding','task-binding'):gaps.append('Reference-specific task/version/base metadata field must map to actual document/index binding')
    if family in ('revoked','wrong-owner','initial-run','wrong-trigger','wrong-report','no-attestation'):gaps.append('Synthetic witness is not complete latest paginated GitHub review/run/final snapshots')
    if family in ('new-tests','duplicate-title','parameterized'):gaps.append('Added identities in existing file are disallowed by production freeze; layer-level collection tests only')
    if family in ('config-shrink','removed-plus-added'):gaps.append('Inventory layer injected witness only; full static gate rejects earlier')
    if family=='legitimate':gaps.append('Reference fixture includes merge HEAD; production requires all new commits single parent')
    refcompat.append(dict(id=c['id'],family=family,expected=c['expected'],classification='NEEDS_PROFILE_AND_LAYER_ADAPTER; NOT_DIRECT_PRODUCTION_INPUT',differences=gaps))
(OUT/'reference-compatibility.json').write_text(json.dumps(refcompat,ensure_ascii=False,indent=2)+'\n')

section(1,'Source Identity',
p('Geprüft wurden tatsächliche gespeicherte Dateien, nicht Chat-Zusammenfassungen. A/B/C als Einzelfiles sind byteidentisch zu den Copies im Minimum-Verifier-ZIP. Der aktuelle TypeScript-Parser wurde unverändert aus dem heute selbst gelesenen main importiert; <code>nodeSha256Utf8</code> berechnet den Contracthash mit <code>forge-contract-v1\\n</code>.')+
table(['Contract','Bytes','SHA-256 der Datei','Git SHA-1 Blob-ID (berechnet)','Format1 Contracthash','Parser'],[(r['contract'],r['bytes'],r['sha256'],r['gitBlobId'],r['result']['document']['ref']['contentHash'],'ok=true') for r in identity])+
p('Die berechneten Blob-IDs sind lokale Contentidentitäten, keine behaupteten bereits registrierten GitHub-Blobs. Alle drei: Version 1, baseCommit <code>'+MAIN+'</code>. A: keine Dependencies. B: A acceptedCommit=null. C: B acceptedCommit=null. Beide null sind zulässige Draftsyntax und bewusst kein ausführbarer Produktivpass.')+
p('Normative externe Bindung: exakte <code>results/normative-sections.json</code>, 105.429 Bytes, SHA-256 <code>'+NORM+'</code>. Datei bindet [sectionNumber,title,htmlBody] für §§1–15; A/B/C verweisen zudem auf das komplette Paket §§1–18. §§16–18 sind damit referenziert, aber nicht Bestandteil dieses angegebenen Sectionhashes. Normative Auslegung für dieses Zertifikat ist der tatsächliche unveränderte Pakettext plus Taskscope; keine Scratch-Semantik ersetzt ihn.')+
table(['Datei','Bytes','SHA-256'],[(x.name,x.stat().st_size,hashlib.sha256(x.read_bytes()).hexdigest()) for x in SRC.iterdir() if x.suffix in ('.html','.zip') and 'READINESS' not in x.name])+
p('Scope A: 13 CREATE, B: 13 CREATE, C: 17 CREATE; alle MODIFY-Listen leer. Checks pro Contract: baseline=forge-v01:baseline, acceptance=forge-v01:acceptance-a/b/c, mutations=forge-v01:mutations-a/b/c; mutationSmoke=required. Das sind ausdrücklich externe Bootstrap-Lab-Registryeinträge, keine npm-Scripts und keine Shellbefehle.')+
p('<b>reads:</b> kein Frontmatterfeld, keine explizite Read-Allowlist. Vorhandene normative Codeinputs: vier BASE-Parsermodule plus BASE package/lock/tsconfig und später BASE Manifest/Policy/Plan. Der Worker erhält vollständige freigegebene Snapshots; daraus folgt keine Read-Sandbox nach Taskreads. <b>mutants:</b> je vier benannte lokale Verifiermutanten im Body; konkrete Source-Mutanten des Produktplans werden separat in §8 beschrieben. <b>limits:</b> Format1 hat kein Limitsfeld; festes externes v01-Profil aus §2, weiche LOC-Schätzungen aus §12/Draftbody. Volltext A/B/C am Ende dieses Dokuments und als exakte Files im Evidence-ZIP.'))

section(2,'Main Compatibility',
p('Aktuelles main selbst gelesen: <code>'+MAIN+'</code>; Tree <code>67103229baccaefd68ce5047d8503eca9883f1d3</code>. 71 versionierte Blobs aus dem vollständigen, nicht abgeschnittenen GitHub-Tree geladen. Für jeden Blob lokal SHA1(blob &lt;byte length&gt; NUL bytes) nachgerechnet: 71/71 identisch. Kein AGENTS.md; kein produktiver tools/forge_v01, forge/verifier oder .github/workflows auf dieser Base.')+
table(['Contract','CREATE abwesend','MODIFY vorhanden','Mutantanker heute','Testpfade'],[('A','13/13','0 targets','nicht definiert/nicht implementiert','5 geplante CREATE-Tests'),('B','13/13','0 targets','nicht definiert/nicht implementiert','5 geplante CREATE-Tests'),('C','17/17','0 targets','nicht definiert/nicht implementiert','5 geplante CREATE-Tests')])+
p('Die bestehenden Reads sind vorhanden; parseContractDocument, nodeSha256Utf8, ContractMetadataSchema, contractPathFor, die referenzierten Domain-APIs und tsconfig src/tests wurden aus echten Dateien kontrolliert. Alle APIs unter tools/forge_v01 sind geplante Outputs, keine behaupteten existierenden Imports. Missing main.py/Manifest ist im A-Produktionspfad FAIL; der ausdrücklich erlaubte harmlose BASE-Stub ist nur Acceptanceharness.')+
p('Erneuter lokaler Typecheck erfolgreich. Bestehende Suite: 1.087/1.087 passed, 22 Dateien, 125 Suites, 0 failed/pending/todo. Vorhandene unveränderte Toolchain wurde benutzt, keine install scripts ausgeführt und kein untrusted Corpus-Source ausgeführt. Dieser Baselinelauf ist Funktionsnachweis, keine Docker-Isolationsabnahme.')+
p('<b>SPEC_STALE:</b> kein unerwartet fehlender bestehender Read/Modify/API-Nachweis. Geplante CREATE-Files und absichtlich später zu fixierende Mutantanker sind nicht SPEC_STALE. B/C müssen nach echten Vorgängerannahmen neue Base-/Dependency-/Hashrevisionen erhalten; die gegenwärtigen null-Drafts sind kein Ausführungsauftrag.')+
table(['Art','Pfad','Bewertung'],[(x['role'],x['path'],x['assessment']) for x in compat]))

section(3,'Contract A — Bootstrap / Git',
p('A schließt die verlangten Git-Angriffsflächen grundsätzlich normativ: frisches leeres bare Repo, fixed canonical refspecs, kein Checkout/merge-tree, neue Env, Layout vor/nach Fetch, GIT_NO_REPLACE_OBJECTS und zusätzlicher Rohobjekt-Rehash; alle HEAD-Zwischencommits werden gelesen. BASE kann historische Merges haben. Pfade bleiben Bytes bis zur vollständigen ASCII-/Prefix-/Case-/Windowsprüfung. Rename ist DELETE+ADD. Parents und Leaves werden fd-relativ geöffnet.')+
p('Zusätzliche Gegenversuche: P01 realer Git-Replace-Ref zeigt eine verbliebene dritte Barriere: cat-file liefert Original-OID im Header, aber Replacement-Bytes; der normative Rehash erkennt das. P02 realer Linux-Parentopen folgt ohne O_NOFOLLOW nach außerhalb. P03 quantifiziert die Outputbudgetinkonsistenz. Keine dieser Proben ist eine Produktionsimplementierung.')+
p('Es wurde kein durch A eindeutig verlangter unsicherer Rohpfad-/Mode-/Git-PASS gefunden. Gefunden wurden ein implementierungsrelevanter Budgetwiderspruch F01 und unzureichend geschlossene Mutantenevidenz F08. Gesondert muss A seinen Live-GET-Minimaltransport ohne Pflichtimport eines erst in C erzeugten Moduls bereitstellen; dafür ist eine kleine A-eigene IOgrenze möglich, also kein bewiesener unlösbarer Zyklus.')+
table(['Thema','Normative Entscheidung','Prüfurteil'],[('Replace/grafts/shallow/promisor/alternates','Layoutreject plus Envschutz und Rawhash','STRENGTHENED, keine heuristische Ausnahme'),('Mergeparents','ein Parent oberhalb BASE; BASE-Merge erlaubt','klar; historische BASE-Ancestry braucht allgemeinen Graphen'),('Rawtree/Unicode/casefold','Typ/Hash/Sort/Duplicate; alle Nicht-ASCII-Pfade reject','klar; Unicode-Unterstützung nicht hineinerfinden'),('Symlink/gitlink/Mode','kein unzulässiger Export; 100755 nur unverändert','klar; Content+Mode beide sichtbar'),('Rename/file-directory/Windows','keine Renameheuristik, deletes verboten, Prefixtrie','klar'),('Maxblob/Batchdata','8MiB Blob und 8MiB Gesamtprozessoutput','F01 BLOCKING'),('A1/A4 Evidence','Guards löschen/Dict vor prüfen','F08: remaining guards/masking')]))

section(4,'Contract B — Tests / Mutations',
p('Der bekannte 1087→19-Angriff ist normativ geschlossen: bestehende tests inklusive Fixtures eingefroren; package/lock/tsconfig/Toolconfig geschützt; BASE-lock und ignore-scripts; direkte gepinnte Toolentrypoints, exakter trusted include und explicit config; vollständiges Runtimeinventar statt Anzahl; BASE-Identitäten müssen alle passed wiederkehren. Neue Tests aus genehmigten neuen Dateien können keinen Verlust ausgleichen. .only/skip/todo/collection/hook/unhandled/partial reports sind rot.')+
p('Mutation: genaue überlappende Anchorzählung, clean HEAD pro Mutant, genau ein Source-MODIFY und Bytehashes, Typecheck und vollständige benannte Testfiles. Timeout/Compiler/Hook/Collection/fehlender named Test oder unbenannter Failure dominieren Assertionkill. Equivalent-Mutant bleibt SURVIVED. Developer detected ist keine Authority.')+
p('Die zugesagte Grenze ist bewusst begrenzt: ausführbarer JavaScriptcode kann im Prozess Reporter/Testresultate beeinflussen. Freeze, Sandbox und externes Review ersetzen keinen kryptographischen Testehrlichkeitsbeweis. Ein perfektes gefälschtes Inventar kann innerhalb dieser ausdrücklich offengelegten Grenze technisch grün aussehen; das ist ein Produktlimit, kein verdeckter Anspruch aus §7. AV121 darf deshalb keine universelle Fälschungserkennung behaupten.')+
p('B benötigt Änderungen an F01 (framed transport budget), F03 (konkrete Layer/Outcome-Abnahmen) und F08 (isolierte echte Mutantenwirkung). Docker nicht vorhanden; kein unsandboxed Fallback zum Test eines candidate Verifiers. B-Abnahme braucht ein extern klar gepinntes harmloses Image, bevor das finale C-Rezept existiert. Existierende main-Vitestproben genügen nicht als Isolationbeweis.'))

section(5,'Contract C — Reviews / Workflow',
p('Normativ solide: numeric server Owner-ID, COMMENTED auf aktuellem H, exact Repo/PR/B/H/Contract/Verifier/Policy/Run/Attempt-Bindung, eingebetteter Reporthash, DEV openai→anthropic, Latest-published-Review ohne ältere Fallbacks, revocation/CHANGES_REQUESTED, volle Pagination, neue Finaldaten, zwei stabile Snapshots, Owner triggering_actor, frisches Gate-Receipt und exakte Attemptjobs. permissions {}, BASE/Image-Workflowquelle, frische zweite VM, always mit rotem Fehlerpfad und keine HEAD-Ausführung im Supervisor erhalten H1–H3.')+
p('<b>Gegenbeispiel F02:</b> Gate beobachtet bodyHash=X. Owner editiert nach Gate auf Y; alle Bindungen bleiben gültig. Das fixierte Receipt hat keinen Reviewdigest. Stage2Start/Final1/Final2 sehen Y. Eine konforme rein Stage2-interne Stabilitätsprüfung kann PASS liefern, obwohl AV154 eine Änderung zwischen Gate und Final ablehnen will. P04 zeigt zwei ununterscheidbare Receipts. Das ist nicht der offen zugestandene after-final-Mergerace, sondern eine unerfüllte beobachtbare Zwischenjob-Anforderung.')+
p('Weitere C-Defekte: F04 fehlende closed Findings/Blocking/Supersedes-Semantik; F03 ungültiges reject-Token; F09 fehlende klare Zuständigkeit für fremde Nativechecks und den tatsächlichen Re-run-Nachweis. Currentrun-jobs kann nicht andere Runs lesen. Fresh receipt+jobs beweist vollständige Ausführung, nicht welches UI-Menü Owner gewählt hat. Ein sicher gleichwertiger rerun einzelner Gatejobs mit Dependencies darf nicht ohne beobachtbaren Unterschied als angeblich spezifisch erkennbarer Angriff modelliert werden.')+
p('Owner-Providerherkunft ist attestiert, nicht vom Hash authentifiziert. Bei OWNER_OPS ist die weitergehende Coding-Provider-Unabhängigkeit nicht genauso geschlossen wie bei DEV; dieser zusätzliche Anspruch darf weder still versprochen noch erfunden werden. Reviewänderungen zwischen GETs, REST-Edits vor erster Beobachtung und Änderungen nach letztem Final-GET bleiben die im Paket erklärte Grenze.'))

section(6,'Cross-Contract Responsibility',table(['Schutzwirkung','Owner','Übernahme / Grenze','Status'],responsibility)+p('Die gefährliche unbesetzte Grenze ist der Stage1→Stage2-Reviewvergleich. Dependencyannahme, Plattformenforcement und Providerherkunft haben dagegen einen benannten externen Owner; sie dürfen nicht als intern bewiesene Tatsachen erscheinen. A/B/C konsumieren nie die untrusted Developer-Berichte als Ersatz für eigene IO-/Test-/Reviewprüfung.'))

section(7,'Historical VERIFIER-0001 Comparison',
p('<b>NOT AVAILABLE / NOT COMPARABLE.</b> Der Draft mit Hashpräfix <code>341ec983…</code> wurde im aktuellen main nicht gefunden. Die gespeicherten relevanten Paketdateien enthalten ihn nicht; gezielte Dateisuche und Personal-Context-Nachfrage lieferten keinen tatsächlichen Drafttext oder byteprüfbaren Fileverweis. Ein Hinweis, dass früher ein Hash nachgerechnet wurde, liefert die Bytes nicht. Kein Ersatzdraft wurde rekonstruiert.')+
table(['Historische normative Anforderung','A/B/C-Klassifikation','Grund'],[('Alle Anforderungen des exakt gehashten VERIFIER-0001','NOT COMPARABLE','Menge der historischen Requirements nicht verfügbar; keine per-requirement-Erhaltung beweisbar')])+
p('Daher weder PRESERVED noch STRENGTHENED noch INTENTIONALLY REMOVED noch ACCIDENTALLY LOST für unbekannte historische Anforderungen behauptet. Es wurde kein ACCIDENTALLY-LOST-Befund widerlegt oder bestätigt. Fehlende historische Quelle ist eine ausgewiesene Zertifikatsgrenze; user instruction „falls verfügbar“ wird eingehalten. Der verfügbare Bootstrapvergleich folgt separat.'))

bootstrap=[('H1','§9–10','PRESERVED','Last-push approval aus; Owner COMMENT statt native Selfapprove; kein Bypass'),('H2','§10/C deployment','PRESERVED','Separate bypassfreie Delete/Forcepush-Sperre; kein Livebeweis'),('H3','§2/§10/C Acceptance','PRESERVED','Nur PR-target, globale Actionspolicy als externe Ownerabnahme'),('Two-stage','§4/§6/C','PRESERVED','forge-gate + forge-verify, letztes Gate selbst neu'),('ignore-scripts','§6/B','PRESERVED/STRENGTHENED','Direkte entrypoints, keine npm test Shell'),('inventory statt count','§7/B','STRENGTHENED','Tupel/occurrence, Runtimeerrors/status, genehmigte neue Files'),('no rename heuristic','§3/A','PRESERVED','DELETE+ADD; dual Mode+Content'),('replace protection','§2–3/A','STRENGTHENED','Env + Layout + raw own OIDhash'),('fresh Stage2','§4/§6/C','PRESERVED','Neue VM, ODB, gate, Worker; nur kleines Receipt'),('final recheck','§9–10/C','STRENGTHENED WITH DEFECT','Zwei Runden und TTL, aber Zwischenjob-Reviewverlust F02'),('Bootstrap Initial Trust','A Stub/Draft/Handoff','PRESERVED','Externe unabhängige Annahme vor Installation; kein selbstzertifizierender Candidate'),('Drill clampAtZero','C Ergebnis/§8','PRESERVED','if BASE→ternary HEAD, return n killed; Equivalent bleibt negative Fixture'),('Raw IO Sprache/Image','§2/§12','EXPLICIT CONCRETIZATION','Python stdlib + kleine JS-Adapter, gepinnte Versionen; kein verdeckter Providerfallback')]
section(8,'Bootstrap Report Comparison',
p('Finaler tatsächlicher Bootstrap-Report gelesen: SHA-256 d3ed7f74b84282de75e3c77da2e43f91845bf4c112699e82b63fcd8ea24a2a3c. Die oben verlangten Richtungen werden nicht still aufgegeben. Die Sprache und Runtimegrenzen sind eine ausdrückliche Konkretisierung, keine Wiederholung des alten Laborcodes.')+
table(['Designinput','A/B/C','Klassifikation','Begründung'],bootstrap)+
p('Keine Abweichung zu H1/H2/H3 durch erneute Aktivierung von Selfapproval, Owner-Bypass oder Dispatch gefunden. Plattformgates bleiben pending; daraus folgt keine heutige Produktionsfreigabe.'))

section(9,'Reference Differential Compatibility',
p('Reference ZIP gelesen einschließlich CLI, Generator, 150 realen bare Repos und results/differential/cases.json. Den shipped reference CLI gegen seinen authored Korpus erneut ausgeführt: 300 Gate/Verify-Vergleiche, 0 Mismatches. Dabei wurde kein beliebiger Corpus-HEAD-Code ausgeführt; verify konsumiert synthetische trusted lab witnesses. Das bestätigt interne Reproduzierbarkeit, keine A/B/C-Kompatibilität.')+
p('<b>Unverändert ist der Gesamtcorpus kein A/B/C-Produktionsacceptance.</b> Alle 150 Branchinputs sind nicht nach der neuen task/nonce-Grammatik zulässig; 148 nutzen forge/run/codex/REF-DRILL-0001 ohne nonce. Alle Contracts verwenden Referenzregistry npm run typecheck/npm test, keine forge-v01:*-Registry. Synthetic Policy/Review/Inventare fehlen Produktionsfelder/-Provenienz. 0-legitimate hat einen Mergehead, während A jeden neuen Commit single-parent verlangt. Siehe vollständige per-case Datei reference-compatibility.json.')+
table(['Reference-Semantik','A/B/C-Semantik','Zulässige Behandlung'],[('Branch ohne nonce','§4 exakter TASK/nonce','Reviewte Inputübersetzung, kein Produktionsnamespace-Fallback'),('npm check strings','§2 forge-v01 Registrydaten','Semantisches Registrymapping, niemals Shellausführung'),('occurrence startet1, project forge-ref-trusted','§7 occurrence startet0, project forge-v01','Strukturelle Inventarübersetzung, nicht pass-through'),('attestation result PASS/revoked bool/local userId','§9 canonical server review + externalreport + deployment','Layerfixture übersetzen; server authentication separat testen'),('baseCommit muss exakt fixture base sein','§4 älterer authentischer Authoringvorfahr erlaubt','Reference-only Gleichheit nicht normativ übernehmen'),('auxiliary reads existent','Format1/A/B/C kein reads-Schema','Nicht produktive Readpflicht oder Readsandbox erfinden'),('auxiliary limits variabel, changedFiles20, blob1MiB','§2 fixed v01 limits, kein changedFiles20-Limit','42/102 limit sind Referenceprofil, keine normative A/B/C-Erwartung'),('Coordination ADD/MODIFY exempt','§4 keine Coordination-Ausnahme','Bewusst widersprechende Referenzentscheidung nicht Authority'),('Unicode einzelne Pfade zulässig','§3 alle non-ASCII reject','Rawpath-Layerprofile trennen'),('Neue Testidentitäten auch in vorhandener File','§4/§7 bestehende Tests byte-frozen','54–56/114–116 nur Collectionlayer; Fullfunnel muss earlier rejecten'),('Synthetische checks/mutant-classification trusted inputs','§6/§8 echte Supervisorbeobachtung','Nur classifier-Layer, kein Verifierpass aus witness JSON'),('Labfailurecodes und Priorität','§4/§11 andere feste Codes/Priorität','Reviewtes Mapping; mehrere Fehler nicht anhand reference priority erzwingen')])+
p('Eine A/B/C-konforme Implementation kann den gesamten Corpus über einen ausdrücklich separaten <em>Lab-/Layerschnittstellenadapter</em> ausführen. Sie kann ihn nicht mit unveränderten Manifesten und identischen Erwartungscodes als Produktionseingang bestehen. Das ist eine Vergleichsgrenze, kein Grund, die produktiven Regeln dem Referenceprofil anzupassen. Bootstrap/Sandbox/API-Provenienz muss der Adapter niemals aus witness Inputs vortäuschen.'))

section(10,'Mutants',
p('Keine der 12 Bytepatches ist auf heutigem main anwendbar: die zu mutierenden Verifierfiles existieren absichtlich noch nicht und die Drafts nennen keine Anchorbytes. Deshalb pro Mutant <code>DOES_NOT_APPLY</code> gegen main. Diese Feststellung ist kein SPEC_STALE, sondern ein bewusst auf spätere Implementation verschobener Nachweis. Die zweite Spalte bewertet die semantische Attacke, keine ausgeführte Produktionsmutation.')+
table(['Mutant','Aktueller main','Semantische Applicability','Eingriff','Schutzwirkung / Qualität'],mutants)+
p('A1 ist ein Doppelguardmutant. P01 zeigt, dass ein genau spezifizierter verbliebener Rawhash eine Replacementannahme weiterhin blockiert. C3 lässt die unabhängige aktuelle Attemptjob-Prüfung stehen. Für diese Mutanten darf weder eine geänderte Failure-Codeausgabe noch eine Availability-Assertion als Beweis eines unsicheren PASS verkauft werden. Isolierte Assertions auf die normativ gewollte Barriere sind sinnvoll, müssen aber mit dieser begrenzten Aussage beschriftet sein. <b>Keiner der 12 ist hier als tatsächlich KILLED zertifiziert.</b>'))

reverse=[(a,b,c,d,','.join(x['id'] for x in coverage if a in x['requirements']) or 'KEIN EINZELFALL IM177-KATALOG') for a,b,c,d in reqs]
gaps=[('A-KERNEL','BASE-manifest wrong hash/missing entry/import outside allowgraph/Version mismatch','A-Stub-Acceptance muss separat benannt werden'),('A-RAW','EOF/wrong bodyhash/tree sorting/structural continuation/cache-prefix replay','128 Zusatzfälle schließen Designabdeckung teilweise, keine Produktionsruns'),('A-LIMIT/A-ENV','exact-limit framing, stdout+stderr additive, 20-min global deadline','F01 und zusätzliche Grenzproben'),('B-PATCH/B-KILL','non-named Assertion, TypeError-only, exit0+failed, optional/none und max9 mutants','Eigene Unitfixtures in Acceptance ergänzen'),('C-INDEPENDENCE','DEV same-provider und embedded binding/result/findings precision','F04 strict schemas nötig'),('C-EDIT','Reviewedit genau zwischen zwei Jobs','F02 Receipt-Semantik'),('C-FINAL/C-DEPLOY','zwei unstabile Snapshots, TTL future/expired, Rate-limit und Retrygrenze','C-Acceptance ergänzen'),('X-ERROR','Alle40 closed errors, primary+secondary Reihenfolge, no path/stdout/logleak','Kein exakt ausgewiesener kompletter Fehlerreport-Test im177-Katalog'),('X-PROPERTY','10k je Familie, independent oracle, Seed und Testinventar','§14 gesonderte Propertyabnahme; nicht als177 cases zählen')]
section(11,'Acceptance Coverage — All 177 Cases',
p('Alle AV001–177 vollständig gemappt. Die Tabelle ist eine Contract-Level-Coverageprüfung; <b>177 ist nicht die Zahl ausgeführter Produktions- oder Liveprüfungen.</b> Paket-Evidence bleibt historische Labbeobachtung. Dedizierte Layer nach §13 sind notwendig: malformed Gitfixtures dürfen früher durch Fetch/fsck sicher scheitern; Teststatusfixtures dürfen direkt den geprüften Inventorylayer prüfen, ohne vorher eine frozen Testfile zu verändern.')+
table(['Requirement','Owner','Normquelle','Normative Schutzwirkung','AV-Mapping'],reverse)+
p('Requirements ohne eindeutigen Einzelacceptance im177-Katalog oder mit zusätzlichen nicht ausformulierten Grenzfällen:')+table(['Requirement','Fehlende konkrete Probe','Closure'],gaps)+
p('Keine byteidentischen Acceptancezeilen oder identischen Inputbeschreibungen gefunden. Inhaltliche Überlappungen sind absichtliche Defense-in-depth: AV088/113 (Rename/Delete vs Inventarverlust), AV089/112 (new file vs inventory), AV029/067–069 (Parents/History), AV127/142 (survived/equivalence), AV154–156 (edit/löschung/Beobachtungsgrenze). Doppelte Coverage ist keine zusätzliche unabhängige Sicherheitswirkung.')+
p('Die folgenden vollständigen Zeilen enthalten insbesondere test-without-closed-requirement, layer ambiguity und contradictory token/outcome. AV150 reject ist kein erlaubter external result. AV115 braucht explizite Baselinereplacement- statt Coexistenzfixture. AV123–125 dürfen aus einem geblockten syscall keinen nicht vorhandenen trusted Supervisor-Sensor erfinden. AV172/173 unterscheiden Runtimebindung von Plattformabnahme.')+
table(['ID','Input (exakt aus Katalog)','Soll','Requirements','Review'],[(x['id'],x['input'],x['expected'],','.join(x['requirements']),x['review']) for x in coverage]))

section(12,'Dependency Analysis / Minimal Implementability',
p('A kann die primitive Git-/Prozess-/Pfad-/Materialisierungsgrenze isoliert entwickeln und über echte bare Repo-/FSfixtures prüfen. Ein harmloser generierter BASE-main-Stub ist ausdrücklich erlaubt. A muss nicht B-Scope, B-Inventare oder C-Reviewentscheidung vorwegnehmen. Es gibt allerdings keine fertige komplette A-B-C-IOsignatur mit Fehlertypen für alle Harnessinputs; vor Ausführung muss A-eigener Bootstraptransport statt import aus C klargestellt sein.')+
p('B kann nach unabhängig angenommenem A folgen: Contractadapter unveränderten BASE-Parser importieren, statische Policy/Scope, Worker und Inventar/Mutationsklassifikation. Ein unabhängiges, digest-gepinntes Acceptanceimage ist als Testinput nötig; C erstellt später das konkrete Produktionsrezept. Kandidaten-Python/JS wird nur in Worker geprüft, nicht als Hostauthority. C kann anschließend A/B orchestrieren, Review/Final implementieren und Deploymentrecipe abnehmen.')+
table(['Vorgang','Bereitheit','Grenze'],[('A schreiben/reviewen','technisch isolierbar','erst F01/F08 und A-relevante Acceptancepräzisierung schließen'),('B schreiben/reviewen','erst nach echter Aannahme','acceptedCommit/baseCommit/revision/hash erneuern; gepinntes Worker-Testimage'),('C schreiben/reviewen','erst nach echter Bannahme','Review/Receipt/Schema/Nativecheck-Livedrill präzisieren'),('Bootstrap installieren','externer Initial-Trustpfad','Candidate darf seine Entstehung nicht selbst zertifizieren'),('Normalen DEV/OWNER_OPS-Gate für A/B/C nutzen','kein zulässiger Ersatz für Initialbootstrap','Mixed TCB/test/drill Source-Scope ist nicht generell DEV/Owner-Produktprofil'),('Normalbetrieb einschalten','noch NO-GO','realer taskIndex/drill Contractplan auf BASE + Plattform/Imageabnahmen')])+
p('Keine zwingende logische oder Hash-Selbstreferenz gefunden: Imagekernel hat Aidentität, geladener verifierSha ist BASE; Manifest enthält nicht seinen eigenen Hash oder Image-Digest. Leerer taskIndex bleibt bewusst inaktiv. Versteckte Kreisabhängigkeiten entstehen nur, wenn A auf das erst in C angelegte github.py oder B auf eine erst von C produzierte einzige Testimagequelle festgelegt wird; diese Festlegung darf die Implementierung nicht still treffen.'))

section(13,'Size Analysis',
p('Die aktuellen Drafts sind bereits ehrlich größer als400 LOC. Produktionsschätzungen und ±30% sind keine harte semantische Abbruchgrenze; die &lt;300-Zeilen-Dateiwerte sind Planungsziele mit ausdrücklichem Kompressionsverbot. Keine heutige „400LOC“-Limitverletzung und kein eigenständiger BLOCKING-SIZE-Defekt nachgewiesen. Die Zahlen unten sind unabhängige Engineering-Schätzungen, keine gezählte existierende Implementation.')+
table(['Contract','Draft production estimate','Independent production range','Independent test/harness LOC','CREATE files / production / tests'],[('A','1320 ±30%','1500–2400','2000–3500','13 / 8 / 5'),('B','1190 ±30%','1600–2600','2500–4300','13 / 8 / 5'),('C','1008 ±30% incl workflow/image/data','1300–2200','2400–4200','17 / 12 incl workflow/data/drill / 5')])+
p('Treiber: bounded process I/O plus child cleanup, raw object/cache/strict parser/trie/secure cleanup; Inventoryreporter/error taxonomy plus Dockertransport/quotas/mutations; paginated review types/Supersedes/races plus Image/Workflow/Policydata. Total grob4400–7200 Produktionszeilen und6900–12000 Test-/Harnesszeilen. JSONfixturebytes separat. Wiederverwendbarer externer Acceptanceharness kann Umfang reduzieren; keine Zahl ist eine Zusage, unabhängig von finalen Schemas.')+
p('Scope gestattet zusammen43 neue Dateien; keine bestehenden Dateien dürfen modifiziert werden. Falls eine solide Implementation mehr Produktionsmodule benötigt, braucht sie eine neue Contractscope-Revision; Einzeiler/komprimierte Monolithen sind keine Abhilfe. Tests dürfen größer sein als300LOC. Eine spätere hart durchgesetzte ±30%- oder300LOC-Grenze ohne scopeanpassung wäre gesondert zu prüfen.'))

section(14,'128 Additional Adversarial Cases',
p('128 zusätzlich autorisierte Contract-Level-Angriffe, CA001–128: je32 A/B/C/Cross. Sie prüfen Kombinationen, Grenzwerte, noch ungeschlossene Semantik und Defense-in-depth-Masking über den177-Katalog hinaus. Methodik jeweils <code>CONTRACT_REASONING</code>; kein behaupteter Produktionslauf. Acht begrenzte Scratchproben P01–08 dienen als separate konkrete Evidenz. Tabellenwerte ALLOW/REJECT beschreiben Sollsemantik bei sonst gültigen Layerinputs, GAP verlangt Contractklärung, BOUNDARY benennt ein explizit begrenztes Schutzversprechen.')+
table(['ID','Gruppe','Zusätzlicher Angriff','Normquelle','Bewertung'],[(x['id'],x['group'],x['attack'],x['requirement'],x['assessment']) for x in additional])+
table(['Probe','Gemessene / modellierte Beobachtung','Aussage'],[(x['id'],json.dumps(x['observed'],ensure_ascii=False),x['interpretation']) for x in probes])+
p('P01 Git-Replace und P02 Linux-openat sind reale lokale Systemproben. P03 ist exakte Bytearithmetik. P04–08 sind explizit kleine Information-/Regelmodelle, keine Remote- oder Production-Runs. Alle Skripte und Rohoutputs sind mitgeliefert. Keine Produktionsoptimierung, keine neue Verifierimplementation.'))

section(15,'Findings',table(['ID','Severity','Owner','Quelle','Befund','Minimale Closure'],findings)+p('BLOCKING bedeutet: den jetzigen Contracttext nicht als implementierungsreifen exakten Prüfauftrag registrieren. Es bedeutet nicht, dass eine Architektur-Neuentwicklung verlangt wird. F06/07/10 sowie die bewusst inaktiven B/Cdependency-SHAs sind keine erfundenen sofortigen Produktionslücken.'))

verdict=[('A','REQUEST CONTRACT CHANGES','F01 Output-/Streamingbudget; F08 belegbare Guardmutanten; A-relevante F03 Layer/Codes. Architektur Git/Pfade/History tragfähig.'),('B','REQUEST CONTRACT CHANGES','F01 framed transport; F03 inventory/isolation acceptance; F08 classifier/Guardmutanten. 1087→19 normativ geschlossen.'),('C','REQUEST CONTRACT CHANGES','F02 Reviewbeobachtungsgrenze; F04 closed review/Supersedes; F09 nativecheck/attempt responsibility; F03/F08.'),('Gesamt','REQUEST CONTRACT CHANGES','Kein aktueller Contract erhält PASS FOR ARCHITECTURE REVIEW in seiner exakten Revision. Keine Implementation oder Aktivierung durchgeführt.'),('Produktivaktivierung','NO-GO','Image/Container/Quota/nativecheck/H1–H3-Livedrills fehlen; zusätzlich blocking Contractdefekte.')]
section(16,'Verdict per Contract',table(['Contract','Verdict','Grund'],verdict)+p('Dieses Zertifikat ist eine unabhängige Contractprüfung der genau identifizierten Bytes, kein Bestätigungsstempel des alten GO-Berichts. Unabhängigkeit beruht auf eigener Quellprüfung, eigenen Gegenbeispielen und gecheckter Sourceidentität; keine erfundene Provider- oder Mehragentenunabhängigkeit. Es wurden keine Subagents eingesetzt.'))

section(17,'Contract A Registration Readiness',
p('<b>Kann A jetzt unabhängig reviewed/registriert werden?</b> Als Draft Gegenstand eines Reviews: ja. Als erfolgreich zertifizierter exakter Implementierungscontract registrieren: <b>NEIN, REQUEST CONTRACT CHANGES</b>. Die vorhandene Format1-Parsergültigkeit und echte current-main-Kompatibilität reichen nicht über F01/F08 und die A-relevante Acceptancepräzisierung hinweg.')+
ul(['A lokal minimal reparieren: log/output vs framed Objektstream sauber budgetieren; Byte-/Output-Grenzfälle festschreiben.','A1/A4 semantische Assertions und verbleibende Guards präzisieren; später echte Anchorbytes mit independent reviewer einfrieren.','A-relevante Acceptanceeingaben/Precedence festschreiben, insbesondere positive numerische IDs/Exponentialnotation und Historylimitcodes; A-eigene Live-GET-/Harnessownership benennen.','Neue exakte Revision mit unverändertem Format1 kanonisch parsen und neu hashen; Scope/BASE gegen dann aktuellen main erneut prüfen. B/C Annahmen nicht vorwegnehmen.','Externe unabhängige Bootstrapabnahme separat dokumentieren; erst danach echte Aaccepted-SHA für neue B-Revision benutzen. Keine Selbstzertifizierung und keine Registrierung/Pushes aus diesem read-only Auftrag.'])+
p('Historischer VERIFIERvergleich bleibt NOT COMPARABLE bis der echte 341ec983-Draft vorliegt; kein erneuter Designpass als Ersatz. Aktuelle Report-/Contract-Bytes, Coverage177, Zusatzfälle128, Mutantenmatrix12 und Referencekompatibilität150 liegen im Evidencepaket. <b>STOP — keine Implementation.</b>'))

appendix='<section id="exact-contracts"><h2>Anhang — Exakte Contracttexte</h2>'+p('Die folgenden Texte wurden unverändert aus den tatsächlichen Files eingebettet. Hashes und Bytes gelten für die separaten Originalfiles, nicht für HTML-Escaping. Das ZIP enthält die Originalbytes.')+''.join('<h3>Contract '+r['contract']+'</h3>'+pre((ROOT/r['file']).read_text()) for r in identity)+'</section>'
appendix+='<section id="requirements"><h2>Anhang — Dokumentation und Reproduktion</h2>'+p('Aktuelle Primärquellen wurden direkt geöffnet. Dokumentation bestätigt, dass re-runs Original-SHA und ursprüngliche Actorprivilegien behalten; PR-target läuft im trusted Base/default-Branch-Kontext und verlangt eine gesicherte Untrusted-Codegrenze. REST exposes triggering_actor sowie attempt/job-Reads. Git cat-file batch frames include OID/type/size plus content and LF. Diese Quellen ersetzen keine Live-Drills.')+ul([
'<a href="https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs">GitHub: Re-running workflows and jobs</a>',
'<a href="https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows">GitHub: pull_request_target / workflow events</a>',
'<a href="https://docs.github.com/en/rest/actions/workflow-runs">GitHub REST: workflow runs / attempts / triggering_actor</a>',
'<a href="https://docs.github.com/en/rest/actions/workflow-jobs">GitHub REST: attempt workflow jobs</a>',
'<a href="https://docs.github.com/en/rest/pulls/reviews">GitHub REST: pull request reviews</a>',
'<a href="https://git-scm.com/docs/git-cat-file">Git: cat-file batch framing</a>',
'<a href="https://vitest.dev/api/advanced/reporters.html">Vitest: public reporters</a>'])+pre('python3 certification/audit_probes.py\n# Reference-SELF-comparison; NOT production comparison:\npython3 reference/differential.py .\n# Exact main parser results and baseline outputs are in source-identity.json/main-baseline.json.\n# No Docker/remote mutation tests are claimed.')+'</section>'
nav='<nav>'+''.join('<a href="#s'+str(i)+'">'+str(i)+'. '+E(t)+'</a>' for i,t,_ in sections)+'</nav>'
css='''body{margin:0;background:#f3f5f8;color:#172238;font:16px/1.6 system-ui,sans-serif}main{max-width:1280px;margin:auto;padding:36px 28px}header{padding:32px;border-radius:16px;background:#13243b;color:white}header p{color:#d6e2ef}.badge{display:inline-block;background:#ffd3a8;color:#522803;padding:7px 12px;border-radius:8px;font-weight:700}nav{display:flex;flex-wrap:wrap;gap:10px;margin:26px 0}nav a{background:white;padding:7px 10px;border:1px solid #dde3ed;border-radius:7px;text-decoration:none;color:#243957}section{background:white;border:1px solid #dde3ed;border-radius:12px;margin:22px 0;padding:26px}h1{font-size:29px;line-height:1.3}h2{font-size:24px;color:#17334e}h3{font-size:20px}.table{overflow:auto;margin:20px 0}table{border-collapse:collapse;min-width:700px;width:100%;font-size:14px}th,td{border-bottom:1px solid #dde3ed;padding:10px;vertical-align:top;overflow-wrap:anywhere}th{background:#eaf0f6;text-align:left}tr:nth-child(even){background:#f7f9fc}code{background:#edf1f6;padding:2px 4px;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.55 ui-monospace,monospace;background:#f1f4f8;padding:20px;border-radius:9px}a{color:#185e96}footer{padding:20px;color:#465772} @media print{body{background:white}main{padding:0}nav{display:none}section{border:0;border-radius:0;padding:10px 0;break-before:page}.table{overflow:visible}table{min-width:0;font-size:10px}header{background:white;color:#172238}header p{color:#172238}}'''
doc='<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>FORGE VERIFIER A/B/C INDEPENDENT CERTIFICATION</title><style>'+css+'</style></head><body><main><header><p>FORGE V0.1 · INDEPENDENT CONTRACT CERTIFICATION · 2026-10-04</p><h1>FORGE VERIFIER A/B/C INDEPENDENT CERTIFICATION</h1><span class="badge">REQUEST CONTRACT CHANGES — A noch nicht registrierungsbereit</span><p>Strict read-only · 177 Acceptance-Mappings · 128 zusätzliche Contractangriffe · 12 Mutantenprüfungen · 150 Referencecases · 8 begrenzte Scratchproben</p><p>Base '+MAIN+' · Historischer Draft 341ec983…: NOT COMPARABLE · Keine Produktionsimplementation.</p></header>'+nav+''.join('<section id="s'+str(i)+'"><h2>'+str(i)+'. '+E(t)+'</h2>'+b+'</section>' for i,t,b in sections)+appendix+'<footer>Alle Urteile gelten für die identifizierten Bytes und die ausgewiesenen Beobachtungsgrenzen. Kein kanonischer Commit, Branch, PR, Kommentar, Review oder GitHub-Settingswrite. STOP.</footer></main></body></html>'
(OUT/'FORGE-VERIFIER-ABC-INDEPENDENT-CERTIFICATION.html').write_text(doc)

# Flat CSV exports for exact per-row review.
for name,rows in [('acceptance-coverage',coverage),('reference-compatibility',refcompat),('additional-cases',additional)]:
    with (OUT/(name+'.csv')).open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows([{k:json.dumps(v,ensure_ascii=False) if isinstance(v,(list,dict)) else v for k,v in x.items()} for x in rows])

print(json.dumps({'sections':len(sections),'acceptance':len(coverage),'additional':len(additional),'mutants':len(mutants),'reference':len(refcompat),'requirements':len(reqs),'reportBytes':len(doc.encode())}))
