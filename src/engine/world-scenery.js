// Ambient scenery: the ordinary things that exist along a road or a shoreline.
//
// Scenery is not content to open. It has no encounter, no loot, and no state.
// It exists so a journey passes bridges, cottages, milestones, and cut-reed
// stacks instead of empty hexes punctuated by discoveries. Placement is derived
// from facts the generator already knows -- a bridge because a road meets a
// river, cottages because a town is four hexes ahead -- so the world reads as
// built by people who had reasons.
//
// Every rule here is a pure function of the probe it is given, and the probe is
// a pure function of (seed, version, x, y). Query order never matters.

const SCENERY_LIMIT = 2;

const entry = (id, kind, label, detail, tags = []) => ({ id, kind, label, detail, tags });

function bridgeMaterial(terrain, elevation) {
  if (terrain === "reedfield" || terrain === "marsh") return "piled";
  if (elevation > 0.62) return "stone";
  return "timber";
}

const BRIDGES = {
  stone: (river) => entry(
    "bridge-stone", "bridge",
    "a stone bridge",
    `A humped stone bridge carries the road over ${river}. Its parapets are worn smooth where travellers have leaned to watch the water.`,
    ["crossing", "built"],
  ),
  timber: (river) => entry(
    "bridge-timber", "bridge",
    "a timber bridge",
    `Squared timbers span ${river}, pegged and re-pegged over many seasons. The planking drums under boots and hooves.`,
    ["crossing", "built"],
  ),
  piled: (river) => entry(
    "bridge-piled", "bridge",
    "a piled causeway",
    `The road leaves solid ground and runs out across ${river} on driven piles, a handrail of rope strung along the windward side.`,
    ["crossing", "built"],
  ),
};

function crossingScenery(probe) {
  const { route, waterway, terrain, climate } = probe;
  if (!route || !waterway) return null;
  const water = waterway.name || (waterway.kind === "lake" ? "the lake" : "the river");
  if (waterway.kind === "lake") {
    return entry(
      "causeway", "causeway",
      "a lake causeway",
      `The road runs straight out onto ${water} along a raised causeway of packed stone, open water on both hands.`,
      ["crossing", "built"],
    );
  }
  if (probe.random("scenery:crossing") < 0.24) {
    return entry(
      "ford", "ford",
      "a stone-marked ford",
      `The road dips to meet ${water} at a gravel shallows. Painted depth-stakes stand at both banks for the seasons the water rises.`,
      ["crossing"],
    );
  }
  const material = bridgeMaterial(terrain, climate?.elevation ?? 0);
  return BRIDGES[material](water);
}

const SHORE_BY_TERRAIN = {
  marsh: [
    entry("duckboards", "shore", "a duckboard path", "Split logs laid end to end run out over the soft ground, sunk and relaid so often that three generations of walkway lie beneath the current one.", ["water-edge"]),
    entry("heron-pool", "water", "a heron pool", "Still dark water opens between the sedge. A grey heron holds its position in the shallows and lets the party pass.", ["water-edge", "wildlife"]),
    entry("peat-stack", "field", "a peat stack", "Cut turves are stacked in a herringbone to dry, each one the width of a spade. Someone will come back for them before the rains.", ["labour"]),
  ],
  reedfield: [
    entry("reed-stacks", "field", "cut-reed stacks", "Bundled reed stands in conical stooks along the bank, tied off at the throat and left to season for thatch.", ["labour"]),
    entry("eel-traps", "shore", "eel traps", "Woven withy traps are staked in a line across the current, their mouths facing upstream, marked by a float of bound rush.", ["labour", "water-edge"]),
    entry("drawn-punt", "shore", "a punt drawn up", "A flat-bottomed punt lies pulled onto the bank with its quant pole shipped alongside, the hull still wet.", ["water-edge"]),
  ],
  forest: [
    entry("alder-bank", "shore", "an alder bank", "Alders lean out over the water on exposed roots, and the light beneath them comes through green.", ["water-edge"]),
    entry("plunge-pool", "water", "a plunge pool", "The stream drops a body's height into a rock basin, and the spray keeps the surrounding stone dark and mossy all year.", ["water-edge"]),
  ],
  plains: [
    entry("watering-place", "shore", "a watering place", "The bank has been cut down to a gentle slope and trodden to mud by generations of cattle brought here to drink.", ["water-edge", "pastoral"]),
    entry("willow-bank", "shore", "pollarded willows", "A line of willows stands along the water, each cut back to a fist of new growth at head height for basket withies.", ["water-edge", "labour"]),
  ],
  hills: [
    entry("spring-head", "water", "a spring head", "Water rises clear out of the hillside into a stone-lined basin, and the overflow runs away downslope through cress.", ["water-edge"]),
    entry("falls", "water", "a run of falls", "The beck comes down the hillside in a stair of small falls, loud enough that conversation has to wait.", ["water-edge"]),
  ],
  mountains: [
    entry("tarn", "water", "a tarn", "A cold tarn sits in a hollow of scree, so still that the ridge above is reproduced in it exactly.", ["water-edge"]),
    entry("melt-channel", "water", "a melt channel", "Meltwater has cut a channel through the rock, running milky with the stone it carries.", ["water-edge"]),
  ],
};

