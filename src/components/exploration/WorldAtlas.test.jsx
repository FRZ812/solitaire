import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  CONTINENT,
  CONTINENT_ROUTES,
  CONTINENT_SEA_LANES,
  LANDMARKS,
  REALMS,
} from "../../data/continent.js";
import { makeInitialState } from "../../data/initial-state.js";
import { sampleContinent, surveyAtlas } from "../../engine/world-generation.js";
import { pathMinutes } from "../../engine/world.js";
import { WorldAtlas } from "./WorldAtlas.jsx";
import {
  ATLAS_LANDMARKS,
  ATLAS_LAYERS,
  ATLAS_MAX_ZOOM,
  atlasFitZoom,
  atlasLandmarkLayer,
  atlasLandmarkTypeLabel,
  atlasMarkerVisible,
  atlasRoutesForLandmark,
  atlasScreenToWorld,
  atlasWorldToScreen,
  axialRound,
  clampAtlasCamera,
  formatTravelDuration,
  journeyWaypoints,
  landmarkKnowledge,
  markerZoomTier,
  summarizeAtlasJourney,
  zoomAtlasCamera,
} from "./worldAtlasModel.js";

const VIEWPORT = { width: 960, height: 540 };

describe("atlas survey sampler", () => {
  it("stays terrain-identical to the full continental sample", () => {
    const seed = CONTINENT.seed;
    for (let x = -520; x <= 520; x += 130) {
      for (let y = -390; y <= 390; y += 130) {
        const survey = surveyAtlas(x, y, seed);
        const full = sampleContinent(x, y, seed);
        expect(survey.terrain, `terrain at ${x},${y}`).toBe(full.terrain);
        expect(survey.land, `land at ${x},${y}`).toBe(full.land);
        expect(survey.coast, `coast at ${x},${y}`).toBe(full.coast);
        expect(survey.realmId, `realm at ${x},${y}`).toBe(full.realmId);
      }
    }
  });

  it("never reveals generated hidden sites", () => {
    const survey = surveyAtlas(40, 40, CONTINENT.seed);
    expect(survey).not.toHaveProperty("site");
    expect(survey).not.toHaveProperty("content");
    expect(JSON.stringify(survey)).not.toContain("HIDDEN");
  });
});

describe("atlas camera", () => {
  it("keeps zoom between continent fit and the local maximum", () => {
    const fit = atlasFitZoom(VIEWPORT);
    expect(clampAtlasCamera({ x: 0, y: 0, zoom: 0.001 }, VIEWPORT).zoom).toBeCloseTo(fit, 5);
    expect(clampAtlasCamera({ x: 0, y: 0, zoom: 999 }, VIEWPORT).zoom).toBe(ATLAS_MAX_ZOOM);
  });

  it("round-trips world and screen coordinates", () => {
    const camera = clampAtlasCamera({ x: 10, y: -30, zoom: 4 }, VIEWPORT);
    const coord = { x: 55, y: 10 };
    const screen = atlasWorldToScreen(camera, VIEWPORT, coord);
    const back = axialRound(...Object.values(atlasScreenToWorld(camera, VIEWPORT, screen)));
    expect(back).toEqual(coord);
  });

  it("zooms toward an anchor so the ground under the cursor stays put", () => {
    const camera = clampAtlasCamera({ x: 0, y: 0, zoom: 3 }, VIEWPORT);
    const anchor = { x: 300, y: 200 };
    const before = atlasScreenToWorld(camera, VIEWPORT, anchor);
    const zoomed = zoomAtlasCamera(camera, VIEWPORT, 1.5, anchor);
    const after = atlasScreenToWorld(zoomed, VIEWPORT, anchor);
    expect(after.x).toBeCloseTo(before.x, 4);
    expect(after.y).toBeCloseTo(before.y, 4);
  });

  it("clamps the camera center to the charted continent", () => {
    const camera = clampAtlasCamera({ x: 99999, y: -99999, zoom: 6 }, VIEWPORT);
    expect(camera.x).toBeLessThanOrEqual(1200);
    expect(camera.y).toBeGreaterThanOrEqual(-800);
  });
});

