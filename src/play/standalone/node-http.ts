// Browser stand-in for node:http in the single-file build; the browser has no server to start.

export function createServer(): never {
  throw new Error("No HTTP server in the browser build.");
}
