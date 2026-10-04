from __future__ import annotations
from dataclasses import dataclass
from typing import Iterable, Sequence
import re

ASCII_SEGMENT = re.compile(r"^[A-Za-z0-9_.][A-Za-z0-9._-]*$")
WINDOWS_RESERVED = {"CON","PRN","AUX","NUL",*(f"COM{i}" for i in range(1,10)),*(f"LPT{i}" for i in range(1,10))}
PROTECTED_EXACT = {"package.json","package-lock.json","tsconfig.json","vitest.config.ts","vitest.config.mts","vitest.config.js","vitest.config.mjs"}
PROTECTED_PREFIX = (".github/","forge/contracts/","forge/approvals/")
FROZEN_TEST_PREFIX = ("tests/",)

@dataclass(frozen=True, order=True)
class Entry:
    path: str
    mode: str
    oid: str
    kind: str = "blob"

@dataclass(frozen=True)
class Delta:
    path: str
    op: str
    old_mode: str|None
    new_mode: str|None
    old_oid: str|None
    new_oid: str|None

@dataclass(frozen=True)
class Commit:
    oid: str
    parents: tuple[str, ...]
    changed_paths: tuple[str, ...] = ()

def _portable_segment(seg: str) -> bool:
    if not seg or not ASCII_SEGMENT.fullmatch(seg):
        return False
    if seg in {".",".."} or seg.lower()==".git":
        return False
    if seg.endswith(".") or seg.endswith(" "):
        return False
    stem=seg.split(".",1)[0].upper()
    if stem in WINDOWS_RESERVED:
        return False
    return True

def path_safe(path: str, *, allow_symlink: bool=False, mode: str="100644") -> bool:
    if not path or path.startswith("/") or "\\" in path or len(path)>255:
        return False
    if any(ord(c)<0x21 or ord(c)>0x7e for c in path):
        return False
    if not all(_portable_segment(x) for x in path.split("/")):
        return False
    if mode in ("120000","160000") and not allow_symlink:
        return False
    if mode not in ("100644","100755") and not (allow_symlink and mode=="120000"):
        return False
    return True

def tree_safe(entries: Sequence[Entry], *, allow_symlink: bool=False) -> bool:
    raw=[e.path for e in entries]
    if len(raw)!=len(set(raw)):
        return False
    folded={}
    for e in entries:
        if not path_safe(e.path, allow_symlink=allow_symlink, mode=e.mode):
            return False
        parts=e.path.split("/")
        for i in range(1,len(parts)):
            prefix="/".join(parts[:i]).casefold()
            if prefix in folded and folded[prefix]=="file":
                return False
        key=e.path.casefold()
        if key in folded:
            return False
        folded[key]="file"
        for i in range(1,len(parts)):
            p="/".join(parts[:i]).casefold()
            folded.setdefault(p,"dir")
    return True

def canonical_diff(base: Sequence[Entry], head: Sequence[Entry], *, trust_rename: bool=False, ignore_mode: bool=False) -> list[Delta]:
    a=sorted(base,key=lambda x:x.path)
    b=sorted(head,key=lambda x:x.path)
    out=[]
    i=j=0
    while i<len(a) or j<len(b):
        if i>=len(a):
            e=b[j]; out.append(Delta(e.path,"ADD",None,e.mode,None,e.oid)); j+=1; continue
        if j>=len(b):
            e=a[i]; out.append(Delta(e.path,"DELETE",e.mode,None,e.oid,None)); i+=1; continue
        x,y=a[i],b[j]
        if x.path<y.path:
            out.append(Delta(x.path,"DELETE",x.mode,None,x.oid,None)); i+=1
        elif y.path<x.path:
            out.append(Delta(y.path,"ADD",None,y.mode,None,y.oid)); j+=1
        else:
            mode_same=(x.mode==y.mode) or ignore_mode
            if x.oid!=y.oid or not mode_same or x.kind!=y.kind:
                if x.oid!=y.oid and not mode_same:
                    op="MODIFY+MODE"
                elif x.oid!=y.oid or x.kind!=y.kind:
                    op="MODIFY"
                else:
                    op="MODE"
                out.append(Delta(x.path,op,x.mode,y.mode,x.oid,y.oid))
            i+=1; j+=1
    if trust_rename:
        dels=[d for d in out if d.op=="DELETE"]
        adds=[d for d in out if d.op=="ADD"]
        used=set()
        replacement=[]
        for d in dels:
            match=next((a for a in adds if a.new_oid==d.old_oid and a.path not in used),None)
            if match:
                used.add(match.path)
                replacement.append(Delta(f"{d.path}->{match.path}","RENAME",d.old_mode,match.new_mode,d.old_oid,match.new_oid))
            else:
                replacement.append(d)
        replacement += [d for d in out if d.op!="DELETE" and not (d.op=="ADD" and d.path in used)]
        out=replacement
    return sorted(out,key=lambda d:(d.path,d.op))

