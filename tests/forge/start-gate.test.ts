import { describe, expect, it } from "vitest";
import { canStartDeveloperRun } from "../../src/forge/start-gate.ts";
import {
  SHA,
  approvedWorld,
  contractText,
  decide,
  hashOf,
  linearGraph,
  metadata,
  observation,
  registerContract,
  registerTask,
  stateOf,
  unfrozenPaths,
} from "./fixtures.ts";

const reasonsOf = (decision: ReturnType<typeof canStartDeveloperRun>) =>
  decision.allowed ? [] : decision.reasons.map((r) => (r.subject === null ? r.code : `${r.code}:${r.subject}`));

describe("allowed start", () => {
  it("starts from the contract commit", () => {
    const { state, contentHash } = approvedWorld();
    expect(canStartDeveloperRun(state, { taskId: "TASK-0001", contentHash, repoObservation: observation(contentHash) })).toEqual({
      allowed: true,
      startFromCommit: SHA.contract,
    });
  });

  it("allows base == contract commit (contract committed together with base)", () => {
    const { state, contentHash } = approvedWorld(metadata({ baseCommit: SHA.contract }));
    expect(canStartDeveloperRun(state, { taskId: "TASK-0001", contentHash, repoObservation: observation(contentHash) }).allowed).toBe(true);
  });

  it("allows dependencies that are ancestors of base when the contract is approved (not reachable in 0001A, see state tests)", () => {
    // In 0001A no contract with dependencies can be approved, so this documents the G1 rule on the reason level only.
    const text = contractText(metadata({ dependencies: [{ taskId: "TASK-0002", acceptedCommit: SHA.dep }] }));
    const state = stateOf([registerTask(), registerContract(text)]);
    const decision = canStartDeveloperRun(state, { taskId: "TASK-0001", contentHash: hashOf(text), repoObservation: observation(hashOf(text)) });
    expect(reasonsOf(decision)).toEqual(["CONTRACT_NOT_APPROVED", "TASK_NOT_STARTABLE:specifying"]);
  });
});

describe("single block reasons", () => {
  const { state, contentHash } = approvedWorld();
  const request = (obs: object, overrides: object = {}) => ({ taskId: "TASK-0001", contentHash, repoObservation: obs, ...overrides });

  it.each<[string, object, string[]]>([
    ["contract file at another commit", observation(contentHash, { contractAtCommit: { commit: SHA.head, path: "forge/contracts/TASK-0001.md", contentHash } }), ["CONTRACT_FILE_MISMATCH"]],
    ["contract file at another path", observation(contentHash, { contractAtCommit: { commit: SHA.contract, path: "forge/contracts/X.md", contentHash } }), ["CONTRACT_FILE_MISMATCH"]],
    ["contract file with other content (truncated in git)", observation(contentHash, { contractAtCommit: { commit: SHA.contract, path: "forge/contracts/TASK-0001.md", contentHash: "0".repeat(64) } }), ["CONTRACT_FILE_MISMATCH"]],
    [
      "contract commit only local (403 push)",
      observation(contentHash, { refs: { "claude/branch": SHA.base } }),
      ["CONTRACT_NOT_PERSISTED"],
    ],
    [
      "base commit not reachable from any ref",
      observation(contentHash, { refs: { "claude/branch": SHA.side }, parents: { [SHA.side]: [SHA.contract], [SHA.contract]: [] } }),
      ["BASE_COMMIT_NOT_PERSISTED", "BASE_NOT_IN_CONTRACT_HISTORY"],
    ],
    [
      "base persisted on another branch but not in the contract's history",
      observation(contentHash, { refs: { a: SHA.contract, b: SHA.base }, parents: { [SHA.contract]: [SHA.other] } }),
      ["BASE_NOT_IN_CONTRACT_HISTORY"],
    ],
  ])("%s", (_name, obs, expected) => {
    expect(reasonsOf(canStartDeveloperRun(state, request(obs)))).toEqual(expected);
  });

  it("missing edges fail closed: no edge from head to contract means not persisted", () => {
    const { [SHA.head]: _dropped, ...graph } = linearGraph();
    expect(reasonsOf(canStartDeveloperRun(state, request(observation(contentHash, { parents: graph }))))).toEqual([
      "BASE_COMMIT_NOT_PERSISTED",
      "CONTRACT_NOT_PERSISTED",
    ]);
  });

  it("missing edge between contract and base fails closed", () => {
    const { [SHA.contract]: _dropped, ...graph } = linearGraph();
    expect(reasonsOf(canStartDeveloperRun(state, request(observation(contentHash, { parents: graph }))))).toEqual([
      "BASE_COMMIT_NOT_PERSISTED",
      "BASE_NOT_IN_CONTRACT_HISTORY",
    ]);
  });

  it("empty refs block everything repo-related", () => {
    expect(reasonsOf(canStartDeveloperRun(state, request(observation(contentHash, { refs: {} }))))).toEqual([
      "BASE_COMMIT_NOT_PERSISTED",
      "CONTRACT_NOT_PERSISTED",
    ]);
  });

  it("the task id is not derived from ref names", () => {
    const refs = { "forge/task-0002-something": SHA.head };
    expect(canStartDeveloperRun(state, request(observation(contentHash, { refs }))).allowed).toBe(true);
  });
});

