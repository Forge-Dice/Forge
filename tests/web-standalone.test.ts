import { beforeAll, describe, expect, it } from "vitest";
import { buildStandalone } from "../src/play/standalone/build.ts";
import { createWebHandler, type WebHandler, type WebResponse } from "../src/play/web.ts";
import { PLAY_CASES } from "../src/play/cases.ts";

// The single-file browser build runs the same game as the server: the bundled handler (with its
// embedded fixtures and browser SHA-256) is driven side by side with the node handler, and every
// response, save files included, must be identical.

let html: string;
let bundled: WebHandler;

beforeAll(async () => {
  html = await buildStandalone();
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
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
    const labels = ["Ort durchsuchen: Innenhof", "Kann ich den vollständigen Film dieses Hoffototermins sehen?", "Gegenstand untersuchen: Noras Kamera", "Wo ist der unabhängige Archivnachweis?", "Gegenstand untersuchen: Archivterminal", "Lina Kern"];
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
});
