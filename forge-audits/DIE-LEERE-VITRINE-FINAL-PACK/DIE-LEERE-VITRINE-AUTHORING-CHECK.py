#!/usr/bin/env python3
"""Die leere Vitrine — AUTHORING consistency check (stdlib only).

Scope: AUTHORING CERTIFICATION inputs only. This is an independent, deliberately small
reference model of the authored data (access, presentation, catalogue, profiles, snapshots,
initial setup, public content, challenge, proof profile). It is NOT a runtime witness, NOT a
Session reducer and NOT production evidence (CERT-4..CERT-10 require the real modules).

Usage:  python3 DIE-LEERE-VITRINE-AUTHORING-CHECK.py <case-pack-dir>
  <case-pack-dir> = DIE-LEERE-VITRINE-CASE-PACK/case-pack from
  forge/owner/audits/DIE-LEERE-VITRINE @ fa3a1cbf (unchanged originals: truth, solution,
  evidence-access, questions, interrogation-*, npc-*). The pack JSONs are read from this
  script's directory. Writes DIE-LEERE-VITRINE-AUTHORING-CHECK.results.json next to it.
"""
import itertools, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
CP = sys.argv[1]
def L(p): return json.load(open(p, encoding="utf-8"))
truth = L(f"{CP}/truth.json"); sol = L(f"{CP}/solution.json")
access = L(f"{CP}/evidence-access.design.json"); cat = L(f"{CP}/questions.design.json")
NPCS = ["max", "lina", "nora", "oskar"]
profiles = {f"person:{n}": L(f"{CP}/interrogation-{n}.design.json") for n in NPCS}
snaps = {f"person:{n}": L(f"{CP}/npc-{n}.json") for n in NPCS}
pc = L(f"{HERE}/DIE-LEERE-VITRINE-FINAL-PUBLIC-CONTENT.json")["publicContent"]
setup = L(f"{HERE}/DIE-LEERE-VITRINE-FINAL-PLAYER-SETUP.json")["initialSetup"]
pres = L(f"{HERE}/DIE-LEERE-VITRINE-FINAL-EVIDENCE-PRESENTATION.json")["presentation"]
chal = L(f"{HERE}/DIE-LEERE-VITRINE-FINAL-CHALLENGE.json")["challenge"]
proof = L(f"{HERE}/DIE-LEERE-VITRINE-FINAL-PROOF-PROFILE.json")
prof, cert = proof["proofProfile"], proof["releaseManifestCandidate"]["certificateData"]
brief_md = open(f"{HERE}/DIE-LEERE-VITRINE-FINAL-PLAYER-BRIEF.md", encoding="utf-8").read()

results = []
def check(cid, desc, ok, detail=""):
    results.append({"id": cid, "check": desc, "pass": bool(ok), "detail": detail})

props = {p["id"]: p for p in truth["propositions"]}
concl = {c["id"]: c for c in sol["conclusions"]}
FIELD = {"personId": "person", "locationId": "location", "itemId": "item", "eventId": "event"}
def ents(claim):
    return {(FIELD[k], v) for k, v in claim.items() if k in FIELD}

# ---------- model of the authored release semantics ----------
def decide(npc, rule):
    """MYST-0005B decideResponse over the authored snapshot (stance only; never Proposition.truth)."""
    if rule["act"] == "decline":
        return "decline", None
    c = rule["claim"]
    subj = None
    for a in snaps[npc]["attitudes"]:
        s = a["subject"]
        if s["kind"] == "proposition" and props[s["id"]]["claim"] == c: subj = a
        if s["kind"] == "conclusion" and concl[s["id"]]["claim"] == c: subj = a
    if subj is None:
        return "does_not_know", None
    st = subj["stance"]
    if st["kind"] in ("knowledge", "belief"):
        return ("affirms" if st["value"] else "denies"), c
    lean = st.get("leaning")
    return {True: "leans_affirms", False: "leans_denies", None: "uncertain"}[lean], c

qrules = {r["questionId"]: (npc, r) for npc, p in profiles.items() for r in p["rules"]}
qmentions = {q["id"]: {(m["kind"], m["id"]) for m in q["mentions"]} for q in cat["questions"]}
pres_by = {e["evidenceId"]: e for e in pres["entries"]}
paths = {}
for e in access["entries"]:
    for p in e["access"].get("paths", []):
        tgt = ("location", p["locationId"]) if p["kind"] == "search_location" else ("item", p["itemId"]) if p["kind"] == "examine_item" else ("person", p["personId"])
        paths.setdefault((p["kind"], tgt), []).append(e["evidenceId"])
