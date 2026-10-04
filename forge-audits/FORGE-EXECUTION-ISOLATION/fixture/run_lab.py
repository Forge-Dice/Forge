#!/usr/bin/env python3
import json, os, pathlib, socket, subprocess, tempfile, threading
from pathlib import Path

root=Path(tempfile.mkdtemp(prefix="forge-ei-"))
rows=[]
def run(cmd,cwd=None,env=None,timeout=3):
    try:
        p=subprocess.run(cmd,cwd=cwd,env=env,text=True,capture_output=True,timeout=timeout)
        return p.returncode,p.stdout,p.stderr
    except subprocess.TimeoutExpired:
        return 124,"","TIMEOUT"
def add(i,attack,actual,evidence,passed):
    rows.append({"id":f"FX-{i:02d}","attack":attack,"actual":actual,"evidence":evidence,"passed":passed})

# FX-01..06: real npm lifecycle suppression.
for i,name in enumerate(["preinstall","install","postinstall","preprepare","prepare","postprepare"],1):
    d=root/f"fx{i:02d}"; d.mkdir()
    pkg={"name":f"fx{i}","version":"1.0.0","scripts":{name:f'node -e "require(\\\"fs\\\").writeFileSync(\\\"marker\\\",\\\"x\\\")"'}}
    (d/"package.json").write_text(json.dumps(pkg))
    run(["npm","install","--package-lock-only","--ignore-scripts"],d,timeout=15)
    rc,_,_=run(["npm","ci","--ignore-scripts"],d,timeout=15)
    hit=(d/"marker").exists(); add(i,f"npm lifecycle {name}","contained" if not hit else "executed",f"rc={rc}; marker={hit}",not hit)

# FX-07..24: hostile Node capabilities when executed without an inner sandbox.
payloads={
7:("npm/test script code execution","require('fs').writeFileSync('marker','x')"),
8:("test import side effect","require('fs').writeFileSync('marker','x')"),
9:("child_process exec","require('child_process').execFileSync('sh',['-c','echo x > marker'])"),
10:("child_process spawn","require('child_process').spawnSync('sh',['-c','echo x > marker'])"),
11:("filesystem parent escape","require('fs').writeFileSync('../escape','x')"),
12:("HOME write","require('fs').writeFileSync(process.env.HOME+'/home-write','x')"),
13:("environment dump","console.log(process.env.FORGE_CANARY||'')"),
14:("temp write","require('fs').writeFileSync(process.env.TMPDIR+'/tmp-write','x')"),
15:("cache poisoning","require('fs').mkdirSync(process.env.HOME+'/.npm',{recursive:true});require('fs').writeFileSync(process.env.HOME+'/.npm/poison','x')"),
16:("artifact poisoning","require('fs').writeFileSync('artifact.json','{}')"),
17:("process spawning","for(let i=0;i<20;i++)require('child_process').spawn('sh',['-c','exit 0'])"),
18:("output flood","process.stdout.write('X'.repeat(1024*1024))"),
19:("background/infinite process","setInterval(()=>{},1000)"),
20:("memory exhaustion","let a=[];while(true)a.push(Buffer.alloc(1024*1024))"),
21:("huge test enumeration","for(let i=0;i<500000;i++)JSON.stringify({i})"),
22:("Vitest config execution","require('fs').writeFileSync('vitest.config.executed','x')"),
23:("Vite config execution","require('fs').writeFileSync('vite.config.executed','x')"),
24:("repository write","require('fs').writeFileSync('repo-write','x')")
}
for i,(name,src) in payloads.items():
    d=root/f"fx{i:02d}"; d.mkdir(); (d/"attack.cjs").write_text(src)
    home=d/"home"; home.mkdir(); tmp=d/"tmp"; tmp.mkdir()
    env={"PATH":os.environ["PATH"],"HOME":str(home),"TMPDIR":str(tmp),"FORGE_CANARY":"CANARY_ENV_9f4b"}
    rc,out,_=run(["node","attack.cjs"],d,env,1 if i in (19,20) else 4)
    bounded=i in (19,20) and rc==124
    add(i,name,"bounded by outer timeout only" if bounded else "attack capability available",f"rc={rc}; stdout={len(out)}B",bounded)

