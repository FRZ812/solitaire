// House Drelan Country Estate — Outer Ring Patch.
//
// The first pass landed a small single-ring House Drelan compound at the
// inner box (-4..4, 11..18). Spatially that left the estate floating in
// procedural country with a single gate at (0,11) facing the city across
// open fields. The handcrafted estate is described in the city bible as
// "an hour's carriage south of the Crown Gate" — true to that distance,
// but visually the inner ring was much too small for a great noble
// holding. A true patrician country estate is an agricultural and social
// complex: walled approach, tenant cottages, hunting park, kennels, a
// chapel-bell, dairy court, orangery. This patch wraps an OUTER ESTATE
// WALL around the inner Great-House compound and fills the annulus with
// the working land of the house.
//
// Spatial spec (expanded bounding box, -7..7, 8..21):
//
//   - Outer wall on all four perimeter faces.
//   - North outer wall (y=8) is broken by the new Drelan North Gate at
//     (0,8) — physically adjacent to Whitemarch's south wall hex (0,7).
//     The gate's door points to (0,7) as a SPATIAL-CONNECTION marker:
//     because (0,7) is itself a city wall whose doors do not reciprocate,
//     the engine will not let a player step from city interior through
//     Drelan Gate. They still loop through Crown Gate north and ride the
//     country road south. The marker is for narrative adjacency only.
//   - The inner compound (-4..4, 11..18) is PRESERVED untouched. Every
//     tile in that box is owned by district-patrician-estate.js.
//   - The annulus between inner walls and the outer wall is the estate
//     grounds: the Avenue of Beeches running south from the new outer
//     gate to the inner Estate Gate at (0,11), with the working halls
//     and lodges of the household clustered along it.
//
// Connectivity: the outer ring's interior list includes the Avenue of
// Beeches (0,9) and (0,10), which mesh-doors directly into the inner
// Estate Gate at (0,11). To make that door pair bidirectional under
// engine `edgeAllowed`, (0,11) is declared in this structure's
// `threshold` — the mesh-doors pass adds (0,11) to (0,10)'s authored
// doors without overwriting the inner gate itself. The inner gate
// already authored a door to (0,10).
//
// Walls hygiene: every new wall hex has doors:undefined so the
// handcrafted pipeline's runWallAutoSeal computes the doors list. The
// gate hex is a settlement with doors derived from mesh + the gates
// pairing. Existing city walls on y=8 at x=-4,-3,3,4 and the Underworks
// hidden-sewer tiles at (1,8),(2,8) are NOT overwritten — the new wall
// ring is laid down only on procedural hexes, and the existing tiles
// serve as the ring where they already exist.

export const DISTRICT_ID   = "patrician-estate-patch1";
export const DISTRICT_NAME = "House Drelan Country Estate (Outer Ring Patch)";

export const BOUNDING_BOX = { xmin: -7, xmax: 7, ymin: 8, ymax: 21 };

const AREA       = "patrician-estate-outer-ring";
const HOUSE      = "whitemarch-house-drelan";
const HOUSE_NAME = "House Drelan Country Estate";

// ---------- outer wall ring ------------------------------------------------
// 47 stone-wall hexes ring the estate's working land. The Drelan device is
// cut into the keystone of every fifth pier; ivy climbs the south face
// where the wall runs behind the orchard. Walls get doors:undefined so
// runWallAutoSeal seals them against procedural country and meshes their
// wall-walk against each other.
function wall() {
  return { terrain: "wall", poi: null };
}

