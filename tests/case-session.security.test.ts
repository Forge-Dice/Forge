import { afterEach, describe, expect, it, vi } from "vitest";
import { SESSION_LIMITS, initialSession, reduceSession, replaySession, type SessionState } from "../src/domain/case-session.ts";
import type { ResolvedCasePackage } from "../src/domain/case-package.ts";
import { CLAIMS, accepted, events, fullSaveBytes, play, refOf, sessionPackage } from "./case-session.fixture.ts";

// Port spies: every gameplay port is the real implementation unless a test overrides one call.
const ports = vi.hoisted(() => ({ override: new Map<string, (...args: any[]) => unknown>(), calls: [] as string[] }));
function spied<T extends (...args: any[]) => any>(name: string, real: T): T {
  return ((...args: any[]) => {
    ports.calls.push(name);
    const override = ports.override.get(name);
    return override === undefined ? real(...args) : override(real, ...args);
  }) as T;
}
vi.mock("../src/domain/evidence-access.ts", async (load) => {
  const real: any = await load();
  return { ...real, resolveInvestigation: spied("resolveInvestigation", real.resolveInvestigation) };
});
vi.mock("../src/domain/evidence-presentation.ts", async (load) => {
  const real: any = await load();
  return { ...real, releaseEvidence: spied("releaseEvidence", real.releaseEvidence) };
});
vi.mock("../src/domain/interrogation.ts", async (load) => {
  const real: any = await load();
  return { ...real, interrogate: spied("interrogate", real.interrogate) };
});
vi.mock("../src/domain/case-accusation.ts", async (load) => {
  const real: any = await load();
  return { ...real, parseAccusation: spied("parseAccusation", real.parseAccusation) };
});
vi.mock("../src/domain/accusation-challenge.ts", async (load) => {
  const real: any = await load();
  return { ...real, evaluateChallengeAccusation: spied("evaluateChallengeAccusation", real.evaluateChallengeAccusation) };
});

afterEach(() => {
  ports.override.clear();
  ports.calls.length = 0;
});

const pkg = sessionPackage();
const e = events(pkg);
const r = (id: string) => refOf(pkg, id);
const start = initialSession(pkg);
const explored = play(pkg, [e.search("location:library")]);

function rejected(state: SessionState, input: unknown, code: string, using: ResolvedCasePackage = pkg) {
  const result = reduceSession(using, state, input);
  expect(result).toEqual({ ok: false, state, code });
  expect(result.state).toBe(state);
}

/** Same package object with one field swapped (trusted host bug simulation). */
const tampered = (patch: Partial<Record<keyof ResolvedCasePackage, unknown>>) => ({ ...pkg, ...patch }) as ResolvedCasePackage;

