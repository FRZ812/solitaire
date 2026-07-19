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
  ATLAS_3D_FOV_DEG,
  atlas3dAxialToScene,
  atlas3dCameraFrame,
  atlas3dSceneToAxial,
  atlas3dTerrainHeightAt,
  coordinateNoise,
} from "./worldAtlas3dModel.js";
import { getWorldAtlas3dRuntime } from "./worldAtlas3dRuntime.js";
import { ATLAS_LANDMARKS } from "./worldAtlasModel.js";

const ROUTE_HEIGHT_BIAS = 0.72;
// Keep the ocean beneath the entire perspective frustum. Plane geometry has a
// fixed two-triangle cost, so a horizon-sized surface is no heavier than a
// continent-sized one and avoids exposing a rectangular edge on tall screens.
const WATER_PLANE_SIZE = 20_000;
const MOBILE_RENDER_PIXEL_BUDGET = 900000;
const DESKTOP_RENDER_PIXEL_BUDGET = 1800000;
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

function atlasRenderPixelRatio(width, height) {
  const mobile = width < 720;
  const dprCap = mobile ? 1.3 : 1.65;
  const pixelBudget = mobile ? MOBILE_RENDER_PIXEL_BUDGET : DESKTOP_RENDER_PIXEL_BUDGET;
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
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = renderOrder;
  return mesh;
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
    if (ribbon) group.add(ribbon);
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
  const centerHeight = cachedHeight(lake.center, seed);
  const radius = Math.max(2, lake.radius * 0.9);
  const geometry = new THREE.CircleGeometry(radius, 28);
  geometry.rotateX(-Math.PI / 2);

  // Water must remain level. Place the plane at the lower of the local center
  // and first shoreline quartile so surrounding terrain naturally clips it
  // into a basin instead of leaving a hovering disc or a blue terrain cone.
  const shorelineHeights = [];
  for (let sampleIndex = 0; sampleIndex < 28; sampleIndex += 1) {
    const angle = sampleIndex / 28 * Math.PI * 2;
    shorelineHeights.push(cachedHeight({
      x: lake.center.x + Math.cos(angle) * radius,
      y: lake.center.y + Math.sin(angle) * radius,
    }, seed));
  }
  shorelineHeights.sort((a, b) => a - b);
  const lowerShoreHeight = shorelineHeights[Math.floor(shorelineHeights.length * 0.25)];
  const waterHeight = Math.min(centerHeight, lowerShoreHeight) + 0.18;

  const material = new THREE.MeshStandardMaterial({
    color: 0x327c99,
    roughness: 0.48,
    metalness: 0.08,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `atlas-lake-${lake.id || lake.name}`;
  mesh.position.set(center.x, waterHeight, center.z);
  mesh.userData.waterHeight = waterHeight;
  mesh.renderOrder = 1;
  return mesh;
}

export function createHotSprings(THREE, seed) {
  const group = new THREE.Group();
  group.name = "atlas-hot-springs";

  for (const spring of CONTINENT_HOT_SPRINGS) {
    const center = atlas3dAxialToScene(spring.center);
    const groundHeight = cachedHeight(spring.center, seed);
    const poolGeometry = new THREE.CircleGeometry(Math.max(1.5, spring.radius), 24);
    poolGeometry.rotateX(-Math.PI / 2);
    const poolMaterial = new THREE.MeshStandardMaterial({
      color: 0x4dbcb0,
      roughness: 0.34,
      metalness: 0.04,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    const pool = new THREE.Mesh(poolGeometry, poolMaterial);
    pool.name = `atlas-hot-spring-${spring.id || spring.name}`;
    pool.position.set(center.x, groundHeight + 0.9, center.z);
    pool.renderOrder = 1;
    group.add(pool);

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
    steam.position.set(center.x, groundHeight + 2.9, center.z);
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
      const geometry = new THREE.PlaneGeometry(width, depth, 1, 1);
      const position = geometry.getAttribute("position");
      for (let vertex = 0; vertex < position.count; vertex += 1) {
        const displacementX = (coordinateNoise(vertex, clusterIndex, `${salt}:vx`) - 0.5) * 4;
        const displacementY = (coordinateNoise(vertex, patchIndex, `${salt}:vy`) - 0.5) * 4;
        position.setXY(vertex, position.getX(vertex) + displacementX, position.getY(vertex) + displacementY);
      }
      position.needsUpdate = true;
      geometry.rotateX(-Math.PI / 2);
      geometry.computeBoundingSphere();

      const opacity = 0.35 + coordinateNoise(coord.x, coord.y, `${salt}:opacity`) * 0.2;
      const material = new THREE.MeshBasicMaterial({
        color: 0xe8eef2,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const cloud = new THREE.Mesh(geometry, material);
      const altitudeNoise = coordinateNoise(coord.y, coord.x, `${salt}:altitude`);
      const altitude = Math.max(22, Math.min(28, peak.height - 2 - altitudeNoise * 4));
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
const REALM_CANOPY_COLORS = [0x4a7a50, 0x1e2e1c, 0x2c5c30, 0x4a5824, 0x1a4422];
const REALM_TRUNK_COLORS  = [0x4f3c29, 0x2e2820, 0x3c3020, 0x503a1c, 0x2e3018];
const REALM_TREE_SHAPE    = [[1.0, 1.0], [0.6, 1.5], [1.3, 0.8], [0.8, 0.65], [1.4, 1.15]];

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

function createVegetationGroup(THREE, treeData, seed) {
  const vegetation = new THREE.Group();
  vegetation.name = "atlas-vegetation";
  const treeCount = Math.floor(treeData.length / 7);
  const records = { standard: [], cherry: [], ginkgo: [] };

  for (let index = 0; index < treeCount; index += 1) {
    const offset = index * 7;
    const realmIdx = Math.min(4, Math.max(0, Math.round(treeData[offset + 6]) || 0));
    const coord = atlas3dSceneToAxial({ x: treeData[offset], z: treeData[offset + 2] });
    const variant = realmIdx === 2 ? atlasEastFloraVariant(coord, seed) : "standard";
    records[variant].push({
      x: treeData[offset],
      groundHeight: treeData[offset + 1],
      z: treeData[offset + 2],
      scale: treeData[offset + 3],
      rotation: treeData[offset + 4],
      colorFactor: treeData[offset + 5],
      realmIdx,
    });
  }

  // The eastern lowlands are predominantly marsh, terraces, and river plain,
  // so the generic forest-only sampler can legitimately produce no candidates
  // inside the authored blossom/ginkgo bands. Seed the regional flora directly
  // on deterministic land points so its identity does not depend on a forest
  // classifier intended for the rest of the continent.
  for (const variant of ["cherry", "ginkgo"]) {
    const { bounds } = EAST_FLORA_MESHES[variant];
    for (let y = bounds.ymin; y <= bounds.ymax; y += 14) {
      for (let x = bounds.xmin; x <= bounds.xmax; x += 14) {
        if (coordinateNoise(x, y, seed + 711) <= 0.72) continue;
        const coord = {
          x: x + (coordinateNoise(x, y, seed + 713) - 0.5) * 8,
          y: y + (coordinateNoise(y, x, seed + 719) - 0.5) * 8,
        };
        const groundHeight = cachedHeight(coord, seed);
        if (groundHeight <= 0) continue;
        const scene = atlas3dAxialToScene(coord);
        records[variant].push({
          x: scene.x,
          groundHeight,
          z: scene.z,
          scale: 0.82 + coordinateNoise(x, y, seed + 727) * 0.68,
          rotation: coordinateNoise(y, x, seed + 733) * Math.PI * 2,
          colorFactor: 0.9 + coordinateNoise(x, y, seed + 739) * 0.16,
          realmIdx: 2,
        });
      }
    }
  }

  const transform = new THREE.Object3D();
  const tint = new THREE.Color();
  if (records.standard.length > 0) {
    const canopyGeometry = new THREE.ConeGeometry(2.05, 5.2, 5, 1);
    canopyGeometry.translate(0, 2.6, 0);
    const trunkGeometry = new THREE.CylinderGeometry(0.23, 0.35, 1.5, 5);
    trunkGeometry.translate(0, 0.75, 0);
    const canopyMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.98, flatShading: true });
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
    const canopies = new THREE.InstancedMesh(canopyGeometry, canopyMaterial, records.standard.length);
    const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, records.standard.length);
    canopies.name = "atlas-standard-tree-canopies";
    trunks.name = "atlas-standard-tree-trunks";

    for (const [instance, record] of records.standard.entries()) {
      const { realmIdx, scale, colorFactor } = record;
      const [shapeXZ, shapeY] = REALM_TREE_SHAPE[realmIdx];
      transform.position.set(record.x, record.groundHeight + 0.06, record.z);
      transform.rotation.set(0, record.rotation, 0);
      transform.scale.set(scale * shapeXZ, scale * (0.92 + colorFactor * 0.12) * shapeY, scale * shapeXZ);
      transform.updateMatrix();
      canopies.setMatrixAt(instance, transform.matrix);
      trunks.setMatrixAt(instance, transform.matrix);
      tint.set(REALM_CANOPY_COLORS[realmIdx]).multiplyScalar(colorFactor);
      canopies.setColorAt(instance, tint);
      tint.set(REALM_TRUNK_COLORS[realmIdx]).multiplyScalar(0.85 + colorFactor * 0.18);
      trunks.setColorAt(instance, tint);
    }
    canopies.instanceMatrix.needsUpdate = true;
    trunks.instanceMatrix.needsUpdate = true;
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
    if (trunks.instanceColor) trunks.instanceColor.needsUpdate = true;
    canopies.computeBoundingSphere();
    trunks.computeBoundingSphere();
    vegetation.add(trunks, canopies);
  }

  const eastFlora = new THREE.Group();
  eastFlora.name = "atlas-east-flora";

  function addEastFlora(variant, canopyGeometries, trunkGeometry) {
    const variantRecords = records[variant];
    if (variantRecords.length === 0) return;
    const definition = EAST_FLORA_MESHES[variant];
    const canopyMaterial = new THREE.MeshStandardMaterial({
      color: definition.canopyColor,
      roughness: 0.94,
      flatShading: true,
    });
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: definition.trunkColor,
      roughness: 1,
      flatShading: true,
    });
    const canopyMeshes = canopyGeometries.map((geometry, layer) => {
      const mesh = new THREE.InstancedMesh(geometry, canopyMaterial, variantRecords.length);
      mesh.name = `atlas-${variant}-canopies-${layer}`;
      return mesh;
    });
    const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, variantRecords.length);
    trunks.name = `atlas-${variant}-trunks`;

    for (const [instance, record] of variantRecords.entries()) {
      const scale = record.scale * (0.96 + record.colorFactor * 0.12);
      transform.position.set(record.x, record.groundHeight + 0.06, record.z);
      transform.rotation.set(0, record.rotation, 0);
      transform.scale.setScalar(scale);
      transform.updateMatrix();
      trunks.setMatrixAt(instance, transform.matrix);
      for (const canopy of canopyMeshes) canopy.setMatrixAt(instance, transform.matrix);
    }
    trunks.instanceMatrix.needsUpdate = true;
    trunks.computeBoundingSphere();
    for (const canopy of canopyMeshes) {
      canopy.instanceMatrix.needsUpdate = true;
      canopy.computeBoundingSphere();
    }
    eastFlora.add(trunks, ...canopyMeshes);
  }

  const cherryCanopy = new THREE.SphereGeometry(0.9, 5, 4);
  cherryCanopy.scale(1, 0.65, 1);
  cherryCanopy.translate(0, 1.62, 0);
  const cherryTrunk = new THREE.CylinderGeometry(0.08, 0.12, 1.1, 5);
  cherryTrunk.translate(0, 0.55, 0);
  addEastFlora("cherry", [cherryCanopy], cherryTrunk);

  const ginkgoLower = new THREE.ConeGeometry(0.7, 1.2, 5);
  ginkgoLower.translate(0, 1.22, 0);
  const ginkgoUpper = new THREE.ConeGeometry(0.7, 1.2, 5);
  ginkgoUpper.translate(0, 1.86, 0);
  const ginkgoTrunk = new THREE.CylinderGeometry(0.11, 0.17, 1.25, 5);
  ginkgoTrunk.translate(0, 0.625, 0);
  addEastFlora("ginkgo", [ginkgoLower, ginkgoUpper], ginkgoTrunk);

  vegetation.add(eastFlora);
  vegetation.userData.treeCounts = {
    total: records.standard.length + records.cherry.length + records.ginkgo.length,
    cherry: records.cherry.length,
    ginkgo: records.ginkgo.length,
  };
  return vegetation;
}

export function createLandmarkMeshGroup(THREE, seed) {
  const group = new THREE.Group();
  group.name = "atlas-landmarks";

  const matStone     = new THREE.MeshStandardMaterial({ color: 0x887a6c, roughness: 0.92, metalness: 0 });
  const matDarkStone = new THREE.MeshStandardMaterial({ color: 0x554a40, roughness: 0.92, metalness: 0 });
  const matRoof      = new THREE.MeshStandardMaterial({ color: 0x2e2820, roughness: 0.86, metalness: 0 });
  const matGold      = new THREE.MeshStandardMaterial({ color: 0x9a8030, roughness: 0.62, metalness: 0.22 });
  const matIvory     = new THREE.MeshStandardMaterial({ color: 0xd0c8b0, roughness: 0.85, metalness: 0 });
  const matDock      = new THREE.MeshStandardMaterial({ color: 0x3a2c18, roughness: 0.95, metalness: 0 });
  const matMarket    = new THREE.MeshStandardMaterial({ color: 0xa89070, roughness: 1, metalness: 0, side: THREE.DoubleSide });
  const matPagodaWood = new THREE.MeshStandardMaterial({ color: 0x2e2010, roughness: 0.9, metalness: 0 });
  const matPagodaGold = new THREE.MeshStandardMaterial({ color: 0x8a7030, roughness: 0.62, metalness: 0.18 });
  const realmMaterials = Object.fromEntries(Object.entries(REALM_SETTLEMENT_COLORS).map(([realmId, colors]) => [
    realmId,
    {
      stone: realmId === "central" ? matStone : new THREE.MeshStandardMaterial({ color: colors.stone, roughness: 0.92, metalness: 0 }),
      darkStone: realmId === "central" ? matDarkStone : new THREE.MeshStandardMaterial({ color: colors.darkStone, roughness: 0.92, metalness: 0 }),
      roof: realmId === "central" ? matRoof : new THREE.MeshStandardMaterial({ color: colors.roof, roughness: 0.86, metalness: 0 }),
    },
  ]));

  function piece(geo, mat, x, y, z, ry = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    return m;
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
    return g;
  }

  function buildPort(s) {
    const g = new THREE.Group();
    g.add(piece(new THREE.CylinderGeometry(s * 0.52, s * 0.72, s * 6.2, 8), matStone, 0, s * 3.1, 0));
    g.add(piece(new THREE.ConeGeometry(s * 0.78, s * 1.5, 8), matRoof, 0, s * 7.35, 0));
    g.add(piece(new THREE.SphereGeometry(s * 0.42, 6, 4), matGold, 0, s * 6.4, 0));
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
      case "village":    meshGroup = buildVillage(0.55 * 1.15); break;
      case "tower":      meshGroup = buildTower(0.65); break;
      case "ruin":       meshGroup = buildRuin(0.52); break;
      default:           continue;
    }
    applyRealmSettlementMaterials(meshGroup, landmark);
    const scenePos = atlas3dAxialToScene(coord);
    const groundHeight = atlas3dTerrainHeightAt(coord, seed);
    const scaleJitter = 0.85 + coordinateNoise(coord.x, coord.y, landmark.id) * 0.3;
    meshGroup.scale.setScalar(scaleJitter);
    meshGroup.name = `atlas-landmark-${landmark.id}`;
    meshGroup.userData.landmarkKind = kind;
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

function createController(THREE, canvas, seed) {
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
  );
  renderer.setPixelRatio(initialPixelRatio);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e2836);
  scene.fog = new THREE.FogExp2(0x1a3c4a, 0.00016);
  const camera = new THREE.PerspectiveCamera(ATLAS_3D_FOV_DEG, 1, 0.1, 6000);
  const queryCamera = new THREE.PerspectiveCamera(ATLAS_3D_FOV_DEG, 1, 0.1, 6000);
  const raycaster = new THREE.Raycaster();

  scene.add(new THREE.HemisphereLight(0xd0e4e0, 0x201808, 1.5));
  const sun = new THREE.DirectionalLight(0xffe8b0, 1.85);
  sun.position.set(-360, 580, 300);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x7ab8d4, 0.42);
  fill.position.set(300, 220, -480);
  scene.add(fill);
  const valleyBounce = new THREE.DirectionalLight(0x102828, 0.12);
  valleyBounce.position.set(0, -1, 0);
  scene.add(valleyBounce);

  const waterGeometry = new THREE.PlaneGeometry(WATER_PLANE_SIZE, WATER_PLANE_SIZE);
  waterGeometry.rotateX(-Math.PI / 2);
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a5060,
    roughness: 0.15,
    metalness: 0.12,
    side: THREE.DoubleSide,
  });
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.position.set(
    (ATLAS_3D_BOUNDS.xmin + ATLAS_3D_BOUNDS.xmax) / 2,
    -1.55,
    (ATLAS_3D_BOUNDS.zmin + ATLAS_3D_BOUNDS.zmax) / 2,
  );
  water.name = "atlas-sea";
  scene.add(water);

  let terrain = null;
  let vegetation = null;
  let landmarks = null;
  let mountainClouds = null;
  let hotSprings = null;
  let routes = new THREE.Group();
  routes.name = "atlas-routes";
  let journey = new THREE.Group();
  let seenTrail = new THREE.Group();
  let renderWidth = 0;
  let renderHeight = 0;
  let renderPixelRatio = initialPixelRatio;
  scene.add(routes, journey, seenTrail);

  function render() {
    hotSprings?.traverse?.((child) => {
      if (child.userData?.billboard) child.quaternion.copy(camera.quaternion);
    });
    renderer.render(scene, camera);
    canvas.dataset.atlasRenderer = "webgl2";
    canvas.dataset.atlasDrawCalls = String(renderer.info.render.calls);
    canvas.dataset.atlasTriangles = String(renderer.info.render.triangles);
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
    const nextPixelRatio = atlasRenderPixelRatio(widthPx, heightPx);
    const sizeChanged = widthPx !== renderWidth || heightPx !== renderHeight;
    const pixelRatioChanged = nextPixelRatio !== renderPixelRatio;
    if (pixelRatioChanged) {
      renderer.setPixelRatio(nextPixelRatio);
      renderPixelRatio = nextPixelRatio;
    }
    if (sizeChanged || pixelRatioChanged) {
      renderer.setSize(widthPx, heightPx, false);
      renderWidth = widthPx;
      renderHeight = heightPx;
    }
    configureCamera(camera, modelCamera, viewport);
    render();
  }

  function setTerrain(data, renderNow = true) {
    if (terrain) {
      scene.remove(terrain);
      disposeObject(terrain);
    }
    if (vegetation) {
      scene.remove(vegetation);
      disposeObject(vegetation);
    }
    if (mountainClouds) {
      scene.remove(mountainClouds);
      disposeObject(mountainClouds);
    }
    if (hotSprings) {
      scene.remove(hotSprings);
      disposeObject(hotSprings);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(data.colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.86,
      metalness: 0.02,
    });
    terrain = new THREE.Mesh(geometry, material);
    terrain.name = "atlas-terrain";
    scene.add(terrain);

    mountainClouds = createMountainClouds(THREE, seed);
    scene.add(mountainClouds);
    canvas.dataset.atlasMountainClouds = String(mountainClouds.children.length);

    hotSprings = createHotSprings(THREE, seed);
    scene.add(hotSprings);
    canvas.dataset.atlasHotSprings = String(CONTINENT_HOT_SPRINGS.length);
    canvas.dataset.atlasLakes = String(CONTINENT_LAKES.length);

    vegetation = createVegetationGroup(THREE, data.trees, seed);
    scene.add(vegetation);
    const treeCounts = vegetation.userData.treeCounts || {};
    canvas.dataset.atlasTerrainVertices = String(data.positions.length / 3);
    canvas.dataset.atlasTrees = String(treeCounts.total || 0);
    canvas.dataset.atlasCherryTrees = String(treeCounts.cherry || 0);
    canvas.dataset.atlasGinkgoTrees = String(treeCounts.ginkgo || 0);

    // Landmark 3D meshes are created after terrain heights are cached.
    if (landmarks) { scene.remove(landmarks); disposeObject(landmarks); }
    landmarks = batchLandmarkMeshGroup(THREE, createLandmarkMeshGroup(THREE, seed));
    scene.add(landmarks);
    canvas.dataset.atlasLandmarkSourceMeshes = String(landmarks.userData.sourceMeshCount || 0);
    canvas.dataset.atlasLandmarkBatches = String(landmarks.userData.batchCount || 0);

    if (renderNow) render();
  }

  function updateRoutes(focusedRealmId, renderNow = true) {
    scene.remove(routes);
    disposeObject(routes);
    routes = createRouteGroup(THREE, seed, focusedRealmId);
    scene.add(routes);
    if (renderNow) render();
  }

  function updateJourney(nextJourney, breaks, renderNow = true) {
    scene.remove(journey);
    disposeObject(journey);
    journey = createJourneyGroup(THREE, seed, nextJourney, breaks);
    scene.add(journey);
    if (renderNow) render();
  }

  function updateSeen(nextSeenKeys, renderNow = true) {
    scene.remove(seenTrail);
    disposeObject(seenTrail);
    seenTrail = createSeenTrail(THREE, nextSeenKeys, seed);
    scene.add(seenTrail);
    canvas.dataset.atlasSeenPoints = String(nextSeenKeys?.length || 0);
    if (renderNow) render();
  }

  function pick(point, viewport, modelCamera = null, includeWater = false) {
    if (!terrain) return null;
    const pickingCamera = modelCamera ? queryCamera : camera;
    if (modelCamera) configureCamera(pickingCamera, modelCamera, viewport);
    const ndc = new THREE.Vector2(
      point.x / Math.max(1, viewport.width) * 2 - 1,
      1 - point.y / Math.max(1, viewport.height) * 2,
    );
    raycaster.setFromCamera(ndc, pickingCamera);
    const hit = includeWater
      ? raycaster.intersectObjects([terrain, water], false)[0]
      : raycaster.intersectObject(terrain, false)[0];
    if (!hit) return null;
    const scenePoint = { x: hit.point.x, z: hit.point.z };
    return {
      ...atlas3dSceneToAxial(scenePoint),
      scene: scenePoint,
      height: hit.point.y,
    };
  }

  function dispose() {
    disposeObject(scene);
    renderer.dispose();
  }

  return { renderer, updateCamera, updateJourney, updateRoutes, updateSeen, setTerrain, pick, render, dispose };
}

