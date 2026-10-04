"""Deterministic model evidence. Execute: python3 run_lab.py (stdlib only)."""
import copy, json, itertools
from collections import Counter
from pathlib import Path
import model as m

ROOT=Path(__file__).resolve().parent
COUNTS=Counter();LOG=[];CONFIGS=[];CASES=[]
def check(condition,family,label):
    COUNTS[family]+=1
    LOG.append({'assertion':len(LOG)+1,'family':family,'label':label,'pass':bool(condition)})
    if not condition:raise AssertionError(f'{family}: {label}')
def result(f,*args):
    try:return {'ok':True,'value':f(*args)}
    except m.Invalid as ex:return {'ok':False,'code':str(ex)}
def pair(cfg,events,label):
    a=result(m.run,cfg,events);b=result(m.reference,cfg,events)
    check(a==b,'differential-release',label)
    if a['ok']:
        st=a['value']; ar=result(m.eligible,cfg,st);br=result(m.eligibility_reference,cfg,st)
        check(ar==br,'differential-adapter',label)
        if ar['ok']:
            released=ar['value'][0];ap=result(m.proof,cfg,released);bp=result(m.proof_reference,cfg,released)
            check(ap==bp,'differential-proof',label)
            check(set(released)<=set(o['id'] for o in cfg['proof']['observations']),'foreign-premise',label)
            return st,released,ap
    return None,None,None

def reports(cfg):
    added=[]
    for name,q,p in [('max','question:q01','proposition:p01'),('max','question:q02','proposition:p02'),('oskar','question:q12','proposition:p02')]:
        npc='person:'+name;o=cfg['npc'][npc][q]['observation'];ident='report:'+name+q.split(':')[-1]
        literal={'kind':'proposition','propositionId':p,'value':o['stance']=='affirms'}
        spec={'id':ident,'kind':'REPORTED_BY_NPC','npcId':npc,'questionId':q,'stance':o['stance'],'claim':o['statement'],'literal':literal}
        cfg['specs'].append(spec);cfg['proof']['observations'].append({'id':ident,'kind':'REPORTED_BY_NPC','npcId':npc,'literal':literal})
        cfg['proof']['nodes'].append({'id':'node:'+ident,'kind':'observation','observationId':ident});added.append(ident)
    for entity in [{'kind':'person','id':'person:max'},{'kind':'item','id':'item:kamera'}]:
        ident='awareness:'+entity['id'].split(':')[-1]
        spec={'id':ident,'kind':'ENTITY_AWARENESS','entity':entity}
        cfg['specs'].append(spec);cfg['proof']['observations'].append(copy.deepcopy(spec))
        cfg['proof']['nodes'].append({'id':'node:'+ident,'kind':'observation','observationId':ident})
    return added

def alternate_proof(cfg):
    # Synthetic license using EXISTING observations, not a new Vitrine authoring claim.
    oid='public-rule:synthetic-alt';nid='license:synthetic-alt';body=['observation:max','observation:nora','observation:oskar']
    lit={'kind':'conclusion','conclusionId':'conclusion:actor-lina','value':True}
    payload={'id':oid,'kind':'PUBLIC_RULE','rules':[{'edgeId':'synthetic-alt','allOf':body,'yields':lit}]}
    cfg['proof']['observations'].append(payload)
    cfg['proof']['nodes'].append({'id':nid,'kind':'observation','observationId':oid})
    cfg['proof']['edges'].append({'id':'synthetic-alt','allOf':body+[nid],'to':'literal:lina','license':nid})
    cfg['specs'].append({'id':oid,'kind':'PUBLIC_RULE','ruleId':'rule:closed-roster','afterObservations':['observed:max','observed:nora','observed:oskar'],'payload':payload})

def configured(i):
    cfg=m.build(i);reports(cfg)
    ev=cfg['evidence']['evidence:d04']
    if i&1:ev['reports'][0]['stance']='denies'
    if i&2:ev['reports'][-1]['source']={'kind':'testimony','person':cfg['refs']['person:nora']}
    if i&4:ev['reports']=[]
    if i&8:
        for s in cfg['specs']:
            if s['kind']=='PUBLIC_RULE':s['afterObservations']=sorted(set(s['afterObservations']+['observed:hof-contact']))
    if i&16:alternate_proof(cfg)
    if i&32:cfg['npc']['person:max']['question:q05']['observation']['stance']='leans_affirms'
    if i&64:cfg['canonical']['proposition','proposition:p03']=False
    cfg['binding']=m.digest({'namespace':i,'semantic':{k:v for k,v in cfg.items() if k not in ('canonical','npc','initial','literalClaims')},'canonical':sorted((str(k),v) for k,v in cfg['canonical'].items())})
    return cfg

