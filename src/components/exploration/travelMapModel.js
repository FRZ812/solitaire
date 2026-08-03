import { TERRAINS } from "../../data/terrains.js";
import { landmarkAt } from "../../engine/world-generation.js";
import { getTile, isSeen, isVisited } from "../../engine/world.js";
import {
  TRAVEL_MAP_MAX_ZOOM,
  TRAVEL_MAP_MIN_ZOOM,
  clampTravelMapZoom,
  oddCount,
  travelMapLod,
} from "./mapLod.js";

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export { TRAVEL_MAP_MAX_ZOOM, TRAVEL_MAP_MIN_ZOOM, clampTravelMapZoom };
export const TRAVEL_MAP_OVERSCAN_CELLS = 3;

// Cell count, not a render transform, drives map scale. Rows establish the zoom
// level; columns follow the measured Canvas aspect ratio so a desktop sidebar
// or a portrait phone cannot force the projected map into a fixed shape. Past
// the row ceiling the window stops growing and `stride` takes over, which is
// what keeps a continental view within a few thousand cells instead of the
// million hexes it actually spans.
export function travelMapViewportDimensions(viewport = {}, zoom = 1) {
  const width = Math.max(1, Number(viewport.width) || 1);
  const height = Math.max(1, Number(viewport.height) || 1);
  const { rows, stride } = travelMapLod(zoom);
  const projectedHeight = 1.5 * (rows - 1) + 2;
  const columnsForAspect = (width / height) * projectedHeight / Math.sqrt(3);
  return {
    columns: oddCount(columnsForAspect, 7, 45),
    rows,
    stride,
  };
}

export function travelMapRenderDimensions(visibleDimensions = {}) {
  const columns = Math.max(3, Math.round(Number(visibleDimensions.columns) || 3));
  const rows = Math.max(3, Math.round(Number(visibleDimensions.rows) || 3));
  return {
    columns: columns + TRAVEL_MAP_OVERSCAN_CELLS * 2,
    rows: rows + TRAVEL_MAP_OVERSCAN_CELLS * 2,
    stride: Math.max(1, Math.round(Number(visibleDimensions.stride) || 1)),
  };
}

