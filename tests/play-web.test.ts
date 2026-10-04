import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decodeSessionSave } from "../src/domain/case-session-save.ts";
import { createWebApp } from "../src/play/web.ts";
import { loadVitrinePackage } from "../src/play/vitrine.ts";

// Browser front end over HTTP, played through the real server and session: Route A to the solution,
// save and load, stale pages, and no internal id or PlayerRef in any page served.

const pkg = loadVitrinePackage();
let server: Server;
let base: string;
const pages: string[] = [];

beforeAll(async () => {
  const app = createWebApp(pkg);
  server = createServer((req, res) => void app(req, res));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

async function page(): Promise<string> {
  const html = await (await fetch(`${base}/`)).text();
  pages.push(html);
  return html;
}

const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** Buttons of the current page: label -> form fields. */
function buttons(html: string): Map<string, Record<string, string>> {
  const out = new Map<string, Record<string, string>>();
  const formRe = /<form method="post" action="\/act"[^>]*>(.*?)<\/form>/g;
  for (const [, inner] of html.matchAll(formRe)) {
    const fields = Object.fromEntries([...inner!.matchAll(/name="(\w+)" value="([^"]*)"/g)].map(([, k, v]) => [k!, v!]));
    const label = unescape(/<button[^>]*>(.*?)<\/button>/.exec(inner!)![1]!);
    out.set(label, fields);
  }
  return out;
}

async function click(label: string): Promise<string> {
  const fields = buttons(await page()).get(label);
  if (fields === undefined) throw new Error(`No button "${label}"`);
  await fetch(`${base}/act`, { method: "POST", body: new URLSearchParams(fields), redirect: "manual" });
  return page();
}

const INTERNAL = /\b(case|person|location|item|event|evidence|proposition|conclusion|question|relationship|motive|secret|red-herring):[a-z0-9]/;

describe("play:web", () => {
  it("shows the case file, known entities and actions from PublicContent", async () => {
    const html = await page();
    expect(html).toContain("<title>Die leere Vitrine</title>");
    expect(html).toContain("Fallakte");
    for (const label of ["Lina Kern", "Max Brandt", "Nora Weiss", "Oskar Falk", "Innenhof"]) expect(html).toContain(label);
    expect([...buttons(html).keys()]).toContain("Ort durchsuchen: Innenhof");
    expect(html).not.toContain("Noras Kamera"); // not known yet
  });

  it("Route A through the browser forms reaches the solution", async () => {
    let html = await click("Ort durchsuchen: Innenhof");
    expect(html).toContain("Kontaktbogen");
    html = await click("Kann ich den vollständigen Film dieses Hoffototermins sehen?");
    html = await click("Gegenstand untersuchen: Noras Kamera");
    expect(html).toContain("Vollständiger Hoffilm");
    html = await click("Wo ist der unabhängige Archivnachweis?");
    html = await click("Gegenstand untersuchen: Archivterminal");
    expect(html).toContain("Archivaufnahme");
    html = await click("Lina Kern");
    expect(html).toContain("Fall gelöst");
    expect(html).toContain('class="badge solved"');
    expect([...buttons(html).keys()]).toEqual([]);
  });

  it("save downloads the Session C text, load restores it, a broken file is refused", async () => {
    const res = await fetch(`${base}/save`);
    expect(res.headers.get("content-disposition")).toContain("vitrine.save.json");
    const text = await res.text();
    const decoded = decodeSessionSave(pkg, text);
    expect(decoded.ok && decoded.state.phase).toBe("solved");

    await fetch(`${base}/new`, { method: "POST", redirect: "manual" });
    expect(await page()).toContain("0 Aktionen");
    await fetch(`${base}/load`, { method: "POST", body: text, redirect: "manual" });
    expect(await page()).toContain("Spielstand geladen: 6 Aktionen.");

    await fetch(`${base}/load`, { method: "POST", body: `${text} `, redirect: "manual" });
    expect(await page()).toContain("Der Spielstand kann nicht geladen werden.");
  });

  it("a stale page cannot trigger a different action", async () => {
    await fetch(`${base}/new`, { method: "POST", redirect: "manual" });
    const old = buttons(await page()).get("Ort durchsuchen: Innenhof")!;
    await click("Ort durchsuchen: Galerie");
    await fetch(`${base}/act`, { method: "POST", body: new URLSearchParams(old), redirect: "manual" });
    const html = await page();
    expect(html).toContain("Die Seite war nicht mehr aktuell.");
    expect(html).not.toContain("Kontaktbogen");
  });

  it("garbage form input changes nothing; unknown paths are 404", async () => {
    const before = await page();
    const at = buttons(before).values().next().value!.at!;
    for (const body of ["group=x&n=1", "group=u&n=0", "group=u&n=99999", "group=u&n=1e3", ""]) {
      await fetch(`${base}/act`, { method: "POST", body: `${body}&at=${at}`, redirect: "manual" });
    }
    expect(buttons(await page()).values().next().value!.at).toBe(at);
    expect((await fetch(`${base}/nothing`)).status).toBe(404);
  });

  it("no page ever contains an internal id or a PlayerRef", () => {
    expect(pages.length).toBeGreaterThan(10);
    for (const html of pages) {
      expect(html).not.toMatch(INTERNAL);
      expect(html).not.toMatch(/pr1_[0-9a-z]{16}/);
    }
  });
});
