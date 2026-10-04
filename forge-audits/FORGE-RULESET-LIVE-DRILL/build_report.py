#!/usr/bin/env python3
"""Rebuild the static owner report, API templates, and command inventory offline."""
import html, json
from pathlib import Path
import drill

ROOT=Path(__file__).resolve().parent
OUT=ROOT.parent/'FORGE-RULESET-LIVE-DRILL.html'
M=drill.make_manifest('Forge-Dice/forge-ruleset-drill-20261004-a','drill-20261004-a')

def esc(s):return html.escape(str(s))
def code(s):return '<code>'+esc(s)+'</code>'
def pre(s):return '<pre><code>'+esc(s)+'</code></pre>'
def p(s):return '<p>'+s+'</p>'
def ul(items):return '<ul>'+''.join('<li>'+s+'</li>' for s in items)+'</ul>'
def table(headers,rows):
    return '<div class="scroll"><table><thead><tr>'+''.join('<th>'+esc(h)+'</th>' for h in headers)+\
      '</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+str(c)+'</td>' for c in row)+'</tr>' for row in rows)+'</tbody></table></div>'
def section(n,title,body):return '<section id="s'+str(n)+'"><h2>'+str(n)+'. '+esc(title)+'</h2>'+body+'</section>'
def cite(*ids):return '<span class="cite">'+', '.join('<a href="#'+x+'">'+x+'</a>' for x in ids)+'</span>'

sources=[
 ('S1','Repository rules REST schema','https://docs.github.com/en/rest/repos/rules'),
 ('S2','Creating repository rulesets / UI / fnmatch','https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository'),
 ('S3','Available rules','https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets'),
 ('S4','About rulesets / layering','https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets'),
 ('S5','Actions policy REST schema','https://docs.github.com/en/rest/actions/policies'),
 ('S6','Workflow execution protections / UI / insights','https://docs.github.com/en/actions/how-tos/administer/control-workflow-execution'),
 ('S7','Actions policies concepts','https://docs.github.com/en/actions/concepts/about-actions-policies'),
 ('S8','Securely using pull_request_target / November policy','https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target'),
 ('S9','Re-running all jobs','https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs'),
 ('S10','Contexts / actor / triggering_actor / workflow_sha','https://docs.github.com/en/actions/reference/workflows-and-actions/contexts'),
 ('S11','Workflow dispatch API','https://docs.github.com/en/rest/actions/workflows'),
 ('S12','Workflow run/attempt/job collection and force-cancel','https://docs.github.com/en/rest/actions/workflow-runs'),
 ('S13','Git reference API','https://docs.github.com/en/rest/git/refs'),
 ('S14','Required status checks / eligible events / skipped','https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks'),
 ('S15','Actions general permissions REST API','https://docs.github.com/en/rest/actions/permissions'),
 ('S16','Pull requests / asynchronous merge / bypass_rules','https://docs.github.com/en/rest/pulls/pulls')]

parts=[]
parts.append(section(1,'Preconditions',
 p('<strong>Ausführbares Testpaket, Live-Status NOT EXECUTED.</strong> Basis: '+code('FORGE-V0.1-BOOTSTRAP-EXPERIMENTAL-REPORT.html')+
   '. Dokumentation am 4. Oktober 2026 erneut gelesen. Die hier ausgeführten Prüfungen sind offline; sie beweisen keinen GitHub-Enforcement-Zustand.')+
 p('Kanonisches Repository '+code('Forge-Dice/Forge')+' bleibt read-only. Aktuell durch reine Leseabfragen bestätigt: Repository-ID '+code('1401864629')+
   ', public, Default-Branch '+code('main')+'; '+code('Wuerfelduell')+' admin und '+code('forge-codex')+' write. Rulesets, Actions-Policies und Branchschutz des kanonischen Repositorys werden hier weder aktiviert noch als live bestanden ausgegeben.')+
 ul([
  'Frisches öffentliches Repo '+code('Forge-Dice/forge-ruleset-drill-20261004-a')+'; zweites frisches Root-Fenster '+code('Forge-Dice/forge-ruleset-drill-20261004-root')+'. Keine Forks, importierte Historie oder produktiven Daten.',
  'Owner hat unabhängigen Settings-/Admin-Zugang. Developer zunächst ohne write; später exakt write. Keine allgemeinen Admin-/Write-Bypässe, Write-Deploy-Keys oder sonstigen Writer-Apps.',
  'Python ≥3.11; git; HTTPS zu GitHub. Kein npm, Container oder externer Python-Package-Download nötig. '+code('gh')+' wird nicht benötigt.',
  'Actions bei Setup deaktiviert; automatisch gelöschte Head-Branches und Auto-Merge ausgeschaltet. Alle Runner sind kurzlebige GitHub-hosted Runner. Die Fixtures benötigen keine Secrets außer dem expliziten Job-Token in der Laborprobe.',
  'Owner-/Codex-Tokens in getrennten Prozessumgebungen. Numerische Identität wird über '+code('GET /user')+' kontrolliert. Commit-author/committer und ursprünglicher Workflow-Trigger beweisen nicht die Ref-Schreibidentität.',
  'Geerbte Ref-/Actions-Policies und klassische Branch-Protection vollständig lesen. '+code('403')+' ist UNKNOWN, kein leerer Zustand; zusätzliche Sperren müssen vor einem PASS erklärt sein.',
  'Ein Test nach dem anderen. Keine Merge Queue, Stacks, Batch-Pushes, Wildcard-Refspecs oder automatische Ref-Bereinigung. Alle Commit-Objekte sind reine Marker-Fixtures.',
  'Alle Operationen nach Setup verweisen auf manifestierte Testrefs. '+code('main')+' ist für Ref-Mutationen gesperrt, auch in einem manipulierten Manifest. Canonical name <em>und</em> immutable ID sind im Runner verboten.'
 ])+p('Rulesets und Actions execution protections sind laut aktueller Dokumentation in öffentlichen Repositories verfügbar. Konto-/Org-Unterstützung wird durch echten API-Readback geprüft. '+cite('S2','S6'))))

rules=drill.spec(['refs/heads/main'])
rows=[]
for i,r in enumerate(rules,1):
    refs=r['conditions']['ref_name']
    by=', '.join(str(a['actor_id'])+' / '+a['actor_type']+' / '+a['bypass_mode'] for a in r['bypass_actors']) or '[] — niemand'
    names=', '.join(x['type'] for x in r['rules'])
    rows.append((code('R'+str(i)+' '+r['name']),code(r['target']),'<br>'.join(code(x) for x in refs['include']),
                 '<br>'.join(code(x) for x in refs['exclude']) or '[]',code(by),code(names)))
fields=[
 ('Alle','Ruleset name', 'name', 'exakter R1–R7-Name'),
 ('Alle','Enforcement status: Active', 'enforcement', 'active, niemals evaluate als Schutzbeweis'),
 ('R1–R6 / R7','New branch ruleset / New tag ruleset','target','branch / tag'),
 ('Alle','Target branches / Target tags; Add a target','conditions.ref_name.include / exclude','Patterns aus der Tabelle; API immer volle refs/heads/...'),
 ('R3–R5','Bypass list / Add bypass','bypass_actors[].actor_type / actor_id','User / numerische bestätigte ID; UI-User-Auswahl siehe UNKNOWN-Tabelle'),
 ('R3','For pull requests only','bypass_actors[].bypass_mode','pull_request'),
 ('R4–R5','Always allow','bypass_actors[].bypass_mode','always'),
 ('R3–R7','Restrict creations','rules[].type','creation'),
 ('R3–R7','Restrict updates','rules[].type / parameters.update_allows_fetch_and_merge','update / false'),
 ('R1, R7','Restrict deletions','rules[].type','deletion'),
 ('R1','Block force pushes','rules[].type','non_fast_forward'),
 ('R2','Require a pull request before merging','rules[].type','pull_request'),
 ('R2','Zähler für Approvals; konkrete aktuelle Widget-Beschriftung unbestätigt','parameters.required_approving_review_count','0'),
 ('R2','Code-owner-, Last-push-, stale-review- und thread-resolution-Unteroptionen; Labels teils unbestätigt',
  'parameters.require_code_owner_review / require_last_push_approval / dismiss_stale_reviews_on_push / required_review_thread_resolution','alle false'),
 ('R2','Zugelassene Merge-Methoden; konkretes Rule-Widget unbestätigt','parameters.allowed_merge_methods','[merge,squash,rebase]'),
 ('R2','Require status checks before merging','rules[].type','required_status_checks'),
 ('R2','Check-Auswahl / Quelle; konkrete Source-Picker-Beschriftung unbestätigt','parameters.required_status_checks[].context / integration_id','forge-gate + forge-verify / echte GitHub-Actions App-ID'),
 ('R2','Require branches to be up to date before merging','parameters.strict_required_status_checks_policy','true'),
 ('R2','Create-Ausnahme; aktuelles Widget-Label unbestätigt','parameters.do_not_enforce_on_create','false')]
