---json
{
  "forgeContractFormat": 1,
  "taskId": "FORGE-BOOTSTRAP-0001A",
  "contractVersion": 2,
  "baseCommit": "3d7545d843883418348004e68717399a64da7a7d",
  "dependencies": [],
  "scope": {
    "create": [
      "tools/forge_v01/errors.py",
      "tools/forge_v01/process.py",
      "tools/forge_v01/paths.py",
      "tools/forge_v01/objects.py",
      "tools/forge_v01/history.py",
      "tools/forge_v01/materialize.py",
      "tools/forge_v01/bootstrap.py",
      "tools/forge_v01/stage0.py",
      "tests/forge-v01/git-objects.test.ts",
      "tests/forge-v01/paths.test.ts",
      "tests/forge-v01/materialize.test.ts",
      "tests/forge-v01/bootstrap.test.ts",
      "tests/forge-v01/properties-a.test.ts"
    ],
    "modify": []
  },
  "requiredChecks": [
    {"name":"baseline","command":"forge-v01:baseline"},
    {"name":"acceptance","command":"forge-v01:acceptance-a"},
    {"name":"mutations","command":"forge-v01:mutations-a"}
  ],
  "mutationSmoke": "required"
}
---

# FORGE-BOOTSTRAP-0001A — Repair Candidate v2

## Status
DRAFT repair candidate. Contract-only change. No implementation, registration, GitHub setting, workflow activation, PR or merge is authorized.

This candidate preserves Format 1 and the original A scope. It repairs only certified contract defects assigned to A. Platform/Ruleset duties, Owner acceptance, review authority, native check association and execution-isolation deployment gates are not duplicated here.

## Primary responsibility
A is the sole primary owner for:
- trusted Git acquisition and object/layout validation;
- path/mode/history validation before execution;
- safe filesystem materialization;
- bounded subprocess primitives used by A;
- second-parent protection above BASE;
- object/framing resource accounting.

A is not the owner of worker-container isolation (B), review/final authority (C), repository rulesets/merge method (Platform/Ruleset), or acceptance publication (Owner Procedure).

## Normative implementation scope
Implement the trusted Bootstrap/Object/Path/Process/Materialization boundary corresponding to original §§2–5, 11–12 with the same APIs:
`runBounded`, `cleanEnv`, `readCommit`, `readTree`, `collectTree`, `collectChanges`, `validateHistory`, `validatePath`, `validatePathSet`, `materialize`, `destroy`, `bootstrapTrustedObjects`, `loadBaseVerifier`.

No checkout, merge-tree, rename heuristic, shell eval, untrusted hook, package script, PR code execution, or implicit remote ref is permitted.

## Resource budgets — repaired
The previous text must not treat framed object data and diagnostic subprocess output as one lifetime byte budget.

The following channels are distinct and MUST be metered independently:

1. **Object payload budget.** A single Git object payload MUST be at most 8 MiB = 8,388,608 bytes. Exceeding this limit is `GIT_LIMIT`.
2. **Frame/header budget.** For `cat-file --batch`-style framed reads, each header line MUST be at most 256 bytes including its terminating LF. Framing bytes are not charged against the 8 MiB object payload limit.
3. **Aggregate object-data budget.** Object payload bytes for one verifier operation MUST be streamed and counted separately from process diagnostics. The configured operation limit is 512 MiB. The implementation MUST NOT buffer the whole aggregate stream.
4. **Diagnostic output budget.** stdout/stderr that is diagnostic rather than the trusted framed object channel is limited to 1 MiB combined per child process. Exceeding it is `PROCESS_LIMIT`.
5. **No lifetime conflation.** A long-lived batch process MAY carry multiple valid framed objects provided each frame and the aggregate object-data budget remain valid. The diagnostic output budget MUST NOT be reused as a cap on framed object bytes.

For an object of exactly 8 MiB with a valid header, the frame is valid if the header is <=256 bytes and the aggregate limit remains available. This explicitly closes the 8,388,663-byte framing counterexample.

Where one observation violates more than one bound, structural framing validation precedes payload size classification for that frame; after a valid frame is established, payload/aggregate `GIT_LIMIT` precedes downstream path/history interpretation.

## History — repaired second-parent rule
Let `BASE` be the accepted comparison base and `HEAD` the candidate head.

