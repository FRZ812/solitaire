import { describe, expect, it } from "vitest";
import {
  REGION_SELECTOR_ZOOM_THRESHOLD,
  TRAVEL_MAP_MAX_ZOOM,
  TRAVEL_MAP_MIN_ZOOM,
  clampTravelMapZoom,
  panTravelMapCamera,
  startTravelMapMarch,
  travelMapMarchDuration,
  travelMapMarchFrame,
  travelMapViewportDimensions,
  travelMapZoomStep,
} from "./travelMapModel.js";

describe("unified hex travel map camera", () => {
  it("shows substantially more than the legacy 11 by 9 viewport at normal zoom", () => {
    expect(travelMapViewportDimensions({ width: 1000, height: 700 }, 1)).toEqual({ columns: 19, rows: 15 });
  });

  it("expands the rendered hex window as the camera zooms out", () => {
    const near = travelMapViewportDimensions({ width: 1000, height: 700 }, 1.6);
    const far = travelMapViewportDimensions({ width: 1000, height: 700 }, 0.65);
    expect(far.columns).toBeGreaterThan(near.columns);
    expect(far.rows).toBeGreaterThan(near.rows);
    expect(far.columns % 2).toBe(1);
    expect(far.rows % 2).toBe(1);
  });

  it("uses a portrait-shaped window on tall mobile screens", () => {
    const landscape = travelMapViewportDimensions({ width: 1000, height: 700 }, 1);
    const portrait = travelMapViewportDimensions({ width: 390, height: 844 }, 1);
    expect(portrait.columns).toBeLessThan(landscape.columns);
    expect(portrait.rows).toBe(landscape.rows);
  });

  it("clamps normal zoom and requests the region selector only beyond the far limit", () => {
    expect(clampTravelMapZoom(99)).toBe(TRAVEL_MAP_MAX_ZOOM);
    expect(clampTravelMapZoom(0)).toBe(TRAVEL_MAP_MIN_ZOOM);

    const ordinary = travelMapZoomStep(0.9, 0.8);
    expect(ordinary.openRegionSelector).toBe(false);
    expect(ordinary.zoom).toBeGreaterThanOrEqual(TRAVEL_MAP_MIN_ZOOM);

    const atEdge = travelMapZoomStep(REGION_SELECTOR_ZOOM_THRESHOLD, 0.8);
    expect(atEdge).toMatchObject({ zoom: TRAVEL_MAP_MIN_ZOOM, openRegionSelector: true });
  });

  it("converts a dragged hex canvas into the opposite camera movement", () => {
    const radius = 20;
    expect(panTravelMapCamera({ x: 0, y: 0, zoom: 1 }, { x: -Math.sqrt(3) * radius, y: 0 }, radius))
      .toMatchObject({ x: 1, y: 0, zoom: 1 });
    expect(panTravelMapCamera({ x: 0, y: 0, zoom: 1 }, { x: -Math.sqrt(3) * 0.5 * radius, y: -1.5 * radius }, radius))
      .toMatchObject({ x: 0, y: 1, zoom: 1 });
  });
});

describe("hex travel march presentation", () => {
  const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];

  it("uses a readable bounded duration for a travel leg", () => {
    expect(travelMapMarchDuration([{ x: 0, y: 0 }])).toBe(1_800);
    expect(travelMapMarchDuration(path)).toBe(1_800);
    expect(travelMapMarchDuration(Array.from({ length: 40 }, (_, x) => ({ x, y: 0 })))).toBe(6_000);
  });

  it("interpolates the party between authoritative path hexes", () => {
    expect(travelMapMarchFrame(path, 0)).toMatchObject({ fromKey: "0,0", toKey: "1,0", mix: 0, coord: { x: 0, y: 0 } });
    expect(travelMapMarchFrame(path, 0.25)).toMatchObject({ fromKey: "0,0", toKey: "1,0", mix: 0.5, coord: { x: 0.5, y: 0 } });
    expect(travelMapMarchFrame(path, 0.75)).toMatchObject({ fromKey: "1,0", toKey: "1,1", mix: 0.5, coord: { x: 1, y: 0.5 } });
    expect(travelMapMarchFrame(path, 1)).toMatchObject({ fromKey: "1,0", toKey: "1,1", mix: 1, coord: { x: 1, y: 1 } });
  });

  it("handles empty and single-hex paths without inventing movement", () => {
    expect(travelMapMarchFrame([], 0.5)).toBeNull();
    expect(travelMapMarchFrame([{ x: 4, y: -2 }], 0.5)).toMatchObject({
      fromKey: "4,-2", toKey: "4,-2", mix: 0, coord: { x: 4, y: -2 },
    });
  });

  it("drives frames and finishes exactly once while retaining the final frame", () => {
    const scheduled = [];
    const frames = [];
    const finishes = [];
    startTravelMapMarch({
      id: "march-1",
      path,
      schedule: (callback) => { scheduled.push(callback); return scheduled.length; },
      cancel: () => {},
      onFrame: (frame) => frames.push(frame),
      onFinish: (id) => finishes.push(id),
    });

    scheduled.shift()(100);
    scheduled.shift()(1_000);
    scheduled.shift()(1_900);

    expect(finishes).toEqual(["march-1"]);
    expect(frames.at(-1)).toMatchObject({ coord: { x: 1, y: 1 }, mix: 1 });
    expect(scheduled).toHaveLength(0);
  });

  it("cancels an in-flight ticker without reporting visual completion", () => {
    const scheduled = [];
    const cancelled = [];
    const finishes = [];
    const stop = startTravelMapMarch({
      id: "march-2",
      path,
      schedule: (callback) => { scheduled.push(callback); return scheduled.length; },
      cancel: (handle) => cancelled.push(handle),
      onFrame: () => {},
      onFinish: (id) => finishes.push(id),
    });

    stop();
    scheduled[0](100);

    expect(cancelled).toEqual([1]);
    expect(finishes).toEqual([]);
  });
});
