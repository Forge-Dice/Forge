import { createHash } from "node:crypto";
import { byCodeUnits, isWellFormed } from "./shared.ts";

// Session JSON profile C and identity hashes of a case package (MYST-SESSION-0001A §2).
// C sorts object keys by UTF-16 code units but keeps every array in its given order: sets are
// sorted explicitly at their typed boundaries before hashing, never by a global rule.
// H(tag, x) = SHA-256 over UTF-8 of tag + "\n" + C(x).

export const SESSION_JSON_LIMITS = Object.freeze({ maxDepth: 32, maxNodes: 100_000 });

export type SessionJsonCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: "LIMIT" | "SHAPE"; readonly path: readonly (string | number)[] };

/**
 * Iterative plain-JSON check before any recursive work: no functions, undefined, symbols, BigInt,
 * non-finite or unsafe numbers, accessors, cycles, foreign prototypes or ill-formed strings.
 */
export function validateSessionJson(
  value: unknown,
  limits: { readonly maxDepth: number; readonly maxNodes: number } = SESSION_JSON_LIMITS,
): SessionJsonCheck {
  // Paths are linked lists, materialized only for a failure: a valid state has many nodes.
  type Path = { readonly parent: Path; readonly key: string | number } | null;
  type Frame = { readonly value: unknown; readonly depth: number; readonly path: Path } | { readonly exit: object };
  const stack: Frame[] = [{ value, depth: 0, path: null }];
  const onPath = new Set<object>(); // ancestors only: a shared, acyclic subtree is fine
  let nodes = 0;
  const pathOf = (path: Path): (string | number)[] => {
    const out: (string | number)[] = [];
    for (let p = path; p !== null; p = p.parent) out.push(p.key);
    return out.reverse();
  };
  const fail = (code: "LIMIT" | "SHAPE", path: Path): SessionJsonCheck => Object.freeze({ ok: false, code, path: pathOf(path) });
  while (stack.length > 0) {
    const frame = stack.pop()!;
    if ("exit" in frame) {
      onPath.delete(frame.exit);
      continue;
    }
    const { value: v, depth, path } = frame;
    if (++nodes > limits.maxNodes || depth > limits.maxDepth) return fail("LIMIT", path);
    if (v === null || typeof v === "boolean") continue;
    if (typeof v === "string") {
      if (!isWellFormed(v)) return fail("SHAPE", path);
      continue;
    }
    if (typeof v === "number") {
      if (!Number.isFinite(v) || (Number.isInteger(v) && !Number.isSafeInteger(v))) return fail("SHAPE", path);
      continue;
    }
    if (typeof v !== "object") return fail("SHAPE", path);
    const prototype = Object.getPrototypeOf(v);
    const plain = Array.isArray(v) ? prototype === Array.prototype : prototype === Object.prototype || prototype === null;
    if (!plain || onPath.has(v) || Object.getOwnPropertySymbols(v).length > 0) return fail("SHAPE", path);
    const keys = Object.keys(v);
    if (Array.isArray(v) && keys.length !== v.length) return fail("SHAPE", path);
    for (const key of keys) {
      if (!("value" in Object.getOwnPropertyDescriptor(v, key)!) || !isWellFormed(key)) return fail("SHAPE", { parent: path, key });
    }
    onPath.add(v);
    stack.push({ exit: v });
    const array = Array.isArray(v);
    for (const key of keys) {
      const child = (v as Record<string, unknown>)[key];
      stack.push({ value: child, depth: depth + 1, path: { parent: path, key: array ? Number(key) : key } });
    }
  }
  return OK;
}

const OK: SessionJsonCheck = Object.freeze({ ok: true });

