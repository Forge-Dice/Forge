import { z } from "zod";
import {
  CaseIdSchema,
  EventIdSchema,
  ItemIdSchema,
  LocationIdSchema,
  PersonIdSchema,
  type CaseTruth,
  type DeepReadonly,
} from "./case-truth.ts";
import { hashCaseTruth } from "./case-truth.identity.ts";

// Immutable, versioned answer key for a mystery case (TASK-0003).
// A CaseSolution is bound to one exact CaseTruth snapshot (caseId + truthHash).
// A successful parse means: the answer key is bound to that snapshot and internally
// consistent. It does NOT mean the world is contradiction-free (see validateCaseSemantics),
// and responsibility never implies physical presence.

// ---------- Primitives ----------

export const ConclusionIdSchema = z
  .string()
  .regex(/^conclusion:[a-z0-9][a-z0-9_-]{0,63}$/, 'Expected an ID of the form "conclusion:<slug>"')
  .brand<"ConclusionId">();
export type ConclusionId = z.output<typeof ConclusionIdSchema>;

export const ResponsibilityRoleSchema = z.enum(["direct_actor", "planner", "facilitator"]);
export type ResponsibilityRole = z.output<typeof ResponsibilityRoleSchema>;

export const IntentSchema = z.enum(["intended", "unintended", "not_applicable"]);
export type Intent = z.output<typeof IntentSchema>;

export const MechanismSchema = z.enum(["ordinary", "supernatural", "mixed"]);
export type Mechanism = z.output<typeof MechanismSchema>;

const TruthHashSchema = z.string().regex(/^[0-9a-f]{64}$/, "Expected a lowercase SHA-256 hex digest");

function uniqueBy<T extends z.ZodType>(item: T, keyOf: (value: z.output<T>) => string, message: string) {
  return z.array(item).superRefine((values, ctx) => {
    const seen = new Set<string>();
    values.forEach((value, index) => {
      const key = keyOf(value);
      if (seen.has(key)) ctx.addIssue({ code: "custom", message, path: [index] });
      seen.add(key);
    });
  });
}

// ---------- Event resolutions ----------

export const TargetRefSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("person"), id: PersonIdSchema }),
  z.strictObject({ kind: z.literal("item"), id: ItemIdSchema }),
  z.strictObject({ kind: z.literal("location"), id: LocationIdSchema }),
]);

export const ResponsibilityAssignmentSchema = z.strictObject({
  personId: PersonIdSchema,
  // null: responsibility is known, the exact role is not specified.
  roles: uniqueBy(ResponsibilityRoleSchema, (role) => role, "Duplicate role").min(1).nullable(),
});

export const EventResolutionSchema = z.strictObject({
  eventId: EventIdSchema,
  targets: uniqueBy(TargetRefSchema, (target) => `${target.kind}|${target.id}`, "Duplicate target"),
  responsibility: z.strictObject({
    completeness: z.enum(["complete", "partial"]),
    assignments: uniqueBy(ResponsibilityAssignmentSchema, (a) => a.personId, "Duplicate assignment for person"),
  }),
  intent: IntentSchema.nullable(),
  mechanism: MechanismSchema.nullable(),
  // Refers to CaseTruth.events[eventId].causedByEventIds; causes are never copied here.
  causesComplete: z.boolean(),
});

// ---------- Conclusions ----------

export const ConclusionClaimSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("personResponsibleForEvent"), personId: PersonIdSchema, eventId: EventIdSchema }),
  z.strictObject({
    kind: z.literal("personRoleForEvent"),
    personId: PersonIdSchema,
    eventId: EventIdSchema,
    role: ResponsibilityRoleSchema,
  }),
  z.strictObject({ kind: z.literal("noPersonResponsibleForEvent"), eventId: EventIdSchema }),
  z
    .strictObject({ kind: z.literal("eventCausedEvent"), causeEventId: EventIdSchema, eventId: EventIdSchema })
    .refine((claim) => claim.causeEventId !== claim.eventId, {
      message: "An event cannot be claimed as its own cause",
      path: ["causeEventId"],
    }),
  z.strictObject({ kind: z.literal("eventIntent"), eventId: EventIdSchema, value: IntentSchema }),
  z.strictObject({ kind: z.literal("eventMechanism"), eventId: EventIdSchema, value: MechanismSchema }),
]);

