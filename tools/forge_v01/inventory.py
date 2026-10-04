"""Strict worker-report parser and inventory comparison (PKG §7, contract B §3/§4).

The only inventory evidence is the frame written by the trusted inventory-reporter.mjs:

    b"FORGE-REPORT-V1 <decimal payload length>\\n" + <UTF-8 JSON payload>

header at most 64 bytes, payload at most 8 MiB. parse_report checks the frame grammar, the
exact length, strict JSON (no duplicate keys, no NaN/Infinity, no floats) and the exact schema;
every violation is TEST_INVENTORY. compare_inventory applies the PKG §7 HEAD rule.
No untrusted text (titles, error names) ever leaves this module in a failure.
"""

from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass

from errors import ForgeFail, fail
from paths import validate_path

PAYLOAD_LIMIT = 8 * 1024 * 1024
HEADER_LIMIT = 64
MAGIC = b"FORGE-REPORT-V1 "
PROJECT = "forge-v01"
MAX_TESTS = 50_000
MAX_TITLE_BYTES = 4096
MAX_DEPTH = 32
STATUSES = frozenset({"passed", "failed", "skipped", "todo"})
ERROR_KINDS = frozenset({"collection", "suite", "hook", "unhandled"})
REASONS = frozenset({"passed", "failed", "interrupted"})
PHASE = "inventory"


def InventoryFail(code: str) -> ForgeFail:  # noqa: N802 (kept name for call sites)
    return fail(code, PHASE)


def _bad() -> ForgeFail:
    return InventoryFail("TEST_INVENTORY")


@dataclass(frozen=True)
class FileRow:
    file: str
    project: str
    collection: str


@dataclass(frozen=True)
class TestRow:
    id: tuple  # (file, project, ancestors tuple, title, occurrence)
    status: str


@dataclass(frozen=True)
class ErrorRow:
    kind: str
    testIdentity: tuple | None


@dataclass(frozen=True)
class Inventory:
    format: int
    files: tuple
    tests: tuple
    errors: tuple
    reason: str


@dataclass(frozen=True)
class Failure:
    id: tuple
    errorNames: tuple


@dataclass(frozen=True)
class Report:
    inventory: Inventory
    failures: tuple


# ---------------------------------------------------------------- strict JSON


def _pairs(pairs):
    out = {}
    for key, value in pairs:
        if key in out:
            raise ValueError("duplicate key")
        out[key] = value
    return out


def _reject(_text):
    raise ValueError("non-integer number")


def _loads(payload: bytes):
    try:
        text = payload.decode("utf-8", errors="strict")
        return json.loads(text, object_pairs_hook=_pairs, parse_float=_reject, parse_constant=_reject)
    except (UnicodeError, ValueError, RecursionError):
        raise _bad() from None


def key_bytes(value) -> bytes:
    """Canonical sort key: the same compact JSON bytes the reporter's JSON.stringify yields."""
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


# ---------------------------------------------------------------- schema


def _obj(value, keys: tuple) -> dict:
    if type(value) is not dict or set(value) != set(keys):
        raise _bad()
    return value


def _text(value, limit: int = MAX_TITLE_BYTES) -> str:
    if type(value) is not str:
        raise _bad()
    try:
        size = len(value.encode("utf-8", errors="strict"))  # rejects lone surrogates
    except UnicodeError:
        raise _bad() from None
    if size > limit:
        raise _bad()
    return value


def _int(value, low: int, high: int) -> int:
    if type(value) is not int or not low <= value <= high:
        raise _bad()
    return value


def _list(value, limit: int) -> list:
    if type(value) is not list or len(value) > limit:
        raise _bad()
    return value


def _file(value) -> str:
    if type(value) is not str:
        raise _bad()
    try:
        return validate_path(value.encode("ascii"))
    except (UnicodeError, ForgeFail):
        raise _bad() from None


def _identity(value) -> tuple:
    items = _list(value, 5)
    if len(items) != 5 or type(items[1]) is not str or items[1] != PROJECT:
        raise _bad()
    file, project, ancestors, title, occurrence = items
    ancestors = tuple(_text(a) for a in _list(ancestors, MAX_DEPTH))
    return (_file(file), project, ancestors, _text(title), _int(occurrence, 0, MAX_TESTS - 1))


def _strictly_sorted(keys: list) -> None:
    if any(a >= b for a, b in zip(keys, keys[1:])):
        raise _bad()


