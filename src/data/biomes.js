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
//
// Bounds layout (axial; +x east, +y south):
//   Vale core:        roughly x[-30..60], y[-40..40]
//   Far north arcs:   y < -40    (Drakeholt, Bonemarsh, Sundered Wastes)
//   Far east arcs:    x > 60     (Iron Plateau, Tellmar Road)
//   Far south arcs:   y > 40     (Hollow Coast)
//   Far west arcs:    x < -30    (Witchwood Deep, Pale Steppe)
// Anywhere outside every rect falls through to The Far Wild.

function rect({ xmin, xmax, ymin, ymax }) {
  return {
    bounds: { xmin, xmax, ymin, ymax },
    match: (x, y) => x >= xmin && x <= xmax && y >= ymin && y <= ymax,
  };
}

export const BIOMES = [
  // ===================================================================
  // VALE CORE — the player's starting neighbourhood
  // ===================================================================
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
        { kind: "reeve-patrol",     weight: 6,  posture: "neutral",  desc: "a reeve's-levy patrol — two men in grey-and-green sashes, suspicious by trade" },
      ],
      road: [
        { kind: "iron-wagon", weight: 10, posture: "friendly", desc: "an iron-hauler's wagon bound for Whitemarch" },
        { kind: "company-rider", weight: 6, posture: "neutral", desc: "a Free Company outrider, hand on hilt, scanning for contract-work" },
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
        { kind: "wood-sentinel",  weight: 5,  posture: "neutral",  desc: "a Wood-Cult sentinel watching from a high branch, motionless" },
      ],
      marsh: [
        { kind: "drowned-shrine", weight: 6, posture: "neutral", desc: "the half-sunken offering-shrine of someone long gone" },
      ],
      hills: [
        { kind: "tannic-bandit-camp", weight: 6, posture: "hostile", desc: "a thread of woodsmoke betraying a bandit camp tucked under the firs" },
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
        { kind: "burning-recruiter", weight: 5, posture: "neutral", desc: "a bronze-masked Burning Order rider, taking names for the chapter-house" },
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
        { kind: "spine-herder",     weight: 8,  posture: "friendly", desc: "a Spine herder with a half-tame goat-flock and a bone-handled knife" },
      ],
      mountains: [
        { kind: "spine-warband", weight: 8, posture: "hostile", desc: "a small Spine-tribe warband working a chokepoint" },
        { kind: "ogre-spoor",    weight: 4, posture: "hostile", desc: "a fresh ogre track wider than a wagon-wheel — the maker is somewhere ahead" },
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
      plains: [
        { kind: "thorn-fey", weight: 5, posture: "neutral", desc: "a slim figure crowned with hawthorn, gone the moment you blink" },
      ],
    },
  },

  // ===================================================================
  // NORTHERN ARCS — beyond the Tannic
  // ===================================================================
  {
    id: "bonemarsh",
    name: "The Bonemarsh",
    faction: "pale-hand",
    description: "North-west bog country beyond Black Tarn. The peat is rich with skulls. Wind off the Tarn smells faintly of the cellar, and the dead here do not always settle the first time.",
    ...rect({ xmin: -60, xmax: -26, ymin: -60, ymax: -8 }),
    terrainWeights: { marsh: 0.45, plains: 0.18, forest: 0.18, hills: 0.10, water: 0.05, mountains: 0.04 },
    poiChance: 0.05,
    extraSpawns: {
      marsh: [
        { kind: "shambler",       weight: 16, posture: "hostile",  desc: "a sodden corpse heaving itself upright out of the peat" },
        { kind: "pale-acolyte",   weight: 6,  posture: "neutral",  desc: "a hood-shadowed figure walking with a leashed thing on a chain" },
        { kind: "bog-singer",     weight: 8,  posture: "neutral",  desc: "a thin woman seated knee-deep in black water, singing a name over and over" },
      ],
      plains: [
        { kind: "carrion-corvid", weight: 12, posture: "neutral",  desc: "a coven of black-feathered birds large as dogs, working at something" },
      ],
    },
  },
  {
    id: "sundered-wastes",
    name: "The Sundered Wastes",
    faction: "sundered-crown",
    description: "Stony badlands north-west of the Vale, broken with old fortress-stones and the smoke of many cookfires. The Goblin King's banners are seen here — and his outriders.",
    ...rect({ xmin: -100, xmax: -61, ymin: -80, ymax: -8 }),
    terrainWeights: { hills: 0.35, plains: 0.20, mountains: 0.20, forest: 0.12, marsh: 0.05, road: 0.04, water: 0.04 },
    poiChance: 0.05,
    extraSpawns: {
      hills: [
        { kind: "goblin-raiders",  weight: 22, posture: "hostile",  desc: "five goblins on lean dogs, whooping when they see you" },
        { kind: "orc-outrider",    weight: 12, posture: "hostile",  desc: "an orc rider in mismatched plate, lance slung crosswise" },
        { kind: "broken-banner",   weight: 6,  posture: "neutral",  desc: "a torn standard of the Sundered Crown jammed into a cairn" },
      ],
      mountains: [
        { kind: "orc-warband",     weight: 14, posture: "hostile",  desc: "a dozen orcs descending a scree-slope with iron-shod staves" },
      ],
      plains: [
        { kind: "slave-coffle",    weight: 8,  posture: "hostile",  desc: "a chain of captives driven east — three goblins to twelve people" },
      ],
    },
  },
  {
    id: "drakeholt-peaks",
    name: "The Drakeholt",
    faction: "vyrgun-drakekin",
    description: "Snow-burned peaks north of the Tannic Wood. Smoke rises from no cookfire here. The Vyrgun keep tribute-towns at the feet of the mountains, and the great wyrms older still in the high cols.",
    ...rect({ xmin: -25, xmax: 40, ymin: -120, ymax: -41 }),
    terrainWeights: { mountains: 0.55, hills: 0.25, forest: 0.08, plains: 0.06, water: 0.03, marsh: 0.03 },
    poiChance: 0.04,
    extraSpawns: {
      mountains: [
        { kind: "drake-wyrmling", weight: 6,  posture: "hostile",  desc: "a smoke-scaled wyrmling sunning on a high ledge — the size of a horse" },
        { kind: "vyrgun-rider",   weight: 8,  posture: "neutral",  desc: "a Vyrgun outrider on a horned ridge-pony, drake-bone in her hair" },
        { kind: "wyrm-shadow",    weight: 4,  posture: "hostile",  desc: "a vast shadow that crosses the pass — and the silence that follows" },
        { kind: "ash-monk",       weight: 6,  posture: "friendly", desc: "a monk of the burnt-feet order, walking barefoot through old volcanic glass" },
      ],
      hills: [
        { kind: "tribute-caravan", weight: 8, posture: "neutral", desc: "a tribute-caravan winding up to the Vyrgun: salt, copper, and yearling girls" },
      ],
    },
  },

  // ===================================================================
  // EASTERN ARCS — beyond Whitemarch
  // ===================================================================
  {
    id: "iron-plateau",
    name: "The Iron Plateau",
    faction: "iron-plateau-marches",
    description: "A high tableland east of Whitemarch where the marcher-baronies graze their cavalry stock. Wind-scoured grass, low walls of dressed stone, lone watchtowers that flash mirrors at sunset.",
    ...rect({ xmin: 61, xmax: 120, ymin: -40, ymax: 7 }),
    terrainWeights: { plains: 0.45, hills: 0.25, forest: 0.10, mountains: 0.08, road: 0.05, settlement: 0.04, water: 0.03 },
    poiChance: 0.04,
    extraSpawns: {
      plains: [
        { kind: "marcher-lance",    weight: 14, posture: "neutral",  desc: "a marcher-lance of four riders, banner furled but obvious" },
        { kind: "horse-trader",     weight: 10, posture: "friendly", desc: "a horse-trader driving a string of yearlings east" },
      ],
      hills: [
        { kind: "watchtower-blink", weight: 6,  posture: "neutral",  desc: "a flash of mirror-light from a tower miles off — someone is being signalled about" },
      ],
    },
  },
  {
    id: "tellmar-road",
    name: "The Tellmar Road",
    faction: "tellmar-banners",
    description: "The long trade-march east — caravan-ground, cypress windbreaks, and milestones counting toward Tellmar that nobody has ever finished counting. Bandits work the verges; banners work the inns.",
    ...rect({ xmin: 61, xmax: 145, ymin: 8, ymax: 60 }),
    terrainWeights: { plains: 0.38, hills: 0.20, forest: 0.18, road: 0.10, marsh: 0.04, mountains: 0.05, water: 0.05 },
    poiChance: 0.05,
    extraSpawns: {
      road: [
        { kind: "tellmar-caravan",  weight: 14, posture: "friendly", desc: "a Tellmar-bound caravan with hired spears and three languages of haggling" },
        { kind: "banner-courier",   weight: 8,  posture: "neutral",  desc: "a courier wearing the colours of a Tellmar banner-house, riding fast" },
      ],
      forest: [
        { kind: "road-cutthroats",  weight: 10, posture: "hostile",  desc: "a half-dozen cutthroats watching the road from the trees" },
      ],
    },
  },

  // ===================================================================
  // SOUTHERN ARCS
  // ===================================================================
  {
    id: "hollow-coast",
    name: "The Hollow Coast",
    faction: "tideless",
    description: "Salt fens and grey beaches south of the Bramblewych. The Tideless walk the shore at low water with their dead. The sea here breathes more than it crashes.",
    ...rect({ xmin: -60, xmax: 60, ymin: 41, ymax: 110 }),
    terrainWeights: { marsh: 0.30, plains: 0.22, forest: 0.15, hills: 0.10, water: 0.18, mountains: 0.03, road: 0.02 },
    poiChance: 0.05,
    extraSpawns: {
      marsh: [
        { kind: "tideless-acolyte", weight: 8,  posture: "neutral",  desc: "a salt-wet acolyte of the Tideless, walking a corpse out toward the surf" },
        { kind: "salt-fisher",      weight: 12, posture: "friendly", desc: "a fisher dragging a flat-boat through the shallow grass" },
      ],
      plains: [
        { kind: "wrecker-band",     weight: 8,  posture: "hostile",  desc: "wreckers scrubbing the sand for what last night's tide gave up" },
      ],
      water: [
        { kind: "drowned-bell",     weight: 6,  posture: "neutral",  desc: "a bell, far out, ringing under no hand" },
      ],
    },
  },

  // ===================================================================
  // WESTERN ARCS
  // ===================================================================
  {
    id: "witchwood-deep",
    name: "The Witchwood Deep",
    faction: "bramble-witches",
    description: "Old wood west of the Bramblewych Reach — denser, hungrier, less farmed. The witches respect it more than they tend it. Some of the trees here remember being people.",
    ...rect({ xmin: -80, xmax: -31, ymin: 0, ymax: 40 }),
    terrainWeights: { forest: 0.55, hills: 0.15, marsh: 0.12, plains: 0.08, mountains: 0.05, water: 0.05 },
    poiChance: 0.04,
    extraSpawns: {
      forest: [
        { kind: "witch-familiar",   weight: 8,  posture: "neutral",  desc: "a fox-sized thing watching too steadily from the moss — somebody's familiar" },
        { kind: "deep-witch",       weight: 5,  posture: "neutral",  desc: "a tall woman walking barefoot, ankles bound in iron rings" },
        { kind: "old-bear",         weight: 6,  posture: "hostile",  desc: "a bear too large for its tracks, half-grey, scarred across the snout" },
        { kind: "treekin-watcher",  weight: 4,  posture: "neutral",  desc: "a knot of bark and limb that turns out to have a face when you look back" },
      ],
    },
  },
  {
    id: "pale-steppe",
    name: "The Pale Steppe",
    faction: "free-folk",
    description: "Bone-coloured grass and long horizons west of the Witchwood. The Witch-Queens are said to have ruled it once; only nomads now, and the wind, and the things the wind drops.",
    ...rect({ xmin: -150, xmax: -101, ymin: -40, ymax: 70 }),
    terrainWeights: { plains: 0.55, hills: 0.18, forest: 0.08, marsh: 0.05, mountains: 0.08, water: 0.04, road: 0.02 },
    poiChance: 0.03,
    extraSpawns: {
      plains: [
        { kind: "steppe-rider",    weight: 14, posture: "neutral",  desc: "a steppe-rider on a long pony, bow across her saddlebow" },
        { kind: "windless-stone",  weight: 4,  posture: "neutral",  desc: "a single standing stone with no wind around it for a hundred paces" },
        { kind: "lone-walker",     weight: 8,  posture: "neutral",  desc: "a thin figure walking toward you out of nowhere, slow and not stopping" },
      ],
    },
  },

  // ===================================================================
  // CATCH-ALL — must remain last
  // ===================================================================
  {
    id: "far-wild",
    name: "The Far Wild",
    faction: "free-folk",
    description: "Country beyond the bounds anyone you know has named. Few have seen it; fewer have come back with names for what's there.",
    bounds: null,
    match: () => true,
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
