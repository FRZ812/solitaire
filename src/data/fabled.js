// Fabled landmarks — legendary places known to anyone with a hearth-story, but
// far beyond practical travel from the Vale. These don't appear on the local
// map (their coords are far outside MAP_VIEW_RADIUS). They surface in the
// narrator's state context as [GEOGRAPHY KNOWN BY LEGEND], so NPCs can reference
// them and the player has compass goals worth walking toward.
//
// Coords are axial (pointy-top hex), positioned roughly in the named direction
// from the Vale so any future cross-continent travel has a consistent compass.

export const FABLED = {
  "northstar-castle": {
    name: "The Northstar Castle",
    direction: "north, beyond the Tannic",
    kind: "fortress",
    coord: { x: 30, y: -110 },
    description: "The seat of the Demon King — said to stand where the polestar never sets and the snow never melts. Few who walked toward it have come back; none of those came back the same.",
  },
  "sunken-crown": {
    name: "The Sunken Crown",
    direction: "southwest, past the Old Wall",
    kind: "ruin",
    coord: { x: -100, y: 100 },
    description: "An empire of the second age, drowned in a single night. Fisherfolk speak of towers visible at low tide, and bells that ring without rope.",
  },
  "star-forge": {
    name: "The Star-Forge",
    direction: "southeast, beyond the Spine",
    kind: "ruin",
    coord: { x: 100, y: 90 },
    description: "A forge older than the gods, where the first iron was hammered out of fallen stars. Pilgrims walk a year to reach it; some return with a piece of black metal worth more than a kingdom.",
  },
  "bone-citadel": {
    name: "The Bone Citadel",
    direction: "northwest, beyond Black Tarn",
    kind: "fortress",
    coord: { x: -100, y: -90 },
    description: "A fortress of pale bone risen from the steppe — the last hold of the Witch-Queens, said to be empty now. Travellers swear they hear singing from inside it on still nights.",
  },
  "tellmar": {
    name: "The Iron City of Tellmar",
    direction: "east, past Whitemarch",
    kind: "city",
    coord: { x: 140, y: 0 },
    description: "The greatest city of the eastern coast — a port of black-iron docks and a hundred banners. Every road in the known world leads, eventually, to Tellmar.",
  },
};

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
