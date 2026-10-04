// Trusted Vitest configuration for the forge-v01 worker (PKG §6 "Trusted Vitest-Config").
//
// Loaded only via an explicit `--config <trusted path>`; HEAD config autodiscovery never
// happens. The include list is the exact set of approved *.test.ts paths from the Git
// snapshot, read from the supervisor-written plan file named by FORGE_VITEST_PLAN:
//   {"root": "/case", "include": ["tests/a.test.ts", ...]}
// No globs are accepted from input: every entry must match the portable path grammar, which
// contains no glob metacharacters, so each include entry matches exactly one file.

import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

export const PROJECT = "forge-v01";
export const REPORTER = fileURLToPath(new URL("./inventory-reporter.mjs", import.meta.url));

const SEGMENT = /^[A-Za-z0-9._-]{1,100}$/;

function approvedPath(path) {
  if (typeof path !== "string" || path.length > 255 || !path.endsWith(".test.ts")) return false;
  const segments = path.split("/");
  if (segments.length > 16) return false;
  return segments.every((s) => SEGMENT.test(s) && s !== "." && s !== ".." && !s.startsWith("-") && !s.endsWith("."));
}

export function makeConfig(root, approvedFiles) {
  if (typeof root !== "string" || !isAbsolute(root)) throw new Error("forge vitest config: root must be absolute");
  if (!Array.isArray(approvedFiles) || approvedFiles.length === 0) throw new Error("forge vitest config: empty include");
  if (!approvedFiles.every(approvedPath) || new Set(approvedFiles).size !== approvedFiles.length) {
    throw new Error("forge vitest config: include entry is not an approved test path");
  }
  return {
    root,
    configFile: false,
    plugins: [],
    test: {
      name: PROJECT,
      root,
      include: [...approvedFiles],
      exclude: [],
      includeSource: [],
      setupFiles: [],
      globalSetup: [],
      environment: "node",
      globals: false,
      allowOnly: false,
      passWithNoTests: false,
      retry: 0,
      sequence: { shuffle: false, concurrent: false },
      pool: "forks",
      maxWorkers: 2,
      fileParallelism: true,
      testTimeout: 5000,
      hookTimeout: 10000,
      reporters: [REPORTER],
      update: false,
      watch: false,
      ui: false,
      coverage: { enabled: false },
      browser: { enabled: false },
      typecheck: { enabled: false },
      cache: false,
      dangerouslyIgnoreUnhandledErrors: false,
    },
  };
}

function fromPlan() {
  const planPath = process.env["FORGE_VITEST_PLAN"];
  if (!planPath) throw new Error("forge vitest config: FORGE_VITEST_PLAN is not set");
  const plan = JSON.parse(readFileSync(planPath, "utf8"));
  if (plan === null || typeof plan !== "object" || Array.isArray(plan)) throw new Error("forge vitest config: bad plan");
  const keys = Object.keys(plan).sort();
  if (keys.length !== 2 || keys[0] !== "include" || keys[1] !== "root") throw new Error("forge vitest config: bad plan");
  return makeConfig(plan.root, plan.include);
}

// A config function: importing makeConfig/PROJECT/REPORTER has no side effect; Vitest calls it.
export default () => fromPlan();
