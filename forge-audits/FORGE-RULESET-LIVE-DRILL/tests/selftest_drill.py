#!/usr/bin/env python3
"""Offline safety checks. No network, no GitHub mutations."""
import importlib.util, json, os, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('drill',ROOT/'drill.py')
d=importlib.util.module_from_spec(spec);spec.loader.exec_module(d)

class SafetyTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
        self.cfg=d.make_manifest('Forge-Dice/forge-ruleset-drill-selftest','test-run-001')
        self.cfg.update(repo_id=999111,main_sha='a'*40)
        self.ev=d.Evidence(self.root/'evidence')
    def tearDown(self):self.tmp.cleanup()
    def test_canonical_name_case_variants_blocked(self):
        for name in ['Forge-Dice/Forge','forge-dice/forge','FORGE-DICE/FORGE']:
            with self.assertRaisesRegex(ValueError,'CANONICAL'):d.validate_repo(name)
    def test_repo_path_or_command_injection_blocked(self):
        for name in ['Forge-Dice/forge-ruleset-drill-x/../Forge','Forge-Dice/forge-ruleset-drill-a$(id)','Wuerfelduell/forge-ruleset-drill-a']:
            with self.assertRaises(ValueError):d.validate_repo(name)
    def test_canonical_immutable_id_blocked(self):
        self.cfg['repo_id']=d.CANONICAL_ID
        with self.assertRaisesRegex(ValueError,'CANONICAL_ID'):d.API(self.cfg,'owner',self.ev,True)
    def test_immutable_main_binding_cannot_be_reset_by_rebind(self):
        class NeverAPI:
            def get(self,*a):raise AssertionError('Network during rebind')
        with self.assertRaisesRegex(ValueError,'ALREADY_BOUND_NO_REBIND'):d.bind(NeverAPI(),self.cfg)
        self.assertEqual(self.cfg['repo_id'],999111)
        self.assertEqual(self.cfg['main_sha'],'a'*40)
    def test_main_is_never_test_target_even_tampered_manifest(self):
        self.cfg['seed_refs'].append('refs/heads/main')
        with self.assertRaisesRegex(ValueError,'NON_TEST'):d.validate_target(self.cfg,'refs/heads/main')
    def test_historical_or_unlisted_ref_blocked(self):
        with self.assertRaisesRegex(ValueError,'NON_TEST'):d.validate_target(self.cfg,'refs/heads/forge/owner/old-history')
    def test_manifest_targets_all_disposable(self):
        for case in self.cfg['cases']:d.validate_target(self.cfg,case['ref'])
        self.assertNotIn('refs/heads/main',self.cfg['seed_refs'])
    def test_seven_rulesets_exact_actor_isolation(self):
        rules=d.spec(['refs/heads/main'],777)
        self.assertEqual(len(rules),7)
        self.assertEqual(rules[0]['bypass_actors'],[])
        self.assertEqual(rules[1]['bypass_actors'],[])
        self.assertEqual(rules[2]['bypass_actors'],[{'actor_type':'User','actor_id':315180734,'bypass_mode':'pull_request'}])
        self.assertEqual(rules[3]['bypass_actors'][0]['actor_id'],337272506)
        self.assertEqual(rules[4]['bypass_actors'][0]['actor_id'],315180734)
        self.assertEqual(rules[5]['bypass_actors'],[]);self.assertEqual(rules[6]['bypass_actors'],[])
    def test_r1_immutable_rules_cannot_inherit_writer_bypass(self):
        rules=d.spec(['refs/heads/main'],777)
        self.assertEqual({r['type'] for r in rules[0]['rules']},{'deletion','non_fast_forward'})
        for rs in rules[2:6]:
            self.assertEqual({r['type'] for r in rs['rules']},{'creation','update'})
            self.assertFalse(rs['rules'][1]['parameters']['update_allows_fetch_and_merge'])
    def test_r2_zero_approval_no_last_pusher_and_app_pinned(self):
        rs=d.spec(['refs/heads/main'],777)[1]
        pr=rs['rules'][0]['parameters'];check=rs['rules'][1]['parameters']
        self.assertEqual(pr['required_approving_review_count'],0)
        self.assertFalse(pr['require_last_push_approval']);self.assertFalse(pr['require_code_owner_review'])
        self.assertTrue(check['strict_required_status_checks_policy'])
        self.assertEqual(check['required_status_checks'],[{'context':'forge-gate','integration_id':777},{'context':'forge-verify','integration_id':777}])
    def test_drill_aliases_not_covered_by_writer_rules(self):
        rules=d.spec(self.cfg['main_targets'],777)
        self.assertIn('refs/heads/main',rules[1]['conditions']['ref_name']['include'])
        self.assertEqual(rules[1]['conditions'],rules[2]['conditions'])
        for ref in self.cfg['main_targets']:
            self.assertFalse(ref.startswith('refs/heads/forge/owner/'))
            self.assertFalse(ref.startswith('refs/heads/forge/run/codex/'))
            self.assertIn(ref,rules[5]['conditions']['ref_name']['exclude'])
    def test_actions_all_paths_only_pr_target_two_users(self):
        p=d.policy()
        self.assertEqual(p['conditions'],{'workflow_path':{'include':['~ALL'],'exclude':[]}})
        self.assertEqual(p['rules'][0]['parameters']['allowed_actors'],[{'id':315180734,'type':'User'},{'id':337272506,'type':'User'}])
        self.assertEqual(p['rules'][1]['parameters']['allowed_events'],['pull_request_target'])
    def test_generic_errors_never_count_as_ruleset_pass(self):
        for status,body in [(403,{'message':'Resource not accessible by personal access token'}),(422,{'message':'Reference already exists'}),(409,{'message':'No common ancestor'}),(403,{'message':'API rate limit exceeded'})]:
            self.assertFalse(d.protected_denial(status,body))
        self.assertTrue(d.protected_denial(422,{'message':'Repository rule violations found'}))
    def test_no_mutations_without_execute_and_no_http_request(self):
        with patch.dict(os.environ,{'FORGE_OWNER_TOKEN':'SYNTHETIC_TEST_TOKEN'}),patch('urllib.request.urlopen') as network:
            api=d.API(self.cfg,'owner',self.ev,False)
            with self.assertRaisesRegex(ValueError,'MUTATION_REQUIRES'):api.call('DELETE',api.prefix+'/git/refs/heads/fixture')
            network.assert_not_called()
    def test_outside_repo_writes_blocked_without_network(self):
        with patch.dict(os.environ,{'FORGE_OWNER_TOKEN':'SYNTHETIC_TEST_TOKEN'}),patch('urllib.request.urlopen') as network:
            api=d.API(self.cfg,'owner',self.ev,True)
            with self.assertRaisesRegex(ValueError,'OUTSIDE'):api.call('PATCH','/repos/Forge-Dice/Forge/git/refs/heads/main',{})
            network.assert_not_called()
    def test_evidence_chain_detects_tampering(self):
        self.ev.add('CHECK',{'head':'a'});self.ev.add('CHECK',{'head':'b'})
        d.Evidence(self.root/'evidence')
        lines=self.ev.log.read_text().splitlines();obj=json.loads(lines[0]);obj['data']['head']='forged';lines[0]=json.dumps(obj)
        self.ev.log.write_text('\n'.join(lines)+'\n')
        with self.assertRaisesRegex(ValueError,'CHAIN_INVALID'):d.Evidence(self.root/'evidence')
    def test_stop_persists_and_blocks_before_network(self):
        with self.assertRaisesRegex(RuntimeError,'STOP latched'):self.ev.stop('UNEXPECTED_ALLOW',{'after':'b'})
        self.assertTrue((self.ev.root/'STOP.json').exists())
        class NeverAPI:
            ev=self.ev
            def get(self,*a):raise AssertionError('Network after STOP')
        with self.assertRaisesRegex(ValueError,'STOP_LATCHED'):d.guard(NeverAPI())
    def fake_ref_result(self,status,body,after):
        cfg=self.cfg;ev=self.ev
        class FakeAPI:
            prefix='/repos/'+cfg['repo']
            def __init__(self):self.ev=ev;self.n=0;self.writes=[]
            def call(self,method,path,data=None,allow_status=()):
                if method=='GET':
                    self.n+=1
                    if self.n==1:return (404,None)
                    return (404,None) if after is None else (200,{'object':{'sha':after}})
                self.writes.append((method,path,data));return status,body
        case=next(c for c in cfg['cases'] if c['id']=='R6-CREATE-owner-forge-stray-test-run-001')
        return FakeAPI(),case
    def test_unexpected_allow_records_no_auto_delete(self):
        api,case=self.fake_ref_result(201,{'object':{'sha':self.cfg['main_sha']}},self.cfg['main_sha'])
        with self.assertRaisesRegex(RuntimeError,'UNEXPECTED_ALLOW'):d.do_ref(api,self.cfg,case)
        self.assertEqual([w[0] for w in api.writes],['POST'])
        self.assertTrue((self.ev.root/'STOP.json').exists())
    def test_permission_denial_is_inconclusive_not_pass(self):
        api,case=self.fake_ref_result(403,{'message':'Resource not accessible by integration'},None)
        with self.assertRaisesRegex(RuntimeError,'DENIAL_NOT_PROVEN'):d.do_ref(api,self.cfg,case)
        self.assertNotIn(case['id'],self.cfg['results'])
    def test_rule_denial_and_unchanged_ref_can_pass(self):
        api,case=self.fake_ref_result(422,{'message':'Repository rule violations found'},None)
        d.do_ref(api,self.cfg,case)
        self.assertEqual(self.cfg['results'][case['id']]['status'],'PASS')
    def test_denied_http_but_changed_ref_still_stops(self):
        api,case=self.fake_ref_result(422,{'message':'Repository rule violations found'},'b'*40)
        with self.assertRaisesRegex(RuntimeError,'UNEXPECTED_ALLOW'):d.do_ref(api,self.cfg,case)
    def test_unsupported_actions_token_not_impersonated_by_pat(self):
        with patch.dict(os.environ,{'GITHUB_TOKEN':'SYNTHETIC_ACTIONS_TOKEN','GITHUB_ACTIONS':'false'}):
            api=d.API(self.cfg,'actions',self.ev,True)
            with self.assertRaisesRegex(ValueError,'ONLY_INSIDE'):d.authenticate(api)
    def test_root_window_explicit_and_no_delete_cleanup(self):
        roots=[c for c in self.cfg['cases'] if c['phase']=='ROOT_FIRST']
        self.assertEqual(len(roots),6)
        self.assertTrue(all(c['operation']=='create' and c['expected']=='DENY' for c in roots))
        source=(ROOT/'drill.py').read_text()
        self.assertNotIn('sub.add_parser("cleanup")',source)
        self.assertNotIn('sub.add_parser("clear-stop")',source)
    def test_cases_unique_and_actions_mode_has_preseeded_candidates(self):
        cases=self.cfg['cases'];self.assertEqual(len(cases),len({c['id'] for c in cases}))
        for c in cases:
            if c['actor']=='actions' and c['operation'] in ['ff','nff']:
                self.assertIn(self.cfg['m0_candidates'][c['id']],self.cfg['seed_refs'])
    def test_async_http_200_failed_is_denial_not_allow(self):
        cfg=self.cfg;ev=self.ev
        class FakeAPI:
            prefix='/repos/'+cfg['repo']
            def __init__(self):self.ev=ev
            def call(self,method,path,data=None,allow_status=()):
                self.assert_read=method=='GET'
                return 200,{'object':{'sha':cfg['main_sha']}}
        case=next(c for c in cfg['cases'] if c['id']=='MERGE-green-codex-codex')
        api=FakeAPI()
        d.finish_merge(api,cfg,case,5,cfg['main_sha'],'b'*40,200,{'status':'failed','details':{'message':'Repository rule violations found'}})
        self.assertEqual(cfg['results'][case['id']]['status'],'PASS')
        self.assertTrue(api.assert_read)
    def test_async_pending_is_never_pass_and_keeps_pending_lock(self):
        cfg=self.cfg;ev=self.ev
        case=next(c for c in cfg['cases'] if c['id']=='MERGE-green-codex-codex')
        cfg['pending_merges'][case['id']]={'case':case,'uuid':'00000000-0000-0000-0000-000000000001','pr':5,'before':cfg['main_sha'],'head':'b'*40}
        class FakeAPI:
            prefix='/repos/'+cfg['repo']
            def __init__(self):self.ev=ev
            def get(self,path):return {'status':'pending'}
            def call(self,method,path,data=None,allow_status=()):
                if method!='GET':raise AssertionError('Mutation during pending observation')
                return 200,{'object':{'sha':cfg['main_sha']}}
        d.merge_result(FakeAPI(),cfg,case['id'])
        self.assertIn(case['id'],cfg['pending_merges'])
        self.assertNotIn(case['id'],cfg['results'])
    def test_async_unexpected_merge_stops_without_rollback(self):
        cfg=self.cfg;ev=self.ev
        class FakeAPI:
            prefix='/repos/'+cfg['repo']
            def __init__(self):self.ev=ev;self.methods=[]
            def call(self,method,path,data=None,allow_status=()):
                self.methods.append(method);return 200,{'object':{'sha':'c'*40}}
        case=next(c for c in cfg['cases'] if c['id']=='MERGE-green-codex-codex')
        api=FakeAPI()
        with self.assertRaisesRegex(RuntimeError,'UNEXPECTED_ALLOW'):
            d.finish_merge(api,cfg,case,5,cfg['main_sha'],'b'*40,200,{'status':'merged','details':{'sha':'c'*40}})
        self.assertEqual(api.methods,['GET'])
        self.assertTrue((ev.root/'STOP.json').exists())
    def test_nonpaginated_large_ref_list_is_not_retried(self):
        with patch.dict(os.environ,{'FORGE_OWNER_TOKEN':'SYNTHETIC_TEST_TOKEN'}):
            api=d.API(self.cfg,'owner',self.ev,False);calls=[]
            def get(path):
                calls.append(path);api.last_headers={};return list(range(126))
            api.get=get
            self.assertEqual(len(api.list(api.prefix+'/git/matching-refs/')),126)
            self.assertEqual(len(calls),1)
    def test_pagination_follows_server_link_only(self):
        with patch.dict(os.environ,{'FORGE_OWNER_TOKEN':'SYNTHETIC_TEST_TOKEN'}):
            api=d.API(self.cfg,'owner',self.ev,False);calls=[]
            def get(path):
                calls.append(path);api.last_headers={'Link':'<https://api.github.com/a?page=2>; rel="next"'} if len(calls)==1 else {}
                return [len(calls)]
            api.get=get
            self.assertEqual(api.list(api.prefix+'/rulesets'),[1,2])
            self.assertEqual(len(calls),2)

if __name__=='__main__':unittest.main(verbosity=2)
