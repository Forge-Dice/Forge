import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const repo=process.argv[2], out=process.argv[3];
const imp=p=>import(pathToFileURL(repo+'/'+p));
const T=await imp('src/domain/case-truth.ts'), TI=await imp('src/domain/case-truth.identity.ts');
const S=await imp('src/domain/case-solution.ts'), SI=await imp('src/domain/case-solution.identity.ts');
const N=await imp('src/domain/npc-knowledge.ts'), P=await imp('src/domain/npc-knowledge.projection.ts');
const {validateCaseSemantics:sem}=await imp('src/domain/case-semantics.ts');
const F=await imp('tests/npc-knowledge.fixture.ts'), SF=await imp('tests/case-solution.fixture.ts');
const {fullCase}=await imp('tests/case-truth.fixture.ts');
const clone=structuredClone, eq=assert.deepEqual;
const rows=[], notes=[];
function test(group,id,name,basis,fn) { try { const detail=fn(); rows.push({group,id,name,basis,status:'PASS',detail:detail??null}); } catch(e) { rows.push({group,id,name,basis,status:'FAIL',error:e.stack}); } }
function frozen(o) { if(o&&typeof o==='object'){assert(Object.isFrozen(o)); Object.values(o).forEach(frozen);} }
function objects(o,set=new Set()) {if(o&&typeof o==='object'&&!set.has(o)){set.add(o);Object.values(o).forEach(v=>objects(v,set));}return set;}
function disjoint(a,...sources){const src=new Set(sources.flatMap(s=>[...objects(s)]));for(const v of objects(a))assert(!src.has(v));}
const canonical=o=>Array.isArray(o)?'['+o.map(canonical).join(',')+']':o&&typeof o==='object'?'{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+canonical(o[k])).join(',')+'}':JSON.stringify(o);
const sha=o=>createHash('sha256').update(canonical(o)).digest('hex');
function rejected(fn,part){let e;try{fn();}catch(err){e=err;}assert(e,'expected rejection');if(part)assert(String(e).includes(part));return true;}
function safeSolution(truth,input){return S.createCaseSolutionSchema(truth).safeParse(input);}
// Diagnostic oracle ONLY: do not export/copy/private-import resolveConclusion.
// Replace the authoring required literal in a scratch copy, call PUBLIC parser for both values.
// Every rejection must be exactly the answer-key-value issue, not a different validation defect.
function oracle(truth,solution,id){
 assert(solution.conclusions.some(c=>c.id===id),'unknown diagnostic conclusion');
 const accepts=[];
 for(const value of [true,false]){
  const input=clone(solution);input.requiredConclusions=[{conclusionId:id,value}];
  const r=safeSolution(truth,input);
  if(r.success) accepts.push(value);
  else assert(r.error.issues.every(i=>JSON.stringify(i.path)==='["requiredConclusions",0,"value"]'),JSON.stringify(r.error.issues));
 }
 assert(accepts.length<=1);
 return accepts.length?accepts[0]:'undetermined';
}
function solutionCase(claim,edit=()=>{},expected=true){
 const truth=SF.solutionTruth(), input=SF.baseSolution(); edit(input.resolutions[0],input);
 input.conclusions=[{id:'conclusion:probe',claim}];
 // An independent, true intent anchor keeps all three resolver outcomes parsable.
 if(expected==='undetermined'){
  input.conclusions.push({id:'conclusion:anchor',claim:{kind:'eventCausedEvent',causeEventId:'event:poisoning',eventId:'event:death'}});
  input.requiredConclusions=[{conclusionId:'conclusion:anchor',value:true}];
 }else input.requiredConclusions=[{conclusionId:'conclusion:probe',value:expected}];
 const solution=S.parseCaseSolution(input,truth);eq(oracle(truth,solution,'conclusion:probe'),expected);
 return {truth,solution};
}
const resp=(personId='person:a')=>({kind:'personResponsibleForEvent',personId,eventId:'event:death'});
const role=(role='direct_actor',personId='person:a')=>({kind:'personRoleForEvent',personId,eventId:'event:death',role});
const cause=(causeEventId)=>({kind:'eventCausedEvent',causeEventId,eventId:'event:death'});
const none={kind:'noPersonResponsibleForEvent',eventId:'event:death'};
const intent=value=>({kind:'eventIntent',eventId:'event:death',value});
const mech=value=>({kind:'eventMechanism',eventId:'event:death',value});
let ai=0;
function a(name,claim,edit,expected){test('VS1','A'+String(++ai).padStart(2,'0'),name,'REAL_PUBLIC_PARSER_ORACLE',()=>{solutionCase(claim,edit,expected);return expected;});}
a('assigned complete',resp(),()=>{},true);
a('assigned partial',resp(),r=>r.responsibility.completeness='partial',true);
a('absent complete',resp('person:b'),()=>{},false);
a('absent partial',resp('person:b'),r=>r.responsibility.completeness='partial','undetermined');
a('role included',role(),()=>{},true);
a('role excluded',role('planner'),()=>{},false);
a('role null',role(),r=>r.responsibility.assignments[0].roles=null,'undetermined');
a('role person absent complete',role('planner','person:b'),()=>{},false);
a('role person absent partial',role('planner','person:b'),r=>r.responsibility.completeness='partial','undetermined');
a('known role list closed although partial',role('planner'),r=>r.responsibility.completeness='partial',false);
a('no person complete empty',none,r=>r.responsibility.assignments=[],true);
a('no person partial empty',none,r=>{r.responsibility.assignments=[];r.responsibility.completeness='partial';},'undetermined');
a('no person assigned complete',none,()=>{},false);
a('no person assigned partial',none,r=>r.responsibility.completeness='partial',false);
a('direct cause closed',cause('event:poisoning'),()=>{},true);
a('direct cause open',cause('event:poisoning'),r=>r.causesComplete=false,true);
a('missing cause closed',cause('event:storm'),()=>{},false);
a('missing cause open',cause('event:storm'),r=>r.causesComplete=false,'undetermined');
a('transitive cause not direct',cause('event:purchase'),()=>{},false);
a('intent exact',intent('intended'),()=>{},true);
a('intent other',intent('unintended'),()=>{},false);
a('intent unknown',intent('intended'),r=>r.intent=null,'undetermined');
a('intent not applicable',intent('not_applicable'),r=>r.intent='not_applicable',true);
a('ordinary mechanism exact',mech('ordinary'),()=>{},true);
a('supernatural excludes ordinary',mech('ordinary'),r=>r.mechanism='supernatural',false);
a('supernatural exact',mech('supernatural'),r=>r.mechanism='supernatural',true);
a('mixed exact',mech('mixed'),r=>r.mechanism='mixed',true);
a('mixed not supernatural',mech('supernatural'),r=>r.mechanism='mixed',false);
a('mechanism null',mech('ordinary'),r=>r.mechanism=null,'undetermined');
a('multiple responsible persons',resp('person:b'),r=>r.responsibility.assignments.push({personId:'person:b',roles:['facilitator']}),true);
a('responsible known despite unknown role',resp(),r=>r.responsibility.assignments[0].roles=null,true);
test('VS1','A32','negative requirement accepted','REAL',()=>solutionCase(resp('person:b'),()=>{},false).solution.requiredConclusions[0]);
test('VS1','A33','unknown required false rejected','REAL',()=>{const {truth,solution}=solutionCase(resp('person:b'),r=>r.responsibility.completeness='partial','undetermined');const i=clone(solution);i.requiredConclusions=[{conclusionId:'conclusion:probe',value:false}];assert(!safeSolution(truth,i).success);});
test('VS1','A34','unknown required true rejected','REAL',()=>{const {truth,solution}=solutionCase(resp('person:b'),r=>r.responsibility.completeness='partial','undetermined');const i=clone(solution);i.requiredConclusions=[{conclusionId:'conclusion:probe',value:true}];assert(!safeSolution(truth,i).success);});
test('VS1','A35','same caseId changed truth fails binding','REAL',()=>{const t=SF.solutionTruthInput();t.title+=' changed';assert(!safeSolution(T.parseCaseTruth(t),SF.baseSolution()).success);});
test('VS1','A36','foreign conclusion fails','REAL',()=>{const i=SF.baseSolution();i.requiredConclusions[0].conclusionId='conclusion:foreign';assert(!safeSolution(SF.solutionTruth(),i).success);});
test('VS1','A37','answer key parses inconsistent truth; semantics separate','REAL',()=>{const i=SF.solutionTruthInput();i.events[0].time.at=30;const t=T.parseCaseTruth(i),s=SF.baseSolution();s.truthHash=TI.hashCaseTruth(t);S.parseCaseSolution(s,t);assert(sem(t).findings.some(f=>f.code==='CAUSE_STARTS_AFTER_EFFECT'));return sem(t).findings.map(f=>f.code);});
test('VS1','A38','resolver absent from exports','REAL',()=>{assert(!('resolveConclusion' in S));return Object.keys(S).sort();});
test('VS1','A39','responsibility not physical presence','REAL',()=>{const t=SF.solutionTruth(),s=S.parseCaseSolution(SF.baseSolution(),t);assert(!t.events.find(e=>e.id==='event:death').participantIds.includes('person:a'));eq(oracle(t,s,'conclusion:a-responsible'),true);eq(sem(t).findings,[]);});
test('VS1','A40','duplicate opposite required rejected','REAL',()=>{const i=SF.baseSolution();i.requiredConclusions.push({conclusionId:i.requiredConclusions[0].conclusionId,value:false});assert(!safeSolution(SF.solutionTruth(),i).success);});