export const WorldAtlas3DScene = forwardRef(function WorldAtlas3DScene({
  camera,
  viewport,
  seed = CONTINENT.seed,
  focusedRealmId = null,
  journey = null,
  journeyBreaks = [],
  seenKeys = [],
  onReady,
  onError,
}, ref) {
  const canvasRef = useRef(null);
  const controllerRef = useRef(null);
  const cameraRef = useRef(camera);
  const viewportRef = useRef(viewport);
  const readyRef = useRef(onReady);
  const errorRef = useRef(onError);
  const focusRef = useRef(focusedRealmId);
  const journeyRef = useRef(journey);
  const breaksRef = useRef(journeyBreaks);
  const seenRef = useRef(seenKeys);

  cameraRef.current = camera;
  viewportRef.current = viewport;
  readyRef.current = onReady;
  errorRef.current = onError;
  focusRef.current = focusedRealmId;
  journeyRef.current = journey;
  breaksRef.current = journeyBreaks;
  seenRef.current = seenKeys;

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
      errorRef.current?.("The graphics context was interrupted. The atlas will resume when it is restored.");
    };
    const handleRestored = () => {
      if (restoreFrame) cancelAnimationFrame(restoreFrame);
      restoreFrame = requestAnimationFrame(() => {
        restoreFrame = 0;
        if (disposed) return;
        contextLost = false;
        controller?.render();
        if (terrainReady) readyRef.current?.();
      });
    };

    (async () => {
      try {
        const { THREE, terrain } = await getWorldAtlas3dRuntime(seed);
        if (disposed) return;
        controller = createController(THREE, canvas, seed);
        // Three registers its own context restoration handlers during renderer
        // construction. Register ours afterward so readiness returns only after
        // Three has recreated GPU resources and drawn a fresh frame.
        canvas.addEventListener("webglcontextlost", handleLost, false);
        canvas.addEventListener("webglcontextrestored", handleRestored, false);
        listenersAttached = true;
        controllerRef.current = controller;
        // Static and dynamic geometry are attached without presenting partial
        // frames. The camera update below publishes one complete first frame.
        controller.setTerrain(terrain, false);
        controller.updateRoutes(focusRef.current, false);
        controller.updateJourney(journeyRef.current, breaksRef.current, false);
        controller.updateSeen(seenRef.current, false);
        terrainReady = true;
        controller.updateCamera(cameraRef.current, viewportRef.current);
        if (!contextLost) readyRef.current?.();
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
  }, [seed]);

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

  return <canvas ref={canvasRef} className="world-atlas__webgl" aria-hidden="true" />;
});
