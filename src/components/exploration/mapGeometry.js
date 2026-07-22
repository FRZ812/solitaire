export const SQRT_3 = Math.sqrt(3);

export const ATLAS_CELLS = Object.freeze({
  plains: [0, 0], reedfield: [0, 0], forest: [1, 0], hills: [2, 0], mountains: [3, 0],
  road: [0, 1], water: [1, 1], marsh: [2, 1], impassable: [3, 1],
  settlement: [0, 2], street: [1, 2], wall: [2, 2], indoor: [3, 2],
  plaza: [0, 3], avenue: [1, 3], river: [2, 3], roof: [3, 3],
});

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function polygonBounds(polygon) {
  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function hexPolygon(center, radius) {
  return [
    { x: center.x, y: center.y - radius },
    { x: center.x + SQRT_3 * 0.5 * radius, y: center.y - 0.5 * radius },
    { x: center.x + SQRT_3 * 0.5 * radius, y: center.y + 0.5 * radius },
    { x: center.x, y: center.y + radius },
    { x: center.x - SQRT_3 * 0.5 * radius, y: center.y + 0.5 * radius },
    { x: center.x - SQRT_3 * 0.5 * radius, y: center.y - 0.5 * radius },
  ];
}

function entryFor(cell, center, polygon, size) {
  return {
    cell,
    key: String(cell.key || ""),
    center,
    polygon,
    bounds: polygonBounds(polygon),
    size,
  };
}

function buildWorldLayout(scene, width, height) {
  const cells = Array.isArray(scene?.cells) ? scene.cells : [];
  if (cells.length === 0) return { entries: [], centerByKey: new Map(), worldRadius: 0, cityCellSize: 0 };

  const origin = scene.origin || { x: 0, y: 0 };
  const rawCenters = cells.map((cell) => {
    const q = Number(cell.x || 0) - Number(origin.x || 0);
    const r = Number(cell.y || 0) - Number(origin.y || 0);
    return { x: SQRT_3 * (q + r * 0.5), y: 1.5 * r };
  });
  const scaleCenters = rawCenters.filter((_, index) => !cells[index].overscan);
  const fittedCenters = scaleCenters.length > 0 ? scaleCenters : rawCenters;
  const xs = fittedCenters.map((point) => point.x);
  const ys = fittedCenters.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padding = clamp(Math.min(width, height) * 0.025, 8, 20);
  const availableWidth = Math.max(1, width - padding * 2);
  const availableHeight = Math.max(1, height - padding * 2);
  // A camera viewport should be covered, not contain the whole generated cell
  // window as a floating island. Dimensions already track the Canvas aspect;
  // using the larger scale clips at most the outer half-hex after odd rounding.
  const worldRadius = Math.max(1, Math.max(
    availableWidth / Math.max(1, maxX - minX + SQRT_3),
    availableHeight / Math.max(1, maxY - minY + 2),
  ));
  const contentWidth = (maxX - minX + SQRT_3) * worldRadius;
  const contentHeight = (maxY - minY + 2) * worldRadius;
  const indexed = cells.map((cell, index) => ({
    index,
    col: Number(cell.col),
    row: Number(cell.row),
  })).filter((cell) => Number.isFinite(cell.col) && Number.isFinite(cell.row));
  const minCol = Math.min(...indexed.map((cell) => cell.col));
  const maxCol = Math.max(...indexed.map((cell) => cell.col));
  const minRow = Math.min(...indexed.map((cell) => cell.row));
  const maxRow = Math.max(...indexed.map((cell) => cell.row));
  const cameraIndex = indexed.find((cell) => (
    cell.col === (minCol + maxCol) * 0.5
    && cell.row === (minRow + maxRow) * 0.5
  ))?.index;
  const cameraCenter = cameraIndex == null ? null : rawCenters[cameraIndex];
  const offset = cameraCenter ? {
    x: width * 0.5 - cameraCenter.x * worldRadius,
    y: height * 0.5 - cameraCenter.y * worldRadius,
  } : {
    x: (width - contentWidth) * 0.5 + (-minX + SQRT_3 * 0.5) * worldRadius,
    y: (height - contentHeight) * 0.5 + (-minY + 1) * worldRadius,
  };
  const centerByKey = new Map();
  const entries = cells.map((cell, index) => {
    const center = {
      x: offset.x + rawCenters[index].x * worldRadius,
      y: offset.y + rawCenters[index].y * worldRadius,
    };
    const entry = entryFor(cell, center, hexPolygon(center, worldRadius * 1.015), worldRadius);
    centerByKey.set(entry.key, center);
    return entry;
  });
  return { entries, centerByKey, worldRadius, cityCellSize: 0 };
}

function buildCityLayout(scene, width, height) {
  const cells = Array.isArray(scene?.cells) ? scene.cells : [];
  if (cells.length === 0) return { entries: [], centerByKey: new Map(), worldRadius: 0, cityCellSize: 0 };

  const columns = Math.max(1, Number(scene.columns || 11));
  const rows = Math.max(1, Number(scene.rows || 9));
  const padding = clamp(Math.min(width, height) * 0.025, 8, 20);
  const cityCellSize = Math.max(1, Math.min(
    (width - padding * 2) / columns,
    (height - padding * 2) / rows,
  ));
  const offset = {
    x: (width - columns * cityCellSize) * 0.5,
    y: (height - rows * cityCellSize) * 0.5,
  };
  const centerByKey = new Map();
  const entries = cells.map((cell) => {
    const center = {
      x: offset.x + (Number(cell.col || 0) + 0.5) * cityCellSize,
      y: offset.y + (Number(cell.row || 0) + 0.5) * cityCellSize,
    };
    const half = cityCellSize * 0.505;
    const polygon = [
      { x: center.x - half, y: center.y - half },
      { x: center.x + half, y: center.y - half },
      { x: center.x + half, y: center.y + half },
      { x: center.x - half, y: center.y + half },
    ];
    const entry = entryFor(cell, center, polygon, cityCellSize * 0.5);
    centerByKey.set(entry.key, center);
    return entry;
  });
  return { entries, centerByKey, worldRadius: 0, cityCellSize };
}

export function buildMapLayout(scene, width, height) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  return scene?.mode === "city"
    ? buildCityLayout(scene, safeWidth, safeHeight)
    : buildWorldLayout(scene, safeWidth, safeHeight);
}

