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
import { HANDCRAFTED } from "../data/handcrafted-map.js";
import { RUMORED } from "../data/rumored.js";
import { FABLED_BY_COORD } from "../data/fabled.js";
import { RIVER_BY_COORD } from "../data/rivers.js";
import { DEFAULT_WORLD_SEED } from "../data/continent.js";
import { SIGHT_RADIUS, TRAVEL_BASE_MIN, FLY_MIN_PER_HEX } from "../config.js";
import { poiFootprintName, poiPartName, poiPlaceName } from "./location.js";
import { CONTINENT_ROUTE_CELLS, generateWorldTile } from "./world-generation.js";

// Settlements for city/village/fortress; water for lakes and rivers; otherwise
// keep procedural terrain so a "ruin" can sit on hills, plains, or marsh
// depending on where it falls.
function terrainForLandmarkKind(kind) {
  if (kind === "city" || kind === "village" || kind === "fortress") return "settlement";
  if (kind === "lake" || kind === "river") return "water";
  if (kind === "mountains") return "mountains";
  return null;
}

function tileFromLandmark(landmark, generated) {
  return {
    ...generated,
    authoredFeatureId: landmark.id,
    terrain: terrainForLandmarkKind(landmark.kind) || generated.terrain,
    poi: { type: landmark.kind, name: landmark.name, description: landmark.description, landmarkId: landmark.id },
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

// Long journeys search a sparse, reviewed expedition corridor first: the
// continental roads plus the authored Whitemarch graph that joins their mouths.
// Local and off-road destinations still use the full generated hex field.
const EXPEDITION_ROUTE_KEYS = new Set(
  CONTINENT_ROUTE_CELLS.map(({ x, y }) => `${x},${y}`),
);
let cachedHandcraftedCount = -1;
let cachedExpeditionBase = EXPEDITION_ROUTE_KEYS;

function addCorridorRadius(keys, x, y, radius) {
  for (let dq = -radius; dq <= radius; dq++) {
    const drLow = Math.max(-radius, -dq - radius);
    const drHigh = Math.min(radius, -dq + radius);
    for (let dr = drLow; dr <= drHigh; dr++) {
      keys.add(`${x + dq},${y + dr}`);
    }
  }
}

function expeditionBaseKeys() {
  // HANDCRAFTED is hydrated in place before the app mounts, after this module is
  // evaluated. Rebuild lazily when that mutable registry changes.
  const handcraftedKeys = Object.keys(HANDCRAFTED);
  if (handcraftedKeys.length === cachedHandcraftedCount) return cachedExpeditionBase;
  const keys = new Set(EXPEDITION_ROUTE_KEYS);
  for (const key of handcraftedKeys) {
    const [x, y] = key.split(",").map(Number);
    addCorridorRadius(keys, x, y, 4);
  }
  cachedHandcraftedCount = handcraftedKeys.length;
  cachedExpeditionBase = keys;
  return keys;
}

function connectCoordinateToCorridor(keys, coordinate) {
  let nearest = Infinity;
  for (const road of CONTINENT_ROUTE_CELLS) {
    nearest = Math.min(nearest, hexDistance(coordinate, road));
  }
  // A bounded apron lets a party standing near a road reach it through actual
  // generated terrain. Deep off-road starts fall back to the open-world search.
  if (nearest <= 48) addCorridorRadius(keys, coordinate.x, coordinate.y, nearest + 2);
}

function expeditionCorridorKeys(from, to) {
  const keys = new Set(expeditionBaseKeys());
  connectCoordinateToCorridor(keys, from);
  connectCoordinateToCorridor(keys, to);
  return keys;
}

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

function generateTile(state, x, y) {
  return generateWorldTile({ x, y, seed: state?.world?.seed || DEFAULT_WORLD_SEED });
}

// Campaigns persist only discoveries and dynamic consequences for generated
// tiles. Old saves may still contain a full procedural snapshot; rebase those
// fields onto the current generator so explored and unexplored ground cannot
// develop a version seam.
function mergeProceduralDelta(generated, visited) {
  if (!visited) return generated;
  const dynamic = {};
  for (const field of ["status", "shop", "aerialSighting", "cache"]) {
    if (visited[field] !== undefined) dynamic[field] = visited[field];
  }
  const discoveredPoi = !generated.authoredFeatureId && visited.poi && visited.poi.type !== "hidden" ? visited.poi : null;
  return {
    ...generated,
    ...dynamic,
    ...(discoveredPoi ? { poi: discoveredPoi } : {}),
    visited: true,
  };
}

// Compact persistence representation for a lazily generated tile. It records
// that the party visited plus discoveries/consequences, never the regenerated
// climate/terrain payload itself. Authored tiles remain complete objects.
export function persistedTileDelta(tile, overrides = {}) {
  if (!tile?.procedural) return { ...tile, ...overrides };
  const delta = { proceduralDelta: true, visited: true };
  if (!tile.authoredFeatureId && tile.poi && tile.poi.type !== "hidden") delta.poi = tile.poi;
  for (const field of ["status", "shop", "aerialSighting", "cache"]) {
    if (tile[field] !== undefined) delta[field] = tile[field];
  }
  return { ...delta, ...overrides };
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
  const generated = generateTile(state, x, y);
  let canonical = generated;
  // Rivers are continuous water-terrain features. Always water; POI carries
  // the river's name/description so tapping a river tile names it.
  const river = RIVER_BY_COORD[key];
  if (river) {
    canonical = {
      ...generated,
      authoredFeatureId: river.id || key,
      terrain: "water",
      poi: { type: "river", name: river.name, description: river.description },
    };
  }
  // Rumored and fabled landmarks become real tiles. Their terrain is forced
  // for cities/water; for ruins we keep whatever the surrounding procedural
  // generation produced so a barrow stays on its actual ground.
  const rumored = RUMORED[key];
  if (rumored) {
    canonical = tileFromLandmark(rumored, generated);
  }
  const fabled = FABLED_BY_COORD[key];
  if (fabled) {
    canonical = tileFromLandmark(fabled, generated);
  }
  if (visited) {
    if (visited.procedural || visited.proceduralDelta || !visited.terrain) {
      return mergeProceduralDelta(canonical, visited);
    }
    return visited;
  }
  return canonical;
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
  if (!tile) return false;
  if (tile.terrain === "water" || tile.terrain === "impassable") return false;
  return true;
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
  // Authored macro-road stubs from the legacy compiler may carry materialized
  // doors only to other authored cells. Let a road/settlement mouth join the
  // generated continental route that actually continues it; walls and every
  // other explicit boundary retain strict reciprocal door checks.
  const routeMouthTerrain = (tile) => ["road", "street", "settlement"].includes(tile?.terrain);
  const routeId = (tile) => typeof tile?.route === "string" ? tile.route : tile?.route?.id;
  const joinsDeclaredMouth = (mouth, mouthX, mouthY, world, worldX, worldY) => {
    const seam = mouth?.routeMouth || mouth?.atlasRouteMouth;
    return !!seam
      && world?.procedural === true
      && routeMouthTerrain(mouth)
      && hasDoorTo(mouth, worldX, worldY)
      && seam.routeId === routeId(mouth)
      && seam.routeId === routeId(world);
  };

  // A city/continent seam is exceptional only on its explicitly-authored
  // outside edge and only when both sides name the same macro route.
  if ((fromTile?.routeMouth || fromTile?.atlasRouteMouth) && toTile?.procedural) {
    return joinsDeclaredMouth(fromTile, fromX, fromY, toTile, toX, toY);
  }
  if ((toTile?.routeMouth || toTile?.atlasRouteMouth) && fromTile?.procedural) {
    return joinsDeclaredMouth(toTile, toX, toY, fromTile, fromX, fromY);
  }
  return hasDoorTo(fromTile, toX, toY) && hasDoorTo(toTile, fromX, fromY);
}

export function currentLocationName(state) {
  const t = getTile(state, state.world.currentTile.x, state.world.currentTile.y);
  const localName = poiPlaceName(t.poi);
  if (t.cityId === "whitemarch") {
    const district = t.districtName || t.poi?.districtName || null;
    const footprint = poiFootprintName(t.poi);
    const normalize = (value) => String(value || "").toLowerCase().replace(/^the\s+/, "").trim();
    const detail = district && footprint && normalize(district) === normalize(footprint)
      ? (poiPartName(t.poi) || t.poi?.name || localName)
      : localName;
    const names = ["Whitemarch", district, detail].filter(Boolean);
    const unique = names.filter((name, index) => (
      names.findIndex((candidate) => candidate.toLowerCase() === name.toLowerCase()) === index
    ));
    return unique.join(" — ");
  }
  return localName || TERRAINS[t.terrain]?.label || "Wilderness";
}

// Go-anywhere world route: a terrain-aware greedy march from `from` toward `to`,
// one hex at a time. Unlike findPath it does NOT require tiles to have been seen
// (you can set a course for anywhere) and it routes around impassable water. The
// caller marches the returned hexes, rolling movement + encounters per step and
// halting on the first encounter — so this only needs to be a sane heading, not a
// proven shortest path. A stagnation guard stops it spinning in a concavity.
export function marchRoute(state, from, to, maxHexes = 400) {
  const route = [{ x: from.x, y: from.y }];
  if (from.x === to.x && from.y === to.y) return route;
  let cur = { x: from.x, y: from.y };
  let prevKey = null;
  let bestEver = hexDistance(from, to);
  let stale = 0;
  for (let i = 0; i < maxHexes; i++) {
    let best = null, bestDist = Infinity;
    for (const d of HEX_DIRECTIONS) {
      const nx = cur.x + d.x, ny = cur.y + d.y;
      const key = `${nx},${ny}`;
      if (key === prevKey) continue;                 // no immediate U-turn
      if (!isPassable(getTile(state, nx, ny))) continue;
      const dist = hexDistance({ x: nx, y: ny }, to);
      if (dist < bestDist) { bestDist = dist; best = { x: nx, y: ny }; }
    }
    if (!best) break;                                 // boxed in (water) — stop here
    prevKey = `${cur.x},${cur.y}`;
    cur = best;
    route.push({ x: cur.x, y: cur.y });
    if (cur.x === to.x && cur.y === to.y) break;      // arrived
    if (bestDist < bestEver) { bestEver = bestDist; stale = 0; }
    else if (++stale > 12) break;                     // not getting closer — give up
  }
  return route;
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

// Canonical route planner for the expedition atlas and actual travel. Unlike
// findPath, it may cross authored route tiles that have not been seen yet, so a
// player can follow a road into the unknown. Unlike the old greedy marchRoute,
// it uses the real door graph and can navigate forks, doglegs, and dead ends
// without walking through a closed boundary.
//
// Axial coordinates remain an engine detail. The atlas presents the result as a
// trail between landmarks, but saves, quests, encounters, and narrator tools all
// continue to consume the same coordinate path.
class RouteMinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(value) {
    const items = this.items;
    items.push(value);
    let index = items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (items[parent].f <= value.f) break;
      items[index] = items[parent];
      index = parent;
    }
    items[index] = value;
  }
  pop() {
    const items = this.items;
    if (!items.length) return null;
    const root = items[0];
    const tail = items.pop();
    if (items.length) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        if (left >= items.length) break;
        const right = left + 1;
        const child = right < items.length && items[right].f < items[left].f ? right : left;
        if (items[child].f >= tail.f) break;
        items[index] = items[child];
        index = child;
      }
      items[index] = tail;
    }
    return root;
  }
}

