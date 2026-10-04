---json
{
  "forgeContractFormat": 1,
  "taskId": "FORGE-BOOTSTRAP-0001B",
  "contractVersion": 2,
  "baseCommit": "3d7545d843883418348004e68717399a64da7a7d",
  "dependencies": [
    {
      "taskId": "FORGE-BOOTSTRAP-0001A",
      "acceptedCommit": null
    }
  ],
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
    {
      "name": "baseline",
      "command": "forge-v01:baseline"
    },
    {
      "name": "acceptance",
      "command": "forge-v01:acceptance-b"
    },
    {
      "name": "mutations",
      "command": "forge-v01:mutations-b"
    }
  ],
  "mutationSmoke": "required"
}
---

# FORGE-BOOTSTRAP-0001B — Scope, Toolchain, Test Inventory, Worker and Mutation Runner (contractVersion 2, package r2)

## 0. Status

FINAL r2 CONTRACT TEXT FOR INDEPENDENT ARCHITECTURE REVIEW. Not registered, not approved, not executable. This document authorizes no implementation, registration, push to `main`, GitHub setting, workflow activation, image publication, PR or merge. Approval is given only by the independent architecture review and the Owner (Owner Decision D5: external review by the Anthropic provider, attestation by the Owner); this text does not approve itself.

Package revision: **r2** (`FORGE-BOOTSTRAP-R2`). `contractVersion` 2 supersedes `contractVersion` 1 of the same task. The r1 drafts and the Work repair candidates remain unchanged historical artifacts (hashes in §1).

## 1. Normative binding and precedence

Normative sources, in this order of precedence:

1. **This contract (r2).** Every rule in this document stated as an override of a PKG location replaces the PKG text at that location for this task. Every other rule in this document adds to PKG.
2. **Retained r1 task text.** The sections "Status und bindende Auslegung" (except its "Normative Bindung" sentence, which §1 replaces), "Ergebnis", "Acceptance" and "Dependency" of the r1 draft of the **same task** (hash in the table below) are incorporated by reference, as overridden or extended by this contract. Its "Required Verifier Mutations" section is fully replaced by this contract.
3. **PKG r1** = `FORGE-MINIMUM-VERIFIER-IMPLEMENTATION-PACKAGE.html`, SHA-256 of the raw file `27bb408d01725e5a56306428470802c62ea7089bbeaa970f0a3594010e0eec89` (branch `forge/owner/audits/FORGE-MINIMUM-VERIFIER-IMPLEMENTATION`, commit `bb525bfd230128d3d98f3db744ba23217196c53c`). The whole-file hash binds §§1–18. The r1 section hash for §§1–15 (`0e6d89179623535ed431206b2352dfdb66d8edbfad3340d6f10b77ef63c4f0d4`, compact JSON `[sectionNumber,title,htmlBody]`) remains valid and is a subset of this binding. Where PKG text and this contract disagree, this contract wins; PKG text is never duplicated here except as the quoted OLD side of an override.
4. **FORGE-V0.1-ARCHITECTURE-FREEZE** (branch `forge/owner/audits/FORGE-V0.1-ARCHITECTURE-FREEZE`, commit `a5302309ce321fcfccdd26aee1cf566f7a137096`) for responsibility boundaries, as amended by the accepted Owner Decisions D1–D7 of FORGE-MYSTERY-FINAL-OWNER-RECONCILIATION (raw SHA-256 `7dbcb852519a48a832f3041e9cee28a8755562c7c7a1d35495482485c45949c4`).

Bound Owner Decisions (accepted 2026-10-04): **D1** A/B/C are the Format-1 bootstrap with their own `forge-v01:*` registry keys and per-task size estimates; "new tasks use Format 2" and the 400/20 defaults apply only from BASE = BOOTSTRAPPED. **D2** the Gate review snapshot is bound in the GateReceipt. **D3** closed review schema: severity `info|minor|major|critical`, blocking iff `major|critical`; fail-closed supersedes set without transitivity; Owner-attested provider independence for OWNER_OPS; foreign same-name checks are a deployment acceptance item (`POLICY_DEPLOYMENT`), no extra GET. **D4** R2 merge-commit only; the R3 PR-only Owner bypass is the intended, logged Owner authorization. **D5** reviewer casting. **D6** the 61 Golden cases + 24 property families are the normative regression oracle; the 150-repo corpus is exploratory only. **D7** CORE-0002 runs only after BOOTSTRAPPED under its own policy profile; nothing in A/B/C pulls it forward.

