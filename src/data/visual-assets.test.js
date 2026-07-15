import { describe, expect, it } from "vitest";
import { BIOMES } from "./biomes.js";
import { TERRAINS } from "./terrains.js";
import { BIOME_VISUALS, TERRAIN_VISUALS, biomeVisual, sceneBiomeId, terrainVisual } from "./visual-assets.js";

describe("visual asset registry", () => {
  it("has an authored visual for every named biome", () => {
    expect(Object.keys(BIOME_VISUALS).sort()).toEqual(BIOMES.map((biome) => biome.id).sort());
    for (const biome of BIOMES) {
      const visual = biomeVisual(biome.id);
      expect(visual.image).toMatch(/scene-.+\.webp$/);
      expect(visual.mood).toBeTruthy();
      expect(visual.accent).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("gives every named biome its own regional plate", () => {
    expect(new Set(Object.values(BIOME_VISUALS).map((visual) => visual.image)).size).toBe(BIOMES.length);
  });

  it("has a terrain treatment for every terrain", () => {
    expect(Object.keys(TERRAIN_VISUALS).sort()).toEqual(Object.keys(TERRAINS).sort());
    for (const terrain of Object.keys(TERRAINS)) {
      expect(terrainVisual(terrain).motif).toBeTruthy();
    }
  });

  it("keeps unified capital tiles visually in Whitemarch", () => {
    expect(sceneBiomeId("bramblewych-reach", { cityId: "whitemarch" })).toBe("whitemarch");
    expect(sceneBiomeId("bramblewych-reach", { poi: { areaName: "The Grand Market" } })).toBe("whitemarch");
    expect(sceneBiomeId("mire", { poi: { name: "An unnamed peat pool" } })).toBe("mire");
  });
});
