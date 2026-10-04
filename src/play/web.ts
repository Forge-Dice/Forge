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
  newGame,
  questions,
  saveText,
  SESSION_ERRORS,
  type Action,
  type Game,
} from "./game.ts";
import { renderCaseList, renderGame, renderHelp, type Feedback } from "./web-page.ts";
import { PLAY_CASES, loadPlayPackage, playCaseName, type PlayCaseName } from "./cases.ts";
import { generateCase, generatedClockOrigin, generatedPackage } from "../authoring/case-generator.ts";
import { importCaseText, MAX_SHARE_BYTES } from "./case-share.ts";
import { renderImport } from "./import-page.ts";

// `npm run play:web`: the playable cases in the browser, one local player, same session logic as
// the CLI. The server holds one game per case in memory; saves are the Session C text.

const MAX_GENERATED = 20;
const MAX_IMPORTED = 20;
const MAX_BODY = Math.max(1024 * 1024, MAX_SHARE_BYTES) + 4096; // one Session C save or case file plus slack

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
    case "hint":
      return { tone: "info", title: "Hinweis", lines: [hintText(after, output.hint)] };
    case "interrogate":
      return { tone: "info", title: "Aussage", lines: [answerText(after, output.observation), ...learned] };
    case "confront":
      return {
        tone: output.observation.act === "admit" ? "ok" : "info",
        title: output.observation.act === "admit" ? "Konfrontation: die Aussage bricht ein" : "Konfrontation",
        lines: [confrontationText(after, output.observation), ...learned],
      };
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

const HINT: Action[] = [{ label: "Hinweis", event: { type: "hint" } }];

/** Saves of generated cases carry their seed around the unchanged Session C text. */
const wrapSave = (seed: number, text: string): string => JSON.stringify({ zufallsfall: seed, spielstand: text });

function unwrapSave(body: string): { seed: number | null; text: string } {
  try {
    const v: unknown = JSON.parse(body);
    if (typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v).length === 2) {
      const { zufallsfall, spielstand } = v as Record<string, unknown>;
      if (Number.isInteger(zufallsfall) && (zufallsfall as number) >= 0 && (zufallsfall as number) < 1e9 && typeof spielstand === "string") {
        return { seed: zufallsfall as number, text: spielstand };
      }
    }
  } catch {
    // Not JSON: the session decoder reports it.
  }
  return { seed: null, text: body };
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
/** A case served beside the fixed ones (the editor's "Probespielen"); `version` resets its game when it changes. */
export type ExtraCase = { readonly pkg: ResolvedCasePackage; readonly clockOrigin: number; readonly version: string };

