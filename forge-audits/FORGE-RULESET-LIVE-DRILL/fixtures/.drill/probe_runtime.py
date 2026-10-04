import datetime, json, os, sys, time, urllib.error, urllib.parse, urllib.request

PLAN=json.loads(__ACTION_PLAN_LITERAL__)
TOKEN=os.environ['PROBE_TOKEN']
PREFIX='/repos/'+PLAN['repo']
RESULT={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'requests':[],
        'repository':PLAN['repo'],'run_id':os.environ['GITHUB_RUN_ID'],
        'attempt':os.environ['GITHUB_RUN_ATTEMPT'],'workflow_sha':os.environ['WORKFLOW_SHA']}

def finish(verdict, **detail):
    RESULT.update(verdict=verdict,**detail)
    print('FORGE_PROBE_RESULT '+json.dumps(RESULT,sort_keys=True))
    sys.exit(0 if verdict in ['PASS_RULE_DENIAL','PASS_PERMISSION_DENIAL','PASS_TOKEN_CONTROL'] else 1)

def call(method,path,body=None):
    assert path.startswith(PREFIX+'/') or (method=='GET' and path==PREFIX)
    req=urllib.request.Request('https://api.github.com'+path,method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={**({'Authorization':'Bearer '+TOKEN} if method!='GET' or '/actions-trigger/M0/' not in os.environ.get('GITHUB_HEAD_REF','') else {}),
                 'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10',
                 'User-Agent':'forge-trusted-token-probe'})
    try:
        with urllib.request.urlopen(req,timeout=20) as r:status=r.status;raw=r.read();request_id=r.headers.get('X-GitHub-Request-Id')
    except urllib.error.HTTPError as e:status=e.code;raw=e.read();request_id=e.headers.get('X-GitHub-Request-Id')
    text=raw.decode().replace(TOKEN,'[REDACTED]')
    value=json.loads(text) if text else None
    RESULT['requests'].append({'method':method,'path':path,'status':status,'body':body,
                               'response':value,'request_id':request_id})
    return status,value

def read(path):
    s,v=call('GET',path)
    if s!=200:finish('INCONCLUSIVE_READ',status=s,path=path)
    return v

def ref_state(ref):
    status,v=call('GET',PREFIX+'/git/ref/'+urllib.parse.quote(ref[5:],safe='/'))
    if status==404:return None
    if status!=200:finish('INCONCLUSIVE_REF_READ',ref=ref,status=status)
    return v['object']['sha']

def new_commit(parent,label,sibling=False):
    obj=read(PREFIX+'/git/commits/'+parent)
    s,t=call('POST',PREFIX+'/git/trees',{'base_tree':obj['tree']['sha'],
      'tree':[{'path':'.drill/probe-'+label+'.txt','type':'blob','mode':'100644','content':label+'\n'}]})
    if s!=201:finish('INCONCLUSIVE_WRITE_TOKEN_OR_TREE',status=s)
    parents=[p['sha'] for p in obj['parents']] if sibling else [parent]
    s,c=call('POST',PREFIX+'/git/commits',{'message':'FORGE trusted probe '+label,'tree':t['sha'],'parents':parents})
    if s!=201:finish('INCONCLUSIVE_WRITE_TOKEN_OR_COMMIT',status=s)
    return c['sha']

assert os.environ['GITHUB_REPOSITORY']==PLAN['repo']
assert os.environ['GITHUB_EVENT_NAME']=='pull_request_target'
event=json.load(open(os.environ['GITHUB_EVENT_PATH']))
pr=event['pull_request']
assert pr['user']['id']==315180734, 'Owner must trigger each probe'
assert pr['base']['ref']==PLAN['scenarios']['actions-probe']['base'][11:]
repo=read(PREFIX)
assert repo['id']!=1401864629 and repo['full_name']==PLAN['repo'] and not repo['fork']
assert repo['default_branch']=='main' and repo['visibility']=='public'
main=ref_state('refs/heads/main')
assert main==os.environ['WORKFLOW_SHA'], 'Default main/workflow provenance mismatch'
prefix='forge/owner/'+PLAN['run_id']+'/actions-trigger/'
assert pr['head']['ref'].startswith(prefix)
selection=pr['head']['ref'][len(prefix):]

if selection=='CONTROL':
    target=PLAN['actions_control_ref']
    before=ref_state(target)
    if before is not None:finish('INCONCLUSIVE_CONTROL_ALREADY_EXISTS')
    s,v=call('POST',PREFIX+'/git/refs',{'ref':target,'sha':main})
    if s!=201:finish('INCONCLUSIVE_TOKEN_CONTROL_CREATE',status=s)
    child=new_commit(main,'write-control')
    s,v=call('PATCH',PREFIX+'/git/refs/'+target[5:],{'sha':child,'force':False})
    after=ref_state(target)
    if s!=200 or after!=child:finish('INCONCLUSIVE_TOKEN_CONTROL_UPDATE',status=s,after=after)
    finish('PASS_TOKEN_CONTROL',ref=target,before=None,after=after)

