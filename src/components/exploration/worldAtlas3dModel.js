import { CONTINENT } from "../../data/continent.js";
import { surveyAtlas } from "../../engine/world-generation.js";

export const ATLAS_3D_FOV_DEG = 34;
export const ATLAS_3D_PITCH_DEG = 38;
export const ATLAS_3D_TERRAIN_STRIDE = 6;
export const ATLAS_3D_RENDER_VERSION = "atlas-terrain-3d-v1";

const DEG_TO_RAD = Math.PI / 180;
const SQRT_THREE_OVER_TWO = Math.sqrt(3) / 2;
const LEGACY_CAMERA_PITCH = 0.76;
const CAMERA_MAX_ZOOM = 26;
const FOV_TAN = Math.tan((ATLAS_3D_FOV_DEG * DEG_TO_RAD) / 2);
const PITCH = ATLAS_3D_PITCH_DEG * DEG_TO_RAD;
const PITCH_SIN = Math.sin(PITCH);
const PITCH_COS = Math.cos(PITCH);
const CAMERA_MIN_CLEARANCE = 3;
const TERRAIN_MAX_HEIGHT = 29.5;
const TERRAIN_MIN_HEIGHT = -2.8;

const TERRAIN_COLORS = Object.freeze({
  indoor: 0x776653,
  settlement: 0x9c8158,
  street: 0xa58d65,
  road: 0xb79359,
  wall: 0x766d61,
  plains: 0x586f43,
  hills: 0x695039,
  forest: 0x244d33,
  marsh: 0x315b56,
  mountains: 0x5c5958,
  impassable: 0x394840,
  water: 0x173e50,
});
const HEIGHT_CACHE = new Map();
const FIT_ZOOM_CACHE = new Map();
let lastCameraFrameKey = "";
let lastCameraFrame = null;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// The surrounding atlas UI still stores its center in the established 2D
// camera coordinates so search, fit, and fallback share one state object.
// Keep this tiny bridge local so the terrain worker never imports UI/game
// modules (or their browser-only Supabase singleton).
function legacyProjectAxial(x, y) {
  return { x: x + y * 0.5, y: y * SQRT_THREE_OVER_TWO * LEGACY_CAMERA_PITCH };
}

const LEGACY_PROJECTED_BOUNDS = (() => {
  const corners = [
    legacyProjectAxial(CONTINENT.bounds.xmin, CONTINENT.bounds.ymin),
    legacyProjectAxial(CONTINENT.bounds.xmin, CONTINENT.bounds.ymax),
    legacyProjectAxial(CONTINENT.bounds.xmax, CONTINENT.bounds.ymin),
    legacyProjectAxial(CONTINENT.bounds.xmax, CONTINENT.bounds.ymax),
  ];
  return {
    xmin: Math.min(...corners.map((point) => point.x)),
    xmax: Math.max(...corners.map((point) => point.x)),
    ymin: Math.min(...corners.map((point) => point.y)),
    ymax: Math.max(...corners.map((point) => point.y)),
  };
})();

function clampAxis(center, viewLength, min, max) {
  if (max - min <= viewLength) return (min + max) / 2;
  const half = viewLength / 2;
  return Math.min(max - half, Math.max(min + half, center));
}

function clampCamera(camera, viewport, seed = CONTINENT.seed) {
  const fit = atlas3dFitZoom(viewport, seed);
  const zoom = clamp(camera.zoom, fit, CAMERA_MAX_ZOOM);
  const visibleFraction = clamp(fit / zoom, 0, 1);
  const viewWidth = (LEGACY_PROJECTED_BOUNDS.xmax - LEGACY_PROJECTED_BOUNDS.xmin) * visibleFraction;
  const viewHeight = (LEGACY_PROJECTED_BOUNDS.ymax - LEGACY_PROJECTED_BOUNDS.ymin) * visibleFraction;
  const clamped = {
    zoom,
    x: clampAxis(camera.x, viewWidth, LEGACY_PROJECTED_BOUNDS.xmin, LEGACY_PROJECTED_BOUNDS.xmax),
    y: clampAxis(camera.y, viewHeight, LEGACY_PROJECTED_BOUNDS.ymin, LEGACY_PROJECTED_BOUNDS.ymax),
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
    x: (LEGACY_PROJECTED_BOUNDS.xmin + LEGACY_PROJECTED_BOUNDS.xmax) / 2,
    y: (LEGACY_PROJECTED_BOUNDS.ymin + LEGACY_PROJECTED_BOUNDS.ymax) / 2,
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
  while (upper < CAMERA_MAX_ZOOM && fits(upper)) upper *= 2;
  upper = Math.min(CAMERA_MAX_ZOOM, upper);
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
    x: (LEGACY_PROJECTED_BOUNDS.xmin + LEGACY_PROJECTED_BOUNDS.xmax) / 2,
    y: (LEGACY_PROJECTED_BOUNDS.ymin + LEGACY_PROJECTED_BOUNDS.ymax) / 2,
    zoom: atlas3dFitZoom(viewport, seed),
  };
  return clampCamera({
    ...fitted,
    targetHeight: cameraTerrainHeight(fitted, seed),
  }, viewport, seed);
}

