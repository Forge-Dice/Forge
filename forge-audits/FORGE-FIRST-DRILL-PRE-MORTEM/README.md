# FORGE FIRST DRILL PRE-MORTEM — artefact archive

Task: FORGE-FIRST-DRILL-PRE-MORTEM
Canonical repository: Forge-Dice/Forge (1401864629)
Audit source main: 3d7545d843883418348004e68717399a64da7a7d
Persistence branch: forge/owner/audits/FORGE-FIRST-DRILL-PRE-MORTEM

The report contains all eleven requested sections and an editable Evidence Sheet.
Audit verdict: LIVE STOP / NO-GO; no live drill performed.
The original report describes the read-only audit phase. The subsequently authorized
persistence commit changes only this archive directory. It is not a bootstrap
installation, product change, live drill, merge, or GitHub-settings change.

## Reproduce

Requires Python 3.10+ and its standard library only. No npm, Docker or GitHub
credentials are required. Work in a disposable local copy of this directory.

1. Extract FORGE-FIRST-DRILL-PRE-MORTEM-EVIDENCE.zip into this directory. It
   restores the exact six source documents under inputs/.
2. Run `python3 race_model.py`: 13 named assertions and 720 event permutations.
   This writes race-model-results.json deterministically.
3. Run `python3 build_report.py` to regenerate the exact report HTML.
4. Verify every entry of manifest-sha256.json. The manifest excludes itself.

The model is deliberately not production verification. Its PASS results certify
only model states at observation time; after-PASS revocation is explicitly modeled
as not automatically invalidating completed checks. No live PASS is claimed.
Source-readbacks.json records public repository observations from the audit phase.
The evidence ZIP contains source-document snapshots and a checksummed input manifest,
not executable production code or installed workflow definitions.

## Evidence status

- Main remained 3d7545d843883418348004e68717399a64da7a7d at final audit and persistence preflight.
- Rulesets readback was []; main protected=false during the audit.
- Bootstrap verifier, workflow and clamp fixtures were absent from that source tree.
- Report structural QA: 11 sections, 16 tables, 73 editable cells.
- Browser rendering QA was unavailable because no browser binary was installed.
- Native GitHub drill, ruleset and Actions-policy tests remain NOT EXECUTED.
