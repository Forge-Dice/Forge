"""Trusted bootstrap: strict event, fixed public GETs, private ODB, fixed fetches (PKG §2, contract A §5).

Nothing from the event or the PR record ever becomes a URL, a revspec or argv text beyond
validated decimals and 40-hex SHAs. The remote, the API host, deadlines and budgets are fixed
constants. Tests may replace them only through the keyword-only `_seams` argument, which no
production entry point passes, and budgets may only be lowered (contract A v3 decision).
"""

from __future__ import annotations

import http.client
import json
import os
import re
import ssl
from dataclasses import dataclass, field

import process
from errors import fail
from objects import OBJECT_BUDGET_BYTES, OBJECT_BUDGET_COUNT, ObjectStore

REPO_ID = 1401864629
REPO_NAME = "Forge-Dice/Forge"
REMOTE_URL = "https://github.com/Forge-Dice/Forge.git"
API_HOST = "api.github.com"
API_VERSION = "2026-03-10"
EVENT_LIMIT = 1024 * 1024
API_BODY_LIMIT = 4 * 1024 * 1024
JSON_DEPTH = 32
FETCH_DEADLINE = 90.0
API_DEADLINE = 10.0
ODB_DISK_BUDGET = 512 * 1024 * 1024
ACTIONS = frozenset({"opened", "reopened", "synchronize", "ready_for_review"})
MAX_ID = 2**53 - 1
_SHA = re.compile(r"[0-9a-f]{40}")
MAIN_REF = "refs/forge/main"
HEAD_REF = "refs/forge/head"


# -- strict JSON ---------------------------------------------------------------------------


class _Float:
    """Marker for any JSON number token with fraction or exponent; never a valid ID."""


def strict_json(data: bytes, limit: int, code: str, phase: str = "bootstrap"):
    if not isinstance(data, (bytes, bytearray)) or len(data) > limit:
        raise fail(code, phase)
    try:
        text = bytes(data).decode("utf-8", errors="strict")
    except UnicodeDecodeError:
        raise fail(code, phase) from None

    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError("duplicate key")
            result[key] = value
        return result

    def constant(_name):
        raise ValueError("non-finite number")

    try:
        value = json.loads(text, object_pairs_hook=pairs, parse_constant=constant, parse_float=lambda _s: _Float())
    except (ValueError, RecursionError):
        raise fail(code, phase) from None
    stack = [(value, 1)]
    while stack:
        item, depth = stack.pop()
        if depth > JSON_DEPTH:
            raise fail(code, phase)
        children = item.values() if isinstance(item, dict) else item if isinstance(item, list) else ()
        stack.extend((child, depth + 1) for child in children)
    return value


def _get(obj, *keys):
    for key in keys:
        if not isinstance(obj, dict) or key not in obj:
            return None
        obj = obj[key]
    return obj


def positive_id(value) -> bool:
    return type(value) is int and 0 < value <= MAX_ID


def is_sha(value) -> bool:
    return isinstance(value, str) and _SHA.fullmatch(value) is not None


# -- event and runner facts ----------------------------------------------------------------


@dataclass(frozen=True)
class EventFacts:
    pr: int
    base: str
    head: str
    action: str
    run_id: int
    run_attempt: int
    actor_id: int


