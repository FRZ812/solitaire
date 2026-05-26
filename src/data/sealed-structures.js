// Sealed structures — access-control door specs (see docs/WORLDBUILDING.md,
// Ruling 7, and docs/region-planning/WHITEMARCH_*). The map was wiped to a clean
// slate and rebuilt around the walled city of Whitemarch at the origin; the old
// roadside sandbox is preserved in sealed-structures.legacy.js.
//
// Two authoring shapes (the auto-application at the bottom of
// data/handcrafted-tiles.js picks based on which fields are present):
//
//   interior + gates — a sealed AREA (a whole walled city or ward). Every hex in
//     `interior` opens to all of its in-area neighbours (free movement inside);
//     every edge to a hex OUTSIDE the area is a wall. `gates` is a list of
//     [inside, outside] pairs — the one(s) the wall opens at (e.g. the Crown
//     Gate). `inside` additionally opens to `outside`; nothing else crosses the
//     wall, so the area is sealed save at its gates regardless of its shape.
//     (Legacy `threshold` is still honoured: a threshold hex keeps default-open
//     doors — enterable from anywhere — for dungeon mouths and the like.)
//
//   entry + outside + links — a single building / inner compound whose interior
//     connectivity is an explicit graph. `links` is a list of [a, b] hex pairs
//     that connect; each hex opens ONLY to its linked neighbours. `entry` is the
//     doorway hex and `outside` the adjacent street it opens onto. Used here for
//     the Citadel's High Wall: the inner compound is reachable ONLY through the
//     Inner Gate. Closed edges render as walls, the open door as a gap.
//
// ORDER MATTERS. The structures are applied in array order, and each one
// overwrites the door list of the hexes it touches. The Great Wall (a mesh over
// every city hex, including the citadel) MUST come before the Citadel (links),
// so the citadel's gate-only doors override the mesh's full-mesh doors — that is
// what turns the High Wall into a real wall while keeping the Inner Gate
// reachable from the street it faces.
//
// The auto-application validates that links/gates are between adjacent hexes,
// that every linked member is reachable from its entry, and warns if a building
// entry opens onto something that is not a street (road or settlement).

// Every walkable hex inside Whitemarch's Great Wall (the citadel included, so the
// Inner Gate stays reachable from the street; the Citadel structure below then
// re-seals the compound). The Sewer Mouth is deliberately NOT listed — it carries
// its own empty door list so it stays sealed off the street (a hidden descent).
const WHITEMARCH_INTERIOR = [
  { x: 0, y: -2 },  // Toll Hall (the gate)
  { x: 0, y: -1 },  // Inspection Yard
  { x: 1, y: -2 },  // Dragon-Watch Tower
  { x: 0, y: 0 },   // Grain Square
  { x: 1, y: 0 },   // Butchers' Row
  { x: 0, y: 1 },   // Cloth Awnings
  { x: 1, y: -1 },  // Night Market
  { x: -1, y: -1 }, // Caravan Yard & Stable
  { x: 2, y: -1 },  // High Quay
  { x: -1, y: 0 },  // Public Smith Row
  { x: -1, y: 1 },  // Guild Court
  { x: -2, y: 1 },  // Embassy Lane
  { x: 1, y: 1 },   // Chain Market Steps
  { x: 2, y: 1 },   // Registry Hall
  { x: 0, y: 2 },   // Tenement Row
  { x: -1, y: 2 },  // Lower Petition Steps
  { x: -2, y: 2 },  // Granary Court
  { x: -2, y: 3 },  // Prison Gate
  { x: -1, y: 3 },  // Great Oath Steps
  { x: 0, y: 3 },   // Inner Gate (citadel)
  { x: 0, y: 4 },   // Council Hall (citadel)
];

export const SEALED_STRUCTURES = [
  // ---------- WHITEMARCH — THE GREAT WALL ----------
  // The whole city is one enclosed area. Free movement within; the only way
  // through the Great Wall is the Crown Gate (Toll Hall ↔ Crown Road Approach).
  {
    name: "The Great Wall of Whitemarch",
    interior: WHITEMARCH_INTERIOR,
    gates: [
      [{ x: 0, y: -2 }, { x: 0, y: -3 }], // Toll Hall opens out to the Crown Road Approach
    ],
  },
  // ---------- WHITEMARCH — THE HIGH WALL (CITADEL) ----------
  // Applied AFTER the Great Wall so it overrides the mesh: the Council Hall is
  // reachable ONLY through the Inner Gate, which faces the Great Oath Steps.
  {
    name: "The High Wall (Citadel Ward)",
    entry: { x: 0, y: 3 },    // Inner Gate
    outside: { x: -1, y: 3 }, // opens onto the Great Oath Steps
    links: [
      [{ x: 0, y: 3 }, { x: 0, y: 4 }], // Inner Gate -> Council Hall
    ],
  },
];
