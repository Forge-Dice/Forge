import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseCaseTruth } from "../domain/case-truth.ts";
import { hashCaseTruth } from "../domain/case-truth.identity.ts";
import { parseCaseSolution } from "../domain/case-solution.ts";
import { hashCaseSolution } from "../domain/case-solution.identity.ts";
import { parseQuestionCatalogue } from "../domain/interrogation-authoring.ts";
import { hashQuestionCatalogue } from "../domain/interrogation-authoring.identity.ts";
import { resolveCasePackage, type ResolvedCasePackage } from "../domain/case-package.ts";
import { refSource } from "../play/cases.ts";

// Case generator behind `npm run generate-case -- --seed N`: picks building blocks (setting,
// persons, motive, weapon, clue, red herring, optionally a lie with its confrontation) with a
// seeded PRNG and writes a complete case folder in the check-case format. Every case has the
// proven shape of "Der Brieföffner": one culprit placed at the deed by a clue at the scene, one
// innocent with an alibi trace elsewhere and a misleading fingerprint on the weapon, so it is
// valid, solvable with exactly one answer and playable. Deterministic per seed.

export type GeneratedCase = {
  readonly seed: number;
  readonly title: string;
  readonly withLie: boolean;
  /** File name -> JSON value, exactly as written into the folder. */
  readonly files: Readonly<Record<string, unknown>>;
};

// ---------- Seeded PRNG (mulberry32; high bits only) ----------

function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Building blocks ----------

type Name = { readonly name: string; readonly f: boolean };
const NAMES: readonly Name[] = [
  ["Anna", true], ["Ben", false], ["Clara", true], ["David", false], ["Emil", false], ["Frieda", true], ["Greta", true],
  ["Hanna", true], ["Ida", true], ["Jakob", false], ["Karl", false], ["Lena", true], ["Marta", true], ["Nils", false],
  ["Olga", true], ["Paul", false], ["Rosa", true], ["Simon", false], ["Theo", false], ["Vera", true], ["Wilma", true],
  ["Felix", false], ["Lotte", true], ["Moritz", false], ["Pia", true], ["Leo", false], ["Erik", false], ["Mia", true],
].map(([name, f]) => ({ name: name as string, f: f as boolean }));

const ROLES: readonly (readonly [female: string, male: string])[] = [
  ["Nichte des Hauses", "Neffe des Hauses"],
  ["Geschäftspartnerin", "Geschäftspartner"],
  ["Hausärztin", "Hausarzt"],
  ["Nachbarin", "Nachbar"],
  ["Cousine", "Cousin"],
  ["Sekretärin", "Sekretär"],
  ["Jugendfreundin", "Jugendfreund"],
  ["Verlegerin", "Verleger"],
];
const VICTIM_ROLES: readonly (readonly [string, string])[] = [
  ["die Gastgeberin", "der Gastgeber"],
  ["die Hausherrin", "der Hausherr"],
  ["die Erbin des Hauses", "der Erbe des Hauses"],
];

type Place = {
  readonly slug: string;
  readonly name: string;
  readonly acc: string; // "die Bibliothek"
  readonly in: string; // "in der Bibliothek"
};
type Setting = {
  readonly slug: string;
  readonly occasion: string;
  readonly where: string; // title suffix
  readonly scene: Place & { readonly spot: string }; // spot: where the clue lies
  readonly alibi: Place & {
    readonly activity: (who: string) => string; // event description
    readonly activityLabel: (who: string) => string;
    readonly activityPast: string; // "arbeitete"
    readonly trace: { readonly slug: string; readonly label: string; readonly text: (who: string, clock: string) => string };
    readonly item: { readonly slug: string; readonly name: string; readonly evidenceSlug: string; readonly evidenceLabel: string; readonly text: (who: string) => string; readonly proof: (who: string) => string };
  };
};

