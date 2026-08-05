import { describe, expect, it } from "vitest";
import {
  HANDCRAFTED,
  SEALED_STRUCTURES,
  applyMapData,
} from "../../data/handcrafted-map.js";
import { LANDMARKS } from "../../data/continent.js";
import { makeInitialState } from "../../data/initial-state.js";
import {
  WHITEMARCH_CAPITAL,
  compileWhitemarchCapital,
} from "../../data/whitemarch-capital.js";
import { getTile } from "../../engine/world.js";
import { planLeg } from "../../engine/expedition.js";
import { WORLD_MARCH_LIMIT } from "../../config.js";
import { buildExplorationModel, buildRpgViewport, planHexJourney } from "./hexMapModel.js";

function keyOf(coord) {
  return `${coord.x},${coord.y}`;
}

function withCompiledCapital(run) {
  const previousTiles = JSON.parse(JSON.stringify(HANDCRAFTED));
  const previousStructures = JSON.parse(JSON.stringify(SEALED_STRUCTURES));
  const compiled = compileWhitemarchCapital();
  try {
    applyMapData(compiled.tiles, compiled.sealedStructures, { trusted: true });
    return run();
  } finally {
    applyMapData(previousTiles, previousStructures, { trusted: true });
  }
}

describe("unified capital in the exploration map", () => {
  it("charts every drawn hex and records only where the party has walked", () => {
    const state = makeInitialState();
    // A sparse sight record from an older save has nothing left to gate: the
    // continent is charted, and `visited` is the one thing still earned.
    state.world.seen = { "0,0": true };
    state.world.tiles = { ...state.world.tiles, "2,0": { visited: true } };

    const byKey = new Map(buildRpgViewport(state).map((cell) => [cell.key, cell]));

    expect(byKey.get("2,0")).toMatchObject({ seen: true, visible: true, explored: true, visited: true });
    expect(byKey.get("4,0")).toMatchObject({ seen: true, visible: true, explored: true, visited: false });
  });

  it("pans the large viewport independently of where the party stands", () => {
    const state = makeInitialState();
    state.world.currentTile = { x: 0, y: 0 };

    const cells = buildRpgViewport(state, {
      center: { x: 6, y: 0 },
      dimensions: { columns: 19, rows: 15 },
    });
    const byKey = new Map(cells.map((cell) => [cell.key, cell]));

    expect(cells).toHaveLength(19 * 15);
    // Panning moves the camera and nothing else — the party's own hex is still
    // the one marked current, wherever the view has been dragged to.
    expect(byKey.get("6,0")).toMatchObject({ current: false });
    expect(byKey.get("0,0")).toMatchObject({ current: true });
  });

  it("enumerates a screen-aligned offset-row window instead of a skewed axial box", () => {
    const state = makeInitialState();
    const cells = buildRpgViewport(state, {
      center: { x: 0, y: 0 },
      dimensions: { columns: 15, rows: 15 },
    });
    const projectedX = (cell) => Math.sqrt(3) * (cell.x + cell.y * 0.5);
    const leftEdge = cells.filter((cell) => cell.col === 0).map(projectedX);
    const rightEdge = cells.filter((cell) => cell.col === 14).map(projectedX);

    expect(Math.max(...leftEdge) - Math.min(...leftEdge)).toBeLessThanOrEqual(Math.sqrt(3) * 0.51);
    expect(Math.max(...rightEdge) - Math.min(...rightEdge)).toBeLessThanOrEqual(Math.sqrt(3) * 0.51);
    expect(cells.find((cell) => cell.col === 7 && cell.row === 7)).toMatchObject({ x: 0, y: 0 });
  });

  it("buys continental coverage with stride, not with more generated hexes", () => {
    const state = makeInitialState();
    state.world.currentTile = { x: 0, y: 0 };
    const dimensions = { columns: 15, rows: 15 };
    const local = buildRpgViewport(state, { center: { x: 0, y: 0 }, dimensions: { ...dimensions, stride: 1 } });
    const far = buildRpgViewport(state, { center: { x: 0, y: 0 }, dimensions: { ...dimensions, stride: 28 } });

    // Same number of `getTile` calls; each drawn hex simply stands for a 28 x 28
    // patch of ground instead of one hex.
    expect(far).toHaveLength(local.length);
    const spanOf = (cells) => Math.max(...cells.map((cell) => cell.y)) - Math.min(...cells.map((cell) => cell.y));
    expect(spanOf(far)).toBe(spanOf(local) * 28);
    expect(far.find((cell) => cell.col === 7 && cell.row === 7)).toMatchObject({ x: 0, y: 0 });
  });

  it("keeps strided samples on a clean sub-lattice across row parity", () => {
    const state = makeInitialState();
    const stride = 28;
    const cells = buildRpgViewport(state, {
      center: { x: 0, y: 0 },
      dimensions: { columns: 15, rows: 15, stride },
    });

    // The window is enumerated in offset rows and converted back with
    // `x = offsetColumn - floor(y / 2)`. An even stride makes floor(y / 2)
    // advance by exactly stride/2 per row, so every sample keeps the same
    // column spacing rather than wobbling a hex every other row.
    for (const row of new Set(cells.map((cell) => cell.row))) {
      const inRow = cells.filter((cell) => cell.row === row).sort((a, b) => a.col - b.col);
      const gaps = new Set(inRow.slice(1).map((cell, index) => cell.x - inRow[index].x));
      expect([...gaps], `row ${row}`).toEqual([stride]);
    }
    const columnKeys = new Set(cells.map((cell) => cell.col));
    for (const col of columnKeys) {
      const inColumn = cells.filter((cell) => cell.col === col).sort((a, b) => a.row - b.row);
      const gaps = new Set(inColumn.slice(1).map((cell, index) => cell.y - inColumn[index].y));
      expect([...gaps], `column ${col}`).toEqual([stride]);
    }
  });

  it("keeps a hex rendering identically no matter where the camera sits", () => {
    const state = makeInitialState();
    const dimensions = { columns: 15, rows: 15, stride: 28 };
    const sample = (center) => new Map(
      buildRpgViewport(state, { center, dimensions }).map((cell) => [cell.key, cell.tile.terrain]),
    );

    // Anchored to the camera, a one-hex pan shifted the whole sample lattice, so
    // the same ground came back as a different hex every frame — the wall that
    // appears and vanishes while panning. Panning must slide the window over
    // fixed ground rather than resample it.
    const before = sample({ x: 0, y: 0 });
    const after = sample({ x: 1, y: 0 });
    const shared = [...after.keys()].filter((key) => before.has(key));

    expect(shared.length).toBeGreaterThan(after.size * 0.8);
    for (const key of shared) expect(after.get(key), key).toBe(before.get(key));
  });

  it("keeps the party on the sample lattice so its own cell survives zooming out", () => {
    const state = makeInitialState();
    const party = state.world.currentTile;
    for (const stride of [1, 2, 28]) {
      const cells = buildRpgViewport(state, {
        center: { x: party.x + 5, y: party.y - 3 },
        dimensions: { columns: 15, rows: 15, stride },
      });
      const current = cells.filter((cell) => cell.current);
      expect(current, `stride ${stride}`).toHaveLength(1);
      expect(current[0]).toMatchObject({ x: party.x, y: party.y });
    }
  });

  it("builds the exploration decision model around the requested map camera", () => {
    const state = makeInitialState();
    const model = buildExplorationModel(state, {
      center: { x: 4, y: -2 },
      dimensions: { columns: 19, rows: 15 },
      renderDimensions: { columns: 25, rows: 21 },
    });
    expect(model.viewport).toHaveLength(19 * 15);
    expect(model.renderViewport).toHaveLength(25 * 21);
    expect(model.renderViewport.filter((cell) => !cell.overscan)).toHaveLength(19 * 15);
    expect(model.renderViewport.find((cell) => cell.x === 4 && cell.y === -2)?.overscan).toBe(false);
    expect(model.viewport.some((cell) => cell.x === 4 && cell.y === -2)).toBe(true);
    expect(model.origin).toEqual(state.world.currentTile);
  });

  it("generates each drawn hex once, slicing the visible window out of the rendered one", () => {
    const state = makeInitialState();
    const model = buildExplorationModel(state, {
      center: { x: 4, y: -2 },
      dimensions: { columns: 19, rows: 15 },
      renderDimensions: { columns: 25, rows: 21 },
    });

    // Identity, not equality: a second `buildRpgViewport` pass would run the
    // generator over the whole window again, which dominated the frame cost.
    const rendered = new Map(model.renderViewport.map((cell) => [cell.key, cell]));
    for (const cell of model.viewport) expect(rendered.get(cell.key)).toBe(cell);
    expect(model.viewport.every((cell) => cell.overscan === false)).toBe(true);
  });

  it("leaves strided samples out of the landmark index, which the atlas layer covers instead", () => {
    const state = makeInitialState();
    const dimensions = { columns: 15, rows: 15 };
    const local = buildExplorationModel(state, { center: { x: 0, y: 0 }, dimensions: { ...dimensions, stride: 1 } });
    const far = buildExplorationModel(state, { center: { x: 0, y: 0 }, dimensions: { ...dimensions, stride: 28 } });

    // Sampled sites at stride are an arbitrary subset of what is out there, so
    // naming them in the destination index would misrepresent the ground.
    expect(far.landmarks.length).toBeLessThanOrEqual(local.landmarks.length);
    // Authored knowledge still stands: the capital is indexed at any zoom.
    expect(far.byKey.size).toBeGreaterThan(0);
  });

  it("collapses every internal Whitemarch POI into one capital landmark", () => {
    withCompiledCapital(() => {
      const state = makeInitialState();
      const outside = LANDMARKS.find((landmark) => landmark.id === "mirecross").coord;
      const outsideKey = keyOf(outside);
      state.world.currentTile = { ...outside };
      state.world.tiles[outsideKey] = getTile(state, outside.x, outside.y);
      state.world.seen[outsideKey] = true;

      const model = buildExplorationModel(state);
      const capitalLandmarks = model.landmarks.filter((landmark) => (
        landmark.tile?.cityId === WHITEMARCH_CAPITAL.id
        || landmark.tile?.poi?.cityId === WHITEMARCH_CAPITAL.id
      ));

      expect(capitalLandmarks).toHaveLength(1);
      expect(capitalLandmarks[0]).toMatchObject({
        x: WHITEMARCH_CAPITAL.start.x,
        y: WHITEMARCH_CAPITAL.start.y,
        capital: true,
      });
      expect(capitalLandmarks[0].name).toMatch(/Whitemarch/i);
      expect(
        capitalLandmarks[0].tile.atlasLandmark
        || capitalLandmarks[0].tile.poi?.atlasLandmark,
      ).toBeTruthy();
    });
  });

  it("previews the same leg the engine will walk, so the highlighted route is honest", () => {
    const state = makeInitialState();
    const from = state.world.currentTile;
    const destination = { x: from.x + 14, y: from.y + 6 };

    const journey = planHexJourney(state, destination, WORLD_MARCH_LIMIT);
    const engineLeg = planLeg(state, journey.fullPath, 0, { maxSteps: WORLD_MARCH_LIMIT });

    expect(journey.legPath).toEqual(engineLeg.path);
    expect(journey.leg.boundary).toEqual(engineLeg.boundary);
    expect(journey.legs[0].to).toBe(engineLeg.to);
  });

  it("keeps nearby named city locations in the local viewport", () => {
    withCompiledCapital(() => {
      const state = makeInitialState();
      const model = buildExplorationModel(state);
      const namedCityCells = model.viewport.filter((cell) => (
        cell.tile?.cityId === WHITEMARCH_CAPITAL.id && cell.tile?.poi?.name
      ));

      expect(namedCityCells.length).toBeGreaterThan(1);
    });
  });
});
