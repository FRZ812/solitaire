import { describe, expect, it } from "vitest";
import { buildWorldMapScene } from "./mapSceneModel.js";

describe("browser exploration scene contract", () => {
  it("does not disclose the real terrain of an unseen world cell", () => {
    const model = {
      origin: { x: 0, y: 0 },
      current: { key: "0,0" },
      viewport: [
        { key: "0,0", x: 0, y: 0, col: 0, row: 0, seen: true, visible: true, visited: true, passable: true, current: true, tile: { terrain: "road" } },
        { key: "1,0", x: 1, y: 0, col: 1, row: 0, seen: false, visible: false, visited: false, passable: true, current: false, tile: { terrain: "water", poi: { name: "Secret Port" } } },
      ],
    };
    const scene = buildWorldMapScene({ model, selection: null, journey: null });
    expect(scene.cells[0]).toMatchObject({ explored: true, visible: true, visibility: "visible" });
    expect(scene.cells[1]).toMatchObject({ terrain: "impassable", explored: false, seen: false, visible: false, visibility: "unknown", interactive: false, poi_name: "", poi_icon: "", poi_market_tier: "" });
  });

  it("serializes explicit service and wilderness marker identities for Canvas rendering", () => {
    const model = {
      origin: { x: 0, y: 0 },
      current: { key: "0,0" },
      viewport: [
        { key: "0,0", x: 0, y: 0, col: 0, row: 0, seen: true, visible: true, visited: true, passable: true, current: true, tile: { terrain: "settlement", poi: { name: "Great Stable", type: "stable", service: "stable", marketTier: "standard" } } },
        { key: "1,0", x: 1, y: 0, col: 1, row: 0, seen: true, visible: false, visited: false, passable: true, current: false, tile: { terrain: "forest", poi: { name: "Knifetooth Camp", type: "bandit-camp" } } },
      ],
    };
    const scene = buildWorldMapScene({ model, selection: null, journey: null });
    expect(scene.cells[0]).toMatchObject({ poi_name: "Great Stable", poi_icon: "trade-stable", poi_market_tier: "standard" });
    expect(scene.cells[1]).toMatchObject({ poi_name: "Knifetooth Camp", poi_icon: "wild-bandit-camp", poi_market_tier: "", visibility: "remembered" });
  });

  it("keeps a visited hex mapped even when an older sight record is incomplete", () => {
    const model = {
      origin: { x: 0, y: 0 },
      current: { key: "0,0" },
      viewport: [
        {
          key: "-1,0", x: -1, y: 0, col: 0, row: 0,
          seen: false, visible: false, visited: true, passable: true, current: false,
          tile: { terrain: "road", poi: { name: "Old Milepost", type: "landmark" } },
        },
      ],
    };

    const scene = buildWorldMapScene({ model, selection: null, journey: null });

    expect(scene.cells[0]).toMatchObject({
      terrain: "road",
      explored: true,
      seen: false,
      visible: false,
      visibility: "remembered",
      visited: true,
      interactive: true,
      poi_name: "Old Milepost",
    });
  });

  it("carries an in-flight party frame without changing the authoritative current hex", () => {
    const model = {
      origin: { x: 0, y: 0 },
      current: { key: "0,0" },
      viewport: [
        { key: "0,0", x: 0, y: 0, col: 0, row: 0, seen: true, visible: true, visited: true, passable: true, current: true, tile: { terrain: "road" } },
        { key: "1,0", x: 1, y: 0, col: 1, row: 0, seen: true, visible: true, visited: false, passable: true, current: false, tile: { terrain: "road" } },
      ],
    };
    const marchFrame = { fromKey: "0,0", toKey: "1,0", mix: 0.4, coord: { x: 0.4, y: 0 } };

    const scene = buildWorldMapScene({ model, selection: null, journey: null, marchFrame });

    expect(scene.current_key).toBe("0,0");
    expect(scene.party_march).toEqual(marchFrame);
  });
});