const SETTINGS: readonly Setting[] = [
  {
    slug: "manor",
    occasion: "Ein Abendessen im Landhaus",
    where: "im Landhaus",
    scene: { slug: "library", name: "Bibliothek", acc: "die Bibliothek", in: "in der Bibliothek", spot: "Neben dem Schreibtisch" },
    alibi: {
      slug: "garden", name: "Garten", acc: "den Garten", in: "im Garten",
      activity: (w) => `${w} arbeitet im Garten`, activityLabel: (w) => `${gen(w)} Gartenarbeit`, activityPast: "arbeitete",
      trace: { slug: "muddy-path", label: "Fußspuren im Beet", text: (w, c) => `Frische Fußspuren im Gartenbeet, ${gen(w)} Stiefelprofil. Der Gartenzähler zeigt: Sie entstanden um ${c} Uhr, zur Tatzeit.` },
      item: { slug: "gloves", name: "Gartenhandschuhe", evidenceSlug: "gloves-dirty", evidenceLabel: "Erdige Handschuhe", text: (w) => `${gen(w)} Gartenhandschuhe liegen auf der Bank, voller frischer Erde.`, proof: () => "die Handschuhe voller frischer Erde" },
    },
  },
  {
    slug: "theatre",
    occasion: "Eine Premierenfeier im Stadttheater",
    where: "im Theater",
    scene: { slug: "dressing-room", name: "Garderobe", acc: "die Garderobe", in: "in der Garderobe", spot: "Unter dem Schminktisch" },
    alibi: {
      slug: "stage", name: "Bühne", acc: "die Bühne", in: "auf der Bühne",
      activity: (w) => `${w} probt auf der Bühne`, activityLabel: (w) => `${gen(w)} Probe`, activityPast: "probte",
      trace: { slug: "stage-log", label: "Probenprotokoll", text: (w, c) => `Das Probenprotokoll der Inspizienz vermerkt: ${w} stand um ${c} Uhr auf der Bühne, zur Tatzeit.` },
      item: { slug: "script", name: "Textbuch", evidenceSlug: "script-notes", evidenceLabel: "Notizen im Textbuch", text: (w) => `In ${gen(w)} Textbuch stehen frische Bleistiftnotizen zur heutigen Probe.`, proof: () => "die Notizen im Textbuch noch frisch" },
    },
  },
  {
    slug: "winery",
    occasion: "Eine Weinprobe auf dem Weingut",
    where: "auf dem Weingut",
    scene: { slug: "cellar", name: "Weinkeller", acc: "den Weinkeller", in: "im Weinkeller", spot: "Zwischen den Fässern" },
    alibi: {
      slug: "vineyard", name: "Weinberg", acc: "den Weinberg", in: "im Weinberg",
      activity: (w) => `${w} schneidet Reben im Weinberg`, activityLabel: (w) => `${gen(w)} Arbeit im Weinberg`, activityPast: "schnitt Reben",
      trace: { slug: "vineyard-tracks", label: "Spuren im Weinberg", text: (w, c) => `Frische Spuren zwischen den Rebzeilen, ${gen(w)} Schuhprofil. Die Wetterstation zeigt: Der Boden war erst ab ${c} Uhr nass, die Spuren entstanden zur Tatzeit.` },
      item: { slug: "shears", name: "Rebschere", evidenceSlug: "shears-sap", evidenceLabel: "Rebschere mit frischem Saft", text: (w) => `${gen(w)} Rebschere hängt am Pfahl, die Klingen klebrig von frischem Rebensaft.`, proof: () => "die Rebschere noch klebrig vom Saft" },
    },
  },
  {
    slug: "hotel",
    occasion: "Ein Jubiläumsabend im Kurhotel",
    where: "im Kurhotel",
    scene: { slug: "suite", name: "Suite", acc: "die Suite", in: "in der Suite", spot: "Neben dem Sekretär" },
    alibi: {
      slug: "pool", name: "Schwimmbad", acc: "das Schwimmbad", in: "im Schwimmbad",
      activity: (w) => `${w} schwimmt im Hotelbad`, activityLabel: (w) => `${gen(w)} Bahnen im Schwimmbad`, activityPast: "schwamm",
      trace: { slug: "keycard-log", label: "Protokoll der Zugangskarten", text: (w, c) => `Das Protokoll der Zugangskarten zeigt: ${gen(w)} Karte öffnete um ${c} Uhr, zur Tatzeit, die Tür zum Schwimmbad.` },
      item: { slug: "bathrobe", name: "Bademantel", evidenceSlug: "bathrobe-wet", evidenceLabel: "Nasser Bademantel", text: (w) => `${gen(w)} Bademantel hängt nass am Haken, er riecht nach Chlor.`, proof: () => "der Bademantel noch nass" },
    },
  },
  {
    slug: "observatory",
    occasion: "Eine Sternennacht in der alten Sternwarte",
    where: "in der Sternwarte",
    scene: { slug: "study", name: "Arbeitszimmer", acc: "das Arbeitszimmer", in: "im Arbeitszimmer", spot: "Vor dem Kartenschrank" },
    alibi: {
      slug: "dome", name: "Kuppel", acc: "die Kuppel", in: "in der Kuppel",
      activity: (w) => `${w} beobachtet in der Kuppel`, activityLabel: (w) => `${gen(w)} Beobachtung`, activityPast: "beobachtete den Himmel",
      trace: { slug: "telescope-log", label: "Beobachtungsprotokoll", text: (w, c) => `Das Teleskop protokolliert jede Aufnahme mit Uhrzeit. Um ${c} Uhr, zur Tatzeit, steuerte ${w} es von Hand nach.` },
      item: { slug: "star-chart", name: "Sternkarte", evidenceSlug: "star-chart-notes", evidenceLabel: "Notizen auf der Sternkarte", text: (w) => `Auf ${gen(w)} Sternkarte sind die heutigen Positionen eingetragen.`, proof: () => "die Sternkarte voller frischer Einträge" },
    },
  },
  {
    slug: "boathouse",
    occasion: "Ein Sommerfest im Segelclub",
    where: "im Segelclub",
    scene: { slug: "clubroom", name: "Clubraum", acc: "den Clubraum", in: "im Clubraum", spot: "Unter dem Kartentisch" },
    alibi: {
      slug: "jetty", name: "Steg", acc: "den Steg", in: "am Steg",
      activity: (w) => `${w} vertäut Boote am Steg`, activityLabel: (w) => `${gen(w)} Arbeit am Steg`, activityPast: "vertäute Boote",
      trace: { slug: "harbour-log", label: "Hafenbuch", text: (w, c) => `Im Hafenbuch steht in ${gen(w)} Handschrift: Boot vertäut, ${c} Uhr. Die Tinte ist noch frisch, der Eintrag fällt in die Tatzeit.` },
      item: { slug: "oilskin", name: "Ölzeug", evidenceSlug: "oilskin-wet", evidenceLabel: "Nasses Ölzeug", text: (w) => `${gen(w)} Ölzeug tropft noch an der Garderobe, voller Spritzwasser.`, proof: () => "das Ölzeug noch triefend nass" },
    },
  },
];