Closed failure-code enum: the 40 codes of PKG §11 remain the only codes. r2 introduces **no** new failure code. Names used by earlier repair drafts that are not in the enum (`PROCESS_LIMIT`, `INVENTORY_SCHEMA`, `INVENTORY_MISMATCH`, `WORKER_REPORT`, `REVIEW_SCHEMA`, `REVIEW_CHANGED_AFTER_GATE`) are mapped to enum codes in this contract and are not valid outputs.

Historical artifacts (unchanged; normative for r2 only as stated in item 2 above; the Work candidates are repair input, not normative):

| Artifact | SHA-256 |
|---|---|
| FORGE-BOOTSTRAP-0001A.contract.DRAFT.md (r1, v1) | `db206a9834a9ff460fade6e8ee88d2dd099873e84bb1b2a779879d94c88d0084` |
| FORGE-BOOTSTRAP-0001B.contract.DRAFT.md (r1, v1) | `b6aa76ffdd5035ffdf5d7ad402659bf83bf861ef39000d6d582429785a3852f2` |
| FORGE-BOOTSTRAP-0001C.contract.DRAFT.md (r1, v1) | `cdddfc96bddc159eb572d84d47babf24af6a1991fe596fabc65c7985c16bcbd1` |
| Work candidate 0001A (FORGE-VERIFIER-ABC-REPAIR, commit `5fdc4169`) | `4f721a4bc7a9c618782a91f6826578dbd2a40507aaf566dbcf77a7fd3ac496a4` |
| Work candidate 0001B | `92be65ef5df7c722422dc8555dc68220eb5434b1c4bf4e8e66a0bcd8cb08e4e1` |
| Work candidate 0001C | `5f008f91918d1c05cdfd3d824aca7c6eab5908626961233ce2c396f2bccc4ad1` |
| Work acceptance-mutant-delta.json | `bb9ef39d315ff7f70d7f854287072c9e85789a285491f83102c85ee2ff5e8c1b` |

`requiredChecks.command` values are bootstrap-lab registry keys, never shell commands (PKG §2 "Produktive Checkregistry"). Until the verifier is installed, an independent trusted lab runner executes them. The new verifier never certifies its own creation; bootstrap acceptance is an explicit external initial-trust step.

## 2. Responsibility and dependency

B is the sole primary owner of:

- strict policy/task-plan/contract binding on BASE (`policy.py`, `contract-adapter.mjs`);
- exact scope, protected paths, freeze and profiles over A's facts (`scope.py`), including the `SCOPE_MODE` decision on A's mode facts;
- trusted BASE toolchain and fixed Vitest config;
- **test inventory authority** (§3);
- worker sandbox protocol, worker report transport and **measured isolation probes** (§5);
- mutation application and **classification** (§6).

