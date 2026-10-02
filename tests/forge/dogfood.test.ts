import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { kernel } from "./fixtures.ts";

// Forge checks its own process artifacts with the boundary rule from FORGE-CORE-0001A §6:
// bytes are decoded with fatal UTF-8 and ignoreBOM, so a BOM stays visible to the kernel.

const decode = (path: string) => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(readFileSync(path));
const ROOT = new URL("../../", import.meta.url).pathname;

const forgeContracts = readdirSync(join(ROOT, "forge/contracts")).filter((name) => name.startsWith("FORGE-CORE-"));
const approvals = readdirSync(join(ROOT, "forge/approvals")).filter((name) => name.endsWith(".json"));

function parsed(name: string) {
  const result = kernel.parseContractDocument(decode(join(ROOT, "forge/contracts", name)));
  if (!result.ok) throw new Error(`${name}: ${JSON.stringify(result.issues)}`);
  return result.document;
}

describe("Forge contracts in this repository", () => {
  it("FORGE-CORE-0001A exists", () => {
    expect(forgeContracts).toContain("FORGE-CORE-0001A.md");
  });

  it.each(forgeContracts)("%s parses in its own format", (name) => {
    const document = parsed(name);
    expect(`${document.ref.taskId}.md`).toBe(name);
  });

  it.each(approvals)("approval record %s is bound to the exact contract text", (name) => {
    const record = JSON.parse(decode(join(ROOT, "forge/approvals", name)));
    const document = parsed(`${record.taskId}.md`);
    expect(name).toBe(`${record.taskId}.v${record.contractVersion}.${record.gate}.json`);
    expect(record.contractVersion).toBe(document.ref.contractVersion);
    expect(record.contentHash).toBe(document.ref.contentHash);
    expect(record.verdict).toBe("approved");
    expect(record.actor.actorType).toBe("human");
  });

  it("every file under src/forge and tests/forge is in the scope of a Forge contract", () => {
    const scope = new Set(forgeContracts.flatMap((name) => [...parsed(name).metadata.scope.create, ...parsed(name).metadata.scope.modify]));
    const files = ["src/forge", "tests/forge"].flatMap((dir) => readdirSync(join(ROOT, dir)).map((file) => `${dir}/${file}`));
    expect(files.filter((file) => !scope.has(file))).toEqual([]);
  });

  it("the pilot TASK-0004 contract (YAML with status fields) is not a valid Forge contract", () => {
    const result = kernel.parseContractDocument(decode(join(ROOT, "forge/contracts/TASK-0004.md")));
    expect(!result.ok && result.issues.map((issue) => issue.code)).toEqual(["FRONTMATTER_MISSING"]);
  });
});
