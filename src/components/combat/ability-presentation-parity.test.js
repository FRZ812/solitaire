import { describe, expect, it } from "vitest";
import { abilityTargeting } from "../../gameplay/tow/ability-targeting.js";
import { createTowEncounter, useSkill } from "../../gameplay/tow/encounter.js";
import { createSkillState, getSkill, skillIds } from "../../gameplay/tow/skills.js";
import { combatCuesForEvent, combatEventReceipt } from "./tow-combat-feedback.js";

const EFFECT_EVENT_TYPES = new Set([
  "skill-cleanse",
  "skill-damage",
  "skill-heal",
  "skill-max-hp",
  "skill-resolve-restored",
  "skill-shield",
  "skill-status",
  "skill-status-modified",
  "skill-status-scaled",
]);

function prerequisiteStatuses(definition) {
  const ids = new Set();
  for (const effect of definition.effects) {
    if (effect.factorStatus) ids.add(effect.factorStatus);
    for (const status of effect.statuses || []) ids.add(status);
    if (["modify-status", "reduce-statuses"].includes(effect.type) && effect.status) {
      ids.add(effect.status);
    }
  }
  return [...ids].map((type) => ({ type, count: 10 }));
}

function encounterFor(definition, rank) {
  const statuses = prerequisiteStatuses(definition);
  const created = createTowEncounter({
    seed: `presentation-oracle:${definition.id}:${rank}`,
    player: {
      id: "player",
      name: "Player",
      hp: 5_000,
      maxHp: 10_000,
      resolve: 50,
      resolveMax: 100,
      statuses,
      stats: { attack: 1_000, defense: 1_000, critRate: 0, dodgeRate: 0 },
    },
    enemies: [{
      id: "enemy",
      name: "Enemy",
      hp: 5_000,
      maxHp: 10_000,
      resolve: 100,
      resolveMax: 100,
      statuses,
      stats: { attack: 1, defense: 0, critRate: 0, dodgeRate: 0 },
      attacks: [{ id: "wait", name: "Wait", hits: 1, damage: 0 }],
    }],
    build: {
      traits: {},
      skills: [createSkillState(definition.id, rank)],
      runes: [],
    },
  });
  return {
    ...created,
    turn: { ...created.turn, actionsRemaining: 2 },
  };
}

describe("catalogue-wide ability presentation parity", () => {
  it("gives every emitted ability effect both a receipt and a visual cue", () => {
    const failures = [];
    let checkedEvents = 0;

    for (const skillId of skillIds()) {
      const definition = getSkill(skillId);
      for (let rank = 1; rank <= definition.rankCount; rank += 1) {
        const state = encounterFor(definition, rank);
        const targetId = abilityTargeting(definition).anchorSide === "enemy" ? "enemy" : "player";
        const result = useSkill(state, skillId, targetId);
        if (!result.ok) {
          failures.push(`${skillId}@${rank}: command rejected (${result.reason})`);
          continue;
        }
        for (const event of result.state.events.filter((entry) => (
          entry.sequence > state.sequence
          && entry.skillId === skillId
          && EFFECT_EVENT_TYPES.has(entry.type)
        ))) {
          checkedEvents += 1;
          if (!combatEventReceipt(result.state, event)) {
            failures.push(`${skillId}@${rank}:${event.type}: missing receipt`);
          }
          if (combatCuesForEvent(result.state, event).length === 0) {
            failures.push(`${skillId}@${rank}:${event.type}: missing cue`);
          }
        }
      }
    }

    expect(checkedEvents).toBeGreaterThan(skillIds().length);
    expect(failures, failures.join("\n")).toEqual([]);
  });
});
