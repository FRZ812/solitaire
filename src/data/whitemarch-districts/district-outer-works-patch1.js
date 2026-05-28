// The Outer Works — Outer Ring Patch.
//
// The first pass (district-outer-works.js) authored a small single-ring
// enclosure at (-4..4, -16..-9) sitting in procedural country one hex
// north of Whitemarch's Crown Road Approach. The enclosure was right but
// the scale was wrong: a road fort the size of a hospitaller's chapel,
// floating in unnamed grass. This patch wraps a second, larger wall ring
// around the inner one and sets the new outer gate one hex from the
// Crown Road Approach so the satellite is physically welded to the city.
//
// Geometry: an expanded 15-col × 13-row box (xmin:-7..xmax:7,
// ymin:-19..ymax:-7). The inner ring's perimeter at (-4..4, -16..-9)
// stays bit-for-bit untouched (the seed-script collision check enforces
// this — every coord this module writes is OUTSIDE the inner box and
// inside the expanded box, an annulus 2-3 hexes thick on each side).
//
// The new outer perimeter is authored as terrain:"wall" the whole way
// around, with a SINGLE gate at (0,-7) on the south face. The gate hex
// is the only opening through the outer ring. Crucially, Crown Road
// Approach at (0,-6) — the live row's gate-mouth into Whitemarch proper
// — already lists (0,-7) in its doors, so the outer gate at (0,-7)
// CONNECTS DIRECTLY to the city's gate-throat with no procedural hex
// between them. South door of the outer gate is (0,-6) Crown Road
// Approach; north door is (0,-8) Outer Ward Yard. The inner gate at
// (0,-9) already lists (0,-8) in its doors, so the chain
// city -> Crown Gate -> Crown Road Approach -> outer gate -> Outer Ward
// Yard -> inner gate -> Crown Road spine inside the inner ring is now
// continuous.
//
// Internal layout, south (city-facing) to north (frontier-facing):
//   y=-7   outer wall ring + Crown Watchpost gate at (0,-7).
//   y=-8   the outer-ring courtyard band running east-west between the
//          outer wall and the inner ring's south face. Outer Ward Yard
//          at the centre, Sutlers' Row, Apothecary's Tent, Forward
//          Camp, Cartwright Yard along the strip.
//   y=-9..-16   the side strips down each flank of the inner ring.
//          Cattle-Pens west, Tilt-Yard east at the south of each strip;
//          Bivouac Court west, Officers' Mess east at the mid-strip.
//          The rows the inner ring already occupies (x=-4..4) are left
//          alone — this module only writes x in {-6,-5,5,6}.
//   y=-17..-18  the cleared northern annulus around the back of the
//          inner ring's north face. Funeral Pyre Stand to the west,
//          Provost's Office to the east.
//   y=-19  the north wall, full row of walls.
//
// All new walls carry doors:undefined; runWallAutoSeal seals them
// against the procedural country outside the ring on every load.
//
// All 12 named POIs (counting the gate) share parent="whitemarch-outer-
// works" / parentName="The Outer Works" with the inner ring, but use
// area: "outer-works-outer-ring" so the door-graph audit can distinguish
// the two enclosures when it walks them.

export const DISTRICT_ID = "outer-works-patch1";
export const DISTRICT_NAME = "The Outer Works (Outer Ring Patch)";

export const BOUNDING_BOX = { xmin: -7, xmax: 7, ymin: -19, ymax: -7 };

const PARENT      = "whitemarch-outer-works";
const PARENT_NAME = "The Outer Works";
const AREA        = "outer-works-outer-ring";

// -------------------------------------------------------------------------
// Outer wall ring. Doors are intentionally undefined; the pipeline's
// runWallAutoSeal computes them from neighbours every load. Total walls:
//   north (y=-19, x=-7..7)              : 15
//   south (y=-7, x=-7..7 except x=0)    : 14   (x=0 is the gate)
//   west  (x=-7, y=-8..-18)             : 11
//   east  (x=7,  y=-8..-18)             : 11
// = 51 wall hexes.
// -------------------------------------------------------------------------
const WALL = { terrain: "wall" };