// VS2 feasibility stub, NOT a production AccessMap contract/implementation.
// Access is independently authored, null means inaccessible; no source-derived placement.
const actionKind={search_location:'location',examine_item:'item',examine_person:'person'};
const collection={person:'persons',location:'locations',item:'items'};
function bindAccess(truth,map){
 assert.equal(map.caseId,truth.caseId);assert.equal(map.truthHash,TI.hashCaseTruth(truth));
 assert.equal(map.entries.length,truth.evidence.length);
 const seen=new Set();
 for(const entry of map.entries){assert(truth.evidence.some(e=>e.id===entry.evidenceId));assert(!seen.has(entry.evidenceId));seen.add(entry.evidenceId);
  if(entry.access!==null){const k=actionKind[entry.access.kind];assert(k);assert(truth[collection[k]].some(x=>x.id===entry.access.id));}
 }
 return clone(map);
}
function accessMap(truth){return {caseId:truth.caseId,truthHash:TI.hashCaseTruth(truth),entries:truth.evidence.map(e=>({evidenceId:e.id,access:null}))};}
function investigate(truth,map,action){
 bindAccess(truth,map);
 const k=actionKind[action.kind];assert(k);assert(truth[collection[k]].some(x=>x.id===action.id));
 const ids=truth.evidence.map(e=>e.id).sort();
 return map.entries.filter(e=>e.access&&e.access.kind===action.kind&&e.access.id===action.id).map(e=>({kind:'evidence',index:ids.indexOf(e.evidenceId)+1})).sort((a,b)=>a.index-b.index);
}
// Scratch IDs in requests/maps remain trusted-host data. Only opaque result handles are player DTOs.
let bi=0;
function b(name,basis,fn){test('VS2','B'+String(++bi).padStart(2,'0'),name,basis,fn);}
for(const [kind,id] of [['person','person:anna'],['location','location:garden'],['item','item:letter-opener'],['event','event:walk']]){
 b('source variant '+kind,'REAL',()=>{const i=fullCase();i.evidence[0].source={kind,id};return T.parseCaseTruth(i).evidence[0].source.kind;});
}
b('evidence supports false proposition allowed','REAL',()=>{const t=T.parseCaseTruth(fullCase());const p=t.propositions.find(p=>p.id===t.evidence[0].links[0].propositionId);eq(p.truth,false);eq(sem(t).findings,[]);});
b('refutes true proposition also not semantic error','REAL',()=>{const i=fullCase();i.evidence[0].links[1].direction='refutes';eq(sem(T.parseCaseTruth(i)).findings,[]);});
b('multiple links allowed','REAL',()=>eq(T.parseCaseTruth(fullCase()).evidence[0].links.length,2));
b('duplicate link rejected','REAL',()=>{const i=fullCase();i.evidence[0].links.push(clone(i.evidence[0].links[0]));assert(!T.CaseTruthSchema.safeParse(i).success);});
b('opposite link same proposition rejected','REAL',()=>{const i=fullCase();i.evidence[0].links.push({...i.evidence[0].links[0],direction:'refutes'});assert(!T.CaseTruthSchema.safeParse(i).success);});
b('empty links rejected','REAL',()=>{const i=fullCase();i.evidence[0].links=[];assert(!T.CaseTruthSchema.safeParse(i).success);});
b('unknown proposition link rejected','REAL',()=>{const i=fullCase();i.evidence[0].links[0].propositionId='proposition:foreign';assert(!T.CaseTruthSchema.safeParse(i).success);});
for(const kind of ['location','item','person','event'])b('unknown source '+kind,'REAL',()=>{const i=fullCase();i.evidence[0].source={kind,id:kind+':foreign'};assert(!T.CaseTruthSchema.safeParse(i).success);});
const ft=T.parseCaseTruth(fullCase());
for(const [kind,id] of [['search_location','location:library'],['examine_item','item:gloves'],['examine_person','person:ben']])
 b('accessible at '+kind,'MOCK+REAL_REFERENCES',()=>{const m=accessMap(ft);m.entries[0].access={kind,id};eq(investigate(ft,m,{kind,id}).length,1);});
