"""Gate receipt, Stage-2 start binding, attempt jobs and the two-round final recheck (contract C §4–§6).

The receipt is fixed canonical JSON written by forge-gate only after full success. Stage 2 compares
it once with its own current attempt and its own start review snapshot; the final window takes
exactly two complete fresh snapshots through github.py, both of which must equal each other and
the Gate-bound values. Every comparison below exists exactly once (mutants C3, C4, C5 remove one
site each). Failures are collected and the primary one follows PKG §11 enum precedence.
"""

from __future__ import annotations

import calendar
import hashlib
import json
import re
import time

import github
import reviews
from bootstrap import is_sha, positive_id, strict_json
from errors import ForgeFail, fail, first

PHASE = "final"
RECEIPT_KEYS = ("runId", "runAttempt", "B", "H", "contractHash", "policyHash", "verifierSha", "reviewSnapshotDigest")
RECEIPT_LIMIT = 1024
WORKFLOW_PATH = ".github/workflows/forge-v01.yml"
GATE_JOB, VERIFY_JOB = "forge-gate", "forge-verify"
FINAL_WINDOW = 10.0
DEPLOYMENT_TTL = 30 * 60
_HEX64 = re.compile(r"[0-9a-f]{64}")


# -- receipt ------------------------------------------------------------------------------


def _valid_receipt(value) -> bool:
    if not isinstance(value, dict) or tuple(value) != RECEIPT_KEYS:
        return False
    hashes = (value["contractHash"], value["policyHash"], value["reviewSnapshotDigest"])
    return (positive_id(value["runId"]) and positive_id(value["runAttempt"])
            and all(is_sha(value[k]) for k in ("B", "H", "verifierSha"))
            and all(isinstance(h, str) and _HEX64.fullmatch(h) is not None for h in hashes))


def make_receipt(fields: dict) -> str:
    value = {key: fields.get(key) for key in RECEIPT_KEYS} if isinstance(fields, dict) else None
    if not _valid_receipt(value):
        raise fail("EXECUTION_INTERNAL", "gate")
    return json.dumps(value, indent=2) + "\n"


def parse_receipt(text: str) -> dict:
    if not isinstance(text, str):
        raise fail("IDENTITY_RECHECK", PHASE)
    try:
        raw = text.encode("utf-8")
    except UnicodeEncodeError:
        raise fail("IDENTITY_RECHECK", PHASE) from None
    value = strict_json(raw, RECEIPT_LIMIT, "IDENTITY_RECHECK", PHASE)
    if not _valid_receipt(value) or make_receipt(value) != text:
        raise fail("IDENTITY_RECHECK", PHASE)
    return value


# -- Stage-2 start --------------------------------------------------------------------------


def _stage2_failures(receipt: dict, current: dict, start_review_digest: str) -> list[ForgeFail]:
    out = []
    if receipt["runId"] != current["runId"]:
        out.append(fail("IDENTITY_RECHECK", PHASE))
    if receipt["runAttempt"] != current["runAttempt"]:
        out.append(fail("IDENTITY_RECHECK", PHASE))
    out += [fail("PR_STALE", PHASE) for key in ("B", "H", "verifierSha") if receipt[key] != current[key]]
    out += [fail("POLICY_CHANGED", PHASE) for key in ("contractHash", "policyHash") if receipt[key] != current[key]]
    if receipt["reviewSnapshotDigest"] != start_review_digest:
        out.append(fail("REVIEW_CHANGED", PHASE))
    return out


def check_stage2_start(receipt: dict, current: dict, start_review_digest: str) -> None:
    failures = _stage2_failures(receipt, current, start_review_digest)
    if failures:
        raise first(failures)


# -- run attempt and jobs (§6) --------------------------------------------------------------


def _job_failures(jobs: list, run: dict, receipt: dict, owner_id: int, recheck_required: bool) -> list[ForgeFail]:
    out, attempt = [], run["runAttempt"]
    if run["id"] != receipt["runId"]:
        out.append(fail("IDENTITY_RECHECK", PHASE))
    if run["event"] != "pull_request_target" or run["path"] != WORKFLOW_PATH:
        out.append(fail("POLICY_CHECKS", PHASE))
    if recheck_required and (attempt < 2 or not positive_id(owner_id) or run["triggeringActorId"] != owner_id):
        out.append(fail("IDENTITY_RECHECK", PHASE))
    names = [job["name"] for job in jobs]
    if sorted(names) != [GATE_JOB, VERIFY_JOB]:
        out.append(fail("POLICY_CHECKS", PHASE))  # missing, duplicate, matrix or foreign job names
    fresh_gate = [j for j in jobs if j["name"] == GATE_JOB and j["runAttempt"] == attempt
                  and j["status"] == "completed" and j["conclusion"] == "success"]
    if len(fresh_gate) != 1:
        out.append(fail("IDENTITY_RECHECK", PHASE))  # receipt not from a fresh Gate of this attempt
    running = [j for j in jobs if j["name"] == VERIFY_JOB and j["runAttempt"] == attempt and j["status"] == "in_progress"]
    if len(running) != 1:
        out.append(fail("POLICY_CHECKS", PHASE))
    return out