unknown=[
 ('User-Bypass im UI','UNKNOWN: ob die aktuelle Oberfläche einzelne User anbietet und wie das Feld dort heißt. Der UI-Guide nennt Rollen/Teams/Apps; REST nennt ausdrücklich User.','Direkt REST actor_type=User verwenden und actor_id/readback prüfen. Kein allgemeiner Write-/Admin-Bypass. Team-Variante wäre eine gesondert zu prüfende Konfigurationsvariante.'),
 ('Approvals-/Review-Unteroptionen','Exakte aktuelle UI-Widget-Texte nicht vollständig im Guide belegt. API-Namen sind bekannt.','API-JSON ist maßgeblich; UI nur nach Export/Readback-Gleichheit akzeptieren.'),
 ('Check-App Source-Picker','Widget-Name UNKNOWN; integration_id ist bekannt, sein numerischer Wert ist ein LIVE-Bindungswert.','bind-checks liest app.id aus den echten aktuellen forge-gate/forge-verify Checks. Kein null, Any source oder geratenes App-ID-Literal.'),
 ('Actions actor/event/workflow-scope Picker','Dokumentierte Sektionen Restrict actors / Restrict events; konkrete einzelnen Picker-Labels nicht live gesehen.','Exaktes API-JSON unten verwenden. Keine erfundenen UI-Feldnamen.'),
 ('Policy-insights Export-API','Kein hier bestätigter REST-Endpoint für einen vollständigen Insights-Export.','Dokumentierte Policy insights UI + konkrete blocked Run-/Check-/Jobdaten sichern; keine erfundene API.'),
 ('Ruleset-/Policy-IDs, run IDs, PR-Nummern','Feldnamen bekannt, Werte erst bei Erstellung/Run verfügbar.','Responses speichern; Werte niemals vorab erfinden.'),
 ('Live-Enforcement / native Head-Bindung','Nicht durch Dokumentation allein geklärt.','Positiv-/Negativfälle ausführen. Genaue Field-Namen sind bekannt; Runtime-Wirkung bleibt bis dahin NOT VERIFIED.')]
jsonblocks=''.join('<details><summary>R'+str(i)+' — '+esc(r['name'])+' · exact API JSON</summary>'+pre(json.dumps(r,indent=2))+'</details>' for i,r in enumerate(rules,1))
parts.append(section(2,'Exact Seven Rulesets',
 p('Unverändertes Sieben-Regeln-Modell aus dem Bootstrap-Bericht. '+'<strong>R1 und R2 sind bypassfrei.</strong> R3 gewährt nur Owner-PR-Bypass. R4/R5 gestatten Namespace-Schreiben, ohne R1 zu umgehen. Alle Regeln sind Repository-Regeln, kein '+code('push')+'-Ruleset. '+cite('S1','S3','S4'))+
 table(['Ruleset','Target','Include','Exclude','Bypass','Rules'],rows)+
 p('UI-Patterns verwenden Branch-/Tagnamen, etwa '+code('forge/run/codex/**/*')+'; JSON verwendet volle Ref-Namen. '+code('~ALL')+' ist der API-All-Refs-Wert. '+code('*')+' allein überschreitet keine Slash-Grenze; die rekursiven Kanten werden live geprüft. '+cite('S2'))+
 p('Für R3–R7 ist '+code('update_allows_fetch_and_merge=false')+' explizit. R2 hat native Approvals=0, Last-push=false, Code-owner-review=false, alle drei Merge-Methoden erlaubt, genau zwei App-gepinnte Checks, strict up-to-date=true und keine Create-Ausnahme. Keine exempt-Bypässe, kein allgemeiner Role-/Integration-Bypass.')+
 table(['Gilt für','UI-Feld / dokumentierte Beschriftung','Exakter API-Feldpfad','Wert'],[(a,b,code(c),code(d)) for a,b,c,d in fields])+
 p('Der UI-Guide dokumentiert '+code('Restrict deletions')+' als standardmäßig ausgewählt. In R2–R6 deshalb nicht versehentlich übernehmen: exakt die angegebenen rules-Arrays speichern. Den Toggle zur Upstream-Fetch-/Merge-Ausnahme auf false lassen. '+cite('S3'))+
 '<h3>Aktuell unbekannte Namen und erst live bindbare Werte</h3>'+table(['Feld / Punkt','Was unbekannt bleibt','Konkreter Umgang'],unknown)+
 p('REST: '+code('POST /repos/{owner}/{repo}/rulesets')+', Readback '+code('GET /repos/{owner}/{repo}/rulesets/{ruleset_id}')+
   '. Headers: '+code('Accept: application/vnd.github+json')+' und '+code('X-GitHub-Api-Version: 2026-03-10')+'. Owner-Token braucht Administration write. '+cite('S1'))+
 p('<strong>R2-Template enthält absichtlich '+code('__BIND_CHECK_APP_ID__')+'.</strong> Es ist vor der Bindung keine fertige POST-Payload. Der Runner lässt R2 vorher nicht aktivieren und schreibt nach erfolgreichem bind-checks echte Integer-IDs in beide R2.json-Dateien.')+jsonblocks+
 '<h3>Drill-Derivation, exakt begrenzte Abweichung</h3>'+p('candidate-rulesets enthält diese Main-only-Konfiguration. drill-rulesets ergänzt in R2/R3 ausschließlich die '+str(len(M['main_targets'])-1)+' einzeln manifestierten Test-Base-/Main-Stellvertreter; R6 nimmt exakt dieselbe Liste zusätzlich aus. Alle übrigen Regeln, Actor-Mengen und Bypass-Modi bleiben identisch. Die erlaubten Writer-Namespaces treffen diese Stellvertreter nicht. Keine achte Regel, keine neue Architektur.')+
 p('Das prüft die serverseitige Wirkung derselben Regelkonfiguration auf Testrefs. Es ist ausdrücklich <strong>kein Ref-Mutationstest gegen kanonisches main</strong>. Ein tatsächlicher schädlicher Versuch auf main wäre mit der Anforderung „auch bei unerwartetem ALLOW main nicht beschädigen“ unvereinbar. Dafür werden Rule-Readback und identische Stellvertreter verwendet.')))

