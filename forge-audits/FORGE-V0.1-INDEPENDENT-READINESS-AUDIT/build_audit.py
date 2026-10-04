from pathlib import Path
import html, json, re, hashlib, subprocess

ROOT=Path('/workspace/scratch/4bd741ef363a')
E=ROOT/'evidence'
SHA='3d7545d843883418348004e68717399a64da7a7d'
SPIKE='8dc692b0adc82e9dd2ccef60b6013006e700a744'
OUT=ROOT/'FORGE-V0.1-INDEPENDENT-READINESS-AUDIT.html'
parts=[]; sections=[]
def esc(s): return html.escape(str(s))
def inline(s):
    s=esc(s)
    s=re.sub(r'`([^`]+)`',r'<code>\1</code>',s)
    s=re.sub(r'\*\*([^*]+)\*\*',r'<strong>\1</strong>',s)
    return s
def p(label,s,category=None):
    parts.append('<p><span class="badge">'+esc(label)+'</span> '+('<span class="kind">'+esc(category)+'</span> ' if category else '')+inline(s)+'</p>')
def sec(n,title):
    sections.append((n,title));parts.append(f'<section id="s{n}"><h2>{n}. {esc(title)}</h2>')
def end():parts.append('</section>')
def tab(headers,rows):
    parts.append('<div class="table"><table><thead><tr>'+''.join('<th>'+inline(h)+'</th>' for h in headers)+'</tr></thead><tbody>')
    for row in rows:parts.append('<tr>'+''.join('<td>'+inline(x)+'</td>' for x in row)+'</tr>')
    parts.append('</tbody></table></div>')
def bullets(label,items):
    parts.append('<p><span class="badge">'+esc(label)+'</span></p><ul>'+''.join('<li>'+inline(x)+'</li>' for x in items)+'</ul>')
def code(s):parts.append('<pre><code>'+esc(s)+'</code></pre>')
def doc(url,title):parts.append('<p class="source">DOCUMENTED · Primärquelle: <a href="'+esc(url)+'">'+esc(title)+'</a> · abgerufen 03.10.2026</p>')

parts.append('<div class="verdict"><strong>Gesamtempfehlung: GO WITH BLOCKERS.</strong> Ein kleiner Forge-Core-Drill ist der erste geeignete Run. Die bestehenden Kernbibliotheken sind kein bereits abgesicherter autonomer GitHub-Workflow.</div>')
p('VERIFIED','Read-only Audit am 03.10.2026. Kanonische Quelle: Forge-Dice/Forge. Letzte erneute Remote-Abfrage: 19:14:54 UTC; main unverändert bei '+SHA+'. Keine kanonischen Dateien, Commits, Branches, PRs, Reviews, Kommentare, Settings oder Workflows wurden verändert. Der unveränderte Hauptcheckout hat leeren git status. Experimente liefen ausschließlich in Wegwerfkopien.','FACT FROM GITHUB / FACT FROM VERSIONED REPOSITORY')
p('INFERRED','Der erste Run braucht eine nachweislich geschlossene main-Schreibgrenze, unabhängige Prüfung des exakten Heads und manuelle Owner-Abnahme. Format 2, ein vollständiges Actions-System und eine neue Mystery-Roadmap sind dafür nicht erforderlich. Die Empfehlungen unten wurden in diesem Audit nicht umgesetzt.','INFERENCE')
tab(['Kennzeichnung','Bedeutung'],[
('VERIFIED','Aktueller Remote/API-Befund oder unabhängig gelesener Code des fixierten main; keine Garantie für spätere Änderungen.'),
('EXPERIMENTALLY VERIFIED','Reproduktion in einer lokalen Wegwerfkopie; konkrete Umgebung und Grenzen im Anhang.'),
('DOCUMENTED','Versionierte Spezifikation oder aktuelle offizielle Dokumentation; noch kein Implementierungsnachweis.'),
('INFERRED','Begründete Ableitung, Risikobewertung oder Empfehlung; keine bestehende API oder aktivierte Policy.'),
('UNKNOWN','Nicht lesbar, nicht auffindbar oder nicht experimentell belegt. Wird nicht stillschweigend ergänzt.')])
p('VERIFIED','Zeilenangaben beziehen sich immer auf den oben genannten main-SHA, außer ein anderer Branch/SHA ist ausdrücklich angegeben. Historische Artefakte bleiben historische Artefakte, auch wenn sie inzwischen auf main liegen.')

sec(1,'Verified GitHub State')
tab(['Gegenstand','Aktueller Nachweis','Label / Herkunft'],[
('Repository','Forge-Dice/Forge; ID 1401864629; public; default branch main. Organisation Forge-Dice, ID 337291195.','VERIFIED · FACT FROM GITHUB'),
('main','3d7545d843883418348004e68717399a64da7a7d; Tree 67103229baccaefd68ce5047d8503eca9883f1d3. GitHub-verifizierter Merge von PR #1.','VERIFIED · FACT FROM GITHUB'),
('Offene PRs / Drafts','Genau #2; open, draft=true, merged=false; keine weiteren offenen PRs in der abgefragten vollständigen Seite.','VERIFIED · FACT FROM GITHUB'),
('Merge-Methoden','Merge, Squash und Rebase erlaubt; auto_merge=false; delete_branch_on_merge=false.','VERIFIED · FACT FROM GITHUB'),
('Rulesets','GET rulesets?includes_parents=true liefert []; aktive Regeln für main ebenfalls []. main protected=false.','VERIFIED · FACT FROM GITHUB'),
('Branch-Protection Detail','Detailendpoint /branches/main/protection: 403 Resource not accessible by integration. Aus diesem Fehler allein folgt keine Aussage über Settings. Separat liefern Branch und aktive Rules API keine Schutzregeln.','UNKNOWN Detailzugriff; VERIFIED separate Beobachtungen'),
('Actions','Workflows API total_count=0; Runs API total_count=0. Auf main fehlt .github vollständig.','VERIFIED · FACT FROM GITHUB / VERSIONED REPOSITORY'),
('Actions globale Einstellungen','Aktiviert/deaktiviert, Token-Defaults, Secrets und konkrete Event-/Actor-Policies nicht vollständig gelesen. Null Workflows bedeutet nicht Actions deaktiviert.','UNKNOWN'),
('CODEOWNERS / policy','Kein CODEOWNERS; kein forge/policy.json auf main. ReviewPolicy wird als KernelDeps übergeben, nicht aus einer vorhandenen Policy-Datei geladen.','VERIFIED · FACT FROM VERSIONED REPOSITORY'),
('Berechtigungen','forge-codex: write; Wuerfelduell: admin. Developer-Verbindung: admin=false, maintain=false, push=true.','VERIFIED · FACT FROM GITHUB'),
('Teams, Grant-Herkunft, andere Admins','Teamendpoint nicht zugänglich; vollständige Teammitgliedschaften, Custom Roles, Org-Vererbung, Deploy Keys und sämtliche weiteren Writer/Admins nicht nachgewiesen.','UNKNOWN'),
('Billing','Public ist belegt. Tatsächlicher GitHub-Free/Team-Billingplan ist nicht belegt.','UNKNOWN'),
('OPS / Format 2 / Freeze','Kein versionierter OPS-Ruleset-Plan, Format-2-Parser/Schema, PlayerRef-Freeze oder vollständiger Mystery-DAG in gelesenen main-/Remote-Branch-Dateien gefunden. Auch gezielte Suche nach bereitgestellten Planartefakten ergab keinen zugänglichen Treffer.','VERIFIED Suchumfang; UNKNOWN ungesehene Pläne')])
tab(['Remote-Branch','Head-SHA','Status'],[
('main',SHA,'VERIFIED · protected=false'),
('claude/forge-architecture-review-hjdq89','be40a6876aaba328d91c2ef1bbba0bc4263cfe3d','VERIFIED · protected=false'),
('codex/forge-core-v2-repair','0dfd90362b7d9f53c3626a90b579d835f76e7a20','VERIFIED · protected=false'),
('codex/mystery-task-0005','fab792afb4acb7d8bd709133829becd8d7e16aaf','VERIFIED · protected=false'),
('codex/task-0004-contract','6a8c0c5349eccaf12f45e3e9128b816f316d37a6','VERIFIED · protected=false'),
('forge/run/codex/IDENTITY-SPIKE-1',SPIKE,'VERIFIED · protected=false')])
p('VERIFIED','main enthält vier Forge-Core-Contract-Dokumente und TASK-0004, zwei Architektur-Approval-JSONs sowie fünf Review-/Mutation-Artefakte. Die zwei Approval-Hashes stimmen mit den heutigen exakten v1-Contract-Texten überein. Das belegt die Textbindung dieser Dateien, nicht die Authentifizierung ihrer Autoren oder einen akzeptierten aktuellen Forge-Run.','FACT FROM VERSIONED REPOSITORY / HISTORICAL ARTIFACT')
p('VERIFIED','Die Approval-Dateien heißen forge/approvals/FORGE-CORE-0001A.v1.architecture_review.json und FORGE-CORE-0001B.v1.architecture_review.json. Ihre Grundlage erklärt Vorautorisierung und fehlende unabhängige Prüfung des exakten Textes. forge/reviews/FORGE-CORE-0001B.v2.chatgpt-review.md ist ein historischer, durch den Owner übermittelter PASS für 811ed0d; kein GitHub-Review für PR #2 und kein aktueller, authentifizierter ForgeLog-Abnahmeeintrag. PR #1 und #2 haben in der Reviews API keine Reviews.','HISTORICAL ARTIFACT / FACT FROM GITHUB')
p('INFERRED','write bei ungeschütztem main lässt Developer main-Updates und normale Merge-Aktionen grundsätzlich zu. Das ist ein Startblocker für die beabsichtigte Rollenverteilung. Es wurde kein Testpush und kein Testmerge durchgeführt; eine tatsächlich ausgeführte missbräuchliche main-Schreiboperation ist nicht belegt.','INFERENCE')
end()

