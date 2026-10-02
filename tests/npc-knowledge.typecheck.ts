// Compile-time tests: checked by `npm run typecheck`, never executed.
// Each @ts-expect-error fails the typecheck if the line below it becomes valid.

import type { CaseTruth, PersonId, PropositionId } from "../src/domain/case-truth.ts";
import type { CaseSolution, ConclusionId } from "../src/domain/case-solution.ts";
import type { AttitudeEntry, NpcKnowledgeInput, NpcKnowledgeSnapshot } from "../src/domain/npc-knowledge.ts";
import { parseNpcKnowledge } from "../src/domain/npc-knowledge.ts";
import type { NpcVisibleContext } from "../src/domain/npc-knowledge.projection.ts";
import { projectNpcKnowledge } from "../src/domain/npc-knowledge.projection.ts";

declare const snapshot: NpcKnowledgeSnapshot;
declare const input: NpcKnowledgeInput;
declare const truth: CaseTruth;
declare const solution: CaseSolution;
declare const context: NpcVisibleContext;
declare const personId: PersonId;
declare const propositionId: PropositionId;
declare const conclusionId: ConclusionId;

// Conclusion knowledge is impossible in the type, proposition knowledge is fine.
// @ts-expect-error knowledge is not a valid stance for conclusions
const conclusionKnowledge: AttitudeEntry = {
  subject: { kind: "conclusion", id: conclusionId },
  stance: { kind: "knowledge", value: true },
  acquiredAt: 0,
  provenance: { kind: "prior_knowledge" },
};
const propositionKnowledge: AttitudeEntry = {
  subject: { kind: "proposition", id: propositionId },
  stance: { kind: "knowledge", value: true },
  acquiredAt: 0,
  provenance: { kind: "prior_knowledge" },
};

// Nominal IDs
const wrongSubject: AttitudeEntry = {
  // @ts-expect-error a PersonId is not a PropositionId
  subject: { kind: "proposition", id: personId },
  stance: { kind: "belief", value: true },
  acquiredAt: 0,
  provenance: { kind: "author_modeled_inference" },
};
// @ts-expect-error a ConclusionId is not a PersonId
const wrongNpc: PersonId = conclusionId;

// Only bound parsing produces a snapshot
// @ts-expect-error authoring input lacks the snapshot brand
const unparsed: NpcKnowledgeSnapshot = input;
// @ts-expect-error the projection only accepts parsed snapshots
projectNpcKnowledge(input, truth, solution);
// @ts-expect-error the solution argument is explicit, not optional
parseNpcKnowledge(input, truth);

// Nested mutations of the snapshot and of the visible context
// @ts-expect-error snapshot root is readonly
snapshot.asOf = 1;
// @ts-expect-error snapshot arrays are readonly
snapshot.attitudes.pop();
// @ts-expect-error nested stance is readonly
snapshot.attitudes[0]!.stance.kind = "belief";
// @ts-expect-error provenance is readonly
snapshot.awareness[0]!.provenance.kind = "prior_knowledge";
// @ts-expect-error context root is readonly
context.asOf = 1;
// @ts-expect-error context arrays are readonly
context.awareness.push(context.self);
// @ts-expect-error handles are readonly
context.self.index = 2;
// @ts-expect-error visible stances are readonly
context.attitudes[0]!.stance.kind = "belief";

// Positive control
const parsed: NpcKnowledgeSnapshot = parseNpcKnowledge(input, truth, null);

export { conclusionKnowledge, propositionKnowledge, wrongSubject, wrongNpc, unparsed, parsed };
