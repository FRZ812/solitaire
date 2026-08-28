// Crown Gate Ward — CONSOLIDATION pass. The seven gate-area tiles were
// authored separately in earlier waves as standalone POIs; this module
// unifies them under a single parent footprint the way Chain Market Steps
// and the Grand Market already are, mirroring the pattern in
// district-low-wards.js and district-noble-rise.js.
//
// No new tiles. No terrain, door, type, access, service, or description
// changes. The only edits are the four parent-footprint metadata fields
// (parent, parentName, part, partName) being spliced onto each member
// tile so the door-graph and the [LOCAL PLACE] tag system can read the
// Crown Gate complex as one place.
//
// Footprint inside the bounding box (-2..1, -6..-2):
//
//   y=-6: 0,-6 CROWN ROAD APPROACH  -- staging road OUTSIDE the wall.
//   y=-5: -2,-5 WATCH BUNKHOUSE     -- off-shift bunkhouse against the wall.
//        -1,-5 CROWN STAIR          -- wall hex, owned by "Whitemarch walls".
//                                     LEFT ALONE. Not part of this footprint.
//         0,-5 THE CROWN GATE        -- the gate hex itself (gatehouse throat).
//   y=-4: -2,-4 CROWN GUARDPOST      -- gate-watch barracks built into wall.
//        -1,-4 CUSTOMS HALL          -- old toll-hall, now archives.
//   y=-3: -1,-3 GATE SQUARE          -- inner plaza just inside the gate.
//   y=-2:  1,-2 CROWN LANE           -- porter-lane south of the gate.
//
// The (0,-5) tile already carried a parent slug ("whitemarch-crown-gate")
// from earlier authoring, with a placeholder part of "gatehouse-w" /
// "Toll Hall" and a parentName of "The Crown Gate". This module normalises
// that entry to the consolidated scheme: parentName "Crown Gate Ward",
// part "crown-gate", partName "The Crown Gate". Description and all other
// fields are preserved verbatim.
//
// Crown Stair at (-1,-5) belongs to the Whitemarch walls parent and is
// NOT touched here.
//
// No services. The Crown Gate uses no trade button — permits and
// atmosphere, not a counter.

export const DISTRICT_ID   = "crown-gate";
export const DISTRICT_NAME = "Crown Gate Ward";

export const BOUNDING_BOX = { xmin: -2, xmax: 1, ymin: -6, ymax: -2 };

const PARENT      = "whitemarch-crown-gate";
const PARENT_NAME = "Crown Gate Ward";

