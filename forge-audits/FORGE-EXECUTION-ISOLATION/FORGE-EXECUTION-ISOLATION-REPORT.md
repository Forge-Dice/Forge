# FORGE V0.1 — EXECUTION ISOLATION SECURITY LAB

## Verdict

**NO-GO.** The required production execution boundary is specified by the existing artifacts but cannot be certified in this lab because no Docker/container runtime is available and `unshare -n` is denied (`Operation not permitted`). The lab therefore verifies installation/fresh-stage controls and demonstrates the hostile capabilities that remain when tests run without the required inner sandbox.

**Fixtures:** 44 total; **17 passed/contained or bounded**, **27 failed/exposed**.

Baseline `main` before audit: `3d7545d843883418348004e68717399a64da7a7d`.

## Sources read directly from audit branches

- `forge/owner/audits/FORGE-V0.1-VERIFIER-IMPLEMENTATION-PACKAGE`
- `forge/owner/audits/VERIFIER-ABC-INDEPENDENT-CERTIFICATION`
- `forge/owner/audits/FORGE-V0.1-BOOTSTRAP`
- `forge/owner/audits/FORGE-VERIFIER-REFERENCE`
- `forge/owner/audits/FORGE-V0.1-ARCHITECTURE-FREEZE`

The implementation package defines a two-job model. `forge-gate` uses event/Git-object data and must not execute PR bytes. `forge-verify` materializes and runs typecheck/tests after Gate. The Bootstrap artifact explicitly requires a fresh Stage-2 job and an inner restricted container. The Reference report records `EXECUTION_ISOLATION_NOT_TESTED` and says its local host supervisor was not a sandbox.

## Stage model

### Stage 1 — Gate

Untrusted HEAD content is data only. Allowed: repository identity, PR/head/base binding, ancestry, contract/scope/tree/path/mode/blob validation and deterministic diff logic. Forbidden: npm against candidate content, imports from HEAD, Vitest collection, candidate config/loader execution, test execution, candidate hooks/scripts.

Stage 1 should need no secret for this public repository. Any GitHub token must remain minimally scoped and must never be transferred into the untrusted process.

### Stage 2 — Verify

Tests/typecheck/mutant execution necessarily runs hostile PR-controlled JavaScript. Therefore two distinct controls are required:

1. fresh standard GitHub-hosted job, independently re-binding repo/PR/base/head/task;
2. inner sandbox around the hostile process.

The sandbox requirements derived from existing artifacts and this lab are: non-root; no added capabilities; no-new-privileges; no host PID/network/Docker socket; read-only trusted/input mounts; bounded writable scratch; scrubbed allowlisted env; no credentials; process-tree lifetime control; CPU/RAM/PID/disk/output limits; trusted supervisor-owned evidence assembly.

## Installation: `npm ci --ignore-scripts`

Six real synthetic npm lifecycle probes were run: `preinstall`, `install`, `postinstall`, `preprepare`, `prepare`, `postprepare`. All six marker payloads were suppressed under `npm ci --ignore-scripts`.

This **does prevent** lifecycle scripts during install. It **does not prevent** code imported later by tests/source, candidate config execution, `NODE_OPTIONS` loaders, child processes, network, HOME/TMP/cache writes, repository/artifact writes, env/credential reads, resource attacks or background processes. It is necessary but not a sandbox.

## Test execution findings

Direct hostile Node execution demonstrated the following capabilities when no inner sandbox exists:

- child-process execution/spawning;
- parent-directory, repository, HOME, temp and cache writes;
- environment disclosure;
- PATH and `NODE_OPTIONS` execution influence;
- artifact poisoning;
- process spawning/background lifetime;
- symlink and hardlink modification of an outside canary;
- visibility of a fake git credential in HOME;
- TCP/HTTP/UDP socket access;
- output flood and large enumeration.

