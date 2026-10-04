"""Test-only harness for e2e-image.test.ts: runs INSIDE the tool image, never part of it.

The image entry (stage0.main) always uses the fixed GitHub remote and api.github.com, so the e2e test
cannot reach it without network. This harness repeats stage0.main step by step with exactly one
difference: the bootstrap gets seams.seams_for_test(<local bare remote>, <fixed API answers>).

  python -I -B e2e_harness.py stage0  <answers.json> <remote> --event E --facts F --workspace W
      image kernel (/opt/forge/bootstrap): stage0.load_base_verifier with test seams, then execve of
      `python -I e2e_harness.py verifier ...` with the argv and clean env stage0.main would give main.py.
  python -I -B e2e_harness.py verifier <answers.json> <remote> <BASE main.py> --bootstrap-version=1 ...
      BASE verifier process: imports the materialized BASE main.py, routes its bootstrap through the
      same test seams and returns main.main(argv) (one record on stdout).
  python -I -B e2e_harness.py adapter <answers.json> <remote> <contract> --event E --facts F --workspace W
      kernel load as above, then execve `... parse <BASE root> <contract> <private>`, which runs the BASE
      policy.parse_contract with the fixed image node over the materialized BASE root.
"""

import json
import os
import sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
KERNEL = "/opt/forge/bootstrap"


def _answers(path: str) -> dict:
    with open(path, "rb") as handle:
        return json.loads(handle.read())


def kernel_load(answers_path: str, remote: str, argv: list):
    """stage0.main up to the execve, with test seams; returns (stage0 module, loaded, private)."""
    sys.path[:0] = [KERNEL, HERE]
    import process  # noqa: E402  (image kernel copies)
    import seams  # noqa: E402
    import stage0  # noqa: E402

    if len(argv) != 6 or argv[0::2] != ["--event", "--facts", "--workspace"]:
        sys.exit(2)
    with open(argv[1], "rb") as handle:
        event = handle.read(stage0.EVENT_READ_LIMIT)
    with open(argv[3], "rb") as handle:
        facts = json.loads(handle.read(64 * 1024))
    built = seams.seams_for_test(remote, _answers(answers_path))
    try:
        loaded = stage0.load_base_verifier(event, facts, argv[5], _seams=built)
    except Exception as exc:  # the same fixed records stage0.main prints
        from errors import ForgeFail, fail

        record = exc.record() if isinstance(exc, ForgeFail) else fail("EXECUTION_INTERNAL", "stage0").record()
        sys.stdout.write(json.dumps(record) + "\n")
        sys.exit(1)
    private = os.path.join(argv[5], "verifier-private")
    process.prepare_private(private)
    return stage0, process, loaded, private


def main() -> int:
    mode, rest = sys.argv[1], sys.argv[2:]
    me = os.path.abspath(__file__)
    if mode == "stage0":
        answers, remote, argv = rest[0], rest[1], rest[2:]
        stage0, process, loaded, private = kernel_load(answers, remote, argv)
        verifier = stage0.verifier_argv(loaded, argv)  # [python, -I, <BASE main.py>, --bootstrap-version=1, ...]
        os.chdir(loaded.root)
        os.execve(sys.executable, [sys.executable, "-I", "-B", me, "verifier", answers, remote, *verifier[2:]],
                  process.clean_env("python", private))
    if mode == "adapter":
        answers, remote, contract, argv = rest[0], rest[1], rest[2], rest[3:]
        stage0, process, loaded, private = kernel_load(answers, remote, argv)
        os.chdir(loaded.root)
        os.execve(sys.executable, [sys.executable, "-I", "-B", me, "parse", loaded.root, contract, private],
                  process.clean_env("python", private))
    if mode == "verifier":
        answers, remote, entry, argv = rest[0], rest[1], rest[2], rest[3:]
        sys.path[:0] = [os.path.dirname(entry), HERE]
        import bootstrap  # noqa: E402  (materialized BASE copies from here on)
        import main as verifier  # noqa: E402
        import seams  # noqa: E402

        real = bootstrap.bootstrap_trusted_objects
        built = seams.seams_for_test(remote, _answers(answers))
        bootstrap.bootstrap_trusted_objects = lambda event, facts, ws: real(event, facts, ws, _seams=built)
        return verifier.main(argv)
    if mode == "parse":
        root, contract, private = rest
        sys.path[:0] = [os.path.join(root, "tools", "forge_v01")]
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
