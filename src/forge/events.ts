import { z } from "zod";
import { AgentIdentitySchema } from "./identity.ts";
import { CommitShaSchema, FindingSchema, RefNameSchema, RepoPathSchema, Sha256HexSchema, TaskIdSchema, TextSchema } from "./primitives.ts";
import {
  AcknowledgedMutationsSchema,
  CommitGraphSchema,
  DeveloperReportSchema,
  RefHeadsSchema,
  RunIdSchema,
  VerificationEvidenceSchema,
} from "./runs.ts";

// Forge events (FORGE-CORE-0001A §7, extended by FORGE-CORE-0001B §4). Events record facts and
// witnessed observations only; every state is derived from them.

export const RepoObservationSchema = z.strictObject({
  refs: RefHeadsSchema,
  parents: CommitGraphSchema,
  contractAtCommit: z.strictObject({ commit: CommitShaSchema, path: RepoPathSchema, contentHash: Sha256HexSchema }),
});

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

const RunStartedSchema = z.strictObject({
  type: z.literal("run_started"),
  runId: RunIdSchema,
  taskId: TaskIdSchema,
  contentHash: Sha256HexSchema,
  repoObservation: RepoObservationSchema,
});

const DeveloperReportRecordedSchema = z.strictObject({
  type: z.literal("developer_report_recorded"),
  runId: RunIdSchema,
  report: DeveloperReportSchema,
});

const RemoteObservedSchema = z.strictObject({
  type: z.literal("remote_observed"),
  runId: RunIdSchema,
  ref: RefNameSchema,
  head: CommitShaSchema.nullable(),
  parents: CommitGraphSchema,
});

const VerificationRecordedSchema = z.strictObject({
  type: z.literal("verification_recorded"),
  evidence: VerificationEvidenceSchema,
});

const RunFailedSchema = z.strictObject({
  type: z.literal("run_failed"),
  runId: RunIdSchema,
  code: z.enum(["PUSH_REJECTED", "REMOTE_NOT_PERSISTED", "DEVELOPER_ABORTED"]),
  detail: TextSchema,
});

const RunAbandonedSchema = z.strictObject({
  type: z.literal("run_abandoned"),
  runId: RunIdSchema,
  reason: z.enum(["WORKER_LOST", "OWNER_CANCELLED"]),
  detail: TextSchema,
});

const CodeReviewRecordedSchema = z.strictObject({
  type: z.literal("code_review_recorded"),
  runId: RunIdSchema,
  reviewedCommit: CommitShaSchema,
  verdict: z.enum(["approve", "request_changes"]),
  requires: z.enum(["code_change", "contract_change"]).nullable(),
  findings: z.array(FindingSchema),
  acknowledgedEquivalentMutations: AcknowledgedMutationsSchema,
});

const TaskAcceptedSchema = z.strictObject({
  type: z.literal("task_accepted"),
  taskId: TaskIdSchema,
  runId: RunIdSchema,
});

export const EventBodySchema = z.discriminatedUnion("type", [
  TaskRegisteredSchema,
  ContractRegisteredSchema,
  ApprovalRecordedSchema,
  RunStartedSchema,
  DeveloperReportRecordedSchema,
  RemoteObservedSchema,
  VerificationRecordedSchema,
  RunFailedSchema,
  RunAbandonedSchema,
  CodeReviewRecordedSchema,
  TaskAcceptedSchema,
]);

export const RoleSchema = z.enum([
  "owner",
  "spec_author",
  "architecture_reviewer",
  "developer",
  "observer",
  "verifier",
  "code_reviewer",
]);

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
export type RepoObservation = z.output<typeof RepoObservationSchema>;

/** The roles allowed to emit each event type. */
export const ROLES_FOR_EVENT: Readonly<Record<EventType, readonly Role[]>> = Object.freeze({
  task_registered: Object.freeze(["owner"] as const),
  contract_registered: Object.freeze(["spec_author"] as const),
  approval_recorded: Object.freeze(["architecture_reviewer"] as const),
  run_started: Object.freeze(["developer"] as const),
  developer_report_recorded: Object.freeze(["developer"] as const),
  remote_observed: Object.freeze(["observer"] as const),
  verification_recorded: Object.freeze(["verifier"] as const),
  run_failed: Object.freeze(["developer", "owner"] as const),
  run_abandoned: Object.freeze(["owner"] as const),
  code_review_recorded: Object.freeze(["code_reviewer"] as const),
  task_accepted: Object.freeze(["owner"] as const),
});