activation=[
 ('P0','Isoliertes Setup; Actions aus; trusted main einmal erstellen','Admin-/Identity-/Policy-Inventar, Marker, Start-SHA; keine Developer-Writer.'),
 ('P1','Alle Disposable-Refs und Existing-Tag-Fixtures vor R1/R7 seeden','126 gelistete Seed-Refs; keine alten produktiven Branches.'),
 ('P2','Owner-authored push/PR/dispatch Controls; Developer weiterhin ohne write','Drei tatsächlich ausgeführte CONTROL_SENTINELs; dann Actions wieder aus.'),
 ('P3','Actions execution policy active; Readback; Actions ein','~ALL, keine excludes, nur zwei User-IDs, nur PR-target. Genuine Actions-token CONTROL muss create+FF können.'),
 ('P4','R1 → R7','Bypassfreie Delete/NFF und Tag-Sperre. Actions M1 NFF/Delete jetzt isoliert testen.'),
 ('P5','R4 → R5 → R6 → R3','Writer-Isolation, Deny-other, Owner PR-only; erst danach Codex write erteilen. Direkter Owner-FF vor R2 muss R3-denied sein.'),
 ('P6','Native bind-PR; Owner Re-run all jobs; bind-checks','Beide ausgeführte Checks am aktuellen Head, richtige App, Herkunft default main. Kein R2 bei Bindungsfehler.'),
 ('P7','R2 zuletzt; full readback + live branch coverage','Sieben active-Regeln. Checks haben keine Owner-/Admin-Ausnahme.'),
 ('P8','Ref-/PR-/Merge-/Actions-Matrix; zweites isoliertes Root-Fenster','Ein Fall pro Versuch; finaler Async-Merge-Zustand vor Folgemutation; Root-Kanten ohne Git-D/F-Konflikte.'),
 ('P9','Finale Evidence; PRs schließen, gesamte Testrepos optional manuell archivieren','Keine Branch-/Tag-Bereinigung, keine Schutzabsenkung, keine Übertragung auf Forge.')]
parts.append(section(3,'Activation Order',table(['Phase','Aktivierung','Gate vor nächster Phase'],activation)+
 p('Die kurze Owner-Control-Phase führt ausschließlich zuvor geprüften Owner-Fixture-Code aus. Erst nach wirksamer All-workflow-Execution-Policy erhält ein Developer Schreibzugriff. Execution-Policy und Ref-Rulesets sind unterschiedliche Schutzflächen. '+cite('S5','S6'))+
 p('Neue öffentliche Repositories können eine geerbte/default PR-target-Policy haben. Laut aktueller Dokumentation soll die Default-Blockierung für betroffene öffentliche Repositories am <strong>2. November 2026</strong> wirksam werden; eine anwendbare explizite Event-Policy muss PR-target zulassen. Übergeordnete Restriktionen werden nicht automatisch aufgehoben. '+cite('S8'))))

parts.append(section(4,'Test Refs',
 table(['Klasse','Dedizierte Ref','Zweck'],[
  ('Owner',code('refs/heads/forge/owner/drill-20261004-a/...'),'FF/Create, cross-namespace, self-PR, trusted probe triggers'),
  ('Codex',code('refs/heads/forge/run/codex/drill-20261004-a/...'),'FF/Create, workflow injection, PR-heads, stale-head'),
  ('Contract',code('refs/heads/forge/contract/drill-20261004-a/...'),'Owner-only Create/FF; revisions auf neuen Branches'),
  ('Main-Stellvertreter',code('refs/heads/forge/drill-main/drill-20261004-a/{case}'),'Create/FF/NFF/Delete-Denials bei R2/R3'),
  ('PR-Base',code('refs/heads/forge/drill-base/drill-20261004-a/{scenario}'),'Legitime/negative Merges, missing/fail checks, stale/base-frische'),
  ('Seeded legacy / stray',code('refs/heads/forge/stray/drill-20261004-a/...'),'Bestehender fremder Branch: update durch R6 gesperrt, Delete durch R1 gesperrt'),
  ('Tags',code('refs/tags/forge-drill/drill-20261004-a/{case}'),'Neue Tag-Erstellung plus echte updates/deletes vorhandener Testtags'),
  ('Prefix traps',code('forge/run/codexevil/...')+', '+code('Forge/run/codex/...')+', '+code('forge/ownerevil/...')+', '+code('forge/contractevil/...'),'Excludes dürfen ähnliche Präfixe nicht freigeben'),
  ('Root-Fenster',code('forge/run/codex')+', '+code('forge/owner')+', '+code('forge/contract'),'Reservierte leere Namespace-Wurzeln nur im zweiten frischen Repo, vor allen descendant refs'),
  ('Actions token control',code('refs/heads/forge/actions-control/drill-20261004-a/token-write'),'Vor Writer-Sperren echte GITHUB_TOKEN-Schreibfähigkeit beweisen; Ref anschließend behalten')])+ 
 p('NFF-Fixtures starten auf einem eigenen Child-Commit von main; der verbotene Kandidat ist ein anderer Child desselben Parents. Dadurch existiert ein gemeinsamer Vorfahr. '+code('compare')+' muss vor dem Versuch diverged/behind bestätigen. FF-Kandidaten müssen ahead sein, Delete-Ziele wirklich existieren. No-op, unbekannter Ref, invalid ref, prefix collision und Token-Verweigerung zählen nicht als Ruleset-PASS.')+
 p('Warum zweites Root-Fenster: '+code('forge/owner')+' kann nicht als Branch angelegt werden, wenn bereits '+code('forge/owner/x')+' besteht. Ein solcher Git-Verzeichnis-/Dateikonflikt würde den R6-Nachweis verfälschen. Daher dort nur main initialisieren, R1+R6 aktivieren und sechs Root-Create-Versuche durchführen. R2–R5/R7 treffen diese Root-Refs nicht; ihre effektiven Branch-Regeln entsprechen R1+R6 des Gesamtmodells. Kein temporäres Löschen zum Ermöglichen dieses Tests.')))

matrix=[
 ('Create / FF eigener Owner-Branch','ALLOW R5','DENY R5','DENY R5 + M0-Tokenrechte'),
 ('Create / FF eigener Contract-Branch','ALLOW R5','DENY R5','DENY R5 + M0-Tokenrechte'),
 ('Create / FF Codex-run','DENY R4','ALLOW R4','DENY R4 + M0-Tokenrechte'),
 ('NFF jeder Branchklasse','DENY R1','DENY R1','DENY R1; M1 isoliert vor Writer-Sperren'),
 ('Delete jeder Branchklasse','DENY R1','DENY R1','DENY R1; M1 plus M0'),
 ('Stray / Claude / ähnliche Präfixe create oder FF','DENY R6','DENY R6','DENY R6'),
 ('Main direct push / Ref-FF','DENY R3/R2','DENY R3/R2','DENY R3/R2; Test auf main-Stellvertreter'),
 ('Main create / NFF / delete','DENY R3/R1','DENY R3/R1','DENY R3/R1; Test auf disposable alias'),
 ('Tag create / FF / NFF / delete','DENY R7','DENY R7','DENY R7'),
 ('PR aus eigenem zugelassenen Namespace','GitHub ALLOW; Forge-Gate abhängig von Autor/Scope','GitHub ALLOW; Forge-Gate abhängig von Autor/Scope','M0 DENY wegen Tokenrechten/Toggle; keine Ruleset-PR-ACL'),
 ('PR aus fremdem bereits bestehenden Namespace','GitHub kann ALLOW; Forge-Gate DENY','GitHub kann ALLOW; Forge-Gate DENY','M1 PR-Struktur wäre eine andere Token-Konfiguration; nicht als R4/R5-DENY behauptet'),
 ('Merge, beide Pflichtchecks tatsächlich grün, aktueller Head/Base','ALLOW via PR-only R3-Bypass, R2 weiterhin Pflicht','DENY R3 trotz grüner Checks','DENY R3 trotz M1-write-Token und grüner Checks'),
 ('Merge, Check fehlt/fail/stale/falsche App','DENY R2, auch mit bypass_rules=true','DENY R2/R3','DENY R2/R3'),
 ('Developer push / pull_request / workflow_dispatch workflow','Event-Policy blockiert auch Owner-Dispatch','Event-Policy BLOCK_START','Kein allgemeiner Actions-App-Actor in Allowlist'),
 ('Trusted pull_request_target','ALLOW als auslösende Owner-Identität','ALLOW als auslösende Codex-Identität','Job läuft trusted; Token ist separat ein App-Akteur'),
 ('Re-run trusted PR-target','Technisch ALLOW, gültiger Owner-Recheck','Technisch kann ALLOW; verify muss Owner-ID ablehnen','M0 keine eigene privilegierte Re-run-Aktion'),
 ('Settings verändern / freeze','ALLOW als Admin','DENY durch fehlende Administration','DENY mit gewählten Jobrechten')]
