MYSTERY SESSION LAB — 2026-10-04
Read-only against Forge-Dice/Forge main 3d7545d843883418348004e68717399a64da7a7d.
No production implementation. Draft modules are not present on main.

Deliverables: report HTML; three Format-1 draft contracts; 120-case normative matrix.
Executed: 124 scratch checks; 640 histories; 16900 attempted/13584 accepted actions;
zero replay/prefix mismatches. See evidence/replay-results.json.

Reproduction in original workspace:
  node runtime/verify-main.ts
  python3 replay_lab.py
The Python model is intentionally disposable and uses fixture refs, not MYST-0001.
To reproduce outside this workspace, place the included case-pack at
../first-playable-case-lab/case-pack relative to this extracted folder, install
the exact package-lock dependencies in runtime using a temporary checkout,
then run the two commands. No writes to canonical repo are required.
runtime/src is an unchanged source snapshot from the verified main.
Existing historical fixture files are input only; new results go to evidence/.
The main-validation oracle is a black-box parser experiment, NEVER a production
replacement for evaluateConclusionClaim or Challenge.

Not established: full PlayerRef contract, old VS-5 preflight, real draft-port
integration, actual production performance, Proof/PublicRule certificate adapter.
The production codec adds strict canonical-wire/depth/nodes checks beyond the
Python simulation; normative C-tests specify them.
