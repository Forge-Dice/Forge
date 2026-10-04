import { createHash } from "node:crypto";
import type { CaseSolution } from "../src/domain/case-solution.ts";
import type { CaseTruth } from "../src/domain/case-truth.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import { parseNpcKnowledge, type NpcKnowledgeSnapshot } from "../src/domain/npc-knowledge.ts";
import {
  parseInterrogationProfile,
  parseQuestionCatalogue,
  type EntityRef,
  type QuestionCatalogue,
} from "../src/domain/interrogation-authoring.ts";
import { hashQuestionCatalogue } from "../src/domain/interrogation-authoring.identity.ts";
import { interrogate, type InterrogationInput, type PlayerRefTranslator } from "../src/domain/interrogation.ts";
import {
  aware,
  belief,
  conclusionAttitude,
  knowledge,
  npcInput,
  propositionAttitude,
  uncertain,
  world,
  type World,
} from "./npc-knowledge.fixture.ts";
import { catalogueInput, profileInput } from "./interrogation-authoring.fixture.ts";

// MYST-0005B fixture (contract §3). Truth/solution from the NPC knowledge fixture, catalogue and
// Dora's profile from the MYST-0005A fixture. Factories return fresh mutable inputs.

/** Test double for the PlayerRef port; node:crypto only lives here. */
export function fakeRefs(truth: CaseTruth): PlayerRefTranslator {
  return {
    caseId: truth.caseId,
    truthHash: hashCaseTruth(truth),
    refFor: (kind, id) => "pr1_" + createHash("sha256").update(`${kind}\n${id}`).digest("hex").slice(0, 16),
  };
}

/** Expected PlayerRef of an entity; never written as a literal in tests. */
export const pr = (kind: EntityRef["kind"], id: string): string =>
  fakeRefs(world().truth).refFor(kind, `${kind}:${id}`)!;

export const QUESTIONS: string[] = catalogueInput().questions.map((q: any) => q.id as string);

export function doraInput(truth: CaseTruth, solution: CaseSolution | null): any {
  return npcInput(truth, solution, (n) => {
    n.npcId = "person:dora";
    n.awareness = [
      aware("person", "anna"),
      aware("person", "ben"),
      aware("location", "library"),
      aware("item", "knife"),
      aware("event", "ben-kills-clara"),
      aware("evidence", "bloody-knife"),
    ];
    n.attitudes = [
      propositionAttitude("ben-at-library", knowledge(true)),
      propositionAttitude("anna-at-library", knowledge(false)),
      propositionAttitude("anna-in-killing", belief(true)),
      propositionAttitude("ben-in-killing", uncertain(true)),
      propositionAttitude("knife-used", uncertain(false)),
    ];
    if (solution !== null) {
      n.attitudes.push(
        conclusionAttitude("ben-responsible", belief(false)),
        conclusionAttitude("argument-caused-killing", uncertain(null)),
      );
    }
  });
}

export function annaInput(truth: CaseTruth, solution: CaseSolution | null): any {
  return npcInput(truth, solution, (n) => {
    n.awareness = [aware("person", "ben"), aware("location", "library")];
    n.attitudes = [propositionAttitude("ben-at-library", belief(true))];
  });
}

export function annaProfileInput(catalogue: QuestionCatalogue): any {
  const input = profileInput();
  input.npcId = "person:anna";
  input.catalogueHash = hashQuestionCatalogue(catalogue);
  input.rules = input.rules.filter((r: any) => r.questionId === "question:ben-in-library");
  return input;
}

/** All entities of the truth: 4 persons, 2 locations, 1 item, 3 events, 2 evidence. */
export function allKnown(truth: CaseTruth): EntityRef[] {
  return [
    ...truth.persons.map((p) => ({ kind: "person" as const, id: p.id })),
    ...truth.locations.map((l) => ({ kind: "location" as const, id: l.id })),
    ...truth.items.map((i) => ({ kind: "item" as const, id: i.id })),
    ...truth.events.map((e) => ({ kind: "event" as const, id: e.id })),
    ...truth.evidence.map((e) => ({ kind: "evidence" as const, id: e.id })),
  ];
}

export type Edits = {
  truth?: (t: any) => void;
  solution?: (s: any) => void;
  catalogue?: (c: any) => void;
  profile?: (p: any) => void;
  snapshot?: (n: any) => void;
  withSolution?: boolean;
  npc?: "dora" | "anna";
};

export type Scene = World & {
  snapshot: NpcKnowledgeSnapshot;
  input: (questionId: unknown, overrides?: Partial<InterrogationInput>) => InterrogationInput;
  ask: (questionId: unknown, overrides?: Partial<InterrogationInput>) => ReturnType<typeof interrogate>;
};

/** Fully, correctly bound documents after optional author edits. */
export function scene(edits: Edits = {}): Scene {
  const w = world(edits.truth, edits.solution);
  const solution = edits.withSolution === false ? null : w.solution;
  const cIn = catalogueInput();
  cIn.truthHash = hashCaseTruth(w.truth);
  edits.catalogue?.(cIn);
  const catalogue = parseQuestionCatalogue(cIn, w.truth);
  const anna = edits.npc === "anna";
  const pIn = anna ? annaProfileInput(catalogue) : profileInput();
  pIn.truthHash = hashCaseTruth(w.truth);
  pIn.catalogueHash = hashQuestionCatalogue(catalogue);
  edits.profile?.(pIn);
  const profile = parseInterrogationProfile(pIn, w.truth, catalogue);
  const nIn = anna ? annaInput(w.truth, solution) : doraInput(w.truth, solution);
  edits.snapshot?.(nIn);
  const snapshot = parseNpcKnowledge(nIn, w.truth, solution);
  const input = (questionId: unknown, overrides: Partial<InterrogationInput> = {}): InterrogationInput => ({
    truth: w.truth,
    solution,
    snapshot,
    catalogue,
    profile,
    refs: fakeRefs(w.truth),
    known: allKnown(w.truth),
    questionId,
    ...overrides,
  });
  return { ...w, snapshot, input, ask: (q, o) => interrogate(input(q, o)) };
}

export const q = (slug: string) => `question:${slug}`;
