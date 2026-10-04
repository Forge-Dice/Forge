# FORGE V0.1 — EI Acceptance Contract

| ID | Normative requirement |
|---|---|
| EI-01 | `forge-gate` MUST NOT execute/import/source/install/compile/collect any PR-controlled byte; HEAD is data only. |
| EI-02 | `forge-verify` MUST run as a distinct fresh GitHub-hosted standard-runner job after Gate success. |
| EI-03 | Stage 2 MUST independently re-bind repository ID, PR, base/main SHA, head SHA and task/contract identity. |
| EI-04 | Dependency install MUST use trusted baseline lockfile plus `npm ci --ignore-scripts`; PR lifecycle scripts/config MUST NOT run. |
| EI-05 | Typecheck/tests MUST invoke trusted binaries and trusted configs directly; PR npm scripts, Vitest/Vite configs, candidate TS config, loaders and `NODE_OPTIONS` are non-authoritative. |
| EI-06 | All untrusted test/typecheck code MUST run inside an inner sandbox, never directly on the Actions runner host. |
| EI-07 | Sandbox network MUST be disabled, including host/loopback/service/package-registry access. |
| EI-08 | Sandbox MUST be non-root, no added capabilities, `no-new-privileges`, no host PID namespace, no Docker socket. |
| EI-09 | Candidate/trusted inputs MUST be read-only; only bounded supervisor-created scratch/output paths may be writable. |
| EI-10 | Symlinks/gitlinks/unsafe modes MUST be rejected pre-materialization; path/link escape MUST fail closed. |
| EI-11 | Sandbox env MUST be rebuilt from an allowlist and exclude `GITHUB_TOKEN`, Actions runtime/service credentials, secrets, OIDC material, proxy creds, inherited HOME/PATH/npm config and `NODE_OPTIONS`. |
| EI-12 | Workflow/job permissions MUST be minimal; no write token/secret may be exposed to any PR-influenced step/process. |
| EI-13 | Sandbox HOME/TMP/cache roots MUST start empty and be discarded; no mutable cache bridge from Stage 1. |
| EI-14 | Untrusted code MUST NOT access/write `GITHUB_OUTPUT`, `GITHUB_ENV`, summaries, trusted verifier/toolchain/config, or final evidence artifacts. |
| EI-15 | Final evidence/artifacts MUST be assembled by trusted supervisor only after sandbox exit and schema/content validation. |
| EI-16 | Timeout/termination MUST cover the whole sandbox process tree/namespace; detached/setsid children must not survive. |
| EI-17 | Explicit finite CPU, memory, PID/process-count, writable-byte/file-count and stdout/stderr bounds MUST be enforced. |
| EI-18 | Test enumeration, materialization and archive/artifact creation MUST enforce finite count/byte/depth limits and fail closed. |
| EI-19 | Sandbox image/runtime MUST be pinned to an owner-reviewed immutable digest/version on `ubuntu-24.04`. |
| EI-20 | Live activation MUST adversarially prove no network, no host/HOME/temp escape, no credential/env exposure, no surviving process, working resource bounds, read-only mounts and no Stage1→Stage2 mutable channel. |
