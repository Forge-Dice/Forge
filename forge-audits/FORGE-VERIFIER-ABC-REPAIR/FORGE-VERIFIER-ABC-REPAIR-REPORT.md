# FORGE VERIFIER A/B/C TARGETED CONTRACT REPAIR REPORT

Date: 2026-10-04  
Repository: Forge-Dice/Forge  
Mode: Contract-only repair; canonical code STRICT READ-ONLY  
Pinned remote main before repair branch creation: `3d7545d843883418348004e68717399a64da7a7d`

## 1. Source authority

This repair was derived from original GitHub audit branches, not chat summaries.

| Source | Branch | Commit |
|---|---|---|
| Minimum Verifier Implementation A/B/C | `forge/owner/audits/FORGE-MINIMUM-VERIFIER-IMPLEMENTATION` | `bb525bfd230128d3d98f3db744ba23217196c53c` |
| A/B/C Independent Certification | `forge/owner/audits/VERIFIER-ABC-INDEPENDENT-CERTIFICATION` | `b854b11379b5cb43c3d6bc77fedacde7e96511fd` |
| Bootstrap Experimental Report | `forge/owner/audits/FORGE-V0.1-BOOTSTRAP` | `da9b3d51398819db3d03af59582e1b1da3750728` |
| Reference Oracle Quality Report | `forge/owner/audits/reference-oracle-quality` | `83214206fced70a97babca9dff7bb137b60ea64a` |
| Ruleset Live Drill | `forge/owner/audits/FORGE-RULESET-LIVE-DRILL` | `005bcd092008fc4cf5453e208f455814aa7ebb25` |
| First Drill Pre-Mortem | `forge/owner/audits/FORGE-FIRST-DRILL-PRE-MORTEM` | `9e5789e054c88eb8c0c43d80e9a361a4bc3d3051` |
| Architecture Freeze | `forge/owner/audits/FORGE-V0.1-ARCHITECTURE-FREEZE` | `a5302309ce321fcfccdd26aee1cf566f7a137096` |
| CORE-0002 later boundary only | `forge/owner/audits/FORGE-CORE-0002` | `b8fb63bf5d4ec17f7c91a5f0b619eddf6234f1ae` |

Independent Certification findings F01–F10 were treated as the primary defect register. Architecture Freeze has precedence for responsibility boundaries where older drafts assign platform concerns to verifier prose. CORE-0002 was used only to prevent this repair from silently pulling later Format-2/kernel scope into Bootstrap A/B/C.

## 2. Defect classification

| Requested blocker | Classification | Primary owner | Contract change? |
|---|---|---|---|
| A. contradictory streaming/resource budgets | **REAL CONTRACT DEFECT** | A | yes |
| B. Gate→Stage2 review/authority gap | **REAL CONTRACT DEFECT** | C | yes |
| C. unclosed review schemas | **REAL CONTRACT DEFECT** | C | yes |
| D. partially masked mutant evidence | **REAL CONTRACT DEFECT** in acceptance/mutant contract | A/B/C by their own mutant set | yes |
| E. second-parent protection | **REAL CONTRACT DEFECT** | A | yes |
| F. failure-code/rejection priority | **REAL CONTRACT DEFECT only for certified collisions** | owner of affected layer | yes, narrowly |
| G. draft-gate | **PLATFORM CONFIGURATION** | Platform/Ruleset | no duplicated security requirement |
| H. merge-method protection | **PLATFORM CONFIGURATION** | Platform/Ruleset | no |
| I. R3/Owner-bypass semantics | **PLATFORM CONFIGURATION / OWNER PROCEDURE** | Platform/Ruleset + Owner Procedure | no |
| J. execution-isolation boundary | **IMPLEMENTATION/DEPLOYMENT ACCEPTANCE BOUNDARY** | B for worker evidence; Platform for live enforcement | only wording that prevents overclaim |

F05, F06, F07 and F10 from certification remain nonblocking boundary notes. They do not justify expanding A/B/C scope.

## 3. Responsibility freeze

### A
Primary owner of Git acquisition/object/layout/path/mode/history validation, second-parent protection, safe materialization, and A-owned object/process resource accounting.

### B
Primary owner of exact scope/freeze, test inventory, worker execution protocol, measurable worker-isolation probes, mutation application/classification and worker report transport.

### C
Primary owner of GitHub read adapter, review schema/selection/freshness, Gate→Stage2 receipt binding, final two-round recheck, current-attempt job interpretation and workflow shape.

### Platform/Ruleset
Primary owner of merge-method protection, required-check source binding, Actions execution policy, branch/ruleset bypass semantics, and platform-level draft enforcement where configured.

### Owner Procedure
Primary owner of architecture approval, publication of accepted dependency SHAs, bootstrap/deployment attestations and any human-only exception procedure.

