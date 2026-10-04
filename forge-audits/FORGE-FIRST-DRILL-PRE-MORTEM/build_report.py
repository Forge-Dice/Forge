from pathlib import Path
from html import escape
import hashlib,json,datetime

out=[]
def p(s, cls=''): out.append('<p class="'+cls+'">'+escape(s)+'</p>')
def h(s,n=3): out.append(f'<h{n}>'+escape(s)+f'</h{n}>')
def table(headers,rows):
 out.append('<div class="tablewrap"><table><thead><tr>'+''.join('<th>'+escape(x)+'</th>' for x in headers)+'</tr></thead><tbody>')
 for row in rows: out.append('<tr>'+''.join('<td>'+escape(str(x))+'</td>' for x in row)+'</tr>')
 out.append('</tbody></table></div>')
def pre(s): out.append('<pre><code>'+escape(s)+'</code></pre>')
def checks(items): out.append('<ul class="checks">'+''.join('<li>☐ '+escape(s)+'</li>' for s in items)+'</ul>')
def section(n,title): h(str(n)+'. '+title,2)

main='3d7545d843883418348004e68717399a64da7a7d'
tree='67103229baccaefd68ce5047d8503eca9883f1d3'
h('FORGE FIRST DRILL PRE-MORTEM',1)
p('Forge V0.1 · clampAtZero · Acceptance Lab · 4. Oktober 2026')
p('ERGEBNIS: PRE-MORTEM ABGESCHLOSSEN. LIVE-START = STOP / NO-GO. DRILL = NOT EXECUTED. PRODUCT-RUN = BLOCKED.','status')
p('Dieser Auftrag hat ausschließlich gelesen und ein lokales Protokollmodell ausgeführt. Keine Commits, Branches, PRs, Reviews, GitHub-Settings, Re-runs, Merges oder Deployments wurden erzeugt oder verändert. Alle folgenden Live-Aktionen sind ein Runbook für einen später separat autorisierten Auftrag. Kanonisches Repository: Forge-Dice/Forge, ID 1401864629, public, Default-Branch main.')
h('Aktuell belegter Zustand')
table(['Beobachtung','Evidence / Konsequenz'],[
 ['main',main+'; Tree '+tree+'; Merge PR #1 vom 3. Oktober 2026. Alle Dateilesungen dieses Berichts an diese SHA gebunden.'],
 ['Schutz-Readback','GET branches/main: protected=false, protection.enabled=false, keine Required Checks. GET rulesets: []. Kein aktives Sieben-Rulesets-Modell belegt.'],
 ['Repo-Inventar','Rekursiver Tree vollständig, truncated=false. Keine tools/forge_v01/**, forge/verifier/**, .github/workflows/forge-v01.yml, src/forge-drill/clamp-at-zero.ts oder tests/forge-v01/clamp-at-zero.test.ts. Bootstrap A/B/C existieren als externe DRAFTs, nicht als diese Dateien auf main.'],
 ['Identitäten','Wuerfelduell: admin; forge-codex: write, per Collaborator-Permission-Read. Geplante Pins: Owner 315180734; Developer 337272506. Token-Schreibidentität ist vor Live erneut numerisch zu bestätigen.'],
 ['Merge-Konfiguration','allow_merge_commit=true, allow_squash_merge=true, allow_rebase_merge=true; allow_auto_merge=false; delete_branch_on_merge=false.'],
 ['Actions-Inventar','GET actions/workflows wurde vom Connector als nicht unterstützter Endpoint abgelehnt. Kein Beweis für leere serverseitige Actions-Konfiguration; fehlende Repo-Workflowdateien sind durch den Tree belegt. Execution Policy und geerbte Regeln sind nicht administrativ zertifiziert.'],
 ['Forge Core','contract-document.ts, runs.ts, verification.ts und dogfood.test.ts gelesen. Core ist reiner Domain-Kern über gelieferte Beobachtungen. Seine Coordination-Ausnahme, Developer-Mutationsfallbacks und isAncestor-Ergebnisse sind keine produktive GitHub-Freigabequelle.']])
h('Quellenidentität und Präzedenz')
rows=[]
for n in ['FORGE-V0.1-BOOTSTRAP-EXPERIMENTAL-REPORT.html','FORGE-MINIMUM-VERIFIER-IMPLEMENTATION-PACKAGE.html','FORGE-BOOTSTRAP-0001A.contract.DRAFT.md','FORGE-BOOTSTRAP-0001B.contract.DRAFT.md','FORGE-BOOTSTRAP-0001C.contract.DRAFT.md','FORGE-RULESET-LIVE-DRILL.html']:
 b=(Path('inputs')/n).read_bytes(); rows.append([n,len(b),hashlib.sha256(b).hexdigest()])
table(['Gelesenes Artefakt','Bytes','SHA-256'],rows)
p('Quellen sind Designinput: Experimental Report §16; Implementation Package insbesondere §§2–11, §12 und Handoff; Contract C und Ruleset Live Drill. Spätere konkrete Implementation-Regeln präzisieren den Experimental Report. Wo ein Widerspruch bleibt, wird er ausdrücklich als BLOCKER ausgewiesen. Ein alter Lab-PASS zertifiziert weder die neue Implementierung noch aktuelle GitHub-Settings.')
h('Vorab gefundene Acceptance-Blocker')
table(['ID','Befund','Vor Start erforderliche Auflösung'],[
 ['B0','Verifier, Workflow, Fixtures, registrierter Drill-Contract/Plan und Rulesets fehlen auf dem beobachteten main.','A → B → C unabhängig abnehmen; reale Accepted-SHAs, Image-Digest, Sandbox- und Plattformnachweise; danach echte Registrierung.'],
 ['B1','Draft-PR → grünes Gate → erst danach Implementation ist mit §4 nicht ausführbar: Draft ergibt PR_STATE.','Draft-Gate ist ein erwarteter roter Safety-Checkpoint. Technisches grünes Gate erst nach Implementation und ready_for_review. Keine spontan neue Draft-Freigabe.'],
 ['B2','R2 erlaubt merge/squash/rebase. Eine falsche Merge-Methode wird vom vorgeschlagenen Ruleset nicht gestoppt.','Für diesen Drill operational merge festlegen und vor Request prüfen; Protection-Level für falsche Methode ausdrücklich MANUAL ONLY. Keine Behauptung einer Ruleset-Sperre.'],
 ['B3','R3 realisiert Owner-only Merge durch einen vorgesehenen pull_request-Bypass. Das Live-Paket verlangt bypass_rules=true.','Literal „kein Schutz-Bypass überhaupt“ ist mit diesem Modell unvereinbar. PASS unten unterscheidet geplante R3-Autorisierung von keiner Umgehung von R1/R2/Actions/Scope. Wird selbst R3 verboten, bleibt strikter Exit NO-GO; dieses Lab verändert das Modell nicht.'],
 ['B4','§4 prüft exact scope vor protected freeze; AV-084/086/090 nennt für out-of-scope geschützte Dateien SCOPE_PROTECTED. Die Primary-Code-Erwartung kann kollidieren.','Vor Live eine unabhängig abgenommene verbindliche Code-Priorität festhalten. Dieses Runbook verwendet normative Phasenpriorität: SCOPE_PATH zuerst, SCOPE_PROTECTED als Layerprobe. Ohne Klärung kein exakter-Code-PASS.'],
 ['B5','Codex read receipt ist kein Format des aktuellen Verifierpakets; eine Receipt-Datei oder Coordination-Änderung wäre außerhalb D1-Scope.','Runbook-Konvention unten: leeres Receipt-Commit ohne Treeänderung. Es ist Selbstauskunft, keine maschinelle Lesebestätigung. Schema-/History-Verträglichkeit vor Start prüfen; keine Zusatzdatei.'],
 ['B6','Ein PR ohne Tree-Diff ist kein verlässlich verfügbarer Draft-Startpfad.','Receipt allein erzeugt keinen fachlichen Diff. Für Draft vor finaler Implementation nur die unten definierte gleichwertige Source-Vorbereitung verwenden. Kein leerer PR als angenommene GitHub-Fähigkeit.'],
 ['B7','Native PR-target-Checks am aktuellen PR-Head, Re-run-all-Receipt, Execution-Policy und Owner-PR-Bypass sind noch keine Live-Evidence.','Isoliertes Ruleset-Live-Paket mit positiven Kontrollen bestehen; Check/App/Suite/head_sha Bindung belegen. Kein Custom-Check-Publisher als Fallback.']])

