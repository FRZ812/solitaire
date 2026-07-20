import { afterEach, describe, expect, it, vi } from "vitest";
import {
  atlasStartChunkRequests,
  getCachedMapCanvasImages,
  preloadMapCanvasImages,
  warmAtlasStartChunks,
} from "./renderingPreload.js";

const originalImage = globalThis.Image;

afterEach(() => {
  if (originalImage === undefined) delete globalThis.Image;
  else globalThis.Image = originalImage;
});

describe("shared map rendering images", () => {
  it("starts each low-priority image once and reuses the decoded objects", async () => {
    const created = [];
    class FakeImage {
      constructor() {
        this.fetchPriority = "auto";
        this.naturalWidth = 1254;
        this.naturalHeight = 1254;
        created.push(this);
      }
      set src(value) {
        this.currentSrc = value;
        queueMicrotask(() => this.onload?.());
      }
    }
    globalThis.Image = FakeImage;

    const [first, concurrent] = await Promise.all([
      preloadMapCanvasImages(),
      preloadMapCanvasImages(),
    ]);
    expect(created).toHaveLength(4);
    expect(created.every((image) => image.fetchPriority === "low")).toBe(true);
    expect(concurrent.material).toBe(first.material);
    expect(concurrent.poi).toEqual(first.poi);

    const cached = getCachedMapCanvasImages();
    const reopened = await preloadMapCanvasImages();
    expect(created).toHaveLength(4);
    expect(reopened.material).toBe(cached.material);
    expect(reopened.poi.trade).toBe(cached.poi.trade);
    expect(reopened.poi.city).toBe(cached.poi.city);
    expect(reopened.poi.wilderness).toBe(cached.poi.wilderness);
  });
});

describe("3D atlas start-window warming", () => {
  it("requests a prioritized 3x3 LOD0 neighborhood around the party", async () => {
    const request = vi.fn((cx, cy, lod, priority) => Promise.resolve({ cx, cy, lod, priority }));
    const planned = atlasStartChunkRequests({ x: 49, y: -25 });
    const chunks = await warmAtlasStartChunks({ request }, { x: 49, y: -25 });

    expect(planned).toHaveLength(9);
    expect(planned[0]).toMatchObject({ cx: 2, cy: -2, lod: 0 });
    expect(planned.every((entry) => entry.lod === 0)).toBe(true);
    expect(new Set(planned.map((entry) => `${entry.cx},${entry.cy}`)).size).toBe(9);
    expect(planned[0].priority).toBeGreaterThan(planned.at(-1).priority);
    expect(request).toHaveBeenCalledTimes(9);
    expect(chunks).toHaveLength(9);
  });
});
