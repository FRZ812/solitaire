import { describe, expect, it } from "vitest";
import { ATLAS_LANDMARKS } from "./worldAtlasModel.js";

describe("world atlas trade-house tiers", () => {
  it("carries Royal and Mastercraft markers onto their rare destination landmarks only", () => {
    expect(ATLAS_LANDMARKS.find((landmark) => landmark.id === "northstar-castle"))
      .toMatchObject({ marketTier: "royal", tradeHouseId: "aurora-armoury" });
    expect(ATLAS_LANDMARKS.find((landmark) => landmark.id === "star-forge"))
      .toMatchObject({ marketTier: "mastercraft", tradeHouseId: "falling-star-forge" });
    expect(ATLAS_LANDMARKS.find((landmark) => landmark.id === "whitemarch")?.marketTier)
      .toBeUndefined();
  });
});
