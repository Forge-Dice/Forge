import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { ResolvedCasePackage } from "../domain/case-package.ts";
import { reduceSession, type SessionOutput } from "../domain/case-session.ts";
import { accusations, answerText, evidenceText, investigations, known, loadText, newGame, questions, saveText, type Action, type Game } from "./game.ts";
import { renderCaseList, renderGame, renderHelp, type Feedback } from "./web-page.ts";
import { PLAY_CASES, loadPlayPackage, playCaseName, type PlayCaseName } from "./cases.ts";

// `npm run play:web`: the playable cases in the browser, one local player, same session logic as
// the CLI. The server holds one game per case in memory; saves are the Session C text.

const MAX_BODY = 1024 * 1024 + 4096; // one Session C save plus slack for a form body

const ERRORS: Record<string, string> = {
  ACTION_UNAVAILABLE: "Das geht gerade nicht.",
  SESSION_CLOSED: "Der Fall ist bereits gelöst.",
  LIMIT_REACHED: "Das Aktionslimit dieses Falls ist erreicht.",
  HOST_FAILURE: "Technischer Fehler, die Aktion wurde nicht ausgeführt.",
};

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

/** Feedback for one accepted action: what was done, what is new, in the player's words. */
function feedbackFor(before: Game, after: Game, action: Action, output: SessionOutput, unlockedCount = 0): Feedback {
  const newKnown = after.state.knowledge.known.filter((k) => !before.state.knowledge.known.some((b) => b.ref === k.ref));
  const labels = (kind: string) => known(after, kind).filter((k) => newKnown.some((n) => n.ref === k.ref)).map((k) => k.label);
  const news = ["person", "location", "item", "event"].flatMap(labels);
  const learned = [
    ...(news.length === 0 ? [] : [`Neu bekannt: ${news.join(", ")}.`]),
    ...(unlockedCount === 0 ? [] : [unlockedCount === 1 ? "Eine neue Spur ist offen." : `${unlockedCount} neue Spuren sind offen.`]),
  ];
  switch (output.type) {
    case "investigate":
      if (output.observations.length === 0) {
        return { tone: "info", title: action.label, lines: ["Hier findest du nichts Neues.", ...learned] };
      }
      return {
        tone: "info",
        title: `${action.label}: ${output.observations.length === 1 ? "ein neuer Fund" : `${output.observations.length} neue Funde`}`,
        lines: [...output.observations.map((o) => evidenceText(after, o)), ...learned],
      };
    case "interrogate":
      return { tone: "info", title: "Aussage", lines: [answerText(after, output.observation), ...learned] };
    case "accuse":
      return output.verdict === "solved"
        ? { tone: "ok", title: "Die Anklage sitzt.", lines: [`Du hast ${action.label} angeklagt. Der Fall ist gelöst.`] }
        : {
            tone: "warn",
            title: "Diese Anklage löst den Fall nicht.",
            lines: [`Du hast ${action.label} angeklagt, doch damit ist der Fallauftrag nicht erfüllt. Ermittle weiter und prüfe deine Nachweise.`],
          };
  }
}

type Slot = { game: Game; feedback: Feedback | null; fresh: ReadonlySet<string> };

/** Labels of actions the last step made available, shown as new in the menus. */
function unlocked(before: Game, after: Game): Set<string> {
  const menu = (g: Game) => [...investigations(g), ...questions(g)].map((a) => a.label);
  const old = new Set(menu(before));
  return new Set(menu(after).filter((label) => !old.has(label)));
}

export type WebResponse = { readonly status: number; readonly headers: Readonly<Record<string, string>>; readonly body: string };
export type WebHandler = (method: string, url: string, body: () => Promise<string | null>) => Promise<WebResponse>;

/**
 * The whole front end as a function of (method, url, body) over one in-memory game per case. The
 * node server below and the single-file browser build (web-standalone.ts) both run exactly this.
 */
