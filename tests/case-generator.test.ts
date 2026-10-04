import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { generateCase, generatedPackage, writeGeneratedCase } from "../src/authoring/case-generator.ts";
import { checkCaseFolder } from "../src/authoring/check-case.ts";
import { initialSession, reduceSession, type SessionState } from "../src/domain/case-session.ts";
import { accusations, command, newGame } from "../src/play/game.ts";

const scratch = mkdtempSync(join(tmpdir(), "generated-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const SEEDS = Array.from({ length: 50 }, (_, i) => i);

describe("generate-case", () => {
  it("is deterministic per seed and varies across seeds", () => {
    expect(generateCase(7)).toEqual(generateCase(7));
    expect(new Set(SEEDS.map((s) => generateCase(s).title)).size).toBeGreaterThan(15);
    expect(() => generateCase(-1)).toThrow(RangeError);
  });

  it.each(SEEDS)("seed %i: check-case PASS with exactly one answer", (seed) => {
    const dir = join(scratch, `fall-${seed}`);
    writeGeneratedCase(generateCase(seed), dir);
    const check = checkCaseFolder(dir);
    expect(check.problems.filter((p) => p.severity === "error")).toEqual([]);
    expect(check.solvability).toMatchObject({ status: "pass", survivingAnswerCount: 1 });
    expect(check.ok).toBe(true);
  });

  it("the 50 seeds cover cases with and without a lie", () => {
    const lies = SEEDS.filter((s) => generateCase(s).withLie).length;
    expect(lies).toBeGreaterThan(10);
    expect(lies).toBeLessThan(40);
  });
});

describe("generated cases are playable", () => {
  it.each(SEEDS.slice(0, 10))("seed %i: only the culprit solves it; a lie breaks on the clue", (seed) => {
    const generated = generateCase(seed);
    const pkg = generatedPackage(generated);
    const truth = generated.files["truth.json"] as { events: { id: string; participantIds: string[] }[] };
    const culprit = truth.events.find((e) => e.id === "event:murder")!.participantIds[0]!;
    const game = newGame(pkg);
    const names = accusations(game).map((a) => a.label);
    const culpritLabel = (generated.files["public-content.json"] as { labels: { entity: { id: string }; label: string }[] }).labels.find((l) => l.entity.id === culprit)!.label;
    for (const name of names) {
      const verdict = command(game, `a ${names.indexOf(name) + 1}`).game.state.phase;
      expect(verdict).toBe(name === culpritLabel ? "solved" : "active");
    }

    const ref = (kind: "person" | "location" | "evidence", id: string) => pkg.refs.refFor(kind, id)!;
    const play = (events: unknown[]) =>
      events.reduce<SessionState>((state, e) => {
        const r = reduceSession(pkg, state, e);
        if (!r.ok) throw new Error(r.code);
        return r.state;
      }, initialSession(pkg));
    const scene = (generated.files["evidence-access.json"] as { entries: { access: { paths: { locationId?: string }[] } }[] }).entries[0]!.access.paths[0]!.locationId!;
    const clue = (generated.files["evidence-access.json"] as { entries: { evidenceId: string }[] }).entries[0]!.evidenceId;
    const ask = { type: "interrogate", npc: ref("person", culprit), questionId: "question:q01" };
    const state = play([{ type: "investigate", action: "search_location", target: ref("location", scene) }, ask]);
    const answer = state.knowledge.observations.at(-1)!.observation as { act: string; stance?: string };
    if (!generated.withLie) {
      expect(answer.act).toBe("decline");
      return;
    }
    expect(answer.stance).toBe("denies");
    const confronted = reduceSession(pkg, state, { type: "confront", npc: ref("person", culprit), questionId: "question:q01", evidence: ref("evidence", clue) });
    expect(confronted.ok && confronted.output.type === "confront" && confronted.output.observation.act).toBe("admit");
  });
});
