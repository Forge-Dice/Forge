---json
{
  "forgeContractFormat": 1,
  "taskId": "FORGE-CORE-0002",
  "contractVersion": 1,
  "baseCommit": "3d7545d843883418348004e68717399a64da7a7d",
  "dependencies": [],
  "scope": {
    "create": [],
    "modify": [
      "src/forge/contract-document.ts",
      "src/forge/events.ts",
      "src/forge/primitives.ts",
      "src/forge/runs.ts",
      "src/forge/start-gate.ts",
      "src/forge/state.ts",
      "src/forge/verification.ts",
      "tests/forge-red-team/differential.test.ts",
      "tests/forge-red-team/findings.test.ts",
      "tests/forge-red-team/model.ts",
      "tests/forge/contract-document.test.ts",
      "tests/forge/dogfood.test.ts",
      "tests/forge/fixtures.ts",
      "tests/forge/repair-v2.test.ts",
      "tests/forge/review-acceptance.test.ts",
      "tests/forge/run-fixtures.ts",
      "tests/forge/runs.test.ts",
      "tests/forge/scenarios.test.ts",
      "tests/forge/start-gate.test.ts",
      "tests/forge/verification.test.ts"
    ]
  },
  "requiredChecks": [
    {
      "name": "typecheck",
      "command": "npm run typecheck"
    },
    {
      "name": "test",
      "command": "npm test"
    }
  ],
  "mutationSmoke": "required"
}
---
# FORGE-CORE-0002 v1: Contract Format 2 and bounded kernel hardening

## Goal

Implement Architecture Freeze task [3] as a small, pure extension of the existing Forge kernel. This document is a Format-1 bootstrap contract. The implementation it specifies produces support for Format 2; this document itself does not use Format-2 metadata. It is a proposal for independent architecture review and conveys no approval or permission to implement.

Repository: Forge-Dice/Forge. Reconciled source baseline: main at 3d7545d843883418348004e68717399a64da7a7d. Normative architecture: FORGE-V0.1-ARCHITECTURE-FREEZE.md, particularly W-03, W-11, W-12, W-13, W-14, W-16, W-17, W-30, W-31, sections 2.5, 3.2, 5.3-5.5, 5.10, 16.2 and 17.2. The user's clarification of the exact protected directory list and RTN source limitations is incorporated below.

Actual source is evidence of existing behavior, not evidence that the requested target already exists. This contract explicitly identifies the authorized differences. Where this contract completes a lexical or API detail that the Freeze leaves unspecified, that detail is a proposed implementation decision for architecture review; it is not attributed to an unavailable earlier report.

## Bootstrap Metadata and Prerequisites

The frontmatter above is the complete metadata for this contract. No title, reads, specifiedAgainst, runBase, mutants, limits, findings, supersedes, status, approval, hash or blob identifier is added to that Format-1 object. Its content hash is external and uses the existing forge-contract-v1 domain.

The empty dependency array is deliberate: CORE-0002 requires no new production export from VERIFIER-0001 and the Freeze makes their implementations independent. FORGE-OPS-0001 is an operational prerequisite, not a fabricated accepted dependency. Its future acceptance SHA is currently unknown and must not be represented by null, the baseline SHA, or a made-up hash. Before any implementation run, the Owner must complete the relevant OPS bootstrap prerequisites and independent architecture review. The existing baseline kernel is the code being modified; the contract does not invent a historical accepted-run event for it.

Under Freeze section 5.10, baseCommit is interpreted by the later gate as specifiedAgainst; reads is empty; policy defaults are 400 added production lines and 20 changed files. This contract's prose read inventory below does not secretly create a Format-2 reads field or claim automatic stale detection for those reads. A change to a relied-on source before registration/run requires reconciliation of this draft and, if its text changes, a new hash and review.

Use the canonical eventual path forge/contracts/FORGE-CORE-0002.md, never a version sidecar. The contract registration is separate from its implementation run. The implementation must not change its registered contract file, historical contracts, approvals or reviews.

## Non-Goals

No Git execution or live observation; no subprocess, filesystem or network access in src/forge; no GitHub API, policy loader, workflow, sandbox, artifact protocol, Review/Attestation block parser, evidence-v1 adapter, persisted event log, event envelopes, lease or reconciler. No removal of the in-memory event machinery. No new authorization system, login authentication, provider policy, branch-name-to-task inference, first-parent traversal, registration-merge reconstruction, SPEC_STALE computation, source-file existence check, mutant executor, historical finding lookup, resource measurement, merge acceptance reconstruction or product-domain change.

The kernel remains a library over supplied text and witnessed graph data. A successful parser or start decision is not an authenticated GitHub approval, complete V0.1 gate decision or permission to merge.

## Source Reconciliation and Exact File Boundary

All paths are repository relative. Frontmatter scope is an exact allowlist, not permission to edit every listed file unnecessarily. It contains 7 production files and 13 existing test/fixture/model files, for a maximum of 20 changed files. There are no file creations, deletions or renames.

| File | Existing source and exports | Authorized change |
|---|---|---|
| src/forge/contract-document.ts | ContractMetadataSchema is strict Format 1; CONTRACT_HASH_PREFIX is v1; parseContractDocument takes a string; body is unchecked; ContractDocument contains V1 metadata | Add V2 schema, explicit dispatch, v2 domain, byte decoder entry point, V2 framing/lint; retain V1 exports and v1 hashes |
| src/forge/primitives.ts | RepoPathSchema is ASCII relative paths; RefNameSchema currently accepts short refs; TextSchema requires only non-whitespace | Add dedicated check-command schema and protected-path classification exports; constrain RefNameSchema; retain general TextSchema and RepoPathSchema behavior |
| src/forge/runs.ts | DeveloperReportSchema requires mutations; VerificationEvidenceSchema and MutationResultSchema carry legacy mutation evidence; commands use TextSchema | Remove mutations from strict DeveloperReportSchema; use check-command schema at command fields; retain legacy evidence and mutation result schemas |
| src/forge/events.ts | run_started has no runBase; event roles are explicit | Require runBase on run_started; preserve event variants, role table and observations |
| src/forge/start-gate.ts | StartRequestSchema has no runBase; canStartDeveloperRun returns contractCommit; dependencies checked against baseCommit | Require runBase, check supplied graph relations, return runBase; preserve pure API and existing task/approval/file checks |
| src/forge/state.ts | ContractRevisionRecord has V1 metadata; run_started forwards no runBase; OWNER_NOT_HUMAN exists only inside task_accepted; equivalent mutations may come from reports | Store metadata union, forward runBase, centralize Owner-human guard, remove report mutation authority; retain reducer, replay and projections |
| src/forge/verification.ts | PROCESS_NOTE_PREFIX exempts coordination paths and coordination renames; effectiveMutations falls back to developer report | Remove exception and exported constant; apply shared path classification; support V2 metadata and explicitly unevaluated V2 mutations; retain legacy verifier-evidence handling |
| tests/forge/contract-document.test.ts | V1 golden vectors, framing/schema fuzz, Format 2 currently rejected | Preserve V1 vectors; add V2 schema/byte/lint/hash cases and compile-time narrowing checks |
| tests/forge/fixtures.ts; tests/forge/run-fixtures.ts | Short refs, old reports, start at C | Explicitly migrate synthetic builders to qualified refs, required runBase and mutation-free reports |
| tests/forge/start-gate.test.ts; tests/forge/runs.test.ts | Start-at-C expectations, short-ref fixtures, lifecycle cases | Update intentional semantics and add runBase, owner-human, report and RefName regressions |
| tests/forge/verification.test.ts; tests/forge/repair-v2.test.ts | Coordination bypass positives, developer mutation fallback | Reverse bypass expectations; test path tiers, reports without authority and legacy evidence independently |
| tests/forge/review-acceptance.test.ts; tests/forge/scenarios.test.ts | Equivalent and surviving mutations supplied by DeveloperReport | Put synthetic witnessed mutation results in verifier evidence, never silently promote a report; preserve review acknowledgement assertions and scenario depth |
| tests/forge/dogfood.test.ts | Accepts TASK.vN.md filenames; replays old short refs and developer mutation claims as accepted contemporary history | Separate historical bytes from canonical registration; retire the misleading successful-current-history assertion as specified below |
| tests/forge-red-team/findings.test.ts | RT-01/02 document coordination exemptions; mutation matrix uses report fallback | Flip only superseded findings, add prescribed regression families and retain unrelated trust-boundary findings |
| tests/forge-red-team/model.ts; tests/forge-red-team/differential.test.ts | Independent reference model mirrors old gate, reports, refs and bypass | Independently migrate those semantics and generated events; retain seed count, coverage and independent oracle |