section(1,'Success Path')
p('A = authoring base nach akzeptiertem Bootstrap C. K = Commit mit exakten Contractbytes. G = Owner-Registration-Merge auf main. B = danach tatsächlich aktuelles main; im ruhigen Drill B=G. V=B ist verifierSha. C = ContractHash, P = PolicyHash, L = PlanHash, I = OCI-Image-Digest. R = Receipt-Commit; Hpre = Draft-Vorbereitungshead; H = endgültiger Implementationshead; W = GitHub workflow run ID; a = Attempt. Review- und Check-IDs bleiben eigenständige GitHub-IDs. Alle SHAs ausgeschrieben, kein Branchname als Identität.')
p('Hashdomänen: C=SHA256("forge-contract-v1\\n" + exact Contract UTF-8); L=SHA256("forge-plan-v1\\n" + exact Planbytes); P analog "forge-policy-v1\\n"; E=SHA256("forge-external-review-v1\\n" + decoded external report bytes). Raw-file SHA-256 ist zusätzliches Inventarfeld und nicht C. Contract.baseCommit=A darf vor G liegen; authentische Ancestry A→B erforderlich. Der Contract darf G nicht vorab selbstreferenziell enthalten.')
table(['Schritt','Actor / Input','GitHub-Objekt','SHA-/Identity-Bindung','Erwartete Evidence / Zustand'],[
 ['1 Contract registration','Owner; independently reviewed Format-1-Contract, DEV-Plan und Taskindex.','Owner-authored Registration-PR/Commit K; Merge G.','K:file bytes → C; Plan → L; Policy index pinnt C/L; baseCommit=A ist Vorfahre von B.','Parser OK, vollständiger Contracttext, Rawhash/Blob, Approval/Acceptance der Registrierung; main readback B. Registrierung ist kein behaupteter persistenter ForgeLog.'],
 ['2 Handoff','Owner/Coordinator gibt Codex unveränderliche Texte, Pins, Regeln und STOP-Liste.','Handoff-Text außerhalb Developer-Dateidiff; Referenz auf K/G/B.','repoId, taskId, C/L/P, B/V/I; numerischer Developerpin.','Handoff vollständig und gehasht; keine Taskumdeutung durch PR-Body.'],
 ['3 Codex read receipt','Codex liest Contract/Plan/Policy/TCB-Grenzen; bestätigt Pins und Scope.','Zunächst textuelle Selbstauskunft; danach leeres Commit R auf neuer Run-Branch.','R.parent=B; R.tree=B.tree; Commitmessage bindet B/C/L/P/V/I und Handoffhash, nie eigene SHA.','Git-Commit R plus unveränderte Tree-ID; Commitmessage kein Berechtigungsnachweis und kein Beweis tatsächlichen Lesens.'],
 ['4 Run branch','Codex, eigener authentisierter Developer-Zugang.','forge/run/codex/FORGE-DRILL-0001/d1-01.','Neue Ref beginnt bei B; R und alle Nachfolger linear/ein Parent; kein rebase/force-push/update-branch.','Create/update-Actor, Ref readback, parent graph; R4 erlaubt Writer, R1 bleibt wirksam. Physisch muss Branch vor dem Receipt-Push existieren.'],
 ['5 Draft PR','Codex; nur erlaubte Source-Vorbereitung Hpre gemäß §2.','Draft PR nach main im selben Repo.','PR.user.id=337272506; base=B; head=Hpre; task namespace korrekt.','Draft=true, exakter 1-Datei-Diff, PR-ID. Receipt-Commit allein genügt nicht als verlässlicher PR-Diff.'],
 ['6 Draft gate','Trusted workflow aus B, opened/synchronize.','forge-gate; forge-verify always() roter dependency path.','Wdraft event SHA=B; gate liest aktuellen Draftzustand.','PR_STATE; kein HEAD-Testlauf, kein gültiges Gate-Receipt, kein grüner Skip. Das ist der gewünschte Draft-Schutz.'],
 ['7 Implementation','Codex; Source if-Form → exakt ternäre Form.','Lineares Source-Commit H, remote push; danach ready_for_review.','H stammt von R/Hpre/B; netto nur source MODIFY; alle Zwischencommits Scope-konform.','Rawtree-/History-Diff; Developer-Lokalergebnisse nur Selbstauskunft; Head freeze für Review.'],
 ['8 Technical gate + verify','Trusted Stage 0/BASE-IO-Verifier auf frischen getrennten VMs.','W, Attempt 1; forge-gate und forge-verify.','B=event GITHUB_SHA=live main=V; current PR head=H; policy P/contract C/plan L/image I.','Gate success mit reviewPending=true; neues Receipt. BASE/HEAD Typecheck + vollständige Inventare; Mutant m-negative KILLED. Ohne Attestation forge-verify failure REVIEW_MISSING, bei sonst sauberem Lauf.'],
 ['9 External review','Anthropic-Reviewer erhält exakte Inputs und technische Evidence.','Externer Bericht als später eingebettete Bytes, kein verpflichtender eigener GitHub-Review.','binding={repoId,pr,B,H,C,V,P}; provider anthropic; result approve; keine blocking findings.','Vollständiger Bericht, Modellkennung, E; Herkunft vom Owner geprüft/attestiert. E ist keine kryptographische Provider-Signatur.'],
 ['10 Owner attestation','Owner, ID 315180734; prüft externes Review und Settings.','Submitted PR Review, state COMMENTED, commit_id=H.','Exaktes FORGE-ATTESTATION-V1 JSON; B/H/C/V/P/E; W und nächster Zielattempt a; deploymentDigest/checkedAt.','Review ID, exact bodyhash, server user.id, submitted_at, vollständige Reviewliste, explizites supersedes aktueller Blocker. Keine native APPROVED-Ersetzung.'],
 ['11 Re-run all jobs','Owner startet alle Jobs des ausgewählten W.','W gleicher ID, a>=2; zwei frische Jobs im selben Attempt.','Original event SHA bleibt B; triggering_actor.id=Owner; beide Gate/Verify-Receipts a identisch.','Kompletter unabhängiger Wiederlauf, keine reused Workerdateien; vollständige Tests/Mutanten; zwei stabile Final-Snapshots ≤10 s; beide echte Checks success.'],
 ['12 Merge','Owner; unmittelbar frische Readbacks, manuell, kein Auto-Merge/Queue.','Expected-head async direct_merge Request, merge_method=merge; anschließend terminaler Merge M.','Request sha=H; main noch B; Checks/Review/Policy unverändert; nur vorgesehene R3-PR-Autorisierung.','Request UUID+Payload, terminal status merged, PR.merged_by Owner, M.parents=[B,H], M.tree=H.tree, main=M; keine Branchlöschung. 202/pending/enqueued ist kein PASS.']])
p('Zwischen Schritt 8 und 11 erwartet der Prozess bewusst rot→grün. Eine Attestation für a=2 nach a=1 ist zielgebunden; sobald a=2 verbraucht ist, braucht a=3 eine neue Owner-Attestation. Bei Veröffentlichung weiterer Contracts darf main nicht nebenbei weiterlaufen: möglichst alle Drillpläne vor dem gemeinsamen B publizieren, D1 zuletzt mergen.')
h('Evidence-Zugriff bei permissions:{}')
p('Trusted Host/Supervisor emittiert bounded, strukturierte Reports; Workerdateien oder stdout sind keine selbstständige Autorität. Keine vorausgesetzte Artifact-Upload-Action mit erweiterten Rechten. Owner/Observer sichern native Run/Job/Check-Readbacks und Logs über bereits autorisierten Lesezugang. Nicht downloadbarer Bericht oder fehlende Pagination ergibt INCONCLUSIVE, keinen PASS. Secrets, Tokens und untrusted Volltext gehören nicht ins Evidence Sheet.')

section(2,'D1 — kleinster legitimer Change')
p('Der erste fachliche Drill verändert keine Semantik und keinen Mystery-Code. Später vorab von Bootstrap C/Owner einzubringen: genau Source und drei vertrauenswürdige Tests. Der Developer darf nur eine vorhandene Source-Datei modifizieren; create=[]; modify=["src/forge-drill/clamp-at-zero.ts"]. Der ältere Pfad src/forge/drill/... ist innerhalb src/forge/** geschützt und wird nicht benutzt.')
pre('BASE — src/forge-drill/clamp-at-zero.ts\nexport function clampAtZero(n: number): number {\n  if (n < 0) return 0;\n  return n;\n}\n\nHEAD — exakte Zielbytes, UTF-8/LF, abschließender LF\nexport function clampAtZero(n: number): number {\n  return n < 0 ? 0 : n;\n}\n')
p('Domain: endliche JavaScript-Zahlen. n<0 liefert +0; n≥0 liefert n, einschließlich unverändertem -0. NaN/±Infinity sind außerhalb dieses fachlichen Vertrags; keine neue Validierung oder Fehlerschnittstelle. Keine barrel exports, dependencies, Config-, Coordination-, Dokumentations-, Test- oder Receipt-Dateien. Netto-Diff B→H genau eine MODIFY-Zeile, Mode 100644 bleibt gleich.')
pre('Trusted BASE-Testdatei: tests/forge-v01/clamp-at-zero.test.ts\nimport { describe, expect, it } from "vitest";\nimport { clampAtZero } from "../../src/forge-drill/clamp-at-zero.ts";\n\ndescribe("clampAtZero", () => {\n  it("negative", () => expect(clampAtZero(-1)).toBe(0));\n  it("zero", () => expect(clampAtZero(0)).toBe(0));\n  it("positive", () => expect(clampAtZero(2)).toBe(2));\n});\n')
p('Diese Testbytes sind geplante Drill-Fixture, keine Behauptung über schon implementierte C-Tests. Falls C andere Titel gewählt hat: vor Registrierung Titel und TestIdentity aus dem echten BASE-Inventar pinnen. Danach keine Umbenennung. Vollständiges Inventar statt Testzahl; project=forge-v01, file=tests/forge-v01/clamp-at-zero.test.ts, ancestors=["clampAtZero"], title=negative/zero/positive, occurrence=0, in exakt der akzeptierten Reporter-Schemaform.')
table(['Contract-/Planfeld','Exakte Drill-Anforderung'],[
 ['taskId / contractVersion','FORGE-DRILL-0001 / echte akzeptierte Revision, anfänglich 1; nicht bereits registriert.'],
 ['baseCommit','A, existierender Authoring-Snapshot vor Registration G; dependencies nur reale Accepted-SHAs des Bootstrap, niemals null.'],
 ['requiredChecks','Geordnete Liste: {name:typecheck,command:forge-v01:typecheck}; {name:test,command:forge-v01:test}; {name:mutations,command:forge-v01:mutations}. Keine Shell-Eval.'],
 ['mutationSmoke','required; Plan profile=DEV; approvedTcbPaths=[]; addedTestFiles=[]; checks exakt wie Contract.'],
 ['m-negative','path Source; anchorBytes="return n < 0 ? 0 : n;"; replacementBytes="return n;"; canonical Base64 im echten Plan. Genau ein Anchor; Original-/Mutantsha und ein Source-MODIFY.'],
 ['Mutant-Auswahl','Vollständige trusted Clamp-Testdatei; namedTests enthält negative-TestIdentity. negative failed ausschließlich AssertionError; zero/positive passed; Exit 1; Compiler und Collection sauber.'],
 ['PASS fachlich','BASE vollständig grün; HEAD vollständig grün; alle BASE-Testidentitäten weiter passed; m-negative KILLED; keine Equivalence-Ausnahme und kein Developer-Fallback.']])
