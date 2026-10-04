# Session A §2 — targeted normative annex, revision candidate v2

Owner: MYST-SESSION-0001A. Adapter: `forge-release-proof-v1`. This is contract text for review/integration, not a registered implementation contract or an implemented API. It replaces the unresolved certificateData boundary; Session B owns accepted events/replay and Session C owns saves. D8/D9 are accepted by the current Owner instruction. The remaining Master B.2/B.7–B.12 repairs retain their owners and are not silently implemented here.

## 1. Strict data and authority

`CasePackageInput.publicContent:unknown` is parsed into `PublicContent`; `ResolvedCasePackage.publicContent:PublicContent` is immutable. Strict PublicContent:

```ts
{
 schemaVersion:1;
 title:string; brief:string; challengeQuestion:string;
 labels:readonly {entity:EntityRef; label:string; role:string|null}[];
 questionTexts:readonly {npc:string; questionId:string; text:string}[];
 publicRules:readonly {id:string; text:string}[];
}
```

Texts follow MYST-0004 PlayerText T2–T6, without normalization; max 1000 UTF-16 units, brief max 4000. Labels: max 256, entity unique and existing. Question texts: exactly one per existing `(profile.npcId, rule.questionId)`, no duplicate/unassigned pair; max 2048. Public rules: max 64, unique neutral ASCII IDs `[a-z][a-z0-9:_-]{0,63}`. Only this component owns public title, briefing, question, label, role and rule prose. Player output is constructed from PublicContent and prefix-Known. It never enumerates Truth persons/locations or reads Truth names/descriptions to fill gaps. Labels for unknown entities are omitted. Public rule/brief/question prose must be reviewed for release-phase consistency: it may not name an unreleased entity indirectly. Exact IDs and text bytes, including rule meanings and question texts, are identity-bound.

All publicRules are static authored public laws visible at initial presentation; their text must not contain private graph IDs, hidden answer polarities, hidden case assignments or unreleased names. An instance license below becomes eligible only after its explicit observed inputs. Its private descriptor is interpreted as an instance of this public law. Human review must verify that the text really licenses that exact body and conclusion, including negation, person, time and role. A rule ID by itself is not a semantic license. This is the finite case-specific formalization already required by SOL, not automatic semantic understanding of prose.

`releaseManifest` retains exactly `{schemaVersion:1,releaseContextHash,adapterVersion,certificateData}`. `adapterVersion` is exactly `"forge-release-proof-v1"`. CertificateData is this strict shape:

```ts
{
 schemaVersion:1;
 steps:readonly {stepId:string; event:SessionEvent}[];
 observations:readonly PremiseMap[];
}
```

`steps`: 0..256 ordered entries, unique SOL-local-format stepId; each profile.witnessStepIds entry exactly once and in the same order; no extra unused step. Each event is exactly Session B §4, no `ask`, `read_record`, input seq, proof receipt or canonical-ID alias. Events use this package's real PlayerRefs; initial proof-only step shortcuts are forbidden. The map is private authoring data, not executable code, not a host callback, not a public endpoint.

`observations`: 0..64, IDs unique, exact coverage of profile.observations. Each entry refers to exactly one same-ID expected ReleasedObservation and has its identical kind and literal/entity/rule payload. No unbound `approved`, `reachable`, truth or status field. Profile expectations describe the catalog; they never manufacture releases.

## 2. Exact finite selectors

Each entry is one of the following; all objects strict. Entity and literal IDs remain private and refer to the same bound T/S. `PlayerReport`, `PlayerClaim` and `SessionEvent` mean the existing current contracts' types, without new aliases.

| PremiseMap kind | Exact fields in addition to id/kind | Meaning |
|---|---|---|
| OBSERVED | `literal:PropositionLiteral; source:{kind:"evidence";evidenceId}; alternatives:readonly {report:PlayerReport;licenseRuleId:string}[]` | One released report from exactly this evidence, with an explicit factivity law. Every alternative retains the same source and same literal. |
| REPORTED_BY_NPC | `npcId; literal:ProofLiteral; alternatives:readonly ReportSelector[]` | The source's report occurred, without asserting that its content is true. |
| ENTITY_AWARENESS | `entity:EntityRef` | That entity is in replay-derived prefix-Known. Never a proposition/role seed. |
| PUBLIC_RULE | `ruleId:string; afterObservations:readonly ObservationId[]; rules:readonly PublicRuleDescriptor[]` | Exact existing SOL descriptors bound to an actually displayed PublicContent law and its qualified private instance receipt. |

Every alternatives list has 1..16 unique entries, compared using C; it is OR over exact **source selectors**, not a new logical rule operator. All alternatives produce the same ReleasedObservation. Different evidence sources require different OBSERVED IDs and existing SOL nodes/edges; substituting a source under the same root is forbidden. Independent proof routes are represented by SOL's already-existing licensed edges. No alternative may be inferred from Evidence.links or descriptions.