def parse_event(event_bytes: bytes, runner_facts: dict) -> EventFacts:
    event = strict_json(event_bytes, EVENT_LIMIT, "PR_INPUT")
    facts = runner_facts if isinstance(runner_facts, dict) else {}
    pr = _get(event, "pull_request", "number")
    checks = (
        facts.get("eventName") == "pull_request_target",
        is_sha(facts.get("githubSha")),
        positive_id(facts.get("runId")),
        positive_id(facts.get("runAttempt")),
        positive_id(facts.get("actorId")),
        isinstance(event, dict) and event.get("action") in ACTIONS,
        positive_id(pr) and _get(event, "number") in (None, pr),
        _get(event, "repository", "id") == REPO_ID and positive_id(_get(event, "repository", "id")),
        _get(event, "repository", "full_name") == REPO_NAME,
        _get(event, "pull_request", "base", "repo", "id") == REPO_ID,
        _get(event, "pull_request", "base", "ref") == "main",
        is_sha(_get(event, "pull_request", "base", "sha")),
        is_sha(_get(event, "pull_request", "head", "sha")),
    )
    if not all(checks):
        raise fail("PR_INPUT", "bootstrap")
    base = _get(event, "pull_request", "base", "sha")
    if base != facts["githubSha"]:
        raise fail("PR_STALE", "bootstrap")
    return EventFacts(pr, base, _get(event, "pull_request", "head", "sha"), event["action"],
                      facts["runId"], facts["runAttempt"], facts["actorId"])


# -- fixed public GET transport (own transport, CERT F05: no import from Task C) ------------


class HttpsTransport:
    """Exactly the four public GETs of PKG §2 step 2. No Authorization header, no redirects."""

    def get(self, path: str) -> bytes:
        for attempt in (1, 2):  # at most one identical retry, only for transport errors and 5xx
            try:
                conn = http.client.HTTPSConnection(API_HOST, timeout=API_DEADLINE, context=ssl.create_default_context())
                try:
                    conn.request("GET", path, headers={
                        "Accept": "application/vnd.github+json",
                        "X-GitHub-Api-Version": API_VERSION,
                        "User-Agent": "forge-v01-stage0",
                    })
                    response = conn.getresponse()
                    body = response.read(API_BODY_LIMIT + 1)
                    status = response.status
                finally:
                    conn.close()
            except (OSError, http.client.HTTPException):
                if attempt == 1:
                    continue
                raise fail("EXECUTION_API", "bootstrap") from None
            if 500 <= status < 600 and attempt == 1:
                continue
            if status != 200 or len(body) > API_BODY_LIMIT:
                raise fail("EXECUTION_API", "bootstrap")
            return body
        raise fail("EXECUTION_API", "bootstrap")


def api_paths(event: EventFacts) -> dict[str, str]:
    repo = f"/repos/{REPO_NAME}"
    return {
        "repo": repo,
        "pull": f"{repo}/pulls/{event.pr}",
        "main": f"{repo}/branches/main",
        "run": f"{repo}/actions/runs/{event.run_id}/attempts/{event.run_attempt}",
    }


@dataclass(frozen=True)
class LiveFacts:
    main: str
    base: str
    head: str
    state: str
    draft: bool
    author_id: int
    triggering_actor_id: int | None


def read_live(transport, event: EventFacts) -> LiveFacts:
    paths = api_paths(event)

    def get(name):
        return strict_json(transport.get(paths[name]), API_BODY_LIMIT, "EXECUTION_API")

    repo, pull, main, run = get("repo"), get("pull"), get("main"), get("run")
    shape = (
        _get(repo, "id") == REPO_ID,
        _get(repo, "full_name") == REPO_NAME,
        _get(repo, "private") is False,
        _get(pull, "number") == event.pr,
        _get(pull, "base", "repo", "id") == REPO_ID,
        _get(pull, "base", "ref") == "main",
        is_sha(_get(pull, "base", "sha")),
        is_sha(_get(pull, "head", "sha")),
        isinstance(_get(pull, "state"), str),
        isinstance(_get(pull, "draft"), bool),
        positive_id(_get(pull, "user", "id")),
        is_sha(_get(main, "commit", "sha")),
        _get(run, "id") == event.run_id,
        _get(run, "run_attempt") == event.run_attempt,
    )
    if not all(shape):
        raise fail("EXECUTION_API", "bootstrap")
    if _get(pull, "head", "repo", "id") != REPO_ID:
        raise fail("IDENTITY_ACTOR", "bootstrap")
    actor = _get(run, "triggering_actor", "id")
    return LiveFacts(_get(main, "commit", "sha"), _get(pull, "base", "sha"), _get(pull, "head", "sha"),
                     _get(pull, "state"), _get(pull, "draft"), _get(pull, "user", "id"),
                     actor if positive_id(actor) else None)


