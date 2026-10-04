import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { b, outcome, py, type Call, type Response } from "./helpers.ts";

// FORGE-BOOTSTRAP-0001C: Owner attestation format, decisive-review selection, supersedes and the
// review snapshot digest (reviews.py). Pure functions over GitHub REST review records; no network.
// AV IDs refer to the PKG §13 acceptance matrix as changed by contract C r2 §11.

const OWNER_ID = 315180734;
const OWNER_LOGIN = "forge-owner";
const H = "1".repeat(40);
const OLD_H = "2".repeat(40);
const B = "3".repeat(40);
const BINDING = {
  repoId: 1401864629,
  pr: 7,
  base: B,
  head: H,
  contractHash: "c".repeat(64),
  verifierSha: B,
  policyHash: "d".repeat(64),
  runId: 123,
  runAttempt: 2,
};
type Binding = typeof BINDING;
type Json = Record<string, unknown>;
type Finding = { id: string; severity: string; summary: string };

const sha256 = (data: string | Buffer): string => createHash("sha256").update(data).digest("hex");
const canonical = (value: unknown): string => JSON.stringify(value, null, 2) + "\n";
const HEADER = "FORGE-ATTESTATION-V1\n";
const REVIEWER = { provider: "anthropic", model: "claude-opus-5-5" };

function report(opts: { result?: string; findings?: Finding[]; binding?: Partial<Binding>; reviewer?: Json } = {}): string {
  const bind = { ...BINDING, ...opts.binding };
  return canonical({
    format: 1,
    binding: { repoId: bind.repoId, pr: bind.pr, base: bind.base, head: bind.head, contractHash: bind.contractHash, verifierSha: bind.verifierSha, policyHash: bind.policyHash },
    reviewer: opts.reviewer ?? REVIEWER,
    result: opts.result ?? "approve",
    findings: opts.findings ?? [],
  });
}

type ApproveOpts = {
  binding?: Partial<Binding>;
  reportText?: string;
  result?: string;
  reviewer?: Json;
  hash?: string;
  supersedes?: { reviewId: number; bodyHash: string; state: string }[];
  edit?: (a: Json) => void;
};

function approveObject(o: ApproveOpts = {}): Json {
  const text = o.reportText ?? report();
  const a: Json = {
    format: 1,
    ...BINDING,
    ...o.binding,
    action: "approve",
    externalReviewer: o.reviewer ?? REVIEWER,
    externalReviewHash: o.hash ?? sha256(Buffer.concat([Buffer.from("forge-external-review-v1\n"), Buffer.from(text, "utf8")])),
    externalReviewResult: o.result ?? "approve",
    externalReviewBase64: Buffer.from(text, "utf8").toString("base64"),
    supersedes: o.supersedes ?? [],
    deployment: { policyDigest: "e".repeat(64), checkedAt: "2026-10-04T12:00:00Z" },
  };
  o.edit?.(a);
  return a;
}

const approve = (o: ApproveOpts = {}): string => HEADER + canonical(approveObject(o));
const revoke = (binding: Partial<Binding> = {}): string =>
  HEADER + canonical({ format: 1, ...BINDING, ...binding, action: "revoke", supersedes: [] });

type Review = { id: number; user: { id: number; login: string }; state: string; commit_id: string | null; submitted_at: string | null; body: string };
let nextId = 1000;
function review(body: string, o: Partial<Omit<Review, "user">> & { userId?: number; login?: string; minute?: number } = {}): Review {
  const minute = o.minute ?? 0;
  return {
    id: o.id ?? ++nextId,
    user: { id: o.userId ?? OWNER_ID, login: o.login ?? OWNER_LOGIN },
    state: o.state ?? "COMMENTED",
    commit_id: o.commit_id === undefined ? H : o.commit_id,
    submitted_at: o.submitted_at === undefined ? `2026-10-04T12:${String(minute).padStart(2, "0")}:00Z` : o.submitted_at,
    body,
  };
}
const supersede = (r: Review) => ({ reviewId: r.id, bodyHash: sha256(Buffer.from(r.body, "utf8")), state: r.state });