h('Receipt / Draft-Vorbereitung ohne neue Datei')
p('Operationaler Plan, vor Live explizit im akzeptierten Drilltext festzuhalten: R ist ein leerer, linearer Commit mit Tree=B.tree. Commitmessage enthält nur fixe Lesebestätigung und Pins; R selbst wird nach Commit in Evidence eingetragen. Anschließend Hpre ändert in derselben Source genau die if-Zeile in eine äquivalente Blockform (if (n < 0) { return 0; }), um einen echten Draft-Diff zu haben. H setzt danach exakt die Zielbytes. Beide Sourcecommits erlauben nur diesen Pfad. Final kein zusätzlicher Kommentar und kein format-only Netto-Rest. Der vorbereitende Commit wird nicht als bereits erfolgreicher Mutationstest ausgegeben: sein ternärer Anchor existiert noch nicht; Draft bleibt PR_STATE.')
p('Wer die absolut minimale Ein-Source-Commit-Historie verlangt, erstellt Draft erst mit fertigem H und benutzt denselben Draft-STOP vor ready_for_review. Dann steht Implementation physisch vor Draft. Die angeforderte Reihenfolge ist mit der expliziten Hpre-Konvention nachvollziehbar; keine versteckte GitHub-Fähigkeit wird vorausgesetzt.')

section(3,'D2–D9 — isolierte negative Drills')
p('Ein separater Run/PR pro D2–D9; keine Sammelangriffe und kein Wechsel zwischen negativer und positiver Version auf derselben kompromittierten History. Gemeinsame gültige Grundlage: eingefrorenes B, registrierter D1-Contract/Plan, gültige Identität/Namespace, nicht Draft, erlaubte Source-Zielbytes, keine Attestation vor den jeweiligen Scopeproben. D2–D7 machen genau eine zusätzliche Dateimutierung. Kein gleichzeitiger Main-, Head-, Review-, Mode- oder Identitätsfehler. Tests/Configs bleiben ansonsten unverändert.')
p('Attribution: Ein einzelner Eingriff kann sowohl exact scope als auch freeze verletzen. Das ist kein Vorwand, eine erreichte spätere Schicht zu behaupten. Normative Phase 7 gewinnt vor Phase 8. Separate Layerproben bekommen bereits akzeptierte Vorbedingungen genau ihrer Schicht, ohne die produktive Policy zu lockern. B4 muss vor Live geklärt sein. Full-funnel-Rejection, Layer-Rejection und GitHub-Workflow-Block werden getrennt erfasst.')
table(['Drill','Setup / eine verletzte Invariante','Rejecting layer / erwarteter Code','GitHub-Zustand','Cleanup'],[
 ['D2 Scope','D1-Source + genau eine bestehende, ungeschützte andere .ts-Source außerhalb scope.modify mit semantikneutraler Änderung. Vorab konkret im B-Manifest pinnen, kein src/forge/** oder Mysterypfad.','Stage 1 exact scope: SCOPE_PATH; Stage 2 dependency failure, kein Worker. Ist kein anderer normaler Sourcepfad in B vorhanden: ausschließlich lokale Scope-Fixture, Live D2 nicht durch Mystery-Edit improvisieren.','PR offen/unmergefähig; gate failure; verify explizit failure; nur erlaubte trusted Workflowjobs.','Nach Evidence PR schließen; Branch erhalten; neuer sauberer Run zur Wiederaufnahme.'],
 ['D3 Test gelöscht','D1-Source + nur Clamp-Baseline-Testdatei löschen. Invariante: keine DELETE-Operation.','Stage 1 SCOPE_PATH. Separater Inventaradapter mit vollständigem sonst gültigem Report: TEST_INVENTORY bei fehlender Datei/Identität. Kein Live-Worker dafür ausführen.','Native Checks rot; kein fachlicher HEAD-Lauf. Missing Tests werden nicht als erfolgreich bewiesene Live-Inventarschicht bezeichnet.','Schließen, Ref erhalten; Löschung in späterem Commit zu revertieren reinigt History nicht.'],
 ['D4 Test skipped','D1-Source + nur negative it→it.skip in existierender trusted Testdatei. Invariante: Test-Blob unveränderlich.','Full funnel nach normativer Priorität SCOPE_PATH; isolierte Freezeprobe SCOPE_PROTECTED; isolierte vollständige Inventarprobe TEST_STATUS. Scope/Freeze-Overlap dokumentiert, keine zweite Injection.','Keine PR-Testausführung; beide Checks rot. Ein Vitest Exit 0 mit skip ist in der Layerprobe kein PASS.','Schließen/erhalten; keinen Testskip ins positive B übernehmen.'],
 ['D5 Config injection','D1-Source + nur neue vitest.config.mjs mit include=[] (kein Code, keine zweite Datei). Invariante: HEAD darf keine Teststeuerung liefern.','Full funnel SCOPE_PATH nach §4; isolierte Schutzklassifikation SCOPE_PROTECTED. Trusted config darf den Kandidaten nie laden.','Gate rot, kein Configimport/HEAD-Worker; keine unerlaubten push/pull_request/dispatch Jobs. Fehlende Jobs allein kein Execution-Policy-Beweis.','Schließen/erhalten; genau gleiche Settings wie positive Kontrolle.'],
 ['D6 Protected workflow','D1-Source + nur .github/workflows/evil.yml mit harmlosem push-Sentinel; keine Secrets/Netzwerk/Schreiboperation. Invariante: Developer-Workflowquelle untrusted.','Static gate: SCOPE_PATH nach §4, Schutzlayer SCOPE_PROTECTED. Zusätzlich Actions-Policy muss evil vor Jobstart blockieren; deren native Blockreason ist kein Forge-Code.','Trusted PR-target gate/verify dürfen laufen und müssen rot sein. evil: zero started jobs plus positive Control und explizite Policy-Blockevidence. Start eines evil-Jobs = global STOP.','Evidence zuerst; PR schließen, Branch erhalten. Unerwarteter Start: autorisierten Liveauftrag sofort stoppen; keine Policy lockern.'],
 ['D7 Extra file','D1-Source + nur notes.txt mit einem konstanten kurzen Satz, Mode 100644. Invariante: exakte Pfad-Allowlist.','Stage 1 SCOPE_PATH; keine Prefix-/Coordination-Ausnahme.','PR unmergefähig; beide Checks failure; kein HEAD-Worker.','Schließen/erhalten; kein nachträgliches Löschen zum Reparieren der History.'],
 ['D8 Survivor','Eigene NEGATIVE-FIXTURE auf separater disponibler Testoberfläche: saubere D1-Source, trusted Plan mit einem Audit-Mutant, der ternäre Form durch gleichwertige if-Form ersetzt. Alle anderen Felder gültig; Anchor genau einmal.','Stage 1 success; BASE/HEAD success; Mutation SURVIVED → MUTANT_SURVIVED. Nicht MUTANT_INFRA, kein equivalence pardon. Kein required equivalent-Mutant im positiven oder Produktplan.','Isolierter Test-PR gate grün/verify rot; keine Mergehandlung. Kanonische D1-Policy unverändert. Falls full live negative plan nicht akzeptiert: direkte echte Supervisor-Layerprobe, Live D8 bleibt NOT EXECUTED.','Separates Fixture/PR schließen und Referenzen erhalten; positive D1 unverändert. Kein ad-hoc Mutantenedit durch Developer.'],
 ['D9 Stale review','Eigener sauberer PR: H1 ist gültige ternäre Source; Review/Attestation vollständig an H1/W gebunden. Codex pusht nur zulässigen Source-Whitespace-Change H2; Main bleibt B. Neuer synchronize-Run prüft H2 mit unveränderter H1-Attestation.','Stage 1 review binding: REVIEW_BINDING bei stabilem H2. Bewusst Race während laufendem H1-Check ist separater Racefall PR_STALE, nicht in diesen D9-Fall mischen.','H2 darf nie durch H1-Review/Checks freigegeben sein. H1-run re-run liest live H2 und muss stale Review ablehnen oder zuvor PR_STALE bei Snapshotwechsel. Merge request sha=H1 muss H2 ablehnen.','Nach Evidence schließen/erhalten. Für Live-Recovery gleicher Runbranch nur wenn vollständige History clean, aber neues H2-Review, neuer W und vollständiger Owner-Re-run; für D1-Abnahme separate saubere Branch.']])
h('D2-Pfadfrage ist ein echtes Start-Gate')
p('Aktuelles main enthält nur src/domain/** und src/forge/**; der Drill soll keinen Mystery-Code anfassen. D2 darf deshalb keinen vorhandenen Domainpfad mutieren. Nach Bootstrap könnte ein weiterer echter ungeschützter Sourcepfad vorhanden sein. Fehlt er, D2 als exakte Scope-Schichtprobe und D7 als Live-Allowlist-Beweis durchführen; ein geforderter echter D2 gegen vorhandene andere Source bleibt BLOCKED. Kein zusätzliches nutzloses Produktfile nur für diesen Angriff anlegen.')
h('Positive Kontrollen / keine falsch zugeschriebene Ablehnung')
p('Vor jeder Gruppe zeigen dieselbe Surface, Actor-Credentials und gültigen Inputs den positiven Kontrollpfad. HTTP 401/403 ohne konkrete Rule-/Policy-Ursache, falscher Namespace, Syntaxfehler, abgelaufene Deployment-TTL oder PR Draft können den gewünschten Angriff maskieren und zählen nicht als dessen bestandener Negativfall. Werden sie beobachtet: CASE_INCONCLUSIVE, isolierte Setupkorrektur, frische Wiederholung. Ein Forge-Code ist ein fixed enum, kein erfundenes GH-HTTP-Mapping.')

