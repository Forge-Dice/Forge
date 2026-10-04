import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseCaseTruth } from "../domain/case-truth.ts";
import { hashCaseTruth } from "../domain/case-truth.identity.ts";
import { parseCaseSolution } from "../domain/case-solution.ts";
import { hashCaseSolution } from "../domain/case-solution.identity.ts";
import { parseQuestionCatalogue } from "../domain/interrogation-authoring.ts";
import { hashQuestionCatalogue } from "../domain/interrogation-authoring.identity.ts";
import { resolveCasePackage, type ResolvedCasePackage } from "../domain/case-package.ts";
import { refSource } from "../play/cases.ts";
import { bindCaseProof } from "./check-case.ts";

// Case generator behind `npm run generate-case -- --seed N`: picks a case schema and building
// blocks (setting, persons, motive, weapon, clues, red herring, optionally a lie with its
// confrontation) with a seeded PRNG and writes a complete case folder in the check-case format.
// Schemas:
//   classic     one culprit placed at the deed by a clue at the scene, one or two innocents with alibis
//   crowd       the same with three or four innocents (four or five suspects)
//   timewindow  no clue at the scene: every innocent has an alibi at the time of the deed, the
//               culprit's own log entry ends before it; exactly one suspect was present (elimination)
//   latecomer   the culprit is nobody's suspect at first and appears with the clue at the scene
//   twopaths    the culprit is placed at the deed by the scene clue or, independently, by examining them
// Every proof uses only published rules over released evidence, so each case is valid, solvable
// with exactly one answer and playable. Deterministic per seed.

export const CASE_SCHEMAS = ["classic", "crowd", "timewindow", "latecomer", "twopaths"] as const;
export type CaseSchema = (typeof CASE_SCHEMAS)[number];

export type GeneratedCase = {
  readonly seed: number;
  readonly schema: CaseSchema;
  readonly title: string;
  readonly withLie: boolean;
  /** File name -> JSON value, exactly as written into the folder. */
  readonly files: Readonly<Record<string, unknown>>;
};

// ---------- Seeded PRNG (mulberry32) ----------

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
const NAMES: readonly Name[] = (
  [
    ["Anna", true], ["Ben", false], ["Clara", true], ["David", false], ["Emil", false], ["Frieda", true], ["Greta", true],
    ["Hanna", true], ["Ida", true], ["Jakob", false], ["Karl", false], ["Lena", true], ["Marta", true], ["Nils", false],
    ["Olga", true], ["Paul", false], ["Rosa", true], ["Simon", false], ["Theo", false], ["Vera", true], ["Wilma", true],
    ["Felix", false], ["Lotte", true], ["Moritz", false], ["Pia", true], ["Leo", false], ["Erik", false], ["Mia", true],
  ] as const
).map(([name, f]) => ({ name, f }));

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
const LATECOMER_ROLES: readonly (readonly [string, string])[] = [
  ["eine Unbekannte", "ein Unbekannter"],
  ["ungebetener Besuch", "ungebetener Besuch"],
];

/** A place away from the scene: where someone can have an alibi, with a dated log entry. */
type Place = {
  readonly slug: string;
  readonly name: string;
  readonly acc: string; // "den Garten"
  readonly in: string; // "im Garten"
  readonly doing: string; // "arbeitet im Garten"
  readonly did: string; // "arbeitete im Garten"
  readonly log: string; // evidence label
  readonly lead: string; // "Im Gartenbuch"
};
const place = (slug: string, name: string, acc: string, inn: string, doing: string, did: string, log: string, lead: string): Place => ({
  slug, name, acc, in: inn, doing, did, log, lead,
});

type Setting = {
  readonly occasion: string;
  readonly where: string; // title suffix
  readonly scene: { readonly slug: string; readonly name: string; readonly acc: string; readonly in: string; readonly spot: string };
  readonly places: readonly Place[]; // five: up to four innocents plus the culprit's own
};

