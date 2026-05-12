// Hard-boundary biomes in axial coordinate space. Each region is a rectangular
// box in (x, y); regions are mutually exclusive and bounded so the catch-all
// "Far Wild" picks up anything outside them. `match` is auto-derived from
// `bounds`; the WorldMapView uses `bounds` directly to draw region polygons.
//
// `faction` is the id of the political/cultural group associated with this
// biome (see data/factions.js). Used for world-view coloring and narrator
// context; not enforced anywhere yet.
//
// Biome assignment is purely coord-based — it doesn't read the tile's terrain.
// A handcrafted "settlement" tile inside The Mire is still in The Mire biome;
// the narrator can speak to the Mire's character even at the inn.

function rect({ xmin, xmax, ymin, ymax }) {
  return {
    bounds: { xmin, xmax, ymin, ymax },
    match: (x, y) => x >= xmin && x <= xmax && y >= ymin && y <= ymax,
  };
}

export const BIOMES = [
  {
    id: "mire",
    name: "The Mire",
    faction: "crowsmoor-wardens",
    description: "A wet, low-lying expanse of reed-beds, peat, and stagnant pools. The east-west road bullies through the worst of it. Beyond its edges the country lifts and dries.",
    ...rect({ xmin: -10, xmax: 10, ymin: -2, ymax: 2 }),
    terrainWeights: { marsh: 0.50, forest: 0.20, plains: 0.13, hills: 0.10, road: 0.05, water: 0.02 },
    poiChance: 0.06,
    extraSpawns: {
      marsh: [
        { kind: "mire-ghost",   weight: 6, posture: "neutral",  desc: "a pale figure half-glimpsed between the reeds, gone when you look twice" },
        { kind: "peat-cutter",  weight: 12, posture: "friendly", desc: "a wiry peat-cutter, knees black with bog-mud" },
      ],
      forest: [
        { kind: "marsh-poacher", weight: 8, posture: "hostile", desc: "a local poacher who'd rather not be seen" },
      ],
    },
  },
  {
    id: "crowsmoor-reach",
    name: "Crowsmoor Reach",
    faction: "crowsmoor-wardens",
    description: "Open grass and wagon-tracks east of the Mire, climbing slowly toward Crowsmoor's walls. Tilled in patches, grazed by hill-thin sheep; the road threads through it.",
    ...rect({ xmin: 11, xmax: 50, ymin: -7, ymax: 7 }),
    terrainWeights: { plains: 0.45, hills: 0.18, forest: 0.15, settlement: 0.04, road: 0.10, marsh: 0.04, water: 0.04 },
    poiChance: 0.05,
    extraSpawns: {
      plains: [
        { kind: "crowsmoor-patrol", weight: 14, posture: "neutral",  desc: "two Crowsmoor militiamen on horseback, marking the road" },
        { kind: "tax-farmer",       weight: 8,  posture: "neutral",  desc: "a tax-farmer's clerk with a ledger and a guard" },
      ],
      road: [
        { kind: "iron-wagon", weight: 10, posture: "friendly", desc: "an iron-hauler's wagon bound for Whitemarch" },
      ],
    },
  },
  {
    id: "tannic-wood",
    name: "The Tannic Wood",
    faction: "wood-cult",
    description: "A great wood of dark birch and pale alder reaching from the Mire's northern edge to the Tannic river. Damp underfoot; the canopy keeps it twilight even at noon.",
    ...rect({ xmin: -25, xmax: 10, ymin: -40, ymax: -3 }),
    terrainWeights: { forest: 0.55, hills: 0.18, plains: 0.10, marsh: 0.08, mountains: 0.05, water: 0.04 },
    poiChance: 0.04,
    extraSpawns: {
      forest: [
        { kind: "tannic-boatman", weight: 10, posture: "friendly", desc: "a boatman portaging a flat-bottomed punt between channels" },
        { kind: "wood-acolyte",   weight: 8,  posture: "neutral",  desc: "a robed acolyte tending a stand of birch with quiet purpose" },
      ],
      marsh: [
        { kind: "drowned-shrine", weight: 6, posture: "neutral", desc: "the half-sunken offering-shrine of someone long gone" },
      ],
    },
  },
  {
    id: "whitemarch-march",
    name: "Whitemarch March",
    faction: "whitemarch-iron",
    description: "Patrolled border country on the road to Whitemarch — chalk downs, sheep-pasture, milestones with the city's iron crest. Far from any settlement here you can still hear the road.",
    ...rect({ xmin: 11, xmax: 60, ymin: -40, ymax: -8 }),
    terrainWeights: { plains: 0.35, hills: 0.30, forest: 0.18, road: 0.08, settlement: 0.04, mountains: 0.05 },
    poiChance: 0.04,
    extraSpawns: {
      plains: [
        { kind: "whitemarch-outrider", weight: 14, posture: "neutral",  desc: "a Whitemarch outrider, the city's iron mark on her shoulder" },
        { kind: "iron-hauler",         weight: 10, posture: "friendly", desc: "an iron-hauler's caravan, slow with weight" },
      ],
      hills: [
        { kind: "march-evader", weight: 8, posture: "neutral", desc: "a couple of unbranded sheep — and someone watching them from the slope" },
      ],
    },
  },
  {
    id: "spine-foothills",
    name: "The Spine Foothills",
    faction: "spine-confederation",
    description: "Broken country climbing toward the Spine. Stone outcrops, abrupt valleys, goat-paths older than any road. The land is thin and the wind always going somewhere.",
    ...rect({ xmin: 11, xmax: 60, ymin: 8, ymax: 40 }),
    terrainWeights: { hills: 0.40, mountains: 0.28, forest: 0.13, plains: 0.10, marsh: 0.04, road: 0.02, water: 0.03 },
    poiChance: 0.05,
    extraSpawns: {
      hills: [
        { kind: "spine-scout",      weight: 10, posture: "neutral",  desc: "a Spine-tribe scout on a high ridge, watching" },
        { kind: "stone-prospector", weight: 8,  posture: "friendly", desc: "a prospector with a sack of ore-samples and a tired hammer" },
      ],
      mountains: [
        { kind: "spine-warband", weight: 8, posture: "hostile", desc: "a small Spine-tribe warband working a chokepoint" },
      ],
    },
  },
  {
    id: "bramblewych-reach",
    name: "Bramblewych Reach",
    faction: "bramble-witches",
    description: "Half-wild country south of the Mire — bramble, briar, abandoned hedgework. The land remembers being farmed and hasn't quite agreed to stop.",
    ...rect({ xmin: -30, xmax: 10, ymin: 3, ymax: 40 }),
    terrainWeights: { forest: 0.32, plains: 0.22, marsh: 0.15, hills: 0.18, road: 0.04, mountains: 0.05, water: 0.04 },
    poiChance: 0.04,
    extraSpawns: {
      forest: [
        { kind: "bramble-witch",       weight: 6,  posture: "neutral",  desc: "a stooped figure tying knots in the brambles, humming" },
        { kind: "bramblewych-pilgrim", weight: 10, posture: "friendly", desc: "a Bramblewych pilgrim with a staff and a tin cup" },
      ],
      marsh: [
        { kind: "wall-ghost", weight: 6, posture: "neutral", desc: "a figure in old armour, half-dissolved into the marsh-light" },
      ],
    },
  },
  {
    id: "far-wild",
    name: "The Far Wild",
    faction: "free-folk",
    description: "Country beyond the bounds anyone you know has named. Few have seen it; fewer have come back with names for what's there.",
    bounds: null,
    match: () => true, // catch-all — MUST be last
    terrainWeights: { plains: 0.22, forest: 0.22, hills: 0.22, mountains: 0.22, marsh: 0.08, water: 0.04 },
    poiChance: 0.03,
    extraSpawns: {},
  },
];

export function getBiome(x, y) {
  for (const b of BIOMES) {
    if (b.match(x, y)) return b;
  }
  return BIOMES[BIOMES.length - 1];
}

export function getBiomeById(id) {
  return BIOMES.find((b) => b.id === id) || null;
}