**ZERO OWNER search:** none after repair for certified obligations.  
**MULTIPLE OWNER search:** resolved. A history is consumed by B/C, not reimplemented; B isolation measurements are consumed by C, not re-owned; C reads platform assurance without defining rulesets.

## 4. Exact patches

### Patch A-1 — separated streaming and diagnostic budgets
**Contract:** A  
**Section:** Resource budgets  
**OLD:** "bounded data stream/process output budget" was effectively a shared 8 MiB lifetime cap; a valid 8 MiB object plus frame bytes exceeded it.  
**NEW:** distinct channels: object payload max 8,388,608 bytes; frame header max 256 bytes; aggregate object-data operation budget 512 MiB streamed; diagnostic stdout/stderr max 1 MiB per child. Frame bytes are not charged to object payload.  
**Reason:** closes F01/P03 without weakening the 8 MiB object limit.  
**Evidence:** certification F01 states a valid 8 MiB object needs 8,388,663 bytes in the cat-file frame and long-lived batches were incorrectly capped by a process lifetime budget.  
**Acceptance impact:** AV-179 new; resource failure precedence narrowed to frame-validity then size.  
**Mutant impact:** none directly; future resource mutant must target one channel, not conflate them.  
**Version impact:** A contractVersion 1→2.

### Patch A-2 — second-parent guard
**Contract:** A  
**Section:** History  
**OLD:** "2. Parent forbidden only above BASE" without an exact enforceable parent-count rule; Reference Quality found there was no actual one-parent guard to mutate.  
**NEW:** every commit HEAD→exclusive BASE must have exactly one parent and that parent is the next validated commit toward BASE; BASE itself may be a merge. Any second parent above BASE => `GIT_HISTORY`.  
**Reason:** closes the documented Reference blind spot and F08-related missing mutant target.  
**Evidence:** Reference Oracle Quality: seven effective mutants killed; the requested "permit second parent" mutant was equivalent because the guard was absent.  
**Acceptance impact:** AV-178 new. AV-071 also specifies that the 129-history-count limit wins first as `GIT_LIMIT`.  
**Mutant impact:** second-parent weakness now has a non-equivalent contract-level witness.  
**Version impact:** A v2.

### Patch B-1 — inventory identity closure
**Contract:** B  
**Section:** Test inventory  
**OLD:** tuple+occurrence/fullName rules allowed multiple interpretations about same fullName and replacement.  
**NEW:** strict record schema; tuple=(file,project,ancestors,title), positive deterministic occurrence; same fullName is allowed across distinct tuples but no tuple/occurrence duplicate or dictionary collapse; BASE structural multiset must be contained in HEAD with passing status.  
**Reason:** closes F03/AV115.  
**Evidence:** certification F03 names the same-fullName ambiguity.  
**Acceptance impact:** AV-115 expected-result clarification; AV-183 new count-preserving replacement case.  
**Mutant impact:** B2 becomes an isolated count-only weakness.  
**Version impact:** B v2.

### Patch B-2 — measured isolation result
**Contract:** B  
**Section:** Worker execution  
**OLD:** acceptance could require an OS-denied worker access to surface as a supervisor event not guaranteed by the OS/runtime.  
**NEW:** each hostile probe reports strict measured evidence `{probeId,attempted,denied,observationKind,observationCode}`; denial can be errno/exit/signal/network evidence. No invented supervisor sensor.  
**Reason:** closes F03/AV123–125 while preserving the sandbox requirement.  
**Evidence:** certification F03 explicitly states denied worker access is an isolation success, not automatically a supervisor event; F10 preserves deployment NO-GO.  
**Acceptance impact:** AV-123/124/125 expected-result changes; AV-184 new.  
**Mutant impact:** isolation probes can no longer be "killed" by absent telemetry.  
**Version impact:** B v2.

### Patch C-1 — Gate review snapshot digest
**Contract:** C  
**Section:** GateReceipt / Stage2 / final  
**OLD:** Gate observed R0, but receipt contained no review digest; Stage2 could see R1 and two identical final rounds could no longer prove what Gate authorized.  
**NEW:** Stage1 computes canonical `reviewSnapshotDigest` and binds it into GateReceipt; Stage2 and both final rounds reconstruct the review snapshot and require exact digest equality. Any Gate→Stage2 change => `REVIEW_CHANGED_AFTER_GATE`.  
**Reason:** closes F02/P04 information loss.  
**Evidence:** certification F02 gives two different Gate observations with the same receipt.  
**Acceptance impact:** AV-154 expected-result change; AV-180 new; AV-155 remains reject on final-round change.  
**Mutant impact:** C3 is replaced by direct omission of the Gate review digest comparison, avoiding runAttempt/job-set masking.  
**Version impact:** C v2.

