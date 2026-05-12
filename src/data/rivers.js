// Rivers as connected sequences of water tiles. Procedural generation never
// creates water on its own — water comes from rivers or from the rare lake POI.
// Each river is a named feature with a path; every coord on the path becomes
// a water tile via world.js getTile, and gets a small pre-revealed patch so
// the river shows from the start as a flowing strip rather than a few rumours.

function straightEastWest(y, xFrom, xTo) {
  const out = [];
  for (let x = xFrom; x <= xTo; x++) out.push({ x, y });
  return out;
}

export const RIVERS = [
  {
    id: "tannic",
    name: "The Tannic",
    kind: "river",
    direction: "north",
    description: "The river that drinks the Mire. Tannic runs east.",
    path: straightEastWest(-20, -8, 14),
  },
];

export const RIVER_BY_COORD = {};
for (const r of RIVERS) {
  for (const p of r.path) {
    RIVER_BY_COORD[`${p.x},${p.y}`] = r;
  }
}
