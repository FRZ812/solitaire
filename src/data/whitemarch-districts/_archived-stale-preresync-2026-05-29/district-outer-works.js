// The Outer Works — a walled satellite enclosure NORTH of Whitemarch along
// the Crown Road. Per the city bible (WHITEMARCH_CITY.md, lines 31-35):
// road forts, ditch lines, cleared killing fields, watch posts, bridge
// forts, and patrol stables. Outside the main wall but inside the city's
// practical reach.
//
// Geometry: a fully enclosed 9-col × 8-row box (xmin:-4..xmax:4,
// ymin:-16..ymax:-9). The perimeter is authored as terrain:"wall" the
// whole way around, with a SINGLE gate at (0,-9) on the south face. The
// gate hex is the only opening — south face wall hexes at x=-4..-1 and
// x=1..4 plug the rest of that edge; the north, east, and west edges are
// solid wall. The gate's explicit doors include the procedural-country
// hex immediately outside the box at (0,-8) so that the Crown Road
// climbing up from the city map (the live row's Crown Road Approach sits
// at (0,-6)) finds an open mouth here. The procedural gap (0,-7)/(0,-8)
// between Crown Road Approach and this gate renders as plain road
// because non-wall hexes default-open across procedural neighbours.
//
// Internal layout from south (city-facing) to north (frontier-facing):
//   y=-9   wall ring + Gate Watchpost at (0,-9)
//   y=-10  Watch Post I, yard, Patrol Stable, Crown Road, Hospice,
//          yard, Watch Post II — the immediate inside-the-gate band.
//   y=-11  Wall-Watch Chapel, Road Fort (inner keep), Quartermaster's
//          Yard, plus drill-yard connectors east and west.
//   y=-12  Couriers' Post, Crown Road continuation, drill-yard.
//   y=-13  War-Mound (memorial) and the Killing Field (the cleared
//          ground facing north toward the frontier).
//   y=-14  Bridge Fort (the small forward keep on the road).
//   y=-15  empty interior — the cleared northern approach inside the
//          ring; the wall at y=-16 holds the line beyond it.
//
// All 12 named POIs share parent="whitemarch-outer-works" /
// parentName="The Outer Works" per the multi-hex footprint convention.
// The handful of unnamed connector hexes (drill-yard slots and Crown
// Road segments) are plain street/settlement terrain with no POI — they
// are the freshly-introduced movement spine the named buildings hang
// off, equivalent to the unnamed lane hexes the engine would otherwise
// procedurally generate.
//
// Wall hexes are authored with doors:undefined; runWallAutoSeal in
// src/data/handcrafted-pipeline.js computes their door lists from
// neighbours (case A: defined neighbours that are walls themselves, or
// whose doors already point AT the wall). Procedural neighbours OUTSIDE
// the box are never added to wall doors, which is precisely the seal we
// want — no passage through the ring except via the gate.

export const DISTRICT_ID = "outer-works";
export const DISTRICT_NAME = "The Outer Works";

export const BOUNDING_BOX = { xmin: -4, xmax: 4, ymin: -16, ymax: -9 };

const PARENT      = "whitemarch-outer-works";
const PARENT_NAME = "The Outer Works";

// -------------------------------------------------------------------------
// Wall ring. Doors are intentionally undefined; the pipeline's
// runWallAutoSeal computes them from neighbours every load.
// -------------------------------------------------------------------------
const WALL = { terrain: "wall" };

const wallRing = {
  // South face, y=-9. Gate occupies (0,-9), so x = -4,-3,-2,-1,1,2,3,4.
  "-4,-9": WALL, "-3,-9": WALL, "-2,-9": WALL, "-1,-9": WALL,
  "1,-9":  WALL, "2,-9":  WALL, "3,-9":  WALL, "4,-9":  WALL,
  // North face, y=-16. Full row, x = -4..4.
  "-4,-16": WALL, "-3,-16": WALL, "-2,-16": WALL, "-1,-16": WALL,
  "0,-16":  WALL,
  "1,-16":  WALL, "2,-16":  WALL, "3,-16":  WALL, "4,-16":  WALL,
  // West face, x=-4, y = -15..-10 (corners already covered above).
  "-4,-10": WALL, "-4,-11": WALL, "-4,-12": WALL,
  "-4,-13": WALL, "-4,-14": WALL, "-4,-15": WALL,
  // East face, x=4, y = -15..-10 (corners already covered above).
  "4,-10":  WALL, "4,-11":  WALL, "4,-12":  WALL,
  "4,-13":  WALL, "4,-14":  WALL, "4,-15":  WALL,
};
// Total walls: 8 (south) + 9 (north) + 6 (west) + 6 (east) = 29.

