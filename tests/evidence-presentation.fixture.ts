import { createHash } from "node:crypto";
import { parseCaseTruth, type CaseTruth } from "../src/domain/case-truth.ts";
import { hashCaseTruth } from "../src/domain/case-truth.identity.ts";
import type { PlayerRefTranslator, RefKind } from "../src/domain/evidence-presentation.ts";

// Evidence presentation fixtures (MYST-0004 §3.4, §3.5, §11). Factories return fresh objects.

export function presentationFixture() {
  return {
    schemaVersion: 1,
    caseId: "case:letter-opener",
    truthHash: "f8794eba02ff4cb846158a9d5d145ade93e24fd109d88f7a4b5244f175453a73",
    entries: [
      {
        evidenceId: "evidence:fingerprint",
        text: "Auf dem Griff des Brieföffners ist ein Fingerabdruck. Der Abgleich ergibt: Er stammt von Anna.",
        mentions: [
          { kind: "item", id: "item:letter-opener" },
          { kind: "person", id: "person:anna" },
        ],
        reports: [] as object[],
      },
      {
        evidenceId: "evidence:anna-statement",
        text: "Anna sagt: „Ich habe Ben streiten hören. Danach war ich die ganze Zeit im Garten.“",
        mentions: [
          { kind: "person", id: "person:anna" },
          { kind: "person", id: "person:ben" },
          { kind: "event", id: "event:argument" },
          { kind: "location", id: "location:garden" },
        ],
        reports: [
          {
            claim: { kind: "eventHasParticipant", eventId: "event:argument", personId: "person:ben" },
            stance: "affirms",
            source: { kind: "testimony", personId: "person:anna" },
          },
          {
            claim: { kind: "personAt", personId: "person:anna", locationId: "location:garden", at: 1500 },
            stance: "affirms",
            source: { kind: "testimony", personId: "person:anna" },
          },
        ] as object[],
      },
      {
        evidenceId: "evidence:muddy-path",
        text: "Im Gartenbeet sind frische Fußspuren.",
        mentions: [{ kind: "location", id: "location:garden" }],
        reports: [] as object[],
      },
      {
        evidenceId: "evidence:gloves-dirty",
        text: "An den Gartenhandschuhen klebt Erde.",
        mentions: [{ kind: "item", id: "item:gloves" }],
        reports: [] as object[],
      },
    ],
  };
}

// ---------- Test double for the PlayerRef port (not a PlayerRef derivation: no salt) ----------

const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

export function fakeRef(kind: RefKind, id: string): string {
  const bytes = createHash("sha256").update(`${kind}\n${id}`, "utf8").digest().subarray(0, 16);
  return `pr1_${[...bytes].map((b) => ALPHABET[b & 31]).join("")}`;
}

export function fakeTranslator(truth: CaseTruth): PlayerRefTranslator {
  return { caseId: truth.caseId, truthHash: hashCaseTruth(truth), refFor: fakeRef };
}

export const FAKE_REFS: [RefKind, string, string][] = [
  ["evidence", "evidence:fingerprint", "pr1_53trdamn1z833nc7"],
  ["evidence", "evidence:anna-statement", "pr1_k4tq1cfq5v3d8wyv"],
  ["evidence", "evidence:muddy-path", "pr1_gzt4xjcqp47990ze"],
  ["evidence", "evidence:gloves-dirty", "pr1_sqvqp73b02b32qsq"],
  ["person", "person:anna", "pr1_pddmm9vn96qyzyg7"],
  ["person", "person:ben", "pr1_43j91mpcqhqd7eqv"],
  ["event", "event:argument", "pr1_hnp5f21z42d6a2dq"],
  ["location", "location:garden", "pr1_stcg6ft3cway8h06"],
  ["item", "item:letter-opener", "pr1_3m50bymz53yhv757"],
  ["item", "item:gloves", "pr1_17jdyekm6zj6rbmd"],
];

// ---------- Golden releases (§5.6) ----------

