// Avarra's continental-scale content contract.
//
// This module is deliberately data-only. `engine/world-generation.js` turns
// these authored macro facts into deterministic, lazy world tiles. Nothing in
// here is expanded into HANDCRAFTED or campaign state: an Avarra-sized atlas is
// far too large for either of those sparse, player-authored stores.

import { WHITEMARCH_CAPITAL } from "./whitemarch-capital.js";

export const WORLD_GENERATOR_VERSION = 3;
export const DEFAULT_WORLD_SEED = "avarra-first-light";
export const WORLD_GEOGRAPHY_VERSION = 2;
export const WORLD_GEOGRAPHY_SEED = DEFAULT_WORLD_SEED;

export const CONTINENT = {
  id: "avarra",
  name: "Avarra",
  seed: DEFAULT_WORLD_SEED,
  geographySeed: WORLD_GEOGRAPHY_SEED,
  geographyVersion: WORLD_GEOGRAPHY_VERSION,
  generatorVersion: WORLD_GENERATOR_VERSION,
  contentVersion: 4,
  hexKilometers: 6,
  // Generated continental cells cover expedition-scale ground, unlike the
  // compact handcrafted cells inside Whitemarch. At 144 minutes per open
  // country hex the party sustains roughly 2.5 km/h across a full walking day;
  // authored roads remain faster through their terrain multiplier. Keeping the
  // scale here beside hexKilometers gives route previews and actual travel one
  // authoritative physical contract without splitting the axial graph.
  footMinutesPerHex: 144,
  chunkSize: 24,
  // These are sampling/editor bounds, not a rectangular wall. The actual shore
  // is an irregular finite mask inside them.
  bounds: { xmin: -540, xmax: 540, ymin: -400, ymax: 410 },
  start: {
    regionId: "whitemarch",
    poiPartId: "grain-square",
    coord: { x: WHITEMARCH_CAPITAL.start.x, y: WHITEMARCH_CAPITAL.start.y },
  },
  description:
    "An immense, road-bound continent: Whitemarch stands in the temperate heartlands, " +
    "with the frozen crown far north, the Sunscar desert far south, the Sea of Reeds " +
    "far east, and the Elderwood far west. Irregular coasts open to three great seas.",
  // The atlas and generator share this authored, non-radial outline. Low-frequency
  // seed noise roughens the edges, while named coves below cut into it. Coordinates
  // stay in the same axial world space as Whitemarch and every travel tile.
  coastline: [
    // The frozen crown continues beyond the northern chart edge; this is a
    // mainland survey, not a radius-clipped oval island.
    { x: -205, y: -430 }, { x: -80, y: -455 }, { x: 35, y: -445 },
    { x: 155, y: -430 }, { x: 225, y: -382 }, { x: 275, y: -315 },
    { x: 365, y: -305 }, { x: 430, y: -252 }, { x: 462, y: -266 },
    { x: 445, y: -205 }, { x: 505, y: -155 }, { x: 492, y: -86 },
    { x: 526, y: -28 }, { x: 493, y: 35 }, { x: 528, y: 102 },
    { x: 475, y: 154 }, { x: 456, y: 215 }, { x: 405, y: 278 },
    { x: 324, y: 304 }, { x: 286, y: 347 }, { x: 205, y: 370 },
    { x: 65, y: 395 }, { x: -80, y: 380 }, { x: -190, y: 335 },
    { x: -270, y: 350 }, { x: -330, y: 300 }, { x: -382, y: 264 },
    { x: -456, y: 278 }, { x: -438, y: 222 }, { x: -507, y: 192 },
    { x: -485, y: 139 }, { x: -532, y: 92 }, { x: -500, y: 28 },
    { x: -535, y: -20 }, { x: -474, y: -82 }, { x: -497, y: -145 },
    { x: -421, y: -174 }, { x: -434, y: -238 }, { x: -350, y: -252 },
    { x: -300, y: -330 }, { x: -230, y: -352 },
  ],
};

// Five atlas-scale realms are the primary geography players should read from a
// continental view. Smaller REGION_DEFINITIONS below remain cultural subregions
// for encounter/save compatibility; every generated tile also carries one of
// these five stable realm ids and its dominant biome identity.
export const REALMS = Object.freeze([
  Object.freeze({
    id: "central", direction: "central", name: "Whitemarch Heartlands",
    shortName: "Heartlands", biomeId: "temperate", biomeName: "Temperate Heartland",
    center: Object.freeze({ x: 0, y: 0 }), influence: Object.freeze({ scaleX: 145, scaleY: 135 }),
    capital: Object.freeze({ id: "whitemarch", name: "Whitemarch", coord: Object.freeze({ x: 0, y: 0 }) }),
    faction: Object.freeze({ id: "whitemarch-iron", name: "The Iron Concord" }),
    ruler: Object.freeze({ name: "Queen Aveline IV", title: "Crowned Warden of Whitemarch" }),
    climate: Object.freeze({ temperature: 0.02, moisture: 0.02, elevation: -0.04 }),
    terrain: Object.freeze({ forest: 0.02, marsh: 0.01, hills: -0.05 }),
    description: "River-fed fields, low wooded ridges, market roads, and the walled capital at Avarra's inland crossroads.",
  }),
  Object.freeze({
    id: "north", direction: "north", name: "The Frostcrown",
    shortName: "Frostcrown", biomeId: "snow", biomeName: "Snowbound Wastes",
    center: Object.freeze({ x: 8, y: -332 }), influence: Object.freeze({ scaleX: 240, scaleY: 175 }),
    influenceSites: Object.freeze([
      Object.freeze({ x: -105, y: -135, scaleX: 115, scaleY: 95 }),
    ]),
    capital: Object.freeze({ id: "northstar-castle", name: "Northstar", coord: Object.freeze({ x: 8, y: -332 }) }),
    faction: Object.freeze({ id: "vyrgun-drakekin", name: "The Vyrgun Crown" }),
    ruler: Object.freeze({ name: "High Queen Ysra Vyrgun", title: "Keeper of the Winter Crown" }),
    climate: Object.freeze({ temperature: -0.38, moisture: 0.08, elevation: 0.16 }),
    terrain: Object.freeze({ forest: -0.14, marsh: -0.12, hills: 0.20 }),
    description: "A remote crown of snowfields, black fir, glacier valleys, smoking peaks, and fortified winter roads.",
  }),
  Object.freeze({
    id: "east", direction: "east", name: "The Sea of Reeds",
    shortName: "Sea of Reeds", biomeId: "reed-sea", biomeName: "Reed Sea and River Provinces",
    center: Object.freeze({ x: 418, y: 72 }), influence: Object.freeze({ scaleX: 250, scaleY: 210 }),
    capital: Object.freeze({ id: "tellmar", name: "Tellmar", coord: Object.freeze({ x: 418, y: 72 }) }),
    faction: Object.freeze({ id: "tellmar-banners", name: "The Hundred Banners" }),
    ruler: Object.freeze({ name: "Empress Shuyei Ren", title: "Mistress of Reeds and Tides" }),
    climate: Object.freeze({ temperature: 0.10, moisture: 0.18, elevation: -0.08 }),
    terrain: Object.freeze({ forest: 0.14, marsh: 0.08, hills: 0.02 }),
    description: "Lush reed fields, terraced river valleys, tiled cities, shrine roads, banner clans, and bright eastern harbors, with true marsh confined to deltas and flood basins.",
  }),
  Object.freeze({
    id: "south", direction: "south", name: "The Sunscar Expanse",
    shortName: "Sunscar", biomeId: "desert", biomeName: "Sunscar Desert",
    center: Object.freeze({ x: 104, y: 294 }), influence: Object.freeze({ scaleX: 250, scaleY: 190 }),
    capital: Object.freeze({ id: "asalan", name: "Asalan", coord: Object.freeze({ x: 104, y: 294 }) }),
    faction: Object.freeze({ id: "asalan-sun-court", name: "The Sun Court of Asalan" }),
    ruler: Object.freeze({ name: "Sultana Maraset al-Azur", title: "Keeper of the Nine Wells" }),
    climate: Object.freeze({ temperature: 0.28, moisture: -0.42, elevation: 0.04 }),
    terrain: Object.freeze({ forest: -0.36, marsh: -0.32, hills: 0.08 }),
    description: "Gold and red dunes, salt pans, caravan wells, sandstone escarpments, and a southern sea reached through warm ports.",
  }),
  Object.freeze({
    id: "west", direction: "west", name: "The Elderwood",
    shortName: "Elderwood", biomeId: "woodland", biomeName: "Great Western Woodland",
    center: Object.freeze({ x: -420, y: 150 }), influence: Object.freeze({ scaleX: 250, scaleY: 210 }),
    influenceSites: Object.freeze([
      Object.freeze({ x: -145, y: 62, scaleX: 64, scaleY: 90 }),
    ]),
    capital: Object.freeze({ id: "caer-selenya", name: "Caer Selenya", coord: Object.freeze({ x: -420, y: 150 }) }),
    faction: Object.freeze({ id: "selenyan-covenant", name: "The Selenyan Covenant" }),
    ruler: Object.freeze({ name: "Queen Maerwynn Thorne", title: "Voice Beneath the Boughs" }),
    climate: Object.freeze({ temperature: -0.01, moisture: 0.30, elevation: 0.01 }),
    terrain: Object.freeze({ forest: 0.46, marsh: 0.04, hills: 0.02 }),
    description: "A continent-deep woodland of rain-dark canopy, living bridges, hidden courts, forest roads, and western ports.",
  }),
]);

export const REALM_DEFINITIONS = Object.freeze(Object.fromEntries(REALMS.map((realm) => [realm.id, realm])));
// Alias retained for atlas consumers that describe these as macro regions.
export const MACRO_REGIONS = REALMS;

export const COASTAL_FEATURES = Object.freeze([
  Object.freeze({ id: "rimeward-sea", name: "Rimeward Sea", kind: "sea", edge: "north", realmId: "north", coord: Object.freeze({ x: 30, y: -405 }), description: "Pack ice and blue-black winter water beyond the northern crown." }),
  Object.freeze({ id: "greenwater", name: "The Greenwater", kind: "sea", edge: "west", realmId: "west", coord: Object.freeze({ x: -535, y: 125 }), description: "A rain-fed western sea broken by forested headlands." }),
  Object.freeze({ id: "saffron-sea", name: "The Saffron Sea", kind: "sea", edge: "south", realmId: "south", coord: Object.freeze({ x: 80, y: 405 }), description: "Warm southern water carrying spice sails and desert dust." }),
  Object.freeze({ id: "lantern-sea", name: "The Lantern Sea", kind: "sea", edge: "east", realmId: "east", coord: Object.freeze({ x: 535, y: 95 }), description: "The bright eastern sea beyond the reed deltas." }),
  Object.freeze({ id: "heron-inlet", name: "Heron Inlet", kind: "inlet", edge: "east", realmId: "east", coord: Object.freeze({ x: 484, y: 132 }), carve: Object.freeze({ radiusX: 94, radiusY: 72, strength: 0.65 }), description: "A many-fingered tidal inlet among the outer reeds." }),
  Object.freeze({ id: "nine-wells-bay", name: "Nine Wells Bay", kind: "bay", edge: "south", realmId: "south", coord: Object.freeze({ x: 10, y: 374 }), carve: Object.freeze({ radiusX: 105, radiusY: 65, strength: 0.38 }), description: "A broad warm bay sheltering the desert coast's oldest roadstead." }),
  Object.freeze({ id: "selenyan-cove", name: "Selenyan Cove", kind: "cove", edge: "west", realmId: "west", coord: Object.freeze({ x: -486, y: 150 }), carve: Object.freeze({ radiusX: 82, radiusY: 78, strength: 0.15 }), description: "A steep green cove hidden between rainwood cliffs." }),
]);

// A broken mountain backbone echoes the continental relief visible on the
// parchment chart. It bends from the frozen north through the inland east of
// Whitemarch, then turns south-west. Named road passes deliberately interrupt
// the ridge so the five realms remain connected by believable ground routes.
export const MOUNTAIN_SPINE = Object.freeze({
  id: "avarran-spine",
  name: "The Avarran Spine",
  width: 48,
  elevationBoost: 0.36,
  waypoints: Object.freeze([
    Object.freeze({ x: 72, y: -330 }), Object.freeze({ x: 48, y: -245 }),
    Object.freeze({ x: 82, y: -170 }), Object.freeze({ x: 62, y: -92 }),
    Object.freeze({ x: 112, y: -22 }), Object.freeze({ x: 135, y: 40 }),
    Object.freeze({ x: 94, y: 100 }), Object.freeze({ x: -15, y: 170 }),
    Object.freeze({ x: -82, y: 226 }), Object.freeze({ x: -190, y: 286 }),
  ]),
  passes: Object.freeze([
    Object.freeze({ id: "drakespire-pass", name: "Drakespire Pass", coord: Object.freeze({ x: 48, y: -245 }), radius: 8, routeIds: Object.freeze(["north-road"]) }),
    Object.freeze({ id: "heron-pass", name: "Heron Pass", coord: Object.freeze({ x: 135, y: 40 }), radius: 9, routeIds: Object.freeze(["crown-road-east", "star-road"]) }),
    Object.freeze({ id: "sunward-pass", name: "Sunward Pass", coord: Object.freeze({ x: -15, y: 170 }), radius: 10, routeIds: Object.freeze(["south-road"]) }),
  ]),
});

// Lower, broken ridges run parallel to the northern reach of the Avarran
// Spine. Their snowmelt feeds the Glasswater and Iceflow headwaters without
// turning the whole Frostcrown into one continuous impassable wall.
export const NORTHERN_RIDGES = Object.freeze([
  Object.freeze({
    id: "glasswater-ridge",
    name: "The Glasswater Ridge",
    width: 26,
    elevationBoost: 0.18,
    waypoints: Object.freeze([
      Object.freeze({ x: -270, y: -345 }),
      Object.freeze({ x: -235, y: -305 }),
      Object.freeze({ x: -205, y: -260 }),
      Object.freeze({ x: -170, y: -220 }),
    ]),
  }),
  Object.freeze({
    id: "iceflow-ridge",
    name: "The Iceflow Ridge",
    width: 24,
    elevationBoost: 0.18,
    waypoints: Object.freeze([
      Object.freeze({ x: -20, y: -390 }),
      Object.freeze({ x: 8, y: -332 }),
      Object.freeze({ x: 40, y: -290 }),
      Object.freeze({ x: 72, y: -250 }),
    ]),
  }),
]);

export const REALM_CULTURES = Object.freeze([
  { id: "heartland-culture", realmId: "central", demonym: "Heartlander", languages: ["March Speech", "High Avarran"], values: ["public duty", "fair measure", "guest-right"], architecture: ["black-and-white masonry", "river brick", "slate market halls"], customs: ["weighing-day fairs", "iron oath coins", "lantern processions"], faiths: ["the Pale God", "river saints", "household ancestors"], settlementTypes: ["walled-city", "market-town", "river-village", "roadside-hospice"], encounterThemes: ["watch patrols", "merchant trains", "pilgrims", "tenant assemblies"], description: "A literate road culture shaped by Whitemarch law, river commerce, guild charters, and stubborn village custom." },
  { id: "frostcrown-culture", realmId: "north", demonym: "Frostborn", languages: ["Vyrgun", "Rime Cant", "March Speech"], values: ["winter hospitality", "lineage memory", "kept tribute"], architecture: ["black-fir halls", "basalt keeps", "snow-roofed bathhouses"], customs: ["aurora vigils", "first-thaw treaties", "shared hearth salt"], faiths: ["the Winter Crown", "wyrm ancestors", "ember saints"], settlementTypes: ["winter-hold", "hot-spring-town", "tribute-fort", "hunter-cloister"], encounterThemes: ["sledge caravans", "frost patrols", "wyrm hunters", "hearth envoys"], description: "Northern life is organized around defended hearths, stored heat, oath kinship, and the disciplined movement of food through snow." },
  { id: "reed-sea-culture", realmId: "east", demonym: "Reedlander", languages: ["Tellmari Court Speech", "River Cant", "Banner Sign"], values: ["harmonious duty", "scholarship", "ancestral reputation"], architecture: ["tiled river cities", "raised timber causeways", "courtyard academies"], customs: ["moon-viewing boats", "ancestor tablets", "banner poetry contests"], faiths: ["river dragons", "the Lantern Court", "local shrine spirits"], settlementTypes: ["canal-city", "stilt-town", "terrace-village", "shrine-island"], encounterThemes: ["river patrols", "scholar pilgrims", "rice barges", "banner retainers"], description: "A many-province river civilization joined by waterways, examination halls, ancestor rites, and the negotiated authority of the Hundred Banners." },
  { id: "sunscar-culture", realmId: "south", demonym: "Sunscarred", languages: ["Asalani", "Caravan Cant", "Old Well Script"], values: ["water hospitality", "kept contracts", "poetic renown"], architecture: ["sandstone courts", "wind towers", "blue-tiled cisterns"], customs: ["well-sharing law", "night markets", "dawn recitations"], faiths: ["the Unsetting Sun", "well guardians", "saints of the open road"], settlementTypes: ["oasis-city", "caravan-town", "well-fort", "cliff-sanctuary"], encounterThemes: ["caravan leagues", "well guards", "desert scholars", "dune outriders"], description: "Southern society measures wealth in water, shade, trustworthy roads, and the stories carried between widely separated wells." },
  { id: "elderwood-culture", realmId: "west", demonym: "Woodlander", languages: ["Selenyan", "Green Cant", "March Speech"], values: ["stewardship", "consensus", "remembered obligation"], architecture: ["living timber halls", "root bridges", "rain-slate ports"], customs: ["grove councils", "name-grafting", "rainwake feasts"], faiths: ["the Root Choir", "green ancestors", "cove saints"], settlementTypes: ["tree-city", "coppice-town", "grove-sanctuary", "rain-port"], encounterThemes: ["oak-spear wardens", "forester guilds", "herb caravans", "covenant envoys"], description: "Western communities treat forest, road, and ancestry as one living inheritance governed through layered covenants." },
]);