export const TILES = {
  // ---------- Crown Road Approach — staging road outside the wall --------
  "0,-6": {
    terrain: "road",
    poi: {
      type: "gate",
      name: "Crown Road Approach",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "crown-road-approach",
      partName: "Crown Road Approach",
      description:
        "The road widens into trampled stone before Whitemarch's gate. Carts wait in ranked lines, oxen steaming; pilgrims sleep against bundles. The gate-spires rise black and white through the chimney smoke, signal-bells hung under iron roofs, and Road Wardens watch the queue long before any official does.",
    },
    doors: [
      { x: 1, y: -7 },
      { x: 0, y: -7 },
      { x: 0, y: -5 },
    ],
  },

  // ---------- The Crown Gate — the gate hex (gatehouse throat) -----------
  // Was already parented to "whitemarch-crown-gate" with a placeholder
  // part of "gatehouse-w" / "Toll Hall" and parentName "The Crown Gate".
  // Normalised to the consolidated footprint scheme. Description, doors,
  // terrain, type, and access preserved verbatim.
  "0,-5": {
    terrain: "settlement",
    poi: {
      type: "gate",
      name: "The Crown Gate",
      access: "conditional",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "crown-gate",
      partName: "The Crown Gate",
      description:
        "A long stone throat through the wall. Clerks sit behind barred counters, ledgers chained to the desks; every stamp echoes and every coin is bitten or weighed while guards keep pike-points low enough to remind the crowd that patience is cheaper than injury. Separate counters sort guild, citizen, foreigner, livestock, and bonded traffic. Murder-holes in the vault overhead are unstoppered when the bell warns of trouble.",
    },
    doors: [
      { x: 0, y: -4 },
      { x: 0, y: -6 },
      { x: -1, y: -5 },
      { x: 1, y: -6 },
      { x: -1, y: -4 },
      { x: 1, y: -5 },
    ],
  },

  // ---------- Gate Square — inner plaza just inside the gate -------------
  "-1,-3": {
    terrain: "street",
    poi: {
      type: "plaza",
      name: "Gate Square",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "gate-square",
      partName: "Gate Square",
      description:
        "A broad paved square just inside the Crown Gate, where every wagon and pilgrim that clears the Toll Hall spills out into the city. Touts, porters, and idle Market Watch lean against the wall-stones; the gate's roar — wheels on stone, ox-bellows, the sergeants — beats through the gatehouse at every gate-bell and falls again as the queue moves.",
    },
    doors: [
      { x: 0, y: -3 },
      { x: 0, y: -4 },
      { x: -2, y: -3 },
      { x: -2, y: -2 },
      { x: -1, y: -2 },
    ],
  },

  // ---------- Customs Hall — old toll-hall, now archives -----------------
  "-1,-4": {
    terrain: "settlement",
    poi: {
      type: "hall",
      name: "Customs Hall",
      access: "conditional",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "customs-hall",
      partName: "Customs Hall",
      description:
        "The city's old toll-hall, kept on after the wall was thickened and the gate moved out into its own complex. Now the cleared paperwork goes here for archiving — sealed receipts, status-stamps, livestock-counts, every entry recorded against the gate's daily roll. Clerks come and go through the small side door; the main counters were boarded over when the new gatehouse opened.",
    },
    doors: [
      { x: 0, y: -5 },
    ],
  },

  // ---------- Crown Guardpost — gate-watch barracks built into wall ------
  "-2,-4": {
    terrain: "indoor",
    poi: {
      type: "barracks",
      name: "Crown Guardpost",
      access: "restricted",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "crown-guardpost",
      partName: "Crown Guardpost",
      description:
        "A squat barracks-block built into the wall beside the gate. Bunks stacked three high under low rafters; pike-racks polished by passing shoulders; a kettle always near boil over a peat-fire that the sergeants refuse to let go out. The gate-watch sleeps here in shifts, and the city's first answer to a gate-side problem is whoever happens to be lacing boots.",
    },
    doors: [
      { x: -2, y: -3 },
    ],
  },

  // ---------- Watch Bunkhouse — off-shift bunkhouse against the wall -----
  "-2,-5": {
    terrain: "indoor",
    poi: {
      type: "barracks",
      name: "Watch Bunkhouse",
      access: "restricted",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "watch-bunkhouse",
      partName: "Watch Bunkhouse",
      description:
        "A long stone bunkhouse with its back built straight into the wall. Two rows of three-deep cots, lockers stamped with watch-numbers, and a stove always banked. Off-shift watchmen pull boots up here between gate-watch and wall-watch; the sergeants drink at the table by the door where they can see everyone come and go.",
    },
    doors: [
      { x: -2, y: -4 },
      { x: -3, y: -4 },
    ],
    wallside: true,
  },

  // ---------- Crown Lane — porter-lane south of the gate -----------------
  "1,-2": {
    terrain: "street",
    poi: {
      type: "plaza",
      name: "Crown Lane",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "crown-lane",
      partName: "Crown Lane",
      description:
        "The lane south of the gate, where porters and runners gather waiting for fares and the day's first newssheets are sold off a barrow. The gate's roar carries down the lane and falls again as the queue moves through the Toll Hall.",
    },
    doors: [
      { x: 2, y: -2 },
      { x: 2, y: -3 },
      { x: 1, y: -3 },
      { x: 0, y: -2 },
      { x: 0, y: -1 },
      { x: 1, y: -1 },
    ],
  },
};

// No new sealed structures — the wall ring and the Crown Stair at
// (-1,-5) are owned elsewhere and pre-existing. This is a metadata-only
// consolidation of seven existing tiles.
export const STRUCTURES = [];

// No services. The Crown Gate is permits, tolls, and atmosphere — there
// is no trade counter button in the footprint.
export const SERVICES = [];
