# MYSTERY — Package Identity & Replay Binding Closure

**PACKAGE BINDING CLOSED**

**REPLAY BINDING CLOSED**

These are specification-level verdicts for the final scoped closure annex and accepted D1–D10. The original audit drafts remain unchanged; integrating the exact repairs is required before implementation. This lab does not assert production conformance, implement a new package system, certify human solvability or clear unrelated Vitrine release blockers. No remaining identity/package/replay specification blocker is left within this scope.

## Authority and source evidence

Repository: Forge-Dice/Forge. Main observed before work: `3d7545d843883418348004e68717399a64da7a7d`. All original materials come from fixed GitHub audit commits; 49 source entries are recorded in source-manifest.json. Original report/contract bytes were checked against Git blob IDs and SHA-256, including the original VS-5 CRLF encoding. Main's existing Truth/Solution identity and NPC schema were read as unchanged baseline files in the Session audit commit. No Chat summary was treated as normative authority.

The source set covers MYST-0001, original and repaired-final-candidate MYST-0002, MYST-0003/4/5A/5B, Challenge, Solvability, Session A/B/C and its acceptance matrix, VS-5 original results, Cross-Contract, Scale, InfoFlow, Vitrine specification/brief/certification/ProofProfile, Independent Freeze Verification, Final Spec Freeze and Final Owner Reconciliation. VS-5's branch contains results only, no additional VS-5 contract; accepted D9 already replaces it with A/B/C. No later package/replay repair branch was in the initial branch inventory. The annex therefore applies the accepted reconciliation, without claiming a concurrent repair was already integrated.

Accepted Owner D10 supplies binding policy: Presentation/PublicContent text changes invalidate old saves; false and undetermined claims remain permitted Challenge scope members. D9 assigns PublicContent and release-to-proof authoring to Session A, with proof execution in case acceptance. No decision is reopened.

## Component inventory and registry

hash-profile-registry.md is the final V1 table; hash-profile-registry.json is the exact field/path specification, including owner, schema/version, profile, canonical input, object/array rules, binding inputs, digest, consumer and save relevance. It contains 18 hash/derivation entries and an explicit embedded ruleset record. Components include Truth, Solution, Access, EvidencePresentation, catalogue, per-NPC profile/snapshot, NPC bundle, initial awareness, Challenge, PublicContent, PlayerRef config/derivation/mapping, release context, manifest/adapter data, ProofProfile, package hash and Save checksum.

Existing Truth/Solution/Access/Presentation/catalogue/profile profiles retain their existing all-array-SET canonicalization. Session structural C preserves arrays by default and sorts only the typed SET paths in the registry. Object keys use UTF-16 code units, never localeCompare. No Unicode normalization or trimming. New numbers obey the original Session safe-integer/safety constraints; existing domain schemas are not silently rewritten. Sorting copies a collection and never silently deduplicates it.

The registry has no unversioned profile, missing semantically relevant component or cyclic dependency. Aggregates hash typed named fields with 64-lowercase-hex child hashes; never ambiguous raw concatenations. The manifest is the explicit exception: its already canonical text is hashed directly, without a second JSON-string encoding. Truth's own names/descriptions still bind Truth; PublicContent is the exclusive public display source. That is two distinct content responsibilities, not permission to display hidden Truth or substitute one hash for another.

## Minimal NPC snapshot identity

Owner: Session A §2. Keep the original name `forge-npc-snapshot-v1`. Hash the complete parsed immutable snapshot, after copying/sorting awareness and attitudes by C(entry). Both arrays are **SET**. Every other V1 root or provenance/stance field is scalar or strict object; no other array exists. Unknown array fields fail the real schema, rather than acquiring invented ordering.

Identity includes schemaVersion, npcId, revision, asOf, caseId, truthHash, solutionHash including explicit null, acquiredAt, awareness subjects, statement subjects, stance.kind/value/leaning and all provenance.kind/reference fields. A revision, provenance or timestamp change changes identity even if an individual NPC reply happens to be identical. Null and string solutionHash are distinct inputs; parser checks the supplied Solution relationship before identity is accepted. Existing knowledge/belief/uncertainty and duplicate subject/structural-statement rules remain the real parser's authority.