sec(2,'Identity Boundary')
tab(['Frage','Ergebnis','Evidenz'],[
('Branch existent / Head','Ja; '+SPIKE+' entspricht dem erwarteten historischen Head.','VERIFIED · Branch API + git ls-remote'),
('PR #2','Autor forge-codex, User-ID 337272506; draft=true; open; nicht merged; base=main am fixierten SHA.','VERIFIED · PR API'),
('Änderungen','changed_files=0; additions=0; deletions=0; files API []; ein leerer Commit, dessen Tree main entspricht.','VERIFIED · GitHub / Git-Tree'),
('Git author','Name forge-codex, E-Mail aus Commitmetadaten. Selbst deklarierbar.','VERIFIED Metadaten; kein Authentifizierungsnachweis'),
('Git committer','Ebenfalls forge-codex in den Gitmetadaten; Commit nicht signaturverifiziert.','VERIFIED Metadaten; kein Authentifizierungsnachweis'),
('PR author','GitHub-Account forge-codex.','VERIFIED · authentifizierte GitHub-PR-Zuordnung'),
('GitHub-attribuierter Pusher','Öffentlicher PushEvent 22872840439: actor forge-codex / 337272506; ref exakt Spike-Branch, head exakt '+SPIKE+'; before=main; 2026-10-03T10:12:55Z; push_id 45332667759.','VERIFIED · GitHub Events; unabhängig vom PR-Autor'),
('Konkreter authentifizierter Credential-Inhaber','PAT/OAuth/App/SSH/Deploy-Key, Tokenbesitzer, tatsächlicher Mensch oder Modell hinter dem Push nicht sichtbar. Der PushEvent beweist GitHubs Account-Attribution, keine Credential-Forensik.','UNKNOWN'),
('forge-codex / Wuerfelduell','write / admin, separat über Collaborator-Permission-Abfrage.','VERIFIED · GitHub')])
p('INFERRED','Der Spike bestätigt getrennte GitHub-Account-Zuordnung bei PR und Push. Er bestätigt weder main-Isolation noch Reviewer-Unabhängigkeit, vertrauenswürdige Checks oder eine implementierte Pipeline: Er enthält keinerlei Dateiänderungen.','INFERENCE')
p('VERIFIED','src/forge/identity.ts:5 erklärt Authentifizierung außerhalb des V0.0-Cores; :24–25 vergleicht deklarierte Identitäten; :33–39 prüft Provider-Unabhängigkeit deklarativ. events.ts:127–153 prüft Rollenfelder, bindet sie aber an keinen authentifizierten GitHub-Account.','FACT FROM VERSIONED REPOSITORY')
p('INFERRED','Vor dem ersten Run muss der Owner den echten GitHub-User-ID-/Rollenbezug und die Reviewer-Herkunft manuell bestätigen. Ein Benutzername im Event oder Commit ist keine ausreichende Autorisierung. Eine zukünftige Adaptergrenze darf actor/role nicht aus Developer-Eingaben übernehmen.')
end()

sec(3,'Current Forge-Core Security State')
p('VERIFIED','Es existiert eine reine TypeScript-Zustandsmaschine mit strikten Eingabeschemas, Hashbindung und evidenzbasierten Auswertungen. Es existiert kein implementierter GitHub-/Git-/Actions-Verifier, der diese Evidence unabhängig beschafft. Die nachfolgenden Bewertungen betreffen heutigen main, nicht alte Auditbehauptungen.','FACT FROM VERSIONED REPOSITORY')
tab(['Finding','Status','Heutiger Nachweis / Konsequenz'],[
('Developer-supplied changed files','PARTIALLY FIXED','VERIFIED: DeveloperReport hat kein changedFiles (runs.ts:45–53); nur VerificationEvidence (60–77). Herkunft/Komplettheit der Verifier-Liste bleibt ungeprüft. Rollenspoofing kann diese Grenze umgehen.'),
('Fake / duplicate green checks','PARTIALLY FIXED','VERIFIED: unique check names runs.ts:74–75, exakt ein Required-Check mit passendem command und exitCode=0 verification.ts:107–110. Fake-Green durch frei behauptete Evidence weiterhin OPEN; keine Prozess-/App-/Workflow-Provenienz.'),
('Test-config manipulation','OPEN','EXPERIMENTALLY VERIFIED: neue vitest.config.ts verkleinert npm test von 1087 auf 19 Tests, exit 0. Core kontrolliert keine Testbaseline. Strikte Pfad-Scope hilft nur bei vollständig ehrlicher Diff-Evidence.'),
('describe.skip / reduced suite','OPEN','EXPERIMENTALLY VERIFIED: describe.skip, test.skip und todo ergeben grünen Exit; gelöschte Testdatei reduziert auf 1068. Checkname und Exitcode beweisen die Suite nicht.'),
('Weak mutation smoke','OPEN','VERIFIED: verification.ts:38–46 fällt auf Developer-Mutationen zurück; :72–90 prüft keine im Contract benannten Pflichtmutanten. Verifier-Unabhängigkeit state.ts:189–191 nur Abfrage, nicht Voraussetzung :366–373. Ein unrelated mutant kann Mindestbedingung erfüllen.'),
('refs/replace','OPEN','VERIFIED: keinerlei Git-Ausführung/Replace-Abwehr im Core. EXPERIMENTALLY VERIFIED: ancestry ändert sich mit Replace-Ref; GIT_NO_REPLACE_OBJECTS=1 verhindert dies. Adapter erforderlich.'),
('Shallow ancestry','PARTIALLY FIXED','VERIFIED: ancestry.ts:11–21 folgt nur gelieferten Kanten, fehlende Kante führt nicht zum positiven Nachweis. Vollständigkeit/authentische Kanten werden nicht belegt. EXPERIMENTALLY VERIFIED: shallow Git-Anfrage exit 128; kein gültiger negativer/positiver Beweis.'),
('Second-parent injection','OPEN','VERIFIED: ancestry.ts:11–21 akzeptiert alle Parent-Kanten; start-gate.ts:90–95 nutzt normale Any-parent-Ancestry. EXPERIMENTALLY VERIFIED: Contract als zweiter Parent erfüllt merge-base --is-ancestor ohne First-parent-Zugehörigkeit.'),
('Contract merge commits','OPEN','VERIFIED: Contract-Registration state.ts:293–305 und Start-Gate prüfen keine Parentzahl/contract-only Commit-Diff. ContractCommit kann ein Merge sein. Alle historischen Main-Merges pauschal zu verbieten wäre die falsche Abhilfe.'),
('Stale review','PARTIALLY FIXED','VERIFIED: state.ts:388–405 bindet Review exakt an neuesten verifizierten Run und reviewedCommit; :416–423 bindet Acceptance daran. Kein frischer GitHub-Head-/Base-Abgleich vor Acceptance. Ein neuer Remote-Push ohne Event bleibt unsichtbar.'),
('Blocking findings forgotten','OPEN','EXPERIMENTALLY VERIFIED: request_changes mit blocking in Run 1, neuer Run 2 approve ohne Abschlussnachweis, Task akzeptiert; ebenfalls neue Contractrevision nach unresolved architecture finding. state.ts:305 / :213–235. Alte Findings bleiben im Log, aber blockieren nicht revisions-/runübergreifend.'),
('Owner impersonation','OPEN','EXPERIMENTALLY VERIFIED: anderer selbst deklarierter human/owner akzeptiert Task. state.ts:422 prüft nur human, nicht registrierten Owner oder GitHub-UID. events.ts:141–153 autorisiert lediglich Rollenstrings.'),
('Remote-observation ordering','PARTIALLY FIXED','EXPERIMENTALLY VERIFIED: Beobachtung vor Developer-Report wird abgewiesen; nach positivem Nachweis werden spätere Beobachtungen abgewiesen. state.ts:359–364 akzeptiert nur reported; runState :202–203 nutzt irgendeine positive Beobachtung.'),
('Deleted branch / stale push event','OPEN','EXPERIMENTALLY VERIFIED: nach positivem Nachweis wird head=null mit RUN_STATE_INVALID verworfen; anschließende Verification bleibt akzeptierbar. Kein Frischezeitpunkt/aktueller ref read. PushEvent ist historischer Nachweis, kein Ersatz für Branch API.'),
('Symlink 120000','OPEN','VERIFIED: ChangedFileSchema runs.ts:55–58 trägt keinen Tree-Modus. Ein erlaubter Pfad kann ohne Modusnachweis Symlink sein. EXPERIMENTALLY VERIFIED: Git-Tree kodiert 120000 als blob.'),
('Submodule / gitlink 160000','OPEN','VERIFIED: keine gitlink-/Submodule-Kontrolle im Core. EXPERIMENTALLY VERIFIED: ls-tree liefert 160000 commit; recursive submodule checkout wäre zusätzlicher fremder Code.'),
('File-mode changes','OPEN','VERIFIED: Mode fehlt in Evidence; 100644→100755 kann als allowed modified gelten. EXPERIMENTALLY VERIFIED: gleicher Blob, trotzdem raw diff M mit verschiedenen Modi.'),
('Case-insensitive collision','OPEN','VERIFIED: primitives.ts:14–20 erlaubt A und a; Duplikatprüfung exakt, keine casefold-Eindeutigkeit. EXPERIMENTALLY VERIFIED: Git speichert src/A.ts und src/a.ts nebeneinander. Auch Verzeichnispräfixe müssen geprüft werden.'),
('Unicode / path ambiguity','PARTIALLY FIXED','VERIFIED + EXPERIMENTALLY VERIFIED: ASCII-RepoPath verwirft café, combining variant, Backslash, ..-Segment. Git kann beide Unicodevarianten speichern. Raw-Pfade müssen vor Checkout vollständig geprüft werden; verlustbehaftete Dekodierung/Filterung könnte Befunde verstecken.'),
('Windows reserved paths','OPEN','EXPERIMENTALLY VERIFIED: src/CON.ts, src/NUL und src/a. akzeptiert. primitives.ts:14–20. Keine reale Windows-Checkout-Probe; Portabilitätsrisiko folgt aus fehlendem Profil.'),
('Protected-path delete / rename','FIXED','VERIFIED: verification.ts:49–69 verbietet alle Deletes und alle Renames außer beide Endpunkte unter forge/coordination/. contracts/approvals immer geschützt. Gilt für vollständige, unverfälschte Evidence und exakte Pfade; keine Behauptung einer gehärteten Dateisystemgrenze.'),
('Arbitrary status fields','PARTIALLY FIXED','VERIFIED: events.ts:127–132 strict, Status wird berechnet. applyEvent state.ts:437–442 klont jedoch frei gelieferten ForgeState. tests/forge-red-team/findings.test.ts:197–207 belegt gefälschte Projektion; replay aus vertrauenswürdigen Events korrigiert. Nur Kernel-produzierten State weitergeben.'),
('Eventlog trust assumptions','OPEN','VERIFIED: kein authentifizierter append-only Speicher, keine Signatur-/Sequenz-/Transport-Provenienz. recordedAt informational only, events.ts:130. Pure replay ist keine Integritätskontrolle des gelieferten Logs.'),
('Approve mit blocking finding','FIXED','VERIFIED: state.ts:318–319 Architektur und :395–398 Code-Review weisen inkonsistente approve/blocking zurück. Nicht mit carry-forward verwechseln.'),
('Zero-diff completion','OPEN','EXPERIMENTALLY VERIFIED: leere changedFiles mit grünen behaupteten Checks wird akzeptiert. Kein Nachweis erfüllter fachlicher AC durch Core. Für den Drill tatsächliche Änderung/Behavior durch unabhängige Review und Mutanten prüfen.'),
('Getter/Proxy hostile API object','NOT APPLICABLE TO V0.1','VERIFIED: Red-Team-Test :255–262 zeigt Ausnahme bei getter-behaftetem JS-Objekt. Erste Betriebsgrenze ausschließlich kontrolliert geparstes JSON, keine fremden JS-Objekte. DoS-/API-Härtung später; bei direkter In-process Nutzung wieder relevant.')])
p('INFERRED','P0 vor Start: main-Schreib-/Mergegrenze. P1 vor Acceptance: authentische Evidence, exakter frischer SHA, isolierte Ausführung, vollständiger Raw-Diff, Finding-Abschluss. Mode-/Pfadrisiken lassen sich im ersten Run durch konservative externe Prüfung schließen, ohne sofort sämtliche Kernschemas zu erweitern. Ein grüner Charakterisierungstest für eine bekannte Lücke ist keine behobene Lücke.')
end()