parts.append(section(5,'Actor × Operation Matrix',table(['Operation','Wuerfelduell · ID 315180734','forge-codex · ID 337272506','GitHub Actions'],matrix)+
 p('<strong>GitHub Actions bezeichnet die authentifizierte GITHUB_TOKEN-App bei Ref-/Merge-API-Aufrufen.</strong> Die auslösende Person eines PR-target-Runs bleibt Owner/Codex; das macht den Job-Token nicht zum User-Bypass-Actor. GitHubs interner Vollzug eines Owner-Merges ist ebenfalls kein eigenständiger Actions-Writer-Bypass.')+
 p('PR-Erstellung wird nicht pauschal durch Branch-Rulesets blockiert. Die swapped-Autor-Fälle trennen die native PR-Möglichkeit von Forge-Zulässigkeit. GITHUB_TOKEN ohne entsprechende Rechte und ausgeschaltete PR-Erstellung ist ein separater Permissions-Test.')))

positive=[
 ('R1','R1-FF-owner, R1-FF-codex, R5-CONTRACT-FF','Eigener Writer-Bypass erlaubt echten FF, R1 bleibt aktiv. Positive und nachfolgende NFF-/Delete-Negative nutzen denselben echten Actor.'),
 ('R2','MERGE-green-codex-owner, MERGE-green-owner-owner','Owner merged bei zwei tatsächlich ausgeführten, aktuellen, App-gepinnten erfolgreichen Checks; kein GitHub-Approval nötig.'),
 ('R3','Owner-Merge einer Codex-PR und Owner-eigener PR','bypass_rules=true fordert nur vorhandenen PR-only-Bypass an. Direkter Owner-Update-Test vor R2 bleibt DENY.'),
 ('R4','R4-CREATE-codex-one, R4-CREATE-codex-a-b-c; R1-FF-codex','Ein- und Mehrfach-Tiefe im Codex-Namespace erlaubt; Owner-only Ausnahmen gibt es dort nicht.'),
 ('R5','R5-CREATE-owner-one, R5-CREATE-owner-a-b-c; R5-CONTRACT-CREATE / FF','Beide erlaubten Owner-Namespaces tatsächlich beschreibbar; neue Contract-Revision erhält neuen Ref.'),
 ('R6','Legitime R4-/R5-Create- und FF-Kontrollen mit aktivem R6','Excludes greifen genau auf gültige Namespaces. R6 hat auf seinen eingeschlossenen Stray-Refs absichtlich keine positive Schreiboperation.'),
 ('R7','Branch-Create-Kontrolle bei aktivem R7; Testtags weiterhin unverändert lesbar','Tag-Sperre beeinträchtigt erlaubtes Branch-Schreiben nicht. Bei ~ALL und bypass=[] ist kein erlaubter Tag-Schreibfall vorgesehen.'),
 ('Actions policy','Trusted PR-target von Owner und Codex; Owner Re-run all jobs','Default-main-Fixture startet, GITHUB_TOKEN-Rechte bleiben wie ursprünglich definiert; Header-/Event-/Workflow-Source nachgewiesen.'),
 ('Actions M1 control','PASS_TOKEN_CONTROL vor Ref-Restriktionen','Echter Job-Token kann einen ausschließlich ihm gewidmeten Controlref create + FF-update; Credential-DENY kann spätere Rule-DENY-Nachweise nicht vortäuschen.')]
parts.append(section(6,'Positive Tests',table(['Regel','Konkreter positiver Live-Fall','Erforderliche Evidence'],positive)+
 p('Positive heißt erlaubte Operation/Kontrolle, negative heißt beabsichtigter Policy-Verstoß. R6/R7 verbieten alle eingeschlossenen Schreiboperationen; deren positive Kontrollen liegen explizit außerhalb des Verbotsscopes. Ein DENY wird nicht in einen erfundenen erlaubten Tag-/Stray-Fall umgedeutet.')+
 p('Native '+code('skipped')+'/'+code('neutral')+' können nach GitHub-Dokumentation Checkpflichten erfüllen. Deshalb die zwei Baseline-Pflichtjobs tatsächlich ausführen und Job-/Step-Daten sichern. Die Fixture verwendet für fehlende Checknamen einen anderen Jobnamen, keinen Conditional-skip des Pflichtjobs. '+cite('S14'))))

negative=[
 ('R1','R1-NFF-owner/codex; R1-DELETE-owner/codex; Contract/Stray/Main-alias-Fälle','Alle Ref-SHAs bleiben gleich bzw. vorhandene Refs bleiben vorhanden; GH013/ruleset-bezogener Grund. Kein normaler Client-NFF-Reject als Server-Schutzbeweis.'),
 ('R2','MERGE-missing-gate / missing-verify / fail-gate / fail-verify','Jeweils gezielte Check-Bedingung isolieren. Missing: anderer Check grün. Fail: ausgeführter echter Failure, kein skip.'),
 ('R2 source pin','MERGE-wrong-source','Zwei gleichnamige grüne Commit-Statuses via Owner-PAT; keine vertrauenswürdigen gleichnamigen Actions-Checks; Merge muss trotz Owner-Bypass-Anforderung scheitern.'),
 ('R2 freshness','MERGE-stale / MERGE-outdated','H1 grün → H2 FF → alter Re-run darf H2 nicht freigeben. Up-to-date-Test: Base ausschließlich via zweiter geprüfter Owner-PR vorziehen.'),
 ('R3','Codex-Merge einer grünen Codex-PR und grünen Owner-PR; Actions M1 grüne PR','Qualitätsgates bereits grün, passende API-Schreibrechte vorab bewiesen; final failed aufgrund Actor-Fence. Kein Qualitätsfehler als R3-Beweis.'),
 ('R4','CROSS-owner-codex-R4-CREATE / FF','Owner kann eigenen Namespace schreiben, Codex-Namespace nicht; Admin ist kein impliziter Namespace-Bypass.'),
 ('R5','CROSS-codex-owner-R5-CREATE / FF und contract-Varianten','Codex kann seinen run-Namespace schreiben, Owner-/Contract-Namespace nicht.'),
 ('R6','Stray/Claude/prefix traps/uppercase; seeded-legacy FF; sechs Root-Fälle','Serverseitige Branch-Coverage und echte Versuche. Invalid ref, Directory/File-Kollision oder fehlende Tokenrechte sind kein PASS.'),
 ('R7','Create / FF / NFF / Delete mit Owner/Codex/Actions','Create auf neuem Tag; update/delete auf vor R7 vorhandenen Disposable-Tags. API 404 bei missing tag zählt nicht.'),
 ('Forge actor validation','swapped-owner / swapped-codex','PR-Erstellung kann zulässig sein; Gate muss AUTHOR_NAMESPACE_MISMATCH ausgeben; keine fingierte Ruleset-PR-ACL.'),
 ('Actions policy','Developer push / pull_request / workflow_dispatch + neuer beliebiger Workflow-Pfad','Blockiert durch externe aktive Event-Policy, bevor ein untrusted Job startet; keine Sentinel-Ausführung und keine gestarteten Jobs.')]
allcases=table(['Case-ID','Actor','Operation','Expected','Zielref / Scenario','Regel / Phase'],[
 (code(c['id']),esc(c['actor']),code(c['operation']),code(c['expected']),code(c['ref']),
  esc(','.join(c['rules'])+' · '+c['phase'])) for c in M['cases']])
