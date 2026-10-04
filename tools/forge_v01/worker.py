"""Worker sandbox protocol: install, typecheck, test transport and isolation probes (PKG §6, contract B §4/§5).

Every worker is a fresh Docker container with exactly the PKG §6 flags; there is no unsandboxed
fallback. Worker roles run the trusted entry (/trusted/entry.mjs, written from this module, never
from HEAD): it discards the child's stdout/stderr under a budget and afterwards writes exactly the
bytes of the one report file (/out/report, bounded) to its own stdout. The supervisor trusts only
the container exit it observed itself plus the strictly parsed report; nothing is echoed.
LocalRunner is a TEST-ONLY seam (keyword `_runner=`): same entry argv as a plain bounded
subprocess, no isolation at all, used so tests can drive real Vitest without a Docker daemon.
"""

from __future__ import annotations

import json
import os
import re
import secrets
import shutil
import tempfile
from dataclasses import dataclass

import process
from errors import ForgeFail, fail
from inventory import HEADER_LIMIT, PAYLOAD_LIMIT, parse_report
from materialize import destroy

TOOLS = os.path.dirname(os.path.abspath(__file__))
DOCKER = "/usr/bin/docker"
NODE = "/opt/node/bin/node"
NPM = "/opt/node/bin/npm"
CASE, MODULES, TRUSTED, OUT, TMP = "/case", "/case/node_modules", "/trusted", "/out", "/tmp"
REPORT_PATH, PLAN_PATH = "/out/report", "/trusted/plan.json"
WORKER_FLAGS = ("--network=none", "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges", "--pids-limit=128",
                "--cpus=2", "--memory=2g", "--memory-swap=2g", "--user=10001:10001")
WORKER_ENV = {"PATH": "/opt/node/bin:/usr/bin:/bin", "HOME": "/tmp/home", "TMPDIR": "/tmp", "LANG": "C.UTF-8", "LC_ALL": "C.UTF-8",
              "TZ": "UTC", "CI": "true", "NO_COLOR": "1", "FORGE_REPORT_PATH": REPORT_PATH, "FORGE_VITEST_PLAN": PLAN_PATH}
# PKG §6 names npm_config_globalconfig=/dev/null too, but npm 10 then aborts ("double-loading config /dev/null").
# /dev/null/npmrc can never exist (ENOTDIR), so no global config is loaded either.
INSTALL_ENV = {"PATH": "/opt/node/bin:/usr/bin:/bin", "HOME": "/tmp/install-home", "TMPDIR": "/tmp", "LANG": "C.UTF-8",
               "LC_ALL": "C.UTF-8", "TZ": "UTC", "CI": "true", "NO_COLOR": "1", "npm_config_userconfig": "/dev/null",
               "npm_config_globalconfig": "/dev/null/npmrc", "npm_config_cache": "/tmp/npm-cache",
               "npm_config_registry": "https://registry.npmjs.org/"}
INSTALL_ARGV = (NPM, "ci", "--ignore-scripts", "--no-audit", "--no-fund")
TYPECHECK_ARGV = (NODE, MODULES + "/typescript/bin/tsc", "--project", CASE + "/tsconfig.json", "--noEmit")
# --configLoader native: Vite would otherwise bundle the config into a temp file next to it (EROFS on /trusted).
VITEST_ARGV = (NODE, MODULES + "/vitest/vitest.mjs", "run", "--config", TRUSTED + "/vitest.config.mjs", "--configLoader", "native")
ENTRY_ARGV = (NODE, TRUSTED + "/entry.mjs")
INSTALL_DEADLINE, TYPECHECK_DEADLINE, SUITE_DEADLINE, MUTANT_DEADLINE = 180.0, 60.0, 120.0, 30.0
TRANSPORT_LIMIT = HEADER_LIMIT + PAYLOAD_LIMIT + 64 * 1024  # report bytes plus docker-client stderr
_SAFE_SOURCE = re.compile(r"/[A-Za-z0-9._/-]{1,4000}")
_IMAGE = re.compile(r"[a-z0-9][a-z0-9._/-]{0,200}(:[A-Za-z0-9._-]{1,128})?(@sha256:[0-9a-f]{64})?")