describe("atlas markers", () => {
  const byId = Object.fromEntries(ATLAS_LANDMARKS.map((landmark) => [landmark.id, landmark]));
  const allLayers = new Set(ATLAS_LAYERS.map((layer) => layer.id));

  it("keeps the marker taxonomy and route derivation from authored data", () => {
    expect(atlasLandmarkLayer(byId["whitemarch"])).toBe("capitals");
    expect(atlasLandmarkLayer(byId["mirecross"])).toBe("settlements");
    expect(atlasLandmarkLayer(byId["greenharbor"])).toBe("ports");
    expect(atlasLandmarkLayer(byId["frostgate"])).toBe("strongholds");
    expect(atlasLandmarkLayer(byId["pale-shrine"])).toBe("sanctuaries");
    expect(atlasLandmarkLayer(byId["sunken-crown"])).toBe("lore");
    expect(atlasLandmarkTypeLabel(byId["whitemarch"])).toBe("Realm capital");
    expect(atlasLandmarkTypeLabel(byId["frostgate"])).toBe("Guarded border checkpoint");
    const whitemarchRoutes = atlasRoutesForLandmark(byId["whitemarch"]).map((route) => route.name);
    expect(whitemarchRoutes).toContain("The Crown Road");
    expect(whitemarchRoutes).toContain("The Salt Road");
  });

  it("declutters by zoom: continental anchors first, lore only up close", () => {
    const base = { visibleLayers: allLayers, focusedRealmId: null, selectedLandmarkId: null };
    expect(markerZoomTier(byId["whitemarch"])).toBe(0);
    expect(markerZoomTier(byId["mirecross"])).toBe(1);
    expect(markerZoomTier(byId["pale-shrine"])).toBe(2);
    expect(atlasMarkerVisible(byId["whitemarch"], { ...base, zoomRatio: 1 })).toBe(true);
    expect(atlasMarkerVisible(byId["mirecross"], { ...base, zoomRatio: 1 })).toBe(false);
    expect(atlasMarkerVisible(byId["mirecross"], { ...base, zoomRatio: 2 })).toBe(true);
    expect(atlasMarkerVisible(byId["pale-shrine"], { ...base, zoomRatio: 2 })).toBe(false);
    expect(atlasMarkerVisible(byId["pale-shrine"], { ...base, zoomRatio: 3 })).toBe(true);
    // Selection always survives filtering.
    expect(atlasMarkerVisible(byId["pale-shrine"], { ...base, zoomRatio: 1, selectedLandmarkId: "pale-shrine" })).toBe(true);
    // Realm focus hides minor markers of other realms.
    expect(atlasMarkerVisible(byId["mirecross"], { ...base, zoomRatio: 3, focusedRealmId: "west" })).toBe(false);
    expect(atlasMarkerVisible(byId["caer-selenya"], { ...base, zoomRatio: 3, focusedRealmId: "west" })).toBe(true);
  });

  it("grades landmark knowledge from campaign state", () => {
    const state = makeInitialState();
    expect(landmarkKnowledge(state, byId["whitemarch"])).toBe("charted");
    expect(landmarkKnowledge(state, byId["tellmar"])).toBe("legend");
    expect(landmarkKnowledge(state, byId["mirecross"])).toBe("reputation");
  });
});

