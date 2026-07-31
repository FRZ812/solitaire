import { describe, expect, it } from "vitest";
import { makeInitialState } from "../../data/initial-state.js";
import { buildingForTile } from "../../data/town.js";
import { getTile } from "../../engine/world.js";
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

  it("projects every authored place onto the bounded map and gives it public map facts", () => {
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

  it("advertises Mirecross activities that exist at the regional destination", () => {
    const mirecross = buildWorldOverviewModel(makeInitialState()).places.find((place) => place.id === "mirecross");

    expect(mirecross.interests).toEqual(expect.arrayContaining([
      "Contract board",
      "Paid work",
      "Hire travelers",
    ]));
  });

  it("does not advertise absent fortress, ruin, or village mechanics", () => {
    const state = makeInitialState();
    const model = buildWorldOverviewModel(state);
    const cases = [
      { id: "frostgate", facts: ["Fortified site", "Military authority", "Border position"] },
      { id: "sunken-crown", facts: ["Ancient ruins", "Abandoned works", "Unsettled ground"] },
      { id: "tannic-ford", facts: ["Small settlement", "Rural district", "Local authority"] },
    ];

    for (const { id, facts } of cases) {
      const place = model.places.find((entry) => entry.id === id);
      const tile = getTile(state, place.coord.x, place.coord.y);
      expect(buildingForTile(tile), `${id}:building`).toBeNull();
      expect(place.interests, `${id}:facts`).toEqual(expect.arrayContaining(facts));
      expect(place.interests.join(" "), `${id}:claims`).not.toMatch(/Bounties|Delve|Relics|Local disputes|Roadside rumors|Unusual rewards|Missing travelers/);
    }
  });

  it("exposes authored hot springs as real wild destinations", () => {
    const model = buildWorldOverviewModel(makeInitialState());
    const wilds = model.places.filter((place) => place.category === "wilds");

    expect(wilds.map((place) => place.id)).toEqual(expect.arrayContaining(["jade-springs", "misty-caldron"]));
    expect(wilds.every((place) => place.knownBy === "legend")).toBe(true);
  });

  it("clips only offshore sea-lane continuations while keeping their port endpoints visible", () => {
    const { seaLanes } = buildWorldOverviewModel(makeInitialState());
    const inside = (point) => point.x >= 0
      && point.x <= WORLD_OVERVIEW_VIEWBOX.width
      && point.y >= 0
      && point.y <= WORLD_OVERVIEW_VIEWBOX.height;

    expect(seaLanes.some((lane) => lane.points.some((point) => !inside(point)))).toBe(true);
    for (const lane of seaLanes) {
      expect(inside(lane.points[0]), `${lane.id}:origin`).toBe(true);
      expect(inside(lane.points.at(-1)), `${lane.id}:destination`).toBe(true);
    }
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