base=m.build();check(m.validate_map(base),'map-validation','baseline')
for i in range(128):
    cfg=configured(i);cfg_before=copy.deepcopy(cfg);events=m.route(cfg)
    CONFIGS.append({'id':i,'binding':cfg['binding'],'dimensions':{'stance_flip':bool(i&1),'testimony_source':bool(i&2),'missing_reports':bool(i&4),'extra_gate':bool(i&8),'synthetic_alternative':bool(i&16),'uncertainty':bool(i&32),'false_canonical_observation':bool(i&64)}})
    for n in range(len(events)+1):
        st,root,proof=pair(cfg,events[:n],f'cfg={i};prefix={n}')
        check(st is not None,'reachable-prefix',f'{i}:{n}')
        text=m.c(m.public_view(cfg,st))
        check(all(x not in text for x in ['proposition:','conclusion:','"truth"','"knowledge"','"belief"','"intent"','"index"','"edges"','"solution"','"canonical"']),'information-flow',f'{i}:{n}')
        check(all(r in st['known'] for r in cfg['initial']),'known-monotonic',f'{i}:{n}')
    # Differential 16 complete Boolean answers; no proof evidence consulted by verdict.
    ids=sorted(cfg['required'])
    for vector in itertools.product([False,True],repeat=4):
        event=m.accusation(cfg,dict(zip(ids,vector)));a=m.run(cfg,[event]);b=m.reference(cfg,[event])
        check(a==b,'challenge-differential',f'{i}:{vector}')
        check((a['phase']=='solved')==(dict(zip(ids,vector))==cfg['required']),'challenge-exactness',f'{i}:{vector}')
        check(len(a['records'])==0,'challenge-no-proof-gate',f'{i}:{vector}')
    check(cfg==cfg_before,'immutability',str(i))
    # Same runtime guess under all journal/adapter changes.
    check(m.run(cfg,[m.accusation(cfg)])['phase']=='solved','D8',str(i))
    state=m.run(cfg,events)
    foreign=m.build(1000+i)
    check(result(m.eligible,foreign,state)=={'ok':False,'code':'BINDING'},'cross-package-premise',str(i))
    wrong=[{'type':'investigate','action':'examine_item','target':cfg['refs']['item:kamera']}]
    check(result(m.run,cfg,wrong)=={'ok':False,'code':'ACTION_UNAVAILABLE'},'PlayerRef-confusion',str(i))
    injected=copy.deepcopy(cfg);injected['labels']['pr1_'+'0'*16]='Unreleased person'
    check(m.public_view(cfg,m.run(cfg,[]))==m.public_view(injected,m.run(injected,[])),'hidden-entity-leak',str(i))
    reversed_ids=copy.deepcopy(cfg);reversed_ids['access']=dict(reversed(list(cfg['access'].items())))
    check(m.run(cfg,[{'type':'investigate','action':'search_location','target':cfg['refs']['location:galerie']}])==m.run(reversed_ids,[{'type':'investigate','action':'search_location','target':cfg['refs']['location:galerie']}]),'canonical-order-leak',str(i))
    duplicate=copy.deepcopy(cfg);duplicate['specs'].append(copy.deepcopy(duplicate['specs'][0]))
    check(result(m.validate_map,duplicate)=={'ok':False,'code':'DUPLICATE_PREMISE'},'duplicate-premise',str(i))
    foreignspec=copy.deepcopy(cfg);foreignspec['specs'][0]['id']='observed:foreign'
    check(result(m.validate_map,foreignspec)=={'ok':False,'code':'FOREIGN_PREMISE'},'foreign-premise',str(i))
    missing=copy.deepcopy(cfg);missing['specs'][0]['evidenceId']='evidence:absent'
    check(result(m.validate_map,missing)=={'ok':False,'code':'MISSING_SOURCE'},'missing-source',str(i))
    confusion=copy.deepcopy(cfg);confusion['specs'][0]['report']['source']={'kind':'testimony','person':cfg['refs']['person:nora']}
    check(result(m.validate_map,confusion)=={'ok':False,'code':'SOURCE_CONFUSION'},'source-confusion',str(i))
    lean=copy.deepcopy(cfg);j=next(j for j,s in enumerate(lean['specs']) if s['kind']=='REPORTED_BY_NPC');lean['specs'][j]['stance']='uncertain'
    check(result(m.validate_map,lean)=={'ok':False,'code':'STANCE_PROMOTION'},'stance-promotion',str(i))
    cycle=copy.deepcopy(cfg);sp=next(s for s in cycle['specs'] if s['kind']=='PUBLIC_RULE');sp['afterObservations']=[sp['id']]
    check(result(m.validate_map,cycle)=={'ok':False,'code':'LICENSE_GATE'},'self-license',str(i))
    alias=copy.deepcopy(cfg);src=alias['specs'][0]['literal']['propositionId'];alias['literalClaims']['proposition','proposition:alias']=copy.deepcopy(alias['literalClaims']['proposition',src])
    check(result(m.validate_map,alias)=={'ok':False,'code':'ALIAS_AMBIGUITY'},'ambiguous-alias',str(i))
    mismatch=copy.deepcopy(cfg);mismatch['specs'][0]['report']['claim']=copy.deepcopy(mismatch['literalClaims']['proposition','proposition:p01'])
    check(result(m.validate_map,mismatch)=={'ok':False,'code':'CLAIM_MEANING'},'claim-meaning',str(i))
    # All NPC report roots remain source-specific; neither polarities become facts.
    trace=[{'type':'interrogate','npc':cfg['refs']['person:max'],'questionId':'question:q02'}, {'type':'interrogate','npc':cfg['refs']['person:oskar'],'questionId':'question:q12'}]
    st,rs,pr=pair(cfg,trace,f'conflict-{i}')
    check(len(st['records'])==2,'conflicting-reports',str(i))
    check(pr['ok'] and len(pr['value']['literals'])==0,'truth-promotion',str(i))
    check({x['literal']['value'] for x in rs.values() if x['kind']=='REPORTED_BY_NPC'}=={False,True},'report-polarities',str(i))
    # Repeated NPC receives remain separate; repeated discovery stays unique.
    search={'type':'investigate','action':'search_location','target':cfg['refs']['location:galerie']}
    repeat=m.run(cfg,[search,search]);check(len(repeat['records'])==2 and repeat['outputs'][-1]['observations']==[],'discovery-idempotence',str(i))
    check(result(m.run,cfg,[m.accusation(cfg),search])=={'ok':False,'code':'SESSION_CLOSED'},'terminal',str(i))

