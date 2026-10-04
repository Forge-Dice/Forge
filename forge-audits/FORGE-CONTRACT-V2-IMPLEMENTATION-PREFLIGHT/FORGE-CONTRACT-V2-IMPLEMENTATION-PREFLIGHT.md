# FORGE CONTRACT V2 IMPLEMENTATION PREFLIGHT

Read-only assessment, 3 October 2026. Canonical repository: **Forge-Dice/Forge**. Examined main: **3d7545d843883418348004e68717399a64da7a7d**. Remote main was checked repeatedly and remained at that SHA.

**Recommendation: prepare a narrow, additive Format-2 path in at most three tasks. Its first parser task is approximately 240–340 production lines, but its wire schema must be reconciled before implementation. V-01 remains NO-GO for registration/start until the lifecycle and Git observation/start integration also exist.**

This report strictly distinguishes **A — actual main evidence**, **B — the owner's confirmed V2 handoff**, and **C — unresolved details that require the original design**. The owner confirmed that `FORGE-CONTRACT-SYSTEM-V2.md` was created read-only by Claude and was not committed. Its exact schemas, proposed two-task split, 40 adversarial cases and OD-A–OD-L contents were not supplied. Nothing below claims to reproduce them. The earlier V-01 draft was retrieved from the existing Forge chat; its decoder scope and four-file allowlist are retained.

**B — confirmed and binding:** new tasks use Format 2; hashed specifiedAgainst replaces baseCommit; runBase is an external run fact; relevant reads/scope.modify changes must not pass silently; SPEC_STALE requires revision/reconciliation with **no waiver**; C is a single non-merge contract content commit; M is the main registration merge; the developer starts at R; blockers have stable IDs and explicit carry-forward/resolution; assigned reviewers remain relevant to their blockers; revisions/supersedes are explicit; status is derived; an explicit end marker and exact-content review binding are required. TASK-0004 is frozen; TASK-0005 is migrated only when explicitly commissioned for implementation. Historical contracts/approvals are not rewritten. Hard LOC limits may be contract-specific, not a universal Forge constant.

**C — not invented here:** exact Format-2 fields/types beyond the confirmed semantic names, revision/supersedes encoding, finding-event encoding, marker spelling, canonicalization/hash algorithm/domain, dependency encoding, and the missing OD-A–OD-L decisions. Laboratory code necessarily uses illustrative encodings to test properties. Those encodings are **not proposed contracts, authoritative schemas, golden vectors for V2, or production conformance evidence**.

No canonical repository files, commits, branches, PRs, or settings were changed. Disposable clones and a separate bare Git laboratory were used. The laboratory creates genuine Git commit objects with `commit-tree`; it does not create development branches or publish anything. A local clone's Git configuration was changed only to preserve LF bytes. All production files in the baseline clone remain clean.

Evidence: [scratch assertions](preflight-evidence.json), [gate composition assertions](start-gate-model-results.json), [actual Git parents](graph-history.txt), [contract inventory](baseline-contract-inventory.json), [source manifest](source-manifest.json), and [reproduction instructions](REPRODUCE.txt).

## 1. Current Format 1

**A — verified against actual main.**

### Code inventory at the examined main

| File | Actual responsibility | V2 consequence |
|---|---|---|
| `src/forge/contract-document.ts` (145 lines) | Strict Format-1 metadata; exact text parsing/hash; canonical task path; frozen document | Retain legacy API, parser, hash domain and accepted inputs unchanged |
| `src/forge/start-gate.ts` (101) | State/approval checks plus witnessed ancestry and contract binding; returns C | Add an explicit Format-2 path returning R |
| `src/forge/events.ts` (153) | Strict event schemas, roles, witnessed refs/parents/contract hash | Add separate V2 event shapes; do not make V1 schemas permissive |
| `src/forge/runs.ts` (88) | Run IDs, graph/ref schemas, reports, changes, checks, mutations | Existing evidence semantics reusable; raw graph schema does not prove completeness |
| `src/forge/state.ts` (452) | Event application, replay, versions, approvals, runs, reviews, acceptance, derived states | Extend with discriminated V2 records, explicit lineage and finding obligations |
| `src/forge/kernel.ts` (30) | Binds hash function, policy and start gate | Add V2 parser access/integration without changing V1 parser behavior |
| `src/forge/ancestry.ts` | Reachability over every supplied parent; cycles terminate | Reuse general ancestry, add first-parent and complete-parent validation |
| `src/forge/verification.ts` | Scope, checks, mutations, remote containment | Reuse scope/check/mutation projection; result ancestry must now use R for V2 |
| `src/forge/primitives.ts` | Task/SHA/path/text/finding schemas | V-01 is already a valid task ID; current findings lack IDs |
| `tests/forge/dogfood.test.ts` (171) | Parses Forge contracts, checks approval hashes, inventories direct core files, replays historical runs | Keep historical fixtures and expectations; add a separate V2 suite |