// -------------------------------------------------------------------------
// Interior tiles: 12 named POIs + 7 unnamed connector hexes (drill-yard
// and Crown Road spine). All POIs share PARENT / PARENT_NAME.
// -------------------------------------------------------------------------

const interior = {
  // ===================== GATE (south face) ============================
  "0,-9": {
    terrain: "settlement",
    poi: {
      type: "gate",
      service: "wall-sergeant",
      name: "Gate Watchpost",
      access: "guarded",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "gate-watchpost",
      partName: "Gate Watchpost",
      description:
        "The Crown Road crosses the southern wall of the Outer Works through a single iron-shod gate set into a low, thick-faced watchpost. The sergeant on duty keeps a chalked board of who has passed today and where they were said to be going; a pole-mounted bell hangs to one side for the alarm and a smaller hand-bell for traffic. Carts wait under the murder-holes while the post-clerk checks the seal and decides whether the wagon goes through whole or with an escort.",
    },
    // Inside-the-box neighbours plus the procedural Crown Road hex
    // immediately south of the box at (0,-8). Walls at (-1,-9) and
    // (1,-9) are deliberately not in this list.
    doors: [
      { x: 0,  y: -10 }, // interior — first cell inside, Crown Road spine
      { x: 0,  y: -8  }, // procedural country — Crown Road back to the city
    ],
  },

  // ===================== y = -10 BAND =================================
  // Watch Post I — south-west corner spire, restricted.
  "-3,-10": {
    terrain: "indoor",
    poi: {
      type: "spire",
      name: "Watch Post I",
      access: "restricted",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "watch-post-i",
      partName: "Watch Post I",
      description:
        "A squat round spire set inside the south-west corner of the wall ring. The ground floor is a cold magazine of bolt-bundles, oilcloth, and a cooper's repair bench; a ladder of bare timber climbs to the wall-walk above. The watch posted here gambles with knuckle-bones while one of them keeps an eye on the southern approach. Strangers are stopped at the doorway; the duty register is not for general reading.",
    },
    doors: [
      { x: -2, y: -10 }, // drill yard connector east
      { x: -3, y: -11 }, // wall approach connector north
    ],
  },

  // Drill-yard connector (unnamed) at (-2,-10).
  "-2,-10": {
    terrain: "settlement",
    doors: [
      { x: -3, y: -10 }, // Watch Post I
      { x: -1, y: -10 }, // Patrol Stable
      { x: -1, y: -11 }, // Wall-Watch Chapel
      { x: -2, y: -11 }, // drill-yard connector
    ],
  },

  // Patrol Stable — public stable for the road patrols.
  "-1,-10": {
    terrain: "settlement",
    poi: {
      type: "yard",
      service: "stable",
      name: "Patrol Stable",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "patrol-stable",
      partName: "Patrol Stable",
      description:
        "An open-fronted timber stable smelling of horse, hot iron, and damp straw. Saddle frames hang on pegs in a row; tack is numbered to the rider it belongs to. The patrols that ride the Crown Road north come in here at the gate-bell, unsaddle, and drop their dispatches on a wooden hook beside the door. A boy with a stiff brush is always working someone's mount and never looks up at strangers.",
    },
    doors: [
      { x: -2, y: -10 }, // drill yard connector
      { x: 0,  y: -10 }, // Crown Road spine
      { x: -1, y: -11 }, // Wall-Watch Chapel
    ],
  },

  // Crown Road spine — first cell inside the gate.
  "0,-10": {
    terrain: "street",
    doors: [
      { x: 0,  y: -9  }, // Gate Watchpost
      { x: -1, y: -10 }, // Patrol Stable
      { x: 1,  y: -10 }, // Hospice
      { x: 0,  y: -11 }, // Road Fort
      { x: 1,  y: -11 }, // Quartermaster's Yard
    ],
  },

  // Hospice for Road Casualties — public healer.
  "1,-10": {
    terrain: "indoor",
    poi: {
      type: "bldg",
      service: "healer",
      name: "Hospice for Road Casualties",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "hospice-for-road-casualties",
      partName: "Hospice for Road Casualties",
      description:
        "A low whitewashed hall divided into pallets by hung sheets. Most of the beds hold men brought down off the Crown Road with broken legs, knife cuts, fever, or the kind of long quiet wound a road takes years to make. The hospitaller keeps a ledger of names beside the door, with a second column for the ones she cannot save. The smell is lye, sage, hot wax, and old blood; the sound is somebody breathing slowly in the next room.",
    },
    doors: [
      { x: 0,  y: -10 }, // Crown Road spine
      { x: 2,  y: -10 }, // drill yard connector
      { x: 1,  y: -11 }, // Quartermaster's Yard
    ],
  },

  // Drill-yard connector (unnamed) at (2,-10).
  "2,-10": {
    terrain: "settlement",
    doors: [
      { x: 1,  y: -10 }, // Hospice
      { x: 3,  y: -10 }, // Watch Post II
      { x: 2,  y: -11 }, // drill-yard connector
      { x: 1,  y: -11 }, // Quartermaster's Yard
    ],
  },

  // Watch Post II — south-east corner spire, restricted.
  "3,-10": {
    terrain: "indoor",
    poi: {
      type: "spire",
      name: "Watch Post II",
      access: "restricted",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "watch-post-ii",
      partName: "Watch Post II",
      description:
        "The south-east corner spire, twin to Watch Post I but kept warmer — the duty crew here mans the signal-mirror that talks to the Great Wall at noon. The ground floor smells of pitch and rope. A speaking-trumpet on a bracket points down through a slit at the gate below; the sergeant calls challenges through it before raising the bar. Civilians get the door shut in their face.",
    },
    doors: [
      { x: 2,  y: -10 }, // drill yard connector
      { x: 3,  y: -11 }, // wall approach connector north
    ],
  },

  // ===================== y = -11 BAND =================================
  // Wall-Watch Chapel — public oath-priest.
  "-1,-11": {
    terrain: "indoor",
    poi: {
      type: "temple",
      service: "oath-priest",
      name: "Wall-Watch Chapel",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "wall-watch-chapel",
      partName: "Wall-Watch Chapel",
      description:
        "A narrow stone chapel built into the inner skin of the wall, with two oath-stones, a saint of soldiers' deaths, and a board nailed with the names of the patrols that did not come back. The oath-priest hears watch-oaths at the change of every shift; he will also hear a private oath from a stranger, for a fee that the chapel will not write down. The wax is cheap, the silence is deep, and the air smells of cold candle-tallow and clean wool.",
    },
    doors: [
      { x: -2, y: -10 }, // drill yard connector
      { x: -1, y: -10 }, // Patrol Stable
      { x: 0,  y: -11 }, // Road Fort
      { x: -2, y: -11 }, // drill-yard connector west
      { x: -1, y: -12 }, // Couriers' Post
    ],
  },

  // Drill-yard / wall approach connector (unnamed) at (-2,-11).
  "-2,-11": {
    terrain: "settlement",
    doors: [
      { x: -2, y: -10 }, // drill yard connector south
      { x: -1, y: -11 }, // Wall-Watch Chapel
      { x: -3, y: -11 }, // wall approach connector west
      { x: -1, y: -12 }, // Couriers' Post
      { x: -2, y: -12 }, // open ground (no tile authored — falls through)
    ],
  },

  // Wall approach connector (unnamed) at (-3,-11) — backs Watch Post I.
  "-3,-11": {
    terrain: "settlement",
    doors: [
      { x: -3, y: -10 }, // Watch Post I
      { x: -2, y: -11 }, // drill-yard connector
    ],
  },

  // Road Fort — the inner keep, restricted heart of the Outer Works.
  "0,-11": {
    terrain: "indoor",
    poi: {
      type: "hall",
      name: "Road Fort",
      access: "restricted",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "road-fort",
      partName: "Road Fort",
      description:
        "The inner keep of the Outer Works: a thick-walled stone hall with a planning room, a strong-floor for road-gold in transit, and a captain's quarter that doubles as the magistrate's bench when sentence is passed on a road crime. The big oak table is scored with the names of every patrol-captain who ever held this command. The doors to the lower rooms are barred from the inside; the muster-roll on the wall is kept current to the hour.",
    },
    doors: [
      { x: 0,  y: -10 }, // Crown Road spine
      { x: -1, y: -11 }, // Wall-Watch Chapel
      { x: 1,  y: -11 }, // Quartermaster's Yard
      { x: 0,  y: -12 }, // Crown Road spine north
      { x: 1,  y: -12 }, // drill-yard connector
    ],
  },

  // Quartermaster's Yard — conditional, behind the Road Fort.
  "1,-11": {
    terrain: "indoor",
    poi: {
      type: "yard",
      name: "Quartermaster's Yard",
      access: "conditional",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "quartermasters-yard",
      partName: "Quartermaster's Yard",
      description:
        "A flagged court ringed on three sides by lockable stores: bolts in lead-lined chests, dried rations in waxed cloth, spare road-tack, lamp-oil in numbered jars, and one barred room whose ledger the quartermaster will not show. Anyone with a counter-sealed chit from a patrol-captain may draw stores; anyone without is turned out at the wicket. The quartermaster counts everything twice and writes nothing down twice.",
    },
    doors: [
      { x: 0,  y: -11 }, // Road Fort
      { x: 1,  y: -10 }, // Hospice
      { x: 2,  y: -10 }, // drill yard connector
      { x: 2,  y: -11 }, // drill-yard connector east
      { x: 0,  y: -12 }, // Crown Road spine
      { x: 1,  y: -12 }, // drill-yard connector
    ],
  },

  // Drill-yard / wall approach connector (unnamed) at (2,-11).
  "2,-11": {
    terrain: "settlement",
    doors: [
      { x: 2,  y: -10 }, // drill yard connector south
      { x: 1,  y: -11 }, // Quartermaster's Yard
      { x: 3,  y: -11 }, // wall approach connector east
      { x: 1,  y: -12 }, // drill-yard connector
    ],
  },

  // Wall approach connector (unnamed) at (3,-11) — backs Watch Post II.
  "3,-11": {
    terrain: "settlement",
    doors: [
      { x: 3,  y: -10 }, // Watch Post II
      { x: 2,  y: -11 }, // drill-yard connector
    ],
  },

  // ===================== y = -12 BAND =================================
  // Couriers' Post — conditional, the message hub.
  "-1,-12": {
    terrain: "indoor",
    poi: {
      type: "bldg",
      service: "courier",
      name: "Couriers' Post",
      access: "conditional",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "couriers-post",
      partName: "Couriers' Post",
      description:
        "A small slate-roofed room hard against the inner wall, with a sorted wall of cubby-holes for sealed dispatches and a bench where road-couriers sleep in their boots between runs. The dispatcher will take a letter for any waypoint between here and the next bridge fort — for a fee, with a counter-seal, and only if the destination is on her route-list. She does not take letters that have no name on them.",
    },
    doors: [
      { x: -1, y: -11 }, // Wall-Watch Chapel
      { x: -2, y: -11 }, // drill-yard connector
      { x: 0,  y: -12 }, // Crown Road spine
      { x: -1, y: -13 }, // open killing field edge (no tile authored)
      { x: 0,  y: -13 }, // Killing Field
    ],
  },

  // Crown Road spine continuation.
  "0,-12": {
    terrain: "street",
    doors: [
      { x: 0,  y: -11 }, // Road Fort
      { x: -1, y: -12 }, // Couriers' Post
      { x: 1,  y: -12 }, // drill-yard connector
      { x: 0,  y: -13 }, // Killing Field
      { x: 1,  y: -13 }, // open ground (no tile authored)
    ],
  },

  // Drill-yard connector (unnamed) at (1,-12).
  "1,-12": {
    terrain: "settlement",
    doors: [
      { x: 1,  y: -11 }, // Quartermaster's Yard
      { x: 2,  y: -11 }, // drill-yard connector
      { x: 0,  y: -12 }, // Crown Road spine
      { x: 0,  y: -13 }, // Killing Field
    ],
  },

  // ===================== y = -13 BAND =================================
  // War-Mound — public memorial site.
  "-2,-13": {
    terrain: "settlement",
    poi: {
      type: "site",
      name: "War-Mound",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "war-mound",
      partName: "War-Mound",
      description:
        "A grassed earthwork ten paces across with a worn stone at its crown, raised over the patrol dead of a campaign no one in the current garrison was alive for. The stone has a name-list cut so shallow that some of the names are now only weather; offerings sit on the lip — a brass button, three copper bits, a folded paper held by a pebble. The wind across this stretch of yard is always a little colder than it should be.",
    },
    doors: [
      { x: -1, y: -13 }, // open ground edge (no tile authored — falls through)
      { x: -2, y: -12 }, // open ground (no tile authored)
      { x: -1, y: -12 }, // Couriers' Post
    ],
  },

  // Killing Field — the cleared ground facing north toward the frontier.
  "0,-13": {
    terrain: "settlement",
    poi: {
      type: "site",
      name: "Killing Field",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "killing-field",
      partName: "Killing Field",
      description:
        "A wide stretch of cleared ground inside the north half of the ring, dug down and re-laid as packed earth, with the Crown Road running through its middle. The slope rises toward the Bridge Fort and falls away toward the inner gate; everything that grows here is cut short by the patrol-boys with sickles every week. From the centre you can see the whole of the north wall, and from the north wall you can see anything that walks into this field. That is the point of it.",
    },
    doors: [
      { x: 0,  y: -12 }, // Crown Road spine
      { x: 0,  y: -14 }, // Bridge Fort
      { x: -1, y: -12 }, // Couriers' Post
      { x: 1,  y: -12 }, // drill-yard connector
      { x: 1,  y: -13 }, // open ground (no tile authored)
      { x: -1, y: -13 }, // open ground (no tile authored)
    ],
  },

  // ===================== y = -14 BAND =================================
  // Bridge Fort — the small forward keep on the road, restricted.
  "0,-14": {
    terrain: "indoor",
    poi: {
      type: "hall",
      name: "Bridge Fort",
      access: "restricted",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "bridge-fort",
      partName: "Bridge Fort",
      description:
        "A small square-built keep set squarely across the Crown Road inside the north half of the ring, named for the ditch-bridge it stood over before the wall was extended around it. The lower room is a strong-room with iron rings set in the floor; the upper room is a captain's watch-bench facing the north wall. The duty officer here is junior to the captain in the Road Fort and senior to nobody else; the chair has eaten promising men.",
    },
    doors: [
      { x: 0,  y: -13 }, // Killing Field
      { x: -1, y: -14 }, // open ground (no tile authored)
      { x: 1,  y: -14 }, // open ground (no tile authored)
    ],
  },
};

