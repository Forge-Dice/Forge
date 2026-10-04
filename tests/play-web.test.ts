import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decodeSessionSave } from "../src/domain/case-session-save.ts";
import { createWebApp } from "../src/play/web.ts";
import { loadPlayPackage } from "../src/play/cases.ts";

// Browser front end over HTTP, played through the real server and session: case selection, Route A
// to the solution and its closing, both cases, save and load, stale pages, and no internal id or
// PlayerRef in any page served.

const pkg = loadPlayPackage("vitrine");
const V = "/fall/vitrine";
let server: Server;
let base: string;
const pages: string[] = [];

beforeAll(async () => {
  const app = createWebApp({ vitrine: pkg });
  server = createServer((req, res) => void app(req, res));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

async function page(path = V): Promise<string> {
  const html = await (await fetch(`${base}${path}`)).text();
  pages.push(html);
  return html;
}

const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** Buttons of the current page: label -> form fields. */
function buttons(html: string): Map<string, Record<string, string>> {
  const out = new Map<string, Record<string, string>>();
  const formRe = /<form method="post" action="\/fall\/[a-z]+\/act"[^>]*>(.*?)<\/form>/g;
  for (const [, inner] of html.matchAll(formRe)) {
    const fields = Object.fromEntries([...inner!.matchAll(/name="(\w+)" value="([^"]*)"/g)].map(([, k, v]) => [k!, v!]));
    const label = unescape(/<button[^>]*>(.*?)<\/button>/.exec(inner!)![1]!.replace(/<[^>]+>/g, ""));
    out.set(label, fields);
  }
  return out;
}

async function click(label: string, path = V): Promise<string> {
  const fields = buttons(await page(path)).get(label);
  if (fields === undefined) throw new Error(`No button "${label}"`);
  await fetch(`${base}${path}/act`, { method: "POST", body: new URLSearchParams(fields), redirect: "manual" });
  return page(path);
}

const INTERNAL = /\b(case|person|location|item|event|evidence|proposition|conclusion|question|relationship|motive|secret|red-herring):[a-z0-9]/;

describe("play:web", () => {
  it("the start page offers every case", async () => {
    const html = await page("/");
    expect(html).toContain('href="/fall/vitrine"');
    expect(html).toContain('href="/fall/brieffoeffner"');
    expect(html).toContain("Die leere Vitrine");
    expect(html).toContain("Der Brieföffner");
    expect(html).toContain('href="/fall/geige"');
    expect(html).toContain("Die verstummte Geige");
  });

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
    html = await click("Lief Ihre Kamera beim Fototermin im Hof die ganze Zeit?");
    html = await click("Gegenstand untersuchen: Noras Kamera");
    expect(html).toContain("Vollständiger Hoffilm");
    html = await click("Zeichnet im Archiv ein Gerät auf, wer dort arbeitet?");
    html = await click("Gegenstand untersuchen: Archivterminal");
    expect(html).toContain("Archivaufnahme");
    html = await click("Max Brandt");
    expect(html).toContain("Diese Anklage löst den Fall nicht.");
    html = await click("Lina Kern");
    expect(html).toContain('<section class="closing"><h2>Fall gelöst</h2>');
    expect(html).toContain("Lina Kern war es.");
    expect(html).toContain("7 Aktionen gebraucht und 2 Anklagen erhoben");
    expect(html).toContain('class="badge solved"');
    expect([...buttons(html).keys()]).toEqual([]);
  });

  it("save downloads the Session C text, load restores it, a broken file is refused", async () => {
    const res = await fetch(`${base}${V}/save`);
    expect(res.headers.get("content-disposition")).toContain("vitrine.save.json");
    const text = await res.text();
    const decoded = decodeSessionSave(pkg, text);
    expect(decoded.ok && decoded.state.phase).toBe("solved");

    await fetch(`${base}${V}/new`, { method: "POST", redirect: "manual" });
    expect(await page()).toContain("0 Aktionen");
    await fetch(`${base}${V}/load`, { method: "POST", body: text, redirect: "manual" });
    expect(await page()).toContain("7 Aktionen wiederhergestellt.");

    await fetch(`${base}${V}/load`, { method: "POST", body: `${text} `, redirect: "manual" });
    expect(await page()).toContain("Der Spielstand kann nicht geladen werden.");
  });

  it("a stale page cannot trigger a different action", async () => {
    await fetch(`${base}${V}/new`, { method: "POST", redirect: "manual" });
    const old = buttons(await page()).get("Ort durchsuchen: Innenhof")!;
    await click("Ort durchsuchen: Galerie");
    await fetch(`${base}${V}/act`, { method: "POST", body: new URLSearchParams(old), redirect: "manual" });
    const html = await page();
    expect(html).toContain("Die Seite war nicht mehr aktuell.");
    expect(html).not.toContain("Kontaktbogen");
  });

  it("marks done actions, newly opened leads and the result sheet", async () => {
    await fetch(`${base}${V}/new`, { method: "POST", redirect: "manual" });
    const html = await click("Ort durchsuchen: Innenhof");
    expect(html).toMatch(/<section id="notice" class="notice info" role="status"/);
    expect(html).toMatch(/<button type="submit" class="act done"><span class="visually-hidden">Ort durchsuchen: <\/span><span>Innenhof<\/span><\/button>/);
    expect(html).toContain('class="q fresh">Lief Ihre Kamera beim Fototermin im Hof die ganze Zeit?</button>');
    expect(html).toContain("Eine neue Spur ist offen.");
    expect(await page()).not.toContain('id="notice"'); // shown once
  });

  it("garbage form input changes nothing; unknown paths are 404", async () => {
    const before = await page();
    const at = buttons(before).values().next().value!.at!;
    for (const body of ["group=x&n=1", "group=u&n=0", "group=u&n=99999", "group=u&n=1e3", ""]) {
      await fetch(`${base}${V}/act`, { method: "POST", body: `${body}&at=${at}`, redirect: "manual" });
    }
    expect(buttons(await page()).values().next().value!.at).toBe(at);
    expect((await fetch(`${base}/nothing`)).status).toBe(404);
  });

  it("Der Brieföffner is playable in its own slot next to the Vitrine", async () => {
    const vitrineBefore = await page();
    const html = await click("Ben", "/fall/brieffoeffner");
    expect(html).toContain("Ben war es.");
    expect(await page()).toBe(vitrineBefore);
    expect(await page("/")).toContain("Gelöst");
    expect((await fetch(`${base}/fall/nope`)).status).toBe(404);
  });

  it("the case page carries the skippable introduction; the manual is served in the same look", async () => {
    const html = await page();
    expect(html).toContain('<dialog id="intro"');
    expect(html).toContain("Überspringen");
    expect(html).toContain('href="/hilfe"');
    const help = await page("/hilfe");
    expect(help).toContain("<title>Hilfe</title>");
    expect(help).toContain("So ermittelst du");
    expect(help).toContain("Erhebe Anklage");
  });

  it("no page ever contains an internal id or a PlayerRef", () => {
    expect(pages.length).toBeGreaterThan(10);
    for (const html of pages) {
      expect(html).not.toMatch(INTERNAL);
      expect(html).not.toMatch(/pr1_[0-9a-z]{16}/);
    }
  });
});
