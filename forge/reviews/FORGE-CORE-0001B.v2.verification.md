# FORGE-CORE-0001B v2 — Repair verification and handoff

Date: 2026-10-03. Author: Codex. Independent code review: pending ChatGPT.
This is implementation/self-verification evidence, not an independent approval.
No approval record or accepted ForgeLog task was fabricated.

## 1. Resumed state and provenance

The existing repair worktree was intact on branch `codex/forge-core-v2-repair`.
Resume HEAD: `1c796927035e458d36dafda7b27cba7cb5f5dbc8`.
Ten tracked implementation files were modified and `tests/forge/repair-v2.test.ts` was untracked.
The A-patch contract, A implementation and B-v2 contract were already separate commits.
They were preserved; no reset, rebase, clean, squash or destructive checkout was used.
The unfinished test type errors were corrected in place. Primary and Mystery worktrees were untouched.

| Artifact | SHA |
| --- | --- |
| Before Red Team | bd3becb7dfbefc58089d69118f568bf32cab3b7d |
| Red-Team tests | dcd08db0113a196e078aee36f9b0bc79b9eed7cc |
| Repair starting base / Red-Team report | f712e50a1562233f31564af8218cef9fd1097b7c |
| A patch contract | 2d4276bc3391a2b4ee12f66296639683142e0725 |
| A patch implementation | 4cbbb25955bf73da0273309e4857de067bc0fb2e |
| B-v2 contract, bound to A patch implementation | 1c796927035e458d36dafda7b27cba7cb5f5dbc8 |
| B-v2 implementation | 811ed0d3a2322c0f1c65726422ad6ae8ca0d2f0e |
| Implementation Git tree | fbab21c00f17f6645971ea8f3bcdec31767c69bc |

Contract content hashes are SHA-256 of UTF-8(`forge-contract-v1\n` + exact Git-blob text),
verified against the actual contract parser:

| Contract | Git blob | Content hash |
| --- | --- | --- |
| FORGE-CORE-0001A-PATCH-0001.md | 3aca828281c3866ebbe8b6bfa7f919302b5e695f | 3e9125a53525a982dd23941ba390089a14ef231f863e1243c3104343825181ad |
| FORGE-CORE-0001B.v2.md | 82d5def8d062eff65f851064b0e0297dca3a8cf8 | 7db0e7220ea674b39282b79235a42d51759907c44f1e31b4e7fe56b03e863bd6 |

## 2. Independent reproduction and final behavior

Reproduced at actual f712e50 code before repairs, not inferred from Claude's report.
The exact Node probe is retained in the adjacent mutations JSON.

- RT-01: `{path:"forge/coordination/TASK-0001.md",change:"renamed"}` passed both evidence schema
  and scope evaluation. One path cannot encode source and destination; the old unconditional
  coordination exception could therefore hide a move across the protected boundary.
- RT-03: failed then passing entries with the same required name/command passed both schema and
  evaluation. The old `some` predicate selected the passing entry and ignored its conflicting sibling.
- RT-06: `approved` with a blocking finding was accepted and made the task `ready`.
  The acceptance transition belongs to A, so it was repaired under the separate minimal A contract.

Final implementation:

- Rename is a strict discriminated union with mandatory `fromPath` and `toPath`; the old shape is rejected.
  Only coordination-to-coordination moves are exempt. Every other rename emits violations for both
  endpoints, including contract/approval moves in either direction. Deleted files are always violations,
  including coordination. The protected roots and descendants cannot be explicitly whitelisted.
- Check names are globally unique in the entire evidence, even for extras or identical results.
  Every required name must have exactly one entry with the exact command and exit zero.
  Direct evaluation also rejects duplicated required names. Non-required unique failures remain informational.
- Approved architecture findings containing any blocking item reject with `VERDICT_INCONSISTENT`
  at `body.verdict`, before dependency checks. Rejected events never enter the log or yield a ready task.
  Existing earlier error precedence and changes_requested semantics remain unchanged.
- Public function names and exports are unchanged. ChangedFile's rename data shape is the intentional
  breaking API change. Stricter evidence cardinality is another compatibility restriction.
- State comments and a replay test establish the log as authoritative; no persistence implementation was added.

## 3. Changed files per commit

All paths below are repository-relative. There are no deletions or renames.

### 2d4276b — A patch contract