### Patch C-2 — closed review/finding/supersedes schema
**Contract:** C  
**Section:** Review schema  
**OLD:** StrictObject was named, but severity enum, blocking predicate and supersedes closure were not closed; `approve` with critical/fatal findings had divergent interpretations.  
**NEW:** strict ReviewEnvelope and Finding schemas; `result=approve|request_changes` only; severity enum `critical|high|medium|low|info`; disposition `block|note`; supersedes points only backward within the same envelope; transitive closure deterministic; approve iff no active blocker.  
**Reason:** closes F04 and the F03 invalid-`reject` ambiguity.  
**Evidence:** certification F04 and F03.  
**Acceptance impact:** AV-150 expected-result change; AV-181/182 new.  
**Mutant impact:** C2 can isolate latest-review fallback from schema failures.  
**Version impact:** C v2.

### Patch C-3 — observable rerun semantics only
**Contract:** C  
**Section:** Current attempt/jobs  
**OLD:** contract language could imply proof that "Re-run all jobs" specifically was clicked and/or that no foreign same-name check exists.  
**NEW:** C proves only current run/attempt, numeric triggering actor, complete expected current-attempt jobs and receipt binding. UI rerun menu choice and foreign check source binding are not claimed.  
**Reason:** closes F09 without inventing extra GETs or a new publisher.  
**Evidence:** certification F09; Architecture Freeze assigns required-check source/merge protection to Platform/Ruleset.  
**Acceptance impact:** AV-170/172/173 expected-result changes.  
**Mutant impact:** C3 no longer targets an observationally redundant runAttempt check.  
**Version impact:** C v2.

### Patch X-1 — mutation evidence anti-masking
**Contract:** A/B/C  
**Section:** Required verifier mutations  
**OLD:** several semantic descriptions were not guaranteed applicable and could be masked by earlier guards; changed code/error/compile failure could be misreported as a security kill.  
**NEW:** each mutant must be byte-bound after implementation, single-site, once-applied, with a named previously-green assertion and explicit masking analysis. Syntax/import/compiler failure, timeout, missing report, unrelated earlier rejection or changed error code is not KILLED. A1/A4/B3/C3 are replaced with isolated semantic mutations.  
**Reason:** closes F08.  
**Evidence:** certification mutant review and P01/P06.  
**Acceptance impact:** no giant suite; mutation harness assertions are updated.  
**Mutant impact:** all twelve are now specified as isolated future byte-bound patches, four per contract.  
**Version impact:** all A/B/C v2.

## 5. Failure-code and rejection priority

No new global priority lattice was invented. Only certified collisions are fixed:

1. malformed review/external object => schema/input code, never semantic `reject`;
2. valid `request_changes` => semantic review rejection;
3. 129-history limit => `GIT_LIMIT` before ancestry-shape `GIT_HISTORY`;
4. valid frame is established before payload/aggregate size classification;
5. worker infrastructure failure dominates mutation KILLED;
6. review snapshot mismatch dominates final approval.

This is enough to remove the ambiguous acceptance outcomes without redesigning the verifier.

## 6. Draft gate, merge method, R3/Owner bypass

No A/B/C security requirement was added for these.

- **Draft gate:** Platform/Ruleset/Owner procedure. C may fail closed until live assurance exists, but does not become a second ruleset authority.
- **Merge method:** Architecture Freeze requires merge-commit-only configuration. This is Platform/Ruleset, not verifier code.
- **R3/Owner bypass:** live ruleset semantics and Owner-only merge procedure remain external. A/B/C may consume an assurance digest/status but cannot establish the repository setting themselves.
- **Required-check source binding:** Platform/Ruleset. C current-attempt job reads do not prove absence of a foreign same-name publisher.

## 7. Execution-isolation boundary

The repair preserves the explicit NO-GO boundary:
- process group alone is not a proof against `setsid` descendants;
- container/cgroup lifecycle must be tested;
- no claim of kernel-exploit containment;
- no claim that arbitrary adversarial JS cannot falsify its own in-process semantics;
- no claim of atomic GitHub review/final state beyond observed snapshots.

A owns safe pre-execution process/object primitives. B owns worker protocol and measured isolation probes. Live container/cgroup/Actions enforcement remains deployment acceptance.

## 8. Mutant reconciliation

Twelve existing mutant IDs remain, four per contract. None applies to current main because the implementation does not yet exist; the repaired contracts define what will become byte-bound after implementation.

| Mutant | Result |
|---|---|
| A1 | **REPLACED**: mutate only replace-reference authority; raw rehash remains intact |
| A2 | refined parent `O_NOFOLLOW` single-site |
| A3 | refined MODE_CHANGE single-site |
| A4 | **REPLACED**: duplicate collapse only after raw duplicate check position |
| B1 | refined valid file-prefix scope escape |
| B2 | refined count-only inventory replacement |
| B3 | **REPLACED**: classifier-only controlled compiler failure => KILLED |
| B4 | refined Developer fallback authority |
| C1 | refined numeric-id authority -> login comparison |
| C2 | refined newest blocker -> older approval |
| C3 | **REPLACED**: remove GateReceipt reviewSnapshotDigest comparison |
| C4 | refined final-main equality omission with controlled snapshot |

