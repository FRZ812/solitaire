// Roadside sandbox — a deliberately tiny handcrafted world used to validate the
// multi-hex "merged building" mechanic in isolation. Three sectioned buildings
// (an inn, a smithy, a shrine) stand along one road in open wilderness;
// everything else falls through to procedural generation (see world.js getTile).
//
// The full Mirecross-centred map was wiped to clear visual clutter; the rich
// original is preserved in handcrafted-tiles.legacy.js (not imported). Restore
// it by copying that file back over this one.
//
// Coordinates are axial (pointy-top hex), ~250m each. Buildings are authored as
// linked footprints in data/sealed-structures.js (entry + outside + links); the
// auto-application at the bottom of this file compiles them into the `doors`
// graph the engine enforces (world.js edgeAllowed / findPath) and the map draws
// as walls. Every building's entry opens onto a road hex.

import { SEALED_STRUCTURES } from "./sealed-structures.js";

const HEX_DIRS = [
  { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: -1 },
  { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 1 },
];

const DROWNED_RAT = {
  parent: "drowned-rat",
  parentName: "The Drowned Rat",
  type: "inn",
  name: "The Drowned Rat",
  service: "tavern",
};

const ROADSIDE_SMITHY = {
  parent: "roadside-smithy",
  parentName: "The Roadside Smithy",
  type: "smithy",
  name: "The Roadside Smithy",
  service: "blacksmith",
};

const WAYSIDE_SHRINE = {
  parent: "wayside-shrine",
  parentName: "The Wayside Shrine",
  type: "shrine",
  name: "The Wayside Shrine",
};

export const HANDCRAFTED = {
  // ============================================================
  // THE ROAD — a lone track running north–south through the wilds. The three
  // buildings face it; everything off the lane is procedural country.
  // ============================================================
  "-1,-3": { terrain: "road", poi: null },
  "-1,-2": { terrain: "road", poi: null },
  "-1,-1": { terrain: "road", poi: null },
  "-1,0":  { terrain: "road", poi: { type: "landmark", name: "The Crossing", description: "Where the track passes the inn — wheel-ruts, a horse-trough, and a leaning signpost no one has repainted in years." } },
  "-1,1":  { terrain: "road", poi: null },
  "-1,2":  { terrain: "road", poi: null },
  "-1,3":  { terrain: "road", poi: null },

  // ============================================================
  // THE DROWNED RAT — a lone roadside inn (east of the lane). Common room is the
  // only door; the yard, stable, and guest rooms open off it.
  // ============================================================
  "0,0":  { terrain: "indoor", poi: { ...DROWNED_RAT, part: "common-room", partName: "Common Room", access: "public", description: "The public belly of the Drowned Rat: benches, trestles, road-mud, smoke-dark beams, a long oak bar with the innkeeper's reach over the room, and every conversation trying to be overheard by someone else." } },
  "1,0":  { terrain: "indoor", poi: { ...DROWNED_RAT, part: "yard", partName: "Yard", access: "restricted", description: "The inn's working yard behind the common room: a cart-rut of mud and ale-slop, stacked barrels, ash buckets, a chained dog, and deliveries that arrive before the road is awake." } },
  "1,-1": { terrain: "indoor", poi: { ...DROWNED_RAT, part: "stable", partName: "Stable", access: "guarded", description: "A low timber stable off the yard — six close stalls, damp straw, restless travel-beasts, cracked harness on the wall, and a stick-thin boy who sleeps in the loft to mind them." } },
  "0,-1": { terrain: "indoor", poi: { ...DROWNED_RAT, part: "guest-rooms", partName: "Guest Rooms", access: "guarded", description: "Rented rooms behind the taproom: rope beds, shuttered windows, a shared piss-pot, and walls thin enough to learn a neighbour's business. The only stair up runs through the common room below." } },

  // ============================================================
  // THE ROADSIDE SMITHY (west of the lane). Forge floor is the door; the work
  // yard and sales bench open off it.
  // ============================================================
  "-2,2": { terrain: "indoor", poi: { ...ROADSIDE_SMITHY, part: "forge-floor", partName: "Forge Floor", access: "public", description: "The smith's heat-lit floor: a banked forge, an anvil worn bright, a quench barrel, tongs racked on the wall, and hammer-rhythm carrying out to the road." } },
  "-3,2": { terrain: "indoor", poi: { ...ROADSIDE_SMITHY, part: "work-yard", partName: "Work Yard", access: "guarded", description: "Scrap iron, charcoal sacks, broken wagon-rims, and a slack-tub nobody crosses barefoot — the working back of the smithy." } },
  "-2,3": { terrain: "indoor", poi: { ...ROADSIDE_SMITHY, part: "sales-bench", partName: "Sales Bench", access: "public", description: "Finished hooks, knives, hinge-iron, cheap blades, and repairs tagged in charcoal on a bench by the door where coin changes hands." } },

  // ============================================================
  // THE WAYSIDE SHRINE (west of the lane). Nave is the door; the vestry opens
  // off it.
  // ============================================================
  "-2,-2": { terrain: "indoor", poi: { ...WAYSIDE_SHRINE, part: "nave", partName: "Nave", access: "public", description: "A small roadside chapel: a stone altar, guttering tallow candles, a worn kneeling-rail, and the names of the road's dead scratched into the plaster." } },
  "-2,-3": { terrain: "indoor", poi: { ...WAYSIDE_SHRINE, part: "vestry", partName: "Vestry", access: "restricted", description: "The keeper's back room — a cot, a strongbox for the offering coin, drying herbs, and a narrow window onto the empty fields behind." } },
};

