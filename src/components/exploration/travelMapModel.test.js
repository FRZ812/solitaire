import { describe, expect, it, vi } from "vitest";
import { makeInitialState } from "../../data/initial-state.js";
import { buildRpgViewport } from "./hexMapModel.js";
import {
  TRAVEL_MAP_MAX_ZOOM,
  TRAVEL_MAP_MIN_ZOOM,
  activeMarchJourney,
  clampTravelMapZoom,
  formatTravelDuration,
  knownJourneyPreview,
  knownJourneyWaypoints,
  panTravelMapCamera,
  presentedMarchDestination,
  rebaseTravelMapDrag,
  startTravelMapMarch,
  travelMapMarchDuration,
  travelMapMarchFrame,
  travelMapRenderDimensions,
  travelMapViewportDimensions,
  travelMapZoomStep,
} from "./travelMapModel.js";

describe("unified hex travel map camera", () => {
  it("shows substantially more than the legacy 11 by 9 viewport at normal zoom", () => {
    expect(travelMapViewportDimensions({ width: 1000, height: 700 }, 1))
      .toEqual({ columns: 19, rows: 15, stride: 1 });
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

  it("derives the projected cell window from the measured canvas aspect ratio", () => {
    const sidebarCanvas = travelMapViewportDimensions({ width: 840, height: 774 }, 1);
    const zoomedOut = travelMapViewportDimensions({ width: 840, height: 774 }, 0.6);

    expect(sidebarCanvas).toEqual({ columns: 15, rows: 15, stride: 1 });
    expect(zoomedOut).toEqual({ columns: 25, rows: 25, stride: 1 });
  });

  it("buys coverage past the row ceiling with stride instead of with more cells", () => {
    const wide = travelMapViewportDimensions({ width: 1000, height: 700 }, 0.2);
    const continental = travelMapViewportDimensions({ width: 1000, height: 700 }, TRAVEL_MAP_MIN_ZOOM);

    expect(continental.rows).toBe(wide.rows);
    expect(continental.columns).toBe(wide.columns);
    expect(continental.stride).toBeGreaterThan(wide.stride);
    // The whole point of the ceiling: a continental view enumerates no more hexes
    // than a valley, so `getTile` runs the same number of times either way.
    expect(continental.rows * continental.columns).toBe(wide.rows * wide.columns);
    // Coverage has to actually reach the continent's 850-hex height.
    expect(continental.rows * continental.stride).toBeGreaterThan(850);
  });

  it("adds three render-only overscan cells per edge without changing visible dimensions", () => {
    const visible = { columns: 15, rows: 15, stride: 4 };
    expect(travelMapRenderDimensions(visible)).toEqual({ columns: 21, rows: 21, stride: 4 });
    expect(visible).toEqual({ columns: 15, rows: 15, stride: 4 });
  });

  it("clamps zoom to the continuous range rather than handing off to a separate atlas", () => {
    expect(clampTravelMapZoom(99)).toBe(TRAVEL_MAP_MAX_ZOOM);
    expect(clampTravelMapZoom(0)).toBe(TRAVEL_MAP_MIN_ZOOM);

    expect(travelMapZoomStep(0.9, 0.8).zoom).toBeCloseTo(0.72, 10);
    expect(travelMapZoomStep(TRAVEL_MAP_MIN_ZOOM, 0.8)).toEqual({ zoom: TRAVEL_MAP_MIN_ZOOM });
    expect(travelMapZoomStep(TRAVEL_MAP_MAX_ZOOM, 1.25)).toEqual({ zoom: TRAVEL_MAP_MAX_ZOOM });
  });

  it("converts a dragged hex canvas into the opposite camera movement", () => {
    const radius = 20;
    expect(panTravelMapCamera({ x: 0, y: 0, zoom: 1 }, { x: -Math.sqrt(3) * radius, y: 0 }, radius))
      .toMatchObject({ x: 1, y: 0, zoom: 1 });
    expect(panTravelMapCamera({ x: 0, y: 0, zoom: 1 }, { x: -Math.sqrt(3) * 0.5 * radius, y: -1.5 * radius }, radius))
      .toMatchObject({ x: 0, y: 1, zoom: 1 });
  });

  it("rebases a held drag into camera commits while retaining only sub-hex preview", () => {
    const radius = 20;
    const horizontal = rebaseTravelMapDrag({ x: -40, y: 0 }, radius);
    expect(horizontal.commit).toEqual({ x: -Math.sqrt(3) * radius, y: 0 });
    expect(horizontal.residual.x).toBeCloseTo(-40 + Math.sqrt(3) * radius, 10);
    expect(horizontal.residual.y).toBe(0);
    expect(panTravelMapCamera({ x: 0, y: 0 }, horizontal.commit, radius)).toMatchObject({ x: 1, y: 0 });
    expect(panTravelMapCamera({ x: 0, y: 0 }, horizontal.residual, radius)).toMatchObject({ x: 0, y: 0 });

    const diagonalDrag = { x: -Math.sqrt(3) * radius * 0.5, y: -1.5 * radius };
    expect(rebaseTravelMapDrag(diagonalDrag, radius)).toEqual({
      commit: diagonalDrag,
      residual: { x: 0, y: 0 },
    });
  });

  it("moves the camera a whole stride per drawn cell dragged at sampled zoom", () => {
    const radius = 20;
    for (const stride of [2, 4, 10, 28]) {
      // A drawn cell stands for `stride` hexes. Read against the drawn radius
      // alone the camera crawls one hex per cell dragged, while the lattice —
      // quantised to whole strides — holds still and then jumps a full cell once
      // the rounding tips. That stall and jump is the stepping being fixed here.
      expect(panTravelMapCamera({ x: 0, y: 0 }, { x: -Math.sqrt(3) * radius, y: 0 }, radius, stride))
        .toMatchObject({ x: stride, y: 0 });
      // One row down is not (0, stride): that lands a cell diagonally away,
      // because an even stride advances `floor(y / 2)` by exactly stride/2.
      expect(panTravelMapCamera({ x: 0, y: 0 }, { x: 0, y: -1.5 * radius }, radius, stride))
        .toMatchObject({ x: -stride / 2, y: stride });
    }
  });

  it("spends a whole dragged cell at sampled zoom with nothing left to re-round", () => {
    const radius = 20;
    const stride = 10;
    const drag = { x: -Math.sqrt(3) * radius, y: -1.5 * radius };
    const { commit, residual } = rebaseTravelMapDrag(drag, radius, stride);

    expect(commit.x).toBeCloseTo(drag.x, 10);
    expect(commit.y).toBeCloseTo(drag.y, 10);
    expect(residual).toEqual({ x: 0, y: 0 });
    expect(panTravelMapCamera({ x: 0, y: 0 }, commit, radius, stride))
      .toMatchObject({ x: stride / 2, y: stride });

    // Under half a cell is not yet a step; it stays in the preview instead of
    // being dropped, so the next fraction of a cell continues from where it was.
    const partial = rebaseTravelMapDrag({ x: -Math.sqrt(3) * radius * 0.4, y: 0 }, radius, stride);
    expect(partial.commit).toEqual({ x: 0, y: 0 });
    expect(partial.residual.x).toBeCloseTo(-Math.sqrt(3) * radius * 0.4, 10);
  });

  it("shifts the sampled window by exactly the cells dragged, with no snap correction", () => {
    const radius = 20;
    const state = makeInitialState();
    const party = state.world.currentTile;
    const dimensions = travelMapViewportDimensions({ width: 900, height: 600 }, TRAVEL_MAP_MIN_ZOOM);
    expect(dimensions.stride).toBeGreaterThan(1);

    const windowFor = (drag) => {
      const camera = panTravelMapCamera({ x: 0, y: 0 }, drag, radius, dimensions.stride);
      return buildRpgViewport(state, {
        center: { x: party.x + camera.x, y: party.y + camera.y },
        dimensions,
      });
    };
    const keyAt = (cells, col, row) => cells.find((cell) => cell.col === col && cell.row === row)?.key;
    const col = Math.floor(dimensions.columns / 2);
    const row = Math.floor(dimensions.rows / 2);

    const still = windowFor({ x: 0, y: 0 });
    expect(keyAt(still, col, row)).toBe(`${party.x},${party.y}`);
    expect(keyAt(windowFor({ x: -Math.sqrt(3) * radius, y: 0 }), col, row))
      .toBe(keyAt(still, col + 1, row));
    expect(keyAt(windowFor({ x: 0, y: -1.5 * radius }), col, row))
      .toBe(keyAt(still, col, row + 1));
    // Three cells of drag is three cells of window, not one step and then a jump.
    expect(keyAt(windowFor({ x: -Math.sqrt(3) * radius * 3, y: 0 }), col, row))
      .toBe(keyAt(still, col + 3, row));
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

  it("previews every stage it plans, including the ones past where the party has been", () => {
    const state = makeInitialState();
    const origin = { ...state.world.currentTile };
    const path = [origin];
    for (let i = 1; i <= 6; i += 1) path.push({ x: origin.x + i, y: origin.y });
    // Nothing past the third hex has ever been walked, and it makes no odds:
    // an itinerary that stopped at the party's own footprints was the reason a
    // journey to a town four days off looked like it ended in the middle.
    for (let i = 4; i < path.length; i += 1) delete state.world.seen[`${path[i].x},${path[i].y}`];
    const journey = {
      fullPath: path,
      legPath: path.slice(0, 4),
      legs: [
        { index: 0, from: 0, to: 3, steps: 3, minutes: 90, arrived: false, boundary: { kind: "crossing", label: "Mapped Ford" }, passed: [{ label: "a hay barn" }] },
        { index: 1, from: 3, to: 6, steps: 3, minutes: 90, arrived: true, boundary: { kind: "destination", label: "Distant Keep" }, passed: [] },
      ],
      totalSteps: 6,
      legSteps: 3,
      terrainCounts: {},
      terrainLabels: [],
    };

    const preview = knownJourneyPreview(state, journey);

    expect(preview.legs).toHaveLength(2);
    expect(preview.legs[0]).toMatchObject({ boundaryKind: "crossing", boundaryLabel: "Mapped Ford", passed: ["a hay barn"] });
    expect(preview.legs[1]).toMatchObject({ boundaryKind: "destination", boundaryLabel: "Distant Keep", arrived: true });
  });

  it("carries the whole planned route rather than a walked prefix of it", () => {
    const state = makeInitialState();
    const origin = { ...state.world.currentTile };
    const near = { x: origin.x + 1, y: origin.y };
    const far = { x: origin.x + 2, y: origin.y };
    const further = { x: origin.x + 3, y: origin.y };
    for (const coord of [near, far, further]) delete state.world.seen[`${coord.x},${coord.y}`];
    const journey = {
      fullPath: [origin, near, far, further],
      legPath: [origin, near, far, further],
      end: further,
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

    expect(preview.legPath).toEqual([origin, near, far, further]);
    expect(preview.totalSteps).toBe(3);
    expect(preview.legSteps).toBe(3);
    expect(preview.arrived).toBe(true);
    // The authoritative route stays with the caller; this is presentation only.
    expect(preview).not.toHaveProperty("fullPath");
  });

  it("reports the journey's own metrics straight through", () => {
    const state = makeInitialState();
    const origin = { ...state.world.currentTile };
    const end = { x: origin.x + 1, y: origin.y };
    const journey = {
      fullPath: [origin, end], legPath: [origin, end], end,
      arrived: true, totalSteps: 1, legSteps: 1,
      terrainCounts: { road: 1 },
      terrainLabels: [{ id: "road", count: 1, label: "Road" }],
    };

    expect(knownJourneyPreview(state, journey)).toMatchObject({
      legPath: [origin, end],
      totalSteps: 1,
      legSteps: 1,
      arrived: true,
    });
  });

  it("names the authored landmarks a route runs past", () => {
    const state = makeInitialState();
    const pathWithTellmar = [{ x: 0, y: 0 }, { x: 418, y: 72 }, { x: 1, y: 0 }];

    // Tellmar is a city on a continent's chart. Whether this party has stood in
    // it decides what they know of it, not whether the road going past is named.
    expect(knownJourneyWaypoints(state, pathWithTellmar)).toEqual([
      expect.objectContaining({ name: "Tellmar", index: 1 }),
    ]);
  });
});
