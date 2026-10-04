import { beforeAll, describe, expect, it, vi } from "vitest";
import { buildStandalone } from "../src/play/standalone/build.ts";
import { createWebHandler, type WebHandler, type WebResponse } from "../src/play/web.ts";
import { PLAY_CASES } from "../src/play/cases.ts";
import { exportCaseFiles } from "../src/play/case-share.ts";
import { readdirSync, readFileSync } from "node:fs";

// The single-file browser build runs the same game as the server: the bundled handler (with its
// embedded fixtures and browser SHA-256) is driven side by side with the node handler, and every
// response, save files included, must be identical.

let html: string;
let scripts: string[];
let bundled: WebHandler;

beforeAll(async () => {
  html = await buildStandalone();
  scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
  expect(scripts).toHaveLength(3);
  // Files and bundle only (the page shell needs a DOM and is exercised in the browser), in this
  // realm: zod's plain-object checks would reject values crossing a vm context boundary.
  (0, eval)(`${scripts[0]}\n${scripts[1]}`);
  const g = globalThis as { kriminalfaelle?: { handle: WebHandler } };
  bundled = g.kriminalfaelle!.handle;
  delete g.kriminalfaelle; // the embedded files stay: cases load on first use
}, 120_000);

const body = (text: string | undefined) => async () => text ?? null;