def _inventory(value) -> Inventory:
    raw = _obj(value, ("format", "files", "tests", "errors", "reason"))
    _int(raw["format"], 1, 1)
    files = []
    for row in _list(raw["files"], MAX_TESTS):
        row = _obj(row, ("file", "project", "collection"))
        if row["project"] != PROJECT or row["collection"] not in ("ok", "error"):
            raise _bad()
        files.append(FileRow(_file(row["file"]), PROJECT, row["collection"]))
    _strictly_sorted([f.file.encode("ascii") for f in files])
    known = {f.file for f in files}
    tests = []
    for row in _list(raw["tests"], MAX_TESTS):
        row = _obj(row, ("id", "status"))
        if type(row["status"]) is not str or row["status"] not in STATUSES:
            raise _bad()
        identity = _identity(row["id"])
        if identity[0] not in known:
            raise _bad()
        tests.append(TestRow(identity, row["status"]))
    _strictly_sorted([key_bytes(t.id) for t in tests])  # also rejects duplicate identities
    occurrences = Counter(t.id[:4] for t in tests)
    if any(t.id[4] >= occurrences[t.id[:4]] for t in tests):  # unique + bounded → contiguous 0..n-1
        raise _bad()
    ids = {t.id for t in tests}
    errors = []
    for row in _list(raw["errors"], MAX_TESTS):
        row = _obj(row, ("kind", "testIdentity"))
        if type(row["kind"]) is not str or row["kind"] not in ERROR_KINDS:
            raise _bad()
        identity = None if row["testIdentity"] is None else _identity(row["testIdentity"])
        if identity is not None and identity not in ids:
            raise _bad()
        errors.append(ErrorRow(row["kind"], identity))
    error_keys = [key_bytes({"kind": e.kind, "testIdentity": e.testIdentity}) for e in errors]
    if error_keys != sorted(error_keys):
        raise _bad()
    if type(raw["reason"]) is not str or raw["reason"] not in REASONS:
        raise _bad()
    return Inventory(1, tuple(files), tuple(tests), tuple(errors), raw["reason"])


def as_inventory(value) -> Inventory:
    """An Inventory from parse_report, or its JSON form validated by the same strict schema."""
    if isinstance(value, Inventory):
        return value
    return _inventory(value)


def _report(value) -> Report:
    raw = _obj(value, ("format", "inventory", "failures"))
    _int(raw["format"], 1, 1)
    inventory = _inventory(raw["inventory"])
    failed = {t.id for t in inventory.tests if t.status == "failed"}
    failures = []
    for row in _list(raw["failures"], MAX_TESTS):
        row = _obj(row, ("id", "errorNames"))
        names = tuple(_text(n) for n in _list(row["errorNames"], 64))
        failures.append(Failure(_identity(row["id"]), names))
    _strictly_sorted([key_bytes(f.id) for f in failures])
    if {f.id for f in failures} != failed:  # exactly one failure row per failed test
        raise _bad()
    return Report(inventory, tuple(failures))


def parse_report(raw: bytes, *, payload_limit: int = PAYLOAD_LIMIT) -> Report:
    if type(raw) is not bytes or len(raw) > HEADER_LIMIT + payload_limit:
        raise _bad()
    end = raw.find(b"\n", 0, HEADER_LIMIT)
    if end < 0 or not raw.startswith(MAGIC):
        raise _bad()
    digits = raw[len(MAGIC):end]
    if not digits or not all(0x30 <= c <= 0x39 for c in digits):
        raise _bad()
    if len(digits) > 1 and digits[0] == 0x30:
        raise _bad()
    length = int(digits)
    if length > payload_limit or len(raw) != end + 1 + length:
        raise _bad()
    return _report(_loads(raw[end + 1:]))


# ---------------------------------------------------------------- comparison


def _complete(inventory: Inventory) -> bool:
    """No errors, every file collected with tests, and a run end reason that matches."""
    if inventory.errors or any(f.collection != "ok" for f in inventory.files):
        return False
    if {t.id[0] for t in inventory.tests} != {f.file for f in inventory.files}:
        return False
    failed = any(t.status == "failed" for t in inventory.tests)
    return inventory.reason == ("failed" if failed else "passed")


def check_baseline(base) -> Inventory:
    """BASE must be schema-valid, complete and entirely passed; otherwise TEST_BASELINE."""
    try:
        base = as_inventory(base)
    except ForgeFail:
        raise InventoryFail("TEST_BASELINE") from None
    if not base.tests or not _complete(base) or any(t.status != "passed" for t in base.tests):
        raise InventoryFail("TEST_BASELINE")
    return base


def missing_base_identities(base: Inventory, head: Inventory) -> Counter:
    """The one multiset comparison: BASE identities not covered by HEAD (empty = contained)."""
    return Counter(t.id for t in base.tests) - Counter(t.id for t in head.tests)


def compare_inventory(base, head, added_test_files: list, expected_head_files: list) -> None:
    """PKG §7 HEAD rule. Inventory form problems before status problems."""
    base = check_baseline(base)
    head = as_inventory(head)
    if not _complete(head):
        raise _bad()
    if [f.file for f in head.files] != sorted(set(expected_head_files), key=lambda p: p.encode("utf-8")):
        raise _bad()
    if missing_base_identities(base, head):
        raise _bad()
    base_ids = {t.id for t in base.tests}
    added = set(added_test_files)
    if any(t.id not in base_ids and t.id[0] not in added for t in head.tests):
        raise _bad()
    if any(t.status != "passed" for t in head.tests):
        raise InventoryFail("TEST_STATUS")
