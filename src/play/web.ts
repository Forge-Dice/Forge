import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { ResolvedCasePackage } from "../domain/case-package.ts";
import { command, loadText, newGame, saveText, type Game } from "./game.ts";
import { renderPage, type Notice } from "./web-page.ts";
import { loadVitrinePackage } from "./vitrine.ts";

// `npm run play:web`: "Die leere Vitrine" in the browser, one local player, same session logic as
// the CLI. The server holds the game in memory; saves are the Session C text, downloaded and uploaded.

const MAX_BODY = 1024 * 1024 + 4096; // one Session C save plus slack for a form body

function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        resolve(null);
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => resolve(null));
  });
}

/** Request handler over one in-memory game; exported for tests. */
export function createWebApp(pkg: ResolvedCasePackage) {
  let game: Game = newGame(pkg);
  let notice: Notice | null = { text: "Willkommen. Lies die Fallakte und beginne zu ermitteln.", tone: "info" };

  const redirect = (res: ServerResponse): void => void res.writeHead(303, { location: "/" }).end();

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method === "GET" && url.pathname === "/") {
      const page = renderPage(game, notice);
      notice = null;
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }).end(page);
      return;
    }
    if (req.method === "GET" && url.pathname === "/save") {
      const saved = saveText(game);
      if (!saved.ok) {
        notice = { text: saved.text, tone: "warn" };
        return redirect(res);
      }
      res
        .writeHead(200, { "content-type": "application/json; charset=utf-8", "content-disposition": 'attachment; filename="vitrine.save.json"' })
        .end(saved.text);
      return;
    }
    if (req.method === "POST" && url.pathname === "/act") {
      const form = new URLSearchParams((await readBody(req)) ?? "");
      const group = form.get("group");
      const n = form.get("n");
      if (form.get("at") !== String(game.state.events.length)) {
        notice = { text: "Die Seite war nicht mehr aktuell. Bitte wähle erneut.", tone: "warn" };
      } else if ((group === "u" || group === "f" || group === "a") && n !== null && /^[1-9][0-9]{0,3}$/.test(n)) {
        const before = game.state.events.length;
        const step = command(game, `${group} ${n}`);
        game = step.game;
        const accepted = game.state.events.length > before;
        notice = { text: step.text, tone: game.state.phase === "solved" ? "ok" : accepted ? "info" : "warn" };
      }
      return redirect(res);
    }
    if (req.method === "POST" && url.pathname === "/load") {
      const loaded = loadText(pkg, (await readBody(req)) ?? "");
      if (loaded.ok) game = loaded.game;
      notice = loaded.ok ? { text: `Spielstand geladen: ${game.state.events.length} Aktionen.`, tone: "ok" } : { text: loaded.text, tone: "warn" };
      return redirect(res);
    }
    if (req.method === "POST" && url.pathname === "/new") {
      game = newGame(pkg);
      notice = { text: "Neues Spiel begonnen.", tone: "info" };
      return redirect(res);
    }
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Nicht gefunden.");
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 4173);
  const app = createWebApp(loadVitrinePackage());
  // Local only: bound to the loopback interface.
  createServer((req, res) => void app(req, res)).listen(port, "127.0.0.1", () => {
    console.log(`Die leere Vitrine läuft auf http://localhost:${port}  (Strg+C beendet)`);
  });
}