Added:
- forge/contracts/FORGE-CORE-0001A-PATCH-0001.md

### 4cbbb25 — A patch implementation

Modified:
- src/forge/state.ts
- tests/forge-red-team/findings.test.ts
- tests/forge-red-team/model.ts

Added:
- tests/forge/architecture-approval.test.ts

Only one production guard was added. The reference model implements the rejection independently.

### 1c79692 — B-v2 contract

Added:
- forge/contracts/FORGE-CORE-0001B.v2.md

### 811ed0d — B-v2 implementation

Modified:
- src/forge/runs.ts
- src/forge/state.ts (documentation comments only in this commit)
- src/forge/verification.ts
- tests/forge-red-team/differential.test.ts
- tests/forge-red-team/findings.test.ts
- tests/forge-red-team/model.ts
- tests/forge/dogfood.test.ts
- tests/forge/kernel.test.ts
- tests/forge/typecheck.ts
- tests/forge/verification.test.ts

Added:
- tests/forge/repair-v2.test.ts

11 files, 243 insertions / 35 deletions. B production: 39 insertions / 13 deletions,
below the 120 changed-production-line recommendation. Exact implementation allowlist was checked.
The later handoff documentation commit adds only this report, the adjacent mutation evidence JSON,
and forge/coordination/CODEX.md; it does not change implementation or contracts.

No changes to v1 contracts/approvals, src/domain, Mystery tests, package.json, package-lock.json,
dependencies, scripts or CLAUDE.md. No merge to main.

## 4. Windows dogfood correction and environmental boundary

The original dogfood test used URL.pathname for a Windows file URL and produced a doubled drive path.
It now uses Node's `fileURLToPath(new URL("../../", import.meta.url))`.
Its filename assertion also recognizes the explicitly contracted .v2 sidecar for contractVersion 2.

Before repair, 19 suites / 1,019 tests passed but dogfood could not load; that was NOT a green full suite.
After fixing the path, nine dogfood checks exposed CRLF in five existing checked-out artifacts.
Contract parsing intentionally rejects carriage returns and hashing covers exact bytes.

Those five otherwise unchanged artifacts were restored to their exact HEAD Git-blob bytes only after
proving that CRLF conversion was the sole difference. No parser normalization or newline tolerance
was introduced. The files match HEAD byte-for-byte and are absent from every commit diff.
An index refresh against those identical bytes removed the transient Git status entries.

Fresh verification uses `git -c core.autocrlf=false clone ...` so hashed fixtures retain repository bytes.
The contract is NOT silently rewritten to accept CRLF; a checkout that converts these signed fixtures
can still fail dogfood. No repository-wide attributes or Git configuration was changed.

The unfinished TypeScript test errors were parameter-table shape errors: raw check arrays were
expanded as argument tuples by it.each. Rows now wrap checks in an object before destructuring.

## 5. Actually executed verification

Runtime: Windows PowerShell, Node 24.19.0, npm 12.2.0, TypeScript 7.0.2,
Vitest 5.0.3, Zod 4.6.5. Bundled Node and a pre-existing npm CLI were used.
PowerShell explicitly returned `$LASTEXITCODE`; success was not inferred from shell completion alone.

| Location / exact command | Exit | Result |
| --- | --- | --- |
| Repair worktree: npm run typecheck | 0 | No TypeScript diagnostics |
| Repair worktree after all mutations: npm test | 0 | 22 files, 1,086 tests passed; 22.84 s |
| Repair worktree: git diff --check | 0 | No whitespace errors |
| RED_TEAM_COVERAGE=1; node node_modules/vitest/vitest.mjs run tests/forge-red-team/differential.test.ts --reporter=verbose --silent=false | 0 | 31 tests; 15.66 s; coverage below |
| git push -u origin HEAD:refs/heads/codex/forge-core-v2-repair | 0 | Implementation and separate predecessor commits pushed |
| git ls-remote origin refs/heads/codex/forge-core-v2-repair | 0 | Confirmed 811ed0d3a2322c0f1c65726422ad6ae8ca0d2f0e before documentation |
| git -c core.autocrlf=false clone --single-branch --branch codex/forge-core-v2-repair https://github.com/Wuerfelduell/Forge.git <fresh-directory> | 0 | Fresh GitHub clone; HEAD exactly 811ed0d3a2322c0f1c65726422ad6ae8ca0d2f0e |
| Fresh clone: npm ci | 0 | 40 packages installed, 41 audited, zero reported vulnerabilities |
| Fresh clone: npm run typecheck | 0 | No TypeScript diagnostics |
| Fresh clone: npm test | 0 | 22 files, 1,086 tests passed; 24.63 s |