// The neighbour probe is the most expensive question this module asks, so the
// cheap disqualifiers and the presence roll are settled before it is reached.
function shoreScenery(probe) {
  if (probe.route) return null;
  const options = SHORE_BY_TERRAIN[probe.terrain];
  if (!options?.length) return null;
  if (probe.random("scenery:shore") >= 0.55) return null;
  if (!probe.neighbors.water) return null;
  return options[Math.floor(probe.random("scenery:shore:pick") * options.length) % options.length];
}

// Density of habitation falls off with distance from the settlement it belongs
// to, the way real ribbon development does.
const ROADSIDE_BANDS = [
  {
    maxDistance: 2,
    chance: 0.85,
    options: [
      entry("cottages", "dwelling", "cottages along the verge", "Low cottages stand close to the road with their gable ends to the weather, kitchen gardens fenced against deer, smoke going up thin and steady.", ["inhabited"]),
      entry("walled-orchard", "field", "a walled orchard", "A drystone wall encloses old fruit trees planted in staggered rows, the lowest branches browsed level by whatever gets through the gate.", ["inhabited", "labour"]),
      entry("wayhouse", "dwelling", "a wayhouse", "A long house sits gable-on to the road with a bench outside and a trough for animals, the kind of place that sells bread and will not put you up.", ["inhabited"]),
      entry("smithy", "dwelling", "a roadside smithy", "The forge stands open to the road with a wheel-hoop leaning against the wall and the fire banked but not out.", ["inhabited", "labour"]),
    ],
  },
  {
    maxDistance: 4,
    chance: 0.55,
    options: [
      entry("fenced-fields", "field", "fenced fields", "The road runs between hurdled fields worked in long strips, each one a different stage of the same year's work.", ["inhabited", "labour"]),
      entry("grazing-flock", "pen", "a grazing flock", "Sheep are strung out across the slope above the road, and a dog watches the party the whole way past without moving.", ["pastoral"]),
      entry("hay-barn", "field", "a hay barn", "An open-sided barn stands on staddle stones with last year's hay still in one bay and swallows going in and out of the roof.", ["inhabited", "labour"]),
    ],
  },
  {
    maxDistance: 7,
    chance: 0.3,
    options: [
      entry("charcoal-stack", "field", "a charcoal stack", "A turfed dome of stacked cordwood smoulders slowly in a cleared ring, and someone is sleeping nearby to watch it.", ["labour"]),
      entry("boundary-hedge", "field", "a laid hedge", "The boundary hedge has been cut part through and bent along its length so it grows into a stock-proof wall.", ["labour"]),
      entry("field-shrine", "shrine", "a field shrine", "A niche of stacked stone holds a weathered figure, and the ledge in front of it carries a handful of grain and a cup turned upside down.", ["observance"]),
    ],
  },
];

