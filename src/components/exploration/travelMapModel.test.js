import { describe, expect, it, vi } from "vitest";
import { makeInitialState } from "../../data/initial-state.js";
import {
  REGION_SELECTOR_ZOOM_THRESHOLD,
  TRAVEL_MAP_MAX_ZOOM,
  TRAVEL_MAP_MIN_ZOOM,
  activeMarchJourney,
  clampTravelMapZoom,
  formatTravelDuration,
  knownJourneyPreview,
  knownJourneyWaypoints,
  panTravelMapCamera,
  presentedMarchDestination,
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

  it("projects an active destination card to the presented march endpoint", () => {
    const selected = { x: 8, y: -3 };
    const halt = { x: 2, y: 0 };

    expect(presentedMarchDestination(selected, { end: halt }, { id: "march-encounter" })).toEqual(halt);
    expect(presentedMarchDestination(null, { end: halt }, { id: "march-remount" })).toEqual(halt);
    expect(presentedMarchDestination(selected, { end: halt }, null)).toEqual(selected);
    expect(presentedMarchDestination(selected, null, { id: "march-encounter" })).toBeNull();
  });

  it("uses a readable bounded duration for a travel leg", () => {
    expect(travelMapMarchDuration([{ x: 0, y: 0 }])).toBe(1_800);
    expect(travelMapMarchDuration(path)).toBe(1_800);
    expect(travelMapMarchDuration(Array.from({ length: 40 }, (_, x) => ({ x, y: 0 })))).toBe(6_000);
  });

  it("emits a reduced-motion final frame immediately but settles through a cancelable step", () => {
    const scheduled = [];
    const cancelled = [];
    const onFrame = vi.fn();
    const onFinish = vi.fn();

    const stop = startTravelMapMarch({
      id: "march-reduced",
      path,
      reducedMotion: true,
      schedule: (callback) => { scheduled.push(callback); return scheduled.length; },
      cancel: (handle) => cancelled.push(handle),
      onFrame,
      onFinish,
    });

    expect(onFrame).toHaveBeenCalledOnce();
    expect(onFrame.mock.calls[0][0]).toMatchObject({ coord: { x: 1, y: 1 }, mix: 1 });
    expect(onFinish).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(1);

    stop();
    scheduled[0](0);
    expect(cancelled).toEqual([1]);
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("ignores a stale reduced-motion callback during Strict Mode effect replay", () => {
    const scheduled = [];
    const finishes = [];
    const setup = () => startTravelMapMarch({
      id: "march-strict-replay",
      path,
      reducedMotion: true,
      schedule: (callback) => { scheduled.push(callback); return scheduled.length; },
      cancel: () => {},
      onFrame: () => {},
      onFinish: (id) => finishes.push(id),
    });

    const stopFirstSetup = setup();
    stopFirstSetup();
    setup();
    scheduled[0](0);
    scheduled[1](0);

    expect(finishes).toEqual(["march-strict-replay"]);
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

  it("presents an encounter-truncated active march as a non-arrival leg", () => {
    const full = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }];
    const journey = { fullPath: full, legPath: full, end: full.at(-1), arrived: true, totalSteps: 3, legSteps: 3 };
    const march = { path: full.slice(0, 3), intendedDest: full.at(-1), encounterAtEnd: { kind: "brigands" } };

    expect(activeMarchJourney(journey, march)).toMatchObject({
      legPath: full.slice(0, 3),
      end: full[2],
      arrived: false,
      legSteps: 2,
      totalSteps: 3,
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

  it("formats travel durations without depending on the retired atlas", () => {
    expect(formatTravelDuration(42)).toBe("42 min");
    expect(formatTravelDuration(125)).toBe("2 h 5 min");
    expect(formatTravelDuration(3_000)).toBe("2 d 2 h");
  });

  it("limits journey presentation to the contiguous mapped route prefix", () => {
    const state = makeInitialState();
    const origin = { ...state.world.currentTile };
    const mapped = { x: origin.x + 1, y: origin.y };
    const unknown = { x: origin.x + 2, y: origin.y };
    const secret = { x: origin.x + 3, y: origin.y };
    state.world.seen[`${mapped.x},${mapped.y}`] = true;
    delete state.world.seen[`${unknown.x},${unknown.y}`];
    delete state.world.seen[`${secret.x},${secret.y}`];
    const journey = {
      fullPath: [origin, mapped, unknown, secret],
      legPath: [origin, mapped, unknown, secret],
      end: secret,
      arrived: true,
      totalSteps: 3,
      legSteps: 3,
      terrainCounts: { road: 1, marsh: 1, mountains: 1 },
      terrainLabels: [
        { id: "road", count: 1, label: "Road" },
        { id: "marsh", count: 1, label: "Marsh" },
        { id: "mountains", count: 1, label: "Mountains" },
      ],
    };

    const preview = knownJourneyPreview(state, journey);

    expect(preview.legPath).toEqual([origin, mapped]);
    expect(preview.routeFullyMapped).toBe(false);
    expect(preview.totalSteps).toBeNull();
    expect(preview.arrived).toBe(false);
    expect(preview).not.toHaveProperty("fullPath");
    expect(preview.terrainLabels).not.toEqual(journey.terrainLabels);
    expect(JSON.stringify(preview)).not.toContain(`${unknown.x},${unknown.y}`);
    expect(JSON.stringify(preview)).not.toContain("Marsh");
    expect(JSON.stringify(preview)).not.toContain("Mountains");
  });

  it("retains exact journey metrics only when every presented hex is mapped", () => {
    const state = makeInitialState();
    const origin = { ...state.world.currentTile };
    const end = { x: origin.x + 1, y: origin.y };
    state.world.seen[`${end.x},${end.y}`] = true;
    const journey = {
      fullPath: [origin, end], legPath: [origin, end], end,
      arrived: true, totalSteps: 1, legSteps: 1,
      terrainCounts: { road: 1 },
      terrainLabels: [{ id: "road", count: 1, label: "Road" }],
    };

    expect(knownJourneyPreview(state, journey)).toMatchObject({
      legPath: [origin, end],
      routeFullyMapped: true,
      totalSteps: 1,
      legSteps: 1,
      arrived: true,
    });
  });

  it("never reveals an authored waypoint until its hex is persistently mapped", () => {
    const state = makeInitialState();
    const pathWithTellmar = [{ x: 0, y: 0 }, { x: 418, y: 72 }, { x: 1, y: 0 }];

    expect(knownJourneyWaypoints(state, pathWithTellmar)).toEqual([]);
    state.world.seen["418,72"] = true;
    expect(knownJourneyWaypoints(state, pathWithTellmar)).toEqual([
      expect.objectContaining({ name: "Tellmar", index: 1 }),
    ]);
  });
});