def compare_live(event: EventFacts, live: LiveFacts) -> None:
    if not (event.base == live.base == live.main) or event.head != live.head:
        raise fail("PR_STALE", "bootstrap")


# -- private ODB, layout, fetch --------------------------------------------------------------

ALLOWED_CONFIG = (
    ("core.repositoryformatversion", "0"),
    ("core.filemode", "true"),
    ("core.bare", "true"),
)
FORBIDDEN_FILES = ("info/grafts", "shallow", "objects/info/alternates", "objects/info/http-alternates")


@dataclass(frozen=True)
class Seams:
    remote: str = REMOTE_URL
    transport: object = field(default_factory=HttpsTransport)
    fetch_deadline: float = FETCH_DEADLINE
    disk_budget: int = ODB_DISK_BUDGET
    budget_bytes: int = OBJECT_BUDGET_BYTES
    budget_count: int = OBJECT_BUDGET_COUNT

    def checked(self) -> "Seams":
        lowered = (
            self.fetch_deadline <= FETCH_DEADLINE,
            self.disk_budget <= ODB_DISK_BUDGET,
            self.budget_bytes <= OBJECT_BUDGET_BYTES,
            self.budget_count <= OBJECT_BUDGET_COUNT,
        )
        if not all(lowered):
            raise fail("EXECUTION_INTERNAL", "bootstrap")
        return self

    def extra_git_config(self) -> tuple[tuple[str, str], ...]:
        # Only a test remote (a local path) needs the file protocol; the fixed remote never does.
        return () if self.remote == REMOTE_URL else (("protocol.file.allow", "always"),)


def init_odb(workspace: str) -> tuple[str, str]:
    """Fresh bare repository with an empty template and private HOME/XDG/TMP (umask 077)."""
    os.umask(0o077)
    private = os.path.join(workspace, "private")
    template = os.path.join(private, "empty-template")
    odb = os.path.join(workspace, "odb.git")
    if os.path.lexists(odb):
        raise fail("GIT_LAYOUT", "bootstrap")
    process.prepare_private(private)
    os.makedirs(template, mode=0o700, exist_ok=False)
    argv = [process.GIT, "init", "--quiet", "--bare", "--object-format=sha1", f"--template={template}", odb]
    result = process.run_bounded(argv, process.clean_env("git", private), deadline_seconds=30.0, phase="bootstrap")
    if result.returncode != 0:
        raise fail("GIT_LAYOUT", "bootstrap")
    check_layout(odb, private, frozenset())
    return odb, private


def list_refs(odb: str, private: str) -> dict[str, str]:
    result = process.run_git(odb, private, "for-each-ref", "--format=%(objectname) %(refname)", phase="bootstrap")
    if result.returncode != 0:
        raise fail("GIT_LAYOUT", "bootstrap")
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
        raise fail("GIT_LAYOUT", "bootstrap")
    entries = tuple(tuple(item.split(b"\n", 1)) for item in config.stdout.split(b"\0") if item)
    if sorted(entries) != sorted((k.encode(), v.encode()) for k, v in ALLOWED_CONFIG):
        raise fail("GIT_LAYOUT", "bootstrap")
    for name in FORBIDDEN_FILES:
        if os.path.lexists(os.path.join(odb, name)):
            raise fail("GIT_LAYOUT", "bootstrap")
    hooks = os.path.join(odb, "hooks")
    if os.path.lexists(hooks) and (os.path.islink(hooks) or os.listdir(hooks)):
        raise fail("GIT_LAYOUT", "bootstrap")
    pack_dir = os.path.join(odb, "objects", "pack")
    if os.path.isdir(pack_dir) and any(name.endswith(".promisor") for name in os.listdir(pack_dir)):
        raise fail("GIT_LAYOUT", "bootstrap")
    refs = list_refs(odb, private)
    # One allowlist covers loose and packed refs alike, refs/replace/* included (mutant A1 site).
    for name in refs:
        if name not in allowed_refs:
            raise fail("GIT_LAYOUT", "bootstrap")
    return refs


