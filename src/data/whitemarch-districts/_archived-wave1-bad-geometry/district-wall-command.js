// Wall Command — the city's wall garrison district. Boots on stone stairs,
// oilcloth over scorpions, alarm-drills that stop conversation across a
// ward, veterans measuring sky by habit, dragon-watch crews gambling under
// covered harpoons, quartermasters counting bolts twice. The doctrine
// treats every Wall Command tile as permit-only — entry is restricted
// across the footprint, and the EXTREME ENTRY system (scale / breach /
// magic) is the only off-permit route.
//
// This module expands the existing single-tile Dragon-Watch Post at
// (4,-5) into the bible's 4-part footprint: a harpoon gallery anchor on
// the wall, a lower watchroom at street level, a signal mirror loft
// above, and the bolt rack arsenal in a side chamber.
//
// Footprint inside the bounding box (3..4, -6..-3):
//
//   y=-6: 3,-6 / 4,-6           -- wall ring. DO NOT TOUCH.
//   y=-5: 3,-5 CARAVAN YARD     -- owned by district-great-stable. DO NOT
//                                  TOUCH.
//        4,-5 DRAGON-WATCH      -- rewrite of the existing singleton spire
//                                  as the Harpoon Gallery anchor.
//   y=-4: 3,-4 TACK ROOM        -- owned by district-great-stable. DO NOT
//                                  TOUCH. (The agent prompt listed this
//                                  as unnamed/available; the Great Stable
//                                  module claimed it in the same wave.)
//        4,-4                   -- unnamed street, rewritten as Lower
//                                  Watchroom (the entrance level).
//   y=-3: 3,-3                  -- unnamed street, rewritten as the Bolt
//                                  Rack arsenal (the side chamber off
//                                  the Lower Watchroom; (3,-4) was taken
//                                  by the Great Stable so the arsenal
//                                  moves one hex east of the original
//                                  plan, retaining the Lower Watchroom
//                                  adjacency).
//        4,-3                   -- unnamed street, rewritten as Signal
//                                  Mirror Loft (the mirror crew's room
//                                  above the entrance).
//
// Door-graph notes:
//   - The existing (4,-5) Dragon-Watch Post opened to (4,-4) and to
//     (5,-6) Dragon Stair (the wall-stair bridge to the wall-walk). Both
//     links are preserved on the new Harpoon Gallery anchor.
//   - Hex adjacency around the footprint: (4,-5) touches (4,-4) and
//     (3,-4); (4,-4) touches (4,-5), (4,-3), (3,-4), (3,-3); (4,-3)
//     touches (4,-4) and (3,-3); (3,-3) touches (4,-4), (4,-3), (3,-4),
//     (2,-3), (2,-2), (3,-2). The footprint connects through the x=4
//     spine (Harpoon Gallery -> Lower Watchroom -> Signal Mirror Loft)
//     with the Bolt Rack at (3,-3) reaching Lower Watchroom only.
//   - Restricting (3,-3) removes one of the street-grid hubs in this
//     area. Its previous neighbours (2,-3), (2,-2), (3,-2), (3,-4) still
//     reach each other directly via the (2,-2)/(3,-2)/(2,-3) cluster
//     and via the Great Stable's gate at (3,-4); no neighbourhood
//     becomes unreachable. The arsenal's door faces only the watchroom,
//     so the street network sees a sealed wall here.
//   - The previous (3,-3) and (4,-3) streets pointed at the Great
//     Stable's (3,-4) and at (3,-2) High Quay approach; with the
//     rewrite, those one-way doors from outside become dead-ends (the
//     engine treats unanswered doors as sealed), which matches the
//     intended restricted shape.
//
// Services declared: dragon-watch-captain (the Harpoon Gallery's veteran
// commander; contact for the bible hooks — missing relic-bolt, hidden
// dragon-sighting report, Frostmaw territory tip). Not yet in town.js
// BUILDINGS; Wave 3 S1 will add it.

export const DISTRICT_ID   = "wall-command";
export const DISTRICT_NAME = "Wall Command";

export const BOUNDING_BOX = { xmin: 3, xmax: 4, ymin: -6, ymax: -3 };

const PARENT      = "whitemarch-dragon-watch-post";
const PARENT_NAME = "Dragon-Watch Post";

