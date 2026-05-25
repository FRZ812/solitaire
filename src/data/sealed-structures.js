// Sealed structures — access-control door specs (see docs/WORLDBUILDING.md,
// Ruling 7). The full Mirecross world was wiped to a roadside sandbox; the rich
// original is preserved in sealed-structures.legacy.js.
//
// Two authoring shapes (the auto-application at the bottom of
// data/handcrafted-tiles.js picks based on which fields are present):
//
//   threshold + interior — dungeons / wards. `threshold` lists the
//     public-facing gate / mouth hex(es) (these keep default-open doors so they
//     can be entered from wilderness); `interior` lists every interior hex, each
//     of which opens to all of its in-structure neighbours. Every other adjacent
//     hex is a wall.
//
//   entry + outside + links — a single building whose interior connectivity is
//     an explicit graph. `links` is a list of [a, b] hex pairs that connect;
//     each hex opens ONLY to its linked neighbours. `entry` is the doorway hex
//     and `outside` the adjacent road hex it opens onto. Use this to gate
//     movement inside a footprint (e.g. rooms reachable only via a common room);
//     the closed edges render as interior walls and the open door as a gap.
//
// The auto-application validates that links are between adjacent hexes, that
// every member is reachable from the entry, and that the `outside` hex is a road.

export const SEALED_STRUCTURES = [
  // ---------- ROADSIDE SANDBOX (three buildings on one road) ----------
  {
    name: "The Drowned Rat",
    // Common room (0,0) is the only door in from the road (-1,0), and the only
    // way through to the yard, stable, and the guest rooms behind it.
    entry: { x: 0, y: 0 },
    outside: { x: -1, y: 0 },
    links: [
      [{ x: 0, y: 0 }, { x: 1, y: 0 }],   // common room -> yard
      [{ x: 0, y: 0 }, { x: 1, y: -1 }],  // common room -> stable
      [{ x: 0, y: 0 }, { x: 0, y: -1 }],  // common room -> guest rooms
    ],
  },
  {
    name: "The Roadside Smithy",
    // Forge floor (-2,2) is the door in from the road (-1,2); the work yard and
    // sales bench open only off the forge.
    entry: { x: -2, y: 2 },
    outside: { x: -1, y: 2 },
    links: [
      [{ x: -2, y: 2 }, { x: -3, y: 2 }],  // forge floor -> work yard
      [{ x: -2, y: 2 }, { x: -2, y: 3 }],  // forge floor -> sales bench
    ],
  },
  {
    name: "The Wayside Shrine",
    // Nave (-2,-2) is the door in from the road (-1,-2); the vestry opens only
    // off the nave.
    entry: { x: -2, y: -2 },
    outside: { x: -1, y: -2 },
    links: [
      [{ x: -2, y: -2 }, { x: -2, y: -3 }],  // nave -> vestry
    ],
  },
];
