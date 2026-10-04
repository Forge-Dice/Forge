import { z } from "zod";
import {
  CaseIdSchema,
  EventIdSchema,
  EvidenceIdSchema,
  ItemIdSchema,
  LocationIdSchema,
  PersonIdSchema,
  PropositionIdSchema,
  type CaseTruth,
  type DeepReadonly,
} from "./case-truth.ts";
import { hashCaseTruth } from "./case-truth.identity.ts";
import { ConclusionIdSchema, evaluateConclusionClaim, type CaseSolution } from "./case-solution.ts";
import { hashCaseSolution } from "./case-solution.identity.ts";
import { byCodeUnits, deepFreeze } from "./shared.ts";

// Minimum solvability V1 (MYST-SOLVABILITY-0001), author-side only: AND implications over replayed,
// released observations plus all 2^n answer vectors over a small scope. PASS means derivable under
// published case rules. Truth/solution only validate released facts and consequences, never seed them.
// Lies (V2): a released NPC report the host names as a lie is never a premise; if the required
// answer is derivable only through such reports, LIE_ONLY_PATH fails the case.

const Hash = z.string().regex(/^[0-9a-f]{64}$/);
const LocalId = z.string().regex(/^[a-z][a-z0-9:_-]{0,63}$/);
const StepId = z.string().regex(/^[\x21-\x7e]{1,128}$/);

const PropositionLiteral = z.strictObject({ kind: z.literal("proposition"), propositionId: PropositionIdSchema, value: z.boolean() });
const ProofLiteral = z.discriminatedUnion("kind", [
  PropositionLiteral,
  z.strictObject({ kind: z.literal("conclusion"), conclusionId: ConclusionIdSchema, value: z.boolean() }),
]);
const EntityRef = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("person"), id: PersonIdSchema }),
  z.strictObject({ kind: z.literal("location"), id: LocationIdSchema }),
  z.strictObject({ kind: z.literal("item"), id: ItemIdSchema }),
  z.strictObject({ kind: z.literal("event"), id: EventIdSchema }),
  z.strictObject({ kind: z.literal("evidence"), id: EvidenceIdSchema }),
]);
const RuleDescriptor = z.strictObject({ edgeId: LocalId, allOf: z.array(LocalId).min(1), yields: ProofLiteral });
const ReleasedObservationSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    id: LocalId,
    kind: z.literal("OBSERVED"),
    literal: PropositionLiteral,
    source: z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("initial") }),
      z.strictObject({ kind: z.literal("evidence"), evidenceId: EvidenceIdSchema }),
    ]),
  }),
  z.strictObject({ id: LocalId, kind: z.literal("REPORTED_BY_NPC"), npcId: PersonIdSchema, literal: ProofLiteral }),
  z.strictObject({ id: LocalId, kind: z.literal("ENTITY_AWARENESS"), entity: EntityRef }),
  z.strictObject({ id: LocalId, kind: z.literal("PUBLIC_RULE"), rules: z.array(RuleDescriptor).min(1).max(128) }),
]);
const BindingsSchema = z.strictObject({ caseId: CaseIdSchema, truthHash: Hash, solutionHash: Hash, releaseHash: Hash });
const ProofNodeSchema = z.discriminatedUnion("kind", [
  z.strictObject({ id: LocalId, kind: z.literal("observation"), observationId: LocalId }),
  z.strictObject({ id: LocalId, kind: z.literal("literal"), literal: ProofLiteral }),
]);
const ProofEdgeSchema = z.strictObject({ id: LocalId, allOf: z.array(LocalId).min(1), to: LocalId, license: LocalId });

const ProfileShape = z.strictObject({
  schemaVersion: z.literal(1),
  bindings: BindingsSchema,
  answerScope: z.array(ConclusionIdSchema).min(1).max(6),
  ambiguityPolicy: z.enum(["must_disambiguate", "may_remain_ambiguous"]),
  question: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("required_literals") }),
    z.strictObject({ kind: z.literal("identify_all_responsible"), eventId: EventIdSchema }),
  ]),
  observations: z.array(ReleasedObservationSchema).max(64),
  nodes: z.array(ProofNodeSchema).min(1).max(128),
  edges: z.array(ProofEdgeSchema).max(128),
  witnessStepIds: z.array(StepId).max(256),
});
const PortResultSchema = z.discriminatedUnion("success", [
  z.strictObject({ success: z.literal(true), bindings: BindingsSchema, released: z.array(ReleasedObservationSchema).max(256) }),
  z.strictObject({ success: z.literal(false), code: z.enum(["REPLAY_UNAVAILABLE", "INVALID_WITNESS"]) }),
]);