export const GOLDEN_RELEASES: Record<string, string> = {
  "evidence:fingerprint":
    '{"success":true,"observation":{"schemaVersion":1,"evidence":"pr1_53trdamn1z833nc7","text":"Auf dem Griff des Brieföffners ist ein Fingerabdruck. Der Abgleich ergibt: Er stammt von Anna.","mentions":[{"kind":"item","ref":"pr1_3m50bymz53yhv757"},{"kind":"person","ref":"pr1_pddmm9vn96qyzyg7"}],"reports":[]}}',
  "evidence:anna-statement":
    '{"success":true,"observation":{"schemaVersion":1,"evidence":"pr1_k4tq1cfq5v3d8wyv","text":"Anna sagt: „Ich habe Ben streiten hören. Danach war ich die ganze Zeit im Garten.“","mentions":[{"kind":"person","ref":"pr1_43j91mpcqhqd7eqv"},{"kind":"event","ref":"pr1_hnp5f21z42d6a2dq"},{"kind":"person","ref":"pr1_pddmm9vn96qyzyg7"},{"kind":"location","ref":"pr1_stcg6ft3cway8h06"}],"reports":[{"claim":{"kind":"eventHasParticipant","event":"pr1_hnp5f21z42d6a2dq","person":"pr1_43j91mpcqhqd7eqv"},"stance":"affirms","source":{"kind":"testimony","person":"pr1_pddmm9vn96qyzyg7"}},{"claim":{"kind":"personAt","person":"pr1_pddmm9vn96qyzyg7","location":"pr1_stcg6ft3cway8h06","at":1500},"stance":"affirms","source":{"kind":"testimony","person":"pr1_pddmm9vn96qyzyg7"}}]}}',
  "evidence:muddy-path":
    '{"success":true,"observation":{"schemaVersion":1,"evidence":"pr1_gzt4xjcqp47990ze","text":"Im Gartenbeet sind frische Fußspuren.","mentions":[{"kind":"location","ref":"pr1_stcg6ft3cway8h06"}],"reports":[]}}',
  "evidence:gloves-dirty":
    '{"success":true,"observation":{"schemaVersion":1,"evidence":"pr1_sqvqp73b02b32qsq","text":"An den Gartenhandschuhen klebt Erde.","mentions":[{"kind":"item","ref":"pr1_17jdyekm6zj6rbmd"}],"reports":[]}}',
};

export const GOLDEN_RELEASE_BYTES: Record<string, number> = {
  "evidence:fingerprint": 307,
  "evidence:anna-statement": 767,
  "evidence:muddy-path": 207,
  "evidence:gloves-dirty": 201,
};

// ---------- Golden identity vectors (§7.3) ----------

export const CANON_P =
  '{"caseId":"case:letter-opener","entries":[{"evidenceId":"evidence:anna-statement","mentions":[{"id":"event:argument","kind":"event"},{"id":"location:garden","kind":"location"},{"id":"person:anna","kind":"person"},{"id":"person:ben","kind":"person"}],"reports":[{"claim":{"at":1500,"kind":"personAt","locationId":"location:garden","personId":"person:anna"},"source":{"kind":"testimony","personId":"person:anna"},"stance":"affirms"},{"claim":{"eventId":"event:argument","kind":"eventHasParticipant","personId":"person:ben"},"source":{"kind":"testimony","personId":"person:anna"},"stance":"affirms"}],"text":"Anna sagt: „Ich habe Ben streiten hören. Danach war ich die ganze Zeit im Garten.“"},{"evidenceId":"evidence:fingerprint","mentions":[{"id":"item:letter-opener","kind":"item"},{"id":"person:anna","kind":"person"}],"reports":[],"text":"Auf dem Griff des Brieföffners ist ein Fingerabdruck. Der Abgleich ergibt: Er stammt von Anna."},{"evidenceId":"evidence:gloves-dirty","mentions":[{"id":"item:gloves","kind":"item"}],"reports":[],"text":"An den Gartenhandschuhen klebt Erde."},{"evidenceId":"evidence:muddy-path","mentions":[{"id":"location:garden","kind":"location"}],"reports":[],"text":"Im Gartenbeet sind frische Fußspuren."}],"schemaVersion":1,"truthHash":"f8794eba02ff4cb846158a9d5d145ade93e24fd109d88f7a4b5244f175453a73"}';

export const CANON_E =
  '{"caseId":"case:golden","entries":[],"schemaVersion":1,"truthHash":"bd95eb9a8569f4f3f62eab50aac94e75cd601b54e3432776cc6663a204647501"}';

