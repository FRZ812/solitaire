import {
  CONTINENT,
  CONTINENT_HOT_SPRINGS,
  CONTINENT_LAKES,
  CONTINENT_ROUTES,
  CONTINENT_WATERWAYS,
  LANDMARKS,
  MOUNTAIN_SPINE,
  NORTHERN_RIDGES,
} from "../../data/continent.js";
import { WHITEMARCH_CAPITAL } from "../../data/whitemarch-capital.js";
import { continentValueAt, surveyAtlas } from "../../engine/world-generation.js";

export const ATLAS_3D_FOV_DEG = 34;
export const ATLAS_3D_PITCH_DEG = 38;
export const ATLAS_3D_FIT_PITCH_DEG = 32;
export const ATLAS_3D_NEAR_PITCH_DEG = 50;
export const ATLAS_3D_TERRAIN_STRIDE = 4;
export const ATLAS_3D_CHUNK_SIZE = CONTINENT.chunkSize;
export const ATLAS_3D_WINDOW_SPAN = 128;
export const ATLAS_3D_CAMERA_COAST_INSET = ATLAS_3D_TERRAIN_STRIDE;
export const ATLAS_3D_RENDER_VERSION = "atlas-terrain-3d-v10-chunked";
export const ATLAS_3D_MAX_ZOOM = 26;
export const ATLAS_3D_TREE_RECORD_STRIDE = 8;
export const ATLAS_3D_ROCK_RECORD_STRIDE = 6;
export const ATLAS_3D_FIELD_RECORD_STRIDE = 7;
export const ATLAS_3D_ENVIRON_RECORD_STRIDE = 6;
export const ATLAS_3D_TREE_SPECIES = Object.freeze({
  conifer: 0,
  broadleaf: 1,
  scrub: 2,
  cherry: 3,
  ginkgo: 4,
});

// Deterministic noise streams (salts) used by the terrain model, all keyed by
// the world seed. Every stream must be listed here so overhauls never collide:
//   +43  woodland grove mask          +199 primary color variance
//   +311 secondary color variance     +401 crag relief (fine ridged)
//   +409 crag relief (broad ridged)   +419 category-border blend
//   +421 snow-line edge break         +423 moisture hue drift
//   +427 lowland undulation           +431 rock and scree placement
//   +433 field placement              +439 settlement environs
const SALT_CRAG_FINE = 401;
const SALT_CRAG_BROAD = 409;
const SALT_CATEGORY_BORDER = 419;
const SALT_SNOW_EDGE = 421;
const SALT_MOISTURE = 423;
const SALT_UNDULATION = 427;
const SALT_ROCKS = 431;
const SALT_FIELDS = 433;
const SALT_ENVIRONS = 439;

const DEG_TO_RAD = Math.PI / 180;
const SQRT_THREE_OVER_TWO = Math.sqrt(3) / 2;
const FOV_TAN = Math.tan((ATLAS_3D_FOV_DEG * DEG_TO_RAD) / 2);
const CAMERA_MIN_CLEARANCE = 3;
const TERRAIN_MAX_HEIGHT = 42;
const TERRAIN_MIN_HEIGHT = -2.8;
const SNOW_CAP_HEIGHT = 30;
const SNOW_CAP_COLOR = 0xd8ddd0;
const COASTAL_SAND_COLOR = 0xb8a870;
const FROZEN_SHELF_COLOR = 0x93a29f;
const COASTAL_BAND_RADIUS = 3;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const SETTLEMENT_PROP_KINDS = new Set(["settlement", "village", "town", "city", "fortress", "port"]);
// Atlas-only anchors that are intentionally absent from the travel generator.
// Keeping this small, data-only projection here prevents the terrain worker
// from importing the full atlas UI/model graph (which reaches persistence and
// Supabase code) merely to clear props around visible miniatures.
const ATLAS_PROP_DETAIL_LANDMARKS = Object.freeze([
  { id: WHITEMARCH_CAPITAL.id, kind: "city", capitalOfRealmId: "central", coord: WHITEMARCH_CAPITAL.center },
  { id: "alderfield", kind: "village", coord: { x: -72, y: -20 } },
  { id: "millcross", kind: "village", coord: { x: -38, y: 44 } },
  { id: "whitewend-lea", kind: "village", coord: { x: -18, y: -48 } },
  { id: "shepherds-rest", kind: "village", coord: { x: 24, y: 50 } },
  { id: "barleywick", kind: "village", coord: { x: 62, y: -32 } },
  { id: "bellmead", kind: "village", coord: { x: 76, y: 42 } },
  { id: "bramble-pass-keep", kind: "fortress", coord: { x: -145, y: 30 } },
  { id: "reedmarch-keep", kind: "fortress", coord: { x: 150, y: -20 } },
  { id: "temple-still-waters", kind: "pagoda", coord: { x: 355, y: -60 } },
  { id: "temple-reed-crane", kind: "pagoda", coord: { x: 430, y: 45 } },
  { id: "mountain-hermitage", kind: "pagoda", coord: { x: 90, y: -140 } },
  { id: "jade-porch", kind: "pagoda", coord: { x: 310, y: 110 } },
]);
const ATLAS_PROP_LANDMARKS = Object.freeze([...LANDMARKS, ...ATLAS_PROP_DETAIL_LANDMARKS]);
const COASTAL_NEIGHBOR_OFFSETS = Object.freeze((() => {
  const offsets = [];
  for (let y = -COASTAL_BAND_RADIUS; y <= COASTAL_BAND_RADIUS; y += 1) {
    for (let x = -COASTAL_BAND_RADIUS; x <= COASTAL_BAND_RADIUS; x += 1) {
      if (x === 0 && y === 0) continue;
      const distance = (Math.abs(x) + Math.abs(y) + Math.abs(x + y)) / 2;
      if (distance <= COASTAL_BAND_RADIUS) offsets.push(Object.freeze({ x, y }));
    }
  }
  return offsets;
})());

// Per-realm biome palettes: each entry is [central, north, east, south, west].
// Indices match REALM_INDICES below. Shared manmade terrain types (settlement,
// street, road, wall, indoor) get mild biome tinting so settlements feel placed
// in their climate rather than copy-pasted.
const BIOME_PALETTES = Object.freeze([
  // 0 — central: temperate Whitemarch heartlands
  Object.freeze({
    plains: 0x4e6835, hills: 0x5e4232, forest: 0x1e4228, marsh: 0x2a5048,
    mountains: 0x504a48, impassable: 0x39483e, water: 0x173e50,
    settlement: 0x9c8158, street: 0xa58d65, road: 0xb79359, wall: 0x766d61, indoor: 0x776653,
  }),
  // 1 — north: sub-arctic Frostcrown
  Object.freeze({
    plains: 0x687872, hills: 0x4a4e52, forest: 0x182a1c, marsh: 0x1e2e2e,
    mountains: 0xaab8b8, impassable: 0x2e3838, water: 0x102a38,
    settlement: 0x8a7a68, street: 0x957f6a, road: 0xa08a6e, wall: 0x7a7870, indoor: 0x6a6060,
  }),
  // 2 — east: subtropical Sea of Reeds
  Object.freeze({
    plains: 0x4a6638, hills: 0x565030, forest: 0x1e4828, marsh: 0x2a5a4a,
    mountains: 0x505050, impassable: 0x2e3c36, water: 0x124040,
    settlement: 0x9a8060, street: 0xa58a65, road: 0xb08868, wall: 0x6e6858, indoor: 0x6a5e48,
  }),
  // 3 — south: arid Sunscar desert
  Object.freeze({
    plains: 0x887840, hills: 0x6e4e28, forest: 0x3a5020, marsh: 0x3a4a30,
    mountains: 0x685840, impassable: 0x403830, water: 0x164048,
    settlement: 0xa08850, street: 0xaa9055, road: 0xb89a5a, wall: 0x7a7258, indoor: 0x7a6848,
  }),
  // 4 — west: ancient Elderwood forest
  Object.freeze({
    plains: 0x3c5e30, hills: 0x3a3a20, forest: 0x0f2212, marsh: 0x1c3a2a,
    mountains: 0x3c4040, impassable: 0x2a3028, water: 0x103038,
    settlement: 0x8a7850, street: 0x907c58, road: 0xa0885a, wall: 0x686858, indoor: 0x686055,
  }),
]);

const REALM_INDICES = Object.freeze({ central: 0, north: 1, east: 2, south: 3, west: 4 });

function terrainColor(terrain, realmId) {
  const palette = BIOME_PALETTES[REALM_INDICES[realmId] ?? 0];
  return palette[terrain] ?? palette.plains;
}
const HEIGHT_CACHE = new Map();
const LAKE_SURFACE_HEIGHT_CACHE = new Map();
const TERRAIN_CHUNK_HEIGHTS = new Map();
const TERRAIN_CHUNK_SURVEY_CACHE = new Map();
const FIT_ZOOM_CACHE = new Map();
const WINDOW_FLOOR_CACHE = new Map();
let lastCameraFrameKey = "";
let lastCameraFrame = null;

function invalidateAtlas3dCameraFrame() {
  lastCameraFrameKey = "";
  lastCameraFrame = null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
  const mix = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return mix * mix * (3 - 2 * mix);
}

function atlas3dSeedCacheKey(seed) {
  return `${typeof seed}:${String(seed)}`;
}

function atlas3dChunkSurvey(x, y, seed) {
  const key = `${atlas3dSeedCacheKey(seed)}|${x},${y}`;
  if (TERRAIN_CHUNK_SURVEY_CACHE.has(key)) return TERRAIN_CHUNK_SURVEY_CACHE.get(key);
  const sample = surveyAtlas(x, y, seed);
  if (TERRAIN_CHUNK_SURVEY_CACHE.size >= 65536) {
    TERRAIN_CHUNK_SURVEY_CACHE.delete(TERRAIN_CHUNK_SURVEY_CACHE.keys().next().value);
  }
  TERRAIN_CHUNK_SURVEY_CACHE.set(key, sample);
  return sample;
}

function integerChunkCoordinate(value, label) {
  const resolved = Number(value);
  if (!Number.isInteger(resolved)) {
    throw new TypeError(`${label} must be an integer chunk coordinate`);
  }
  return resolved;
}

export function atlas3dChunkKey(cx, cy) {
  const coord = cx && typeof cx === "object" ? cx : { cx, cy };
  return `${integerChunkCoordinate(coord.cx, "cx")},${integerChunkCoordinate(coord.cy, "cy")}`;
}

export function atlas3dChunkForAxial(coordOrX, maybeY) {
  const coord = coordOrX && typeof coordOrX === "object"
    ? coordOrX
    : { x: coordOrX, y: maybeY };
  if (!Number.isFinite(coord?.x) || !Number.isFinite(coord?.y)) {
    throw new TypeError("atlas3dChunkForAxial requires finite axial coordinates");
  }
  return {
    cx: Math.floor(coord.x / ATLAS_3D_CHUNK_SIZE),
    cy: Math.floor(coord.y / ATLAS_3D_CHUNK_SIZE),
  };
}

export function atlas3dChunkRect(cx, cy) {
  const resolvedCx = integerChunkCoordinate(cx, "cx");
  const resolvedCy = integerChunkCoordinate(cy, "cy");
  const xmin = resolvedCx * ATLAS_3D_CHUNK_SIZE;
  const ymin = resolvedCy * ATLAS_3D_CHUNK_SIZE;
  return {
    cx: resolvedCx,
    cy: resolvedCy,
    xmin,
    xmax: xmin + ATLAS_3D_CHUNK_SIZE,
    ymin,
    ymax: ymin + ATLAS_3D_CHUNK_SIZE,
    width: ATLAS_3D_CHUNK_SIZE,
    height: ATLAS_3D_CHUNK_SIZE,
  };
}

export function atlas3dPitchFor(zoom, fitZoom) {
  const safeFit = Math.max(0.001, Number(fitZoom) || 0.001);
  const safeZoom = Math.max(safeFit, Number(zoom) || safeFit);
  const maxRatio = Math.max(1.001, ATLAS_3D_MAX_ZOOM / safeFit);
  const logProgress = clamp(Math.log(safeZoom / safeFit) / Math.log(maxRatio), 0, 1);
  const eased = logProgress * logProgress * (3 - 2 * logProgress);
  return (ATLAS_3D_FIT_PITCH_DEG
    + (ATLAS_3D_NEAR_PITCH_DEG - ATLAS_3D_FIT_PITCH_DEG) * eased) * DEG_TO_RAD;
}

function clampCenter(center, footprint, boundMin, boundMax) {
  // Keep the camera's zoom-scaled ground footprint inside the authoritative
  // axial domain. Clamping axial axes independently avoids the empty corners
  // introduced by bounding the sheared scene projection as a rectangle.
  const paddedFootprint = footprint + ATLAS_3D_CAMERA_COAST_INSET * 2;
  if (paddedFootprint >= boundMax - boundMin) return (boundMin + boundMax) / 2;
  const half = paddedFootprint / 2;
  return clamp(center, boundMin + half, boundMax - half);
}

