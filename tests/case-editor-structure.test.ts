import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { checkCaseFolder } from "../src/authoring/check-case.ts";
import { caseSources, CaseWorkspace } from "../src/play/editor.ts";
import { slugify } from "../src/play/editor-structure.ts";
import { structureOpFromForm } from "../src/play/editor-web.ts";
import { createWebServerApp } from "../src/play/web-server.ts";

// Structural editing (add/remove persons, places, clues, questions, routes), the playtest sidebar
// and "Probespielen" of the working copy at /fall/probe-<name>.

const FIXTURES = new URL("./fixtures/", import.meta.url).pathname;
const scratch = mkdtempSync(join(tmpdir(), "case-editor-structure-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
const digest = (dir: string) =>
  createHash("sha256")
    .update(
      (readdirSync(dir, { recursive: true }) as string[])
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map((f) => f + readFileSync(join(dir, f), "utf8"))
        .join("\0"),
    )
    .digest("hex");
const fixtureDigests = Object.fromEntries(readdirSync(FIXTURES).map((d) => [d, digest(join(FIXTURES, d))]));
const geige = caseSources().find((s) => s.key === "fixtures/geige")!;
const json = (dir: string, file: string) => JSON.parse(readFileSync(join(dir, file), "utf8"));
const routes = (dir: string) => (json(dir, "release-manifest.json").certificateData.routes ?? []) as { routeId: string; stepIds: string[] }[];

describe("structure operations", () => {
  it("slugify turns German names into id slugs", () => {
    expect(slugify("Fräulein Öhm-Weiß")).toBe("fraeulein-oehm-weiss");
    expect(slugify("  Der Große Saal! ")).toBe("der-grosse-saal");
  });

  it("adds an interrogable person, a question, a place, a clue, a step and a route; the case stays valid", () => {
    const ws = new CaseWorkspace(join(scratch, "build"));
    const name = ws.open(geige);
    const dir = ws.dirOf(name)!;
    const lotte = ws.structure(name, { op: "add-entity", kind: "person", name: "Lotte Brünn", role: "Souffleuse", known: true, npc: true })!;
    expect(lotte).toMatchObject({ ok: true, id: "person:lotte-bruenn" });
    expect(existsSync(join(dir, "npc-lotte-bruenn.json"))).toBe(true);
    expect(existsSync(join(dir, "interrogation-lotte-bruenn.json"))).toBe(true);
    // A second "Lotte Brünn" gets a fresh id.
    expect(ws.structure(name, { op: "add-entity", kind: "person", name: "Lotte Brünn", known: false })).toMatchObject({ ok: true, id: "person:lotte-bruenn-2" });
    expect(ws.structure(name, { op: "add-entity", kind: "location", name: "Probebühne", known: true })).toMatchObject({ ok: true, id: "location:probebuehne" });
    const q = ws.structure(name, { op: "add-question", npc: "person:lotte-bruenn", about: ["location:garderobe"], text: "Wo waren Sie in der Pause?" })!;
    expect(q.ok && q.id).toMatch(/^question:q\d+$/);
    expect(ws.structure(name, { op: "add-clue", name: "Notenblatt", text: "Ein zerknittertes Notenblatt.", at: "location:probebuehne", supports: "proposition:ida-garderobe" })).toMatchObject({ ok: true, id: "evidence:notenblatt" });
    expect(ws.structure(name, { op: "add-step", action: "search_location", target: "location:probebuehne" })).toMatchObject({ ok: true, id: "search-probebuehne" });
    const route = ws.structure(name, { op: "add-route", stepIds: ["search-keller", "read-schaltschrank", "search-loge", "search-foyer", "search-probebuehne"] })!;
    expect(route.ok).toBe(true);
    const check = checkCaseFolder(dir);
    expect(check.problems.filter((p) => p.severity === "error")).toEqual([]);
    expect(check.ok).toBe(true);
    expect(routes(dir).map((r) => r.routeId)).toContain(route.ok ? route.id : "");
  });

  it("unknown references and empty names are refused without writing", () => {
    const ws = new CaseWorkspace(join(scratch, "refuse"));
    const name = ws.open(geige);
    const before = digest(ws.dirOf(name)!);
    expect(ws.structure(name, { op: "add-entity", kind: "person", name: "  ", known: false })!.ok).toBe(false);
    expect(ws.structure(name, { op: "add-clue", name: "X", text: "x", at: "location:mond", supports: "proposition:ida-garderobe" })!.ok).toBe(false);
    expect(ws.structure(name, { op: "add-route", stepIds: ["gibt-es-nicht"] })!.ok).toBe(false);
    expect(digest(ws.dirOf(name)!)).toBe(before);
  });

  it("removing a person cascades through files and routes; undo restores the previous state", () => {
    const ws = new CaseWorkspace(join(scratch, "remove"));
    const name = ws.open(geige);
    const dir = ws.dirOf(name)!;
    ws.structure(name, { op: "add-entity", kind: "person", name: "Lotte", known: true, npc: true });
    ws.structure(name, { op: "add-question", npc: "person:lotte", about: ["location:foyer"], text: "Waren Sie im Foyer?" });
    const withLotte = digest(dir);
    expect(ws.canUndo(name)).toBe(true);
    expect(ws.structure(name, { op: "remove", id: "person:lotte" })!.ok).toBe(true);
    expect(existsSync(join(dir, "npc-lotte.json"))).toBe(false);
    expect(readdirSync(dir).filter((f) => f.endsWith(".json")).some((f) => readFileSync(join(dir, f), "utf8").includes("person:lotte"))).toBe(false);
    expect(checkCaseFolder(dir).ok).toBe(true);
    expect(ws.undo(name)).toBe(true);
    expect(digest(dir)).toBe(withLotte);
    expect(ws.undo(name)).toBe(false);
  });

  it("removing the only extra route leaves the witness route", () => {
    const ws = new CaseWorkspace(join(scratch, "routes"));
    const name = ws.open(geige);
    const dir = ws.dirOf(name)!;
    expect(ws.structure(name, { op: "remove-route", routeId: "kellerplan" })!.ok).toBe(true);
    expect(routes(dir).map((r) => r.routeId)).not.toContain("kellerplan");
    expect(checkCaseFolder(dir).routes.length).toBeGreaterThan(0);
  });

  it("form fields map to operations; incomplete forms are refused", () => {
    expect(structureOpFromForm(new URLSearchParams({ op: "add-entity", kind: "person", name: "Anna", npc: "1", known: "1" }))).toEqual({ op: "add-entity", kind: "person", name: "Anna", role: "", known: true, npc: true });
    expect(structureOpFromForm(new URLSearchParams({ op: "add-entity", kind: "location", name: "Hof", npc: "1" }))).toMatchObject({ npc: false });
    expect(structureOpFromForm(new URLSearchParams({ op: "add-route", steps: "a, b  c" }))).toEqual({ op: "add-route", stepIds: ["a", "b", "c"] });
    expect(structureOpFromForm(new URLSearchParams({ op: "add-entity", kind: "planet", name: "x" }))).toBeNull();
    expect(structureOpFromForm(new URLSearchParams({ op: "rm -rf" }))).toBeNull();
  });
});

describe("structure, playtest and probe over HTTP", () => {
  let server: Server;
  let base: string;
  const workspaceDir = join(scratch, "http");
  beforeAll(async () => {
    const app = createWebServerApp({}, { workspaceDir });
    server = createServer((req, res) => void app(req, res));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const post = (path: string, body: Record<string, string>) => fetch(`${base}${path}`, { method: "POST", body: new URLSearchParams(body), redirect: "manual" });
  // Opening is idempotent: every test has the working copy, whatever ran before it.
  beforeEach(() => post("/editor/open", { source: "fixtures/geige" }));

  it("the editor page shows the structure section, the playtest sidebar and the probe link", async () => {
    await post("/editor/open", { source: "fixtures/geige" });
    const page = await (await fetch(`${base}/editor/geige`)).text();
    expect(page).toContain('id="aufbau"');
    expect(page).toContain("Spieltest");
    expect(page).toContain('href="/fall/probe-geige"');
  });

  it("adding a person through the form shows up and can be undone", async () => {
    const res = await post("/editor/geige/struct", { op: "add-entity", kind: "person", name: "Lotte Brünn", known: "1", npc: "1" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/editor/geige#aufbau");
    expect(await (await fetch(`${base}/editor/geige`)).text()).toContain("Lotte Brünn");
    expect((await post("/editor/geige/undo", {})).status).toBe(303);
    expect(json(join(workspaceDir, "geige"), "public-content.json").labels.some((l: { entity: string }) => l.entity === "person:lotte-bruenn")).toBe(false);
  });

  it("check returns the playtest panel for the unsaved edits", async () => {
    const data = (await (await post("/editor/geige/check", {})).json()) as { ok: boolean; playtest: string };
    expect(data.ok).toBe(true);
    expect(data.playtest).toMatch(/●/);
  });

  it("Probespielen serves the saved working copy; an invalid copy is not playable", async () => {
    await post("/editor/geige/save", { "f:public-content.json:title": "Die Probegeige" });
    const game = await fetch(`${base}/fall/probe-geige`);
    expect(game.status).toBe(200);
    expect(await game.text()).toContain("Die Probegeige");
    const text = json(join(workspaceDir, "geige"), "evidence-presentation.json").entries[0].text as string;
    await post("/editor/geige/save", { "f:evidence-presentation.json:entries[0].text": "Foto mit person:paul" });
    expect((await fetch(`${base}/fall/probe-geige`)).status).toBe(404);
    // Leaves the copy valid for the tests that follow, in any order.
    await post("/editor/geige/save", { "f:evidence-presentation.json:entries[0].text": text });
    expect((await fetch(`${base}/fall/probe-geige`)).status).toBe(200);
    expect((await fetch(`${base}/fall/probe-nicht-da`)).status).toBe(404);
  });

  it("the repository's fixtures are untouched", () => {
    for (const d of readdirSync(FIXTURES)) expect(digest(join(FIXTURES, d)), d).toBe(fixtureDigests[d]);
  });
});
