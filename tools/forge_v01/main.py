"""BASE verifier entry: forge-gate / forge-verify orchestration only (PKG §2, §4, §10; contract C §2).

Started by stage0 as `python -I main.py --bootstrap-version=1 --base=<B> --manifest-sha256=<hex>
--event <file> --facts <file> --workspace <dir>`. The subcommand (gate or verify) is the `job` field
of the runner facts written by the trusted host. All semantics live in the A/B/C modules; this file
only sequences them and prints exactly one fixed-shape record. Exit 0 only on GATE_PASS / full PASS.
"""

import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import hashlib  # noqa: E402
import json  # noqa: E402
import re  # noqa: E402
import time  # noqa: E402

import bootstrap  # noqa: E402
import final  # noqa: E402
import github  # noqa: E402
import inventory  # noqa: E402
import mutations  # noqa: E402
import policy  # noqa: E402
import reviews  # noqa: E402
import scope  # noqa: E402
import worker  # noqa: E402
from errors import ForgeFail, fail  # noqa: E402
from materialize import destroy, materialize  # noqa: E402

BOOTSTRAP_VERSION = 1
SUBCOMMANDS = {"forge-gate": "gate", "forge-verify": "verify"}
FACTS_LIMIT = 64 * 1024
MANIFEST_PATH = "forge/verifier/bootstrap-manifest.json"
PARSER_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_IMAGE = re.compile(r"[a-z0-9][a-z0-9._/-]{0,200}@(sha256:[0-9a-f]{64})")
_SHA1, _SHA256 = re.compile(r"[0-9a-f]{40}"), re.compile(r"[0-9a-f]{64}")


def parse_argv(argv: list) -> dict:
    """The fixed stage0 argv; anything else is EXECUTION_INTERNAL with a fixed record."""
    if not isinstance(argv, list) or len(argv) != 9 or argv[3::2] != ["--event", "--facts", "--workspace"]:
        raise fail("EXECUTION_INTERNAL", "gate")
    prefixes = ("--bootstrap-version=", "--base=", "--manifest-sha256=")
    values = [arg[len(p):] if isinstance(arg, str) and arg.startswith(p) else None for arg, p in zip(argv, prefixes)]
    paths = argv[4::2]
    if values[0] != str(BOOTSTRAP_VERSION) or not _SHA1.fullmatch(values[1] or "") or not _SHA256.fullmatch(values[2] or "") \
            or not all(isinstance(p, str) and p.startswith("/") and "\0" not in p for p in paths):
        raise fail("EXECUTION_INTERNAL", "gate")
    return {"base": values[1], "manifest": values[2], "event": argv[4], "facts": argv[6], "workspace": argv[8]}


def _read(path: str, limit: int) -> bytes:
    with open(path, "rb") as handle:
        return handle.read(limit + 1)


def _subdir(workspace: str, name: str) -> str:
    path = os.path.join(workspace, name)
    os.mkdir(path, 0o700)
    return path