type Shape = z.output<typeof ProfileShape>;
type Literal = DeepReadonly<z.output<typeof ProofLiteral>>;
type Path = (string | number)[];

export type ProofBindings = DeepReadonly<z.output<typeof BindingsSchema>>;
export type ReleasedObservation = DeepReadonly<z.output<typeof ReleasedObservationSchema>>;

/** Canonical JSON: keys sorted, arrays treated as sets. Used for payload and literal equality. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).sort(byCodeUnits).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const keys = Object.keys(value).sort(byCodeUnits);
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Canonical status of a literal's claim: true/false, "undetermined", or null for an unknown reference. */
function canonicalValue(literal: Literal, truth: CaseTruth, solution: CaseSolution): boolean | "undetermined" | null {
  if (literal.kind === "proposition") return truth.propositions.find((p) => p.id === literal.propositionId)?.truth ?? null;
  const conclusion = solution.conclusions.find((c) => c.id === literal.conclusionId);
  if (conclusion === undefined) return null;
  const evaluation = evaluateConclusionClaim(truth, solution, conclusion.claim);
  return evaluation.success ? evaluation.status : null;
}

// ---------- Bound parser ----------

function checkProfile(p: Shape, truth: CaseTruth, solution: CaseSolution, ctx: z.RefinementCtx<Shape>): void {
  const issue = (message: string, path: Path) => ctx.addIssue({ code: "custom", message, path });
  const truthHash = hashCaseTruth(truth);
  if (solution.caseId !== truth.caseId || solution.truthHash !== truthHash) return issue("Solution is not bound to the truth", ["bindings"]);
  const expected = { caseId: truth.caseId, truthHash, solutionHash: hashCaseSolution(solution) };
  const mismatched = (["caseId", "truthHash", "solutionHash"] as const).filter((key) => p.bindings[key] !== expected[key]);
  mismatched.forEach((key) => issue(`${key} does not match`, ["bindings", key]));
  if (mismatched.length > 0) return; // binding first: no reference checks against a foreign case

  const ids = {
    person: new Set<string>(truth.persons.map((x) => x.id)),
    location: new Set<string>(truth.locations.map((x) => x.id)),
    item: new Set<string>(truth.items.map((x) => x.id)),
    event: new Set<string>(truth.events.map((x) => x.id)),
    evidence: new Set<string>(truth.evidence.map((x) => x.id)),
    proposition: new Set<string>(truth.propositions.map((x) => x.id)),
    conclusion: new Set<string>(solution.conclusions.map((x) => x.id)),
  };
  const literalRef = (literal: Literal, path: Path) => {
    const [kind, id] = literal.kind === "proposition" ? (["proposition", literal.propositionId] as const) : (["conclusion", literal.conclusionId] as const);
    if (!ids[kind].has(id)) issue(`Unknown ${kind} "${id}"`, [...path, `${kind}Id`]);
  };
  const unique = (values: readonly string[], path: Path) => {
    const seen = new Set<string>();
    values.forEach((value, i) => (seen.has(value) ? issue(`Duplicate "${value}"`, [...path, i]) : seen.add(value)));
  };

  unique(p.answerScope, ["answerScope"]);
  p.answerScope.forEach((id, i) => ids.conclusion.has(id) || issue(`Unknown conclusion "${id}"`, ["answerScope", i]));
  solution.requiredConclusions.forEach(
    (literal) => p.answerScope.includes(literal.conclusionId) || issue(`Required "${literal.conclusionId}" outside answerScope`, ["answerScope"]),
  );
  if (p.question.kind === "identify_all_responsible" && !ids.event.has(p.question.eventId)) issue("Unknown event", ["question", "eventId"]);

  unique(p.observations.map((o) => o.id), ["observations"]);
  const edgeIds = new Set(p.edges.map((e) => e.id));
  const nodeIds = new Set(p.nodes.map((n) => n.id));
  p.observations.forEach((o, i) => {
    const path = ["observations", i];
    if (o.kind === "OBSERVED" || o.kind === "REPORTED_BY_NPC") literalRef(o.literal, [...path, "literal"]);
    if (o.kind === "OBSERVED" && o.source.kind === "evidence" && !ids.evidence.has(o.source.evidenceId)) issue("Unknown evidence", [...path, "source", "evidenceId"]);
    if (o.kind === "REPORTED_BY_NPC" && !ids.person.has(o.npcId)) issue("Unknown person", [...path, "npcId"]);
    if (o.kind === "ENTITY_AWARENESS" && !ids[o.entity.kind].has(o.entity.id)) issue("Unknown entity", [...path, "entity", "id"]);
    if (o.kind === "PUBLIC_RULE") {
      o.rules.forEach((rule, j) => {
        if (!edgeIds.has(rule.edgeId)) issue(`Unknown edge "${rule.edgeId}"`, [...path, "rules", j, "edgeId"]);
        unique(rule.allOf, [...path, "rules", j, "allOf"]);
        rule.allOf.forEach((n, k) => nodeIds.has(n) || issue(`Unknown node "${n}"`, [...path, "rules", j, "allOf", k]));
        literalRef(rule.yields, [...path, "rules", j, "yields"]);
      });
    }
  });
  unique(p.observations.flatMap((o) => (o.kind === "PUBLIC_RULE" ? o.rules.map((r) => r.edgeId) : [])), ["observations"]);

  unique(p.nodes.map((n) => n.id), ["nodes"]);
  const observationKinds = new Map(p.observations.map((o) => [o.id, o.kind]));
  const nodes = new Map(p.nodes.map((n) => [n.id, n]));
  p.nodes.forEach((n, i) => {
    if (n.kind === "observation" && !observationKinds.has(n.observationId)) issue("Unknown observation", ["nodes", i, "observationId"]);
    if (n.kind === "literal") literalRef(n.literal, ["nodes", i, "literal"]);
  });

  unique(p.edges.map((e) => e.id), ["edges"]);
  const structural = new Set<string>();
  p.edges.forEach((e, i) => {
    const path = ["edges", i];
    unique(e.allOf, [...path, "allOf"]);
    e.allOf.forEach((n, k) => nodes.has(n) || issue(`Unknown node "${n}"`, [...path, "allOf", k]));
    if (nodes.get(e.to)?.kind !== "literal") issue("to must be a literal node", [...path, "to"]);
    const license = nodes.get(e.license);
    if (license?.kind !== "observation" || observationKinds.get(license.observationId) !== "PUBLIC_RULE") {
      issue("license must be a PUBLIC_RULE observation node", [...path, "license"]);
    }
    if (!e.allOf.includes(e.license)) issue("license must be part of allOf", [...path, "allOf"]);
    if (e.allOf.every((n) => n === e.license)) issue("allOf needs a premise besides the license", [...path, "allOf"]);
    const target = nodes.get(e.to);
    const key = canonical([e.allOf, e.license, target?.kind === "literal" ? target.literal : e.to]);
    if (structural.has(key)) issue("Structural duplicate edge", path);
    structural.add(key);
  });
}

