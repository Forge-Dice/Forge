import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { CASE_SCHEMAS, generateCase, generatedClockOrigin, generatedPackage, writeGeneratedCase, type GeneratedCase } from "../src/authoring/case-generator.ts";
import { checkCaseFolder } from "../src/authoring/check-case.ts";
import type { ResolvedCasePackage } from "../src/domain/case-package.ts";
import { initialSession, reduceSession, type SessionState } from "../src/domain/case-session.ts";
import { accusations, newGame } from "../src/play/game.ts";
import { createWebApp } from "../src/play/web.ts";

const scratch = mkdtempSync(join(tmpdir(), "generated-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const SEEDS = Array.from({ length: 50 }, (_, i) => i);
let n = 0;
const check = (generated: GeneratedCase, edit?: (files: Record<string, any>) => void) => {
  const dir = join(scratch, `fall-${n++}`);
  writeGeneratedCase(generated, dir);
  if (edit !== undefined) {
    const files = Object.fromEntries(Object.keys(generated.files).map((name) => [name, JSON.parse(readFileSync(join(dir, name), "utf8"))]));
    edit(files);
    for (const [name, json] of Object.entries(files)) writeFileSync(join(dir, name), JSON.stringify(json));
  }
  return checkCaseFolder(dir);
};

type Step = { stepId: string; event: unknown };
const steps = (g: GeneratedCase) => (g.files["release-manifest.json"] as { certificateData: { steps: Step[] } }).certificateData.steps;
const culpritOf = (g: GeneratedCase) => (g.files["truth.json"] as { events: { id: string; participantIds: string[] }[] }).events.find((e) => e.id === "event:murder")!.participantIds[0]!;
/** The manifest's step events with their $playerRefOf placeholders replaced by the package refs. */
const resolveRefs = (pkg: ResolvedCasePackage, value: unknown): unknown => {
  if (Array.isArray(value)) return value.map((v) => resolveRefs(pkg, v));
  if (value === null || typeof value !== "object") return value;
  const of = (value as { $playerRefOf?: { kind: "person" | "location" | "evidence"; id: string } }).$playerRefOf;
  if (of !== undefined) return pkg.refs.refFor(of.kind, of.id);
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveRefs(pkg, v)]));
};
const playSteps = (pkg: ResolvedCasePackage, list: readonly Step[]) =>
  list.reduce<{ state: SessionState; outputs: Record<string, unknown> }>(
    ({ state, outputs }, step) => {
      const r = reduceSession(pkg, state, resolveRefs(pkg, step.event));
      if (!r.ok) throw new Error(`${step.stepId}: ${r.code}`);
      return { state: r.state, outputs: { ...outputs, [step.stepId]: r.output } };
    },
    { state: initialSession(pkg), outputs: {} },
  );

describe("generate-case", () => {
  it("is deterministic per seed and varies across seeds", () => {
    expect(generateCase(7)).toEqual(generateCase(7));
    expect(new Set(SEEDS.map((s) => generateCase(s).title)).size).toBeGreaterThan(15);
    expect(() => generateCase(-1)).toThrow(RangeError);
  });

  it("picks every schema across the 50 seeds, with and without a lie", () => {
    const cases = SEEDS.map((s) => generateCase(s));
    expect(new Set(cases.map((c) => c.schema))).toEqual(new Set(CASE_SCHEMAS));
    const lies = cases.filter((c) => c.withLie).length;
    expect(lies).toBeGreaterThan(10);
    expect(lies).toBeLessThan(40);
  });

  it.each(SEEDS)("seed %i: check-case PASS with exactly one answer", (seed) => {
    const result = check(generateCase(seed));
    expect(result.problems.filter((p) => p.severity === "error")).toEqual([]);
    expect(result.solvability).toMatchObject({ status: "pass", survivingAnswerCount: 1 });
    expect(result.ok).toBe(true);
  });

  it.each(CASE_SCHEMAS)("schema %s: 10 forced seeds pass check-case", (schema) => {
    for (let seed = 100; seed < 110; seed++) {
      const generated = generateCase(seed, schema);
      expect(generated.schema).toBe(schema);
      expect(check(generated).ok, `${schema} ${seed}`).toBe(true);
    }
  });

  it("crowd has four or five suspects", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const scope = (generateCase(seed, "crowd").files["proof-profile.json"] as { answerScope: unknown[] }).answerScope;
      expect([4, 5]).toContain(scope.length);
    }
  });
});

