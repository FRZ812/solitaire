// Hex grid (axial coordinates, pointy-top).
// We keep the field names {x, y} on tile/coord objects rather than {q, r} so the
// rest of the codebase doesn't need to be touched — but everywhere they're used,
// x is the axial q (column-ish, shifts the row by q/2) and y is the axial r
// (row, the dominant vertical axis).
//
// Axial helpers below give 6-neighbor adjacency, hex distance, and hex-shaped
// sight. squareToAxial() exists only to migrate legacy v10 saves that were
// authored under square-grid semantics.

import { TERRAINS } from "../data/terrains.js";
import { HANDCRAFTED } from "../data/handcrafted-tiles.js";
import { RUMORED } from "../data/rumored.js";
import { FABLED_BY_COORD } from "../data/fabled.js";
import { RIVER_BY_COORD } from "../data/rivers.js";
import { getBiome } from "../data/biomes.js";
import { SIGHT_RADIUS, TRAVEL_BASE_MIN, FLY_MIN_PER_HEX } from "../config.js";
import { poiPlaceName } from "./location.js";

// Settlements for city/village/fortress; water for lakes and rivers; otherwise
// keep procedural terrain so a "ruin" can sit on hills, plains, or marsh
// depending on where it falls.
function terrainForLandmarkKind(kind) {
  if (kind === "city" || kind === "village" || kind === "fortress") return "settlement";
  if (kind === "lake" || kind === "river") return "water";
  if (kind === "mountains") return "mountains";
  return null;
}

function tileFromLandmark(landmark, fallbackTerrain) {
  return {
    terrain: terrainForLandmarkKind(landmark.kind) || fallbackTerrain,
    poi: { type: landmark.kind, name: landmark.name, description: landmark.description },
  };
}

// Axial direction vectors for pointy-top hexes, in canonical order:
// E, NE, NW, W, SW, SE.
export const HEX_DIRECTIONS = [
  { x:  1, y:  0 },
  { x:  1, y: -1 },
  { x:  0, y: -1 },
  { x: -1, y:  0 },
  { x: -1, y:  1 },
  { x:  0, y:  1 },
];

export function hexNeighbors(x, y) {
  return HEX_DIRECTIONS.map(d => ({ x: x + d.x, y: y + d.y }));
}