# Explicit Evidence testimony remains a REPORTED root, even when content is false.
for i in range(128):
    cfg=m.build(i);obs=cfg['evidence']['evidence:d01'];report=copy.deepcopy(obs['reports'][0]);report['source']={'kind':'testimony','person':cfg['refs']['person:oskar']};obs['reports']=[report]
    oid='report:testimony';lit={'kind':'proposition','propositionId':'proposition:p01','value':True}
    cfg['specs'].append({'id':oid,'kind':'REPORTED_BY_NPC','npcId':'person:oskar','evidenceId':'evidence:d01','report':report,'literal':lit})
    root={'id':oid,'kind':'REPORTED_BY_NPC','npcId':'person:oskar','literal':lit};cfg['proof']['observations'].append(root);cfg['proof']['nodes'].append({'id':'node:testimony','kind':'observation','observationId':oid})
    event={'type':'investigate','action':'search_location','target':cfg['refs']['location:galerie']}
    st,rs,p=pair(cfg,[event],f'testimony-{i}')
    check(rs[oid]==root,'testimony-report',str(i));check(not p['value']['literals'],'testimony-no-factivity',str(i))
    # Source person mismatch cannot meet the exact authored selector.
    bad=copy.deepcopy(cfg);bad['evidence']['evidence:d01']['reports'][0]['source']['person']=cfg['refs']['person:nora']
    check(oid not in m.eligible(bad,m.run(bad,[event]))[0],'testimony-source-confusion',str(i))