describe("release failures roll back completely", () => {
  it("B08 a failing second release is HOST_FAILURE with no discovery or Known committed", () => {
    let n = 0;
    ports.override.set("releaseEvidence", (real, ...args) => (++n === 2 ? { success: false, code: "REF_UNAVAILABLE" } : real(...args)));
    rejected(start, e.search("location:library"), "HOST_FAILURE");
    expect(n).toBe(2);
    ports.override.clear();
    // The same action still works afterwards and finds both: nothing of the failed attempt stuck.
    const result = accepted(reduceSession(pkg, start, e.search("location:library")));
    expect((result.output as any).observations).toHaveLength(2);
    expect(result.state.events).toHaveLength(1);
  });

  it("B08 a release for a different evidence than requested is HOST_FAILURE", () => {
    ports.override.set("releaseEvidence", (real, presentation, _id, refs) => real(presentation, "evidence:bloody-knife", refs));
    rejected(start, e.examinePerson("person:anna"), "HOST_FAILURE");
  });

  it("B11 a report claim with a ref outside the allowed mentions is HOST_FAILURE, Known is not widened", () => {
    const report = { claim: { kind: "personAt", person: r("person:clara"), location: r("location:garden"), at: 300 }, stance: "affirms", source: { kind: "observation" } };
    ports.override.set("releaseEvidence", (real, ...args) => {
      const result: any = real(...args);
      return { ...result, observation: { ...result.observation, reports: [report] } };
    });
    rejected(start, e.examinePerson("person:anna"), "HOST_FAILURE");
    // The garden is a released mention there, Clara is not.
    const allowed = { ...report, claim: { ...report.claim, person: r("person:anna") } };
    ports.override.set("releaseEvidence", (real, ...args) => {
      const result: any = real(...args);
      return { ...result, observation: { ...result.observation, reports: [allowed] } };
    });
    const ok = accepted(reduceSession(pkg, start, e.examinePerson("person:anna")));
    expect(ok.state.knowledge.known.some((k) => k.ref === r("person:clara"))).toBe(false);
  });

  it("a released mention of the wrong kind or an unresolvable ref is HOST_FAILURE", () => {
    for (const mention of [{ kind: "item", ref: r("location:garden") }, { kind: "location", ref: "pr1_0000000000000000" }]) {
      ports.override.set("releaseEvidence", (real, ...args) => {
        const result: any = real(...args);
        return { ...result, observation: { ...result.observation, mentions: [mention] } };
      });
      rejected(start, e.examinePerson("person:anna"), "HOST_FAILURE");
    }
  });

  it("an NPC statement ref outside its mentions is HOST_FAILURE", () => {
    ports.override.set("interrogate", (real, ...args) => {
      const result: any = real(...args);
      return { ...result, observation: { ...result.observation, mentions: result.observation.mentions.slice(1) } };
    });
    rejected(explored, e.ask("person:dora", "where-was-ben"), "HOST_FAILURE");
  });

  it("a port that throws is HOST_FAILURE, never a verdict", () => {
    ports.override.set("evaluateChallengeAccusation", () => {
      throw new Error("host bug");
    });
    rejected(explored, e.accuse([CLAIMS.benResponsible, true]), "HOST_FAILURE");
  });

  it("technical challenge errors are HOST_FAILURE, not not_solved", () => {
    ports.override.set("evaluateChallengeAccusation", () => ({ success: false, code: "CHALLENGE_BINDING_MISMATCH" }));
    rejected(explored, e.accuse([CLAIMS.benResponsible, false]), "HOST_FAILURE");
  });

  it("binding and ref errors of interrogate are HOST_FAILURE; QUESTION_NOT_AVAILABLE is the player error", () => {
    for (const [code, expected] of [["BINDING_MISMATCH", "HOST_FAILURE"], ["REF_UNAVAILABLE", "HOST_FAILURE"], ["QUESTION_NOT_AVAILABLE", "ACTION_UNAVAILABLE"]]) {
      ports.override.set("interrogate", () => ({ success: false, code }));
      rejected(explored, e.ask("person:dora", "where-was-ben"), expected!);
    }
  });

  it("a Known entry the package cannot resolve is HOST_FAILURE", () => {
    const refs = { ...pkg.refs, resolve: (ref: string) => (ref === r("person:dora") ? null : pkg.refs.resolve(ref)) };
    rejected(start, e.examinePerson("person:anna"), "HOST_FAILURE", tampered({ refs }));
  });
});

