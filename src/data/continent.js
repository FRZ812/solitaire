// Avarra's continental-scale content contract.
//
// This module is deliberately data-only. `engine/world-generation.js` turns
// these authored macro facts into deterministic, lazy world tiles. Nothing in
// here is expanded into HANDCRAFTED or campaign state: an Avarra-sized atlas is
// far too large for either of those sparse, player-authored stores.

import { WHITEMARCH_CAPITAL } from "./whitemarch-capital.js";

export const WORLD_GENERATOR_VERSION = 1;
export const DEFAULT_WORLD_SEED = "avarra-first-light";

export const CONTINENT = {
  id: "avarra",
  name: "Avarra",
  seed: DEFAULT_WORLD_SEED,
  generatorVersion: WORLD_GENERATOR_VERSION,
  contentVersion: 1,
  hexKilometers: 6,
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
    "A long east-west continent of drowned southern shelves, western grass seas, " +
    "a cold northern crown, and river basins gathered around the Whitewend. " +
    "Whitemarch stands near its inhabited middle, small against the whole.",
};

// Region sites are low-detail cultural/ecological authorities. Their warped
// influence fields form irregular borders; they are not hard rectangles. The
// existing biome ids remain stable because saves, art, encounters, mounts, and
// difficulty already refer to them.
//
// `climate` biases the shared continental fields. `terrain` nudges the ecology
// classifier, so every established region materially changes its generated
// ground instead of falling through to one generic wilderness profile.
export const REGION_DEFINITIONS = {
  whitemarch: {
    id: "whitemarch", label: "Whitemarch Basin", faction: "whitemarch-iron",
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
    id: "mire", label: "The Mire", faction: "crowsmoor-wardens",
    sites: [{ x: 4, y: 17, scaleX: 56, scaleY: 36 }],
    climate: { temperature: 0.03, moisture: 0.28, elevation: -0.24 },
    terrain: { forest: 0.02, marsh: 0.34, hills: -0.18 }, poiChance: 0.035,
    areas: { prefixes: ["Reed", "Sedge", "Peat", "Heron", "Stillwater"], nouns: ["Mere", "Fen", "Crossing", "Pools", "Levels"] },
    features: ["peat-camp", "ferry", "drowned-shrine", "reed-village"],
  },
  "crowsmoor-reach": {
    id: "crowsmoor-reach", label: "Crowsmoor Reach", faction: "crowsmoor-wardens",
    sites: [{ x: 86, y: -2, scaleX: 72, scaleY: 48 }],
    climate: { temperature: 0.02, moisture: -0.04, elevation: -0.02 },
    terrain: { forest: -0.12, marsh: -0.08, hills: -0.04 }, poiChance: 0.027,
    areas: { prefixes: ["Crow", "Barley", "Heron", "Longfield", "Greywall"], nouns: ["Reach", "Downs", "Pastures", "Crossroads", "Freeholds"] },
    features: ["freehold", "watch-post", "shepherd-camp", "roadside-inn"],
  },
  "tannic-wood": {
    id: "tannic-wood", label: "The Tannic Wood", faction: "wood-cult",
    sites: [{ x: -38, y: -52, scaleX: 68, scaleY: 62 }],
    climate: { temperature: -0.04, moisture: 0.18, elevation: 0 },
    terrain: { forest: 0.30, marsh: 0.05, hills: 0.02 }, poiChance: 0.025,
    areas: { prefixes: ["Alder", "Birch", "Tannin", "Root", "Gloam"], nouns: ["Wood", "Glade", "Brake", "Hollow", "Ford"] },
    features: ["woodward-lodge", "root-ruin", "river-ford", "old-grove"],
  },
  "whitemarch-march": {
    id: "whitemarch-march", label: "Whitemarch March", faction: "whitemarch-iron",
    sites: [{ x: 50, y: -58, scaleX: 78, scaleY: 60 }],
    climate: { temperature: -0.02, moisture: -0.05, elevation: 0.10 },
    terrain: { forest: -0.05, marsh: -0.12, hills: 0.14 }, poiChance: 0.024,
    areas: { prefixes: ["Chalk", "Iron", "North", "Milestone", "Ram"], nouns: ["March", "Downs", "Ridge", "Sheepwalk", "Border"] },
    features: ["toll-fort", "quarry", "signal-tower", "fairground"],
  },
  "spine-foothills": {
    id: "spine-foothills", label: "The Spine Foothills", faction: "spine-confederation",
    sites: [{ x: 82, y: 72, scaleX: 92, scaleY: 78 }],
    climate: { temperature: -0.08, moisture: -0.02, elevation: 0.27 },
    terrain: { forest: -0.03, marsh: -0.22, hills: 0.30 }, poiChance: 0.028,
    areas: { prefixes: ["Goat", "Redstone", "High", "Wind", "Stonebrook"], nouns: ["Fold", "Ridge", "Pass", "Shelf", "Vale"] },
    features: ["mine", "hill-shrine", "clan-camp", "dwarven-relay"],
  },
  "bramblewych-reach": {
    id: "bramblewych-reach", label: "Bramblewych Reach", faction: "bramble-witches",
    sites: [{ x: -42, y: 68, scaleX: 76, scaleY: 68 }],
    climate: { temperature: 0.05, moisture: 0.14, elevation: -0.03 },
    terrain: { forest: 0.18, marsh: 0.10, hills: 0 }, poiChance: 0.028,
    areas: { prefixes: ["Briar", "Hedge", "Bee", "Greenshaw", "Thorn"], nouns: ["Reach", "Orchards", "Wych", "Hollow", "Commons"] },
    features: ["hedge-village", "witch-stone", "apiary", "abandoned-farm"],
  },
  bonemarsh: {
    id: "bonemarsh", label: "The Bonemarsh", faction: "pale-hand",
    sites: [{ x: -105, y: -135, scaleX: 104, scaleY: 90 }],
    climate: { temperature: -0.15, moisture: 0.24, elevation: -0.18 },
    terrain: { forest: 0.02, marsh: 0.30, hills: -0.08 }, poiChance: 0.026,
    areas: { prefixes: ["Bone", "Black", "Cold", "Pale", "Tarn"], nouns: ["Marsh", "Mere", "Moor", "Pools", "Fen"] },
    features: ["barrow", "tarn-jetty", "bone-field", "hermit-cell"],
  },
  "sundered-wastes": {
    id: "sundered-wastes", label: "The Sundered Wastes", faction: "sundered-crown",
    sites: [{ x: -245, y: -165, scaleX: 150, scaleY: 112 }],
    climate: { temperature: -0.08, moisture: -0.24, elevation: 0.14 },
    terrain: { forest: -0.26, marsh: -0.28, hills: 0.26 }, poiChance: 0.024,
    areas: { prefixes: ["Broken", "Cinder", "Red", "Crownless", "Shatter"], nouns: ["Waste", "Mesa", "Cairns", "Scar", "Barrens"] },
    features: ["fortress-ruin", "war-camp", "cairn-field", "ash-well"],
  },
  "drakeholt-peaks": {
    id: "drakeholt-peaks", label: "The Drakeholt", faction: "vyrgun-drakekin",
    sites: [{ x: 18, y: -245, scaleX: 155, scaleY: 105 }],
    climate: { temperature: -0.32, moisture: -0.02, elevation: 0.38 },
    terrain: { forest: -0.12, marsh: -0.35, hills: 0.42 }, poiChance: 0.022,
    areas: { prefixes: ["Drake", "Smoke", "Rime", "Vyrgun", "Cloud"], nouns: ["Peaks", "Cols", "Teeth", "Shelf", "Crown"] },
    features: ["tribute-town", "wyrm-roost", "ice-cave", "hunter-lodge"],
  },
  "iron-plateau": {
    id: "iron-plateau", label: "The Iron Plateau", faction: "iron-plateau-marches",
    sites: [{ x: 178, y: -28, scaleX: 145, scaleY: 96 }],
    climate: { temperature: 0.02, moisture: -0.18, elevation: 0.20 },
    terrain: { forest: -0.20, marsh: -0.28, hills: 0.22 }, poiChance: 0.022,
    areas: { prefixes: ["Iron", "Horse", "Mirror", "Baron", "High"], nouns: ["Plateau", "Table", "Grasslands", "March", "Escarpment"] },
    features: ["manor-fort", "horse-fair", "signal-tower", "stone-village"],
  },
  "tellmar-road": {
    id: "tellmar-road", label: "The Tellmar Road", faction: "tellmar-banners",
    sites: [{ x: 315, y: 62, scaleX: 172, scaleY: 116 }],
    climate: { temperature: 0.11, moisture: -0.08, elevation: 0.01 },
    terrain: { forest: -0.08, marsh: -0.18, hills: 0.02 }, poiChance: 0.026,
    areas: { prefixes: ["Banner", "Cypress", "Copper", "Longmile", "East"], nouns: ["Road", "Caravan-Ground", "Reach", "Ways", "Fields"] },
    features: ["caravanserai", "milestone-shrine", "banner-house", "market-town"],
  },
  "hollow-coast": {
    id: "hollow-coast", label: "The Hollow Coast", faction: "tideless",
    sites: [{ x: 35, y: 235, scaleX: 190, scaleY: 118 }],
    climate: { temperature: 0.20, moisture: 0.22, elevation: -0.20 },
    terrain: { forest: -0.02, marsh: 0.24, hills: -0.12 }, poiChance: 0.028,
    areas: { prefixes: ["Hollow", "Salt", "Tideless", "Grey", "Shell"], nouns: ["Coast", "Fens", "Beaches", "Inlets", "Levels"] },
    features: ["tide-shrine", "fishing-village", "saltworks", "drowned-ruin"],
  },
  "witchwood-deep": {
    id: "witchwood-deep", label: "The Witchwood Deep", faction: "bramble-witches",
    sites: [{ x: -145, y: 62, scaleX: 116, scaleY: 92 }],
    climate: { temperature: 0.02, moisture: 0.24, elevation: 0.02 },
    terrain: { forest: 0.38, marsh: 0.04, hills: 0.02 }, poiChance: 0.024,
    areas: { prefixes: ["Old", "Heart", "Moss", "Lantern", "Antler"], nouns: ["Deep", "Wood", "Gloom", "Tangle", "Halls"] },
    features: ["memory-tree", "sylvan-outpost", "moss-ruin", "witch-path"],
  },
  "pale-steppe": {
    id: "pale-steppe", label: "The Pale Steppe", faction: "free-folk",
    sites: [{ x: -305, y: 58, scaleX: 170, scaleY: 135 }],
    climate: { temperature: 0.05, moisture: -0.30, elevation: 0.02 },
    terrain: { forest: -0.32, marsh: -0.34, hills: 0.02 }, poiChance: 0.019,
    areas: { prefixes: ["Pale", "Lark", "Horse", "Longwind", "Ivory"], nouns: ["Steppe", "Grass-Sea", "Range", "Horizon", "Trail"] },
    features: ["nomad-camp", "standing-stones", "burial-mound", "deserted-well"],
  },
  "far-wild": {
    id: "far-wild", label: "The Far Wild", faction: "free-folk",
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

export const LANDMARKS = [
  // Starting basin and reachable regional anchors: known by ordinary reputation.
  { id: "mirecross", name: "Mirecross", knowledge: "rumor", kind: "village", coord: { x: 28, y: 6 }, regionId: "mire", direction: "east", description: "A peat-and-reed village on piles above the black water, where the Crown Road changes from stone to logs." },
  { id: "tannic-ford", name: "Tannic Ford", knowledge: "rumor", kind: "village", coord: { x: -27, y: -34 }, regionId: "tannic-wood", direction: "north-west", description: "A woodward and ferry community where brown water slides under alder roots." },
  { id: "crowsmoor", name: "Crowsmoor", knowledge: "rumor", kind: "town", coord: { x: 72, y: -3 }, regionId: "crowsmoor-reach", direction: "east", description: "A freehold town of slate roofs, sheep courts, and a council hall built over the old road." },
  { id: "halfborn-hold", name: "The Halfborn Hold", knowledge: "rumor", kind: "fortress", coord: { x: 49, y: 20 }, regionId: "spine-foothills", direction: "south-east", description: "A compact free town on the Crowsmoor-Spine border whose open gate and strict sanctuary law are famous along the caravan roads." },
  { id: "pale-shrine", name: "Shrine of the Pale God", knowledge: "rumor", kind: "shrine", coord: { x: 33, y: 12 }, regionId: "mire", direction: "east", description: "A quiet arch and hospice on Crowsmoor's wet western edge, where seven-day servants keep watch beside a cold spring." },
  { id: "greenshaw", name: "Greenshaw", knowledge: "rumor", kind: "village", coord: { x: -43, y: 66 }, regionId: "bramblewych-reach", direction: "south-west", description: "Garden plots, bee-skeps, and low turf-roofed homes hidden inside a patient hedge maze." },
  { id: "stonebrook", name: "Stonebrook Hold", knowledge: "rumor", kind: "town", coord: { x: 70, y: 64 }, regionId: "spine-foothills", direction: "south-east", description: "A practical dwarven mining hold around a fast stream, known for fair weights and excellent steel." },
  { id: "heron-tower", name: "The Heron Tower", knowledge: "rumor", kind: "tower", coord: { x: 96, y: 43 }, regionId: "spine-foothills", direction: "east", description: "A solitary sorcerer's tower whose white herald birds can be seen circling from two valleys away." },
  { id: "black-tarn", name: "Black Tarn", knowledge: "rumor", kind: "lake", coord: { x: -96, y: -96 }, regionId: "bonemarsh", direction: "north-west", description: "A cold inland tarn whose wind smells of peat cellars and rain." },
  { id: "bramblewych", name: "Bramblewych", knowledge: "rumor", kind: "town", coord: { x: -72, y: 48 }, regionId: "bramblewych-reach", direction: "south-west", description: "A market settlement gathered around an old hedge-court and a bridge that refuses straight lines." },

  // Continental goals. They are stable facts and reachable in principle, but
  // hundreds of travel cells and their danger bands make them campaign arcs.
  { id: "brokenhold", name: "Brokenhold", knowledge: "legend", kind: "fortress", coord: { x: -245, y: -166 }, regionId: "sundered-wastes", direction: "far north-west", description: "The many-walled seat of the Sundered Crown, rebuilt from a dozen conquered fortresses." },
  { id: "northstar-castle", name: "Northstar Castle", knowledge: "legend", kind: "fortress", coord: { x: 8, y: -332 }, regionId: "drakeholt-peaks", direction: "far north", description: "A black polestar fortress above the last ordinary snow, said to house the Demon King's court." },
  { id: "drakespire", name: "Drakespire", knowledge: "legend", kind: "fortress", coord: { x: 48, y: -245 }, regionId: "drakeholt-peaks", direction: "north", description: "The greatest Vyrgun tribute-seat, built into a smoking mountain shoulder." },
  { id: "bone-citadel", name: "The Bone Citadel", knowledge: "legend", kind: "ruin", coord: { x: -332, y: 42 }, regionId: "pale-steppe", direction: "far west", description: "A pale fortress on the steppe horizon, empty according to every sensible map." },
  { id: "caer-selenya", name: "Caer Selenya", knowledge: "legend", kind: "city", coord: { x: -420, y: 150 }, regionId: "far-wild", direction: "far west", description: "A tree-built city on the western rain coast, reached by paths that are never found the same way twice." },
  { id: "tellmar", name: "Tellmar", knowledge: "legend", kind: "city", coord: { x: 418, y: 72 }, regionId: "tellmar-road", direction: "far east", description: "The Iron City and its Hundred Banners, where the long road finally meets a bright eastern sea." },
  { id: "star-forge", name: "The Star-Forge", knowledge: "legend", kind: "temple", coord: { x: 342, y: -88 }, regionId: "far-wild", direction: "far north-east", description: "A pilgrim forge raised around the first iron to fall burning from the sky." },
  { id: "mole-halls", name: "The Mole-Halls", knowledge: "legend", kind: "ruin", coord: { x: 130, y: 90 }, regionId: "spine-foothills", direction: "south-east", description: "Vast abandoned delvings below the Spine, with doors tall enough for forgotten kings." },
  { id: "asalan", name: "Asalan", knowledge: "legend", kind: "city", coord: { x: 104, y: 294 }, regionId: "hollow-coast", direction: "far south", description: "A warm southern crown-city beyond the salt fens, its red roofs gathered around royal gardens." },
  { id: "sunken-crown", name: "The Sunken Crown", knowledge: "legend", kind: "ruin", coord: { x: 24, y: 338 }, regionId: "hollow-coast", direction: "far south", description: "Drowned towers visible beneath clear water at the lowest turning of the year." },
];

// Major roads are authored macro intent, then rasterized to axial cells by the
// generator. Wilderness between them remains generated and walkable; a road is
// an advantage and a story corridor, not the only legal ground.
export const CONTINENT_ROUTES = [
  { id: "crown-road-east", name: "The Crown Road", waypoints: [{ x: 0, y: 0 }, { x: 28, y: 6 }, { x: 49, y: 20 }, { x: 72, y: -3 }, { x: 178, y: -28 }, { x: 315, y: 62 }, { x: 418, y: 72 }] },
  { id: "tannic-road", name: "The Alder Road", waypoints: [{ x: 0, y: 0 }, { x: -27, y: -34 }, { x: -96, y: -92 }, { x: -168, y: -128 }, { x: -245, y: -166 }] },
  { id: "spine-road", name: "The High Sheepway", waypoints: [{ x: 0, y: 0 }, { x: 33, y: 12 }, { x: 49, y: 20 }, { x: 70, y: 64 }, { x: 96, y: 43 }, { x: 130, y: 90 }] },
  { id: "bramble-road", name: "The Hedge Road", waypoints: [{ x: 0, y: 0 }, { x: -43, y: 66 }, { x: -72, y: 48 }, { x: -170, y: 66 }, { x: -332, y: 42 }, { x: -420, y: 150 }] },
  { id: "south-road", name: "The Salt Road", waypoints: [{ x: 0, y: 0 }, { x: -18, y: 88 }, { x: 22, y: 176 }, { x: 58, y: 238 }, { x: 104, y: 294 }] },
  { id: "low-tide-way", name: "The Low-Tide Way", waypoints: [{ x: 104, y: 294 }, { x: 66, y: 315 }, { x: 24, y: 338 }] },
  { id: "north-road", name: "The Smoke Road", waypoints: [{ x: 0, y: 0 }, { x: 22, y: -72 }, { x: 38, y: -152 }, { x: 48, y: -245 }, { x: 8, y: -332 }] },
  { id: "star-road", name: "The Pilgrim's Iron Road", waypoints: [{ x: 178, y: -28 }, { x: 248, y: -68 }, { x: 342, y: -88 }] },
];

// Named continental water is macro-authored so rivers remain continuous and
// culturally meaningful. Smaller wet ground and coast shape are procedural.
export const CONTINENT_WATERWAYS = [
  { id: "whitewend", name: "The Whitewend", description: "The brown working river of the central basins.", waypoints: [{ x: 46, y: -218 }, { x: 31, y: -150 }, { x: 18, y: -82 }, { x: 12, y: -24 }, { x: 13, y: 34 }, { x: 28, y: 102 }, { x: 36, y: 184 }, { x: 42, y: 272 }] },
  { id: "tannic", name: "The Tannic", description: "A dark alder-fed tributary carrying leaf stain out of the western woods.", waypoints: [{ x: -116, y: -132 }, { x: -82, y: -88 }, { x: -27, y: -34 }, { x: 12, y: -24 }] },
  { id: "bannerflow", name: "The Bannerflow", description: "A broad eastern river lined by ferries, cypress, and market towns.", waypoints: [{ x: 238, y: -128 }, { x: 254, y: -54 }, { x: 286, y: 24 }, { x: 344, y: 74 }, { x: 412, y: 102 }] },
];

export const CONTINENT_LAKES = [
  { id: "black-tarn", name: "Black Tarn", description: "Cold, peat-dark water under a low western sky.", center: { x: -96, y: -96 }, radius: 5 },
  { id: "mirror-lake", name: "Mirror Lake", description: "A high clear lake reflecting the Iron Plateau's fast weather.", center: { x: 190, y: -42 }, radius: 4 },
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