const outerWallRing = {
  // North face, y=-19, x=-7..7.
  "-7,-19": WALL, "-6,-19": WALL, "-5,-19": WALL, "-4,-19": WALL,
  "-3,-19": WALL, "-2,-19": WALL, "-1,-19": WALL, "0,-19": WALL,
  "1,-19":  WALL, "2,-19":  WALL, "3,-19":  WALL, "4,-19":  WALL,
  "5,-19":  WALL, "6,-19":  WALL, "7,-19":  WALL,
  // South face, y=-7. Gate at (0,-7); rest are walls.
  "-7,-7": WALL, "-6,-7": WALL, "-5,-7": WALL, "-4,-7": WALL,
  "-3,-7": WALL, "-2,-7": WALL, "-1,-7": WALL,
  "1,-7":  WALL, "2,-7":  WALL, "3,-7":  WALL, "4,-7":  WALL,
  "5,-7":  WALL, "6,-7":  WALL, "7,-7":  WALL,
  // West face, x=-7, y=-8..-18.
  "-7,-8":  WALL, "-7,-9":  WALL, "-7,-10": WALL, "-7,-11": WALL,
  "-7,-12": WALL, "-7,-13": WALL, "-7,-14": WALL, "-7,-15": WALL,
  "-7,-16": WALL, "-7,-17": WALL, "-7,-18": WALL,
  // East face, x=7, y=-8..-18.
  "7,-8":  WALL, "7,-9":  WALL, "7,-10": WALL, "7,-11": WALL,
  "7,-12": WALL, "7,-13": WALL, "7,-14": WALL, "7,-15": WALL,
  "7,-16": WALL, "7,-17": WALL, "7,-18": WALL,
};

// -------------------------------------------------------------------------
// Interior tiles: 12 named POIs (counting the gate) + connector hexes
// across the courtyard band, the side strips, and the north annulus.
//
// Door-graph notes:
//   - Every authored cell lists its in-ring walkable neighbours per
//     HEX_DIRS [(1,0),(1,-1),(0,-1),(-1,0),(-1,1),(0,1)].
//   - Procedural neighbours (no authored tile) may be listed as doors;
//     the procedural-side default-open rules reciprocate.
//   - Wall neighbours are NEVER listed — the auto-seal would prune them
//     anyway from this side, and the wall side will not reciprocate.
//   - The inner-ring walls at x=-4 (west face) and x=4 (east face) for
//     y=-10..-15 are not listed as doors from the side-strip cells at
//     x=-5 / x=5 — they stay sealed. The inner ring's gate at (0,-9) IS
//     listed as a door target from (0,-8) Outer Ward Yard since (0,-9)
//     already opens onto (0,-8) per the live row.
// -------------------------------------------------------------------------

