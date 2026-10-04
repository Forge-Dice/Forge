import { z } from "zod";
import {
  CaseIdSchema,
  EventIdSchema,
  EvidenceIdSchema,
  ItemIdSchema,
  LocationIdSchema,
  PersonIdSchema,
  type CaseTruth,
  type DeepReadonly,
  type EvidenceId,
} from "./case-truth.ts";
import { hashCaseTruth } from "./case-truth.identity.ts";

// Evidence access and investigation V1 (MYST-0003). An authored map, bound to one CaseTruth,
// states for every evidence whether and through which investigation actions it is discoverable.
// Domain IDs only: no evidence content, no propositions, no truth values, no PlayerRefs, no session.

// ---------- Actions and access ----------

export const INVESTIGATION_ACTION_KINDS = ["search_location", "examine_item", "examine_person"] as const;

export const InvestigationActionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("search_location"), locationId: LocationIdSchema }),
  z.strictObject({ kind: z.literal("examine_item"), itemId: ItemIdSchema }),
  z.strictObject({ kind: z.literal("examine_person"), personId: PersonIdSchema }),
]);

export type InvestigationAction = z.output<typeof InvestigationActionSchema>;

export const EvidenceAccessSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("inaccessible") }),
  z.strictObject({ kind: z.literal("discoverable"), paths: z.array(InvestigationActionSchema).min(1) }),
]);

export const EvidenceAccessEntrySchema = z.strictObject({
  evidenceId: EvidenceIdSchema,
  access: EvidenceAccessSchema,
});

/** Entity the caller (session layer) states the player already knows. Same shape as a resolved PlayerRef. */
export const KnownEntityRefSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("person"), id: PersonIdSchema }),
  z.strictObject({ kind: z.literal("location"), id: LocationIdSchema }),
  z.strictObject({ kind: z.literal("item"), id: ItemIdSchema }),
  z.strictObject({ kind: z.literal("event"), id: EventIdSchema }),
  z.strictObject({ kind: z.literal("evidence"), id: EvidenceIdSchema }),
]);

export type KnownEntityRef = z.output<typeof KnownEntityRefSchema>;

type TargetKind = "location" | "item" | "person";
type Target = { readonly kind: TargetKind; readonly id: string; readonly field: string };

function actionTarget(action: DeepReadonly<InvestigationAction>): Target {
  switch (action.kind) {
    case "search_location":
      return { kind: "location", id: action.locationId, field: "locationId" };
    case "examine_item":
      return { kind: "item", id: action.itemId, field: "itemId" };
    case "examine_person":
      return { kind: "person", id: action.personId, field: "personId" };
  }
}

function targetKey(target: { readonly kind: string; readonly id: string }): string {
  return `${target.kind}|${target.id}`;
}

function byCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

// ---------- Bound parser ----------

const EvidenceAccessMapShape = z.strictObject({
  schemaVersion: z.literal(1),
  caseId: CaseIdSchema,
  truthHash: z.string().regex(/^[0-9a-f]{64}$/, "Expected a lowercase SHA-256 hex digest"),
  entries: z.array(EvidenceAccessEntrySchema),
});

type EvidenceAccessMapShapeOutput = z.output<typeof EvidenceAccessMapShape>;

function checkEvidenceAccessMap(
  map: EvidenceAccessMapShapeOutput,
  truth: CaseTruth,
  truthHash: string,
  ctx: z.RefinementCtx<EvidenceAccessMapShapeOutput>,
): void {
  const issue = (message: string, path: (string | number)[]) => ctx.addIssue({ code: "custom", message, path });

  // R1: binding first; a map for another truth gets no follow-up issues.
  let bound = true;
  if (map.caseId !== truth.caseId) {
    bound = false;
    issue(`Map is for ${map.caseId}, not ${truth.caseId}`, ["caseId"]);
  }
  if (map.truthHash !== truthHash) {
    bound = false;
    issue("truthHash does not match the given CaseTruth", ["truthHash"]);
  }
  if (!bound) return;

  const evidenceIds = new Set<string>(truth.evidence.map((evidence) => evidence.id));
  const targets: Record<TargetKind, ReadonlySet<string>> = {
    location: new Set(truth.locations.map((location) => location.id)),
    item: new Set(truth.items.map((item) => item.id)),
    person: new Set(truth.persons.map((person) => person.id)),
  };
  const covered = new Set<string>();

  map.entries.forEach((entry, i) => {
    // R2 evidence reference, R3 one entry per evidence.
    if (!evidenceIds.has(entry.evidenceId)) {
      issue(`Unknown evidence "${entry.evidenceId}"`, ["entries", i, "evidenceId"]);
    } else if (covered.has(entry.evidenceId)) {
      issue(`Duplicate entry for "${entry.evidenceId}"`, ["entries", i, "evidenceId"]);
    }
    covered.add(entry.evidenceId);

    if (entry.access.kind !== "discoverable") return;
    const seenPaths = new Set<string>();
    entry.access.paths.forEach((path, j) => {
      const target = actionTarget(path);
      // R5 target reference, R6 no duplicate target within one entry.
      if (!targets[target.kind].has(target.id)) {
        issue(`Unknown ${target.kind} "${target.id}"`, ["entries", i, "access", "paths", j, target.field]);
      }
      const key = targetKey(target);
      if (seenPaths.has(key)) {
        issue(`Duplicate path to ${target.kind} "${target.id}"`, ["entries", i, "access", "paths", j]);
      }
      seenPaths.add(key);
    });
  });

  // R4: every evidence of the truth has an entry.
  for (const evidence of truth.evidence) {
    if (!covered.has(evidence.id)) issue(`Missing entry for "${evidence.id}"`, ["entries"]);
  }
}