Read-only integration references: src/forge/{ancestry,freeze,identity,kernel,node-sha256}.ts; tests/forge/{ancestry,architecture-approval,identity,kernel,state,typecheck}.ts; package.json; package-lock.json; tsconfig.json; all existing forge/contracts/FORGE-CORE-* files and their existing approval/review records. None may be modified by this run. No AGENTS.md was present in the inspected repository tree.

The Freeze task card names a possible protected-paths.ts module but does not define a required import path. This contract places the one shared path implementation in primitives.ts instead. That avoids a twenty-first changed file and keeps the Format-1 20-file default intact. runs.ts is explicitly included because it owns DeveloperReportSchema, despite its omission from the shorthand task-card file list. No re-export facade or extra module may be added to evade this boundary.

## Public API and Compatibility

Preserve ContractMetadataSchema as the Format-1 schema and ContractMetadata as its existing inferred V1 type. Add ContractMetadataV2Schema and ContractMetadataV2. Add AnyContractMetadata = ContractMetadata | ContractMetadataV2. ContractDocument.metadata and ContractRevisionRecord.metadata use the union, discriminated by forgeContractFormat. V2 must not acquire synthetic baseCommit or mutationSmoke properties. V1 must not acquire synthetic V2 properties. Existing callers that access version-specific fields must narrow the discriminator.

Keep parseContractDocument(text, sha256Utf8), ContractDocumentResult, ContractRef, contractPathFor, Sha256Utf8 and the kernel factory/method signatures. The existing kernel method automatically supports V2 through the changed parser; kernel.ts needs no edit. Add parseContractDocumentBytes(bytes: Uint8Array, sha256Utf8: Sha256Utf8): ContractDocumentResult as a module export, not a second kernel method.

Keep CONTRACT_HASH_PREFIX exactly equal to "forge-contract-v1\n". Add CONTRACT_HASH_V2_PREFIX equal to "forge-contract-v2\n". Do not redefine the old constant to mean the newest format.

Add CheckCommandSchema, protectedPathLevel(path: RepoPath): "always" | "forge" | null, and isProtectedPath(path: RepoPath): boolean to primitives.ts. isProtectedPath is true for either non-null tier; it is classification, not task authorization. All production consumers use this single implementation. Classification accepts validated RepoPath strings and performs no filesystem access.

StartRequestSchema and run_started intentionally require the new runBase field. There is no implicit fallback to C for old requests or events. DeveloperReport intentionally no longer accepts mutations, even an empty array. PROCESS_NOTE_PREFIX is intentionally removed, not left as a deprecated permission shortcut. These are the explicit API breaks. General event names, event projections, evidence schema, mutation-result schema, ownership of SHA-256, frozen results and deterministic ordering remain intact.

Format-1 readability is not a promise that historical event logs remain valid under stricter event rules. No silent event migration or historical acceptance rewrite is permitted.

## Format-2 Metadata Schema

Every object below is strict, including nested objects. All fields shown are mandatory; only explicitly nullable fields accept null. Unknown properties are errors. No coercion, trimming, defaulting, sorting, Unicode normalization or deduplication is performed. Numeric integers are finite safe integers. String lengths below are JavaScript UTF-16 code-unit counts, matching Zod string length. This length convention and the lexical details below complete the Freeze where it is silent.

| Field | Exact local schema rule |
|---|---|
| forgeContractFormat | Literal number 2, not string "2" |
| taskId | Existing TaskIdSchema |
| title | String length 1..120; no C0, DEL or C1 control character; also subject to the shared contract text restrictions; no trimming |
| contractVersion | Positive safe integer |
| specifiedAgainst | Existing CommitShaSchema: exactly 40 lowercase hex characters |
| supersedes | null iff contractVersion is 1; otherwise strict {contractVersion, contentHash, blobSha, format}; previous version must equal current version minus 1; contentHash uses Sha256HexSchema; blobSha uses the 40-lowercase-hex lexical schema; format is 2 or "legacy", never 1 |
| dependencies | Array of 0..16 strict {taskId, acceptedCommit, provenance}; taskId uses TaskIdSchema; acceptedCommit is non-null CommitShaSchema; provenance is "forge" or "legacy"; reject self-dependency and duplicate task IDs |
| reads | Required array of 0..64 RepoPathSchema values, unique and strictly ascending by compareCodeUnits; exact files, not globs or directories with a recursive meaning |
| scope | Strict {create, modify}; both arrays of RepoPathSchema; each sorted strictly ascending, unique, mutually disjoint; combined length <= limits.maxChangedFiles; the current contract path is forbidden, case-insensitively; local protected-path rules below also apply |
| requiredChecks | Nonempty array of strict {name, command}; names retain /^[a-z][a-z0-9-]{0,31}$/ and are unique; command uses CheckCommandSchema; no policy-name allowlist is embedded in this schema |
| mutants | Array of 1..8 strict {id, file, before, after, tests}; unique id matching /^m[1-8]$/; file is a RepoPath and an exact member of create or modify; before length 1..400; after length 0..400 and not identical to before; tests is a nonempty array of RepoPath values; before/after obey decoded text rules but may contain LF and TAB |
| limits | Strict {maxProductionLines, maxChangedFiles}; positive safe integers; fixed Freeze ceiling 550 and 30 respectively; the later policy gate may impose lower limits; no measurements in this task |
| findings | Array of strict {id, status, note}; id has form F-<TASK>-<positive decimal PR number>-<positive decimal ordinal>, without leading zeroes; embedded TASK satisfies TaskIdSchema and equals this taskId; IDs unique; status is "addressed" or "withdrawn"; note length 1..400 and non-whitespace, subject to decoded text rules |

The Finding-ID grammar and uniqueness requirement make the Freeze's F-ID notation executable; they do not prove provenance or resolution. A revision-1 contract has findings: []; same-version review responses are not new contract revisions (Freeze section 5.8). This is structural validation, not carry-forward adjudication.

No additional sorting requirement is imposed on dependencies, requiredChecks, mutants, mutant tests or findings. No contiguity rule is imposed on mutant IDs: a single m8 is valid. Scope may be empty. reads may overlap scope because this is redundant but not an authorization expansion. Mutant tests may point outside scope; reading a test is not permission to change it. Repeated test paths do not create additional mutation credit.

The same global text restrictions are checked on decoded metadata string values, including before/after; a canonical JSON escape cannot smuggle NUL, a lone surrogate or a prohibited format-control character into parsed metadata.

