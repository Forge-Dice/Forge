import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

// NON-NORMATIVE scratch policy prototype, not a Format-2 schema or contract proposal.
// Its illustrative wire/framing/hash fixtures were built before the complete handoff.
// Actual V2 wire, marker, hashing, revision and dependency encoding remain UNRESOLVED.
// No production imports, network, refs, branches or pushes.
const root = resolve(process.argv[2] || 'work/graph-lab');
mkdirSync(root, { recursive: true });
const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_NO_REPLACE_OBJECTS: '1', GIT_AUTHOR_NAME: 'Lab', GIT_AUTHOR_EMAIL: 'lab@example.invalid', GIT_COMMITTER_NAME: 'Lab', GIT_COMMITTER_EMAIL: 'lab@example.invalid', GIT_AUTHOR_DATE: '2026-10-03T00:00:00Z', GIT_COMMITTER_DATE: '2026-10-03T00:00:00Z' };
function git(args, input, allowed = [0]) {
  const r = spawnSync('git', ['-C', root, ...args], { input, env, encoding: null, maxBuffer: 16 * 1024 * 1024 });
  if (!allowed.includes(r.status)) throw Error(`${args.join(' ')}: ${r.stderr?.toString()}`);
  return r;
}
git(['init', '--bare', '--object-format=sha1', '.']);
const out = args => git(args).stdout.toString('utf8').trim();
const oid = bytes => git(['hash-object', '-w', '--stdin'], bytes).stdout.toString().trim();
let serial = 0;
function tree(files) {
  const build = entries => {
    const groups = new Map(); const rows = [];
    for (const [path, val] of entries) {
      const slash = path.indexOf('/');
      if (slash < 0) { const [mode, data] = Array.isArray(val) ? val : ['100644', val]; rows.push(`${mode} blob ${oid(data)}\t${path}\0`); }
      else { const dir = path.slice(0, slash); if (!groups.has(dir)) groups.set(dir, []); groups.get(dir).push([path.slice(slash + 1), val]); }
    }
    for (const [dir, items] of groups) rows.push(`040000 tree ${build(items)}\t${dir}\0`);
    return git(['mktree', '-z'], Buffer.from(rows.join(''))).stdout.toString().trim();
  };
  return build(Object.entries(files));
}
const commits = {};
function commit(label, files, parents = []) {
  const sha = git(['commit-tree', tree(files), ...parents.flatMap(p => ['-p', p])], `${++serial} ${label}\n`).stdout.toString().trim();
  commits[label] = sha; return sha;
}
const parents = sha => out(['show', '-s', '--format=%P', sha]).split(' ').filter(Boolean);
const ancestor = (a, b) => git(['merge-base', '--is-ancestor', a, b], undefined, [0, 1]).status === 0;
const fp = (a, b) => out(['rev-list', '--first-parent', b]).split('\n').includes(a);
function entry(c, p) {
  const raw = git(['ls-tree', '-z', c, '--', p]).stdout.toString();
  if (!raw) return null;
  const m = /^(\d+) (blob|tree|commit) ([a-f0-9]{40})\t([^\0]+)\0$/.exec(raw);
  if (!m || m[4] !== p) throw Error('invalid tree entry');
  return { mode: m[1], type: m[2], oid: m[3] };
}
const diff = (a,b) => git(['diff-tree','--no-commit-id','--name-only','--no-renames','-r','-z',a,b,'--']).stdout.toString().split('\0').filter(Boolean).sort();
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const path = 'forge/contracts/V-01.r1.md';
const base = { 'src/a.ts': 'a\n', 'src/b.ts': 'b\n', 'package-lock.json': '{}\n', 'docs/note.md': 'note\n' };
const S = commit('S', base);
const text = 'contract exact LF bytes\n';
const cf = { ...base, [path]: text };
const C = commit('C', cf, [S]);
const P = commit('P unrelated main advance', { ...base, 'docs/note.md': 'new\n' }, [S]);
const mf = { ...cf, 'docs/note.md': 'new\n' };
const M = commit('M normal registration merge', mf, [P,C]);
const R = commit('R later main', { ...mf, 'docs/later.md': 'later\n' }, [M]);
const H = commit('H current main observation', { ...mf, 'docs/later.md': 'later\n', 'docs/head.md':'head\n' }, [R]);
function validateGraph({ s=S,c=C,m=M,r=R,h=H, contractPath=path }={}) {
  const errors = [];
  const cp = parents(c); const mp = parents(m);
  if (cp.length !== 1 || cp[0] !== s) errors.push('C_PARENT_NOT_S');
  if (mp.length !== 2 || mp[1] !== c) errors.push('M_PARENTS');
  if (mp.length < 1 || !fp(s, mp[0])) errors.push('S_NOT_MAIN_BASE');
  if (!ancestor(c,m)) errors.push('C_NOT_IN_M');
  if (!fp(m,r)) errors.push('M_NOT_FIRST_PARENT_R');
  if (!fp(r,h)) errors.push('R_NOT_MAIN');
  if (entry(s, contractPath) !== null) errors.push('REVISION_PATH_EXISTS');
  const ec = entry(c,contractPath), em = entry(m,contractPath), er = entry(r,contractPath);
  if (!ec || ec.mode !== '100644') errors.push('CONTRACT_MISSING_OR_MODE');
  if (!same(ec,em) || !same(ec,er)) errors.push('CONTRACT_CHANGED');
  if (!same(diff(s,c),[contractPath])) errors.push('C_EXTRA_DELTA');
  if (mp[0] && !same(diff(mp[0],m),[contractPath])) errors.push('M_EXTRA_DELTA');
  return errors.sort();
}
const graph = [];
function gc(name, args, allow) {
  const actual = validateGraph(args); assert.equal(actual.length === 0,allow,name);
  const full = { s:S,c:C,m:M,r:R,h:H,...args };
  graph.push({ id:`G${String(graph.length+1).padStart(2,'0')}`, name, expected:allow?'ALLOW':'REJECT', actual:actual.length?'REJECT':'ALLOW', reasons:actual, commits:full });
}
gc('normal merge, later R',{},true);
const M0 = commit('M directly from S', cf, [S,C]);
gc('no main advancement',{m:M0,r:M0,h:M0},true);
gc('R equals M',{r:M,h:M},true);
gc('R older than H but first-parent main',{},true);
const Pc=commit('P changes read', {...base,'src/a.ts':'changed\n'},[S]);
const Mc=commit('M stale read main', {...cf,'src/a.ts':'changed\n'},[Pc,C]);
gc('stale main graph valid; staleness separately rejects',{m:Mc,r:Mc,h:Mc},true);
const Ce=commit('C with extra code',{...cf,'src/evil.ts':'evil'},[S]);
const Me=commit('M carries extra code',{...mf,'src/evil.ts':'evil'},[P,Ce]);
gc('contract commit with extra code',{c:Ce,m:Me,r:Me,h:Me},false);
const B=commit('extra code before C',{...base,'src/evil.ts':'evil'},[S]);
const Cb=commit('C after extra code',{...cf,'src/evil.ts':'evil'},[B]);
const Mb=commit('M with code branch',{...mf,'src/evil.ts':'evil'},[P,Cb]);
gc('extra code in earlier contract branch commit',{c:Cb,m:Mb,r:Mb,h:Mb},false);
const Cv=commit('C removes preceding code',cf,[B]);
const Mv=commit('M net clean but branch dirty',mf,[P,Cv]);
gc('extra code changed then reverted on contract branch',{c:Cv,m:Mv,r:Mv,h:Mv},false);
const X=commit('unrelated root',base);
const Cm=commit('C merge same tree',cf,[S,P]);
const Mm=commit('M with merge C',mf,[P,Cm]);
gc('C is a merge commit',{c:Cm,m:Mm,r:Mm,h:Mm},false);
const Cx=commit('C foreign second parent',cf,[S,X]);
const Mx=commit('M with foreign C parent',mf,[P,Cx]);
gc('C foreign second parent injects history',{c:Cx,m:Mx,r:Mx,h:Mx},false);
const Mt=commit('M octopus injection',mf,[P,C,X]);
gc('M foreign third parent',{m:Mt,r:Mt,h:Mt},false);
const Mr=commit('M reversed parents',mf,[C,P]);
gc('M parent order reversed',{m:Mr,r:Mr,h:Mr},false);
const Mblob=commit('M changed contract blob',{...mf,[path]:text+'changed\n'},[P,C]);
gc('contract blob changed C to M',{m:Mblob,r:Mblob,h:Mblob},false);
const Mno=commit('M lacks C but copies blob',mf,[P]);
gc('M not containing C',{m:Mno,r:Mno,h:Mno},false);
const Cu=commit('unrelated C',cf,[X]);
const Mu=commit('M unrelated C',mf,[P,Cu]);
gc('unrelated C grafted at M',{c:Cu,m:Mu,r:Mu,h:Mu},false);
const Mf=commit('M fake main first parent',mf,[X,C]);
gc('foreign M first parent',{m:Mf,r:Mf,h:Mf},false);
gc('runBase before registration',{r:P},false);
const Side=commit('side run',mf,[M]);
gc('R on unmerged side branch',{r:Side},false);
const Hside=commit('main merges side R',{...mf,'docs/later.md':'later\n'},[R,Side]);
gc('R reachable only as main second parent',{r:Side,h:Hside},false);
const Rblob=commit('R changed contract',{...mf,[path]:text+'oops'},[M]);
gc('contract changed after registration',{r:Rblob,h:Rblob},false);
const Mextra=commit('M adds code absent C',{...mf,'src/injected.ts':'evil'},[P,C]);
gc('merge conflict resolution injects code',{m:Mextra,r:Mextra,h:Mextra},false);
gc('fast-forward registration deferred',{m:C,r:C,h:C},false);
gc('squash registration deferred',{m:Mno,r:Mno,h:Mno},false);
gc('wrong specifiedAgainst',{s:P},false);
gc('wrong C selected as parent base',{c:S},false);
gc('wrong M selected later commit',{m:R},false);
const Q=commit('unrelated code merge side',{...mf,'docs/q.md':'q'},[M]);
const Rmerge=commit('later main merge',{...mf,'docs/later.md':'later\n','docs/q.md':'q'},[R,Q]);
gc('R itself normal main merge',{r:Rmerge,h:Rmerge},true);
gc('wrong main snapshot excludes M',{h:P},false);