const select = (reviews: Review[], kw: Json = {}): Call => ({
  fn: "reviews.select_attestation",
  args: [reviews],
  kwargs: { owner_id: OWNER_ID, binding: BINDING, profile: "DEV", developer_provider: "openai", ...kw },
});
const parse = (body: string | Buffer): Call => ({ fn: "reviews.parse_attestation", args: [b(typeof body === "string" ? Buffer.from(body, "utf8") : body)] });
const digest = (reviews: Review[]): Call => ({ fn: "reviews.review_snapshot_digest", args: [reviews, OWNER_ID] });

function run(calls: Record<string, Call>): Record<string, Response> {
  const names = Object.keys(calls);
  const out = py(names.map((n) => calls[n]!));
  return Object.fromEntries(names.map((n, i) => [n, out[i]!]));
}
function outcomes(calls: Record<string, Call>): Record<string, string> {
  return Object.fromEntries(Object.entries(run(calls)).map(([n, r]) => [n, outcome(r)]));
}
const expectAll = (calls: Record<string, Call>, want: string): void => {
  const got = outcomes(calls);
  expect(got).toEqual(Object.fromEntries(Object.keys(calls).map((n) => [n, want])));
};

describe("decisive Owner review and binding (PKG §9, contract C §3)", () => {
  it("AV-143 Owner COMMENTED attestation with all correct bindings passes and is summarized", () => {
    const r = review(approve());
    const [res] = py([select([r])]);
    expect(outcome(res!)).toBe("PASS");
    expect(res!.ok).toMatchObject({
      reviewId: r.id,
      bodySha256: sha256(Buffer.from(r.body, "utf8")),
      commitId: H,
      submittedAt: r.submitted_at,
      externalReviewer: REVIEWER,
      deployment: { policyDigest: "e".repeat(64), checkedAt: "2026-10-04T12:00:00Z" },
      providerRule: true,
      independence: "owner_attested",
    });
  });

  it("AV-144 / AV-153 / native blockers: APPROVED, DISMISSED or CHANGES_REQUESTED as decisive state block", () => {
    expectAll({
      approvedState: select([review(approve(), { state: "APPROVED" })]),
      dismissed: select([review(approve(), { state: "DISMISSED" })]),
      changesRequested: select([review("needs work", { state: "CHANGES_REQUESTED" })]),
    }, "REVIEW_BLOCKED");
  });

  it("AV-145 mutant C1: same login, wrong numeric id is no authority (REVIEW_MISSING)", () => {
    const impostor = review(approve(), { userId: OWNER_ID + 1, login: OWNER_LOGIN });
    expect(outcome(py([select([impostor])])[0]!)).toBe("REVIEW_MISSING");
  });

  it("AV-146 / AV-147 / AV-148 stale commit_id or wrong binding fields are REVIEW_BINDING", () => {
    expectAll({
      oldHeadCommitId: select([review(approve(), { commit_id: OLD_H })]),
      nullCommitId: select([review(approve(), { commit_id: null })]),
      otherContractHash: select([review(approve({ binding: { contractHash: "f".repeat(64) }, reportText: report({ binding: { contractHash: "f".repeat(64) } }) }))]),
      otherPr: select([review(approve({ binding: { pr: 8 }, reportText: report({ binding: { pr: 8 } }) }))]),
      otherRepo: select([review(approve({ binding: { repoId: 1 }, reportText: report({ binding: { repoId: 1 } }) }))]),
      otherRunAttempt: select([review(approve({ binding: { runAttempt: 1 } }))]),
      otherRunId: select([review(approve({ binding: { runId: 124 } }))]),
      otherPolicyHash: select([review(approve({ binding: { policyHash: "a".repeat(64) }, reportText: report({ binding: { policyHash: "a".repeat(64) } }) }))]),
      otherVerifierSha: select([review(approve({ binding: { verifierSha: H }, reportText: report({ binding: { verifierSha: H } }) }))]),
      reportBindsOtherHead: select([review(approve({ reportText: report({ binding: { head: OLD_H } }) }))]),
    }, "REVIEW_BINDING");
  });

  it("AV-149 external review hash or reviewer/result not matching the embedded bytes is REVIEW_BINDING", () => {
    expectAll({
      hash: select([review(approve({ hash: "0".repeat(64) }))]),
      reviewer: select([review(approve({ reportText: report({ reviewer: { provider: "anthropic", model: "other-model" } }) }))]),
      result: select([review(approve({ reportText: report({ result: "request_changes" }) }))]),
    }, "REVIEW_BINDING");
  });

  it("AV-150 schema-valid external result request_changes is REVIEW_BLOCKED", () => {
    const body = approve({ result: "request_changes", reportText: report({ result: "request_changes" }) });
    expect(outcome(py([select([review(body)])])[0]!)).toBe("REVIEW_BLOCKED");
  });

  it("AV-150b external result reject (not in the enum) is REVIEW_FORMAT", () => {
    expectAll({
      reportReject: select([review(approve({ reportText: report({ result: "reject" }) }))]),
      attestationReject: select([review(approve({ result: "reject", reportText: report({ result: "reject" }) }))]),
      parseOnly: parse(approve({ reportText: report({ result: "reject" }) })),
    }, "REVIEW_FORMAT");
  });

  it("AV-151 external reviewer given only as chat display name is REVIEW_FORMAT", () => {
    const label = { provider: "Claude (claude.ai chat)", model: "claude-opus-5-5" };
    expectAll({
      provider: select([review(approve({ reviewer: label, reportText: report({ reviewer: label }) }))]),
      model: select([review(approve({ reviewer: { provider: "anthropic", model: "Claude chat" }, reportText: report({ reviewer: { provider: "anthropic", model: "Claude chat" } }) }))]),
      emptyModel: parse(approve({ reviewer: { provider: "anthropic", model: "" } })),
    }, "REVIEW_FORMAT");
  });

  it("AV-152 a PENDING Owner review is not published (REVIEW_MISSING); no reviews at all likewise", () => {
    expectAll({
      pending: select([review(approve(), { state: "PENDING", submitted_at: null })]),
      none: select([]),
    }, "REVIEW_MISSING");
  });

  it("AV-155 a body edited before the first observation is bound as the current server body", () => {
    const edited = review(approve());
    const res = run({ sel: select([edited]), d1: digest([edited]), d2: digest([{ ...edited }]) });
    expect(outcome(res["sel"]!)).toBe("PASS");
    expect((res["sel"]!.ok as Json)["bodySha256"]).toBe(sha256(Buffer.from(edited.body, "utf8")));
    expect(res["d1"]!.ok).toBe(res["d2"]!.ok);
  });

  it("AV-157 newer malformed Owner attestation beats an older correct one (REVIEW_FORMAT)", () => {
    const good = review(approve(), { minute: 1 });
    expectAll({
      truncated: select([good, review(approve().slice(0, -2), { minute: 2 })]),
      plainComment: select([good, review("LGTM", { minute: 2 })]),
      fenced: select([good, review("```\n" + approve() + "```\n", { minute: 2 })]),
    }, "REVIEW_FORMAT");
  });

  it("AV-158 newer stale Owner attestation beats an older correct one (REVIEW_BINDING)", () => {
    const good = review(approve(), { minute: 1 });
    expect(outcome(py([select([good, review(approve(), { minute: 2, commit_id: OLD_H })])])[0]!)).toBe("REVIEW_BINDING");
  });

  it("AV-159 a newer valid revoke blocks, even when its own binding is old", () => {
    const good = review(approve(), { minute: 1 });
    expectAll({
      revoke: select([good, review(revoke(), { minute: 2 })]),
      revokeOtherAttempt: select([good, review(revoke({ runAttempt: 9 }), { minute: 2, commit_id: OLD_H })]),
    }, "REVIEW_BLOCKED");
  });

  it("AV-160 a new approve without explicit supersedes of an older blocker is REVIEW_BLOCKED", () => {
    expectAll({
      changesRequested: select([review("no", { state: "CHANGES_REQUESTED", minute: 1 }), review(approve(), { minute: 2 })]),
      revoke: select([review(revoke(), { minute: 1 }), review(approve(), { minute: 2 })]),
      dismissed: select([review(approve(), { state: "DISMISSED", minute: 1 }), review(approve(), { minute: 2 })]),
    }, "REVIEW_BLOCKED");
  });

  it("AV-161 a new approve superseding exactly all current blockers passes", () => {
    const blockers = [
      review("no", { state: "CHANGES_REQUESTED", minute: 1 }),
      review(revoke(), { minute: 2 }),
      review(HEADER + "{}\n", { minute: 3 }),
      review(approve({ reportText: report({ findings: [{ id: "f1", severity: "critical", summary: "x" }] }) }), { minute: 4 }),
      review(approve({ result: "request_changes", reportText: report({ result: "request_changes" }) }), { minute: 5 }),
      review(approve(), { state: "DISMISSED", minute: 6 }),
    ];
    const neutral = [review("plain note", { minute: 7 }), review(approve(), { minute: 8, commit_id: OLD_H }), review(approve(), { state: "APPROVED", minute: 9 })];
    const final = review(approve({ supersedes: blockers.map(supersede).reverse() }), { minute: 10 });
    const [res] = py([select([final, ...neutral, ...blockers])]);
    expect(outcome(res!)).toBe("PASS");
    expect((res!.ok as Json)["supersedes"]).toEqual(blockers.map((r) => r.id).sort((x, y) => x - y));
  });

  it("AV-162 newer contradicting authorized findings after an approve block", () => {
    const good = review(approve(), { minute: 1 });
    const blocking = approve({ reportText: report({ findings: [{ id: "regression", severity: "major", summary: "breaks clamp" }] }) });
    expectAll({
      changesRequested: select([good, review("found a bug", { state: "CHANGES_REQUESTED", minute: 2 })]),
      blockingApprove: select([good, review(blocking, { minute: 2 })]),
    }, "REVIEW_BLOCKED");
  });

  it("AV-163 an unrelated public review without authority changes nothing", () => {
    const good = review(approve(), { minute: 1 });
    const stranger = { userId: 4242, login: "someone" };
    const res = run({
      comment: select([good, review("drive-by comment", { ...stranger, minute: 2 })]),
      changes: select([good, review("no", { ...stranger, state: "CHANGES_REQUESTED", minute: 3 })]),
      revoke: select([good, review(revoke(), { ...stranger, minute: 4 })]),
      digestWith: digest([good, review("x", { ...stranger, minute: 2 })]),
      digestWithout: digest([good]),
    });
    expect([res["comment"], res["changes"], res["revoke"]].map((r) => outcome(r!))).toEqual(["PASS", "PASS", "PASS"]);
    expect(res["digestWith"]!.ok).toBe(res["digestWithout"]!.ok);
  });

  it("mutant C2: older approve, newer valid blocking review stays REVIEW_BLOCKED (no fallback)", () => {
    const older = review(approve(), { minute: 1 });
    const newer = review(revoke(), { minute: 2 });
    expect(outcome(py([select([newer, older])])[0]!)).toBe("REVIEW_BLOCKED");
  });

  it("ties on submitted_at are ordered by numeric review id", () => {
    const a = review(revoke(), { id: 50, minute: 5 });
    const z = review(approve({ supersedes: [supersede(a)] }), { id: 60, minute: 5 });
    const res = outcomes({ approveLast: select([z, a]), revokeLast: select([{ ...a, id: 70 }, { ...z, id: 60 }]) });
    expect(res).toEqual({ approveLast: "PASS", revokeLast: "REVIEW_BLOCKED" });
  });
});