@dataclass(frozen=True)
class Spec:
    role: str  # base | head | mutant | probe | install
    argv: tuple  # container view; argv[0] becomes --entrypoint
    env: tuple  # sorted (key, value) pairs, all fixed by this module
    mounts: tuple  # (target, host source, readonly)
    deadline: float
    plan: dict | None = None  # written to /trusted/plan.json with the runner's view of /case


@dataclass(frozen=True)
class Observed:
    exit_code: int | None  # None: no exit observed (timeout, transport overflow)
    timed_out: bool
    stdout: bytes  # the transported report bytes; never echoed
    overflow: bool = False



def _script(name: str) -> bytes:
    """A trusted JS script that lives next to this module in the verified BASE tree."""
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), name), "rb") as handle:
        return handle.read()

def docker_argv(role: str, mounts, image: str, name: str, argv, env, docker: str = DOCKER) -> list[str]:
    """The complete `docker run` argv: exactly the PKG §6 worker flags, fixed tmpfs, allowlisted binds and env."""
    install = role == "install"
    if role not in ("base", "head", "mutant", "probe", "install") or not _IMAGE.fullmatch(image) or not argv \
            or {k for k, _ in env} - set(INSTALL_ENV if install else WORKER_ENV):
        raise fail("EXECUTION_INTERNAL", "worker")
    owner = "uid=10001,gid=10001,mode=0700"
    out = [docker, "run", "--rm", "--pull=never", "--log-driver=none", f"--name={name}"]
    out += ["--network=bridge" if install else "--network=none", *WORKER_FLAGS[1:]]
    out += [f"--tmpfs={TMP}:rw,noexec,nosuid,nodev,size={'512m' if install else '64m'},{owner}"]
    if not install:
        out += [f"--tmpfs={OUT}:rw,noexec,nosuid,nodev,size=16m,{owner}"]
    for target, source, readonly in mounts:
        if target not in (CASE, MODULES, TRUSTED) or not _SAFE_SOURCE.fullmatch(source) or "/../" in source + "/":
            raise fail("EXECUTION_INTERNAL", "worker")
        out.append(f"--mount=type=bind,source={source},target={target}" + (",readonly" if readonly else ""))
    out += [f"--workdir={CASE}", *(f"--env={k}={v}" for k, v in env), f"--entrypoint={argv[0]}", image]
    return out + list(argv[1:])


def _client_env(workspace: str, docker_host: str | None) -> dict:
    env = process.clean_env("python", workspace)
    env["DOCKER_CONFIG"] = os.path.join(workspace, "docker-config")  # never a user/runner docker config
    if docker_host is not None:
        if not re.fullmatch(r"unix:///[A-Za-z0-9._/-]{1,200}", docker_host):
            raise fail("EXECUTION_INTERNAL", "worker")
        env["DOCKER_HOST"] = docker_host
    return env


