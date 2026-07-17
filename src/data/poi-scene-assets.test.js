import { describe, expect, it } from "vitest";
import { compileWhitemarchCapital } from "./whitemarch-capital.js";
import {
  POI_SCENE_FAMILIES,
  POI_TIER_TREATMENTS,
  poiSceneFamily,
  poiSceneVisual,
} from "./poi-scene-assets.js";

describe("POI scene assets", () => {
  it("provides two authored variants for every scene family", () => {
    expect(Object.keys(POI_SCENE_FAMILIES)).toHaveLength(16);
    for (const variants of Object.values(POI_SCENE_FAMILIES)) {
      expect(variants).toHaveLength(2);
      expect(variants.every((image) => typeof image === "string" && image.length > 0)).toBe(true);
      expect(new Set(variants).size).toBe(2);
    }
  });

  it("provides a treatment for every market tier", () => {
    expect(Object.keys(POI_TIER_TREATMENTS)).toEqual([
      "budget",
      "standard",
      "premium",
      "noble",
      "royal",
      "mastercraft",
    ]);
    for (const treatment of Object.values(POI_TIER_TREATMENTS)) {
      expect(typeof treatment.image).toBe("string");
      expect(treatment.opacity).toBeGreaterThan(0);
      expect(treatment.opacity).toBeLessThan(0.3);
    }
  });

  it("uses the building service before its broad POI type", () => {
    expect(poiSceneFamily({ poi: { type: "market", service: "apothecary" } })).toBe("healer");
    expect(poiSceneFamily({ poi: { type: "shop", service: "magic-shop" } })).toBe("arcane");
    expect(poiSceneFamily({ poi: { type: "market", service: "blacksmith" } })).toBe("smithy");
  });

  it("assigns a stable variant while distributing named sites across both choices", () => {
    const site = { poi: { type: "market", name: "Foxglove Exchange" } };
    expect(poiSceneVisual(site)).toEqual(poiSceneVisual(site));

    const variants = new Set(
      Array.from({ length: 32 }, (_, index) => poiSceneVisual({
        poi: { type: "market", name: `Market ${index}` },
      }).variant),
    );
    expect(variants).toEqual(new Set(["a", "b"]));
  });

  it("covers every visible POI in the existing Whitemarch capital", () => {
    const { tiles } = compileWhitemarchCapital();
    const visiblePoiTiles = Object.values(tiles)
      .filter((tile) => tile.poi && tile.poi.type !== "hidden");

    expect(visiblePoiTiles.length).toBeGreaterThan(0);
    for (const tile of visiblePoiTiles) {
      const visual = poiSceneVisual(tile);
      expect(visual?.image, tile.poi.name || tile.poi.part).toBeTruthy();
      if (tile.poi.marketTier) expect(visual?.tierId).toBe(tile.poi.marketTier);
    }
  });

  it("keeps hidden sites regional and gives unknown visible sites a wonder scene", () => {
    expect(poiSceneVisual({ poi: { type: "hidden", name: "Unknown Hollow" } })).toBeNull();
    expect(poiSceneFamily({ poi: { type: "observatory", name: "Star Tower" } })).toBe("wonder");
  });
});
