#!/usr/bin/env python3
"""Deterministic integration of accepted Mystery repair patches into contract candidates.

Every patch is an exact OLD -> NEW replacement that must match exactly once in the
pinned source bytes. Sources come only from the remote audit branches (extracted to src/).
"""
import hashlib, json, os, re, sys

S = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(S, "src", "forge-audits")
OUT = os.path.join(S, "out", "MYSTERY-FINAL-CONTRACT-INTEGRATION")
CAND = os.path.join(OUT, "candidates")
os.makedirs(CAND, exist_ok=True)

def rd(p): return open(os.path.join(SRC, p), encoding="utf-8").read()
def sha(b): return hashlib.sha256(b.encode("utf-8") if isinstance(b, str) else b).hexdigest()
def fcv1(t): return sha("forge-contract-v1\n" + t)
def fcv2(t): return sha("forge-contract-v2\n" + t)

RP = "MYSTERY-RELEASE-PROOF-CERTIFICATION-CLOSURE"
PR = "MYSTERY-PACKAGE-REPLAY-BINDING-CLOSURE"
P = {x["id"]: x for x in json.load(open(os.path.join(SRC, RP, "CONTRACT-PATCHES.json"), encoding="utf-8"))}
ANNEX = rd(f"{RP}/SESSION-A-RELEASE-PROOF-ANNEX.md")
assert P["P05"]["NEW"] == ANNEX
REGISTRY_MD = rd(f"{PR}/hash-profile-registry.md")
REGISTRY_JSON_SHA = sha(open(os.path.join(SRC, PR, "hash-profile-registry.json"), "rb").read())
DAG_MMD = rd(f"{PR}/package-identity-dag.mmd")

SOURCES = {
    "MYST-0001": ("MYST-0001-PLAYERREF/MYST-0001-PLAYERREF-V1.contract.DRAFT.md", "forge/owner/audits/MYST-0001-PLAYERREF", "a256e5170697a76a302b765cd44a3140c5ce5da1", 2),
    "MYST-0002": ("MYST-0002-REPAIR/MYST-0002.contract.FINAL-CANDIDATE.md", "forge/owner/audits/MYST-0002-REPAIR", "ea22147f4ac1778afc8191a03f30784864d7591a", 1),
    "MYST-0003": ("MYST-0003-EVIDENCE-ACCESS/MYST-0003-EVIDENCE-ACCESS-V1.contract.DRAFT.md", "forge/owner/audits/MYST-0003-EVIDENCE-ACCESS", "8ae160f60bb9e5aeb6be20c5006aa2673408946a", 1),
    "MYST-0004": ("MYST-0004-EVIDENCE-PRESENTATION/MYST-0004-EVIDENCE-PRESENTATION-V1.contract.DRAFT.md", "forge/owner/audits/MYST-0004-EVIDENCE-PRESENTATION", "51c2ddc4b6d312729d9e0a12d8e7f544e9e6e23e", 1),
    "MYST-0005A": ("MYST-0005-INTERROGATION/MYST-0005A-INTERROGATION-AUTHORING-V1.contract.DRAFT.md", "forge/owner/audits/MYST-0005-INTERROGATION", "76405cd386894b0bf657d1222ce287b0031fb284", 1),
    "MYST-0005B": ("MYST-0005-INTERROGATION/MYST-0005B-INTERROGATION-RELEASE-V1.contract.DRAFT.md", "forge/owner/audits/MYST-0005-INTERROGATION", "76405cd386894b0bf657d1222ce287b0031fb284", 1),
    "MYST-CHALLENGE-0001": ("MYST-ACCUSATION-CHALLENGE-EXACTNESS/MYST-CHALLENGE-0001.contract.DRAFT.md", "forge/owner/audits/MYST-ACCUSATION-CHALLENGE-EXACTNESS", "7514e7e6a31e8c6c2aa03796dc0cd4c9a00ebcc8", 1),
    "MYST-SOLVABILITY-0001": ("MYSTERY-SOLVABILITY-ACCUSATION-REPAIR/MYST-SOLVABILITY-0001.contract.DRAFT.md", "forge/owner/audits/MYSTERY-SOLVABILITY-ACCUSATION-REPAIR", "f02b7a5625497ada4651181e285053f46e0a2bb8", 1),
    "MYST-SESSION-0001A": ("MYSTERY-SESSION-PRODUCTION-PACKAGE/MYST-SESSION-0001A.contract.DRAFT.md", "forge/owner/audits/MYSTERY-SESSION-PRODUCTION-PACKAGE", "b94db40e34a832d0b14450d6a4922bdf5fd54f71", 1),
    "MYST-SESSION-0001B": ("MYSTERY-SESSION-PRODUCTION-PACKAGE/MYST-SESSION-0001B.contract.DRAFT.md", "forge/owner/audits/MYSTERY-SESSION-PRODUCTION-PACKAGE", "b94db40e34a832d0b14450d6a4922bdf5fd54f71", 1),
    "MYST-SESSION-0001C": ("MYSTERY-SESSION-PRODUCTION-PACKAGE/MYST-SESSION-0001C.contract.DRAFT.md", "forge/owner/audits/MYSTERY-SESSION-PRODUCTION-PACKAGE", "b94db40e34a832d0b14450d6a4922bdf5fd54f71", 1),
}
ORIG = {k: rd(v[0]) for k, v in SOURCES.items()}
def src_identity(k):
    t = ORIG[k]
    fmt = SOURCES[k][3]
    return {"rawSha256": sha(t), "contentHashProfile": "forge-contract-v%d" % fmt,
            "contentHash": (fcv2 if fmt == 2 else fcv1)(t), "bytes": len(t.encode())}

M1H = src_identity("MYST-0001")["contentHash"]
assert M1H == "f4d3185898015901fad3155fdc37836652c486b028b30528ca4beb17f3726335"

LOG = []  # applied patch records

def apply(task, text, pid, origin, old, new, count=1):
    n = text.count(old)
    if n != count:
        sys.exit(f"ANCHOR FAIL {task} {pid}: expected {count}, found {n}: {old[:90]!r}")
    LOG.append({"task": task, "patch": pid, "origin": origin, "oldSha256": sha(old), "newSha256": sha(new),
                "OLD": old, "NEW": new})
    return text.replace(old, new)

def bump(task, text):
    old = '"contractVersion": 1,'
    return apply(task, text, "V2", "§13 Versionierung: NEW REVISION REQUIRED", old, '"contractVersion": 2,')

