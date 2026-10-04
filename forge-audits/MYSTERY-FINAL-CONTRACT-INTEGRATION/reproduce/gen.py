#!/usr/bin/env python3
"""Generate manifest, DAG, finding matrix and report from build/check results."""
import hashlib, json, os, shutil

S = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(S, "out", "MYSTERY-FINAL-CONTRACT-INTEGRATION")
B = json.load(open(os.path.join(S, "build-result.json"), encoding="utf-8"))
X = json.load(open(os.path.join(OUT, "STATIC-CROSS-CONTRACT-CHECK.json"), encoding="utf-8"))
MAIN = "3d7545d843883418348004e68717399a64da7a7d"
AUD = "forge/owner/audits/"

def sha_file(p): return hashlib.sha256(open(p, "rb").read()).hexdigest()

ROLE = {
    "MYST-0001": "PlayerRef V1: opaque package-bound entity references (derivation profile forge-mystery-playerref-v1)",
    "MYST-0002": "Accusation & Verdict V1: Canonical-Consistency Core (sole conclusion-status authority)",
    "MYST-0003": "Evidence Access V1 (investigation → found evidence, domain-ID space)",
    "MYST-0004": "Evidence Presentation & Player Release V1 (EvidenceObservation, PlayerReport, translator port)",
    "MYST-0005A": "Interrogation Authoring V1 (question catalogue, interrogation profiles)",
    "MYST-0005B": "Interrogation Release V1 (NPC response decision, InterrogationObservation, VisibleRef projection-local)",
    "MYST-CHALLENGE-0001": "Challenge Exactness Wrapper V1 (finite public AnswerScope, determined-and-matching exactness)",
    "MYST-SOLVABILITY-0001": "Minimum Solvability V1 (authored Proof Profile, finite licensed proof check, certification)",
    "MYST-SESSION-0001A": "Session A: Package identity, JSON profile, PlayerKnowledge, PublicContent, Release→Proof adapter (normative owner SA §§2–3)",
    "MYST-SESSION-0001B": "Session B: Event vocabulary, reducer, terminal, replay, session limits (normative owner SB §§4–7)",
    "MYST-SESSION-0001C": "Session C: Save wire, checksum, decode, compatibility, public load errors (normative owner SC §§8–9)",
}
FIND = {
    "MYST-0001": ["F01 (substance by existing text)"],
    "MYST-0002": ["F05", "F08"],
    "MYST-0003": [],
    "MYST-0004": ["F01 (pin)"],
    "MYST-0005A": [],
    "MYST-0005B": ["F01 (pin)", "F06"],
    "MYST-CHALLENGE-0001": ["F05", "F12 (nonblocking, M2 pin)"],
    "MYST-SOLVABILITY-0001": [],
    "MYST-SESSION-0001A": ["F01", "F02", "F03", "F07 (refs type)", "F09", "F12 (nonblocking)"],
    "MYST-SESSION-0001B": ["F04", "F06 (event vocabulary owner)", "F07 (ports)", "F09"],
    "MYST-SESSION-0001C": ["F03 (save invalidation)", "F10"],
}
H, RP, DS = "HARD IMPLEMENTATION DEPENDENCY", "RUNTIME/PACKAGE DEPENDENCY", "DESIGN RELATION ONLY"
EDGES = [
    ("MYST-0001", "TASK-0001 (legacy, main)", H, "frontmatter (acceptedCommit = main); parseCaseTruth/hashCaseTruth"),
    ("MYST-0002", "TASK-0001/TASK-0003 (legacy, baseCommit)", H, "case-truth / case-solution modules on baseCommit; no frontmatter entry (legacy, not Forge-managed)"),
    ("MYST-0003", "TASK-0001 (legacy, baseCommit)", H, "case-truth types on baseCommit"),
    ("MYST-0004", "TASK-0001 (legacy, baseCommit)", H, "case-truth types on baseCommit"),
    ("MYST-0005A", "TASK-0001/0003/0004 (legacy, baseCommit)", H, "AwarenessSubjectSchema, NPC knowledge on baseCommit"),
    ("MYST-0005B", "MYST-0005A", H, "frontmatter; imports catalogue/profile types, statementClaimReferences"),
    ("MYST-CHALLENGE-0001", "MYST-0002", H, "frontmatter; evaluateConclusionClaim / parseAccusation; design pin to M2 v2"),
    ("MYST-SOLVABILITY-0001", "MYST-0002", H, "frontmatter; evaluateConclusionClaim for canonical consistency"),
    ("MYST-SESSION-0001A", "MYST-0001", H, "frontmatter; ResolvedEntity / PlayerRefIndex types; provider calls buildPlayerRefIndex"),
    ("MYST-SESSION-0001A", "MYST-0002", H, "frontmatter; conclusion claim types consumed via Challenge binding"),
    ("MYST-SESSION-0001A", "MYST-0003", H, "frontmatter; Evidence Access parser/hash"),
    ("MYST-SESSION-0001A", "MYST-0004", H, "frontmatter; Presentation parser/hash, EvidenceObservation type"),
    ("MYST-SESSION-0001A", "MYST-0005A", H, "frontmatter; catalogue/profile parsers and hashes"),
    ("MYST-SESSION-0001A", "MYST-0005B", H, "frontmatter; InterrogationObservation type in ObservationRecord"),
    ("MYST-SESSION-0001A", "MYST-CHALLENGE-0001", H, "frontmatter; Challenge parser"),
    ("MYST-SESSION-0001A", "MYST-SOLVABILITY-0001", H, "frontmatter; ProofProfile parser only (no solvability run in Session)"),
    ("MYST-SESSION-0001B", "MYST-SESSION-0001A", H, "frontmatter; A helpers, ResolvedCasePackage"),
    ("MYST-SESSION-0001B", "MYST-0002 / MYST-0003 / MYST-0004 / MYST-0005B / MYST-CHALLENGE-0001", H, "direct imports per SB §5 (parseAccusation, resolveInvestigation, releaseEvidence, interrogate, evaluateChallengeAccusation); gated transitively via SB→SA→*; frontmatter unchanged"),
    ("MYST-SESSION-0001C", "MYST-SESSION-0001A", H, "frontmatter; serializer/identity helpers"),
    ("MYST-SESSION-0001C", "MYST-SESSION-0001B", H, "frontmatter; replaySession"),
    ("Case package (e.g. Die leere Vitrine)", "MYST-SESSION-0001A + all component parsers", RP, "resolveCasePackage binds Truth/Solution/Access/Presentation/Catalogue/Profiles/Snapshots/Initial/Challenge/PublicContent/Refs/Proof"),
    ("Trusted package provider (host)", "MYST-0001", RP, "buildPlayerRefIndex(truth, refSalt) at package construction; salt never in Save"),
    ("Release→Proof case-acceptance runner (P5, no task)", "MYST-SESSION-0001B replaySession + MYST-SOLVABILITY-0001 checkCaseSolvability", RP, "adapter forge-release-proof-v1 (SA annex); certification only, never a runtime gate"),
    ("Saves", "exact CasePackageIdentity + rulesetVersion mystery-session-v1", RP, "no latest/revision-only fallback"),
    ("MYST-0004", "MYST-0001", DS, "PLAYER_REF_PATTERN literal pinned to M1 v1 D3; no import"),
    ("MYST-0005B", "MYST-0001", DS, "PLAYER_REF_PATTERN literal pinned to M1 v1 D3; no import"),
    ("MYST-0003", "MYST-0001", DS, "known refs structurally equal ResolvedEntity; no import"),
    ("MYST-0003", "MYST-0004", DS, "same truthHash; discovered → release chain owned by SB"),
    ("MYST-0005B", "MYST-0004", DS, "PlayerRefTranslator / shared PlayerClaim variants structurally identical"),
    ("MYST-0005B", "MYST-SESSION-0001B", DS, "persisted event name interrogate owned by SB §4"),
    ("MYST-0002", "MYST-CHALLENGE-0001", DS, "M2 §15 delegates scope publication check to CH §6"),
    ("MYST-SOLVABILITY-0001", "MYST-SESSION-0001A", DS, "SA annex produces ReleasedObservations for SOL's port; SOL imports nothing from Session"),
    ("MYST-CHALLENGE-0001 / MYST-SOLVABILITY-0001", "Die leere Vitrine", DS, "required_literals direct_actor question; Proof Profile re-binding at P5.2"),
]
UNCH = ["MYST-0001", "MYST-0003", "MYST-0005A", "MYST-SOLVABILITY-0001"]
ORDER = ["MYST-0001", "MYST-0002", "MYST-0003", "MYST-0004", "MYST-0005A", "MYST-0005B", "MYST-CHALLENGE-0001", "MYST-SOLVABILITY-0001", "MYST-SESSION-0001A", "MYST-SESSION-0001B", "MYST-SESSION-0001C"]