describe("external review findings (contract C §3, AV-181)", () => {
  const f = (severity: string, id = "f1"): Finding => ({ id, severity, summary: "finding text" });
  const withFindings = (findings: Finding[]) => select([review(approve({ reportText: report({ findings }) }))]);

  it("AV-181 approve with a major or critical finding is REVIEW_BLOCKED", () => {
    expectAll({ major: withFindings([f("major")]), critical: withFindings([f("info"), f("critical", "f2")]) }, "REVIEW_BLOCKED");
  });

  it("AV-181 approve with only info/minor findings passes", () => {
    expectAll({ info: withFindings([f("info")]), minor: withFindings([f("minor"), f("info", "f2")]) }, "PASS");
  });

  it("finding schema is closed: unknown severity, field, bad id, duplicate id, empty or long summary", () => {
    expectAll({
      high: withFindings([f("high")]),
      extraField: withFindings([{ ...f("info"), disposition: "accepted" } as Finding]),
      badId: withFindings([f("info", "F1")]),
      longId: withFindings([f("info", "a".repeat(33))]),
      duplicate: withFindings([f("info"), f("minor")]),
      emptySummary: withFindings([{ id: "f1", severity: "info", summary: "" }]),
      longSummary: withFindings([{ id: "f1", severity: "info", summary: "ä".repeat(257) }]),
    }, "REVIEW_FORMAT");
    expect(outcome(py([withFindings([{ id: "f1", severity: "info", summary: "ä".repeat(256) }])])[0]!)).toBe("PASS");
  });
});

