import { createHash } from "node:crypto";
import { z } from "zod";
import type {
  CaseId,
  CaseTruth,
  EventId,
  EvidenceId,
  ItemId,
  LocationId,
  PersonId,
} from "./case-truth.ts";
import { hashCaseTruth } from "./case-truth.identity.ts";

// PlayerRef V1 (MYST-0001): opaque, salt- and truth-bound references to case entities.
// Player-facing code never sees canonical domain IDs (slugs may spoil, guessable IDs are an
// existence oracle). Resolving a ref only says "this ref names this entity"; it never says the
// player may see or use it. Build errors are author-side and must never reach a player.

export const PLAYER_REF_PROFILE = "forge-mystery-playerref-v1";
export const PLAYER_REF_KINDS = Object.freeze(["person", "location", "item", "event", "evidence"] as const);
export type PlayerRefKind = (typeof PLAYER_REF_KINDS)[number];

const ZERO_SALT = "0".repeat(32);
const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

export const RefSaltSchema = z
  .string()
  .regex(/^[0-9a-f]{32}$/)
  .refine((salt) => salt !== ZERO_SALT, "The all-zero salt is forbidden")
  .brand<"RefSalt">();
export type RefSalt = z.output<typeof RefSaltSchema>;

export const PlayerRefSchema = z
  .string()
  .regex(/^pr1_[0-9a-hjkmnp-tv-z]{16}$/)
  .brand<"PlayerRef">();
export type PlayerRef = z.output<typeof PlayerRefSchema>;

/** Trusted host port; exists so tests can reach the collision path. Not validated. */
export type PlayerRefDigest = (preimage: string) => Uint8Array;
export const nodePlayerRefDigest: PlayerRefDigest = (preimage) =>
  new Uint8Array(createHash("sha256").update(preimage, "utf8").digest());

export function derivePlayerRef(
  input: { refSalt: RefSalt; caseId: CaseId; truthHash: string; kind: PlayerRefKind; id: string },
  digest: PlayerRefDigest = nodePlayerRefDigest,
): PlayerRef {
  const { refSalt, caseId, truthHash, kind, id } = input;
  const preimage = [PLAYER_REF_PROFILE, refSalt, caseId, truthHash, kind, id].join("\n");
  // First 80 bits, big-endian, as 16 Crockford base32 digits (most significant first).
  let bits = 0n;
  for (const byte of digest(preimage).subarray(0, 10)) bits = (bits << 8n) | BigInt(byte);
  let body = "";
  for (let group = 15; group >= 0; group--) body += ALPHABET[Number((bits >> BigInt(group * 5)) & 31n)];
  return `pr1_${body}` as PlayerRef;
}

export type ResolvedEntity =
  | { readonly kind: "person"; readonly id: PersonId }
  | { readonly kind: "location"; readonly id: LocationId }
  | { readonly kind: "item"; readonly id: ItemId }
  | { readonly kind: "event"; readonly id: EventId }
  | { readonly kind: "evidence"; readonly id: EvidenceId };

export type PlayerRefEntry = ResolvedEntity & { readonly ref: PlayerRef };

export type PlayerRefIndex = {
  readonly schemaVersion: 1;
  readonly profile: typeof PLAYER_REF_PROFILE;
  readonly caseId: CaseId;
  readonly truthHash: string;
  readonly entries: readonly PlayerRefEntry[];
} & z.$brand<"PlayerRefIndex">;

export type PlayerRefCollision = {
  readonly ref: PlayerRef;
  readonly first: ResolvedEntity;
  readonly second: ResolvedEntity;
};

export type PlayerRefBuildResult =
  | { readonly success: true; readonly index: PlayerRefIndex }
  | { readonly success: false; readonly code: "REF_SALT_INVALID" }
  | { readonly success: false; readonly code: "REF_COLLISION"; readonly collisions: readonly PlayerRefCollision[] };

export type PlayerRefResolution =
  | ({ readonly success: true } & ResolvedEntity)
  | { readonly success: false; readonly code: "REF_UNRESOLVED" };

const byCodeUnits = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const byEntity = (a: ResolvedEntity, b: ResolvedEntity): number =>
  PLAYER_REF_KINDS.indexOf(a.kind) - PLAYER_REF_KINDS.indexOf(b.kind) || byCodeUnits(a.id, b.id);
const byRef = (a: PlayerRefEntry, b: PlayerRefEntry): number => byCodeUnits(a.ref, b.ref) || byEntity(a, b);

const entity = (kind: PlayerRefKind, id: string): ResolvedEntity =>
  Object.freeze({ kind, id }) as ResolvedEntity;

function entitiesOf(truth: CaseTruth): ResolvedEntity[] {
  return [
    ...truth.persons.map((p) => entity("person", p.id)),
    ...truth.locations.map((l) => entity("location", l.id)),
    ...truth.items.map((i) => entity("item", i.id)),
    ...truth.events.map((e) => entity("event", e.id)),
    ...truth.evidence.map((e) => entity("evidence", e.id)),
  ];
}

export function buildPlayerRefIndex(
  truth: CaseTruth,
  refSalt: unknown,
  digest: PlayerRefDigest = nodePlayerRefDigest,
): PlayerRefBuildResult {
  const salt = RefSaltSchema.safeParse(refSalt);
  if (!salt.success) return Object.freeze({ success: false, code: "REF_SALT_INVALID" });

  const truthHash = hashCaseTruth(truth);
  const entries = entitiesOf(truth)
    .map((e) => ({ ...e, ref: derivePlayerRef({ refSalt: salt.data, caseId: truth.caseId, truthHash, ...e }, digest) }))
    .sort(byRef);

  const collisions: PlayerRefCollision[] = [];
  for (let i = 1; i < entries.length; i++) {
    const [first, second] = [entries[i - 1]!, entries[i]!];
    if (first.ref === second.ref) {
      collisions.push(
        Object.freeze({ ref: first.ref, first: entity(first.kind, first.id), second: entity(second.kind, second.id) }),
      );
    }
  }
  if (collisions.length > 0) return Object.freeze({ success: false, code: "REF_COLLISION", collisions: Object.freeze(collisions) });

  const index = {
    schemaVersion: 1,
    profile: PLAYER_REF_PROFILE,
    caseId: truth.caseId,
    truthHash,
    entries: Object.freeze(entries.map((e) => Object.freeze({ ref: e.ref, kind: e.kind, id: e.id }) as PlayerRefEntry)),
  };
  return Object.freeze({ success: true, index: Object.freeze(index) as PlayerRefIndex });
}

export function playerRefFor(index: PlayerRefIndex, kind: PlayerRefKind, id: string): PlayerRef | null {
  return index.entries.find((entry) => entry.kind === kind && entry.id === id)?.ref ?? null;
}

const UNRESOLVED: PlayerRefResolution = Object.freeze({ success: false, code: "REF_UNRESOLVED" });

/** Resolves untrusted player input without normalization. Every failure is the same object. */
export function resolvePlayerRef(index: PlayerRefIndex, input: unknown, expectedKind?: PlayerRefKind): PlayerRefResolution {
  if (typeof input !== "string") return UNRESOLVED;
  const entry = index.entries.find((candidate) => candidate.ref === input);
  if (entry === undefined || (expectedKind !== undefined && entry.kind !== expectedKind)) return UNRESOLVED;
  return Object.freeze({ success: true, kind: entry.kind, id: entry.id }) as PlayerRefResolution;
}
