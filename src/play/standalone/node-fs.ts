// Browser stand-in for node:fs in the single-file build: the case fixtures are embedded by the
// build as a map from repository path to file text (globalThis.__kfFiles).

const embedded = (file: URL | string): string | undefined => {
  const path = (typeof file === "string" ? file : file.pathname).replace(/^\/?app\//, "").replace(/^\//, "");
  const files = (globalThis as { __kfFiles?: Record<string, string> }).__kfFiles ?? {};
  return files[decodeURIComponent(path)];
};

export function readFileSync(file: URL | string, _encoding?: "utf8"): string {
  const text = embedded(file);
  const path = (typeof file === "string" ? file : file.pathname).replace(/^\/?app\//, "").replace(/^\//, "");
  if (text === undefined) throw new Error(`Not embedded in the browser build: ${path}`);
  return text;
}

/** Whether a file is embedded (the play host looks for a case's locale variants). */
export function existsSync(path: URL | string): boolean {
  return embedded(path) !== undefined;
}

// Imported by shared authoring code but never called while playing.
export function readdirSync(_path: string): string[] {
  return [];
}
export function writeFileSync(): never {
  throw new Error("No file system in the browser build.");
}
