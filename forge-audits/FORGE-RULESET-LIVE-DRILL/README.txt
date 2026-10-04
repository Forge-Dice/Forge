FORGE RULESET LIVE DRILL
2026-10-04 — LIVE NOT EXECUTED — CANONICAL READ-ONLY

Start with FORGE-RULESET-LIVE-DRILL.html (13 requested sections), then
OWNER-RUNBOOK.txt. CASE-COMMANDS.txt is a command inventory, not a script to
run unattended. An explicit --execute is required for live mutations.

Requirements: Python 3.11 or later, git for the developer workflow push,
and separately scoped Owner/Codex tokens supplied privately as environment
variables. No gh, npm, pip install, Node dependencies or container required.

Offline entrypoints:
  python3 tests/selftest_drill.py
  python3 drill.py prepare --repo Forge-Dice/forge-ruleset-drill-20261004-a --run-id drill-20261004-a --out live-work
  python3 drill.py --work live-work plan

The package contains 91 named cases: 42 Owner, 30 Codex, 19 genuine Actions
token cases. The six namespace-root cases use a second fresh repository to
avoid Git branch-prefix collisions. The 19 Actions cases include one M0-only
PR permission test. Ref-/merge cases and workflow-start policy observations
are distinct evidence classes. 29 offline safety tests passed when built.

Included:
- drill.py: offline renderer, identity-bound live runner, ref/PR/async merge
  probes, immutable evidence capture, STOP latch and explicit Owner freeze.
- api-templates/: exact seven candidate JSON payloads, derived seven drill
  payloads with disposable main proxies, and the Actions execution policy.
- fixtures/: five generated trusted workflows, harmless marker canaries,
  fixed laboratory GITHUB_TOKEN probes and metadata-only PR-target fixtures.
- case-inventory.json: planned NOT_EXECUTED inventory, NOT a live result.
- evidence-template.json: empty result record, NOT a PASS attestation.
- validation/: offline test/artifact checks and read-only canonical metadata.
- SHA256SUMS.txt: byte inventory of package files.

Ruleset R2 needs a LIVE numeric GitHub Actions App ID from real check runs.
The placeholder __BIND_CHECK_APP_ID__ must never be sent to GitHub.
bind-checks verifies native current-head/suite/job/source association and
re-renders R2 with an integer. If binding is absent, STOP / NO-GO; no new
check publisher or source-pin weakening is introduced by this package.

Merge requests use PUT /pulls/{n}/merge-async, explicit expected sha,
merge_action=direct_merge and bypass_rules=true. This requests only bypass
rights actually granted to that authenticated actor; R2 remains bypass-free.
202/409 plus UUID is PENDING, not ALLOW. merge-result collects the final
merged/failed response and prevents normal follow-up mutations while pending.

The trusted write-token probe is LAB ONLY. No head checkout, imports or code
execution occur. It must NOT be installed in Forge-Dice/Forge. It separates
R1/R3–R7 enforcement from the ordinary permissions={} production boundary.
The fixture checks do not implement the Forge production verifier or policy.

STOP_UNEXPECTED_ALLOW / changed refs / untrusted job-start means FAIL/FROZEN.
Do not continue tests. Capture the immediate evidence, cancel ongoing jobs,
then Owner runs the explicit freeze command from the runbook. No cleanup,
force-push rollback, branch/tag deletion, rule-bypass widening or clear-stop
command exists. Preserve affected refs and repeat in a new isolated run.

No GitHub repository, workflow, ruleset, policy, PR, ref, tag, or merge was
created/changed while producing this package. Canonical repository name and
immutable ID 1401864629 are denied by the runner. Actual live drill execution
and any canonical activation require a later task; this package grants none.