section(4,'Failure Taxonomy')
p('Primär wird die verantwortliche Fehlerquelle klassifiziert; EXPECTED REJECTION beschreibt die korrekte Reaktion auf einen absichtlich ungültigen Versuch. Ein absichtlicher D4-Testskip ist kein VERIFIER BUG, wenn er wie geplant abgelehnt wird. Wird ein normaler gültiger Run abgelehnt, zunächst Input/Settings belegen, dann zuordnen. UNKNOWN ist ein Evidencezustand, keine zusätzliche Root-Cause-Kategorie.')
table(['Kategorie','Konkretes Kriterium / Beispiel','Entscheidung'],[
 ['CONTRACT BUG','Gültige Inputs nicht eindeutig definiert; Codepriorität widersprüchlich (B4); Pfad drift; Mutantanchor nicht auf Ziel anwendbar; erforderlicher Audit-Survivor in D1; literal bypass-free Ziel vs R3.','Contract/Spec vorher reparieren und unabhängig abnehmen; neue Revision/Hashes, bei Registryänderung neues B/Run/Review. Keine Codeänderung als stille Neuinterpretation.'],
 ['VERIFIER BUG','Abgenommene exakte Invariante wird im direkten Runner falsch entschieden: Scopeescape PASS, Skip akzeptiert, fehlendes Inventar, falscher Kill, stale Review PASS, forged receipt akzeptiert.','Gesamtdrill STOP; Implementation-Reparatur in eigenem später autorisierten Task; Regression gegen Counterexample; betroffene Cases und D1 erneut.'],
 ['WORKFLOW BUG','Falscher Trigger/Checkout/HEAD-Step/Token; skipped verify statt rotem failure; stale Gateoutput; echte Checks falsche Suite/head; job names doppelt.','Deployment STOP; trusted Workflow reparieren, eigenes Review, neue SHA; Native-Bindung und Re-runnegativ erneut.'],
 ['RULESET BUG','Falsche include/exclude, false enforcement, breite Bypässe, App-Pin fehlt, Owner kann R2 umgehen, Codex kann mergen, R1 löschen/force push möglich.','Settingsreadback sichern; Owner fix im separaten Auftrag; Isolationdrill und positive Kontrolle erneut; keine Rejection als Permission-Ersatz beweisen.'],
 ['GITHUB PLATFORM SURPRISE','Payloads und Actorrechte exakt passend, aber API-/Event-/Check-/Bypass-Wirkung anders; undocumented race, unavailable User bypass/native head checks.','Minimalen isolierten Reproducer und native Request IDs; NO-GO, keine spontane Ersatzarchitektur. Ein erwartbarer 403 ist noch keine Platform Surprise.'],
 ['DEVELOPER ERROR','Falscher Scope/Branch/task, unbeabsichtigtes Test-/Configedit, unlesbare Quelle, Head push nach Review, fehlender Remote-Commit.','Nach Art der History sauberer neuer Run oder zulässige Sourcekorrektur; keine nachträgliche Allowlist-Erweiterung.'],
 ['OWNER ERROR','Wrong head/attempt/JSON/state; failed-jobs statt all; unpassender supersedes; über 30 min alte Settingsprüfung; falsche Merge-Methode; falscher Branch update.','Kein Merge; Matrix §8 befolgen. Settingsfix nur bei belegt falscher Einstellung, keine Verifierlockerung.'],
 ['EXPECTED REJECTION','Genau D2–D9/Race ungültig und erwartete Schicht/Code/kein bypass greifen; fehlende Erstlaufattestation → REVIEW_MISSING.','CASE_PASS erst mit Before/After, positivem Control, korrektem Code und belegter erreichten Schicht; keine Recovery zum Mergen eines Negativfalls.']])
h('Vollständige terminale Fehlercodes als Diagnose-Routing')
table(['Codegruppe','Mögliche Ursache, danach einzeln bestätigen'],[
 ['GIT_FETCH / GIT_LAYOUT / GIT_OBJECT / GIT_LIMIT / GIT_PATH / GIT_COLLISION / GIT_HISTORY','Ungültige Objekte/History/Input → erwartete Rejection oder Developer Error. Falsche Collectorentscheidung → Verifier Bug. GitHub-Ref nicht lesbar → Platform/Availability erst nach kontrollierter Probe.'],
 ['PR_INPUT / PR_STATE / PR_STALE','Ungültiger Eventzustand, Draft/closed oder echte Änderung → Expected Rejection. Falscher Current-Snapshot → Verifier/Workflow Bug.'],
 ['IDENTITY_ACTOR / IDENTITY_NAMESPACE / IDENTITY_RECHECK','Actor/Branch/Attempt falsch → Developer/Owner Error; server fields unerwartet → Platform Surprise; fehlerhafte Bindung → Verifier/Workflow Bug.'],
 ['CONTRACT_PARSE / CONTRACT_BINDING / CONTRACT_DEPENDENCY','Dokument/Plan/Dependency falsch → Contract Bug oder Owner-Publikationsfehler. Parser gegen abgenommenes Format falsch → Verifier Bug.'],
 ['SCOPE_PATH / SCOPE_PROTECTED / SCOPE_MODE','D2–D7 oder echte unerlaubte Änderung → Expected Rejection/Developer Error. Falsche Priorität bei widersprüchlicher Spec → Contract Bug, nicht erratener Verifier Bug.'],
 ['TEST_BASELINE / TEST_COMPILE / TEST_INVENTORY / TEST_STATUS','BASE debt/trusted Fixture falsch → Bootstrap/Contract/Owner Setup; HEAD fachlich falsch → Developer Error; Report unvollständig → Execution oder Verifier. BASE-Rot darf nie HEAD-PASS ergeben.'],
 ['MUTANT_NOT_APPLIED / MUTANT_SURVIVED / MUTANT_INFRA','Anchor/Plan falsch → Contract Bug; D8 survivor → Expected Rejection; schwache Tests bei echtem non-equivalent mutant → Contract/Testqualität; Timeout/Import/Compiler → Infrastruktur, kein Kill.'],
 ['REVIEW_MISSING / REVIEW_FORMAT / REVIEW_BINDING / REVIEW_BLOCKED / REVIEW_CHANGED','Fehlende/stale/revoked Inputs → Expected Rejection oder Owner Error; freie Displaylabels/Provider-Selbstreview sind keine gültige unabhängige Herkunft; falsche Auswertung → Verifier Bug.'],
 ['EXECUTION_TIMEOUT / EXECUTION_SANDBOX / EXECUTION_IO / EXECUTION_API / EXECUTION_INTERNAL','Disponibilität/Ressourcen allein nicht als Forge Bug bezeichnen; falsch definierte Grenzwerte → Contract Bug, falsches Mount/Jobsetup → Workflow Bug, internes Counterexample → Verifier Bug; unbekannte API nur mit exaktem Reproducer → Platform Surprise.'],
 ['POLICY_INVALID / POLICY_CHANGED / POLICY_DEPLOYMENT / POLICY_CHECKS','Falsche versionierte Daten → Contract/Owner Error; echte Änderung während Run → Expected Rejection; falsch installierte Settings/Checks → Ruleset/Workflow Bug; UNKNOWN nie PASS.']])
p('Für jeden Vorfall erfassen: intended invariant → exact accepted specification → real inputs → first rejecting layer/code → native object state → classification → fixed recovery. Fehlertext allein, Screenshot ohne SHA und „PR bleibt rot“ reichen nicht zur Attribution.')

