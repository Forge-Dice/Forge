"""Observation-only transport probes for the independent Task A security tests.

Not part of the verifier. Production modules are imported by the existing test driver.
The subprocess seam emits cat-file frames; os.read is wrapped only to count consumed bytes.
"""

import hashlib
import os
import sys
from types import SimpleNamespace
from unittest.mock import patch

import process
from bootstrap import MAIN_REF, Seams, fetch
from errors import ForgeFail
from objects import ObjectStore
from stage0 import load_from_base


def _frame(payload):
    oid = hashlib.sha1(b"blob " + str(len(payload)).encode() + b"\0" + payload).hexdigest()
    header = f"{oid} blob {len(payload)}\n".encode()
    return oid, header, header + payload + b"\n"


def read_ahead(odb, workspace, limit_kind):
    """A valid frame exceeds exactly one lowered budget; count reads past its header."""
    payload = b"bounded payload"
    oid, header, wire = _frame(payload)
    limits = {"type_limits": {"blob": len(payload) - 1}} if limit_kind == "type" else {
        "budget_bytes": len(payload) - 1
    }
    store = ObjectStore(odb, workspace, **limits)
    real_spawn, real_read = process.spawn, os.read
    stdout_bytes = 0

    def framed_child(_argv, env, cwd=None, stdin=False):
        # One atomic write makes header and content simultaneously readable. The child stays
        # alive, as a real long-lived cat-file process would, until store.close() terminates it.
        script = (
            "import os,sys\n"
            "sys.stdin.buffer.readline()\n"
            f"os.write(1, {wire!r})\n"
            "sys.stdin.buffer.read()\n"
        )
        return real_spawn([sys.executable, "-I", "-B", "-c", script], env, cwd, stdin)

    def observed_read(fd, count):
        nonlocal stdout_bytes
        data = real_read(fd, count)
        if store._proc is not None and fd == store._proc.stdout.fileno():
            stdout_bytes += len(data)
        return data

    try:
        with patch.object(process, "spawn", framed_child), patch.object(os, "read", observed_read):
            try:
                store.read_blob(oid)
                outcome = "PASS"
            except ForgeFail as failure:
                outcome = failure.code
    finally:
        store.close()
    return {"outcome": outcome, "payloadBytesRead": min(len(payload), max(0, stdout_bytes - len(header)))}


def batch_failure(odb, workspace):
    """A complete, correctly hashed frame is followed by an observed nonzero child exit."""
    oid, _header, wire = _frame(b"valid bytes before transport failure")
    store = ObjectStore(odb, workspace)
    real_spawn = process.spawn
    children = []

    def failed_child(_argv, env, cwd=None, stdin=False):
        script = f"import os,sys\nsys.stdin.buffer.readline()\nos.write(1, {wire!r})\nos._exit(23)\n"
        child = real_spawn([sys.executable, "-I", "-B", "-c", script], env, cwd, stdin)
        original_stdin = child.stdin

        class QueryPipe:
            def write(self, data):
                return original_stdin.write(data)

            def flush(self):
                original_stdin.flush()
                # Finish sending the legitimate request, then observe exit 23 before
                # production interprets the buffered frame. No scheduling-dependent race.
                child.wait(timeout=2)

            def close(self):
                original_stdin.close()

        child.stdin = QueryPipe()
        children.append(child)
        return child

    try:
        with patch.object(process, "spawn", failed_child):
            try:
                store.read_blob(oid)
                accepted, code = True, None
            except ForgeFail as failure:
                accepted, code = False, failure.code
    finally:
        store.close()
    return {"accepted": accepted, "code": code, "returncode": children[0].returncode}


def load_graph(store, base, destination):
    """Use the real BASE object/manifest/hash/materialization pipeline without live GETs."""
    trusted = SimpleNamespace(base=base, store=lambda: store)
    return load_from_base(trusted, destination)


def fetch_into(odb, private, remote, expected):
    """Run the real fetch with the allowed local-remote test seam; no process mock."""
    fetch(odb, private, Seams(remote=remote), "refs/heads/main", MAIN_REF, expected, frozenset({MAIN_REF}))
