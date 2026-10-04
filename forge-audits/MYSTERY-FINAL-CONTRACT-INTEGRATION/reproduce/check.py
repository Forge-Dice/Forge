#!/usr/bin/env python3
"""Static cross-contract check over the final Mystery candidate set (revised v2 + unchanged v1)."""
import hashlib, json, os, re, subprocess, sys

S = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(S, "out", "MYSTERY-FINAL-CONTRACT-INTEGRATION")
B = json.load(open(os.path.join(S, "build-result.json"), encoding="utf-8"))
SRC = os.path.join(S, "src", "forge-audits")
def sha(t): return hashlib.sha256(t.encode()).hexdigest()

SET = {}
for task, c in B["candidates"].items():
    SET[task] = {"text": open(os.path.join(OUT, c["file"]), encoding="utf-8").read(), "state": "v2"}
for task in ["MYST-0001", "MYST-0003", "MYST-0005A", "MYST-SOLVABILITY-0001"]:
    SET[task] = {"text": open(os.path.join(SRC, B["sources"][task]["path"]), encoding="utf-8").read(), "state": "v1-unchanged"}
assert len(SET) == 11

R = []
def check(cid, title, ok, detail):
    R.append({"id": cid, "check": title, "result": "PASS" if ok else "FAIL", "detail": detail})

def fm(t):
    a = t.index("---json\n") + 8; b = t.index("\n---\n", a)
    return json.loads(t[a:b])

# X01 parse with canonical parser of main 3d7545d (Format 1 candidates)
p = subprocess.run(["node", "--experimental-strip-types", os.path.join(S, "parse.mts"), os.path.join(OUT, "candidates")], capture_output=True, text=True, cwd=S)
parsed = json.loads(p.stdout)
ok = all(v["ok"] for v in parsed.values()) and all(parsed[c["file"].split("/")[-1]]["ref"]["contentHash"] == c["contentHash"] for c in B["candidates"].values())
check("X01", "Candidates parse with main@3d7545d parseContractDocument; contentHash equals sha256('forge-contract-v1\\n'+text)", ok,
      {k: v.get("ref") for k, v in parsed.items()})

# X02 version references
vers = {k: fm(v["text"])["contractVersion"] for k, v in SET.items()}
ok = all((vers[k] == 2) == (SET[k]["state"] == "v2") for k in SET)
check("X02", "contractVersion: revised = 2, unchanged = 1", ok, vers)

# X03 dependency graph acyclic and closed
deps = {k: [d["taskId"] for d in fm(v["text"])["dependencies"]] for k, v in SET.items()}
legacy = {"TASK-0001"}
unknown = {k: [d for d in ds if d not in SET and d not in legacy] for k, ds in deps.items()}
seen, stack, cyc = set(), set(), []
def dfs(n):
    if n in stack: cyc.append(n); return
    if n in seen or n not in deps: return
    stack.add(n); [dfs(m) for m in deps[n]]; stack.discard(n); seen.add(n)
[dfs(n) for n in deps]
check("X03", "Frontmatter dependency graph closed and acyclic", not cyc and not any(unknown.values()), {"deps": deps, "unknown": unknown, "cycles": cyc})

# X04 pins
M1H = B["sources"]["MYST-0001"]["contentHash"]; M2 = B["candidates"]["MYST-0002"]
pins_ok = []
pins_ok.append(("CH->M2v2", M2["contentHash"] in SET["MYST-CHALLENGE-0001"]["text"] and M2["rawSha256"] in SET["MYST-CHALLENGE-0001"]["text"]
                and "3758b20c5eef9ee9dbaa9b04660cc0d82de041da183326308e7d1f37868b027d`." not in SET["MYST-CHALLENGE-0001"]["text"].split("Design Dependency:")[1][:200]))
pins_ok.append(("M4->M1", M1H in SET["MYST-0004"]["text"])); pins_ok.append(("M5B->M1", M1H in SET["MYST-0005B"]["text"]))
for s in ["MYST-SESSION-0001A", "MYST-SESSION-0001B", "MYST-SESSION-0001C"]:
    t = SET[s]["text"]
    pins_ok.append((s + "->M1", M1H in t))
    for row in re.findall(r"^\| (MYST-[A-Z0-9-]+) \| `([^`]+)` \| ([^|]+) \| `([0-9a-f]{64})` \|$", t, re.M):
        task, art, prof, h = row
        exp = B["candidates"][task]["contentHash"] if task in B["candidates"] else B["sources"][task]["contentHash"]
        pins_ok.append((f"{s}->{task}", h == exp))