parts.append(section(7,'Negative Tests',table(['Grenze','Konkrete Live-Fälle','Deny-Beweis'],negative)+
 '<h3>STOP bei unerwartetem ALLOW</h3>'+ul([
  'Jeder HTTP-Erfolg einer verbotenen synchronen Ref-Operation <em>oder</em> jede beobachtete unerwartete Ref-Änderung setzt '+code('STOP.json')+'. Keine automatische Rückänderung. Auch eine Deny-Antwort mit geändertem Ref löst STOP aus.',
  'Asynchroner Merge: '+code('202')+' ist PENDING. UUID, ursprünglicher Head und Before-SHA werden sofort gespeichert; bis final '+code('merged')+'/'+code('failed')+' sind weitere normale Mutationen verriegelt. Negativer Fall mit final merged oder verändertem Ref: sofort STOP.',
  'Untrusted Job-start oder UNTRUSTED_SENTINEL: sofort laufenden Run abbrechen, neue Tests stoppen, Owner-Freeze durchführen. Ein späterer Failure oder Gate-DENY heilt den bereits begonnenen Workflow nicht.',
  'Owner-Freeze deaktiviert neue Actions, entfernt ausschließlich den R3-Bypass bei weiterhin aktiven creation/update-Regeln und cancelt alle nicht abgeschlossenen Runs. Schon grüne Heads verlieren dadurch den Main-Merge-Pfad.',
  'Ein allgemeiner 403, 404, 422, API-Limit, ancestry/no-op-Fehler oder generischer Merge-Konflikt ist INCONCLUSIVE und kein PASS. Code bricht ab, statt eine schwächere Variante automatisch zu aktivieren.',
  'Keine Force-Push-Reparatur. Keine Branch-/Tag-Deletes, Umbenennungen, Rekreation gelöschter Testrefs oder automatisches STOP-Clearing. Fehlkonfiguration später gezielt im eingefrorenen Testrepo korrigieren; neuer isolierter Run für Wiederholung.'
 ])+'<details><summary>Vollständiges ausführbares Inventar: '+str(len(M['cases']))+' benannte Fälle</summary>'+allcases+'</details>'))

aprows=[
 ('AP-CTRL','Owner-only push / PR / dispatch vor Developer-Zugriff','Tatsächliche CONTROL_SENTINEL-Ausführung','Definitionen/Runner sind funktionsfähig. Untrusted Code wird in dieser Phase nicht ausgeführt.'),
 ('AP-1','Developer ordinary FF git push veränderter push-Workflow + beliebiger neuer Workflow','BLOCK_START','Git push akzeptiert, richtige forge-codex-Identität, Workflow-Rechte bewiesen; aktive all-path Event-Policy blockiert push.'),
 ('AP-2','Developer PR aus derselben Ref mit pull_request-Canary','BLOCK_START der PR-Canary; trusted PR-target darf starten','Konkrete blocked event/path/actor, kein Canary-Job-start; Workflow-source des erlaubten Runs ist default main.'),
 ('AP-3','Developer workflow_dispatch auf existierender Workflow-ID mit Codex-Ref','BLOCK_START','Default main enthält Dispatch-Definition; Head enthält geänderten Code. 204 allein ist PENDING; native Policy-Blockgrund erforderlich.'),
 ('AP-4','Trusted pull_request_target von Owner und Codex','ALLOW_START','Event=PR-target, richtige Author/Actor-IDs, workflow_sha=trusted main; keine Head-Ausführung.'),
 ('AP-5','Owner re-run all jobs des AP-4/Codex-Runs','ALLOW_START; gültiger Owner-Recheck','Gleiche ursprüngliche Event-SHAs/Ref, actor.id bleibt ursprünglicher Actor; triggering_actor.id=315180734; beide Jobs neu ausgeführt.'),
 ('AP-6','Codex re-run desselben trusted PR-target-Runs','Technischer Re-run kann ALLOW; Verify DENY','triggering_actor.id=337272506; Verify muss OWNER_ID_REQUIRED liefern. Externe Policy ist kein Owner-only-Re-run-ACL.'),
 ('AP-7','Genuine Actions token M0/M1','M0 permission DENY / M1 ruleset DENY','Getrennte feste Jobs; M1 LAB ONLY fordert contents:write und pull-requests:write; keine PR-Quelle ausgeführt.')]
parts.append(section(8,'Actions Policy Drill',
 p('Zusätzliche Actions-Ausführungspolicy, <strong>kein achtes Ref-Ruleset</strong>. UI-Pfad dokumentiert: Settings → Actions → Policies, Sektionen Restrict actors und Restrict events; Policy insights separat. Aktuelle API-Namen sind bekannt: '+code('restrict_actions_actors')+' und '+code('restrict_action_events')+'. '+cite('S5','S6'))+
 pre(json.dumps(drill.policy(),indent=2))+
 p('POST '+code('/repos/{owner}/{repo}/actions/policies')+'; GET '+code('/repos/{owner}/{repo}/actions/policies/{policy_id}')+
   '; Liste einschließlich Eltern '+code('?has_parents=true')+'. '+code('workflow_path.include=["~ALL"]')+', '+code('exclude=[]')+'. Keine Workflow-Path-Ausnahme. Nicht mit der General-Settings-Allowlist für verwendete Actions verwechseln: '+code('allowed_actions=local_only')+' verhindert allein keine manipulierbaren run:-Schritte. '+cite('S5','S15'))+
 table(['Fall','Live-Aktion','Erwartung','Evidence'],aprows)+
 p('Die Fixtures enthalten harmlose Markerausgaben. Verbotener Head-Code ist trotzdem untrusted Workflow-Code; schon sein Job-Start ist ein Fehlschlag, unabhängig davon, dass der Marker selbst keine Daten abgreift. Die trusted PR-target-Fixture checkt keinen Head aus, lädt keine Head-Imports und startet keine Head-Tests. '+cite('S8'))+
 p('<strong>Blocked-proof:</strong> Event, initiating actor, workflow path, SHA, Ref, PR/Run-ID, Zeitfenster, konkreter Plattform-Blockgrund und nicht gestartete Job-/Step-Daten. Nur kein Sentinel oder kein Run-Eintrag reicht nicht. Failed <em>nach</em> job.started_at, skipped und cancelled sind kein „nie gestartet“. Owner liefert UI-Policy-insights, wenn die Sperre keinen normalen Run-Datensatz erzeugt.')+
 p('Nach zwei Minuten prüfen; nach 15 Minuten ohne konkrete Block-Evidence bleibt der Fall INCONCLUSIVE. Kontrollen und negative Fälle im selben gebundenen Konfigurationszustand vergleichen; keine geerbten Schutzregeln lockern, um Runs zu erzwingen.')+
 p('Für Re-runs dokumentiert GitHub die ursprünglichen Berechtigungen und ursprüngliches GITHUB_SHA/GITHUB_REF. Der Owner wird durch triggering_actor erkannt; dessen Re-run macht das ursprüngliche Job-Token nicht stärker. built-in GitHub-Features sind laut Dokumentation teilweise ausgenommen; solche Plattformprozesse werden separat inventarisiert und nicht als beliebiger erlaubter Developer-Workflow ausgegeben. '+cite('S9','S10','S6'))+
 p('Die Plattformdrill-Fixture ist <strong>kein produktiver Forge-Verifier</strong>. Sie prüft Quellen/Autoren und stellt kontrollierte Checkzustände her. Die Workflow-Injection-PR niemals mergen; der echte Static Gate muss protected-path-Änderungen vor einer Produktionsfreigabe ablehnen. Dieses Paket erweitert dessen Architektur nicht.')))