function stale(s,r,reads=['src/a.ts'],modify=['src/b.ts'],creates=['src/new.ts']) {
  if (!ancestor(s,r)) return ['SPEC_BASE_NOT_ANCESTOR'];
  const errors=[];
  for (const selector of [...new Set([...reads,...modify])].sort()) {
    const dir=selector.endsWith('/'), p=dir?selector.slice(0,-1):selector;
    const a=entry(s,p),b=entry(r,p);
    if (!a || (dir ? a.type !== 'tree' : a.type !== 'blob')) errors.push(`SPEC_INPUT_INVALID:${selector}`);
    else if (!same(a,b)) errors.push(`SPEC_STALE:${selector}`);
  }
  for(const p of [...creates].sort()) {
    if(entry(s,p)) errors.push(`CREATE_PRESENT_AT_S:${p}`);
    if(entry(r,p)) errors.push(`CREATE_TARGET_EXISTS:${p}`);
    const seg=p.split('/'); seg.pop();
    while(seg.length){const prefix=seg.join('/'); for(const c of [s,r]){const e=entry(c,prefix);if(e&&e.type!=='tree')errors.push(`CREATE_PARENT_BLOCKED:${prefix}`);}seg.pop();}
  }
  return [...new Set(errors)].sort();
}
function historicalTouched(s,r,selectors) {
  const touched=new Set();
  for(const c of out(['rev-list',`${s}..${r}`]).split('\n').filter(Boolean)) {
    for(const p of parents(c)) for(const f of diff(p,c)) if(selectors.some(x=>x.endsWith('/')?f.startsWith(x):f===x))touched.add(f);
  }
  return [...touched].sort();
}
const staleness=[];
function sc(name,files,expect,opts={}) {
  const r=typeof files==='string'?files:commit(`stale ${name}`,files,[S]);
  const reads=opts.reads??['src/a.ts'],mod=opts.modify??['src/b.ts'],creates=opts.creates??['src/new.ts'];
  const actual=stale(S,r,reads,mod,creates);assert.deepEqual(actual,expect,name);
  staleness.push({id:`S${String(staleness.length+1).padStart(2,'0')}`,name,S,R:r,reads,modify:mod,creates,result:actual,historicalTouched:historicalTouched(S,r,[...reads,...mod])});
}
sc('unchanged',R,[]);
const Changed=commit('watched changed',{...cf,'src/a.ts':'change'},[M]);
const Revert=commit('watched reverted',cf,[Changed]);
sc('changed then reverted',Revert,[]);
sc('read changed',{...cf,'src/a.ts':'change'},['SPEC_STALE:src/a.ts']);
sc('scope modify changed',{...cf,'src/b.ts':'change'},['SPEC_STALE:src/b.ts']);
const deleted={...cf};delete deleted['src/a.ts'];
sc('read deleted',deleted,['SPEC_STALE:src/a.ts']);
sc('read renamed',{...deleted,'src/renamed.ts':'a\n'},['SPEC_STALE:src/a.ts']);
sc('new file under read directory',{...cf,'src/other.ts':'x'},['SPEC_STALE:src/'],{reads:['src/'],modify:[]});
sc('new sibling under exact file selector',{...cf,'src/other.ts':'x'},[]);
sc('create target appeared',{...cf,'src/new.ts':'x'},['CREATE_TARGET_EXISTS:src/new.ts']);
sc('unrelated file change',{...cf,'docs/note.md':'changed'},[]);
sc('watched lockfile changes',{...cf,'package-lock.json':'changed'},['SPEC_STALE:package-lock.json'],{reads:['package-lock.json']});
sc('unwatched lockfile demonstrates incomplete declaration',{...cf,'package-lock.json':'changed'},[]);
sc('main merge changes watched file',Mc,['SPEC_STALE:src/a.ts']);
sc('main merge unrelated',Rmerge,[]);
sc('mode only change',{...cf,'src/a.ts':['100755','a\n']},['SPEC_STALE:src/a.ts']);
sc('file becomes symlink',{...cf,'src/a.ts':['120000','b.ts']},['SPEC_STALE:src/a.ts']);
sc('read missing at S',cf,['SPEC_INPUT_INVALID:absent.ts'],{reads:['absent.ts']});
sc('create was already at S',cf,['CREATE_PRESENT_AT_S:src/a.ts','CREATE_TARGET_EXISTS:src/a.ts'],{creates:['src/a.ts']});
sc('create directory conflict',{...cf,'src/new.ts/nested':'x'},['CREATE_TARGET_EXISTS:src/new.ts']);
sc('create ancestor is a file',cf,['CREATE_PARENT_BLOCKED:src/a.ts'],{creates:['src/a.ts/x']});
const Sibling=commit('side temporary watched edit',{...cf,'src/a.ts':'temporary'},[M]);
const Discard=commit('merge discards side edit',mf,[M,Sibling]);
sc('merge discards side change',Discard,[]);