Golden-vectors.json supplies full canonical strings/preimages/digests for base, array permutations and scalar/metadata changes, with a null-solution control. These are hash-profile vectors; foreign and deliberately inconsistent controls are not claims that the package parser accepts those inputs. A separate Python implementation reproduces all vectors and the original MYST-0001 refs.

## PlayerRef binding

MYST-0001 fixes the algorithm completely: six LF-separated ASCII fields, UTF-8 SHA-256, first 10 bytes, big-endian 80 bits, lowercase Crockford alphabet, `pr1_` plus 16 characters. Salt is exactly 32 lowercase hex characters and nonzero. kind is the exact five-kind enum token. Full entity membership and global ref injectivity are checked before success; collisions fail the entire index, with private author diagnostics only. Resolution gives identity, never prefix-Known authorization.

refsHash includes both `{profile,saltHex}` and the complete verified mapping. A supported salt change therefore changes package ID even for an empty history or an unchanged mapping under an injected test digest. The real adapter construction is fixed in R01; a claimed salt with a mapping from another salt is rejected by recomputation, not trusted because the table round-trips through a matching fake resolver.

For accepted semantic inputs there are exactly two outcomes: **PACKAGE ID CHANGES** or **NO SEMANTIC CHANGE**. A V1 profile/encoding/truncation/kind/collision-policy variant is not an accepted third kind: it is schema failure. Future supported algorithms require a new versioned profile and package. No full-package hash enters Ref derivation, so there is no backwards edge/fixed point. Salt stays private and is not saved.

Ten additional negative controls cover wrong salt, profile, encoding, truncation, kind, membership, duplicates, collision, wrong inverse and forced digest collision. Original PlayerRef Golden V-01…V-05 are reproduced independently.

## Presentation and PublicContent identity

There is no new preset hash. Evidence text/report/mention identity is `forge-evidence-presentation-c14n-v1`. Public title/brief/labels/roles/NPC question wording/public rules/Challenge question identity is `forge-session-public-content-v1`, the exact additive component specified by accepted Master B.5. It feeds releaseContextHash and packageHash. One V1 package represents one authored language; no localization machinery is added.

| Change | Responsible input/hash | Package/old Save |
|---|---|---|
| Truth.name typo | existing Truth name → truthHash → refs/context | changes/incompatible |
| Public display-name typo | PublicContent.labels[].label → publicContentHash | changes/incompatible |
| Truth.description change | existing entire Truth hash | changes/incompatible |
| Player brief change | PublicContent.brief → publicContentHash | changes/incompatible |
| Semantic evidence observation wording or report | EvidencePresentation text/report → presentationHash | changes/incompatible |
| NPC authored public wording | PublicContent.questionTexts[].text → publicContentHash | changes/incompatible |
| Structured NPC stance template behavior change | exact ruleset behavior/version | incompatible; new ruleset/package |
| Explicit SET permutation or object-key permutation | typed canonicalization | unchanged |
| UI font/layout outside authored package and emitted content | outside replay semantics | unchanged |

Whitespace/NFC/NFD and “only cosmetic” wording changes are still identity-significant. This follows D10 and A §9; no personal judgment about clue importance is used. Known-filtered labels do not imply Truth-roster export. Narrative textual spoilers still require author review, outside hash correctness.

## Descriptor, DAG and exact resolution

Keep exactly the original minimal descriptor:

```ts
type CasePackageIdentity = Readonly<{
  schemaVersion: 1;
  packageHash: string; // 64 lowercase hex
  rulesetVersion: "mystery-session-v1";
}>;
```

schemaVersion defines descriptor parsing; packageHash binds all exact verified content transitively; rulesetVersion selects the exact supported interpreter before replay. The ruleset is also a hash input so changing it cannot preserve packageHash. This required routing field has a concrete purpose and is retained. caseId/component revisions/private hashes add no required lookup authority and are omitted from Save. Existing component revision fields remain included in their own content hashes, as their contracts require.

