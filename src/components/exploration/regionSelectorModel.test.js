import { describe, expect, it } from "vitest";
import { makeInitialState } from "../../data/initial-state.js";
import {
  buildRegionSelectorModel,
  regionCameraTarget,
} from "./regionSelectorModel.js";

describe("world region selector model", () => {
  it("presents the five macro realms and marks the party's current realm", () => {
    const state = makeInitialState();
    const model = buildRegionSelectorModel(state);

    expect(model.entries).toHaveLength(5);
    expect(model.currentRealmId).toBe("central");
    expect(model.entries.find((entry) => entry.id === "central")).toMatchObject({
      current: true,
      known: true,
      capitalName: "Whitemarch",
    });
  });

  it("suppresses capital and faction detail for realms with no mapped knowledge", () => {
    const state = makeInitialState();
    const north = buildRegionSelectorModel(state).entries.find((entry) => entry.id === "north");

    expect(north).toMatchObject({ known: false, chartedHexes: 0 });
    expect(north.capitalName).toBeNull();
    expect(north.factionName).toBeNull();
    expect(north).not.toHaveProperty("pois");
    expect(north).not.toHaveProperty("landmarks");
  });

  it("marks a remote realm known only after one of its hexes is mapped", () => {
    const state = makeInitialState();
    state.world.seen["418,72"] = true;

    const east = buildRegionSelectorModel(state).entries.find((entry) => entry.id === "east");

    expect(east).toMatchObject({
      known: true,
      chartedHexes: 1,
      capitalName: "Tellmar",
      factionName: "The Hundred Banners",
    });
  });

  it("restores a realm camera when available and otherwise uses its authored center", () => {
    const state = makeInitialState();
    const model = buildRegionSelectorModel(state);
    const east = model.entries.find((entry) => entry.id === "east");

    expect(regionCameraTarget(east, {})).toEqual({ x: 418, y: 72, zoom: 1 });
    expect(regionCameraTarget(east, { east: { x: 401, y: 68, zoom: 1.25 } }))
      .toEqual({ x: 401, y: 68, zoom: 1.25 });
    expect(state.world.currentTile).toEqual({ x: 0, y: 0 });
  });
});