describe("supersedes exactness (contract C §3, AV-182)", () => {
  const blocker = review("no", { state: "CHANGES_REQUESTED", minute: 1 });
  const other = review(revoke(), { minute: 2 });
  const neutral = review("plain note", { minute: 3 });
  const latest = (supersedes: NonNullable<ApproveOpts["supersedes"]>) => select([blocker, other, neutral, review(approve({ supersedes }), { minute: 4 })]);

  it("AV-182 supersedes missing a current blocker is REVIEW_BLOCKED", () => {
    expect(outcome(py([latest([supersede(blocker)])])[0]!)).toBe("REVIEW_BLOCKED");
  });

  it("AV-182 listing a non-blocker, a duplicate, a stale bodyHash or state is REVIEW_BINDING", () => {
    const all = [supersede(blocker), supersede(other)];
    expectAll({
      nonBlocker: latest([...all, supersede(neutral)]),
      pendingState: latest([...all, { ...supersede(neutral), state: "PENDING" }]),
      unknownId: latest([...all, { reviewId: 1, bodyHash: "0".repeat(64), state: "COMMENTED" }]),
      duplicate: latest([...all, supersede(blocker)]),
      staleHash: latest([{ ...supersede(blocker), bodyHash: sha256("old body") }, supersede(other)]),
      staleState: latest([{ ...supersede(blocker), state: "DISMISSED" }, supersede(other)]),
    }, "REVIEW_BINDING");
  });

  it("no transitivity: a supersession declared by an earlier approve does not carry forward", () => {
    const first = review(approve({ supersedes: [supersede(blocker)] }), { minute: 2 });
    const res = outcomes({
      carried: select([blocker, first, review(approve(), { minute: 3 })]),
      restated: select([blocker, first, review(approve({ supersedes: [supersede(blocker)] }), { minute: 3 })]),
    });
    expect(res).toEqual({ carried: "REVIEW_BLOCKED", restated: "PASS" });
  });
});

