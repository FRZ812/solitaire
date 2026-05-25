// Sealed structures — interior + threshold tile sets for access-control
// doors (see docs/WORLDBUILDING.md, Ruling 7).
//
// For each structure:
//   - `threshold` lists the public-facing gate / mouth hex(es). These keep
//     default-open doors so they can be entered from wilderness.
//   - `interior` lists every interior hex. Each gets a `doors:` array
//     listing the threshold + interior neighbours; every other adjacent
//     hex is a wall.
//
// The auto-application lives at the bottom of data/handcrafted-tiles.js.
// Smoke-test (/tmp/gen-doors.mjs in dev) verifies no interior tile is
// orphaned from the threshold via the interior+threshold graph.

export const SEALED_STRUCTURES = [
  // ---------- CLOSE-IN DUNGEONS ----------
  {
    name: "Goblin Hollow",
    threshold: [{ x: -8, y: -10 }, { x: -9, y: -10 }],
    interior: [
      { x: -9, y: -11 }, { x: -8, y: -12 }, { x: -9, y: -12 },
      { x: -10, y: -11 }, { x: -10, y: -12 }, { x: -9, y: -13 },
    ],
  },
  {
    name: "Brokenglass Tower",
    threshold: [{ x: -15, y: -20 }, { x: -15, y: -21 }],
    interior: [
      { x: -15, y: -19 },
      { x: -16, y: -22 }, { x: -14, y: -22 }, { x: -15, y: -22 },
    ],
  },
  {
    name: "Witch-Hag's Cot",
    threshold: [{ x: -12, y: -28 }],
    interior: [
      { x: -11, y: -29 }, { x: -12, y: -29 }, { x: -12, y: -30 },
    ],
  },
  {
    name: "Caer Drum",
    threshold: [{ x: 14, y: 15 }, { x: 16, y: 15 }],
    interior: [
      { x: 15, y: 15 }, // inner courtyard / ruin centre
      { x: 14, y: 16 }, { x: 16, y: 14 }, { x: 15, y: 13 },
      { x: 16, y: 16 }, { x: 14, y: 14 }, { x: 15, y: 17 },
    ],
  },
  {
    name: "Mossbridge Hold",
    threshold: [
      { x: 20, y: 11 }, { x: 19, y: 12 }, { x: 21, y: 12 },
      { x: 20, y: 12 },
    ],
    interior: [
      { x: 20, y: 13 }, { x: 21, y: 11 }, { x: 21, y: 13 },
      { x: 20, y: 14 }, { x: 19, y: 13 },
    ],
  },
  {
    name: "Ogre Stair",
    threshold: [{ x: 30, y: 28 }, { x: 29, y: 28 }],
    interior: [
      { x: 29, y: 29 }, { x: 30, y: 29 }, { x: 31, y: 28 },
      { x: 30, y: 30 },
    ],
  },
  {
    name: "Cinder Chapter",
    threshold: [{ x: 30, y: -29 }, { x: 30, y: -30 }],
    interior: [
      { x: 31, y: -29 }, { x: 29, y: -29 },
      { x: 31, y: -30 }, { x: 29, y: -30 },
      { x: 30, y: -31 }, { x: 31, y: -31 }, { x: 29, y: -31 },
      { x: 32, y: -30 }, { x: 28, y: -30 },
      { x: 30, y: -32 },
    ],
  },
  {
    name: "Wolf-Pit",
    threshold: [{ x: 4, y: 7 }],
    interior: [
      { x: 4, y: 8 }, { x: 4, y: 6 },
    ],
  },

  // ---------- MAGIC-UNLOCK SITES ----------
  {
    name: "Heron Tower",
    threshold: [{ x: 32, y: 8 }, { x: 33, y: 8 }],
    interior: [
      { x: 32, y: 9 }, { x: 32, y: 10 }, { x: 32, y: 11 }, { x: 33, y: 11 },
    ],
  },
  {
    name: "Library of Old Tannic",
    threshold: [{ x: -8, y: -15 }],
    interior: [
      { x: -7, y: -15 }, { x: -9, y: -15 },
      { x: -8, y: -16 }, { x: -8, y: -14 }, { x: -9, y: -16 },
    ],
  },
  {
    name: "Bloodline Cairn",
    threshold: [{ x: -12, y: 12 }],
    interior: [
      { x: -12, y: 13 },
    ],
  },
  {
    name: "Shrine of the Pale God",
    threshold: [{ x: 8, y: 8 }],
    interior: [
      { x: 9, y: 8 }, { x: 8, y: 9 }, { x: 8, y: 7 },
    ],
  },

  // ---------- RACIAL SETTLEMENTS ----------
  {
    name: "Stonebrook Hold",
    threshold: [{ x: 35, y: 18 }, { x: 36, y: 18 }],
    interior: [
      { x: 35, y: 19 }, { x: 34, y: 19 }, { x: 36, y: 19 },
      { x: 35, y: 20 }, { x: 34, y: 20 }, { x: 36, y: 20 },
      { x: 35, y: 21 }, { x: 34, y: 21 }, { x: 36, y: 21 },
    ],
  },
  {
    name: "Greenshaw",
    threshold: [{ x: -15, y: 8 }, { x: -16, y: 8 }],
    interior: [
      { x: -15, y: 9 }, { x: -14, y: 9 }, { x: -16, y: 9 },
      { x: -15, y: 10 }, { x: -14, y: 10 }, { x: -15, y: 11 },
    ],
  },
  {
    name: "Selenyan Edge",
    threshold: [{ x: -28, y: 12 }, { x: -27, y: 12 }, { x: -29, y: 12 }],
    interior: [
      { x: -28, y: 13 }, { x: -27, y: 13 }, { x: -29, y: 13 },
      { x: -28, y: 14 }, { x: -27, y: 14 }, { x: -28, y: 15 },
    ],
  },
  {
    name: "Halfborn Hold",
    threshold: [{ x: 12, y: -3 }, { x: 13, y: -3 }],
    interior: [
      { x: 12, y: -4 }, { x: 11, y: -4 }, { x: 13, y: -4 },
      { x: 12, y: -5 }, { x: 11, y: -5 }, { x: 13, y: -5 },
      { x: 12, y: -6 },
    ],
  },

  // ---------- EXISTING TOWNS / CITIES ----------
  {
    name: "Whitemarch",
    threshold: [
      { x: 38, y: -20 }, { x: 40, y: -19 },
      { x: 44, y: -20 }, { x: 38, y: -19 },
    ],
    interior: [
      { x: 39, y: -20 }, { x: 40, y: -20 }, { x: 40, y: -21 },
      { x: 41, y: -21 }, { x: 41, y: -20 }, { x: 41, y: -19 },
      { x: 42, y: -20 }, { x: 43, y: -20 }, { x: 42, y: -21 },
      { x: 43, y: -21 }, { x: 42, y: -22 }, { x: 44, y: -21 },
      { x: 43, y: -22 }, { x: 44, y: -22 }, { x: 43, y: -23 },
      { x: 42, y: -23 }, { x: 41, y: -23 }, { x: 39, y: -21 },
      { x: 38, y: -21 }, { x: 38, y: -22 }, { x: 39, y: -22 },
      { x: 40, y: -22 }, { x: 40, y: -23 }, { x: 39, y: -23 },
      { x: 41, y: -22 }, { x: 39, y: -19 }, { x: 42, y: -19 },
    ],
  },
  {
    name: "Crowsmoor",
    threshold: [{ x: 24, y: 0 }, { x: 26, y: 0 }, { x: 27, y: 0 }],
    interior: [
      { x: 25, y: 0 }, { x: 26, y: -1 }, { x: 25, y: 1 },
      { x: 25, y: -1 }, { x: 24, y: 1 }, { x: 27, y: -1 },
      { x: 26, y: 1 },
    ],
  },
  {
    name: "Bramblewych",
    threshold: [{ x: -23, y: 20 }, { x: -27, y: 20 }],
    interior: [
      { x: -25, y: 20 }, { x: -24, y: 20 }, { x: -24, y: 19 },
      { x: -25, y: 19 }, { x: -26, y: 20 }, { x: -26, y: 21 },
      { x: -25, y: 21 },
    ],
  },
  {
    name: "Beltsworn",
    threshold: [{ x: 23, y: -15 }, { x: 27, y: -15 }, { x: 24, y: -15 }],
    interior: [
      { x: 25, y: -15 }, { x: 26, y: -15 },
      { x: 25, y: -14 }, { x: 25, y: -16 },
    ],
  },

  // ---------- FABLED LEGENDS ----------
  {
    name: "Northstar Castle",
    threshold: [
      { x: 29, y: -149 }, { x: 31, y: -149 }, { x: 30, y: -149 },
    ],
    interior: [
      { x: 30, y: -150 }, { x: 29, y: -150 }, { x: 31, y: -150 },
      { x: 30, y: -151 }, { x: 29, y: -151 }, { x: 31, y: -151 },
      { x: 28, y: -150 }, { x: 32, y: -150 },
      { x: 30, y: -152 }, { x: 29, y: -152 }, { x: 31, y: -152 },
      { x: 30, y: -153 },
    ],
  },
  {
    name: "Brokenhold",
    threshold: [
      { x: -121, y: -59 }, { x: -119, y: -59 }, { x: -120, y: -59 },
    ],
    interior: [
      { x: -120, y: -60 }, { x: -121, y: -60 }, { x: -119, y: -60 },
      { x: -120, y: -61 }, { x: -121, y: -61 }, { x: -119, y: -61 },
      { x: -122, y: -60 }, { x: -118, y: -60 },
      { x: -120, y: -62 }, { x: -121, y: -62 }, { x: -119, y: -62 },
      { x: -120, y: -63 }, { x: -120, y: -64 },
    ],
  },
  {
    name: "Drakespire",
    threshold: [
      { x: -1, y: -128 }, { x: 1, y: -128 }, { x: 0, y: -129 },
    ],
    interior: [
      { x: -1, y: -129 }, { x: 1, y: -129 },
      { x: 0, y: -130 }, { x: -1, y: -130 }, { x: 1, y: -130 },
      { x: 0, y: -131 }, { x: -1, y: -131 }, { x: 1, y: -131 },
      { x: 0, y: -132 }, { x: 0, y: -133 },
    ],
  },
  {
    name: "Bone Citadel",
    threshold: [
      { x: -101, y: -89 }, { x: -99, y: -89 }, { x: -100, y: -89 },
    ],
    interior: [
      { x: -100, y: -90 }, { x: -101, y: -90 }, { x: -99, y: -90 },
      { x: -100, y: -91 }, { x: -101, y: -91 }, { x: -99, y: -91 },
      { x: -100, y: -92 }, { x: -100, y: -93 },
    ],
  },
  {
    name: "Lichgate",
    threshold: [
      { x: -131, y: -99 }, { x: -129, y: -99 }, { x: -130, y: -99 },
    ],
    interior: [
      { x: -130, y: -100 }, { x: -131, y: -100 }, { x: -129, y: -100 },
      { x: -130, y: -101 }, { x: -131, y: -101 },
      { x: -130, y: -102 }, { x: -130, y: -103 },
    ],
  },
  {
    name: "Mole-Halls of Durnnoch",
    threshold: [
      { x: -151, y: -19 }, { x: -149, y: -19 }, { x: -150, y: -19 },
    ],
    interior: [
      { x: -150, y: -20 }, { x: -151, y: -20 }, { x: -149, y: -20 },
      { x: -150, y: -21 }, { x: -151, y: -21 }, { x: -149, y: -21 },
      { x: -150, y: -22 }, { x: -151, y: -22 }, { x: -149, y: -22 },
      { x: -150, y: -23 },
    ],
  },
  {
    name: "Tellmar",
    threshold: [{ x: 199, y: -1 }, { x: 201, y: -1 }, { x: 200, y: -1 }],
    interior: [
      { x: 200, y: 0 }, { x: 199, y: 0 }, { x: 201, y: 0 },
      { x: 200, y: 1 }, { x: 199, y: 1 }, { x: 201, y: 1 },
      { x: 200, y: 2 }, { x: 199, y: 2 }, { x: 201, y: 2 },
      { x: 198, y: 0 }, { x: 202, y: 0 },
      { x: 200, y: 3 }, { x: 199, y: 3 }, { x: 201, y: 3 },
    ],
  },
  {
    name: "Star-Forge",
    threshold: [{ x: 139, y: 91 }, { x: 141, y: 91 }, { x: 140, y: 91 }],
    interior: [
      { x: 140, y: 90 }, { x: 139, y: 92 }, { x: 141, y: 92 },
      { x: 140, y: 92 }, { x: 139, y: 93 }, { x: 140, y: 93 },
    ],
  },
  {
    name: "Heartwood",
    threshold: [
      { x: -181, y: 29 }, { x: -179, y: 29 },
      { x: -181, y: 30 }, { x: -179, y: 30 },
    ],
    interior: [
      { x: -180, y: 30 }, { x: -180, y: 31 }, { x: -181, y: 31 },
      { x: -180, y: 32 }, { x: -180, y: 33 },
    ],
  },
  {
    name: "Asalan",
    threshold: [
      { x: -30, y: 148 }, { x: -31, y: 149 }, { x: -29, y: 149 },
      { x: -30, y: 149 },
    ],
    interior: [
      { x: -30, y: 150 }, { x: -31, y: 150 }, { x: -29, y: 150 },
      { x: -30, y: 151 }, { x: -30, y: 152 },
      { x: -31, y: 151 }, { x: -29, y: 151 },
      { x: -31, y: 152 }, { x: -29, y: 152 },
      { x: -30, y: 153 }, { x: -31, y: 153 }, { x: -29, y: 153 },
      { x: -30, y: 154 },
    ],
  },
  {
    name: "Caer Selenya",
    threshold: [
      { x: -201, y: 49 }, { x: -199, y: 49 }, { x: -200, y: 48 },
    ],
    interior: [
      { x: -200, y: 50 }, { x: -201, y: 50 }, { x: -199, y: 50 },
      { x: -200, y: 51 }, { x: -201, y: 51 }, { x: -199, y: 51 },
      { x: -200, y: 52 }, { x: -201, y: 52 }, { x: -199, y: 52 },
      { x: -200, y: 53 }, { x: -201, y: 53 }, { x: -199, y: 53 },
      { x: -200, y: 54 },
    ],
  },
  {
    name: "Glass Spire",
    threshold: [{ x: 89, y: -89 }, { x: 91, y: -89 }],
    interior: [
      { x: 90, y: -90 }, { x: 89, y: -90 }, { x: 91, y: -90 },
      { x: 90, y: -91 }, { x: 89, y: -91 }, { x: 91, y: -91 },
      { x: 90, y: -92 }, { x: 90, y: -93 },
    ],
  },
  {
    name: "Pillar of Storms",
    threshold: [{ x: 9, y: 159 }, { x: 11, y: 159 }],
    interior: [
      { x: 10, y: 160 }, { x: 10, y: 161 }, { x: 10, y: 162 },
    ],
  },
  {
    name: "Empty Lighthouse",
    threshold: [{ x: -221, y: 89 }, { x: -219, y: 89 }],
    interior: [
      { x: -220, y: 90 }, { x: -220, y: 91 }, { x: -220, y: 92 },
    ],
  },
  {
    name: "Cinder Throne",
    threshold: [{ x: 59, y: -159 }, { x: 61, y: -159 }],
    interior: [
      { x: 60, y: -160 }, { x: 60, y: -161 }, { x: 59, y: -160 },
      { x: 60, y: -162 },
    ],
  },
  {
    name: "Silver Lacuna",
    threshold: [{ x: 179, y: 59 }, { x: 181, y: 59 }],
    interior: [
      { x: 180, y: 60 }, { x: 179, y: 60 }, { x: 181, y: 60 },
      { x: 180, y: 61 }, { x: 180, y: 62 },
    ],
  },
];
