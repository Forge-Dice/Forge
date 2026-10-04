"""Fixed GET-only GitHub read adapter for Gate, Stage 2 and the final recheck (PKG §2, contract C §2).

Wraps Task A's bootstrap.HttpsTransport (CERT F05: it is used as is, never replaced or altered):
public reads, no Authorization header, fixed api.github.com paths built only from validated
decimal ids, at most one identical transport retry inside A's transport. Pagination runs over an
internal page counter (never over Link URLs): at most 20 pages of 100, at most 2,000 reviews or
jobs, otherwise EXECUTION_API. Bodies go through A's strict_json (UTF-8, duplicate keys, number
forms, depth, 4 MiB). Native control fields are selected strictly into plain dicts; extra
documented API fields are ignored, missing or mistyped control fields are EXECUTION_API.
No POST/PATCH/PUT/DELETE exists in this module.
"""

from __future__ import annotations

from bootstrap import API_BODY_LIMIT, REPO_ID, REPO_NAME, HttpsTransport, is_sha, positive_id, strict_json
from errors import ForgeFail, fail

REPO_PATH = f"/repos/{REPO_NAME}"
PER_PAGE = 100
MAX_PAGES = 20
MAX_ITEMS = MAX_PAGES * PER_PAGE  # 2,000 reviews or jobs
REVIEW_STATES = frozenset({"COMMENTED", "APPROVED", "CHANGES_REQUESTED", "DISMISSED", "PENDING"})
JOB_STATUSES = frozenset({"queued", "in_progress", "completed", "waiting", "requested", "pending"})


def default_transport() -> HttpsTransport:
    """The production transport: A's fixed public GET client, unchanged."""
    return HttpsTransport()


def _api(phase: str) -> ForgeFail:
    return fail("EXECUTION_API", phase)


def _id(value, phase: str) -> int:
    if not positive_id(value):
        raise fail("EXECUTION_INTERNAL", phase)
    return value


def _field(obj, *keys):
    for key in keys:
        if not isinstance(obj, dict) or key not in obj:
            return None
        obj = obj[key]
    return obj


def _get(transport, path: str, phase: str):
    """One fixed GET below the repository path; any transport failure is EXECUTION_API here."""
    if not path.startswith(REPO_PATH) or any(c in path for c in " #\\\r\n") or ".." in path:
        raise fail("EXECUTION_INTERNAL", phase)
    try:
        body = transport.get(path)
    except ForgeFail:
        raise _api(phase) from None
    return strict_json(body, API_BODY_LIMIT, "EXECUTION_API", phase)


def _require(ok: bool, phase: str) -> None:
    if not ok:
        raise _api(phase)


def _same_id(value, expected: int) -> bool:
    """Equality on validated ints only: Python's True == 1 must never match an id."""
    return positive_id(value) and value == expected


def _optional_id(value, phase: str):
    _require(value is None or positive_id(value), phase)
    return value


# -- single records ----------------------------------------------------------------------


def read_pr(transport, pr: int, *, phase: str = "final") -> dict:
    data = _get(transport, f"{REPO_PATH}/pulls/{_id(pr, phase)}", phase)
    shape = (
        _same_id(_field(data, "number"), pr),
        isinstance(_field(data, "state"), str),
        isinstance(_field(data, "draft"), bool),
        positive_id(_field(data, "base", "repo", "id")),
        isinstance(_field(data, "base", "ref"), str),
        is_sha(_field(data, "base", "sha")),
        is_sha(_field(data, "head", "sha")),
        positive_id(_field(data, "user", "id")),
    )
    _require(all(shape), phase)
    head_repo = _field(data, "head", "repo")
    _require(head_repo is None or isinstance(head_repo, dict), phase)
    return {
        "number": pr,
        "state": data["state"],
        "draft": data["draft"],
        "repoId": data["base"]["repo"]["id"],
        "baseRef": data["base"]["ref"],
        "baseSha": data["base"]["sha"],
        "headSha": data["head"]["sha"],
        "headRepoId": _optional_id(_field(head_repo, "id") if head_repo else None, phase),
        "authorId": data["user"]["id"],
    }


def read_main(transport, *, phase: str = "final") -> dict:
    data = _get(transport, f"{REPO_PATH}/branches/main", phase)
    _require(_field(data, "name") in (None, "main") and is_sha(_field(data, "commit", "sha")), phase)
    return {"sha": data["commit"]["sha"]}