function roadsideScenery(probe) {
  const { route, nearestLandmark } = probe;
  if (!route || !nearestLandmark || nearestLandmark.distance < 1) return null;
  const band = ROADSIDE_BANDS.find((candidate) => nearestLandmark.distance <= candidate.maxDistance);
  if (!band) return null;
  if (probe.random("scenery:roadside") >= band.chance) return null;
  const pick = Math.floor(probe.random("scenery:roadside:pick") * band.options.length);
  return band.options[pick % band.options.length];
}

const LEAGUES_PER_HEX = 1.2;

// Roads lead somewhere, and the road says so. Waymarkers appear at a fixed
// interval measured from the place they count down to.
function waymarkerScenery(probe) {
  const { route, nearestLandmark } = probe;
  if (!route || !nearestLandmark) return null;
  const { distance, landmark } = nearestLandmark;
  if (distance < 2 || distance > 12 || distance % 3 !== 0) return null;
  const leagues = Math.max(1, Math.round(distance * LEAGUES_PER_HEX));
  const weathered = probe.random("scenery:waymarker") < 0.4;
  return weathered
    ? entry(
      "waystone", "waymarker",
      `a waystone for ${landmark.name}`,
      `A squared waystone stands at the verge, lichen filling the cut letters: ${landmark.name}, ${leagues} leagues. Someone has kept the moss scraped out of the numerals.`,
      ["waymarker", "built"],
    )
    : entry(
      "milestone", "waymarker",
      `a milestone for ${landmark.name}`,
      `A milestone leans slightly out of true where the frost has lifted it, still legible: ${landmark.name}, ${leagues} leagues, and an arm pointing the way you are already going.`,
      ["waymarker", "built"],
    );
}

