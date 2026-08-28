// The Caravanserai — Outer Ring Patch (patch1).
//
// The first-pass single-ring inn-yard at (-15..-9, -3..3) sits too small and
// floats disconnected from Whitemarch's west wall. This patch WRAPS the
// existing inn-yard with an OUTER CARAVAN WALL, so the satellite reads as
// what a real caravanserai becomes when it grows: an inner fortified inn-
// yard plus a sprawling outer ring of foreign markets, livestock pens,
// banking houses, hedge-temples, and the bone-yard for drovers who die on
// the road. The bible files this on the WHITEMARCH_CITY.md "Caravan Yards"
// page (lines 136-176) for the working-yard texture, and on the "Foreign
// Quarter" page (lines 493-533) for the multi-culture tone bleeding outside
// the city wall.
//
// Geometry:
//   Expanded bounding box: xmin: -19, xmax: -7, ymin: -6, ymax: 6.
//   The inner ring at (-15..-9, -3..3) is PRESERVED — every tile of the
//   first pass stays, including the inner East Gate at (-9,0).
//   This module fills the ANNULUS around the inner ring with the new
//   outer wall ring and the outer-ring POIs.
//
// Outer wall ring (all `terrain: "wall"` with `doors: undefined` for
// pipeline auto-seal):
//   North edge y=-6, x in -19..-7 — 13 walls (NW + NE corners as spires).
//   South edge y=6,  x in -19..-7 — 13 walls (SW + SE corners as spires).
//   West edge  x=-19, y in -5..5  — 11 walls.
//   East edge  x=-7,  y in -6..6 except y=0 — 12 walls. The y=0 hex is
//                                              the OUTER GATE (Caravan
//                                              Sallygate).
//
// Outer Gate at (-7,0). Sits one hex west of Whitemarch's own west wall
// (Whitemarch's wall is at x=-6 — verified from the live row). Doors
// point through the city wall at (-6,0) AND west into the outer-ring
// approach at (-8,0). So a Whitemarch citizen walking west from inside
// the city wall steps onto the city-wall hex, then through the sallygate,
// then into the outer-ring's East Road Court — physically continuous.
//
// Outer-ring POIs (12, all parent="whitemarch-caravanserai"):
//   (-7, 0) Caravan Sallygate          — gate (caravanserai-warden) [the gate]
//   (-8, 0) East Road Court            — settlement plaza, public
//   (-8,-1) Beast-Trader's Pens        — settlement market, conditional (stable)
//   (-8, 1) Foreign Merchants' Row     — settlement market, public (foreign-trader)
//   (-8, 2) Carter's Yard              — settlement yard, public (cartwright)
//   (-18,0) Foreign Tongues Inn        — indoor, public (tavern)
//   (-18,1) Foreigner's Bank           — indoor, conditional (money-changer)
//   (-18,-1) Coopers' Row              — indoor, public (cooper)
//   (-17,0) Hedge-Temple of the Road   — indoor, public (multi-faith, no service)
//   (-18,-2) Lazaret                   — indoor, conditional (healer)
//   (-18,2) Slave-Pen Annex            — settlement, restricted (slavemarket)
//   (-13,-5) Drover's Graveyard        — site, public (no service)
//
// Authoring rules followed:
//   - Wall tiles: doors:undefined (auto-seal computes).
//   - Walkable (settlement/indoor/site): explicit doors list.
//   - No tile in (-15..-9, -3..3) is touched — the inner ring is preserved
//     intact and its existing sealed_structure is unchanged.
//   - The new sealed_structure "The Caravanserai — Outer Ring" lists every
//     new walkable coord and declares one gate-bridge across the outer
//     wall: the Sallygate at (-7,0) opening through (-6,0) (Whitemarch's
//     own west-wall hex).

export const DISTRICT_ID   = "caravanserai-patch1";
export const DISTRICT_NAME = "The Caravanserai (Outer Ring Patch)";

export const BOUNDING_BOX = { xmin: -19, xmax: -7, ymin: -6, ymax: 6 };

const PARENT      = "whitemarch-caravanserai";
const PARENT_NAME = "The Caravanserai";

