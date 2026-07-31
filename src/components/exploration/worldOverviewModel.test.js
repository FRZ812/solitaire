import { describe, expect, it } from "vitest";
import { makeInitialState } from "../../data/initial-state.js";
import {
  CONTINENT,
  CONTINENT_LAKES,
  CONTINENT_ROUTES,
  CONTINENT_WATERWAYS,
  LANDMARKS,
} from "../../data/continent.js";
import {
  WORLD_OVERVIEW_VIEWBOX,
  buildWorldOverviewModel,
  overviewCameraForRealm,
  overviewCameraViewBox,
  overviewDestinationTarget,
  panWorldOverviewCamera,
  zoomWorldOverviewCamera,
} from "./worldOverviewModel.js";

describe("far-above world overview model", () => {
  it("builds one continental map instead of a five-capital menu", () => {
    const model = buildWorldOverviewModel(makeInitialState());

    expect(model.realms).toHaveLength(5);
    expect(model.coastline).toHaveLength(CONTINENT.coastline.length);
    expect(model.routes).toHaveLength(CONTINENT_ROUTES.length);
    expect(model.waterways).toHaveLength(CONTINENT_WATERWAYS.length);
    expect(model.lakes).toHaveLength(CONTINENT_LAKES.length);
    expect(model.places.length).toBeGreaterThanOrEqual(LANDMARKS.length + 1);
    expect(model.places.filter((place) => place.capital)).toHaveLength(5);
    expect(model.places.filter((place) => !place.capital).length).toBeGreaterThan(50);
    expect(model.places.map((place) => place.id)).toEqual(expect.arrayContaining([
      "whitemarch",
      "aurora-vault",
      "star-forge",
      "sunken-crown",
      "old-root-ruins",
      "moon-reed-monastery",
    ]));
  });

  it("projects every authored place onto the bounded map and gives it reasons to visit", () => {
    const model = buildWorldOverviewModel(makeInitialState());
    const sourceIds = new Set(LANDMARKS.map((landmark) => landmark.id));
    const projected = model.places.filter((place) => sourceIds.has(place.id));

    expect(projected).toHaveLength(LANDMARKS.length);
    for (const place of projected) {
      expect(place.point.x, `${place.id}:x`).toBeGreaterThanOrEqual(0);
      expect(place.point.x, `${place.id}:x`).toBeLessThanOrEqual(WORLD_OVERVIEW_VIEWBOX.width);
      expect(place.point.y, `${place.id}:y`).toBeGreaterThanOrEqual(0);
      expect(place.point.y, `${place.id}:y`).toBeLessThanOrEqual(WORLD_OVERVIEW_VIEWBOX.height);
      expect(place.interests.length, `${place.id}:interests`).toBeGreaterThanOrEqual(2);
      expect(place.description.length, `${place.id}:description`).toBeGreaterThan(30);
    }
  });

  it("treats legendary atlas places as known destinations without claiming they were visited", () => {
    const state = makeInitialState();
    const initial = buildWorldOverviewModel(state);
    const tellmar = initial.places.find((place) => place.id === "tellmar");

    expect(tellmar).toMatchObject({
      knownBy: "legend",
      charted: false,
      visited: false,
      name: "Tellmar",
    });

    state.world.seen["418,72"] = true;
    const charted = buildWorldOverviewModel(state).places.find((place) => place.id === "tellmar");
    expect(charted).toMatchObject({ charted: true, visited: false });
  });

  it("hands a selected place to the regional travel map without moving the party", () => {
    const state = makeInitialState();
    const before = { ...state.world.currentTile };
    const place = buildWorldOverviewModel(state).places.find((entry) => entry.id === "star-forge");

    expect(overviewDestinationTarget(place)).toEqual({
      x: 325,
      y: -110,
      name: "The Star-Forge",
      knownBy: "legend",
      landmarkId: "star-forge",
    });
    expect(state.world.currentTile).toEqual(before);
  });

  it("supports fit, realm focus, zoom, and bounded panning as presentation state", () => {
    const model = buildWorldOverviewModel(makeInitialState());
    const east = model.realms.find((realm) => realm.id === "east");
    const focused = overviewCameraForRealm(east);
    const zoomed = zoomWorldOverviewCamera(focused, 1.5);
    const panned = panWorldOverviewCamera(zoomed, { x: 10_000, y: -10_000 });
    const box = overviewCameraViewBox(panned);

    expect(focused.zoom).toBeGreaterThan(1);
    expect(zoomed.zoom).toBeGreaterThan(focused.zoom);
    expect(box.width).toBeLessThan(WORLD_OVERVIEW_VIEWBOX.width);
    expect(box.height).toBeLessThan(WORLD_OVERVIEW_VIEWBOX.height);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(WORLD_OVERVIEW_VIEWBOX.width);
    expect(box.y + box.height).toBeLessThanOrEqual(WORLD_OVERVIEW_VIEWBOX.height);
  });
});