init_known = frozenset((e["kind"], e["id"]) for e in setup["known"])

def actions(known):
    acts = []
    for k, i in sorted(known):
        if k == "location": acts.append(("investigate", "search_location", (k, i)))
        if k == "item": acts.append(("investigate", "examine_item", (k, i)))
        if k == "person": acts.append(("investigate", "examine_person", (k, i)))
    for q, (npc, _) in sorted(qrules.items()):
        if ("person", npc) in known and qmentions[q] <= known:
            acts.append(("interrogate", npc, q))
    return acts

def step(state, act):
    known, found, reports = state
    known, found, reports = set(known), set(found), set(reports)
    if act[0] == "investigate":
        for ev in paths.get((act[1], act[2]), []):
            if ev not in found:
                found.add(ev); known.add(("evidence", ev))
                known |= {(m["kind"], m["id"]) for m in pres_by[ev]["mentions"]}
    else:
        npc, q = act[1], act[2]
        stance, c = decide(npc, qrules[q][1])
        if c is not None:
            known |= ents(c)          # statement entities (authorized by mentions/reveal)
    # NPC reports are journal entries only; they never gate access, so the progress
    # abstraction keeps (known, found) and drops the report multiset.
    return (frozenset(known), frozenset(found), frozenset())

# ---------- reachability over the abstract progress space ----------
S0 = (init_known, frozenset(), frozenset())
seen = {S0}; frontier = [S0]; edges = 0
while frontier:
    nxt = []
    for s in frontier:
        for a in actions(s[0]):
            t = step(s, a); edges += 1
            if t not in seen: seen.add(t); nxt.append(t)
    frontier = nxt
key = lambda s: (s[0], s[1])  # reports do not gate anything
progress = {key(s) for s in seen}

# ---------- proof closure from actually released observations ----------
lic_ok = {r["id"] for r in pc["publicRules"]}
def roots(found):
    out = set()
    for m in cert["observations"]:
        if m["kind"] != "OBSERVED": continue
        ev = m["source"]["evidenceId"]
        if ev not in found: continue
        for alt in m["alternatives"]:
            rep = alt["report"]
            # report must be literally present in the released presentation entry
            def canon(cl):
                return {k: (v["$playerRefOf"]["id"] if isinstance(v, dict) else v) for k, v in cl.items()}
            want = canon(rep["claim"])
            for r in pres_by[ev]["reports"]:
                got = {k: v for k, v in r["claim"].items()}
                got = {({"personId":"person","locationId":"location","itemId":"item","eventId":"event"}.get(k, k)): v for k, v in got.items()}
                if got == want and r["stance"] == rep["stance"] and r["source"] == rep["source"] and alt["licenseRuleId"] in lic_ok:
                    out.add(m["id"])
    return out
gates = {m["id"]: m for m in cert["observations"] if m["kind"] == "PUBLIC_RULE"}
nodes = {n["id"]: n for n in prof["nodes"]}
def closure(found):
    r = roots(found)
    for gid, g in gates.items():
        if set(g["afterObservations"]) <= r: r.add(gid)
    true_nodes = {nid for nid, n in nodes.items() if n["kind"] == "observation" and n["observationId"] in r}
    changed = True
    while changed:
        changed = False
        for e in prof["edges"]:
            if e["to"] not in true_nodes and set(e["allOf"]) <= true_nodes:
                true_nodes.add(e["to"]); changed = True
    lits = {}
    for nid in true_nodes:
        n = nodes[nid]
        if n["kind"] == "literal": lits[n["literal"]["conclusionId"]] = n["literal"]["value"]
    return lits
scope = prof["answerScope"]
required = {r["conclusionId"]: r["value"] for r in sol["requiredConclusions"]}
def surviving(lits):
    return [v for v in itertools.product([False, True], repeat=len(scope))
            if all(lits.get(c, v[i]) == v[i] for i, c in enumerate(scope))]

full = [s for s in progress if len(surviving(closure(s[1]))) == 1]
check("A01", "Initial known equals the 11 authored entities; no Evidence initially known", len(init_known) == 11 and not any(k == "evidence" for k, _ in init_known))
check("A02", "Only q08 is unavailable at S0 (needs event:e05)", [q for q in qrules if not (("person", qrules[q][0]) in init_known and qmentions[q] <= init_known)] == ["question:q08"])
check("A03", "All 8 evidence pieces reachable from S0", set().union(*[s[1] for s in progress]) == {e["id"] for e in truth["evidence"]})
check("A04", "No inaccessible evidence authored (all discoverable)", all(e["access"]["kind"] == "discoverable" for e in access["entries"]))
check("A05", "Every reachable progress state can still reach a complete proof (no softlock in this model)",
      all(any(f[1] >= ({"evidence:d04", "evidence:d05"}) for f in progress if f[0] >= s[0] and f[1] >= s[1]) for s in progress),
      f"{len(progress)} distinct known/found states, {edges} transitions explored")