def fm_deps(task):
    path = os.path.join(OUT, B["candidates"][task]["file"]) if task in B["candidates"] else os.path.join(S, "src", "forge-audits", B["sources"][task]["path"])
    t = open(path, encoding="utf-8").read(); a = t.index("---json\n") + 8; b = t.index("\n---\n", a)
    m = json.loads(t[a:b]); return m["dependencies"], m["contractVersion"], m["forgeContractFormat"]

patches_by_task = {}
for p in B["patches"]: patches_by_task.setdefault(p["task"], []).append(p["patch"])

contracts = []
for task in ORDER:
    src = B["sources"][task]
    deps, ver, fmt = fm_deps(task)
    rev = task in B["candidates"]
    contracts.append({
        "taskId": task,
        "logicalRole": ROLE[task],
        "sourceArtifact": {"path": "forge-audits/" + src["path"], "branch": src["branch"], "commit": src["commit"]},
        "sourceIdentity": {"rawSha256": src["rawSha256"], "contentHashProfile": src["contentHashProfile"], "contentHash": src["contentHash"], "bytes": src["bytes"]},
        "candidateArtifact": ("forge-audits/MYSTERY-FINAL-CONTRACT-INTEGRATION/" + B["candidates"][task]["file"]) if rev else None,
        "candidateIdentity": ({k: B["candidates"][task][k] for k in ("rawSha256", "contentHashProfile", "contentHash", "bytes")} if rev
                              else {"acceptedIdentity": "UNCHANGED", "contentHashProfile": src["contentHashProfile"], "contentHash": src["contentHash"]}),
        "contractVersion": ver,
        "forgeContractFormat": fmt,
        "registration": "Format 2 after Forge BOOTSTRAPPED and CORE-0002 (Master B.16, D1, D7); transcode without version bump" if fmt == 1 else "already Format 2; register after Forge BOOTSTRAPPED and CORE-0002",
        "dependencies": {"frontmatter": deps, "classifiedEdges": [{"to": e[1], "class": e[2], "basis": e[3]} for e in EDGES if e[0] == task]},
        "closedFindings": FIND[task],
        "appliedPatches": patches_by_task.get(task, []),
        "revisionDecision": "NEW REVISION REQUIRED" if rev else "UNCHANGED",
        "status": "READY FOR ARCHITECTURE REVIEW" if rev else "UNCHANGED / READY",
    })