def demote(md):
    out = []
    for line in md.split("\n"):
        if line.startswith("# "):
            continue
        out.append("##" + line if line.startswith("## ") else line)
    return "\n".join(out).strip("\n")

# ------------------------------------------------------------------ Phase 1: leaf revisions
CAND_ID = {}

def finish(task, text, fname):
    path = os.path.join(CAND, fname)
    open(path, "w", encoding="utf-8", newline="").write(text)
    CAND_ID[task] = {"file": "candidates/" + fname, "rawSha256": sha(text), "contentHashProfile": "forge-contract-v1",
                     "contentHash": fcv1(text), "bytes": len(text.encode())}

def rev_note(task, prev, items):
    pi = src_identity(prev)
    return ("**REVISION 2 — Integration Candidate (MYSTERY-FINAL-CONTRACT-INTEGRATION, 2026-10-04).** "
            f"Vorgänger: `{SOURCES[prev][0].split('/')[-1]}` (Branch `{SOURCES[prev][1]}` @ `{SOURCES[prev][2][:12]}`, "
            f"Roh-SHA-256 `{pi['rawSha256']}`, {pi['contentHashProfile']} `{pi['contentHash']}`), unverändert archiviert. "
            "Owner-Entscheidungen D1–D10 (FORGE-MYSTERY-FINAL-OWNER-RECONCILIATION) sind angenommen. "
            "Integriert ausschließlich: " + items + " Jede Änderung ist im MYSTERY-FINAL-CONTRACT-MANIFEST.json als exakter OLD→NEW-Eintrag mit Herkunft belegt. "
            "Nicht registriert, nicht freigegeben, keine Implementierungsfreigabe. Registrierung nach Forge BOOTSTRAPPED als Format 2 (Transkodierung ohne Versionssprung).\n\n")

# --- MYST-0002
t = ORIG["MYST-0002"]; T = "MYST-0002"
t = bump(T, t)
t = apply(T, t, "M2-T1", "§13 title of revision", "# MYST-0002 v1 — Accusation & Verdict V1", "# MYST-0002 v2 — Accusation & Verdict V1")
t = apply(T, t, "M2-H1", "IR-01 version consistency (contractVersion 2)",
          "nie registriert; deshalb bleibt `contractVersion: 1`)",
          "nie registriert; deshalb blieb die FINAL-CANDIDATE-Fassung bei `contractVersion: 1`; Revision 2 siehe Revisionsvermerk)")
t = apply(T, t, "M2-REV", "§13 revision note",
          "Status: **FINAL CANDIDATE für Owner-Review**.",
          rev_note(T, T, "F05 (§15 allowedClaims, Release-Proof-Closure P09 = Master B.7) und F08 (§5.1, AC-05, AC-06, Master B.10). Wahrheitstabelle, API, Binding, Verdict-Formel, Testmatrix-Erwartungen und Mutanten unverändert. MYST-0002 bleibt alleinige Autorität für Canonical Consistency.") +
          "Status: **FINAL CANDIDATE für Owner-Review**.")
t = apply(T, t, "P09", "Release-Proof-Closure P09 (= Master B.7 NEW, identisch)", P["P09"]["OLD"], P["P09"]["NEW"])
t = apply(T, t, "B.10a", "Master B.10 (F08)",
          "Die Funktion wirft für keine Eingabe vom Typ `unknown` als `claim` (bei korrekt geparster Truth und Solution).",
          "Die Funktion wirft für keinen Plain-JSON-Wert als `claim` und für Objekte mit nicht werfenden Daten-Accessoren (AC-E5), jeweils bei korrekt geparster Truth und Solution. Werfende Accessoren, Proxies, Zyklen und fremde Prototypen sind keine unterstützte Eingabe. Der Parametertyp bleibt `unknown`, eine Sandbox wird nicht zugesagt.")
t = apply(T, t, "B.10b", "Master B.10 (F08)",
          "kein Throw für beliebige `unknown`-Claims (inkl. `null`, Array, String, Objekt mit Getter, Objekt mit Zusatzschlüssel).",
          "kein Throw für Plain-JSON-Claims (inkl. `null`, Array, String, Objekt mit Zusatzschlüssel) und für ein Objekt mit nicht werfendem Getter (AC-E5).")
t = apply(T, t, "B.10c", "Master B.10 (F08)", "`safeParse` wirft für keine Eingabe;", "`safeParse` wirft für keinen Plain-JSON-Wert;")
finish(T, t, "MYST-0002.contract.CANDIDATE-v2.md")
M2N = CAND_ID[T]

# --- MYST-CHALLENGE-0001
t = ORIG["MYST-CHALLENGE-0001"]; T = "MYST-CHALLENGE-0001"
t = bump(T, t)
t = apply(T, t, "CH-T1", "§13 title of revision", "# MYST-CHALLENGE-0001 — Exactness Wrapper V1 · DRAFT", "# MYST-CHALLENGE-0001 v2 — Exactness Wrapper V1 · CANDIDATE")
t = apply(T, t, "CH-REV", "§13 revision note",
          "**Status: DRAFT, nicht implementiert,",
          rev_note(T, T, "F05 (§6 Rollenzeile, Release-Proof-Closure P10 = Master B.7) und F12-Pin (Design Dependency auf MYST-0002 v2, Master B.15 mit Pin auf die reparierte Fassung). Evaluation, Exactness-Formel, three-valued undetermined, allowedClaims mit false/undetermined (D10) und Required-only-Verbot geheimer Auswahl unverändert. Kein Evidence-possession-Runtime-Gate.") +
          "**Status: DRAFT, nicht implementiert,")
t = apply(T, t, "P10", "Release-Proof-Closure P10 (= Master B.7 NEW, identisch)", P["P10"]["OLD"], P["P10"]["NEW"])
t = apply(T, t, "B.15-CH", "Master B.15 (F12), Pin auf reparierte M2-Fassung gemäß B.15-Hinweis",
          "Design Dependency: `MYST-0002-ACCUSATION-VERDICT-V1.contract.DRAFT.md`, Inhaltshash `sha256(\"forge-contract-v1\\n\" + exactText)` = `3758b20c5eef9ee9dbaa9b04660cc0d82de041da183326308e7d1f37868b027d`.",
          f"Design Dependency: `MYST-0002.contract.CANDIDATE-v2.md` (MYST-0002 contractVersion 2), Inhaltshash `sha256(\"forge-contract-v1\\n\" + exactText)` = `{M2N['contentHash']}` (Rohbytes-SHA-256 `{M2N['rawSha256']}`). Gegenüber den Vorgängern `3758b20c…` und FINAL-CANDIDATE `e1eba9e1…` sind Wahrheitstabelle, API, Binding und Verdict-Formel unverändert; neu sind §7a/§15 (Core ≠ Challenge), die §15-Scope-Publikationsregel (F05) und der Plain-JSON-No-throw-Umfang (F08).")