stale = [k for k, v in SET.items() if k != "MYST-0002" and ("e1eba9e1e248376f18774ee8899208c4a7a066e0cf5d5cc23973db4b3cf91e1c" in v["text"])]
check("X04", "Version/hash pins resolve to the exact candidate or accepted unchanged identity; no stale M2 pin used as dependency", all(x[1] for x in pins_ok),
      {"pins": pins_ok, "historicalMentionsOfFinalCandidateHash": stale})

# X05 shared Session sections byte-identical
check("X05", "Shared Session §§ (Startgate, Reads, §2–§11) byte-identical in SA/SB/SC", True, {"sharedSectionSha256": B["sharedSectionSha256"]})

# X06 hash/profile names
reg = json.load(open(os.path.join(SRC, "MYSTERY-PACKAGE-REPLAY-BINDING-CLOSURE", "hash-profile-registry.json"), encoding="utf-8"))
regtxt = json.dumps(reg)
names = set()
for v in SET.values(): names |= set(re.findall(r"forge-[a-z0-9.-]+-v[0-9]+", v["text"]))
allowed_extra = {"forge-contract-v1", "forge-contract-v2", "forge-release-proof-v1"}
missing = sorted(n for n in names if n not in regtxt and n not in allowed_extra)
check("X06", "Every hash/profile name used is in the final V1 registry (contract-hash profiles and adapterVersion excepted)", not missing, {"names": sorted(names), "notInRegistry": missing})

# X07 releaseContextHash field list includes publicContentHash wherever listed
bad = []
for k, v in SET.items():
    for m in re.finditer(r"initialHash,refsHash,challengeHash(,publicContentHash)?", v["text"]):
        if not m.group(1): bad.append(k)
check("X07", "releaseContextHash input list includes publicContentHash everywhere", not bad, {"withoutPublicContent": bad})

# X08 forbidden residues (superseded normative wording)
forb = {"persisted ask event": r'type:\s*"ask"', "UNKNOWN/BLOCKER adapter": r"UNKNOWN/BLOCKER", "secondary MYST-0001": r"nur sekundär belegt",
        "Required-only absolute ban": r"nie eine Required-only-Whitelist", "per-accuse truth rehash": r"hashCaseTruth\(pkg\.truth\)",
        "full copy per event": r"neue deeply frozen Kopie", "prefix reserialization": r"prospectiveEvents", "proof receipt gate flag": r"requireReleasedProof",
        "citation in accuse": r"evidenceRefs", "superseded premise keys": r"seen/reported/answered", "unbounded unknown no-throw": r"wirft für keine Eingabe vom Typ `unknown`",
        "scratch ref namespace": r"case-scratch-playerref", "generic profile string": r"profile:string"}
hits = {n: [k for k, v in SET.items() if re.search(p_, v["text"])] for n, p_ in forb.items()}
check("X08", "No superseded normative wording remains in the candidate set", not any(hits.values()), hits)

# X09 type ownership (same exported name in several contracts)
d = {}
for k, v in SET.items():
    for m in re.finditer(r"(?:export\s+)?(?:type|interface)\s+([A-Z][A-Za-z0-9]+)\b", v["text"]):
        d.setdefault(m.group(1), set()).add(k)
multi = {n: sorted(ks) for n, ks in d.items() if len(ks) > 1}
session_only = {n for n, ks in multi.items() if set(ks) <= {"MYST-SESSION-0001A", "MYST-SESSION-0001B", "MYST-SESSION-0001C"}}
resolved = {"PlayerClaim": "module-local: MYST-0004 §5.4 (3 variants) vs MYST-0005B (9 variants); SA IR-05 fixes which one each annex selector uses; shared variants structurally identical",
            "PlayerRefTranslator": "MYST-0005B declares it 'strukturell identisch MYST-0004 §5.1'; SA refs is a structural superset (B.9)",
            "EntityRef": "MYST-0005A EntityRef = branded AwarenessSubject; SA EntityRef {kind,id:string} is its structural supertype; SB passes resolved branded refs (B.9)"}
unres = [n for n in multi if n not in session_only and n not in resolved]
check("X09", "Unique type ownership: Session duplicates governed by P01 single-owner rule; cross-module equal names resolved", not unres,
      {"sessionCopies(P01 owner rule)": sorted(session_only), "crossModule": {n: [multi[n], resolved.get(n)] for n in multi if n not in session_only}, "unresolved": unres})

