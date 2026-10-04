import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { ResolvedCasePackage } from "../domain/case-package.ts";
import { reduceSession, type SessionOutput } from "../domain/case-session.ts";
import {
  accusations,
  answerText,
  confrontationText,
  confrontations,
  evidenceText,
  hintText,
  investigations,
  known,
  msg,
  newGame,
  questions,
  saveText,
  switchLang,
  type Action,
  type Game,
} from "./game.ts";
import { renderCaseList, renderGame, renderHelp, type Feedback } from "./web-page.ts";
import { PLAY_CASES, loadPlayPackage, loadSaveInLang, playCaseName, type PlayCaseName } from "./cases.ts";
import { DEFAULT_LANG, MESSAGES, parseLang, type Lang } from "./messages.ts";

// `npm run play:web`: the playable cases in the browser, one local player, same session logic as
// the CLI. The server holds one game per case in memory; saves are the Session C text.

const MAX_BODY = 1024 * 1024 + 4096; // one Session C save plus slack for a form body

// The language (de default, en) is the player's choice, remembered in a cookie; switching keeps
// the game (its events replay on the other language's package).
const LANG_COOKIE = "sprache";

/** The remembered language from a Cookie header: the cookie set by /sprache, else German. */
export function langOfCookie(cookie: string | undefined): Lang {
  const pair = (cookie ?? "").split(";").map((c) => c.trim().split("=")).find(([k]) => k === LANG_COOKIE);
  return parseLang(pair?.[1]) ?? DEFAULT_LANG;
}

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
  const m = msg(after).web;
  const newKnown = after.state.knowledge.known.filter((k) => !before.state.knowledge.known.some((b) => b.ref === k.ref));
  const labels = (kind: string) => known(after, kind).filter((k) => newKnown.some((n) => n.ref === k.ref)).map((k) => k.label);
  const news = ["person", "location", "item", "event"].flatMap(labels);
  const learned = [
    ...(news.length === 0 ? [] : [m.newKnown(news.join(", "))]),
    ...(unlockedCount === 0 ? [] : [m.newLeads(unlockedCount)]),
  ];
  switch (output.type) {
    case "investigate":
      if (output.observations.length === 0) {
        return { tone: "info", title: action.label, lines: [m.nothingHere, ...learned] };
      }
      return {
        tone: "info",
        title: `${action.label}: ${m.newFinds(output.observations.length)}`,
        lines: [...output.observations.map((o) => evidenceText(after, o)), ...learned],
      };
    case "hint":
      return { tone: "info", title: m.hint, lines: [hintText(after, output.hint)] };
    case "interrogate":
      return { tone: "info", title: m.statement, lines: [answerText(after, output.observation), ...learned] };
    case "confront":
      return {
        tone: output.observation.act === "admit" ? "ok" : "info",
        title: output.observation.act === "admit" ? m.confrontationBreaks : m.confrontation,
        lines: [confrontationText(after, output.observation), ...learned],
      };
    case "accuse":
      return output.verdict === "solved"
        ? { tone: "ok", title: m.accuseSolvedTitle, lines: [m.accuseSolved(action.label)] }
        : { tone: "warn", title: m.accuseWrongTitle, lines: [m.accuseWrong(action.label)] };
  }
}

const HINT = (game: Game): Action[] => [{ label: msg(game).web.hint, event: { type: "hint" } }];

type Slot = { game: Game; feedback: Feedback | null; fresh: ReadonlySet<string> };

/** Labels of actions the last step made available, shown as new in the menus. */
function unlocked(before: Game, after: Game): Set<string> {
  const menu = (g: Game) => [...investigations(g), ...questions(g)].map((a) => a.label);
  const old = new Set(menu(before));
  return new Set(menu(after).filter((label) => !old.has(label)));
}

export type WebResponse = { readonly status: number; readonly headers: Readonly<Record<string, string>>; readonly body: string };
/** cookie: the request's Cookie header (the language choice); the response may set it. */
export type WebHandler = (method: string, url: string, body: () => Promise<string | null>, cookie?: string) => Promise<WebResponse>;

/**
 * The whole front end as a function of (method, url, body) over one in-memory game per case. The
 * node server below and the single-file browser build (web-standalone.ts) both run exactly this.
 */