lockout=[
 ('P0/P1 Setup','Owner kann Settings/Administration nicht lesen; bind/seed 403; repo marker/identity mismatch','Falscher Account, Token/Org-Freigabe, Repo-Auswahl oder zusätzliche aktive Regel','Account/Role/HTTP Request-ID und ursprüngliche Repo-/Ref-Liste sichern. Keine Ref-Test-Mutation beginnen.'),
 ('P2 trusted controls','Owner-Canary startet nicht','General Actions disabled, geerbte Event-/Actor-Policy oder kaputter Fixture-Workflow','Event/Path/Actor, effektive General/Parent Policies; kein Fehlstart als erfolgreichen Negativtest zählen.'),
 ('P3 execution policy','Owner/Codex PR-target wird extern geblockt','allowed_actors, allowed_events, workflow_path oder geerbte Policy','Aktive Policy-Version, konkrete Blocknachricht, Liste aller Parents; Owner bleibt Admin trotz Workflow-Sperre.'),
 ('P4 R1/R7','Legitimer Branch-FF oder Branch-create unerwartet blockiert','Falscher target oder versehentlich zusätzliche creation/update-Regeln','R1/R7-JSON, betroffene Ref und passendes Rule-ID-Inventar sichern.'),
 ('P5 R4/R5','Owner kann Owner/Contract nicht FF/create; Codex kann eigenen run nicht schreiben','User-ID/actor_type, bypass_mode, Namespace include, Tokenrechte','Positive Schreibfähigkeit je Token und Regelreadback, serverseitige Branch-Coverage.'),
 ('P5 R6','Gültiger Namespace wird durch deny-other geblockt','Falsche rekursive Excludes / Hauptbranch-Ausschluss','R6 before/after, Coverage der legitimen und prefix-trap Refs. Keine ~ALL-Bypass-Ausnahme setzen.'),
 ('P5/P7 R3','Owner kann grüne PR nicht mergen, Codex kann es unerwartet','User-ID / pull_request-Modus / fehlende bypass_rules-Anforderung / anderer Blocker','Finale merge-async-Antwort und SHA; R3/R2 readback, pr author/base/head, App-Checks. Async-202 ist kein Resultat.'),
 ('P6 checks','Run grün, aber keine aktuellen Native-Head-Checks','Checks hängen an Base/anderem SHA/anderer Suite, Namen/App falsch','Komplette Suite/Jobs/Checks, Head/Base, workflow_sha. R2 noch nicht aktivieren; keine neuen Check-Publisher improvisieren.'),
 ('P7 R2','Owner-eigene OPS-PR ist trotz grüner Bedingungen gesperrt','Last-push/Approvals/Codeowner/strict/app/source/klassischer Schutz','Mergebox und exakte Required-check/Review-Gründe. Positivtest muss ohne zählende fremde Approval möglich sein.'),
 ('P8 runtime tests','Token-403, rate limit, native mergeable_state unknown, noch pending','Voraussetzung oder Timing; kein Enforcement-Beweis','HTTP/headers und Zustände sichern; read-only beobachten. Keine Lockerung der Schutzregeln.'),
 ('Jede Phase','Unerwarteter ALLOW oder gestarteter untrusted Job','Modell, Schema, Policy-Reichweite oder Bypass-Lücke','Minimalen unmittelbaren Nachweis sichern; sofort abbrechen/freeze. Vollständige Logsammlung danach.')]
parts.append(section(9,'Lockout Detection',
 p('Owner Lockout bedeutet hier, dass ein vorgesehenes zulässiges Owner-Schreiben/PR-Merge oder trusted Workflow nicht mehr möglich ist. Branch-/Tag-Rulesets entziehen dem Admin nicht den Settings-Zugang. Fehlender Admin-Zugang ist ein Identitäts-/Berechtigungsproblem und wird nicht mit Branch-Bypass „repariert“.')+
 table(['Phase','Wie erkennen?','Zu kontrollierende Einstellung','Evidence vor Änderung'],lockout)))

recovery=[
 ('P0/P1','Richtigen Owner-Account/Token/Repo binden; Actions bei Setup wieder disabled','Fremde/rückdatierte Refs niemals überschreiben. Bei Collision neues Repo/Run-ID statt cleanup.'),
 ('P2','Nur General Actions enabled für geprüfte Owner-Controls; danach disabled','Keine orgweiten Parent-Policies ändern. Fehlt der Kontrollweg, bleibt der Test inconclusive.'),
 ('P3','Eigene Policy exakt: User-IDs 315180734/337272506, Event PR-target, ~ALL/exclude=[]','Keine zusätzliche Event-/Path-Ausnahme. Unbekannte strengere Parent-Policy nicht automatisiert abschalten.'),
 ('P4','R1 target=branch, Regeln deletion+non_fast_forward, bypass=[]; R7 target=tag, creation+update+deletion, bypass=[]','R1/R7-Schutz niemals für Reinigung aussetzen. Ungewollte zusätzliche Regeln gezielt korrigieren, während eingefroren.'),
 ('P5 writer','R4 Codex User/always; R5 Owner User/always; exakt rekursive Includes','Kein Owner-always-Bypass in R4, kein Codex-/Actions-Bypass in R5, keine RepositoryRole=write/admin-Substitution.'),
 ('P5 deny-other','Exakte R6-Excludes aus Referenz-JSON wiederherstellen','Keine breite forge/**-Ausnahme, kein R6-Bypass; vorher sämtliche Änderungen/Readbacks sichern.'),
 ('P5/P7 merge actor','Nach Diagnose nur R3 User Owner/pull_request herstellen und API bypass_rules=true verwenden','R3 bleibt bis neuer bewusst gestarteter Prüfung eingefroren; niemals main always-Bypass. R2 weiterhin bypassfrei.'),
 ('P6 binding','Keine sichere Feldkorrektur bei fehlender echter Native-Head-Bindung: Freeze, NO-GO','Keine R2-Abschwächung, keine Any-source-Pins, keine neue Check-Publisher-Architektur innerhalb dieses Drills.'),
 ('P7 quality','Nur konkret falsche R2-Felder auf Referenzwerte korrigieren: 0 Approvals, Reviewflags false, echte Checknamen/App-ID, strict=true','Keine grüne PR durch Owner-Bypass an R2 vorbeimergen; Parent-/klassische Regeln nicht pauschal abschalten.'),
 ('P8/P9','Fehlende Voraussetzungen/Timing nur mit read-only Evidence klären; nach unerwartetem ALLOW neuer isolierter Run','STOP bleibt erhalten. Keine automatische Reaktivierung, keine Ref-Reparatur, kein Löschen von Runs/Logs/Reviews.')]
parts.append(section(10,'Recovery',
 '<h3>Konkrete Freeze-Operation</h3>'+pre('python3 drill.py --work live-work --actor owner --execute freeze')+
 ul(['PUT '+code('/repos/{drill-owner}/{drill-repo}/actions/permissions')+' mit '+code('{"enabled":false}')+'.',
     'R3 weiterhin active und mit denselben Includes; '+code('bypass_actors=[]')+', Regeln creation/update unverändert. Falls R3 noch nicht existiert, denselben Fence nur im gebundenen Testrepo anlegen.',
     'Alle nicht abgeschlossenen Workflow-Runs erfassen und '+code('POST /actions/runs/{run_id}/cancel')+' anfordern. Ergebnis prüfen; Cancellation ist asynchron. Wenn normale Cancellation nicht greift, Owner kann konkret '+code('/force-cancel')+' verwenden. '+cite('S12'),
     'Bestehende pending merge-async-UUIDs read-only bis final prüfen; ein 202 oder die deaktivierte Actions-Einstellung widerruft keine bereits angenommene Merge-Anfrage. Jede Ref-Änderung bleibt Teil des Vorfalls.',
     'Danach snapshot/collect. R1/R2/R7, App-Pins, Event-/Actor-Policy und alle Ref-/Run-Evidence bleiben erhalten. Der Runner bietet keine cleanup-/clear-stop-Funktion.'])+
 table(['Phase','Welche konkrete Einstellung zurück?','Was niemals automatisch rückgängig machen?'],recovery)+
 p('Vor Feldkorrektur mindestens Rule-/Policy-Vollpayload, sichtbare Revision/updated_at, aktuelle Ref-Liste, aktiver Schutz pro betroffener Ref, request IDs, PR/SHA/run attempt und Fehlgrund sichern. Beim tatsächlichen Job-Start hat Abbruch Vorrang vor einem langen Export. Nach Root-Vorfall freeze mit '+code('--work root-work')+' verwenden.')))