class DockerRunner:
    """Production runner. Checks client, daemon, seccomp and the local image before the first start."""

    def __init__(self, image: str, workspace: str, *, docker_host: str | None = None, docker: str = DOCKER):
        self.image, self.docker, self.env, self.checked = image, docker, _client_env(workspace, docker_host), False

    def _docker(self, *args: str, deadline: float = 15.0) -> process.Completed:
        try:
            return process.run_bounded([self.docker, *args], self.env, deadline_seconds=deadline, output_limit=1024 * 1024)
        except (ForgeFail, OSError):
            raise fail("EXECUTION_SANDBOX", "worker") from None

    def check(self) -> None:
        if self.checked:
            return
        version = self._docker("version", "--format", "{{.Server.Version}}")
        security = self._docker("info", "--format", "{{json .SecurityOptions}}")
        image = self._docker("image", "inspect", "--format", "{{.Id}}", self.image)
        try:
            options = json.loads(security.stdout)
        except ValueError:
            options = None
        options = options if type(options) is list and all(type(o) is str for o in options) else []
        seccomp = [o for o in options if o == "name=seccomp" or o.startswith("name=seccomp,")]
        # A daemon started with --seccomp-profile=unconfined still lists "name=seccomp,profile=unconfined".
        if version.returncode or not version.stdout.strip() or security.returncode or not seccomp \
                or any("profile=unconfined" in o.split(",") for o in seccomp) or image.returncode:
            raise fail("EXECUTION_SANDBOX", "worker")
        self.checked = True

    def view(self, target: str, spec: Spec) -> str:
        return target

    def run(self, spec: Spec) -> Observed:
        self.check()
        name = "forge-v01-" + secrets.token_hex(8)
        for _target, source, readonly in spec.mounts:
            if not readonly and os.geteuid() == 0:
                os.chown(source, 10001, 10001)  # the only writable bind (install dir) belongs to the worker user
        try:
            done = process.run_bounded(docker_argv(spec.role, spec.mounts, self.image, name, spec.argv, spec.env, self.docker), self.env,
                                       deadline_seconds=spec.deadline, output_limit=TRANSPORT_LIMIT)
        except ForgeFail as failure:
            # killing the client does not stop the container; an unconfirmed removal may leave it running
            if self._docker("rm", "-f", name).returncode != 0:
                raise fail("EXECUTION_SANDBOX", "worker") from None
            if failure.code == "EXECUTION_TIMEOUT":
                return Observed(None, True, b"")
            if failure.code == "EXECUTION_IO":
                return Observed(None, False, b"", True)
            raise fail("EXECUTION_SANDBOX", "worker") from None
        except OSError:
            raise fail("EXECUTION_SANDBOX", "worker") from None
        if done.returncode in (125, 126, 127):  # docker could not create/start the container
            raise fail("EXECUTION_SANDBOX", "worker")
        return Observed(done.returncode, False, done.stdout)


class LocalRunner:
    """TEST ONLY. Runs the same container-view argv as a bounded host subprocess with paths mapped.

    It provides NO isolation (no network/user/mount namespace); production never constructs it.
    """

    def __init__(self, node: str, scratch: str):
        self.node, self.scratch = node, scratch

    def _mapping(self, spec: Spec, tmp: str, out: str) -> list:
        pairs = [("/opt/node/bin", os.path.dirname(self.node)), (TMP, tmp), (OUT, out)]
        pairs += [(target, source) for target, source, _ in spec.mounts]
        return sorted(pairs, key=lambda pair: -len(pair[0]))

    def view(self, target: str, spec: Spec) -> str:
        for mount, source, _ in spec.mounts:
            if target == mount:
                return source
        return target

    def run(self, spec: Spec) -> Observed:
        tmp, out = (os.path.realpath(tempfile.mkdtemp(dir=self.scratch)) for _ in range(2))
        mapping = self._mapping(spec, tmp, out)

        def host(value: str) -> str:
            for prefix, source in mapping:
                if value == prefix or value.startswith(prefix + "/"):
                    return source + value[len(prefix):]
            return value

        mounts = {target: source for target, source, _ in spec.mounts}
        if CASE in mounts and MODULES in mounts and not os.path.islink(os.path.join(mounts[CASE], "node_modules")):
            os.chmod(mounts[CASE], 0o755)  # emulate the nested bind mount with a symlink (test only)
            os.rmdir(os.path.join(mounts[CASE], "node_modules"))
            os.symlink(mounts[MODULES], os.path.join(mounts[CASE], "node_modules"))
            os.chmod(mounts[CASE], 0o555)
        argv = [host(a) for a in spec.argv]
        env = {k: ":".join(host(p) for p in v.split(":")) for k, v in spec.env}
        try:
            done = process.run_bounded(argv, env, deadline_seconds=spec.deadline, cwd=mounts.get(CASE),
                                       output_limit=TRANSPORT_LIMIT)
        except ForgeFail as failure:
            if failure.code not in ("EXECUTION_TIMEOUT", "EXECUTION_IO"):
                raise
            return Observed(None, failure.code == "EXECUTION_TIMEOUT", b"", failure.code == "EXECUTION_IO")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
            shutil.rmtree(out, ignore_errors=True)
        return Observed(done.returncode, False, done.stdout)