describe("log-based reasons", () => {
  const v1 = contractText(metadata());
  const v2 = contractText(metadata({ contractVersion: 2 }));
  const [h1, h2] = [hashOf(v1), hashOf(v2)];
  const req = (contentHash: string, taskId = "TASK-0001") => ({ taskId, contentHash, repoObservation: observation(contentHash) });

  it.each<[string, unknown[], object, string[]]>([
    ["unknown task", [], req(h1), ["TASK_UNKNOWN"]],
    ["planned task", [registerTask()], req(h1), ["CONTRACT_UNKNOWN", "TASK_NOT_STARTABLE:planned"]],
    ["draft contract", [registerTask(), registerContract(v1)], req(h1), ["CONTRACT_NOT_APPROVED", "TASK_NOT_STARTABLE:specifying"]],
    ["changes requested", [registerTask(), registerContract(v1), decide(h1, "changes_requested")], req(h1), ["CONTRACT_NOT_APPROVED", "TASK_NOT_STARTABLE:specifying"]],
    [
      "approved but superseded by a draft",
      [registerTask(), registerContract(v1), decide(h1, "approved"), registerContract(v2, { commit: SHA.head })],
      req(h1),
      ["CONTRACT_NOT_CURRENT", "TASK_NOT_STARTABLE:specifying"],
    ],
    [
      "old approved hash while the new version is approved",
      [registerTask(), registerContract(v1), decide(h1, "approved"), registerContract(v2), decide(h2, "approved")],
      req(h1),
      ["CONTRACT_NOT_CURRENT"],
    ],
    ["unknown hash on a ready task", [registerTask(), registerContract(v1), decide(h1, "approved")], req("0".repeat(64)), ["CONTRACT_UNKNOWN"]],
  ])("%s", (_name, events, request, expected) => {
    expect(reasonsOf(canStartDeveloperRun(stateOf(events), request))).toEqual(expected);
  });

  it("the new approved version can start", () => {
    const state = stateOf([registerTask(), registerContract(v1), decide(h1, "approved"), registerContract(v2), decide(h2, "approved")]);
    expect(canStartDeveloperRun(state, req(h2)).allowed).toBe(true);
  });
});

