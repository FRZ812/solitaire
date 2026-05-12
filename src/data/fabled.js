// Fabled landmarks — legendary places known to anyone with a hearth-story, but
// far beyond practical travel from the Vale. These don't appear on the local
// map (their coords are far outside MAP_VIEW_RADIUS). They surface in the
// narrator's state context as [GEOGRAPHY KNOWN BY LEGEND], so NPCs can reference
// them and the player has compass goals worth walking toward.
//
// Coords are axial (pointy-top hex), positioned roughly in the named direction
// from the Vale so any future cross-continent travel has a consistent compass.
// Convention: |x| or |y| ≥ 90 so these never accidentally render on a local map.

export const FABLED = {
  // ---------- THE NORTH ----------
  "northstar-castle": {
    name: "The Northstar Castle",
    direction: "north, beyond the Tannic",
    kind: "fortress",
    coord: { x: 30, y: -150 },
    description: "The seat of the Demon King — said to stand where the polestar never sets and the snow never melts. Few who walked toward it have come back; none of those came back the same.",
  },
  "drakespire": {
    name: "Drakespire",
    direction: "north, in the Drakeholt",
    kind: "mountains",
    coord: { x: 0, y: -130 },
    description: "The highest peak of the Drakeholt — a single black tooth above the cloud-line where the old wyrms keep court. The Vyrgun call it Vyrnholt and pay tribute upward; from the Spine on a clear morning you can sometimes see a thread of smoke that does not bend with the wind.",
  },
  "bone-citadel": {
    name: "The Bone Citadel",
    direction: "northwest, beyond Black Tarn",
    kind: "fortress",
    coord: { x: -100, y: -90 },
    description: "A fortress of pale bone risen from the steppe — the last hold of the Witch-Queens, said to be empty now. Travellers swear they hear singing from inside it on still nights.",
  },
  "brokenhold": {
    name: "Brokenhold",
    direction: "northwest, in the Sundered Wastes",
    kind: "fortress",
    coord: { x: -120, y: -60 },
    description: "The Vault of the Goblin King — an abandoned imperial fortress squatted by the Sundered Crown. Its outer wall is rebuilt with mismatched stone; its inner keep is older than any banner that has flown above it. Tribute flows in; few who walk in walk out.",
  },
  "white-march": {
    name: "The Whitebone Plain",
    direction: "north-northwest, beyond Brokenhold",
    kind: "ruin",
    coord: { x: -90, y: -110 },
    description: "A plain where two armies fell at once in the Long Smoke and no one buried either of them. The grass grows in white tufts there, rooted in old marrow. Pilgrims walk it without speaking.",
  },

  // ---------- THE EAST ----------
  "tellmar": {
    name: "The Iron City of Tellmar",
    direction: "east, past Whitemarch and the Plateau",
    kind: "city",
    coord: { x: 200, y: 0 },
    description: "The greatest city of the eastern coast — a port of black-iron docks and a hundred banners. Every road in the known world leads, eventually, to Tellmar.",
  },
  "star-forge": {
    name: "The Star-Forge",
    direction: "southeast, beyond the Spine",
    kind: "ruin",
    coord: { x: 140, y: 90 },
    description: "A forge older than the gods, where the first iron was hammered out of fallen stars. Pilgrims walk a year to reach it; some return with a piece of black metal worth more than a kingdom.",
  },
  "silver-lacuna": {
    name: "The Silver Lacuna",
    direction: "east-southeast, deep in the Tellmar marches",
    kind: "ruin",
    coord: { x: 180, y: 60 },
    description: "A long valley said to belong to the Elder-folk — the Silver Lacuna. Tellmar caravans go around it by a week's detour rather than cross. Those who have crossed it speak softly and only when they cannot avoid the subject.",
  },

  // ---------- THE SOUTH ----------
  "sunken-crown": {
    name: "The Sunken Crown",
    direction: "southwest, past the Old Wall",
    kind: "ruin",
    coord: { x: -100, y: 130 },
    description: "An empire of the second age, drowned in a single night. Fisherfolk speak of towers visible at low tide, and bells that ring without rope.",
  },
  "pillar-of-storms": {
    name: "The Pillar of Storms",
    direction: "south, on the Hollow Coast",
    kind: "ruin",
    coord: { x: 10, y: 160 },
    description: "A black basalt lighthouse the height of a hill, half-eaten by the sea. Tideless priests tend it; on storm-nights its lantern is said to light by no hand at all.",
  },
  "glasslake": {
    name: "The Glasslake",
    direction: "south, beyond the Hollow Coast",
    kind: "lake",
    coord: { x: -50, y: 180 },
    description: "A lake the colour of bottle-glass, perfectly still. The Tideless will not name what they say lives under it. Fish drawn from it cook by themselves.",
  },

  // ---------- THE WEST ----------
  "heartwood": {
    name: "The Heartwood",
    direction: "west, past the Witchwood Deep",
    kind: "ruin",
    coord: { x: -180, y: 30 },
    description: "A wood so old its trees walked once, and may again. The Bramble Witches will not enter past its outer ring of yew. It is said the first language is still spoken there, by those who never stopped speaking it.",
  },
  "mole-halls": {
    name: "The Mole-Halls of Durnnoch",
    direction: "west, under the Pale Steppe",
    kind: "ruin",
    coord: { x: -150, y: -20 },
    description: "An underground city carved by the stone-folk — the dwarves. Said to be still inhabited; said to be only the wind in great corridors. Three iron gates, two of them welded shut from within.",
  },
  "lichgate": {
    name: "The Lichgate",
    direction: "northwest, in the Bonemarsh",
    kind: "fortress",
    coord: { x: -130, y: -100 },
    description: "The standing-place of the Pale Hand — a black archway in the middle of a bog that opens upon nothing the eye can quite resolve. The dead that walk the Bonemarsh come from there and return to there.",
  },

  // ---------- THE LIMINAL ----------
  "cinder-throne": {
    name: "The Cinder Throne",
    direction: "high in the Drakeholt, beyond Drakespire",
    kind: "ruin",
    coord: { x: 60, y: -160 },
    description: "A seat of fused obsidian where, the Burning Order say, the first wyrm was unmade. The Order sends its champions there; few are heard from again, and the few who are speak in a voice that is not quite their own.",
  },
  "empty-lighthouse": {
    name: "The Empty Lighthouse",
    direction: "far west, on a coast no one names",
    kind: "ruin",
    coord: { x: -220, y: 90 },
    description: "A white tower on a shore no living captain can chart twice. It has never not been lit; its keeper has never been found. Sailors who claim to have seen its light at sea give different bearings every time.",
  },

  // ---------- PEACEFUL LEGENDS — friendly courts and academies ----------
  "asalan": {
    name: "Asalan",
    direction: "far south, past the Hollow Coast",
    kind: "city",
    coord: { x: -30, y: 150 },
    description: "Seat of the Vale-King — a southern walled city of warm stone, jacaranda streets, and the only sitting human monarch the continent acknowledges. The Crown's writ runs the southern provinces; the Vale gets word from Asalan only twice a year, and answers it with a single courier in spring.",
  },
  "caer-selenya": {
    name: "Caer Selenya",
    direction: "far west, on a coast no human cartographer has named twice",
    kind: "city",
    coord: { x: -200, y: 50 },
    description: "The tree-built city of the Selenyan Court — the elven kindred. Spires of living wood, bridges of woven branch, and the long Council of Names in the city's central grove. Visitors are extended every courtesy and very few invitations.",
  },
  "glass-spire": {
    name: "The Glass Spire",
    direction: "east, in the marches beyond Tellmar",
    kind: "fortress",
    coord: { x: 90, y: -90 },
    description: "The fabled academy of sorcerers — a single tower of pale glass two hundred feet tall, on an island in a lake no map agrees on. The Heron School's masters were trained there; the school's masters' masters were too. The Spire takes new students by invitation, never by request.",
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