export const REALM_ECONOMIES = Object.freeze([
  { id: "heartland-economy", realmId: "central", currency: "iron shilling", resources: ["grain", "iron", "wool", "river clay", "apples"], exports: ["tools", "flour", "finished cloth", "chartered services"], imports: ["spices", "hardwood", "salt", "furs"], tradeGoods: ["iron tools", "barley", "wool bolts", "ledger paper"], routeIds: ["crown-road-east", "tannic-road", "spine-road", "bramble-road", "south-road", "north-road"], tradeNotes: ["Whitemarch certifies weights used across the continent", "river tolls fund road patrols"] },
  { id: "frostcrown-economy", realmId: "north", currency: "rime mark", resources: ["furs", "cold iron", "amber", "ice crystal", "pine resin"], exports: ["furs", "tempered steel", "amber", "medicinal moss"], imports: ["grain", "wine", "salt", "lamp oil"], tradeGoods: ["fur mantles", "rime steel", "amber beads", "smoked char"], routeIds: ["north-road", "tannic-road", "aurora-way"], tradeNotes: ["winter convoys travel under military seal", "hot-spring towns store emergency grain"] },
  { id: "reed-sea-economy", realmId: "east", currency: "square-holed banner cash", resources: ["rice", "tea", "silk", "reeds", "river fish", "lacquer"], exports: ["silk", "tea", "paper", "porcelain", "lacquerware"], imports: ["iron", "horses", "amber", "desert glass"], tradeGoods: ["tea bricks", "silk bolts", "rice paper", "lacquer boxes"], routeIds: ["crown-road-east", "spine-road", "star-road", "jade-causeway", "lotus-circuit"], tradeNotes: ["canal tolls are paid by cargo depth", "banner houses maintain competing courier posts"] },
  { id: "sunscar-economy", realmId: "south", currency: "sun dinar", resources: ["salt", "dates", "copper", "glass sand", "incense"], exports: ["salt", "glass", "incense", "dates", "astronomical instruments"], imports: ["timber", "grain", "cold iron", "silk"], tradeGoods: ["blue glass", "salt cakes", "date wine", "brass astrolabes"], routeIds: ["south-road", "low-tide-way", "nine-wells-road", "dune-circuit"], tradeNotes: ["water rights travel with stamped caravan tablets", "Qamarat prices are set after the dawn wind reading"] },
  { id: "elderwood-economy", realmId: "west", currency: "leaf crown", resources: ["hardwood", "herbs", "honey", "resin", "mushrooms", "dyes"], exports: ["hardwood", "medicines", "green dyes", "honey", "ship timber"], imports: ["iron", "salt", "ceramics", "desert glass"], tradeGoods: ["healing tinctures", "wax tablets", "dyewood", "rain-cured timber"], routeIds: ["bramble-road", "greenway", "root-road"], tradeNotes: ["living trees may only be felled under covenant mark", "Greenharbor auctions storm-fallen timber first"] },
]);

export const REALM_FACTIONS = Object.freeze([
  { id: "whitemarch-iron", realmId: "central", name: "The Iron Concord", type: "crown-and-charter realm", leader: { name: "Queen Aveline IV", title: "Crowned Warden" }, seatLandmarkId: "whitemarch", provinceIds: ["crown-basin"], agenda: "Keep the six continental roads open under common weights and law.", allies: ["crowsmoor-wardens"], rivals: ["sundered-crown"], forces: ["Market Watch", "Iron Lancers", "road engineers"], description: "The crown, city wards, and chartered guilds governing Whitemarch and its basin." },
  { id: "crowsmoor-wardens", realmId: "central", name: "Crowsmoor Wardens", type: "freehold council", leader: { name: "Reeve Mara Crow", title: "First Warden" }, seatLandmarkId: "crowsmoor", provinceIds: ["crowsmoor-reach"], agenda: "Protect grain roads and freehold courts from noble enclosure.", allies: ["whitemarch-iron"], rivals: ["iron-plateau-marches"], forces: ["mounted reeves", "militia bows"], description: "A federation of grain freeholds whose elected wardens police the eastern heartland." },
  { id: "high-sheepway-guild", realmId: "central", name: "High Sheepway Guild", type: "road and mining league", leader: { name: "Dorrin Stonebrook", title: "Roadmaster" }, seatLandmarkId: "stonebrook", provinceIds: ["stonebrook-uplands"], agenda: "Hold the mountain passes and enforce safe caravan contracts.", allies: ["whitemarch-iron"], rivals: ["road-cutthroat-companies"], forces: ["guild outriders", "bridge crews"], description: "Dwarven holds, herders, and caravan houses bound to the High Sheepway." },
  { id: "vyrgun-drakekin", realmId: "north", name: "The Vyrgun Crown", type: "winter monarchy", leader: { name: "High Queen Ysra Vyrgun", title: "Keeper of the Winter Crown" }, seatLandmarkId: "northstar-castle", provinceIds: ["rime-crown", "drake-marches"], agenda: "Unify the northern holds before the glaciers advance again.", allies: ["wintermere-hearths"], rivals: ["sundered-crown"], forces: ["White Pike Legion", "drake riders", "snow engineers"], description: "The royal hearth network owing tribute, troops, and winter stores to Northstar." },
  { id: "sundered-crown", realmId: "north", name: "The Sundered Crown", type: "warlord confederacy", leader: { name: "King Vrask Nine-Walls", title: "Crown-Taker" }, seatLandmarkId: "brokenhold", provinceIds: ["sundered-snow"], agenda: "Control the north-west road and bargain recognition through strength.", allies: [], rivals: ["vyrgun-drakekin", "whitemarch-iron"], forces: ["Red Tusk Cohort", "wolf sledges", "fortress levies"], description: "A harsh league of captured keeps and mobile war camps around Brokenhold." },
  { id: "wintermere-hearths", realmId: "north", name: "Wintermere Free Hearths", type: "town league", leader: { name: "Sava Emberhand", title: "Speaker of Hearths" }, seatLandmarkId: "wintermere", provinceIds: ["ember-lakes"], agenda: "Keep hot springs, refuges, and food stores independent but open.", allies: ["vyrgun-drakekin"], rivals: ["sundered-crown"], forces: ["hearth wardens", "lake scouts"], description: "Hot-spring towns whose shared granaries make northern travel possible." },
  { id: "tellmar-banners", realmId: "east", name: "The Hundred Banners", type: "imperial banner court", leader: { name: "Empress Shuyei Ren", title: "Mistress of Reeds and Tides" }, seatLandmarkId: "tellmar", provinceIds: ["tellmar-delta", "lotus-marches"], agenda: "Balance the banner houses while restoring the old floodworks.", allies: ["lotus-prefecture"], rivals: ["iron-plateau-marches"], forces: ["Azure Heron Banner", "river marines", "court inspectors"], description: "Tellmar's imperial court and the banner houses sworn to maintain canals and armies." },
  { id: "iron-plateau-marches", realmId: "east", name: "Iron Plateau Marches", type: "border baronies", leader: { name: "Lady Sen Varro", title: "March-Marshal" }, seatLandmarkId: "jade-lock", provinceIds: ["starfall-uplands"], agenda: "Monopolize horse and meteor-iron traffic through Reedwatch.", allies: [], rivals: ["tellmar-banners", "crowsmoor-wardens"], forces: ["mirror cavalry", "signal towers"], description: "Horse barons and fortress houses holding the dry approaches above the reed sea." },
  { id: "lotus-prefecture", realmId: "east", name: "Lotus Prefecture", type: "scholar bureaucracy", leader: { name: "Prefect Lin Aro", title: "Keeper of Floodgates" }, seatLandmarkId: "hanori", provinceIds: ["lotus-marches", "heron-inlet"], agenda: "Rebuild floodgates and curb private banner tolls.", allies: ["tellmar-banners"], rivals: ["lantern-guilds"], forces: ["canal magistrates", "reed boat patrols"], description: "Engineers, magistrates, and academy clans administering the lower waterways." },
  { id: "asalan-sun-court", realmId: "south", name: "The Sun Court of Asalan", type: "oasis monarchy", leader: { name: "Sultana Maraset al-Azur", title: "Keeper of the Nine Wells" }, seatLandmarkId: "asalan", provinceIds: ["nine-wells", "glass-desert"], agenda: "Secure every public well and reopen the southern observatory road.", allies: ["nine-wells-league"], rivals: ["dune-raider-clans"], forces: ["Brass Shield Regiment", "well engineers", "sun lancers"], description: "The royal court whose authority rests on water law, caravan safety, and the Nine Wells." },
  { id: "nine-wells-league", realmId: "south", name: "Nine Wells Caravan League", type: "merchant league", leader: { name: "Tamar ibn Kes", title: "First Ledger" }, seatLandmarkId: "sirocco-wells", provinceIds: ["caravan-belt"], agenda: "Standardize water tablets and protect night markets.", allies: ["asalan-sun-court"], rivals: ["dune-raider-clans"], forces: ["contract guards", "camel scouts"], description: "Caravan masters and well towns coordinating freight across the open desert." },
  { id: "qamarat-tideguild", realmId: "south", name: "Qamarat Tideguild", type: "port oligarchy", leader: { name: "Nahla Blue-Sail", title: "Harbor Speaker" }, seatLandmarkId: "qamarat", provinceIds: ["saffron-coast"], agenda: "Keep the Saffron Sea lanes free of royal monopolies.", allies: ["nine-wells-league"], rivals: ["lantern-guilds"], forces: ["blue-sail marines", "harbor chains"], description: "Shipowners, pilots, and warehouse families governing the southern port." },
  { id: "selenyan-covenant", realmId: "west", name: "The Selenyan Covenant", type: "forest crown and grove council", leader: { name: "Queen Maerwynn Thorne", title: "Voice Beneath the Boughs" }, seatLandmarkId: "caer-selenya", provinceIds: ["selenyan-heart", "pale-boughs"], agenda: "Keep the old-growth roads living and foreign armies outside them.", allies: ["oak-spear-wardens"], rivals: ["sundered-crown"], forces: ["covenant archers", "path singers", "living bridge crews"], description: "The queen, grove councils, and hereditary path keepers of the Elderwood." },
  { id: "oak-spear-wardens", realmId: "west", name: "Oak-Spear Wardens", type: "border military order", leader: { name: "Ardan Mosscloak", title: "Green Marshal" }, seatLandmarkId: "greenward-gate", provinceIds: ["eastern-coppices"], agenda: "Contain blight and regulate every armed crossing into the wood.", allies: ["selenyan-covenant"], rivals: ["pale-hand"], forces: ["oak-spear companies", "forester scouts"], description: "A disciplined woodland border order maintaining Greenward and the eastern coppices." },
  { id: "greenharbor-guilds", realmId: "west", name: "Greenharbor Tide Guilds", type: "port guild compact", leader: { name: "Ilyen Rainwake", title: "Cove Provost" }, seatLandmarkId: "greenharbor", provinceIds: ["greenwater-coast"], agenda: "Expand sea trade without surrendering covenant forestry law.", allies: ["selenyan-covenant"], rivals: ["qamarat-tideguild"], forces: ["cove marines", "storm pilots"], description: "Shipwrights, resin merchants, pilots, and rain-port families." },
]);

