import { describe, expect, it } from "vitest";
import {
  buildMapLayout,
  buildRouteSegments,
  findInteractiveEntry,
  mapMarchEntry,
  mapMarkerShowsTierDetail,
  mapPartyEntry,
  mapTrackedEntry,
  pointInPolygon,
  selectMapMarkerEntries,
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

  it("covers all four viewport edges instead of letterboxing the world window", () => {
    const columns = 15;
    const rows = 15;
    const cells = [];
    for (let row = 0; row < rows; row += 1) {
      const y = row - Math.floor(rows / 2);
      for (let col = 0; col < columns; col += 1) {
        const offsetColumn = col - Math.floor(columns / 2);
        const x = offsetColumn - Math.floor(y / 2);
        cells.push({ key: `${x},${y}`, x, y, interactive: true });
      }
    }
    const layout = buildMapLayout({ mode: "world", origin: { x: 0, y: 0 }, cells }, 840, 774);
    const bounds = layout.entries.reduce((result, entry) => ({
      minX: Math.min(result.minX, entry.bounds.minX),
      minY: Math.min(result.minY, entry.bounds.minY),
      maxX: Math.max(result.maxX, entry.bounds.maxX),
      maxY: Math.max(result.maxY, entry.bounds.maxY),
    }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

    expect(bounds.minX).toBeLessThanOrEqual(20);
    expect(bounds.minY).toBeLessThanOrEqual(20);
    expect(bounds.maxX).toBeGreaterThanOrEqual(820);
    expect(bounds.maxY).toBeGreaterThanOrEqual(754);
  });

  it("anchors the camera hex to the visual center across row parity", () => {
    const columns = 15;
    const rows = 15;
    for (const camera of [
      { x: 0, y: 0 },
      { x: 2, y: 4 },
      { x: 5, y: 3 },
      { x: -3, y: -4 },
      { x: -4, y: -3 },
    ]) {
      const centerOffsetColumn = camera.x + Math.floor(camera.y / 2);
      const cells = [];
      for (let row = 0; row < rows; row += 1) {
        const y = camera.y + row - Math.floor(rows / 2);
        for (let col = 0; col < columns; col += 1) {
          const offsetColumn = centerOffsetColumn + col - Math.floor(columns / 2);
          const x = offsetColumn - Math.floor(y / 2);
          cells.push({ key: `${x},${y}`, x, y, col, row, interactive: true });
        }
      }

      const layout = buildMapLayout({ mode: "world", origin: { x: 0, y: 0 }, cells }, 840, 774);
      const renderedCamera = layout.centerByKey.get(`${camera.x},${camera.y}`);
      expect(renderedCamera.x).toBeCloseTo(420, 10);
      expect(renderedCamera.y).toBeCloseTo(387, 10);
    }
  });

  it("thins crowded low-detail markers while retaining selected and quest POIs", () => {
    const entries = Array.from({ length: 25 }, (_, index) => ({
      key: `poi-${index}`,
      center: { x: 120 + (index % 5) * 14, y: 120 + Math.floor(index / 5) * 14 },
      size: 9,
      cell: {
        key: `poi-${index}`,
        poi_name: `Place ${index}`,
        poi_market_tier: index % 3 === 0 ? "premium" : "standard",
        quest: index === 24,
        visible: index % 2 === 0,
      },
    }));
    const scene = { current_key: "elsewhere", selected_key: "poi-0" };

    expect(selectMapMarkerEntries(scene, entries, { width: 900, worldRadius: 28 }))
      .toHaveLength(entries.length);

    const compact = selectMapMarkerEntries(scene, entries, { width: 390, worldRadius: 9 });
    expect(compact.map((entry) => entry.key)).toEqual(expect.arrayContaining(["poi-0", "poi-24"]));
    expect(compact.length).toBeLessThan(10);
    expect(mapMarkerShowsTierDetail(14.2)).toBe(false);
    expect(mapMarkerShowsTierDetail(18)).toBe(true);
    expect(mapMarkerShowsTierDetail(16.84, "city")).toBe(true);

    const tiers = ["budget", "standard", "premium", "noble", "royal", "mastercraft"];
    for (let index = 1; index < tiers.length; index += 1) {
      const lower = tiers[index - 1];
      const higher = tiers[index];
      const tierPriority = selectMapMarkerEntries(
        { current_key: "elsewhere" },
        [
          { key: lower, center: { x: 100, y: 100 }, cell: { explored: true, visible: true, poi_name: lower, poi_market_tier: lower } },
          { key: higher, center: { x: 110, y: 100 }, cell: { explored: true, visible: true, poi_name: higher, poi_market_tier: higher } },
        ],
        { width: 390, worldRadius: 9 },
      );
      expect(tierPriority.map((entry) => entry.key)).toEqual([higher]);
    }
  });
});