function clampCamera(camera, viewport, seed = CONTINENT.seed, allowPaperFit = false) {
  const fit = atlas3dFitZoom(viewport, seed);
  const floor = allowPaperFit ? fit : atlas3dWindowFloor(viewport, seed);
  const zoom = clamp(camera.zoom, floor, ATLAS_3D_MAX_ZOOM);
  const visibleFraction = clamp(fit / zoom, 0, 1);
  const footprint = {
    x: (CONTINENT.bounds.xmax - CONTINENT.bounds.xmin) * visibleFraction,
    y: (CONTINENT.bounds.ymax - CONTINENT.bounds.ymin) * visibleFraction,
  };
  const clamped = {
    zoom,
    x: clampCenter(
      camera.x,
      footprint.x,
      CONTINENT.bounds.xmin,
      CONTINENT.bounds.xmax,
    ),
    y: clampCenter(
      camera.y,
      footprint.y,
      CONTINENT.bounds.ymin,
      CONTINENT.bounds.ymax,
    ),
  };
  return {
    ...clamped,
    targetHeight: Number.isFinite(camera.targetHeight)
      ? clamp(camera.targetHeight, TERRAIN_MIN_HEIGHT, TERRAIN_MAX_HEIGHT)
      : cameraTerrainHeight(clamped, seed),
  };
}

export function atlas3dFitZoom(viewport, seed = CONTINENT.seed) {
  const width = Math.max(1, viewport?.width || 1);
  const height = Math.max(1, viewport?.height || 1);
  const key = `${seed}|${width}x${height}`;
  if (FIT_ZOOM_CACHE.has(key)) return FIT_ZOOM_CACHE.get(key);
  const center = {
    x: (CONTINENT.bounds.xmin + CONTINENT.bounds.xmax) / 2,
    y: (CONTINENT.bounds.ymin + CONTINENT.bounds.ymax) / 2,
  };
  const corners = [
    { x: CONTINENT.bounds.xmin, y: CONTINENT.bounds.ymin },
    { x: CONTINENT.bounds.xmin, y: CONTINENT.bounds.ymax },
    { x: CONTINENT.bounds.xmax, y: CONTINENT.bounds.ymin },
    { x: CONTINENT.bounds.xmax, y: CONTINENT.bounds.ymax },
  ];
  const padding = Math.min(32, Math.max(12, Math.min(width, height) * 0.035));
  const fits = (zoom) => {
    const camera = { ...center, zoom };
    for (const coord of corners) {
      for (const terrainHeight of [TERRAIN_MIN_HEIGHT, TERRAIN_MAX_HEIGHT]) {
        const screen = atlas3dProject(camera, viewport, coord, terrainHeight, seed);
        if (screen.x < padding || screen.x > width - padding || screen.y < padding || screen.y > height - padding) {
          return false;
        }
      }
    }
    return true;
  };
  let lower = 0.03;
  let upper = 1;
  while (upper < ATLAS_3D_MAX_ZOOM && fits(upper)) upper *= 2;
  upper = Math.min(ATLAS_3D_MAX_ZOOM, upper);
  for (let pass = 0; pass < 34; pass += 1) {
    const middle = (lower + upper) / 2;
    if (fits(middle)) lower = middle;
    else upper = middle;
  }
  const fit = lower * 0.995;
  FIT_ZOOM_CACHE.set(key, fit);
  invalidateAtlas3dCameraFrame();
  if (FIT_ZOOM_CACHE.size > 40) FIT_ZOOM_CACHE.delete(FIT_ZOOM_CACHE.keys().next().value);
  return fit;
}

// The 3D presentation is deliberately local. This is expressed as a multiple
// of the authoritative continent fit so it remains stable across aspect ratios
// while preserving the existing camera's zoom semantics. The widest axial
// domain is the limiting axis for Avarra's 128-hex travel window.
export function atlas3dWindowFloor(viewport, seed = CONTINENT.seed) {
  const width = Math.max(1, viewport?.width || 1);
  const height = Math.max(1, viewport?.height || 1);
  const key = `${seed}|${width}x${height}`;
  if (WINDOW_FLOOR_CACHE.has(key)) return WINDOW_FLOOR_CACHE.get(key);
  const fit = atlas3dFitZoom(viewport, seed);
  const center = {
    x: (CONTINENT.bounds.xmin + CONTINENT.bounds.xmax) / 2,
    y: (CONTINENT.bounds.ymin + CONTINENT.bounds.ymax) / 2,
    targetHeight: 0,
  };
  // Perspective pitch makes a simple continent-span ratio substantially
  // under-estimate the ground visible above the target. Solve against the
  // actual camera rays instead, with a little terrain-relief safety margin so
  // the worker's desired set remains below the tier cache at the 3D floor.
  const footprintSpan = (zoom) => {
    const frame = atlas3dCameraFrame({ ...center, zoom }, viewport, seed);
    const coords = [];
    for (const point of [
      [0, 0], [width / 2, 0], [width, 0],
      [0, height / 2], [width / 2, height / 2], [width, height / 2],
      [0, height], [width / 2, height], [width, height],
    ]) {
      const ndcX = point[0] / width * 2 - 1;
      const ndcY = 1 - point[1] / height * 2;
      const aspect = width / height;
      const direction = {
        x: ndcX * FOV_TAN * aspect,
        y: -frame.pitchCos + ndcY * FOV_TAN * frame.pitchSin,
        z: -frame.pitchSin - ndcY * FOV_TAN * frame.pitchCos,
      };
      const length = Math.hypot(direction.x, direction.y, direction.z) || 1;
      direction.x /= length;
      direction.y /= length;
      direction.z /= length;
      const travel = (frame.target.y - frame.position.y) / direction.y;
      coords.push(atlas3dSceneToAxial({
        x: frame.position.x + direction.x * travel,
        z: frame.position.z + direction.z * travel,
      }));
    }
    return Math.max(
      Math.max(...coords.map((coord) => coord.x)) - Math.min(...coords.map((coord) => coord.x)),
      Math.max(...coords.map((coord) => coord.y)) - Math.min(...coords.map((coord) => coord.y)),
    );
  };
  const targetSpan = ATLAS_3D_WINDOW_SPAN * 0.94;
  let lower = Math.min(ATLAS_3D_MAX_ZOOM, fit * 8.6);
  let upper = ATLAS_3D_MAX_ZOOM;
  for (let pass = 0; pass < 28; pass += 1) {
    const middle = (lower + upper) / 2;
    if (footprintSpan(middle) > targetSpan) lower = middle;
    else upper = middle;
  }
  const floor = clamp(upper, fit, ATLAS_3D_MAX_ZOOM);
  WINDOW_FLOOR_CACHE.set(key, floor);
  if (WINDOW_FLOOR_CACHE.size > 40) {
    WINDOW_FLOOR_CACHE.delete(WINDOW_FLOOR_CACHE.keys().next().value);
  }
  return floor;
}

export function clampAtlas3dCamera(camera, viewport, seed = CONTINENT.seed) {
  return clampCamera(camera, viewport, seed);
}

export function fitAtlas3dCamera(camera, viewport, seed = CONTINENT.seed) {
  const fitted = {
    ...camera,
    x: (CONTINENT.bounds.xmin + CONTINENT.bounds.xmax) / 2,
    y: (CONTINENT.bounds.ymin + CONTINENT.bounds.ymax) / 2,
    zoom: atlas3dFitZoom(viewport, seed),
  };
  return clampCamera({
    ...fitted,
    targetHeight: cameraTerrainHeight(fitted, seed),
  }, viewport, seed, true);
}

