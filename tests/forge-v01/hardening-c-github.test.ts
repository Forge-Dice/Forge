import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { outcome, py1 } from "./helpers.ts";

// Hardening of the C GitHub read adapter (github.py): manipulated API answers must fail closed
// as EXECUTION_API (module contract: "missing or mistyped control fields are EXECUTION_API"),
// never be accepted and never escape as a Python exception (main.py maps those to EXECUTION_INTERNAL).

type Obj = Record<string, unknown>;
const REPO = "/repos/Forge-Dice/Forge";
const RUN = 4242;
const sha1 = (s: string) => createHash("sha1").update(s).digest("hex");
const B = sha1("base");
const H = sha1("head");

const read = (fn: string, answers: Obj, ...args: unknown[]) => outcome(py1("seams.github_read_for_test", [fn, answers, ...args]));

function apiPr(number: unknown): Obj {
  return { number, state: "open", draft: false, user: { id: 5 },
    base: { ref: "main", sha: B, repo: { id: 1401864629 } }, head: { sha: H, repo: { id: 1401864629 } } };
}
function apiRun(id: unknown, attempt: unknown): Obj {
  return { id, run_attempt: attempt, event: "pull_request_target", path: ".github/workflows/forge-v01.yml",
    workflow_id: 77, head_sha: B, repository: { id: 1401864629 }, triggering_actor: { id: 9 }, actor: { id: 9 } };
}
function apiJob(id: number, o: Obj = {}): Obj {
  return { id, run_id: RUN, run_attempt: 2, name: `j${id}`, status: "completed", conclusion: "success", ...o };
}
function apiReview(o: Obj = {}): Obj {
  return { id: 11, user: { id: 3 }, state: "COMMENTED", body: "x", commit_id: H, submitted_at: "2026-10-04T09:00:00Z", ...o };
}
const reviewsPath = (pr: number) => `${REPO}/pulls/${pr}/reviews?per_page=100&page=1`;
const jobsPath = (page: number, attempt = 2) => `${REPO}/actions/runs/${RUN}/attempts/${attempt}/jobs?per_page=100&page=${page}`;

describe("github.py: bool is never an id (Python True == 1)", () => {
  test("control values pass with the real integer", () => {
    expect(read("read_pr", { [`${REPO}/pulls/1`]: apiPr(1) }, 1)).toBe("PASS");
    expect(read("read_run", { [`${REPO}/actions/runs/1/attempts/1`]: apiRun(1, 1) }, 1, 1)).toBe("PASS");
  });
  test("PR #1 answered with number=true is EXECUTION_API", () => {
    expect(read("read_pr", { [`${REPO}/pulls/1`]: apiPr(true) }, 1)).toBe("EXECUTION_API");
  });
  test("run attempt 1 answered with run_attempt=true, run 1 with id=true is EXECUTION_API", () => {
    expect(read("read_run", { [`${REPO}/actions/runs/${RUN}/attempts/1`]: apiRun(RUN, true) }, RUN, 1)).toBe("EXECUTION_API");
    expect(read("read_run", { [`${REPO}/actions/runs/1/attempts/2`]: apiRun(true, 2) }, 1, 2)).toBe("EXECUTION_API");
  });
  test("a job of run 1 reporting run_id=true is EXECUTION_API", () => {
    const path = `${REPO}/actions/runs/1/attempts/2/jobs?per_page=100&page=1`;
    expect(read("read_jobs", { [path]: { total_count: 1, jobs: [apiJob(5, { run_id: true })] } }, 1, 2)).toBe("EXECUTION_API");
  });
});

describe("github.py: malformed review/job records are EXECUTION_API, not a Python exception", () => {
  test("control review record passes", () => {
    expect(read("read_reviews", { [reviewsPath(7)]: [[apiReview()]] }, 7)).toBe("PASS");
  });
  test("review without commit_id or submitted_at key", () => {
    const { commit_id: _c, ...noCommit } = apiReview();
    const { submitted_at: _s, ...noSubmitted } = apiReview();
    expect(read("read_reviews", { [reviewsPath(7)]: [[noCommit]] }, 7)).toBe("EXECUTION_API");
    expect(read("read_reviews", { [reviewsPath(7)]: [[noSubmitted]] }, 7)).toBe("EXECUTION_API");
  });
  test("review state / job status of an unhashable JSON type", () => {
    expect(read("read_reviews", { [reviewsPath(7)]: [[apiReview({ state: ["APPROVED"] })]] }, 7)).toBe("EXECUTION_API");
    expect(read("read_reviews", { [reviewsPath(7)]: [[apiReview({ state: {} })]] }, 7)).toBe("EXECUTION_API");
    expect(read("read_jobs", { [jobsPath(1)]: { total_count: 1, jobs: [apiJob(5, { status: ["completed"] })] } }, RUN, 2)).toBe("EXECUTION_API");
  });
});
