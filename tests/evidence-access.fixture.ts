// Evidence access map for fullCase() (MYST-0003 §3.4). Factory: every test gets a fresh, mutable input.

export function evidenceAccessFixture() {
  return {
    schemaVersion: 1,
    caseId: "case:letter-opener",
    truthHash: "f8794eba02ff4cb846158a9d5d145ade93e24fd109d88f7a4b5244f175453a73",
    entries: [
      {
        evidenceId: "evidence:fingerprint",
        access: {
          kind: "discoverable",
          paths: [
            { kind: "examine_item", itemId: "item:letter-opener" },
            { kind: "search_location", locationId: "location:library" },
          ],
        },
      },
      { evidenceId: "evidence:anna-statement", access: { kind: "inaccessible" } },
      {
        evidenceId: "evidence:muddy-path",
        access: { kind: "discoverable", paths: [{ kind: "search_location", locationId: "location:garden" }] },
      },
      {
        evidenceId: "evidence:gloves-dirty",
        access: {
          kind: "discoverable",
          paths: [
            { kind: "examine_item", itemId: "item:gloves" },
            { kind: "search_location", locationId: "location:garden" },
          ],
        },
      },
    ],
  };
}

/** Access map for goldenCase(): no evidence, no entries. */
export function emptyEvidenceAccessFixture() {
  return {
    schemaVersion: 1,
    caseId: "case:golden",
    truthHash: "bd95eb9a8569f4f3f62eab50aac94e75cd601b54e3432776cc6663a204647501",
    entries: [],
  };
}

/** Every person, location and item of fullCase() as known refs (K in the test matrix). */
export function allKnownRefs() {
  return [
    { kind: "person", id: "person:anna" },
    { kind: "person", id: "person:ben" },
    { kind: "person", id: "person:clara" },
    { kind: "location", id: "location:library" },
    { kind: "location", id: "location:garden" },
    { kind: "item", id: "item:letter-opener" },
    { kind: "item", id: "item:gloves" },
  ];
}

/** The seven valid actions over K. */
export function allActions() {
  return [
    { kind: "search_location", locationId: "location:library" },
    { kind: "search_location", locationId: "location:garden" },
    { kind: "examine_item", itemId: "item:letter-opener" },
    { kind: "examine_item", itemId: "item:gloves" },
    { kind: "examine_person", personId: "person:anna" },
    { kind: "examine_person", personId: "person:ben" },
    { kind: "examine_person", personId: "person:clara" },
  ];
}

export const CANON_M = String.raw`{"caseId":"case:letter-opener","entries":[{"access":{"kind":"discoverable","paths":[{"itemId":"item:gloves","kind":"examine_item"},{"kind":"search_location","locationId":"location:garden"}]},"evidenceId":"evidence:gloves-dirty"},{"access":{"kind":"discoverable","paths":[{"itemId":"item:letter-opener","kind":"examine_item"},{"kind":"search_location","locationId":"location:library"}]},"evidenceId":"evidence:fingerprint"},{"access":{"kind":"discoverable","paths":[{"kind":"search_location","locationId":"location:garden"}]},"evidenceId":"evidence:muddy-path"},{"access":{"kind":"inaccessible"},"evidenceId":"evidence:anna-statement"}],"schemaVersion":1,"truthHash":"f8794eba02ff4cb846158a9d5d145ade93e24fd109d88f7a4b5244f175453a73"}`;

export const CANON_E = String.raw`{"caseId":"case:golden","entries":[],"schemaVersion":1,"truthHash":"bd95eb9a8569f4f3f62eab50aac94e75cd601b54e3432776cc6663a204647501"}`;

export const H0 = "fb7cd127d9dcc0981c1167e49acfb946230b7695903d1104ead6fb0ca5cee967";
export const HE = "95b862a0008e37447750580f8c3dacc64ca3fff5e915bbd6320d42e02111a8af";
export const H1 = "e7543458ac142e2da7c6486b39a9aa195f56e00c30f9535b462ea60c5ce52914";
export const H2 = "757c0657b2bd5a9bdd4b64696e9500e64871375e57165ee7adef8a083780b2ea";
export const H3 = "7219592d209ef60e7edb6960d068f07037504f9f9c1d641bb69c7f30c6461004";
export const H5 = "87006a8f938bbf4c3124caa17cb662499195653881620b6973a98c49574dbe6f";
export const H6 = "80d382cd426d83385d1e4bb058de0e0c773b98f046a54a52e7b4ca24cf14c065";