export const PROVINCES = Object.freeze([
  { id: "crown-basin", realmId: "central", name: "Crown Basin", seatLandmarkId: "whitemarch", authorityFactionId: "whitemarch-iron", governor: { name: "Lady Merrow Vale", title: "Basin Chancellor" }, anchor: { x: 0, y: 0 }, influence: { scaleX: 90, scaleY: 75 }, regionIds: ["whitemarch", "mire"], terrainTags: ["river", "farmland", "urban"], resources: ["grain", "iron", "river clay"], settlementTypes: ["walled-city", "river-village"], hazards: ["spring flood", "crowded toll roads"], encounterTags: ["watch patrols", "market caravans"], cultureNotes: ["Crown law is posted at every bridge"], description: "The Whitewend basin, Whitemarch's walls, quays, gardens, and closest farming villages." },
  { id: "crowsmoor-reach", realmId: "central", name: "Crowsmoor Reach", seatLandmarkId: "crowsmoor", authorityFactionId: "crowsmoor-wardens", governor: { name: "Mara Crow", title: "First Warden" }, anchor: { x: 82, y: -8 }, influence: { scaleX: 85, scaleY: 65 }, regionIds: ["crowsmoor-reach", "whitemarch-march"], terrainTags: ["downs", "grain country", "open road"], resources: ["barley", "horses", "wool"], settlementTypes: ["freehold-town", "road-village"], hazards: ["flash grass fires", "toll disputes"], encounterTags: ["reeve patrols", "grain wagons"], cultureNotes: ["Freeholders elect road wardens each thaw"], description: "Open eastern grain country whose freeholds feed the capital and resent distant barons." },
  { id: "stonebrook-uplands", realmId: "central", name: "Stonebrook Uplands", seatLandmarkId: "stonebrook", authorityFactionId: "high-sheepway-guild", governor: { name: "Dorrin Stonebrook", title: "Roadmaster" }, anchor: { x: 95, y: 78 }, influence: { scaleX: 85, scaleY: 75 }, regionIds: ["spine-foothills"], terrainTags: ["foothills", "quarries", "high road"], resources: ["iron ore", "slate", "goat wool"], settlementTypes: ["mining-hold", "pass-town"], hazards: ["rockfall", "winter fog"], encounterTags: ["prospectors", "guild outriders"], cultureNotes: ["Contracts are witnessed with a struck stone"], description: "Mined ridges and sheep valleys clustered around the continent's safest eastern passes." },
  { id: "bramble-downs", realmId: "central", name: "Bramble Downs", seatLandmarkId: "bramblewych", authorityFactionId: "whitemarch-iron", governor: { name: "Ysabet Green", title: "Hedge Reeve" }, anchor: { x: -90, y: 70 }, influence: { scaleX: 85, scaleY: 72 }, regionIds: ["bramblewych-reach", "tannic-wood"], terrainTags: ["hedgerow", "orchard", "coppice"], resources: ["honey", "apples", "tannin"], settlementTypes: ["hedge-town", "orchard-village"], hazards: ["lost hedge paths", "river mist"], encounterTags: ["bee keepers", "woodward patrols"], cultureNotes: ["Boundary hedges are treated as public archives"], description: "A half-wild belt of orchards, working woods, and old boundary magic west of Whitemarch." },
  { id: "rime-crown", realmId: "north", name: "Rime Crown", seatLandmarkId: "northstar-castle", authorityFactionId: "vyrgun-drakekin", governor: { name: "Jarl Edda Northlight", title: "Crown Castellan" }, anchor: { x: 10, y: -330 }, influence: { scaleX: 105, scaleY: 82 }, regionIds: ["drakeholt-peaks"], terrainTags: ["glacier", "snowfield", "black peak"], resources: ["cold iron", "ice crystal", "furs"], settlementTypes: ["winter-hold", "glacier-fort"], hazards: ["whiteout", "ice quake"], encounterTags: ["frost patrols", "wyrm hunters"], cultureNotes: ["Every hall keeps a stranger's hearth bench"], description: "The high frozen basin around Northstar, cut by glaciers and watched by black volcanic peaks." },
  { id: "drake-marches", realmId: "north", name: "Drake Marches", seatLandmarkId: "drakespire", authorityFactionId: "vyrgun-drakekin", governor: { name: "Vara Smoke-Braid", title: "March Jarl" }, anchor: { x: 48, y: -240 }, influence: { scaleX: 105, scaleY: 82 }, regionIds: ["drakeholt-peaks"], terrainTags: ["volcanic ridge", "pine line", "tribute road"], resources: ["sulfur", "iron", "pine resin"], settlementTypes: ["tribute-fort", "ash-village"], hazards: ["wyrm flight", "ash storm"], encounterTags: ["drake riders", "tribute caravans"], cultureNotes: ["Smoke direction determines the market week"], description: "A militarized volcanic frontier controlling the passes below Drakespire." },
  { id: "sundered-snow", realmId: "north", name: "Sundered Snow", seatLandmarkId: "brokenhold", authorityFactionId: "sundered-crown", governor: { name: "Vrask Nine-Walls", title: "Crown-Taker" }, anchor: { x: -205, y: -255 }, influence: { scaleX: 120, scaleY: 90 }, regionIds: ["sundered-wastes"], terrainTags: ["wind waste", "ruined forts", "red snow"], resources: ["salvaged iron", "amber", "wolf hides"], settlementTypes: ["fort-town", "war-camp"], hazards: ["raider levy", "ground blizzard"], encounterTags: ["wolf sledges", "fortress levies"], cultureNotes: ["Captured gates are rebuilt into Brokenhold"], description: "A broad north-western waste where conquered fortresses form an unstable kingdom." },
  { id: "ember-lakes", realmId: "north", name: "Ember Lakes", seatLandmarkId: "wintermere", authorityFactionId: "wintermere-hearths", governor: { name: "Sava Emberhand", title: "Hearth Speaker" }, anchor: { x: -52, y: -295 }, influence: { scaleX: 110, scaleY: 78 }, regionIds: ["bonemarsh", "drakeholt-peaks"], terrainTags: ["hot spring", "frozen lake", "black fir"], resources: ["smoked fish", "medicinal moss", "amber"], settlementTypes: ["hot-spring-town", "lake-hold"], hazards: ["thin ice", "steam fog"], encounterTags: ["lake scouts", "hearth envoys"], cultureNotes: ["Public baths double as council chambers"], description: "Geothermal lakes and refuge towns holding the northern food reserves." },
  { id: "tellmar-delta", realmId: "east", name: "Tellmar Delta", seatLandmarkId: "tellmar", authorityFactionId: "tellmar-banners", governor: { name: "Ren Jiao", title: "Capital Intendant" }, anchor: { x: 418, y: 82 }, influence: { scaleX: 105, scaleY: 90 }, regionIds: ["tellmar-road"], terrainTags: ["canal", "lotus marsh", "urban delta"], resources: ["rice", "paper", "river fish"], settlementTypes: ["canal-city", "stilt-town"], hazards: ["monsoon flood", "canal fire"], encounterTags: ["river marines", "rice barges"], cultureNotes: ["Neighborhoods sponsor their own flood dragons"], description: "The dense lower delta of canals, academies, workshops, and banner compounds surrounding Tellmar." },
  { id: "lotus-marches", realmId: "east", name: "Lotus Marches", seatLandmarkId: "hanori", authorityFactionId: "lotus-prefecture", governor: { name: "Lin Aro", title: "Floodgate Prefect" }, anchor: { x: 270, y: 65 }, influence: { scaleX: 120, scaleY: 100 }, regionIds: ["tellmar-road", "iron-plateau"], terrainTags: ["reed sea", "terrace island", "causeway"], resources: ["rice", "tea", "reeds"], settlementTypes: ["terrace-town", "shrine-island"], hazards: ["reed fire", "floodgate failure"], encounterTags: ["canal magistrates", "scholar pilgrims"], cultureNotes: ["Floodgate duty rotates between villages"], description: "Endless productive wetlands threaded by raised roads and administered from Hanori." },
  { id: "starfall-uplands", realmId: "east", name: "Starfall Uplands", seatLandmarkId: "star-forge", authorityFactionId: "iron-plateau-marches", governor: { name: "Sen Varro", title: "March-Marshal" }, anchor: { x: 300, y: -95 }, influence: { scaleX: 125, scaleY: 95 }, regionIds: ["iron-plateau", "far-wild"], terrainTags: ["high grass", "meteor craters", "horse country"], resources: ["meteor iron", "horses", "copper"], settlementTypes: ["baronial-fort", "horse-town"], hazards: ["dry lightning", "border feud"], encounterTags: ["mirror cavalry", "forge pilgrims"], cultureNotes: ["Fallen stars belong first to the nearest village"], description: "Dry high country above the reed sea, famous for horses, signal towers, and star iron." },
  { id: "heron-inlet", realmId: "east", name: "Heron Inlet", seatLandmarkId: "lotusmouth", authorityFactionId: "lotus-prefecture", governor: { name: "Tao Min", title: "Inlet Admiral" }, anchor: { x: 470, y: 120 }, influence: { scaleX: 82, scaleY: 72 }, regionIds: ["tellmar-road"], terrainTags: ["tidal reeds", "harbor", "barrier island"], resources: ["salt fish", "pearls", "ship reeds"], settlementTypes: ["tide-port", "fishing-stilt-town"], hazards: ["typhoon", "shoal shift"], encounterTags: ["harbor pilots", "customs boats"], cultureNotes: ["Pilots memorize channels as sung genealogies"], description: "The tidal eastern margin where the reed rivers meet the Lantern Sea." },
  { id: "nine-wells", realmId: "south", name: "The Nine Wells", seatLandmarkId: "asalan", authorityFactionId: "asalan-sun-court", governor: { name: "Rasim al-Azur", title: "Warden of Wells" }, anchor: { x: 100, y: 295 }, influence: { scaleX: 105, scaleY: 85 }, regionIds: ["hollow-coast"], terrainTags: ["oasis", "red dune", "royal garden"], resources: ["dates", "copper", "spring water"], settlementTypes: ["oasis-city", "garden-town"], hazards: ["sand fever", "well intrigue"], encounterTags: ["sun lancers", "water judges"], cultureNotes: ["The ninth cup at any meal is reserved for a traveller"], description: "Asalan's royal oasis belt and the irrigated gardens fed by its nine ancient wells." },
  { id: "caravan-belt", realmId: "south", name: "Caravan Belt", seatLandmarkId: "sirocco-wells", authorityFactionId: "nine-wells-league", governor: { name: "Tamar ibn Kes", title: "First Ledger" }, anchor: { x: -15, y: 225 }, influence: { scaleX: 120, scaleY: 92 }, regionIds: ["hollow-coast", "far-wild"], terrainTags: ["gravel desert", "well road", "salt pan"], resources: ["salt", "camel wool", "incense"], settlementTypes: ["caravan-town", "well-fort"], hazards: ["dry well", "dune raiders"], encounterTags: ["contract guards", "night caravans"], cultureNotes: ["Water tablets are honored before coin"], description: "The chain of defended wells and night markets between Sunward and Asalan." },
  { id: "glass-desert", realmId: "south", name: "Glass Desert", seatLandmarkId: "glass-dune-observatory", authorityFactionId: "asalan-sun-court", governor: { name: "Samira Qel", title: "Royal Astronomer" }, anchor: { x: -55, y: 290 }, influence: { scaleX: 115, scaleY: 85 }, regionIds: ["hollow-coast", "far-wild"], terrainTags: ["glass dune", "rock desert", "observatory road"], resources: ["glass sand", "copper", "star charts"], settlementTypes: ["cliff-sanctuary", "scholar-camp"], hazards: ["glass storm", "mirage"], encounterTags: ["desert scholars", "relic diggers"], cultureNotes: ["Travel begins only after the dawn shadow is measured"], description: "Lightning-fused dunes and observatory outposts on the south-western heights." },
  { id: "saffron-coast", realmId: "south", name: "Saffron Coast", seatLandmarkId: "qamarat", authorityFactionId: "qamarat-tideguild", governor: { name: "Nahla Blue-Sail", title: "Harbor Speaker" }, anchor: { x: 105, y: 360 }, influence: { scaleX: 110, scaleY: 70 }, regionIds: ["hollow-coast"], terrainTags: ["warm coast", "salt cliff", "port"], resources: ["salt", "shell dye", "incense"], settlementTypes: ["sandstone-port", "cliff-village"], hazards: ["hot squall", "shoal wreck"], encounterTags: ["blue-sail marines", "spice factors"], cultureNotes: ["Harbor prices are proclaimed after the dawn wind"], description: "A warm southern littoral of cliff villages, spice warehouses, and blue-sailed ports." },
  { id: "selenyan-heart", realmId: "west", name: "Selenyan Heart", seatLandmarkId: "caer-selenya", authorityFactionId: "selenyan-covenant", governor: { name: "Oryn Silverleaf", title: "First Grove Speaker" }, anchor: { x: -410, y: 155 }, influence: { scaleX: 100, scaleY: 86 }, regionIds: ["witchwood-deep", "far-wild"], terrainTags: ["old growth", "living road", "tree city"], resources: ["rare herbs", "hardwood", "green dye"], settlementTypes: ["tree-city", "grove-sanctuary"], hazards: ["memory fog", "root heave"], encounterTags: ["path singers", "covenant archers"], cultureNotes: ["Public decisions are grafted into witness trees"], description: "The oldest inhabited forest around Caer Selenya and the covenant groves." },
  { id: "greenwater-coast", realmId: "west", name: "Greenwater Coast", seatLandmarkId: "greenharbor", authorityFactionId: "greenharbor-guilds", governor: { name: "Ilyen Rainwake", title: "Cove Provost" }, anchor: { x: -455, y: 125 }, influence: { scaleX: 82, scaleY: 76 }, regionIds: ["witchwood-deep"], terrainTags: ["rain coast", "cove", "ship forest"], resources: ["ship timber", "resin", "honey"], settlementTypes: ["rain-port", "cliff hamlet"], hazards: ["storm surge", "cliff fall"], encounterTags: ["storm pilots", "timber factors"], cultureNotes: ["Storm-fallen trees are auctioned before cut timber"], description: "Rain-beaten coves where forest roads descend to the Greenwater." },
  { id: "pale-boughs", realmId: "west", name: "Pale Boughs", seatLandmarkId: "mossmere", authorityFactionId: "selenyan-covenant", governor: { name: "Maela Hart", title: "Bough Warden" }, anchor: { x: -300, y: 80 }, influence: { scaleX: 120, scaleY: 95 }, regionIds: ["pale-steppe", "witchwood-deep"], terrainTags: ["birch forest", "open glade", "buried ruin"], resources: ["birch bark", "medicinal moss", "game"], settlementTypes: ["coppice-town", "glade-village"], hazards: ["walking paths", "pale blight"], encounterTags: ["forester guilds", "ruin seekers"], cultureNotes: ["Open glades are kept as neutral meeting ground"], description: "A lighter western forest grown across old grasslands and half-buried fortresses." },
  { id: "eastern-coppices", realmId: "west", name: "Eastern Coppices", seatLandmarkId: "greenward-gate", authorityFactionId: "oak-spear-wardens", governor: { name: "Ardan Mosscloak", title: "Green Marshal" }, anchor: { x: -190, y: 35 }, influence: { scaleX: 100, scaleY: 85 }, regionIds: ["witchwood-deep", "bramblewych-reach"], terrainTags: ["working woodland", "border keep", "coppice road"], resources: ["charcoal", "oak", "mushrooms"], settlementTypes: ["warden-fort", "coppice-village"], hazards: ["border skirmish", "forest fire"], encounterTags: ["oak-spear patrols", "charcoal burners"], cultureNotes: ["All armed visitors bind peace-cord at Greenward"], description: "The managed eastern forest and military approaches behind Greenward Gate." },
]);

export const PROVINCE_BY_ID = Object.freeze(Object.fromEntries(PROVINCES.map((province) => [province.id, province])));

// Region sites are low-detail cultural/ecological authorities. Their warped
// influence fields form irregular borders; they are not hard rectangles. The
// existing biome ids remain stable because saves, art, encounters, mounts, and
// difficulty already refer to them.
//
// `climate` biases the shared continental fields. `ecologyId` fixes each named
// region's physical identity; `terrain` then nudges variation within it. The
// cross-realm Far Wild intentionally retains macro-realm ecology fallbacks.
export const REGION_DEFINITIONS = {
  whitemarch: {
    id: "whitemarch", label: "Whitemarch Basin", faction: "whitemarch-iron", parentRealmIds: ["central"], ecologyId: "grassland",
    sites: [{
      x: 0,
      y: 0,
      scaleX: Math.max(Math.abs(WHITEMARCH_CAPITAL.bounds.xmin), Math.abs(WHITEMARCH_CAPITAL.bounds.xmax)) + 8,
      scaleY: Math.max(Math.abs(WHITEMARCH_CAPITAL.bounds.ymin), Math.abs(WHITEMARCH_CAPITAL.bounds.ymax)) + 8,
    }],
    cityBounds: { ...WHITEMARCH_CAPITAL.bounds },
    climate: { temperature: 0.02, moisture: 0.08, elevation: -0.08 },
    terrain: { forest: -0.18, marsh: -0.08, hills: -0.12 },
    poiChance: 0,
    areas: { prefixes: ["Whitewend", "Crown", "Pale", "Garden"], nouns: ["Basin", "Fields", "Reach", "Commons"] },
    features: ["wardstone", "fairground", "quarry", "wayside-shrine"],
  },
  mire: {
    id: "mire", label: "The Mire", faction: "crowsmoor-wardens", parentRealmIds: ["central"], ecologyId: "wetland",
    sites: [{ x: 4, y: 17, scaleX: 56, scaleY: 36 }],
    climate: { temperature: 0.03, moisture: 0.28, elevation: -0.24 },
    terrain: { forest: 0.02, marsh: 0.34, hills: -0.18 }, poiChance: 0.035,
    areas: { prefixes: ["Reed", "Sedge", "Peat", "Heron", "Stillwater"], nouns: ["Mere", "Fen", "Crossing", "Pools", "Levels"] },
    features: ["peat-camp", "ferry", "drowned-shrine", "reed-village"],
  },
  "crowsmoor-reach": {
    id: "crowsmoor-reach", label: "Crowsmoor Reach", faction: "crowsmoor-wardens", parentRealmIds: ["central"], ecologyId: "grassland",
    sites: [{ x: 86, y: -2, scaleX: 72, scaleY: 48 }],
    climate: { temperature: 0.02, moisture: -0.04, elevation: -0.02 },
    terrain: { forest: -0.12, marsh: -0.08, hills: -0.04 }, poiChance: 0.027,
    areas: { prefixes: ["Crow", "Barley", "Heron", "Longfield", "Greywall"], nouns: ["Reach", "Downs", "Pastures", "Crossroads", "Freeholds"] },
    features: ["freehold", "watch-post", "shepherd-camp", "roadside-inn"],
  },
  "tannic-wood": {
    id: "tannic-wood", label: "The Tannic Wood", faction: "wood-cult", parentRealmIds: ["central"], ecologyId: "oldgrowth",
    sites: [{ x: -38, y: -52, scaleX: 68, scaleY: 62 }],
    climate: { temperature: -0.04, moisture: 0.18, elevation: 0 },
    terrain: { forest: 0.30, marsh: 0.05, hills: 0.02 }, poiChance: 0.025,
    areas: { prefixes: ["Alder", "Birch", "Tannin", "Root", "Gloam"], nouns: ["Wood", "Glade", "Brake", "Hollow", "Ford"] },
    features: ["woodward-lodge", "root-ruin", "river-ford", "old-grove"],
  },
  "whitemarch-march": {
    id: "whitemarch-march", label: "Whitemarch March", faction: "whitemarch-iron", parentRealmIds: ["central"], ecologyId: "grassland",
    sites: [{ x: 50, y: -58, scaleX: 78, scaleY: 60 }],
    climate: { temperature: -0.02, moisture: -0.05, elevation: 0.10 },
    terrain: { forest: -0.05, marsh: -0.12, hills: 0.14 }, poiChance: 0.024,
    areas: { prefixes: ["Chalk", "Iron", "North", "Milestone", "Ram"], nouns: ["March", "Downs", "Ridge", "Sheepwalk", "Border"] },
    features: ["toll-fort", "quarry", "signal-combat", "fairground"],
  },
  "spine-foothills": {
    id: "spine-foothills", label: "The Spine Foothills", faction: "spine-confederation", parentRealmIds: ["central"], ecologyId: "upland",
    sites: [{ x: 82, y: 72, scaleX: 92, scaleY: 78 }],
    climate: { temperature: -0.08, moisture: -0.02, elevation: 0.27 },
    terrain: { forest: -0.03, marsh: -0.22, hills: 0.30 }, poiChance: 0.028,
    areas: { prefixes: ["Goat", "Redstone", "High", "Wind", "Stonebrook"], nouns: ["Fold", "Ridge", "Pass", "Shelf", "Vale"] },
    features: ["mine", "hill-shrine", "clan-camp", "dwarven-relay"],
  },
  "bramblewych-reach": {
    id: "bramblewych-reach", label: "Bramblewych Reach", faction: "bramble-witches", parentRealmIds: ["central", "west"], ecologyId: "woodland",
    sites: [{ x: -42, y: 68, scaleX: 76, scaleY: 68 }],
    climate: { temperature: 0.05, moisture: 0.14, elevation: -0.03 },
    terrain: { forest: 0.18, marsh: 0.10, hills: 0 }, poiChance: 0.028,
    areas: { prefixes: ["Briar", "Hedge", "Bee", "Greenshaw", "Thorn"], nouns: ["Reach", "Orchards", "Wych", "Hollow", "Commons"] },
    features: ["hedge-village", "witch-stone", "apiary", "abandoned-farm"],
  },
  bonemarsh: {
    id: "bonemarsh", label: "The Bonemarsh", faction: "pale-hand", parentRealmIds: ["central", "north"], ecologyId: "wetland",
    sites: [{ x: -105, y: -135, scaleX: 104, scaleY: 90 }],
    climate: { temperature: -0.15, moisture: 0.24, elevation: -0.18 },
    terrain: { forest: 0.02, marsh: 0.30, hills: -0.08 }, poiChance: 0.026,
    areas: { prefixes: ["Bone", "Black", "Cold", "Pale", "Tarn"], nouns: ["Marsh", "Mere", "Moor", "Pools", "Fen"] },
    features: ["barrow", "tarn-jetty", "bone-field", "hermit-cell"],
  },
  "sundered-wastes": {
    id: "sundered-wastes", label: "The Sundered Wastes", faction: "sundered-crown", parentRealmIds: ["north"], ecologyId: "badlands",
    sites: [{ x: -245, y: -165, scaleX: 150, scaleY: 112 }],
    climate: { temperature: -0.08, moisture: -0.24, elevation: 0.14 },
    terrain: { forest: -0.26, marsh: -0.28, hills: 0.26 }, poiChance: 0.024,
    areas: { prefixes: ["Broken", "Cinder", "Red", "Crownless", "Shatter"], nouns: ["Waste", "Mesa", "Cairns", "Scar", "Barrens"] },
    features: ["fortress-ruin", "war-camp", "cairn-field", "ash-well"],
  },
  "drakeholt-peaks": {
    id: "drakeholt-peaks", label: "The Drakeholt", faction: "vyrgun-drakekin", parentRealmIds: ["north"], ecologyId: "alpine",
    sites: [{ x: 18, y: -245, scaleX: 155, scaleY: 105 }],
    climate: { temperature: -0.32, moisture: -0.02, elevation: 0.38 },
    terrain: { forest: -0.12, marsh: -0.35, hills: 0.42 }, poiChance: 0.022,
    areas: { prefixes: ["Drake", "Smoke", "Rime", "Vyrgun", "Cloud"], nouns: ["Peaks", "Cols", "Teeth", "Shelf", "Crown"] },
    features: ["tribute-town", "wyrm-roost", "ice-cave", "hunter-lodge"],
  },
  "iron-plateau": {
    id: "iron-plateau", label: "The Iron Plateau", faction: "iron-plateau-marches", parentRealmIds: ["east"], ecologyId: "grassland",
    sites: [{ x: 178, y: -28, scaleX: 145, scaleY: 96 }],
    climate: { temperature: 0.02, moisture: -0.18, elevation: 0.20 },
    terrain: { forest: -0.20, marsh: -0.28, hills: 0.22 }, poiChance: 0.022,
    areas: { prefixes: ["Iron", "Horse", "Mirror", "Baron", "High"], nouns: ["Plateau", "Table", "Grasslands", "March", "Escarpment"] },
    features: ["manor-fort", "horse-fair", "signal-combat", "stone-village"],
  },
  "tellmar-road": {
    id: "tellmar-road", label: "The Sea of Reeds", faction: "tellmar-banners", parentRealmIds: ["east"], ecologyId: "reed-sea",
    sites: [{ x: 315, y: 62, scaleX: 172, scaleY: 116 }],
    climate: { temperature: 0.11, moisture: -0.08, elevation: 0.01 },
    terrain: { forest: -0.08, marsh: -0.18, hills: 0.02 }, poiChance: 0.026,
    areas: { prefixes: ["Banner", "Cypress", "Copper", "Longmile", "East"], nouns: ["Road", "Caravan-Ground", "Reach", "Ways", "Fields"] },
    features: ["caravanserai", "milestone-shrine", "banner-house", "market-town"],
  },
  "hollow-coast": {
    id: "hollow-coast", label: "The Sunscar Expanse", faction: "asalan-sun-court", parentRealmIds: ["south"], ecologyId: "desert",
    sites: [{ x: 35, y: 235, scaleX: 190, scaleY: 118 }],
    climate: { temperature: 0.20, moisture: 0.22, elevation: -0.20 },
    terrain: { forest: -0.02, marsh: 0.24, hills: -0.12 }, poiChance: 0.028,
    areas: { prefixes: ["Hollow", "Salt", "Tideless", "Grey", "Shell"], nouns: ["Coast", "Fens", "Beaches", "Inlets", "Levels"] },
    features: ["tide-shrine", "fishing-village", "saltworks", "drowned-ruin"],
  },
  "witchwood-deep": {
    id: "witchwood-deep", label: "The Elderwood", faction: "selenyan-covenant", parentRealmIds: ["west"], ecologyId: "oldgrowth",
    sites: [{ x: -145, y: 62, scaleX: 116, scaleY: 92 }],
    climate: { temperature: 0.02, moisture: 0.24, elevation: 0.02 },
    terrain: { forest: 0.38, marsh: 0.04, hills: 0.02 }, poiChance: 0.024,
    areas: { prefixes: ["Old", "Heart", "Moss", "Lantern", "Antler"], nouns: ["Deep", "Wood", "Gloom", "Tangle", "Halls"] },
    features: ["memory-tree", "sylvan-outpost", "moss-ruin", "witch-path"],
  },
  "pale-steppe": {
    id: "pale-steppe", label: "The Pale Steppe", faction: "free-folk", parentRealmIds: ["west"], ecologyId: "steppe",
    sites: [{ x: -305, y: 58, scaleX: 170, scaleY: 135 }],
    climate: { temperature: 0.05, moisture: -0.30, elevation: 0.02 },
    terrain: { forest: -0.32, marsh: -0.34, hills: 0.02 }, poiChance: 0.019,
    areas: { prefixes: ["Pale", "Lark", "Horse", "Longwind", "Ivory"], nouns: ["Steppe", "Grass-Sea", "Range", "Horizon", "Trail"] },
    features: ["nomad-camp", "standing-stones", "burial-mound", "deserted-well"],
  },
  "far-wild": {
    id: "far-wild", label: "The Far Wild", faction: "free-folk", parentRealmIds: ["north", "east", "south", "west"],
    sites: [
      { x: -360, y: -120, scaleX: 165, scaleY: 130 },
      { x: -355, y: 245, scaleX: 165, scaleY: 125 },
      { x: 265, y: 265, scaleX: 160, scaleY: 115 },
      { x: 385, y: -180, scaleX: 170, scaleY: 130 },
    ],
    climate: { temperature: 0, moisture: 0, elevation: 0.06 },
    terrain: { forest: 0, marsh: 0, hills: 0.06 }, poiChance: 0.018,
    areas: { prefixes: ["Aurora", "Glass", "Strange", "Star", "Last"], nouns: ["Wild", "Reach", "Meadows", "Frontier", "Silence"] },
    features: ["waystone", "crystal-field", "lost-camp", "unknown-ruin"],
  },
};

