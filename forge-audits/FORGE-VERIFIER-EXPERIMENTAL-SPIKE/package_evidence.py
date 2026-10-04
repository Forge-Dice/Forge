import pathlib,hashlib,json,zipfile,datetime
L=pathlib.Path(__file__).resolve().parent
text="""FORGE VERIFIER EXPERIMENTAL SPIKE - LOCAL EVIDENCE ONLY
Date: 2026-10-03
Canonical repository: https://github.com/Forge-Dice/Forge
Read-only baseline: 3d7545d843883418348004e68717399a64da7a7d
Windows NT 10.0.22621.0 / PowerShell 7.6.5
Git 2.53.0.windows.3 / Node v24.19.0 / npm 12.2.0 / Vitest 5.0.3
No canonical repository writes, no remote commits/pushes/PRs/settings changes.

Entry points:
git_experiments.py: 20 requested classes plus extra filename probes.
git-commands.jsonl: exact argv/cwd/env/stdin (base64)/stdout (base64)/exit/time.
git-results.json + *.bin: raw diff, no-renames, NUL diff, name-only and trees.
git_followup.py / git-followup.json: modes, alternates correction, config/hooks/Windows index.
history_followup.py / history-followup.json: persistent replace refs, env graft/shallow.
parser_probe.py / parser-results.json: EXPERIMENTAL parser, NOT production or approved contract.
test_integrity.py / test-commands.jsonl / test-results.json: baseline + 8 attack copies + CI .only.
*.report.json / *.log: full test evidence. Wall durations include process startup.
integration_probe.mjs / integration-results.json: observations against actual Forge schemas/evaluator.
extra_proofs.py / extra-proofs.json: textconv correction, initial unsuccessful oracle selection.
oracle_recheck.py / oracle-recheck.json: corrected, actually executed oracle mutation.
final-remote-heads.log: remote heads at completion.
final-control-status.log / final-original-status.log: both empty (clean).

Important unsuccessful attempts, not successes:
- First alternates file used CRLF. Git rejected it. Follow-up writes LF bytes and succeeds.
- First textconv command used Windows backslashes. Shell failed. extra_proofs uses POSIX path and succeeds.
- First anchored test selector ran zero tests. NOT a successful mutation smoke.
  oracle_recheck proves exactly one selected test: weakened oracle PASS, original oracle FAIL.
- fsck in git-objects sees previously constructed invalid dot/dotdot trees as well.
  Do not attribute those errors to subsequent Unicode/tab/newline entries.
- replace-enabled historical output intentionally differs from later no-replace re-collection.
- No GitHub Actions workflow was created or executed; Actions findings are official-docs research.
- Lab script paths are specific to this machine. Reproduce in a NEW EMPTY directory, adjust binary
  paths if needed; run git_experiments, git_followup, history_followup, parser_probe, test_integrity,
  integration_probe, extra_proofs, oracle_recheck. Do not rerun initialization into existing repos.

Disposable repositories and node_modules are deliberately excluded from the ZIP.
Scripts, command transcripts, raw byte outputs, results and source test patches are included.
No cleanup or branch deletion was performed.
"""
(L/"EVIDENCE.txt").write_text(text,encoding="utf-8")
files=sorted(p for p in L.iterdir() if p.is_file() and p.suffix in (".py",".mjs",".json",".jsonl",".bin",".log",".txt") and p.name!="evidence-sha256.json")
manifest={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
(L/"evidence-sha256.json").write_text(json.dumps(manifest,indent=2))
with zipfile.ZipFile(L/"forge-verifier-evidence.zip","w",zipfile.ZIP_DEFLATED) as z:
 for p in files+[L/"evidence-sha256.json"]:z.write(p,p.name)
print(json.dumps({"files":len(files)+1,"zipBytes":(L/"forge-verifier-evidence.zip").stat().st_size,"zipSha256":hashlib.sha256((L/"forge-verifier-evidence.zip").read_bytes()).hexdigest()}))

