# Exact repair patches

Scope: specification-only patch set. No production implementation.

| Contract | Section | OLD | NEW | Finding | Reason | Version impact |
|---|---|---|---|---|---|---|
| MYST-SESSION-0001A/B/C | Startgate + §2 PlayerRef | MYST-0001 described as secondary/unknown; PackageRefSource profile:string and resolve EntityRef\|null. | Pin MYST-0001 v1 contentHash f4d3185898015901fad3155fdc37836652c486b028b30528ca4beb17f3726335; profile exactly forge-mystery-playerref-v1; saltHex is the exact refSalt; construct adapter only from buildPlayerRefIndex; no authorization is implied by resolution. | F01 | Uses existing M1 semantics; closes availability and adapter ambiguity. | Session revision |
| MYST-0004 / MYST-0005B | PlayerRef references | Reference to a secondary MYST-0001 draft. | Pin MYST-0001-PLAYERREF-V1 and its v2 content hash; no alternate derivation. | F01 | Prevents divergent PlayerRef profiles. | Text revision |
| MYST-SESSION-0001A | §2 release→proof adapter | UNKNOWN/BLOCKER; certificateData bounded JSON only. | Conditional on D9: owner SA §2; adapterVersion forge-release-proof-v1; steps bind witnessStepIds to SessionEvents; only replayed byte-bound releases may produce ReleasedObservations; OBSERVED requires explicit authored licenseRuleId; REPORTED_BY_NPC only affirms/denies; uncertain/leans/dnk/decline produce no Boolean premise; literals explicitly authored; first-match aliases forbidden; PUBLIC_RULE has explicit release receipt and cannot self-license. | F02 | Formalizes already-required M4/M5B→SOL semantics without NPC-says-P=>P or Evidence-supports-P=>P. | SA major revision; OPEN pending D9 |
| MYST-SESSION-0001A/B/C | §2 CasePackageInput / identity | No bound owner for brief/question/rule/labels. | Add strict publicContent owned by SA: title, brief, challengeQuestion, labels, questionTexts, publicRules. Add publicContentHash to releaseContextHash/packageHash and save invalidation. Public output uses PublicContent plus Known; never derives roster/brief from Truth. | F03 | Binds all player-visible authored semantics without a hash cycle. | Session revision |
| Vitrine + SA status | Win condition | requireReleasedProof:true and accuse actor+evidenceRefs; Session says no proof gate. | Conditional on D8 recommendation: remove proof receipt as technical victory gate; UI expands one selected person into four fixed direct_actor literals; solved iff Challenge wrapper solved; evidence remains deduction material. | F04 | Only owner can choose gameplay win condition. | Case revision + Session text; OPEN pending D8 |
| MYST-0002 FINAL-CANDIDATE | §15 allowedClaims | allowedClaims is never a Required-only whitelist. | allowedClaims contains claims without winning polarity; forbid secret/answer-derived candidate selection, but allow equality with Required claim keys when dimensions were publicly fixed before answer choice; CH §6 owns publication check. | F05 | Reconciles delegated M2 wording with Challenge exactness. | M2 revision |
| MYST-CHALLENGE-0001 | §6 role question | All three role claims per candidate implied for every role question. | All three only for open/all-roles question; a publicly fixed single role/yes-no dimension uses required_literals over all public candidates for that dimension. | F05 | Keeps scope answer-independent while allowing the Vitrine's narrow question. | CH revision |
| MYST-0005B | §6 persistence | Persist {type:ask,npc,questionId}. | Accepted interrogation persists {type:interrogate,npc,questionId}; rejection is not persisted; ask is legacy scratch only. | F06 | Session B owns persistent event vocabulary. | M5B revision |
| MYST-SESSION-0001A/B | §2 refs + SB §5 ports | pkg.refs passed directly; prefix KnownEntity passed as known. | Expose refs caseId/truthHash/refFor/resolve with resolved branded kind/id; M4 gets translator; M5B gets canonical EntityRef[] resolved from prefix known with kind/inverse validation; mismatch is HOST_FAILURE. | F07 | Exact consumer translation; resolution remains distinct from authorization. | Session revision |
| MYST-0002 FINAL-CANDIDATE | §5.1 AC-05/06 | No throw for any unknown claim including hostile JS objects. | No-throw promise is for supported Plain-JSON values/non-throwing data objects; proxies, throwing accessors, cycles and foreign executable objects are outside interface; host exceptions remain HOST_FAILURE. | F08 | Aligns promise with actual untrusted JSON boundary, no sandbox claim. | M2 revision |
| MYST-SESSION-0001A/B/C | size/replay clauses | Full prospective envelope serialization/deep copy for each accepted event. | Normative requirement is exact canonical byte length + atomic immutable observable result, not prefix reserialization/copy. Permit structural sharing/private working state. Exact length B0 + sum canonical event bytes + separators; final encode still replays and serializes complete body. | F09 | Removes normative quadratic work only; no premature optimization or new persistent cache. | Session revision |
| MYST-SESSION-0001C | §8 player load facade | Trusted decoder error union could escape transport. | Player facade maps every failed load/replay to exactly {ok:false,code:SAVE_UNAVAILABLE}; eventIndex/checksum/component/Zod/ID/proof details private; HOST_FAILURE never becomes not_solved. | F10 | Closes error non-interference boundary without changing decoder semantics. | SC revision |
| Vitrine certification gate | Release readiness | Historic scratch witness treated as if it could satisfy current chain. | Current Vitrine release requires migrated M4/M5B/Session shapes, current M1 refs, bound PublicContent, current Proof Profile, real reducer replay and save/load certification. This is a post-contract-freeze release gate, not a freeze prerequisite. | F11 | Breaks the false freeze cycle while retaining the safety gate. | No contract semantic version; release certification required |

## Release → proof non-factivity invariant

The patched boundary is deliberately one-way and typed:

Evidence/NPC release → PlayerKnowledge observation → authored Proof premise → Challenge/Solvability.

Neither implication exists:

- NPC says P ⇒ P true.
- Evidence supports P ⇒ P true.

REPORTED_BY_NPC records the report. OBSERVED requires an explicit authored factivity license bound to the exact replayed payload and public rule. Proof edges require explicit licensed rules. Canonical Truth remains private authority.

## Package DAG

Truth/Solution/NPC/access/presentation/interrogation/challenge/initial/PublicContent + trusted PlayerRef mapping feed component hashes; component hashes feed releaseContextHash/packageHash. PlayerRef preimage binds truthHash, not packageHash. Therefore there is no hash cycle.