describe("provider rule and profiles (PKG §9, contract C §3)", () => {
  const openai = { provider: "openai", model: "gpt-6" };
  const body = approve({ reviewer: openai, reportText: report({ reviewer: openai }) });

  it("DEV with an OpenAI developer requires an anthropic external reviewer", () => {
    const res = outcomes({
      openaiDev: select([review(body)], { developer_provider: "openai" }),
      codexDev: select([review(body)], { developer_provider: "codex" }),
      otherDev: select([review(body)], { developer_provider: "anthropic" }),
    });
    expect(res).toEqual({ openaiDev: "REVIEW_BINDING", codexDev: "REVIEW_BINDING", otherDev: "PASS" });
  });

  it("OWNER_OPS has no automatic provider rule; independence is reported owner_attested", () => {
    const [res] = py([select([review(body)], { profile: "OWNER_OPS", developer_provider: null })]);
    expect(outcome(res!)).toBe("PASS");
    expect(res!.ok).toMatchObject({ providerRule: false, independence: "owner_attested" });
  });

  it("caller errors (unknown profile, incomplete binding) are EXECUTION_INTERNAL", () => {
    const { runAttempt: _drop, ...partial } = BINDING;
    expectAll({
      profile: select([review(approve())], { profile: "ADMIN" }),
      binding: select([review(approve())], { binding: partial }),
    }, "EXECUTION_INTERNAL");
  });

  it("malformed Owner review records are EXECUTION_API; other users' records are ignored", () => {
    const res = outcomes({
      noTime: select([review(approve(), { submitted_at: null })]),
      badTime: select([review(approve(), { submitted_at: "2026-10-04 12:00:00" })]),
      badState: select([review(approve(), { state: "COMMENT" })]),
      dupId: select([review(approve(), { id: 5, minute: 1 }), review(approve(), { id: 5, minute: 2 })]),
      strangerMalformed: select([review(approve()), review("x", { userId: 7, state: "??", submitted_at: null })]),
    });
    expect(res).toEqual({ noTime: "EXECUTION_API", badTime: "EXECUTION_API", badState: "EXECUTION_API", dupId: "EXECUTION_API", strangerMalformed: "PASS" });
  });
});

