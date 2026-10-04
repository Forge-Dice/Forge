"""Test-only harness for drill.test.ts: runs INSIDE the tool image, never part of it.

GitHub is replaced by test seams only (seams.seams_for_test: local bare remote + fixed API answers);
everything else is the image's own code path, entered through stage0.main itself.

  python -I -B e2e_harness.py stage0  <answers.json> <remote> --event E --facts F --workspace W
      image kernel (/opt/forge/bootstrap): stage0.main(argv, _seams=..., _exec=...) does the argv
      parsing, event/facts reads, bootstrap, manifest load and materialization; its _exec hook
      receives exactly what os.execve would (path, [python, -I, <BASE main.py>, --bootstrap-version=1,
      ...], clean env, cwd = BASE root) and execs `verifier` below instead of main.py directly.
  python -I -B e2e_harness.py verifier <answers.json> <remote> <BASE main.py> --bootstrap-version=1 ...
      BASE verifier process: imports the materialized BASE main.py and returns
      main.main(argv, _seams=<the same test seams>) (one record on stdout). Two optional files next to
      <answers.json>: budgets.json ({"suiteDeadline": s} -> main.main(_suite_deadline=s), lower-only) is
      read; requests.json (the API paths the verifier requested, in order) is written afterwards.
  python -I -B e2e_harness.py adapter <answers.json> <remote> <contract> --event E --facts F --workspace W
      stage0.main as above, but the _exec hook execs `parse <BASE root> <contract> <private>`, which runs
      the BASE policy.parse_contract with the fixed image node over the materialized BASE root.
"""

import json
import os
import sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
ME = os.path.abspath(__file__)
KERNEL = "/opt/forge/bootstrap"


def _seams(answers_path: str, remote: str):
    import seams  # noqa: E402  (after sys.path points at the kernel or the BASE root)

    with open(answers_path, "rb") as handle:
        return seams.seams_for_test(remote, json.loads(handle.read()))


def _stage0(answers: str, remote: str, argv: list, then: list) -> int:
    """stage0.main with test seams; its exec lands in this file with `then` + the verifier argv tail."""
    sys.path[:0] = [KERNEL, HERE]
    import stage0  # noqa: E402  (image kernel copy)

    def exec_hook(path: str, verifier_argv: list, env: dict):
        if path != sys.executable or verifier_argv[:2] != [path, "-I"] or not verifier_argv[2].endswith("/main.py"):
            raise SystemExit(3)  # stage0 changed its exec shape: the drill must notice, not adapt
        os.execve(path, [path, "-I", "-B", ME, *then, *verifier_argv[2:]], env)

    return stage0.main(argv, _seams=_seams(answers, remote), _exec=exec_hook)


def main() -> int:
    mode, rest = sys.argv[1], sys.argv[2:]
    if mode == "stage0":
        answers, remote, argv = rest[0], rest[1], rest[2:]
        return _stage0(answers, remote, argv, ["verifier", answers, remote])
    if mode == "adapter":
        answers, remote, contract, argv = rest[0], rest[1], rest[2], rest[3:]
        return _stage0(answers, remote, argv, ["parse", contract])
    if mode == "verifier":
        answers, remote, entry, argv = rest[0], rest[1], rest[2], rest[3:]
        sys.path[:0] = [os.path.dirname(entry), HERE]
        import main as verifier  # noqa: E402  (materialized BASE copies from here on)

        here = os.path.dirname(answers)
        budgets = {}
        if os.path.exists(os.path.join(here, "budgets.json")):
            with open(os.path.join(here, "budgets.json"), "rb") as handle:
                budgets = {"_suite_deadline": json.loads(handle.read())["suiteDeadline"]}
        seams = _seams(answers, remote)
        try:
            return verifier.main(argv, _seams=seams, **budgets)
        finally:
            with open(os.path.join(here, "requests.json"), "w") as handle:
                handle.write(json.dumps(seams.transport.requests))
    if mode == "parse":
        contract, entry, argv = rest[0], rest[1], rest[2:]
        root = os.path.dirname(os.path.dirname(os.path.dirname(entry)))
        private = os.path.join(argv[argv.index("--workspace") + 1], "verifier-private")
        sys.path[:0] = [os.path.dirname(entry)]
        import policy  # noqa: E402
        from errors import ForgeFail  # noqa: E402

        with open(contract, "rb") as handle:
            raw = handle.read()
        try:
            answer = {"ok": policy.parse_contract(raw, root, private=os.path.join(private, "adapter"))}
        except ForgeFail as failure:
            answer = {"fail": failure.record()}
        answer["root"] = root
        answer["rootEntries"] = sorted(os.listdir(root))
        answer["node"] = policy.NODE
        answer["slashNodeModules"] = os.readlink("/node_modules") if os.path.islink("/node_modules") else None
        sys.stdout.write(json.dumps(answer) + "\n")
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
