FORGE VERIFIER A/B/C INDEPENDENT CERTIFICATION
Read-only contract certification; no production implementation.

Entry point: FORGE-VERIFIER-ABC-INDEPENDENT-CERTIFICATION.html
Verdict: REQUEST CONTRACT CHANGES for A, B, C; A not registration-ready.
Pinned main: 3d7545d843883418348004e68717399a64da7a7d

This package contains exact A/B/C bytes, bound normative section bytes,
the final Bootstrap Report, source identities, full Acceptance mapping,
128 additional authored contract attacks, 12 mutant reviews,
150 Reference-compatibility assessments, bounded counterexample probes,
and raw main/parser/reference-self-comparison results.

The 128 contract attacks and 177 mappings are NOT claims of executed
production tests. Eight bounded probes are separately labeled.
Reference self-rerun: 300 comparisons, 0 mismatches; no candidate production
adapter was constructed. This is not proof of A/B/C/reference equivalence.
Actual main typecheck passed; 1087 tests passed in 22 files.
Docker/native GitHub enforcement were not tested.
Historical VERIFIER-0001 with hash prefix 341ec983 is not available:
NOT COMPARABLE. No reconstruction replaces its bytes.

audit_probes.py is a bounded audit instrument, not a verifier implementation.
build_report.py assembles the report from existing input files and audit data.
To rebuild, unpack original source packages under extracted/ and use the
working-directory layout documented by those scripts. Shipped report/results
and inputs can be reviewed directly; no execution is needed for review.

MANIFEST-SHA256.json is an integrity list, not an approval signature.
No commits, branches, PRs, reviews, comments, settings or canonical writes.
STOP — no implementation.