export function coordinateNoise(x, y, salt = 0) {
  let saltValue = Number.isFinite(salt) ? salt | 0 : 2166136261;
  if (!Number.isFinite(salt)) {
    for (const character of String(salt)) {
      saltValue ^= character.charCodeAt(0);
      saltValue = Math.imul(saltValue, 16777619);
    }
  }
  let value = Math.imul((x + saltValue * 31) | 0, 374761393) ^ Math.imul((y - saltValue * 17) | 0, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function interpolatedCoordinateNoise(x, y, cellSize, salt) {
  const scaledX = x / cellSize;
  const scaledY = y / cellSize;
  const lowerX = Math.floor(scaledX);
  const lowerY = Math.floor(scaledY);
  const mixX = smoothstep(0, 1, scaledX - lowerX);
  const mixY = smoothstep(0, 1, scaledY - lowerY);
  const top = coordinateNoise(lowerX, lowerY, salt)
    + (coordinateNoise(lowerX + 1, lowerY, salt) - coordinateNoise(lowerX, lowerY, salt)) * mixX;
  const bottom = coordinateNoise(lowerX, lowerY + 1, salt)
    + (coordinateNoise(lowerX + 1, lowerY + 1, salt) - coordinateNoise(lowerX, lowerY + 1, salt)) * mixX;
  return top + (bottom - top) * mixY;
}

function colorChannels(hex, light = 0) {
  const factor = 1 + light;
  return [
    clamp(((hex >> 16) & 255) * factor / 255, 0, 1),
    clamp(((hex >> 8) & 255) * factor / 255, 0, 1),
    clamp((hex & 255) * factor / 255, 0, 1),
  ];
}

function blendColorChannels(channels, hex, weight) {
  const target = colorChannels(hex);
  const mix = clamp(weight, 0, 1);
  return channels.map((channel, index) => channel + (target[index] - channel) * mix);
}

export function atlas3dAxialToScene(coord) {
  return {
    x: coord.x + coord.y * 0.5,
    z: coord.y * SQRT_THREE_OVER_TWO,
  };
}

export function atlas3dSceneToAxial(point) {
  const y = point.z / SQRT_THREE_OVER_TWO;
  return { x: point.x - y * 0.5, y };
}

export function atlas3dWaterFeatureContains(coord, feature, padding = 0) {
  if (!coord || !feature?.center) return false;
  const point = atlas3dAxialToScene(coord);
  const center = atlas3dAxialToScene(feature.center);
  return Math.hypot(point.x - center.x, point.z - center.z) <= feature.radius + padding;
}

export function atlas3dAuthoredWaterContains(coord, padding = 0) {
  return [...CONTINENT_LAKES, ...CONTINENT_HOT_SPRINGS].some((feature) => (
    atlas3dWaterFeatureContains(coord, feature, padding)
  ));
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.z - start.z);
  const progress = clamp(
    ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared,
    0,
    1,
  );
  return Math.hypot(
    point.x - (start.x + dx * progress),
    point.z - (start.z + dz * progress),
  );
}

const ATLAS_3D_PROP_LANDMARK_CLEARANCES = Object.freeze(ATLAS_PROP_LANDMARKS.map((landmark) => ({
  id: landmark.id,
  center: atlas3dAxialToScene(landmark.coord),
  clearance: landmark.capitalOfRealmId
    ? 13
    : landmark.kind === "city" || landmark.kind === "wonder"
    ? 11
    : ["town", "fortress", "castle", "port"].includes(landmark.kind)
    ? 8
    : ["village", "pagoda", "shrine", "temple", "sanctuary", "monastery"].includes(landmark.kind)
    ? 6
    : 4.5,
})));

const ATLAS_3D_PROP_CORRIDORS = Object.freeze(
  [...CONTINENT_ROUTES, ...CONTINENT_WATERWAYS].map((corridor) => ({
    clearance: Math.max(
      corridor.width || 0,
      corridor.widthStart || 0,
      corridor.widthEnd || 0,
      corridor.kind === "regional-road" ? 1.2 : 1.9,
    ) / 2 + 2.7,
    waypoints: corridor.waypoints.map(atlas3dAxialToScene),
  })),
);

function clearsAtlas3dPropFeatures(coord, padding = 0, ignoredLandmarkId = null) {
  const scene = atlas3dAxialToScene(coord);
  for (const landmark of ATLAS_3D_PROP_LANDMARK_CLEARANCES) {
    if (landmark.id === ignoredLandmarkId) continue;
    if (Math.hypot(scene.x - landmark.center.x, scene.z - landmark.center.z)
      < landmark.clearance + padding) return false;
  }
  for (const corridor of ATLAS_3D_PROP_CORRIDORS) {
    for (let index = 1; index < corridor.waypoints.length; index += 1) {
      if (distanceToSegment(scene, corridor.waypoints[index - 1], corridor.waypoints[index])
        < corridor.clearance + padding) return false;
    }
  }
  return true;
}

const PROJECTED_MOUNTAIN_SPINE = Object.freeze(
  MOUNTAIN_SPINE.waypoints.map((waypoint) => Object.freeze(atlas3dAxialToScene(waypoint))),
);
const PROJECTED_NORTHERN_RIDGES = Object.freeze((NORTHERN_RIDGES || []).map((ridge) => Object.freeze({
  ...ridge,
  waypoints: Object.freeze(ridge.waypoints.map((waypoint) => Object.freeze(atlas3dAxialToScene(waypoint)))),
})));

function projectedPathWeight(point, waypoints, width) {
  let distance = Infinity;
  for (let index = 1; index < waypoints.length; index += 1) {
    distance = Math.min(distance, distanceToSegment(point, waypoints[index - 1], waypoints[index]));
  }
  return distance >= width ? 0 : 1 - distance / width;
}

export function mountainSpineReliefWeightAt(coord) {
  if (!coord || !Number.isFinite(coord.x) || !Number.isFinite(coord.y)) return 0;
  return projectedPathWeight(
    atlas3dAxialToScene(coord),
    PROJECTED_MOUNTAIN_SPINE,
    MOUNTAIN_SPINE.width,
  );
}

export function northernRidgeElevationBoostAt(coord) {
  if (!coord || !Number.isFinite(coord.x) || !Number.isFinite(coord.y)) return 0;
  const point = atlas3dAxialToScene(coord);
  let boost = 0;
  for (const ridge of PROJECTED_NORTHERN_RIDGES) {
    let distance = Infinity;
    for (let index = 1; index < ridge.waypoints.length; index += 1) {
      distance = Math.min(
        distance,
        distanceToSegment(point, ridge.waypoints[index - 1], ridge.waypoints[index]),
      );
    }
    if (distance >= ridge.width) continue;
    boost = Math.max(boost, ridge.elevationBoost * (1 - distance / ridge.width));
  }
  return boost;
}

function northernRidgeReliefWeightAt(coord) {
  if (!coord || !Number.isFinite(coord.x) || !Number.isFinite(coord.y)) return 0;
  const point = atlas3dAxialToScene(coord);
  let weight = 0;
  for (const ridge of PROJECTED_NORTHERN_RIDGES) {
    weight = Math.max(weight, projectedPathWeight(point, ridge.waypoints, ridge.width));
  }
  return weight;
}

function terrainLiftFor(sample, coord, terrainWeights = null, terrainWeightOffset = 0, northWeight = null) {
  const elevation = clamp(sample.elevation, 0, 1.4);
  const mountainWeight = terrainWeights
    ? terrainWeights[terrainWeightOffset]
    : sample.terrain === "mountains" ? 1 : 0;
  const hillWeight = terrainWeights
    ? terrainWeights[terrainWeightOffset + 1]
    : sample.terrain === "hills" ? 1 : 0;
  const forestWeight = terrainWeights
    ? terrainWeights[terrainWeightOffset + 2]
    : sample.terrain === "forest" ? 1 : 0;

  // Category identity modulates smooth elevation curves instead of adding a
  // fixed pedestal. During worker builds these weights are blurred over the
  // sampled grid, producing a deterministic three-to-six-cell ramp at biome
  // borders rather than the wall-like mountain/hill steps seen at close zoom.
  const generalLift = mountainWeight * (
    3.2 * smoothstep(0.5, 0.72, elevation)
      + 5.3 * smoothstep(0.7, 0.95, elevation)
  ) + hillWeight * 2.25 * smoothstep(0.38, 0.76, elevation)
    + forestWeight * 0.65 * smoothstep(0.26, 0.58, elevation);

  const resolvedNorthWeight = clamp(
    Number.isFinite(northWeight) ? northWeight : sample?.realmId === "north" ? 1 : 0,
    0,
    1,
  );
  if (!coord || resolvedNorthWeight <= 0) return generalLift;

  // Frostcrown's broad shelves reserve the full vertical drama for authored
  // ridges. The climate weight is grid-blended; there is deliberately no raw
  // latitude threshold, which previously cut a pale horizontal band through
  // the eastern realm at y=-170.
  const ridgeWeight = Math.max(
    mountainSpineReliefWeightAt(coord),
    northernRidgeReliefWeightAt(coord),
  );
  const authoredRelief = ridgeWeight * ridgeWeight;
  const northernLift = (
    2.6 * smoothstep(0.48, 0.7, elevation)
      + 5.9 * smoothstep(0.68, 0.92, elevation)
  ) * (0.35 + authoredRelief * 0.65);
  return generalLift + (northernLift - generalLift) * resolvedNorthWeight;
}

export function atlas3dBaseTerrainHeight(
  sample,
  coord = null,
  seed = CONTINENT.seed,
  terrainWeights = null,
  northWeight = null,
  terrainWeightOffset = 0,
) {
  if (!sample?.land) return -2.8;
  const resolvedNorthWeight = clamp(
    Number.isFinite(northWeight) ? northWeight : sample.realmId === "north" ? 1 : 0,
    0,
    1,
  );
  const ridgeWeight = coord && resolvedNorthWeight > 0
    ? Math.max(mountainSpineReliefWeightAt(coord), northernRidgeReliefWeightAt(coord))
    : 1;
  const authoredRelief = ridgeWeight * ridgeWeight;
  const northernReliefScale = 0.22 + authoredRelief * 0.78;
  const reliefScale = 1 + (northernReliefScale - 1) * resolvedNorthWeight;
  const elevation = 0.16
    + (sample.elevation - 0.16) * reliefScale
    + northernRidgeElevationBoostAt(coord);
  const terrainLift = terrainLiftFor(
    sample,
    coord,
    terrainWeights,
    terrainWeightOffset,
    resolvedNorthWeight,
  );
  let height = (elevation - 0.16) * 28 + terrainLift;
  if (coord) {
    // Erosion-flavored detail: ridged octaves carve crags into uplands while a
    // broad, gentle undulation keeps lowland plains from reading as billiard
    // felt. Both fade out on frozen shelves so glacial plateaus stay serene.
    const ruggedness = smoothstep(3.5, 12, height) * (1 - resolvedNorthWeight * 0.65);
    if (ruggedness > 0) {
      const cragFine = Math.abs(
        interpolatedCoordinateNoise(coord.x, coord.y, 7, seed + SALT_CRAG_FINE) * 2 - 1,
      );
      const cragBroad = Math.abs(
        interpolatedCoordinateNoise(coord.x, coord.y, 3, seed + SALT_CRAG_BROAD) * 2 - 1,
      );
      height += ((0.62 - cragFine) * 1.9 + (0.5 - cragBroad) * 0.7) * ruggedness;
    }
    const undulation = interpolatedCoordinateNoise(
      coord.x,
      coord.y,
      21,
      seed + SALT_UNDULATION,
    ) - 0.5;
    height += undulation * (1.1 - resolvedNorthWeight * 0.7);
  }
  return clamp(height, 0.4, TERRAIN_MAX_HEIGHT);
}

function lakeSurfaceCacheKey(lake, seed) {
  return `${seed}|${lake.id || lake.name}|${lake.center.x},${lake.center.y}|${lake.radius}`;
}

export function atlas3dLakeSurfaceHeight(lake, seed = CONTINENT.seed) {
  const key = lakeSurfaceCacheKey(lake, seed);
  if (LAKE_SURFACE_HEIGHT_CACHE.has(key)) return LAKE_SURFACE_HEIGHT_CACHE.get(key);

  const sampleCoords = [lake.center];
  const centerScene = atlas3dAxialToScene(lake.center);
  const shorelineRadius = Math.max(3, lake.radius + ATLAS_3D_TERRAIN_STRIDE * 1.6);
  for (let index = 0; index < 16; index += 1) {
    const angle = index / 16 * Math.PI * 2;
    sampleCoords.push(atlas3dSceneToAxial({
      x: centerScene.x + Math.cos(angle) * shorelineRadius,
      z: centerScene.z + Math.sin(angle) * shorelineRadius,
    }));
  }
  const heights = sampleCoords
    .map((coord) => atlas3dBaseTerrainHeight(surveyAtlas(coord.x, coord.y, seed), coord, seed))
    .filter((height) => height > TERRAIN_MIN_HEIGHT + 0.1)
    .sort((a, b) => a - b);
  const centerHeight = atlas3dBaseTerrainHeight(
    surveyAtlas(lake.center.x, lake.center.y, seed),
    lake.center,
    seed,
  );
  const lowerShore = heights[Math.floor(Math.max(0, heights.length - 1) * 0.3)] ?? centerHeight;
  const surfaceHeight = clamp(Math.min(centerHeight, lowerShore) + 0.16, 0.52, TERRAIN_MAX_HEIGHT - 0.8);
  LAKE_SURFACE_HEIGHT_CACHE.set(key, surfaceHeight);
  if (LAKE_SURFACE_HEIGHT_CACHE.size > 96) {
    LAKE_SURFACE_HEIGHT_CACHE.delete(LAKE_SURFACE_HEIGHT_CACHE.keys().next().value);
  }
  return surfaceHeight;
}

export function atlas3dHotSpringSurfaceHeight(spring, seed = CONTINENT.seed) {
  const key = `${seed}|hot-spring|${spring.id || spring.name}|${spring.center.x},${spring.center.y}|${spring.radius}`;
  if (LAKE_SURFACE_HEIGHT_CACHE.has(key)) return LAKE_SURFACE_HEIGHT_CACHE.get(key);
  const centerScene = atlas3dAxialToScene(spring.center);
  const sampleCoords = [spring.center];
  const shorelineRadius = spring.radius + ATLAS_3D_TERRAIN_STRIDE * 1.35;
  for (let index = 0; index < 12; index += 1) {
    const angle = index / 12 * Math.PI * 2;
    sampleCoords.push(atlas3dSceneToAxial({
      x: centerScene.x + Math.cos(angle) * shorelineRadius,
      z: centerScene.z + Math.sin(angle) * shorelineRadius,
    }));
  }
  const heights = sampleCoords
    .map((coord) => atlas3dBaseTerrainHeight(surveyAtlas(coord.x, coord.y, seed), coord, seed))
    .filter((height) => height > TERRAIN_MIN_HEIGHT + 0.1)
    .sort((a, b) => a - b);
  const centerHeight = atlas3dBaseTerrainHeight(
    surveyAtlas(spring.center.x, spring.center.y, seed),
    spring.center,
    seed,
  );
  const lowerShore = heights[Math.floor(Math.max(0, heights.length - 1) * 0.3)] ?? centerHeight;
  const surfaceHeight = clamp(Math.min(centerHeight, lowerShore) + 0.22, 0.58, TERRAIN_MAX_HEIGHT - 0.6);
  LAKE_SURFACE_HEIGHT_CACHE.set(key, surfaceHeight);
  return surfaceHeight;
}

function lakeBasinHeightAt(coord, height, seed) {
  let result = height;
  const point = atlas3dAxialToScene(coord);
  for (const lake of CONTINENT_LAKES) {
    const lakeCenter = atlas3dAxialToScene(lake.center);
    const distance = Math.hypot(point.x - lakeCenter.x, point.z - lakeCenter.z);
    const innerRadius = lake.radius * 1.05 + ATLAS_3D_TERRAIN_STRIDE * 1.2;
    const outerRadius = innerRadius + ATLAS_3D_TERRAIN_STRIDE * 1.4;
    if (distance >= outerRadius) continue;
    const waterHeight = atlas3dLakeSurfaceHeight(lake, seed);
    const bedHeight = waterHeight - 0.46;
    if (distance <= innerRadius) {
      result = bedHeight;
      continue;
    }
    const linearMix = (distance - innerRadius) / Math.max(0.001, outerRadius - innerRadius);
    const smoothMix = linearMix * linearMix * (3 - 2 * linearMix);
    result = bedHeight + (result - bedHeight) * smoothMix;
  }
  for (const spring of CONTINENT_HOT_SPRINGS) {
    const springCenter = atlas3dAxialToScene(spring.center);
    const distance = Math.hypot(point.x - springCenter.x, point.z - springCenter.z);
    const innerRadius = spring.radius * 1.08 + ATLAS_3D_TERRAIN_STRIDE * 1.15;
    const outerRadius = innerRadius + ATLAS_3D_TERRAIN_STRIDE * 1.25;
    if (distance >= outerRadius) continue;
    const waterHeight = atlas3dHotSpringSurfaceHeight(spring, seed);
    const bedHeight = waterHeight - 0.34;
    if (distance <= innerRadius) {
      result = bedHeight;
      continue;
    }
    const linearMix = (distance - innerRadius) / Math.max(0.001, outerRadius - innerRadius);
    const smoothMix = linearMix * linearMix * (3 - 2 * linearMix);
    result = bedHeight + (result - bedHeight) * smoothMix;
  }
  return result;
}

export function atlas3dTerrainHeight(sample, coord = null, seed = CONTINENT.seed) {
  const height = atlas3dBaseTerrainHeight(sample, coord, seed);
  if (!sample?.land || !coord) return height;
  return lakeBasinHeightAt(coord, height, seed);
}

function sampledTerrainHeight(coord, seed) {
  const key = `${atlas3dSeedCacheKey(seed)}|${coord.x},${coord.y}`;
  if (HEIGHT_CACHE.has(key)) return HEIGHT_CACHE.get(key);
  const height = atlas3dTerrainHeight(surveyAtlas(coord.x, coord.y, seed), coord, seed);
  if (HEIGHT_CACHE.size >= 100000) HEIGHT_CACHE.clear();
  HEIGHT_CACHE.set(key, height);
  return height;
}

function axisCell(value, min, max, stride) {
  const clamped = clamp(value, min, max);
  const cellCount = Math.max(1, Math.ceil((max - min) / stride));
  const cell = Math.min(cellCount - 1, Math.floor((clamped - min) / stride));
  const lower = min + cell * stride;
  const upper = Math.min(max, lower + stride);
  return { index: cell, lower, upper, mix: upper === lower ? 0 : (clamped - lower) / (upper - lower) };
}

function heightFromChunkLattice(
  heights,
  coord,
  origin,
  span = ATLAS_3D_CHUNK_SIZE,
  stride = 1,
) {
  if (!(heights instanceof Float32Array)
    || !Number.isFinite(coord?.x)
    || !Number.isFinite(coord?.y)
    || !Number.isInteger(stride)
    || stride < 1
    || span % stride !== 0
    || coord.x < origin.x
    || coord.x > origin.x + span
    || coord.y < origin.y
    || coord.y > origin.y + span) return null;
  const latticeColumns = span + 1;
  const localX = clamp(coord.x - origin.x, 0, span);
  const localY = clamp(coord.y - origin.y, 0, span);
  const cellCount = span / stride;
  const cellColumn = Math.min(cellCount - 1, Math.floor(localX / stride));
  const cellRow = Math.min(cellCount - 1, Math.floor(localY / stride));
  const column = cellColumn * stride;
  const row = cellRow * stride;
  const u = (localX - column) / stride;
  const v = (localY - row) / stride;
  const a = heights[row * latticeColumns + column];
  const b = heights[row * latticeColumns + column + stride];
  const c = heights[(row + stride) * latticeColumns + column];
  const d = heights[(row + stride) * latticeColumns + column + stride];
  return u + v <= 1
    ? a + (b - a) * u + (c - a) * v
    : b * (1 - v) + c * (1 - u) + d * (u + v - 1);
}

function registeredChunkHeightAt(coord, seed) {
  if (!Number.isFinite(coord?.x) || !Number.isFinite(coord?.y)) return null;
  const primary = atlas3dChunkForAxial(coord);
  const boundaryX = Math.abs(coord.x / ATLAS_3D_CHUNK_SIZE
    - Math.round(coord.x / ATLAS_3D_CHUNK_SIZE)) < 1e-9;
  const boundaryY = Math.abs(coord.y / ATLAS_3D_CHUNK_SIZE
    - Math.round(coord.y / ATLAS_3D_CHUNK_SIZE)) < 1e-9;
  const chunkXs = boundaryX ? [primary.cx, primary.cx - 1] : [primary.cx];
  const chunkYs = boundaryY ? [primary.cy, primary.cy - 1] : [primary.cy];
  for (const cy of chunkYs) {
    for (const cx of chunkXs) {
      const chunk = TERRAIN_CHUNK_HEIGHTS.get(terrainChunkHeightKey(seed, cx, cy));
      if (!chunk) continue;
      const height = heightFromChunkLattice(
        chunk.heights,
        coord,
        chunk.origin,
        chunk.span,
        chunk.stride,
      );
      if (height != null) return height;
    }
  }
  return null;
}

function terrainChunkHeightKey(seed, cx, cy) {
  return `${atlas3dSeedCacheKey(seed)}|${atlas3dChunkKey(cx, cy)}`;
}

// Presentation registry, not a worker/cache registry. Activate only the
// payload whose mesh is currently displayed so overlays, routes, landmarks,
// and picking helpers follow that mesh's actual LOD triangle surface.
export function registerAtlas3dChunkHeights(data) {
  const validSeed = typeof data?.seed === "string" || Number.isFinite(data?.seed);
  if (!data
    || data.version !== ATLAS_3D_RENDER_VERSION
    || !validSeed
    || !Number.isInteger(data.cx)
    || !Number.isInteger(data.cy)
    || data.span !== ATLAS_3D_CHUNK_SIZE
    || ![1, 2].includes(data.stride)
    || (data.lod != null && data.stride !== (data.lod === 0 ? 1 : data.lod === 1 ? 2 : NaN))
    || data.span % data.stride !== 0) return false;

  const key = terrainChunkHeightKey(data.seed, data.cx, data.cy);
  if (data.empty) {
    if (!(data.heights instanceof Float32Array) || data.heights.length !== 0) return false;
    TERRAIN_CHUNK_HEIGHTS.delete(key);
    invalidateAtlas3dCameraFrame();
    return true;
  }

  const latticeSize = ATLAS_3D_CHUNK_SIZE + 1;
  if (!(data.heights instanceof Float32Array)
    || data.heights.length !== latticeSize * latticeSize) return false;
  const rect = atlas3dChunkRect(data.cx, data.cy);
  if (!data.origin
    || data.origin.x !== rect.xmin
    || data.origin.y !== rect.ymin) return false;
  TERRAIN_CHUNK_HEIGHTS.set(key, {
    seed: data.seed,
    cx: data.cx,
    cy: data.cy,
    origin: data.origin,
    span: data.span,
    stride: data.stride,
    heights: data.heights,
  });
  invalidateAtlas3dCameraFrame();
  return true;
}

export function releaseAtlas3dChunkHeights(dataOrSeed, maybeCx, maybeCy) {
  const data = dataOrSeed && typeof dataOrSeed === "object"
    ? dataOrSeed
    : { seed: dataOrSeed, cx: maybeCx, cy: maybeCy };
  if ((typeof data.seed !== "string" && !Number.isFinite(data.seed))
    || !Number.isInteger(data.cx)
    || !Number.isInteger(data.cy)) return false;
  const key = terrainChunkHeightKey(data.seed, data.cx, data.cy);
  const registered = TERRAIN_CHUNK_HEIGHTS.get(key);
  // A late disposal from an outgoing LOD must not unregister the replacement
  // payload that was already painted for the same geographic chunk.
  if (data.heights instanceof Float32Array
    && registered
    && registered.heights !== data.heights) return false;
  const released = TERRAIN_CHUNK_HEIGHTS.delete(key);
  if (released) invalidateAtlas3dCameraFrame();
  return released;
}

// Routes, POIs, labels, and vegetation must sit on the rendered mesh rather
// than on a separately sampled procedural surface. When no streamed chunk is
// displayed at a coordinate, preserve the stride-4 analytic fallback and its
// triangle diagonal so camera and pre-stream projections stay stable.
export function atlas3dTerrainHeightAt(
  coord,
  seed = CONTINENT.seed,
) {
  const chunkHeight = registeredChunkHeightAt(coord, seed);
  if (chunkHeight != null) return chunkHeight;
  const stride = ATLAS_3D_TERRAIN_STRIDE;
  const xCell = axisCell(coord.x, CONTINENT.bounds.xmin, CONTINENT.bounds.xmax, stride);
  const yCell = axisCell(coord.y, CONTINENT.bounds.ymin, CONTINENT.bounds.ymax, stride);
  const a = sampledTerrainHeight({ x: xCell.lower, y: yCell.lower }, seed);
  const b = sampledTerrainHeight({ x: xCell.upper, y: yCell.lower }, seed);
  const c = sampledTerrainHeight({ x: xCell.lower, y: yCell.upper }, seed);
  const d = sampledTerrainHeight({ x: xCell.upper, y: yCell.upper }, seed);
  const u = xCell.mix;
  const v = yCell.mix;
  return u + v <= 1
    ? a + (b - a) * u + (c - a) * v
    : b * (1 - v) + c * (1 - u) + d * (u + v - 1);
}

export const ATLAS_3D_BOUNDS = (() => {
  const corners = [
    atlas3dAxialToScene({ x: CONTINENT.bounds.xmin, y: CONTINENT.bounds.ymin }),
    atlas3dAxialToScene({ x: CONTINENT.bounds.xmin, y: CONTINENT.bounds.ymax }),
    atlas3dAxialToScene({ x: CONTINENT.bounds.xmax, y: CONTINENT.bounds.ymin }),
    atlas3dAxialToScene({ x: CONTINENT.bounds.xmax, y: CONTINENT.bounds.ymax }),
  ];
  return Object.freeze({
    xmin: Math.min(...corners.map((point) => point.x)),
    xmax: Math.max(...corners.map((point) => point.x)),
    zmin: Math.min(...corners.map((point) => point.z)),
    zmax: Math.max(...corners.map((point) => point.z)),
  });
})();

function isCoastalGridVertex(coord, sample, seed) {
  if (!sample?.land) return false;
  // `sample.coast` is a cheap broad-phase test. The exact band is then
  // resolved in authoritative axial world hexes, not terrain-grid cells (the
  // render grid has a six-hex stride and would otherwise make this 18 hexes).
  // Bounds can clip land before the survey's broad coast classifier sees open
  // water, so edge vertices still need the exact three-hex check.
  const nearDomainEdge = coord.x - CONTINENT.bounds.xmin <= COASTAL_BAND_RADIUS
    || CONTINENT.bounds.xmax - coord.x <= COASTAL_BAND_RADIUS
    || coord.y - CONTINENT.bounds.ymin <= COASTAL_BAND_RADIUS
    || CONTINENT.bounds.ymax - coord.y <= COASTAL_BAND_RADIUS;
  if (!sample.coast && !nearDomainEdge) return false;
  for (const offset of COASTAL_NEIGHBOR_OFFSETS) {
    const x = coord.x + offset.x;
    const y = coord.y + offset.y;
    if (x < CONTINENT.bounds.xmin || x > CONTINENT.bounds.xmax
      || y < CONTINENT.bounds.ymin || y > CONTINENT.bounds.ymax
      || continentValueAt(x, y, seed) <= 0) return true;
  }
  return false;
}

const VEGETATED_TERRAINS = Object.freeze(["plains", "forest", "hills", "marsh"]);

export function atlas3dTerrainColor(
  sample,
  coord,
  height = atlas3dTerrainHeight(sample, coord),
  seed = CONTINENT.seed,
  coastal = false,
  slope = 0,
  northWeight = null,
) {
  const mountain = sample?.terrain === "mountains";
  const frozenEligible = sample?.land
    && ["plains", "hills", "mountains", "impassable"].includes(sample.terrain);
  const frozenWeight = frozenEligible
    ? clamp(Number.isFinite(northWeight) ? northWeight : sample.realmId === "north" ? 1 : 0, 0, 1)
    : 0;
  const primaryAmplitude = mountain ? 0.12 : 0.08;
  const secondaryAmplitude = mountain ? 0.06 : 0.04;
  const normalVariance = (coordinateNoise(coord.x, coord.y, seed + 199) - 0.5) * primaryAmplitude
    + (coordinateNoise(coord.x * 2.3, coord.y * 2.3, seed + 311) - 0.5) * secondaryAmplitude;
  const frozenVariance = (interpolatedCoordinateNoise(coord.x, coord.y, 28, seed + 199) - 0.5) * 0.065
    + (interpolatedCoordinateNoise(coord.x, coord.y, 11, seed + 311) - 0.5) * 0.025;
  const colorVariance = normalVariance + (frozenVariance - normalVariance) * frozenWeight;
  // The permanent snow line wanders deterministically and climbs on steep
  // faces (which shed snow), so caps read as weather rather than a contour.
  const snowLine = SNOW_CAP_HEIGHT
    + (interpolatedCoordinateNoise(coord.x, coord.y, 13, seed + SALT_SNOW_EDGE) - 0.5) * 4
    + clamp(slope, 0, 2) * 3.2;
  const normalBase = terrainColor(sample?.land ? sample.terrain : "water", sample?.realmId);
  const normalRelief = sample?.land
    ? (sample.elevation - 0.48) * 0.24 + colorVariance
    : (sample.elevation - 0.45) * 0.08 + colorVariance * 0.4;
  const frozenRelief = (height - 8) * 0.008 + colorVariance;
  const normalChannels = colorChannels(normalBase, normalRelief);
  const frozenChannels = colorChannels(FROZEN_SHELF_COLOR, frozenRelief);
  let channels = normalChannels.map((channel, index) => (
    channel + (frozenChannels[index] - channel) * frozenWeight
  ));
  if (sample?.land) {
    if (VEGETATED_TERRAINS.includes(sample.terrain)) {
      // Broad moisture drift: wetter stands read deeper and cooler, dry
      // stretches warm toward straw without introducing new palette entries.
      const moisture = interpolatedCoordinateNoise(
        coord.x,
        coord.y,
        26,
        seed + SALT_MOISTURE,
      ) - 0.5;
      const moistureStrength = 1 - frozenWeight;
      channels = [
        clamp(channels[0] * (1 - moisture * 0.16 * moistureStrength), 0, 1),
        clamp(channels[1] * (1 + moisture * 0.07 * moistureStrength), 0, 1),
        clamp(channels[2] * (1 - moisture * 0.1 * moistureStrength), 0, 1),
      ];
    }
    // High country desaturates toward stone before the snow takes over.
    const stoneFade = smoothstep(16, 32, height) * 0.22;
    if (stoneFade > 0) {
      const luma = channels[0] * 0.35 + channels[1] * 0.5 + channels[2] * 0.15;
      channels = channels.map((channel) => channel + (luma - channel) * stoneFade);
    }
    // Steep faces expose the realm's bedrock hue regardless of ground cover.
    const rockWeight = smoothstep(0.55, 1.2, slope) * (0.5 - frozenWeight * 0.2);
    if (rockWeight > 0) {
      channels = blendColorChannels(
        channels,
        terrainColor("mountains", sample.realmId),
        rockWeight,
      );
    }
  }
  if (coastal && sample?.land) {
    channels = blendColorChannels(channels, COASTAL_SAND_COLOR, 0.4);
  }
  const snowReach = smoothstep(snowLine - 1.4, snowLine + 2.4, height);
  if (snowReach > 0) {
    const snowWeight = snowReach * (0.5
      + clamp((height - SNOW_CAP_HEIGHT) / (TERRAIN_MAX_HEIGHT - SNOW_CAP_HEIGHT), 0, 1) * 0.4);
    channels = blendColorChannels(channels, SNOW_CAP_COLOR, snowWeight);
  }
  return channels;
}

function blurLandField(samples, columns, rows, source, components, passes) {
  const neighborOffsets = [
    [-1, -1, 1], [0, -1, 2], [1, -1, 1],
    [-1, 0, 2],                 [1, 0, 2],
    [-1, 1, 1],  [0, 1, 2],  [1, 1, 1],
  ];
  let current = source;
  for (let pass = 0; pass < passes; pass += 1) {
    const next = current.slice();
    for (let row = 1; row < rows - 1; row += 1) {
      for (let column = 1; column < columns - 1; column += 1) {
        const index = row * columns + column;
        if (!samples[index]?.land) continue;
        const offset = index * components;
        let totalWeight = 4;
        for (let component = 0; component < components; component += 1) {
          next[offset + component] = current[offset + component] * 4;
        }
        for (const [dc, dr, weight] of neighborOffsets) {
          const neighborIndex = (row + dr) * columns + column + dc;
          if (!samples[neighborIndex]?.land) continue;
          const neighborOffset = neighborIndex * components;
          for (let component = 0; component < components; component += 1) {
            next[offset + component] += current[neighborOffset + component] * weight;
          }
          totalWeight += weight;
        }
        for (let component = 0; component < components; component += 1) {
          next[offset + component] /= totalWeight;
        }
      }
    }
    current = next;
  }
  return current;
}

function buildTerrainBlendFields(samples, xs, ys, seed) {
  const columns = xs.length;
  const rows = ys.length;
  const terrainWeights = new Float32Array(samples.length * 3);
  const northWeights = new Float32Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    if (!sample?.land) continue;
    const offset = index * 3;
    terrainWeights[offset] = sample.terrain === "mountains" ? 1 : 0;
    terrainWeights[offset + 1] = sample.terrain === "hills" ? 1 : 0;
    terrainWeights[offset + 2] = sample.terrain === "forest" ? 1 : 0;
    northWeights[index] = sample.realmId === "north" ? 1 : 0;
  }

  const blurredTerrain = blurLandField(samples, columns, rows, terrainWeights, 3, 2);
  const blurredNorth = blurLandField(samples, columns, rows, northWeights, 1, 3);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      if (!samples[index]?.land) continue;
      const offset = index * 3;
      const coord = { x: xs[column], y: ys[row] };
      const borderMix = 0.78 + interpolatedCoordinateNoise(
        coord.x,
        coord.y,
        8,
        seed + SALT_CATEGORY_BORDER,
      ) * 0.22;
      for (let component = 0; component < 3; component += 1) {
        terrainWeights[offset + component] += (
          blurredTerrain[offset + component] - terrainWeights[offset + component]
        ) * borderMix;
      }
      northWeights[index] = clamp(blurredNorth[index], 0, 1);
    }
  }
  return { terrainWeights, northWeights };
}

