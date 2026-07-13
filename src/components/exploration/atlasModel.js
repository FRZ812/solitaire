import { HANDCRAFTED } from "../../data/handcrafted-map.js";
import { TERRAINS } from "../../data/terrains.js";
import {
  HEX_DIRECTIONS,
  edgeAllowed,
  findWorldRoute,
  getTile,
  hexDistance,
  isPassable,
  isSeen,
  isVisited,
} from "../../engine/world.js";

export const ATLAS_SIZE = 2200;
export const ATLAS_CENTER = ATLAS_SIZE / 2;
// Compact cartographic projection: a ten-step road fits in the default mobile
// viewport, so the player sees meaningful destinations before needing to pan.
export const ATLAS_STEP_X = 28;
export const ATLAS_STEP_Y = 25;

export const TERRAIN_INK = {
  road: "#b98a52",
  street: "#b98a52",
  settlement: "#96734f",
  indoor: "#66513e",
  wall: "#77756f",
  plains: "#536a48",
  hills: "#6a6043",
  forest: "#29493b",
  marsh: "#365552",
  mountains: "#5c514c",
  water: "#31586b",
  impassable: "#182321",
};

export function atlasPoint(coord, origin) {
  const dx = coord.x - origin.x;
  const dy = coord.y - origin.y;
  return {
    x: ATLAS_CENTER + ATLAS_STEP_X * (dx + dy / 2),
    y: ATLAS_CENTER + ATLAS_STEP_Y * dy,
  };
}

export function coordKey(coord) {
  return `${coord.x},${coord.y}`;
}

export function parseCoord(key) {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

function stableNoise(x, y, salt = 0) {
  let h = Math.imul((x | 0) ^ salt, 0x45d9f3b) ^ Math.imul((y | 0) - salt, 0x27d4eb2d);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function terrainMark(coord, terrain) {
  const n = stableNoise(coord.x, coord.y, 71);
  return {
    rotation: Math.round((n - 0.5) * 32),
    scale: 0.85 + stableNoise(coord.x, coord.y, 13) * 0.35,
    offsetX: (stableNoise(coord.x, coord.y, 29) - 0.5) * 22,
    offsetY: (stableNoise(coord.x, coord.y, 43) - 0.5) * 18,
    color: TERRAIN_INK[terrain] || "#45534a",
  };
}

// The atlas is deliberately built from the hydrated authored graph rather than
// the fallback seed. Supabase maps, old saves, and editor changes therefore all
// appear without a second source of truth.
export function buildAtlasModel(state) {
  const origin = state.world.currentTile;
  const keys = new Set(Object.keys(HANDCRAFTED));
  for (const key of Object.keys(state.world.tiles || {})) keys.add(key);
  for (const quest of state.world.quests || []) {
    if (quest.status === "active" && quest.loc) keys.add(coordKey(quest.loc));
  }
  keys.add(coordKey(origin));

  const cells = [];
  const byKey = new Map();
  for (const key of keys) {
    const coord = parseCoord(key);
    if (!Number.isFinite(coord.x) || !Number.isFinite(coord.y)) continue;
    const tile = getTile(state, coord.x, coord.y);
    if (!isPassable(tile)) continue;
    const seen = isSeen(state, coord.x, coord.y);
    const visited = isVisited(state, coord.x, coord.y);
    const cell = {
      key,
      ...coord,
      tile,
      point: atlasPoint(coord, origin),
      seen,
      visited,
      named: !!tile.poi?.name && tile.poi.type !== "hidden" && (seen || visited),
    };
    cells.push(cell);
    byKey.set(key, cell);
  }

  // A sparse watercolor field gives the roads geographic context without
  // turning the invisible axial lattice back into visible cells.
  const terrain = [];
  const radius = 15;
  for (let dx = -radius; dx <= radius; dx += 2) {
    for (let dy = -radius; dy <= radius; dy += 2) {
      const coord = { x: origin.x + dx, y: origin.y + dy };
      if (hexDistance(origin, coord) > radius) continue;
      const tile = getTile(state, coord.x, coord.y);
      terrain.push({
        key: `terrain-${coord.x},${coord.y}`,
        ...coord,
        tile,
        point: atlasPoint(coord, origin),
        seen: isSeen(state, coord.x, coord.y),
        mark: terrainMark(coord, tile.terrain),
      });
    }
  }

  const edges = [];
  // Only the first half of the direction list is needed; the other half would
  // draw each trail twice.
  for (const cell of cells) {
    for (const d of HEX_DIRECTIONS.slice(0, 3)) {
      const next = byKey.get(`${cell.x + d.x},${cell.y + d.y}`);
      if (!next) continue;
      if (!edgeAllowed(cell.tile, cell.x, cell.y, next.tile, next.x, next.y)) continue;
      edges.push({
        key: `${cell.key}|${next.key}`,
        from: cell,
        to: next,
        seen: cell.seen && next.seen,
        visited: cell.visited && next.visited,
      });
    }
  }

  const current = byKey.get(coordKey(origin)) || {
    key: coordKey(origin), ...origin, tile: getTile(state, origin.x, origin.y),
    point: atlasPoint(origin, origin), seen: true, visited: true,
  };

  const choices = [];
  for (const d of HEX_DIRECTIONS) {
    const next = byKey.get(`${origin.x + d.x},${origin.y + d.y}`);
    if (!next) continue;
    if (!edgeAllowed(current.tile, origin.x, origin.y, next.tile, next.x, next.y)) continue;
    choices.push(next);
  }

  return { origin, cells, byKey, terrain, edges, current, choices };
}

export function planAtlasJourney(state, destination, maxLeg = 48) {
  if (!destination) return null;
  const from = state.world.currentTile;
  if (from.x === destination.x && from.y === destination.y) return null;
  const fullPath = findWorldRoute(state, from, destination);
  if (!fullPath || fullPath.length < 2) return null;
  const legPath = fullPath.slice(0, maxLeg + 1);
  const end = legPath[legPath.length - 1];
  const terrainCounts = {};
  for (let i = 1; i < legPath.length; i++) {
    const terrain = getTile(state, legPath[i].x, legPath[i].y).terrain;
    terrainCounts[terrain] = (terrainCounts[terrain] || 0) + 1;
  }
  return {
    fullPath,
    legPath,
    end,
    arrived: end.x === destination.x && end.y === destination.y,
    totalSteps: fullPath.length - 1,
    legSteps: legPath.length - 1,
    terrainCounts,
    terrainLabels: Object.entries(terrainCounts).map(([id, count]) => ({
      id,
      count,
      label: TERRAINS[id]?.label || id,
    })),
  };
}

export function directionLabel(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(-dy, dx + dy / 2) * 180 / Math.PI;
  if (angle >= -22.5 && angle < 22.5) return "east";
  if (angle >= 22.5 && angle < 67.5) return "north-east";
  if (angle >= 67.5 && angle < 112.5) return "north";
  if (angle >= 112.5 || angle < -157.5) return "west";
  if (angle >= -157.5 && angle < -112.5) return "south-west";
  if (angle >= -112.5 && angle < -67.5) return "south";
  return "south-east";
}
