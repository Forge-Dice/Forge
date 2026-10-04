# FORGE HIGH-CONFIDENCE ORACLE V2 REPORT

**Repository:** Forge-Dice/Forge  
**Canonical code:** STRICT READ-ONLY  
**Main observed at lab start:** `3d7545d843883418348004e68717399a64da7a7d`  
**Verdict:** **GO AS DIFFERENTIAL ORACLE**  
**Execution Isolation:** **SEPARATE / NOT CERTIFIED BY THIS LAB**

## 1. Scope and source binding

Oracle V2 is intentionally small and independent. It covers only: Git/history admissibility, canonical diff, path/mode safety, exact scope, test inventory, mutation outcome classification, and repository-layout facts required to disable replacement/graft/alternate/shallow ambiguity. It does not certify review/workflow correctness or untrusted execution isolation.

Read sources:
- Independent Verifier Reference — `forge/owner/audits/FORGE-VERIFIER-REFERENCE` @ `2062fca5162b12b99b77e814255d59c399c53c7d`
- Reference Oracle Quality — `forge/owner/audits/reference-oracle-quality` @ `83214206fced70a97babca9dff7bb137b60ea64a`
- A/B/C minimum verifier contracts — `forge/owner/audits/FORGE-MINIMUM-VERIFIER-IMPLEMENTATION` @ `bb525bfd230128d3d98f3db744ba23217196c53c`
- A/B/C independent certification — `forge/owner/audits/VERIFIER-ABC-INDEPENDENT-CERTIFICATION` @ `b854b11379b5cb43c3d6bc77fedacde7e96511fd`
- Bootstrap Experimental Report — `forge/owner/audits/FORGE-V0.1-BOOTSTRAP` @ `da9b3d51398819db3d03af59582e1b1da3750728`
- current `main` — `3d7545d843883418348004e68717399a64da7a7d`

No A/B/C targeted-repair branch was available when this lab ran. Therefore every contract-dependent resolution is marked `contractSensitive=true` and is bound to the currently available A/B/C drafts/certification. A later repaired revision must re-pin or re-derive those expectations; it must not silently inherit them.

## 2. Independence model

The prior Reference uses path maps and a full Reference-specific profile. Oracle V2 deliberately uses different structures:
- canonical diff: sorted sequences + two-index merge join;
- path/tree safety: per-entry lexical validation plus case/prefix collision scan, not Reference display-path logic;
- scope: explicit allowed `(path, operation)` membership with protections evaluated independently;
- inventory: structured relational identities `(project, ancestors, title, occurrence)`, not title/fullName matching;
- history: direct first-parent walk from HEAD to BASE with exact parent-count, depth, reachability, intermediate-scope, and nonempty-end-diff predicates;
- mutation: explicit decision table over anchor-count, timeout, signal, exit code, exact named failures and unexpected failures.

No expected outcome is generated from the Reference. High-confidence provenance is exclusively `CONTRACT_DERIVED`, `PROPERTY_DERIVED`, or `HAND_AUTHORED_GOLDEN`.

## 3. Sixteen Reference divergences

| ID | Golden input | Golden expected | Reference actual | Normative source | Root cause | Classification |
|---|---|---|---|---|---|---|
| D01 | segment contains space: src/a b.ts | REJECT / PATH_UNSAFE | PASS | FORGE-BOOTSTRAP-0001A current path grammar + Quality Report §10 | Reference accepts old Unicode/space profile instead of current V0.1 grammar | REFERENCE BUG |
| D02 | non-ASCII UTF-8 path: src/café.ts | REJECT / PATH_UNSAFE | PASS | FORGE-BOOTSTRAP-0001A current path grammar + Quality Report §10 | Reference retains permissive Unicode path profile | REFERENCE BUG |
| D03 | segment contains @: src/a@b.ts | REJECT / PATH_UNSAFE | PASS | FORGE-BOOTSTRAP-0001A current path grammar + Quality Report §10 | Reference retains permissive @ grammar | REFERENCE BUG |
| D04 | segment begins with hyphen: src/-a.ts | REJECT / PATH_UNSAFE | PASS | FORGE-BOOTSTRAP-0001A current path grammar + Quality Report §10 | Reference retains old leading-hyphen profile | REFERENCE BUG |
| D05 | ADD forge/coordination/x.md absent from scope.create | REJECT / SCOPE_VIOLATION | PASS | FORGE-BOOTSTRAP-0001B exact-scope semantics; Quality Report §4/§10 | Legacy coordination exception overrides exact scope | REFERENCE BUG |
| D06 | anchor=1, timeout=false, exit=2, named AssertionError only | REJECT / INFRA_FAILURE | KILLED | FORGE-BOOTSTRAP-0001B Required Verifier Mutation B3; Quality Report §5 | Reference treats generic nonzero exit as kill | REFERENCE BUG |
| D07 | anchor=1, signal=-9, AssertionError witness | REJECT / INFRA_FAILURE | KILLED | FORGE-BOOTSTRAP-0001B mutation outcome semantics; Quality Report §5 | Signal termination accepted as semantic kill | REFERENCE BUG |
| D08 | target named assertion plus additional unnamed failed test | REJECT / INFRA_FAILURE | KILLED | FORGE-BOOTSTRAP-0001B full inventory/mutation witness ; Quality Report §5 | Reference ignores additional failing identity | REFERENCE BUG |
| D09 | target witness contains AssertionError and TypeError | REJECT / INFRA_FAILURE | KILLED | FORGE-BOOTSTRAP-0001B B3; Quality Report §5 | Reference sees assertion presence but fails to exclude infra error | REFERENCE BUG |
| D10 | same title but wrong ancestor/test identity | REJECT / INFRA_FAILURE | KILLED | FORGE-BOOTSTRAP-0001B exact inventory identity; Quality Report §5 | Reference matches title too weakly | REFERENCE BUG |
| D11 | patch bytes=ababa, anchor=aba (two overlapping occurrences) | REJECT / NOT_APPLIED | KILLED | A/B mutation exact-once requirement; Quality Report §5 | bytes.count-style non-overlap count misses overlapping second anchor | REFERENCE BUG |
| D12 | new HEAD above BASE has two parents | REJECT / HISTORY_PARENT_COUNT | PASS | FORGE-BOOTSTRAP-0001A Acceptance: second parent forbidden only above BASE | Reference tests reachability but lacks one-parent guard | REFERENCE BUG |
| D13 | intermediate commit changes protected/config path, later commit reverts it | REJECT / INTERMEDIATE_SCOPE | PASS | FORGE-BOOTSTRAP-0001A/B history + exact-scope boundary; Quality Report §6 | Reference relies on net end diff and misses forbidden intermediate state | REFERENCE BUG |
| D14 | BASE == HEAD | REJECT / EMPTY_HISTORY | PASS | Quality Report §6 current A history semantics | Reference accepts zero new commits | REFERENCE BUG |
| D15 | one or more new commits but final canonical diff is empty | REJECT / EMPTY_END_DIFF | PASS | Quality Report §6 current A history semantics | Reference equates reachable history with admissible nonempty change | REFERENCE BUG |
| D16 | 129 commits strictly above BASE | REJECT / HISTORY_LIMIT | PASS | FORGE-BOOTSTRAP-0001A history bound; Certification F03 notes 129 boundary | Reference omits/enforces wrong commit-count bound | REFERENCE BUG |

All **16/16 are resolved against the current draft-bound normative sources**. None is resolved by majority vote. Because repair artifacts were unavailable, these resolutions remain contract-sensitive to the pinned draft revision.

## 4. Second-parent and history boundary

Normative boundary derived from A: **e�|r����ƭy