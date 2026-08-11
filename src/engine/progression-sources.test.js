import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { JOB_POOL } from "../data/postings.js";
import { APPRENTICESHIP, SCHEMATICS } from "../data/schematics.js";
import { applyForge, applyApprentice } from "./forge.js";
import { applyDayLabour } from "./quests.js";
import { applyTraining } from "./training.js";
import { createTowEncounter, endTurn, useSkill } from "../gameplay/tow/encounter.js";
import { settleTowEncounter } from "../gameplay/tow/settlement.js";
import { applyBeat } from "./beat.js";
import {
  allocatedProgressionLevel,
  pendingLevelAllocations,
  progressionLevel,
} from "./progression.js";

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

function expectEarnedButUnallocated(state, beforeAllocated, beforeEarned) {
  expect(progressionLevel(state.character)).toBeGreaterThan(beforeEarned);
  expect(allocatedProgressionLevel(state.character)).toBe(beforeAllocated);
  expect(pendingLevelAllocations(state.character)).toMatchObject({
    allocatedLevel: beforeAllocated,
    earnedLevel: progressionLevel(state.character),
  });
  const levelBeat = state.beats.find((beat) => beat.type === "growth" && beat.text?.includes("must be allocated"));
  expect(levelBeat?.text).toMatch(/^Character levels? [0-9-]+ earned · \d+ unspent levels? must be allocated to racial evolution or a profession\.$/);
  expect(levelBeat?.text).not.toMatch(/rank|path|wizard|fighter/i);
}

describe("non-combat progression sources", () => {
  it("earns unspent global character levels through ordinary paid labour", () => {
    const state = fundedState();
    const beforeEarned = progressionLevel(state.character);
    const beforeAllocated = allocatedProgressionLevel(state.character);
    const result = applyDayLabour(state, JOB_POOL.find((job) => job.key === "dig-drains"));

    expect(result.ok).toBe(true);
    expectEarnedButUnallocated(result.state, beforeAllocated, beforeEarned);
    expectPlayerProjectionSynced(result.state);
  });

  it("earns unspent global character levels during a blacksmith apprenticeship", () => {
    const state = fundedState();
    const beforeEarned = progressionLevel(state.character);
    const beforeAllocated = allocatedProgressionLevel(state.character);
    const result = applyApprentice(state, APPRENTICESHIP[0]);

    expect(result.ok).toBe(true);
    expect(result.state.character.crafting.blacksmith.rank).toBe(1);
    expectEarnedButUnallocated(result.state, beforeAllocated, beforeEarned);
    expectPlayerProjectionSynced(result.state);
  });

  it("earns unspent global character levels when forging equipment", () => {
    const state = fundedState();
    const schematic = SCHEMATICS.find((entry) => entry.id === "sch-iron-dagger");
    state.character.inventory.carried.push({ itemId: "iron-ingot", quantity: 1 });
    const beforeEarned = progressionLevel(state.character);
    const beforeAllocated = allocatedProgressionLevel(state.character);
    const result = applyForge(state, schematic, schematic.baseTier);

    expect(result.ok).toBe(true);
    expect(result.state.character.inventory.carried).toContainEqual({ itemId: "iron-dagger", quantity: 1 });
    expectEarnedButUnallocated(result.state, beforeAllocated, beforeEarned);
    expectPlayerProjectionSynced(result.state);
  });

  it("earns unspent global character levels from expert training", () => {
    const state = fundedState();
    state.character.proficiencies.spellcasting = 6;
    const beforeEarned = progressionLevel(state.character);
    const beforeAllocated = allocatedProgressionLevel(state.character);
    const result = applyTraining(state, "spellcasting", 5);

    expect(result.ok).toBe(true);
    expect(result.state.character.proficiencies.spellcasting).toBeGreaterThan(0);
    expectEarnedButUnallocated(result.state, beforeAllocated, beforeEarned);
    expectPlayerProjectionSynced(result.state);
  });

  it("earns unspent global character levels from combat proficiency XP", () => {
    const state = fundedState();
    const beforeEarned = progressionLevel(state.character);
    const beforeAllocated = allocatedProgressionLevel(state.character);
    // A long fight the player wins outright: proficiency is read off the encounter's own
    // event log, so it takes real blows rather than a handed-in tally.
    let encounter = createTowEncounter({
      seed: "progression-source",
      player: { id: "wanderer", name: "Wanderer", maxHp: 500, stats: { attack: 10, defense: 0, critRate: 0, dodgeRate: 0 } },
      enemies: [{ id: "foe", name: "Foe", maxHp: 400, stats: { attack: 0, defense: 0, critRate: 0, dodgeRate: 0 } }],
      build: { traits: {}, skills: ["strike"] },
    });
    for (let turn = 0; turn < 100 && encounter.phase === "player"; turn += 1) {
      encounter = useSkill(encounter, "strike").state;
      if (encounter.phase !== "player") break;
      encounter = endTurn(encounter).state;
    }
    expect(encounter.phase).toBe("victory");
    const settled = settleTowEncounter(state, encounter, {
      encounterId: "progression-source-fight",
      proficiencyId: "spellcasting",
    });
    expect(settled.ok).toBe(true);
    const next = settled.state;

    expectEarnedButUnallocated(next, beforeAllocated, beforeEarned);
    expectPlayerProjectionSynced(next);
  });

  it("earns unspent global character levels from narrated skill growth", () => {
    const state = fundedState();
    state.created = true;
    state.world.codex.skills["field-lore"] = { id: "field-lore", name: "Field Lore", rating: 1 };
    const beforeEarned = progressionLevel(state.character);
    const beforeAllocated = allocatedProgressionLevel(state.character);
    const next = applyBeat(state, { discoveries: { skills: [{ id: "field-lore", name: "Field Lore", rating: 3 }] } });

    expectEarnedButUnallocated(next, beforeAllocated, beforeEarned);
    expectPlayerProjectionSynced(next);
  });
});