type Weapon = { readonly slug: string; readonly nom: string; readonly dat: string; readonly name: string; readonly from: string };
const WEAPONS: readonly Weapon[] = [
  { slug: "letter-opener", name: "Brieföffner", nom: "Der Brieföffner", dat: "dem Brieföffner", from: "aus Silber" },
  { slug: "candlestick", name: "Kerzenleuchter", nom: "Der Kerzenleuchter", dat: "dem Kerzenleuchter", from: "aus Messing" },
  { slug: "poker", name: "Schürhaken", nom: "Der Schürhaken", dat: "dem Schürhaken", from: "aus Schmiedeeisen" },
  { slug: "paperweight", name: "Briefbeschwerer", nom: "Der Briefbeschwerer", dat: "dem Briefbeschwerer", from: "aus Glas" },
  { slug: "bronze-figure", name: "Bronzefigur", nom: "Die Bronzefigur", dat: "der Bronzefigur", from: "aus dem Regal" },
  { slug: "walking-stick", name: "Spazierstock", nom: "Der Spazierstock", dat: "dem Spazierstock", from: "mit Silberknauf" },
  { slug: "wine-bottle", name: "Weinflasche", nom: "Die Weinflasche", dat: "der Weinflasche", from: "vom Büfett" },
];

type Clue = { readonly slug: string; readonly label: string; readonly the: string; readonly what: (c: string) => string; readonly lost: string };
const CLUES: readonly Clue[] = [
  { slug: "cuff-button", label: "Manschettenknopf", the: "der Manschettenknopf", what: (c) => `ein abgerissener Manschettenknopf von ${gen(c)} Hemd`, lost: "Der Knopf riss bei der Tat ab." },
  { slug: "earring", label: "Ohrring", the: "der Ohrring", what: (c) => `${gen(c)} Ohrring, der Verschluss verbogen`, lost: "Der Ohrring fiel bei der Tat herunter." },
  { slug: "reading-glasses", label: "Lesebrille", the: "die Lesebrille", what: (c) => `${gen(c)} Lesebrille, ein Glas gesprungen`, lost: "Die Brille fiel bei der Tat zu Boden." },
  { slug: "key-ring", label: "Schlüsselbund", the: "der Schlüsselbund", what: (c) => `${gen(c)} Schlüsselbund mit dem Namensanhänger`, lost: "Der Bund glitt bei der Tat aus der Tasche." },
  { slug: "watch-strap", label: "Uhrarmband", the: "das Uhrarmband", what: (c) => `das gerissene Armband von ${gen(c)} Uhr`, lost: "Das Armband riss bei der Tat." },
];

type Motive = {
  readonly slug: string;
  readonly relation: string;
  readonly argument: string;
  readonly motive: (c: string, v: string) => string;
  readonly epilogue: (c: string, v: string) => string;
};
const MOTIVES: readonly Motive[] = [
  { slug: "debt", relation: "schuldet Geld", argument: "Streit ums Geld", motive: (c, v) => `${c} kann die Schulden bei ${v} nicht zurückzahlen`, epilogue: (c, v) => `${c} schuldete ${v} Geld, das nicht mehr zurückzuzahlen war` },
  { slug: "inheritance", relation: "hofft auf das Erbe von", argument: "Streit über das Testament", motive: (c, v) => `${v} will ${c} aus dem Testament streichen`, epilogue: (c, v) => `${v} wollte ${c} aus dem Testament streichen` },
  { slug: "blackmail", relation: "wird erpresst von", argument: "Streit über einen alten Brief", motive: (c, v) => `${v} erpresst ${c} mit einem alten Brief`, epilogue: (c, v) => `${v} erpresste ${c} seit Monaten mit einem alten Brief` },
  { slug: "jealousy", relation: "ist eifersüchtig auf", argument: "Streit über eine Liebschaft", motive: (c, v) => `${c} glaubt, ${v} habe eine Liebschaft zerstört`, epilogue: (c, v) => `${c} gab ${v} die Schuld an einer zerbrochenen Liebschaft` },
  { slug: "business", relation: "ist Teilhaber bei", argument: "Streit über den Firmenverkauf", motive: (c, v) => `${v} will die gemeinsame Firma hinter dem Rücken von ${c} verkaufen`, epilogue: (c, v) => `${v} wollte die gemeinsame Firma hinter dem Rücken von ${c} verkaufen` },
];

// ---------- Text helpers ----------

/** German genitive of a first name: "Annas", "Jonas'". */
function gen(name: string): string {
  return /[sxzß]$/.test(name) ? `${name}'` : `${name}s`;
}
const slug = (name: string) => name.toLowerCase();
const clockOf = (originHour: number, at: number) => `${originHour + Math.floor(at / 3600)}:${String(Math.floor((at % 3600) / 60)).padStart(2, "0")}`;