checklist=[
 'Repo-Name/immutable ID/Visibility/default main; isolierte Setup-Historie, Run-ID/Marker; Start-/End-SHA des Test-main; seed/ref manifest.',
 'Authentifizierte User-ID und wirksame Repository-Role je Owner/Codex; keine Tokenwerte, Header-Authorization oder Secrets.',
 'Alle sieben Vollpayloads mit ID, source/source_type, enforcement, conditions, rules, bypass_actors und readback. Alle zusätzlichen Parent-/klassischen Regeln separat.',
 'Actions General permissions und Default-workflow permissions; komplette aktive Execution-Policy einschließlich Parent-Scoping; Policy insights Screenshots/Export, wo verfügbar.',
 'Jeder Versuch: Case-ID, Aktion/Transport, tatsächlicher Auth-Actor, Timestamp, Before/Candidate/After-SHA bzw. absent, Request-ID, raw status/error, erwarteter und tatsächlicher Ausgang.',
 'Ancestry-Beweis FF=ahead / NFF=diverged/behind; Existenz vor delete/tag-update; Server-Coverage vor/nach finaler Aktivierung; Root-Kollisionen ausgeschlossen.',
 'PR author ID, head/base repo IDs + refs + SHAs; explizites merge-async sha/bypass_rules/merge_action, UUID und finaler merged/failed-Zustand; kein Pending als PASS.',
 'Check-runs: Namen, app.id/app.slug, head_sha, check-suite-ID, status/conclusion, PR-Zuordnung; zugehörige echten Jobs/Steps und Herkunft workflow_sha/ref.',
 'Re-run: ursprüngliche actor.id, triggering_actor.id, run_attempt und alle bisherigen Attempts. Stale-H1/H2 und vorgezogene Base sauber gebunden.',
 'Trusted CONTROL_SENTINEL, blocked Developer push/PR/dispatch je Event, neuer arbitrary Workflow-Pfad, keine untrusted Job-/Step-Starts. Vollständige Logs manuell aus GitHub sichern.',
 'Actions-M1 PASS_TOKEN_CONTROL, isolierte R1/R7-Negative, finale M1 ruleset denials und M0 permissions denials; FORGE_PROBE_RESULT aus trusted default-main-Code.',
 'STOP-Satz und Capture unmittelbar vor/nach freeze; alle weiterhin erhaltenen Ref-/Rule-/Policy-/Run-Daten. Evidence events.jsonl ist hashverkettet, kein kryptografischer Drittparteibeweis.',
 'Root-Fenster-Repository, gleiche Rule-Semantik und sechs eigenständige negative Create-Versuche mit fehlenden Descendants; primären und Root-Nachweis gemeinsam liefern.'
]
parts.append(section(11,'Evidence Checklist',ul(checklist)+
 p('Der Collector liest alle Run-Attempts/Jobs/Checks und beachtet echte Server-Pagination. Er lädt keine untrusted Artefakte als ausführbaren Code. API-/Ref-Fälle können bei eindeutigem Rule-Grund automatisch CASE_PASS erhalten. Workflow-Policy-/Probe-Fälle bleiben bis Log-/Insights-Auswertung PENDING; der Bericht behauptet keine automatische Vollabnahme.')+
 p('Offlineselbsttests und generierte Templates liegen im ZIP. Keine credentials, node_modules, kanonische Working Copy oder ausgeführten Live-Mutationslogs werden ausgeliefert. Alle Beispiele tragen NOT EXECUTED.')))

passcriteria=[
 'Sieben exakt aktive Rulesets mit korrekten Targets/Patterns, ohne versteckte breite Actor-Ausnahmen; aktive all-path Execution-Policy mit nur PR-target und den zwei numerischen User-IDs.',
 'Erforderliche Owner-/Codex-Schreibpfade tatsächlich erlaubt; Cross-Namespace, Stray, Root-/Präfixfallen, Main-Stellvertreter direct/create und alle NFF/Delete/Tag-Fälle korrekt gesperrt. Fehlende Rechte/invalid refs zählen nicht.',
 'Owner kann geprüfte Codex-PR und eigene PR ohne fremde native Approval mergen; Codex und genuine Actions-App können grüne PR nicht mergen. R2 greift weiterhin bei Owner bypass_rules=true.',
 'Beide nativen Checknamen am aktuellen PR-Head und an der richtigen trusted Suite/App; keine skipped/null/alte/gleichnamig fremde Quelle als Forge-Verifikation. Missing/fail/source/stale/strict-Negative tatsächlich gesperrt.',
 'Untrusted push-/pull_request-/dispatch-Code startet in keinem der benannten Versuche; aktive externe Blocknachricht mit passender Event/Actor/Ref/Workflow-Quelle und zero started jobs. Fehlende Runs ohne weitere Policy-Evidence sind INCONCLUSIVE.',
 'Trusted PR-target läuft für Owner/Codex; Owner-Re-run all jobs ist gültig, Codex-Re-run ergibt keine Owner-Freigabe. Originaltoken erhält keine zusätzlichen Rechte.',
 '91 benannte Fälle über Primär-/Root-Fenster plus separate AP-Control-/Re-run-Nachweise; M1 echte Ruleset-Grenze und M0 minimale Tokenrechte getrennt geprüft. Nicht alle 91 sind CLI-Ref-Operationen.',
 'Jedes erwartete ALLOW hat den tatsächlich erwarteten Ref-/finalen Merge-Ausgang. Jedes erwartete DENY hat unveränderte Refs und eine zuordenbare Schutzgrenze. Pending/queued/failed-infra/generische 403 bleiben unbestanden.',
 'Keine unerklärte Owner-Lockout-Lage, kein offener STOP, keine nicht abgeschlossene merge-async-Anfrage, keine widersprüchliche Evidence und keine ungelesene relevante Parent-/klassische Schutzregel.',
 'Test-main ab bind unverändert, keine historischen Branches oder kanonischen Refs mutiert. Kein Force-Push-/Delete-Aufräumen. Canary-PR nicht gemergt; trusted write-token fixture wird nicht in Forge installiert.'
]
parts.append(section(12,'PASS Criteria',ul(passcriteria)+
 p('<strong>Jeder unerwartete ALLOW → gesamter Lauf FAIL/FROZEN.</strong> Ein unaufgelöster UNKNOWN/INCONCLUSIVE/PENDING → NO PASS, auch wenn andere Tests bestehen. Ein vollständig bestandenes Paket belegt nur die geprüfte isolierte Konfiguration; es erteilt keine Freigabe für eine kanonische Aktivierung.')+
 p('<strong>Aktueller Abschlussstatus dieses Auftrags:</strong> Paket erstellt und offline geprüft; LIVE NOT EXECUTED. Keine Rulesets, Actions-Settings, Refs, PRs, Merges oder Tags im kanonischen Repository geschrieben.')))

runbook=(ROOT/'OWNER-RUNBOOK.txt').read_text()
parts.append(section(13,'Exact Owner Runbook',
 p('Die nachstehende Fassung steht identisch als OWNER-RUNBOOK.txt im ZIP. CASE-COMMANDS.txt enthält jeden einzelnen generierten Testbefehl; ausführbare Aktivierung/Ref-/Merge-Operationen erfolgen nur mit explizitem '+code('--execute')+'. Run IDs werden aus echten Responses/UI übernommen.')+
 pre(runbook)+
 '<h3>Primärquellen — am 4. Oktober 2026 erneut gelesen</h3>'+ul([
  '<a id="'+sid+'" href="'+url+'">'+sid+' · '+esc(title)+'</a>' for sid,title,url in sources])+ 
 p('Bootstrap-Vorgaben übernommen: H1 REMOVE, R1 separate bypassfreie Immutable-Grenze, H3 nur trusted PR-target und Owner-Re-run all jobs. Verifier-Implementierung, neue Architektur und kanonischer Bootstrap sind außerhalb dieses Pakets.')))

