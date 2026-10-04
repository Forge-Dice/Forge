# FORGE-VERIFIER-0001 FINAL CONTRACT RECONCILIATION

**Read-only reconciliation report. The requested final contract cannot yet be issued: the exact historical draft is missing.** This report completes the independently verifiable work and identifies precisely what remains. It is not an approval, a replacement contract, or a claim that all historical normative statements were reviewed.

## 1. Source identity and the blocking input

Current canonical main was checked live and remains **3d7545d843883418348004e68717399a64da7a7d**. The inspected temporary checkout is clean. No canonical changes, commits, branches, PRs or settings were made. No new Git commits or branches were created for this reconciliation.

The locally recovered Architecture Freeze is preserved byte-for-byte in [the source copy](VERIFIER-0001-Architecture-Freeze.source.md): 228,421 bytes; raw SHA-256 **a07847c7f4e8a459863e88d1c57d6e4cb81509a46725d5b870a6f1c18b599a79**. Source section references below point to that exact copy.

The Freeze's source inventory identifies the target as **FORGE-VERIFIER-0001.contract.DRAFT.md**, **32,686 bytes**, contentHash prefix **341ec983…**, fully embedded in §13 of **FORGE-V0.1-VERIFIER-IMPLEMENTATION-PACKAGE.md**. Neither that package nor those draft bytes were found in the accessible project files, local attachments or inspected task history. The package's Claude link redirects to login. The user has been asked for a path/link to the package or draft; no source was supplied before this report snapshot.

The available earlier V-01 handoff describes a different, Format-2, multi-stream rename-aware decoder. It is **not** a reconstruction of this Format-1 draft. It has not been used as the old contract.

Freeze §20.4 explicitly says the old V1-DRAFT remains valid unchanged because §5.10 covers it. That is evidence against an automatic rewrite. It does not supply the missing bytes or establish that a new reviewer has compared each normative line. W-24 explicitly changes PKG OD-10, but the missing draft may or may not repeat that obsolete instruction.

### Hash and textual-change ledger

| Item | Honest result |
|---|---|
| OLD contentHash | Only reported prefix **341ec983…** is available; full hash not independently computable without exact source bytes. |
| OLD raw bytes | 32,686 bytes reported by Freeze, not independently recovered. |
| NEW contentHash | **Not computed: no replacement contract has been fabricated.** |
| Changed historical contract lines | None changed by this task. |
| Exact semantic reason per changed line | Pending source recovery and actual textual diff; the W-table below is a reconciliation checklist, not a fabricated line-by-line diff. |
| Proposed final contract text | Withheld pending exact source. This report and its test matrix are not the contract. |

A hash prefix cannot reconstruct a document. Even recovering semantically equivalent prose is insufficient: spaces, terminal LF and body changes all affect Format-1 contentHash.

## 2. Actual main: Format-1 parser and integration boundaries

