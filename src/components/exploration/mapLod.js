// How much ground the map shows, and how coarsely, at a given zoom.
//
// The continent is about 1063 x 850 hexes and `getTile` runs the generator per
// hex, so zooming out cannot mean enumerating more cells. Instead the cell count
// stays bounded and the *stride* between sampled hexes grows: at stride S a
// window of C x R cells covers C·S x R·S hexes of ground for the same cost.
// Each drawn hex then stands for an S x S patch rather than one hex.

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export const TRAVEL_MAP_MAX_ZOOM = 1.8;
// Far enough out that the 31-row window spans the continent's 850-hex height.
export const TRAVEL_MAP_MIN_ZOOM = 0.017;

// Rows of ground the camera wants at zoom 1, and the window it is allowed to
// enumerate. Coverage beyond `MAX_ROWS` is bought with stride, not with cells.
const ROWS_AT_UNIT_ZOOM = 15;
const MIN_ROWS = 9;
const MAX_ROWS = 31;

// The viewport enumerates an offset-row rectangle and converts back to axial
// with `x = offsetColumn - floor(y / 2)`. Only an even stride makes floor(y / 2)
// advance by exactly S/2 per row, which is what keeps the samples on a clean
// sub-lattice instead of wobbling by a hex every other row.
function evenStride(value) {
  const stride = Math.max(1, Math.round(value));
  if (stride <= 1) return 1;
  return stride % 2 === 0 ? stride : stride + 1;
}

// Odd dimensions keep the camera coordinate on a cell rather than between two.
export function oddCount(value, minimum, maximum) {
  let next = clamp(Math.round(value), minimum, maximum);
  if (next % 2 === 0) next += next < maximum ? 1 : -1;
  return next;
}

export function clampTravelMapZoom(zoom) {
  return clamp(Number(zoom) || TRAVEL_MAP_MIN_ZOOM, TRAVEL_MAP_MIN_ZOOM, TRAVEL_MAP_MAX_ZOOM);
}

// A hex outline drawn around a 28-hex sample is a lie, and a one-hex-wide road
// breaks into dashes the moment anything is skipped. Both are decided by tier.
export function lodTier(stride) {
  if (stride <= 1) return "local";
  return stride >= 8 ? "continent" : "region";
}

export function travelMapLod(zoom) {
  const safeZoom = clampTravelMapZoom(zoom);
  const coverage = ROWS_AT_UNIT_ZOOM / safeZoom;
  const rows = oddCount(coverage, MIN_ROWS, MAX_ROWS);
  const stride = evenStride(coverage / rows);
  return { zoom: safeZoom, rows, stride, tier: lodTier(stride), coverage };
}

export const lodShowsHexOutlines = (tier) => tier === "local";
export const lodShowsScenery = (tier) => tier === "local";
export const lodShowsVectorRoutes = (tier) => tier !== "local";

// Which places earn a marker. Close in, everything the party knows about; far
// out, only the places that give the continent its shape.
export function lodShowsPlace(tier, place) {
  if (tier === "local") return true;
  if (tier === "region") return !!place.name;
  return !!place.major;
}

// Personal sight is the wrong lens for a continent. Base geography is public, so
// far out the veil over unwalked ground thins to a wash and the atlas becomes a
// record of where the party has been rather than a wall of dark.
export function lodFogScale(tier) {
  if (tier === "local") return 1;
  return tier === "region" ? 0.66 : 0.38;
}
