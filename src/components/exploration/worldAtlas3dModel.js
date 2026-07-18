import { CONTINENT } from "../../data/continent.js";
import { surveyAtlas } from "../../engine/world-generation.js";
import {
  ATLAS_MAX_ZOOM,
  ATLAS_OBLIQUE_PITCH,
  SQRT_THREE_OVER_TWO,
  atlasFitZoom,
  clampAtlasCamera,
  projectAxial,
} from "./worldAtlasModel.js";

export const ATLAS_3D_FOV_DEG = 34;
export const ATLAS_3D_PITCH_DEG = 38;
export const ATLAS_3D_TERRAIN_STRIDE = 8;
export const ATLAS_3D_RENDER_VERSION = "atlas-terrain-3d-v1";

const DEG_TO_RAD = Math.PI / 180;
const FOV_TAN = Math.tan((ATLAS_3D_FOV_DEG * DEG_TO_RAD) / 2);
const PITCH = ATLAS_3D_PITCH_DEG * DEG_TO_RAD;
const PITCH_SIN = Math.sin(PITCH);
const PITCH_COS = Math.cos(PITCH);

const TERRAIN_COLORS = Object.freeze({
  indoor: 0x776653,
  settlement: 0x9c8158,
  street: 0xa58d65,
  road: 0xb79359,
  wall: 0x766d61,
  plains: 0x78875b,
  hills: 0x806947,
  forest: 0x355d43,
  marsh: 0x47716b,
  mountains: 0x655f5a,
  impassable: 0x394840,
  water: 0x214c60,
});
const HEIGHT_CACHE = new Map();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function coordinateNoise(x, y, salt = 0) {
  let value = Math.imul((x + salt * 31) | 0, 374761393) ^ Math.imul((y - salt * 17) | 0, 668265263);
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
    ? 2.6
    : sample.terrain === "hills"
    ? 1.2
    : sample.terrain === "forest"
    ? 0.45
    : 0;
  return clamp((sample.elevation - 0.18) * 18 + terrainLift, 0.35, 18.5);
}

export function atlas3dTerrainHeightAt(coord, seed = CONTINENT.seed) {
  const key = `${seed}|${coord.x},${coord.y}`;
  if (HEIGHT_CACHE.has(key)) return HEIGHT_CACHE.get(key);
  const height = atlas3dTerrainHeight(surveyAtlas(coord.x, coord.y, seed));
  if (HEIGHT_CACHE.size >= 100000) HEIGHT_CACHE.clear();
  HEIGHT_CACHE.set(key, height);
  return height;
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
      positions[index * 3] = scene.x;
      positions[index * 3 + 1] = height;
      positions[index * 3 + 2] = scene.z;

      const base = TERRAIN_COLORS[sample.land ? sample.terrain : "water"] || TERRAIN_COLORS.plains;
      const relief = sample.land ? (sample.elevation - 0.48) * 0.22 : (sample.elevation - 0.45) * 0.08;
      const [red, green, blue] = colorChannels(base, relief);
      colors[index * 3] = red;
      colors[index * 3 + 1] = green;
      colors[index * 3 + 2] = blue;

      if (sample.land && sample.terrain === "forest") {
        const density = coordinateNoise(x, y, seed);
        const count = density > 0.72 ? 2 : density > 0.18 ? 1 : 0;
        for (let tree = 0; tree < count; tree += 1) {
          const jitterX = (coordinateNoise(x, y, seed + tree * 11 + 1) - 0.5) * stride * 0.72;
          const jitterY = (coordinateNoise(x, y, seed + tree * 11 + 2) - 0.5) * stride * 0.72;
          const treeScene = atlas3dAxialToScene({ x: x + jitterX, y: y + jitterY });
          trees.push(
            treeScene.x,
            height,
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
  const axialY = camera.y / (SQRT_THREE_OVER_TWO * ATLAS_OBLIQUE_PITCH);
  return atlas3dAxialToScene({ x: camera.x - axialY * 0.5, y: axialY });
}

function cameraForTarget(camera, target, viewport) {
  const axial = atlas3dSceneToAxial(target);
  const projected = projectAxial(axial.x, axial.y);
  return clampAtlasCamera({ ...camera, x: projected.x, y: projected.y }, viewport);
}

export function atlas3dCameraFrame(camera, viewport) {
  const target = cameraTarget(camera);
  const height = Math.max(1, viewport?.height || 1);
  const distance = height / (2 * Math.max(0.001, camera.zoom) * FOV_TAN);
  return {
    target,
    distance,
    position: {
      x: target.x,
      y: distance * PITCH_COS,
      z: target.z + distance * PITCH_SIN,
    },
  };
}

export function atlas3dProject(camera, viewport, coord, height = 0) {
  const frame = atlas3dCameraFrame(camera, viewport);
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

export function atlas3dScreenToGround(camera, viewport, point, groundY = 0) {
  const frame = atlas3dCameraFrame(camera, viewport);
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
  const travel = (groundY - frame.position.y) / direction.y;
  const scene = {
    x: frame.position.x + direction.x * travel,
    z: frame.position.z + direction.z * travel,
  };
  return { ...atlas3dSceneToAxial(scene), scene };
}

export function panAtlas3dCamera(camera, viewport, dxPx, dyPx) {
  const center = { x: viewport.width / 2, y: viewport.height / 2 };
  const moved = atlas3dScreenToGround(camera, viewport, { x: center.x + dxPx, y: center.y + dyPx });
  const target = cameraTarget(camera);
  return cameraForTarget(camera, {
    x: target.x - (moved.scene.x - target.x),
    z: target.z - (moved.scene.z - target.z),
  }, viewport);
}

export function zoomAtlas3dCamera(camera, viewport, factor, anchor = null) {
  const fit = atlasFitZoom(viewport);
  const zoom = clamp(camera.zoom * factor, fit, ATLAS_MAX_ZOOM);
  if (zoom === camera.zoom) return clampAtlasCamera(camera, viewport);
  const point = anchor || { x: viewport.width / 2, y: viewport.height / 2 };
  const before = atlas3dScreenToGround(camera, viewport, point);
  const zoomed = clampAtlasCamera({ ...camera, zoom }, viewport);
  const after = atlas3dScreenToGround(zoomed, viewport, point);
  const target = cameraTarget(zoomed);
  return cameraForTarget(zoomed, {
    x: target.x + before.scene.x - after.scene.x,
    z: target.z + before.scene.z - after.scene.z,
  }, viewport);
}