describe("authorization never comes from the player", () => {
  it("accusations are bound to the package truth hash, never to client fields", () => {
    ports.override.set("parseAccusation", (real, input, truth) => {
      expect(input).toEqual({ schemaVersion: 1, caseId: pkg.truth.caseId, truthHash: pkg.refs.truthHash, literals: [{ claim: CLAIMS.benResponsible, value: false }] });
      return real(input, truth);
    });
    accepted(reduceSession(pkg, explored, e.accuse([CLAIMS.benResponsible, false])));
    expect(ports.calls).toContain("parseAccusation");
    rejected(explored, { ...e.accuse([CLAIMS.benResponsible, true]), truthHash: pkg.refs.truthHash }, "ACTION_UNAVAILABLE");
    rejected(explored, { ...e.accuse([CLAIMS.benResponsible, true]), caseId: pkg.truth.caseId }, "ACTION_UNAVAILABLE");
  });

  it("rejections before the ports call no port", () => {
    for (const input of [
      e.search("location:garden"),
      e.ask("person:clara", "where-was-ben"),
      e.accuse([CLAIMS.benResponsible, true]),
      { type: "investigate", action: "search_location", target: "location:library" },
    ]) {
      rejected(start, input, "ACTION_UNAVAILABLE");
    }
    expect(ports.calls).toEqual([]);
  });

  it("B35 a solved session calls no port for any input", () => {
    const solved = play(pkg, [e.search("location:library"), e.accuse([CLAIMS.benResponsible, true])]);
    ports.calls.length = 0;
    const refs = { ...pkg.refs, resolve: vi.fn(pkg.refs.resolve), refFor: vi.fn(pkg.refs.refFor) };
    for (const input of [e.search("location:library"), e.ask("person:dora", "where-was-ben"), e.accuse(), "garbage"]) {
      rejected(solved, input, "SESSION_CLOSED", tampered({ refs }));
    }
    expect(ports.calls).toEqual([]);
    expect(refs.resolve).not.toHaveBeenCalled();
    expect(refs.refFor).not.toHaveBeenCalled();
  });

  it("non-JSON inputs are unavailable, not thrown", () => {
    const cyclic: any = { type: "accuse", literals: [] };
    cyclic.self = cyclic;
    const getter = Object.defineProperty({ type: "investigate", action: "search_location" }, "target", { get: () => r("location:library"), enumerable: true });
    for (const input of [cyclic, getter, undefined, () => 1, 10n, Object.create({ type: "accuse", literals: [] })]) {
      rejected(start, input, "ACTION_UNAVAILABLE");
    }
  });
});

describe("prospective save bytes", () => {
  // 32 distinct literals, all within known refs, never solving (Ben not responsible).
  const persons = ["person:dora", "person:anna", "person:ben"];
  const roles = ["direct_actor", "planner", "facilitator"];
  const big = (() => {
    const literals: [Record<string, string>, boolean][] = [[CLAIMS.benResponsible, false]];
    for (const eventId of ["event:ben-kills-clara", "event:argument"]) {
      for (const personId of persons) {
        if (!(personId === "person:ben" && eventId === "event:ben-kills-clara")) {
          literals.push([{ kind: "personResponsibleForEvent", personId, eventId }, false]);
        }
        for (const role of roles) literals.push([{ kind: "personRoleForEvent", personId, eventId, role }, false]);
      }
      for (const value of ["intended", "unintended", "not_applicable"]) literals.push([{ kind: "eventIntent", eventId, value }, false]);
      for (const value of ["ordinary", "supernatural", "mixed"]) literals.push([{ kind: "eventMechanism", eventId, value }, false]);
    }
    return e.accuse(...literals.slice(0, SESSION_LIMITS.maxLiterals));
  })();

  it("B39 rejects with LIMIT_REACHED exactly when the full save would exceed 1 MiB (differential)", () => {
    expect(big.literals).toHaveLength(32);
    let state = explored;
    let decisions = 0;
    const small = e.examinePerson("person:dora");
    for (const candidate of [big, small]) {
      for (;;) {
        const prospective = fullSaveBytes(pkg, [...state.events, candidate]);
        const result = reduceSession(pkg, state, candidate);
        decisions++;
        expect(result.ok, `at ${state.events.length} events`).toBe(prospective <= SESSION_LIMITS.maxSaveBytes);
        if (!result.ok) {
          expect(result).toEqual({ ok: false, state, code: "LIMIT_REACHED" });
          break;
        }
        state = result.state;
      }
    }
    expect(state.events.length).toBeLessThan(SESSION_LIMITS.maxEvents);
    expect(fullSaveBytes(pkg, state.events)).toBeLessThanOrEqual(SESSION_LIMITS.maxSaveBytes);
    expect(fullSaveBytes(pkg, [...state.events, small])).toBeGreaterThan(SESSION_LIMITS.maxSaveBytes);
    expect(decisions).toBeGreaterThan(200);
    // Replay of a log over the save budget is LIMIT_REACHED before any evaluation.
    ports.calls.length = 0;
    expect(replaySession(pkg, [...state.events, small])).toEqual({ ok: false, code: "LIMIT_REACHED", eventIndex: null });
    expect(ports.calls).toEqual([]);
    expect(replaySession(pkg, state.events)).toEqual({ ok: true, state });
  }, 60_000);
});
