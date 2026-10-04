// Trusted worker entry (copied by worker.py into /trusted). Runs argv, discards its output under a
// budget, then writes exactly the bytes of FORGE_REPORT_PATH (bounded) to stdout. Exit: 0/1 as the child,
// 128+n for a signal, 2 for any other code, 3 for an output overflow (no report then).
import { spawn } from "node:child_process";
import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";
import { constants as os } from "node:os";
const LIMIT = 64 + 8 * 1024 * 1024 + 1, BUDGET = 8 * 1024 * 1024;
process.on("uncaughtException", () => process.exit(4));
const [command, ...args] = process.argv.slice(2);
let seen = 0, overflow = false;
const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], env: process.env });
const count = (chunk) => { seen += chunk.length; if (seen > BUDGET && !overflow) { overflow = true; child.kill("SIGKILL"); } };
child.stdout.on("data", count); child.stderr.on("data", count); child.on("error", () => {});
function report() {
  let fd;
  try { fd = openSync(process.env.FORGE_REPORT_PATH, constants.O_RDONLY | constants.O_NOFOLLOW); } catch { return Buffer.alloc(0); }
  try {
    if (!fstatSync(fd).isFile()) return Buffer.alloc(0);
    const buf = Buffer.alloc(LIMIT); let n = 0, r = 0;
    while (n < LIMIT && (r = readSync(fd, buf, n, LIMIT - n, null)) > 0) n += r;
    return buf.subarray(0, n);
  } finally { closeSync(fd); }
}
child.on("close", (code, signal) => {
  const status = overflow ? 3 : signal ? 128 + (os.signals[signal] ?? 64) : code === 0 || code === 1 ? code : 2;
  process.stdout.write(overflow ? Buffer.alloc(0) : report(), () => process.exit(status));
});
