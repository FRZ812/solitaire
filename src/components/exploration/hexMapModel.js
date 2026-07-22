import { HANDCRAFTED } from "../../data/handcrafted-map.js";
import { RUMORED } from "../../data/rumored.js";
import { FABLED_BY_COORD } from "../../data/fabled.js";
import { TERRAINS } from "../../data/terrains.js";
import { WHITEMARCH_CAPITAL, WHITEMARCH_LANDMARKS } from "../../data/whitemarch-capital.js";
import {
  HEX_DIRECTIONS,
  edgeAllowed,
  findWorldRoute,
  getTile,
  hexDistance,
  isPassable,
  isSeen,
  isTeleportAnchor,
  isVisited,
} from "../../engine/world.js";
import { sightRadius } from "../../engine/light.js";

export const TERRAIN_INK = {
  road: "#d0a765",
  street: "#c4b69a",
  settlement: "#d29d65",
  indoor: "#8c6849",
  wall: "#96938c",
  plains: "#83a661",
  hills: "#af8555",
  forest: "#3f8059",
  marsh: "#48a098",
  mountains: "#8296aa",
  water: "#4b9bc2",
  impassable: "#334252",
};

const LANDMARK_TYPES = new Set([
  "city", "town", "village", "settlement", "fortress", "gate", "palace",
  "temple", "shrine", "tower", "lake", "ruin", "landmark", "camp", "market", "smithy", "healer",
]);
const COMPASS_ORDER = ["north-west", "north", "north-east", "east", "south-east", "south", "south-west", "west"];
const TRAIL_REACH = 4;
const WHITEMARCH_CITY_ID = WHITEMARCH_CAPITAL.cityId || WHITEMARCH_CAPITAL.id;
const WHITEMARCH_REGIONAL_LANDMARK = WHITEMARCH_LANDMARKS.find((landmark) => (
  landmark?.atlasLandmark
  || (landmark?.coord?.x === WHITEMARCH_CAPITAL.start.x
    && landmark?.coord?.y === WHITEMARCH_CAPITAL.start.y)
)) || {};

export const RPG_VIEW_COLS = 11;
export const RPG_VIEW_ROWS = 9;

export function coordKey(coord) {
  return `${coord.x},${coord.y}`;
}