mode,cid=selection.split('/',1)
assert mode in ['M0','M1'] and cid in PLAN['cases']
case=PLAN['cases'][cid];ref=case['ref'];op=case['operation']
assert ref!='refs/heads/main' and ref in set(PLAN['seed_refs']+[c['ref'] for c in PLAN['cases'].values()])
RESULT.update(mode=mode,case=cid,operation=op,ref=ref)
before=ref_state(ref);RESULT['before']=before
if op=='pr_create':assert mode=='M0', 'PR structural permission test is M0 only'
if op=='create':assert before is None
else:assert before is not None
candidate=main
if op in ['ff','nff'] and mode=='M1':
    candidate=new_commit(before,cid.lower(),sibling=op=='nff')
    comp=read(PREFIX+'/compare/'+before+'...'+candidate)
    assert comp['status']=='ahead' if op=='ff' else comp['status'] in ['diverged','behind']
if op in ['ff','nff'] and mode=='M0':
    # Use an existing sibling marker commit; metadata fixture is preseeded, no object write permission is needed.
    candidate=ref_state(PLAN['m0_candidates'][cid])
    assert candidate and candidate!=before
    comp=read(PREFIX+'/compare/'+before+'...'+candidate)
    assert comp['status']=='ahead' if op=='ff' else comp['status'] in ['diverged','behind']
path=PREFIX+'/git/refs/'+ref[5:]
if op=='create':status,body=call('POST',PREFIX+'/git/refs',{'ref':ref,'sha':candidate})
elif op=='pr_create':
    sc=PLAN['scenarios']['actions-pr']
    status,body=call('POST',PREFIX+'/pulls',{'title':'FORGE M0 Actions PR permission probe',
      'head':sc['head'][11:],'base':sc['base'][11:],'draft':False})
elif op=='delete':status,body=call('DELETE',path)
elif op=='merge':
    sc=PLAN['scenarios']['green-codex-actions']
    query=urllib.parse.urlencode({'state':'open','base':sc['base'][11:], 'head':'Forge-Dice:'+sc['head'][11:]})
    prs=read(PREFIX+'/pulls?'+query)
    assert len(prs)==1, 'Exactly one green Actions-merge PR required'
    live=read(PREFIX+'/pulls/'+str(prs[0]['number']))
    assert live['base']['ref']==sc['base'][11:] and live['head']['ref']==sc['head'][11:]
    checks=read(PREFIX+'/commits/'+live['head']['sha']+'/check-runs?filter=latest&per_page=100')['check_runs']
    picked=[c for c in checks if c['name'] in ['forge-gate','forge-verify'] and c['head_sha']==live['head']['sha']
            and c['conclusion']=='success' and c['app']['slug']=='github-actions']
    assert len(picked)==2 and {c['name'] for c in picked}=={'forge-gate','forge-verify'}, 'GREEN_CHECK_PRECONDITION_REQUIRED'
    status,body=call('PUT',PREFIX+'/pulls/'+str(live['number'])+'/merge-async',
      {'sha':live['head']['sha'],'merge_method':'merge','merge_action':'direct_merge','bypass_rules':True})
    if status in [202,409]:
        uuid=body.get('uuid') or body.get('details',{}).get('uuid')
        assert uuid and isinstance(uuid,str), 'Merge UUID must be recorded'
        RESULT['merge_uuid']=uuid
        until=time.monotonic()+45
        while time.monotonic()<until:
            status,body=call('GET',PREFIX+'/pulls/'+str(live['number'])+'/merge-async/'+uuid)
            if status!=200:finish('INCONCLUSIVE_ASYNC_RESULT_READ')
            if body.get('status')!='pending':break
            time.sleep(2)
        if body.get('status')=='pending':finish('INCONCLUSIVE_ASYNC_MERGE_PENDING_OWNER_MUST_FREEZE')
        if body.get('status') not in ['failed','merged']:finish('INCONCLUSIVE_ASYNC_RESULT_STATE')
else:status,body=call('PATCH',path,{'sha':candidate,'force':op=='nff'})
after=ref_state(ref);RESULT.update(after=after,status=status,response=body,candidate=candidate)
allowed=(body and body.get('status')=='merged') if op=='merge' else 200<=status<300
if allowed or after!=before:finish('STOP_UNEXPECTED_ALLOW')
message=json.dumps(body).lower()
if mode=='M0':
    if status==403 and any(x in message for x in ['resource not accessible','permission','not authorized']):finish('PASS_PERMISSION_DENIAL')
    finish('INCONCLUSIVE_M0_DENIAL')
if any(x in message for x in ['gh013','repository rule','ruleset','protected branch','branch protection','rule violations']):
    finish('PASS_RULE_DENIAL')
finish('INCONCLUSIVE_NOT_RULE_ENFORCEMENT')
