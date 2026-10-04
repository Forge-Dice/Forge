import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, relative, resolve } from "node:path";
import { rolldown } from "rolldown";
import { PLAY_CASES } from "../cases.ts";

// `npm run build:web`: the whole browser front end as one HTML file that needs no server. The
// session logic, zod and the case fixtures are bundled with rolldown (vitest's own bundler, so no
// new dependency); node:crypto, node:fs, node:http and node:path are replaced by the browser stand-ins next
// to this file. The page shell (shell.js) runs the same request handler as `npm run play:web`.
// The file holds the full case data, answer keys included, like the local server does.

const here = (name: string) => fileURLToPath(new URL(name, import.meta.url));
const repo = fileURLToPath(new URL("../../../", import.meta.url));

/** The embedded fixture files of every playable case, keyed by repository path. */
function caseFiles(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const c of Object.values(PLAY_CASES)) {
    const dir = `tests/fixtures/${c.dir}`;
    for (const name of readdirSync(`${repo}${dir}`).filter((n) => n.endsWith(".json")).sort()) {
      files[`${dir}/${name}`] = readFileSync(`${repo}${dir}/${name}`, "utf8");
    }
  }
  return files;
}

/** Script text safe inside an inline <script> element. */
const inline = (js: string) => js.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");

export async function bundleScript(): Promise<string> {
  const bundle = await rolldown({
    input: here("./entry.ts"),
    platform: "browser",
    logLevel: "warn",
    resolve: { alias: { "node:crypto": here("./node-crypto.ts"), "node:fs": here("./node-fs.ts"), "node:http": here("./node-http.ts"), "node:path": here("./node-path.ts") } },
    plugins: [
      {
        name: "import-meta-url",
        // Each module sees a stable file URL below /app/, so cases.ts resolves its fixtures there.
        transform(code, id) {
          if (!code.includes("import.meta.url")) return null;
          return { code: code.replaceAll("import.meta.url", JSON.stringify(`file:///app/${relative(repo, id)}`)), map: null };
        },
      },
    ],
  });
  const { output } = await bundle.generate({
    format: "iife",
    minify: true,
    // Node globals the shared code touches: the web.ts main guard and utf8Length.
    intro: `var process = { argv: [], env: {} }; var Buffer = { byteLength: (s) => new TextEncoder().encode(s).length };`,
  });
  await bundle.close();
  return output[0].code;
}

export async function buildStandalone(): Promise<string> {
  const files = JSON.stringify(caseFiles()).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#1c1814">
<title>Kriminalfälle</title>
<style>
html, body { margin: 0; height: 100%; background: #1c1814; }
iframe { display: block; width: 100%; height: 100%; border: 0; }
.boot { display: grid; place-items: center; height: 100%; color: #e9dcc3; font: 18px "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; letter-spacing: .02em; }
</style>
</head>
<body>
<div id="boot" class="boot" role="status">Die Akten werden geholt …</div>
<iframe id="kf" title="Kriminalfälle" hidden></iframe>
<script>globalThis.__kfFiles = ${files};</script>
<script>${inline(await bundleScript())}</script>
<script>${inline(readFileSync(here("./shell.js"), "utf8"))}</script>
</body>
</html>
`;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = resolve(process.argv[2] ?? `${repo}dist/kriminalfaelle.html`);
  mkdirSync(dirname(out), { recursive: true });
  const html = await buildStandalone();
  writeFileSync(out, html);
  console.log(`${relative(process.cwd(), out)} geschrieben (${Math.round(html.length / 1024)} KB). Im Browser öffnen, kein Server nötig.`);
}