// Auto-apply `doors` to sealed structures (see world.js edgeAllowed / findPath:
// the engine blocks crossing any edge to a hex not in a tile's door list). Two
// authoring shapes are supported (see data/sealed-structures.js):
//
//   - threshold + interior: every interior hex opens to all of its in-structure
//     neighbours (a fully-connected interior). Good for dungeons and wards.
//
//   - entry + outside + links: a building whose interior connectivity is an
//     explicit graph. Each hex opens ONLY to its linked neighbours, and the
//     entry hex additionally opens to its `outside` road hex.
function setDoors(key, doors) {
  const tile = HANDCRAFTED[key];
  if (!tile) return; // soft-fail: structure-list out of sync with tiles
  HANDCRAFTED[key] = { ...tile, doors };
}

function adjacentHex(a, b) {
  return HEX_DIRS.some((d) => a.x + d.x === b.x && a.y + d.y === b.y);
}

function applyMeshDoors(s) {
  const all = new Set([...s.threshold, ...s.interior].map((c) => `${c.x},${c.y}`));
  for (const c of s.interior) {
    const doors = [];
    for (const d of HEX_DIRS) {
      const nk = `${c.x + d.x},${c.y + d.y}`;
      if (all.has(nk)) doors.push({ x: c.x + d.x, y: c.y + d.y });
    }
    setDoors(`${c.x},${c.y}`, doors);
  }
}

function applyLinkedDoors(s) {
  const doorsByKey = new Map(); // key -> Map(neighbourKey -> {x,y})
  const link = (a, b) => {
    if (!adjacentHex(a, b)) {
      throw new Error(`Footprint "${s.name}": link ${a.x},${a.y} <-> ${b.x},${b.y} is not between adjacent hexes`);
    }
    const ka = `${a.x},${a.y}`;
    if (!doorsByKey.has(ka)) doorsByKey.set(ka, new Map());
    doorsByKey.get(ka).set(`${b.x},${b.y}`, { x: b.x, y: b.y });
  };
  for (const [a, b] of s.links) { link(a, b); link(b, a); }
  if (s.entry && s.outside) link(s.entry, s.outside); // the door out to the road

  // Connectivity guard: every member hex must be reachable from the entry
  // through the link graph (the outside road hex is not a member).
  const outsideKey = s.outside ? `${s.outside.x},${s.outside.y}` : null;
  const members = new Set([...doorsByKey.keys()].filter((k) => k !== outsideKey));
  if (s.entry) {
    const start = `${s.entry.x},${s.entry.y}`;
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      for (const nb of (doorsByKey.get(stack.pop())?.keys() || [])) {
        if (members.has(nb) && !seen.has(nb)) { seen.add(nb); stack.push(nb); }
      }
    }
    for (const m of members) {
      if (!seen.has(m)) throw new Error(`Footprint "${s.name}": ${m} is not reachable from the entry`);
    }
  }

  // Convention guard: a sectioned building's entry must open onto a road hex.
  if (outsideKey && HANDCRAFTED[outsideKey]?.terrain !== "road") {
    console.warn(`Footprint "${s.name}": entry opens onto ${outsideKey}, which is not a road hex`);
  }

  for (const [key, nbs] of doorsByKey) {
    if (key === outsideKey) continue; // the road keeps its default-open doors
    setDoors(key, [...nbs.values()]);
  }
}

for (const s of SEALED_STRUCTURES) {
  if (s.links) applyLinkedDoors(s);
  else applyMeshDoors(s);
}
