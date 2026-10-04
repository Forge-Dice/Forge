// AUDIT MODEL ONLY. No production imports; finite authoring fixture, not domain certification.
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import assert from 'node:assert/strict';
const root=dirname(fileURLToPath(import.meta.url));
const emit=(n,x)=>writeFileSync(join(root,n),JSON.stringify(x,null,2)+'\n');
const clone=x=>JSON.parse(JSON.stringify(x));
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
function safety(x){
 if(Array.isArray(x)) {x.forEach(safety);return;}
 if(plain(x)){Object.keys(x).forEach(k=>{safety(k);safety(x[k]);});return;}
 if(x===null||typeof x==='boolean')return;
 if(typeof x==='number'&&Number.isSafeInteger(x)&&!Object.is(x,-0))return;
 if(typeof x==='string'&&x.isWellFormed())return;
 throw Error('schema failure');
}
// Session structural JSON C: keys UTF-16 sorted, arrays ordered.
function C(x){
 if(Array.isArray(x))return '['+x.map(C).join(',')+']';
 if(plain(x))return '{'+Object.keys(x).sort(cmp).map(k=>JSON.stringify(k)+':'+C(x[k])).join(',')+'}';
 return JSON.stringify(x);
}
function setC(x){
 if(Array.isArray(x))return '['+x.map(setC).sort(cmp).join(',')+']';
 if(plain(x))return '{'+Object.keys(x).sort(cmp).map(k=>JSON.stringify(k)+':'+setC(x[k])).join(',')+'}';
 return JSON.stringify(x);
}
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
const H=(tag,x)=>sha(tag+'\n'+C(x));
const HS=(tag,x)=>sha(tag+'\n'+setC(x));
const sortSet=(xs,key=C)=>[...xs].sort((a,b)=>cmp(key(a),key(b)));
function unique(xs,key=C){assert.equal(new Set(xs.map(key)).size,xs.length,'schema failure');}
function exact(x,keys){assert(plain(x),'schema failure');assert.deepEqual(Object.keys(x).sort(),keys.split(' ').sort(),'schema failure');}
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
const refProfile='forge-mystery-playerref-v1';
const saltA='000102030405060708090a0b0c0d0e0f';
const alphabet='0123456789abcdefghjkmnpqrstvwxyz';
function derive(salt,caseId,truthHash,kind,id,port=null){
 const preimage=[refProfile,salt,caseId,truthHash,kind,id].join('\n');
 const hex=port?port(preimage):sha(preimage).slice(0,20);
 let n=BigInt('0x'+hex),out='';for(let i=15;i>=0;i--)out+=alphabet[Number((n>>BigInt(i*5))&31n)];
 return 'pr1_'+out;
}
const entityKey=e=>e.kind+'\n'+e.id;
const profiles={truth:'forge-case-c14n-v1',solution:'forge-solution-c14n-v1',access:'forge-evidence-access-c14n-v1',presentation:'forge-evidence-presentation-c14n-v1',catalogue:'forge-interrogation-catalogue-c14n-v1',profile:'forge-interrogation-profile-c14n-v1',snapshot:'forge-npc-snapshot-v1',npcs:'forge-session-npcs-v1',initial:'forge-session-initial-v1',challenge:'forge-session-challenge-v1',refs:'forge-session-refs-v1',publicContent:'forge-session-public-content-v1',context:'forge-session-release-context-v1',release:'forge-session-release-v1',proof:'forge-session-proof-v1',package:'forge-case-package-v1',save:'forge-session-save-v1'};
function snapshotNorm(x){return {...x,awareness:sortSet(x.awareness),attitudes:sortSet(x.attitudes)};}
function proofNorm(x){
 return {...x,answerScope:sortSet(x.answerScope),observations:sortSet(x.observations.map(o=>o.kind==='PUBLIC_RULE'?{...o,rules:sortSet(o.rules.map(r=>({...r,allOf:sortSet(r.allOf)})))}:o)),nodes:sortSet(x.nodes),edges:sortSet(x.edges.map(e=>({...e,allOf:sortSet(e.allOf)})))};
}
function publicNorm(x){return {...x,labels:sortSet(x.labels,l=>entityKey(l.entity)),questionTexts:sortSet(x.questionTexts,q=>q.npc+'\n'+q.questionId),publicRules:sortSet(x.publicRules,r=>r.id)};}
function mapping(p,port=null){const th=HS(profiles.truth,p.truth);return sortSet(p.truth.entities.map(e=>({...e,ref:derive(p.refConfig.saltHex,p.truth.caseId,th,e.kind,e.id,port)})),entityKey);}
let componentHashCalls=0;
function componentHashes(p){
 componentHashCalls++;
 const h={truthHash:HS(profiles.truth,p.truth),solutionHash:HS(profiles.solution,p.solution),accessHash:HS(profiles.access,p.access),presentationHash:HS(profiles.presentation,p.presentation),catalogueHash:HS(profiles.catalogue,p.catalogue),npcBundleHash:H(profiles.npcs,sortSet(p.npcs.map(n=>({npcId:n.snapshot.npcId,snapshotHash:H(profiles.snapshot,snapshotNorm(n.snapshot)),profileHash:HS(profiles.profile,n.profile)})),n=>n.npcId)),initialHash:H(profiles.initial,{...p.initial,known:sortSet(p.initial.known,entityKey)}),challengeHash:H(profiles.challenge,{...p.challenge,allowedClaims:sortSet(p.challenge.allowedClaims)}),refsHash:H(profiles.refs,{config:p.refConfig,caseId:p.truth.caseId,truthHash:HS(profiles.truth,p.truth),mapping:mapping(p)}),publicContentHash:H(profiles.publicContent,publicNorm(p.publicContent))};
 const releaseContextHash=H(profiles.context,{rulesetVersion:p.rulesetVersion,...h});
 const releaseManifest=C({schemaVersion:1,releaseContextHash,adapterVersion:p.release.adapterVersion,certificateData:p.release.certificateData});
 const releaseHash=sha(profiles.release+'\n'+releaseManifest);
 const proof=p.proof;
 const proofHash=H(profiles.proof,proofNorm(proof));
 return {...h,releaseContextHash,releaseManifest,releaseHash,proofHash,packageHash:H(profiles.package,{schemaVersion:1,rulesetVersion:p.rulesetVersion,releaseContextHash,releaseHash,proofHash})};
}
// Closed model schemas. truth.entities is explicitly an identity-cost fixture, not CaseTruth schema.
function validate(p){
 safety(p);exact(p,'schemaVersion rulesetVersion truth solution access presentation catalogue npcs initial challenge refConfig publicContent release proof');
 assert.equal(p.schemaVersion,1);assert.equal(p.rulesetVersion,'mystery-session-v1','schema failure');
 exact(p.refConfig,'profile saltHex');assert.equal(p.refConfig.profile,refProfile,'schema failure');assert(/^[0-9a-f]{32}$/.test(p.refConfig.saltHex)&&p.refConfig.saltHex!=='0'.repeat(32),'schema failure');
 const th=HS(profiles.truth,p.truth),sh=HS(profiles.solution,p.solution),ch=HS(profiles.catalogue,p.catalogue);
 const bind=x=>{assert.equal(x.caseId,p.truth.caseId,'package mismatch');assert.equal(x.truthHash,th,'package mismatch');};
 [p.solution,p.access,p.presentation,p.catalogue,p.challenge].forEach(bind);assert.equal(p.challenge.solutionHash,sh,'package mismatch');
 unique(p.truth.entities,entityKey);unique(p.solution.conclusions,e=>e.id);unique(p.initial.known,entityKey);unique(p.access.entries,e=>e.evidenceId);unique(p.presentation.entries,e=>e.evidenceId);unique(p.catalogue.questions,q=>q.id);unique(p.challenge.allowedClaims);
 p.access.entries.forEach(e=>{if(e.access.paths)unique(e.access.paths);});p.presentation.entries.forEach(e=>{unique(e.mentions,entityKey);unique(e.reports);});
 const members=new Set(p.truth.entities.map(entityKey));p.initial.known.forEach(e=>assert(members.has(entityKey(e)),'package mismatch'));
 unique(p.npcs,n=>n.snapshot.npcId);
 for(const n of p.npcs){
  exact(n,'snapshot profile');exact(n.snapshot,'schemaVersion caseId truthHash solutionHash npcId revision asOf awareness attitudes');
  bind(n.snapshot);bind(n.profile);assert.equal(n.snapshot.solutionHash,sh,'package mismatch');assert.equal(n.profile.catalogueHash,ch,'package mismatch');assert.equal(n.snapshot.npcId,n.profile.npcId,'package mismatch');
  assert(Number.isSafeInteger(n.snapshot.revision)&&n.snapshot.revision>0);assert(n.snapshot.asOf>=0);
  unique(n.snapshot.awareness,e=>entityKey(e.subject));unique(n.snapshot.attitudes,e=>entityKey(e.subject));unique(n.profile.rules,r=>r.questionId);
  for(const a of [...n.snapshot.awareness,...n.snapshot.attitudes])assert(a.acquiredAt<=n.snapshot.asOf,'schema failure');
 }
 exact(p.publicContent,'schemaVersion title brief challengeQuestion labels questionTexts publicRules');unique(p.publicContent.labels,l=>entityKey(l.entity));unique(p.publicContent.questionTexts,q=>q.npc+'\n'+q.questionId);unique(p.publicContent.publicRules,r=>r.id);
 const actual=p.publicContent.questionTexts.map(q=>q.npc+'\n'+q.questionId).sort();
 const expected=p.npcs.flatMap(n=>n.profile.rules.map(r=>n.snapshot.npcId+'\n'+r.questionId)).sort();assert.deepEqual(actual,expected,'schema failure');
 p.publicContent.labels.forEach(l=>assert(members.has(entityKey(l.entity)),'schema failure'));
 assert.equal(p.release.adapterVersion,'forge-release-proof-v1','schema failure');unique(p.release.certificateData.steps,e=>e.stepId);
 assert.equal(p.proof.bindings.caseId,p.truth.caseId,'package mismatch');assert.equal(p.proof.bindings.truthHash,th,'package mismatch');assert.equal(p.proof.bindings.solutionHash,sh,'package mismatch');assert.equal(p.proof.bindings.releaseHash,componentHashes(p).releaseHash,'package mismatch');
 for(const field of ['answerScope','observations','nodes','edges','witnessStepIds'])unique(p.proof[field],x=>typeof x==='string'?x:x.id);
 const m=mapping(p);unique(m,e=>e.ref);
}
function rebind(p){
 const th=HS(profiles.truth,p.truth);[p.solution,p.access,p.presentation,p.catalogue,p.challenge].forEach(x=>{x.caseId=p.truth.caseId;x.truthHash=th;});
 const sh=HS(profiles.solution,p.solution),ch=HS(profiles.catalogue,p.catalogue);p.challenge.solutionHash=sh;
 for(const n of p.npcs){Object.assign(n.snapshot,{caseId:p.truth.caseId,truthHash:th,solutionHash:sh});Object.assign(n.profile,{caseId:p.truth.caseId,truthHash:th,catalogueHash:ch});}
 Object.assign(p.proof.bindings,{caseId:p.truth.caseId,truthHash:th,solutionHash:sh});p.proof.bindings.releaseHash=componentHashes(p).releaseHash;return p;
}
function fixture(){
 const entities=['person:a','person:b','location:hall','item:key','event:e1','evidence:note'].map(id=>({kind:id.split(':')[0],id}));
 const claim={kind:'personResponsibleForEvent',personId:'person:a',eventId:'event:e1'};
 return rebind({schemaVersion:1,rulesetVersion:'mystery-session-v1',truth:{schemaVersion:1,caseId:'case:binding-lab',revision:1,name:'Case name',description:'Case description',entities},solution:{schemaVersion:1,caseId:'',truthHash:'',revision:1,conclusions:[{id:'conclusion:a',claim,required:true,value:true}]},access:{schemaVersion:1,caseId:'',truthHash:'',entries:[{evidenceId:'evidence:note',access:{kind:'discoverable',paths:[{kind:'search_location',locationId:'location:hall'}]}}]},presentation:{schemaVersion:1,caseId:'',truthHash:'',entries:[{evidenceId:'evidence:note',text:'A note.',mentions:[{kind:'item',id:'item:key'},{kind:'event',id:'event:e1'}],reports:[]}]},catalogue:{schemaVersion:1,caseId:'',truthHash:'',revision:1,questions:[{id:'question:q1',mentions:[{kind:'person',id:'person:a'}]},{id:'question:q2',mentions:[{kind:'person',id:'person:a'}]}]},npcs:[{snapshot:{schemaVersion:1,caseId:'',truthHash:'',solutionHash:'',npcId:'person:a',revision:1,asOf:10,awareness:[{subject:{kind:'person',id:'person:a'},acquiredAt:0,provenance:{kind:'prior_knowledge'}},{subject:{kind:'location',id:'location:hall'},acquiredAt:0,provenance:{kind:'prior_knowledge'}}],attitudes:[{subject:{kind:'proposition',id:'proposition:a'},stance:{kind:'belief',value:true},acquiredAt:0,provenance:{kind:'prior_knowledge'}},{subject:{kind:'proposition',id:'proposition:b'},stance:{kind:'uncertain',leaning:null},acquiredAt:0,provenance:{kind:'prior_knowledge'}}]},profile:{schemaVersion:1,caseId:'',truthHash:'',catalogueHash:'',npcId:'person:a',revision:1,rules:[{questionId:'question:q1',act:'decline'},{questionId:'question:q2',act:'decline'}]}}],initial:{schemaVersion:1,known:entities.filter(e=>['person','location','event'].includes(e.kind))},challenge:{schemaVersion:1,caseId:'',truthHash:'',solutionHash:'',allowedClaims:[claim,{kind:'noPersonResponsibleForEvent',eventId:'event:e1'}]},refConfig:{profile:refProfile,saltHex:saltA},publicContent:{schemaVersion:1,title:'Case title',brief:'Find the answer.',challengeQuestion:'Who?',labels:entities.map(entity=>({entity,label:entity.id,role:null})),questionTexts:[{npc:'person:a',questionId:'question:q1',text:'First question?'},{npc:'person:a',questionId:'question:q2',text:'Second question?'}],publicRules:[{id:'rule:a',text:'First rule.'},{id:'rule:b',text:'Second rule.'}]},release:{adapterVersion:'forge-release-proof-v1',certificateData:{steps:[{stepId:'s1',event:{type:'investigate',action:'search_location',target:'lab-ref'}},{stepId:'s2',event:{type:'interrogate',npc:'lab-ref',questionId:'question:q1'}}],observations:[]}},proof:{schemaVersion:1,bindings:{caseId:'',truthHash:'',solutionHash:'',releaseHash:''},answerScope:['conclusion:a','conclusion:b'],ambiguityPolicy:'must_disambiguate',question:{kind:'required_literals'},observations:[{id:'o1',kind:'ENTITY_AWARENESS',entity:{kind:'person',id:'person:a'}},{id:'o2',kind:'ENTITY_AWARENESS',entity:{kind:'person',id:'person:b'}}],nodes:[{id:'n1',kind:'observation',observationId:'o1'},{id:'n2',kind:'observation',observationId:'o2'}],edges:[],witnessStepIds:['s1','s2']}});
}
// Immutable verified model binding owns a cloned snapshot, not caller objects or live providers.
let resolveCalls=0;
function resolve(p,expected=null){validate(p);resolveCalls++;const owned=clone(p),h=componentHashes(owned);if(expected)assert.equal(h.packageHash,expected.packageHash,'package mismatch');return freeze({identity:{schemaVersion:1,packageHash:h.packageHash,rulesetVersion:owned.rulesetVersion},p:owned,map:mapping(owned),hashes:h,modelVerified:true});}
const base=fixture();validate(base);const original=resolve(base);
const mutations=[];
function mutate(component,operation,expected,fn,{reb=true}={}){
 const p=clone(base);fn(p);if(reb)rebind(p);
 let actual,detail;
 try{const q=resolve(p);actual=q.identity.packageHash===original.identity.packageHash?'semantic no-change':'package mismatch';detail=actual==='package mismatch'?'PACKAGE ID CHANGES; old save incompatible':'NO SEMANTIC CHANGE';}
 catch(e){actual=/package mismatch/.test(e.message)?'package mismatch':'schema failure';detail='resolution rejected';}
 mutations.push({id:'M'+String(mutations.length+1).padStart(3,'0'),component,operation,expected,actual,detail,passed:actual===expected});assert.equal(actual,expected,component+' '+operation);
}
const get={truth:p=>p.truth,solution:p=>p.solution,access:p=>p.access,presentation:p=>p.presentation,catalogue:p=>p.catalogue,snapshot:p=>p.npcs[0].snapshot,profile:p=>p.npcs[0].profile,initial:p=>p.initial,challenge:p=>p.challenge,publicContent:p=>p.publicContent,refConfig:p=>p.refConfig,release:p=>p.release,proof:p=>p.proof};
const list={truth:p=>p.truth.entities,solution:p=>p.solution.conclusions,access:p=>p.access.entries[0].access.paths,presentation:p=>p.presentation.entries[0].mentions,catalogue:p=>p.catalogue.questions,snapshot:p=>p.npcs[0].snapshot.awareness,profile:p=>p.npcs[0].profile.rules,initial:p=>p.initial.known,challenge:p=>p.challenge.allowedClaims,publicContent:p=>p.publicContent.labels,proof:p=>p.proof.answerScope,release:p=>p.release.certificateData.steps};
const change={truth:p=>{p.truth.name+='!';},solution:p=>{p.solution.revision++;},access:p=>{p.access.entries[0].access.paths[0].kind='examine_item';delete p.access.entries[0].access.paths[0].locationId;p.access.entries[0].access.paths[0].itemId='item:key';},presentation:p=>{p.presentation.entries[0].text+='!';},catalogue:p=>{p.catalogue.revision++;},snapshot:p=>{p.npcs[0].snapshot.asOf++;},profile:p=>{p.npcs[0].profile.revision++;},initial:p=>{p.initial.known.push({kind:'item',id:'item:key'});},challenge:p=>{p.challenge.allowedClaims.pop();},publicContent:p=>{p.publicContent.brief+='!';},refConfig:p=>{p.refConfig.saltHex='ffeeddccbbaa99887766554433221100';},release:p=>{p.release.certificateData.steps[0].stepId='renamed';},proof:p=>{p.proof.ambiguityPolicy='may_remain_ambiguous';}};
for(const c of Object.keys(get)){
 mutate(c,'content mutation','package mismatch',change[c]);
 const x=get[c](base);
 if('revision' in x)mutate(c,'revision mutation','package mismatch',p=>get[c](p).revision++);
 else mutate(c,'revision absent; forbidden addition','schema failure',p=>{if(c==='refConfig'||c==='snapshot'||c==='publicContent')get[c](p).revision=1;else p.unexpectedRevision=1;});
 if(list[c])mutate(c,'collection reordering',c==='release'?'package mismatch':'semantic no-change',p=>list[c](p).reverse());
 else mutate(c,'object key reordering','semantic no-change',p=>{p.refConfig=Object.fromEntries(Object.entries(p.refConfig).reverse());});
 mutate(c,'foreign binding','package mismatch',p=>{if(c==='truth'){p.truth.caseId='case:foreign';}else if(c==='refConfig'){p.refConfig.saltHex='11111111111111111111111111111111';}else if(c==='release'){p.release.certificateData.foreignPackage='f'.repeat(64);}else if(c==='initial'){p.initial.known[0]={kind:'person',id:'person:foreign'};}else if(c==='publicContent'){p.publicContent.brief='Foreign public text';}else if(c==='proof'){p.proof.bindings.truthHash='f'.repeat(64);}else get[c](p).truthHash='f'.repeat(64);},{reb:false});
 mutate(c,'missing component','schema failure',p=>{if(c==='snapshot'||c==='profile')delete p.npcs[0][c];else delete p[c];},{reb:false});
 mutate(c,'duplicate component','schema failure',p=>{if(['snapshot','profile'].includes(c))p.npcs.push(clone(p.npcs[0]));else if(list[c])list[c](p).push(clone(list[c](p)[0]));else p.duplicateComponent=clone(get[c](p));});
}
// Additional paths ensure scalar metadata, provenance, nested SET/ORDERED arrays and all ref parameters.
for(const [field,fn] of Object.entries({revision:s=>s.revision++,asOf:s=>s.asOf++,caseId:s=>s.caseId='case:foreign',truthHash:s=>s.truthHash='f'.repeat(64),solutionHash:s=>s.solutionHash=null,npcId:s=>s.npcId='person:b',acquiredAt:s=>s.awareness[0].acquiredAt=1,provenance:s=>s.awareness[0].provenance={kind:'author_modeled_inference'},stance:s=>s.attitudes[0].stance.value=false,leaning:s=>s.attitudes[1].stance.leaning=true}))mutate('snapshot',field,'package mismatch',p=>fn(p.npcs[0].snapshot),{reb:false});
for(const field of ['title','brief','challengeQuestion'])mutate('publicContent',field,'package mismatch',p=>p.publicContent[field]+='!');
for(const [field,fn] of Object.entries({name:p=>p.truth.name+='x',description:p=>p.truth.description+='x',label:p=>p.publicContent.labels[0].label+='x',role:p=>p.publicContent.labels[0].role='guest',npcWording:p=>p.publicContent.questionTexts[0].text+='x',publicRule:p=>p.publicContent.publicRules[0].text+='x',observation:p=>p.presentation.entries[0].text+='x',whitespace:p=>p.presentation.entries[0].text+=' ',NFC:p=>p.publicContent.title='é',NFD:p=>p.publicContent.title='e\u0301'}))mutate('public text',field,'package mismatch',fn);
for(const field of ['profile','encoding','truncation','kindEncoding','collisionPolicy','schemaVersion'])mutate('refConfig',field+' unsupported in V1','schema failure',p=>{p.refConfig[field]=field==='profile'?'forge-mystery-playerref-v2':'changed';});
for(const salt of ['0'.repeat(32),'A'.repeat(32),'1'.repeat(31),'1'.repeat(33),'0x'+'1'.repeat(32),' '+'1'.repeat(32)])mutate('refConfig','invalid salt '+salt,'schema failure',p=>p.refConfig.saltHex=salt);
for(const [name,fn] of Object.entries({attitudes:p=>p.npcs[0].snapshot.attitudes.reverse(),labels:p=>p.publicContent.labels.reverse(),questionTexts:p=>p.publicContent.questionTexts.reverse(),publicRules:p=>p.publicContent.publicRules.reverse(),witness:p=>p.proof.witnessStepIds.reverse(),observations:p=>p.proof.observations.reverse(),nodes:p=>p.proof.nodes.reverse(),known:p=>p.initial.known.reverse()}))mutate('typed arrays',name,name==='witness'?'package mismatch':'semantic no-change',fn);
for(let i=0;i<30;i++)mutate('same revision content','text byte '+i,'package mismatch',p=>p.presentation.entries[0].text+=String.fromCharCode(65+i));
for(const [operation,expected,fn] of [
 ['content mutation','schema failure',p=>p.rulesetVersion='mystery-session-v2'],
 ['revision absent; forbidden addition','schema failure',p=>p.rulesetRevision=2],
 ['object key reordering','semantic no-change',p=>p.truth=Object.fromEntries(Object.entries(p.truth).reverse())],
 ['foreign ruleset','schema failure',p=>p.rulesetVersion='foreign-ruleset-v1'],
 ['missing component','schema failure',p=>delete p.rulesetVersion],
 ['duplicate component','schema failure',p=>p.duplicateRuleset=p.rulesetVersion]])mutate('replay ruleset',operation,expected,fn);
