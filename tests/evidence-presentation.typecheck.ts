// Compile-time tests: checked by `npm run typecheck`, never executed.
// Each @ts-expect-error fails the typecheck if the line below it becomes valid.

import type { CaseTruth } from "../src/domain/case-truth.ts";
import type {
  EvidenceObservation,
  EvidencePresentation,
  EvidencePresentationInput,
  PlayerClaim,
  RefKind,
} from "../src/domain/evidence-presentation.ts";
import { parseEvidencePresentation } from "../src/domain/evidence-presentation.ts";
import { hashEvidencePresentation } from "../src/domain/evidence-presentation.identity.ts";

declare const input: EvidencePresentationInput;
declare const truth: CaseTruth;
declare const presentation: EvidencePresentation;
declare const observation: EvidenceObservation;
declare const claim: PlayerClaim;

// Only bound parsing produces an EvidencePresentation
// @ts-expect-error a plain object is not an EvidencePresentation
const plain: EvidencePresentation = { schemaVersion: 1, caseId: truth.caseId, truthHash: "", entries: [] };
// @ts-expect-error authoring input lacks the brand
const unparsed: EvidencePresentation = input;
// @ts-expect-error hashing only accepts parsed presentations
hashEvidencePresentation(input);

// Ref kinds
// @ts-expect-error propositions never get a PlayerRef
const proposition: RefKind = "proposition";

// The observation carries no canonical or hidden data
// @ts-expect-error no id
observation.id;
// @ts-expect-error no description
observation.description;
// @ts-expect-error no links
observation.links;
// @ts-expect-error no truth
observation.truth;
// @ts-expect-error no source at top level
observation.source;
// @ts-expect-error player claims use refs, not personId
claim.personId;
// @ts-expect-error observations are readonly
observation.text = "x";
// @ts-expect-error parsed documents are readonly
presentation.entries[0]!.text = "x";

// Positive control
const parsed: EvidencePresentation = parseEvidencePresentation(input, truth);
const hash: string = hashEvidencePresentation(parsed);
const kind: RefKind = "evidence";
