import { describe, expect, it } from "vitest";
import { parseCaseTruth } from "../src/domain/case-truth.ts";
import { initialSession, reduceSession, replaySession } from "../src/domain/case-session.ts";
import { resolved } from "./case-package.fixture.ts";
import { annaInput } from "./interrogation.fixture.ts";

// Seams between the mystery modules (package, refs, release, interrogation, session, accusation)
// that the per-contract suites do not cross. Each case was red before its fix.

describe("package -> session -> interrogation", () => {
  it("an NPC snapshot bound without a solution (solutionHash null) stays interrogable", () => {
    const pkg = resolved((p) => {
      p.npcs[1].snapshot = annaInput(parseCaseTruth(p.truth), null);
      p.initial.known.push({ kind: "person", id: "person:ben" });
    });
    expect(pkg.npcs[1]!.snapshot.solutionHash).toBeNull();
    const anna = pkg.refs.refFor("person", "person:anna")!;
    const result = reduceSession(pkg, initialSession(pkg), { type: "interrogate", npc: anna, questionId: "question:ben-in-library" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.output).toMatchObject({ type: "interrogate", observation: { act: "answer", stance: "affirms" } });
  });
});

describe("session input boundary", () => {
  const pkg = resolved();
  const start = initialSession(pkg);

  it("null as an event is a player error, not a host failure", () => {
    expect(reduceSession(pkg, start, null)).toEqual({ ok: false, state: start, code: "ACTION_UNAVAILABLE" });
  });

  it("a history containing null is an invalid history, not a host failure", () => {
    expect(replaySession(pkg, [null])).toEqual({ ok: false, code: "INVALID_HISTORY", eventIndex: 0 });
  });
});