// Axial distance: (|q| + |r| + |q+r|) / 2.
export function hexDistance(a, b) {
  const dq = a.x - b.x;
  const dr = a.y - b.y;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

// Convert legacy v10 square (odd-r offset) coords to axial. Used once during
// legacy-import; not part of normal runtime. With odd-r offset, odd rows are
// shifted right by half a hex; we undo that by subtracting (r - (r&1))/2 from x.
export function squareToAxial(x, y) {
  const r = y;
  const q = x - ((r - (r & 1)) >> 1);
  return { x: q, y: r };
}

// Stable per-tile hash for deterministic procedural generation.
function tileHash(x, y) {
  let h = ((x | 0) * 73856093) ^ ((y | 0) * 19349663) ^ 0x1f1f1f1f;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

// Value noise with smooth bilinear interpolation between integer corners.
// Each `seed` offsets the hash so different noise channels (elevation vs
// moisture) don't correlate. Returns 0..1.
function valueNoise(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const sX = seed * 73856;
  const sY = seed * 19349;
  const a = tileHash(x0 + sX,     y0 + sY);
  const b = tileHash(x0 + 1 + sX, y0 + sY);
  const c = tileHash(x0 + sX,     y0 + 1 + sY);
  const d = tileHash(x0 + 1 + sX, y0 + 1 + sY);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

// 3-octave fractional Brownian motion — sum of progressively finer noise.
// Produces blobby fields with both large and small features.
function fbm(x, y, seed) {
  let total = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < 3; i++) {
    total += valueNoise(x * freq, y * freq, seed + i) * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return total / max;
}

// Pick a terrain from two noise channels (elevation and moisture) using
// biome-specific thresholds. Water is no longer procedural — rivers and
// lakes are explicit (data/rivers.js and the handcrafted lake POIs).
function selectTerrainFromNoise(biome, elev, moist) {
  // Far Wild defaults
  let marshMaxElev   = 0.32;
  let marshMinMoist  = 0.55;
  let mountainsMin   = 0.78;
  let hillsMin       = 0.58;
  let forestMinMoist = 0.55;

  switch (biome.id) {
    case "mire":
      marshMaxElev = 0.55;  marshMinMoist = 0.30;
      hillsMin     = 0.78;  mountainsMin  = 0.99;
      forestMinMoist = 0.55;
      break;
    case "tannic-wood":
      forestMinMoist = 0.28;
      hillsMin = 0.68; mountainsMin = 0.90;
      marshMinMoist = 0.65;
      break;
    case "crowsmoor-reach":
      marshMinMoist = 0.78; forestMinMoist = 0.70;
      hillsMin = 0.66; mountainsMin = 0.92;
      break;
    case "whitemarch-march":
      marshMinMoist = 0.82; forestMinMoist = 0.62;
      hillsMin = 0.50; mountainsMin = 0.84;
      break;
    case "spine-foothills":
      marshMinMoist = 0.92; forestMinMoist = 0.55;
      hillsMin = 0.32; mountainsMin = 0.66;
      break;
    case "bramblewych-reach":
      marshMaxElev = 0.40; marshMinMoist = 0.55;
      forestMinMoist = 0.38;
      hillsMin = 0.66; mountainsMin = 0.94;
      break;
    // far-wild keeps defaults
  }

  if (elev > mountainsMin) return "mountains";
  if (elev > hillsMin)     return "hills";
  if (elev < marshMaxElev && moist > marshMinMoist) return "marsh";
  if (moist > forestMinMoist) return "forest";
  return "plains";
}

function generateTile(x, y) {
  const biome = getBiome(x, y);
  // Two slightly different scales so elevation and moisture don't form the
  // same blobs — terrain feels less repetitive at zoom-out.
  const elev  = fbm(x * 0.08, y * 0.08, 0);
  const moist = fbm(x * 0.11, y * 0.11, 47);
  const terrain = selectTerrainFromNoise(biome, elev, moist);
  const r2 = tileHash(x + 1031, y - 2017);
  let poi = null;
  if (r2 < (biome.poiChance ?? 0.06)) poi = { type: "hidden", description: null };
  return { terrain, poi };
}

export function getTile(state, x, y) {
  const key = `${x},${y}`;
  const visited = state.world.tiles[key];
  // Authored content wins over a saved snapshot, so edits to the handcrafted map
  // show up in games started before the change (a saved tile would otherwise
  // shadow it forever). Carry over only the dynamic per-tile fields the game
  // writes at runtime: narrator location status and generated shop stock.
  if (HANDCRAFTED[key]) {
    if (visited && (visited.status || visited.shop)) {
      return {
        ...HANDCRAFTED[key],
        ...(visited.status ? { status: visited.status } : {}),
        ...(visited.shop ? { shop: visited.shop } : {}),
      };
    }
    return HANDCRAFTED[key];
  }
  if (visited) return visited;
  // Rivers are continuous water-terrain features. Always water; POI carries
  // the river's name/description so tapping a river tile names it.
  const river = RIVER_BY_COORD[key];
  if (river) {
    return {
      terrain: "water",
      poi: { type: "river", name: river.name, description: river.description },
    };
  }
  // Rumored and fabled landmarks become real tiles. Their terrain is forced
  // for cities/water; for ruins we keep whatever the surrounding procedural
  // generation produced so a barrow stays on its actual ground.
  const rumored = RUMORED[key];
  if (rumored) {
    const procedural = generateTile(x, y);
    return tileFromLandmark(rumored, procedural.terrain);
  }
  const fabled = FABLED_BY_COORD[key];
  if (fabled) {
    const procedural = generateTile(x, y);
    return tileFromLandmark(fabled, procedural.terrain);
  }
  return generateTile(x, y);
}

export function isSeen(state, x, y)   { return state.world.seen[`${x},${y}`] === true; }
export function isVisited(state, x, y){ return !!state.world.tiles[`${x},${y}`]; }

// Hex-shaped neighborhood: all axial coords within SIGHT_RADIUS by hex distance.
export function computeSightFrom(cx, cy, existing = {}) {
  return computeSightFromRadius(cx, cy, SIGHT_RADIUS, existing);
}

// Vista variant: same hex-neighborhood logic, with an explicit radius.
// Called from handleTravel when arriving at a tile that carries vistaRadius,
// so high points (knolls, towers, mountain passes) take in much more than
// normal eye-level sight.
export function computeSightFromRadius(cx, cy, radius, existing = {}) {
  const out = { ...existing };
  const R = Math.max(0, radius | 0);
  for (let dq = -R; dq <= R; dq++) {
    const drLow = Math.max(-R, -dq - R);
    const drHigh = Math.min(R, -dq + R);
    for (let dr = drLow; dr <= drHigh; dr++) {
      out[`${cx + dq},${cy + dr}`] = true;
    }
  }
  return out;
}

export function travelMinutes(fromT, toT) {
  const s1 = TERRAINS[fromT.terrain]?.speed ?? 1.0;
  const s2 = TERRAINS[toT.terrain]?.speed ?? 1.0;
  return Math.max(1, Math.round(TRAVEL_BASE_MIN * (s1 + s2) / 2));
}

// Hex 6-neighbor adjacency.
export function isAdjacent(a, b) {
  return hexDistance(a, b) === 1;
}

export function isPassable(tile) {
  return tile.terrain !== "water";
}

// Access control — doors. A tile may declare `doors: [{x,y}, ...]` listing
// the neighbors that are valid entry/exit points. Default (no `doors`
// field): every adjacent passable hex is open, which is what wilderness
// and open settlements want. Interior tiles of a structure list only the
// neighbors inside the same structure plus the threshold(s); this seals
// the structure against ad-hoc wall-crossings.
//
// The engine enforces doors on map travel (findPath). Narrator-driven
// "extreme" entry — scaling, breaching, teleporting — bypasses this via
// the `tile_move` beat field (see engine/beat.js).
//
// An edge between A and B is traversable iff BOTH ends permit it:
// each end either has no `doors` (default open) or includes the other
// in its list.
export function hasDoorTo(tile, toX, toY) {
  if (!tile || !tile.doors) return true;
  return tile.doors.some(d => d.x === toX && d.y === toY);
}

export function edgeAllowed(fromTile, fromX, fromY, toTile, toX, toY) {
  return hasDoorTo(fromTile, toX, toY) && hasDoorTo(toTile, fromX, fromY);
}

export function currentLocationName(state) {
  const t = getTile(state, state.world.currentTile.x, state.world.currentTile.y);
  return poiPlaceName(t.poi) || TERRAINS[t.terrain]?.label || "Wilderness";
}

// A* over the seen, passable hex graph. Returns an array including both
// endpoints, or null if no route exists. Player can only path through tiles
// they have seen — exploration is required to plan routes.
export function findPath(state, from, to) {
  if (from.x === to.x && from.y === to.y) return [{ x: from.x, y: from.y }];
  if (!isSeen(state, to.x, to.y)) return null;
  const destTile = getTile(state, to.x, to.y);
  if (!isPassable(destTile)) return null;

  const startKey = `${from.x},${from.y}`;
  const goalKey = `${to.x},${to.y}`;

  const open = new Map(); // key → { x, y, g, f }
  const cameFrom = new Map();
  const gScore = new Map();

  open.set(startKey, { x: from.x, y: from.y, g: 0, f: hexDistance(from, to) });
  gScore.set(startKey, 0);

  while (open.size > 0) {
    // Linear scan for min-f. Seen-tile counts are small enough that a heap
    // isn't worth it.
    let curKey = null;
    let curF = Infinity;
    for (const [k, v] of open) {
      if (v.f < curF) { curKey = k; curF = v.f; }
    }
    const cur = open.get(curKey);

    if (curKey === goalKey) {
      const path = [{ x: cur.x, y: cur.y }];
      let k = curKey;
      while (cameFrom.has(k)) {
        const p = cameFrom.get(k);
        path.unshift({ x: p.x, y: p.y });
        k = `${p.x},${p.y}`;
      }
      return path;
    }

    open.delete(curKey);

    const curTile = getTile(state, cur.x, cur.y);
    for (const d of HEX_DIRECTIONS) {
      const nx = cur.x + d.x;
      const ny = cur.y + d.y;
      const nKey = `${nx},${ny}`;
      if (!isSeen(state, nx, ny)) continue;
      const nTile = getTile(state, nx, ny);
      if (!isPassable(nTile)) continue;
      if (!edgeAllowed(curTile, cur.x, cur.y, nTile, nx, ny)) continue;
      const tentativeG = cur.g + travelMinutes(curTile, nTile);
      if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
        cameFrom.set(nKey, { x: cur.x, y: cur.y });
        gScore.set(nKey, tentativeG);
        const f = tentativeG + hexDistance({ x: nx, y: ny }, to);
        open.set(nKey, { x: nx, y: ny, g: tentativeG, f });
      }
    }
  }
  return null;
}

// Sum of per-step travelMinutes for the path (entering each subsequent tile).
export function pathMinutes(state, path) {
  if (!path || path.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const from = getTile(state, path[i - 1].x, path[i - 1].y);
    const to = getTile(state, path[i].x, path[i].y);
    total += travelMinutes(from, to);
  }
  return total;
}

// ---- Flight & teleport travel (engine for the Fly/Gate spells) ----

// A straight hex line from→to (cube interpolation), crossing ANYTHING — flight
// ignores passability and terrain. Capped to `maxHexes` so a fly leg is bounded.
export function flightPath(from, to, maxHexes = Infinity) {
  const dist = hexDistance(from, to);
  if (dist === 0) return [{ x: from.x, y: from.y }];
  const steps = Math.min(dist, maxHexes);
  const az = -from.x - from.y, bz = -to.x - to.y; // cube z for each end
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / dist; // interpolate toward the true destination, then take `steps` of it
    let qx = from.x + (to.x - from.x) * t;
    let qy = from.y + (to.y - from.y) * t;
    let qz = az + (bz - az) * t;
    // cube round
    let rx = Math.round(qx), ry = Math.round(qy), rz = Math.round(qz);
    const dx = Math.abs(rx - qx), dy = Math.abs(ry - qy), dz = Math.abs(rz - qz);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
    out.push({ x: rx, y: ry });
  }
  return out;
}

// Flat, fast air time — ignores terrain speed entirely.
export function flightMinutes(path) {
  return Math.max(1, (Math.max(0, (path?.length || 1) - 1)) * FLY_MIN_PER_HEX);
}

// Places a Gate/Dimension Door may target: everywhere the player has VISITED,
// plus RUMORED named landmarks they know of (gating there lands them blind),
// plus any active quest marker. Returns [{ x, y, name, type }].
export function validTeleportAnchors(state) {
  const out = [];
  const seenKeys = new Set();
  const add = (x, y, name, type) => { const k = `${x},${y}`; if (seenKeys.has(k)) return; seenKeys.add(k); out.push({ x, y, name, type }); };
  for (const key of Object.keys(state.world.tiles || {})) {
    const [x, y] = key.split(",").map(Number);
    const t = state.world.tiles[key];
    add(x, y, t?.poi?.name || null, "visited");
  }
  for (const key of Object.keys(RUMORED)) {
    const [x, y] = key.split(",").map(Number);
    add(x, y, RUMORED[key].name, "rumored");
  }
  for (const q of (state.world.quests || [])) {
    if (q.status === "active" && q.loc) add(q.loc.x, q.loc.y, q.locName || q.title, "quest");
  }
  return out;
}

export function isTeleportAnchor(state, x, y) {
  if (isVisited(state, x, y)) return true;
  if (RUMORED[`${x},${y}`]) return true;
  return (state.world.quests || []).some((q) => q.status === "active" && q.loc && q.loc.x === x && q.loc.y === y);
}
