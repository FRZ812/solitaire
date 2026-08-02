import { describe, expect, it } from "vitest";
import { makeInitialState } from "../../data/initial-state.js";
import { LANDMARKS } from "../../data/continent.js";
import { ATLAS_ROUTES, ATLAS_WATERWAYS, buildAtlasPlaces } from "./mapAtlasModel.js";

describe("authored atlas places", () => {
  it("carries the places a sampled viewport would almost never land on", () => {
    const places = buildAtlasPlaces(makeInitialState());

    // At continental stride the viewport samples every 28th hex, so a one-hex
    // landmark has roughly a 1-in-784 chance of being drawn. These are projected
    // rather than sampled, which is why they survive the zoom.
    expect(places.length).toBeGreaterThanOrEqual(LANDMARKS.length);
    expect(new Set(places.map((place) => place.id)).size).toBe(places.length);
    for (const place of places) {
      expect(Number.isFinite(place.x) && Number.isFinite(place.y), place.id).toBe(true);
      expect(place.name, place.id).toBeTruthy();
    }
  });

  it("keeps the capital and marks the places that give the continent its shape", () => {
    const places = buildAtlasPlaces(makeInitialState());
    const capital = places.find((place) => place.id === "whitemarch");

    expect(capital).toMatchObject({ kind: "city", major: true });
    const majors = places.filter((place) => place.major);
    expect(majors.length).toBeGreaterThan(4);
    expect(majors.length).toBeLessThan(places.length);
  });

  it("lets an unvisited place still be named, since travellers talk", () => {
    const places = buildAtlasPlaces(makeInitialState());

    // This is the capability the deleted SVG overview owned: setting a course for
    // somewhere known only by reputation or legend.
    expect(places.find((place) => place.id === "star-forge")).toMatchObject({
      name: "The Star-Forge",
      knowledge: "legend",
    });
    expect(places.find((place) => place.id === "mirecross")).toMatchObject({
      knowledge: "reputation",
    });
  });

  it("promotes a place to charted knowledge once the party has actually seen it", () => {
    const state = makeInitialState();
    const before = buildAtlasPlaces(state).find((place) => place.id === "star-forge");
    expect(before.knowledge).toBe("legend");

    state.world.seen[`${before.x},${before.y}`] = true;

    expect(buildAtlasPlaces(state).find((place) => place.id === "star-forge"))
      .toMatchObject({ knowledge: "charted" });
  });

  it("treats the ground the party is standing on as charted", () => {
    const state = makeInitialState();
    const target = buildAtlasPlaces(state).find((place) => place.knowledge !== "charted");
    state.world.currentTile = { x: target.x, y: target.y };

    expect(buildAtlasPlaces(state).find((place) => place.id === target.id))
      .toMatchObject({ knowledge: "charted" });
  });
});

describe("authored ribbons", () => {
  it("publishes roads and rivers as continuous polylines", () => {
    for (const ribbon of [...ATLAS_ROUTES, ...ATLAS_WATERWAYS]) {
      expect(ribbon.points.length, ribbon.id).toBeGreaterThan(1);
      expect(ribbon.width, ribbon.id).toBeGreaterThan(0);
      for (const point of ribbon.points) {
        expect(Number.isFinite(point.x) && Number.isFinite(point.y), ribbon.id).toBe(true);
      }
    }
    expect(ATLAS_ROUTES.every((ribbon) => ribbon.kind === "road")).toBe(true);
    expect(ATLAS_WATERWAYS.every((ribbon) => ribbon.kind === "river")).toBe(true);
  });

  it("names only itself, so drawing base geography discloses no site", () => {
    for (const ribbon of [...ATLAS_ROUTES, ...ATLAS_WATERWAYS]) {
      expect(Object.keys(ribbon).sort()).toEqual(["id", "kind", "name", "points", "width"]);
    }
  });
});
