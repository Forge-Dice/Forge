"""Stage 0 image kernel: loads only the BASE verifier named by the BASE manifest (PKG §2 steps 4-5).

HEAD is never fetched or read here. The verifier entry point is the materialized BASE
tools/forge_v01/main.py; every file it may load is listed with its SHA-256 in the BASE file
forge/verifier/bootstrap-manifest.json, and every import of a listed Python file must be a
standard-library module or another listed module. Anything else is POLICY_INVALID.
"""

from __future__ import annotations

import ast
import hashlib
import json
import os
import sys
from dataclasses import dataclass

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # `python -I` drops the script folder

import process  # noqa: E402
from bootstrap import TrustedBase, bootstrap_base, strict_json  # noqa: E402
from errors import ForgeFail, fail  # noqa: E402
from materialize import materialize  # noqa: E402
from objects import Leaf, Snapshot  # noqa: E402
from paths import validate_path  # noqa: E402

MANIFEST_PATH = "forge/verifier/bootstrap-manifest.json"
ENTRY_PATH = "tools/forge_v01/main.py"
MANIFEST_LIMIT = 256 * 1024
MANIFEST_FILES = 100
PARSER_FILES = frozenset(f"src/forge/{name}.ts" for name in ("contract-document", "primitives", "freeze", "node-sha256"))
BOOTSTRAP_VERSION = 1
VERIFIER_DEADLINE = 20 * 60.0


@dataclass(frozen=True)
class LoadedVerifier:
    base: str
    root: str
    entry: str
    manifest_sha256: str
    files: tuple[tuple[str, str], ...]  # (path, sha256) in manifest order


def _allowed(path: str) -> bool:
    if path in PARSER_FILES:
        return True
    head, _, name = path.rpartition("/")
    return head == "tools/forge_v01" and name.endswith((".py", ".mjs"))


def parse_manifest(raw: bytes) -> tuple[tuple[str, str], ...]:
    manifest = strict_json(raw, MANIFEST_LIMIT, "POLICY_INVALID", "stage0")
    if not isinstance(manifest, dict) or set(manifest) != {"format", "files"} or type(manifest["format"]) is not int or manifest["format"] != 1:
        raise fail("POLICY_INVALID", "stage0")
    files = manifest["files"]
    if not isinstance(files, list) or not 0 < len(files) <= MANIFEST_FILES:
        raise fail("POLICY_INVALID", "stage0")
    out, seen = [], set()
    for item in files:
        if not isinstance(item, dict) or set(item) != {"path", "sha256"}:
            raise fail("POLICY_INVALID", "stage0")
        path, digest = item["path"], item["sha256"]
        if not isinstance(path, str) or not isinstance(digest, str) or len(digest) != 64 or digest.strip("0123456789abcdef"):
            raise fail("POLICY_INVALID", "stage0")
        try:
            if validate_path(path.encode("ascii")) != path:
                raise fail("POLICY_INVALID", "stage0")
        except (ForgeFail, UnicodeEncodeError):
            raise fail("POLICY_INVALID", "stage0") from None
        if not _allowed(path) or path in seen:
            raise fail("POLICY_INVALID", "stage0")
        seen.add(path)
        out.append((path, digest))
    if ENTRY_PATH not in seen:
        raise fail("POLICY_INVALID", "stage0")
    return tuple(out)


def check_imports(sources: dict[str, bytes]) -> None:
    """Every import in a listed .py file is stdlib or another listed module; nothing relative."""
    local = {path.rpartition("/")[2][:-3] for path in sources if path.endswith(".py")}
    for path, raw in sources.items():
        if not path.endswith(".py"):
            continue
        try:
            tree = ast.parse(raw.decode("utf-8"), filename=path)
        except (SyntaxError, UnicodeDecodeError, ValueError):
            raise fail("POLICY_INVALID", "stage0", raw) from None
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                names = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom):
                if node.level != 0 or node.module is None:
                    raise fail("POLICY_INVALID", "stage0", raw)
                names = [node.module]
            else:
                continue
            for name in names:
                top = name.split(".")[0]
                if top not in local and top not in sys.stdlib_module_names:
                    raise fail("POLICY_INVALID", "stage0", raw)


