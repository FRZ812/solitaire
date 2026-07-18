import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
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
  ATLAS_3D_TERRAIN_STRIDE,
  atlas3dAxialToScene,
  atlas3dCameraFrame,
  atlas3dSceneToAxial,
  atlas3dTerrainHeightAt,
  buildAtlas3dTerrainData,
} from "./worldAtlas3dModel.js";

const ROUTE_HEIGHT_BIAS = 0.72;
const heightCache = new Map();

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
    const height = water ? -1.22 : cachedHeight(points[index], seed) + heightBias;
    const offset = index * 6;
    positions[offset] = center.x + normalX;
    positions[offset + 1] = height;
    positions[offset + 2] = center.z + normalZ;
    positions[offset + 3] = center.x - normalX;
    positions[offset + 4] = height;
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
      step: 9,
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
      step: regional ? 10 : 7,
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
  renderer.toneMappingExposure = 1.08;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 720 ? 1.35 : 1.8));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x102a36);
  scene.fog = new THREE.FogExp2(0x17333d, 0.00034);
  const camera = new THREE.PerspectiveCamera(ATLAS_3D_FOV_DEG, 1, 0.1, 6000);
  const raycaster = new THREE.Raycaster();

  scene.add(new THREE.HemisphereLight(0xd8edf0, 0x263121, 2.15));
  const sun = new THREE.DirectionalLight(0xffd79b, 2.6);
  sun.position.set(-420, 620, 360);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x6ba7bf, 0.65);
  fill.position.set(380, 260, -520);
  scene.add(fill);

  const width = ATLAS_3D_BOUNDS.xmax - ATLAS_3D_BOUNDS.xmin;
  const depth = ATLAS_3D_BOUNDS.zmax - ATLAS_3D_BOUNDS.zmin;
  const waterGeometry = new THREE.PlaneGeometry(width * 1.35, depth * 1.45);
  waterGeometry.rotateX(-Math.PI / 2);
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x17495b,
    roughness: 0.42,
    metalness: 0.14,
  });
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.position.set(
    (ATLAS_3D_BOUNDS.xmin + ATLAS_3D_BOUNDS.xmax) / 2,
    -1.55,
    (ATLAS_3D_BOUNDS.zmin + ATLAS_3D_BOUNDS.zmax) / 2,
  );
  scene.add(water);

  let terrain = null;
  let vegetation = null;
  let routes = createRouteGroup(THREE, seed, null);
  let journey = new THREE.Group();
  scene.add(routes, journey);

  function render() {
    renderer.render(scene, camera);
  }

  function updateCamera(modelCamera, viewport) {
    const widthPx = Math.max(1, viewport.width);
    const heightPx = Math.max(1, viewport.height);
    renderer.setSize(widthPx, heightPx, false);
    camera.aspect = widthPx / heightPx;
    const frame = atlas3dCameraFrame(modelCamera, viewport);
    camera.position.set(frame.position.x, frame.position.y, frame.position.z);
    camera.near = Math.max(0.1, frame.distance / 1800);
    camera.far = Math.max(2600, frame.distance + 2600);
    camera.lookAt(frame.target.x, 0, frame.target.z);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    render();
  }

  function setTerrain(data) {
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
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0,
      flatShading: true,
      side: THREE.DoubleSide,
    });
    terrain = new THREE.Mesh(geometry, material);
    terrain.name = "atlas-terrain";
    scene.add(terrain);

    const treeCount = Math.floor(data.trees.length / 6);
    vegetation = new THREE.Group();
    vegetation.name = "atlas-vegetation";
    if (treeCount > 0) {
      const canopyGeometry = new THREE.ConeGeometry(1.55, 4.5, 5, 1);
      canopyGeometry.translate(0, 2.25, 0);
      const trunkGeometry = new THREE.CylinderGeometry(0.23, 0.35, 1.5, 5);
      trunkGeometry.translate(0, 0.75, 0);
      const canopyMaterial = new THREE.MeshStandardMaterial({ color: 0x3d704a, roughness: 1, flatShading: true });
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
        tint.set(0x3d704a).multiplyScalar(data.trees[offset + 5]);
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
    render();
  }

  function updateRoutes(focusedRealmId) {
    scene.remove(routes);
    disposeObject(routes);
    routes = createRouteGroup(THREE, seed, focusedRealmId);
    scene.add(routes);
    render();
  }

  function updateJourney(nextJourney, breaks) {
    scene.remove(journey);
    disposeObject(journey);
    journey = createJourneyGroup(THREE, seed, nextJourney, breaks);
    scene.add(journey);
    render();
  }

  function pick(point, viewport) {
    if (!terrain) return null;
    const ndc = new THREE.Vector2(
      point.x / Math.max(1, viewport.width) * 2 - 1,
      1 - point.y / Math.max(1, viewport.height) * 2,
    );
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(terrain, false)[0];
    return hit ? atlas3dSceneToAxial({ x: hit.point.x, z: hit.point.z }) : null;
  }

  function dispose() {
    disposeObject(scene);
    renderer.dispose();
  }

  return { renderer, updateCamera, updateJourney, updateRoutes, setTerrain, pick, render, dispose };
}