finish(T, t, "MYST-CHALLENGE-0001.contract.CANDIDATE-v2.md")

M1PIN = f"MYST-0001 v1 D3 (`MYST-0001-PLAYERREF-V1.contract.DRAFT.md`, contentHash `forge-contract-v2` `{M1H}`)"

# --- MYST-0004
t = ORIG["MYST-0004"]; T = "MYST-0004"
t = bump(T, t)
t = apply(T, t, "M4-T1", "§13 title of revision", "# MYST-0004 v1 — Evidence Presentation & Player Release V1 (DRAFT)", "# MYST-0004 v2 — Evidence Presentation & Player Release V1 (CANDIDATE)")
t = apply(T, t, "M4-REV", "§13 revision note", "Status: **DRAFT**, nicht registriert, nicht freigegeben. Ziel-Pfad",
          rev_note(T, T, "F01-Pin (Master B.2: PlayerRef-Verweise auf MYST-0001 v1 mit Inhaltshash). Keine Semantikänderung. Bezeichnung „VS-5“ als Aufrufer gilt gemäß D9(b) als MYST-SESSION-0001A/B.") +
          "Status: **DRAFT**, nicht registriert, nicht freigegeben. Ziel-Pfad")
t = apply(T, t, "B.2-M4a", "Master B.2 (F01 Pin)", "— wörtlich MYST-0001-Entwurf D3.", "— wörtlich " + M1PIN + ".")
t = apply(T, t, "B.2-M4b", "Master B.2 (F01 Pin), gleicher Verweis §1", "das Referenzformat aus dem MYST-0001-Entwurf D3.", "das Referenzformat aus " + M1PIN + ".")
finish(T, t, "MYST-0004.contract.CANDIDATE-v2.md")

# --- MYST-0005B
t = ORIG["MYST-0005B"]; T = "MYST-0005B"
t = bump(T, t)
t = apply(T, t, "M5B-T1", "§13 title of revision", "# MYST-0005B v1 — Interrogation Release V1 (DRAFT)", "# MYST-0005B v2 — Interrogation Release V1 (CANDIDATE)")
t = apply(T, t, "M5B-REV", "§13 revision note", "Status: **DRAFT**, nicht registriert, nicht freigegeben. Ziel-Pfad",
          rev_note(T, T, "F06 (§6 persistiertes Event `interrogate`, Master B.8) und F01-Pin (Master B.2). Keine Änderung an Response-Semantik, Observation-Shape oder VisibleRef-Lokalität (VisibleRef bleibt projection-local und wird nie persistiert). TASK-0005 v2 ist gemäß D9(c) durch MYST-0005A/B ersetzt; „VS-5“ als Aufrufer gilt gemäß D9(b) als MYST-SESSION-0001A/B.") +
          "Status: **DRAFT**, nicht registriert, nicht freigegeben. Ziel-Pfad")
t = apply(T, t, "B.8", "Master B.8 (F06)",
          "Persistiert wird ausschließlich `{ type: \"ask\", npc: PlayerRef, questionId }`.",
          "Persistiert wird ausschließlich das in MYST-SESSION-0001B §4 definierte akzeptierte Event `{ type: \"interrogate\", npc: PlayerRef, questionId }`; `ask` ist kein V1-Eventname und kein Alias.")
t = apply(T, t, "B.2-M5Ba", "Master B.2 (F01 Pin)", "(wörtlich MYST-0001 D3)", "(wörtlich " + M1PIN + ")")
t = apply(T, t, "B.2-M5Bb", "Master B.2 (F01 Pin)", "Kopplung: `PLAYER_REF_PATTERN` = MYST-0001 D3;", "Kopplung: `PLAYER_REF_PATTERN` = " + M1PIN + ";")
t = apply(T, t, "B.2-M5Bc", "Master B.2 (F01 Pin)", "// wörtlich MYST-0001 D3, identisch MYST-0004", f"// wörtlich MYST-0001 v1 D3 (forge-contract-v2 {M1H[:8]}…), identisch MYST-0004")
finish(T, t, "MYST-0005B.contract.CANDIDATE-v2.md")

# ------------------------------------------------------------------ Phase 2: Session A/B/C
R01_ADD = ("Ergänzung (Package/Replay-Closure R01, normativ): The trusted provider parses Truth and calls MYST-0001 `buildPlayerRefIndex(truth,refSalt)`. "
           "saltHex is that exact input, never inferred from mapping. Validate caseId/truthHash, complete five-kind entity membership, exact forward mapping and reverse resolution. "
           "Copy verified mapping into immutable owned artifacts. Salt invalid → SHAPE, collision/incomplete mapping/wrong inverse → REF_MAPPING, no partial package. "
           "Salt/config never go in Save/Event/public DTO. Refer to MYST-0001 D2–D5; no alternate derivation. Resolution is identity only, never prefix-Known authorization.")
B2_PARA_NEW = ("PackageRefSource ist ein synchroner vertrauenswürdiger Adapter um den PlayerRefIndex aus MYST-0001. Konstruktion: Der Host parst die Truth mit `parseCaseTruth` und ruft dann `buildPlayerRefIndex(truth, refSalt)` auf. "
               "`REF_SALT_INVALID` ergibt ein Paket-Finding `SHAPE`, `REF_COLLISION` ein Paket-Finding `REF_MAPPING`; in beiden Fällen entsteht kein Package, Kollisionsdetails gehen nur in den Autorenlog. "
               "Bei Erfolg gilt: `caseId = index.caseId`, `truthHash = index.truthHash`, `config = {profile: index.profile, saltHex: refSalt}`, `refFor = (k, id) => playerRefFor(index, k, id)`, "
               "`resolve = r => { const x = resolvePlayerRef(index, r); return x.success ? {kind: x.kind, id: x.id} : null; }`. "
               "Der Salt ist Autoreneingabe des Falls (MYST-0001 D2), wird vom trusted Packageprovider neben dem Packageinput geliefert und erscheint nie in Event, Save oder Public DTO. "
               "Die Session rotiert keinen Salt: Refs ändern sich genau dann, wenn refSalt, caseId oder truthHash sich ändern (MYST-0001 AC-06/AC-07); ein neuer Salt ist eine Autorenentscheidung und ergibt über refsHash ein neues Package (A36). "
               "Ein gültiges syntaktisches Token beweist keine Autorisierung.\n\n" + R01_ADD)
