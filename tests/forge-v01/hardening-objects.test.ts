import { afterAll, describe, expect, test } from "vitest";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { b, outcome, py, removeTree, tempRoot, type Call } from "./helpers.ts";

// Hardening of the Task A input boundary: event payload and live API answers with wrong JSON
// types. Every malformed input must end in the documented failure code, never in a Python
// exception (which stage0 would turn into EXECUTION_INTERNAL) and never in a PASS.

const REPO_ID = 1401864629;
const REPO = "/repos/Forge-Dice/Forge";
const BASE = "a".repeat(40);
const HEAD = "b".repeat(40);
const PR = 1;
const RUN = 4242;
const ATTEMPT = 1;

const root = tempRoot("hardening-objects");
afterAll(() => removeTree(root));
let wsCount = 0;
function workspace(): string {
  const dir = join(root, `ws-${wsCount++}`);
  mkdirSync(dir, { mode: 0o700 });
  return dir;
}

function event(o: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    action: "synchronize",
    number: PR,
    repository: { id: REPO_ID, full_name: "Forge-Dice/Forge" },
    pull_request: { number: PR, base: { sha: BASE, ref: "main", repo: { id: REPO_ID } }, head: { sha: HEAD, repo: { id: REPO_ID } } },
    ...o,
  };
}

const facts = { eventName: "pull_request_target", githubSha: BASE, runId: RUN, runAttempt: ATTEMPT, actorId: 99 };

function parse(ev: Record<string, unknown>): Call {
  return { fn: "bootstrap.parse_event", args: [b(JSON.stringify(ev)), facts] };
}

type Answers = { pull?: Record<string, unknown>; run?: Record<string, unknown> };
function answers(o: Answers = {}): Record<string, unknown> {
  return {
    [REPO]: { id: REPO_ID, full_name: "Forge-Dice/Forge", private: false },
    [`${REPO}/pulls/${PR}`]: {
      number: PR, state: "open", draft: false, user: { id: 99 },
      base: { sha: BASE, ref: "main", repo: { id: REPO_ID } }, head: { sha: HEAD, repo: { id: REPO_ID } }, ...o.pull,
    },
    [`${REPO}/branches/main`]: { commit: { sha: BASE } },
    [`${REPO}/actions/runs/${RUN}/attempts/${ATTEMPT}`]: { id: RUN, run_attempt: ATTEMPT, triggering_actor: { id: 99 }, ...o.run },
  };
}

/** Bootstrap up to the live reads; the remote does not exist, so a passing read_live ends in GIT_FETCH. */
function boot(o: Answers): Call {
  return {
    fn: "seams.bootstrap_for_test",
    args: [b(JSON.stringify(event())), facts, workspace(), { remote: join(root, "no-remote"), answers: answers(o) }],
    kwargs: { head: false },
  };
}

describe("event payload: non-scalar fields", () => {
  const [ok, actionList, actionDict] = py([
    parse(event()),
    parse(event({ action: ["synchronize"] })),
    parse(event({ action: { synchronize: 1 } })),
  ]);

  test("control: the well-formed event parses", () => {
    expect(outcome(ok!)).toBe("PASS");
  });

  test("action as a JSON array or object → PR_INPUT, not an unhashable-type exception", () => {
    expect(outcome(actionList!)).toBe("PR_INPUT");
    expect(outcome(actionDict!)).toBe("PR_INPUT");
  });
});