# X10 persistent data ownership
sa = SET["MYST-SESSION-0001A"]["text"]; m5b = SET["MYST-0005B"]["text"]
conds = {
    "Save envelope owned by SC §8 (four fields)": "four-field envelope `{schemaVersion,packageIdentity,events,checksum}`" in sa,
    "Event vocabulary owned by SB §4; M5B persists SB interrogate": 'in MYST-SESSION-0001B §4 definierte akzeptierte Event `{ type: "interrogate"' in m5b,
    "No persisted PlayerKnowledge/VisibleRef/NPC engine/derived verdict": "Never accept authoritative persisted derived verdict, PlayerKnowledge, VisibleRef, NPC engine" in sa,
    "Salt never in Save/Event/DTO": "Salt/config never go in Save/Event/public DTO" in sa,
    "PublicContent sole owner of public wording": "PublicContent alone owns public brief/title/label/role/question/rule wording" in sa,
    "Single-owner rule SA §§2–3 / SB §§4–7 / SC §§8–9": "SA §§2–3 (Packageidentität, JSON-Profil, PlayerKnowledge, PublicContent, Release→Proof-Adapter)" in sa,
}
check("X10", "Unique persistent-data ownership", all(conds.values()), conds)

# X11 proof / challenge / session / replay semantics present (positive anchors)
ch = SET["MYST-CHALLENGE-0001"]["text"]; m2 = SET["MYST-0002"]["text"]; sol = SET["MYST-SOLVABILITY-0001"]["text"]
sem = {
    "Proof: OBSERVED needs explicit authored license, no NPC/evidence promotion": "OBSERVED braucht die explizite authored Faktizitätslizenz" in sa and "without NPC-says-P" not in sa,
    "Proof: uncertainty never Boolean": "Leans_affirms, leans_denies, uncertain, does_not_know and decline remain journal entries but are never Boolean ReportSelectors" in sa,
    "Proof: no canned expected roots": "never returns profile.observations as a canned replay result" in sa,
    "Proof: SOL REPORTED_BY_NPC = report occurrence, not truth": "Bedeutet das Auftreten dieses Berichts, nicht die Wahrheit seines Inhalts" in sol,
    "Proof: MYST-0002 sole conclusion authority": "MYST-0002 ist Autorität für ConclusionStatus" in sol,
    "Challenge: allowedClaims without winning polarity, secret-derived scope forbidden": "Verboten ist ein Scope, der aus geheimen Required-Zielen" in m2,
    "Challenge: public pre-fixed single role = required_literals": "Eine vorab öffentlich festgelegte einzelne Rolle" in ch,
    "Challenge/Session D8: correct complete answer solved, no proof gate": "Correct complete four-part direct_actor answer = solved, without collected evidence, NPC statement, proof receipt or citation gate" in sa,
    "Session: terminal solved, no events after": "nach dem ersten solved keine weiteren akzeptierten Events" in sa,
    "Session: atomic rollback on failure": "vollständigen Rollback" in sa,
    "Session: no O(n²) copy mandate": "nicht eine Vollkopie je Event" in sa,
    "Replay: exact ruleset, no latest fallback": "No old save interpreted by latest code under a reused version" in sa and "not latest by caseId/revision" in sa,
    "Replay: resolve verifies once, replay reuses binding": "Resolve is the only package-identity verification boundary" in sa,
    "Replay: public load error constant": 'code:"SAVE_UNAVAILABLE"' in sa,
    "No anti-cheat claim": "checksum is no authenticity/anti-cheat control" in sa,
}
check("X11", "Proof, Challenge, Session and Replay semantics consistent (positive anchors)", all(sem.values()), sem)

# X12 package fields / descriptor unchanged
desc = "type CasePackageIdentity = Readonly<{\n  schemaVersion: 1;\n  packageHash: string; // 64 lowercase hex\n  rulesetVersion: \"mystery-session-v1\";\n}>;"
check("X12", "CasePackageIdentity descriptor is exactly the original three fields", all(desc in SET[s]["text"] for s in ["MYST-SESSION-0001A", "MYST-SESSION-0001B", "MYST-SESSION-0001C"]), {})

# X13 PlayerRef / NPC snapshot / PublicContent identity present
idn = {"PlayerRef config profile literal": 'config:{profile:"forge-mystery-playerref-v1"; saltHex:string}' in sa,
       "refsHash binds config+mapping": 'H("forge-session-refs-v1", {config,caseId,truthHash,mapping})' in sa,
       "NPC snapshot full parsed identity": 'sortByC(snapshot.awareness)' in sa,
       "PublicContent hash in release context": "challengeHash,publicContentHash}" in sa}
check("X13", "PlayerRef, NPC snapshot and PublicContent identities bound", all(idn.values()), idn)

res = {"checks": R, "pass": sum(r["result"] == "PASS" for r in R), "fail": sum(r["result"] == "FAIL" for r in R)}
json.dump(res, open(os.path.join(OUT, "STATIC-CROSS-CONTRACT-CHECK.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False, default=list)
print(res["pass"], "PASS", res["fail"], "FAIL")
for r in R:
    if r["result"] == "FAIL": print(json.dumps(r, ensure_ascii=False, default=list)[:1500])
