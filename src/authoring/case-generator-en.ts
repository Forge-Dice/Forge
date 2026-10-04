// English building blocks of the case generator, index for index parallel to the German ones in
// case-generator.ts: the seed draws German blocks, and the English variant (en/public-content.json,
// en/evidence-presentation.json) takes the block at the same index. Only player text differs.

type Pair = readonly [female: string, male: string];

export const EN_ROLES: readonly Pair[] = [
  ["niece of the house", "nephew of the house"],
  ["business partner", "business partner"],
  ["family doctor", "family doctor"],
  ["neighbour", "neighbour"],
  ["cousin", "cousin"],
  ["secretary", "secretary"],
  ["childhood friend", "childhood friend"],
  ["publisher", "publisher"],
  ["lawyer", "lawyer"],
  ["sister-in-law", "brother-in-law"],
  ["painter", "painter"],
  ["stepdaughter", "stepson"],
  ["bookkeeper", "bookkeeper"],
];
export const EN_VICTIM_ROLES: readonly Pair[] = [
  ["the hostess", "the host"],
  ["the lady of the house", "the master of the house"],
  ["the heiress of the house", "the heir of the house"],
  ["the patron", "the patron"],
  ["the director", "the director"],
  ["the guest of honour", "the guest of honour"],
];
export const EN_LATECOMER_ROLES: readonly Pair[] = [
  ["a stranger", "a stranger"],
  ["an uninvited visitor", "an uninvited visitor"],
];

export type EnPlace = { readonly name: string; readonly in: string; readonly doing: string; readonly did: string; readonly log: string; readonly lead: string };
const pl = (name: string, inn: string, doing: string, did: string, log: string, lead: string): EnPlace => ({ name, in: inn, doing, did, log, lead });
export type EnSetting = { readonly occasion: string; readonly where: string; readonly scene: { readonly name: string; readonly in: string; readonly spot: string }; readonly places: readonly EnPlace[] };

