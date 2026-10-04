import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { createServer, type Server } from "node:http";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWebApp } from "../src/play/web.ts";
import { buildStandalone } from "../src/play/standalone/build.ts";

// The best score per case lives only in the browser (localStorage), so it is checked in a real
// one: the Lern-Fall is solved three times by clicking (with a hint, cleanly, with a wrong
// accusation) and after each run the case card on the reloaded start page must show the best
// result so far: saved on the first solve, replaced only by a better one. Same flow against the
// node server and the single-file build. Playwright and Chromium are the environment's global
// install (no dependency); without them the test is skipped.

type Loc = {
  click(): Promise<void>;
  press(key: string): Promise<void>;
  first(): Loc;
  count(): Promise<number>;
  textContent(): Promise<string | null>;
  getAttribute(name: string): Promise<string | null>;
  isVisible(): Promise<boolean>;
  waitFor(o?: { state?: string; timeout?: number }): Promise<void>;
  locator(sel: string): Loc;
};
type Root = { locator(sel: string): Loc; getByRole(role: string, o: { name: string | RegExp; exact?: boolean }): Loc };
type Page = Root & {
  goto(url: string): Promise<unknown>;
  reload(): Promise<unknown>;
  frameLocator(sel: string): Root;
  evaluate<T>(fn: string): Promise<T>;
  addInitScript(script: string): Promise<void>;
  on(event: "pageerror", fn: (e: Error) => void): void;
};
type Browser = { newPage(): Promise<Page>; close(): Promise<void> };
type Playwright = { chromium: { launch(o: { executablePath?: string }): Promise<Browser> } };