R03_PARA = ("PublicContent (Package/Replay-Closure R03 = Master B.5, Owner SA §2 gemäß D9/D10). Exact shape: `{schemaVersion:1,title:string,brief:string,challengeQuestion:string,labels:{entity:EntityRef,label:string,role:string|null}[],questionTexts:{npc:string,questionId:string,text:string}[],publicRules:{id:string,text:string}[]}`. "
            "No extra fields. Texts ≤1000 UTF-16, brief ≤4000 per accepted Master B.5; no normalization. Labels entity-unique and existing; questionTexts exactly authored NPC-profile rule question pairs with existing catalogue questions; publicRules id-unique. "
            "All SET by explicit keys in registry. `publicContentHash = H(\"forge-session-public-content-v1\", normalizedPublicContent)` becomes mandatory input to releaseContextHash. "
            "PublicContent alone owns public brief/title/label/role/question/rule wording; EvidencePresentation owns evidence text/reports. Public entity labels are exposed only through prefix-Known. "
            "Every text byte change changes package and invalidates old save, even a typo. Weitere Grenzen (max 256 Labels, 2048 questionTexts, 64 publicRules, Regel-ID-Muster, MYST-0004 PlayerText T2–T6) und Reviewpflichten: Anhang forge-release-proof-v1 §1. "
            "Spielerausgaben verwenden ausschließlich PublicContent plus Known; ein Label einer nicht bekannten Entity wird nie ausgegeben. Kein Roster und kein Briefing aus Truth.")
R05_PARA = ("Exakte Auflösung (Package/Replay-Closure R05, normativ): Descriptor stays exactly `{schemaVersion:1,packageHash:64lowerhex,rulesetVersion:\"mystery-session-v1\"}`. "
            "Host lookup by full descriptor retrieves exact immutable content, not latest by caseId/revision. Resolve parses and verifies all actual artifacts and every binding and recomputes the final descriptor. "
            "Exact comparison precedes success. Missing/extra/duplicate components or mixed NPC pairs fail atomically; no partial ResolvedCasePackage. "
            "Proof is either null with both aggregate proof hashes null, or complete profile+manifest, exact release binding. "
            "No revision-only/same-case substitution, digest-only phantom content, cached mutable provider or fallback to another locale. "
            "Store immutable verified binding owning all parsed artifacts and copied ref mapping. Preserve existing authored revision fields inside component hashes; add no duplicate component revisions to descriptor.")
R02_ROW = ("| snapshotHash | Hash entire output of the real bound snapshot parser with `H(\"forge-npc-snapshot-v1\", {...snapshot,awareness:sortByC(snapshot.awareness),attitudes:sortByC(snapshot.attitudes)})`. "
           "Sort copies by UTF-16 code units of C(entry). awareness and attitudes are SET; all other snapshot fields in V1 are scalars/strict objects. "
           "Include schemaVersion, npcId, revision, asOf, caseId, truthHash, solutionHash including null, acquiredAt, all provenance variant fields and full stance/leaning. "
           "Parser's subject/structural-statement duplicate and epistemic constraints stay authoritative. Do not discard metadata because a particular response is unchanged. (R02) |")
R04_SECTION = ("### Hash-Profil-Registry V1 (normativ, Package/Replay-Closure R04)\n\n"
               "The full path-specific registry below is authoritative. Proof SET paths are answerScope, observations, nodes, edges, edges[].allOf, observations[kind=PUBLIC_RULE].rules and those rules[].allOf; witnessStepIds is ORDERED. "
               "Challenge allowedClaims is SET sorted by C(claim), which is the structural claim key here; status is never used for filtering. refs mapping sorted by kind/id includes exact profile/salt; NPC bundle by npcId; PublicContent arrays by explicit keys. "
               "CertificateData arrays remain ORDERED under C, including steps and observation mapping data; do not apply domain all-array-SET canonicalizer. releaseHash hashes the exact canonical manifest bytes, without double JSON quoting. "
               "Hash fields are labeled scalar hex inputs, not opaque concatenation. Maschinenlesbare, pfadgenaue Fassung: `hash-profile-registry.json` (Branch `forge/owner/audits/MYSTERY-PACKAGE-REPLAY-BINDING-CLOSURE` @ `7ffa39c86755`, SHA-256 `"
               + REGISTRY_JSON_SHA + "`); bei Abweichung zwischen dieser Tabelle und jener Datei ist eine Revision nötig, kein stiller Vorrang.\n\n"
               + REGISTRY_MD.split("\n", 2)[2].strip("\n") + "\n\nIdentitäts-DAG (azyklisch; kein packageHash→PlayerRef, kein proofHash im Manifest, kein Selbsthash):\n\n```mermaid\n" + DAG_MMD.strip("\n") + "\n```\n\n")
R06_PARA = ("Ruleset-Kompatibilität (Package/Replay-Closure R06, normativ): `mystery-session-v1` identifies the entire specified transition/acceptance/error-priority/output/PlayerKnowledge projection semantics, including investigation, interrogation, challenge/verdict and proof adapter meaning. "
            "REPLAY-COMPATIBLE only when semantics are exactly unchanged: implementation refactoring, immutable sharing, verified binding reuse, SET permutations, UI layout outside package. "
            "Any change to action acceptance, Known/discovery/order/provenance, question availability/response mapping, polarity/unknown/required/scope interpretation, terminal behavior or released-proof interpretation is REPLAY-INCOMPATIBLE and requires a new rulesetVersion and package identity; "
            "adapter semantic change requires a new adapterVersion; certificate data changes require a new releaseHash. Host must execute the exact supported ruleset; absence is incompatible/unavailable. "
            "No old save interpreted by latest code under a reused version. Existing allowedClaims may contain false/undetermined; do not make “true-only” a compatibility rule.\n\n")
