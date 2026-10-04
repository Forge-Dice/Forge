import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {writeFileSync} from 'node:fs';
const repo=process.argv[2],out=process.argv[3],imp=p=>import(pathToFileURL(repo+'/'+p));
const T=await imp('src/domain/case-truth.ts'),S=await imp('src/domain/case-solution.ts'),N=await imp('src/domain/npc-knowledge.ts'),P=await imp('src/domain/npc-knowledge.projection.ts');
const TI=await imp('src/domain/case-truth.identity.ts'),SI=await imp('src/domain/case-solution.identity.ts'),F=await imp('tests/npc-knowledge.fixture.ts');
const rows=[];function test(id,name,fn){try{rows.push({id,name,status:'PASS',detail:fn()??null});}catch(e){rows.push({id,name,status:'FAIL',error:e.stack});}}
const project=(w,edit)=>{const i=F.npcInput(w.truth,w.solution);edit(i);const n=N.parseNpcKnowledge(i,w.truth,w.solution);return {n,c:P.projectNpcKnowledge(n,w.truth,w.solution).context};};
test('E01','same truth + solution + npcId + revision + asOf, different NPC content',()=>{
 const w=F.world(),a=project(w,()=>{}),b=project(w,i=>i.awareness=[F.aware('person','ben')]);
 for(const k of ['truthHash','solutionHash','npcId','revision','asOf'])assert.equal(a.n[k],b.n[k]);
 assert.notDeepEqual(a.n,b.n);return 'metadata tuple does not identify a snapshot content';
});
test('E02','same visible context across changed raw domain IDs',()=>{
 const make=w=>project(w,i=>i.attitudes=[F.conclusionAttitude('ben-responsible',F.belief(true))]).c;
 const w=F.world(),raw=JSON.stringify(F.truthInput()).replaceAll('person:ben','person:bentwo'),t=T.parseCaseTruth(JSON.parse(raw));
 const s=S.parseCaseSolution(JSON.parse(JSON.stringify(F.solutionInput(TI.hashCaseTruth(t))).replaceAll('person:ben','person:bentwo')),t);
 assert.deepEqual(make(w),make({truth:t,solution:s}));assert.notEqual(SI.hashCaseSolution(w.solution),SI.hashCaseSolution(s));
 return 'visible claim cannot recover canonical person ID; mapping is not derivable';
});
test('E03','Proposition ID alias changes local statement handle despite same claim',()=>{
 const w=F.world();const make=id=>project(w,i=>i.attitudes=[F.propositionAttitude(id,F.belief(true)),F.propositionAttitude('ben-in-killing',F.belief(true))]).c;
 const a=make('ben-at-library'),b=make('ben-seen-in-library');
 assert.equal(a.attitudes.find(a=>a.claim.kind==='personAt').subject.index,1);
 assert.equal(b.attitudes.find(a=>a.claim.kind==='personAt').subject.index,2);
 return 'structural equivalence does not give persistent statement-handle identity';
});
test('E04','NPC asOf is not globally matched to session time',()=>{
 const w=F.world(),n=project(w,i=>i.asOf=999).n;
 assert(P.projectNpcKnowledge(n,w.truth,w.solution).success);
 return 'projection validates hashes, not an absent session tick';
});
test('E05','standalone component schemas are not frozen snapshots',()=>{
 const p=T.PersonSchema.parse({id:'person:x',name:'X'});assert(!Object.isFrozen(p));p.name='changed';
 const r=S.EventResolutionSchema.parse({eventId:'event:x',targets:[],responsibility:{completeness:'complete',assignments:[]},intent:null,mechanism:null,causesComplete:false});
 assert(!Object.isFrozen(r));return 'leaf schemas validate shape, root parsers confer snapshot guarantees';
});
test('E06','self is implicit, even with empty NPC awareness',()=>{
 const w=F.world(),q=project(w,()=>{});assert.deepEqual(q.c.awareness,[]);assert.deepEqual(q.c.self,{kind:'person',index:1});
});
test('E07','knowledge truth is authored truth, not proof of acquisition/inference',()=>{
 const w=F.world(),q=project(w,i=>i.attitudes=[F.propositionAttitude('ben-in-killing',F.knowledge(true),0,F.prior)]);
 assert.equal(q.c.attitudes[0].stance.value,true);
 return 'prior knowledge of later event accepted; no autonomous knowledge justification';
});
test('E08','runtime root brands do not serialize',()=>{
 const w=F.world(),q=project(w,()=>{});for(const o of [w.truth,w.solution,q.n])assert.deepEqual(Object.getOwnPropertySymbols(o),[]);
 return 'nominal TypeScript brands require reparsing after JSON load';
});
const modules={T,TI,S,SI,N,P};
writeFileSync(out+'/additional-results.json',JSON.stringify(rows,null,2));
writeFileSync(out+'/runtime-exports.json',JSON.stringify(Object.fromEntries(Object.entries(modules).map(([k,v])=>[k,Object.keys(v).sort()])),null,2));
console.log(JSON.stringify(rows,null,2));if(rows.some(r=>r.status==='FAIL'))process.exitCode=1;