// Ecologies are physical biomes beneath the named cultural regions. A Tannic
// old-growth and a Witchwood old-growth share broad natural rules, while their
// regional feature/encounter layers still make them different places.
export const ECOLOGIES = {
  "open-sea": {
    id: "open-sea", name: "Open Sea", terrain: "water",
    description: "Deep water beyond any safe ford or ordinary road.",
    tags: ["marine", "deep-water"], resources: ["fish", "salt"], features: [], encounters: [],
  },
  "tidal-coast": {
    id: "tidal-coast", name: "Tidal Coast", terrain: "marsh",
    description: "Salt grass, shingle, tidal creeks, and wind-shaped scrub along Avarra's edge.",
    tags: ["coast", "salt", "wind"], resources: ["salt", "shellfish", "driftwood"],
    features: ["fishing-camp", "tide-shrine", "wreck"],
    encounters: [{ kind: "shore-foragers", weight: 7, posture: "friendly", desc: "shore-foragers returning with baskets of shellfish and wrack" }],
  },
  wetland: {
    id: "wetland", name: "Freshwater Wetland", terrain: "marsh",
    description: "Reed beds, black pools, wet meadow, and islands of firmer peat.",
    tags: ["wetland", "freshwater", "lowland"], resources: ["reeds", "peat", "medicinal-herbs"],
    features: ["reed-village", "drowned-shrine", "ferry", "peat-camp"],
    encounters: [{ kind: "reed-cutters", weight: 8, posture: "friendly", desc: "reed-cutters poling a shallow work-boat through the sedge" }],
  },
  grassland: {
    id: "grassland", name: "Temperate Grassland", terrain: "plains",
    description: "Open grazing country, flowered verges, field walls, and long sight-lines.",
    tags: ["grassland", "open", "pasture"], resources: ["grain", "wool", "game"],
    features: ["freehold", "shepherd-camp", "fairground", "standing-stones"],
    encounters: [{ kind: "drovers", weight: 8, posture: "friendly", desc: "drovers easing a mixed herd along the dry ground" }],
  },
  steppe: {
    id: "steppe", name: "Dry Steppe", terrain: "plains",
    description: "Dry grass, hardpan, thorn scrub, and enormous weather moving over an open horizon.",
    tags: ["steppe", "dry", "wind"], resources: ["grazing", "flint", "saltbush"],
    features: ["nomad-camp", "deserted-well", "burial-mound"],
    encounters: [{ kind: "ranging-herders", weight: 7, posture: "neutral", desc: "mounted herders watching their scattered stock from the rise" }],
  },
  woodland: {
    id: "woodland", name: "Temperate Woodland", terrain: "forest",
    description: "Mixed working woodland broken by glades, coppice, streams, and old paths.",
    tags: ["forest", "temperate", "worked"], resources: ["timber", "mushrooms", "game"],
    features: ["woodward-lodge", "old-grove", "charcoal-camp", "root-ruin"],
    encounters: [{ kind: "woodcutters", weight: 7, posture: "friendly", desc: "woodcutters stacking split alder beside a coppiced clearing" }],
  },
  oldgrowth: {
    id: "oldgrowth", name: "Old-Growth Forest", terrain: "forest",
    description: "Deep-canopied forest whose largest trees and oldest paths predate present borders.",
    tags: ["forest", "ancient", "gloom"], resources: ["rare-herbs", "hardwood", "game"],
    features: ["memory-tree", "moss-ruin", "hidden-grove", "hermit-cell"],
    encounters: [{ kind: "forest-wardens", weight: 6, posture: "neutral", desc: "silent forest wardens keeping pace beneath the trees" }],
  },
  upland: {
    id: "upland", name: "Broken Upland", terrain: "hills",
    description: "Ridges, folded valleys, exposed stone, and paths that climb more than maps admit.",
    tags: ["upland", "rock", "wind"], resources: ["stone", "ore", "goats"],
    features: ["mine", "hill-shrine", "watch-post", "quarry"],
    encounters: [{ kind: "prospectors", weight: 7, posture: "friendly", desc: "prospectors comparing fresh stone samples beside a pack mule" }],
  },
  alpine: {
    id: "alpine", name: "Alpine Heights", terrain: "mountains",
    description: "Bare peaks, scree, high cols, snow pockets, and sudden killing weather.",
    tags: ["mountain", "alpine", "cold"], resources: ["ore", "ice", "rare-stone"],
    features: ["ice-cave", "high-shrine", "abandoned-mine", "roost"],
    encounters: [{ kind: "ridge-hunters", weight: 5, posture: "neutral", desc: "ridge-hunters moving single-file beneath the cloud line" }],
  },
  tundra: {
    id: "tundra", name: "Cold Heath", terrain: "plains",
    description: "Low heath, frost-broken soil, dwarf scrub, and snow held in every hollow.",
    tags: ["cold", "heath", "treeless"], resources: ["lichen", "fur", "bog-iron"],
    features: ["hunter-lodge", "cairn-field", "hot-spring", "waystone"],
    encounters: [{ kind: "winter-trappers", weight: 6, posture: "friendly", desc: "winter trappers hauling a low sledge over the heath" }],
  },
  snowfield: {
    id: "snowfield", name: "Snowfield", terrain: "plains",
    description: "Wind-carved snow, frozen heath, black fir islands, and old ice roads beneath the Frostcrown.",
    tags: ["snow", "frozen", "winter"], resources: ["fur", "ice", "cold-iron"],
    features: ["winter-watch", "ice-cave", "hunter-lodge", "snowbound-shrine"],
    encounters: [{ kind: "frostcrown-patrol", weight: 7, posture: "neutral", desc: "fur-mantled Frostcrown riders checking the winter road" }],
  },
  desert: {
    id: "desert", name: "Sunscar Desert", terrain: "plains",
    description: "Dune seas, gravel plains, salt pans, and caravan tracks joining defended wells beneath a white sun.",
    tags: ["desert", "arid", "hot"], resources: ["salt", "dates", "glass-sand"],
    features: ["caravanserai", "guarded-well", "dune-shrine", "buried-ruin"],
    encounters: [{ kind: "sunscar-caravan", weight: 8, posture: "friendly", desc: "a bright-awning caravan moving between guarded wells" }],
  },
  "reed-sea": {
    id: "reed-sea", name: "Sea of Reeds", terrain: "reedfield",
    description: "Reed oceans, lotus channels, raised causeways, terraced islands, and slow rivers leading to the Lantern Sea.",
    tags: ["reeds", "river", "monsoon"], resources: ["rice", "reeds", "freshwater-fish"],
    features: ["stilt-village", "moon-bridge", "river-shrine", "watch-pagoda"],
    encounters: [{ kind: "banner-river-patrol", weight: 8, posture: "neutral", desc: "a lacquered patrol boat gliding beside the raised road" }],
  },
  badlands: {
    id: "badlands", name: "Stony Badlands", terrain: "hills",
    description: "Dry gullies, mesas, rubble fans, and sparse thorn around unreliable wells.",
    tags: ["dry", "rock", "scarce-water"], resources: ["clay", "copper", "flint"],
    features: ["ash-well", "fortress-ruin", "cairn-field", "lost-camp"],
    encounters: [{ kind: "well-keepers", weight: 5, posture: "neutral", desc: "armed well-keepers waiting beside a rope-dark cistern" }],
  },
};

// Generated sites use a small set of reviewed mechanical archetypes. Region and
// ecology choose the concrete motif (`peat-camp`, `wyrm-roost`, `apiary`, ...),
// while the archetype fixes what kind of place it is and the facts narration is
// allowed to reveal. The model may phrase these facts; it does not invent the
// site's identity from nothing.
export const SITE_ARCHETYPES = {
  settlement: {
    id: "settlement", minimumSpacingHexes: 3,
    poiType: "village",
    tags: ["inhabited", "shelter"],
    description: "A small inhabited community shaped by the materials, work, and seasonal pressures of its region.",
  },
  camp: {
    id: "camp", minimumSpacingHexes: 3,
    poiType: "camp",
    tags: ["temporary", "shelter"],
    description: "A used camp with work areas, shelter, and signs of the people who return to it.",
  },
  clearing: {
    id: "clearing", minimumSpacingHexes: 3,
    poiType: "landmark",
    tags: ["open-ground", "shelter", "forage"],
    description: "An open clearing in the surrounding growth, used by wildlife and travellers as a natural gathering place.",
  },
  den: {
    id: "den", minimumSpacingHexes: 4,
    poiType: "monster-den",
    tags: ["lair", "hostile", "exploration"],
    description: "A predator's established lair, marked by tracks, remains, and defended approaches.",
  },
  "bandit-camp": {
    id: "bandit-camp", minimumSpacingHexes: 4,
    poiType: "bandit-camp",
    tags: ["outlaw", "hostile", "shelter"],
    description: "A concealed outlaw camp positioned to watch travellers, settlements, or valuable traffic.",
  },
  "roadside-inn": {
    id: "roadside-inn", minimumSpacingHexes: 5,
    poiType: "inn",
    tags: ["inhabited", "roadside", "shelter"],
    description: "A licensed roadside inn offering beds, hot food, stable space, and local news to travellers.",
  },
  shrine: {
    id: "shrine", minimumSpacingHexes: 3,
    poiType: "shrine",
    tags: ["sacred", "landmark"],
    description: "A maintained place of observance whose offerings and construction follow a local practice.",
  },
  ruin: {
    id: "ruin", minimumSpacingHexes: 3,
    poiType: "ruin",
    tags: ["old", "exploration"],
    description: "An abandoned built place with a legible former purpose and traces worth investigating.",
  },
  resource: {
    id: "resource", minimumSpacingHexes: 3,
    poiType: "landmark",
    tags: ["work", "resource"],
    description: "A worked natural resource with tools, spoil, paths, and local claims attached to it.",
  },
  crossing: {
    id: "crossing", minimumSpacingHexes: 3,
    poiType: "landmark",
    tags: ["route", "crossing"],
    description: "A practical crossing where paths, water, and travellers regularly meet.",
  },
  fortification: {
    id: "fortification", minimumSpacingHexes: 3,
    poiType: "fortress",
    tags: ["defended", "authority"],
    description: "A small defended work controlling a route, boundary, or valuable approach.",
  },
  wonder: {
    id: "wonder", minimumSpacingHexes: 3,
    poiType: "landmark",
    tags: ["unusual", "exploration"],
    description: "A rare natural or magical feature with observable signs and a history people argue about.",
  },
};

