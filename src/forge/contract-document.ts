import { z } from "zod";
import { deepFreeze } from "./freeze.ts";
import { CommitShaSchema, RepoPathSchema, TaskIdSchema, TextSchema, type Sha256Hex, type TaskId } from "./primitives.ts";

// Canonical contract document and content hash (FORGE-CORE-0001A §6).
// Metadata and hash exist only as results of parsing one exact text. The hash covers the
// prefix plus the exact text; it is never stored inside the document.

/** Synchronous SHA-256 of the UTF-8 encoding of a well-formed string, as 64 lowercase hex. */
export type Sha256Utf8 = (text: string) => string;

export const CONTRACT_HASH_PREFIX = "forge-contract-v1\n";

const FRONTMATTER_OPEN = "---json\n";
const FRONTMATTER_CLOSE = "\n---\n";

export function contractPathFor(taskId: TaskId): string {
  return `forge/contracts/${taskId}.md`;
}

const DependencyRefSchema = z.strictObject({ taskId: TaskIdSchema, acceptedCommit: CommitShaSchema.nullable() });
const CheckSpecSchema = z.strictObject({ name: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/), command: TextSchema });

export const ContractMetadataSchema = z
  .strictObject({
    forgeContractFormat: z.literal(1),
    taskId: TaskIdSchema,
    contractVersion: z.int().positive(),
    baseCommit: CommitShaSchema,
    dependencies: z.array(DependencyRefSchema),
    scope: z.strictObject({ create: z.array(RepoPathSchema), modify: z.array(RepoPathSchema) }),
    requiredChecks: z.array(CheckSpecSchema).min(1),
    mutationSmoke: z.enum(["none", "optional", "required"]),
  })
  .superRefine((meta, ctx) => {
    const issue = (message: string, path: (string | number)[]) => ctx.addIssue({ code: "custom", message, path });
    const seenDeps = new Set<string>();
    meta.dependencies.forEach((dep, i) => {
      if (dep.taskId === meta.taskId) issue("A contract cannot depend on its own task", ["dependencies", i, "taskId"]);
      if (seenDeps.has(dep.taskId)) issue("Duplicate dependency", ["dependencies", i, "taskId"]);
      seenDeps.add(dep.taskId);
    });
    const ownPath = contractPathFor(meta.taskId);
    const seenPaths = new Set<string>();
    for (const list of ["create", "modify"] as const) {
      meta.scope[list].forEach((path, i) => {
        if (path === ownPath) issue("The contract file itself can never be in scope", ["scope", list, i]);
        if (seenPaths.has(path)) issue("Duplicate or overlapping scope path", ["scope", list, i]);
        seenPaths.add(path);
      });
    }
    const seenChecks = new Set<string>();
    meta.requiredChecks.forEach((check, i) => {
      if (seenChecks.has(check.name)) issue("Duplicate check name", ["requiredChecks", i, "name"]);
      seenChecks.add(check.name);
    });
  });

export type ContractMetadata = z.output<typeof ContractMetadataSchema>;
export type ContractRef = { readonly taskId: TaskId; readonly contractVersion: number; readonly contentHash: Sha256Hex };
export type ContractDocument = {
  readonly ref: ContractRef;
  readonly metadata: Readonly<ContractMetadata>;
  readonly text: string;
};

export type ContractIssueCode =
  | "NOT_WELL_FORMED_UNICODE"
  | "BOM"
  | "CARRIAGE_RETURN"
  | "FRONTMATTER_MISSING"
  | "FRONTMATTER_UNTERMINATED"
  | "FRONTMATTER_JSON"
  | "FRONTMATTER_NOT_CANONICAL"
  | "METADATA_SCHEMA";

export type ContractIssue = { readonly code: ContractIssueCode; readonly path: readonly (string | number)[] };

export type ContractDocumentResult =
  | { readonly ok: true; readonly document: ContractDocument }
  | { readonly ok: false; readonly issues: readonly ContractIssue[] };

/** True if the string contains an unpaired UTF-16 surrogate (String#isWellFormed is not in ES2022). */
function hasLoneSurrogate(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        i++;
        continue;
      }
      return true;
    }
    if (unit >= 0xdc00 && unit <= 0xdfff) return true;
  }
  return false;
}

function fail(issues: ContractIssue[]): ContractDocumentResult {
  return deepFreeze({ ok: false, issues });
}

export function parseContractDocument(text: string, sha256Utf8: Sha256Utf8): ContractDocumentResult {
  // Stage 1: the text itself; every applicable code is reported together.
  const encodingIssues: ContractIssue[] = [];
  if (hasLoneSurrogate(text)) encodingIssues.push({ code: "NOT_WELL_FORMED_UNICODE", path: [] });
  if (text.charCodeAt(0) === 0xfeff) encodingIssues.push({ code: "BOM", path: [] });
  if (text.includes("\r")) encodingIssues.push({ code: "CARRIAGE_RETURN", path: [] });
  if (encodingIssues.length > 0) return fail(encodingIssues);

  // Stage 2: frontmatter delimiters.
  if (!text.startsWith(FRONTMATTER_OPEN)) return fail([{ code: "FRONTMATTER_MISSING", path: [] }]);
  const close = text.indexOf(FRONTMATTER_CLOSE, FRONTMATTER_OPEN.length - 1);
  if (close === -1) return fail([{ code: "FRONTMATTER_UNTERMINATED", path: [] }]);
  const json = text.slice(FRONTMATTER_OPEN.length, close);

  // Stage 3: strict, canonical JSON (rules out duplicate keys and formatting ambiguity).
  // Both calls stay inside try: extremely deep nesting makes them throw RangeError.
  let raw: unknown;
  let canonical: string;
  try {
    raw = JSON.parse(json);
    canonical = JSON.stringify(raw, null, 2);
  } catch {
    return fail([{ code: "FRONTMATTER_JSON", path: [] }]);
  }
  if (canonical !== json) return fail([{ code: "FRONTMATTER_NOT_CANONICAL", path: [] }]);

  // Stage 4: metadata schema.
  const parsed = ContractMetadataSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((issue) => ({ code: "METADATA_SCHEMA" as const, path: ["metadata", ...issue.path.map((p) => (typeof p === "symbol" ? String(p) : p))] })));
  }

  const metadata = parsed.data;
  return deepFreeze({
    ok: true,
    document: {
      ref: { taskId: metadata.taskId, contractVersion: metadata.contractVersion, contentHash: sha256Utf8(CONTRACT_HASH_PREFIX + text) },
      metadata,
      text,
    },
  });
}
