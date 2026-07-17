import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { applySurvivalTick } from "./beat-tick.js";
import { lightMinutes } from "./light.js";
import { applyRest, extinguish, lightLantern } from "./tools.js";

function equippedForLantern() {
  const state = makeInitialState();
  state.character.inventory.carried = [
    { itemId: "lantern", quantity: 1 },
    { itemId: "lamp-oil", quantity: 2 },
    { itemId: "tinderbox", quantity: 1 },
    { itemId: "bedroll", quantity: 1 },
  ];
  return state;
}

function quantity(state, itemId) {
  return state.character.inventory.carried.find((entry) => entry.itemId === itemId)?.quantity || 0;
}

describe("hooded lantern fuel", () => {
  it("keeps remaining fuel while dark and relights without consuming fresh oil", () => {
    const state = equippedForLantern();
    state.character.light = { source: "lantern", minutes: 137 };

    const hooded = extinguish(state);
    expect(hooded.ok).toBe(true);
    expect(hooded.state.character.light).toEqual({ source: "lantern", minutes: 137, hooded: true });
    expect(lightMinutes(hooded.state)).toBe(0);

    const relit = lightLantern(hooded.state);
    expect(relit.ok).toBe(true);
    expect(relit.state.character.light).toEqual({ source: "lantern", minutes: 137 });
    expect(quantity(relit.state, "lamp-oil")).toBe(2);
  });

  it("does not burn hooded fuel during ordinary elapsed time", () => {
    const state = equippedForLantern();
    state.character.light = { source: "lantern", minutes: 137, hooded: true };
    const character = structuredClone(state.character);
    const newBeats = [];

    applySurvivalTick({
      state,
      beat: { minutes_passed: 45 },
      character,
      codex: state.world.codex,
      newBeats,
    });

    expect(character.light).toEqual({ source: "lantern", minutes: 137, hooded: true });
    expect(newBeats.some((beat) => /lantern sputters dry/i.test(beat.content || ""))).toBe(false);
  });

  it("preserves hooded fuel through rest", () => {
    const state = equippedForLantern();
    state.character.light = { source: "lantern", minutes: 137, hooded: true };

    const rested = applyRest(state, 2);

    expect(rested.ok).toBe(true);
    expect(rested.state.character.light).toEqual({ source: "lantern", minutes: 137, hooded: true });
  });
});