const marker='<!-- forge-contract-end:v2 -->';
const hash = b => createHash('sha256').update(b).digest('hex');
const taskRe=/^[A-Z][A-Z0-9]*(-[A-Z0-9]+)+$/;
const pathRe=/^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;
const validPath=p=>typeof p==='string'&&p.length<=255&&pathRe.test(p)&&p.split('/').every(s=>s!=='.'&&s!=='..');
const strict=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...keys].sort());
const unique=a=>new Set(a).size===a.length;
function metadataValid(m){
  if(!strict(m,['forgeContractFormat','taskId','revision','specifiedAgainst','reads','scope','dependencies','requiredChecks','mutationSmoke','supersedes']))return false;
  if(m.forgeContractFormat!==2||typeof m.taskId!=='string'||m.taskId.length>64||!taskRe.test(m.taskId)||!Number.isSafeInteger(m.revision)||m.revision<1||!/^[a-f0-9]{40}$/.test(m.specifiedAgainst))return false;
  if(!Array.isArray(m.reads)||!unique(m.reads)||!m.reads.every(p=>typeof p==='string'&&validPath(p.endsWith('/')?p.slice(0,-1):p)))return false;
  if(!strict(m.scope,['create','modify'])||!['create','modify'].every(k=>Array.isArray(m.scope[k])&&m.scope[k].every(validPath)))return false;
  const paths=[...m.scope.create,...m.scope.modify];
  if(!unique(paths)||paths.some(p=>p.startsWith('forge/contracts/')||p.startsWith('forge/approvals/')))return false;
  if(paths.some((a,i)=>paths.some((b,j)=>i!==j&&(a.startsWith(b+'/')||b.startsWith(a+'/')))))return false;
  if(!Array.isArray(m.dependencies)||!unique(m.dependencies.map(x=>x.taskId))||!m.dependencies.every(d=>strict(d,['taskId','acceptedCommit'])&&typeof d.taskId==='string'&&taskRe.test(d.taskId)&&d.taskId!==m.taskId&&/^[a-f0-9]{40}$/.test(d.acceptedCommit)))return false;
  if(!Array.isArray(m.requiredChecks)||m.requiredChecks.length===0||!unique(m.requiredChecks.map(x=>x.name))||!m.requiredChecks.every(c=>strict(c,['name','command'])&&/^[a-z][a-z0-9-]{0,31}$/.test(c.name)&&typeof c.command==='string'&&/\S/.test(c.command)))return false;
  if(!['none','optional','required'].includes(m.mutationSmoke))return false;
  if(m.revision===1)return m.supersedes===null;
  return strict(m.supersedes,['revision','contentHash'])&&m.supersedes.revision===m.revision-1&&/^[a-f0-9]{64}$/.test(m.supersedes.contentHash);
}
const meta={forgeContractFormat:2,taskId:'V-01',revision:1,specifiedAgainst:S,reads:['src/a.ts','package-lock.json'],scope:{create:['src/new.ts'],modify:[]},dependencies:[],requiredChecks:[{name:'test',command:'npm test'}],mutationSmoke:'required',supersedes:null};
const doc=(m=meta,body='# Contract\n\nUnicode: café 🛠️.\n')=>`---json\n${JSON.stringify(m,null,2)}\n---\n${body}${marker}\n`;
function parse(bytes){
  let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{return {error:'UTF8'};}
  if(text.charCodeAt(0)===0xfeff)return {error:'BOM'};
  if(text.includes('\r'))return {error:'CR'};
  if(text.includes('\0'))return {error:'NUL'};
  if(!text.startsWith('---json\n'))return {error:'OPEN'};
  const end=text.indexOf('\n---\n',7);if(end<0)return {error:'CLOSE'};
  const raw=text.slice(8,end);let m;try{m=JSON.parse(raw);}catch{return {error:'JSON'};}
  if(JSON.stringify(m,null,2)!==raw)return {error:'CANONICAL'};
  if(!metadataValid(m))return {error:'SCHEMA'};
  const body=text.slice(end+5);const lines=body.split('\n');
  if(lines.filter(x=>x===marker).length!==1||lines.at(-2)!==marker||lines.at(-1)!=='')return {error:'END'};
  return {metadata:m,hash:hash(Buffer.concat([Buffer.from('forge-contract-v2\n'),bytes]))};
}
const framing=[];
function fc(name,bytes,expected){const a=parse(typeof bytes==='string'?Buffer.from(bytes):bytes);assert.equal(a.error??'OK',expected,name);framing.push({id:`F${String(framing.length+1).padStart(2,'0')}`,name,expected,actual:a.error??'OK',hash:a.hash});return a;}
const good=doc();const golden=fc('canonical LF unicode',good,'OK');
fc('truncated before marker',good.slice(0,good.indexOf(marker)),'END');
fc('truncated within marker',good.slice(0,-9),'END');
fc('missing final LF',good.slice(0,-1),'END');
fc('duplicate full-line marker',good+marker+'\n','END');
fc('bytes after marker',good+'x','END');
fc('blank line after marker',good+'\n','END');
fc('CRLF',good.replaceAll('\n','\r\n'),'CR');
fc('BOM','\ufeff'+good,'BOM');
fc('malformed JSON',good.replace('"revision": 1','"revision":'),'JSON');
fc('inline marker text in markdown',doc(meta,`Use \`${marker}\` in examples.\n`),'OK');
fc('exact marker line inside markdown fence',doc(meta,'```\n'+marker+'\n```\n'),'END');
fc('invalid UTF8',Buffer.concat([Buffer.from(good),Buffer.from([0xff])]),'UTF8');
fc('NUL in body',doc(meta,'body\0\n'),'NUL');
fc('status field smuggling',doc({...meta,status:'approved'}),'SCHEMA');
fc('unknown metadata',doc({...meta,title:'extra'}),'SCHEMA');
fc('runBase in metadata',doc({...meta,runBase:S}),'SCHEMA');
fc('C in metadata',doc({...meta,contractCommit:C}),'SCHEMA');
fc('duplicate JSON key',good.replace('"revision": 1,','"revision": 1,\n  "revision": 1,'),'CANONICAL');
fc('noncanonical spacing',good.replace('"revision": 1','"revision":  1'),'CANONICAL');
fc('Format1 passed to V2',doc({...meta,forgeContractFormat:1}),'SCHEMA');
fc('unknown Format',doc({...meta,forgeContractFormat:3}),'SCHEMA');
fc('empty requiredChecks',doc({...meta,requiredChecks:[]}),'SCHEMA');
fc('read traversal',doc({...meta,reads:['../a']}),'SCHEMA');
fc('overlapping scope',doc({...meta,scope:{create:['x','x/y'],modify:[]}}),'SCHEMA');
fc('unresolved dependency',doc({...meta,dependencies:[{taskId:'D-1',acceptedCommit:null}]}),'SCHEMA');
fc('first revision with supersedes',doc({...meta,supersedes:{revision:0,contentHash:'a'.repeat(64)}}),'SCHEMA');
fc('revision2 correct shape',doc({...meta,revision:2,supersedes:{revision:1,contentHash:golden.hash}}),'OK');
fc('revision2 skips predecessor',doc({...meta,revision:2,supersedes:{revision:0,contentHash:golden.hash}}),'SCHEMA');
const nfc=fc('NFC body',doc(meta,'é\n'),'OK'),nfd=fc('NFD body',doc(meta,'e\u0301\n'),'OK');assert.notEqual(nfc.hash,nfd.hash);
const cut=fc('shortened body with intact marker',doc(meta,'Short.\n'),'OK');assert.notEqual(cut.hash,golden.hash);
const reorder=fc('different canonical key order',doc(Object.fromEntries(Object.entries(meta).reverse())),'OK');assert.notEqual(reorder.hash,golden.hash);