Out of this schema and out of CORE-0002: existence of S or files; S on first-parent main; accepted dependency provenance; policy's exact check set/commands; predecessor blob existence/hash; registration-version count; withdrawal authority; complete finding carry-forward; unique text anchor in a source file. The later verifier/platform tasks must perform those checks. A syntactically valid legacy dependency does not become accepted merely because provenance says legacy. The existing synthetic event reducer may still require its witnessed accepted dependencies; CORE-0002 must not add fabricated legacy acceptance records.

## Parser Selection, Text Rejection and Hashing

Parser stages are ordered: text/encoding; delimiters; JSON parse and canonical representation; explicit format dispatch and schema; V2 body validation; hashing and deep-freezing. A later stage is not entered when an earlier stage fails. The existing handling of deeply nested JSON stays non-throwing for document-data errors. A supplied hash function remains the existing trusted port; do not add another cryptographic provider or cache hashes.

The byte entry point uses TextDecoder("utf-8", {fatal: true, ignoreBOM: true}). ignoreBOM retains U+FEFF so the parser can reject a leading BOM. Malformed byte input returns NOT_WELL_FORMED_UNICODE, not replacement-character text and not an escaping decoder exception. The string entry point retains lone-surrogate detection. It cannot recover original bytes after a caller has already performed lossy decoding; document this limit and require byte entry for blob consumers.

For both formats reject a leading U+FEFF BOM, any CR, unpaired UTF-16 surrogates, C0 U+0000..U+001F except LF U+000A and TAB U+0009, Bidi U+202A..U+202E and U+2066..U+2069, and Zero-Width U+200B..U+200F anywhere in document text. Thus NUL, ESC and U+200E/U+200F are rejected. Do not widen this task into arbitrary Unicode sanitization: ordinary non-ASCII prose, emoji and valid U+FFFD are allowed. Internal U+FEFF is not a leading BOM and retains existing behavior; U+2060 is not in the Freeze's prohibited ranges. Neither becomes silently removed. The stricter title and command rules remain separate.

Preserve the existing encoding error order: NOT_WELL_FORMED_UNICODE, BOM, CARRIAGE_RETURN. Append one METADATA_SCHEMA issue at path ["text"] for prohibited document characters; avoid one issue per character. For prohibited decoded metadata characters use METADATA_SCHEMA at ["metadata", ...fieldPath]. These choices avoid inventing a new architecture-wide error vocabulary.

The first bytes/characters remain exactly ---json followed by LF. The close delimiter remains LF, three hyphens, LF. Parse JSON, then require JSON.stringify(raw, null, 2) to equal the original frontmatter substring exactly. Preserve the existing property-order policy: input key order need not be globally sorted; that exact order is hashed. Duplicate keys, alternative escaping, compact JSON and noncanonical whitespace fail before dispatch.

Only raw.forgeContractFormat === 1 selects ContractMetadataSchema. Only === 2 selects ContractMetadataV2Schema. Missing, unknown, numeric-string or other versions fail METADATA_SCHEMA at ["metadata", "forgeContractFormat"]. Never try V1 after V2 failed; never guess from field names, filenames, headings or end markers. V1 with V2 fields and V2 with baseCommit/mutationSmoke fail their strict schema.

After all validation, hash the selected format's prefix plus the entire exact original document, including delimiters, body, marker if present and final LF. The byte path must re-encode to precisely the accepted input bytes before using the existing UTF-8 hash port; fatal valid UTF-8 plus preserved BOM behavior supplies that invariant. There is no LF conversion, NFC normalization, trimming, JSON reserialization for hashing, or marker removal. contentHash is not a Git blob SHA and neither is embedded in metadata. Domain separation is deliberate; do not make the mathematical claim that SHA-256 collisions are impossible.

Historical Format-1 contracts that obey the text/command restrictions remain readable with byte-identical v1 hashes. Their bodies retain Format-1 permissiveness: no new H1, section, status, title or end-marker requirement. V1 baseCommit, nullable dependency declarations and mutationSmoke remain schema-readable. Approval/start rules and future bootstrap policy may still reject a readable contract. No allowlist of task IDs is hardcoded into this parser; FORMAT_NOT_CURRENT is the later gate's job.

## Format-2 Body and End Marker

The body begins immediately after the close delimiter. Its first line must equal # <taskId> v<contractVersion>: <title>, followed by LF. No leading blank line, alternative case, missing colon, extra space or second competing H1 is accepted. A mismatch returns TITLE_MISMATCH at ["body"].

Required complete level-2 source lines, each exactly once outside fenced code blocks and HTML comments, are ## Acceptance Criteria and ## Non-Goals. If version N > 1, also require ## Changes since v<N-1>. If supersedes.format is legacy, also require ## Migration from Legacy. Their order is unrestricted. Wrong heading level, trailing spaces, quoted/indented lookalikes and occurrences only inside code/comments do not satisfy the requirement. Missing or duplicate required sections return METADATA_SCHEMA at ["body", "sections", expectedHeading]. Additional ordinary sections are allowed. Section contents are not semantically evaluated for adequacy by the parser; that is architecture review.

Use a small deterministic source-line scanner, not a Markdown dependency or rendered-document parser. Recognize backtick and tilde fences with up to three leading spaces, opening length >= 3, and a matching closing character with length >= opening and only trailing spaces/tabs. Inside a fence, other headings do not count. Recognize HTML comment spans from <!-- through --> for heading counting. An unclosed fence/comment cannot hide a missing required heading. Literal status/chat prohibitions below apply to all body lines, including examples. This exact scanner is a contract choice to make false-heading cases testable within the small implementation.

Reject status assertion lines whose first non-space/tab text starts, ASCII-case-insensitively, with Status:, Approved, Freigegeben or Review:. Reject ATX heading lines containing approved or freigegeben, ASCII-case-insensitively. Return STATUS_ASSERTION with the one-based body line number in the issue path. This is a deterministic lexical ban, not natural-language truth detection.

Reject the phrases laut Chat and siehe Thread anywhere in the body, ASCII-case-insensitively, as CHAT_REFERENCE. Reject timestamp tokens in ATX heading lines: YYYY-MM-DD, HH:MM or HH:MM:SS with decimal digits, using METADATA_SCHEMA at the heading line. This specifies the Freeze's otherwise unspecified timestamp lexer; it makes no claim to detect all possible human date spellings. No network resolution of links is performed.

The last line is exactly <!-- END OF CONTRACT <taskId> v<contractVersion> --> followed by exactly one LF. No spaces, second LF, comment, byte or character may follow it. The marker is part of the hash. A body without any standalone marker candidate returns END_MARKER_MISSING. A standalone candidate is a line beginning <!-- END OF CONTRACT; wrong task/version, malformed candidate, duplicate candidates, misplaced candidate or invalid trailing data returns END_MARKER_MISMATCH. Count standalone candidates globally even inside a fence/comment, so quoting a complete marker line does not create ambiguous framing. Inline prose containing marker-like text is allowed and cannot terminate the document. There is no escape hatch based on the filename.

New ContractIssueCode members are TITLE_MISMATCH, STATUS_ASSERTION, CHAT_REFERENCE, END_MARKER_MISSING, END_MARKER_MISMATCH, SCOPE_PROTECTED and SCOPE_PROTECTED_FOR_TASK_CLASS, all already named by the Freeze. Other new structural/lint failures use METADATA_SCHEMA. Existing issue/result shape and freezing remain.

## Protected Paths and Scope Evaluation

