"""Test-only seams for the Task A bootstrap and stage 0 (driver side, never in the image).

Builds bootstrap.Seams with a local remote and a fixed API answer map, so the TCB modules
carry no test transport. Budgets can only be lowered: Seams.checked() enforces it.
"""

import json

import process
from bootstrap import Seams, bootstrap_base, fetch_head, list_refs
from errors import fail
from stage0 import load_base_verifier, run_verifier


class FixedTransport:
    """Test transport: answers from a fixed {path: body} map; a list value yields successive bodies."""

    def __init__(self, answers: dict):
        self.answers = {path: list(body) if isinstance(body, list) else [body] for path, body in answers.items()}
        self.requests: list[str] = []

    def get(self, path: str) -> bytes:
        self.requests.append(path)
        queue = self.answers.get(path)
        if not queue:
            raise fail("EXECUTION_API", "bootstrap")
        body = queue.pop(0) if len(queue) > 1 else queue[0]
        return json.dumps(body).encode() if not isinstance(body, (bytes, str)) else (body.encode() if isinstance(body, str) else body)


def seams_for_test(remote: str, answers: dict, **budgets) -> Seams:
    return Seams(remote=remote, transport=FixedTransport(answers), **budgets)


def bootstrap_for_test(event_bytes: bytes, runner_facts: dict, workspace: str, seams: dict, *, head: bool = True) -> dict:
    """Driver entry: runs the bootstrap with test seams and returns plain facts."""
    built = seams_for_test(seams["remote"], seams["answers"], **seams.get("budgets", {}))
    result = bootstrap_base(event_bytes, runner_facts, workspace, _seams=built)
    if head:
        result = fetch_head(result)
    refs = list_refs(result.odb, result.private)
    return {"base": result.base, "head": result.head, "refs": refs, "requests": built.transport.requests,
            "live": result.live}


def default_seams_report() -> dict:
    seams = Seams()
    return {"remote": seams.remote, "transport": type(seams.transport).__name__,
            "fetch_deadline": seams.fetch_deadline, "disk_budget": seams.disk_budget,
            "extra_config": list(seams.extra_git_config()), "fetch_argv": process.git_argv("ODB", "fetch")}


def run_for_test(event_bytes: bytes, runner_facts: dict, workspace: str, seams: dict) -> dict:
    """Driver entry: load the BASE verifier with test seams, run it, return plain facts."""
    built = seams_for_test(seams["remote"], seams["answers"], **seams.get("budgets", {}))
    loaded = load_base_verifier(event_bytes, runner_facts, workspace, _seams=built)
    result = run_verifier(loaded, workspace, [], deadline_seconds=30.0)
    return {"loaded": loaded, "returncode": result.returncode, "stdout": result.stdout.decode("utf-8", "replace")}


def docker_runner_for_test(docker: str, workspace: str, image: str, deadline: float | None = None) -> dict:
    """Driver entry: worker.DockerRunner against a fake docker client binary (test only).

    deadline None: only the pre-start check. Otherwise one probe-shaped run with that deadline.
    """
    import worker

    runner = worker.DockerRunner(image, workspace, docker=docker)
    runner.check()
    if deadline is None:
        return {"checked": True}
    spec = worker.Spec("probe", (worker.NODE, worker.TRUSTED + "/probe.mjs"), tuple(sorted(worker.WORKER_ENV.items())),
                       ((worker.CASE, workspace, True),), deadline)
    seen = runner.run(spec)
    return {"exitCode": seen.exit_code, "timedOut": seen.timed_out, "overflow": seen.overflow}


def materialize_rows_for_test(store, rows: list, destination: str) -> str:
    """Driver entry: materialize a Snapshot built from raw [path, mode, oid] rows (no A-side validation)."""
    from materialize import materialize
    from objects import Leaf, Snapshot

    return materialize(store, Snapshot("", tuple(Leaf(p, m, o) for p, m, o in rows)), destination)