/** Canonical C. Callers validate with validateSessionJson first; arrays keep their order. */
export function serializeSessionJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(serializeSessionJson).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.keys(value)
      .sort(byCodeUnits)
      .map((key) => `${JSON.stringify(key)}:${serializeSessionJson((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export const utf8Length = (text: string): number => Buffer.byteLength(text, "utf8");

const sha256 = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");

export function hashSessionJson(profile: string, value: unknown): string {
  return sha256(`${profile}\n${serializeSessionJson(value)}`);
}

/** Copy of a set-like array, sorted by a key; no deduplication (callers reject duplicates). */
export const sortedBy = <T>(items: readonly T[], key: (item: T) => string): T[] =>
  [...items].sort((a, b) => byCodeUnits(key(a), key(b)));
const byC = <T>(items: readonly T[]): T[] => sortedBy(items, serializeSessionJson);

type Snapshot = { readonly awareness: readonly unknown[]; readonly attitudes: readonly unknown[]; readonly [field: string]: unknown };
type EntityRef = { readonly kind: string; readonly id: string };
const entityKey = (e: EntityRef) => `${e.kind}\n${e.id}`;

export function hashNpcSnapshot(snapshot: Snapshot): string {
  return hashSessionJson("forge-npc-snapshot-v1", { ...snapshot, awareness: byC(snapshot.awareness), attitudes: byC(snapshot.attitudes) });
}

export function hashNpcBundle(entries: readonly { npcId: string; snapshotHash: string; profileHash: string }[]): string {
  return hashSessionJson("forge-session-npcs-v1", sortedBy(entries, (e) => e.npcId));
}

export function hashInitialSetup(initial: { readonly schemaVersion: 1; readonly known: readonly EntityRef[] }): string {
  return hashSessionJson("forge-session-initial-v1", { ...initial, known: sortedBy(initial.known, entityKey) });
}

export function hashChallengeComponent(challenge: { readonly allowedClaims: readonly unknown[] }): string {
  return hashSessionJson("forge-session-challenge-v1", { ...challenge, allowedClaims: byC(challenge.allowedClaims) });
}

export type RefsComponent = {
  readonly config: { readonly profile: string; readonly saltHex: string };
  readonly caseId: string;
  readonly truthHash: string;
  readonly mapping: readonly { readonly kind: string; readonly id: string; readonly ref: string }[];
};

export function hashRefs(refs: RefsComponent): string {
  return hashSessionJson("forge-session-refs-v1", { ...refs, mapping: sortedBy(refs.mapping, entityKey) });
}

export type PublicContentComponent = {
  readonly labels: readonly { readonly entity: EntityRef }[];
  readonly questionTexts: readonly { readonly npc: string; readonly questionId: string }[];
  readonly publicRules: readonly { readonly id: string }[];
};

export function hashPublicContent(content: PublicContentComponent): string {
  return hashSessionJson("forge-session-public-content-v1", {
    ...content,
    labels: sortedBy(content.labels, (l) => entityKey(l.entity)),
    questionTexts: sortedBy(content.questionTexts, (q) => `${q.npc}\n${q.questionId}`),
    publicRules: sortedBy(content.publicRules, (r) => r.id),
  });
}

export type ReleaseContext = {
  readonly rulesetVersion: string;
  readonly truthHash: string;
  readonly solutionHash: string;
  readonly accessHash: string;
  readonly presentationHash: string;
  readonly catalogueHash: string;
  readonly npcBundleHash: string;
  readonly initialHash: string;
  readonly refsHash: string;
  readonly challengeHash: string;
  readonly publicContentHash: string;
};

export function hashReleaseContext(context: ReleaseContext): string {
  return hashSessionJson("forge-session-release-context-v1", context);
}

type ProofRule = { readonly allOf: readonly unknown[] };
export type ProofProfileComponent = {
  readonly answerScope: readonly unknown[];
  readonly observations: readonly ({ readonly kind: string } | { readonly kind: "PUBLIC_RULE"; readonly rules: readonly ProofRule[] })[];
  readonly nodes: readonly unknown[];
  readonly edges: readonly ProofRule[];
  readonly witnessStepIds: readonly string[];
};

/** Proof SET paths per registry; witnessStepIds stays ORDERED. */
export function hashProofProfile(profile: ProofProfileComponent): string {
  const withSortedAllOf = <T extends ProofRule>(rule: T): T => ({ ...rule, allOf: byC(rule.allOf) });
  const observations = profile.observations.map((o) =>
    "rules" in o && o.kind === "PUBLIC_RULE" ? { ...o, rules: byC(o.rules.map(withSortedAllOf)) } : o,
  );
  return hashSessionJson("forge-session-proof-v1", {
    ...profile,
    answerScope: byC(profile.answerScope),
    observations: byC(observations),
    nodes: byC(profile.nodes),
    edges: byC(profile.edges.map(withSortedAllOf)),
  });
}

/** The manifest is already canonical C text; it is hashed as-is, never JSON-quoted again. */
export function hashReleaseManifest(manifest: string): string {
  return sha256(`forge-session-release-v1\n${manifest}`);
}

export function hashPackage(input: {
  readonly rulesetVersion: string;
  readonly releaseContextHash: string;
  readonly releaseHash: string | null;
  readonly proofHash: string | null;
}): string {
  return hashSessionJson("forge-case-package-v1", { schemaVersion: 1, ...input });
}
