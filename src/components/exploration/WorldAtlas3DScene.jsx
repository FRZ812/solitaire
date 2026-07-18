import React, { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";
import {
  CONTINENT,
  CONTINENT_LAKES,
  CONTINENT_ROUTES,
  CONTINENT_SEA_LANES,
  CONTINENT_WATERWAYS,
} from "../../data/continent.js";
import {
  ATLAS_3D_BOUNDS,
  ATLAS_3D_FOV_DEG,
  atlas3dAxialToScene,
  atlas3dCameraFrame,
  atlas3dSceneToAxial,
  atlas3dTerrainHeightAt,
} from "./worldAtlas3dModel.js";
import { getWorldAtlas3dRuntime } from "./worldAtlas3dRuntime.js";

const ROUTE_HEIGHT_BIAS = 0.72;
// Keep the ocean beneath the entire perspective frustum. Plane geometry has a
// fixed two-triangle cost, so a horizon-sized surface is no heavier than a
// continent-sized one and avoids exposing a rectangular edge on tall screens.
const WATER_PLANE_SIZE = 20_000;
const MOBILE_RENDER_PIXEL_BUDGET = 900000;
const DESKTOP_RENDER_PIXEL_BUDGET = 1800000;
const heightCache = new Map();
const useAtlas3dLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

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

function densifyPath(path, step = 12) {
  if (!path || path.length < 2) return path || [];
  const result = [];
  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index];
    const to = path[index + 1];
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const segments = Math.max(1, Math.ceil(distance / step));
    for (let segment = 0; segment < segments; segment += 1) {
      const mix = segment / segments;
      result.push({
        x: from.x + (to.x - from.x) * mix,
        y: from.y + (to.y - from.y) * mix,
      });
    }
  }
  result.push(path.at(-1));
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

function createRibbonMesh(THREE, path, {
  seed,
  width,
  color,
  opacity = 1,
  water = false,
  heightBias = ROUTE_HEIGHT_BIAS,
  step = 12,
}) {
  const points = densifyPath(path, step);
  if (points.length < 2) return null;
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
    const normalX = -tangentZ / length * width / 2;
    const normalZ = tangentX / length * width / 2;
    const center = atlas3dAxialToScene(points[index]);
    const leftCoord = atlas3dSceneToAxial({ x: center.x + normalX, z: center.z + normalZ });
    const rightCoord = atlas3dSceneToAxial({ x: center.x - normalX, z: center.z - normalZ });
    const leftHeight = water ? -1.22 : cachedHeight(leftCoord, seed) + heightBias;
    const rightHeight = water ? -1.22 : cachedHeight(rightCoord, seed) + heightBias;
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
  return new THREE.Mesh(geometry, material);
}