ReportSelector is strictly either:

```ts
{kind:"npc"; questionId:string; claim:PlayerClaim; stance:"affirms"|"denies"}
| {kind:"testimony"; evidenceId:string; report:PlayerReport}
```

For an NPC selector, npcId resolves to the exact emitting NPC; questionId is assigned to that NPC profile; a replayed ObservationRecord.source must name the same NPC, question and accepted eventIndex. The payload must be `act:"answer"`, the exact claim and exact affirms/denies stance. Statement and mention closure are validated against the immutable package. Leans_affirms, leans_denies, uncertain, does_not_know and decline remain journal entries but are never Boolean ReportSelectors; attempting to map one is a parse error.

For testimony, the exact replayed evidence record must name evidenceId. The exact report must have source `{kind:"testimony",person:playerRefFor(npcId)}`. The literal value equals `(report.stance === "affirms")`. The NPC must be an existing person; receiving a written report does not require its NPC to have been interrogated. An observation-source report cannot satisfy a testimony selector, nor a different person/evidence satisfy the same source. Received provenance remains in PlayerKnowledge even though SOL's existing REPORTED_BY_NPC root stores only npcId/literal. Changing the evidence selector changes releaseHash.

For OBSERVED, source.kind is evidence only in this adapter revision; initial OBSERVED roots allowed by SOL's general schema are unsupported and fail the adapter parse. Awareness and public laws can be initial. No invented initial observation mechanism is supplied. Each report.source is exactly `{kind:"observation"}`. Its polarity must equal literal.value. licenseRuleId must exist in publicContent.publicRules, be actually displayed in this replay context, and explicitly license this particular observation's factivity. Testimony, raw evidence discovery, labels or NPC knowledge do not satisfy it. Truth consistency is checked separately by SOL against CaseTruth; a valid report receipt alone cannot make a false literal true.

Claim→literal association is explicitly authored, field-complete and validated. For proposition literals, locate the specified proposition ID and compare its existing claim after translating every entity ref via the immutable package mapping. For conclusion literals, locate the specified conclusion ID and do the same. Claim enums, time and role remain exact; comparison never uses only kind/person, first match, loose equality or negation inference. Multiple canonical catalog aliases for a selected structural claim are rejected as ambiguous, even if their current Bool values happen to agree. This is a source/meaning binding check, not a world-truth lookup or automatic extraction. All nine PlayerClaim variants use MYST-0005A statementClaimReferences and existing claim structures; field mapping is person↔personId, location↔locationId, item↔itemId, event↔eventId, causeEvent↔causeEventId, while kind/at/role/value retain their exact values. Correct kind plus exact inverse ref mapping is mandatory. Foreign, stale, noninjective or unknown refs fail privately before replay; resolving a token never grants Known.

For ENTITY_AWARENESS, its exact kind/id must be present through initial known, released Evidence itself or an explicit M4/M5B mention; no traversal of Report.claim, evidence links or NPC private awareness.

For PUBLIC_RULE, descriptors are exactly the existing SOL `{edgeId,allOf,yields}` with referential and license validation from SOL. Every afterObservations ID exists in the same certificate map, refers to a non-PUBLIC_RULE root, and is unique. Empty means initially eligible only if the publicly displayed rule really licenses the specified instance; the Vitrine instances below have nonempty gates. Self-license, rule-to-rule eligibility, private conclusion-status eligibility and implicit proof completion gates are forbidden. Eligibility uses the release receipt set, not canonical answer values. Duplicates and conflicting same-ID payloads fail; no last-writer wins.

## 3. Receipt, binding and evaluation order

A PublicRuleDto is strictly `{id:string,text:string}` copied from publicContent.publicRules, not a raw graph descriptor. Initial PublicContent rendering and rule receipts are a derived public view, not a new PlayerKnowledge ObservationRecord variant, SessionEvent, or save field. The trusted case-abnahme runner owns transient receipts:

```ts
{ ruleId:string; publicPayload:PublicRuleDto;
  publicContentHash:string; releaseContextHash:string;
  prefixEventCount:number; qualifiedObservationIds:readonly string[] }
```

Receipts and qualifiedObservationIds are INTERNAL/QA and never sent to the player. At prefix zero all static public laws receive display receipts with no qualified instance. After each accepted event, map actual M4/M5B records and Known to non-rule roots, then qualify each PUBLIC_RULE instance whose afterObservations are all received at that same prefix. Record the earliest qualifying prefix and exact public payload. Repeated matching reports do not create extra roots, but their journal records remain. Distinct contradictory reports retain distinct IDs and polarities; neither overwrites nor cancels the other. They become world literals only through an explicit authored public SOL edge whose consequence is independently canonically checked.