export const ConclusionSchema = z.strictObject({ id: ConclusionIdSchema, claim: ConclusionClaimSchema });

export const ConclusionLiteralSchema = z.strictObject({ conclusionId: ConclusionIdSchema, value: z.boolean() });

export type TargetRef = z.output<typeof TargetRefSchema>;
export type ResponsibilityAssignment = z.output<typeof ResponsibilityAssignmentSchema>;
export type EventResolution = z.output<typeof EventResolutionSchema>;
export type ConclusionClaim = z.output<typeof ConclusionClaimSchema>;
export type Conclusion = z.output<typeof ConclusionSchema>;
export type ConclusionLiteral = z.output<typeof ConclusionLiteralSchema>;

// ---------- Root (unbound shape stays private) ----------

const CaseSolutionShapeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  caseId: CaseIdSchema,
  revision: z.int().positive(),
  truthHash: TruthHashSchema,
  resolutions: z.array(EventResolutionSchema).min(1),
  conclusions: z.array(ConclusionSchema).min(1),
  requiredConclusions: z.array(ConclusionLiteralSchema).min(1),
});

type CaseSolutionShape = z.output<typeof CaseSolutionShapeSchema>;
type Ctx = z.RefinementCtx<CaseSolutionShape>;
type TruthEvent = CaseTruth["events"][number];
type Status = true | false | "undetermined";

// Truth table of TASK-0003 §6. Inputs are fully reference-checked before this is called.
function resolveConclusion(claim: ConclusionClaim, resolution: EventResolution, event: TruthEvent): Status {
  const { completeness, assignments } = resolution.responsibility;
  const openOrFalse: Status = completeness === "complete" ? false : "undetermined";

  switch (claim.kind) {
    case "personResponsibleForEvent":
      return assignments.some((a) => a.personId === claim.personId) ? true : openOrFalse;
    case "personRoleForEvent": {
      const assignment = assignments.find((a) => a.personId === claim.personId);
      if (assignment === undefined) return openOrFalse;
      if (assignment.roles === null) return "undetermined";
      // A known role list is closed for this assignment, even if the responsibility list is partial.
      return assignment.roles.includes(claim.role);
    }
    case "noPersonResponsibleForEvent":
      if (assignments.length > 0) return false;
      return completeness === "complete" ? true : "undetermined";
    case "eventCausedEvent":
      // Direct edges only; no transitive causation.
      if (event.causedByEventIds.includes(claim.causeEventId)) return true;
      return resolution.causesComplete ? false : "undetermined";
    case "eventIntent":
      return resolution.intent === null ? "undetermined" : resolution.intent === claim.value;
    case "eventMechanism":
      return resolution.mechanism === null ? "undetermined" : resolution.mechanism === claim.value;
  }
}

function claimKey(claim: ConclusionClaim): string {
  // Discriminator plus every defined field; independent of property order.
  const entries = Object.entries(claim).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify(entries);
}