function reconstructWorldRoute(cameFrom, current) {
  const path = [{ x: current.x, y: current.y }];
  let key = current.key;
  while (cameFrom.has(key)) {
    const previous = cameFrom.get(key);
    path.unshift({ x: previous.x, y: previous.y });
    key = `${previous.x},${previous.y}`;
  }
  return path;
}

function searchWorldRoute({ from, to, maxVisited, tileAt, allowedKeys = null, heuristicWeight = 2.25 }) {
  const startKey = `${from.x},${from.y}`;
  const goalKey = `${to.x},${to.y}`;
  const minimumStep = Math.max(1, Math.round(TRAVEL_BASE_MIN * 0.4));
  const heuristic = (coord) => hexDistance(coord, to) * minimumStep;
  const open = new RouteMinHeap();
  open.push({ key: startKey, x: from.x, y: from.y, g: 0, f: heuristic(from) * heuristicWeight });
  const cameFrom = new Map();
  const gScore = new Map([[startKey, 0]]);
  let visited = 0;

  while (open.size > 0 && visited < maxVisited) {
    const cur = open.pop();
    const curKey = cur.key;
    if (cur.g !== gScore.get(curKey)) continue; // stale heap entry
    visited++;
    if (curKey === goalKey) return reconstructWorldRoute(cameFrom, cur);

    const curTile = tileAt(cur.x, cur.y);
    if (!isPassable(curTile)) continue;
    for (const d of HEX_DIRECTIONS) {
      const nx = cur.x + d.x;
      const ny = cur.y + d.y;
      const nextKey = `${nx},${ny}`;
      if (allowedKeys && !allowedKeys.has(nextKey)) continue;
      const nextTile = tileAt(nx, ny);
      if (!isPassable(nextTile)) continue;
      if (!edgeAllowed(curTile, cur.x, cur.y, nextTile, nx, ny)) continue;
      const tentativeG = cur.g + travelMinutes(curTile, nextTile);
      if (tentativeG >= (gScore.get(nextKey) ?? Infinity)) continue;
      cameFrom.set(nextKey, { x: cur.x, y: cur.y });
      gScore.set(nextKey, tentativeG);
      open.push({
        key: nextKey,
        x: nx,
        y: ny,
        g: tentativeG,
        f: tentativeG + heuristic({ x: nx, y: ny }) * heuristicWeight,
      });
    }
  }
  return null;
}

