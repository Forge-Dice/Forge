"""Closed failure-code enum and fixed-shape results (PKG §11, FORGE-BOOTSTRAP-0001A).

No dynamic message text ever leaves this module: a failure carries a code, a fixed phase,
reason 0 and optionally the SHA-256 of the raw subject bytes.
"""

from __future__ import annotations

import hashlib

# Enum order is the precedence order inside one phase (PKG §11).
CODES = (
    "GIT_FETCH",
    "GIT_LAYOUT",
    "GIT_OBJECT",
    "GIT_LIMIT",
    "GIT_PATH",
    "GIT_COLLISION",
    "GIT_HISTORY",
    "PR_INPUT",
    "PR_STATE",
    "PR_STALE",
    "IDENTITY_ACTOR",
    "IDENTITY_NAMESPACE",
    "IDENTITY_RECHECK",
    "CONTRACT_PARSE",
    "CONTRACT_BINDING",
    "CONTRACT_DEPENDENCY",
    "SCOPE_PATH",
    "SCOPE_PROTECTED",
    "SCOPE_MODE",
    "TEST_BASELINE",
    "TEST_COMPILE",
    "TEST_INVENTORY",
    "TEST_STATUS",
    "MUTANT_NOT_APPLIED",
    "MUTANT_SURVIVED",
    "MUTANT_INFRA",
    "REVIEW_MISSING",
    "REVIEW_FORMAT",
    "REVIEW_BINDING",
    "REVIEW_BLOCKED",
    "REVIEW_CHANGED",
    "EXECUTION_TIMEOUT",
    "EXECUTION_SANDBOX",
    "EXECUTION_IO",
    "EXECUTION_API",
    "EXECUTION_INTERNAL",
    "POLICY_INVALID",
    "POLICY_CHANGED",
    "POLICY_DEPLOYMENT",
    "POLICY_CHECKS",
)
assert len(CODES) == 40 and len(set(CODES)) == 40

# Codes Task A itself may produce. Everything else belongs to B, C or the platform.
A_CODES = frozenset(
    {
        "GIT_FETCH",
        "GIT_LAYOUT",
        "GIT_OBJECT",
        "GIT_LIMIT",
        "GIT_PATH",
        "GIT_COLLISION",
        "GIT_HISTORY",
        "PR_INPUT",
        "PR_STALE",
        "IDENTITY_ACTOR",
        "EXECUTION_TIMEOUT",
        "EXECUTION_IO",
        "EXECUTION_API",
        "EXECUTION_INTERNAL",
        "POLICY_INVALID",
    }
)

PHASES = ("bootstrap", "objects", "paths", "history", "materialize", "process", "stage0")


class ForgeFail(Exception):
    """The only exception type that crosses an A module boundary."""

    def __init__(self, code: str, phase: str, subject: bytes | None = None, ordinal: int | None = None):
        if code not in CODES:
            raise ValueError("unknown failure code")
        if phase not in PHASES:
            raise ValueError("unknown phase")
        super().__init__(code)
        self.code = code
        self.phase = phase
        self.subject_hash = hashlib.sha256(subject).hexdigest() if subject is not None else None
        self.ordinal = ordinal

    def record(self) -> dict:
        return {
            "format": 1,
            "outcome": "FAIL",
            "phase": self.phase,
            "code": self.code,
            "reason": 0,
            "subjectHash": self.subject_hash,
            "ordinal": self.ordinal,
        }


def fail(code: str, phase: str, subject: bytes | None = None, ordinal: int | None = None) -> ForgeFail:
    return ForgeFail(code, phase, subject, ordinal)


def first(failures: list[ForgeFail]) -> ForgeFail:
    """Deterministic primary failure: enum order, then subject hash, then ordinal."""
    return min(failures, key=lambda f: (CODES.index(f.code), f.subject_hash or "", f.ordinal or 0))