def _pick_runner(image: str | None, workspace: str, docker_host: str | None, runner):
    if runner is None:
        if image is None:
            raise fail("EXECUTION_SANDBOX", "worker")
        return DockerRunner(image, workspace, docker_host=docker_host)
    return LocalRunner(runner, workspace) if isinstance(runner, str) else runner


def prepare_case(case_root: str) -> None:
    """Mountpoint for /case/node_modules (HEAD may not provide one), then make the tree read-only for uid 10001."""
    try:
        os.mkdir(os.path.join(case_root, "node_modules"), 0o555)
    except FileExistsError:
        raise fail("EXECUTION_SANDBOX", "worker") from None
    for _dir, _subdirs, _files, dirfd in os.fwalk(case_root, follow_symlinks=False):
        os.fchmod(dirfd, 0o555)


def _write(path: str, data: bytes) -> None:
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC, 0o444)
    try:
        os.write(fd, data)
    finally:
        os.close(fd)


def _execute(runner, spec: Spec, workspace: str) -> Observed:
    """Stage a fresh per-run /trusted (BASE config, reporter, entry, probe, plan), run, always clean up."""
    staging = tempfile.mkdtemp(dir=workspace)
    trusted = os.path.join(staging, "trusted")
    os.mkdir(trusted, 0o755)
    try:
        for name in ("vitest.config.mjs", "inventory-reporter.mjs"):
            with open(os.path.join(TOOLS, name), "rb") as source:
                _write(os.path.join(trusted, name), source.read())
        _write(os.path.join(trusted, "entry.mjs"), _script("worker-entry.mjs"))
        _write(os.path.join(trusted, "probe.mjs"), _script("worker-probe.mjs"))
        spec = Spec(spec.role, spec.argv, spec.env, spec.mounts + ((TRUSTED, trusted, True),), spec.deadline, spec.plan)
        if spec.plan is not None:
            plan = {"root": runner.view(CASE, spec), "include": spec.plan["include"]}
            _write(os.path.join(trusted, "plan.json"), json.dumps(plan).encode())
        os.chmod(trusted, 0o555)
        return runner.run(spec)
    finally:
        destroy(staging)


def _spec(role: str, argv: tuple, case_root: str, node_modules: str, deadline: float, plan=None) -> Spec:
    mounts = ((CASE, case_root, True), (MODULES, node_modules, True))
    return Spec(role, ENTRY_ARGV + tuple(argv), tuple(sorted(WORKER_ENV.items())), mounts, deadline, plan)


def install_spec(package_json: bytes, package_lock: bytes, install_dir: str) -> Spec:
    """Stage exactly the BASE manifest and lock (no .npmrc, no HEAD file) and return the install spec."""
    for name, data in (("package.json", package_json), ("package-lock.json", package_lock)):
        _write(os.path.join(install_dir, name), data)
    return Spec("install", INSTALL_ARGV, tuple(sorted(INSTALL_ENV.items())), ((CASE, install_dir, False),), INSTALL_DEADLINE)


def install_base_toolchain(package_json: bytes, package_lock: bytes, workspace: str, *, image: str | None = None,
                           docker_host: str | None = None, _runner=None) -> str:
    """npm ci --ignore-scripts from the BASE blobs in a fresh install container; returns node_modules."""
    runner = _pick_runner(image, workspace, docker_host, _runner)
    install_dir = tempfile.mkdtemp(dir=workspace)
    try:
        seen = runner.run(install_spec(package_json, package_lock, install_dir))
        modules = os.path.join(install_dir, "node_modules")
        if seen.exit_code != 0 or not os.path.isdir(modules) or os.path.islink(modules):
            raise fail("EXECUTION_SANDBOX", "worker")  # AV-122
    except BaseException:
        destroy(install_dir)
        raise
    return modules


