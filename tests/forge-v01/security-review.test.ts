import { afterAll, describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FixtureRepo, b, outcome, py1, removeTree, tempRoot, type TreeSpec } from "./helpers.ts";

// Independent red tests against claude/project-thread-vmbz7o @ 1b732e620e11724a969077f1aeb0d71c3273dfda.
// Authority: FORGE-BOOTSTRAP-0001A-v2 @ 21200c1b6f8b0235ee34be456193dd79ee4ee4ed.
// PKG means its incorporated r1 package @ bb525bfd230128d3d98f3db744ba23217196c53c,
// raw SHA-256 27bb408d01725e5a56306428470802c62ea7089bbeaa970f0a3594010e0eec89.
// All Git/FS attacks stay in private disposable fixtures. No network, xfail or production edits.

const root = tempRoot("security-review");
afterAll(() => removeTree(root));
let counter = 0;
const MiB = 1024 * 1024;
const REPO_ID = 1401864629;
const API_REPO = "/repos/Forge-Dice/Forge";

function directory(label: string): string {
  const path = join(root, `${label}-${counter++}`);
  mkdirSync(path, { mode: 0o700 });
  return path;
}

function repository(): FixtureRepo {
  return new FixtureRepo(directory("fixture"));
}

function input(base: string, head: string, pr = 7) {
  return {
    action: "synchronize",
    number: pr,
    repository: { id: REPO_ID, full_name: "Forge-Dice/Forge" },
    pull_request: {
      number: pr,
      base: { sha: base, ref: "main", repo: { id: REPO_ID } },
      head: { sha: head, repo: { id: REPO_ID } },
    },
  };
}

function facts(base: string) {
  return { eventName: "pull_request_target", githubSha: base, runId: 4242, runAttempt: 1, actorId: 99 };
}

function answers(base: string, head: string) {
  return {
    [API_REPO]: { id: REPO_ID, full_name: "Forge-Dice/Forge", private: false },
    [`${API_REPO}/pulls/7`]: {
      number: 7, state: "open", draft: false, user: { id: 99 },
      base: { sha: base, ref: "main", repo: { id: REPO_ID } },
      head: { sha: head, repo: { id: REPO_ID } },
    },
    [`${API_REPO}/branches/main`]: { commit: { sha: base } },
    [`${API_REPO}/actions/runs/4242/attempts/1`]: { id: 4242, run_attempt: 1, triggering_actor: { id: 99 } },
  };
}

function bootstrap(repo: FixtureRepo, base: string, head: string, apiAnswers: Record<string, unknown> = answers(base, head)) {
  repo.setRef("refs/heads/main", base);
  repo.setRef("refs/pull/7/head", head);
  return py1("seams.bootstrap_for_test", [
    b(JSON.stringify(input(base, head))), facts(base), directory("workspace"),
    { remote: repo.odb, answers: apiAnswers },
  ]);
}

describe("REVIEW-A-01: refs omitted by Git enumeration", () => {
  // A-v2 §7 REPO_UNSAFE and §8 A1; PKG §2: existing refs/replace, loose or packed,
  // and anything outside the local ref allowlist must be GIT_LAYOUT, never ignored.
  test.each([
    ["broken replace ref", `refs/replace/${"a".repeat(40)}`, "not-an-oid\n"],
    ["dangling replace symref", `refs/replace/${"a".repeat(40)}`, "ref: refs/heads/missing\n"],
    ["broken unexpected ref", "refs/heads/hidden", "not-an-oid\n"],
  ])("REVIEW-A-01 %s must fail with GIT_LAYOUT", (_label, ref, content) => {
    const repo = repository();
    const base = repo.commit(repo.tree({ f: "base" }), []);
    repo.setRef("refs/forge/main", base);
    const path = join(repo.odb, ref!);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, content!);
    expect(existsSync(path)).toBe(true);
    expect(outcome(py1("bootstrap.check_layout", [repo.odb, repo.private, { $set: ["refs/forge/main"] }]))).toBe("GIT_LAYOUT");
  });
});