export function createWebHandler(packages: Partial<Record<PlayCaseName, ResolvedCasePackage>> = {}): WebHandler {
  // Given packages are the German ones; other languages load their locale variant on demand.
  const loaded = new Map<string, ResolvedCasePackage>();
  const pkgFor = (name: PlayCaseName, lang: Lang): ResolvedCasePackage => {
    const given = lang === DEFAULT_LANG ? packages[name] : undefined;
    if (given !== undefined) return given;
    const key = `${name}|${lang}`;
    let pkg = loaded.get(key);
    if (pkg === undefined) loaded.set(key, (pkg = loadPlayPackage(name, lang)));
    return pkg;
  };
  const start = (name: PlayCaseName, lang: Lang): Game => newGame(pkgFor(name, lang), PLAY_CASES[name].clockOrigin, lang === DEFAULT_LANG ? undefined : lang);
  const slots = new Map<PlayCaseName, Slot>();
  const slot = (name: PlayCaseName, lang: Lang): Slot => {
    let s = slots.get(name);
    if (s === undefined) {
      const m = MESSAGES[lang].web;
      s = { game: start(name, lang), feedback: { tone: "info", title: m.welcome, lines: [m.welcomeLine] }, fresh: new Set() };
      slots.set(name, s);
    } else if ((s.game.lang ?? DEFAULT_LANG) !== lang) {
      // Same case, other language: the player's events replay on that language's package.
      s.game = switchLang(s.game, pkgFor(name, lang), lang) ?? start(name, lang);
      [s.feedback, s.fresh] = [null, new Set()];
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
      s.feedback = { tone: "warn", title: msg(game).web.stale, lines: [msg(game).web.staleLine] };
      return;
    }
    const menu = group === "u" ? investigations(game) : group === "f" ? questions(game) : group === "v" ? confrontations(game) : group === "a" ? accusations(game) : group === "h" ? HINT(game) : [];
    const action = n !== null && /^[1-9][0-9]{0,3}$/.test(n) ? menu[Number(n) - 1] : undefined;
    if (action === undefined) return;
    const result = reduceSession(game.pkg, game.state, action.event);
    if (!result.ok) {
      s.feedback = { tone: "warn", title: msg(game).errors[result.code]!, lines: [] };
      return;
    }
    s.game = { ...game, state: result.state };
    s.fresh = unlocked(game, s.game);
    // A solving accusation is answered by the closing card itself.
    const solved = result.output.type === "accuse" && result.output.verdict === "solved";
    s.feedback = solved ? null : feedbackFor(game, s.game, action, result.output, s.fresh.size);
  }

  return async (method, rawUrl, readBody, cookie) => {
    const url = new URL(rawUrl, "http://localhost");
    const lang = langOfCookie(cookie);
    const m = MESSAGES[lang].web;
    if (method === "GET" && url.pathname === "/") {
      const cards = (Object.keys(PLAY_CASES) as PlayCaseName[]).map((name) => {
        const s = slot(name, lang);
        const { publicContent } = s.game.pkg;
        const steps = s.game.state.events.length;
        const progress = s.game.state.phase === "solved" ? m.solvedBadge : steps === 0 ? null : m.actions(steps);
        return { slug: slugOf(name), title: publicContent.title, teaser: publicContent.brief.split("\n")[0]!, progress };
      });
      return html(renderCaseList(cards, lang));
    }
    if (method === "GET" && url.pathname === "/hilfe") return html(renderHelp(lang));
    if (method === "GET" && url.pathname === "/sprache") {
      // Only local paths: never redirect to another host.
      const back = url.searchParams.get("zurueck") ?? "/";
      const to = back.startsWith("/") && !back.startsWith("//") && !back.includes("\\") ? back : "/";
      const chosen = parseLang(url.searchParams.get("l")) ?? DEFAULT_LANG;
      return { status: 303, headers: { location: to, "set-cookie": `${LANG_COOKIE}=${chosen}; Path=/; Max-Age=31536000; SameSite=Lax` }, body: "" };
    }
    const match = /^\/fall\/([a-z0-9-]+)(\/(act|save|load|new))?$/.exec(url.pathname);
    const name = match === null ? null : playCaseName(match[1]);
    if (match === null || name === null) return text(404, m.notFound);
    const s = slot(name, lang);
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
        const loaded = loadSaveInLang(name, lang, (await readBody()) ?? "", (l) => pkgFor(name, l));
        if (loaded.ok) [s.game, s.fresh] = [loaded.game, new Set()];
        s.feedback = loaded.ok
          ? { tone: "ok", title: m.loadedTitle, lines: [m.loadedLine(s.game.state.events.length)] }
          : { tone: "warn", title: loaded.text, lines: [m.loadHelp] };
        return redirect(home);
      }
      case "POST new":
        [s.game, s.fresh] = [start(name, lang), new Set()];
        s.feedback = { tone: "info", title: m.newGameTitle, lines: [m.newGameLine] };
        return redirect(home);
      default:
        return text(405, m.notAllowed);
    }
  };
}

/** Node request handler around createWebHandler; exported for tests. */
export function createWebApp(packages: Partial<Record<PlayCaseName, ResolvedCasePackage>> = {}) {
  const handle = createWebHandler(packages);
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const out = await handle(req.method ?? "GET", req.url ?? "/", () => readBody(req), req.headers.cookie);
    res.writeHead(out.status, out.headers).end(out.body);
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 4173);
  const app = createWebApp();
  // Local only: bound to the loopback interface.
  createServer((req, res) => void app(req, res)).listen(port, "127.0.0.1", () => {
    console.log(MESSAGES[DEFAULT_LANG].web.running(port));
  });
}