# Named semantic cases with full PlayerKnowledge, eligibility, canonical status, consequence.
reportbase=m.build();reports(reportbase)
for name,npc,q,canonical in [('truthful-npc','person:max','question:q01',True),('false-belief','person:oskar','question:q12',False),('uncertain','person:lina','question:q16',True)]:
    ev={'type':'interrogate','npc':reportbase['refs'][npc],'questionId':q}
    st,rs,p=pair(reportbase,[ev],name)
    CASES.append({'name':name,'PlayerKnowledge':st['records'],'eligible':rs,'canonicalTruthOfClaim':canonical,'proof':p,'correctCompleteChallenge':m.run(reportbase,[ev,m.accusation(reportbase)])['phase']})
    check(p['ok'] and not p['value']['pass'],'non-truth-rule',name)
trace=[{'type':'interrogate','npc':reportbase['refs']['person:max'],'questionId':'question:q02'},{'type':'interrogate','npc':reportbase['refs']['person:oskar'],'questionId':'question:q12'}]
st,rs,p=pair(reportbase,trace,'conflicting-reports');CASES.append({'name':'conflicting-reports','PlayerKnowledge':st['records'],'eligible':rs,'canonicalTruthOfClaim':False,'proof':p,'correctCompleteChallenge':m.run(reportbase,trace+[m.accusation(reportbase)])['phase']})
search={'type':'investigate','action':'search_location','target':base['refs']['location:galerie']}
st,rs,p=pair(base,[search],'multi-world-evidence')
check(not p['value']['pass'] and len(p['value']['surviving'])==16,'multiple-explanations','stamp at 120 does not imply actor at 240')
CASES.append({'name':'multi-world-evidence','PlayerKnowledge':st['records'],'eligible':rs,'canonicalTruthOfObservedStamp':True,'canonicalTruthOfAccusedMax':False,'proof':p,'correctCompleteChallenge':m.run(base,[search,m.accusation(base)])['phase']})

# Eight mandatory differential comparisons and seven D8 states.
comparisons=[]
for name,events in [('correct-release-route',m.route(base)),('false-npc',[{'type':'interrogate','npc':base['refs']['person:oskar'],'questionId':'question:q12'}]),('conflicting-npc',trace),('missing-observation',m.route(base)[:-1]),('wrong-evidence',[search]),('alternative-access-order',m.route(base,True)),('randomly-correct-accusation',[m.accusation(base)]),('deduced-accusation',m.route(base)+[m.accusation(base)])]:
    st,rs,p=pair(base,events,name);comparisons.append({'name':name,'phase':st['phase'],'released':sorted(rs),'proof':p})
    if name in ['correct-release-route','alternative-access-order','deduced-accusation']:check(p['value']['pass'],'positive-controls',name)
    else:check(not p['value']['pass'],'negative-controls',name)
# No fabricated Vitrine alternative evidence: synthetic alternative licensed graph separately.
alt=m.build();alternate_proof(alt);alt['proof']['edges']=[e for e in alt['proof']['edges'] if e['id']!='remaining:lina'];st,rs,p=pair(alt,m.route(alt),'synthetic-alternative-proof')
check(p['value']['pass'],'alternative-proof','primary remaining edge removed')
comparisons.append({'name':'synthetic-alternative-proof','scope':'LAB ONLY, no new Vitrine clue/contract','proof':p})
all_events=m.route(base)+[{'type':'investigate','action':'search_location','target':base['refs'][loc]} for loc in ['location:galerie','location:werkstatt','location:archiv','location:foyer']]
D8=[]
for name,events in [('immediately-right',[]),('partial-evidence',[search]),('all-evidence',all_events),('no-npc-statement',[{'type':'investigate','action':'search_location','target':base['refs'][loc]} for loc in ['location:galerie','location:hof','location:archiv','location:werkstatt','location:foyer']]),('alternative-access-order',m.route(base,True)),('all-proof-premises',m.route(base)),('right-without-premises',[])]:
    st,rs,p=pair(base,events,name);final=m.run(base,events+[m.accusation(base)])
    check(final['phase']=='solved','D8-matrix',name);D8.append({'name':name,'proofPass':p['value']['pass'],'runtimeVerdict':'solved','evidenceCount':len(st['discoveries']),'recordCount':len(st['records'])})