export const WorldAtlas3DScene = forwardRef(function WorldAtlas3DScene({
  camera,
  viewport,
  seed = CONTINENT.seed,
  focusedRealmId = null,
  journey = null,
  journeyBreaks = [],
  onReady,
  onFallback,
}, ref) {
  const canvasRef = useRef(null);
  const controllerRef = useRef(null);
  const cameraRef = useRef(camera);
  const viewportRef = useRef(viewport);
  const readyRef = useRef(onReady);
  const fallbackRef = useRef(onFallback);
  const focusRef = useRef(focusedRealmId);
  const journeyRef = useRef(journey);
  const breaksRef = useRef(journeyBreaks);

  cameraRef.current = camera;
  viewportRef.current = viewport;
  readyRef.current = onReady;
  fallbackRef.current = onFallback;
  focusRef.current = focusedRealmId;
  journeyRef.current = journey;
  breaksRef.current = journeyBreaks;

  useImperativeHandle(ref, () => ({
    pick(point) {
      return controllerRef.current?.pick(point, viewportRef.current) || null;
    },
  }), []);

  useEffect(() => {
    let disposed = false;
    let worker = null;
    let controller = null;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const handleLost = (event) => {
      event.preventDefault();
      fallbackRef.current?.("The 3D map paused after its graphics context was lost.");
    };
    const handleRestored = () => {
      controller?.render();
      readyRef.current?.();
    };
    canvas.addEventListener("webglcontextlost", handleLost, false);
    canvas.addEventListener("webglcontextrestored", handleRestored, false);

    (async () => {
      try {
        const THREE = await import("three");
        if (disposed) return;
        controller = createController(THREE, canvas, seed);
        controllerRef.current = controller;
        controller.updateCamera(cameraRef.current, viewportRef.current);
        controller.updateRoutes(focusRef.current);
        controller.updateJourney(journeyRef.current, breaksRef.current);

        const publishTerrain = (terrain) => {
          if (disposed) return;
          controller.setTerrain(terrain);
          controller.updateCamera(cameraRef.current, viewportRef.current);
          readyRef.current?.();
        };

        if (typeof Worker !== "undefined") {
          worker = new Worker(new URL("./worldAtlasTerrain.worker.js", import.meta.url), { type: "module" });
          worker.onmessage = (event) => publishTerrain(event.data);
          worker.onerror = () => {
            worker?.terminate();
            worker = null;
            setTimeout(() => publishTerrain(buildAtlas3dTerrainData(seed, ATLAS_3D_TERRAIN_STRIDE)), 0);
          };
          worker.postMessage({ seed, stride: ATLAS_3D_TERRAIN_STRIDE });
        } else {
          setTimeout(() => publishTerrain(buildAtlas3dTerrainData(seed, ATLAS_3D_TERRAIN_STRIDE)), 0);
        }
      } catch (error) {
        if (!disposed) fallbackRef.current?.(error?.message || "The 3D map could not start.");
      }
    })();

    return () => {
      disposed = true;
      worker?.terminate();
      controllerRef.current = null;
      controller?.dispose();
      canvas.removeEventListener("webglcontextlost", handleLost);
      canvas.removeEventListener("webglcontextrestored", handleRestored);
    };
  }, [seed]);

  useEffect(() => {
    controllerRef.current?.updateCamera(camera, viewport);
  }, [camera, viewport]);

  useEffect(() => {
    controllerRef.current?.updateRoutes(focusedRealmId);
  }, [focusedRealmId]);

  useEffect(() => {
    controllerRef.current?.updateJourney(journey, journeyBreaks);
  }, [journey, journeyBreaks]);

  return <canvas ref={canvasRef} className="world-atlas__webgl" aria-hidden="true" />;
});