export const EN_SETTINGS: readonly EnSetting[] = [
  {
    occasion: "A dinner at the country house",
    where: "at the Country House",
    scene: { name: "Library", in: "in the library", spot: "Next to the desk" },
    places: [
      pl("Garden", "in the garden", "is working in the garden", "was working in the garden", "Garden book", "In the garden book"),
      pl("Greenhouse", "in the greenhouse", "is watering in the greenhouse", "was watering in the greenhouse", "Watering log", "In the greenhouse watering log"),
      pl("Music room", "in the music room", "is playing the piano in the music room", "was playing the piano in the music room", "Music book", "In the music book on the piano"),
      pl("Kitchen", "in the kitchen", "is cooking in the kitchen", "was cooking in the kitchen", "Kitchen list", "On the kitchen list by the stove"),
      pl("Stables", "in the stables", "is tending the horses in the stables", "was tending the horses in the stables", "Stable book", "In the stable book"),
    ],
  },
  {
    occasion: "A premiere party at the city theatre",
    where: "at the Theatre",
    scene: { name: "Dressing room", in: "in the dressing room", spot: "Under the make-up table" },
    places: [
      pl("Stage", "on the stage", "is rehearsing on the stage", "was rehearsing on the stage", "Rehearsal log", "In the stage manager's rehearsal log"),
      pl("Lighting bridge", "on the lighting bridge", "is setting up spotlights on the lighting bridge", "was setting up spotlights on the lighting bridge", "Lighting desk log", "In the lighting desk log"),
      pl("Foyer", "in the foyer", "is serving at the foyer bar", "was serving at the foyer bar", "Foyer bar ledger", "In the foyer bar ledger"),
      pl("Workshop", "in the workshop", "is building scenery in the workshop", "was building scenery in the workshop", "Workshop book", "In the workshop book"),
      pl("Box office", "at the box office", "is counting the takings at the box office", "was counting the takings at the box office", "Box office statement", "In the box office statement"),
    ],
  },
  {
    occasion: "A wine tasting at the vineyard",
    where: "at the Vineyard",
    scene: { name: "Wine cellar", in: "in the wine cellar", spot: "Between the barrels" },
    places: [
      pl("Vineyard slope", "on the vineyard slope", "is pruning vines on the slope", "was pruning vines on the slope", "Harvest book", "In the harvest book of the slope"),
      pl("Press house", "in the press house", "is working the press in the press house", "was working the press in the press house", "Press log", "In the press log"),
      pl("Tasting room", "in the tasting room", "is pouring wine in the tasting room", "was pouring wine in the tasting room", "Tasting room ledger", "In the tasting room ledger"),
      pl("Barn", "in the barn", "is repairing the tractor in the barn", "was repairing the tractor in the barn", "Tool list", "On the tool list in the barn"),
      pl("Bottling hall", "in the bottling hall", "is labelling bottles in the bottling hall", "was labelling bottles in the bottling hall", "Bottling log", "In the bottling log"),
    ],
  },
  {
    occasion: "An anniversary evening at the spa hotel",
    where: "at the Spa Hotel",
    scene: { name: "Suite", in: "in the suite", spot: "Next to the writing desk" },
    places: [
      pl("Swimming pool", "at the pool", "is swimming in the hotel pool", "was swimming in the hotel pool", "Access log", "In the pool access log"),
      pl("Sauna", "in the sauna", "is sitting in the sauna", "was sitting in the sauna", "Sauna book", "In the sauna book"),
      pl("Lobby", "in the lobby", "is on the phone in the lobby", "was on the phone in the lobby", "Reception book", "In the reception book"),
      pl("Restaurant", "in the restaurant", "is dining in the restaurant", "was dining in the restaurant", "Restaurant till", "In the restaurant till journal"),
      pl("Gym", "in the gym", "is training in the gym", "was training in the gym", "Training list", "On the training list in the gym"),
    ],
  },
  {
    occasion: "A stargazing night at the old observatory",
    where: "at the Observatory",
    scene: { name: "Study", in: "in the study", spot: "In front of the map cabinet" },
    places: [
      pl("Dome", "in the dome", "is watching the sky in the dome", "was watching the sky in the dome", "Observation log", "In the telescope's observation log"),
      pl("Plate archive", "in the plate archive", "is sorting photographic plates in the archive", "was sorting photographic plates in the archive", "Lending book", "In the archive's lending book"),
      pl("Terrace", "on the terrace", "is measuring the wind on the terrace", "was measuring the wind on the terrace", "Weather book", "In the weather book on the terrace"),
      pl("Lecture hall", "in the lecture hall", "is giving a talk in the lecture hall", "was giving a talk in the lecture hall", "Lecture list", "On the lecture list in the hall"),
      pl("Darkroom", "in the darkroom", "is developing plates in the darkroom", "was developing plates in the darkroom", "Developing book", "In the darkroom's developing book"),
    ],
  },
  {
    occasion: "A summer party at the sailing club",
    where: "at the Sailing Club",
    scene: { name: "Club room", in: "in the club room", spot: "Under the chart table" },
    places: [
      pl("Jetty", "on the jetty", "is mooring boats on the jetty", "was mooring boats on the jetty", "Harbour book", "In the harbour book"),
      pl("Boat workshop", "in the boat workshop", "is varnishing a boat in the workshop", "was varnishing a boat in the workshop", "Boat workshop book", "In the boat workshop book"),
      pl("Regatta tower", "in the regatta tower", "is counting boats from the regatta tower", "was counting boats from the regatta tower", "Regatta log", "In the regatta log"),
      pl("Club bar", "at the club bar", "is mixing drinks at the club bar", "was mixing drinks at the club bar", "Club bar receipts", "In the club bar receipt book"),
      pl("Sail loft", "in the sail loft", "is mending sails in the sail loft", "was mending sails in the sail loft", "Repair list", "On the repair list in the sail loft"),
    ],
  },
  {
    occasion: "An evening auction at the auction house",
    where: "at the Auction House",
    scene: { name: "Vault", in: "in the vault", spot: "In front of the open safe" },
    places: [
      pl("Saleroom", "in the saleroom", "is keeping the bidder list in the saleroom", "was keeping the bidder list in the saleroom", "Bidder list", "On the bidder list in the saleroom"),
      pl("Restoration studio", "in the restoration studio", "is retouching a painting in the studio", "was retouching a painting in the studio", "Restoration book", "In the restoration work book"),
      pl("Catalogue office", "in the catalogue office", "is typing lot descriptions in the catalogue office", "was typing lot descriptions in the catalogue office", "Post book", "In the catalogue office's post book"),
      pl("Loading bay", "at the loading bay", "is loading crates at the bay", "was loading crates at the bay", "Freight list", "On the freight list at the bay"),
      pl("Café", "in the café", "is serving coffee in the café", "was serving coffee in the café", "Café receipts", "In the café receipt book"),
    ],
  },
  {
    occasion: "An autumn ball at the manor farm",
    where: "at the Manor Farm",
    scene: { name: "Hunting room", in: "in the hunting room", spot: "Under the gun cabinet" },
    places: [
      pl("Ballroom", "in the ballroom", "is dancing in the ballroom", "was dancing in the ballroom", "Dance card", "On the ballroom dance card"),
      pl("Dairy", "in the dairy", "is churning butter in the dairy", "was churning butter in the dairy", "Milk book", "In the dairy's milk book"),
      pl("Orchard", "in the orchard", "is picking apples in the orchard", "was picking apples in the orchard", "Harvest book", "In the orchard harvest book"),
      pl("Smithy", "in the smithy", "is shoeing a horse in the smithy", "was shoeing a horse in the smithy", "Shoeing book", "In the smithy's shoeing book"),
      pl("Chapel", "in the chapel", "is playing the organ in the chapel", "was playing the organ in the chapel", "Organ book", "In the chapel's organ book"),
    ],
  },
  {
    occasion: "A gala performance at the circus",
    where: "at the Circus",
    scene: { name: "Director's wagon", in: "in the director's wagon", spot: "Next to the cash box" },
    places: [
      pl("Ring", "in the ring", "is rehearsing in the ring", "was rehearsing in the ring", "Ring rehearsal book", "In the ring rehearsal book"),
      pl("Animal tent", "in the animal tent", "is feeding the horses in the animal tent", "was feeding the horses in the animal tent", "Feeding plan", "On the feeding plan in the animal tent"),
      pl("Ticket wagon", "in the ticket wagon", "is selling tickets in the ticket wagon", "was selling tickets in the ticket wagon", "Ticket book", "In the ticket wagon's book"),
      pl("Costume wagon", "in the costume wagon", "is sewing on sequins in the costume wagon", "was sewing on sequins in the costume wagon", "Sewing list", "On the sewing list in the costume wagon"),
      pl("Canteen", "in the canteen", "is cooking soup in the canteen", "was cooking soup in the canteen", "Canteen book", "In the canteen book"),
    ],
  },
  {
    occasion: "A gala evening at the city museum",
    where: "at the Museum",
    scene: { name: "Storage depot", in: "in the storage depot", spot: "Between the shelves" },
    places: [
      pl("Exhibition hall", "in the exhibition hall", "is guiding visitors through the exhibition hall", "was guiding visitors through the exhibition hall", "Tour list", "On the tour list in the exhibition hall"),
      pl("Laboratory", "in the laboratory", "is testing a paint sample in the laboratory", "was testing a paint sample in the laboratory", "Lab journal", "In the lab journal"),
      pl("Museum shop", "in the museum shop", "is working the till in the museum shop", "was working the till in the museum shop", "Shop till", "On the museum shop's till roll"),
      pl("Porter's lodge", "in the porter's lodge", "is keeping watch in the porter's lodge", "was keeping watch in the porter's lodge", "Watch book", "In the porter's lodge watch book"),
      pl("Director's office", "in the director's office", "is on the phone in the director's office", "was on the phone in the director's office", "Call list", "On the call list in the director's office"),
    ],
  },
];