Match ASCII paths after ASCII case folding for protection only. Exact scope membership remains case-sensitive; a casefold match never authorizes a different spelled path. Do not normalize slashes, resolve dot segments, infer renames or query the filesystem. Existing RepoPathSchema rejects non-ASCII, absolute paths, backslashes and dot/dot-dot segments; full tree portability, modes and casefold collisions belong to VERIFIER-0001.

The shared tier classifier has these exact rules, with always taking precedence:

1. At every directory depth, basenames package.json, package-lock.json, .npmrc, .gitattributes and .gitmodules are always. Basename patterns tsconfig*.json, vitest.config.* and vite.config.* are always; each star denotes zero or more characters within that basename, never a slash. Every basename ending .snap is always. A __snapshots__ component anywhere, including a path equal to that component, is always.
2. The exact root directories forge, .github, src/forge, src/forge-verifier, src/forge-platform, tests/forge, tests/forge-verifier, tests/forge-platform, tests/forge-red-team and scripts, and their slash-delimited descendants, are forge. No arbitrary src/forge* prefix expansion: src/forgery/a.ts and tests/forge-extra/a.ts are not classified forge by this list. Nested x/forge/a.ts is not a root-prefix match.
3. All other valid paths have tier null. node_modules is not added to this classifier; its tree/install treatment is outside this task.

This follows the user's complete directory clarification. Additional contract/history prohibitions remain distinct from the generic tier list: no implementation run may modify forge/contracts/**, forge/approvals/** or forge/reviews/** (including the directory path itself), case-insensitively. These are the Freeze section 3.2 frozen/registration-only paths and preserve the existing contracts/approvals veto. They are not made editable by classifying the encompassing forge tree as forge. The current contract path is never in its own scope.

For V2 metadata, reject any scope path with tier always or one of the registration/history vetoes as SCOPE_PROTECTED. Reject a forge-tier scope path for a task whose ID does not begin FORGE- as SCOPE_PROTECTED_FOR_TASK_CLASS. For FORGE- tasks, such a path is allowed only as the exact file entry in scope. These are local schema/parser checks; no owner bypass is added. V1 metadata stays historically parseable, but evaluation applies the new scope/protection rules.

Keep the public isProtectedPath boolean separate from whether a FORGE- task may edit a protected file. In evaluateVerification, any deletion fails and every rename fails for both endpoints, including coordination-to-coordination. An added path must be in create; a modified path in modify. always and the registration/history vetoes fail regardless of task or scope. forge requires a FORGE- task ID and exact scope membership. For legacy direct helper inputs without taskId, treat forge permission as absent, not as a FORGE task. All scope failures retain SCOPE_VIOLATION in VerificationEvaluation; the more specific ContractIssueCode is used by V2 document validation.

Delete PROCESS_NOTE_PREFIX and all branches that exempt forge/coordination. A FORGE task with an exact coordination file in modify can still modify it under normal forge-tier rules; a product task or out-of-scope edit cannot. This task does not delete the historical coordination files.

Differential obligation: one production classification source, used by core and later verifier. Until VERIFIER-0001 exists, test an explicit independent table of every tier boundary. If its actual export exists at the implementation baseline, add the real two-consumer comparison to the scoped tests/forge/verification.test.ts and run the same corpus against both exports; this comparison is then mandatory. If [3] runs before [2], [2]'s integration tests must provide that comparison later and its production consumer must use the core source rather than retain a divergent list. CORE-0002 must not import a nonexistent verifier module, add a hard dependency on [2], fabricate a differential pass, or conditionally skip an available comparison. Record which comparison was actually possible at the implementation baseline. This ordering rule follows the Freeze's explicit independence of [2] and [3]; it does not claim a differential pass when only one consumer exists.

## Check Commands and RefName

CheckCommandSchema accepts a string containing at least one non-space character and only printable ASCII U+0020..U+007E. It rejects TAB, LF, CR, NUL, DEL and non-ASCII, including NBSP and Unicode dash confusables. No trimming or rewriting is allowed. Apply it to requiredChecks.command in both formats, DeveloperReport.commandsRun.command and VerificationEvidence.checks.command. This does not turn arbitrary ASCII shell text into safe executable commands; the later policy gate must require exact approved commands and the later runner must execute its trusted argv. General prose TextSchema remains unchanged.

RefNameSchema accepts only refs/heads/<path> or refs/pull/<positive decimal without leading zeroes>/head. It rejects tags, remote-tracking refs, refs/replace, short refs, HEAD, rev expressions and SHA^{commit}; literal commit selectors belong to future Git adapter construction, not this data type. Total length <= 255. Head suffix consists of nonempty slash-separated ASCII [A-Za-z0-9._-]+ components; no component starts with dot, ends with dot or ends with .lock; reject any .., repeated slash or trailing slash. These are lexical rules, not live Git validation or task identity inference. A qualified ordinary branch unrelated to Forge is still a valid observation ref; allowed namespaces belong to the later gate.

The restricted namespace choice is a proposed local completion of W-31: the kernel observes branch and PR heads, not tags or arbitrary Git namespaces. It performs no git check-ref-format invocation. No value is silently expanded from main to refs/heads/main.

## Start-Gate runBase

Add mandatory runBase: CommitShaSchema to StartRequestSchema and the run_started event body. It is a supplied witnessed run fact, never contract content. canStartDeveloperRun remains pure. The future trusted adapter computes it; this task does not accept an authenticated claim merely because the field exists.

Define S = metadata.baseCommit for V1 and metadata.specifiedAgainst for V2; C = the existing registered contractCommit; R = request.runBase. Keep task existence/state, active-run, current revision, approval, contractAtCommit C/path/hash binding, C persistence and S persistence checks. Keep the existing S ancestor-or-self C check and BASE_NOT_IN_CONTRACT_HISTORY diagnostic; it remains a conservative library guard consistent with a contract written after its specification base.

Add R reachable from at least one supplied ref, else RUN_BASE_NOT_PERSISTED with subject null. Add C ancestor-or-self R, else CONTRACT_NOT_IN_RUN_BASE with subject null. Missing graph edges block exactly as existing ancestry helpers do. Together S <= C <= R proves S <= R over the supplied graph. A dependency acceptedCommit must be ancestor-or-self R, instead of ancestor-or-self S. For this failure emit DEPENDENCY_NOT_IN_RUN_BASE with subject equal to the dependency task ID. Keep the old DEPENDENCY_NOT_IN_BASE union member for source compatibility but stop emitting it from this gate. For a null dependency add DEPENDENCY_UNRESOLVED with that task ID, even though normal approvals already reject it. Add these named reasons to BlockReasonCode; do not silently skip unresolved dependencies.

If allowed, return the existing shape {allowed: true, startFromCommit: R}. The reducer forwards body.runBase without substitution and stores the decision in startedFromCommit. No second runBase field is added to RunRecord; the accepted event plus existing startedFromCommit preserve the fact. All blocked reasons stay sorted by code, subject, null first; decisions remain deeply frozen and inputs unchanged.

The pure kernel has no registrationMerge M in its current record and no authoritative main. It therefore does not claim to prove M <= R, R on first-parent main, current main, clean registration merge, merge-base(H, main), isolated C, SPEC_STALE or source existence. Those are mandatory future VERIFIER-0002 checks, not alternative implementations hidden in this task. C <= R is necessary but insufficient to prove registration. Do not replace C with M in contractAtCommit to conceal that distinction.

## DeveloperReport and Mutation Authority

DeveloperReportSchema remains strict with exactly claimedResultCommit, claimedRemoteRef, commandsRun, deviations, knownLimitations and reviewHints. Remove mutations entirely. A report with mutations is schema-invalid, including mutations: [], null, false or a convincing detected list. Its commands and prose remain claims; no report value becomes verification evidence.

