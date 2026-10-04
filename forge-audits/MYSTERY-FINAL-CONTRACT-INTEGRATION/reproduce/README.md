# Reproduce MYSTERY-FINAL-CONTRACT-INTEGRATION

Layout (one working directory W):

- `W/src/forge-audits/<TASK>/…`: the files of each source audit branch, extracted byte-exact, e.g.
  `for b in <branches listed in the manifest>; do git diff --name-only 3d7545d origin/forge/owner/audits/$b | while read f; do mkdir -p W/src/$(dirname $f); git show origin/forge/owner/audits/$b:"$f" > W/src/$f; done; done`
- `W/forgecopy/`: `git archive 3d7545d | tar -x` of Forge-Dice/Forge main, then `npm ci --ignore-scripts` (zod is needed by the contract parser).
- `W/build.py`, `W/check.py`, `W/gen.py`, `W/parse.mts` from this directory.

Run (Python 3.11+, Node 22+):

```sh
python3 build.py   # applies the 132 exact OLD→NEW patches; aborts on any anchor count != 1; writes out/…/candidates and build-result.json
python3 check.py   # static cross-contract check incl. parseContractDocument of main@3d7545d
python3 gen.py     # manifest, DAG, finding matrix, patch log
```

The report file is hand-written; all hashes in it come from build-result.json. No network, no production code, no writes to the repository.