sec(4,'OPS / Ruleset Red Team')
p('UNKNOWN','Ein vollständiger aktueller OPS-Plan ist nicht als zugängliches versioniertes Artefakt vorhanden. H1/H2/H3/H8 werden daher als vom Nutzer beschriebene Planvarianten geprüft, nicht als heute aktive Konfiguration. Auf GitHub sind momentan keinerlei Rulesets aktiv.')
tab(['Konflikt','Bewertung','Minimale Konsequenz'],[
('H1: 0 approvals + Owner COMMENTED vs last-push approval','DOCUMENTED + INFERRED: real. COMMENTED ist keine APPROVED-Review. Last-push-Regel verlangt eine zulässige Approval durch einen anderen Account als den letzten Pusher; null numerische Approvals beseitigen diese Zusatzregel nicht.','Für den ersten Einzel-Owner-Betrieb last-push approval OFF, CODEOWNER approval OFF, required approvals 0. Unabhängige fachliche Review und exakt SHA-gebundene Owner-Abnahme extern/manuell.'),
('Owner authored Contract PR','INFERRED: Owner kann seine eigene PR nicht durch eigene GitHub-Approval freigeben; Developer-Approval als erforderliche Autorität würde die Rollenverteilung unterlaufen.','PR-Pflicht und Owner-Mergegrenze verwenden; fehlende GitHub-Approval-Zahl nicht durch Developer-Freigaben kaschieren.'),
('H2: universelles Delete-Verbot vs Ausnahmen','DOCUMENTED + INFERRED: ein Bypass gilt für das jeweilige Ruleset. Ein universelles Verbot und gleichzeitige garantierte Ausnahme passen ohne bewusstes Scoping/Bypass nicht zusammen.','Delete/force-push nur für main blockieren. Für Runbranches kein universelles Verbot; gelöschter Branch blockiert die frische Verifikation. SHA-/Packet-Evidence archivieren.'),
('H3: Owner-only dispatch vs Codex PR target','DOCUMENTED + INFERRED: globaler Actor-Filter nur Owner kann automatische Developer-Events ausschließen. workflow_dispatch ist nicht von selbst Owner-only.','Manuellen Owner-Dispatch und automatische PR-Prüfung getrennt erlauben/absichern. Nicht dieselbe globale Owner-only Bedingung vor alle Events setzen.'),
('H8: Reviewblob / Bootstrap-Hashes','VERIFIED Suchbefund + UNKNOWN Plan: im Repo keine vollständige Spezifikation des konkreten neuen Packets gefunden.','Kleines externes, bytegenau definiertes Packet genügt; Definition vor erster Abnahme, keine umfassende neue Plattform.'),
('Zusätzlicher Check-Lockout','DOCUMENTED + INFERRED: Required-Check vor existierendem geeigneten Run, Jobname-Kollision, Pathfilter oder falscher SHA können sämtliche PRs sperren.','Keine Required Checks vor demonstrierter Event-/SHA-/Source-Zuordnung. Kein Merge Queue Bootstrap.'),
('Owner-Bypass zu breit','DOCUMENTED + INFERRED: Owner-Bypass im selben Ruleset wie Integritätsregeln kann auch diese aushebeln. Ein Bypass für write würde forge-codex privilegieren.','Writergrenze und Integrität separat; kein Developer/App/write-role Bypass.'),
('Owner ohne Bypass','INFERRED: Restrict updates ohne zulässigen Updater/Merger sperrt auch Owner-Merges; Kombination mit allein unerfüllbarer Review-Regel erzeugt Lockout.','Expliziten eng begrenzten Owner-Pfad testen, Mitgliedschaft und wirksame Regeln vor Start unabhängig lesen.')])
doc('https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches','About protected branches: latest-push approval, stale reviews, successful/skipped/neutral')
doc('https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository','Creating rulesets: Team/Role/App bypass und For pull requests only')
p('INFERRED','Empfohlene minimale V0.1-Konfiguration: zwei branch rulesets ausschließlich für main. Die Trennung ist durch unterschiedliche Bypass-Anforderungen begründet; zusätzliche globale Contract-, Run-, Owner-Branch- und Push-Rulesets bringen für den ersten manuellen Run keinen nötigen Sicherheitsgewinn.','DESIGN ONLY / INFERENCE')
tab(['Ruleset','Regeln','Bypass'],[
('R1: main writer / merger gate','Restrict updates; nur Owner soll main über eine PR aktualisieren/mergen können.','Enges nicht geheimes Owner-Team mit nachgewiesen ausschließlich Wuerfelduell; For pull requests only. Kein Developer, keine write-role, keine allgemeine App. Alternative Admin-Rolle nur nach Prüfung aller Admins.'),
('R2: main integrity','Require pull request; 0 required approvals; last-push approval OFF; required CODEOWNERS OFF; restrict deletions; block force pushes. Noch keine Required Checks.','Kein Bypass. Owner kann PR normal mergen, ohne Integritätsschutz auszuhebeln. Admin kann Policies ändern: Owner bleibt bewusst vertrauenswürdig.')])
p('DOCUMENTED','Repository-Branch-Rulesets sind für öffentliche Repositories auch mit GitHub Free und Free for organizations verfügbar. Push-Rulesets haben andere Plan-/Sichtbarkeitsgrenzen; auf kostenpflichtige Datei-Pushregeln oder Enterprise-Funktionen muss diese minimale Konfiguration nicht bauen.')
doc('https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets','Available rules: Restrict updates, PR requirement, Free/public availability')
p('DOCUMENTED','Aktuelle GitHub-Dokumentation beschreibt eine Default-Event-Policy für öffentliche Repositories, die pull_request_target zunächst evaluiert und ab 02.11.2026 für betroffene Repositories durchsetzt. Eine vorhandene passende Event-Policy wird nicht ersetzt. Vor einem späteren automatischen Bootstrap muss die wirksame Repository-/Org-Policy gelesen werden.')
doc('https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target','Default pull_request_target policy; enforcement 02.11.2026')
p('UNKNOWN','Ob Forge heute unter diese Default-Policy fällt, welcher Actor-/Event-Policy-Mix aktiv ist und ob ein konkretes Owner-Team existiert, ist nicht nachgewiesen. Das ist kein Grund, Policies in diesem Audit zu aktivieren.')
p('INFERRED','Minimaler Packet-Vorschlag: repository ID; trusted main/verifier SHA; Task-/Run-ID; PR-Nummer; Head-Repo/-Ref/-SHA; Contract-Pfad, ContractCommit, Git-Blob-SHA und prefixed contentHash; baseCommit; Raw-Diff-Digest; Tool-/Baseline-/Inventar-Digest; Checks mit echten Prozesscodes und Report-Digest; benannte Mutation-Patches/Outcomes; Reviewer-Identität, reviewedCommit, Verdict, offene/geschlossene Findings; Owner-User-ID und acceptedHead. Raw-Reviewblob-Hash = SHA-256 der festgelegten UTF-8-Bytes. Packet-Hash = SHA-256 einer vorher festgelegten kanonischen JSON-Darstellung ohne eigenes Hashfeld. Review-/Packet-Selbstreferenz vermeiden. Das ist ein Vorschlag, keine heutige Forge-API.','DESIGN ONLY')
end()

sec(5,'Actions Verifier Threat Model')
p('UNKNOWN','Im Repository ist kein Workflow implementiert; kein Live-Actions-Experiment wurde ausgeführt. Folgende Plattformsemantik stammt aus der am Auditdatum gelesenen offiziellen Dokumentation. Ein Checkout anderer Dateien ändert nicht automatisch Workflow-Provenienz oder Check-Zuordnung.')
tab(['Event','Workflow / GITHUB_SHA','Token / PR-Code'],[
('pull_request','DOCUMENTED: Workflow aus PR-Mergecommit; SHA synthetischer refs/pull/N/merge Commit.','Fork normalerweise read-only Token, keine sonstigen Secrets. Same-repo PR nicht pauschal genauso eingeschränkt. PR-Code bei Checkout/Imports/Testbefehlen ausführbar.'),
('pull_request_target','DOCUMENTED: heutige Docs: Default-Branch des Base-Repos, SHA letzter Default-Branch-Commit.','Base-Token/Secrets möglich. Checkout von head.sha macht Code untrusted; nie privilegiert ausführen.'),
('workflow_dispatch','DOCUMENTED: Datei muss auf Default-Branch existieren; gewählter Ref bestimmt Run-Version/SHA.','Kein inhärentes Owner-only; Rights/Secrets laut Konfiguration. Nur trusted main dispatchen; PR-Head separat fixieren.'),
('workflow_run','DOCUMENTED: Default-Branch Workflow/SHA, nicht upstream head. requested entfällt bei Re-runs.','Kann Secrets/write erhalten, obwohl upstream unprivilegiert war. Upstream-Artefakte bleiben untrusted.')])
doc('https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows','Event reference; SHA/ref und workflow_run semantics')
p('DOCUMENTED','pull_request_target vertraut Default-Branch-Code. Ein anschließender Build/Test des eingecheckten PR-Heads öffnet die privilegierte Ausführungsgrenze wieder. Auch Konfigurationsdateien, Abhängigkeiten und Installationsskripte können Code ausführen. Secrets minimieren, Tokenrechte explizit setzen und fremde Artefakte nie privilegiert ausführen.')
doc('https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target','Trusted workflow versus untrusted checkout; privilege boundary')
p('INFERRED','Ein main-verankerter Controller darf Metadaten/Diffs prüfen und den exakten PR-Head als Daten erfassen. Tests laufen separat in frischer, isolierter Umgebung ohne Secrets, Schreibtoken, persistierte Checkout-Credentials oder wiederverwendbare interne Runner-/Cache-Zugänge. Controller-/Tooling-/Config-Dateien stammen aus gepinntem main; Candidate-Code wird nur im Worker ausgeführt. PR-Text nicht direkt als Shellprogramm interpolieren. Der Worker darf keine Owner-/Merge-Evidence schreiben. Bei jeder Ausführung werden actual checkout SHA und aktueller PR-Head verglichen.','DESIGN ONLY / INFERENCE')
p('DOCUMENTED','Re-runs verwenden Rechte des ursprünglich auslösenden Actors und denselben GITHUB_SHA/GITHUB_REF. Der Re-run-Actor erhöht diese Rechte nicht. Ein Re-run ist daher kein Nachweis des inzwischen neuesten Heads. Workflow/run ID, run attempt und geprüftes head SHA müssen separat erfasst werden.')
doc('https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs','Re-run actor privileges and original SHA/ref')
tab(['Check-Zuordnung','Befund / Grenze'],[
('pull_request Job','DOCUMENTED: Ereignis-SHA ist normalerweise der Merge-SHA. Exakter Head-Test erfordert head.sha Checkout und explizite Evidence; Required-Check-Bezug nicht aus Checkout ableiten.'),
('target / dispatch / run Job','INFERRED aus dokumentiertem SHA: Default-/Dispatch-SHA ist nicht automatisch der geprüfte PR-Head. Jobname allein transportiert keinen verlässlichen checkedHead.'),
('workflow_dispatch als Required Check','DOCUMENTED: solche Workflow-Jobchecks sind nicht PR-required-check-fähig, selbst bei Dispatch auf PR-Head. workflow_run ist ebenfalls nicht in der dokumentierten Liste zulässiger Job-Events.'),
('Externe GitHub App','DOCUMENTED: externe App-Checks unterliegen dieser Workflow-Eventbeschränkung nicht. head_sha und Quellen-App explizit festlegen; erst nach erfolgreichem Integrationsnachweis required schalten.'),
('Namen / Herkunft','INFERRED: feste eindeutige Job-/Check-Namen nötig, aber nicht ausreichend. GitHub Actions als Source-App allein unterscheidet keinen trusted main Workflow von gleichnamigem Developer-Workflow. Owner muss Workflow-/Run-Provenienz prüfen oder separate kontrollierte App verwenden.'),
('Skipped / neutral','DOCUMENTED: GitHub kann sie als erfüllte Required Checks zählen; Forge braucht tatsächlich ausgeführte Tests, nicht nur Mergebox grün.')])
doc('https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks','Eligible workflow events, dispatch limitation, exact SHA and check source')
p('INFERRED','Kleinster sicherer Bootstrap vor Run 1: externer, manuell vom Owner bedienter Verifier, gepinntes main, isolierter Candidate-Worker, frischer SHA-Abgleich und manuelle Abnahme. Dafür ist kein GitHub-Workflow erforderlich. Falls unmittelbar Automation nötig wird: trusted-main Owner-dispatch für Read-only-Verifikation, ohne Anspruch auf Required-Check-Erfüllung. Privilegierte Publisher-/workflow_run-Ketten und eine eigene App erst danach begründet hinzufügen.','DESIGN ONLY')
p('INFERRED','Sicherer Controllercode allein macht den JSON-Testreport eines beliebigen feindlichen Node-Prozesses nicht zu einem kryptographischen Wahrheitsbeweis. Für den begrenzten ersten Drill: alte Tests unverändert, Runner/Config gepinnt, tatsächliche Prozesse/Reports extern erfassen, Schreibmöglichkeiten begrenzen und den kleinen vollständigen Diff unabhängig auf Runtime-/Report-Manipulation prüfen. Keine automatische Abnahme nur aufgrund vom Candidate erzeugter JSON- oder Console-Ausgabe.')
end()

