import { z } from "zod";
import { deepFreeze } from "./shared.ts";

// Objective, immutable truth of a mystery case (TASK-0001).
// A successfully parsed CaseTruth is structurally valid and reference-complete.
// It is NOT semantically validated (no spatial, causal or claim consistency checks)
// and must not be treated as a playable case.

// ---------- IDs ----------

const SLUG = "[a-z0-9][a-z0-9_-]{0,63}";

function idSchema<Brand extends string>(prefix: string) {
  return z
    .string()
    .regex(new RegExp(`^${prefix}:${SLUG}$`), `Expected an ID of the form "${prefix}:<slug>"`)
    .brand<Brand>();
}

export const CaseIdSchema = idSchema<"CaseId">("case");
export const PersonIdSchema = idSchema<"PersonId">("person");
export const LocationIdSchema = idSchema<"LocationId">("location");
export const ItemIdSchema = idSchema<"ItemId">("item");
export const RelationshipIdSchema = idSchema<"RelationshipId">("relationship");
export const EventIdSchema = idSchema<"EventId">("event");
export const MotiveIdSchema = idSchema<"MotiveId">("motive");
export const PropositionIdSchema = idSchema<"PropositionId">("proposition");
export const EvidenceIdSchema = idSchema<"EvidenceId">("evidence");
export const SecretIdSchema = idSchema<"SecretId">("secret");
export const RedHerringIdSchema = idSchema<"RedHerringId">("red-herring");

export type CaseId = z.output<typeof CaseIdSchema>;
export type PersonId = z.output<typeof PersonIdSchema>;
export type LocationId = z.output<typeof LocationIdSchema>;
export type ItemId = z.output<typeof ItemIdSchema>;
export type RelationshipId = z.output<typeof RelationshipIdSchema>;
export type EventId = z.output<typeof EventIdSchema>;
export type MotiveId = z.output<typeof MotiveIdSchema>;
export type PropositionId = z.output<typeof PropositionIdSchema>;
export type EvidenceId = z.output<typeof EvidenceIdSchema>;
export type SecretId = z.output<typeof SecretIdSchema>;
export type RedHerringId = z.output<typeof RedHerringIdSchema>;

// ---------- Primitives ----------

export const TextSchema = z.string().regex(/\S/, "Text must contain a non-whitespace character");

export const TickSchema = z
  .int()
  .nonnegative()
  .refine((value) => !Object.is(value, -0), "Tick must not be -0");

function uniqueList<T extends z.ZodType>(item: T) {
  return z.array(item).superRefine((values, ctx) => {
    const seen = new Set<unknown>();
    values.forEach((value, index) => {
      if (seen.has(value)) {
        ctx.addIssue({ code: "custom", message: "Duplicate list entry", path: [index] });
      }
      seen.add(value);
    });
  });
}

function nonEmptyUniqueList<T extends z.ZodType>(item: T) {
  return uniqueList(item).refine((values) => values.length > 0, "List must not be empty");
}

// ---------- Time ----------

export const TimeSpanSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("instant"), at: TickSchema }),
  z
    .strictObject({ kind: z.literal("interval"), start: TickSchema, end: TickSchema })
    .refine((span) => span.start < span.end, {
      message: "Interval requires start < end",
      path: ["end"],
    }),
]);

// ---------- Entities ----------

export const PersonSchema = z.strictObject({ id: PersonIdSchema, name: TextSchema });
export const LocationSchema = z.strictObject({ id: LocationIdSchema, name: TextSchema });
export const ItemSchema = z.strictObject({ id: ItemIdSchema, name: TextSchema });

export const RelationshipSchema = z
  .strictObject({
    id: RelationshipIdSchema,
    fromPersonId: PersonIdSchema,
    toPersonId: PersonIdSchema,
    kind: TextSchema,
    time: TimeSpanSchema,
  })
  .refine((rel) => rel.fromPersonId !== rel.toPersonId, {
    message: "A relationship must not point from a person to the same person",
    path: ["toPersonId"],
  });

