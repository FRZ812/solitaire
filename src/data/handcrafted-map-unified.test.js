import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  HANDCRAFTED,
  applyMapData,
  compileDefaultWorldMap,
  isUnifiedMapPayload,
} from "./handcrafted-map.js";
import { WHITEMARCH_MAP_VERSION } from "./whitemarch-capital.js";

let originalTiles;

beforeEach(() => {
  originalTiles = JSON.parse(JSON.stringify(HANDCRAFTED));
});

afterEach(() => {
  applyMapData({ mapVersion: WHITEMARCH_MAP_VERSION, tiles: originalTiles }, [], { trusted: true });
});

describe("authoritative unified capital loading", () => {
  it("ignores an unversioned legacy remote tile blob", () => {
    const bundled = compileDefaultWorldMap();
    const legacyOnlyKey = "400,400";

    expect(isUnifiedMapPayload({ [legacyOnlyKey]: { terrain: "settlement" } })).toBe(false);
    applyMapData({ [legacyOnlyKey]: { terrain: "settlement", poi: { name: "Legacy City" } } }, []);

    expect(HANDCRAFTED[legacyOnlyKey]).toBeUndefined();
    expect(HANDCRAFTED["0,0"]).toEqual(expect.objectContaining({
      cityId: "whitemarch",
      mapVersion: WHITEMARCH_MAP_VERSION,
    }));
    expect(Object.keys(HANDCRAFTED).length).toBeGreaterThanOrEqual(Object.keys(bundled).length);
  });

  it("accepts an explicitly versioned unified overlay without dropping the capital", () => {
    const overlayKey = "400,400";
    const payload = {
      mapVersion: WHITEMARCH_MAP_VERSION,
      tiles: {
        [overlayKey]: {
          terrain: "road",
          route: "test-regional-anchor",
          poi: { type: "landmark", name: "Survey Anchor" },
        },
      },
    };

    expect(isUnifiedMapPayload(payload)).toBe(true);
    applyMapData(payload, []);

    expect(HANDCRAFTED[overlayKey]?.poi?.name).toBe("Survey Anchor");
    expect(HANDCRAFTED["0,0"]?.poi?.part).toBe("grain-square");
  });
});