const NATURAL_BY_TERRAIN = {
  forest: [
    entry("deadfall-clearing", "grove", "a deadfall clearing", "A big tree has come down and taken three others with it, and the hole it left in the canopy is filling with foxglove and bramble.", ["open-ground"]),
    entry("split-oak", "grove", "a lightning-split oak", "An oak stands opened from crown to root by lightning, both halves still in leaf, the heartwood pale and dry inside.", []),
    entry("blaze-marks", "waymarker", "old blaze marks", "Axe-cut blazes are healed into the trunks at shoulder height, a line of them going off through the trees toward something.", ["waymarker"]),
    entry("charcoal-ring", "grove", "an old charcoal ring", "A perfect circle of black ground where a burn was made, ringed by nettles that grow nowhere else nearby.", ["labour"]),
    entry("badger-sett", "cave", "a badger sett", "A bank has been undermined by generations of digging, spoil heaps fanned out below each entrance and a path worn away into the undergrowth.", ["wildlife"]),
    entry("holy-well", "water", "a holy well", "A spring rises into a stone basin under a hood of masonry, and the thorn above it is hung with strips of cloth left to rot away as the asking is answered.", ["observance"]),
    entry("green-figure", "stone", "a mossed figure", "A carved figure stands among the trees with moss filling every hollow of it, so that only the shape of a face and two open hands still read.", ["ancient", "observance"]),
    entry("coppice-stools", "field", "worked coppice", "The hazel here is cut on a cycle, every stool a different height of regrowth, the whole wood organised into years by somebody's grandfather.", ["labour"]),
    entry("boar-wallow", "water", "a boar wallow", "A churned pool of mud sits under the trees, the trunks around it rubbed bare and waxy to knee height.", ["wildlife"]),
    entry("hollow-tree", "cave", "a hollow tree", "A yew has gone hollow with age and stands as a room with a door in it, floor dry, the inside smoke-blackened by whoever sheltered last.", ["shelter"]),
    entry("forest-tarn", "water", "a forest tarn", "A small black lake lies in the trees with no visible inlet, the surface holding the canopy so exactly it reads as a hole in the ground.", ["water-edge"]),
  ],
  plains: [
    entry("standing-stone", "stone", "a standing stone", "A single stone stands in the open grass, taller than a rider, its weather side scoured pale and its lee side furred with lichen.", ["ancient"]),
    entry("lone-thorn", "grove", "a lone thorn", "One thorn tree grows out of the whole flat distance, bent permanently downwind, with rags tied in its lower branches.", ["observance"]),
    entry("drover-track", "waymarker", "a drover's track", "A green lane runs off at an angle from the road, wide enough for a herd and sunk a foot below the surrounding field by use.", ["waymarker", "pastoral"]),
    entry("shepherd-cairn", "stone", "a shepherd's cairn", "Stones piled to the height of a person, added to by everyone who passes, visible from a long way off in flat country.", ["waymarker"]),
    entry("stone-ring", "stone", "a ring of stones", "Nine stones stand in a circle wide enough to drive a cart through, the grass inside cropped shorter than the grass outside.", ["ancient", "observance"]),
    entry("dew-pond", "water", "a dew pond", "A shallow dish has been cut and puddled with clay to hold rain, and it holds it, on ground with no other water for a long walk.", ["labour", "water-edge"]),
    entry("gallows-oak", "grove", "a moot oak", "One vast oak stands alone with a bench of flat stones set around its base, the ground beneath it bare from being stood on.", ["observance"]),
    entry("windbreak", "grove", "a planted windbreak", "A double row of trees runs across the open ground for half a mile, planted to hold soil that would otherwise be somewhere else by now.", ["labour"]),
    entry("plough-marks", "field", "old plough ridges", "The ground lies in long parallel swells under the grass, the shape of fields that stopped being fields generations back.", ["ancient", "labour"]),
    entry("beacon-post", "waymarker", "a beacon post", "A tarred basket sits on a post above a stack of dry brush, kept ready, with a shelter beside it for whoever draws the watch.", ["built", "authority"]),
  ],
  hills: [
    entry("drystone-wall", "field", "a drystone wall", "A wall runs over the shoulder of the hill and out of sight, fitted without mortar and standing after who knows how long.", ["labour"]),
    entry("sheepfold", "pen", "a sheepfold", "A circular fold of stacked stone with one narrow entrance, floor deep in old fleece and droppings, empty this season.", ["pastoral"]),
    entry("hill-cairn", "stone", "a cairn", "A cairn on the ridge, kept up by passers-by, marking either the way or something underneath it.", ["waymarker", "ancient"]),
    entry("quarry-scar", "cave", "an old quarry scar", "A bite taken out of the hillside long ago, floor flooded green, cut faces still showing the tooth marks of the wedges.", ["labour"]),
    entry("hill-figure", "stone", "a hill figure", "A shape has been cut through the turf to the pale rock beneath, too large to resolve from here, and somebody is clearly still scouring it.", ["ancient", "observance"]),
    entry("holloway", "waymarker", "a holloway", "Feet and hooves and water have worn the track down between banks higher than a rider's head, roots exposed on both sides.", ["waymarker", "ancient"]),
    entry("shieling", "dwelling", "a summer shieling", "A one-roomed stone hut with a turf roof stands where the grazing is good in high summer, shuttered and empty the rest of the year.", ["pastoral", "shelter"]),
    entry("hill-cave", "cave", "a hillside cave", "A low opening under an overhang, dry inside, with a soot mark on the ceiling and a windbreak of stacked stone at the entrance.", ["shelter"]),
    entry("lime-kiln", "field", "a lime kiln", "A stone-lined kiln is built into the bank with its draw-hole facing downhill and a white crust of spilled lime spreading below it.", ["labour"]),
  ],
  mountains: [
    entry("scree-chute", "stone", "a scree chute", "A fan of broken rock runs from a notch in the cliff to the path, and it shifts and talks underfoot for the whole crossing.", ["hazardous"]),
    entry("cave-mouth", "cave", "a cave mouth", "A dark opening in the rock face, cold air coming out of it steadily, with a ring of old fire-stones just inside the shelter of the lip.", ["shelter"]),
    entry("eagle-crag", "stone", "an eagle crag", "A crag streaked white below the ledge where something large nests, and the bones of its meals scattered across the rock below.", ["wildlife"]),
    entry("snow-poles", "waymarker", "a line of snow poles", "Tall poles are set at intervals along the route, painted in bands, so the way can still be found when the drifts are over a rider's head.", ["waymarker", "built"]),
    entry("rope-bridge", "bridge", "a rope bridge", "A footbridge of rope and slat crosses the gorge, tensioned from rock anchors on both sides, replaced a plank at a time.", ["crossing", "built"]),
    entry("summit-cairn", "stone", "a summit cairn", "A cairn stands at the high point with a slot in its side holding a tin box, and the box holds names and dates going back further than seems reasonable.", ["waymarker"]),
    entry("mountain-statue", "stone", "a pass-guardian", "A figure has been cut from the living rock beside the way, twice life size, weathered to a hooded outline that watches the descent.", ["ancient", "observance"]),
    entry("avalanche-track", "field", "an avalanche track", "A clean strip of snapped-off young growth runs from the ridge to the valley floor, and nothing older than a few years stands in it.", ["hazardous"]),
    entry("ice-cave-mouth", "cave", "an ice cave mouth", "A blue opening at the foot of the glacier breathes cold, and meltwater runs out of it grey and fast even in the cold.", ["shelter", "hazardous"]),
    entry("refuge-hut", "dwelling", "a refuge hut", "A squat stone hut is built into the lee of the ridge with a bolt on the inside only, a stack of firewood, and a rule about replacing it.", ["shelter"]),
  ],
  marsh: [
    entry("sunken-causeway", "waymarker", "a sunken causeway", "The remains of a raised way run out into the marsh and stop, its stones settled and separated by the ground giving way beneath.", ["ancient"]),
    entry("bog-oak", "stone", "a bog oak", "A black trunk lies half out of the peat, preserved whole, hard as iron and older than any forest standing here now.", ["ancient"]),
    entry("marsh-lights", "water", "marsh lights", "Pale lights sit low over the standing water after dusk, moving when nothing else does.", ["night"]),
    entry("wader-flats", "water", "wader flats", "Shallow mud is printed all over with three-toed tracks, and the birds that made them lift in one body and settle again further off.", ["wildlife"]),
    entry("marsh-statue", "stone", "a sunken statue", "A carved figure stands to the waist in water, arms gone, face worn to a suggestion, still upright on whatever it was set into.", ["ancient", "observance"]),
    entry("withy-beds", "field", "withy beds", "Willow is grown here in cut blocks, each stool sending up a hundred straight rods that will be bundled for hurdles.", ["labour"]),
    entry("stilted-hide", "dwelling", "a stilted hide", "A one-room hide stands on stilts above the water with a ladder pulled up after whoever last used it.", ["shelter"]),
    entry("gas-pool", "water", "a breathing pool", "Bubbles come up through the black water in slow irregular strings, and the reeds around the edge are dead and standing.", ["hazardous"]),
    entry("marsh-crosses", "shrine", "marker crosses", "Wooden crosses are driven into the peat at intervals, each with a name burned into it, marking where the ground will not hold a body.", ["observance"]),
  ],
  reedfield: [
    entry("reed-lane", "waymarker", "a cut reed lane", "A channel has been cut and kept open through reed twice the height of a rider, straight enough to see a long way down and nowhere else at all.", ["waymarker", "labour"]),
    entry("nesting-rafts", "water", "nesting rafts", "Woven rafts are moored out among the stems, each one crowded with birds that a family here will harvest eggs from.", ["labour", "wildlife"]),
    entry("reed-shrine", "shrine", "a reed shrine", "A shelter of bound reed stands over a shelf of offerings: a fishhook, a coin, a knot of hair, all of it going green.", ["observance"]),
    entry("watch-platform", "dwelling", "a watch platform", "A platform is lashed high on four poles above the reedtops, with a horn hanging from the rail and a worn place where someone sits.", ["shelter"]),
    entry("sunken-barge", "stone", "a sunken barge", "A barge has settled to its gunwales and grown a garden of reed and sedge along its whole length.", ["ancient"]),
    entry("reed-statue", "stone", "a boundary figure", "A figure of bound reed the height of two people stands at the water's edge, rebuilt every year by somebody, its head turned inland.", ["observance"]),
  ],
  road: [
    entry("crossroads-shrine", "shrine", "a crossroads shrine", "Where the tracks meet, a roofed post holds a small figure and a shelf of stubs where candles have burned down and been replaced.", ["observance"]),
    entry("stone-heap", "field", "a heap of road-stone", "Broken stone is piled at the verge in a long low ridge, graded by size, waiting for whoever keeps this stretch to need it.", ["labour"]),
    entry("shade-poplars", "grove", "an avenue of poplars", "Poplars have been planted in two lines along the road, close enough to interlock overhead, and the shade runs on for a good while.", ["built"]),
    entry("broken-cart", "stone", "a broken cart", "A cart lies at the verge with one wheel off and the axle snapped, stripped of anything worth carrying away.", []),
    entry("drover-pen", "pen", "a drover's pen", "A hurdled pen stands beside the road with a water trough fed from a pipe, big enough to hold a herd overnight.", ["pastoral"]),
    entry("toll-board", "waymarker", "a toll board", "A painted board lists the charges for cart, horse, and head of stock, and the authority that set them, in letters going pale.", ["built"]),
    entry("road-statue", "stone", "a road-warden's statue", "A stone figure in a hood and travelling cloak stands where the road turns, one hand raised, the fingers worn away by everyone who has touched them for luck.", ["observance"]),
    entry("gibbet", "stone", "an empty gibbet", "An iron cage hangs from a post at the roadside, open and long since emptied, turning when the wind gets under it.", ["authority"]),
    entry("verge-graves", "shrine", "verge graves", "A row of low mounds runs along outside the ditch, each marked with a stone no bigger than a hand, for people who died on the road and belonged to nowhere near it.", ["observance"]),
  ],
  water: [],
};

