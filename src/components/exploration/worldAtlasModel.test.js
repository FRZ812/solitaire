import { describe, expect, it } from "vitest";
import { CONTINENT, LANDMARKS } from "../../data/continent.js";
import { makeInitialState } from "../../data/initial-state.js";
import {
  ATLAS_LANDMARKS,
  ATLAS_OBLIQUE_PITCH,
  atlasLandmarkLayer,
  atlasLandmarkTypeLabel,
  initialAtlasSelection,
  journeyLegBreaks,
  projectAxial,
  summarizeAtlasJourney,
  unprojectAxial,
} from "./worldAtlasModel.js";

const PRE_EXPANSION_NORTHSTAR_MINUTES = 3364;

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

describe("world atlas regional detail landmarks", () => {
  const byId = Object.fromEntries(ATLAS_LANDMARKS.map((landmark) => [landmark.id, landmark]));

  it("adds the authored realm landmarks without ambiguous marker coordinates", () => {
    const coordKeys = ATLAS_LANDMARKS.map(({ coord }) => `${coord.x},${coord.y}`);

    expect(new Set(ATLAS_LANDMARKS.map((landmark) => landmark.id)).size).toBe(ATLAS_LANDMARKS.length);
    expect(new Set(coordKeys).size).toBe(ATLAS_LANDMARKS.length);
    expect(byId["temple-still-waters"]).toMatchObject({ kind: "pagoda", realmId: "east", coord: { x: 355, y: -60 } });
    expect(byId["temple-reed-crane"]).toMatchObject({ kind: "pagoda", realmId: "east", coord: { x: 430, y: 45 } });
    expect(byId["mountain-hermitage"]).toMatchObject({ kind: "pagoda", realmId: "east", coord: { x: 90, y: -140 } });
    expect(byId["jade-porch"]).toMatchObject({ kind: "pagoda", realmId: "east", coord: { x: 310, y: 110 } });
    expect(byId["watchers-spire"]).toMatchObject({ kind: "tower", realmId: "north", coord: { x: 72, y: -310 } });
    expect(byId["asalan-lighthouse"]).toMatchObject({ kind: "tower", realmId: "south" });
  });

  it("keeps regional marker taxonomy and exact selection behavior", () => {
    expect(byId["caer-selenya"]).toMatchObject({ kind: "wonder", capitalOfRealmId: "west" });
    expect(atlasLandmarkLayer(byId["caer-selenya"])).toBe("capitals");
    expect(atlasLandmarkLayer(byId["temple-still-waters"])).toBe("sanctuaries");
    expect(atlasLandmarkTypeLabel(byId["temple-still-waters"])).toBe("Pagoda");
    expect(initialAtlasSelection(byId["asalan-lighthouse"].coord)).toEqual({
      kind: "landmark",
      id: "asalan-lighthouse",
    });
  });

  it("fills every requested realm with the required landmark counts", () => {
    const detailIds = new Set([
      "temple-still-waters", "temple-reed-crane", "mountain-hermitage", "jade-porch",
      "first-hearth-ruins", "oathless-hall", "pale-crown-barrows", "thawless-court", "watchers-spire",
      "first-root-shrine", "rain-name-grove", "hollow-oak-covenant",
      "dawn-cup-shrine", "zenith-house", "long-ray-temple", "namar-buried-city", "brassless-courts", "asalan-lighthouse",
      "alderfield", "millcross", "whitewend-lea", "shepherds-rest", "barleywick", "bellmead", "bramble-pass-keep", "reedmarch-keep",
    ]);
    const details = ATLAS_LANDMARKS.filter((landmark) => detailIds.has(landmark.id));

    expect(details).toHaveLength(26);
    expect(details.filter(({ realmId, kind }) => realmId === "north" && kind === "ruin")).toHaveLength(4);
    expect(details.filter(({ realmId, kind }) => realmId === "west" && kind === "shrine")).toHaveLength(3);
    expect(details.filter(({ realmId, kind }) => realmId === "south" && kind === "shrine")).toHaveLength(3);
    expect(details.filter(({ realmId, kind }) => realmId === "south" && kind === "ruin")).toHaveLength(2);
    expect(details.filter(({ realmId, kind }) => realmId === "central" && kind === "village")).toHaveLength(6);
    expect(details.filter(({ realmId, kind }) => realmId === "central" && kind === "fortress")).toHaveLength(2);
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

describe("world atlas expedition scale", () => {
  it("keeps the canonical Northstar boss route at least ten times the former journey", () => {
    const state = makeInitialState();
    const origin = { ...state.world.currentTile };
    const northstar = LANDMARKS.find((landmark) => landmark.id === "northstar-castle");
    const journey = summarizeAtlasJourney(state, northstar.coord);

    expect(state.world.currentTile).toEqual(origin);
    expect(journey.fullPath[0]).toEqual(origin);
    expect(journey.fullPath.at(-1)).toEqual(northstar.coord);
    expect(journey.estimatedMinutes).toBeGreaterThanOrEqual(PRE_EXPANSION_NORTHSTAR_MINUTES * 10);
    expect(journey.kilometers).toBe(journey.totalSteps * CONTINENT.hexKilometers);
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