def run_typecheck(case_root: str, node_modules: str, workspace: str, *, image: str | None = None, docker_host=None,
                  mutant: bool = False, _runner=None) -> bool:
    seen = _execute(_pick_runner(image, workspace, docker_host, _runner),
                    _spec("mutant" if mutant else "head", TYPECHECK_ARGV, case_root, node_modules, TYPECHECK_DEADLINE), workspace)
    if mutant:
        return seen.exit_code == 0
    if seen.timed_out:
        raise fail("EXECUTION_TIMEOUT", "worker")
    if seen.exit_code != 0:
        raise fail("TEST_COMPILE", "worker")  # AV-120
    return True


def read_report(raw: bytes, *, mutant: bool = False):
    """Exactly one framed report: header <= 64 bytes, payload <= 8 MiB, strict schema (AV-121, AV-186)."""
    try:
        return parse_report(raw)
    except ForgeFail:
        raise fail("MUTANT_INFRA" if mutant else "TEST_INVENTORY", "worker") from None


def run_tests(case_root: str, node_modules: str, workspace: str, include: list, *, role: str = "head",
              image: str | None = None, docker_host=None, deadline: float = SUITE_DEADLINE, _runner=None) -> dict:
    """Fixed Vitest argv over the exact include list. Returns {timedOut, exitCode, report} as observed.

    For base/head a timeout is EXECUTION_TIMEOUT (AV-119) and a bad report TEST_INVENTORY; for a mutant
    both stay observations (report None) for the classifier.
    """
    limit = MUTANT_DEADLINE if role == "mutant" else SUITE_DEADLINE
    if role not in ("base", "head", "mutant") or not 0 < deadline <= limit:
        raise fail("EXECUTION_INTERNAL", "worker")
    spec = _spec(role, VITEST_ARGV, case_root, node_modules, deadline, {"include": list(include)})
    seen = _execute(_pick_runner(image, workspace, docker_host, _runner), spec, workspace)
    code = seen.exit_code
    if code is not None and 128 < code <= 192:
        code = 128 - code  # entry/docker report a signal as 128+n; keep it as -n
    if role != "mutant":
        if seen.timed_out:
            raise fail("EXECUTION_TIMEOUT", "worker")
        return {"timedOut": False, "exitCode": code, "report": read_report(seen.stdout)}
    try:
        report = None if seen.timed_out or seen.overflow else read_report(seen.stdout, mutant=True)
    except ForgeFail:
        report = None
    return {"timedOut": seen.timed_out, "exitCode": code, "report": report}


# ---------------------------------------------------------------- isolation probes (AV-123..125, AV-184)

PROBE_RULES = {
    "network": ("network", frozenset({"ENETUNREACH", "EHOSTUNREACH"})),
    "docker-socket": ("errno", frozenset({"ENOENT", "EACCES", "EPERM"})),
    "actions-command-file": ("errno", frozenset({"ENOENT", "EACCES", "EPERM", "EROFS"})),
    "readonly-case": ("errno", frozenset({"EROFS", "EACCES", "EPERM"})),
    "readonly-test-file": ("errno", frozenset({"EROFS", "EACCES", "EPERM"})),
    "readonly-node-modules": ("errno", frozenset({"EROFS", "EACCES", "EPERM"})),
    "readonly-trusted": ("errno", frozenset({"EROFS", "EACCES", "EPERM"})),
    "readonly-rootfs": ("errno", frozenset({"EROFS", "EACCES", "EPERM"})),
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
    spec = _spec("probe", (NODE, TRUSTED + "/probe.mjs"), case_root, node_modules, 30.0)
    seen = _execute(_pick_runner(image, workspace, docker_host, _runner), spec, workspace)
    if seen.timed_out or seen.exit_code != 0:
        raise fail("EXECUTION_SANDBOX", "worker")
    records = parse_probe_report(seen.stdout)
    validate_probes(records)
    return records
