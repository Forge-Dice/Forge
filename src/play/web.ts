import type { IncomingMessage, ServerResponse } from "node:http";
import type { ResolvedCasePackage } from "../domain/case-package.ts";
import { reduceSession, type SessionOutput } from "../domain/case-session.ts";
import {
  accusations,
  answerText,
  confrontationText,
  confrontations,
  evidenceText,
  hintText,
  pageToken,
  hintUnavailableText,
  investigations,
  known,
  loadText,
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
import { generateCase, generatedClockOrigin, generatedPackage } from "../authoring/case-generator.ts";

// `npm run play:web`: the playable cases in the browser, one local player, same session logic as
// the CLI. The server holds one game per case in memory; saves are the Session C text.

const MAX_GENERATED = 20;
const MAX_BODY = 1024 * 1024 + 4096; // one Session C save plus slack for a form body

// The language (de default, en) is the player's choice, remembered in a cookie; switching keeps
// the game (its events replay on the other language's package). Generated cases exist only in
// German: there the language changes the frame, not the case text.
const LANG_COOKIE = "sprache";

/** The remembered language from a Cookie header: the cookie set by /sprache, else German. */
export function langOfCookie(cookie: string | undefined): Lang {
  const pair = (cookie ?? "").split(";").map((c) => c.trim().split("=")).find(([k]) => k === LANG_COOKIE);
  return parseLang(pair?.[1]) ?? DEFAULT_LANG;
}

/** The game with its frame in another language (same package). */
const withLang = (game: Game, lang: Lang): Game => {
  const { lang: _, ...rest } = game;
  return lang === DEFAULT_LANG ? rest : { ...rest, lang };
};

function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        // Stop collecting but drain the rest, so the handler can still answer 413.
        req.removeAllListeners("data");
        req.resume();
        resolve(null);
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
/** A case served beside the fixed ones (the editor's "Probespielen"); `version` resets its game when it changes. */
export type ExtraCase = { readonly pkg: ResolvedCasePackage; readonly clockOrigin: number; readonly version: string };

export function createWebHandler(
  packages: Partial<Record<PlayCaseName, ResolvedCasePackage>> = {},
  options: { readonly editorLink?: boolean; readonly extraCase?: (slug: string) => ExtraCase | null } = {},
): WebHandler {
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
  // Generated cases ("Zufallsfall"): one slot per seed, created on first visit; the oldest is
  // dropped beyond MAX_GENERATED so arbitrary seeds cannot grow the memory without bound.
  const generated = new Map<number, { slot: Slot; clockOrigin: number }>();
  const extras = new Map<string, { version: string; slot: Slot }>();
  type Target = {
    readonly slot: Slot;
    readonly slug: string;
    readonly clockOrigin: number;
    /** A fresh game and a loaded save, both in the request's language. */
    readonly restart: () => Game;
    readonly load: (text: string) => ReturnType<typeof loadText>;
  };
  const target = (slug: string | undefined, lang: Lang): Target | null => {
    const name = playCaseName(slug);
    if (name !== null) {
      return {
        slot: slot(name, lang),
        slug: slugOf(name),
        clockOrigin: PLAY_CASES[name].clockOrigin,
        restart: () => start(name, lang),
        load: (text) => loadSaveInLang(name, lang, text, (l) => pkgFor(name, l)),
      };
    }
    const extra = slug === undefined || options.extraCase === undefined ? null : options.extraCase(slug);
    if (extra !== null) {
      // The editor's working copy: its own (German) case text in the request's language frame.
      let e = extras.get(slug!);
      if (e === undefined || e.version !== extra.version) {
        const m = MESSAGES[lang].web;
        e = { version: extra.version, slot: { game: withLang(newGame(extra.pkg, extra.clockOrigin), lang), feedback: { tone: "info", title: m.trialTitle, lines: [m.trialLine] }, fresh: new Set() } };
        extras.set(slug!, e);
      }
      const s = e.slot;
      if ((s.game.lang ?? DEFAULT_LANG) !== lang) s.game = withLang(s.game, lang);
      return {
        slot: s,
        slug: slug!,
        clockOrigin: extra.clockOrigin,
        restart: () => withLang(newGame(extra.pkg, extra.clockOrigin), lang),
        load: (text) => {
          const loaded = loadText(extra.pkg, text, extra.clockOrigin, lang === DEFAULT_LANG ? undefined : lang);
          return loaded.ok ? loaded : { ok: false, text: MESSAGES[lang].loadFailed };
        },
      };
    }
    const m = /^zufall-(0|[1-9][0-9]{0,8})$/.exec(slug ?? "");
    if (m === null) return null;
    const seed = Number(m[1]);
    let g = generated.get(seed);
    if (g === undefined) {
      const generatedCase = generateCase(seed);
      const clockOrigin = generatedClockOrigin(generatedCase);
      const game = withLang(newGame(generatedPackage(generatedCase), clockOrigin), lang);
      const m = MESSAGES[lang].web;
      g = { slot: { game, feedback: { tone: "info", title: m.randomCase(seed), lines: [m.randomWelcome] }, fresh: new Set() }, clockOrigin };
      generated.set(seed, g);
      if (generated.size > MAX_GENERATED) generated.delete(generated.keys().next().value!);
    }
    const { slot: s, clockOrigin } = g;
    if ((s.game.lang ?? DEFAULT_LANG) !== lang) s.game = withLang(s.game, lang);
    return {
      slot: s,
      slug: `zufall-${seed}`,
      clockOrigin,
      restart: () => withLang(newGame(s.game.pkg, clockOrigin), lang),
      load: (text) => {
        const loaded = loadText(s.game.pkg, text, clockOrigin, lang === DEFAULT_LANG ? undefined : lang);
        return loaded.ok ? loaded : { ok: false, text: MESSAGES[lang].loadFailed };
      },
    };
  };
  const redirect = (to: string): WebResponse => ({ status: 303, headers: { location: to }, body: "" });
  const html = (body: string): WebResponse => ({ status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }, body });
  const text = (status: number, body: string): WebResponse => ({ status, headers: { "content-type": "text/plain; charset=utf-8" }, body });

  function act(s: Slot, group: string | null, n: string | null, at: string | null): void {
    const { game } = s;
    if (at !== pageToken(game)) {
      s.feedback = { tone: "warn", title: msg(game).web.stale, lines: [msg(game).web.staleLine] };
      return;
    }
    const menu = group === "u" ? investigations(game) : group === "f" ? questions(game) : group === "v" ? confrontations(game) : group === "a" ? accusations(game) : group === "h" ? HINT(game) : [];
    const action = n !== null && /^[1-9][0-9]{0,3}$/.test(n) ? menu[Number(n) - 1] : undefined;
    if (action === undefined) return;
    const result = reduceSession(game.pkg, game.state, action.event);
    if (!result.ok) {
      const title = group === "h" && result.code === "ACTION_UNAVAILABLE" ? hintUnavailableText(game) : msg(game).errors[result.code]!;
      s.feedback = { tone: "warn", title, lines: [] };
      return;
    }
    s.game = { ...game, state: result.state };
    s.fresh = unlocked(game, s.game);
    // A solving accusation is answered by the closing card itself.
    const solved = result.output.type === "accuse" && result.output.verdict === "solved";
    s.feedback = solved ? null : feedbackFor(game, s.game, action, result.output, s.fresh.size);
  }

  return async (method, rawUrl, readBody, cookie) => {
    const lang = langOfCookie(cookie);
    const m = MESSAGES[lang].web;
    let url: URL;
    try {
      url = new URL(rawUrl, "http://localhost");
    } catch {
      return text(400, m.badRequest);
    }
    if (method === "GET" && url.pathname === "/") {
      const cards = (Object.keys(PLAY_CASES) as PlayCaseName[]).map((name) => {
        const s = slot(name, lang);
        const { publicContent } = s.game.pkg;
        const steps = s.game.state.events.length;
        const progress = s.game.state.phase === "solved" ? m.solvedBadge : steps === 0 ? null : m.actions(steps);
        return { slug: slugOf(name), title: publicContent.title, teaser: publicContent.brief.split("\n")[0]!, progress, difficulty: PLAY_CASES[name].difficulty };
      });
      return html(renderCaseList(cards, options.editorLink === true, lang));
    }
    if (method === "GET" && url.pathname === "/hilfe") return html(renderHelp(lang));
    if (method === "GET" && url.pathname === "/sprache") {
      // Only local paths: never redirect to another host.
      const back = url.searchParams.get("zurueck") ?? "/";
      const to = back.startsWith("/") && !back.startsWith("//") && !back.includes("\\") ? back : "/";
      const chosen = parseLang(url.searchParams.get("l")) ?? DEFAULT_LANG;
      return { status: 303, headers: { location: to, "set-cookie": `${LANG_COOKIE}=${chosen}; Path=/; Max-Age=31536000; SameSite=Lax` }, body: "" };
    }
    if (method === "POST" && url.pathname === "/zufall") {
      // An empty seed picks one; anything else must be a whole number up to nine digits.
      const raw = (new URLSearchParams((await readBody()) ?? "").get("seed") ?? "").trim();
      const seed = raw === "" ? Math.floor(Math.random() * 1_000_000) : /^[0-9]{1,9}$/.test(raw) ? Number(raw) : null;
      return seed === null ? text(400, m.badSeed) : redirect(`/fall/zufall-${seed}`);
    }
    const match = /^\/fall\/([a-z0-9-]+)(\/(act|save|load|new))?$/.exec(url.pathname);
    const t = match === null ? null : target(match[1], lang);
    if (match === null || t === null) return text(404, m.notFound);
    const s = t.slot;
    const home = `/fall/${t.slug}`;
    const route = `${method} ${match[3] ?? ""}`;
    switch (route) {
      case "GET ": {
        const page = renderGame(s.game, t.slug, s.feedback, s.fresh);
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
          headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${t.slug}.save.json"` },
          body: saved.text,
        };
      }
      case "POST act": {
        const body = await readBody();
        if (body === null) return text(413, m.tooLarge);
        const form = new URLSearchParams(body);
        act(s, form.get("group"), form.get("n"), form.get("at"));
        return redirect(home);
      }
      case "POST load": {
        const body = await readBody();
        if (body === null) return text(413, m.tooLarge);
        const loaded = t.load(body);
        if (loaded.ok) [s.game, s.fresh] = [loaded.game, new Set()];
        s.feedback = loaded.ok
          ? { tone: "ok", title: m.loadedTitle, lines: [m.loadedLine(s.game.state.events.length)] }
          : { tone: "warn", title: loaded.text, lines: [m.loadHelp] };
        return redirect(home);
      }
      case "POST new":
        [s.game, s.fresh] = [t.restart(), new Set()];
        s.feedback = { tone: "info", title: m.newGameTitle, lines: [m.newGameLine] };
        return redirect(home);
      default:
        return text(405, m.notAllowed);
    }
  };
}