const SETTINGS: readonly Setting[] = [
  {
    occasion: "Ein Abendessen im Landhaus",
    where: "im Landhaus",
    scene: { slug: "library", name: "Bibliothek", acc: "die Bibliothek", in: "in der Bibliothek", spot: "Neben dem Schreibtisch" },
    places: [
      place("garden", "Garten", "den Garten", "im Garten", "arbeitet im Garten", "arbeitete im Garten", "Gartenbuch", "Im Gartenbuch"),
      place("greenhouse", "Gewächshaus", "das Gewächshaus", "im Gewächshaus", "gießt im Gewächshaus", "goss im Gewächshaus", "Gießprotokoll", "Im Gießprotokoll des Gewächshauses"),
      place("music-room", "Musikzimmer", "das Musikzimmer", "im Musikzimmer", "spielt Klavier im Musikzimmer", "spielte Klavier im Musikzimmer", "Notenheft", "Im Notenheft auf dem Klavier"),
      place("kitchen", "Küche", "die Küche", "in der Küche", "kocht in der Küche", "kochte in der Küche", "Küchenzettel", "Auf dem Küchenzettel am Herd"),
      place("stables", "Stall", "den Stall", "im Stall", "versorgt die Pferde im Stall", "versorgte die Pferde im Stall", "Stallbuch", "Im Stallbuch"),
    ],
  },
  {
    occasion: "Eine Premierenfeier im Stadttheater",
    where: "im Theater",
    scene: { slug: "dressing-room", name: "Garderobe", acc: "die Garderobe", in: "in der Garderobe", spot: "Unter dem Schminktisch" },
    places: [
      place("stage", "Bühne", "die Bühne", "auf der Bühne", "probt auf der Bühne", "probte auf der Bühne", "Probenprotokoll", "Im Probenprotokoll der Inspizienz"),
      place("lighting-bridge", "Beleuchterbrücke", "die Beleuchterbrücke", "auf der Beleuchterbrücke", "richtet auf der Beleuchterbrücke Scheinwerfer ein", "richtete auf der Beleuchterbrücke Scheinwerfer ein", "Lichtpult-Protokoll", "Im Protokoll des Lichtpults"),
      place("foyer", "Foyer", "das Foyer", "im Foyer", "bedient an der Bar im Foyer", "bediente an der Bar im Foyer", "Kassenbuch der Foyerbar", "Im Kassenbuch der Foyerbar"),
      place("workshop", "Werkstatt", "die Werkstatt", "in der Werkstatt", "baut in der Werkstatt an den Kulissen", "baute in der Werkstatt an den Kulissen", "Werkstattbuch", "Im Werkstattbuch"),
      place("box-office", "Kasse", "die Kasse", "an der Kasse", "zählt an der Kasse die Einnahmen", "zählte an der Kasse die Einnahmen", "Kassenabrechnung", "In der Kassenabrechnung"),
    ],
  },
  {
    occasion: "Eine Weinprobe auf dem Weingut",
    where: "auf dem Weingut",
    scene: { slug: "cellar", name: "Weinkeller", acc: "den Weinkeller", in: "im Weinkeller", spot: "Zwischen den Fässern" },
    places: [
      place("vineyard", "Weinberg", "den Weinberg", "im Weinberg", "schneidet Reben im Weinberg", "schnitt Reben im Weinberg", "Lesebuch", "Im Lesebuch des Weinbergs"),
      place("press-house", "Kelterhaus", "das Kelterhaus", "im Kelterhaus", "bedient im Kelterhaus die Kelter", "bediente im Kelterhaus die Kelter", "Kelterprotokoll", "Im Kelterprotokoll"),
      place("tasting-room", "Probierstube", "die Probierstube", "in der Probierstube", "schenkt in der Probierstube Wein aus", "schenkte in der Probierstube Wein aus", "Kassenbuch der Probierstube", "Im Kassenbuch der Probierstube"),
      place("barn", "Scheune", "die Scheune", "in der Scheune", "repariert in der Scheune den Traktor", "reparierte in der Scheune den Traktor", "Werkzeugliste", "Auf der Werkzeugliste in der Scheune"),
      place("bottling", "Abfüllhalle", "die Abfüllhalle", "in der Abfüllhalle", "etikettiert Flaschen in der Abfüllhalle", "etikettierte Flaschen in der Abfüllhalle", "Abfüllprotokoll", "Im Abfüllprotokoll"),
    ],
  },
  {
    occasion: "Ein Jubiläumsabend im Kurhotel",
    where: "im Kurhotel",
    scene: { slug: "suite", name: "Suite", acc: "die Suite", in: "in der Suite", spot: "Neben dem Sekretär" },
    places: [
      place("pool", "Schwimmbad", "das Schwimmbad", "im Schwimmbad", "schwimmt im Hotelbad", "schwamm im Hotelbad", "Zugangsprotokoll", "Im Zugangsprotokoll des Schwimmbads"),
      place("sauna", "Sauna", "die Sauna", "in der Sauna", "sitzt in der Sauna", "saß in der Sauna", "Saunabuch", "Im Saunabuch"),
      place("lobby", "Lobby", "die Lobby", "in der Lobby", "telefoniert in der Lobby", "telefonierte in der Lobby", "Rezeptionsbuch", "Im Rezeptionsbuch"),
      place("restaurant", "Restaurant", "das Restaurant", "im Restaurant", "isst im Restaurant", "aß im Restaurant", "Restaurantkasse", "Im Kassenjournal des Restaurants"),
      place("gym", "Fitnessraum", "den Fitnessraum", "im Fitnessraum", "trainiert im Fitnessraum", "trainierte im Fitnessraum", "Trainingsliste", "Auf der Trainingsliste im Fitnessraum"),
    ],
  },
  {
    occasion: "Eine Sternennacht in der alten Sternwarte",
    where: "in der Sternwarte",
    scene: { slug: "study", name: "Arbeitszimmer", acc: "das Arbeitszimmer", in: "im Arbeitszimmer", spot: "Vor dem Kartenschrank" },
    places: [
      place("dome", "Kuppel", "die Kuppel", "in der Kuppel", "beobachtet in der Kuppel den Himmel", "beobachtete in der Kuppel den Himmel", "Beobachtungsprotokoll", "Im Beobachtungsprotokoll des Teleskops"),
      place("archive", "Plattenarchiv", "das Plattenarchiv", "im Plattenarchiv", "sortiert Fotoplatten im Archiv", "sortierte Fotoplatten im Archiv", "Ausleihbuch", "Im Ausleihbuch des Archivs"),
      place("terrace", "Terrasse", "die Terrasse", "auf der Terrasse", "misst auf der Terrasse den Wind", "maß auf der Terrasse den Wind", "Wetterbuch", "Im Wetterbuch auf der Terrasse"),
      place("lecture-hall", "Hörsaal", "den Hörsaal", "im Hörsaal", "hält einen Vortrag im Hörsaal", "hielt einen Vortrag im Hörsaal", "Vortragsliste", "Auf der Vortragsliste im Hörsaal"),
      place("darkroom", "Dunkelkammer", "die Dunkelkammer", "in der Dunkelkammer", "entwickelt Platten in der Dunkelkammer", "entwickelte Platten in der Dunkelkammer", "Entwicklungsbuch", "Im Entwicklungsbuch der Dunkelkammer"),
    ],
  },
  {
    occasion: "Ein Sommerfest im Segelclub",
    where: "im Segelclub",
    scene: { slug: "clubroom", name: "Clubraum", acc: "den Clubraum", in: "im Clubraum", spot: "Unter dem Kartentisch" },
    places: [
      place("jetty", "Steg", "den Steg", "am Steg", "vertäut Boote am Steg", "vertäute Boote am Steg", "Hafenbuch", "Im Hafenbuch"),
      place("boat-workshop", "Bootswerkstatt", "die Bootswerkstatt", "in der Bootswerkstatt", "lackiert in der Bootswerkstatt ein Boot", "lackierte in der Bootswerkstatt ein Boot", "Werkstattbuch der Bootswerkstatt", "Im Werkstattbuch der Bootswerkstatt"),
      place("regatta-tower", "Regattaturm", "den Regattaturm", "im Regattaturm", "zählt vom Regattaturm die Boote", "zählte vom Regattaturm die Boote", "Regattaprotokoll", "Im Regattaprotokoll"),
      place("club-bar", "Clubbar", "die Clubbar", "an der Clubbar", "mixt Getränke an der Clubbar", "mixte Getränke an der Clubbar", "Bonbuch der Clubbar", "Im Bonbuch der Clubbar"),
      place("sail-loft", "Segelboden", "den Segelboden", "auf dem Segelboden", "flickt Segel auf dem Segelboden", "flickte Segel auf dem Segelboden", "Reparaturliste", "Auf der Reparaturliste am Segelboden"),
    ],
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
/** "A", "A und B", "A, B und C". */
function list(items: readonly string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} und ${items.at(-1)}`;
}
const slug = (name: string) => name.toLowerCase();
const clockOf = (originHour: number, at: number) => `${originHour + Math.floor(at / 3600)}:${String(Math.floor((at % 3600) / 60)).padStart(2, "0")}`;

// ---------- Generator ----------

const PLACEHOLDER = "TO_BE_COMPUTED_FROM_FINAL_ARTIFACT";
export const MAX_SEED = 0xffffffff;
type Json = Record<string, unknown>;

/** Generates the case of a seed; `schema` forces one schema (the rest still follows the seed). */
export function generateCase(seed: number, schema?: CaseSchema): GeneratedCase {
  // The PRNG state is 32 bits: larger seeds would silently repeat another seed's case.
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > MAX_SEED) throw new RangeError(`seed must be an integer from 0 to ${MAX_SEED}`);
  const random = prng(seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
  const draw = <T>(items: readonly T[], n: number): T[] => {
    const pool = [...items];
    return Array.from({ length: n }, () => pool.splice(Math.floor(random() * pool.length), 1)[0]!);
  };

  const drawn = pick(CASE_SCHEMAS);
  const kind = schema ?? drawn;
  const extra = random();
  const innocentCount = kind === "crowd" ? 3 + Math.floor(extra * 2) : kind === "classic" || kind === "twopaths" ? 1 + Math.floor(extra * 2) : 2;
  const setting = pick(SETTINGS);
  const weapon = pick(WEAPONS);
  const clue = pick(CLUES);
  const motive = pick(MOTIVES);
  const people = draw(NAMES, innocentCount + 2);
  const roles = draw(ROLES, innocentCount + 1);
  const victimRole = pick(VICTIM_ROLES);
  const latecomerRole = pick(LATECOMER_ROLES);
  const withLie = random() < 0.5;
  const originHour = 19 + Math.floor(random() * 3);
  const at = 900 + 300 * Math.floor(random() * 7); // 15 to 45 minutes after the origin
  const salt = Array.from({ length: 4 }, () => Math.floor(random() * 2 ** 32).toString(16).padStart(8, "0")).join("");
  const places = draw(setting.places, innocentCount + 1); // the last one is the culprit's (timewindow)

  const culprit = people[0]!;
  const victim = people[1]!;
  const innocents = people.slice(2).map((n, k) => ({ ...n, place: places[k]!, role: roles[k + 1]! }));
  const culpritPlace = places[innocentCount]!;
  const C = culprit.name;
  const V = victim.name;
  const clock = clockOf(originHour, at);
  const early = at - 900;
  const leave = at - 600;
  // In the time-window schema the argument starts only after the culprit left their own place.
  const argumentStart = kind === "timewindow" ? at - 450 : at - 900;
  const { scene } = setting;
  const hasClue = kind !== "timewindow";
  const late = kind === "latecomer";
  const caseId = `case:gen-${seed}${schema === undefined ? "" : `-${kind}`}`;
  const deathOf = `${gen(V)} Tod`;

  const pid = (n: Name) => `person:${slug(n.name)}`;
  const P = { c: pid(culprit), v: pid(victim) };
  const L = { scene: `location:${scene.slug}` };
  const lid = (p: Place) => `location:${p.slug}`;
  const IT = { weapon: `item:${weapon.slug}` };
  const E = { argument: "event:argument", murder: "event:murder" };
  const alibiEvent = (n: Name) => `event:alibi-${slug(n.name)}`;
  const EV = { clue: `evidence:${clue.slug}`, sleeve: "evidence:blood-on-sleeve", fingerprint: "evidence:fingerprint", culpritLog: `evidence:log-${culpritPlace.slug}` };
  const logOf = (p: Place) => `evidence:log-${p.slug}`;
  const co = (n: Name) => `conclusion:${slug(n.name)}-responsible`;
  const propPresent = (n: Name) => `proposition:${slug(n.name)}-at-murder`;
  const propAlibi = (n: Name) => `proposition:${slug(n.name)}-at-alibi`;
  const propScene = (n: Name) => `proposition:${slug(n.name)}-at-scene`;
  const PR = { weaponUsed: "proposition:weapon-used", cAtArgument: "proposition:culprit-at-argument", cEarly: "proposition:culprit-early-elsewhere", cAlibi: "proposition:culprit-alibi-claim" };

  const allPersons = [culprit, victim, ...innocents].map((n) => ({ id: pid(n), name: n.name })).sort((a, b) => (a.name < b.name ? -1 : 1));
  const suspects = [C, ...innocents.map((i) => i.name)].sort();
  const firstInnocent = innocents[0]!;

  const participates = (eventId: string, personId: string) => ({ kind: "eventHasParticipant", eventId, personId });
  const personAt = (personId: string, locationId: string, time = at) => ({ kind: "personAt", personId, locationId, at: time });
  const ref = (k: string, id: string) => ({ kind: k, id });

  // ---------- Truth ----------
  const usedPlaces = [...innocents.map((i) => i.place), ...(kind === "timewindow" ? [culpritPlace] : [])];
  const evidence: Json[] = [
    { id: EV.fingerprint, description: `${gen(firstInnocent.name)} Fingerabdruck auf ${weapon.dat} (älter)`, source: ref("item", IT.weapon), links: [{ propositionId: propPresent(firstInnocent), direction: "supports" }, { propositionId: PR.weaponUsed, direction: "supports" }] },
    ...innocents.map((i) => ({ id: logOf(i.place), description: `${i.place.log}: ${i.name} zur Tatzeit`, source: ref("location", lid(i.place)), links: [{ propositionId: propAlibi(i), direction: "supports" }] })),
  ];
  if (hasClue) evidence.push({ id: EV.clue, description: `${clue.label} von ${C} am Tatort`, source: ref("location", L.scene), links: [{ propositionId: propPresent(culprit), direction: "supports" }] });
  if (kind === "twopaths") evidence.push({ id: EV.sleeve, description: `Blutspritzer an ${gen(C)} Ärmel`, source: ref("person", P.c), links: [{ propositionId: propPresent(culprit), direction: "supports" }] });
  if (kind === "timewindow") {
    evidence.push({ id: EV.culpritLog, description: `${culpritPlace.log}: ${C} vor der Tat, gegangen um ${clockOf(originHour, leave)}`, source: ref("location", lid(culpritPlace)), links: [{ propositionId: PR.cEarly, direction: "supports" }, { propositionId: PR.cAlibi, direction: "refutes" }] });
  }

  const truth = {
    schemaVersion: 1,
    caseId,
    revision: 1,
    title: `${weapon.nom} ${setting.where}`,
    timeline: { unit: "second", originLabel: `${originHour}:00 Uhr am Abend` },
    persons: allPersons,
    locations: [{ id: L.scene, name: scene.name }, ...usedPlaces.map((p) => ({ id: lid(p), name: p.name }))],
    items: [{ id: IT.weapon, name: weapon.name }],
    relationships: [{ id: `relationship:${motive.slug}`, fromPersonId: P.c, toPersonId: P.v, kind: motive.relation, time: { kind: "interval", start: 0, end: 3600 } }],
    events: [
      { id: E.argument, description: motive.argument, time: { kind: "interval", start: argumentStart, end: at - 300 }, locationId: L.scene, participantIds: [P.c, P.v], itemIds: [], causedByEventIds: [] },
      { id: E.murder, description: `${V} wird mit ${weapon.dat} getötet`, time: { kind: "instant", at }, locationId: L.scene, participantIds: [P.c, P.v], itemIds: [IT.weapon], causedByEventIds: [E.argument] },
      ...innocents.map((i) => ({ id: alibiEvent(i), description: `${i.name} ${i.place.doing}`, time: { kind: "interval", start: at - 500, end: at + 500 }, locationId: lid(i.place), participantIds: [pid(i)], itemIds: [], causedByEventIds: [] })),
    ],
    motives: [{ id: `motive:${motive.slug}`, personId: P.c, eventIds: [E.murder], description: motive.motive(C, V) }],
    propositions: [
      { id: propPresent(culprit), claim: participates(E.murder, P.c), truth: true },
      { id: PR.weaponUsed, claim: { kind: "eventHasItem", eventId: E.murder, itemId: IT.weapon }, truth: true },
      { id: PR.cAtArgument, claim: participates(E.argument, P.c), truth: true },
      ...innocents.flatMap((i) => [
        { id: propPresent(i), claim: participates(E.murder, pid(i)), truth: false },
        { id: propAlibi(i), claim: personAt(pid(i), lid(i.place)), truth: true },
        { id: propScene(i), claim: personAt(pid(i), L.scene), truth: false },
      ]),
      ...(kind === "timewindow"
        ? [
            { id: PR.cEarly, claim: personAt(P.c, lid(culpritPlace), early), truth: true },
            { id: PR.cAlibi, claim: personAt(P.c, lid(culpritPlace)), truth: false },
          ]
        : []),
    ],
    evidence,
    secrets: [{ id: `secret:${motive.slug}`, propositionIds: [PR.cAtArgument] }],
    redHerrings: [{ id: "red-herring:fingerprint", evidenceIds: [EV.fingerprint], misleadingPropositionId: propPresent(firstInnocent) }],
  };
  const parsedTruth = parseCaseTruth(truth);
  const truthHash = hashCaseTruth(parsedTruth);

  // ---------- Solution and challenge ----------
  const responsible = (personId: string) => ({ kind: "personResponsibleForEvent", personId, eventId: E.murder });
  const solution = {
    schemaVersion: 1,
    caseId,
    revision: 1,
    truthHash,
    resolutions: [
      { eventId: E.murder, targets: [ref("person", P.v)], responsibility: { completeness: "complete", assignments: [{ personId: P.c, roles: ["direct_actor"] }] }, intent: "intended", mechanism: "ordinary", causesComplete: true },
      { eventId: E.argument, targets: [], responsibility: { completeness: "complete", assignments: [] }, intent: "not_applicable", mechanism: "ordinary", causesComplete: true },
    ],
    conclusions: [culprit, victim, ...innocents].map((n) => ({ id: co(n), claim: responsible(pid(n)) })),
    requiredConclusions: [{ conclusionId: co(culprit), value: true }, ...innocents.map((i) => ({ conclusionId: co(i), value: false }))],
  };
  const solutionHash = hashCaseSolution(parseCaseSolution(solution, parsedTruth));
  const bound = { caseId, truthHash };
  const challenge = { schemaVersion: 1, ...bound, solutionHash, allowedClaims: allPersons.map((p) => responsible(p.id)) };

  // ---------- Evidence access and presentation ----------
  const search = (locationId: string) => ({ kind: "discoverable", paths: [{ kind: "search_location", locationId }] });
  const access = {
    schemaVersion: 1,
    ...bound,
    entries: [
      ...(hasClue ? [{ evidenceId: EV.clue, access: search(L.scene) }] : []),
      { evidenceId: EV.fingerprint, access: { kind: "discoverable", paths: [{ kind: "examine_item", itemId: IT.weapon }] } },
      ...innocents.map((i) => ({ evidenceId: logOf(i.place), access: search(lid(i.place)) })),
      ...(kind === "timewindow" ? [{ evidenceId: EV.culpritLog, access: search(lid(culpritPlace)) }] : []),
      ...(kind === "twopaths" ? [{ evidenceId: EV.sleeve, access: { kind: "discoverable", paths: [{ kind: "examine_person", personId: P.c }] } }] : []),
    ],
  };
  const observation = { kind: "observation" };
  const logText = (p: Place, who: string, time: string, tail: string) => `${p.lead} steht ein Eintrag von ${who}: ${time} Uhr. ${tail}`;
  const presentationEntries: Json[] = [
    { evidenceId: EV.fingerprint, text: `Auf ${weapon.dat} ist ein Fingerabdruck von ${firstInnocent.name}. Wann er entstand, zeigt er nicht.`, mentions: [ref("person", pid(firstInnocent)), ref("item", IT.weapon)], reports: [] },
    ...innocents.map((i) => ({
      evidenceId: logOf(i.place),
      text: logText(i.place, i.name, clock, `Das war genau zur Tatzeit, ${i.name} ${i.place.doing}.`),
      mentions: [ref("person", pid(i)), ref("location", lid(i.place))],
      reports: [{ claim: personAt(pid(i), lid(i.place)), stance: "affirms", source: observation }],
    })),
  ];
  if (hasClue) {
    presentationEntries.unshift({
      evidenceId: EV.clue,
      text: `${scene.spot} liegt ${clue.what(C)}. Daneben: ${gen(V)} Blut, noch nicht getrocknet. ${clue.lost}${late ? ` Von ${C} war an diesem Abend bisher keine Rede.` : ""}`,
      mentions: [ref("person", P.c), ref("event", E.murder)],
      reports: [{ claim: participates(E.murder, P.c), stance: "affirms", source: observation }],
    });
  }
  if (kind === "twopaths") {
    presentationEntries.push({
      evidenceId: EV.sleeve,
      text: `An ${gen(C)} Ärmel sind feine, frische Blutspritzer. Der Schnelltest ordnet sie ${V} zu: ${C} stand dabei, als ${V} starb.`,
      mentions: [ref("person", P.c), ref("event", E.murder)],
      reports: [{ claim: participates(E.murder, P.c), stance: "affirms", source: observation }],
    });
  }
  if (kind === "timewindow") {
    presentationEntries.push({
      evidenceId: EV.culpritLog,
      text: logText(culpritPlace, C, clockOf(originHour, early), `Darunter, in derselben Schrift: „Gegangen ${clockOf(originHour, leave)} Uhr.“ Das war vor der Tat.`),
      mentions: [ref("person", P.c), ref("location", lid(culpritPlace))],
      reports: [{ claim: personAt(P.c, lid(culpritPlace), early), stance: "affirms", source: observation }],
    });
  }
  const presentation = { schemaVersion: 1, ...bound, entries: presentationEntries };
  const initial = {
    schemaVersion: 1,
    known: [
      ...allPersons.filter((p) => !(late && p.id === P.c)).map((p) => ref("person", p.id)),
      ref("location", L.scene),
      ...usedPlaces.map((p) => ref("location", lid(p))),
      ref("item", IT.weapon),
      ref("event", E.murder),
    ],
  };

  // ---------- Questions, profiles, NPC knowledge ----------
  const q = (s: string) => `question:${s}`;
  const Q = {
    present: (n: Name) => q(`${slug(n.name)}-present`),
    alibi: (n: Name) => q(`${slug(n.name)}-alibi`),
    scene: (n: Name) => q(`${slug(n.name)}-scene`),
    weapon: q("weapon"),
  };
  const questions = [
    { id: Q.present(culprit), mentions: [ref("person", P.c), ref("event", E.murder)] },
    { id: Q.weapon, mentions: [ref("event", E.murder), ref("item", IT.weapon)] },
    ...(kind === "timewindow" ? [{ id: Q.alibi(culprit), mentions: [ref("person", P.c), ref("location", lid(culpritPlace))] }] : []),
    ...innocents.flatMap((i) => [
      { id: Q.present(i), mentions: [ref("person", pid(i)), ref("event", E.murder)] },
      { id: Q.alibi(i), mentions: [ref("person", pid(i)), ref("location", lid(i.place))] },
      { id: Q.scene(i), mentions: [ref("person", pid(i)), ref("location", L.scene)] },
    ]),
  ];
  const catalogue = { schemaVersion: 1, ...bound, revision: 1, questions };
  const catalogueHash = hashQuestionCatalogue(parseQuestionCatalogue(catalogue, parsedTruth));

  const answer = (questionId: string, claim: unknown) => ({ questionId, act: "answer", claim, reveal: [] });
  const decline = (questionId: string) => ({ questionId, act: "decline" });
  const lie = (questionId: string, claim: unknown, stance: "affirms" | "denies") => ({ questionId, act: "lie", claim, stance, reveal: [] });
  const profileOf = (npcId: string, rules: unknown[], more: Json = {}) => ({ schemaVersion: 1, ...bound, catalogueHash, npcId, revision: 1, rules, ...more });
  const presenceLie = withLie && kind !== "timewindow";
  const alibiLie = withLie && kind === "timewindow";
  const culpritProfile = profileOf(
    P.c,
    [
      presenceLie ? lie(Q.present(culprit), participates(E.murder, P.c), "denies") : decline(Q.present(culprit)),
      decline(Q.weapon),
      ...(kind === "timewindow" ? [alibiLie ? lie(Q.alibi(culprit), personAt(P.c, lid(culpritPlace)), "affirms") : decline(Q.alibi(culprit))] : []),
      ...innocents.map((i) => answer(Q.present(i), participates(E.murder, pid(i)))),
    ],
    presenceLie
      ? { confrontations: [{ questionId: Q.present(culprit), evidenceId: EV.clue, claim: participates(E.murder, P.c), reveal: [] }] }
      : alibiLie
        ? { confrontations: [{ questionId: Q.alibi(culprit), evidenceId: EV.culpritLog, claim: personAt(P.c, lid(culpritPlace)), reveal: [] }] }
        : {},
  );
  const innocentProfile = (i: (typeof innocents)[number]) =>
    profileOf(pid(i), [
      ...(late ? [] : [answer(Q.present(culprit), participates(E.murder, P.c))]),
      answer(Q.present(i), participates(E.murder, pid(i))),
      answer(Q.alibi(i), personAt(pid(i), lid(i.place))),
      answer(Q.scene(i), personAt(pid(i), L.scene)),
    ]);

  const aware = (k: string, id: string) => ({ subject: ref(k, id), acquiredAt: 0, provenance: { kind: "prior_knowledge" } });
  const attitude = (id: string, stance: unknown, acquiredAt: number, provenance: unknown) => ({ subject: ref("proposition", id), stance, acquiredAt, provenance });
  const knows = (value: boolean) => ({ kind: "knowledge", value });
  const witnessed = (eventId: string) => ({ kind: "witnessed_event", eventId });
  const placeAwareness = [aware("location", L.scene), ...usedPlaces.map((p) => aware("location", lid(p)))];
  const snapshot = (npcId: string, awareness: unknown[], attitudes: unknown[]) => ({ schemaVersion: 1, ...bound, solutionHash, npcId, revision: 1, asOf: 3600, awareness, attitudes });
  const culpritNpc = snapshot(
    P.c,
    [...allPersons.map((p) => aware("person", p.id)), ...placeAwareness, aware("item", IT.weapon), aware("event", E.argument), aware("event", E.murder)],
    [
      attitude(propPresent(culprit), knows(true), at, witnessed(E.murder)),
      attitude(PR.cAtArgument, knows(true), at - 301, witnessed(E.argument)),
      attitude(PR.weaponUsed, knows(true), at, witnessed(E.murder)),
      ...innocents.map((i) => attitude(propPresent(i), knows(false), at, witnessed(E.murder))),
      ...(kind === "timewindow" ? [attitude(PR.cAlibi, knows(false), at, witnessed(E.murder))] : []),
    ],
  );
  const innocentNpc = (i: (typeof innocents)[number]) =>
    snapshot(
      pid(i),
      [...allPersons.filter((p) => !(late && p.id === P.c)).map((p) => aware("person", p.id)), ...placeAwareness, aware("event", E.argument), aware("event", alibiEvent(i))],
      [
        attitude(propAlibi(i), knows(true), at, witnessed(alibiEvent(i))),
        attitude(propScene(i), knows(false), at, witnessed(alibiEvent(i))),
        attitude(propPresent(i), knows(false), at, witnessed(alibiEvent(i))),
        ...(late ? [] : [attitude(propPresent(culprit), { kind: "uncertain", leaning: true }, at + 100, { kind: "author_modeled_inference" })]),
      ],
    );

  // ---------- Public content ----------
  const label = (k: string, id: string, text: string, role: string | null = null) => ({ entity: ref(k, id), label: text, role });
  const roleOf = (n: Name, r: readonly [string, string]) => (n.f ? r[0] : r[1]);
  const named = suspects.filter((s) => !(late && s === C));
  const searchable = [scene.acc, ...usedPlaces.map((p) => p.acc)];
  const questionTexts = [
    { npc: P.c, questionId: Q.present(culprit), text: `Waren Sie bei ${deathOf} dabei?` },
    { npc: P.c, questionId: Q.weapon, text: `Wurde ${V} mit ${weapon.dat} getötet?` },
    ...(kind === "timewindow" ? [{ npc: P.c, questionId: Q.alibi(culprit), text: `Waren Sie um ${clock} ${culpritPlace.in}?` }] : []),
    ...innocents.flatMap((i) => [
      { npc: P.c, questionId: Q.present(i), text: `War ${i.name} bei ${deathOf} dabei?` },
      ...(late ? [] : [{ npc: pid(i), questionId: Q.present(culprit), text: `War ${C} bei ${deathOf} dabei?` }]),
      { npc: pid(i), questionId: Q.present(i), text: `Waren Sie bei ${deathOf} dabei?` },
      { npc: pid(i), questionId: Q.alibi(i), text: `Waren Sie um ${clock} ${i.place.in}?` },
      { npc: pid(i), questionId: Q.scene(i), text: `Waren Sie um ${clock} ${scene.in}?` },
    ]),
  ];
  const schemaTail: Record<CaseSchema, string> = {
    classic: presenceLie ? ` Erst ${clue.the} am Tatort brachte die Wahrheit ans Licht.` : "",
    crowd: ` Unter so vielen Verdächtigen verriet erst ${clue.the} am Tatort, wer dabei gewesen war.`,
    timewindow: ` ${C} war zwar ${culpritPlace.in} gewesen, ging aber schon um ${clockOf(originHour, leave)} wieder, rechtzeitig für die Tat.${alibiLie ? " Das angebliche Alibi hielt dem Eintrag nicht stand." : ""}`,
    latecomer: ` Niemand hatte ${C} an diesem Abend erwartet, erst ${clue.the} am Tatort verriet die Anwesenheit.`,
    twopaths: ` ${clue.label} am Tatort und Blutspritzer am Ärmel erzählten dieselbe Geschichte.`,
  };
  const publicContent = {
    schemaVersion: 1,
    title: truth.title,
    brief: [
      `${setting.occasion}. Gegen ${clock} Uhr wird ${V} ${scene.in} tot aufgefunden, getötet mit ${weapon.dat} ${weapon.from}. Außer ${V} waren zur Tatzeit nur ${list(named)} in der Nähe${late ? ", so heißt es jedenfalls" : ""}.`,
      `Dein Auftrag: Finde heraus, wer für ${deathOf} verantwortlich ist. Durchsuche ${list(searchable)}, untersuche, was du findest, und befrage ${list(named)}. ${
        kind === "timewindow" ? "Achte genau auf die Uhrzeiten. " : ""
      }Nicht jede Spur führt zum Täter${withLie ? ", nicht jede Aussage ist wahr," : ","} und eine Gesprächsverweigerung ist kein Geständnis.`,
    ].join("\n\n"),
    challengeQuestion: `Wer ist für ${deathOf} verantwortlich?`,
    labels: [
      label("person", P.c, C, late ? roleOf(culprit, latecomerRole) : roleOf(culprit, roles[0]!)),
      label("person", P.v, V, `${roleOf(victim, victimRole)}, das Opfer`),
      ...innocents.map((i) => label("person", pid(i), i.name, roleOf(i, i.role))),
      label("location", L.scene, scene.name),
      ...usedPlaces.map((p) => label("location", lid(p), p.name)),
      label("item", IT.weapon, weapon.name),
      label("event", E.murder, `${deathOf} um ${clock}`),
      label("event", E.argument, motive.argument),
      ...innocents.map((i) => label("event", alibiEvent(i), `${gen(i.name)} Zeit ${i.place.in}`)),
      ...(hasClue ? [label("evidence", EV.clue, clue.label)] : []),
      label("evidence", EV.fingerprint, "Fingerabdruck"),
      ...innocents.map((i) => label("evidence", logOf(i.place), i.place.log)),
      ...(kind === "timewindow" ? [label("evidence", EV.culpritLog, culpritPlace.log)] : []),
      ...(kind === "twopaths" ? [label("evidence", EV.sleeve, "Blutspritzer am Ärmel")] : []),
    ].sort((a, b) => (a.entity.kind + a.entity.id < b.entity.kind + b.entity.id ? -1 : 1)),
    questionTexts,
    publicRules: [
      { id: "rule:certified-sources", text: "Was ein Fundstück selbst zeigt, gilt als Tatsache. Aussagen von Personen können irren." },
      { id: "rule:alibi", text: `Wer um ${clock} nachweislich nicht ${scene.in} war, war an ${deathOf} nicht beteiligt und ist nicht verantwortlich.` },
      { id: "rule:participation", text: `Außer ${V} war genau eine der verdächtigen Personen bei ${deathOf} dabei, und wer dabei war, ist verantwortlich.` },
    ],
    epilogue: [
      `${C} ${withLie ? "gibt die Lüge auf" : "bricht das Schweigen"}. ${motive.epilogue(C, V)}, und am Abend kam es ${scene.in} zum ${motive.argument}. Um ${clock} griff ${C} nach ${weapon.dat}.${schemaTail[kind]}`,
      `${list(innocents.map((i) => i.name))} ${innocents.length === 1 ? "hatte" : "hatten"} mit ${deathOf} nichts zu tun: ${list(innocents.map((i) => `${i.name} ${i.place.did}`))}. Der Fingerabdruck auf ${weapon.dat} war eine falsche Spur, er sagt nichts darüber, wann er entstand.`,
    ].join("\n\n"),
  };

  // ---------- Proof: release manifest and proof profile ----------
  const playerRef = (k: string, id: string) => ({ $playerRefOf: { kind: k, id } });
  const playerPresent = { kind: "eventHasParticipant", event: playerRef("event", E.murder), person: playerRef("person", P.c) };
  const playerAt = (personId: string, locationId: string, time = at) => ({ kind: "personAt", person: playerRef("person", personId), location: playerRef("location", locationId), at: time });
  const literal = (propositionId: string, value: boolean) => ({ kind: "proposition", propositionId, value });
  const conclusion = (conclusionId: string, value: boolean) => ({ kind: "conclusion", conclusionId, value });
  const certified = (claim: unknown) => [{ report: { claim, stance: "affirms", source: observation }, licenseRuleId: "rule:certified-sources" }];

  type Entry = { o: Json; select: Json };
  const entries: Entry[] = [];
  const nodes: Json[] = [];
  const edges: Json[] = [];
  const steps: Json[] = [];
  const observationNode = (id: string, observationId: string) => nodes.push({ id, kind: "observation", observationId });
  const searchStep = (p: { slug: string }, locationId: string) => ({ stepId: `search-${p.slug}`, event: { type: "investigate", action: "search_location", target: playerRef("location", locationId) } });
  if (hasClue) steps.push(searchStep(scene, L.scene));

  // Each innocent: the log at their place clears them.
  innocents.forEach((i) => {
    const s = slug(i.name);
    steps.push(searchStep(i.place, lid(i.place)));
    entries.push({ o: { id: `observed:alibi-${s}`, kind: "OBSERVED", literal: literal(propAlibi(i), true), source: { kind: "evidence", evidenceId: logOf(i.place) } }, select: { alternatives: certified(playerAt(pid(i), lid(i.place))) } });
    observationNode(`observation:alibi-${s}`, `observed:alibi-${s}`);
    nodes.push({ id: `literal:${s}`, kind: "literal", literal: conclusion(co(i), false) });
    edges.push({ id: `alibi:${s}`, allOf: [`observation:alibi-${s}`, "license:alibi"], to: `literal:${s}`, license: "license:alibi" });
  });
  entries.push({
    o: { id: "public-rule:alibi", kind: "PUBLIC_RULE", rules: innocents.map((i) => ({ edgeId: `alibi:${slug(i.name)}`, allOf: [`observation:alibi-${slug(i.name)}`], yields: conclusion(co(i), false) })) },
    select: { ruleId: "rule:alibi", afterObservations: innocents.map((i) => `observed:alibi-${slug(i.name)}`) },
  });
  observationNode("license:alibi", "public-rule:alibi");
  nodes.push({ id: "literal:culprit", kind: "literal", literal: conclusion(co(culprit), true) });

  // The culprit: placed at the deed by a clue (one or two paths) or by elimination.
  const participation = (id: string, edgeId: string, allOf: string[], after: string[]) => {
    entries.push({ o: { id, kind: "PUBLIC_RULE", rules: [{ edgeId, allOf, yields: conclusion(co(culprit), true) }] }, select: { ruleId: "rule:participation", afterObservations: after } });
    const license = `license:${id.replace(/^public-rule:/, "")}`;
    observationNode(license, id);
    edges.push({ id: edgeId, allOf: [...allOf, license], to: "literal:culprit", license });
  };
  if (hasClue) {
    entries.push({ o: { id: "observed:clue", kind: "OBSERVED", literal: literal(propPresent(culprit), true), source: { kind: "evidence", evidenceId: EV.clue } }, select: { alternatives: certified(playerPresent) } });
    observationNode("observation:clue", "observed:clue");
    participation("public-rule:participation", "responsible:clue", ["observation:clue"], ["observed:clue"]);
  }
  if (kind === "twopaths") {
    steps.push({ stepId: "examine-culprit", event: { type: "investigate", action: "examine_person", target: playerRef("person", P.c) } });
    entries.push({ o: { id: "observed:sleeve", kind: "OBSERVED", literal: literal(propPresent(culprit), true), source: { kind: "evidence", evidenceId: EV.sleeve } }, select: { alternatives: certified(playerPresent) } });
    observationNode("observation:sleeve", "observed:sleeve");
    participation("public-rule:participation-sleeve", "responsible:sleeve", ["observation:sleeve"], ["observed:sleeve"]);
  }
  if (kind === "timewindow") {
    participation("public-rule:participation", "responsible:elimination", innocents.map((i) => `observation:alibi-${slug(i.name)}`), innocents.map((i) => `observed:alibi-${slug(i.name)}`));
    steps.push(searchStep(culpritPlace, lid(culpritPlace)));
  }

  // The lie and its confrontation: released by the witness, never a premise.
  if (presenceLie || alibiLie) {
    const questionId = presenceLie ? Q.present(culprit) : Q.alibi(culprit);
    const claim = presenceLie ? playerPresent : playerAt(P.c, lid(culpritPlace));
    const prop = presenceLie ? propPresent(culprit) : PR.cAlibi;
    const lied = presenceLie ? "denies" : "affirms";
    const admitted = presenceLie ? "affirms" : "denies";
    const evidenceId = presenceLie ? EV.clue : EV.culpritLog;
    steps.push({ stepId: "ask-culprit", event: { type: "interrogate", npc: playerRef("person", P.c), questionId } });
    steps.push({ stepId: "confront-culprit", event: { type: "confront", npc: playerRef("person", P.c), questionId, evidence: playerRef("evidence", evidenceId) } });
    entries.unshift(
      { o: { id: "reported:culprit-lies", kind: "REPORTED_BY_NPC", npcId: P.c, literal: literal(prop, lied === "affirms") }, select: { alternatives: [{ kind: "npc", questionId, claim, stance: lied }] } },
      { o: { id: "reported:culprit-admits", kind: "REPORTED_BY_NPC", npcId: P.c, literal: literal(prop, admitted === "affirms") }, select: { alternatives: [{ kind: "admission", questionId, evidenceId, claim, stance: admitted }] } },
    );
  }

  const releaseManifest = {
    schemaVersion: 1,
    releaseContextHash: PLACEHOLDER,
    adapterVersion: "forge-release-proof-v1",
    certificateData: { schemaVersion: 1, steps, observations: entries.map((e) => ({ ...e.o, ...e.select })) },
  };
  const proofProfile = {
    schemaVersion: 1,
    bindings: { caseId, truthHash, solutionHash, releaseHash: PLACEHOLDER },
    answerScope: [co(culprit), ...innocents.map((i) => co(i))],
    ambiguityPolicy: "must_disambiguate",
    question: { kind: "required_literals" },
    observations: entries.map((e) => e.o),
    nodes,
    edges,
    witnessStepIds: steps.map((s) => s.stepId),
  };

  const files: Record<string, unknown> = {
    "case.json": { refSalt: /^0+$/.test(salt) ? "1".padStart(32, "0") : salt, clockOrigin: originHour * 3600, seed, schema: kind },
    "truth.json": truth,
    "solution.json": solution,
    "challenge.json": challenge,
    "evidence-access.json": access,
    "evidence-presentation.json": presentation,
    "initial-setup.json": initial,
    "questions.json": catalogue,
    [`interrogation-${slug(C)}.json`]: culpritProfile,
    [`npc-${slug(C)}.json`]: culpritNpc,
    "public-content.json": publicContent,
    "release-manifest.json": releaseManifest,
    "proof-profile.json": proofProfile,
  };
  for (const i of innocents) {
    files[`interrogation-${slug(i.name)}.json`] = innocentProfile(i);
    files[`npc-${slug(i.name)}.json`] = innocentNpc(i);
  }
  return { seed, schema: kind, title: truth.title, withLie: presenceLie || alibiLie, files };
}

/**
 * Writes the generated case into dir (created if missing); returns the written file names. A folder
 * that already holds files is refused unless forced: check-case reads every npc-* and interrogation-*
 * file, so leftovers of another case would break it, and hand-written files would be overwritten.
 * Forcing removes the old NPC files first.
 */
export function writeGeneratedCase(generated: GeneratedCase, dir: string, options: { force?: boolean } = {}): string[] {
  mkdirSync(dir, { recursive: true });
  const existing = readdirSync(dir);
  if (existing.length > 0 && options.force !== true) throw new Error(`Ordner ${dir} ist nicht leer (--force überschreibt)`);
  for (const name of existing) if (/^(npc|interrogation)-.*\.json$/.test(name)) rmSync(join(dir, name));
  const names = Object.keys(generated.files).sort();
  for (const name of names) writeFileSync(join(dir, name), `${JSON.stringify(generated.files[name], null, 2)}\n`);
  return names;
}

/**
 * The playable package of a generated case under ruleset v3, with its proof bound like the
 * built-in cases (so hints work).
 */
export function generatedPackage(generated: GeneratedCase): ResolvedCasePackage {
  const f = generated.files;
  const config = f["case.json"] as { refSalt: string };
  const npcs = Object.keys(f)
    .filter((name) => name.startsWith("npc-"))
    .sort()
    .map((name) => ({ snapshot: f[name], profile: f[name.replace(/^npc-/, "interrogation-")] }));
  const input = {
    schemaVersion: 1,
    rulesetVersion: "mystery-session-v3" as const,
    truth: f["truth.json"],
    solution: f["solution.json"],
    access: f["evidence-access.json"],
    presentation: f["evidence-presentation.json"],
    catalogue: f["questions.json"],
    npcs,
    initial: f["initial-setup.json"],
    challenge: f["challenge.json"],
    publicContent: f["public-content.json"],
    proof: null as null | { profile: unknown; releaseManifest: string },
  };
  input.proof = bindCaseProof(input, f["release-manifest.json"], f["proof-profile.json"], config.refSalt);
  const resolved = resolveCasePackage(input, refSource(f["truth.json"], config.refSalt));
  if (!resolved.ok) throw new Error(`generated case ${generated.seed} does not resolve: ${JSON.stringify(resolved.findings)}`);
  return resolved.package;
}

/** Display convention of a generated case: wall-clock seconds of timeline second 0. */
export const generatedClockOrigin = (generated: GeneratedCase): number => (generated.files["case.json"] as { clockOrigin: number }).clockOrigin;