b('source need not equal access target','MOCK+REAL_REFERENCES',()=>{const m=accessMap(ft);m.entries[0].access={kind:'search_location',id:'location:garden'};eq(ft.evidence[0].source,{kind:'item',id:'item:letter-opener'});eq(investigate(ft,m,m.entries[0].access).length,1);});
b('same target multiple evidence','MOCK',()=>{const m=accessMap(ft),action={kind:'search_location',id:'location:library'};m.entries[0].access=action;m.entries[1].access=action;eq(investigate(ft,m,action).length,2);});
b('known target no evidence','MOCK',()=>eq(investigate(ft,accessMap(ft),{kind:'search_location',id:'location:library'}),[]));
b('inaccessible evidence','MOCK',()=>{const m=accessMap(ft);eq(investigate(ft,m,{kind:'examine_item',id:'item:letter-opener'}),[]);});
b('all evidence covered','MOCK',()=>{const m=accessMap(ft);m.entries.pop();rejected(()=>bindAccess(ft,m));});
b('duplicate evidence mapping rejected','MOCK',()=>{const m=accessMap(ft);m.entries[1]=clone(m.entries[0]);rejected(()=>bindAccess(ft,m));});
b('foreign evidence rejected','MOCK',()=>{const m=accessMap(ft);m.entries[0].evidenceId='evidence:foreign';rejected(()=>bindAccess(ft,m));});
b('wrong truth hash rejected','MOCK',()=>{const m=accessMap(ft);m.truthHash='0'.repeat(64);rejected(()=>bindAccess(ft,m));});
for(const [kind,id] of [['search_location','location:foreign'],['examine_item','item:foreign'],['examine_person','person:foreign']])
 b('unknown target '+kind,'MOCK',()=>{const m=accessMap(ft);m.entries[0].access={kind,id};rejected(()=>bindAccess(ft,m));});
b('event source not investigation action','MOCK',()=>rejected(()=>investigate(ft,accessMap(ft),{kind:'examine_event',id:'event:walk'})));
b('no source description IDs links in player DTO','MOCK',()=>{const m=accessMap(ft),a={kind:'examine_item',id:'item:letter-opener'};m.entries[0].access=a;const out=investigate(ft,m,a);eq(Object.keys(out[0]),['kind','index']);assert(!JSON.stringify(out).includes('proposition:'));assert(!JSON.stringify(out).includes('evidence:'));});
b('NPC observed player inaccessible','REAL+MOCK',()=>{const w=F.world(),i=F.npcInput(w.truth,w.solution);i.awareness=[F.aware('evidence','bloody-knife',400,{kind:'observed_evidence',evidenceId:'evidence:bloody-knife'})];N.parseNpcKnowledge(i,w.truth,w.solution);eq(investigate(w.truth,accessMap(w.truth),{kind:'examine_item',id:'item:knife'}),[]);});
b('map order no output order effect','MOCK',()=>{const m=accessMap(ft),a={kind:'search_location',id:'location:library'};m.entries.forEach(e=>e.access=a);const x=investigate(ft,m,a);m.entries.reverse();eq(investigate(ft,m,a),x);});
b('changed hidden description invalidates old map binding','REAL+MOCK',()=>{const i=fullCase();i.evidence[0].description+=' changed';rejected(()=>bindAccess(T.parseCaseTruth(i),accessMap(ft)));});