Keep evaluateVerification(metadata, report, evidence) and effectiveMutations(metadata, report, evidence) as three-argument APIs to minimize call-site disruption. Their second parameter may be typed unknown and ignored; neither function reads any property or invokes any getter on it. State passes the new report normally. Preserve legacy MutationResultSchema, VerificationEvidenceSchema.mutations and equivalentMutationNames. Old verifier-supplied mutation evidence may still be evaluated and acknowledged for Format 1; historical developer claims cannot satisfy it.

For V1: mutationSmoke none ignores mutation evidence and reports mutationSource none. Otherwise use evidence.mutations when non-null, with source verifier; null supplies no results and source none. optional allows no evidence; required with no results still fails MUTATION_EVIDENCE_INVALID. Keep existing must_detect/equivalent/result consistency checks and exact equivalent-acknowledgement set semantics for verifier evidence. There is no developer_report fallback. Remove developer_report from producible MutationSource values.

For V2: mutants are specifications for independent reviewer replication in V0.1, not old MutationResult evidence. effectiveMutations returns an empty result list with mutationSource not_evaluated_by_verifier. evaluateVerification evaluates checks and scope and preserves that explicit source on success or failure; it neither treats legacy evidence.mutations as fulfillment of V2 mutants nor emits MUTATION_EVIDENCE_INVALID solely because that evidence is null. A V2 kernel code-review event has no legacy equivalent mutations to acknowledge, so its expected acknowledgement set is empty. Do not add a reviewer-result schema or synthetic mutation success field.

This distinction is intentional: the preserved V1 in-memory evaluator is not the entire Format-1 bootstrap process in Freeze section 5.10. The human bootstrap reviewer runs the prose mutants and records review evidence outside DeveloperReport. No hardcoded bootstrap-ID bypass is installed in the kernel. Future V0.1 acceptance must enforce reviewer-replicated mutants through the platform review rules; a core check/scope pass alone must not be represented as a complete mutation or merge approval.

## Owner-Human Invariant

After event schema validation and ROLES_FOR_EVENT validation, but before any task/run lookup or state mutation, reject every event with role owner and actor.actorType other than human as OWNER_NOT_HUMAN, path ["actor"], subject null, issues []. Apply the same shared guard in step so applyEvent and replay agree. Remove the later acceptance-only check as redundant; do not leave inconsistent precedence between owner event kinds.

This covers task_registered, run_failed when role owner, run_abandoned and task_accepted. Human-owner events still obey all existing lifecycle restrictions. A developer-role run_failed remains valid for the actual run developer, even when that actor is an AI. A role invalid for the event returns ROLE_NOT_ALLOWED first; malformed actors return EVENT_SCHEMA first. No exception is made for labels named owner or provider strings. This check is an actor-type invariant, not proof that the caller is the real GitHub Owner; authentication stays outside the kernel.

## Dogfood and Existing-Test Migration

The existing 1087-test baseline is the Freeze's inventory, not permission to delete tests until a count looks green. Capture the actual baseline inventory at the implementation runBase and compare the final inventory. Every changed existing expectation must cite the relevant rule in this contract. No skip, todo, only, lower seed count, relaxed assertion, configuration change or timeout change is allowed. Preserve the existing 20_000-ms timeout and workload of the long mixed-log test.

1. Keep historical V1 contract bytes, v1 hash vectors and approval-record bindings unchanged. For dogfood file loading continue fatal UTF-8 with BOM visible. Do not normalize checked-in CRLF or rewrite old documents to make them parse.
2. Canonical candidate filenames must equal contractPathFor(document.ref.taskId), using the same path for every revision. Remove the suffix formula that accepts TASK.vN.md. Keep FORGE-CORE-0001B.v2.md as an explicitly named historical parse/hash fixture; assert that a contract_registered event using that sidecar path is rejected with CONTRACT_PATH_MISMATCH. Do not delete or rename it or count it as a current canonical registration.
3. The old nightLog includes short refs, absent runBase and developer mutation reports. Preserve an explicit rejection test for the unmodified legacy shape. Replace the claim that current rules accept that real history with a clearly named synthetic migration scenario; qualify refs and supply explicit witnessed runBase, remove report mutations, and supply separately constructed verifier evidence when a legacy mutation test requires it. Do not describe these adapted events as facts actually observed in the historical run.
4. The old 0001A diff includes an unscoped coordination file. Under current scope rules it fails SCOPE_VIOLATION. Assert that failure. Build a separate fully scoped synthetic lifecycle to retain coverage of successful verification, independent review and acceptance; do not bless the historical diff by silently deleting its offending path.
5. Retain historical file-scope coverage with two explicit categories: canonical registered contracts and known historical provenance fixtures. The sidecar may explain historical provenance of files; it must never authorize a new run or registration. Add this task's scope only from its actual registered canonical document at implementation time, not from an untracked draft or a hardcoded blanket directory exception.
6. Flip coordination allow cases in verification.test.ts, repair-v2.test.ts and findings.test.ts to reject. Cover both rename endpoints. Add a positive FORGE-task exact-scope edit so the tests distinguish removing an exemption from banning the entire directory unconditionally.
7. Move synthetic witnessed mutation lists from reports into verifier evidence in the legacy mutation matrix, review-acceptance cases and scenarios. Add direct rejection of old report keys. Never make a fixture builder silently move an arbitrary report.mutations field into evidence; each test must show the new witness source.
8. Migrate all valid synthetic short refs explicitly. Keep malformed/short values as negative cases and update independent model generation to classify them invalid. Add runBase explicitly to valid start-event/request builders. Keep at least one R distinct from C throughout positive start and lifecycle coverage.
9. Update the independent red-team model from these rules, not by importing the implementation under test. Preserve its 30 seeds and event/state coverage. Add malformed report/Owner/ref cases to model rejection coverage. Unrelated existing red-team characterizations stay unchanged, including the distinction between witnessed/self-declared identity and actual authentication.
10. Put new tests in the scoped existing test files. Compile-time assertions may be added to contract-document.test.ts or another scoped test; tests/forge/typecheck.ts does not need to change. A new standalone test module would exceed the file allowance and is not authorized.

## Acceptance Criteria

AC-01: The module parses both formats by literal discriminator, with strict nested schemas, exact canonical JSON and unchanged V1 golden hashes. No V2 failure is accepted through a V1 fallback.

AC-02: V2 includes every field and local constraint in the metadata table; unknown/status fields and removed V1 fields fail. The schema does not fabricate successful Git, policy, review or finding checks.

AC-03: V2 body title, mandatory sections, revision/migration headings and end marker are enforced. Byte decoding and decoded metadata reject the prescribed character classes. No normalization occurs.

AC-04: The shared protected-path classifier implements the complete directory and basename rules; scope evaluation rejects forbidden tiers, history paths, every deletion/rename and the former coordination bypass. Product metadata with forge scope returns SCOPE_PROTECTED_FOR_TASK_CLASS.

AC-05: Start requires explicit runBase; allowed output and reducer storage equal that SHA, with persistence and ancestry failures closed. Dependencies bind to R. No live Git or main/registration claims are added.

AC-06: DeveloperReport cannot contain mutation claims and no helper consumes them. V1 witnessed mutation checks remain available; V2 explicitly reports not_evaluated_by_verifier. Passing tests do not become reviewer approval.

AC-07: All four owner-role event families enforce OWNER_NOT_HUMAN in both stepwise application and replay. Valid developer failure remains possible.

