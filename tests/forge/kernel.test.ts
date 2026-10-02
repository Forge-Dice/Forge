import { describe, expect, it } from "vitest";
import { createForgeKernel } from "../../src/forge/kernel.ts";
import { nodeSha256Utf8 } from "../../src/forge/node-sha256.ts";
import { contractRevisionState, taskState } from "../../src/forge/state.ts";
import {
  AUTHOR,
  ai,
  contractText,
  decide,
  hashOf,
  kernel,
  metadata,
  registerContract,
  registerTask,
  stateOf,
  unfrozenPaths,
} from "./fixtures.ts";

const v1 = contractText(metadata());
const v2 = contractText(metadata({ contractVersion: 2 }));
const [h1, h2] = [hashOf(v1), hashOf(v2)];

const HISTORY = [
  registerTask(),
  registerTask("TASK-0002"),
  registerContract(v1),
  decide(h1, "changes_requested"),
  registerContract(v2),
  decide(h2, "approved"),
];

describe("replay", () => {
  it("equals step-by-step applyEvent", () => {
    let stepwise = kernel.emptyState();
    for (const e of HISTORY) {
      const result = kernel.applyEvent(stepwise, e);
      expect(result.ok).toBe(true);
      if (result.ok) stepwise = result.state;
    }
    const replayed = kernel.replay(HISTORY);
    expect(replayed.ok && replayed.state).toEqual(stepwise);
  });

  it("is deterministic and independent of earlier calls", () => {
    expect(kernel.replay(HISTORY)).toEqual(kernel.replay(HISTORY));
    expect(createForgeKernel({ sha256Utf8: nodeSha256Utf8, policy: { aiReviewIndependence: "different_provider" } }).replay(HISTORY)).toEqual(
      kernel.replay(HISTORY),
    );
  });

  it("stops at the first rejected event and reports its index", () => {
    const result = kernel.replay([...HISTORY.slice(0, 3), registerTask(), ...HISTORY.slice(3)]);
    expect(result.ok).toBe(false);
    expect(!result.ok && [result.index, result.rejection.code]).toEqual([3, "TASK_ALREADY_REGISTERED"]);
  });

  it("logs exactly the accepted events, in order", () => {
    const state = stateOf(HISTORY);
    expect(state.log).toEqual(HISTORY);
    expect(state.log).not.toBe(HISTORY);
  });

  it("replays a long log in linear time", () => {
    const events: unknown[] = [];
    for (let i = 0; i < 2000; i++) events.push(registerTask(`TASK-${String(i).padStart(4, "0")}`));
    const started = performance.now();
    const result = kernel.replay(events);
    expect(result.ok && result.state.tasks.length).toBe(2000);
    expect(performance.now() - started).toBeLessThan(10_000);
  });
});

describe("applyEvent purity", () => {
  it("a rejected event changes nothing", () => {
    const state = stateOf(HISTORY);
    const before = JSON.stringify(state);
    const result = kernel.applyEvent(state, decide(h2, "approved"));
    expect(!result.ok && result.rejection.code).toBe("APPROVAL_ALREADY_DECIDED");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("an accepted event returns a new state and leaves the old one intact", () => {
    const state = stateOf(HISTORY.slice(0, 2));
    const result = kernel.applyEvent(state, registerContract(v1));
    expect(result.ok).toBe(true);
    expect(state.log).toHaveLength(2);
    expect(result.ok && result.state.log).toHaveLength(3);
    expect(taskState(state, "TASK-0001")).toBe("planned");
  });

  it("does not mutate or freeze the input event", () => {
    const input = registerContract(v1);
    const copy = structuredClone(input);
    kernel.applyEvent(stateOf([registerTask()]), input);
    expect(input).toEqual(copy);
    expect(Object.isFrozen(input)).toBe(false);
  });

  it("logs the parsed event, not the caller's object", () => {
    const input = registerTask("TASK-0003");
    const result = kernel.applyEvent(kernel.emptyState(), input);
    expect(result.ok && result.state.log[0]).not.toBe(input);
    (input.body as { title: string }).title = "changed later";
    expect(result.ok && (result.state.log[0]!.body as { title: string }).title).toBe("Task TASK-0003");
  });

  it("states, results and rejections are deeply frozen", () => {
    const state = stateOf(HISTORY);
    expect(unfrozenPaths(state)).toEqual([]);
    expect(unfrozenPaths(kernel.applyEvent(state, registerTask()))).toEqual([]); // rejection
    const accepted = kernel.applyEvent(state, registerTask("TASK-0005"));
    expect(accepted.ok).toBe(true);
    expect(unfrozenPaths(accepted)).toEqual([]); // success path
    expect(unfrozenPaths(kernel.replay([null]))).toEqual([]);
    expect(() => {
      (state.tasks as unknown[]).push({});
    }).toThrow(TypeError);
  });
});

describe("policy binding", () => {
  const lenient = createForgeKernel({ sha256Utf8: nodeSha256Utf8, policy: { aiReviewIndependence: "different_identity" } });
  const sameProviderReview = [registerTask(), registerContract(v1), decide(h1, "approved", { actor: ai("vendor-a", "colleague") })];

  it("the policy decides same-provider AI review", () => {
    expect(kernel.replay(sameProviderReview).ok).toBe(false);
    const result = lenient.replay(sameProviderReview);
    expect(result.ok && contractRevisionState(result.state, "TASK-0001", h1)).toBe("approved");
    expect(AUTHOR.provider).toBe("vendor-a");
  });

  it("a state built under one policy cannot be extended by a kernel with another", () => {
    const result = lenient.applyEvent(stateOf([registerTask()]), registerContract(v1));
    expect(!result.ok && result.rejection.code).toBe("POLICY_MISMATCH");
  });

  it("rejects an invalid policy at kernel creation", () => {
    expect(() => createForgeKernel({ sha256Utf8: nodeSha256Utf8, policy: { aiReviewIndependence: "none" } as never })).toThrow();
  });

  it("the kernel itself is frozen", () => {
    expect(Object.isFrozen(kernel)).toBe(true);
    expect(Object.isFrozen(kernel.policy)).toBe(true);
  });
});

describe("injected hash port", () => {
  it("uses only the injected function for content hashes", () => {
    const fake = createForgeKernel({ sha256Utf8: () => "f".repeat(64), policy: { aiReviewIndependence: "different_provider" } });
    const result = fake.parseContractDocument(v1);
    expect(result.ok && result.document.ref.contentHash).toBe("f".repeat(64));
  });

  it("never hashes malformed text", () => {
    let calls = 0;
    const counting = createForgeKernel({
      sha256Utf8: (text) => {
        calls++;
        return nodeSha256Utf8(text);
      },
      policy: { aiReviewIndependence: "different_provider" },
    });
    counting.parseContractDocument(`${v1}\uD800`);
    counting.parseContractDocument(`﻿${v1}`);
    expect(calls).toBe(0);
  });
});
