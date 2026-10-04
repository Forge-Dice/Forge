#!/usr/bin/env python3
"""Forge ruleset drill. No dependencies beyond Python 3.11 and git for push probes.

Local prepare is offline. Live reads require bind. Mutations require --execute.
The canonical repository is denied by name AND immutable repository ID.
No cleanup, reset, force-rollback, or STOP clearing command is provided.
"""
from __future__ import annotations
import argparse, base64, datetime as dt, hashlib, json, os, re, subprocess
import sys, tempfile, urllib.error, urllib.parse, urllib.request
from pathlib import Path

API_VERSION = "2026-03-10"
CANONICAL_ID = 1401864629
OWNER = ("Wuerfelduell", 315180734)
CODEX = ("forge-codex", 337272506)
NAMES = ["forge-refs-immutable", "forge-main-quality", "forge-main-owner-merge",
         "forge-codex-writer", "forge-owner-contract-writer",
         "forge-deny-other-branches", "forge-no-tags"]
POLICY_NAME = "forge-trusted-pr-target-only"
SCENARIOS = ["bind", "green-codex-owner", "green-codex-codex", "green-codex-actions", "green-owner-owner",
             "green-owner-codex", "missing-gate", "missing-verify", "fail-gate",
             "fail-verify", "wrong-source", "stale", "outdated", "outdated-advance", "swapped-owner",
             "swapped-codex", "actions-policy", "actions-probe", "actions-pr"]

def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"),
                                     ensure_ascii=False).encode()).hexdigest()

