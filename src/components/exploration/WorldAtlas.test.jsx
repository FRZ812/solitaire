import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  CONTINENT,
  CONTINENT_ROUTES,
  LANDMARKS,
} from "../../data/continent.js";
import { makeInitialState } from "../../data/initial-state.js";
import { sampleContinent, surveyAtlas } from "../../engine/world-generation.js";
import { pathMinutes } from "../../engine/world.js";
import {
  ATLAS_PAPER_ENTER_RATIO,
  WorldAtlas,
  atlasDisplayedPartyCoord,
  atlasMarchCoordAt,
  atlasMarchDuration,
  atlasModeForZoom,
  atlasModeForScene,
  centerAtlasMarchCamera,
  atlasKeyboardShortcutAllowed,
  atlasSelectionClickAllowed,
  atlasWheelZoomAllowed,
  atlasWheelZoomFactor,
} from "./WorldAtlas.jsx";
import { atlas3dWindowFloor } from "./worldAtlas3dModel.js";
import {
  ATLAS_LANDMARKS,
  ATLAS_LAYERS,
  atlasFitZoom,
  atlasLandmarkLayer,
  atlasLandmarkTypeLabel,
  atlasMarkerVisible,
  atlasRoutesForLandmark,
  formatTravelDuration,
  journeyWaypoints,
  landmarkKnowledge,
  markerZoomTier,
  summarizeAtlasJourney,
} from "./worldAtlasModel.js";

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