function coordinateNoise(x, y, salt = 0) {
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

export function atlas3dTerrainHeight(sample) {
  if (!sample?.land) return -2.8;
  const terrainLift = sample.terrain === "mountains"
    ? 4.2
    : sample.terrain === "hills"
    ? 1.8
    : sample.terrain === "forest"
    ? 0.65
    : 0;
  return clamp((sample.elevation - 0.16) * 28 + terrainLift, 0.4, 29.5);
}

function sampledTerrainHeight(coord, seed) {
  const key = `${seed}|${coord.x},${coord.y}`;
  if (HEIGHT_CACHE.has(key)) return HEIGHT_CACHE.get(key);
  const height = atlas3dTerrainHeight(surveyAtlas(coord.x, coord.y, seed));
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
  return { lower, upper, mix: upper === lower ? 0 : (clamped - lower) / (upper - lower) };
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

export function buildAtlas3dTerrainData(seed = CONTINENT.seed, stride = ATLAS_3D_TERRAIN_STRIDE) {
  const xs = axisSamples(CONTINENT.bounds.xmin, CONTINENT.bounds.xmax, stride);
  const ys = axisSamples(CONTINENT.bounds.ymin, CONTINENT.bounds.ymax, stride);
  const vertexCount = xs.length * ys.length;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const trees = [];

  for (let row = 0; row < ys.length; row += 1) {
    for (let column = 0; column < xs.length; column += 1) {
      const x = xs[column];
      const y = ys[row];
      const index = row * xs.length + column;
      const sample = surveyAtlas(x, y, seed);
      const scene = atlas3dAxialToScene({ x, y });
      const height = atlas3dTerrainHeight(sample);
      HEIGHT_CACHE.set(`${seed}|${x},${y}`, height);
      positions[index * 3] = scene.x;
      positions[index * 3 + 1] = height;
      positions[index * 3 + 2] = scene.z;

      const base = TERRAIN_COLORS[sample.land ? sample.terrain : "water"] || TERRAIN_COLORS.plains;
      const relief = sample.land ? (sample.elevation - 0.48) * 0.17 : (sample.elevation - 0.45) * 0.06;
      const [red, green, blue] = colorChannels(base, relief);
      colors[index * 3] = red;
      colors[index * 3 + 1] = green;
      colors[index * 3 + 2] = blue;

      if (sample.land && sample.terrain === "forest") {
        const density = coordinateNoise(x, y, seed);
        const count = density > 0.94 ? 2 : density > 0.55 ? 1 : 0;
        for (let tree = 0; tree < count; tree += 1) {
          const jitterX = (coordinateNoise(x, y, seed + tree * 11 + 1) - 0.5) * stride * 0.72;
          const jitterY = (coordinateNoise(x, y, seed + tree * 11 + 2) - 0.5) * stride * 0.72;
          const treeCoord = { x: x + jitterX, y: y + jitterY };
          const treeScene = atlas3dAxialToScene(treeCoord);
          trees.push(
            treeScene.x,
            atlas3dTerrainHeightAt(treeCoord, seed, stride),
            treeScene.z,
            0.72 + coordinateNoise(x, y, seed + tree * 11 + 3) * 0.8,
            coordinateNoise(x, y, seed + tree * 11 + 4) * Math.PI * 2,
            0.78 + coordinateNoise(x, y, seed + tree * 11 + 5) * 0.28,
          );
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

  return {
    version: ATLAS_3D_RENDER_VERSION,
    seed,
    stride,
    columns: xs.length,
    rows: ys.length,
    positions,
    colors,
    indices,
    trees: new Float32Array(trees),
  };
}

function cameraTarget(camera) {
  const axialY = camera.y / (SQRT_THREE_OVER_TWO * LEGACY_CAMERA_PITCH);
  return atlas3dAxialToScene({ x: camera.x - axialY * 0.5, y: axialY });
}

function cameraTerrainHeight(camera, seed = CONTINENT.seed) {
  return atlas3dTerrainHeightAt(atlas3dSceneToAxial(cameraTarget(camera)), seed);
}

function cameraForTarget(camera, target, viewport, seed = CONTINENT.seed) {
  const axial = atlas3dSceneToAxial(target);
  const projected = legacyProjectAxial(axial.x, axial.y);
  return clampCamera({ ...camera, x: projected.x, y: projected.y }, viewport, seed);
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
  const zoom = clamp(camera.zoom * factor, fit, CAMERA_MAX_ZOOM);
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
