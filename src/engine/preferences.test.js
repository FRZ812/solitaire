import { describe, expect, it } from "vitest";
import {
  ATLAS_QUALITY_MODES,
  DEFAULT_ATLAS_QUALITY,
  DEFAULT_STORY_FONT_SCALE,
  STORY_FONT_SCALES,
  getAtlasQuality,
  setAtlasQuality,
} from "./preferences.js";

describe("story text size preference", () => {
  it("defaults to Small and exposes the compact three-step range", () => {
    expect(DEFAULT_STORY_FONT_SCALE).toBe("sm");
    expect(STORY_FONT_SCALES.map((scale) => scale.id)).toEqual(["sm", "md", "lg"]);
  });
});

describe("atlas map detail preference", () => {
  it("defaults to auto and exposes the four modes", () => {
    expect(DEFAULT_ATLAS_QUALITY).toBe("auto");
    expect(ATLAS_QUALITY_MODES.map((mode) => mode.id)).toEqual(["auto", "high", "medium", "low"]);
  });

  it("round-trips through storage and rejects unknown modes", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    const store = new Map();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
      },
    });
    try {
      expect(getAtlasQuality()).toBe("auto");
      setAtlasQuality("medium");
      expect(getAtlasQuality()).toBe("medium");
      store.set("solitaire-atlas-quality-v1", "bogus");
      expect(getAtlasQuality()).toBe("auto");
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
      else delete globalThis.localStorage;
    }
  });
});
