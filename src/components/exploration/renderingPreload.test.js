import { afterEach, describe, expect, it } from "vitest";
import {
  getCachedMapCanvasImages,
  preloadMapCanvasImages,
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