function project(w=F.world(),edit=()=>{}){
 const i=F.npcInput(w.truth,w.solution);edit(i);const n=N.parseNpcKnowledge(i,w.truth,w.solution),r=P.projectNpcKnowledge(n,w.truth,w.solution);assert(r.success);return {w,n,i,c:r.context};
}
const basicEdit=i=>{i.awareness=[F.aware('evidence','bloody-knife'),F.aware('event','ben-kills-clara')];i.attitudes=[F.propositionAttitude('ben-at-library',F.knowledge(true)),F.conclusionAttitude('anna-responsible',F.belief(true))];};
const basic=project(F.world(),basicEdit);
let pi=0;function p(name,basis,fn){test('VS4','P'+String(++pi).padStart(2,'0'),name,basis,fn);}
p('raw IDs absent','REAL',()=>assert(!JSON.stringify(basic.c).match(/(?:person|event|evidence|conclusion|proposition|case|location|item):/)));
p('all spoiler marker names and descriptions absent','REAL',()=>assert(!JSON.stringify(basic.c).includes(F.MARKER)));
p('objective truth key absent','REAL',()=>{for(const o of objects(basic.c))assert(!Object.hasOwn(o,'truth'));});
p('solution assignments absent','REAL',()=>assert(!JSON.stringify(basic.c).includes('assignments')));
p('required conclusions absent','REAL',()=>assert(!JSON.stringify(basic.c).includes('requiredConclusions')));
p('secret membership absent','REAL',()=>assert(!JSON.stringify(basic.c).includes('secret')));
p('unknown event participants not expanded','REAL',()=>{const {c}=project(F.world(),i=>i.awareness=[F.aware('event','ben-kills-clara')]);eq(c.attitudes,[]);eq(c.awareness,[{kind:'event',index:1}]);eq(c.self,{kind:'person',index:1});});
p('evidence descriptions source links not expanded','REAL',()=>{const {c}=project(F.world(),i=>i.awareness=[F.aware('evidence','bloody-knife')]);eq(c.attitudes,[]);eq(c.awareness,[{kind:'evidence',index:1}]);assert(!JSON.stringify(c).includes('item'));});
p('provenance not projected','REAL',()=>{for(const o of objects(basic.c))assert(!Object.hasOwn(o,'provenance'));});
p('acquiredAt not projected','REAL',()=>{for(const o of objects(basic.c))assert(!Object.hasOwn(o,'acquiredAt'));eq(basic.c.asOf,500);});
p('hidden entity addition cannot shift visible handles','REAL',()=>{const w=F.world(t=>t.persons.unshift({id:'person:aaa-hidden',name:'SPOILER EXTRA'}));eq(project(w,basicEdit).c,basic.c);});
p('hidden names descriptions change has identical projection','REAL',()=>{const w=F.world(t=>{t.persons.forEach(p=>p.name+=' new');t.evidence.forEach(e=>e.description+=' new');});eq(project(w,basicEdit).c,basic.c);});
p('secret motive relationship changes invisible','REAL',()=>{const w=F.world(t=>{t.secrets=[];t.motives=[];t.relationships=[];});eq(project(w,basicEdit).c,basic.c);});
p('conclusion canonical unknown vs false same belief projection','REAL',()=>{const w=F.world(()=>{},s=>s.resolutions[0].responsibility.completeness='complete');eq(project(w,basicEdit).c,basic.c);});
p('truth flip keeps belief but not knowledge projection','REAL',()=>{const edit=i=>i.attitudes=[F.propositionAttitude('anna-at-library',F.belief(true))];const w=F.world(t=>t.propositions.find(p=>p.id==='proposition:anna-at-library').truth=true);eq(project(w,edit).c,project(F.world(),edit).c);assert(sem(w.truth).findings.length>0);});
p('source object graph disjoint including NPC snapshot','REAL',()=>disjoint(basic.c,basic.w.truth,basic.w.solution,basic.n,basic.i));
p('deep frozen projection','REAL',()=>frozen(basic.c));
p('source input mutation isolated','REAL',()=>{const x=project(F.world(),basicEdit),before=JSON.stringify(x.c);x.i.attitudes[0].stance.value=false;eq(JSON.stringify(x.c),before);});
p('no symbols getters hidden props prototype references','REAL',()=>{for(const o of objects(basic.c)){eq(Object.getOwnPropertySymbols(o),[]);assert([Object.prototype,Array.prototype].includes(Object.getPrototypeOf(o)));for(const [k,d] of Object.entries(Object.getOwnPropertyDescriptors(o))){assert(!d.get&&!d.set);assert(d.enumerable||Array.isArray(o)&&k==='length');}}});
p('provenance alone releases no referenced entity','REAL',()=>{const {c}=project(F.world(),i=>i.awareness=[F.aware('item','knife',400,{kind:'told_by_person',personId:'person:dora'})]);eq(c.awareness,[{kind:'item',index:1}]);eq(c.self.index,1);assert(!JSON.stringify(c).includes('"person","index":2'));});
p('permutations identical projection','REAL',()=>{const w=F.world(t=>Object.values(t).forEach(v=>Array.isArray(v)&&v.reverse()),s=>{s.conclusions.reverse();});const x=project(w,i=>{basicEdit(i);i.awareness.reverse();i.attitudes.reverse();});eq(x.c,basic.c);});
p('binding failure minimal frozen error','REAL',()=>{const w=F.world(t=>t.title+='new');const r=P.projectNpcKnowledge(basic.n,w.truth,w.solution);eq(r,{success:false,code:'CONTEXT_BINDING_MISMATCH'});frozen(r);});
p('projection-local same pair can mean different person','REAL',()=>{const a=project(F.world(),i=>i.awareness=[F.aware('person','ben')]),b=project(F.world(),i=>i.awareness=[F.aware('person','clara')]);eq(a.c,b.c);assert.notEqual(a.c.awareness[0],b.c.awareness[0]);return 'same JSON, different domain referent';});
p('visible addition shifts old handle','REAL',()=>{const a=project(F.world(),i=>{i.npcId='person:dora';i.awareness=[F.aware('person','clara')];}),b=project(F.world(),i=>{i.npcId='person:dora';i.awareness=[F.aware('person','ben'),F.aware('person','clara')];});eq(a.c.self.index,2);eq(b.c.self.index,3);});
p('raw projection exposes all attitudes before disclosure','REAL',()=>{assert(basic.c.attitudes.some(a=>a.claim.kind==='personResponsibleForEvent'));return 'NPC context is NOT a player view';});
p('knowledge false preserved, uncertainty false and null preserved','REAL',()=>{const x=project(F.world(),i=>i.attitudes=[F.propositionAttitude('anna-at-library',F.knowledge(false)),F.propositionAttitude('ben-in-killing',F.uncertain(false)),F.propositionAttitude('knife-used',F.uncertain(null))]);eq(x.c.attitudes.map(a=>a.stance),[{kind:'knowledge',value:false},{kind:'uncertain',leaning:false},{kind:'uncertain',leaning:null}]);});
p('all nine claim shapes released explicitly','REAL',()=>{const x=project(F.world(),i=>{i.attitudes=[F.propositionAttitude('ben-at-library',F.belief(true)),F.propositionAttitude('ben-in-killing',F.belief(true)),F.propositionAttitude('knife-used',F.belief(true)),...['ben-responsible','ben-role-actor','nobody-responsible','argument-caused-killing','killing-intended','killing-ordinary'].map(id=>F.conclusionAttitude(id,F.belief(true)))];});eq(new Set(x.c.attitudes.map(a=>a.claim.kind)).size,9);});
p('Conclusion knowledge forbidden','REAL',()=>{const i=F.npcInput(basic.w.truth,basic.w.solution);i.attitudes=[F.conclusionAttitude('ben-responsible',F.knowledge(true))];assert(!N.createNpcKnowledgeSchema(basic.w.truth,basic.w.solution).safeParse(i).success);});
p('no awareness needed for attitude referents','REAL',()=>{const x=project(F.world(),i=>i.attitudes=[F.propositionAttitude('ben-in-killing',F.belief(true))]);eq(x.c.awareness,[]);eq(x.c.attitudes[0].claim.person,{kind:'person',index:2});});
p('hashes and npc revision absent','REAL',()=>{eq(Object.keys(basic.c),['schemaVersion','asOf','self','awareness','attitudes']);});

