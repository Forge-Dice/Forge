import { z } from "zod";
import type { NpcVisibleClaim, NpcVisibleContext, VisibleRef } from "./npc-knowledge.projection.ts";

// Deterministic NPC dialogue policy (TASK-0005).
// NpcVisibleContext + bound structured query + bound runtime policy -> exactly one
// communicative act. No natural language, no world lookup, no inference. The engine only
// ever sees a projected context: no truth, no solution, no snapshot, no domain IDs.
// Bindings are in-process only: input refs must be the context's own ref objects, and
// parsed inputs are accepted only by the engine that parsed them (private WeakSets).

// ---------- Local types ----------

type DeepReadonly<T> = T extends string | number | boolean | null
  ? T
  : T extends readonly (infer U)[]
    ? ReadonlyArray<DeepReadonly<U>>
    : { readonly [K in keyof T]: DeepReadonly<T[K]> };

type Attitude = NpcVisibleContext["attitudes"][number];
type Stance = Attitude["stance"];
type StatementRef = VisibleRef<"proposition" | "conclusion">;
type Path = (string | number)[];

// ---------- Strict private shapes ----------

const TickSchema = z
  .int()
  .min(0)
  .refine((value) => !Object.is(value, -0), "Tick must not be -0");
const IndexSchema = z.int().positive();

function refSchema<K extends string>(kind: K) {
  return z.strictObject({ kind: z.literal(kind), index: IndexSchema });
}

const PersonRef = refSchema("person");
const LocationRef = refSchema("location");
const ItemRef = refSchema("item");
const EventRef = refSchema("event");

const RoleSchema = z.enum(["direct_actor", "planner", "facilitator"]);
const IntentSchema = z.enum(["intended", "unintended", "not_applicable"]);
const MechanismSchema = z.enum(["ordinary", "supernatural", "mixed"]);

const ClaimShape = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("personAt"), person: PersonRef, location: LocationRef, at: TickSchema }),
  z.strictObject({ kind: z.literal("eventHasParticipant"), event: EventRef, person: PersonRef }),
  z.strictObject({ kind: z.literal("eventHasItem"), event: EventRef, item: ItemRef }),
  z.strictObject({ kind: z.literal("personResponsibleForEvent"), person: PersonRef, event: EventRef }),
  z.strictObject({ kind: z.literal("personRoleForEvent"), person: PersonRef, event: EventRef, role: RoleSchema }),
  z.strictObject({ kind: z.literal("noPersonResponsibleForEvent"), event: EventRef }),
  z.strictObject({ kind: z.literal("eventCausedEvent"), causeEvent: EventRef, event: EventRef }),
  z.strictObject({ kind: z.literal("eventIntent"), event: EventRef, value: IntentSchema }),
  z.strictObject({ kind: z.literal("eventMechanism"), event: EventRef, value: MechanismSchema }),
]);

const QueryShape = z.strictObject({ kind: z.literal("ask_about_claim"), claim: ClaimShape });

const StatementRefShape = z.strictObject({
  kind: z.enum(["proposition", "conclusion"]),
  index: IndexSchema,
});

const PolicyShape = z.strictObject({
  schemaVersion: z.literal(1),
  defaultAction: z.enum(["answer", "refuse", "evade"]),
  rules: z.array(
    z.strictObject({
      subject: StatementRefShape,
      action: z.enum(["answer", "refuse", "evade", "invert", "feign_ignorance"]),
    }),
  ),
});

/** Authoring input of a query. Refs must be the context's own ref objects. */
export type DialogueQueryInput = z.input<typeof QueryShape>;

/** Authoring input of a runtime policy. Rule subjects must be the context's own attitude subjects. */
export type RuntimeDialoguePolicyInput = z.input<typeof PolicyShape>;

type ParsedClaim = DeepReadonly<z.output<typeof ClaimShape>>;
type ParsedQuery = DeepReadonly<z.output<typeof QueryShape>>;
type ParsedPolicy = DeepReadonly<z.output<typeof PolicyShape>>;
type RuleAction = ParsedPolicy["rules"][number]["action"];

// ---------- Acts, decisions, results ----------

export type CommunicativeAct =
  | {
      readonly kind: "assert";
      readonly subject: StatementRef;
      readonly claim: NpcVisibleClaim;
      readonly value: boolean;
      readonly commitment: "unqualified" | "belief";
    }
  | {
      readonly kind: "express_uncertainty";
      readonly subject: StatementRef;
      readonly claim: NpcVisibleClaim;
      readonly leaning: boolean | null;
    }
  | { readonly kind: "claim_ignorance" }
  | { readonly kind: "refuse" }
  | { readonly kind: "evade" };

