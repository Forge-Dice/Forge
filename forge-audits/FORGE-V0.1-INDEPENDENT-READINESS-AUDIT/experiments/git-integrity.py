import subprocess, pathlib, json, os, tempfile, shutil
ROOT=pathlib.Path(__file__).resolve().parent.parent; E=ROOT/'evidence'; P=ROOT/'experiments/git-lab';P.mkdir(exist_ok=True)
env={**os.environ,'GIT_AUTHOR_NAME':'Audit','GIT_AUTHOR_EMAIL':'audit@example.invalid','GIT_COMMITTER_NAME':'Audit','GIT_COMMITTER_EMAIL':'audit@example.invalid','GIT_CONFIG_NOSYSTEM':'1'}
out={}
def git(*args,input=None,extra=None,cwd=P):
 r=subprocess.run(['git',*args],input=input,cwd=cwd,env={**env,**(extra or {})},text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30)
 return {'command':['git',*args],'exit':r.returncode,'stdout':r.stdout,'stderr':r.stderr}
def val(*args,input=None):
 r=git(*args,input=input)
 if r['exit']:raise RuntimeError(r)
 return r['stdout'].strip()
val('init','--quiet');val('config','core.autocrlf','false')
blob=val('hash-object','-w','--stdin',input='hello\n'); tree=val('mktree',input=f'100644 blob {blob}\ta.txt\n')
base=val('commit-tree',tree,input='base\n');contract=val('commit-tree',tree,'-p',base,input='contract\n');other=val('commit-tree',tree,input='foreign root\n')
merge=val('commit-tree',tree,'-p',other,'-p',contract,input='injected second parent\n');val('update-ref','refs/heads/main',merge);val('symbolic-ref','HEAD','refs/heads/main')
out['second-parent']={'base':base,'contract':contract,'foreign':other,'result':merge,'mergeBase':git('merge-base','--is-ancestor',contract,merge),'firstParent':git('rev-list','--first-parent',merge),'parents':git('cat-file','-p',merge),'contractMergeParentCount':git('rev-list','--parents','-n','1',merge)}
replacement=val('commit-tree',tree,'-p',other,input='replacement contract\n');val('replace',contract,replacement)
out['replace-default']=git('merge-base','--is-ancestor',other,contract)
out['replace-disabled']=git('merge-base','--is-ancestor',other,contract,extra={'GIT_NO_REPLACE_OBJECTS':'1'})
out['replace-refs']=git('for-each-ref','refs/replace/');val('replace','-d',contract)
shallow=ROOT/'experiments/git-shallow'
if shallow.exists():shutil.rmtree(shallow)
out['shallow-clone']=git('clone','--quiet','--depth=1',P.as_uri(),str(shallow))
out['shallow-status']=git('rev-parse','--is-shallow-repository',cwd=shallow)
out['shallow-ancestry']=git('merge-base','--is-ancestor',contract,merge,cwd=shallow)
out['unshallow']=git('fetch','--unshallow',cwd=shallow)
out['complete-ancestry']=git('merge-base','--is-ancestor',contract,merge,cwd=shallow)
modeEntries=[('100755','blob',blob,'a.txt'),('120000','blob',blob,'link'),('160000','commit',base,'module'),('100644','blob',blob,'src/A.ts'),('100644','blob',blob,'src/a.ts'),('100644','blob',blob,'CON'),('100644','blob',blob,'aux.txt'),('100644','blob',blob,'café.ts'),('100644','blob',blob,'cafe\u0301.ts'),('100644','blob',blob,'name.'),('100644','blob',blob,'name ')]
# update-index accepts raw paths and modes without checking out a symlink or gitlink.
val('read-tree','--empty')
for mode,kind,sha,path in modeEntries:val('update-index','--add','--cacheinfo',mode,sha,path)
specialTree=val('write-tree');special=val('commit-tree',specialTree,'-p',base,input='modes and names\n')
out['special-tree']=git('ls-tree','-r','--full-tree',special)
out['mode-diff']=git('diff-tree','--no-commit-id','-r','--raw','--no-renames',base,special)
val('read-tree','--empty');val('update-index','--add','--cacheinfo','100644',blob,'renamed.txt');renameTree=val('write-tree');rename=val('commit-tree',renameTree,'-p',base,input='rename\n')
out['rename-detection']=git('diff-tree','--no-commit-id','-r','--name-status','-M',base,rename)
out['rename-disabled']=git('diff-tree','--no-commit-id','-r','--name-status','--no-renames',base,rename)
out['null-delimited-raw']=git('diff-tree','--no-commit-id','-r','--raw','--no-renames','-z',base,special)
(E/'git-experiments.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print(json.dumps(out,ensure_ascii=False,indent=2))
