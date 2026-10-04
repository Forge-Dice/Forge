import { describe, expect, it } from "vitest";
import { outcome, py, type Call } from "./helpers.ts";

// Hardening: path and symlink tricks against scope, materialization and inventory.

const CONTRACT = "forge/contracts/TASK-0101.md";
const OID = "1".repeat(40);
const OID2 = "2".repeat(40);
const plan = (added: string[] = []) => ({ addedTestFiles: added, approvedTcbPaths: [] });

describe("scope: module-resolution shadowing through a nested node_modules", () => {
  it("a DEV file under any node_modules segment (which would shadow a TCB dependency) → SCOPE_PROTECTED", () => {
    // src/forge/*.ts imports "zod"; Node/Vite resolution from src/forge/ visits src/node_modules
    // before the trusted /case/node_modules, so these files would replace TCB dependencies.
    const paths = ["src/node_modules/zod/index.ts", "src/Node_Modules/zod/index.ts", "src/node_modules/zod.ts", "src/lib/node_modules/x/index.ts"];
    const base = [["README.md", "100644", OID]];
    const calls: Call[] = paths.map((p) => ({
      fn: "scope.check_scope_rows",
      args: [base, [[...base, [p, "100644", OID2]]], plan(), { create: [p], modify: [] }, "DEV", CONTRACT],
    }));
    // control: the same shape outside node_modules passes
    calls.push({
      fn: "scope.check_scope_rows",
      args: [base, [[...base, ["src/lib/x/index.ts", "100644", OID2]]], plan(), { create: ["src/lib/x/index.ts"], modify: [] }, "DEV", CONTRACT],
    });
    expect(py(calls).map(outcome)).toEqual([...paths.map(() => "SCOPE_PROTECTED"), "PASS"]);
  });
});