const WALL_TILES = {
  // North face y=8. Gate at (0,8) below. Skipped:
  //   (-4,8),(-3,8),(3,8),(4,8)  — pre-existing Whitemarch city walls.
  //   (1,8),(2,8)                 — pre-existing Underworks hidden sewer.
  // The existing city-wall hexes serve as the ring at those x; the
  // Underworks tiles are underground anyway and do not break the visible
  // wall line on the ground.
  "-7,8": wall(), "-6,8": wall(), "-5,8": wall(),
  "-2,8": wall(), "-1,8": wall(),
  "5,8":  wall(), "6,8":  wall(), "7,8":  wall(),

  // South face y=21. The ivy-grown back of the estate, behind the orchard.
  "-7,21": wall(), "-6,21": wall(), "-5,21": wall(), "-4,21": wall(),
  "-3,21": wall(), "-2,21": wall(), "-1,21": wall(), "0,21":  wall(),
  "1,21":  wall(), "2,21":  wall(), "3,21":  wall(), "4,21":  wall(),
  "5,21":  wall(), "6,21":  wall(), "7,21":  wall(),

  // West face x=-7 from y=9 to y=20.
  "-7,9":  wall(), "-7,10": wall(), "-7,11": wall(), "-7,12": wall(),
  "-7,13": wall(), "-7,14": wall(), "-7,15": wall(), "-7,16": wall(),
  "-7,17": wall(), "-7,18": wall(), "-7,19": wall(), "-7,20": wall(),

  // East face x=7 from y=9 to y=20.
  "7,9":  wall(), "7,10": wall(), "7,11": wall(), "7,12": wall(),
  "7,13": wall(), "7,14": wall(), "7,15": wall(), "7,16": wall(),
  "7,17": wall(), "7,18": wall(), "7,19": wall(), "7,20": wall(),
};

// ---------- outer-ring POI tiles -------------------------------------------
// Twelve named tiles, all parented to the existing House Drelan footprint.
// Layout sketch (annulus, inner compound visible as #####):
//
//   y=8:   ## ## ## .  .  -2w -1w  0G  Uw Uw ## ## ## ## ##
//   y=9:   7w (FCe) (MG) (StL) (AvN) (Fal) (Ken) .  .  .  7w
//   y=10:  7w  .  . (TenC)(Orn)(AvS) (Carr)(Dry)  .  .  .  7w
//   y=11.. inner walls / inner compound  .. y=18 inner walls
//   y=19/20: open grounds (procedural countryside inside the ring)
//   y=21:  ## ## ## ## ## ## ##  ##  ## ## ## ## ## ## ##
//
// All named tiles share parent: HOUSE / parentName: HOUSE_NAME and carry
// area: AREA (the outer-ring area slug). Each has a distinct part /
// partName. None overlap the inner compound's existing tiles.