FINDINGS = [
    ("F01", "MYST-0001 / finale Reparatur nicht verfügbar", "CLOSED_BY_THIS_REPAIR",
     "Inhalt durch bestehenden MYST-0001-v1-Text vollständig (fcv2 f4d31858…, Goldens); diese Integration pinnt ihn in SA/SB/SC (Startgate, PackageRefSource, R01), MYST-0004 und MYST-0005B.",
     ["B.2-start", "B.2-type", "B.2-para+R01", "B.2-M4a", "B.2-M4b", "B.2-M5Ba", "B.2-M5Bb", "B.2-M5Bc"], "Master B.2/B.3; R01; FB F01"),
    ("F02", "Release→Proof / Public-Rule / Witness-Adapter normativ offen", "CLOSED_BY_THIS_REPAIR",
     "D9(a) angenommen. Anhang forge-release-proof-v1 in SA §2 (P05) samt P06/P07; Kette Release → PlayerKnowledge Observation → authored Proof Premise → Proof Route → Solvability; NPC asserts P / Evidence supports P / Player heard P ⇒ P true ausgeschlossen.",
     ["P05", "P06", "P07", "IR-01+R04-release", "IR-05"], "Release-Proof-Closure P05–P07; Master B.4; D9"),
    ("F03", "Öffentliches authored Gameplay nicht vollständig packagegebunden", "CLOSED_BY_THIS_REPAIR",
     "PublicContent als strikte SA-Komponente, publicContentHash im releaseContextHash, Invalidierungszeile, A41/C41.",
     ["P02", "P03", "P04", "R03+R05", "IR-02", "B.5-compat", "B.5-A41", "B.5-C41+B.12-C42"], "Master B.5; R03; P02–P04; D10"),
    ("F04", "Vitrine Receiptpflicht widerspricht Session V1", "CLOSED_BY_THIS_REPAIR",
     "D8 angenommen. SB §6 (Kopien SA/SC) P08: vollständige richtige vierteilige direct_actor-Antwort = solved ohne Beleg-/Receipt-/Citation-Gate. Vitrine-Falldeltas P11–P20 sind als Re-Authoring-Delta für P5.2 festgehalten (kein Contract).",
     ["P08", "IR-03"], "Release-Proof-Closure P08, P11–P20; Master B.6; D8"),
    ("F05", "Required-only / enge Rollenfrage widersprüchlich", "CLOSED_BY_THIS_REPAIR",
     "M2 §15 erlaubt öffentlich vorab festgelegte Dimensionen, verbietet geheime Auswahl; CH §6 Rollenzeile mit required_literals-Einzelrolle.",
     ["P09", "P10"], "P09/P10 = Master B.7"),
    ("F06", "Persistentes ask vs interrogate", "CLOSED_BY_THIS_REPAIR",
     "MYST-0005B §6 persistiert ausschließlich SB-§4-Event interrogate; ask kein Alias.", ["B.8"], "Master B.8"),
    ("F07", "Ref-Port / Known-Übersetzung beim Consumer fehlt exakt", "CLOSED_BY_THIS_REPAIR",
     "pkg.refs mit caseId/truthHash/refFor/resolve; SB interrogate übersetzt Präfix-Known in kanonische EntityRef[]; releaseEvidence(pkg.presentation,id,pkg.refs).",
     ["B.9-refs", "B.9-interrogate", "B.9-investigate"], "Master B.9"),
    ("F08", "M2 no-throw für beliebiges JS unknown nicht erfüllt", "CLOSED_BY_THIS_REPAIR",
     "No-throw auf Plain-JSON + nicht werfende Getter (AC-E5) begrenzt; keine Sandbox.", ["B.10a", "B.10b", "B.10c"], "Master B.10"),
    ("F09", "Quadratische Prefixarbeit durch wörtlichen Contract", "CLOSED_BY_THIS_REPAIR",
     "Exakte Größenformel B0+ΣC(event_i)+max(0,n−1); beobachtbare Immutabilität statt Vollkopie; Resolve verifiziert einmal, Replay nutzt Binding; LIMIT vor Domainparse.",
     ["B.11-resolver", "B.11-helpers", "B.11-size", "B.11-accuse", "R08", "B.11-A38"], "Master B.11; R08/R09; Scale"),
    ("F10", "Finale Public-Loadfehler-Allowlist offen", "CLOSED_BY_THIS_REPAIR",
     "Player-Fassade gibt nur {ok:false,code:\"SAVE_UNAVAILABLE\"}; Detailcodes privat; HOST_FAILURE nie not_solved; C42.", ["B.12+R07", "B.5-C41+B.12-C42"], "Master B.12; R07"),
    ("F11", "Vitrine aktuelle Release-/Save-Kompatibilität fehlt", "CLOSED_BY_EXISTING_TEXT",
     "Als Contract-Freeze-Blocker durch bestehende Texte geschlossen (Master B.13, FB F11, Owner-Auftrag §17): bleibt Vitrine-Release-Gate P5 mit CERT-1..CERT-10 (VITRINE-RECERTIFICATION-CHECKLIST.md); echter Witness mit implementiertem Reducer, kein Scratch-Reducer.",
     [], "Master B.13; FB F11; Release-Proof-Closure §9 + Checkliste"),
]

