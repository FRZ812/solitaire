// Word banks for generated placenames.
//
// Names are built from elements rather than title-cased slugs, so a fortification
// becomes "Alderwatch" or "The Greywall Watch" instead of "Tannic Frontier Fort".
// Elements are grouped by realm so the frozen north does not sound like the sun
// country, and by archetype family so a thing is named the way that kind of thing
// gets named -- inns take signs, ruins take the name of whatever they used to be,
// and predators' lairs take the name locals mutter rather than a polite one.

// Head elements carry the realm's landscape and speech. Region prefixes from
// REGION_DEFINITIONS.areas are mixed in at generation time, which is what makes a
// Mire name sound like the Mire specifically.
export const TOPONYM_HEADS = Object.freeze({
  central: Object.freeze([
    "Alder", "Barley", "Bell", "Garran", "Brook", "Chalk", "Elm", "Fal", "Grey",
    "Hart", "Hollow", "Kings", "Lang", "Marl", "Mill", "Nether", "Old", "Ox",
    "Ray", "Ridge", "Rush", "Shep", "Stan", "Thorn", "Wend", "Whit", "Willow",
  ]),
  north: Object.freeze([
    "Bleak", "Cinder", "Cold", "Drift", "Fell", "Frost", "Gall", "Grim", "Hoar",
    "Iron", "Kell", "Rime", "Scar", "Sleet", "Snow", "Storm", "Thrall", "Vard",
    "White", "Wolf", "Wyrm", "Blackthaw", "Northhold",
  ]),
  east: Object.freeze([
    "Azure", "Carp", "Crane", "Egret", "Heron", "Lantern", "Lotus", "Mist",
    "Nine", "Pale", "Reed", "Silk", "Still", "Tell", "Tide", "Vermil", "Water",
    "Willow", "Jade", "Bamboo", "Moon",
  ]),
  south: Object.freeze([
    "Amber", "Ash", "Brass", "Copper", "Dune", "Ember", "Glass", "Gold", "Kiln",
    "Mirage", "Ochre", "Salt", "Scald", "Sun", "Thirst", "Vane", "Well",
    "Zeph", "Sandrift", "Bright",
  ]),
  west: Object.freeze([
    "Bramble", "Briar", "Deep", "Elder", "Fern", "Green", "Hazel", "Holly",
    "Ivy", "Moss", "Oak", "Owl", "Root", "Sela", "Shade", "Silver", "Thistle",
    "Vine", "Yew", "Wilder", "Quiet",
  ]),
});

// Lowercase compounding tails. "Alder" + "ford" reads as one word, which is how
// most settled places end up named.
export const TOPONYM_STEMS = Object.freeze({
  settlement: Object.freeze(["ford", "stead", "thorpe", "ton", "wick", "hollow", "bridge", "combe", "worth", "hithe", "field", "holt"]),
  camp: Object.freeze(["rest", "lea", "shiel", "bothy", "hearth", "halt"]),
  clearing: Object.freeze(["green", "ley", "glade", "lawn", "ring"]),
  den: Object.freeze(["scar", "gape", "maw", "deep", "throat", "gullet"]),
  "bandit-camp": Object.freeze(["scar", "nook", "shaw", "snare"]),
  "roadside-inn": Object.freeze(["rest", "welcome", "halt"]),
  shrine: Object.freeze(["minster", "cross", "well", "chapel", "rood"]),
  ruin: Object.freeze(["barrow", "howe", "garth", "cairn", "wold"]),
  resource: Object.freeze(["works", "delph", "pit", "quarry", "field"]),
  crossing: Object.freeze(["ford", "bridge", "wade", "stair", "reach"]),
  fortification: Object.freeze(["gate", "watch", "keep", "burh", "spire", "hold"]),
  wonder: Object.freeze(["stones", "seat", "ring", "mark", "stone"]),
});