AC-08: All command positions use printable ASCII; all ref-schema positions require the qualified head/ref grammar. Exact command equality and task-independent ref identity remain intact.

AC-09: Sidecar parseability is separated from canonical registration in dogfood. Historical bytes and approval hashes remain unchanged. Legacy replay is not misrepresented as contemporary acceptance.

AC-10: Both required package commands pass; all adversarial cases below have assertions of the specified result and positive controls. The change contains <= 400 added production lines and <= 20 changed files. All eight bootstrap mutants are independently attempted at the exact reviewed head and killed by the targeted tests, with applicability established first.

AC-11: Required RTN IDs are explicitly represented as traceability labels with SOURCE TEXT UNAVAILABLE where needed. Do not claim an exact reproduction of an unavailable historical test. Use the Freeze's actual normative rules and the actual source behavior for the executable tests.

AC-12: Production imports remain pure library imports. No access to child_process, fs, fetch, GitHub, environment variables, clock, randomness, package installation or persisted state is introduced. Existing legacy event machinery remains present.

## RTN Traceability

Mandatory section-16.2 references: RTN-05, RTN-06, RTN-07, RTN-08, RTN-11, RTN-12, RTN-13 and RTN-17. Also retain RTN-19 as the additional section-17.2 reference. For each of these nine IDs the historical original wording is SOURCE TEXT UNAVAILABLE. The same-numbered current RT-xx tests are not assumed to be these RTN-xx cases.

Add a test-suite traceability description listing these IDs and this source limitation. The concrete executable regression families required here are: strict V2 metadata/framing; hash-domain separation; unsafe text/commands/refs; protected-path and coordination rules; explicit runBase; developer mutation non-authority; all Owner events; canonical-path versus sidecar behavior. They are specified by the acceptance matrix below, not assigned invented one-to-one historical RTN meanings. RTN-01/02/03/14/15 remain future VERIFIER-0002 references; RTN-04/09/10/16/18 remain outside this implementation as allocated by the Freeze.

## Adversarial Acceptance Matrix

These are required future implementation tests, not experiments claimed to have passed during drafting. Each row is independently asserted; parameterized ranges must test every member and their immediate allowed boundaries. Start from a valid fixture and change only the named input unless the row expressly describes a combination. P = parser/byte/schema tests in contract-document.test.ts; V = scope/verification/repair tests; G = start-gate/run lifecycle tests; E = event/report/ref tests in runs.test.ts and red-team files; D = dogfood/red-team integration. The test labels below are local C2 IDs and do not invent RTN source text.