const POI_TILES = {
  // ---------- Drelan North Gate (the outer gate, mandatory) ----------------
  // The new outer gate, set in the north wall directly opposite Whitemarch's
  // south wall hex (0,7). A flagged carriage road comes down through
  // procedural country and squeezes between the city wall and the gate;
  // most visitors arrive having ridden out Crown Gate north, looped east
  // around the city, and trotted south down the country road. The door
  // pair {(0,7),(0,9)} is the spatial declaration; only (0,9) is actually
  // reciprocated by an authored neighbour. The Whitemarch wall at (0,7)
  // does not have a door to (0,8), so the engine never lets a player step
  // straight from the city interior into the estate grounds — they still
  // loop the long way around.
  "0,8": {
    terrain: "settlement",
    poi: {
      type: "gate",
      service: "noble-gate-guard",
      name: "Drelan North Gate",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "outer-gate-north",
      partName: "Drelan North Gate",
      access: "guarded",
      description:
        "The outer gate of House Drelan's country estate, hung in a fresh-cut arch of pale ashlar that almost touches the south wall of Whitemarch. From the city above, the gate's slate roof is visible over the curtain — close enough that the wall-watch on (0,7) can call down the time of day to the Drelan house-guards beneath, far enough that no road runs through and out the other side. A double-leaf iron gate of the linked-hounds device hangs between two piers; a clerk in the gatehouse loft keeps a ledger of expected callers, and a runner sits ready to be sent up the Avenue of Beeches to warn the inner gate when a carriage approaches. The country road from Crown Gate loops east around the city wall, drops south through procedural fields, and meets this gate from the north. From here the avenue runs straight south to the inner Estate Gate at (0,11).",
    },
    doors: [
      { x: 0, y: 7 }, // Whitemarch's south wall — spatial-adjacency marker
      { x: 0, y: 9 }, // Avenue of Beeches, north reach
    ],
  },

  // ---------- Avenue of Beeches — North Reach ------------------------------
  // The broad gravel approach inside the outer gate. Mature copper beeches
  // line both sides; in autumn the leaves fall thick enough to muffle
  // hooves. Coaches set down here when the carriage-house is full.
  "0,9": {
    terrain: "settlement",
    poi: {
      type: "site",
      name: "Avenue of Beeches — North Reach",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "avenue-of-beeches-north",
      partName: "Avenue of Beeches — North Reach",
      access: "public",
      description:
        "A broad gravel avenue inside the Drelan North Gate, lined with copper beeches the elder Drelans planted in the year of the last Patroness's marriage. The trees are now tall enough to vault a coach in shade; in autumn the leaves fall thick enough to muffle the hooves of the chapel priest's cob. A turning-circle for tradesmen's carts sits east of the avenue, screened by clipped yew; the carriage-house and stewards' offices open from the side-paths. South from here the avenue runs straight to the inner Estate Gate, the slate roofs of the Great House visible over the inner wall in the middle distance.",
    },
  },

  // ---------- Avenue of Beeches — South Reach ------------------------------
  // The end of the avenue, where the gravel sweeps right up to the inner
  // Estate Gate. This tile sits one hex north of the inner gate (0,11)
  // and is the connection point between outer and inner compounds.
  "0,10": {
    terrain: "settlement",
    poi: {
      type: "site",
      name: "Avenue of Beeches — South Reach",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "avenue-of-beeches-south",
      partName: "Avenue of Beeches — South Reach",
      access: "public",
      description:
        "The southern end of the Avenue of Beeches, where the gravel sweeps up to the iron leaves of the inner Estate Gate. The trees thin here; a low stone basin holds water for travelling horses, and a pair of mounting-blocks sit beside it. A house-guard on a stool keeps an eye on the gate from a distance, ready to walk forward and challenge any carriage that has not been announced from the outer ledger. From this hex the slate-and-ashlar front of the inner gate fills the southward view, and the dairy-court's morning steam carries on the east wind.",
    },
  },

  // ---------- Steward's Lodge ----------------------------------------------
  // The working office of the estate's full steward — a separate officer
  // from the house-steward Briel who runs the Servants' Lane inside the
  // inner compound. The estate steward audits the tenant rents, the
  // wood-warden's tally, the seed-bills, and the dairy-court's accounts.
  // He lives in the loft above the office.
  "-1,9": {
    terrain: "indoor",
    poi: {
      type: "bldg",
      name: "Steward's Lodge",
      service: "estate-steward",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "stewards-lodge",
      partName: "Steward's Lodge",
      access: "conditional",
      description:
        "A two-storey timber lodge west of the avenue, the working office of the estate's full steward. The ground floor is one long room with a high desk by the window, a wall of pigeon-holes for rent-rolls and seed-bills, and a small fire that burns through the working months. The steward — a Drelan retainer of twenty years — audits the tenant rents the first week of every quarter, the wood-warden's tally at midsummer and again at midwinter, and the dairy-court's accounts every market-day. His private rooms are in the loft above; the back stair drops to a small cellar of estate papers that cannot be left in the inner Vault. Tenants come here with disputes; tradesmen come here for instructions. The Patroness rarely crosses the threshold and does not need to.",
    },
  },

  // ---------- Falconry Mews -------------------------------------------------
  // The estate's hawking-mews, a long low timber-and-tile building east of
  // the avenue. The Patroness's two goshawks lived in a rough mews against
  // the east face of the inner Hunting Park; the working hawks — gyrs,
  // peregrines, the kitchen sparrow-hawks — are kept here, under the
  // falconer's eye.
  "1,9": {
    terrain: "indoor",
    poi: {
      type: "bldg",
      name: "Falconry Mews",
      service: "falconer",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "falconry-mews",
      partName: "Falconry Mews",
      access: "restricted",
      description:
        "A long low building of timber on stone footings, the roof oversailed to keep the perches dry. The estate's working hawks live here under the falconer's eye — three gyrs hooded on the wall-perches, a pair of peregrines that the heir flies in autumn, four kitchen sparrow-hawks for the household pigeons, and an old red kite the falconer keeps for sentiment. Leather hoods on pegs, a block of weighing-stones, the smell of feather and well-kept meat. The falconer's apprentice sleeps in a cot at the door. Strangers are not let inside; even the chapel priest must wait at the threshold while a bird is on the fist. The Patroness's two goshawks are kept separately, in a rougher mews against the inner Hunting Park.",
    },
  },

  // ---------- Greenhouse / Orangery -----------------------------------------
  // The Patroness's heated glass-house. Southern citrus, forced bulbs out
  // of season, a small grafting bench for the gardener's experiments.
  // Locked at night; the head gardener carries the only working key.
  "-1,10": {
    terrain: "indoor",
    poi: {
      type: "bldg",
      name: "Greenhouse / Orangery",
      service: "orangery-keeper",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "orangery",
      partName: "Greenhouse / Orangery",
      access: "restricted",
      description:
        "A heated glass-house south of the steward's lodge, the panes set in a frame of pale wood and braced against the wind. Inside, the Patroness grows what the river country will not give her: small orange-trees in glazed pots, a lemon trained against the back wall, hyacinths and tulips forced out of season for the Marriage Hall's table, a thread of jasmine that scents the whole room in early summer. A stove in the corner burns low through the cold months; the head gardener's apprentice sleeps in a cot by the door on the coldest nights, to keep the fire alive. The room is locked at dusk and the key kept on the head gardener's belt — the citrus is worth more than the gardener earns in a year.",
    },
  },

  // ---------- Carriage House ------------------------------------------------
  // Where the family's carriages are kept — separate from the inner Estate
  // Stables, which hold the riding horses and the carriage greys. The
  // carriage-house holds the painted boxes themselves: the great barouche
  // for state callers, the everyday landau, the heir's curricle, the
  // chapel priest's gig.
  "1,10": {
    terrain: "indoor",
    poi: {
      type: "bldg",
      name: "Carriage House",
      service: "carriage-wright",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "carriage-house",
      partName: "Carriage House",
      access: "conditional",
      description:
        "A broad timber building east of the avenue with three high doors set on iron rails. Inside, the Drelan carriages are kept side by side on flagged stone, each with its dust-cover folded over the box: the great barouche with the russet panels for state callers, the everyday landau, the heir's curricle that is taken into the city and back twice a week, the chapel priest's gig, and the spring-cart that runs the dairy's deliveries to the kitchen court. A carriage-wright keeps the wheels and panels in his shop at the back; a stableboy sweeps the floors every dawn. The carriage-wright will sell minor repairs and re-axle work to passing travellers who reach the outer gate, if the steward signs the chit.",
    },
  },

  // ---------- Tenant Cottages -----------------------------------------------
  // A row of low stone cottages where the estate's working families live —
  // the dairyman and his wife, the head shepherd, the wood-warden, the
  // estate carpenter, the two gardeners' families. A common well at the
  // east end; a long thatched eave that meets the back of the cottages.
  "-2,10": {
    terrain: "settlement",
    poi: {
      type: "town",
      name: "Tenant Cottages",
      service: "tenant-row",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "tenant-cottages",
      partName: "Tenant Cottages",
      access: "public",
      description:
        "A row of seven low stone cottages along the inside of the west wall, where the estate's working families live: the dairyman and his wife, the head shepherd, the wood-warden, the estate carpenter, the head gardener, and the two families of the gardeners' apprentices. Each cottage has its own small garden of cabbages and onions, the smoke of seven chimneys carries together over the wall, and a common well at the south end of the row pulls clear cold water from under the grounds. Children too small for work play between the cottages in the dust; the estate carpenter has the loudest of the seven hammers and starts it before dawn. Tenants pay no rent — they are paid in stipend, board, and the small garden — but their service is reckoned in the steward's books and a dismissed tenant has a hard winter to find.",
    },
  },

  // ---------- Dairy Court ---------------------------------------------------
  // Where the estate's cheese and butter are made — the working complement
  // to the kitchen-court inside the inner ring. The dairy is a stone room
  // kept cold all year; the butter-churn is worked by the dairyman's
  // daughter; the wheels of cheese age on slatted shelves against the
  // north wall.
  "2,10": {
    terrain: "settlement",
    poi: {
      type: "yard",
      name: "Dairy Court",
      service: "dairy-keeper",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "dairy-court",
      partName: "Dairy Court",
      access: "conditional",
      description:
        "A flagged court east of the avenue, walled on three sides by the working buildings of the estate's dairy. The cold-room is sunk half a step below grade and kept cool the year round by stone and earth; inside, the butter-churn is worked by the dairyman's daughter through the morning, and wheels of soft and hard cheese age on slatted shelves against the north wall. Milking sheds open on the south side of the court; the morning's milk is brought up the spring-cart from the meadow east of the estate at dawn and again before dusk. The kitchen-court inside the inner ring takes its butter and cheese here twice a day, signed for in the dairy-keeper's book; the surplus is sold at the city's Grand Market on the second-day of the week.",
    },
  },

  // ---------- Master Gardener's Cottage -------------------------------------
  // The gardener's working cottage and tool-store, west of the avenue. A
  // separate establishment from the tenant cottages — the master gardener
  // is paid in salary, not stipend, and his cottage has a tiled hearth
  // and a glassed window. He keeps the orangery key and the keys to the
  // walled gardens inside the inner compound.
  "-2,9": {
    terrain: "indoor",
    poi: {
      type: "bldg",
      name: "Master Gardener's Cottage",
      service: "master-gardener",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "master-gardeners-cottage",
      partName: "Master Gardener's Cottage",
      access: "conditional",
      description:
        "A small stone cottage west of the avenue and one hex north of the tenant row, set apart from the tenant cottages by a clipped hedge of box. The master gardener — a Drelan retainer of thirty-one years, whose father held the post before him — lives here with his wife, a tiled hearth in the kitchen, a glassed window the tenants do not have, and a key-ring at his belt that opens the orangery, the inner walled gardens' side-gate, the seed-store, and the lock on the orchard's south door. Behind the cottage a low shed holds the working tools and the rolled canvas covers for the citrus. He is on the avenue at dawn six days in seven, in the inner gardens by six, and his wife brings him his dinner in a basket at noon.",
    },
  },

  // ---------- Kennels -------------------------------------------------------
  // The Patroness's hunting hounds — separate from the working dogs of
  // the tenant cottages. A double row of stalls, a feeding-room, a kennel-
  // master's bench. The hounds bay when a carriage rolls up the avenue.
  "2,9": {
    terrain: "indoor",
    poi: {
      type: "bldg",
      name: "Kennels",
      service: "kennel-master",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "kennels",
      partName: "Kennels",
      access: "restricted",
      description:
        "A long timber building east of the avenue, the Patroness's hunting hounds in a double row of slatted stalls along its length. Twenty-three couples of the Drelan strain — black, tan, and white in the pattern her grandmother bred — under the kennel-master who has been with the house since before the heir was born. A feeding-room at the south end where the meat is cut and the meal mixed; a bench where the kennel-master sleeps in lambing season when the bitches whelp. The dogs bay when a carriage rolls up the avenue, the sound carrying clear over the inner wall and into the Patron's Salon — the household has learned to read the pitch as a kind of fore-warning of who is about to arrive. The kennel-master does not let strangers past the door.",
    },
  },

  // ---------- Family Cemetery -----------------------------------------------
  // The walled plot of Drelan tombs and memorials. Six generations of the
  // family lie here under flat stones of pale river-marble; the Patroness
  // walks the ground at midwinter and on the anniversary of her husband's
  // death.
  "-3,10": {
    terrain: "settlement",
    poi: {
      type: "site",
      name: "Drelan Family Cemetery",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "family-cemetery",
      partName: "Drelan Family Cemetery",
      access: "public",
      description:
        "A walled plot at the north-west corner of the grounds, the Drelan tombs and memorials laid out on close-cropped grass under a stand of old yew. Six generations lie here under flat stones of pale river-marble — the founder of the country estate at the centre, the grandfathers and grandmothers in a half-circle around him, the more recent dead in two rows along the inner wall. A small chapel-shrine of stone stands at the south end of the plot with the bell-rope visible through its open door; the chapel priest from the inner ring rings the bell on the anniversary of each death, and the Patroness walks the ground at midwinter and on the anniversary of her husband's, alone, hooded against the wind. The gate to the cemetery is unlocked; tenants are not turned away. A robin nests in the yew most years.",
    },
  },
};