sec(6,'Test-Integrity Experiments')
p('EXPERIMENTALLY VERIFIED','Umgebung: Linux x64, Node 24.19.0, npm 11.9.0, Vitest 5.0.3, TypeScript 7.0.2, Zod 4.6.5. Frisches npm ci --ignore-scripts erfolgreich; npm run typecheck exit 0. Unveränderte Baseline: 22 Testdateien, 1087 expandierte Tests, 1087 passed, 0 failed/skipped/todo. JSON numTotalTestSuites=125 zählt auch describe-Strukturen und ist keine Dateizahl.')
tab(['Experiment','Ergebnis','Folgerung'],[
('A · Neue vitest.config.ts','EXPERIMENTALLY VERIFIED: include nur tests/forge/identity.test.ts; identisches npm test: 1 Datei, 19 passed, exit 0.','1068 Tests verschwinden aus der Ausführung, ohne roten Check.'),
('B · describe.skip / test.skip / todo','EXPERIMENTALLY VERIFIED: 4 Tests in Laborfixture; 1 passed, 2 skipped, 1 todo, exit 0. Übersprungene Tests enthielten absichtlich scheiternde Assertions.','Exit 0 verbietet skipped/todo nicht.'),
('B · Testdatei löschen','EXPERIMENTALLY VERIFIED: identity.test.ts entfernt; 21 Dateien, 1068 passed, exit 0.','Keine automatische Mindestbaseline.'),
('C · package.json test ersetzen','EXPERIMENTALLY VERIFIED: test="node -e ...process.exit(0)"; npm test exit 0 ohne Vitest.','Developer-test Script ist keine Verifier-Autorität.'),
('D · npm ci Lifecycle','EXPERIMENTALLY VERIFIED: harmloses Root-preinstall schreibt Marker; npm ci --offline startet es, exit 0, Marker existiert.','npm ci kann Candidate-Code schon vor Tests ausführen.'),
('E · --ignore-scripts','EXPERIMENTALLY VERIFIED: gleicher Install mit Flag, Marker fehlt, exit 0. Auf unverändertem Repo Tests und Typecheck vollständig erfolgreich.','Für aktuellen Linux-Run brauchbar. Tests/Imports selbst bleiben Codeausführung.'),
('E · Konkrete Dependency','VERIFIED: einziges hasInstallScript im Lock: optionales fsevents 2.3.3 für macOS, nicht Teil des Linux-Installationspfads.','UNKNOWN: vollständige macOS-/Windows-Verifikation wurde nicht durchgeführt.'),
('F · Vitest default list','EXPERIMENTALLY VERIFIED: statische JSON-Liste enthält 370 Definitionen statt 1087 expandierten Fällen.','Parametrisierte Tests werden nicht als vollständiges Laufzeitinventar expandiert.'),
('F · --no-static-parse','EXPERIMENTALLY VERIFIED: Baseline-Liste 1087; Skipfixture-Liste nur 1 aktiver Test, ausgelassene skipped/todo.','Liste allein ist kein vollständiger Integritätsnachweis; Sammlung führt Module/Imports aus.'),
('G · Baseline','VERIFIED aus echter Ausführung: Manifest enthält 1087 eindeutige file/fullName-Identitäten und Testdatei-SHA-256.','Exaktes Inventar plus Ausführungsstatus; bloß count>=1087 wäre durch Ersatztests umgehbar.')])
code('npm ci --ignore-scripts\nnpm run typecheck\nnpm test -- --reporter=json --outputFile=<absolute-report-path>\nnode node_modules/vitest/vitest.mjs list --json=<absolute-static-list-path>\nnode node_modules/vitest/vitest.mjs list --no-static-parse --json=<absolute-dynamic-list-path>')
p('INFERRED','Für den ersten Drill auf trusted main festhalten: main SHA; package.json/lock/tsconfig und alle bestehenden Tests/Fixtures/Helpers als Pfad+Blob+SHA-256; Versions-/Runnerprofil; exakte expandierte Testidentitäten mit Multiplizität und Status; vollständige Testdateiliste; Config-Dateien einschließlich der heutigen Abwesenheit von vitest/vite/workspace-Konfigurationen; .npmrc/.gitattributes/Loader/Setup-/Environment-Einflüsse; Pflichtmutanten mit IDs, Patchhash und erwarteten Zieltests. Neue Tests dürfen dazukommen, alte Fälle müssen unverändert aktiv bleiben. Zählung, Identität, Datei-Hash und Status gemeinsam prüfen.','DESIGN ONLY')
p('INFERRED','Trusted Verifier ruft den gepinnten Runner direkt mit eigener expliziter Config und eigener Include-Liste auf; er übernimmt keine Candidate-npm-Scripts. Für diesen Drill werden package/lock/config und sämtliche bestehenden Tests im Scope eingefroren. Neue Tests werden zusätzlich unabhängig reviewed. JSON muss parsebar und vollständig sein, 0 collection/runtime errors, erwartete Dateien/Identitäten, kein skipped/todo, reale Prozesscodes. Config-Abwesenheit ist eine überprüfbare Baseline, kein implizites Vertrauen in Autodiscovery.')
p('VERIFIED','Die 1087 grünen Tests umfassen auch Red-Team-Charakterisierungstests, die offene Grenzen als heutiges Verhalten festhalten. Dieses Audit zählt sie korrekt als erfolgreich ausgeführt, leitet daraus aber keine Behebung der charakterisierten Lücken ab.')
end()

sec(7,'Git-Integrity Experiments')
p('EXPERIMENTALLY VERIFIED','Git 2.51.1; Laborobjekte über commit-tree/mktree. Shallow-Probe verwendet echten file:// depth=1 Clone mit gültigem main-HEAD. Keine experimentellen Commits oder Replace-Refs im kanonischen Remote oder unveränderten Hauptcheckout.')
tab(['Fall','Laborergebnis','Autoritative Information / V0.1-Profil'],[
('GIT_NO_REPLACE_OBJECTS / refs/replace','EXPERIMENTALLY VERIFIED: fake ancestry exit 0 mit Replace; mit Flag exit 1.','Alle Git-Objekt-/Ancestry-Abfragen mit GIT_NO_REPLACE_OBJECTS=1; frischer eigener Clone; for-each-ref refs/replace/ als ergänzender Befund. Keine fremden lokalen Grafts/Hooks/Config übernehmen.'),
('Shallow clone','EXPERIMENTALLY VERIFIED: is-shallow=true; is-ancestor fehlender Commit exit 128; nach fetch --unshallow exit 0.','rev-parse --is-shallow-repository=false und vorhandene benötigte Commitobjekte; 0=bewiesen, 1=nicht ancestor, andere Codes=Fehler/UNKNOWN, nie positive Acceptance.'),
('merge-base','EXPERIMENTALLY VERIFIED: normaler DAG-Nachweis folgt allen Parents.','merge-base --is-ancestor BASE RESULT bei vollständigem unverändertem DAG. Allein kein Nachweis einer erlaubten Commitsequenz.'),
('Second parent','EXPERIMENTALLY VERIFIED: CONTRACT als zweiter Parent von RESULT: is-ancestor=0; --first-parent list enthält CONTRACT nicht.','cat-file -p / rev-list --parents für tatsächliche Parents; im neuen Contract..Result-Segment für ersten Drill keine Mergecommits erlauben. Historischen main-Merge akzeptieren.'),
('Contract merge','EXPERIMENTALLY VERIFIED: derselbe Merge kann als claimed ContractCommit Parentzahl 2 haben.','Git commit API parents oder raw commit; neuer ContractCommit genau 1 Parent, Contract-only-Diff, Base/Path/Blob/Text unabhängig prüfen.'),
('Symlink 120000','EXPERIMENTALLY VERIFIED: Tree liefert 120000 blob.','ls-tree -r -z --full-tree RESULT; kompletten Tree vor Checkout prüfen, im Drill nur reguläre 100644-Dateien.'),
('Gitlink 160000','EXPERIMENTALLY VERIFIED: Tree liefert 160000 commit.','Raw-Tree-Modus, kein rekursiver Submodule-Checkout; im Drill gitlinks untersagen. .gitmodules allein ist keine vollständige Erkennung.'),
('Mode-only','EXPERIMENTALLY VERIFIED: gleicher Blob, 100644→100755, raw diff M.','diff-tree --raw -z --no-renames BASE RESULT; beide Modi und beide Blob-IDs erfassen. Modeänderung im Drill untersagen.'),
('Rename vs no-renames','EXPERIMENTALLY VERIFIED: -M R100 a.txt→renamed.txt; --no-renames D/A.','Für ersten Drill --no-renames und jedes Delete verbieten. Das ist bewusst strenger als der Core bei coordination-Renames, keine semantisch identische Ersatzimplementierung.'),
('Casefold','EXPERIMENTALLY VERIFIED: src/A.ts und src/a.ts im selben Git-Tree.','Komplette Raw-Pfadliste; ASCII-casefold Eindeutigkeit auch aller Verzeichnispräfixe prüfen, nicht nur geänderte Dateien.'),
('Unicode','EXPERIMENTALLY VERIFIED: composed café.ts und decomposed café.ts sind getrennte Treeeinträge.','NUL-getrennte Raw-Bytes prüfen; V0.1 ASCII-Profil konservativ durchsetzen. Nicht normalisieren und dadurch zwei Pfade zusammenfallen lassen.'),
('Windows-Namen','EXPERIMENTALLY VERIFIED: Git akzeptiert CON, aux.txt, trailing dot/space. UNKNOWN: kein Windows-OS-Checkoutexperiment.','Vor Checkout reservierte Segmentstämme incl. Extension und trailing dot/space verbieten; Raw-Tree autoritativ, OS-Ergebnis keine Quelle der Pfadwahrheit.')])
code('GIT_NO_REPLACE_OBJECTS=1 git rev-parse --is-shallow-repository\nGIT_NO_REPLACE_OBJECTS=1 git cat-file -p "$CONTRACT_SHA"\nGIT_NO_REPLACE_OBJECTS=1 git merge-base --is-ancestor "$BASE_SHA" "$RESULT_SHA"\nGIT_NO_REPLACE_OBJECTS=1 git rev-list --parents "$CONTRACT_SHA..$RESULT_SHA"\nGIT_NO_REPLACE_OBJECTS=1 git ls-tree -r -z --full-tree "$RESULT_SHA"\nGIT_NO_REPLACE_OBJECTS=1 git diff-tree --no-commit-id -r --raw -z --no-renames "$CONTRACT_SHA" "$RESULT_SHA"\nGIT_NO_REPLACE_OBJECTS=1 git rev-parse "$CONTRACT_SHA:forge/contracts/<TASK-ID>.md"')
p('INFERRED','GitHub Compare/PR-files darf eine Gegenprüfung liefern, ist bei Pagination/Truncation oder heuristischen Renames aber nicht alleinige Scope-Wahrheit. Git Trees API muss bei truncated=true abgebrochen oder vollständig traversiert werden. Für ersten Run sind lokale vollständig gefetchte Objekte, Raw-Diff und frische GitHub-Ref-/PR-Abfrage am einfachsten. Keine quoted-path Textausgabe parsen, wenn -z verfügbar ist.')
p('VERIFIED','Aktueller main-Tree: 71 Dateien, sämtlich Modus 100644; keine nicht-ASCII Dateipfade und keine vollständigen file-path casefold-Duplikate in der unabhängigen Raw-Tree-Prüfung. Das widerlegt die generelle Verifier-Lücke nicht und belegt nicht sämtliche möglichen Verzeichnisaliasfälle.')
end()