describe("generated cases are playable", () => {
  it.each(SEEDS.slice(0, 15))("seed %i: after the witness steps only the culprit solves it; a lie breaks", (seed) => {
    const generated = generateCase(seed);
    const pkg = generatedPackage(generated);
    const { state, outputs } = playSteps(pkg, steps(generated));
    const game = { ...newGame(pkg, generatedClockOrigin(generated)), state };
    const culprit = pkg.refs.refFor("person", culpritOf(generated))!;
    const verdicts = accusations(game).map((a) => {
      const r = reduceSession(pkg, state, a.event);
      return r.ok && r.output.type === "accuse" ? r.output.verdict : r.ok ? "?" : r.code;
    });
    expect(verdicts.filter((v) => v === "solved")).toHaveLength(1);
    const solving = accusations(game)[verdicts.indexOf("solved")]!.event as { literals: { claim: { person?: string }; value: boolean }[] };
    expect(JSON.stringify(solving.literals.filter((l) => l.value))).toContain(culprit);
    const confront = outputs["confront-culprit"] as { observation: { act: string } } | undefined;
    expect(confront === undefined ? !generated.withLie : confront.observation.act === "admit").toBe(true);
  });

  it("latecomer: the culprit is unknown at the start and appears with the clue", () => {
    const generated = generateCase(3, "latecomer");
    const pkg = generatedPackage(generated);
    const culprit = pkg.refs.refFor("person", culpritOf(generated))!;
    expect(initialSession(pkg).knowledge.known.some((k) => k.ref === culprit)).toBe(false);
    const { state } = playSteps(pkg, steps(generated).slice(0, 1));
    expect(state.knowledge.known.some((k) => k.ref === culprit)).toBe(true);
  });

  it("timewindow: no evidence places the culprit at the deed; the alibis and their own log decide", () => {
    const generated = generateCase(5, "timewindow");
    const present = `proposition:${culpritOf(generated).replace(/^person:/, "")}-at-murder`;
    const evidence = (generated.files["truth.json"] as { evidence: { id: string; links: { propositionId: string; direction: string }[] }[] }).evidence;
    expect(evidence.some((e) => e.links.some((l) => l.propositionId === present && l.direction === "supports"))).toBe(false);
    expect(evidence.some((e) => e.id.startsWith("evidence:log-") && e.links.some((l) => l.propositionId === "proposition:culprit-alibi-claim" && l.direction === "refutes"))).toBe(true);
    const edges = (generated.files["proof-profile.json"] as { edges: { id: string }[] }).edges.map((e) => e.id);
    expect(edges).toContain("responsible:elimination");
  });

  it("twopaths: a witness who takes only one of the two paths still solves it", () => {
    const generated = generateCase(1, "twopaths");
    const scene = steps(generated)[0]!.stepId;
    expect(scene).toMatch(/^search-/);
    const without = (dropped: string[]) => (files: Record<string, any>) => {
      files["proof-profile.json"].witnessStepIds = files["proof-profile.json"].witnessStepIds.filter((id: string) => !dropped.includes(id));
      const manifest = files["release-manifest.json"].certificateData;
      manifest.steps = manifest.steps.filter((s: Step) => !dropped.includes(s.stepId));
    };
    // The confrontation holds the scene clue, so it goes with the scene search.
    const sleeveOnly = check(generated, without([scene, "ask-culprit", "confront-culprit"]));
    expect(sleeveOnly.solvability?.status).toBe("pass");
    expect(check(generated, without(["examine-culprit"])).solvability?.status).toBe("pass");
    expect(check(generated, without([scene, "ask-culprit", "confront-culprit", "examine-culprit"])).solvability?.status).toBe("fail");
  });
});

describe("Zufallsfall in the browser", () => {
  it("the case list offers a seed form; a seed opens its generated case", async () => {
    const app = createWebApp();
    const server = createServer((req, res) => void app(req, res));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      expect(await (await fetch(`${base}/`)).text()).toContain('action="/zufall"');
      const post = (seed: string) => fetch(`${base}/zufall`, { method: "POST", body: new URLSearchParams({ seed }), redirect: "manual" });
      const go = await post("42");
      expect(go.status).toBe(303);
      expect(go.headers.get("location")).toBe("/fall/zufall-42");
      expect((await post("")).headers.get("location")).toMatch(/^\/fall\/zufall-\d+$/);
      expect((await post("x1")).status).toBe(400);
      const page = await (await fetch(`${base}/fall/zufall-42`)).text();
      expect(page).toContain(generateCase(42).title.replace(/&/g, "&amp;"));
      expect(page).toContain('action="/fall/zufall-42/act"');
      const act = await fetch(`${base}/fall/zufall-42/act`, { method: "POST", body: new URLSearchParams({ group: "u", n: "1", at: "0" }), redirect: "manual" });
      expect(act.status).toBe(303);
      expect(await (await fetch(`${base}/fall/zufall-42`)).text()).toContain('name="at" value="1"');
      expect((await fetch(`${base}/fall/zufall-1234567890`)).status).toBe(404);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe("review fixes", () => {
  it("writing into a folder that already holds files is refused unless forced; forcing drops stale NPC files", () => {
    const dir = join(scratch, "reuse");
    writeGeneratedCase(generateCase(0), dir);
    expect(() => writeGeneratedCase(generateCase(1), dir)).toThrow(/nicht leer/);
    writeGeneratedCase(generateCase(1), dir, { force: true });
    expect(checkCaseFolder(dir).ok).toBe(true);
  });

  it("seeds above 2^32-1 are rejected instead of wrapping onto another seed's case", () => {
    expect(() => generateCase(2 ** 32 + 5)).toThrow(RangeError);
    expect(() => generateCase(2 ** 32 - 1)).not.toThrow();
  });

});

