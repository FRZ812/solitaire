import { CONTINENT } from "../../data/continent.js";
import {
  ATLAS_3D_RENDER_VERSION,
  ATLAS_3D_TERRAIN_STRIDE,
  registerAtlas3dTerrainData,
} from "./worldAtlas3dModel.js";

const runtimePromises = new Map();
const TERRAIN_WORKER_TIMEOUT_MS = 20_000;
const FINE_TERRAIN_WORKER_TIMEOUT_MS = 45_000;

function runtimeKey(seed, stride) {
  return `${ATLAS_3D_RENDER_VERSION}|${seed}|${stride}`;
}

function buildTerrainInWorker(seed, stride) {
  // Terrain generation is deliberately worker-only. Falling back to the main
  // thread here would freeze auth/title rendering for more than a second on
  // slower devices, which defeats the purpose of warming the renderer early.
  if (typeof Worker === "undefined") {
    return Promise.reject(new Error("The 3D atlas terrain worker is unavailable."));
  }

  return new Promise((resolve, reject) => {
    let worker = null;
    let settled = false;
    let timeoutId = 0;

    const fail = (event) => {
      if (settled) return;
      event?.preventDefault?.();
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      worker?.terminate();
      reject(new Error("The 3D atlas terrain worker could not start."));
    };

    try {
      worker = new Worker(new URL("./worldAtlasTerrain.worker.js", import.meta.url), { type: "module" });
      worker.onmessage = (event) => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        worker?.terminate();
        resolve(event.data);
      };
      worker.onerror = fail;
      worker.onmessageerror = fail;
      worker.postMessage({ seed, stride });
      // The stride-2 refinement is intentionally progressive and takes about
      // 17 seconds on the reference desktop. Give slower high-tier machines
      // enough headroom without making the coarse first-paint worker wait
      // longer when it genuinely stalls.
      const timeoutMs = stride < ATLAS_3D_TERRAIN_STRIDE
        ? FINE_TERRAIN_WORKER_TIMEOUT_MS
        : TERRAIN_WORKER_TIMEOUT_MS;
      timeoutId = setTimeout(fail, timeoutMs);
    } catch {
      fail();
    }
  });
}

/**
 * Warm the complete 3D atlas runtime and deterministic terrain payload.
 *
 * Both jobs begin before either is awaited. The returned promise is stable for
 * one renderer-version/seed/stride tuple, so opening and reopening the atlas
 * reuses both the imported Three module and the transferred typed arrays.
 */
export function preloadWorldAtlas3d(
  seed = CONTINENT.seed,
  stride = ATLAS_3D_TERRAIN_STRIDE,
) {
  const key = runtimeKey(seed, stride);
  const existing = runtimePromises.get(key);
  if (existing) return existing;

  const threePromise = import("three");
  const terrainPromise = buildTerrainInWorker(seed, stride);
  const runtimePromise = Promise.all([threePromise, terrainPromise])
    .then(([THREE, terrain]) => {
      if (terrain?.seed !== seed
        || terrain?.stride !== stride
        || !registerAtlas3dTerrainData(terrain)) {
        throw new Error("The 3D atlas terrain worker returned invalid data.");
      }
      return { THREE, terrain };
    });

  runtimePromises.set(key, runtimePromise);
  runtimePromise.catch(() => {
    if (runtimePromises.get(key) === runtimePromise) runtimePromises.delete(key);
  });
  return runtimePromise;
}

export function getWorldAtlas3dRuntime(
  seed = CONTINENT.seed,
  stride = ATLAS_3D_TERRAIN_STRIDE,
) {
  return preloadWorldAtlas3d(seed, stride);
}
