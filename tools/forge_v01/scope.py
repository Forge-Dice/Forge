"""Exact scope, protected paths, freeze and modes over A's history facts (PKG §4 phases 6-8, contract B §7).

Every intermediate step (each new commit against its parent) AND the net diff HEAD-vs-BASE is
checked with the same rules; a violation that a later commit reverts still fails. Creation and
modification are judged against BASE presence. Scope membership is exact string equality at
exactly one site; there is no prefix rule and no coordination exception. Protection classes
are path-prefix and file-name classes; they never grant permission by themselves.

Per change, the first matching rule decides: mode (SCOPE_MODE) → DELETE (SCOPE_PATH) →
protected/frozen (SCOPE_PROTECTED) → path class, exact membership, create/modify kind
(SCOPE_PATH). The primary failure over all changes is the smallest (rule rank, code enum
order, raw path bytes, step ordinal); steps are numbered oldest first, the net diff last.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from errors import CODES, fail
from objects import Leaf, Snapshot, collect_changes
from policy import TCB_PREFIXES

PROTECTED_ROOT = frozenset({"package.json", "package-lock.json", "npm-shrinkwrap.json", "tsconfig.json"})
PROTECTED_NAMES = frozenset({".npmrc", ".gitattributes", ".gitmodules", ".env"})
TOOL_CONFIG = re.compile(
    r"(?:(?:ts|js)config(?:\.[a-z0-9_-]+)*\.json"
    r"|(?:vitest|vite|rollup|rolldown|esbuild|babel|eslint|prettier|postcss|jest|webpack|tsup)\.(?:config|workspace)(?:\.[a-z0-9_-]+)+"
    r"|\.(?:babelrc|swcrc|eslintrc|prettierrc|browserslistrc|nvmrc|node-version|yarnrc|npmrc|env)(?:\.[a-z0-9_-]+)*"
    r"|package(?:-lock)?\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-(?:lock|workspace)\.yaml|deno\.jsonc?|bunfig\.toml)"
)
RANK = {"mode": 0, "delete": 1, "protected": 2, "path": 3}


@dataclass(frozen=True)
class Context:
    profile: str
    create: frozenset
    modify: frozenset
    scope_paths: tuple  # create + modify, contract order
    added_tests: frozenset
    approved_tcb: frozenset
    contract_path: str


def make_context(plan: dict, contract_scope: dict, profile: str, contract_path: str) -> Context:
    if profile not in ("DEV", "OWNER_OPS"):
        raise fail("EXECUTION_INTERNAL", "scope")
    create, modify = tuple(contract_scope["create"]), tuple(contract_scope["modify"])
    added, approved = frozenset(plan["addedTestFiles"]), frozenset(plan["approvedTcbPaths"])
    if not added <= set(create) or not approved <= set(create + modify):
        raise fail("CONTRACT_BINDING", "policy")
    return Context(profile, frozenset(create), frozenset(modify), create + modify, added, approved, contract_path)


def _mode_ok(head: Leaf, base: Leaf | None) -> bool:
    if head.mode == "100644":
        return True
    return head.mode == "100755" and base is not None and base.mode == "100755"


def _protected(path: str, base: Leaf | None, ctx: Context) -> bool:
    low = path.lower()
    name = low.rpartition("/")[2]
    if low == ctx.contract_path.lower() or (low.startswith("tests/") and base is not None):
        return True
    if low in PROTECTED_ROOT or name in PROTECTED_NAMES or name.startswith(".env."):
        return True
    if low.startswith(TCB_PREFIXES):
        return ctx.profile != "OWNER_OPS" or path not in ctx.approved_tcb
    return TOOL_CONFIG.fullmatch(name) is not None


def _in_class(path: str, base: Leaf | None, ctx: Context) -> bool:
    if path.startswith("tests/"):
        return base is None and path.endswith(".test.ts") and path in ctx.added_tests
    if ctx.profile == "OWNER_OPS":
        return path in ctx.approved_tcb
    return path.startswith("src/") and not path.startswith("src/forge/") and path.endswith(".ts") and not path.endswith(".test.ts")


def classify(change, base: Leaf | None, ctx: Context) -> tuple[int, str] | None:
    """First failing rule for one change, or None. `base` is the BASE leaf of the path."""
    path = change.path
    if "MODE_CHANGE" in change.kinds or (change.head is not None and not _mode_ok(change.head, base)):
        return RANK["mode"], "SCOPE_MODE"
    if "DELETE" in change.kinds:
        return RANK["delete"], "SCOPE_PATH"
    if _protected(path, base, ctx):
        return RANK["protected"], "SCOPE_PROTECTED"
    if not _in_class(path, base, ctx):
        return RANK["path"], "SCOPE_PATH"
    if not any(path == entry for entry in ctx.scope_paths):
        return RANK["path"], "SCOPE_PATH"
    if (path in ctx.create and base is not None) or (path in ctx.modify and base is None):
        return RANK["path"], "SCOPE_PATH"
    return None


def scope_failures(base_snapshot: Snapshot, steps, net, ctx: Context) -> list[tuple[int, int, bytes, int]]:
    """All (rank, code index, path bytes, ordinal) violations; steps oldest first, net last."""
    base = base_snapshot.by_path()
    out = []
    for ordinal, changes in enumerate(list(steps) + [net]):
        for change in changes:
            failure = classify(change, base.get(change.path), ctx)
            if failure is not None:
                out.append((failure[0], CODES.index(failure[1]), change.path.encode("ascii"), ordinal))
    return sorted(out)


def _decide(base_snapshot: Snapshot, steps, net, ctx: Context) -> None:
    failures = scope_failures(base_snapshot, steps, net, ctx)
    if failures:
        _rank, code, path, ordinal = failures[0]
        raise fail(CODES[code], "scope", path, ordinal)


def check_scope(history, base_snapshot: Snapshot, plan: dict, contract_scope: dict, profile: str, contract_path: str) -> None:
    """Phases 6-8 over A's History (history.steps are HEAD first; checked oldest first)."""
    ctx = make_context(plan, contract_scope, profile, contract_path)
    _decide(base_snapshot, tuple(reversed(history.steps)), history.net, ctx)


def check_scope_for(store, base: str, head: str, plan: dict, contract_scope: dict, profile: str, contract_path: str) -> int:
    """Driver entry over real objects: validate_history, then check_scope; returns the net change count."""
    from history import validate_history

    history = validate_history(store, base, head)
    check_scope(history, history.base_snapshot, plan, contract_scope, profile, contract_path)
    return len(history.net)


def check_scope_rows(base_rows, snapshot_rows, plan: dict, contract_scope: dict, profile: str, contract_path: str) -> int:
    """Pure entry over [path, mode, oid] rows: BASE plus new snapshots oldest first (paths pre-validated)."""

    def snap(rows) -> Snapshot:
        return Snapshot("", tuple(sorted((Leaf(p, m, o) for p, m, o in rows), key=lambda leaf: leaf.path.encode("ascii"))))

    base = snap(base_rows)
    chain = [base] + [snap(rows) for rows in snapshot_rows]
    steps = [collect_changes(old, new) for old, new in zip(chain, chain[1:])]
    net = collect_changes(base, chain[-1])
    _decide(base, steps, net, make_context(plan, contract_scope, profile, contract_path))
    return len(net)
