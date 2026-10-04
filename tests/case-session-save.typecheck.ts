// Compile-time tests: checked by `npm run typecheck`, never executed.
// Each @ts-expect-error fails the typecheck if the line below it becomes valid.

import type { ResolvedCasePackage } from "../src/domain/case-package.ts";
import type { SessionState } from "../src/domain/case-session.ts";
import {
  decodeSessionSave,
  encodeSessionSave,
  loadSessionSaveForPlayer,
  SAVE_LIMITS,
  type DecodeSaveResult,
  type EncodeSaveResult,
  type PublicLoadResult,
} from "../src/domain/case-session-save.ts";

declare const pkg: ResolvedCasePackage;
declare const state: SessionState;
declare const encoded: EncodeSaveResult;
declare const decoded: DecodeSaveResult;
declare const loaded: PublicLoadResult;

// The codec needs the trusted package; a raw object is not one.
// @ts-expect-error raw package input
encodeSessionSave({ schemaVersion: 1 }, state);
// @ts-expect-error a save string is not a state
encodeSessionSave(pkg, "{}");
decodeSessionSave(pkg, 42 as unknown); // untrusted input is unknown

// Results must be checked before use.
// @ts-expect-error text only on success
const text: string = encoded.text;
// @ts-expect-error state only on success
const loadedState: SessionState = decoded.state;
if (decoded.ok) {
  // @ts-expect-error the reconstructed state is readonly
  decoded.state.phase = "solved";
} else {
  // @ts-expect-error no event index leaks out of decode
  decoded.eventIndex;
}

// The player facade has exactly one failure code.
if (!loaded.ok) {
  const only: "SAVE_UNAVAILABLE" = loaded.code;
  // @ts-expect-error no detail codes for players
  const detail: "CHECKSUM_MISMATCH" = loaded.code;
}

// @ts-expect-error limits are readonly
SAVE_LIMITS.maxEvents = 1024;

// Positive control
const ok: PublicLoadResult = loadSessionSaveForPlayer(pkg, encoded.ok ? encoded.text : "");

export { text, loadedState, ok };