R07_PARA = ("decodeSessionSave und replaySession bleiben trusted Host-APIs. Die Player-Fassade gibt bei jeder nicht erfolgreichen Lade- oder Replay-Operation ausschließlich den konstanten Fehler `{ok:false;code:\"SAVE_UNAVAILABLE\"}` aus; "
            "sie gibt keinen eventIndex, keine Checksum, keine Package-Komponente, keine Zod-, ID- oder Proof-Diagnose aus. Detailcodes bleiben im privaten Hostlog. HOST_FAILURE wird nie zu not_solved. (Master B.12, F10)\n\n"
            "Save-Autorität (Package/Replay-Closure R07, normativ): Retain exact four-field envelope `{schemaVersion,packageIdentity,events,checksum}` and exact three-field descriptor. "
            "Version/schema/canonical-wire/package equality → checksum → replay, in original priority. events are ordered accepted raw inputs; accuse literals retain order. "
            "Never accept authoritative persisted derived verdict, PlayerKnowledge, VisibleRef, NPC engine, truth/solution cache, discovery or output observation. Reject extra fields. "
            "Encode replays and compares derived state; decode reconstructs derived state and exposes no failure partial prefix. A valid newly checksummed prefix or alternative accepted history stays valid by Session C; checksum is no authenticity/anti-cheat control.\n\n")
R08_TEXT = ("Resolve is the only package-identity verification boundary for a new immutable binding. Replay consumes that binding and must not repeat whole-package validation/component hashing for each event. "
            "Reuse captured truthHash (typed refs.caseId/truthHash from verified source), component digests and lookup tables, never caller-provided hash claims. "
            "Revalidate if any artifact/provider identity changes; never transfer cached binding to a different package/ruleset. Prefix event/reference/authorization/output invariants stay checked per event. "
            "Existing public domain APIs retain their checks; this rule neither waives those checks nor claims zero internal domain hashing. Required compatibility tests compare reuse with a fresh verified resolve. (R08)")
R10_TEXT = ("Klassifikation (Package/Replay-Closure R10): Existing explicitly authored component/Session budgets remain their scoped contracts, with limits checked before expensive work as applicable. "
            "VS-5 scratch numbers and Scale recommendations do not acquire normative force. Distinguish schema safety (valid Unicode/JSON, finite safe integers, bounded depth/nodes); package authoring; save transport; accepted-event history. "
            "Unknown extra numbers or runtime timeouts are OPEN BOUND. These are design budgets, not empirical target-device guarantees. "
            "A change to acceptance limits requires explicit contract/ruleset compatibility handling, never silent increase under old ruleset.")