The DAG is in package-identity-dag.mmd. Topological order: Truth → Solution/Ref derivation/Access/Presentation/catalogue/initial/PublicContent → NPC snapshots/profiles and bundle/Challenge → releaseContextHash (also ruleset) → releaseManifestHash → ProofProfileHash → packageHash → descriptor → Save checksum with ordered events. Refconfig/mapping, adapter data and ruleset are explicit independent inputs. There is no reverse packageHash→PlayerRef edge, no proofHash in releaseManifest and no self-hash. Paired releaseHash/proofHash null is permitted only with proof:null, as in the original technical package allowance.

CasePackageIdentity is just a descriptor. Resolution retrieves actual immutable artifacts from the trusted provider, runs actual schema/semantic/binding validation, recomputes identities and compares the complete requested descriptor before returning owned verified content. No latest fallback, no revision-only or same-case replacement, no digest with missing contents, no partial package and no mixed snapshots/profile pairs. A different valid same-case package can resolve under its own new descriptor, but cannot satisfy the old descriptor. SET/object-key permutations represent the same canonical artifact; ordered/text changes cannot be substituted. Empty NPC collections remain valid technical packages when their other authored components agree.

## Replay ruleset and Save authority

The original minimal runtime token `mystery-session-v1` covers investigation acceptance/release, interrogation askability/response/translation, Challenge/Core verdict interpretation, PlayerKnowledge projection, terminal behavior, error priorities and bound proof-adapter interpretation. REPLAY-COMPATIBLE requires exact semantics: implementation refactor, immutable sharing, reuse of verified bindings, specified SET/key order variation and UI layout outside authored content. A semantic change in any listed subsystem is REPLAY-INCOMPATIBLE: new rulesetVersion/package required. Adapter semantics gets a new adapterVersion; any certificate-data change gets a new releaseHash and package. No automatic migration or newest-interpreter reuse under an old version.

Session C's four-field Save remains authoritative only for schema version, exact descriptor (including ruleset once), ordered accepted events and integrity checksum. The checksum binds canonical body without checksum, using `forge-session-save-v1`. Never persist authoritative derived verdict, PlayerKnowledge, VisibleRef, NPC engine, truth/solution caches, discoveries or released response objects. Decode enforces canonical wire and exact shapes; package/version comparison precedes checksum/replay. Encode replays and compares derived state. Failure exposes no partially replayed state. Public failed-load facade returns constant SAVE_UNAVAILABLE, while private diagnostics retain useful codes.

An unkeyed checksum detects corruption and order edits made without recomputation. It cannot authenticate a log. A newly checksummed accepted prefix is a valid earlier Save; newly checksummed alternative accepted events are also valid by original Session C. Reordering identical events does not change content; distinct ordered events change checksum/output order. After first solved, any further event makes replay fail atomically; never truncate the suffix. Failed events never enter accepted history.

## Replay work and history complexity

Package Resolve may verify all identities once and hand immutable owned verified binding to Replay. No full package validation/hash rebuild per event. A binding cannot be reused against mutated artifacts or another package/ruleset; unknown or changing providers trigger a fresh resolve. Event shape, membership, prefix-Known authorization, output validity, terminal rule and error priority remain per-event checks. Cached hash claims from Save/client/TypeScript brands are never trusted. Existing imported Domain APIs retain their own checks: this annex does not claim zero internal Truth/catalogue hashes or an implemented optimization of their internals.

Pure observable semantics does not mandate copying every growing history at every transition. Frozen subtrees/structural sharing or private replay working state are allowed, without specifying a concrete data structure. Published snapshots never mutate; errors publish no partial state. The lab's small reducer deliberately uses a copy baseline for correctness and compares it to a separately written batch oracle; it is not a production performance proposal.

