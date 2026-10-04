// Small helpers shared by the domain modules. Behaviour is exactly that of the per-module copies
// they replace; the identity hashes depend on canonicalJson and byCodeUnits staying as they are.
// Modules whose contracts pin their imports (evidence-access, evidence-presentation,
// npc-dialogue-policy; see their security tests) keep their own copies on purpose.

/** Orders strings by UTF-16 code units (locale-independent). */
export const byCodeUnits = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Canonical JSON for identity hashes: object keys and array elements sorted by code units,
 * values serialized with JSON.stringify. map() copies before sorting, so frozen arrays stay as they are.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).sort(byCodeUnits).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.keys(value)
      .sort(byCodeUnits)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Freezes a value and everything reachable from it. */
export function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/**
 * Like deepFreeze, but stops at objects that are already frozen. For values built from parts that
 * were deep-frozen before (session states share their history), so freezing stays linear.
 */
export function deepFreezeUnfrozen<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreezeUnfrozen(child);
    Object.freeze(value);
  }
  return value;
}

/** Whether a string has no lone UTF-16 surrogate (well-formed Unicode). */
export function isWellFormed(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit >= 0xdc00 && unit <= 0xdfff) return false;
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      i++;
    }
  }
  return true;
}
