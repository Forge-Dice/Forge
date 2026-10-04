import { RepoPathSchema } from './forge-control/src/forge/primitives.ts';
import { ChangedFileSchema, VerificationEvidenceSchema } from './forge-control/src/forge/runs.ts';
import { evaluateVerification } from './forge-control/src/forge/verification.ts';
import { writeFileSync } from 'node:fs';
const paths=['a.ts\n','CON','NUL.txt','.git/config','dir/file.','café.txt','a\tb','a\nb','../x'];
const results={paths:paths.map(path=>({path,accepted:RepoPathSchema.safeParse(path).success}))};
const meta={scope:{create:['x'],modify:['x']},requiredChecks:[{name:'test',command:'npm test'}],mutationSmoke:'none'};
const checks=[{name:'test',command:'npm test',exitCode:0}];
results.scope=[
 {fromPath:'forge/coordination/a.md',toPath:'forge/coordination/b.md',change:'renamed'},
 {path:'forge/coordination/a.md',change:'deleted'},
 {path:'x',change:'modified'},
].map(file=>({file,schema:ChangedFileSchema.safeParse(file).success,evaluation:evaluateVerification(meta,{mutations:[]},{checks,changedFiles:[file],mutations:null})}));
results.modeExtra=ChangedFileSchema.safeParse({path:'x',change:'modified',oldMode:'100644',newMode:'120000'}).success;
results.evidenceFake=VerificationEvidenceSchema.safeParse({runId:'run:lab',verifiedCommit:'a'.repeat(40),method:'fresh_clone',changedFiles:[],checks,mutations:null}).success;
writeFileSync(new URL('./integration-results.json',import.meta.url),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));

