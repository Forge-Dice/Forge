---json
{
  "forgeContractFormat": 1,
  "taskId": "FORGE-BOOTSTRAP-0001B",
  "contractVersion": 2,
  "baseCommit": "3d7545d843883418348004e68717399a64da7a7d",
  "dependencies": [{"taskId":"FORGE-BOOTSTRAP-0001A","acceptedCommit":null}],
  "scope": {
    "create": [
      "tools/forge_v01/contract-adapter.mjs",
      "tools/forge_v01/policy.py",
      "tools/forge_v01/scope.py",
      "tools/forge_v01/inventory-reporter.mjs",
      "tools/forge_v01/inventory.py",
      "tools/forge_v01/worker.py",
      "tools/forge_v01/mutations.py",
      "tools/forge_v01/vitest.config.mjs",
      "tests/forge-v01/policy-scope.test.ts",
      "tests/forge-v01/inventory.test.ts",
      "tests/forge-v01/worker.test.ts",
      "tests/forge-v01/mutations.test.ts",
      "tests/forge-v01/properties-b.test.ts"
    ],
    "modify": []
  },
  "requiredChecks": [
    {"name":"baseline","command":"forge-v01:baseline"},
    {"name":"acceptance","command":"forge-v01:acceptance-b"},
    {"name":"mutations","command":"forge-v01:mutations-b"}
  ],
  "mutationSmoke": "required"
}
---

# FORGE-BOOTSTRAP-0001B — Repair Candidate v2

## Status
DRAFT repair candidate. Contract-only change. It remains non-executable while A.acceptedCommit is null. No accepted SHA is invented.

## Primary responsibility
B is sole primary owner for:
- exact task scope/freeze checks after A has established trusted Git facts;
- trusted BASE toolchain and BASE/HEAD test inventory comparison;
- worker/container execution protocol and measurable isolation probes;
- mutation application and kill classification;
- worker report transport/schema.

B is not the owner of Git history or second-parent protection (A), review/final authority (C), repository rulesets/merge method (Platform/Ruleset), or dependency acceptance publication (Owner Procedure).

## Dependency
A MUST be independently accepted by Owner Procedure before B can execute. Before execution, this candidate MUST be revised with the real A acceptedCommit and then-current authoring baseCommit, re-parsed and re-hashed. Null is intentionally blocking.

Commit ancestry is only a structural check that the accepted A commit is reachable from the selected base. It is NOT proof that A was accepted. The authoritative acceptance fact comes from the Owner Procedure and is an external bootstrap prerequisite.

## Scope and freeze
Exact create/modify membership only; no prefix matching. Deletes, mode changes and implicit coordination exceptions are forbidden unless explicitly enumerated. Existing tests, manifest/lock, compiler/test runner config and verifier TCB stay frozen against HEAD unless the contract scope explicitly authorizes a change.

## Test inventory — repaired schema
Runtime test inventory records are strict objects:
`{ fullName, file, project, ancestors, title, occurrence, status }`.

Rules:
1. `status` is one of `passed|failed|skipped|todo`.
2. `occurrence` is a positive integer assigned deterministically within the exact structural tuple `(file,project,ancestors,title)`.
3. Two records with the same `fullName` MAY coexist only when their full structural tuples differ and each tuple/occurrence pair is unique.
4. Repeating the same tuple/occurrence twice is `INVENTORY_SCHEMA`.
5. If the same `fullName` is used for two records with different structural tuples, both records remain distinct; replacement/collapse by a dictionary keyed only by fullName is forbidden.
6. BASE inventory must be complete and all BASE records passed. HEAD must contain every BASE structural tuple/occurrence and all must pass. Additions are allowed only if complete and passed.
7. Missing tests cannot be compensated by newly added tests with the same count or title.

This closes the previous ambiguity without moving review authority into B.

## Worker execution and isolation — repaired acceptance semantics
The worker remains a fresh container/sandbox with read-only trusted inputs/toolchain, no Docker socket, no Actions command files, no credentials, no host PID/network, explicit cgroup CPU/RAM/PID/time/disk/output limits, no package lifecycle scripts, and test network disabled.