function findPlaywright(): Playwright | null {
  try {
    const root = execSync("npm root -g", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return createRequire(join(root, "noop.js"))("playwright") as Playwright;
  } catch {
    return null;
  }
}

const playwright = findPlaywright();
const CHROMIUM = "/opt/pw-browsers/chromium";
const KEY = "kriminalfaelle.best.lernfall";

type Best = { points: number; stars: number; rank: string };

describe.skipIf(playwright === null)("best score in the browser", () => {
  let browser: Browser;
  let server: Server;
  let serverUrl: string;
  let fileUrl: string;

  beforeAll(async () => {
    browser = await playwright!.chromium.launch(existsSync(CHROMIUM) ? { executablePath: CHROMIUM } : {});
    server = createServer(createWebApp());
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    serverUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const dir = mkdtempSync(join(tmpdir(), "kf-best-"));
    writeFileSync(join(dir, "kriminalfaelle.html"), await buildStandalone());
    fileUrl = `file://${join(dir, "kriminalfaelle.html")}`;
  }, 180_000);

  afterAll(async () => {
    await browser?.close();
    await new Promise((done) => server?.close(done));
  });

  /** One case page action: clicks and waits for the next page (its form token changes). */
  async function act(ui: Root, button: Loc): Promise<void> {
    const token = ui.locator('input[name="at"]').first();
    const before = await token.getAttribute("value");
    await button.click();
    for (let i = 0; i < 200; i++) {
      const now = await token.getAttribute("value").catch(() => null);
      if (now !== null && now !== before) return;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error("page did not advance");
  }

  async function accuse(ui: Root, name: string): Promise<void> {
    // Like a player: close the open result sheet first (it can cover the suspect buttons).
    const sheet = ui.locator("#notice");
    if (await sheet.isVisible()) {
      await sheet.press("Escape");
      await sheet.waitFor({ state: "hidden" });
    }
    await ui.getByRole("button", { name, exact: true }).click();
    await ui.locator("#confirm-ok").click();
  }

  /** Solves the Lern-Fall from a fresh game; returns the points the closing page shows. */
  async function solve(ui: Root, extra: "hint" | "clean" | "wrong"): Promise<{ points: number; note: string }> {
    if (extra === "hint") await act(ui, ui.getByRole("button", { name: /Hinweis holen/ }));
    await act(ui, ui.getByRole("button", { name: "Ort durchsuchen: Vereinsheim" }));
    await act(ui, ui.getByRole("button", { name: "Ort durchsuchen: Sportplatz" }));
    await act(ui, ui.getByRole("button", { name: "Waren Sie um 17:00 im Vereinsheim?" }));
    await act(ui, ui.locator("#vorhalten button").first());
    if (extra === "wrong") {
      const token = await ui.locator('input[name="at"]').first().getAttribute("value");
      await accuse(ui, "Kurt");
      await expect.poll(() => ui.locator('input[name="at"]').first().getAttribute("value").catch(() => token)).not.toBe(token);
    }
    await accuse(ui, "Jonas");
    const score = ui.locator(".closing .score[data-score]");
    await score.waitFor({ timeout: 10_000 });
    const note = ui.locator(".closing .best-note");
    return { points: Number(await score.getAttribute("data-score")), note: (await note.isVisible()) ? ((await note.textContent()) ?? "") : "" };
  }

  async function newGame(ui: Root): Promise<void> {
    await ui.getByRole("button", { name: "Neu beginnen" }).click();
    await ui.locator("#confirm-ok").click();
    await ui.getByRole("button", { name: "Ort durchsuchen: Vereinsheim" }).waitFor({ timeout: 10_000 });
  }

  const targets = [
    ["server", () => serverUrl, (page: Page): Root => page],
    ["single file", () => fileUrl, (page: Page): Root => page.frameLocator("#kf")],
  ] as const;

  for (const [name, url, rootOf] of targets) {
    it(`is saved, shown on the case card after reload and only replaced by a better run (${name})`, async () => {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(`try { localStorage.setItem("kriminalfaelle.intro", "gesehen"); } catch {}`);
      await page.goto(url());
      const ui = rootOf(page);
      const stored = () => page.evaluate<Best | null>(`JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}) || "null")`);
      const card = ui.locator('[data-best="lernfall"]');
      /** Reloads the start page and returns the best-score line of the Lern-Fall card. */
      const cardText = async () => {
        await page.goto(url());
        await page.reload();
        await ui.locator(".case-card").first().waitFor();
        await card.waitFor({ state: "attached" });
        return (await card.isVisible()) ? await card.textContent() : null;
      };

      expect(await cardText()).toBeNull();
      expect(await stored()).toBeNull();

      // First solve (with a hint): saved and shown.
      await ui.getByRole("link", { name: /Die Vereinskasse/ }).first().click();
      const first = await solve(ui, "hint");
      expect(first.points).toBeLessThan(100);
      expect(first.note).toBe("");
      expect((await stored())?.points).toBe(first.points);
      expect(await cardText()).toContain(`Bestwert: ${first.points} Punkte`);

      // Clean solve: better, replaces it.
      await ui.getByRole("link", { name: /Die Vereinskasse/ }).first().click();
      await newGame(ui);
      const best = await solve(ui, "clean");
      expect(best.points).toBeGreaterThan(first.points);
      expect(best.note).toContain("neuer Bestwert!");
      const saved = await stored();
      expect(saved?.points).toBe(best.points);
      expect(await cardText()).toBe(`Bestwert: ${best.points} Punkte · ${"★".repeat(saved!.stars)}${"☆".repeat(3 - saved!.stars)} ${saved!.rank}`);

      // Wrong accusation first: worse, the best stays.
      await ui.getByRole("link", { name: /Die Vereinskasse/ }).first().click();
      await newGame(ui);
      const worse = await solve(ui, "wrong");
      expect(worse.points).toBeLessThan(best.points);
      expect(worse.note).toContain(`Bestwert: ${best.points} Punkte`);
      expect(await stored()).toEqual(saved);
      expect(await cardText()).toContain(`Bestwert: ${best.points} Punkte`);

      expect(errors).toEqual([]);
      await page.evaluate("localStorage.clear()");
      await (page as unknown as { close(): Promise<void> }).close();
    }, 120_000);
  }
});
