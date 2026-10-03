import { z } from "zod";
import { CommitShaSchema, RefNameSchema, RepoPathSchema, TextSchema } from "./primitives.ts";

// Run, observation and evidence schemas (FORGE-CORE-0001B §4–§5).
// Everything here is either a self-report or a witnessed observation; nothing is a status.

export const RunIdSchema = z.string().regex(/^run:[a-z0-9][a-z0-9_-]{0,63}$/, 'Expected a run ID such as "run:0001a-1"');

// z.record silently drops an own "__proto__" key instead of rejecting it; reject it explicitly.
function strictRecord<T extends z.ZodType>(schema: T) {
  return z
    .unknown()
    .refine((value) => typeof value !== "object" || value === null || !Object.hasOwn(value, "__proto__"), {
      message: '"__proto__" is not a valid key',
    })
    .pipe(schema);
}

/** Witnessed parent edges (child -> parents). A subset is enough; missing edges only block. */
export const CommitGraphSchema = strictRecord(z.record(CommitShaSchema, z.array(CommitShaSchema)));

/** Witnessed remote heads. Ref names carry no task identity. */
export const RefHeadsSchema = strictRecord(z.record(RefNameSchema, CommitShaSchema));

function uniqueBy<T>(key: (item: T) => string, message: string, field?: string) {
  return (items: readonly T[], ctx: z.RefinementCtx) => {
    const seen = new Set<string>();
    items.forEach((item, i) => {
      if (seen.has(key(item))) ctx.addIssue({ code: "custom", message, path: field === undefined ? [i] : [i, field] });
      seen.add(key(item));
    });
  };
}

export const MutationResultSchema = z.strictObject({
  name: TextSchema,
  description: TextSchema,
  outcome: z.enum(["detected", "survived", "not_applied"]),
  classification: z.enum(["must_detect", "equivalent"]),
  equivalenceRationale: TextSchema.nullable(),
});

const ExitCodeSchema = z.int();

export const DeveloperReportSchema = z.strictObject({
  claimedResultCommit: CommitShaSchema,
  claimedRemoteRef: RefNameSchema,
  commandsRun: z.array(z.strictObject({ command: TextSchema, exitCode: ExitCodeSchema })),
  mutations: z.array(MutationResultSchema),
  deviations: z.array(TextSchema),
  knownLimitations: z.array(TextSchema),
  reviewHints: z.array(TextSchema),
});

export const ChangedFileSchema = z.discriminatedUnion("change", [
  z.strictObject({ path: RepoPathSchema, change: z.enum(["added", "modified", "deleted"]) }),
  z.strictObject({ fromPath: RepoPathSchema, toPath: RepoPathSchema, change: z.literal("renamed") }),
]);

export const VerificationEvidenceSchema = z.strictObject({
  runId: RunIdSchema,
  verifiedCommit: CommitShaSchema,
  method: z.literal("fresh_clone"),
  changedFiles: z.array(ChangedFileSchema).superRefine((files, ctx) => {
    const seen = new Set<string>();
    files.forEach((file, i) => {
      const paths = file.change === "renamed" ? [["fromPath", file.fromPath], ["toPath", file.toPath]] : [["path", file.path]];
      for (const [field, path] of paths as [string, string][]) {
        if (seen.has(path)) ctx.addIssue({ code: "custom", message: "Duplicate changed path", path: [i, field] });
        seen.add(path);
      }
    });
  }),
  checks: z.array(z.strictObject({ name: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/), command: TextSchema, exitCode: ExitCodeSchema }))
    .superRefine(uniqueBy((check) => check.name, "Duplicate check name", "name")),
  mutations: z.array(MutationResultSchema).nullable(),
});

export const AcknowledgedMutationsSchema = z.array(TextSchema).superRefine(uniqueBy((name) => name, "Duplicate acknowledgement"));

export type RunId = z.output<typeof RunIdSchema>;
export type MutationResult = z.output<typeof MutationResultSchema>;
export type DeveloperReport = z.output<typeof DeveloperReportSchema>;
export type ChangedFile = z.output<typeof ChangedFileSchema>;
export type VerificationEvidence = z.output<typeof VerificationEvidenceSchema>;

export type ExplicitFailureCode = "PUSH_REJECTED" | "REMOTE_NOT_PERSISTED" | "DEVELOPER_ABORTED";
export type AbandonReason = "WORKER_LOST" | "OWNER_CANCELLED";