const interior = {

  // ===================== OUTER GATE (south face, y=-7) =================

  // Crown Watchpost — the new outer gate. Welded to Crown Road Approach
  // at (0,-6); opens northward onto Outer Ward Yard at (0,-8).
  "0,-7": {
    terrain: "settlement",
    poi: {
      type: "gate",
      service: "wall-sergeant",
      name: "Crown Watchpost",
      access: "guarded",
      area: AREA,
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "crown-watchpost",
      partName: "Crown Watchpost",
      description:
        "A second iron-shod gate set in the outer wall the road must pass before it can present papers at the city's Crown Gate proper. The watchpost is a low stone hall with a counter under a tally-board: today's traffic, last night's traffic, the names of patrols out and the patrols expected back. The wall-sergeant on duty waves caravans into the courtyard beyond while a junior reads the seals; carts that fail the check are turned back into the road and told to wait for a captain. The murder-holes overhead are blackened with old smoke.",
    },
    // Doors per spec: (0,-6) Crown Road Approach south, (0,-8) Outer
    // Ward Yard north. Side cells (-1,-7) and (1,-7) are walls.
    doors: [
      { x: 0, y: -6 }, // Crown Road Approach — city side
      { x: 0, y: -8 }, // Outer Ward Yard — outer-ring courtyard
    ],
  },

  // ===================== y = -8 BAND (outer-ring courtyard) ===========

  // Forward Camp — the west end of the courtyard strip. Tents and
  // cookfires for the road patrols mustering out toward the frontier.
  "-5,-8": {
    terrain: "settlement",
    poi: {
      type: "yard",
      name: "Forward Camp",
      access: "public",
      area: AREA,
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "forward-camp",
      partName: "Forward Camp",
      description:
        "A row of patrol-tents pitched in the lee of the outer wall, smelling of woodsmoke, wet wool, and oil. Each tent has a numbered pole and a cookfire ringed with field-stones; the patrols rotating onto the Crown Road sleep here the night before they ride out, and the patrols coming in collapse here the night after. The serjeant-of-camp keeps a slate with the duty rotation chalked up; nobody but him is allowed to rub a name off.",
    },
    doors: [
      { x: -6, y: -8 }, // Cattle-Pens west neighbour on the strip
      { x: -4, y: -8 }, // Sutlers' Row east
      { x: -5, y: -9 }, // procedural fill, west side strip (just outside inner-ring wall at -4,-9)
      { x: -4, y: -9 }, // inner-ring wall at (-4,-9) — listed only so the auto-seal can see the seal; wall will prune
    ],
  },

  // Plain courtyard connector at (-4,-8). The cell sits directly above
  // the inner ring's south-west corner wall — the strip runs through
  // here whether or not a building stands on it.
  "-4,-8": {
    terrain: "settlement",
    doors: [
      { x: -5, y: -8 }, // Forward Camp
      { x: -3, y: -8 }, // Sutlers' Row
    ],
  },

  // Sutlers' Row — a strip of small vendors set against the outer wall
  // selling to soldiers and travellers.
  "-3,-8": {
    terrain: "settlement",
    poi: {
      type: "market",
      service: "sutler",
      name: "Sutlers' Row",
      access: "public",
      area: AREA,
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "sutlers-row",
      partName: "Sutlers' Row",
      description:
        "A line of canvas-roofed stalls leaning against the inside of the outer wall, selling everything a marching man might buy without thinking: dried meat, salt, hard cheese, lamp-oil, candles by the dozen, thread, sewing-needles, copper buckles, sharpening-stones, and the kind of cheap brandy that travels well. The sutlers are licensed by the wall-sergeant and pay a tithe to keep the licence; their prices are fixed by a chalked board no one is allowed to wipe but the duty officer.",
    },
    doors: [
      { x: -4, y: -8 }, // connector west
      { x: -2, y: -8 }, // connector east
    ],
  },

  // Plain courtyard connector at (-2,-8).
  "-2,-8": {
    terrain: "settlement",
    doors: [
      { x: -3, y: -8 }, // Sutlers' Row
      { x: -1, y: -8 }, // connector east
    ],
  },

  // Plain courtyard connector at (-1,-8). Sits directly above the inner
  // ring's south wall at (-1,-9).
  "-1,-8": {
    terrain: "settlement",
    doors: [
      { x: -2, y: -8 }, // connector west
      { x: 0,  y: -8 }, // Outer Ward Yard
    ],
  },

  // Outer Ward Yard — the central courtyard immediately inside the new
  // outer gate. The keystone of the patch: caravans wait here while
  // papers are checked, and the inner gate at (0,-9) opens directly off
  // its north edge.
  "0,-8": {
    terrain: "settlement",
    poi: {
      type: "yard",
      name: "Outer Ward Yard",
      access: "public",
      area: AREA,
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "outer-ward-yard",
      partName: "Outer Ward Yard",
      description:
        "A wide flagged courtyard between the outer gate and the inner ring. Carts pull in here under the watchpost's eye, oxen are unhitched, drivers swear at the queue, and clerks walk the line with chalk-boards taking seals and tally-marks. Two cisterns sit against the north face — one for the city and one for the patrols — and a row of iron rings is set in the flags for tying horses. From this yard a traveller can see the outer gate behind him and the inner gate ahead of him, and the wall-sergeants on both can see each other.",
    },
    doors: [
      { x: 0,  y: -7 }, // Crown Watchpost (outer gate) south
      { x: 0,  y: -9 }, // Gate Watchpost (inner gate) north — already opens here
      { x: -1, y: -8 }, // connector west
      { x: 1,  y: -8 }, // connector east
    ],
  },

  // Plain courtyard connector at (1,-8). Sits directly above the inner
  // ring's south wall at (1,-9).
  "1,-8": {
    terrain: "settlement",
    doors: [
      { x: 0, y: -8 }, // Outer Ward Yard
      { x: 2, y: -8 }, // Apothecary's Tent
    ],
  },

  // Apothecary's Tent — public field-apothecary serving the road
  // patrols. Distinct from the inner-ring Hospice (which treats road
  // casualties); this tent treats the small stuff before the patrol
  // even gets through the inner gate.
  "2,-8": {
    terrain: "indoor",
    poi: {
      type: "bldg",
      service: "apothecary",
      name: "Apothecary's Tent",
      access: "public",
      area: AREA,
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "apothecary-tent",
      partName: "Apothecary's Tent",
      description:
        "A double-pole canvas pavilion pitched against the inside of the outer wall, lit by oil-lamps even in daytime. Bundled herbs hang from the ridge-pole; a long table at the back is set with glass and tin: tincture of poppy, willow, henbane, a small locked box of rarer things. The apothecary will sell small remedies to anyone with coin, and treat patrols on a tally-stick the wall-sergeant settles at the month's end. She does not ask why a traveller wants what they want.",
    },
    doors: [
      { x: 1, y: -8 }, // connector west
      { x: 3, y: -8 }, // connector east
    ],
  },

  // Plain courtyard connector at (3,-8).
  "3,-8": {
    terrain: "settlement",
    doors: [
      { x: 2, y: -8 }, // Apothecary's Tent
      { x: 4, y: -8 }, // connector east
    ],
  },

  // Plain courtyard connector at (4,-8). Sits directly above the inner
  // ring's south-east corner wall.
  "4,-8": {
    terrain: "settlement",
    doors: [
      { x: 3, y: -8 }, // connector west
      { x: 5, y: -8 }, // Cartwright Yard
    ],
  },

  // Cartwright Yard — public repair-yard for road-wagons. Wheels,
  // axles, harness-leather; everything a carter needs to keep a wagon
  // rolling on the Crown Road.
  "5,-8": {
    terrain: "indoor",
    poi: {
      type: "yard",
      service: "cartwright",
      name: "Cartwright Yard",
      access: "public",
      area: AREA,
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "cartwright-yard",
      partName: "Cartwright Yard",
      description:
        "An open-fronted timber shed with two pits sunk into the floor for working under wagons. Spare wheels lean against the back wall in a row sorted by gauge; coopered iron tyres hang from pegs above; the cartwright's bench is buried under chisels, gouges, draw-knives, and a long ash-pole he uses for prying axles straight. Wagons brought in here from the road are walked out within the day if the wheel is sound and within the week if it is not.",
    },
    doors: [
      { x: 4, y: -8 }, // connector west
      { x: 6, y: -8 }, // connector east
    ],
  },

  // Plain courtyard connector at (6,-8) — east end of the strip, opens
  // up the path to Tilt-Yard on the east side strip below.
  "6,-8": {
    terrain: "settlement",
    doors: [
      { x: 5, y: -8 }, // Cartwright Yard
      { x: 6, y: -9 }, // east side strip — connector down toward Tilt-Yard
    ],
  },

  // Cattle-Pens — west end of the south strip, holding pens for the
  // patrols' remounts and incoming livestock destined for city
  // markets. Sited at the south of the west side strip so the smell is
  // downwind of the rest of the works.
  "-6,-8": {
    terrain: "settlement",
    poi: {
      type: "yard",
      name: "Cattle-Pens",
      access: "public",
      area: AREA,
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "cattle-pens",
      partName: "Cattle-Pens",
      description:
        "A bank of railed pens against the south-west corner of the outer wall, ankle-deep in churned mud and straw. Patrols turn their remounts out here at the gate-bell; drovers walking cattle south from the upland market hold their herds here overnight before the city's stockyard clerks come out at dawn to count them. The smell is heavy and the noise is constant. A long water-trough fed by a wall-cistern runs the length of the back rail.",
    },
    doors: [
      { x: -5, y: -8 }, // Forward Camp
      { x: -6, y: -9 }, // west side strip connector north
    ],
  },

  // ===================== WEST SIDE STRIP (x = -6, y = -9..-18) =======

  // Plain side-strip connector at (-6,-9). Junction between Cattle-Pens
  // (south) and Bivouac Court (further north).
  "-6,-9": {
    terrain: "settlement",
    doors: [
      { x: -6, y: -8  }, // Cattle-Pens
      { x: -6, y: -10 }, // connector north
      { x: -5, y: -9  }, // procedural fill behind inner ring west wall
    ],
  },

  // Plain side-strip connector at (-6,-10).
  "-6,-10": {
    terrain: "settlement",
    doors: [
      { x: -6, y: -9  }, // connector south
      { x: -6, y: -11 }, // connector north
    ],
  },

  // Plain side-strip connector at (-6,-11).
  "-6,-11": {
    terrain: "settlement",
    doors: [
      { x: -6, y: -10 }, // connector south
      { x: -6, y: -12 }, // connector north
    ],
  },

  // Plain side-strip connector at (-6,-12).
  "-6,-12": {
    terrain: "settlement",
    doors: [
      { x: -6, y: -11 }, // connector south
      { x: -6, y: -13 }, // Bivouac Court
    ],
  },

  // Bivouac Court — public sleeping ground for road-companies bedding
  // down before riding out at first light.
  "-6,-13": {
    terrain: "settlement",
    poi: {
      type: "yard",
      name: "Bivouac Court",
      access: "public",
      area: AREA,
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "bivouac-court",
      partName: "Bivouac Court",
      description:
        "A flagged stretch of the west side strip kept clear for road-companies to bed down on the night before a ride. Bedrolls go straight onto the flags; the men get a hot meal from a wall-set hearth and a tin cup of thin wine, and they are up and saddled by the first bell. Nothing personal is left on the flags in daylight — anything that is gets swept into the lost-bin at the watchpost and not handed back without a name.",
    },
    doors: [
      { x: -6, y: -12 }, // connector south
      { x: -6, y: -14 }, // connector north
    ],
  },

  // Plain side-strip connector at (-6,-14).
  "-6,-14": {
    terrain: "settlement",
    doors: [
      { x: -6, y: -13 }, // Bivouac Court
      { x: -6, y: -15 }, // connector north
    ],
  },

  // Plain side-strip connector at (-6,-15).
  "-6,-15": {
    terrain: "settlement",
    doors: [
      { x: -6, y: -14 }, // connector south
      { x: -6, y: -16 }, // connector north
    ],
  },

  // Plain side-strip connector at (-6,-16). Sits next to the inner
  // ring's north-west corner wall at (-4,-16) (two hexes away — not
  // adjacent per HEX_DIRS).
  "-6,-16": {
    terrain: "settlement",
    doors: [
      { x: -6, y: -15 }, // connector south
      { x: -6, y: -17 }, // connector north — turns onto north annulus
    ],
  },

  // Plain side-strip connector at (-6,-17). Turn of the corner onto
  // the north annulus.
  "-6,-17": {
    terrain: "settlement",
    doors: [
      { x: -6, y: -16 }, // connector south
      { x: -6, y: -18 }, // connector north
      { x: -5, y: -17 }, // procedural fill toward north annulus
    ],
  },

  // Plain side-strip connector at (-6,-18) — south-west of north
  // annulus, links into Funeral Pyre Stand to the east.
  "-6,-18": {
    terrain: "settlement",
    doors: [
      { x: -6, y: -17 }, // connector south
      { x: -5, y: -18 }, // procedural fill east, toward Funeral Pyre Stand
    ],
  },

  // ===================== NORTH ANNULUS (y = -17, -18) =================

  // Funeral Pyre Stand — public site. The stone platform where the
  // road-dead are burned; ash sent down the prevailing wind.
  "-3,-18": {
    terrain: "settlement",
    poi: {
      type: "site",
      name: "Funeral Pyre Stand",
      access: "public",
      area: AREA,
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "funeral-pyre-stand",
      partName: "Funeral Pyre Stand",
      description:
        "A round stone platform raised three steps above the ground at the back of the works, with iron grates set in its top and a low wall around it to break the wind. Patrols that did not bring back their dead bring back a token instead — a belt-buckle, a hilt, a folded glove — and a fire is laid here and lit at sundown so the name can be spoken into the smoke. The ash is brushed off the platform every morning and scattered toward the north. The stone is permanently warm to the touch.",
    },
    doors: [
      { x: -2, y: -18 }, // procedural fill east
      { x: -3, y: -17 }, // procedural fill south
      { x: -4, y: -18 }, // procedural fill west
    ],
  },

  // Provost's Office — restricted. The road-court that judges minor
  // offences before they reach the city's Crown Gate magistrates.
  "3,-18": {
    terrain: "indoor",
    poi: {
      type: "court",
      name: "Provost's Office",
      access: "restricted",
      area: AREA,
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "provosts-office",
      partName: "Provost's Office",
      description:
        "A small slate-roofed hall pushed up against the north wall, with a low bench, a clerk's desk, a bound copy of the road-statutes chained to the bench, and a single barred holding-cell behind a half-door. The provost hears the small road-crimes here — drunken affray, mule-theft, contract-breach — and issues the small road-sentences. Anything heavier walks down to the city under guard. The work is paperwork; the room smells of ink, candle-wax, and the cold stone of the wall behind it.",
    },
    doors: [
      { x: 2, y: -18 }, // procedural fill west
      { x: 3, y: -17 }, // procedural fill south
      { x: 4, y: -18 }, // procedural fill east
    ],
  },

  // ===================== EAST SIDE STRIP (x = 6, y = -9..-18) ========

  // Plain side-strip connector at (6,-9). Junction between Cartwright
  // Yard (south, via (6,-8)) and Tilt-Yard (north).
  "6,-9": {
    terrain: "settlement",
    doors: [
      { x: 6, y: -8  }, // connector south — links to courtyard strip
      { x: 6, y: -10 }, // Tilt-Yard
      { x: 5, y: -9  }, // procedural fill behind inner ring east wall
    ],
  },

  // Tilt-Yard — conditional. Where the patrols drill with lances
  // against straw quintains and each other.
  "6,-10": {
    terrain: "settlement",
    poi: {
      type: "yard",
      name: "Tilt-Yard",
      access: "conditional",
      area: AREA,
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "tilt-yard",
      partName: "Tilt-Yard",
      description:
        "A long flagged strip on the east side of the works marked out with whitewash for the lance-drill of the heavy patrols. Two straw quintains on swivel-posts stand at the far end, both showing the hack-marks of yesterday's work; a rack of practice-lances leans against the inner wall. The drill-master here is hard but fair, and outsiders who can show a captain's chit may stand a turn at the quintain. Anyone else is told to find a fence to watch from.",
    },
    doors: [
      { x: 6, y: -9  }, // connector south
      { x: 6, y: -11 }, // connector north
    ],
  },

  // Plain side-strip connector at (6,-11).
  "6,-11": {
    terrain: "settlement",
    doors: [
      { x: 6, y: -10 }, // Tilt-Yard
      { x: 6, y: -12 }, // connector north
    ],
  },

  // Plain side-strip connector at (6,-12).
  "6,-12": {
    terrain: "settlement",
    doors: [
      { x: 6, y: -11 }, // connector south
      { x: 6, y: -13 }, // Officers' Mess
    ],
  },

  // Officers' Mess — restricted. The captains' table. The wall-
  // sergeants and patrol-captains eat here at the change of every
  // shift; nobody else gets past the door.
  "6,-13": {
    terrain: "indoor",
    poi: {
      type: "hall",
      name: "Officers' Mess",
      access: "restricted",
      area: AREA,
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "officers-mess",
      partName: "Officers' Mess",
      description:
        "A panelled hall set against the inside of the east wall, with a long oak table that seats twelve, a sideboard of pewter and one decanter of the brandy the captains pay for themselves. The steward keeps a brass bell on the sideboard for the change of shift and a chalked seating-plan that is sometimes consulted and sometimes ignored. Junior officers eat standing; sergeants eat in the kitchen; civilians are not invited and not refused — they simply are not allowed in.",
    },
    doors: [
      { x: 6, y: -12 }, // connector south
      { x: 6, y: -14 }, // connector north
    ],
  },

  // Plain side-strip connector at (6,-14).
  "6,-14": {
    terrain: "settlement",
    doors: [
      { x: 6, y: -13 }, // Officers' Mess
      { x: 6, y: -15 }, // connector north
    ],
  },

  // Plain side-strip connector at (6,-15).
  "6,-15": {
    terrain: "settlement",
    doors: [
      { x: 6, y: -14 }, // connector south
      { x: 6, y: -16 }, // connector north
    ],
  },

  // Plain side-strip connector at (6,-16).
  "6,-16": {
    terrain: "settlement",
    doors: [
      { x: 6, y: -15 }, // connector south
      { x: 6, y: -17 }, // connector north
    ],
  },

  // Plain side-strip connector at (6,-17). Turns onto the north
  // annulus.
  "6,-17": {
    terrain: "settlement",
    doors: [
      { x: 6, y: -16 }, // connector south
      { x: 6, y: -18 }, // connector north
      { x: 5, y: -17 }, // procedural fill toward north annulus
    ],
  },

  // Plain side-strip connector at (6,-18) — south-east of north
  // annulus, links into Provost's Office to the west.
  "6,-18": {
    terrain: "settlement",
    doors: [
      { x: 6, y: -17 }, // connector south
      { x: 5, y: -18 }, // procedural fill west, toward Provost's Office
    ],
  },
};