export const EN_WEAPONS: readonly { readonly name: string; readonly the: string; readonly from: string }[] = [
  { name: "Letter opener", the: "the letter opener", from: "made of silver" },
  { name: "Candlestick", the: "the candlestick", from: "made of brass" },
  { name: "Poker", the: "the poker", from: "of wrought iron" },
  { name: "Paperweight", the: "the paperweight", from: "made of glass" },
  { name: "Bronze figure", the: "the bronze figure", from: "from the shelf" },
  { name: "Walking stick", the: "the walking stick", from: "with a silver knob" },
  { name: "Wine bottle", the: "the wine bottle", from: "from the buffet" },
  { name: "Hammer", the: "the hammer", from: "from the toolbox" },
  { name: "Marble bust", the: "the marble bust", from: "from the mantelpiece" },
  { name: "Trophy", the: "the trophy", from: "from the display case" },
];

export const EN_CLUES: readonly { readonly label: string; readonly the: string; readonly what: (c: string) => string; readonly lost: string }[] = [
  { label: "Cufflink", the: "the cufflink", what: (c) => `a torn-off cufflink from ${enGen(c)} shirt`, lost: "The button tore off during the deed." },
  { label: "Earring", the: "the earring", what: (c) => `${enGen(c)} earring, its clasp bent`, lost: "The earring fell off during the deed." },
  { label: "Reading glasses", the: "the reading glasses", what: (c) => `${enGen(c)} reading glasses, one lens cracked`, lost: "The glasses fell to the floor during the deed." },
  { label: "Key ring", the: "the key ring", what: (c) => `${enGen(c)} key ring with the name tag`, lost: "The keys slipped out of a pocket during the deed." },
  { label: "Watch strap", the: "the watch strap", what: (c) => `the torn strap of ${enGen(c)} watch`, lost: "The strap snapped during the deed." },
  { label: "Glove", the: "the glove", what: (c) => `${enGen(c)} leather glove, torn at one finger`, lost: "The glove was left behind during the deed." },
  { label: "Brooch", the: "the brooch", what: (c) => `${enGen(c)} brooch, the pin broken off`, lost: "The brooch came loose during the deed." },
  { label: "Fountain pen", the: "the fountain pen", what: (c) => `${enGen(c)} fountain pen with engraved initials`, lost: "The pen slipped from a breast pocket during the deed." },
];

