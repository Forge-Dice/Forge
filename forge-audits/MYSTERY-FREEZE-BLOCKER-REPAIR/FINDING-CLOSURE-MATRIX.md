# Finding closure matrix

Base: 3d7545d843883418348004e68717399a64da7a7d

| Finding | Source | Affected contracts | Root cause | Normative conflict | Classification | Verdict |
|---|---|---|---|---|---|---|
| F01 | Independent Freeze Verification | M1, M4, M5B, SA/SB/SC | Freeze verifier missed an already-persisted MYST-0001 original; integration text still used secondary/unknown wording. | Artifact completeness vs existing M1 branch. | ALREADY RESOLVED BY ORIGINAL ARTIFACT | CLOSED |
| F02 | Independent Freeze Verification + SOL/CERT | SA + SOL + M4/M5B boundary | No normative owner/type for release replay → ReleasedObservation, PUBLIC_RULE receipt/eligibility and exact authored literal binding. | SOL requires authored factivity/licenses while SA labels the adapter UNKNOWN. | MISSING BINDING / REQUIRES OWNER DECISION D9 | STILL OPEN |
| F03 | Independent Freeze Verification + InfoFlow | SA package identity | Public brief/question/rule/label bytes can change without changing package identity. | Meaningful public gameplay content must not float outside exact-package save compatibility. | MISSING OWNERSHIP | CLOSED |
| F04 | Independent Freeze Verification + Vitrine/CERT | Vitrine + SA/SB | Vitrine requires released proof receipts but Session V1 declares Challenge solved as the sole technical win gate. | Two incompatible win conditions. | REQUIRES OWNER DECISION D8 | STILL OPEN |
| F05 | Independent Freeze Verification + Challenge | M2 + CH | M2 says never Required-only while CH allows publicly fixed answer-independent required_literals questions. | Normative scope publication contradiction. | CONTRACT WORDING DEFECT | CLOSED |
| F06 | Independent Freeze Verification | M5B + SB/SC | M5B persists ask while Session B owns accepted event vocabulary as interrogate. | Two persistent spellings for same accepted event. | CONTRACT WORDING DEFECT | CLOSED |
| F07 | Independent Freeze Verification | SA/SB + M4/M5B | pkg.refs lacked exact translator caseId/truthHash shape and KnownEntity→canonical EntityRef conversion. | Producer/consumer type mismatch. | MISSING BINDING | CLOSED |
| F08 | Cross-Contract + Independent Freeze Verification | M2 | No-throw claim over arbitrary JS unknown overpromises beyond the repository's Plain-JSON trust boundary. | Getter/proxy executable objects conflict with bounded JSON input model. | CONTRACT WORDING DEFECT | CLOSED |
| F09 | Scale + Independent Freeze Verification | SA/SB/SC | Literal contract wording required full prefix copy/serialization on every event. | Normative O(n²) work conflicts with bounded replay freeze criterion. | CONTRACT WORDING DEFECT | CLOSED |
| F10 | InfoFlow + Independent Freeze Verification | SC/player facade | Detailed trusted decode/replay codes had no exact constant public facade. | Private diagnostics could cross player boundary. | MISSING BINDING | CLOSED |
| F11 | Vitrine Certification + Independent Freeze Verification | Vitrine release gate | Historic Vitrine witness uses pre-current refs/presentation/ask/save shapes and is not current-contract certified. | Treating current witness as a contract-freeze prerequisite creates Freeze→implementation→witness→Freeze cycle. | FALSE POSITIVE AS FREEZE BLOCKER; REMAINS RELEASE BLOCKER | CLOSED |

## Owner decisions still required

- **D8 — Vitrine win condition.** Choose Session V1 (correct full answer => solved; evidence is deduction help) or retain a proof-receipt win gate, which requires a separate Session/Challenge policy revision.
- **D9 — Norm owner.** Confirm Release→Proof adapter and PublicContent belong to Session A §2 and that VS-5/TASK-0005 legacy strands are superseded by Session A/B/C and MYST-0005A/B respectively.

No other owner decision is required to close F01/F03/F05/F06/F07/F08/F09/F10/F11 at the contract-freeze layer.
