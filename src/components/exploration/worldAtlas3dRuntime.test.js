import { afterEach, describe, expect, it, vi } from "vitest";
import { ATLAS_3D_RENDER_VERSION } from "./worldAtlas3dModel.js";
import { preloadWorldAtlas3d } from "./worldAtlas3dRuntime.js";

const originalWorker = globalThis.Worker;

afterEach(() => {
  vi.useRealTimers();
  if (originalWorker === undefined) delete globalThis.Worker;
  else globalThis.Worker = originalWorker;
});

describe("3D atlas runtime preload", () => {
  it("starts one worker and reuses its retained payload for a render key", async () => {
    const terrain = {
      version: ATLAS_3D_RENDER_VERSION,
      seed: "runtime-cache-test",
      stride: 960,
      columns: 2,
      rows: 2,
      positions: new Float32Array(12),
      colors: new Float32Array(12),
      coastal: new Uint8Array(4),
      ao: new Uint8Array(4),
      shore: new Uint8Array(4),
      indices: new Uint32Array([0, 2, 1, 1, 2, 3]),
      trees: new Float32Array(),
    };
    const workers = [];
    class FakeWorker {
      constructor(url, options) {
        this.url = url;
        this.options = options;
        this.terminate = vi.fn();
        workers.push(this);
      }
      postMessage(message) {
        this.message = message;
        queueMicrotask(() => this.onmessage?.({ data: terrain }));
      }
    }
    globalThis.Worker = FakeWorker;

    const first = preloadWorldAtlas3d("runtime-cache-test", 960);
    const second = preloadWorldAtlas3d("runtime-cache-test", 960);
    expect(second).toBe(first);

    const [{ THREE, terrain: firstTerrain }, again] = await Promise.all([first, second]);
    expect(THREE.Scene).toBeTypeOf("function");
    expect(firstTerrain).toBe(terrain);
    expect(again.terrain).toBe(terrain);
    expect(workers).toHaveLength(1);
    expect(workers[0].options).toEqual({ type: "module" });
    expect(workers[0].message).toEqual({ seed: "runtime-cache-test", stride: 960 });
    expect(workers[0].terminate).toHaveBeenCalledOnce();
  });

  it("does not freeze startup with a main-thread terrain fallback", async () => {
    delete globalThis.Worker;
    await expect(preloadWorldAtlas3d("runtime-worker-required-test", 960))
      .rejects.toThrow("terrain worker is unavailable");
  });

  it("rejects a malformed worker payload instead of poisoning the cache", async () => {
    globalThis.Worker = class InvalidWorker {
      terminate() {}
      postMessage() {
        queueMicrotask(() => this.onmessage?.({ data: { version: "stale" } }));
      }
    };

    await expect(preloadWorldAtlas3d("runtime-invalid-payload-test", 960))
      .rejects.toThrow("returned invalid data");
  });

  it("times out a stalled worker so a later atlas open can retry", async () => {
    vi.useFakeTimers();
    const terminate = vi.fn();
    globalThis.Worker = class SilentWorker {
      terminate = terminate;
      postMessage() {}
    };

    const pending = preloadWorldAtlas3d("runtime-worker-timeout-test", 960);
    await vi.advanceTimersByTimeAsync(20_000);
    await expect(pending).rejects.toThrow("terrain worker could not start");
    expect(terminate).toHaveBeenCalledOnce();
  });
});
