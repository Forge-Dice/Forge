# Regression evidence

Method: textual/model replay against the reconciled contract model only; no production code exists for these proposed revisions. Original attacks are extracted verbatim from the persisted Independent Freeze Verification.

## Original 50 attacks replay

| # | Attack | Result after repair model | Basis |
|---:|---|---|---|
| 1 | Andere Ref-Preimage-Trennung/Encoding wählen. | CLOSED | repaired/original contract boundary |
| 2 | PlayerRefs mit finalem packageHash statt truthHash erzeugen. | CLOSED | repaired/original contract boundary |
| 3 | Salt bei jeder Packageänderung rotieren statt beibehalten. | CLOSED | repaired/original contract boundary |
| 4 | Globale Refkollision still reindexieren. | CLOSED | repaired/original contract boundary |
| 5 | Salt ändern, tatsächliches Mapping gleich lassen und empty save laden. | CLOSED | repaired/original contract boundary |
| 6 | Freies validiertes Ref genügt als Berechtigung. | CLOSED | repaired/original contract boundary |
| 7 | Found Evidence direkt als Truth/Playerkarte ausgeben. | CLOSED | repaired/original contract boundary |
| 8 | Evidence.source automatisch zum Fundort machen. | CLOSED | repaired/original contract boundary |
| 9 | Initial bekannte Evidence sofort releasen. | CLOSED | repaired/original contract boundary |
| 10 | Report.claim referenzierte Entity automatisch known machen. | CLOSED | repaired/original contract boundary |
| 11 | Source=observation ohne Zertifikat zu OBSERVED machen. | STILL OPEN | D9/F02 |
| 12 | Zertifikat nach Reportindex statt vollständigem Payload matchen. | STILL OPEN | D9/F02 |
| 13 | Wahr passenden Claimalias per first-match Proposition auswählen. | STILL OPEN | D9/F02 |
| 14 | NPC affirms nach Lesen interner knowledge als faktiv nehmen. | CLOSED | repaired/original contract boundary |
| 15 | Leans_affirms als Report=true im Solvabilityport codieren. | STILL OPEN | D9/F02 |
| 16 | Konfliktreports durch latest writer überschreiben. | CLOSED | repaired/original contract boundary |
| 17 | Unreleased expected profile.observations als replay roots zurückgeben. | CLOSED | repaired/original contract boundary |
| 18 | Alle PUBLIC_RULE-Instanzen mit Täteryield initial veröffentlichen. | STILL OPEN | D9/F02 |
| 19 | Proofseed direkt aus Evidence.links erzeugen. | CLOSED | repaired/original contract boundary |
| 20 | True earlier presence zum direct_actor-Beweis erklären. | CLOSED | repaired/original contract boundary |
| 21 | Core-solved als Player-solved ausgeben. | CLOSED | repaired/original contract boundary |
| 22 | Undetermined zu false umschreiben. | CLOSED | repaired/original contract boundary |
| 23 | Extra true literal außerhalb Scope akzeptieren. | CLOSED | repaired/original contract boundary |
| 24 | Negatives Required durch Abwesenheit/ähnliche Claims ersetzen. | CLOSED | repaired/original contract boundary |
| 25 | Required-only Scope für vorgewählte Ja/Nein-Frage erlauben. | CLOSED | repaired/original contract boundary |
| 26 | Vier direct_actor-Claims statt zwölf Rollenclaims authoren. | CLOSED | repaired/original contract boundary |
| 27 | Öffentliche Kandidaten nach tatsächlichen Assignments filtern. | CLOSED | repaired/original contract boundary |
| 28 | Zusätzliche wahre, bestimmte in-scope Claims akzeptieren. | CLOSED | repaired/original contract boundary |
| 29 | Vitrine schon vor Belegen mit korrekter vollständiger Antwort lösen. | STILL OPEN | D8 |
| 30 | Saveevent Befragung als ask statt interrogate speichern. | CLOSED | repaired/original contract boundary |
| 31 | Wiederholte leere Suchen oder decline/dnk nicht loggen. | CLOSED | repaired/original contract boundary |
| 32 | Nach solved weiteres Event ignorieren und log abschneiden. | CLOSED | repaired/original contract boundary |
| 33 | Beim zweiten fehlgeschlagenen Release ersten Fund behalten. | CLOSED | repaired/original contract boundary |
| 34 | Received NPC report einmal deduplizieren statt pro Gespräch erfassen. | CLOSED | repaired/original contract boundary |
| 35 | Raw pkg.refs direkt an M4/M5B geben. | CLOSED | repaired/original contract boundary |
| 36 | PlayerKnown refs direkt als InterrogationInput.known verwenden. | CLOSED | repaired/original contract boundary |
| 37 | Initialsuspects aus Truthpersons statt initialKnown/publicRoster bauen. | CLOSED | repaired/original contract boundary |
| 38 | Karten in canonical found-ID-Reihenfolge emittieren. | CLOSED | repaired/original contract boundary |
| 39 | Questiontext ändern, Identity gleich lassen. | CLOSED | repaired/original contract boundary |
| 40 | Public law negieren oder Roster ändern, neues Package nicht erzeugen. | CLOSED | repaired/original contract boundary |
| 41 | Falschen npc provenance/asOf ändern, Package gleich lassen. | CLOSED | repaired/original contract boundary |
| 42 | Proof/Witnessarrays pauschal als Mengen sortieren. | CLOSED | repaired/original contract boundary |
| 43 | Saveevents mit Truth-Mengenserializer sortieren. | CLOSED | repaired/original contract boundary |
| 44 | Nichtkanonisches SaveJSON mit doppelten Keys akzeptieren. | CLOSED | repaired/original contract boundary |
| 45 | Gültigen Verlauf editieren/rechecksummen, trotzdem laden. | CLOSED | repaired/original contract boundary |
| 46 | Jeden bisherigen Prefix für Prospective-Savebytes neu serialisieren. | CLOSED | repaired/original contract boundary |
| 47 | Beim Replay intern append und frozen subtrees teilen. | CLOSED | repaired/original contract boundary |
| 48 | Werfenden Getter bei M2 unknown claim safeParse durchlassen. | CLOSED | repaired/original contract boundary |
| 49 | Detaillierten Loadcode/eventIndex an Spieler schicken. | CLOSED | repaired/original contract boundary |
| 50 | Drei Session-Semantiktexte unabhängig korrigieren. | CLOSED | repaired/original contract boundary |

