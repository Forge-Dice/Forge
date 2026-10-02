import { z } from "zod";
import { AgentIdentitySchema } from "./identity.ts";
import { CommitShaSchema, FindingSchema, RepoPathSchema, Sha256HexSchema, TaskIdSchema, TextSchema } from "./primitives.ts";

// Forge events of FORGE-CORE-0001A (§7). Events record facts and observations only;
// every state is derived from them.

const TaskRegisteredSchema = z.strictObject({
  type: z.literal("task_registered"),
  taskId: TaskIdSchema,
  title: TextSchema,
});

const ContractRegisteredSchema = z.strictObject({
  type: z.literal("contract_registered"),
  taskId: TaskIdSchema,
  contractPath: RepoPathSchema,
  contractCommit: CommitShaSchema,
  contractText: z.string(),
  declaredContentHash: Sha256HexSchema,
});

const ApprovalRecordedSchema = z.strictObject({
  type: z.literal("approval_recorded"),
  taskId: TaskIdSchema,
  contentHash: Sha256HexSchema,
  gate: z.literal("architecture_review"),
  verdict: z.enum(["approved", "changes_requested"]),
  findings: z.array(FindingSchema),
});

export const EventBodySchema = z.discriminatedUnion("type", [
  TaskRegisteredSchema,
  ContractRegisteredSchema,
  ApprovalRecordedSchema,
]);

export const RoleSchema = z.enum(["owner", "spec_author", "architecture_reviewer"]);

export const ForgeEventSchema = z.strictObject({
  actor: AgentIdentitySchema,
  role: RoleSchema,
  recordedAt: z.string().nullable(), // informational only, never used in decisions
  body: EventBodySchema,
});

export type Role = z.output<typeof RoleSchema>;
export type EventBody = z.output<typeof EventBodySchema>;
export type ForgeEvent = z.output<typeof ForgeEventSchema>;
export type EventType = EventBody["type"];

/** The only role allowed to emit each event type. */
export const ROLE_FOR_EVENT: Readonly<Record<EventType, Role>> = Object.freeze({
  task_registered: "owner",
  contract_registered: "spec_author",
  approval_recorded: "architecture_reviewer",
});
