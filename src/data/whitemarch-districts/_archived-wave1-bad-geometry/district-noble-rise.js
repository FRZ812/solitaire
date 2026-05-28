// Noble Rise — the high residential ward below the Citadel. Where House
// Vaerwynne and its peers turn commerce into lineage and call it dignity.
// Carriages behind iron gates, servants on side stairs, private guards in
// family colours, soft music over hard negotiations.
//
// Ward-wall philosophy (per the city bible, Defensive Layout / Ward Walls):
// Noble Rise's "wall" is access control, not stone hexes. The existing wall
// ring around the Citadel approach already runs adjacent to this district,
// so we do not author new terrain:"wall" tiles. Instead, every interior tile
// in this district has a `doors` array that ONLY reaches other Noble Rise
// hexes and the Noble Gate — the gate is the single passable threshold in
// or out. Commoners crossing Chain Market (-1,3) and the petition rail look
// up at the gate; they do not pass through it without papers.
//
// Footprint inside the bounding box (-3..-1, 2..5):
//
//   y=2: -3,2 / -2,2 / -1,2  -- left untouched (commoner approach to
//                              Chain Market; their southern neighbours are
//                              Chain Market tiles owned by another author).
//   y=3: -3,3                -- left untouched (street outside the gate).
//        -2,3 Sale Platform  -- DO NOT TOUCH (owned by Chain Market Steps).
//        -1,3 Petition Rail  -- DO NOT TOUCH (owned by Chain Market Steps).
//   y=4: -3,4 Patron's Salon
//        -2,4 Garden Court
//        -1,4 NOBLE GATE      <-- only ward threshold; reaches outside
//   y=5: -3,5 Private Chapel
//        -2,5 Servants' Lane (part of House Vaerwynne footprint)
//        -1,5 House Vaerwynne Front (anchor of House Vaerwynne footprint)
//
// Out-of-box neighbours the gate and interior wiring deliberately respects:
//   - (0,4) Citadel approach street — reached ONLY from the gate hex.
//   - (0,5) High Wall / Citadel ward seam — never reached from interior.
//   - (-1,6) / (-2,6) Low Wards seam — never reached from interior.
//   - (-3,3) and (-3,2) — unnamed outer streets; the chapel and salon do
//     not open onto them. To leave Noble Rise you walk to the gate.

export const DISTRICT_ID   = "noble-rise";
export const DISTRICT_NAME = "Noble Rise";

export const BOUNDING_BOX = { xmin: -3, xmax: -1, ymin: 2, ymax: 5 };

const WARD        = "noble-rise";
const HOUSE       = "whitemarch-house-vaerwynne";
const HOUSE_NAME  = "House Vaerwynne";