// -------------------------------------------------------------------------
// Final TILES = outer wall ring + interior.
// Total tile count:
//   51 walls + 1 outer gate + 11 named POIs + 21 connector hexes
//   = 84 tile keys.
// -------------------------------------------------------------------------
export const TILES = { ...outerWallRing, ...interior };

// -------------------------------------------------------------------------
// Sealed structure. The interior[] lists every walkable non-wall cell
// authored by this patch. The gates[] pair links the outer gate hex
// (0,-7) to the city-side hex (0,-6) Crown Road Approach so the
// structure's door-graph audit sees the welded join into Whitemarch
// proper.
//
// The inner-ring "The Outer Works" structure (in district-outer-works.js)
// is left as-is — its gates[] still pairs (0,-9) ↔ (0,-8). With this
// patch authoring (0,-8) as Outer Ward Yard, that pairing now lands on
// an authored walkable cell instead of procedural country, which is the
// correct end state.
// -------------------------------------------------------------------------
export const STRUCTURES = [
  {
    name: "The Outer Works — Outer Ring",
    interior: [
      // outer gate
      { x: 0,  y: -7 },
      // y=-8 courtyard band (west to east)
      { x: -6, y: -8 }, { x: -5, y: -8 }, { x: -4, y: -8 },
      { x: -3, y: -8 }, { x: -2, y: -8 }, { x: -1, y: -8 },
      { x: 0,  y: -8 }, { x: 1,  y: -8 }, { x: 2,  y: -8 },
      { x: 3,  y: -8 }, { x: 4,  y: -8 }, { x: 5,  y: -8 },
      { x: 6,  y: -8 },
      // west side strip (x=-6, south to north)
      { x: -6, y: -9  }, { x: -6, y: -10 }, { x: -6, y: -11 },
      { x: -6, y: -12 }, { x: -6, y: -13 }, { x: -6, y: -14 },
      { x: -6, y: -15 }, { x: -6, y: -16 }, { x: -6, y: -17 },
      { x: -6, y: -18 },
      // east side strip (x=6, south to north)
      { x: 6,  y: -9  }, { x: 6,  y: -10 }, { x: 6,  y: -11 },
      { x: 6,  y: -12 }, { x: 6,  y: -13 }, { x: 6,  y: -14 },
      { x: 6,  y: -15 }, { x: 6,  y: -16 }, { x: 6,  y: -17 },
      { x: 6,  y: -18 },
      // north annulus named POIs
      { x: -3, y: -18 }, { x: 3,  y: -18 },
    ],
    gates: [
      // Outer gate pair: outer-ring (0,-7) ↔ city-side Crown Road
      // Approach (0,-6).
      [{ x: 0, y: -7 }, { x: 0, y: -6 }],
    ],
  },
];

// -------------------------------------------------------------------------
// Services referenced by this patch.
//   wall-sergeant      — Crown Watchpost (reused from inner ring).
//   sutler             — Sutlers' Row (NEW; Wave 3 S1 BUILDINGS audit).
//   apothecary         — Apothecary's Tent (reused if present).
//   cartwright         — Cartwright Yard (NEW).
// Officers' Mess, Forward Camp, Cattle-Pens, Bivouac Court, Tilt-Yard,
// Funeral Pyre Stand, Provost's Office, Outer Ward Yard — no service.
// -------------------------------------------------------------------------
export const SERVICES = [
  "apothecary",
  "cartwright",
  "sutler",
  "wall-sergeant",
];