section(5,'Evidence Sheet — während Live nur ausfüllen')
p('Eine Kopie pro Case/Run. □ bedeutet ungefüllt. NOT APPLICABLE benötigt einen konkreten Grund. IDs/SHAs niemals aus Chatlabels oder vermutetem branch name rekonstruieren. Raw API-Antworten/Logs als read-only Evidence außerhalb des Developer-PR archivieren; SHA-256 jedes gespeicherten Nachweises daneben erfassen.')
p('Die leeren □-Zellen sind direkt editierbar. Eine ausgefüllte Fassung vor dem Schließen über Drucken → als PDF sichern; zum nächsten Case wieder die unveränderte Vorlage öffnen.')
table(['Feld','Erwartete Bindung / Inhalt','Live-Wert / Evidence-URI / Hash'],[
 ['Case / Surface / UTC','D1–D9, Race-ID; repo full name + immutable repoId; Start/Ende','□'],
 ['main SHA before registration','A oder separat benannter Pre-registration-Snapshot','□'],
 ['contract commit','K: vollständiger Commit + Blob-ID + Pfad + Bytes + Rawhash + Parser result','□'],
 ['contract identity','taskId/version/C; Contracttext vollständig verfügbar','□'],
 ['registration PR / merge','Owner PR-ID + G + merged_by.id; registrierter Taskindex','□'],
 ['run base','B; event SHA = live main = V; baseCommit-Ancestry; Parentgraph','□'],
 ['policy / taskplan','P/L, genaue Pfade/Blobs; deploymentDigest; accepted dependencies','□'],
 ['image / manifest','OCI I, Bootstrap-/Inputmanifesthash; versions; Sandboxnachweis','□'],
 ['handoff','Volltext, Handoffhash, Sender/Empfänger, pins und STOP-Regeln','□'],
 ['read receipt / receipt commit','Text + R; R.parent=B; R.tree=B.tree; Hashpins; Selbstbericht markiert','□'],
 ['run branch / actor','Exakter ref; Erstellung/Update unter Developer-ID; readback SHA','□'],
 ['PR','Nummer/id, author.id, same head/base repoId; base.ref main; open/draft','□'],
 ['draft head / final head','Hpre und H; source blob; modes; alle Intermediate-Changes','□'],
 ['gate run','W/a/job ID/check ID; event/workflow path/source SHA; code/result','□'],
 ['gate receipt','{runId,runAttempt,B,H,contractHash,policyHash,verifierSha}; trusted host','□'],
 ['verify run','W/a/job/check ID; frische VM + wiederholter gate; terminal conclusion','□'],
 ['native checks','Je name, app.id, head_sha, check-suite, PR-Zuordnung; nur zwei Namen','□'],
 ['BASE/HEAD checks','typecheck exits; exact inventory digests + multiset + statuses; complete','□'],
 ['mutations','ID/plan index/anchor count; original/result SHA256; exact diff; outcomes','□'],
 ['external review','Provider/model; exact reportbytes/E; B/H/C/V/P/pr/repo; result/findings','□'],
 ['owner attestation','Review ID; user.id; COMMENTED; commit_id=H; exact bodyhash; submitted_at','□'],
 ['review set','Alle Seiten; ordered IDs/states/bodyhashes; latest/supersedes; start/final digest','□'],
 ['rerun attempt','W/a; original actor; triggering_actor.id Owner; all jobs; target a match','□'],
 ['deployment readback','R1–R7 payloads/IDs; parent/classic; Actions policy; digest/checkedAt/TTL','□'],
 ['final snapshots','Zwei stabile full snapshots; UTC + monotonic window ≤10 s; B/H/P/review/attempt','□'],
 ['premerge readback','PR offen/not draft; main=B/head=H; Reviews/Checks/Policy unverändert','□'],
 ['merge request','Exact sha=H/method=merge/action=direct_merge/bypass scope; UUID','□'],
 ['merge SHA','M; merged_by.id Owner; M.parents=[B,H]; M.tree=H.tree; main readback M','□'],
 ['negative result / state','Expected/actual primary code; layer probes; Before/After refs; started jobs','□'],
 ['classification / recovery','§4 category; §8 deterministic action; Case PASS/FAIL/INCONCLUSIVE','□'],
 ['STOP / exit signoff','Grund, Zeitpunkt, letzter stabiler SHA; protection changes none; Owner result','□']])
h('Case-Ergebnisblatt')
table(['Case','Control / base / head','Expected code/layer','Actual / GitHub state / Evidence','Result / recovery'],[[x,'□','Siehe §3 oder §6','□','□'] for x in ['D1','D2','D3','D4','D5','D6','D7','D8','D9','Owner-only merge','R1 delete/force push','Re-run failed jobs','Post-PASS revoke','Wrong merge method']])

section(6,'Race Matrix')
p('Ausgeführt: lokales, eigenständiges Protokollmodell, keine Produktionsimports und kein GitHub-Live-Test. 13 benannte Assertions und 720 Permutationen von gate/check/review/main_move/head_move/final. 12 PASS am Beobachtungszeitpunkt, 480 PR_STALE, 36 REVIEW_MISSING, 180 NOT_READY, 12 IDENTITY_RECHECK. NOT_READY ist nur ein Modellzustand vor vollständigen Vorbedingungen, kein produktiver Failure-Code. Alle PASS-Zustände erfüllten im Modell B/H/Review/Receipt/Owner/technische Bindung. Dieses Ergebnis beweist nur die modellierte Logik, weder IO-Authentizität noch die künftige Implementation.')
table(['Race / Zeitpunkt','Expected behavior / Code','Live-Evidence und feste Recovery'],[
 ['main moves vor Start','B != event SHA/live main → PR_STALE. Kein stilles Base-Upgrade.','B0/B1 + original W event SHA. Neues B/new run branch/new PR; Contractrevision/Review neu binden.'],
 ['main moves während Tests','Start B0, Final B1 → PR_STALE; kein PASS.','Zwei Ref-Snapshots; Worker cleanup; neues Run/PR statt update-branch.'],
 ['head moves während Check','H0→H1 nach Pinning → PR_STALE; neuer H braucht neue Prüfung.','Live head before/final, synchronize W1, alte Checks gehören H0. Current H1 darf nicht freigegeben sein.'],
 ['review arrives before check','Stabile korrekt an H/W/target attempt gebundene Owner-COMMENT liegt vor Beobachtung: Gate/Verify können nach gültigem Owner-Re-run PASS liefern. External Review allein zählt nicht als Attestation.','Review/server fields + exact bytes bereits Start→Final unverändert; technical checks trotzdem unabhängig voll ausführen.'],
 ['check before review','Technical Erstlauf grün, finale Freigabe REVIEW_MISSING. Reviewänderung innerhalb eines schon gestarteten Attempts → REVIEW_CHANGED, sofern kein früherer Fehler gewinnt.','Nach abgeschlossenem Erstlauf extern reviewen, Ownerreview für nächsten Attempt, all jobs. Kein spontanes Grün durch Reviewevent: Trigger enthält kein pull_request_review.'],
 ['rerun after main move','Re-run behält original event GITHUB_SHA=B0; aktuelles B1 → PR_STALE.','Owner all-jobs ist kein Baserebase. Neues W/Run/PR und passende Contract-/Policy-/Reviewbindungen.'],
 ['developer pushes during review','Push selbst von R4 erlaubt. Abschlussreview für H0 ist stale gegenüber H1. Neuer stabiler Lauf → REVIEW_BINDING; laufender gepinnter H0-Lauf → PR_STALE.','Kein R4-„review freeze“ vorhanden. Head freeze ist Operation; sha=H0 Mergeversuch bei H1 muss ablehnen. Neues Review für H1 und vollständiger W1 owner re-run.'],
 ['PR closed','Live GET closed → PR_STATE. Nach bereits beendetem PASS wird alter Check nicht zwingend automatisch rot; native merge muss closed ablehnen.','Kein closed-Trigger vorausgesetzt. Reopen nur gleicher sauberer Run/Head/Base; reopened erzeugt neues W, neue Attempt-Attestation.'],
 ['branch inaccessible','Aktuelle PR-Daten unlesbar → EXECUTION_API; Gitfetch/ref unavailable → GIT_FETCH; nachweislich abweichender beobachteter Ref → PR_STALE. Kein Cachefallback.','API status/request ID oder Fetchresult trennen; 404 nicht in „leere Reviews“ umdeuten. Ein identischer zulässiger Transportretry, dann FAIL. Ref erhalten.'],
 ['review edit/revoke während Lauf','Start/Final-Reviewliste unterschiedlich → REVIEW_CHANGED oder höher priorisierter aktueller Blocker REVIEW_BLOCKED.','Exact bodyhashes/latest/supersedes; kein alter Approve-Fallback. Neuer gebundener review + nächster Ownerattempt.'],
 ['review revoke nach PASS, vor Merge','Kein garantierter neuer Trigger: bereits grüne Checks können grün bleiben. Owner-Mergecheck muss Widerruf erkennen und STOP sagen.','Bewusstes Modellcounterexample bestätigt die Grenze. R2 allein kann den Forge-Reviewwiderruf hier nicht beweisen. Kein atomarer Review-to-merge Schutz.'],
 ['main moves nach PASS, vor Merge','Owner Readback STOP; strict R2 up-to-date muss merge blockieren, sofern live zertifiziert.','Isolierte Same-head/New-main-Negativprobe zwingend. Erwartetes-head sha allein schützt nicht die Base.'],
 ['failed-jobs statt all','Neuer Attempt mit altem Gate-Receipt → IDENTITY_RECHECK (oder belegter earlier workflow mismatch POLICY_CHECKS); kein PASS.','Jobs des konkreten Attempts vollständig lesen. Neues target attempt, neue Owner-Attestation, all jobs.']])
h('Grenze des minimalen Designs')
p('Zwei stabile API-Snapshots sind kein atomarer Snapshot über refs/reviews/settings/checks/merge. Ein böswilliger oder irrender Owner kann nach einem grünen Run Reviews ändern und danach trotz alter grüner Checks mergen. Der Drill darf daher review binding im Run plus verpflichtende unmittelbare Ownerkontrolle beweisen; er darf keine technische Unmöglichkeit jedes späteren Owner-Fehlers behaupten. Wenn Produktfreigabe diese atomare Garantie verlangt: NO-GO, ohne Architekturänderung in diesem Auftrag. [S1–S4]')

