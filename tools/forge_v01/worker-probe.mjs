// Trusted isolation probe (copied by worker.py into /trusted). Attempts each forbidden access once and
// records the observed denial; it never decides anything itself.
import { closeSync, openSync, readdirSync, writeFileSync } from "node:fs";
import net from "node:net";
const probes = [];
const token = (e) => (e && typeof e.code === "string" && /^[A-Z][A-Z0-9_]{0,31}$/.test(e.code) ? e.code : "UNKNOWN");
const record = (probeId, kind, error) => probes.push({ probeId, attempted: true, denied: error !== null,
  observationKind: kind, observationCode: error === null ? "ALLOWED" : token(error) });
const tryOpen = (id, path, flags) => { try { closeSync(openSync(path, flags)); record(id, "errno", null); } catch (e) { record(id, "errno", e); } };
const connect = (id, options) => new Promise((resolve) => {
  const socket = net.connect(options);
  const done = (error) => { socket.destroy(); record(id, id === "network" ? "network" : "errno", error); resolve(); };
  socket.setTimeout(3000, () => done({ code: "ETIMEDOUT" }));
  socket.on("connect", () => done(null)); socket.on("error", done);
});
await connect("network", { host: "1.1.1.1", port: 443 });
await connect("docker-socket", { path: "/var/run/docker.sock" });
const leaked = Object.keys(process.env).some((k) => /^(GITHUB_|RUNNER_|ACTIONS_)/.test(k));
if (leaked) probes.push({ probeId: "actions-command-file", attempted: true, denied: false, observationKind: "exit", observationCode: "ENVPRESENT" });
else tryOpen("actions-command-file", "/home/runner/work/_temp/_runner_file_commands/forge-probe", "wx");
tryOpen("readonly-case", "/case/.forge-probe", "wx");
let testFile = null;
try { testFile = readdirSync("/case/tests").find((n) => n.endsWith(".ts")) ?? null; } catch {}
if (testFile === null) probes.push({ probeId: "readonly-test-file", attempted: false, denied: false, observationKind: "errno", observationCode: "NOTARGET" });
else tryOpen("readonly-test-file", `/case/tests/${testFile}`, "r+");
tryOpen("readonly-node-modules", "/case/node_modules/.forge-probe", "wx");
tryOpen("readonly-trusted", "/trusted/probe.mjs", "r+");
tryOpen("readonly-rootfs", "/forge-probe", "wx");
const body = Buffer.from(JSON.stringify({ format: 1, probes }), "utf8");
writeFileSync(process.env.FORGE_REPORT_PATH, Buffer.concat([Buffer.from(`FORGE-REPORT-V1 ${body.length}\n`), body]), { flag: "wx" });