describe("journey summaries", () => {
  it("formats march durations at every magnitude", () => {
    expect(formatTravelDuration(45)).toBe("45 min");
    expect(formatTravelDuration(60)).toBe("1 h");
    expect(formatTravelDuration(150)).toBe("2 h 30 min");
    expect(formatTravelDuration(60 * 24)).toBe("1 d");
    expect(formatTravelDuration(60 * 26 + 12)).toBe("1 d 2 h");
  });

  it("names authored waypoints along a route without generating tiles", () => {
    const crownRoad = CONTINENT_ROUTES.find((route) => route.id === "crown-road-east");
    const path = crownRoad.waypoints.map((waypoint) => ({ x: waypoint.x, y: waypoint.y }));
    const names = journeyWaypoints(path).map((waypoint) => waypoint.name);
    expect(names).toContain("Mirecross");
    expect(names).toContain("Crowsmoor");
    expect(names).not.toContain("Whitemarch"); // endpoints are skipped
  });

  it("summarizes a real journey with the same planner travel uses", () => {
    const state = makeInitialState();
    const mirecross = LANDMARKS.find((landmark) => landmark.id === "mirecross");
    const journey = summarizeAtlasJourney(state, mirecross.coord);
    expect(journey).not.toBeNull();
    expect(journey.totalSteps).toBeGreaterThan(0);
    expect(journey.kilometers).toBe(journey.totalSteps * CONTINENT.hexKilometers);
    expect(journey.estimatedMinutes).toBeGreaterThan(0);
    expect(journey.estimatedMinutes).toBe(pathMinutes(state, journey.fullPath));
    expect(typeof journey.duration).toBe("string");
    expect(journey.risk).toBeGreaterThanOrEqual(0);
    expect(journey.fullPath[0]).toEqual(state.world.currentTile);
  });

  it("returns null for the party's own position", () => {
    const state = makeInitialState();
    expect(summarizeAtlasJourney(state, state.world.currentTile)).toBeNull();
  });
});

describe("world atlas component", () => {
  it("renders an accessible interactive survey with every authored landmark control", () => {
    const state = makeInitialState();
    const html = renderToStaticMarkup(
      <WorldAtlas state={state} origin={state.world.currentTile} onPick={vi.fn()} />,
    );

    expect(html).toContain(`>${CONTINENT.name}</h3>`);
    expect(html).toContain('role="application"');
    expect(html).toContain("Arrow keys pan");
    expect(html.match(/class="world-atlas__marker /g)).toHaveLength(ATLAS_LANDMARKS.length);
    expect(html).toContain('aria-label="Five biome realms"');
    expect(html).toContain('aria-label="Atlas marker layers"');
    expect(html).toContain("Center map on the party");
    expect(html).toContain('aria-label="Fit the whole continent">116%</button>');
    expect(html).toContain(`${CONTINENT_SEA_LANES.length} sea lanes`);
    for (const realm of REALMS) expect(html).toContain(realm.shortName);
    for (const layer of ATLAS_LAYERS) expect(html).toContain(`>${layer.label}</span>`);

    // The survey must not leak hidden generated site identities.
    expect(html).not.toContain("HIDDEN AUTHORED SITE");
    expect(html).not.toContain("site:");
  });

  it("opens on the capital with lore detail and honest journey state", () => {
    const state = makeInitialState();
    const html = renderToStaticMarkup(
      <WorldAtlas state={state} origin={state.world.currentTile} onPick={vi.fn()} />,
    );

    expect(html).toContain('aria-label="Atlas entry for Whitemarch"');
    expect(html).toContain("Realm capital");
    expect(html).toContain("The Iron Concord");
    expect(html).toContain("Queen Aveline IV");
    expect(html).toContain("Set compass");
    // The party starts in Whitemarch, so no journey is offered to it.
    expect(html).toContain("The party is already here.");
    expect(html).toContain("The Crown Road");
  });

  it("lays a long journey out as a current march plus a muted continuation", () => {
    const state = makeInitialState();
    const tellmar = ATLAS_LANDMARKS.find((landmark) => landmark.id === "tellmar");
    const html = renderToStaticMarkup(
      <WorldAtlas state={state} origin={tellmar.coord} onPick={vi.fn()} />,
    );

    expect(html).toContain('class="world-atlas__journey-continuation"');
    expect(html).toContain('class="world-atlas__journey"');
    expect(html).toContain('class="world-atlas__leg-stop"');
    expect(html).toContain("Journey laid out");
    expect(html).toContain("Set route");
  });
});
