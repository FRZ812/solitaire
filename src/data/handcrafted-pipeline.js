// Pure pipeline for resolving authored handcrafted-map data into the
// engine's `doors`-graph tile dict.
//
// Inputs:
//   - tiles: { "x,y": { terrain, poi?, doors?, perimeter?, wallside?, ... } }
//     — the authored per-tile data. May have authored per-tile `doors`
//       arrays (set via the MapEditor's Edges tool).
//   - sealedStructures: [ { name, streets?, buildings?, gates?, ... }, ... ]
//     — high-level structure descriptors. Three authoring shapes:
//       streets+buildings(+gates), interior+gates, entry+outside+links.
//
// Output (in-place on the passed-in tiles object):
//   - Wall generator fills d=1 perimeter (`terrain: "street", perimeter: true`)
//     and d=2 wall_top hexes around the city interior.
//   - SEALED_STRUCTURES auto-application sets `doors` on streets/buildings
//     per the structure rules (respecting authored tile.doors for
//     multi-door buildings — see applyStreetBuildingDoors).
//   - Post-pass bridges: city streets ↔ generated perimeter; Toll Hall ↔
//     adjacent wall-tops.
//
// This module is consumed by src/data/handcrafted-map.js (the Supabase
// load path) and by scripts/* (for offline verification). It has no I/O
// — it's the deterministic rebuild that every load runs.

const HEX_DIRS = [
  { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: -1 },
  { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 1 },
];

export function buildHandcrafted({ tiles: input, sealedStructures }) {
  // Deep-clone so callers can keep the raw input around for diffing /
  // re-rendering and the pipeline is free to mutate.
  const tiles = JSON.parse(JSON.stringify(input || {}));
  const structures = Array.isArray(sealedStructures) ? sealedStructures : [];
  // Wall generation is DISABLED. It used to auto-place a d=1 perimeter
  // ring + d=2 wall_top ring around the city core. The combination of
  // "save the full tile state to Supabase" + "perimeter tiles look like
  // interior on reload" meant each reload grew a new outer ring, then
  // froze it on save, then grew another ring out of that. Walls and
  // wall-walks are now author-only — paint them by hand in the editor.
  // Old comment in the disabled code below documents the original
  // behaviour for archaeology.
  // runWallGenerator(tiles);
  for (const s of structures) {
    if (s.streets || s.buildings) applyStreetBuildingDoors(tiles, s);
    else if (s.links) applyLinkedDoors(tiles, s);
    else applyMeshDoors(tiles, s);
  }
  // runStreetPerimeterBridge depended on perimeter:true tiles existing —
  // with the generator off, it has nothing to do. Disabled to match.
  // runStreetPerimeterBridge(tiles);
  // Auto-seal must run LAST so it can reciprocate gates and any other
  // authored doors that already point at a wall hex. See the function
  // for the full rule; the short version is "a wall with no authored
  // doors sees procedural neighbours as sealed."
  runWallAutoSeal(tiles);
  
  // Auto-connect adjacent road, street, and settlement tiles to eliminate manual door authoring overhead.
  runAutoRoadDoors(tiles);
  return tiles;
}

// Walls get sealed against the procedural world on every load. The rule
// (set by the author): "a procedurally-generated hex never opens a
// path; handcrafted rulings win." There are two cases:
//
//   A) Wall with NO authored doors. Default-open would let the engine
//      walk straight across the wall against an undefined neighbour
//      (both sides are default-open and `edgeAllowed` is fine with
//      that). We fill in a doors list now so the wall has explicit
//      permission only where it makes sense.
//
//   B) Wall WITH an authored doors array. The list is the author's
//      declaration of which edges are passable. But older bundles of
//      the editor's materialiseDoors inserted procedural neighbours
//      into the list to "preserve default-open"; those entries are
//      stale and need pruning every load. (We can't tell from a
//      coord alone whether the author meant it — but the rule is
//      categorical: procedural never opens a wall, so we strip
//      anything pointing at an undefined neighbour.)
//
// Case-A door rules:
//   1) Adjacent walls (covers wall-walk + stair tiles, since stairs
//      are walls with poi.type === "stair").
//   2) Any defined neighbour whose own doors already point AT this
//      wall — reciprocates the gatehouse bridge and any building or
//      structure that authored a door onto the wall.
//   3) If this wall is a stair, every defined neighbour (the stair
//      descends onto whatever the author placed at its foot —
//      typically a street or settlement hex).
//
// Procedural neighbours (no entry in `tiles`) are never added in
// case A and always removed in case B.
function runWallAutoSeal(tiles) {
  for (const key of Object.keys(tiles)) {
    const tile = tiles[key];
    if (!tile || tile.terrain !== "wall") continue;
    const [x, y] = key.split(",").map(Number);

    // Case B: authored doors. Keep them, but prune procedural entries.
    if (Array.isArray(tile.doors)) {
      const pruned = tile.doors.filter((d) => !!tiles[`${d.x},${d.y}`]);
      if (pruned.length !== tile.doors.length) {
        tiles[key] = { ...tile, doors: pruned };
      }
      continue;
    }

    // Case A: no authored doors. Compute from neighbours.
    const isStair = tile.poi?.type === "stair";
    const doors = [];
    for (const d of HEX_DIRS) {
      const nx = x + d.x, ny = y + d.y;
      const nk = `${nx},${ny}`;
      const nt = tiles[nk];
      if (!nt) continue;
      if (nt.terrain === "wall") { doors.push({ x: nx, y: ny }); continue; }
      if (Array.isArray(nt.doors) && nt.doors.some((dd) => dd.x === x && dd.y === y)) {
        doors.push({ x: nx, y: ny });
        continue;
      }
      if (isStair) { doors.push({ x: nx, y: ny }); continue; }
    }
    tiles[key] = { ...tile, doors };
  }
}