| ID | Attack or boundary | Required outcome |
|---|---|---|
| C2-01 P | Replace V2 domain with v1 when independently hashing a valid V2 document | Published parser hash equals v2 golden vector and differs from wrong-domain vector |
| C2-02 P | Change body byte while metadata stays identical | Exact text/hash changes; unchanged original text/hash retained |
| C2-03 P | format missing, 0, 3, "2", null, object | METADATA_SCHEMA; never fallback |
| C2-04 P | V2 has baseCommit or mutationSmoke; V1 has specifiedAgainst or title | Strict METADATA_SCHEMA |
| C2-05 P | Add status/approval/hash/runBase/unknown key at root or nested object | METADATA_SCHEMA |
| C2-06 P | Duplicate a JSON key with valid final value | FRONTMATTER_NOT_CANONICAL |
| C2-07 P | Reorder frontmatter keys without changing canonical indentation | Accept; hash exact new text, not normalized original |
| C2-08 P | Compact JSON, escaped ordinary character, wrong indentation, trailing JSON space | FRONTMATTER_NOT_CANONICAL |
| C2-09 P | Missing opener/closer, malformed JSON, extreme nesting | Existing exact framing/JSON error; no data-dependent throw |
| C2-10 P | UTF-8 invalid continuation, overlong sequence, surrogate encoding, truncated multibyte character | Byte parser NOT_WELL_FORMED_UNICODE; hash port not called |
| C2-11 P | Leading UTF-8 BOM with otherwise valid content | BOM; no decoder BOM stripping |
| C2-12 P | CRLF or isolated CR in either metadata or body | CARRIAGE_RETURN; no normalization |
| C2-13 P | Each C0 character except LF/TAB, including NUL/ESC | Reject raw body and decoded metadata; METADATA_SCHEMA |
| C2-14 P | Each U+202A..202E and U+2066..2069 | Reject anywhere and in decoded fields |
| C2-15 P | Each U+200B..200F including LRM/RLM | Reject raw and escaped metadata forms |
| C2-16 P | Lone high/low surrogate, reversed pair; escaped surrogate in metadata | Reject; valid emoji pair positive control succeeds |
| C2-17 P | Umlaut, emoji, composed/decomposed accents | Accept allowed prose; do not normalize distinct text/hashes |
| C2-18 P | Literal U+FFFD, internal U+FEFF, U+2060 | Accept permitted body values; distinguish from malformed byte input |
| C2-19 P | Missing title, title length 0/121, title with TAB/DEL/C1 | METADATA_SCHEMA; lengths 1/120 positive controls |
| C2-20 P | H1 wrong task/version/title, leading blank, extra space or second H1 | TITLE_MISMATCH |
| C2-21 P | Required section absent, wrong case/level or trailing spaces | METADATA_SCHEMA; exact headings pass |
| C2-22 P | Required heading appears only in backtick/tilde fence or HTML comment | Does not satisfy section requirement |
| C2-23 P | Duplicate required heading outside examples; unclosed fence hides heading | Reject; no regex-only false positive |
| C2-24 P | Revision N omits Changes since v<N-1> or uses v<N> | Reject; v1 does not require that heading |
| C2-25 P | legacy supersedes without Migration from Legacy | Reject; format 2 predecessor needs no legacy heading |
| C2-26 P | Status:/Approved/Freigegeben/Review: line, including ASCII-case/indent variants | STATUS_ASSERTION |
| C2-27 P | Heading contains approved/freigegeben; heading contains defined timestamp token | STATUS_ASSERTION or specified METADATA_SCHEMA |
| C2-28 P | Body contains laut Chat or siehe Thread | CHAT_REFERENCE |
| C2-29 P | Truncate immediately before end marker | END_MARKER_MISSING |
| C2-30 P | Wrong task/version or malformed standalone end marker | END_MARKER_MISMATCH |
| C2-31 P | Duplicate standalone marker, including one in a fence/comment | END_MARKER_MISMATCH |
| C2-32 P | Missing final LF, extra LF, space or arbitrary text after marker | END_MARKER_MISMATCH |
| C2-33 P | Inline marker-like phrase inside ordinary prose | Cannot terminate document; final standalone marker still required |
| C2-34 P | V1 body lacks marker/title/required sections | Remains readable; original golden hash unchanged |
| C2-35 P | V2 reads omitted, unsorted, duplicate or length 65 | METADATA_SCHEMA; explicit [] and length 64 allowed |
| C2-36 P | Trailing-slash/glob, absolute/backslash/dot-segment/non-ASCII read path | Existing RepoPathSchema rejects invalid syntax; a plain path such as src is not rejected as an actual directory without future tree evidence and has no recursive meaning |
| C2-37 P | Scope duplicate/cross-list overlap/unsorted/own-contract case alias | Reject; no automatic sorting/deduplication |
| C2-38 P | Scope count exceeds maxChangedFiles by one | Reject; equality succeeds |
| C2-39 P | Dependency null acceptedCommit, duplicate task, self-dependency or seventeenth entry | METADATA_SCHEMA |
| C2-40 P | Uppercase/short S, acceptedCommit, predecessor blob/hash | METADATA_SCHEMA |
| C2-41 P | v1 supersedes object; v2 null; predecessor N-2/current/future; format 1 | METADATA_SCHEMA |
| C2-42 P | Correctly shaped legacy dependency or predecessor references nonexistent object | Shape may parse; no claim that provenance/existence was checked |
| C2-43 P | limits absent/unknown field/zero/fraction/unsafe integer/551 lines/31 files | METADATA_SCHEMA; 550 and 30 schema bounds allowed |
| C2-44 P | 0/9 mutants; ID m0/m9/duplicate; single m8 | Invalid sets reject; single m8 accepted |
| C2-45 P | Mutant file outside exact scope, including case alias | METADATA_SCHEMA |
| C2-46 P | before empty/401; after 401/equal to before; after empty | Invalid values reject; empty replacement allowed |
| C2-47 P | Mutant tests empty/invalid path; nonempty out-of-scope test file | Invalid syntax rejects; out-of-scope read reference allowed |
| C2-48 P | Malformed/duplicate/cross-task finding ID, unknown status, blank/401 note | METADATA_SCHEMA |
| C2-49 P | v1 with nonempty findings; later version with addressed/withdrawn claim | v1 rejects; later shape accepted without claiming genuine resolution |
| C2-50 E | Non-ASCII command, NBSP, confusable dash, TAB/LF/CR/NUL/DEL, spaces only | Reject at each of metadata/report/evidence command locations |
| C2-51 E | ASCII command differs by an extra space | Schema may accept; required-check exact comparison fails |
| C2-52 E | Short main/HEAD/branch, refs/tags/main, refs/replace/x, SHA^{commit} | RefNameSchema rejects |
| C2-53 E | Qualified ref with //, .., trailing slash/dot, dot-leading component, .lock suffix, length 256 | Reject; valid length boundary and ordinary heads pass |
| C2-54 E | refs/pull/0/head, 01/head, 1/merge, nonnumeric PR number | Reject; refs/pull/1/head succeeds |
| C2-55 V | foo/package.json, deep/PACKAGE-LOCK.JSON, src/x/VITEST.CONFIG.TS | always at all depths and case spellings |
| C2-56 V | tsconfig.json/tsconfig.prod.json, vite.config.ts, .npmrc/.gitattributes/.gitmodules below arbitrary directory | always; near-miss basenames remain unclassified |
| C2-57 V | x/__snapshots__/ordinary.txt, x/A.SNAP, __SNAPSHOTS__ path | always, including nonsnap contents of snapshot directory |
| C2-58 V | Forge/x.md, SRC/FORGE/state.ts, every listed root directory and descendant | forge, casefold-matched; always basename still takes precedence |
| C2-59 V | src/forgery/a.ts, src/forge-extra/a.ts, nested x/forge/a.ts, scriptsX/a | No broad-prefix false positive |
| C2-60 P/V | Product task names forge path in scope | Parser SCOPE_PROTECTED_FOR_TASK_CLASS; evaluation SCOPE_VIOLATION |
| C2-61 V | FORGE task edits exact forge scope path versus case-alias/unlisted sibling | Exact path passes; alias/unlisted fail |
| C2-62 P/V | FORGE task tries always basename or contracts/approvals/reviews history path | Reject even when scope lists it |
| C2-63 V | Out-of-scope coordination add/edit, coordination-to-coordination rename | All fail; exact scoped FORGE edit is separate positive control |
| C2-64 V | Deletion of allowed path or rename with either/both endpoints allowed | Always fail; preserve both rename subjects |
| C2-65 G | Missing/malformed runBase | REQUEST_INVALID directly; EVENT_SCHEMA for run_started |
| C2-66 G | R != C and S <= C <= R with R persisted | Allowed startFromCommit is R, and RunRecord stores R |
| C2-67 G | R only local/unreachable; C persisted elsewhere but not ancestor R | RUN_BASE_NOT_PERSISTED / CONTRACT_NOT_IN_RUN_BASE respectively |
| C2-68 G | Missing C->R witness edges, unrelated R, cyclic supplied graph | Fail closed when relation unproven; terminate on cycles |
| C2-69 G | Dependency accepted after S but before R; dependency outside R | First passes graph requirement; second DEPENDENCY_NOT_IN_RUN_BASE |
| C2-70 G | Wrong C/path/hash in contractAtCommit; obsolete/unapproved contract | Preserve current blocking reasons; runBase does not bypass approval |
| C2-71 G | Merely supplied graph shows C <= R but no real registration M/main | Pure result documented as witness-only; do not claim later gate passed |
| C2-72 E | DeveloperReport contains mutations [], null or detected/equivalent claims | EVENT_SCHEMA; no event or state change |
| C2-73 V | Direct evaluator report has malicious mutations/getter that throws | Never read it; same result as report with no mutation field |
| C2-74 V | V1 required with no evidence versus detected verifier evidence | First MUTATION_EVIDENCE_INVALID; second uses source verifier |
| C2-75 V | V1 verifier evidence survived/not_applied/duplicate/equivalent-without-rationale | Retain appropriate legacy failure; developer claims cannot repair it |
| C2-76 V | V2 valid checks/scope plus mutations:null, or forged legacy mutation list | Source not_evaluated_by_verifier; neither claims V2 mutant satisfaction |
| C2-77 E | AI/system owner task_registered, run_failed, run_abandoned, task_accepted | OWNER_NOT_HUMAN for each, both applyEvent and replay |
| C2-78 E | Invalid role plus nonhuman actor; malformed actor; unknown run with otherwise valid owner role | ROLE_NOT_ALLOWED; EVENT_SCHEMA; OWNER_NOT_HUMAN respectively |
| C2-79 E | Actual AI developer fails own run; human owner uses a valid owner transition | Positive controls accepted; forged developer still rejected |
| C2-80 D | Register TASK.v2.md with valid text/hash; parse historical sidecar alone | Registration CONTRACT_PATH_MISMATCH; parsing does not grant registration |
| C2-81 D | Old nightLog and unscoped historical coordination diff | Old event shape rejected; separately adapted diff fails scope |
| C2-82 D | Mutate returned metadata/decisions or compare before/after input | Deep freeze and input immutability retained |
| C2-83 D | Replay versus stepwise application across migrated generated logs | Same decisions and projections; old seeds/workload retained |
| C2-84 D | Try to meet 400 lines by netting deletions, minifying, moving logic into tests or adding a twenty-first file | Acceptance refused; count added non-test lines and changed files literally |

## Bootstrap Mutants

mutationSmoke is required for this Format-1 contract. These eight prose IDs are the complete bootstrap mutant inventory; they are not a Format-2 mutants array and contain no invented source anchor in code that has not yet been written. The code reviewer applies each one separately to the exact implementation head, after a clean baseline run. The reviewer records the concrete file/span and single semantic substitution used, confirms the mutant actually applies, reruns the named tests, then restores the exact head before the next mutant. A type/syntax error alone does not count as a killed behavioral mutant; choose a compiling mutation. An inapplicable or surviving mutant blocks acceptance until reconciled; it is not reclassified as equivalent by the DeveloperReport.