B is not the owner of Git objects, paths, history or the second-parent rule (A, consumed via A's APIs), review/attestation/receipt/final (C), rulesets/merge method/required-check source binding (Platform/Ruleset), or acceptance publication (Owner Procedure).

**Dependency.** `FORGE-BOOTSTRAP-0001A` must be independently accepted by the Owner Procedure before B can execute. `acceptedCommit` stays `null` in this revision; no SHA is invented. Before execution a new revision of this document inserts the real A `acceptedCommit` and the then-current authoring `baseCommit`, is canonically re-parsed and re-hashed, **and increases `contractVersion`** (CERT F07). Non-null plus commit ancestry does not prove task acceptance (CERT P05); Policy v1 has no acceptedDependencies map. The only authority for A's acceptance is the documented external, independent Owner acceptance; without it B and C stay blocked (CERT F06). B needs no C API.

## 3. Test inventory authority

**Sole authority.** The inventory is produced only by the trusted BASE `inventory-reporter.mjs` under the trusted `vitest.config.mjs` (PKG §6) inside the worker, transported as one bounded report (§4) and parsed strictly by the trusted supervisor. Developer statements, stdout, test counts, source scans, `vitest list` or file globs are never inventory evidence.

**Schema** is exactly PKG §7: `TestIdentity = [file, project, ancestorTitles[], testTitle, occurrence]`, `occurrence` 0-based and contiguous per `[file, project, ancestorTitles, testTitle]`, `IdentityKey = JSON.stringify(TestIdentity)`. There is no composite `fullName` key; a printed full name is never an identity and never a dictionary key. (The Work candidate's record `{fullName, …, occurrence ≥ 1}` is not adopted; it contradicts PKG §7.)

**Comparison** (PKG §7 HEAD rule, restated for the repaired cases): the BASE identity multiset must be contained in HEAD with every BASE identity `passed`; every additional identity must come from an approved new test file and be `passed`. A missing BASE identity is never compensated by any number of new identities, by an equal total count, or by a new identity that prints the same full name.

Failure codes: duplicate identity, non-contiguous occurrence, missing BASE identity, unknown status, partial or malformed report → `TEST_INVENTORY`; a failed/skipped/todo test in a complete inventory → `TEST_STATUS`; any of these before BASE succeeded → `TEST_BASELINE`.

## 4. Worker report framing (B part of the streaming-budget repair)

Exactly one length-framed strict JSON report crosses from worker to supervisor: payload at most 8 MiB (inventory limit, PKG §2) plus a frame header of at most 64 bytes, inside the 16 MiB `/out` limit. A report over the payload or frame limit → `TEST_INVENTORY`; in a mutant run → `MUTANT_INFRA`. Worker diagnostic stdout/stderr use A's separate diagnostic budget and are never echoed into host logs or parsed as report. This raises no PKG limit.

## 5. Worker sandbox and measured isolation probes

The worker requirements of PKG §6 stay unchanged (separate container per BASE/HEAD/mutant, `--network=none --read-only --cap-drop=ALL --security-opt=no-new-privileges --pids-limit=128 --cpus=2 --memory=2g --memory-swap=2g --user=10001:10001`, default seccomp/AppArmor on, read-only `/case`, `/case/node_modules`, `/trusted`, bounded tmpfs `/tmp` and `/out` only, no Docker socket, host workspace, ODB, event, token or Actions command file, allowlisted env). There is no unsandboxed fallback. This contract names no other sandbox mechanism.

Appends to B acceptance after "Der Worker darf weder Netzwerk noch Docker-Socket/Actions-Commandfiles erreichen; kein stdout-Workflowcommand gelangt ungefiltert ins Hostlog.":

"Evidence: a probe worker with exactly the PKG §6 flags reports **measured denials** (network, Docker socket, Actions command files, read-only paths) in the worker report, locally and on a GitHub-hosted runner of a separately authorized test surface; the verifier decision and the supervisor state stay unchanged. `EXECUTION_SANDBOX` only if the sandbox prerequisite is missing before worker start, an access succeeds, or the probe is not evaluable. Without Docker, B is not acceptable."

Probe record (one per required denial probe, inside the bounded report): `{probeId, attempted, denied, observationKind, observationCode}`; `observationKind ∈ {errno, exit, signal, network}`; `observationCode` a closed ASCII token such as `ENOENT`, `EACCES`, `EPERM`, `EROFS`, `ENETUNREACH`. A probe passes only with `attempted=true` and `denied=true`. Absence of a supervisor-side access notification is neither success nor failure; no supervisor sensor is assumed.

A measured probe proves the configured constraint on that run only. It is not proof against kernel exploits, `setsid` escape outside the container/cgroup lifecycle, or in-process reporter forgery (PKG §6 transport paragraph). The live proof is the deployment gate in C §9.

## 6. Mutation application and classification (timeout, crash, not-applied, survived)

PKG §8 stays normative. For one applicable mutant run the classification is decided in this order (first match wins):

| # | Observation | Class | Code if the mutant is required |
|---|---|---|---|
| 1 | anchor count ≠ 1 (overlaps counted), empty anchor, identical replacement, or post-patch diff ≠ exactly one MODIFY of `path` | `NOT_APPLIED` (no worker start) | `MUTANT_NOT_APPLIED` |
| 2 | timeout, signal (incl. OOM kill, −9), process crash, module-import throw, compiler/typecheck error, collection/suite/hook/unhandled error | `INFRA_FAILURE` | `MUTANT_INFRA` |
| 3 | missing, partial, over-limit or schema-invalid report; a named test identity absent from the current inventory; skip/todo of a selected test | `INFRA_FAILURE` | `MUTANT_INFRA` |
| 4 | exit code ∉ {0, 1} | `INFRA_FAILURE` | `MUTANT_INFRA` |
| 5 | any failed test that is not a named test | `INFRA_FAILURE` | `MUTANT_INFRA` |
| 6 | exit 0 and all selected tests passed | `SURVIVED` | `MUTANT_SURVIVED` |
| 7 | exit 1, at least one named test failed, every failed test failed only with `AssertionError`, all other selected tests passed | `KILLED` | — |
| 8 | anything else | `INFRA_FAILURE` | `MUTANT_INFRA` |

Infrastructure always dominates a kill. A process started before the mutant was applied may yield `EXECUTION_SANDBOX`. Suite verdict: PASS iff every required mutant is `KILLED`; otherwise the primary failure is the smallest plan index (PKG §8 step 7), e.g. classes `[KILLED, SURVIVED]` → `MUTANT_SURVIVED`.

**AV-141 override.** OLD "Developer meldet detected ohne unabhängigen Mutantenlauf | MUTANT_INFRA" → NEW "Missing required mutant run → `MUTANT_NOT_APPLIED`; a Developer-supplied `detected` field is ignored (there is no ingress source for it); the independent run decides."

## 7. Policy, scope and identity precedence

- **AV-080** unchanged (`SCOPE_PATH`); now mutant-backed (B5). No coordination prefix exception exists.
- **AV-096** precedence: branch TASK ≠ registered task → `IDENTITY_NAMESPACE` (phase 3); contract task ≠ policy task with matching branch → `CONTRACT_BINDING`.
- Exact `create`/`modify` membership only, no prefix matching; DELETE and MODE_CHANGE are never allowed (PKG §4 phase 7).

## 8. Acceptance deltas (B)

| ID | Change | Input | Expected |
|---|---|---|---|
| AV-115 | replaced by 115a/115b | — | — |
| AV-115a | new | a BASE identity is missing and an identity with the same printed full name but a different ancestor tuple replaces it | `TEST_INVENTORY` |
| AV-115b | new | an additional identity with the same printed full name under a different ancestor tuple in an approved new file, all BASE identities present and passed | PASS |
| AV-118 | unchanged, now mutant-backed (B2) | one BASE test missing, ten new tests compensate the count | `TEST_INVENTORY` |
| AV-123 | expected-result change | worker tries to open the Docker socket | isolation probe: denial measured, decision unchanged |
| AV-124 | expected-result change | worker tries network or Actions command files | isolation probe: denial measured, decision unchanged |
| AV-125 | expected-result change | worker overwrites read-only tests/tools | isolation probe: denial measured, decision unchanged |
| AV-141 | expected-result change | see §6 | `MUTANT_NOT_APPLIED` |
| AV-183 | new (Work, code mapped) | remove one BASE test and add one different passing test, equal total count | `TEST_INVENTORY` |
| AV-184 | new (Work, code mapped) | probe record with `attempted=true, denied=true` and allowed kind/code | probe passes; missing or false `attempted`/`denied`, unknown kind/code → `EXECUTION_SANDBOX` |
| AV-186 | new | worker report with exactly 8 MiB payload plus valid frame header; 8 MiB + 1 byte payload | accepted; `TEST_INVENTORY` |
| AV-187 | new (HCO-V2 HC-MUT-05..11) | timeout, signal −9, exit 2 with AssertionError, AssertionError+TypeError, extra unnamed failure, same title wrong ancestor, overlapping anchor `aba` in `ababa` | `MUTANT_INFRA` ×6, `MUTANT_NOT_APPLIED` |

The six real `clampAtZero` mutation probes of PKG §8 are repeated with real Vitest. A BASE failure stops HEAD; a missing test, report or a timeout never counts as KILLED.

## 9. Oracle compatibility (B)

High-Confidence Oracle V2 outcomes map to B's normative outcomes (D6; contract-sensitive cases are re-confirmed against r2):

| Oracle class | B outcome |
|---|---|
| `SCOPE_VIOLATION` | `SCOPE_PATH` |
| `PROTECTED_PATH`, `TEST_FROZEN` | `SCOPE_PROTECTED` |
| `MODE_CHANGE`, `MODE_UNSAFE` | `SCOPE_MODE` |
| `BASELINE_TEST_LOST`, `INVENTORY_INVALID` | `TEST_INVENTORY` |
| `TEST_NOT_PASSED` | `TEST_STATUS` |
| `KILLED` / `SURVIVED` / `NOT_APPLIED` / `INFRA_FAILURE` | §6 classes; codes `—` / `MUTANT_SURVIVED` / `MUTANT_NOT_APPLIED` / `MUTANT_INFRA` |
| suite `MUTANT_SURVIVED` | `MUTANT_SURVIVED` |

Timeout, crash, malformed or missing candidate output in a differential run is FAIL/INFRA, never PASS (HCO-V2 protocol step 5).

## 10. Required verifier mutations (B)

### Mutant rule (identical in A, B and C; overrides the last paragraph of each r1 "Required Verifier Mutations" section)

Mutants are local test instruments, never HEAD files. Each mutant is bound to exactly one normatively promised protection and to exactly one isolated assertion test on the layer of that protection. Every other barrier that could reject the same input stays unchanged and is named in the acceptance report; the fixture is chosen so that it passes those barriers (masking statement). A mutant is admissible only if it is:

1. **applicable** — after the implementation bytes are frozen, the independent reviewer freezes file path, anchor bytes, byte position and before/after SHA-256; the anchor occurs exactly once (overlapping occurrences counted, PKG §8 step 2); the patch is applied exactly once;
2. **isolated** — exactly one site changes; no other guard on the same path can produce the safe result first;
3. **normatively relevant** — the protected behavior is required by this contract or by PKG r1 as overridden here;
4. **not masked** — the named assertion was green on the unmutated implementation, and under the mutant it observes the unsafe result (acceptance, wrong diff, wrong classification) instead of the required safe result.

Counts as KILLED only: the named assertion observes the unsafe result instead of the normatively required rejection, diff or classification. Does **not** count as KILLED: a changed failure code between two safe rejections, a compiler/import/syntax error, a timeout, a signal, a missing or invalid report, `NOT_APPLIED`, a test that did not run, or an earlier unrelated rejection. If no single-site patch with these properties can be identified for a listed mutant, that mutant is reported **INVALID** (not killed, not waived) and blocks implementation acceptance until a contract revision replaces it. Each mutant record carries: frozen blob SHA-256, anchor bytes, replacement bytes, application count, baseline assertion result, mutated assertion result, masking statement.

Mapping to the PKG §13 mutant list: PKG §13 last paragraph is overridden by: "Additionally mandatory: the contract mutants A1–A5, B1–B5 and C1–C5 must be detected by this suite in isolated assertion tests under the mutant rule of the contracts. Mapping of the earlier IDs: M1→A1, M2→B1, M3→B2, M4→B3, M5→C1, M6→C2, M7→C3, M8→A2, M9→C4, M10→B5. This is the binding mutation-testing acceptance of the later implementation, not a measured mutation score."

- **B1 — exact scope → prefix.** Switch exact scope membership to `startsWith`. Isolated `checkScope` assertion: modify scope `src/a.ts`, plus a valid unapproved ADD `src/a.ts-extra.ts` (no DELETE, no file→directory, no mode/path/class error) must show acceptance instead of `SCOPE_PATH`. (The Work fixture `src/a.ts.evil` is not used: it is masked by the DEV `.ts` path-class rule.)
- **B2 — inventory → total count.** Reduce `compareInventory` to the total count. Isolated inventory-layer test without upstream freeze: loss of one BASE identity plus one new identity at equal count (AV-118/AV-183) must show acceptance instead of `TEST_INVENTORY`.
- **B3 — nonzero exit as kill.** In the classifier, treat any nonzero exit as KILLED and remove the infrastructure precedence for exit ≠ 1. Isolated classifier test with a complete report, an `AssertionError` in the named test and exit 2 resp. signal −9 must show KILLED instead of `INFRA_FAILURE`; upstream compiler/timeout guards are not triggered by the fixture.
- **B4 — fallback for a missing independent kill.** Patch only the suite-aggregation decision so that a required mutant without an independent `KILLED` outcome (outcome `NOT_APPLIED`, Developer `detected` present) counts as satisfied. Isolated aggregation test (AV-141) must show acceptance instead of `MUTANT_NOT_APPLIED`.
- **B5 — coordination prefix exception.** Introduce a coordination prefix exception in `checkScope`. Isolated scope test ADD `forge/coordination/CODEX.md` without scope (AV-080) must show acceptance instead of `SCOPE_PATH`.

## 11. Acceptance image, properties, size

The worker acceptance uses an externally digest-pinned harmless acceptance image as test input; it is not the production image and is not replaced by C (CERT F05). Scope, Inventory and Mutation property families: at least 10,000 deterministic iterations each (PKG §14). Size (D1): 1,190 LOC ±30 % across the B modules; modules aim at ≤300 LOC, >400 LOC is a split signal, never a reason to drop semantics.

## 12. Execution-isolation boundary

B owns the worker protocol and the measured probes. The current lab finding is **NO-GO for activation** (FORGE-EXECUTION-ISOLATION: no container runtime, `unshare -n` denied, 27/44 fixtures exposed without inner sandbox). That finding does not block this contract's architecture review; it blocks B's implementation acceptance until Docker-capable probe evidence exists, and activation until the deployment gate of C §9 passes.