/** Act forms of a page, in page order: their form fields. */
function forms(page: string): string[] {
  return [...page.matchAll(/<form method="post" action="\/fall\/[a-z]+\/act"[^>]*>(.*?)<\/form>/g)].map(([, inner]) =>
    new URLSearchParams([...inner!.matchAll(/name="(\w+)" value="([^"]*)"/g)].map(([, k, v]) => [k!, v!] as [string, string])).toString(),
  );
}

describe("standalone browser build", () => {
  it("is one self-contained HTML file", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href=/);
    expect(html).toContain('<iframe id="kf"');
  });

  it("plays every case exactly like the server, saves included", async () => {
    const server = createWebHandler();
    const both = async (method: string, url: string, text?: string): Promise<WebResponse> => {
      const [a, b] = await Promise.all([server(method, url, body(text)), bundled(method, url, body(text))]);
      expect(b).toEqual(a);
      return a;
    };
    expect((await both("GET", "/")).status).toBe(200);
    expect((await both("GET", "/hilfe")).status).toBe(200);
    for (const c of Object.values(PLAY_CASES)) {
      const home = `/fall/${c.dir}`;
      let page = (await both("GET", home)).body;
      // A fixed walk through the menus: every step takes another offered action.
      for (let step = 0; step < 14 && forms(page).length > 0; step++) {
        const offered = forms(page);
        expect((await both("POST", `${home}/act`, offered[(step * 7 + 3) % offered.length])).status).toBe(303);
        page = (await both("GET", home)).body;
      }
      const save = await both("GET", `${home}/save`);
      expect(save.status).toBe(200);
      await both("POST", `${home}/new`);
      await both("POST", `${home}/load`, save.body);
      expect((await both("GET", home)).body).toContain("Spielstand geladen");
    }
    expect((await both("GET", "/")).body).toContain("Aktionen");
  }, 120_000);

  it("plays a Zufallsfall like the server and restores it from its save", async () => {
    const server = createWebHandler();
    const both = async (method: string, url: string, text?: string): Promise<WebResponse> => {
      const [a, b] = await Promise.all([server(method, url, body(text)), bundled(method, url, body(text))]);
      expect(b).toEqual(a);
      return a;
    };
    expect((await both("POST", "/zufall", "seed=42")).headers.location).toBe("/fall/zufall-42");
    await both("POST", "/fall/zufall-42/act", "group=u&n=1&at=0");
    const save = await both("GET", "/fall/zufall-42/save");
    expect(save.status).toBe(200);
    // A fresh handler (as after a page reload) gets the case back from the save under its slug.
    const reloaded = createWebHandler();
    expect((await reloaded("POST", "/fall/zufall-42/load", body(save.body))).status).toBe(303);
    expect((await reloaded("GET", "/fall/zufall-42", body(undefined))).body).toContain("Spielstand geladen");
  }, 60_000);

  it("solves Die leere Vitrine in the bundle", async () => {
    const V = "/fall/vitrine";
    await bundled("POST", `${V}/new`, body(undefined));
    const labels = ["Ort durchsuchen: Innenhof", "Lief Ihre Kamera beim Fototermin im Hof die ganze Zeit?", "Gegenstand untersuchen: Noras Kamera", "Zeichnet im Archiv ein Gerät auf, wer dort arbeitet?", "Gegenstand untersuchen: Archivterminal", "Lina Kern"];
    for (const label of labels) {
      const page = (await bundled("GET", V, body(undefined))).body;
      const form = [...page.matchAll(/<form method="post" action="\/fall\/[a-z]+\/act"[^>]*>(.*?)<\/form>/g)].find(([, inner]) =>
        /<button[^>]*>(.*?)<\/button>/.exec(inner!)![1]!.replace(/<[^>]+>/g, "") === label,
      )!;
      const fields = new URLSearchParams([...form[1]!.matchAll(/name="(\w+)" value="([^"]*)"/g)].map(([, k, v]) => [k!, v!] as [string, string])).toString();
      await bundled("POST", `${V}/act`, body(fields));
    }
    const end = (await bundled("GET", V, body(undefined))).body;
    expect(end, /<section id="notice"[\s\S]*?<\/section>/.exec(end)?.[0]).toContain("Lina Kern war es.");
  });

  it("loads an exported case file exactly like the server and refuses a tampered one", async () => {
    const dir = new URL("./fixtures/geige/", import.meta.url).pathname;
    const share = exportCaseFiles(Object.fromEntries(readdirSync(dir).map((f) => [f, readFileSync(dir + f, "utf8")])));
    const server = createWebHandler();
    const [a, b] = await Promise.all([server("POST", "/eigener-fall", body(share)), bundled("POST", "/eigener-fall", body(share))]);
    expect(b).toEqual(a);
    expect(a.status).toBe(200);
    const slug = (JSON.parse(a.body) as { slug: string }).slug;
    const [pa, pb] = await Promise.all([server("GET", `/fall/${slug}`, body(undefined)), bundled("GET", `/fall/${slug}`, body(undefined))]);
    expect(pb).toEqual(pa);
    expect(pa.body).toContain("Die verstummte Geige");
    const tampered = JSON.parse(share) as { files: Record<string, string> };
    tampered.files["public-content.json"] = tampered.files["public-content.json"]!.replace("Die verstummte Geige", "Die laute Geige");
    const bad = await bundled("POST", "/eigener-fall", body(JSON.stringify(tampered)));
    expect(bad.status).toBe(422);
    expect(JSON.parse(bad.body)).toMatchObject({ ok: false, title: "Die Fall-Datei wurde verändert." });
  });

  it("refuses the import attacks in the bundle as the server does", async () => {
    const dir = new URL("./fixtures/geige/", import.meta.url).pathname;
    const files = Object.fromEntries(readdirSync(dir).map((f) => [f, readFileSync(dir + f, "utf8")]));
    const deep = files["release-manifest.json"]!.replace(/\}\s*$/, `,"x":${"[".repeat(100_000)}${"]".repeat(100_000)}}`);
    const server = createWebHandler();
    for (const text of [exportCaseFiles({ ...files, "release-manifest.json": deep }), exportCaseFiles({ ...files, "zz.json": "{}" }), "x".repeat(2 * 1024 * 1024)]) {
      const [a, b] = await Promise.all([server("POST", "/eigener-fall", body(text)), bundled("POST", "/eigener-fall", body(text))]);
      expect(b).toEqual(a);
      expect(a.status).toBe(422);
    }
  });
});

type ShellApp = { handle: WebHandler; slugs: string[] };
type Shell = { app: ShellApp; frame: { srcdoc: string }; boot: { textContent: string }; kfFetch: (url: string, opts: { method?: string; body?: string }) => Promise<{ status: number }>; kfGo: (method: string, url: string, body?: string) => void };

/**
 * Boots the page shell (shell.js) on a fresh bundle, as when the file is opened, over a minimal
 * stand-in for the DOM: `storage` plays localStorage and survives across boots like the browser's.
 */
