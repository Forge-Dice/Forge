import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const evidence=JSON.parse(readFileSync('outputs/preflight-evidence.json','utf8'));
// Composition model consumes outcomes of separately tested graph/staleness validators.
// This is not a replacement for production validation of raw observation payloads.
function gate(f){
  if(f.format===1)return {allowed:true,startFromCommit:f.C}; // approved legacy fixture
  const errors=[];
  if(!f.current)errors.push('CONTRACT_NOT_CURRENT');
  if(f.approvedHash!==f.contentHash)errors.push('CONTRACT_NOT_APPROVED');
  if(f.activeRun)errors.push('RUN_ALREADY_ACTIVE');
  if(f.contractBlockers.length)errors.push('OPEN_BLOCKING_FINDING');
  if(!f.dependencyAccepted||!f.dependencyInS)errors.push('DEPENDENCY_INVALID');
  if(f.observedContractHash!==f.contentHash)errors.push('CONTRACT_HASH_MISMATCH');
  errors.push(...f.graphReasons,...f.specReasons);
  return errors.length?{allowed:false,reasons:[...new Set(errors)].sort()}:{allowed:true,startFromCommit:f.R};
}
const valid={format:2,C:evidence.commitObjects.C,R:evidence.commitObjects['R later main'],current:true,contentHash:'a'.repeat(64),approvedHash:'a'.repeat(64),observedContractHash:'a'.repeat(64),activeRun:false,contractBlockers:[],dependencyAccepted:true,dependencyInS:true,graphReasons:evidence.graph[0].reasons,specReasons:evidence.staleness[0].result};
const cases=[
  ['Format1 keeps C',{format:1},true],
  ['Format2 starts R',{},true],
  ['wrong approval hash',{approvedHash:'b'.repeat(64)},false],
  ['superseded contract',{current:false},false],
  ['active run',{activeRun:true},false],
  ['blocking contract finding persists',{contractBlockers:['F-001']},false],
  ['dependency not accepted',{dependencyAccepted:false},false],
  ['dependency absent S',{dependencyInS:false},false],
  ['contract hash mismatch',{observedContractHash:'b'.repeat(64)},false],
  ['M not containing C',{graphReasons:evidence.graph.find(x=>x.id==='G14').reasons},false],
  ['stale read',{specReasons:evidence.staleness.find(x=>x.name==='read changed').result},false],
  ['stale modify',{specReasons:evidence.staleness.find(x=>x.name==='scope modify changed').result},false],
  ['create collision',{specReasons:evidence.staleness.find(x=>x.name==='create target appeared').result},false],
  ['changed then reverted inputs',{specReasons:evidence.staleness.find(x=>x.name==='changed then reverted').result},true],
  ['run before registration',{graphReasons:evidence.graph.find(x=>x.name==='runBase before registration').reasons},false],
  ['R reachable only through side branch',{graphReasons:evidence.graph.find(x=>x.name==='R reachable only as main second parent').reasons},false],
].map(([name,patch,expected],i)=>{const f={...valid,...patch};const actual=gate(f);assert.equal(actual.allowed,expected,name);if(expected)assert.equal(actual.startFromCommit,f.format===1?f.C:f.R);return {id:`T${i+1}`,name,expected,actual};});
writeFileSync('outputs/start-gate-model-results.json',JSON.stringify(cases,null,2)+'\n');
console.log(`${cases.length} gate composition assertions passed`);
