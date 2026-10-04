import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { exportCaseFiles, importCaseText, MAX_SHARE_BYTES } from "../src/play/case-share.ts";
import { caseSources, CaseWorkspace, type Edit } from "../src/play/editor.ts";
import { createWebHandler } from "../src/play/web.ts";

// The import takes files from strangers. Each attack here is answered with a clear refusal, never
// a crash, a hang, a polluted prototype, script in a page, or another case under the same address.

const scratch = mkdtempSync(join(tmpdir(), "case-share-attacks-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
const geige = caseSources().find((s) => s.key === "fixtures/geige")!;
const none = async () => null;
const filesOf = (dir: string) => Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => [f, readFileSync(join(dir, f), "utf8")]));
const plain = filesOf(new URL("./fixtures/geige/", import.meta.url).pathname);
let n = 0;
/** A geige working copy with edits saved through the editor (hashes recomputed), as a share file. */
function shared(edits: readonly Edit[], structure?: (ws: CaseWorkspace, name: string) => void): string {
  const ws = new CaseWorkspace(join(scratch, `ws${n++}`));
  const name = ws.open(geige);
  structure?.(ws, name);
  const saved = ws.save(name, edits)!;
  expect(saved.check.problems.filter((p) => p.severity === "error")).toEqual([]);
  return exportCaseFiles(filesOf(ws.dirOf(name)!));
}
const refused = (text: string) => {
  const r = importCaseText(text);
  expect(r.ok).toBe(false);
  return r as Extract<typeof r, { ok: false }>;
};
const timed = <T>(f: () => T): [T, number] => {
  const t0 = performance.now();
  const v = f();
  return [v, performance.now() - t0];
};

describe("size and shape", () => {
  it("a huge text is refused before it is parsed or encoded", () => {
    const [r, ms] = timed(() => refused(" ".repeat(64 * 1024 * 1024)));
    expect(r.title).toBe("Die Datei ist zu groß.");
    expect(ms).toBeLessThan(200);
  });

  it("deeply nested JSON in a part is refused, not a stack overflow", () => {
    const deep = "[".repeat(200_000) + "]".repeat(200_000);
    const manifest = plain["release-manifest.json"]!.replace(/\}\s*$/, `,"x":${deep}}`);
    const r = refused(exportCaseFiles({ ...plain, "release-manifest.json": manifest }));
    expect(r.title).toBe("Der Fall ist nicht gültig.");
    expect(r.problems).toContain("release-manifest.json › (Datei): zu tief verschachtelt");
  });

  it("deep nesting in case.json (checked by nobody else) is refused too", () => {
    const deep = '{"a":'.repeat(5000) + "1" + "}".repeat(5000);
    const r = refused(exportCaseFiles({ ...plain, "case.json": `{"deep":${deep}}` }));
    expect(r.problems).toContain("case.json › (Datei): zu tief verschachtelt");
  });

  it("parts that no case has are refused (no free payload, no cheap hash grinding)", () => {
    const r = refused(exportCaseFiles({ ...plain, "zz.json": "{}" }));
    expect(r.problems).toContain("zz.json: kein Teil eines Falls");
  });

  it("many routes and long routes hit the checker's limits quickly", () => {
    const manifest = JSON.parse(plain["release-manifest.json"]!);
    const route = manifest.certificateData.routes[0];
    manifest.certificateData.routes = Array.from({ length: 5000 }, (_, i) => ({ ...route, routeId: `r${i}` }));
    const [r, ms] = timed(() => refused(exportCaseFiles({ ...plain, "release-manifest.json": JSON.stringify(manifest) })));
    expect(r.title).toBe("Der Fall ist nicht gültig.");
    expect(ms).toBeLessThan(3000);
  });

  it("any exception inside the check becomes a refusal", () => {
    // A part that parses but is not an object where the checker expects one.
    const r = refused(exportCaseFiles({ ...plain, "case.json": "null" }));
    expect(r.ok).toBe(false);
  });
});

