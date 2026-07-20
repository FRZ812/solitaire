import { CONTINENT } from "../../data/continent.js";
import {
  ATLAS_3D_CHUNK_SIZE,
  ATLAS_3D_ENVIRON_RECORD_STRIDE,
  ATLAS_3D_FIELD_RECORD_STRIDE,
  ATLAS_3D_RENDER_VERSION,
  ATLAS_3D_ROCK_RECORD_STRIDE,
  ATLAS_3D_TREE_RECORD_STRIDE,
  atlas3dChunkKey,
  registerAtlas3dChunkHeights,
  releaseAtlas3dChunkHeights,
} from "./worldAtlas3dModel.js";

export const ATLAS_TERRAIN_REQUEST_TIMEOUT_MS = 10_000;
export const ATLAS_TERRAIN_CHUNK_CACHE_LIMIT = 96;
const runtimePromises = new Map();
const terrainClients = new Map();

function runtimeKey(seed) {
  return `${ATLAS_3D_RENDER_VERSION}|${seed}`;
}

function chunkRequestKey(cx, cy, lod) {
  return `${atlas3dChunkKey(cx, cy)}|${lod}`;
}

function validLod(lod) {
  return Number.isInteger(lod) && (lod === 0 || lod === 1);
}

function validFloatRecords(value, recordStride) {
  return value instanceof Float32Array && value.length % recordStride === 0;
}

function validChunkArrays(payload) {
  const stride = payload.lod === 0 ? 1 : 2;
  const typedArrays = [
    payload.heights,
    payload.positions,
    payload.colors,
    payload.coastal,
    payload.ao,
    payload.shore,
    payload.indices,
    payload.trees,
    payload.rocks,
    payload.fields,
    payload.environs,
  ];
  if (payload.span !== ATLAS_3D_CHUNK_SIZE
    || typeof payload.empty !== "boolean"
    || payload.stride !== stride
    || !Number.isFinite(payload.skirtDepth)
    || payload.skirtDepth <= 0
    || !Number.isFinite(payload.buildMs)
    || payload.buildMs < 0
    || !payload.origin
    || payload.origin.x !== payload.cx * ATLAS_3D_CHUNK_SIZE
    || payload.origin.y !== payload.cy * ATLAS_3D_CHUNK_SIZE
    || !(payload.heights instanceof Float32Array)
    || !(payload.positions instanceof Float32Array)
    || !(payload.colors instanceof Float32Array)
    || !(payload.coastal instanceof Uint8Array)
    || !(payload.ao instanceof Uint8Array)
    || !(payload.shore instanceof Uint8Array)
    || !(payload.indices instanceof Uint32Array)
    || !validFloatRecords(payload.trees, ATLAS_3D_TREE_RECORD_STRIDE)
    || !validFloatRecords(payload.rocks, ATLAS_3D_ROCK_RECORD_STRIDE)
    || !validFloatRecords(payload.fields, ATLAS_3D_FIELD_RECORD_STRIDE)
    || !validFloatRecords(payload.environs, ATLAS_3D_ENVIRON_RECORD_STRIDE)) return false;

  if (payload.empty) {
    return payload.columns === 0
      && payload.rows === 0
      && payload.surfaceVertexCount === 0
      && payload.skirtVertexOffset === 0
      && payload.skirtVertexCount === 0
      && typedArrays.every((value) => value.length === 0);
  }

  const columns = ATLAS_3D_CHUNK_SIZE / stride + 1;
  const rows = columns;
  const surfaceVertexCount = columns * rows;
  const skirtVertexCount = 2 * (columns + rows - 2);
  const vertexCount = surfaceVertexCount + skirtVertexCount;
  const surfaceIndexCount = (columns - 1) * (rows - 1) * 6;
  return payload.stride === stride
    && payload.columns === columns
    && payload.rows === rows
    && payload.heights instanceof Float32Array
    && payload.heights.length === (ATLAS_3D_CHUNK_SIZE + 1) ** 2
    && payload.surfaceVertexCount === surfaceVertexCount
    && payload.skirtVertexOffset === surfaceVertexCount
    && payload.skirtVertexCount === skirtVertexCount
    && payload.positions instanceof Float32Array
    && payload.positions.length === vertexCount * 3
    && payload.colors instanceof Float32Array
    && payload.colors.length === vertexCount * 3
    && payload.coastal instanceof Uint8Array
    && payload.coastal.length === vertexCount
    && payload.ao instanceof Uint8Array
    && payload.ao.length === vertexCount
    && payload.shore instanceof Uint8Array
    && payload.shore.length === vertexCount
    && payload.indices instanceof Uint32Array
    && payload.indices.length === surfaceIndexCount + skirtVertexCount * 6;
}