export type PolicyDecision = {
  readonly intent: "sincere" | "deceptive" | "withholding";
  readonly act: CommunicativeAct;
};

export type PolicyResult =
  | { readonly success: true; readonly decision: PolicyDecision }
  | { readonly success: false; readonly code: "DIALOGUE_CONTEXT_MISMATCH" };

const CONTEXT_MISMATCH: PolicyResult = Object.freeze({ success: false, code: "DIALOGUE_CONTEXT_MISMATCH" });

// ---------- Private helpers ----------

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function refKey(ref: { readonly kind: string; readonly index: number }): string {
  return `${ref.kind}|${ref.index}`;
}

function copyRef<K extends string>(ref: { readonly kind: K; readonly index: number }): { kind: K; index: number } {
  return { kind: ref.kind, index: ref.index };
}

/** Entity ref fields of each claim kind, in output order. */
function claimRefFields(claim: { readonly kind: ParsedClaim["kind"] }): readonly ("person" | "location" | "item" | "event" | "causeEvent")[] {
  switch (claim.kind) {
    case "personAt":
      return ["person", "location"];
    case "eventHasParticipant":
      return ["event", "person"];
    case "eventHasItem":
      return ["event", "item"];
    case "personResponsibleForEvent":
    case "personRoleForEvent":
      return ["person", "event"];
    case "noPersonResponsibleForEvent":
    case "eventIntent":
    case "eventMechanism":
      return ["event"];
    case "eventCausedEvent":
      return ["causeEvent", "event"];
  }
}

function refAt(claim: object, field: string): VisibleRef {
  return (claim as Record<string, VisibleRef>)[field]!;
}

// Field-by-field reconstruction in the fixed output order of §13. Exhaustive over the nine
// allowed claim kinds; a new kind fails to compile instead of being released.
function copyClaim(claim: ParsedClaim | NpcVisibleClaim): NpcVisibleClaim {
  switch (claim.kind) {
    case "personAt":
      return { kind: "personAt", person: copyRef(claim.person), location: copyRef(claim.location), at: claim.at };
    case "eventHasParticipant":
      return { kind: "eventHasParticipant", event: copyRef(claim.event), person: copyRef(claim.person) };
    case "eventHasItem":
      return { kind: "eventHasItem", event: copyRef(claim.event), item: copyRef(claim.item) };
    case "personResponsibleForEvent":
      return { kind: "personResponsibleForEvent", person: copyRef(claim.person), event: copyRef(claim.event) };
    case "personRoleForEvent":
      return { kind: "personRoleForEvent", person: copyRef(claim.person), event: copyRef(claim.event), role: claim.role };
    case "noPersonResponsibleForEvent":
      return { kind: "noPersonResponsibleForEvent", event: copyRef(claim.event) };
    case "eventCausedEvent":
      return { kind: "eventCausedEvent", causeEvent: copyRef(claim.causeEvent), event: copyRef(claim.event) };
    case "eventIntent":
      return { kind: "eventIntent", event: copyRef(claim.event), value: claim.value };
    case "eventMechanism":
      return { kind: "eventMechanism", event: copyRef(claim.event), value: claim.value };
  }
}

/** Private canonical claim key: the fixed-order copy makes JSON key order canonical. */
function claimKey(claim: ParsedClaim | NpcVisibleClaim): string {
  return JSON.stringify(copyClaim(claim));
}

/**
 * Data-form pre-check on the original input (§8 step 1), using property descriptors only:
 * no getter is ever called. Plain or null-prototype objects and dense plain arrays only;
 * no symbols, accessors, hidden properties or cycles. Shared subobjects are fine.
 */