export const HASH_P0 = "8d790f71e045e0132f6fa7ff6bf3b85020561870485df355e8d1ac5a38eda3cf";
export const HASH_PE = "f37a3c040156755302245a68cde1b6ce5d93b5d5216d2f2e5fd4b7af6b4f5a19";
export const HASH_P1 = "29e881d129d84678c5a1035de935f174cb96dd0a9dbd871c12dec7b00eb94b3e";
export const HASH_P2 = "390bbbbeb07c1218f9742b8aa8827f831274ab6413c1e911ae286e2cffb6a10f";
export const HASH_P3 = "78bb28a2956d0de76b73dd5c08049a1adbdfb2646e1ad4bcdfe2ef80e9ba04e9";
export const HASH_P4 = "0dc8d1e4c52457778eb441fb139b75fb9b9788575bdd050be688092951fb6e84";
export const HASH_P5 = "ed1bad29001ff5babf24eb84731310e60471075abbe302ae007306ec94e1e74c";
export const HASH_P6 = "b4cb0a03649fd99f97515079b4fc544562df4df306082f45c509a01afa1ca4c2";
export const HASH_P7 = "a2aec5ebe28711365b527648b1662d5bfbe851c10d34bf9378e1b375587469ac";

// ---------- Spoiler case (§11) ----------

export function spoilerCaseInput() {
  return {
    schemaVersion: 1,
    caseId: "case:spoiler",
    revision: 1,
    title: "SPOILER-DESC-title",
    timeline: { unit: "second", originLabel: "SPOILER-DESC-origin" },
    persons: [
      { id: "person:killer", name: "SPOILER-NAME-killer" },
      { id: "person:victim", name: "SPOILER-NAME-victim" },
    ],
    locations: [{ id: "location:crime-scene", name: "SPOILER-NAME-scene" }],
    items: [{ id: "item:murder-weapon", name: "SPOILER-NAME-weapon" }],
    relationships: [],
    events: [
      {
        id: "event:the-murder",
        description: "SPOILER-DESC-murder",
        time: { kind: "instant", at: 10 },
        locationId: "location:crime-scene",
        participantIds: ["person:killer", "person:victim"],
        itemIds: ["item:murder-weapon"],
        causedByEventIds: [],
      },
    ],
    motives: [],
    propositions: [
      {
        id: "proposition:killer-did-it",
        claim: { kind: "eventHasParticipant", eventId: "event:the-murder", personId: "person:killer" },
        truth: true,
      },
    ],
    evidence: [
      {
        id: "evidence:killer-fingerprint",
        description: "SPOILER-DESC-fingerprint",
        source: { kind: "item", id: "item:murder-weapon" },
        links: [{ propositionId: "proposition:killer-did-it", direction: "supports" }],
      },
      {
        id: "evidence:planted-note",
        description: "SPOILER-DESC-note",
        source: { kind: "location", id: "location:crime-scene" },
        links: [{ propositionId: "proposition:killer-did-it", direction: "refutes" }],
      },
    ],
    secrets: [{ id: "secret:killer-affair", propositionIds: ["proposition:killer-did-it"] }],
    redHerrings: [
      {
        id: "red-herring:planted-note",
        evidenceIds: ["evidence:planted-note"],
        misleadingPropositionId: "proposition:killer-did-it",
      },
    ],
  };
}

export const spoilerCase = (): CaseTruth => parseCaseTruth(spoilerCaseInput());

export function spoilerPresentation(truth: CaseTruth) {
  return {
    schemaVersion: 1,
    caseId: truth.caseId as string,
    truthHash: hashCaseTruth(truth),
    entries: [
      {
        evidenceId: "evidence:killer-fingerprint",
        text: "Auf der Waffe ist ein Abdruck.",
        mentions: [
          { kind: "item", id: "item:murder-weapon" },
          { kind: "person", id: "person:killer" },
          { kind: "event", id: "event:the-murder" },
        ],
        reports: [
          {
            claim: { kind: "eventHasParticipant", eventId: "event:the-murder", personId: "person:killer" },
            stance: "affirms",
            source: { kind: "observation" },
          },
        ],
      },
      {
        evidenceId: "evidence:planted-note",
        text: "Am Tatort liegt ein Zettel.",
        mentions: [
          { kind: "location", id: "location:crime-scene" },
          { kind: "person", id: "person:victim" },
        ],
        reports: [],
      },
    ],
  };
}

/** Strings that must never appear in any observation of the spoiler case. */
export const SPOILER_FORBIDDEN = [
  "case:spoiler",
  "person:killer",
  "person:victim",
  "location:crime-scene",
  "item:murder-weapon",
  "event:the-murder",
  "evidence:killer-fingerprint",
  "evidence:planted-note",
  "proposition:killer-did-it",
  "secret:killer-affair",
  "red-herring:planted-note",
  "killer",
  "victim",
  "murder-weapon",
  "crime-scene",
  "the-murder",
  "planted-note",
  "killer-did-it",
  "killer-affair",
  "SPOILER-DESC",
  "SPOILER-NAME",
  '"truth"',
  '"supports"',
  '"refutes"',
  '"links"',
  '"description"',
  '"propositionId"',
];
