import {
  CONTINENT,
  CONTINENT_HOT_SPRINGS,
  CONTINENT_LAKES,
  MOUNTAIN_SPINE,
  NORTHERN_RIDGES,
} from "../../data/continent.js";
import { continentValueAt, surveyAtlas } from "../../engine/world-generation.js";

export const ATLAS_3D_FOV_DEG = 34;
export const ATLAS_3D_PITCH_DEG = 38;
export const ATLAS_3D_TERRAIN_STRIDE = 4;
export const ATLAS_3D_CAMERA_COAST_INSET = ATLAS_3D_TERRAIN_STRIDE;
export const ATLAS_3D_RENDER_VERSION = "atlas-terrain-3d-v6";
export const ATLAS_3D_MAX_ZOOM = 26;

const DEG_TO_RAD = Math.PI / 180;
const SQRT_THREE_OVER_TWO = Math.sqrt(3) / 2;
const FOV_TAN = Math.tan((ATLAS_3D_FOV_DEG * DEG_TO_RAD) / 2);
const PITCH = ATLAS_3D_PITCH_DEG * DEG_TO_RAD;
const PITCH_SIN = Math.sin(PITCH);
const PITCH_COS = Math.cos(PITCH);
const CAMERA_MIN_CLEARANCE = 3;
const TERRAIN_MAX_HEIGHT = 42;
const TERRAIN_MIN_HEIGHT = -2.8;
const SNOW_CAP_HEIGHT = 30;
const SNOW_CAP_COLOR = 0xd8ddd0;
const COASTAL_SAND_COLOR = 0xb8a870;
const FROZEN_SHELF_COLOR = 0x93a29f;
const COASTAL_BAND_RADIUS = 3;
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
const TERRAIN_GRID_CACHE = new Map();
const FIT_ZOOM_CACHE = new Map();
let lastCameraFrameKey = "";
let lastCameraFrame = null;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
  const mix = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return mix * mix * (3 - 2 * mix);
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

function clampCamera(camera, viewport, seed = CONTINENT.seed) {
  const fit = atlas3dFitZoom(viewport, seed);
  const zoom = clamp(camera.zoom, fit, ATLAS_3D_MAX_ZOOM);
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
  if (FIT_ZOOM_CACHE.size > 40) FIT_ZOOM_CACHE.delete(FIT_ZOOM_CACHE.keys().next().value);
  return fit;
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
  }, viewport, seed);
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