function smoothTerrainHeights(samples, xs, ys, baseHeights, northWeights = null) {
  let current = baseHeights;
  const neighborOffsets = [
    [-1, -1, 1], [0, -1, 2], [1, -1, 1],
    [-1, 0, 2],                 [1, 0, 2],
    [-1, 1, 1],  [0, 1, 2],  [1, 1, 1],
  ];

  // Ridge weights are pass-invariant; compute them once for the whole grid so
  // the multi-pass relaxation below stays cheap at fine strides.
  const blendStrength = new Float32Array(xs.length * ys.length);
  for (let row = 1; row < ys.length - 1; row += 1) {
    for (let column = 1; column < xs.length - 1; column += 1) {
      const index = row * xs.length + column;
      const sample = samples[index];
      if (!sample?.land) continue;
      const coord = { x: xs[column], y: ys[row] };
      const ridgeWeight = Math.max(
        mountainSpineReliefWeightAt(coord),
        northernRidgeReliefWeightAt(coord),
      );
      const preserveAuthoredRelief = ridgeWeight * ridgeWeight;
      // The frozen north relaxes hardest into broad glacial shelves. Other
      // realms smooth just enough to dissolve category pedestals while the
      // erosion octaves keep their uplands craggy.
      const northern = northWeights ? northWeights[index] : sample.realmId === "north" ? 1 : 0;
      blendStrength[index] = (0.62 + northern * 0.26) * (1 - preserveAuthoredRelief * 0.82);
    }
  }

  for (let pass = 0; pass < 3; pass += 1) {
    const next = current.slice();
    for (let row = 1; row < ys.length - 1; row += 1) {
      for (let column = 1; column < xs.length - 1; column += 1) {
        const index = row * xs.length + column;
        const blend = blendStrength[index];
        if (!blend) continue;
        let weightedHeight = current[index] * 4;
        let totalWeight = 4;
        for (const [columnOffset, rowOffset, weight] of neighborOffsets) {
          const neighborIndex = (row + rowOffset) * xs.length + column + columnOffset;
          if (!samples[neighborIndex]?.land) continue;
          weightedHeight += current[neighborIndex] * weight;
          totalWeight += weight;
        }
        const average = weightedHeight / totalWeight;
        next[index] = current[index] + (average - current[index]) * blend;
      }
    }
    current = next;
  }
  return current;
}

