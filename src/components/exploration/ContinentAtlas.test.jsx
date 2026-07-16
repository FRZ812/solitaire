import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  CONTINENT,
  COASTAL_FEATURES,
  CONTINENT_ROUTES,
  CONTINENT_SEA_LANES,
  LANDMARKS,
  PROVINCES,
  REALM_CULTURES,
  REALM_ECONOMIES,
  REALM_FACTIONS,
  REALMS,
  REGION_DEFINITIONS,
} from "../../data/continent.js";
import { makeInitialState } from "../../data/initial-state.js";
import { buildExplorationModel } from "./atlasModel.js";
import {
  CONTINENT_ATLAS_LANDMARKS,
  CONTINENT_ATLAS_LAYERS,
  ContinentAtlas,
  atlasLandmarkIsVisible,
  atlasLandmarkLayer,
  atlasRouteEmphasis,
  atlasRoutesForLandmark,
} from "./ContinentAtlas.jsx";

describe("continent atlas", () => {
  it("renders the finite seeded survey and only reviewed known landmark controls", () => {
    const state = makeInitialState();
    const html = renderToStaticMarkup(
      <ContinentAtlas state={state} origin={state.world.currentTile} onPick={vi.fn()} />,
    );

    expect(html).toContain(`>${CONTINENT.name}</h3>`);
    expect(html).toContain(`${CONTINENT.hexKilometers} km / hex`);
    expect(html.match(/class="continent-atlas__cell /g)).toHaveLength(48 * 26);
    expect(html.match(/class="continent-atlas__marker /g)).toHaveLength(CONTINENT_ATLAS_LANDMARKS.length);
    expect(html).toContain("Inspect Whitemarch, capitals, known by reputation");
    expect(html).toContain(`${Object.keys(REGION_DEFINITIONS).length} named regions`);
    for (const landmark of LANDMARKS) expect(html).toContain(landmark.name);

    // Generated-site blueprints are intentionally retained only inside tiles;
    // the continental survey must not reveal their hidden identities.
    expect(html).not.toContain("site:");
    expect(html).not.toContain("HIDDEN AUTHORED SITE");

    const knownLandmarks = buildExplorationModel(state).landmarks.filter((landmark) => landmark.knownBy);
    for (const landmark of knownLandmarks) {
      expect(CONTINENT_ATLAS_LANDMARKS.some((entry) => (
        entry.coord.x === landmark.x && entry.coord.y === landmark.y
      ))).toBe(true);
    }
  });

  it("keeps one expandable continent map with five selectable biome realms and road overlays", () => {
    const state = makeInitialState();
    const html = renderToStaticMarkup(
      <ContinentAtlas state={state} origin={state.world.currentTile} onPick={vi.fn()} />,
    );

    expect(html.match(/id="continent-atlas-world-map"/g)).toHaveLength(1);
    expect(html).toContain("world-atlas-spread-v1.jpg");
    expect(html.match(/class="continent-atlas__coastline"/g)).toHaveLength(1);
    expect(html).toContain('aria-controls="continent-atlas-world-map"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Expand world view");
    expect(html.match(/class="continent-atlas__route"/g)).toHaveLength(CONTINENT_ROUTES.length);
    expect(html.match(/class="continent-atlas__sea-lane"/g)).toHaveLength(CONTINENT_SEA_LANES.length);
    expect(html.match(/class="continent-atlas__water-label /g)).toHaveLength(COASTAL_FEATURES.length);
    expect(html.match(/ is-port /g)).toHaveLength(LANDMARKS.filter((landmark) => landmark.kind === "port").length);
    expect(html).toContain('aria-label="Five biome realms"');
    expect(html).toContain('aria-label="Atlas marker layers"');
    for (const layer of CONTINENT_ATLAS_LAYERS) {
      expect(html).toContain(`>${layer.label}</span>`);
      expect(html).toContain(`is-category-${layer.id}`);
    }
    const minorLandmarks = CONTINENT_ATLAS_LANDMARKS.filter((landmark) => (
      !landmark.capitalOfRealmId
      && landmark.kind !== "port"
      && landmark.role !== "border-checkpoint"
    ));
    expect(html.match(/hidden="" class="continent-atlas__marker/g)).toHaveLength(minorLandmarks.length);
    expect(html).toContain('aria-label="Compact world map"');
    for (const feature of COASTAL_FEATURES) expect(html).toContain(feature.name);
    for (const realm of REALMS) {
      expect(html).toContain(realm.shortName);
      expect(html).toContain(realm.biomeName);
    }
    expect(html).toContain(`${PROVINCES.length} provinces`);
    expect(html).toContain(`${CONTINENT_SEA_LANES.length} sea lanes`);
  });

  it("opens on a useful capital entry with realm, faction, ruler, and route details", () => {
    const central = REALMS.find((realm) => realm.id === "central");
    const province = PROVINCES.find((entry) => entry.seatLandmarkId === "whitemarch");
    const faction = REALM_FACTIONS.find((entry) => entry.id === province.authorityFactionId);
    const culture = REALM_CULTURES.find((entry) => entry.realmId === "central");
    const economy = REALM_ECONOMIES.find((entry) => entry.realmId === "central");
    const state = makeInitialState();
    const html = renderToStaticMarkup(
      <ContinentAtlas state={state} origin={state.world.currentTile} onPick={vi.fn()} />,
    );

    expect(html).toContain('aria-label="Atlas entry for Whitemarch"');
    expect(html).toContain(central.name);
    expect(html).toContain(province.name);
    expect(html).toContain(faction.name);
    expect(html).toContain(faction.leader.name);
    expect(html).toContain(culture.demonym);
    expect(html).toContain(culture.languages[0]);
    expect(html).toContain(economy.exports[0]);
    expect(html).toContain(province.resources[0]);
    expect(html).toContain("Set compass");
    expect(html).toContain("0 travel hexes");
    expect(html).toContain("Connected routes");
    expect(html).toContain("The Crown Road");
  });

  it("assigns a readable marker hierarchy and derives roads from authored waypoints", () => {
    const byId = Object.fromEntries(CONTINENT_ATLAS_LANDMARKS.map((landmark) => [landmark.id, landmark]));

    expect(atlasLandmarkLayer(byId["whitemarch"])).toBe("capitals");
    expect(atlasLandmarkLayer(byId["mirecross"])).toBe("settlements");
    expect(atlasLandmarkLayer(byId["greenharbor"])).toBe("ports");
    expect(atlasLandmarkLayer(byId["frostgate"])).toBe("strongholds");
    expect(atlasLandmarkLayer(byId["pale-shrine"])).toBe("sanctuaries");
    expect(atlasLandmarkLayer(byId["sunken-crown"])).toBe("lore");

    const whitemarchRoutes = atlasRoutesForLandmark(byId["whitemarch"]).map((route) => route.name);
    expect(whitemarchRoutes).toContain("The Crown Road");
    expect(whitemarchRoutes).toContain("The Salt Road");
  });

  it("keeps compact mode legible and prioritizes the focused realm when expanded", () => {
    const byId = Object.fromEntries(CONTINENT_ATLAS_LANDMARKS.map((landmark) => [landmark.id, landmark]));
    const allLayers = new Set(CONTINENT_ATLAS_LAYERS.map((layer) => layer.id));
    const compact = { expanded: false, focusedRealmId: null, selectedLandmarkId: "whitemarch", visibleLayers: allLayers };

    expect(atlasLandmarkIsVisible(byId["whitemarch"], compact)).toBe(true);
    expect(atlasLandmarkIsVisible(byId["greenharbor"], compact)).toBe(true);
    expect(atlasLandmarkIsVisible(byId["frostgate"], compact)).toBe(true);
    expect(atlasLandmarkIsVisible(byId["mirecross"], compact)).toBe(false);

    const westFocus = { ...compact, expanded: true, focusedRealmId: "west", selectedLandmarkId: "caer-selenya" };
    expect(atlasLandmarkIsVisible(byId["bone-citadel"], westFocus)).toBe(true);
    expect(atlasLandmarkIsVisible(byId["wintermere"], westFocus)).toBe(false);
    expect(atlasLandmarkIsVisible(byId["northstar-castle"], westFocus)).toBe(true);

    expect(atlasRouteEmphasis(CONTINENT_ROUTES.find((route) => route.id === "bramble-road"), "west")).toBe("is-focused");
    expect(atlasRouteEmphasis(CONTINENT_ROUTES.find((route) => route.id === "north-road"), "west")).toBe("is-muted");
  });
});