mutate('NPC bundle','content mutation; technical empty NPC set','package mismatch',p=>{p.npcs=[];p.publicContent.questionTexts=[];});
mutate('NPC bundle','revision absent; forbidden addition','schema failure',p=>p.npcBundleRevision=1);
mutate('NPC bundle','reordering existing singleton','semantic no-change',p=>p.npcs.reverse());
mutate('NPC bundle','mixed snapshot/profile NPC ids','package mismatch',p=>p.npcs[0].profile.npcId='person:b');
mutate('NPC bundle','missing component','schema failure',p=>delete p.npcs,{reb:false});
mutate('NPC bundle','duplicate NPC pair','schema failure',p=>p.npcs.push(clone(p.npcs[0])));
// Resolver negative controls: claimed mapping must agree with the pinned salt algorithm.
const refTests=[];
function verifyClaimedMapping(claimed){
 const expected=mapping(original.p);assert.equal(claimed.length,expected.length,'REF_MAPPING');unique(claimed,e=>e.ref);unique(claimed,entityKey);
 for(const e of expected){const row=claimed.find(x=>entityKey(x)===entityKey(e));assert(row&&row.ref===e.ref,'REF_MAPPING');}
 return true;
}
for(const [name,fn] of Object.entries({salt:m=>m.map(e=>({...e,ref:derive('11111111111111111111111111111111',base.truth.caseId,HS(profiles.truth,base.truth),e.kind,e.id)})),profile:m=>m.map(e=>({...e,ref:'pr2_'+e.ref.slice(4)})),encoding:m=>m.map(e=>({...e,ref:e.ref.toUpperCase()})),truncation:m=>m.map(e=>({...e,ref:e.ref.slice(0,-1)})),kind:m=>m.map(e=>({...e,ref:derive(saltA,base.truth.caseId,HS(profiles.truth,base.truth),'event',e.id)})),membership:m=>m.slice(1),duplicate:m=>[...m,m[0]],collision:m=>m.map(e=>({...e,ref:m[0].ref})),resolution:m=>m.map(e=>({...e,id:'person:foreign'}))})){
 const claimed=fn(clone(original.map));let rejected=false;try{verifyClaimedMapping(claimed);}catch{rejected=true;}assert(rejected);refTests.push({name,rejected});
}
const collision=mapping(base,()=> '0'.repeat(20));assert.equal(new Set(collision.map(e=>e.ref)).size,1);assert.throws(()=>verifyClaimedMapping(collision));
refTests.push({name:'forced digest collision; no partial index',rejected:true});
// Minimal finite host model: search reveals note and its mentions; interrogate emits decline;
// accusation truth table is one fixed conclusion. Domain parsers/9-claim semantics are outside model.
const lookup=(p,id)=>p.map.find(e=>e.id===id).ref;
function initial(p){return {identity:p.identity,phase:'active',events:[],known:p.p.initial.known.map(e=>lookup(p,e.id)).sort(),discoveries:[],observations:[],verdicts:[]};}
function step(p,s,e){
 if(C(s.identity)!==C(p.identity))return {ok:false,code:'HOST_FAILURE'};
 if(s.phase==='solved')return {ok:false,code:'SESSION_CLOSED'};
 if(!plain(e))return {ok:false,code:'ACTION_UNAVAILABLE'};
 const next=clone(s),idx=s.events.length;
 if(e.type==='investigate'){
  if(C(Object.keys(e).sort())!==C(['action','target','type'])||e.action!=='search_location'||e.target!==lookup(p,'location:hall')||!s.known.includes(e.target))return {ok:false,code:'ACTION_UNAVAILABLE'};
  const note=lookup(p,'evidence:note');if(!s.discoveries.includes(note)){next.discoveries.push(note);next.observations.push({source:{kind:'evidence',eventIndex:idx,evidence:note},text:p.p.presentation.entries[0].text});next.known=[...new Set([...next.known,note,lookup(p,'item:key'),lookup(p,'event:e1')])].sort();}
 }else if(e.type==='interrogate'){
  if(C(Object.keys(e).sort())!==C(['npc','questionId','type'])||e.npc!==lookup(p,'person:a')||!s.known.includes(e.npc)||!['question:q1','question:q2'].includes(e.questionId))return {ok:false,code:'ACTION_UNAVAILABLE'};
  next.observations.push({source:{kind:'npc',eventIndex:idx,npc:e.npc,questionId:e.questionId},stance:'decline'});
 }else if(e.type==='accuse'){
  if(C(Object.keys(e).sort())!==C(['literals','type'])||!Array.isArray(e.literals)||e.literals.length>1)return {ok:false,code:'ACTION_UNAVAILABLE'};
  if(e.literals.length){const l=e.literals[0];if(!plain(l)||C(Object.keys(l).sort())!==C(['claim','value'])||typeof l.value!=='boolean'||C(l.claim)!==C({kind:'personResponsibleForEvent',person:lookup(p,'person:a'),event:lookup(p,'event:e1')})||!s.known.includes(l.claim.person)||!s.known.includes(l.claim.event))return {ok:false,code:'ACTION_UNAVAILABLE'};}
  const v=e.literals.length&&e.literals[0].value?'solved':'not_solved';next.verdicts.push({eventIndex:idx,verdict:v});if(v==='solved')next.phase='solved';
 }else return {ok:false,code:'ACTION_UNAVAILABLE'};
 next.events.push(clone(e));return {ok:true,state:freeze(next)};
}
function replay(p,events){const calls=componentHashCalls;let state=freeze(initial(p));for(let i=0;i<events.length;i++){const r=step(p,state,events[i]);if(!r.ok)return {ok:false,code:'INVALID_HISTORY',eventIndex:i};state=r.state;}assert.equal(componentHashCalls,calls);return {ok:true,state};}
// Separate batch oracle: expected journal from log-level rules, without calling reducer.
function oracle(p,events){
 const s=initial(p);let firstSearch=events.findIndex(e=>e.type==='investigate');
 s.events=clone(events);if(firstSearch>=0){const note=lookup(p,'evidence:note');s.discoveries=[note];s.known=[...new Set([...s.known,note,lookup(p,'item:key')])].sort();}
 events.forEach((e,i)=>{if(e.type==='investigate'&&i===firstSearch)s.observations.push({source:{kind:'evidence',eventIndex:i,evidence:lookup(p,'evidence:note')},text:p.p.presentation.entries[0].text});if(e.type==='interrogate')s.observations.push({source:{kind:'npc',eventIndex:i,npc:e.npc,questionId:e.questionId},stance:'decline'});if(e.type==='accuse'){const v=e.literals.length&&e.literals[0].value?'solved':'not_solved';s.verdicts.push({eventIndex:i,verdict:v});if(v==='solved')s.phase='solved';}});return s;
}
const saveBody=(p,events)=>({schemaVersion:1,packageIdentity:p.identity,events});
function encode(p,events){const b=saveBody(p,events);return C({...b,checksum:H(profiles.save,b)});}
function load(p,text){
 try{const x=JSON.parse(text);safety(x);exact(x,'schemaVersion packageIdentity events checksum');exact(x.packageIdentity,'schemaVersion packageHash rulesetVersion');if(C(x)!==text||x.schemaVersion!==1)return {ok:false,code:'INVALID_SAVE'};if(C(x.packageIdentity)!==C(p.identity))return {ok:false,code:'INCOMPATIBLE_PACKAGE'};const body={schemaVersion:x.schemaVersion,packageIdentity:x.packageIdentity,events:x.events};if(H(profiles.save,body)!==x.checksum)return {ok:false,code:'CHECKSUM_MISMATCH'};return replay(p,x.events);}catch{return {ok:false,code:'INVALID_SAVE'};}
}
let seed=0x51a7b1d;function rand(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;}
const search={type:'investigate',action:'search_location',target:lookup(original,'location:hall')};
const ask=q=>({type:'interrogate',npc:lookup(original,'person:a'),questionId:q});
const accuse=value=>({type:'accuse',literals:[{claim:{kind:'personResponsibleForEvent',person:lookup(original,'person:a'),event:lookup(original,'event:e1')},value}]});
const foreignPackages={};for(const [name,fn] of Object.entries({salt:change.refConfig,snapshot:change.snapshot,presentation:change.presentation,publicContent:change.publicContent,package:change.challenge})){const p=clone(base);fn(p);rebind(p);foreignPackages[name]=resolve(p);}
const rows=[],counts={};function check(name,f){f();counts[name]=(counts[name]??0)+1;}
for(let i=0;i<1200;i++){
 const n=3+rand()%77,events=[ask('question:q1'),ask('question:q2')];for(let j=0;j<n;j++){switch(rand()%4){case 0:events.push(clone(search));break;case 1:events.push(ask('question:q1'));break;case 2:events.push(ask('question:q2'));break;case 3:events.push(accuse(false));}}
 if(i%2===0)events.push(accuse(true));
 const r=replay(original,events);assert(r.ok);
 check('same log twice',()=>assert.deepEqual(replay(original,events),r));
 check('independent batch oracle',()=>assert.deepEqual(r.state,oracle(original,events)));
 const saved=encode(original,events);
 check('save/load',()=>assert.deepEqual(load(original,saved),r));
 check('stable resave',()=>assert.equal(encode(original,load(original,saved).state.events),saved));
 for(const [name,p] of Object.entries(foreignPackages))check(name+' mismatch',()=>assert.equal(load(p,saved).code,'INCOMPATIBLE_PACKAGE'));
 check('ruleset mismatch',()=>{const x=JSON.parse(saved);x.packageIdentity.rulesetVersion='mystery-session-v2';const b={schemaVersion:1,packageIdentity:x.packageIdentity,events:x.events};x.checksum=H(profiles.save,b);assert.equal(load(original,C(x)).code,'INCOMPATIBLE_PACKAGE');});
 for(const operation of ['reordering','deletion','insertion'])check(operation+' stale checksum',()=>{const x=JSON.parse(saved);if(operation==='reordering')[x.events[0],x.events[1]]=[x.events[1],x.events[0]];if(operation==='deletion')x.events.pop();if(operation==='insertion')x.events.unshift(clone(search));assert.equal(load(original,C(x)).code,'CHECKSUM_MISMATCH');});
 check('rechecksummed valid deletion is an earlier save',()=>{const shortened=events.slice(0,-1);assert.deepEqual(load(original,encode(original,shortened)),replay(original,shortened));});
 check('rechecksummed valid insertion accepted',()=>assert(load(original,encode(original,[clone(search),...events])).ok));
 check('invalid insertion atomicity',()=>{const bad=[...events.slice(0,2),{type:'interrogate',npc:lookup(original,'person:b'),questionId:'question:missing'},...events.slice(2)];const snapshot=C(r.state),z=replay(original,bad);assert(!z.ok&&!('state' in z));assert.equal(C(r.state),snapshot);});
 check('terminal solved',()=>{const terminal=[...events.filter(e=>!(e.type==='accuse'&&e.literals[0].value)),accuse(true),clone(search)];const z=replay(original,terminal);assert(!z.ok&&!('state' in z));});
 check('ordered valid logs have ordered state',()=>{const a=[ask('question:q1'),ask('question:q2')],b=[...a].reverse();assert.notEqual(encode(original,a),encode(original,b));assert.notEqual(C(replay(original,a).state.observations),C(replay(original,b).state.observations));assert(load(original,encode(original,b)).ok);});
 check('exact incremental save size',()=>{const b0=Buffer.byteLength(encode(original,[]));const size=b0+events.reduce((n,e)=>n+Buffer.byteLength(C(e)),0)+Math.max(0,events.length-1);assert.equal(size,Buffer.byteLength(saved));});
 check('immutable state',()=>{assert(Object.isFrozen(r.state)&&Object.isFrozen(r.state.events));assert.throws(()=>r.state.events.push(search));});
 check('no per-event package hashing',()=>{const before=componentHashCalls;replay(original,events);assert.equal(before,componentHashCalls);});
 check('forbidden authoritative field rejected',()=>{const x=JSON.parse(saved);x.PlayerKnowledge={known:[]};assert.equal(load(original,C(x)).code,'INVALID_SAVE');});
 rows.push({history:i,events:events.length,phase:r.state.phase,eventDigest:sha(C(events)),stateDigest:sha(C(r.state)),saveDigest:sha(saved),passed:true});
}
// Non-vacuous immutable binding, ref authorization and canonical-wire controls.
const control=[];for(const [name,q] of Object.entries(foreignPackages)){assert.throws(()=>resolve(q.p,original.identity),/package mismatch/);control.push('exact descriptor rejects '+name+' substitution');}const before=original.identity.packageHash;base.publicContent.brief+=' caller mutation';assert.equal(original.identity.packageHash,before);assert.notEqual(original.p.publicContent.brief,base.publicContent.brief);control.push('caller mutation isolated');
assert(original.map.some(e=>e.id==='item:key'));assert(!initial(original).known.includes(lookup(original,'item:key')));control.push('resolution does not grant authorization');
for(const field of ['verdict','PlayerKnowledge','VisibleRef','npcEngine','truthCache','solutionCache']){const x=JSON.parse(encode(original,[]));x[field]={};assert.equal(load(original,C(x)).code,'INVALID_SAVE');control.push('save rejects '+field);}
const minimal=encode(original,[]);for(const malformed of [' '+minimal,minimal+'\n','\uFEFF'+minimal,minimal.replace('"events":[]','"events":[],"events":[]')])assert.equal(load(original,malformed).code,'INVALID_SAVE');control.push('noncanonical transport including duplicate JSON keys rejected');
assert.equal(load(foreignPackages.salt,minimal).code,'INCOMPATIBLE_PACKAGE');control.push('empty save still salt-bound');
// Golden vectors contain exact preimages and canonical strings, independently checked in Python.
const vectors=[];function vector(id,profile,x,kind='ordered'){const canonical=kind==='set'?setC(x):C(x);vectors.push({id,profile,kind,input:x,canonical,preimage:profile+'\n'+canonical,digest:sha(profile+'\n'+canonical)});}
const snap=original.p.npcs[0].snapshot;vector('npc-base',profiles.snapshot,snapshotNorm(snap));vector('npc-awareness-reordered',profiles.snapshot,snapshotNorm({...snap,awareness:[...snap.awareness].reverse()}));vector('npc-attitudes-reordered',profiles.snapshot,snapshotNorm({...snap,attitudes:[...snap.attitudes].reverse()}));
for(const [field,fn] of Object.entries({revision:s=>s.revision++,asOf:s=>s.asOf++,caseId:s=>s.caseId='case:foreign',truthHash:s=>s.truthHash='f'.repeat(64),solutionHash:s=>s.solutionHash=null,acquiredAt:s=>s.awareness[0].acquiredAt=1,provenance:s=>s.awareness[0].provenance={kind:'told_by_person',personId:'person:b'},stance:s=>s.attitudes[0].stance.value=false,npcId:s=>s.npcId='person:b'})){const s=clone(snap);fn(s);vector('npc-'+field,profiles.snapshot,snapshotNorm(s));}
vector('Unicode-key-order','forge-session-public-content-v1',{'\uE000':'BMP','😀':'astral','a':'e\u0301'});
vector('save-empty',profiles.save,{schemaVersion:1,packageIdentity:{schemaVersion:1,packageHash:'0'.repeat(64),rulesetVersion:'mystery-session-v1'},events:[]});assert.equal(vectors.at(-1).digest,'58a1857b0b76ba1f342237261c2d4c9877f7cc7bb2a78c116d8e1ecebdc6875f');
for(const [field,profile] of Object.entries({truth:profiles.truth,solution:profiles.solution,access:profiles.access,presentation:profiles.presentation,catalogue:profiles.catalogue}))vector(field,profile,original.p[field],'set');
vector('public-content',profiles.publicContent,publicNorm(original.p.publicContent));vector('proof-typed-arrays',profiles.proof,proofNorm(original.p.proof));
vector('package-proof-null',profiles.package,{schemaVersion:1,rulesetVersion:'mystery-session-v1',releaseContextHash:original.hashes.releaseContextHash,releaseHash:null,proofHash:null});
const nestedProof=clone(original.p.proof);nestedProof.edges=[{id:'edge:a',allOf:['node:z','node:a'],to:'node:b',license:'node:a'}];nestedProof.observations.push({id:'rule:obs',kind:'PUBLIC_RULE',rules:[{edgeId:'edge:a',allOf:['node:z','node:a'],yields:{kind:'conclusion',conclusionId:'conclusion:a',value:false}}]});vector('proof-nested-sets',profiles.proof,proofNorm(nestedProof));
const goldenTruth='bd95eb9a8569f4f3f62eab50aac94e75cd601b54e3432776cc6663a204647501';
const refVectors=[['person','person:a','pr1_xfs3rzypnyradx49'],['person','person:b','pr1_zmkgz9c35yhk1qa3'],['location','location:hall','pr1_znh7e2dfbmaffz8n'],['event','event:e1','pr1_yyqw0dn6dan7mbdt']].map(([kind,id,expected])=>{const preimage=[refProfile,saltA,'case:golden',goldenTruth,kind,id].join('\n');const actual=derive(saltA,'case:golden',goldenTruth,kind,id);assert.equal(actual,expected);return {kind,id,salt:saltA,preimage,digest:sha(preimage),expected,actual};});
const alternate='ffeeddccbbaa99887766554433221100';assert.equal(derive(alternate,'case:golden',goldenTruth,'person','person:a'),'pr1_44rh5ek8sxdz4w97');refVectors.push({kind:'person',id:'person:a',salt:alternate,preimage:[refProfile,alternate,'case:golden',goldenTruth,'person','person:a'].join('\n'),expected:'pr1_44rh5ek8sxdz4w97',actual:'pr1_44rh5ek8sxdz4w97'});
emit('golden-vectors.json',{scope:'hash-only vectors; foreign/null controls need not be accepted package inputs',vectors,refVectors});
emit('mutation-results.json',{scope:'finite contract identity model; not production schema certification',total:mutations.length,passed:mutations.filter(x=>x.passed).length,failed:mutations.filter(x=>!x.passed).length,refNegativeControls:refTests,rows:mutations});
emit('replay-property-results.json',{scope:'finite host model with independent batch-state oracle; no production conformance claim',seed:'0x051a7b1d',histories:rows.length,propertyChecks:Object.values(counts).reduce((a,b)=>a+b,0),properties:counts,controls:control,componentHashEvaluationsDuringReplay:0,rows});
console.log(JSON.stringify({mutations:mutations.length,mutationPass:mutations.filter(x=>x.passed).length,histories:rows.length,propertyChecks:Object.values(counts).reduce((a,b)=>a+b,0),hashVectors:vectors.length,refVectors:refVectors.length}));