export function createCaseProofProfileSchema(truth: CaseTruth, solution: CaseSolution) {
  return ProfileShape.superRefine((p, ctx) => checkProfile(p, truth, solution, ctx), { when: (payload) => payload.issues.length === 0 })
    .transform((p) => deepFreeze(structuredClone(p)) as DeepReadonly<Shape>)
    .brand<"CaseProofProfile">();
}

export type CaseProofProfileInput = z.input<ReturnType<typeof createCaseProofProfileSchema>>;
export type CaseProofProfile = z.output<ReturnType<typeof createCaseProofProfileSchema>>;

export function parseCaseProofProfile(input: unknown, truth: CaseTruth, solution: CaseSolution): CaseProofProfile {
  return createCaseProofProfileSchema(truth, solution).parse(input);
}

// ---------- Checker ----------

export type WitnessReplayResult =
  | { readonly success: true; readonly bindings: ProofBindings; readonly released: readonly ReleasedObservation[] }
  | { readonly success: false; readonly code: "REPLAY_UNAVAILABLE" | "INVALID_WITNESS" };
export type WitnessReplay = (orderedStepIds: readonly string[]) => WitnessReplayResult;

export type ProofFindingCode =
  | "BINDING_MISMATCH" | "REPLAY_UNAVAILABLE" | "INVALID_WITNESS" | "INVALID_REPLAY_RESULT" | "RELEASE_RECORD_MISMATCH"
  | "FALSE_OBSERVATION" | "REQUIRED_NOT_DERIVED" | "PREMISE_NOT_REACHED" | "NONCANONICAL_INFERENCE" | "UNPUBLISHED_RULE"
  | "PROOF_CYCLE" | "NO_SURVIVING_HYPOTHESIS" | "REQUIRED_AMBIGUOUS" | "AMBIGUITY_POLICY_VIOLATION"
  | "ANSWER_SCOPE_INVALID_FOR_QUESTION" | "FULL_ANSWER_INCOMPLETE" | "POSITIVE_ANSWER_NOT_REQUIRED"
  | "LIE_ONLY_PATH" | "LIED_REPORT_IGNORED";