const SHORE_RANGE_CELLS = 12;

const ATLAS_3D_CHUNK_APRON = 12;
const ATLAS_3D_CHUNK_SKIRT_DEPTH = 4;
const ATLAS_3D_AO_DIRECTIONS = Object.freeze([
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, -1, 1], [-1, 1, 1], [1, 1, 1.732], [-1, -1, 1.732],
]);

function buildAtlas3dChunkFields(seed, rect) {
  const apron = ATLAS_3D_CHUNK_APRON;
  const sampleSpan = ATLAS_3D_CHUNK_SIZE + apron * 2;
  const columns = sampleSpan + 1;
  const rows = columns;
  const xs = Array.from({ length: columns }, (_, index) => rect.xmin - apron + index);
  const ys = Array.from({ length: rows }, (_, index) => rect.ymin - apron + index);
  const samples = new Array(columns * rows);
  let hasLand = false;
  for (let row = 0; row <= ATLAS_3D_CHUNK_SIZE; row += 1) {
    for (let column = 0; column <= ATLAS_3D_CHUNK_SIZE; column += 1) {
      const sourceRow = apron + row;
      const sourceColumn = apron + column;
      const index = sourceRow * columns + sourceColumn;
      const sample = atlas3dChunkSurvey(xs[sourceColumn], ys[sourceRow], seed);
      samples[index] = sample;
      if (sample.land) hasLand = true;
    }
  }
  if (!hasLand) return { empty: true, apron, columns, rows, xs, ys, samples };
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      if (!samples[index]) samples[index] = atlas3dChunkSurvey(xs[column], ys[row], seed);
    }
  }

  const { terrainWeights, northWeights } = buildTerrainBlendFields(samples, xs, ys, seed);
  const baseHeights = new Float32Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const row = Math.floor(index / columns);
    const column = index - row * columns;
    baseHeights[index] = atlas3dBaseTerrainHeight(
      samples[index],
      { x: xs[column], y: ys[row] },
      seed,
      terrainWeights,
      northWeights[index],
      index * 3,
    );
  }
  const smoothedHeights = smoothTerrainHeights(samples, xs, ys, baseHeights, northWeights);
  const heights = new Float32Array(samples.length);
  const coastal = new Uint8Array(samples.length);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      const coord = { x: xs[column], y: ys[row] };
      heights[index] = samples[index].land
        ? lakeBasinHeightAt(coord, smoothedHeights[index], seed)
        : TERRAIN_MIN_HEIGHT;
      coastal[index] = isCoastalGridVertex(coord, samples[index], seed) ? 1 : 0;
    }
  }

  const slopes = new Float32Array(samples.length);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      const left = heights[row * columns + Math.max(0, column - 1)];
      const right = heights[row * columns + Math.min(columns - 1, column + 1)];
      const up = heights[Math.max(0, row - 1) * columns + column];
      const down = heights[Math.min(rows - 1, row + 1) * columns + column];
      slopes[index] = Math.hypot(right - left, down - up) / 2;
    }
  }

  const ao = new Uint8Array(samples.length);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      if (!samples[index].land) {
        ao[index] = 255;
        continue;
      }
      let occlusion = 0;
      for (const [dc, dr, unit] of ATLAS_3D_AO_DIRECTIONS) {
        let maxTangent = 0;
        for (let step = 1; step <= 6; step += 1) {
          const c = column + dc * step;
          const r = row + dr * step;
          if (c < 0 || c >= columns || r < 0 || r >= rows) break;
          const rise = heights[r * columns + c] - heights[index];
          if (rise > 0) maxTangent = Math.max(maxTangent, rise / (unit * step));
        }
        occlusion += clamp(maxTangent * 0.55, 0, 1);
      }
      ao[index] = Math.round((1 - (occlusion / ATLAS_3D_AO_DIRECTIONS.length) * 0.75) * 255);
    }
  }

  const shoreDistance = new Float32Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    shoreDistance[index] = samples[index].land ? 255 : 0;
  }
  const relaxShore = (index, neighborIndex, cost) => {
    shoreDistance[index] = Math.min(shoreDistance[index], shoreDistance[neighborIndex] + cost);
  };
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      if (column > 0) relaxShore(index, index - 1, 1);
      if (row > 0) relaxShore(index, index - columns, 1);
      if (row > 0 && column > 0) relaxShore(index, index - columns - 1, 1.4);
      if (row > 0 && column < columns - 1) relaxShore(index, index - columns + 1, 1.4);
    }
  }
  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = columns - 1; column >= 0; column -= 1) {
      const index = row * columns + column;
      if (column < columns - 1) relaxShore(index, index + 1, 1);
      if (row < rows - 1) relaxShore(index, index + columns, 1);
      if (row < rows - 1 && column < columns - 1) relaxShore(index, index + columns + 1, 1.4);
      if (row < rows - 1 && column > 0) relaxShore(index, index + columns - 1, 1.4);
    }
  }
  const shore = new Uint8Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    shore[index] = Math.round(
      255 * (1 - Math.min(shoreDistance[index], SHORE_RANGE_CELLS) / SHORE_RANGE_CELLS),
    );
  }

  const rawColors = new Float32Array(samples.length * 3);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      const color = atlas3dTerrainColor(
        samples[index],
        { x: xs[column], y: ys[row] },
        heights[index],
        seed,
        coastal[index] === 1,
        slopes[index],
        northWeights[index],
      );
      rawColors.set(color, index * 3);
    }
  }
  const colors = rawColors.slice();
  const blurOffsets = [
    [-1, -1, 1], [0, -1, 2], [1, -1, 1],
    [-1, 0, 2],                 [1, 0, 2],
    [-1, 1, 1],  [0, 1, 2],  [1, 1, 1],
  ];
  for (let row = 1; row < rows - 1; row += 1) {
    for (let column = 1; column < columns - 1; column += 1) {
      const index = row * columns + column;
      if (!samples[index].land) continue;
      const totals = [
        rawColors[index * 3] * 4,
        rawColors[index * 3 + 1] * 4,
        rawColors[index * 3 + 2] * 4,
      ];
      let totalWeight = 4;
      for (const [dc, dr, weight] of blurOffsets) {
        const neighborIndex = (row + dr) * columns + column + dc;
        if (!samples[neighborIndex].land) continue;
        totals[0] += rawColors[neighborIndex * 3] * weight;
        totals[1] += rawColors[neighborIndex * 3 + 1] * weight;
        totals[2] += rawColors[neighborIndex * 3 + 2] * weight;
        totalWeight += weight;
      }
      const occlusion = 0.66 + 0.34 * (ao[index] / 255);
      for (let channel = 0; channel < 3; channel += 1) {
        const blended = rawColors[index * 3 + channel]
          + (totals[channel] / totalWeight - rawColors[index * 3 + channel]) * 0.45;
        colors[index * 3 + channel] = blended * occlusion;
      }
    }
  }
  for (let index = 0; index < samples.length; index += 1) {
    if (samples[index].land) continue;
    colors[index * 3] = rawColors[index * 3];
    colors[index * 3 + 1] = rawColors[index * 3 + 1];
    colors[index * 3 + 2] = rawColors[index * 3 + 2];
  }

  return { empty: false, apron, columns, rows, xs, ys, samples, heights, colors, coastal, ao, shore };
}