function checkDataForm(value: unknown, path: Path, ancestors: object[], issue: (message: string, path: Path) => void): boolean {
  if (typeof value !== "object" || value === null) return true;
  if (ancestors.includes(value)) {
    issue("Cyclic structure", path);
    return false;
  }
  const isArray = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (isArray ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
    issue("Unsupported prototype", path);
    return false;
  }
  let ok = true;
  const children: [string, unknown][] = [];
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "symbol") {
      issue("Symbol properties are not allowed", path);
      ok = false;
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (isArray && key === "length") continue;
    if (!("value" in descriptor)) {
      issue("Accessor properties are not allowed", [...path, key]);
      ok = false;
    } else if (!descriptor.enumerable) {
      issue("Non-enumerable properties are not allowed", [...path, key]);
      ok = false;
    } else if (isArray && !(/^(0|[1-9][0-9]*)$/.test(key) && Number(key) < (value as unknown[]).length)) {
      // An index is below length; "4294967295" (2**32 - 1) looks like one but is a plain property.
      issue("Extra array properties are not allowed", [...path, key]);
      ok = false;
    } else {
      children.push([key, descriptor.value]);
    }
  }
  if (isArray) {
    const length = (value as unknown[]).length;
    for (let i = 0; i < length; i++) {
      if (!Object.prototype.hasOwnProperty.call(value, String(i))) {
        issue("Sparse arrays are not allowed", [...path, i]);
        ok = false;
      }
    }
  }
  if (!ok) return false;
  const inner = [...ancestors, value];
  for (const [key, child] of children) {
    const childPath = [...path, isArray ? Number(key) : key];
    if (!checkDataForm(child, childPath, inner, issue)) ok = false;
  }
  return ok;
}

type Issue = (message: string, path: Path) => void;

/** §8 steps 1-2 on the original input. Returns the validated input, or null after reporting issues. */
function checkShape<S extends z.ZodType>(shape: S, input: unknown, ctx: z.RefinementCtx<unknown>): z.output<S> | null {
  const issue: Issue = (message, path) => ctx.addIssue({ code: "custom", message, path, continue: false });
  if (!checkDataForm(input, [], [], issue)) return null;
  const parsed = shape.safeParse(input);
  if (parsed.success) return parsed.data;
  // Shape issues keep their zod code and path. Every issue aborts, so no transform runs after it.
  for (const zodIssue of parsed.error.issues) ctx.addIssue({ ...zodIssue, continue: false } as Parameters<typeof ctx.addIssue>[0]);
  return null;
}

function actFor(action: RuleAction, attitude: Attitude | undefined): PolicyDecision {
  if (action === "refuse") return { intent: "withholding", act: { kind: "refuse" } };
  if (action === "evade") return { intent: "withholding", act: { kind: "evade" } };
  if (attitude === undefined) return { intent: "sincere", act: { kind: "claim_ignorance" } };
  if (action === "feign_ignorance") return { intent: "deceptive", act: { kind: "claim_ignorance" } };
  const stance: Stance = attitude.stance;
  const subject = copyRef(attitude.subject);
  const claim = copyClaim(attitude.claim);
  if (stance.kind === "uncertain") {
    // Unreachable for invert: invert on an uncertain attitude fails policy parsing.
    return { intent: "sincere", act: { kind: "express_uncertainty", subject, claim, leaning: stance.leaning } };
  }
  const commitment = stance.kind === "knowledge" ? "unqualified" : "belief";
  if (action === "invert") {
    return { intent: "deceptive", act: { kind: "assert", subject, claim, value: !stance.value, commitment } };
  }
  return { intent: "sincere", act: { kind: "assert", subject, claim, value: stance.value, commitment } };
}

// ---------- Engine ----------

