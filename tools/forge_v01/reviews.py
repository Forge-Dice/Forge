"""Owner attestation format, review snapshot digest and decisive-review selection.

PKG §9 as closed by contract C r2 §3 (review schema, supersedes) and §4 (snapshot digest).
Pure functions over GitHub REST review records as parsed JSON: no I/O, no clock. Authority is
the numeric owner `user.id` from policy, decided at exactly one site (`_is_owner`); the latest
published Owner review is decisive, chosen at exactly one site (`select_attestation`).
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
import re

from bootstrap import positive_id, strict_json
from errors import CODES, ForgeFail, fail

PHASE = "review"
HEADER = b"FORGE-ATTESTATION-V1\n"
BODY_LIMIT = 128 * 1024
REPORT_LIMIT = 32 * 1024
SNAPSHOT_PREFIX = b"forge-review-snapshot-v1\n"
REPORT_PREFIX = b"forge-external-review-v1\n"

# PKG §9: the binding fields of both variants, in canonical order. The embedded external
# report binds the first seven (no run fields).
BINDING_FIELDS = ("repoId", "pr", "base", "head", "contractHash", "verifierSha", "policyHash", "runId", "runAttempt")
REPORT_BINDING_FIELDS = BINDING_FIELDS[:7]
APPROVE_KEYS = ("format", *BINDING_FIELDS, "action", "externalReviewer", "externalReviewHash",
                "externalReviewResult", "externalReviewBase64", "supersedes", "deployment")
REVOKE_KEYS = ("format", *BINDING_FIELDS, "action", "supersedes")
REVIEWER_KEYS = ("provider", "model")
DEPLOYMENT_KEYS = ("policyDigest", "checkedAt")
SUPERSEDES_KEYS = ("reviewId", "bodyHash", "state")
REPORT_KEYS = frozenset({"format", "binding", "reviewer", "result", "findings"})
FINDING_KEYS = frozenset({"id", "severity", "summary"})

PROVIDERS = ("anthropic", "openai")  # closed: a display label is never a provider
RESULTS = ("approve", "request_changes")
SEVERITIES = ("info", "minor", "major", "critical")
BLOCKING_SEVERITIES = ("major", "critical")
PUBLISHED_STATES = ("APPROVED", "CHANGES_REQUESTED", "COMMENTED", "DISMISSED")
API_STATES = PUBLISHED_STATES + ("PENDING",)  # schema of supersedes.state; non-blockers -> BINDING
ATTESTATION_STATE = "COMMENTED"
BLOCKING_STATES = ("CHANGES_REQUESTED", "DISMISSED")
OPENAI_DEVELOPERS = ("openai", "codex")  # policy names the Codex developer "codex"
PROFILES = ("DEV", "OWNER_OPS")

_HEX40 = re.compile(r"[0-9a-f]{40}")
_HEX64 = re.compile(r"[0-9a-f]{64}")
_FINDING_ID = re.compile(r"[a-z0-9][a-z0-9-]{0,31}")
_MODEL = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}")
_TIME = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z")


def _format() -> Exception:
    return fail("REVIEW_FORMAT", PHASE)


def _exact(value, keys: tuple) -> dict:
    if not isinstance(value, dict) or tuple(value) != keys:
        raise _format()
    return value


def _text(value, pattern: re.Pattern) -> str:
    if not isinstance(value, str) or pattern.fullmatch(value) is None:
        raise _format()
    return value


def _binding(value: dict, fields: tuple) -> dict:
    out = {}
    for name in fields:
        item = value[name]
        if name in ("repoId", "pr", "runId", "runAttempt"):
            if not positive_id(item):
                raise _format()
        else:
            _text(item, _HEX40 if name in ("base", "head", "verifierSha") else _HEX64)
        out[name] = item
    return out


def _reviewer(value) -> dict:
    if not isinstance(value, dict) or set(value) != set(REVIEWER_KEYS) or value["provider"] not in PROVIDERS:
        raise _format()
    return {"provider": value["provider"], "model": _text(value["model"], _MODEL)}


def _report(encoded) -> tuple[dict, str]:
    """Canonical Base64 of a strict JSON external report (contract C §3 findings schema)."""
    if not isinstance(encoded, str):
        raise _format()
    try:
        data = base64.b64decode(encoded.encode("ascii"), validate=True)
    except (binascii.Error, UnicodeEncodeError, ValueError):
        raise _format() from None
    if not data or len(data) > REPORT_LIMIT or base64.b64encode(data).decode("ascii") != encoded:
        raise _format()
    report = strict_json(data, REPORT_LIMIT, "REVIEW_FORMAT", PHASE)
    if not isinstance(report, dict) or set(report) != REPORT_KEYS or type(report["format"]) is not int or report["format"] != 1:
        raise _format()
    binding = report["binding"]
    if not isinstance(binding, dict) or set(binding) != set(REPORT_BINDING_FIELDS):
        raise _format()
    if report["result"] not in RESULTS or not isinstance(report["findings"], list):
        raise _format()
    seen = set()
    for finding in report["findings"]:
        if not isinstance(finding, dict) or set(finding) != FINDING_KEYS or finding["severity"] not in SEVERITIES:
            raise _format()
        summary = finding["summary"]
        try:
            size = len(summary.encode("utf-8")) if isinstance(summary, str) else 0
        except UnicodeEncodeError:
            size = 0
        if not 0 < size <= 512 or _text(finding["id"], _FINDING_ID) in seen:
            raise _format()
        seen.add(finding["id"])
    parsed = {
        "binding": _binding(binding, REPORT_BINDING_FIELDS),
        "reviewer": _reviewer(report["reviewer"]),
        "result": report["result"],
        "blocking": any(f["severity"] in BLOCKING_SEVERITIES for f in report["findings"]),
    }
    return parsed, hashlib.sha256(REPORT_PREFIX + data).hexdigest()


def _bytes(body, code: str) -> bytes:
    if isinstance(body, (bytes, bytearray)):
        return bytes(body)
    try:
        if isinstance(body, str):
            return body.encode("utf-8")
    except UnicodeEncodeError:
        pass
    raise fail(code, PHASE)


def parse_attestation(body) -> dict:
    """Strict `FORGE-ATTESTATION-V1` body (approve or revoke variant), else REVIEW_FORMAT."""
    raw = _bytes(body, "REVIEW_FORMAT")
    if not raw.startswith(HEADER):
        raise _format()
    text = raw[len(HEADER):]
    value = strict_json(text, BODY_LIMIT, "REVIEW_FORMAT", PHASE)
    try:
        canonical = (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    except (TypeError, ValueError, UnicodeEncodeError):  # float markers, lone surrogates
        raise _format() from None
    if canonical != text:
        raise _format()
    action = value.get("action") if isinstance(value, dict) else None
    att = _exact(value, APPROVE_KEYS if action == "approve" else REVOKE_KEYS)
    if type(att["format"]) is not int or att["format"] != 1 or action not in ("approve", "revoke"):
        raise _format()
    out = {"action": action, "binding": _binding(att, BINDING_FIELDS), "supersedes": []}
    if not isinstance(att["supersedes"], list) or (action == "revoke" and att["supersedes"]):
        raise _format()
    if action == "revoke":
        return out
    for entry in att["supersedes"]:
        _exact(entry, SUPERSEDES_KEYS)
        if not positive_id(entry["reviewId"]) or entry["state"] not in API_STATES:
            raise _format()
        out["supersedes"].append({"reviewId": entry["reviewId"], "bodyHash": _text(entry["bodyHash"], _HEX64),
                                  "state": entry["state"]})
    deployment = _exact(att["deployment"], DEPLOYMENT_KEYS)
    if att["externalReviewResult"] not in RESULTS:
        raise _format()
    report, report_hash = _report(att["externalReviewBase64"])
    out.update({
        "externalReviewer": _reviewer(att["externalReviewer"]),
        "externalReviewHash": _text(att["externalReviewHash"], _HEX64),
        "externalReviewResult": att["externalReviewResult"],
        "deployment": {"policyDigest": _text(deployment["policyDigest"], _HEX64),
                       "checkedAt": _text(deployment["checkedAt"], _TIME)},
        "report": report,
        "reportHash": report_hash,
    })
    return out


# -- published Owner reviews -------------------------------------------------------------------


def _is_owner(review: dict, owner_id: int) -> bool:
    """The single owner-identity decision: numeric server-side user.id, never the login."""
    user = review.get("user")
    return isinstance(user, dict) and type(user.get("id")) is int and user["id"] == owner_id


def _owner_reviews(reviews, owner_id: int) -> list[dict]:
    """All published reviews by the Owner id, normalized and sorted by (submittedAt, id)."""
    if not isinstance(reviews, list) or not positive_id(owner_id):
        raise fail("EXECUTION_INTERNAL", PHASE)
    out = []
    for review in reviews:
        if not isinstance(review, dict):
            raise fail("EXECUTION_API", PHASE)
        if not _is_owner(review, owner_id) or review.get("state") == "PENDING":
            continue  # PENDING is never published, other users are never authority
        commit, when, body = review.get("commit_id"), review.get("submitted_at"), review.get("body")
        valid = (
            positive_id(review.get("id")),
            review.get("state") in PUBLISHED_STATES,
            commit is None or (isinstance(commit, str) and _HEX40.fullmatch(commit) is not None),
            isinstance(when, str) and _TIME.fullmatch(when) is not None,
            body is None or isinstance(body, str),
        )
        if not all(valid):
            raise fail("EXECUTION_API", PHASE)
        raw = _bytes(body or "", "EXECUTION_API")
        out.append({"id": review["id"], "state": review["state"], "commitId": commit, "submittedAt": when,
                    "bodySha256": hashlib.sha256(raw).hexdigest(), "body": raw})
    out.sort(key=lambda r: (r["submittedAt"], r["id"]))
    if len({r["id"] for r in out}) != len(out):
        raise fail("EXECUTION_API", PHASE)
    return out


def review_snapshot_digest(reviews: list, owner_id: int) -> str:
    """Contract C §4: SHA-256 of the domain prefix and the canonical JSON Owner review list."""
    entries = [{key: r[key] for key in ("id", "state", "commitId", "submittedAt", "bodySha256")}
               for r in _owner_reviews(reviews, owner_id)]
    canonical = json.dumps(entries, indent=2, ensure_ascii=False) + "\n"
    return hashlib.sha256(SNAPSHOT_PREFIX + canonical.encode("utf-8")).hexdigest()


def _is_blocker(review: dict) -> bool:
    """Contract C §3: an older Owner review that an approve must explicitly supersede."""
    if review["state"] in BLOCKING_STATES:
        return True
    if review["state"] != ATTESTATION_STATE or not review["body"].startswith(HEADER.rstrip(b"\n")):
        return False
    try:
        att = parse_attestation(review["body"])
    except ForgeFail:  # parse_attestation only raises REVIEW_FORMAT: malformed blocks
        return True
    return att["action"] == "revoke" or att["externalReviewResult"] == "request_changes" \
        or att["report"]["result"] == "request_changes" or att["report"]["blocking"]


def select_attestation(reviews: list, *, owner_id: int, binding: dict, profile: str,
                       developer_provider: str | None) -> dict:
    """Bind the decisive Owner review to the expected inputs; summary on success, else FAIL."""
    if not isinstance(binding, dict) or set(binding) != set(BINDING_FIELDS) or profile not in PROFILES:
        raise fail("EXECUTION_INTERNAL", PHASE)
    published = _owner_reviews(reviews, owner_id)
    if not published:
        raise fail("REVIEW_MISSING", PHASE)
    position = len(published) - 1  # the latest published Owner review decides; no fallback
    decisive, older = published[position], published[:position]
    if decisive["state"] != ATTESTATION_STATE:
        raise fail("REVIEW_BLOCKED", PHASE)
    att = parse_attestation(decisive["body"])
    if att["action"] != "approve":
        raise fail("REVIEW_BLOCKED", PHASE)
    report = att["report"]
    provider_rule = profile == "DEV" and developer_provider in OPENAI_DEVELOPERS
    codes = set()
    binding_ok = (
        decisive["commitId"] == binding["head"],
        all(att["binding"][name] == binding[name] for name in BINDING_FIELDS),
        report["binding"] == {name: att["binding"][name] for name in REPORT_BINDING_FIELDS},
        report["reviewer"] == att["externalReviewer"],
        report["result"] == att["externalReviewResult"],
        att["reportHash"] == att["externalReviewHash"],
        not provider_rule or att["externalReviewer"]["provider"] == "anthropic",
    )
    if not all(binding_ok):
        codes.add("REVIEW_BINDING")
    if att["externalReviewResult"] == "request_changes" or report["blocking"]:
        codes.add("REVIEW_BLOCKED")
    blockers = {r["id"]: r for r in older if _is_blocker(r)}
    listed = set()
    for entry in att["supersedes"]:  # exact set, no transitivity, current hash and state
        current = blockers.get(entry["reviewId"])
        if entry["reviewId"] in listed or current is None or entry["bodyHash"] != current["bodySha256"] \
                or entry["state"] != current["state"]:
            codes.add("REVIEW_BINDING")
        listed.add(entry["reviewId"])
    if set(blockers) - listed:
        codes.add("REVIEW_BLOCKED")
    if codes:
        raise fail(min(codes, key=CODES.index), PHASE)
    return {
        "reviewId": decisive["id"],
        "bodySha256": decisive["bodySha256"],
        "commitId": decisive["commitId"],
        "submittedAt": decisive["submittedAt"],
        "externalReviewer": att["externalReviewer"],
        "externalReviewHash": att["externalReviewHash"],
        "deployment": att["deployment"],
        "supersedes": sorted(listed),
        "providerRule": provider_rule,
        "independence": "owner_attested",
    }