export const TILES = {
  // ---------- Noble Gate — the only passable threshold of the ward -------
  // Sits where Chain Market's petition rail looks up at the high ward. The
  // gate's outer face opens onto Chain Market (-1,3) and the Citadel
  // approach street (0,4); its inner face opens onto Garden Court (-2,4)
  // and House Vaerwynne's front court (-1,5). Every other Noble Rise tile
  // routes through this hex to reach the rest of the city.
  "-1,4": {
    terrain: "settlement",
    poi: {
      type: "gate",
      name: "Noble Gate",
      service: "noble-gate-guard",
      access: "guarded",
      area: WARD,
      parent: "whitemarch-noble-gate",
      parentName: "Noble Gate",
      part: "noble-gate",
      partName: "Noble Gate",
      description:
        "A double-leaf iron gate hung between two ashlar piers, the bars wrought into the linked-rings of the ward's old families. Two house-liveried guards stand inside the arch; a city watch-sergeant stands outside it. A brass-plate book on a lectern lists today's expected callers — names, houses, hours — and a clerk crosses each off as the carriage rolls through. Commoners climbing the Chain Market steps can see clean gravel and trimmed yew through the bars; they do not stand near the gate long. Servants and tradesmen use a low side-door cut into the right-hand pier, papers in hand.",
    },
    // Outer doors: Chain Market (-1,3) to the north, Citadel approach (0,4)
    // to the east. Inner doors: Garden Court (-2,4), House Vaerwynne Front
    // (-1,5). All four are explicit; everything else is sealed by absence.
    doors: [
      { x: -1, y: 3 },
      { x:  0, y: 4 },
      { x: -2, y: 4 },
      { x: -1, y: 5 },
    ],
  },

  // ---------- Garden Court — guarded gardens, debts hidden behind hedges --
  // The ward's social heart. A paved court ringed by trimmed yew, a fountain
  // worked into the shape of a sleeping hound, benches set in pairs for the
  // kind of conversation that is overheard on purpose. Bible texture:
  // garden walls hiding debts; young nobles bored enough to be dangerous.
  "-2,4": {
    terrain: "settlement",
    poi: {
      type: "court",
      name: "Garden Court",
      access: "restricted",
      area: WARD,
      parent: "whitemarch-garden-court",
      parentName: "Garden Court",
      part: "garden-court",
      partName: "Garden Court",
      description:
        "A small paved court walled in trimmed yew tall enough to hide a man on a horse. A stone hound sleeps in the basin of a low fountain; the water sings just loud enough to blur a conversation held three benches away. House sons in unbuttoned coats lean on the rail and pass a flask; a chaperone in dove-grey embroidery pretends not to watch. Behind one of the hedges, a steward and a moneylender stand very close and speak very quietly. A duelling-cane leans, unattended, against the fountain plinth.",
    },
    // Interior-only doors: Gate, Patron's Salon, House Front, Servants'
    // Lane. The hedges seal the rest.
    doors: [
      { x: -1, y: 4 },
      { x: -3, y: 4 },
      { x: -1, y: 5 },
      { x: -2, y: 5 },
    ],
  },

  // ---------- Patron's Salon — the patronage parlour --------------------
  // A polished hall where commissions, sinecures, and the smaller titles
  // are arranged across a tea-table. Bible texture: patronage, hypocrisy.
  "-3,4": {
    terrain: "indoor",
    poi: {
      type: "hall",
      name: "Patron's Salon",
      service: "patron-salon",
      access: "conditional",
      area: WARD,
      parent: "whitemarch-patron-salon",
      parentName: "Patron's Salon",
      part: "patron-salon",
      partName: "Patron's Salon",
      description:
        "A long room panelled in dark wood, lit by tall windows that overlook the garden but not the lane. A silver tea-service waits on a side-table; the chairs are arranged in pairs, never in rows. The Patroness receives in the far chair, a small ledger open on her knee. Petitioners are announced one at a time by a steward in house colours; their requests — a commission for a son, a place at court for a nephew, an introduction to a marriage-broker — are noted in the ledger, granted or refused with the same soft voice. The refused leave through the same door they came in by.",
    },
    // Interior-only: Garden Court, Private Chapel.
    doors: [
      { x: -2, y: 4 },
      { x: -3, y: 5 },
    ],
  },

  // ---------- House Vaerwynne — Major House Front (anchor) ---------------
  // Two-hex footprint: the public Front court here, the Servants' Lane at
  // (-2,5). Shared parent / parentName, distinct part / partName.
  "-1,5": {
    terrain: "indoor",
    poi: {
      type: "hall",
      name: "House Vaerwynne — Front",
      access: "restricted",
      area: WARD,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "house-front",
      partName: "Major House Front",
      description:
        "An ashlar facade in pale stone, three storeys high, flanked by lamp-irons cast in the Vaerwynne wreath. The carriage-arch opens on a clean gravel court; a footman in the house's iron-and-green livery stands at the door with a brass-tipped staff. Inside the entry hall, the floor is black-and-white marble in a chequer the Vaerwynnes have walked for six generations. Portraits of the dead line the stair. A small reception room to the right is kept warm for callers whose papers were accepted at the Noble Gate; a stair to the left rises into the family's private floors and is not offered to guests.",
    },
    // Interior-only doors: Gate, Garden Court, Servants' Lane (the house's
    // back). No reach to (-1,6) Low Wards or (0,5) High Wall — the wall
    // ring already seals those seams visually; we seal them functionally.
    doors: [
      { x: -1, y: 4 },
      { x: -2, y: 4 },
      { x: -2, y: 5 },
    ],
  },

  // ---------- House Vaerwynne — Servants' Lane (part of footprint) -------
  // The side-stair lane the bible calls for. Servants, deliveries, and the
  // small private business no one in the Front Hall is meant to witness.
  "-2,5": {
    terrain: "street",
    poi: {
      type: "yard",
      name: "House Vaerwynne — Servants' Lane",
      access: "conditional",
      area: WARD,
      parent: HOUSE,
      parentName: HOUSE_NAME,
      part: "servants-lane",
      partName: "Servants' Lane",
      description:
        "A flagged service lane along the back of House Vaerwynne, just wide enough for two yoked porters to pass. Coal-sacks, ice-baskets, laundry-bundles, and quiet errands move along it; the side-stair to the kitchens climbs one wall, and the wine-cellar's grilled hatch sits flush with the cobble. A house-steward in plain livery sits on a stool at the lane-mouth with a slate, marking who came in and what they carried, and which of them left again. Late at night the lane is where the house's smaller scandals are paid off.",
    },
    // Interior-only doors: Garden Court, House Front, Private Chapel.
    doors: [
      { x: -2, y: 4 },
      { x: -1, y: 5 },
      { x: -3, y: 5 },
    ],
  },

  // ---------- Private Chapel — saint-niche of the high houses -----------
  // The bible's "private chapel" tile. A small consecrated room shared by
  // the ward's old families; marriages, baptisms, and the quieter funerals
  // are conducted here without the public crowd of the Great Oath Steps.
  "-3,5": {
    terrain: "indoor",
    poi: {
      type: "temple",
      name: "Private Chapel",
      service: "chapel-priest",
      access: "restricted",
      area: WARD,
      parent: "whitemarch-private-chapel",
      parentName: "Private Chapel",
      part: "private-chapel",
      partName: "Private Chapel",
      description:
        "A small barrel-vaulted chapel lit by a single rose-window of plain leaded glass. Six wooden pews, each carved with the wreath of one of the old families; the Vaerwynne pew sits nearest the rail. The altar is a single block of pale stone with a saint's medal set into its face. A side-room behind a curtain serves as the marriage clerk's writing-room — banns, contracts, dowry-receipts, and the small marriage register are kept here, and the resident priest signs them at a sloped desk under a lamp. Funerals held here are short and have no public mourners.",
    },
    // Interior-only doors: Patron's Salon, Servants' Lane. The chapel does
    // NOT open onto the outer street (-3,4 outer is unauthored) or onto
    // (-4,5) outside the box — leaving Noble Rise means walking back to
    // the gate via the salon, garden, and servants' route.
    doors: [
      { x: -3, y: 4 },
      { x: -2, y: 5 },
    ],
  },
};

// Sealed-structure entry. Mirrors the existing Underworks shape from the
// live row: interior list of all ward-interior hexes, plus a single gates
// pair tying the Noble Gate hex to its outer-street neighbour. The Gate
// hex itself is the threshold and is listed under gates (not interior),
// matching the pattern used elsewhere.
export const STRUCTURES = [
  {
    name: "Noble Rise (ward)",
    interior: [
      { x: -2, y: 4 },
      { x: -3, y: 4 },
      { x: -1, y: 5 },
      { x: -2, y: 5 },
      { x: -3, y: 5 },
    ],
    gates: [
      [{ x: -1, y: 4 }, { x: -1, y: 3 }],
    ],
  },
];

// Services this district references. The marriage clerk lives in the
// chapel's side-room (chapel-priest covers the chapel itself); declare it
// here so Wave 3 S1 adds it to BUILDINGS even though no tile binds it as a
// service — the chapel's description names the desk and a future revision
// may bind it.
export const SERVICES = [
  "noble-gate-guard",
  "patron-salon",
  "chapel-priest",
  "marriage-clerk",
];