// ----------------------------------------------------------------------------
// Wall helpers — mud-brick curtain + stone watchposts at the four corners,
// matching the inner ring's idiom (caravan-money, not Treasury money).
// ----------------------------------------------------------------------------
const OUTER_CURTAIN_DESC =
  "The outer caravan wall — taller than the inner curtain but still mud-brick on a stone footing, raised in a hurry as the camp outgrew its first ring. The parapet walk is wide enough for a man with a bow and a horn; on busy nights the warden's men pace it the whole way around, calling watch-times between the corner spires. The mud-brick is patched in three colours where storms or drunkards have knocked it open.";

const OUTER_WATCHPOST_DESC =
  "A squat stone watchpost at the corner of the outer caravan wall — paid for after a worse season of horse-thieves than the one that bought the inner spires. A single brazier burns at the top, watched in shifts by the warden's men, with a horn on a thong, a tally-stick for the wagons coming up the road, and a bell for fire and raid.";

function wall(part, partName, description) {
  return {
    terrain: "wall",
    poi: {
      type: part === "spire" ? "spire" : "site",
      name: PARENT_NAME + " Outer Wall",
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

const curtainN = () => wall("outer-curtain", "Outer North Curtain", OUTER_CURTAIN_DESC);
const curtainS = () => wall("outer-curtain", "Outer South Curtain", OUTER_CURTAIN_DESC);
const curtainW = () => wall("outer-curtain", "Outer West Curtain", OUTER_CURTAIN_DESC);
const curtainE = () => wall("outer-curtain", "Outer East Curtain", OUTER_CURTAIN_DESC);

export const TILES = {
  // ==========================================================================
  // OUTER WALL RING
  // ==========================================================================

  // North edge y=-6, x in -19..-7 (13 walls). NW and NE corners are spires.
  "-19,-6": wall("outer-watchpost", "Outer Northwest Watchpost", OUTER_WATCHPOST_DESC),
  "-18,-6": curtainN(),
  "-17,-6": curtainN(),
  "-16,-6": curtainN(),
  "-15,-6": curtainN(),
  "-14,-6": curtainN(),
  "-13,-6": curtainN(),
  "-12,-6": curtainN(),
  "-11,-6": curtainN(),
  "-10,-6": curtainN(),
  "-9,-6":  curtainN(),
  "-8,-6":  curtainN(),
  "-7,-6":  wall("outer-watchpost", "Outer Northeast Watchpost", OUTER_WATCHPOST_DESC),

  // South edge y=6, x in -19..-7 (13 walls). SW and SE corners are spires.
  "-19,6": wall("outer-watchpost", "Outer Southwest Watchpost", OUTER_WATCHPOST_DESC),
  "-18,6": curtainS(),
  "-17,6": curtainS(),
  "-16,6": curtainS(),
  "-15,6": curtainS(),
  "-14,6": curtainS(),
  "-13,6": curtainS(),
  "-12,6": curtainS(),
  "-11,6": curtainS(),
  "-10,6": curtainS(),
  "-9,6":  curtainS(),
  "-8,6":  curtainS(),
  "-7,6":  wall("outer-watchpost", "Outer Southeast Watchpost", OUTER_WATCHPOST_DESC),

  // West edge x=-19, y in -5..5 (11 walls).
  "-19,-5": curtainW(),
  "-19,-4": curtainW(),
  "-19,-3": curtainW(),
  "-19,-2": curtainW(),
  "-19,-1": curtainW(),
  "-19,0":  curtainW(),
  "-19,1":  curtainW(),
  "-19,2":  curtainW(),
  "-19,3":  curtainW(),
  "-19,4":  curtainW(),
  "-19,5":  curtainW(),

  // East edge x=-7, y in -6..6 EXCEPT y=0 which is the Caravan Sallygate.
  // (Corners at y=-6 and y=6 already declared above.)
  "-7,-5": curtainE(),
  "-7,-4": curtainE(),
  "-7,-3": curtainE(),
  "-7,-2": curtainE(),
  "-7,-1": curtainE(),
  "-7,1":  curtainE(),
  "-7,2":  curtainE(),
  "-7,3":  curtainE(),
  "-7,4":  curtainE(),
  "-7,5":  curtainE(),

  // ==========================================================================
  // CARAVAN SALLYGATE (-7,0) — the outer ring's only proper gate. Sits
  // one hex west of Whitemarch's own west wall at (-6,0). Doors:
  //   (-6,0) — Whitemarch's west-wall hex; the city-wall opening through
  //            which a citizen of Whitemarch steps into the caravanserai
  //            ring without ever crossing the open road.
  //   (-8,0) — East Road Court inside the outer ring.
  // The sallygate is the customs-and-toll mouth that the warden's outer
  // staff hold; the inner East Gate at (-9,0) is the second checkpoint
  // before the inner yard proper.
  // ==========================================================================
  "-7,0": {
    terrain: "settlement",
    poi: {
      type: "gate",
      service: "caravanserai-warden",
      name: "Caravan Sallygate",
      access: "public",
      area: "caravanserai-outer-ring",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "caravan-sallygate",
      partName: "Caravan Sallygate",
      description:
        "The outer ring's only proper opening — a stone arch under a tile-roofed gatehouse jammed up so close against Whitemarch's white curtain that a tall man can touch both walls at once with arms outstretched. Two warden's men in caravan-livery sit on a bench under the arch, with a tally-stick, a strongbox, and a slate of the day's tolls. The view east is a single pace of trodden clay and then the looming pale wall of the city itself; the view west is the East Road Court of the outer ring, with the noise of foreign markets and beast-pens rolling up to meet you. Whitemarch's Watch and the caravanserai's warden share the gate by treaty — neither will cross the threshold uninvited.",
    },
    doors: [
      { x: -6, y: 0 },  // Whitemarch's west-wall hex (the physical join).
      { x: -8, y: 0 },  // East Road Court inside the outer ring.
    ],
  },

  // ==========================================================================
  // EAST ANNULUS POIs — the band of outer-ring buildings between the
  // sallygate and the inner ring. The East Road Court at (-8,0) is the
  // anchor plaza; the rest chain north and south along x=-8.
  // ==========================================================================

  // ---------- East Road Court (-8,0) ----------------------------------------
  // The road-side plaza outside the inner gate where wagons stage before
  // entering the inner yard. Bridges the sallygate east to the inner East
  // Gate west.
  "-8,0": {
    terrain: "settlement",
    poi: {
      type: "plaza",
      name: "East Road Court",
      access: "public",
      area: "caravanserai-outer-ring",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "east-road-court",
      partName: "East Road Court",
      description:
        "A long oval of trampled clay between the Caravan Sallygate and the inner ring's East Gate. Wagons coming off the western road stage here while the warden's clerks process them; ox-teams stand head-down in the harness; foreign drovers wait their turn on a low bench shaded by a tile awning. The Sallygate stands open to the east, the inner gate stands open to the west, and the whole length of the court is the warden's neutral ground between the two — no fights, no draw weapons, no haggling outside the booths. The smell is dust, dung, hot axle grease, and the cooking-fires of three different countries.",
    },
    doors: [
      { x: -7, y: 0 },  // Caravan Sallygate (east).
      { x: -9, y: 0 },  // inner East Gate (west).
      { x: -8, y: -1 }, // Beast-Trader's Pens (NE).
      { x: -8, y: 1 },  // Foreign Merchants' Row (SE).
    ],
  },

  // ---------- Beast-Trader's Pens (-8,-1) -----------------------------------
  // Livestock and mount sales — direct from drovers off the road, before
  // the inner yard charges its stall fees. Reuses `stable` service so the
  // shop wiring is shared with Whitemarch's Caravan Yard & Stable.
  "-8,-1": {
    terrain: "settlement",
    poi: {
      type: "market",
      name: "Beast-Trader's Pens",
      service: "stable",
      access: "conditional",
      area: "caravanserai-outer-ring",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "beast-traders-pens",
      partName: "Beast-Trader's Pens",
      description:
        "A run of timber-rail pens along the north annulus — ox, mule, camel, and the occasional horse, each pen marked with a chalk-slate showing origin, age, and asking price. Drovers selling off a tired team trade direct with buyers here, paying the warden a cut on each head. The smell is overpowering; the noise is worse. Conditional ground — the warden's beast-clerk checks brand and bill of sale before any animal changes hands, and a buyer without a chit from him walks away empty-handed.",
    },
    doors: [
      { x: -8, y: 0 },  // East Road Court.
    ],
  },

  // ---------- Foreign Merchants' Row (-8,1) ---------------------------------
  // Stalls run by drovers selling exotic stock direct off their wagons.
  // New service id `foreign-trader` — the bible's "Foreign Counting House"
  // / "Spice House" face of the outer ring.
  "-8,1": {
    terrain: "settlement",
    poi: {
      type: "market",
      name: "Foreign Merchants' Row",
      service: "foreign-trader",
      access: "public",
      area: "caravanserai-outer-ring",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "foreign-merchants-row",
      partName: "Foreign Merchants' Row",
      description:
        "A double row of awning-stalls along the south annulus, each one rented by a drover who has unhitched his wagon for a few days and is selling what he hauled. Spice in twists of waxed paper, southern cloth, eastern brass-work, dried fruit by the string, knives in three patterns no smith in the city would forge. The traders speak six languages between them and the prices change every hour, in any of three currencies. The warden's clerk walks the row at noon to collect his stall-fee in coin or in kind.",
    },
    doors: [
      { x: -8, y: 0 },  // East Road Court.
      { x: -8, y: 2 },  // Carter's Yard.
    ],
  },

  // ---------- Carter's Yard (-8,2) ------------------------------------------
  // Where carts are inspected and repaired before going east into the city
  // or west onto the road. New service id `cartwright`.
  "-8,2": {
    terrain: "settlement",
    poi: {
      type: "yard",
      name: "Carter's Yard",
      service: "cartwright",
      access: "public",
      area: "caravanserai-outer-ring",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "carters-yard",
      partName: "Carter's Yard",
      description:
        "An open yard of sawdust and shaved oak, with a long pent-roof at the back over the cartwright's bench. Wagons come up off the road with cracked axles, sprung wheels, or strakes worn through; the cartwright walks each one with a chalk-stick before he names a price. The inner yard's smithy handles iron-work; this yard handles timber, leather, and the cartwright's harness-craft. Drovers wait on a worn bench by the gate, comparing roads and tolls.",
    },
    doors: [
      { x: -8, y: 1 },  // Foreign Merchants' Row.
    ],
  },

  // ==========================================================================
  // WEST ANNULUS POIs — the far rim of the outer ring, set against the
  // west outer wall. A cluster of indoor establishments: the upmarket inn,
  // the bank, the coopers, the hedge-temple, the lazaret, and the
  // restricted slave-pen.
  // ==========================================================================

  // ---------- Foreign Tongues Inn (-18,0) -----------------------------------
  // Upscale lodging for masters and merchants — a step above the inner
  // bunkhouses. Reuses `tavern` service (same id as the inner Caravanserai
  // Tavern and the city's Iron Tankard).
  "-18,0": {
    terrain: "indoor",
    poi: {
      type: "bldg",
      name: "Foreign Tongues Inn",
      service: "tavern",
      access: "public",
      area: "caravanserai-outer-ring",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "foreign-tongues-inn",
      partName: "Foreign Tongues Inn",
      description:
        "A two-storey inn of mortared stone against the west outer wall — the upmarket bed of the outer ring, for caravan-masters and the merchants whose money rides the wagons. The common-room downstairs serves stew in three styles and wine in five; the rooms upstairs are private, with a key and a bolt, which is more privacy than any other bed inside this ring. The keeper speaks four tongues and a half, and keeps a slate of road-rumours by the door more current than the inner tavern's because masters come here straight off the road.",
    },
    doors: [
      { x: -18, y: -1 }, // Coopers' Row.
      { x: -18, y: 1 },  // Foreigner's Bank.
      { x: -17, y: 0 },  // Hedge-Temple of the Road.
    ],
  },

  // ---------- Foreigner's Bank (-18,1) --------------------------------------
  // Where merchants store coin between caravan legs — strongroom, ledger,
  // bonded chests. Reuses `money-changer` service (same as the inner
  // Money-Changer's Counter).
  "-18,1": {
    terrain: "indoor",
    poi: {
      type: "bldg",
      name: "Foreigner's Bank",
      service: "money-changer",
      access: "conditional",
      area: "caravanserai-outer-ring",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "foreigners-bank",
      partName: "Foreigner's Bank",
      description:
        "A narrow stone shop with a brass-grilled counter and a strongroom dug back into the outer wall itself. Merchants here do not change coin — they STORE it, in numbered chests under the bank's seal, paid for by the season. The clerk reads ledgers in two scripts and keeps a wax-pot for crimping his sigil onto every receipt. Conditional ground: no man enters without a letter of introduction, a chit from the warden, or coin enough to buy one on the spot.",
    },
    doors: [
      { x: -18, y: 0 },  // Foreign Tongues Inn.
      { x: -18, y: 2 },  // Slave-Pen Annex.
    ],
  },

  // ---------- Coopers' Row (-18,-1) -----------------------------------------
  // Barrel-making and repair — wagon-loads of wine, salt-pork, oil all
  // need fresh casks before the next leg. New service id `cooper`.
  "-18,-1": {
    terrain: "indoor",
    poi: {
      type: "bldg",
      name: "Coopers' Row",
      service: "cooper",
      access: "public",
      area: "caravanserai-outer-ring",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "coopers-row",
      partName: "Coopers' Row",
      description:
        "A long shed of stave-wood, with three coopers working three benches and a stack of seasoned oak running the length of the back wall. New casks for caravans setting out, repairs for casks coming in, char-fired barrels for wine and oil, hooped tubs for grain and salt-pork. The yard outside smells of green oak and old wine-lees; the coopers themselves are thick-armed, taciturn, and paid by the barrel.",
    },
    doors: [
      { x: -18, y: 0 },  // Foreign Tongues Inn.
      { x: -18, y: -2 }, // Lazaret.
    ],
  },

  // ---------- Hedge-Temple of the Road (-17,0) ------------------------------
  // An open-faith shrine for travelers — separate from the inner Mosque /
  // Hospice (which is multi-faith but inner-yard only). This one is the
  // public shrine at the edge of the road, where any drover of any creed
  // can stop and pay respects without entering the inner gate at all.
  "-17,0": {
    terrain: "indoor",
    poi: {
      type: "temple",
      name: "Hedge-Temple of the Road",
      access: "public",
      area: "caravanserai-outer-ring",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "hedge-temple-of-the-road",
      partName: "Hedge-Temple of the Road",
      description:
        "A small open-fronted shrine against the west annulus, with three niches in a row, each one belonging to whichever traveler last cleaned it: a road-god of the east in the north niche, a sailor's saint in the middle, a horse-mother carved by a southern drover's knife in the south. Coin is left on a stone in the middle of the floor and gathered up at dusk by no specific keeper — every drover here keeps it tidy by turn. No priest, no liturgy, no question of creed. The warden's men will not enter, the city's Temple-Steps will not acknowledge, and the drovers themselves prefer it that way.",
    },
    doors: [
      { x: -18, y: 0 },  // Foreign Tongues Inn.
    ],
  },

  // ---------- Lazaret (-18,-2) ----------------------------------------------
  // The quarantine shed for sick drovers and suspect cargo. Reuses
  // `healer` service. Conditional access — the warden's leech decides who
  // enters and who leaves, and a man marked with the lazaret-chalk does
  // not see the inner ring until the leech says so.
  "-18,-2": {
    terrain: "indoor",
    poi: {
      type: "bldg",
      name: "Lazaret",
      service: "healer",
      access: "conditional",
      area: "caravanserai-outer-ring",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "lazaret",
      partName: "Lazaret",
      description:
        "A long low shed against the northwest wall, kept apart from every other building by the warden's order: the quarantine room for sick drovers and suspect cargo off the road. A leech walks the cots once a day with a wax-pencil and a tally-stick; a brazier of bitter herbs burns at the door against the smell. The shed has its own well-rope and its own latrine pit so its waters never cross with the rest of the camp. The cargo-side stores bonded crates the customs men have flagged as suspect — disease, foreign pest, or honest spoilage — until the warden's clerk rules.",
    },
    doors: [
      { x: -18, y: -1 }, // Coopers' Row.
    ],
  },

  // ---------- Slave-Pen Annex (-18,2) ---------------------------------------
  // Holding pens for slaves moved by caravan toward the city's Chain
  // Market. Restricted access — the warden's slave-clerk holds the keys,
  // and the only outsiders who enter are buyers with writ from the Chain
  // Market or from the city's customs men.
  "-18,2": {
    terrain: "settlement",
    poi: {
      type: "slavemarket",
      name: "Slave-Pen Annex",
      service: "slavemarket",
      access: "restricted",
      area: "caravanserai-outer-ring",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "slave-pen-annex",
      partName: "Slave-Pen Annex",
      description:
        "A walled enclosure against the southwest outer wall — high timber palings inside the stone curtain, with a roofed barracks at the back, a feeding-trough along one side, and a heavy door under the warden's seal. The caravans bringing slaves from the south road hold them here for transfer to the city's Chain Market; the slave-clerk keeps the tallies, the keys, and the brand-iron. Restricted ground — no drover, no merchant, no buyer enters without the warden's writ. The Watch will not interfere, but the warden will, and the slave-clerk has a horn that brings men quickly.",
    },
    doors: [
      { x: -18, y: 1 },  // Foreigner's Bank.
    ],
  },

  // ==========================================================================
  // MIDDLE ANNULUS POI — a single lone marker out in the open camp
  // ground between the east and west clusters. The rest of the annulus
  // is unauthored procedural country, which renders as open camp ground
  // (trampled clay, scattered cookfires) — the kind of vast inner court
  // a real caravanserai keeps for the overflow of wagons that the inner
  // yard cannot hold.
  // ==========================================================================

  // ---------- Drover's Graveyard (-13,-5) -----------------------------------
  // The plot in the open camp where drovers who die on the road are
  // buried with their boots on. Site-type POI, no service, no doors into
  // adjacent walls (the autoseal does not let the graveyard breach the
  // outer wall to the north).
  "-13,-5": {
    terrain: "settlement",
    poi: {
      type: "site",
      name: "Drover's Graveyard",
      access: "public",
      area: "caravanserai-outer-ring",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "drovers-graveyard",
      partName: "Drover's Graveyard",
      description:
        "A square of open ground in the north annulus, fenced off with a knee-high run of mud-brick and seeded with cheap timber crosses, a few stone slabs, and the occasional carved post in a foreign script. Drovers who die on the road or in the camp are buried here with their boots on — the boots are the man's; nobody steals from a drover's grave. The warden keeps no register, but every caravan-master who has lost a man knows which mound is his, and stops a moment going past with the lead-rein in his hand.",
    },
    doors: [],
  },
};

// ----------------------------------------------------------------------------
// Sealed structure: the Caravanserai Outer Ring. Interior is every new
// walkable coord this patch introduces. The one gate-bridge is the Caravan
// Sallygate at (-7,0) opening through Whitemarch's own west wall at (-6,0).
//
// NOTE: the existing inner-ring sealed_structure stays in place untouched —
// it was appended by the first-pass district-caravanserai.js module and its
// inner East Gate at (-9,0) continues to bridge (-9,0)↔(-8,0). Now that
// (-8,0) is an authored tile inside the outer ring, the player walking out
// of the inner gate steps into the East Road Court instead of procedural
// country.
// ----------------------------------------------------------------------------
const OUTER_RING_INTERIOR_KEYS = Object.keys(TILES).filter(
  (k) => TILES[k].terrain !== "wall"
);

export const STRUCTURES = [
  {
    name: "The Caravanserai — Outer Ring",
    interior: OUTER_RING_INTERIOR_KEYS.map((k) => {
      const [x, y] = k.split(",").map(Number);
      return { x, y };
    }),
    gates: [
      [{ x: -7, y: 0 }, { x: -6, y: 0 }],
    ],
  },
];

// Services this module references. `tavern`, `money-changer`, `healer`,
// `stable`, `slavemarket`, `caravanserai-warden` are already declared by
// earlier districts. `foreign-trader`, `cartwright`, and `cooper` are new
// ids this patch introduces; the Wave 3 S1 audit will surface them for
// addition to town.js BUILDINGS.
export const SERVICES = [
  "caravanserai-warden",
  "tavern",
  "money-changer",
  "healer",
  "stable",
  "slavemarket",
  "foreign-trader",
  "cartwright",
  "cooper",
];