manifest = {
    "schemaVersion": 1,
    "artifact": "MYSTERY-FINAL-CONTRACT-MANIFEST",
    "date": "2026-10-04",
    "repository": "Forge-Dice/Forge",
    "canonicalMain": {"before": MAIN, "after": MAIN, "note": "read-only; verified via git ls-remote before and after"},
    "ownerDecisions": {"accepted": ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10"],
                       "source": AUD + "FORGE-MYSTERY-FINAL-OWNER-RECONCILIATION @ 52dab20bb7825a9ced0da2c572cc9be9033754bd"},
    "patchAuthority": [
        {"order": 1, "kind": "binding owner decision", "ref": "D1–D10"},
        {"order": 2, "kind": "later experimental closure", "ref": [AUD + "MYSTERY-RELEASE-PROOF-CERTIFICATION-CLOSURE @ d17f5211 (CONTRACT-PATCHES.json sha256 " + B["patchJsonSha256"] + ")",
                                                                AUD + "MYSTERY-PACKAGE-REPLAY-BINDING-CLOSURE @ 7ffa39c8 (CONTRACT-REPAIRS.md sha256 " + B["contractRepairsSha256"] + ")",
                                                                AUD + "MYSTERY-FREEZE-BLOCKER-REPAIR @ 0681d453"]},
        {"order": 3, "kind": "original contract", "ref": "source artifacts below"},
        {"order": 4, "kind": "older design/research", "ref": ["MYSTERY-FINAL-RECONCILIATION-SPEC-FREEZE", "MYSTERY-CONTRACT-CONSOLIDATION", "VS-5 preflight", "Scale", "InfoFlow", "Cross-Contract", "Authoring Stress"]},
    ],
    "contracts": contracts,
    "supersededArtifacts": [
        {"artifact": "VS-5 session contract strand (MYSTERY-VS5-PREFLIGHT results, prototypeOnly)", "supersededBy": "MYST-SESSION-0001A/B/C v2", "decision": "D9(b)",
         "aliasRule": "References to 'VS-5' as caller in MYST-0003 v1, MYST-0004 v2 and MYST-0005B v2 read as MYST-SESSION-0001A/B; no text change"},
        {"artifact": AUD + "TASK-0005 (TASK-0005 v2 interrogation strand)", "supersededBy": "MYST-0005A v1 + MYST-0005B v2", "decision": "D9(c)"},
        {"artifact": "MYST-0002-ACCUSATION-VERDICT-V1 draft (3758b20c…) and MYST-0002 FINAL-CANDIDATE v1 (e1eba9e1…)", "supersededBy": "MYST-0002 v2", "decision": "NEW REVISION (F05, F08)"},
    ],
    "caseDeltasNotApplied": {
        "artifact": "Die leere Vitrine (case spec, player brief, case-host design)",
        "patches": ["P11", "P12", "P13", "P14", "P15", "P16", "P17", "P18", "P19", "P20"],
        "source": AUD + "MYSTERY-RELEASE-PROOF-CERTIFICATION-CLOSURE/CONTRACT-PATCHES.json",
        "reason": "Case re-authoring belongs to P5.2 after contract freeze and implementation; F11 release gate with CERT-1..CERT-10",
    },
    "boundNormativeAnnexes": {
        "sessionAReleaseProofAnnex": {"source": AUD + "MYSTERY-RELEASE-PROOF-CERTIFICATION-CLOSURE/SESSION-A-RELEASE-PROOF-ANNEX.md", "sha256": B["annexSha256"], "embeddedIn": "SA/SB/SC v2 §2 (headings demoted only)"},
        "hashProfileRegistry": {"source": AUD + "MYSTERY-PACKAGE-REPLAY-BINDING-CLOSURE/hash-profile-registry.json", "sha256": B["registryJsonSha256"], "embeddedIn": "SA/SB/SC v2 §2 (markdown table + DAG)"},
    },
    "sessionSharedSectionSha256": B["sharedSectionSha256"],
    "freezeFindings": {"total": 11, "closedByExistingText": 1, "closedByThisRepair": 10, "open": 0,
                       "items": [{"id": f[0], "title": f[1], "classification": f[2], "patches": f[4], "evidence": f[5]} for f in FINDINGS],
                       "nonblocking": [{"id": "F12", "classification": "CLOSED_BY_THIS_REPAIR", "patches": ["P01", "B.15-CH"]}]},
    "patches": B["patches"],
    "staticCrossContractCheck": {"pass": X["pass"], "fail": X["fail"], "file": "STATIC-CROSS-CONTRACT-CHECK.json"},
    "vitrineCertificationBoundary": "Not a contract-freeze blocker. After freeze and implementation the real case needs CERT-1..CERT-10; the real witness uses the implemented reducer; no scratch reducer is production proof.",
    "overallVerdict": "MYSTERY FREEZE CANDIDATE READY FOR INDEPENDENT REVIEW",
    "githubPersistence": {"status": "STOPPED", "authenticatedIdentity": "Wuerfelduell (GitHub MCP get_me, id 315180734)",
                          "reason": "Owner instruction forbids writes as Wuerfelduell/forge-codex; no Claude-contributor write identity available in this session",
                          "intendedBranch": AUD + "MYSTERY-FINAL-CONTRACT-INTEGRATION", "intendedPath": "forge-audits/MYSTERY-FINAL-CONTRACT-INTEGRATION/"},
}
json.dump(manifest, open(os.path.join(OUT, "MYSTERY-FINAL-CONTRACT-MANIFEST.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)

# patch log
json.dump({"generatedBy": "reproduce/build.py", "patches": B["patches"]}, open(os.path.join(OUT, "PATCH-LOG.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)

# Finding matrix
fm = ["# FINDING CLOSURE MATRIX — Mystery Final Contract Integration", "",
      f"Basis: `main` = `{MAIN}` (unverändert). Quelle der elf Findings: `{AUD}MYSTERY-INDEPENDENT-FREEZE-VERIFICATION` @ `25a8a17b` (Tabelle F01–F12; F12 nonblocking).",
      "Repair-Lab-Stand vor dieser Integration: 11 total, 9 CLOSED, 2 OWNER DECISIONS (F02 = D9, F04 = D8). D8 und D9 sind angenommen.", "",
      "| Finding | Titel (FV) | Klassifikation | Angewandte Patches (PATCH-LOG.json) | Ort im Candidate | Evidenz |", "|---|---|---|---|---|---|"]
LOC = {"F01": "SA/SB/SC Startgate + §2; M4 §1/§5.3; M5B §1/§5", "F02": "SA §2 Anhang forge-release-proof-v1 (Kopien SB/SC)", "F03": "SA §2, §9; SA A41; SC C41",
       "F04": "SB §6 (Kopien SA/SC); Abnahmepunkt 6", "F05": "M2 §15; CH §6", "F06": "M5B §6", "F07": "SA §2 refs; SB §5", "F08": "M2 §5.1, AC-05, AC-06",
       "F09": "SA §2/Ergänzung, SB §5, §11; A38", "F10": "SC §8; C42", "F11": "kein Contract; P5-Gate"}
for f in FINDINGS:
    fm.append(f"| {f[0]} | {f[1]} | **{f[2]}** | {', '.join(f[4]) or '—'} | {LOC[f[0]]} | {f[5]} |")
fm += ["", "Ergebnis: **11 / 11 geschlossen** (10 CLOSED_BY_THIS_REPAIR, 1 CLOSED_BY_EXISTING_TEXT), **0 offen**. Kein Originalartefakt liefert neue konkrete widersprechende Evidenz.", "",
       "Nonblocking F12 (Ein-Owner-Regel, CH-Pin): CLOSED_BY_THIS_REPAIR (P01 in SA/SB/SC; CH Design Dependency auf MYST-0002 v2).", "",
       "## Begründungen", ""]
for f in FINDINGS:
    fm.append(f"- **{f[0]} — {f[2]}.** {f[3]}")
fm += ["", "## Freeze-Angriffe (FV, 50)", "",
       "MYSTERY-FREEZE-BLOCKER-REPAIR: 44 closed/contained, 6 nur bedingt auf D8/D9 (#11–13, #15, #18 → F02; #29 → F04). Mit D8/D9 angenommen und P05–P08 integriert sind auch diese sechs durch den Candidate-Text geschlossen. Die 30 Zusatzregressionen der Freeze-Repair (28 deterministisch, 2 D8/D9-abhängig) gelten entsprechend."]
open(os.path.join(OUT, "FINDING-CLOSURE-MATRIX.md"), "w", encoding="utf-8").write("\n".join(fm) + "\n")

# DAG
def cid(t):
    return B["candidates"][t]["contentHash"][:12] + "… (v2)" if t in B["candidates"] else B["sources"][t]["contentHash"][:12] + "… (v1)"
dg = ["# FINAL DEPENDENCY DAG — Mystery Contract Set", "",
      "Erzeugt nach allen Repairs. Knoten = Contract-Identität dieses Pakets (MYSTERY-FINAL-CONTRACT-MANIFEST.json). Kanten nur, wenn eine echte Implementierungs-, Laufzeit/Paket- oder Designbeziehung besteht; keine Kante nur deshalb, weil Komponenten im selben Spiel vorkommen.", "",
      "## Knoten", "", "| Task | Identität | Entscheidung |", "|---|---|---|"]
for c in contracts:
    dg.append(f"| {c['taskId']} | `{cid(c['taskId'])}` | {c['revisionDecision']} |")
dg += ["", "## Kanten", "", "| Von | Nach | Klasse | Grundlage |", "|---|---|---|---|"]
for e in EDGES:
    dg.append(f"| {e[0]} | {e[1]} | {e[2]} | {e[3]} |")
dg += ["", "## HARD-Teilgraph (azyklisch)", "", "```mermaid", "flowchart LR",
       ' L["Legacy TASK-0001/0003/0004 auf main 3d7545d"]', " L --> M1[MYST-0001]", " L --> M2[MYST-0002]", " L --> M3[MYST-0003]", " L --> M4[MYST-0004]", " L --> M5A[MYST-0005A]",
       " M5A --> M5B[MYST-0005B]", " M2 --> CH[MYST-CHALLENGE-0001]", " M2 --> SOL[MYST-SOLVABILITY-0001]",
       " M1 --> SA[MYST-SESSION-0001A]", " M2 --> SA", " M3 --> SA", " M4 --> SA", " M5A --> SA", " M5B --> SA", " CH --> SA", " SOL --> SA",
       " SA --> SB[MYST-SESSION-0001B]", " SA --> SC[MYST-SESSION-0001C]", " SB --> SC", "```", "",
       "Pfeil = „wird benötigt von“. Frontmatter-Kanten unverändert gegenüber den Originalen; keine neue Kante wurde hinzugefügt.", "",
       "## Maximale Parallelität", "",
       "| Welle | Contracts | Voraussetzung |", "|---|---|---|",
       "| 0 | Forge BOOTSTRAPPED, CORE-0002 (Format 2) | Master B.16, D1, D7 |",
       "| 1 | MYST-0001, MYST-0002, MYST-0003, MYST-0004, MYST-0005A | keine gegenseitige Abhängigkeit |",
       "| 2 | MYST-0005B, MYST-CHALLENGE-0001, MYST-SOLVABILITY-0001 | 0005B nach 0005A; CH und SOL nach 0002 |",
       "| 3 | MYST-SESSION-0001A | alle acht Wave-1/2-Contracts akzeptiert |",
       "| 4 | MYST-SESSION-0001B | SA |", "| 5 | MYST-SESSION-0001C | SA, SB |",
       "| P5 | Vitrine Re-Authoring, Release→Proof-Runner, CERT-1..CERT-10 | SC implementiert |", "",
       "Forge-Single-Lane: Ein offener Run-PR zugleich. Parallel heißt parallel reviewbar, nicht parallel laufend.", "",
       "## Paket-Identitäts-DAG (Runtime/Package)", "",
       "Unverändert aus Package/Replay-Closure (`package-identity-dag.mmd`), in SA §2 eingebettet: Truth → Solution/Refs/Access/Presentation/Catalogue/Initial/PublicContent → NPC-Bundle/Challenge → releaseContextHash (+ rulesetVersion) → releaseManifestHash → proofHash → packageHash → CasePackageIdentity → Save-Checksum. Keine Rückkante packageHash→PlayerRef, kein proofHash im Manifest, kein Selbsthash."]
open(os.path.join(OUT, "FINAL-DEPENDENCY-DAG.md"), "w", encoding="utf-8").write("\n".join(dg) + "\n")
print("generated")
