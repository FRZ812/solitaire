// A Patrician Country Estate — the walled country house of House Drelan, an
// old noble lineage that holds its land south of Whitemarch. The realised
// noble/commoner separation: the city's old houses do not live AMONG the
// crowds. They live behind their own walls, on their own ground, an hour's
// carriage south of the Crown Gate, and they come into the city only when
// patronage, marriage, or business requires it.
//
// Ward-wall philosophy: this is a TRUE walled compound, not an access-control
// ward. A full stone ring boxes the estate (north y=11, south y=18, east x=4,
// west x=-4); ivy grows thick on the south face where the wall meets the
// hunting park. The only passable threshold is the Estate Gate at (0,11) on
// the north face, looking back at the city across an open country road. A
// player reaches the gate by walking out Whitemarch's Crown Gate north,
// looping east around the city wall through procedural country, and
// dropping south down the carriage road to (0,10) — the procedural road
// hex immediately outside the gate.
//
// Footprint inside the bounding box (-4..4, 11..18):
//
//   y=11: -4..-1, 1..4 = wall ring;        0,11 = ESTATE GATE
//   y=12: -4 wall                          4 wall
//        -3 Estate Stables
//         0 Carriage Court
//   y=13: -4 wall                          4 wall
//        -3 Servants' Lane
//        -2 Marriage Hall
//        -1 Library / Reading Hall
//         0 Great House — Front
//         1 Patron's Salon
//         2 Guarded Vault
//   y=14: -4 wall                          4 wall
//        -2 Kitchen Court
//         0 Private Chapel
//   y=15: -4 wall                          4 wall
//         0 Walled Gardens — Vineyard Court
//   y=16: -4 wall                          4 wall
//         0 Walled Gardens — Garden Walk
//   y=17: -4 wall                          4 wall
//         0 Hunting Park
//   y=18: -4..4 wall (ivy-grown south face)
//
// All interior named tiles share parent: "whitemarch-house-drelan" /
// parentName: "House Drelan Country Estate"; each carries a distinct part
// / partName. The gate is the single threshold; its doors list explicitly
// connects the procedural country road at (0,10) outside the box and the
// Carriage Court at (0,12) inside it.

export const DISTRICT_ID   = "patrician-estate";
export const DISTRICT_NAME = "House Drelan Country Estate";

export const BOUNDING_BOX = { xmin: -4, xmax: 4, ymin: 11, ymax: 18 };

const AREA       = "patrician-estate";
const HOUSE      = "whitemarch-house-drelan";
const HOUSE_NAME = "House Drelan Country Estate";

// ---------- wall ring -------------------------------------------------------
// 29 stone-wall hexes ring the estate. Walls get doors:undefined so the
// pipeline's runWallAutoSeal computes them: walls open to adjacent walls and
// to any defined neighbour whose doors point back at them (the Estate Gate
// does, on both faces). Procedural neighbours outside the ring are sealed by
// auto-seal as the contract requires.
function wall() {
  return { terrain: "wall", poi: null };
}

const WALL_TILES = {
  // North face (y=11), gate at (0,11) handled below.
  "-4,11": wall(), "-3,11": wall(), "-2,11": wall(), "-1,11": wall(),
  "1,11":  wall(), "2,11":  wall(), "3,11":  wall(), "4,11":  wall(),
  // South face (y=18) — the ivy-grown wall.
  "-4,18": wall(), "-3,18": wall(), "-2,18": wall(), "-1,18": wall(),
  "0,18":  wall(), "1,18":  wall(), "2,18":  wall(), "3,18":  wall(),
  "4,18":  wall(),
  // West face (x=-4).
  "-4,12": wall(), "-4,13": wall(), "-4,14": wall(),
  "-4,15": wall(), "-4,16": wall(), "-4,17": wall(),
  // East face (x=4).
  "4,12":  wall(), "4,13":  wall(), "4,14":  wall(),
  "4,15":  wall(), "4,16":  wall(), "4,17":  wall(),
};

