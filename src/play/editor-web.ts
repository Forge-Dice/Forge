import { readdirSync, readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { checkCaseFolder } from "../authoring/check-case.ts";
import { caseSources, clockOriginOf, CaseWorkspace, editsFromForm, isCaseName, playtestFolder, type CaseSource, type Probe } from "./editor.ts";
import { checkPanel, playtestPanel, renderEditor, renderEditorHome, type WorkspaceCard } from "./editor-page.ts";
import type { StructureOp } from "./editor-structure.ts";
import { exportCaseFiles } from "./case-share.ts";
import type { Feedback } from "./web-page.ts";
import { problemText } from "../authoring/check-case-en.ts";
import { EDITOR_MESSAGES } from "./editor-messages.ts";
import { langOfCookie } from "./web.ts";
import type { Lang } from "./messages.ts";

// HTTP routes of the case editor inside play:web:
//   GET  /editor                 working copies, sources, generator
//   POST /editor/open            source=<key>[&reset=1]  copy a source into the working folder
//   POST /editor/generate        seed=<n>                generate a case into the working folder
//   GET  /editor/<name>          the editor
//   POST /editor/<name>/check    form -> JSON {ok, problems, routes, html}, nothing is written
//   POST /editor/<name>/save     form -> applied to the working copy, hashes recomputed
//   POST /editor/<name>/struct   op=... add or remove persons, places, items, clues, questions, steps, routes
//   POST /editor/<name>/undo     back to the state before the last structural edit
// /fall/probe-<name> plays the saved working copy (see probeCase), the check JSON carries the
// playtest bot's panel when the previewed case is valid.

const MAX_EDITOR_BODY = 8 * 1024 * 1024;

function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_EDITOR_BODY) {
        // Stop collecting but drain the rest, so the route can still answer 413.
        req.removeAllListeners("data");
        req.resume();
        resolve(null);
      } else chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => resolve(null));
  });
}

export type EditorOptions = { readonly workspaceDir: string; readonly sources?: readonly CaseSource[] };

/** Structural operation from a form; null if a field is missing or malformed. */
export function structureOpFromForm(form: URLSearchParams): StructureOp | null {
  const v = (k: string) => (form.get(k) ?? "").trim();
  switch (v("op")) {
    case "add-entity": {
      const kind = v("kind");
      if (kind !== "person" && kind !== "location" && kind !== "item") return null;
      return { op: "add-entity", kind, name: v("name"), role: v("role"), known: form.get("known") === "1", npc: kind === "person" && form.get("npc") === "1" };
    }
    case "add-clue":
      return { op: "add-clue", name: v("name"), text: v("text"), at: v("at"), supports: v("supports") };
    case "add-question":
      return { op: "add-question", npc: v("npc"), about: form.getAll("about"), text: v("text") };
    case "add-step": {
      const action = v("action");
      if (action !== "search_location" && action !== "examine_item" && action !== "ask") return null;
      return { op: "add-step", action, target: v("target"), ...(v("question") === "" ? {} : { question: v("question") }) };
    }
    case "add-route":
      return { op: "add-route", stepIds: v("steps").split(/[\s,]+/).filter((x) => x !== "") };
    case "remove":
      return { op: "remove", id: v("id") };
    case "remove-route":
      return { op: "remove-route", routeId: v("routeId") };
    case "remove-step":
      return { op: "remove-step", stepId: v("stepId") };
    default:
      return null;
  }
}

