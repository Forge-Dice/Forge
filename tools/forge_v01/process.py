"""Bounded subprocess primitives and clean environments (PKG §2, contract A §3).

Every child runs with argv only (never a shell), in its own process group, from an
environment built from an empty mapping. Deadlines use the monotonic clock. On deadline or
budget overflow the whole group gets SIGTERM, at most 1 s grace, SIGKILL, then wait.
Descendants that escape with setsid are explicitly not covered here (contract A §3).
"""

from __future__ import annotations

import os
import selectors
import signal
import subprocess
import tempfile
import time
from dataclasses import dataclass

from errors import fail

GIT = "/usr/bin/git"
DIAGNOSTIC_LIMIT = 8 * 1024 * 1024  # combined stdout+stderr of a diagnostic process
BATCH_STDERR_LIMIT = 1024 * 1024
GRACE_SECONDS = 1.0

# Fixed `-c key=value` pairs for every git invocation (PKG §2 fixed-config-argv).
GIT_CONFIG = (
    ("core.hooksPath", "/dev/null"),
    ("core.fsmonitor", "false"),
    ("credential.helper", ""),
    ("credential.interactive", "false"),
    ("http.extraHeader", ""),
    ("http.followRedirects", "false"),
    ("protocol.allow", "never"),
    ("protocol.https.allow", "always"),
    ("fetch.fsckObjects", "true"),
    ("transfer.fsckObjects", "true"),
    ("fetch.writeCommitGraph", "false"),
    ("gc.auto", "0"),
    ("maintenance.auto", "false"),
    ("submodule.recurse", "false"),
)


def git_argv(odb: str, *args: str, extra_config: tuple[tuple[str, str], ...] = ()) -> list[str]:
    argv = [GIT, "-C", odb]
    for key, value in GIT_CONFIG + extra_config:
        argv += ["-c", f"{key}={value}"]
    return argv + list(args)


def clean_env(kind: str, private: str) -> dict[str, str]:
    """Environment for `kind` ("git" or "python"), built from an empty mapping.

    `private` is a private directory that holds HOME, XDG_CONFIG_HOME and TMPDIR. Nothing is
    inherited from os.environ.
    """
    if kind not in ("git", "python"):
        raise fail("EXECUTION_INTERNAL", "process")
    env = {
        "PATH": "/usr/bin:/bin",
        "HOME": os.path.join(private, "home"),
        "XDG_CONFIG_HOME": os.path.join(private, "xdg"),
        "TMPDIR": os.path.join(private, "tmp"),
        "LANG": "C",
        "LC_ALL": "C",
        "TZ": "UTC",
    }
    if kind == "git":
        env.update(
            {
                "GIT_CONFIG_NOSYSTEM": "1",
                "GIT_CONFIG_SYSTEM": "/dev/null",
                "GIT_CONFIG_GLOBAL": "/dev/null",
                "GIT_NO_REPLACE_OBJECTS": "1",
                "GIT_NO_LAZY_FETCH": "1",
                "GIT_TERMINAL_PROMPT": "0",
                "GIT_ASKPASS": "/bin/false",
                "GIT_OPTIONAL_LOCKS": "0",
            }
        )
    return env


def prepare_private(private: str) -> None:
    for name in ("home", "xdg", "tmp"):
        os.makedirs(os.path.join(private, name), mode=0o700, exist_ok=True)


@dataclass(frozen=True)
class Completed:
    returncode: int
    stdout: bytes
    stderr: bytes


def terminate_group(proc: subprocess.Popen) -> None:
    """SIGTERM the process group, wait at most GRACE_SECONDS, SIGKILL, wait."""
    try:
        os.killpg(proc.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    deadline = time.monotonic() + GRACE_SECONDS
    while proc.poll() is None and time.monotonic() < deadline:
        time.sleep(0.01)
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    proc.wait()


def spawn(argv: list[str], env: dict[str, str], cwd: str | None = None, stdin=False) -> subprocess.Popen:
    """stdin: False (devnull), True (pipe) or an open file object."""
    return subprocess.Popen(
        argv,
        env=env,
        cwd=cwd,
        stdin=subprocess.PIPE if stdin is True else (subprocess.DEVNULL if stdin is False else stdin),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        start_new_session=True,
        close_fds=True,
        shell=False,
    )


def run_bounded(
    argv: list[str],
    env: dict[str, str],
    *,
    deadline_seconds: float,
    cwd: str | None = None,
    output_limit: int = DIAGNOSTIC_LIMIT,
    stdin_data: bytes | None = None,
    phase: str = "process",
) -> Completed:
    """Run argv to completion under a deadline and a combined stdout+stderr budget.

    Deadline → EXECUTION_TIMEOUT, output overflow → EXECUTION_IO. The exit code is returned
    as observed; interpreting it is the caller's job.
    """
    if not argv or not isinstance(argv, list) or not all(isinstance(a, str) for a in argv):
        raise fail("EXECUTION_INTERNAL", phase)
    deadline = time.monotonic() + deadline_seconds
    stdin = False
    if stdin_data is not None:
        # A spooled temp file instead of a pipe: no writer thread, no pipe deadlock.
        stdin = tempfile.TemporaryFile()
        stdin.write(stdin_data)
        stdin.seek(0)
    try:
        proc = spawn(argv, env, cwd, stdin)
    finally:
        if stdin is not False:
            stdin.close()
    chunks = {"stdout": [], "stderr": []}
    total = 0
    sel = selectors.DefaultSelector()
    sel.register(proc.stdout, selectors.EVENT_READ, "stdout")
    sel.register(proc.stderr, selectors.EVENT_READ, "stderr")
    try:
        while sel.get_map():
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise fail("EXECUTION_TIMEOUT", phase)
            for key, _ in sel.select(timeout=min(remaining, 0.25)):
                data = os.read(key.fileobj.fileno(), 65536)
                if not data:
                    sel.unregister(key.fileobj)
                    continue
                total += len(data)
                if total > output_limit:
                    raise fail("EXECUTION_IO", phase)
                chunks[key.data].append(data)
        while proc.poll() is None:
            if time.monotonic() >= deadline:
                raise fail("EXECUTION_TIMEOUT", phase)
            time.sleep(0.005)
    except BaseException:
        terminate_group(proc)
        raise
    finally:
        sel.close()
        proc.stdout.close()
        proc.stderr.close()
    return Completed(proc.returncode, b"".join(chunks["stdout"]), b"".join(chunks["stderr"]))


def run_git(odb: str, private: str, *args: str, deadline_seconds: float = 30.0, phase: str = "objects") -> Completed:
    return run_bounded(git_argv(odb, *args), clean_env("git", private), deadline_seconds=deadline_seconds, phase=phase)
