import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync('work/preflight-lab.mjs','utf8');
const begin=source.indexOf('// Small carry-forward model:');
const end=source.indexOf('\nconst report=',begin);
assert(begin>0&&end>begin);
// Reexecute only the changed pure finding model; the already-run Git/framing code is unchanged.
const code=source.slice(begin,end)+'\nreturn findingCases;';
const cases=new Function('assert','unique',code)(assert,a=>new Set(a).size===a.length);
const evidence=JSON.parse(readFileSync('outputs/preflight-evidence.json','utf8'));
evidence.findings=cases;
evidence.profile='Non-normative scratch policies; wire/framing are illustrative only. Finding assignment strengthened after confirmed owner handoff.';
evidence.findingPolicy='Fail closed on reviewer replacement absent a proven reassignment rule. Reassignment wire/authority remains unresolved.';
writeFileSync('outputs/preflight-evidence.json',JSON.stringify(evidence,null,2)+'\n');
console.log(cases.length+' revised assigned-reviewer model assertions passed');
