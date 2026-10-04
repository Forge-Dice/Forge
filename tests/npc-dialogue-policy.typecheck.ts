// Compile-time tests: checked by `npm run typecheck`, never executed.
// Each @ts-expect-error fails the typecheck if the line below it becomes valid.

import type { z } from "zod";
import type { NpcVisibleClaim, NpcVisibleContext } from "../src/domain/npc-knowledge.projection.ts";
import type { CaseSolution } from "../src/domain/case-solution.ts";
import type {
  CommunicativeAct,
  DialoguePolicyEngine,
  DialogueQuery,
  DialogueQueryInput,
  PolicyDecision,
  PolicyResult,
  RuntimeDialoguePolicy,
  RuntimeDialoguePolicyInput,
} from "../src/domain/npc-dialogue-policy.ts";
import { createDialoguePolicyEngine } from "../src/domain/npc-dialogue-policy.ts";

declare const context: NpcVisibleContext;
declare const engine: DialoguePolicyEngine;
declare const query: DialogueQuery;
declare const policy: RuntimeDialoguePolicy;
declare const queryInput: DialogueQueryInput;
declare const policyInput: RuntimeDialoguePolicyInput;
declare const result: PolicyResult;
declare const decision: PolicyDecision;
declare const act: CommunicativeAct;
declare const solution: CaseSolution;

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type DeepReadonly<T> = T extends string | number | boolean | null
  ? T
  : T extends readonly (infer U)[]
    ? ReadonlyArray<DeepReadonly<U>>
    : { readonly [K in keyof T]: DeepReadonly<T[K]> };

// Claim union matches NpcVisibleClaim in both directions (AC-04, AC-22).
type QueryClaim = DialogueQueryInput["claim"];
const claimForward: QueryClaim = {} as NpcVisibleClaim;
const claimBackward: NpcVisibleClaim = {} as QueryClaim;
const claimKinds: Equals<QueryClaim["kind"], NpcVisibleClaim["kind"]> = true;
const claimExact: Equals<DeepReadonly<QueryClaim>, NpcVisibleClaim> = true;
const parsedClaimExact: Equals<DialogueQuery["claim"], NpcVisibleClaim> = true;

// Engine construction takes only a visible context.
const built: DialoguePolicyEngine = createDialoguePolicyEngine(context);
// @ts-expect-error a CaseSolution is not a visible context
createDialoguePolicyEngine(solution);
// @ts-expect-error no second argument for hidden data
createDialoguePolicyEngine(context, solution);

// Unparsed inputs cannot be evaluated (group 17).
// @ts-expect-error an unparsed query is not a DialogueQuery
engine.evaluate(queryInput, policy);
// @ts-expect-error an unparsed policy is not a RuntimeDialoguePolicy
engine.evaluate(query, policyInput);
// @ts-expect-error a plain object is not a parsed query
engine.evaluate({ kind: "ask_about_claim", claim: query.claim }, policy);
const evaluated: PolicyResult = engine.evaluate(query, policy);

// Parsing keeps the authoring input type (not widened to unknown) and returns the nominal type.
const parsedQuery: DialogueQuery = engine.querySchema.parse(queryInput);
const parsedPolicy: RuntimeDialoguePolicy = engine.policySchema.parse(policyInput);
const queryInputType: Equals<z.input<DialoguePolicyEngine["querySchema"]>, DialogueQueryInput> = true;
const policyInputType: Equals<z.input<DialoguePolicyEngine["policySchema"]>, RuntimeDialoguePolicyInput> = true;
// @ts-expect-error a number is not a query input
const numberQuery: z.input<DialoguePolicyEngine["querySchema"]> = 42;
// @ts-expect-error a policy without defaultAction is not a policy input
const noDefault: z.input<DialoguePolicyEngine["policySchema"]> = { schemaVersion: 1, rules: [] };
// @ts-expect-error invert is never a default
const invertDefault: RuntimeDialoguePolicyInput = { schemaVersion: 1, defaultAction: "invert", rules: [] };

// Inputs stay mutable author structures.
queryInput.kind = "ask_about_claim";
policyInput.rules.push({ subject: { kind: "proposition", index: 1 }, action: "refuse" });
policyInput.defaultAction = "evade";

// Parsed inputs and results are deeply readonly (group 17).
// @ts-expect-error parsed query is readonly
parsedQuery.kind = "ask_about_claim";
// @ts-expect-error nested claim is readonly
parsedQuery.claim.kind = "personAt";
// @ts-expect-error parsed policy rules are readonly
parsedPolicy.rules.push({ subject: { kind: "proposition", index: 1 }, action: "refuse" });
if (parsedPolicy.rules[0] !== undefined) {
  // @ts-expect-error parsed rule is readonly
  parsedPolicy.rules[0].action = "answer";
}
// @ts-expect-error decision is readonly
decision.intent = "sincere";
if (act.kind === "assert") {
  // @ts-expect-error act value is readonly
  act.value = true;
  // @ts-expect-error act claim refs are readonly
  act.subject.index = 1;
}
if (result.success) {
  // @ts-expect-error result decision is readonly
  result.decision = decision;
} else {
  const code: "DIALOGUE_CONTEXT_MISMATCH" = result.code;
  void code;
}

// Content-free acts carry nothing but kind.
const refuse: CommunicativeAct = { kind: "refuse" };
// @ts-expect-error refuse carries no subject
const refuseWithSubject: CommunicativeAct = { kind: "refuse", subject: { kind: "proposition", index: 1 } };
// @ts-expect-error there is no deny act
const deny: CommunicativeAct = { kind: "deny" };
// @ts-expect-error intent is not part of an act
const actWithIntent: CommunicativeAct = { kind: "evade", intent: "withholding" };

// Exactly three engine members.
const members: Equals<keyof DialoguePolicyEngine, "querySchema" | "policySchema" | "evaluate"> = true;

void [claimForward, claimBackward, claimKinds, claimExact, parsedClaimExact, built, evaluated, invertDefault];
void [refuse, refuseWithSubject, deny, actWithIntent, members, queryInputType, policyInputType, numberQuery, noDefault];
