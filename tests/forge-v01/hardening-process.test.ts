import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { outcome, py1, removeTree, tempRoot } from "./helpers.ts";

// Hardening of the process / sandbox boundary: daemon prerequisites and swallowed docker client
// errors. A fake docker client (a shell script) stands in for /usr/bin/docker; nothing is started.

let base: string;
let counter = 0;

function fakeDocker(cases: Record<string, string>): string {
  const dir = join(base, `docker-${counter++}`);
  mkdirSync(dir, { mode: 0o700 });
  const all: Record<string, string> = {
    version: "echo 27.0.0",
    info: `echo '["name=apparmor","name=seccomp,profile=builtin","name=cgroupns"]'`,
    image: "echo sha256:" + "a".repeat(64),
    run: "exit 0",
    rm: "exit 0",
    ...cases,
  };
  const body = Object.entries(all).map(([k, v]) => `  ${k}) ${v} ;;`).join("\n");
  const path = join(dir, "docker");
  writeFileSync(path, `#!/bin/sh\ncase "$1" in\n${body}\nesac\n`);
  chmodSync(path, 0o755);
  return path;
}

function workspace(): string {
  const dir = join(base, `ws-${counter++}`);
  mkdirSync(dir, { mode: 0o700 });
  return dir;
}

beforeAll(() => {
  base = tempRoot("hardening-process");
});

afterAll(() => {
  if (base) removeTree(base);
});

describe("DockerRunner prerequisites", () => {
  it("a daemon with the builtin seccomp profile passes the pre-start check", () => {
    expect(outcome(py1("seams.docker_runner_for_test", [fakeDocker({}), workspace(), "img:1"]))).toBe("PASS");
  });

  it("a daemon whose seccomp profile is 'unconfined' has no seccomp at all → EXECUTION_SANDBOX", () => {
    const docker = fakeDocker({ info: `echo '["name=apparmor","name=seccomp,profile=unconfined","name=cgroupns"]'` });
    expect(outcome(py1("seams.docker_runner_for_test", [docker, workspace(), "img:1"]))).toBe("EXECUTION_SANDBOX");
  });
});
