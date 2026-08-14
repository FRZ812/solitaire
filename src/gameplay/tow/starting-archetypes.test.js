import { describe, expect, it } from "vitest";
import { applyBeat } from "../../engine/beat.js";
import { emptyMechanicsSidecar } from "../../engine/campaign-migration.js";
import { makeInitialState } from "../../data/initial-state.js";
import { applyCharacterBootstrap, compileCharacterBootstrap } from "./character-bootstrap.js";
import { CHARACTER_ABILITY_TYPES } from "./character-abilities.js";
import { getSkill } from "./skills.js";
import { practiceActor } from "./practice-scenarios.js";
import {
  STARTING_ARCHETYPES,
  TOWER_ROSTER_SIZE,
  characterSetupForArchetype,
  getStartingArchetype,
  invalidStartingArchetypes,
} from "./starting-archetypes.js";
import {
  effectiveTowBuild,
  invalidTowStartItemGrants,
  towItemActorBonuses,
} from "./start-items.js";

describe("source-roster starting grants", () => {
  it("all source roster equipment resolves without an unmapped power grant", () => {
    expect(invalidTowStartItemGrants()).toEqual([]);
    expect(invalidStartingArchetypes()).toEqual([]);
  });

  it("derives item bonuses without mutating the four-action durable build", () => {
    const archetype = getStartingArchetype("arctic-knight");
    const compiled = compileCharacterBootstrap({ archetypeId: archetype.id, origin: "archetype" });
    const before = JSON.stringify(compiled.receipt.build);
    const effective = effectiveTowBuild(compiled.receipt.build, archetype.gear);

    expect(effective.skills).toEqual(archetype.build.skills);
    expect(towItemActorBonuses(archetype.gear)).toMatchObject({
      attack: expect.any(Number),
      defense: expect.any(Number),
      maxHp: expect.any(Number),
    });
    expect(JSON.stringify(compiled.receipt.build)).toBe(before);
  });

  it("takes every character's source base-stat chassis into practice", () => {
    for (const archetype of STARTING_ARCHETYPES) {
      const compiled = compileCharacterBootstrap({ archetypeId: archetype.id, origin: "archetype" });
      const actor = practiceActor(compiled.receipt);
      const bonus = towItemActorBonuses(archetype.gear);
      expect(actor.maxHp, archetype.id).toBe(archetype.baseStats.maxHp + bonus.maxHp);
      expect(actor.stats, archetype.id).toEqual({
        attack: archetype.baseStats.attack + bonus.attack,
        defense: archetype.baseStats.defense + bonus.defense,
        critRate: archetype.baseStats.critRate + bonus.critRate,
        dodgeRate: archetype.baseStats.dodgeRate + bonus.dodgeRate,
      });
    }
  });
});

describe("one atomic source-character start", () => {
  it("creates identity, source stats, portrait, equipment, and durable build without limbo", () => {
    const state = makeInitialState();
    const archetype = getStartingArchetype("forsaken-automaton");
    const setup = characterSetupForArchetype({ archetypeId: archetype.id });
    const compiled = compileCharacterBootstrap({ archetypeId: archetype.id, origin: "archetype" });
    const applied = applyCharacterBootstrap(emptyMechanicsSidecar(), compiled.receipt);
    expect(applied.ok).toBe(true);

    const worn = setup.items.map((item) => item.itemId);
    const built = applyBeat(state, {
      character_setup: setup,
      inventory_changes: { added: setup.items.map(({ itemId, quantity }) => ({ itemId, quantity })) },
      discoveries: { characters: [{ id: "wanderer", worn }] },
    });
    built.mechanics = applied.mechanics;

    expect(built.created).toBe(true);
    expect(built.character.attributes).toEqual(archetype.attributes);
    expect(built.character).toMatchObject({
      name: archetype.character.name,
      combatArchetypeId: archetype.id,
      progressionModel: "tow-archetype",
      portraitKey: archetype.character.portraitKey,
      towBaseStats: archetype.baseStats,
    });
    expect(built.world.codex.characters.wanderer).toMatchObject({
      portraitKey: archetype.character.portraitKey,
      towBaseStats: archetype.baseStats,
      worn,
    });
    expect(built.mechanics.bootstrapOrigin).toBe("archetype");
    expect(built.mechanics.build).toEqual(compiled.receipt.build);
  });

  it("locks all twelve entries to complete identities and one of each action type", () => {
    expect(STARTING_ARCHETYPES).toHaveLength(TOWER_ROSTER_SIZE);
    const names = new Set();
    for (const archetype of STARTING_ARCHETYPES) {
      const setup = characterSetupForArchetype({
        archetypeId: archetype.id,
        visageId: "sunward",
        name: "Player Chosen",
      });
      expect(setup.name).toBe(archetype.character.name);
      expect(setup.portraitKey).toBe(archetype.character.portraitKey);
      expect(setup.profile).toMatchObject({
        source: "tow-authored-character-start",
        sourceName: archetype.character.sourceName,
        characterId: archetype.character.id,
        characterName: archetype.character.name,
      });
      expect(setup).not.toHaveProperty("templateId");
      expect(setup.level).toBe(1);
      expect(setup.progressionModel).toBe("tow-archetype");
      const types = archetype.build.skills.map((id) => getSkill(id).abilityType);
      expect(new Set(types)).toEqual(new Set(CHARACTER_ABILITY_TYPES));
      names.add(setup.name);
    }
    expect(names.size).toBe(TOWER_ROSTER_SIZE);
  });
});
