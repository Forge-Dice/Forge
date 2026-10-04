# Reproduce this bounded closure lab

This directory is authoring/QA evidence. `PRIVATE` inputs, solution, selectors and proof data are not player-facing assets. Nothing here implements or certifies a production reducer.

Python 3.11+ stdlib only:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 run_lab.py
```

The command rebuilds `results.json` and the full evidence JSON/JSONL files in this directory. Compare their SHA-256 with `EVIDENCE.zip` members; elapsed-time/system metadata are not inputs. Scripts consume only bundled original JSON. They do not clone, install dependencies, import production source, touch main or make network requests. Source provenance is in `source-manifest.json`; report and exact patch JSON refer to immutable originals.

`EVIDENCE.zip` preserves configurations, one record per counted assertion, full five semantic cases, nine differential comparisons, D8 matrix, all 256 evidence subsets and progression probes. `CONTRACT-PATCHES.json` contains exact source hashes and OLD/NEW strings. The patch table and Session-A annex are revision text to independently review and integrate, not a registered or accepted Contract, not executable data, and not permission to implement now.

Historical reports remain archived. CLOSED refers to the delivered semantic repair package; production certification requires the real-module checklist. MYST-0002 remains the sole normative canonical conclusion authority. Runtime solved follows the D8 complete-correct answer condition and does not depend on these authoring proof checks.