export const TILES = { ...WALL_TILES, ...POI_TILES };

// ---------- sealed structure -----------------------------------------------
// One sealed structure for the outer ring. `interior` lists every authored
// walkable hex (the gate, the avenue, the lodges, the gardens, the
// cemetery). `threshold` lists (0,11) — the inner Estate Gate — so that
// applyMeshDoors will give the south-reach avenue tile a reciprocating
// door to it under engine `edgeAllowed`. `gates` pairs the new outer gate
// (0,8) with the city wall hex (0,7), as a spatial-adjacency declaration.
// The existing inner sealed_structure stays unchanged.
export const STRUCTURES = [
  {
    name: "House Drelan — Outer Estate",
    interior: [
      { x: 0,  y: 8  }, // Drelan North Gate
      { x: 0,  y: 9  }, // Avenue of Beeches — North Reach
      { x: 0,  y: 10 }, // Avenue of Beeches — South Reach
      { x: -1, y: 9  }, // Steward's Lodge
      { x: 1,  y: 9  }, // Falconry Mews
      { x: -1, y: 10 }, // Greenhouse / Orangery
      { x: 1,  y: 10 }, // Carriage House
      { x: -2, y: 10 }, // Tenant Cottages
      { x: 2,  y: 10 }, // Dairy Court
      { x: -2, y: 9  }, // Master Gardener's Cottage
      { x: 2,  y: 9  }, // Kennels
      { x: -3, y: 10 }, // Family Cemetery
    ],
    threshold: [
      { x: 0, y: 11 }, // inner Estate Gate — reciprocates outer Avenue South
    ],
    gates: [
      [{ x: 0, y: 8 }, { x: 0, y: 7 }],
    ],
  },
];

// ---------- services declared ---------------------------------------------
// noble-gate-guard is reused from the inner compound. The rest are new
// surfaces for the outer-ring working land: the steward who keeps the
// rent-rolls, the falconer, the orangery-keeper, the carriage-wright, the
// tenant-row registry, the dairy-keeper, the master-gardener, the kennel-
// master. Wave 3 S1 will add the new ids to town.js BUILDINGS.
export const SERVICES = [
  "noble-gate-guard",
  "estate-steward",
  "falconer",
  "orangery-keeper",
  "carriage-wright",
  "tenant-row",
  "dairy-keeper",
  "master-gardener",
  "kennel-master",
];
