import { parseContractDocument } from "./forgecopy/src/forge/contract-document.ts";
import { nodeSha256Utf8 } from "./forgecopy/src/forge/node-sha256.ts";
import { readFileSync, readdirSync } from "node:fs";
const dir = process.argv[2];
const out: any = {};
for (const f of readdirSync(dir).sort()) {
  const text = readFileSync(dir + "/" + f, "utf8");
  const r: any = (parseContractDocument as any)(text, nodeSha256Utf8);
  out[f] = r.ok ? { ok: true, ref: r.ref ?? r.value?.ref ?? r.document?.ref } : { ok: false, err: JSON.stringify(r).slice(0, 400) };
}
console.log(JSON.stringify(out, null, 1));
