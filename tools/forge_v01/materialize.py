"""Blob-only materialization into a fresh private root (PKG §5, contract A §2.1, mutant A2).

Never git checkout/worktree/archive. Every path component is opened separately via dir_fd
with O_NOFOLLOW, every leaf is created with O_EXCL|O_NOFOLLOW, and no composed untrusted OS
path is used below the root fd. Any failure discards the whole root and raises EXECUTION_IO
(GIT_LIMIT for the byte budget; object read failures pass through unchanged).
"""

from __future__ import annotations

import os
import secrets
import stat

from errors import ForgeFail, fail
from paths import validate_path

PHASE = "materialize"
BYTE_BUDGET = 128 * 1024 * 1024
REGULAR_MODE = "100644"
EXEC_MODE = "100755"
DESTROY_DEPTH = 64

_DIR_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
_LEAF_FLAGS = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC


def _io(subject: str | None = None) -> ForgeFail:
    return fail("EXECUTION_IO", PHASE, subject.encode("ascii") if subject is not None else None)


def _open_dir(name: str, dir_fd: int | None) -> int:
    """The single directory-open site: never follows a symlink, must yield a directory."""
    fd = os.open(name, _DIR_FLAGS, dir_fd=dir_fd)
    try:
        if not stat.S_ISDIR(os.fstat(fd).st_mode):
            raise _io()
    except BaseException:
        os.close(fd)
        raise
    return fd


def _walk(path: str) -> int:
    """Open the absolute directory `path` component by component from "/" via `_open_dir`.

    No path string is ever handed to the kernel for resolution: a symlink (or non-directory)
    at any component, the final one included, fails with ELOOP/ENOTDIR -> OSError.
    """
    fd = _open_dir("/", None)
    try:
        for name in path.split("/"):
            if name:
                child = _open_dir(name, fd)
                os.close(fd)
                fd = child
    except BaseException:
        os.close(fd)
        raise
    return fd


def _split(path: str) -> tuple[str, str]:
    """Lexically normalized absolute (parent, name); `name` is never empty, "." or ".."."""
    parent, name = os.path.split(os.path.abspath(path))
    if not name:
        raise _io()
    return parent, name


def _check_leaves(snapshot, executable: frozenset) -> list:
    """API precondition before anything is created: valid paths, admissible modes, byte order."""
    if any(not isinstance(leaf.path, str) or not leaf.path.isascii() for leaf in snapshot.leaves):
        raise fail("GIT_PATH", "paths")  # before sorting: the sort key cannot encode non-ASCII paths
    leaves = sorted(snapshot.leaves, key=lambda leaf: leaf.path.encode("ascii"))
    for leaf in leaves:
        if validate_path(leaf.path.encode("ascii")) != leaf.path:
            raise fail("GIT_PATH", "paths", leaf.path.encode("ascii"))
        # Defense in depth only; admissibility of modes is Task B's SCOPE_MODE decision.
        if leaf.mode == REGULAR_MODE:
            continue
        if leaf.mode == EXEC_MODE and leaf.path in executable:
            continue
        raise _io(leaf.path)
    return leaves


def _write_all(fd: int, data: bytes) -> None:
    view = memoryview(data)
    while view:
        written = os.write(fd, view)
        if written <= 0:
            raise _io()
        view = view[written:]


def _write_leaf(store, rootfd: int, leaf, mode: int, hooks: dict, budget: list) -> None:
    segments = leaf.path.split("/")
    opened: list[int] = []
    try:
        parent = rootfd
        for depth, name in enumerate(segments[:-1]):
            try:
                os.mkdir(name, 0o700, dir_fd=parent)
                created = True
            except FileExistsError:
                created = False
            if created and "after_parent_mkdir" in hooks:
                hooks["after_parent_mkdir"](parent, name, "/".join(segments[: depth + 1]))
            parent = _open_dir(name, parent)
            opened.append(parent)
        name = segments[-1]
        if "before_leaf_open" in hooks:
            hooks["before_leaf_open"](parent, name, leaf.path)
        fd = os.open(name, _LEAF_FLAGS, 0o600, dir_fd=parent)
        opened.append(fd)
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size != 0:
            raise _io(leaf.path)
        data = store.read_blob(leaf.oid)  # the store bounds the size and re-hashes the bytes
        if len(data) > budget[0]:
            raise fail("GIT_LIMIT", PHASE, leaf.path.encode("ascii"))
        budget[0] -= len(data)
        _write_all(fd, data)
        os.fchmod(fd, mode)
        os.fsync(fd)
    finally:
        for fd in reversed(opened):
            os.close(fd)