describe("REVIEW-A-02: empty tree entries must participate in the path trie", () => {
  // A-v2 §2.1 Paths; PKG §3 collectTree: ALL directories and leaves enter the trie,
  // including empty directories. Case/prefix collisions must be GIT_COLLISION.
  const attacks: [string, TreeSpec][] = [
    ["two empty directories differing only by case", { Dir: {}, dir: {} }],
    ["empty directory colliding with a populated directory", { Dir: {}, dir: { f: "payload" } }],
    ["empty directory colliding with a leaf", { A: {}, a: "payload" }],
  ];
  test.each(attacks)("REVIEW-A-02 %s must fail with GIT_COLLISION", (_label, spec) => {
    const repo = repository();
    const tree = repo.tree(spec);
    // A real, correctly hashed Git tree; this exercises collectTree, not validatePathSet
    // with a manufactured leaf-only input that has already lost the empty directories.
    expect(outcome(py1("objects.read_tree", [repo.store(), tree]))).toBe("PASS");
    expect(outcome(py1("objects.collect_tree", [repo.store(), tree]))).toBe("GIT_COLLISION");
  });
});

describe("REVIEW-A-03/04: symlinks above the materialized root", () => {
  // A-v2 §2 safe materialization/cleanup and retained Acceptance; PKG §5:
  // every parent uses dir_fd/O_NOFOLLOW; symlinks yield EXECUTION_IO, with no escape.
  test.each(["destination", "ancestor"] as const)(
    "REVIEW-A-03 symlink at %s must not create files outside the destination",
    (position) => {
      const repo = repository();
      const tree = repo.tree({ "payload.txt": "must stay inside the private root" });
      const outside = directory("outside");
      const link = join(directory("parent"), "alias");
      symlinkSync(outside, link, "dir");
      if (position === "ancestor") mkdirSync(join(outside, "destination"));
      const destination = position === "destination" ? link : join(link, "destination");
      const before = position === "destination" ? [] : ["destination"];
      const response = py1("materialize.materialize_tree", [repo.store(), tree, destination]);
      expect({ code: outcome(response), outside: readdirSync(outside), nested: position === "ancestor" ? readdirSync(join(outside, "destination")) : [] })
        .toEqual({ code: "EXECUTION_IO", outside: before, nested: [] });
    },
  );

  test("REVIEW-A-04 destroy must not delete through an ancestor symlink", () => {
    const outside = directory("outside-destroy");
    const victim = join(outside, "victim");
    mkdirSync(victim);
    const survivor = join(victim, "survivor.txt");
    writeFileSync(survivor, "must survive");
    const alias = join(directory("cleanup-parent"), "alias");
    symlinkSync(outside, alias, "dir");
    const response = py1("materialize.destroy", [join(alias, "victim")]);
    expect({ code: outcome(response), survivor: existsSync(survivor) })
      .toEqual({ code: "EXECUTION_IO", survivor: true });
  });
});

describe("REVIEW-A-05: acquisition must enforce per-object size limits", () => {
  // A-v2 §3 retains the PKG §2 type limits; PKG §13 AV-016 promises GIT_LIMIT
  // during bootstrap for an 8 MiB + 1 blob, even when the total ODB stays <512 MiB.
  test.each(["blob", "commit"] as const)("REVIEW-A-05 oversized %s must fail before trusted bootstrap returns", (kind) => {
    const repo = repository();
    const base = repo.commit(repo.tree({ f: "base" }), []);
    const tree = repo.tree({ f: kind === "blob" ? { mode: "100644", oid: repo.blob(Buffer.alloc(8 * MiB + 1, 0x61)) } : "head" });
    const head = repo.commit(tree, [base], kind === "commit" ? "m".repeat(MiB) : "head");
    // Valid objects and exactly one HEAD parent; only the individual type cap is exceeded.
    expect(outcome(bootstrap(repo, base, head))).toBe("GIT_LIMIT");
  });
});

describe("REVIEW-A-06/07: framed channel bounds and child failure", () => {
  // A-v2 §3 channels 2/3, precedence step 2, AV-179b/c: reject the declared size
  // before ANY payload byte is read. A safe GIT_LIMIT code alone does not prove this.
  test.each(["type", "cumulative"] as const)("REVIEW-A-06 %s overflow must be rejected without reading content", (limit) => {
    const repo = repository();
    repo.blob("bounded payload");
    const response = py1("review_probes.read_ahead", [repo.odb, repo.private, limit]);
    expect(outcome(response)).toBe("PASS"); // the probe itself must run successfully
    expect(response.ok).toEqual({ outcome: "GIT_LIMIT", payloadBytesRead: 0 });
  });

  // PKG §2: unexpected child exit codes/signals/missing data are FAIL. A complete
  // frame with the correct SHA-1 cannot turn an already observed exit 23 into success.
  test("REVIEW-A-07 nonzero batch exit must not be swallowed after a valid frame", () => {
    const repo = repository();
    repo.blob("valid bytes before transport failure");
    const response = py1("review_probes.batch_failure", [repo.odb, repo.private]);
    expect(outcome(response)).toBe("PASS");
    expect(response.ok).toMatchObject({ accepted: false, returncode: 23 });
  });
});