function atlas3dChunkPerimeterIndices(columns) {
  const result = [];
  for (let column = 0; column < columns; column += 1) result.push(column);
  for (let row = 1; row < columns; row += 1) result.push(row * columns + columns - 1);
  for (let column = columns - 2; column >= 0; column -= 1) {
    result.push((columns - 1) * columns + column);
  }
  for (let row = columns - 2; row > 0; row -= 1) result.push(row * columns);
  return result;
}

function buildAtlas3dChunkMesh(fields, rect, lod) {
  const step = lod === 1 ? 2 : 1;
  const columns = ATLAS_3D_CHUNK_SIZE / step + 1;
  const surfaceVertexCount = columns * columns;
  const perimeter = atlas3dChunkPerimeterIndices(columns);
  const vertexCount = surfaceVertexCount + perimeter.length;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const coastal = new Uint8Array(vertexCount);
  const ao = new Uint8Array(vertexCount);
  const shore = new Uint8Array(vertexCount);
  for (let row = 0; row < columns; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const vertex = row * columns + column;
      const sourceColumn = fields.apron + column * step;
      const sourceRow = fields.apron + row * step;
      const source = sourceRow * fields.columns + sourceColumn;
      const coord = { x: rect.xmin + column * step, y: rect.ymin + row * step };
      const scene = atlas3dAxialToScene(coord);
      positions[vertex * 3] = scene.x;
      positions[vertex * 3 + 1] = fields.heights[source];
      positions[vertex * 3 + 2] = scene.z;
      colors[vertex * 3] = fields.colors[source * 3];
      colors[vertex * 3 + 1] = fields.colors[source * 3 + 1];
      colors[vertex * 3 + 2] = fields.colors[source * 3 + 2];
      coastal[vertex] = fields.coastal[source];
      ao[vertex] = fields.ao[source];
      shore[vertex] = fields.shore[source];
    }
  }
  for (let index = 0; index < perimeter.length; index += 1) {
    const surfaceVertex = perimeter[index];
    const skirtVertex = surfaceVertexCount + index;
    positions[skirtVertex * 3] = positions[surfaceVertex * 3];
    positions[skirtVertex * 3 + 1] = positions[surfaceVertex * 3 + 1] - ATLAS_3D_CHUNK_SKIRT_DEPTH;
    positions[skirtVertex * 3 + 2] = positions[surfaceVertex * 3 + 2];
    colors[skirtVertex * 3] = colors[surfaceVertex * 3] * 0.72;
    colors[skirtVertex * 3 + 1] = colors[surfaceVertex * 3 + 1] * 0.72;
    colors[skirtVertex * 3 + 2] = colors[surfaceVertex * 3 + 2] * 0.72;
    coastal[skirtVertex] = coastal[surfaceVertex];
    ao[skirtVertex] = ao[surfaceVertex];
    shore[skirtVertex] = shore[surfaceVertex];
  }

  const surfaceIndexCount = (columns - 1) * (columns - 1) * 6;
  const skirtIndexCount = perimeter.length * 6;
  const indices = new Uint32Array(surfaceIndexCount + skirtIndexCount);
  let cursor = 0;
  for (let row = 0; row < columns - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const a = row * columns + column;
      const b = a + 1;
      const c = a + columns;
      const d = c + 1;
      indices.set([a, c, b, b, c, d], cursor);
      cursor += 6;
    }
  }
  for (let index = 0; index < perimeter.length; index += 1) {
    const next = (index + 1) % perimeter.length;
    const surfaceA = perimeter[index];
    const surfaceB = perimeter[next];
    const skirtA = surfaceVertexCount + index;
    const skirtB = surfaceVertexCount + next;
    indices.set([surfaceA, skirtA, surfaceB, surfaceB, skirtA, skirtB], cursor);
    cursor += 6;
  }

  return {
    stride: step,
    columns,
    rows: columns,
    surfaceVertexCount,
    skirtVertexOffset: surfaceVertexCount,
    skirtVertexCount: perimeter.length,
    skirtDepth: ATLAS_3D_CHUNK_SKIRT_DEPTH,
    positions,
    colors,
    coastal,
    ao,
    shore,
    indices,
  };
}

function atlas3dChunkOwnsCoord(rect, coord) {
  return coord.x >= rect.xmin && coord.x < rect.xmax
    && coord.y >= rect.ymin && coord.y < rect.ymax;
}

function latticeStartAtOrAfter(minimum, anchor, stride) {
  return anchor + Math.ceil((minimum - anchor) / stride) * stride;
}

function buildAtlas3dChunkProps(seed, rect, heights, stride) {
  const trees = [];
  const rocks = [];
  const fields = [];
  const environs = [];
  const heightAt = (coord) => heightFromChunkLattice(
    heights,
    coord,
    { x: rect.xmin, y: rect.ymin },
    ATLAS_3D_CHUNK_SIZE,
    stride,
  );
  const acceptsOwnedLand = (coord) => (
    atlas3dChunkOwnsCoord(rect, coord)
    && atlas3dChunkSurvey(coord.x, coord.y, seed).land
  );
  const appendTree = (candidate) => {
    if (!acceptsOwnedLand(candidate.coord)
      || atlas3dAuthoredWaterContains(candidate.coord, 1.5)
      || !clearsAtlas3dPropFeatures(candidate.coord)) return;
    const height = heightAt(candidate.coord);
    if (height == null) return;
    const scene = atlas3dAxialToScene(candidate.coord);
    trees.push(
      scene.x,
      height,
      scene.z,
      candidate.scale,
      candidate.rotation,
      candidate.colorFactor,
      candidate.realmIndex,
      candidate.species,
    );
  };
  const appendRock = (candidate) => {
    if (!acceptsOwnedLand(candidate.coord)
      || atlas3dAuthoredWaterContains(candidate.coord, 1.2)
      || !clearsAtlas3dPropFeatures(candidate.coord, -1.2)) return;
    const height = heightAt(candidate.coord);
    if (height == null) return;
    const scene = atlas3dAxialToScene(candidate.coord);
    rocks.push(
      scene.x,
      height,
      scene.z,
      candidate.scale,
      candidate.rotation,
      candidate.variant,
    );
  };

  const habitatByTerrain = {
    plains: { central: 0.16, north: 0.13, east: 0.21, south: 0.055, west: 0.17 },
    hills: { central: 0.16, north: 0.19, east: 0.17, south: 0.075, west: 0.18 },
    marsh: { central: 0.12, north: 0.08, east: 0.23, south: 0.035, west: 0.16 },
    mountains: { central: 0.035, north: 0.085, east: 0.045, south: 0.02, west: 0.045 },
    impassable: { central: 0.02, north: 0.055, east: 0.025, south: 0.012, west: 0.035 },
  };
  const anchorPadding = 5;
  const startX = latticeStartAtOrAfter(rect.xmin - anchorPadding, 0, 4);
  const startY = latticeStartAtOrAfter(rect.ymin - anchorPadding, 0, 4);
  for (let y = startY; y < rect.ymax + anchorPadding; y += 4) {
    for (let x = startX; x < rect.xmax + anchorPadding; x += 4) {
      const sample = atlas3dChunkSurvey(x, y, seed);
      if (!sample.land) continue;
      const grove = interpolatedCoordinateNoise(x, y, 26, seed + 43);
      const density = coordinateNoise(x, y, seed);
      const forest = sample.terrain === "forest";
      const habitat = habitatByTerrain[sample.terrain]?.[sample.realmId] || 0;
      const fringeAcceptance = habitat * (0.58 + grove * 0.78);
      const count = forest
        ? (grove > 0.22 && density > 0.08
          ? 4 + Math.floor(density * 5) + (grove > 0.76 ? 1 : 0)
          : 0)
        : (density < fringeAcceptance
          ? 1 + (grove > 0.7 ? 1 : 0) + (density < fringeAcceptance * 0.22 ? 1 : 0)
          : 0);
      const phase = coordinateNoise(x, y, seed + 47) * Math.PI * 2;
      for (let tree = 0; tree < count; tree += 1) {
        const radial = 0.38 + Math.sqrt((tree + 0.45) / Math.max(1, count)) * 3.05;
        const angle = phase + tree * GOLDEN_ANGLE;
        const coord = {
          x: x + Math.cos(angle) * radial
            + (coordinateNoise(x, y, seed + tree * 11 + 1) - 0.5) * 0.68,
          y: y + Math.sin(angle) * radial
            + (coordinateNoise(x, y, seed + tree * 11 + 2) - 0.5) * 0.68,
        };
        const speciesNoise = coordinateNoise(x, y, seed + tree * 11 + 7);
        appendTree({
          coord,
          scale: 0.62 + coordinateNoise(x, y, seed + tree * 11 + 3) * 0.7,
          rotation: coordinateNoise(x, y, seed + tree * 11 + 4) * Math.PI * 2,
          colorFactor: 0.78 + coordinateNoise(x, y, seed + tree * 11 + 5) * 0.28,
          realmIndex: REALM_INDICES[sample.realmId] ?? 0,
          species: sample.realmId === "north"
            ? ATLAS_3D_TREE_SPECIES.conifer
            : sample.realmId === "south"
            ? ATLAS_3D_TREE_SPECIES.scrub
            : sample.realmId === "west"
            ? (speciesNoise > 0.76 ? ATLAS_3D_TREE_SPECIES.conifer : ATLAS_3D_TREE_SPECIES.broadleaf)
            : (speciesNoise > 0.91 ? ATLAS_3D_TREE_SPECIES.conifer : ATLAS_3D_TREE_SPECIES.broadleaf),
        });
      }

      const rockyTerrain = sample.terrain === "mountains" || sample.terrain === "hills";
      const propensity = coordinateNoise(x, y, seed + SALT_ROCKS);
      const threshold = sample.terrain === "mountains" ? 0.22 : 0.58;
      const rockCluster = interpolatedCoordinateNoise(x, y, 18, seed + SALT_ROCKS + 4);
      if (!rockyTerrain || propensity <= threshold || rockCluster <= 0.28) continue;
      const rawHeight = (coord) => atlas3dTerrainHeight(
        atlas3dChunkSurvey(coord.x, coord.y, seed),
        coord,
        seed,
      );
      const propSlope = Math.hypot(
        rawHeight({ x: x + 4, y }) - rawHeight({ x: x - 4, y }),
        rawHeight({ x, y: y + 4 }) - rawHeight({ x, y: y - 4 }),
      ) / 8;
      if (propSlope <= 0.075 && !(sample.terrain === "mountains" && sample.elevation > 0.76)) continue;
      const rockCount = 1 + (propensity > 0.78 ? 1 : 0) + (propensity > 0.92 ? 1 : 0);
      for (let rock = 0; rock < rockCount; rock += 1) {
        const angle = propensity * Math.PI * 2 + rock * GOLDEN_ANGLE;
        const radius = 0.5 + rock * 1.1;
        appendRock({
          coord: { x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius },
          scale: 0.55 + coordinateNoise(x, y, seed + SALT_ROCKS + rock * 7 + 1) * 1.5,
          rotation: coordinateNoise(x, y, seed + SALT_ROCKS + rock * 7 + 2) * Math.PI * 2,
          variant: Math.min(2, Math.floor(coordinateNoise(
            x,
            y,
            seed + SALT_ROCKS + rock * 7 + 3,
          ) * 3)),
        });
      }
    }
  }

  const eastOrchards = [
    { species: ATLAS_3D_TREE_SPECIES.cherry, bounds: { xmin: 300, xmax: 460, ymin: -150, ymax: 50 }, salt: 0 },
    { species: ATLAS_3D_TREE_SPECIES.ginkgo, bounds: { xmin: 300, xmax: 470, ymin: 50, ymax: 180 }, salt: 97 },
  ];
  for (const orchard of eastOrchards) {
    const xStart = latticeStartAtOrAfter(rect.xmin - 4, orchard.bounds.xmin, 8);
    const yStart = latticeStartAtOrAfter(rect.ymin - 4, orchard.bounds.ymin, 8);
    for (let y = yStart; y <= Math.min(orchard.bounds.ymax, rect.ymax + 4); y += 8) {
      for (let x = xStart; x <= Math.min(orchard.bounds.xmax, rect.xmax + 4); x += 8) {
        const patch = coordinateNoise(
          Math.floor((x - orchard.bounds.xmin) / 30),
          Math.floor((y - orchard.bounds.ymin) / 30),
          seed + 811 + orchard.salt,
        );
        const detail = coordinateNoise(x, y, seed + 823 + orchard.salt);
        if (patch <= 0.34 || detail <= 0.17) continue;
        const count = 1 + (detail > 0.58 ? 1 : 0) + (detail > 0.86 ? 1 : 0);
        for (let tree = 0; tree < count; tree += 1) {
          appendTree({
            coord: {
              x: x + (coordinateNoise(x, y, seed + 829 + tree * 11 + orchard.salt) - 0.5) * 7,
              y: y + (coordinateNoise(y, x, seed + 839 + tree * 11 + orchard.salt) - 0.5) * 7,
            },
            scale: 0.88 + coordinateNoise(x, y, seed + 853 + tree * 13 + orchard.salt) * 0.64,
            rotation: coordinateNoise(y, x, seed + 859 + tree * 13 + orchard.salt) * Math.PI * 2,
            colorFactor: 0.9 + coordinateNoise(x, y, seed + 863 + tree * 13 + orchard.salt) * 0.16,
            realmIndex: REALM_INDICES.east,
            species: orchard.species,
          });
        }
      }
    }
  }

  const insideDomain = (coord, inset = 2) => coord.x >= CONTINENT.bounds.xmin + inset
    && coord.x <= CONTINENT.bounds.xmax - inset
    && coord.y >= CONTINENT.bounds.ymin + inset
    && coord.y <= CONTINENT.bounds.ymax - inset;
  const acceptableGround = (coord, allowedTerrains, maxRise, footprint = null) => {
    if (!atlas3dChunkOwnsCoord(rect, coord)
      || !insideDomain(coord)
      || atlas3dAuthoredWaterContains(coord, 1.4)) return null;
    const sample = atlas3dChunkSurvey(coord.x, coord.y, seed);
    if (!sample.land || !allowedTerrains.has(sample.terrain)) return null;
    const height = heightAt(coord);
    if (height == null) return null;
    const comparisonHeight = atlas3dTerrainHeight(sample, coord, seed);
    const sampleCoords = [{ x: coord.x + 2, y: coord.y }, { x: coord.x, y: coord.y + 2 }];
    if (footprint) {
      const center = atlas3dAxialToScene(coord);
      const cosine = Math.cos(footprint.rotation);
      const sine = Math.sin(footprint.rotation);
      for (const [sideX, sideZ] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const localX = sideX * footprint.width * 0.5;
        const localZ = sideZ * footprint.depth * 0.5;
        sampleCoords.push(atlas3dSceneToAxial({
          x: center.x + localX * cosine - localZ * sine,
          z: center.z + localX * sine + localZ * cosine,
        }));
      }
    }
    const sampleHeights = sampleCoords.map((sampleCoord) => (
      atlas3dTerrainHeight(atlas3dChunkSurvey(sampleCoord.x, sampleCoord.y, seed), sampleCoord, seed)
    ));
    if (Math.max(...sampleHeights.map((sampleHeight) => Math.abs(sampleHeight - comparisonHeight))) > maxRise) {
      return null;
    }
    return height;
  };
  const settlementCounts = {
    city: [24, 18], town: [16, 12], settlement: [13, 10], village: [11, 8],
    fortress: [9, 7], port: [13, 10],
  };
  const fieldTerrains = new Set(["plains", "hills", "forest"]);
  const environTerrains = new Set(["plains", "hills", "forest", "marsh"]);
  const settlementCandidate = (landmark, index, salt, near, far) => {
    const phase = coordinateNoise(landmark.coord.x, landmark.coord.y, seed + salt) * Math.PI * 2;
    const angle = phase + index * GOLDEN_ANGLE;
    const radiusNoise = coordinateNoise(
      landmark.coord.x + index,
      landmark.coord.y - index,
      seed + salt + 1,
    );
    const radius = near + (far - near) * Math.sqrt(radiusNoise);
    return {
      x: landmark.coord.x + Math.cos(angle) * radius,
      y: landmark.coord.y + Math.sin(angle) * radius,
    };
  };
  for (const landmark of ATLAS_PROP_LANDMARKS) {
    if (!SETTLEMENT_PROP_KINDS.has(landmark.kind)) continue;
    const [fieldCount, environCount] = settlementCounts[landmark.kind] || [6, 4];
    for (let index = 0; index < fieldCount; index += 1) {
      const coord = settlementCandidate(
        landmark,
        index,
        SALT_FIELDS,
        11,
        landmark.kind === "city" ? 30 : 24,
      );
      if (!atlas3dChunkOwnsCoord(rect, coord)
        || !clearsAtlas3dPropFeatures(coord, -2, landmark.id)) continue;
      const scaleNoise = coordinateNoise(coord.x, coord.y, seed + SALT_FIELDS + 3);
      const width = 3.4 + scaleNoise * 3.8;
      const depth = 2.2 + coordinateNoise(coord.y, coord.x, seed + SALT_FIELDS + 5) * 2.8;
      const rotation = coordinateNoise(coord.x, coord.y, seed + SALT_FIELDS + 7) * Math.PI;
      const height = acceptableGround(coord, fieldTerrains, 1.05, { width, depth, rotation });
      if (height == null) continue;
      const scene = atlas3dAxialToScene(coord);
      fields.push(
        scene.x,
        height + 0.12,
        scene.z,
        width,
        depth,
        rotation,
        Math.min(2, Math.floor(coordinateNoise(coord.x, coord.y, seed + SALT_FIELDS + 9) * 3)),
      );
    }
    for (let index = 0; index < environCount; index += 1) {
      const coord = settlementCandidate(
        landmark,
        index,
        SALT_ENVIRONS,
        5.5,
        landmark.kind === "city" ? 14 : 11,
      );
      if (!atlas3dChunkOwnsCoord(rect, coord)
        || !clearsAtlas3dPropFeatures(coord, -1.5, landmark.id)) continue;
      const height = acceptableGround(coord, environTerrains, 1.7);
      if (height == null) continue;
      const scene = atlas3dAxialToScene(coord);
      environs.push(
        scene.x,
        height,
        scene.z,
        0.72 + coordinateNoise(coord.x, coord.y, seed + SALT_ENVIRONS + 3) * 0.72,
        coordinateNoise(coord.y, coord.x, seed + SALT_ENVIRONS + 5) * Math.PI * 2,
        Math.min(2, Math.floor(coordinateNoise(coord.x, coord.y, seed + SALT_ENVIRONS + 7) * 3)),
      );
    }
  }

  return {
    trees: new Float32Array(trees),
    rocks: new Float32Array(rocks),
    fields: new Float32Array(fields),
    environs: new Float32Array(environs),
  };
}