sec(8,'Minimum Viable Verifier')
tab(['Stufe','Notwendig / vertretbar','Grenze'],[
('MUST BEFORE FIRST RUN','Developer kann main weder direkt ändern noch selber mergen; Owner-Account/Rollen explizit. Trusted main/Tooling/Baseline fixieren. Eine frische externe Verifikation statt Developer-Evidence.','INFERRED: Abnahmeblocker, kein optionales Nachhärten.'),
('MUST BEFORE FIRST RUN','Repository-ID, task/run, canonical Contractpath/commit/blob/contentHash, base und exakten PR-Head binden. Full clone, Replace aus, Parent-Profil, kompletter Raw-Diff/Tree vor Checkout.','INFERRED: falsche/fehlende Evidence fail closed.'),
('MUST BEFORE FIRST RUN','Alte Test-/Toolingbytes einfrieren; echte vollständige Suite+Typecheck; 0 skip/todo/collection errors; unabhängig angewandte benannte Mutanten; kein Developer-Mutation-Fallback als Abnahmegrund.','INFERRED: keine neue allgemeine Mutationsplattform nötig.'),
('MUST BEFORE FIRST RUN','Untrusted Candidate-Ausführung ohne Secrets/Schreibtoken, keine PR-Workflow-/lokale Action-/Lifecycle-Übernahme; unabhängige Review; alle blocking Findings explizit abgeschlossen.','INFERRED: manuelle Review des kleinen gesamten Diffs kompensiert keine privilegierte Ausführung.'),
('CAN BE MANUAL FOR FIRST RUN','CLI bedienen, GitHub Settings durch Owner setzen und lesen, frischen Head vergleichen, Packet bauen, Reviewer-Provenienz belegen, Finding-Ledger führen, Contract-Architekturfreigabe und Owner-Acceptance.','INFERRED: manual ist zulässig, unbewiesen ist es nicht.'),
('CAN BE MANUAL FOR FIRST RUN','Vor Merge Head/Base erneut lesen, expected-head Merge verwenden soweit verfügbar, Owner-main-Updates serialisieren; nach Merge accepted result ancestry/merge target prüfen.','INFERRED: neuen Head niemals durch bloßen Re-run oder alte Review freigeben.'),
('AFTER FIRST RUN','Beobachtete Abläufe gezielt automatisieren; SHA-/Source-korrekte Checks demonstrieren, dann Required Checks. Carry-forward/Observation-Refresh und authentifizierte Adapter in Core/Ops ergänzen.','INFERRED: Arbeit nach realem Durchlauf priorisieren.'),
('DEFER','Format 2, universelle Branch-Rulesets, umfassende UI/Queue, generische Providerorchestrierung, Full mutation engine, Vollautomatisierung sämtlicher Reports, GitHub-App nur aus Prinzip.','INFERRED: keine nötige Voraussetzung für den begrenzten ersten Drill.')])
p('INFERRED','Der Minimal-Verifier ist eine kleine vertrauenswürdige Prozedur mit extern erzeugter Evidence und kontrollierter Worker-Ausführung. Er darf die Candidate-Version des Forge-Cores nicht zur Entscheidung über die eigene Änderung verwenden. Ein Fix an RepoPath wird durch gepinnten alten Verifier plus konservatives externes Pfadprofil geprüft; anschließend wird die neue Funktion fachlich getestet. Acceptance bleibt beim authentifizierten Owner.')
p('UNKNOWN','Ein vollständig adversarial-sicheres Testattestationssystem ist heute nicht implementiert. Der vorgeschlagene erste Run beansprucht ausdrücklich keinen beweisbaren sicheren Automatismus für beliebige feindliche Node-Programme. Der begrenzte Scope und die unabhängige vollständige Review sind Teil des ersten Betriebsprofils.')
end()

sec(9,'Contract Pipeline Reality')
tab(['Aspekt','HEUTE','Design / benötigte Konsequenz'],[
('Format 1','VERIFIED: strict JSON-Frontmatter forgeContractFormat:1; contract-document.ts:24–34, :104–145.','Canonical JSON-Formatierung via JSON.stringify(raw,null,2), kein YAML und kein allgemeines JCS.'),
('Contract version / Format 2','VERIFIED: contractVersion ist separate positive Revision; B.v2 bleibt Format 1. UNKNOWN: kein zugängliches versioniertes Format-2-Schema/Parser.','Version 2 einer Contractdatei ist keine Format-2-Unterstützung. Neue Draft-APIs nicht benutzen.'),
('Contract hash','VERIFIED: SHA-256 UTF-8("forge-contract-v1\\n" + exakter Dokumenttext), contract-document.ts:12. LF, kein BOM/CR/unpaired surrogate; Body wird mitgehasht.','Nicht semantisch äquivalente Neuformatierung akzeptieren.'),
('Blob SHA','VERIFIED: Git-Blob-ID existiert im Tree, wird aber nicht als separates Contract-Metadatum gespeichert. contractCommit ist Eventfeld.','Unabhängig commit:path Blob lesen; SHA-1 Git-Objekt-ID ≠ prefixed SHA-256 Contract hash.'),
('End marker','VERIFIED: kein End-Marker-Requirement; leerer Body parsebar, Coreprobe.','Wenn gewünschte AC/End-Marker-Konvention fehlt, nicht behaupten sie werde geprüft. Für ersten Format-1-Contract manueller Textabschluss genügt.'),
('specifiedAgainst','VERIFIED: Feld nicht vorhanden; baseCommit existiert.','baseCommit präzise binden. Neuer Name würde strict schema nicht passieren.'),
('dependencies','VERIFIED: taskId + acceptedCommit nullable; approved gate verlangt echten akzeptierten identischen Commit, state.ts:320–324; start-gate.ts:93–95 Ancestry.','Keine historischen Tasks fiktiv als akzeptierten Kernelstate eintragen.'),
('reads','VERIFIED: nicht im Metadaten-Schema.','Benötigte Lesekontexte manuell dokumentieren; kein implementiertes reads-Enforcement behaupten.'),
('scope','VERIFIED: explizite create/modify-Pfade; keine Deletes; Verifier-Diff-Pflicht bleibt außerhalb Core.','Vollständige Raw-Evidence und konservatives Mode-/Pfadprofil nötig.'),
('required checks','VERIFIED: mindestens ein name/command-Paar; name eindeutig; Evidence verlangt passenden exit 0.','Commands werden nicht vom Core ausgeführt. Tatsächliche Prozess-/Inventarprüfung extern.'),
('mutants','VERIFIED: nur mutationSmoke enum, keine Liste spezifizierter Pflichtmutanten.','Für ersten Run manuell gebundene Mutantenliste plus unabhängige Durchführung; keinen neuen Draft-mutants-Key einschleusen.'),
('supersedes / findings carry-forward','VERIFIED: nicht im Schema; neue Revision fortlaufend, decisions=[]; kein finding closure Modell.','Manuelles unveränderliches Finding-Ledger und Re-review vor Abnahme; Historie nicht überschreiben.'),
('Start point','VERIFIED: Start vom contractCommit, baseCommit muss ancestor sein (start-gate.ts:90–101).','Contractpersistenz, trusted provenance und contract-only 1-parent commit durch Adapter/Owner prüfen.')])
tab(['Dokument auf main','Parser / Pfad','Bewertung'],[
('FORGE-CORE-0001A.md / B.md','EXPERIMENTALLY VERIFIED: Format 1 parsebar; jeweilige Contract-hashes passend zu Approval-JSONs.','HISTORICAL ARTIFACT mit realer Textbindung; kein neuer Run automatisch freigegeben.'),
('FORGE-CORE-0001A-PATCH-0001.md','EXPERIMENTALLY VERIFIED: Format 1, eigener Task-ID, parsebar.','HISTORICAL ARTIFACT; bestehenden Inhalt nicht umschreiben.'),
('FORGE-CORE-0001B.v2.md','EXPERIMENTALLY VERIFIED: Parser erkennt task B/version 2; VERIFIED: state.ts:302 verlangt forge/contracts/FORGE-CORE-0001B.md.','Sidecar ist kein unmittelbar registrierbarer canonical path. Alte Sidecar-Historie nicht durch fiktiven Pfad "reparieren".'),
('TASK-0004.md','EXPERIMENTALLY VERIFIED: FRONTMATTER_MISSING; Legacy-YAML statt Core-JSON.','Domainhistorie / DESIGN ONLY relativ zur heutigen Corepipeline, keine heutige Format-1-Registration.'),
('TASK-0005 v2 auf Mystery-Branch','VERIFIED: Legacy-YAML contract_version:2; base 1de7efeefccb8c0ab130b582d1389f7fc0f5ebf8; keine Umsetzung der Query-Policy.','HISTORICAL BRANCH / DESIGN ONLY, nicht heutiger main-Code.')])
p('INFERRED','Vor dem ersten Forge-managed Contract müssen nur ein neuer canonical Format-1-Contract, unabhängige exakte Textfreigabe, Contractpersistenz-/Blob-/Parentprüfung und ein kleiner vertrauenswürdiger Eventlog-/Acceptance-Betrieb konkret werden. Kein Format-2-Parser, keine Sidecar-Migration und keine Umschreibung früherer Artefakte notwendig. Der Drill startet ohne Dependencies; die historische Mystery-Kette wird nicht als verifizierter Acceptance-State importiert.')
end()