# Exhaust all 256 Evidence subsets: release eligibility grid, not reachable-state claim.
ids=sorted(base['evidence']);grid=[]
for bits in itertools.product([False,True],repeat=8):
    chosen=[i for i,b in zip(ids,bits) if b];state={'binding':base['binding'],'known':sorted(base['initial']),'records':[{'source':{'kind':'evidence','eventIndex':k,'evidence':base['refs'][i]},'observation':base['evidence'][i]} for k,i in enumerate(chosen)]}
    a=m.eligible(base,state);b=m.eligibility_reference(base,state);check(a==b,'subset-adapter',str(chosen));p=m.proof(base,a[0]);r=m.proof_reference(base,a[0]);check(p==r,'subset-proof',str(chosen));check(p['pass']==({'evidence:d04','evidence:d05'}<=set(chosen)),'subset-exactness',str(chosen));grid.append({'evidence':chosen,'pass':p['pass'],'surviving':len(p['surviving'])})

# Bounded mandatory progression probes: 192 distinct tested histories in base case.
progress=[]
wrongvals=copy.deepcopy(base['required']);wrongvals['conclusion:actor-lina']=False;wrong=m.accusation(base,wrongvals)
for order in [False,True]:
    path=m.route(base,order)
    for prefix in range(6):
        for repetitions in range(16):
            history=path[:prefix]+[wrong]*repetitions
            st=m.run(base,history);check(st['phase']=='active','progress-active',f'{order}:{prefix}:{repetitions}')
            done=m.run(base,history+m.route(base)+[m.accusation(base)])
            check(done['phase']=='solved','no-tested-softlock',f'{order}:{prefix}:{repetitions}')
            eligible,_=m.eligible(base,done)
            check(m.proof(base,eligible)['pass'],'progress-deductive-completion',f'{order}:{prefix}:{repetitions}')
            progress.append({'order':order,'prefix':prefix,'wrongAccusations':repetitions,'historyHash':m.digest(history),'completion':'five-step witness plus complete correct answer'})

# Concrete public-surface detector controls; no fabricated production mutation score.
def clean_public(value):
    forbidden={'truth','solution','requiredConclusions','edges','nodes','witnessStepIds','knowledge','belief','intent','index','provenance','acquiredAt','solutionHash','truthHash'}
    def scan(x):
        if isinstance(x,dict):return not forbidden.intersection(x) and all(scan(v) for v in x.values())
        if isinstance(x,list):return all(scan(v) for v in x)
        if isinstance(x,str):return not any(prefix in x for prefix in ['person:','location:','item:','event:','evidence:','proposition:','conclusion:'])
        return True
    return scan(value)
full=m.run(base,m.route(base));view=m.public_view(base,full)
check(clean_public(view),'public-allowlist-control','clean DTO')
for field,payload in [('edges',base['proof']['edges']),('requiredConclusions',base['required']),('truthHash','0'*64),('knowledge',True),('index',0),('intent','sincere')]:
    leak=copy.deepcopy(view);leak[field]=payload
    check(not clean_public(leak),'public-allowlist-control',field)
# Binding/payload negatives are exercised with actual functions above, not named mutants.

check(len({x['binding'] for x in CONFIGS})==128,'diversity','128 configuration hashes')
summary={'status':'PASS','modelOnly':True,'productionTested':False,'configurations':len(CONFIGS),'assertions':len(LOG),'failures':sum(not x['pass'] for x in LOG),'families':dict(sorted(COUNTS.items())),'evidenceSubsets':len(grid),'certifyingSubsets':sum(x['pass'] for x in grid),'releaseProof':'CLOSED (normative patch candidate + bounded lab evidence)','vitrine':'CERTIFICATION MODEL READY','runtime':'IMPLEMENTATION REQUIRED'}
for filename,data in [('results.json',summary),('configurations.json',CONFIGS),('semantic-cases.PRIVATE.json',CASES),('comparisons.json',comparisons),('D8-matrix.json',D8),('subset-grid.json',grid),('progression.json',progress)]:
    (ROOT/filename).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
(ROOT/'assertions.jsonl').write_text(''.join(json.dumps(x,ensure_ascii=False,sort_keys=True)+'\n' for x in LOG))
print(json.dumps(summary,indent=2))
