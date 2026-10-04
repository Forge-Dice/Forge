"""Stage 0 image kernel: loads only the BASE verifier named by the BASE manifest (PKG §2 steps 4-5).

HEAD is never fetched or read here. The verifier entry point is the materialized BASE
tools/forge_v01/main.py; every file it may load is listed with its SHA-256 in the BASE file
forge/verifier/bootstrap-manifest.json, and every import of a listed Python file must be a
standard-library module or another listed module; every import/require specifier of a listed
.mjs/.ts file is a `node:` builtin, image Zod or another listed file. Anything else is POLICY_INVALID.
"""

from __future__ import annotations

import ast
import hashlib
import json
import os
import posixpath
import re
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


def _check_python(raw: bytes, local: set) -> None:
    try:
        tree = ast.parse(raw.decode("utf-8"))
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


# -- JS/TS: a deliberately small, conservative module lexer (PKG §2 step 5, §6, AV-185) ------
#
# It tokenizes comments, strings, template literals and regex literals only far enough to find
# every `import`/`export ... from`/`require` site; whatever it cannot classify with certainty
# (an ambiguous `/`, an escape in an identifier or specifier, an unknown character, a
# non-literal loader argument) rejects the file. It never decides that a file is safe on doubt.

JS_PACKAGES = frozenset({"zod"})  # image Zod: the only bare package the BASE parser imports
_BUILTIN = re.compile(r"node:[a-z][a-z0-9_]*(?:/[a-z][a-z0-9_]*)*")
_IDENT = re.compile(r"[A-Za-z_$#][A-Za-z0-9_$]*")
_NUMBER = re.compile(r"[0-9][0-9A-Za-z_.]*|\.[0-9][0-9A-Za-z_]*")
_PUNCT = ("...", ">>>=", "===", "!==", "**=", "<<=", ">>=", ">>>", "&&=", "||=", "??=", "=>", "==", "!=",
          "<=", ">=", "&&", "||", "??", "?.", "++", "--", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=",
          "**", "<<", ">>", "{", "}", "(", ")", "[", "]", ";", ",", "<", ">", "+", "-", "*", "%", "&",
          "|", "^", "!", "~", "?", ":", "=", ".", "@", "/")
# After these identifiers a `/` starts a regex literal; after any other identifier it divides.
_REGEX_KEYWORDS = frozenset({"return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw",
                             "case", "do", "else", "yield", "await"})
_CONTROL = frozenset({"if", "while", "for", "with"})
_STR, _ID, _PUN, _TPL = "str", "id", "pun", "tpl"


def _js_reject(raw: bytes) -> ForgeFail:
    return fail("POLICY_INVALID", "stage0", raw)