function naturalScenery(probe) {
  const options = NATURAL_BY_TERRAIN[probe.terrain];
  if (!options?.length) return null;
  const chance = probe.route ? 0.18 : 0.38;
  if (probe.random("scenery:natural") >= chance) return null;
  const pick = Math.floor(probe.random("scenery:natural:pick") * options.length);
  return options[pick % options.length];
}

function vantageScenery(probe) {
  if (probe.route || !probe.region) return null;
  if ((probe.climate?.elevation ?? 0) < 0.7) return null;
  if (probe.random("scenery:vantage") >= 0.22) return null;
  return entry(
    "vantage", "vantage",
    "a vantage over the country",
    `The ground falls away and ${probe.region.name} opens out below, far enough that the weather over it can be read as a single thing.`,
    ["open-ground", "view"],
  );
}

const RULES = [crossingScenery, roadsideScenery, waymarkerScenery, shoreScenery, vantageScenery, naturalScenery];

// Ordered by rule priority, deduplicated by id, capped so a tile stays readable.
export function worldSceneryAt(probe) {
  if (!probe || probe.terrain === "water" || probe.landValue <= 0) return [];
  if (probe.landmarkId || probe.checkpoint || probe.port) return [];
  const found = [];
  const seen = new Set();
  for (const rule of RULES) {
    if (found.length >= SCENERY_LIMIT) break;
    const result = rule(probe);
    if (!result || seen.has(result.id)) continue;
    seen.add(result.id);
    found.push(result);
  }
  return found;
}