function abortError(message) {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function terrainWorkerError(message = "The 3D atlas terrain worker could not start.") {
  return new Error(message);
}

function createWorker(WorkerClass, useNativeWorker, injectedWorkerUrl) {
  if (typeof WorkerClass !== "function") {
    throw terrainWorkerError("The 3D atlas terrain worker is unavailable.");
  }
  // Keep this exact native construction shape so Vite emits a dedicated
  // worker chunk instead of embedding the terrain generator in the UI bundle.
  if (useNativeWorker) {
    return new Worker(new URL("./worldAtlasTerrain.worker.js", import.meta.url), { type: "module" });
  }
  return new WorkerClass(injectedWorkerUrl || "atlas-terrain-worker:test", { type: "module" });
}

/**
 * Create one persistent, seed-bound terrain worker client. Chunk generation is
 * intentionally worker-only: a synchronous fallback would block auth/title
 * rendering precisely when this runtime is warmed in the background.
 */
export function createAtlasTerrainWorkerClient(seed = CONTINENT.seed, options = {}) {
  const WorkerClass = options.WorkerClass ?? globalThis.Worker;
  const timeoutMs = Number.isFinite(options.timeoutMs)
    ? Math.max(1, options.timeoutMs)
    : ATLAS_TERRAIN_REQUEST_TIMEOUT_MS;
  const worker = createWorker(WorkerClass, options.WorkerClass == null, options.workerUrl);
  const pendingById = new Map();
  const pendingByKey = new Map();
  // The worker client owns a retained-result LRU independently from a scene's
  // desired/presented store. That preserves warm and recently visited chunks
  // across atlas closes without copying their transferred typed arrays.
  const chunkCache = new Map();
  // Height sampling follows what is actually painted, never what happened to
  // finish building most recently. One displayed LOD owns each geographic key.
  const presentedChunks = new Map();
  let requestSequence = 0;
  let disposed = false;
  let initialized = false;
  let chunkCacheLimit = Number.isFinite(options.cacheLimit)
    ? Math.max(1, Math.floor(options.cacheLimit))
    : ATLAS_TERRAIN_CHUNK_CACHE_LIMIT;
  let resolveReady;
  let rejectReady;
  let initTimeoutId = 0;

  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  // A best-effort application preload may discard this client after attaching
  // its own catch. Keep a rejected init promise from becoming a global event.
  ready.catch(() => {});

  function clearRecord(record) {
    if (record.timeoutId) clearTimeout(record.timeoutId);
    pendingById.delete(record.id);
    if (pendingByKey.get(record.key) === record) pendingByKey.delete(record.key);
  }

  function releaseCachedEntry(key, payload) {
    const geoKey = atlas3dChunkKey(payload.cx, payload.cy);
    if (presentedChunks.get(geoKey) === payload) return false;
    chunkCache.delete(key);
    return true;
  }

  function trimChunkCache(protectedPayload = null) {
    if (chunkCache.size <= chunkCacheLimit) return;
    // Presented payloads are pinned. A short-lived overage is preferable to
    // invalidating the height lattice under a visible GPU group.
    for (const [key, payload] of chunkCache) {
      if (chunkCache.size <= chunkCacheLimit) break;
      if (payload === protectedPayload) continue;
      releaseCachedEntry(key, payload);
    }
  }

  function clearRetainedChunks() {
    for (const payload of presentedChunks.values()) {
      releaseAtlas3dChunkHeights(payload);
    }
    presentedChunks.clear();
    chunkCache.clear();
  }

  function cacheChunk(record, payload) {
    const previous = chunkCache.get(record.key);
    if (previous && !releaseCachedEntry(record.key, previous)) return false;
    chunkCache.set(record.key, payload);
    trimChunkCache(payload);
    return true;
  }

  function rejectAll(error) {
    for (const record of [...pendingById.values()]) {
      clearRecord(record);
      record.reject(error);
    }
  }

  function fail(error) {
    if (disposed) return;
    disposed = true;
    if (initTimeoutId) clearTimeout(initTimeoutId);
    if (!initialized) rejectReady(error);
    rejectAll(error);
    clearRetainedChunks();
    worker.terminate?.();
    options.onDispose?.();
  }

  function settleChunk(message) {
    const record = pendingById.get(message.id);
    if (!record) return;
    clearRecord(record);
    const payload = message.chunk ?? message.payload;
    const valid = payload
      && payload.version === ATLAS_3D_RENDER_VERSION
      && payload.seed === seed
      && payload.cx === record.cx
      && payload.cy === record.cy
      && payload.lod === record.lod
      && validChunkArrays(payload);
    if (!valid) {
      record.reject(new Error("The 3D atlas terrain worker returned invalid chunk data."));
      return;
    }
    if (!cacheChunk(record, payload)) {
      record.reject(new Error("The 3D atlas terrain worker could not retain the chunk payload."));
      return;
    }
    record.resolve(payload);
  }

  worker.onmessage = (event) => {
    const message = event?.data || {};
    if (message.type === "ready") {
      if (initialized) return;
      if (message.version !== ATLAS_3D_RENDER_VERSION || message.seed !== seed) {
        fail(terrainWorkerError("The 3D atlas terrain worker returned an invalid initialization response."));
        return;
      }
      initialized = true;
      if (initTimeoutId) clearTimeout(initTimeoutId);
      resolveReady(client);
      return;
    }
    if (message.type === "chunk") {
      settleChunk(message);
      return;
    }
    if (message.type === "error") {
      const record = pendingById.get(message.id);
      if (!record) {
        if (!initialized) fail(terrainWorkerError(message.message));
        return;
      }
      clearRecord(record);
      record.reject(new Error(message.message || "The 3D atlas terrain worker could not build a chunk."));
    }
  };

  const handleWorkerFailure = (event) => {
    event?.preventDefault?.();
    fail(terrainWorkerError());
  };
  worker.onerror = handleWorkerFailure;
  worker.onmessageerror = handleWorkerFailure;

  function postChunk(record) {
    if (disposed || !pendingById.has(record.id)) return;
    record.posted = true;
    worker.postMessage({
      type: "chunk",
      id: record.id,
      cx: record.cx,
      cy: record.cy,
      lod: record.lod,
      priority: record.priority,
    });
    record.timeoutId = setTimeout(() => {
      if (!pendingById.has(record.id)) return;
      clearRecord(record);
      worker.postMessage({ type: "cancel", id: record.id });
      record.reject(new Error(`The 3D atlas terrain chunk ${record.key} timed out.`));
    }, timeoutMs);
  }

  function request(cx, cy, lod = 0, priority = 0) {
    let key;
    try {
      if (!validLod(lod)) throw new RangeError("lod must be 0 or 1");
      key = chunkRequestKey(cx, cy, lod);
    } catch (error) {
      return Promise.reject(error);
    }
    if (disposed) return Promise.reject(abortError("The 3D atlas terrain worker was disposed."));
    const cached = chunkCache.get(key);
    if (cached) {
      // Map insertion order doubles as a small safety LRU for preloaded chunks.
      chunkCache.delete(key);
      chunkCache.set(key, cached);
      return Promise.resolve(cached);
    }
    const existing = pendingByKey.get(key);
    if (existing) return existing.promise;

    const id = `${ATLAS_3D_RENDER_VERSION}:${++requestSequence}`;
    const record = {
      id,
      key,
      cx: Number(cx),
      cy: Number(cy),
      lod,
      priority: Number.isFinite(priority) ? priority : 0,
      posted: false,
      timeoutId: 0,
    };
    record.promise = new Promise((resolve, reject) => {
      record.resolve = resolve;
      record.reject = reject;
    });
    pendingById.set(id, record);
    pendingByKey.set(key, record);
    ready.then(() => postChunk(record)).catch((error) => {
      if (!pendingById.has(record.id)) return;
      clearRecord(record);
      record.reject(error);
    });
    return record.promise;
  }

  function reprioritize(cx, cy, lod = 0, priority = 0) {
    let key;
    try {
      key = chunkRequestKey(cx, cy, lod);
    } catch {
      return false;
    }
    const record = pendingByKey.get(key);
    if (!record || disposed) return false;
    record.priority = Number.isFinite(priority) ? priority : 0;
    // Re-sending the same chunk id updates its queued priority in the worker;
    // it never starts a duplicate build.
    if (record.posted) {
      worker.postMessage({
        type: "chunk",
        id: record.id,
        cx: record.cx,
        cy: record.cy,
        lod: record.lod,
        priority: record.priority,
      });
    }
    return true;
  }

  function cancel(cx, cy, lod = 0) {
    let key;
    try {
      key = chunkRequestKey(cx, cy, lod);
    } catch {
      return false;
    }
    const record = pendingByKey.get(key);
    if (!record) return false;
    clearRecord(record);
    if (record.posted && !disposed) worker.postMessage({ type: "cancel", id: record.id });
    record.reject(abortError(`The 3D atlas terrain chunk ${key} was cancelled.`));
    return true;
  }

  function release(cxOrChunk, cy, lod = 0) {
    const chunk = cxOrChunk && typeof cxOrChunk === "object"
      ? cxOrChunk
      : { cx: cxOrChunk, cy, lod };
    let key;
    try {
      key = chunkRequestKey(chunk.cx, chunk.cy, chunk.lod ?? 0);
    } catch {
      return false;
    }
    const payload = chunkCache.get(key);
    if (!payload) return false;
    return releaseCachedEntry(key, payload);
  }

  function setCacheLimit(limit) {
    if (!Number.isFinite(limit)) return false;
    chunkCacheLimit = Math.max(1, Math.floor(limit));
    trimChunkCache();
    return true;
  }

  function activatePresentation(payload) {
    let key;
    try {
      if (!payload
        || payload.version !== ATLAS_3D_RENDER_VERSION
        || payload.seed !== seed
        || !validLod(payload.lod)
        || !validChunkArrays(payload)) return false;
      key = chunkRequestKey(payload.cx, payload.cy, payload.lod);
    } catch {
      return false;
    }
    if (chunkCache.get(key) !== payload) return false;
    chunkCache.delete(key);
    chunkCache.set(key, payload);
    const geoKey = atlas3dChunkKey(payload.cx, payload.cy);
    if (presentedChunks.get(geoKey) === payload) return true;
    if (!registerAtlas3dChunkHeights(payload)) return false;
    // Registering a replacement atomically overwrites the outgoing LOD. A
    // later deactivatePresentation(outgoing) is therefore a harmless no-op.
    presentedChunks.set(geoKey, payload);
    trimChunkCache(payload);
    return true;
  }

  function deactivatePresentation(payload) {
    if (!payload || payload.seed !== seed) return false;
    let geoKey;
    try {
      geoKey = atlas3dChunkKey(payload.cx, payload.cy);
    } catch {
      return false;
    }
    if (presentedChunks.get(geoKey) !== payload) return false;
    presentedChunks.delete(geoKey);
    releaseAtlas3dChunkHeights(payload);
    trimChunkCache();
    return true;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (initTimeoutId) clearTimeout(initTimeoutId);
    if (!initialized) rejectReady(abortError("The 3D atlas terrain worker was disposed."));
    rejectAll(abortError("The 3D atlas terrain worker was disposed."));
    clearRetainedChunks();
    worker.terminate?.();
    options.onDispose?.();
  }

  const client = Object.freeze({
    seed,
    version: ATLAS_3D_RENDER_VERSION,
    ready,
    request,
    reprioritize,
    cancel,
    release,
    setCacheLimit,
    activatePresentation,
    deactivatePresentation,
    dispose,
    get disposed() { return disposed; },
    get cachedChunkCount() { return chunkCache.size; },
    get cacheLimit() { return chunkCacheLimit; },
    get presentedChunkCount() { return presentedChunks.size; },
    get pendingChunkCount() { return pendingById.size; },
  });

  try {
    initTimeoutId = setTimeout(() => {
      if (!initialized) fail(terrainWorkerError());
    }, timeoutMs);
    worker.postMessage({ type: "init", version: ATLAS_3D_RENDER_VERSION, seed });
  } catch {
    fail(terrainWorkerError());
  }

  return client;
}

export function getAtlasTerrainWorkerClient(seed = CONTINENT.seed) {
  const key = runtimeKey(seed);
  const existing = terrainClients.get(key);
  if (existing && !existing.disposed) return existing;
  let client;
  client = createAtlasTerrainWorkerClient(seed, {
    onDispose: () => {
      if (terrainClients.get(key) === client) terrainClients.delete(key);
      runtimePromises.delete(key);
    },
  });
  terrainClients.set(key, client);
  return client;
}

/** Warm Three.js and initialize the persistent worker in parallel. */
export function preloadWorldAtlas3d(seed = CONTINENT.seed) {
  const key = runtimeKey(seed);
  const existing = runtimePromises.get(key);
  if (existing) return existing;

  const threePromise = import("three");
  let chunkClient;
  let clientReady;
  try {
    chunkClient = getAtlasTerrainWorkerClient(seed);
    clientReady = chunkClient.ready;
  } catch (error) {
    clientReady = Promise.reject(error);
  }
  const runtimePromise = Promise.all([threePromise, clientReady])
    .then(([THREE]) => ({
      THREE,
      chunkClient,
      terrainClient: chunkClient,
    }));
  runtimePromises.set(key, runtimePromise);
  runtimePromise.catch(() => {
    if (runtimePromises.get(key) === runtimePromise) runtimePromises.delete(key);
    if (chunkClient && terrainClients.get(key) === chunkClient) chunkClient.dispose();
  });
  return runtimePromise;
}

export function getWorldAtlas3dRuntime(seed = CONTINENT.seed) {
  return preloadWorldAtlas3d(seed);
}

export function disposeWorldAtlas3dRuntime(seed = CONTINENT.seed) {
  const key = runtimeKey(seed);
  runtimePromises.delete(key);
  const client = terrainClients.get(key);
  if (!client) return false;
  client.dispose();
  return true;
}