describe("attestation body format (PKG §9)", () => {
  const good = approve();

  it("approve and revoke variants parse to their fields", () => {
    const res = run({ approve: parse(good), revoke: parse(revoke()) });
    expect(res["approve"]!.ok).toMatchObject({ action: "approve", binding: BINDING, externalReviewResult: "approve", supersedes: [] });
    expect(res["revoke"]!.ok).toEqual({ action: "revoke", binding: BINDING, supersedes: [] });
  });

  it("anything but the exact header + canonical two-space JSON + LF is REVIEW_FORMAT", () => {
    const obj = approveObject();
    const json = canonical(obj);
    expectAll({
      bom: parse(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(good)])),
      crlf: parse(good.replace(/\n/g, "\r\n")),
      headerCase: parse("forge-attestation-v1\n" + json),
      headerV2: parse("FORGE-ATTESTATION-V2\n" + json),
      noTrailingLf: parse(good.slice(0, -1)),
      extraLf: parse(good + "\n"),
      prose: parse(good + "Thanks!\n"),
      compact: parse(HEADER + JSON.stringify(obj) + "\n"),
      fourSpaces: parse(HEADER + JSON.stringify(obj, null, 4) + "\n"),
      keyOrder: parse(HEADER + canonical({ action: "approve", ...obj })),
      duplicateKey: parse(good.replace('  "pr": 7,\n', '  "pr": 7,\n  "pr": 7,\n')),
      unknownField: parse(HEADER + canonical({ ...obj, note: "x" })),
      missingField: parse(HEADER + canonical(Object.fromEntries(Object.entries(obj).filter(([k]) => k !== "deployment")))),
      floatRunId: parse(good.replace('"runId": 123', '"runId": 123.0')),
      zeroPr: parse(HEADER + canonical({ ...obj, pr: 0 })),
      stringPr: parse(HEADER + canonical({ ...obj, pr: "7" })),
      upperHex: parse(HEADER + canonical({ ...obj, head: "A".repeat(40) })),
      formatTwo: parse(HEADER + canonical({ ...obj, format: 2 })),
      formatTrue: parse(good.replace('"format": 1', '"format": true')),
      actionOther: parse(HEADER + canonical({ ...obj, action: "approved" })),
      badCheckedAt: parse(HEADER + canonical({ ...obj, deployment: { policyDigest: "e".repeat(64), checkedAt: "2026-10-04T12:00:00.000Z" } })),
      deploymentExtra: parse(HEADER + canonical({ ...obj, deployment: { policyDigest: "e".repeat(64), checkedAt: "2026-10-04T12:00:00Z", x: 1 } })),
      reviewerExtra: parse(HEADER + canonical({ ...obj, externalReviewer: { ...REVIEWER, label: "chat" } })),
      supersedesExtra: parse(approve({ supersedes: [{ reviewId: 1, bodyHash: "0".repeat(64), state: "DISMISSED", note: 1 } as never] })),
      supersedesState: parse(approve({ supersedes: [{ reviewId: 1, bodyHash: "0".repeat(64), state: "COMMENT" }] })),
      invalidUtf8: parse(Buffer.concat([Buffer.from(HEADER), Buffer.from([0xff]), Buffer.from(json)])),
      empty: parse(""),
    }, "REVIEW_FORMAT");
  });

  it("revoke must carry exactly the binding fields, action and an empty supersedes", () => {
    const base = { format: 1, ...BINDING, action: "revoke", supersedes: [] };
    expectAll({
      withSupersedes: parse(HEADER + canonical({ ...base, supersedes: [{ reviewId: 1, bodyHash: "0".repeat(64), state: "DISMISSED" }] })),
      withDeployment: parse(HEADER + canonical({ ...base, deployment: { policyDigest: "e".repeat(64), checkedAt: "2026-10-04T12:00:00Z" } })),
      withExternal: parse(HEADER + canonical({ ...approveObject(), action: "revoke" })),
      missingRun: parse(HEADER + canonical(Object.fromEntries(Object.entries(base).filter(([k]) => k !== "runAttempt")))),
    }, "REVIEW_FORMAT");
  });

  it("embedded external report: canonical base64, strict JSON, closed fields, size limit", () => {
    const text = report();
    const enc = Buffer.from(text).toString("base64");
    const withB64 = (value: string) => parse(approve({ edit: (a) => { a["externalReviewBase64"] = value; } }));
    const big = canonical({ ...JSON.parse(text), findings: Array.from({ length: 80 }, (_, i) => ({ id: `f${i}`, severity: "info", summary: "s".repeat(400) })) });
    expectAll({
      nonCanonicalB64: withB64(enc.replace(/=+$/, "")),
      whitespaceB64: withB64(enc.slice(0, 8) + "\n" + enc.slice(8)),
      notJson: withB64(Buffer.from("not json").toString("base64")),
      emptyReport: withB64(""),
      duplicateKey: withB64(Buffer.from(text.replace('"result": "approve"', '"result": "approve", "result": "approve"')).toString("base64")),
      extraKey: withB64(Buffer.from(canonical({ ...JSON.parse(text), envelope: 1 })).toString("base64")),
      bindingRunId: withB64(Buffer.from(canonical({ ...JSON.parse(text), binding: { ...JSON.parse(text).binding, runId: 1 } })).toString("base64")),
      formatTwo: withB64(Buffer.from(canonical({ ...JSON.parse(text), format: 2 })).toString("base64")),
      over32KiB: withB64(Buffer.from(big).toString("base64")),
    }, "REVIEW_FORMAT");
    // Strict, not canonical: a compact report with any key order is accepted.
    const compact = JSON.stringify({ findings: [], result: "approve", reviewer: REVIEWER, binding: JSON.parse(text).binding, format: 1 });
    expect(outcome(py([select([review(approve({ reportText: compact }))])])[0]!)).toBe("PASS");
  });
});

