import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkCaseFolder, type CaseCheck } from "../src/authoring/check-case.ts";
import { decodeSessionSave, encodeSessionSave } from "../src/domain/case-session-save.ts";
import { initialSession, reduceSession, replaySession, type SessionState } from "../src/domain/case-session.ts";
import { loadPlayPackage } from "../src/play/cases.ts";
import { command, newGame } from "../src/play/game.ts";
import { createWebApp } from "../src/play/web.ts";
import { BRIEF, briefProofProfile, briefWitness, resolveBriefPackage } from "./brieffoeffner.fixture.ts";

// Confrontation (ruleset v2): holding a found evidence against an earlier statement. An authored
// lie with its refuting evidence breaks; everything else gets the same neutral reply.

const pkg = loadPlayPackage("brieföffner");
const r = (kind: "person" | "location" | "item" | "event" | "evidence", id: string) => pkg.refs.refFor(kind, `${kind}:${id}`)!;
const event = {
  search: (id: string) => ({ type: "investigate", action: "search_location", target: r("location", id) }),
  ask: (npc: string, q: string) => ({ type: "interrogate", npc: r("person", npc), questionId: `question:${q}` }),
  confront: (npc: string, q: string, evidence: string) => ({ type: "confront", npc: r("person", npc), questionId: `question:${q}`, evidence: r("evidence", evidence) }),
};
const play = (inputs: unknown[]): SessionState =>
  inputs.reduce<SessionState>((state, input, i) => {
    const result = reduceSession(pkg, state, input);
    if (!result.ok) throw new Error(`event ${i}: ${result.code}`);
    return result.state;
  }, initialSession(pkg));
const step = (state: SessionState, input: unknown) => reduceSession(pkg, state, input);
const prepared = () => play([event.search("library"), event.search("garden"), event.ask("ben", "q01"), event.ask("ben", "q02"), event.ask("ben", "q04")]);

describe("confronting in the session", () => {
  it("the cuff button breaks Ben's lie; he admits, and from then on answers q01 sincerely", () => {
    const result = step(prepared(), event.confront("ben", "q01", "cuff-button"));
    if (!result.ok) throw new Error(result.code);
    expect(result.output).toEqual({
      type: "confront",
      observation: {
        schemaVersion: 1,
        npc: r("person", "ben"),
        questionId: "question:q01",
        evidence: r("evidence", "cuff-button"),
        act: "admit",
        stance: "affirms",
        statement: { kind: "eventHasParticipant", event: r("event", "murder"), person: r("person", "ben") },
        mentions: expect.any(Array),
      },
    });
    const again = step(result.state, event.ask("ben", "q01"));
    expect(again.ok && again.output.type === "interrogate" && "stance" in again.output.observation && again.output.observation.stance).toBe("affirms");
    expect(step(prepared(), event.ask("ben", "q01")).ok && (step(prepared(), event.ask("ben", "q01")) as any).output.observation.stance).toBe("denies");
  });

  it("a wrong evidence, a true statement or another NPC get the same neutral reply", () => {
    const state = play([...prepared().events, event.ask("anna", "q04")]);
    const replies = [
      event.confront("ben", "q02", "muddy-path"), // a lie, but this card does not refute it
      event.confront("ben", "q01", "muddy-path"), // the lie, the wrong card
      event.confront("ben", "q04", "cuff-button"), // a true answer
      event.confront("anna", "q04", "cuff-button"), // an honest NPC
    ].map((e) => {
      const result = step(state, e);
      if (!result.ok) throw new Error(result.code);
      return result.output.type === "confront" ? result.output.observation : null;
    });
    for (const o of replies) {
      expect(o!.act).toBe("stands_by");
      expect(Object.keys(o!).sort()).toEqual(["act", "evidence", "npc", "questionId", "schemaVersion"]);
    }
  });

  it("needs an earlier statement, a found evidence and a v2 case", () => {
    const unavailable = { ok: false, code: "ACTION_UNAVAILABLE" };
    expect(step(play([event.search("library")]), event.confront("ben", "q01", "cuff-button"))).toMatchObject(unavailable);
    expect(step(play([event.ask("ben", "q01")]), event.confront("ben", "q01", "cuff-button"))).toMatchObject(unavailable);
    const declined = play([event.search("library"), event.ask("ben", "q03")]);
    expect(step(declined, event.confront("ben", "q03", "cuff-button"))).toMatchObject(unavailable);
    const vitrine = loadPlayPackage("vitrine");
    const any = (kind: "person" | "evidence") => vitrine.refs.refFor(kind, vitrine.truth[kind === "person" ? "persons" : "evidence"][0]!.id)!;
    const v1 = { type: "confront", npc: any("person"), questionId: vitrine.catalogue.questions[0]!.id, evidence: any("evidence") };
    expect(reduceSession(vitrine, initialSession(vitrine), v1)).toMatchObject(unavailable);
  });

  it("is saved, loaded and replayed like any event", () => {
    const state = play([...prepared().events, event.confront("ben", "q01", "cuff-button"), event.ask("ben", "q01")]);
    const saved = encodeSessionSave(pkg, state);
    if (!saved.ok) throw new Error(saved.code);
    expect(decodeSessionSave(pkg, saved.text)).toEqual({ ok: true, state });
    expect(replaySession(pkg, state.events)).toEqual({ ok: true, state });
  });
});