export function formatTravelDuration(minutes) {
  const total = Math.max(0, Math.round(minutes || 0));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours < 24) return rest ? `${hours} h ${rest} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const dayRest = hours % 24;
  return dayRest ? `${days} d ${dayRest} h` : `${days} d`;
}

export function activeMarchJourney(journey, travelMarch) {
  const path = travelMarch?.path;
  if (!Array.isArray(path) || path.length === 0) return journey;
  const legPath = path.map((coord) => ({ x: coord.x, y: coord.y }));
  const legSteps = Math.max(0, legPath.length - 1);
  return {
    ...(journey || {}),
    legPath,
    end: legPath.at(-1),
    legSteps,
    totalSteps: Number.isFinite(journey?.totalSteps) ? journey.totalSteps : legSteps,
    arrived: travelMarch.intendedDest ? false : (journey?.arrived ?? true),
  };
}

// The staged legs the party can honestly foresee. A leg's boundary names the
// place it ends at, so a leg may only be previewed once every hex it covers is
// already on the party's map — otherwise the itinerary would name sites nobody
// has seen. Scenery is carried as labels only, which the scene model already
// treats as public for mapped ground.
function knownLegs(state, journey) {
  const path = journey?.fullPath;
  if (!Array.isArray(journey?.legs) || !Array.isArray(path)) return [];
  let mapped = 1;
  while (mapped < path.length && (isSeen(state, path[mapped].x, path[mapped].y) || isVisited(state, path[mapped].x, path[mapped].y))) {
    mapped += 1;
  }
  return journey.legs
    .filter((leg) => leg.to < mapped)
    .map((leg) => ({
      index: leg.index,
      steps: leg.steps,
      minutes: leg.minutes,
      nights: leg.nights || 0,
      arrived: leg.arrived,
      boundaryKind: leg.boundary?.kind || "",
      boundaryLabel: leg.boundary?.label || "",
      passed: (leg.passed || []).map((entry) => entry.label).filter(Boolean),
    }));
}

// Build a UI-only journey from the contiguous mapped prefix. The authoritative
// route remains in the caller and is never copied here, so an inspection panel
// or Canvas scene cannot become an oracle for unseen passability or terrain.
export function knownJourneyPreview(state, journey, legPath = journey?.legPath) {
  if (!journey || !Array.isArray(legPath) || legPath.length === 0) return null;
  const mappedPath = [];
  for (let index = 0; index < legPath.length; index += 1) {
    const coord = legPath[index];
    const mapped = index === 0
      || isSeen(state, coord.x, coord.y)
      || isVisited(state, coord.x, coord.y);
    if (!mapped) break;
    mappedPath.push({ x: coord.x, y: coord.y });
  }

  const terrainCounts = {};
  for (let index = 1; index < mappedPath.length; index += 1) {
    const coord = mappedPath[index];
    const terrain = getTile(state, coord.x, coord.y).terrain;
    terrainCounts[terrain] = (terrainCounts[terrain] || 0) + 1;
  }
  const routeFullyMapped = mappedPath.length === legPath.length;
  return {
    legs: knownLegs(state, journey),
    legPath: mappedPath,
    end: mappedPath.at(-1) || null,
    arrived: routeFullyMapped && !!journey.arrived,
    totalSteps: routeFullyMapped ? journey.totalSteps : null,
    legSteps: Math.max(0, mappedPath.length - 1),
    terrainCounts,
    terrainLabels: Object.entries(terrainCounts).map(([id, count]) => ({
      id,
      count,
      label: TERRAINS[id]?.label || id,
    })),
    routeFullyMapped,
  };
}

// Route summaries may name only places already persisted in the party's map.
// Camera extent and path previews are presentation concerns, never discovery.
export function knownJourneyWaypoints(state, path, { cap = 5, skipEndpoints = true } = {}) {
  if (!path || path.length < 2) return [];
  const names = [];
  const seenIds = new Set();
  const start = skipEndpoints ? 1 : 0;
  const end = skipEndpoints ? path.length - 1 : path.length;
  for (let index = start; index < end; index += 1) {
    const cell = path[index];
    if (!isSeen(state, cell.x, cell.y)) continue;
    const landmark = landmarkAt(cell.x, cell.y);
    if (!landmark || seenIds.has(landmark.id)) continue;
    seenIds.add(landmark.id);
    names.push({ id: landmark.id, name: landmark.name, kind: landmark.kind, index });
    if (names.length >= cap) break;
  }
  return names;
}

export function travelMapZoomStep(currentZoom, factor) {
  const current = clampTravelMapZoom(currentZoom);
  const multiplier = Number.isFinite(factor) && factor > 0 ? factor : 1;
  return { zoom: clampTravelMapZoom(current * multiplier) };
}

function axialRound(q, r) {
  const x = q;
  const z = r;
  const y = -x - z;
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const dx = Math.abs(rx - x);
  const dy = Math.abs(ry - y);
  const dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { x: rx, y: rz };
}

// Pixels dragged, in hexes of camera movement. `worldRadius` measures a drawn
// cell, which stands for `stride` hexes, so the drag is worth `stride` times
// what it looks like — read against the drawn radius alone the camera crawls one
// hex per cell dragged while the sample lattice, quantised to whole strides,
// sits still and then jumps a full cell once the rounding finally tips.
//
// Which lattice the drag rounds onto also changes with stride. At stride 1 a
// drawn cell is a hex, so cube rounding picks the right neighbour. Above 1 the
// stride is even, `floor(y / 2)` advances by exactly S/2 per row, and the
// sampled rows land squarely under each other instead of half-offset — a
// rectangular screen lattice, whose two axes round independently.
function travelMapDragDelta(drag, worldRadius, stride = 1) {
  const radius = Math.max(0.0001, Number(worldRadius) || 1);
  const step = Math.max(1, Math.round(Number(stride) || 1));
  const down = -(Number(drag?.y) || 0) / (1.5 * radius);
  const across = -(Number(drag?.x) || 0) / (Math.sqrt(3) * radius);
  // Cells, as axial q/r: one cell down is one row and half a column back.
  const cell = step === 1
    ? axialRound(across - down * 0.5, down)
    : { x: Math.round(across) - Math.round(down) * 0.5, y: Math.round(down) };
  return { radius, step, delta: { x: cell.x * step, y: cell.y * step } };
}

export function panTravelMapCamera(camera, drag, worldRadius, stride = 1) {
  const { delta } = travelMapDragDelta(drag, worldRadius, stride);
  return {
    ...camera,
    x: (Number(camera?.x) || 0) + delta.x,
    y: (Number(camera?.y) || 0) + delta.y,
  };
}

export function rebaseTravelMapDrag(drag, worldRadius, stride = 1) {
  const { radius, step, delta } = travelMapDragDelta(drag, worldRadius, stride);
  const source = {
    x: Number(drag?.x) || 0,
    y: Number(drag?.y) || 0,
  };
  const commit = {
    x: -Math.sqrt(3) * radius * (delta.x + delta.y * 0.5) / step || 0,
    y: -1.5 * radius * delta.y / step || 0,
  };
  return {
    commit,
    residual: {
      x: source.x - commit.x || 0,
      y: source.y - commit.y || 0,
    },
  };
}

export function presentedMarchDestination(selected, presentedJourney, travelMarch) {
  if (!travelMarch?.id) return selected || null;
  const end = presentedJourney?.end;
  return end && Number.isFinite(end.x) && Number.isFinite(end.y)
    ? { x: end.x, y: end.y }
    : null;
}

export function travelMapMarchDuration(path) {
  const steps = Math.max(0, (path?.length || 0) - 1);
  return Math.max(1_800, Math.min(6_000, steps * 320));
}

export function startTravelMapMarch({
  id,
  path,
  reducedMotion = false,
  schedule = (callback) => globalThis.requestAnimationFrame(callback),
  cancel = (handle) => globalThis.cancelAnimationFrame(handle),
  onFrame,
  onFinish,
}) {
  let stopped = false;
  let finished = false;
  let frameHandle = null;

  if (reducedMotion) {
    onFrame?.(travelMapMarchFrame(path, 1));
    frameHandle = schedule(() => {
      if (stopped || finished) return;
      finished = true;
      frameHandle = null;
      onFinish?.(id);
    });
    return () => {
      if (stopped || finished) return;
      stopped = true;
      if (frameHandle !== null) cancel(frameHandle);
    };
  }

  let startedAt = null;
  const duration = travelMapMarchDuration(path);

  const tick = (timestamp) => {
    if (stopped || finished) return;
    if (startedAt === null) startedAt = Number(timestamp) || 0;
    const progress = clamp(((Number(timestamp) || 0) - startedAt) / duration, 0, 1);
    onFrame?.(travelMapMarchFrame(path, progress));
    if (progress >= 1) {
      finished = true;
      frameHandle = null;
      onFinish?.(id);
      return;
    }
    frameHandle = schedule(tick);
  };

  frameHandle = schedule(tick);
  return () => {
    if (stopped || finished) return;
    stopped = true;
    if (frameHandle !== null) cancel(frameHandle);
  };
}

const keyOf = (coord) => `${coord.x},${coord.y}`;

export function travelMapMarchFrame(path, progress) {
  if (!Array.isArray(path) || path.length === 0) return null;
  const normalized = clamp(Number(progress) || 0, 0, 1);
  if (path.length === 1) {
    const coord = { x: path[0].x, y: path[0].y };
    return { coord, fromKey: keyOf(coord), toKey: keyOf(coord), mix: 0, index: 0, progress: normalized };
  }
  const position = normalized * (path.length - 1);
  const index = Math.min(path.length - 2, Math.floor(position));
  const mix = normalized === 1 ? 1 : position - index;
  const from = path[index];
  const to = path[index + 1];
  return {
    coord: {
      x: from.x + (to.x - from.x) * mix,
      y: from.y + (to.y - from.y) * mix,
    },
    fromKey: keyOf(from),
    toKey: keyOf(to),
    mix,
    index,
    // How far through the whole march this frame is, which is what the sky is
    // lit by: `mix` only says where we are between two hexes.
    progress: normalized,
  };
}