sec(10,'First Forge Run Recommendation')
p('INFERRED','Alle Umfangsschätzungen, Risiko-, Determinismus-, Contract-, Mutation- und Reviewbewertungen in der folgenden Vergleichstabelle sind unabhängige Einschätzungen. Sie beschreiben keine bereits verabschiedeten Contracts oder implementierten Folgefeatures.')
tab(['Kriterium','A · kleiner Forge-Core-Drill','B · PlayerRef V1','C · Accusation & Verdict'],[
('Produktionsumfang','INFERRED: 1 kleine Validatoränderung, 1 neue Testdatei; grob 10–30 Produktionszeilen.','INFERRED: Hash-/Namespace-/Registry-/Resolutionprofil; mehr Integrationsentscheidungen.','INFERRED: neuer fachlicher Evaluator, öffentliche/private Verdictgrenze und Fehler-/Feedbackprofil.'),
('Testumfang','INFERRED: bestehende 1087 einfrieren; etwa 30–80 neue parametrisierte Grenzfälle plus 3 Zielmutanten.','INFERRED: feste Vektoren, Typen/Entities, cross-package, Salt, Kollisionsinjektion, unknown refs.','INFERRED: truth-table Fälle incl. partial/undetermined, Duplikate, invalid refs, Feedbackleaks.'),
('Security-Risiko','Niedrig bis mittel: Core-Selbständerung; trusted verifier bleibt main-gepinnt.','Mittel: Opaque-Referenzen können Identitäten leaken oder Packagegrenzen überschreiten.','Höher: falsches Verdict bzw. Release kann versteckte Wahrheit preisgeben.'),
('Domain-Risiko','Niedrig; keine Mystery-Domainentscheidung.','Mittel: Entity-/Package-/Visibility-Semantik noch nicht versioniert gefroren.','Hoch: complete/partial/undetermined und Spielerfeedback sind fachlich zentral.'),
('Determinismus','Sehr hoch; reine Pfadvalidierung.','Hoch nur bei festem Packagecontext/Salt; Randomness beim Paketbau getrennt.','Hoch möglich ohne LLM; notwendiger öffentlicher Resolver fehlt aktuell.'),
('Contract-Eignung','Sehr hoch: explizite modify/create und klare positive/negative Fälle.','Gut nach Bindungs-/Encodingvertrag, heute nicht vollständig spezifiziert.','Derzeit unzureichend: aktuelle executable Contracts/API-Grenzen fehlen.'),
('Mutation-Eignung','Sehr hoch: reservierte Namen/case/extension handling gezielt durchbrechen.','Gut: Scopebinding, truncation, collision fail, entity-only Regeln.','Gut nach kanonischem Resolver; Tabellen nicht duplizieren.'),
('Review-Eignung','Sehr hoch: kleiner vollständiger Diff, leicht unabhängig prüfbar.','Mittel bis gut: konzeptionelle Entscheidungen dominieren kleine Implementierung.','Mittel: mehr versteckte Domainannahmen und Releasefolgen.'),
('Schaden bei Pipelinefehler','Begrenzte Validatorregression; kein Case-/Sessionzustand.','Falsche Referenzen, Namespaceleak, später schwierige Persistenzmigration.','Falsche Spielurteile oder irreversible Offenlegung der Lösung.')])
p('INFERRED','Empfehlung genau eines ersten Runs: **A — kleiner Forge-Core-Drill**. Konkreter Kandidat: RepoPathSchema verwirft Windows-reservierte Segmentstämme unabhängig von Groß-/Kleinschreibung und Extension sowie trailing dot. Modify ausschließlich src/forge/primitives.ts; create eine neue tests/forge/path-portability.test.ts. Dies ist ein Vorschlag für den nächsten Contract, keine in diesem Audit erzeugte Änderung.','DESIGN ONLY / INFERENCE')
p('INFERRED','Neu-ID erst global gegen bestehende Tasks/Branches/Contracts prüfen, z.B. FORGE-DRILL-0001 nur wenn frei. Base=aktuelles main bei Contractfreigabe, Dependencies=[]; alte Testbytes und package/lock/config unverändert. Drei extern spezifizierte Mutanten: Reserved-stem-Sperre entfernen, Caseprüfung abschwächen, Extension-Behandlung entfernen. Jeder muss an Zielassertions scheitern; Compile-/Installfehler sind kein fachlicher Kill. Unabhängige Review vom Developer-Provider getrennt, Owner nimmt exakt den geprüften SHA ab.')
end()

sec(11,'Mystery Cross-Check')
p('VERIFIED','Der Prüfgegenstand ist die Mystery-Domain innerhalb des kanonischen Forge-Repositories. Ein getrenntes Mystery-Repository oder eine aktuelle vollständige externe Architektur-Freeze-Datei war nicht zugänglich. Nichtauffindbarkeit beweist nicht Nichtexistenz.','FACT FROM VERSIONED REPOSITORY / UNKNOWN external state')
tab(['Schnittstelle','Heutiger Zustand','Wichtige Grenze'],[
('CaseTruth','VERIFIED: src/domain/case-truth.ts strukturelle Schemas, Entity-IDs und Referenzprüfung; :3–6, :20–29, :235–340.','Keine vollständige Spielbarkeit-/Solvabilitygarantie aus Parser ableiten.'),
('Semantic Validation','VERIFIED: case-semantics.ts:3–31; acht Findingcodes zu räumlicher/Claim-/Kausalitätskonsistenz.','Keine neue Behauptung über Motive, Red Herrings oder spielerische Lösbarkeit.'),
('CaseSolution','VERIFIED: case-solution.ts:163–173 Case-/Truthhashbinding, :255–266 required conclusions; :126–151 privater Resolver true/false/undetermined.','resolveConclusion und claimKey :154–158 sind NICHT exportierte öffentliche APIs. Draft darf sie nicht als vorhandene Integration aufrufen.'),
('NPC Knowledge','VERIFIED: npc-knowledge.ts:130–163 Bindungen, :257–259 Faktizität; :66–79 keine conclusion knowledge; :271–273 Duplicateclaims.','Knowledge/Acquisition/Projection nicht pauschal als Discovery oder DialoguePolicy ausgeben.'),
('Projection','VERIFIED: npc-knowledge.projection.ts:17–20 VisibleRef {kind,index}; :27–36 neun Claimtypen; :180–185 lokale Indizes nach sortierter sichtbarer Teilmenge.','VisibleRef ist kontextlokal; bei anderem Kontext andere Zuordnung. Kein stabiler package-bound PlayerRef.'),
('Accusation / Verdict','VERIFIED Suchbefund: keine Implementierung auf main. UNKNOWN vollständiger ungesehener Designvertrag.','Private Solutionprüfung ist kein bereits vorhandenes Spieler-Verdictmodul.'),
('Evidence Discovery / DialoguePolicy / Interrogation / Release','VERIFIED Suchbefund: nicht als diese vollständigen Features implementiert. TASK-0005 Query-Policy teilweise historisch designed.','Querydesign/Projection ist kein Beweis sämtlicher Folgefeatures.'),
('PlayerRef / CasePackage / Session / Replay','VERIFIED Suchbefund: keine entsprechenden implementierten main-Module oder zugänglichen ausführbaren Contracts.','Keine APIs/Dependency-Acceptances erfinden. VS-5 heute nicht ausführbar.')])
p('VERIFIED','TASK-0005.v2.architecture-review.md auf claude/forge-architecture-review-hjdq89 enthält historischen APPROVE gebunden an Blob 1e6f36e56ca439e50502ec1717b8e842499bf115; die Query-Spezifikation liegt auf codex/mystery-task-0005, Contractcommit 0453f85ad2ccb557a1f215e8bb912655597588fa. main enthält nur die ältere TASK-0005.architecture-review.md mit REQUEST_CHANGES. Das sind unabhängige Branchartefakte, keine heutige Implementierung auf main.','HISTORICAL ARTIFACT / DESIGN ONLY')
tab(['PlayerRef-Entscheidung aus Nutzerbriefing','Prüfung','Vor einem V1-Contract festlegen'],[
('opaque / entity-only','INFERRED: sinnvoll. Interne IDs sind strukturierte Prefix-/Slug-IDs; ungehashte IDs nicht exportieren.','Erlaubte Entities person/location/item/event/evidence; Proposition/Conclusion/Relationship/hidden descriptors nicht automatisch als Entity-Ref behandeln.'),
('deterministic / package-bound','INFERRED: mapping mit festem Kontext/Salt deterministisch; neue Saltgenerierung darf nicht pro resolution/Replay passieren.','Versionierter Namespace, unveränderliche Packagebindung, Membershipprüfung, Saltpersistenz und erlaubte Eingaben.'),
('128-bit salt','INFERRED: pro Package einmal 16 zufällige Bytes; Encoding exakt definieren.','Salt und Reversemap privat halten, wenn opacity gegen Wörterbuchangriff schützen soll. Öffentliche Salt + erratbare Entity-IDs erlaubt Offline-Raten; Salt ist keine Autorisierung.'),
('80-bit truncated hash','INFERRED: vertretbar für begrenzte Entitymengen bei hartem Kollisionsabbruch. 80 Bit = 20 Hexzeichen, sofern Hexencoding gewählt.','Algorithmus und domain separator, eindeutige typ-/längenbasierte Inputencoding, Truncation/Outputprofil und Testvektoren festlegen.'),
('collision = hard failure','INFERRED: richtig; nicht neu würfeln, reindexieren oder still weiter truncieren.','Injizierbarer Hashport für erzwungene Kollisionstests; auch gleiche Entity doppelt vs zwei verschiedene Entities klar trennen.'),
('resolution != authorization','INFERRED: notwendige Grenze. Mapping darf nur Identität auflösen.','Session/Discovery/Release entscheiden getrennt, ob Spieler Entity kennen/verwenden darf. Refbesitz ist keine Freigabe.'),
('Unabhängig vor CasePackage?','INFERRED: reine Mappingbibliothek kann vor dem vollständigen CasePackage implementiert werden; vollständige Integration braucht vorher einen kleinen stabilen Bindungsvertrag.','Keine nicht vorhandene CasePackage API importieren. Minimaldescriptor mit namespace/version/source binding und privater registry freeze; Hash-Selbstreferenz vermeiden.')])
p('INFERRED','Bei n=10000 Referenzen beträgt die Birthday-Näherung n(n−1)/2^81 etwa 4,14×10^-17. Das ist eine Wahrscheinlichkeitsbewertung unter idealer Hashannahme, kein experimenteller Kollisionsnachweis und keine Berechtigungsstärke. Ein Hard-fail schützt die Datenintegrität trotz Restwahrscheinlichkeit.')
p('VERIFIED','case-truth.identity.ts:4–9, :17–38 sortiert sämtliche Arrays als Mengen und normalisiert Strings nicht. Dieses Domain-Hashprofil ist nicht als Session-/Replay-Canonicalization verwendbar: eine geordnete Kommandofolge würde ihre Reihenfolge verlieren.','FACT FROM VERSIONED REPOSITORY')
p('INFERRED','Für PlayerRef muss vorab klar sein, was Packageidentität umfasst: unveränderlicher Namespace plus relevante Truth-/Payloadbindung; der Packagehash darf nicht zugleich Input für die Referenzen und Hash eines Dokuments mit eben diesen Referenzen sein. Freeze eines kleinen independent Binding-Descriptors beseitigt die Zirkularität, ohne zuerst das gesamte CasePackage zu bauen. Falls opacity Bestandteil des Spielerschutzes ist, bleiben Lösung und Registry serverseitig/privat; eine komplett öffentlich ausgelieferte Truth/Registry kann durch opaque Namen nicht geheim werden.')
p('UNKNOWN','Die vollständige vorhandene externe Dependency-Struktur ist nicht verifiziert. Deshalb keine neue Mystery-Roadmap und kein erfundener harter PlayerRef→Accusation-Zwang: ein interner Verdictkern könnte unabhängig von PlayerRefs sein, die Player-Schnittstelle nicht. Session/Replay darf nur auf tatsächlich vorhandenen, freigegebenen Package-/Command-/State-APIs aufsetzen.')
end()

