// Compile-time tests: checked by `npm run typecheck`, never executed.
// Each @ts-expect-error fails the typecheck if the line below it becomes valid.

import type { CaseTruth, CaseTruthInput, LocationId, PersonId } from "../src/domain/case-truth.ts";
import { parseCaseTruth } from "../src/domain/case-truth.ts";
import { serializeCaseTruth } from "../src/domain/case-truth.identity.ts";
import { fullCase } from "./case-truth.fixture.ts";

declare const truth: CaseTruth;
declare const personId: PersonId;
declare const locationId: LocationId;

// AC-15: nested assignments are rejected
// @ts-expect-error root field is readonly
truth.title = "x";
// @ts-expect-error nested object field is readonly
truth.timeline.originLabel = "x";
// @ts-expect-error entity field is readonly
truth.persons[0]!.name = "x";
// @ts-expect-error discriminated union member field is readonly
truth.propositions[0]!.claim.kind = "personAt";
// @ts-expect-error truth value is readonly
truth.propositions[0]!.truth = false;
// @ts-expect-error evidence link field is readonly
truth.evidence[0]!.links[0]!.direction = "refutes";

// AC-15: array mutations are rejected
// @ts-expect-error readonly arrays have no push
truth.persons.push(truth.persons[0]!);
// @ts-expect-error readonly arrays have no sort
truth.events[0]!.participantIds.sort();
// @ts-expect-error readonly array index assignment
truth.secrets[0]!.propositionIds[0] = truth.secrets[0]!.propositionIds[0]!;

// AC-15: different ID types are not interchangeable
// @ts-expect-error LocationId is not a PersonId
const swappedPerson: PersonId = locationId;
// @ts-expect-error PersonId is not a LocationId
const swappedLocation: LocationId = personId;
// @ts-expect-error plain strings are not IDs
const plainId: PersonId = "person:anna";

// AC-16: plain input objects are not snapshots without parsing
declare const input: CaseTruthInput;
// @ts-expect-error authoring input lacks the CaseTruth brand
const unparsed: CaseTruth = input;
// @ts-expect-error serialization only accepts parsed snapshots
serializeCaseTruth(fullCase());

// Positive control: parsing produces a snapshot.
const parsed: CaseTruth = parseCaseTruth(input);

export { swappedPerson, swappedLocation, plainId, unparsed, parsed };