def materialize(store, snapshot, destination: str, *, executable=frozenset(), byte_budget: int = BYTE_BUDGET, _hooks=None) -> str:
    """Write `snapshot` as a fresh read-only regular-file tree inside `destination`; return its root.

    `executable` names the 100755 paths the caller asserts are unchanged from BASE.
    """
    # _hooks is test-only (simulates a racing attacker); production callers never pass it.
    hooks = dict(_hooks or {})
    if not isinstance(byte_budget, int) or byte_budget < 0 or byte_budget > BYTE_BUDGET:
        raise fail("EXECUTION_INTERNAL", PHASE)
    if not isinstance(executable, frozenset):
        raise fail("EXECUTION_INTERNAL", PHASE)
    leaves = _check_leaves(snapshot, executable)
    base = os.path.abspath(destination)
    name = secrets.token_hex(16)
    try:
        destfd = _walk(base)  # a symlink at the destination or any ancestor -> EXECUTION_IO
    except OSError:
        raise _io() from None
    try:
        os.mkdir(name, 0o700, dir_fd=destfd)
    except OSError:
        os.close(destfd)
        raise _io() from None
    root = os.path.join(base, name)
    try:
        try:
            rootfd = _open_dir(name, destfd)
        finally:
            os.close(destfd)
        try:
            os.fchmod(rootfd, 0o700)
            budget = [byte_budget]
            for leaf in leaves:
                mode = 0o555 if leaf.mode == EXEC_MODE else 0o444
                try:
                    _write_leaf(store, rootfd, leaf, mode, hooks, budget)
                except OSError:
                    raise _io(leaf.path) from None
        finally:
            os.close(rootfd)
    except BaseException as error:
        try:
            destroy(root)
        except ForgeFail:
            raise _io() from error  # cleanup failure outranks: no PASS, runner is discarded
        if isinstance(error, OSError):
            raise _io() from None
        raise
    return root


def _clear(fd: int, depth: int) -> None:
    if depth > DESTROY_DEPTH:
        raise _io()
    os.fchmod(fd, 0o700)
    with os.scandir(fd) as entries:
        listing = [(entry.name, entry.is_dir(follow_symlinks=False)) for entry in entries]
    for name, is_dir in listing:
        if is_dir:
            child = _open_dir(name, fd)
            try:
                _clear(child, depth + 1)
            finally:
                os.close(child)
            os.rmdir(name, dir_fd=fd)
        else:
            os.unlink(name, dir_fd=fd)  # files and symlinks alike; a symlink is never followed


def destroy(root: str) -> None:
    """fd-safe recursive removal of a known root; symlinks inside are unlinked, never followed.

    The root is reached from "/" one O_NOFOLLOW component at a time, so a symlink at the
    root or any ancestor is EXECUTION_IO and nothing is deleted.
    """
    try:
        parent, name = _split(root)
        parentfd = _walk(parent)
        try:
            rootfd = _open_dir(name, parentfd)
            try:
                _clear(rootfd, 0)
            finally:
                os.close(rootfd)
            os.rmdir(name, dir_fd=parentfd)
        finally:
            os.close(parentfd)
    except OSError:
        raise _io() from None


def materialize_tree(store, tree: str, destination: str, **kwargs) -> str:
    return materialize(store, store.collect_tree(tree), destination, **kwargs)


# -- test-only entry points (driver-callable); they simulate a racing attacker ---------------


def _materialize_with_symlink_race(store, tree: str, destination: str, victim_parent: str, link_target: str) -> str:
    """TEST ONLY: replace `victim_parent` by a symlink to `link_target` right after its mkdir."""

    def swap(parent_fd: int, name: str, path: str) -> None:
        if path == victim_parent:
            os.rmdir(name, dir_fd=parent_fd)
            os.symlink(link_target, name, dir_fd=parent_fd)

    return materialize_tree(store, tree, destination, _hooks={"after_parent_mkdir": swap})


def _materialize_with_existing_leaf(store, tree: str, destination: str, victim_leaf: str) -> str:
    """TEST ONLY: plant a file at `victim_leaf` right before the leaf is created."""

    def plant(parent_fd: int, name: str, path: str) -> None:
        if path == victim_leaf:
            os.close(os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600, dir_fd=parent_fd))

    return materialize_tree(store, tree, destination, _hooks={"before_leaf_open": plant})
