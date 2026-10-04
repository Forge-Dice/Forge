# MYSTERY INDEPENDENT FREEZE VERIFICATION — reproduction

This directory persists the completed independent specification audit. It is
evidence, not an accepted implementation contract or production authority.

- Repository audited: `Forge-Dice/Forge`.
- Audited main: `3d7545d843883418348004e68717399a64da7a7d`.
- Base tree: `67103229baccaefd68ce5047d8503eca9883f1d3`.
- Audit verdict: **NO-GO**.
- Report: 14 requested sections, 50 freeze attacks, 22 blocking open attacks,
  one editorial nonblocking open attack, 27 closed attacks; 11 blocking findings
  and one editorial nonblocking finding.
- Persisted branch: `forge/owner/audits/MYSTERY-INDEPENDENT-FREEZE-VERIFICATION`.

The HTML report is preserved byte-for-byte from the completed read-only lab.
Its read-only statement describes the audit phase. The subsequent owner-authorized
persistence step adds only this directory on its dedicated branch. It changes
neither main nor production code and opens or merges no PR.

## Run offline

Python 3.9 or newer and the standard library suffice. From this directory:

```sh
python3 reproduce.py
```

The runner checks all persisted file hashes, creates a temporary directory,
extracts the source bundle, runs the original archived host definitions through
the independent probes, and regenerates the HTML report. It checks byte equality
of report, probe results and probe log. It leaves checked-in files untouched.
No GitHub, Library, credentials, npm packages or network access are needed.

`EVIDENCE.zip` contains the exact materialized original contracts/reports/case
archives, selected repository source snapshots, source provenance, the repository
tree listing, source hashes and the archive-copy comparison. Repository snapshots
are dependency evidence inside this ZIP, not production-code changes. Library
helpers, caches and authentication data are excluded. Sources contain private
Vitrine author information and spoilers.

## What reproduction establishes

It reproduces the lab's isolated historical-host observations, published
empty-save hash check, common Session-text comparison and exact prefix-work
operation count. It does not implement or certify missing MYST-0001,
Release-to-Proof, public-content or current Session interfaces. Historical PASS
counts from other reports remain attributed evidence; they are not independently
executed production tests in this lab. No missing contract is reconstructed.

`build_report.py` is the report generator. Its final console metadata counts
11 blocking findings, excluding F12. This correction affects only generator
metadata; the HTML report itself already classifies F12 as NONBLOCKING.

## Complete persisted file list

1. `MYSTERY-INDEPENDENT-FREEZE-VERIFICATION.html`
2. `FREEZE-CRITERIA-PRECOMMITTED.md`
3. `EVIDENCE.zip`
4. `REPRODUCTION.md`
5. `build_report.py`
6. `probe.py`
7. `probe-results.json`
8. `probe-run.log`
9. `reproduce.py`
10. `SHA256SUMS`

`SHA256SUMS` records every other file in this directory. The Git commit records
all ten files, including the checksum manifest.
