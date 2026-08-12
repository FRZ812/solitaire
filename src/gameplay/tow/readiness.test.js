import { describe, expect, it } from "vitest";
import { createTowEncounter, endTurn, useSkill } from "./encounter.js";
import { towBuildForCharacter } from "./professions.js";
import { UNLIMITED_USES, usesPerAct } from "./skills.js";
import {
  emptyReadiness,
  isReadiness,
  pruneReadiness,
  readinessFromEncounter,
  readinessSummary,
  restoreReadiness,
  skillStatesForReadiness,
} from "./readiness.js";

const LOADOUT = ["strike", "block", "warcry", "deliberate-blow"];

function fight(readiness) {
  return createTowEncounter({
    seed: "readiness",
    player: {
      id: "wanderer",
      name: "Wanderer",
      maxHp: 400,
      stats: { attack: 12, defense: 9, critRate: 0, dodgeRate: 0 },
    },
    enemies: [{
      id: "foe-0",
      name: "Brigand",
      maxHp: 900,
      stats: { attack: 2, defense: 0, critRate: 0, dodgeRate: 0 },
      attacks: [{ id: "jab", name: "Jab", hits: 1, damage: 2 }],
    }],
    build: { traits: {}, skills: skillStatesForReadiness(LOADOUT, readiness) },
  });
}

describe("opening a fight", () => {
  it("starts a fresh character full", () => {
    const state = fight(emptyReadiness());
    const block = state.build.skills.find((entry) => entry.id === "block");
    expect(block.usesRemaining).toBe(usesPerAct("block", 1));
  });

  it("starts a spent character spent", () => {
    // The whole point: a second fight before nightfall is fought with what the first left.
    const state = fight({ block: 3 });
    expect(state.build.skills.find((entry) => entry.id === "block").usesRemaining).toBe(3);
  });

  it("opens a newly learned skill full rather than at zero", () => {
    const state = fight({ block: 2 });
    const warcry = state.build.skills.find((entry) => entry.id === "warcry");
    expect(warcry.usesRemaining).toBe(usesPerAct("warcry", 1));
  });

  it("cannot be handed more uses than the skill has", () => {
    const state = fight({ block: 9999 });
    expect(state.build.skills.find((entry) => entry.id === "block").usesRemaining)
      .toBe(usesPerAct("block", 1));
  });

  it("leaves unlimited skills unlimited", () => {
    const state = fight({ strike: 2 });
    expect(state.build.skills.find((entry) => entry.id === "strike").usesRemaining)
      .toBe(UNLIMITED_USES);
  });

  it("never opens on a cooldown left over from the last fight", () => {
    // Cooldowns are tactical and belong inside one encounter; readiness is the thing that
    // crosses between them.
    const states = skillStatesForReadiness(LOADOUT, { block: 4 });
    expect(states.every((entry) => entry.cooldownRemaining === 0)).toBe(true);
  });
});

describe("settling a fight", () => {
  it("records what the fight actually left", () => {
    let state = fight(emptyReadiness());
    const before = state.build.skills.find((entry) => entry.id === "block").usesRemaining;
    state = useSkill(state, "block").state;
    state = endTurn(state).state;
    state = useSkill(state, "block").state;

    const readiness = readinessFromEncounter(state);
    expect(readiness.block).toBe(before - 2);
    expect(isReadiness(readiness)).toBe(true);
  });

  it("does not record a skill with no limit to spend", () => {
    const readiness = readinessFromEncounter(fight(emptyReadiness()));
    expect(Object.hasOwn(readiness, "strike")).toBe(false);
  });

  it("carries depletion from one fight into the next", () => {
    let first = fight(emptyReadiness());
    for (let round = 0; round < 4; round += 1) {
      first = useSkill(first, "block").state;
      first = endTurn(first).state;
    }
    const carried = readinessFromEncounter(first);
    const second = fight(carried);
    expect(second.build.skills.find((entry) => entry.id === "block").usesRemaining)
      .toBe(usesPerAct("block", 1) - 4);
  });
});

describe("getting it back", () => {
  it("comes back whole from a completed rest", () => {
    const state = fight(restoreReadiness());
    expect(state.build.skills.find((entry) => entry.id === "block").usesRemaining)
      .toBe(usesPerAct("block", 1));
  });

  it("forgets a skill the character no longer carries", () => {
    // Otherwise a dropped and re-learned skill would return as depleted as it left.
    const pruned = pruneReadiness({ block: 2, warcry: 1 }, ["strike", "block"]);
    expect(pruned).toEqual({ block: 2 });
  });
});

describe("validation", () => {
  it("refuses a map naming a skill that does not exist", () => {
    expect(isReadiness({ "not-a-skill": 3 })).toBe(false);
  });

  it("refuses an impossible count", () => {
    expect(isReadiness({ block: -1 })).toBe(false);
    expect(isReadiness({ block: 1.5 })).toBe(false);
    expect(isReadiness([])).toBe(false);
    expect(isReadiness(null)).toBe(false);
  });

  it("accepts an empty map", () => {
    expect(isReadiness(emptyReadiness())).toBe(true);
  });
});

describe("how spent the character is", () => {
  it("reads full for a rested character and lower for a spent one", () => {
    const build = towBuildForCharacter({ profession: "fighter" });
    expect(readinessSummary(build.skills, {}).fraction).toBe(1);
    const spent = readinessSummary(build.skills, { block: 0 });
    expect(spent.fraction).toBeLessThan(1);
    expect(spent.remaining).toBeLessThan(spent.capacity);
  });

  it("ignores unlimited skills, which are never a resource", () => {
    const summary = readinessSummary(["strike"], {});
    expect(summary).toEqual({ remaining: 0, capacity: 0, fraction: 1 });
  });
});
