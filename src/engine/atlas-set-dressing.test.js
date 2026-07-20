import { describe, expect, it } from "vitest";
import { CONTINENT_ROUTES, CONTINENT_WATERWAYS } from "../data/continent.js";
import {
  atlasSetDressingInternals,
  setDressingForChunk,
} from "./atlas-set-dressing.js";

describe("atlas set dressing", () => {
  it("is byte-stable regardless of chunk request order", () => {
    const requested = [[0, 0], [1, 0], [-1, 2], [4, -3]];
    const forward = Object.fromEntries(requested.map(([cx, cy]) => [
      `${cx},${cy}`,
      JSON.stringify(setDressingForChunk("dressing-order", cx, cy)),
    ]));
    const reverse = Object.fromEntries([...requested].reverse().map(([cx, cy]) => [
      `${cx},${cy}`,
      JSON.stringify(setDressingForChunk("dressing-order", cx, cy)),
    ]));
    expect(reverse).toEqual(forward);
  });

  it("keeps entries owned by the requested canonical chunk and within density bounds", () => {
    for (let cy = -3; cy <= 3; cy += 1) {
      for (let cx = -3; cx <= 3; cx += 1) {
        const entries = setDressingForChunk("dressing-density", cx, cy);
        expect(entries.length).toBeLessThanOrEqual(20);
        expect(entries.every((entry) => (
          atlasSetDressingInternals.chunkOwns(entry, cx, cy)
        ))).toBe(true);
        expect(entries.filter((entry) => entry.source === "scatter").length).toBeLessThanOrEqual(8);
      }
    }
  });

  it("only emits bridge entries at their named route and waterway crossing", () => {
    const routeById = new Map(CONTINENT_ROUTES.map((route) => [route.id, route]));
    const waterwayById = new Map(CONTINENT_WATERWAYS.map((waterway) => [waterway.id, waterway]));
    const bridges = [];
    for (let cy = -18; cy <= 17; cy += 1) {
      for (let cx = -24; cx <= 23; cx += 1) {
        bridges.push(...setDressingForChunk("dressing-bridges", cx, cy, { scatterCap: 0 })
          .filter((entry) => entry.kind === "bridge"));
      }
    }
    expect(bridges.length).toBeGreaterThan(0);
    for (const bridge of bridges) {
      expect(atlasSetDressingInternals.pathDistance(bridge, routeById.get(bridge.routeId).waypoints)).toBeLessThan(0.001);
      expect(atlasSetDressingInternals.pathDistance(bridge, waterwayById.get(bridge.waterwayId).waypoints)).toBeLessThan(0.001);
    }
  });

  it("keeps wild scatter away from named roads and waterways", () => {
    const entries = setDressingForChunk("dressing-clearance", 0, 0)
      .filter((entry) => entry.source === "scatter");
    for (const entry of entries) {
      expect(Math.min(...CONTINENT_ROUTES.map((route) => (
        atlasSetDressingInternals.pathDistance(entry, route.waypoints)
      )))).toBeGreaterThanOrEqual(3.5);
      expect(Math.min(...CONTINENT_WATERWAYS.map((waterway) => (
        atlasSetDressingInternals.pathDistance(entry, waterway.waypoints)
      )))).toBeGreaterThanOrEqual(3);
    }
  });
});
