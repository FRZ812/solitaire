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

function surfaceFor(x, y, node) {
  if (x === 0 || y === 0 || x === PLACE_MAP_COLS - 1 || y === PLACE_MAP_ROWS - 1) return "wall";
  if (x <= 1 && y >= 9) return "river";
  if (node?.terrain === "indoor") return "roof";
  if (["market", "plaza", "court", "yard", "dock", "settlement"].includes(node?.type)) return "plaza";
  if (x === 7 || y === 8 || (y >= 10 && x >= 2 && x <= 12)) return "avenue";
  return "street";
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
        surface: surfaceFor(x, y, node),
        current: node?.id === currentId,
        selected: node?.id === selectedId,
        backgroundX: `${x / (PLACE_MAP_COLS - 1) * 100}%`,
        backgroundY: `${y / (PLACE_MAP_ROWS - 1) * 100}%`,
      });
    }
  }

  const route = selectedId ? findPlaceRoute(place, currentId, selectedId) : null;
  const routeSet = new Set(route || []);
  const routePoints = (route || []).map((id) => {
    const point = layout[id];
    return {
      id,
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
    routePoints,
    directIds: new Set(place?.nodes?.[currentId]?.exits || []),
    landmarks: Object.values(place?.nodes || {}).sort((a, b) =>
      (a.district || "").localeCompare(b.district || "") || a.name.localeCompare(b.name)),
  };
}
