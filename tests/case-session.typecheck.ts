// Compile-time tests: checked by `npm run typecheck`, never executed.
// Each @ts-expect-error fails the typecheck if the line below it becomes valid.

import type { ResolvedCasePackage } from "../src/domain/case-package.ts";
import * as session from "../src/domain/case-session.ts";
import {
  SESSION_LIMITS,
  SessionEventSchema,
  reduceSession,
  replaySession,
  type PlayerConclusionClaim,
  type SessionEvent,
  type SessionOutput,
  type SessionState,
} from "../src/domain/case-session.ts";

declare const pkg: ResolvedCasePackage;
declare const state: SessionState;
declare const event: SessionEvent;
declare const output: SessionOutput;

// Runtime exports are exactly the five of the contract.
const runtime: Record<"SESSION_LIMITS" | "SessionEventSchema" | "initialSession" | "reduceSession" | "replaySession", unknown> = session;
void runtime;
// @ts-expect-error no save encoding in B
void session.encodeSessionSave;

// State, log and knowledge are readonly.
// @ts-expect-error phase is readonly
state.phase = "solved";
// @ts-expect-error the event log is readonly
state.events.push(event);
// @ts-expect-error verdicts are readonly
state.verdicts.push({ eventIndex: 0, verdict: "solved" });
// @ts-expect-error discoveries are readonly
state.knowledge.discoveries.push({ evidence: "", firstDiscoveryEvent: 0 });
// @ts-expect-error limits are readonly
SESSION_LIMITS.maxEvents = 1_000;

// Input is unknown; results discriminate on ok.
const result = reduceSession(pkg, state, 42);
if (result.ok) {
  const out: SessionOutput = result.output;
  void out;
} else {
  // @ts-expect-error a rejection carries no output
  void result.output;
  const code: "ACTION_UNAVAILABLE" | "SESSION_CLOSED" | "LIMIT_REACHED" | "HOST_FAILURE" = result.code;
  void code;
}
const replay = replaySession(pkg, "anything");
if (!replay.ok) {
  const index: number | null = replay.eventIndex;
  void index;
  // @ts-expect-error replay never reports ACTION_UNAVAILABLE
  const wrong: "ACTION_UNAVAILABLE" = replay.code;
  void wrong;
}

// Events carry no client-side binding fields.
const accuse: SessionEvent = { type: "accuse", literals: [] };
void accuse;
// @ts-expect-error truthHash is not a session event field
const bound: SessionEvent = { type: "accuse", literals: [], truthHash: "" };
void bound;
// @ts-expect-error player claims use refs, not canonical ID fields
const canonical: PlayerConclusionClaim = { kind: "noPersonResponsibleForEvent", eventId: "event:x" };
void canonical;

if (output.type === "accuse") {
  // @ts-expect-error the verdict carries no reasons
  void output.reasons;
}
void SessionEventSchema;