section(7,'Owner Error Matrix')
table(['Owner mistake','Welche Schicht stoppt was?','Was wird NICHT garantiert? / Recovery'],[
 ['wrong merge method','Im vorgeschlagenen R2 KEINE Methodensperre: alle drei erlaubt. Runbook fordert merge mit explizitem expected head.','Squash/rebase kann serverseitig erlaubt sein. Operationale STOP-Prüfung, bei tatsächlich falschem Merge gesamter D1 FAIL; nicht force-resetten. Neue abgenommene Baseline/Drill; künftige Methodeneinschränkung wäre eigenes Settingsdesign.'],
 ['merge stale head','Explicit merge sha + current head check; R2 aktuelle native Checks. R3 Ownerrechte alleine reichen nicht.','Ohne sha wird aktuelle Head verwendet; UI-Klick ist kein protokolliertes SHA-Compare. Neues H-Review/W/all-jobs; stale sha-Rejection im isolierten Repo nachweisen.'],
 ['dismiss review','Beim nächsten Verifierlauf neuester Ownerreview DISMISSED → REVIEW_BLOCKED. Änderung im Lauf → REVIEW_CHANGED/Blocker.','Nach PASS keine garantierte automatische Checkinvalidierung; R2 hat approvals=0. Owner premerge muss stoppen. Neue gebundene COMMENT-Attestation mit explizitem supersedes, neuer Attempt.'],
 ['edit contract in Developer branch','R4 sperrt keine Dateien, aber trusted Stage 1 scope/protected stoppt Merge via rotem R2.','Push kann persistieren. Aktiver Contract niemals über eigenen Run verändern; edit/revert in History bleibt schlecht. Neuer Run; autorisierte neue Contractrevision separat publizieren.'],
 ['edit contract on trusted main','Direktpush durch R2/R3 sperren; legitimate Owner-OPS nur fremden vorab genehmigten Contract/Plan ändern. Mainmove invalidiert alte Runs.','Owner kann genehmigte neue Revision publizieren; Intentprüfung gehört externem Review. Geändertes B/P/C braucht neue Bindung, kein old-run-Recheck.'],
 ['update Codex branch','R4 restrict update mit nur Developer-bypass; Owner push/Create/update soll abgelehnt sein; R1 blockt force unabhängig. update_allows_fetch_and_merge=false.','GitHubs update-branch-API muss live ebenso abgelehnt werden. Sollte eine fremde Mergeaktualisierung dennoch landen: Stage 1 GIT_HISTORY oder zuvor PR_STALE; gesamter Rulesetfall FAIL.'],
 ['accidental direct push main','R2 PR requirement ohne Bypass plus R3 Owner nur PR-bypass; R6 andere Namespaces.','Nicht schädlich auf kanonischem main testen. Isolierte Stellvertreter + main rules readback. Breiter Admin-/Integrationbypass wäre Ruleset Bug.'],
 ['delete branch','R1 deletion, bypass=[] über alle Branches; R7 Tags ebenfalls. Automatisches delete_branch_on_merge=false.','R4/R5 writer exceptions umgehen R1 nicht. 403 wegen Token allein beweist R1 nicht. Ref unverändert, konkreten Rulegrund sichern; Branches erhalten.'],
 ['owner pushes to another namespace','R4 Codexnamespace nur Codex; R5 Ownernamespace nur Owner; R6 alle anderen creation/update gesperrt.','R5 erlaubt bloße Contractnamespace-Writes, aber Package-Verifier kennt nur DEV/OWNER_OPS PRprofile: Registration-Debt/Deadlock prüfen. Falscher Namespace durch IDENTITY_NAMESPACE abweisen.'],
 ['Owner native APPROVED / Issue comment','Verifier erwartet submitted PR Review COMMENTED, commit_id=H. Neuester APPROVED → REVIEW_BLOCKED; kein authoritative Ownerreview → REVIEW_MISSING.','GitHub „approved“ allein ersetzt Forge nicht. Korrektes neues Review mit latest/supersedes; nächste Attemptfreigabe.'],
 ['Owner re-runs wrong run/failed jobs','W/a-Receipt, numeric triggering_actor, event SHA, workflow path und Jobliste prüfen.','Write-Rechte erlauben allgemein auch Developer-Re-runs. IDENTITY_RECHECK muss deren Freigabe verhindern. Nie actor-Login statt numeric server ID.']])
p('R1/R2 schützen ohne Bypass. R3 enthält ausschließlich die geplante Owner-PR-Autorisierung. R4/R5 sind Schreibberechtigungsregeln, keine Pfadschutzregeln. R6 sperrt Fremdrefs; R7 Tags. Keine dieser Regeln authentifiziert das externe AI-Review. Definition und Wirkung müssen durch Payloadreadback UND isolierte Kontrollversuche zusammen belegt sein. [S5]')

section(8,'Recovery Matrix')
p('Der Negativfall bleibt als Negativfall archiviert. „Retry same run“ meint nur zulässige Infrastructure-Wiederholung mit identischen B/H/C/P/I; es meint nie einen Angriff nachträglich zum positiven D1 umzudeklarieren. Jede neue W-ID oder verbrauchte Attemptnummer braucht neue Owner-Attestation für den konkreten Zielattempt.')
table(['Failure','Retry same run?','New run / branch / PR?','New contract / review?','Owner setting fix?'],[
 ['D1 missing initial attestation','Ja: nach technical evidence und externem Review all jobs.','Nein, wenn B/H/P unverändert.','Externes Review + Owner-Attestation für W/a+1.','Nein.'],
 ['D2 out-of-scope','Nein, erneuter Lauf bleibt korrekt rot.','Ja, saubere Branch von B; alte History nicht durch revert „reinigen“.','D1-Contract unverändert; Review für neuen W/H.','Nein.'],
 ['D3 deletion','Nein.','Ja, saubere Branch/PR; kein force push.','Keine Scopeerweiterung; neuer Review.','Nein.'],
 ['D4 skip','Nein.','Ja, saubere Branch/PR.','Keine Teständerung genehmigen; neuer Review.','Nein.'],
 ['D5 config','Nein.','Ja, saubere Branch/PR.','Kein neuer D1-Contract für Config; neuer Review.','Nur wenn globaler policy block nicht funktioniert; dann STOP des gesamten Drills.'],
 ['D6 workflow','Nein.','Ja; nach untrusted Jobstart zuerst Freeze/Incidentreview des Settingspfads.','Kein Developer-Workflowallow; später neuer unabhängiger Review.','Ja nur bei belegt falscher Execution-Policy, im separaten Ownerauftrag, danach Policy-Negative erneut.'],
 ['D7 extra file','Nein.','Ja, saubere Branch/PR.','D1 bleibt exact scope; neuer Review.','Nein.'],
 ['D8 survivor','Nein, erwartete terminale Rejection bleibt reproduzierbar.','Für positives D1 eigener Run/PR mit unverändertem positiven Plan.','Nur negative Fixture bleibt getrennt; niemals audit equivalent in Produktplan.','Nein.'],
 ['D9 head change','Nicht alten H1-Reviewattempt grün machen.','W neu für stabilen H2; dieselbe Branch möglich bei vollständig sauberer History/B, D1-Abnahme trotzdem separate clean branch.','Neues externes Review für H2; neue W/attempt-attestation; C nur bei verändertem Scope/Contract.','Nein.'],
 ['main moved / policy changed','Nein; alter event SHA bleibt B0.','Neue Branch/new run ID/new PR aus B1; keine merge update, kein rebase/force.','Runbook verlangt neue Contractrevision auf B1 prüfen/publizieren, P/L/C neu pinnen; Review komplett neu.','Nur wenn Schutzpayload tatsächlich falsch war.'],
 ['Malformed/stale/dismissed/revoked review','Ja, wenn B/H/P noch exakt; neuen all-jobs Attempt.','Nein, außer W/base/head unbrauchbar.','Neue Owner-COMMENT mit current bodyhash/state supersedes; external report bei geändertem H/C/P neu.','Nein.'],
 ['Failed-jobs / wrong rerun actor','Ja: nur neues zielattestiertes all-jobs.','Nein bei gleichem B/H; verbrauchtes a nicht wiederverwenden.','Neue Owner-Attestation für nächsten Attempt.','Nein, sofern Rechte/Policy korrekt.'],
 ['API transport / rate limit / timeout','Ja nach belegter Availability und vollständiger frischer Prüfung, nie cached-success. Maximal ein erlaubter interner identischer Retry.','Nur bei veränderten Bindungen.','Neuer targetattempt; review ggf neu; deployment checkedAt frisch.','Keine Credentialerweiterung oder Limitsenkung.'],
 ['Branch inaccessible','Erst Zustand lesen, nicht löschen/recreate/force.','Wenn Ref tatsächlich verloren/geschlossen unbrauchbar: neue Branch/PR nach Ownerentscheidung; STOP-Incident behalten.','Review/W/attempt neu; contract nur bei neuem B.','R1-Recoverydiagnose, falls unerlaubte Löschung belegt.'],
 ['Verifier/Workflow defect','Nein, nicht wiederholt grünes Glück suchen.','Nach eigener Repair-Abnahme und neuem B vollständige neue Runs.','Repair-Contract + unabhängiges Review; D1–D9 affected + Kernbindung neu.','Nur wenn separate belegt falsche Settings; kein Checkpflicht-Bypass.'],
 ['Ruleset defect/native binding surprise','Kein fachlicher Retry bis Configdrill PASS.','Frische isolierte Controls; danach kanonischer neuer B/run wenn Änderung versioniert ist.','Neue deployment attestation; Codecontract nur bei Implementationchange.','Exakte Feldkorrektur oder NO-GO; niemals Any-source/broad bypass/privileged publisher.'],
 ['Wrong merge already happened','Nein; kein Reset/force/delete.','Drill FAIL; neue überprüfte Baseline; erneuter D1-Drill.','Neues Owner-Abnahmeprotokoll; Source-/Produktkorrektur nur eigener autorisierter Contract.','Keine spontane Methodensperre ohne Settingsauftrag.']])
h('Recovery-/STOP-Limits')
p('Generelles STOP: unerwarteter ALLOW, untrusted Jobstart, Mutant/Inventar/Binder falsch grün, nicht belegte Native-Head-Checks, protection relaxation, Broad bypass, Mainabweichung, fremder Writer, unvollständige Evidence. Aktuelle Sitzung endet ohne GitHubaktionen. Im später autorisierten Liveauftrag zuerst weitere Versuche/Merges stoppen und minimalen Before/After-Nachweis sichern; nur bereits separat autorisierte Incidentmaßnahmen aus dem Ruleset-Runbook verwenden. Kein automatisch neu eingeschalteter Run, kein cleanup durch Delete/Force. Checks/Policies bleiben wirksam.')