def account(odb: str, private: str, seams: Seams) -> None:
    """Post-fetch budgets: disk usage, object count and summed declared sizes (GIT_LIMIT)."""
    disk = 0
    for root, _dirs, files in os.walk(os.path.join(odb, "objects")):
        disk += sum(os.lstat(os.path.join(root, name)).st_size for name in files)
    if disk > seams.disk_budget:
        raise fail("GIT_LIMIT", "bootstrap")
    result = process.run_git(odb, private, "cat-file", "--batch-all-objects", "--batch-check=%(objectsize)",
                             deadline_seconds=60.0, phase="bootstrap")
    if result.returncode != 0:
        raise fail("GIT_OBJECT", "bootstrap")
    sizes = result.stdout.split()
    if len(sizes) > seams.budget_count or sum(int(size) for size in sizes) > seams.budget_bytes:
        raise fail("GIT_LIMIT", "bootstrap")


def fetch(odb: str, private: str, seams: Seams, source_ref: str, target_ref: str, expected: str,
          allowed_refs: frozenset) -> None:
    argv = process.git_argv(
        odb, "fetch", "--no-tags", "--no-recurse-submodules", "--no-write-fetch-head", "--quiet",
        seams.remote, f"+{source_ref}:{target_ref}", extra_config=seams.extra_git_config(),
    )
    result = process.run_bounded(argv, process.clean_env("git", private),
                                 deadline_seconds=seams.fetch_deadline, phase="bootstrap")
    if result.returncode != 0:
        raise fail("GIT_FETCH", "bootstrap")
    refs = check_layout(odb, private, allowed_refs)
    if refs.get(target_ref) != expected:
        raise fail("PR_STALE", "bootstrap")
    account(odb, private, seams)
    fsck = process.run_git(odb, private, "fsck", "--strict", "--no-dangling", "--no-progress",
                           deadline_seconds=60.0, phase="bootstrap")
    if fsck.returncode != 0:
        raise fail("GIT_OBJECT", "bootstrap")


# -- public API ------------------------------------------------------------------------------


@dataclass(frozen=True)
class TrustedBase:
    event: EventFacts
    live: LiveFacts
    base: str
    head: str
    odb: str
    private: str
    seams: Seams

    def store(self) -> ObjectStore:
        return ObjectStore(self.odb, self.private, budget_bytes=self.seams.budget_bytes,
                           budget_count=self.seams.budget_count)


def bootstrap_base(event_bytes: bytes, runner_facts: dict, workspace: str, *, _seams: Seams | None = None) -> TrustedBase:
    """Steps 1-4 of PKG §2: strict input, live GETs, fresh ODB, fetch of main only."""
    seams = (_seams or Seams()).checked()
    event = parse_event(event_bytes, runner_facts)
    live = read_live(seams.transport, event)
    compare_live(event, live)
    odb, private = init_odb(workspace)
    fetch(odb, private, seams, "refs/heads/main", MAIN_REF, event.base, frozenset({MAIN_REF}))
    return TrustedBase(event, live, event.base, event.head, odb, private, seams)


def fetch_head(base: TrustedBase) -> TrustedBase:
    """Step 6 of PKG §2: exact PR head ref, then the live PR and main are read again."""
    fetch(base.odb, base.private, base.seams, f"refs/pull/{base.event.pr}/head", HEAD_REF, base.head,
          frozenset({MAIN_REF, HEAD_REF}))
    again = read_live(base.seams.transport, base.event)
    if again != base.live:
        raise fail("PR_STALE", "bootstrap")
    return base


def bootstrap_trusted_objects(event_bytes: bytes, runner_facts: dict, workspace: str, *, _seams=None) -> TrustedBase:
    return fetch_head(bootstrap_base(event_bytes, runner_facts, workspace, _seams=_seams))
