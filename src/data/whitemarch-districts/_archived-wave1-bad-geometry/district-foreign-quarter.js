// Foreign Quarter — Embassy Lane + the expanded Halfborn Hostel footprint.
//
// The Foreign Quarter is the city's regulated touch-point with the outside
// world: envoys, merchants, translators, hostage delegations, foreign temples,
// guarded compounds, treaty inns, and the spies everyone politely pretends
// are clerks. This archived module preserves that original ward brief.
//
// Two named footprints live in this module:
//
//   1. Halfborn Hostel — a 3-hex indoor footprint anchored at (-2,-2). This
//      is the Halfborn Hold's town-lodge for freedfolk on city business and,
//      critically per src/system-prompt.js line 119, the ONLY shelter that
//      takes the force-released without papers — Matriarch Vela screens
//      entrants, and not every captive will go or be accepted. The Matron's
//      Office is where the player would go to negotiate that placement.
//
//   2. Embassy Lane — a 4-hex mixed-terrain footprint built around an open
//      lane plaza, with a Treaty Inn, Interpreter Stalls, and Compound Gates
//      (guards on both sides) per WHITEMARCH_FIRST_PASS_TILES.md lines 963-991.
//
// Out-of-box neighbours we deliberately do NOT touch:
//   - (-1,0) Grain Square and (-2,0) Coin Scales — Grand Market (owned elsewhere).
//   - (-2,-2)'s existing outbound door to (-1,-3) is preserved on the new
//      Hostel Hall: that's the established street-side entrance from outside
//      this bounding box, and the door-graph upstream depends on it.

export const DISTRICT_ID = "foreign-quarter";
export const DISTRICT_NAME = "Foreign Quarter";

export const BOUNDING_BOX = { xmin: -3, xmax: -1, ymin: -2, ymax: 0 };

const HOSTEL_PARENT      = "whitemarch-halfborn-hostel";
const HOSTEL_PARENT_NAME = "Halfborn Hostel";

const EMBASSY_PARENT      = "whitemarch-embassy-lane";
const EMBASSY_PARENT_NAME = "Embassy Lane";