describe("combined reasons, sorting and determinism", () => {
  it("reports every applicable reason sorted by code then subject", () => {
    const text = contractText(
      metadata({
        dependencies: [
          { taskId: "TASK-0003", acceptedCommit: SHA.side },
          { taskId: "TASK-0002", acceptedCommit: SHA.other },
          { taskId: "TASK-0004", acceptedCommit: null },
        ],
      }),
    );
    const contentHash = hashOf(text);
    const state = stateOf([registerTask(), registerContract(text)]);
    const decision = canStartDeveloperRun(state, {
      taskId: "TASK-0001",
      contentHash,
      repoObservation: { refs: {}, parents: {}, contractAtCommit: { commit: SHA.head, path: "x.md", contentHash } },
    });
    expect(reasonsOf(decision)).toEqual([
      "BASE_COMMIT_NOT_PERSISTED",
      "BASE_NOT_IN_CONTRACT_HISTORY",
      "CONTRACT_FILE_MISMATCH",
      "CONTRACT_NOT_APPROVED",
      "CONTRACT_NOT_PERSISTED",
      "DEPENDENCY_NOT_IN_BASE:TASK-0002",
      "DEPENDENCY_NOT_IN_BASE:TASK-0003",
      "TASK_NOT_STARTABLE:specifying",
    ]);
  });

  it("dependency in base passes G1 while one outside fails", () => {
    const text = contractText(
      metadata({ dependencies: [{ taskId: "TASK-0002", acceptedCommit: SHA.dep }, { taskId: "TASK-0003", acceptedCommit: SHA.side }] }),
    );
    const state = stateOf([registerTask(), registerContract(text)]);
    const decision = canStartDeveloperRun(state, { taskId: "TASK-0001", contentHash: hashOf(text), repoObservation: observation(hashOf(text)) });
    expect(reasonsOf(decision)).toContain("DEPENDENCY_NOT_IN_BASE:TASK-0003");
    expect(reasonsOf(decision)).not.toContain("DEPENDENCY_NOT_IN_BASE:TASK-0002");
  });

  it("key order of refs and parents does not change the decision", () => {
    const { state, contentHash } = approvedWorld();
    const obs = observation(contentHash, { refs: { z: SHA.side, a: SHA.head, m: SHA.other } });
    const reversed = {
      ...obs,
      refs: Object.fromEntries(Object.entries(obs.refs).reverse()),
      parents: Object.fromEntries(Object.entries(obs.parents as Record<string, string[]>).reverse()),
    };
    const a = canStartDeveloperRun(state, { taskId: "TASK-0001", contentHash, repoObservation: obs });
    const b = canStartDeveloperRun(state, { taskId: "TASK-0001", contentHash, repoObservation: reversed });
    expect(b).toEqual(a);
    expect(a.allowed).toBe(true);
  });

  it("decisions are frozen and inputs untouched", () => {
    const { state, contentHash } = approvedWorld();
    const request = { taskId: "TASK-0001", contentHash, repoObservation: observation(contentHash, { refs: {} }) };
    const before = JSON.stringify(request);
    const decision = canStartDeveloperRun(state, request);
    expect(unfrozenPaths(decision)).toEqual([]);
    expect(JSON.stringify(request)).toBe(before);
    expect(Object.isFrozen(request)).toBe(false);
  });
});

describe("request validation", () => {
  const { state, contentHash } = approvedWorld();

  it.each<[string, unknown]>([
    ["null", null],
    ["missing observation", { taskId: "TASK-0001", contentHash }],
    ["extra field", { taskId: "TASK-0001", contentHash, repoObservation: observation(contentHash), force: true }],
    ["short SHA in refs", { taskId: "TASK-0001", contentHash, repoObservation: observation(contentHash, { refs: { main: "abc" } }) }],
    ["bad ref name", { taskId: "TASK-0001", contentHash, repoObservation: observation(contentHash, { refs: { "a..b": SHA.head } }) }],
    ["prototype key in parents", { taskId: "TASK-0001", contentHash, repoObservation: { ...observation(contentHash), parents: JSON.parse('{"__proto__": []}') } }],
    ["prototype key in refs", { taskId: "TASK-0001", contentHash, repoObservation: { ...observation(contentHash), refs: JSON.parse(`{"__proto__": "${SHA.head}"}`) } }],
    ["uppercase content hash", { taskId: "TASK-0001", contentHash: contentHash.toUpperCase(), repoObservation: observation(contentHash) }],
  ])("%s → REQUEST_INVALID only", (_name, request) => {
    expect(reasonsOf(canStartDeveloperRun(state, request))).toEqual(["REQUEST_INVALID"]);
  });
});
