// Trusted test inventory reporter for the forge-v01 Vitest project (PKG §7, contract B §3/§4).
//
// Runs inside the worker under the trusted vitest.config.mjs. It observes only the public
// Vitest 5.0.3 reporter API (onInit, onTestRunEnd) and writes exactly one length-framed report
// to the inherited descriptor named by FORGE_REPORT_FD (always 3: a socket to the trusted entry that no
// Vitest fork holds; worker-entry.mjs):
//
//   "FORGE-REPORT-V1 <decimal payload length>\n" + <UTF-8 JSON payload>
//
// Payload: {format:1, inventory:Inventory, failures:[{id, errorNames}]}. Identities and
// occurrences come from the ordered children tree (depth-first), never from callback order.
// No error message, stack or stdout is copied into the report: only fixed kinds, error names
// and the test titles that form the identity. The report is an observation, not a proof
// (PKG §6 transport paragraph); the supervisor parses it strictly (inventory.py).

import { closeSync, writeSync } from "node:fs";
import { relative, sep } from "node:path";

export const REPORT_MAGIC = "FORGE-REPORT-V1";

/** Same bytes as the supervisor's canonical key: compact JSON of the identity, UTF-8. */
function identityKey(id) {
  return Buffer.from(JSON.stringify(id), "utf8");
}

function byKey(a, b) {
  return Buffer.compare(a.key, b.key);
}

function statusOf(test) {
  if (test.options.mode === "todo") return "todo";
  // "pending" (or anything new) is passed through; the parser rejects unknown statuses.
  return test.result().state;
}

function hasTests(node) {
  return !node.children.allTests().next().done;
}

function errorName(error) {
  return typeof error?.name === "string" ? error.name : "";
}

/** Depth-first walk of one module: tests in declaration order, suite errors as "suite"/"hook". */
function walkModule(module, file, tests, failures, errors) {
  const counts = new Map();
  const visit = (node, ancestors) => {
    for (const child of node.children) {
      if (child.type === "suite") {
        const path = [...ancestors, child.name];
        // A suite error with no test collected is a throwing describe body ("suite"); with
        // tests it is a beforeAll/afterAll error ("hook"). The public API cannot tell a
        // forbidden describe.only error apart from a hook error, so it is reported as "hook";
        // every error kind rejects the inventory alike.
        const kind = hasTests(child) ? "hook" : "suite";
        for (const _ of child.errors()) errors.push({ kind, testIdentity: null });
        visit(child, path);
        continue;
      }
      const base = JSON.stringify([file, child.project.name, ancestors, child.name]);
      const occurrence = counts.get(base) ?? 0;
      counts.set(base, occurrence + 1);
      const id = [file, child.project.name, ancestors, child.name, occurrence];
      const status = statusOf(child);
      tests.push({ key: identityKey(id), row: { id, status } });
      if (status === "failed") {
        const names = (child.result().errors ?? []).map(errorName);
        failures.push({ key: identityKey(id), row: { id, errorNames: names } });
      }
    }
  };
  visit(module, []);
}

export function buildPayload(root, modules, unhandledErrors, reason) {
  const files = [];
  const tests = [];
  const failures = [];
  const errors = [];
  for (const module of modules) {
    const file = relative(root, module.moduleId).split(sep).join("/");
    const moduleErrors = module.errors();
    // Module-level errors: no test collected → collection error (import throw, syntax error,
    // "no test found"), otherwise a module-level beforeAll/afterAll hook error.
    const collected = hasTests(module);
    for (const _ of moduleErrors) errors.push({ kind: collected ? "hook" : "collection", testIdentity: null });
    files.push({ file, project: module.project.name, collection: collected ? "ok" : "error" });
    walkModule(module, file, tests, failures, errors);
  }
  for (const _ of unhandledErrors) errors.push({ kind: "unhandled", testIdentity: null });
  files.sort((a, b) => Buffer.compare(Buffer.from(a.file, "utf8"), Buffer.from(b.file, "utf8")));
  tests.sort(byKey);
  failures.sort(byKey);
  const errorRows = errors
    .map((row) => ({ key: Buffer.from(JSON.stringify(row), "utf8"), row }))
    .sort(byKey)
    .map((e) => e.row);
  return {
    format: 1,
    inventory: { format: 1, files, tests: tests.map((t) => t.row), errors: errorRows, reason },
    failures: failures.map((f) => f.row),
  };
}

export function frame(payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  return Buffer.concat([Buffer.from(`${REPORT_MAGIC} ${body.length}\n`, "ascii"), body]);
}

/** Writes all of `bytes` to a possibly non-blocking descriptor, then closes it: nothing can follow the frame. */
export function writeFrame(fd, bytes) {
  const pause = new Int32Array(new SharedArrayBuffer(4));
  for (let done = 0; done < bytes.length; ) {
    try {
      done += writeSync(fd, bytes, done, bytes.length - done);
    } catch (error) {
      if (error?.code !== "EAGAIN") throw error;
      Atomics.wait(pause, 0, 0, 2);
    }
  }
  closeSync(fd);
}

export default class InventoryReporter {
  root = undefined;
  written = false;

  onInit(vitest) {
    this.root = vitest.config.root;
  }

  onTestRunEnd(testModules, unhandledErrors, reason) {
    if (process.env["FORGE_REPORT_FD"] !== "3" || !this.root || this.written) {
      throw new Error("forge inventory reporter: no report channel, no root, or a second report");
    }
    this.written = true;
    writeFrame(3, frame(buildPayload(this.root, testModules, unhandledErrors, reason)));
  }
}
