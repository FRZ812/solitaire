import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { DEFAULT_WORLD_SEED } from "../data/continent.js";
import { getTile } from "./world.js";

const OPEN_GROUND = { x: 120, y: 64 };

describe("generated tile cache", () => {
  it("returns the same generated ground for a repeated lookup", () => {
    const state = makeInitialState();
    const first = getTile(state, OPEN_GROUND.x, OPEN_GROUND.y);
    const second = getTile(state, OPEN_GROUND.x, OPEN_GROUND.y);

    // Identity, not equality: the map re-derives a whole viewport per pan frame,
    // so a miss here means the noise generator runs again for every drawn cell.
    expect(second).toBe(first);
  });

  it("re-keys the memo when the campaign seed changes", () => {
    const a = makeInitialState();
    const b = makeInitialState();
    b.world.seed = `${DEFAULT_WORLD_SEED}-divergent`;

    const fromA = getTile(a, OPEN_GROUND.x, OPEN_GROUND.y);
    getTile(b, OPEN_GROUND.x, OPEN_GROUND.y);
    const backToA = getTile(a, OPEN_GROUND.x, OPEN_GROUND.y);

    expect(fromA.procedural).toBe(true);
    // Avarra's landform is authored and deliberately seed-independent
    // (continentValueAt ignores its seed argument), so terrain alone cannot show
    // that the memo re-keyed. Identity can: B's lookup must have evicted A's
    // entry rather than both campaigns sharing one slot.
    expect(backToA).not.toBe(fromA);
    expect(backToA.terrain).toBe(fromA.terrain);
  });

  it("keeps a campaign's own discoveries ahead of the shared generated tile", () => {
    const state = makeInitialState();
    const key = `${OPEN_GROUND.x},${OPEN_GROUND.y}`;
    const before = getTile(state, OPEN_GROUND.x, OPEN_GROUND.y);

    state.world.tiles[key] = { proceduralDelta: true, visited: true, status: "camped" };
    const after = getTile(state, OPEN_GROUND.x, OPEN_GROUND.y);

    expect(after.status).toBe("camped");
    // The cached object is shared across every caller, so a merged delta must
    // never be written back into it.
    expect(before.status).toBeUndefined();
    expect(after.terrain).toBe(before.terrain);
  });
});
