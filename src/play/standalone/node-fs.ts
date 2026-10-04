// Browser stand-in for node:fs in the single-file build: the case fixtures are embedded by the
// build as a map from repository path to file text (globalThis.__kfFiles).

export function readFileSync(file: URL | string, _encoding?: "utf8"): string {
  const path = (typeof file === "string" ? file : file.pathname).replace(/^\/?app\//, "").replace(/^\//, "");
  const files = (globalThis as { __kfFiles?: Record<string, string> }).__kfFiles ?? {};
  const text = files[decodeURIComponent(path)];
  if (text === undefined) throw new Error(`Not embedded in the browser build: ${path}`);
  return text;
}