export type ProofFinding = {
  readonly code: ProofFindingCode;
  readonly subjectIds: readonly string[];
  readonly path: readonly (string | number)[];
  readonly relatedIds: readonly string[];
  readonly severity: "error" | "warning";
};
export type HypothesisVector = readonly { readonly conclusionId: string; readonly value: boolean }[];
export type SolvabilityReport = {
  readonly status: "pass" | "fail" | "unknown";
  readonly findings: readonly ProofFinding[];
  readonly survivingAnswerCount: number;
  readonly competingAnswerSamples: readonly HypothesisVector[];
};

const WARNINGS = new Set<ProofFindingCode>(["PROOF_CYCLE", "PREMISE_NOT_REACHED", "UNPUBLISHED_RULE", "LIED_REPORT_IGNORED"]);

/** A statement the trusted host knows to be a lie: this NPC falsely reports this literal. */
export type KnownLie = { readonly npcId: string; readonly literal: { readonly kind: "proposition"; readonly propositionId: string; readonly value: boolean } };
export type SolvabilityOptions = { readonly lies?: readonly KnownLie[] };

function report(status: SolvabilityReport["status"], findings: ProofFinding[], count = 0, samples: HypothesisVector[] = []): SolvabilityReport {
  const key = (f: ProofFinding) => JSON.stringify([f.code, f.path, f.subjectIds, f.relatedIds]);
  const sorted = findings.sort((a, b) => byCodeUnits(key(a), key(b)));
  const final = status === "pass" && sorted.some((f) => f.severity === "error") ? "fail" : status;
  return deepFreeze({ status: final, findings: sorted, survivingAnswerCount: count, competingAnswerSamples: samples });
}

