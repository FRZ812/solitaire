import { describe, expect, it } from "vitest";
import { compileDefaultWorldMap } from "../data/handcrafted-map.js";
import { buildHandcrafted } from "../data/handcrafted-pipeline.js";
import { DEFAULT_NODES } from "../data/world-map-default.js";
import { findWorldRoute } from "./world.js";

function stateWithTiles(tiles) {
  return {
    world: {
      currentTile: { x: 0, y: 0 },
      tiles,
      seen: Object.fromEntries(Object.keys(tiles).map((key) => [key, true])),
    },
  };
}

describe("expedition route planning", () => {
  it("reaches every named node in the default atlas, including outdoor endpoints", () => {
    const tiles = buildHandcrafted({ tiles: compileDefaultWorldMap(), sealedStructures: [] });
    const state = stateWithTiles(tiles);
    for (const node of DEFAULT_NODES) {
      const route = findWorldRoute(state, { x: 0, y: 0 }, node);
      expect(route, node.name).toBeTruthy();
      expect(route.at(-1)).toEqual({ x: node.x, y: node.y });
    }
  });

  it("follows a dogleg authored trail rather than greedily stalling", () => {
    const coords = [[0, 0], [1, 0], [1, -1], [1, -2], [2, -2], [3, -2]];
    const tiles = Object.fromEntries(coords.map(([x, y], index) => [`${x},${y}`, {
      terrain: "road",
      doors: [coords[index - 1], coords[index + 1]].filter(Boolean).map(([dx, dy]) => ({ x: dx, y: dy })),
    }]));
    const route = findWorldRoute(stateWithTiles(tiles), { x: 0, y: 0 }, { x: 3, y: -2 });
    expect(route).toEqual(coords.map(([x, y]) => ({ x, y })));
  });

  it("does not cross an authored closed edge", () => {
    const tiles = {
      "0,0": { terrain: "road", doors: [] },
      "1,0": { terrain: "road", doors: [] },
    };
    expect(findWorldRoute(stateWithTiles(tiles), { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNull();
  });
});
