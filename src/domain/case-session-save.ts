import { z } from "zod";
import type { ResolvedCasePackage } from "./case-package.ts";
import { hashSessionJson, serializeSessionJson, utf8Length, validateSessionJson } from "./case-package.identity.ts";
import { replaySession, SESSION_LIMITS, type SessionState } from "./case-session.ts";

// Save / replay V1 (MYST-SESSION-0001C). A save is C(envelope) with exactly four root fields; only
// the accepted raw events are authority. Everything derived (Known, discoveries, observations,
// verdicts, phase) is rebuilt by replaySession. The checksum detects accidents, not tampering.

const SAVE_PROFILE = "forge-session-save-v1";

export const SAVE_LIMITS = Object.freeze({
  maxSaveBytes: SESSION_LIMITS.maxSaveBytes,
  maxEvents: SESSION_LIMITS.maxEvents,
  maxDepth: SESSION_LIMITS.maxDepth,
  maxNodes: SESSION_LIMITS.maxNodes,
});

export type EncodeSaveResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly code: "INVALID_STATE" | "LIMIT_REACHED" | "HOST_FAILURE" };
export type DecodeSaveResult =
  | { readonly ok: true; readonly state: SessionState }
  | {
      readonly ok: false;
      readonly code: "INVALID_SAVE" | "INCOMPATIBLE_PACKAGE" | "LIMIT_REACHED" | "CHECKSUM_MISMATCH" | "INVALID_HISTORY" | "HOST_FAILURE";
    };
export type PublicLoadResult = { readonly ok: true; readonly state: SessionState } | { readonly ok: false; readonly code: "SAVE_UNAVAILABLE" };

const Hash = z.string().regex(/^[0-9a-f]{64}$/);
const EnvelopeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  packageIdentity: z.strictObject({ schemaVersion: z.literal(1), packageHash: Hash, rulesetVersion: z.string() }),
  events: z.array(z.unknown()),
  checksum: Hash,
});

const LIMITS = { maxDepth: SAVE_LIMITS.maxDepth, maxNodes: SAVE_LIMITS.maxNodes };
const checksumOf = (body: { schemaVersion: 1; packageIdentity: unknown; events: readonly unknown[] }) => hashSessionJson(SAVE_PROFILE, body);

function failure<C extends string>(code: C) {
  return Object.freeze({ ok: false as const, code });
}

/** The derived view a state claims: everything except the events it is derived from. */
const derivedOf = (state: SessionState) =>
  serializeSessionJson({ identity: state.identity, phase: state.phase, knowledge: state.knowledge, verdicts: state.verdicts });

/**
 * Trusted host: re-derives the state from its accepted events and saves only if the given derived
 * view is exactly that. A diverging copy is refused, never repaired.
 */
export function encodeSessionSave(pkg: ResolvedCasePackage, state: SessionState): EncodeSaveResult {
  try {
    if (!validateSessionJson(state, LIMITS).ok) return failure("INVALID_STATE");
    const { schemaVersion, packageHash, rulesetVersion } = pkg.identity;
    const identity = { schemaVersion, packageHash, rulesetVersion };
    if (serializeSessionJson(state.identity) !== serializeSessionJson(identity)) return failure("INVALID_STATE");

    const replay = replaySession(pkg, state.events);
    if (!replay.ok) return failure(replay.code === "INVALID_HISTORY" ? "INVALID_STATE" : replay.code);
    if (derivedOf(replay.state) !== derivedOf(state)) return failure("INVALID_STATE");

    const body = { schemaVersion: 1 as const, packageIdentity: identity, events: state.events };
    const text = serializeSessionJson({ ...body, checksum: checksumOf(body) });
    if (utf8Length(text) > SAVE_LIMITS.maxSaveBytes) return failure("LIMIT_REACHED");
    return Object.freeze({ ok: true, text });
  } catch {
    return failure("HOST_FAILURE");
  }
}

/**
 * Trusted host: wire checks, then version/package, then checksum, then replay, in that order.
 * Only the canonical form C is accepted, so whitespace, duplicate keys, escapes, BOM and -0 fail.
 */
export function decodeSessionSave(pkg: ResolvedCasePackage, text: unknown): DecodeSaveResult {
  try {
    if (typeof text !== "string") return failure("INVALID_SAVE");
    if (utf8Length(text) > SAVE_LIMITS.maxSaveBytes) return failure("LIMIT_REACHED");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return failure("INVALID_SAVE");
    }
    const check = validateSessionJson(parsed, LIMITS);
    if (!check.ok) return failure(check.code === "LIMIT" ? "LIMIT_REACHED" : "INVALID_SAVE");
    const envelope = EnvelopeSchema.safeParse(parsed);
    if (!envelope.success || serializeSessionJson(parsed) !== text) return failure("INVALID_SAVE");
    const { packageIdentity, events, checksum } = envelope.data;
    if (events.length > SAVE_LIMITS.maxEvents) return failure("LIMIT_REACHED");

    const identity = pkg.identity;
    if (packageIdentity.rulesetVersion !== identity.rulesetVersion || packageIdentity.packageHash !== identity.packageHash) {
      return failure("INCOMPATIBLE_PACKAGE");
    }
    if (checksumOf({ schemaVersion: 1, packageIdentity, events }) !== checksum) return failure("CHECKSUM_MISMATCH");

    const replay = replaySession(pkg, events);
    if (!replay.ok) return failure(replay.code);
    return Object.freeze({ ok: true, state: replay.state });
  } catch {
    return failure("HOST_FAILURE");
  }
}

const SAVE_UNAVAILABLE: PublicLoadResult = failure("SAVE_UNAVAILABLE");

/** Player facade: every failure is the same constant; detail codes stay in the host. */
export function loadSessionSaveForPlayer(pkg: ResolvedCasePackage, text: unknown): PublicLoadResult {
  const result = decodeSessionSave(pkg, text);
  return result.ok ? result : SAVE_UNAVAILABLE;
}
