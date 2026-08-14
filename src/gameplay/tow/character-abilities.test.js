import { describe, expect, it } from "vitest";
import { applyStatus, createStatusStack, statusCount } from "../kernel/status-stack.js";
import {
  characterAbilityIds,
  getCharacterAbility,
} from "./character-abilities.js";
import {
  createTowEncounter,
  SUPPORTED_SKILL_EFFECT_TYPES,
  useSkill,
} from "./encounter.js";
import { STARTING_ARCHETYPES } from "./starting-archetypes.js";

function encounterFor(skillId, {
  playerHp = 100,
  enemyHp = 300,
  playerStatuses = createStatusStack(),
  enemyStatuses = createStatusStack(),
} = {}) {
  const created = createTowEncounter({
    seed: `character-ability:${skillId}`,
    player: {
      id: "wanderer",
      name: "Tester",
      hp: playerHp,
      maxHp: 200,
      stats: { attack: 20, defense: 20, critRate: 0, dodgeRate: 0 },
    },
    enemies: [{
      id: "foe",
      name: "Target",
      hp: enemyHp,
      maxHp: 400,
      stats: { attack: 1, defense: 0, critRate: 0, dodgeRate: 0 },
      attacks: [{ id: "wait", name: "Wait", hits: 1, damage: 0 }],
    }],
    build: { traits: {}, skills: [skillId], runes: [] },
  });
  return {
    ...created,
    actors: {
      ...created.actors,
      wanderer: { ...created.actors.wanderer, hp: playerHp, statuses: playerStatuses },
      foe: { ...created.actors.foe, hp: enemyHp, statuses: enemyStatuses },
    },
  };
}

describe("source roster ability catalogue", () => {
  it("contains 60 sourced, exclusive abilities in twelve complete five-slot kits", () => {
    expect(characterAbilityIds()).toHaveLength(60);
    for (const archetype of STARTING_ARCHETYPES) {
      const definitions = archetype.build.skills.map((id) => getCharacterAbility(id));
      expect(definitions).toHaveLength(5);
      expect(new Set(definitions.map((definition) => definition.abilityType)))
        .toEqual(new Set(["basic-attack", "defensive", "archetype"]));
      expect(definitions.filter((definition) => definition.abilityType === "basic-attack")).toHaveLength(1);
      expect(definitions.filter((definition) => definition.abilityType === "defensive")).toHaveLength(1);
      expect(definitions.filter((definition) => definition.abilityType === "archetype")).toHaveLength(3);
      for (const definition of definitions) {
        expect(definition.exclusiveTo).toBe(archetype.id);
        expect(definition.source.page).toMatch(/^https:\/\/(?:namu\.wiki|apps\.apple\.com)\//);
        expect(definition.source.sourceName).toBeTruthy();
      }
    }
  });

  it("only advertises effect primitives the production encounter resolves", () => {
    const supported = new Set(SUPPORTED_SKILL_EFFECT_TYPES);
    const effects = characterAbilityIds().flatMap((id) => getCharacterAbility(id).effects);
    expect(effects.every((effect) => supported.has(effect.type))).toBe(true);
  });

  it("resolves the Assassin's missing-health execution payoff", () => {
    const state = encounterFor("assassin-execution", { enemyHp: 200 });
    const result = useSkill(state, "assassin-execution", "foe");
    expect(result.ok).toBe(true);
    // 20 direct damage, then 45% of the target's original 200 missing health.
    expect(result.state.actors.foe.hp).toBeLessThanOrEqual(90);
  });

  it("resolves authored multi-hit actions as their full hit count", () => {
    const result = useSkill(encounterFor("demon-arrow-rain"), "demon-arrow-rain", "foe");
    expect(result.ok).toBe(true);
    const damageEvent = result.state.events.find((event) => (
      event.type === "skill-damage" && event.skillId === "demon-arrow-rain"
    ));
    expect(damageEvent.hits).toHaveLength(4);
  });

  it("resolves dual-stat healing for Blood Thirst", () => {
    const state = encounterFor("vampire-blood-thirst", { playerHp: 40 });
    const result = useSkill(state, "vampire-blood-thirst", "foe");
    expect(result.ok).toBe(true);
    expect(result.state.actors.wanderer.hp).toBe(76);
  });

  it("amplifies the Priestess's three lingering wounds", () => {
    let statuses = createStatusStack();
    statuses = applyStatus(statuses, "burn", 10);
    statuses = applyStatus(statuses, "poison", 20);
    statuses = applyStatus(statuses, "bleed", 5);
    const state = encounterFor("priestess-doom", { enemyStatuses: statuses });
    const result = useSkill(state, "priestess-doom", "foe");
    expect(result.ok).toBe(true);
    expect(statusCount(result.state.actors.foe.statuses, "burn")).toBe(16);
    expect(statusCount(result.state.actors.foe.statuses, "poison")).toBe(32);
    expect(statusCount(result.state.actors.foe.statuses, "bleed")).toBe(8);
  });
});