// Very small future-policy mock: only answer/default, not the TASK-0005 implementation.
// Its closure receives ONLY visible context. It cannot import or use truth/solution/snapshot.
function mockInterrogator(context){
 const refs=new WeakSet();for(const o of objects(context)){if(Object.hasOwn(o,'index')&&Object.hasOwn(o,'kind'))refs.add(o);}
 return query=>{
  for(const o of objects(query.claim))if(Object.hasOwn(o,'index'))assert(refs.has(o),'foreign local handle');
  const a=context.attitudes.find(a=>canonical(a.claim)===canonical(query.claim));
  if(!a)return {kind:'claim_ignorance'};
  if(a.stance.kind==='uncertain')return {kind:'express_uncertainty',subject:clone(a.subject),claim:clone(a.claim),leaning:a.stance.leaning};
  return {kind:'assert',subject:clone(a.subject),claim:clone(a.claim),value:a.stance.value,commitment:a.stance.kind==='knowledge'?'unqualified':'belief'};
 };
}
// Feasibility verdict mock: chosen provisional strict semantics, not approved VS1 design.
// Unknown/duplicate input -> invalid; wrong or undetermined submitted literal -> incorrect;
// correct required subset missing -> incomplete; all required and all extra correct -> solved.
function mockVerdict(truth,solution,literals){
 assert.equal(solution.caseId,truth.caseId);assert.equal(solution.truthHash,TI.hashCaseTruth(truth));
 const seen=new Set();
 for(const l of literals){if(seen.has(l.conclusionId)||!solution.conclusions.some(c=>c.id===l.conclusionId)||typeof l.value!=='boolean')return 'invalid';seen.add(l.conclusionId);}
 for(const l of literals)if(oracle(truth,solution,l.conclusionId)!==l.value)return 'incorrect';
 if(solution.requiredConclusions.some(r=>!literals.some(l=>l.conclusionId===r.conclusionId&&l.value===r.value)))return 'incomplete';
 return 'solved';
}
const scenarioWorld=F.world(),scenarioNpc=project(scenarioWorld,i=>{
 i.awareness=[F.aware('evidence','bloody-knife')];
 i.attitudes=[F.propositionAttitude('ben-at-library',F.knowledge(true)),F.conclusionAttitude('ben-responsible',F.belief(true)),F.conclusionAttitude('ben-role-planner',F.belief(true))];
});
const scenarioMap=accessMap(scenarioWorld.truth);
scenarioMap.entries.find(e=>e.evidenceId==='evidence:bloody-knife').access={kind:'examine_item',id:'item:knife'};
const packageBinding={
 truthHash:TI.hashCaseTruth(scenarioWorld.truth),solutionHash:SI.hashCaseSolution(scenarioWorld.solution),
 // SCRATCH ONLY: no existing production NPC/AccessMap/package canonical identity!
 npcScratchHash:sha(scenarioNpc.n),accessScratchHash:sha(scenarioMap),ruleset:'preflight-mock-v1'
};
const packageScratchHash=sha(packageBinding);
const question=()=>({kind:'ask_about_claim',claim:scenarioNpc.c.attitudes.find(a=>a.claim.kind==='personResponsibleForEvent').claim});
const answer=mockInterrogator(scenarioNpc.c)(question());
const successAcc=[{conclusionId:'conclusion:ben-responsible',value:true}];
// Scratch trusted session log. No claim this is the future wire schema.
const events=[
 {seq:1,kind:'start',packageScratchHash},
 {seq:2,kind:'investigate',action:{kind:'examine_item',id:'item:knife'}},
 {seq:3,kind:'discover_evidence',evidence:investigate(scenarioWorld.truth,scenarioMap,{kind:'examine_item',id:'item:knife'})},
 {seq:4,kind:'interrogate_npc',contextOrdinal:1,queryClaim:clone(question().claim)},
 {seq:5,kind:'receive_statement',contextOrdinal:1,act:answer},
 {seq:6,kind:'submit_accusation',literals:successAcc},
 {seq:7,kind:'receive_verdict',verdict:mockVerdict(scenarioWorld.truth,scenarioWorld.solution,successAcc)}
];
// Not a production reducer: scratch fold of accepted output events into sets/transcript.
function replay(log,expectedPackage){
 assert(log.length&&log[0].kind==='start');assert.equal(log[0].packageScratchHash,expectedPackage);
 const state={evidence:[],statements:[],verdict:null};
 log.forEach((e,i)=>{assert.equal(e.seq,i+1);if(e.kind==='discover_evidence')for(const ref of e.evidence)if(!state.evidence.some(r=>canonical(r)===canonical(ref)))state.evidence.push(clone(ref));
  if(e.kind==='receive_statement')state.statements.push({contextOrdinal:e.contextOrdinal,act:clone(e.act)});
  if(e.kind==='receive_verdict')state.verdict=e.verdict;
 });
 return state;
}
const outcome=replay(events,packageScratchHash);
eq(sem(scenarioWorld.truth).findings,[]);eq(outcome.verdict,'solved');
notes.push('Oracle uses cloned authoring input and public parser, NOT production evaluation API.');
notes.push('No canonical case-package identity exists; scratch hash uses ordered arrays and must not be adopted as a contract.');
notes.push('Accusation is authored by trusted script; no approved player entity/claim-to-Conclusion binding exists.');
notes.push('Evidence handles are a scratch host mapping, not shared with projection-local NPC handles.');
notes.push('Replay stores accepted outputs here; it does not authenticate them or implement future command replay.');
notes.push('Interrogator receives only NPC-visible context, outputs only mock act. Player never receives entire context.');

