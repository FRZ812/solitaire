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
import { buildExplorationModel, buildRpgViewport } from "./atlasModel.js";

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

describe("unified capital in the exploration atlas", () => {
  it("distinguishes current sight from remembered exploration", () => {
    const state = makeInitialState();
    state.world.seen = { "0,0": true, "2,0": true, "4,0": true };

    const byKey = new Map(buildRpgViewport(state).map((cell) => [cell.key, cell]));

    expect(byKey.get("2,0")).toMatchObject({ seen: true, visible: true, explored: true });
    expect(byKey.get("4,0")).toMatchObject({ seen: true, visible: false, explored: true });
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