The full test command includes Forge-Core, dogfood and both Red-Team suites; it also runs existing
Mystery tests unchanged. The repository defines only typecheck and test scripts.

A diagnostic attempt through `npm test -- tests/forge-red-team/differential.test.ts --reporter=verbose --silent=false`
returned exit 1 without usable output in this shell/npm wrapper. It is NOT counted as successful.
The direct installed-Vitest invocation above subsequently ran successfully and supplied coverage.
An unquoted PowerShell `HEAD^{tree}` diagnostic also failed; quoted `'HEAD^{tree}'` succeeded.
Neither failure was concealed as a passing verification gate.

## 6. Differential and coarse performance checks

30 deterministic seeds × 300 candidate events = 9,000 candidates:
2,676 accepted, 6,324 rejected; zero kernel/reference-model disagreements.
Coverage reached all 9 task states, 6 run states, 11 event types and 25 rejection codes.
Existing coverage thresholds were not lowered.

The reference model uses its own scope/count/approval logic, not production evaluator/state helpers.
ForgeEventSchema remains a shared structural admission filter; handwritten schema rejection tests
therefore separately cover rename shape, endpoint uniqueness and globally duplicate check names.

A separate identical-workload probe compared f712e50 with 811ed0d on this host:
450 valid register/contract/approve events and 10,000 schema+verification calls per sample,
one warmup then three samples, sequential processes. Both probes exited 0.

| Median | Baseline | Repaired |
| --- | --- | --- |
| Replay, 450 events | 8.368 ms | 6.132 ms |
| 10,000 evidence parses/evaluations | 23.910 ms | 25.983 ms |

No large slowdown was observed in this small workload. This is a coarse smoke, not a statistically
controlled performance guarantee or an improvement claim. It does not remove PERF-1/PERF-2b.
Exact script and all samples are in the adjacent JSON.

## 7. Mutations: applied and detected

Every mutation was individually applied exactly once by a Vite pre-transform in memory.
Source-file writes were unnecessary. Before/after source hashes, exact replacement, failed test names,
exit code and runner are preserved in FORGE-CORE-0001B.v2.mutations.json.
All runs had no runner/unhandled errors; no not_applied result is counted.

| Mutation | Tests failed / executed | Exit | Classification |
| --- | --- | --- | --- |
| R01 only toPath controls exemption | 6 / 45 | 1 | detected |
| R02 only fromPath controls exemption | 5 / 45 | 1 | detected |
| R03 either endpoint is sufficient | 6 / 45 | 1 | detected |
| R04 explicitly allow contract moves | 2 / 45 | 1 | detected |
| R05 explicitly allow approval moves | 1 / 45 | 1 | detected |
| R06 some passing duplicate masks failures | 4 / 45 | 1 | detected |
| R07 ignore command mismatch | 1 / 45 | 1 | detected |
| R08 ignore missing required check | 3 / 45 | 1 | detected |
| R09 remove A blocking-approval guard | 3 / 9 | 1 | detected |
| R10 restore forged state cache instead of replay | 1 / 19 | 1 | detected, TEST ORACLE ONLY |
| R11 remove global evidence name uniqueness | 6 / 45 | 1 | detected |
| R12 exempt coordination deletions | 1 / 45 | 1 | detected |

Thus each of RT-01, RT-03 and RT-06 has a demonstrated red regression test after removing its guard.
R10 does not claim a production persistence fix: there is no such adapter in scope.
All disk source hashes matched the pre-transform originals afterward; then unmutated typecheck and
the full suite passed again, followed by fresh remote verification.

To reproduce one mutation after npm ci at 811ed0d, with this evidence artifact available,
run the following PowerShell from the repository root (exit 1 with failed tests is expected):

