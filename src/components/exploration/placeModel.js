export const PLACE_MAP_COLS = 15;
export const PLACE_MAP_ROWS = 15;
export const PLACE_VIEW_COLS = 11;
export const PLACE_VIEW_ROWS = 9;

// Whitemarch is authored as a node graph. These grid positions are the visual
// layer for the handheld-RPG camera: palace north, Crown Gate south, docks west,
// market north-west, and the Low Wards east. Simulation still uses node ids.
export const WHITEMARCH_GRID = Object.freeze({
  "iron-palace": { x: 7, y: 1 },
  "muster-court": { x: 7, y: 3 },
  "inner-gate": { x: 7, y: 5 },
  "grain-square": { x: 3, y: 4 },
  "smith-row": { x: 10, y: 4 },
  "apothecary-stall": { x: 2, y: 6 },
  "guild-court": { x: 10, y: 6 },
  "registry-hall": { x: 12, y: 7 },
  "grand-concourse": { x: 7, y: 8 },
  "chain-steps": { x: 9, y: 8 },
  "almshouse": { x: 13, y: 9 },
  "holding-cells": { x: 8, y: 10 },
  "river-stair": { x: 4, y: 10 },
  "low-wards": { x: 11, y: 10 },
  "chandlery": { x: 11, y: 11 },
  "toll-hall": { x: 6, y: 12 },
  "caravan-yard": { x: 9, y: 12 },
  "leaning-tankard": { x: 13, y: 12 },
  "high-quay": { x: 2, y: 12 },
  "smuggler-stairs": { x: 1, y: 13 },
  "warehouse-row": { x: 4, y: 13 },
  "crown-gate": { x: 7, y: 13 },
  "bonepicker-chapel": { x: 10, y: 13 },
  "great-stable": { x: 12, y: 13 },
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function fallbackGrid(place) {
  const layout = {};
  Object.values(place?.nodes || {}).forEach((node, index) => {
    layout[node.id] = {
      x: 2 + (index % 4) * 3,
      y: clamp(2 + Math.floor(index / 4) * 2, 1, PLACE_MAP_ROWS - 2),
    };
  });
  return layout;
}

export function placeGrid(place) {
  return place?.id === "whitemarch" ? WHITEMARCH_GRID : fallbackGrid(place);
}

export function findPlaceRoute(place, fromId, toId) {
  if (!place?.nodes?.[fromId] || !place.nodes[toId]) return null;
  if (fromId === toId) return [fromId];

  const queue = [fromId];
  const previous = new Map([[fromId, null]]);
  while (queue.length) {
    const id = queue.shift();
    for (const nextId of place.nodes[id].exits || []) {
      if (!place.nodes[nextId] || previous.has(nextId)) continue;
      previous.set(nextId, id);
      if (nextId === toId) {
        const route = [toId];
        let cursor = id;
        while (cursor) {
          route.push(cursor);
          cursor = previous.get(cursor);
        }
        return route.reverse();
      }
      queue.push(nextId);
    }
  }
  return null;
}

const GRID_STEPS = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];

function gridKey(point) {
  return `${point.x},${point.y}`;
}

function edgeKey(fromId, toId) {
  return [fromId, toId].sort().join("|");
}

function corridorBetween(from, to, { blocked = new Set(), surfaces = new Map() } = {}) {
  if (!from || !to) return [];
  const startKey = gridKey(from);
  const targetKey = gridKey(to);
  if (startKey === targetKey) return [{ x: from.x, y: from.y }];

  const heuristic = (point) => (Math.abs(point.x - to.x) + Math.abs(point.y - to.y)) * 0.72;
  const costs = new Map([[startKey, 0]]);
  const previous = new Map();
  const points = new Map([[startKey, { x: from.x, y: from.y }]]);
  const closed = new Set();
  const open = [{ x: from.x, y: from.y, key: startKey, cost: 0, score: heuristic(from) }];

  while (open.length) {
    open.sort((left, right) => left.score - right.score || left.cost - right.cost || left.y - right.y || left.x - right.x);
    const current = open.shift();
    if (closed.has(current.key)) continue;
    if (current.key === targetKey) {
      const corridor = [];
      let cursor = targetKey;
      while (cursor) {
        corridor.push(points.get(cursor));
        if (cursor === startKey) break;
        cursor = previous.get(cursor);
      }
      return corridor.reverse();
    }
    closed.add(current.key);

    for (const step of GRID_STEPS) {
      const next = { x: current.x + step.x, y: current.y + step.y };
      const key = gridKey(next);
      const isTarget = key === targetKey;
      const outside = next.x <= 0 || next.y <= 0 || next.x >= PLACE_MAP_COLS - 1 || next.y >= PLACE_MAP_ROWS - 1;
      const surface = surfaces.get(key);
      if (!isTarget && (outside || blocked.has(key) || surface === "wall" || surface === "river")) continue;

      const road = surface === "street" || surface === "avenue" || surface === "plaza";
      const cost = current.cost + (road ? 0.72 : 1);
      if (cost >= (costs.get(key) ?? Infinity)) continue;
      costs.set(key, cost);
      previous.set(key, current.key);
      points.set(key, next);
      open.push({ ...next, key, cost, score: cost + heuristic(next) });
    }
  }
  return [];
}

function nodeSurface(node) {
  if (!node) return null;
  if (node.terrain === "wall" || node.type === "wall") return "wall";
  if (["market", "plaza", "court", "yard", "dock", "settlement", "slavemarket"].includes(node.type)) return "plaza";
  if (["gate", "stair"].includes(node.type)) return "avenue";
  return "roof";
}

// Whitemarch's streets are derived from the same graph that validates walking.
// This removes the old fourth map representation where a static image and a
// coordinate heuristic invented roads unrelated to the node exits.
export function buildPlaceGeometry(place, layout = placeGrid(place)) {
  const surfaces = new Map();
  for (let y = 0; y < PLACE_MAP_ROWS; y++) {
    for (let x = 0; x < PLACE_MAP_COLS; x++) {
      const boundary = x === 0 || y === 0 || x === PLACE_MAP_COLS - 1 || y === PLACE_MAP_ROWS - 1;
      surfaces.set(`${x},${y}`, boundary ? "wall" : x <= 1 && y >= 9 ? "river" : "roof");
    }
  }

  const nodes = Object.values(place?.nodes || {});
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const blocked = new Set(nodes.map((node) => layout[node.id]).filter(Boolean).map(gridKey));
  const corridors = new Map();
  const paintedEdges = new Set();
  for (const node of nodes) {
    const from = layout[node.id];
    if (!from) continue;
    for (const exitId of node.exits || []) {
      const to = layout[exitId];
      if (!to) continue;
      const keyForEdge = edgeKey(node.id, exitId);
      if (paintedEdges.has(keyForEdge)) continue;
      paintedEdges.add(keyForEdge);
      const exit = nodeById.get(exitId);
      const avenue = node.district !== exit?.district || [node.type, exit?.type].some((type) => ["gate", "palace", "plaza", "market"].includes(type));
      const points = corridorBetween(from, to, { blocked, surfaces });
      corridors.set(keyForEdge, { fromId: node.id, toId: exitId, points });
      for (const point of points) {
        if (point.x <= 0 || point.y <= 0 || point.x >= PLACE_MAP_COLS - 1 || point.y >= PLACE_MAP_ROWS - 1) continue;
        const key = `${point.x},${point.y}`;
        if (surfaces.get(key) === "river") continue;
        if (avenue || surfaces.get(key) !== "avenue") surfaces.set(key, avenue ? "avenue" : "street");
      }
    }
  }

  for (const node of nodes) {
    const point = layout[node.id];
    if (point) surfaces.set(`${point.x},${point.y}`, nodeSurface(node));
  }
  return { surfaces, corridors };
}

export function buildPlaceSurfaceMap(place, layout = placeGrid(place)) {
  return buildPlaceGeometry(place, layout).surfaces;
}

function routeGridCells(route, geometry) {
  const cells = [];
  for (let index = 1; index < (route || []).length; index++) {
    const fromId = route[index - 1];
    const toId = route[index];
    const corridor = geometry.corridors.get(edgeKey(fromId, toId));
    if (!corridor?.points?.length) return [];
    const segment = corridor.fromId === fromId ? corridor.points : [...corridor.points].reverse();
    cells.push(...(cells.length ? segment.slice(1) : segment));
  }
  return cells;
}

export function cityDirection(from, to) {
  if (!from || !to) return "unknown";
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const horizontal = dx < 0 ? "west" : dx > 0 ? "east" : "";
  const vertical = dy < 0 ? "north" : dy > 0 ? "south" : "";
  if (!horizontal) return vertical || "here";
  if (!vertical) return horizontal;
  return `${vertical}-${horizontal}`;
}

export function nextPlaceNode(place, layout, fromId, dx, dy) {
  const origin = layout?.[fromId];
  if (!origin || (!dx && !dy)) return null;
  let best = null;
  for (const node of Object.values(place?.nodes || {})) {
    if (node.id === fromId || !layout[node.id]) continue;
    const point = layout[node.id];
    const deltaX = point.x - origin.x;
    const deltaY = point.y - origin.y;
    const forward = deltaX * dx + deltaY * dy;
    if (forward <= 0) continue;
    const lateral = Math.abs(deltaX * dy - deltaY * dx);
    const distance = Math.hypot(deltaX, deltaY);
    const score = distance + lateral * 1.75;
    if (!best || score < best.score || (score === best.score && node.name.localeCompare(best.node.name) < 0)) {
      best = { node, score };
    }
  }
  return best?.node || null;
}

export function buildPlaceViewport(place, currentId, selectedId = null) {
  const layout = placeGrid(place);
  const geometry = buildPlaceGeometry(place, layout);
  const surfaceMap = geometry.surfaces;
  const currentPosition = layout[currentId] || { x: Math.floor(PLACE_MAP_COLS / 2), y: Math.floor(PLACE_MAP_ROWS / 2) };
  const radiusX = Math.floor(PLACE_VIEW_COLS / 2);
  const radiusY = Math.floor(PLACE_VIEW_ROWS / 2);
  const startX = clamp(currentPosition.x - radiusX, 0, PLACE_MAP_COLS - PLACE_VIEW_COLS);
  const startY = clamp(currentPosition.y - radiusY, 0, PLACE_MAP_ROWS - PLACE_VIEW_ROWS);
  const nodeAt = new Map();
  for (const node of Object.values(place?.nodes || {})) {
    const point = layout[node.id];
    if (point) nodeAt.set(`${point.x},${point.y}`, node);
  }

  const viewport = [];
  for (let row = 0; row < PLACE_VIEW_ROWS; row++) {
    for (let col = 0; col < PLACE_VIEW_COLS; col++) {
      const x = startX + col;
      const y = startY + row;
      const node = nodeAt.get(`${x},${y}`) || null;
      viewport.push({
        key: `${x},${y}`,
        x,
        y,
        col,
        row,
        node,
        surface: surfaceMap.get(`${x},${y}`) || "roof",
        current: node?.id === currentId,
        selected: node?.id === selectedId,
        backgroundX: `${x / (PLACE_MAP_COLS - 1) * 100}%`,
        backgroundY: `${y / (PLACE_MAP_ROWS - 1) * 100}%`,
      });
    }
  }

  const route = selectedId ? findPlaceRoute(place, currentId, selectedId) : null;
  const routeSet = new Set(route || []);
  const routeCells = routeGridCells(route, geometry);
  const routeCellKeys = routeCells.map((point) => `${point.x},${point.y}`);
  const routePoints = routeCells.map((point) => {
    return {
      x: (point.x - startX) * 100 + 50,
      y: (point.y - startY) * 100 + 50,
    };
  });
  const visibleIds = new Set(viewport.filter((cell) => cell.node).map((cell) => cell.node.id));
  const selectedPosition = selectedId ? layout[selectedId] : null;

  return {
    layout,
    viewport,
    startX,
    startY,
    currentPosition,
    selectedPosition,
    selectedVisible: !selectedId || visibleIds.has(selectedId),
    route,
    routeSet,
    routeCellKeys,
    routePoints,
    directIds: new Set(place?.nodes?.[currentId]?.exits || []),
    landmarks: Object.values(place?.nodes || {}).sort((a, b) =>
      (a.district || "").localeCompare(b.district || "") || a.name.localeCompare(b.name)),
  };
}
