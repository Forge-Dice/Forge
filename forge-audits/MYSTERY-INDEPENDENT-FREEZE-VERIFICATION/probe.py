from pathlib import Path
import json,hashlib,re,copy
ROOT=Path(__file__).resolve().parent
LIB=ROOT/'evidence/library'
CASE=ROOT/'evidence/archives/DIE-LEERE-VITRINE-CASE-PACK/DIE-LEERE-VITRINE-CASE-PACK'
results=[]
def record(name,result,scope):
    results.append(dict(name=name,result=result,scope=scope))
# Execute only the supplied original host's definitions, before scenario generators or writes.
ns={'__file__':str(CASE/'simulate.py')}
exec((CASE/'simulate.py').read_text().split('scenarios=[]')[0],ns)
state=ns['fresh']()
record('original-host-early-correct-guess',ns['step'](state,ns['A']('lina',())),
       'Original archived host, no invented production API. Session §6 specifies solved for the complete correct known-ref answer without receipt.')
state=ns['fresh']();trace=[]
for event in ns['witness']+[ns['A']()]:
    out=ns['step'](state,event)
    trace.append(dict(event=event,output=out))
record('original-host-five-action-witness',dict(trace=trace,phase=state['phase']),
       'Original archived host only. Contains old observed DTO and citation gate; not an M4/Session conformance witness.')
state=ns['fresh']()
record('false-npc-belief-output',ns['step'](state,ns['Q']('oskar',12)),
       'Original archived host; affirms is retained as report, not a proof seed.')
record('report-only-proof',ns['proof'](state['found']),
       'Original authored finite proof, no evidence found.')
record('misleading-true-visit-proof',ns['proof'](['evidence:d01']),
       'Original authored finite proof; true earlier presence proves no direct role.')
state=ns['fresh']()
record('uncertain-npc-output',ns['step'](state,ns['Q']('nora',10)),
       'Original archived host; uncertainty has no Boolean proof conversion.')
state=ns['fresh']()
record('conflicting-reports',dict(outputs=[ns['step'](state,ns['Q']('oskar',12)),
                                        ns['step'](state,ns['Q']('max',2))],
                                 journal=copy.deepcopy(state['reports']),
                                 proof=ns['proof'](state['found'])),
       'Original archived host; same claim affirms and denies both remain received records.')
initial=ns['public_initial']()
ns['truth']['persons'].append({'id':'person:hidden','name':'Hidden test person'})
ns['entities']['person:hidden']='person';ns['refs']['person:hidden']='pr1_0000000000000000'
ns['host']['personRoles']['person:hidden']='Unreleased role'
changed=ns['public_initial']()
record('hidden-person-in-initial-brief',dict(before=len(initial['suspects']),after=len(changed['suspects']),
       leakedEntry=changed['suspects'][-1],inInitialKnown=any(x['id']=='person:hidden' for x in ns['host']['initialKnown'])),
       'Direct local original-host boundary probe, fixed aliases to isolate release logic. No claim of a rebound semantically playable twin.')
ns['truth']['persons'].pop()
before=ns['step'](ns['fresh'](),ns['S']('galerie'))
for old,new in [('evidence:d01','evidence:zzz'),('evidence:d02','evidence:aaa')]:
    for name in ['access','presentation']:
        ns['host'][name][new]=ns['host'][name].pop(old)
    ns['refs'][new]=ns['refs'][old]
after=ns['step'](ns['fresh'](),ns['S']('galerie'))
record('canonical-id-order-enters-public-cards',dict(before=[x['text'] for x in before['evidence']],after=[x['text'] for x in after['evidence']]),
       'Direct original-host rename probe with preserved aliases/text; no whole package binding claim.')
shared=[]
for task in ['A','B','C']:
    t=(LIB/f'MYST-SESSION-0001{task}.contract.DRAFT.md').read_text()
    shared.append(t[t.index('## 2. Package Identity'):t.index('## Acceptance Criteria dieses Tasks')].strip())
record('session-shared-semantics-byte-equality',len(set(shared))==1,'Exact common sections in three original drafts; does not assign a single owner by itself.')
golden={'events':[],'packageIdentity':{'schemaVersion':1,'packageHash':'0'*64,'rulesetVersion':'mystery-session-v1'},'schemaVersion':1}
wire=json.dumps(golden,sort_keys=True,separators=(',',':'))
digest=hashlib.sha256(('forge-session-save-v1\n'+wire).encode()).hexdigest()
record('session-empty-save-golden',dict(hash=digest,matches=digest=='58a1857b0b76ba1f342237261c2d4c9877f7cc7bb2a78c116d8e1ecebdc6875f'),
       'Independent hashlib check of published empty-vector ASCII bytes; not a complete codec implementation.')
record('literal-prospective-size-work',[
    dict(events=n,eventOccurrencesSerialized=n*(n+1)//2,incrementalOccurrences=n)
    for n in [128,256,512]],'Exact operation count for full prospective-envelope serialization after every accepted event; no timing benchmark.')
files=[]
for p in sorted(LIB.iterdir()):
    if p.suffix in ['.txt']:continue
    files.append(dict(name=p.name,bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
record('original-artifact-inventory',files,'Hashes of materialized originals, not summaries.')
(ROOT/'probe-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps([dict(name=r['name'],result=r['result'] if r['name'] in ['session-shared-semantics-byte-equality','session-empty-save-golden','literal-prospective-size-work','original-host-early-correct-guess','report-only-proof','misleading-true-visit-proof','hidden-person-in-initial-brief'] else 'recorded') for r in results],ensure_ascii=False,indent=2))
