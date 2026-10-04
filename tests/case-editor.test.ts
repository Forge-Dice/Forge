import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkCaseFolder } from "../src/authoring/check-case.ts";
import { applyEdits, caseSources, CaseWorkspace, editsFromForm, getAt } from "../src/play/editor.ts";
import { createWebApp } from "../src/play/web.ts";

// Case editor (/editor in play:web): working copies only, live check-case on a scratch copy, save
// with automatic hash maintenance, and the repository's fixtures are never written.

const FIXTURES = new URL("./fixtures/", import.meta.url).pathname;
const scratch = mkdtempSync(join(tmpdir(), "case-editor-test-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const digest = (dir: string) =>
  createHash("sha256")
    .update(readdirSync(dir).sort().map((f) => f + readFileSync(join(dir, f), "utf8")).join("\0"))
    .digest("hex");
const fixtureDigests = Object.fromEntries(readdirSync(FIXTURES).map((d) => [d, digest(join(FIXTURES, d))]));
const geige = caseSources().find((s) => s.key === "fixtures/geige")!;
const json = (dir: string, file: string) => JSON.parse(readFileSync(join(dir, file), "utf8"));

describe("editor model", () => {
  it("lists the fixtures as read-only sources with their titles", () => {
    expect(caseSources().map((s) => s.key)).toEqual(expect.arrayContaining(["fixtures/geige", "fixtures/vitrine", "fixtures/brieffoeffner"]));
    expect(geige.label).toBe("Fall: Die verstummte Geige");
  });

  it("reads form fields as edits, whole files first", () => {
    const form = new URLSearchParams([
      ["f:public-content.json:questionTexts[2].text", "Neu?"],
      ["raw:truth.json", "{}"],
      ["act:interrogation-ida.json:1", "lie"],
      ["stance:interrogation-ida.json:1", "affirms"],
      ["f:../truth.json:title", "x"],
      ["other", "y"],
    ]);
    expect(editsFromForm(form)).toEqual([
      { kind: "raw", file: "truth.json", text: "{}" },
      { kind: "field", file: "public-content.json", field: "questionTexts[2].text", value: "Neu?" },
      { kind: "act", file: "interrogation-ida.json", rule: 1, act: "lie", stance: "affirms" },
    ]);
  });

  it("applies field, epilogue, act and raw edits; unchanged values are no-ops", () => {
    const ws = new CaseWorkspace(join(scratch, "model"));
    const dir = ws.dirOf(ws.open(geige))!;
    const title = json(dir, "public-content.json").title;
    expect(applyEdits(dir, [{ kind: "field", file: "public-content.json", field: "title", value: title }])).toEqual({ applied: 0, errors: [] });
    const result = applyEdits(dir, [
      { kind: "field", file: "public-content.json", field: "brief", value: "Kurz." },
      { kind: "field", file: "public-content.json", field: "epilogue", value: " " },
      { kind: "act", file: "interrogation-ida.json", rule: 0, act: "decline", stance: null },
      { kind: "raw", file: "case.json", text: "{ kaputt" },
      { kind: "field", file: "public-content.json", field: "labels[0].entity", value: "x" },
    ]);
    expect(result.applied).toBe(2 + 1);
    expect(result.errors.map((e) => `${e.file} › ${e.field}`)).toEqual(["case.json › (JSON)", "public-content.json › labels[0].entity"]);
    const pc = json(dir, "public-content.json");
    expect(pc.brief).toBe("Kurz.");
    expect("epilogue" in pc).toBe(false);
    expect(getAt(json(dir, "interrogation-ida.json"), "rules[0]")).toEqual({ questionId: "question:q04", act: "decline" });
  });

  it("preview checks a scratch copy; save writes the working copy and recomputes the hashes", () => {
    const ws = new CaseWorkspace(join(scratch, "save"));
    const name = ws.open(geige);
    const dir = ws.dirOf(name)!;
    const before = digest(dir);
    const bad = ws.preview(name, [{ kind: "field", file: "evidence-presentation.json", field: "entries[0].text", value: "Foto mit person:paul" }])!;
    expect(bad.check.ok).toBe(false);
    expect(bad.check.problems).toContainEqual(expect.objectContaining({ file: "evidence-presentation.json", field: "entries[0].text", severity: "error" }));
    expect(digest(dir)).toBe(before);
    // A new player text makes the release hashes stale; the editor rewrites them.
    const saved = ws.save(name, [{ kind: "field", file: "public-content.json", field: "title", value: "Die verstummte Stradivari" }])!;
    expect(saved.apply.applied).toBe(1);
    expect(saved.check.ok).toBe(true);
    expect(checkCaseFolder(dir).filled).toEqual([]);
    expect(json(dir, "public-content.json").title).toBe("Die verstummte Stradivari");
  });

  it("turning Ida's lie into an honest affirmation is valid; an act without a claim is named at the rule", () => {
    const ws = new CaseWorkspace(join(scratch, "acts"));
    const name = ws.open(geige);
    expect(ws.preview(name, [{ kind: "act", file: "interrogation-ida.json", rule: 1, act: "answer", stance: null }])!.check.ok).toBe(true);
    ws.save(name, [{ kind: "act", file: "interrogation-ida.json", rule: 0, act: "decline", stance: null }]);
    const back = ws.preview(name, [{ kind: "act", file: "interrogation-ida.json", rule: 0, act: "answer", stance: null }])!;
    expect(back.check.problems).toContainEqual(expect.objectContaining({ file: "interrogation-ida.json", field: expect.stringMatching(/^rules\[0\]/), severity: "error" }));
  });

  it("a generated case lands in the working folder and is valid", () => {
    const ws = new CaseWorkspace(join(scratch, "gen"));
    const name = ws.generate(7);
    expect(name).toBe("fall-7");
    expect(checkCaseFolder(ws.dirOf(name)!).ok).toBe(true);
  });
});

describe("editor over HTTP", () => {
  let server: Server;
  let base: string;
  const workspaceDir = join(scratch, "http");
  beforeAll(async () => {
    const app = createWebApp({}, { workspaceDir });
    server = createServer((req, res) => void app(req, res));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const post = (path: string, body: Record<string, string>) => fetch(`${base}${path}`, { method: "POST", body: new URLSearchParams(body), redirect: "manual" });

  it("the start page and the case list link to the editor; opening copies the case", async () => {
    expect(await (await fetch(`${base}/`)).text()).toContain('href="/editor"');
    const home = await (await fetch(`${base}/editor`)).text();
    expect(home).toContain("Fall-Editor");
    expect(home).toContain('value="fixtures/geige"');
    const opened = await post("/editor/open", { source: "fixtures/geige" });
    expect(opened.status).toBe(303);
    expect(opened.headers.get("location")).toBe("/editor/geige");
    const page = await (await fetch(`${base}/editor/geige`)).text();
    expect(page).toContain("Gültig und lösbar");
    expect(page).toContain('data-file="public-content.json" data-field="title"');
    expect(page).toContain('name="act:interrogation-ida.json:1"');
    expect(page).toContain("Weg kellerplan: lösbar");
  });

  it("check answers with problems at file and field and writes nothing", async () => {
    const before = digest(join(workspaceDir, "geige"));
    const res = await post("/editor/geige/check", { "f:public-content.json:questionTexts[0].text": "Wo war person:ida?" });
    const data = (await res.json()) as { ok: boolean; problems: { file: string; field: string; severity: string }[]; html: string };
    expect(data.ok).toBe(false);
    expect(data.problems).toContainEqual(expect.objectContaining({ file: "public-content.json", field: "questionTexts[0].text", severity: "error" }));
    expect(data.html).toContain("questionTexts[0].text");
    expect(digest(join(workspaceDir, "geige"))).toBe(before);
  });

  it("save writes the working copy and reports it", async () => {
    const res = await post("/editor/geige/save", { "f:public-content.json:title": "Die Geige im Editor" });
    expect(res.status).toBe(303);
    const page = await (await fetch(`${base}/editor/geige`)).text();
    expect(page).toContain("1 Änderung gespeichert");
    expect(page).toContain("Der Fall ist gültig und lösbar.");
    expect(json(join(workspaceDir, "geige"), "public-content.json").title).toBe("Die Geige im Editor");
  });

  it("unknown cases, sources and bad seeds are refused", async () => {
    expect((await fetch(`${base}/editor/nicht-da`)).status).toBe(404);
    expect((await fetch(`${base}/editor/..%2Fetc`)).status).toBe(404);
    expect((await post("/editor/open", { source: "../../etc" })).status).toBe(400);
    expect((await post("/editor/generate", { seed: "-1" })).status).toBe(400);
    expect((await fetch(`${base}/editor/geige/save`)).status).toBe(405);
  });

  it("the repository's fixtures are untouched", () => {
    for (const d of readdirSync(FIXTURES)) expect(digest(join(FIXTURES, d)), d).toBe(fixtureDigests[d]);
  });
});