async function bootShell(storage: Map<string, string>, hash = ""): Promise<Shell> {
  const g = globalThis as { kriminalfaelle?: ShellApp };
  (0, eval)(scripts[1]!);
  const app = g.kriminalfaelle!;
  delete g.kriminalfaelle;
  const element = () => ({ hidden: true, textContent: "", srcdoc: "", addEventListener() {}, click() {}, remove() {} });
  const frame = element();
  const boot = element();
  const window: Record<string, unknown> = {};
  const location = { hash };
  const document = { title: "", body: { append() {} }, getElementById: (id: string) => (id === "kf" ? frame : boot), createElement: element };
  const localStorage = {
    get length() { return storage.size; },
    key: (i: number) => [...storage.keys()][i] ?? null,
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, String(v)),
    removeItem: (k: string) => void storage.delete(k),
  };
  const history = { replaceState: (_s: unknown, _t: string, h: string) => void (location.hash = h) };
  const shell = new Function("globalThis", "window", "document", "localStorage", "history", "location", scripts[2]!);
  shell({ kriminalfaelle: app }, window, document, localStorage, history, location);
  await vi.waitFor(() => expect(frame.srcdoc).not.toBe(""), { timeout: 20_000 });
  return { app, frame, boot, kfFetch: window.kfFetch as Shell["kfFetch"], kfGo: window.kfGo as Shell["kfGo"] };
}

const KEY = "kriminalfaelle.spielstand.";
// A generated case's save is wrapped as {zufallsfall, spielstand}.
const events = (save: string | undefined): number => {
  const v = JSON.parse(save!) as { events?: unknown[]; spielstand?: string };
  return v.spielstand !== undefined ? events(v.spielstand) : v.events!.length;
};

describe("standalone page shell", () => {
  it("keeps every Zufallsfall save across a reload, beyond the server's 20 generated cases", async () => {
    const storage = new Map<string, string>();
    const first = await bootShell(storage);
    for (let seed = 1; seed <= 21; seed++) {
      expect((await first.kfFetch(`/fall/zufall-${seed}/act`, { method: "POST", body: "group=u&n=1&at=0" })).status).toBe(303);
      expect(events(storage.get(`${KEY}zufall-${seed}`))).toBe(1);
    }
    const second = await bootShell(storage);
    const inMemory = await second.app.handle("GET", "/fall/zufall-1/save", async () => null);
    expect(events(inMemory.body)).toBe(1);
    const page = (await second.app.handle("GET", "/fall/zufall-1", async () => null)).body;
    const at = /name="at" value="([^"]+)"/.exec(page)![1]!;
    await second.kfFetch("/fall/zufall-1/act", { method: "POST", body: `group=u&n=1&at=${at}` });
    expect(events(storage.get(`${KEY}zufall-1`))).toBe(2);
  }, 120_000);

  it("backs up a stored save that no longer loads and tells the player", async () => {
    const storage = new Map<string, string>();
    const first = await bootShell(storage);
    await first.kfFetch("/fall/vitrine/act", { method: "POST", body: "group=u&n=1&at=0" });
    // As after an update of the file: the stored save names another package.
    const stale = storage.get(`${KEY}vitrine`)!.replace(/"packageHash":"[0-9a-f]+"/, `"packageHash":"${"0".repeat(64)}"`);
    storage.set(`${KEY}vitrine`, stale);
    const second = await bootShell(storage);
    expect(storage.get(`${KEY}vitrine.alt`)).toBe(stale);
    second.kfGo("GET", "/fall/vitrine");
    await vi.waitFor(() => expect(second.frame.srcdoc).toContain("Der Spielstand kann nicht geladen werden."));
    await second.kfFetch("/fall/vitrine/act", { method: "POST", body: "group=u&n=1&at=0" });
    expect(storage.get(`${KEY}vitrine.alt`)).toBe(stale);
  }, 60_000);

  it("opens the case list when the start address is a download", async () => {
    const shell = await bootShell(new Map(), "#/fall/vitrine/save");
    expect(shell.frame.srcdoc).toContain('href="/fall/vitrine"');
  }, 60_000);
});