- Every commit on the first-parent walk from HEAD down to but excluding BASE MUST have **exactly one parent**.
- That sole parent MUST be the next commit in the validated chain toward BASE.
- BASE itself MAY be a merge commit and is not rejected merely for having more than one parent.
- Any commit above BASE with zero parents or two-or-more parents is `GIT_HISTORY`.
- A second parent MUST NOT be ignored merely because the first parent still reaches BASE.
- History-count limits are evaluated before ancestry-shape interpretation. A walk requiring 129 commits when the configured maximum is 128 is `GIT_LIMIT`, not `GIT_HISTORY`.

This rule is the sole normative owner of second-parent protection; B and C consume A's history result and MUST NOT reimplement it.

## Filesystem materialization
Every parent component MUST be opened relative to the trusted root with `dir_fd` and `O_NOFOLLOW`; leaves MUST use exclusive creation and be checked as regular files with expected link count and bounded bytes. No symlink/graft/alternate/shallow/promisor/config escape may be silently normalized.

## Acceptance deltas
Existing A acceptance cases remain unchanged except:
- AV-071: 129-commit history MUST resolve to `GIT_LIMIT`.
- NEW AV-178: a commit above BASE with a valid first parent to BASE plus an attacker-controlled second parent MUST resolve to `GIT_HISTORY`.
- NEW AV-179: an exactly-8-MiB object with a valid <=256-byte batch header MUST be accepted by the framing layer when aggregate budget remains; 8 MiB + 1 byte payload MUST be `GIT_LIMIT`.

No acceptance case may infer execution-isolation success from A.

## Required verifier mutations — repaired
All mutations remain local test instruments, maximum four.

**A1 — replace-reference authority bypass.**
After implementation bytes are frozen, patch exactly the single authority decision that would allow an OID resolved through `refs/replace` (or equivalent replace-object resolution) to be accepted while all raw-object rehash checks remain untouched. Dedicated test: a replaced object whose raw requested OID does not name the accepted original object MUST fail on the unmutated implementation and MUST incorrectly pass only under the mutant. If such a one-site patch cannot be identified, A1 is INVALID rather than killed.

**A2 — parent symlink traversal.**
Remove `O_NOFOLLOW` from exactly one parent-directory open. Dedicated parent-symlink fixture MUST change from reject to unsafe acceptance. Compiler/import failures do not count.

**A3 — mode-change omission.**
Remove exactly the emission/check of `MODE_CHANGE` while leaving content comparison intact. Dedicated mode-only and mode+content assertions MUST fail under the mutant.

**A4 — raw duplicate collapse.**
Move exactly one raw-tree duplicate check after construction of the map/dictionary so the second raw entry overwrites the first. No other duplicate guard may remain on that path. Dedicated duplicate-raw-entry assertion MUST fail under the mutant.

Mutation evidence MUST record: frozen source blob hash, exact anchor bytes, replacement bytes, proof patch applied once, named assertion that was green before mutation, and mutated result. Earlier guard failure, changed error code, syntax/import/compiler failure, timeout or harness failure is NOT a kill.

## Properties and scale
Tree and Path property families: at least 10,000 deterministic iterations each with an independent oracle. Measure 100/1,000/10,000 files and 1k/10k/100k objects under the explicit resource limits. Absolute milliseconds are observational, not acceptance gates.

## Size
The prior 1,320 LOC ±30% total estimate is retained as realistic task scale across the eight production modules. No total "<400 LOC" fiction is introduced. A single production module SHOULD remain below 400 LOC; exceeding that is an architecture-review signal, not permission to delete required semantics.

## Implementability
A has no dependency on B or C. Its generated BASE stub remains a Lab-only harness input and MUST NOT implement B/C product semantics. A is independently implementable after architecture approval.

## Execution-isolation boundary
A's subprocess cleanup/process-group controls are necessary but do not prove containment of adversarial executed code. Container/cgroup/VM lifecycle, setsid-descendant containment, network/credential isolation and hostile test execution belong to B plus Deployment acceptance. A MUST NOT claim those guarantees.

## Verdict target
If this candidate is approved without further findings: **READY FOR ARCHITECTURE REVIEW** and **REGISTRATION READY AFTER ARCHITECTURE APPROVAL**.