export const TILES = {
  // ---------- Harpoon Gallery anchor (rewrite of the existing singleton) --
  // Was a single "spire" tile at (4,-5) with doors to (4,-4) and (5,-6)
  // Dragon Stair. Both links are preserved. The existing description is
  // preserved almost verbatim (oil, cold iron, bolt-as-long-as-a-man,
  // signal-mirror crews, veteran watchers) per the prompt's instruction
  // to retain the original focus.
  "4,-5": {
    terrain: "indoor",
    poi: {
      type: "spire",
      name: "Dragon-Watch Post",
      service: "dragon-watch-captain",
      access: "restricted",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "harpoon-gallery",
      partName: "Harpoon Gallery",
      description:
        "The gallery smells of oil, cold iron, and old smoke. Harpoon-frames point through open shutters at the northern sky; signal-mirrors hang under wool covers between them, the cords coiled and labelled. On the central rack rests a bolt as long as a man, its head blackened by an alchemy no one in the room jokes about. Veteran watchers stand at the embrasures the way other men stand at a hearth — turned to the cold and patient with it. The captain's chair is set so its back never quite faces the north shutters, and the day-book on the lectern beside it has its current page weighted with a spent crossbow-quarrel.",
    },
    // Preserve the original (4,-4) Lower Watchroom door and the (5,-6)
    // Dragon Stair bridge to the wall-walk.
    doors: [
      { x: 4, y: -4 },
      { x: 5, y: -6 },
    ],
  },

  // ---------- Lower Watchroom — the entrance level ----------------------
  // The spire's ground room. Bell-codes plaques nailed beside the stair,
  // ammunition lockers along the inner wall, a duty-bench and a slate
  // for the watch-rota. Everyone who enters the spire passes through
  // here first; the door-warden checks chits, names, and coats.
  "4,-4": {
    terrain: "indoor",
    poi: {
      type: "hall",
      name: "Lower Watchroom",
      access: "restricted",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "lower-watchroom",
      partName: "Lower Watchroom",
      description:
        "The spire's entrance level: a low stone room with a duty-bench worn shiny by a hundred years of waiting backsides, a slate-board ruled into watch-shifts, and bell-codes plaques nailed beside the stair (one stroke for muster, three for sky, the long roll for fire). Ammunition lockers run the inner wall, each padlocked and sealed with the quartermaster's lead. A door-warden in the city's grey checks chits at the threshold and writes every name in the day-book; nobody climbs the stair to the gallery whose name is not there.",
    },
    // Interior reach: up to the Harpoon Gallery (4,-5), across to the
    // Signal Mirror Loft (4,-3), through the side door to the Bolt
    // Rack (3,-3). No public street door — entry is by writ at the
    // outer hatch (the door-warden line above is narrative, not a
    // street-side opening).
    doors: [
      { x: 4, y: -5 },
      { x: 4, y: -3 },
      { x: 3, y: -3 },
    ],
  },

  // ---------- Signal Mirror Loft — the mirror crew's room ---------------
  // Narratively a loft above the entrance; on the map it's the hex one
  // step south of the watchroom. The mirror crew works here under wool
  // covers, bouncing coded flashes along the wall-walk to the next
  // command position. Shutters set high; a chart of the city's
  // reception stations pinned to the back wall.
  "4,-3": {
    terrain: "indoor",
    poi: {
      type: "hall",
      name: "Signal Mirror Loft",
      access: "restricted",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "signal-mirror-loft",
      partName: "Signal Mirror Loft",
      description:
        "A timbered loft built into the spire's southern flank, lit by a row of small shutters set high. Two polished bronze mirrors stand on swivel-frames under folded wool covers; the crew uncovers them only on the captain's nod. A chart of the city's reception stations is pinned to the back wall, with cord-distances marked in chalk and the next station along the wall-walk circled. Messages flash from here to the bell-spire at the gate and on; a missed flash is a flogging matter, and the crew works in the kind of quiet that only veteran flag-hands keep.",
    },
    doors: [
      { x: 4, y: -4 },
    ],
  },

  // ---------- Bolt Rack — the relic-bolts arsenal -----------------------
  // The side chamber off the Lower Watchroom (relocated from the
  // originally-planned (3,-4) because the Great Stable claimed that tile
  // for its Tack Room). The chamber holds the spire's named ammunition:
  // alchemy-headed bolts, ranging shafts, the dragon-bolts the captain's
  // day-book counts twice a day. The bible hook: one is rumoured
  // missing. The rack itself has a slot chalked over, and the
  // quartermaster's tally for that slot has not matched in three weeks.
  "3,-3": {
    terrain: "indoor",
    poi: {
      type: "hall",
      name: "Bolt Rack",
      access: "restricted",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "bolt-rack",
      partName: "Bolt Rack",
      description:
        "A long, low chamber lined floor-to-rafter with iron-strapped racks. The relic-bolts lie in their cradles like sleeping creatures — alchemy-headed shafts heavier than a man's leg, ranging quarrels tipped in lead, the dragon-bolts whose heads the captain forbids the new recruits to touch. Every cradle has a brass tally-plate; a quartermaster's chalk-mark beside one empty cradle has not been wiped in three weeks, and the day-book entry next to it says only 'pending'. The air smells of cold iron and beeswax.",
    },
    // The arsenal opens onto the Lower Watchroom only — no public-side
    // door. The street-grid neighbours (2,-3), (2,-2), (3,-2), (3,-4)
    // see a sealed wall here; their one-way doors at this coord become
    // dead-ends (engine treats unanswered doors as sealed), matching
    // the restricted shape.
    doors: [
      { x: 4, y: -4 },
    ],
  },
};

// No new sealed structures — the wall ring (3,-6) / (4,-6) and the
// Dragon Stair at (5,-6) are owned elsewhere and pre-existing. The
// spire footprint is interior-only.
export const STRUCTURES = [];

export const SERVICES = [
  "dragon-watch-captain",
];
