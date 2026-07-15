import { describe, expect, it } from "vitest";
import { buildMapLayout, buildRouteSegments, findInteractiveEntry, pointInPolygon } from "./mapGeometry.js";

describe("browser map geometry", () => {
  it("fits axial world cells into a pointy-top hex layout", () => {
    const scene = {
      mode: "world",
      origin: { x: 0, y: 0 },
      cells: [
        { key: "0,0", x: 0, y: 0, interactive: false },
        { key: "1,0", x: 1, y: 0, interactive: true },
        { key: "0,1", x: 0, y: 1, interactive: true },
      ],
    };
    const layout = buildMapLayout(scene, 600, 420);
    expect(layout.entries).toHaveLength(3);
    expect(layout.entries.every((entry) => entry.polygon.length === 6)).toBe(true);
    expect(layout.entries.every((entry) => entry.center.x > 0 && entry.center.x < 600)).toBe(true);
    expect(layout.entries.every((entry) => entry.center.y > 0 && entry.center.y < 420)).toBe(true);
  });

  it("uses the rendered city squares for direct pointer selection", () => {
    const scene = {
      mode: "city", columns: 2, rows: 1,
      cells: [
        { key: "0,0", col: 0, row: 0, interactive: false },
        { key: "1,0", col: 1, row: 0, interactive: true },
      ],
    };
    const layout = buildMapLayout(scene, 400, 200);
    expect(layout.entries[0].polygon).toHaveLength(4);
    expect(findInteractiveEntry(layout.entries, layout.entries[0].center)).toBeNull();
    expect(findInteractiveEntry(layout.entries, layout.entries[1].center)?.key).toBe("1,0");
    expect(pointInPolygon(layout.entries[1].center, layout.entries[1].polygon)).toBe(true);
  });

  it("breaks a route when an off-viewport waypoint is encountered", () => {
    const centers = new Map([
      ["a", { x: 0, y: 0 }], ["b", { x: 1, y: 0 }],
      ["c", { x: 3, y: 0 }], ["d", { x: 4, y: 0 }],
    ]);
    expect(buildRouteSegments(["a", "b", "missing", "c", "d"], centers)).toEqual([
      [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      [{ x: 3, y: 0 }, { x: 4, y: 0 }],
    ]);
  });
});
