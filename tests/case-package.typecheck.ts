// Compile-time tests: checked by `npm run typecheck`, never executed.
// Each @ts-expect-error fails the typecheck if the line below it becomes valid.

import type { CaseTruth } from "../src/domain/case-truth.ts";
import type { CasePackageIdentity, PackageResolution, ResolvedCasePackage } from "../src/domain/case-package.ts";
import type { PlayerKnowledge } from "../src/domain/player-knowledge.ts";
import { initialPlayerKnowledge } from "../src/domain/player-knowledge.ts";

declare const pkg: ResolvedCasePackage;
declare const resolution: PackageResolution;
declare const knowledge: PlayerKnowledge;
declare const truth: CaseTruth;

// The package is deeply readonly.
// @ts-expect-error identity is readonly
pkg.identity = pkg.identity;
// @ts-expect-error package hash is readonly
pkg.identity.packageHash = "";
// @ts-expect-error initial known is a readonly array
pkg.initial.known.push(pkg.initial.known[0]!);
// @ts-expect-error public content is readonly
pkg.publicContent.title = "x";

// The descriptor has exactly three fields; no caseId.
const descriptor: CasePackageIdentity = { schemaVersion: 1, packageHash: "a", rulesetVersion: "mystery-session-v1" };
// @ts-expect-error unknown ruleset
const otherRuleset: CasePackageIdentity = { schemaVersion: 1, packageHash: "a", rulesetVersion: "mystery-session-v2" };
// @ts-expect-error the descriptor carries no caseId
const withCase: CasePackageIdentity = { ...descriptor, caseId: "case:x" };

// Failure has no package; success has no findings.
if (resolution.ok) {
  // @ts-expect-error success carries no findings
  void resolution.findings;
} else {
  // @ts-expect-error failure carries no package
  void resolution.package;
}

// Knowledge is readonly and starts only from a resolved package.
// @ts-expect-error known is readonly
knowledge.known.push(knowledge.known[0]!);
// @ts-expect-error a CaseTruth is not a package
initialPlayerKnowledge(truth);

export { otherRuleset, withCase };