def read_run(transport, run_id: int, attempt: int, *, phase: str = "final") -> dict:
    data = _get(transport, f"{REPO_PATH}/actions/runs/{_id(run_id, phase)}/attempts/{_id(attempt, phase)}", phase)
    shape = (
        _same_id(_field(data, "id"), run_id),
        _same_id(_field(data, "run_attempt"), attempt),
        isinstance(_field(data, "event"), str),
        isinstance(_field(data, "path"), str),
        positive_id(_field(data, "workflow_id")),
        is_sha(_field(data, "head_sha")),
        _field(data, "repository", "id") in (None, REPO_ID),
    )
    _require(all(shape), phase)
    triggering = _field(data, "triggering_actor")
    actor = _field(data, "actor")
    _require(triggering is None or isinstance(triggering, dict), phase)
    return {
        "id": run_id,
        "runAttempt": attempt,
        "event": data["event"],
        "path": data["path"],
        "workflowId": data["workflow_id"],
        "headSha": data["head_sha"],
        # Numeric only; a missing field stays None and is never replaced by a login (PKG §2).
        "triggeringActorId": _optional_id(_field(triggering, "id") if triggering else None, phase),
        "actorId": _optional_id(_field(actor, "id") if isinstance(actor, dict) else None, phase),
    }


# -- paginated lists ---------------------------------------------------------------------


def _pages(transport, path: str, phase: str, unwrap):
    """Internal page counter 1..20; stops on a short page; a 21st page would be needed -> FAIL."""
    items: list = []
    first_total = None
    for page in range(1, MAX_PAGES + 1):
        batch, total = unwrap(_get(transport, f"{path}?per_page={PER_PAGE}&page={page}", phase))
        _require(isinstance(batch, list) and len(batch) <= PER_PAGE, phase)
        items.extend(batch)
        if page == 1:
            first_total = total
        _require(total == first_total, phase)  # a total_count changing between pages: listing not stable
        if total is not None:
            _require(len(items) <= total <= MAX_ITEMS, phase)
            if len(items) == total:
                return items
            _require(len(batch) == PER_PAGE, phase)  # short page before total: incomplete
        elif len(batch) < PER_PAGE:
            return items
    raise _api(phase)  # more than 20 pages / 2,000 items, or completeness not provable


def read_reviews(transport, pr: int, *, phase: str = "final") -> list[dict]:
    raw = _pages(transport, f"{REPO_PATH}/pulls/{_id(pr, phase)}/reviews", phase, lambda data: (data, None))
    out, seen = [], set()
    for item in raw:
        user = _field(item, "user")
        body = _field(item, "body")
        shape = (
            isinstance(item, dict),
            positive_id(_field(item, "id")),
            user is None or isinstance(user, dict),
            isinstance(_field(item, "state"), str) and item["state"] in REVIEW_STATES,
            isinstance(item, dict) and "commit_id" in item and "submitted_at" in item,  # nullable, never absent
            _field(item, "commit_id") is None or is_sha(_field(item, "commit_id")),
            _field(item, "submitted_at") is None or isinstance(_field(item, "submitted_at"), str),
            body is None or isinstance(body, str),
        )
        _require(all(shape) and item["id"] not in seen, phase)
        seen.add(item["id"])
        text = body if body is not None else ""
        try:
            text.encode("utf-8")
        except UnicodeEncodeError:  # lone surrogate escapes have no exact body bytes
            raise _api(phase) from None
        # REST field names are kept: reviews.py consumes exactly this selected record shape.
        out.append({
            "id": item["id"],
            "user": {"id": _optional_id(_field(user, "id"), phase)} if user else None,
            "state": item["state"],
            "commit_id": item["commit_id"],
            "submitted_at": item["submitted_at"],
            "body": text,
        })
    return out


def read_jobs(transport, run_id: int, attempt: int, *, phase: str = "final") -> list[dict]:
    def unwrap(data):
        total = _field(data, "total_count")
        _require(type(total) is int and total >= 0, phase)
        return _field(data, "jobs"), total

    path = f"{REPO_PATH}/actions/runs/{_id(run_id, phase)}/attempts/{_id(attempt, phase)}/jobs"
    out, seen = [], set()
    for item in _pages(transport, path, phase, unwrap):
        conclusion = _field(item, "conclusion")
        shape = (
            isinstance(item, dict),
            positive_id(_field(item, "id")),
            _same_id(_field(item, "run_id"), run_id),
            positive_id(_field(item, "run_attempt")),
            isinstance(_field(item, "name"), str),
            isinstance(_field(item, "status"), str) and item["status"] in JOB_STATUSES,
            conclusion is None or isinstance(conclusion, str),
        )
        _require(all(shape) and item["id"] not in seen, phase)
        seen.add(item["id"])
        # run_attempt is kept as reported: a re-run-failed-jobs listing carries old-attempt jobs.
        out.append({"id": item["id"], "name": item["name"], "runAttempt": item["run_attempt"],
                    "status": item["status"], "conclusion": conclusion})
    return out