// Standalone nouns for the spaced form: "Grey Watch", "Alder Barrow".
export const TOPONYM_NOUNS = Object.freeze({
  settlement: Object.freeze(["Cross", "End", "Green", "Row", "Bottom", "Side"]),
  camp: Object.freeze(["Camp", "Rest", "Cuttings", "Shieling", "Halt"]),
  clearing: Object.freeze(["Green", "Glade", "Lawn", "Opening", "Clearing"]),
  den: Object.freeze(["Scar", "Hollow", "Deeps", "Warren", "Reek"]),
  "bandit-camp": Object.freeze(["Hideaway", "Nest", "Cut", "Bolt-hole"]),
  "roadside-inn": Object.freeze(["House", "Lodging", "Halt", "Rest"]),
  shrine: Object.freeze(["Shrine", "Chapel", "Cross", "Well", "Rood"]),
  ruin: Object.freeze(["Ruin", "Barrow", "Remains", "Walls", "Stones"]),
  resource: Object.freeze(["Workings", "Quarry", "Diggings", "Cut", "Beds"]),
  crossing: Object.freeze(["Ford", "Bridge", "Crossing", "Stair", "Passage"]),
  fortification: Object.freeze(["Watch", "Keep", "Spire", "Redoubt", "Post"]),
  wonder: Object.freeze(["Stones", "Ring", "Seat", "Mark", "Finger"]),
});

// Inns hang a sign, and the sign is the name.
export const INN_SIGN_ADJECTIVES = Object.freeze([
  "Blue", "Brazen", "Broken", "Crooked", "Golden", "Green", "Grey", "Half",
  "Hanging", "Iron", "Laughing", "Old", "Red", "Silent", "Silver", "Three",
  "Weary", "White", "Wandering",
]);

export const INN_SIGN_NOUNS = Object.freeze([
  "Anchor", "Antler", "Axe", "Bell", "Boar", "Candle", "Crown", "Drum", "Fox",
  "Gate", "Harrow", "Heron", "Horn", "Horse", "Hound", "Kettle", "Key", "Lamp",
  "Mare", "Moon", "Oar", "Plough", "Rook", "Shoe", "Sickle", "Stag", "Sun",
  "Swan", "Wheel", "Wolf",
]);

// Patterns are drawn per family. Tokens:
//   {head}  realm or region element, capitalised
//   {stem}  lowercase compounding tail for the family
//   {noun}  standalone noun for the family
//   {sign}  inn sign, already assembled
//   {faith} a faith named by the realm's culture
export const SITE_NAME_PATTERNS = Object.freeze({
  settlement: Object.freeze(["{head}{stem}", "{head}{stem}", "{head} {noun}", "Nether {head}{stem}"]),
  camp: Object.freeze(["{head}{stem}", "{head} {noun}", "The {head} {noun}"]),
  clearing: Object.freeze(["{head}{stem}", "{head} {noun}", "The {head} {noun}"]),
  den: Object.freeze(["The {head}{stem}", "{head} {noun}", "The {noun}"]),
  "bandit-camp": Object.freeze(["The {head} {noun}", "{head}{stem}", "The {noun}"]),
  "roadside-inn": Object.freeze(["The {sign}", "The {sign}", "{head} {noun}"]),
  shrine: Object.freeze(["{head}{stem}", "The Shrine of {faith}", "{head} {noun}", "The {noun} of {faith}"]),
  ruin: Object.freeze(["Old {head}{stem}", "{head} {noun}", "The {head} {noun}", "{head}{stem}"]),
  resource: Object.freeze(["{head} {noun}", "{head}{stem}", "The {head} {noun}"]),
  crossing: Object.freeze(["{head}{stem}", "{head} {noun}", "The {head} {noun}"]),
  fortification: Object.freeze(["{head}{stem}", "{head} {noun}", "The {head} {noun}"]),
  wonder: Object.freeze(["The {head} {noun}", "{head}{stem}", "The {noun} of {faith}"]),
});