export function checkCaseSolvability(
  truth: CaseTruth,
  solution: CaseSolution,
  profile: CaseProofProfile,
  replayWitness: WitnessReplay,
  options: SolvabilityOptions = {},
): SolvabilityReport {
  const findings: ProofFinding[] = [];
  const add = (code: ProofFindingCode, subjectIds: string[], path: Path = [], relatedIds: string[] = []) =>
    findings.push({ code, subjectIds: [...subjectIds].sort(byCodeUnits), path, relatedIds: [...relatedIds].sort(byCodeUnits), severity: WARNINGS.has(code) ? "warning" : "error" });

  // 1. Current binding of truth, solution and profile.
  const bindings = profile.bindings;
  const truthHash = hashCaseTruth(truth);
  if (solution.caseId !== truth.caseId || solution.truthHash !== truthHash || bindings.caseId !== truth.caseId || bindings.truthHash !== truthHash || bindings.solutionHash !== hashCaseSolution(solution)) {
    add("BINDING_MISMATCH", [bindings.caseId], ["bindings"]);
    return report("fail", findings);
  }

  // 2. Replay the ordered witness exactly once; the port is trusted but its output is validated.
  let raw: unknown = { success: false, code: "REPLAY_UNAVAILABLE" };
  try {
    raw = replayWitness([...profile.witnessStepIds]);
  } catch {
    // A throwing port counts as unavailable; the error is never echoed.
  }
  const replay = PortResultSchema.safeParse(raw);
  if (!replay.success) {
    add("INVALID_REPLAY_RESULT", [], ["witnessStepIds"]);
    return report("fail", findings);
  }
  if (!replay.data.success) {
    add(replay.data.code, [], ["witnessStepIds"]);
    return report(replay.data.code === "REPLAY_UNAVAILABLE" ? "unknown" : "fail", findings);
  }
  if (canonical(replay.data.bindings) !== canonical(bindings)) {
    add("BINDING_MISMATCH", [replay.data.bindings.caseId], ["bindings", "releaseHash"]);
    return report("fail", findings);
  }
  const catalog = new Map(profile.observations.map((o) => [o.id, canonical(o)]));
  const released = new Map<string, ReleasedObservation>();
  for (const record of replay.data.released) {
    // Identical repeats collapse; a payload that differs from the authorized catalog entry fails.
    if (catalog.get(record.id) !== canonical(record)) add("RELEASE_RECORD_MISMATCH", [record.id], ["observations"]);
    released.set(record.id, record);
  }
  if (findings.length > 0) return report("fail", findings);

  // 3. Initially established: replayed observation nodes, plus literal nodes of factive OBSERVED releases.
  const observedLiterals = new Set<string>();
  for (const o of released.values()) {
    if (o.kind !== "OBSERVED") continue;
    if (canonicalValue(o.literal, truth, solution) === o.literal.value) observedLiterals.add(canonical(o.literal));
    else add("FALSE_OBSERVATION", [o.id], ["observations"], [o.literal.propositionId]);
  }
  const lies = new Set((options.lies ?? []).map((l) => canonical([l.npcId, l.literal])));
  const lied = (o: ReleasedObservation | undefined) => o?.kind === "REPORTED_BY_NPC" && lies.has(canonical([o.npcId, o.literal]));
  const established = new Set<string>();
  const liedNodes = new Set<string>();
  for (const n of profile.nodes) {
    const o = n.kind === "observation" ? released.get(n.observationId) : undefined;
    if (lied(o)) {
      liedNodes.add(n.id);
      if (profile.edges.some((e) => e.allOf.includes(n.id))) add("LIED_REPORT_IGNORED", [n.id], ["nodes", n.id], [(o as { id: string }).id]);
      continue;
    }
    if (o !== undefined && (o.kind !== "OBSERVED" || observedLiterals.has(canonical(o.literal)))) established.add(n.id);
    if (n.kind === "literal" && observedLiterals.has(canonical(n.literal))) established.add(n.id);
  }
  // Unestablished root premises (never an edge consequence). Paths use IDs: reordering changes nothing.
  for (const n of profile.nodes) {
    if (established.has(n.id) || liedNodes.has(n.id) || !profile.edges.some((e) => e.allOf.includes(n.id)) || profile.edges.some((e) => e.to === n.id)) continue;
    const sources = n.kind === "observation" ? [n.observationId] : profile.observations.filter((o) => o.kind === "OBSERVED" && canonical(o.literal) === canonical(n.literal)).map((o) => o.id);
    add("PREMISE_NOT_REACHED", [n.id], ["nodes", n.id], sources);
  }

  // 4. Licensing and canonical consistency of every edge, then the least fixed point.
  const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
  const literalOf = (id: string) => (nodes.get(id) as { literal: Literal }).literal;
  const usable = profile.edges.filter((e) => {
    const license = nodes.get(e.license) as { observationId: string };
    const rules = released.get(license.observationId);
    const body = canonical(e.allOf.filter((n) => n !== e.license));
    const published = rules?.kind === "PUBLIC_RULE" && rules.rules.some((r) => r.edgeId === e.id && canonical(r.allOf) === body && canonical(r.yields) === canonical(literalOf(e.to)));
    if (!published) add("UNPUBLISHED_RULE", [e.id], ["edges", e.id], [license.observationId]);
    const consistent = canonicalValue(literalOf(e.to), truth, solution) === literalOf(e.to).value;
    if (!consistent) add("NONCANONICAL_INFERENCE", [e.id], ["edges", e.id], [e.to]);
    return published && consistent;
  });
  const fixedPoint = (set: Set<string>) => {
    for (let changed = true; changed; ) {
      changed = false;
      for (const e of usable) {
        if (set.has(e.to) || !e.allOf.every((n) => set.has(n))) continue;
        set.add(e.to);
        changed = true;
      }
    }
    return set;
  };
  fixedPoint(established);
  // Same closure with the lies believed: what it adds is reachable only through a lie.
  const withLies = liedNodes.size === 0 ? established : fixedPoint(new Set([...established, ...liedNodes]));

  // 5. Cycles: nodes that reach themselves; report each non-productive strongly connected group.
  const next = new Map<string, string[]>();
  for (const e of profile.edges) for (const n of e.allOf) next.set(n, [...(next.get(n) ?? []), e.to]);
  // Bounded: at most 128 nodes, each visited once per start node.
  const reach = (from: string, seen = new Set<string>()): Set<string> => {
    for (const n of next.get(from) ?? []) if (!seen.has(n)) reach(n, seen.add(n));
    return seen;
  };
  const reachable = new Map(profile.nodes.map((n) => [n.id, reach(n.id)]));
  const reported = new Set<string>();
  for (const [id, seen] of reachable) {
    if (!seen.has(id) || reported.has(id)) continue;
    const group = [...seen].filter((m) => reachable.get(m)?.has(id));
    group.forEach((m) => reported.add(m));
    if (group.some((m) => !established.has(m))) add("PROOF_CYCLE", group, ["edges"]);
  }

  // 6. Required literals must be derived with their exact polarity.
  const derived = new Set(profile.nodes.flatMap((n) => (n.kind === "literal" && established.has(n.id) ? [canonical(n.literal)] : [])));
  const proven = (conclusionId: string, value: boolean) => derived.has(canonical({ kind: "conclusion", conclusionId, value }));
  const viaLie = new Set(profile.nodes.flatMap((n) => (n.kind === "literal" && withLies.has(n.id) ? [canonical(n.literal)] : [])));
  solution.requiredConclusions.forEach((literal, i) => {
    if (proven(literal.conclusionId, literal.value)) return;
    const onlyLie = viaLie.has(canonical({ kind: "conclusion", conclusionId: literal.conclusionId, value: literal.value }));
    add(onlyLie ? "LIE_ONLY_PATH" : "REQUIRED_NOT_DERIVED", [literal.conclusionId], ["requiredConclusions", i]);
  });

  // 7. All 2^n answer vectors; only proven opposite polarity eliminates a vector.
  const scope = [...profile.answerScope].sort(byCodeUnits);
  const statuses = new Map(scope.map((id) => [id, canonicalValue({ kind: "conclusion", conclusionId: id, value: true }, truth, solution)]));
  const survivors: HypothesisVector[] = [];
  let compatible = false;
  for (let bits = 0; bits < 2 ** scope.length; bits++) {
    const vector = scope.map((conclusionId, j) => ({ conclusionId, value: ((bits >> (scope.length - 1 - j)) & 1) === 1 }));
    if (vector.some((d) => proven(d.conclusionId, !d.value))) continue;
    survivors.push(vector);
    if (vector.every((d) => statuses.get(d.conclusionId) === "undetermined" || statuses.get(d.conclusionId) === d.value)) compatible = true;
  }
  if (!compatible) add("NO_SURVIVING_HYPOTHESIS", scope, ["answerScope"]);
  for (const literal of solution.requiredConclusions) {
    const values = new Set(survivors.map((v) => v.find((d) => d.conclusionId === literal.conclusionId)!.value));
    if (values.size > 1) add("REQUIRED_AMBIGUOUS", [literal.conclusionId], ["answerScope"]);
  }
  if (profile.ambiguityPolicy === "must_disambiguate" && survivors.length > 1) add("AMBIGUITY_POLICY_VIOLATION", scope, ["ambiguityPolicy"]);

  // 8. "Identify all responsible": a complete family of responsibility claims, positives required.
  if (profile.question.kind === "identify_all_responsible") {
    const eventId = profile.question.eventId;
    const family = [
      ...truth.persons.map((person) => ({ kind: "personResponsibleForEvent", personId: person.id, eventId })),
      { kind: "noPersonResponsibleForEvent", eventId },
    ].map((claim) => ({ claim, conclusion: solution.conclusions.find((c) => canonical(c.claim) === canonical(claim)) }));
    for (const { claim, conclusion } of family) {
      if (truth.persons.length > 5 || conclusion === undefined || !profile.answerScope.includes(conclusion.id)) {
        add("ANSWER_SCOPE_INVALID_FOR_QUESTION", [conclusion?.id ?? ("personId" in claim ? claim.personId : eventId)], ["answerScope"]);
      } else if (statuses.get(conclusion.id) === true && !solution.requiredConclusions.some((r) => r.conclusionId === conclusion.id && r.value)) {
        add("POSITIVE_ANSWER_NOT_REQUIRED", [conclusion.id], ["question"]);
      }
    }
    const resolution = solution.resolutions.find((r) => r.eventId === eventId);
    if (resolution?.responsibility.completeness !== "complete") add("FULL_ANSWER_INCOMPLETE", [eventId], ["question", "eventId"]);
  }

  return report("pass", findings, survivors.length, survivors.length > 1 ? survivors.slice(0, 4) : []);
}
