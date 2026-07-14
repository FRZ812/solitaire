import { describe, expect, it } from "vitest";
import { getPlace } from "../../engine/place.js";
import {
  PLACE_VIEW_COLS,
  PLACE_VIEW_ROWS,
  buildPlaceGeometry,
  buildPlaceViewport,
  buildPlaceSurfaceMap,
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
    expect(model.routePoints.length).toBeGreaterThanOrEqual(route.length);
    expect(model.routeCellKeys[0]).toBe(`${model.layout[route[0]].x},${model.layout[route[0]].y}`);
    expect(model.routeCellKeys.at(-1)).toBe(`${model.layout[route.at(-1)].x},${model.layout[route.at(-1)].y}`);
  });

  it("paints the walk graph into the same city surface used by the renderer", () => {
    const layout = placeGrid(whitemarch);
    const surfaces = buildPlaceSurfaceMap(whitemarch, layout);
    const model = buildPlaceViewport(whitemarch, "grain-square", "iron-palace");
    const routeLandmarks = new Set(model.route.map((id) => `${layout[id].x},${layout[id].y}`));
    for (const key of model.routeCellKeys.slice(1, -1)) {
      if (surfaces.get(key) === "wall") expect(routeLandmarks.has(key)).toBe(true);
      else expect(["street", "avenue", "plaza", "roof"]).toContain(surfaces.get(key));
    }
  });

  it("keeps every graph edge out of rivers, walls, and unrelated landmarks", () => {
    const layout = placeGrid(whitemarch);
    const geometry = buildPlaceGeometry(whitemarch, layout);
    const landmarkKeys = new Set(Object.values(layout).map(({ x, y }) => `${x},${y}`));
    const checked = new Set();

    for (const node of Object.values(whitemarch.nodes)) {
      for (const exitId of node.exits || []) {
        const key = [node.id, exitId].sort().join("|");
        if (checked.has(key)) continue;
        checked.add(key);
        const corridor = geometry.corridors.get(key);
        expect(corridor?.points.length, key).toBeGreaterThan(1);
        for (let index = 1; index < corridor.points.length; index++) {
          const previous = corridor.points[index - 1];
          const point = corridor.points[index];
          expect(Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y), key).toBe(1);
        }
        for (const point of corridor.points.slice(1, -1)) {
          const pointKey = `${point.x},${point.y}`;
          expect(landmarkKeys.has(pointKey), `${key} crosses ${pointKey}`).toBe(false);
          expect(["wall", "river"], `${key} crosses ${geometry.surfaces.get(pointKey)}`).not.toContain(geometry.surfaces.get(pointKey));
        }
      }
    }
  });

  it("moves the cursor toward the nearest landmark in a direction", () => {
    const layout = placeGrid(whitemarch);
    const east = nextPlaceNode(whitemarch, layout, "grain-square", 1, 0);
    expect(east).toBeTruthy();
    expect(layout[east.id].x).toBeGreaterThan(layout["grain-square"].x);
  });
});
