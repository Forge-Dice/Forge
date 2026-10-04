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
    {
      "name": "baseline",
      "command": "forge-v01:baseline"
    },
    {
      "name": "acceptance",
      "command": "forge-v01:acceptance-a"
    },
    {
      "name": "mutations",
      "command": "forge-v01:mutations-a"
    }
  ],
  "mutationSmoke": "required"
}
---

# FORGE-BOOTSTRAP-0001A — Trusted Git, Path, Process and Materialization Boundary (contractVersion 2, package r2)

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

## 2. Responsibility

A is the sole primary owner of:

- trusted Git acquisition: private bare ODB, fixed fetch argv/env/config, layout checks (PKG §2 steps 3–6);
- Git object reading and framing (`readCommit`, `readTree`, `collectTree`, `collectChanges`);
- byte path grammar, collisions and mode **classification** (`validatePath`, `validatePathSet`);
- history shape above BASE, including the second-parent guard, and BASE-side ancestry facts (`validateHistory`);
- safe blob materialization and cleanup (`materialize`, `destroy`);
- bounded subprocess primitives and A-owned object/process budgets (`runBounded`, `cleanEnv`);
- Stage-0 image kernel and its fixed minimal GET transport (`bootstrapTrustedObjects`, `loadBaseVerifier`).

A is **not** the owner of: scope, protected-path, freeze and profile decisions (B); test inventory, worker sandbox and mutation classification (B); review, attestation, receipt and final recheck (C); rulesets, merge method, required-check source binding, Actions execution policy (Platform/Ruleset); acceptance publication and attestation (Owner Procedure).

### 2.1 A/B boundary (normative)

A produces **facts**, B makes **policy decisions** over those facts:

| Concern | A delivers | B decides |
|---|---|---|
| Objects | validated commits/trees/blobs or `GIT_OBJECT`/`GIT_LIMIT`/`GIT_LAYOUT`/`GIT_FETCH` | — |
| Paths | byte-exact validated paths or `GIT_PATH`/`GIT_COLLISION` | whether a valid path is in scope (`SCOPE_PATH`) or protected (`SCOPE_PROTECTED`) |
| Modes | raw mode per entry; malformed mode encoding is `GIT_OBJECT`; `MODE_CHANGE` flag in changes | whether a well-formed mode or mode change is admissible (`SCOPE_MODE`) |
| History | ordered list of validated new commits HEAD→BASE, per-commit snapshot/changes, or `GIT_HISTORY`/`GIT_LIMIT` | whether every intermediate and the net change set is in scope |
| Ancestry | reachability of `Contract.baseCommit` and dependency `acceptedCommit` in BASE ancestry (§4.3) | whether a dependency is accepted (`CONTRACT_DEPENDENCY`), together with Owner Procedure |
| Materialization | regular-file tree of already validated blobs, or `EXECUTION_IO` | which snapshot is materialized and run (worker) |

B and C consume A's history and ancestry results and MUST NOT reimplement the parent-count rule or path grammar. `materialize` refuses any leaf whose mode is not `100644` or BASE-unchanged `100755` (`EXECUTION_IO`) even if a caller passes one; this is defense in depth and does not replace B's `SCOPE_MODE` decision.

## 3. Resource and streaming budgets (overrides PKG §2 limits table, row "stdout + stderr")

OLD (PKG §2): "stdout + stderr | je Prozess zusammen höchstens 8 MiB; Überlauf ist Infrastrukturfehler".

NEW — the following channels are distinct and metered independently:

1. **Diagnostic stdout + stderr** of a child process: at most 8 MiB combined per process; overflow is an infrastructure failure `EXECUTION_IO`. This budget does **not** apply to the framed data channels below and is never used as a lifetime cap on framed object bytes.
2. **Framed object channel** (`git cat-file --batch`): per object, header line `<oid> <type> <size>` LF at most 64 bytes; then exactly the declared size plus one LF. The declared size is checked against the type limit (commit 1 MiB, tree 16 MiB, blob 8 MiB) and against the remaining cumulative budget **before** any content byte is read. Framing bytes are not charged to the object payload limit.
3. **Cumulative object data** per batch process and per verifier operation: at most the unpacked-object budget of the PKG §2 table (512 MiB), counted while streaming; the aggregate stream is never buffered as a whole. A long-lived batch process MAY carry many individually admissible objects as long as every frame and the cumulative budget remain valid.
4. **stderr of batch processes**: at most 1 MiB.