function axisSamples(min, max, stride) {
  const values = [];
  for (let value = min; value <= max; value += stride) values.push(value);
  if (values.at(-1) !== max) values.push(max);
  return values;
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

function terrainLiftFor(sample, coord) {
  const frozenNorth = !!coord && (sample?.realmId === "north" || coord.y <= -170);
  if (!frozenNorth) {
    return sample.terrain === "mountains"
      ? 8.5
      : sample.terrain === "hills"
      ? 2.6
      : sample.terrain === "forest"
      ? 0.65
      : 0;
  }

  // Frostcrown's generator intentionally classifies much of the far north as
  // mountain biome. Treat that classification as climate/ground cover, then
  // reserve the full vertical drama for the authored Spine and parallel
  // ridges. This creates broad glacial shelves and readable valleys instead of
  // turning every four-hex terrain cell into an equally sharp peak.
  const ridgeWeight = Math.max(
    mountainSpineReliefWeightAt(coord),
    northernRidgeReliefWeightAt(coord),
  );
  const authoredRelief = ridgeWeight * ridgeWeight;
  const continuousLift = 2.6 * smoothstep(0.48, 0.7, sample.elevation)
    + 5.9 * smoothstep(0.68, 0.92, sample.elevation);
  return continuousLift * (0.35 + authoredRelief * 0.65);
}

export function atlas3dBaseTerrainHeight(sample, coord = null) {
  if (!sample?.land) return -2.8;
  const frozenNorth = !!coord && (sample.realmId === "north" || coord.y <= -170);
  const ridgeWeight = frozenNorth
    ? Math.max(mountainSpineReliefWeightAt(coord), northernRidgeReliefWeightAt(coord))
    : 1;
  const authoredRelief = ridgeWeight * ridgeWeight;
  const reliefScale = frozenNorth ? 0.22 + authoredRelief * 0.78 : 1;
  const elevation = 0.16
    + (sample.elevation - 0.16) * reliefScale
    + northernRidgeElevationBoostAt(coord);
  const terrainLift = terrainLiftFor(sample, coord);
  return clamp((elevation - 0.16) * 28 + terrainLift, 0.4, TERRAIN_MAX_HEIGHT);
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
    .map((coord) => atlas3dBaseTerrainHeight(surveyAtlas(coord.x, coord.y, seed), coord))
    .filter((height) => height > TERRAIN_MIN_HEIGHT + 0.1)
    .sort((a, b) => a - b);
  const centerHeight = atlas3dBaseTerrainHeight(
    surveyAtlas(lake.center.x, lake.center.y, seed),
    lake.center,
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
    .map((coord) => atlas3dBaseTerrainHeight(surveyAtlas(coord.x, coord.y, seed), coord))
    .filter((height) => height > TERRAIN_MIN_HEIGHT + 0.1)
    .sort((a, b) => a - b);
  const centerHeight = atlas3dBaseTerrainHeight(
    surveyAtlas(spring.center.x, spring.center.y, seed),
    spring.center,
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
  const height = atlas3dBaseTerrainHeight(sample, coord);
  if (!sample?.land || !coord) return height;
  return lakeBasinHeightAt(coord, height, seed);
}

function sampledTerrainHeight(coord, seed, stride = ATLAS_3D_TERRAIN_STRIDE) {
  const key = `${seed}|${stride}|${coord.x},${coord.y}`;
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

function terrainGridKey(seed, stride) {
  return `${seed}|${stride}`;
}

export function registerAtlas3dTerrainData(data) {
  const vertexCount = data?.columns * data?.rows;
  const indexCount = (data?.columns - 1) * (data?.rows - 1) * 6;
  if (!data
    || data.version !== ATLAS_3D_RENDER_VERSION
    || (typeof data.seed !== "string" && !Number.isFinite(data.seed))
    || !Number.isFinite(data.stride)
    || data.stride <= 0
    || !Number.isInteger(data.columns)
    || !Number.isInteger(data.rows)
    || data.columns < 2
    || data.rows < 2
    || !(data.positions instanceof Float32Array)
    || data.positions.length !== vertexCount * 3
    || !(data.colors instanceof Float32Array)
    || data.colors.length !== vertexCount * 3
    || !(data.coastal instanceof Uint8Array)
    || data.coastal.length !== vertexCount
    || !(data.indices instanceof Uint32Array)
    || data.indices.length !== indexCount
    || !(data.trees instanceof Float32Array)
    || data.trees.length % 7 !== 0) return false;
  const key = terrainGridKey(data.seed, data.stride);
  TERRAIN_GRID_CACHE.set(key, data);
  if (TERRAIN_GRID_CACHE.size > 4) TERRAIN_GRID_CACHE.delete(TERRAIN_GRID_CACHE.keys().next().value);
  return true;
}

// Routes, POIs, labels, and vegetation must sit on the rendered mesh rather
// than on a separately sampled procedural surface. The terrain grid uses the
// same diagonal in every cell (a-c-b / b-c-d), so this piecewise-linear sample
// exactly matches the GPU triangles, including the shorter cells at the bounds.
export function atlas3dTerrainHeightAt(
  coord,
  seed = CONTINENT.seed,
  stride = ATLAS_3D_TERRAIN_STRIDE,
) {
  const xCell = axisCell(coord.x, CONTINENT.bounds.xmin, CONTINENT.bounds.xmax, stride);
  const yCell = axisCell(coord.y, CONTINENT.bounds.ymin, CONTINENT.bounds.ymax, stride);
  const grid = TERRAIN_GRID_CACHE.get(terrainGridKey(seed, stride));
  const heightAt = grid
    ? (column, row) => grid.positions[(row * grid.columns + column) * 3 + 1]
    : null;
  const nextColumn = Math.min((grid?.columns || Infinity) - 1, xCell.index + 1);
  const nextRow = Math.min((grid?.rows || Infinity) - 1, yCell.index + 1);
  const a = heightAt
    ? heightAt(xCell.index, yCell.index)
    : sampledTerrainHeight({ x: xCell.lower, y: yCell.lower }, seed, stride);
  const b = heightAt
    ? heightAt(nextColumn, yCell.index)
    : sampledTerrainHeight({ x: xCell.upper, y: yCell.lower }, seed, stride);
  const c = heightAt
    ? heightAt(xCell.index, nextRow)
    : sampledTerrainHeight({ x: xCell.lower, y: yCell.upper }, seed, stride);
  const d = heightAt
    ? heightAt(nextColumn, nextRow)
    : sampledTerrainHeight({ x: xCell.upper, y: yCell.upper }, seed, stride);
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

export function atlas3dTerrainColor(
  sample,
  coord,
  height = atlas3dTerrainHeight(sample, coord),
  seed = CONTINENT.seed,
  coastal = false,
) {
  const mountain = sample?.terrain === "mountains";
  const frozenShelf = sample?.land
    && (sample.realmId === "north" || coord.y <= -170)
    && ["plains", "hills", "mountains", "impassable"].includes(sample.terrain);
  const primaryAmplitude = mountain ? 0.12 : 0.08;
  const secondaryAmplitude = mountain ? 0.06 : 0.04;
  const colorVariance = frozenShelf
    ? (interpolatedCoordinateNoise(coord.x, coord.y, 28, seed + 199) - 0.5) * 0.065
      + (interpolatedCoordinateNoise(coord.x, coord.y, 11, seed + 311) - 0.5) * 0.025
    : (coordinateNoise(coord.x, coord.y, seed + 199) - 0.5) * primaryAmplitude
      + (coordinateNoise(coord.x * 2.3, coord.y * 2.3, seed + 311) - 0.5) * secondaryAmplitude;
  const base = frozenShelf && height < SNOW_CAP_HEIGHT
    ? FROZEN_SHELF_COLOR
    : terrainColor(sample?.land ? sample.terrain : "water", sample?.realmId);
  const relief = sample?.land
    ? (frozenShelf ? (height - 8) * 0.008 : (sample.elevation - 0.48) * 0.24) + colorVariance
    : (sample.elevation - 0.45) * 0.08 + colorVariance * 0.4;
  let channels = colorChannels(base, relief);
  if (coastal && sample?.land) {
    channels = blendColorChannels(channels, COASTAL_SAND_COLOR, 0.4);
  }
  if (height > SNOW_CAP_HEIGHT) {
    const snowWeight = 0.55
      + clamp((height - SNOW_CAP_HEIGHT) / (TERRAIN_MAX_HEIGHT - SNOW_CAP_HEIGHT), 0, 1) * 0.35;
    channels = blendColorChannels(channels, SNOW_CAP_COLOR, snowWeight);
  }
  return channels;
}

function smoothNorthernTerrainHeights(samples, xs, ys, baseHeights) {
  let current = baseHeights;
  const neighborOffsets = [
    [-1, -1, 1], [0, -1, 2], [1, -1, 1],
    [-1, 0, 2],                 [1, 0, 2],
    [-1, 1, 1],  [0, 1, 2],  [1, 1, 1],
  ];
  for (let pass = 0; pass < 3; pass += 1) {
    const next = current.slice();
    for (let row = 1; row < ys.length - 1; row += 1) {
      for (let column = 1; column < xs.length - 1; column += 1) {
        const index = row * xs.length + column;
        const sample = samples[index];
        if (!sample?.land || (sample.realmId !== "north" && ys[row] > -170)) continue;
        let weightedHeight = current[index] * 4;
        let totalWeight = 4;
        for (const [columnOffset, rowOffset, weight] of neighborOffsets) {
          const neighborIndex = (row + rowOffset) * xs.length + column + columnOffset;
          const neighborSample = samples[neighborIndex];
          if (!neighborSample?.land || (neighborSample.realmId !== "north" && ys[row + rowOffset] > -170)) {
            continue;
          }
          weightedHeight += current[neighborIndex] * weight;
          totalWeight += weight;
        }
        const coord = { x: xs[column], y: ys[row] };
        const ridgeWeight = Math.max(
          mountainSpineReliefWeightAt(coord),
          northernRidgeReliefWeightAt(coord),
        );
        const preserveAuthoredRelief = ridgeWeight * ridgeWeight;
        const blend = 0.88 * (1 - preserveAuthoredRelief * 0.82);
        const average = weightedHeight / totalWeight;
        next[index] = current[index] + (average - current[index]) * blend;
      }
    }
    current = next;
  }
  return current;
}

export function buildAtlas3dTerrainData(seed = CONTINENT.seed, stride = ATLAS_3D_TERRAIN_STRIDE) {
  const xs = axisSamples(CONTINENT.bounds.xmin, CONTINENT.bounds.xmax, stride);
  const ys = axisSamples(CONTINENT.bounds.ymin, CONTINENT.bounds.ymax, stride);
  const vertexCount = xs.length * ys.length;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const coastal = new Uint8Array(vertexCount);
  const treeCandidates = [];
  const samples = new Array(vertexCount);
  const baseHeights = new Float32Array(vertexCount);

  for (let row = 0; row < ys.length; row += 1) {
    for (let column = 0; column < xs.length; column += 1) {
      const index = row * xs.length + column;
      samples[index] = surveyAtlas(xs[column], ys[row], seed);
      baseHeights[index] = atlas3dBaseTerrainHeight(samples[index], { x: xs[column], y: ys[row] });
    }
  }

  const smoothedHeights = smoothNorthernTerrainHeights(samples, xs, ys, baseHeights);

  for (let row = 0; row < ys.length; row += 1) {
    for (let column = 0; column < xs.length; column += 1) {
      const x = xs[column];
      const y = ys[row];
      const index = row * xs.length + column;
      const sample = samples[index];
      const scene = atlas3dAxialToScene({ x, y });
      const height = sample.land
        ? lakeBasinHeightAt({ x, y }, smoothedHeights[index], seed)
        : TERRAIN_MIN_HEIGHT;
      const isCoastal = isCoastalGridVertex({ x, y }, sample, seed);
      coastal[index] = isCoastal ? 1 : 0;
      HEIGHT_CACHE.set(`${seed}|${stride}|${x},${y}`, height);
      positions[index * 3] = scene.x;
      positions[index * 3 + 1] = height;
      positions[index * 3 + 2] = scene.z;

      // Biome-aware vertex color with two deterministic noise octaves, plus
      // explicit coastline and permanent-snow tiers.
      const [red, green, blue] = atlas3dTerrainColor(
        sample,
        { x, y },
        height,
        seed,
        isCoastal,
      );
      colors[index * 3] = red;
      colors[index * 3 + 1] = green;
      colors[index * 3 + 2] = blue;

      if (sample.land && sample.terrain === "forest") {
        // A low-frequency grove mask makes woodland read as authored stands
        // and clearings. Fine noise then fills those stands densely enough to
        // survive close mobile zoom without becoming a uniform tree carpet.
        const grove = coordinateNoise(Math.floor(x / 24), Math.floor(y / 24), seed + 43);
        const density = coordinateNoise(x, y, seed);
        const count = grove > 0.34 && density > 0.2
          ? 1 + (density > 0.78 ? 1 : 0)
          : 0;
        for (let tree = 0; tree < count; tree += 1) {
          const jitterX = (coordinateNoise(x, y, seed + tree * 11 + 1) - 0.5) * stride * 0.72;
          const jitterY = (coordinateNoise(x, y, seed + tree * 11 + 2) - 0.5) * stride * 0.72;
          const treeCoord = { x: x + jitterX, y: y + jitterY };
          if (atlas3dAuthoredWaterContains(treeCoord, 1.5)) continue;
          treeCandidates.push({
            coord: treeCoord,
            scale: 0.72 + coordinateNoise(x, y, seed + tree * 11 + 3) * 0.8,
            rotation: coordinateNoise(x, y, seed + tree * 11 + 4) * Math.PI * 2,
            colorFactor: 0.78 + coordinateNoise(x, y, seed + tree * 11 + 5) * 0.28,
            realmIndex: REALM_INDICES[sample.realmId] ?? 0,
          });
        }
      }
    }
  }

  const indices = new Uint32Array((xs.length - 1) * (ys.length - 1) * 6);
  let cursor = 0;
  for (let row = 0; row < ys.length - 1; row += 1) {
    for (let column = 0; column < xs.length - 1; column += 1) {
      const a = row * xs.length + column;
      const b = a + 1;
      const c = a + xs.length;
      const d = c + 1;
      indices[cursor++] = a;
      indices[cursor++] = c;
      indices[cursor++] = b;
      indices[cursor++] = b;
      indices[cursor++] = c;
      indices[cursor++] = d;
    }
  }

  const terrain = {
    version: ATLAS_3D_RENDER_VERSION,
    seed,
    stride,
    columns: xs.length,
    rows: ys.length,
    positions,
    colors,
    coastal,
    indices,
    trees: new Float32Array(0),
  };
  registerAtlas3dTerrainData(terrain);
  const trees = new Float32Array(treeCandidates.length * 7);
  for (let index = 0; index < treeCandidates.length; index += 1) {
    const candidate = treeCandidates[index];
    const treeScene = atlas3dAxialToScene(candidate.coord);
    const offset = index * 7;
    trees[offset] = treeScene.x;
    trees[offset + 1] = atlas3dTerrainHeightAt(candidate.coord, seed, stride);
    trees[offset + 2] = treeScene.z;
    trees[offset + 3] = candidate.scale;
    trees[offset + 4] = candidate.rotation;
    trees[offset + 5] = candidate.colorFactor;
    trees[offset + 6] = candidate.realmIndex;
  }
  terrain.trees = trees;
  registerAtlas3dTerrainData(terrain);
  return terrain;
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
  const height = Math.max(1, viewport?.height || 1);
  const requestedDistance = height / (2 * Math.max(0.001, camera.zoom) * FOV_TAN);
  const distance = Math.max(
    requestedDistance,
    (TERRAIN_MAX_HEIGHT + CAMERA_MIN_CLEARANCE - target.y) / PITCH_COS,
  );
  const frame = {
    target,
    distance,
    position: {
      x: target.x,
      y: target.y + distance * PITCH_COS,
      z: target.z + distance * PITCH_SIN,
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
  const depth = -rel.y * PITCH_COS - rel.z * PITCH_SIN;
  if (depth <= 0.01) return { x: -10000, y: -10000, visible: false, depth };
  const screenUp = rel.y * PITCH_SIN - rel.z * PITCH_COS;
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
    y: -PITCH_COS + ndcY * FOV_TAN * PITCH_SIN,
    z: -PITCH_SIN - ndcY * FOV_TAN * PITCH_COS,
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
  const verticalDenominator = -PITCH_COS + PITCH_SIN * ndcY * FOV_TAN;

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
      const relativeZ = -PITCH_SIN * depth - PITCH_COS * screenUp;
      const candidate = cameraForTarget(analytical, {
        x: groundScene.x - relativeX,
        z: groundScene.z - frame.distance * PITCH_SIN - relativeZ,
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