function atlas3dBuildClock() {
  return globalThis.performance?.now?.() ?? Date.now();
}

export function buildAtlas3dChunk(seed = CONTINENT.seed, cx, cy, lod = 0) {
  if (typeof seed !== "string" && !Number.isFinite(seed)) {
    throw new TypeError("atlas 3D chunks require a string or finite numeric seed");
  }
  const resolvedCx = integerChunkCoordinate(cx, "cx");
  const resolvedCy = integerChunkCoordinate(cy, "cy");
  if (lod !== 0 && lod !== 1) throw new RangeError("atlas 3D chunks support only LOD 0 or LOD 1");
  const startedAt = atlas3dBuildClock();
  const rect = atlas3dChunkRect(resolvedCx, resolvedCy);
  const origin = { x: rect.xmin, y: rect.ymin };
  const fields = buildAtlas3dChunkFields(seed, rect);
  const coreColumns = ATLAS_3D_CHUNK_SIZE + 1;
  if (fields.empty) {
    return {
      version: ATLAS_3D_RENDER_VERSION,
      seed,
      cx: resolvedCx,
      cy: resolvedCy,
      lod,
      empty: true,
      origin,
      span: ATLAS_3D_CHUNK_SIZE,
      stride: lod === 1 ? 2 : 1,
      columns: 0,
      rows: 0,
      surfaceVertexCount: 0,
      skirtVertexOffset: 0,
      skirtVertexCount: 0,
      skirtDepth: ATLAS_3D_CHUNK_SKIRT_DEPTH,
      heights: new Float32Array(0),
      positions: new Float32Array(0),
      colors: new Float32Array(0),
      coastal: new Uint8Array(0),
      ao: new Uint8Array(0),
      shore: new Uint8Array(0),
      indices: new Uint32Array(0),
      trees: new Float32Array(0),
      rocks: new Float32Array(0),
      fields: new Float32Array(0),
      environs: new Float32Array(0),
      buildMs: atlas3dBuildClock() - startedAt,
    };
  }

  const heights = new Float32Array(coreColumns * coreColumns);
  for (let row = 0; row < coreColumns; row += 1) {
    const sourceOffset = (fields.apron + row) * fields.columns + fields.apron;
    heights.set(fields.heights.subarray(sourceOffset, sourceOffset + coreColumns), row * coreColumns);
  }
  const mesh = buildAtlas3dChunkMesh(fields, rect, lod);
  const props = buildAtlas3dChunkProps(seed, rect, heights, mesh.stride);
  return {
    version: ATLAS_3D_RENDER_VERSION,
    seed,
    cx: resolvedCx,
    cy: resolvedCy,
    lod,
    empty: false,
    origin,
    span: ATLAS_3D_CHUNK_SIZE,
    heights,
    ...mesh,
    ...props,
    buildMs: atlas3dBuildClock() - startedAt,
  };
}

function cameraTarget(camera) {
  return atlas3dAxialToScene(camera);
}

function cameraTerrainHeight(camera, seed = CONTINENT.seed) {
  return atlas3dTerrainHeightAt(camera, seed);
}

function cameraForTarget(camera, target, viewport, seed = CONTINENT.seed) {
  const axial = atlas3dSceneToAxial(target);
  return clampCamera({ ...camera, x: axial.x, y: axial.y }, viewport, seed);
}

export function centerAtlas3dCamera(camera, viewport, coord, zoom = camera.zoom, seed = CONTINENT.seed) {
  return cameraForTarget(
    { ...camera, zoom, targetHeight: atlas3dTerrainHeightAt(coord, seed) },
    atlas3dAxialToScene(coord),
    viewport,
    seed,
  );
}

export function atlas3dCameraFrame(camera, viewport, seed = CONTINENT.seed) {
  const frameKey = `${seed}|${camera.x},${camera.y},${camera.zoom},${camera.targetHeight ?? "auto"}|${viewport?.width || 1},${viewport?.height || 1}`;
  if (frameKey === lastCameraFrameKey && lastCameraFrame) return lastCameraFrame;
  const targetPlane = cameraTarget(camera);
  const targetHeight = Number.isFinite(camera.targetHeight)
    ? clamp(camera.targetHeight, TERRAIN_MIN_HEIGHT, TERRAIN_MAX_HEIGHT)
    : cameraTerrainHeight(camera, seed);
  const target = { ...targetPlane, y: targetHeight };
  const fitKey = `${seed}|${Math.max(1, viewport?.width || 1)}x${Math.max(1, viewport?.height || 1)}`;
  const fitZoom = FIT_ZOOM_CACHE.get(fitKey) ?? camera.zoom;
  const pitch = atlas3dPitchFor(camera.zoom, fitZoom);
  const pitchSin = Math.sin(pitch);
  const pitchCos = Math.cos(pitch);
  const height = Math.max(1, viewport?.height || 1);
  const zoomRatio = camera.zoom / Math.max(0.001, fitZoom);
  // Preserve the authored full-continent fit, then progressively tighten the
  // physical camera dolly as control passes into the local diorama. Without
  // this nonlinear handoff an 8.6x UI zoom still saw ~280 hexes, forcing the
  // worker window to exceed every quality-tier cache.
  const dioramaProgress = smoothstep(1, 8.6, zoomRatio);
  const portraitBoost = Math.max(1, height / Math.max(1, viewport?.width || 1));
  const maxDioramaBoost = 2.8 * portraitBoost;
  const physicalZoom = camera.zoom * (1 + dioramaProgress * (maxDioramaBoost - 1));
  const requestedDistance = height / (2 * Math.max(0.001, physicalZoom) * FOV_TAN);
  // The full-continent camera stayed above the realm's single highest summit,
  // imposing a fixed distance that made a 128-hex local window impossible.
  // Clear only the terrain beneath this local camera position. A short fixed
  // point solve accounts for moving backward onto a ridge at close zoom.
  let distance = requestedDistance;
  for (let pass = 0; pass < 4; pass += 1) {
    const cameraGround = atlas3dSceneToAxial({
      x: target.x,
      z: target.z + distance * pitchSin,
    });
    const groundHeight = atlas3dTerrainHeightAt(cameraGround, seed);
    distance = Math.max(
      requestedDistance,
      (groundHeight + CAMERA_MIN_CLEARANCE - target.y) / Math.max(0.001, pitchCos),
    );
  }
  const frame = {
    target,
    distance,
    pitch,
    pitchSin,
    pitchCos,
    visibleHeight: 2 * distance * FOV_TAN,
    visibleWidth: 2 * distance * FOV_TAN
      * (Math.max(1, viewport?.width || 1) / height),
    position: {
      x: target.x,
      y: target.y + distance * pitchCos,
      z: target.z + distance * pitchSin,
    },
  };
  lastCameraFrameKey = frameKey;
  lastCameraFrame = frame;
  return frame;
}