// -------------------------------------------------------------------------
// Final TILES = wall ring + interior.
// -------------------------------------------------------------------------
export const TILES = { ...wallRing, ...interior };

// -------------------------------------------------------------------------
// Sealed structure. interior[] lists every walkable non-wall cell that
// belongs to The Outer Works (the 12 named POIs + the 7 connector hexes
// + the gate). The gates[] pair links the gate hex to the procedural
// Crown Road hex immediately outside the box at (0,-8).
// -------------------------------------------------------------------------
export const STRUCTURES = [
  {
    name: "The Outer Works",
    interior: [
      // gate
      { x: 0,  y: -9  },
      // y=-10 band
      { x: -3, y: -10 }, { x: -2, y: -10 }, { x: -1, y: -10 },
      { x: 0,  y: -10 }, { x: 1,  y: -10 }, { x: 2,  y: -10 },
      { x: 3,  y: -10 },
      // y=-11 band
      { x: -3, y: -11 }, { x: -2, y: -11 }, { x: -1, y: -11 },
      { x: 0,  y: -11 }, { x: 1,  y: -11 }, { x: 2,  y: -11 },
      { x: 3,  y: -11 },
      // y=-12 band
      { x: -1, y: -12 }, { x: 0,  y: -12 }, { x: 1,  y: -12 },
      // y=-13 band
      { x: -2, y: -13 }, { x: 0,  y: -13 },
      // y=-14 band
      { x: 0,  y: -14 },
    ],
    gates: [
      [{ x: 0, y: -9 }, { x: 0, y: -8 }],
    ],
  },
];

// -------------------------------------------------------------------------
// Services referenced by this district. wall-sergeant (gate), stable
// (Patrol Stable), healer (Hospice), oath-priest (Wall-Watch Chapel),
// and courier (Couriers' Post — Wave 3 S1 to add to BUILDINGS).
// -------------------------------------------------------------------------
export const SERVICES = [
  "courier",
  "healer",
  "oath-priest",
  "stable",
  "wall-sergeant",
];
