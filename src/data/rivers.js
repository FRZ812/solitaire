// Rivers as connected sequences of water tiles. Procedural generation never
// creates water on its own — water comes from rivers or from the rare lake POI.
//
// CLEARED to a clean slate: the map was wiped and rebuilt around the walled city
// of Whitemarch alone. Whitemarch's own river (the Whitewend, at the High Quay)
// is authored directly as handcrafted water tiles in data/handcrafted-tiles.js,
// so no global river paths are seeded here. The original river set lives in git
// history.
export const RIVERS = [];

export const RIVER_BY_COORD = {};
for (const r of RIVERS) {
  for (const p of r.path) {
    RIVER_BY_COORD[`${p.x},${p.y}`] = r;
  }
}
