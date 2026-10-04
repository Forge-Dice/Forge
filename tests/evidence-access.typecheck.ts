// Compile-time tests: checked by `npm run typecheck`, never executed.
// Each @ts-expect-error fails the typecheck if the line below it becomes valid.

import type { EvidenceId } from "../src/domain/case-truth.ts";
import type { CaseSolution } from "../src/domain/case-solution.ts";
import type { NpcKnowledgeSnapshot } from "../src/domain/npc-knowledge.ts";
import type { EvidenceAccessMap, InvestigationResult } from "../src/domain/evidence-access.ts";
import { resolveInvestigation } from "../src/domain/evidence-access.ts";
import { hashEvidenceAccessMap } from "../src/domain/evidence-access.identity.ts";

declare const map: EvidenceAccessMap;
declare const solution: CaseSolution;
declare const snapshot: NpcKnowledgeSnapshot;
declare const result: InvestigationResult;

const ok: InvestigationResult = resolveInvestigation(map, [], { kind: "search_location", locationId: "location:garden" });

// A-57 exactly three parameters, no CaseSolution
const arity: 3 = resolveInvestigation.length as Parameters<typeof resolveInvestigation>["length"];
// @ts-expect-error a CaseSolution is not an EvidenceAccessMap
resolveInvestigation(solution, [], {});
// @ts-expect-error no fourth parameter for a solution
resolveInvestigation(map, [], {}, solution);

// A-58 no NPC knowledge
// @ts-expect-error an NpcKnowledgeSnapshot is not an EvidenceAccessMap
resolveInvestigation(snapshot, [], {});
// @ts-expect-error no fourth parameter for NPC knowledge
resolveInvestigation(map, [], {}, snapshot);

// A-74 brand: plain objects are not maps
const plain = { schemaVersion: 1 as const, caseId: "case:x", truthHash: "0".repeat(64), entries: [] };
// @ts-expect-error a plain object is not a branded EvidenceAccessMap
hashEvidenceAccessMap(plain);
// @ts-expect-error a plain object is not a branded EvidenceAccessMap
const branded: EvidenceAccessMap = plain;

// A-75 found is readonly EvidenceId[]
if (result.success) {
  const ids: readonly EvidenceId[] = result.found;
  // @ts-expect-error found is readonly
  result.found[0] = ids[0]!;
  // @ts-expect-error found holds EvidenceIds, not plain strings
  const asStrings: readonly EvidenceId[] = ["evidence:x"];
  void asStrings;
}
// @ts-expect-error a failure has no found
void ((result as Extract<InvestigationResult, { success: false }>).found);

// Map is deeply readonly
// @ts-expect-error caseId is readonly
map.caseId = map.caseId;

void [ok, arity, branded];
