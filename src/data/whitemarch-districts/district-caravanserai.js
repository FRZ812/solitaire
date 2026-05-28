// The Caravanserai — a fortified mass-lodging for the caravans that approach
// Whitemarch, set WEST of the city across a stretch of procedural country. The
// road out of Whitemarch's Crown Gate (at the city's NE wall) loops north,
// west, and south to come back east onto the Caravanserai's only proper gate
// at (-9,0). The Caravanserai is the OVERFLOW the city refuses to keep inside
// its own walls: bulk caravans, mass drovers, foreign teamsters cooking by
// their own customs, and the customs-house bonded-goods queue. Whitemarch's
// own Caravan Yard & Stable (NW corner) is the PUBLIC mount-trade face — this
// place is the working stockyard that feeds it.
//
// The bible files this on the WHITEMARCH_CITY.md "Caravan Yards" page (lines
// 136-176) — purpose, daily texture, tile-list — and on the "Foreign Quarter"
// page (lines 493-533) for the multi-culture tone. The system prompt
// (src/system-prompt.js L186-190) already names the city's Caravan Yard and
// Embassy Lane; this district sits outside the wall and complements both.
//
// Spatial spec (strict, set by the Whitemarch content rebuild):
//   Bounding box: x in -15..-9, y in -3..3. A 7-col by 7-row block.
//   Wall ring on the perimeter — mud-brick over stone footings, watchtowers at
//   the four corners. Less impressive than Whitemarch's Great Wall: this is a
//   stockade with a city pretension, not a fortress.
//   The ONE gate is at (-9,0) — the EAST face — looking back at Whitemarch
//   across procedural country. The road from Whitemarch's Crown Gate loops
//   north, west, and south through unauthored procedural country and comes
//   back east to (-8,0), where it meets the Caravanserai's East Gate.
//
// Footprint (12 named POIs, all share parent slug "whitemarch-caravanserai"):
//   (-9,  0) East Gate            — gate (caravanserai-warden)
//   (-10, 0) Wagon Court          — settlement, public (anchor plaza)
//   (-11, 0) Stall Row            — settlement, public
//   (-10,-1) Customs Back-Office  — indoor, conditional (dock-customs-officer)
//   (-10, 1) Interpreters' Bench  — settlement, public (embassy-interpreter)
//   (-11,-1) Caravanserai Tavern  — indoor, public (tavern)
//   (-11, 1) Money-Changer        — indoor, public (money-changer)
//   (-12,-1) Bunkhouse I          — indoor, public
//   (-12, 1) Bunkhouse II         — indoor, public
//   (-13, 0) Smith's Lean-To      — indoor, public (farrier)
//   (-13,-1) Mosque / Hospice     — indoor, public
//   (-14, 0) Caravan Master's House — indoor, conditional
//
// The remaining interior hexes are authored as plain "settlement" yard so the
// wall-autoseal doesn't strand them as procedural and so the player can walk
// the rear of the yard between Bunkhouses, Smithy, and Master's House.

export const DISTRICT_ID   = "caravanserai";
export const DISTRICT_NAME = "The Caravanserai";

export const BOUNDING_BOX = { xmin: -15, xmax: -9, ymin: -3, ymax: 3 };

const PARENT      = "whitemarch-caravanserai";
const PARENT_NAME = "The Caravanserai";

// ----------------------------------------------------------------------------
// Helper: a plain settlement "open yard" tile with no POI. Used for the
// interior hexes that aren't named landmarks but still need to be authored so
// the wall ring auto-seal sees a defined neighbour and the player can cross
// the rear of the yard on foot.
// ----------------------------------------------------------------------------
function yard() {
  return {
    terrain: "settlement",
    poi: {
      type: "yard",
      name: "Caravanserai Yard",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "open-yard",
      partName: "Open Yard",
      description:
        "An open stretch of trampled clay between the wagon-court and the rear stalls. Dung-fires on the lee of the wall, washing strung between bunkhouses, a child running with a bucket of water for copper. The mud-brick of the wall keeps the wind off; the noise of the wagon-court rolls back here muted by the sleep-halls.",
    },
  };
}

