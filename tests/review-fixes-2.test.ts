import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bindCaseProof, witnessAccusation, type Manifest } from "../src/authoring/check-case.ts";
import { resolveCasePackage, type ResolvedCasePackage } from "../src/domain/case-package.ts";
import { initialSession, reduceSession } from "../src/domain/case-session.ts";
import { PLAY_CASES, playPackageInput, refSource } from "../src/play/cases.ts";
import { accusations, newGame, pageToken } from "../src/play/game.ts";
import { createWebApp } from "../src/play/web.ts";
import { readFileSync } from "node:fs";

// Second review round: the points the first round left open.

const VITRINE = PLAY_CASES.vitrine;
const raw = (name: string): unknown => JSON.parse(readFileSync(new URL(`./fixtures/${VITRINE.dir}/${name}`, import.meta.url), "utf8"));

function vitrine(edit: (input: any) => void, withProof = true): ResolvedCasePackage {
  const input = playPackageInput(VITRINE) as any;
  edit(input);
  if (withProof) input.proof = bindCaseProof(input, raw("release-manifest.json"), raw("proof-profile.json"), VITRINE.salt);
  const resolved = resolveCasePackage(input, refSource(input.truth, VITRINE.salt));
  if (!resolved.ok) throw new Error(JSON.stringify(resolved.findings));
  return resolved.package;
}

describe("stale page check compares the history, not only its length", () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    const app = createWebApp({ vitrine: vitrine(() => {}) });
    server = createServer((req, res) => void app(req, res));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const post = (path: string, body: string) =>
    fetch(`${base}/fall/vitrine${path}`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  const token = async () => /name="at" value="([^"]+)"/.exec(await (await fetch(`${base}/fall/vitrine`)).text())![1]!;
  const events = async () => (JSON.parse(await (await fetch(`${base}/fall/vitrine/save`)).text()) as { events: { type: string }[] }).events;

  it("a form from another history with the same number of events is refused", async () => {
    await post("/new", "");
    await post("/act", `group=h&n=1&at=${await token()}`); // history A: one hint
    const stale = await token();
    await post("/new", "");
    await post("/act", `group=u&n=1&at=${await token()}`); // history B: one investigation
    const before = await events();
    expect(before.map((e) => e.type)).toEqual(["investigate"]);
    await post("/act", `group=u&n=2&at=${stale}`); // the page of history A
    expect(await events()).toEqual(before);
  });

  it("a fourth hint on one step says the hint cannot get more precise", async () => {
    await post("/new", "");
    for (let i = 0; i < 4; i++) await post("/act", `group=h&n=1&at=${await token()}`);
    expect(await (await fetch(`${base}/fall/vitrine`)).text()).toContain("Genauer geht der Hinweis nicht.");
  });

  it("the token of a fresh game is 0 and differs between histories of equal length", () => {
    const pkg = vitrine(() => {});
    const game = newGame(pkg);
    expect(pageToken(game)).toBe("0");
    const a = reduceSession(pkg, game.state, { type: "hint" });
    const b = reduceSession(pkg, game.state, accusations(game)[0]!.event);
    if (!a.ok || !b.ok) throw new Error("rejected");
    expect(pageToken({ ...game, state: a.state })).not.toBe(pageToken({ ...game, state: b.state }));
  });
});

describe("check-case accuses the way the game does", () => {
  it("a culprit with two in-scope claims: the game can never assert both, so check-case must not pass the witness", () => {
    const pkg = vitrine((input) => {
      input.challenge.allowedClaims.push({ kind: "personResponsibleForEvent", personId: "person:lina", eventId: "event:e04" });
    });
    const manifest = JSON.parse(pkg.proof!.releaseManifest) as Manifest;
    // The game: after the witness, no offered accusation solves.
    let state = initialSession(pkg);
    for (const id of pkg.proof!.profile.witnessStepIds) {
      const step = manifest.certificateData.steps.find((s) => s.stepId === id)!;
      if ((step.event as { type: string }).type === "accuse") continue;
      const r = reduceSession(pkg, state, step.event);
      if (!r.ok) throw new Error(r.code);
      state = r.state;
    }
    const game = { pkg, state, clockOrigin: 0 };
    const verdicts = accusations(game).map((a) => {
      const r = reduceSession(pkg, state, a.event);
      return r.ok && r.output.type === "accuse" ? r.output.verdict : null;
    });
    expect(verdicts).not.toContain("solved");
    expect(witnessAccusation(pkg, manifest, pkg.proof!.profile.witnessStepIds)).not.toBeNull();
  });

  it("the shipped cases still pass", () => {
    const pkg = vitrine(() => {});
    const manifest = JSON.parse(pkg.proof!.releaseManifest) as Manifest;
    expect(witnessAccusation(pkg, manifest, pkg.proof!.profile.witnessStepIds)).toBeNull();
  });
});

describe("accusations need the crime event to be known", () => {
  it("no accusation is offered while the event is unknown, and every offered one is accepted", () => {
    const pkg = vitrine((input) => {
      input.initial.known = input.initial.known.filter((k: { kind: string }) => k.kind !== "event");
    }, false);
    const game = newGame(pkg);
    for (const a of accusations(game)) expect(reduceSession(pkg, game.state, a.event).ok).toBe(true);
  });
});
