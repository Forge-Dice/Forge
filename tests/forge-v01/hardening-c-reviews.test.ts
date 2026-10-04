import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PYTHON, outcome, type Response } from "./helpers.ts";

// Hardening of Part C owner review handling: concrete API answers / attestation inputs that the
// kernel mishandled. Each case is an isolated regression for one fixed finding.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = "/repos/Forge-Dice/Forge";
const PR = 7;
const OWNER = 315180734;
const H = "1".repeat(40);
const REVIEWS_PATH = `${REPO}/pulls/${PR}/reviews?per_page=100&page=1`;

type Obj = Record<string, unknown>;

// Calls github.read_reviews over seams.FixedTransport, one fresh transport per answer list.
const RUNNER = `
import json, sys
sys.dont_write_bytecode = True
sys.path.insert(0, sys.argv[1])
import driver, seams, github
from errors import ForgeFail
out = []
for page in json.loads(sys.stdin.read()):
    try:
        out.append({"ok": driver.encode(github.read_reviews(seams.FixedTransport({sys.argv[2]: [page]}), ${PR}))})
    except ForgeFail as f:
        out.append({"fail": f.record()})
    except Exception as e:
        out.append({"error": type(e).__name__})
sys.stdout.write(json.dumps(out))
`;

function readReviews(pages: unknown[][]): Response[] {
  const r = spawnSync(PYTHON, ["-I", "-c", RUNNER, HERE, REVIEWS_PATH], { input: JSON.stringify(pages), encoding: "utf8" });
  if (r.status !== 0) throw new Error(`runner exited ${r.status}: ${r.stderr}`);
  return JSON.parse(r.stdout) as Response[];
}

const apiReview = (o: Obj = {}): Obj => ({
  id: 501, user: { id: OWNER, login: "owner" }, body: "note", state: "COMMENTED", commit_id: H,
  submitted_at: "2026-10-04T09:00:00Z", ...o,
});
const without = (key: string): Obj => Object.fromEntries(Object.entries(apiReview()).filter(([k]) => k !== key));

describe("github.read_reviews: malformed review records are EXECUTION_API, never an internal crash", () => {
  it("missing commit_id / submitted_at keys and non-string state fail closed with EXECUTION_API", () => {
    const cases: Record<string, unknown> = {
      missingCommitId: without("commit_id"),
      missingSubmittedAt: without("submitted_at"),
      stateList: apiReview({ state: ["COMMENTED"] }),
      stateObject: apiReview({ state: { v: "COMMENTED" } }),
      itemNumber: 5,
      itemString: "commit_id submitted_at",
    };
    const names = Object.keys(cases);
    const out = readReviews(names.map((n) => [cases[n]!]));
    const got = Object.fromEntries(names.map((n, i) => [n, `${outcome(out[i]!)}/${out[i]!.fail?.phase ?? "-"}`]));
    expect(got).toEqual(Object.fromEntries(names.map((n) => [n, "EXECUTION_API/final"])));
  });

  it("a well-formed record still reads (control)", () => {
    const [res] = readReviews([[apiReview()]]);
    expect(outcome(res!)).toBe("PASS");
  });
});
