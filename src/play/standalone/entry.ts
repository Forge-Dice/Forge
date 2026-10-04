import { createWebHandler } from "../web.ts";
import { PLAY_CASES } from "../cases.ts";

// Entry of the single-file browser build: the same handler the node server runs, exposed to the
// page shell (shell.js) as globalThis.kriminalfaelle. Generated cases are never dropped from memory:
// the shell restores every stored Zufallsfall at boot and autosaves after each action, so a dropped
// one would come back empty and its save would be overwritten.

(globalThis as { kriminalfaelle?: unknown }).kriminalfaelle = {
  handle: createWebHandler({}, { maxGenerated: Infinity }),
  slugs: Object.values(PLAY_CASES).map((c) => c.dir),
};
