# Initial Pilot Baseline — human status guide

This document describes the initial integration snapshot only. It is **not** a status database, a Forge source of truth, or a release declaration.

Scope: the pilot history through `b9339d213476265d919cf3d33c0503e8bb3dc23c`, plus the two explicitly authorized test-only changes below and the new baseline documentation. Existing historical contracts, approvals, and reviews were not rewritten.

## Included

Mystery:

- TASK-0001 — immutable CaseTruth.
- TASK-0001a — safe-integer and red-herring test coverage.
- TASK-0002 — semantic case validator.
- TASK-0003 — immutable CaseSolution answer key.
- TASK-0004 v1 implementation — NPC knowledge, beliefs, and visible projection.
- M1 regression-test fix: original `1de7efeefccb8c0ab130b582d1389f7fc0f5ebf8`, integrated by provenance-preserving cherry-pick `e5764eebbca885f70aabffab4c427b52857d45b4`. Only snapshot/projection object-identity test coverage changes.

Forge:

- CORE 0001A and CORE 0001B.
- FORGE-CORE-0001A-PATCH-0001.
- FORGE-CORE-0001B v2 repair.
- Red-Team tests and independent reference model.
- Test-only replay-parity hardening: `d44b193c2108f579f769ed60a097a3e7adaa1319` sets **20,000 ms only** for `long mixed logs > replay equals step-by-step application`. The prior 5-second Vitest default timed out on the pre-M1 baseline too. Workload, assertions, global worker settings, and production code are unchanged; this test checks parity, not a performance SLA.

Tooling: the existing TypeScript/Vitest/Zod project setup and lockfile.

## Review evidence

The [new ChatGPT review record](reviews/FORGE-CORE-0001B.v2.chatgpt-review.md) records PASS for the Forge-Core A-Patch/B-v2 repair at `811ed0d3a2322c0f1c65726422ad6ae8ca0d2f0e`, as communicated by the owner. It does not independently approve this entire baseline, M1, or the later timeout adjustment.

## Historical / non-authoritative as current status

- Coordination checkpoints.
- Earlier Red-Team reports describing findings subsequently repaired.
- Historical “pending review” statements: retained as records of their original time.
- TASK-0005 v1 architecture review: bound to an older contract on another branch, not to an included TASK-0005 implementation.

These records retain historical evidentiary value. Do not rewrite them from this index.

## Not included

- TASK-0005 implementation.
- TASK-0005 v2 final contract/review state.
- TASK-0006.
- Dialogue implementation.
- Forge PWA, backend, or cloud runner.

## Known process debt and limits

- Mystery TASK-0001–0003 do not have complete repository-native Forge contract/approval provenance.
- TASK-0004 v1 uses historical YAML metadata and its approval history is not Forge-Core-compliant.
- Core A-v1/B-v1 contracts and approvals remain historical foundations. The A-Patch and B-v2 contract add explicit repair rules; B-v2 does not replace all of B-v1.
- Forge-Core B-v2 sidecar registration is still open.
- The eventlog is authoritative; arbitrary structural state objects are outside the trust boundary.
- Incompatible historical log shapes are not migrated.
- RT-12 and known performance limits remain.
- Hash-bound contract fixtures require original LF bytes. A Windows verification clone should preserve them, for example with `git -c core.autocrlf=false clone ...`; do not normalize signed historical documents silently.

The initial PR preserves the original pilot commit history. No squash, rebase, or reconstructed development history is implied. This is an **INITIAL PILOT BASELINE**, not “Forge V0.1 Release”.