// Concrete motifs named by REGION_DEFINITIONS.features and ECOLOGIES.features.
// Each entry binds a motif slug to the archetype that fixes its mechanical
// identity and to the terrains that can plausibly carry it. A motif with no
// `terrains` is allowed on any land terrain; `routeOnly` motifs require a road.
// Region motifs outrank ecology motifs so the Mire reads as the Mire even where
// its wetland ecology is shared with the Bonemarsh.
// `description` states what the place is. It replaces the archetype's generic
// line so a reed village and a freehold do not read identically, and it is the
// factual ground narration is permitted to phrase but not contradict.
export const SITE_MOTIFS = Object.freeze({
  // Inhabited communities
  "reed-village": Object.freeze({ family: "settlement", terrains: Object.freeze(["marsh", "reedfield"]), description: "Thatched houses stand on raised platforms of packed peat, linked by plank walks above the waterline." }),
  freehold: Object.freeze({ family: "settlement", terrains: Object.freeze(["plains"]), description: "A cluster of landholding families work their own strips and answer to no lord nearer than the capital." }),
  "hedge-village": Object.freeze({ family: "settlement", terrains: Object.freeze(["plains", "forest"]), description: "The houses sit inside a grown hedge thick enough to turn cattle, with one gap kept as a gate." }),
  "tribute-town": Object.freeze({ family: "settlement", terrains: Object.freeze(["hills", "mountains"]), description: "A hill town that pays its dues in ore and wool, with a weighing floor at the centre and a tally house beside it." }),
  "stone-village": Object.freeze({ family: "settlement", terrains: Object.freeze(["plains", "hills"]), description: "Every wall and roof here is cut stone, quarried close by and fitted without mortar." }),
  "market-town": Object.freeze({ family: "settlement", terrains: Object.freeze(["plains", "road"]), description: "A chartered market square with a covered cross at its centre, busy on its day and quiet the rest of the week." }),
  "fishing-village": Object.freeze({ family: "settlement", terrains: Object.freeze(["marsh", "plains"]), description: "Boats are drawn up along the bank and nets hang to dry between the houses on frames taller than the roofs." }),
  "sylvan-outpost": Object.freeze({ family: "settlement", terrains: Object.freeze(["forest"]), description: "Timber halls are built into the standing trees rather than a clearing, so the settlement is invisible until entered." }),
  "stilt-village": Object.freeze({ family: "settlement", terrains: Object.freeze(["reedfield", "marsh"]), description: "The whole village stands on driven piles above open water, reached by ladder and punt." }),
  "banner-house": Object.freeze({ family: "settlement", terrains: Object.freeze(["plains", "reedfield", "road"]), description: "A sworn household holds this ground for its banner lord, with a hall, a muster yard, and tenants close by." }),

  // Working and temporary camps
  "peat-camp": Object.freeze({ family: "camp", terrains: Object.freeze(["marsh"]), description: "Cutters work the peat bank in summer from turf shelters, and the drying stacks stand in rows behind them." }),
  "shepherd-camp": Object.freeze({ family: "camp", terrains: Object.freeze(["plains", "hills"]), description: "A seasonal camp on the grazing route, with a hurdled fold, a fire pit, and dogs that hear you first." }),
  "clan-camp": Object.freeze({ family: "camp", terrains: Object.freeze(["hills", "mountains"]), description: "Hide tents are pitched in a ring around the clan's fire, with the herd held on the slope above." }),
  "war-camp": Object.freeze({ family: "camp", terrains: Object.freeze(["plains", "hills"]), description: "A ditched and palisaded camp laid out in lanes, holding armed companies between one march and the next." }),
  "nomad-camp": Object.freeze({ family: "camp", terrains: Object.freeze(["plains"]), description: "Round felt tents stand where the grazing is good this month, and will be somewhere else next month." }),
  "lost-camp": Object.freeze({ family: "camp", description: "A camp still standing with its gear in place, left by people who did not come back for it." }),
  "hunter-lodge": Object.freeze({ family: "camp", terrains: Object.freeze(["forest", "hills", "plains"]), description: "A low lodge used through the hunting season, with racks for hanging game and a smoking shed behind." }),
  "charcoal-camp": Object.freeze({ family: "camp", terrains: Object.freeze(["forest"]), description: "Burners live beside their smouldering stacks for the length of each burn, sleeping in shelters of turf and bough." }),
  "fishing-camp": Object.freeze({ family: "camp", terrains: Object.freeze(["marsh", "plains"]), description: "A working camp on the bank with drying racks, a salting barrel, and boats pulled clear of the water." }),
  "woodward-lodge": Object.freeze({ family: "camp", terrains: Object.freeze(["forest"]), description: "The woodward keeps this lodge to watch the timber, mark the cutting, and know who is in the trees." }),
  "hermit-cell": Object.freeze({ family: "camp", terrains: Object.freeze(["forest", "hills", "mountains", "marsh"]), description: "One person lives here alone by choice, in a cell of stone and turf with a garden and a water source." }),

  // Open gathering ground
  "old-grove": Object.freeze({ family: "clearing", terrains: Object.freeze(["forest"]), description: "Trees far older than the surrounding wood stand widely spaced over clear ground, and nothing has been cut here." }),
  "hidden-grove": Object.freeze({ family: "clearing", terrains: Object.freeze(["forest"]), description: "A clearing screened on every side by thicket, reached through one gap that has to be known about." }),
  fairground: Object.freeze({ family: "clearing", terrains: Object.freeze(["plains"]), description: "Open ground kept clear for the yearly fair, marked by post holes, a stone platform, and grass grazed short." }),
  "horse-fair": Object.freeze({ family: "clearing", terrains: Object.freeze(["plains"]), description: "A long straight run of turf where horses are shown at speed, with pens and a judging stand at one end." }),

  // Lairs
  "wyrm-roost": Object.freeze({ family: "den", terrains: Object.freeze(["mountains", "hills"]), description: "A high ledge fouled with scale and bone, and the rock beneath it scorched in long streaks." }),
  roost: Object.freeze({ family: "den", terrains: Object.freeze(["mountains", "hills"]), description: "Something large nests on the crag and hunts from it, and the ground below is littered with what it drops." }),
  "ice-cave": Object.freeze({ family: "den", terrains: Object.freeze(["mountains", "hills"]), description: "A cave floored in old blue ice, warm enough at the back that something has chosen to den in it." }),

  // Licensed road lodging
  caravanserai: Object.freeze({ family: "roadside-inn", routeOnly: true, description: "A walled yard with stabling on all four sides, water, and rooms above, kept open for whole caravans at once." }),

  // Places of observance
  "wayside-shrine": Object.freeze({ family: "shrine", description: "A roofed niche at the roadside holding a figure, a ledge of offerings, and a stub of candle." }),
  "drowned-shrine": Object.freeze({ family: "shrine", terrains: Object.freeze(["marsh", "reedfield"]), description: "The shrine stands in standing water to the height of its altar, still tended by people who wade to it." }),
  "hill-shrine": Object.freeze({ family: "shrine", terrains: Object.freeze(["hills", "mountains"]), description: "A shrine on the crest, walled against the wind, sited so it can be seen from the whole valley." }),
  "tide-shrine": Object.freeze({ family: "shrine", terrains: Object.freeze(["marsh", "plains"]), description: "A shrine reachable only between tides, with the water's height cut into the doorpost year by year." }),
  "milestone-shrine": Object.freeze({ family: "shrine", terrains: Object.freeze(["road", "plains"]), description: "A shrine built onto the milestone itself, so travellers count distance and give thanks in one stop." }),
  "high-shrine": Object.freeze({ family: "shrine", terrains: Object.freeze(["mountains"]), description: "A shrine at the top of a cut stair, above the treeline, hung with offerings that the wind has bleached." }),
  "snowbound-shrine": Object.freeze({ family: "shrine", terrains: Object.freeze(["plains", "hills"]), description: "The shrine is built tall and narrow so its roof stays clear when the drifts close over everything else." }),
  "dune-shrine": Object.freeze({ family: "shrine", terrains: Object.freeze(["plains"]), description: "A shrine half buried and dug out again each season, its threshold swept clean by whoever passes." }),
  "river-shrine": Object.freeze({ family: "shrine", terrains: Object.freeze(["reedfield", "marsh", "plains"]), description: "A shrine at the water's edge where boats are blessed before a crossing and coins go into the current." }),
  "witch-path": Object.freeze({ family: "shrine", terrains: Object.freeze(["forest", "marsh"]), description: "A marked path of pale stones leads off the road to a place local people visit and do not discuss." }),

  // Abandoned works
  "root-ruin": Object.freeze({ family: "ruin", terrains: Object.freeze(["forest"]), description: "Walls stand only where roots have gripped them, and the trees have taken the rest apart stone by stone." }),
  "fortress-ruin": Object.freeze({ family: "ruin", terrains: Object.freeze(["hills", "plains", "mountains"]), description: "A curtain wall and one broken combat remain of a fortress that commanded this ground for someone." }),
  "moss-ruin": Object.freeze({ family: "ruin", terrains: Object.freeze(["forest"]), description: "Every surface is under moss so deep the building reads as a set of green mounds until you touch it." }),
  "drowned-ruin": Object.freeze({ family: "ruin", terrains: Object.freeze(["marsh", "plains"]), description: "Roof ridges and chimney stacks stand above still water where the ground gave way and the settlement went under." }),
  "unknown-ruin": Object.freeze({ family: "ruin", description: "Worked stone in a plan nobody local can account for, in a style that matches nothing standing nearby." }),
  "buried-ruin": Object.freeze({ family: "ruin", terrains: Object.freeze(["plains", "hills"]), description: "A doorhead and the top of a wall break the turf, with the rest of the building still under the field." }),
  "abandoned-farm": Object.freeze({ family: "ruin", terrains: Object.freeze(["plains"]), description: "The steading stands roofless with its yard walls intact and its fields gone back to thorn." }),
  "abandoned-mine": Object.freeze({ family: "ruin", terrains: Object.freeze(["hills", "mountains"]), description: "An adit is cut into the hillside above a spoil heap, timbered at the mouth and dark past that." }),
  wreck: Object.freeze({ family: "ruin", terrains: Object.freeze(["marsh", "plains"]), description: "A ship's ribs stand out of the ground far from any water deep enough to have floated it." }),
  barrow: Object.freeze({ family: "ruin", terrains: Object.freeze(["plains", "hills"]), description: "A long turfed mound with a kerb of set stones and a blocked entrance at the eastern end." }),
  "burial-mound": Object.freeze({ family: "ruin", terrains: Object.freeze(["plains"]), description: "A round mound raised over someone who mattered, standing alone in worked country nobody ploughs." }),
  "bone-field": Object.freeze({ family: "ruin", terrains: Object.freeze(["marsh", "plains"]), description: "Bones lie across open ground in the quantity of a battle, weathered white and never gathered up." }),
  "cairn-field": Object.freeze({ family: "ruin", terrains: Object.freeze(["plains", "hills", "mountains"]), description: "Dozens of stone piles stand across the slope, each one raised over something, in no pattern that reads." }),

  // Worked resources
  quarry: Object.freeze({ family: "resource", terrains: Object.freeze(["hills", "mountains"]), description: "A working stone face with a crane, a sledge track, and squared blocks waiting to be moved." }),
  mine: Object.freeze({ family: "resource", terrains: Object.freeze(["hills", "mountains"]), description: "A worked adit with a winding drum at the head, sorting floors outside, and a shift underground now." }),
  apiary: Object.freeze({ family: "resource", terrains: Object.freeze(["plains", "forest"]), description: "Straw skeps stand in a sheltered row on a stone bench, with a smoker and veil left hanging beside them." }),
  saltworks: Object.freeze({ family: "resource", terrains: Object.freeze(["marsh", "plains"]), description: "Shallow pans are cut and clay-lined to evaporate brine, with a boiling house and a salt store behind." }),
  "ash-well": Object.freeze({ family: "resource", terrains: Object.freeze(["hills", "plains"]), description: "A deep well sunk through dry ground, its rope dark with use and its water reliable in a country where that is rare." }),
  "deserted-well": Object.freeze({ family: "resource", terrains: Object.freeze(["plains"]), description: "A stone wellhead with the winding gear gone and the shaft open, standing where a settlement used to be." }),
  "guarded-well": Object.freeze({ family: "resource", terrains: Object.freeze(["plains"]), description: "The well is walled, roofed, and watched, and the people watching it decide who draws from it." }),
  "crystal-field": Object.freeze({ family: "resource", terrains: Object.freeze(["mountains", "hills", "plains"]), description: "Crystal breaks through the ground across a wide slope, worked over by pickers for the pieces worth carrying." }),

  // Practical crossings
  ferry: Object.freeze({ family: "crossing", terrains: Object.freeze(["marsh", "reedfield"]), description: "A flat ferry runs on a fixed rope between two landings, worked by a family who charge by the head." }),
  "river-ford": Object.freeze({ family: "crossing", terrains: Object.freeze(["forest", "plains", "hills"]), description: "A gravel shallows wide enough to take carts, with depth stakes painted on both banks." }),
  "tarn-jetty": Object.freeze({ family: "crossing", terrains: Object.freeze(["marsh"]), description: "A timber jetty runs out to water deep enough to float a boat, with a bell on a post at the shore end." }),
  "moon-bridge": Object.freeze({ family: "crossing", terrains: Object.freeze(["reedfield", "marsh"]), description: "A steeply arched bridge of pale stone rises high enough for boats to pass beneath it fully rigged." }),

  // Small defended works
  "toll-fort": Object.freeze({ family: "fortification", terrains: Object.freeze(["road", "plains"]), description: "A small fort astride the road with a lowered bar, a tariff board, and a garrison that collects." }),
  "watch-post": Object.freeze({ family: "fortification", terrains: Object.freeze(["hills", "plains"]), description: "A walled post on high ground holding a handful of soldiers whose work is to see and report." }),
  "signal-combat": Object.freeze({ family: "fortification", terrains: Object.freeze(["hills", "plains", "mountains"]), description: "A combat built for line of sight to the next combat, with a beacon on the roof and fuel stacked below." }),
  "manor-fort": Object.freeze({ family: "fortification", terrains: Object.freeze(["plains", "hills"]), description: "A fortified manor with a hall inside a curtain wall, farmed and defended by the same household." }),
  "winter-watch": Object.freeze({ family: "fortification", terrains: Object.freeze(["plains", "hills"]), description: "A garrison built for the cold season, stocked to hold out until thaw and shuttered the rest of the year." }),
  "watch-pagoda": Object.freeze({ family: "fortification", terrains: Object.freeze(["reedfield", "marsh"]), description: "A tiered timber combat on piles, each storey stepping in, giving sight over reed too tall to see across." }),
  "dwarven-relay": Object.freeze({ family: "fortification", terrains: Object.freeze(["mountains", "hills"]), description: "A cut-stone relay station keyed into the mountainside, holding a road crew, a forge, and a sealed door." }),

  // Standing curiosities
  wardstone: Object.freeze({ family: "wonder", description: "A carved stone set to hold a boundary, its inscription maintained by whoever benefits from the boundary." }),
  waystone: Object.freeze({ family: "wonder", description: "A standing stone cut with directions and distances, older than the road that now passes it." }),
  "witch-stone": Object.freeze({ family: "wonder", terrains: Object.freeze(["plains", "forest", "marsh"]), description: "A stone with a natural hole worn through it, hung about with cloth and small offerings." }),
  "standing-stones": Object.freeze({ family: "wonder", terrains: Object.freeze(["plains", "hills"]), description: "Stones set upright in a deliberate arrangement, aligned on something that no longer obviously matters." }),
  "memory-tree": Object.freeze({ family: "wonder", terrains: Object.freeze(["forest"]), description: "One enormous tree hung with name-tokens, each left by a family for someone they intend to be remembered." }),
  "hot-spring": Object.freeze({ family: "wonder", terrains: Object.freeze(["hills", "mountains", "plains"]), description: "Water comes up hot enough to steam in cold air, pooled behind a low wall built to hold it." }),
});

// Campaign seeds may rearrange these small discoveries, but never authored
// biomes, waterways, roads, cities, province borders, or faction territories.
// These remain available everywhere so danger and lodging never depend on a
// region happening to name them; regional motifs above are layered on top.
export const CAMPAIGN_MINOR_SITE_FEATURES = Object.freeze([
  Object.freeze({ kind: "woodland-clearing", family: "clearing", terrains: Object.freeze(["forest"]), description: "Open ground in the trees, grazed short and ringed by the fire scars of everyone who has camped here." }),
  Object.freeze({ kind: "monster-den", family: "den", terrains: Object.freeze(["forest", "hills", "mountains", "marsh", "reedfield"]), description: "A lair with a beaten approach, gnawed bone worked into the ground, and a smell that carries downwind." }),
  Object.freeze({ kind: "bandit-camp", family: "bandit-camp", terrains: Object.freeze(["plains", "forest", "hills", "mountains", "marsh", "reedfield", "road"]), description: "A screened camp sited to watch the road without being seen from it, with a lookout and a way out behind." }),
  Object.freeze({ kind: "roadside-inn", family: "roadside-inn", routeOnly: true, description: "An inn on the road with stabling, a common room, and beds let by the mattress rather than the room." }),
  Object.freeze({ kind: "wayward-shrine", family: "shrine", description: "A small shrine kept by no one in particular and maintained anyway, its offerings replaced by passing strangers." }),
  Object.freeze({ kind: "forgotten-ruin", family: "ruin", description: "Standing walls with the roof long gone, cleared of anything portable and left to the weather." }),
  Object.freeze({ kind: "frontier-fort", family: "fortification", description: "A timber and earth fort holding a stretch of border, with a ditch, a gate combat, and a small garrison." }),
]);

export const BORDER_CHECKPOINTS = Object.freeze([
  Object.freeze({
    id: "frostgate", name: "Frostgate Redoubt", coord: Object.freeze({ x: 5, y: -165 }),
    realmIds: Object.freeze(["central", "north"]), routeIds: Object.freeze(["north-road"]),
    controllingFactionId: "vyrgun-drakekin", garrison: "The White Pike Legion",
    description: "A double-walled military customs fort where winter troops inspect every traveller bound for the Frostcrown.",
  }),
  Object.freeze({
    id: "wolfsnow-redoubt", name: "Wolfsnow Redoubt", coord: Object.freeze({ x: -132, y: -154 }),
    realmIds: Object.freeze(["central", "north"]), routeIds: Object.freeze(["tannic-road"]),
    controllingFactionId: "sundered-crown", garrison: "The Red Tusk Cohort",
    description: "A hard northern checkpoint controlling the Alder Road's dangerous north-western crossing.",
  }),
  Object.freeze({
    id: "reedwatch", name: "Reedwatch Bastion", coord: Object.freeze({ x: 175, y: -5 }),
    realmIds: Object.freeze(["central", "east"]), routeIds: Object.freeze(["crown-road-east", "spine-road", "star-road"]),
    controllingFactionId: "tellmar-banners", garrison: "The Azure Heron Banner",
    description: "A tiled border fortress whose raised gates command the first causeways into the Sea of Reeds.",
  }),
  Object.freeze({
    id: "sunward-bastion", name: "Sunward Bastion", coord: Object.freeze({ x: -15, y: 170 }),
    realmIds: Object.freeze(["central", "south"]), routeIds: Object.freeze(["south-road"]),
    controllingFactionId: "asalan-sun-court", garrison: "The Brass Shield Regiment",
    description: "A sandstone checkpoint guarding the first permanent wells and recording every caravan entering the Sunscar.",
  }),
  Object.freeze({
    id: "greenward-gate", name: "Greenward Gate", coord: Object.freeze({ x: -170, y: 30 }),
    realmIds: Object.freeze(["central", "west"]), routeIds: Object.freeze(["bramble-road"]),
    controllingFactionId: "selenyan-covenant", garrison: "The Oak-Spear Wardens",
    description: "A timber-and-stone border keep where covenant wardens prevent armies and blight from entering the Elderwood.",
  }),
]);