Simple host controls did bound selected cases: timeout terminated an infinite loop; `prlimit` bounded memory pressure; `ulimit -f` blocked oversized file output. These are mechanism demonstrations only, not proof that the future workflow/container applies them correctly.

## Fresh Stage 2

Synthetic Stage1→Stage2 probes showed poisoning survives when HOME/cache, temp/generated config, or artifacts are shared. Equivalent probes with fresh HOME/temp and no artifact bridge did not carry the marker. Therefore a fresh job is necessary, but unsafe caches/artifacts/env/generated config can reintroduce Stage-1 state.

Stage 2 must fetch/re-bind its own Git objects and accept only minimal authenticated identifiers from Gate. No mutable Gate filesystem/cache/artifact should be authority.

## GitHub-hosted runner model

GitHub currently documents that standard `ubuntu-24.04` hosted jobs in public repositories use a new VM per job. GitHub also creates a `GITHUB_TOKEN` for each job and exposes it through Actions context. Thus the fresh-job boundary is useful between Gate and Verify, but it does not isolate hostile code from credentials/files/processes inside Verify itself.

GitHub supplies: fresh hosted job instance and coarse platform ceilings. Forge must supply: the inner sandbox, no-network policy, env/credential scrubbing, mount topology, process-tree containment, bounded resources and trusted evidence assembly.

GitHub's hosted-job maximum is an outer fail-safe, not a sufficient per-test security bound.

## Resource attacks

Observed mechanisms:

- CPU infinite loop: terminated by explicit timeout.
- Memory pressure: terminated/fails under explicit address-space limit.
- Disk/file growth: blocked by explicit file-size limit.
- Output flood: 1 MiB stdout readily produced absent capture bounds.
- Process count: hostile code can spawn children absent PID/cgroup limit.
- Huge enumeration: large enumeration runs unless explicit count/time bounds exist.
- Artifact/disk poisoning: unrestricted writable directories are attacker-controlled.

No unsupported numeric production bounds are invented here. Contract C/workflow must choose finite values and live-validate them against expected workload. Platform VM RAM/disk and global job timeout are too coarse to serve as the sole isolation control.

## Security acceptance contract

See `EI-ACCEPTANCE-CONTRACT.md` (EI-01…EI-20).

## Fixture evidence

`raw-results.json` contains, for all 44 fixtures: `attack`, `expected_containment`, `actual`, `evidence`, `remaining_risk`, `passed`.

Reproduction package: `fixture/run_lab.py` and `fixture/README.md`. Canary-only; no real secrets; no productive workflow execution.

## Remaining live validation required

Before live activation, the actual pinned Stage-2 sandbox on GitHub-hosted `ubuntu-24.04` must prove:

1. no network, including loopback/host/service endpoints;
2. no runner HOME, Actions command files, `GITHUB_TOKEN`, runtime/service credentials, OIDC request material or secrets visible to hostile code;
3. read-only trusted/toolchain/config/input mounts actually reject writes;
4. no write/path/symlink/hardlink escape outside bounded scratch/output;
5. no detached/setsid/background process survives termination;
6. CPU/RAM/PID/disk/file-count/stdout/stderr caps are enforced;
7. HOME/TMP/cache/PATH/npm config/`NODE_OPTIONS` are supervisor-owned and scrubbed;
8. Stage 1 cannot influence Stage 2 via cache, artifact, env, generated config, Git object store or other mutable bridge;
9. candidate code cannot forge final evidence/artifacts or GitHub command files;
10. exact sandbox image/runtime digest and invocation are immutable and owner-reviewed;
11. actual job permissions and fresh-job behavior match the intended model.

## Final conclusion

The prior evidence gap is now characterized with reproducible adversarial evidence, but not closed to PASS: the available environment cannot exercise the required production sandbox. `npm ci --ignore-scripts` passes its intended narrow control; fresh-stage semantics are directionally validated; untrusted tests remain fully capable host code without the inner sandbox. **NO-GO** until the live sandbox drill satisfies EI-01…EI-20.
