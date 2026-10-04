import { createWebHandler } from "../web.ts";
import { PLAY_CASES } from "../cases.ts";

// Entry of the single-file browser build: the same handler the node server runs, exposed to the
// page shell (shell.js) as globalThis.kriminalfaelle.

(globalThis as { kriminalfaelle?: unknown }).kriminalfaelle = {
  handle: createWebHandler(),
  slugs: Object.values(PLAY_CASES).map((c) => c.dir),
};