def load_from_base(trusted: TrustedBase, destination: str) -> LoadedVerifier:
    """Read and check the BASE manifest graph from B and materialize exactly those files."""
    with trusted.store() as store:
        commit = store.read_commit(trusted.base)
        snapshot = store.collect_tree(commit.tree)
        leaves = snapshot.by_path()
        manifest_leaf = leaves.get(MANIFEST_PATH)
        if manifest_leaf is None or manifest_leaf.mode != "100644":
            raise fail("POLICY_INVALID", "stage0")
        manifest_raw = store.read_blob(manifest_leaf.oid)
        files = parse_manifest(manifest_raw)
        sources, selected = {}, []
        for path, digest in files:
            leaf = leaves.get(path)
            if leaf is None or leaf.mode != "100644":
                raise fail("POLICY_INVALID", "stage0", path.encode("ascii"))
            raw = store.read_blob(leaf.oid)
            if hashlib.sha256(raw).hexdigest() != digest:
                raise fail("POLICY_INVALID", "stage0", path.encode("ascii"))
            sources[path] = raw
            selected.append(Leaf(path, leaf.mode, leaf.oid))
        check_imports(sources)
        subset = Snapshot(snapshot.tree, tuple(sorted(selected, key=lambda leaf: leaf.path.encode("ascii"))))
        root = materialize(store, subset, destination)
    return LoadedVerifier(trusted.base, root, os.path.join(root, ENTRY_PATH),
                          hashlib.sha256(manifest_raw).hexdigest(), files)


def load_base_verifier(event_bytes: bytes, runner_facts: dict, workspace: str, *, _seams=None) -> LoadedVerifier:
    trusted = bootstrap_base(event_bytes, runner_facts, workspace, _seams=_seams)
    destination = os.path.join(workspace, "trusted-source")
    os.makedirs(destination, mode=0o700, exist_ok=False)
    return load_from_base(trusted, destination)


def verifier_argv(loaded: LoadedVerifier, extra: list[str]) -> list[str]:
    """`python -I` on the BASE entry; cwd and HEAD paths never reach sys.path."""
    if os.path.dirname(os.path.dirname(os.path.dirname(loaded.entry))) != loaded.root:
        raise fail("POLICY_INVALID", "stage0")
    return [sys.executable, "-I", loaded.entry, f"--bootstrap-version={BOOTSTRAP_VERSION}",
            f"--base={loaded.base}", f"--manifest-sha256={loaded.manifest_sha256}", *extra]


def run_verifier(loaded: LoadedVerifier, workspace: str, extra: list[str], *, deadline_seconds: float = VERIFIER_DEADLINE):
    private = os.path.join(workspace, "verifier-private")
    process.prepare_private(private)
    return process.run_bounded(verifier_argv(loaded, extra), process.clean_env("python", private),
                               deadline_seconds=deadline_seconds, cwd=loaded.root, phase="stage0")


def main(argv: list[str]) -> int:
    """Image entry: stage0 --event <file> --facts <file> --workspace <dir>. Exec's the BASE verifier."""
    if len(argv) != 6 or argv[0::2] != ["--event", "--facts", "--workspace"]:
        return 1
    try:
        with open(argv[1], "rb") as handle:
            event = handle.read(EVENT_READ_LIMIT)
        with open(argv[3], "rb") as handle:
            facts = json.loads(handle.read(64 * 1024))
        loaded = load_base_verifier(event, facts, argv[5])
    except ForgeFail as failure:
        sys.stdout.write(json.dumps(failure.record()) + "\n")
        return 1
    except Exception:
        sys.stdout.write(json.dumps(fail("EXECUTION_INTERNAL", "stage0").record()) + "\n")
        return 1
    private = os.path.join(argv[5], "verifier-private")
    process.prepare_private(private)
    os.chdir(loaded.root)
    os.execve(sys.executable, verifier_argv(loaded, argv), process.clean_env("python", private))
    return 1  # not reached


EVENT_READ_LIMIT = 1024 * 1024 + 1

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