export const EN_MOTIVES: readonly { readonly argument: string; readonly epilogue: (c: string, v: string) => string }[] = [
  { argument: "Quarrel over money", epilogue: (c, v) => `${c} owed ${v} money that could never be paid back` },
  { argument: "Quarrel over the will", epilogue: (c, v) => `${v} meant to cut ${c} out of the will` },
  { argument: "Quarrel over an old letter", epilogue: (c, v) => `${v} had been blackmailing ${c} for months with an old letter` },
  { argument: "Quarrel over a love affair", epilogue: (c, v) => `${c} blamed ${v} for a broken love affair` },
  { argument: "Quarrel over selling the company", epilogue: (c, v) => `${v} meant to sell the shared company behind ${enGen(c)} back` },
  { argument: "Quarrel over an old humiliation", epilogue: (c, v) => `${v} had humiliated ${c} in public years ago, and ${c} had never forgotten` },
  { argument: "Quarrel over a stolen work", epilogue: (c, v) => `${v} had passed off ${enGen(c)} work as their own and reaped the fame` },
  { argument: "Quarrel over a guarded secret", epilogue: (c, v) => `${v} had threatened to make one of ${enGen(c)} secrets public` },
];

export const EN_WEATHER: readonly { readonly brief: string; readonly close: string }[] = [
  { brief: "Outside, rain drums against the windows.", close: "Outside, the rain had finally stopped." },
  { brief: "A thunderstorm rolls across the land, and the lights flicker with every flash.", close: "The storm had long since moved on." },
  { brief: "Thick fog lies over everything; you can barely see ten steps.", close: "The fog had lifted." },
  { brief: "It is a sultry summer evening, and every window stands open.", close: "At last, cooler air came through the open windows." },
  { brief: "Snow has been falling since the afternoon, and the drive is long since snowed in.", close: "Outside, it was still snowing." },
  { brief: "A cold wind whistles through every crack.", close: "The wind had died down." },
  { brief: "The full moon hangs bright over the evening, still and clear.", close: "The moon had vanished behind the roofs." },
];

export const EN_SIDE_ROLES: readonly Pair[] = [
  ["waitress", "waiter"],
  ["driver", "driver"],
  ["photographer", "photographer"],
  ["night watchwoman", "night watchman"],
  ["porter", "porter"],
  ["housekeeper", "house servant"],
];

