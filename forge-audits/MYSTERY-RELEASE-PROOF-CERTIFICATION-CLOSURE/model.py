"""Independent finite LAB MODEL. No production imports, no historical lab code.
ASCII data comparison uses canonical JSON; this is not the Session serializer.
Canonical status here covers only the Vitrine direct_actor family (MYST-0002).
"""
import copy, hashlib, itertools, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = json.loads((ROOT / 'input-case.PRIVATE.json').read_text())
ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'
FIELDS = {'personId': ('person','person'), 'locationId': ('location','location'),
          'itemId': ('item','item'), 'eventId': ('event','event'),
          'causeEventId': ('event','causeEvent')}

def c(x): return json.dumps(x, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
def digest(x): return hashlib.sha256(c(x).encode()).hexdigest()
def refs_of(claim): return [(FIELDS[k][0],v) for k,v in claim.items() if k in FIELDS]
def pclaim(claim, refs):
    return {FIELDS[k][1] if k in FIELDS else k: refs[v] if k in FIELDS else v
            for k,v in claim.items()}
def keylit(x): return (x['kind'], x.get('propositionId', x.get('conclusionId')), x['value'])

def build(namespace=0):
    """Original case data transformed into current DTO vocabulary; design fixture only."""
    d = copy.deepcopy(DATA); t=d['truth']; s=d['solution']; h=d['case-host.design']
    salt=f'{namespace+1:032x}'
    refs={}; entities={}
    for kind,collection in [('person','persons'),('location','locations'),('item','items'),
                            ('event','events'),('evidence','evidence')]:
        for entity in t[collection]:
            ident=entity['id']; pre='\n'.join(['forge-mystery-playerref-v1',salt,t['caseId'],h['truthHash'],kind,ident])
            n=int.from_bytes(hashlib.sha256(pre.encode()).digest()[:10],'big')
            token='pr1_'+''.join(ALPHABET[(n >> shift)&31] for shift in range(75,-1,-5))
            refs[ident]=token; entities[token]=(kind,ident)
    proposition={x['id']:x for x in t['propositions']}
    conclusion={x['id']:x for x in s['conclusions']}
    canonical={('proposition',x['id']):x['truth'] for x in t['propositions']}
    for con in s['conclusions']:
        claim=con['claim']; resolution=next(x for x in s['resolutions'] if x['eventId']==claim['eventId'])
        assignments={x['personId']:x['roles'] for x in resolution['responsibility']['assignments']}
        canonical['conclusion',con['id']]=claim['role'] in (assignments.get(claim['personId']) or [])
    evidence={}
    for entry in d['presentation']['entries']:
        reports=[{'claim':pclaim(x['claim'],refs),'stance':x['stance'],
                  'source':{'kind':x['source']['kind'],**({'person':refs[x['source']['personId']]} if x['source']['kind']=='testimony' else {})}}
                 for x in entry['reports']]
        evidence[entry['evidenceId']]={'schemaVersion':1,'evidence':refs[entry['evidenceId']],
                  'text':entry['text'],'mentions':sorted([{'kind':x['kind'],'ref':refs[x['id']]} for x in entry['mentions']],key=lambda x:x['ref']),
                  'reports':sorted(reports,key=lambda x:json.dumps(x,separators=(',',':'),ensure_ascii=False))}
    questions={x['id']:x['mentions'] for x in d['questions.input']['questions']}
    npc={}
    for name,profile in d['profiles'].items():
        snap=d['npcs'][name]; npc[profile['npcId']]={}
        for rule in profile['rules']:
            q=rule['questionId']; observation={'schemaVersion':1,'npc':refs[profile['npcId']],'questionId':q,'act':rule['act']}
            if rule['act']=='answer':
                matches=[]
                for a in snap['attitudes']:
                    catalog=proposition if a['subject']['kind']=='proposition' else conclusion
                    if c(catalog[a['subject']['id']]['claim'])==c(rule['claim']): matches.append(a['stance'])
                if matches:
                    st=matches[0]
                    stance=('affirms' if st['value'] else 'denies') if st['kind']!='uncertain' else {True:'leans_affirms',False:'leans_denies',None:'uncertain'}[st['leaning']]
                    observation.update(stance=stance, statement=pclaim(rule['claim'],refs),
                        mentions=sorted([{'kind':k,'ref':refs[i]} for k,i in set(refs_of(rule['claim']))],key=lambda x:x['ref']))
                else:observation['stance']='does_not_know'
            npc[profile['npcId']][q]={'requires':set([refs[x['id']] for x in questions[q]]+[refs[profile['npcId']]]),'observation':observation}
    proof=d['proof']; specs=[]
    ruletexts={x['id']:x['text'] for x in h['publicRules']}
    for cert in d['factivity']['certificates']:
        expected={'claim':pclaim(cert['report']['claim'],refs),'stance':cert['report']['stance'],'source':copy.deepcopy(cert['report']['source'])}
        specs.append({'id':cert['observationId'],'kind':'OBSERVED','literal':cert['literal'],
                     'evidenceId':cert['evidenceId'],'report':expected,'licenseRuleId':cert['publicLicense']})
    for obs in proof['observations']:
        if obs['kind']=='PUBLIC_RULE':
            gates={'public-rule:max':['observed:max'],'public-rule:nora':['observed:nora'],
                   'public-rule:oskar':['observed:oskar'],'public-rule:remaining':['observed:max','observed:nora','observed:oskar']}
            specs.append({'id':obs['id'],'kind':'PUBLIC_RULE','ruleId':'rule:closed-roster' if obs['id']=='public-rule:remaining' else 'rule:manual-presence',
                         'afterObservations':gates[obs['id']],'payload':obs})
    initial={refs[x['id']] for x in h['initialKnown']}
    cfg={'binding':digest({'namespace':namespace,'inputHash':digest(d),'adapter':'forge-release-proof-v1'}),
         'refs':refs,'entities':entities,'initial':initial,'evidence':evidence,'access':h['access'],'npc':npc,
         'specs':specs,'proof':proof,'canonical':canonical,'publicRules':ruletexts,
         'required':{x['conclusionId']:x['value'] for x in s['requiredConclusions']},
         'literalClaims':{('proposition',i):pclaim(x['claim'],refs) for i,x in proposition.items()},
         'claims':{x['id']:pclaim(x['claim'],refs) for x in s['conclusions']},
         'labels':{refs[i]:v for i,v in h['entityLabels'].items()}}
    return cfg

def accusation(cfg, values=None):
    values=cfg['required'] if values is None else values
    return {'type':'accuse','literals':[{'claim':cfg['claims'][i],'value':v} for i,v in values.items()]}

def verdict(cfg,event):
    vals={}; catalog={c(x):i for i,x in cfg['claims'].items()}
    for x in event['literals']:
        i=catalog.get(c(x['claim']))
        if i is None or i in vals or type(x['value']) is not bool:return 'not_solved'
        vals[i]=x['value']
    # D8: NO journal or proof parameter. Unknown statuses cannot match a Boolean.
    return 'solved' if all(vals.get(i) is v for i,v in cfg['required'].items()) and all(cfg['canonical']['conclusion',i] is v for i,v in vals.items()) else 'not_solved'

class Invalid(Exception): pass

def run(cfg,events):
    """Operational boundary model, maintains accepted journal and discoveries."""
    known=set(cfg['initial']); discoveries=set(); records=[]; accepted=[]; phase='active'; outputs=[]
    for event in events:
        if phase=='solved':raise Invalid('SESSION_CLOSED')
        if event['type']=='investigate':
            target=event['target']; action=event['action']; expected={'search_location':'location','examine_item':'item','examine_person':'person'}[action]
            if target not in known or cfg['entities'].get(target,(None,None))[0]!=expected:raise Invalid('ACTION_UNAVAILABLE')
            ident=cfg['entities'][target][1]
            found=[i for i,a in cfg['access'].items() if a['kind']==action and a['target']==ident and i not in discoveries]
            new=[]
            for i in sorted(found,key=lambda i:cfg['refs'][i]):
                obs=copy.deepcopy(cfg['evidence'][i]);new.append(obs)
                known.add(obs['evidence']);known.update(x['ref'] for x in obs['mentions']);discoveries.add(i)
                records.append({'source':{'kind':'evidence','eventIndex':len(accepted),'evidence':obs['evidence']},'observation':obs})
            outputs.append({'type':'investigate','observations':new})
        elif event['type']=='interrogate':
            entity=cfg['entities'].get(event['npc']); item=cfg['npc'].get(entity[1],{}).get(event['questionId']) if entity else None
            if event['npc'] not in known or item is None or not item['requires']<=known:raise Invalid('ACTION_UNAVAILABLE')
            obs=copy.deepcopy(item['observation']);known.update(x['ref'] for x in obs.get('mentions',[]))
            records.append({'source':{'kind':'npc','eventIndex':len(accepted),'npc':event['npc'],'questionId':event['questionId']},'observation':obs})
            outputs.append({'type':'interrogate','observation':obs})
        elif event['type']=='accuse':
            if any(v not in known for x in event['literals'] for k,v in x['claim'].items() if k in ('person','location','item','event','causeEvent')):raise Invalid('ACTION_UNAVAILABLE')
            v=verdict(cfg,event);outputs.append({'type':'accuse','verdict':v})
            if v=='solved':phase='solved'
        else:raise Invalid('SHAPE')
        accepted.append(copy.deepcopy(event))
    return {'binding':cfg['binding'],'known':sorted(known),'discoveries':sorted(discoveries),'records':records,'outputs':outputs,'phase':phase}

def reference(cfg,events):
    """Independent declarative prefix relation. No run()/verdict() calls."""
    records=[]; outputs=[]; discovered=set(); phase='active'
    for index,event in enumerate(events):
        known=set(cfg['initial']) | {r['observation']['evidence'] for r in records if r['source']['kind']=='evidence'} | {m['ref'] for r in records for m in r['observation'].get('mentions',[])}
        if phase=='solved':raise Invalid('SESSION_CLOSED')
        typ=event['type']
        if typ=='investigate':
            target=cfg['entities'].get(event['target']); kind={'search_location':'location','examine_item':'item','examine_person':'person'}[event['action']]
            if not target or target[0]!=kind or event['target'] not in known:raise Invalid('ACTION_UNAVAILABLE')
            candidates={i for i in cfg['access'] if cfg['access'][i]=={'kind':event['action'],'target':target[1]}}-discovered
            obslist=[copy.deepcopy(cfg['evidence'][i]) for i in sorted(candidates,key=lambda i:cfg['refs'][i])]
            records.extend({'source':{'kind':'evidence','eventIndex':index,'evidence':o['evidence']},'observation':o} for o in obslist)
            discovered|=candidates;outputs.append({'type':typ,'observations':obslist})
        elif typ=='interrogate':
            matches=[v for n,qs in cfg['npc'].items() for q,v in qs.items() if cfg['refs'][n]==event['npc'] and q==event['questionId'] and v['requires']<=known]
            if len(matches)!=1 or event['npc'] not in known:raise Invalid('ACTION_UNAVAILABLE')
            obs=copy.deepcopy(matches[0]['observation']);records.append({'source':{'kind':'npc','eventIndex':index,'npc':event['npc'],'questionId':event['questionId']},'observation':obs});outputs.append({'type':typ,'observation':obs})
        elif typ=='accuse':
            if any(v not in known for x in event['literals'] for k,v in x['claim'].items() if k in ('person','location','item','event','causeEvent')):raise Invalid('ACTION_UNAVAILABLE')
            submitted=[(next((i for i,claim in cfg['claims'].items() if claim==x['claim']),None),x['value']) for x in event['literals']]
            success=len({i for i,v in submitted})==len(submitted) and all(i is not None and type(v) is bool and cfg['canonical'].get(('conclusion',i)) is v for i,v in submitted) and set(cfg['required'].items())<=set(submitted)
            v='solved' if success else 'not_solved';outputs.append({'type':typ,'verdict':v});phase='solved' if success else 'active'
        else:raise Invalid('SHAPE')
    known=set(cfg['initial']) | {r['observation']['evidence'] for r in records if r['source']['kind']=='evidence'} | {m['ref'] for r in records for m in r['observation'].get('mentions',[])}
    return {'binding':cfg['binding'],'known':sorted(known),'discoveries':sorted(discovered),'records':records,'outputs':outputs,'phase':phase}

def eligible(cfg,state):
    """Certificate relation, never reads private NPC stance or solution."""
    if state['binding']!=cfg['binding']:raise Invalid('BINDING')
    out={}; receipts=[]
    for spec in cfg['specs']:
        if spec['kind']=='OBSERVED':
            matches=[r for r in state['records'] if r['source']['kind']=='evidence' and r['source']['evidence']==cfg['refs'][spec['evidenceId']] and c(spec['report']) in [c(x) for x in r['observation']['reports']]]
            if matches and spec['licenseRuleId'] in cfg['publicRules'] and spec['report']['source']['kind']=='observation':
                out[spec['id']]={'id':spec['id'],'kind':'OBSERVED','literal':spec['literal'],'source':{'kind':'evidence','evidenceId':spec['evidenceId']}}
        elif spec['kind']=='REPORTED_BY_NPC':
            if 'evidenceId' in spec:
                for r in state['records']:
                    if r['source']['kind']=='evidence' and r['source']['evidence']==cfg['refs'][spec['evidenceId']] and any(x==spec['report'] for x in r['observation']['reports']) and spec['report']['source']=={'kind':'testimony','person':cfg['refs'][spec['npcId']]}:
                        out[spec['id']]={'id':spec['id'],'kind':'REPORTED_BY_NPC','npcId':spec['npcId'],'literal':spec['literal']}
                continue
            for r in state['records']:
                o=r['observation']
                if r['source']['kind']=='npc' and o['npc']==cfg['refs'][spec['npcId']] and o['questionId']==spec['questionId'] and o.get('act')=='answer' and o.get('stance')==spec['stance'] and o.get('statement')==spec['claim'] and o.get('stance') in ('affirms','denies'):
                    out[spec['id']]={'id':spec['id'],'kind':'REPORTED_BY_NPC','npcId':spec['npcId'],'literal':spec['literal']}
        elif spec['kind']=='ENTITY_AWARENESS':
            if cfg['refs'][spec['entity']['id']] in state['known']:
                out[spec['id']]={'id':spec['id'],'kind':'ENTITY_AWARENESS','entity':spec['entity']}
    for spec in cfg['specs']:
        if spec['kind']=='PUBLIC_RULE' and spec['ruleId'] in cfg['publicRules'] and set(spec['afterObservations'])<=out.keys():
            out[spec['id']]=spec['payload'];receipts.append({'id':spec['ruleId'],'text':cfg['publicRules'][spec['ruleId']]})
    return out,receipts

def eligibility_reference(cfg,state):
    if cfg['binding']!=state['binding']:raise Invalid('BINDING')
    output={}
    for spec in cfg['specs']:
        typ=spec['kind']
        for r in state['records']:
            o=r['observation'];src=r['source']
            if typ=='OBSERVED' and src['kind']=='evidence' and src['evidence']==cfg['refs'][spec['evidenceId']] and any(report==spec['report'] for report in o['reports']) and spec['report']['source']=={'kind':'observation'} and spec['licenseRuleId'] in cfg['publicRules']:
                output[spec['id']]={'id':spec['id'],'kind':typ,'literal':spec['literal'],'source':{'kind':'evidence','evidenceId':spec['evidenceId']}}
            if typ=='REPORTED_BY_NPC' and 'evidenceId' not in spec and src['kind']=='npc' and (o.get('npc'),o.get('questionId'),o.get('act'),o.get('stance'),o.get('statement'))==(cfg['refs'][spec['npcId']],spec['questionId'],'answer',spec['stance'],spec['claim']) and spec['stance'] in ['affirms','denies']:
                output[spec['id']]={'id':spec['id'],'kind':typ,'npcId':spec['npcId'],'literal':spec['literal']}
            if typ=='REPORTED_BY_NPC' and 'evidenceId' in spec and src['kind']=='evidence' and src['evidence']==cfg['refs'][spec['evidenceId']] and spec['report'] in o['reports'] and spec['report']['source']=={'kind':'testimony','person':cfg['refs'][spec['npcId']]}:
                output[spec['id']]={'id':spec['id'],'kind':typ,'npcId':spec['npcId'],'literal':spec['literal']}
        if typ=='ENTITY_AWARENESS' and cfg['refs'][spec['entity']['id']] in state['known']:
            output[spec['id']]={'id':spec['id'],'kind':typ,'entity':spec['entity']}
    receipts=[{'id':s['ruleId'],'text':cfg['publicRules'][s['ruleId']]} for s in cfg['specs'] if s['kind']=='PUBLIC_RULE' and s['ruleId'] in cfg['publicRules'] and all(x in output for x in s['afterObservations'])]
    # Rule gates only reference non-rule roots, so one relational pass is sufficient.
    output.update({s['id']:s['payload'] for s in cfg['specs'] if s['kind']=='PUBLIC_RULE' and s['ruleId'] in cfg['publicRules'] and all(x in output for x in s['afterObservations'])})
    return output,receipts

def proof(cfg, released):
    profile=cfg['proof']; established={n['id'] for n in profile['nodes'] if n['kind']=='observation' and n['observationId'] in released}
    nodes={n['id']:n for n in profile['nodes']};facts={}
    for o in released.values():
        if o['kind']=='OBSERVED':
            l=o['literal']
            if cfg['canonical'].get((l['kind'],l.get('propositionId'))) is not l['value']:raise Invalid('FALSE_OBSERVATION')
            facts[keylit(l)]=True
    for n in profile['nodes']:
        if n['kind']=='literal' and keylit(n['literal']) in facts:established.add(n['id'])
    while True:
        added=set()
        for e in profile['edges']:
            lic=nodes[e['license']];root=released.get(lic.get('observationId'));n=nodes[e['to']]
            desc={'edgeId':e['id'],'allOf':sorted(set(e['allOf'])-{e['license']}),'yields':n['literal']}
            if root and root['kind']=='PUBLIC_RULE' and any({'edgeId':x['edgeId'],'allOf':sorted(x['allOf']),'yields':x['yields']}==desc for x in root['rules']) and set(e['allOf'])<=established:
                lit=n['literal']
                if cfg['canonical'].get((lit['kind'],lit.get('conclusionId',lit.get('propositionId')))) is not lit['value']:raise Invalid('NONCANONICAL_INFERENCE')
                added.add(e['to'])
        if added<=established:break
        established|=added
    literals={keylit(n['literal']) for n in profile['nodes'] if n['kind']=='literal' and n['id'] in established}
    literals|=set(facts)
    scope=sorted(profile['answerScope'])
    survivors=[dict(zip(scope,v)) for v in itertools.product([False,True],repeat=len(scope)) if all(('conclusion',i,not b) not in literals for i,b in zip(scope,v))]
    passed=all(('conclusion',i,v) in literals for i,v in cfg['required'].items()) and len(survivors)==1
    return {'established':sorted(established),'literals':sorted(literals),'surviving':survivors,'pass':passed}

def proof_reference(cfg,released):
    """Exhaustive enabled-subset closure, separate from operational edge firing."""
    p=cfg['proof'];nodes={n['id']:n for n in p['nodes']};roots={n['id'] for n in p['nodes'] if n['kind']=='observation' and n['observationId'] in released}
    facts={keylit(x['literal']) for x in released.values() if x['kind']=='OBSERVED'}
    for l in facts:
        if cfg['canonical'].get((l[0],l[1])) is not l[2]:raise Invalid('FALSE_OBSERVATION')
    roots|={n['id'] for n in p['nodes'] if n['kind']=='literal' and keylit(n['literal']) in facts}
    valid=[]
    for e in p['edges']:
        rn=nodes[e['license']];ro=released.get(rn.get('observationId'));target=nodes[e['to']]['literal']
        match=ro and ro['kind']=='PUBLIC_RULE' and any(x['edgeId']==e['id'] and set(x['allOf'])==set(e['allOf'])-{e['license']} and x['yields']==target for x in ro['rules'])
        if match:valid.append(e)
    # Intersect all sets closed under licensed rules and containing the released roots.
    targets=sorted({e['to'] for e in valid}-roots);closed=[]
    for bits in itertools.product([False,True],repeat=len(targets)):
        candidate=roots|{n for n,b in zip(targets,bits) if b}
        if all(not set(e['allOf'])<=candidate or e['to'] in candidate for e in valid):closed.append(candidate)
    established=set.intersection(*closed) if closed else roots
    for e in valid:
        if e['to'] in established:
            l=nodes[e['to']]['literal']
            if cfg['canonical'].get((l['kind'],l.get('conclusionId',l.get('propositionId')))) is not l['value']:raise Invalid('NONCANONICAL_INFERENCE')
    literals=facts|{keylit(nodes[n]['literal']) for n in established if nodes[n]['kind']=='literal'}
    scope=sorted(p['answerScope']);vectors=[]
    for num in range(2**len(scope)):
        vector={i:bool(num & (1<<(len(scope)-j-1))) for j,i in enumerate(scope)}
        if not any(('conclusion',i,not v) in literals for i,v in vector.items()):vectors.append(vector)
    return {'established':sorted(established),'literals':sorted(literals),'surviving':vectors,'pass':set(('conclusion',i,v) for i,v in cfg['required'].items())<=literals and len(vectors)==1}

def route(cfg,alternate=False):
    r=cfg['refs']
    first=[
      {'type':'investigate','action':'search_location','target':r['location:hof']},
      {'type':'interrogate','npc':r['person:nora'],'questionId':'question:q08'},
      {'type':'investigate','action':'examine_item','target':r['item:kamera']},
    ]
    last=[
      {'type':'interrogate','npc':r['person:oskar'],'questionId':'question:q14'},
      {'type':'investigate','action':'examine_item','target':r['item:terminal']}]
    return last+first if alternate else first+last

def public_view(cfg,state):
    return {'entities':[{'ref':r,'label':cfg['labels'][r]} for r in state['known'] if r in cfg['labels']],
            'observations':state['records'],'phase':state['phase']}


def validate_map(cfg):
    """Finite normative-map controls exercised here; not a complete Contract parser."""
    ids=[s['id'] for s in cfg['specs']]
    if len(set(ids))!=len(ids):raise Invalid('DUPLICATE_PREMISE')
    roots={o['id']:o for o in cfg['proof']['observations']}
    for s in cfg['specs']:
        if s['id'] not in roots:raise Invalid('FOREIGN_PREMISE')
        if s['kind']!=roots[s['id']]['kind']:raise Invalid('KIND')
        if s['kind']=='OBSERVED':
            if s['evidenceId'] not in cfg['evidence'] or s['licenseRuleId'] not in cfg['publicRules']:raise Invalid('MISSING_SOURCE')
            if s['report']['source']!={'kind':'observation'}:raise Invalid('SOURCE_CONFUSION')
            if s['literal']!=roots[s['id']]['literal']:raise Invalid('LITERAL')
            if s['report']['stance'] not in ('affirms','denies') or s['literal']['value'] is not (s['report']['stance']=='affirms'):raise Invalid('POLARITY')
            matches=[k for k,claim in cfg['literalClaims'].items() if claim==s['report']['claim']]
            if len(matches)!=1:raise Invalid('ALIAS_AMBIGUITY')
            if matches[0]!=('proposition',s['literal']['propositionId']):raise Invalid('CLAIM_MEANING')
        if s['kind']=='REPORTED_BY_NPC':
            stance=s['report']['stance'] if 'evidenceId' in s else s['stance']
            if stance not in ('affirms','denies'):raise Invalid('STANCE_PROMOTION')
            if s['literal']['value'] is not (stance=='affirms'):raise Invalid('POLARITY')
        if s['kind']=='PUBLIC_RULE':
            if s['ruleId'] not in cfg['publicRules'] or not set(s['afterObservations'])<=set(ids) or any(roots[i]['kind']=='PUBLIC_RULE' for i in s['afterObservations']):raise Invalid('LICENSE_GATE')
    return True