export function createWebHandler(packages: Partial<Record<PlayCaseName, ResolvedCasePackage>> = {}): WebHandler {
  const slots = new Map<PlayCaseName, Slot>();
  const slot = (name: PlayCaseName): Slot => {
    let s = slots.get(name);
    if (s === undefined) {
      const pkg = packages[name] ?? loadPlayPackage(name);
      s = { game: newGame(pkg, PLAY_CASES[name].clockOrigin), feedback: { tone: "info", title: "Willkommen", lines: ["Lies die Fallakte und beginne zu ermitteln."] }, fresh: new Set() };
      slots.set(name, s);
    }
    return s;
  };
  const slugOf = (name: PlayCaseName) => PLAY_CASES[name].dir;
  const redirect = (to: string): WebResponse => ({ status: 303, headers: { location: to }, body: "" });
  const html = (body: string): WebResponse => ({ status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }, body });
  const text = (status: number, body: string): WebResponse => ({ status, headers: { "content-type": "text/plain; charset=utf-8" }, body });

  function act(s: Slot, group: string | null, n: string | null, at: string | null): void {
    const { game } = s;
    if (at !== String(game.state.events.length)) {
      s.feedback = { tone: "warn", title: "Die Seite war nicht mehr aktuell.", lines: ["Bitte wähle die Aktion noch einmal."] };
      return;
    }
    const menu = group === "u" ? investigations(game) : group === "f" ? questions(game) : group === "a" ? accusations(game) : [];
    const action = n !== null && /^[1-9][0-9]{0,3}$/.test(n) ? menu[Number(n) - 1] : undefined;
    if (action === undefined) return;
    const result = reduceSession(game.pkg, game.state, action.event);
    if (!result.ok) {
      s.feedback = { tone: "warn", title: ERRORS[result.code]!, lines: [] };
      return;
    }
    s.game = { ...game, state: result.state };
    s.fresh = unlocked(game, s.game);
    // A solving accusation is answered by the closing card itself.
    const solved = result.output.type === "accuse" && result.output.verdict === "solved";
    s.feedback = solved ? null : feedbackFor(game, s.game, action, result.output, s.fresh.size);
  }

  return async (method, rawUrl, readBody) => {
    const url = new URL(rawUrl, "http://localhost");
    if (method === "GET" && url.pathname === "/") {
      const cards = (Object.keys(PLAY_CASES) as PlayCaseName[]).map((name) => {
        const s = slot(name);
        const { publicContent } = s.game.pkg;
        const steps = s.game.state.events.length;
        const progress = s.game.state.phase === "solved" ? "Gelöst" : steps === 0 ? null : `${steps} Aktionen`;
        return { slug: slugOf(name), title: publicContent.title, teaser: publicContent.brief.split("\n")[0]!, progress };
      });
      return html(renderCaseList(cards));
    }
    if (method === "GET" && url.pathname === "/hilfe") return html(renderHelp());
    const match = /^\/fall\/([a-z0-9-]+)(\/(act|save|load|new))?$/.exec(url.pathname);
    const name = match === null ? null : playCaseName(match[1]);
    if (match === null || name === null) return text(404, "Nicht gefunden.");
    const s = slot(name);
    const home = `/fall/${slugOf(name)}`;
    const route = `${method} ${match[3] ?? ""}`;
    switch (route) {
      case "GET ": {
        const page = renderGame(s.game, slugOf(name), s.feedback, s.fresh);
        s.feedback = null;
        return html(page);
      }
      case "GET save": {
        const saved = saveText(s.game);
        if (!saved.ok) {
          s.feedback = { tone: "warn", title: saved.text, lines: [] };
          return redirect(home);
        }
        return {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${slugOf(name)}.save.json"` },
          body: saved.text,
        };
      }
      case "POST act": {
        const form = new URLSearchParams((await readBody()) ?? "");
        act(s, form.get("group"), form.get("n"), form.get("at"));
        return redirect(home);
      }
      case "POST load": {
        const loaded = loadText(s.game.pkg, (await readBody()) ?? "", PLAY_CASES[name].clockOrigin);
        if (loaded.ok) [s.game, s.fresh] = [loaded.game, new Set()];
        s.feedback = loaded.ok
          ? { tone: "ok", title: "Spielstand geladen", lines: [`${s.game.state.events.length} Aktionen wiederhergestellt.`] }
          : { tone: "warn", title: loaded.text, lines: ["Lade eine unveränderte Datei, die mit diesem Fall gespeichert wurde."] };
        return redirect(home);
      }
      case "POST new":
        [s.game, s.fresh] = [newGame(s.game.pkg, PLAY_CASES[name].clockOrigin), new Set()];
        s.feedback = { tone: "info", title: "Neues Spiel", lines: ["Der Fall beginnt von vorn."] };
        return redirect(home);
      default:
        return text(405, "Nicht erlaubt.");
    }
  };
}

/** Node request handler around createWebHandler; exported for tests. */
export function createWebApp(packages: Partial<Record<PlayCaseName, ResolvedCasePackage>> = {}) {
  const handle = createWebHandler(packages);
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const out = await handle(req.method ?? "GET", req.url ?? "/", () => readBody(req));
    res.writeHead(out.status, out.headers).end(out.body);
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 4173);
  const app = createWebApp();
  // Local only: bound to the loopback interface.
  createServer((req, res) => void app(req, res)).listen(port, "127.0.0.1", () => {
    console.log(`Kriminalfälle laufen auf http://localhost:${port}  (Strg+C beendet)`);
  });
}