def dump(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")

def load(path):
    return json.loads(Path(path).read_text())

def validate_repo(repo):
    if repo.lower() == "forge-dice/forge":
        raise ValueError("CANONICAL_REPOSITORY_FORBIDDEN")
    if not re.fullmatch(r"Forge-Dice/forge-ruleset-drill-[a-z0-9-]{4,80}", repo):
        raise ValueError("Use a fresh Forge-Dice/forge-ruleset-drill-... repository")

def validate_run(run):
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{5,47}", run):
        raise ValueError("run-id must be 6..48 lower-case letters/digits/hyphens")

def spec(main_refs, app_id=None):
    def rule(name, target, include, exclude, rules, bypass=()):
        return {"name":name, "target":target, "enforcement":"active",
                "bypass_actors":list(bypass),
                "conditions":{"ref_name":{"include":include, "exclude":exclude}},
                "rules":rules}
    c = {"type":"creation"}
    u = {"type":"update", "parameters":{"update_allows_fetch_and_merge":False}}
    codex = "refs/heads/forge/run/codex/**/*"
    owned = ["refs/heads/forge/owner/**/*", "refs/heads/forge/contract/**/*"]
    owner_pr = [{"actor_type":"User", "actor_id":OWNER[1], "bypass_mode":"pull_request"}]
    owner_all = [{"actor_type":"User", "actor_id":OWNER[1], "bypass_mode":"always"}]
    codex_all = [{"actor_type":"User", "actor_id":CODEX[1], "bypass_mode":"always"}]
    pin = app_id if isinstance(app_id, int) and app_id > 0 else "__BIND_CHECK_APP_ID__"
    return [
      rule(NAMES[0], "branch", ["~ALL"], [], [{"type":"deletion"},{"type":"non_fast_forward"}]),
      rule(NAMES[1], "branch", main_refs, [], [
        {"type":"pull_request", "parameters":{
          "allowed_merge_methods":["merge","squash","rebase"],
          "dismiss_stale_reviews_on_push":False,"require_code_owner_review":False,
          "require_last_push_approval":False,"required_approving_review_count":0,
          "required_review_thread_resolution":False}},
        {"type":"required_status_checks", "parameters":{
          "do_not_enforce_on_create":False,
          "required_status_checks":[{"context":n,"integration_id":pin}
                                    for n in ["forge-gate","forge-verify"]],
          "strict_required_status_checks_policy":True}}]),
      rule(NAMES[2], "branch", main_refs, [], [c,u], owner_pr),
      rule(NAMES[3], "branch", [codex], [], [c,u], codex_all),
      rule(NAMES[4], "branch", owned, [], [c,u], owner_all),
      rule(NAMES[5], "branch", ["~ALL"], main_refs + [codex] + owned, [c,u]),
      rule(NAMES[6], "tag", ["~ALL"], [], [c,u,{"type":"deletion"}])]

def policy():
    return {"name":POLICY_NAME,"enforcement":"active",
      "conditions":{"workflow_path":{"include":["~ALL"],"exclude":[]}},
      "rules":[
        {"type":"restrict_actions_actors","parameters":{"allowed_actors":[
          {"id":OWNER[1],"type":"User"},{"id":CODEX[1],"type":"User"}]}},
        {"type":"restrict_action_events","parameters":{"allowed_events":["pull_request_target"]}}]}

def make_manifest(repo, run):
    validate_repo(repo); validate_run(run)
    b = lambda s: "refs/heads/" + s
    o = f"forge/owner/{run}"
    c = f"forge/run/codex/{run}"
    k = f"forge/contract/{run}"
    s = f"forge/stray/{run}"
    bases = {n:b(f"forge/drill-base/{run}/{n}") for n in SCENARIOS}
    # main guard tests use disposable aliases. Missing aliases are NOT seeded.
    aliases = {n:b(f"forge/drill-main/{run}/{n}") for n in
               ["ff-owner","ff-codex","nff-owner","nff-codex","delete-owner","delete-codex",
                "create-owner","create-codex"]}
    main_targets = ["refs/heads/main"] + list(bases.values()) + list(aliases.values())
    cases=[]; seed=set(bases.values())
    def add(cid, actor, op, ref, expected, rules, phase="FINAL", seed_ref=False,
            note="", transport="rest"):
        cases.append({"id":cid,"actor":actor,"operation":op,"ref":ref,
                      "expected":expected,"rules":rules,"phase":phase,
                      "transport":transport,"note":note})
        if seed_ref: seed.add(ref)
    for actor,prefix,rule in [("owner",o,"R5"),("codex",c,"R4")]:
        for depth in ["one","a/b/c"]:
            add(f"{rule}-CREATE-{actor}-{depth.replace('/','-')}",actor,"create",b(prefix+"/create/"+depth),"ALLOW",[rule])
        add(f"R1-FF-{actor}",actor,"ff",b(prefix+"/ff"),"ALLOW",["R1",rule],seed_ref=True)
        add(f"R1-NFF-{actor}",actor,"nff",b(prefix+"/nff"),"DENY",["R1"],seed_ref=True)
        add(f"R1-DELETE-{actor}",actor,"delete",b(prefix+"/delete"),"DENY",["R1"],seed_ref=True)
    add("R5-CONTRACT-CREATE","owner","create",b(k+"/v2"),"ALLOW",["R5"])
    add("R5-CONTRACT-FF","owner","ff",b(k+"/ff"),"ALLOW",["R1","R5"],seed_ref=True)
    add("R1-CONTRACT-NFF","owner","nff",b(k+"/nff"),"DENY",["R1"],seed_ref=True)
    add("R1-CONTRACT-DELETE","owner","delete",b(k+"/delete"),"DENY",["R1"],seed_ref=True)
    for actor,target,rule in [("owner",c,"R4"),("codex",o,"R5"),("codex",k,"R5")]:
        namespace="contract" if target==k else "owner" if target==o else "codex"
        add(f"CROSS-{actor}-{namespace}-{rule}-CREATE",actor,"create",b(target+f"/cross-create-{actor}"),"DENY",[rule])
        add(f"CROSS-{actor}-{namespace}-{rule}-FF",actor,"ff",b(target+f"/cross-update-{actor}"),"DENY",[rule],seed_ref=True)
    for actor in ["owner","codex"]:
        for name in [f"forge/run/claude/{run}",s,f"forge/run/codexevil/{run}",
                     f"Forge/run/codex/{run}",f"forge/ownerevil/{run}",
                     f"forge/contractevil/{run}"]:
            ident=re.sub(r"[^a-zA-Z0-9]","-",name)
            add(f"R6-CREATE-{actor}-{ident}",actor,"create",b(name),"DENY",["R6"])
        add(f"R6-FF-{actor}",actor,"ff",b(s+"/seeded-legacy-"+actor),"DENY",["R6"],seed_ref=True)
        add(f"R1-STRAY-DELETE-{actor}",actor,"delete",b(s+"/delete-"+actor),"DENY",["R1"],seed_ref=True)
        for op in ["create","ff","nff","delete"]:
            add(f"R3-MAIN-{op.upper()}-{actor}",actor,op,aliases[f"{op}-{actor}"],"DENY",
                ["R3"] if op in ["create","ff"] else ["R1","R3"],
                seed_ref=op!="create",note="main alias only; main is never a mutation target")
        for op in ["create","ff","nff","delete"]:
            add(f"R7-TAG-{op.upper()}-{actor}",actor,op,f"refs/tags/forge-drill/{run}/{op}-{actor}",
                "DENY",["R7"],seed_ref=op!="create")
    # Prefix roots cannot contain run-id. They are reserved for this fresh repo.
    for n in ["forge/run/codex","forge/owner","forge/contract"]:
        for actor in ["owner","codex"]:
            add("R6-ROOT-"+actor+"-"+n.replace("/","-"),actor,"create",b(n),"DENY",["R6"],
                phase="ROOT_FIRST",note="Run before descendant refs are seeded. Otherwise git D/F conflict is inconclusive.")
    scenarios={}
    for name in SCENARIOS:
        ns=o if name in ["green-owner-owner","green-owner-codex","swapped-codex","actions-policy","actions-probe","outdated-advance"] else c
        author="owner" if ns==o else "codex"
        if name=="swapped-owner": author="owner"
        if name=="swapped-codex": author="codex"
        scenarios[name]={"base":bases[name],"head":b(ns+"/pr/"+name),"author":author}
        if name=="outdated-advance":scenarios[name]["base"]=bases["outdated"]
        seed.add(scenarios[name]["head"])
    workflow_ref=b(c+"/workflow-injection")
    seed.add(workflow_ref)
    for n,actor,expect in [("green-codex-owner","owner","ALLOW"),("green-codex-codex","codex","DENY"),
                           ("green-owner-owner","owner","ALLOW"),("green-owner-codex","codex","DENY"),
                           ("missing-gate","owner","DENY"),("missing-verify","owner","DENY"),
                           ("fail-gate","owner","DENY"),("fail-verify","owner","DENY"),
                           ("wrong-source","owner","DENY"),("stale","owner","DENY"),
                           ("outdated","owner","DENY"),("outdated-advance","owner","ALLOW"),("swapped-owner","owner","DENY"),
                           ("swapped-codex","owner","DENY")]:
        add("MERGE-"+n,actor,"merge",bases[n],expect,["R2","R3"],note="Requires the scenario PR and evidence of its expected check state.")
        cases[-1]["scenario"]=n
    for label,op,ref in [("CODEX-CREATE","create",b(c+"/actions/create")),
                         ("OWNER-CREATE","create",b(o+"/actions/create")),
                         ("CONTRACT-CREATE","create",b(k+"/actions/create")),
                         ("STRAY-CREATE","create",b(s+"/actions/create")),
                         ("CODEX-FF","ff",b(c+"/actions/ff")),
                         ("OWNER-FF","ff",b(o+"/actions/ff")),
                         ("CONTRACT-FF","ff",b(k+"/actions/ff")),
                         ("CODEX-NFF","nff",b(c+"/actions/nff")),
                         ("OWNER-DELETE","delete",b(o+"/actions/delete")),
                         ("MAIN-CREATE","create",b(f"forge/drill-main/{run}/actions-create")),
                         ("MAIN-FF","ff",b(f"forge/drill-main/{run}/actions-ff")),
                         ("MAIN-NFF","nff",b(f"forge/drill-main/{run}/actions-nff")),
                         ("MAIN-DELETE","delete",b(f"forge/drill-main/{run}/actions-delete")),
                         ("TAG-CREATE","create",f"refs/tags/forge-drill/{run}/actions-create"),
                         ("TAG-FF","ff",f"refs/tags/forge-drill/{run}/actions-ff"),
                         ("TAG-NFF","nff",f"refs/tags/forge-drill/{run}/actions-nff"),
                         ("TAG-DELETE","delete",f"refs/tags/forge-drill/{run}/actions-delete")]:
        if ref.startswith("refs/tags/"):protectors=["R7"]
        else:
            writer="R4" if ref.startswith(b(c)+"/") else "R5" if ref.startswith((b(o)+"/",b(k)+"/")) else "R3" if "/forge/drill-main/" in ref else "R6"
            protectors=(["R1"] if op in ["delete","nff"] else [])+([writer] if op!="delete" else [])
        add("ACTIONS-"+label,"actions",op,ref,"DENY",protectors,
            seed_ref=op!="create",note="M1 trusted write-token probe, then M0 permission probe.")
        if "/forge/drill-main/" in ref: main_targets.append(ref)
    add("ACTIONS-MERGE","actions","merge",bases["green-codex-actions"],"DENY",["R3"],note="M1 only, owner-rerun checks must be green.")
    cases[-1]["scenario"]="green-codex-actions"
    add("ACTIONS-PR","actions","pr_create",bases["actions-pr"],"DENY",[],note="M0 only; permission denial, not a ref-ruleset ACL.")
    cases[-1]["scenario"]="actions-pr"
    m0_candidates={case["id"]:b(o+"/m0-candidates/"+case["id"]) for case in cases
                   if case["actor"]=="actions" and case["operation"] in ["ff","nff"]}
    seed.update(m0_candidates.values())
    canary=b(o+"/canary-control");seed.add(canary)
    # Genuine Actions-token capabilities are established before ref restrictions.
    control=b(f"forge/actions-control/{run}/token-write")
    for mode in ["M0","M1"]:
        # A separate trusted trigger PR per case is queued by the owner, serially.
        for case in [x for x in cases if x["actor"]=="actions"]:
            trigger=b(o+"/actions-trigger/"+mode+"/"+case["id"])
            seed.add(trigger)
    seed.add(b(o+"/actions-trigger/CONTROL"))
    return {"format":"forge-live-drill/v1","repo":repo,"repo_id":None,"run_id":run,
            "created":now(),"main_sha":None,"main_targets":list(dict.fromkeys(main_targets)),
            "seed_refs":sorted(seed),"cases":cases,"scenarios":scenarios,
            "workflow_injection_ref":workflow_ref,"actions_control_ref":control,
            "canary_control_ref":canary,"m0_candidates":m0_candidates,
            "pr_numbers":{},"ruleset_ids":{},"policy_id":None,"check_app_id":None,
            "results":{},"pending_merges":{},"sealed":False}

class Evidence:
    def __init__(self, root):
        self.root=Path(root); self.root.mkdir(parents=True, exist_ok=True)
        self.log=self.root/"events.jsonl"
        self.last="0"*64
        if self.log.exists():
            for line in self.log.read_text().splitlines():
                e=json.loads(line)
                if e["previous_sha256"]!=self.last or digest({k:v for k,v in e.items() if k!="sha256"})!=e["sha256"]:
                    raise ValueError("EVIDENCE_CHAIN_INVALID")
                self.last=e["sha256"]
    def add(self, kind, data):
        e={"at":now(),"kind":kind,"data":data,"previous_sha256":self.last}
        e["sha256"]=digest(e)
        with self.log.open("a") as f: f.write(json.dumps(e,ensure_ascii=False)+"\n")
        self.last=e["sha256"]; return e
    def stop(self, reason, data):
        e=self.add("STOP",{"reason":reason,"detail":data})
        if not (self.root/"STOP.json").exists(): dump(self.root/"STOP.json",e)
        raise RuntimeError(reason+"; STOP latched. Only read-only evidence and explicit owner freeze remain.")

class API:
    def __init__(self, cfg, actor, ev, execute=False):
        validate_repo(cfg["repo"])
        if cfg.get("repo_id")==CANONICAL_ID: raise ValueError("CANONICAL_ID_FORBIDDEN")
        self.cfg=cfg; self.ev=ev; self.actor=actor; self.execute=execute
        key={"owner":"FORGE_OWNER_TOKEN","codex":"FORGE_CODEX_TOKEN","actions":"GITHUB_TOKEN"}[actor]
        self.token=os.environ.get(key,"")
        if not self.token: raise ValueError(f"Missing {key}; never put tokens into CLI arguments")
        self.prefix="/repos/"+cfg["repo"]
    def call(self, method, path, data=None, allow_status=(), raw=False):
        if method!="GET":
            if not self.execute: raise ValueError("MUTATION_REQUIRES_EXECUTE")
            if not path.startswith(self.prefix+"/"): raise ValueError("WRITE_ENDPOINT_OUTSIDE_BOUND_REPO")
            if self.cfg.get("repo_id") in [None,CANONICAL_ID]: raise ValueError("REPOSITORY_NOT_BOUND")
        if not path.startswith("/") or ":" in path: raise ValueError("INVALID_API_PATH")
        req=urllib.request.Request("https://api.github.com"+path,method=method,
            data=json.dumps(data).encode() if data is not None else None,
            headers={"Authorization":"Bearer "+self.token,"Accept":"application/vnd.github+json",
                     "X-GitHub-Api-Version":API_VERSION,"User-Agent":"forge-ruleset-drill/1"})
        try:
            with urllib.request.urlopen(req,timeout=25) as response:
                status=response.status; payload=response.read(); headers=dict(response.headers)
        except urllib.error.HTTPError as error:
            status=error.code; payload=error.read(); headers=dict(error.headers)
        text=payload.decode("utf-8",errors="replace").replace(self.token,"[REDACTED]")
        try: body=json.loads(text) if text else None
        except json.JSONDecodeError: body={"text":text}
        self.last_headers=headers
        rec={"actor":self.actor,"method":method,"path":path,"request":data,
             "status":status,"response":body,"request_id":headers.get("X-GitHub-Request-Id"),
             "date":headers.get("Date"),"rate_remaining":headers.get("X-RateLimit-Remaining")}
        self.ev.add("HTTP",rec)
        if status not in range(200,300) and status not in allow_status:
            self.ev.stop("HTTP_INCONCLUSIVE",rec)
        return status,body
    def get(self,path): return self.call("GET",path)[1]
    def list(self,path,key=None):
        out=[]; page=1
        while True:
            sep="&" if "?" in path else "?"
            body=self.get(path+sep+f"per_page=100&page={page}")
            items=body[key] if key else body
            if not isinstance(items,list): self.ev.stop("INVALID_LIST_SCHEMA",body)
            out.extend(items)
            # Matching-refs is not necessarily paginated. Honor server Link,
            # never infer another page merely from the number of objects.
            if not re.search(r'rel="next"',self.last_headers.get("Link","")):return out
            page+=1

def authenticate(api):
    if api.actor=="actions":
        if os.environ.get("GITHUB_ACTIONS")!="true" or os.environ.get("GITHUB_REPOSITORY")!=api.cfg["repo"]:
            raise ValueError("GITHUB_TOKEN_ONLY_INSIDE_BOUND_TRUSTED_ACTIONS_JOB")
        return
    user=api.get("/user"); expected=OWNER if api.actor=="owner" else CODEX
    if (user.get("login"),user.get("id"))!=expected:
        api.ev.stop("WRONG_AUTHENTICATED_ACTOR",{"expected":expected,"observed":user.get("login"),"id":user.get("id")})

def ref_state(api, ref):
    if not ref.startswith("refs/"): raise ValueError("FULL_REF_REQUIRED")
    status,body=api.call("GET",api.prefix+"/git/ref/"+urllib.parse.quote(ref[5:],safe="/"),allow_status=(404,))
    return None if status==404 else body["object"]["sha"]

def guard(api, check_stop=True, check_main=True):
    if check_stop and (api.ev.root/"STOP.json").exists(): raise ValueError("STOP_LATCHED")
    authenticate(api)
    repo=api.get(api.prefix)
    if repo["id"]==CANONICAL_ID or repo["id"]!=api.cfg["repo_id"] or repo["full_name"]!=api.cfg["repo"]:
        api.ev.stop("REPOSITORY_IDENTITY_CHANGED",repo)
    if repo.get("default_branch")!="main" or repo.get("fork") or repo.get("visibility")!="public" or repo.get("delete_branch_on_merge"):
        api.ev.stop("UNEXPECTED_REPOSITORY_CONFIGURATION",repo)
    current=ref_state(api,"refs/heads/main")
    if current!=api.cfg["main_sha"] and check_main:
        api.ev.stop("MAIN_CHANGED",{"expected":api.cfg["main_sha"],"actual":current})
    if current!=api.cfg["main_sha"]:
        api.ev.add("MAIN_CHANGED_DURING_CONTAINMENT_OR_EVIDENCE",{"expected":api.cfg["main_sha"],"actual":current})

def validate_target(cfg, ref):
    allowed=set(cfg["seed_refs"]+[c["ref"] for c in cfg["cases"]]+[cfg["actions_control_ref"]])
    allowed.update(v["head"] for v in cfg["scenarios"].values())
    if ref=="refs/heads/main" or ref not in allowed: raise ValueError("NON_TEST_REF_FORBIDDEN")

def commit(api, parent, label, sibling=False, files=None):
    obj=api.get(api.prefix+"/git/commits/"+parent)
    parents=[p["sha"] for p in obj["parents"]] if sibling else [parent]
    # A different message and tree make a real non-fast-forward candidate.
    entries=[{"path":".drill/"+label+".txt","mode":"100644","type":"blob","content":label+"\n"}]
    for path,text in (files or {}).items(): entries.append({"path":path,"mode":"100644","type":"blob","content":text})
    tree=api.call("POST",api.prefix+"/git/trees",{"base_tree":obj["tree"]["sha"],"tree":entries})[1]["sha"]
    return api.call("POST",api.prefix+"/git/commits",{"message":"FORGE DRILL "+label,
                    "tree":tree,"parents":parents})[1]["sha"]

def protected_denial(status, body):
    msg=json.dumps(body).lower()
    # A generic 403/422, lack of token scope, invalid ref, and no-op are NOT PASS.
    return status in [403,409,422] and any(s in msg for s in
        ["gh013","repository rule","ruleset","rule violations","protected branch","branch protection"])

def do_ref(api, cfg, case, persist=True):
    ref=case["ref"]; validate_target(cfg,ref)
    before=ref_state(api,ref); op=case["operation"]
    if op=="create" and before is not None: api.ev.stop("TEST_REF_ALREADY_EXISTS",case)
    if op!="create" and before is None: api.ev.stop("TEST_REF_MISSING",case)
    candidate=cfg["main_sha"] if op=="create" else None
    if op in ["ff","nff"]:
        candidate=commit(api,before,case["id"].lower(),sibling=op=="nff")
        if candidate==before: api.ev.stop("NOOP_NOT_A_TEST",case)
        comp=api.get(api.prefix+"/compare/"+before+"..."+candidate)
        if (op=="ff" and comp["status"]!="ahead") or (op=="nff" and comp["status"] not in ["diverged","behind"]):
            api.ev.stop("INVALID_ANCESTRY_FIXTURE",comp)
    path=api.prefix+"/git/refs/"+urllib.parse.quote(ref[5:],safe="/")
    if op=="create": status,body=api.call("POST",api.prefix+"/git/refs",{"ref":ref,"sha":candidate},allow_status=(403,409,422))
    elif op=="delete": status,body=api.call("DELETE",path,allow_status=(403,409,422))
    else: status,body=api.call("PATCH",path,{"sha":candidate,"force":op=="nff"},allow_status=(403,409,422))
    after=ref_state(api,ref)
    allowed=status in range(200,300)
    detail={"case":case,"before":before,"candidate":candidate,"after":after,"status":status,"response":body}
    if case["expected"]=="DENY":
        if allowed or after!=before: api.ev.stop("UNEXPECTED_ALLOW",detail)
        if not protected_denial(status,body): api.ev.stop("DENIAL_NOT_PROVEN_RULE_ENFORCEMENT",detail)
    elif not allowed or after!=candidate:
        api.ev.stop("UNEXPECTED_DENY_OR_WRONG_REF_RESULT",detail)
    api.ev.add("CASE_PASS",detail)
    if persist: cfg["results"][case["id"]]={"status":"PASS","at":now(),"evidence_sha256":api.ev.last}

def semantic_equal(a,b):
    keys=["name","target","enforcement","bypass_actors","conditions","rules"]
    return all(a.get(k)==b.get(k) for k in keys if k in b)

def prepare(args):
    root=Path(args.out).resolve()
    if root.exists() and any(root.iterdir()): raise ValueError("OUTPUT_DIRECTORY_MUST_BE_EMPTY")
    root.mkdir(parents=True,exist_ok=True)
    cfg=make_manifest(args.repo,args.run_id); dump(root/"manifest.json",cfg)
    for i,x in enumerate(spec(["refs/heads/main"]),1): dump(root/"candidate-rulesets"/f"R{i}.json",x)
    for i,x in enumerate(spec(cfg["main_targets"]),1): dump(root/"drill-rulesets"/f"R{i}.json",x)
    dump(root/"actions-policy.json",policy())
    source=Path(__file__).resolve().parent/"fixtures"
    for p in source.rglob("*"):
        if p.is_file():
            dst=root/"seed"/p.relative_to(source); dst.parent.mkdir(parents=True,exist_ok=True)
            text=p.read_text().replace("__REPO__",args.repo).replace("__RUN__",args.run_id)
            dst.write_text(text)
    dump(root/"seed"/".forge-drill.json",{"kind":"forge-live-drill/v1","run_id":args.run_id,"repository":args.repo})
    # The Actions probe is copied as trusted code, never obtained from PR head.
    trigger_map={c["id"]:c for c in cfg["cases"] if c["actor"]=="actions"}
    dump(root/"seed"/".drill"/"actions-cases.json",trigger_map)
    dump(root/"seed"/".drill"/"actions-plan.json",{k:cfg[k] for k in
       ["repo","run_id","main_targets","seed_refs","actions_control_ref","scenarios","m0_candidates"]})
    runtime=(source/".drill"/"probe_runtime.py").read_text()
    plan={k:cfg[k] for k in ["repo","run_id","main_targets","seed_refs","actions_control_ref","scenarios","m0_candidates"]}
    plan["cases"]=trigger_map
    runtime=runtime.replace("__ACTION_PLAN_LITERAL__",repr(json.dumps(plan)))
    workflow=(source/".github"/"workflows"/"actions-probe.template.txt").read_text()
    workflow=workflow.replace("__INLINE_PROBE__","\n".join("          "+line for line in runtime.splitlines()))
    workflow=workflow.replace("__RUN__",args.run_id).replace("__REPO__",args.repo)
    (root/"seed"/".github"/"workflows"/"actions-probe.yml").write_text(workflow)
    (root/"seed"/".drill"/"probe_runtime.py").write_text(runtime)
    (root/"seed"/".github"/"workflows"/"actions-probe.template.txt").unlink()
    print(json.dumps({"prepared":str(root),"cases":len(cfg["cases"]),"live_operations":0}))

def bind(api,cfg):
    if cfg.get("repo_id") is not None:raise ValueError("ALREADY_BOUND_NO_REBIND")
    authenticate(api); repo=api.get(api.prefix)
    if repo["id"]==CANONICAL_ID or not repo.get("permissions",{}).get("admin"):
        api.ev.stop("BIND_REQUIRES_NON_CANONICAL_ADMIN_REPO",repo)
    if repo.get("fork") or repo.get("default_branch")!="main" or repo.get("visibility")!="public" or repo.get("delete_branch_on_merge"):
        api.ev.stop("BIND_WRONG_REPO_TYPE",repo)
    marker=api.get(api.prefix+"/contents/.forge-drill.json?ref=main")
    value=json.loads(base64.b64decode(marker["content"]))
    if value!={"kind":"forge-live-drill/v1","run_id":cfg["run_id"],"repository":cfg["repo"]}:
        api.ev.stop("WRONG_DRILL_MARKER",value)
    refs=api.list(api.prefix+"/git/matching-refs/")
    if {r["ref"] for r in refs}!={"refs/heads/main"}:api.ev.stop("BIND_REQUIRES_FRESH_MAIN_ONLY_REPO",refs)
    cfg["repo_id"]=repo["id"]; cfg["main_sha"]=ref_state(api,"refs/heads/main")
    initial=api.get(api.prefix+"/git/commits/"+cfg["main_sha"])
    if initial["parents"]:api.ev.stop("BIND_REQUIRES_SINGLE_SETUP_ROOT_COMMIT",initial)
    api.ev.add("BOUND",{"repo":cfg["repo"],"repo_id":cfg["repo_id"],"main_sha":cfg["main_sha"]})

def snapshot(api,cfg):
    guard(api,check_stop=False,check_main=False)
    result={"at":now(),"repo":api.get(api.prefix),
      "refs":api.list(api.prefix+"/git/matching-refs/"),
      "rulesets":api.list(api.prefix+"/rulesets?includes_parents=true"),
      "actions_policies":api.list(api.prefix+"/actions/policies?has_parents=true","policies"),
      "actions_permissions":api.get(api.prefix+"/actions/permissions"),
      "workflow_permissions":api.get(api.prefix+"/actions/permissions/workflow"),
      "workflows":api.list(api.prefix+"/actions/workflows","workflows")}
    details=[]
    for rs in result["rulesets"]:
        details.append(api.get(api.prefix+"/rulesets/"+str(rs["id"])+"?includes_parents=true"))
    result["ruleset_details"]=details
    result["classic_main_protection"]=api.call("GET",api.prefix+"/branches/main/protection",allow_status=(404,403))[1]
    for who in [OWNER[0],CODEX[0]]:
        result["permission_"+who]=api.call("GET",api.prefix+"/collaborators/"+who+"/permission",allow_status=(404,))[1]
    fname=api.ev.root/("snapshot-"+dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")+".json")
    dump(fname,result); print(str(fname))

def seed(api,cfg):
    if cfg.get("sealed"): raise ValueError("SEED_ALREADY_SEALED")
    if api.get(api.prefix+"/actions/permissions")["enabled"]: raise ValueError("SEED_REQUIRES_ACTIONS_DISABLED")
    active=api.list(api.prefix+"/rulesets?includes_parents=true")
    if any(x.get("enforcement")=="active" for x in active): raise ValueError("SEED_REQUIRES_NO_ACTIVE_REF_RULES")
    # Collision check on ALL refs precedes the first write.
    for ref in cfg["seed_refs"]:
        validate_target(cfg,ref)
        if ref_state(api,ref) is not None: api.ev.stop("SEED_COLLISION",ref)
    special={v["head"]:k for k,v in cfg["scenarios"].items()}
    nff_refs={c["ref"] for c in cfg["cases"] if c["operation"]=="nff"}
    candidate_refs=set(cfg["m0_candidates"].values())
    for ref in cfg["seed_refs"]:
        if ref in candidate_refs:continue
        if ref in special:sha=commit(api,cfg["main_sha"],"seed-"+special[ref])
        elif ref in nff_refs:sha=commit(api,cfg["main_sha"],"seed-nff-"+digest(ref)[:12])
        else:sha=cfg["main_sha"]
        api.call("POST",api.prefix+"/git/refs",{"ref":ref,"sha":sha})
    for cid,ref in cfg["m0_candidates"].items():
        case=next(c for c in cfg["cases"] if c["id"]==cid)
        parent=ref_state(api,case["ref"])
        sha=commit(api,parent,"m0-"+cid.lower(),sibling=case["operation"]=="nff")
        api.call("POST",api.prefix+"/git/refs",{"ref":ref,"sha":sha})
    cfg["sealed"]=True; api.ev.add("SEED_SEALED",{"count":len(cfg["seed_refs"])})

def install(api,cfg,which):
    if which=="POLICY":
        wanted=policy(); path=api.prefix+"/actions/policies"; field="policy_id"
    else:
        n=int(which[1:]); wanted=spec(cfg["main_targets"],cfg.get("check_app_id"))[n-1]
        if n==2 and not isinstance(cfg.get("check_app_id"),int): raise ValueError("BIND_CHECKS_BEFORE_R2")
        path=api.prefix+"/rulesets"; field=None
    if which=="POLICY" and api.get(api.prefix+"/actions/permissions")["enabled"]:
        raise ValueError("INSTALL_POLICY_WHILE_ACTIONS_DISABLED")
    previous=cfg.get(field) if field else cfg["ruleset_ids"].get(which)
    if previous: raise ValueError("ALREADY_INSTALLED_NO_AUTOMATIC_REPLACEMENT")
    created=api.call("POST",path,wanted)[1]; rid=created["id"]
    # Persist the ID immediately: readback failure must not hide a created rule.
    if field: cfg[field]=rid
    else: cfg["ruleset_ids"][which]=rid
    dump(api.ev.root.parent/"manifest.json",cfg)
    got=api.get(path+"/"+str(rid))
    if not semantic_equal(got,wanted): api.ev.stop("RULE_OR_POLICY_READBACK_MISMATCH",{"expected":wanted,"actual":got})
    api.ev.add("INSTALLED_READBACK",{"which":which,"id":rid,"spec_sha256":digest(wanted)})

def coverage(api,cfg):
    ids={v:k for k,v in cfg["ruleset_ids"].items()}
    refs=sorted(set(x["ref"] for x in cfg["cases"] if x["ref"].startswith("refs/heads/")))
    refs+=["refs/heads/main"]+list(v["base"] for v in cfg["scenarios"].values())
    report=[]
    for ref in refs:
        rows=api.list(api.prefix+"/rules/branches/"+urllib.parse.quote(ref[11:],safe=""))
        found=sorted(set(ids.get(r.get("ruleset_id"),"PARENT:"+str(r.get("ruleset_id"))) for r in rows))
        report.append({"ref":ref,"active_rulesets":found,"rules":rows})
    dump(api.ev.root/"coverage.json",report)
    print("Coverage captured. Compare each entry with the rule map in the report; no local fnmatch substitutes for GitHub.")

def open_pr(api,cfg,name):
    scenario=cfg["scenarios"][name]
    if api.actor!=scenario["author"]: raise ValueError("SCENARIO_AUTHOR_MISMATCH")
    if name in cfg["pr_numbers"]: raise ValueError("PR_ALREADY_CREATED")
    for ref in [scenario["base"],scenario["head"]]: validate_target(cfg,ref)
    body=api.call("POST",api.prefix+"/pulls",{"title":"FORGE DRILL "+name,
       "head":scenario["head"][11:],"base":scenario["base"][11:],
       "body":"Isolated ruleset drill. Never retarget to main. Keep branch refs.","draft":False})[1]
    expected=OWNER if api.actor=="owner" else CODEX
    if body["user"]["id"]!=expected[1] or body["base"]["ref"]!=scenario["base"][11:]: api.ev.stop("PR_IDENTITY_MISMATCH",body)
    cfg["pr_numbers"][name]=body["number"]; print(json.dumps({"scenario":name,"pr":body["number"],"url":body["html_url"]}))

def collect(api,cfg,run_id):
    run=api.get(api.prefix+"/actions/runs/"+str(run_id))
    if run.get("repository",{}).get("id")!=cfg["repo_id"]: api.ev.stop("RUN_REPOSITORY_MISMATCH",run)
    attempts=[]
    for n in range(1,run["run_attempt"]+1):
        attempts.append({"run":api.get(api.prefix+f"/actions/runs/{run_id}/attempts/{n}"),
          "jobs":api.list(api.prefix+f"/actions/runs/{run_id}/attempts/{n}/jobs","jobs")})
    suite=api.get(api.prefix+"/check-suites/"+str(run["check_suite_id"]))
    checks=api.list(api.prefix+"/check-suites/"+str(run["check_suite_id"])+"/check-runs?filter=all","check_runs")
    result={"run":run,"attempts":attempts,"check_suite":suite,"check_runs":checks}
    dump(api.ev.root/f"run-{run_id}.json",result); return result

def bind_checks(api,cfg,run_id):
    obj=collect(api,cfg,run_id); run=obj["run"]
    prn=cfg["pr_numbers"].get("bind")
    if not prn: raise ValueError("OPEN_BIND_PR_FIRST")
    pr=api.get(api.prefix+"/pulls/"+str(prn)); head=pr["head"]["sha"]
    rows=api.list(api.prefix+"/commits/"+head+"/check-runs?filter=latest","check_runs")
    jobs=obj["attempts"][-1]["jobs"]
    if run["event"]!="pull_request_target" or run["path"].split("@")[0]!=".github/workflows/forge-drill.yml":
        api.ev.stop("WRONG_TRUSTED_WORKFLOW",run)
    picked=[r for r in rows if r["name"] in ["forge-gate","forge-verify"]]
    if len(picked)!=2 or {r["name"] for r in picked}!={"forge-gate","forge-verify"}:
        api.ev.stop("NATIVE_HEAD_CHECK_BINDING_NOT_PROVEN",{"head":head,"checks":rows,"base_sha":cfg["main_sha"],"suite":obj["check_suite"]})
    if any(r["head_sha"]!=head or r["conclusion"]!="success" or r["app"]["slug"]!="github-actions"
           or r["check_suite"]["id"]!=run["check_suite_id"] for r in picked):
        api.ev.stop("CHECK_SOURCE_OR_RESULT_MISMATCH",picked)
    if any(not any(j["name"]==r["name"] and j["conclusion"]=="success" and j.get("started_at")
                   and all(s.get("conclusion")!="skipped" for s in j.get("steps",[])) for j in jobs) for r in picked):
        api.ev.stop("CHECK_JOB_DID_NOT_EXECUTE",jobs)
    apps={r["app"]["id"] for r in picked}
    if len(apps)!=1: api.ev.stop("AMBIGUOUS_CHECK_APP",picked)
    cfg["check_app_id"]=apps.pop(); cfg["check_binding_run_id"]=run_id
    dump(api.ev.root.parent/"drill-rulesets"/"R2.json",spec(cfg["main_targets"],cfg["check_app_id"])[1])
    dump(api.ev.root.parent/"candidate-rulesets"/"R2.json",spec(["refs/heads/main"],cfg["check_app_id"])[1])
    api.ev.add("CHECKS_BOUND",{"app_id":cfg["check_app_id"],"head_sha":head,"pr":prn,"run_id":run_id})

def merge(api,cfg,case):
    name=case["scenario"]; prn=cfg["pr_numbers"].get(name)
    if not prn: raise ValueError("OPEN_SCENARIO_PR_FIRST")
    pr=api.get(api.prefix+"/pulls/"+str(prn)); sc=cfg["scenarios"][name]
    if pr["base"]["ref"]!=sc["base"][11:] or pr["head"]["ref"]!=sc["head"][11:] or pr["state"]!="open":
        api.ev.stop("PR_TARGET_OR_STATE_CHANGED",pr)
    before=ref_state(api,sc["base"])
    head=pr["head"]["sha"]
    checks=api.list(api.prefix+"/commits/"+head+"/check-runs?filter=latest","check_runs")
    api.ev.add("MERGE_PREFLIGHT",{"pr":pr,"checks":checks,"case":case})
    pinned={r["name"]:r for r in checks if r["name"] in ["forge-gate","forge-verify"]
            and r.get("app",{}).get("id")==cfg.get("check_app_id") and r["head_sha"]==head}
    green={n for n,r in pinned.items() if r["conclusion"]=="success"}
    if case["expected"]=="ALLOW" or name.startswith("green-"):
        if green!={"forge-gate","forge-verify"}:api.ev.stop("GREEN_CHECK_PRECONDITION_MISSING",{"scenario":name,"checks":checks})
    elif name=="missing-gate":
        if "forge-gate" in pinned or "forge-verify" not in green:api.ev.stop("MISSING_GATE_FIXTURE_NOT_ISOLATED",checks)
    elif name=="missing-verify":
        if "forge-verify" in pinned or "forge-gate" not in green:api.ev.stop("MISSING_VERIFY_FIXTURE_NOT_ISOLATED",checks)
    elif name=="fail-gate":
        if pinned.get("forge-gate",{}).get("conclusion")!="failure":api.ev.stop("FAILED_GATE_FIXTURE_MISSING",checks)
    elif name=="fail-verify":
        if "forge-gate" not in green or pinned.get("forge-verify",{}).get("conclusion")!="failure":api.ev.stop("FAILED_VERIFY_FIXTURE_NOT_ISOLATED",checks)
    elif name=="wrong-source":
        if green:api.ev.stop("WRONG_SOURCE_HAS_TRUSTED_SUCCESS",checks)
        statuses=api.list(api.prefix+"/commits/"+head+"/statuses")
        if {s["context"] for s in statuses if s["state"]=="success"}!={"forge-gate","forge-verify"}:api.ev.stop("WRONG_SOURCE_CONTROL_MISSING",statuses)
    elif name=="stale":
        if "HEAD-FF-stale" not in cfg["results"] or "forge-verify" in green:api.ev.stop("STALE_HEAD_PRECONDITION_MISSING",checks)
    elif name=="outdated":
        if "MERGE-outdated-advance" not in cfg["results"]:api.ev.stop("OUTDATED_BASE_NOT_ADVANCED_BY_PR",case)
        if pr.get("mergeable_state")!="behind":api.ev.stop("OUTDATED_STATE_NOT_CONFIRMED",pr)
    elif name.startswith("swapped-"):
        if pinned.get("forge-gate",{}).get("conclusion")!="failure":api.ev.stop("SWAPPED_AUTHOR_GATE_NOT_FAILED",checks)
    # This explicit bypass request can bypass R3 only for its permitted actor.
    # R2/R1 have no bypass actors and remain mandatory.
    status,body=api.call("PUT",api.prefix+f"/pulls/{prn}/merge-async",{
        "sha":head,"merge_method":"merge","merge_action":"direct_merge","bypass_rules":True},
        allow_status=(400,403,409,422))
    if status in [202,409]:
        uuid=body.get("uuid") or body.get("details",{}).get("uuid")
        if not isinstance(uuid,str) or not re.fullmatch(r"[a-fA-F0-9-]{36}",uuid):
            api.ev.stop("ASYNC_MERGE_UUID_NOT_IDENTIFIED",body)
        cfg["pending_merges"][case["id"]]={"uuid":uuid,"pr":prn,"before":before,"head":head,"case":case}
        dump(api.ev.root.parent/"manifest.json",cfg)
        api.ev.add("ASYNC_MERGE_PENDING",cfg["pending_merges"][case["id"]])
        print("PENDING: resolve with merge-result "+case["id"]+" before any next mutation")
        return
    finish_merge(api,cfg,case,prn,before,head,status,body)

def finish_merge(api,cfg,case,prn,before,head,status,body):
    sc=cfg["scenarios"][case["scenario"]]
    after=ref_state(api,sc["base"]); allowed=status==200 and bool(body and body.get("merged"))
    if body and body.get("status")=="merged":allowed=True
    detail={"case":case,"before":before,"after":after,"head":head,"status":status,"response":body,"pr":prn}
    if case["expected"]=="DENY":
        if allowed or after!=before: api.ev.stop("UNEXPECTED_ALLOW",detail)
        # Merge conflicts/unfinished mergeability are not a ruleset result.
        msg=json.dumps(body).lower()
        semantic_rule_rejection=protected_denial(status,body) or (body and body.get("status")=="failed" and protected_denial(422,body))
        if not semantic_rule_rejection and not any(x in msg for x in ["required status","required check","changes must be made through","not authorized to push to this branch","review is required"]):
            api.ev.stop("MERGE_DENIAL_INCONCLUSIVE",detail)
    elif not allowed or after==before: api.ev.stop("OWNER_MERGE_LOCKOUT",detail)
    api.ev.add("CASE_PASS",detail); cfg["results"][case["id"]]={"status":"PASS","at":now(),"evidence_sha256":api.ev.last}

def merge_result(api,cfg,cid):
    pending=cfg["pending_merges"].get(cid)
    if not pending:raise ValueError("NO_PENDING_MERGE_FOR_CASE")
    body=api.get(api.prefix+f"/pulls/{pending['pr']}/merge-async/{pending['uuid']}")
    state=body.get("status")
    if state=="pending":
        after=ref_state(api,pending["case"]["ref"])
        if pending["case"]["expected"]=="DENY" and after!=pending["before"]:
            api.ev.stop("UNEXPECTED_ALLOW_WHILE_PENDING",{"pending":pending,"after":after,"result":body})
        print("PENDING: no next mutation; collect again");return
    if state not in ["merged","failed"]:api.ev.stop("ASYNC_MERGE_UNEXPECTED_FINAL_STATE",body)
    finish_merge(api,cfg,pending["case"],pending["pr"],pending["before"],pending["head"],200,body)
    del cfg["pending_merges"][cid]

def freeze(api,cfg):
    # Explicit containment, not rollback. No weakening of R1/R2/R7.
    guard(api,check_stop=False,check_main=False)
    api.ev.add("OWNER_FREEZE_REQUESTED",{"repo":cfg["repo"],"reason":"Contain unexpected behavior; preserve refs and evidence"})
    api.call("PUT",api.prefix+"/actions/permissions",{"enabled":False})
    rid=cfg["ruleset_ids"].get("R3")
    wanted=spec(cfg["main_targets"],cfg.get("check_app_id"))[2]; wanted["bypass_actors"]=[]
    if rid: api.call("PUT",api.prefix+"/rulesets/"+str(rid),wanted)
    else:
        new=api.call("POST",api.prefix+"/rulesets",wanted)[1]
        cfg["ruleset_ids"]["R3"]=new["id"]
        rid=new["id"]
    dump(api.ev.root.parent/"manifest.json",cfg)
    actual=api.get(api.prefix+"/rulesets/"+str(rid))
    permissions=api.get(api.prefix+"/actions/permissions")
    if permissions["enabled"] or not semantic_equal(actual,wanted):
        api.ev.stop("FREEZE_READBACK_MISMATCH",{"actions_permissions":permissions,"fence":actual})
    running=[r for r in api.list(api.prefix+"/actions/runs","workflow_runs") if r["status"]!="completed"]
    for run in running:
        api.call("POST",api.prefix+f"/actions/runs/{run['id']}/cancel",allow_status=(409,))
    api.ev.add("FROZEN",{"actions_enabled":False,"R3_bypass":[],"cancellation_requests":len(running)})

def git_push_probe(api,cfg):
    if api.actor!="codex": raise ValueError("WORKFLOW_PUSH_REQUIRES_CODEX")
    ref=cfg["workflow_injection_ref"]; validate_target(cfg,ref); before=ref_state(api,ref)
    if not before: raise ValueError("WORKFLOW_REF_NOT_SEEDED")
    if not cfg.get("policy_id"): raise ValueError("POLICY_NOT_INSTALLED")
    got=api.get(api.prefix+"/actions/policies/"+str(cfg["policy_id"]))
    if not semantic_equal(got,policy()): api.ev.stop("POLICY_NOT_EXACT_ACTIVE",got)
    # Literal scripts and canaries only. No shell command from PR text.
    with tempfile.TemporaryDirectory(prefix="forge-push-") as td:
        folder=Path(td); ask=folder/"askpass.py"
        ask.write_text("#!/usr/bin/env python3\nimport os,sys\nprint('x-access-token' if 'username' in sys.argv[1].lower() else os.environ['FORGE_TEST_GIT_TOKEN'])\n")
        ask.chmod(0o700)
        env={k:v for k,v in os.environ.items() if not k.startswith("GIT_")}
        env.update({"GIT_ASKPASS":str(ask),"GIT_TERMINAL_PROMPT":"0","FORGE_TEST_GIT_TOKEN":api.token,
                    "GIT_NO_REPLACE_OBJECTS":"1","GIT_CONFIG_NOSYSTEM":"1","GIT_CONFIG_GLOBAL":os.devnull,
                    "GIT_AUTHOR_NAME":"Forge Drill","GIT_AUTHOR_EMAIL":"drill@example.invalid",
                    "GIT_COMMITTER_NAME":"Forge Drill","GIT_COMMITTER_EMAIL":"drill@example.invalid"})
        def git(*argv,input=None):
            p=subprocess.run(["git","-c","credential.helper=","-c","core.hooksPath="+os.devnull,*argv],
                  cwd=folder,env=env,input=input,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=45)
            if p.returncode: api.ev.stop("GIT_PROBE_INCONCLUSIVE",{"argv":argv,"stderr":p.stderr.replace(api.token,"[REDACTED]")})
            return p.stdout.strip()
        git("init","--bare")
        remote="https://github.com/"+cfg["repo"]+".git"
        git("fetch","--no-tags",remote,ref)
        tip=git("rev-parse","FETCH_HEAD")
        if tip!=before: api.ev.stop("CONCURRENT_REF_CHANGE",{"before":before,"fetched":tip})
        git("read-tree",tip)
        for path in [".github/workflows/drill-push.yml",".github/workflows/drill-pr.yml",".github/workflows/drill-dispatch.yml"]:
            text=(Path(__file__).resolve().parent/"fixtures"/path).read_text()
            text=text.replace("__RUN__",cfg["run_id"]).replace("__REPO__",cfg["repo"])
            text=text.replace("CONTROL_SENTINEL","UNTRUSTED_SENTINEL")
            oid=git("hash-object","-w","--stdin",input=text)
            git("update-index","--add","--cacheinfo","100644,"+oid+","+path)
        # New arbitrary file path proves there is no exception for known workflow paths.
        path=".github/workflows/injected-"+cfg["run_id"]+".yml"
        text="name: Forged Checks\non: [push, pull_request]\npermissions: {}\njobs:\n  spoof:\n    name: forge-verify\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo UNTRUSTED_SENTINEL_"+cfg["run_id"]+"\n"
        oid=git("hash-object","-w","--stdin",input=text)
        git("update-index","--add","--cacheinfo","100644,"+oid+","+path)
        tree=git("write-tree"); sha=git("commit-tree",tree,"-p",tip,input="FORGE DRILL workflow injection\n")
        # Ordinary FF push: NO force option. Exact refspec only, never wildcard.
        output=git("push","--porcelain",remote,sha+":"+ref)
    after=ref_state(api,ref)
    if after!=sha: api.ev.stop("WORKFLOW_PUSH_NOT_ACCEPTED",{"after":after,"candidate":sha,"output":output})
    cfg["workflow_push_sha"]=sha; cfg["workflow_push_at"]=now()
    api.ev.add("WORKFLOW_PUSH_ACCEPTED_PENDING_POLICY_PROOF",{"ref":ref,"sha":sha,"output":output})
    print("Push accepted. This is PENDING, not PASS. Capture blocked policy runs/insights and zero started canary jobs.")

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--work",default="live-work")
    p.add_argument("--actor",choices=["owner","codex"],default="owner")
    p.add_argument("--execute",action="store_true")
    sub=p.add_subparsers(dest="cmd",required=True)
    q=sub.add_parser("prepare"); q.add_argument("--repo",required=True);q.add_argument("--run-id",required=True);q.add_argument("--out",required=True)
    sub.add_parser("plan"); sub.add_parser("bind"); sub.add_parser("snapshot"); sub.add_parser("seed")
    q=sub.add_parser("install");q.add_argument("which",choices=["POLICY"]+["R"+str(n) for n in range(1,8)])
    sub.add_parser("coverage"); sub.add_parser("enable-actions")
    q=sub.add_parser("run");q.add_argument("case_id")
    q=sub.add_parser("merge-result");q.add_argument("case_id")
    q=sub.add_parser("pr");q.add_argument("scenario",choices=SCENARIOS)
    for name in ["collect","bind-checks","rerun"]:
        q=sub.add_parser(name);q.add_argument("run_id",type=int)
    q=sub.add_parser("ff-head");q.add_argument("scenario",choices=SCENARIOS)
    sub.add_parser("wrong-source-statuses");sub.add_parser("push-workflows");sub.add_parser("freeze")
    sub.add_parser("dispatch");sub.add_parser("workflow-pr");sub.add_parser("observe-actions")
    sub.add_parser("control-canaries");sub.add_parser("disable-actions")
    q=sub.add_parser("probe");q.add_argument("case_id");q.add_argument("--mode",choices=["M0","M1","CONTROL"],default="M1")
    args=p.parse_args()
    if args.cmd=="prepare": prepare(args);return
    root=Path(args.work).resolve();cfg=load(root/"manifest.json")
    if args.cmd=="plan":
        print(json.dumps({"repo":cfg["repo"],"cases":cfg["cases"],"scenarios":cfg["scenarios"]},indent=2));return
    ev=Evidence(root/"evidence");api=API(cfg,args.actor,ev,args.execute)
    reads=["bind","snapshot","coverage","collect","bind-checks","observe-actions","merge-result"]
    if args.cmd not in reads and not args.execute: raise ValueError("Review plan first; this command requires --execute")
    if cfg.get("pending_merges") and args.cmd not in reads+["freeze","disable-actions"]:
        raise ValueError("ASYNC_MERGE_PENDING_NO_FURTHER_MUTATION")
    if args.cmd=="bind": bind(api,cfg)
    elif args.cmd=="freeze":
        if args.actor!="owner":raise ValueError("OWNER_ONLY")
        freeze(api,cfg)
    else:
        guard(api,check_stop=args.cmd not in ["snapshot","collect","observe-actions","merge-result"],check_main=args.cmd not in ["snapshot","collect","observe-actions","merge-result"])
        if args.cmd in ["seed","install","enable-actions","bind-checks"] and args.actor!="owner":raise ValueError("OWNER_ONLY")
        if args.cmd=="snapshot":snapshot(api,cfg)
        elif args.cmd=="seed":seed(api,cfg)
        elif args.cmd=="install":install(api,cfg,args.which)
        elif args.cmd=="coverage":coverage(api,cfg)
        elif args.cmd=="enable-actions":
            if not cfg.get("policy_id"):raise ValueError("POLICY_REQUIRED")
            got=api.get(api.prefix+"/actions/policies/"+str(cfg["policy_id"]))
            if not semantic_equal(got,policy()):ev.stop("POLICY_NOT_EXACT_ACTIVE",got)
            api.call("PUT",api.prefix+"/actions/permissions",{"enabled":True,"allowed_actions":"local_only"})
        elif args.cmd=="run":
            case=next((c for c in cfg["cases"] if c["id"]==args.case_id),None)
            if case is None or case["actor"]!=args.actor:raise ValueError("CASE_OR_ACTOR_MISMATCH")
            if case["operation"]=="merge":merge(api,cfg,case)
            else:do_ref(api,cfg,case)
        elif args.cmd=="merge-result":merge_result(api,cfg,args.case_id)
        elif args.cmd=="pr":open_pr(api,cfg,args.scenario)
        elif args.cmd=="collect":collect(api,cfg,args.run_id)
        elif args.cmd=="bind-checks":bind_checks(api,cfg,args.run_id)
        elif args.cmd=="rerun":
            run=api.get(api.prefix+"/actions/runs/"+str(args.run_id))
            if run["path"].split("@")[0]!=".github/workflows/forge-drill.yml" or run["event"]!="pull_request_target":raise ValueError("RERUN_ONLY_TRUSTED_DRILL_WORKFLOW")
            api.call("POST",api.prefix+f"/actions/runs/{args.run_id}/rerun")
            ev.add("RERUN_REQUEST_PENDING_EXECUTION",{"run_id":args.run_id,"actor":args.actor})
        elif args.cmd=="ff-head":
            sc=cfg["scenarios"][args.scenario]
            if args.actor!=("owner" if "/forge/owner/" in sc["head"] else "codex"):raise ValueError("WRITER_MISMATCH")
            do_ref(api,cfg,{"id":"HEAD-FF-"+args.scenario,"ref":sc["head"],"operation":"ff","actor":args.actor,"expected":"ALLOW"})
        elif args.cmd=="wrong-source-statuses":
            sc=cfg["scenarios"]["wrong-source"];sha=ref_state(api,sc["head"])
            for context in ["forge-gate","forge-verify"]:
                api.call("POST",api.prefix+"/statuses/"+sha,{"state":"success","context":context,"description":"Owner PAT control; must not satisfy Actions App pin"})
        elif args.cmd=="push-workflows":git_push_probe(api,cfg)
        elif args.cmd=="disable-actions":
            if api.actor!="owner":raise ValueError("OWNER_ONLY")
            api.call("PUT",api.prefix+"/actions/permissions",{"enabled":False})
        elif args.cmd=="control-canaries":
            if api.actor!="owner" or cfg.get("policy_id") or cfg["ruleset_ids"]:raise ValueError("OWNER_TRUSTED_CONTROL_BEFORE_PROTECTIONS_ONLY")
            _,perm=api.call("GET",api.prefix+"/collaborators/forge-codex/permission",allow_status=(404,))
            if perm and perm.get("permission") in ["admin","maintain","write"]:raise ValueError("NO_DEVELOPER_WRITE_ACCESS_DURING_TRUSTED_CONTROL")
            if not api.get(api.prefix+"/actions/permissions")["enabled"]:raise ValueError("OWNER_ENABLE_ACTIONS_FOR_TRUSTED_CONTROL_IN_UI")
            ref=cfg["canary_control_ref"]
            do_ref(api,cfg,{"id":"OWNER-CANARY-CONTROL-FF","ref":ref,"operation":"ff","actor":"owner","expected":"ALLOW"})
            api.call("POST",api.prefix+"/pulls",{"title":"FORGE trusted owner canary control",
              "head":ref[11:],"base":cfg["scenarios"]["actions-policy"]["base"][11:],"draft":False})
            api.call("POST",api.prefix+"/actions/workflows/drill-dispatch.yml/dispatches",{"ref":ref[11:]})
            ev.add("OWNER_CANARY_CONTROLS_PENDING_EXECUTION_PROOF",{"ref":ref,"untrusted_code_executed":False})
        elif args.cmd=="dispatch":
            if api.actor!="codex" or not cfg.get("workflow_push_sha"):raise ValueError("DEVELOPER_PUSH_FIRST")
            api.call("POST",api.prefix+"/actions/workflows/drill-dispatch.yml/dispatches",
                     {"ref":cfg["workflow_injection_ref"][11:]},allow_status=(403,422))
            ev.add("DISPATCH_PENDING_PLATFORM_POLICY_PROOF",{"at":now(),"ref":cfg["workflow_injection_ref"]})
        elif args.cmd=="workflow-pr":
            if api.actor!="codex" or not cfg.get("workflow_push_sha"):raise ValueError("DEVELOPER_PUSH_FIRST")
            body=api.call("POST",api.prefix+"/pulls",{"title":"FORGE DRILL untrusted workflow canaries",
              "head":cfg["workflow_injection_ref"][11:],"base":cfg["scenarios"]["actions-policy"]["base"][11:],
              "body":"Policy proof only. Never merge or retarget to main.","draft":False})[1]
            cfg["workflow_pr"]=body["number"]
            ev.add("WORKFLOW_PR_PENDING_PLATFORM_POLICY_PROOF",{"pr":body["number"]})
        elif args.cmd=="observe-actions":
            runs=api.list(api.prefix+"/actions/runs","workflow_runs")
            captured=[]
            for run in runs:captured.append(collect(api,cfg,run["id"]))
            dump(ev.root/"actions-observation.json",{"at":now(),"runs":captured})
            print("Evidence captured. A request accepted with 204 or absence of runs is never automatic PASS.")
        elif args.cmd=="probe":
            if args.actor!="owner":raise ValueError("OWNER_ONLY_PROBE_TRIGGER")
            if args.mode=="CONTROL":head="refs/heads/forge/owner/"+cfg["run_id"]+"/actions-trigger/CONTROL"
            else:
                if args.case_id not in [c["id"] for c in cfg["cases"] if c["actor"]=="actions"]:raise ValueError("UNKNOWN_ACTIONS_PROBE")
                if args.case_id=="ACTIONS-PR" and args.mode!="M0":raise ValueError("ACTIONS_PR_PERMISSION_PROBE_IS_M0_ONLY")
                head="refs/heads/forge/owner/"+cfg["run_id"]+"/actions-trigger/"+args.mode+"/"+args.case_id
            validate_target(cfg,head)
            do_ref(api,cfg,{"id":"TRIGGER-"+args.mode+"-"+args.case_id,"ref":head,"operation":"ff","actor":"owner","expected":"ALLOW"})
            body=api.call("POST",api.prefix+"/pulls",{"title":"FORGE DRILL Actions "+args.mode+" "+args.case_id,
                "head":head[11:],"base":cfg["scenarios"]["actions-probe"]["base"][11:],
                "body":"Single trusted token probe. Serialize probes and preserve branches.","draft":False})[1]
            ev.add("PROBE_PENDING_JOB_RESULT",{"case":args.case_id,"mode":args.mode,"pr":body["number"]})
            print(json.dumps({"pr":body["number"],"mode":args.mode,"case":args.case_id}))
    dump(root/"manifest.json",cfg)

if __name__=="__main__":
    try:main()
    except (ValueError,RuntimeError,TimeoutError,urllib.error.URLError,subprocess.TimeoutExpired) as e:
        print(str(e),file=sys.stderr);sys.exit(2)
