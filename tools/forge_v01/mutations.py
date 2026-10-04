"""Mutation application, classification and suite aggregation (PKG §8, contract B §6).

A mutant is applied to the exact HEAD blob bytes (overlapping anchor occurrences counted), written
into a fresh clean HEAD materialization, checked as exactly one MODIFY against the materialization
manifest, typechecked and run on the plan's test files only. classify() is the contract §6 table in
order; aggregate() is PASS iff every plan mutant has an independent KILLED outcome.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import stat
import tempfile

import worker
from errors import ForgeFail, fail
from inventory import Report, key_bytes, parse_report
from materialize import destroy, materialize

KILLED, SURVIVED, NOT_APPLIED, INFRA = "KILLED", "SURVIVED", "NOT_APPLIED", "INFRA_FAILURE"
CLASSES = (KILLED, SURVIVED, NOT_APPLIED, INFRA)
CODE_OF = {SURVIVED: "MUTANT_SURVIVED", NOT_APPLIED: "MUTANT_NOT_APPLIED", INFRA: "MUTANT_INFRA"}
NORMAL_EXITS = (0, 1)
MAX_MUTANTS, MAX_NAMED, MAX_ANCHOR = 8, 500, 65536
_ID = re.compile(r"[a-z][a-z0-9-]{0,31}")
_DIR = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def count_overlapping(source: bytes, anchor: bytes, stop: int = 2) -> int:
    """Occurrences including overlapping ones ("aba" in "ababa" = 2), counted up to `stop`."""
    count, at = 0, source.find(anchor) if anchor else -1
    while at >= 0 and count < stop:
        count, at = count + 1, source.find(anchor, at + 1)
    return count


def apply_mutant(source: bytes, anchor: bytes, replacement: bytes) -> dict:
    """Exactly one (overlapping-counted) anchor, non-empty, replacement different → prefix + replacement + suffix."""
    count = count_overlapping(source, anchor)
    if not anchor or replacement == anchor or count != 1 or len(anchor) > MAX_ANCHOR or len(replacement) > MAX_ANCHOR:
        return {"applied": False, "count": count, "beforeSha256": _sha(source)}
    at = source.find(anchor)
    result = source[:at] + replacement + source[at + len(anchor):]
    if len(result) > 8 * 1024 * 1024:  # blob limit (PKG §2)
        return {"applied": False, "count": count, "beforeSha256": _sha(source)}
    return {"applied": True, "count": 1, "position": at, "result": result, "beforeSha256": _sha(source),
            "afterSha256": _sha(result)}


def manifest(root: str) -> dict:
    """{path: (kind, mode bits, sha256)} of a materialized tree; symlinks and specials are recorded as such."""
    rows = {}
    for directory, subdirs, files, dirfd in os.fwalk(root, follow_symlinks=False):
        rel = os.path.relpath(directory, root)
        for name in files + [d for d in subdirs if os.path.islink(os.path.join(directory, d))]:
            path = name if rel == "." else f"{rel}/{name}"
            info = os.stat(name, dir_fd=dirfd, follow_symlinks=False)
            if not stat.S_ISREG(info.st_mode):
                rows[path] = ("other", stat.S_IMODE(info.st_mode), "")
                continue
            fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=dirfd)
            with os.fdopen(fd, "rb") as handle:
                rows[path] = ("file", stat.S_IMODE(info.st_mode), _sha(handle.read()))
    return rows


def single_modify(before: dict, after: dict, path: str) -> bool:
    """Exactly one MODIFY of `path`: same key set, same kind and mode, only that content hash differs."""
    if set(before) != set(after) or path not in before:
        return False
    changed = [p for p in before if before[p] != after[p]]
    return changed == [path] and before[path][:2] == after[path][:2] and before[path][0] == "file"


def _replace(root: str, path: str, data: bytes) -> None:
    """fd-safe in-place replacement of one materialized leaf (parents opened with O_NOFOLLOW)."""
    parts, fds = path.split("/"), []
    try:
        fds.append(os.open(root, _DIR))
        for name in parts[:-1]:
            fds.append(os.open(name, _DIR, dir_fd=fds[-1]))
        mode = stat.S_IMODE(os.stat(parts[-1], dir_fd=fds[-1], follow_symlinks=False).st_mode)
        os.unlink(parts[-1], dir_fd=fds[-1])
        fd = os.open(parts[-1], os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600, dir_fd=fds[-1])
        fds.append(fd)
        view = memoryview(data)
        while view:
            view = view[os.write(fd, view):]
        os.fchmod(fd, mode)
    except OSError:
        raise fail("EXECUTION_IO", "mutations") from None
    finally:
        for fd in reversed(fds):
            os.close(fd)


# ---------------------------------------------------------------- classification (contract B §6)


def _as_report(value):
    if value is None or isinstance(value, Report):
        return value
    # a JSON payload (driver/tests) goes through the same strict parser as a worker report
    body = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    try:
        return parse_report(b"FORGE-REPORT-V1 %d\n" % len(body) + body)
    except ForgeFail:
        return None


def _identity(value) -> tuple:
    file, project, ancestors, title, occurrence = value
    return (file, project, tuple(ancestors), title, occurrence)


def classify(obs: dict) -> str:
    """First match wins. obs: {applied, timedOut, typecheckOk, exitCode, report, selectedFiles, namedTests}."""
    if obs.get("applied") is not True:  # row 1 (no worker was started)
        return NOT_APPLIED
    if obs.get("timedOut") is not False or obs.get("typecheckOk") is not True:  # row 2: timeout, compiler
        return INFRA
    code = obs.get("exitCode")
    if type(code) is not int:  # no observed exit: crash of the transport
        return INFRA
    if code not in NORMAL_EXITS:  # rows 2+4: the single exit-code precedence site (signal = negative)
        return INFRA
    report = _as_report(obs.get("report"))
    if report is None:  # row 3: missing, partial, over-limit or schema-invalid report
        return INFRA
    inventory = report.inventory
    if inventory.errors or inventory.reason == "interrupted" or any(f.collection != "ok" for f in inventory.files):
        return INFRA  # row 2: module-import throw, collection/suite/hook/unhandled error
    selected = sorted(set(obs.get("selectedFiles") or ()), key=lambda p: p.encode("utf-8"))
    status = {t.id: t.status for t in inventory.tests}
    named = {_identity(n) for n in obs.get("namedTests") or ()}
    if not named or [f.file for f in inventory.files] != selected or {t[0] for t in status} != set(selected):
        return INFRA  # row 3: not exactly the selected files
    if any(n not in status for n in named) or any(s not in ("passed", "failed") for s in status.values()):
        return INFRA  # row 3: named test absent, skip/todo of a selected test
    failed = {f.id: f.errorNames for f in report.failures}
    if any(i not in named for i in failed):  # row 5
        return INFRA
    if code == 0 and not failed and inventory.reason == "passed":  # row 6
        return SURVIVED
    if code == 1 and failed and inventory.reason == "failed" and all(
            names and all(n == "AssertionError" for n in names) for names in failed.values()):  # row 7
        return KILLED
    return INFRA  # row 8


def aggregate(plan_mutants: list, outcomes: dict) -> str:
    """PASS iff every plan mutant has an independent KILLED outcome; else smallest plan index (AV-141)."""
    if type(plan_mutants) is not list or len(plan_mutants) > MAX_MUTANTS:
        raise fail("POLICY_INVALID", "mutations")
    for index, mutant in enumerate(plan_mutants):
        record = outcomes.get(mutant["id"]) or {}
        cls = record.get("class", NOT_APPLIED)  # no independent run → NOT_APPLIED; "detected" has no ingress
        if cls not in CLASSES:
            raise fail("EXECUTION_INTERNAL", "mutations")
        if cls == KILLED:
            continue
        raise fail(CODE_OF[cls], "mutations", ordinal=index)
    return "PASS"


# ---------------------------------------------------------------- orchestration (PKG §8 steps 1-7)


def _check_plan(plan: list, leaves: dict) -> list:
    if type(plan) is not list or not 0 < len(plan) <= MAX_MUTANTS or len({m.get("id") for m in plan}) != len(plan):
        raise fail("POLICY_INVALID", "mutations")
    out = []
    for m in plan:
        try:
            anchor = base64.b64decode(m["anchorBase64"], validate=True)
            replacement = base64.b64decode(m["replacementBase64"], validate=True)
            canonical = base64.b64encode(anchor).decode() == m["anchorBase64"] and \
                base64.b64encode(replacement).decode() == m["replacementBase64"]
        except (KeyError, TypeError, ValueError):
            raise fail("POLICY_INVALID", "mutations") from None
        path, files, named = m.get("path"), m.get("testFiles"), m.get("namedTests")
        if not canonical or not _ID.fullmatch(str(m["id"])) or type(files) is not list or not files \
                or type(named) is not list or not 0 < len(named) <= MAX_NAMED or type(path) is not str \
                or path.startswith("tests/") or path.endswith(".test.ts") or path not in leaves \
                or leaves[path].mode != "100644" or any(f not in leaves or not f.endswith(".test.ts") for f in files) \
                or any(type(n) is not list or len(n) != 5 or n[0] not in files for n in named) \
                or len({key_bytes(n) for n in named}) != len(named):
            raise fail("POLICY_INVALID", "mutations")  # AV-135: never a test/config/tool path
        out.append((m, anchor, replacement))
    return out


def run_mutants(store, snapshot, plan: list, workspace: str, node_modules: str, *, executable=frozenset(),
                image: str | None = None, docker_host=None, deadline: float = worker.MUTANT_DEADLINE, _runner=None) -> list:
    """One fresh clean HEAD per mutant; returns records in plan order (feed them to aggregate)."""
    leaves = snapshot.by_path()
    records = []
    for m, anchor, replacement in _check_plan(plan, leaves):
        applied = apply_mutant(store.read_blob(leaves[m["path"]].oid), anchor, replacement)
        record = {"id": m["id"], "class": NOT_APPLIED, "count": applied["count"], "beforeSha256": applied["beforeSha256"],
                  "afterSha256": applied.get("afterSha256")}
        records.append(record)
        if not applied["applied"]:
            continue  # row 1: no worker start
        run_dir = tempfile.mkdtemp(dir=workspace)
        try:
            root = materialize(store, snapshot, run_dir, executable=executable)
            before = manifest(root)
            _replace(root, m["path"], applied["result"])
            if not single_modify(before, manifest(root), m["path"]):
                continue
            worker.prepare_case(root)
            kw = {"image": image, "docker_host": docker_host, "_runner": _runner}
            obs = {"applied": True, "selectedFiles": m["testFiles"], "namedTests": m["namedTests"],
                   "typecheckOk": worker.run_typecheck(root, node_modules, run_dir, mutant=True, **kw),
                   "timedOut": False, "exitCode": None, "report": None}
            if obs["typecheckOk"]:
                obs.update(worker.run_tests(root, node_modules, run_dir, m["testFiles"], role="mutant", deadline=deadline, **kw))
            record["class"] = classify(obs)
        finally:
            destroy(run_dir)  # cleanup failure raises EXECUTION_IO: no PASS
    return records


def run_mutants_for_test(store, tree: str, plan: list, workspace: str, node_modules: str, node: str, deadline: float) -> dict:
    """TEST ONLY driver entry: real Vitest through worker.LocalRunner (no sandbox), then aggregate."""
    records = run_mutants(store, store.collect_tree(tree), plan, workspace, node_modules, deadline=deadline, _runner=node)
    try:
        verdict = aggregate(plan, {r["id"]: r for r in records})
    except ForgeFail as failure:
        verdict = failure.code
    return {"records": records, "verdict": verdict}
