import { createWebHandler } from "../web.ts";
import { PLAY_CASES } from "../cases.ts";

// Entry of the single-file browser build: the same handler the node server runs, exposed to the
// page shell (shell.js) as globalThis.kriminalfaelle. The shell also starts this same script in a
// Web Worker (globalThis.__kfWorker set first): there the handler answers requests as messages,
// so a slow step (the difficulty search) never freezes the page, and reports its progress. Generated cases are never dropped from memory: the shell restores every
// stored Zufallsfall at boot and autosaves after each action, so a dropped one would come back
// empty and its save would be overwritten.

type Request = { readonly id: number; readonly method: string; readonly url: string; readonly body: string | null };
const scope = globalThis as unknown as {
  __kfWorker?: boolean;
  kriminalfaelle?: unknown;
  postMessage: (message: unknown) => void;
  onmessage: ((e: { data: Request }) => void) | null;
};

if (scope.__kfWorker === true) {
  const handle = createWebHandler({}, { maxGenerated: Infinity, progress: (text) => scope.postMessage({ progress: text }) });
  // One request at a time, in arrival order: the handler's games are shared state.
  let queue: Promise<void> = Promise.resolve();
  scope.onmessage = ({ data }) => {
    queue = queue.then(async () => {
      try {
        scope.postMessage({ id: data.id, res: await handle(data.method, data.url, async () => data.body) });
      } catch (error) {
        scope.postMessage({ id: data.id, error: String((error as Error)?.message ?? error) });
      }
    });
  };
} else {
  scope.kriminalfaelle = {
    handle: createWebHandler({}, { maxGenerated: Infinity }),
    // A fresh handler with no games in memory (tests compare it with a fresh server handler).
    create: () => createWebHandler({}, { maxGenerated: Infinity }),
    slugs: Object.values(PLAY_CASES).map((c) => c.dir),
  };
}
