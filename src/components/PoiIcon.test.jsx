import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BUILDINGS } from "../data/town.js";
import { assetKeyForTile } from "./MapView.jsx";
import {
  CITY_POI_ICONS,
  isPoiIcon,
  PoiIcon,
  POI_LEGEND_GROUPS,
  poiIconKeyForLandmark,
  poiIconKeyForTile,
  TRADE_POI_ICONS,
  WILDERNESS_POI_ICONS,
} from "./PoiIcon.jsx";

function serviceTile(service, type = "market", terrain = "settlement") {
  return { terrain, poi: { type, service, name: service } };
}

describe("POI icon atlases", () => {
  it("defines three complete, non-overlapping 4x4 atlases", () => {
    expect(POI_LEGEND_GROUPS.map(({ items }) => items.length)).toEqual([16, 16, 16]);
    for (const icons of [TRADE_POI_ICONS, CITY_POI_ICONS, WILDERNESS_POI_ICONS]) {
      const cells = Object.values(icons).map(({ col, row }) => `${col},${row}`);
      expect(new Set(cells).size).toBe(16);
    }
    expect(new Set(POI_LEGEND_GROUPS.flatMap(({ items }) => items.map(({ key }) => key))).size).toBe(48);
  });

  it.each([
    ["trade-stable", "trade-poi-atlas-v1.png"],
    ["poi-bathhouse", "city-poi-atlas-v1.png"],
    ["wild-bridge", "wilderness-poi-atlas-v1.png"],
  ])("crops %s from its assigned atlas", (iconKey, atlasName) => {
    const html = renderToStaticMarkup(<PoiIcon iconKey={iconKey} size={30} title="Map marker" />);
    expect(html).toContain(`data-poi-icon="${iconKey}"`);
    expect(html).toContain('aria-label="Map marker"');
    expect(html).toContain(atlasName);
  });

  it("uses stable fractional cell geometry", () => {
    const html = renderToStaticMarkup(<PoiIcon iconKey="trade-stable" size={30} />);
    expect(html).toContain('viewBox="940.5 0 313.5 313.5"');
  });

  it("adds a skill-style color ring and letter pip for an authored POI market tier", () => {
    const html = renderToStaticMarkup(<PoiIcon iconKey="trade-magic" size={30} title="Magic shop" marketTier="royal" />);
    expect(html).toContain('data-poi-tier="royal"');
    expect(html).toContain('aria-label="Magic shop · Royal house"');
    expect(html).toContain("#e0913a");
    expect(html).toContain(">R</text>");
  });
});

describe("map POI marker selection", () => {
  it.each([
    ["stable", "trade-stable"],
    ["farrier", "trade-stable"],
    ["blacksmith", "trade-smith"],
    ["leather-worker", "trade-equipment"],
    ["magic-shop", "trade-magic"],
    ["herbalist", "trade-herbalist"],
    ["apothecary", "trade-alchemist"],
    ["healer", "trade-healer"],
    ["general-store", "trade-general"],
    ["sutler", "trade-provisions"],
    ["money-changer", "trade-money"],
    ["carriage-wright", "trade-transport"],
    ["fishmonger", "trade-fish"],
    ["chandler", "trade-chandler"],
    ["foreign-trader", "trade-foreign"],
    ["tavern", "trade-tavern"],
    ["inn", "poi-inn"],
    ["gaol", "poi-prison"],
    ["slavemarket", "poi-slave-market"],
  ])("maps service %s to %s before its generic POI shape", (service, expected) => {
    expect(BUILDINGS[service]?.icon).toBe(expected);
    expect(isPoiIcon(expected)).toBe(true);
    expect(assetKeyForTile(serviceTile(service))).toBe(expected);
  });

  it.each([
    ["palace", "poi-palace"], ["restaurant", "poi-restaurant"], ["park", "poi-park"],
    ["brothel", "poi-brothel"], ["bathhouse", "poi-bathhouse"], ["archive", "poi-library"],
    ["bandit-camp", "wild-bandit-camp"], ["monster-den", "wild-monster-den"],
    ["wandering-merchant", "wild-merchant"], ["caravan", "wild-caravan"],
    ["cave", "wild-cave"], ["dungeon", "wild-dungeon"], ["checkpoint", "wild-checkpoint"],
    ["ruin", "wild-ruin"], ["fortress", "wild-fortress"], ["manor", "wild-manor"],
  ])("maps typed POI %s to %s", (type, expected) => {
    expect(poiIconKeyForTile({ terrain: "plains", poi: { type, name: type } })).toBe(expected);
  });

  it("distinguishes an urban priest from a wayside shrine", () => {
    expect(poiIconKeyForTile({ terrain: "settlement", cityId: "whitemarch", poi: { type: "temple" } })).toBe("trade-priest");
    expect(poiIconKeyForTile({ terrain: "forest", poi: { type: "shrine" } })).toBe("wild-shrine");
  });

  it("maps continental kinds and guarded borders", () => {
    expect(poiIconKeyForLandmark({ kind: "village" })).toBe("wild-village");
    expect(poiIconKeyForLandmark({ kind: "port" })).toBe("poi-docks");
    expect(poiIconKeyForLandmark({ kind: "landmark", role: "border-checkpoint" })).toBe("wild-checkpoint");
    expect(poiIconKeyForLandmark({ kind: "city", capitalOfRealmId: "north" })).toBe("poi-palace");
  });

  it("does not leak a marker through hidden or wall POIs", () => {
    expect(assetKeyForTile(serviceTile("stable", "hidden"))).toBe("unknown");
    expect(assetKeyForTile(serviceTile("stable", "market", "wall"))).toBeNull();
  });
});
