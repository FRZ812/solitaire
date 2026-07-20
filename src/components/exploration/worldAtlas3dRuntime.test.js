import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ATLAS_3D_CHUNK_SIZE,
  ATLAS_3D_RENDER_VERSION,
  atlas3dTerrainHeightAt,
  releaseAtlas3dChunkHeights,
} from "./worldAtlas3dModel.js";
import {
  createAtlasTerrainWorkerClient,
  disposeWorldAtlas3dRuntime,
  preloadWorldAtlas3d,
} from "./worldAtlas3dRuntime.js";

const originalWorker = globalThis.Worker;
const runtimeSeeds = new Set();
const directClients = new Set();

function payload(seed, cx, cy, lod = 0, overrides = {}) {
  const stride = lod === 0 ? 1 : 2;
  const columns = ATLAS_3D_CHUNK_SIZE / stride + 1;
  const surfaceVertexCount = columns ** 2;
  const skirtVertexCount = 4 * (columns - 1);
  const vertexCount = surfaceVertexCount + skirtVertexCount;
  return {
    version: ATLAS_3D_RENDER_VERSION,
    seed,
    cx,
    cy,
    lod,
    empty: false,
    origin: { x: cx * ATLAS_3D_CHUNK_SIZE, y: cy * ATLAS_3D_CHUNK_SIZE },
    span: ATLAS_3D_CHUNK_SIZE,
    stride,
    columns,
    rows: columns,
    heights: new Float32Array((ATLAS_3D_CHUNK_SIZE + 1) ** 2),
    surfaceVertexCount,
    skirtVertexOffset: surfaceVertexCount,
    skirtVertexCount,
    skirtDepth: 4,
    positions: new Float32Array(vertexCount * 3),
    colors: new Float32Array(vertexCount * 3),
    coastal: new Uint8Array(vertexCount),
    ao: new Uint8Array(vertexCount),
    shore: new Uint8Array(vertexCount),
    indices: new Uint32Array((columns - 1) ** 2 * 6 + skirtVertexCount * 6),
    trees: new Float32Array(),
    rocks: new Float32Array(),
    fields: new Float32Array(),
    environs: new Float32Array(),
    buildMs: 1,
    ...overrides,
  };
}

function readyWorkerClass(instances, onChunk = null) {
  return class FakeWorker {
    constructor(url, options) {
      this.url = url;
      this.options = options;
      this.messages = [];
      this.terminate = vi.fn();
      instances.push(this);
    }

    postMessage(message) {
      this.messages.push(message);
      if (message.type === "init") {
        queueMicrotask(() => this.onmessage?.({
          data: {
            type: "ready",
            version: ATLAS_3D_RENDER_VERSION,
            seed: message.seed,
          },
        }));
      } else if (message.type === "chunk") {
        onChunk?.(this, message);
      }
    }
  };
}

afterEach(() => {
  for (const seed of runtimeSeeds) disposeWorldAtlas3dRuntime(seed);
  runtimeSeeds.clear();
  for (const client of directClients) client.dispose();
  directClients.clear();
  vi.useRealTimers();
  if (originalWorker === undefined) delete globalThis.Worker;
  else globalThis.Worker = originalWorker;
});

