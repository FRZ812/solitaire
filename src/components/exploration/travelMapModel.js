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
