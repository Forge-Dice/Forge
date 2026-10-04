"""Framed Git object reading, commit/tree parsing, snapshots and changes (PKG §3, contract A §3).

One long-lived `git cat-file --batch` process serves all reads of a store. Each frame is
validated in this order: header shape (GIT_OBJECT), declared size against the type limit and
the remaining cumulative budget before any content byte is read (GIT_LIMIT), then content
length, trailing LF and the recomputed object hash (GIT_OBJECT). Only fully valid frames are
interpreted. Git is a transport and object store here, never a scope oracle.
"""

from __future__ import annotations

import hashlib
import os
import re
import select
import time
from dataclasses import dataclass

import process
from errors import ForgeFail, fail
from paths import validate_path, validate_path_set

TYPE_LIMITS = {"commit": 1024 * 1024, "tree": 16 * 1024 * 1024, "blob": 8 * 1024 * 1024}
HEADER_LIMIT = 64
HEADER_MIN = 47  # len("<40 hex> tag 0\n"): the shortest possible frame header
OBJECT_BUDGET_BYTES = 512 * 1024 * 1024
OBJECT_BUDGET_COUNT = 150_000
SNAPSHOT_ENTRIES = 40_000
SNAPSHOT_FILES = 20_000
READ_DEADLINE = 30.0

_OID = re.compile(rb"[0-9a-f]{40}")
_HEADER = re.compile(rb"([0-9a-f]{40}) (commit|tree|blob|tag) (0|[1-9][0-9]{0,9})\n")
_MODE = re.compile(rb"[1-7][0-7]{0,5}")
TREE_MODE = "40000"
GITLINK_MODE = "160000"
BLOB_MODES = frozenset({"100644", "100755", "120000"})


@dataclass(frozen=True)
class Commit:
    oid: str
    tree: str
    parents: tuple[str, ...]


@dataclass(frozen=True)
class Entry:
    mode: str
    name: bytes
    oid: str


@dataclass(frozen=True)
class Leaf:
    path: str
    mode: str
    oid: str


@dataclass(frozen=True)
class Snapshot:
    tree: str
    leaves: tuple[Leaf, ...]  # sorted by path bytes

    def by_path(self) -> dict[str, Leaf]:
        return {leaf.path: leaf for leaf in self.leaves}


@dataclass(frozen=True)
class Change:
    path: str
    kinds: tuple[str, ...]  # ("ADD",) ("DELETE",) ("MODIFY",) ("MODE_CHANGE",) ("MODIFY", "MODE_CHANGE")
    base: Leaf | None
    head: Leaf | None


def is_oid(value) -> bool:
    return isinstance(value, str) and _OID.fullmatch(value.encode("ascii", "replace")) is not None