The runner first resolves the immutable package, selects the bound certificateData and translates the ordered witnessStepIds to its exact SessionEvents. It calls the real replaySession for that package from initialSession; every event must be accepted in order, including terminal behavior. It then traverses actual accepted-prefix outputs/knowledge and PublicContent display receipts as specified. It never returns profile.observations as a canned replay result and never invokes a fixture callback serialized in authored JSON. The callback supplied to SOL is trusted code and returns only the derived ReleasedObservations and exact ProofBindings `{caseId,truthHash,solutionHash,releaseHash}`. Package-level checking remains binding-only and does not run the certificate or assert solvability.

Missing replay implementation/throw → SOL unknown with REPLAY_UNAVAILABLE. Invalid event/witness → INVALID_WITNESS. A catalogued source not actually observed produces no root; SOL reports PREMISE_NOT_REACHED and fails if a required goal cannot be derived. Invalid/missing catalog source, invalid selector, source conflict, duplicate ID, unresolved alias or foreign binding → private parse/binding error, no fabricated root and no player verdict. Exact replay result with unknown/conflicting root payload → INVALID_REPLAY_RESULT/RELEASE_RECORD_MISMATCH under SOL. Technical errors never become not_solved.

Binding DAG remains acyclic. Add publicContentHash = H("forge-session-public-content-v1", PublicContent with labels by kind/id, questionTexts by npc/questionId, publicRules by id). Include publicContentHash in releaseContextHash. releaseManifest binds actual static laws, exact report selectors, step events and instance descriptors via canonical C. All certificateData arrays remain ORDERED under structural C, including steps, observations, alternatives, afterObservations and rules. Reject semantic duplicates as specified, but never sort or deduplicate these arrays for manifest hashing. OR/conjunction can be order-insensitive for eligibility while array permutations still change releaseHash and package identity. This follows the exact R04 registry at package-binding closure commit 7ffa39c86755259b3055603be6894b2deac01a8c; it creates no new SET override. releaseHash = SHA256("forge-session-release-v1\n" + canonical manifest bytes). profile.bindings.releaseHash must match. proofHash uses existing SOL/SA normalization. packageHash includes releaseContextHash/releaseHash/proofHash. Neither manifest nor its hash input contains packageHash/proofHash; no cycle. All text/ref/salt/snapshot/selector/stance/source/license/step/descriptor changes invalidate exact-package saves. No placeholder hash is accepted as certification. Changing authored selector/source/stance data changes releaseHash; changing the adapter interpretation itself requires a fresh adapterVersion, rulesetVersion and package identity under Session compatibility rules. Initial integration revises the unregistered Session contracts together; no legacy scratch save migration is promised.

## 4. Minimal Vitrine instantiation

Retain the existing solution, four-role direct_actor scope, evidence and NPC profiles. Build real MYST-0001 refs with this package's bound nonzero refSalt. The historical scratch refs/hashes are not reusable production identities.

| Existing observation ID | Exact evidence / canonical meaning | Law | Instance gate |
|---|---|---|---|
| observed:hof-contact | d03, p18=true, observation report affirms | rule:certified-sources | actual d03 release |
| observed:max | d04, p03=true, observation report affirms | rule:certified-sources | actual d04 report for Max@hof/240 |
| observed:nora | d04, p04=true, observation report affirms | rule:certified-sources | actual d04 report for Nora@hof/240 |
| observed:oskar | d05, p05=true, observation report affirms | rule:certified-sources | actual d05 report for Oskar@archiv/240 |
| public-rule:max | existing exclude:max descriptor | rule:manual-presence | observed:max |
| public-rule:nora | existing exclude:nora descriptor | rule:manual-presence | observed:nora |
| public-rule:oskar | existing exclude:oskar descriptor | rule:manual-presence | observed:oskar |
| public-rule:remaining | existing remaining:lina descriptor | rule:closed-roster | observed:max, observed:nora, observed:oskar |

The original step IDs remain: search-hof → investigate/search_location(hof); ask-nora-photo → interrogate(nora,q08); read-camera → investigate/examine_item(kamera); ask-oskar-record → interrogate(oskar,q14); read-terminal → investigate/examine_item(terminal). `ask-` in a private step ID is not a legacy event alias. Actual events contain real PlayerRefs. The registry, reverse-map, certificateData, ProofProfile and instance-qualified receipts stay private. Public text retains the existing three authored general laws. The d03 root is not a required proof goal; it enables q08 in this authored witness. There is no new clue or general inference engine.

## 5. Required annex acceptance

A resolver must parse positive and negative fixtures for every selector kind; reject alias/source/binding/stance/duplicate/self-license attacks; compute the acyclic hashes and exact save invalidation; distinguish source missing in a valid witness from malformed authored source. The real case-abnahme runner must demonstrate prefix-derived releases, public-law display receipts, no canned expected roots, source-specific conflicting reports, alternative existing paths, and the independent finite proof checker. The 128-configuration scratch evidence here defines regression cases, not production acceptance. Session B's D8 verdict never reads these receipts or a proof closure.
