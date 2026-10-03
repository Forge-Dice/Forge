import { z } from "zod";

// Shared primitive schemas of the Forge process core (FORGE-CORE-0001A §4).

export const CommitShaSchema = z.string().regex(/^[0-9a-f]{40}$/, "Expected a 40-character lowercase commit SHA");

export const Sha256HexSchema = z.string().regex(/^[0-9a-f]{64}$/, "Expected a lowercase SHA-256 hex digest");

export const TaskIdSchema = z
  .string()
  .max(64)
  .regex(/^[A-Z][A-Z0-9]*(-[A-Z0-9]+)+$/, 'Expected a task ID such as "TASK-0004"');

export const RepoPathSchema = z
  .string()
  .max(255)
  .regex(/^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/, "Expected a relative POSIX path")
  .refine((path) => path.split("/").every((segment) => segment !== "." && segment !== ".."), {
    message: 'Path segments "." and ".." are not allowed',
  });

export const RefNameSchema = z
  .string()
  .max(255)
  .regex(/^[A-Za-z0-9._/-]+$/, "Expected a ref name")
  .refine((ref) => !ref.includes("..") && !ref.includes("//"), { message: 'Ref names must not contain ".." or "//"' });

export const TextSchema = z.string().regex(/\S/, "Text must contain a non-whitespace character");

export const FindingSchema = z.strictObject({
  severity: z.enum(["blocking", "non_blocking"]),
  summary: TextSchema,
  location: z.string().nullable(),
});

export type CommitSha = z.output<typeof CommitShaSchema>;
export type Sha256Hex = z.output<typeof Sha256HexSchema>;
export type TaskId = z.output<typeof TaskIdSchema>;
export type RepoPath = z.output<typeof RepoPathSchema>;
export type RefName = z.output<typeof RefNameSchema>;
export type Finding = z.output<typeof FindingSchema>;

/** Ordering by UTF-16 code units; never localeCompare. */
export function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