const CHECKPOINT_LANDMARKS = BORDER_CHECKPOINTS.map((checkpoint) => ({
  ...checkpoint,
  knowledge: "rumor",
  kind: "fortress",
  role: "border-checkpoint",
  regionId: checkpoint.id === "frostgate" ? "drakeholt-peaks"
    : checkpoint.id === "wolfsnow-redoubt" ? "sundered-wastes"
      : checkpoint.id === "reedwatch" ? "iron-plateau"
        : checkpoint.id === "sunward-bastion" ? "hollow-coast"
          : "witchwood-deep",
  realmId: checkpoint.realmIds[1],
  direction: checkpoint.realmIds[1] === "north" ? "far north"
    : checkpoint.realmIds[1] === "east" ? "far east"
      : checkpoint.realmIds[1] === "south" ? "far south" : "far west",
}));

export const LANDMARKS = [
  // Heartland anchors remain useful early destinations without pretending the
  // cardinal realms are nearby. Every passable place below lies on a named road.
  { id: "mirecross", name: "Mirecross", knowledge: "rumor", kind: "village", coord: { x: 55, y: 10 }, regionId: "mire", realmId: "central", direction: "east", description: "A peat-and-reed village where the Crown Road climbs onto its first long causeway." },
  { id: "tannic-ford", name: "Tannic Ford", knowledge: "rumor", kind: "village", coord: { x: -55, y: -55 }, regionId: "tannic-wood", realmId: "central", direction: "north-west", description: "A woodward and ferry community where brown water slides under alder roots." },
  { id: "crowsmoor", name: "Crowsmoor", knowledge: "rumor", kind: "town", coord: { x: 90, y: -5 }, regionId: "crowsmoor-reach", realmId: "central", direction: "east", description: "A slate-roofed freehold town and the last great grain market before Reedwatch." },
  { id: "halfborn-hold", name: "The Halfborn Hold", knowledge: "rumor", kind: "fortress", coord: { x: 80, y: 60 }, regionId: "spine-foothills", realmId: "central", direction: "south-east", description: "A sanctuary-fort whose open gate protects caravans on the High Sheepway." },
  { id: "pale-shrine", name: "Shrine of the Pale God", knowledge: "rumor", kind: "shrine", coord: { x: 42, y: 22 }, regionId: "mire", realmId: "central", direction: "east", description: "A quiet hospice beside a cold spring where seven-day servants keep watch." },
  { id: "greenshaw", name: "Greenshaw", knowledge: "rumor", kind: "village", coord: { x: -70, y: 75 }, regionId: "bramblewych-reach", realmId: "central", direction: "south-west", description: "Garden plots, bee-skeps, and turf-roofed homes hidden inside a patient hedge maze." },
  { id: "stonebrook", name: "Stonebrook Hold", knowledge: "rumor", kind: "town", coord: { x: 105, y: 75 }, regionId: "spine-foothills", realmId: "central", direction: "south-east", description: "A dwarven mining hold around a fast stream, known for fair weights and excellent steel." },
  { id: "heron-combat", name: "The Heron Archetype", knowledge: "rumor", kind: "combat", coord: { x: 135, y: 40 }, regionId: "spine-foothills", realmId: "central", direction: "east", description: "A white-heralded sorcerer's combat watching the roads that converge on Reedwatch." },
  { id: "black-tarn", name: "Black Tarn", knowledge: "rumor", kind: "lake", coord: { x: -115, y: -105 }, regionId: "bonemarsh", realmId: "central", direction: "north-west", description: "A cold inland tarn whose wind smells of peat cellars and rain." },
  { id: "bramblewych", name: "Bramblewych", knowledge: "rumor", kind: "town", coord: { x: -105, y: 75 }, regionId: "bramblewych-reach", realmId: "central", direction: "south-west", description: "A hedge-court market town on the long road to the western forest." },
  ...CHECKPOINT_LANDMARKS,

  // Realm capitals, ports, and campaign-scale landmarks are separated from
  // Whitemarch by hundreds of six-kilometre hexes.
  { id: "brokenhold", name: "Brokenhold", knowledge: "legend", kind: "fortress", coord: { x: -205, y: -260 }, regionId: "sundered-wastes", realmId: "north", provinceId: "sundered-snow", factionId: "sundered-crown", routeIds: ["tannic-road", "sundered-march"], direction: "far north-west", description: "The many-walled seat of the Sundered Crown, rebuilt from conquered fortresses in the snow." },
  { id: "northstar-castle", name: "Northstar", knowledge: "legend", kind: "city", coord: { x: 8, y: -332 }, regionId: "drakeholt-peaks", realmId: "north", provinceId: "rime-crown", factionId: "vyrgun-drakekin", routeIds: ["north-road", "aurora-way", "ember-road"], direction: "far north", capitalOfRealmId: "north", description: "The black-walled capital of the Frostcrown beneath aurora-lit peaks, ruled by High Queen Ysra Vyrgun." },
  { id: "drakespire", name: "Drakespire", knowledge: "legend", kind: "fortress", coord: { x: 48, y: -245 }, regionId: "drakeholt-peaks", realmId: "north", provinceId: "drake-marches", factionId: "vyrgun-drakekin", routeIds: ["north-road", "aurora-way"], direction: "far north", description: "A volcanic tribute-seat and winter-road fortress built into a smoking mountain shoulder." },
  { id: "wintermere", name: "Wintermere", knowledge: "legend", kind: "town", coord: { x: -55, y: -300 }, regionId: "bonemarsh", realmId: "north", provinceId: "ember-lakes", factionId: "wintermere-hearths", routeIds: ["north-road", "ember-road", "sundered-march"], direction: "far north", description: "A black-fir town built around hot springs that keep its harbor-sized lake from freezing." },
  { id: "bone-citadel", name: "The Bone Citadel", knowledge: "legend", kind: "ruin", coord: { x: -325, y: 55 }, regionId: "pale-steppe", realmId: "west", provinceId: "pale-boughs", factionId: "selenyan-covenant", routeIds: ["bramble-road"], direction: "far west", description: "A pale fortress-ruin swallowed one courtyard at a time by the Elderwood." },
  { id: "everpine-court", name: "The Everpine Court", knowledge: "legend", kind: "shrine", coord: { x: -350, y: 175 }, regionId: "witchwood-deep", realmId: "west", provinceId: "selenyan-heart", factionId: "selenyan-covenant", routeIds: ["bramble-road"], direction: "far west", description: "A living council grove where the Selenyan Covenant renews its oaths beneath an unfallen pine." },
  { id: "caer-selenya", name: "Caer Selenya", knowledge: "legend", kind: "city", coord: { x: -420, y: 150 }, regionId: "witchwood-deep", realmId: "west", provinceId: "selenyan-heart", factionId: "selenyan-covenant", routeIds: ["bramble-road", "greenway", "root-road", "coppice-road"], direction: "far west", capitalOfRealmId: "west", description: "The tree-built capital of the Elderwood, ruled by Queen Maerwynn Thorne through the Selenyan Covenant." },
  { id: "greenharbor", name: "Greenharbor", knowledge: "legend", kind: "port", coord: { x: -474, y: 124 }, regionId: "witchwood-deep", realmId: "west", provinceId: "greenwater-coast", factionId: "greenharbor-guilds", routeIds: ["bramble-road"], direction: "far west", coastalFeatureId: "selenyan-cove", description: "A rain-dark timber port hidden inside Selenyan Cove, where forest roads meet the Greenwater." },
  { id: "tellmar", name: "Tellmar", knowledge: "legend", kind: "city", coord: { x: 418, y: 72 }, regionId: "tellmar-road", realmId: "east", provinceId: "tellmar-delta", factionId: "tellmar-banners", routeIds: ["crown-road-east", "jade-causeway", "lotus-circuit"], direction: "far east", capitalOfRealmId: "east", description: "The tiled capital of the Hundred Banners, raised above lotus canals and ruled by Empress Shuyei Ren." },
  { id: "lotusmouth", name: "Lotusmouth", knowledge: "legend", kind: "port", coord: { x: 486, y: 94 }, regionId: "tellmar-road", realmId: "east", provinceId: "heron-inlet", factionId: "lotus-prefecture", routeIds: ["crown-road-east", "lotus-circuit"], direction: "far east", coastalFeatureId: "heron-inlet", description: "A bright harbor of stilt quays and red beacon towers where the Sea of Reeds opens into the Lantern Sea." },
  { id: "moon-reed-monastery", name: "Moon-Reed Monastery", knowledge: "legend", kind: "temple", coord: { x: 330, y: 145 }, regionId: "tellmar-road", realmId: "east", provinceId: "lotus-marches", factionId: "lotus-prefecture", routeIds: ["crown-road-east", "star-road", "jade-causeway"], direction: "far east", description: "A terraced river monastery whose bell towers rise above a horizon of reeds." },
  { id: "star-forge", name: "The Star-Forge", knowledge: "legend", kind: "temple", coord: { x: 325, y: -110 }, regionId: "iron-plateau", realmId: "east", provinceId: "starfall-uplands", factionId: "iron-plateau-marches", routeIds: ["spine-road", "star-road", "starfall-road"], direction: "far north-east", description: "A pilgrim forge raised around the first iron said to have fallen burning from the sky." },
  { id: "mole-halls", name: "The Mole-Halls", knowledge: "legend", kind: "ruin", coord: { x: 150, y: 115 }, regionId: "spine-foothills", realmId: "central", direction: "south-east", description: "Vast abandoned delvings beneath the continental road, with doors tall enough for forgotten kings." },
  { id: "asalan", name: "Asalan", knowledge: "legend", kind: "city", coord: { x: 104, y: 294 }, regionId: "hollow-coast", realmId: "south", provinceId: "nine-wells", factionId: "asalan-sun-court", routeIds: ["south-road", "low-tide-way", "nine-wells-road", "saffron-coast-road"], direction: "far south", capitalOfRealmId: "south", description: "The red-walled desert capital around the Nine Wells, ruled by Sultana Maraset al-Azur." },
  { id: "glass-dune-observatory", name: "Glass Dune Observatory", knowledge: "legend", kind: "combat", coord: { x: -30, y: 280 }, regionId: "hollow-coast", realmId: "south", provinceId: "glass-desert", factionId: "asalan-sun-court", routeIds: ["south-road", "dune-circuit"], direction: "far south", description: "A brass-domed observatory standing where lightning fused a dune into dark glass." },
  { id: "qamarat", name: "Qamarat", knowledge: "legend", kind: "port", coord: { x: 134, y: 387 }, regionId: "hollow-coast", realmId: "south", provinceId: "saffron-coast", factionId: "qamarat-tideguild", routeIds: ["south-road", "low-tide-way", "nine-wells-road", "saffron-coast-road"], direction: "far south", coastalFeatureId: "nine-wells-bay", description: "A sandstone port of spice warehouses and blue sails on the Saffron Sea." },
  { id: "sunken-crown", name: "The Sunken Crown", knowledge: "legend", kind: "ruin", coord: { x: 24, y: 338 }, regionId: "hollow-coast", realmId: "south", provinceId: "saffron-coast", factionId: "qamarat-tideguild", routeIds: ["low-tide-way"], direction: "far south", description: "Drowned towers visible beneath Nine Wells Bay at the lowest turning of the year." },

  // Frostcrown provinces: defended hearths, tribute roads, sacred ice, and
  // ruins large enough to make the northern realm feel inhabited rather than
  // like one distant capital marker.
  { id: "icebridge", name: "Icebridge", knowledge: "legend", kind: "town", role: "trade-town", coord: { x: -100, y: -280 }, regionId: "bonemarsh", realmId: "north", provinceId: "ember-lakes", factionId: "wintermere-hearths", routeIds: ["ember-road"], direction: "far north-west", description: "A many-arched basalt market built where warm springs keep the winter road and its fish channel open." },
  { id: "aurora-vault", name: "The Aurora Vault", knowledge: "legend", kind: "wonder", role: "ancient-wonder", coord: { x: 70, y: -365 }, regionId: "drakeholt-peaks", realmId: "north", provinceId: "rime-crown", factionId: "vyrgun-drakekin", routeIds: ["aurora-way"], direction: "far north", description: "A glacier cavern whose translucent roof traps ribbons of aurora in blue ice and wakes old voices during midwinter." },
  { id: "skeldhaven", name: "Skeldhaven", knowledge: "legend", kind: "town", role: "winter-hold", coord: { x: 120, y: -315 }, regionId: "drakeholt-peaks", realmId: "north", provinceId: "rime-crown", factionId: "vyrgun-drakekin", routeIds: ["aurora-way"], direction: "far north-east", description: "A black-fir hold of granaries, sledge yards, and aurora observatories serving Northstar's eastern glacier valleys." },
  { id: "ashfang-monastery", name: "Ashfang Monastery", knowledge: "legend", kind: "monastery", role: "wyrm-sanctuary", coord: { x: 100, y: -250 }, regionId: "drakeholt-peaks", realmId: "north", provinceId: "drake-marches", factionId: "vyrgun-drakekin", routeIds: ["aurora-way"], direction: "far north-east", description: "Smoke-robed keepers tend a volcanic shrine, record every drake flight, and shelter travelers caught above the pine line." },
  { id: "red-snow-cairns", name: "The Red-Snow Cairns", knowledge: "legend", kind: "ruin", role: "battlefield", coord: { x: -260, y: -220 }, regionId: "sundered-wastes", realmId: "north", provinceId: "sundered-snow", factionId: "sundered-crown", routeIds: ["sundered-march"], direction: "far north-west", description: "Thousands of spear stones mark a battlefield where iron-rich snowmelt stains the drifts red each thaw." },
  { id: "wolfglass", name: "Wolfglass", knowledge: "legend", kind: "fortress", role: "march-fort", coord: { x: -150, y: -285 }, regionId: "sundered-wastes", realmId: "north", provinceId: "sundered-snow", factionId: "sundered-crown", routeIds: ["sundered-march"], direction: "far north-west", description: "A captured cliff keep faced with smoky ice, controlling the safest sledge road between Brokenhold and Wintermere." },
  { id: "hearthwatch", name: "Hearthwatch", knowledge: "legend", kind: "village", role: "refuge-hold", coord: { x: -20, y: -275 }, regionId: "drakeholt-peaks", realmId: "north", provinceId: "ember-lakes", factionId: "wintermere-hearths", routeIds: ["ember-road"], direction: "far north", description: "A ring of communal halls around a signal brazier, stocked to receive whole villages when blizzards close the lakes." },
  { id: "rimeward-abbey", name: "Rimeward Abbey", knowledge: "legend", kind: "shrine", role: "pilgrim-hospice", coord: { x: -30, y: -355 }, regionId: "drakeholt-peaks", realmId: "north", provinceId: "rime-crown", factionId: "vyrgun-drakekin", routeIds: ["ember-road"], direction: "far north", description: "An ice-walled hospice where ember saints bless northbound tribute trains and bury the nameless beneath singing bells." },

  // Sea of Reeds provinces: causeway towns, flood-control citadels, scholar
  // sanctuaries, and star-iron marches arranged around a working river realm.
  { id: "hanori", name: "Hanori", knowledge: "legend", kind: "city", role: "provincial-seat", coord: { x: 270, y: 65 }, regionId: "tellmar-road", realmId: "east", provinceId: "lotus-marches", factionId: "lotus-prefecture", routeIds: ["jade-causeway"], direction: "far east", description: "A raised canal city of floodgate towers, civil academies, tea courts, and the prefecture archives of the Lotus Marches." },
  { id: "jade-lock", name: "The Jade Lock", knowledge: "legend", kind: "fortress", role: "faction-seat", coord: { x: 260, y: -70 }, regionId: "iron-plateau", realmId: "east", provinceId: "starfall-uplands", factionId: "iron-plateau-marches", routeIds: ["starfall-road"], direction: "far north-east", description: "A green-tiled fortress guarding the stair road from the reed basin to the horse country and its meteor-iron forges." },
  { id: "willowcourt", name: "Willowcourt", knowledge: "legend", kind: "town", role: "canal-market", coord: { x: 350, y: 115 }, regionId: "tellmar-road", realmId: "east", provinceId: "tellmar-delta", factionId: "tellmar-banners", routeIds: ["jade-causeway"], direction: "far east", description: "A willow-shaded judicial town where banner houses settle canal disputes before their barges enter Tellmar." },
  { id: "crane-fort", name: "Crane Fort", knowledge: "legend", kind: "fortress", role: "causeway-garrison", coord: { x: 220, y: 20 }, regionId: "iron-plateau", realmId: "east", provinceId: "lotus-marches", factionId: "lotus-prefecture", routeIds: ["jade-causeway", "starfall-road"], direction: "far east", description: "A narrow redoubt on stone piles whose signal cranes can raise or sever the western causeway during invasion." },
  { id: "jade-terraces", name: "The Jade Terraces", knowledge: "legend", kind: "wonder", role: "living-landmark", coord: { x: 390, y: 150 }, regionId: "tellmar-road", realmId: "east", provinceId: "tellmar-delta", factionId: "tellmar-banners", routeIds: ["lotus-circuit"], direction: "far east", description: "Miles of mirror-bright rice terraces stepping down toward the delta, irrigated by channels older than the empire." },
  { id: "bellwater", name: "Bellwater", knowledge: "legend", kind: "town", role: "river-port", coord: { x: 450, y: 30 }, regionId: "tellmar-road", realmId: "east", provinceId: "tellmar-delta", factionId: "tellmar-banners", routeIds: ["lotus-circuit"], direction: "far east", description: "A crowded inland harbor where bronze tide bells regulate locks, ferries, and the arrival of sea-going reed junks." },
  { id: "copperstep", name: "Copperstep", knowledge: "legend", kind: "town", role: "march-town", coord: { x: 250, y: -130 }, regionId: "iron-plateau", realmId: "east", provinceId: "starfall-uplands", factionId: "iron-plateau-marches", routeIds: ["starfall-road"], direction: "far north-east", description: "A wind-scoured cavalry town built across seven red escarpments, trading horses, copper, and fallen-star claims." },
  { id: "white-heron-sanctuary", name: "White Heron Sanctuary", knowledge: "legend", kind: "sanctuary", role: "tide-shrine", coord: { x: 440, y: 125 }, regionId: "tellmar-road", realmId: "east", provinceId: "heron-inlet", factionId: "lotus-prefecture", routeIds: ["lotus-circuit"], direction: "far east", description: "A tide shrine on a wooded hummock where pilots leave painted feathers before crossing the shifting inlet channels." },

  // Sunscar provinces: a chain of wells, caravan markets, fortresses, and
  // astronomical relics linking the inland capital to a broad southern coast.
  { id: "sirocco-wells", name: "Sirocco Wells", knowledge: "legend", kind: "town", role: "provincial-seat", coord: { x: -15, y: 225 }, regionId: "hollow-coast", realmId: "south", provinceId: "caravan-belt", factionId: "nine-wells-league", routeIds: ["nine-wells-road", "dune-circuit"], direction: "far south", description: "A walled caravan town around three wind-cooled cisterns and the ledger hall that guarantees water tablets." },
  { id: "brasshaven", name: "Brasshaven", knowledge: "legend", kind: "town", role: "caravan-market", coord: { x: 55, y: 250 }, regionId: "hollow-coast", realmId: "south", provinceId: "caravan-belt", factionId: "nine-wells-league", routeIds: ["nine-wells-road"], direction: "far south", description: "A night-market town of brass awnings, camel courts, repair yards, and licensed guides for the Nine Wells road." },
  { id: "duneveil", name: "Duneveil", knowledge: "legend", kind: "village", role: "well-village", coord: { x: -80, y: 240 }, regionId: "hollow-coast", realmId: "south", provinceId: "caravan-belt", factionId: "nine-wells-league", routeIds: ["dune-circuit"], direction: "far south-west", description: "A half-buried well village whose reed screens harvest dawn fog and whose homes migrate as the dune face advances." },
  { id: "mirage-step", name: "Mirage Step", knowledge: "legend", kind: "ruin", role: "lost-road", coord: { x: -100, y: 310 }, regionId: "far-wild", realmId: "south", provinceId: "glass-desert", factionId: "asalan-sun-court", routeIds: ["dune-circuit"], direction: "far south-west", description: "A monumental stair climbing into empty air, visible at noon from distances that no traveler can agree upon." },
  { id: "sunspire", name: "Sunspire", knowledge: "legend", kind: "fortress", role: "royal-garrison", coord: { x: 160, y: 270 }, regionId: "hollow-coast", realmId: "south", provinceId: "nine-wells", factionId: "asalan-sun-court", routeIds: ["nine-wells-road"], direction: "far south-east", description: "A high sandstone signal fort whose mirrored crown relays warnings between Asalan, the coast, and the eastern dunes." },
  { id: "saltmother-shrine", name: "Shrine of the Saltmother", knowledge: "legend", kind: "shrine", role: "coastal-sanctuary", coord: { x: 180, y: 340 }, regionId: "hollow-coast", realmId: "south", provinceId: "saffron-coast", factionId: "qamarat-tideguild", routeIds: ["nine-wells-road"], direction: "far south-east", description: "A white cliff sanctuary where sailors, well keepers, and salt cutters pour the first cup back into the earth." },
  { id: "blueglass", name: "Blueglass", knowledge: "legend", kind: "town", role: "glass-town", coord: { x: 70, y: 340 }, regionId: "hollow-coast", realmId: "south", provinceId: "saffron-coast", factionId: "qamarat-tideguild", routeIds: ["saffron-coast-road"], direction: "far south", description: "A furnace town producing blue window glass and mirrored navigation tiles from the coast's pure sand." },
  { id: "saffron-gate", name: "Saffron Gate", knowledge: "legend", kind: "fortress", role: "coastal-checkpoint", coord: { x: 120, y: 330 }, regionId: "hollow-coast", realmId: "south", provinceId: "nine-wells", factionId: "asalan-sun-court", routeIds: ["saffron-coast-road"], direction: "far south", description: "A customs fort astride the last pass to Qamarat, guarded jointly by royal lancers and blue-sail marines." },

  // Elderwood provinces: port guilds, wardens, living sanctuaries, market
  // clearings, and remnants of the civilizations the forest absorbed.
  { id: "mossmere", name: "Mossmere", knowledge: "legend", kind: "town", role: "provincial-seat", coord: { x: -300, y: 80 }, regionId: "pale-steppe", realmId: "west", provinceId: "pale-boughs", factionId: "selenyan-covenant", routeIds: ["greenway"], direction: "far west", description: "A pale-birch market around a green lake, serving as the open council seat for the northern bough communities." },
  { id: "rainward", name: "Rainward", knowledge: "legend", kind: "town", role: "forester-town", coord: { x: -390, y: 80 }, regionId: "witchwood-deep", realmId: "west", provinceId: "pale-boughs", factionId: "selenyan-covenant", routeIds: ["greenway"], direction: "far west", description: "A slate-roofed timber town where every roof gutter feeds public cisterns and every logging mark faces covenant review." },
  { id: "thornwatch", name: "Thornwatch", knowledge: "legend", kind: "fortress", role: "warden-fort", coord: { x: -250, y: 30 }, regionId: "pale-steppe", realmId: "west", provinceId: "pale-boughs", factionId: "oak-spear-wardens", routeIds: ["greenway"], direction: "far west", description: "A hedge-grown border fortress watching the pale clearings for blight, raiders, and armies leaving Greenward." },
  { id: "deepbough", name: "Deepbough", knowledge: "legend", kind: "sanctuary", role: "root-choir-grove", coord: { x: -360, y: 220 }, regionId: "witchwood-deep", realmId: "west", provinceId: "selenyan-heart", factionId: "selenyan-covenant", routeIds: ["root-road"], direction: "far west", description: "A cathedral grove whose joined roots resonate like low voices when the covenant gathers to decide a question of war." },
  { id: "greenwater-abbey", name: "Greenwater Abbey", knowledge: "legend", kind: "monastery", role: "storm-hospice", coord: { x: -450, y: 200 }, regionId: "witchwood-deep", realmId: "west", provinceId: "selenyan-heart", factionId: "greenharbor-guilds", routeIds: ["root-road"], direction: "far west", description: "A cliffside rain hospice whose lantern gallery guides damaged ships toward Selenyan Cove." },
  { id: "antlerhold", name: "Antlerhold", knowledge: "legend", kind: "town", role: "covenant-moot", coord: { x: -300, y: 180 }, regionId: "witchwood-deep", realmId: "west", provinceId: "selenyan-heart", factionId: "selenyan-covenant", routeIds: ["root-road", "coppice-road"], direction: "far west", description: "A ring-built hunting town and seasonal moot where trail guilds exchange maps carved on shed antler." },
  { id: "willowglass", name: "Willowglass", knowledge: "legend", kind: "village", role: "craft-village", coord: { x: -220, y: 120 }, regionId: "witchwood-deep", realmId: "west", provinceId: "pale-boughs", factionId: "selenyan-covenant", routeIds: ["coppice-road"], direction: "far west", description: "A willow village known for green-dyed windows, medicine gardens, and guides who can read the forest after rain." },
  { id: "old-root-ruins", name: "The Old Root Ruins", knowledge: "legend", kind: "ruin", role: "buried-city", coord: { x: -400, y: 260 }, regionId: "far-wild", realmId: "west", provinceId: "selenyan-heart", factionId: "selenyan-covenant", routeIds: ["root-road"], direction: "far south-west", description: "Cyclopean streets lifted apart by ancient roots, with rain-filled chambers descending beneath the western cliffs." },
];

