---json
{
  "forgeContractFormat": 1,
  "taskId": "FORGE-BOOTSTRAP-0001C",
  "contractVersion": 2,
  "baseCommit": "3d7545d843883418348004e68717399a64da7a7d",
  "dependencies": [{"taskId":"FORGE-BOOTSTRAP-0001B","acceptedCommit":null}],
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
    {"name":"baseline","command":"forge-v01:baseline"},
    {"name":"acceptance","command":"forge-v01:acceptance-c"},
    {"name":"mutations","command":"forge-v01:mutations-c"}
  ],
  "mutationSmoke": "required"
}
---

# FORGE-BOOTSTRAP-0001C — Repair Candidate v2

## Status
DRAFT repair candidate. Contract-only change. It remains non-executable while B.acceptedCommit is null. No accepted SHA or platform proof is invented.

## Primary responsibility
C is sole primary owner for:
- fixed GitHub read adapter used by the verifier;
- review/attestation schema, selection, freshness and revocation semantics;
- Gate→Stage2 trusted receipt binding;
- final two-round freshness/recheck logic;
- run-attempt/job evidence interpretation;
- workflow shape and C-owned image recipe.

C is not owner of Git history (A), worker/container execution semantics (B), ruleset enforcement/merge methods/native required-check source binding (Platform/Ruleset), or dependency/architecture approval publication (Owner Procedure).

## Dependency
B must be independently accepted; B binds A transitively. Before execution, insert the real B acceptedCommit, update to the then-current authoring baseCommit and review/hash the revision. Null remains deliberately blocking.

## Review schema — repaired
All external review data is parsed as strict objects. Unknown keys reject.

`ReviewEnvelope`:
`{ reviewId, commitSha, ownerUserId, provider, result, findings, reportDigest, publishedAt }`

Constraints:
- `reviewId`: positive decimal integer.
- `commitSha`: exactly 40 lowercase hex and MUST equal H.
- `ownerUserId`: positive integer and MUST equal the pinned Owner numeric user id from policy.
- `provider`: closed policy enum.
- `result`: exactly `approve|request_changes`. `reject` is schema-invalid and MUST NOT be treated as a valid negative result.
- `reportDigest`: exactly 64 lowercase hex.
- `publishedAt`: canonical UTC timestamp format fixed by the package.
- `findings`: bounded array of `Finding`.

`Finding`:
`{ id, severity, disposition, messageDigest, supersedes }`

Constraints:
- `id`: unique non-empty ASCII token in this envelope.
- `severity`: exactly `critical|high|medium|low|info`.
- `disposition`: exactly `block|note`.
- `messageDigest`: exactly 64 lowercase hex; untrusted prose is not authority.
- `supersedes`: unique array of earlier finding IDs in the **same envelope** only. A finding may not supersede itself or a later/unknown ID. Because references only point backward, cycles are impossible.

Active findings are computed by taking all findings then removing every finding ID reachable from the union of `supersedes` edges of later findings. The transitive closure is deterministic. A review has an active blocker iff at least one active finding has `disposition=block`.

Cross-field invariant:
- `result=approve` iff there is no active blocker.
- `result=request_changes` iff there is at least one active blocker.
A mismatch is `REVIEW_SCHEMA`.

Provider independence remains policy-specific: DEV provider `openai` requires the independently allowed review provider required by policy. Provider provenance is Owner-attested; hashes bind bytes but do not prove provider identity.

## Latest review and revocation
Select the latest valid published Owner review for H by server-observed review identity/order defined in the package. Never fall back to an older approval when the latest valid Owner review requests changes or revokes/supersedes prior findings. Numeric user id, not login text, is authority.

## Gate→Stage2 review authority — repaired
Stage 1 MUST compute a canonical `reviewSnapshotDigest` over the complete selected ReviewEnvelope plus the server facts used to select it. The digest is included in the trusted GateReceipt.

`GateReceipt` minimally binds:
`{ headSha, baseSha, mainSha, policyDigest, contractDigest, reviewSnapshotDigest, gateRunId, runAttempt }`.

Stage 2 MUST perform its own fresh fixed GETs before any execution result can be accepted, reconstruct the selected review snapshot, and require its canonical digest to equal `GateReceipt.reviewSnapshotDigest`.

If a review is edited, replaced, revoked, newly published or selection order changes between Gate and Stage2, C returns `REVIEW_CHANGED_AFTER_GATE`; Stage2 does not continue on the old receipt.

The two final rounds each repeat the review read and require the same reviewSnapshotDigest as the receipt and as each other. Thus two identical final rounds cannot conceal a review change in the Gate→Stage2 gap.

AV-154 therefore changes from "Stage2 may accept a newer review if both final rounds agree" to mandatory reject on any Gate-bound review digest change. AV-155 retains reject semantics for changes between final rounds.

