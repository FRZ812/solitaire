import { describe, expect, it } from "vitest";
import { getPlace } from "../../engine/place.js";
import {
  PLACE_VIEW_COLS,
  PLACE_VIEW_ROWS,
  buildPlaceViewport,
  findPlaceRoute,
  nextPlaceNode,
  placeGrid,
} from "./placeModel.js";

describe("place RPG viewport", () => {
  const whitemarch = getPlace("whitemarch");

  it("plots every Whitemarch landmark on a unique city cell", () => {
    const layout = placeGrid(whitemarch);
    expect(Object.keys(layout)).toHaveLength(Object.keys(whitemarch.nodes).length);
    const occupied = new Set(Object.values(layout).map(({ x, y }) => `${x},${y}`));
    expect(occupied.size).toBe(Object.keys(whitemarch.nodes).length);
  });

  it("builds an 11 by 9 camera with the player visible", () => {
    const model = buildPlaceViewport(whitemarch, "grain-square");
    expect(model.viewport).toHaveLength(PLACE_VIEW_COLS * PLACE_VIEW_ROWS);
    expect(model.viewport.find((cell) => cell.current)?.node?.id).toBe("grain-square");
  });

  it("plans a legal route across multiple wards", () => {
    const route = findPlaceRoute(whitemarch, "grain-square", "iron-palace");
    expect(route[0]).toBe("grain-square");
    expect(route.at(-1)).toBe("iron-palace");
    for (let index = 1; index < route.length; index++) {
      expect(whitemarch.nodes[route[index - 1]].exits).toContain(route[index]);
    }
    const model = buildPlaceViewport(whitemarch, "grain-square", "iron-palace");
    expect(model.route).toEqual(route);
    expect(model.routePoints).toHaveLength(route.length);
  });

  it("moves the cursor toward the nearest landmark in a direction", () => {
    const layout = placeGrid(whitemarch);
    const east = nextPlaceNode(whitemarch, layout, "grain-square", 1, 0);
    expect(east).toBeTruthy();
    expect(layout[east.id].x).toBeGreaterThan(layout["grain-square"].x);
  });
});
