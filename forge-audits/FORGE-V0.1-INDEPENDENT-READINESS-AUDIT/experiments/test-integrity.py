import json, pathlib, subprocess, collections, hashlib
ROOT=pathlib.Path(__file__).resolve().parent.parent
P=ROOT/'experiments/forge'; E=ROOT/'evidence'; out={}
def run(label,cmd):
 r=subprocess.run(cmd,cwd=P,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=90)
 (E/(label+'.log')).write_text(r.stdout)
 d={'command':cmd,'exit':r.returncode}
 f=E/(label+'.json')
 if f.exists():
  x=json.loads(f.read_text())
  if isinstance(x,list):d.update(count=len(x),first=x[:2])
  else:d.update({k:x[k] for k in ['numTotalTests','numPassedTests','numPendingTests','numTodoTests','success']});d['files']=len(x['testResults']);d['statuses']=dict(collections.Counter(a['status'] for t in x['testResults'] for a in t['assertionResults']))
 out[label]=d
def tests(label):run(label,['npm','test','--','--reporter=json','--outputFile='+str(E/(label+'.json'))])
config=P/'vitest.config.ts'
config.write_text('export default { test: { include: ["tests/forge/identity.test.ts"] } };\n')
tests('introduced-config')
config.write_text('export default { test: { include: ["tests/audit-skip.test.ts"] } };\n')
probe=P/'tests/audit-skip.test.ts'
probe.write_text('import { describe, test, expect } from "vitest";\ndescribe.skip("suite skipped",()=>{test("red if executed",()=>expect(false).toBe(true));});\ntest.skip("test skipped",()=>expect(false).toBe(true));\ntest.todo("todo test");\ntest("active",()=>expect(true).toBe(true));\n')
tests('skip-todo')
run('skip-list',['node','node_modules/vitest/vitest.mjs','list','--no-static-parse','--json='+str(E/'skip-list.json')])
config.unlink();probe.unlink()
victim=P/'tests/forge/identity.test.ts'; original=victim.read_bytes();victim.unlink()
tests('deleted-test-file')
victim.write_bytes(original)
run('dynamic-inventory',['node','node_modules/vitest/vitest.mjs','list','--no-static-parse','--json='+str(E/'dynamic-inventory.json')])
pkg=P/'package.json'; old=pkg.read_bytes(); d=json.loads(old);d['scripts']['test']='node -e "process.exit(0)"';d['scripts']['preinstall']='node -e "require(\'fs\').writeFileSync(\'audit-lifecycle-marker\',\'executed\')"';pkg.write_text(json.dumps(d,indent=2)+'\n')
run('redefined-npm-test',['npm','test'])
run('lifecycle-default',['npm','ci','--offline','--no-audit','--no-fund']);out['lifecycle-default']['marker']=(P/'audit-lifecycle-marker').exists()
(P/'audit-lifecycle-marker').unlink(missing_ok=True)
run('lifecycle-ignored',['npm','ci','--offline','--no-audit','--no-fund','--ignore-scripts']);out['lifecycle-ignored']['marker']=(P/'audit-lifecycle-marker').exists()
pkg.write_bytes(old)
out['lock-install-scripts']=[{'path':k,'version':v.get('version')} for k,v in json.loads((P/'package-lock.json').read_text())['packages'].items() if v.get('hasInstallScript')]
(E/'test-experiments-summary.json').write_text(json.dumps(out,indent=2))
print(json.dumps(out,indent=2))
