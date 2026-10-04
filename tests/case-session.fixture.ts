import { parseCaseTruth } from "../src/domain/case-truth.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import { parseCaseSolution } from "../src/domain/case-solution.ts";
import { hashCaseSolution } from "../src/domain/case-solution.identity.ts";
import type { ResolvedCasePackage } from "../src/domain/case-package.ts";
import { serializeSessionJson, utf8Length } from "../src/domain/case-package.identity.ts";
import { initialSession, reduceSession, type SessionResult, type SessionState } from "../src/domain/case-session.ts";
import { resolved } from "./case-package.fixture.ts";

// MYST-SESSION-0001B fixture on the library case of MYST-SESSION-0001A. The player starts knowing
// Dora, Anna, the library, the killing, the argument and (by name only) the muddy boots.
// Searching the library releases the bloody knife (mentions Ben and the knife) and the muddy boots
// (mentions the garden). The knife itself has no access path although it is the evidence source.

const KILLING = "event:ben-kills-clara";
export const CLAIMS = {
  benResponsible: { kind: "personResponsibleForEvent", personId: "person:ben", eventId: KILLING },
  annaResponsible: { kind: "personResponsibleForEvent", personId: "person:anna", eventId: KILLING },
  nobody: { kind: "noPersonResponsibleForEvent", eventId: KILLING },
  benActor: { kind: "personRoleForEvent", personId: "person:ben", eventId: KILLING, role: "direct_actor" },
  argumentCaused: { kind: "eventCausedEvent", causeEventId: "event:argument", eventId: KILLING },
  intended: { kind: "eventIntent", eventId: KILLING, value: "intended" },
  ordinary: { kind: "eventMechanism", eventId: KILLING, value: "ordinary" },
};

export type Edits = { pkg?: (p: any) => void; solution?: (s: any) => void };

/** Resolved package after optional edits; solution edits are rebound into challenge and snapshots. */
export function sessionPackage(edits: Edits = {}): ResolvedCasePackage {
  return resolved((p) => {
    p.initial.known = [
      { kind: "person", id: "person:dora" },
      { kind: "person", id: "person:anna" },
      { kind: "location", id: "location:library" },
      { kind: "event", id: KILLING },
      { kind: "event", id: "event:argument" },
      { kind: "evidence", id: "evidence:muddy-boots" },
    ];
    p.access.entries = [
      { evidenceId: "evidence:bloody-knife", access: { kind: "discoverable", paths: [{ kind: "search_location", locationId: "location:library" }] } },
      {
        evidenceId: "evidence:muddy-boots",
        access: {
          kind: "discoverable",
          paths: [
            { kind: "search_location", locationId: "location:library" },
            { kind: "examine_person", personId: "person:anna" },
          ],
        },
      },
    ];
    p.presentation.entries[0].mentions = [
      { kind: "item", id: "item:knife" },
      { kind: "person", id: "person:ben" },
    ];
    p.challenge.allowedClaims = Object.values(CLAIMS);
    if (edits.solution !== undefined) {
      edits.solution(p.solution);
      const solutionHash = hashCaseSolution(parseCaseSolution(p.solution, parseCaseTruth(p.truth)));
      p.challenge.solutionHash = solutionHash;
      for (const npc of p.npcs) npc.snapshot.solutionHash = solutionHash;
    }
    edits.pkg?.(p);
  });
}

export const truthHashOf = (pkg: ResolvedCasePackage) => hashCaseTruth(pkg.truth);

/** Player ref of a canonical id ("person:ben"). */
export function refOf(pkg: ResolvedCasePackage, id: string): string {
  const kind = id.slice(0, id.indexOf(":")) as "person" | "location" | "item" | "event" | "evidence";
  const ref = pkg.refs.refFor(kind, id);
  if (ref === null) throw new Error(`no ref for ${id}`);
  return ref;
}

/** Event builders in player terms; ids are canonical and translated with the package refs. */
export function events(pkg: ResolvedCasePackage) {
  const r = (id: string) => refOf(pkg, id);
  return {
    search: (id: string) => ({ type: "investigate", action: "search_location", target: r(id) }),
    examineItem: (id: string) => ({ type: "investigate", action: "examine_item", target: r(id) }),
    examinePerson: (id: string) => ({ type: "investigate", action: "examine_person", target: r(id) }),
    ask: (npc: string, slug: string) => ({ type: "interrogate", npc: r(npc), questionId: `question:${slug}` }),
    accuse: (...literals: [claim: Record<string, string>, value: boolean][]) => ({
      type: "accuse",
      literals: literals.map(([claim, value]) => ({ claim: playerClaim(claim, r), value })),
    }),
  };
}

/** Canonical conclusion claim → player claim (test-side mirror of the transport, by field name). */
export function playerClaim(claim: Record<string, string>, r: (id: string) => string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, value] of Object.entries(claim)) {
    if (field === "personId") out.person = r(value);
    else if (field === "eventId") out.event = r(value);
    else if (field === "causeEventId") out.causeEvent = r(value);
    else out[field] = value;
  }
  return out;
}

/** Applies events in order and fails loudly on the first rejection. */
export function play(pkg: ResolvedCasePackage, inputs: unknown[], from: SessionState = initialSession(pkg)): SessionState {
  return inputs.reduce<SessionState>((state, input, i) => {
    const result = reduceSession(pkg, state, input);
    if (!result.ok) throw new Error(`event ${i} rejected: ${result.code}`);
    return result.state;
  }, from);
}

export function accepted(result: SessionResult) {
  if (!result.ok) throw new Error(`rejected: ${result.code}`);
  return result;
}

/** Full save serialization of contract SC (envelope with dummy checksum) for differential checks. */
export function fullSaveBytes(pkg: ResolvedCasePackage, events: readonly unknown[]): number {
  return utf8Length(serializeSessionJson({ schemaVersion: 1, packageIdentity: pkg.identity, events, checksum: "0".repeat(64) }));
}

export const knownRefs = (state: SessionState) => state.knowledge.known.map((k) => k.ref);