titles=['Preconditions','Exact Seven Rulesets','Activation Order','Test Refs','Actor × Operation Matrix','Positive Tests',
        'Negative Tests','Actions Policy Drill','Lockout Detection','Recovery','Evidence Checklist','PASS Criteria','Exact Owner Runbook']
style='''*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#f0f3f7;color:#142238;font:16px/1.65 system-ui,-apple-system,Segoe UI,sans-serif}header{background:#142238;color:#fff;padding:34px max(22px,calc((100vw - 1160px)/2));border-bottom:5px solid #b79044}header small{letter-spacing:.12em;color:#c5d1e3}header h1{font-size:31px;line-height:1.2;margin:12px 0}header p{margin:8px 0}.status{display:inline-block;background:#f3e4c3;color:#4b3512;border-radius:5px;padding:6px 11px;font-weight:700;font-size:14px}main{max-width:1220px;margin:28px auto;background:#fff;padding:36px 32px;border:1px solid #dbe1ea;border-radius:10px}nav{background:#edf2f7;border-left:4px solid #b79044;padding:18px 22px}nav a{display:block;padding:3px 0}h2{font-size:26px;line-height:1.3;margin-top:48px;padding-top:22px;border-top:2px solid #dbe1ea;scroll-margin-top:20px}h3{font-size:20px;margin-top:27px}p,li{overflow-wrap:anywhere}a{color:#195c99}li{margin:9px 0}.scroll{overflow:auto;margin:22px 0}table{border-collapse:collapse;min-width:750px;width:100%;font-size:14px;line-height:1.5}td,th{border:1px solid #dbe1ea;padding:11px 12px;vertical-align:top;text-align:left}th{background:#e7edf5}tr:nth-child(even){background:#f8fafc}code{font:13px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;background:#edf2f7;padding:2px 4px;border-radius:3px}pre{overflow:auto;background:#142238;color:#eff3fa;padding:20px;border-radius:7px;line-height:1.5}pre code{background:transparent;padding:0;color:inherit;white-space:pre}details{border:1px solid #dbe1ea;border-radius:6px;padding:12px 14px;margin:14px 0}summary{cursor:pointer;font-weight:700}.cite{font-size:13px;color:#536174;margin-left:5px}@media(max-width:700px){body{font-size:15px}header{padding:24px 18px}header h1{font-size:26px}main{padding:22px 16px;margin:0;border:0;border-radius:0}h2{font-size:22px}table{font-size:13px}pre{padding:15px}}@media print{body{background:white;font-size:10pt}header{background:white;color:#142238;padding:0;border:0}header small{color:#142238}main{max-width:none;margin:0;border:0;padding:0}nav{display:none}h2{break-after:avoid}tr{break-inside:avoid}.scroll{overflow:visible}table{min-width:0;font-size:9pt}pre,pre code{white-space:pre-wrap;overflow-wrap:anywhere;background:#f2f4f7;color:#142238}details{break-inside:avoid}a{color:#142238}}'''
body='<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FORGE RULESET LIVE DRILL</title><style>'+style+'</style></head><body><header><small>FORGE V0.1 · ISOLATED LIVE-DRILL PACKAGE</small><h1>FORGE RULESET LIVE DRILL</h1><span class="status">LIVE NOT EXECUTED · CANONICAL READ-ONLY</span><p>Sieben Ref-Rulesets + Actions execution policy · 91 benannte Fälle · 4. Oktober 2026</p></header><main><nav>'+''.join('<a href="#s'+str(i)+'">'+str(i)+'. '+esc(t)+'</a>' for i,t in enumerate(titles,1))+'</nav>'+''.join(parts)+'</main></body></html>'
OUT.write_text(body)
(ROOT/'FORGE-RULESET-LIVE-DRILL.html').write_text(body)

commands=['FORGE LIVE DRILL — EXACT CASE COMMAND INVENTORY',
 'NOT EXECUTED. Follow OWNER-RUNBOOK.txt phase gates. One case, one observation, then next.',
 'Do not run this file as a shell script. RUN_ID values come from GitHub. Never run all cases unattended.','']
for actor in ['owner','codex']:
    commands+=['ACTOR '+actor.upper()+' — final seven-ruleset REF tests, isolated token terminal','']
    for c in M['cases']:
        if c['actor']==actor and c['operation'] not in ['merge','pr_create'] and c['phase']!='ROOT_FIRST':
            commands+=['# '+c['expected']+' '+c['ref'],f"python3 drill.py --work live-work --actor {actor} --execute run {c['id']}"]
    commands+=['']
commands+=['PR SCENARIOS (bind was already opened in phase P6)','']
for name,sc in M['scenarios'].items():
    if name in ['bind','actions-policy','actions-probe','actions-pr']:continue
    commands+=[f"python3 drill.py --work live-work --actor {sc['author']} --execute pr {name}",
               '# Collect initial run, Owner rerun all jobs, collect again. Apply specific negative-fixture instructions where relevant.']
commands+=['','MERGE CASES — all quality/preconditions from report first. 202 is PENDING.','']
for c in M['cases']:
    if c['operation']=='merge' and c['actor']!='actions':
        commands+=[f"python3 drill.py --work live-work --actor {c['actor']} --execute run {c['id']}",
                   f"python3 drill.py --work live-work --actor owner merge-result {c['id']}",
                   '# merge-result only if the first call returns PENDING and stores its UUID; repeat read-only until final.']
commands+=['','GENUINE ACTIONS TOKEN CASES — one completed, inspected probe at a time','']
for c in M['cases']:
    if c['actor']=='actions':
        if c['id']!='ACTIONS-PR':commands.append(f"python3 drill.py --work live-work --actor owner --execute probe {c['id']} --mode M1")
        commands+=['# Inspect trusted FORGE_PROBE_RESULT; collect its real RUN_ID before next probe.',
                   f"python3 drill.py --work live-work --actor owner --execute probe {c['id']} --mode M0",
                   '# Inspect permissions denial; this does not replace M1 ruleset proof.']
commands+=['','ROOT WINDOW — only root-work before descendant refs, R1+R6 active','']
for c in M['cases']:
    if c['phase']=='ROOT_FIRST':commands.append(f"python3 drill.py --work root-work --actor {c['actor']} --execute run {c['id']}")
(ROOT/'CASE-COMMANDS.txt').write_text('\n'.join(commands)+'\n')
drill.dump(ROOT/'case-inventory.json',{**M,'status':'NOT_EXECUTED','instruction':'Generate a fresh bound live manifest with prepare; never edit this evidence template into a PASS.'})
for i,r in enumerate(rules,1):drill.dump(ROOT/'api-templates'/'candidate-rulesets'/f'R{i}.json',r)
for i,r in enumerate(drill.spec(M['main_targets']),1):drill.dump(ROOT/'api-templates'/'drill-rulesets'/f'R{i}.json',r)
drill.dump(ROOT/'api-templates'/'actions-policy.json',drill.policy())
drill.dump(ROOT/'evidence-template.json',{'status':'NOT_EXECUTED','case_id':'','actor_id':None,'transport':'',
 'operation':'','ref':'','before_sha':None,'candidate_sha':None,'after_sha':None,'request_id':None,
 'http_status':None,'response':None,'pr_number':None,'run_id':None,'run_attempt':None,'merge_uuid':None,
 'final_async_state':None,'ruleset_ids':[],'policy_id':None,'config_sha256':None,
 'block_reason':None,'job_started_at':None,'workflow_sha':None,'verdict':'PENDING'})
print(json.dumps({'report':str(OUT),'cases':len(M['cases']),'sections':len(parts),'live_operations':0}))
