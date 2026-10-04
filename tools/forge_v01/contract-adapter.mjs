// Trusted contract adapter (PKG §6 "Trusted Parserauflösung", contract B §2).
//
// argv: node contract-adapter.mjs <root>
//   <root> is the absolute root of the materialized BASE source; the parser and the SHA-256
//   port are imported from exactly <root>/src/forge/contract-document.ts and node-sha256.ts.
// stdin: the raw contract bytes (at most 256 KiB, strict UTF-8).
// stdout: exactly one JSON line,
//   {"ok":true,"taskId","contractVersion","contentHash","metadata"} or
//   {"ok":false,"issues":[{"code","path"}]}  (parser issue codes only, never message text).
// Exit 0 for both answers; any other exit status is an adapter failure.

import { isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";

const LIMIT = 256 * 1024;

function answer(value) {
  process.stdout.write(JSON.stringify(value) + "\n");
}

async function readInput() {
  const chunks = [];
  let total = 0;
  for await (const chunk of process.stdin) {
    total += chunk.length;
    if (total > LIMIT) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

async function main() {
  const root = process.argv[2];
  if (process.argv.length !== 3 || typeof root !== "string" || !isAbsolute(root)) process.exit(2);
  const raw = await readInput();
  if (raw === null) return answer({ ok: false, issues: [{ code: "ADAPTER_LIMIT", path: [] }] });
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(raw);
  } catch {
    return answer({ ok: false, issues: [{ code: "NOT_WELL_FORMED_UTF8", path: [] }] });
  }
  const parser = await import(pathToFileURL(join(root, "src/forge/contract-document.ts")).href);
  const port = await import(pathToFileURL(join(root, "src/forge/node-sha256.ts")).href);
  const result = parser.parseContractDocument(text, port.nodeSha256Utf8);
  if (!result.ok) {
    const issues = result.issues.map((issue) => ({ code: String(issue.code), path: issue.path.map((p) => (typeof p === "number" ? p : String(p))) }));
    return answer({ ok: false, issues });
  }
  const { ref, metadata } = result.document;
  answer({ ok: true, taskId: ref.taskId, contractVersion: ref.contractVersion, contentHash: ref.contentHash, metadata });
}

main().catch(() => process.exit(3));