/**
 * Local-only server: requests must name a loopback host (no DNS rebinding), and a post that
 * carries an Origin must come from this server's own pages (no cross-site form posts).
 */
function trusted(req: IncomingMessage): boolean {
  const host = req.headers.host ?? "";
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) return false;
  const origin = req.headers.origin;
  if (req.method !== "POST" || origin === undefined) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Extra node routes in front of the game (the case editor); true when the request was handled. */
export type NodeRoutes = (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<boolean>;

/** Node request handler around createWebHandler; exported for tests. */
export function createWebApp(
  packages: Partial<Record<PlayCaseName, ResolvedCasePackage>> = {},
  extra: { readonly routes: NodeRoutes; readonly editorLink: boolean; readonly extraCase?: (slug: string) => ExtraCase | null } | null = null,
) {
  const handle = createWebHandler(packages, { editorLink: extra?.editorLink === true, ...(extra?.extraCase === undefined ? {} : { extraCase: extra.extraCase }) });
  const plain = { "content-type": "text/plain; charset=utf-8", connection: "close" };
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    // Every failure ends in a response: a thrown error must never become an unhandled rejection.
    try {
      // Checked before the editor routes too: they write case files.
      if (!trusted(req)) return void res.writeHead(403, plain).end(MESSAGES[langOfCookie(req.headers.cookie)].web.notAllowed);
      if (extra !== null && (await extra.routes(req, res, new URL(req.url ?? "/", "http://localhost")))) return;
      const out = await handle(req.method ?? "GET", req.url ?? "/", () => readBody(req), req.headers.cookie);
      res.writeHead(out.status, out.headers).end(out.body);
    } catch {
      if (!res.headersSent) res.writeHead(500, plain).end(MESSAGES[langOfCookie(req.headers.cookie)].web.internalError);
      else res.destroy();
    }
  };
}