describe("atlas interaction helpers", () => {
  it("uses hysteresis when handing one camera between paper and 3D projections", () => {
    expect(atlasModeForZoom("3d", 8.1, 1)).toBe("3d");
    expect(atlasModeForZoom("3d", 7.99, 1)).toBe("paper");
    expect(atlasModeForZoom("paper", 8.59, 1)).toBe("paper");
    expect(atlasModeForZoom("paper", 8.6, 1)).toBe("3d");
    expect(atlasModeForZoom("paper", 8.8, 1, 9)).toBe("paper");
    expect(atlasModeForZoom("paper", 9, 1, 9)).toBe("3d");
  });

  it("preserves the intended 3D opening while chunks load and sticks to paper after failure", () => {
    expect(atlasModeForScene("3d", "loading", 8.2, 1, 8)).toBe("3d");
    expect(atlasModeForScene("3d", "error", 12, 1, 8)).toBe("paper");
    expect(atlasModeForScene("paper", "ready", 9, 1, 8)).toBe("3d");
  });

  it("interpolates the party along a bounded visual-only march", () => {
    const path = [{ x: 0, y: 0 }, { x: 1, y: -1 }, { x: 3, y: -1 }];
    expect(atlasMarchCoordAt(path, 0)).toEqual(path[0]);
    expect(atlasMarchCoordAt(path, 0.25)).toEqual({ x: 0.5, y: -0.5 });
    expect(atlasMarchCoordAt(path, 0.75)).toEqual({ x: 2, y: -1 });
    expect(atlasMarchCoordAt(path, 1)).toEqual(path[2]);
    expect(atlasMarchDuration(path)).toBe(1_800);
    expect(atlasMarchDuration(Array.from({ length: 101 }, (_, x) => ({ x, y: 0 })))).toBe(6_000);
  });

  it("keeps a responsive march on paper until the local 3D window is ready", () => {
    const viewport = { width: 390, height: 700 };
    const fitZoom = atlasFitZoom(viewport);
    const windowFloor = atlas3dWindowFloor(viewport, CONTINENT.seed);
    const camera = { x: 0, y: 0, zoom: 20 };
    const coord = { x: 55, y: 10 };
    const loading = centerAtlasMarchCamera(camera, coord, {
      viewport,
      fitZoom,
      windowFloor,
      seed: CONTINENT.seed,
      sceneState: "loading",
    });
    const ready = centerAtlasMarchCamera(loading.camera, coord, {
      viewport,
      fitZoom,
      windowFloor,
      seed: CONTINENT.seed,
      sceneState: "ready",
    });

    expect(loading.mode).toBe("paper");
    expect(loading.camera.zoom).toBeLessThan(fitZoom * ATLAS_PAPER_ENTER_RATIO);
    expect(ready.mode).toBe("3d");
    expect(ready.camera.zoom).toBeGreaterThanOrEqual(windowFloor);
    expect(ready.camera.zoom).toBeGreaterThanOrEqual(fitZoom * 8.6);
  });

  it("falls back to authoritative party state as soon as a visual march settles", () => {
    const party = { x: 0, y: 0 };
    const interpolated = { x: 12.5, y: -3 };
    expect(atlasDisplayedPartyCoord(interpolated, party, false)).toBe(interpolated);
    expect(atlasDisplayedPartyCoord(interpolated, party, true)).toBe(party);
    expect(atlasDisplayedPartyCoord(null, party, false)).toBe(party);
  });

  it("turns smooth wheel deltas into proportional zoom instead of a full step per event", () => {
    expect(atlasWheelZoomFactor(-100)).toBeCloseTo(1.22, 6);
    expect(atlasWheelZoomFactor(100)).toBeCloseTo(1 / 1.22, 6);
    expect(atlasWheelZoomFactor(-5)).toBeGreaterThan(1);
    expect(atlasWheelZoomFactor(-5)).toBeLessThan(1.02);
    expect(atlasWheelZoomFactor(0)).toBe(1);
  });

  it("leaves wheel events from atlas UI chrome to their own scrollers", () => {
    expect(atlasWheelZoomAllowed({ closest: () => ({}) })).toBe(false);
    expect(atlasWheelZoomAllowed({ closest: () => null })).toBe(true);
  });

  it("blocks a marker's pointer click after map movement without blocking keyboard activation", () => {
    expect(atlasSelectionClickAllowed({ detail: 1 }, { suppressClick: true })).toBe(false);
    expect(atlasSelectionClickAllowed({ detail: 0 }, { suppressClick: true })).toBe(true);
    expect(atlasSelectionClickAllowed({ detail: 1 }, { suppressClick: false })).toBe(true);
  });

  it("leaves keyboard input inside the shared toolbar to its focused control", () => {
    expect(atlasKeyboardShortcutAllowed({ closest: () => ({}) })).toBe(false);
    expect(atlasKeyboardShortcutAllowed({ closest: () => null })).toBe(true);
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
    // The atlas has one permanent 3D renderer and never mounts the retired
    // raster/SVG chart while its terrain is preparing.
    expect(html).toContain('class="world-atlas"');
    expect(html).toContain('class="world-atlas__plane is-3d"');
    expect(html).toContain('class="world-atlas__webgl"');
    expect(html).toContain('class="world-atlas__scene-status"');
    expect(html).toContain("Preparing persistent terrain");
    expect(html).not.toContain('class="world-atlas__canvas"');
    expect(html).not.toContain('class="world-atlas__vector"');
    expect(html).not.toContain('class="world-atlas__coastline"');
    expect(html).not.toContain("Switch to the flat chart view");
    expect(html).not.toContain("Switch to the tabletop 3D view");
    expect(html).not.toContain('class="world-atlas__dimension"');
    expect(html).toContain(`aria-label="Search ${ATLAS_LANDMARKS.length} charted places"`);
    expect(html).toContain(">Find a place</span>");
    expect(html.match(/class="world-atlas__marker /g)).toHaveLength(ATLAS_LANDMARKS.length);
    expect(html).toContain('aria-controls="world-atlas-filters"');
    expect(html).toContain(">Map filters</span>");
    expect(html).toContain("Center map on the party");
    expect(html).toContain('aria-label="Fit the whole continent"');
    expect(html.match(/data-atlas-wheel-ignore="true"/g)).toHaveLength(3);
    expect(html).not.toContain('class="world-atlas__placecard');
    expect(html).not.toContain('class="world-atlas__compass-rose"');

    // The survey must not leak hidden generated site identities.
    expect(html).not.toContain("HIDDEN AUTHORED SITE");
    expect(html).not.toContain("site:");
  });

  it("keeps the opening map clear and shows capital detail only after an intentional selection", () => {
    const state = makeInitialState();
    const html = renderToStaticMarkup(
      <WorldAtlas
        state={state}
        origin={state.world.currentTile}
        onPick={vi.fn()}
        initialSelection={{ kind: "landmark", id: "whitemarch" }}
      />,
    );

    expect(html).toContain('aria-label="Atlas entry for Whitemarch"');
    expect(html).toContain("Realm capital");
    expect(html).toContain("The Iron Concord");
    expect(html).toContain("Queen Aveline IV");
    expect(html).toContain("Details");
    expect(html).not.toContain("Set destination");
    // The party starts in Whitemarch, so no journey is offered to it.
    expect(html).toContain("The party is already here.");
    expect(html).toContain("The Crown Road");
  });

  it("passes a long journey to the 3D scene without resurrecting SVG route layers", () => {
    const state = makeInitialState();
    const tellmar = ATLAS_LANDMARKS.find((landmark) => landmark.id === "tellmar");
    const html = renderToStaticMarkup(
      <WorldAtlas
        state={state}
        origin={state.world.currentTile}
        onPick={vi.fn()}
        initialSelection={{ kind: "landmark", id: tellmar.id }}
      />,
    );

    expect(html).not.toContain('class="world-atlas__journey-continuation"');
    expect(html).not.toContain('class="world-atlas__journey"');
    expect(html).not.toContain('class="world-atlas__leg-stop"');
    expect(html).not.toContain('class="world-atlas__vector"');
    expect(html).toContain("Route preview");
    expect(html).toContain("Set destination");
  });

  it("does not offer an unreachable selection as a destination", () => {
    const state = makeInitialState();
    const seaPoint = { x: CONTINENT.bounds.xmin, y: CONTINENT.bounds.ymin };
    expect(sampleContinent(seaPoint.x, seaPoint.y, CONTINENT.seed).land).toBe(false);

    const html = renderToStaticMarkup(
      <WorldAtlas
        state={state}
        origin={state.world.currentTile}
        onPick={vi.fn()}
        initialSelection={{ kind: "point", ...seaPoint }}
      />,
    );

    expect(html).toContain("No ground route reaches this point");
    expect(html).not.toContain("Set destination");
  });
});