sec(12,'Claude-Plan Review Checklist')
p('INFERRED','Diese Checkliste prüft Claudes späteren Plan unabhängig. Kein Claude-Ergebnis wurde als Autorität verwendet. Jede positive Implementierungsbehauptung braucht main-SHA plus Datei/Export/Test; jede Designbehauptung eine ausdrücklich als Design markierte Quelle.')
bullets('INFERRED',[
'Behauptet der Plan Accusation, Verdict, PlayerRef, CasePackage, Discovery oder Session als implementiert, obwohl nur Design/Branch/Review vorliegt?',
'Bindet er jeden Start an aktuellen main-SHA und echte Kernel-/Owner-Acceptances statt historische Branchheads?',
'Startet VS-5 vor realen Package-/Command-/State-/Release-Dependencies? Sind konkrete benötigte Exporte vorhanden?',
'Erfindet er öffentliche resolveConclusion, claimKey, CasePackage oder Format-2-APIs? Private Funktion und Draftname sind keine API.',
'Verwechselt er contractVersion=2 mit forgeContractFormat=2 oder die B.v2-Sidecar mit registrierbarem canonical path?',
'Baut er vor Run 1 unnötig Queue, UI, App, globale Rulesets und allgemeines Mutationframework statt bounded Drill?',
'Aktiviert er Required Checks, bevor Event-Eignung, Source-App/Workflow und Head-/Merge-SHA demonstriert sind? Reicht sein dispatch Check laut aktueller GitHub-Semantik wirklich?',
'Vertraut er Developer-check JSON, mutations oder changedFiles ohne unabhängige Prozesse, Raw-Diff und vollständiges Testinventar?',
'Nutzt er PR-Workflow, Candidate Config/npm test oder privileged pull_request_target/workflow_run Checkout für untrusted Code?',
'Prüft er npm ci Lifecycle, geteilte Caches, Credentials und wiederverwendete Runner als Ausführungsgrenze?',
'Vergisst er blocking Findings zwischen Runs/Revisions oder bezeichnet alte positive Remote-Observation als frischen Branchzustand?',
'Dupliziert er kanonische Truth Tables statt einen kleinen explicit public Resolververtrag zu spezifizieren?',
'Vermischt er PlayerRef resolution mit Authorization, Discovery oder Sichtbarkeit?',
'Definiert er Packagebindung/Salt/Encoding/Kollisionsabbruch ohne Hash-Selbstreferenz und ohne öffentliche Dictionary-Leaks?',
'Nimmt er lokale VisibleRef {kind,index} irrtümlich als stabile package-bound PlayerRefs?',
'Lässt er Developer und Reviewer beim selben Provider ohne ausdrückliche Policybegründung? Behauptet er Modell-/Provider-Unabhängigkeit aus GitHub-Usernamen?',
'Ignoriert er Task-ID-Kollisionen über Forge/Mystery/Historie/Branches oder registriert er alte Domainaufgaben fiktiv als akzeptiert?',
'Verwechselt er PR-Autor, commit author/committer und authentifizierten Pusher? Markiert er nicht nachweisbare Credentialherkunft UNKNOWN?',
'Hat Owner einen tatsächlich erfüllbaren Mergepfad, ohne Developer-main-Merge oder pauschalen Integrity-Bypass?',
'Schreibt er historische Artefakte um oder behandelt er fremde Nachtberichte als Implementierungsbeweis?'])
end()

sec(13,'Failure Budget')
tab(['Ereignis','Klassifikation','Reaktion / Bedeutung'],[
('GitHub UI Setting fehlt / 403 Detailzugriff','INFERRED: Bootstrapproblem','Owner liest wirksame Regeln mit ausreichendem Account; Start pausiert, kein Konzeptversagen.'),
('Reviewerpacket manuell gebaut','INFERRED: erlaubter manueller Schritt','Exact SHA/Hashes/Identität müssen stimmen; manuell ist für Run 1 vorgesehen.'),
('Absichtlicher Scope-Verstoß wird erkannt','INFERRED: erfolgreicher Sicherheitstest','Run abweisen; positives Ergebnis des Verifierkonzepts.'),
('Workflow muss einmal angepasst werden','INFERRED: Bootstrapproblem','Solange kein untrusted privileged Code lief und kein falscher Run akzeptiert wurde. Für Run 1 Workflow optional.'),
('Developer produziert roten Test / surviving mutant','INFERRED: erwartbare Runfehlleistung','Abweisen, Findings festhalten, begrenzter Rework; Forge-Konzept bleibt bestehen.'),
('Config-/skip-/fehlende Testfälle werden entdeckt','INFERRED: erfolgreiche Integritätskontrolle','Kein Merge; Verhalten zeigt Schutzmechanismus, nicht Architekturversagen.'),
('Runtime/Installationsprofil funktioniert nicht','INFERRED: Bootstrapproblem','Kontrolliert profilieren; Fehlversuch niemals als grün reporten.'),
('Developer kann heute main schreiben','VERIFIED permission + INFERRED Wirkung: aktueller Konfigurationsblocker','Vor erstem Run schließen. Wenn während realem Run ungeprüfte Developer-main-Schreib-/Mergeoperation möglich bleibt: echter Trust-Boundary-Fehler.'),
('Developer kann sich selbst fachlich approven / Owner imitieren','INFERRED: echter Autorisierungsfehler','Selbstdeklarierte Rolle/anderer Name darf nie ausreichend sein. GitHub verhindert eigene PR-Approval nicht die gefälschte Core-Identität.'),
('Falscher/staler SHA wird akzeptiert','INFERRED: echter Architektur-/Betriebsfehler','Acceptance stoppen, Ursache beheben; Review/Verifier/Owner müssen dasselbe frische Headobjekt meinen.'),
('Roter Test wird als grün akzeptiert','INFERRED: echter Evidence-Vertrauensfehler','Keine automatische Abnahme, Provenienz/Prozess-/Inventarprüfung korrigieren.'),
('Blocking Findings werden bei neuem Run vergessen','INFERRED: echter Abnahmefehler','Manuelles Finding-Ledger ist vor Run 1 Pflicht; spätere Kernmodelländerung gezielt.'),
('Privileged PR-Code exfiltriert Secret / schreibt main','INFERRED: kritischer Ausführungsgrenzenfehler','Nicht durch "Workflow einmal anpassen" bagatellisieren; Incidentbehandlung notwendig.'),
('Zweiter Review-/Contractversuch nötig','INFERRED: normaler Prozess','Ein ehrliches request_changes/Rework beweist nicht, dass Forge gescheitert ist.')])
p('INFERRED','Manuell bleiben dürfen Authentifizierungsbeleg, Settings, Contract-/Reviewpacket, kleine Mutationpatches, frische Refabfrage, Findingabschluss und Ownermerge. Nicht manuell "weginterpretieren" darf man fehlende Testausführung, falsche SHA-Bindung, unbekannte Rollenherkunft oder offenes blocking. Der erste Run testet einen begrenzten, vertrauenswürdig bedienten Prozess; er ist kein Versprechen universeller Vollautomatik.')
end()

sec(14,'GO / NO-GO Matrix')
tab(['Bereich','Empfehlung jetzt','Exakte Grenze'],[
('A · Forge V0.1 Implementation','**GO WITH BLOCKERS**','INFERRED: minimale Bootstrap-/Adapterarbeit beginnen; heutiger Core ist implementiert, autonomer sicherer Betrieb nicht. main-Grenze und unabhängige Evidence vor Ausführung schließen.'),
('B · First Forge Drill','**GO WITH BLOCKERS**','INFERRED: empfohlen als erster realer Run, sobald Aktionen 1–3 konkret abgeschlossen sind. Kein Start mit heutiger ungeschützter main-/Evidence-Grenze.'),
('C · PlayerRef V1','**GO WITH BLOCKERS**','INFERRED: nach Drill, vor Code minimalen Packagebinding-/Salt-/Encoding-/Registryvertrag freeze. Reiner Mapper kann vor vollständigem CasePackage entstehen.'),
('D · Accusation & Verdict','**NO-GO**','INFERRED: als unmittelbar nächster Forge-managed Implementierungsrun derzeit nicht ausreichend spezifiziert/API-gebunden. Kanonischer Resolver ist privat, Verdict-/Releasevertrag nicht verifiziert. Designarbeit möglich.'),
('E · VS-5 Session/Replay','**NO-GO**','INFERRED: heutige main enthält keine nötige ausführbare Package-/Session-/Replayoberfläche oder freigegebene Abhängigkeitskette. Keine fiktiven APIs und keine ordnungszerstörende CaseTruth-Hashübernahme.')])
p('INFERRED','GO WITH BLOCKERS bedeutet hier ausdrücklich: begrenzte Vorbereitung ist sinnvoll; der reale Run darf erst nach belegtem Abschluss seiner Blocker beginnen. NO-GO bezieht sich auf einen heute sofort startbaren Forge-managed Implementierungsrun, nicht auf die grundsätzliche fachliche Eignung des Features.')
end()

