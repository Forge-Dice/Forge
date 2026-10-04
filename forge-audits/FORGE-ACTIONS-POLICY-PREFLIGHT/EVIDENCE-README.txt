FORGE ACTIONS POLICY PREFLIGHT
Evidence captured 2026-10-03, Europe/Vienna. Local deliverables only.

Canonical GitHub requests were GET-only. No canonical branches, PRs, commits, workflows or settings were changed.
Canonical main before and after: 3d7545d843883418348004e68717399a64da7a7d.

github-api-inventory.json: initial owner-authenticated settings inventory. Organization settings returning 403/404 remain UNKNOWN. The first PowerShell serializer converted empty top-level arrays to null; do not interpret those nulls as raw API values. The later canonical-final-read.json and connector evidence preserve actual [] arrays. Repository metadata timed out through one route and succeeded through the connector.
canonical-connector-evidence.json: initial metadata, branches and rulesets, including both permission views.
canonical-final-read.json: final GET-only snapshot; all six branch SHAs unchanged, no rulesets and no workflows.
actions-policies-repository.json: 200, total_count=0 including applicable parents.
actions-policies-organization.json: 404, unavailable; not evidence of empty configuration.

lab-api-evidence.json: disposable lab API request bodies/results, same-name source comparison, HALT history and cleanup. No credentials saved.
lab-connector-evidence-final.json: actual developer/owner experiments. Labels describe attempts; inspect isError. PR creation timeout and associated merge attempts are INCONCLUSIVE, never passing tests. Earlier lab-connector-evidence.json is an intermediate snapshot.
lab-write-variable.png: successful FORGE_HALT=false creation in browser authenticated as forge-codex. API read-back is in lab-api-evidence.json.
lab-cleanup.json: deletion denied with 403. Subsequently developer Write was removed (204), and archived=true verified (200), both in lab-api-evidence.json. Actions remain disabled.

Lab: Forge-Dice/forge-actions-preflight-lab-20261003, ID 1403148030, now archived.
Lab PR 1 was created by Wuerfelduell and merged only in the lab. No workflows were committed; workflow list confirmed empty.
Same-name status was posted by Wuerfelduell using an ordinary commit-status API operation. Bypass list was empty and current_user_can_bypass=never. This proves any-source vs expected-App semantics, not a completed developer-workflow spoof experiment.
Candidate SHA: acc9cd0bfaf9cae0b39d0ed4eafa2991956c8938.
Missing context: merge 405. Forged successful context plus expected GitHub Actions app 15368: merge 405, wrong expected app. Same status plus any source: merge 200, merged=true, with no verifier executed.

rulesets-proposal.json: intentionally non-executable draft, not applied. Dedicated Forge App ID is unknown and represented by a string sentinel. Never replace it with omitted/null/any-source binding. Workflow-dependent negative tests remain release blockers.
