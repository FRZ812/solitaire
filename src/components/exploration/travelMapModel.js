const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const odd = (value, minimum, maximum) => {
  let next = clamp(Math.round(value), minimum, maximum);
  if (next % 2 === 0) next += next < maximum ? 1 : -1;
  return next;
};

export const TRAVEL_MAP_MIN_ZOOM = 0.6;
export const TRAVEL_MAP_MAX_ZOOM = 1.8;
export const REGION_SELECTOR_ZOOM_THRESHOLD = TRAVEL_MAP_MIN_ZOOM;

// Cell count, not a render transform, drives map scale. This keeps Canvas work
// bounded while allowing the camera to inspect far more than the old 11x9
// party-locked window. Odd dimensions keep the camera coordinate centered.
export function travelMapViewportDimensions(viewport = {}, zoom = 1) {
  const safeZoom = clamp(Number(zoom) || 1, TRAVEL_MAP_MIN_ZOOM, TRAVEL_MAP_MAX_ZOOM);
  const portrait = Number(viewport.height) > Number(viewport.width) * 1.15;
  const baseColumns = portrait ? 13 : 19;
  return {
    columns: odd(baseColumns / safeZoom, 9, 39),
    rows: odd(15 / safeZoom, 9, 31),
  };
}

export function clampTravelMapZoom(zoom) {
  return clamp(Number(zoom) || TRAVEL_MAP_MIN_ZOOM, TRAVEL_MAP_MIN_ZOOM, TRAVEL_MAP_MAX_ZOOM);
}

export function travelMapZoomStep(currentZoom, factor) {
  const current = clampTravelMapZoom(currentZoom);
  const multiplier = Number.isFinite(factor) && factor > 0 ? factor : 1;
  const requested = current * multiplier;
  const openRegionSelector = multiplier < 1
    && current <= REGION_SELECTOR_ZOOM_THRESHOLD
    && requested < TRAVEL_MAP_MIN_ZOOM;
  return {
    zoom: clampTravelMapZoom(requested),
    openRegionSelector,
  };
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

export function panTravelMapCamera(camera, drag, worldRadius) {
  const radius = Math.max(0.0001, Number(worldRadius) || 1);
  const dr = -(Number(drag?.y) || 0) / (1.5 * radius);
  const dq = -(Number(drag?.x) || 0) / (Math.sqrt(3) * radius) - dr * 0.5;
  const delta = axialRound(dq, dr);
  return {
    ...camera,
    x: (Number(camera?.x) || 0) + delta.x,
    y: (Number(camera?.y) || 0) + delta.y,
  };
}

export function travelMapMarchDuration(path) {
  const steps = Math.max(0, (path?.length || 0) - 1);
  return Math.max(1_800, Math.min(6_000, steps * 320));
}

export function startTravelMapMarch({
  id,
  path,
  schedule = (callback) => globalThis.requestAnimationFrame(callback),
  cancel = (handle) => globalThis.cancelAnimationFrame(handle),
  onFrame,
  onFinish,
}) {
  let stopped = false;
  let finished = false;
  let frameHandle = null;
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
  if (path.length === 1) {
    const coord = { x: path[0].x, y: path[0].y };
    return { coord, fromKey: keyOf(coord), toKey: keyOf(coord), mix: 0, index: 0 };
  }
  const normalized = clamp(Number(progress) || 0, 0, 1);
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
  };
}