sec(15,'Exact Next 5 Actions')
parts.append('<ol class="actions">')
for x in [
'**Owner schließt die main-Grenze.** Zwei minimale main-only Rulesets wie Abschnitt 4; engen Owner-Bypass und reale Team-/Adminmitgliedschaft verifizieren. forge-codex behält write für Arbeitsbranches, erhält keinen main-Update-/Merge-/Ruleset-Bypass. Wirksame Regeln danach unabhängig lesen. Keine dieser Änderungen erfolgte im Audit.',
'**Trusted externen Minimal-Verifier und Baseline fixieren.** Aktuelles main erneut pinnen; 22 alte Testdateien/1087 Fälle, Tooling-/Configprofil, Full-Git-/Raw-Tree-/SHA-Prüfung und isolierten Worker festlegen. Absichtliche Scope-, Skip-, Config-, Fake-Green-/SHA- und Modefehler müssen abgewiesen werden. Für Run 1 manuell bedienbar; keine Required Checks nötig.',
'**Neuen Format-1-Drillcontract freigeben.** Freie Task-ID global prüfen, canonical Pfad, aktueller Base-SHA, keine Dependencies, ausschließlich primitives.ts plus neue Portabilitätstestdatei; Pflichtchecks und drei extern gebundene Mutanten. Unabhängige Architecture Review exact-text/hash; Contract-only 1-parent Commit und Finding-Ledger. Keine alten Dokumente migrieren oder überschreiben.',
'**Genau einen Drill ausführen und abnehmen.** forge-codex implementiert begrenzte Pfadvalidierung auf eigenem Branch/PR; Verifier prüft frischen exact head, vollständige Suite und eigene Mutanten; anderer Provider reviewed vollständigen Diff. Owner akzeptiert/merged nur denselben Head nach erneutem Ref-/Basecheck und dokumentiert accepted result. Bei blocking/red/unknown kein Merge.',
'**Drillergebnis auswerten und PlayerRef-Bindungsvertrag einfrieren.** Nur beobachtete Bootstraplücken nacharbeiten; Namespace/Packagebinding/Salt/Encoding/private Registry/Kollision/Resolutiongrenze für PlayerRef V1 konkret freigeben. Accusation/VS-5 bleiben an echte fehlende API-/Dependencyfreigaben gebunden. Keine neue umfassende Mystery-Roadmap und keine vorschnelle Required-Check-Aktivierung.'
]:parts.append('<li><span class="badge">INFERRED · DESIGN ONLY</span> '+inline(x)+'</li>')
parts.append('</ol>');end()

sec(16,'Evidence Appendix')
p('VERIFIED','Rekonstruktion erfolgte aus aktuellen GitHub-GETs und vollständig lokal gelesenen fixierten Repositoryobjekten. Authentifizierte Abfragen wurden über getrennte Owner-/Developer-Verbindungen verwendet; öffentliche Actions-/Rules-/Event-GETs lieferten ergänzende Nachweise. Keine Testmutation gegen GitHub. Snapshot ist kein atomarer GitHub-Gesamtzustand: final um 19:14:54 UTC erneut gelesen wurden Repositorymetadaten, alle sechs Branches inklusive main, offene PRs, PR #2 und Rulesets; die weiteren Felder stammen aus den Abfragen desselben Auditlaufs.')
tab(['Evidence-ID','Quelle / Methode','Reproduzierbarer Kern'],[
('GH-1','GET /repos/Forge-Dice/Forge','repo ID, public, default branch, merge methods, permissions'),
('GH-2','GET /branches?per_page=100 und git ls-remote --heads','6 Branches und SHA-Bindung'),
('GH-3','GET /pulls?state=open&per_page=100; /pulls/2; /pulls/2/files; /pulls/2/reviews','ein Draft, exakter Head/Base, empty diff'),
('GH-4','GET /rulesets?includes_parents=true; /rules/branches/main; /branches/main','[] / [] / protected=false; protection detail 403 separat'),
('GH-5','GET /actions/workflows und /actions/runs','je total_count=0'),
('GH-6','Collaborator permission forge-codex / Wuerfelduell','write / admin'),
('GH-7','GET /events; Match repo ID, ref, before/head und actor','PushEvent 22872840439, push_id 45332667759'),
('CODE-1','git checkout --detach '+SHA+'; rg / nl -ba; Git raw tree','Current-main Code und Zeilenangaben; kein AGENTS.md im Prüfbaum'),
('TEST-1','npm ci --ignore-scripts; typecheck; baseline JSON','1087 passed, 22 files, 0 skipped/todo'),
('TEST-2','Wegwerfkopie, experiments/test-integrity.py','Config19; deleted1068; skip/todo exit0; script/lifecycle/inventory Tests'),
('CORE-1','Wegwerfkopie, audit-core-probe.ts, bestehende Fixtures','Owner impersonation, carry-forward, stale observation, path/parser Probes'),
('GIT-1','experiments/git-integrity.py, Wegwerfrepos','replace/shallow/parents/modes/rename/raw paths'),
('DOC-1','Offizielle aktuelle GitHub-Dokumentation','Plattformsemantik; keine live Workflowprüfung'),
('UNKNOWN-1','Nicht lesbare/fehlende Quellen','vollständige Teams/Admins, Credentialmechanismus, Billing, konkrete Actions-Policies, externe OPS/Format2/Mystery-Freeze/DAG')])
tab(['Contract','Git-Blob-SHA','Prefixed contentHash SHA-256'],[
('A v1','69cc0546559feb8d0e40b6b0ffa438e6ea861a50','af91442ec38f712076648da97464c887e4925819c13838afe1fd7923b8fc4c69'),
('B v1','333caeb2c651484b9a15baa4ba9a1b4893ae77d8','680db30f45ca77b449fa0565d94db11475135f42c871ad589f5445355f279f6d'),
('B v2 Sidecar','82d5def8d062eff65f851064b0e0297dca3a8cf8','7db0e7220ea674b39282b79235a42d51759907c44f1e31b4e7fe56b03e863bd6'),
('A PATCH-0001','3aca828281c3866ebbe8b6bfa7f919302b5e695f','3e9125a53525a982dd23941ba390089a14ef231f863e1243c3104343825181ad')])
p('VERIFIED','Unveränderliche Codequellen: alle folgenden Links zeigen exakt den auditierten main-SHA, nicht moving main. Das Evidencearchiv im Dokument enthält die kompakten Laborergebnisse, vollständige Baseline-Identitäten, Reproduktionsquelltexte und SHA-256-Digests der zugrunde liegenden lokalen Evidence-Dateien.')
for f in ['src/forge/identity.ts','src/forge/events.ts','src/forge/primitives.ts','src/forge/runs.ts','src/forge/ancestry.ts','src/forge/verification.ts','src/forge/state.ts','src/forge/start-gate.ts','src/forge/contract-document.ts','tests/forge-red-team/findings.test.ts','src/domain/case-truth.ts','src/domain/case-semantics.ts','src/domain/case-solution.ts','src/domain/npc-knowledge.ts','src/domain/npc-knowledge.projection.ts','src/domain/case-truth.identity.ts']:
    parts.append('<a class="file" href="https://github.com/Forge-Dice/Forge/blob/'+SHA+'/'+f+'">'+esc(f)+'</a>')
parts.append('<h3>Evidencearchiv · aufklappbar</h3>')
for name in ['github-closing.json','core-probe.json','test-experiments-summary.json','git-experiments.json','test-baseline-manifest.json','github-permissions.json','public-actions-workflows.json','public-rules-branches-main.json']:
    data=(E/name).read_text()
    parts.append('<details><summary>'+esc(name)+' · SHA-256 '+hashlib.sha256((E/name).read_bytes()).hexdigest()+'</summary><pre>'+esc(data)+'</pre></details>')
events=json.loads((E/'public-events.json').read_text())
if isinstance(events,dict): events=events.get('events',events.get('data',[]))
matches=[x for x in events if x.get('id')=='22872840439']
parts.append('<details><summary>GH-7 · exakter GitHub PushEvent</summary><pre>'+esc(json.dumps(matches,indent=2,ensure_ascii=False))+'</pre></details>')
for f in [ROOT/'experiments/test-integrity.py',ROOT/'experiments/git-integrity.py',ROOT/'experiments/forge/audit-core-probe.ts']:
    parts.append('<details><summary>Reproduktion · '+esc(f.name)+'</summary><pre>'+esc(f.read_text())+'</pre></details>')
digests=[]
for f in sorted(E.iterdir()):
    if f.is_file() and f.name!='helper-location.txt':digests.append((f.name,str(f.stat().st_size),hashlib.sha256(f.read_bytes()).hexdigest()))
tab(['Lokale Evidence-Datei','Bytes','SHA-256'],digests)
p('UNKNOWN','Nicht ausgeführt: echte Windows/macOS-Installation, Angriff gegen GitHub, Settings-/Ruleset-Writeprobe, Secret-/Runnerinspection, Liveworkflow-/Check-Publishing-Experiment, Credential-/Org-Auditlogforensik. Nicht vorliegende Claude-/OPS-/Mystery-Designunterlagen wurden nicht rekonstruiert oder als Tatsachen ausgegeben.')
p('VERIFIED','Audit abgeschlossen. Keine Implementierung, keine kanonische Änderung; nach Übergabe dieses Berichts endet die Arbeit.')
end()

style='''body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#192b37;background:#f3f6f8;margin:0;line-height:1.6}main{max-width:1200px;margin:auto;padding:40px 34px 70px;background:white}h1{font-size:34px;line-height:1.15;color:#12374a;margin-bottom:14px}h2{font-size:25px;color:#12374a;border-top:2px solid #dbe5ea;padding-top:28px;margin-top:44px}h3{color:#12374a}p{margin:15px 0}a{color:#165f88;overflow-wrap:anywhere}nav{padding:18px;background:#eef4f7;columns:2;column-gap:35px}nav a{display:block;font-size:14px;padding:3px}.badge{font-size:11px;font-weight:750;letter-spacing:.03em;padding:3px 6px;color:#214d63;background:#e8f1f5;border-radius:3px;white-space:nowrap}.kind{font-size:11px;color:#647986;font-weight:600}.verdict{border-left:5px solid #a86f16;background:#fff6df;padding:18px 20px;margin:26px 0;font-size:19px}.table{overflow-x:auto;margin:20px 0}table{border-collapse:collapse;width:100%;font-size:13px}th{text-align:left;background:#163e52;color:white;padding:11px;vertical-align:top}td{padding:11px;border:1px solid #d9e4e9;vertical-align:top;min-width:120px;overflow-wrap:anywhere}tr:nth-child(even){background:#f4f8fa}code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.88em;background:#edf2f4;padding:1px 4px;border-radius:3px;overflow-wrap:anywhere}pre{background:#102a38;color:#dbe9f0;padding:18px;overflow:auto;font-size:12px;max-height:550px;line-height:1.5}pre code{background:transparent;color:inherit;padding:0}li{margin:10px 0}.actions li{padding:10px;border-bottom:1px solid #dbe5ea}.source{font-size:12px;color:#647986}.file{display:inline-block;margin:4px 13px 4px 0;font-family:monospace;font-size:12px}details{margin:10px 0;border:1px solid #dae5eb;padding:12px}summary{cursor:pointer;font-size:13px;font-weight:650;overflow-wrap:anywhere}.meta{color:#607988;font-size:14px}section{scroll-margin-top:15px}@media(max-width:650px){main{padding:24px 16px}nav{columns:1}h1{font-size:26px}td{min-width:150px}}@media print{body{background:white}main{max-width:none;padding:0}nav{display:none}details{display:none}h2{break-after:avoid}tr{break-inside:avoid}.table{overflow:visible}}'''
nav='<nav aria-label="Inhaltsverzeichnis">'+''.join(f'<a href="#s{n}">{n}. {esc(t)}</a>' for n,t in sections)+'</nav>'
document='<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>FORGE V0.1 INDEPENDENT READINESS AUDIT</title><style>'+style+'</style></head><body><main><h1>FORGE V0.1<br>INDEPENDENT READINESS AUDIT</h1><p class="meta">Forge-Dice/Forge · 03. Oktober 2026 · Principal Security / Release Engineering · Read-only</p>'+nav+''.join(parts)+'</main></body></html>'
OUT.write_text(document)
print(json.dumps({'path':str(OUT),'bytes':OUT.stat().st_size,'sections':len(sections),'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest()}))