export function findWorldRoute(state, from, to, maxVisited = 12000) {
  if (from.x === to.x && from.y === to.y) return [{ x: from.x, y: from.y }];
  const tileCache = new Map();
  const tileAt = (x, y) => {
    const key = `${x},${y}`;
    if (!tileCache.has(key)) tileCache.set(key, getTile(state, x, y));
    return tileCache.get(key);
  };
  const destTile = tileAt(to.x, to.y);
  if (!isPassable(destTile)) return null;

  const startKey = `${from.x},${from.y}`;
  const goalKey = `${to.x},${to.y}`;
  const continentScale = hexDistance(from, to) > 48;
  const corridorKeys = continentScale ? expeditionCorridorKeys(from, to) : null;
  if (corridorKeys?.has(startKey) && corridorKeys.has(goalKey)) {
    const corridorRoute = searchWorldRoute({
      from,
      to,
      maxVisited: Math.max(maxVisited, corridorKeys.size),
      tileAt,
      allowedKeys: corridorKeys,
      heuristicWeight: 1.35,
    });
    if (corridorRoute) return corridorRoute;
  }

  // This planner sets a practical expedition course rather than proving a
  // mathematically shortest path. The weighted heuristic keeps open-country
  // searches narrow; real terrain cost still favors roads and avoids water.
  return searchWorldRoute({ from, to, maxVisited, tileAt });
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
// plus passable RUMORED named landmarks they know of (gating there lands them blind),
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
    if (isPassable(getTile(state, x, y))) add(x, y, RUMORED[key].name, "rumored");
  }
  for (const q of (state.world.quests || [])) {
    if (q.status === "active" && q.loc) add(q.loc.x, q.loc.y, q.locName || q.title, "quest");
  }
  return out;
}

export function isTeleportAnchor(state, x, y) {
  if (isVisited(state, x, y)) return true;
  if (RUMORED[`${x},${y}`] && isPassable(getTile(state, x, y))) return true;
  return (state.world.quests || []).some((q) => q.status === "active" && q.loc && q.loc.x === x && q.loc.y === y);
}