export function parseCoord(key) {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

export function directionLabel(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(-dy, dx + dy / 2) * 180 / Math.PI;
  if (angle >= -22.5 && angle < 22.5) return "east";
  if (angle >= 22.5 && angle < 67.5) return "north-east";
  if (angle >= 67.5 && angle < 112.5) return "north";
  if (angle >= 112.5 && angle < 157.5) return "north-west";
  if (angle >= 157.5 || angle < -157.5) return "west";
  if (angle >= -157.5 && angle < -112.5) return "south-west";
  if (angle >= -112.5 && angle < -67.5) return "south";
  return "south-east";
}

export function directionShort(direction) {
  return direction.split("-").map((word) => word[0]).join("").toUpperCase();
}

// Trailheads are staged like choices on the horizon rather than plotted on a
// coordinate lattice. The shallow arc keeps all six world directions legible
// on a phone while leaving the central landscape visible.
export function arrangeTrailheads(choices) {
  const sorted = [...choices].sort((a, b) => {
    const ai = COMPASS_ORDER.indexOf(a.direction);
    const bi = COMPASS_ORDER.indexOf(b.direction);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
  const count = sorted.length;
  return sorted.map((choice, index) => {
    const x = count === 1 ? 50 : 9 + index * (82 / (count - 1));
    const edge = Math.abs(x - 50) / 41;
    const y = 27 + edge * 24;
    return { ...choice, scene: { x, y } };
  });
}

function questAtKey(quests, key) {
  return quests.find((quest) => quest.loc && coordKey(quest.loc) === key) || null;
}

// Build a camera window over the one authoritative axial world. Camera center
// is intentionally independent from the party: panning never changes sight,
// route authority, or the current marker.
export function buildRpgViewport(state, options = {}) {
  const party = state.world.currentTile;
  const legacyCenter = Number.isFinite(options?.x) && Number.isFinite(options?.y) ? options : null;
  const center = options?.center || legacyCenter || party;
  const dimensions = options?.dimensions || { columns: RPG_VIEW_COLS, rows: RPG_VIEW_ROWS };
  const columns = Math.max(3, Math.round(dimensions.columns) || RPG_VIEW_COLS);
  const rows = Math.max(3, Math.round(dimensions.rows) || RPG_VIEW_ROWS);
  const quests = options?.activeQuests || (state.world.quests || []).filter((quest) => quest.status === "active");
  const radiusX = Math.floor(columns / 2);
  const radiusY = Math.floor(rows / 2);
  const centerOffsetColumn = center.x + Math.floor(center.y / 2);
  const visibleRadius = sightRadius(state);
  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const y = center.y + row - radiusY;
      // Enumerate an offset-row screen rectangle, then convert each cell back
      // into the authoritative axial coordinates used by simulation. A q/r
      // rectangle projects as a parallelogram; offset rows keep the Canvas
      // edges vertical while preserving every world lookup and route.
      const offsetColumn = centerOffsetColumn + col - radiusX;
      const x = offsetColumn - Math.floor(y / 2);
      const key = `${x},${y}`;
      const tile = getTile(state, x, y);
      const visible = hexDistance(party, { x, y }) <= visibleRadius;
      const seen = visible || isSeen(state, x, y);
      const visited = isVisited(state, x, y);
      cells.push({
        key, x, y, col, row, tile,
        seen,
        visible,
        visited,
        explored: seen || visited,
        passable: isPassable(tile),
        quest: questAtKey(quests, key),
        current: x === party.x && y === party.y,
        screen: { x: col * 100 + 50, y: row * 100 + 50 },
      });
    }
  }
  return cells;
}

function traceTrail(state, origin, direction, questKeys) {
  const path = [{ ...origin }];
  let cursor = { ...origin };
  let cursorTile = getTile(state, cursor.x, cursor.y);
  for (let step = 0; step < TRAIL_REACH; step++) {
    const next = { x: cursor.x + direction.x, y: cursor.y + direction.y };
    const nextTile = getTile(state, next.x, next.y);
    if (!isPassable(nextTile) || !isSeen(state, next.x, next.y)) break;
    if (!edgeAllowed(cursorTile, cursor.x, cursor.y, nextTile, next.x, next.y)) break;
    path.push(next);
    cursor = next;
    cursorTile = nextTile;
    const key = coordKey(next);
    if (questKeys.has(key) || (nextTile.poi?.name && nextTile.poi.type !== "hidden")) break;
  }
  return path;
}

// Build a decision model rather than a render model. World coordinates remain
// the simulation's source of truth, but the player sees trailheads, objectives,
// and remembered landmarks instead of every cell in the axial grid.
export function buildExplorationModel(state, options = {}) {
  const origin = state.world.currentTile;
  const center = options.center || origin;
  const currentTile = getTile(state, origin.x, origin.y);
  const activeQuests = (state.world.quests || []).filter((quest) => quest.status === "active");
  const questKeys = new Set(activeQuests.filter((quest) => quest.loc).map((quest) => coordKey(quest.loc)));
  const viewport = buildRpgViewport(state, {
    center,
    dimensions: options.dimensions,
    activeQuests,
  });
  const visibleKeys = new Set(viewport.map((cell) => cell.key));
  const renderViewport = buildRpgViewport(state, {
    center,
    dimensions: options.renderDimensions || options.dimensions,
    activeQuests,
  }).map((cell) => ({ ...cell, overscan: !visibleKeys.has(cell.key) }));

  const rawChoices = [];
  for (const direction of HEX_DIRECTIONS) {
    const path = traceTrail(state, origin, direction, questKeys);
    if (path.length < 2) continue;
    const end = path[path.length - 1];
    const tile = getTile(state, end.x, end.y);
    const key = coordKey(end);
    rawChoices.push({
      key,
      ...end,
      tile,
      path,
      steps: path.length - 1,
      direction: directionLabel(origin, end),
      quest: questAtKey(activeQuests, key),
      seen: true,
      visited: isVisited(state, end.x, end.y),
    });
  }
  const choices = arrangeTrailheads(rawChoices);

  const keys = new Set(Object.keys(HANDCRAFTED));
  for (const key of Object.keys(RUMORED)) keys.add(key);
  for (const key of Object.keys(FABLED_BY_COORD)) keys.add(key);
  for (const key of Object.keys(state.world.tiles || {})) keys.add(key);
  for (const key of questKeys) keys.add(key);
  for (const choice of choices) keys.add(choice.key);
  for (const cell of renderViewport) keys.add(cell.key);
  keys.add(coordKey(origin));

  const byKey = new Map();
  const landmarks = [];
  for (const key of keys) {
    const coord = parseCoord(key);
    if (!Number.isFinite(coord.x) || !Number.isFinite(coord.y)) continue;
    const tile = getTile(state, coord.x, coord.y);
    const knownBy = RUMORED[key] ? "reputation" : (FABLED_BY_COORD[key] ? "legend" : null);
    // A named lake or other impassable feature still belongs in the regional map
    // index even though ground travel correctly stops at its shore.
    if (!isPassable(tile) && !knownBy) continue;
    const seen = isSeen(state, coord.x, coord.y);
    const visited = isVisited(state, coord.x, coord.y);
    const quest = questAtKey(activeQuests, key);
    const distance = hexDistance(origin, coord);
    const name = tile.poi?.name;
    const cell = { key, ...coord, tile, seen, visited, quest, distance, knownBy };
    byKey.set(key, cell);

    const knownName = name && tile.poi?.type !== "hidden" && (seen || visited || quest || knownBy);
    const isLandmark = knownName && (LANDMARK_TYPES.has(tile.poi?.type) || quest);
    const anchor = (seen || visited) && isTeleportAnchor(state, coord.x, coord.y);
    // City POIs stay fully visible in the nearby RPG viewport, while the regional
    // index represents the entire capital with one destination instead of
    // listing every market stall, gatehouse, chapel, and workshop.
    if (tile.cityId === WHITEMARCH_CITY_ID) continue;
    if ((isLandmark || quest || anchor) && distance > 0) {
      landmarks.push({ ...cell, name: name || quest?.title || null, anchor });
    }
  }

  const capitalCoord = WHITEMARCH_REGIONAL_LANDMARK.coord || WHITEMARCH_CAPITAL.center || WHITEMARCH_CAPITAL.start;
  const capitalKey = coordKey(capitalCoord);
  const capitalTile = getTile(state, capitalCoord.x, capitalCoord.y);
  const capitalSeen = isSeen(state, capitalCoord.x, capitalCoord.y);
  const capitalVisited = isVisited(state, capitalCoord.x, capitalCoord.y);
  if (capitalSeen || capitalVisited || capitalTile.cityId === WHITEMARCH_CITY_ID) {
    const capitalDistance = hexDistance(origin, capitalCoord);
    const capitalLandmark = {
      key: capitalKey,
      ...capitalCoord,
      tile: capitalTile,
      name: WHITEMARCH_CAPITAL.name,
      seen: capitalSeen,
      visited: capitalVisited,
      quest: questAtKey(activeQuests, capitalKey),
      distance: capitalDistance,
      knownBy: null,
      anchor: (capitalSeen || capitalVisited) && isTeleportAnchor(state, capitalCoord.x, capitalCoord.y),
      capital: true,
    };
    landmarks.push(capitalLandmark);
    byKey.set(capitalKey, { ...byKey.get(capitalKey), ...capitalLandmark });
  }

  const choiceByKey = new Map(choices.map((choice) => [choice.key, choice]));
  for (const choice of choices) byKey.set(choice.key, { ...byKey.get(choice.key), ...choice });
  const landmarkByKey = new Map();
  for (const landmark of landmarks) {
    const existing = landmarkByKey.get(landmark.key);
    if (!existing || (!existing.quest && landmark.quest)) landmarkByKey.set(landmark.key, landmark);
  }
  const sortedLandmarks = [...landmarkByKey.values()].sort((a, b) => {
    if (!!a.quest !== !!b.quest) return a.quest ? -1 : 1;
    if (!!a.anchor !== !!b.anchor) return a.anchor ? -1 : 1;
    return a.distance - b.distance || a.name.localeCompare(b.name);
  }).map((landmark) => ({ ...landmark, direction: directionLabel(origin, landmark), trailhead: choiceByKey.get(landmark.key) || null }));

  return {
    origin,
    current: { key: coordKey(origin), ...origin, tile: currentTile, seen: true, visited: true },
    choices,
    viewport,
    renderViewport,
    landmarks: sortedLandmarks,
    byKey,
  };
}

export function planHexJourney(state, destination, maxLeg = 48) {
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
