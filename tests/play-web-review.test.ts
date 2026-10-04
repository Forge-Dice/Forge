import { createServer, type Server } from "node:http";
import { connect, type AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadPlayPackage } from "../src/play/cases.ts";
import { createWebApp } from "../src/play/web.ts";

// Review fixes for the local web server: a malformed request must not take the server down,
// cross-site posts are refused, oversized bodies get 413, and the load result reaches the player.

let server: Server;
let port: number;
let base: string;
beforeAll(async () => {
  const app = createWebApp({ vitrine: loadPlayPackage("vitrine") });
  server = createServer((req, res) => void app(req, res));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
  base = `http://127.0.0.1:${port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

/** Sends a raw HTTP request and returns the status line ("" if the connection closed without one). */
function raw(request: string): Promise<string> {
  return new Promise((resolve) => {
    const socket = connect(port, "127.0.0.1", () => socket.write(request));
    let data = "";
    socket.on("data", (chunk) => (data += chunk.toString("utf8")));
    socket.on("close", () => resolve(data.split("\r\n")[0] ?? ""));
    socket.on("error", () => resolve(""));
    socket.setTimeout(2000, () => socket.destroy());
  });
}

describe("web server review fixes", () => {
  it("a malformed request URL is answered 400 and the server keeps running", async () => {
    expect(await raw("GET //[ HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")).toMatch(/^HTTP\/1\.1 400/);
    expect((await fetch(`${base}/`)).status).toBe(200);
  });

  it("a post from another origin or to a foreign host name is refused and changes nothing", async () => {
    await fetch(`${base}/fall/vitrine/act`, {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "group=h&n=1&at=0",
    });
    const before = await (await fetch(`${base}/fall/vitrine/save`)).text();
    const evil = await fetch(`${base}/fall/vitrine/new`, { method: "POST", redirect: "manual", headers: { origin: "https://evil.example" } });
    expect(evil.status).toBe(403);
    expect(await raw("POST /fall/vitrine/new HTTP/1.1\r\nHost: evil.example\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")).toMatch(/^HTTP\/1\.1 403/);
    expect(await (await fetch(`${base}/fall/vitrine/save`)).text()).toBe(before);
    const same = await fetch(`${base}/fall/vitrine/new`, { method: "POST", redirect: "manual", headers: { origin: base } });
    expect(same.status).toBe(303);
  });

  it("an oversized body gets 413 instead of a dropped connection", async () => {
    const res = await fetch(`${base}/fall/vitrine/load`, { method: "POST", body: "x".repeat(2 * 1024 * 1024) });
    expect(res.status).toBe(413);
  });

  it("the page's load script does not follow the redirect, so the load result is still shown", async () => {
    const page = await (await fetch(`${base}/fall/vitrine`)).text();
    expect(page).toContain('redirect: "manual"');
  });
});
