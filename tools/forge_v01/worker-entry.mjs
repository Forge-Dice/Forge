// Trusted worker entry (copied by worker.py into /trusted). Runs argv, discards its stdout/stderr under a
// budget, and forwards exactly the bytes the child wrote to its fd 3 (bounded) to stdout. fd 3 is a socket
// only this entry and its direct child hold: there is no report file, and a Vitest fork gets its IPC channel
// on fd 3 instead. Exit: 0/1 as the child, 128+n for a signal, 2 for any other code, 3 for an output overflow
// (no report then), 4 for an internal error, 5 when this process or its child is dumpable.
//
// Dumpable: a same-uid process (every Vitest worker runs HEAD code as uid 10001) may ptrace, open
// /proc/<pid>/mem or /proc/<pid>/fd/* of a dumpable process. The image makes /opt/node/bin/node
// execute-only (root:root 0711); exec of an unreadable binary leaves a process non-dumpable, and the kernel
// then shows /proc/<pid>/mem as root's. That is measured here for both processes, never assumed.
import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import { constants as os } from "node:os";
const LIMIT = 64 + 8 * 1024 * 1024 + 1, BUDGET = 8 * 1024 * 1024;
process.on("uncaughtException", () => process.exit(4));
// FORGE_LOCAL_RUNNER: set only by worker.LocalRunner (TEST ONLY); docker_argv rejects it.
const sealed = (pid) => process.env.FORGE_LOCAL_RUNNER === "1" || statSync(`/proc/${pid}/mem`).uid === 0;
if (!sealed(process.pid)) process.exit(5);
const [command, ...args] = process.argv.slice(2);
let seen = 0, overflow = false, size = 0;
const report = [];
const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe", "pipe"], env: process.env });
// "spawn" fires after the exec succeeded, before the child can have started any worker.
child.on("spawn", () => { if (!sealed(child.pid)) { child.kill("SIGKILL"); process.exit(5); } });
const count = (chunk) => { seen += chunk.length; if (seen > BUDGET && !overflow) { overflow = true; child.kill("SIGKILL"); } };
child.stdout.on("data", count); child.stderr.on("data", count); child.on("error", () => {});
child.stdio[3].on("data", (chunk) => { if (size < LIMIT) report.push(chunk.subarray(0, LIMIT - size)); size += chunk.length; });
child.stdio[3].on("error", () => {});
child.on("close", (code, signal) => {
  const status = overflow ? 3 : signal ? 128 + (os.signals[signal] ?? 64) : code === 0 || code === 1 ? code : 2;
  process.stdout.write(overflow ? Buffer.alloc(0) : Buffer.concat(report), () => process.exit(status));
});
