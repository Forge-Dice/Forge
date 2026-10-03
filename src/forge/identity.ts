import { z } from "zod";
import { TextSchema } from "./primitives.ts";

// Agent identity and review independence (FORGE-CORE-0001A §5).
// Identities are self-declared; authentication is out of scope for V0.0.

export const AgentIdentitySchema = z.strictObject({
  actorType: z.enum(["human", "ai_agent", "system"]),
  // Lowercase slug so that case or whitespace variants cannot fake a different provider.
  provider: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/, "Expected a lowercase provider slug"),
  model: z.string().min(1).nullable(),
  label: TextSchema,
});

export const ReviewPolicySchema = z.strictObject({
  aiReviewIndependence: z.enum(["different_identity", "different_provider"]),
});

export type AgentIdentity = z.output<typeof AgentIdentitySchema>;
export type ReviewPolicy = z.output<typeof ReviewPolicySchema>;

type IdentityLike = Readonly<AgentIdentity>;

export function sameIdentity(a: IdentityLike, b: IdentityLike): boolean {
  return a.actorType === b.actorType && a.provider === b.provider && a.model === b.model && a.label === b.label;
}

/**
 * A reviewer is independent of an author if it is not a system actor and not the same
 * identity. Only when both are AI agents may the policy additionally demand a different
 * provider; a human reviewer is never blocked by provider rules.
 */
export function isIndependentReviewer(author: IdentityLike, reviewer: IdentityLike, policy: Readonly<ReviewPolicy>): boolean {
  if (reviewer.actorType === "system") return false;
  if (sameIdentity(author, reviewer)) return false;
  if (author.actorType === "ai_agent" && reviewer.actorType === "ai_agent" && policy.aiReviewIndependence === "different_provider") {
    return author.provider !== reviewer.provider;
  }
  return true;
}
