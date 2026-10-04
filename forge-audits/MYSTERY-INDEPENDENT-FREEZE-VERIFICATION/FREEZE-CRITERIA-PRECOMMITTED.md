# Freeze criteria — fixed before individual findings

Recorded 2026-10-04. Scope: Mystery specification freeze, not implementation approval.

PASS requires normative original files, exact cross-contract definitions and no unresolved blocking evidence. Missing originals produce NOT VERIFIED, never inferred PASS. Reports are evidence, not substitutes for contracts.

1. Every persistent field/artifact has exactly one normative authority; projections cannot override source data.
2. Every runtime datum has exactly one producer per boundary; alternate producers require an explicit common contract.
3. Each consumer has exact input type, package/version binding, lifetime, serialization and trust contract; every conversion is specified.
4. No unresolved semantic contradictions, including conflicts between current candidates and reports.
5. No circular hard dependency; validation and authoring can follow a finite dependency order.
6. No unauthorized Truth disclosure or implicit observation-to-objective-proof promotion, including errors, identifiers, ordering and sizes within the declared threat model.
7. Saves contain authoritative accepted events and identity; replay is deterministic, rejects incompatible packages, preserves terminal rules and has bounded resources without requiring quadratic history copying.
8. Challenge Core, Scope, determined, matching, Required and public question semantics are complete and prevent shotgun acceptance and unauthorized disclosure.
9. Solvability specifies a finite model, bounds, exactness and what certification does and does not establish.
10. Reference identities and all identity-changing mutations have a defined invalidation rule.
11. Schema/ruleset/package versioning and compatibility paths are explicit.

Verdicts: FREEZE READY = all criteria pass. FREEZE READY WITH SMALL REPAIRS = complete evidence and only finite, exact, semantics-preserving editorial repairs remain. NO-GO = any missing normative boundary, substantive ambiguity, contradiction, security defect, or indispensable missing original. NONBLOCKING = implementation choice whose observable semantics are already fixed.
