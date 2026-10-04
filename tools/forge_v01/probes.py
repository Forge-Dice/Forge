"""Isolation probes of the worker sandbox (AV-123..125, AV-184; PKG §6, contract B §5).

The trusted probe entry (worker-probe.mjs) runs with exactly the worker flags and attempts each forbidden
access once; this module only validates the measured records. Any deviation is EXECUTION_SANDBOX.
"""

from __future__ import annotations

import json
import re

import worker
from errors import fail
from inventory import HEADER_LIMIT, PAYLOAD_LIMIT

PROBE_RULES = {
    "network": ("network", frozenset({"ENETUNREACH", "EHOSTUNREACH"})),
    "docker-socket": ("errno", frozenset({"ENOENT", "EACCES", "EPERM"})),
    "actions-command-file": ("errno", frozenset({"ENOENT", "EACCES", "EPERM", "EROFS"})),
    "readonly-case": ("errno", frozenset({"EROFS", "EACCES", "EPERM"})),
    "readonly-test-file": ("errno", frozenset({"EROFS", "EACCES", "EPERM"})),
    "readonly-node-modules": ("errno", frozenset({"EROFS", "EACCES", "EPERM"})),
    "readonly-trusted": ("errno", frozenset({"EROFS", "EACCES", "EPERM"})),
    "readonly-rootfs": ("errno", frozenset({"EROFS", "EACCES", "EPERM"})),
    "proc-parent-mem": ("errno", frozenset({"EACCES", "EPERM"})),
    "proc-parent-fd": ("errno", frozenset({"EACCES", "EPERM"})),
}
PROBE_KINDS = frozenset({"errno", "exit", "signal", "network"})
PROBE_KEYS = frozenset({"probeId", "attempted", "denied", "observationKind", "observationCode"})


def validate_probes(records) -> None:
    """Every required probe exactly once, attempted=true, denied=true, allowed kind/code; else EXECUTION_SANDBOX."""
    seen = set()
    for record in records if type(records) is list else [None]:
        if type(record) is not dict or set(record) != PROBE_KEYS or record["probeId"] not in PROBE_RULES \
                or record["probeId"] in seen or record["attempted"] is not True or record["denied"] is not True:
            raise fail("EXECUTION_SANDBOX", "worker")
        kind, codes = PROBE_RULES[record["probeId"]]
        if record["observationKind"] not in PROBE_KINDS or record["observationKind"] != kind \
                or type(record["observationCode"]) is not str or record["observationCode"] not in codes:
            raise fail("EXECUTION_SANDBOX", "worker")
        seen.add(record["probeId"])
    if seen != set(PROBE_RULES):
        raise fail("EXECUTION_SANDBOX", "worker")


def parse_probe_report(raw: bytes) -> list:
    """The probe report uses the same frame grammar; payload {"format":1,"probes":[...]}."""
    magic = b"FORGE-REPORT-V1 "
    end = raw.find(b"\n", 0, HEADER_LIMIT)
    digits = raw[len(magic):end] if end > 0 and raw.startswith(magic) else b""
    if not re.fullmatch(rb"[1-9][0-9]{0,6}", digits) or len(raw) != end + 1 + int(digits) or int(digits) > PAYLOAD_LIMIT:
        raise fail("EXECUTION_SANDBOX", "worker")
    try:
        payload = json.loads(raw[end + 1:].decode("utf-8"), parse_constant=lambda _: 1 / 0)
    except (ValueError, ZeroDivisionError, UnicodeError):
        raise fail("EXECUTION_SANDBOX", "worker") from None
    if type(payload) is not dict or set(payload) != {"format", "probes"} or payload["format"] != 1:
        raise fail("EXECUTION_SANDBOX", "worker")
    return payload["probes"]


def run_probes(case_root: str, node_modules: str, workspace: str, *, image: str | None = None, docker_host=None,
               _runner=None) -> list:
    """Run the trusted probe entry with exactly the worker flags; return the measured, validated records."""
    spec = worker._spec("probe", (worker.NODE, worker.TRUSTED + "/probe.mjs"), case_root, node_modules, 30.0)
    seen = worker._execute(worker._pick_runner(image, workspace, docker_host, _runner), spec, workspace)
    if seen.timed_out or seen.exit_code != 0:
        raise fail("EXECUTION_SANDBOX", "worker")
    records = parse_probe_report(seen.stdout)
    validate_probes(records)
    return records