export const EventSchema = z
  .strictObject({
    id: EventIdSchema,
    description: TextSchema,
    time: TimeSpanSchema,
    locationId: LocationIdSchema,
    participantIds: uniqueList(PersonIdSchema),
    itemIds: uniqueList(ItemIdSchema),
    causedByEventIds: uniqueList(EventIdSchema),
  })
  .superRefine((event, ctx) => {
    const index = event.causedByEventIds.indexOf(event.id);
    if (index !== -1) {
      ctx.addIssue({
        code: "custom",
        message: "An event must not list itself as its cause",
        path: ["causedByEventIds", index],
      });
    }
  });

export const MotiveSchema = z.strictObject({
  id: MotiveIdSchema,
  personId: PersonIdSchema,
  eventIds: nonEmptyUniqueList(EventIdSchema),
  description: TextSchema,
});

export const ClaimSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("personAt"),
    personId: PersonIdSchema,
    locationId: LocationIdSchema,
    at: TickSchema,
  }),
  z.strictObject({
    kind: z.literal("eventHasParticipant"),
    eventId: EventIdSchema,
    personId: PersonIdSchema,
  }),
  z.strictObject({
    kind: z.literal("eventHasItem"),
    eventId: EventIdSchema,
    itemId: ItemIdSchema,
  }),
]);

export const PropositionSchema = z.strictObject({
  id: PropositionIdSchema,
  claim: ClaimSchema,
  truth: z.boolean(),
});

export const SourceRefSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("person"), id: PersonIdSchema }),
  z.strictObject({ kind: z.literal("location"), id: LocationIdSchema }),
  z.strictObject({ kind: z.literal("item"), id: ItemIdSchema }),
  z.strictObject({ kind: z.literal("event"), id: EventIdSchema }),
]);

export const EvidenceLinkSchema = z.strictObject({
  propositionId: PropositionIdSchema,
  direction: z.enum(["supports", "refutes"]),
});

export const EvidenceSchema = z
  .strictObject({
    id: EvidenceIdSchema,
    description: TextSchema,
    source: SourceRefSchema,
    links: z.array(EvidenceLinkSchema).min(1),
  })
  .superRefine((evidence, ctx) => {
    const seen = new Set<string>();
    evidence.links.forEach((link, index) => {
      if (seen.has(link.propositionId)) {
        ctx.addIssue({
          code: "custom",
          message: "Evidence must address each proposition at most once",
          path: ["links", index, "propositionId"],
        });
      }
      seen.add(link.propositionId);
    });
  });

export const SecretSchema = z.strictObject({
  id: SecretIdSchema,
  propositionIds: nonEmptyUniqueList(PropositionIdSchema),
});

export const RedHerringSchema = z.strictObject({
  id: RedHerringIdSchema,
  evidenceIds: nonEmptyUniqueList(EvidenceIdSchema),
  misleadingPropositionId: PropositionIdSchema,
});

export type TimeSpan = z.output<typeof TimeSpanSchema>;
export type Person = z.output<typeof PersonSchema>;
export type Location = z.output<typeof LocationSchema>;
export type Item = z.output<typeof ItemSchema>;
export type Relationship = z.output<typeof RelationshipSchema>;
export type CaseEvent = z.output<typeof EventSchema>;
export type Motive = z.output<typeof MotiveSchema>;
export type Claim = z.output<typeof ClaimSchema>;
export type Proposition = z.output<typeof PropositionSchema>;
export type SourceRef = z.output<typeof SourceRefSchema>;
export type EvidenceLink = z.output<typeof EvidenceLinkSchema>;
export type Evidence = z.output<typeof EvidenceSchema>;
export type Secret = z.output<typeof SecretSchema>;
export type RedHerring = z.output<typeof RedHerringSchema>;

// ---------- Root ----------

const CaseTruthShapeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  caseId: CaseIdSchema,
  revision: z.int().positive(),
  title: TextSchema,
  timeline: z.strictObject({ unit: z.literal("second"), originLabel: TextSchema }),
  persons: z.array(PersonSchema),
  locations: z.array(LocationSchema),
  items: z.array(ItemSchema),
  relationships: z.array(RelationshipSchema),
  events: z.array(EventSchema),
  motives: z.array(MotiveSchema),
  propositions: z.array(PropositionSchema),
  evidence: z.array(EvidenceSchema),
  secrets: z.array(SecretSchema),
  redHerrings: z.array(RedHerringSchema),
});