A denied hostile probe is accepted only from **measured worker evidence**, not an invented supervisor event. For each required denial probe the bounded worker report MUST contain:
`{probeId, attempted, denied, observationKind, observationCode}`.
`observationKind` is one of `errno|exit|signal|network`; `observationCode` is a closed ASCII token. Examples include `EACCES`, `EPERM`, `EROFS`, a nonzero helper exit dedicated to the probe, or a measured network denial. `attempted=true && denied=true` is required. Absence of a supervisor-side access notification is neither success nor failure.

If the platform cannot demonstrate the requested namespace/cgroup/seccomp/read-only/network constraints, integration is NO-GO; there is no unsandboxed fallback. This is a deployment acceptance gate, not proof against kernel exploits or setsid escape outside the container/cgroup lifecycle.

## Worker transport
Exactly one bounded strict JSON report crosses from worker to supervisor. stdout is not trusted as a semantic report and workflow-command-like output must not be echoed into privileged host logs. Report framing and diagnostic process output use separate byte budgets; B consumes A's bounded process primitive but owns the worker report limit.

## Mutation classification — repaired
Infrastructure always dominates mutation outcome. A mutation is `KILLED` only if:
- the exact frozen patch applied once;
- the unmutated named assertion was green;
- toolchain/bootstrap succeeded;
- execution completed within limits;
- the named assertion failed for the expected semantic reason.

Compiler/import failure, timeout, OOM, signal, missing report, schema-invalid report, harness failure, unrelated earlier rejection or merely different error code is `INFRA_FAILURE` or `INVALID_MUTANT`, never KILLED.

## Required verifier mutations — repaired
Maximum four.

**B1 — exact-scope prefix weakness.**
Patch only the equality/membership decision so an allowed `src/a.ts` incorrectly authorizes a distinct `src/a.ts.evil`. Use two valid regular files so path/mode guards do not mask the scope defect.

**B2 — inventory-count weakness.**
Patch only BASE→HEAD inventory comparison from structural multiset inclusion to count equality. Fixture removes one BASE test and adds one different passing test while total count stays equal. The dedicated inventory assertion must fail under the mutant.

**B3 — infra-as-kill weakness.**
Patch only the final mutation classifier so a controlled compiler failure after a successfully applied mutant is classified `KILLED` instead of `INFRA_FAILURE`. No earlier classifier or timeout guard may remain able to reject first. Dedicated classifier-unit assertion is the detector.

**B4 — developer fallback.**
Patch only the authority decision that accepts a Developer-supplied `detected:true` when independent mutation evidence is absent. Dedicated fixture has syntactically valid fake developer evidence and no trusted kill; only the mutant may accept.

Each mutant record MUST carry frozen blob hash, exact anchor/replacement bytes, application count, baseline assertion, mutated assertion and masking analysis.

## Acceptance deltas
- AV-115: fullName reuse is valid only under the strict distinct-structural-tuple rule above; tuple/occurrence collapse is reject.
- AV-123/124/125: denied-access probes are adjudicated from measured worker evidence, not a presumed supervisor access event.
- NEW AV-183: remove one BASE test and add one different passing test with identical total count => reject inventory.
- NEW AV-184: hostile read/network/write probe reports attempted+denied with an allowed observationKind/code => isolation probe passes; missing/forged `attempted` or `denied` => reject.

## Properties and scale
Scope/Inventory/Mutation property families each run at least 10,000 deterministic iterations. No absolute millisecond gate.

## Size
Retain realistic total estimate 1,190 LOC ±30% across B production modules. No artificial <400-total target. Individual modules SHOULD remain below 400 LOC; if architecture review finds a module cannot do so without compression, split the module, not the security semantics.

## Implementability
B depends only on accepted A APIs and an externally pinned acceptance image/harness. B does not require C. No A↔B cycle exists.

## Verdict target
If this candidate is approved after A's real acceptedCommit is inserted: **READY FOR ARCHITECTURE REVIEW**.