function checkSolution(solution: CaseSolutionShape, truth: CaseTruth, truthHash: string, ctx: Ctx): void {
  const issue = (message: string, path: (string | number)[]) => ctx.addIssue({ code: "custom", message, path });

  // ---- Binding: without it, references would be resolved against the wrong world.
  let bound = true;
  if (solution.caseId !== truth.caseId) {
    issue(`Solution is for ${solution.caseId}, not ${truth.caseId}`, ["caseId"]);
    bound = false;
  }
  if (solution.truthHash !== truthHash) {
    issue("truthHash does not match the given CaseTruth snapshot", ["truthHash"]);
    bound = false;
  }
  if (!bound) return;

  let failures = 0;
  const report = (message: string, path: (string | number)[]) => {
    failures++;
    issue(message, path);
  };

  const eventsById = new Map<string, TruthEvent>(truth.events.map((event) => [event.id, event]));
  const known = {
    person: new Set<string>(truth.persons.map((p) => p.id)),
    item: new Set<string>(truth.items.map((i) => i.id)),
    location: new Set<string>(truth.locations.map((l) => l.id)),
  };

  // ---- Resolutions
  const resolutionByEvent = new Map<string, EventResolution>();
  solution.resolutions.forEach((resolution, i) => {
    const path = ["resolutions", i];
    if (!eventsById.has(resolution.eventId)) {
      report(`Unknown event "${resolution.eventId}"`, [...path, "eventId"]);
    } else if (resolutionByEvent.has(resolution.eventId)) {
      report(`Duplicate resolution for "${resolution.eventId}"`, [...path, "eventId"]);
    } else {
      resolutionByEvent.set(resolution.eventId, resolution);
    }
    resolution.targets.forEach((target, j) => {
      if (!known[target.kind].has(target.id)) report(`Unknown ${target.kind} "${target.id}"`, [...path, "targets", j, "id"]);
    });
    resolution.responsibility.assignments.forEach((assignment, j) => {
      if (!known.person.has(assignment.personId)) {
        report(`Unknown person "${assignment.personId}"`, [...path, "responsibility", "assignments", j, "personId"]);
      }
    });
  });

  // ---- Conclusions
  const conclusionsById = new Map<string, ConclusionClaim>();
  const claimOwners = new Map<string, string>();
  solution.conclusions.forEach((conclusion, i) => {
    const path = ["conclusions", i];
    const { claim } = conclusion;
    if (conclusionsById.has(conclusion.id)) {
      report(`Duplicate conclusion ID "${conclusion.id}"`, [...path, "id"]);
    } else {
      conclusionsById.set(conclusion.id, claim);
    }

    const key = claimKey(claim);
    const owner = claimOwners.get(key);
    if (owner !== undefined && owner !== conclusion.id) {
      report(`Same claim as "${owner}"`, [...path, "claim"]);
    } else {
      claimOwners.set(key, conclusion.id);
    }

    if (!eventsById.has(claim.eventId)) {
      report(`Unknown event "${claim.eventId}"`, [...path, "claim", "eventId"]);
    } else if (!resolutionByEvent.has(claim.eventId)) {
      report(`No resolution for "${claim.eventId}"`, [...path, "claim", "eventId"]);
    }
    if ("personId" in claim && !known.person.has(claim.personId)) {
      report(`Unknown person "${claim.personId}"`, [...path, "claim", "personId"]);
    }
    if (claim.kind === "eventCausedEvent" && !eventsById.has(claim.causeEventId)) {
      report(`Unknown event "${claim.causeEventId}"`, [...path, "claim", "causeEventId"]);
    }
  });

  // ---- Required conclusions: references and uniqueness
  const required = new Set<string>();
  solution.requiredConclusions.forEach((literal, i) => {
    const path = ["requiredConclusions", i, "conclusionId"];
    if (required.has(literal.conclusionId)) {
      report(`"${literal.conclusionId}" is required more than once`, path);
    }
    required.add(literal.conclusionId);
    if (!conclusionsById.has(literal.conclusionId)) {
      report(`Unknown conclusion "${literal.conclusionId}"`, path);
    }
  });

  // ---- Answer key consistency, only on a fully resolvable document (no undefined access).
  if (failures === 0) {
    solution.requiredConclusions.forEach((literal, i) => {
      const claim = conclusionsById.get(literal.conclusionId)!;
      const status = resolveConclusion(claim, resolutionByEvent.get(claim.eventId)!, eventsById.get(claim.eventId)!);
      if (status !== literal.value) {
        report(
          `"${literal.conclusionId}" is required to be ${literal.value} but resolves to ${String(status)}`,
          ["requiredConclusions", i, "value"],
        );
      }
    });
  }
}

// ---------- Immutability ----------

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Zod schema bound to one CaseTruth snapshot. The only way to obtain a CaseSolution. */
export function createCaseSolutionSchema(truth: CaseTruth) {
  const truthHash = hashCaseTruth(truth);
  return CaseSolutionShapeSchema.superRefine((solution, ctx) => checkSolution(solution, truth, truthHash, ctx))
    .transform((solution) => deepFreeze(structuredClone(solution)) as DeepReadonly<CaseSolutionShape>)
    .brand<"CaseSolution">();
}

/** Plain, mutable authoring input. */
export type CaseSolutionInput = z.input<ReturnType<typeof createCaseSolutionSchema>>;

/** Deeply frozen, nominally branded answer key, bound to the CaseTruth it was parsed against. */
export type CaseSolution = z.output<ReturnType<typeof createCaseSolutionSchema>>;

export function parseCaseSolution(input: unknown, truth: CaseTruth): CaseSolution {
  return createCaseSolutionSchema(truth).parse(input);
}