## Run attempt and job semantics — repaired
C proves only observable facts:
- the current run id/attempt are the ones bound into the receipt;
- `runAttempt >= 2` where Owner recheck is required;
- triggering_actor numeric id equals the pinned Owner id;
- the complete expected set of jobs for the current attempt exists and each required job is successful;
- the GateReceipt is produced by the required Gate job in that attempt and matches H/main/review digests.

C MUST NOT claim it can prove which GitHub UI menu item ("Re-run all jobs" vs an observationally equivalent rerun) was clicked when the resulting server facts are indistinguishable.

A foreign same-named check or native source association is not disproved by current-run job enumeration alone. Required-check source binding and the absence/effect of foreign check publishers are Platform/Ruleset deployment acceptance obligations. C consumes the resulting policy assurance but does not duplicate that configuration contract.

## Failure/rejection layer closure
Schema invalid input is `REVIEW_SCHEMA` and is not a valid review result.
Valid `request_changes` is a review decision and yields the review-blocking code defined by the package.
For the repaired ambiguities:
1. input/schema failure precedes semantic review result;
2. review freshness mismatch precedes final approval;
3. attempt/job incompleteness precedes success evaluation.
No broad new global priority order is introduced beyond conflicts demonstrated by certification.

## Workflow boundary
Workflow remains only the trusted PR-target path defined by the package, with permissions `{}`, no checkout/cache/HEAD step, fresh jobs, `always()` verify job and explicit red path if Gate failed. Draft-Gate behavior, allowed merge method, R3/Owner bypass semantics and required-check source binding are Platform/Ruleset configuration and MUST NOT be represented as C-owned code guarantees.

The workflow must reject draft PRs unless the current Platform/Ruleset/Owner-approved bootstrap policy explicitly supplies a live-verified draft-gate guarantee. Until that live proof exists, draft PR acceptance is a deployment NO-GO; this contract does not invent a second authority.

## Required verifier mutations — repaired
Maximum four.

**C1 — numeric authority bypass.**
Patch exactly the final owner-authority comparison from `review.user.id == OWNER_ID` to login-name equality, with no surviving numeric filter before it. Dedicated fixture: attacker review with matching login text representation but wrong numeric id; unmutated rejects, mutant accepts.

**C2 — latest blocker fallback.**
Patch exactly selection so the immediately older approving Owner envelope is selected instead of the latest valid blocking envelope. Dedicated two-review fixture isolates this selection; digest freshness checks stay satisfied for the selected mutant snapshot.

**C3 — Gate review digest omission.**
Patch exactly Stage2 comparison so `reviewSnapshotDigest` from GateReceipt is not checked. Fixture uses the same H/main/run attempt but changes R0→R1 after Gate before Stage2. All attempt jobs are otherwise complete. Unmutated returns `REVIEW_CHANGED_AFTER_GATE`; mutant incorrectly proceeds. This replaces the masked runAttempt mutant.

**C4 — final main freshness omission.**
Patch exactly the final-round current-main equality check while keeping PR base/head/review checks satisfied in a controlled snapshot fixture. Unmutated rejects moved main; mutant accepts. If another main check fires first, the mutant is masked and INVALID.

Each mutant must be exact byte-bound after implementation, one-site, once-applied, with named baseline assertion and explicit masking analysis. Compiler/import/harness errors and changed rejection codes do not count as kills.

## Acceptance deltas
- AV-150: schema-invalid `reject` is `REVIEW_SCHEMA`; a valid `request_changes` remains a semantic review rejection.
- AV-154: review changes between Gate and Stage2 => `REVIEW_CHANGED_AFTER_GATE`.
- AV-155: review changes between final rounds remain reject.
- AV-170/172/173: assert fresh complete current-attempt job evidence only; do not assert an unobservable UI rerun action or absence of foreign same-name publishers.
- NEW AV-180: identical final snapshots but different Gate review snapshots must produce different GateReceipt reviewSnapshotDigest and reject the changed case.
- NEW AV-181: `approve` plus active `disposition=block` finding => `REVIEW_SCHEMA`.
- NEW AV-182: supersedes may reference only earlier finding IDs; transitive closure removes superseded blockers deterministically; unknown/self/forward refs => `REVIEW_SCHEMA`.

## Size
Retain realistic total estimate 1,008 LOC ±30% across C production modules. No artificial <400-total target. Individual modules SHOULD remain below 400 LOC; split modules at architecture review if needed rather than dropping semantics.

## Implementability
C depends on accepted B (and transitively A), but neither A nor B depends on C. The image recipe and platform deployment proofs are external inputs to acceptance, not imports back into A/B. No A↔B↔C cycle remains.

## Execution-isolation boundary
C may require B's deployment evidence but MUST NOT upgrade it into stronger claims. No contract claim of containment against kernel exploits, arbitrary reporter dishonesty, review ABA outside observed boundaries, or atomic GitHub finality is made.

## Verdict target
If this candidate is approved after the real B acceptedCommit and deployment prerequisites are supplied: **READY FOR ARCHITECTURE REVIEW**.
