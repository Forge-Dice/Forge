MYSTERY SCALE & COMPLEXITY LAB — completed read-only experiment
Canonical repository: Forge-Dice/Forge
Pinned main: 3d7545d843883418348004e68717399a64da7a7d

START WITH MYSTERY-SCALE-COMPLEXITY-REPORT.html (31 sections, self-contained charts).
There are no canonical patches, commits, branches, PRs, reviews or settings changes.
Every generated implementation is a local experiment, never production authority.

CONTENTS
baseline/ — byte-exact retrieved Mystery source, fixtures/tests, package/lock,
  Git blob SHA manifest. It is a source snapshot, not a canonical repository checkout.
lab/generator.ts — deterministic schema-valid seedable cost fixtures; default seed 7341.
lab/models.ts — primitive PlayerRef/access/presentation/accusation/proof/knowledge/save models.
lab/draft-parsers.ts — successful-path/current-shape access, catalogue, profile parser models.
lab/bench.ts — principal suite, 382 groups with excluded warmups and all samples.
lab/supplemental.ts — per-literal binding/hash paths, dense DAGs, dedup, component hashes.
lab/component-bench.ts — composed load, draft parser costs and isolated recursive freeze.
lab/phases.ts — exported original private semantic checks; iterative SCC counterexperiment.
lab/semantics-instrumented.ts / solution-instrumented.ts — same function bodies, export-only
  local instrument; adjusted import paths. Canonical files are unchanged.
lab/properties.ts — 99,353 differential/property assertions against original private functions.
lab/integrated-replay.ts — real production projection/hash calls inside provisional action loop.
lab/memory.ts — independent process retention/peak scenarios, 3 runs per class/mode.
lab/adversary.ts — one cold expensive valid Truth validation, records process highwater.
lab/adversary-repeat.ts — OPTIONAL reproducer of previous-output retention OOM mechanism.
lab/copy-probe.ts — costly immutable replay, external timeout recorded by run_aux.py.
lab/vitrine*.ts / vitrine_host_bench.py — concrete TINY case timings; old Python host separately.
lab/results/ — raw JSON/CSV, individual logs, incomplete/OOM/timeout evidence, environment,
  combined 581 benchmark groups, verification summary, figures, memory data.
inputs/ — current design inputs and original Die leere Vitrine assets, including private content.
No current standalone PlayerRef/VS-5/full CasePackage contract was resolved.

REPRODUCE (Node >=24.19 recommended; Python 3, matplotlib only for charts)
1. cd baseline
2. npm ci --ignore-scripts
3. npm run typecheck
4. npx vitest run tests/case-truth.test.ts tests/case-truth.identity.test.ts tests/case-semantics.test.ts tests/case-solution.test.ts tests/case-solution.identity.test.ts tests/npc-knowledge.test.ts tests/npc-knowledge.projection.test.ts
5. cd ../lab ; link node_modules to ../baseline/node_modules if absent (ln -s).
6. node --expose-gc bench.ts
7. node --expose-gc supplemental.ts  (allow several minutes, no 60-s deadline)
8. node --expose-gc component-bench.ts
9. node properties.ts
10. node phases.ts
11. node --expose-gc integrated-replay.ts
12. node vitrine.ts ; node vitrine-extra.ts ; python3 vitrine_host_bench.py
13. python3 run_aux.py — optional orchestrator, records three 50k-copy 20-s timeouts and
    60 fresh memory children; its initial supplemental 60-s deadline is intentionally
    historical. RESUME=1 node --expose-gc supplemental.ts completes any missing groups.
14. python3 collect_results.py ; python3 plots.py ; python3 make_report.py
15. cd .. ; python3 package_evidence.py

Run measurement processes sequentially for lower contention. The provided lab ran in a
shared environment; absolute timing has noise. Preserve raw samples, do not cherry-pick.
Main benchmark resumes with RESUME=1 when existing results are present. Its current safe
normal suite excludes repeated 1k conflict reports; archived aborted-run.log records OOM.
Single adversary cold calls complete. Repeated-copy 50k and repeated 1k conflict reports
can take excessive time/memory: run only explicitly bounded disposable child processes.

Method: excluded warmups, several runs, median. Every operation labels production vs scratch.
Main boundary heap/RSS is not function peak. Memory children report whole-process maxRSS
(KiB on this Linux); retention includes Node/runtime overhead and scratch fixture data.
Benchmarks do not certify formal solvability, noninterference, complete parser/bridge/save
contract compatibility, mobile behavior, or every combination of suggested V1 maxima.
Synthetics with large required scopes intentionally exceed the V1 solvability draft cap.

V1 result: GO WITH CHANGES for trusted TINY and bounded MEDIUM content.
Suggested upper content target: 12 people / 40 events / 40 evidence / 100 questions.
Full identify_all_responsible question: <=5 total people under 6-dimensional current draft.
Working replay state and bound immutable package work matter; broad general optimizations do not.
