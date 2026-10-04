import { expect, it } from "vitest";
import { createDialoguePolicyEngine } from "../src/domain/npc-dialogue-policy.ts";
import { knowledge, singleContext } from "./npc-dialogue-policy.fixture.ts";

it("TASK-0005 rejects numeric non-index properties on policy.rules", () => {
  // Contract: forge/owner/audits/TASK-0005, forge-audits/TASK-0005/TASK-0005.md,
  // contractVersion 2, §8 (Sichere, strikte Eingaben): own extra properties on
  // arrays are forbidden and must produce ordinary Zod issues at the input path.
  // 2**32 - 1 is not an array index; adding it leaves this dense array empty.
  const engine = createDialoguePolicyEngine(singleContext(knowledge(true)));
  const rules: unknown[] = [];
  const input = { schemaVersion: 1, defaultAction: "answer", rules };
  expect(engine.policySchema.safeParse(input).success).toBe(true);

  Object.defineProperty(rules, "4294967295", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: "unauthorized extension",
  });
  expect(rules).toHaveLength(0);
  expect(Object.keys(rules)).toEqual(["4294967295"]);

  const result = engine.policySchema.safeParse(input);
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues.map((issue) => issue.path)).toContainEqual(["rules", "4294967295"]);
  }
});