Source anchors: [parser and schema](https://github.com/Forge-Dice/Forge/blob/3d7545d843883418348004e68717399a64da7a7d/src/forge/contract-document.ts#L24), [start gate](https://github.com/Forge-Dice/Forge/blob/3d7545d843883418348004e68717399a64da7a7d/src/forge/start-gate.ts#L55), [event application](https://github.com/Forge-Dice/Forge/blob/3d7545d843883418348004e68717399a64da7a7d/src/forge/state.ts#L288), [dogfood](https://github.com/Forge-Dice/Forge/blob/3d7545d843883418348004e68717399a64da7a7d/tests/forge/dogfood.test.ts#L25).

### Exact current document rules

Frontmatter begins at character zero with `---json\n`, ends with `\n---\n`, and must equal `JSON.stringify(JSON.parse(json), null, 2)`. This rejects duplicate keys and alternative whitespace/escapes. It does **not** sort keys: another key order is accepted and produces another hash. Unknown fields are rejected by strict objects. Format is exactly 1.

Required metadata: `forgeContractFormat`, `taskId`, `contractVersion`, `baseCommit`, `dependencies`, `scope.create`, `scope.modify`, `requiredChecks`, `mutationSmoke`. Versions are positive safe integers. Dependencies are `{taskId, acceptedCommit: SHA|null}`; self/duplicate dependencies fail. Scope uses exact paths, rejects exact duplicates across create/modify and the canonical own contract path. It does not support directory globs. Checks require at least one entry and unique names. Mutation mode is `none|optional|required`.

The parser rejects a leading BOM, CR anywhere and lone UTF-16 surrogates. The byte boundary must use fatal UTF-8 decoding with BOM preservation; the dogfood test does so. Markdown is opaque and may be empty. There is no end marker: a truncated body can parse but has a different hash.

Hash: `SHA256(UTF8("forge-contract-v1\n" + exactText))`. The hash is derived, not stored inside the contract. `contractPathFor(taskId)` always returns `forge/contracts/<taskId>.md`, regardless of contractVersion.

### Exact current lifecycle

1. Owner emits `task_registered` with identity and title. Task becomes `planned`.
2. Spec author emits `contract_registered`, supplying C, canonical path, full text and declared hash. Reducer parses text, checks hash/task/path, requires the next integer version starting at 1, and stores a revision with no decisions. It does **not** query Git at registration. It currently allows registration while an older run is active.
3. Independent architecture reviewer emits `approval_recorded` for the exact content hash. Only the current revision is reviewable. There is one final decision per gate/hash. `changes_requested` needs findings and cannot later become approved on that same hash. `approved` rejects blocking findings. Every dependency must have a non-null pin equal to the dependency task's accepted verified result commit.
4. New version supersedes the old version and inherits **no approval decisions**. Prior findings remain in historical decisions, but have no stable ID or enforced carry-forward. An empty approval on the new version can consequently leave the old objection unaddressed.
5. Start request contains task ID, hash and `repoObservation`. Only `ready` or `rework_required` can start; active runs block. Current/approved revision required. Observation must match revision C/path/hash; C and baseCommit must be reachable from some supplied ref; baseCommit must be ancestor-or-self of C; pinned dependency commits must be ancestors of baseCommit. There is no canonical-main, registration-merge or input-staleness requirement. Successful return is `startFromCommit = C`.
6. `run_started` reruns that gate, rejects duplicate run ID and records `startedFromCommit`. Developer may then submit one report naming result commit/ref. A self-report does not establish persistence.
7. Observer facts establish remote containment only when the reported result is reachable from the claimed ref head and the recorded start is ancestor-or-self of result. Negative observations permit retry. After remote verification, current event rules no longer admit later remote observations for that run.
8. Verification must target the claimed result and use `method: fresh_clone`. Required checks require one matching name/command with exit code 0. Evidence names and changed endpoints are unique. Deletes are forbidden; only coordination-to-coordination renames are allowed. Exact create/modify paths apply, with the existing coordination exemption and contract/approval prohibitions. Verifier mutation evidence, if present, replaces developer evidence; equivalent mutations require review acknowledgement.
9. Only the latest verified run on the current revision can be code-reviewed. Review binds to its verified commit and must be independent of its developer. Approval has no blocking findings and `requires:null`; changes requested has findings and `requires:code_change|contract_change`. Code change permits a new run on the same contract; contract change requires a new approved revision.
10. Human owner accepts the latest review-approved run. Accepted commit is its verified result; acceptance is terminal for new contracts/approvals/starts.

States are projections, not contract/event status fields. Contract projections are `draft/approved/changes_requested/superseded`; task projections are `planned/specifying/ready/implementing/awaiting_review/review_approved/rework_required/contract_revision_required/accepted`; run projections are `running/reported/remote_verified/verified/failed/abandoned`.

Trust boundary: the eventlog is authoritative, with replay under the same policy. Actor identity and Git observations are supplied facts, not authenticated by the pure kernel. `applyEvent` trusts supplied structural state; callers must use kernel-produced/replayed state. This preflight does not relabel those existing limits as solved.

### Contracts, approvals and reviews actually on main

| Artifact | Actual result |
|---|---|
| `FORGE-CORE-0001A.md` | Format 1, contractVersion 1, parses; hash `af91442ec38f712076648da97464c887e4925819c13838afe1fd7923b8fc4c69` |
| `FORGE-CORE-0001A-PATCH-0001.md` | Format 1, version 1, parses; architecture approved+blocking guard |
| `FORGE-CORE-0001B.md` | Format 1, version 1, parses; hash `680db30f45ca77b449fa0565d94db11475135f42c871ad589f5445355f279f6d` |
| `FORGE-CORE-0001B.v2.md` | **Format 1**, version 2, parses; sidecar path cannot register through the current resolver |
| `TASK-0004.md` | Historical YAML/status-bearing document, rejected as `FRONTMATTER_MISSING`; frozen |
| `forge/approvals/FORGE-CORE-0001A.v1.architecture_review.json` | Exact A-v1 hash; human preauthorization provenance explicitly qualified in its text |
| `forge/approvals/FORGE-CORE-0001B.v1.architecture_review.json` | Exact B-v1 hash; its text distinguishes owner authorization from unreviewed reconciliation decisions |
| `FORGE-CORE-0001AB.red-team.md` | Historical audit, not current approval |
| `FORGE-CORE-0001B.v2.chatgpt-review.md` | Human-readable historical PASS for A-patch/B-v2 at `811ed0d…`, not a ForgeLog acceptance |
| `FORGE-CORE-0001B.v2.verification.md` and `.mutations.json` | Repair verification/mutation evidence, not contract registration |
| `TASK-0005.architecture-review.md` | REQUEST_CHANGES bound to older TASK-0005 branch/blob; no TASK-0005 contract or implementation on main |

The dogfood replay leaves A/B `awaiting_review`; prose review files are not automatically ingested as events. The baseline guide explicitly leaves B-v2 sidecar registration open. Do not invent accepted dependencies from these artifacts.

### Baseline execution

Node `v24.19.0`. A fresh LF-preserving clone received lockfile installation using npm 11.6.2 via the bundled pnpm launcher, with lifecycle scripts disabled: 40 packages added, audit reported zero vulnerabilities. Direct script-equivalent TypeScript checking passed. Direct full Vitest invocation ran 1,087 tests: 1,085 passed, two differential-fuzz tests (`seed 1`, `seed 2`) timed out at their unchanged 5,000 ms limit. Suite duration was approximately 78.62 s. After the Git lab finished, a targeted rerun of those two cases passed at unchanged limits (approximately 7.77 s total, 29 other cases skipped). This is **not** a claim that the original full-suite invocation was green. No test/config repairs were made. `git diff --check` passed and tracked worktree status remained empty.

## 2. Gap Map

**A/B/C boundary:** classifications compare actual main (A) with confirmed required semantics (B). Implementation mechanisms are proposed, and wire details remain C. No implementation was performed.

| Concept | Classification | Minimum action |
|---|---|---|
| Task identity, exact check names/commands, scope operation lists, mutation requirement | ALREADY SUPPORTED | Reuse shapes/invariants; task title stays in task registration/body |
| No contract/event status fields, derived state, immutable results | ALREADY SUPPORTED | Retain; reject unknown keys recursively |
| Hash-bound architecture approval; code-review run/commit binding | EXTEND EXISTING | Preserve exact target identity and content binding; V2 encoding unresolved |
| Format 2 | EXTEND EXISTING | Separate parser plus explicit dispatch; retain V1 parser/API |
| `specifiedAgainst` | EXTEND EXISTING | Replace V1 baseCommit meaning only in V2; immutable S |
| `runBase` as run fact | EXTEND EXISTING | V2 run_started records R; startedFromCommit equals R |
| `reads` file/tree selectors | NEW | Input footprint, exact tree-entry comparison |
| `SPEC_STALE` | NEW | S-to-R endpoint content/mode/type comparison; structured reasons |
| `revision` | EXTEND EXISTING | Explicit progressing lineage; exact representation and transition syntax unresolved |
| `supersedes` | NEW | Explicit predecessor binding; first-revision and reference encoding unresolved |
| Blocking finding carry-forward | NEW | Stable IDs, explicit resolution and retained assigned-reviewer relevance; encoding unresolved |
| C versus M distinction | NEW | Candidate C, review, then independently observed merge M |
| Explicit end marker and V2 content hashing | NEW | Strict terminal framing and exact-content binding; syntax/hash details unresolved |
| Dependencies | EXTEND EXISTING | Preserve real prerequisite identity/provenance; V2 dependency wire and acceptance rules require reconciliation |
| Canonical-main observation | NEW | Narrow trusted collector and fixed canonical repository/ref |
| Reviewer identity/assignment provenance and reads-list completeness | PROCESS ONLY plus EXTEND EXISTING | Controlled ingestion and independent review; assignment binding must be enforced once its rules are supplied |
| Approval before registration merge | PROCESS ONLY plus proposed event sequencing | Exact-content review followed by observed M; exact event model unresolved |
| Historical-change staleness | DEFER only if reconciled endpoint policy is adopted | C — endpoint versus history choice unresolved; both prototyped |
| Multi-commit registration branches, merge C, squash/rebase/fast-forward registration | DEFER | Explicitly reject in minimum profile |
| Automatic rebase/reapproval, automatic finding matching | DEFER | Revision and independent review instead |
| Per-read stored blob hashes | DEFER if design permits | S already pins objects; whether wire also requires per-read bindings remains unresolved |
| General issue tracker, waivers, assignments, dashboards, storage service | DEFER | Not required for V-01 |
| GitHub Actions/branch settings/auth overhaul/full independent verifier | DEFER | Different workstream; don't imply minimum is an untrusted multiuser service |

## 3. Minimum Format 2

**B — required semantic content. C — exact schema UNRESOLVED.** No JSON instance or final wire schema is supplied. The smallest honest schema is the one that expresses the following obligations without duplicating run/process facts.

| Concern | Minimum semantic obligation | What remains unresolved |
|---|---|---|
| Task identity | Stable task identity must match task registration and contract artifact | Whether other identity/title fields are required by V2 |
| Revision | Explicit distinguishable revision; no rollback, duplicate current revision or silent overwrite | Type, numbering, first-revision encoding and whether numbering must be consecutive |
| specifiedAgainst | Immutable, hashed identity of the actual code state used to specify the contract | Exact SHA/object-format constraints and wire schema |
| reads | Machine-readable declared input footprint; omission cannot be repaired by guessing | Array/object representation, file/directory selector syntax, whether per-input hashes are carried |
| scope.create | Exact authorized creations; targets must still be creatable at run start | Wire shape and portability profile |
| scope.modify | Exact authorized modifications; automatically part of freshness footprint | Wire shape and existence/kind constraints |
| Dependencies | Explicit real prerequisites; no fabricated acceptance; no unnoticed prerequisite drift | V2 reference structure, required fields, draft unresolved-reference policy |
| requiredChecks | Required checks remain unambiguous and independently verifiable | Whether V2 reuses current name/command encoding |
| Mutation requirement | V-01 requires its specified mutation smoke evidence | Exact V2 encoding; existing evaluator is reusable if semantic projection matches |
| supersedes | Explicit predecessor relationship sufficient to prevent rollback, branching ambiguity and cycles | Exact reference representation and first-revision value |
| Findings carry-forward | Stable blockers survive revision changes; resolution requires evidence and relevant assigned reviewer | Location of carry-forward facts, exact review/resolution schema and reassignment authority |
| End marker | A machine-detectable complete-document boundary | Marker bytes, placement, escaping and EOF grammar |
| No status | Approval/run/task status must derive from authoritative facts | Already confirmed; not an open decision |

RunBase, C and M are process facts. The confirmed design explicitly excludes runBase from the contract. C and M must be observed externally to avoid circular self-identification; do not insert guessed fields for them.

For V-01, retain the technical draft's four creation targets:

    src/forge-verifier/git-change-set.ts
    tests/forge-verifier/git-change-set.fixture.ts
    tests/forge-verifier/git-change-set.test.ts
    tests/forge-verifier/git-change-set.typecheck.ts

No existing files are modified by V-01. Required operations remain typecheck, full tests, diff whitespace checking and the specified mutation smokes. Their final metadata spelling is C.

The draft's semantic read list includes the existing runs/primitives/freeze/verification/contract-document/start-gate/events/state/kernel modules; runs/verification/repair/dogfood tests; the four Forge-Core contract documents; the baseline guide; package.json, package-lock.json and tsconfig.json. The exact list is preserved in the retrieved technical draft. Reconcile it after the support implementation lands: those support tasks will change several files on that list. Do not retain today's S blindly.

Dependencies must not be fabricated from historical prose approvals. If the final contract asserts accepted-task prerequisites, bind them to real authoritative acceptance records. If it only depends on available baseline APIs, represent that honestly according to the eventual V2 dependency rules and reads/S. Whether an empty formal dependency list is permissible remains a reconciliation item, not an invented V2 rule.

**Safe to postpone if absent from the original minimum:** automatic read discovery, a general issue tracker, dashboards, automatic migration, alternate merge strategies, per-read hashes redundant with S, semantic version labels and automatic rebase/reapproval. **Cannot postpone:** resolving the wire representation of all required concerns before issuing an approved registrable document. Artifact path resolution must distinguish immutable revisions; its exact filename convention is not chosen here.

## 4. C/M/S/R Semantics

**B:** S/C/M/R roles, non-merge C, registration at merge M and start at R are confirmed. **C:** the additional ancestry/purity policy below is a conservative laboratory profile, not an owner-finalized policy.

Let **S** be specifiedAgainst, **C** the exact contract content commit, **P** the pre-registration main tip (`M^1`), **M** the registration merge, **R** the run-selected base, and **H** the witnessed canonical main head. `<=` means ancestor-or-self; `<=fp` means inclusion along first-parent history, including self.

```text
S ------- P ------- M ------- R ------- H    canonical main spine
 \                 /
  C --------------/                         contract-only candidate
```

### Required semantic facts versus minimum-profile restrictions

The conceptual necessities are: S identifies the reviewed inputs; C contains the approved bytes; M actually integrates C; R includes that registration and is a selected main snapshot; watched inputs remain valid from S to R. Merely asserting S<=C<=M<=R is insufficient to establish any tree purity or branch identity.

The tested **conservative profile** adds the following restrictions. In particular, `parent(C)=S`, direct second-parent equality, contract-only deltas and first-parent membership need reconciliation; the handoff does not itself specify every one of them:

1. All named values resolve to real commit objects in the canonical repository. Complete ordered parent lists are read from Git, never inferred from a path through a partial graph.
2. `parents(C) == [S]`. C is one non-merge commit directly on S. Its full tree delta from S is exactly the new revision artifact, represented as an added `100644` blob in the laboratory. Whether revisions use a fresh path or a changed canonical path is unresolved. No implementation, approvals or review files are bundled into C.
3. `parents(M) == [P,C]`. Exactly two ordered parents; S<=fp P. The pre-merge observer must confirm P is canonical main's then-current tip; post-merge observation confirms M lies on main's first-parent history. This minimal profile explicitly excludes squash, fast-forward and rebased registration.
4. Full tree delta P→M is exactly addition of the same contract artifact. Tree entry at that path—mode, kind and blob OID—is identical at C and M. Verify the content SHA-256 from actual blob bytes, not only a supplied string.
5. M<=fp R<=fp H. R=M is permitted. An older explicitly chosen R between M and H is permitted; latest-main-only is not a necessary ancestry rule. A branch reachable only through a merge's second parent is not an eligible R.
6. Artifact entry/bytes/hash at R equal those approved at C and registered at M. No rewritten registration content.
7. S→R passes the staleness/create checks. Each accepted dependency D matches the log and satisfies D<=S; D<=R follows but is checked in the witness for clear diagnostics.

**Proof under this profile:** C's sole parent establishes S<C. M's second parent establishes C<M. First-parent inclusion establishes M<=R<=H. Therefore S<C<M<=R<=H. S<=fp P separately proves S came from the main spine; it cannot be replaced by reachability through a foreign parent. The two independent tree-delta checks prove that neither the contract branch nor the registration merge contributes other net files. Requiring C's only parent to be S also excludes hidden intermediate commits, including code later reverted. C cannot equal S or M; R can equal M. None of these facts imply input freshness: G05 is the counterexample.

These are sufficient conservative rules, not a claim that the handoff mandates every restriction or that Git logically requires C to be directly on S. Supporting a longer branch would require checking every introduced parent/commit or defining a weaker net-tree policy; that work is unnecessary for the first contract.

### Executed real Git graph cases

The lab uses `hash-object`, `mktree`, `commit-tree`, `merge-base --is-ancestor`, `rev-list --first-parent`, `ls-tree` and full no-renames `diff-tree`. Merge objects have actual ordered parents and actual trees. This tests object-graph semantics, not GitHub merge UI/authentication. Full SHAs and parents are in the evidence files.

| Case | Construction | Graph result |
|---|---|---|
| G01 | Normal C/M, later R | Allow |
| G02 | P=S, normal two-parent M | Allow |
| G03 | R=M | Allow |
| G04 | R older than H on main spine | Allow |
| G05 | P changes a watched input | Graph allow; staleness rejects |
| G06 | C adds implementation code | Reject |
| G07 | Earlier code commit on contract branch | Reject |
| G08 | Earlier code change reverted before C | Reject |
| G09 | C itself a merge commit | Reject |
| G10 | C has an unrelated second parent | Reject |
| G11 | M has a foreign third parent | Reject |
| G12 | M's parents reversed | Reject |
| G13 | Contract bytes changed between C and M | Reject |
| G14 | M copies blob but does not contain C | Reject |
| G15 | Unrelated C grafted into M | Reject |
| G16 | Foreign first parent of M | Reject |
| G17 | R before M | Reject |
| G18 | R on unmerged side branch | Reject |
| G19 | R reachable from main only via second parent | Reject |
| G20 | Contract changed after M before R | Reject |
| G21 | M injects code absent from C | Reject |
| G22 | Fast-forward registration | Reject in minimum profile |
| G23 | Squash registration | Reject in minimum profile |
| G24 | Wrong S supplied | Reject |
| G25 | Wrong C supplied | Reject |
| G26 | Later commit falsely called M | Reject |
| G27 | R is a normal later main merge | Allow |
| G28 | Main snapshot excludes registration | Reject |

All 28 expected decisions passed. A Git DAG proves ancestry, not that somebody actually merged through an approved PR. Canonical-repository/ref observations and the reviewer/owner facts remain necessary. No fictitious Git signature or PR attestation is inferred from parent order.

## 5. SPEC_STALE

**B:** relevant reads/scope.modify changes must be checked; a stale result requires revision/reconciliation, never a waiver. **C:** whether “changed” means endpoint inequality or any historical touch is not finalized by the supplied handoff.

**Recommend endpoint tree-content staleness, subject to reconciliation.** At fixed immutable S and R, compare watched entries by `(mode, object kind, object OID)`. For a directory selector compare the tree entry, so additions/deletions/mode changes anywhere below it change the watched tree OID. Use actual Git objects, not working-tree files, timestamps or Git's rename heuristic.

Deterministic algorithm:

```text
validate schema and resolve S/R commits; require S <= R
selectors = unique(reads union scope.modify), sorted by code units
for each selector:
    require explicit complete entry observation at S and at R
    require declared file/tree kind at S
    missing S input => SPEC_INPUT_INVALID
    changed/missing R entry => SPEC_STALE(selector)
for each scope.create target:
    require absence at S and R, including directory collisions
    require no file/symlink/gitlink ancestor blocking creation
    collision at S => CREATE_PRESENT_AT_S
    collision at R => CREATE_TARGET_EXISTS / CREATE_PARENT_BLOCKED
sort/deduplicate all reasons; do not normalize paths or contents
```

Missing observation is an evidence error, not evidence of absence. A valid `ls-tree` lookup into a verified complete object store can establish absence. A caller-supplied incomplete map cannot. The laboratory distinguishes directory selectors with a trailing `/`; that is only a test encoding. The production selector wire syntax remains unresolved. Scope is modeled as exact files. Path sets use literal comparison, never Git pathspec expansion. Production collection should use literal-path handling or complete tree enumeration and match in code.

The minimum collector must reject unsupported/colliding paths and invalid object types at the selected footprint and create prefixes; it must not follow symlinks. V-01's broader full-tree portable decoder is a separate deliverable, not a prerequisite for this narrow observer. Case-insensitive create collisions on the target platform need explicit detection; the current scratch create check exercises exact paths and prefix collisions, not the full portability implementation.

| Executed case | Endpoint result | Historical distinction |
|---|---|---|
| S01 unchanged | Fresh | No touched input |
| S02 changed then exactly reverted | Fresh | Input was touched |
| S03 read changed | SPEC_STALE | Touched |
| S04 scope.modify changed | SPEC_STALE | Touched even if absent from reads |
| S05 read deleted | SPEC_STALE | Touched |
| S06 read renamed | SPEC_STALE | Old path absent; no rename-following |
| S07 new file under watched directory | SPEC_STALE | Subtree membership changed |
| S08 new sibling of an exact file read | Fresh | Not in declared footprint |
| S09 scope.create target appears | CREATE_TARGET_EXISTS | Separate precondition, not an unchanged read |
| S10 unrelated file change | Fresh | Outside footprint |
| S11 watched lockfile changes | SPEC_STALE | V-01 must declare lockfile |
| S12 undeclared lockfile changes | Fresh by declared inputs | Deliberate proof that incomplete reads are a review problem |
| S13 main merge changes watched file | SPEC_STALE | Compare merge result, not only first-parent commit messages |
| S14 unrelated main merge | Fresh | Inputs identical |
| S15 mode-only change | SPEC_STALE | Blob equality alone insufficient |
| S16 file becomes symlink | SPEC_STALE | Kind/mode matters |
| S17 read absent already at S | SPEC_INPUT_INVALID | Invalid premise |
| S18 create already exists at S/R | Block | Invalid create premise |
| S19 directory occupies create target | Block | Directory/file conflict |
| S20 file occupies create ancestor | Block | Cannot create child under file |
| S21 merged side edit discarded by merge tree | Fresh | All-parent history still shows touch |

All 21 expectations passed. The diagnostic historical algorithm visits all commits reachable from R but not S, compares every parent edge, disables rename inference, and intersects changed paths with selectors. It is intentionally more conservative: it flags reverted edits and discarded side changes, and can flag merge-parent differences that do not change the main endpoint. A first-parent-only history policy would yield different answers. Do not casually call either one “the diff since S.”

Historical-change blocking must not be silently excluded before the semantic policy is reconciled. If endpoint semantics is selected, the historical diagnostic need not ship in the minimum. If a security revocation or policy must forbid running an old snapshot, represent that in policy/log facts; endpoint `SPEC_STALE` is not such a revocation mechanism. Never mutate S in an existing approved contract to make a stale run pass: make N+1, reconcile and reapprove.

## 6. Finding Carry-forward

**B:** blockers have stable IDs, must be carried or explicitly resolved, and the assigned reviewer remains relevant. **C:** exact carry-forward/resolution encoding and reviewer replacement/assignment rules are unresolved. A version bump never erases an obligation.

Keep a small ledger derived from review and resolution facts. Store enough immutable provenance to identify the originating review, target revision/content and assigned reviewer. Summary, location and current reviewer name must not substitute for stable finding identity. This is a semantic requirement, not a proposal for JSON field names or ID spelling.

Transitions to implement after reconciliation:

1. A blocking review on N creates an unresolved obligation. Repeating its stable identity retains origin and assignment provenance. Duplicate identities, silent downgrades and reuse for unrelated issues must not erase obligations.
2. N+1 explicitly supersedes the correct predecessor but creates no resolution automatically. Compute unresolved blockers across task history. Whether the new contract also contains an explicit carry-forward inventory is **UNRESOLVED**; if it does, validate it against the ledger rather than trusting the author to omit entries.
3. Resolution requires explicit evidence about the current review target and a valid link to the old finding. Unknown finding IDs, wrong origin, empty evidence and stale-target resolutions must fail.
4. A changed reviewer does not silently gain authority to clear the original reviewer's blockers. The conservative scratch model requires the assigned reviewer to resolve. A formal reassignment/escalation mechanism is **UNRESOLVED**; until supplied, fail closed rather than infer a waiver. The owner has ruled out SPEC_STALE waivers in any event.
5. Contract-review blockers prevent contract approval/start. Code-change blockers must permit rework, but prevent final approval/acceptance until resolved against the proper result. Routing code findings into contract-change obligations needs the original review model; do not deadlock rework by treating every code blocker as a start blocker.
6. New blockers remain blocking even if old ones are resolved. Later reintroduction requires explicit new review evidence; no old resolution/approval can be reused for new content.

| Required history | Result |
|---|---|
| Blocking F created on N; N+1 introduced | F remains unresolved |
| Same F explicitly resolved with evidence and proper reviewer authority | Approval can proceed if no other blockers |
| F ignored or omitted | Still blocks |
| Summary renamed, same stable ID | Same obligation |
| New ID replaces old name | Original obligation remains |
| Reviewer changed | Assignment remains relevant; no automatic resolution |
| Anchor moved | Same finding; anchor movement is not a resolution |
| Old F resolved, new blocker added | Still blocked |

The revised scratch ledger passed 26 histories, including rollback, wrong predecessor, self-cycle, duplicate revision, repeated bumps, stale approval, wrong-origin resolution and ID reuse. A replacement reviewer now fails rather than being allowed to resolve silently. Its integer revision sequence, finding object shape and review event format are illustrative laboratory choices, **not V2 wire proposals**. Cross-gate routing and code-result binding remain required integration tests. The model's internal boolean is an implementation convenience, not an authoritative contract status.

Cycle prevention needs only explicit lineage validation against known task revisions, not a general issue tracker. The prototype uses consecutive integers plus an exact predecessor hash; the final representation and exact ordering rules must come from the authoritative schema.

## 7. Framing & Hashing

**B:** an explicit end marker and exact-content/hash-bound reviews are required; no silent normalization. **C:** end-marker bytes, placement, canonicalization and hash details are UNRESOLVED. This report deliberately supplies no proposed marker syntax or V2 hash prefix.

The original design must settle: opener/frontmatter format; whether the body is opaque Markdown; how marker text is escaped or recognized inside Markdown; marker cardinality; exact EOF/newline rules; UTF-8/BOM/CRLF treatment; valid Unicode and normalization policy; metadata canonicalization; hash algorithm/domain separation; size/depth limits; and the byte-to-string API boundary. Format-1 behavior cannot be silently reused as the answer.

A conservative **laboratory framing grammar** was used solely to demonstrate properties: fatal UTF-8, visible rejected BOM, rejected CR/NUL, canonical JSON frontmatter, one reserved complete marker line at EOF, and a test-specific hash domain covering all input bytes. It is labeled non-normative in the delivered script. Its marker spelling, JSON keys, revision/dependency structure and hash vectors have no authority for V2.

Executed 33 framing/schema experiments:

| Input class | Laboratory result | What this establishes |
|---|---|---|
| Truncated before/within marker; missing final LF | Reject | A strict complete frame can detect incomplete handoff |
| Duplicate marker, trailing bytes/blank line | Reject | Ambiguous/extended framing can be made fail-closed |
| CRLF or BOM | Reject | No silent byte normalization is necessary |
| Malformed JSON, duplicate keys, noncanonical spacing | Reject | Current strict-parser philosophy is implementable separately |
| Inline marker in Markdown | Accept as text | Recognition must depend on a defined grammar |
| Exact reserved line inside a fenced example plus terminal marker | Reject | A line-based grammar has an explicit documentation tradeoff |
| Invalid UTF-8/NUL | Reject | Lossy decoding is avoidable |
| Valid Unicode | Accept | Unicode prose need not be banned |
| NFC versus NFD | Different hashes | Exact-byte binding can preserve distinct forms |
| Shorter body with a newly written marker | Parses, different hash | Marker alone does not prove semantic completeness |
| Status/runBase smuggling | Reject | Confirmed exclusion can be enforced strictly |
| Other unknown fields or alternate schema shapes | Reject in fixture schema | Actual V2 allowlist remains unresolved |

No silent normalization is recommended. If the authoritative design requires canonicalization for hashing, its exact transform must be specified and independently tested; it cannot quietly repair invalid bytes during parsing. A string API also needs an explicit policy for lone surrogates; a byte API needs fatal decoding and byte-view ownership rules.

**Essential limit:** a malicious editor can shorten the body and write a new end marker. Framing may succeed; content binding must then reject reuse of the old approval. An end marker is not a substitute for hash validation or independent review.

Production must additionally bound document size/depth, catch parse/canonicalization exceptions, freeze results and return deterministic staged errors. Exact resource limits belong in the implementation contract, not inferred from this scratch fixture.

## 8. Backward Compatibility

Use **two parsers and explicit dispatch**, not one permissive merged schema. Keep `parseContractDocument` and `ContractMetadataSchema` as Format-1 APIs with their current hash/error behavior. Add `parseFormat2Contract` and, if useful, a new `parseAnyContractDocument` facade with a discriminated result. Existing kernel method remains V1; add a distinctly named V2 method. New V2 events must call the V2 parser directly and never fall back to V1 after a V2 failure.

One dispatcher can safely support both formats if it performs exact framing/format detection and returns a discriminated union; the individual validators should remain separate. In particular, the existing test that a Format-1-shaped document with `forgeContractFormat:2` fails must continue to pass.

Preserve V1 wire records, `contractVersion`, canonical path, hash prefix, approvals and replay results. New V2 records use the eventually reconciled revision representation and an explicit path resolver. Do not silently map historical V1 baseCommit to S or contractCommit to R. Reject implicit mixing of V1/V2 histories; an explicit task migration must be commissioned and modeled. In particular TASK-0005 is not migrated now; its new Format-2 version is only prepared when its implementation is explicitly requested.

TASK-0004 stays byte-for-byte frozen and remains a historical document that the machine parser rejects. Its blob on examined main is `334fe6fea10967fc06d23034d8743d92f389e67c`; SHA-256 of its raw file bytes is `c80677d8db3a6dd21872ab3f6203b4c695c98855b558f0e53d80103d45c8e9bd`. Do not “fix” YAML, status fields, approvals or historical body assertions.

Dogfood constraint: the existing test enumerates direct children under `src/forge` and `tests/forge` and requires historical Forge contracts to cover them. Place new modules under sibling `src/forge-contracts/` and tests under `tests/forge-contracts/`, as V-01 already uses sibling `forge-verifier` directories. Existing core files may be modified under a new authorized support contract; no historical scope lists need editing. Keep new V2 artifact inventory separate from the hard-coded historical filename expectations. The exact naming convention is unresolved; the new suite must validate all supported V2 artifacts and scope coverage explicitly. Any future change to the generic inventory logic must preserve every historical fixture/assertion rather than rewriting old contracts to fit new files.

## 9. Start Gate Changes

```text
Format 1:
  registered C -> exact-hash approval -> witnessed reachability -> start C

Format 2:
  task -> candidate(S,C,revision,hash) -> independent contract review
       -> registration observation(M) -> run request chooses R
       -> validate canonical graph + content binding + dependencies + S→R
       -> record runBase R -> start R
```

**B:** registration occurs at M and execution starts at R. **Proposed API semantics, not wire events:** the lifecycle needs to distinguish candidate content, exact-content review, witnessed registration and run start. The original design may encode these as separate events or another explicit sequence; names and payloads are unresolved.

| Semantic operation | Required information and effect |
|---|---|
| Propose/reconcile revision | Task identity, revision/predecessor, exact content and C; no claim of main registration |
| Record contract review | Exact target content, reviewer identity/assignment, findings and explicit resolution evidence |
| Observe registration | Actual M, complete ordered parent/tree facts, unchanged approved content and canonical-main provenance |
| Start run | Explicit R, current approved registered revision, actual S→R observations; record R as run fact |
| Record code review | Proper run/result/content target, reviewer, findings/resolutions and existing mutation acknowledgement semantics |

Role authority, when a proposed revision becomes current, and treatment of an active run during a new proposal require reconciliation. Conservative recommendation: do not allow a new V2 candidate to silently supersede an active run; finish/abandon explicitly. Existing V1 behavior stays unchanged.

Store observed C/M/R facts in V2 records using the finalized schemas. Existing downstream `startedFromCommit` can equal R without changing verification scope/check semantics. Derive readiness only when exact-content approval and valid registration facts exist. A parsed or approved draft is not automatically registered.

Gate failures must distinguish invalid evidence, SPEC_STALE, create collisions, invalid registration/content, ineligible R, unresolved blockers and prerequisite drift. Stable diagnostic names beyond the confirmed SPEC_STALE are proposed API details, not final wire enums. Recompute the decision during run event application/replay; do not trust a caller's success flag. There is no stale-spec waiver branch.

The 16-case scratch composition model demonstrates Format1→C and Format2→R, plus stale scope/reads, create collision, wrong approval hash, superseded revision, active run, open contract blocker, dependency failures, wrong contract hash and invalid registration/run-base graphs. It composes independently tested outcomes, not a production raw-observation validator.

### Exact existing tests and required companion tests

| Existing test | Keep/change | Required addition |
|---|---|---|
| `tests/forge/start-gate.test.ts:22` “starts from the contract commit” | Keep V1 assertion | V2 starts at later R; C and M differ |
| `start-gate.test.ts:30` “allows base == contract commit” | Keep V1 | V2 rejects C=S under selected profile |
| `start-gate.test.ts:71,79` missing-edge tests | Keep | Incomplete ordered parent/tree evidence fails; no omitted-parent bypass |
| `start-gate.test.ts:94` task ID not derived from refs | Keep | Canonical-main provenance is checked separately from identity |
| `start-gate.test.ts:128` new approved version can start | Keep V1 | V2 needs lineage, blockers resolved and observed M |
| `start-gate.test.ts:164` dependency ancestry | Keep | Pins accepted, in S and R; no main-tip substitution |
| `start-gate.test.ts:234` monotone partial witness tests | Keep V1 only | V2 complete-witness validation, especially parent cardinality; do not extrapolate monotonicity |
| `tests/forge/runs.test.ts:32` starts from C | Keep V1 | runBase stored; result descendant of R; diff basis R |
| `runs.test.ts:39` gate recomputed | Keep | V2 forged allowed flag/wrong R rejected on replay |
| `runs.test.ts:120` result ancestry | Keep | Result descended from C but not R fails |
| `tests/forge/state.test.ts:126` new version inherits no decision | Keep V1 | V2 inherits unresolved obligations but not approval |
| `state.test.ts:143` changes_requested final for hash | Keep | New hash requires fresh review; resolution not author-controlled |
| `tests/forge/review-acceptance.test.ts:49` contract_change path | Keep V1 | Code/contract blockers routed without deadlocking rework |
| `review-acceptance.test.ts:93,156,171` superseded review, terminal task, dependency pin | Keep | Mixed-format rejection, revision rollback, V2 acceptance blocks old findings |
| `tests/forge/contract-document.test.ts` truncated body parses / Format2 field rejects | Keep V1 | V2 terminal-frame rejection and new hash vectors |
| `tests/forge/dogfood.test.ts:50` TASK-0004 invalid | Keep exactly | Frozen-byte checks plus independent V2 artifact/scope inventory |
| `tests/forge/kernel.test.ts` HISTORY/replay equivalence | Keep V1 | Mixed-task V1/V2 replay; accepted/rejected event parity and no state mutation |
| `tests/forge-red-team/model.ts`, `differential.test.ts` | Retain V1 oracle | Separate independent V2 model/fuzzer, no importing production decision helpers |
| `tests/forge/typecheck.ts` | Preserve assertions | New V2 readonly/discriminated API type tests in sibling suite |

No current semantic test needs rewriting merely to add V2. Type annotations in callers may need explicit narrowing if shared internal record unions widen; that is an implementation detail, not permission to change historical expected outcomes.

## 10. Three-or-fewer Implementation Tasks

**C:** the original design proposes two tasks, but their exact contents are not available. The following is an independent, provisional three-task cut within the requested maximum, not a claim to reproduce Claude's split. Merge tasks later if the full design supports it without hiding scope. These are scope proposals, not newly created tasks, branches, contracts or approvals. New Forge-managed tasks require Format 2 under the confirmed handoff: do not substitute Format 1 to conceal the bootstrap gap. The support implementation needs an explicitly reviewed and authorized bootstrap process, with an honest record that the current kernel cannot yet execute it as a Format-2-managed run. Its exact registration/review treatment must be reconciled with the original design, without retroactive fake events. Each later task should be specified against the actual reviewed predecessor, not all against today's SHA. No task should implement guessed wire semantics; schema reconciliation is an entry condition. The suggested APIs name semantic operations; their concrete input/output types remain subject to that reconciliation.

### CS2-01 — Strict Format-2 document reader

**Production files:** create `src/forge-contracts/document-v2.ts`. Reuse exports from `src/forge/primitives.ts` and `src/forge/freeze.ts`; no existing production file changes required. Test files: create `tests/forge-contracts/document-v2.test.ts`, `document-v2.fixture.ts`, `document-v2.typecheck.ts`.

**API:** `parseFormat2Contract(bytes: Uint8Array, ports: ContractParsingPorts): Format2DocumentResult`; exported readonly V2 metadata/ref/result/issue types and a V2 revision-aware path resolver (exact revision/path encoding unresolved). Byte view offsets respected. Byte boundary, schema/framing and hashing must follow the reconciled design; the tested strict UTF-8 policy is an option, not a guessed wire requirement. Cryptographic functions remain injected; the port definition must follow the authoritative hash/canonicalization decision rather than assume V1's algorithm/domain. Either reject shared buffers or copy an ordinary immutable input snapshot before processing; define this explicitly in tests.

**Dependencies:** existing Zod, compatible primitives, deepFreeze and an injected content-binding port; no new package expected, no Git, no clock/network/fs. **Estimate:** 240–340 production lines, 500–800 test/fixture/type lines, assuming the unresolved wire design stays comparably small.

**Acceptance:** reconciled framing/schema cases; explicitly agreed inclusive size cap and oversized/deep-input failure; exact authoritative hash vectors independently calculated; readonly/frozen results; untouched inputs; V1 suite and frozen hashes unchanged. Valid output remains a parsed draft, not a registered/approved contract.

**Adversarial focus:** F01–F33, status/unknown metadata, duplicate keys, truncated frame, Unicode/BOM/CRLF, buffer subviews, pathological depth and hashes. No mutation of V-01 or TASK-0004.

### CS2-02 — V2 revision and finding lifecycle

**Production files:** create `src/forge-contracts/lifecycle-v2.ts`; modify only `src/forge/events.ts`, `src/forge/state.ts`, `src/forge/kernel.ts`. Keep `src/forge/contract-document.ts`, `primitives.ts`, `runs.ts`, identity policy and V1 event shapes unchanged. Test files: create `tests/forge-contracts/lifecycle-v2.test.ts`, `lifecycle-v2.fixture.ts`, `lifecycle-v2.typecheck.ts`, `model-v2.ts`, `replay-v2.test.ts`.

**API:** V2 proposal/review integration after exact event schemas are supplied; `pendingBlockingFindings(state,taskId,gate)` derived projection; lineage/path helper; explicit `kernel.parseFormat2Contract` in addition to existing V1 method. New V2 task/revision records are discriminated and can be pending without a registration. Add code-review V2 payload validation/resolution handling without changing legacy review semantics. V2 start remains deterministically blocked until CS2-03 registration support exists.

**Dependencies:** CS2-01; current identity policy/verification common fields. **Estimate:** 350–500 production lines changed/added, 650–1,000 test lines. Includes both architecture and code finding routing, not just a parser for ID strings.

**Acceptance:** valid next revision and exact supersedes binding under the reconciled representation; no cycles/duplicates/rollback/implicit mixed formats; no version-bump disappearance; no reused approvals; strict role/hash/run binding; assigned-reviewer-aware explicit resolutions; code-change rework remains possible; accepted tasks terminal; reject proposal during active V2 run; replay equals stepwise; rejected events are atomic and input-state preserving. Preserve V1 history byte-for-byte and projection-for-projection.

**Adversarial focus:** K01–K26 translated to authoritative wire semantics, plus cross-gate carry-forward, prior-run blockers, changed reviewer/assignment, wrong result commit, duplicate origins, forged resolution actor, stale approval and mutation acknowledgement interactions. Tests must use an independent V2 oracle, not mirror production helper calls.

### CS2-03 — Registration proof, SPEC_STALE and R-based start

**Production files:** create `src/forge-contracts/git-observation.ts` (Node-only collector), `src/forge-contracts/registration.ts`, `src/forge-contracts/spec-stale.ts`; modify only `src/forge/events.ts`, `src/forge/state.ts`, `src/forge/start-gate.ts`, `src/forge/kernel.ts`. First-parent/complete-parent checks live in the new helper; existing general ancestry module need not change. Existing verification/runs modules can consume `startedFromCommit=R` and a deliberate projection of V2 scope/check/mutation semantics to their existing evaluator inputs. Implement that projection in the new lifecycle helper if the authoritative V2 wire differs; it must not reinterpret a V2 document as a V1 contract.

**Test files:** create `tests/forge-contracts/git-observation.test.ts`, `git-graph.fixture.ts`, `registration.test.ts`, `spec-stale.test.ts`, `start-gate-v2.test.ts`, `dogfood-v2.test.ts`; extend new `lifecycle-v2.test.ts`, `replay-v2.test.ts`, `lifecycle-v2.typecheck.ts`. No rewriting historic dogfood scenarios. Add new support-contract artifact coverage in the V2 dogfood suite.

**API:** `collectContractObservation({repositoryPath, canonicalRepository, mainRef, S,C,M,R}): Result<ContractObservationV2>`; pure `validateRegistrationV2(document, observation)`, `evaluateSpecStaleness(metadata, observation)`, and `canStartDeveloperRunV2(state, request)`. These return structured deterministic failures. The collector obtains actual refs/objects; the kernel derives decisions from the witnessed facts, not a caller's success boolean.

**Dependencies:** CS2-01 and CS2-02; installed Git and existing hash/ancestry primitives. No dependency on V-01, avoiding a bootstrap cycle. Collector parses only commit/entry observations needed for registration and freshness; it does not implement V-01's rename-aware verification decoder.

**Estimate:** 500–750 production lines changed/added, 850–1,300 test lines. Includes bounded processes/output, fixed args/no shell, explicit object existence, no replace/graft/shallow ambiguity, literal paths, canonical ref observation, resource failure handling, complete parent/tree evidence and required portability checks. Do not promise this whole task below 400 lines.

**Acceptance:** G01–G28, S01–S21 and T1–T16 equivalents against actual objects, with expected outcomes explicitly reconciled for currently unresolved policy choices, plus missing-object/observation attacks; parser-hash-C-M-R agreement; C/M delta purity; dependency pins; R-based replay/run/result ancestry; witness acquisition failures block; no unsupported merge styles silently accepted. End-to-end V2 candidate→review→registration→run→verification→review→acceptance succeeds in a disposable fixture, with a revision/rework branch proving carry-forward. All existing V1 tests retain expected results. Full suite must pass on the release candidate; timeout failures must be reported rather than masked by silently changing limits.

**Adversarial focus:** omitted parents, foreign injection, changed contract blob, fake main/ref, R before registration, S/R stale files/subtrees, omitted tree entries, process truncation, replacement refs and dependency drift. No GitHub workflow/settings/auth implementation.

## 11. V-01 Unblock Checklist

Only the following are necessary to move V-01 from its technical draft to an approved registrable contract:

1. Obtain the authoritative wire details or an explicit owner-reviewed reconciliation of them: schema, revision/supersedes, dependencies, reads selectors, framing/hash, path resolution and reviewer assignment/resolution. Preserve confirmed no-waiver SPEC_STALE and merge-registration semantics. Replace every UNRESOLVED item in the V-01 draft. Do not substitute this lab encoding.
2. Land and validate CS2-01 through CS2-03 on main, with legacy compatibility intact. A parser alone is insufficient.
3. Choose the actual post-support main commit S; reread/reconcile V-01's declared inputs there. Include newly introduced contract-system files in reads if V-01's final specification relies on them. Keep V-01's four create paths and zero modify paths unless separately respecified.
4. Declare real dependencies using the reconciled V2 rules; if an empty formal list is permitted, justify it explicitly. Preserve required typecheck/test/diff checks and required mutation smoke; no fabricated acceptance/approval records.
5. Produce a fully framed first V-01 revision at its resolved V2 path and a single non-merge contract-only C satisfying the finalized relationship to S. Compute hash from actual blob bytes. There must be no placeholders.
6. Record independent review of that exact task/revision/hash/C, with no unresolved contract blockers. All known blocking findings from the technical draft review must be seeded with real provenance into the V2 review ledger before approval; the absence of machine IDs in an old draft is not a license to discard them. No claimed approval is supplied by this preflight.
7. Prove the candidate can satisfy registration checks against the target main tip; commit to rejecting a changed blob or mixed-code merge. It is now approved and **registrable**. Actual registered use still requires observing real M and a valid R, then passing S→R checks at run start.

V-01's decoder implementation, Actions, a PWA, backend, database, general issue tracker, historical TASK-0004 repair, automatic branch protection and a complete independent GitHub verifier are not prerequisites for approving this contract. The narrow trusted collector and controlled log ingestion are prerequisites for claiming a machine-checked start.

## 12. 50+ Attacks

The following 80 attacks/edge controls form a reconciliation and acceptance checklist. Some expected outcomes depend on explicitly marked laboratory choices (notably exact framing, revision numbering, path/reference schema and strengthened Git profile); translate those to the authoritative design before treating them as conformance tests. “Executed” references the scratch evidence IDs; “Required” denotes a production acceptance case not claimed as implemented or executed here. Passing the scratch matrix does not certify production code that does not yet exist.

| # | Attack or edge control | Required outcome | Evidence |
|---:|---|---|---|
| 1 | Truncate before end marker | Reject frame | F02 |
| 2 | Truncate inside marker | Reject frame | F03 |
| 3 | Remove final LF | Reject frame | F04 |
| 4 | Duplicate terminal marker | Reject | F05 |
| 5 | Bytes after marker | Reject | F06 |
| 6 | Blank line after marker | Reject | F07 |
| 7 | CRLF instead of LF | Reject, no conversion | F08 |
| 8 | UTF-8 BOM | Reject | F09 |
| 9 | Malformed JSON | Reject | F10 |
| 10 | Inline marker text in prose | Accept, hash it | F11 |
| 11 | Exact marker line inside code fence plus terminal marker | Reject duplicate | F12 |
| 12 | Invalid UTF-8 byte | Reject, no replacement | F13 |
| 13 | NUL in document | Reject | F14 |
| 14 | `status:approved` smuggling | Reject unknown metadata | F15 |
| 15 | Unknown metadata | Reject unknown keys once authoritative allowlist exists; fixture title was merely an example | F16 |
| 16 | runBase in contract content | Reject (confirmed) | F17 |
| 17 | C in contract metadata | Reject | F18 |
| 18 | Duplicate JSON key | Reject canonical check | F19 |
| 19 | Noncanonical JSON spacing | Reject | F20 |
| 20 | V1 fixture passed as V2 | Never silently interpret as V2 | F21 |
| 21 | Unsupported format number | Reject, no fallback | F22 |
| 22 | No required checks | Reject | F23 |
| 23 | Parent traversal in read path | Reject | F24 |
| 24 | Scope ancestor/descendant overlap | Reject | F25 |
| 25 | Unresolved dependency in candidate | Must not approve unresolved prerequisites; parse policy unresolved | F26 fixture rejects |
| 26 | Impossible first-revision predecessor | Reject invalid lineage under final representation | F27 fixture |
| 27 | Revision sequence skips predecessor | Explicit lineage required; numeric consecutiveness unresolved | F29 fixture |
| 28 | Normalize NFC/NFD before hashing | Forbidden; distinct hashes | F30/F31 |
| 29 | Shorten body and restore marker, reuse approval | Parse may pass; old hash cannot approve | F32, T3 |
| 30 | Change key order and reuse old hash | Different hash | F33 |
| 31 | Extra implementation code in C | Reject | G06 |
| 32 | Code hidden before C on branch | Reject | G07 |
| 33 | Hidden code changed then reverted before C | Reject profile | G08 |
| 34 | C is a merge | Reject profile | G09 |
| 35 | Foreign second parent in C | Reject | G10 |
| 36 | Foreign third parent in M | Reject | G11 |
| 37 | Reverse M parents | Reject | G12 |
| 38 | Contract blob modified C→M | Reject | G13 |
| 39 | M copies contract but does not contain C | Reject | G14 |
| 40 | Unrelated C merged into main | Reject | G15 |
| 41 | Foreign first parent of M | Reject | G16 |
| 42 | runBase before registration | Reject | G17, T15 |
| 43 | runBase on unmerged branch | Reject | G18 |
| 44 | runBase only reachable through main second parent | Reject | G19, T16 |
| 45 | Contract modified between M and R | Reject | G20 |
| 46 | Merge resolution injects implementation | Reject | G21 |
| 47 | Fast-forward called registration merge | Reject profile | G22 |
| 48 | Squash called registration merge | Reject profile | G23 |
| 49 | Wrong specifiedAgainst | Reject | G24 |
| 50 | Wrong C | Reject | G25 |
| 51 | Wrong M | Reject | G26 |
| 52 | False main snapshot excludes M | Reject | G28 |
| 53 | Stale read contents | SPEC_STALE | S03, T11 |
| 54 | Stale scope.modify omitted from reads | SPEC_STALE | S04, T12 |
| 55 | Deleted read | SPEC_STALE | S05 |
| 56 | Renamed read | SPEC_STALE at old path | S06 |
| 57 | New member under watched directory | SPEC_STALE | S07 |
| 58 | Create target appears before run | Block | S09, T13 |
| 59 | Package lock changes | SPEC_STALE when declared | S11 |
| 60 | Package lock omitted from reads | Shows declaration gap; independent review must reject V-01 list | S12 |
| 61 | Relevant main merge | SPEC_STALE | S13 |
| 62 | Mode-only change | SPEC_STALE | S15 |
| 63 | Symlink replaces read | SPEC_STALE/type failure | S16 |
| 64 | Read absent at S | Invalid spec input | S17 |
| 65 | Existing create file, directory or blocked ancestor | Block | S18–S20 |
| 66 | Bump version, omit old blocker | Block | K02/K22 |
| 67 | Rename finding summary/ID or move anchor | Original blocker remains | K05/K06/K09 |
| 68 | Change reviewer to erase blocker | Block; assigned-reviewer relevance retained; succession rules unresolved | K07/K08 revised |
| 69 | Resolve old blocker, add new blocker | Still block | K10 |
| 70 | Reuse old approval/review on wrong hash | Reject | K12, T3 |
| 71 | Resolve unknown ID or wrong origin | Reject | K13/K14 |
| 72 | Author self-resolves / empty rationale / severity downgrade | Reject | K15–K17 |
| 73 | Duplicate revision / rollback / wrong supersedes / self-cycle | Reject | K18–K21 |
| 74 | Duplicate resolution / review twice / reuse closed ID | Reject | K24–K26 |
| 75 | Dependency acceptance or ancestry drift | Block; cannot substitute newer result | T7/T8; raw event integration Required |
| 76 | Omit foreign parent from witness; partial graph pretends complete | Reject incomplete/mismatched object evidence | Required; graph counterexamples G10/G11 |
| 77 | Git replace refs, grafts, shallow boundary, missing object or truncated process output | Collector fails closed | Required |
| 78 | Casefold alias/create collision, reserved path, symlink ancestor | Reject portable footprint/create precondition | Required; exact prefix S20 executed |
| 79 | Code review bound to wrong run/result/hash; old code blocker survives revision | Reject/retain blocker, allow valid rework | Required; existing V1 result binding inspected |
| 80 | Oversized/deep document, buffer subview/shared buffer, forged structural state/identity | Bounded parser; supported byte ownership; reject untrusted ingestion rather than pretend kernel authenticates it | Required |

Positive controls matter: under the tested endpoint/framing profile, unchanged/reverted inputs, unrelated edits, R=M, later main merge, inline marker prose and Unicode have legitimate passing cases. An assigned reviewer resolving a blocker also passes. See G01–G05/G27, S01/S02/S08/S10/S14/S21, F01/F11/F28/F30/F31 and K03/K11/K23. A replacement reviewer no longer passes automatically.

## 13. Revised LOC Estimates

**C — provisional until original schema/split reconciliation.** Estimates count readable production lines added/changed including API/schema/diagnostic code, and test/fixture/type lines separately. They are planning ranges, not measured implementation output. Scratch code compression is not a production estimate.

| Task | Production LOC | Test LOC |
|---|---:|---:|
| CS2-01 parser/frame/hash/path | 240–340 | 500–800 |
| CS2-02 revision/review/finding lifecycle | 350–500 | 650–1,000 |
| CS2-03 collector/registration/staleness/start integration | 500–750 | 850–1,300 |
| **Total usable minimum** | **1,090–1,590** | **2,000–3,100** |

Existing code reuse avoids rebuilding the run verifier, identity policy, scope evaluator, task acceptance, general log replay or mutation system. Integration edits may touch the same core file in tasks 2 and 3; totals are work estimates rather than deduplicated final-file line counts. New process-contract prose is not counted as production LOC.

A sub-400 first task is honest. A sub-400 complete usable V2 implementation is not supported by this inventory. Cutting the collector, lineage or carry-forward to reach that number would leave the requested guarantees unenforced. V-01's own 450–550 production / 1,000–1,500 test-line draft estimate is separate and not included above.

## 14. Remaining Owner Decisions

**B — already decided; do not reopen:** SPEC_STALE means revision/reconciliation with no waiver; TASK-0004 is frozen; merge commits remain the main integration strategy; hard LOC limits may be contract-specific rather than universal; assigned reviewers remain relevant to their blockers. TASK-0005 is only explicitly migrated when implementation is actually commissioned.

**C — unresolved from the missing original document:**

| Needed information | Why it matters |
|---|---|
| Exact Format-2 schema and field allowlist | Cannot write a real parser or valid V-01 header without it |
| Revision/supersedes and artifact identity encoding | Determines duplicate/rollback/cycle checks and immutable revision lookup |
| Reads/dependency representation | Determines selectors, absence semantics and formal prerequisite binding |
| End-marker grammar and hash/canonicalization rules | Determines byte acceptance, exact hashes and review binding |
| Finding carry-forward/resolution format and reviewer reassignment rules | Must preserve assignment relevance without inventing a waiver or replacement authority |
| Endpoint versus historical-change staleness | Changed-and-reverted inputs have different outcomes; both were measured |
| Precise S/C/M/R ancestry/purity profile | C non-merge and M registration are settled; direct parent S and first-parent eligibility are stronger test assumptions |
| Candidate/review/registration event sequencing and active-run behavior | Needed for replay without conflating approval with registration |
| Original two-task decomposition and OD-A–OD-L text | Cannot honestly reproduce unnamed decisions or assert all are owner-finalized |
| Bootstrap process for the support implementation | New managed tasks require Format 2, but today's kernel cannot run one; explicit reviewed bootstrap must not masquerade as V1 substitution or retroactive V2 execution |

Recommendations in this preflight are limited to implementation semantics/APIs and explicit experimental comparisons. They do not decide the missing wire format. Endpoint staleness and the conservative graph profile are useful candidates to compare with Claude's document, not silently adopted policy.

## 15. Recommended First Implementation

**CS2-01, the additive Format-2 document reader, after its authoritative wire details are supplied and reconciled.** That is the first implementation slice; implementing the laboratory encoding now would be premature. Require exact agreed framing/hash behavior, explicit lineage semantics and an unchanged V1 regression suite. Keep the task below 400 production lines if readable; the owner allows task-specific limits, so do not compress safety code to meet a universal number.

Then CS2-02 and CS2-03 provide the smallest honest path from parsed draft to approved registration and R-based run. Reconcile V-01 after those changes land, because its present reads list deliberately watches several files they will modify.

Do not start with the V-01 decoder to bootstrap the contract system, do not rename V1 fields in place, and do not retroactively register the B-v2 sidecar or “repair” TASK-0004 as part of this work.

## 16. GO / NO-GO

**GO for this implementation decomposition and its test-backed semantic constraints. NO-GO for implementing guessed Format-2 wire semantics, and NO-GO today for registering or starting V-01 as a Format-2 Forge contract.** CS2-01 is the recommended first implementation only after the missing schema/framing/hash details are reconciled. There is currently no production Format-2 parser, registration proof, SPEC_STALE rule or finding carry-forward enforcement.

Executed evidence: **28 real Git graph cases + 21 staleness cases + 33 illustrative framing/schema cases + 26 finding histories (rerun with assigned-reviewer binding after the handoff) + 16 conceptual gate cases = 124 passed scratch assertions**. These are model/graph experiments, not a production implementation or a review approval. Baseline typecheck passed; initial full suite had two timeouts, both passed targeted rerun, and those distinct results are retained.

The requested preflight is complete. Canonical repository unchanged. No commits, branches, PRs, registration, approvals or settings changes were made there. STOP.