export const TILES = {
  // ====================================================================
  // HALFBORN HOSTEL — 3-hex indoor footprint (Hostel Hall + Common Room
  // + Matron's Office). Force-release destination per system-prompt L119.
  // ====================================================================

  // ---------- Hostel Hall (anchor, rewrite of existing single tile) -------
  "-2,-2": {
    terrain: "indoor",
    poi: {
      type: "town",
      name: "Halfborn Hostel",
      access: "public",
      parent: HOSTEL_PARENT,
      parentName: HOSTEL_PARENT_NAME,
      part: "hostel-hall",
      partName: "Hostel Hall",
      description:
        "The Halfborn Hold's town-lodge for freed kin on city business — trade, witness, recovery-writs against old owners, and the ones the city has not yet finished bruising. The hall is long, low, and beam-blackened; cots line the walls under a single iron stove, and the door-rule is plain and unbending: no chains inside, and any chain-collar at the threshold comes off before the bed is given. Matriarch Vela's house, and Matriarch Vela's rules — the rolls she keeps in the back office say who sleeps tonight and who walks back out the door. A small clinic-room serves any Halfborn the city has not yet finished bruising.",
    },
    // Preserve the existing outbound-street door to (-1,-3) — that's the
    // established entrance from the street north of this bounding box.
    // Add internal doors to the two new sub-tiles.
    doors: [
      { x: -1, y: -3 },
      { x: -3, y: -2 },
      { x: -3, y: -1 },
    ],
  },

  // ---------- Common Room — black tea, the matron with the rolls --------
  "-3,-2": {
    terrain: "indoor",
    poi: {
      type: "hall",
      name: "Common Room",
      access: "public",
      parent: HOSTEL_PARENT,
      parentName: HOSTEL_PARENT_NAME,
      part: "common-room",
      partName: "Common Room",
      description:
        "A long room that smells of black tea, hammer-oil, and wet wool drying near the stove. Trestle benches, a stew-pot kept warm by whoever is up first, and the rolls of the day pinned at the door under a hammer-banded matron's eye. She reads the names aloud as freed kin come in off the street, marks them on the slate, and points them to a cot or to the Matriarch's office without changing her tone. The talk here is half languages and half careful silences; nobody asks anyone what they were before the chain came off.",
    },
    doors: [
      { x: -2, y: -2 },
      { x: -3, y: -1 },
    ],
  },

  // ---------- Matron's Office — Matriarch Vela screens entrants -----------
  "-3,-1": {
    terrain: "indoor",
    poi: {
      type: "bldg",
      name: "Matron's Office",
      service: "hostel-matron",
      access: "conditional",
      parent: HOSTEL_PARENT,
      parentName: HOSTEL_PARENT_NAME,
      part: "matrons-office",
      partName: "Matron's Office",
      description:
        "A narrow back-office with a desk, a ledger, an iron strongbox, and a single chair on the supplicant's side. Matriarch Vela sits behind the desk when she is in the city — broad-shouldered, hammer-banded at the wrist, with the patience of someone who has heard every reason a person can give for needing a bed. This is the room where a freed captive's placement is decided: she reads the body, reads the writ, asks the questions she will ask, and says yes, no, or 'come back when you have somewhere to be sent on to.' The Hold does not take every comer, and she does not pretend it does.",
    },
    doors: [
      { x: -2, y: -2 },
      { x: -3, y: -2 },
    ],
  },

  // ====================================================================
  // EMBASSY LANE — 4-hex footprint: lane plaza anchor + Treaty Inn +
  // Interpreter Stalls + Compound Gates. Guards on both sides.
  // ====================================================================

  // ---------- Embassy Lane plaza (anchor) ---------------------------------
  "-3,0": {
    terrain: "settlement",
    poi: {
      type: "plaza",
      name: "Embassy Lane",
      access: "public",
      parent: EMBASSY_PARENT,
      parentName: EMBASSY_PARENT_NAME,
      part: "lane-plaza",
      partName: "Embassy Lane",
      description:
        "A regulated lane that smells of unfamiliar tea, horse sweat, incense, and guarded patience. Flags from distant courts — eastern silk, southern banner-cloth, western quartered shields — hang along the wall beside Whitemarch's white seal, and different calendars are nailed to the same post for the convenience of whoever is paying. Interpreters walk faster than soldiers here. Every compound gate has someone watching from both sides, and the watch knows better than to step inside without a writ.",
    },
    doors: [
      { x: -2, y: 0 },
      { x: -2, y: -1 },
      { x: -3, y: -1 },
      { x: -3, y: 1 },
      { x: -4, y: 0 },
      { x: -4, y: 1 },
    ],
  },

  // ---------- Treaty Inn — neutral ground for envoys ----------------------
  "-2,-1": {
    terrain: "indoor",
    poi: {
      type: "bldg",
      name: "Treaty Inn",
      service: "treaty-inn-keeper",
      access: "public",
      parent: EMBASSY_PARENT,
      parentName: EMBASSY_PARENT_NAME,
      part: "treaty-inn",
      partName: "Treaty Inn",
      description:
        "A two-storey stone inn licensed as neutral ground: envoys, hostage delegations, and merchant houses from courts that will not speak to each other take rooms here under treaty-flag. The keeper runs the door like a chamberlain — names, colours, escorts noted at the threshold — and the common-room tables are spaced wide enough that two delegations can drink in the same room without being seen to share it. Foreign cooks draw crowds at the back kitchen; the wine is overpriced and the discretion is not.",
    },
    doors: [
      { x: -3, y: 0 },
      { x: -1, y: -2 },
      { x: -1, y: -1 },
    ],
  },

  // ---------- Interpreter Stalls — open-air translator rank ---------------
  "-1,-1": {
    terrain: "settlement",
    poi: {
      type: "market",
      name: "Interpreter Stalls",
      service: "embassy-interpreter",
      access: "public",
      parent: EMBASSY_PARENT,
      parentName: EMBASSY_PARENT_NAME,
      part: "interpreter-stalls",
      partName: "Interpreter Stalls",
      description:
        "A rank of small awning-stalls along the lane, each with a slate listing the tongues the interpreter inside will swear to in court: eastern steppe-cant, southern beast-folk pidgin, the three western dialects, the high northern of the hostage courts, a half-dozen merchant creoles. The interpreters make more money than the soldiers watching them and dress like it. A waiting bench at the lane-edge is for clients; a second bench, inside the rope, is for interpreters trading work between themselves in a fast quiet language nobody is buying.",
    },
    doors: [
      { x: -1, y: -2 },
      { x: -2, y: -1 },
      { x: -2, y: 0 },
      { x: -1, y: 0 },
    ],
  },

  // ---------- Compound Gates — guards on both sides ----------------------
  "-1,-2": {
    terrain: "street",
    poi: {
      type: "gate",
      name: "Compound Gates",
      access: "guarded",
      parent: EMBASSY_PARENT,
      parentName: EMBASSY_PARENT_NAME,
      part: "compound-gates",
      partName: "Compound Gates",
      description:
        "A short run of gated compound-fronts opening off the lane — iron-bound doors set in stone, embassy-livery on one side of each threshold and Whitemarch watch-livery on the other. The two sets of guards do not speak to each other and do not need to; they share a tally of who has gone in and who has not come out, and the day's safe-conduct writs are read aloud at every shift. Treaty flags above the lintels are mended often. Drunken insults have torn most of them at least once.",
    },
    doors: [
      { x: 0, y: -2 },
      { x: 0, y: -3 },
      { x: -1, y: -3 },
      { x: -2, y: -1 },
      { x: -1, y: -1 },
    ],
  },
};

// No whole-district sealed structure: per-compound gates are tile-level
// (Compound Gates is a guarded street tile; the Matron's Office is
// conditional-access). The Halfborn Hostel itself is public — Matriarch Vela
// screens at the office, not the front door.
export const STRUCTURES = [];

export const SERVICES = [
  "embassy-interpreter",
  "hostel-matron",
  "treaty-inn-keeper",
];