export function createWebHandler(
  packages: Partial<Record<PlayCaseName, ResolvedCasePackage>> = {},
  options: { readonly editorLink?: boolean; readonly extraCase?: (slug: string) => ExtraCase | null } = {},
): WebHandler {
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
  // Generated cases ("Zufallsfall"): one slot per seed, created on first visit; the oldest is
  // dropped beyond MAX_GENERATED so arbitrary seeds cannot grow the memory without bound.
  const generated = new Map<number, { slot: Slot; clockOrigin: number }>();
  const extras = new Map<string, { version: string; slot: Slot }>();
  // Imported cases ("Eigenen Fall laden"), keyed by eigen-<digest>; the oldest is dropped beyond MAX_IMPORTED.
  const imported = new Map<string, { slot: Slot; clockOrigin: number; title: string }>();
  type Target = { readonly slot: Slot; readonly slug: string; readonly clockOrigin: number; readonly seed: number | null };
  const target = (slug: string | undefined): Target | null => {
    const name = playCaseName(slug);
    if (name !== null) return { slot: slot(name), slug: slugOf(name), clockOrigin: PLAY_CASES[name].clockOrigin, seed: null };
    const own = slug === undefined ? undefined : imported.get(slug);
    if (own !== undefined) return { slot: own.slot, slug: slug!, clockOrigin: own.clockOrigin, seed: null };
    const extra = slug === undefined || options.extraCase === undefined ? null : options.extraCase(slug);
    if (extra !== null) {
      let e = extras.get(slug!);
      if (e === undefined || e.version !== extra.version) {
        e = { version: extra.version, slot: { game: newGame(extra.pkg, extra.clockOrigin), feedback: { tone: "info", title: "Probespiel", lines: ["Der gespeicherte Stand deiner Arbeitskopie."] }, fresh: new Set() } };
        extras.set(slug!, e);
      }
      return { slot: e.slot, slug: slug!, clockOrigin: extra.clockOrigin, seed: null };
    }
    const m = /^zufall-(0|[1-9][0-9]{0,8})$/.exec(slug ?? "");
    if (m === null) return null;
    const seed = Number(m[1]);
    let g = generated.get(seed);
    if (g === undefined) {
      const generatedCase = generateCase(seed);
      const clockOrigin = generatedClockOrigin(generatedCase);
      const game = newGame(generatedPackage(generatedCase), clockOrigin);
      g = { slot: { game, feedback: { tone: "info", title: `Zufallsfall ${seed}`, lines: ["Ein erzeugter Fall. Lies die Fallakte und beginne zu ermitteln."] }, fresh: new Set() }, clockOrigin };
      generated.set(seed, g);
      if (generated.size > MAX_GENERATED) generated.delete(generated.keys().next().value!);
    }
    return { slot: g.slot, slug: `zufall-${seed}`, clockOrigin: g.clockOrigin, seed };
  };
  const redirect = (to: string): WebResponse => ({ status: 303, headers: { location: to }, body: "" });
  const html = (body: string): WebResponse => ({ status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }, body });
  const text = (status: number, body: string): WebResponse => ({ status, headers: { "content-type": "text/plain; charset=utf-8" }, body });
  const json = (status: number, body: unknown): WebResponse => ({ status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, body: JSON.stringify(body) });

  // The case list's own result sheet (a save that fits no case); shown once.
  let homeFeedback: Feedback | null = null;

  /** Loads a save into a case; the feedback says how it went. */
  function loadInto(t: Target, text: string): boolean {
    const s = t.slot;
    const loaded = loadText(s.game.pkg, text, t.clockOrigin);
    if (loaded.ok) [s.game, s.fresh] = [loaded.game, new Set()];
    s.feedback = loaded.ok
      ? { tone: "ok", title: "Spielstand geladen", lines: [`${s.game.state.events.length} Aktionen wiederhergestellt.`] }
      : { tone: "warn", title: loaded.text, lines: ["Lade eine unveränderte Datei, die mit diesem Fall gespeichert wurde."] };
    return loaded.ok;
  }

  function act(s: Slot, group: string | null, n: string | null, at: string | null): void {
    const { game } = s;
    if (at !== pageToken(game)) {
      s.feedback = { tone: "warn", title: "Die Seite war nicht mehr aktuell.", lines: ["Bitte wähle die Aktion noch einmal."] };
      return;
    }
    const menu = group === "u" ? investigations(game) : group === "f" ? questions(game) : group === "v" ? confrontations(game) : group === "a" ? accusations(game) : group === "h" ? HINT : [];
    const action = n !== null && /^[1-9][0-9]{0,3}$/.test(n) ? menu[Number(n) - 1] : undefined;
    if (action === undefined) return;
    const result = reduceSession(game.pkg, game.state, action.event);
    if (!result.ok) {
      const title = group === "h" && result.code === "ACTION_UNAVAILABLE" ? hintUnavailableText(game) : SESSION_ERRORS[result.code]!;
      s.feedback = { tone: "warn", title, lines: [] };
      return;
    }
    s.game = { ...game, state: result.state };
    s.fresh = unlocked(game, s.game);
    // A solving accusation is answered by the closing card itself.
    const solved = result.output.type === "accuse" && result.output.verdict === "solved";
    s.feedback = solved ? null : feedbackFor(game, s.game, action, result.output, s.fresh.size);
  }

  return async (method, rawUrl, readBody) => {
    let url: URL;
    try {
      url = new URL(rawUrl, "http://localhost");
    } catch {
      return text(400, "Ungültige Anfrage.");
    }
    if (method === "GET" && url.pathname === "/") {
      const cards = (Object.keys(PLAY_CASES) as PlayCaseName[]).map((name) => {
        const s = slot(name);
        const { publicContent } = s.game.pkg;
        const steps = s.game.state.events.length;
        const progress = s.game.state.phase === "solved" ? "Gelöst" : steps === 0 ? null : `${steps} Aktionen`;
        return { slug: slugOf(name), title: publicContent.title, teaser: publicContent.brief.split("\n")[0]!, progress, difficulty: PLAY_CASES[name].difficulty };
      });
      const recent = [...generated].reverse().map(([seed, g]) => {
        const steps = g.slot.game.state.events.length;
        return {
          slug: `zufall-${seed}`,
          title: `${g.slot.game.pkg.publicContent.title} (Seed ${seed})`,
          progress: g.slot.game.state.phase === "solved" ? "Gelöst" : steps === 0 ? null : `${steps} Aktionen`,
        };
      });
      const page = renderCaseList(cards, options.editorLink === true, { recent, feedback: homeFeedback });
      homeFeedback = null;
      return html(page);
    }
    if (method === "POST" && url.pathname === "/laden") {
      // Any save from the case list: a generated case's file names its seed, a fixed case's save
      // is matched by its package. Answers with the page to open (the list posts by script).
      const { seed, text: saved } = unwrapSave((await readBody()) ?? "");
      if (seed !== null) {
        const t = target(`zufall-${seed}`)!;
        loadInto(t, saved);
        return text(200, `/fall/${t.slug}`);
      }
      for (const name of Object.keys(PLAY_CASES) as PlayCaseName[]) {
        const t = target(slugOf(name))!;
        if (loadText(t.slot.game.pkg, saved, t.clockOrigin).ok) {
          loadInto(t, saved);
          return text(200, `/fall/${t.slug}`);
        }
      }
      homeFeedback = { tone: "warn", title: "Diese Datei passt zu keinem Fall.", lines: ["Lade eine unveränderte Datei, die mit „Speichern“ heruntergeladen wurde."] };
      return text(200, "/");
    }
    if (method === "GET" && url.pathname === "/hilfe") return html(renderHelp());
    if (method === "GET" && url.pathname === "/eigener-fall") return html(renderImport([...imported].map(([slug, c]) => ({ slug, title: c.title }))));
    if (method === "POST" && url.pathname === "/eigener-fall") {
      const body = await readBody();
      const result = body === null ? { ok: false as const, title: "Die Datei ist zu groß.", problems: [] } : importCaseText(body);
      if (!result.ok) return json(422, { ok: false, title: result.title, problems: result.problems });
      if (!imported.has(result.slug)) {
        const game = newGame(result.pkg, result.clockOrigin);
        imported.set(result.slug, { slot: { game, feedback: { tone: "info", title: "Eigener Fall", lines: ["Geprüft und geladen. Lies die Fallakte und beginne zu ermitteln."] }, fresh: new Set() }, clockOrigin: result.clockOrigin, title: result.title });
        if (imported.size > MAX_IMPORTED) imported.delete(imported.keys().next().value!);
      }
      return json(200, { ok: true, slug: result.slug, title: result.title });
    }
    if (method === "POST" && url.pathname === "/zufall") {
      // An empty seed picks one; anything else must be a whole number up to nine digits.
      const raw = (new URLSearchParams((await readBody()) ?? "").get("seed") ?? "").trim();
      const seed = raw === "" ? Math.floor(Math.random() * 1_000_000) : /^[0-9]{1,9}$/.test(raw) ? Number(raw) : null;
      return seed === null ? text(400, "Der Seed muss eine ganze Zahl sein.") : redirect(`/fall/zufall-${seed}`);
    }
    const match = /^\/fall\/([a-z0-9-]+)(\/(act|save|load|new))?$/.exec(url.pathname);
    const t = match === null ? null : target(match[1]);
    if (match === null || t === null) return text(404, "Nicht gefunden.");
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
          body: t.seed === null ? saved.text : wrapSave(t.seed, saved.text),
        };
      }
      case "POST act": {
        const body = await readBody();
        if (body === null) return text(413, "Zu groß.");
        const form = new URLSearchParams(body);
        act(s, form.get("group"), form.get("n"), form.get("at"));
        return redirect(home);
      }
      case "POST load": {
        // A generated case's save opens its own seed, wherever it was chosen.
        const body = await readBody();
        if (body === null) return text(413, "Zu groß.");
        const { seed, text: saved } = unwrapSave(body);
        const into = seed === null || seed === t.seed ? t : target(`zufall-${seed}`)!;
        loadInto(into, saved);
        return redirect(`/fall/${into.slug}`);
      }
      case "POST new":
        [s.game, s.fresh] = [newGame(s.game.pkg, t.clockOrigin), new Set()];
        s.feedback = { tone: "info", title: "Neues Spiel", lines: ["Der Fall beginnt von vorn."] };
        return redirect(home);
      default:
        return text(405, "Nicht erlaubt.");
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
      if (!trusted(req)) return void res.writeHead(403, plain).end("Nicht erlaubt.");
      if (extra !== null && (await extra.routes(req, res, new URL(req.url ?? "/", "http://localhost")))) return;
      const out = await handle(req.method ?? "GET", req.url ?? "/", () => readBody(req));
      res.writeHead(out.status, out.headers).end(out.body);
    } catch {
      if (!res.headersSent) res.writeHead(500, plain).end("Interner Fehler.");
      else res.destroy();
    }
  };
}
