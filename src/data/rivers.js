// Rivers as connected sequences of water tiles. Procedural generation never
// creates water on its own — water comes from rivers or from the rare lake POI.
// Each river is a named feature with a path; every coord on the path becomes
// a water tile via world.js getTile, and gets a small pre-revealed patch so
// the river shows from the start as a flowing strip rather than a few rumours.
//
// Precedence: handcrafted tiles win over river paths. If a river coord is also
// in HANDCRAFTED, that handcrafted definition is what the player sees (used at
// fords and bridges — e.g. the Tannic Ford at (5,-12) and the Bramble Ferry
// at (5,18)).

function straightEastWest(y, xFrom, xTo) {
  const out = [];
  for (let x = xFrom; x <= xTo; x++) out.push({ x, y });
  return out;
}

function straightNorthSouth(x, yFrom, yTo) {
  const out = [];
  for (let y = yFrom; y <= yTo; y++) out.push({ x, y });
  return out;
}

export const RIVERS = [
  {
    id: "tannic",
    name: "The Tannic",
    kind: "river",
    direction: "north",
    description: "The river that drinks the Mire. Tannic runs east. It feeds the ford on the wagon-track north of the Inn, and pools deep enough for a punt below the Hollow Pines.",
    path: straightEastWest(-20, -8, 14),
  },
  {
    id: "whitewend",
    name: "The Whitewend",
    kind: "river",
    direction: "south",
    description: "A slow, chalk-coloured river running east through the Bramblewych Reach. The Bramble Ferry crosses it; below the ferry it widens into a reed-fringed stretch that drains, eventually, toward the Hollow Coast.",
    path: [
      ...straightEastWest(18, -8, 4),
      ...straightEastWest(18, 6, 18),
    ],
  },
  {
    id: "spinewater",
    name: "The Spinewater",
    kind: "river",
    direction: "southeast",
    description: "A swift, stone-bedded river out of the Spine, threading the foothills east before turning toward the Plateau. In flood it carries firs the length of a barn end-on.",
    path: straightEastWest(22, 13, 45),
  },
  {
    id: "crowsbeck",
    name: "The Crowsbeck",
    kind: "river",
    direction: "northwest",
    description: "A short feeder running south out of the Tannic Wood — the watercourse that turns the Crowsmoor mill-wheel. Locals fish its lower stretch and refuse to fish its upper.",
    path: straightNorthSouth(25, -10, -2),
  },
];

export const RIVER_BY_COORD = {};
for (const r of RIVERS) {
  for (const p of r.path) {
    RIVER_BY_COORD[`${p.x},${p.y}`] = r;
  }
}