// ----------------------------------------------------------------------------
// Helper: a wall tile. Walls get doors:undefined so the auto-seal computes
// them. Corner-tower walls carry a partName for flavour; the rest are plain
// curtain-wall hexes.
// ----------------------------------------------------------------------------
function wall(part, partName, description) {
  return {
    terrain: "wall",
    poi: {
      type: part === "tower" ? "tower" : "site",
      name: PARENT_NAME + " Wall",
      access: "restricted",
      parent: PARENT,
      parentName: PARENT_NAME,
      part,
      partName,
      description,
    },
    // doors: undefined — auto-seal fills these in.
  };
}

const CURTAIN_DESC =
  "A run of mud-brick wall raised on a knee-high stone footing. Shorter and rougher than Whitemarch's white curtain — caravan-money paid for it, not the Treasury — but high enough to keep bandits and stray beasts out, with a parapet walk the warden's men pace at night with a horn and a lamp.";

const TOWER_DESC =
  "A squat stone watchtower at the corner of the wall — the only stone on this whole perimeter, paid for after a bad season of horse-thieves. A single brazier burns at the top, watched by one of the warden's men, with a horn on a thong and a tally-stick for the wagons coming up the road.";

export const TILES = {
  // ========================================================================
  // WALL RING — 7 across the north (y=-3) and south (y=3), 5 down each side
  // (x=-15 west, x=-9 east). The east-middle hex (-9,0) is the gate, not a
  // wall. The four corners are stone watchtowers; everything else is the
  // mud-brick curtain.
  // ========================================================================

  // North wall (y=-3), with NW and NE corner-towers
  "-15,-3": wall("tower", "Northwest Watchtower", TOWER_DESC),
  "-14,-3": wall("curtain", "North Curtain", CURTAIN_DESC),
  "-13,-3": wall("curtain", "North Curtain", CURTAIN_DESC),
  "-12,-3": wall("curtain", "North Curtain", CURTAIN_DESC),
  "-11,-3": wall("curtain", "North Curtain", CURTAIN_DESC),
  "-10,-3": wall("curtain", "North Curtain", CURTAIN_DESC),
  "-9,-3":  wall("tower", "Northeast Watchtower", TOWER_DESC),

  // South wall (y=3), with SW and SE corner-towers
  "-15,3": wall("tower", "Southwest Watchtower", TOWER_DESC),
  "-14,3": wall("curtain", "South Curtain", CURTAIN_DESC),
  "-13,3": wall("curtain", "South Curtain", CURTAIN_DESC),
  "-12,3": wall("curtain", "South Curtain", CURTAIN_DESC),
  "-11,3": wall("curtain", "South Curtain", CURTAIN_DESC),
  "-10,3": wall("curtain", "South Curtain", CURTAIN_DESC),
  "-9,3":  wall("tower", "Southeast Watchtower", TOWER_DESC),

  // West wall (x=-15), y in -2..2
  "-15,-2": wall("curtain", "West Curtain", CURTAIN_DESC),
  "-15,-1": wall("curtain", "West Curtain", CURTAIN_DESC),
  "-15,0":  wall("curtain", "West Curtain", CURTAIN_DESC),
  "-15,1":  wall("curtain", "West Curtain", CURTAIN_DESC),
  "-15,2":  wall("curtain", "West Curtain", CURTAIN_DESC),

  // East wall (x=-9), y in -2..2 EXCEPT (-9,0) which is the gate
  "-9,-2": wall("curtain", "East Curtain", CURTAIN_DESC),
  "-9,-1": wall("curtain", "East Curtain", CURTAIN_DESC),
  "-9,1":  wall("curtain", "East Curtain", CURTAIN_DESC),
  "-9,2":  wall("curtain", "East Curtain", CURTAIN_DESC),

  // ========================================================================
  // EAST GATE — the only proper opening. Looks east, back at Whitemarch
  // across procedural country. The road out of Whitemarch's Crown Gate (at
  // the NE wall of the city) loops north, west, and south through unauthored
  // procedural country and comes back to (-8,0) here, where it meets the gate.
  // Explicit doors include the procedural country hex outside at (-8,0) AND
  // the Wagon Court inner approach at (-10,0).
  // ========================================================================
  "-9,0": {
    terrain: "settlement",
    poi: {
      type: "gate",
      service: "caravanserai-warden",
      name: "East Gate",
      access: "public",
      area: "caravanserai",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "east-gate",
      partName: "East Gate",
      description:
        "The Caravanserai's only proper gate — twin doors of oak banded in iron, set into a stone arch under a tile-roofed gatehouse. The warden's men sit on a bench under the arch with a tally-stick and a strongbox; a queue of wagons backs up along the road outside on busy mornings, drovers walking up to argue toll. The view east is procedural country and, on a clear day, the white line of Whitemarch's Great Wall a half-day's hauling away across the road that loops the city's north flank.",
    },
    doors: [
      { x: -8, y: 0 },   // procedural country: the road back to Whitemarch
      { x: -10, y: 0 },  // Wagon Court, the inner approach
    ],
  },

  // ========================================================================
  // INTERIOR — 25 hexes total in x in -14..-10, y in -2..2.
  // 12 named POIs (above) + the rest as plain yard hexes.
  // ========================================================================

  // ---------- Wagon Court (-10,0) — the central plaza ---------------------
  // The anchor: the open clay yard where wagons pull up off the East Gate,
  // teams are unhitched, and drovers walk to whichever bunkhouse, tavern, or
  // counter they need. Sits one hex in from the gate.
  "-10,0": {
    terrain: "settlement",
    poi: {
      type: "plaza",
      name: "Wagon Court",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "wagon-court",
      partName: "Wagon Court",
      description:
        "A wide oval of trampled clay just inside the East Gate — the heart of the Caravanserai. Wagons back in here off the road; ox-teams stand head-down in the harness while drovers haggle with the warden's clerks; a stone trough at the centre is fed from a cistern in the wall. The smell is dung, wet canvas, hot axle grease, cheap stew, and tired money. Children run water for copper. Foreign drovers cook separately along the rim, on small fires under tile awnings.",
    },
    doors: [
      { x: -9, y: 0 },   // East Gate
      { x: -10, y: -1 }, // Customs Back-Office
      { x: -10, y: 1 },  // Interpreters' Bench
      { x: -11, y: 0 },  // Stall Row
      { x: -11, y: 1 },  // Money-Changer
    ],
  },

  // ---------- Customs Back-Office (-10,-1) -------------------------------
  // Where Whitemarch's customs officers process bonded caravans BEFORE the
  // wagons go east through the city's Crown Gate. The bond-and-seal work
  // happens here so the Crown Gate's Toll Hall isn't choked with bulk-haul
  // paperwork. Conditional-access: drovers walk in with a writ, not without.
  "-10,-1": {
    terrain: "indoor",
    poi: {
      type: "bldg",
      name: "Customs Back-Office",
      service: "dock-customs-officer",
      access: "conditional",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "customs-back-office",
      partName: "Customs Back-Office",
      description:
        "A stone-floored office of the city's customs staff, posted out here so Whitemarch's Crown Gate Toll Hall isn't choked with bulk-haul paperwork. Bonded caravans process here: manifests stamped, lead seals crimped onto crates, a brass-bound ledger fattening on every wagon-load. Two officers in city livery sit behind a long counter with a scale, a pot of ink, and the patience of men who know every smuggler's first try. A wall-rack holds the day's writs under numbered pegs.",
    },
    doors: [
      { x: -10, y: 0 },  // Wagon Court
      { x: -11, y: -1 }, // Caravanserai Tavern
    ],
  },

  // ---------- Interpreters' Bench (-10,1) --------------------------------
  // The Caravanserai's open-air translator rank — same service id as Embassy
  // Lane's Interpreter Stalls in the city, so a player can hire here OR
  // in-city through the same wiring. Foreign drovers stop here first.
  "-10,1": {
    terrain: "settlement",
    poi: {
      type: "market",
      name: "Interpreters' Bench",
      service: "embassy-interpreter",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "interpreters-bench",
      partName: "Interpreters' Bench",
      description:
        "A long awning-bench along the south side of the Wagon Court where the Caravanserai's interpreters sit and trade work. Each has a slate listing the tongues they will swear to: eastern steppe-cant, southern beast-folk pidgin, the three western dialects, a half-dozen merchant creoles. Drovers off a fresh caravan stop here before they go to Customs or the Money-Changer; the interpreter walks them through both for a flat fee. The same swear-list hangs on Embassy Lane inside the city — same rates, same names.",
    },
    doors: [
      { x: -10, y: 0 },  // Wagon Court
      { x: -11, y: 1 },  // Money-Changer
    ],
  },

  // ---------- Stall Row (-11,0) ------------------------------------------
  // Pull-up bays for wagons + teams, lit at night by oil lamps on iron
  // hooks. Settles between the Wagon Court and the deep interior.
  "-11,0": {
    terrain: "settlement",
    poi: {
      type: "yard",
      name: "Stall Row",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "stall-row",
      partName: "Stall Row",
      description:
        "A double line of timber pull-up bays under a long pent-roof — each bay big enough for a wagon and its team, with a manger at the head and a ring-bolt at the rail. Oil lamps on iron hooks burn against the lean of the roof at night, and the straw underfoot is forked over by yard-boys between shifts. Drovers sleep under the wagons when the bunkhouses are full, with the team tied an arm's length away.",
    },
    doors: [
      { x: -10, y: 0 },  // Wagon Court
      { x: -11, y: -1 }, // Caravanserai Tavern
      { x: -11, y: 1 },  // Money-Changer
      { x: -12, y: 0 },  // open yard
      { x: -12, y: 1 },  // Bunkhouse II
    ],
  },

  // ---------- Caravanserai Tavern (-11,-1) -------------------------------
  // The drovers' common-room: stew, ale, foreign cooks at the back kitchen,
  // a slate of road-rumours on the door. Reuses the existing `tavern`
  // service (the city's Iron Tankard is the only other one wired).
  "-11,-1": {
    terrain: "indoor",
    poi: {
      type: "bldg",
      name: "Caravanserai Tavern",
      service: "tavern",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "caravanserai-tavern",
      partName: "Caravanserai Tavern",
      description:
        "A long low common-room of smoke-blackened beams, a stew-pot kept warm at the hearth, and trestle benches that fill in waves as caravans come off the road. The keeper takes coin in three currencies and the Money-Changer's chits in a fourth; the cooks at the back kitchen are whoever has paid for a corner this week, and the smell changes with the caravan. A slate by the door lists roads, weathers, and the tolls last seen — the closest thing on the western road to a Hiring Board.",
    },
    doors: [
      { x: -10, y: -1 }, // Customs Back-Office
      { x: -11, y: 0 },  // Stall Row
      { x: -12, y: -1 }, // Bunkhouse I
    ],
  },

  // ---------- Money-Changer's Counter (-11,1) ----------------------------
  // The Caravanserai's coin-exchange: foreign metal in, Whitemarch chips
  // out, with a scale, a touchstone, and a brass-bound ledger. New service
  // id (Wave 3 S1 will add `money-changer` to BUILDINGS).
  "-11,1": {
    terrain: "indoor",
    poi: {
      type: "bldg",
      name: "Money-Changer's Counter",
      service: "money-changer",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "money-changer-counter",
      partName: "Money-Changer's Counter",
      description:
        "A narrow shop with a brass-grilled counter, a balance-scale, a touchstone in a felt-lined box, and a rack of clipping-shears for testing foreign coin. The money-changer sits in a chair raised half a step above the floor — a clerk's trick — and reads each coin by weight and acid before he names a rate. Whitemarch chips are paid in three denominations; everything else goes into a strongbox under the counter. Drovers come here straight off the Wagon Court and grumble about the take.",
    },
    doors: [
      { x: -10, y: 1 },  // Interpreters' Bench
      { x: -11, y: 0 },  // Stall Row
      { x: -12, y: 1 },  // Bunkhouse II
    ],
  },

  // ---------- Bunkhouse I (-12,-1) ---------------------------------------
  // Long sleep-hall for drovers — paid by the night, by the cot.
  "-12,-1": {
    terrain: "indoor",
    poi: {
      type: "hall",
      name: "Bunkhouse I",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "bunkhouse-one",
      partName: "Bunkhouse I",
      description:
        "A long sleep-hall: a single iron stove at the centre, cots in three rows, hooks for harness and lamps on every post. The bunkhouse-keeper sits at the door with a slate of names and a basket for coin, and the men inside sleep in their clothes against the next dawn. The talk is half languages and half snoring; a wet cloth steams on the stove all night. There is a second one identical across the yard, run by the same keeper's son.",
    },
    doors: [
      { x: -11, y: -1 }, // Caravanserai Tavern
      { x: -13, y: -1 }, // Mosque / Hospice
      { x: -12, y: 0 },  // open yard
    ],
  },

  // ---------- Bunkhouse II (-12,1) ---------------------------------------
  // The sibling sleep-hall on the south side of the yard.
  "-12,1": {
    terrain: "indoor",
    poi: {
      type: "hall",
      name: "Bunkhouse II",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "bunkhouse-two",
      partName: "Bunkhouse II",
      description:
        "Twin of Bunkhouse I across the rear yard — same cots, same stove, same slate at the door, with the keeper's son sitting where the keeper sits. By long habit, the south hall is where drovers from the south road sleep, and the north hall is where the east-road and steppe-road drovers sleep; the keeper says it cuts the fights by half. The wall between the bunks is thick with chalked road-names and the marks of saints whose languages do not meet here in daylight.",
    },
    doors: [
      { x: -11, y: 1 },  // Money-Changer
      { x: -11, y: 0 },  // Stall Row (axial neighbour)
      { x: -12, y: 0 },  // open yard
      { x: -13, y: 1 },  // open yard (south rear)
    ],
  },

  // ---------- Smith's Lean-To (-13,0) ------------------------------------
  // The yard's farrier and wagon-repair shed — single forge, an anvil, a
  // wheel-jack, and a rack of replacement axle-pins. Reuses the existing
  // `farrier` service.
  "-13,0": {
    terrain: "indoor",
    poi: {
      type: "smithy",
      name: "Smith's Lean-To",
      service: "farrier",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "smiths-lean-to",
      partName: "Smith's Lean-To",
      description:
        "A lean-to forge against the west yard-wall, blue with the smoke of burning hoof and loud with the ring of the shoeing-hammer. A wheel-jack and a tongue-and-groove bench take up half the floor; the other half is the farrier's space, with a beast cross-tied and one hind hoof up in his lap. Drivers wait their turn on a worn bench, comparing roads and tolls. The smith handles wagon-repair and shoeing both — there is nobody else for half a day's haul.",
    },
    doors: [
      { x: -12, y: 0 },  // open yard
      { x: -13, y: -1 }, // Mosque / Hospice
      { x: -13, y: 1 },  // open yard (south rear)
      { x: -14, y: 0 },  // Caravan Master's House
    ],
  },

  // ---------- Mosque / Hospice for Foreign Faiths (-13,-1) ---------------
  // A multi-faith room where foreign drovers worship by their own customs.
  // The Watch does not enter; the warden does not interfere.
  "-13,-1": {
    terrain: "indoor",
    poi: {
      type: "temple",
      name: "Mosque / Hospice for Foreign Faiths",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "foreign-faiths-hospice",
      partName: "Mosque / Hospice",
      description:
        "A long room with the floor swept clean and the windows shuttered against weather, set aside for the foreign drovers to worship by their own customs. A washing-bowl by the door, a low rail at the back for those who pray bowed, a niche cut into the west wall for those who pray toward the sunset, a corner curtained for those who do not pray in company. The Watch does not enter, the warden does not interfere, and the keeper of the hospice is whichever drover the caravans last left in charge.",
    },
    doors: [
      { x: -12, y: -1 }, // Bunkhouse I
      { x: -13, y: 0 },  // Smith's Lean-To
    ],
  },

  // ---------- Caravan Master's House (-14,0) -----------------------------
  // The warden's residence and office. Conditional-access: the warden
  // receives caravan-masters here on appointment, not casual visitors.
  "-14,0": {
    terrain: "indoor",
    poi: {
      type: "bldg",
      name: "Caravan Master's House",
      service: "caravanserai-warden",
      access: "conditional",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "caravan-masters-house",
      partName: "Caravan Master's House",
      description:
        "A square house of mortared stone against the west wall — the only stone-built quarters in the Caravanserai besides the corner-towers — with a slate roof and a single chimney. The warden lives here when she is on the ground: ground-floor office with a wide map-table and a strongbox under the desk, sleeping-quarters above, a back room where the caravan-masters take tea while she works through their toll. Conditional ground: she does not see drovers, only the masters and the city's customs men.",
    },
    doors: [
      { x: -13, y: 0 },  // Smith's Lean-To
      { x: -14, y: -1 }, // open yard (north rear)
      { x: -14, y: 1 },  // open yard (south rear)
    ],
  },

  // ========================================================================
  // OPEN YARD — the remaining interior hexes, plain settlement so the
  // wall-autoseal sees defined neighbours and the player can cross the rear
  // of the yard between the bunkhouses, smithy, and Master's House.
  // ========================================================================
  "-11,-2": yard(),
  "-12,-2": yard(),
  "-13,-2": yard(),
  "-14,-2": yard(),
  "-10,-2": yard(),
  "-12,0":  yard(),
  "-13,1":  yard(),
  "-14,-1": yard(),
  "-14,1":  yard(),
  "-10,2":  yard(),
  "-11,2":  yard(),
  "-12,2":  yard(),
  "-13,2":  yard(),
  "-14,2":  yard(),
};

// ----------------------------------------------------------------------------
// Sealed structure: the Caravanserai as a single walled compound. The interior
// is every non-wall hex inside the box; the one gate-pair is the East Gate at
// (-9,0) bridging out to procedural country at (-8,0).
// ----------------------------------------------------------------------------
const INTERIOR_KEYS = Object.keys(TILES).filter((k) => TILES[k].terrain !== "wall");

export const STRUCTURES = [
  {
    name: PARENT_NAME,
    interior: INTERIOR_KEYS.map((k) => {
      const [x, y] = k.split(",").map(Number);
      return { x, y };
    }),
    gates: [
      [{ x: -9, y: 0 }, { x: -8, y: 0 }],
    ],
  },
];

// Services this module references. `tavern` is already in town.js BUILDINGS;
// `farrier` was declared by the Great Stable district (also already added by
// Wave 3 S1 work) and reused here. The other four are new ids this module
// introduces and the Wave 3 S1 audit will surface them.
export const SERVICES = [
  "caravanserai-warden",
  "money-changer",
  "embassy-interpreter",
  "dock-customs-officer",
  "farrier",
  "tavern",
];
