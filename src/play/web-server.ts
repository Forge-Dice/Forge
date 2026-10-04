import { createServer } from "node:http";
import type { ResolvedCasePackage } from "../domain/case-package.ts";
import type { PlayCaseName } from "./cases.ts";
import { createEditorRoutes, type EditorOptions } from "./editor-web.ts";
import { defaultWorkspaceDir } from "./editor.ts";
import { createWebApp } from "./web.ts";

// `npm run play:web`: the game of web.ts plus the case editor (/editor). The editor reads and writes
// case folders on disk, so it lives only in this node server, not in the single-file browser build.

export function createWebServerApp(packages: Partial<Record<PlayCaseName, ResolvedCasePackage>> = {}, editor: EditorOptions = { workspaceDir: defaultWorkspaceDir() }) {
  const { routes, probeCase } = createEditorRoutes(editor);
  return createWebApp(packages, { routes, editorLink: true, extraCase: probeCase });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 4173);
  const app = createWebServerApp();
  // Local only: bound to the loopback interface.
  createServer((req, res) => void app(req, res)).listen(port, "127.0.0.1", () => {
    console.log(`Kriminalfälle laufen auf http://localhost:${port}  (Strg+C beendet, Fall-Editor unter /editor)`);
  });
}
