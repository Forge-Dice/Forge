"""Bounded protocol model; no production imports, GitHub IO, or live certification."""
from dataclasses import dataclass, replace, asdict
from itertools import permutations
import json

@dataclass(frozen=True)
class State:
    main: str = 'B0'
    head: str = 'H0'
    open: bool = True
    accessible: bool = True
    review: str | None = None
    receipt: int | None = None
    technical: bool = False
    owner: bool = True
    attempt: int = 2

def gate(s):
    if not s.accessible: return 'EXECUTION_API'
    if not s.open: return 'PR_STATE'
    if s.main != 'B0' or s.head != 'H0': return 'PR_STALE'
    if s.review not in (None,'H0'): return 'REVIEW_BINDING'
    return 'PASS'

def final(s, start_review=None, enforce_snapshot=False):
    g=gate(s)
    if g!='PASS': return g
    if not s.technical: return 'NOT_READY'
    if s.review is None: return 'REVIEW_MISSING'
    if enforce_snapshot and s.review != start_review: return 'REVIEW_CHANGED'
    if not s.owner or s.attempt<2 or s.receipt!=s.attempt: return 'IDENTITY_RECHECK'
    return 'PASS'

def step(s, e):
    if e=='review': return replace(s,review='H0')
    if e=='gate': return replace(s,receipt=s.attempt if gate(s)=='PASS' else None)
    if e=='check': return replace(s,technical=True)
    if e=='main_move': return replace(s,main='B1')
    if e=='head_move': return replace(s,head='H1')
    if e=='closed': return replace(s,open=False)
    if e=='inaccessible': return replace(s,accessible=False)
    if e=='stale_review': return replace(s,review='OLD')
    return s

cases=[]
def case(name, events, expect, initial=None, snapshot=False):
    s=initial or State(); before=s.review
    for e in events: s=step(s,e)
    got=final(s,before,snapshot)
    assert got==expect,(name,got,expect)
    cases.append(dict(name=name,events=events,expected=expect,actual=got,state=asdict(s)))

case('review_before_check',['review','gate','check'],'PASS')
case('check_before_review_next_attempt',['check','review','gate'],'PASS')
case('main_moves',['review','gate','check','main_move'],'PR_STALE')
case('head_moves',['review','gate','check','head_move'],'PR_STALE')
case('rerun_after_main_move',['main_move','review','gate','check'],'PR_STALE')
case('developer_pushes_during_review',['review','head_move','gate','check'],'PR_STALE')
case('pr_closed',['review','gate','check','closed'],'PR_STATE')
case('branch_or_api_inaccessible',['review','gate','check','inaccessible'],'EXECUTION_API')
case('check_without_review',['gate','check'],'REVIEW_MISSING')
case('review_arrives_during_attempt',['gate','check','review'],'REVIEW_CHANGED',snapshot=True)
case('stable_wrong_head_review',['stale_review','gate','check'],'REVIEW_BINDING')
case('failed_jobs_receipt',['review','check'],'IDENTITY_RECHECK',initial=State(receipt=1))
case('developer_rerun',['review','gate','check'],'IDENTITY_RECHECK',initial=State(owner=False))

counts={}; pass_count=0
events=['gate','check','review','main_move','head_move','final']
for order in permutations(events):
    s=State(); result=None
    for e in order:
        if e=='final':
            result=final(s)
            if result=='PASS':
                assert s.main=='B0' and s.head=='H0' and s.open and s.accessible
                assert s.review=='H0' and s.technical and s.receipt==2 and s.owner
                pass_count+=1
        else: s=step(s,e)
    counts[result]=counts.get(result,0)+1

# Concrete limitation: a revocation AFTER final does not invalidate completed checks.
s=State(review='H0',receipt=2,technical=True)
assert final(s)=='PASS'
after=replace(s,review=None)
assert final(after)=='REVIEW_MISSING'
result={'label':'MODEL_ONLY_NOT_LIVE','named_cases':cases,'permutations':720,
        'outcomes':counts,'pass_at_observation':pass_count,
        'post_pass_revocation':{'completed_check':'PASS','fresh_evaluation':'REVIEW_MISSING',
                                'automatic_check_invalidation':False}}
with open('race-model-results.json','w') as f: json.dump(result,f,indent=2); f.write('\n')
print(json.dumps({'named_cases':len(cases),'permutations':720,'outcomes':counts,'post_pass_limit_confirmed':True}))
