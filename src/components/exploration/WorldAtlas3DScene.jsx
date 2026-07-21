import React, { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";
import {
  CONTINENT,
  CONTINENT_HOT_SPRINGS,
  CONTINENT_LAKES,
  CONTINENT_ROUTES,
  CONTINENT_SEA_LANES,
  CONTINENT_WATERWAYS,
  MOUNTAIN_SPINE,
} from "../../data/continent.js";
import {
  ATLAS_3D_BOUNDS,
  ATLAS_3D_ENVIRON_RECORD_STRIDE,
  ATLAS_3D_FIELD_RECORD_STRIDE,
  ATLAS_3D_ROCK_RECORD_STRIDE,
  ATLAS_3D_TREE_RECORD_STRIDE,
  ATLAS_3D_TREE_SPECIES,
  ATLAS_3D_FOV_DEG,
  atlas3dAuthoredWaterContains,
  atlas3dAxialToScene,
  atlas3dCameraFrame,
  clampAtlas3dCamera,
  atlas3dFitZoom,
  atlas3dHotSpringSurfaceHeight,
  atlas3dLakeSurfaceHeight,
  atlas3dSceneToAxial,
  atlas3dScreenToGround,
  atlas3dTerrainHeightAt,
  atlas3dWhitewendSurfaceHeight,
  coordinateNoise,
} from "./worldAtlas3dModel.js";
import { whitemarchTileAt } from "../../data/whitemarch-capital.js";
import { createAtlasChunkStore } from "./atlasChunkStore.js";
import { createAtlasPostStack } from "./atlasPostStack.js";
import { enhanceAtlasTerrainMaterial, setAtlasTerrainWorldTime } from "./atlasTerrainShader.js";
import { getWorldAtlas3dRuntime } from "./worldAtlas3dRuntime.js";
import { ATLAS_LANDMARKS } from "./worldAtlasModel.js";
import { setDressingForChunk } from "../../engine/atlas-set-dressing.js";

const ROUTE_HEIGHT_BIAS = 0.72;
// Keep the ocean beneath the entire perspective frustum. Plane geometry has a
// fixed two-triangle cost, so a horizon-sized surface is no heavier than a
// continent-sized one and avoids exposing a rectangular edge on tall screens.
const WATER_PLANE_SIZE = 20_000;
const MOBILE_RENDER_PIXEL_BUDGET = 900000;
const DESKTOP_RENDER_PIXEL_BUDGET = 1800000;
const ATLAS_TIMEZONE_SPAN_HOURS = 6;
const heightCache = new Map();
const useAtlas3dLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const EAST_FLORA_MESHES = Object.freeze({
  cherry: Object.freeze({
    bounds: Object.freeze({ xmin: 300, xmax: 460, ymin: -150, ymax: 50 }),
    canopyColor: 0xe8a8b8,
    trunkColor: 0x4a3828,
  }),
  ginkgo: Object.freeze({
    bounds: Object.freeze({ xmin: 300, xmax: 470, ymin: 50, ymax: 180 }),
    canopyColor: 0xd4b830,
    trunkColor: 0x3a3020,
  }),
});

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep01(value) {
  const mix = clamp01(value);
  return mix * mix * (3 - 2 * mix);
}

export function atlasPropDetailVisible(currentlyVisible, zoomRatio, qualityId = "high") {
  if (qualityId === "low") return false;
  if (currentlyVisible) return zoomRatio > 1.8;
  return zoomRatio >= 2.2;
}

function wrappedHour(value) {
  return ((value % 24) + 24) % 24;
}

export function atlasWorldLightState(time, coord = { x: 0, y: 0 }) {
  const hour = Number.isFinite(Number(time?.hour)) ? Number(time.hour) : 12;
  const minute = Number.isFinite(Number(time?.minute)) ? Number(time.minute) : 0;
  const day = Number.isFinite(Number(time?.day)) ? Math.max(1, Number(time.day)) : 1;
  const width = CONTINENT.bounds.xmax - CONTINENT.bounds.xmin;
  const centerX = (CONTINENT.bounds.xmin + CONTINENT.bounds.xmax) / 2;
  const timezoneOffset = ((Number(coord?.x) || 0) - centerX) / width * ATLAS_TIMEZONE_SPAN_HOURS;
  const localHour = wrappedHour(hour + minute / 60 + timezoneOffset);

  // Central Avarra follows the engine's established 06:00–20:00 daylight
  // contract. Latitude and the 360-day calendar then move each region's dawn
  // and dusk by up to two hours over the year.
  const calendarDay = ((269 + day - 1) % 360 + 360) % 360;
  const seasonalTilt = Math.sin((calendarDay - 80) / 360 * Math.PI * 2);
  const latitude = clamp01((-(Number(coord?.y) || 0) / 400 + 1) / 2) * 2 - 1;
  const daylightShift = latitude * seasonalTilt * 4;
  const sunrise = 6 - daylightShift / 2;
  const sunset = 20 + daylightShift / 2;
  const dawn = smoothstep01((localHour - (sunrise - 0.8)) / 1.45);
  const dusk = 1 - smoothstep01((localHour - (sunset - 0.65)) / 1.45);
  const daylight = clamp01(dawn * dusk);
  const phase = daylight >= 0.82
    ? "day"
    : localHour >= sunrise - 1 && localHour < sunrise + 1.1
    ? "dawn"
    : localHour >= sunset - 1.1 && localHour < sunset + 1
    ? "dusk"
    : "night";
  const sunProgress = clamp01((localHour - sunrise) / Math.max(1, sunset - sunrise));
  const sunAltitude = daylight > 0 ? Math.sin(sunProgress * Math.PI) : -0.18;

  return {
    day,
    daylight,
    localHour,
    phase,
    sunrise,
    sunset,
    sunAltitude,
    timezoneOffset,
  };
}

function atlasRenderPixelRatio(width, height, quality = null) {
  const mobile = Math.min(width, height) < 720;
  const dprCap = quality?.dprCap ?? (mobile ? 1.3 : 1.65);
  const pixelBudget = quality?.pixelBudget
    ?? (mobile ? MOBILE_RENDER_PIXEL_BUDGET : DESKTOP_RENDER_PIXEL_BUDGET);
  const budgetRatio = Math.sqrt(pixelBudget / Math.max(1, width * height));
  return Math.max(1, Math.min(window.devicePixelRatio || 1, dprCap, budgetRatio));
}

function cachedHeight(coord, seed) {
  const key = `${seed}|${Math.round(coord.x * 10)},${Math.round(coord.y * 10)}`;
  if (heightCache.has(key)) return heightCache.get(key);
  const height = atlas3dTerrainHeightAt(coord, seed);
  if (heightCache.size > 24000) heightCache.clear();
  heightCache.set(key, height);
  return height;
}

function irregularRadii(radius, segments, salt, variance = 0.12) {
  const radii = [];
  for (let index = 0; index < segments; index += 1) {
    const previous = coordinateNoise(index - 1, segments, `${salt}:shore`);
    const current = coordinateNoise(index, segments, `${salt}:shore`);
    const next = coordinateNoise(index + 1, segments, `${salt}:shore`);
    const smoothed = previous * 0.24 + current * 0.52 + next * 0.24;
    radii.push(radius * (1 + (smoothed - 0.5) * variance * 2));
  }
  return radii;
}

function createHorizontalDiscGeometry(THREE, radii) {
  const segments = radii.length;
  const positions = new Float32Array((segments + 1) * 3);
  const normals = new Float32Array((segments + 1) * 3);
  const uvs = new Float32Array((segments + 1) * 2);
  const indices = new Uint32Array(segments * 3);
  normals[1] = 1;
  uvs[0] = 0.5;
  uvs[1] = 0.5;
  const maxRadius = Math.max(...radii);
  for (let index = 0; index < segments; index += 1) {
    const angle = index / segments * Math.PI * 2;
    const vertex = index + 1;
    const x = Math.cos(angle) * radii[index];
    const z = Math.sin(angle) * radii[index];
    positions[vertex * 3] = x;
    positions[vertex * 3 + 2] = z;
    normals[vertex * 3 + 1] = 1;
    uvs[vertex * 2] = 0.5 + x / maxRadius / 2;
    uvs[vertex * 2 + 1] = 0.5 + z / maxRadius / 2;
    indices[index * 3] = 0;
    indices[index * 3 + 1] = vertex;
    indices[index * 3 + 2] = (index + 1) % segments + 1;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

function createHorizontalRingGeometry(THREE, innerRadii, outerRadii) {
  const segments = innerRadii.length;
  const positions = new Float32Array(segments * 2 * 3);
  const normals = new Float32Array(segments * 2 * 3);
  const indices = new Uint32Array(segments * 6);
  for (let index = 0; index < segments; index += 1) {
    const angle = index / segments * Math.PI * 2;
    for (let edge = 0; edge < 2; edge += 1) {
      const vertex = index * 2 + edge;
      const radius = edge ? outerRadii[index] : innerRadii[index];
      positions[vertex * 3] = Math.cos(angle) * radius;
      positions[vertex * 3 + 2] = Math.sin(angle) * radius;
      normals[vertex * 3 + 1] = 1;
    }
    const next = (index + 1) % segments;
    const offset = index * 6;
    indices[offset] = index * 2;
    indices[offset + 1] = next * 2;
    indices[offset + 2] = index * 2 + 1;
    indices[offset + 3] = index * 2 + 1;
    indices[offset + 4] = next * 2;
    indices[offset + 5] = next * 2 + 1;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

function thinPath(path, maxPoints = 320) {
  if (!path || path.length <= maxPoints) return path || [];
  const stride = Math.ceil(path.length / maxPoints);
  const result = [];
  for (let index = 0; index < path.length; index += stride) result.push(path[index]);
  if (result.at(-1) !== path.at(-1)) result.push(path.at(-1));
  return result;
}

function disposeObject(object) {
  object?.traverse?.((child) => {
    child.dispose?.();
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
    else child.material?.dispose?.();
  });
  for (const resource of object?.userData?.disposables || []) resource?.dispose?.();
}

export function createRibbonMesh(THREE, path, {
  seed,
  width,
  widthStart = width,
  widthEnd = width,
  color,
  opacity = 1,
  water = false,
  ocean = false,
  heightBias = ROUTE_HEIGHT_BIAS,
  samples = 200,
  renderOrder = water ? 1 : 2,
}) {
  if (!path || path.length < 2) return null;
  const controlPoints = path.map((coord) => {
    const scene = atlas3dAxialToScene(coord);
    return new THREE.Vector3(scene.x, 0, scene.z);
  });
  const curve = new THREE.CatmullRomCurve3(controlPoints, false, "centripetal");
  const points = curve.getPoints(samples).map((point) => ({
    ...atlas3dSceneToAxial(point),
    scene: point,
  }));
  const positions = new Float32Array(points.length * 2 * 3);
  const uvs = new Float32Array(points.length * 2 * 2);
  const indices = new Uint32Array((points.length - 1) * 6);

  for (let index = 0; index < points.length; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const previousScene = atlas3dAxialToScene(previous);
    const nextScene = atlas3dAxialToScene(next);
    const tangentX = nextScene.x - previousScene.x;
    const tangentZ = nextScene.z - previousScene.z;
    const length = Math.hypot(tangentX, tangentZ) || 1;
    const mix = index / Math.max(1, points.length - 1);
    const sampleWidth = widthStart + (widthEnd - widthStart) * mix;
    const normalX = -tangentZ / length * sampleWidth / 2;
    const normalZ = tangentX / length * sampleWidth / 2;
    const center = points[index].scene;
    const leftCoord = atlas3dSceneToAxial({ x: center.x + normalX, z: center.z + normalZ });
    const rightCoord = atlas3dSceneToAxial({ x: center.x - normalX, z: center.z - normalZ });
    const surfaceBias = water ? Math.min(heightBias, 0.45) : heightBias;
    const leftHeight = ocean ? -1.22 : cachedHeight(leftCoord, seed) + surfaceBias;
    const rightHeight = ocean ? -1.22 : cachedHeight(rightCoord, seed) + surfaceBias;
    const offset = index * 6;
    positions[offset] = center.x + normalX;
    positions[offset + 1] = leftHeight;
    positions[offset + 2] = center.z + normalZ;
    positions[offset + 3] = center.x - normalX;
    positions[offset + 4] = rightHeight;
    positions[offset + 5] = center.z - normalZ;
    const uvOffset = index * 4;
    const distanceV = index / 9;
    uvs[uvOffset] = 0;
    uvs[uvOffset + 1] = distanceV;
    uvs[uvOffset + 2] = 1;
    uvs[uvOffset + 3] = distanceV;
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const offset = index * 6;
    const vertex = index * 2;
    indices[offset] = vertex;
    indices[offset + 1] = vertex + 2;
    indices[offset + 2] = vertex + 1;
    indices[offset + 3] = vertex + 1;
    indices[offset + 4] = vertex + 2;
    indices[offset + 5] = vertex + 3;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute("atlasRibbonUv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: water ? 0.34 : 0.92,
    metalness: water ? 0.08 : 0,
    transparent: opacity < 1,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const flowUniform = { value: 0 };
  material.userData.atlasFlowUniform = flowUniform;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uAtlasFlow = flowUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec2 atlasRibbonUv;\nvarying vec2 vAtlasRibbonUv;",
      )
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvAtlasRibbonUv = atlasRibbonUv;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uAtlasFlow;\nvarying vec2 vAtlasRibbonUv;",
      )
      .replace("#include <color_fragment>", water
        ? `#include <color_fragment>
          float atlasFlow = sin((vAtlasRibbonUv.y - uAtlasFlow) * 5.4
            + sin(vAtlasRibbonUv.y * 0.73) * 1.8);
          float atlasBank = smoothstep(0.0, 0.18, vAtlasRibbonUv.x)
            * smoothstep(0.0, 0.18, 1.0 - vAtlasRibbonUv.x);
          diffuseColor.rgb *= 0.84 + atlasBank * 0.11 + atlasFlow * 0.035;`
        : `#include <color_fragment>
          float atlasRutA = smoothstep(0.12, 0.02, abs(vAtlasRibbonUv.x - 0.27));
          float atlasRutB = smoothstep(0.12, 0.02, abs(vAtlasRibbonUv.x - 0.73));
          float atlasEdge = smoothstep(0.0, 0.16, vAtlasRibbonUv.x)
            * smoothstep(0.0, 0.16, 1.0 - vAtlasRibbonUv.x);
          float atlasGrain = sin(vAtlasRibbonUv.y * 2.9 + vAtlasRibbonUv.x * 8.0) * 0.025;
          diffuseColor.rgb *= 0.78 + atlasEdge * 0.24 - (atlasRutA + atlasRutB) * 0.12 + atlasGrain;`);
  };
  material.customProgramCacheKey = () => `atlas-ribbon-v2-${water ? "water" : "road"}`;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.renderOrder = renderOrder;
  return mesh;
}

// Collect the authored Whitemarch water tiles as a flat water ribbon. The
// continental Whitewend already renders as a terrain-following ribbon outside
// the walls; this adds the in-city segment as a level surface that matches the
// carved channel and reads as water held between the ward banks.
export function whitewendCityWaterPath() {
  const cells = [];
  for (let x = -13; x <= 13; x += 1) {
    for (let y = -13; y <= 13; y += 1) {
      if (whitemarchTileAt(x, y)?.isWater) cells.push({ x, y });
    }
  }
  if (cells.length < 2) return null;
  // Order the cells along the river: the main channel runs down columns 4–5
  // with two authored tails (northern culvert, eastern quay-channel). Sort by
  // the dominant axis of travel so the ribbon doesn't zigzag across columns.
  const byColumn = new Map();
  for (const cell of cells) {
    if (!byColumn.has(cell.x)) byColumn.set(cell.x, []);
    byColumn.get(cell.x).push(cell);
  }
  const main = cells
    .filter((cell) => cell.x === 4 || cell.x === 5)
    .sort((a, b) => a.y - b.y);
  const centerline = main.map((cell) => ({ x: cell.x, y: cell.y }));
  // Extend with the northern culvert and eastern quay tails so both authored
  // mouths carry water to the wall.
  const north = cells
    .filter((cell) => cell.y <= -9 && cell.x > 5)
    .sort((a, b) => (a.x - b.x) || (a.y - b.y));
  const east = cells
    .filter((cell) => cell.y >= 1 && cell.x > 5)
    .sort((a, b) => (a.x - b.x) || (b.y - a.y));
  return { centerline, north, east, cellCount: cells.length, byColumn };
}

export function createWhitewendCityRiver(THREE, seed) {
  const path = whitewendCityWaterPath();
  if (!path) return null;
  const waterHeight = atlas3dWhitewendSurfaceHeight(seed);
  const group = new THREE.Group();
  group.name = "atlas-whitewend-city-river";
  const material = new THREE.MeshStandardMaterial({
    color: 0x2a6b7a,
    emissive: 0x0a2430,
    emissiveIntensity: 0.22,
    roughness: 0.22,
    metalness: 0.1,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
  });
  const buildFlatRibbon = (cells, width = 1.9) => {
    if (!cells || cells.length < 2) return null;
    const positions = [];
    const indices = [];
    for (let index = 0; index < cells.length; index += 1) {
      const previous = cells[Math.max(0, index - 1)];
      const next = cells[Math.min(cells.length - 1, index + 1)];
      const prevScene = atlas3dAxialToScene(previous);
      const nextScene = atlas3dAxialToScene(next);
      const tangentX = nextScene.x - prevScene.x;
      const tangentZ = nextScene.z - prevScene.z;
      const length = Math.hypot(tangentX, tangentZ) || 1;
      const normalX = (-tangentZ / length) * (width / 2);
      const normalZ = (tangentX / length) * (width / 2);
      const center = atlas3dAxialToScene(cells[index]);
      positions.push(center.x + normalX, waterHeight, center.z + normalZ);
      positions.push(center.x - normalX, waterHeight, center.z - normalZ);
      if (index > 0) {
        const vertex = index * 2;
        indices.push(vertex - 2, vertex, vertex - 1, vertex - 1, vertex, vertex + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 1;
    mesh.receiveShadow = true;
    return mesh;
  };
  const main = buildFlatRibbon(path.centerline, 2.3);
  if (main) group.add(main);
  const north = buildFlatRibbon(path.north, 1.5);
  if (north) group.add(north);
  const east = buildFlatRibbon(path.east, 1.6);
  if (east) group.add(east);
  group.userData.waterHeight = waterHeight;
  group.userData.disposables = [material];
  return group;
}

function createRouteGroup(THREE, seed, focusedRealmId) {
  const group = new THREE.Group();
  group.name = "atlas-routes";

  for (const river of CONTINENT_WATERWAYS) {
    const ribbon = createRibbonMesh(THREE, river.waypoints, {
      seed,
      width: river.width || 1.9,
      widthStart: river.widthStart || 1.4,
      widthEnd: river.widthEnd || 2.6,
      color: 0x65bfd2,
      opacity: 0.82,
      water: true,
      heightBias: 0.45,
    });
    if (ribbon) group.add(ribbon);
  }

  for (const lane of CONTINENT_SEA_LANES) {
    const muted = focusedRealmId && !lane.realmIds?.includes(focusedRealmId);
    const ribbon = createRibbonMesh(THREE, lane.waypoints, {
      seed,
      width: 1.1,
      color: 0x83cbd4,
      opacity: muted ? 0.08 : 0.36,
      water: true,
      ocean: true,
    });
    if (ribbon) {
      ribbon.name = `atlas-sea-lane-${lane.id}`;
      ribbon.userData.atlasSeaLane = true;
      group.add(ribbon);
    }
  }

  for (const route of CONTINENT_ROUTES) {
    const muted = focusedRealmId && !route.realmIds?.includes(focusedRealmId);
    const regional = route.kind === "regional-road";
    const ribbon = createRibbonMesh(THREE, route.waypoints, {
      seed,
      width: route.width || (regional ? 1.2 : 1.9),
      color: regional ? 0xc6a66b : 0xe7bd6f,
      opacity: muted ? 0.1 : regional ? 0.55 : 0.84,
    });
    if (ribbon) group.add(ribbon);
  }

  for (const lake of CONTINENT_LAKES) {
    group.add(createInsetLake(THREE, lake, seed));
  }
  return group;
}

export function createInsetLake(THREE, lake, seed) {
  const center = atlas3dAxialToScene(lake.center);
  const radius = Math.max(2, lake.radius * 0.9);
  const salt = `${seed}:lake:${lake.id || lake.name}`;
  const radii = irregularRadii(radius, 36, salt, 0.28);
  const geometry = createHorizontalDiscGeometry(THREE, radii);
  const waterHeight = atlas3dLakeSurfaceHeight(lake, seed);

  const material = new THREE.MeshStandardMaterial({
    color: 0x1f7195,
    emissive: 0x071f2b,
    emissiveIntensity: 0.18,
    roughness: 0.24,
    metalness: 0.12,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `atlas-lake-${lake.id || lake.name}`;
  mesh.position.set(center.x, waterHeight, center.z);
  mesh.userData.waterHeight = waterHeight;
  mesh.userData.irregularShoreline = true;
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;

  const innerRadii = radii.map((value) => value * 0.97);
  const outerRadii = irregularRadii(Math.max(radius + 0.9, lake.radius + 0.45), 36, `${salt}:bank`, 0.2);
  const shoreline = new THREE.Mesh(
    createHorizontalRingGeometry(THREE, innerRadii, outerRadii),
    new THREE.MeshStandardMaterial({
      color: 0x8f8262,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
  );
  shoreline.name = `${mesh.name}-shoreline`;
  shoreline.position.y = -0.055;
  shoreline.receiveShadow = true;
  shoreline.renderOrder = 1;
  mesh.add(shoreline);
  return mesh;
}

export function createHotSprings(THREE, seed) {
  const group = new THREE.Group();
  group.name = "atlas-hot-springs";

  for (const spring of CONTINENT_HOT_SPRINGS) {
    const center = atlas3dAxialToScene(spring.center);
    const radius = Math.max(1.5, spring.radius);
    const salt = `${seed}:spring:${spring.id || spring.name}`;
    const radii = irregularRadii(radius, 28, salt, 0.16);
    const poolGeometry = createHorizontalDiscGeometry(THREE, radii);
    const poolHeight = atlas3dHotSpringSurfaceHeight(spring, seed);
    const poolMaterial = new THREE.MeshStandardMaterial({
      color: 0x55d8c5,
      emissive: 0x123e38,
      emissiveIntensity: 0.3,
      roughness: 0.18,
      metalness: 0.08,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    const pool = new THREE.Mesh(poolGeometry, poolMaterial);
    pool.name = `atlas-hot-spring-${spring.id || spring.name}`;
    pool.position.set(center.x, poolHeight, center.z);
    pool.userData.irregularShoreline = true;
    pool.receiveShadow = true;
    pool.renderOrder = 1;
    group.add(pool);

    const springRim = new THREE.Mesh(
      createHorizontalRingGeometry(
        THREE,
        radii.map((value) => value * 0.96),
        irregularRadii(radius + 0.75, 28, `${salt}:rim`, 0.13),
      ),
      new THREE.MeshStandardMaterial({ color: 0x586052, roughness: 1, metalness: 0 }),
    );
    springRim.name = `atlas-hot-spring-rim-${spring.id || spring.name}`;
    springRim.position.set(center.x, poolHeight - 0.06, center.z);
    springRim.receiveShadow = true;
    springRim.renderOrder = 1;
    group.add(springRim);

    const steamGeometry = new THREE.PlaneGeometry(
      Math.max(2.4, spring.radius * 1.7),
      Math.max(1.8, spring.radius * 1.05),
      2,
      1,
    );
    const steamMaterial = new THREE.MeshBasicMaterial({
      color: 0xe8eef2,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const steam = new THREE.Mesh(steamGeometry, steamMaterial);
    steam.name = `atlas-hot-spring-steam-${spring.id || spring.name}`;
    steam.position.set(center.x, poolHeight + 2, center.z);
    steam.userData.billboard = true;
    steam.renderOrder = 3;
    group.add(steam);
  }

  return group;
}

function mountainCloudClusters() {
  const clusters = [];
  for (let start = 0; start < MOUNTAIN_SPINE.waypoints.length - 1; start += 2) {
    const end = Math.min(MOUNTAIN_SPINE.waypoints.length - 1, start + 2);
    const samples = [];
    for (let index = start; index <= end; index += 1) {
      samples.push(MOUNTAIN_SPINE.waypoints[index]);
      if (index < end) {
        const next = MOUNTAIN_SPINE.waypoints[index + 1];
        samples.push({
          x: (MOUNTAIN_SPINE.waypoints[index].x + next.x) / 2,
          y: (MOUNTAIN_SPINE.waypoints[index].y + next.y) / 2,
        });
      }
    }
    for (const pass of MOUNTAIN_SPINE.passes || []) {
      if (samples.some((sample) => Math.hypot(sample.x - pass.coord.x, sample.y - pass.coord.y) <= 72)) {
        samples.push(pass.coord);
      }
    }
    clusters.push(samples);
  }
  return clusters;
}

export function createMountainClouds(THREE, seed) {
  const group = new THREE.Group();
  group.name = "atlas-mountain-clouds";
  const textureSize = 64;
  const pixels = new Uint8Array(textureSize * textureSize * 4);
  for (let y = 0; y < textureSize; y += 1) {
    for (let x = 0; x < textureSize; x += 1) {
      const nx = (x + 0.5) / textureSize * 2 - 1;
      const ny = (y + 0.5) / textureSize * 2 - 1;
      const radius = Math.hypot(nx * 0.86, ny * 1.12);
      const edge = smoothstep01((1.03 - radius) / 0.42);
      const billow = 0.68 + coordinateNoise(x, y, `${seed}:cloud-alpha`) * 0.32;
      const offset = (y * textureSize + x) * 4;
      pixels[offset] = 255;
      pixels[offset + 1] = 255;
      pixels[offset + 2] = 255;
      pixels[offset + 3] = Math.round(255 * edge * billow);
    }
  }
  const cloudTexture = new THREE.DataTexture(pixels, textureSize, textureSize, THREE.RGBAFormat);
  cloudTexture.needsUpdate = true;
  cloudTexture.generateMipmaps = true;
  cloudTexture.magFilter = THREE.LinearFilter;
  cloudTexture.minFilter = THREE.LinearMipmapLinearFilter;
  group.userData.disposables = [cloudTexture];

  for (const [clusterIndex, samples] of mountainCloudClusters().entries()) {
    const sampledPeaks = samples.map((coord) => ({ coord, height: cachedHeight(coord, seed) }));
    const peak = sampledPeaks.reduce((highest, sample) => (
      !highest || sample.height > highest.height ? sample : highest
    ), null);
    if (!peak || peak.height < 23.5) continue;

    const patchNoise = coordinateNoise(peak.coord.x, peak.coord.y, `${seed}:cloud-count:${clusterIndex}`);
    const patchCount = 4 + Math.floor(patchNoise * 5);
    for (let patchIndex = 0; patchIndex < patchCount; patchIndex += 1) {
      const salt = `${seed}:cloud:${clusterIndex}:${patchIndex}`;
      const angle = coordinateNoise(peak.coord.x, peak.coord.y, `${salt}:angle`) * Math.PI * 2;
      const radius = 5 + coordinateNoise(peak.coord.y, peak.coord.x, `${salt}:radius`) * 24;
      const coord = {
        x: peak.coord.x + Math.cos(angle) * radius,
        y: peak.coord.y + Math.sin(angle) * radius * 0.65,
      };
      const center = atlas3dAxialToScene(coord);
      const width = 11 + coordinateNoise(coord.x, coord.y, `${salt}:width`) * 13;
      const depth = 5 + coordinateNoise(coord.y, coord.x, `${salt}:depth`) * 8;
      const geometry = new THREE.PlaneGeometry(width, depth, 4, 3);
      const position = geometry.getAttribute("position");
      for (let vertex = 0; vertex < position.count; vertex += 1) {
        const displacementX = (coordinateNoise(vertex, clusterIndex, `${salt}:vx`) - 0.5) * 1.2;
        const displacementY = (coordinateNoise(vertex, patchIndex, `${salt}:vy`) - 0.5) * 0.8;
        position.setXY(vertex, position.getX(vertex) + displacementX, position.getY(vertex) + displacementY);
      }
      position.needsUpdate = true;
      geometry.rotateX(-Math.PI / 2);
      geometry.computeBoundingSphere();

      const opacity = 0.075 + coordinateNoise(coord.x, coord.y, `${salt}:opacity`) * 0.065;
      const material = new THREE.MeshBasicMaterial({
        color: 0xe8eef2,
        map: cloudTexture,
        transparent: true,
        opacity,
        alphaTest: 0.03,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const cloud = new THREE.Mesh(geometry, material);
      const altitudeNoise = coordinateNoise(coord.y, coord.x, `${salt}:altitude`);
      // Keep every sheet above the sampled ridge crown. Seating the sheet
      // inside the mountain lets the depth buffer cut it into bright,
      // crystalline wedges when viewed at the close diorama pitch.
      const altitude = Math.max(
        peak.height + 2.25,
        cachedHeight(coord, seed) + 3.25,
      ) + altitudeNoise * 1.75;
      cloud.position.set(center.x, altitude, center.z);
      cloud.rotation.y = angle;
      cloud.name = `atlas-mountain-cloud-${clusterIndex}-${patchIndex}`;
      cloud.renderOrder = 2;
      group.add(cloud);
    }
  }

  return group;
}

function createSeenTrail(THREE, seenKeys, seed) {
  const group = new THREE.Group();
  group.name = "atlas-seen-trail";
  const positions = [];
  for (const key of seenKeys || []) {
    const comma = key.indexOf(",");
    if (comma < 1) continue;
    const coord = { x: Number(key.slice(0, comma)), y: Number(key.slice(comma + 1)) };
    if (!Number.isFinite(coord.x) || !Number.isFinite(coord.y)) continue;
    const point = atlas3dAxialToScene(coord);
    positions.push(point.x, cachedHeight(coord, seed) + 0.42, point.z);
  }
  if (positions.length === 0) return group;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  const material = new THREE.PointsMaterial({
    color: 0xf3ca72,
    size: 1.65,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  const trail = new THREE.Points(geometry, material);
  trail.renderOrder = 3;
  group.add(trail);
  return group;
}

function createJourneyGroup(THREE, seed, journey, breaks) {
  const group = new THREE.Group();
  group.name = "atlas-journey";
  if (!journey) return group;

  const current = thinPath(journey.legPath);
  const continuation = thinPath(journey.fullPath.slice(Math.max(0, (journey.legPath?.length || 1) - 1)));
  if (continuation.length > 1) {
    const halo = createRibbonMesh(THREE, continuation, {
      seed, width: 4.4, color: 0x17110d, opacity: 0.72, heightBias: 1.05, renderOrder: 4,
    });
    const ribbon = createRibbonMesh(THREE, continuation, {
      seed, width: 1.45, color: 0xe6c675, opacity: 0.58, heightBias: 1.13, renderOrder: 4,
    });
    if (halo) group.add(halo);
    if (ribbon) group.add(ribbon);
  }
  if (current.length > 1) {
    const halo = createRibbonMesh(THREE, current, {
      seed, width: 6.2, color: 0x15100d, opacity: 0.86, heightBias: 1.18, renderOrder: 4,
    });
    const ribbon = createRibbonMesh(THREE, current, {
      seed, width: 2.65, color: 0xffdf70, opacity: 1, heightBias: 1.28, renderOrder: 4,
    });
    if (halo) group.add(halo);
    if (ribbon) group.add(ribbon);
  }

  for (const stop of breaks || []) {
    const point = atlas3dAxialToScene(stop);
    const geometry = new THREE.CylinderGeometry(2.8, 2.8, 0.9, 18);
    const material = new THREE.MeshStandardMaterial({ color: 0xe0ad58, roughness: 0.6, metalness: 0.08 });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.set(point.x, cachedHeight(stop, seed) + 1.3, point.z);
    group.add(marker);
  }
  return group;
}

// Realm-indexed canopy/trunk colors and canopy shape multipliers [xz, y].
const REALM_CANOPY_COLORS = [0x4a7a50, 0x4d7252, 0x2c5c30, 0x4a5824, 0x1a4422];
const REALM_TREE_SHAPE    = [[1.0, 1.0], [0.72, 1.25], [1.3, 0.8], [0.8, 0.65], [1.4, 1.15]];

export const REALM_SETTLEMENT_COLORS = Object.freeze({
  central: { stone: 0x887a6c, darkStone: 0x554a40, roof: 0x2e2820 },
  north: { stone: 0xaab8b8, darkStone: 0x4c5960, roof: 0x1e2b34 },
  east: { stone: 0x9b9275, darkStone: 0x4b2f22, roof: 0x5d2520 },
  south: { stone: 0xb98a54, darkStone: 0x76502d, roof: 0x6d3523 },
  west: { stone: 0x5f674d, darkStone: 0x283323, roof: 0x17301f },
});

const SETTLEMENT_LANDMARK_KINDS = new Set([
  "city", "town", "settlement", "village", "fortress", "castle",
  "fort", "checkpoint", "port", "wonder",
]);

function insideBounds(coord, bounds) {
  return coord.x >= bounds.xmin && coord.x <= bounds.xmax
    && coord.y >= bounds.ymin && coord.y <= bounds.ymax;
}

export function atlasEastFloraVariant(coord, seed) {
  if (coordinateNoise(coord.x, coord.y, seed + 711) <= 0.72) return "standard";
  if (insideBounds(coord, EAST_FLORA_MESHES.cherry.bounds)) return "cherry";
  if (insideBounds(coord, EAST_FLORA_MESHES.ginkgo.bounds)) return "ginkgo";
  return "standard";
}

export function createVegetationGroup(THREE, treeData, seed, quality = null) {
  const vegetation = new THREE.Group();
  vegetation.name = "atlas-vegetation";
  const treeCount = Math.floor(treeData.length / ATLAS_3D_TREE_RECORD_STRIDE);
  const records = { conifer: [], broadleaf: [], scrub: [], cherry: [], ginkgo: [] };
  const propDensity = quality?.propDensity ?? 1;

  for (let index = 0; index < treeCount; index += 1) {
    const offset = index * ATLAS_3D_TREE_RECORD_STRIDE;
    const realmIdx = Math.min(4, Math.max(0, Math.round(treeData[offset + 6]) || 0));
    const species = Math.min(
      ATLAS_3D_TREE_SPECIES.ginkgo,
      Math.max(ATLAS_3D_TREE_SPECIES.conifer, Math.round(treeData[offset + 7]) || 0),
    );
    const variant = species === ATLAS_3D_TREE_SPECIES.cherry
      ? "cherry"
      : species === ATLAS_3D_TREE_SPECIES.ginkgo
      ? "ginkgo"
      : species === ATLAS_3D_TREE_SPECIES.conifer
      ? "conifer"
      : species === ATLAS_3D_TREE_SPECIES.scrub
      ? "scrub"
      : "broadleaf";
    const record = {
      x: treeData[offset],
      groundHeight: treeData[offset + 1],
      z: treeData[offset + 2],
      scale: treeData[offset + 3],
      rotation: treeData[offset + 4],
      colorFactor: treeData[offset + 5],
      realmIdx,
    };
    if (coordinateNoise(record.x, record.z, seed + 907) <= propDensity) records[variant].push(record);
  }

  const core = new THREE.Group();
  core.name = "atlas-vegetation-core";
  const detail = new THREE.Group();
  detail.name = "atlas-vegetation-detail";
  detail.visible = false;
  vegetation.add(core, detail);

  const coniferLower = new THREE.ConeGeometry(1.75, 2.6, 7, 1);
  coniferLower.translate(0, 2.05, 0);
  const coniferMiddle = new THREE.ConeGeometry(1.42, 2.45, 7, 1);
  coniferMiddle.translate(0, 3.15, 0);
  const coniferUpper = new THREE.ConeGeometry(1.04, 2.2, 7, 1);
  coniferUpper.translate(0, 4.18, 0);
  const coniferTrunk = new THREE.CylinderGeometry(0.18, 0.28, 2.05, 6);
  coniferTrunk.translate(0, 1.025, 0);

  const broadleafLeft = new THREE.SphereGeometry(1.2, 6, 4);
  broadleafLeft.scale(1.05, 0.82, 0.98);
  broadleafLeft.translate(-0.58, 2.8, 0.08);
  const broadleafRight = broadleafLeft.clone();
  broadleafRight.translate(1.12, 0.08, -0.18);
  const broadleafCrown = new THREE.SphereGeometry(1.32, 6, 4);
  broadleafCrown.scale(1.08, 0.84, 1.04);
  broadleafCrown.translate(0, 3.65, 0);
  const broadleafTrunk = new THREE.CylinderGeometry(0.17, 0.28, 2.2, 6);
  broadleafTrunk.translate(0, 1.1, 0);

  const scrubLeft = new THREE.SphereGeometry(1.08, 5, 3);
  scrubLeft.scale(1.2, 0.55, 0.9);
  scrubLeft.translate(-0.4, 1.45, 0);
  const scrubRight = scrubLeft.clone();
  scrubRight.translate(0.85, 0.16, 0.1);
  const scrubTrunk = new THREE.CylinderGeometry(0.16, 0.25, 1.25, 5);
  scrubTrunk.translate(0, 0.625, 0);

  const cherryLeft = new THREE.SphereGeometry(1.12, 6, 4);
  cherryLeft.scale(1.06, 0.68, 1);
  cherryLeft.translate(-0.48, 2.55, 0);
  const cherryRight = cherryLeft.clone();
  cherryRight.translate(0.96, 0.06, 0.08);
  const cherryCrown = new THREE.SphereGeometry(1.18, 6, 4);
  cherryCrown.scale(1, 0.66, 1);
  cherryCrown.translate(0, 3.15, 0);
  const cherryTrunk = new THREE.CylinderGeometry(0.13, 0.2, 2.1, 6);
  cherryTrunk.translate(0, 1.05, 0);

  const ginkgoLower = new THREE.ConeGeometry(1.15, 1.85, 7);
  ginkgoLower.translate(0, 1.95, 0);
  const ginkgoUpper = new THREE.ConeGeometry(1.0, 1.65, 7);
  ginkgoUpper.translate(0, 3.0, 0);
  const ginkgoTrunk = new THREE.CylinderGeometry(0.16, 0.24, 2.25, 6);
  ginkgoTrunk.translate(0, 1.125, 0);

  const definitions = {
    conifer: { canopies: [coniferLower, coniferMiddle, coniferUpper], trunk: coniferTrunk, canopy: null },
    broadleaf: { canopies: [broadleafLeft, broadleafRight, broadleafCrown], trunk: broadleafTrunk, canopy: null },
    scrub: { canopies: [scrubLeft, scrubRight], trunk: scrubTrunk, canopy: null },
    cherry: { canopies: [cherryLeft, cherryRight, cherryCrown], trunk: cherryTrunk, canopy: 0xc98996 },
    ginkgo: { canopies: [ginkgoLower, ginkgoUpper], trunk: ginkgoTrunk, canopy: 0xb79c32 },
  };
  const transform = new THREE.Object3D();
  const tint = new THREE.Color();
  const treeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.97,
    flatShading: false,
  });

  function mergeTreeGeometry(definition) {
    const pieces = [
      { geometry: definition.trunk, color: [0.46, 0.36, 0.25] },
      ...definition.canopies.map((geometry) => ({ geometry, color: [1, 1, 1] })),
    ];
    const prepared = pieces.map((piece) => {
      const clone = piece.geometry.clone();
      const geometry = clone.index ? clone.toNonIndexed() : clone;
      if (geometry !== clone) clone.dispose();
      return { ...piece, geometry };
    });
    const vertexCount = prepared.reduce((sum, piece) => (
      sum + piece.geometry.getAttribute("position").count
    ), 0);
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    let vertexOffset = 0;
    for (const piece of prepared) {
      const position = piece.geometry.getAttribute("position");
      const normal = piece.geometry.getAttribute("normal");
      positions.set(position.array, vertexOffset * 3);
      normals.set(normal.array, vertexOffset * 3);
      for (let vertex = 0; vertex < position.count; vertex += 1) {
        colors.set(piece.color, (vertexOffset + vertex) * 3);
      }
      vertexOffset += position.count;
      piece.geometry.dispose();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }
  for (const definition of Object.values(definitions)) {
    definition.geometry = mergeTreeGeometry(definition);
  }

  function addTreeSet(parent, variant, variantRecords, suffix) {
    if (variantRecords.length === 0) return;
    const definition = definitions[variant];
    const mesh = new THREE.InstancedMesh(definition.geometry, treeMaterial, variantRecords.length);
    mesh.name = `atlas-${variant}-${suffix}-trees`;

    for (const [instance, record] of variantRecords.entries()) {
      const [shapeXZ, shapeY] = REALM_TREE_SHAPE[record.realmIdx];
      const shapeScale = variant === "conifer"
        ? [shapeXZ * 0.82, Math.max(1.05, shapeY)]
        : variant === "scrub"
        ? [shapeXZ * 0.95, Math.min(0.82, shapeY)]
        : [Math.min(1.18, shapeXZ), Math.min(1.12, shapeY)];
      transform.position.set(record.x, record.groundHeight + 0.05, record.z);
      transform.rotation.set(0, record.rotation, 0);
      transform.scale.set(
        record.scale * shapeScale[0],
        record.scale * (0.94 + record.colorFactor * 0.1) * shapeScale[1],
        record.scale * shapeScale[0],
      );
      transform.updateMatrix();
      mesh.setMatrixAt(instance, transform.matrix);
      const colorFactor = variant === "conifer"
        ? Math.max(0.92, record.colorFactor)
        : record.colorFactor;
      tint.set(definition.canopy ?? REALM_CANOPY_COLORS[record.realmIdx])
        .multiplyScalar(colorFactor);
      mesh.setColorAt(instance, tint);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    parent.add(mesh);
  }

  let coreCount = 0;
  let detailCount = 0;
  for (const [variant, variantRecords] of Object.entries(records)) {
    const coreRecords = [];
    const detailRecords = [];
    for (const record of variantRecords) {
      if (coordinateNoise(record.x, record.z, seed + 919) < 0.34) coreRecords.push(record);
      else detailRecords.push(record);
    }
    coreCount += coreRecords.length;
    detailCount += detailRecords.length;
    addTreeSet(core, variant, coreRecords, "core");
    addTreeSet(detail, variant, detailRecords, "detail");
  }

  vegetation.userData.detailGroup = detail;
  vegetation.userData.disposables = [
    treeMaterial,
    ...Object.values(definitions).map((definition) => definition.geometry),
  ];
  vegetation.userData.treeCounts = {
    total: Object.values(records).reduce((sum, entries) => sum + entries.length, 0),
    core: coreCount,
    detail: detailCount,
    conifer: records.conifer.length,
    broadleaf: records.broadleaf.length,
    scrub: records.scrub.length,
    cherry: records.cherry.length,
    ginkgo: records.ginkgo.length,
  };
  return vegetation;
}

function propRecordIncluded(record, seed, salt, quality, floor = 0) {
  const density = Math.max(floor, quality?.propDensity ?? 1);
  return coordinateNoise(record.x, record.z, seed + salt) <= density;
}

export function createRockGroup(THREE, rockData, seed, quality = null) {
  const group = new THREE.Group();
  group.name = "atlas-rocks";
  const variants = [[], [], []];
  for (let offset = 0; offset + 5 < rockData.length; offset += 6) {
    const record = {
      x: rockData[offset], y: rockData[offset + 1], z: rockData[offset + 2],
      scale: rockData[offset + 3], rotation: rockData[offset + 4],
      variant: Math.min(2, Math.max(0, Math.round(rockData[offset + 5]) || 0)),
    };
    if (propRecordIncluded(record, seed, 941, quality, 0.38)) variants[record.variant].push(record);
  }
  const geometries = [
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.DodecahedronGeometry(1, 0),
  ];
  geometries[1].scale(1.35, 0.55, 0.9);
  geometries[2].scale(0.82, 1.35, 0.76);
  const colors = [0x746e63, 0x877967, 0x5b5d59];
  const transform = new THREE.Object3D();
  for (let variant = 0; variant < variants.length; variant += 1) {
    const records = variants[variant];
    if (!records.length) continue;
    const material = new THREE.MeshStandardMaterial({ color: colors[variant], roughness: 0.98, flatShading: true });
    const mesh = new THREE.InstancedMesh(geometries[variant], material, records.length);
    mesh.name = `atlas-rocks-${variant}`;
    for (const [instance, record] of records.entries()) {
      transform.position.set(record.x, record.y + record.scale * 0.32, record.z);
      transform.rotation.set(0, record.rotation, 0);
      transform.scale.set(record.scale, record.scale * 0.74, record.scale * 0.88);
      transform.updateMatrix();
      mesh.setMatrixAt(instance, transform.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  group.userData.count = variants.reduce((sum, records) => sum + records.length, 0);
  return group;
}

function createFieldTexture(THREE) {
  const size = 32;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const furrow = x % 5 <= 1 ? 0.72 : 1;
      const cross = y % 13 === 0 ? 0.88 : 1;
      const value = Math.round(220 * furrow * cross);
      pixels[offset] = value;
      pixels[offset + 1] = value;
      pixels[offset + 2] = value;
      pixels[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  if (THREE.NoColorSpace) texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createFieldGroup(THREE, fieldData, seed, quality = null) {
  const group = new THREE.Group();
  group.name = "atlas-fields";
  const records = [];
  for (let offset = 0; offset + 6 < fieldData.length; offset += 7) {
    const record = {
      x: fieldData[offset], y: fieldData[offset + 1], z: fieldData[offset + 2],
      width: fieldData[offset + 3], depth: fieldData[offset + 4],
      rotation: fieldData[offset + 5], tint: Math.min(2, Math.max(0, Math.round(fieldData[offset + 6]) || 0)),
    };
    if (propRecordIncluded(record, seed, 953, quality, 0.5)) records.push(record);
  }
  if (!records.length) {
    group.userData.count = 0;
    return group;
  }
  const texture = createFieldTexture(THREE);
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: texture,
    roughness: 1,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, records.length);
  mesh.name = "atlas-field-patches";
  const colors = [0x8f813d, 0x66753b, 0x9b6b36];
  const transform = new THREE.Object3D();
  const tint = new THREE.Color();
  for (const [instance, record] of records.entries()) {
    transform.position.set(record.x, record.y, record.z);
    transform.rotation.set(0, record.rotation, 0);
    transform.scale.set(record.width, 1, record.depth);
    transform.updateMatrix();
    mesh.setMatrixAt(instance, transform.matrix);
    mesh.setColorAt(instance, tint.set(colors[record.tint]));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  group.add(mesh);
  group.userData.count = records.length;
  group.userData.disposables = [texture];
  return group;
}

export function createEnvironsGroup(THREE, environData, seed, quality = null) {
  const group = new THREE.Group();
  group.name = "atlas-settlement-environs";
  const records = [];
  for (let offset = 0; offset + 5 < environData.length; offset += 6) {
    const record = {
      x: environData[offset], y: environData[offset + 1], z: environData[offset + 2],
      scale: environData[offset + 3], rotation: environData[offset + 4],
      variant: Math.min(2, Math.max(0, Math.round(environData[offset + 5]) || 0)),
    };
    if (propRecordIncluded(record, seed, 967, quality, 0.48)) records.push(record);
  }
  if (!records.length) {
    group.userData.count = 0;
    return group;
  }
  const wallGeometry = new THREE.BoxGeometry(1.65, 1.2, 1.25);
  wallGeometry.translate(0, 0.6, 0);
  const roofGeometry = new THREE.ConeGeometry(1.18, 0.92, 4);
  roofGeometry.rotateY(Math.PI / 4);
  roofGeometry.translate(0, 1.66, 0);
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.98, flatShading: true });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, flatShading: true });
  const walls = new THREE.InstancedMesh(wallGeometry, wallMaterial, records.length);
  const roofs = new THREE.InstancedMesh(roofGeometry, roofMaterial, records.length);
  walls.name = "atlas-environs-walls";
  roofs.name = "atlas-environs-roofs";
  const wallColors = [0x8b775d, 0x776b56, 0xa08258];
  const roofColors = [0x4c3328, 0x343b31, 0x78422d];
  const transform = new THREE.Object3D();
  const tint = new THREE.Color();
  for (const [instance, record] of records.entries()) {
    const widthScale = record.variant === 1 ? 1.38 : record.variant === 2 ? 0.78 : 1;
    transform.position.set(record.x, record.y + 0.04, record.z);
    transform.rotation.set(0, record.rotation, 0);
    transform.scale.set(record.scale * widthScale, record.scale, record.scale);
    transform.updateMatrix();
    walls.setMatrixAt(instance, transform.matrix);
    roofs.setMatrixAt(instance, transform.matrix);
    walls.setColorAt(instance, tint.set(wallColors[record.variant]));
    roofs.setColorAt(instance, tint.set(roofColors[record.variant]));
  }
  for (const mesh of [walls, roofs]) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
  group.add(walls, roofs);
  group.userData.count = records.length;
  return group;
}

export function createLandmarkMeshGroup(THREE, seed, landmarkFilter = null) {
  const group = new THREE.Group();
  group.name = "atlas-landmarks";

  const matStone     = new THREE.MeshStandardMaterial({ color: 0x887a6c, emissive: 0x887a6c, emissiveIntensity: 0.08, roughness: 0.92, metalness: 0 });
  const matDarkStone = new THREE.MeshStandardMaterial({ color: 0x554a40, emissive: 0x554a40, emissiveIntensity: 0.2, roughness: 0.92, metalness: 0 });
  const matRoof      = new THREE.MeshStandardMaterial({ color: 0x2e2820, emissive: 0x2e2820, emissiveIntensity: 0.28, roughness: 0.86, metalness: 0 });
  const matIvory     = new THREE.MeshStandardMaterial({ color: 0xd0c8b0, roughness: 0.85, metalness: 0 });
  const matDock      = new THREE.MeshStandardMaterial({ color: 0x3a2c18, roughness: 0.95, metalness: 0 });
  const matMarket    = new THREE.MeshStandardMaterial({ color: 0xa89070, roughness: 1, metalness: 0, side: THREE.DoubleSide });
  const matPagodaWood = new THREE.MeshStandardMaterial({ color: 0x2e2010, roughness: 0.9, metalness: 0 });
  const matPagodaGold = new THREE.MeshStandardMaterial({ color: 0x8a7030, roughness: 0.62, metalness: 0.18 });
  const matWindow = new THREE.MeshStandardMaterial({
    color: 0x6d552d,
    emissive: 0xffad48,
    emissiveIntensity: 0,
    roughness: 0.58,
    metalness: 0.04,
  });
  matWindow.userData.atlasNightLight = true;
  const matBeacon = new THREE.MeshStandardMaterial({
    color: 0xd9ad50,
    emissive: 0xffb238,
    emissiveIntensity: 0,
    roughness: 0.46,
    metalness: 0.12,
  });
  matBeacon.userData.atlasNightLight = true;
  const realmMaterials = Object.fromEntries(Object.entries(REALM_SETTLEMENT_COLORS).map(([realmId, colors]) => [
    realmId,
    {
      stone: realmId === "central" ? matStone : new THREE.MeshStandardMaterial({ color: colors.stone, emissive: colors.stone, emissiveIntensity: 0.08, roughness: 0.92, metalness: 0 }),
      darkStone: realmId === "central" ? matDarkStone : new THREE.MeshStandardMaterial({ color: colors.darkStone, emissive: colors.darkStone, emissiveIntensity: 0.2, roughness: 0.92, metalness: 0 }),
      roof: realmId === "central" ? matRoof : new THREE.MeshStandardMaterial({ color: colors.roof, emissive: colors.roof, emissiveIntensity: 0.28, roughness: 0.86, metalness: 0 }),
    },
  ]));

  function piece(geo, mat, x, y, z, ry = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    return m;
  }

  function addWindow(group, s, x, y, z, ry = 0) {
    group.add(piece(new THREE.BoxGeometry(s * 0.34, s * 0.48, s * 0.1), matWindow, x, y, z, ry));
  }

  function buildCity(s, towerHeightScale = 1) {
    const g = new THREE.Group();
    g.add(piece(new THREE.CylinderGeometry(s * 5, s * 5.5, s * 0.7, 8), matStone, 0, s * 0.35, 0));
    g.add(piece(new THREE.BoxGeometry(s * 2.4, s * 7, s * 2.4), matDarkStone, 0, s * 4.3, 0));
    const offsets = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const [tx, tz] of offsets) {
      const towerHeight = s * 8.2 * towerHeightScale;
      g.add(piece(new THREE.CylinderGeometry(s * 0.72, s * 0.82, towerHeight, 7), matStone, tx * s * 2.8, towerHeight / 2, tz * s * 2.8));
      g.add(piece(new THREE.ConeGeometry(s * 0.94, s * 2.4, 7), matRoof, tx * s * 2.8, towerHeight + s * 1.2, tz * s * 2.8));
    }
    for (const [wx, wz, ry] of [[0, -2.8, 0], [0, 2.8, 0], [-2.8, 0, Math.PI / 2], [2.8, 0, Math.PI / 2]]) {
      g.add(piece(new THREE.BoxGeometry(s * 4.0, s * 2.0, s * 0.48), matDarkStone, wx * s, s * 2.4, wz * s, ry));
    }
    for (const floor of [2.1, 3.5, 4.9, 6.1]) addWindow(g, s, 0, floor * s, -s * 1.23);
    for (const tx of [-1, 1]) addWindow(g, s, tx * s * 2.8, s * 4.2, -s * 3.63);
    return g;
  }

  function buildTown(s) {
    const g = new THREE.Group();
    g.add(piece(new THREE.BoxGeometry(s * 2, s * 4, s * 2), matStone, 0, s * 2, 0));
    const market = piece(new THREE.PlaneGeometry(s * 3.8, s * 3.2), matMarket, 0, s * 0.04, s * 2.15);
    market.rotation.x = -Math.PI / 2;
    g.add(market);
    for (const tx of [-1, 1]) {
      const towerHeight = s * 5.2 * 1.4;
      g.add(piece(new THREE.CylinderGeometry(s * 0.58, s * 0.68, towerHeight, 6), matDarkStone, tx * s * 2, towerHeight / 2, 0));
      g.add(piece(new THREE.ConeGeometry(s * 0.78, s * 2, 6), matRoof, tx * s * 2, towerHeight + s, 0));
    }
    addWindow(g, s, 0, s * 2.35, -s * 1.03);
    for (const tx of [-1, 1]) addWindow(g, s, tx * s * 2, s * 3.35, -s * 0.7);
    return g;
  }

  function buildFortress(s) {
    const g = new THREE.Group();
    g.add(piece(new THREE.BoxGeometry(s * 2, s * 6, s * 1.8), matDarkStone, 0, s * 3, 0));
    for (const tx of [-1, 1]) {
      g.add(piece(new THREE.CylinderGeometry(s * 0.62, s * 0.72, s * 7, 6), matStone, tx * s * 2.2, s * 3.5, 0));
      g.add(piece(new THREE.ConeGeometry(s * 0.82, s * 1.8, 6), matRoof, tx * s * 2.2, s * 7.8, 0));
    }
    g.add(piece(new THREE.BoxGeometry(s * 5, s * 0.55, s * 0.9), matDarkStone, 0, s * 6.2, 0));
    addWindow(g, s, 0, s * 3.4, -s * 0.93);
    for (const tx of [-1, 1]) addWindow(g, s, tx * s * 2.2, s * 4.1, -s * 0.73);
    return g;
  }

  function buildPort(s) {
    const g = new THREE.Group();
    g.add(piece(new THREE.CylinderGeometry(s * 0.52, s * 0.72, s * 6.2, 8), matStone, 0, s * 3.1, 0));
    g.add(piece(new THREE.ConeGeometry(s * 0.78, s * 1.5, 8), matRoof, 0, s * 7.35, 0));
    g.add(piece(new THREE.SphereGeometry(s * 0.42, 6, 4), matBeacon, 0, s * 6.4, 0));
    g.add(piece(new THREE.BoxGeometry(s * 3.5, s * 0.32, s * 1.1), matDock, s * 1.5, s * 0.16, 0));
    return g;
  }

  function buildShrine(s) {
    const g = new THREE.Group();
    g.add(piece(new THREE.CylinderGeometry(s * 2.4, s * 2.4, s * 0.45, 8), matIvory, 0, s * 0.22, 0));
    const dome = new THREE.SphereGeometry(s * 1.75, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    g.add(piece(dome, matIvory, 0, s * 0.45, 0));
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      g.add(piece(new THREE.CylinderGeometry(s * 0.15, s * 0.17, s * 1.5, 6), matIvory, px * s * 1.6, s * 0.75, pz * s * 1.6));
    }
    return g;
  }

  function buildVillage(s) {
    const g = new THREE.Group();
    g.add(piece(new THREE.BoxGeometry(s * 1.8, s * 2, s * 1.55), matStone, 0, s, -s * 0.35));
    for (const roofSide of [-1, 1]) {
      const roof = piece(
        new THREE.BoxGeometry(s * 1.28, s * 0.16, s * 1.8),
        matRoof,
        roofSide * s * 0.43,
        s * 2.24,
        -s * 0.35,
      );
      roof.rotation.z = roofSide * Math.PI / 4;
      g.add(roof);
    }
    for (const [bx, bz] of [[-1.55, 0.75], [1.55, 0.55]]) {
      g.add(piece(new THREE.BoxGeometry(s * 1.15, s * 1.35, s * 1.1), matStone, bx * s, s * 0.675, bz * s));
      g.add(piece(new THREE.ConeGeometry(s * 0.88, s * 0.8, 4), matRoof, bx * s, s * 1.75, bz * s, Math.PI / 4));
      g.add(piece(new THREE.CylinderGeometry(s * 0.08, s * 0.08, s * 0.4, 5), matDarkStone, (bx + 0.25) * s, s * 2.05, bz * s));
    }
    g.add(piece(new THREE.CylinderGeometry(s * 2.95, s * 2.95, s * 0.34, 18, 1, true), matDarkStone, 0, s * 0.17, 0));
    addWindow(g, s, 0, s * 1.1, -s * 1.135);
    addWindow(g, s, -s * 1.55, s * 0.78, s * 0.19);
    addWindow(g, s, s * 1.55, s * 0.78, -s * 0.01);
    return g;
  }

  function buildPagoda(s) {
    const g = new THREE.Group();
    g.add(piece(new THREE.BoxGeometry(s * 5.4, s * 0.55, s * 4.8), matStone, 0, s * 0.275, 0));
    let storyBase = s * 0.55;
    for (let story = 0; story < 3; story += 1) {
      const width = s * (3.8 - story * 0.72);
      const depth = s * (3.2 - story * 0.58);
      const wallHeight = s * (1.05 - story * 0.08);
      g.add(piece(new THREE.BoxGeometry(width, wallHeight, depth), matPagodaWood, 0, storyBase + wallHeight / 2, 0));
      const eaveY = storyBase + wallHeight + s * 0.12;
      const eaveRadius = s * (2.75 - story * 0.5);
      g.add(piece(new THREE.CylinderGeometry(eaveRadius, eaveRadius * 1.08, s * 0.24, 4), matRoof, 0, eaveY, 0, Math.PI / 4));
      for (const [tipX, tipZ] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        g.add(piece(
          new THREE.SphereGeometry(s * 0.11, 5, 3),
          matPagodaGold,
          tipX * eaveRadius * 0.73,
          eaveY + s * 0.16,
          tipZ * eaveRadius * 0.73,
        ));
      }
      g.add(piece(new THREE.SphereGeometry(s * 0.13, 5, 3), matWindow, width * 0.34, eaveY - s * 0.34, -depth * 0.51));
      storyBase = eaveY + s * 0.24;
    }
    g.add(piece(new THREE.CylinderGeometry(s * 0.08, s * 0.11, s * 0.9, 6), matPagodaGold, 0, storyBase + s * 0.45, 0));
    g.add(piece(new THREE.SphereGeometry(s * 0.18, 6, 4), matPagodaGold, 0, storyBase + s * 0.95, 0));
    return g;
  }

  function buildTower(s) {
    const g = new THREE.Group();
    g.add(piece(new THREE.CylinderGeometry(s * 0.58, s * 0.72, s * 5.5, 7), matDarkStone, 0, s * 2.75, 0));
    g.add(piece(new THREE.ConeGeometry(s * 0.82, s * 1.6, 7), matRoof, 0, s * 6.35, 0));
    return g;
  }

  function buildRuin(s) {
    const g = new THREE.Group();
    g.add(piece(new THREE.CylinderGeometry(s * 0.38, s * 0.44, s * 2.4, 6), matDarkStone, -s, s * 1.2, 0));
    g.add(piece(new THREE.CylinderGeometry(s * 0.33, s * 0.38, s * 1.4, 6), matDarkStone, s * 0.5, s * 0.7, s * 0.3));
    return g;
  }

  function applyRealmSettlementMaterials(meshGroup, landmark) {
    if (!SETTLEMENT_LANDMARK_KINDS.has(landmark.kind)) return;
    const palette = realmMaterials[landmark.realmId] || realmMaterials.central;
    const replacements = new Map([
      [matStone, palette.stone],
      [matDarkStone, palette.darkStone],
      [matRoof, palette.roof],
    ]);
    meshGroup.traverse((child) => {
      if (child.isMesh && replacements.has(child.material)) {
        child.material = replacements.get(child.material);
      }
    });
  }

  for (const landmark of ATLAS_LANDMARKS) {
    if (landmarkFilter && !landmarkFilter(landmark)) continue;
    const { coord, kind, capitalOfRealmId } = landmark;
    const baseScale = capitalOfRealmId ? 1.45 : 1.0;
    let meshGroup;
    switch (kind) {
      case "city":       meshGroup = buildCity(baseScale); break;
      case "town":       meshGroup = buildTown(baseScale * 0.8); break;
      case "settlement": meshGroup = buildTown(baseScale * 0.65); break;
      case "fortress":
      case "castle":     meshGroup = buildFortress(baseScale * 0.85); break;
      case "fort":
      case "checkpoint": meshGroup = buildFortress(baseScale * 0.6); break;
      case "port":       meshGroup = buildPort(baseScale * 0.78); break;
      case "shrine":
      case "temple":
      case "sanctuary":
      case "monastery":
                          meshGroup = buildShrine(baseScale * 0.65); break;
      case "pagoda":     meshGroup = buildPagoda(baseScale); break;
      case "wonder":     meshGroup = buildCity(baseScale * 1.08, 1.25); break;
      case "village":    meshGroup = buildVillage(1.25); break;
      case "tower":      meshGroup = buildTower(0.65); break;
      case "ruin":       meshGroup = buildRuin(0.52); break;
      default:           continue;
    }
    applyRealmSettlementMaterials(meshGroup, landmark);
    const scenePos = atlas3dAxialToScene(coord);
    const groundHeight = atlas3dTerrainHeightAt(coord, seed);
    const scaleJitter = 0.85 + coordinateNoise(coord.x, coord.y, landmark.id) * 0.3;
    // These are legible miniatures inside a landscape, not building-scale
    // geometry. Keeping the capital below one world-unit scale lets a full
    // road-and-field neighborhood remain visible around it at the opening
    // camera instead of clipping the towers against the viewport.
    const miniatureScale = 0.92;
    meshGroup.scale.setScalar(scaleJitter * miniatureScale);
    meshGroup.name = `atlas-landmark-${landmark.id}`;
    meshGroup.userData.landmarkKind = kind;
    meshGroup.userData.miniatureScale = miniatureScale;
    meshGroup.position.set(scenePos.x, groundHeight, scenePos.z);
    group.add(meshGroup);
  }

  return group;
}

export function batchLandmarkMeshGroup(THREE, sourceGroup) {
  sourceGroup.updateMatrixWorld(true);
  const batches = new Map();
  let sourceMeshCount = 0;

  sourceGroup.traverse((child) => {
    if (!child.isMesh || !child.geometry || !child.material || Array.isArray(child.material)) return;
    sourceMeshCount += 1;
    const transformed = child.geometry.clone();
    transformed.applyMatrix4(child.matrixWorld);
    const geometry = transformed.index ? transformed.toNonIndexed() : transformed;
    if (geometry !== transformed) transformed.dispose();
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    if (!position || !normal) {
      geometry.dispose();
      return;
    }
    if (!batches.has(child.material)) batches.set(child.material, []);
    batches.get(child.material).push({ geometry, position, normal });
  });

  const batched = new THREE.Group();
  batched.name = sourceGroup.name;
  for (const [material, entries] of batches) {
    const vertexCount = entries.reduce((total, entry) => total + entry.position.count, 0);
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    let offset = 0;
    for (const entry of entries) {
      positions.set(entry.position.array, offset * 3);
      normals.set(entry.normal.array, offset * 3);
      offset += entry.position.count;
      entry.geometry.dispose();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `atlas-landmark-batch-${batched.children.length + 1}`;
    batched.add(mesh);
  }

  sourceGroup.traverse((child) => child.geometry?.dispose?.());
  batched.userData.sourceMeshCount = sourceMeshCount;
  batched.userData.batchCount = batched.children.length;
  return batched;
}

function createProceduralSurfaceTexture(THREE, seed, size = 256) {
  const surface = document.createElement("canvas");
  surface.width = size;
  surface.height = size;
  const context = surface.getContext("2d");
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const fineR = coordinateNoise(x, y, `${seed}:surface:fine:r`);
      const fineG = coordinateNoise(x, y, `${seed}:surface:fine:g`);
      const fineB = coordinateNoise(x, y, `${seed}:surface:fine:b`);
      const broad = coordinateNoise(Math.floor(x / 5), Math.floor(y / 5), `${seed}:surface:broad`);
      const offset = (y * size + x) * 4;
      image.data[offset] = Math.round(72 + fineR * 104 + broad * 58);
      image.data[offset + 1] = Math.round(72 + fineG * 104 + broad * 58);
      image.data[offset + 2] = Math.round(72 + fineB * 104 + broad * 58);
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(surface);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  if (THREE.NoColorSpace) texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function createAtlasTerrainGeometry(THREE, data) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(data.colors, 3));
  const vertexCount = data.positions.length / 3;
  const uvs = new Float32Array(vertexCount * 2);
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const x = data.positions[vertex * 3];
    const z = data.positions[vertex * 3 + 2];
    uvs[vertex * 2] = (x - ATLAS_3D_BOUNDS.xmin) / (ATLAS_3D_BOUNDS.xmax - ATLAS_3D_BOUNDS.xmin);
    uvs[vertex * 2 + 1] = (z - ATLAS_3D_BOUNDS.zmin) / (ATLAS_3D_BOUNDS.zmax - ATLAS_3D_BOUNDS.zmin);
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute("atlasAo", new THREE.BufferAttribute(data.ao, 1, true));
  geometry.setAttribute("shore", new THREE.BufferAttribute(data.shore, 1, true));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function mergeAtlasPropGeometry(THREE, pieces) {
  const prepared = pieces.map(({ geometry, color }) => {
    const clone = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    const position = clone.getAttribute("position");
    const normal = clone.getAttribute("normal");
    return { clone, position, normal, color: new THREE.Color(color) };
  });
  const count = prepared.reduce((sum, piece) => sum + piece.position.count, 0);
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  let cursor = 0;
  for (const piece of prepared) {
    positions.set(piece.position.array, cursor * 3);
    normals.set(piece.normal.array, cursor * 3);
    for (let vertex = 0; vertex < piece.position.count; vertex += 1) {
      piece.color.toArray(colors, (cursor + vertex) * 3);
    }
    cursor += piece.position.count;
    piece.clone.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildAtlasPropTemplates(THREE) {
  const trunk = () => {
    const geometry = new THREE.CylinderGeometry(0.18, 0.29, 2.15, 5);
    geometry.translate(0, 1.075, 0);
    return geometry;
  };
  const coniferLower = new THREE.ConeGeometry(1.45, 2.8, 6);
  coniferLower.translate(0, 2.15, 0);
  const coniferUpper = new THREE.ConeGeometry(1.05, 2.55, 6);
  coniferUpper.translate(0, 3.65, 0);
  const broadleaf = new THREE.DodecahedronGeometry(1.45, 0);
  broadleaf.scale(1.12, 0.88, 1.02);
  broadleaf.translate(0, 3.05, 0);
  const scrub = new THREE.DodecahedronGeometry(1.18, 0);
  scrub.scale(1.25, 0.55, 0.96);
  scrub.translate(0, 1.55, 0);

  const rock0 = new THREE.DodecahedronGeometry(1, 0);
  rock0.scale(1, 0.72, 0.88);
  rock0.translate(0, 0.48, 0);
  const rock1 = new THREE.IcosahedronGeometry(1, 0);
  rock1.scale(1.35, 0.55, 0.9);
  rock1.translate(0, 0.42, 0);
  const rock2 = new THREE.DodecahedronGeometry(1, 0);
  rock2.scale(0.82, 1.35, 0.76);
  rock2.translate(0, 0.72, 0);

  const field = new THREE.PlaneGeometry(1, 1);
  field.rotateX(-Math.PI / 2);
  const wall = new THREE.BoxGeometry(1.65, 1.2, 1.25);
  wall.translate(0, 0.6, 0);
  const roof = new THREE.ConeGeometry(1.18, 0.92, 4);
  roof.rotateY(Math.PI / 4);
  roof.translate(0, 1.66, 0);
  const ruinWall = new THREE.BoxGeometry(1.8, 1.55, 0.42);
  ruinWall.translate(0, 0.78, 0);
  const ruinSide = new THREE.BoxGeometry(0.42, 1.05, 1.55);
  ruinSide.translate(-0.7, 0.52, 0.36);
  const monolith = new THREE.BoxGeometry(0.42, 2.15, 0.58);
  monolith.translate(0, 1.075, 0);
  const watchBase = new THREE.CylinderGeometry(0.74, 0.94, 2.55, 6);
  watchBase.translate(0, 1.275, 0);
  const watchRoof = new THREE.ConeGeometry(1.15, 1.12, 6);
  watchRoof.translate(0, 3.1, 0);
  const tent = new THREE.ConeGeometry(1.3, 1.45, 4);
  tent.rotateY(Math.PI / 4);
  tent.translate(0, 0.72, 0);
  const bridgeDeck = new THREE.BoxGeometry(3.8, 0.28, 1.25);
  bridgeDeck.translate(0, 0.3, 0);
  const bridgeRailA = new THREE.BoxGeometry(3.8, 0.25, 0.12);
  bridgeRailA.translate(0, 0.68, -0.58);
  const bridgeRailB = bridgeRailA.clone();
  bridgeRailB.translate(0, 0, 1.16);

  const treePieces = (canopy, canopyColor = 0xffffff) => mergeAtlasPropGeometry(THREE, [
    { geometry: trunk(), color: 0x55412b },
    { geometry: canopy, color: canopyColor },
  ]);
  const templates = {
    conifer: mergeAtlasPropGeometry(THREE, [
      { geometry: trunk(), color: 0x55412b },
      { geometry: coniferLower, color: 0xffffff },
      { geometry: coniferUpper, color: 0xffffff },
    ]),
    broadleaf: treePieces(broadleaf),
    scrub: treePieces(scrub),
    cherry: treePieces(broadleaf.clone(), 0xf0c2cc),
    ginkgo: treePieces(coniferLower.clone(), 0xe4c84b),
    rock0: mergeAtlasPropGeometry(THREE, [{ geometry: rock0, color: 0xffffff }]),
    rock1: mergeAtlasPropGeometry(THREE, [{ geometry: rock1, color: 0xffffff }]),
    rock2: mergeAtlasPropGeometry(THREE, [{ geometry: rock2, color: 0xffffff }]),
    field: mergeAtlasPropGeometry(THREE, [{ geometry: field, color: 0xffffff }]),
    house: mergeAtlasPropGeometry(THREE, [
      { geometry: wall, color: 0xa08b68 },
      { geometry: roof, color: 0x4c3328 },
    ]),
    ruin: mergeAtlasPropGeometry(THREE, [
      { geometry: ruinWall, color: 0x777064 },
      { geometry: ruinSide, color: 0x5f5a52 },
    ]),
    stones: mergeAtlasPropGeometry(THREE, [
      { geometry: monolith, color: 0x77756c },
    ]),
    tower: mergeAtlasPropGeometry(THREE, [
      { geometry: watchBase, color: 0x756b5e },
      { geometry: watchRoof, color: 0x352d26 },
    ]),
    camp: mergeAtlasPropGeometry(THREE, [{ geometry: tent, color: 0x8c6743 }]),
    bridge: mergeAtlasPropGeometry(THREE, [
      { geometry: bridgeDeck, color: 0x765438 },
      { geometry: bridgeRailA, color: 0x4d3625 },
      { geometry: bridgeRailB, color: 0x4d3625 },
    ]),
  };
  for (const geometry of [
    coniferLower, coniferUpper, broadleaf, scrub, rock0, rock1, rock2, field,
    wall, roof, ruinWall, ruinSide, monolith, watchBase, watchRoof, tent,
    bridgeDeck, bridgeRailA, bridgeRailB,
  ]) geometry.dispose();
  return templates;
}

export function createAtlasChunkPropBatch(THREE, data, seed, quality) {
  const group = new THREE.Group();
  group.name = `atlas-chunk-props-${data.cx}-${data.cy}-${data.lod}`;
  if (data.empty || !THREE.BatchedMesh) return group;
  const cap = Math.max(12, quality?.chunkPropCap || 180);
  const density = quality?.propDensity ?? 1;
  const buckets = { trees: [], rocks: [], fields: [], environs: [] };
  const include = (x, z, salt, floor = 0) => coordinateNoise(x, z, `${seed}:${salt}`) <= Math.max(floor, density);
  const treeVariants = ["conifer", "broadleaf", "scrub", "cherry", "ginkgo"];
  const canopyColors = [0x355d36, 0x4a7a50, 0x657542, 0xffffff, 0xffffff];
  for (let offset = 0; offset + ATLAS_3D_TREE_RECORD_STRIDE - 1 < data.trees.length; offset += ATLAS_3D_TREE_RECORD_STRIDE) {
    const x = data.trees[offset];
    const z = data.trees[offset + 2];
    if (!include(x, z, "tree")) continue;
    const species = Math.max(0, Math.min(4, Math.round(data.trees[offset + 7]) || 0));
    const realm = Math.max(0, Math.min(4, Math.round(data.trees[offset + 6]) || 0));
    const scale = data.trees[offset + 3];
    const shape = REALM_TREE_SHAPE[realm];
    buckets.trees.push({
      template: treeVariants[species], x, y: data.trees[offset + 1] + 0.04, z,
      rotation: data.trees[offset + 4],
      scale: [scale * shape[0], scale * shape[1], scale * shape[0]],
      color: species >= ATLAS_3D_TREE_SPECIES.cherry
        ? 0xffffff
        : new THREE.Color(canopyColors[species]).multiplyScalar(data.trees[offset + 5]),
    });
  }
  for (let offset = 0; offset + ATLAS_3D_ROCK_RECORD_STRIDE - 1 < data.rocks.length; offset += ATLAS_3D_ROCK_RECORD_STRIDE) {
    const x = data.rocks[offset];
    const z = data.rocks[offset + 2];
    if (!include(x, z, "rock", 0.38)) continue;
    const variant = Math.max(0, Math.min(2, Math.round(data.rocks[offset + 5]) || 0));
    const scale = data.rocks[offset + 3];
    buckets.rocks.push({
      template: `rock${variant}`, x, y: data.rocks[offset + 1], z,
      rotation: data.rocks[offset + 4], scale: [scale, scale, scale],
      color: [0x746e63, 0x877967, 0x5b5d59][variant],
    });
  }
  for (let offset = 0; offset + ATLAS_3D_FIELD_RECORD_STRIDE - 1 < data.fields.length; offset += ATLAS_3D_FIELD_RECORD_STRIDE) {
    const x = data.fields[offset];
    const z = data.fields[offset + 2];
    if (!include(x, z, "field", 0.5)) continue;
    const tint = Math.max(0, Math.min(2, Math.round(data.fields[offset + 6]) || 0));
    buckets.fields.push({
      template: "field", x, y: data.fields[offset + 1] + 0.02, z,
      rotation: data.fields[offset + 5], scale: [data.fields[offset + 3], 1, data.fields[offset + 4]],
      color: [0x8f813d, 0x66753b, 0x9b6b36][tint],
    });
  }
  for (let offset = 0; offset + ATLAS_3D_ENVIRON_RECORD_STRIDE - 1 < data.environs.length; offset += ATLAS_3D_ENVIRON_RECORD_STRIDE) {
    const x = data.environs[offset];
    const z = data.environs[offset + 2];
    if (!include(x, z, "environs", 0.48)) continue;
    const variant = Math.max(0, Math.min(2, Math.round(data.environs[offset + 5]) || 0));
    const scale = data.environs[offset + 3];
    buckets.environs.push({
      template: "house", x, y: data.environs[offset + 1] + 0.04, z,
      rotation: data.environs[offset + 4],
      scale: [scale * [1, 1.38, 0.78][variant], scale, scale],
      color: 0xffffff,
    });
  }

  const dressing = setDressingForChunk(seed, data.cx, data.cy, {
    scatterCap: quality?.id === "low" ? 3 : quality?.id === "medium" ? 5 : 8,
  }).map((entry) => {
    const coord = { x: entry.x, y: entry.y };
    const position = atlas3dAxialToScene(coord);
    const template = entry.kind === "bridge" ? "bridge"
      : entry.kind === "ruin" ? "ruin"
      : entry.kind === "standing-stones" ? "stones"
      : entry.kind === "watchtower" ? "tower"
      : entry.kind === "camp" || entry.kind === "wild-camp" ? "camp"
      : "house";
    const scale = entry.scale * (template === "bridge" ? 1.2 : 1);
    return {
      template,
      x: position.x,
      y: atlas3dTerrainHeightAt(coord, seed) + (template === "bridge" ? 0.25 : 0.04),
      z: position.z,
      rotation: -entry.rotation,
      scale: [scale, scale, scale],
      color: 0xffffff,
    };
  });

  const selected = dressing.slice(0, cap);
  const cadence = ["trees", "trees", "trees", "rocks", "trees", "fields", "trees", "environs"];
  const cursors = { trees: 0, rocks: 0, fields: 0, environs: 0 };
  let idlePasses = 0;
  while (selected.length < cap && idlePasses < cadence.length) {
    const key = cadence[(selected.length - dressing.length + idlePasses) % cadence.length];
    const record = buckets[key][cursors[key]++];
    if (record) {
      selected.push(record);
      idlePasses = 0;
    } else {
      idlePasses += 1;
    }
  }
  if (!selected.length) return group;

  const templates = buildAtlasPropTemplates(THREE);
  const templateEntries = Object.entries(templates);
  const maxVertices = templateEntries.reduce((sum, [, geometry]) => sum + geometry.getAttribute("position").count, 0);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const batch = new THREE.BatchedMesh(selected.length, maxVertices, maxVertices * 3, material);
  batch.name = "atlas-chunk-prop-batch";
  batch.perObjectFrustumCulled = true;
  batch.sortObjects = false;
  const geometryIds = Object.fromEntries(templateEntries.map(([key, geometry]) => [key, batch.addGeometry(geometry)]));
  for (const geometry of Object.values(templates)) geometry.dispose();
  const transform = new THREE.Object3D();
  const tint = new THREE.Color();
  for (const record of selected) {
    const instance = batch.addInstance(geometryIds[record.template]);
    transform.position.set(record.x, record.y, record.z);
    transform.rotation.set(0, record.rotation, 0);
    transform.scale.set(...record.scale);
    transform.updateMatrix();
    batch.setMatrixAt(instance, transform.matrix);
    batch.setColorAt(instance, record.color?.isColor ? record.color : tint.set(record.color));
  }
  batch.computeBoundingBox();
  batch.computeBoundingSphere();
  group.add(batch);
  group.userData.count = selected.length;
  group.userData.dressingCount = dressing.length;
  group.userData.batched = true;
  return group;
}

export function atlas3dStreamingRect(camera, viewport, seed = CONTINENT.seed) {
  const samples = [
    [0, 0], [viewport.width / 2, 0], [viewport.width, 0],
    [0, viewport.height / 2], [viewport.width / 2, viewport.height / 2],
    [viewport.width, viewport.height / 2],
    [0, viewport.height], [viewport.width / 2, viewport.height], [viewport.width, viewport.height],
  ].map(([x, y]) => atlas3dScreenToGround(camera, viewport, { x, y }, seed));
  return {
    xmin: Math.min(...samples.map((sample) => sample.x)),
    xmax: Math.max(...samples.map((sample) => sample.x)),
    ymin: Math.min(...samples.map((sample) => sample.y)),
    ymax: Math.max(...samples.map((sample) => sample.y)),
  };
}

export function atlas3dStreamFailureDisposition(error, {
  ready = false,
  pendingCount = 0,
  uploadCount = 0,
} = {}) {
  if (error?.name === "AbortError") return "ignore";
  if (ready) return "fatal";
  if (pendingCount === 0 && uploadCount === 0) return "startup";
  return "wait";
}

function createController(
  THREE,
  canvas,
  seed,
  quality = null,
  chunkClient = null,
  onStreamError = null,
) {
  const context = canvas.getContext("webgl2", {
    alpha: false,
    antialias: true,
    depth: true,
    powerPreference: "high-performance",
  });
  if (!context) throw new Error("WebGL2 is unavailable");

  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  const initialPixelRatio = atlasRenderPixelRatio(
    Math.max(1, canvas.clientWidth || window.innerWidth || 1),
    Math.max(1, canvas.clientHeight || window.innerHeight || 1),
    quality,
  );
  renderer.setPixelRatio(initialPixelRatio);
  canvas.dataset.atlasQuality = quality?.id || "default";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e2836);
  scene.fog = new THREE.FogExp2(0x1a3c4a, 0.00016);
  const camera = new THREE.PerspectiveCamera(ATLAS_3D_FOV_DEG, 1, 0.1, 6000);
  const queryCamera = new THREE.PerspectiveCamera(ATLAS_3D_FOV_DEG, 1, 0.1, 6000);
  const raycaster = new THREE.Raycaster();

  const hemisphere = new THREE.HemisphereLight(0xd0e4e0, 0x201808, 1.05);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xffe8b0, 1.85);
  sun.position.set(-360, 580, 300);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x7ab8d4, 0.26);
  fill.position.set(300, 220, -480);
  scene.add(fill);
  const valleyBounce = new THREE.DirectionalLight(0x102828, 0.09);
  valleyBounce.position.set(0, -1, 0);
  scene.add(valleyBounce);

  // Shadow-mapped sun (quality-gated). The ortho frustum is refitted to the
  // visible ground footprint on every camera/atmosphere change, so the map
  // budget is spent only where the player is actually looking.
  const shadowMapSize = quality?.shadowMapSize || 0;
  if (shadowMapSize > 0) {
    renderer.shadowMap.enabled = true;
    // PCFSoftShadowMap is deprecated in current Three releases. The standard
    // PCF kernel is stable across WebGL2 implementations and our tightly fit
    // frustum keeps its 1K/2K result crisp enough for the miniature props.
    renderer.shadowMap.type = THREE.PCFShadowMap;
    sun.castShadow = true;
    sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    sun.shadow.bias = -0.00028;
    sun.shadow.normalBias = 0.32;
    sun.shadow.autoUpdate = false;
    sun.shadow.needsUpdate = true;
    scene.add(sun.target);
  }
  canvas.dataset.atlasShadowMap = String(shadowMapSize);

  const postStack = createAtlasPostStack(THREE, renderer, scene, camera, quality?.postFx || "off");
  canvas.dataset.atlasPostFx = postStack?.mode || "off";
  renderer.info.autoReset = false;

  const terrainDetailTexture = createProceduralSurfaceTexture(THREE, `${seed}:terrain`);
  terrainDetailTexture.repeat.set(72, 52);
  const waterDetailTexture = createProceduralSurfaceTexture(THREE, `${seed}:water`, 96);
  waterDetailTexture.repeat.set(220, 220);

  const waterGeometry = new THREE.PlaneGeometry(WATER_PLANE_SIZE, WATER_PLANE_SIZE);
  waterGeometry.rotateX(-Math.PI / 2);
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a5060,
    roughness: 0.2,
    metalness: 0.12,
    bumpMap: waterDetailTexture,
    bumpScale: 0.32,
    side: THREE.DoubleSide,
  });
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.position.set(
    (ATLAS_3D_BOUNDS.xmin + ATLAS_3D_BOUNDS.xmax) / 2,
    -1.55,
    (ATLAS_3D_BOUNDS.zmin + ATLAS_3D_BOUNDS.zmax) / 2,
  );
  water.name = "atlas-sea";
  water.receiveShadow = renderer.shadowMap.enabled;
  scene.add(water);

  if (!chunkClient) throw new Error("The 3D atlas chunk stream is unavailable.");
  chunkClient.setCacheLimit?.(quality?.chunkCacheSize ?? 64);
  const chunkRoot = new THREE.Group();
  chunkRoot.name = "atlas-terrain-chunks";
  const terrainMeshes = new Set();
  const presentedChunks = new Map();
  const chunkStore = createAtlasChunkStore({
    lod0Radius: quality?.lod0Radius ?? 1,
    chunkCacheSize: quality?.chunkCacheSize ?? 64,
  });
  const pendingRequests = new Map();
  let uploadFrame = 0;
  let controllerDisposed = false;
  let terminalStreamFailure = false;
  let controllerActive = false;
  let streamCorridor = null;
  let lastStreamFocus = null;
  let overlayReseatTimer = 0;
  let currentFocusedRealmId = null;
  let currentJourneyData = null;
  let currentJourneyBreaks = [];
  let currentSeenKeys = [];
  let resolveFirstChunk;
  let rejectFirstChunk;
  let firstChunkSettled = false;
  const firstChunkReady = new Promise((resolve, reject) => {
    resolveFirstChunk = resolve;
    rejectFirstChunk = reject;
  });
  let mountainClouds = null;
  let hotSprings = null;
  let whitewendCityRiver = null;
  let routes = new THREE.Group();
  routes.name = "atlas-routes";
  let journey = new THREE.Group();
  let seenTrail = new THREE.Group();
  let renderWidth = 0;
  let renderHeight = 0;
  let renderPixelRatio = initialPixelRatio;
  let currentWorldTime = { day: 1, hour: 12, minute: 0 };
  let waterBaseOffsetX = 0;
  let waterBaseOffsetY = 0;
  const terrainMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.02,
    bumpMap: terrainDetailTexture,
    bumpScale: 0.38,
  });
  const terrainUniforms = enhanceAtlasTerrainMaterial(
    THREE,
    terrainMaterial,
    terrainDetailTexture,
    quality,
  );
  setAtlasTerrainWorldTime(terrainUniforms, currentWorldTime);
  let lastModelCamera = null;
  let lastViewport = null;
  let lastRenderAt = 0;
  let ambientFrame = 0;
  let ambientLastTick = 0;
  let ambientEnabled = false;
  let ambientListenersAttached = false;
  const reducedMotionQuery = typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
  const sunShadowDirection = new THREE.Vector3(0.4, 0.8, 0.45);
  let lastShadowCamera = null;
  let lastShadowPhase = "";
  let shadowRefits = 0;
  scene.add(chunkRoot, routes, journey, seenTrail);

  mountainClouds = createMountainClouds(THREE, seed);
  hotSprings = createHotSprings(THREE, seed);
  whitewendCityRiver = createWhitewendCityRiver(THREE, seed);
  scene.add(mountainClouds, hotSprings);
  if (whitewendCityRiver) scene.add(whitewendCityRiver);
  canvas.dataset.atlasMountainClouds = String(mountainClouds.children.length);
  canvas.dataset.atlasHotSprings = String(CONTINENT_HOT_SPRINGS.length);
  canvas.dataset.atlasWhitewendCityRiver = whitewendCityRiver ? "1" : "0";
  canvas.dataset.atlasLakes = String(CONTINENT_LAKES.length);
  canvas.dataset.atlasLandmarkSourceMeshes = "0";
  canvas.dataset.atlasLandmarkBatches = "0";
  canvas.dataset.atlasTerrainMode = "chunked";
  canvas.dataset.atlasPropBatching = THREE.BatchedMesh ? "batched-mesh" : "procedural-fallback";

  const atmosphereColors = {
    daySky: new THREE.Color(0x0e2836),
    nightSky: new THREE.Color(0x06101f),
    dawnSky: new THREE.Color(0x51352f),
    dayFog: new THREE.Color(0x1a3c4a),
    nightFog: new THREE.Color(0x091827),
    dawnFog: new THREE.Color(0x5b493f),
    dayHemi: new THREE.Color(0xd0e4e0),
    nightHemi: new THREE.Color(0x7894b8),
    dayGround: new THREE.Color(0x201808),
    nightGround: new THREE.Color(0x1d2940),
    daySun: new THREE.Color(0xffe8b0),
    dawnSun: new THREE.Color(0xff9a5a),
    moonLight: new THREE.Color(0xa9c7e8),
  };

  // Keep the shadow frustum hugging the visible ground. Direction comes from
  // the orbital position updateAtmosphere just set; the light is then
  // re-anchored around the camera target so panning across the continent
  // never walks out of the shadow volume.
  function fitSunShadow(force = false, phase = "") {
    if (!sun.castShadow || !lastModelCamera || !lastViewport) return;
    if (!force && lastShadowCamera) {
      const moved = Math.hypot(
        lastModelCamera.x - lastShadowCamera.x,
        lastModelCamera.y - lastShadowCamera.y,
      );
      const zoomDelta = Math.abs(lastModelCamera.zoom - lastShadowCamera.zoom)
        / Math.max(0.001, lastShadowCamera.zoom);
      if (moved <= 6 && zoomDelta <= 0.03 && phase === lastShadowPhase) return;
    }
    const frame = atlas3dCameraFrame(lastModelCamera, lastViewport, seed);
    if (sun.position.lengthSq() > 1) sunShadowDirection.copy(sun.position).normalize();
    sun.target.position.set(frame.target.x, frame.target.y, frame.target.z);
    sun.position.copy(sun.target.position).addScaledVector(sunShadowDirection, 1100);
    sun.updateMatrixWorld(true);
    sun.target.updateMatrixWorld(true);
    const shadowCamera = sun.shadow.camera;
    sun.shadow.updateMatrices(sun);

    // Project the actual visible terrain footprint into light space. A square
    // viewport/zoom estimate wasted most of a 2K map on off-screen ocean at
    // fit zoom and was still far too broad at 695%, leaving mushy shadows.
    const screenSamples = [
      [0, 0], [lastViewport.width / 2, 0], [lastViewport.width, 0],
      [0, lastViewport.height / 2], [lastViewport.width / 2, lastViewport.height / 2],
      [lastViewport.width, lastViewport.height / 2],
      [0, lastViewport.height], [lastViewport.width / 2, lastViewport.height],
      [lastViewport.width, lastViewport.height],
    ];
    const lightPoints = [];
    for (const [x, y] of screenSamples) {
      const ground = atlas3dScreenToGround(lastModelCamera, lastViewport, { x, y }, seed);
      const sceneX = Math.max(ATLAS_3D_BOUNDS.xmin - 28, Math.min(ATLAS_3D_BOUNDS.xmax + 28, ground.scene.x));
      const sceneZ = Math.max(ATLAS_3D_BOUNDS.zmin - 28, Math.min(ATLAS_3D_BOUNDS.zmax + 28, ground.scene.z));
      const groundY = Number.isFinite(ground.height) ? ground.height : frame.target.y;
      lightPoints.push(
        new THREE.Vector3(sceneX, groundY - 5, sceneZ).applyMatrix4(shadowCamera.matrixWorldInverse),
        new THREE.Vector3(sceneX, groundY + 58, sceneZ).applyMatrix4(shadowCamera.matrixWorldInverse),
      );
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const point of lightPoints) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
      minZ = Math.min(minZ, point.z);
      maxZ = Math.max(maxZ, point.z);
    }
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const paddingX = 14 + spanX * 0.035;
    const paddingY = 14 + spanY * 0.035;
    shadowCamera.left = minX - paddingX;
    shadowCamera.right = maxX + paddingX;
    shadowCamera.bottom = minY - paddingY;
    shadowCamera.top = maxY + paddingY;
    shadowCamera.near = Math.max(0.1, -maxZ - 45);
    shadowCamera.far = Math.max(shadowCamera.near + 100, -minZ + 45);
    shadowCamera.updateProjectionMatrix();
    const worldUnitsPerTexel = Math.max(spanX, spanY) / Math.max(1, shadowMapSize);
    sun.shadow.normalBias = Math.max(0.08, Math.min(0.72, worldUnitsPerTexel * 1.15));
    if (sun.shadow.intensity > 0.001) sun.shadow.needsUpdate = true;
    lastShadowCamera = { ...lastModelCamera };
    lastShadowPhase = phase;
    shadowRefits += 1;
    canvas.dataset.atlasShadowSpan = `${Math.round(spanX)}x${Math.round(spanY)}`;
    canvas.dataset.atlasShadowRefits = String(shadowRefits);
  }

  function updateAtmosphere(modelCamera) {
    const light = atlasWorldLightState(currentWorldTime, modelCamera || { x: 0, y: 0 });
    const twilight = light.phase === "dawn" || light.phase === "dusk";
    scene.background.copy(atmosphereColors.nightSky).lerp(atmosphereColors.daySky, light.daylight);
    scene.fog.color.copy(atmosphereColors.nightFog).lerp(atmosphereColors.dayFog, light.daylight);
    hemisphere.color.copy(atmosphereColors.nightHemi).lerp(atmosphereColors.dayHemi, light.daylight);
    hemisphere.groundColor.copy(atmosphereColors.nightGround).lerp(atmosphereColors.dayGround, light.daylight);
    if (twilight) {
      scene.background.lerp(atmosphereColors.dawnSky, 0.22);
      scene.fog.color.lerp(atmosphereColors.dawnFog, 0.18);
    }
    scene.fog.density = 0.0001 + light.daylight * 0.00006;
    hemisphere.intensity = 0.76 + light.daylight * 0.34;
    if (twilight) {
      sun.color.copy(atmosphereColors.dawnSun);
    } else {
      sun.color.copy(atmosphereColors.moonLight).lerp(atmosphereColors.daySun, light.daylight);
    }
    sun.intensity = 0.38 + light.daylight * 1.47;
    const sunAngle = light.localHour / 24 * Math.PI * 2;
    sun.position.set(
      Math.cos(sunAngle) * 560,
      95 + light.sunAltitude * 540,
      Math.sin(sunAngle) * 520,
    );
    fill.intensity = 0.3 - light.daylight * 0.07;
    valleyBounce.intensity = 0.11 - light.daylight * 0.03;
    renderer.toneMappingExposure = 0.9 + light.daylight * 0.02;
    if (sun.castShadow) {
      // Fade shadows out through dawn/dusk: grazing sun angles turn the whole
      // map into acne and kilometre-long streaks, and the sun dips below the
      // horizon at night where a shadow pass would light from beneath.
      sun.shadow.intensity = clamp01((light.sunAltitude - 0.05) / 0.22);
      if (sun.shadow.intensity > 0.001) {
        fitSunShadow(false, light.phase);
      } else {
        // Keep the moon/directional vector independent of the last daytime
        // pan even when the expensive shadow-frustum fit is switched off.
        if (lastModelCamera && lastViewport) {
          const frame = atlas3dCameraFrame(lastModelCamera, lastViewport, seed);
          if (sun.position.lengthSq() > 1) sunShadowDirection.copy(sun.position).normalize();
          sun.target.position.set(frame.target.x, frame.target.y, frame.target.z);
          sun.position.copy(sun.target.position).addScaledVector(sunShadowDirection, 1100);
          sun.updateMatrixWorld(true);
          sun.target.updateMatrixWorld(true);
        }
        sun.shadow.needsUpdate = false;
      }
      canvas.dataset.atlasShadowActive = sun.shadow.intensity > 0.001 ? "true" : "false";
    }

    const emissiveIntensity = Math.max(0, 1 - light.daylight) * 2.6;
    chunkRoot.traverse((child) => {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (material?.userData?.atlasNightLight) material.emissiveIntensity = emissiveIntensity;
      }
    });
    canvas.dataset.atlasLightPhase = light.phase;
    canvas.dataset.atlasLocalHour = light.localHour.toFixed(2);
    canvas.dataset.atlasTimezoneOffset = light.timezoneOffset.toFixed(2);
  }

  function updateWorldTime(nextTime, modelCamera, renderNow = true) {
    currentWorldTime = nextTime || { day: 1, hour: 12, minute: 0 };
    setAtlasTerrainWorldTime(terrainUniforms, currentWorldTime);
    updateAtmosphere(modelCamera);
    const absoluteMinutes = (currentWorldTime.day || 1) * 1440
      + (currentWorldTime.hour || 0) * 60
      + (currentWorldTime.minute || 0);
    waterBaseOffsetX = (absoluteMinutes * 0.000017) % 1;
    waterBaseOffsetY = (absoluteMinutes * 0.000011) % 1;
    waterDetailTexture.offset.set(waterBaseOffsetX, waterBaseOffsetY);
    canvas.dataset.atlasTimezoneSpan = String(ATLAS_TIMEZONE_SPAN_HOURS);
    if (renderNow) render();
  }

  function render() {
    if (!controllerActive || controllerDisposed) return;
    hotSprings?.traverse?.((child) => {
      if (child.userData?.billboard) child.quaternion.copy(camera.quaternion);
    });
    // autoReset is off so the diagnostics aggregate every pass (shadow map,
    // beauty, blur, composite) of this presented frame.
    renderer.info.reset();
    if (!postStack?.render()) renderer.render(scene, camera);
    canvas.dataset.atlasPostFx = postStack?.activeMode?.() || "off";
    canvas.dataset.atlasRenderer = "webgl2";
    canvas.dataset.atlasDrawCalls = String(renderer.info.render.calls);
    canvas.dataset.atlasTriangles = String(renderer.info.render.triangles);
    lastRenderAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  }

  function ambientAllowed() {
    return ambientEnabled
      && quality?.ambientFx !== "off"
      && !reducedMotionQuery?.matches
      && (typeof document === "undefined" || document.visibilityState === "visible");
  }

  function scheduleAmbient() {
    if (ambientFrame || !ambientAllowed()) return;
    ambientFrame = requestAnimationFrame(tickAmbient);
  }

  function tickAmbient(timestamp) {
    ambientFrame = 0;
    if (!ambientAllowed()) return;
    if (timestamp - ambientLastTick < 33) {
      scheduleAmbient();
      return;
    }
    ambientLastTick = timestamp;
    const seconds = timestamp / 1000;
    if (terrainUniforms?.uCloudOffset && quality?.ambientFx === "full") {
      terrainUniforms.uCloudOffset.value.set(seconds * 0.0022, seconds * 0.00135);
      terrainUniforms.uCloudStrength.value = 0.14;
    }
    waterDetailTexture.offset.set(
      (waterBaseOffsetX + seconds * 0.0026) % 1,
      (waterBaseOffsetY + seconds * 0.0017) % 1,
    );
    routes.traverse((child) => {
      const uniforms = child.material?.userData?.atlasFlowUniform;
      if (uniforms) uniforms.value = seconds * 0.9;
    });
    hotSprings?.traverse?.((child) => {
      if (!child.userData?.billboard) return;
      child.material.opacity = 0.15 + Math.sin(seconds * 1.2 + child.position.x * 0.03) * 0.035;
      const drift = 1 + Math.sin(seconds * 0.8 + child.position.z * 0.02) * 0.045;
      child.scale.set(drift, 1 / drift, 1);
    });
    if (timestamp - lastRenderAt > 12) render();
    scheduleAmbient();
  }

  function handleAmbientStateChange() {
    if (ambientAllowed()) scheduleAmbient();
    else if (ambientFrame) {
      cancelAnimationFrame(ambientFrame);
      ambientFrame = 0;
    }
    canvas.dataset.atlasAmbient = ambientAllowed() ? "running" : "paused";
  }

  function startAmbient() {
    ambientEnabled = true;
    if (!ambientListenersAttached) {
      document.addEventListener("visibilitychange", handleAmbientStateChange);
      if (reducedMotionQuery?.addEventListener) {
        reducedMotionQuery.addEventListener("change", handleAmbientStateChange);
      } else {
        reducedMotionQuery?.addListener?.(handleAmbientStateChange);
      }
      ambientListenersAttached = true;
    }
    handleAmbientStateChange();
  }

  function stopAmbient() {
    ambientEnabled = false;
    if (ambientFrame) cancelAnimationFrame(ambientFrame);
    ambientFrame = 0;
    if (terrainUniforms?.uCloudStrength) terrainUniforms.uCloudStrength.value = 0;
    if (ambientListenersAttached) {
      document.removeEventListener("visibilitychange", handleAmbientStateChange);
      if (reducedMotionQuery?.removeEventListener) {
        reducedMotionQuery.removeEventListener("change", handleAmbientStateChange);
      } else {
        reducedMotionQuery?.removeListener?.(handleAmbientStateChange);
      }
      ambientListenersAttached = false;
    }
    canvas.dataset.atlasAmbient = "stopped";
  }

  function configureCamera(targetCamera, modelCamera, viewport) {
    const widthPx = Math.max(1, viewport.width);
    const heightPx = Math.max(1, viewport.height);
    const frame = atlas3dCameraFrame(modelCamera, viewport, seed);
    targetCamera.aspect = widthPx / heightPx;
    targetCamera.position.set(frame.position.x, frame.position.y, frame.position.z);
    targetCamera.near = Math.max(0.1, frame.distance / 1800);
    targetCamera.far = Math.max(12000, frame.distance + 8000);
    targetCamera.lookAt(frame.target.x, frame.target.y, frame.target.z);
    targetCamera.updateProjectionMatrix();
    targetCamera.updateMatrixWorld(true);
  }

  function updateCamera(modelCamera, viewport) {
    const widthPx = Math.max(1, viewport.width);
    const heightPx = Math.max(1, viewport.height);
    const localCamera = clampAtlas3dCamera(modelCamera, viewport, seed);
    lastModelCamera = localCamera;
    lastViewport = viewport;
    const nextPixelRatio = atlasRenderPixelRatio(widthPx, heightPx, quality);
    const sizeChanged = widthPx !== renderWidth || heightPx !== renderHeight;
    const pixelRatioChanged = nextPixelRatio !== renderPixelRatio;
    if (pixelRatioChanged) {
      renderer.setPixelRatio(nextPixelRatio);
      renderPixelRatio = nextPixelRatio;
    }
    if (sizeChanged || pixelRatioChanged) {
      renderer.setSize(widthPx, heightPx, false);
      postStack?.setSize(widthPx, heightPx, nextPixelRatio);
      renderWidth = widthPx;
      renderHeight = heightPx;
    }
    configureCamera(camera, localCamera, viewport);
    const zoomRatio = localCamera.zoom / atlas3dFitZoom(viewport, seed);
    postStack?.setZoomStrength(zoomRatio);
    routes.children.forEach((child) => {
      if (child.userData?.atlasSeaLane) child.visible = zoomRatio >= 1.35;
    });
    canvas.dataset.atlasPropDetail = zoomRatio >= 9.5 && quality?.id !== "low" ? "true" : "false";
    updateAtmosphere(localCamera);
    if (controllerActive) updateChunkStream(localCamera, viewport);
    render();
  }

  function refreshChunkDiagnostics(lastChunk = null, uploadMs = null) {
    const snapshot = chunkStore.snapshot();
    let vertices = 0;
    let props = 0;
    let dressing = 0;
    let lod0 = 0;
    let landmarkSources = 0;
    let landmarkBatches = 0;
    for (const group of presentedChunks.values()) {
      vertices += group.userData.terrainVertices || 0;
      props += group.userData.propCount || 0;
      dressing += group.userData.dressingCount || 0;
      landmarkSources += group.userData.landmarkSources || 0;
      landmarkBatches += group.userData.landmarkBatches || 0;
      if (group.userData.lod === 0) lod0 += 1;
    }
    canvas.dataset.atlasChunksLoaded = String(snapshot.presented);
    canvas.dataset.atlasChunksPending = String(snapshot.pending);
    canvas.dataset.atlasChunkCache = String(snapshot.cache);
    canvas.dataset.atlasChunkUploads = String(snapshot.uploads);
    canvas.dataset.atlasChunksLod0 = String(lod0);
    canvas.dataset.atlasTerrainVertices = String(vertices);
    canvas.dataset.atlasProps = String(props);
    canvas.dataset.atlasDressing = String(dressing);
    canvas.dataset.atlasLandmarkSourceMeshes = String(landmarkSources);
    canvas.dataset.atlasLandmarkBatches = String(landmarkBatches);
    canvas.dataset.atlasWorkerCache = String(chunkClient.cachedChunkCount ?? snapshot.cache);
    if (lastChunk) canvas.dataset.atlasChunkBuildMs = Number(lastChunk.buildMs || 0).toFixed(2);
    if (uploadMs != null) canvas.dataset.atlasChunkUploadMs = Number(uploadMs).toFixed(2);
  }

  function disposeChunkGroup(group) {
    group.traverse((child) => {
      if (child.userData?.atlasTerrainChunk) {
        terrainMeshes.delete(child);
        child.geometry?.dispose?.();
        return;
      }
      child.dispose?.();
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
      else child.material?.dispose?.();
    });
  }

  function disposePresentedChunk(requestKey, deactivate = true) {
    const group = presentedChunks.get(requestKey);
    if (!group) return false;
    presentedChunks.delete(requestKey);
    if (deactivate && group.userData?.chunkPayload) {
      chunkClient.deactivatePresentation(group.userData.chunkPayload);
    }
    chunkRoot.remove(group);
    disposeChunkGroup(group);
    heightCache.clear();
    if (!controllerDisposed && !terminalStreamFailure) scheduleHeightOverlayReseat();
    return true;
  }

  function releaseEvictions(evictions = []) {
    for (const eviction of evictions) {
      if (eviction.wasPresented) disposePresentedChunk(eviction.key);
    }
  }

  function failChunkStream(error) {
    if (controllerDisposed || terminalStreamFailure) return false;
    terminalStreamFailure = true;
    controllerActive = false;
    stopAmbient();
    if (overlayReseatTimer) clearTimeout(overlayReseatTimer);
    overlayReseatTimer = 0;
    if (uploadFrame) cancelAnimationFrame(uploadFrame);
    uploadFrame = 0;
    for (const { request } of pendingRequests.values()) {
      chunkClient.cancel(request.cx, request.cy, request.lod);
    }
    pendingRequests.clear();
    for (const key of [...presentedChunks.keys()]) disposePresentedChunk(key);
    chunkStore.clear();
    heightCache.clear();
    canvas.dataset.atlasStream = "error";
    // A terminal worker/request failure invalidates the retained payload LRU;
    // disposal also releases every active height-registration owner.
    chunkClient.dispose();
    onStreamError?.(error);
    return true;
  }

  function presentChunk(upload) {
    const startedAt = globalThis.performance?.now?.() ?? Date.now();
    const data = upload.chunk;
    const outgoingGroup = upload.replaceKey ? presentedChunks.get(upload.replaceKey) : null;
    const outgoingPayload = outgoingGroup?.userData?.chunkPayload || null;
    if (!chunkClient.activatePresentation(data)) {
      throw new Error(`The displayed atlas chunk ${upload.key} could not activate its height surface.`);
    }
    const group = new THREE.Group();
    group.name = `atlas-chunk-${upload.geoKey}-lod${data.lod}`;
    group.userData.lod = data.lod;
    group.userData.terrainVertices = data.positions.length / 3;
    group.userData.chunkPayload = data;
    try {
      if (!data.empty) {
        const terrain = new THREE.Mesh(createAtlasTerrainGeometry(THREE, data), terrainMaterial);
        terrain.name = `atlas-terrain-${upload.geoKey}-lod${data.lod}`;
        terrain.userData.atlasTerrainChunk = true;
        terrain.castShadow = renderer.shadowMap.enabled;
        terrain.receiveShadow = renderer.shadowMap.enabled;
        terrainMeshes.add(terrain);
        group.add(terrain);

        const propQuality = data.lod === 0 ? quality : {
          ...quality,
          propDensity: Math.max(0.2, (quality?.propDensity ?? 1) * 0.68),
          chunkPropCap: Math.max(60, Math.round((quality?.chunkPropCap || 180) * 0.62)),
        };
        const props = createAtlasChunkPropBatch(THREE, data, seed, propQuality);
        props.traverse((child) => {
          if (!child.isMesh) return;
          child.castShadow = renderer.shadowMap.enabled;
          child.receiveShadow = renderer.shadowMap.enabled;
        });
        group.userData.propCount = props.userData.count || 0;
        group.userData.dressingCount = props.userData.dressingCount || 0;
        group.add(props);

        const landmarkIds = new Set(ATLAS_LANDMARKS.filter((landmark) => (
          Math.floor(landmark.coord.x / CONTINENT.chunkSize) === data.cx
            && Math.floor(landmark.coord.y / CONTINENT.chunkSize) === data.cy
        )).map((landmark) => landmark.id));
        if (landmarkIds.size) {
          const source = createLandmarkMeshGroup(
            THREE,
            seed,
            (landmark) => landmarkIds.has(landmark.id),
          );
          const landmarkBatch = batchLandmarkMeshGroup(THREE, source);
          landmarkBatch.name = `atlas-landmarks-${upload.geoKey}`;
          landmarkBatch.traverse((child) => {
            if (!child.isMesh) return;
            child.castShadow = renderer.shadowMap.enabled;
            child.receiveShadow = renderer.shadowMap.enabled;
          });
          group.userData.landmarkSources = landmarkBatch.userData.sourceMeshCount || 0;
          group.userData.landmarkBatches = landmarkBatch.userData.batchCount || 0;
          group.add(landmarkBatch);
        }
      }
    } catch (error) {
      chunkClient.deactivatePresentation(data);
      if (outgoingPayload) chunkClient.activatePresentation(outgoingPayload);
      disposeChunkGroup(group);
      throw error;
    }
    if (upload.replaceKey) {
      disposePresentedChunk(upload.replaceKey, outgoingPayload !== data);
    }
    chunkRoot.add(group);
    presentedChunks.set(upload.key, group);
    heightCache.clear();
    scheduleHeightOverlayReseat();
    const uploadMs = (globalThis.performance?.now?.() ?? Date.now()) - startedAt;
    refreshChunkDiagnostics(data, uploadMs);
    if (sun.castShadow && sun.shadow.intensity > 0.001) sun.shadow.needsUpdate = true;
    if (!firstChunkSettled) {
      firstChunkSettled = true;
      resolveFirstChunk();
    }
    if (controllerActive) render();
  }

  function pumpChunkUploads() {
    uploadFrame = 0;
    if (controllerDisposed || terminalStreamFailure) return;
    const upload = chunkStore.takeUpload();
    if (upload) {
      try {
        presentChunk(upload);
      } catch (error) {
        failChunkStream(error);
        return;
      }
    }
    if (chunkStore.snapshot().uploads > 0) {
      uploadFrame = requestAnimationFrame(pumpChunkUploads);
    }
  }

  function scheduleChunkUpload() {
    if (!uploadFrame && !controllerDisposed && !terminalStreamFailure) {
      uploadFrame = requestAnimationFrame(pumpChunkUploads);
    }
  }

  function handleStreamPlan(plan) {
    if (controllerDisposed || terminalStreamFailure) return;
    for (const removal of plan.removals) disposePresentedChunk(removal.key);
    releaseEvictions(plan.evicted);
    for (const request of plan.cancels) {
      pendingRequests.delete(request.requestKey);
      chunkClient.cancel(request.cx, request.cy, request.lod);
    }
    for (const request of plan.reprioritize) {
      chunkClient.reprioritize(request.cx, request.cy, request.lod, request.priority);
    }
    for (const request of plan.requests) {
      if (!chunkStore.markPending(request)) continue;
      const pending = chunkClient.request(request.cx, request.cy, request.lod, request.priority);
      pendingRequests.set(request.requestKey, { pending, request });
      pending.then((chunk) => {
        pendingRequests.delete(request.requestKey);
        if (controllerDisposed || terminalStreamFailure) return;
        const result = chunkStore.resolve(chunk);
        releaseEvictions(result.evicted);
        refreshChunkDiagnostics();
        scheduleChunkUpload();
      }).catch((error) => {
        pendingRequests.delete(request.requestKey);
        if (controllerDisposed || terminalStreamFailure) return;
        chunkStore.reject(request);
        refreshChunkDiagnostics();
        const disposition = atlas3dStreamFailureDisposition(error, {
          ready: firstChunkSettled,
          pendingCount: pendingRequests.size,
          uploadCount: chunkStore.snapshot().uploads,
        });
        if (disposition === "fatal") {
          failChunkStream(error);
        } else if (disposition === "startup") {
          firstChunkSettled = true;
          rejectFirstChunk(error);
        }
      });
    }
    refreshChunkDiagnostics();
    scheduleChunkUpload();
  }

  function corridorVelocity(focus) {
    if (!Array.isArray(streamCorridor) || streamCorridor.length < 2) return null;
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    for (let index = 0; index < streamCorridor.length; index += 1) {
      const distance = Math.hypot(
        streamCorridor[index].x - focus.x,
        streamCorridor[index].y - focus.y,
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }
    if (nearestDistance > 72) return null;
    const next = streamCorridor[Math.min(streamCorridor.length - 1, nearestIndex + 2)];
    return { x: next.x - focus.x, y: next.y - focus.y };
  }

  function updateChunkStream(modelCamera, viewport) {
    if (controllerDisposed || terminalStreamFailure) return;
    const rect = atlas3dStreamingRect(modelCamera, viewport, seed);
    const panVelocity = lastStreamFocus
      ? { x: modelCamera.x - lastStreamFocus.x, y: modelCamera.y - lastStreamFocus.y }
      : null;
    const velocity = corridorVelocity(modelCamera) || panVelocity;
    lastStreamFocus = { x: modelCamera.x, y: modelCamera.y };
    const plan = chunkStore.update({
      rect,
      focus: modelCamera,
      velocity,
      lod0Radius: quality?.lod0Radius ?? 1,
    });
    handleStreamPlan(plan);
  }

  function updateCorridor(corridor) {
    streamCorridor = Array.isArray(corridor) ? corridor : null;
    if (controllerActive && lastModelCamera && lastViewport) {
      updateChunkStream(lastModelCamera, lastViewport);
    }
  }

  function setActive(active) {
    controllerActive = !terminalStreamFailure && active !== false;
    canvas.dataset.atlasActive = controllerActive ? "true" : "false";
    if (controllerActive) {
      if (lastModelCamera && lastViewport) updateChunkStream(lastModelCamera, lastViewport);
      startAmbient();
      render();
    } else {
      stopAmbient();
    }
  }

  function scheduleHeightOverlayReseat() {
    if (overlayReseatTimer) clearTimeout(overlayReseatTimer);
    overlayReseatTimer = setTimeout(() => {
      overlayReseatTimer = 0;
      if (controllerDisposed || terminalStreamFailure) return;
      heightCache.clear();
      updateRoutes(currentFocusedRealmId, false);
      updateJourney(currentJourneyData, currentJourneyBreaks, false);
      updateSeen(currentSeenKeys, false);
      updateAtmosphere(lastModelCamera);
      render();
    }, 90);
  }

  function updateRoutes(focusedRealmId, renderNow = true) {
    currentFocusedRealmId = focusedRealmId;
    scene.remove(routes);
    disposeObject(routes);
    routes = createRouteGroup(THREE, seed, focusedRealmId);
    scene.add(routes);
    if (renderNow) render();
  }

  function updateJourney(nextJourney, breaks, renderNow = true) {
    currentJourneyData = nextJourney;
    currentJourneyBreaks = breaks || [];
    scene.remove(journey);
    disposeObject(journey);
    journey = createJourneyGroup(THREE, seed, nextJourney, breaks);
    scene.add(journey);
    if (renderNow) render();
  }

  function updateSeen(nextSeenKeys, renderNow = true) {
    currentSeenKeys = nextSeenKeys || [];
    scene.remove(seenTrail);
    disposeObject(seenTrail);
    seenTrail = createSeenTrail(THREE, nextSeenKeys, seed);
    scene.add(seenTrail);
    canvas.dataset.atlasSeenPoints = String(nextSeenKeys?.length || 0);
    if (renderNow) render();
  }

  function pick(point, viewport, modelCamera = null, includeWater = false) {
    if (!terrainMeshes.size && !includeWater) return null;
    const pickingCamera = modelCamera ? queryCamera : camera;
    if (modelCamera) {
      configureCamera(pickingCamera, clampAtlas3dCamera(modelCamera, viewport, seed), viewport);
    }
    const ndc = new THREE.Vector2(
      point.x / Math.max(1, viewport.width) * 2 - 1,
      1 - point.y / Math.max(1, viewport.height) * 2,
    );
    raycaster.setFromCamera(ndc, pickingCamera);
    const terrainTargets = [...terrainMeshes];
    const hit = raycaster.intersectObjects(
      includeWater ? [...terrainTargets, water] : terrainTargets,
      false,
    )[0];
    if (!hit) return null;
    const scenePoint = { x: hit.point.x, z: hit.point.z };
    return {
      ...atlas3dSceneToAxial(scenePoint),
      scene: scenePoint,
      height: hit.point.y,
    };
  }

  function restore() {
    postStack?.reset?.();
    if (lastModelCamera && lastViewport) updateCamera(lastModelCamera, lastViewport);
    else render();
  }

  function dispose() {
    controllerDisposed = true;
    stopAmbient();
    if (overlayReseatTimer) clearTimeout(overlayReseatTimer);
    overlayReseatTimer = 0;
    if (uploadFrame) cancelAnimationFrame(uploadFrame);
    uploadFrame = 0;
    for (const key of chunkStore.snapshot().pendingKeys) {
      const [coord, lodText] = key.split("|");
      const [cx, cy] = coord.split(",").map(Number);
      chunkClient.cancel(cx, cy, Number(lodText));
    }
    pendingRequests.clear();
    for (const key of [...presentedChunks.keys()]) disposePresentedChunk(key);
    // Drop scene ownership only. The persistent worker client deliberately
    // retains its tier-bounded LRU so reopening the atlas reuses warm chunks.
    chunkStore.clear();
    if (!firstChunkSettled) {
      firstChunkSettled = true;
      resolveFirstChunk();
    }
    disposeObject(scene);
    postStack?.dispose();
    terrainDetailTexture.dispose();
    waterDetailTexture.dispose();
    renderer.dispose();
  }

  return {
    renderer,
    updateCamera,
    updateJourney,
    updateRoutes,
    updateSeen,
    updateWorldTime,
    updateCorridor,
    setActive,
    whenReady: () => firstChunkReady,
    pick,
    render,
    startAmbient,
    stopAmbient,
    restore,
    dispose,
  };
}

export const WorldAtlas3DScene = forwardRef(function WorldAtlas3DScene({
  camera,
  viewport,
  seed = CONTINENT.seed,
  quality = null,
  focusedRealmId = null,
  journey = null,
  journeyBreaks = [],
  seenKeys = [],
  worldTime = null,
  active = true,
  corridor = null,
  onReady,
  onError,
  onRefined,
}, ref) {
  const canvasRef = useRef(null);
  const controllerRef = useRef(null);
  const cameraRef = useRef(camera);
  const viewportRef = useRef(viewport);
  const readyRef = useRef(onReady);
  const errorRef = useRef(onError);
  const refinedRef = useRef(onRefined);
  const focusRef = useRef(focusedRealmId);
  const journeyRef = useRef(journey);
  const breaksRef = useRef(journeyBreaks);
  const seenRef = useRef(seenKeys);
  const timeRef = useRef(worldTime);
  const activeRef = useRef(active);
  const corridorRef = useRef(corridor);

  cameraRef.current = camera;
  viewportRef.current = viewport;
  readyRef.current = onReady;
  errorRef.current = onError;
  refinedRef.current = onRefined;
  focusRef.current = focusedRealmId;
  journeyRef.current = journey;
  breaksRef.current = journeyBreaks;
  seenRef.current = seenKeys;
  timeRef.current = worldTime;
  activeRef.current = active;
  corridorRef.current = corridor;

  useImperativeHandle(ref, () => ({
    pick(point, modelCamera = null) {
      return controllerRef.current?.pick(point, viewportRef.current, modelCamera) || null;
    },
    pickGround(point, modelCamera = null) {
      return controllerRef.current?.pick(point, viewportRef.current, modelCamera, true) || null;
    },
  }), []);

  useEffect(() => {
    let disposed = false;
    let controller = null;
    let contextLost = false;
    let terrainReady = false;
    let listenersAttached = false;
    let restoreFrame = 0;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const handleLost = (event) => {
      event.preventDefault();
      contextLost = true;
      controller?.stopAmbient();
      errorRef.current?.(
        "The graphics context was interrupted. The atlas will resume when it is restored.",
        { recoverable: true },
      );
    };
    const handleRestored = () => {
      if (restoreFrame) cancelAnimationFrame(restoreFrame);
      restoreFrame = requestAnimationFrame(() => {
        restoreFrame = 0;
        if (disposed) return;
        contextLost = false;
        controller?.restore();
        controller?.setActive(activeRef.current);
        if (terrainReady) readyRef.current?.({ restored: true });
      });
    };

    (async () => {
      try {
        const { THREE, chunkClient } = await getWorldAtlas3dRuntime(seed);
        if (disposed) return;
        controller = createController(
          THREE,
          canvas,
          seed,
          quality,
          chunkClient,
          (error) => {
            if (disposed) return;
            terrainReady = false;
            errorRef.current?.(
              error?.message || "The 3D atlas terrain stream was interrupted.",
            );
          },
        );
        // Three registers its own context restoration handlers during renderer
        // construction. Register ours afterward so readiness returns only after
        // Three has recreated GPU resources and drawn a fresh frame.
        canvas.addEventListener("webglcontextlost", handleLost, false);
        canvas.addEventListener("webglcontextrestored", handleRestored, false);
        listenersAttached = true;
        controllerRef.current = controller;
        controller.updateCorridor(corridorRef.current);
        controller.updateRoutes(focusRef.current, false);
        controller.updateJourney(journeyRef.current, breaksRef.current, false);
        controller.updateSeen(seenRef.current, false);
        controller.updateWorldTime(timeRef.current, cameraRef.current, false);
        controller.updateCamera(cameraRef.current, viewportRef.current);
        controller.setActive(activeRef.current);
        await controller.whenReady();
        if (disposed) return;
        terrainReady = true;
        if (!contextLost) readyRef.current?.();
        refinedRef.current?.();
      } catch (error) {
        if (!disposed) errorRef.current?.(error?.message || "The 3D atlas could not start.");
      }
    })();

    return () => {
      disposed = true;
      if (restoreFrame) cancelAnimationFrame(restoreFrame);
      controllerRef.current = null;
      controller?.dispose();
      if (listenersAttached) {
        canvas.removeEventListener("webglcontextlost", handleLost);
        canvas.removeEventListener("webglcontextrestored", handleRestored);
      }
    };
  }, [seed, quality?.id]);

  useAtlas3dLayoutEffect(() => {
    controllerRef.current?.updateCamera(camera, viewport);
  }, [camera, viewport]);

  useEffect(() => {
    controllerRef.current?.updateRoutes(focusedRealmId);
  }, [focusedRealmId]);

  useEffect(() => {
    controllerRef.current?.updateJourney(journey, journeyBreaks);
  }, [journey, journeyBreaks]);

  useEffect(() => {
    controllerRef.current?.updateSeen(seenKeys);
  }, [seenKeys]);

  useEffect(() => {
    controllerRef.current?.updateWorldTime(worldTime, cameraRef.current);
  }, [worldTime?.day, worldTime?.hour, worldTime?.minute]);

  useEffect(() => {
    controllerRef.current?.setActive(active);
  }, [active]);

  useEffect(() => {
    controllerRef.current?.updateCorridor(corridor);
  }, [corridor]);

  return <canvas ref={canvasRef} className="world-atlas__webgl" aria-hidden="true" />;
});
