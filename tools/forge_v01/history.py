"""New-commit chain above BASE and BASE-side ancestry (PKG §3 validateHistory, contract A §4).

validate_history walks the raw first-and-only parent chain from HEAD down to exactly BASE.
Every commit strictly above BASE must have exactly one parent; a second parent is never
ignored, even when the first one reaches BASE (§4.2). BASE itself may be a merge. The count
limit is evaluated before shape, so a 129th new commit is GIT_LIMIT. Every intermediate
snapshot and step diff is handed on; deciding scope on them is Task B's job.

is_in_base_ancestry answers a structural reachability question over all parents (§4.3). It
never proves that anything was accepted.
"""

from __future__ import annotations

from dataclasses import dataclass

from errors import fail
from objects import OBJECT_BUDGET_COUNT, Change, Commit, ObjectStore, Snapshot, collect_changes, is_oid

MAX_NEW_COMMITS = 128


@dataclass(frozen=True)
class History:
    commits: tuple[Commit, ...]  # HEAD first, down to the commit directly above BASE
    snapshots: tuple[Snapshot, ...]  # one per commit, same order
    base_snapshot: Snapshot
    steps: tuple[tuple[Change, ...], ...]  # each commit against its parent's snapshot, same order
    net: tuple[Change, ...]  # HEAD against BASE


def validate_history(store: ObjectStore, base: str, head: str, *, max_commits: int = MAX_NEW_COMMITS) -> History:
    if not isinstance(max_commits, int) or isinstance(max_commits, bool) or not 0 < max_commits <= MAX_NEW_COMMITS:
        raise fail("EXECUTION_INTERNAL", "history")
    if not is_oid(base) or not is_oid(head):
        raise fail("GIT_OBJECT", "history")
    base_commit = store.read_commit(base)
    if head == base:
        raise fail("GIT_HISTORY", "history", head.encode("ascii"))

    chain: list[Commit] = []
    visited = {head}
    current = head
    while True:
        if len(chain) + 1 > max_commits:
            raise fail("GIT_LIMIT", "history", current.encode("ascii"))
        commit = store.read_commit(current)
        if len(commit.parents) != 1:
            raise fail("GIT_HISTORY", "history", current.encode("ascii"))
        chain.append(commit)
        parent = commit.parents[0]
        if parent in visited:
            raise fail("GIT_HISTORY", "history", parent.encode("ascii"))
        if parent == base:
            break
        visited.add(parent)
        current = parent

    base_snapshot = store.collect_tree(base_commit.tree)
    snapshots = tuple(store.collect_tree(commit.tree) for commit in chain)
    parents_snapshots = snapshots[1:] + (base_snapshot,)
    steps = tuple(collect_changes(old, new) for old, new in zip(parents_snapshots, snapshots))
    net = collect_changes(base_snapshot, snapshots[0])
    if not net:
        raise fail("GIT_HISTORY", "history", head.encode("ascii"))
    return History(tuple(chain), snapshots, base_snapshot, steps, net)


def is_in_base_ancestry(store: ObjectStore, base: str, target: str, *, max_commits: int = OBJECT_BUDGET_COUNT) -> bool:
    """True if `target` is `base` or reachable from it over any parent. Structural fact only."""
    if not isinstance(max_commits, int) or isinstance(max_commits, bool) or not 0 < max_commits <= OBJECT_BUDGET_COUNT:
        raise fail("EXECUTION_INTERNAL", "history")
    if not is_oid(base) or not is_oid(target):
        raise fail("GIT_OBJECT", "history")
    visited = {base}
    stack = [base]
    reads = 0
    while stack:
        reads += 1
        if reads > max_commits:
            raise fail("GIT_LIMIT", "history")
        oid = stack.pop()
        commit = store.read_commit(oid)
        if oid == target:
            return True
        for parent in commit.parents:
            if parent not in visited:
                visited.add(parent)
                stack.append(parent)
    return False
