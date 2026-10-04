import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportCaseFiles, importCaseText, MAX_SHARE_BYTES } from "../src/play/case-share.ts";
import { newGame } from "../src/play/game.ts";
import { createWebHandler } from "../src/play/web.ts";
import { createWebServerApp } from "../src/play/web-server.ts";

// Sharing a case: the editor exports one file with SHA-256 per part and overall; the game imports
// it only after the hashes, check-case (real parsers, binding hashes, every route) and the package
// loader accept it.

const FIXTURES = new URL("./fixtures/", import.meta.url).pathname;
const filesOf = (dir: string) => Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => [f, readFileSync(join(dir, f), "utf8")]));
const geige = filesOf(join(FIXTURES, "geige"));
const sha = (t: string) => createHash("sha256").update(t, "utf8").digest("hex");
/** A share file whose hashes were recomputed after editing a part: integrity holds, the case must still be checked. */
function rehashed(files: Record<string, string>): string {
  return exportCaseFiles(files);
}
const reject = (text: string) => {
  const r = importCaseText(text);
  if (r.ok) throw new Error("accepted");
  return r;
};

describe("case share file", () => {
  it("round-trips every fixture into a playable package", () => {
    for (const name of readdirSync(FIXTURES)) {
      const r = importCaseText(exportCaseFiles(filesOf(join(FIXTURES, name))));
      expect(r.ok, name).toBe(true);
      if (!r.ok) continue;
      expect(r.slug).toMatch(/^eigen-[0-9a-f]{12}$/);
      expect(newGame(r.pkg, r.clockOrigin).state.events).toEqual([]);
    }
  });

  it("carries a hash per part and one over all parts", () => {
    const share = JSON.parse(exportCaseFiles(geige));
    expect(share).toMatchObject({ format: "kriminalfall", version: 1, title: "Die verstummte Geige" });
    expect(share.sha256["truth.json"]).toBe(sha(geige["truth.json"]!));
    expect(Object.keys(share.files)).toEqual(Object.keys(share.sha256));
  });

  it("refuses files that are not case files", () => {
    expect(reject("kein json").title).toBe("Das ist keine Fall-Datei.");
    expect(reject(JSON.stringify({ format: "spielstand" })).title).toBe("Das ist keine Fall-Datei.");
    const share = JSON.parse(exportCaseFiles(geige));
    expect(reject(JSON.stringify({ ...share, extra: 1 })).title).toBe("Das ist keine Fall-Datei.");
    expect(reject(JSON.stringify({ ...share, files: { ...share.files, "../x.json": "{}" } })).title).toBe("Das ist keine Fall-Datei.");
    expect(reject("x".repeat(MAX_SHARE_BYTES + 1)).title).toBe("Die Datei ist zu groß.");
  });

  it("refuses tampering: a changed part, a missing part, a forged overall hash", () => {
    const share = JSON.parse(exportCaseFiles(geige));
    const changed = { ...share, files: { ...share.files, "public-content.json": share.files["public-content.json"].replace("Geige", "Bratsche") } };
    expect(reject(JSON.stringify(changed))).toMatchObject({ title: "Die Fall-Datei wurde verändert.", problems: ["public-content.json: Prüfsumme stimmt nicht"] });
    const { ["solution.json"]: _gone, ...rest } = share.files;
    expect(reject(JSON.stringify({ ...share, files: rest })).title).toBe("Die Fall-Datei ist beschädigt.");
    expect(reject(JSON.stringify({ ...share, digest: "0".repeat(64) })).title).toBe("Die Fall-Datei wurde verändert.");
  });

  it("with consistent hashes the case itself is checked in full", () => {
    // A player text naming an internal id: check-case rejects it at file and field.
    const leaked = JSON.parse(geige["evidence-presentation.json"]!);
    leaked.entries[0].text = "Foto mit person:paul";
    const r = reject(rehashed({ ...geige, "evidence-presentation.json": JSON.stringify(leaked) }));
    expect(r.title).toBe("Der Fall ist nicht gültig.");
    expect(r.problems.some((p) => p.startsWith("evidence-presentation.json › entries[0].text"))).toBe(true);
    // A changed truth makes every binding hash stale.
    const truth = JSON.parse(geige["truth.json"]!);
    truth.title = "Andere Wahrheit";
    expect(reject(rehashed({ ...geige, "truth.json": JSON.stringify(truth) })).title).toBe("Der Fall ist nicht gültig.");
    // A missing part.
    const { ["solution.json"]: _gone, ...noSolution } = geige;
    expect(reject(rehashed(noSolution)).problems).toContain("solution.json › (Datei): Datei fehlt");
  });
});

describe("Eigenen Fall laden over HTTP", () => {
  it("the case list links to the import page; a loaded case is playable and listed", async () => {
    const web = createWebHandler();
    const none = async () => null;
    expect((await web("GET", "/", none)).body).toContain('href="/eigener-fall"');
    expect((await web("GET", "/eigener-fall", none)).body).toContain('id="case-file"');
    const res = await web("POST", "/eigener-fall", async () => exportCaseFiles(geige));
    expect(res.status).toBe(200);
    const { slug } = JSON.parse(res.body) as { slug: string };
    const page = await web("GET", `/fall/${slug}`, none);
    expect(page.status).toBe(200);
    expect(page.body).toContain("Geprüft und geladen");
    expect((await web("GET", "/eigener-fall", none)).body).toContain(`href="/fall/${slug}"`);
    const bad = await web("POST", "/eigener-fall", async () => "{}");
    expect(bad.status).toBe(422);
    expect((await web("GET", "/fall/eigen-000000000000", none)).status).toBe(404);
  });

  describe("editor export", () => {
    let server: Server;
    let base: string;
    const scratch = mkdtempSync(join(tmpdir(), "case-share-"));
    beforeAll(async () => {
      const app = createWebServerApp({}, { workspaceDir: scratch });
      server = createServer((req, res) => void app(req, res));
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });
    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      rmSync(scratch, { recursive: true, force: true });
    });

    it("downloads the saved working copy as a case file the game accepts", async () => {
      await fetch(`${base}/editor/open`, { method: "POST", body: new URLSearchParams({ source: "fixtures/geige" }), redirect: "manual" });
      await fetch(`${base}/editor/geige/save`, { method: "POST", body: new URLSearchParams({ "f:public-content.json:title": "Die geteilte Geige" }), redirect: "manual" });
      expect(await (await fetch(`${base}/editor/geige`)).text()).toContain('href="/editor/geige/export"');
      const res = await fetch(`${base}/editor/geige/export`);
      expect(res.headers.get("content-disposition")).toBe('attachment; filename="geige.kriminalfall.json"');
      const text = await res.text();
      const loaded = await fetch(`${base}/eigener-fall`, { method: "POST", body: text });
      expect(loaded.status).toBe(200);
      const { slug, title } = (await loaded.json()) as { slug: string; title: string };
      expect(title).toBe("Die geteilte Geige");
      expect(await (await fetch(`${base}/fall/${slug}`)).text()).toContain("Die geteilte Geige");
    });
  });
});