describe("review snapshot digest (contract C §4, AV-154, AV-156, AV-180)", () => {
  const owner = [review(approve(), { minute: 1 }), review("no", { state: "CHANGES_REQUESTED", minute: 2, commit_id: OLD_H })];

  function oracle(reviews: Review[]): string {
    const entries = reviews
      .filter((r) => r.user.id === OWNER_ID && r.state !== "PENDING")
      .map((r) => ({ id: r.id, state: r.state, commitId: r.commit_id, submittedAt: r.submitted_at, bodySha256: sha256(Buffer.from(r.body, "utf8")) }))
      .sort((x, y) => (x.submittedAt! < y.submittedAt! ? -1 : x.submittedAt! > y.submittedAt! ? 1 : x.id - y.id));
    return sha256(Buffer.concat([Buffer.from("forge-review-snapshot-v1\n"), Buffer.from(canonical(entries), "utf8")]));
  }

  it("equals the spec computation, ignores input order, PENDING and other users", () => {
    const noise = [review("x", { userId: 1, login: OWNER_LOGIN, minute: 3 }), review(approve(), { state: "PENDING", submitted_at: null })];
    const res = run({ plain: digest(owner), shuffled: digest([...noise, owner[1]!, owner[0]!]), empty: digest([]) });
    expect(res["plain"]!.ok).toBe(oracle(owner));
    expect(res["shuffled"]!.ok).toBe(oracle(owner));
    expect(res["empty"]!.ok).toBe(sha256("forge-review-snapshot-v1\n[]\n"));
  });

  it("AV-154 / AV-180 an edited body, state or commit between observations changes the digest (REVIEW_CHANGED in final.py)", () => {
    const res = run({
      before: digest(owner),
      bodyEdit: digest([{ ...owner[0]!, body: owner[0]!.body + " " }, owner[1]!]),
      dismissed: digest([owner[0]!, { ...owner[1]!, state: "DISMISSED" }]),
      commit: digest([{ ...owner[0]!, commit_id: OLD_H }, owner[1]!]),
      newReview: digest([...owner, review("note", { minute: 9 })]),
    });
    const values = Object.values(res).map((r) => r.ok);
    expect(new Set(values).size).toBe(values.length);
  });

  it("AV-156 a deleted decisive review changes the digest (REVIEW_CHANGED in final.py)", () => {
    const res = run({ before: digest(owner), deleted: digest([owner[1]!]) });
    expect(res["deleted"]!.ok).not.toBe(res["before"]!.ok);
  });
});