Code was read at the pinned main commit: [contract-document.ts](https://github.com/Forge-Dice/Forge/blob/3d7545d843883418348004e68717399a64da7a7d/src/forge/contract-document.ts), [primitives.ts](https://github.com/Forge-Dice/Forge/blob/3d7545d843883418348004e68717399a64da7a7d/src/forge/primitives.ts), [verification.ts](https://github.com/Forge-Dice/Forge/blob/3d7545d843883418348004e68717399a64da7a7d/src/forge/verification.ts), [runs.ts](https://github.com/Forge-Dice/Forge/blob/3d7545d843883418348004e68717399a64da7a7d/src/forge/runs.ts), and [start-gate.ts](https://github.com/Forge-Dice/Forge/blob/3d7545d843883418348004e68717399a64da7a7d/src/forge/start-gate.ts).

The parser accepts exactly these metadata keys: forgeContractFormat=1; taskId; positive safe-integer contractVersion; baseCommit (40 lower-case hex); dependencies of {taskId, acceptedCommit}; scope of exact create/modify arrays; requiredChecks of {name, command}; mutationSmoke=none|optional|required. Objects are strict. It forbids duplicate/self dependencies, exact duplicate scope paths across the two lists, the task's own contract path, and duplicate check names. It does not validate Git existence, protected-path task classes, actual command execution, registration or approval.

Framing is LF-only opening ---json\n, canonical JSON.stringify(raw,null,2), then \n---\n. BOM, CR and lone surrogate are rejected. Key order need not be sorted, but the original JSON representation must round-trip exactly. Hash is SHA-256 of UTF-8 **forge-contract-v1\n + complete exact text**. A raw file SHA-256 or Git blob SHA is a different identity. Body is opaque: a truncated body, body NUL or body status assertion can still parse. §5.10 does not retrofit Format-2 marker requirements into V1.

**Executed:** all **88 current contract-document tests passed**; **24/24 additional synthetic parser probes** matched expected behavior. The synthetic fixture is labelled as such and is not the target draft. Therefore the exact old draft's parser validation remains **UNVERIFIED**, despite Freeze's historical statement that it was validated. [Parser test report](verifier-format1-parser-tests.json); [audit evidence](verifier-reconciliation-evidence.json).

Important actual-code gaps: RepoPathSchema already restricts paths to ASCII [A-Za-z0-9._-] segments, maximum 255 characters, and forbids dot/dotdot segments. It still accepts CON, NUL.txt, .git/config and trailing-dot components. Current evaluateVerification permits unscoped forge/coordination additions/modifications and special coordination renames; it forbids deletions. It also requires check and mutation evidence when configured. Its scope helper is private; there is no public isProtectedPath yet. The current start gate returns the contract commit as startFromCommit. These are current facts, not Freeze target behavior, and **V-01 must not change those kernel files**.

Integration rule: protect paths and exact scope independently before relying on the kernel's scope outcome. Do not pass invented check successes or mutation kills merely to get a green evaluateVerification result. A narrow adapter may isolate genuine scope failures from current evaluator output, with tests proving unrelated CHECK_FAILED/MUTATION_EVIDENCE_INVALID are not relabelled as a completed verification. The original draft's exact adapter API must be recovered; this report does not prescribe a new public API in its place.

## 3. Scope freeze and ownership

Freeze §16.2 task [2] authorizes **pure path/listing/tree/diff authority**: RepoPath validation with stricter platform rules; whole-head casefold collision checks; protected-path classes; listing difference; tree policy; scope judgment through the existing kernel boundary. Functions consume supplied bytes/records and return deterministic values or failures.

**Excluded:** Git execution, subprocesses, filesystem traversal/materialization, GitHub API, workflow, sandbox, package installation, policy/identity/review-block parser, event persistence, ancestry/registration/run gate, SPEC_STALE implementation, test-inventory engine, Evidence-v1 writer, mutation executor, Contract V2, kernel refactoring and product code.

The Freeze names six production paths: src/forge-verifier/paths.ts, protected.ts, listing.ts, tree.ts, diff.ts and index.ts. It says **14 files according to V1-DRAFT**, but does not enumerate the remaining exact paths, test filenames or API signatures. Consequently the semantic boundary can be frozen now; the requested **exact 14-path scope cannot honestly be reconstructed**. Directory globs or guessed filenames must not be substituted in Format-1 scope metadata.

OPS prerequisites belong to task [1]. CORE-0002 is not a new code dependency for V-01: the Freeze allows either run order. Compare protection against fixed authoritative cases before CORE-0002; add/run differential compatibility once its isProtectedPath exists. Do not delay V-01 by importing a nonexistent future symbol.

## 4. W-01 through W-32 reconciliation ledger

Each row states the binding final rule and its impact. **Whether the original draft contains a stale sentence is unresolved for every row until its text is recovered.** Do not count these 32 rows as 32 discovered errors. Most are process constraints or exclusions, not implementation work.

| W | Binding result from Freeze | Reconciliation impact |
|---|---|---|
| W-01 | Merge commits only; preserve distinct registration M and acceptance A. | Process; no graph/Git implementation. |
| W-02 | C=M second parent, single nonmerge content commit, C parent=M first parent; same trees. | Process; no ancestry implementation. |
| W-03 | baseCommit is S; start current main/runBase, never automatically C. | Potential stale start instructions; CORE-0002/VERIFIER-0002 own code. |
| W-04 | GitHub/main facts; no persisted eventlog. | Do not add event store or persist synthetic replay. |
| W-05 | No lease or scheduler. | Exclude from V-01. |
| W-06 | No contract status claims. | Schema already rejects foreign fields; body review remains necessary. |
| W-07 | Stable finding IDs, reviewer-controlled closure, review-block carry-forward for V1. | Process; no issue tracker or findings metadata. |
| W-08 | Trusted-main Actions identity; no PR code on host. | Later workflow; not a V-01 prerequisite implementation. |
| W-09 | Owner identity and branch restrictions. | Process; no new approval files. |
| W-10 | Hash/blob/head-bound external review with owner attestation and provider independence. | Potential stale review/handoff instructions. |
| W-11 | No forge/coordination exception in verifier. | Direct V-01 rule; current kernel exception must not leak through. |
| W-12 | Verifier Evidence v1; no kernel Evidence v3 migration. | Full evidence adapter/writer belongs later. |
| W-13 | V1 mutationSmoke required, prose mutants, reviewer execution. | Direct metadata/prose requirement; no mutation runner. |
| W-14 | Explicit Format-1 bootstrap allowance and canonical task path. | Keep format 1, no metadata-only migration after acceptance. |
| W-15 | TASK-0004 and legacy material frozen. | No retroactive migration or approval rewrite. |
| W-16 | Hard 400 added production lines / 20 changed files by default. | Contract prose/process; no V2 limits field or V-01 numstat runner. |
| W-17 | Staleness checks plus scope existence; V1 reads empty by transition rule. | Do not inject reads into Format 1 or claim V-01 implements SPEC_STALE. |
| W-18 | Contract checks typecheck/npm run typecheck and test/npm test. | Potential stale metadata; diff-check is not allowlisted. |
| W-19 | Owner handoff v2 per run on tracking issue. | Process, not workflow automation. |
| W-20 | One open run repository-wide. | Operational precondition; no lease code. |
| W-21 | Halt ruleset instead of variable. | No env-variable halt feature. |
| W-22 | forge/run/codex/<TASK>-<n>; forge/contract/<TASK>-v<N>. | Potential stale branch instructions only. |
| W-23 | Five exact versioned block names. | Prose references; no block parser in V-01. |
| W-24 | No new forge/approvals files. | PKG OD-10 explicitly superseded, but old draft wording not yet inspected. |
| W-25 | S1 event policy belongs OPS; read together with W-32 override. | No workflow or settings additions. |
| W-26 | Codex developer; external reviewer provider distinct from relevant author. | No claim that ChatGPT independently code-reviews Codex. |
| W-27 | Owner-authorized self-review uses COMMENTED plus external attestation; run approval APPROVED. | Use specific W-27 over general approval sentences; no approval claim here. |
| W-28 | Spike audit/noreply evidence remains OPS work. | Do not silently mark prerequisite passed or implement identity checks here. |
| W-29 | Read receipt v2 in first empty commit message. | Potential stale receipt-in-body instructions; no receipt parser here. |
| W-30 | Two protected levels, basename at every depth, casefold matching, forge root prefixes. | Direct V-01 behavior; no waiting for CORE-0002 protection export. |
| W-31 | Qualified refs and no tags. | Applies later Git collector/reviewer commands; pure V-01 accepts bytes. |
| W-32 | No pull_request_review verifier trigger. | Overrides W-25 parenthetical; no V-01 workflow. |

## 5. Format-1 bootstrap compatibility, exactly preserved

Apply §5.10 externally without changing the parser wire schema: baseCommit is specifiedAgainst; reads is logically empty; limits use policy defaults 400/20; dependencies cannot have null acceptedCommit at registration. Forge dependencies require the accepted commit in the applicable history; TASK legacy dependencies use the Freeze's pinned legacy anchor. A dependency is not resolved merely because its SHA passes the parser.

Use mutationSmoke **required**, with stable prose mutant IDs; reviewer execution and mutant lines in FORGE REVIEW v1. No findings/supersedes/reads/limits/mutants/title/runBase metadata, no Format-2 hash domain, no compulsory end marker. Format-1 prose can be improved only as a new exact candidate with its own hash and review. Do not silently migrate accepted history or TASK-0004.

Run protocol is Freeze §16.3: operational prerequisites active; developer starts current main, first empty commit carries READ RECEIPT v2; code reviewer clones H, compares raw no-renames diff and protection, runs typecheck/test, compares baseline inventory, and applies every prose mutant. Owner attests exact results, merges with a merge commit, and separately records bootstrap evidence. V-01 does not implement those actions. Until the verifier workflow exists, do not claim machine-enforced GitHub checks protect this bootstrap run.

Required contract checks are exactly **typecheck → npm run typecheck** and **test → npm test** (§8.3). A reviewer may also inspect git diff --check, but adding diff-check as requiredChecks would be parser-valid and Freeze-policy-invalid. These local contract check names are distinct from future GitHub checks forge-gate and forge-verify.

## 6. Experimental Git findings reconciled

Existing disposable Git objects from the earlier lab were read again this turn, with replacement objects disabled. There were **27 observed base/head pairs; 27/27 listing-difference path sets agreed with git diff --name-only --no-renames**. No new experimental commits were created. Results include exact commit IDs, SHA-256 of both raw listings and change classifications in the audit evidence. This recheck validates data semantics, not production V-01 code or Git authenticity.

| Finding | Contract consequence |
|---|---|
| ASCII paths | Validate path bytes; do not decode invalid bytes with replacement or normalize Unicode. Existing RepoPath grammar is the starting restriction, not sufficient final validation. |
| 100644 only | Whole-head validation rejects executable 100755, symlink 120000 and gitlink 160000, even when unchanged by the task. |
| Casefold | Check full paths and every directory prefix: A/x and a/y conflict. Preserve original bytes for exact scope. Detect file/directory collisions in fabricated input. |
| Windows names | Reject reserved device names case-insensitively, including extensions and directory segments. Explicitly enumerate matching rules; do not rely on host filesystem behavior. |
| Trailing dot/space | Reject every offending component, never trim. Spaces are already outside RepoPath grammar. |
| Protected paths | Two levels; always takes precedence over forge. Basename rules at every depth; forge prefixes rooted; comparisons casefolded. Exact scope membership remains exact. |
| Listing authority | Difference of complete base/head snapshots, keyed by exact path with duplicate rejection; compare mode and blob OID. Do not derive authority from developer claims or name-only strings. |
| No rename inference | Exact rename and edited rename each produce one deletion plus one addition in rechecked fixtures. Deletion disallows the run. Case-only rename behaves the same. |
| Merge tree unchanged | Zero listing delta is possible despite commit-history changes. V-01 cannot certify history or intermediate writes. VERIFIER-0002 owns those checks. |
| Replace/shallow | Correct endpoint diff alone does not prove ancestry or complete observation. Git collection controls remain outside pure V-01. |
| Resource limits | Freeze states 1 MiB maximum per file and 255-character RepoPath via code. Bound input bytes, entry count, path/token lengths and output. **Exact aggregate listing/record constants are absent from the recovered Freeze and must come from the original draft or an explicit new decision.** |

The old lab's raw-diff prototype used 64 MiB and 10,000 records. Those are **experimental prototype constants**, not evidence of the missing draft's final listing API or contract limits. Its rename parser must not be imported into V-01 simply because it passed experiments. The large rechecked fixture has 12,000 head entries and 12,001 elementary changes; this proves the need for explicit budgets, not which threshold is authorized.

Protected minimum from §3.2/W-30: package.json, package-lock.json, tsconfig*.json, vitest.config.*, vite.config.*, .npmrc, .gitattributes and .gitmodules as any-depth basenames; .nvmrc is additionally designated always in §3.2. Contracts, approvals and reviews under forge are always. Snapshots are forbidden. Remaining forge/, .github/, Forge source/test directories and scripts/ are forge-class. Recover the exact draft before deciding whether its prefix grammar treats src/forge* as a broad lexical prefix or as the enumerated directory family; the Freeze's shorthand is not an excuse to silently change its API.

**Boundary correction:** a 100644 blob named x.ts may contain arbitrary binary bytes. ASCII path + normal mode + size does not prove text content. Freeze §3.1's binary prohibition cannot be discharged from ls-tree alone. If V-01 only receives listings, it must make no binary-content claim; later blob materialization/validation must supply that fact. Do not smuggle a blob reader or Git command into this task to conceal the limitation.

## 7. Adversarial acceptance matrix (102 cases)

These are proposed acceptance requirements for reconciliation, **not claims that unimplemented V-01 tests passed**. P/C/L/T/S/D belong to pure behavior or its input boundary. B belongs to bootstrap/review checks. Numeric listing limits, exact listing order/grammar and protected-prefix boundaries remain marked pending original text; they must be made exact before the contract is final. Tests that assert rejection need the recovered API's actual error vocabulary, not invented codes.

| ID | Input / attack | Required oracle |
|---|---|---|
| P01 | ASCII path src/a-b_1.test.ts | Accept; preserve bytes and case. |
| P02 | Empty path | Reject. |
| P03 | Absolute /src/x.ts | Reject. |
| P04 | Windows drive C:/x.ts | Reject. |
| P05 | Backslash src\x.ts | Reject; never translate separators. |
| P06 | Parent traversal src/../x.ts | Reject. |
| P07 | Dot segment src/./x.ts | Reject. |
| P08 | Repeated separator src//x.ts | Reject. |
| P09 | Trailing separator src/ | Reject. |
| P10 | Non-ASCII café.ts / decomposed equivalent | Reject both; no Unicode normalization. |
| P11 | Invalid UTF-8 byte in path | Reject bytes before replacement decoding can hide it. |
| P12 | TAB, LF, CR or embedded NUL in a path | Reject; do not split path into accepted fragments. |
| P13 | Space anywhere, including final space | Reject under RepoPath grammar. |
| P14 | Trailing dot in any segment | Reject, including dir./x.ts. |
| P15 | CON, con.txt, aux, NUL.data, PRN | Reject case-insensitively in any segment. |
| P16 | COM1…COM9 and LPT1…LPT9, with extensions | Reject in every directory component. |
| P17 | COM10.txt and console.ts | Accept if otherwise valid; no overbroad device prefix match. |
| P18 | .git/config and mixed-case .GiT/config | Reject; pure path rule must protect materialization boundary. |
| P19 | 255 ASCII bytes / 256 ASCII bytes | Accept / reject subject to other rules; path limit inherited from current RepoPath. |
| P20 | Colon, asterisk, question mark, pipe, quote, angle brackets | Reject, never sanitize. |
| C01 | Head contains A.ts and a.ts | Reject full-path casefold collision. |
| C02 | Head contains A/x.ts and a/y.ts | Reject directory-prefix collision even though full paths differ. |
| C03 | Head contains a and a/x.ts | Reject file/directory conflict in fabricated input. |
| C04 | Two byte-identical listing records for one path | Reject duplicate rather than Map overwrite. |
| C05 | Common prefix src/abc.ts and src/abcd.ts | Accept; not a directory collision. |
| C06 | Only head path changes Foo.ts → foo.ts | Derive delete+add; reject run due to deletion, independently of head collision. |
| C07 | Unchanged invalid path in head outside diff | Reject; tree validation is not diff-only. |
| C08 | Permutation of equivalent valid listing entries | Same semantic outcome and deterministic output; input-order grammar must be explicit. |
| L01 | Empty byte listing from a successful empty-tree observation | Parse as empty listing; this does not prove Git command success. |
| L02 | Nonempty listing lacks last NUL | Reject truncated input. |
| L03 | Extra NUL produces empty record | Reject; no trim/rstrip forgiveness. |
| L04 | Incomplete header / missing TAB | Reject whole input, no partial result. |
| L05 | Injected second TAB or line ending in pathname | Reject. |
| L06 | Unknown object type | Reject. |
| L07 | OID short, nonhex or uppercase | Reject against exact selected Git object-ID grammar. |
| L08 | 100644 blob, known nonnegative decimal size | Parse without converting invalid numbers to zero. |
| L09 | Size NaN, negative, exponent, unsafe integer or missing | Reject. |
| L10 | Git -l padded decimal size | Accept valid Git padding; exact grammar needs recovered draft. |
| L11 | Blob/header mode/type mismatch | Reject, e.g. 100644 commit. |
| L12 | Raw diff record :100644 ... supplied as listing | Reject wrong protocol; no auto-detection. |
| L13 | Bytes appended after final complete record | Reject if not another complete valid record. |
| L14 | Listing exactly at byte/record limit | Accept if otherwise valid; numeric limits must be recovered/finalized. |
| L15 | Listing exceeds byte or record limit by one | Reject deterministically before unbounded allocation; do not return prefix. |
| L16 | Very long header/size token | Reject within bounded work; parsing must not allocate by attacker-declared size. |
| T01 | Whole head has only ordinary 100644 blob entries | Pass mode/type rules. |
| T02 | 100755 executable, including unchanged file | Reject. |
| T03 | 120000 symlink, including unchanged file | Reject. |
| T04 | 160000 gitlink/submodule | Reject. |
| T05 | 040000 tree record in recursive leaf listing | Reject wrong listing shape. |
| T06 | Blob size 1,048,576 bytes | Accept size boundary if all other rules pass. |
| T07 | Blob size 1,048,577 bytes | Reject. |
| T08 | Empty blob | Accept size boundary. |
| T09 | Snapshot suffix x.snap, mixed-case X.SNAP | Reject tree rule and classify always. |
| T10 | x/__snapshots__/ordinary.txt | Reject even without .snap suffix. |
| T11 | Huge aggregate of individually small files | Apply explicitly bounded listing/entry capacity; per-file size alone is insufficient. |
| T12 | 100644 ASCII-named binary blob | Listing checks cannot establish textness; never claim binary content was verified. |
| S01 | Nested foo/package.json or PACKAGE-LOCK.JSON | always; reject any run change including FORGE task. |
| S02 | Nested tsconfig.extra.json, VITEST.CONFIG.TS, vite.config.js | always with case-insensitive basename matching. |
| S03 | Nested .npmrc, .gitattributes, .gitmodules | always. |
| S04 | .nvmrc | always according to Freeze §3.2; reconcile complete historical list. |
| S05 | forge/contracts/OTHER.md explicitly scoped by FORGE task | always wins over enclosing forge class; reject. |
| S06 | forge/approvals/x.json and forge/reviews/x.md | always; reject even if exact scope allows. |
| S07 | Forge/coordination/x.test.ts by product task | Reject forge class; no coordination exception. |
| S08 | src/forge-verifier/x.ts by FORGE task, exact create scope | Allow only when actually added and tree-valid. |
| S09 | Same protected forge file by TASK-0006 | Reject even if declared in scope. |
| S10 | Forge-class file by FORGE task but absent from exact scope | Reject. |
| S11 | src/forge-platform/x.ts and tests/forge-red-team/x.test.ts | forge class. |
| S12 | scripts/x.ts and .github/x.yml | forge class, exact scope plus FORGE task required. |
| S13 | x/forge/readme.md | Root-prefix rules do not match arbitrary nested forge directory; basename rules still apply. |
| S14 | FORGERY-0001 or XFORGE-0001 task ID | Does not qualify as FORGE- prefix. |
| S15 | Protected path differing only in letter case | Protection still applies; exact scope remains case-sensitive. |
| S16 | src/forgery/x.ts versus src/forge/x.ts | Freeze src/forge* shorthand needs exact boundary reconciliation; never silently choose glob semantics. |
| D01 | Identical base/head entries | No change. |
| D02 | New path only in head | added. |
| D03 | Path only in base | deleted; run scope verdict rejects. |
| D04 | Same path, different blob OID | modified. |
| D05 | Same path, same blob, changed mode | Retain difference; forbidden mode cannot disappear. |
| D06 | Same blob at a removed path and a new path | deleted + added, never renamed. |
| D07 | Rename with edited content | deleted + added; no similarity threshold. |
| D08 | New copy while source remains | added only; no copy inference. |
| D09 | Several deleted and added files share OID | No pairing; one elementary result per changed path. |
| D10 | Addition declared only in modify | Reject. |
| D11 | Modification declared only in create | Reject. |
| D12 | Deletion declared in modify | Reject; modify does not authorize deletion. |
| D13 | Unscoped added/modified path | Reject. |
| D14 | Scoped create remains absent and unused | No scope violation merely because optional permission unused; acceptance requirements decide required work. |
| D15 | Two listings have same OID/mode but disagree on size | Reject inconsistent observation; same immutable blob cannot have two sizes. |
| D16 | Input listing or returned result mutated between calls | No hidden shared state; verdict deterministic, inputs unchanged. |
| D17 | Kernel would forgive unscoped coordination addition | Verifier protection/exact scope must still reject. |
| D18 | Caller supplies forged renamed event instead of listings | No rename or developer-claim ingress as canonical diff authority. |
| B01 | Add Format-2 reads/limits/supersedes metadata to V1 | Actual current parser rejects; keep those fields out. |
| B02 | BOM or CRLF in contract | Actual current parser rejects; no silent rewrite. |
| B03 | Truncated V1 body after complete frontmatter | Current parser accepts; compare exact approved hash, not parser success alone. |
| B04 | Changed body with old approval hash | Require new review for new content; old approval cannot transfer. |
| B05 | Null acceptedCommit dependency | Current parser accepts; bootstrap registration must reject unresolved dependency. |
| B06 | Developer self-reports killed mutant | Insufficient; assigned independent reviewer reproduces at reviewed H. |
| B07 | Required mutant survived or was not applied | Blocking; not equivalent by self-declaration. |
| B08 | 401 non-test added lines or 21 changed files | Reject bootstrap limit; do not omit comments/imports/blank added lines from numstat. |
| B09 | Attempt to start run at C instead of current main/runBase | Bootstrap protocol rejects old start convention; no V-01 kernel change. |
| B10 | Import child_process/fs/net, GitHub client or workflow into V-01 | Reject scope/purity review; no hidden adapters. |
| B11 | Old approval JSON created for new contract | Reject process; frozen directory. |
| B12 | Changed exact test selector selects zero tests during mutation | Not killed; record zero execution and block. |

## 8. Required bootstrap mutation plan

The final Format-1 contract must contain stable prose IDs, exact behavior under mutation and tests that must kill it. The following **eight proposed coverage obligations are not asserted to be the original draft's IDs or mutations**. On recovery, preserve original IDs where they cover the same obligation; any replacement is a documented contract change. Do not invent before/after strings for source code that does not yet exist. At H, reviewer records exact applied patch, targeted tests, executed test count and observed failure; clean baseline must pass, each mutation runs independently and is reverted between trials.

| Proposed ID | Single behavior mutation | Required killing cases |
|---|---|---|
| M-PATH | Remove reserved-device-name rejection while leaving generic ASCII grammar | P15/P16, including device directory and extension |
| M-CASE | Compare only complete lowercased paths, omitting directory-prefix collision check | C02; also file/directory conflict C03 |
| M-MODE | Accept 100755 as ordinary file mode | T02 on an unchanged offending head entry |
| M-PROTECT | Restrict always basename matching to repository root | S01/S02/S03 nested examples |
| M-FORGE | Allow forge-class path for every task when declared in scope | S09 with product task |
| M-FRAME | Accept missing final NUL and return parsed prefix | L02/L04; assert failure, no partial success |
| M-DIFF | Suppress deletions when identical OID appears at another path | D06/D09, expecting delete+add and rejected run |
| M-SCOPE | Treat create and modify permission lists as interchangeable | D10/D11 with otherwise valid ordinary paths |

Every required mutant must be killed by the intended oracle, not merely fail to apply, select zero tests or break syntax. Survival is a blocking finding. A developer's mutation claim does not replace reviewer replication. Include boundary tests for the 1 MiB/resource limits even though the eight mutation slots cannot cover every predicate. Actual historical mutant fidelity is pending the source.

## 9. Production LOC re-estimate: ceiling 400

Estimate for the pure six-module responsibilities only; no implementation was written or measured. File allocations are planning buckets, **not a replacement exact scope**. Use existing kernel types/utilities where compatible; no copied parser, Git adapter or generalized policy engine.

| Responsibility | Estimated added production lines |
|---|---:|
| Path grammar, Windows names, normalized comparison helpers | 40–50 |
| Protected levels and precedence | 35–45 |
| Strict bounded listing parser and record types | 75–90 |
| Whole-tree mode/size/collision checks | 65–80 |
| Deterministic elementary listing difference | 35–45 |
| Scope integration, result types, public exports | 35–50 |
| Total | **285–360** |
| Remaining margin to hard ceiling | **40–115** |

Tests/fixtures: approximately **650–1,000 added test lines**, data-driven. No test LOC ceiling is inferred. Imports, type declarations, comments and blank added lines in production count: Freeze counts added lines outside tests/**, not net growth or executable statements. All non-test additions must stay ≤400 and total changed paths ≤20; the original stricter 14-path scope, once recovered, controls permitted files. Do not use generated/minified code or move production into tests to evade the ceiling. Exact public APIs, original scope and resource rules may consume the margin; if they cannot fit readably, report the conflict before implementation rather than quietly dropping validation.

## 10. Self-review: 36 contract loopholes

This self-review evaluates the proposed reconciliation requirements. It is not independent architectural approval and cannot claim findings against unseen historical lines.

| # | Loophole | Closure / unresolved boundary |
|---|---|---|
| 1 | Treat parser PASS as contract approval | Separate parse, hash binding, architectural review, registration and run readiness. |
| 2 | Recreate old text from hash prefix | Impossible; require source bytes and verify domain hash. |
| 3 | Use earlier four-stream rename-aware draft | Wrong artifact; reject substitution. |
| 4 | Inject V2 fields into bootstrap JSON | Current strict parser rejects; preserve Format 1. |
| 5 | Hide status in opaque body | Review text; current parser does not lint body. |
| 6 | Keep old hash after prose correction | Every byte change gets new hash and exact diff. |
| 7 | Interpret baseCommit as run start | Apply Freeze §5.10 and current-main bootstrap protocol. |
| 8 | Auto-pass mutation evidence using synthetic successes | Do not manufacture check/mutation results for current evaluator. |
| 9 | Trust kernel coordination exception | Verifier independently applies protection and exact scope. |
| 10 | Check only changed files for tree safety | Validate entire head listing. |
| 11 | Check only full paths for case collisions | Validate all component prefixes and file/directory roles. |
| 12 | Normalize invalid names into valid ones | Reject bytes, no trim/case rewriting/Unicode normalization. |
| 13 | Let basename protection apply only at repository root | Apply each protected basename at every depth. |
| 14 | Let forge class override always | always has priority; contracts/approvals/reviews remain protected. |
| 15 | Allow FORGERY task to access forge class | Require exact task prefix FORGE-. |
| 16 | Accept duplicate records into Map | Reject before insertion can erase conflict. |
| 17 | Accept missing terminal NUL using trim | Strict complete framing. |
| 18 | Parse size through permissive parseInt | Validate entire decimal token and safe bound. |
| 19 | Infer rename to forgive deletion | No rename inference; deletion blocks run. |
| 20 | Drop mode-only differences | Compare mode and OID, validate modes independently. |
| 21 | Confuse ASCII path with ASCII blob content | Listing cannot prove binary/text content. |
| 22 | Trust a failed Git process with empty stdout | Collector later must prove exit success/completeness; V-01 cannot authenticate it. |
| 23 | Catch parse errors and return empty diff | Return explicit failure, no success prefix. |
| 24 | Use unbounded split or recursive tree reconstruction | Recover/finalize byte, entry, path and aggregate bounds; avoid attacker-sized allocation. |
| 25 | Use localeCompare for authoritative order | Explicit deterministic byte/code-unit order, ASCII names. |
| 26 | Add filesystem walk/realpath to path helper | Pure inputs only; materialization outside V-01. |
| 27 | Use raw rename/copy status as authority | Only two listing snapshots determine final diff. |
| 28 | Import future isProtectedPath before CORE-0002 exists | Fixed normative fixtures now; differential check after CORE-0002. |
| 29 | Refactor unrelated kernel to ease adapter | Outside scope; require contract revision, not hidden dependency. |
| 30 | Count net lines instead of added production lines | Freeze numstat additions outside tests/**, ceiling 400. |
| 31 | Hide production in tests or minified lines | Review placement and readability; numerical ceiling alone is not semantic scope. |
| 32 | Mutation passes because selected no tests | Require real named test execution and clean baseline. |
| 33 | Mutation kill via syntax error only | Require intended behavior oracle; compile validity where mutation is behavioral. |
| 34 | Reviewer silently changes mutant and reports same ID | Record exact H/file/patch/test invocation/result with stable ID. |
| 35 | Owner/process record added to implementation scope | Keep bootstrap log and attestations in owner process, not V-01 run output. |
| 36 | Declare all historical normative lines compared | Cannot until original draft recovered; explicitly pending. |

## 11. Exact-source validation and change procedure

1. Obtain the actual 32,686-byte draft or extract its fenced text from PKG §13 with explicit fence-boundary handling. Retain original bytes separately; never silently convert CRLF, BOM or final-newline shape.
2. Decode UTF-8 strictly, run actual pinned Format-1 parser, report complete contentHash and compare its prefix with 341ec983. If different, label the recovered document a different candidate; do not repair bytes until the old identity is established. A PKG fence extraction may need provenance confirmation if it omits the last LF.
3. Enumerate every normative statement in the recovered draft with line anchors, including examples that prescribe behavior, metadata, scope, API, limits, review process and mutation IDs. Map each to code or Freeze; mark retained, changed, removed or ambiguous with source section and reason.
4. Keep technical core text unchanged where Freeze endorses it. Change only demonstrated stale text or unresolved constraints made necessary by this reconciliation. Freeze §20.4 means no change is the preferred outcome if the actual text already conforms.
5. If changes are required, emit separately named OLD and proposed files, a unified diff and a line-level reason ledger covering every insertion/deletion, including formatting and newline changes. Compute both domain hashes using the actual parser. Do not embed a contentHash field into strict metadata.
6. Validate the candidate's full 14-path scope against main, dependencies, exact check names, mutation obligations and 400-line feasibility. Compare its original tests with this supplemental matrix without falsely renaming old tests.
7. Only then publish the final proposed Format-1 text. Architecture review remains a separate act; actual registration C/M does not exist merely because a local file parses.

If the supplied old text already conforms, OLD hash and NEW hash are equal and the change ledger is empty. If OPS changes current main, do not silently refresh baseCommit: inspect relevant changes and document any content/hash change as part of the candidate. No Format-2 migration is authorized.

## 12. Final proposed Format-1 contract text

**Not issued.** The exact existing draft, full old hash, exact scope, API details, aggregate resource bounds and historical mutant/test matrix have not been recovered. Printing a newly invented contract here would misrepresent reconstruction and prevent the requested exact changed-line accounting. This source limitation is material for this task because it expressly requires reconciliation of a particular hashed document, not a new bootstrap contract from first principles.

The missing input is **FORGE-VERIFIER-0001.contract.DRAFT.md**, or **§13 of FORGE-V0.1-VERIFIER-IMPLEMENTATION-PACKAGE.md** with exact contract text. The independently established semantic boundary, 102 acceptance cases, eight mutation coverage obligations, LOC estimate and 36-item self-review above are ready to apply when that source is available.

No approval is claimed. No historical hash has been changed. No repository implementation, commits, branches, PRs or settings changes were performed.

**NOT READY FOR ARCHITECTURE REVIEW.**