def session_shared(T, t):
    t = apply(T, t, "B.2-start", "Master B.2 (F01)",
              "MYST-0001 ist ein nur sekundär belegter Taskname; vollständigen Contract/Ref-Adapter und Namespace vor Start prüfen.",
              f"MYST-0001 ist `MYST-0001-PLAYERREF-V1.contract.DRAFT.md` (Format 2, contentHash `forge-contract-v2` `{M1H}`). Der Ref-Adapter ist in §2 (PackageRefSource) festgelegt.")
    t = apply(T, t, "P01", "Release-Proof-Closure P01 (= Master B.15 NEW, identisch)", P["P01"]["OLD"], P["P01"]["NEW"])
    t = apply(T, t, "B.2-type", "Master B.2 (F01) + R01",
              "// NEW trusted boundary contract, not an asserted MYST-0001 export:\ntype PackageRefSource = {\n  caseId:string; truthHash:string;\n  config:{profile:string; saltHex:string}; // exact profile name; 32 lowercase hex\n  refFor(kind:EntityRef[\"kind\"],id:string):string|null;\n  resolve(ref:string):EntityRef|null;\n};",
              "// Trusted Adapter um MYST-0001 v1; keine eigene Ref-Ableitung:\ntype PackageRefSource = {\n  caseId:string; truthHash:string;\n  config:{profile:\"forge-mystery-playerref-v1\"; saltHex:string}; // saltHex = exakt der an buildPlayerRefIndex übergebene refSalt\n  refFor(kind:EntityRef[\"kind\"],id:string):string|null;\n  resolve(ref:string):ResolvedEntity|null; // MYST-0001-Typ, gebrandete IDs\n};")
    t = apply(T, t, "B.2-para+R01", "Master B.2 (F01) + Package/Replay-Closure R01",
              "PackageRefSource ist ein synchroner vertrauenswürdiger Adapter um den tatsächlichen PlayerRefIndex. Vor Produktionsstart muss seine Konstruktion gegen den vollständigen, akzeptierten PlayerRef-Contract festgelegt werden. Dieses Lab definiert absichtlich keinen alternativen Hash-Algorithmus. Ein gültiges syntaktisches Token beweist keine Autorisierung.",
              B2_PARA_NEW)
    t = apply(T, t, "P02", "Release-Proof-Closure P02 (= Master B.5)", P["P02"]["OLD"], P["P02"]["NEW"])
    t = apply(T, t, "P03", "Release-Proof-Closure P03 (= Master B.5)", P["P03"]["OLD"], P["P03"]["NEW"])
    t = apply(T, t, "B.9-refs", "Master B.9 (F07)",
              "  refs: {refFor(kind:EntityRef[\"kind\"],id:string):string|null;\n         resolve(ref:string):EntityRef|null};",
              "  refs: {caseId:string; truthHash:string; // = source.caseId/truthHash, beim Resolve gegen Truth geprüft\n         refFor(kind:EntityRef[\"kind\"],id:string):string|null;\n         resolve(ref:string):ResolvedEntity|null}; // strukturell PlayerRefTranslator (MYST-0004 §5.1, MYST-0005B §5.1)")
    t = apply(T, t, "B.11-resolver", "Master B.11 (F09/Scale, LIMIT vor Domainparse)",
              "Resolver-Schritte: bounded JSON-like Input prüfen; Truth/Solution mit echten Parsern parsen;",
              "Resolver-Schritte: Bytes/Tiefe/Knoten sowie Rohzählungen der Root-Collections (Entities 256, Evidence 64, NPCs 16, Fragen 128) vor jedem Zod-Parse und vor der Semantic Validation prüfen (LIMIT); dann Truth/Solution mit echten Parsern parsen;")
    t = apply(T, t, "IR-02", "Integration consequence of R03/P02 (strikter PublicContent-Parser in SA)",
              "Draft-Parser für Access, Presentation, Catalogue, NPC-Profile/Snapshots und Challenge verwenden.",
              "Draft-Parser für Access, Presentation, Catalogue, NPC-Profile/Snapshots und Challenge verwenden; PublicContent mit dem strikten PublicContent-Schema dieses Contracts prüfen.")
    t = apply(T, t, "R03+R05", "Package/Replay-Closure R03 (PublicContent) + R05 (exakte Auflösung)",
              "Packageidentity ist kein Geheimnis und keine Signatur.\n",
              "Packageidentity ist kein Geheimnis und keine Signatur.\n\n" + R03_PARA + "\n\n" + R05_PARA + "\n")
    t = apply(T, t, "R02", "Package/Replay-Closure R02 (NPC snapshot identity)",
              "| snapshotHash | NEW H(\"forge-npc-snapshot-v1\", snapshot mit awareness/attitudes nach C sortiert); kompletter geparster Snapshot einschließlich revision, asOf, acquiredAt, provenance und Bindungen. Keine sonstigen Arrayfelder. |",
              R02_ROW)
    t = apply(T, t, "R04-challenge", "Package/Replay-Closure R04 + D10",
              "Challenge mit allowedClaims nach claimKey sortiert); Challenge-Draft hat noch keinen Hash",
              "Challenge mit allowedClaims als SET nach C(claim) sortiert, der strukturellen Claimidentität; false/undetermined Mitglieder bleiben erhalten, Status wird nie zum Filtern verwendet (R04, D10)); Challenge-Draft hat noch keinen Hash")
    t = apply(T, t, "P04", "Release-Proof-Closure P04 (= Master B.5)", P["P04"]["OLD"], P["P04"]["NEW"])
    t = apply(T, t, "IR-01+R04-release", "Integration consequence of P05/P06 + R04 (Manifest direkt gehasht)",
              "certificateData ist bounded authoring JSON, KEINE ausführbare Runtime-Policy und keine Solvability-Autorität.",
              "certificateData ist strikt typisiertes authoring JSON nach dem Anhang forge-release-proof-v1, KEINE ausführbare Runtime-Policy und keine Solvability-Autorität. Das Manifest ist ein kanonischer UTF-8-String und wird direkt gehasht, nicht ein zweites Mal JSON-quotiert (R04).")
    t = apply(T, t, "R04-proof", "Package/Replay-Closure R04",
              "| proofHash | NEW H(\"forge-session-proof-v1\", vollständiges geparstes ProofProfile), mit ausschließlich answerScope/observations/nodes/edges/allOf/rules als typisierten Mengen sortiert; witnessStepIds strikt geordnet. Alternativ konservativ C ohne Mengennormalisierung zulässig? NEIN: Vertrag fordert die hier genannten Pfade exakt. |",
              "| proofHash | NEW H(\"forge-session-proof-v1\", vollständiges geparstes ProofProfile). Proof SET paths are answerScope, observations, nodes, edges, edges[].allOf, observations[kind=PUBLIC_RULE].rules and those rules[].allOf; witnessStepIds is ORDERED (R04). Keine weitere Mengennormalisierung; die Hash-Profil-Registry unten ist pfadgenau normativ. |")
    t = apply(T, t, "R04-registry", "Package/Replay-Closure R04 + hash-profile-registry.md + package-identity-dag.mmd",
              "ResolvedCasePackage ist kein Transport-DTO.",
              R04_SECTION + "ResolvedCasePackage ist kein Transport-DTO.")
    t = apply(T, t, "P07", "Release-Proof-Closure P07", P["P07"]["OLD"], P["P07"]["NEW"])
    t = apply(T, t, "P05", "Release-Proof-Closure P05 (Anhang SESSION-A-RELEASE-PROOF-ANNEX.md, Bytes unverändert bis auf Überschriftenebenen)",
              P["P05"]["OLD"],
              "Release→Proof-Adapter `forge-release-proof-v1`: normativ ist der folgende Anhang (Owner SA §2 gemäß D9(a); Runner in der Fallabnahme, kein vierter Session-Produktionstask). "
              "Änderung von certificateData/Adapterversion invalidiert Package und Save.\n\n"
              "### Anhang forge-release-proof-v1 — Release→Proof-Adapter (normativ, Owner SA §2)\n\n"
              "Quelle: `SESSION-A-RELEASE-PROOF-ANNEX.md`, Branch `forge/owner/audits/MYSTERY-RELEASE-PROOF-CERTIFICATION-CLOSURE` @ `d17f5211`, SHA-256 `" + sha(ANNEX) + "`. "
              "Text unverändert übernommen; nur die Titelzeile entfällt und Überschriften sind um zwei Ebenen abgesenkt. "
              "Typbezug (IR-05, Integrations-Klarstellung ohne Semantikänderung): `PlayerReport` und dessen `claim` sind die MYST-0004-v2-Typen (§5.4, drei Claim-Varianten); "
              "`PlayerClaim` im NPC-ReportSelector ist der neunvariantige MYST-0005B-v2-Typ (Statement einer InterrogationObservation); die drei gemeinsamen Varianten sind strukturell identisch. "
              "`SessionEvent` ist SB §4.\n\n" + demote(ANNEX))
    t = apply(T, t, "B.11-helpers", "Master B.11 (F09) = R09",
              "Alle drei geben eine neue deeply frozen Kopie zurück, keine Mutation.",
              "Normiert sind beobachtbare Unveränderlichkeit und unmutierte Caller-Inputs, nicht eine Vollkopie je Event. Frozen Subtrees dürfen geteilt werden. replaySession darf einen privaten Working-State nutzen, wenn Übergänge, Outputs, Limits und Fehlerpriorität exakt reduceSession entsprechen. Veröffentlichte Snapshots und der Endstate bleiben immutable.")
    t = apply(T, t, "B.11-size", "Master B.11 (F09) = R09",
              "B prüft die prospektive Savegröße ohne Import von C: C({schemaVersion:1,packageIdentity:pkg.identity,events:prospectiveEvents,checksum:\"0\".repeat(64)}) in UTF-8. Alle echten Checksums sind genau 64 ASCIIzeichen; die Länge ist deshalb exakt.",
              "B prüft die prospektive Savegröße ohne Import von C über die exakte Bytelänge, nicht durch Vollserialisierung je Event: B0 = UTF8Length(C({schemaVersion:1,packageIdentity:pkg.identity,events:[],checksum:\"0\".repeat(64)})). Für n Events gilt B = B0 + Σ UTF8Length(C(event_i)) + max(0,n−1). Keine Rundung oder Approximation; ein abgelehntes Event ändert B nicht. Differential-Tests gegen die Vollserialisierung sind Pflicht; kein persistierter Cache-Owner.")
    t = apply(T, t, "P06", "Release-Proof-Closure P06", P["P06"]["OLD"], P["P06"]["NEW"])
    t = apply(T, t, "B.9-investigate", "Master B.9 (F07)",
              "Für alle neuen IDs releaseEvidence aufrufen, deren Output validieren;",
              "Für alle neuen IDs `releaseEvidence(pkg.presentation, id, pkg.refs)` aufrufen, deren Output validieren;")
    t = apply(T, t, "B.9-interrogate", "Master B.9 (F07)",
              "interrogate: NPC muss als person bekannt und mit Snapshot/Profil im Package vorhanden sein. Snapshot/Profil auswählen; catalogue, refs, prefix-known, questionId an interrogate übergeben. QUESTION_NOT_AVAILABLE wird ACTION_UNAVAILABLE;",
              "interrogate: `pkg.refs.resolve(npc)` muss `{kind:\"person\", id}` ergeben, und `npc` muss im Präfix-Known liegen; gebraucht wird der npcs-Eintrag mit `snapshot.npcId === id`, sonst ACTION_UNAVAILABLE. `known` = für jedes Präfix-`KnownEntity` `pkg.refs.resolve(k.ref)`; das Ergebnis darf nicht null sein und muss `k.kind` entsprechen, sonst HOST_FAILURE. Übergeben werden kanonische `EntityRef[]`, nicht `KnownEntity`. Aufruf: `interrogate({truth:pkg.truth, solution:pkg.solution, snapshot, catalogue:pkg.catalogue, profile, refs:pkg.refs, known, questionId})`. QUESTION_NOT_AVAILABLE wird ACTION_UNAVAILABLE;")
    t = apply(T, t, "B.11-accuse", "Master B.11 (F09) = R08",
              "parseAccusation({schemaVersion:1,caseId:pkg.truth.caseId,truthHash:hashCaseTruth(pkg.truth),literals},pkg.truth)",
              "parseAccusation({schemaVersion:1,caseId:pkg.truth.caseId,truthHash:pkg.refs.truthHash,literals},pkg.truth) (der beim Resolve gebundene unveränderliche Truth-Hash, einmal berechnet)")
    t = apply(T, t, "P08", "Release-Proof-Closure P08 (D8 angenommen; ersetzt Master-B.6-Variante „ENTSCHIEDEN …“)", P["P08"]["OLD"], P["P08"]["NEW"])
    t = apply(T, t, "B.12+R07", "Master B.12 (F10) + Package/Replay-Closure R07",
              "   \"CHECKSUM_MISMATCH\"|\"INVALID_HISTORY\"|\"HOST_FAILURE\"};\n```\n\n",
              "   \"CHECKSUM_MISMATCH\"|\"INVALID_HISTORY\"|\"HOST_FAILURE\"};\n```\n\n" + R07_PARA)
    t = apply(T, t, "B.5-compat", "Master B.5 (F03), D10",
              "| PlayerRef-Salt/Profil oder tatsächliche Mappingtabelle | invalidieren |\n",
              "| PlayerRef-Salt/Profil oder tatsächliche Mappingtabelle | invalidieren |\n| PublicContent (Brief, Label, Fragetext, Regeltext, Challengefrage), auch ein Zeichen | invalidieren |\n")
    t = apply(T, t, "R06", "Package/Replay-Closure R06",
              "| Ruleset-Verhalten oder geänderte Auswahl-/Release-/Verdictlogik | neue rulesetVersion + neue Packageidentity erforderlich |",
              "| Ruleset-Verhalten oder geänderte Auswahl-/Release-/Verdictlogik | neue rulesetVersion + neue Packageidentity erforderlich (R06, siehe unten) |")
    t = apply(T, t, "R06-para", "Package/Replay-Closure R06",
              "Textänderungen invalidieren HEUTE zu Recht:",
              R06_PARA + "Textänderungen invalidieren HEUTE zu Recht:")
    t = apply(T, t, "R10", "Package/Replay-Closure R10",
              "PROPOSED konservative Budgets, keine Performance-Messwerte und keine universelle Fallgrößengrenze.",
              "PROPOSED konservative Budgets, keine Performance-Messwerte und keine universelle Fallgrößengrenze. " + R10_TEXT)
    t = apply(T, t, "R08", "Package/Replay-Closure R08 (= Master B.11 Rehash-Regel)",
              "Hashes und Refindizes werden einmal beim Package-Resolve gebaut, nicht pro Historyprefix neu.",
              "Hashes und Refindizes werden einmal beim Package-Resolve gebaut, nicht pro Historyprefix neu. " + R08_TEXT)
    t = apply(T, t, "IR-03", "Integration consequence of D8 (Abnahmepunkt 6)",
              "6. Die reale Vitrine-Fallabnahme ist separat: ursprüngliche Citationpflicht reconciliieren, echter Proof-Witness statt Stub.",
              "6. Die reale Vitrine-Fallabnahme ist separat: D8 ist angenommen (keine Citation-/Belegpflicht als Siegbedingung); die Fallzertifizierung CERT-1..CERT-10 der Release→Proof-Closure läuft nach Implementierung mit echtem Reducer-Witness statt Stub.")
    return t

