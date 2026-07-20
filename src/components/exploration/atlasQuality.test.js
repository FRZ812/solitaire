import { describe, expect, it } from "vitest";
import { ATLAS_QUALITY_TIERS, resolveAtlasQuality } from "./atlasQuality.js";

describe("atlas quality tiers", () => {
  it("forces the requested tier over any device signals", () => {
    const weak = { viewportMin: 380, dpr: 3, cores: 2, memory: 2 };
    const strong = { viewportMin: 1440, dpr: 1, cores: 16, memory: 32 };
    expect(resolveAtlasQuality("high", weak)).toBe(ATLAS_QUALITY_TIERS.high);
    expect(resolveAtlasQuality("low", strong)).toBe(ATLAS_QUALITY_TIERS.low);
  });

  it("auto-detects weak hardware, small viewports, and full desktops", () => {
    expect(resolveAtlasQuality("auto", { viewportMin: 1440, dpr: 1, cores: 2, memory: 8 }).id).toBe("low");
    expect(resolveAtlasQuality("auto", { viewportMin: 1440, dpr: 1, cores: 8, memory: 2 }).id).toBe("low");
    expect(resolveAtlasQuality("auto", { viewportMin: 390, dpr: 3, cores: 8, memory: 8 }).id).toBe("medium");
    expect(resolveAtlasQuality("auto", { viewportMin: 1080, dpr: 1, cores: 8, memory: 8 }).id).toBe("high");
    expect(resolveAtlasQuality(undefined, { viewportMin: 1080, dpr: 1, cores: 8, memory: 8 }).id).toBe("high");
    expect(resolveAtlasQuality("bogus", { viewportMin: 1080, dpr: 1, cores: 8, memory: 8 }).id).toBe("high");
  });

  it("uses chunk LOD rings and bounded resident caches instead of terrain strides", () => {
    expect(ATLAS_QUALITY_TIERS.high).toMatchObject({
      lod0Radius: 2,
      chunkCacheSize: 96,
      chunkPropCap: 320,
    });
    expect(ATLAS_QUALITY_TIERS.medium).toMatchObject({
      lod0Radius: 1,
      chunkCacheSize: 64,
      chunkPropCap: 200,
    });
    expect(ATLAS_QUALITY_TIERS.low).toMatchObject({
      lod0Radius: 0,
      chunkCacheSize: 48,
      chunkPropCap: 100,
      proceduralOnly: true,
    });
    expect(Object.values(ATLAS_QUALITY_TIERS).every((tier) => !("terrainStride" in tier))).toBe(true);
  });

  it("only lowers render cost as tiers descend", () => {
    expect(ATLAS_QUALITY_TIERS.high.pixelBudget).toBeGreaterThan(ATLAS_QUALITY_TIERS.medium.pixelBudget);
    expect(ATLAS_QUALITY_TIERS.medium.pixelBudget).toBeGreaterThan(ATLAS_QUALITY_TIERS.low.pixelBudget);
    expect(ATLAS_QUALITY_TIERS.high.shadowMapSize).toBeGreaterThan(ATLAS_QUALITY_TIERS.medium.shadowMapSize);
    expect(ATLAS_QUALITY_TIERS.low.shadowMapSize).toBe(0);
    expect(ATLAS_QUALITY_TIERS.high.propDensity).toBeGreaterThan(ATLAS_QUALITY_TIERS.medium.propDensity);
    expect(ATLAS_QUALITY_TIERS.medium.propDensity).toBeGreaterThan(ATLAS_QUALITY_TIERS.low.propDensity);
    expect(ATLAS_QUALITY_TIERS.high.lod0Radius).toBeGreaterThan(ATLAS_QUALITY_TIERS.medium.lod0Radius);
    expect(ATLAS_QUALITY_TIERS.medium.lod0Radius).toBeGreaterThan(ATLAS_QUALITY_TIERS.low.lod0Radius);
    expect(ATLAS_QUALITY_TIERS.high.chunkCacheSize).toBeGreaterThan(ATLAS_QUALITY_TIERS.medium.chunkCacheSize);
    expect(ATLAS_QUALITY_TIERS.medium.chunkCacheSize).toBeGreaterThan(ATLAS_QUALITY_TIERS.low.chunkCacheSize);
    expect(ATLAS_QUALITY_TIERS.high.chunkPropCap).toBeGreaterThan(ATLAS_QUALITY_TIERS.medium.chunkPropCap);
    expect(ATLAS_QUALITY_TIERS.medium.chunkPropCap).toBeGreaterThan(ATLAS_QUALITY_TIERS.low.chunkPropCap);
  });
});