// Small carry-forward model: ledger identity is task-scoped opaque id; title/anchor/reviewer are not identity.
const findingCases=[];
function replayFinding(events){
  const revisions=[];const ledger=new Map();const decisions=new Set();
  for(const e of events){
    const current=revisions.at(-1);
    if(e.type==='revision'){
      if(e.n!==(current?.n??0)+1)return 'REVISION_NOT_NEXT';
      if(e.prev!==(current?.hash??null))return 'SUPERSEDES_MISMATCH';
      if(revisions.some(r=>r.hash===e.hash))return 'DUPLICATE_HASH';
      revisions.push(e);continue;
    }
    if(!current||e.hash!==current.hash)return 'WRONG_REVIEW_HASH';
    if(decisions.has(e.hash))return 'ALREADY_REVIEWED';
    if(e.reviewer===current.author)return 'NOT_INDEPENDENT';
    const resolutions=e.resolutions??[];const findings=e.findings??[];
    if(!unique(resolutions.map(x=>x.id))||!unique(findings.map(x=>x.id)))return 'DUPLICATE_ID';
    for(const res of resolutions){
      const f=ledger.get(res.id);if(!f||f.resolved)return 'RESOLUTION_UNKNOWN';
      if(f.origin!==res.origin||!res.rationale?.trim())return 'RESOLUTION_BINDING';
      if(e.reviewer!==f.assignedReviewer)return 'ASSIGNED_REVIEWER_REQUIRED';
    }
    for(const f of findings){
      const prev=ledger.get(f.id);
      if(prev?.resolved)return 'ID_REUSE';
      if(prev&&f.severity!=='blocking')return 'BLOCKING_DOWNGRADE';
    }
    const pending=new Map([...ledger].map(([k,v])=>[k,{...v}]));
    for(const res of resolutions)pending.get(res.id).resolved=true;
    for(const f of findings){const prev=pending.get(f.id);if(prev?.resolved)return 'RESOLVE_AND_REPEAT';pending.set(f.id,{...f,origin:prev?.origin??e.hash,assignedReviewer:prev?.assignedReviewer??e.reviewer,resolved:false});}
    if(e.verdict==='approved'&&[...pending.values()].some(f=>f.severity==='blocking'&&!f.resolved))return 'OPEN_BLOCKING_FINDING';
    if(e.verdict==='changes_requested'&&findings.length===0&&resolutions.length===0)return 'FINDINGS_REQUIRED';
    ledger.clear();for(const [k,v]of pending)ledger.set(k,v);decisions.add(e.hash);
  }
  return 'OK';
}
const a='a'.repeat(64),b='b'.repeat(64),c='c'.repeat(64);
const rev=(n,hash,prev)=>({type:'revision',n,hash,prev,author:'spec-author'});
const review=(hash,findings=[],resolutions=[],verdict='approved',reviewer='independent-B')=>({type:'review',hash,findings,resolutions,verdict,reviewer});
const f={id:'F-001',severity:'blocking',summary:'boundary wrong',anchor:'C4'};
const origin=[rev(1,a,null),review(a,[f],[],'changes_requested')];
const next=[...origin,rev(2,b,a)];
const res={id:'F-001',origin:a,rationale:'C4 now specifies exact bound; verified at current hash'};
function kc(name,events,expect){const actual=replayFinding(events);assert.equal(actual,expect,name);findingCases.push({id:`K${String(findingCases.length+1).padStart(2,'0')}`,name,expected:expect,actual,events});}
kc('finding created revision N',origin,'OK');
kc('version bump omits blocker',[...next,review(b)],'OPEN_BLOCKING_FINDING');
kc('same finding explicitly resolved',[...next,review(b,[],[res])],'OK');
kc('same finding ignored',[...next,review(b,[f])],'OPEN_BLOCKING_FINDING');
kc('renamed summary same id',[...next,review(b,[{...f,summary:'renamed'}])],'OPEN_BLOCKING_FINDING');
kc('renamed id leaves original open',[...next,review(b,[{...f,id:'F-002',severity:'non_blocking'}])],'OPEN_BLOCKING_FINDING');
kc('reviewer changed no resolution',[...next,review(b,[],[],'approved','independent-C')],'OPEN_BLOCKING_FINDING');
kc('replacement reviewer cannot silently erase assignment',[...next,review(b,[],[res],'approved','independent-C')],'ASSIGNED_REVIEWER_REQUIRED');
kc('anchor moved',[...next,review(b,[{...f,anchor:'C9'}])],'OPEN_BLOCKING_FINDING');
kc('new blocker added old resolved',[...next,review(b,[{...f,id:'F-002'}],[res])],'OPEN_BLOCKING_FINDING');
kc('new nonblocking added old resolved',[...next,review(b,[{...f,id:'F-002',severity:'non_blocking'}],[res])],'OK');
kc('old approval reused',[...next,review(a,[],[res])],'WRONG_REVIEW_HASH');
kc('unknown resolution',[...next,review(b,[],[{...res,id:'F-404'}])],'RESOLUTION_UNKNOWN');
kc('resolution wrong origin hash',[...next,review(b,[],[{...res,origin:c}])],'RESOLUTION_BINDING');
kc('empty resolution rationale',[...next,review(b,[],[{...res,rationale:''}])],'RESOLUTION_BINDING');
kc('spec author resolves',[...next,review(b,[],[res],'approved','spec-author')],'NOT_INDEPENDENT');
kc('blocking downgraded',[...next,review(b,[{...f,severity:'non_blocking'}])],'BLOCKING_DOWNGRADE');
kc('duplicate task revision',[...next,rev(2,c,a)],'REVISION_NOT_NEXT');
kc('rollback revision',[...next,rev(1,c,null)],'REVISION_NOT_NEXT');
kc('supersedes skips predecessor',[...next,rev(3,c,a)],'SUPERSEDES_MISMATCH');
kc('self-cycle supersedes',[...origin,rev(2,b,b)],'SUPERSEDES_MISMATCH');
kc('blocker persists through two bumps',[...next,rev(3,c,b),review(c)],'OPEN_BLOCKING_FINDING');
kc('resolved at r2 stays resolved at r3',[...next,review(b,[],[res]),rev(3,c,b),review(c)],'OK');
kc('resolution duplicate ids',[...next,review(b,[],[res,res])],'DUPLICATE_ID');
kc('review twice same hash',[...next,review(b,[],[res]),review(b)],'ALREADY_REVIEWED');
kc('resolved id reused',[...next,review(b,[],[res]),rev(3,c,b),review(c,[f])],'ID_REUSE');

const report={profile:'Non-normative scratch policies; wire/framing are illustrative only. Finding assignment retained after confirmed owner handoff.',findingPolicy:'Fail closed on reviewer replacement absent a proven reassignment rule. Reassignment wire/authority remains unresolved.',gitVersion:out(['--version']),graph,staleness,framing,findings:findingCases,commitObjects:commits,counts:{graph:graph.length,staleness:staleness.length,framing:framing.length,findings:findingCases.length}};
mkdirSync('outputs',{recursive:true});writeFileSync('outputs/preflight-evidence.json',JSON.stringify(report,null,2)+'\n');
writeFileSync('outputs/graph-history.txt',git(['rev-list','--parents',...Object.values(commits)]).stdout);
console.log(JSON.stringify(report.counts));
