import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { JOB_POOL } from "../data/postings.js";
import { APPRENTICESHIP, SCHEMATICS } from "../data/schematics.js";
import { applyForge, applyApprentice } from "./forge.js";
import { applyDayLabour } from "./quests.js";
import { progressionLevel } from "./progression.js";

function fundedState() {
  const state = makeInitialState();
  state.character.inventory.coins = { copper: 0, silver: 0, gold: 100 };
  return state;
}

function expectPlayerProjectionSynced(state) {
  const playerLevel = progressionLevel(state.character);
  expect(playerLevel).toBeGreaterThan(0);
  expect(progressionLevel(state.world.codex.characters.wanderer)).toBe(playerLevel);
}

describe("non-combat progression sources", () => {
  it("advances the shared stack through ordinary paid labour", () => {
    const state = fundedState();
    const before = progressionLevel(state.character);
    const result = applyDayLabour(state, JOB_POOL.find((job) => job.key === "dig-drains"));

    expect(result.ok).toBe(true);
    expect(progressionLevel(result.state.character)).toBeGreaterThan(before);
    expectPlayerProjectionSynced(result.state);
  });

  it("advances the shared stack during a blacksmith apprenticeship", () => {
    const state = fundedState();
    const before = progressionLevel(state.character);
    const result = applyApprentice(state, APPRENTICESHIP[0]);

    expect(result.ok).toBe(true);
    expect(result.state.character.crafting.blacksmith.rank).toBe(1);
    expect(progressionLevel(result.state.character)).toBeGreaterThan(before);
    expectPlayerProjectionSynced(result.state);
  });

  it("advances the shared stack when forging equipment", () => {
    const state = fundedState();
    const schematic = SCHEMATICS.find((entry) => entry.id === "sch-iron-dagger");
    state.character.inventory.carried.push({ itemId: "iron-ingot", quantity: 1 });
    const before = progressionLevel(state.character);
    const result = applyForge(state, schematic, schematic.baseTier);

    expect(result.ok).toBe(true);
    expect(result.state.character.inventory.carried).toContainEqual({ itemId: "iron-dagger", quantity: 1 });
    expect(progressionLevel(result.state.character)).toBeGreaterThan(before);
    expectPlayerProjectionSynced(result.state);
  });
});