export function createEvidenceAccessMapSchema(truth: CaseTruth) {
  const truthHash = hashCaseTruth(truth);
  // Semantic rules run only on schema-valid input: a malformed map gets schema issues only.
  return EvidenceAccessMapShape.superRefine((map, ctx) => checkEvidenceAccessMap(map, truth, truthHash, ctx), {
    when: (payload) => payload.issues.length === 0,
  })
    .transform((map) => deepFreeze(structuredClone(map)) as DeepReadonly<EvidenceAccessMapShapeOutput>)
    .brand<"EvidenceAccessMap">();
}

/** Plain, mutable authoring input. */
export type EvidenceAccessMapInput = z.input<ReturnType<typeof createEvidenceAccessMapSchema>>;

/** Deeply frozen, nominally branded access map. Only obtainable through parsing. */
export type EvidenceAccessMap = z.output<ReturnType<typeof createEvidenceAccessMapSchema>>;

export function parseEvidenceAccessMap(input: unknown, truth: CaseTruth): EvidenceAccessMap {
  return createEvidenceAccessMapSchema(truth).parse(input);
}

// ---------- Investigation ----------

export type InvestigationErrorCode = "INVALID_ACTION" | "INVALID_KNOWN_REFS" | "TARGET_NOT_KNOWN";

export type InvestigationResult =
  | { readonly success: true; readonly found: readonly EvidenceId[] }
  | { readonly success: false; readonly code: InvestigationErrorCode };

// One frozen constant per code: no echo, no ID, no message, no existence oracle.
const INVALID_ACTION: InvestigationResult = Object.freeze({ success: false, code: "INVALID_ACTION" });
const INVALID_KNOWN_REFS: InvestigationResult = Object.freeze({ success: false, code: "INVALID_KNOWN_REFS" });
const TARGET_NOT_KNOWN: InvestigationResult = Object.freeze({ success: false, code: "TARGET_NOT_KNOWN" });

const KnownEntityRefsSchema = z.array(KnownEntityRefSchema);

/**
 * Evidence IDs reachable by one authorized action. Pure; never reads the truth.
 * Membership of the target in `known` is the only authorization. The caller diffs
 * against already discovered evidence and translates IDs before anything reaches a player.
 */
export function resolveInvestigation(map: EvidenceAccessMap, known: unknown, action: unknown): InvestigationResult {
  const parsedAction = InvestigationActionSchema.safeParse(action);
  if (!parsedAction.success) return INVALID_ACTION;
  const parsedKnown = KnownEntityRefsSchema.safeParse(known);
  if (!parsedKnown.success) return INVALID_KNOWN_REFS;

  const target = actionTarget(parsedAction.data);
  const knownKeys = new Set(parsedKnown.data.map(targetKey));
  if (!knownKeys.has(targetKey(target))) return TARGET_NOT_KNOWN;

  const wanted = targetKey(target);
  const found: EvidenceId[] = [];
  for (const entry of map.entries) {
    if (entry.access.kind !== "discoverable") continue;
    if (entry.access.paths.some((path) => targetKey(actionTarget(path)) === wanted)) found.push(entry.evidenceId);
  }
  found.sort(byCodeUnits);
  return Object.freeze({ success: true, found: Object.freeze(found) });
}