function createRouteGroup(THREE, seed, focusedRealmId) {
  const group = new THREE.Group();
  group.name = "atlas-routes";

  for (const river of CONTINENT_WATERWAYS) {
    const ribbon = createRibbonMesh(THREE, river.waypoints, {
      seed,
      width: 1.9,
      color: 0x65bfd2,
      opacity: 0.82,
      heightBias: 0.45,
      step: 5,
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
      step: 12,
    });
    if (ribbon) group.add(ribbon);
  }

  for (const route of CONTINENT_ROUTES) {
    const muted = focusedRealmId && !route.realmIds?.includes(focusedRealmId);
    const regional = route.kind === "regional-road";
    const ribbon = createRibbonMesh(THREE, route.waypoints, {
      seed,
      width: regional ? 1.05 : 1.75,
      color: regional ? 0xc6a66b : 0xe7bd6f,
      opacity: muted ? 0.1 : regional ? 0.55 : 0.84,
      step: 5,
    });
    if (ribbon) group.add(ribbon);
  }

  for (const lake of CONTINENT_LAKES) {
    const center = atlas3dAxialToScene(lake.center);
    const geometry = new THREE.CircleGeometry(Math.max(2, lake.radius * 0.9), 28);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({
      color: 0x327c99,
      roughness: 0.48,
      metalness: 0.08,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(center.x, cachedHeight(lake.center, seed) + 0.62, center.z);
    group.add(mesh);
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
      seed, width: 4.4, color: 0x17110d, opacity: 0.72, step: 5, heightBias: 1.05,
    });
    const ribbon = createRibbonMesh(THREE, continuation, {
      seed, width: 1.45, color: 0xe6c675, opacity: 0.58, step: 5, heightBias: 1.13,
    });
    if (halo) group.add(halo);
    if (ribbon) group.add(ribbon);
  }
  if (current.length > 1) {
    const halo = createRibbonMesh(THREE, current, {
      seed, width: 6.2, color: 0x15100d, opacity: 0.86, step: 4, heightBias: 1.18,
    });
    const ribbon = createRibbonMesh(THREE, current, {
      seed, width: 2.65, color: 0xffdf70, opacity: 1, step: 4, heightBias: 1.28,
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
  renderer.toneMappingExposure = 0.86;
  const initialPixelRatio = atlasRenderPixelRatio(
    Math.max(1, canvas.clientWidth || window.innerWidth || 1),
    Math.max(1, canvas.clientHeight || window.innerHeight || 1),
  );
  renderer.setPixelRatio(initialPixelRatio);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x174452);
  scene.fog = new THREE.FogExp2(0x214f5a, 0.00014);
  const camera = new THREE.PerspectiveCamera(ATLAS_3D_FOV_DEG, 1, 0.1, 6000);
  const queryCamera = new THREE.PerspectiveCamera(ATLAS_3D_FOV_DEG, 1, 0.1, 6000);
  const raycaster = new THREE.Raycaster();

  scene.add(new THREE.HemisphereLight(0xcfe6e8, 0x20281d, 1.22));
  const sun = new THREE.DirectionalLight(0xffd59a, 1.48);
  sun.position.set(-420, 620, 360);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x6ba7bf, 0.28);
  fill.position.set(380, 260, -520);
  scene.add(fill);

  const waterGeometry = new THREE.PlaneGeometry(WATER_PLANE_SIZE, WATER_PLANE_SIZE);
  waterGeometry.rotateX(-Math.PI / 2);
  const waterMaterial = new THREE.MeshBasicMaterial({
    color: 0x318096,
    side: THREE.DoubleSide,
    toneMapped: false,
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
  let routes = new THREE.Group();
  routes.name = "atlas-routes";
  let journey = new THREE.Group();
  let seenTrail = new THREE.Group();
  let renderWidth = 0;
  let renderHeight = 0;
  let renderPixelRatio = initialPixelRatio;
  scene.add(routes, journey, seenTrail);

  function render() {
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

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(data.colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
    geometry.computeBoundingSphere();
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0,
      flatShading: true,
    });
    terrain = new THREE.Mesh(geometry, material);
    terrain.name = "atlas-terrain";
    scene.add(terrain);

    const treeCount = Math.floor(data.trees.length / 6);
    canvas.dataset.atlasTerrainVertices = String(data.positions.length / 3);
    canvas.dataset.atlasTrees = String(treeCount);
    vegetation = new THREE.Group();
    vegetation.name = "atlas-vegetation";
    if (treeCount > 0) {
      const canopyGeometry = new THREE.ConeGeometry(2.05, 5.2, 5, 1);
      canopyGeometry.translate(0, 2.6, 0);
      const trunkGeometry = new THREE.CylinderGeometry(0.23, 0.35, 1.5, 5);
      trunkGeometry.translate(0, 0.75, 0);
      const canopyMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
      const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4f3c29, roughness: 1, flatShading: true });
      const canopies = new THREE.InstancedMesh(canopyGeometry, canopyMaterial, treeCount);
      const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, treeCount);
      const transform = new THREE.Object3D();
      const tint = new THREE.Color();
      for (let index = 0; index < treeCount; index += 1) {
        const offset = index * 6;
        const scale = data.trees[offset + 3];
        transform.position.set(data.trees[offset], data.trees[offset + 1] + 0.06, data.trees[offset + 2]);
        transform.rotation.set(0, data.trees[offset + 4], 0);
        transform.scale.set(scale, scale * (0.92 + data.trees[offset + 5] * 0.12), scale);
        transform.updateMatrix();
        canopies.setMatrixAt(index, transform.matrix);
        trunks.setMatrixAt(index, transform.matrix);
        tint.set(0x4f8a5b).multiplyScalar(data.trees[offset + 5]);
        canopies.setColorAt(index, tint);
      }
      canopies.instanceMatrix.needsUpdate = true;
      trunks.instanceMatrix.needsUpdate = true;
      if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
      canopies.computeBoundingSphere();
      trunks.computeBoundingSphere();
      vegetation.add(trunks, canopies);
    }
    scene.add(vegetation);
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