| ID | One compiling semantic fault to introduce | Target files / killing assertions |
|---|---|---|
| m1 | Select forge-contract-v1 prefix for parsed V2 documents | contract-document.ts; contract-document.test.ts C2-01 and independent golden vector |
| m2 | Remove the V2 exact-final-marker check while leaving schema/body validation active | contract-document.ts; contract-document.test.ts C2-29..32 |
| m3 | Let a heading inside a code fence count as a required body section | contract-document.ts; contract-document.test.ts C2-22/23 |
| m4 | Restore the out-of-scope forge/coordination edit exemption | verification.ts; verification.test.ts and repair-v2.test.ts C2-63 |
| m5 | Return C instead of R on an otherwise allowed start | start-gate.ts; start-gate.test.ts and runs.test.ts C2-66 |
| m6 | Restore effectiveMutations fallback to an adversarial direct report's mutation list when evidence is null | verification.ts; verification.test.ts C2-73/74 with a compiling local type cast |
| m7 | Restrict OWNER_NOT_HUMAN back to task_accepted only | state.ts; runs.test.ts C2-77 for the other three owner families |
| m8 | Remove the prohibited-character check for decoded metadata strings while retaining raw-document checks | contract-document.ts; contract-document.test.ts escaped NUL/lone-surrogate cases C2-13/16 |

For each ID report killed or survived, targeted test name, actual exit code, applicability and restoration evidence. No test is allowed to detect the mutation by inspecting function.toString, source text, branch labels, environment flags or mutant identity. Tests must observe changed public behavior. The independent reviewer, not a developer assertion, provides this evidence under Freeze section 16.3. Existing legacy verifier mutation tests are library tests and do not replace this bootstrap review.

## Production Ceiling and Validation

Hard ceiling: 400 added lines outside tests/** in the implementation diff from its actual runBase to reviewed head, counted with the Freeze's numstat/no-renames convention. Comments and blank lines count. Deleted lines do not offset additions. A reformatted old line counts as an addition. Test helpers/model changes count as tests only when under tests/** and must not carry imported production behavior. No minification, code generation, embedded implementation strings, exporting production routines from tests, or unscoped helper files may hide size.

Changed-file ceiling: 20, exactly the maximum frontmatter allowlist. Keep the path helpers in primitives.ts, do not add protected-paths.ts or a new test file. Contract registration is outside this implementation diff and its contract path is never run scope.

Planning estimate, not a measured result: contract-document 190-225 added production lines; primitives 45-60; runs 4-10; events 1-3; start-gate 15-25; state 10-20; verification 35-50. Total 300-393 added production lines. Test migration and new coverage may be substantially larger; no test-LOC ceiling is claimed. If a readable, correct implementation exceeds 400, stop for a contract revision/scope decision; do not silently raise the cap or omit tests. A reviewer must validate the actual diff, not this estimate.

Run npm run typecheck and npm test in the implementation checkout and in an independently obtained exact-head checkout. Capture exit codes and test inventory. Existing source files, contracts and the old golden vectors are baseline evidence. New V2 golden vectors must be computed independently over literal prefix plus UTF-8 bytes, not by calling the parser under test. The eight mutants require separate reviewer evidence. No CI workflow is introduced to do this.

## Self-Review: Wording Loopholes Closed

| # | Potential loophole | Binding closure |
|---|---|---|
| 1 | Draft mistaken for approval | Goal expressly withholds approval and implementation authorization |
| 2 | This bootstrap accidentally needs V2 to parse itself | Frontmatter contains only current V1 fields |
| 3 | Fake accepted OPS dependency | Empty hard-code dependency list; OPS is an explicit operational prerequisite |
| 4 | V1 parser silently upgrades metadata | Original V1 schema/type retained; union is explicit |
| 5 | Failed V2 document accepted as V1 | Literal dispatch, no fallback |
| 6 | Duplicate JSON keys choose an attacker value | Canonical raw JSON equality precedes dispatch |
| 7 | Body altered without changing identity | Whole original text, including final marker/LF, hashed |
| 8 | Hash domain constant silently changes old hashes | Old constant immutable; new distinct constant |
| 9 | Decoder silently strips BOM or repairs UTF-8 | fatal decoding and ignoreBOM true |
| 10 | Escaped NUL/surrogate survives raw scan | Validate decoded metadata strings too |
| 11 | Arbitrary Unicode normalized to trusted text | No normalization; exact forbidden ranges stated |
| 12 | Fake heading in a code sample satisfies lint | Source-line scanner excludes fenced/comment headings |
| 13 | Extra payload follows a valid marker | One exact final LF and no trailing content |
| 14 | Marker in an example creates alternate termination | Count standalone candidates globally; duplicates fail |
| 15 | Filename supplies a missing task/version binding | H1/marker use parsed metadata; path registration remains separate |
| 16 | Unknown fields create status or authority | Strict nested objects and no status metadata |
| 17 | Missing reads silently becomes [] for V2 | reads is mandatory; only V1 transition supplies logical empty reads |
| 18 | Finding status proves it resolved | Shape-only validation; later reviewer/provenance checks explicitly deferred |
| 19 | Scope protects only root package.json | Every-depth basename matching, casefold-normalized |
| 20 | src/forgery or nested x/forge is incorrectly classified | Exact named root directories with slash boundaries |
| 21 | FORGE prefix permits all protected edits | Exact scope required; always/history/current-contract vetoes remain |
| 22 | Casefold protection expands authorization | Protection folds case; scope membership does not |
| 23 | Coordination becomes a bypass under a new name | No exemption; normal tier and scope rules only |
| 24 | Renaming/deleting avoids file authorization | Every rename/deletion rejected; both rename endpoints reported |
| 25 | runBase is merely accepted and ignored | Gate returns R; reducer forwards and stores that result; R != C positive test |
| 26 | Pure graph check claimed to prove actual main/registration | C <= R limitation explicitly distinguished from M/main Git facts |
| 27 | Dependency checked only against outdated spec base | Ancestry target is R |
| 28 | Old event omitting R silently starts at C | Mandatory event/request field; no compatibility default |
| 29 | Developer supplies mutations through an old call shape | Strict report rejects key; helper never reads second argument |
| 30 | V2 pass falsely advertises mutation success | Explicit not_evaluated_by_verifier and separate reviewer duty |
| 31 | AI Owner registers/fails/abandons a task | Central guard covers all owner-role event kinds |
| 32 | Actor label or provider authenticates real Owner | actorType invariant only; no authentication claim |
| 33 | ASCII command is assumed safe to execute | Exact future policy allowlist/argv remains required |
| 34 | Short ref aliases a tag | Only qualified branch/PR-head refs; no expansion |
| 35 | Historical sidecar becomes canonical because it parses | Explicit parse-versus-registration split and rejection test |
| 36 | Test fixtures manufacture historical verification | Adapted scenarios labelled synthetic; raw legacy rejection retained |
| 37 | RTN numbers are filled with guessed meanings | IDs retained; unavailable source marked; concrete tests derive from Freeze/code |
| 38 | Differential test silently skips unavailable verifier | Core table required now; real two-consumer comparison explicitly outstanding until verifier exists |
| 39 | LOC allowance measured net or excludes comments | Added non-test lines, no deletion credit, comments/blanks included |
| 40 | Correctness sacrificed to make estimate fit | Hard stop/revision if 400/20 cannot be met; no compressed hidden implementation |

## Source Limitations

- original RTN prose unavailable;
- original PKG section 8 unavailable;
- normative requirements were taken from the Architecture Freeze, with the user's explicit protected-path and RTN clarification.

These historical source limitations do not by themselves prevent architecture review. Lexical/API completion decisions in this draft, including path-helper placement, the qualified-ref grammar and source-line lint, are visible for that review. No implementation, approval, historical RTN reproduction or verifier differential execution is claimed by this document.

<!-- END OF CONTRACT FORGE-CORE-0002 v1 -->