// ---------- Generator ----------

const PLACEHOLDER = "TO_BE_COMPUTED_FROM_FINAL_ARTIFACT";

export function generateCase(seed: number): GeneratedCase {
  if (!Number.isSafeInteger(seed) || seed < 0) throw new RangeError("seed must be a non-negative safe integer");
  const random = prng(seed);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)]!;
  const draw = <T>(list: readonly T[], n: number): T[] => {
    const pool = [...list];
    return Array.from({ length: n }, () => pool.splice(Math.floor(random() * pool.length), 1)[0]!);
  };

  const setting = pick(SETTINGS);
  const weapon = pick(WEAPONS);
  const clue = pick(CLUES);
  const motive = pick(MOTIVES);
  const [culpritName, innocentName, victimName] = draw(NAMES, 3) as [Name, Name, Name];
  const [culpritRole, innocentRole] = draw(ROLES, 2) as [readonly [string, string], readonly [string, string]];
  const victimRole = pick(VICTIM_ROLES);
  const withLie = random() < 0.5;
  const originHour = 19 + Math.floor(random() * 3);
  const at = 900 + 300 * Math.floor(random() * 7); // 15 to 45 minutes after the origin
  const salt = Array.from({ length: 4 }, () => Math.floor(random() * 2 ** 32).toString(16).padStart(8, "0")).join("");
  const refSalt = /^0+$/.test(salt) ? "1".padStart(32, "0") : salt;

  const C = culpritName.name;
  const I = innocentName.name;
  const V = victimName.name;
  const clock = clockOf(originHour, at);
  const { scene, alibi } = setting;
  const caseId = `case:gen-${seed}`;
  const P = { c: `person:${slug(C)}`, i: `person:${slug(I)}`, v: `person:${slug(V)}` };
  const L = { scene: `location:${scene.slug}`, alibi: `location:${alibi.slug}` };
  const IT = { weapon: `item:${weapon.slug}`, alibi: `item:${alibi.item.slug}` };
  const E = { argument: "event:argument", murder: "event:murder", alibi: "event:alibi" };
  const EV = { clue: `evidence:${clue.slug}`, fingerprint: "evidence:fingerprint", trace: `evidence:${alibi.trace.slug}`, item: `evidence:${alibi.item.evidenceSlug}` };
  const PR = {
    cAtMurder: "proposition:culprit-at-murder",
    iAtMurder: "proposition:innocent-at-murder",
    weaponUsed: "proposition:weapon-used",
    cAtArgument: "proposition:culprit-at-argument",
    iAtScene: "proposition:innocent-at-scene",
    iAtAlibi: "proposition:innocent-at-alibi",
  };
  const CO = { c: `conclusion:${slug(C)}-responsible`, i: `conclusion:${slug(I)}-responsible`, v: `conclusion:${slug(V)}-responsible` };
  const persons = [
    { id: P.c, name: C },
    { id: P.i, name: I },
    { id: P.v, name: V },
  ].sort((a, b) => (a.name < b.name ? -1 : 1));
  // Suspects in alphabetical order, so no text gives the culprit away by position.
  const [s1, s2] = [C, I].sort();

  const participates = (eventId: string, personId: string) => ({ kind: "eventHasParticipant", eventId, personId });
  const at_ = (personId: string, locationId: string) => ({ kind: "personAt", personId, locationId, at });

  const truth = {
    schemaVersion: 1,
    caseId,
    revision: 1,
    title: `${weapon.nom} ${setting.where}`,
    timeline: { unit: "second", originLabel: `${originHour}:00 Uhr am Abend` },
    persons,
    locations: [
      { id: L.scene, name: scene.name },
      { id: L.alibi, name: alibi.name },
    ],
    items: [
      { id: IT.weapon, name: weapon.name },
      { id: IT.alibi, name: alibi.item.name },
    ],
    relationships: [{ id: `relationship:${motive.slug}`, fromPersonId: P.c, toPersonId: P.v, kind: motive.relation, time: { kind: "interval", start: 0, end: 3600 } }],
    events: [
      { id: E.argument, description: motive.argument, time: { kind: "interval", start: at - 900, end: at - 300 }, locationId: L.scene, participantIds: [P.c, P.v], itemIds: [], causedByEventIds: [] },
      { id: E.murder, description: `${V} wird mit ${weapon.dat} getötet`, time: { kind: "instant", at }, locationId: L.scene, participantIds: [P.c, P.v], itemIds: [IT.weapon], causedByEventIds: [E.argument] },
      { id: E.alibi, description: alibi.activity(I), time: { kind: "interval", start: at - 500, end: at + 500 }, locationId: L.alibi, participantIds: [P.i], itemIds: [IT.alibi], causedByEventIds: [] },
    ],
    motives: [{ id: `motive:${motive.slug}`, personId: P.c, eventIds: [E.murder], description: motive.motive(C, V) }],
    propositions: [
      { id: PR.cAtMurder, claim: participates(E.murder, P.c), truth: true },
      { id: PR.iAtMurder, claim: participates(E.murder, P.i), truth: false },
      { id: PR.weaponUsed, claim: { kind: "eventHasItem", eventId: E.murder, itemId: IT.weapon }, truth: true },
      { id: PR.cAtArgument, claim: participates(E.argument, P.c), truth: true },
      { id: PR.iAtScene, claim: at_(P.i, L.scene), truth: false },
      { id: PR.iAtAlibi, claim: at_(P.i, L.alibi), truth: true },
    ],
    evidence: [
      { id: EV.fingerprint, description: `${gen(I)} Fingerabdruck auf ${weapon.dat} (älter)`, source: { kind: "item", id: IT.weapon }, links: [{ propositionId: PR.iAtMurder, direction: "supports" }, { propositionId: PR.weaponUsed, direction: "supports" }] },
      { id: EV.trace, description: alibi.trace.label, source: { kind: "location", id: L.alibi }, links: [{ propositionId: PR.iAtAlibi, direction: "supports" }] },
      { id: EV.item, description: alibi.item.evidenceLabel, source: { kind: "item", id: IT.alibi }, links: [{ propositionId: PR.iAtScene, direction: "refutes" }] },
      { id: EV.clue, description: `${clue.label} von ${C} am Tatort`, source: { kind: "location", id: L.scene }, links: [{ propositionId: PR.cAtMurder, direction: "supports" }] },
    ],
    secrets: [{ id: `secret:${motive.slug}`, propositionIds: [PR.cAtArgument] }],
    redHerrings: [{ id: "red-herring:fingerprint", evidenceIds: [EV.fingerprint], misleadingPropositionId: PR.iAtMurder }],
  };
  const truthHash = hashCaseTruth(parseCaseTruth(truth));

  const responsible = (personId: string) => ({ kind: "personResponsibleForEvent", personId, eventId: E.murder });
  const solution = {
    schemaVersion: 1,
    caseId,
    revision: 1,
    truthHash,
    resolutions: [
      { eventId: E.murder, targets: [{ kind: "person", id: P.v }], responsibility: { completeness: "complete", assignments: [{ personId: P.c, roles: ["direct_actor"] }] }, intent: "intended", mechanism: "ordinary", causesComplete: true },
      { eventId: E.argument, targets: [], responsibility: { completeness: "complete", assignments: [] }, intent: "not_applicable", mechanism: "ordinary", causesComplete: true },
    ],
    conclusions: [
      { id: CO.c, claim: responsible(P.c) },
      { id: CO.i, claim: responsible(P.i) },
      { id: CO.v, claim: responsible(P.v) },
    ],
    requiredConclusions: [
      { conclusionId: CO.c, value: true },
      { conclusionId: CO.i, value: false },
    ],
  };
  const solutionHash = hashCaseSolution(parseCaseSolution(solution, parseCaseTruth(truth)));
  const bound = { caseId, truthHash };

  const challenge = { schemaVersion: 1, ...bound, solutionHash, allowedClaims: persons.map((p) => responsible(p.id)) };
  const access = {
    schemaVersion: 1,
    ...bound,
    entries: [
      { evidenceId: EV.clue, access: { kind: "discoverable", paths: [{ kind: "search_location", locationId: L.scene }] } },
      { evidenceId: EV.fingerprint, access: { kind: "discoverable", paths: [{ kind: "examine_item", itemId: IT.weapon }] } },
      { evidenceId: EV.trace, access: { kind: "discoverable", paths: [{ kind: "search_location", locationId: L.alibi }] } },
      { evidenceId: EV.item, access: { kind: "discoverable", paths: [{ kind: "search_location", locationId: L.alibi }] } },
    ],
  };
  const observation = { kind: "observation" };
  const presentation = {
    schemaVersion: 1,
    ...bound,
    entries: [
      {
        evidenceId: EV.clue,
        text: `${scene.spot} liegt ${clue.what(C)}. Daneben: ${gen(V)} Blut, noch nicht getrocknet. ${clue.lost}`,
        mentions: [{ kind: "person", id: P.c }, { kind: "event", id: E.murder }],
        reports: [{ claim: participates(E.murder, P.c), stance: "affirms", source: observation }],
      },
      {
        evidenceId: EV.fingerprint,
        text: `Auf ${weapon.dat} ist ein Fingerabdruck von ${I}. Wann er entstand, zeigt er nicht.`,
        mentions: [{ kind: "person", id: P.i }, { kind: "item", id: IT.weapon }],
        reports: [],
      },
      {
        evidenceId: EV.trace,
        text: alibi.trace.text(I, clock),
        mentions: [{ kind: "person", id: P.i }, { kind: "location", id: L.alibi }],
        reports: [{ claim: at_(P.i, L.alibi), stance: "affirms", source: observation }],
      },
      { evidenceId: EV.item, text: alibi.item.text(I), mentions: [{ kind: "person", id: P.i }, { kind: "item", id: IT.alibi }], reports: [] },
    ],
  };
  const initial = {
    schemaVersion: 1,
    known: [...persons.map((p) => ({ kind: "person", id: p.id })), { kind: "location", id: L.scene }, { kind: "location", id: L.alibi }, { kind: "item", id: IT.weapon }, { kind: "event", id: E.murder }],
  };
  const ref = (kind: string, id: string) => ({ kind, id });
  const catalogue = {
    schemaVersion: 1,
    ...bound,
    revision: 1,
    questions: [
      { id: "question:q01", mentions: [ref("person", P.c), ref("event", E.murder)] },
      { id: "question:q02", mentions: [ref("person", P.i), ref("event", E.murder)] },
      { id: "question:q03", mentions: [ref("event", E.murder), ref("item", IT.weapon)] },
      { id: "question:q04", mentions: [ref("person", P.i), ref("location", L.alibi)] },
      { id: "question:q05", mentions: [ref("person", P.i), ref("location", L.scene)] },
    ],
  };
  const catalogueHash = hashQuestionCatalogue(parseQuestionCatalogue(catalogue, parseCaseTruth(truth)));

  const answer = (questionId: string, claim: unknown) => ({ questionId, act: "answer", claim, reveal: [] });
  const innocentProfile = {
    schemaVersion: 1,
    ...bound,
    catalogueHash,
    npcId: P.i,
    revision: 1,
    rules: [
      answer("question:q01", participates(E.murder, P.c)),
      answer("question:q02", participates(E.murder, P.i)),
      answer("question:q04", at_(P.i, L.alibi)),
      answer("question:q05", at_(P.i, L.scene)),
    ],
  };
  const culpritProfile = {
    schemaVersion: 1,
    ...bound,
    catalogueHash,
    npcId: P.c,
    revision: 1,
    rules: [
      withLie
        ? { questionId: "question:q01", act: "lie", claim: participates(E.murder, P.c), stance: "denies", reveal: [] }
        : { questionId: "question:q01", act: "decline" },
      answer("question:q02", participates(E.murder, P.i)),
      { questionId: "question:q03", act: "decline" },
      answer("question:q04", at_(P.i, L.alibi)),
    ],
    ...(withLie ? { confrontations: [{ questionId: "question:q01", evidenceId: EV.clue, claim: participates(E.murder, P.c), reveal: [] }] } : {}),
  };
  const aware = (kind: string, id: string) => ({ subject: ref(kind, id), acquiredAt: 0, provenance: { kind: "prior_knowledge" } });
  const proposition = (id: string, stance: unknown, acquiredAt: number, provenance: unknown) => ({ subject: ref("proposition", id), stance, acquiredAt, provenance });
  const knows = (value: boolean) => ({ kind: "knowledge", value });
  const witnessed = (eventId: string) => ({ kind: "witnessed_event", eventId });
  const snapshot = (npcId: string, awareness: unknown[], attitudes: unknown[]) => ({ schemaVersion: 1, ...bound, solutionHash, npcId, revision: 1, asOf: 3600, awareness, attitudes });
  const innocentNpc = snapshot(
    P.i,
    [...persons.map((p) => aware("person", p.id)), aware("location", L.scene), aware("location", L.alibi), aware("item", IT.alibi), aware("event", E.argument), aware("event", E.alibi)],
    [
      proposition(PR.cAtArgument, knows(true), at - 600, witnessed(E.argument)),
      proposition(PR.iAtAlibi, knows(true), at, witnessed(E.alibi)),
      proposition(PR.iAtScene, knows(false), at, witnessed(E.alibi)),
      proposition(PR.cAtMurder, { kind: "uncertain", leaning: true }, at + 100, { kind: "author_modeled_inference" }),
    ],
  );
  const culpritNpc = snapshot(
    P.c,
    [...persons.map((p) => aware("person", p.id)), aware("location", L.scene), aware("location", L.alibi), aware("item", IT.weapon), aware("event", E.argument), aware("event", E.murder)],
    [
      proposition(PR.cAtMurder, knows(true), at, witnessed(E.murder)),
      proposition(PR.cAtArgument, knows(true), at - 600, witnessed(E.argument)),
      proposition(PR.weaponUsed, knows(true), at, witnessed(E.murder)),
      proposition(PR.iAtMurder, knows(false), at, witnessed(E.murder)),
      proposition(PR.iAtAlibi, { kind: "belief", value: true }, at, { kind: "author_modeled_inference" }),
    ],
  );

  const label = (kind: string, id: string, text: string, role: string | null = null) => ({ entity: ref(kind, id), label: text, role });
  const roleOf = (n: Name, r: readonly [string, string]) => (n.f ? r[0] : r[1]);
  const deathOf = `${gen(V)} Tod`;
  const publicContent = {
    schemaVersion: 1,
    title: truth.title,
    brief: [
      `${setting.occasion}. Gegen ${clock} Uhr wird ${V} ${scene.in} tot aufgefunden, getötet mit ${weapon.dat} ${weapon.from}. Außer ${V} waren zur Tatzeit nur ${s1} und ${s2} in der Nähe.`,
      `Dein Auftrag: Finde heraus, wer für ${deathOf} verantwortlich ist. Durchsuche ${scene.acc} und ${alibi.acc}, untersuche, was du findest, und befrage ${s1} und ${s2}. Nicht jede Spur führt zum Täter${withLie ? ", nicht jede Aussage ist wahr," : ","} und eine Gesprächsverweigerung ist kein Geständnis.`,
    ].join("\n\n"),
    challengeQuestion: `Wer ist für ${deathOf} verantwortlich?`,
    labels: [
      label("person", P.c, C, roleOf(culpritName, culpritRole)),
      label("person", P.i, I, roleOf(innocentName, innocentRole)),
      label("person", P.v, V, `${roleOf(victimName, victimRole)}, das Opfer`),
      label("location", L.scene, scene.name),
      label("location", L.alibi, alibi.name),
      label("item", IT.weapon, weapon.name),
      label("item", IT.alibi, alibi.item.name),
      label("event", E.murder, `${deathOf} um ${clock}`),
      label("event", E.argument, motive.argument),
      label("event", E.alibi, alibi.activityLabel(I)),
      label("evidence", EV.clue, clue.label),
      label("evidence", EV.fingerprint, "Fingerabdruck"),
      label("evidence", EV.trace, alibi.trace.label),
      label("evidence", EV.item, alibi.item.evidenceLabel),
    ].sort((a, b) => (a.entity.kind + a.entity.id < b.entity.kind + b.entity.id ? -1 : 1)),
    questionTexts: [
      { npc: P.i, questionId: "question:q01", text: `War ${C} bei ${deathOf} dabei?` },
      { npc: P.i, questionId: "question:q02", text: `Waren Sie bei ${deathOf} dabei?` },
      { npc: P.i, questionId: "question:q04", text: `Waren Sie um ${clock} ${alibi.in}?` },
      { npc: P.i, questionId: "question:q05", text: `Waren Sie um ${clock} ${scene.in}?` },
      { npc: P.c, questionId: "question:q01", text: `Waren Sie bei ${deathOf} dabei?` },
      { npc: P.c, questionId: "question:q02", text: `War ${I} bei ${deathOf} dabei?` },
      { npc: P.c, questionId: "question:q03", text: `Wurde ${V} mit ${weapon.dat} getötet?` },
      { npc: P.c, questionId: "question:q04", text: `War ${I} um ${clock} ${alibi.in}?` },
    ],
    publicRules: [
      { id: "rule:certified-sources", text: "Was ein Fundstück selbst zeigt, gilt als Tatsache. Aussagen von Personen können irren." },
      { id: "rule:alibi", text: `Wer um ${clock} ${alibi.in} war, war an ${deathOf} nicht beteiligt und ist nicht verantwortlich.` },
      { id: "rule:participation", text: `Außer ${V} war genau eine Person bei ${deathOf} dabei. Wer dabei war, ist verantwortlich.` },
    ],
    epilogue: [
      `${C} ${withLie ? "gibt die Lüge auf" : "bricht das Schweigen"}. ${motive.epilogue(C, V)}, und am Abend kam es ${scene.in} zum ${motive.argument}. Um ${clock} griff ${C} nach ${weapon.dat}.${withLie ? ` Erst ${clue.the} am Tatort brachte die Wahrheit ans Licht.` : ""}`,
      `${I} hatte mit ${deathOf} nichts zu tun und ${alibi.activityPast} zu dieser Zeit ${alibi.in}, ${alibi.item.proof(I)}. Der Fingerabdruck auf ${weapon.dat} war eine falsche Spur: Er sagt nichts darüber, wann er entstand.`,
    ].join("\n\n"),
  };

  // ---------- Proof: release manifest and proof profile ----------
  const playerRef = (kind: string, id: string) => ({ $playerRefOf: { kind, id } });
  const playerClaimCulprit = { kind: "eventHasParticipant", event: playerRef("event", E.murder), person: playerRef("person", P.c) };
  const literal = (propositionId: string, value: boolean) => ({ kind: "proposition", propositionId, value });
  const conclusion = (conclusionId: string, value: boolean) => ({ kind: "conclusion", conclusionId, value });
  const lieObservations = withLie
    ? [
        { id: "reported:culprit-denies", kind: "REPORTED_BY_NPC", npcId: P.c, literal: literal(PR.cAtMurder, false) },
        { id: "reported:culprit-admits", kind: "REPORTED_BY_NPC", npcId: P.c, literal: literal(PR.cAtMurder, true) },
      ]
    : [];
  const observations = [
    ...lieObservations,
    { id: "observed:clue", kind: "OBSERVED", literal: literal(PR.cAtMurder, true), source: { kind: "evidence", evidenceId: EV.clue } },
    { id: "public-rule:participation", kind: "PUBLIC_RULE", rules: [{ edgeId: "responsible:culprit", allOf: ["observation:clue"], yields: conclusion(CO.c, true) }] },
    { id: "observed:alibi", kind: "OBSERVED", literal: literal(PR.iAtAlibi, true), source: { kind: "evidence", evidenceId: EV.trace } },
    { id: "public-rule:alibi", kind: "PUBLIC_RULE", rules: [{ edgeId: "alibi:innocent", allOf: ["observation:alibi"], yields: conclusion(CO.i, false) }] },
  ];
  const selectors: Record<string, Record<string, unknown>> = {
    "reported:culprit-denies": { alternatives: [{ kind: "npc", questionId: "question:q01", claim: playerClaimCulprit, stance: "denies" }] },
    "reported:culprit-admits": { alternatives: [{ kind: "admission", questionId: "question:q01", evidenceId: EV.clue, claim: playerClaimCulprit, stance: "affirms" }] },
    "observed:clue": { alternatives: [{ report: { claim: playerClaimCulprit, stance: "affirms", source: observation }, licenseRuleId: "rule:certified-sources" }] },
    "public-rule:participation": { ruleId: "rule:participation", afterObservations: ["observed:clue"] },
    "observed:alibi": {
      alternatives: [
        {
          report: { claim: { kind: "personAt", person: playerRef("person", P.i), location: playerRef("location", L.alibi), at }, stance: "affirms", source: observation },
          licenseRuleId: "rule:certified-sources",
        },
      ],
    },
    "public-rule:alibi": { ruleId: "rule:alibi", afterObservations: ["observed:alibi"] },
  };
  const steps = [
    { stepId: "search-scene", event: { type: "investigate", action: "search_location", target: playerRef("location", L.scene) } },
    { stepId: "search-alibi", event: { type: "investigate", action: "search_location", target: playerRef("location", L.alibi) } },
    ...(withLie
      ? [
          { stepId: "ask-culprit-presence", event: { type: "interrogate", npc: playerRef("person", P.c), questionId: "question:q01" } },
          { stepId: "confront-culprit", event: { type: "confront", npc: playerRef("person", P.c), questionId: "question:q01", evidence: playerRef("evidence", EV.clue) } },
        ]
      : []),
  ];
  const releaseManifest = {
    schemaVersion: 1,
    releaseContextHash: PLACEHOLDER,
    adapterVersion: "forge-release-proof-v1",
    certificateData: { schemaVersion: 1, steps, observations: observations.map((o) => ({ ...o, ...selectors[o.id] })) },
  };
  const node = (id: string, observationId: string) => ({ id, kind: "observation", observationId });
  const proofProfile = {
    schemaVersion: 1,
    bindings: { caseId, truthHash, solutionHash, releaseHash: PLACEHOLDER },
    answerScope: [CO.c, CO.i],
    ambiguityPolicy: "must_disambiguate",
    question: { kind: "required_literals" },
    observations,
    nodes: [
      node("observation:clue", "observed:clue"),
      node("license:participation", "public-rule:participation"),
      { id: "literal:culprit", kind: "literal", literal: conclusion(CO.c, true) },
      node("observation:alibi", "observed:alibi"),
      node("license:alibi", "public-rule:alibi"),
      { id: "literal:innocent", kind: "literal", literal: conclusion(CO.i, false) },
    ],
    edges: [
      { id: "responsible:culprit", allOf: ["observation:clue", "license:participation"], to: "literal:culprit", license: "license:participation" },
      { id: "alibi:innocent", allOf: ["observation:alibi", "license:alibi"], to: "literal:innocent", license: "license:alibi" },
    ],
    witnessStepIds: steps.map((s) => s.stepId),
  };

  const files: Record<string, unknown> = {
    "case.json": { refSalt, clockOrigin: originHour * 3600, seed },
    "truth.json": truth,
    "solution.json": solution,
    "challenge.json": challenge,
    "evidence-access.json": access,
    "evidence-presentation.json": presentation,
    "initial-setup.json": initial,
    "questions.json": catalogue,
    [`interrogation-${slug(C)}.json`]: culpritProfile,
    [`npc-${slug(C)}.json`]: culpritNpc,
    [`interrogation-${slug(I)}.json`]: innocentProfile,
    [`npc-${slug(I)}.json`]: innocentNpc,
    "public-content.json": publicContent,
    "release-manifest.json": releaseManifest,
    "proof-profile.json": proofProfile,
  };
  return { seed, title: truth.title, withLie, files };
}

