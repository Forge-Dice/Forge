---json
{
  "forgeContractFormat": 1,
  "taskId": "FORGE-BOOTSTRAP-0001C",
  "contractVersion": 2,
  "baseCommit": "3d7545d843883418348004e68717399a64da7a7d",
  "dependencies": [
    {
      "taskId": "FORGE-BOOTSTRAP-0001B",
      "acceptedCommit": null
    }
  ],
  "scope": {
    "create": [
      "tools/forge_v01/github.py",
      "tools/forge_v01/reviews.py",
      "tools/forge_v01/final.py",
      "tools/forge_v01/main.py",
      "tools/forge_v01/Dockerfile",
      ".github/workflows/forge-v01.yml",
      "forge/verifier/bootstrap-manifest.json",
      "forge/verifier/policy.json",
      "forge/verifier/task-plan.schema.json",
      "forge/verifier/image-inputs.json",
      "forge/verifier/clamp-plan.example.json",
      "src/forge-drill/clamp-at-zero.ts",
      "tests/forge-v01/reviews.test.ts",
      "tests/forge-v01/final.test.ts",
      "tests/forge-v01/workflow.test.ts",
      "tests/forge-v01/properties-c.test.ts",
      "tests/forge-v01/clamp-at-zero.test.ts"
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
      "command": "forge-v01:acceptance-c"
    },
    {
      "name": "mutations",
      "command": "forge-v01:mutations-c"
    }
  ],
  "mutationSmoke": "required"
}
---

# FORGE-BOOTSTRAP-0001C — GitHub Read Adapter, Review Binding, Final Recheck, Workflow and Image Recipe (contractVersion 2, package r2)

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

C is the sole primary owner of:

- the fixed GET-only GitHub read adapter (`github.py`, wrapping A's bootstrap transport, never replacing it);
- Owner attestation and external-review schema, selection, freshness, revocation and supersedes (`reviews.py`);
- Gate→Stage-2 receipt binding including `reviewSnapshotDigest` (§4);
- the two-round final recheck of review, HEAD, BASE and `main` (`final.py`, §5);
- current-run/attempt/job interpretation (§6);
- orchestration (`main.py`), workflow shape (`.github/workflows/forge-v01.yml`), image recipe (`Dockerfile`, `image-inputs.json`), verifier data files and the `clampAtZero` drill seed;
- the normative execution-isolation requirements for Stage 2 (§9).

C is not the owner of Git/history (A), scope/inventory/worker/mutation semantics (B), ruleset enforcement, merge method, bypass configuration, required-check source binding or the Actions execution policy (Platform/Ruleset, §8), or architecture approval, dependency acceptance and attestations (Owner Procedure).

**Dependency.** `FORGE-BOOTSTRAP-0001B` must be independently accepted; B binds A transitively. `acceptedCommit` stays `null`; no SHA and no platform proof is invented. Before execution a new revision inserts the real B `acceptedCommit` and the then-current authoring `baseCommit`, is re-parsed, re-hashed and increases `contractVersion`. Non-null plus ancestry does not prove acceptance; the only authority is the documented external independent Owner acceptance (CERT F06). Neither A nor B depends on C.

## 3. Closed review schema (overrides PKG §9; Owner Decision D3)

The attestation body format of PKG §9 (`FORGE-ATTESTATION-V1` line, canonical JSON, approve and revoke variants, all binding fields) stays unchanged. The following replace the open parts.

**External review findings** — OLD (PKG §9) "findings=[{id,severity,summary}]. … keine blocking-Findings bei approve. Nichtblocking-Findings bleiben reviewbar." NEW:

> `findings` is a list of strict objects `{id, severity, summary}`: `id` matches `[a-z0-9][a-z0-9-]{0,31}` and is unique within the report; `severity ∈ {"info","minor","major","critical"}`; `summary` is a non-empty string of at most 512 bytes. Unknown fields or values → `REVIEW_FORMAT`. A finding is **blocking** iff `severity ∈ {"major","critical"}`. `result=approve` requires zero blocking findings, otherwise `REVIEW_BLOCKED`; `result=request_changes` is always `REVIEW_BLOCKED`; any other `result` value (including `reject`) is `REVIEW_FORMAT`. Non-blocking findings stay reviewable and do not prevent PASS. For OWNER_OPS no automatic provider rule applies; independence of the external review is Owner-attested only and named as such in the PASS report. For DEV with `developer.provider=openai`, `externalReviewer.provider` must be `anthropic` (PKG §9 unchanged).

**Supersedes** — after the PKG §9 sentence "Neue approve darf ältere Blocker nur explizit in supersedes=[{reviewId,bodyHash,state}] freigeben; IDs allein reichen wegen Editierbarkeit nicht." append:

> A blocker in the sense of `supersedes` is every older published Owner review with state `CHANGES_REQUESTED` or `DISMISSED`; every older Owner `COMMENTED` review with a valid revoke variant, or with an approve variant whose `externalReviewResult` is `request_changes` or which contains blocking findings; and every older Owner `COMMENTED` body that starts with `FORGE-ATTESTATION-V1` and is not strictly valid. The `supersedes` set must equal exactly the set of all blockers present at check time. A supersession declared in an earlier review does not carry forward (no transitivity). `bodyHash` = SHA-256 of the exact current body bytes; `state` = current API state.

Outcomes: a blocker not listed → `REVIEW_BLOCKED`; a listed entry that is not a current blocker, is duplicated, or whose `bodyHash`/`state` does not match the current API record → `REVIEW_BINDING`.

Authority is the numeric `user.id` of the Owner from policy; login text is never authority. The latest published Owner review is decisive; never fall back to an older approval (PKG §9 unchanged).

(The Work candidate's `ReviewEnvelope`/`Finding{severity critical|high|medium|low|info, disposition, supersedes within envelope}` schema and its `REVIEW_SCHEMA` code are not adopted: they contradict D3 and the closed enum.)

## 4. Gate→Stage-2 review binding (Owner Decision D2)

**Snapshot digest** (closes PKG §9 "Snapshotdigest sämtlicher relevanter Review-IDs, States, Commit-IDs, submitted_at und exact body SHA256"): `reviewSnapshotDigest` = SHA-256 of `"forge-review-snapshot-v1\n"` followed by the canonical JSON (PKG §4 rules: two-space indent, LF, no BOM/CR, trailing LF) of the array of all published reviews by the policy Owner id on the PR, each `{id, state, commitId, submittedAt, bodySha256}`, sorted by `(submittedAt, id)`. The domain-prefix pattern follows `forge-plan-v1` / `forge-policy-v1` of PKG §4.

**Override PKG §9 snapshot sentence.** OLD "Jeder Unterschied während des Laufs führt zu REVIEW_CHANGED oder einem höher priorisierten aktuellen Blocker." NEW "The observation boundary is the Gate snapshot of the same attempt: `forge-gate` computes it and binds it in the receipt (§10 row below); the Stage-2 start snapshot and both final snapshots must equal it. Every difference yields `REVIEW_CHANGED` or a higher-priority current blocker."

**Override PKG §10 row "Re-run all jobs".** NEW:

> `forge-gate` sets, only after full success, output `receipt` = fixed canonical JSON `{runId, runAttempt, B, H, contractHash, policyHash, verifierSha, reviewSnapshotDigest}`. `reviewSnapshotDigest` is the snapshot digest computed by `forge-gate` immediately before emitting the receipt (64 hex). Stage 2 compares the receipt with its own current attempt and compares `reviewSnapshotDigest` with its own Stage-2 start snapshot; any difference is `REVIEW_CHANGED`, and Stage 2 does not continue on the old receipt. Re-run failed jobs keeps an old Gate receipt and fails. The jobs of the specific attempt must contain exactly one `forge-gate` and the one running `forge-verify`; no matrix or name duplicates. The runtime guarantee is solely a fresh complete attempt; which re-run menu the Owner used is not observable and is not claimed.

## 5. Final review / HEAD / main binding

PKG §10 stays normative with the overrides above. Within the ≤10 s final window two complete fresh snapshots are taken; both must equal each other and the Gate-bound values: PR open and not draft, same repo/PR ids, `base.ref = main`, `head.sha = H`, `base.sha = B`, current `main = B = verifierSha`; contract, plan, manifest and policy blobs from exactly B unchanged; selected Owner attestation unchanged and bound to H and all binding fields; the complete relevant review list unchanged with digest equal to the receipt's `reviewSnapshotDigest`; run/attempt/actor per §6. A moved `main` with unchanged PR fields is `PR_STALE` (AV-166). At most two snapshots; otherwise FAIL. Two equal final rounds prove nothing about the time after the last GET; merge remains an Owner step bound to the expected HEAD (PKG §10 race limit unchanged).

## 6. Run attempt and jobs (CERT F09; Owner Decision D3 d)

C proves only observable facts: run id and attempt equal the receipt; `runAttempt ≥ 2` where the Owner recheck is required; `triggering_actor.id` equals the Owner id (no login fallback); the complete expected job set of this attempt exists; the receipt comes from the `forge-gate` job of this attempt and binds B/H/contract/policy/verifier/review digests. C makes **no** claim about which UI re-run menu was used and **no** claim about the absence of foreign same-name checks; no additional GET (e.g. check-runs) is added.

Override of retained r1 C "Acceptance": "ausschließlich Re-run all jobs erfüllt neues Receipt" reads "only a fresh complete attempt (new `forge-gate` job in the same attempt) satisfies a new receipt"; "Fake-/Doublechecks fail" reads "foreign or duplicate same-name checks are a `POLICY_DEPLOYMENT` item of the Owner live drill (§8)".

## 7. Workflow boundary

Unchanged from PKG §2 "Workflowkonfiguration": name `Forge V0.1`, trigger only `pull_request_target` types `opened, reopened, synchronize, ready_for_review`, branches `main`; `permissions: {}`; exactly two jobs `forge-gate` and `forge-verify`, no matrix, no concurrency cancel, `timeout-minutes: 20`; no checkout, cache, download-artifact or HEAD step; `forge-verify` runs `if: always()` with an explicit red path when Gate did not succeed; only the trusted host writes the bounded receipt to `GITHUB_OUTPUT`. No checks publisher, no POST/PATCH/PUT/DELETE client, no admin credential, no token fallback. The verifier rejects draft PRs itself (`PR_STATE`, PKG §4 phase 2); it does not claim a platform draft gate. Policy assurance is reported as `owner_attested`, never `live_verified`.

## 8. Platform / Ruleset boundary (Owner Decision D4)

These are Platform/Ruleset configuration and Owner Procedure obligations. C consumes them as the Owner-attested `deploymentPolicyDigest` (PKG §10 "Plattformpolicy"); C does not establish or prove them in code:

- **R2 merge method:** merge commit only. `allowed_merge_methods` is exactly `["merge"]`; squash and rebase are not allowed (required for `C = M^2`). R2 stays bypass-free.
- **R3 Owner merge:** the PR-only Owner bypass in R3 (`forge-main-owner-merge`, User `315180734`, `bypass_mode: pull_request`) is the **intended, controlled Owner authorization** for merging, used per merge and logged (`merge_method=merge`, `bypass_rules=true`). It is not a protection bypass in the sense of a STOP criterion.
- **No other bypass:** R1, R2, R4 scope, R6, R7 and the Actions execution policy are bypass-free for every actor including the Owner; delete/force-push protection has no bypass (PKG §10 H2).
- **Required-check source binding:** `forge-gate` and `forge-verify` are bound to this workflow/app (`integration_id`) by the Owner; R2 with these required checks is activated only after C is accepted.

**Wording correction (D4).** Wherever a source used by this contract states that the Owner is "in keiner Bypass-Liste" (Architecture Freeze §2 decision (b)) or makes "No protection bypass required" a PASS criterion (First Drill Pre-Mortem §9), that literal wording does not apply to this contract. The binding reading is: the Owner has a bypass only in R3 (PR-only) and R5; R1/R2/R4-scope/R6/R7 and the Actions execution policy are bypass-free for him. "Organization admin Always" bypass wording is superseded.

**AV-172 / AV-173 override.** OLD expected `POLICY_CHECKS`. NEW expected `POLICY_DEPLOYMENT`: verified only in the Owner's isolated Ruleset Live Drill (required checks bound to this workflow/app; old green checks do not release a new SHA). No additional GET.

## 9. Execution isolation (deployment gate, not a PASS)

C normatively requires that Stage 2 of the workflow, its image and its worker invocation satisfy **EI-01 … EI-20** of `EI-ACCEPTANCE-CONTRACT.md` (branch `forge/owner/audits/FORGE-EXECUTION-ISOLATION`, commit `372b196e0c3c7da73b230de03c43d7ba9252c1f9`, SHA-256 `7eaac082b0fb5a1737b331598d88616a512bf27409131fd275c86594f8a06273`), using the worker mechanism already fixed by PKG §6. This contract adds no sandbox mechanism and no numeric bound beyond PKG §2/§6.

Gates, kept separate:

| Gate | Evidence required | Current status |
|---|---|---|
| C implementation acceptance (offline) | B's measured isolation probes (B §5) plus C image/workflow probes for EI-01…EI-19 on a separately authorized test surface | NOT AVAILABLE |
| Activation (live, deployment gate) | EI-20 adversarial live proof on GitHub-hosted `ubuntu-24.04` with the pinned image, plus PKG §17 item 5 live checks | **NO-GO** (lab: no container runtime, `unshare -n` denied, 27/44 fixtures exposed without inner sandbox) |

Neither gate is satisfied by this contract, by a drill PASS, or by an Owner attestation alone. C MUST NOT report execution isolation as passed. A missing or failed gate keeps activation (enabling R2 with required checks) blocked; it is not reinterpreted as an A or B contract blocker. No claim of containment against kernel exploits, in-process reporter forgery or atomic GitHub finality is made.

## 10. Drill-PASS definition (appends to C acceptance)

A drill PASS is exactly: (1) attempt 1 `forge-verify` red with `REVIEW_MISSING`; (2) mutant `return n` KILLED; (3) the equivalent-mutant negative fixture yields `MUTANT_SURVIVED`; (4) after the Owner COMMENT attestation and "Re-run all jobs", `forge-verify` exit 0 with `policyAssurance=owner_attested`. A drill PASS is no evidence of ruleset, bypass or Actions-execution-policy effectiveness; only the isolated Ruleset Live Drill provides that.

## 11. Acceptance deltas (C)

| ID | Change | Input | Expected |
|---|---|---|---|
| AV-150 | expected-result change | external review `result=request_changes` (schema-valid) | `REVIEW_BLOCKED` |
| AV-150b | new | external review `result=reject` (not in enum) | `REVIEW_FORMAT` |
| AV-154 | unchanged code, now provable | review body edited between Gate and Stage 2 / final | `REVIEW_CHANGED` |
| AV-155 | wording change | review edited before the Gate observation of the same attempt and now correctly bound | PASS |
| AV-166 | unchanged, now mutant-backed (C4) | `main` moves during tests, PR fields unchanged | `PR_STALE` |
| AV-170 | wording change | attempt ≥ 2 without a fresh `forge-gate` job in the same attempt (e.g. re-run failed jobs) | `IDENTITY_RECHECK` |
| AV-172 | expected-result change | foreign workflow delivers a same-name check | `POLICY_DEPLOYMENT` (Owner live drill) |
| AV-173 | expected-result change | old green checks should release a new SHA | `POLICY_DEPLOYMENT` (Owner live drill) |
| AV-180 | new (Work, code mapped) | review R0 at Gate, R1 before Stage 2, otherwise identical final rounds | different `reviewSnapshotDigest`; `REVIEW_CHANGED` |
| AV-181 | new (rewritten per D3) | `approve` with a `major` or `critical` finding; `approve` with only `info`/`minor` findings | `REVIEW_BLOCKED`; PASS |
| AV-182 | new (rewritten per D3) | `supersedes` missing a current blocker; containing a non-blocker, a duplicate or a stale `bodyHash`/`state` | `REVIEW_BLOCKED`; `REVIEW_BINDING` |

## 12. Required verifier mutations (C)

### Mutant rule (identical in A, B and C; overrides the last paragraph of each r1 "Required Verifier Mutations" section)

Mutants are local test instruments, never HEAD files. Each mutant is bound to exactly one normatively promised protection and to exactly one isolated assertion test on the layer of that protection. Every other barrier that could reject the same input stays unchanged and is named in the acceptance report; the fixture is chosen so that it passes those barriers (masking statement). A mutant is admissible only if it is:

1. **applicable** — after the implementation bytes are frozen, the independent reviewer freezes file path, anchor bytes, byte position and before/after SHA-256; the anchor occurs exactly once (overlapping occurrences counted, PKG §8 step 2); the patch is applied exactly once;
2. **isolated** — exactly one site changes; no other guard on the same path can produce the safe result first;
3. **normatively relevant** — the protected behavior is required by this contract or by PKG r1 as overridden here;
4. **not masked** — the named assertion was green on the unmutated implementation, and under the mutant it observes the unsafe result (acceptance, wrong diff, wrong classification) instead of the required safe result.

Counts as KILLED only: the named assertion observes the unsafe result instead of the normatively required rejection, diff or classification. Does **not** count as KILLED: a changed failure code between two safe rejections, a compiler/import/syntax error, a timeout, a signal, a missing or invalid report, `NOT_APPLIED`, a test that did not run, or an earlier unrelated rejection. If no single-site patch with these properties can be identified for a listed mutant, that mutant is reported **INVALID** (not killed, not waived) and blocks implementation acceptance until a contract revision replaces it. Each mutant record carries: frozen blob SHA-256, anchor bytes, replacement bytes, application count, baseline assertion result, mutated assertion result, masking statement.

Mapping to the PKG §13 mutant list: PKG §13 last paragraph is overridden by: "Additionally mandatory: the contract mutants A1–A5, B1–B5 and C1–C5 must be detected by this suite in isolated assertion tests under the mutant rule of the contracts. Mapping of the earlier IDs: M1→A1, M2→B1, M3→B2, M4→B3, M5→C1, M6→C2, M7→C3, M8→A2, M9→C4, M10→B5. This is the binding mutation-testing acceptance of the later implementation, not a measured mutation score."

- **C1 — login instead of numeric id.** At the single owner-identity decision use `review.user.login` instead of `user.id`. Assertion: same login, wrong numeric id (AV-145) must show acceptance instead of `REVIEW_MISSING`; no second numeric prefilter masks it.
- **C2 — latest blocker fallback.** Patch only selection so that the older approving Owner review is selected instead of the latest valid blocking review. Isolated two-review fixture; snapshot freshness stays satisfied for the selected snapshot. Unmutated: `REVIEW_BLOCKED`; mutant: acceptance.
- **C3 — receipt runAttempt.** Remove the comparison `receipt.runAttempt` vs current attempt. Isolated final test in which the attempt job list is correct but the receipt carries the previous attempt's `runAttempt` must show acceptance instead of `IDENTITY_RECHECK`. The re-run-failed-jobs case (AV-170) is additionally rejected by the attempt job set and does not count as a C3 kill (CERT P06).
- **C4 — final current main.** Remove the final check current `main = B`. Isolated final-snapshot fixture with `PR.base.sha = B` and `GITHUB_SHA = B` but `/branches/main ≠ B` (AV-166) must show acceptance instead of `PR_STALE`; all other fresh base checks are held constant. If another main check fires first, the mutant is masked and INVALID.
- **C5 — Gate review digest.** Remove the comparison of `reviewSnapshotDigest` between receipt and Stage-2 start. Gate→Stage-2 edit assertion (AV-154/AV-180) with the same H/main/attempt and complete attempt jobs must show acceptance instead of `REVIEW_CHANGED`.

## 13. Image, data, drill seed, size

Image recipe, `image-inputs.json`, policy with empty `taskIndex` and inactive deployment evidence, unregistered example plan and the green `clampAtZero` seed stay as in r1 C "Ergebnis" (real digests only from a real build; no placeholders in an activatable workflow). Review/Final/Workflow properties: at least 10,000 deterministic iterations (PKG §14). Size (D1): 1,008 LOC ±30 % across the C modules and workflow/image assets; modules aim at ≤300 LOC, >400 LOC is a split signal.