def _js_tokens(text: str, raw: bytes) -> list[tuple[str, str]]:
    """(kind, value) tokens with comments and whitespace dropped; string values are raw bodies."""
    tokens: list[tuple[str, str]] = []
    braces: list[str] = []  # "{" block/object, "${" template expression
    parens: list[bool] = []  # True: the parenthesis follows if/while/for/with
    control_close = False  # the last token was `)` closing a control-statement head
    i, n = 0, len(text)
    if text.startswith("#!"):
        i = text.find("\n") if "\n" in text else n

    def template(start: int) -> int:
        j = start
        while j < n:
            c = text[j]
            if c == "\\":
                j += 2
            elif c == "`":
                return j + 1
            elif text.startswith("${", j):
                braces.append("${")
                return j + 2
            else:
                j += 1
        raise _js_reject(raw)

    while i < n:
        c = text[i]
        if c in " \t\r\n\f\v\ufeff":
            i += 1
            continue
        if text.startswith("//", i):
            j = text.find("\n", i)
            i = n if j < 0 else j
            continue
        if text.startswith("/*", i):
            j = text.find("*/", i + 2)
            if j < 0:
                raise _js_reject(raw)
            i = j + 2
            continue
        last = tokens[-1] if tokens else None
        was_control_close, control_close = control_close, False
        if c in "'\"":
            j = i + 1
            while j < n and text[j] != c:
                if text[j] in "\r\n":
                    raise _js_reject(raw)
                j += 2 if text[j] == "\\" else 1
            if j >= n:
                raise _js_reject(raw)
            tokens.append((_STR, text[i + 1:j]))
            i = j + 1
            continue
        if c == "`":
            i = template(i + 1)
            tokens.append((_TPL, ""))
            continue
        if c == "}" and braces and braces[-1] == "${":
            braces.pop()
            i = template(i + 1)
            tokens.append((_TPL, ""))
            continue
        if c == "/":
            # Regex or division: decided by the previous token; ambiguous positions reject.
            if last is None:
                regex = True
            elif last[0] == _ID:
                regex = last[1] in _REGEX_KEYWORDS
            elif last[0] in (_STR, _TPL):
                regex = False
            elif last[1] == ")":
                regex = was_control_close
            elif last[1] == "]":
                regex = False
            elif last[1] in ("}", "++", "--"):
                raise _js_reject(raw)
            else:
                regex = True
            if regex:
                j, in_class = i + 1, False
                while True:
                    if j >= n or text[j] in "\r\n":
                        raise _js_reject(raw)
                    ch = text[j]
                    if ch == "\\":
                        j += 2
                        continue
                    if ch == "[":
                        in_class = True
                    elif ch == "]":
                        in_class = False
                    elif ch == "/" and not in_class:
                        break
                    j += 1
                m = re.compile(r"[a-z]*").match(text, j + 1)
                tokens.append((_STR, ""))  # a regex literal is an operand, like a string
                i = m.end()
                continue
        m = _IDENT.match(text, i)
        if m:
            tokens.append((_ID, m.group()))
            i = m.end()
            continue
        m = _NUMBER.match(text, i)
        if m:
            tokens.append((_ID, m.group()))  # a number is an operand; never a keyword here
            i = m.end()
            continue
        for p in _PUNCT:
            if text.startswith(p, i):
                break
        else:
            raise _js_reject(raw)  # backslash escapes in identifiers, non-ASCII code, ...
        if p == "{":
            braces.append("{")
        elif p == "}":
            if not braces:
                raise _js_reject(raw)
            braces.pop()
        elif p == "(":
            parens.append(last is not None and last[0] == _ID and last[1] in _CONTROL)
        elif p == ")":
            if not parens:
                raise _js_reject(raw)
            control_close = parens.pop()
        tokens.append((_PUN, p))
        i += len(p)
    if braces or parens:
        raise _js_reject(raw)
    return tokens


def _js_specifiers(tokens: list[tuple[str, str]], raw: bytes):
    """Yield every module specifier; any loader site that is not a plain literal rejects."""
    def at(k: int) -> tuple[str, str]:
        return tokens[k] if k < len(tokens) else ("", "")

    def name_list(k: int) -> int:
        # `{ a, b as c, type d, default as e }`: identifiers, commas and string names only.
        k += 1
        while at(k) != (_PUN, "}"):
            if at(k)[0] not in (_ID, _STR) and at(k) != (_PUN, ","):
                raise _js_reject(raw)
            k += 1
        return k + 1

    def from_clause(k: int):
        if at(k) != (_ID, "from") or at(k + 1)[0] != _STR:
            raise _js_reject(raw)
        return at(k + 1)[1]

    for k, (kind, value) in enumerate(tokens):
        if kind != _ID or value not in ("import", "export", "require", "createRequire"):
            continue
        member = at(k - 1) in ((_PUN, "."), (_PUN, "?.")) if k else False
        if value == "createRequire":
            raise _js_reject(raw)
        if value == "require":
            if at(k + 1) != (_PUN, "(") or at(k + 2)[0] != _STR or at(k + 3) != (_PUN, ")"):
                raise _js_reject(raw)
            yield at(k + 2)[1]
        elif value == "import":
            if member:
                continue  # `x.import` is a property name, not a loader
            nxt = at(k + 1)
            if nxt == (_PUN, "."):
                if at(k + 2) != (_ID, "meta"):
                    raise _js_reject(raw)
            elif nxt == (_PUN, "("):
                if at(k + 2)[0] == _STR and at(k + 3) == (_PUN, ")"):
                    yield at(k + 2)[1]
                else:
                    yield ("root",) + _rooted_import(tokens[k + 2:k + 15], raw)
            elif nxt[0] == _STR:
                yield nxt[1]  # import "x"
            else:
                j = k + 1
                if at(j) == (_ID, "type"):
                    j += 1
                if at(j)[0] == _ID and at(j)[1] != "from" or at(j) == (_ID, "from") and at(j + 1) == (_ID, "from"):
                    j += 1  # default binding
                    if at(j) == (_PUN, ","):
                        j += 1
                if at(j) == (_PUN, "*"):
                    if at(j + 1) != (_ID, "as") or at(j + 2)[0] != _ID:
                        raise _js_reject(raw)
                    j += 3
                elif at(j) == (_PUN, "{"):
                    j = name_list(j)
                yield from_clause(j)
        elif value == "export" and not member:
            j = k + 1
            if at(j) == (_ID, "type") and at(j + 1) in ((_PUN, "{"), (_PUN, "*")):
                j += 1
            if at(j) == (_PUN, "*"):
                j += 1
                if at(j) == (_ID, "as"):
                    if at(j + 1)[0] not in (_ID, _STR):
                        raise _js_reject(raw)
                    j += 2
                yield from_clause(j)
            elif at(j) == (_PUN, "{"):
                j = name_list(j)
                if at(j) == (_ID, "from"):
                    yield from_clause(j)