def gate_checks(args: dict, event: bytes, facts: dict, ws: str, *, _seams=None) -> dict:
    """Bootstrap (A), policy/contract/scope (B), review snapshot (C). Same algorithm in both jobs."""
    trusted = bootstrap.bootstrap_trusted_objects(event, facts, _subdir(ws, "bootstrap"), _seams=_seams)
    if trusted.base != args["base"]:
        raise fail("PR_STALE", "gate")
    if trusted.live.state != "open" or trusted.live.draft is not False:
        raise fail("PR_STATE", "gate")  # PKG §4 phase 2: the verifier rejects draft PRs itself
    parsed = bootstrap.strict_json(event, bootstrap.EVENT_LIMIT, "PR_INPUT")
    head_ref = parsed["pull_request"]["head"].get("ref")  # shape already checked by parse_event; branch only
    with trusted.store() as store:
        snapshot, pol, _ = policy.load_policy(store, trusted.base)
        manifest = snapshot.by_path().get(MANIFEST_PATH)
        if manifest is None or hashlib.sha256(store.read_blob(manifest.oid)).hexdigest() != args["manifest"]:
            raise fail("POLICY_INVALID", "gate")
        if pol["bootstrapVersion"] != BOOTSTRAP_VERSION:
            raise fail("POLICY_INVALID", "gate")
        image = _IMAGE.fullmatch(facts.get("image") or "")
        if image is None or image.group(1) != pol["imageDigest"]:
            raise fail("POLICY_DEPLOYMENT", "gate")
        bound = policy.gate_task(store, trusted.base, trusted.live.author_id, bootstrap.REPO_ID, head_ref,
                                 parser_root=PARSER_ROOT, private=_subdir(ws, "adapter"))
        scope.check_scope_for(store, trusted.base, trusted.head, bound["plan"], bound["metadata"]["scope"],
                              bound["profile"], bound["contractPath"])
    transport = trusted.seams.transport
    owner_reviews = github.read_reviews(transport, trusted.event.pr, phase="review")
    developer = pol["developers"][0]["provider"] if bound["profile"] == "DEV" and pol["developers"] else None
    binding = {"repoId": bootstrap.REPO_ID, "pr": trusted.event.pr, "base": trusted.base, "head": trusted.head,
               "contractHash": bound["contractHash"], "verifierSha": trusted.base, "policyHash": bound["policyHash"],
               "runId": trusted.event.run_id, "runAttempt": trusted.event.run_attempt}
    current = {"runId": binding["runId"], "runAttempt": binding["runAttempt"], "B": trusted.base, "H": trusted.head,
               "contractHash": bound["contractHash"], "policyHash": bound["policyHash"], "verifierSha": trusted.base,
               "reviewSnapshotDigest": reviews.review_snapshot_digest(owner_reviews, pol["ownerId"])}
    return {"trusted": trusted, "policy": pol, "bound": bound, "image": image.group(0), "reviews": owner_reviews,
            "binding": binding, "current": current, "developer": developer}


def attestation(g: dict) -> dict:
    return reviews.select_attestation(g["reviews"], owner_id=g["policy"]["ownerId"], binding=g["binding"],
                                      profile=g["bound"]["profile"], developer_provider=g["developer"])


def run_gate(g: dict) -> dict:
    """Missing attestation marks reviewPending and does not fail the gate; any other review failure does."""
    try:
        attestation(g)
        pending = False
    except ForgeFail as failure:
        if failure.code != "REVIEW_MISSING":
            raise
        pending = True
    return {"format": 1, "outcome": "GATE_PASS", "reviewPending": pending, "receipt": final.make_receipt(g["current"])}


def run_worker(g: dict, ws: str) -> None:
    """B: BASE baseline, HEAD typecheck/tests/inventory, mutants; then every workspace is destroyed (PKG §5, §10)."""
    work = _subdir(ws, "work")
    try:
        _worker_steps(g, work)
    except BaseException:
        try:
            destroy(work)
        except ForgeFail:
            pass  # the primary failure stands; the runner VM is discarded anyway
        raise
    destroy(work)  # a cleanup failure is EXECUTION_IO: no PASS


def _worker_steps(g: dict, ws: str) -> None:
    trusted, plan, image = g["trusted"], g["bound"]["plan"], g["image"]
    suite = g.get("suiteDeadline", worker.SUITE_DEADLINE)
    with trusted.store() as store:
        base = store.collect_tree(store.read_commit(trusted.base).tree)
        head = store.collect_tree(store.read_commit(trusted.head).tree)  # scope passed: only approved paths differ
        leaves = base.by_path()
        executable = frozenset(p for p, leaf in leaves.items() if leaf.mode == "100755")
        modules = worker.install_base_toolchain(store.read_blob(leaves["package.json"].oid),
                                                store.read_blob(leaves["package-lock.json"].oid), _subdir(ws, "install"),
                                                image=image)
        base_tests = sorted((p for p in leaves if p.startswith("tests/") and p.endswith(".test.ts")), key=str.encode)
        head_tests = sorted(set(base_tests) | set(plan["addedTestFiles"]), key=str.encode)
        base_root = materialize(store, base, _subdir(ws, "base"), executable=executable)
        worker.prepare_case(base_root)
        base_run = worker.run_tests(base_root, modules, _subdir(ws, "base-run"), base_tests, role="base", image=image,
                                    deadline=suite)
        inventory.check_baseline(base_run["report"].inventory)  # PKG §11: a red BASE before any HEAD phase
        head_root = materialize(store, head, _subdir(ws, "head"), executable=executable)
        worker.prepare_case(head_root)
        worker.run_typecheck(head_root, modules, _subdir(ws, "head-tsc"), image=image)
        head_run = worker.run_tests(head_root, modules, _subdir(ws, "head-run"), head_tests, role="head", image=image,
                                    deadline=suite)
        listed = worker.list_tests(head_root, modules, _subdir(ws, "head-list"), head_tests, image=image, deadline=suite)
        inventory.compare_inventory(base_run["report"].inventory, head_run["report"].inventory,
                                    plan["addedTestFiles"], head_tests, listed)
        if plan["mutants"]:
            records = mutations.run_mutants(store, head, plan["mutants"], _subdir(ws, "mutants"), modules,
                                            executable=executable, image=image)
            mutations.aggregate(plan["mutants"], {r["id"]: r for r in records})


