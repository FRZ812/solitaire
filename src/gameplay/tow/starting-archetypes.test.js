import { describe, expect, it } from "vitest";
import { applyBeat } from "../../engine/beat.js";
import { emptyMechanicsSidecar } from "../../engine/campaign-migration.js";
import { makeInitialState } from "../../data/initial-state.js";
import { applyCharacterBootstrap, compileCharacterBootstrap } from "./character-bootstrap.js";
import { createTowEncounter } from "./encounter.js";
import {
  STARTING_ARCHETYPES,
  characterSetupForArchetype,
  getStartingArchetype,
} from "./starting-archetypes.js";
import {
  effectiveTowBuild,
  invalidTowStartItemGrants,
  towItemActorBonuses,
} from "./start-items.js";

describe("TOW starting item grants", () => {
  it("all resolve to canonical items, traits, skills, and fusions", () => {
    expect(invalidTowStartItemGrants()).toEqual([]);
  });

  it("derives power from worn item ids without mutating the durable build", () => {
    const compiled = compileCharacterBootstrap({ archetypeId: "dawnwarden", origin: "archetype" });
    const before = JSON.stringify(compiled.receipt.build);
    const itemIds = getStartingArchetype("dawnwarden").gear;
    const effective = effectiveTowBuild(compiled.receipt.build, itemIds);

    expect(effective.traits.metalize).toBe(7);
    expect(towItemActorBonuses(itemIds)).toMatchObject({ attack: 4, maxHp: 20 });
    expect(JSON.stringify(compiled.receipt.build)).toBe(before);

    const unequipped = effectiveTowBuild(compiled.receipt.build, itemIds.filter((id) => id !== "dawnward-mace"));
    expect(unequipped.traits).not.toHaveProperty("metalize");
  });

  it("fires an item-granted fusion in the real encounter reducer", () => {
    const compiled = compileCharacterBootstrap({ archetypeId: "dawnwarden", origin: "archetype" });
    const build = effectiveTowBuild(compiled.receipt.build, getStartingArchetype("dawnwarden").gear);
    const encounter = createTowEncounter({
      seed: "fusion-start",
      player: { id: "wanderer", name: "Mira", maxHp: 100, stats: { attack: 12, defense: 12, critRate: 0, dodgeRate: 0 } },
      enemies: [{ id: "foe", name: "Foe", maxHp: 20, stats: { attack: 3, defense: 0, critRate: 0, dodgeRate: 0 }, attacks: [{ id: "tap", name: "Tap", hits: 1, damage: 1 }] }],
      build,
    });
    expect(encounter.actors.wanderer.statuses.find((status) => status.type === "steelskin")?.count)
      .toBeGreaterThanOrEqual(40);
  });
});

describe("one atomic archetype start", () => {
  it("creates the player, portrait, equipment, and durable build without limbo", () => {
    const state = makeInitialState();
    const setup = characterSetupForArchetype({ archetypeId: "night-sovereign", visageId: "sunward", name: "Mira Vale" });
    const compiled = compileCharacterBootstrap({ archetypeId: "night-sovereign", origin: "archetype" });
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
    expect(built.character.attributes).toEqual(getStartingArchetype("night-sovereign").attributes);
    expect(built.character).toMatchObject({
      name: "Mira Vale",
      combatArchetypeId: "night-sovereign",
      progressionModel: "tow-archetype",
      portraitKey: "template:devout",
    });
    expect(built.world.codex.characters.wanderer.portraitKey).toBe("template:devout");
    expect(built.world.codex.characters.wanderer.worn).toEqual(worn);
    expect(built.mechanics.bootstrapOrigin).toBe("archetype");
    expect(built.mechanics.build).toEqual(compiled.receipt.build);
  });

  it("never writes legacy authored names or template ids", () => {
    for (const archetype of STARTING_ARCHETYPES) {
      const setup = characterSetupForArchetype({
        archetypeId: archetype.id,
        visageId: archetype.portraitId,
        name: "Player Chosen",
      });
      expect(setup.name).toBe("Player Chosen");
      expect(setup).not.toHaveProperty("templateId");
      expect(setup.level).toBe(1);
      expect(setup.progressionModel).toBe("tow-archetype");
    }
  });
});