type CaseTruthShape = z.output<typeof CaseTruthShapeSchema>;
type Path = (string | number)[];
type Ctx = z.RefinementCtx<CaseTruthShape>;

function checkReferenceIntegrity(truth: CaseTruthShape, ctx: Ctx): void {
  const collections = [
    "persons",
    "locations",
    "items",
    "relationships",
    "events",
    "motives",
    "propositions",
    "evidence",
    "secrets",
    "redHerrings",
  ] as const;

  const known = new Set<string>();
  for (const collection of collections) {
    truth[collection].forEach((entity, index) => {
      if (known.has(entity.id)) {
        ctx.addIssue({ code: "custom", message: `Duplicate ID "${entity.id}"`, path: [collection, index, "id"] });
      }
      known.add(entity.id);
    });
  }

  // ID prefixes are type-checked by the schemas, so existence of the exact ID
  // implies existence in the collection of the expected entity type.
  const ref = (id: string, path: Path) => {
    if (!known.has(id)) {
      ctx.addIssue({ code: "custom", message: `Unresolved reference "${id}"`, path });
    }
  };
  const refs = (ids: readonly string[], path: Path) => ids.forEach((id, i) => ref(id, [...path, i]));

  truth.relationships.forEach((rel, i) => {
    ref(rel.fromPersonId, ["relationships", i, "fromPersonId"]);
    ref(rel.toPersonId, ["relationships", i, "toPersonId"]);
  });
  truth.events.forEach((event, i) => {
    ref(event.locationId, ["events", i, "locationId"]);
    refs(event.participantIds, ["events", i, "participantIds"]);
    refs(event.itemIds, ["events", i, "itemIds"]);
    refs(event.causedByEventIds, ["events", i, "causedByEventIds"]);
  });
  truth.motives.forEach((motive, i) => {
    ref(motive.personId, ["motives", i, "personId"]);
    refs(motive.eventIds, ["motives", i, "eventIds"]);
  });
  truth.propositions.forEach(({ claim }, i) => {
    const path = ["propositions", i, "claim"];
    switch (claim.kind) {
      case "personAt":
        ref(claim.personId, [...path, "personId"]);
        ref(claim.locationId, [...path, "locationId"]);
        break;
      case "eventHasParticipant":
        ref(claim.eventId, [...path, "eventId"]);
        ref(claim.personId, [...path, "personId"]);
        break;
      case "eventHasItem":
        ref(claim.eventId, [...path, "eventId"]);
        ref(claim.itemId, [...path, "itemId"]);
        break;
    }
  });
  truth.evidence.forEach((evidence, i) => {
    ref(evidence.source.id, ["evidence", i, "source", "id"]);
    evidence.links.forEach((link, j) => ref(link.propositionId, ["evidence", i, "links", j, "propositionId"]));
  });
  truth.secrets.forEach((secret, i) => refs(secret.propositionIds, ["secrets", i, "propositionIds"]));
  truth.redHerrings.forEach((herring, i) => {
    refs(herring.evidenceIds, ["redHerrings", i, "evidenceIds"]);
    ref(herring.misleadingPropositionId, ["redHerrings", i, "misleadingPropositionId"]);
  });
}

// ---------- Immutability ----------

export type DeepReadonly<T> = T extends string | number | boolean | null
  ? T
  : T extends readonly (infer U)[]
    ? ReadonlyArray<DeepReadonly<U>>
    : { readonly [K in keyof T]: DeepReadonly<T[K]> };

export const CaseTruthSchema = CaseTruthShapeSchema.superRefine(checkReferenceIntegrity)
  .transform((truth) => deepFreeze(structuredClone(truth)) as DeepReadonly<CaseTruthShape>)
  .brand<"CaseTruth">();

/** Plain, mutable authoring input accepted by the parser. */
export type CaseTruthInput = z.input<typeof CaseTruthSchema>;

/** Deeply frozen, nominally branded snapshot. Only obtainable through parsing. */
export type CaseTruth = z.output<typeof CaseTruthSchema>;

export function parseCaseTruth(input: unknown): CaseTruth {
  return CaseTruthSchema.parse(input);
}