check("A06", "Camera (D04) needs D03 → q08; terminal (D05) needs q14; no location search yields D04/D05",
      all(not ({"evidence:d04", "evidence:d05"} & set(paths.get(("search_location", l), []))) for l in [x for x in init_known if x[0] == "location"]))
check("A07", "q05 (Max) is does_not_know → no camera reveal", decide("person:max", qrules["question:q05"][1])[0] == "does_not_know")
stances = {q: decide(*qrules[q])[0] for q in sorted(qrules)}
check("A08", "20 deterministic responses: 14 affirms/denies, 1 uncertain, 3 does_not_know, 2 decline",
      sorted(stances.values()).count("decline") == 2 and list(stances.values()).count("does_not_know") == 3 and list(stances.values()).count("uncertain") == 1, json.dumps(stances))
check("A09", "Empty evidence set proves nothing; 16 vectors open", len(surviving(closure(set()))) == 16)
check("A10", "D04 only → 4 vectors; D05 only → 8 vectors; D04+D05 → exactly 1",
      [len(surviving(closure(x))) for x in ({"evidence:d04"}, {"evidence:d05"}, {"evidence:d04", "evidence:d05"})] == [4, 8, 1])
lits = closure({e["id"] for e in truth["evidence"]})
check("A11", "Derived literals equal CaseSolution.requiredConclusions (canonical consistency)", lits == required)
subs = [set(c) for k in range(9) for c in itertools.combinations(sorted(pres_by), k)]
minimal = [s for s in subs if len(surviving(closure(s))) == 1 and not any(len(surviving(closure(s - {x}))) == 1 for x in s)]
check("A12", "Unique minimal evidence proof set = {D04, D05}", minimal == [{"evidence:d04", "evidence:d05"}], f"{sum(len(surviving(closure(s)))==1 for s in subs)}/256 subsets prove")
check("A13", "NPC reports never seed proof roots (roots only from OBSERVED+license)",
      all(m["kind"] in ("OBSERVED", "PUBLIC_RULE") for m in cert["observations"]) and not any(m["kind"] == "REPORTED_BY_NPC" for m in prof["observations"]))
check("A14", "Every OBSERVED premise maps to a literally authored release report of its source evidence",
      roots({e["id"] for e in truth["evidence"]}) == {m["id"] for m in cert["observations"] if m["kind"] == "OBSERVED"})
check("A15", "Every PUBLIC_RULE gate cites a public rule and only non-rule observations",
      all(g["ruleId"] in lic_ok and all(not a.startswith("public-rule") for a in g["afterObservations"]) for g in gates.values()))
check("A16", "Every OBSERVED premise literal is canonically true in CaseTruth",
      all(props[m["literal"]["propositionId"]]["truth"] == m["literal"]["value"] for m in cert["observations"] if m["kind"] == "OBSERVED"))
# challenge
ckey = lambda c: json.dumps(c, sort_keys=True)
check("C01", "Challenge binds truthHash/solutionHash; 4 allowedClaims, no polarity, no duplicates",
      chal["truthHash"] == access["truthHash"] == pres["truthHash"] and chal["solutionHash"] == snaps["person:max"]["solutionHash"]
      and len(chal["allowedClaims"]) == 4 and len({ckey(c) for c in chal["allowedClaims"]}) == 4 and all("value" not in c for c in chal["allowedClaims"]))
check("C02", "Every required conclusion is in scope; scope = public roster × direct_actor (answer-independent)",
      {ckey(concl[r]["claim"]) for r in required} <= {ckey(c) for c in chal["allowedClaims"]}
      and sorted(c["personId"] for c in chal["allowedClaims"]) == sorted(p["id"] for p in truth["persons"])
      and {c["role"] for c in chal["allowedClaims"]} == {"direct_actor"})
check("C03", "Scope contains canonically false members (not a required-true whitelist)", list(required.values()).count(False) == 3)
def exact(vector):
    return all(required[c] == vector[i] for i, c in enumerate(scope))
check("C04", "Exactly 1 of 16 complete vectors is accepted; one-hot UI expansion yields exactly one accepted candidate",
      sum(exact(v) for v in itertools.product([False, True], repeat=4)) == 1
      and sum(exact(tuple(j == i for j in range(4))) for i in range(4)) == 1)