function pointOnSegment(point, start, end) {
  const cross = (point.y - start.y) * (end.x - start.x) - (point.x - start.x) * (end.y - start.y);
  if (Math.abs(cross) > 0.001) return false;
  const dot = (point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y);
  if (dot < 0) return false;
  const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  return dot <= lengthSquared;
}

export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    if (pointOnSegment(point, previousPoint, currentPoint)) return true;
    const crosses = (currentPoint.y > point.y) !== (previousPoint.y > point.y)
      && point.x < ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y))
        / (previousPoint.y - currentPoint.y) + currentPoint.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function findInteractiveEntry(entries, point) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry.cell.interactive && pointInPolygon(point, entry.polygon)) return entry;
  }
  return null;
}

export function mapMarchEntry(layout, march) {
  if (!march) return null;
  const from = layout.entries.find((entry) => entry.key === String(march.fromKey || ""));
  const to = layout.entries.find((entry) => entry.key === String(march.toKey || ""));
  if (!from || !to) return null;
  const mix = clamp(Number(march.mix) || 0, 0, 1);
  return {
    ...from,
    center: {
      x: from.center.x + (to.center.x - from.center.x) * mix,
      y: from.center.y + (to.center.y - from.center.y) * mix,
    },
  };
}

export function mapPartyEntry(layout, currentKey, march = null) {
  if (march) return mapMarchEntry(layout, march);
  return layout.entries.find((entry) => entry.key === String(currentKey || "")) || null;
}

export function mapTrackedEntry(layout, tracked) {
  if (!tracked?.pos) return null;
  const entry = layout.entries.find((candidate) => candidate.key === `${tracked.pos.x},${tracked.pos.y}`);
  return entry ? { ...entry, tracked } : null;
}

export function mapMarkerShowsTierDetail(markerSize, mode = "world") {
  return mode === "city" || Number(markerSize) >= 18;
}

export function mapPoiIconSize(hexRadius, mode = "world") {
  const radius = Math.max(0, Number(hexRadius) || 0);
  const scale = mode === "city" ? 1.05 : 1.25;
  const maximum = mode === "city" ? 42 : 40;
  return Math.max(18, Math.min(maximum, radius * scale));
}

export function mapFogOpacity(cell, night = false) {
  if (cell?.visible) return 0;
  if (cell?.explored) return night ? 0.34 : 0.22;
  return night ? 0.6 : 0.46;
}

export function selectMapMarkerEntries(scene, entries, viewport = {}) {
  const currentKey = String(scene?.current_key || "");
  return (entries || []).filter((entry) => (
    entry.cell.explored !== false
    && entry.cell.poi_name
    && entry.key !== currentKey
  ));
}

export function buildRouteSegments(route, centerByKey) {
  const segments = [];
  let active = [];
  for (const routeKey of route || []) {
    const center = centerByKey.get(String(routeKey));
    if (center) {
      active.push(center);
    } else {
      if (active.length > 1) segments.push(active);
      active = [];
    }
  }
  if (active.length > 1) segments.push(active);
  return segments;
}
