# Differential protocol — Oracle V2
1. Pin exact contract/policy revision, BASE, HEAD, candidate commit, toolchain/image identity, and corpus hashes before candidate output is visible.
2. Feed candidate the same case inputs. Expected values remain controller-side and are never generated from Reference or candidate output.
3. Normalize only observable structure: normative verdict, normative failure class, canonical delta tuples, inventory truth, mutation class. Preserve raw path identity, modes and OIDs.
4. OPTIONAL DIAGNOSTIC text/order is non-normative unless the pinned contract explicitly makes a phase/code priority normative.
5. Timeout, crash, malformed/missing output, or controller-limit breach is FAIL/INFRA, never PASS.
6. Run each deterministic golden case three times. Any observable variation is NONDETERMINISTIC and blocks the differential verdict.
7. Run all 30 property families with seed 4072026 and at least the recorded 24,000 checks.
8. On mismatch freeze input/output and keep UNRESOLVED until contract/property authority is adjudicated. Never majority-vote Reference vs candidate vs Oracle V2.
9. Candidate matching verdict/failure class but differing in safe optional diagnostic is not rejected.
10. Execution isolation and authentic GitHub review/workflow state remain separate certification tracks.