SHARED_START = "## Verbindlichkeit und Startgate"
SHARED_END = "## Acceptance Criteria dieses Tasks"

def shared(text):
    a = text.index(SHARED_START); b = text.index(SHARED_END)
    s = text[a:b]
    # remove the task-specific goal paragraph (between "## Ziel" and "## Reads") and the budget line differences
    z1 = s.index("## Ziel, API und Abgrenzung dieses Tasks"); z2 = s.index("## Reads / Source of truth")
    return s[:z1] + s[z2:]

def session(T, extra_rev, task_specific, pins):
    t = ORIG[T]
    t = bump(T, t)
    t = apply(T, t, "S-REV", "§13 revision note",
              "**DRAFT. Nicht registriert, nicht freigegeben, auf dieser Basis nicht startbar. Kein Implementierungsauftrag durch dieses Lab.**\n",
              "**DRAFT. Nicht registriert, nicht freigegeben, auf dieser Basis nicht startbar. Kein Implementierungsauftrag durch dieses Lab.**\n\n" +
              rev_note(T, T, extra_rev) + pins)
    t = session_shared(T, t)
    for args in task_specific:
        t = apply(T, t, *args)
    return t

def pin_table(rows):
    s = "Gepinnte Contract-Identitäten dieser Integration (Design-/Start-Gate-Pins; `acceptedCommit` bleibt null bis zur Annahme):\n\n| Task | Artefakt | Profil | contentHash |\n|---|---|---|---|\n"
    for task, art, prof, h in rows:
        s += f"| {task} | `{art}` | {prof} | `{h}` |\n"
    return s + "\n"