// The upper two market tiers are authored, never ambient procedural shops.
// Royal houses sit in four distant realm capitals; the two Mastercraft houses
// are isolated specialist destinations on opposite sides of the continent.
// Their service registries carry epic and legendary commercial stock only.
export const RARE_TRADE_HOUSES = Object.freeze({
  "northstar-castle": Object.freeze({
    id: "aurora-armoury",
    name: "The Aurora Armoury",
    type: "smithy",
    service: "royal-armourer",
    marketTier: "royal",
    description: "A royal winter armoury of rime steel, silvered edges, fur-lined harness, and warrant-stamped war gear beneath Northstar's black walls.",
  }),
  tellmar: Object.freeze({
    id: "hundred-seals",
    name: "The Hall of One Hundred Seals",
    type: "market",
    service: "royal-arcana",
    marketTier: "royal",
    description: "Tellmar's imperial arcane exchange, where epic foci and wards pass beneath court seals before reaching a buyer.",
  }),
  asalan: Object.freeze({
    id: "ninth-well-astrolabe",
    name: "The Ninth-Well Astrolabe",
    type: "market",
    service: "royal-arcana",
    marketTier: "royal",
    description: "A royal Asalani house of star instruments, sun wards, and epic desert workings sold under the Sultana's water seal.",
  }),
  "caer-selenya": Object.freeze({
    id: "silverleaf-bowyers",
    name: "The Silverleaf Bowyers",
    type: "smithy",
    service: "royal-armourer",
    marketTier: "royal",
    description: "A covenant-appointed royal workshop offering epic living-wood bows, warded mail, and arms made under the oldest trees.",
  }),
  "star-forge": Object.freeze({
    id: "falling-star-forge",
    name: "The Falling-Star Forge",
    type: "smithy",
    service: "mastercraft-forge",
    marketTier: "mastercraft",
    description: "One of Avarra's two known Mastercraft houses, producing legendary arms and armour beside the crater of the first fallen iron.",
  }),
  "glass-dune-observatory": Object.freeze({
    id: "glass-dune-artificer",
    name: "The Glass Dune Artificer",
    type: "market",
    service: "mastercraft-arcana",
    marketTier: "mastercraft",
    description: "One of Avarra's two known Mastercraft houses, where an artificer offers a handful of legendary wards and foci beneath the observatory dome.",
  }),
});

// One mechanically complete arrival seam is expanded at a time. These entries
// name a real existing building service rather than merely decorating the atlas.
export const LANDMARK_DESTINATION_SERVICES = Object.freeze({
  mirecross: Object.freeze({
    id: "causeway-contract-hall",
    name: "The Causeway Contract Hall",
    type: "inn",
    service: "inn",
    activities: Object.freeze(["Contract board", "Paid work", "Hire travelers"]),
    description: "Concord toll clerks post guarded-road contracts on one board while fenfolk crews and armed strangers wait beneath separate brass pegs.",
  }),
});