def check_attempt_jobs(jobs: list, run: dict, receipt: dict, owner_id: int, recheck_required: bool) -> None:
    failures = _job_failures(jobs, run, receipt, owner_id, recheck_required)
    if failures:
        raise first(failures)


# -- final two-round recheck (§5) -----------------------------------------------------------


def take_snapshot(transport, pr: int, run_id: int, attempt: int) -> dict:
    return {
        "pr": github.read_pr(transport, pr),
        "main": github.read_main(transport),
        "reviews": github.read_reviews(transport, pr),
        "run": github.read_run(transport, run_id, attempt),
        "jobs": github.read_jobs(transport, run_id, attempt),
    }


def take_final_snapshots(transport, pr: int, run_id: int, attempt: int, *, clock=time.monotonic) -> list[dict]:
    start = clock()
    snapshots = [take_snapshot(transport, pr, run_id, attempt) for _ in range(2)]
    if clock() - start > FINAL_WINDOW:
        raise fail("EXECUTION_API", PHASE)
    return snapshots


def _attestation_failures(snap_reviews: list, expected: dict) -> list[ForgeFail]:
    """The attestation selected by reviews.select_attestation is still present and byte-identical."""
    chosen = expected["attestation"]
    found = [r for r in snap_reviews if r["id"] == chosen["reviewId"] and r["user"] == {"id": expected["ownerId"]}]
    unchanged = (len(found) == 1 and found[0]["state"] == "COMMENTED" and found[0]["commit_id"] == expected["H"]
                 and hashlib.sha256(found[0]["body"].encode("utf-8")).hexdigest() == chosen["bodySha256"])
    return [] if unchanged else [fail("REVIEW_CHANGED", PHASE)]


def _snapshot_failures(snap: dict, receipt: dict, expected: dict) -> list[ForgeFail]:
    pr, run, b, h = snap["pr"], snap["run"], expected["B"], expected["H"]
    out = []
    if pr["state"] != "open" or pr["draft"] is not False:
        out.append(fail("PR_STATE", PHASE))
    if pr["repoId"] != expected["repoId"] or pr["number"] != expected["pr"] or pr["baseRef"] != "main":
        out.append(fail("PR_STATE", PHASE))
    if pr["headRepoId"] != expected["repoId"]:
        out.append(fail("IDENTITY_ACTOR", PHASE))
    if pr["headSha"] != h or pr["baseSha"] != b or run["headSha"] != b:
        out.append(fail("PR_STALE", PHASE))
    if snap["main"]["sha"] != b:
        out.append(fail("PR_STALE", PHASE))
    if receipt["B"] != b or receipt["H"] != h or receipt["verifierSha"] != b:
        out.append(fail("PR_STALE", PHASE))
    if run["id"] != expected["runId"] or run["runAttempt"] != expected["runAttempt"]:
        out.append(fail("IDENTITY_RECHECK", PHASE))
    out += _job_failures(snap["jobs"], run, receipt, expected["ownerId"], expected["recheckRequired"])
    if reviews.review_snapshot_digest(snap["reviews"], expected["ownerId"]) != receipt["reviewSnapshotDigest"]:
        out.append(fail("REVIEW_CHANGED", PHASE))
    return out + _attestation_failures(snap["reviews"], expected)


# Owner reviews are compared through the digest of each round; non-Owner records never matter.
_ROUND_CODES = {"pr": "PR_STALE", "main": "PR_STALE", "run": "POLICY_CHECKS", "jobs": "POLICY_CHECKS"}


def _round_value(snap: dict, key: str):
    return sorted(snap[key], key=lambda job: job["id"]) if key == "jobs" else snap[key]


def final_recheck(snapshots: list, receipt: dict, expected: dict) -> dict:
    if not isinstance(snapshots, list) or len(snapshots) != 2:
        raise fail("EXECUTION_INTERNAL", PHASE)  # exactly two final rounds, never a third
    failures = [f for snap in snapshots for f in _snapshot_failures(snap, receipt, expected)]
    failures += [fail(code, PHASE) for key, code in _ROUND_CODES.items()
                 if _round_value(snapshots[0], key) != _round_value(snapshots[1], key)]
    if failures:
        raise first(failures)
    return {"reviewSnapshotDigest": receipt["reviewSnapshotDigest"], "attestationId": expected["attestation"]["reviewId"]}


def check_deployment(deployment: dict, policy_digest: str, now: float) -> None:
    """PKG §10 platform policy: attested digest equals BASE policy, checkedAt not future, at most 30 min old."""
    try:
        checked = calendar.timegm(time.strptime(deployment["checkedAt"], "%Y-%m-%dT%H:%M:%SZ"))
    except (KeyError, TypeError, ValueError):
        raise fail("POLICY_DEPLOYMENT", PHASE) from None
    if deployment.get("policyDigest") != policy_digest or not 0 <= now - checked <= DEPLOYMENT_TTL:
        raise fail("POLICY_DEPLOYMENT", PHASE)
