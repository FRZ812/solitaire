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

function emptyLayout() {
  return {
    entries: [],
    centerByKey: new Map(),
    worldRadius: 0,
    cityCellSize: 0,
    stride: 1,
    project: () => ({ x: 0, y: 0 }),
  };
}

function buildWorldLayout(scene, width, height) {
  const cells = Array.isArray(scene?.cells) ? scene.cells : [];
  if (cells.length === 0) return emptyLayout();

  const origin = scene.origin || { x: 0, y: 0 };
  // Zoomed out the viewport samples every `stride`-th hex. Dividing by it puts
  // the samples back on a unit lattice, so they tile edge-to-edge at the same
  // on-screen radius and each hex simply stands for more ground.
  const stride = Math.max(1, Number(scene.stride) || 1);
  const projectRaw = (coord) => {
    const q = (Number(coord.x || 0) - Number(origin.x || 0)) / stride;
    const r = (Number(coord.y || 0) - Number(origin.y || 0)) / stride;
    return { x: SQRT_3 * (q + r * 0.5), y: 1.5 * r };
  };
  const rawCenters = cells.map(projectRaw);
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
  const project = (coord) => {
    const raw = projectRaw(coord);
    return { x: offset.x + raw.x * worldRadius, y: offset.y + raw.y * worldRadius };
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
  return { entries, centerByKey, worldRadius, cityCellSize: 0, stride, project };
}

function buildCityLayout(scene, width, height) {
  const cells = Array.isArray(scene?.cells) ? scene.cells : [];
  if (cells.length === 0) return emptyLayout();

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
  return {
    entries,
    centerByKey,
    worldRadius: 0,
    cityCellSize,
    stride: 1,
    project: (coord) => ({
      x: offset.x + (Number(coord.col || 0) + 0.5) * cityCellSize,
      y: offset.y + (Number(coord.row || 0) + 0.5) * cityCellSize,
    }),
  };
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

// Screen positions for the authored layers. These are placed by projection
// rather than by sampling, which is the whole point: at continental stride a
// sample almost never lands on the hex a landmark occupies.
export function layoutAtlasPlaces(layout, places) {
  if (!Array.isArray(places) || !layout.project) return [];
  return places.map((place) => ({ ...place, point: layout.project(place) }));
}

export function layoutAtlasRibbons(layout, ribbons, width, height) {
  if (!Array.isArray(ribbons) || !layout.project) return [];
  const margin = Math.max(width, height);
  const laid = [];
  for (const ribbon of ribbons) {
    const points = ribbon.points.map((point) => layout.project(point));
    // A ribbon spanning the continent is mostly off-screen at close zoom; skip
    // the ones with no chance of touching the canvas rather than stroking them.
    const onScreen = points.some((point) => (
      point.x > -margin && point.x < width + margin
      && point.y > -margin && point.y < height + margin
    ));
    if (onScreen) laid.push({ ...ribbon, points });
  }
  return laid;
}

// Places sit on top of the hexes, so they are hit-tested first and by
// proximity — a marker is a point of interest, not a polygon.
export function findAtlasPlace(placeEntries, point, radius) {
  const reach = Math.max(10, Number(radius) || 0);
  let best = null;
  let bestDistance = reach;
  for (const place of placeEntries || []) {
    const distance = Math.hypot(place.point.x - point.x, place.point.y - point.y);
    if (distance <= bestDistance) {
      best = place;
      bestDistance = distance;
    }
  }
  return best;
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

// The continent is charted, so nothing on the map is veiled for not having been
// looked at. What is left is the night itself: after dark the whole visible
// country dims together, which is weather over a map rather than a wall of dark
// around the party.
export function mapFogOpacity(cell, night = false, fogScale = 1) {
  if (!night) return 0;
  const scale = Math.max(0, Number(fogScale) || 0);
  return 0.18 * scale;
}

export function selectMapMarkerEntries(scene, entries, viewport = {}) {
  const currentKey = String(scene?.current_key || "");
  const tier = scene?.tier || "local";
  // Zoomed out, sampled hexes carry an arbitrary subset of the sites actually
  // out there, so per-hex markers become noise; the authored places layer says
  // what is worth naming at that scale instead.
  if (tier === "continent") return [];
  // A silhouette is a marker with no name yet, so presence — not naming —
  // decides whether it is drawn. Close in the map carries every charted site;
  // pulled back it keeps only the places that have been walked into and named,
  // because at that scale a field of anonymous shapes is just noise.
  return (entries || []).filter((entry) => {
    const { poi_name: name, poi_knowledge: knowledge } = entry.cell;
    if (entry.key === currentKey) return false;
    if (tier !== "local") return knowledge === "discovered" && !!name;
    return !!knowledge || !!name;
  });
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