class ObjectStore:
    """Bounded reader over one private ODB. Budgets may be lowered (tests), never raised."""

    def __init__(
        self,
        odb: str,
        private: str,
        *,
        budget_bytes: int = OBJECT_BUDGET_BYTES,
        budget_count: int = OBJECT_BUDGET_COUNT,
        type_limits: dict | None = None,
        deadline_seconds: float = READ_DEADLINE,
    ):
        limits = dict(TYPE_LIMITS)
        for key, value in (type_limits or {}).items():
            if key not in limits or not isinstance(value, int) or value > limits[key]:
                raise fail("EXECUTION_INTERNAL", "objects")
            limits[key] = value
        if budget_bytes > OBJECT_BUDGET_BYTES or budget_count > OBJECT_BUDGET_COUNT:
            raise fail("EXECUTION_INTERNAL", "objects")
        self.odb = odb
        self.private = private
        self.type_limits = limits
        self.remaining_bytes = budget_bytes
        self.remaining_count = budget_count
        self.deadline = time.monotonic() + deadline_seconds
        self._proc = None
        self._buffer = b""
        self._stderr = 0
        self._trees: dict[str, tuple[Entry, ...]] = {}

    # -- process and framing ---------------------------------------------------------------

    def _start(self):
        if self._proc is None:
            process.prepare_private(self.private)
            argv = process.git_argv(self.odb, "cat-file", "--batch")
            self._proc = process.spawn(argv, process.clean_env("git", self.private), stdin=True)
            os.set_blocking(self._proc.stdout.fileno(), False)
            os.set_blocking(self._proc.stderr.fileno(), False)
        return self._proc

    def close(self) -> None:
        if self._proc is not None:
            proc, self._proc = self._proc, None
            try:
                proc.stdin.close()
            except OSError:
                pass
            process.terminate_group(proc)
            proc.stdout.close()
            proc.stderr.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    def _fill(self, want: int) -> None:
        proc = self._proc
        while len(self._buffer) < want:
            remaining = self.deadline - time.monotonic()
            if remaining <= 0:
                raise fail("EXECUTION_TIMEOUT", "objects")
            ready, _, _ = select.select([proc.stdout, proc.stderr], [], [], min(remaining, 0.25))
            if proc.stderr in ready:
                data = os.read(proc.stderr.fileno(), 65536)
                self._stderr += len(data)
                if self._stderr > process.BATCH_STDERR_LIMIT:
                    raise fail("EXECUTION_IO", "objects")
            if proc.stdout in ready:
                # Never read past `want`: no byte of a frame is consumed before it is admitted.
                data = os.read(proc.stdout.fileno(), min(1 << 20, want - len(self._buffer)))
                if not data:
                    raise fail("GIT_OBJECT", "objects")
                self._buffer += data

    def _take(self, count: int) -> bytes:
        self._fill(count)
        data, self._buffer = self._buffer[:count], self._buffer[count:]
        return data

    def _read_header(self) -> bytes:
        # Read at most up to the header's LF: HEADER_MIN - 1 bytes at once, then byte by byte,
        # so the declared size is checked before any content byte leaves the pipe (AV-179b/c).
        while b"\n" not in self._buffer[:HEADER_LIMIT]:
            if len(self._buffer) >= HEADER_LIMIT:
                raise fail("GIT_OBJECT", "objects", self._buffer[:HEADER_LIMIT])
            self._fill(max(len(self._buffer) + 1, HEADER_MIN - 1))
        end = self._buffer.index(b"\n") + 1
        return self._take(end)

    def read(self, oid: str, expected_type: str) -> bytes:
        """Return the raw content of `oid`, which must have `expected_type`."""
        if not is_oid(oid) or expected_type not in TYPE_LIMITS:
            raise fail("GIT_OBJECT", "objects")
        proc = self._start()
        try:
            proc.stdin.write(oid.encode("ascii") + b"\n")
            proc.stdin.flush()
        except (BrokenPipeError, OSError):
            raise fail("GIT_OBJECT", "objects", oid.encode("ascii")) from None
        try:
            return self._read_frame(oid, expected_type)
        except ForgeFail:
            # The stream position is unknown after any failure; never reuse the process.
            self.close()
            raise

    def _read_frame(self, oid: str, expected_type: str) -> bytes:
        header = self._read_header()
        kind, size = parse_header(header, oid, expected_type)
        if size > self.type_limits[kind] or size > self.remaining_bytes or self.remaining_count < 1:
            raise fail("GIT_LIMIT", "objects", header)
        self.remaining_bytes -= size
        self.remaining_count -= 1
        body = self._take(size + 1)
        if body[-1:] != b"\n":
            raise fail("GIT_OBJECT", "objects", header)
        raw = body[:-1]
        if hashlib.sha1(kind.encode() + b" " + str(size).encode() + b"\0" + raw).hexdigest() != oid:
            raise fail("GIT_OBJECT", "objects", header)
        # An observed nonzero exit or signal is FAIL even after a valid frame (PKG §2).
        if self._proc.poll() not in (None, 0):
            raise fail("GIT_OBJECT", "objects", header)
        return raw

    # -- commits and trees -----------------------------------------------------------------

    def read_commit(self, oid: str) -> Commit:
        raw = self.read(oid, "commit")
        head, sep, _message = raw.partition(b"\n\n")
        if not sep:
            raise fail("GIT_OBJECT", "objects", raw[:256])
        lines = head.split(b"\n")
        tree = None
        parents: list[str] = []
        previous = None  # name of the header a continuation line would extend
        for index, line in enumerate(lines):
            if line.startswith(b" "):
                if previous in (None, b"tree", b"parent"):
                    raise fail("GIT_OBJECT", "objects", line)
                continue
            name, space, value = line.partition(b" ")
            if not space or not name:
                raise fail("GIT_OBJECT", "objects", line)
            if name == b"tree":
                if index != 0 or not _OID.fullmatch(value):
                    raise fail("GIT_OBJECT", "objects", line)
                tree = value.decode("ascii")
            elif name == b"parent":
                if tree is None or previous not in (b"tree", b"parent") or not _OID.fullmatch(value):
                    raise fail("GIT_OBJECT", "objects", line)
                parents.append(value.decode("ascii"))
            previous = name
        if tree is None:
            raise fail("GIT_OBJECT", "objects", head[:256])
        return Commit(oid, tree, tuple(parents))

    def read_tree(self, oid: str) -> tuple[Entry, ...]:
        cached = self._trees.get(oid)
        if cached is not None:
            return cached
        raw = self.read(oid, "tree")
        entries: list[Entry] = []
        seen: set[bytes] = set()
        position = 0
        while position < len(raw):
            space = raw.find(b" ", position)
            if space < 0 or not _MODE.fullmatch(raw[position:space]):
                raise fail("GIT_OBJECT", "objects", raw[position : position + 64])
            nul = raw.find(b"\0", space + 1)
            if nul < 0:
                raise fail("GIT_OBJECT", "objects", raw[position : position + 64])
            name = raw[space + 1 : nul]
            if not name or b"/" in name:
                raise fail("GIT_OBJECT", "objects", name)
            oid_bytes = raw[nul + 1 : nul + 21]
            if len(oid_bytes) != 20:
                raise fail("GIT_OBJECT", "objects", name)
            # Raw duplicate check before any mapping and before the order check (contract A4).
            if name in seen:
                raise fail("GIT_COLLISION", "objects", name)
            seen.add(name)
            entries.append(Entry(raw[position:space].decode("ascii"), name, oid_bytes.hex()))
            position = nul + 21
        keys = [_sort_key(entry) for entry in entries]
        if any(a >= b for a, b in zip(keys, keys[1:])):
            raise fail("GIT_OBJECT", "objects", raw[:64])
        result = tuple(entries)
        self._trees[oid] = result
        return result

    def collect_tree(self, root: str) -> Snapshot:
        """All leaves of a tree with validated paths. Iterative, bounded, per-prefix path checks."""
        leaves: list[Leaf] = []
        # Path trie over ALL entries, empty directories included: folded path -> is directory.
        trie: dict[str, bool] = {}
        entry_count = 0
        stack: list[tuple[bytes, str, int]] = [(b"", root, 0)]
        while stack:
            prefix, tree_oid, depth = stack.pop()
            for entry in self.read_tree(tree_oid):
                entry_count += 1
                if entry_count > SNAPSHOT_ENTRIES:
                    raise fail("GIT_LIMIT", "objects")
                raw_path = prefix + entry.name
                path = validate_path(raw_path)
                folded = path.lower()
                if folded in trie:
                    raise fail("GIT_COLLISION", "objects", raw_path)
                trie[folded] = entry.mode == TREE_MODE
                if entry.mode == TREE_MODE:
                    stack.append((raw_path + b"/", entry.oid, depth + 1))
                    continue
                leaves.append(Leaf(path, entry.mode, entry.oid))
                if len(leaves) > SNAPSHOT_FILES:
                    raise fail("GIT_LIMIT", "objects")
        leaves.sort(key=lambda leaf: leaf.path.encode("ascii"))
        self.check_types([leaf.oid for leaf in leaves if leaf.mode in BLOB_MODES], "blob")
        validate_path_set(leaf.path for leaf in leaves)
        return Snapshot(root, tuple(leaves))

    def check_types(self, oids: list[str], expected_type: str) -> None:
        """Existence and type of many objects in one batch-check run, without reading content."""
        unique = sorted(set(oids))
        if not unique:
            return
        request = "".join(oid + "\n" for oid in unique).encode("ascii")
        argv = process.git_argv(self.odb, "cat-file", "--batch-check=%(objectname) %(objecttype)")
        result = process.run_bounded(
            argv, process.clean_env("git", self.private), deadline_seconds=30.0, stdin_data=request, phase="objects"
        )
        expected = "".join(f"{oid} {expected_type}\n" for oid in unique).encode("ascii")
        if result.returncode != 0 or result.stdout != expected:
            raise fail("GIT_OBJECT", "objects")

    def read_blob(self, oid: str) -> bytes:
        return self.read(oid, "blob")


