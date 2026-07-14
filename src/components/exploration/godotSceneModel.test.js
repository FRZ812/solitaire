import { describe, expect, it } from "vitest";
import { buildCityGodotScene, buildWorldGodotScene } from "./godotSceneModel.js";

describe("Godot exploration scene contract", () => {
  it("does not disclose the real terrain of an unseen world cell", () => {
    const model = {
      origin: { x: 0, y: 0 },
      current: { key: "0,0" },
      viewport: [
        { key: "0,0", x: 0, y: 0, col: 0, row: 0, seen: true, visited: true, passable: true, current: true, tile: { terrain: "road" } },
        { key: "1,0", x: 1, y: 0, col: 1, row: 0, seen: false, visited: false, passable: true, current: false, tile: { terrain: "water", poi: { name: "Secret Port" } } },
      ],
    };
    const scene = buildWorldGodotScene({ model, selection: null, journey: null });
    expect(scene.cells[1]).toMatchObject({ terrain: "impassable", seen: false, interactive: false, poi_name: "" });
  });

  it("uses the same city cells for rendering, locations, and routes", () => {
    const model = {
      layout: { start: { x: 2, y: 2 }, market: { x: 4, y: 2 } },
      routeCellKeys: ["2,2", "3,2", "4,2"],
      viewport: [
        { key: "2,2", x: 2, y: 2, col: 0, row: 0, surface: "plaza", current: true, node: { id: "start", name: "Start", district: "Ward" } },
        { key: "3,2", x: 3, y: 2, col: 1, row: 0, surface: "street", current: false, node: null },
        { key: "4,2", x: 4, y: 2, col: 2, row: 0, surface: "plaza", current: false, node: { id: "market", name: "Market", district: "Ward" } },
      ],
    };
    const scene = buildCityGodotScene({ model, current: model.viewport[0].node, selected: model.viewport[2].node, districtColors: { Ward: "#abcdef" } });
    expect(scene.current_key).toBe("2,2");
    expect(scene.selected_key).toBe("4,2");
    expect(scene.route).toEqual(["2,2", "3,2", "4,2"]);
    expect(scene.cells[2].poi_name).toBe("Market");
  });
});