let xi=0;function x(name,basis,fn){test('CROSS','X'+String(++xi).padStart(2,'0'),name,basis,fn);}
x('mismatched truth hash on solution','REAL',()=>{const i=F.solutionInput('0'.repeat(64));assert(!safeSolution(scenarioWorld.truth,i).success);});
x('mismatched NPC solution hash','REAL',()=>{const i=F.npcInput(scenarioWorld.truth,scenarioWorld.solution);i.solutionHash='0'.repeat(64);assert(!N.createNpcKnowledgeSchema(scenarioWorld.truth,scenarioWorld.solution).safeParse(i).success);});
x('stale NPC snapshot changed truth','REAL',()=>{const w=F.world(t=>t.revision++);eq(P.projectNpcKnowledge(scenarioNpc.n,w.truth,w.solution).success,false);});
x('foreign EvidenceId','REAL',()=>{const i=F.npcInput(scenarioWorld.truth,scenarioWorld.solution);i.awareness=[F.aware('evidence','foreign')];assert(!N.createNpcKnowledgeSchema(scenarioWorld.truth,scenarioWorld.solution).safeParse(i).success);});
x('foreign ConclusionId accusation','MOCK',()=>eq(mockVerdict(scenarioWorld.truth,scenarioWorld.solution,[{conclusionId:'conclusion:foreign',value:true}]),'invalid'));
x('NPC-observed inaccessible evidence','REAL+MOCK',()=>{assert(scenarioNpc.c.awareness.some(r=>r.kind==='evidence'));eq(investigate(scenarioWorld.truth,accessMap(scenarioWorld.truth),{kind:'examine_item',id:'item:knife'}),[]);});
x('true fact leads false conclusion belief','REAL+MOCK',()=>{const a=scenarioNpc.c.attitudes.find(a=>a.claim.kind==='personRoleForEvent');eq(oracle(scenarioWorld.truth,scenarioWorld.solution,'conclusion:ben-role-planner'),false);eq(mockInterrogator(scenarioNpc.c)({claim:a.claim}).value,true);});
x('partial responsibility omitted person unknown','REAL',()=>eq(oracle(scenarioWorld.truth,scenarioWorld.solution,'conclusion:anna-responsible'),'undetermined'));
x('unknown conclusion accusation false not exoneration','MOCK+REAL_ORACLE',()=>eq(mockVerdict(scenarioWorld.truth,scenarioWorld.solution,[{conclusionId:'conclusion:anna-responsible',value:false}]),'incorrect'));
x('negative required conclusion','MOCK+REAL_ORACLE',()=>{const w=solutionCase(resp('person:b'),()=>{},false);eq(mockVerdict(w.truth,w.solution,[{conclusionId:'conclusion:probe',value:false}]),'solved');});
x('duplicate investigation knowledge set stable','MOCK',()=>{const log=clone(events);log.splice(4,0,{seq:5,kind:'discover_evidence',evidence:clone(log[2].evidence)});log.forEach((e,i)=>e.seq=i+1);eq(replay(log,packageScratchHash).evidence,outcome.evidence);});
x('independent discovery order only set-equivalent','MOCK',()=>{const a=clone(events);a[2].evidence=[{kind:'evidence',index:1},{kind:'evidence',index:2}];const b=clone(a);b[2].evidence.reverse();assert.notDeepEqual(replay(a,packageScratchHash),replay(b,packageScratchHash));eq([...replay(a,packageScratchHash).evidence].sort((a,b)=>a.index-b.index),[...replay(b,packageScratchHash).evidence].sort((a,b)=>a.index-b.index));});
x('duplicate replay sequence rejected','MOCK',()=>{const log=clone(events);log.splice(3,0,clone(log[2]));rejected(()=>replay(log,packageScratchHash));});
x('corrupted JSON save fails parsing','PLATFORM',()=>rejected(()=>JSON.parse(JSON.stringify(events).slice(0,-1))));
x('save binding stale package fails','MOCK',()=>rejected(()=>replay(events,'new-package')));
x('player receives less than NPC','REAL+MOCK',()=>{eq(outcome.statements.length,1);assert(scenarioNpc.c.attitudes.length>outcome.statements.length);});
x('player can discover beyond NPC awareness','REAL+MOCK',()=>{const empty=project(scenarioWorld);eq(empty.c.awareness,[]);eq(investigate(scenarioWorld.truth,scenarioMap,{kind:'examine_item',id:'item:knife'}).length,1);});
x('secret proposition no auto knowledge','REAL',()=>eq(project(scenarioWorld).c.attitudes,[]));
x('speaking IDs never in released context or act','REAL+MOCK',()=>assert(!JSON.stringify([scenarioNpc.c,answer]).includes('ben-kills-clara')));
x('evidence source not in discovery result','MOCK',()=>assert(!JSON.stringify(events[2].evidence).includes('source')));
x('no proposition ID in discovery or act','MOCK',()=>assert(!JSON.stringify([events[2].evidence,answer]).includes('proposition:')));
x('solution fields never in player slice','REAL+MOCK',()=>{const s=JSON.stringify(outcome);for(const word of ['requiredConclusions','assignments','truthHash','solutionHash','resolutions'])assert(!s.includes(word));});
x('impossible investigation target rejected','MOCK',()=>rejected(()=>investigate(scenarioWorld.truth,scenarioMap,{kind:'examine_item',id:'item:missing'})));
x('same caseId changed truth invalidates solution','REAL',()=>{const w=F.world(t=>t.title+='!');assert(!safeSolution(w.truth,scenarioWorld.solution).success);});
x('same truth changed solution invalidates NPC','REAL',()=>{const input=clone(scenarioWorld.solution);input.revision++;const s=S.parseCaseSolution(input,scenarioWorld.truth);eq(P.projectNpcKnowledge(scenarioNpc.n,scenarioWorld.truth,s).success,false);});
x('false accusation','MOCK+REAL_ORACLE',()=>eq(mockVerdict(scenarioWorld.truth,scenarioWorld.solution,[{conclusionId:'conclusion:ben-responsible',value:false}]),'incorrect'));
x('shotgun all true does not solve','MOCK+REAL_ORACLE',()=>eq(mockVerdict(scenarioWorld.truth,scenarioWorld.solution,scenarioWorld.solution.conclusions.map(c=>({conclusionId:c.id,value:true}))),'incorrect'));
x('empty accusation incomplete','MOCK',()=>eq(mockVerdict(scenarioWorld.truth,scenarioWorld.solution,[]),'incomplete'));
x('two responsible actors both required','MOCK+REAL_ORACLE',()=>{const t=SF.solutionTruth(),i=SF.goldenSolution(),s=S.parseCaseSolution(i,t);eq(mockVerdict(t,s,i.requiredConclusions),'solved');eq(mockVerdict(t,s,[i.requiredConclusions[0]]),'incomplete');});
x('nobody responsible answer','MOCK+REAL_ORACLE',()=>{const w=solutionCase(none,r=>r.responsibility.assignments=[],true);eq(mockVerdict(w.truth,w.solution,[{conclusionId:'conclusion:probe',value:true}]),'solved');});
x('supernatural answer','MOCK+REAL_ORACLE',()=>{const w=solutionCase(mech('supernatural'),r=>{r.mechanism='supernatural';r.responsibility.assignments=[];},true);eq(mockVerdict(w.truth,w.solution,[{conclusionId:'conclusion:probe',value:true}]),'solved');});
x('null solution with conclusion forbidden','REAL',()=>{const i=F.npcInput(scenarioWorld.truth,null);i.attitudes=[F.conclusionAttitude('ben-responsible',F.belief(true))];assert(!N.createNpcKnowledgeSchema(scenarioWorld.truth,null).safeParse(i).success);});
x('wrong solution for truth rejected transitively','REAL',()=>{const w=F.world(t=>t.title+='new');const i=F.npcInput(w.truth,scenarioWorld.solution);assert(!N.createNpcKnowledgeSchema(w.truth,scenarioWorld.solution).safeParse(i).success);});
x('negative knowledge preserves false','REAL',()=>{const q=project(scenarioWorld,i=>i.attitudes=[F.propositionAttitude('anna-at-library',F.knowledge(false))]);eq(q.c.attitudes[0].stance.value,false);});
x('false knowledge rejected, false belief allowed','REAL',()=>{const i=F.npcInput(scenarioWorld.truth,scenarioWorld.solution);i.attitudes=[F.propositionAttitude('anna-at-library',F.knowledge(true))];assert(!N.createNpcKnowledgeSchema(scenarioWorld.truth,scenarioWorld.solution).safeParse(i).success);i.attitudes[0].stance=F.belief(true);N.parseNpcKnowledge(i,scenarioWorld.truth,scenarioWorld.solution);});
x('same structural proposition two IDs rejected in NPC','REAL',()=>{const i=F.npcInput(scenarioWorld.truth,scenarioWorld.solution);i.attitudes=['ben-at-library','ben-seen-in-library'].map(id=>F.propositionAttitude(id,F.belief(true)));assert(!N.createNpcKnowledgeSchema(scenarioWorld.truth,scenarioWorld.solution).safeParse(i).success);});
x('same structural conclusion duplicate rejected','REAL',()=>{const i=clone(scenarioWorld.solution);i.conclusions.push({...clone(i.conclusions[0]),id:'conclusion:other'});assert(!safeSolution(scenarioWorld.truth,i).success);});
x('future acquiredAt rejected','REAL',()=>{const i=F.npcInput(scenarioWorld.truth,scenarioWorld.solution);i.awareness=[F.aware('item','knife',501,F.inferred)];assert(!N.createNpcKnowledgeSchema(scenarioWorld.truth,scenarioWorld.solution).safeParse(i).success);});
x('witnessed interval end excluded','REAL',()=>{const i=F.npcInput(scenarioWorld.truth,scenarioWorld.solution);i.awareness=[F.aware('event','argument',200,{kind:'witnessed_event',eventId:'event:argument'})];assert(!N.createNpcKnowledgeSchema(scenarioWorld.truth,scenarioWorld.solution).safeParse(i).success);});
x('observed evidence does not imply awareness','REAL',()=>{const q=project(scenarioWorld,i=>i.attitudes=[F.conclusionAttitude('ben-responsible',F.belief(true),450,{kind:'observed_evidence',evidenceId:'evidence:bloody-knife'})]);eq(q.c.awareness,[]);assert(!JSON.stringify(q.c).includes('"evidence"'));});
x('semantically invalid truth can produce knowledge snapshot','REAL',()=>{const w=F.world(t=>t.events[1].time.at=50);assert(sem(w.truth).findings.length);project(w);});
x('same snapshot revision can have different attitudes','REAL',()=>{const a=project(scenarioWorld),b=project(scenarioWorld,basicEdit);eq(a.n.revision,b.n.revision);assert.notDeepEqual(a.n,b.n);return 'revision is not content identity';});
x('truth arrays permutation hash equal','REAL',()=>{const i=clone(scenarioWorld.truth);i.persons.reverse();i.events.reverse();eq(TI.hashCaseTruth(T.parseCaseTruth(i)),TI.hashCaseTruth(scenarioWorld.truth));});
x('solution arrays permutation hash equal','REAL',()=>{const i=clone(scenarioWorld.solution);i.conclusions.reverse();eq(SI.hashCaseSolution(S.parseCaseSolution(i,scenarioWorld.truth)),SI.hashCaseSolution(scenarioWorld.solution));});
x('all parsed snapshots and result frozen','REAL',()=>[scenarioWorld.truth,scenarioWorld.solution,scenarioNpc.n,scenarioNpc.c].forEach(frozen));
x('projection roundtrip value same object ownership different','REAL',()=>{const other=project(scenarioWorld,i=>Object.assign(i,clone(scenarioNpc.n)));eq(other.c,scenarioNpc.c);rejected(()=>mockInterrogator(other.c)(question()),'foreign');});
x('category collision same index distinct','REAL+MOCK',()=>{const c=scenarioNpc.c;assert(objects(c).size);const refs=[...objects(c)].filter(o=>o.index===1&&o.kind);assert(new Set(refs.map(r=>r.kind)).size>1);});
x('unsupported claim absent, cannot auto admit future union','REAL',()=>assert(!S.ConclusionClaimSchema.safeParse({kind:'knowsSecret',eventId:'event:ben-kills-clara'}).success));
x('truth roundtrip through parser restores frozen nominal path','REAL',()=>{const t=T.parseCaseTruth(JSON.parse(TI.serializeCaseTruth(scenarioWorld.truth)));eq(TI.hashCaseTruth(t),TI.hashCaseTruth(scenarioWorld.truth));frozen(t);});
x('solution roundtrip bound reparsing','REAL',()=>eq(SI.hashCaseSolution(S.parseCaseSolution(JSON.parse(SI.serializeCaseSolution(scenarioWorld.solution)),scenarioWorld.truth)),SI.hashCaseSolution(scenarioWorld.solution)));
x('NPC roundtrip requires bound reparse','REAL',()=>{const n=N.parseNpcKnowledge(JSON.parse(JSON.stringify(scenarioNpc.n)),scenarioWorld.truth,scenarioWorld.solution);eq(P.projectNpcKnowledge(n,scenarioWorld.truth,scenarioWorld.solution).context,scenarioNpc.c);});
x('replay no redundancy needed for derived player set','MOCK',()=>eq(replay(JSON.parse(JSON.stringify(events)),packageScratchHash),outcome));
x('ordered history must not use set-array case serializer','MOCK',()=>{const a=sha(events),b=sha([...events].reverse());assert.notEqual(a,b);rejected(()=>replay([...events].reverse(),packageScratchHash));});
x('valid-shaped forged receipt is NOT authenticated by replay','MOCK_LIMIT',()=>{const log=clone(events);log[6].verdict='incorrect';eq(replay(log,packageScratchHash).verdict,'incorrect');return 'plain fold cannot prove server-produced facts';});
x('changing policy or ruleset changes package semantics','MOCK_LIMIT',()=>{const b={...packageBinding,ruleset:'preflight-mock-v2'};assert.notEqual(sha(b),packageScratchHash);});
x('full solution API is answer oracle if exposed to player','REAL',()=>{eq(oracle(scenarioWorld.truth,scenarioWorld.solution,'conclusion:ben-responsible'),true);return 'must stay trusted adjudicator side';});
x('negative required and additional wrong claim not solved','MOCK+REAL_ORACLE',()=>{const i=clone(scenarioWorld.solution);i.requiredConclusions=[{conclusionId:'conclusion:ben-role-planner',value:false}];const s=S.parseCaseSolution(i,scenarioWorld.truth);eq(mockVerdict(scenarioWorld.truth,s,[...i.requiredConclusions,{conclusionId:'conclusion:ben-responsible',value:false}]),'incorrect');});
x('repeat accused conclusion positive and negative invalid','MOCK',()=>eq(mockVerdict(scenarioWorld.truth,scenarioWorld.solution,[successAcc[0],{...successAcc[0],value:false}]),'invalid'));
x('awareness-only cannot answer participant question','REAL+MOCK',()=>{const q=project(scenarioWorld,i=>i.awareness=[F.aware('event','ben-kills-clara')]);eq(mockInterrogator(q.c)({claim:{kind:'eventHasParticipant',event:q.c.awareness[0],person:q.c.self}}),{kind:'claim_ignorance'});});
x('copied claim refs after save not accepted as originals','REAL+MOCK',()=>rejected(()=>mockInterrogator(scenarioNpc.c)({claim:clone(question().claim)}),'foreign'));

writeFileSync(out+'/results.json',JSON.stringify({repo,rows,notes,counts:Object.fromEntries([...new Set(rows.map(r=>r.group))].map(g=>[g,rows.filter(r=>r.group===g).length]))},null,2));
writeFileSync(out+'/scenario.json',JSON.stringify({packageBinding,packageScratchHash,semanticReport:sem(scenarioWorld.truth),npcVisibleContext:scenarioNpc.c,events,outcome,notes},null,2));
console.log(JSON.stringify({counts:Object.fromEntries([...new Set(rows.map(r=>r.group))].map(g=>[g,rows.filter(r=>r.group===g).length])),pass:rows.filter(r=>r.status==='PASS').length,fail:rows.filter(r=>r.status==='FAIL'),outcome},null,2));
if(rows.some(r=>r.status==='FAIL'))process.exitCode=1;