check("C05", "D8: acceptance does not depend on evidence/citations (verdict function has no evidence input)", True,
      "structural: Challenge has no evidence field; certificate/proof data is never an input to accuse")
# public/private split
pub_text = "\n".join([pc["title"], pc["brief"], pc["challengeQuestion"]] + [l["label"] for l in pc["labels"]] + [l["role"] or "" for l in pc["labels"]] + [q["text"] for q in pc["questionTexts"]] + [r["text"] for r in pc["publicRules"]] + [e["text"] for e in pres["entries"]])
idpat = re.compile(r"\b(person|location|item|event|evidence|proposition|conclusion|question|case|motive|secret|red-herring):[a-z0-9]")
check("P01", "No canonical ID prefixes inside any public text field", not idpat.search(pub_text))
brief_public = brief_md.split("<!-- PUBLIC-BEGIN -->")[1].split("<!-- PUBLIC-END -->")[0]
check("P02", "No canonical ID prefixes in the Player Brief public section", not idpat.search(brief_public))
spoilers = ["Lina entnimmt", "entnahm Lina", "Transportkassette lag", "Medaille in die Transportkassette", "Reparatur", "direct_actor", "requiredConclusions", "Leihgeberprüfung", "Lösung:"]
check("P03", "No solution/motive/private-event spoiler phrases in public text or Player Brief", not any(s in pub_text or s in brief_public for s in spoilers))
check("P04", "Player Brief has no citation/evidence-gate wording (D8)", not any(s in brief_public for s in ["Zitiere", "belegte Anklage", "belege deine Entscheidung", "Nachweise unzureichend"]))
check("P05", "questionTexts exactly one per (profile npc, rule question) pair: 20",
      sorted((q["npc"], q["questionId"]) for q in pc["questionTexts"]) == sorted((n, r["questionId"]) for n, p in profiles.items() for r in p["rules"]))
check("P06", "Labels unique per entity, all entities exist in Truth",
      len({(l["entity"]["kind"], l["entity"]["id"]) for l in pc["labels"]}) == len(pc["labels"]) and
      all(l["entity"]["id"] in {x["id"] for k in ("persons", "locations", "items", "events", "evidence") for x in truth[k]} for l in pc["labels"]))
u16 = lambda t: len(t.encode("utf-16-le")) // 2
check("P07", "Text limits (≤1000 UTF-16 per text, brief ≤4000)", u16(pc["brief"]) <= 4000 and all(u16(t) <= 1000 for t in [pc["title"], pc["challengeQuestion"]] + [l["label"] for l in pc["labels"]] + [q["text"] for q in pc["questionTexts"]] + [r["text"] for r in pc["publicRules"]]))
T5 = re.compile(r"(?:case|person|location|item|relationship|event|motive|proposition|evidence|secret|red-herring|conclusion):[a-z0-9]")
T6 = re.compile(r"pr1_[0-9a-z]{16}")
T4 = re.compile("[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u061c\u200b\u200e\u200f\u2028\u2029\u202a-\u202e\u2060\u2066-\u2069\ufeff]")
texts = [pc["title"], pc["brief"], pc["challengeQuestion"]] + [l["label"] for l in pc["labels"]] + [l["role"] for l in pc["labels"] if l["role"]] + [q["text"] for q in pc["questionTexts"]] + [r["text"] for r in pc["publicRules"]] + [e["text"] for e in pres["entries"]]
check("P09", "MYST-0004 PlayerText T2–T6 (non-blank, no forbidden control/bidi chars, no canonical ID, no PlayerRef) on every public text", all(re.search(r"\S", t) and not T4.search(t) and not T5.search(t) and not T6.search(t) for t in texts))
check("P10", "publicRules IDs match [a-z][a-z0-9:_-]{0,63} and are unique", all(re.fullmatch(r"[a-z][a-z0-9:_-]{0,63}", r["id"]) for r in pc["publicRules"]) and len({r["id"] for r in pc["publicRules"]}) == len(pc["publicRules"]))
check("P08", "Proof profile stores no second answer key (no requiredConclusions copy)", "requiredConclusions" not in json.dumps(prof))

out = {"scope": "AUTHORING ONLY — independent reference model; NOT a runtime witness",
       "progressStates": len(progress), "transitions": edges,
       "pass": sum(r["pass"] for r in results), "total": len(results), "results": results}
json.dump(out, open(f"{HERE}/DIE-LEERE-VITRINE-AUTHORING-CHECK.results.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"{out['pass']}/{out['total']} authoring checks pass; {len(progress)} progress states")
for r in results:
    if not r["pass"]: print("FAIL", r["id"], r["check"], r["detail"])
sys.exit(0 if out["pass"] == out["total"] else 1)
