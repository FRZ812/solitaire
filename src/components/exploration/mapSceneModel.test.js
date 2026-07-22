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

  it("never serializes an unknown route coordinate into the Canvas scene", () => {
    const model = {
      origin: { x: 0, y: 0 },
      current: { key: "0,0" },
      viewport: [
        { key: "0,0", x: 0, y: 0, seen: true, visible: true, visited: true, explored: true, tile: { terrain: "road" } },
        { key: "1,0", x: 1, y: 0, seen: true, visible: false, visited: false, explored: true, tile: { terrain: "road" } },
        { key: "2,0", x: 2, y: 0, seen: false, visible: false, visited: false, explored: false, tile: { terrain: "marsh" } },
      ],
    };
    const journey = { legPath: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] };

    const scene = buildWorldMapScene({ model, selection: null, journey });

    expect(scene.route).toEqual(["0,0", "1,0", null]);
    expect(JSON.stringify(scene.route)).not.toContain("2,0");
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

  it("carries only the public tracked-character lead into the renderer", () => {
    const model = {
      origin: { x: 0, y: 0 },
      current: { key: "0,0" },
      viewport: [],
    };
    const trackedCharacter = {
      id: "envoy",
      name: "Nadira",
      pos: { x: 4, y: -2, exact: false },
      character: { secret: "must not enter render data" },
    };

    const scene = buildWorldMapScene({ model, selection: null, journey: null, trackedCharacter });

    expect(scene.tracked_character).toEqual({
      id: "envoy",
      name: "Nadira",
      pos: { x: 4, y: -2 },
      exact: false,
      uncertainty_radius: expect.any(Number),
    });
    expect(scene.tracked_character.uncertainty_radius).toBeGreaterThanOrEqual(2);
    expect(scene.tracked_character.character).toBeUndefined();
  });

  it("does not draw an exact tracked position through unknown fog", () => {
    const model = {
      origin: { x: 0, y: 0 },
      current: { key: "0,0" },
      viewport: [
        { key: "4,-2", x: 4, y: -2, seen: false, visible: false, visited: false, explored: false, tile: { terrain: "forest" } },
      ],
    };

    const scene = buildWorldMapScene({
      model,
      selection: null,
      journey: null,
      trackedCharacter: { id: "envoy", name: "Nadira", pos: { x: 4, y: -2, exact: true } },
    });

    expect(scene.tracked_character).toBeNull();
  });
});