describe("persistent 3D atlas terrain runtime", () => {
  it("initializes one seed-bound worker and memoizes the Three runtime", async () => {
    const seed = "runtime-cache-test";
    runtimeSeeds.add(seed);
    const workers = [];
    globalThis.Worker = readyWorkerClass(workers);

    const first = preloadWorldAtlas3d(seed);
    const second = preloadWorldAtlas3d(seed);
    expect(second).toBe(first);

    const [{ THREE, chunkClient }, again] = await Promise.all([first, second]);
    expect(THREE.Scene).toBeTypeOf("function");
    expect(again.chunkClient).toBe(chunkClient);
    expect(workers).toHaveLength(1);
    expect(workers[0].options).toEqual({ type: "module" });
    expect(workers[0].messages).toEqual([{
      type: "init",
      version: ATLAS_3D_RENDER_VERSION,
      seed,
    }]);
    expect(workers[0].terminate).not.toHaveBeenCalled();
  });

  it("deduplicates requests and retains completed warm chunks across a scene close", async () => {
    const seed = "runtime-chunk-cache-test";
    const workers = [];
    const WorkerClass = readyWorkerClass(workers, (worker, message) => {
      queueMicrotask(() => worker.onmessage?.({
        data: {
          type: "chunk",
          id: message.id,
          chunk: payload(seed, message.cx, message.cy, message.lod),
        },
      }));
    });
    const client = createAtlasTerrainWorkerClient(seed, { WorkerClass });
    directClients.add(client);
    await client.ready;

    const first = client.request(2, -3, 0, 5000);
    const concurrent = client.request(2, -3, 0, 1000);
    expect(concurrent).toBe(first);
    const [chunk, same] = await Promise.all([first, concurrent]);
    expect(same).toBe(chunk);
    expect(client.cachedChunkCount).toBe(1);
    expect(client.activatePresentation(chunk)).toBe(true);
    expect(client.deactivatePresentation(chunk)).toBe(true);

    // Closing a scene drops presentation ownership, but the persistent client
    // keeps the transferred payload for the next atlas controller.
    const reopened = await client.request(2, -3, 0, 0);
    expect(reopened).toBe(chunk);
    expect(workers[0].messages.filter((message) => message.type === "chunk")).toHaveLength(1);
    expect(workers[0].messages.at(-1)).toMatchObject({
      type: "chunk",
      cx: 2,
      cy: -3,
      lod: 0,
      priority: 5000,
    });
  });

  it("bounds non-presented returned chunks with a configurable client LRU", async () => {
    const seed = "runtime-bounded-cache-test";
    const workers = [];
    const WorkerClass = readyWorkerClass(workers, (worker, message) => {
      queueMicrotask(() => worker.onmessage?.({
        data: {
          type: "chunk",
          id: message.id,
          chunk: payload(seed, message.cx, message.cy, message.lod),
        },
      }));
    });
    const client = createAtlasTerrainWorkerClient(seed, { WorkerClass, cacheLimit: 1 });
    directClients.add(client);
    await client.ready;

    const first = await client.request(0, 0, 0);
    const second = await client.request(1, 0, 0);
    expect(first).not.toBe(second);
    expect(client.cacheLimit).toBe(1);
    expect(client.cachedChunkCount).toBe(1);

    expect(await client.request(1, 0, 0)).toBe(second);
    expect(workers[0].messages.filter((message) => message.type === "chunk")).toHaveLength(2);

    const rebuilt = await client.request(0, 0, 0);
    expect(rebuilt).not.toBe(first);
    expect(client.cachedChunkCount).toBe(1);
    expect(workers[0].messages.filter((message) => message.type === "chunk")).toHaveLength(3);
  });

  it("pins a visible payload until its replacement owns the geographic height surface", async () => {
    const seed = "runtime-pinned-cache-test";
    const workers = [];
    const WorkerClass = readyWorkerClass(workers, (worker, message) => {
      queueMicrotask(() => worker.onmessage?.({
        data: {
          type: "chunk",
          id: message.id,
          chunk: payload(seed, message.cx, message.cy, message.lod),
        },
      }));
    });
    const client = createAtlasTerrainWorkerClient(seed, { WorkerClass, cacheLimit: 1 });
    directClients.add(client);
    await client.ready;

    const lod0 = await client.request(0, 0, 0);
    expect(client.activatePresentation(lod0)).toBe(true);
    const lod1 = await client.request(0, 0, 1);
    expect(client.cachedChunkCount).toBe(2);

    expect(client.activatePresentation(lod1)).toBe(true);
    expect(client.cachedChunkCount).toBe(1);
    expect(client.release(lod0)).toBe(false);
    expect(client.deactivatePresentation(lod0)).toBe(false);
    expect(client.deactivatePresentation(lod1)).toBe(true);
  });

  it("keeps cached LODs inert and moves height ownership with presentation swaps", async () => {
    const seed = "runtime-height-owner-test";
    const coord = { x: 5.25, y: 7.75 };
    const fallback = atlas3dTerrainHeightAt(coord, seed);
    const lod0Height = fallback + 100;
    const lod1Height = fallback + 200;
    const workers = [];
    const client = createAtlasTerrainWorkerClient(seed, {
      WorkerClass: readyWorkerClass(workers, (worker, message) => {
        const chunk = payload(seed, message.cx, message.cy, message.lod);
        chunk.heights.fill(message.lod === 0 ? lod0Height : lod1Height);
        queueMicrotask(() => worker.onmessage?.({
          data: {
            type: "chunk",
            id: message.id,
            chunk,
          },
        }));
      }),
    });
    directClients.add(client);
    await client.ready;
    const lod0 = await client.request(0, 0, 0);
    const lod1 = await client.request(0, 0, 1);

    expect(client.cachedChunkCount).toBe(2);
    expect(client.presentedChunkCount).toBe(0);
    expect(atlas3dTerrainHeightAt(coord, seed)).toBeCloseTo(fallback, 6);

    expect(client.activatePresentation(lod0)).toBe(true);
    expect(client.presentedChunkCount).toBe(1);
    expect(atlas3dTerrainHeightAt(coord, seed)).toBeCloseTo(lod0Height, 4);
    expect(client.release(lod0)).toBe(false);

    // Activating first is an atomic replacement; stale outgoing cleanup must
    // not unregister the newly displayed LOD.
    expect(client.activatePresentation(lod1)).toBe(true);
    expect(atlas3dTerrainHeightAt(coord, seed)).toBeCloseTo(lod1Height, 4);
    expect(client.deactivatePresentation(lod0)).toBe(false);
    expect(atlas3dTerrainHeightAt(coord, seed)).toBeCloseTo(lod1Height, 4);

    // The reverse order is also safe and a cached revisit starts no new build.
    expect(client.deactivatePresentation(lod1)).toBe(true);
    expect(atlas3dTerrainHeightAt(coord, seed)).toBeCloseTo(fallback, 6);
    expect(client.activatePresentation(lod0)).toBe(true);
    expect(atlas3dTerrainHeightAt(coord, seed)).toBeCloseTo(lod0Height, 4);
    expect(workers[0].messages.filter((message) => message.type === "chunk")).toHaveLength(2);
    expect(client.deactivatePresentation(lod0)).toBe(true);

    expect(client.release(lod1)).toBe(true);
    expect(client.release(lod0)).toBe(true);
    expect(releaseAtlas3dChunkHeights(seed, 0, 0)).toBe(false);
  });

  it("updates queued priorities without starting a duplicate request", async () => {
    const workers = [];
    const client = createAtlasTerrainWorkerClient("runtime-priority-test", {
      WorkerClass: readyWorkerClass(workers),
    });
    directClients.add(client);
    await client.ready;
    const pending = client.request(1, 2, 1, 10);
    pending.catch(() => {});
    await Promise.resolve();

    expect(client.reprioritize(1, 2, 1, 9000)).toBe(true);
    const requests = workers[0].messages.filter((message) => message.type === "chunk");
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatchObject({ id: requests[0].id, priority: 9000 });
    expect(client.cancel(1, 2, 1)).toBe(true);
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(workers[0].messages.at(-1)).toEqual({ type: "cancel", id: requests[0].id });
  });

  it("times out one stalled request after ten seconds without replacing it on the main thread", async () => {
    vi.useFakeTimers();
    const workers = [];
    const client = createAtlasTerrainWorkerClient("runtime-timeout-test", {
      WorkerClass: readyWorkerClass(workers),
    });
    directClients.add(client);
    await client.ready;
    const pending = client.request(0, 0, 0, 1);
    pending.catch(() => {});
    await Promise.resolve();

    await vi.advanceTimersByTimeAsync(10_000);
    await expect(pending).rejects.toThrow("0,0|0 timed out");
    expect(workers[0].terminate).not.toHaveBeenCalled();
    expect(workers[0].messages.at(-1)).toMatchObject({ type: "cancel" });
    expect(client.pendingChunkCount).toBe(0);
  });

  it("rejects malformed chunk payloads without poisoning the request cache", async () => {
    const workers = [];
    const client = createAtlasTerrainWorkerClient("runtime-invalid-test", {
      WorkerClass: readyWorkerClass(workers, (worker, message) => {
        queueMicrotask(() => worker.onmessage?.({
          data: {
            type: "chunk",
            id: message.id,
            chunk: payload("runtime-invalid-test", message.cx, message.cy, message.lod, {
              positions: new Float32Array(3),
            }),
          },
        }));
      }),
    });
    directClients.add(client);
    await client.ready;

    await expect(client.request(0, 0, 0)).rejects.toThrow("invalid chunk data");
    expect(client.cachedChunkCount).toBe(0);
    expect(client.disposed).toBe(false);
  });

  it("rejects startup when Workers are unavailable instead of building terrain on the main thread", async () => {
    const seed = "runtime-worker-required-test";
    runtimeSeeds.add(seed);
    delete globalThis.Worker;
    await expect(preloadWorldAtlas3d(seed)).rejects.toThrow("terrain worker is unavailable");
  });

  it("terminates the persistent worker and rejects pending chunks on disposal", async () => {
    const workers = [];
    const client = createAtlasTerrainWorkerClient("runtime-dispose-test", {
      WorkerClass: readyWorkerClass(workers),
    });
    directClients.add(client);
    await client.ready;
    const pending = client.request(4, 5, 1);
    pending.catch(() => {});
    await Promise.resolve();

    client.dispose();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(client.disposed).toBe(true);
  });

  it("clears cached presentation heights when the persistent worker fails", async () => {
    const seed = "runtime-terminal-failure-test";
    const coord = { x: 4.25, y: 6.5 };
    const fallback = atlas3dTerrainHeightAt(coord, seed);
    const workers = [];
    const WorkerClass = readyWorkerClass(workers, (worker, message) => {
      const chunk = payload(seed, message.cx, message.cy, message.lod);
      chunk.heights.fill(fallback + 80);
      queueMicrotask(() => worker.onmessage?.({
        data: { type: "chunk", id: message.id, chunk },
      }));
    });
    const client = createAtlasTerrainWorkerClient(seed, { WorkerClass });
    directClients.add(client);
    await client.ready;
    const chunk = await client.request(0, 0, 0);
    expect(client.activatePresentation(chunk)).toBe(true);
    expect(atlas3dTerrainHeightAt(coord, seed)).toBeCloseTo(fallback + 80, 4);

    const preventDefault = vi.fn();
    workers[0].onerror?.({ preventDefault });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(client.disposed).toBe(true);
    expect(client.cachedChunkCount).toBe(0);
    expect(client.presentedChunkCount).toBe(0);
    expect(atlas3dTerrainHeightAt(coord, seed)).toBeCloseTo(fallback, 6);
    expect(workers[0].terminate).toHaveBeenCalledOnce();
  });
});