Maximum remains four per contract, below the requested maximum of eight.

## 9. Acceptance reconciliation

The machine-readable delta contains every original AV-001…AV-177.

- **UNCHANGED:** 166
- **EXPECTED-RESULT CHANGE:** 11
- **OBSOLETE:** 0
- **NEW CASE REQUIRED:** 7 (AV-178…AV-184)

Changed existing cases: AV-004, AV-071, AV-115, AV-123, AV-124, AV-125, AV-150, AV-154, AV-170, AV-172, AV-173.

New cases are only those needed to close proven evidence gaps: second-parent, exact-8-MiB framing, Gate-review digest loss, active-blocker schema, supersedes closure, count-preserving inventory substitution, measured denied-probe evidence.

## 10. Implementability and dependency graph

```
A  --Owner acceptance-->  B  --Owner acceptance-->  C
```

- A can be implemented alone after architecture approval.
- B can be implemented after the actual accepted A SHA is published. B needs no C API.
- C can be implemented after the actual accepted B SHA is published; A is transitively bound.
- Platform ruleset/configuration and Owner procedure are acceptance prerequisites, not code imports.
- No hidden A↔B↔C cycle remains.

The Lab-only A BASE stub and B external acceptance image are explicitly harness inputs and may not implement production semantics that belong to a later contract.

## 11. Size recheck

The original total production estimates are retained because they are plausible for the specified module sets:

| Contract | Total production estimate | Decision |
|---|---:|---|
| A | 1,320 LOC ±30% | acceptable across 8 production modules; per-module review signal at 400 LOC |
| B | 1,190 LOC ±30% | acceptable across 8 production modules; per-module review signal at 400 LOC |
| C | 1,008 LOC ±30% | acceptable across C modules/workflow assets; per-module review signal at 400 LOC |

No candidate pretends the whole contract fits under 400 LOC. No semantics were removed to meet a cosmetic size target. **SPLIT REQUIRED: NO at contract level** based on current module decomposition; architecture review may split an individual module if it exceeds the per-module signal.

## 12. Adversarial recheck

Exactly 100 targeted contract-level attacks are recorded in `acceptance-mutant-delta.json`, ten variants in each family:

1. streaming/resource-budget boundary;
2. Git history / second parent;
3. path/mode/materialization;
4. inventory / worker measured evidence;
5. mutation masking/classification;
6. review schema/freshness;
7. head/main/review races;
8. current-attempt/job evidence;
9. workflow authority;
10. Platform/Owner boundary.

All 100 are marked PASS in one of two legitimate senses:
- the repaired contract now fails closed or defines one deterministic valid result; or
- the attack is correctly refused as an A/B/C claim and left to Platform/Ruleset or Owner Procedure.

No Platform attack is counted as "closed by verifier code."

## 13. Architecture impact

This is a targeted repair, not a new verifier design:
- no new repository service;
- no new agent/provider;
- no new runtime API;
- no Format-2 backport;
- no new production scope paths;
- no GitHub setting changes;
- no extra workflow publisher;
- no relaxation of existing safety gates.

The only metadata revision is `contractVersion: 2` in each candidate. B/C retain null acceptedCommit intentionally until real predecessor acceptance exists.

## 14. Final verdicts

### Contract A
**READY FOR ARCHITECTURE REVIEW**  
**REGISTRATION READY AFTER ARCHITECTURE APPROVAL**

Reason: F01, second-parent gap and mutation masking are closed at contract level; A is independently implementable and does not rely on B/C.

### Contract B
**READY FOR ARCHITECTURE REVIEW**

Reason: inventory/worker evidence and mutation-classifier ambiguity are closed. Execution still correctly depends on a real accepted A SHA and deployment isolation evidence.

### Contract C
**READY FOR ARCHITECTURE REVIEW**

Reason: Gate→Stage2 review information loss, review schema closure, mutant masking and rerun-overclaim are closed. Execution still correctly depends on a real accepted B SHA and live Platform/Owner prerequisites.

## 15. Remaining blockers to execution, not contract review

These are not reasons to reopen the repaired contract text:
1. B cannot execute until A has a real independently accepted commit SHA.
2. C cannot execute until B has a real independently accepted commit SHA.
3. Live Platform/Ruleset evidence is still required for merge-method protection, required-check source binding, Actions policy, bypass semantics and any draft-gate claim.
4. Worker/container/cgroup isolation remains a deployment acceptance item; this repair does not claim it was tested.
5. A/B/C candidate v2 still require independent architecture review before registration/execution.

No production implementation was created.