export function createEditorRoutes(options: EditorOptions) {
  const workspace = new CaseWorkspace(options.workspaceDir);
  const sources = (lang?: Lang) => options.sources ?? caseSources(undefined, lang);
  const notices = new Map<string, Feedback>();
  const html = (res: ServerResponse, body: string): void =>
    void res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }).end(body);
  const redirect = (res: ServerResponse, to: string): void => void res.writeHead(303, { location: to }).end();
  const fail = (res: ServerResponse, status: number, text: string): void => void res.writeHead(status, { "content-type": "text/plain; charset=utf-8" }).end(text);
  const take = (key: string) => {
    const n = notices.get(key) ?? null;
    notices.delete(key);
    return n;
  };

  /** The saved working copy behind /fall/probe-<name>, for the game handler. */
  const probeCase = (slug: string): Probe | null => {
    const m = /^probe-([a-z0-9][a-z0-9-]{0,63})$/.exec(slug);
    return m === null ? null : workspace.probe(m[1]!);
  };

  /** Handles /editor and below; false for any other path. */
  const routes = async (req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> => {
    if (url.pathname !== "/editor" && !url.pathname.startsWith("/editor/")) return false;
    const route = `${req.method} ${url.pathname}`;
    // The frame language is the game's: the cookie set by /sprache.
    const lang = langOfCookie(req.headers.cookie);
    const t = EDITOR_MESSAGES[lang].routes;
    if (route === "GET /editor") {
      const cards: WorkspaceCard[] = workspace.list().map((name) => {
        const check = checkCaseFolder(workspace.dirOf(name)!);
        return { name, title: workspace.title(name), ok: check.ok, errors: check.problems.filter((p) => p.severity === "error").length };
      });
      html(res, renderEditorHome(cards, sources(lang), workspace.root, take(""), lang));
      return true;
    }
    if (route === "POST /editor/open") {
      const form = new URLSearchParams((await readBody(req)) ?? "");
      const source = sources().find((s) => s.key === form.get("source"));
      if (source === undefined) return fail(res, 400, t.unknownSource), true;
      const name = workspace.open(source, form.get("reset") === "1");
      notices.set(name, { tone: "info", title: t.opened, lines: [t.sourceUnchanged(source.key)] });
      redirect(res, `/editor/${name}`);
      return true;
    }
    if (route === "POST /editor/generate") {
      const seed = Number(new URLSearchParams((await readBody(req)) ?? "").get("seed"));
      if (!Number.isSafeInteger(seed) || seed < 0 || seed > 999_999_999) return fail(res, 400, t.seedNumber), true;
      const name = workspace.generate(seed);
      notices.set(name, { tone: "info", title: t.generated, lines: [t.seed(seed)] });
      redirect(res, `/editor/${name}`);
      return true;
    }
    const m = /^\/editor\/([a-z0-9][a-z0-9-]{0,63})(\/(check|save|struct|undo|export))?$/.exec(url.pathname);
    const name = m?.[1] ?? "";
    const dir = m === null || !isCaseName(name) ? null : workspace.dirOf(name);
    if (m === null || dir === null) return fail(res, 404, t.noCopyNamed), true;
    switch (`${req.method} ${m[3] ?? ""}`) {
      case "GET export": {
        // The saved working copy as one share file; the game checks it again in full on import.
        const files = Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => [f, readFileSync(join(dir, f), "utf8")]));
        res.writeHead(200, { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${name}.kriminalfall.json"`, "cache-control": "no-store" }).end(exportCaseFiles(files));
        return true;
      }
      case "GET ": {
        const check = checkCaseFolder(dir);
        const { report, reason } = playtestFolder(dir, check, lang);
        html(res, renderEditor(name, dir, check, clockOriginOf(dir), take(name), { playtest: playtestPanel(report, reason, lang), canUndo: workspace.canUndo(name) }, lang));
        return true;
      }
      case "POST struct": {
        const op = structureOpFromForm(new URLSearchParams((await readBody(req)) ?? ""));
        const result = op === null ? { ok: false as const, message: t.incomplete } : workspace.structure(name, op, lang);
        if (result === null) return fail(res, 404, t.noCopy), true;
        const after = checkCaseFolder(dir);
        const errors = after.problems.filter((p) => p.severity === "error").length;
        notices.set(name, result.ok
          ? { tone: errors === 0 ? "ok" : "warn", title: result.message, lines: [errors === 0 ? t.validSolvable : t.openErrors(errors)] }
          : { tone: "warn", title: t.notChanged, lines: [result.message] });
        redirect(res, `/editor/${name}${result.ok ? "#aufbau" : ""}`);
        return true;
      }
      case "POST undo":
        notices.set(name, workspace.undo(name) ? { tone: "info", title: t.undone, lines: [] } : { tone: "warn", title: t.nothingToUndo, lines: [] });
        redirect(res, `/editor/${name}`);
        return true;
      case "POST check": {
        const body = await readBody(req);
        if (body === null) return fail(res, 413, t.tooLarge), true;
        const result = workspace.preview(name, editsFromForm(new URLSearchParams(body)), (copy, c) => playtestFolder(copy, c, lang), lang);
        if (result === null) return fail(res, 404, t.noCopy), true;
        const problems = [...result.apply.errors.map((e) => ({ ...e, severity: "error" as const })), ...result.check.problems];
        // The page script shows these beside the fields: worded like the panel.
        const shown = problems.map((p) => ({ ...p, message: problemText(p.message, lang) }));
        const check = { ...result.check, problems, ok: result.check.ok && result.apply.errors.length === 0 };
        res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }).end(
          JSON.stringify({ ok: check.ok, problems: shown, routes: check.routes.map((r) => ({ routeId: r.routeId, status: r.report.status })), html: checkPanel(check, lang), playtest: playtestPanel(result.inspected?.report ?? null, result.inspected?.reason ?? "", lang) }),
        );
        return true;
      }
      case "POST save": {
        const body = await readBody(req);
        if (body === null) return fail(res, 413, t.tooLarge), true;
        const result = workspace.save(name, editsFromForm(new URLSearchParams(body)), lang);
        if (result === null) return fail(res, 404, t.noCopy), true;
        const errors = result.check.problems.filter((p) => p.severity === "error").length + result.apply.errors.length;
        notices.set(name, {
          tone: errors === 0 ? "ok" : "warn",
          title: result.apply.applied === 0 ? t.nothingChanged : t.saved(result.apply.applied),
          lines: [errors === 0 ? t.validSolvable : t.savedWithErrors(errors), ...result.apply.errors.map((e) => `${e.file} › ${e.field === "(Datei)" ? EDITOR_MESSAGES[lang].check.fileField : e.field}: ${e.message}`)],
        });
        redirect(res, `/editor/${name}`);
        return true;
      }
      default:
        fail(res, 405, t.notAllowed);
        return true;
    }
  };
  return { routes, probeCase };
}