~~~powershell
$env:FORGE_MUTATION = 'R01-to-only'
@'
import {readFileSync} from 'node:fs';
const evidence = JSON.parse(readFileSync('forge/reviews/FORGE-CORE-0001B.v2.mutations.json', 'utf8'));
const entry = evidence.mutations.find(x => x.config.id === process.env.FORGE_MUTATION);
if (!entry) throw Error('Unknown mutation');
await eval(evidence.runnerTemplate.replace('CONFIG', JSON.stringify(entry.config)));
'@ | node --input-type=module
exit $LASTEXITCODE
~~~

Raw source hashes depend on checkout line endings; replacement/application count and test assertions
remain the evidence of application. Do not classify a replacement failure as detected.

## 8. Contract/implementation matrix

| Requirement | Implemented / checked |
| --- | --- |
| B2-01 exact allowlist | Git diff against B-contract commit: exactly its 11 permitted files |
| B2-02 strict rename data shape | ChangedFileSchema malformed variants + compile-time cases |
| B2-03 protected moves in both directions | repair-v2 paths table; R01–R05 |
| B2-04 coordination boundaries | nested positive; root/coordinationX/normal negative |
| B2-05 invalid endpoint paths | ../, backslash, doubled slash, Unicode lookalikes in both endpoints |
| B2-06 delete/protected/add/modify | deletion/whitelist/coordination tables; R12 |
| B2-07 endpoint uniqueness | self rename, chain, normal/rename overlap, exact issue paths |
| B2-08 required checks | duplicate same/conflicting, both orders, missing/wrong/failed; R06–R08/R11 |
| B2-09 extra checks | unique extra failure informational; duplicate extras rejected |
| B2-10 log/state admission | malformed evidence rejected without append; valid forbidden rename yields failed |
| B2-11 deterministic/frozen/non-mutating | exact sorted failures, deep-freeze and cloned-input assertions |
| B2-12 log authority | JSON log replay ignores forged cached state; R10 |
| B2-13 checks/fresh clone | Commands and results in section 5 |
| B2-14 differential | 9,000 events; gates unchanged; zero differences |
| B2-15 mutation evidence | All 12 applied once and detected, with separate test-oracle label |
| B2-16 isolated A / RT12 unchanged | Nine patch tests, Red-Team regression, no proxy production change |

No known implementation deviation from the new contracts. The limitations below are explicitly
contracted boundaries, not claimed repairs.

## 9. Remaining boundaries and independent-review points

1. **Sidecar registration:** B-v2 is additive; the existing kernel canonical contractPath remains
   forge/contracts/FORGE-CORE-0001B.md. The v2 sidecar metadata parses but is not automatically
   registrable under its physical path. Future registration needs an explicit artifact migration.
   No v1 overwrite, path-resolver change or fictional observed contract was used here.
2. **Historical data:** old single-path rename and duplicate-check logs fail the new schema.
   No missing endpoint is invented, and no automatic upgrader or historic log rewrite exists.
3. **RT-10:** only the log is authoritative. applyEvent accepts kernel-produced/replayed states;
   forged structural state objects remain outside the trust boundary. No authenticity guard added.
4. **RT-12:** proxies/throwing getters are executable JavaScript, outside JSON/validated log data.
   No new totality guarantee, sandbox or catch-all fix.
5. **PERF:** replay/projection complexity and full state cloning remain V0.0 limits. No optimization.
6. **B22:** claimedResultCommit/verifiedCommit equivalence applies only to valid kernel-produced/replayed
   states, where successful verification enforces equality. Not a claim about forged state objects.
7. **R11:** empty diff and result commit equal to start commit remain permitted.
8. **Verification trust:** evidence completeness and remote observations are supplied by the verifier;
   this repair adds no Git reader or authentication system.
9. **Windows byte fidelity:** hashed contract fixtures require LF checkout; the path fix does not
   relax canonical-document requirements.
10. **Review focus:** inspect strict union/cardinality issues, both scope endpoints, schema versus direct
    evaluator boundary, approval rejection precedence, independent model implementation and the sidecar
    limitation. Verify mutation replacements actually match and review the TEST ORACLE label on R10.

Claude's coordination checkpoint CP9 / be40a6876aaba328d91c2ef1bbba0bc4263cfe3d was read as information
about the separate Mystery review. Nothing from it was merged or implemented; CLAUDE.md was not edited.
The repair branch remains separate from main. After pushing this documentation, verify the remote HEAD
and that 811ed0d and both contract commits are ancestors; the tested code SHA remains 811ed0d.
