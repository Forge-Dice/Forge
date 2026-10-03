// Ancestry over witnessed parent edges (FORGE-CORE-0001A §11).
// Fail-closed: a missing edge means "not reachable"; it can only block, never allow.

export type CommitGraph = Readonly<Record<string, readonly string[]>>;
export type RefHeads = Readonly<Record<string, string>>;

function parentsOf(graph: CommitGraph, commit: string): readonly string[] {
  return Object.hasOwn(graph, commit) ? graph[commit]! : [];
}

export function isAncestorOrSelf(ancestor: string, descendant: string, graph: CommitGraph): boolean {
  const seen = new Set<string>();
  const stack = [descendant];
  while (stack.length > 0) {
    const commit = stack.pop()!;
    if (commit === ancestor) return true;
    if (seen.has(commit)) continue;
    seen.add(commit);
    for (const parent of parentsOf(graph, commit)) stack.push(parent);
  }
  return false;
}

export function isReachableFromRefs(commit: string, refs: RefHeads, graph: CommitGraph): boolean {
  return Object.values(refs).some((head) => isAncestorOrSelf(commit, head, graph));
}