section(9,'FORGE DRILL PASS — strikter Exit')
p('PR merged reicht nicht. Alle folgenden Evidenceklassen sind conjunctive; FAIL/UNKNOWN/INCONCLUSIVE/NOT EXECUTED in einer Pflichtklasse bedeutet NO PASS. Das heutige Ergebnis ist STOP, nicht ein konditional erteiltes Zertifikat.')
table(['Pflicht','Benötigter Beweis'],[
 ['Gültiger D1-Endzustand','Exakt eine Source-MODIFY, alle Intermediate-Commits zulässig, keine Mysterydatei; BASE/HEAD vollständige unabhängige Checks; real applied normal mutant KILLED; SHA-gebundene technische Reports.'],
 ['Developer could not bypass scope','D2/D7 live bzw. vorab festgelegte tatsächliche Surface; alle D3–D6 Full-funnel-Negative, Freeze-/Inventar-Layerproben; keine Filescope-Erweiterung/Coordination-Ausnahme. D2 nicht still durch Mysteryedit ersetzen.'],
 ['Independent checks','Stage1 kein HEAD-Code; Stage2 frischer kompletter Bootstrap; trusted BASE runner/config/lock; ignore-scripts install; keine Worker-Schreibrechte auf Tests/Tools/Actionscmdfiles; provenance + sandbox acceptance.'],
 ['Exact head binding','H ist identisch in Git/PR/Report/Attestation/Receipt/current Native-Checks/merge sha. Headmove-Negative wirklich unmergefähig; event base B getrennt von check head H belegen.'],
 ['Review binding','Anthropic report E exakt an B/H/C/P/V; server Owner-ID/COMMENTED/commit_id H/attempt; latest review und supersedes; malformed/stale/revoked/edited probes korrekt. Providerherkunft ausdrücklich owner_attested.'],
 ['Owner-only merge','Gleicher grüner Kontroll-PR: Developer-Merge denied aus R3, Owner authorisierter Merge allowed; Actions-App nicht merger; native IDs und Rulegrund. Schädliche actor tests auf isolierter Surface.'],
 ['Negative cases rejected','D2–D9 mit exakt vorher akzeptierten Codes und Schichten; keine random Fehler/Pending. D8 SURVIVED sauber, kein Infra; D9 stabile falsche H-Bindung klar von Race getrennt.'],
 ['No protection bypass required','Kein Aussetzen/Abschwächen von R1/R2/R7/Execution-Policy, kein Admin-always-BYPASS, keine manual green checks, keine temporäre Scopeerweiterung. Der geplante R3-PR-Bypass muss transparent als Teil der Owner-Autorisierung protokolliert sein; literal Null-Bypass-PASS ist damit NICHT bewiesen.'],
 ['Merge/postmerge','Owner numeric merger; expected-head direct merge final merged; M.parents=[B,H], M.tree=H.tree, main=M; immutable branches behalten; all protected blobs und Tests identisch.'],
 ['Honest limits','Keine atomare Review-/Settings-/merge-Garantie und keine absolute Semantik-/böswilliger Worker-Garantie behauptet; dokumentierte Owner-TCB und after-PASS-Prüfung akzeptiert.']])
p('Exitlabels: FORGE DRILL PASS darf nur nach vollständig belegten Pflichten und explizit vor Start geklärter B3-Auslegung gesetzt werden. Verlangt die Abnahme wortwörtlich keine Nutzung irgendeines GitHub-Bypasses, ist der Exit unter den sieben vorgeschlagenen Rulesets dauerhaft STOP-BYPASS-LITERAL. Ein Bericht darf dies nicht sprachlich zu PASS umetikettieren. Dieser Auftrag wählt kein anderes Modell und ändert keine Regeln.')

section(10,'Product-Run Gate — vor MYST-0001')
p('MYST-0001 startet erst nach dem Drill-Abnahmepunkt, nicht allein nach Bootstrap C oder einem grünen Clamp-PR. Es ist ein neuer Produkt-Run mit eigener Registrierungs-/Reviewbindung; kein Wiederverwenden des Drill-Reviewhashs.')
table(['Gate','Erforderliche Evidence / STOP bei Fehlen'],[
 ['P1 Bootstrap accepted','A/B/C independently accepted; exakte dependency acceptedCommit statt null; real Image-Digest, manifest inputs, trusted parser/importgraph, sandbox/resource/network/cleanup proofs.'],
 ['P2 Plattform accepted','R1–R7 active/readback und relevante Parent/classic rules; Actions only PR-target/global actor/path policy; Owner/Codex rights; native exact-head checks und App-Pins; positive/negative controls samt same-head/new-main, failed-jobs, writer/merger isolation.'],
 ['P3 Drill exit','Unterzeichnetes vollständiges D1–D9/Race/Owner-Evidence Sheet; §9 PASS mit B3-Auflösung; keine unresolved CONTRACT/VERIFIER/WORKFLOW/RULESET/Platform findings. NOT EXECUTED Pflichtfall blockiert.'],
 ['P4 Product contract frozen','Aktueller vollständiger MYST-0001-Contract unabhängig freigegeben, Format-1-Parser OK; fachliche PlayerRef-Anforderungen und Hash-/Ref-Semantik eindeutig; keine Rekonstruktion fehlender Artefakte. Exakte create/modify-Scope, Reads, Checks, Mutanten, Limits, Dependencies.'],
 ['P5 Registry published','Owner publiziert akzeptierten MYST-Contract/Plan und Taskindex auf trusted main über zulässigen vorregistrierten OWNER_OPS-Pfad; Product-Run base ist danach aktuelles main. Registrydeadlock vor Start gelöst, keine spontane Required-Checks-Deaktivierung.'],
 ['P6 Fresh base baseline','Post-D1/Registration Bproduct und vollständiges grün inventarisiertes BASE; Mutanten auf geplanter tatsächlicher Source anwendbar; keine skipped/todo/empty/collection errors und keine Zahl-only-Proofs.'],
 ['P7 Non-bootstrap operation','Aktive Policy erlaubt Owner-Publikation neuer Contracts/Pläne ohne selbst zu ändern, was gerade geprüft wird. Leerer taskIndex/kein Registryplan bedeutet STOP; Contractnamespace alleine ist kein autorisiertes Verifierprofil.'],
 ['P8 Binding/handoff','repoId/taskId/current contract revision Cproduct, Pproduct/Lproduct, Bproduct/Vproduct/I; eigener Developer run/branch/PR, receipt convention; exact provider-independent external review später für Hproduct.'],
 ['P9 Deployment freshness','Administrative Readback plus deploymentDigest passt zur versionierten Policy; checkedAt beim final PASS ≤30 min und nicht in Zukunft. Jeder Settings-/Image-/Workflowchange nach Drill triggert betroffene Re-Abnahme.'],
 ['P10 Risks understood','Dokumentierte Owner-TCB, Providerattestierung und post-PASS-TOCTOU-Grenze; Produktfreigabe verlangt keine stärkere unbewiesene Garantie. Ungeklärte B1–B7 + D2 surface gap blockieren den ersten Produktstart.']])
p('Heutiger Product-Run-Status: BLOCKED. Der Bericht stellt keinen MYST-0001-Contracttext fest und zertifiziert keine unseen Produktrevision. Die erwarteten spezifischen Produktbytes werden beim nächsten echten Registryread überprüft, nicht aus Gesprächserinnerung übernommen.')