/** Writes the generated case into dir (created if missing); returns the written file names. */
export function writeGeneratedCase(generated: GeneratedCase, dir: string): string[] {
  mkdirSync(dir, { recursive: true });
  const names = Object.keys(generated.files).sort();
  for (const name of names) writeFileSync(join(dir, name), `${JSON.stringify(generated.files[name], null, 2)}\n`);
  return names;
}

/** The playable package of a generated case (no proof needed to play). */
export function generatedPackage(generated: GeneratedCase): ResolvedCasePackage {
  const f = generated.files;
  const config = f["case.json"] as { refSalt: string };
  const npcs = Object.keys(f)
    .filter((name) => name.startsWith("npc-"))
    .sort()
    .map((name) => ({ snapshot: f[name], profile: f[name.replace(/^npc-/, "interrogation-")] }));
  const input = {
    schemaVersion: 1,
    rulesetVersion: generated.withLie ? "mystery-session-v2" : "mystery-session-v1",
    truth: f["truth.json"],
    solution: f["solution.json"],
    access: f["evidence-access.json"],
    presentation: f["evidence-presentation.json"],
    catalogue: f["questions.json"],
    npcs,
    initial: f["initial-setup.json"],
    challenge: f["challenge.json"],
    publicContent: f["public-content.json"],
    proof: null,
  };
  const resolved = resolveCasePackage(input, refSource(f["truth.json"], config.refSalt));
  if (!resolved.ok) throw new Error(`generated case ${generated.seed} does not resolve: ${JSON.stringify(resolved.findings)}`);
  return resolved.package;
}
