// Memo for pure functions of immutable domain values (the parsers deep-freeze their output).
// Only deep-frozen objects are cached: their content can never change, so a hash computed once
// stays valid. Anything else is recomputed on every call, as before.

function isDeepFrozen(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(isDeepFrozen);
}

export function memoFrozen<T extends object, R>(fn: (value: T) => R): (value: T) => R {
  const cache = new WeakMap<T, R>();
  return (value) => {
    if (cache.has(value)) return cache.get(value) as R;
    const result = fn(value);
    if (isDeepFrozen(value)) cache.set(value, result);
    return result;
  };
}