// ---------- interior named tiles --------------------------------------------

const POI_TILES = {
  // ---------- Estate Gate — the one passable threshold ----------------------
  // The double-leaf iron gate on the north face. The carriage road from the
  // city runs through it; inside the arch the gravel sweep curves to the
  // Carriage Court and the Great House beyond. Two house guards stand under
  // the arch; a clerk with a ledger checks names. The gate's doors point
  // explicitly to (0,10) — the procedural country road approaching from the
  // city — and to (0,12) Carriage Court inside the ring. Auto-seal will
  // reciprocate these against the north-face wall neighbours.
  "0,11": {
    terrain: "settlement",
    poi: {
      type: "gate",
      name: "Estate Gate",
      service: "noble-gate-guard",
      access: "guarded",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "estate-gate",
      partName: "Estate Gate",
      description:
        "A double-leaf iron gate hung between two pillars of pale ashlar, the bars wrought into the linked-hounds device of House Drelan. The country road comes up through low fields to meet it; from the gravel inside, the carriage sweep curves around a stone basin and opens on the front of the Great House. Two house-guards in iron-and-russet livery stand under the arch with halberds at rest; a clerk on a stool keeps a ledger of expected callers, names crossed off in pencil as the carriages roll through. A low side-door cut into the right-hand pier handles servants, deliveries, and the priest on chapel days. Beyond the bars the city sits on its low rise to the north, no closer than an hour's easy trot.",
    },
    doors: [
      { x: 0, y: 10 }, // procedural country road outside the box
      { x: 0, y: 12 }, // Carriage Court inside the ring
    ],
  },

  // ---------- Carriage Court — the public-facing inner court ---------------
  // First thing a caller sees once the gate has passed them. Gravel, a stone
  // basin, the carriage-arch of the Great House at its far end. Visitors who
  // get this far have been written into the clerk's ledger. Connects the
  // gate, the Great House Front, Patron's Salon, and the Library — the
  // four threshold rooms a caller might be ushered into.
  "0,12": {
    terrain: "settlement",
    poi: {
      type: "court",
      name: "Carriage Court",
      access: "guarded",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "carriage-court",
      partName: "Carriage Court",
      description:
        "A wide gravel court inside the gate, swept and raked each morning. A stone basin sits in the centre with a slow-running spout; a pair of mounting blocks at the far end serve the front steps of the Great House. The carriage-arch of the house rises straight ahead — pale ashlar, three storeys, the Drelan wreath cut into the keystone. House-grooms in plain russet wait by the basin to take horses; a footman at the steps takes the caller's card. To the west the gravel narrows into the service drive that runs back to the stables and the kitchen court; to the east a clipped lawn screens the salon and chapel from the gate's eye.",
    },
    doors: [
      { x: 0, y: 11 },  // Estate Gate
      { x: 0, y: 13 },  // Great House — Front
      { x: -1, y: 13 }, // Library / Reading Hall (small west passage)
    ],
  },

  // ---------- Great House — Front (anchor of House Drelan) ------------------
  // The main hall of the house. Marble chequerboard, Drelan portraits up the
  // stair, a small reception room where callers wait. The private floors
  // above are not offered to guests.
  "0,13": {
    terrain: "indoor",
    poi: {
      type: "hall",
      name: "Great House — Front",
      access: "restricted",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "great-house-front",
      partName: "Great House — Front",
      description:
        "The front hall of the Drelan house. The floor is black-and-white marble in a chequer the family has walked for nine generations; the stair rises against the east wall under portraits of the dead, each in a russet sash. A long-case clock ticks against the wall and is never wound late. A small reception room to the right is kept warm for callers whose cards were accepted at the gate; a door to the left opens on the library, another at the back on the chapel passage. The stair to the family's private floors is roped off with a soft cord and is not offered to guests, no matter how warmly they are received.",
    },
    doors: [
      { x: 0, y: 12 },  // Carriage Court
      { x: -1, y: 13 }, // Library / Reading Hall
      { x: 1, y: 13 },  // Patron's Salon
      { x: 0, y: 14 },  // Private Chapel (back passage)
    ],
  },

  // ---------- Great House — Library / Reading Hall --------------------------
  // A two-storey panelled library west of the Front hall. The estate's
  // genealogies, deed-books, and the reading copies of the family's law
  // libraries; the working archive is in the Vault. Callers waiting on the
  // Patroness's word are sometimes sat here.
  "-1,13": {
    terrain: "indoor",
    poi: {
      type: "hall",
      name: "Great House — Library",
      access: "restricted",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "great-house-library",
      partName: "Library / Reading Hall",
      description:
        "A long room panelled floor to ceiling in dark oak, two storeys tall, with a wrought-iron gallery running the upper shelves. The Drelan working library — genealogies bound in russet calf, the reading-copies of the estate's law books, atlases of the river country, sermons and household accounts going back six generations. A pair of green-shaded lamps burn over reading-tables; a librarian in plain dress sits at a high desk near the door and signs books out to family and approved guests. The Marriage Hall opens through a side door west; the Front hall sits across the passage east. Callers waiting on the Patroness's word are sometimes sat here with tea and a book they do not read.",
    },
    doors: [
      { x: 0, y: 13 },  // Front
      { x: 0, y: 12 },  // Carriage Court (small entry passage)
      { x: -2, y: 13 }, // Marriage Hall
      { x: -2, y: 14 }, // Kitchen Court (back service door)
    ],
  },

  // ---------- Patron's Salon ------------------------------------------------
  // The patronage parlour east of the Front. Soft music, hard negotiations.
  // The Patroness receives in the far chair, ledger on her knee. Reuses the
  // archived noble-rise prose tone.
  "1,13": {
    terrain: "indoor",
    poi: {
      type: "hall",
      name: "Patron's Salon",
      service: "patron-salon",
      access: "restricted",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "patron-salon",
      partName: "Patron's Salon",
      description:
        "A long room panelled in dark wood, lit by tall windows that look over the clipped east lawn but not the gate. A silver tea-service waits on a side-table; the chairs are arranged in pairs, never in rows, so no one is ever quite addressed by the room. The Drelan Patroness receives in the far chair, a small ledger open on her knee. Petitioners are announced one at a time by a steward in russet livery; their requests — a commission for a son, a place at court for a nephew, an introduction to a marriage-broker, a quiet loan against an estate — are noted in the ledger, granted or refused in the same soft voice. A lutenist by the window plays something old enough that no one need listen. The refused leave through the same door they came in by, and the next caller is already standing.",
    },
    doors: [
      { x: 0, y: 13 },  // Front
      { x: 2, y: 13 },  // Guarded Vault (private passage)
      { x: 0, y: 14 },  // Private Chapel
    ],
  },

  // ---------- Private Chapel ------------------------------------------------
  // The estate's consecrated room. Marriages, baptisms, the quieter funerals.
  // The marriage clerk's writing-room sits behind a curtain — the Marriage
  // Hall handles the legal paperwork; the chapel handles the rite.
  "0,14": {
    terrain: "indoor",
    poi: {
      type: "temple",
      name: "Private Chapel",
      service: "chapel-priest",
      access: "restricted",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "private-chapel",
      partName: "Private Chapel",
      description:
        "A small barrel-vaulted chapel cut into the south wing of the house, lit by a single rose-window of plain leaded glass. Six wooden pews carved with the Drelan wreath face an altar of pale stone with a saint's medal set into its face. The resident priest lives in two rooms behind the apse — he is fed from the kitchen court and paid from the household accounts, and conducts the family's marriages, baptisms, and the quiet funerals that have no public mourners. A side-room behind a green curtain holds his writing-desk and the small register of births and deaths. The chapel passage opens onto the Patron's Salon north and the walled gardens south.",
    },
    doors: [
      { x: 0, y: 13 }, // Front
      { x: 1, y: 13 }, // Patron's Salon
      { x: 0, y: 15 }, // Walled Gardens — Vineyard Court
    ],
  },

  // ---------- Marriage Hall -------------------------------------------------
  // Where the contracts are written. Banns, dowry-receipts, marriage articles,
  // the small marriage register. The clerk is a sworn officer of the city's
  // registry, retained on annual stipend by House Drelan.
  "-2,13": {
    terrain: "indoor",
    poi: {
      type: "hall",
      name: "Marriage Hall",
      service: "marriage-clerk",
      access: "restricted",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "marriage-hall",
      partName: "Marriage Hall",
      description:
        "A square room west of the library, panelled in lighter wood and lit by two tall windows facing the kitchen garden. A long table runs down the centre with chairs for the two families; a smaller sloped desk by the window is the clerk's. The clerk is a sworn officer of the city's marriage registry, retained on annual stipend by House Drelan, and is the only person in the estate authorised to enter a name in the small leather register on his desk. Banns, dowry-receipts, marriage articles, the appended pages of an heir's settlement — all are written here, sealed in russet wax with the Drelan hound, and copied for the city's main registry. The chapel handles the rite. This room handles the law.",
    },
    doors: [
      { x: -1, y: 13 }, // Library
      { x: -3, y: 13 }, // Servants' Lane (small clerks' door)
      { x: -2, y: 14 }, // Kitchen Court
    ],
  },

  // ---------- Guarded Vault -------------------------------------------------
  // The family's working archive. Silver, deeds, dowries, the marriage
  // articles of unborn cousins. A house-guard stands at the iron door.
  "2,13": {
    terrain: "indoor",
    poi: {
      type: "bldg",
      name: "Guarded Vault",
      access: "restricted",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "guarded-vault",
      partName: "Guarded Vault",
      description:
        "A windowless room behind an iron door set into the salon's east wall. Inside, the working archive of nine generations of Drelans: silver plate stacked in baize-lined chests, the great deed-book bound in calf and clasped with iron, the boxes of dowry-letters that have not yet been carried to a bride, the sealed marriage articles of cousins not yet of age. A house-guard in russet stands at the door at all hours with a halberd resting against his shoulder and a ring of three keys at his belt; a second guard sits inside at a small table with the day-book, recording everyone who enters and what they take out and bring back. The room smells of beeswax, iron polish, and old paper.",
    },
    doors: [
      { x: 1, y: 13 }, // Patron's Salon
    ],
  },

  // ---------- Estate Stables ------------------------------------------------
  // Stalls of warm straw at the north-west corner of the compound. Carriage
  // horses, the Patroness's mare, a pair of hunters kept for the park. Reuses
  // the existing stable BUILDINGS entry.
  "-3,12": {
    terrain: "indoor",
    poi: {
      type: "yard",
      name: "Estate Stables",
      service: "stable",
      access: "conditional",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "estate-stables",
      partName: "Estate Stables",
      description:
        "A long timber-roofed stable along the north wall, twelve stalls of warm straw and the steady sound of feeding. The two carriage greys, the Patroness's grey mare, a pair of hunters kept for the park, a cob for the chapel priest, and three rough rounceys for the household's errands. Tack on pegs along the centre aisle; a stabler with hay in his sleeves runs the place and lives in a small loft above. A side-door opens on the service drive that runs back along the wall to the kitchen court; the carriage-yard sits a short walk south through the servants' lane. Visitors approved at the gate may hire a saddle horse here for the day if the master of stables is willing.",
    },
    doors: [
      { x: -3, y: 13 }, // Servants' Lane
    ],
  },

  // ---------- Servants' Lane ------------------------------------------------
  // The flagged service spine of the compound. Coal, ice, laundry, deliveries,
  // and the small private business no one in the Front Hall is meant to
  // witness. Connects stables, kitchen court, marriage hall's back door.
  "-3,13": {
    terrain: "street",
    poi: {
      type: "yard",
      name: "Servants' Lane",
      service: "house-steward",
      access: "conditional",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "servants-lane",
      partName: "Servants' Lane",
      description:
        "A flagged service lane running south along the inside of the west wall, just wide enough for two yoked porters to pass. Coal-sacks, ice-baskets, laundry-bundles, and quiet errands move along it from dawn; the kitchen smoke catches on the wall above and drifts east over the gardens. A side-stair to the kitchens climbs the east side of the lane, a wine-cellar's grilled hatch sits flush with the cobble, and a discreet servants' door cuts through the wall west onto the country lane outside — locked at night, opened by the steward only for known faces. House-steward Briel sits on a stool at the lane-mouth most mornings with a slate, marking who came in and what they carried, and which of them left again. Late at night the lane is where the house's smaller scandals are quietly paid off.",
    },
    doors: [
      { x: -3, y: 12 }, // Estate Stables
      { x: -2, y: 13 }, // Marriage Hall (clerks' back door)
      { x: -2, y: 14 }, // Kitchen Court
    ],
  },

  // ---------- Kitchen Court -------------------------------------------------
  // The working heart of the estate's domestic side. The cooks, the laundry,
  // the herb-garden against the south wall of the kitchen wing.
  "-2,14": {
    terrain: "indoor",
    poi: {
      type: "yard",
      name: "Kitchen Court",
      access: "conditional",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "kitchen-court",
      partName: "Kitchen Court",
      description:
        "A flagged court behind the west wing, open to the sky and walled on three sides by the kitchens, laundry, and herb-garden. The great kitchen-range smokes through the morning; a half-dozen cooks in white aprons work the long table under hanging copper pans, and the smell is bread, onion, roast, and wood-smoke. Laundry-coppers steam in the corner; the kitchen-garden runs against the south wall in clipped beds of thyme, mint, sage, and the russet-stemmed sorrel the Patroness takes in her morning broth. The household eats in the long room behind the range at three sittings a day. The marriage clerk takes his dinner here in good weather; the priest takes his at the back step.",
    },
    doors: [
      { x: -3, y: 13 }, // Servants' Lane
      { x: -2, y: 13 }, // Marriage Hall
      { x: -1, y: 13 }, // Library (back service door)
    ],
  },

  // ---------- Walled Gardens — Vineyard Court -------------------------------
  // The estate's vineyard sits within its own inner wall, south of the
  // Great House. Two parts: the Vineyard Court here (rows of vines on
  // wired frames, the wine-press at the south end) and the Garden Walk
  // (0,16) — both share parent and parentName.
  "0,15": {
    terrain: "settlement",
    poi: {
      type: "site",
      name: "Walled Gardens — Vineyard Court",
      access: "restricted",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "vineyard-court",
      partName: "Vineyard Court",
      description:
        "The Drelan vineyard, an acre of trained vines inside its own low inner wall south of the Great House. Six terraces step gently down toward the southern wall; the vines run on wired frames in long rows, ankle-deep in clipped grass between. A small open-sided wine-press sits at the south end of the court under a tiled roof — pressed in the last weeks of summer by the household and the village hired up from the river road, racked off in oak in the cellar under the kitchen court, drunk five years later at the Patroness's table. A gardener in a wide hat and his two apprentices keep the rows; the chapel passage from the Great House opens here, and a gate in the inner wall to the south opens on the garden walk and the hunting park beyond.",
    },
    doors: [
      { x: 0, y: 14 }, // Private Chapel (chapel passage)
      { x: 0, y: 16 }, // Garden Walk
    ],
  },

  // ---------- Walled Gardens — Garden Walk ----------------------------------
  // Second hex of the gardens footprint. A formal walk between trimmed yew,
  // statuary in pale stone, a pool with carp. Opens south on the Hunting Park.
  "0,16": {
    terrain: "settlement",
    poi: {
      type: "site",
      name: "Walled Gardens — Garden Walk",
      access: "restricted",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "garden-walk",
      partName: "Garden Walk",
      description:
        "A formal walk south of the vineyard, gravel laid between trimmed yew tall enough to hide a man on a horse. Statuary in pale stone — a hound, a young woman with an open book, a saint with a broken sword — stands at the four turns of the walk; a low oval pool in the centre holds slow carp that the Patroness's daughters feed by hand. The yew screens the garden from the hunting park; a side bench under a vine-canopy is where the Patroness sometimes receives the priest for a private hour. The walk opens south through a gap in the yew on the park, and north on the vineyard court.",
    },
    doors: [
      { x: 0, y: 15 }, // Vineyard Court
      { x: 0, y: 17 }, // Hunting Park
    ],
  },

  // ---------- Hunting Park --------------------------------------------------
  // The southernmost stretch of the estate, inside the south wall. A small
  // wood kept for deer, with the south wall ivy-grown and rarely walked.
  "0,17": {
    terrain: "settlement",
    poi: {
      type: "site",
      name: "Hunting Park",
      access: "restricted",
      area: AREA,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "hunting-park",
      partName: "Hunting Park",
      description:
        "A narrow stretch of woodland against the south wall — oak, hornbeam, a few old beech, the floor knee-deep in last year's leaves. The estate keeps a small herd of fallow deer here that the household hunts on horseback two or three days each season; a flagged ride loops through the trees from the garden gate. The south wall behind the trees is ivy-grown so thick the stone is hardly seen, and the gardener says some of the old gate-locks down there have not been turned in his lifetime. A rough mews against the east face holds the Patroness's two goshawks. After dusk the park is the quietest hex of the estate, and the deer come out to feed under the yew at the garden's edge.",
    },
    doors: [
      { x: 0, y: 16 }, // Garden Walk
    ],
  },
};