def run_verify(g: dict, facts: dict, ws: str) -> dict:
    receipt = final.parse_receipt(facts.get("receipt"))
    final.check_stage2_start(receipt, g["current"], g["current"]["reviewSnapshotDigest"])
    run_worker(g, ws)
    chosen = attestation(g)
    trusted, owner = g["trusted"], g["policy"]["ownerId"]
    transport, ev = trusted.seams.transport, trusted.event
    run = github.read_run(transport, ev.run_id, ev.run_attempt)
    final.check_attempt_jobs(github.read_jobs(transport, ev.run_id, ev.run_attempt), run, receipt, owner, True)
    snapshots = final.take_final_snapshots(transport, ev.pr, ev.run_id, ev.run_attempt)
    expected = {"attestation": chosen, "ownerId": owner, "repoId": bootstrap.REPO_ID, "pr": ev.pr, "B": trusted.base,
                "H": trusted.head, "runId": ev.run_id, "runAttempt": ev.run_attempt, "recheckRequired": True}
    bound = final.final_recheck(snapshots, receipt, expected)
    final.check_deployment(chosen["deployment"], g["policy"]["deploymentPolicyDigest"], time.time())
    return {"format": 1, "outcome": "PASS", "policyAssurance": "owner_attested", "taskId": g["bound"]["taskId"],
            "profile": g["bound"]["profile"], "B": trusted.base, "H": trusted.head, "runId": ev.run_id,
            "runAttempt": ev.run_attempt, "reviewSnapshotDigest": bound["reviewSnapshotDigest"],
            "attestationId": bound["attestationId"], "executionIsolation": "not_established"}


def main(argv: list, *, _seams=None, _suite_deadline=None) -> int:
    """`_seams`, `_suite_deadline`: keyword-only and test-only (bootstrap.Seams with lower-only budgets; a
    BASE/HEAD suite deadline that may only lower worker.SUITE_DEADLINE); `__main__` passes neither."""
    try:
        if _suite_deadline is not None and (type(_suite_deadline) not in (int, float)
                                            or not 0 < _suite_deadline <= worker.SUITE_DEADLINE):
            raise fail("EXECUTION_INTERNAL", "gate")
        args = parse_argv(argv)
        event = _read(args["event"], bootstrap.EVENT_LIMIT)
        facts = bootstrap.strict_json(_read(args["facts"], FACTS_LIMIT), FACTS_LIMIT, "PR_INPUT", "gate")
        command = SUBCOMMANDS.get(facts.get("job")) if isinstance(facts, dict) else None
        if command is None:
            raise fail("PR_INPUT", "gate")
        ws = _subdir(args["workspace"], "verifier")
        g = gate_checks(args, event, facts, ws, _seams=_seams)
        if _suite_deadline is not None:
            g["suiteDeadline"] = _suite_deadline
        record = run_gate(g) if command == "gate" else run_verify(g, facts, ws)
    except ForgeFail as failure:
        record = failure.record()
    except Exception:  # never echo untrusted text; a fixed internal record only
        record = fail("EXECUTION_INTERNAL", "gate").record()
    sys.stdout.write(json.dumps(record, sort_keys=True, separators=(",", ":")) + "\n")
    return 0 if record["outcome"] in ("PASS", "GATE_PASS") else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
