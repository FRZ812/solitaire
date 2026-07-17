import { describe, expect, it } from "vitest";
import {
  ATLAS_LANDMARKS,
  ATLAS_OBLIQUE_PITCH,
  initialAtlasSelection,
  journeyLegBreaks,
  projectAxial,
  unprojectAxial,
} from "./worldAtlasModel.js";

describe("world atlas oblique projection", () => {
  it("uses the continental pitch while preserving pointer round trips", () => {
    expect(ATLAS_OBLIQUE_PITCH).toBeCloseTo(0.76);

    const coord = { x: 37.25, y: -18.75 };
    const projected = projectAxial(coord.x, coord.y);
    const picked = unprojectAxial(projected.x, projected.y);

    expect(projected.y).toBeCloseTo(coord.y * (Math.sqrt(3) / 2) * ATLAS_OBLIQUE_PITCH);
    expect(picked.x).toBeCloseTo(coord.x);
    expect(picked.y).toBeCloseTo(coord.y);
  });
});

describe("world atlas initial selection", () => {
  it("selects an exact landmark at the party coordinate", () => {
    const landmark = ATLAS_LANDMARKS[0];

    expect(initialAtlasSelection(landmark.coord)).toEqual({
      kind: "landmark",
      id: landmark.id,
    });
  });

  it("falls back to an open-ground point selection", () => {
    expect(initialAtlasSelection({ x: 12345, y: -54321 })).toEqual({
      kind: "point",
      x: 12345,
      y: -54321,
    });
  });
});

describe("world atlas journey leg breaks", () => {
  const path = Array.from({ length: 18 }, (_, index) => ({ x: index, y: -index }));

  it("returns capped interior leg endpoints with their path indices", () => {
    expect(journeyLegBreaks(path, 4, 3)).toEqual([
      { x: 4, y: -4, index: 4 },
      { x: 8, y: -8, index: 8 },
      { x: 12, y: -12, index: 12 },
    ]);
  });

  it("does not mark a destination or a single-leg route", () => {
    const exactLegPath = path.slice(0, 9);

    expect(journeyLegBreaks(exactLegPath, 4)).toEqual([
      { x: 4, y: -4, index: 4 },
    ]);
    expect(journeyLegBreaks(exactLegPath, 8)).toEqual([]);
    expect(journeyLegBreaks(path, 0)).toEqual([]);
    expect(journeyLegBreaks(path, 0.5)).toEqual([]);
  });
});

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
