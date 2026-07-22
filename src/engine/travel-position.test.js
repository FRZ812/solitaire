import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { applyTravelPosition } from "./travel-position.js";

describe("immediate travel position projection", () => {
  it("lands and reveals the route without advancing time or appending beats", () => {
    const state = makeInitialState();
    const start = { ...state.world.currentTile };
    const middle = { x: start.x + 6, y: start.y };
    const destination = { x: start.x + 12, y: start.y };
    const time = state.time;
    const beats = state.beats;

    const positioned = applyTravelPosition(state, {
      dest: destination,
      path: [start, middle, destination],
      mode: "ground",
    });

    expect(positioned.world.currentTile).toEqual(destination);
    expect(positioned.world.tiles[`${middle.x},${middle.y}`]).toBeDefined();
    expect(positioned.world.tiles[`${destination.x},${destination.y}`]).toBeDefined();
    expect(positioned.world.seen[`${destination.x},${destination.y}`]).toBeTruthy();
    expect(positioned.time).toBe(time);
    expect(positioned.beats).toBe(beats);
    expect(state.world.currentTile).toEqual(start);
  });
});
