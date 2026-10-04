// Compile-time tests: checked by `npm run typecheck`, never executed.
// Each @ts-expect-error fails the typecheck if the line below it becomes valid.

import type { CaseId } from "../src/domain/case-truth.ts";
import type {
  PlayerRef,
  PlayerRefBuildResult,
  PlayerRefIndex,
  PlayerRefKind,
  PlayerRefResolution,
  RefSalt,
} from "../src/domain/player-ref.ts";
import { PlayerRefSchema, RefSaltSchema } from "../src/domain/player-ref.ts";

declare const index: PlayerRefIndex;
declare const caseId: CaseId;
declare const resolution: PlayerRefResolution;
declare const built: PlayerRefBuildResult;

// Only buildPlayerRefIndex produces an index
// @ts-expect-error an object literal is not a PlayerRefIndex
const literalIndex: PlayerRefIndex = { schemaVersion: 1, profile: "forge-mystery-playerref-v1", caseId, truthHash: "", entries: [] };

// Plain strings are neither refs nor salts
// @ts-expect-error a string is not a PlayerRef
const plainRef: PlayerRef = "pr1_0000000000000000";
// @ts-expect-error a string is not a RefSalt
const plainSalt: RefSalt = "000102030405060708090a0b0c0d0e0f";

// Only the five entity kinds
// @ts-expect-error propositions never get a PlayerRef
const proposition: PlayerRefKind = "proposition";
// @ts-expect-error conclusions never get a PlayerRef
const conclusion: PlayerRefKind = "conclusion";

// Readonly index and results
// @ts-expect-error index fields are readonly
index.caseId = caseId;
// @ts-expect-error entries are a readonly array
index.entries.push(index.entries[0]!);
// @ts-expect-error entry fields are readonly
index.entries[0]!.ref = index.entries[0]!.ref;
if (resolution.success) {
  // @ts-expect-error resolution fields are readonly
  resolution.kind = "item";
}
if (!built.success && built.code === "REF_COLLISION") {
  // @ts-expect-error collisions are a readonly array
  built.collisions.pop();
}

// Positive control
const ref: PlayerRef = PlayerRefSchema.parse("pr1_0000000000000000");
const salt: RefSalt = RefSaltSchema.parse("000102030405060708090a0b0c0d0e0f");
const kind: PlayerRefKind = "evidence";
