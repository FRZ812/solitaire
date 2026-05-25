// Fabled landmarks — legendary places known to anyone with a hearth-story, but
// far beyond practical travel. They surface in the narrator's state context as
// [GEOGRAPHY KNOWN BY LEGEND] so NPCs can reference them as compass-goals.
//
// CLEARED to a clean slate: the map was wiped and rebuilt around the walled city
// of Whitemarch alone (data/handcrafted-tiles.js). No fabled places are seeded
// for now; the wider continent is left unwritten. The original legends live in
// git history; restore entries here to re-seed them.
export const FABLED = {};

export function summarizeFabled() {
  return Object.values(FABLED)
    .map((f) => `${f.name} (${f.kind}, ${f.direction})`)
    .join("; ");
}

// Coord-keyed lookup so getTile and the map can resolve a hex to its fabled
// landmark in O(1) instead of scanning the FABLED object.
export const FABLED_BY_COORD = {};
for (const f of Object.values(FABLED)) {
  FABLED_BY_COORD[`${f.coord.x},${f.coord.y}`] = f;
}