// ---------- helpers ----------

function setDoors(tiles, key, doors) {
  const tile = tiles[key];
  if (!tile) return; // soft-fail: structure-list out of sync with tiles
  tiles[key] = { ...tile, doors };
}

function adjacentHex(a, b) {
  return HEX_DIRS.some((d) => a.x + d.x === b.x && a.y + d.y === b.y);
}

function hexDist(ax, ay, bx, by) {
  const dq = ax - bx, dr = ay - by;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

function indexGates(s) {
  const gateDoors = new Map();
  for (const [inside, outside] of s.gates || []) {
    if (!adjacentHex(inside, outside)) {
      throw new Error(`Structure "${s.name}": gate ${inside.x},${inside.y} <-> ${outside.x},${outside.y} is not between adjacent hexes`);
    }
    const k = `${inside.x},${inside.y}`;
    if (!gateDoors.has(k)) gateDoors.set(k, []);
    gateDoors.get(k).push({ x: outside.x, y: outside.y });
  }
  return gateDoors;
}

// ---------- streets + buildings ----------

function applyStreetBuildingDoors(tiles, s) {
  const streetSet = new Set(s.streets.map((c) => `${c.x},${c.y}`));
  const buildingSet = new Set(s.buildings.map((b) => `${b.x},${b.y}`));
  for (const k of streetSet) {
    if (buildingSet.has(k)) throw new Error(`Structure "${s.name}": ${k} is listed as both a street and a building`);
  }
  const interior = new Set([...streetSet, ...buildingSet]);
  const gateDoors = indexGates(s);

  // Streets: mesh with all adjacent interior hexes.
  for (const c of s.streets) {
    const doors = [];
    for (const d of HEX_DIRS) {
      const nk = `${c.x + d.x},${c.y + d.y}`;
      if (interior.has(nk)) doors.push({ x: c.x + d.x, y: c.y + d.y });
    }
    const k = `${c.x},${c.y}`;
    if (gateDoors.has(k)) doors.push(...gateDoors.get(k));
    setDoors(tiles, k, doors);
  }

  // Buildings — layered resolution: explicit door:/doors: wins; else
  // authored tile.doors wins; else mesh-to-adjacent-streets fallback.
  // Empty doors lists are accepted (author can deliberately seal a hex).
  for (const b of s.buildings) {
    const k = `${b.x},${b.y}`;
    const tile = tiles[k];
    let doors;
    let isExplicit = false;
    if (Array.isArray(b.doors)) {
      doors = b.doors.map((p) => ({ x: p.x, y: p.y }));
      isExplicit = true;
    } else if (b.door) {
      doors = [{ x: b.door.x, y: b.door.y }];
      isExplicit = true;
    } else if (tile && Array.isArray(tile.doors)) {
      doors = tile.doors.map((d) => ({ x: d.x, y: d.y }));
    } else {
      doors = [];
      for (const d of HEX_DIRS) {
        const nk = `${b.x + d.x},${b.y + d.y}`;
        if (streetSet.has(nk)) doors.push({ x: b.x + d.x, y: b.y + d.y });
      }
    }
    if (isExplicit) {
      for (const door of doors) {
        const dk = `${door.x},${door.y}`;
        if (!streetSet.has(dk) && !buildingSet.has(dk)) {
          throw new Error(`Structure "${s.name}": building ${k} declares a door to ${dk}, which is not in the streets or buildings list`);
        }
        if (hexDist(door.x, door.y, b.x, b.y) !== 1) {
          throw new Error(`Structure "${s.name}": building ${k} declares a door to ${dk}, which is not an adjacent hex`);
        }
      }
    }
    if (gateDoors.has(k)) doors.push(...gateDoors.get(k));
    setDoors(tiles, k, doors);
  }
}

function applyMeshDoors(tiles, s) {
  const threshold = s.threshold || [];
  const all = new Set([...threshold, ...s.interior].map((c) => `${c.x},${c.y}`));
  const gateDoors = indexGates(s);
  for (const c of s.interior) {
    const doors = [];
    for (const d of HEX_DIRS) {
      const nk = `${c.x + d.x},${c.y + d.y}`;
      if (all.has(nk)) doors.push({ x: c.x + d.x, y: c.y + d.y });
    }
    const k = `${c.x},${c.y}`;
    if (gateDoors.has(k)) doors.push(...gateDoors.get(k));
    setDoors(tiles, k, doors);
  }
}

function applyLinkedDoors(tiles, s) {
  const doorsByKey = new Map();
  const link = (a, b) => {
    if (!adjacentHex(a, b)) {
      throw new Error(`Footprint "${s.name}": link ${a.x},${a.y} <-> ${b.x},${b.y} is not between adjacent hexes`);
    }
    const ka = `${a.x},${a.y}`;
    if (!doorsByKey.has(ka)) doorsByKey.set(ka, new Map());
    doorsByKey.get(ka).set(`${b.x},${b.y}`, { x: b.x, y: b.y });
  };
  for (const [a, b] of s.links) { link(a, b); link(b, a); }
  if (s.entry && s.outside) link(s.entry, s.outside);

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

  const STREET_TERRAINS = new Set(["road", "settlement", "street"]);
  const outsideTerrain = outsideKey ? tiles[outsideKey]?.terrain : null;
  if (outsideKey && !STREET_TERRAINS.has(outsideTerrain)) {
    console.warn(`Footprint "${s.name}": entry opens onto ${outsideKey}, which is not a street hex`);
  }

  for (const [key, nbs] of doorsByKey) {
    if (key === outsideKey) continue;
    setDoors(tiles, key, [...nbs.values()]);
  }
}

// ---------- wall generator ----------

function runWallGenerator(tiles) {
  // Interior for wall-distance purposes = walkable city-core ground.
  // Exclude water, road (outside the wall), the Crown Gate (sits ON the
  // ring), stairs (sit ON the ring), the Underworks (below surface), and
  // wall-side buildings (sit AT d=1 — including them would push the ring
  // outward and lump the wall around each one).
  const interiorCoords = [];
  for (const key of Object.keys(tiles)) {
    const t = tiles[key];
    if (t.terrain === "water") continue;
    if (t.terrain === "road") continue;
    if (t.poi?.parent === "whitemarch-crown-gate") continue;
    if (t.poi?.type === "stair") continue;
    if (t.poi?.area === "underworks") continue;
    if (t.wallside) continue;
    const [x, y] = key.split(",").map(Number);
    interiorCoords.push({ x, y });
  }
  if (interiorCoords.length === 0) return;

  const minDistToInterior = (x, y) => {
    let min = Infinity;
    for (const c of interiorCoords) {
      const d = hexDist(x, y, c.x, c.y);
      if (d < min) min = d;
      if (min === 0) return 0;
    }
    return min;
  };

  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (const c of interiorCoords) {
    if (c.x < xmin) xmin = c.x;
    if (c.x > xmax) xmax = c.x;
    if (c.y < ymin) ymin = c.y;
    if (c.y > ymax) ymax = c.y;
  }

  // d=1 → perimeter street; d=2 → wall_top. Beyond is procedural.
  for (let x = xmin - 3; x <= xmax + 3; x++) {
    for (let y = ymin - 3; y <= ymax + 3; y++) {
      const key = `${x},${y}`;
      if (tiles[key]) continue;
      const d = minDistToInterior(x, y);
      if (d === 1) tiles[key] = { terrain: "street", poi: null, perimeter: true };
      else if (d === 2) tiles[key] = { terrain: "wall", poi: null };
    }
  }

  // Wall-top doors: open to adjacent wall_tops + Crown Gate gatehouses;
  // stair-tagged wall_tops also open to adjacent perimeter streets.
  for (const key of Object.keys(tiles)) {
    const t = tiles[key];
    if (t.terrain !== "wall") continue;
    const [x, y] = key.split(",").map(Number);
    const isStair = t.poi?.type === "stair";
    const doors = [];
    for (const d of HEX_DIRS) {
      const nx = x + d.x, ny = y + d.y;
      const nk = `${nx},${ny}`;
      const nt = tiles[nk];
      if (!nt) continue;
      if (nt.terrain === "wall") doors.push({ x: nx, y: ny });
      else if (nt.poi?.parent === "whitemarch-crown-gate" && nt.poi?.part?.startsWith("gatehouse")) {
        doors.push({ x: nx, y: ny });
      }
      else if (isStair && nt.perimeter) doors.push({ x: nx, y: ny });
    }
    tiles[key].doors = doors;
  }

  // Perimeter-street doors: mesh with adjacent perimeter + city streets +
  // stair wall_tops + gatehouses.
  for (const key of Object.keys(tiles)) {
    const t = tiles[key];
    if (!t.perimeter) continue;
    const [x, y] = key.split(",").map(Number);
    const doors = [];
    for (const d of HEX_DIRS) {
      const nx = x + d.x, ny = y + d.y;
      const nt = tiles[`${nx},${ny}`];
      if (!nt) continue;
      if (nt.perimeter) doors.push({ x: nx, y: ny });
      else if (nt.terrain === "street") doors.push({ x: nx, y: ny });
      else if (nt.terrain === "wall" && nt.poi?.type === "stair") doors.push({ x: nx, y: ny });
      else if (nt.poi?.parent === "whitemarch-crown-gate") doors.push({ x: nx, y: ny });
    }
    tiles[key].doors = doors;
  }
}

// ---------- post-pass bridges ----------

// Re-add perimeter neighbours to every authored city street whose
// doors got rewritten by applyStreetBuildingDoors. Without this, gate-
// side perimeter tiles dropped from the structure's mesh would break
// the perimeter ring on either side of the gate.
function runStreetPerimeterBridge(tiles) {
  for (const key of Object.keys(tiles)) {
    const tile = tiles[key];
    if (tile.terrain !== "street") continue;
    if (!Array.isArray(tile.doors)) continue;
    const [x, y] = key.split(",").map(Number);
    const existing = new Set(tile.doors.map((d) => `${d.x},${d.y}`));
    const extra = [];
    for (const d of HEX_DIRS) {
      const nx = x + d.x, ny = y + d.y;
      const nk = `${nx},${ny}`;
      if (existing.has(nk)) continue;
      const nt = tiles[nk];
      if (nt && nt.perimeter) extra.push({ x: nx, y: ny });
    }
    if (extra.length) tiles[key] = { ...tile, doors: [...tile.doors, ...extra] };
  }
}

// Automatically add doors between adjacent route tiles. A named outdoor POI is
// also a route endpoint even when its ground is forest/hills/etc.; otherwise a
// road visibly reaches a ruin but the final edge remains mechanically closed.
// Indoor/wall nodes stay out of this pass so authored structure access is never
// opened accidentally.
function runAutoRoadDoors(tiles) {
  const ROAD_TERRAINS = new Set(["road", "street", "settlement"]);
  const OUTDOOR_NODE_TERRAINS = new Set(["plains", "forest", "hills", "marsh", "mountains"]);
  const isRouteTile = (tile) => !!tile && (
    ROAD_TERRAINS.has(tile.terrain)
    || (!!tile.poi?.name && OUTDOOR_NODE_TERRAINS.has(tile.terrain))
  );
  for (const key of Object.keys(tiles)) {
    const tile = tiles[key];
    if (!isRouteTile(tile)) continue;
    const [x, y] = key.split(",").map(Number);

    // Unified-map cells carry a complete reviewed edge graph. Re-running the
    // legacy convenience mesher would turn one-door shops and civic interiors
    // back into six-way pavement shortcuts.
    if (Array.isArray(tile.doors) && Number(tile.mapVersion) >= 2) continue;

    if (!Array.isArray(tile.doors)) {
      tile.doors = [];
    }

    for (const d of HEX_DIRS) {
      const nx = x + d.x, ny = y + d.y;
      const nk = `${nx},${ny}`;
      const nt = tiles[nk];

      if (isRouteTile(nt)) {
        if (!tile.doors.some((dd) => dd.x === nx && dd.y === ny)) {
          tile.doors.push({ x: nx, y: ny });
        }
      }
    }
  }
}
