// Browser stand-in for node:path in the single-file build (imported by shared authoring code).

export const join = (...parts: string[]): string => parts.join("/").replace(/\/+/g, "/");
export const dirname = (path: string): string => path.replace(/\/[^/]*$/, "") || ".";