def is_protected(path: str) -> bool:
    p=path.casefold()
    if p in {x.casefold() for x in PROTECTED_EXACT}: return True
    return any(p.startswith(x.casefold()) for x in PROTECTED_PREFIX)

def scope_ok(deltas: Sequence[Delta], create: set[str], modify: set[str], *, allow_coordination_exception: bool=False, normalize_lower: bool=False, ignore_mode: bool=False, permit_out_of_scope_add: bool=False, ignore_config_drift: bool=False) -> bool:
    if normalize_lower:
        create={p.lower() for p in create}; modify={p.lower() for p in modify}
    for d in deltas:
        p=d.path.lower() if normalize_lower else d.path
        if is_protected(d.path) and not ignore_config_drift:
            return False
        if d.path.startswith("tests/"):
            return False
        if d.op=="DELETE":
            return False
        if d.op in ("MODE","MODIFY+MODE") and not ignore_mode:
            return False
        if allow_coordination_exception and d.path.startswith("forge/coordination/"):
            continue
        if d.op=="ADD":
            if permit_out_of_scope_add: continue
            if p not in create: return False
        elif d.op in ("MODIFY","MODE","MODIFY+MODE"):
            if p not in modify: return False
        else:
            return False
    return True

def inventory_ok(base: Sequence[tuple], head: Sequence[tuple], *, ignore_deleted: bool=False) -> bool:
    def key(r): return r[:4]
    if len({key(x) for x in head}) != len(head):
        return False
    h={key(x):x[4] for x in head}
    for b in base:
        k=key(b)
        if k not in h:
            if ignore_deleted: continue
            return False
        if h[k]!="passed":
            return False
    return True

def classify_mutant(*, anchor_count:int, timeout:bool, exit_code:int|None, signal:int|None, target_failures:Sequence[tuple[str,str]], unexpected_failures:Sequence[tuple[str,str]]=()) -> str:
    if anchor_count!=1:
        return "NOT_APPLIED"
    if timeout or signal is not None:
        return "INFRA_FAILURE"
    if exit_code is None or exit_code not in (0,1):
        return "INFRA_FAILURE"
    if unexpected_failures:
        return "INFRA_FAILURE"
    if exit_code==0:
        return "SURVIVED"
    if not target_failures or any(kind!="AssertionError" for _,kind in target_failures):
        return "INFRA_FAILURE"
    return "KILLED"

def mutation_suite_ok(classes: Sequence[str], *, ignore_survived:bool=False) -> bool:
    for c in classes:
        if c=="KILLED": continue
        if ignore_survived and c=="SURVIVED": continue
        return False
    return True

def repo_layout_ok(*, replace_refs:int=0, alternates:bool=False, grafts:bool=False, shallow:bool=False, hidden_replace_behavior:bool=False) -> bool:
    if hidden_replace_behavior:
        replace_refs=0
    return replace_refs==0 and not alternates and not grafts and not shallow

def history_ok(commits:dict[str,Commit], base:str, head:str, *, end_diff_nonempty:bool, allowed_intermediate_paths:set[str]|None=None, allow_second_parent:bool=False, max_new_commits:int=128) -> bool:
    if head==base:
        return False
    cur=head
    seen=set()
    count=0
    while cur!=base:
        if cur in seen or cur not in commits:
            return False
        seen.add(cur)
        c=commits[cur]
        count += 1
        if count>max_new_commits:
            return False
        if len(c.parents)!=1:
            if not (allow_second_parent and len(c.parents)==2):
                return False
        if allowed_intermediate_paths is not None:
            if any(p not in allowed_intermediate_paths for p in c.changed_paths):
                return False
        if not c.parents:
            return False
        cur=c.parents[0]
    return bool(end_diff_nonempty)