describe("REVIEW-A-08: manifest import restrictions include JS and TS", () => {
  // A-v2 §5/AV-185: an unlisted import is POLICY_INVALID. PKG §2 explicitly
  // includes the four BASE TypeScript parser modules in this import graph.
  test.each([
    ["tools/forge_v01/bridge.mjs", 'import "/tmp/not-in-manifest.mjs";\n'],
    ["src/forge/contract-document.ts", 'import "../../not-in-manifest.ts";\n'],
  ])("REVIEW-A-08 unlisted import in %s must fail with POLICY_INVALID", (path, source) => {
    const repo = repository();
    const sources: Record<string, string> = { "tools/forge_v01/main.py": 'print("harmless BASE entry")\n', [path!]: source! };
    const manifest = JSON.stringify({ format: 1, files: Object.entries(sources).map(([p, text]) => ({ path: p, sha256: createHash("sha256").update(text).digest("hex") })) });
    const spec: TreeSpec = { forge: { verifier: { "bootstrap-manifest.json": manifest } } };
    for (const [p, text] of Object.entries(sources)) {
      const parts = p.split("/");
      let node = spec;
      for (const dir of parts.slice(0, -1)) node = (node[dir] ??= {}) as TreeSpec;
      node[parts.at(-1)!] = text;
    }
    const base = repo.commit(repo.tree(spec), []);
    // Real BASE blobs, exact manifest SHA-256s, allowed paths/modes. The only bad
    // datum is the literal unlisted import. Do not execute the unlisted source.
    expect(outcome(py1("review_probes.load_graph", [repo.store(), base, directory("trusted-source")]))).toBe("POLICY_INVALID");
  });
});

describe("REVIEW-A-09: Boolean/integer equality must not weaken ID token types", () => {
  // A-v2 §6 AV-004 and PKG §2 strict control fields: IDs must be positive JSON
  // integer number tokens. Python's True == 1 does not authorize a Boolean token.
  test("REVIEW-A-09 Boolean top-level PR number must fail with PR_INPUT", () => {
    const base = "a".repeat(40), head = "b".repeat(40);
    const event = { ...input(base, head, 1), number: true };
    expect(outcome(py1("bootstrap.parse_event", [b(JSON.stringify(event)), facts(base)]))).toBe("PR_INPUT");
  });

  test("REVIEW-A-09 Boolean live run_attempt must fail with EXECUTION_API", () => {
    const repo = repository();
    const base = repo.commit(repo.tree({ f: "base" }), []);
    const head = repo.commit(repo.tree({ f: "head" }), [base]);
    const api = { ...answers(base, head), [`${API_REPO}/actions/runs/4242/attempts/1`]: { id: 4242, run_attempt: true, triggering_actor: { id: 99 } } };
    expect(outcome(bootstrap(repo, base, head, api))).toBe("EXECUTION_API");
  });
});

// A-v2 §5 and incorporated PKG §2: the closed BASE manifest schema has numeric
// format=1. JSON true is a different token, even though Python compares it equal to 1.
test("REVIEW-A-10 Boolean manifest format must fail with POLICY_INVALID", () => {
  const manifest = {
    format: true,
    files: [{ path: "tools/forge_v01/main.py", sha256: createHash("sha256").update('print("harmless")\n').digest("hex") }],
  };
  expect(outcome(py1("stage0.parse_manifest", [b(JSON.stringify(manifest))]))).toBe("POLICY_INVALID");
});

// A-v2 §2 trusted acquisition, incorporated PKG §2 step 3: check the ODB layout
// BEFORE and after each fetch. Post-fetch rejection does not meet the preflight rule.
test("REVIEW-A-11 forbidden layout must block fetch before a ref is written", () => {
  const remote = repository();
  const base = remote.commit(remote.tree({ f: "base" }), []);
  remote.setRef("refs/heads/main", base);
  const receiver = repository();
  const grafts = join(receiver.odb, "info", "grafts");
  mkdirSync(join(grafts, ".."), { recursive: true });
  writeFileSync(grafts, "");
  const target = join(receiver.odb, "refs", "forge", "main");
  expect(existsSync(target)).toBe(false);
  const response = py1("review_probes.fetch_into", [receiver.odb, receiver.private, remote.odb, base]);
  expect({ code: outcome(response), targetRefCreated: existsSync(target) })
    .toEqual({ code: "GIT_LAYOUT", targetRefCreated: false });
});
