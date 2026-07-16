import { describe, expect, it } from "vitest";
import { buildWorldMapScene } from "./mapSceneModel.js";

describe("browser exploration scene contract", () => {
  it("does not disclose the real terrain of an unseen world cell", () => {
    const model = {
      origin: { x: 0, y: 0 },
      current: { key: "0,0" },
      viewport: [
        { key: "0,0", x: 0, y: 0, col: 0, row: 0, seen: true, visited: true, passable: true, current: true, tile: { terrain: "road" } },
        { key: "1,0", x: 1, y: 0, col: 1, row: 0, seen: false, visited: false, passable: true, current: false, tile: { terrain: "water", poi: { name: "Secret Port" } } },
      ],
    };
    const scene = buildWorldMapScene({ model, selection: null, journey: null });
    expect(scene.cells[1]).toMatchObject({ terrain: "impassable", seen: false, interactive: false, poi_name: "", poi_icon: "", poi_market_tier: "" });
  });

  it("serializes explicit service and wilderness marker identities for Canvas rendering", () => {
    const model = {
      origin: { x: 0, y: 0 },
      current: { key: "0,0" },
      viewport: [
        { key: "0,0", x: 0, y: 0, col: 0, row: 0, seen: true, visited: true, passable: true, current: true, tile: { terrain: "settlement", poi: { name: "Great Stable", type: "stable", service: "stable", marketTier: "standard" } } },
        { key: "1,0", x: 1, y: 0, col: 1, row: 0, seen: true, visited: false, passable: true, current: false, tile: { terrain: "forest", poi: { name: "Knifetooth Camp", type: "bandit-camp" } } },
      ],
    };
    const scene = buildWorldMapScene({ model, selection: null, journey: null });
    expect(scene.cells[0]).toMatchObject({ poi_name: "Great Stable", poi_icon: "trade-stable", poi_market_tier: "standard" });
    expect(scene.cells[1]).toMatchObject({ poi_name: "Knifetooth Camp", poi_icon: "wild-bandit-camp", poi_market_tier: "" });
  });
});