Failure precedence on framed channels (one frame at a time):

1. header line malformed, over 64 bytes, wrong type token or wrong OID → `GIT_OBJECT`;
2. well-formed header whose declared size exceeds the type limit or the remaining cumulative budget → `GIT_LIMIT`, without reading content;
3. content length, trailing LF or recomputed object hash mismatch → `GIT_OBJECT`;
4. batch-process stderr overflow → `EXECUTION_IO`.

Only after a frame is fully valid are path and history interpretations applied. No existing object, tree, history, path, materialization or time limit of PKG §2 is raised by this override. The worker-report frame is B's channel (B §4).

Process termination: process groups are terminated (SIGTERM, ≤1 s grace, SIGKILL, wait). A explicitly does **not** guarantee termination of `setsid` descendants; those are covered by the cgroup/container lifecycle (B worker, C image/workflow) and by the deployment acceptance (C §9).

## 4. History, second parent and ancestry

### 4.1 Overrides of PKG §11 code meanings

- `GIT_HISTORY` OLD "BASE nicht erreichbar; Merge/Root/zu viele neue Commits; leerer End-Diff" → NEW "BASE not reachable; merge or root commit above BASE; empty end diff or HEAD = BASE".
- `GIT_LIMIT` NEW addition: "including more than 128 new commits".

### 4.2 New-commit chain (overrides PKG §3 `validateHistory`, first two sentences)

Let BASE = B (current main) and HEAD = H.

1. Walk the raw parent chain from H toward B. History-count limits are evaluated first: a chain that needs a 129th new commit is `GIT_LIMIT`, not `GIT_HISTORY`.
2. Every commit strictly above B (from H down to, excluding, B) MUST have **exactly one parent**, and that parent MUST be the next commit of the validated chain toward B. Zero parents (root) or two or more parents above B is `GIT_HISTORY`.
3. A second parent MUST NOT be ignored because the first parent still reaches B.
4. B itself MAY be a merge commit and is not rejected for having several parents.
5. H = B, or a non-empty chain whose net end diff H vs B is empty, is `GIT_HISTORY`.
6. Missing objects are `GIT_OBJECT`, never "not an ancestor".
7. Every intermediate snapshot of the chain is delivered to B for the same protection rules (PKG §3, last sentence of `validateHistory` unchanged).

This section is the sole normative owner of second-parent protection above B.

### 4.3 BASE-side ancestry (appends to PKG §3 `validateHistory`, after "Verträge können einen älteren baseCommit haben, dieser muss in authentisch gelesener BASE-Ancestry liegen.")

NEW sentence: "The ancestry check for `Contract.baseCommit` and for every dependency `acceptedCommit` runs from B over **all** parents (including second merge parents) iteratively with a visited set, bounded by the object budget of PKG §2; exceeding it is `GIT_LIMIT`; missing objects are `GIT_OBJECT`."

Ancestry reachability is a structural fact only. It never proves that a dependency was accepted (B §2, C §2).

### 4.4 Platform note (no A obligation)

`src/forge/start-gate.ts` on `main` accepts any-parent ancestry; it is not a production gate before C is activated. No `required_linear_history` rule is introduced by A.

## 5. Bootstrap inputs and kernel

- **Own GET transport (CERT F05).** `bootstrap.py` contains its own fixed minimal transport for exactly the four GETs of PKG §2 step 2 (fixed URLs, no `Authorization` header, no redirects, limits of PKG §2). A imports no C module. C's `github.py` may wrap this transport but MUST NOT replace or alter it.
- **Kernel import graph.** The image kernel loads only the verified BASE manifest graph: a HEAD `main.py` or an import not listed in the manifest → `POLICY_INVALID`; a missing manifest entry → `POLICY_INVALID`.
- **BASE stub.** A is tested against a harmless generated BASE stub outside the repository. The stub is a lab-only harness input and MUST NOT implement B/C product semantics. A missing real BASE entry is FAIL, never a production pass. A requires no production image digest; digest and recipe belong to C.

## 6. Acceptance deltas (A)

All PKG §13 cases owned by A remain unchanged except:

| ID | Change | Input | Expected |
|---|---|---|---|
| AV-004 | expected-result closure | PR/run/actor IDs are JSON number tokens only of `[1-9][0-9]*`, no sign, fraction, exponent or leading zero, value ≤ 2^53−1; `1e0`, `1.0`, `01`, `0`, `-1` | `PR_INPUT` |
| AV-009 | expected-result change | PR record carries `head.repo.clone_url` or another URL | URL ignored, fetch only from the fixed remote; PASS on otherwise valid input. A deviating remote configuration in the ODB is `GIT_LAYOUT` |
| AV-029 | unchanged, now mutant-backed (A5) | HEAD commit with two real parent headers above B | `GIT_HISTORY` |
| AV-070 | unchanged | HEAD = BASE | `GIT_HISTORY` |
| AV-070b | new (CONTRACT-DERIVED) | non-empty new commit chain with empty end diff vs B | `GIT_HISTORY` |
| AV-071 | expected-result change | 129 new linear commits | `GIT_LIMIT` (limit before shape) |
| AV-178 | new | commit above B with a valid first parent toward B plus a second parent | `GIT_HISTORY` |
| AV-178b | new | `Contract.baseCommit` reachable from B only through the second parent of a BASE merge commit | PASS |
| AV-179 | new | blob of exactly 8 MiB and tree of exactly 16 MiB read through the same batch process with valid ≤64-byte headers | read completely, PASS |
| AV-179b | new | blob with declared size 8 MiB + 1 byte | `GIT_LIMIT`, no content read |
| AV-179c | new | several individually admissible objects in one batch process up to the cumulative budget; one more object exceeding it | PASS up to the budget; then `GIT_LIMIT` |
| AV-179d | new | malformed or 65-byte header line | `GIT_OBJECT` |
| AV-185 | new | image kernel: HEAD `main.py` or unlisted import; missing manifest entry | `POLICY_INVALID` |

Mandatory history Goldens (D6; ROQ / HCO-V2): second parent above B, revert intermediate commit, B = H, empty end diff, 129 commits, nested merge ancestry above B, octopus HEAD, historical merge at B with one new linear commit (PASS), 128 new linear commits (PASS).

Process groups are terminated in tests; `setsid` descendants are explicitly not asserted as an A guarantee.

## 7. Oracle compatibility (A)

The High-Confidence Oracle V2 corpus (`corpus/high-confidence.json`, SHA-256 `b0137cb49da4a0966159d519daa3a8de53f4794c46670cbda61e0d210a822534`) is contract-sensitive to r1; under D6 the normative Golden set is re-confirmed against r2 before acceptance. A's normative outcomes map as follows; optional diagnostics stay non-normative:

| Oracle failure class | A outcome |
|---|---|
| `PATH_UNSAFE`, `PATH_NOT_PORTABLE`, `PATH_GIT_RESERVED` | `GIT_PATH` |
| `CASE_COLLISION`, `DUPLICATE_PATH` | `GIT_COLLISION` |
| `MODE_UNSAFE` (symlink/gitlink) | well-formed mode reported as fact; verdict `SCOPE_MODE` by B |
| `REPO_UNSAFE` (replace, alternates, grafts, shallow) | `GIT_LAYOUT` |
| `HISTORY_PARENT_COUNT`, `HISTORY_UNREACHABLE`, `EMPTY_HISTORY`, `EMPTY_END_DIFF` | `GIT_HISTORY` |
| `HISTORY_LIMIT` | `GIT_LIMIT` |
| `INTERMEDIATE_SCOPE` | intermediate changes delivered by A; verdict `SCOPE_PATH`/`SCOPE_PROTECTED` by B |
| diff classes `ADD`, `DELETE`, `MODIFY`, `MODE`, `MODIFY+MODE`, `DELETE+ADD`, `EMPTY_DIFF` | `collectChanges` output per PKG §3 (no rename score) |

The 150-repo differential corpus is exploratory only and is not an equality oracle for code sets (D6).

## 8. Required verifier mutations (A)

### Mutant rule (identical in A, B and C; overrides the last paragraph of each r1 "Required Verifier Mutations" section)

Mutants are local test instruments, never HEAD files. Each mutant is bound to exactly one normatively promised protection and to exactly one isolated assertion test on the layer of that protection. Every other barrier that could reject the same input stays unchanged and is named in the acceptance report; the fixture is chosen so that it passes those barriers (masking statement). A mutant is admissible only if it is:

1. **applicable** — after the implementation bytes are frozen, the independent reviewer freezes file path, anchor bytes, byte position and before/after SHA-256; the anchor occurs exactly once (overlapping occurrences counted, PKG §8 step 2); the patch is applied exactly once;
2. **isolated** — exactly one site changes; no other guard on the same path can produce the safe result first;
3. **normatively relevant** — the protected behavior is required by this contract or by PKG r1 as overridden here;
4. **not masked** — the named assertion was green on the unmutated implementation, and under the mutant it observes the unsafe result (acceptance, wrong diff, wrong classification) instead of the required safe result.

Counts as KILLED only: the named assertion observes the unsafe result instead of the normatively required rejection, diff or classification. Does **not** count as KILLED: a changed failure code between two safe rejections, a compiler/import/syntax error, a timeout, a signal, a missing or invalid report, `NOT_APPLIED`, a test that did not run, or an earlier unrelated rejection. If no single-site patch with these properties can be identified for a listed mutant, that mutant is reported **INVALID** (not killed, not waived) and blocks implementation acceptance until a contract revision replaces it. Each mutant record carries: frozen blob SHA-256, anchor bytes, replacement bytes, application count, baseline assertion result, mutated assertion result, masking statement.

Mapping to the PKG §13 mutant list: PKG §13 last paragraph is overridden by: "Additionally mandatory: the contract mutants A1–A5, B1–B5 and C1–C5 must be detected by this suite in isolated assertion tests under the mutant rule of the contracts. Mapping of the earlier IDs: M1→A1, M2→B1, M3→B2, M4→B3, M5→C1, M6→C2, M7→C3, M8→A2, M9→C4, M10→B5. This is the binding mutation-testing acceptance of the later implementation, not a measured mutation score."

- **A1 — replace-ref layout check.** Remove only the layout check for `refs/replace` (loose and packed). The env allowlist (`GIT_NO_REPLACE_OBJECTS`) and the raw-object rehash stay unchanged. Isolated layout assertion (AV-025) must show acceptance instead of `GIT_LAYOUT`. Removing `GIT_NO_REPLACE_OBJECTS` alone is not a security kill, because the rehash still rejects replacement bytes (CERT P01).
- **A2 — parent symlink traversal.** Remove `O_NOFOLLOW` from exactly one parent-directory open. The isolated parent-symlink fixture must change from rejection to unsafe acceptance.
- **A3 — mode-change omission.** Remove only the emission of `MODE_CHANGE` while content comparison stays intact. Isolated mode-only and mode+content assertions must show the missing flag.
- **A4 — raw duplicate collapse.** In `readTree`, convert raw entries into a dict before the duplicate and sort check so that no later raw check sees the duplicate. Isolated `readTree` assertion with a duplicated raw name (AV-030) must show acceptance instead of `GIT_COLLISION`/`GIT_OBJECT`; the reviewer shows that no remaining raw check acts equivalently.
- **A5 — second-parent guard.** Remove only the one-parent check for new commits above B. Isolated `validateHistory` assertion with a real two-parent HEAD and an otherwise valid tree change (AV-029/AV-178) must show acceptance instead of `GIT_HISTORY`.

## 9. Properties, scale, size

Tree and Path property families: at least 10,000 deterministic iterations each, independent oracle (PKG §14). Measure 100/1,000/10,000 files and 1k/10k/100k objects under the limits of §3; absolute milliseconds are not acceptance gates.

Size (D1): 1,320 LOC ±30 % production across the eight A modules, tests excluded. Individual modules aim at ≤300 LOC (PKG §12); a module above 400 LOC is an architecture-review signal for a module split, never permission to drop semantics. No "<400 LOC total" target.

## 10. Dependency and implementability

`dependencies: []`. A has no implementation dependency on B or C and no hash self-reference. A is implementable after independent architecture approval and registration on `main` (Owner Procedure). Before registration the Owner checks `baseCommit` against the then-current `main`; if `main` moved, a new revision re-parses and re-hashes this document.

## 11. Execution-isolation boundary

A's process-group, deadline and budget controls are necessary, not sufficient. A makes no claim about container/cgroup/VM containment, network or credential isolation, `setsid` descendants, kernel exploits or hostile in-process test code. Those belong to B (worker protocol and measured probes) and to the deployment gate defined in C §9.
