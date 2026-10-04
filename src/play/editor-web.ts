import type { IncomingMessage, ServerResponse } from "node:http";
import { checkCaseFolder } from "../authoring/check-case.ts";
import { caseSources, clockOriginOf, CaseWorkspace, editsFromForm, isCaseName, type CaseSource } from "./editor.ts";
import { checkPanel, renderEditor, renderEditorHome, type WorkspaceCard } from "./editor-page.ts";
import type { Feedback } from "./web-page.ts";

// HTTP routes of the case editor inside play:web:
//   GET  /editor                 working copies, sources, generator
//   POST /editor/open            source=<key>[&reset=1]  copy a source into the working folder
//   POST /editor/generate        seed=<n>                generate a case into the working folder
//   GET  /editor/<name>          the editor
//   POST /editor/<name>/check    form -> JSON {ok, problems, routes, html}, nothing is written
//   POST /editor/<name>/save     form -> applied to the working copy, hashes recomputed

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

export function createEditorRoutes(options: EditorOptions) {
  const workspace = new CaseWorkspace(options.workspaceDir);
  const sources = () => options.sources ?? caseSources();
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

  /** Handles /editor and below; false for any other path. */
  return async (req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> => {
    if (url.pathname !== "/editor" && !url.pathname.startsWith("/editor/")) return false;
    const route = `${req.method} ${url.pathname}`;
    if (route === "GET /editor") {
      const cards: WorkspaceCard[] = workspace.list().map((name) => {
        const check = checkCaseFolder(workspace.dirOf(name)!);
        return { name, title: workspace.title(name), ok: check.ok, errors: check.problems.filter((p) => p.severity === "error").length };
      });
      html(res, renderEditorHome(cards, sources(), workspace.root, take("")));
      return true;
    }
    if (route === "POST /editor/open") {
      const form = new URLSearchParams((await readBody(req)) ?? "");
      const source = sources().find((s) => s.key === form.get("source"));
      if (source === undefined) return fail(res, 400, "Unbekannte Quelle."), true;
      const name = workspace.open(source, form.get("reset") === "1");
      notices.set(name, { tone: "info", title: "Arbeitskopie geöffnet", lines: [`Quelle ${source.key} bleibt unverändert.`] });
      redirect(res, `/editor/${name}`);
      return true;
    }
    if (route === "POST /editor/generate") {
      const seed = Number(new URLSearchParams((await readBody(req)) ?? "").get("seed"));
      if (!Number.isSafeInteger(seed) || seed < 0 || seed > 999_999_999) return fail(res, 400, "Seed muss eine Zahl sein."), true;
      const name = workspace.generate(seed);
      notices.set(name, { tone: "info", title: "Fall erzeugt", lines: [`Seed ${seed}.`] });
      redirect(res, `/editor/${name}`);
      return true;
    }
    const m = /^\/editor\/([a-z0-9][a-z0-9-]{0,63})(\/(check|save))?$/.exec(url.pathname);
    const name = m?.[1] ?? "";
    const dir = m === null || !isCaseName(name) ? null : workspace.dirOf(name);
    if (m === null || dir === null) return fail(res, 404, "Keine Arbeitskopie mit diesem Namen."), true;
    switch (`${req.method} ${m[3] ?? ""}`) {
      case "GET ":
        html(res, renderEditor(name, dir, checkCaseFolder(dir), clockOriginOf(dir), take(name)));
        return true;
      case "POST check": {
        const body = await readBody(req);
        if (body === null) return fail(res, 413, "Zu groß."), true;
        const result = workspace.preview(name, editsFromForm(new URLSearchParams(body)));
        if (result === null) return fail(res, 404, "Keine Arbeitskopie."), true;
        const problems = [...result.apply.errors.map((e) => ({ ...e, severity: "error" as const })), ...result.check.problems];
        const check = { ...result.check, problems, ok: result.check.ok && result.apply.errors.length === 0 };
        res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }).end(
          JSON.stringify({ ok: check.ok, problems, routes: check.routes.map((r) => ({ routeId: r.routeId, status: r.report.status })), html: checkPanel(check) }),
        );
        return true;
      }
      case "POST save": {
        const body = await readBody(req);
        if (body === null) return fail(res, 413, "Zu groß."), true;
        const result = workspace.save(name, editsFromForm(new URLSearchParams(body)));
        if (result === null) return fail(res, 404, "Keine Arbeitskopie."), true;
        const errors = result.check.problems.filter((p) => p.severity === "error").length + result.apply.errors.length;
        notices.set(name, {
          tone: errors === 0 ? "ok" : "warn",
          title: result.apply.applied === 0 ? "Nichts geändert" : `${result.apply.applied} Änderung${result.apply.applied === 1 ? "" : "en"} gespeichert`,
          lines: [errors === 0 ? "Der Fall ist gültig und lösbar." : `Gespeichert, aber ${errors} Fehler offen.`, ...result.apply.errors.map((e) => `${e.file} › ${e.field}: ${e.message}`)],
        });
        redirect(res, `/editor/${name}`);
        return true;
      }
      default:
        fail(res, 405, "Nicht erlaubt.");
        return true;
    }
  };
}
