"""Byte path grammar and collision checks (PKG §3 path table, contract A §2.1).

V0.1 accepts only portable ASCII paths. Validation works on raw bytes and returns the ASCII
string only after the whole path passed. Nothing here decides scope or protection (Task B).
"""

from __future__ import annotations

from errors import fail

MAX_PATH = 255
MAX_SEGMENT = 100
MAX_DEPTH = 16

_SEGMENT_BYTES = frozenset(b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-")
_WINDOWS_RESERVED = frozenset(
    ["con", "prn", "aux", "nul"] + [f"com{i}" for i in range(1, 10)] + [f"lpt{i}" for i in range(1, 10)]
)


def _segment_ok(segment: bytes) -> bool:
    if not segment or len(segment) > MAX_SEGMENT:
        return False
    if any(byte not in _SEGMENT_BYTES for byte in segment):
        return False
    if segment in (b".", b"..") or segment.startswith(b"-") or segment.endswith(b"."):
        return False
    lowered = segment.lower()
    if lowered == b".git":
        return False
    # Windows device names are reserved with or without an extension (CON, con.ts, Aux.d.ts).
    if lowered.split(b".", 1)[0].decode("ascii") in _WINDOWS_RESERVED:
        return False
    return True


def validate_path(raw: bytes) -> str:
    """Return the validated path as ASCII text or raise GIT_PATH."""
    if not isinstance(raw, (bytes, bytearray)):
        raise fail("EXECUTION_INTERNAL", "paths")
    raw = bytes(raw)
    if not raw or len(raw) > MAX_PATH:
        raise fail("GIT_PATH", "paths", raw)
    segments = raw.split(b"/")
    if len(segments) > MAX_DEPTH:
        raise fail("GIT_PATH", "paths", raw)
    for segment in segments:
        if not _segment_ok(segment):
            raise fail("GIT_PATH", "paths", raw)
    return raw.decode("ascii")


def validate_path_set(paths) -> None:
    """Reject raw duplicates, case collisions on any prefix and file/directory overlaps.

    `paths` are leaf paths that each already passed validate_path. Directories are implied by
    the prefixes of the leaves. Every check runs on the ASCII-lowercase key as well, so `A`
    as a file collides with `a/b`, and `Dir/a` collides with `dir/b`.
    """
    leaves: dict[str, str] = {}  # folded key -> original spelling
    dirs: dict[str, str] = {}
    seen_raw: set[str] = set()
    for path in paths:
        if not isinstance(path, str):
            raise fail("EXECUTION_INTERNAL", "paths")
        if path in seen_raw:
            raise fail("GIT_COLLISION", "paths", path.encode("ascii"))
        seen_raw.add(path)
        segments = path.split("/")
        for depth in range(1, len(segments)):
            prefix = "/".join(segments[:depth])
            folded = prefix.lower()
            if folded in leaves:
                raise fail("GIT_COLLISION", "paths", path.encode("ascii"))
            known = dirs.setdefault(folded, prefix)
            if known != prefix:
                raise fail("GIT_COLLISION", "paths", path.encode("ascii"))
        folded = path.lower()
        if folded in leaves or folded in dirs:
            raise fail("GIT_COLLISION", "paths", path.encode("ascii"))
        leaves[folded] = path
