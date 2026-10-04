"""Local ODB layout check for the private bootstrap repository (PKG §2 steps 3-6, contract A §5).

Refs are enumerated twice: by Git (`for-each-ref`) and directly from the filesystem (loose
refs below refs/ and packed-refs), without following symlinks. `for-each-ref` silently skips
broken or dangling refs, so only the filesystem view proves that nothing outside the allowlist
exists. Any ref that is not an allowed name with a plain 40-hex value, any symlink, symref,
unreadable or malformed entry, or any disagreement between both views is GIT_LAYOUT.
"""

from __future__ import annotations

import os
import re
import stat

import process
from errors import fail

ALLOWED_CONFIG = (
    ("core.repositoryformatversion", "0"),
    ("core.filemode", "true"),
    ("core.bare", "true"),
)
FORBIDDEN_FILES = ("info/grafts", "shallow", "objects/info/alternates", "objects/info/http-alternates")
REF_FILE_LIMIT = 4096
PACKED_REFS_LIMIT = 1024 * 1024
_LOOSE = re.compile(rb"([0-9a-f]{40})\n")
_PACKED = re.compile(rb"([0-9a-f]{40}) (refs/[\x21-\x7e]+)")
_PEELED = re.compile(rb"\^[0-9a-f]{40}")


def _layout() -> Exception:
    return fail("GIT_LAYOUT", "bootstrap")


def _read_regular(path: str, limit: int) -> bytes:
    """Read a regular file without following a symlink at the leaf; parents are checked by the walk."""
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC | os.O_NONBLOCK)
    except OSError:
        raise _layout() from None
    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            raise _layout()
        data = b""
        while len(data) <= limit:
            chunk = os.read(fd, limit + 1 - len(data))
            if not chunk:
                break
            data += chunk
    except OSError:
        raise _layout() from None
    finally:
        os.close(fd)
    if len(data) > limit:
        raise _layout()
    return data


def _loose_refs(odb: str) -> dict[str, str]:
    refs: dict[str, str] = {}
    pending = ["refs"]
    while pending:
        rel = pending.pop()
        try:
            mode = os.lstat(os.path.join(odb, rel)).st_mode
        except OSError:
            raise _layout() from None
        if stat.S_ISDIR(mode):
            try:
                names = os.listdir(os.path.join(odb, rel))
            except OSError:
                raise _layout() from None
            pending.extend(f"{rel}/{name}" for name in names)
        elif stat.S_ISREG(mode):
            match = _LOOSE.fullmatch(_read_regular(os.path.join(odb, rel), REF_FILE_LIMIT))
            if match is None:  # symref, broken value or anything else Git would skip
                raise _layout()
            refs[rel] = match.group(1).decode("ascii")
        else:  # symlink, fifo, device, socket
            raise _layout()
    return refs


def _packed_refs(odb: str) -> dict[str, str]:
    path = os.path.join(odb, "packed-refs")
    if not os.path.lexists(path):
        return {}
    refs: dict[str, str] = {}
    lines = _read_regular(path, PACKED_REFS_LIMIT).split(b"\n")
    if lines[-1] != b"":
        raise _layout()
    last = None
    for index, line in enumerate(lines[:-1]):
        if index == 0 and line.startswith(b"# pack-refs with:"):
            continue
        if _PEELED.fullmatch(line) and last is not None:
            last = None
            continue
        match = _PACKED.fullmatch(line)
        if match is None or match.group(2).decode("ascii") in refs:
            raise _layout()
        last = match.group(2).decode("ascii")
        refs[last] = match.group(1).decode("ascii")
    return refs


def filesystem_refs(odb: str) -> dict[str, str]:
    """All refs as stored on disk; a loose ref shadows a packed one, exactly as in Git."""
    try:
        mode = os.lstat(os.path.join(odb, "refs")).st_mode
    except OSError:
        raise _layout() from None
    if not stat.S_ISDIR(mode):
        raise _layout()
    refs = _packed_refs(odb)
    refs.update(_loose_refs(odb))
    return refs


def list_refs(odb: str, private: str) -> dict[str, str]:
    result = process.run_git(odb, private, "for-each-ref", "--format=%(objectname) %(refname)", phase="bootstrap")
    if result.returncode != 0:
        raise _layout()
    refs = {}
    for line in result.stdout.decode("ascii", "replace").splitlines():
        oid, _, name = line.partition(" ")
        refs[name] = oid
    return refs


def check_layout(odb: str, private: str, allowed_refs: frozenset) -> dict[str, str]:
    """Reject anything a fresh ODB plus our own fetches would not contain. Returns the refs."""
    config = process.run_bounded(
        [process.GIT, "config", "--file", os.path.join(odb, "config"), "--list", "--null"],
        process.clean_env("git", private), deadline_seconds=10.0, phase="bootstrap",
    )
    if config.returncode != 0:
        raise _layout()
    entries = tuple(tuple(item.split(b"\n", 1)) for item in config.stdout.split(b"\0") if item)
    if sorted(entries) != sorted((k.encode(), v.encode()) for k, v in ALLOWED_CONFIG):
        raise _layout()
    for name in FORBIDDEN_FILES:
        if os.path.lexists(os.path.join(odb, name)):
            raise _layout()
    hooks = os.path.join(odb, "hooks")
    if os.path.lexists(hooks) and (os.path.islink(hooks) or os.listdir(hooks)):
        raise _layout()
    pack_dir = os.path.join(odb, "objects", "pack")
    if os.path.isdir(pack_dir) and any(name.endswith(".promisor") for name in os.listdir(pack_dir)):
        raise _layout()
    # One allowlist covers loose and packed refs alike, refs/replace/* included (mutant A1 site).
    on_disk = filesystem_refs(odb)
    for name in on_disk:
        if name not in allowed_refs:
            raise _layout()
    refs = list_refs(odb, private)
    if refs != on_disk:  # Git skipped or invented a ref the filesystem view disagrees with
        raise _layout()
    return refs