export const TILES = { ...WALL_TILES, ...POI_TILES };

// ---------- sealed structure ------------------------------------------------
// One sealed structure covers the whole estate. `interior` lists every
// non-gate, non-wall hex authored above; `gates` pairs the Estate Gate with
// the procedural country road hex at (0,10). Auto-seal handles the wall
// ring; applyMeshDoors handles interior adjacencies.
export const STRUCTURES = [
  {
    name: "House Drelan Country Estate",
    interior: [
      { x: 0,  y: 12 }, // Carriage Court
      { x: 0,  y: 13 }, // Great House — Front
      { x: -1, y: 13 }, // Library
      { x: 1,  y: 13 }, // Patron's Salon
      { x: -2, y: 13 }, // Marriage Hall
      { x: 2,  y: 13 }, // Guarded Vault
      { x: -3, y: 13 }, // Servants' Lane
      { x: -3, y: 12 }, // Estate Stables
      { x: -2, y: 14 }, // Kitchen Court
      { x: 0,  y: 14 }, // Private Chapel
      { x: 0,  y: 15 }, // Vineyard Court
      { x: 0,  y: 16 }, // Garden Walk
      { x: 0,  y: 17 }, // Hunting Park
    ],
    gates: [
      [{ x: 0, y: 11 }, { x: 0, y: 10 }],
    ],
  },
];

// ---------- services declared ----------------------------------------------
// noble-gate-guard, patron-salon, chapel-priest, marriage-clerk are new
// surfaces for Wave 3 S1 to add to town.js BUILDINGS. house-steward is
// declared because the Servants' Lane tile binds it as the steward's
// surface. stable is reused from the existing BUILDINGS entry.
export const SERVICES = [
  "noble-gate-guard",
  "patron-salon",
  "chapel-priest",
  "marriage-clerk",
  "house-steward",
  "stable",
];