describe("confrontation in the proof", () => {
  it("the witness step confront-ben releases Ben's admission; the proof passes", () => {
    const brief = resolveBriefPackage();
    const profile = briefProofProfile();
    expect(profile.witnessStepIds.at(-1)).toBe("confront-ben");
    const replay = briefWitness(brief)(profile.witnessStepIds);
    expect(replay.success && replay.released.map((o) => o.id)).toEqual(expect.arrayContaining(["reported:ben-denies", "reported:ben-admits"]));
    expect(checkCaseFolder(new URL("./fixtures/brieffoeffner/", import.meta.url).pathname).ok).toBe(true);
  });
});

describe("authoring a confrontation (check-case)", () => {
  const scratch = mkdtempSync(join(tmpdir(), "confront-"));
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));
  let n = 0;
  const withConfrontation = (edit: (c: any) => void): CaseCheck => {
    const dir = join(scratch, `v${n++}`);
    cpSync(new URL("./fixtures/brieffoeffner/", import.meta.url).pathname, dir, { recursive: true });
    const file = join(dir, "interrogation-ben.json");
    const profile = JSON.parse(readFileSync(file, "utf8"));
    edit(profile.confrontations[0]);
    writeFileSync(file, JSON.stringify(profile));
    return checkCaseFolder(dir);
  };
  const errorAt = (check: CaseCheck, field: string) => check.problems.find((p) => p.severity === "error" && p.file === "interrogation-ben.json" && p.field === field);

  it("only a lie can be confronted", () => {
    expect(errorAt(withConfrontation((c) => (c.questionId = "question:q04")), "confrontations[0].questionId")?.message).toMatch(/Only a lie/);
  });

  it("the evidence must refute the lie and exist", () => {
    expect(errorAt(withConfrontation((c) => (c.evidenceId = "evidence:muddy-path")), "confrontations[0].evidenceId")?.message).toMatch(/does not refute/);
    expect(errorAt(withConfrontation((c) => (c.evidenceId = "evidence:ghost")), "confrontations[0].evidenceId")?.message).toMatch(/Unknown evidence/);
  });

  it("the admission obeys the release rules", () => {
    const check = withConfrontation((c) => (c.claim = { kind: "personAt", personId: "person:anna", locationId: "location:garden", at: 1500 }));
    expect(errorAt(check, "confrontations[0].claim")?.message).toMatch(/R1/);
  });
});

describe("confronting in CLI and browser", () => {
  it("CLI: v lists statement × found card; Ben gives in to the cuff button", () => {
    let game = newGame(pkg, BRIEF.clockOrigin);
    expect(command(game, "v").text).toBe("Vorhalten: gerade nichts verfügbar.");
    const pickLine = (list: string, text: string) => list.split("\n").find((l) => l.includes(text))!.trim().split(".")[0];
    game = command(game, `u ${pickLine(command(game, "u").text, "Bibliothek")}`).game;
    game = command(game, `f ${pickLine(command(game, "f").text, "Ben: Waren Sie bei Claras Tod dabei?")}`).game;
    const listing = command(game, "v").text;
    const line = listing.split("\n").find((l) => l.includes("Ben zu „Waren Sie bei Claras Tod dabei?“") && l.includes("Manschettenknopf"));
    expect(line, listing).toBeDefined();
    const out = command(game, `v ${line!.trim().split(".")[0]}`);
    expect(out.text).toContain("gibt nach: „Ja.“");
    expect(command(out.game, "j").text).toContain("gibt nach");
  });

  it("web: a Vorhalten section only in the v2 case, and it works", async () => {
    const app = createWebApp();
    const server = createServer((req, res) => void app(req, res));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const forms = (html: string) =>
      [...html.matchAll(/<form method="post" action="\/fall\/[a-z]+\/act"[^>]*>(.*?)<\/form>/g)].map(([, inner]) => ({
        // Visible label plus any visually hidden context, tags stripped.
        label: /<button[^>]*>(.*?)<\/button>/.exec(inner!)![1]!.replace(/<[^>]+>/g, ""),
        fields: Object.fromEntries([...inner!.matchAll(/name="(\w+)" value="([^"]*)"/g)].map(([, k, v]) => [k!, v!])),
      }));
    const click = async (path: string, match: (label: string) => boolean) => {
      // Last match: Ben's questions come after Anna's, and both ask "Waren Sie bei Claras Tod dabei?".
      const form = forms(await (await fetch(`${base}${path}`)).text()).filter((f) => match(f.label)).at(-1)!;
      await fetch(`${base}${path}/act`, { method: "POST", body: new URLSearchParams(form.fields), redirect: "manual" });
      return (await fetch(`${base}${path}`)).text();
    };
    try {
      const B = "/fall/brieffoeffner";
      expect(await (await fetch(`${base}${B}`)).text()).not.toContain("<h2>Vorhalten</h2>");
      await click(B, (l) => l === "Ort durchsuchen: Bibliothek");
      const html = await click(B, (l) => l === "Waren Sie bei Claras Tod dabei?");
      expect(html).toContain("<h2>Vorhalten</h2>");
      const after = await click(B, (l) => l.includes("vorhalten") && l.includes("Manschettenknopf"));
      expect(after).toContain("Konfrontation: die Aussage bricht ein");
      for (let i = 0; i < 3; i++) await click("/fall/vitrine", (l) => l.startsWith("Ort durchsuchen"));
      expect(await (await fetch(`${base}/fall/vitrine`)).text()).not.toContain("<h2>Vorhalten</h2>");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
