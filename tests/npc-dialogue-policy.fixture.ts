// Fixtures for TASK-0005. Every context comes from the real TASK-0004 pipeline
// (parseNpcKnowledge + projectNpcKnowledge); contexts are never hand-built.

import { parseNpcKnowledge } from "../src/domain/npc-knowledge.ts";
import { projectNpcKnowledge, type NpcVisibleContext } from "../src/domain/npc-knowledge.projection.ts";
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

export { belief, conclusionAttitude, knowledge, propositionAttitude, uncertain, world };

/** Anna's projected context for the given attitudes and awareness entries. */
export function projectContext(attitudes: object[], awareness: object[] = [], w: World = world()): NpcVisibleContext {
  const snapshot = parseNpcKnowledge(
    npcInput(w.truth, w.solution, (n) => {
      n.attitudes = attitudes;
      n.awareness = awareness;
    }),
    w.truth,
    w.solution,
  );
  const result = projectNpcKnowledge(snapshot, w.truth, w.solution);
  if (!result.success) throw new Error("fixture projection failed");
  return result.context;
}

/**
 * Context with exactly one personAt attitude under the given stance. Knowledge must match the
 * objective truth (TASK-0004), so knowledge(false) uses the false proposition anna-at-library.
 */
export function singleContext(stance: { kind: string; value?: boolean }, w: World = world()): NpcVisibleContext {
  const id = stance.kind === "knowledge" && stance.value === false ? "anna-at-library" : "ben-at-library";
  return projectContext([propositionAttitude(id, stance)], [], w);
}

/** All nine claim forms, every stance kind, propositions and conclusions, awareness of every kind. */
export function richAttitudes(): object[] {
  return [
    propositionAttitude("ben-at-library", knowledge(true)),
    propositionAttitude("anna-at-library", knowledge(false)),
    propositionAttitude("ben-in-killing", belief(true)),
    propositionAttitude("anna-in-killing", belief(false)),
    propositionAttitude("knife-used", uncertain(null)),
    conclusionAttitude("ben-responsible", uncertain(true)),
    conclusionAttitude("anna-responsible", uncertain(false)),
    conclusionAttitude("ben-role-actor", belief(true)),
    conclusionAttitude("nobody-responsible", belief(false)),
    conclusionAttitude("argument-caused-killing", belief(true)),
    conclusionAttitude("killing-intended", belief(true)),
    conclusionAttitude("killing-ordinary", belief(false)),
  ];
}

export function richAwareness(): object[] {
  return [aware("person", "dora"), aware("event", "walk"), aware("evidence", "bloody-knife"), aware("location", "garden")];
}

export function richContext(w: World = world()): NpcVisibleContext {
  return projectContext(richAttitudes(), richAwareness(), w);
}
