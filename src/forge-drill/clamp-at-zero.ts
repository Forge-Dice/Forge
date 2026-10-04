// Drill seed (FORGE-BOOTSTRAP-0001C): the green BASE form of the first developer drill.
// A later, separately published drill contract may change only this source to the equivalent ternary form.
export function clampAtZero(n: number): number {
  if (n < 0) {
    return 0;
  }
  return n;
}