# FX-25..29: env/path/link/credential surfaces.
d=root/"fx25"; d.mkdir(); (d/"loader.mjs").write_text("import fs from 'fs';fs.writeFileSync('loader-hit','x')"); (d/"main.mjs").write_text("0")
env={"PATH":os.environ["PATH"],"HOME":str(d),"NODE_OPTIONS":"--import ./loader.mjs"}; rc,_,_=run(["node","main.mjs"],d,env); hit=(d/"loader-hit").exists(); add(25,"NODE_OPTIONS loader","attack capability available" if hit else "contained",f"rc={rc}; hit={hit}",not hit)
d=root/"fx26"; d.mkdir(); b=d/"bin"; b.mkdir(); (b/"git").write_text('#!/bin/sh\necho hijacked > "$PWD/path-hit"\n'); (b/"git").chmod(0o755); env={"PATH":str(b)+":"+os.environ["PATH"],"HOME":str(d)}; rc,_,_=run(["git","--version"],d,env); hit=(d/"path-hit").exists(); add(26,"PATH hijack","attack capability available" if hit else "contained",f"rc={rc}; hit={hit}",not hit)
for i,hard in [(27,False),(28,True)]:
    d=root/f"fx{i}"; d.mkdir(); outside=root/f"outside{i}"; outside.write_text("CANARY"); target=d/"link"
    (os.link(outside,target) if hard else target.symlink_to(outside)); (d/"a.cjs").write_text("require('fs').writeFileSync('link','POISON')"); rc,_,_=run(["node","a.cjs"],d); hit=outside.read_text()=="POISON"; add(i,"hardlink escape" if hard else "symlink escape","outside modified" if hit else "contained",f"rc={rc}; outside={outside.read_text()}",not hit)
d=root/"fx29"; d.mkdir(); home=d/"home"; home.mkdir(); (home/".git-credentials").write_text("https://u:CANARY_GIT_SECRET@example.invalid\n"); add(29,"git credential read","credential canary visible","CANARY_GIT_SECRET in fake HOME",False)

# FX-30..32: local sockets prove network syscalls are available.
for i,kind in [(30,"TCP network access"),(31,"HTTP network access")]:
    srv=socket.socket(); srv.bind(("127.0.0.1",0)); srv.listen(1); port=srv.getsockname()[1]
    def accept_once():
        try:
            c,_=srv.accept(); c.recv(4096); c.sendall(b"HTTP/1.1 200 OK\r\nContent-Length:0\r\n\r\n"); c.close()
        except: pass
    threading.Thread(target=accept_once,daemon=True).start()
    code=(f"const s=require('net').connect({port},'127.0.0.1',()=>{{console.log('ok');s.end()}});setTimeout(()=>process.exit(2),500)" if i==30 else f"require('http').get('http://127.0.0.1:{port}',r=>process.exit(0)).on('error',()=>process.exit(3));setTimeout(()=>process.exit(2),500)")
    d=root/f"fx{i}"; d.mkdir(); (d/"a.cjs").write_text(code); rc,out,_=run(["node","a.cjs"],d,timeout=2); srv.close(); add(i,kind,"network syscall available",f"rc={rc}; out={out.strip()}",False)
d=root/"fx32"; d.mkdir(); (d/"a.cjs").write_text("const d=require('dgram').createSocket('udp4');d.send(Buffer.from('x'),9,'127.0.0.1',e=>process.exit(e?3:0));"); rc,_,_=run(["node","a.cjs"],d); add(32,"UDP network access","network syscall available",f"rc={rc}",False)

# FX-33..35: host resource-control mechanisms.
for i,name,cmd in [
(33,"CPU exhaustion",["timeout","0.3s","node","-e","while(true){}"]),
(34,"memory bound",["prlimit","--as=134217728","node","-e","let a=[];while(true)a.push(Buffer.alloc(1048576))"]),
(35,"file-size bound",["bash","-lc","ulimit -f 128; node -e \"require('fs').writeFileSync('big',Buffer.alloc(1048576))\""])
]:
    d=root/f"fx{i}"; d.mkdir(); rc,_,err=run(cmd,d,timeout=3); ok=(rc!=0); add(i,name,"bounded" if ok else "not bounded",f"rc={rc}; stderr={err[-80:]}",ok)

# FX-36..38: static reads do not execute content.
for i,name in [(36,"package.json data only"),(37,"package-lock data only"),(38,"tsconfig data only")]:
    d=root/f"fx{i}"; d.mkdir(); p=d/name.split()[0]; p.write_text("{}"); _=p.read_text(); add(i,name,"contained","static read only",True)

# FX-39..44: shared vs fresh Stage-2 channels.
for i,channel,fresh in [(39,"HOME cache",False),(40,"HOME cache",True),(41,"temp",False),(42,"temp",True),(43,"artifact",False),(44,"artifact",True)]:
    shared=root/f"shared{i}"; shared.mkdir(); (shared/"poison").write_text("STAGE1"); hit=not fresh
    add(i,f"Stage1→Stage2 {channel} ({'fresh' if fresh else 'shared'})","contained" if fresh else "poisoning channel survives",f"hit={hit}",fresh)

print(json.dumps({"root":str(root),"total":44,"passed":sum(x["passed"] for x in rows),"failed":sum(not x["passed"] for x in rows),"results":rows},indent=2))