section(11,'Exact Live Checklist')
h('11.1 Preflight — heute STOP')
checks([
 'Separater Liveauftrag liegt vor; Surface/Actoraktionen eindeutig festgelegt. Dieser read-only Auftrag ist keine Mutationserlaubnis.',
 'A/B/C echte Implementierungen akzeptiert, SHA-/Image-/Sandboxbeweise verfügbar; kanonisches main erneut gelesen.',
 'B1 Draft-Gate als rote Safetyprobe festgelegt; B2 merge operational; B3 geplante R3-Autorisierung vs literal no-bypass vor Start geklärt.',
 'B4 Primary-Failure-Code-Priorität unabhängig eingefroren; kein AV-Katalog-Raten während Live.',
 'B5 leeres Receipt-Commit und B6 Hpre-Konvention gegen reale Historyprüfung geprüft; keine Extra-Receiptdatei.',
 'D2 echter ungeschützter Nicht-Mystery-Sourcepfad vorhanden oder Layer-only-Status im Abnahmeumfang explizit akzeptiert; kein stiller Ersatz.',
 'R1–R7, Execution-Policy, inherited/classic rules administrativ exportiert; positive controls und isoliertes Livepaket bestanden.',
 'Check app.id/head_sha/Suite/PR association belegt, Re-run-all vs failed-jobs und triggering_actor ID belegt; keine Any-source fallback.',
 'Quelle grün als if-Form + drei frozen Tests vorhanden; Sourcepfad außerhalb src/forge/**; alle Registry-/Owner-OPS-Publikationspläne vorbereitet.',
 'Positive D1 und separate D8 negative surface/plan eingefroren; keine Audit-equivalent mutation im Produktplan.',
 'Registration bereits abgeschlossen, K/G/C/L/P aufgenommen; gemeinsame B freeze, keine parallelen main updates; auto merge und branch deletion aus.',
 'Evidence Sheet pro Case angelegt; native payload/log Zugriff funktioniert; Capture- und Incidentmaßnahmen aus separatem Liveauftrag verfügbar.'
])
h('11.2 D2–D9 vor dem einzigen D1-Merge')
checks([
 'Jede negative Branch frisch aus B, registrierter Task/Namespace und sauberer H; D2–D7 jeweils genau eine zusätzliche Operation.',
 'D2 primary SCOPE_PATH sichern, keine Mysteryänderung; sonst STOP/D2 NOT EXECUTED.',
 'D3 DELETE-Sperre im Full Funnel und fehlende Identitäten in separater Inventar-Layerprobe belegen.',
 'D4 frozen-test Rejection + separate TEST_STATUS skip-Probe, keine Exit-0-Abnahme.',
 'D5 Config nicht geladen; D6 evil niemals started; positive Sentinelcontrol + konkrete Policy-Blockevidence sichern.',
 'D7 notes.txt rejected; keine Coordination-/Prefix-Ausnahme.',
 'D8 normal prerequisites grün, equivalent audit mutant real applied und SURVIVED, MUTANT_SURVIVED; kein Infra-Rejection-Ersatz.',
 'D9 stabile H1-review/H2-head Probe REVIEW_BINDING; separate during-run Race PR_STALE; alte Checks/merge sha H1 geben H2 nicht frei.',
 'Alle PRs nach Capture schließen; Refs behalten; keine delete/force/rebase/ref-wildcards und keine Settingslockerung.'
])
h('11.3 D1 erfolgreicher Pfad')
checks([
 'Current main erneut B, Contract/Plan/Policy exact; Codex liest Handoff und bestätigt sämtliche Pins.',
 'Runbranch anlegen, leeres R mit Tree=B.tree, dann nur Hpre-Source-Vorbereitung; Draft-PR öffnen.',
 'Draft forge-gate PR_STATE und verify explizit rot; kein HEAD-Worker oder grüner skipped Job.',
 'Exakte ternäre Source H pushen; keine Zusatzdatei; ready_for_review; damit neuen W wählen.',
 'W/Attempt 1: Gate success, technische Tests/Inventare/normaler Mutant bestanden; fehlende Attestation ergibt REVIEW_MISSING.',
 'Developer head freeze erklären; alle weiteren Pushes stoppen; externen Anthropicbericht mit exakten B/H/C/V/P/pr/repo Inputs erstellen lassen.',
 'Owner prüft Bericht/technische Evidence/Settings; erstellt exakte COMMENT-Attestation commit_id H für W/nächsten Attempt.',
 'Owner Re-run all jobs; dieselbe W und neue a; triggering_actor.id Owner; Gate/Verify frische Jobs und identisches current-attempt Receipt.',
 'Gate und Verify wirklich success; Runtime/Inventory/Mutants/cleanup complete; zwei stabile vollständige Final-Snapshots.',
 'Kein neuer Head/Main/Review/Settingchange. Owner unmittelbar vollständiges premerge readback und Deployment-TTL prüfen.'
])
h('11.4 Merge und Exit')
checks([
 'Owner-only / wrong-actor / direct-push / delete / force push / wrong-method Grenzen bereits isoliert belegt, kein destruktiver Liveversuch auf canonical main.',
 'Request ausdrücklich sha=H, merge_method=merge, merge_action=direct_merge; nur vorgesehene R3-Autorisierung, R1/R2 unverändert bypassfrei.',
 'Terminal async status merged und PR.merged=true abwarten; 202/pending/enqueued ist kein Mergebeweis.',
 'M.parents=[B,H], M.tree=H.tree, main=M; merged_by numeric Owner; alle protected/Testblobs unchanged; Branchrefs vorhanden.',
 'Vollständige D1–D9 und Pflicht-Race/Ownerproben in Evidence Sheet abgenommen; jeder FAIL/UNKNOWN/NOT EXECUTED blockiert PASS.',
 'PASS nur in exakt vorher geklärtem Schutzumfang erklären; sonst STOP mit erster unerfüllter Pflicht.',
 'MYST-0001 erst nach allen P1–P10 starten; eigener Contract/Plan/Run/Review, kein weiterer Auftrag automatisch.'
])
h('STOP-Satz — vorab festgelegt')
pre('STOP FORGE DRILL — case=<ID>, invariant=<fixed name>, expected=<layer/code>,\nactual=<observed layer/code>, repoId=<id>, main=<B>, head=<H>,\nrun=<W>/<attempt>, evidence=<URI/hash>.\nNo further pushes, re-runs, merges, settings relaxation or cleanup.\nApply only the pre-authorized recovery row; otherwise remain stopped.')
p('Zeitbudget: Spec-Limits gelten unverändert (Job ≤20 min; Install 180 s; Typecheck 60 s; BASE/HEAD Suite 120 s; Mutant 30 s; Final ≤10 s). Native Jobs, die nach Queue-Start kein terminales Ergebnis liefern, sind nach Ablauf des spezifizierten Joblimits INCONCLUSIVE/timeout, niemals PASS. Deployment-TTL 30 min: queued Attempt, der das Zeitfenster verpasst, wird neu attestiert und vollständig neu gestartet. Keine Grenzwertlockerung während Live.')

h('Reproduzierbare Modell-Evidence / Quellen')
model=json.loads(Path('race-model-results.json').read_text())
table(['Modellcase','Expected = observed'],[[x['name'],x['actual']] for x in model['named_cases']])
for f in ['race_model.py','race-model-results.json']:
 b=Path(f).read_bytes(); p(f+' · '+str(len(b))+' bytes · SHA256 '+hashlib.sha256(b).hexdigest())
p('Der Python-Modelltext und vollständige JSON-Resultatbytes sind unten eingebettet, damit dieser Bericht ohne weitere Datei reproduzierbar bleibt. Modellassertions sind kein Verifier-Integrationstest. Die 720 Permutationen nutzen unveränderliche Zustandslabels B0/H0; Snapshot-/Transport-/Rulesetfehler werden nicht simuliert. Das after-PASS-Counterexample zeigt genau die fehlende automatische Revocation. Kein optimistischer Live-PASS wurde daraus abgeleitet.')
out.append('<details><summary>race_model.py — vollständiger Modelltext</summary>'); pre(Path('race_model.py').read_text()); out.append('</details>')
out.append('<details><summary>race-model-results.json — vollständige Resultate</summary>'); pre(Path('race-model-results.json').read_text()); out.append('</details>')
sources=[
 ('S1','Events that trigger workflows / pull_request_target','https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows'),
 ('S2','Re-running workflows and jobs','https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs'),
 ('S3','REST pulls: merge-async, sha, bypass_rules and terminal result','https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request-asynchronously'),
 ('S4','About protected branches: skipped/neutral, strict checks, app source','https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches'),
 ('S5','Rulesets / rule layering / available rules','https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets'),
 ('S6','Available rules for rulesets','https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets')]
out.append('<ul>'+''.join('<li>'+escape(a+' · '+b)+' · <a href="'+escape(u)+'">GitHub Docs</a></li>' for a,b,u in sources)+'</ul>')
p('GitHub-Dokumentation am 4. Oktober 2026 erneut abgerufen. Belegt dokumentierte Plattformsemantik; native GitHub-Wirkung der geplanten Konfiguration bleibt LIVE NOT EXECUTED. Repository-Readbacks: GET repo; branches/main; rulesets; recursive git tree an '+tree+'; pinned file reads; collaborator permissions. Ein Connector-Endpointfehler wurde als Toolgrenze, nicht als GitHub-Eigenschaft gewertet.')
p('Abschlussprüfung: main erneut gelesen und unverändert auf '+main+'; protected weiterhin false. Alle elf geforderten Abschnitte, 16 Tabellen, vollständiges Modell/Resultate und HTML-Struktur lokal geprüft. Visuelle Browserprüfung war in diesem Runtime mangels Browserbinary nicht ausführbar; keine Behauptung eines gerenderten Screenshots oder GitHub-Livetests.')
p('FINAL STATUS: FORGE FIRST DRILL PRE-MORTEM COMPLETE · LIVE NO-GO · NO GITHUB CHANGES · STOP.','status')

css='''*{box-sizing:border-box}body{margin:0;background:#f4f2ed;color:#182536;font:16px/1.6 system-ui,sans-serif}main{max-width:1420px;margin:auto;padding:48px 38px}h1{font-size:42px;line-height:1.15;color:#10283d;margin-bottom:14px}h2{margin-top:52px;padding-top:25px;border-top:3px solid #bd9856;font-size:28px;line-height:1.3}h3{margin-top:30px;font-size:21px}p{max-width:1100px}a{color:#155a93}.status{background:#112c43;color:white;padding:18px 22px;border-left:7px solid #bd9856;font-weight:700;max-width:none}.tablewrap{overflow-x:auto;margin:22px 0;background:white;border:1px solid #d6dbdf;border-radius:8px}table{border-collapse:collapse;width:100%;font-size:14px;line-height:1.5}th{background:#173148;color:white;text-align:left;padding:13px 14px}td{vertical-align:top;padding:13px 14px;border-top:1px solid #dce2e6;overflow-wrap:anywhere}tr:nth-child(even){background:#f8fafb}td:first-child{font-weight:650;min-width:130px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#112638;color:#edf3f7;padding:22px;border-radius:8px;line-height:1.5;font-size:13px}.checks{list-style:none;padding:0}.checks li{padding:10px 14px;margin:8px 0;background:#fff;border-left:3px solid #c1a064;max-width:1150px}details{margin:18px 0}summary{cursor:pointer;font-weight:650;padding:12px;background:#e2e8ed}@media(max-width:700px){main{padding:25px 18px}h1{font-size:31px}h2{font-size:24px}table{min-width:850px}}@media print{body{background:white}main{padding:10px;max-width:none}h1{font-size:29px}h2{break-before:page}table{font-size:9px}th{color:black;background:#e6eaed}td,th{padding:6px}.tablewrap{overflow:visible;border:none}tr{break-inside:avoid}details{display:none}.checks li{padding:3px;margin:4px 0}pre{color:black;background:#f1f3f4}.status{color:black;background:#e9edf1}a{color:black}}'''
html='<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FORGE FIRST DRILL PRE-MORTEM</title><style>'+css+'</style></head><body><main>'+''.join(out)+'</main></body></html>'
html=html.replace('<td>□</td>','<td contenteditable="true" aria-label="Live-Evidence ausfüllen">□</td>')
Path('FORGE-FIRST-DRILL-PRE-MORTEM.html').write_text(html,encoding='utf-8')
print(json.dumps({'artifact':'FORGE-FIRST-DRILL-PRE-MORTEM.html','bytes':len(html.encode()),'sections':11,'model_cases':len(model['named_cases']),'status':'NO_GO_NOT_EXECUTED'}))