Exact prospective transport size is B0 + sum UTF8Length(C(event_i)) + max(0,n−1), with B0 the canonical empty Save including a 64-ASCII checksum placeholder. This removes full-prefix serialization from each size check without approximation. No persistable derived byte/cache authority is added. The 1,200 generated histories check this equality against full serialization. Whole-package hash evaluation during replay is zero in this model, independently counted; no target-device timing claim follows.

## Evidence results and limits

The reproducible harness is lab.mjs; verify-vectors.py independently checks UTF-16 canonical keys, profile preimages/SHA-256 and Ref encoding. mutation-results.json records every mutation, expected/actual classification and pass; replay-property-results.json records seed, history lengths, ordered-log/state/save digests, property counts and controls. Generated case structure is an explicit finite authoring/binding cost model, **not** the full CaseTruth/Proof schema, nine-claim NPC engine or production Session APIs. The batch oracle independently calculates finite expected journals without using the reducer. Assertions fail the run on any mismatch; there are no claimed tests of unavailable production modules.

Final result: **163/163 mutations passed**, **1,200 generated histories**, **26,400 property checks**, **23 independent hash golden checks plus 5 PlayerRef golden checks**, zero failures. Counts are machine-recorded in the result files. The suite covers all authored components with content/revision-or-forbidden-revision/reordering/foreign-binding/missing/duplicate mutations, metadata/text/salt/profile changes, ten ref controls, same-log determinism, independent expected state, save/load, stable resave, package/salt/snapshot/presentation/PublicContent/ruleset mismatches, stale-checksum reorder/delete/insert, valid rechecksummed edits, terminal solved and failed-replay atomicity. No successful result equates allowedClaims membership with true status or Ref resolution with authorization.

| Bound class | Existing norm/evidence | Closure treatment |
|---|---|---|
| Schema safety | strict JSON/Unicode/number and component schemas; Session depth 32/node 100000 | retain authored safety checks before expensive work; no proxy sandbox claim |
| Package authoring | Session 2 MiB, 256 entities, 64 Evidence, 16 NPCs, 128 questions; component-specific bounds | existing design budgets; no universal case/production-performance assertion |
| Save transport | Session 1 MiB canonical UTF-8; 16 KiB event; 32 literals | retain exact transport checks; history limit does not imply all max-sized events fit |
| Event history | Session 512 accepted events | retain existing explicit Session budget; do not promote VS-5/Scale 1000-event scratch suggestion |
| New target-device CPU/memory/time budgets | no concrete measured target evidence | **OPEN BOUND**, no invented millisecond or memory limit |
| Unspecified extra array/string bounds in legacy schemas | no accepted additional number | **OPEN BOUND**; retain existing schemas plus authored package byte budget |

OPEN BOUND means no new numerical assertion, not a new specification blocker where the original scoped byte/history/component budget already bounds import/replay. Changing accepted limit behavior later needs an explicit compatibility revision.

## Exact repairs, verdict boundary and persistence

CONTRACT-REPAIRS.md provides Contract/Section/OLD/NEW/Reason/Evidence/Version impact for every remaining closure gap; no new Package task. R01–R05 belong to A, R06 to B with A/C compatibility, R07 to C, R08/R09 to A/B, R10 to existing A/B/C limit ownership. The registry, DAG and repair annex are the final scoped contract result, rather than claims that original main already contains these APIs.

Remaining in-scope package blockers: **none**.

Remaining in-scope replay blockers: **none**.

Out-of-scope gates are preserved: canonical implementation/registration acceptance and real-module conformance; complete typed Release→Proof execution and real Vitrine certification under that adapter (Master F02/F11). Binding the exact adapter/manifest is not proof that those data were executed or that a case is solvable. Those gates are not silently marked PASS by this closure.

All deliverables are restricted to forge-audits/MYSTERY-PACKAGE-REPLAY-BINDING-CLOSURE on the dedicated same-name audit branch based on current main. Authenticated GitHub writes only as forge-codex, with login checked before the first write and again immediately before branch publication. No main/production/test/settings change, PR, merge, rebase or force-push. Post-publication remote tree/blob/parent verification and unchanged main are required before the final chat result.