function bindEngine(context: NpcVisibleContext) {
  // Provenance sets: the context's own ref objects (§7.1). No reverse map to domain IDs.
  const entityRefs = new WeakSet<object>([context.self, ...context.awareness]);
  const statementRefs = new WeakSet<object>();
  const visiblePairs = new Set<string>([refKey(context.self), ...context.awareness.map(refKey)]);
  const attitudesByClaim = new Map<string, Attitude>();
  const attitudesBySubject = new Map<string, Attitude>();
  for (const attitude of context.attitudes) {
    statementRefs.add(attitude.subject);
    visiblePairs.add(refKey(attitude.subject));
    for (const field of claimRefFields(attitude.claim)) {
      const ref = refAt(attitude.claim, field);
      entityRefs.add(ref);
      visiblePairs.add(refKey(ref));
    }
    attitudesByClaim.set(claimKey(attitude.claim), attitude);
    attitudesBySubject.set(refKey(attitude.subject), attitude);
  }

  // Parsed inputs owned by this engine (§7.2).
  const ownedQueries = new WeakSet<object>();
  const ownedPolicies = new WeakSet<object>();

  const isOwnRef = (set: WeakSet<object>, ref: { readonly kind: string; readonly index: number }) =>
    set.has(ref) && visiblePairs.has(refKey(ref));

  const querySchema = z
    .custom<DialogueQueryInput>()
    .superRefine((input, ctx) => {
      const query = checkShape(QueryShape, input, ctx);
      if (query === null) return;
      // §8 step 3: provenance of the original, not yet cloned ref objects.
      const original = (input as DialogueQueryInput).claim;
      for (const field of claimRefFields(query.claim)) {
        const ref = refAt(original, field);
        if (!isOwnRef(entityRefs, ref)) {
          ctx.addIssue({ code: "custom", message: "Ref does not come from this context", path: ["claim", field], continue: false });
        }
      }
    })
    .transform((input): ParsedQuery => {
      const shaped = QueryShape.safeParse(input);
      if (!shaped.success) return z.NEVER; // already reported (zod pipes past unrecognized_keys)
      const query = shaped.data;
      const parsed: ParsedQuery = deepFreeze({ kind: "ask_about_claim", claim: copyClaim(query.claim) });
      ownedQueries.add(parsed);
      return parsed;
    })
    .brand<"DialogueQuery">();

  const policySchema = z
    .custom<RuntimeDialoguePolicyInput>()
    .superRefine((input, ctx) => {
      const policy = checkShape(PolicyShape, input, ctx);
      if (policy === null) return;
      const originalRules = (input as RuntimeDialoguePolicyInput).rules;
      const seen = new Set<string>();
      policy.rules.forEach((rule, i) => {
        const issue = (message: string, field: "subject" | "action") =>
          ctx.addIssue({ code: "custom", message, path: ["rules", i, field], continue: false });
        // Provenance first: only the context's own attitude subjects address a rule.
        if (!isOwnRef(statementRefs, originalRules[i]!.subject)) {
          issue("Subject does not come from this context", "subject");
          return;
        }
        const key = refKey(rule.subject);
        if (seen.has(key)) issue("Duplicate rule for this subject", "subject");
        seen.add(key);
        const attitude = attitudesBySubject.get(key)!;
        if (rule.action === "invert" && attitude.stance.kind === "uncertain") {
          issue("invert is not allowed on an uncertain attitude", "action");
        }
        if (rule.action === "feign_ignorance" && policy.defaultAction !== "answer") {
          issue("feign_ignorance is only allowed under defaultAction answer", "action");
        }
      });
    })
    .transform((input): ParsedPolicy => {
      const shaped = PolicyShape.safeParse(input);
      if (!shaped.success) return z.NEVER; // already reported (zod pipes past unrecognized_keys)
      const policy = shaped.data;
      const parsed: ParsedPolicy = deepFreeze({
        schemaVersion: 1,
        defaultAction: policy.defaultAction,
        rules: policy.rules.map((rule) => ({ subject: copyRef(rule.subject), action: rule.action })),
      });
      ownedPolicies.add(parsed);
      return parsed;
    })
    .brand<"RuntimeDialoguePolicy">();

  function evaluate(query: DialogueQuery, policy: RuntimeDialoguePolicy): PolicyResult {
    if (!ownedQueries.has(query) || !ownedPolicies.has(policy)) return CONTEXT_MISMATCH;
    const attitude = attitudesByClaim.get(claimKey(query.claim));
    let action: RuleAction = policy.defaultAction;
    if (attitude !== undefined) {
      const subject = refKey(attitude.subject);
      const rule = policy.rules.find((candidate) => refKey(candidate.subject) === subject);
      if (rule !== undefined) action = rule.action;
    }
    const decision = actFor(action, attitude);
    return deepFreeze({ success: true, decision: { intent: decision.intent, act: decision.act } });
  }

  return { querySchema, policySchema, evaluate };
}

type BoundEngine = ReturnType<typeof bindEngine>;

/** Deeply readonly query parsed by one engine. Only that engine's evaluate accepts it. */
export type DialogueQuery = z.output<BoundEngine["querySchema"]>;

/** Deeply readonly runtime policy parsed by one engine. Only that engine's evaluate accepts it. */
export type RuntimeDialoguePolicy = z.output<BoundEngine["policySchema"]>;

export type DialoguePolicyEngine = {
  readonly querySchema: BoundEngine["querySchema"];
  readonly policySchema: BoundEngine["policySchema"];
  evaluate(query: DialogueQuery, policy: RuntimeDialoguePolicy): PolicyResult;
};

/**
 * Precondition (§7.3): `context` is an unchanged, successful projectNpcKnowledge context.
 * The constructor does not validate it and never mutates it.
 */
export function createDialoguePolicyEngine(context: NpcVisibleContext): DialoguePolicyEngine {
  return Object.freeze(bindEngine(context));
}
