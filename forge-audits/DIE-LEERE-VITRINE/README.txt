DIE LEERE VITRINE — SPECIFICATION / SCRATCH CASE PACK

READ-ONLY research deliverable. No repository implementation is included or claimed.
Canonical baseline: Forge-Dice/Forge main 3d7545d843883418348004e68717399a64da7a7d.
The report and all PRIVATE files contain the solution. Give blind testers ONLY the PLAYER-BRIEF HTML.

Implemented-domain fixtures:
  truth.json, solution.json, npc-{max,lina,nora,oskar}.json
  These were parsed by the unmodified current-main TypeScript parsers.
  projection-*.PRIVATE.json is a trusted NPC context, NEVER a player response.

Design/proposal fixtures:
  questions.design.json, interrogation-*.design.json, case-host.design.json,
  proof-profile.PRIVATE.design.json, release-manifest.PRIVATE.design.json,
  package-manifest.design.json, public-initial.json, acceptance-scenarios.json.
  No production parser for these exists on the audited main.
  *.input.json are generator inputs with explicit TO_BE_BOUND placeholders; use the bound outputs.
  PlayerRefs use a PROVISIONAL scratch protocol; no MYST-0001 golden-vector compatibility is claimed.

Reproduction, in an isolated disposable workspace, with the audited repository files under scratch-repo/:
  python3 build_case.py
  node --experimental-strip-types scratch-repo/validate_case.ts
  python3 finalize_case_assets.py
  python3 compile_proof.py
  python3 simulate.py
  python3 adversarial_checks.py
TypeScript validation requires the repository's pinned Zod dependency available to scratch-repo/.
The simulation and graph checks themselves require only Python standard library.
If using only the supplied bound fixture data, start with python3 simulate.py.

The ZIP does not redistribute the canonical repository or node_modules.
src/domain source files are read-only external inputs, fetched at the exact audited SHA.
Do not run the generator inside the canonical repository.

Results:
  452 existing relevant domain tests passed; direct pinned compiler --noEmit passed.
  144 distinct constructed sequences / 2616 actions; replay and output comparisons passed.
  256 evidence subsets; exactly 64 support all four scoped answer literals.
  1024 actor/citation combinations; 64 solved, all correct with both necessary proofs.
  9/9 targeted scratch mutants detected; 9 abstract device-progress states can complete.
  12 malformed JSON commands rejected; structural public-output leak assertions passed.

Limits:
  These are experiments on a disposable proposed host, not production integrations.
  Scenario histories are not exhaustive. Natural-language spoiler freedom and fun need human review.
  The first case deliberately assumes authentic synchronized images and a closed four-person roster.
  The compiled private proof profile is draft-shaped and checked by scratch closure, not a production Zod parser.
  Proposed accusation evidence receipts extend host gameplay above unchanged MYST-0002 semantics.
  A strict package snapshot invalidates saves after any included content change, including cosmetic edits.
  No authentication / anti-cheat guarantee is offered by save hashes or opaque refs.
