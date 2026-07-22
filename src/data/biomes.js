// Named cultural regions and their encounter identities. Avarra's live region
// assignment is an irregular deterministic influence field owned by
// engine/world-generation.js. Legacy `bounds`/`match` values remain as content
// hints and for Whitemarch's initial reveal only.
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
// Those rectangles no longer resolve live geography; the finite generator's
// warped influence field assigns Far Wild only inside Avarra's outer frontiers.

import { regionIdAt } from "../engine/world-generation.js";
import { WHITEMARCH_CAPITAL } from "./whitemarch-capital.js";

function rect({ xmin, xmax, ymin, ymax }) {
  return {
    bounds: { xmin, xmax, ymin, ymax },
    match: (x, y) => x >= xmin && x <= xmax && y >= ymin && y <= ymax,
  };
}

export const BIOMES = [
  // ===================================================================
  // WHITEMARCH — the walled capital at the origin and the player's starting
  // ground. Listed FIRST so its tight box wins over the regional biomes it
  // overlaps; every hex of the handcrafted city (data/handcrafted-tiles.js)
  // reports as Whitemarch rather than the surrounding march/marsh.
  // ===================================================================
  {
    id: "whitemarch",
    name: "Whitemarch",
    faction: "whitemarch-iron",
    description: "The walled capital where the iron-shilling is minted — black-and-white gate-towers over a Great Wall that rings wards of market, dock, chain, court, and citadel, with the Whitewend running brown beneath the quays. Inside the wall the country gives way wholly to stone, smoke, and crowd.",
    ...rect(WHITEMARCH_CAPITAL.bounds),
    terrainWeights: { settlement: 0.34, street: 0.24, wall: 0.18, road: 0.10, plains: 0.08, water: 0.06 },
    poiChance: 0.02,
    extraSpawns: {
      street: [
        { kind: "market-watch-patrol", weight: 12, posture: "neutral", desc: "a Market Watch patrol threading between handcarts and rain-dark awnings" },
        { kind: "city-porters", weight: 12, posture: "friendly", desc: "a file of city porters shouldering corded bales toward the counting yards" },
        { kind: "district-messengers", weight: 9, posture: "friendly", desc: "district messengers in iron-grey tabs calling warnings at every crossing" },
        { kind: "street-vendors", weight: 9, posture: "friendly", desc: "street vendors working from trays of hot pies, lamp-wicks, and cheap ribbons" },
        { kind: "ward-inspectors", weight: 6, posture: "neutral", desc: "two ward inspectors checking chalk marks, shutters, and posted licences" },
        { kind: "alley-cutpurses", weight: 4, posture: "hostile", desc: "a cutpurse pair shadowing the crowd from the mouth of a service lane" },
      ],
      settlement: [
        { kind: "market-watch",  weight: 12, posture: "neutral",  desc: "a pair of Market Watch in iron-grey, eyes moving over the crowd" },
        { kind: "porter",        weight: 12, posture: "friendly", desc: "a sweating porter bent under a corded load, calling for room" },
        { kind: "gate-clerk",    weight: 8,  posture: "neutral",  desc: "a clerk with an inkhorn and a chained ledger, reading papers aloud" },
        { kind: "flesh-warden",  weight: 6,  posture: "neutral",  desc: "a Flesh Warden of the Chain Ward, collar-keys heavy at the belt" },
        { kind: "cutpurse",      weight: 6,  posture: "hostile",  desc: "a quick hand working the awning-shadows of the market crowd" },
      ],
    },
  },
  // ===================================================================
  // VALE CORE — the country beyond Whitemarch's wall
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
        { kind: "halfborn-caravan-guard", weight: 8, posture: "friendly", desc: "a Halfborn caravan-guard, half-tusked grin, two-handed maul across her back" },
        { kind: "pale-god-pilgrim", weight: 5, posture: "friendly", desc: "a quiet pilgrim of the Pale God on the long fast, asking only directions" },
      ],
      road: [
        { kind: "iron-wagon", weight: 10, posture: "friendly", desc: "an iron-hauler's wagon bound for Whitemarch" },
        { kind: "company-rider", weight: 6, posture: "neutral", desc: "a Free Company outrider, hand on hilt, scanning for contract-work" },
        { kind: "heron-rider", weight: 4, posture: "neutral", desc: "a Heron-school rider in plain grey, a sealed letter-tube at the saddle" },
        { kind: "halfborn-trader", weight: 8, posture: "friendly", desc: "a Halfborn trader leading a string of pack-mules, polite and watchful" },
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
        { kind: "stonebrook-trader", weight: 8, posture: "friendly", desc: "two Stonebrook dwarves with a mule-load of finished steel, road-tired" },
        { kind: "heron-courier",    weight: 4, posture: "neutral", desc: "a quiet rider in Heron-grey, white herald-bird on the saddle-perch" },
      ],
      mountains: [
        { kind: "spine-warband", weight: 8, posture: "hostile", desc: "a small Spine-tribe warband working a chokepoint" },
        { kind: "ogre-spoor",    weight: 4, posture: "hostile", desc: "a fresh ogre track wider than a wagon-wheel — the maker is somewhere ahead" },
        { kind: "dwarven-relay", weight: 5, posture: "friendly", desc: "a Stonebrook relay-runner, sealed despatch case at her belt" },
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
        { kind: "greenshaw-forager",   weight: 8,  posture: "friendly", desc: "a small-folk forager with a basket of mushrooms, eyeing you politely" },
      ],
      marsh: [
        { kind: "wall-ghost", weight: 6, posture: "neutral", desc: "a figure in old armour, half-dissolved into the marsh-light" },
      ],
      plains: [
        { kind: "thorn-fey", weight: 5, posture: "neutral", desc: "a slim figure crowned with hawthorn, gone the moment you blink" },
        { kind: "greenshaw-pedlar", weight: 8, posture: "friendly", desc: "a Greenshaw pedlar with a pack-pony, a tray of honey-jars on the saddle" },
        { kind: "selenyan-scout", weight: 4, posture: "neutral", desc: "a Selenyan scout in pale linen and grey leather, motionless until she chooses not to be" },
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
      forest: [
        { kind: "black-fir-charcoalers", weight: 10, posture: "friendly", desc: "charcoalers tending low turf-covered clamps beneath the black fir" },
        { kind: "pale-hand-foragers", weight: 5, posture: "neutral", desc: "hooded Pale Hand gatherers cutting corpse-lilies beside a marked path" },
      ],
      water: [
        { kind: "tarn-ferrymen", weight: 10, posture: "friendly", desc: "silent ferrymen poling a hide-covered boat between peat islands" },
        { kind: "bog-lanterns", weight: 5, posture: "hostile", desc: "cold lantern lights moving against the wind across the black water" },
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
      road: [
        { kind: "sundered-toll-band", weight: 12, posture: "hostile", desc: "a self-appointed toll band blocking the old fortress road with chained wagons" },
        { kind: "brokenhold-envoys", weight: 5, posture: "neutral", desc: "armoured envoys of Brokenhold carrying a split-iron safe-conduct" },
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
      plains: [
        { kind: "wintermere-drovers", weight: 9, posture: "friendly", desc: "Wintermere drovers urging shaggy oxen between snow poles" },
        { kind: "white-pike-muster", weight: 6, posture: "neutral", desc: "a White Pike levy drilling beside a wind-scoured winter camp" },
      ],
      road: [
        { kind: "smoke-road-sledge", weight: 12, posture: "friendly", desc: "a mail sledge racing north behind six iron-shod elk" },
        { kind: "vyrgun-customs-riders", weight: 8, posture: "neutral", desc: "Vyrgun customs riders checking tribute seals on the Smoke Road" },
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
      road: [
        { kind: "plateau-remount-train", weight: 12, posture: "friendly", desc: "a remount train of lean steppe horses bound for the eastern marches" },
        { kind: "baronial-road-court", weight: 6, posture: "neutral", desc: "a marcher baron holding a roadside court beneath a striped awning" },
      ],
      settlement: [
        { kind: "horse-fair", weight: 12, posture: "friendly", desc: "a temporary horse fair of rope pens, smiths, cooks, and loud bargaining" },
        { kind: "banner-recruiters", weight: 5, posture: "neutral", desc: "eastern banner recruiters measuring riders and inspecting their tack" },
      ],
    },
  },
  {
    id: "tellmar-road",
    name: "The Sea of Reeds",
    faction: "tellmar-banners",
    description: "The immense eastern reed sea — lotus channels, rice terraces, shrine islands, tiled river towns, and raised roads leading to Tellmar and the Lantern Sea.",
    ...rect({ xmin: 61, xmax: 145, ymin: 8, ymax: 60 }),
    terrainWeights: { reedfield: 0.36, forest: 0.15, plains: 0.14, water: 0.10, road: 0.10, hills: 0.08, marsh: 0.04, mountains: 0.03 },
    poiChance: 0.05,
    extraSpawns: {
      reedfield: [
        { kind: "banner-river-patrol", weight: 12, posture: "neutral", desc: "a lacquered patrol boat pacing a narrow channel through the reed fields" },
        { kind: "reed-farmers", weight: 10, posture: "friendly", desc: "reed farmers carrying rice seedlings between terraced islands" },
      ],
      road: [
        { kind: "tellmar-caravan",  weight: 14, posture: "friendly", desc: "a Tellmar-bound caravan with hired spears and three languages of haggling" },
        { kind: "banner-courier",   weight: 8,  posture: "neutral",  desc: "a courier wearing the colours of a Tellmar banner-house, riding fast" },
      ],
      forest: [
        { kind: "road-cutthroats",  weight: 10, posture: "hostile",  desc: "a half-dozen cutthroats watching the road from the trees" },
      ],
      marsh: [
        { kind: "banner-river-patrol", weight: 12, posture: "neutral", desc: "a lacquered patrol boat pacing the raised causeway" },
        { kind: "reed-farmers", weight: 10, posture: "friendly", desc: "reed farmers poling baskets of rice seedlings toward a terraced island" },
      ],
      water: [
        { kind: "lotus-ferry", weight: 12, posture: "friendly", desc: "a broad lotus ferry carrying pilgrims, ducks, and market baskets between shrine islands" },
        { kind: "river-pirates", weight: 5, posture: "hostile", desc: "reed-masked river pirates drifting close under bundled green sail" },
      ],
      plains: [
        { kind: "rice-terrace-workers", weight: 12, posture: "friendly", desc: "a terrace crew repairing water gates beneath embroidered field banners" },
        { kind: "wandering-opera", weight: 5, posture: "friendly", desc: "a travelling opera troupe hauling painted screens toward the next river town" },
      ],
      settlement: [
        { kind: "banner-magistrates", weight: 8, posture: "neutral", desc: "banner magistrates hearing petitions beneath a tiled public pavilion" },
        { kind: "canal-market", weight: 12, posture: "friendly", desc: "boat vendors crowding a canal market with tea, fish, paper charms, and bronze tools" },
      ],
    },
  },

  // ===================================================================
  // SOUTHERN ARCS
  // ===================================================================
  {
    id: "hollow-coast",
    name: "The Sunscar Expanse",
    faction: "asalan-sun-court",
    description: "A far southern desert of red dunes, salt pans, defended caravan wells, sandstone escarpments, and warm ports on the Saffron Sea.",
    ...rect({ xmin: -60, xmax: 60, ymin: 41, ymax: 110 }),
    terrainWeights: { plains: 0.46, hills: 0.20, road: 0.10, mountains: 0.08, forest: 0.06, settlement: 0.05, water: 0.03, marsh: 0.02 },
    poiChance: 0.05,
    extraSpawns: {
      plains: [
        { kind: "sunscar-caravan", weight: 14, posture: "friendly", desc: "a bright-awning caravan travelling between guarded wells" },
        { kind: "brass-shield-patrol", weight: 10, posture: "neutral", desc: "Sun Court riders checking seals and water allotments" },
      ],
      hills: [
        { kind: "dune-raiders", weight: 8, posture: "hostile", desc: "veiled riders watching the caravan road from a red escarpment" },
      ],
      road: [
        { kind: "nine-wells-caravan", weight: 14, posture: "friendly", desc: "a Nine Wells caravan moving under blue awnings with an armed water-master" },
        { kind: "sun-court-couriers", weight: 7, posture: "neutral", desc: "Sun Court couriers changing lathered horses at a brass mile post" },
      ],
      settlement: [
        { kind: "oasis-night-market", weight: 12, posture: "friendly", desc: "an oasis night market opening beneath lamps and woven shade cloth" },
        { kind: "well-court", weight: 7, posture: "neutral", desc: "a well judge settling water shares before a ring of caravan elders" },
      ],
      water: [
        { kind: "saffron-coasters", weight: 12, posture: "friendly", desc: "lateen-rigged coasters unloading dates, copper, and glazed jars on a tidal quay" },
        { kind: "drowned-choir-echo", weight: 4, posture: "neutral", desc: "a many-voiced song carrying inland from water empty of any visible sail" },
      ],
    },
  },

  // ===================================================================
  // WESTERN ARCS
  // ===================================================================
  {
    id: "witchwood-deep",
    name: "The Elderwood",
    faction: "selenyan-covenant",
    description: "The immense western woodland — rain-dark canopy, living bridges, hidden courts, old-growth roads, and green ports under the Selenyan Covenant.",
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
      hills: [
        { kind: "covenant-rangers", weight: 10, posture: "neutral", desc: "Covenant rangers watching the canopy road from a rain-black ridge" },
        { kind: "living-bridge-keepers", weight: 7, posture: "friendly", desc: "bridge-keepers pruning a vast living span where it crosses a ravine" },
      ],
      marsh: [
        { kind: "moss-gatherers", weight: 10, posture: "friendly", desc: "moss gatherers carrying wicker frames of medicine and luminous fungus" },
        { kind: "root-wights", weight: 5, posture: "hostile", desc: "root-bound dead rising where an old war road sinks beneath the bog" },
      ],
      road: [
        { kind: "greenharbor-carriers", weight: 12, posture: "friendly", desc: "forest carriers hauling salt and lamp oil inland from Greenharbor" },
        { kind: "oak-spear-patrol", weight: 8, posture: "neutral", desc: "Oak-Spear wardens checking axes, blight signs, and road leave-tokens" },
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
      hills: [
        { kind: "bone-citadel-delvers", weight: 8, posture: "neutral", desc: "ruin-delvers returning from the Bone Citadel with wrapped ivory fragments" },
        { kind: "grass-sea-hunters", weight: 10, posture: "friendly", desc: "mounted hunters driving long-horned antelope toward a hidden camp" },
      ],
      road: [
        { kind: "covenant-truce-caravan", weight: 9, posture: "friendly", desc: "a mixed steppe-and-Elderwood caravan travelling under a woven truce branch" },
        { kind: "nomad-toll-circle", weight: 6, posture: "neutral", desc: "clan riders forming a courteous but unmistakable toll circle around the trail" },
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

export function getBiome(x, y, seed) {
  return getBiomeById(regionIdAt(x, y, seed)) || BIOMES[BIOMES.length - 1];
}

export function getBiomeById(id) {
  return BIOMES.find((b) => b.id === id) || null;
}
