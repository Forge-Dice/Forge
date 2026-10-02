import { createHash } from "node:crypto";
import type { Sha256Utf8 } from "./contract-document.ts";

// Node runtime adapter for the SHA-256 port. The only file under src/forge that imports node:*.
// Callers pass well-formed strings only (the kernel rejects lone surrogates before hashing).

export const nodeSha256Utf8: Sha256Utf8 = (text) => createHash("sha256").update(text, "utf8").digest("hex");
