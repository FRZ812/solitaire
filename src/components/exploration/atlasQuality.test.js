import { describe, expect, it } from "vitest";
import { ATLAS_QUALITY_TIERS, resolveAtlasQuality } from "./atlasQuality.js";
import {
  ATLAS_3D_FINE_TERRAIN_STRIDE,
  ATLAS_3D_TERRAIN_STRIDE,
} from "./worldAtlas3dModel.js";

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

  it("keeps refinement strides consistent with the terrain model", () => {
    expect(ATLAS_QUALITY_TIERS.high.terrainStride).toBe(ATLAS_3D_FINE_TERRAIN_STRIDE);
    expect(ATLAS_QUALITY_TIERS.medium.terrainStride).toBe(ATLAS_3D_TERRAIN_STRIDE);
    expect(ATLAS_QUALITY_TIERS.low.terrainStride).toBe(ATLAS_3D_TERRAIN_STRIDE);
    expect(ATLAS_3D_FINE_TERRAIN_STRIDE).toBeLessThan(ATLAS_3D_TERRAIN_STRIDE);
  });

  it("only lowers render cost as tiers descend", () => {
    expect(ATLAS_QUALITY_TIERS.high.pixelBudget).toBeGreaterThan(ATLAS_QUALITY_TIERS.medium.pixelBudget);
    expect(ATLAS_QUALITY_TIERS.medium.pixelBudget).toBeGreaterThan(ATLAS_QUALITY_TIERS.low.pixelBudget);
    expect(ATLAS_QUALITY_TIERS.high.shadowMapSize).toBeGreaterThan(ATLAS_QUALITY_TIERS.medium.shadowMapSize);
    expect(ATLAS_QUALITY_TIERS.low.shadowMapSize).toBe(0);
    expect(ATLAS_QUALITY_TIERS.high.propDensity).toBeGreaterThan(ATLAS_QUALITY_TIERS.medium.propDensity);
    expect(ATLAS_QUALITY_TIERS.medium.propDensity).toBeGreaterThan(ATLAS_QUALITY_TIERS.low.propDensity);
  });
});