// A family's nouns are right for most of its motifs but flatly wrong for a few:
// a ferry must not be named a ford, and a mine must not be named a quarry. These
// overrides keep the name honest about what the place actually is.
export const MOTIF_NAME_OVERRIDES = Object.freeze({
  ferry: Object.freeze({ nouns: Object.freeze(["Ferry", "Crossing", "Landing", "Passage"]), stems: Object.freeze(["hithe", "landing"]) }),
  "moon-bridge": Object.freeze({ nouns: Object.freeze(["Bridge", "Span", "Arch"]), stems: Object.freeze(["bridge"]) }),
  "river-ford": Object.freeze({ nouns: Object.freeze(["Ford", "Wade", "Crossing"]), stems: Object.freeze(["ford", "wade"]) }),
  "tarn-jetty": Object.freeze({ nouns: Object.freeze(["Jetty", "Landing", "Steps"]), stems: Object.freeze(["landing"]) }),
  mine: Object.freeze({ nouns: Object.freeze(["Mine", "Workings", "Levels"]), stems: Object.freeze(["works", "pit"]) }),
  "abandoned-mine": Object.freeze({ nouns: Object.freeze(["Mine", "Levels", "Adit"]), stems: Object.freeze(["works", "pit"]) }),
  quarry: Object.freeze({ nouns: Object.freeze(["Quarry", "Delph", "Cut"]), stems: Object.freeze(["delph", "quarry"]) }),
  saltworks: Object.freeze({ nouns: Object.freeze(["Saltworks", "Pans", "Beds"]), stems: Object.freeze(["works", "pans"]) }),
  apiary: Object.freeze({ nouns: Object.freeze(["Skeps", "Bee Garth", "Hives"]), stems: Object.freeze(["garth"]) }),
  "ice-cave": Object.freeze({ nouns: Object.freeze(["Cave", "Deeps", "Hollow"]), stems: Object.freeze(["deep", "maw"]) }),
  "hot-spring": Object.freeze({ nouns: Object.freeze(["Spring", "Baths", "Steams"]), stems: Object.freeze(["well", "spring"]) }),
  "ash-well": Object.freeze({ nouns: Object.freeze(["Well", "Cistern", "Draw"]), stems: Object.freeze(["well"]) }),
  "deserted-well": Object.freeze({ nouns: Object.freeze(["Well", "Cistern", "Draw"]), stems: Object.freeze(["well"]) }),
  "guarded-well": Object.freeze({ nouns: Object.freeze(["Well", "Cistern", "Draw"]), stems: Object.freeze(["well"]) }),
  "crystal-field": Object.freeze({ nouns: Object.freeze(["Fields", "Glitter", "Shards"]), stems: Object.freeze(["field"]) }),
  barrow: Object.freeze({ nouns: Object.freeze(["Barrow", "Howe", "Mound"]), stems: Object.freeze(["barrow", "howe"]) }),
  "burial-mound": Object.freeze({ nouns: Object.freeze(["Mound", "Barrow", "Howe"]), stems: Object.freeze(["barrow", "howe"]) }),
  "cairn-field": Object.freeze({ nouns: Object.freeze(["Cairns", "Stones", "Field"]), stems: Object.freeze(["cairn"]) }),
  "standing-stones": Object.freeze({ nouns: Object.freeze(["Stones", "Ring", "Fingers"]), stems: Object.freeze(["stones", "ring"]) }),
  wardstone: Object.freeze({ nouns: Object.freeze(["Wardstone", "Mark", "Stone"]), stems: Object.freeze(["stone", "mark"]) }),
  waystone: Object.freeze({ nouns: Object.freeze(["Waystone", "Mark", "Stone"]), stems: Object.freeze(["stone", "mark"]) }),
  "memory-tree": Object.freeze({ nouns: Object.freeze(["Tree", "Oak", "Yew"]), stems: Object.freeze(["holt"]) }),
  wreck: Object.freeze({ nouns: Object.freeze(["Wreck", "Hulk", "Ribs"]), stems: Object.freeze(["wold"]) }),
  "signal-spire": Object.freeze({ nouns: Object.freeze(["Spire", "Beacon", "Signal"]), stems: Object.freeze(["spire", "beacon"]) }),
  "toll-fort": Object.freeze({ nouns: Object.freeze(["Toll", "Bar", "Gate"]), stems: Object.freeze(["gate", "bar"]) }),
  caravanserai: Object.freeze({ nouns: Object.freeze(["Caravanserai", "Yard", "Halt"]), stems: Object.freeze(["halt"]) }),
});