def parse_header(header: bytes, oid: str, expected_type: str) -> tuple[str, int]:
    """Validate one batch frame header (with its LF): shape, ≤64 bytes, OID and type → GIT_OBJECT."""
    if not isinstance(header, bytes) or len(header) > HEADER_LIMIT:
        raise fail("GIT_OBJECT", "objects", header[:HEADER_LIMIT] if isinstance(header, bytes) else None)
    match = _HEADER.fullmatch(header)
    if match is None or match.group(1).decode("ascii") != oid or match.group(2).decode("ascii") != expected_type:
        raise fail("GIT_OBJECT", "objects", header)
    return expected_type, int(match.group(3))


def read_sizes(store: ObjectStore, requests) -> tuple[int, ...]:
    """Read [oid, type] pairs in order through the store's one batch process; return content sizes."""
    return tuple(len(store.read(oid, kind)) for oid, kind in requests)


def _sort_key(entry: Entry) -> bytes:
    return entry.name + b"/" if entry.mode == TREE_MODE else entry.name


def collect_changes(base: Snapshot, head: Snapshot) -> tuple[Change, ...]:
    """Byte-sorted union of leaf paths. No rename detection: a move is DELETE + ADD."""
    old, new = base.by_path(), head.by_path()
    changes = []
    for path in sorted(set(old) | set(new), key=lambda p: p.encode("ascii")):
        a, b = old.get(path), new.get(path)
        if a is None:
            changes.append(Change(path, ("ADD",), None, b))
        elif b is None:
            changes.append(Change(path, ("DELETE",), a, None))
        else:
            kinds = (("MODIFY",) if a.oid != b.oid else ()) + (("MODE_CHANGE",) if a.mode != b.mode else ())
            if kinds:
                changes.append(Change(path, kinds, a, b))
    return tuple(changes)


def read_commit(store: ObjectStore, oid: str) -> Commit:
    return store.read_commit(oid)


def read_tree(store: ObjectStore, oid: str) -> tuple[Entry, ...]:
    return store.read_tree(oid)


def collect_tree(store: ObjectStore, oid: str) -> Snapshot:
    return store.collect_tree(oid)


def collect_changes_for(store: ObjectStore, base_tree: str, head_tree: str) -> tuple[Change, ...]:
    return collect_changes(store.collect_tree(base_tree), store.collect_tree(head_tree))


def changes_from_leaves(base_leaves, head_leaves) -> tuple[Change, ...]:
    """collect_changes over plain [path, mode, oid] rows (paths already validated by the caller)."""

    def snapshot(rows) -> Snapshot:
        leaves = tuple(sorted((Leaf(p, m, o) for p, m, o in rows), key=lambda leaf: leaf.path.encode("ascii")))
        return Snapshot("", leaves)

    return collect_changes(snapshot(base_leaves), snapshot(head_leaves))


def read_blob(store: ObjectStore, oid: str) -> bytes:
    return store.read_blob(oid)