describe("prototype pollution", () => {
  it("__proto__ and constructor keys anywhere do not reach Object.prototype", () => {
    const share = JSON.parse(exportCaseFiles(plain));
    for (const text of [
      `{"__proto__":{"polluted":1},${JSON.stringify(share).slice(1)}`,
      JSON.stringify({ ...share, files: { ...share.files, "__proto__.json": "{}" } }),
    ]) refused(text);
    refused(exportCaseFiles({ ...plain, "truth.json": plain["truth.json"]!.replace(/^\{/, '{"__proto__":{"polluted":1},"constructor":{"prototype":{"polluted":1}},') }));
    refused(exportCaseFiles({ ...plain, "case.json": '{"__proto__":{"polluted":1},"constructor":{"prototype":{"polluted":1}}}' }));
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
  });

  it("an interrogable person named Constructor is an ordinary case", () => {
    const text = shared([], (ws, name) => {
      ws.structure(name, { op: "add-entity", kind: "person", name: "Constructor", known: true, npc: true });
    });
    expect(JSON.parse(text).files["npc-constructor.json"]).toBeDefined();
    expect(importCaseText(text).ok).toBe(true);
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
  });
});

describe("HTML and script in case texts", () => {
  const evil = `<script>alert(1)</script><img src=x onerror=alert(2)></textarea></script><svg onload=alert(3)>`;
  it("every player text is escaped on the game page, the case list and the import page", async () => {
    const text = shared([
      { kind: "field", file: "public-content.json", field: "title", value: `Geige ${evil}` },
      { kind: "field", file: "public-content.json", field: "brief", value: `Auftrag ${evil}` },
      { kind: "field", file: "public-content.json", field: "labels[0].label", value: `Ida ${evil}` },
      { kind: "field", file: "public-content.json", field: "questionTexts[0].text", value: `Frage ${evil}?` },
      { kind: "field", file: "evidence-presentation.json", field: "entries[0].text", value: `Fund ${evil}` },
    ]);
    const web = createWebHandler();
    const res = await web("POST", "/eigener-fall", async () => text);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/json");
    const { slug } = JSON.parse(res.body) as { slug: string };
    const pages = [(await web("GET", `/fall/${slug}`, none)).body, (await web("GET", "/eigener-fall", none)).body, (await web("GET", "/", none)).body];
    for (const page of pages) {
      expect(page).not.toMatch(/<script>alert|<img src=x|<svg onload|onerror=alert\(2\)>/);
    }
    expect(pages[0]).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("refusal reasons carry no markup the page would render", async () => {
    const share = JSON.parse(exportCaseFiles(plain));
    const res = await createWebHandler()("POST", "/eigener-fall", async () => JSON.stringify({ ...share, ["<img src=x onerror=alert(1)>"]: 1 }));
    expect(res.status).toBe(422);
    expect(res.headers["content-type"]).toContain("application/json");
    // Shown with textContent by the page script; the JSON itself must not be served as HTML.
    expect(res.headers["content-type"]).not.toContain("text/html");
  });
});

describe("hash collisions and addresses", () => {
  it("the address carries 128 bits of the digest", () => {
    const r = importCaseText(exportCaseFiles(plain));
    expect(r.ok && r.slug).toMatch(/^eigen-[0-9a-f]{32}$/);
  });

  it("a different case never answers under an address already in use", async () => {
    const web = createWebHandler();
    const a = JSON.parse((await web("POST", "/eigener-fall", async () => exportCaseFiles(plain))).body) as { slug: string };
    const other = shared([{ kind: "field", file: "public-content.json", field: "title", value: "Eine andere Geige" }]);
    const b = JSON.parse((await web("POST", "/eigener-fall", async () => other)).body) as { slug: string };
    expect(b.slug).not.toBe(a.slug);
    expect((await web("GET", `/fall/${a.slug}`, none)).body).toContain("Die verstummte Geige");
    expect((await web("GET", `/fall/${b.slug}`, none)).body).toContain("Eine andere Geige");
  });

  it("an imported copy of a built-in case gets its own address and never replaces the built-in", async () => {
    const web = createWebHandler();
    const { slug } = JSON.parse((await web("POST", "/eigener-fall", async () => exportCaseFiles(plain))).body) as { slug: string };
    expect(slug).not.toBe("geige");
    const builtIn = (await web("GET", "/fall/geige", none)).body;
    expect(builtIn).toContain("Die verstummte Geige");
    expect(importCaseText(exportCaseFiles(plain)).ok).toBe(true);
  });

  it("the server keeps a bounded number of imported cases", async () => {
    const web = createWebHandler();
    const first = JSON.parse((await web("POST", "/eigener-fall", async () => exportCaseFiles(plain))).body) as { slug: string };
    for (let i = 0; i < 20; i++) {
      await web("POST", "/eigener-fall", async () => exportCaseFiles({ ...plain, "case.json": JSON.stringify({ ...JSON.parse(plain["case.json"] ?? "{}"), note: i }) }));
    }
    expect((await web("GET", `/fall/${first.slug}`, none)).status).toBe(404);
  });
});

it("MAX_SHARE_BYTES stays at 1 MB", () => expect(MAX_SHARE_BYTES).toBe(1024 * 1024));