// Major roads are authored macro intent, then rasterized to axial cells by the
// generator. Wilderness between them remains generated and walkable; a road is
// an advantage and a story corridor, not the only legal ground.
export const CONTINENT_ROUTES = [
  {
    id: "crown-road-east", name: "The Crown Road", width: 1.9,
    realmIds: ["central", "east"], checkpointIds: ["reedwatch"],
    waypoints: [
      { x: 0, y: 0 }, { x: 55, y: 10 }, { x: 72, y: 6 }, { x: 90, y: -5 },
      { x: 100, y: 12 }, { x: 115, y: 30 }, { x: 135, y: 40 }, { x: 152, y: 22 },
      { x: 170, y: 0 }, { x: 175, y: -5 }, { x: 190, y: -42 }, { x: 215, y: -10 },
      { x: 252, y: 30 }, { x: 285, y: 74 }, { x: 310, y: 115 }, { x: 330, y: 145 },
      { x: 358, y: 126 }, { x: 388, y: 96 }, { x: 418, y: 72 }, { x: 486, y: 94 },
    ],
  },
  {
    id: "tannic-road", name: "The Alder Road", width: 1.9,
    realmIds: ["central", "north"], checkpointIds: ["wolfsnow-redoubt"],
    waypoints: [
      { x: 0, y: 0 }, { x: -6, y: -7 }, { x: -18, y: -20 }, { x: -34, y: -36 },
      { x: -55, y: -55 }, { x: -75, y: -72 }, { x: -95, y: -84 }, { x: -115, y: -96 },
      { x: -125, y: -122 }, { x: -132, y: -154 }, { x: -150, y: -185 },
      { x: -170, y: -220 }, { x: -190, y: -245 }, { x: -205, y: -260 },
    ],
  },
  {
    id: "spine-road", name: "The High Sheepway", width: 1.9,
    realmIds: ["central", "east"], checkpointIds: ["reedwatch"],
    waypoints: [
      { x: 0, y: 0 }, { x: 10, y: 3 }, { x: 42, y: 22 }, { x: 80, y: 60 },
      { x: 105, y: 75 }, { x: 125, y: 90 }, { x: 150, y: 115 }, { x: 160, y: 90 },
      { x: 168, y: 60 }, { x: 172, y: 25 }, { x: 175, y: -5 }, { x: 190, y: -20 },
      { x: 210, y: -38 },
      { x: 235, y: -56 }, { x: 260, y: -72 }, { x: 285, y: -88 },
      { x: 305, y: -100 }, { x: 325, y: -110 },
    ],
  },
  {
    id: "bramble-road", name: "The Hedge Road", width: 1.9,
    realmIds: ["central", "west"], checkpointIds: ["greenward-gate"],
    waypoints: [
      { x: 0, y: 0 }, { x: -8, y: 13 }, { x: -30, y: 38 }, { x: -50, y: 60 },
      { x: -70, y: 75 }, { x: -88, y: 78 }, { x: -105, y: 75 }, { x: -130, y: 56 },
      { x: -150, y: 38 }, { x: -170, y: 30 }, { x: -210, y: 34 }, { x: -260, y: 42 },
      { x: -300, y: 50 }, { x: -325, y: 55 }, { x: -340, y: 90 }, { x: -350, y: 130 },
      { x: -350, y: 175 }, { x: -385, y: 165 }, { x: -420, y: 150 }, { x: -474, y: 124 },
    ],
  },
  {
    id: "south-road", name: "The Salt Road", width: 1.9,
    realmIds: ["central", "south"], checkpointIds: ["sunward-bastion"],
    waypoints: [
      { x: 0, y: 0 }, { x: -3, y: 13 }, { x: 48, y: 16 }, { x: 76, y: 28 },
      { x: 104, y: 42 }, { x: 122, y: 55 }, { x: 116, y: 75 }, { x: 98, y: 95 },
      { x: 72, y: 116 }, { x: 42, y: 135 }, { x: 10, y: 153 }, { x: -15, y: 170 },
      { x: -40, y: 190 }, { x: -65, y: 210 }, { x: -76, y: 228 }, { x: -63, y: 250 },
      { x: -30, y: 280 }, { x: 35, y: 290 }, { x: 104, y: 294 }, { x: 134, y: 387 },
    ],
  },
  {
    id: "low-tide-way", name: "The Low-Tide Way", kind: "regional-road", width: 1.2,
    realmIds: ["south"], checkpointIds: [],
    waypoints: [
      { x: 104, y: 294 }, { x: 88, y: 301 }, { x: 70, y: 311 }, { x: 52, y: 322 },
      { x: 36, y: 333 }, { x: 24, y: 338 }, { x: 33, y: 349 }, { x: 48, y: 360 },
      { x: 66, y: 370 }, { x: 86, y: 378 }, { x: 110, y: 384 }, { x: 134, y: 387 },
    ],
  },
  {
    id: "north-road", name: "The Smoke Road", width: 1.9,
    realmIds: ["central", "north"], checkpointIds: ["frostgate"],
    waypoints: [
      { x: 0, y: 0 }, { x: 4, y: -13 }, { x: 20, y: -24 }, { x: 24, y: -52 },
      { x: 28, y: -82 }, { x: 35, y: -112 }, { x: 42, y: -145 }, { x: 5, y: -165 },
      { x: 14, y: -183 }, { x: 30, y: -202 }, { x: 48, y: -224 }, { x: 48, y: -245 },
      { x: 28, y: -263 }, { x: 5, y: -280 }, { x: -25, y: -294 }, { x: -55, y: -300 },
      { x: -35, y: -314 }, { x: -12, y: -326 }, { x: 8, y: -332 },
    ],
  },
  {
    id: "star-road", name: "The Pilgrim's Iron Road", width: 1.9,
    realmIds: ["central", "east"], checkpointIds: ["reedwatch"],
    waypoints: [
      { x: 80, y: 60 }, { x: 98, y: 56 }, { x: 118, y: 48 }, { x: 135, y: 40 },
      { x: 150, y: 25 }, { x: 162, y: 8 }, { x: 175, y: -5 }, { x: 195, y: -22 },
      { x: 220, y: -40 }, { x: 250, y: -60 }, { x: 280, y: -82 }, { x: 305, y: -100 },
      { x: 325, y: -110 }, { x: 330, y: -60 }, { x: 332, y: 0 }, { x: 332, y: 70 },
      { x: 330, y: 145 },
    ],
  },
  {
    id: "aurora-way", name: "The Aurora Way", kind: "regional-road", width: 1.2,
    realmIds: ["north"], checkpointIds: [],
    waypoints: [
      { x: 8, y: -332 }, { x: 25, y: -345 }, { x: 48, y: -358 }, { x: 70, y: -365 },
      { x: 92, y: -355 }, { x: 110, y: -338 }, { x: 120, y: -315 }, { x: 118, y: -290 },
      { x: 108, y: -265 }, { x: 100, y: -250 }, { x: 75, y: -245 }, { x: 48, y: -245 },
    ],
    description: "A crown-maintained winter circuit linking Northstar's glacier holds to Drakespire.",
  },
  {
    id: "ember-road", name: "The Ember Road", kind: "regional-road", width: 1.2,
    realmIds: ["north"], checkpointIds: [],
    waypoints: [
      { x: -55, y: -300 }, { x: -78, y: -291 }, { x: -100, y: -280 }, { x: -73, y: -276 },
      { x: -45, y: -274 }, { x: -20, y: -275 }, { x: -24, y: -300 }, { x: -27, y: -330 },
      { x: -30, y: -355 }, { x: -12, y: -350 }, { x: -2, y: -340 }, { x: 8, y: -332 },
    ],
    description: "A hot-spring road marked by public braziers and emergency refuge halls.",
  },
  {
    id: "sundered-march", name: "The Sundered March", kind: "regional-road", width: 1.2,
    realmIds: ["north"], checkpointIds: [],
    waypoints: [
      { x: -205, y: -260 }, { x: -225, y: -245 }, { x: -245, y: -228 }, { x: -260, y: -220 },
      { x: -245, y: -240 }, { x: -225, y: -260 }, { x: -200, y: -275 }, { x: -175, y: -284 },
      { x: -150, y: -285 }, { x: -118, y: -288 }, { x: -86, y: -294 }, { x: -55, y: -300 },
    ],
    description: "A hard military road binding captured north-western forts to the free hearths.",
  },
  {
    id: "jade-causeway", name: "The Jade Causeway", kind: "regional-road", width: 1.2,
    realmIds: ["east"], checkpointIds: [],
    waypoints: [
      { x: 175, y: -5 }, { x: 190, y: 2 }, { x: 205, y: 10 }, { x: 220, y: 20 },
      { x: 235, y: 35 }, { x: 252, y: 52 }, { x: 270, y: 65 }, { x: 292, y: 80 },
      { x: 320, y: 98 }, { x: 350, y: 115 }, { x: 340, y: 132 }, { x: 330, y: 145 },
      { x: 360, y: 120 }, { x: 390, y: 92 }, { x: 418, y: 72 },
    ],
    description: "A raised flood road of stone locks, courier towers, and academy hostels.",
  },
  {
    id: "starfall-road", name: "The Starfall Road", kind: "regional-road", width: 1.2,
    realmIds: ["east"], checkpointIds: [],
    waypoints: [
      { x: 325, y: -110 }, { x: 306, y: -116 }, { x: 286, y: -123 }, { x: 268, y: -128 },
      { x: 250, y: -130 }, { x: 248, y: -112 }, { x: 252, y: -92 }, { x: 260, y: -70 },
      { x: 252, y: -48 }, { x: 242, y: -25 }, { x: 230, y: -2 }, { x: 220, y: 20 },
    ],
    description: "The fortified upland road used by cavalry studs and meteor-iron caravans.",
  },
  {
    id: "lotus-circuit", name: "The Lotus Circuit", kind: "regional-road", width: 1.2,
    realmIds: ["east"], checkpointIds: [],
    waypoints: [
      { x: 418, y: 72 }, { x: 432, y: 55 }, { x: 450, y: 30 }, { x: 438, y: 58 },
      { x: 420, y: 90 }, { x: 402, y: 122 }, { x: 390, y: 150 }, { x: 410, y: 145 },
      { x: 430, y: 136 }, { x: 440, y: 125 }, { x: 458, y: 112 }, { x: 475, y: 102 },
      { x: 486, y: 94 },
    ],
    description: "A chain of levees, ferries, and tide roads around Tellmar's inhabited delta.",
  },
  {
    id: "nine-wells-road", name: "The Nine Wells Road", kind: "regional-road", width: 1.2,
    realmIds: ["south"], checkpointIds: [],
    waypoints: [
      { x: -15, y: 225 }, { x: 5, y: 230 }, { x: 28, y: 238 }, { x: 55, y: 250 },
      { x: 78, y: 267 }, { x: 104, y: 294 }, { x: 130, y: 285 }, { x: 160, y: 270 },
      { x: 170, y: 295 }, { x: 178, y: 320 }, { x: 180, y: 340 }, { x: 165, y: 357 },
      { x: 150, y: 374 }, { x: 134, y: 387 },
    ],
    description: "A royal caravan road supplied by nine protected wells and mirrored signal towers.",
  },
  {
    id: "dune-circuit", name: "The Dune Circuit", kind: "regional-road", width: 1.2,
    realmIds: ["south"], checkpointIds: [],
    waypoints: [
      { x: -15, y: 170 }, { x: -10, y: 188 }, { x: -12, y: 207 }, { x: -15, y: 225 },
      { x: -35, y: 229 }, { x: -58, y: 234 }, { x: -80, y: 240 }, { x: -70, y: 252 },
      { x: -52, y: 267 }, { x: -30, y: 280 }, { x: -60, y: 296 }, { x: -100, y: 310 },
    ],
    description: "A surveyed desert loop whose cairns are reset after every season of moving dunes.",
  },
  {
    id: "saffron-coast-road", name: "The Saffron Coast Road", kind: "regional-road", width: 1.2,
    realmIds: ["south"], checkpointIds: [],
    waypoints: [
      { x: 104, y: 294 }, { x: 92, y: 305 }, { x: 82, y: 318 }, { x: 70, y: 340 },
      { x: 83, y: 338 }, { x: 98, y: 334 }, { x: 120, y: 330 }, { x: 125, y: 343 },
      { x: 128, y: 356 }, { x: 130, y: 368 }, { x: 132, y: 379 }, { x: 134, y: 387 },
    ],
    description: "A customs road connecting Asalan's gardens to the glass towns and southern harbor.",
  },
  {
    id: "greenway", name: "The Greenway", kind: "regional-road", width: 1.2,
    realmIds: ["west"], checkpointIds: [],
    waypoints: [
      { x: -170, y: 30 }, { x: -195, y: 26 }, { x: -222, y: 27 }, { x: -250, y: 30 },
      { x: -268, y: 47 }, { x: -285, y: 65 }, { x: -300, y: 80 }, { x: -330, y: 75 },
      { x: -360, y: 74 }, { x: -390, y: 80 }, { x: -405, y: 110 }, { x: -420, y: 150 },
    ],
    description: "A living road trained through the pale boughs from Greenward to the covenant capital.",
  },
  {
    id: "root-road", name: "The Root Road", kind: "regional-road", width: 1.2,
    realmIds: ["west"], checkpointIds: [],
    waypoints: [
      { x: -420, y: 150 }, { x: -390, y: 158 }, { x: -355, y: 166 }, { x: -325, y: 174 },
      { x: -300, y: 180 }, { x: -325, y: 198 }, { x: -360, y: 220 }, { x: -380, y: 242 },
      { x: -400, y: 260 }, { x: -415, y: 242 }, { x: -430, y: 224 }, { x: -450, y: 200 },
    ],
    description: "A deep-forest pilgrimage road linking covenant groves, buried ruins, and the western storm hospice.",
  },
  {
    id: "coppice-road", name: "The Coppice Road", kind: "regional-road", width: 1.2,
    realmIds: ["west"], checkpointIds: [],
    waypoints: [
      { x: -170, y: 30 }, { x: -178, y: 52 }, { x: -188, y: 75 }, { x: -202, y: 98 },
      { x: -220, y: 120 }, { x: -240, y: 138 }, { x: -265, y: 155 }, { x: -300, y: 180 },
      { x: -335, y: 178 }, { x: -370, y: 170 }, { x: -400, y: 158 }, { x: -420, y: 150 },
    ],
    description: "A guild road through managed woodland, craft villages, and seasonal hunting moots.",
  },
];

// Coastal travel joins the three navigable faces of Avarra without turning the
// atlas into a round island. These are deliberately offshore trade corridors;
// their endpoints are real ports while intermediate waypoints remain at sea.
export const CONTINENT_SEA_LANES = [
  { id: "greenwater-saffron-run", name: "The Greenwater-Saffron Run", kind: "sea-lane", realmIds: ["west", "south"], portIds: ["greenharbor", "qamarat"], waypoints: [{ x: -474, y: 124 }, { x: -474, y: 125 }, { x: -550, y: 200 }, { x: -550, y: 430 }, { x: 134, y: 420 }, { x: 134, y: 388 }, { x: 134, y: 387 }], hazards: ["green squalls", "fog banks", "nine-wells shoals"], tradeGoods: ["ship timber", "resin", "salt", "blue glass"], description: "A long south-western circuit carrying Elderwood timber to Qamarat and returning with salt and glass." },
  { id: "saffron-lantern-run", name: "The Saffron-Lantern Run", kind: "sea-lane", realmIds: ["south", "east"], portIds: ["qamarat", "lotusmouth"], waypoints: [{ x: 134, y: 387 }, { x: 134, y: 388 }, { x: 134, y: 420 }, { x: 560, y: 430 }, { x: 560, y: 94 }, { x: 487, y: 94 }, { x: 486, y: 94 }], hazards: ["hot squalls", "pirate lanterns", "shifting reed shoals"], tradeGoods: ["incense", "desert glass", "tea", "silk"], description: "The warm eastern passage joining Qamarat's spice quays to the stilt harbors of the Sea of Reeds." },
  { id: "three-harbors-circuit", name: "The Three Harbors Circuit", kind: "sea-lane", realmIds: ["west", "south", "east"], portIds: ["greenharbor", "qamarat", "lotusmouth"], waypoints: [{ x: -474, y: 124 }, { x: -474, y: 125 }, { x: -560, y: 220 }, { x: -600, y: 470 }, { x: 134, y: 470 }, { x: 134, y: 388 }, { x: 134, y: 387 }, { x: 134, y: 388 }, { x: 134, y: 470 }, { x: 600, y: 470 }, { x: 600, y: 94 }, { x: 487, y: 94 }, { x: 486, y: 94 }], hazards: ["open-water storms", "corsair fleets", "seasonal monsoons"], tradeGoods: ["hardwood", "spices", "porcelain", "iron tools"], description: "A prestigious seasonal circuit sailed by the largest merchant fleets between all three continental ports." },
];

// Named continental water is macro-authored so rivers remain continuous and
// culturally meaningful. Smaller wet ground and coast shape are procedural.
export const CONTINENT_WATERWAYS = [
  {
    id: "whitewend", name: "The Whitewend", widthStart: 1.4, widthEnd: 2.6,
    description: "The brown working river of the central basins.",
    waypoints: [{ x: 46, y: -218 }, { x: 31, y: -150 }, { x: 18, y: -82 }, { x: 12, y: -24 }, { x: 13, y: 34 }, { x: 28, y: 102 }, { x: 36, y: 184 }, { x: 42, y: 272 }],
  },
  {
    id: "tannic", name: "The Tannic", widthStart: 1.4, widthEnd: 2.6,
    description: "A dark alder-fed tributary carrying leaf stain out of the western woods.",
    waypoints: [{ x: -116, y: -132 }, { x: -82, y: -88 }, { x: -27, y: -34 }, { x: 12, y: -24 }],
  },
  {
    id: "bannerflow", name: "The Bannerflow", widthStart: 1.4, widthEnd: 2.6,
    description: "A broad eastern river dividing into lotus channels through the Sea of Reeds.",
    waypoints: [{ x: 238, y: -128 }, { x: 254, y: -54 }, { x: 286, y: 24 }, { x: 344, y: 74 }, { x: 412, y: 102 }, { x: 486, y: 94 }],
  },
  {
    id: "saffron-wadi", name: "The Saffron Wadi", widthStart: 1.4, widthEnd: 2.6,
    description: "A seasonal southern river linking the Nine Wells to the warm sea.",
    waypoints: [{ x: 22, y: 176 }, { x: 38, y: 225 }, { x: 72, y: 272 }, { x: 104, y: 294 }, { x: 134, y: 387 }],
  },
  {
    id: "glasswater", name: "The Glasswater", widthStart: 1.4, widthEnd: 2.6,
    description: "A bright snowmelt river descending from the north-western ridges into the central alder country.",
    waypoints: [{ x: -205, y: -260 }, { x: -170, y: -190 }, { x: -132, y: -154 }, { x: -90, y: -80 }],
  },
  {
    id: "iceflow", name: "The Iceflow", widthStart: 1.4, widthEnd: 2.6,
    description: "A glacial blue river cutting south from Northstar's ice fields beside the eastern Frostcrown ridges.",
    waypoints: [{ x: 8, y: -332 }, { x: 40, y: -290 }, { x: 72, y: -250 }, { x: 82, y: -170 }],
  },
  {
    id: "reed-fingers-north", name: "Reed Fingers (north branch)", widthStart: 1.4, widthEnd: 2.6,
    description: "The northern reed branch gathers plateau runoff before broadening into Tellmar's inhabited delta.",
    waypoints: [{ x: 280, y: -100 }, { x: 325, y: -30 }, { x: 370, y: 40 }, { x: 418, y: 72 }],
  },
  {
    id: "reed-fingers-south", name: "Reed Fingers (south branch)", widthStart: 1.4, widthEnd: 2.6,
    description: "The southern reed branch winds out of lotus country and joins the lower delta beneath Tellmar's walls.",
    waypoints: [{ x: 330, y: 145 }, { x: 350, y: 210 }, { x: 380, y: 130 }, { x: 418, y: 72 }],
  },
  {
    id: "elderflow", name: "The Elderflow", widthStart: 1.4, widthEnd: 2.6,
    description: "A tannin-dark woodland river flowing west through the covenant groves toward the Greenwater coast.",
    waypoints: [{ x: -240, y: 40 }, { x: -290, y: 80 }, { x: -360, y: 120 }, { x: -420, y: 150 }],
  },
  {
    id: "ember-wash", name: "The Ember Wash", widthStart: 1.4, widthEnd: 2.6,
    description: "An intermittent desert wash carrying rare mountain storms down toward Asalan's irrigated basin.",
    waypoints: [{ x: 210, y: 180 }, { x: 175, y: 210 }, { x: 140, y: 250 }, { x: 104, y: 294 }],
  },
];

export const CONTINENT_LAKES = [
  { id: "black-tarn", name: "Black Tarn", description: "Cold, peat-dark water under a low western sky.", center: { x: -115, y: -105 }, radius: 5 },
  { id: "mirror-lake", name: "Mirror Lake", description: "A high clear lake reflecting the Iron Plateau's fast weather.", center: { x: 190, y: -42 }, radius: 4 },
  { id: "frostmirror", name: "Frostmirror", description: "A glacial lake whose blue ice reflects the broken northern ridges.", center: { x: -90, y: -260 }, radius: 7 },
  { id: "ashpool", name: "Ashpool", description: "A small volcanic tarn cupped inside the mountain spine.", center: { x: 72, y: -180 }, radius: 4 },
  { id: "heronmere", name: "Heronmere", description: "A clear pass lake where white herons gather below the high road.", center: { x: 135, y: 40 }, radius: 5 },
  { id: "tannic-sump", name: "Tannic Sump", description: "A tea-dark marsh lake collecting the western heartland's alder water.", center: { x: -70, y: 75 }, radius: 4 },
  { id: "greenwater-lake", name: "Greenwater", description: "A deep rain-fed harbor lake opening toward the Elderwood's western port.", center: { x: -340, y: 175 }, radius: 6 },
  { id: "lotuspool", name: "Lotuspool", description: "A warm delta lake crowded with lotus islands and fishing skiffs.", center: { x: 390, y: 100 }, radius: 5 },
  { id: "jadepond", name: "Jadepond", description: "A green highland pond below the eastern shrine roads.", center: { x: 340, y: -80 }, radius: 4 },
  { id: "shimmer-flats", name: "Shimmer Flats", description: "A broad sheet of shallow salt water mirroring the southern sky.", center: { x: 55, y: 240 }, radius: 8 },
  { id: "moonwell", name: "Moonwell", description: "A cold round spring lake at the southern toe of the mountain spine.", center: { x: -82, y: 226 }, radius: 3 },
  { id: "oasis-al-thar", name: "Oasis al-Thar", description: "A palm-ringed desert lake sustaining caravans beyond Asalan's outer wells.", center: { x: 135, y: 320 }, radius: 5 },
];

export const CONTINENT_HOT_SPRINGS = [
  { id: "jade-springs", name: "Jade Springs", description: "Warm mineral pools step through jade terraces below the eastern shrine road.", center: { x: 380, y: -50 }, radius: 3 },
  { id: "misty-caldron", name: "Misty Caldron", description: "A steaming basin of pale pools and reed-screened bathing stones near Tellmar's upland approach.", center: { x: 410, y: 20 }, radius: 2 },
];

export function regionDefinition(id) {
  return REGION_DEFINITIONS[id] || REGION_DEFINITIONS["far-wild"];
}

export function ecologyDefinition(id) {
  return ECOLOGIES[id] || ECOLOGIES.grassland;
}

export function landmarksByKnowledge(knowledge) {
  return LANDMARKS.filter((landmark) => landmark.knowledge === knowledge);
}

export function realmDefinition(id) {
  return REALM_DEFINITIONS[id] || REALM_DEFINITIONS.central;
}