def ident_row(task):
    if task in CAND_ID:
        c = CAND_ID[task]; return (task, c["file"].split("/")[-1], "forge-contract-v1 (v2)", c["contentHash"])
    i = src_identity(task); return (task, SOURCES[task][0].split("/")[-1], i["contentHashProfile"] + " (v1, unverändert)", i["contentHash"])

SA_REV = ("F01 (Master B.2 + R01), F02 (Anhang forge-release-proof-v1, P05–P07), F03 (PublicContent, P02–P04 + R03 + B.5), F04 (§6, P08, D8), F07 (B.9), F09 (B.11 = R08/R09), F10 (B.12 + R07), F12 (P01), "
          "NPC-Snapshot-Identität (R02), Hash-Profil-Registry und Identitäts-DAG (R04), exakte Auflösung (R05), Ruleset-Kompatibilität (R06), Ressourcenklassifikation (R10). Gemeinsame §§2–11 sind in A/B/C bytegleich; normativer Owner gemäß P01.")
rows = [ident_row(x) for x in ["MYST-0001", "MYST-0002", "MYST-0003", "MYST-0004", "MYST-0005A", "MYST-0005B", "MYST-CHALLENGE-0001", "MYST-SOLVABILITY-0001"]]

# Session A
T = "MYST-SESSION-0001A"
t = session(T, SA_REV, [
    ("B.11-A38", "Master B.11 (A38 präzisiert)", "| A38 | 257 Entities oder 65 Evidence | LIMIT |", "| A38 | 257 Entities oder 65 Evidence | LIMIT vor Domainparse |"),
    ("B.5-A41", "Master B.5 (A41) + R01 + Anhang §5",
     "| A40 | ResolvedPackage JSON.stringify | wirft; Public DTO bleibt serialisierbar |\n",
     "| A40 | ResolvedPackage JSON.stringify | wirft; Public DTO bleibt serialisierbar |\n"
     "| A41 | questionText um ein Zeichen geändert | publicContentHash und packageHash ändern |\n"
     "| A42 | Behaupteter saltHex mit Mapping eines anderen Salts | Neuberechnung über buildPlayerRefIndex lehnt ab (REF_MAPPING); kein Package |\n"
     "| A43 | certificateData: positive und negative Fixtures je Selektorart; Alias-, Source-, Binding-, Stance-, Duplikat- und Self-License-Angriffe | Positive binden; jeder Angriff ergibt einen Packagefehler ohne Package und ohne PASS-Behauptung |\n"),
    ("IR-04-A", "Integration consequence (neue Fälle A41–A43)", "1. Alle 40 nachfolgenden Fälle", "1. Alle 43 nachfolgenden Fälle"),
], pin_table(rows))
finish(T, t, "MYST-SESSION-0001A.contract.CANDIDATE-v2.md")

SB_REV = "die gemeinsamen §§2–11 bytegleich zu MYST-SESSION-0001A v2 (dort normativ: SA §§2–3; hier normativ: SB §§4–7 inkl. B.9 interrogate/investigate-Ports, B.11 accuse-truthHash, P08 D8-Siegbedingung, R06/R08/R09). " + "Eigene Testmatrix unverändert."
T = "MYST-SESSION-0001B"
t = session(T, SB_REV, [], pin_table([ident_row("MYST-SESSION-0001A")]))
finish(T, t, "MYST-SESSION-0001B.contract.CANDIDATE-v2.md")

SC_REV = "die gemeinsamen §§2–11 bytegleich zu MYST-SESSION-0001A v2 (hier normativ: SC §§8–9 inkl. B.12 Public-Load-Fassade, R07 Save-Autorität, PublicContent-Invalidierung). Neue Fälle C41/C42."
T = "MYST-SESSION-0001C"
t = session(T, SC_REV, [
    ("B.5-C41+B.12-C42", "Master B.5 (C41) + Master B.12 (C42)",
     "| C40 | Checksum korrekt aber technischer Bindingfehler | HOST_FAILURE/inkompatibel, niemals not_solved |\n",
     "| C40 | Checksum korrekt aber technischer Bindingfehler | HOST_FAILURE/inkompatibel, niemals not_solved |\n"
     "| C41 | Alter Save gegen Package mit geändertem publicRules-Text | INCOMPATIBLE_PACKAGE |\n"
     "| C42 | Jeder Decode-/Replay-Fehlercode über die Player-Fassade | öffentlich identisch `{ok:false,code:\"SAVE_UNAVAILABLE\"}` |\n"),
    ("IR-04-C", "Integration consequence (neue Fälle C41–C42)", "1. Alle 40 nachfolgenden Fälle", "1. Alle 42 nachfolgenden Fälle"),
], pin_table([ident_row("MYST-SESSION-0001A"), ident_row("MYST-SESSION-0001B")]))
finish(T, t, "MYST-SESSION-0001C.contract.CANDIDATE-v2.md")

# shared byte-identity check
shA, shB, shC = (shared(open(os.path.join(CAND, f"MYST-SESSION-0001{x}.contract.CANDIDATE-v2.md"), encoding="utf-8").read()) for x in "ABC")
oA, oB, oC = (shared(ORIG[f"MYST-SESSION-0001{x}"]) for x in "ABC")
assert oA == oB == oC, "original shared sections differ"
assert shA == shB == shC, "candidate shared sections differ"

json.dump({"sources": {k: {"path": v[0], "branch": v[1], "commit": v[2], **src_identity(k)} for k, v in SOURCES.items()},
           "candidates": CAND_ID, "patches": LOG, "sharedSectionSha256": sha(shA),
           "annexSha256": sha(ANNEX), "registryJsonSha256": REGISTRY_JSON_SHA,
           "patchJsonSha256": sha(open(os.path.join(SRC, RP, "CONTRACT-PATCHES.json"), "rb").read()),
           "contractRepairsSha256": sha(open(os.path.join(SRC, PR, "CONTRACT-REPAIRS.md"), "rb").read())},
          open(os.path.join(S, "build-result.json"), "w"), indent=1, ensure_ascii=False)
print("OK", len(LOG), "patches")
for k, v in CAND_ID.items(): print(k, v["contentHash"], v["bytes"])