_ROOTED = [(_ID, "pathToFileURL"), (_PUN, "("), (_ID, "join"), (_PUN, "("), (_ID, "root"), (_PUN, ","),
           None, (_PUN, ")"), (_PUN, ")"), (_PUN, "."), (_ID, "href"), (_PUN, ")")]


def _rooted_import(window: list, raw: bytes) -> tuple[str]:
    """The one non-literal dynamic import form: import(pathToFileURL(join(root, "<listed>")).href)."""
    if len(window) < len(_ROOTED):
        raise _js_reject(raw)
    for want, got in zip(_ROOTED, window):
        if want is None:
            if got[0] != _STR:
                raise _js_reject(raw)
        elif got != want:
            raise _js_reject(raw)
    return (window[6][1],)


def _check_specifier(path: str, spec, listed: dict, raw: bytes) -> None:
    if isinstance(spec, tuple):  # ("root", "<path relative to the materialized BASE root>")
        target = spec[1]
    else:
        if _BUILTIN.fullmatch(spec) or spec in JS_PACKAGES:
            return
        if not spec.startswith(("./", "../")):
            raise _js_reject(raw)  # absolute paths, URLs, data:, file:, other bare packages
        target = posixpath.normpath(posixpath.join(posixpath.dirname(path), spec))
    if not re.fullmatch(r"[A-Za-z0-9_.\-/]+", target) or target.startswith(("/", "../")) or target not in listed \
            or not target.endswith((".mjs", ".ts")):
        raise _js_reject(raw)


def _check_js(path: str, raw: bytes, listed: dict) -> None:
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise _js_reject(raw) from None
    for spec in _js_specifiers(_js_tokens(text, raw), raw):
        _check_specifier(path, spec, listed, raw)


def check_imports(sources: dict[str, bytes]) -> None:
    """Every import of a listed file is stdlib/builtin/image Zod or another listed file.

    .py: stdlib or a listed module, nothing relative. .mjs/.ts: `node:` builtins, image Zod, or
    a relative specifier naming another listed file. Every other listed file type rejects.
    """
    local = {path.rpartition("/")[2][:-3] for path in sources if path.endswith(".py")}
    for path, raw in sources.items():
        if path.endswith(".py"):
            _check_python(raw, local)
        elif path.endswith((".mjs", ".ts")):
            _check_js(path, raw, sources)
        else:
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


def main(argv: list[str], *, _seams=None, _exec=None) -> int:
    """Image entry: stage0 --event <file> --facts <file> --workspace <dir>. Exec's the BASE verifier.

    `_seams` and `_exec` are keyword-only and test-only (the image entry below passes neither):
    `_seams` reaches bootstrap_base (bootstrap.Seams.checked(): budgets can only be lowered) and
    `_exec(path, argv, env)` replaces os.execve with the same path, argv, env and cwd.
    """
    if len(argv) != 6 or argv[0::2] != ["--event", "--facts", "--workspace"]:
        return 1
    try:
        with open(argv[1], "rb") as handle:
            event = handle.read(EVENT_READ_LIMIT)
        with open(argv[3], "rb") as handle:
            facts = json.loads(handle.read(64 * 1024))
        loaded = load_base_verifier(event, facts, argv[5], _seams=_seams)
    except ForgeFail as failure:
        sys.stdout.write(json.dumps(failure.record()) + "\n")
        return 1
    except Exception:
        sys.stdout.write(json.dumps(fail("EXECUTION_INTERNAL", "stage0").record()) + "\n")
        return 1
    private = os.path.join(argv[5], "verifier-private")
    process.prepare_private(private)
    os.chdir(loaded.root)
    (_exec or os.execve)(sys.executable, verifier_argv(loaded, argv), process.clean_env("python", private))
    return 1  # not reached


EVENT_READ_LIMIT = 1024 * 1024 + 1

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
