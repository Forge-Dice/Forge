"""Strict Policy v1 / Taskplan v1 loading, contract binding and identity (PKG §4, contract B §2, §7).

Everything is read from the trusted BASE snapshot through A's ObjectStore. Policy and plan are
strict canonical JSON (LF, no BOM/CR, two-space canonical form with trailing LF, exact key
order, no duplicate keys). The contract is parsed only by the unchanged BASE parser through
contract-adapter.mjs. Commands are registry keys, never argv.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
import os
import re

import process
from errors import ForgeFail, fail
from history import is_in_base_ancestry
from objects import ObjectStore, Snapshot
from paths import validate_path

POLICY_PATH = "forge/verifier/policy.json"
JSON_LIMIT = 256 * 1024
JSON_DEPTH = 32
OWNER_ID = 315180734
DEV = {"id": 337272506, "provider": "codex", "namespacePrefix": "forge/run/codex/"}
NAMESPACES = {"DEV": "forge/run/codex/", "OWNER_OPS": "forge/owner/"}
REGISTRY = {"typecheck": "forge-v01:typecheck", "test": "forge-v01:test", "mutations": "forge-v01:mutations"}
PARSER_FILES = {
    "src/forge/contract-document.ts": {"zod", "./freeze.ts", "./primitives.ts"},
    "src/forge/primitives.ts": {"zod"},
    "src/forge/freeze.ts": set(),
    "src/forge/node-sha256.ts": {"node:crypto", "./contract-document.ts"},
}
ADAPTER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "contract-adapter.mjs")
NODE = "/opt/node/bin/node"
ADAPTER_DEADLINE = 10.0
TCB_PREFIXES = ("src/forge/", "tools/forge_v01/", ".github/", "forge/contracts/", "forge/approvals/", "forge/verifier/")
POLICY_KEYS = ("format", "repoId", "ownerId", "developers", "imageDigest", "bootstrapVersion",
               "deploymentPolicyDigest", "limitsProfile", "taskIndex")
INDEX_KEYS = ("taskId", "contractPath", "contractHash", "planPath", "planHash")
PLAN_KEYS = ("format", "taskId", "contractHash", "profile", "approvedTcbPaths", "addedTestFiles", "checks", "mutants")
MUTANT_KEYS = ("id", "path", "anchorBase64", "replacementBase64", "testFiles", "namedTests")

_TASK = re.compile(r"[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+")
_HEX64 = re.compile(r"[0-9a-f]{64}")
_OID = re.compile(r"[0-9a-f]{40}")
_SUFFIX = re.compile(r"[a-z0-9][a-z0-9-]{0,31}")
_MUTANT_ID = re.compile(r"[a-z][a-z0-9-]{0,31}")
_IMPORT = re.compile(rb"""(?:\bfrom\s*|\bimport\s*)["']([^"']*)["']""")
_DYNAMIC = re.compile(rb"\b(?:import|require)\s*\(")

def gfail(code: str, phase: str = "policy", subject: bytes | None = None) -> ForgeFail:
    return fail(code, phase, subject)


# -- strict canonical JSON -----------------------------------------------------------------


def canonical_json(raw: bytes, code: str = "POLICY_INVALID"):
    """Parse bytes that must be exactly the canonical two-space form with trailing LF."""
    if not isinstance(raw, (bytes, bytearray)) or len(raw) > JSON_LIMIT:
        raise gfail(code)
    try:
        text = bytes(raw).decode("utf-8", errors="strict")
        value = json.loads(text, object_pairs_hook=_pairs, parse_float=_reject, parse_constant=_reject)
        canonical = json.dumps(value, indent=2, ensure_ascii=False) + "\n"
    except (ValueError, RecursionError):
        raise gfail(code) from None
    if canonical != text or _depth(value) > JSON_DEPTH:
        raise gfail(code)
    return value


def _pairs(items):
    out = {}
    for key, value in items:
        if key in out:
            raise ValueError("duplicate key")
        out[key] = value
    return out


def _reject(_text):
    raise ValueError("number form not allowed")


def _depth(value) -> int:
    best, stack = 0, [(value, 1)]
    while stack:
        item, depth = stack.pop()
        best = max(best, depth)
        children = item.values() if isinstance(item, dict) else item if isinstance(item, list) else ()
        stack.extend((child, depth + 1) for child in children)
    return best


def _obj(value, keys) -> dict:
    if not isinstance(value, dict) or tuple(value) != keys:
        raise gfail("POLICY_INVALID")
    return value


def _str(value, pattern: re.Pattern | None = None) -> str:
    if not isinstance(value, str) or (pattern is not None and pattern.fullmatch(value) is None):
        raise gfail("POLICY_INVALID")
    return value


def _int(value, low: int = 1, high: int = 2**53 - 1) -> int:
    if type(value) is not int or not low <= value <= high:
        raise gfail("POLICY_INVALID")
    return value


def _path(value) -> str:
    try:
        if isinstance(value, str) and validate_path(value.encode("ascii")) == value:
            return value
    except (ForgeFail, UnicodeEncodeError):
        pass
    raise gfail("POLICY_INVALID")


def _unique(values: list, key=lambda v: v) -> list:
    if not isinstance(values, list) or len({json.dumps(key(v), sort_keys=True) for v in values}) != len(values):
        raise gfail("POLICY_INVALID")
    return values


def policy_hash(raw: bytes) -> str:
    return hashlib.sha256(b"forge-policy-v1\n" + raw).hexdigest()


def plan_hash(raw: bytes) -> str:
    return hashlib.sha256(b"forge-plan-v1\n" + raw).hexdigest()


def parse_policy(raw: bytes) -> dict:
    p = _obj(canonical_json(raw), POLICY_KEYS)
    _int(p["format"], 1, 1), _int(p["repoId"]), _int(p["ownerId"], OWNER_ID, OWNER_ID)
    for dev in _unique(p["developers"], lambda d: d.get("id") if isinstance(d, dict) else d):
        if _obj(dev, ("id", "provider", "namespacePrefix")) != DEV:
            raise gfail("POLICY_INVALID")
    _str(p["imageDigest"], re.compile(r"sha256:[0-9a-f]{64}"))
    _int(p["bootstrapVersion"], 1, 1)
    _str(p["deploymentPolicyDigest"], _HEX64)
    if p["limitsProfile"] != "v01":
        raise gfail("POLICY_INVALID")
    index = _unique(p["taskIndex"], lambda e: e.get("taskId") if isinstance(e, dict) else e)
    paths = []
    for entry in index:
        _obj(entry, INDEX_KEYS)
        _str(entry["taskId"], _TASK), _str(entry["contractHash"], _HEX64), _str(entry["planHash"], _HEX64)
        contract, plan = _path(entry["contractPath"]), _path(entry["planPath"])
        if not (contract.startswith("forge/contracts/") and contract.endswith(".md")):
            raise gfail("POLICY_INVALID")
        if not (plan.startswith(("forge/contracts/", "forge/verifier/")) and plan.endswith(".json")):
            raise gfail("POLICY_INVALID")
        paths += [contract, plan]
    _unique(paths)
    return p


def parse_plan(raw: bytes) -> dict:
    p = _obj(canonical_json(raw), PLAN_KEYS)
    _int(p["format"], 1, 1), _str(p["taskId"], _TASK), _str(p["contractHash"], _HEX64)
    if p["profile"] not in NAMESPACES:
        raise gfail("POLICY_INVALID")
    for key in ("approvedTcbPaths", "addedTestFiles"):
        [_path(v) for v in _unique(p[key])]
    for check in _unique(p["checks"], lambda c: c.get("name") if isinstance(c, dict) else c):
        _obj(check, ("name", "command")), _str(check["name"]), _str(check["command"])
    if len(_unique(p["mutants"], lambda m: m.get("id") if isinstance(m, dict) else m)) > 8:
        raise gfail("POLICY_INVALID")
    for m in p["mutants"]:
        _obj(m, MUTANT_KEYS), _str(m["id"], _MUTANT_ID), _path(m["path"])
        if not 1 <= len(_b64(m["anchorBase64"])) <= 65536 or len(_b64(m["replacementBase64"])) > 65536:
            raise gfail("POLICY_INVALID")
        files = [_path(f) for f in _unique(m["testFiles"])]
        named = _unique(m["namedTests"])
        if not files or not 1 <= len(named) <= 500:
            raise gfail("POLICY_INVALID")
        for ident in named:
            if not (isinstance(ident, list) and len(ident) == 5 and ident[0] in files and ident[1] == "forge-v01"):
                raise gfail("POLICY_INVALID")
            if not isinstance(ident[2], list) or not all(isinstance(t, str) for t in ident[2] + [ident[3]]):
                raise gfail("POLICY_INVALID")
            _int(ident[4], 0, 49_999)
    return p


def _b64(value) -> bytes:
    try:
        data = base64.b64decode(_str(value).encode("ascii"), validate=True)
    except (binascii.Error, UnicodeEncodeError):
        raise gfail("POLICY_INVALID") from None
    if base64.b64encode(data).decode("ascii") != value:
        raise gfail("POLICY_INVALID")
    return data


# -- identity (phase 3) --------------------------------------------------------------------


def check_identity(policy: dict, actor_id, head_repo_id, branch) -> tuple[str, str]:
    """Return (profile, taskId) from the numeric actor and the branch namespace."""
    if type(head_repo_id) is not int or head_repo_id != policy["repoId"]:
        raise gfail("IDENTITY_ACTOR", "policy")
    if type(actor_id) is int and actor_id == policy["ownerId"]:
        profile = "OWNER_OPS"
    elif type(actor_id) is int and any(dev["id"] == actor_id for dev in policy["developers"]):
        profile = "DEV"
    else:
        raise gfail("IDENTITY_ACTOR", "policy")
    prefix = NAMESPACES[profile]
    rest = branch[len(prefix):] if isinstance(branch, str) and branch.startswith(prefix) else ""
    task, _, suffix = rest.partition("/")
    registered = {entry["taskId"] for entry in policy["taskIndex"]}
    if _TASK.fullmatch(task) is None or task not in registered or _SUFFIX.fullmatch(suffix) is None:
        raise gfail("IDENTITY_NAMESPACE", "policy", branch.encode("utf-8", "replace") if isinstance(branch, str) else None)
    return profile, task


# -- BASE reads and the trusted parser ---------------------------------------------------------


def _blob(store: ObjectStore, snapshot: Snapshot, path: str, code: str) -> bytes:
    leaf = snapshot.by_path().get(path)
    if leaf is None or leaf.mode != "100644":
        raise gfail(code, "policy", path.encode("ascii"))
    return store.read_blob(leaf.oid)


def check_parser_root(store: ObjectStore, snapshot: Snapshot, parser_root: str) -> None:
    """The parser files at parser_root are byte-identical to BASE and import only the fixed graph."""
    for path, allowed in PARSER_FILES.items():
        raw = _blob(store, snapshot, path, "POLICY_INVALID")
        imports = set(m.decode("ascii", "replace") for m in _IMPORT.findall(raw))
        if not imports <= allowed or _DYNAMIC.search(raw):
            raise gfail("POLICY_INVALID", "policy", path.encode("ascii"))
        try:
            fd = os.open(os.path.join(parser_root, path), os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
            with os.fdopen(fd, "rb") as handle:
                local = handle.read(JSON_LIMIT + 1)
        except OSError:
            raise gfail("POLICY_INVALID", "policy", path.encode("ascii")) from None
        if local != raw:
            raise gfail("POLICY_INVALID", "policy", path.encode("ascii"))


def parse_contract(raw: bytes, parser_root: str, *, node: str = NODE, private: str) -> dict:
    """Parse contract bytes with the BASE parser via the adapter; parser rejection → CONTRACT_PARSE."""
    if len(raw) > JSON_LIMIT:
        raise gfail("CONTRACT_PARSE")
    process.prepare_private(private)
    env = {"PATH": "/usr/bin:/bin", "HOME": os.path.join(private, "home"), "TMPDIR": os.path.join(private, "tmp"),
           "LANG": "C", "LC_ALL": "C", "TZ": "UTC"}
    argv = [node, "--experimental-strip-types", "--disable-warning=ExperimentalWarning", ADAPTER, parser_root]
    done = process.run_bounded(argv, env, deadline_seconds=ADAPTER_DEADLINE, stdin_data=bytes(raw), output_limit=1 << 20)
    lines = done.stdout.split(b"\n")
    if done.returncode != 0 or len(lines) != 2 or lines[1] != b"":
        raise gfail("EXECUTION_INTERNAL")
    try:
        answer = json.loads(lines[0].decode("utf-8"), object_pairs_hook=_pairs)
    except (ValueError, UnicodeDecodeError):
        raise gfail("EXECUTION_INTERNAL") from None
    if answer.get("ok") is False:
        raise gfail("CONTRACT_PARSE")
    expected = hashlib.sha256(b"forge-contract-v1\n" + bytes(raw)).hexdigest()
    if answer.get("ok") is not True or answer.get("contentHash") != expected:
        raise gfail("EXECUTION_INTERNAL")
    return answer


# -- binding (phase 5) -----------------------------------------------------------------------


def load_policy(store: ObjectStore, base_commit: str) -> tuple[Snapshot, dict, str]:
    snapshot = store.collect_tree(store.read_commit(base_commit).tree)
    raw = _blob(store, snapshot, POLICY_PATH, "POLICY_INVALID")
    return snapshot, parse_policy(raw), policy_hash(raw)


def bind_task(store, base_commit: str, snapshot: Snapshot, policy: dict, task_id: str, profile: str, *,
              parser_root: str, node: str = NODE, private: str) -> dict:
    entry = next((e for e in policy["taskIndex"] if e["taskId"] == task_id), None)
    if entry is None:
        raise gfail("IDENTITY_NAMESPACE", "policy")
    # Order inside phase 5 follows the enum (CONTRACT_PARSE < CONTRACT_BINDING < POLICY_INVALID);
    # only the plan's profile (an identity fact, phase 3) is decided before the contract parse.
    plan_raw = _blob(store, snapshot, entry["planPath"], "CONTRACT_BINDING")
    contract_raw = _blob(store, snapshot, entry["contractPath"], "CONTRACT_BINDING")
    plan, plan_error = None, None
    try:
        plan = parse_plan(plan_raw)
    except ForgeFail as failure:
        plan_error = failure
    if plan is not None and plan["profile"] != profile:
        raise gfail("IDENTITY_NAMESPACE", "policy")
    check_parser_root(store, snapshot, parser_root)
    contract = parse_contract(contract_raw, parser_root, node=node, private=private)
    meta = contract["metadata"]
    if plan_hash(plan_raw) != entry["planHash"] or contract["contentHash"] != entry["contractHash"]:
        raise gfail("CONTRACT_BINDING")
    if plan_error is not None:
        raise plan_error
    if plan["contractHash"] != entry["contractHash"]:
        raise gfail("CONTRACT_BINDING")
    if not contract["taskId"] == plan["taskId"] == task_id:
        raise gfail("CONTRACT_BINDING")
    if not is_in_base_ancestry(store, base_commit, meta["baseCommit"]):
        raise gfail("CONTRACT_BINDING")
    known = {e["taskId"] for e in policy["taskIndex"]}
    for dep in meta["dependencies"]:
        accepted = dep["acceptedCommit"]
        if accepted is None or dep["taskId"] not in known or not is_in_base_ancestry(store, base_commit, accepted):
            raise gfail("CONTRACT_DEPENDENCY")
    bind_plan(plan, meta, snapshot, profile, entry["contractPath"])
    return {"taskId": task_id, "profile": profile, "contractPath": entry["contractPath"], "contractHash": entry["contractHash"],
            "planHash": entry["planHash"], "metadata": meta, "plan": plan}


def bind_plan(plan: dict, meta: dict, snapshot: Snapshot, profile: str, contract_path: str) -> None:
    """Plan against contract: checks, scope inclusion, path classes and mutation rules."""
    create, modify = set(meta["scope"]["create"]), set(meta["scope"]["modify"])
    if plan["checks"] != meta["requiredChecks"]:
        raise gfail("CONTRACT_BINDING")
    if not set(plan["addedTestFiles"]) <= create or not set(plan["approvedTcbPaths"]) <= create | modify:
        raise gfail("CONTRACT_BINDING")
    for check in meta["requiredChecks"]:
        if REGISTRY.get(check["name"]) != check["command"]:
            raise gfail("POLICY_INVALID")
    mutants, smoke = plan["mutants"], meta["mutationSmoke"]
    if (smoke == "required" and not mutants) or (smoke == "none" and mutants):
        raise gfail("POLICY_INVALID")
    expected = ["typecheck", "test"] + (["mutations"] if mutants else [])
    if [c["name"] for c in meta["requiredChecks"]] != expected:
        raise gfail("POLICY_INVALID")
    base = snapshot.by_path()
    for path in plan["addedTestFiles"]:
        if not (path.startswith("tests/") and path.endswith(".test.ts")) or path in base:
            raise gfail("POLICY_INVALID")
    if profile == "DEV" and plan["approvedTcbPaths"]:
        raise gfail("POLICY_INVALID")
    for path in plan["approvedTcbPaths"]:
        if not path.startswith(TCB_PREFIXES) or path == contract_path:
            raise gfail("POLICY_INVALID")
    for m in mutants:
        source = m["path"].startswith("src/") and not m["path"].startswith("src/forge/") and m["path"].endswith(".ts")
        if m["path"] not in create | modify or not source or m["path"].endswith(".test.ts"):
            raise gfail("POLICY_INVALID")
        for f in m["testFiles"]:
            if not f.endswith(".test.ts") or not (f in base or f in plan["addedTestFiles"]):
                raise gfail("POLICY_INVALID")


def gate_task(store: ObjectStore, base_commit: str, actor_id, head_repo_id, branch, *, parser_root: str,
              node: str = NODE, private: str) -> dict:
    """Phases 3 and 5 of the static gate on BASE: policy, identity, plan and contract binding."""
    snapshot, policy, digest = load_policy(store, base_commit)
    profile, task_id = check_identity(policy, actor_id, head_repo_id, branch)
    bound = bind_task(store, base_commit, snapshot, policy, task_id, profile, parser_root=parser_root, node=node,
                      private=private)
    return {**bound, "policyHash": digest}
