import { describe, expect, it } from "vitest";
import {
  buildMapLayout,
  buildRouteSegments,
  findInteractiveEntry,
  mapMarchEntry,
  mapPartyEntry,
  mapTrackedEntry,
  pointInPolygon,
} from "./mapGeometry.js";

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

  it("interpolates the rendered party marker between path hex centers", () => {
    const layout = {
      entries: [
        { key: "0,0", center: { x: 100, y: 80 }, size: 30 },
        { key: "1,0", center: { x: 160, y: 80 }, size: 30 },
      ],
      centerByKey: new Map([["0,0", { x: 100, y: 80 }], ["1,0", { x: 160, y: 80 }]]),
    };
    expect(mapMarchEntry(layout, { fromKey: "0,0", toKey: "1,0", mix: 0.25 })).toMatchObject({
      center: { x: 115, y: 80 },
      size: 30,
    });
  });

  it("does not resurrect the canonical marker when an active march is off camera", () => {
    const layout = {
      entries: [{ key: "0,0", center: { x: 100, y: 80 }, size: 30 }],
      centerByKey: new Map([["0,0", { x: 100, y: 80 }]]),
    };
    const offCameraMarch = { fromKey: "8,8", toKey: "9,8", mix: 0.5 };
    expect(mapPartyEntry(layout, "0,0", offCameraMarch)).toBeNull();
    expect(mapPartyEntry(layout, "0,0", null)?.key).toBe("0,0");
  });

  it("projects a tracked character only while their lead is inside the viewport", () => {
    const layout = {
      entries: [{ key: "4,-2", center: { x: 220, y: 140 }, size: 28 }],
      centerByKey: new Map([["4,-2", { x: 220, y: 140 }]]),
    };
    const tracked = { id: "envoy", name: "Nadira", pos: { x: 4, y: -2 } };
    expect(mapTrackedEntry(layout, tracked)).toMatchObject({ key: "4,-2", tracked });
    expect(mapTrackedEntry(layout, { ...tracked, pos: { x: 40, y: -20 } })).toBeNull();
  });
});