Summary: 44/50 closed or safely contained; 6/50 still conditional. The remaining six attack instances collapse to exactly two unresolved findings: F02/D9 (#11, #12, #13, #15, #18) and F04/D8 (#29).

## 30 targeted regression attacks

| # | Regression | Result | Reason |
|---:|---|---|---|
| 1 | Use M1 token from another truth with same salt | BLOCKED | truthHash is in preimage and package refs binding |
| 2 | Resolve syntactically valid unknown PlayerRef | BLOCKED | constant unresolved result; no existence oracle |
| 3 | Use resolved but not Known person in interrogate | BLOCKED | resolution != authorization; prefix Known required |
| 4 | Expose canonical entity ID in evidence card | BLOCKED | public boundary uses PlayerRef only |
| 5 | Copy VisibleRef and reuse after projection call | BLOCKED | VisibleRef authorization is object-identity/call-local |
| 6 | Change question text by one character and load old save | BLOCKED | publicContentHash changes package identity |
| 7 | Change publicRules text and retain packageHash | BLOCKED | publicContent is hash-bound |
| 8 | Build initial roster from truth.persons | BLOCKED | PublicContent+Known only |
| 9 | Promote EvidenceReport because source=observation | BLOCKED | OBSERVED needs explicit authored factivity license |
| 10 | Promote Evidence.links into proof truth | BLOCKED | links are not factivity licenses |
| 11 | Promote NPC affirms to canonical fact | BLOCKED | REPORTED_BY_NPC is report, not truth |
| 12 | Promote NPC uncertain/leans to Boolean root | BLOCKED | adapter excludes non-binary stances |
| 13 | Resolve conflicting NPC reports by last writer | BLOCKED | both source-bound observations retained |
| 14 | Use expected proof-profile observation not released in replay | BLOCKED | profile is comparison target only |
| 15 | Self-license a PUBLIC_RULE premise | BLOCKED | rule release must precede licensed inference and cannot self-license |
| 16 | Alias claim by first proposition match | BLOCKED | explicit authored literal binding required |
| 17 | Required-only scope chosen from hidden assignments | BLOCKED | answer-dependent publication forbidden |
| 18 | Fixed public yes/no dimension equals Required keys | ALLOWED | CH publication rule permits answer-independent fixed dimension |
| 19 | Persist interrogation as ask | BLOCKED | interrogate is sole V1 accepted event token |
| 20 | Pass KnownEntity records to M5B known | BLOCKED | canonical EntityRef[] required |
| 21 | Re-serialize every full prefix to enforce size | NOT REQUIRED | exact byte formula is normative; quadratic strategy not required |
| 22 | Use structural sharing in replay | ALLOWED | observable immutability preserved |
| 23 | Throwing getter reaches M2 from raw JS | OUT OF INTERFACE | untrusted runtime boundary is bounded JSON |
| 24 | Expose CHECKSUM_MISMATCH to player | BLOCKED | SAVE_UNAVAILABLE facade |
| 25 | Expose replay eventIndex to player | BLOCKED | private diagnostics only |
| 26 | Use historic Vitrine scratch witness as current certification | BLOCKED | release gate requires current-contract witness |
| 27 | Freeze contracts before current Vitrine runtime witness exists | ALLOWED | witness is post-freeze release gate; avoids dependency cycle |
| 28 | Correct full accusation before collecting proof receipts | PENDING D8 | owner must choose Vitrine win condition |
| 29 | Create ReleasedObservation from replay under SA-owned adapter | PENDING D9 | owner must assign adapter/PublicContent norm owner |
| 30 | Change PlayerRef salt but keep save compatible | BLOCKED | refsHash/package identity changes |

Summary: 28 regressions have a deterministic repaired result; 2 are intentionally pending the two owner decisions. No regression requires a new Mystery architecture.