export const EN_PERSONALITIES: readonly { readonly trait: string; readonly confess: (c: string) => string; readonly lines: Readonly<Record<string, readonly string[]>> }[] = [
  {
    trait: "says only what is necessary.",
    confess: (c) => `In the end, ${c} says a single sentence: "It was me."`,
    lines: { affirms: ["Yes.", "Yes. So?"], denies: ["No.", "No. Next."], leans_affirms: ["Probably."], leans_denies: ["Hardly."], uncertain: ["Not sure."], does_not_know: ["No idea."], decline: ["No comment.", "Nothing on that."], stands_by: ["I stand by it."], gives_in: ["Fine."] },
  },
  {
    trait: "likes to beat around the bush.",
    confess: (c) => `${c} squirms for a long time, looks for excuses and then gives up after all.`,
    lines: {
      affirms: ["Well, if you put it that way: yes.", "By and large, I would say yes."],
      denies: ["What makes you think that? No.", "No, not really, no."],
      leans_affirms: ["Could be, I didn't pay much attention."],
      leans_denies: ["I don't think so, but I wouldn't want to commit myself."],
      uncertain: ["Hard to say, really."],
      does_not_know: ["I'm afraid I can't help you there."],
      decline: ["Do I have to answer that?", "That's beside the point."],
      stands_by: ["I've told you what I know. Nothing more."],
      gives_in: ["All right, you won't let go, will you."],
    },
  },
  {
    trait: "tells stories at great length.",
    confess: (c) => `Then it bursts out of ${c}, a whole torrent of words, as if it had only been waiting for this moment.`,
    lines: {
      affirms: ["Yes, of course! I told half the party earlier.", "Oh yes! Just ask the others, they were there too."],
      denies: ["No, certainly not! I remember exactly how the evening went.", "No, no, no. Whatever gave you that idea?"],
      leans_affirms: ["I think so, yes, from what I heard from over there."],
      leans_denies: ["Hm, probably not. But a lot gets mixed up on an evening like this."],
      uncertain: ["Oh, if only I knew! I was busy with my own things."],
      does_not_know: ["I really don't know, I'm so sorry."],
      decline: ["Oh, I'd rather not talk about that, really not.", "Oh, that's a long story, it doesn't belong here."],
      stands_by: ["I'm telling you, that's how it was! That thing proves nothing."],
      gives_in: ["Oh dear, all right, I'll tell you."],
    },
  },
  {
    trait: "is very particular about form and manners.",
    confess: (c) => `${c} sits up straight, lays both hands on the table and makes a formal confession.`,
    lines: {
      affirms: ["That is correct.", "Indeed, that is the case."],
      denies: ["That is not the case.", "By no means."],
      leans_affirms: ["I presume so."],
      leans_denies: ["I consider that unlikely."],
      uncertain: ["I am unable to say."],
      does_not_know: ["Nothing of the sort is known to me."],
      decline: ["I do not wish to comment on that.", "I ask for your understanding that I remain silent on this."],
      stands_by: ["My statement stands unchanged."],
      gives_in: ["I see that denial is pointless."],
    },
  },
  {
    trait: "seems jittery and nervous tonight.",
    confess: (c) => `${c} trembles, struggles for words and finally confesses in tears.`,
    lines: {
      affirms: ["Y-yes. Yes, I suppose.", "Yes … is that bad?"],
      denies: ["No! No, really not.", "N-no. Why do you ask?"],
      leans_affirms: ["I … think so?"],
      leans_denies: ["Probably not, I think. Or?"],
      uncertain: ["I don't remember any more, I'm all confused."],
      does_not_know: ["I don't know, honestly!"],
      decline: ["I … I can't say anything about that.", "Please, don't ask me that."],
      stands_by: ["That's no proof! I stand by what I said."],
      gives_in: ["All right, all right."],
    },
  },
];

export const EN_DECOY_ROOMS: readonly { readonly name: string; readonly in: string }[] = [
  { name: "Storeroom", in: "in the storeroom" },
  { name: "Washroom", in: "in the washroom" },
  { name: "Forecourt", in: "on the forecourt" },
  { name: "Car park", in: "in the car park" },
  { name: "Cloakroom", in: "in the cloakroom" },
  { name: "Back stairs", in: "on the back stairs" },
];

const enCap = (text: string) => text[0]!.toUpperCase() + text.slice(1);
export const EN_HERRINGS: readonly { readonly label: string; readonly text: (who: string, roomIn: string) => string }[] = [
  { label: "Handkerchief", text: (who, r) => `${enCap(r)} lies a handkerchief with ${enGen(who)} monogram. When it fell there, it does not say.` },
  { label: "Cigarette end", text: (who, r) => `${enCap(r)} lies a cigarette end of the brand ${who} smokes. It is cold; how old it is remains open.` },
  { label: "Note", text: (who, r) => `${enCap(r)} you find a note in ${enGen(who)} handwriting: "We need to talk." It bears no date.` },
  { label: "Wine glass", text: (who, r) => `${enCap(r)} stands a half-empty glass with ${enGen(who)} fingerprints. It may have stood there for hours.` },
];

/** English possessive of a first name: "Anna's", "Jonas'". */
export function enGen(name: string): string {
  return /s$/.test(name) ? `${name}'` : `${name}'s`;
}
/** "A", "A and B", "A, B and C". */
export function enList(items: readonly string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}
export { enCap };