export function atlas3dProject(camera, viewport, coord, height = 0, seed = CONTINENT.seed) {
  const frame = atlas3dCameraFrame(camera, viewport, seed);
  const scene = atlas3dAxialToScene(coord);
  const rel = {
    x: scene.x - frame.position.x,
    y: height - frame.position.y,
    z: scene.z - frame.position.z,
  };
  const depth = -rel.y * frame.pitchCos - rel.z * frame.pitchSin;
  if (depth <= 0.01) return { x: -10000, y: -10000, visible: false, depth };
  const screenUp = rel.y * frame.pitchSin - rel.z * frame.pitchCos;
  const width = Math.max(1, viewport?.width || 1);
  const viewportHeight = Math.max(1, viewport?.height || 1);
  const aspect = width / viewportHeight;
  const ndcX = rel.x / (depth * FOV_TAN * aspect);
  const ndcY = screenUp / (depth * FOV_TAN);
  return {
    x: (ndcX + 1) * width / 2,
    y: (1 - ndcY) * viewportHeight / 2,
    visible: Math.abs(ndcX) <= 1.15 && Math.abs(ndcY) <= 1.15,
    depth,
  };
}

export function atlas3dScreenToGround(camera, viewport, point, seed = CONTINENT.seed) {
  const frame = atlas3dCameraFrame(camera, viewport, seed);
  const groundY = frame.target.y;
  const width = Math.max(1, viewport?.width || 1);
  const height = Math.max(1, viewport?.height || 1);
  const ndcX = point.x / width * 2 - 1;
  const ndcY = 1 - point.y / height * 2;
  const aspect = width / height;
  const direction = {
    x: ndcX * FOV_TAN * aspect,
    y: -frame.pitchCos + ndcY * FOV_TAN * frame.pitchSin,
    z: -frame.pitchSin - ndcY * FOV_TAN * frame.pitchCos,
  };
  const length = Math.hypot(direction.x, direction.y, direction.z) || 1;
  direction.x /= length;
  direction.y /= length;
  direction.z /= length;
  const pointAt = (travel) => ({
    x: frame.position.x + direction.x * travel,
    y: frame.position.y + direction.y * travel,
    z: frame.position.z + direction.z * travel,
  });
  const surfaceDelta = (travel) => {
    const rayPoint = pointAt(travel);
    const coord = atlas3dSceneToAxial(rayPoint);
    return rayPoint.y - atlas3dTerrainHeightAt(coord, seed);
  };
  const finalTravel = Math.max(0, (TERRAIN_MIN_HEIGHT - frame.position.y) / direction.y);
  let lower = 0;
  let lowerDelta = surfaceDelta(lower);
  let upper = finalTravel;
  for (let step = 1; step <= 48; step += 1) {
    const travel = finalTravel * step / 48;
    const delta = surfaceDelta(travel);
    if (delta <= 0 || step === 48) {
      upper = travel;
      for (let pass = 0; pass < 14; pass += 1) {
        const middle = (lower + upper) / 2;
        if (surfaceDelta(middle) > 0) lower = middle;
        else upper = middle;
      }
      break;
    }
    lower = travel;
    lowerDelta = delta;
  }
  const travel = lowerDelta <= 0 ? lower : (lower + upper) / 2;
  const hit = pointAt(travel);
  const scene = { x: hit.x, z: hit.z };
  const coord = atlas3dSceneToAxial(scene);
  return { ...coord, scene, height: atlas3dTerrainHeightAt(coord, seed) };
}

function anchorCameraOnGround(camera, viewport, ground, desiredScreen, seed) {
  const groundHeight = Number.isFinite(ground?.height)
    ? ground.height
    : atlas3dTerrainHeightAt(ground, seed);
  let anchored = clampCamera(camera, viewport, seed);
  let bestScreen = atlas3dProject(anchored, viewport, ground, groundHeight, seed);
  let bestError = Math.hypot(
    desiredScreen.x - bestScreen.x,
    desiredScreen.y - bestScreen.y,
  );
  const groundScene = ground?.scene || atlas3dAxialToScene(ground);
  const width = Math.max(1, viewport?.width || 1);
  const height = Math.max(1, viewport?.height || 1);
  const ndcX = desiredScreen.x / width * 2 - 1;
  const ndcY = 1 - desiredScreen.y / height * 2;
  const aspect = width / height;
  const anchorFrame = atlas3dCameraFrame(anchored, viewport, seed);
  const verticalDenominator = -anchorFrame.pitchCos
    + anchorFrame.pitchSin * ndcY * FOV_TAN;

  // Invert the perspective projection while holding the current target height
  // and camera distance fixed. Repeating that inexpensive solve lets the seed
  // cross a coastline or steep relief boundary even when every local step gets
  // temporarily worse. Keep the best iterate, then use the terrain-aware local
  // refinement below for the final sub-pixel correction.
  if (Math.abs(verticalDenominator) > 1e-7) {
    let analytical = anchored;
    const visited = new Set();
    for (let pass = 0; pass < 6 && bestError >= 0.2; pass += 1) {
      const frame = atlas3dCameraFrame(analytical, viewport, seed);
      const relativeY = groundHeight - frame.position.y;
      const depth = relativeY / verticalDenominator;
      if (!Number.isFinite(depth) || depth <= 0.01) break;
      const screenUp = ndcY * depth * FOV_TAN;
      const relativeX = ndcX * depth * FOV_TAN * aspect;
      const relativeZ = -frame.pitchSin * depth - frame.pitchCos * screenUp;
      const candidate = cameraForTarget(analytical, {
        x: groundScene.x - relativeX,
        z: groundScene.z - frame.distance * frame.pitchSin - relativeZ,
      }, viewport, seed);
      const candidateKey = `${candidate.x.toFixed(6)},${candidate.y.toFixed(6)}`;
      if (visited.has(candidateKey)) break;
      visited.add(candidateKey);
      analytical = candidate;
      const candidateScreen = atlas3dProject(candidate, viewport, ground, groundHeight, seed);
      const candidateError = Math.hypot(
        desiredScreen.x - candidateScreen.x,
        desiredScreen.y - candidateScreen.y,
      );
      if (candidateError < bestError) {
        anchored = candidate;
        bestScreen = candidateScreen;
        bestError = candidateError;
      }
    }
  }
  for (let pass = 0; pass < 8; pass += 1) {
    const projected = atlas3dProject(anchored, viewport, ground, groundHeight, seed);
    const error = {
      x: desiredScreen.x - projected.x,
      y: desiredScreen.y - projected.y,
    };
    const errorLength = Math.hypot(error.x, error.y);
    if (errorLength < 0.2) break;
    const epsilon = clamp(
      errorLength / Math.max(0.1, anchored.zoom) * 0.22,
      0.5,
      6,
    );
    const xMinus = clampCamera({ ...anchored, x: anchored.x - epsilon }, viewport, seed);
    const xPlus = clampCamera({ ...anchored, x: anchored.x + epsilon }, viewport, seed);
    const yMinus = clampCamera({ ...anchored, y: anchored.y - epsilon }, viewport, seed);
    const yPlus = clampCamera({ ...anchored, y: anchored.y + epsilon }, viewport, seed);
    const xSpan = xPlus.x - xMinus.x;
    const ySpan = yPlus.y - yMinus.y;
    if (Math.abs(xSpan) < 1e-7 || Math.abs(ySpan) < 1e-7) break;
    const projectedXMinus = atlas3dProject(xMinus, viewport, ground, groundHeight, seed);
    const projectedXPlus = atlas3dProject(xPlus, viewport, ground, groundHeight, seed);
    const projectedYMinus = atlas3dProject(yMinus, viewport, ground, groundHeight, seed);
    const projectedYPlus = atlas3dProject(yPlus, viewport, ground, groundHeight, seed);
    const a = (projectedXPlus.x - projectedXMinus.x) / xSpan;
    const c = (projectedXPlus.y - projectedXMinus.y) / xSpan;
    const b = (projectedYPlus.x - projectedYMinus.x) / ySpan;
    const d = (projectedYPlus.y - projectedYMinus.y) / ySpan;
    const determinant = a * d - b * c;
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-8) break;
    let deltaX = (error.x * d - b * error.y) / determinant;
    let deltaY = (a * error.y - error.x * c) / determinant;
    const maxStep = Math.max(4, Math.max(viewport.width, viewport.height) / anchored.zoom * 0.3);
    const stepLength = Math.hypot(deltaX, deltaY);
    if (stepLength > maxStep) {
      const scale = maxStep / stepLength;
      deltaX *= scale;
      deltaY *= scale;
    }
    let accepted = null;
    let scale = 1;
    for (let lineSearch = 0; lineSearch < 7; lineSearch += 1) {
      const candidate = clampCamera({
        ...anchored,
        x: anchored.x + deltaX * scale,
        y: anchored.y + deltaY * scale,
      }, viewport, seed);
      if (candidate.x !== anchored.x || candidate.y !== anchored.y) {
        const candidateScreen = atlas3dProject(candidate, viewport, ground, groundHeight, seed);
        const candidateError = Math.hypot(
          desiredScreen.x - candidateScreen.x,
          desiredScreen.y - candidateScreen.y,
        );
        if (candidateError < errorLength) {
          accepted = candidate;
          break;
        }
      }
      scale *= 0.5;
    }
    if (!accepted) {
      let bestError = errorLength;
      const directions = [
        [1, 0], [-1, 0], [0, 1], [0, -1],
        [Math.SQRT1_2, Math.SQRT1_2],
        [Math.SQRT1_2, -Math.SQRT1_2],
        [-Math.SQRT1_2, Math.SQRT1_2],
        [-Math.SQRT1_2, -Math.SQRT1_2],
      ];
      for (const searchScale of [2, 1, 0.5]) {
        for (const [directionX, directionY] of directions) {
          const candidate = clampCamera({
            ...anchored,
            x: anchored.x + directionX * epsilon * searchScale,
            y: anchored.y + directionY * epsilon * searchScale,
          }, viewport, seed);
          if (candidate.x === anchored.x && candidate.y === anchored.y) continue;
          const candidateScreen = atlas3dProject(candidate, viewport, ground, groundHeight, seed);
          const candidateError = Math.hypot(
            desiredScreen.x - candidateScreen.x,
            desiredScreen.y - candidateScreen.y,
          );
          if (candidateError < bestError) {
            bestError = candidateError;
            accepted = candidate;
          }
        }
      }
    }
    if (!accepted) break;
    anchored = accepted;
  }
  let remainingScreen = atlas3dProject(anchored, viewport, ground, groundHeight, seed);
  let remainingError = Math.hypot(
    desiredScreen.x - remainingScreen.x,
    desiredScreen.y - remainingScreen.y,
  );
  if (remainingError >= 0.2) {
    let radius = Math.max(2, Math.max(viewport.width, viewport.height) / anchored.zoom * 0.3);
    for (let searchPass = 0; searchPass < 7 && remainingError >= 0.2; searchPass += 1) {
      let bestCamera = anchored;
      let bestError = remainingError;
      for (let direction = 0; direction < 16; direction += 1) {
        const angle = direction / 16 * Math.PI * 2;
        const candidate = clampCamera({
          ...anchored,
          x: anchored.x + Math.cos(angle) * radius,
          y: anchored.y + Math.sin(angle) * radius,
        }, viewport, seed);
        if (candidate.x === anchored.x && candidate.y === anchored.y) continue;
        const candidateScreen = atlas3dProject(candidate, viewport, ground, groundHeight, seed);
        const candidateError = Math.hypot(
          desiredScreen.x - candidateScreen.x,
          desiredScreen.y - candidateScreen.y,
        );
        if (candidateError < bestError) {
          bestError = candidateError;
          bestCamera = candidate;
        }
      }
      if (bestCamera !== anchored) {
        anchored = bestCamera;
        remainingError = bestError;
        remainingScreen = atlas3dProject(anchored, viewport, ground, groundHeight, seed);
      }
      radius *= 0.5;
    }
  }
  return anchored;
}

export function panAtlas3dCamera(
  camera,
  viewport,
  dxPx,
  dyPx,
  seed = CONTINENT.seed,
  pickGround = null,
  anchor = null,
) {
  const center = anchor || { x: viewport.width / 2, y: viewport.height / 2 };
  const stableCamera = clampCamera({
    ...camera,
    targetHeight: Number.isFinite(camera.targetHeight)
      ? camera.targetHeight
      : cameraTerrainHeight(camera, seed),
  }, viewport, seed);
  const before = pickGround?.(camera, center)
    || atlas3dScreenToGround(camera, viewport, center, seed);
  const destination = { x: center.x + dxPx, y: center.y + dyPx };
  return anchorCameraOnGround(stableCamera, viewport, before, destination, seed);
}

export function zoomAtlas3dCamera(
  camera,
  viewport,
  factor,
  anchor = null,
  seed = CONTINENT.seed,
  pickGround = null,
) {
  const fit = atlas3dFitZoom(viewport, seed);
  const zoom = clamp(camera.zoom * factor, fit, ATLAS_3D_MAX_ZOOM);
  if (zoom === camera.zoom) return clampCamera(camera, viewport, seed);
  const point = anchor || { x: viewport.width / 2, y: viewport.height / 2 };
  const before = pickGround?.(camera, point)
    || atlas3dScreenToGround(camera, viewport, point, seed);
  const zoomed = clampCamera({
    ...camera,
    zoom,
    targetHeight: Number.isFinite(camera.targetHeight)
      ? camera.targetHeight
      : cameraTerrainHeight(camera, seed),
  }, viewport, seed);
  return anchorCameraOnGround(zoomed, viewport, before, point, seed);
}
